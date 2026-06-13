import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

import { diagnoseMistake, fallbackDiagnosis } from "./diagnosis.js";
import { loadEnvFile } from "./env.js";
import { generateSimilarProblem } from "./generation.js";
import { buildCreditPolicy, shouldUseLiveManus } from "./manusCreditPolicy.js";
import { ManusAiClient } from "./manusClient.js";
import {
  getProblems,
  normalizeGeneratedProblem,
  validateGeneratedProblem,
  attachGeneratedQualityGate,
  createTemplateProblem
} from "./problems.js";
import { isSafeStaticPath } from "./staticSecurity.js";

const root = normalize(join(fileURLToPath(new URL("..", import.meta.url))));
loadEnvFile(root);
const port = Number(process.env.PORT || 4173);
const diagnosisCache = new Map();
const generatedProblemCache = new Map();
const activeTasks = new Map();

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const server = createServer(async (req, res) => {
  try {
    const urlObj = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = urlObj.pathname;
    const taskId = urlObj.searchParams.get("taskId");

    if (req.method === "GET" && pathname === "/api/status") {
      return sendJson(res, 200, { configured: !!process.env.MANUS_API_KEY });
    }

    if (pathname === "/api/diagnose") {
      if (req.method === "GET" && taskId) {
        const task = activeTasks.get(taskId);
        if (!task) return sendJson(res, 404, { error: "task_not_found" });

        try {
          const client = new ManusAiClient();
          const result = await client.checkDiagnosis(taskId);
          if (result) {
            if (result.source === "manus_api") diagnosisCache.set(task.cacheKey, result);
            activeTasks.delete(taskId);
            return sendJson(res, 200, {
              status: "completed",
              diagnosis: withCreditPolicy(result, {
                requestedLiveAi: task.requestedLiveAi,
                liveManusUsed: true,
                cacheHit: false,
              }),
            });
          }
          return sendJson(res, 200, { status: "processing" });
        } catch (error) {
          console.warn("[Local Server] async diagnosis poll failed, falling back", error.message);
          activeTasks.delete(taskId);
          const diagnosis = fallbackDiagnosis({
            problem: task.problem,
            selectedAnswer: task.selectedAnswer,
            aiTrace: {
              provider: "manus",
              path: "diagnosis",
              fallbackReason: "manus_client_error",
              message: error.message,
            },
          });
          return sendJson(res, 200, {
            status: "completed",
            diagnosis: withCreditPolicy(diagnosis, {
              requestedLiveAi: task.requestedLiveAi,
              liveManusUsed: false,
              cacheHit: false,
            }),
          });
        }
      }

      if (req.method === "POST") {
        const body = await readJson(req);
        const problem = getProblems().find((item) => item.id === body.questionId);
        if (!problem) return sendJson(res, 404, { error: "problem_not_found" });
        const requestedLiveAi = body.useLiveAi === true;
        const cacheKey = buildDiagnosisCacheKey({ questionId: problem.id, selectedAnswer: body.selectedAnswer });

        console.log(`\n📥 [요청 수신] 오답 진단 요청 수신 (문제 ID: ${problem.id})`);

        if (requestedLiveAi && diagnosisCache.has(cacheKey)) {
          console.log(`   ♻️  [캐시 히트] 이전에 분석 완료된 AI 진단 결과가 캐시 메모리에 있어 이를 재사용합니다.`);
          return sendJson(res, 200, withCreditPolicy(diagnosisCache.get(cacheKey), {
            requestedLiveAi,
            liveManusUsed: false,
            cacheHit: true,
          }));
        }

        if (!shouldUseLiveManus({ requestedLiveAi })) {
          console.log(`   ⚠️  [규칙 기반 fallback] 크레딧 절약 또는 로컬 오프라인 모드로 인해 마노스 API 호출 대신 규칙 기반 진단을 즉시 반환합니다.`);
          const diagnosis = fallbackDiagnosis({
            problem,
            selectedAnswer: body.selectedAnswer,
            aiTrace: {
              provider: "server",
              path: "diagnosis",
              fallbackReason: "credit_saver_mode",
              message: "크레딧 절약 모드라 Manus 호출 없이 규칙 진단으로 처리했습니다.",
            },
          });
          return sendJson(res, 200, withCreditPolicy(diagnosis, {
            requestedLiveAi,
            liveManusUsed: false,
            cacheHit: false,
          }));
        }

        console.log(`   🔍 [AI 호출] 마노스 AI 에이전트(manus-1.6-lite)에게 오답 원인 분석 작업 생성을 요청합니다...`);
        const client = new ManusAiClient();
        const newTaskId = await client.startDiagnosis({
          problem,
          selectedAnswer: body.selectedAnswer,
          selectedOption: problem.options[body.selectedAnswer],
          correctAnswer: problem.answer,
          correctOption: problem.options[problem.answer],
        });

        activeTasks.set(newTaskId, {
          type: "diagnosis",
          problem,
          selectedAnswer: body.selectedAnswer,
          requestedLiveAi,
          cacheKey,
        });

        console.log(`   ✅ [AI 작업 생성 완료] 작업 ID: ${newTaskId}. 클라이언트가 폴링을 시작합니다.`);
        return sendJson(res, 200, { status: "processing", taskId: newTaskId });
      }
    }

    if (pathname === "/api/generate-similar-problem") {
      if (req.method === "GET" && taskId) {
        const task = activeTasks.get(taskId);
        if (!task) return sendJson(res, 404, { error: "task_not_found" });

        try {
          const client = new ManusAiClient();
          const result = await client.checkGeneration(taskId);
          if (result) {
            const normalized = normalizeGeneratedProblem({
              sourceProblem: task.problem,
              generated: result,
              sequence: task.sequence,
              generatedBy: "manus_api",
            });
            const gate = validateGeneratedProblem(normalized);
            const finalProblem = gate.renderSafe ? normalized : attachGeneratedQualityGate(
              createTemplateProblem({ sourceProblem: task.problem, sequence: task.sequence }),
              [`Manus generated problem was not render-safe: ${gate.issues.join("; ")}`]
            );

            if (gate.renderSafe) generatedProblemCache.set(task.cacheKey, finalProblem);
            activeTasks.delete(taskId);
            return sendJson(res, 200, {
              status: "completed",
              problem: withCreditPolicy(finalProblem, {
                requestedLiveAi: task.requestedLiveAi,
                liveManusUsed: gate.renderSafe,
                cacheHit: false,
              }),
            });
          }
          return sendJson(res, 200, { status: "processing" });
        } catch (error) {
          console.warn("[Local Server] async generation poll failed, falling back", error.message);
          activeTasks.delete(taskId);
          const fallback = createTemplateProblem({ sourceProblem: task.problem, sequence: task.sequence });
          return sendJson(res, 200, {
            status: "completed",
            problem: withCreditPolicy(fallback, {
              requestedLiveAi: task.requestedLiveAi,
              liveManusUsed: false,
              cacheHit: false,
            }),
          });
        }
      }

      if (req.method === "POST") {
        const body = await readJson(req);
        const problem = getProblems().find((item) => item.id === body.questionId);
        if (!problem) return sendJson(res, 404, { error: "problem_not_found" });
        const requestedLiveAi = body.useLiveAi === true;
        const sequence = Number(body.sequence || 1);
        const cacheKey = buildGenerationCacheKey({
          questionId: problem.id,
          diagnosis: body.diagnosis,
          sequence,
        });

        console.log(`\n📥 [요청 수신] 유사문항 생성 요청 수신 (원래 문제 ID: ${problem.id})`);

        if (requestedLiveAi && generatedProblemCache.has(cacheKey)) {
          console.log(`   ♻️  [캐시 히트] 이미 생성된 AI 유사 문항이 캐시 메모리에 있어 재사용합니다.`);
          return sendJson(res, 200, withCreditPolicy(generatedProblemCache.get(cacheKey), {
            requestedLiveAi,
            liveManusUsed: false,
            cacheHit: true,
          }));
        }

        if (!shouldUseLiveManus({ requestedLiveAi })) {
          console.log(`   ⚠️  [규칙 기반 fallback] 크레딧 절약 또는 로컬 오프라인 모드로 인해 안전 템플릿 문항을 즉시 반환합니다.`);
          const fallback = createTemplateProblem({ sourceProblem: problem, sequence });
          return sendJson(res, 200, withCreditPolicy(fallback, {
            requestedLiveAi,
            liveManusUsed: false,
            cacheHit: false,
          }));
        }

        console.log(`   🔍 [AI 호출] 마노스 AI 에이전트(manus-1.6-lite)에게 맞춤형 유사문항 생성 작업 생성을 요청합니다...`);
        const client = new ManusAiClient();
        const newTaskId = await client.startGeneration({
          sourceProblem: problem,
          diagnosis: body.diagnosis,
        });

        activeTasks.set(newTaskId, {
          type: "generation",
          problem,
          sequence,
          requestedLiveAi,
          cacheKey,
        });

        console.log(`   ✅ [AI 작업 생성 완료] 작업 ID: ${newTaskId}. 클라이언트가 폴링을 시작합니다.`);
        return sendJson(res, 200, { status: "processing", taskId: newTaskId });
      }
    }

    const urlPath = new URL(req.url || "/", `http://${req.headers.host}`).pathname;
    const relative = urlPath === "/" ? "index.html" : urlPath.slice(1);
    if (!isSafeStaticPath(relative)) return sendText(res, 404, "Not found");
    const filePath = normalize(join(root, relative));
    if (!filePath.startsWith(root)) return sendText(res, 403, "Forbidden");

    const content = await readFile(filePath);
    res.writeHead(200, { "content-type": mime[extname(filePath)] || "application/octet-stream" });
    res.end(content);
  } catch (error) {
    if (error.code === "ENOENT") return sendText(res, 404, "Not found");
    sendJson(res, 500, { error: "server_error", message: error.message });
  }
});

server.listen(port, () => {
  console.log(`ConceptMaster CodeFair app listening on http://localhost:${port}`);
});

function logDiagnosisFallback({ diagnosis, questionId }) {
  if (diagnosis.source === "manus_api") return;
  const trace = diagnosis.aiTrace || {};
  console.warn("[ConceptMaster] Manus diagnosis fallback", JSON.stringify({
    questionId,
    source: diagnosis.source,
    fallbackReason: diagnosis.fallbackReason || trace.fallbackReason || "unknown",
    path: trace.path || "diagnosis",
  }));
}

function withCreditPolicy(payload, policyInput) {
  return {
    ...cloneJson(payload),
    creditPolicy: buildCreditPolicy(policyInput),
  };
}

function buildDiagnosisCacheKey({ questionId, selectedAnswer }) {
  return JSON.stringify({ questionId, selectedAnswer });
}

function buildGenerationCacheKey({ questionId, diagnosis, sequence }) {
  return JSON.stringify({
    questionId,
    reason: diagnosis?.reason || "",
    conceptGap: diagnosis?.conceptGap || "",
    sequence,
  });
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 100_000) {
        reject(new Error("request_too_large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text) {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  res.end(text);
}
