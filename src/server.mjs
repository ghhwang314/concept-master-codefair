import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

import { diagnoseMistake, fallbackDiagnosis } from "./diagnosis.js";
import { loadEnvFile } from "./env.js";
import { generateSimilarProblem } from "./generation.js";
import { buildCreditPolicy, shouldUseLiveManus } from "./manusCreditPolicy.js";
import { ManusAiClient } from "./manusClient.js";
import { getProblems } from "./problems.js";
import { isSafeStaticPath } from "./staticSecurity.js";

const root = normalize(join(fileURLToPath(new URL("..", import.meta.url))));
loadEnvFile(root);
const port = Number(process.env.PORT || 4173);
const diagnosisCache = new Map();
const generatedProblemCache = new Map();

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const server = createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/diagnose") {
      const body = await readJson(req);
      const problem = getProblems().find((item) => item.id === body.questionId);
      if (!problem) return sendJson(res, 404, { error: "problem_not_found" });
      const requestedLiveAi = body.useLiveAi === true;
      const cacheKey = buildDiagnosisCacheKey({ questionId: problem.id, selectedAnswer: body.selectedAnswer });

      console.log(`\n📥 [요청 수신] 오답 진단 요청 수신 (문제 ID: ${problem.id})`);
      console.log(`   - 질문: "${problem.question}"`);
      console.log(`   - 학생 선택: ${body.selectedAnswer + 1}번 보기 ("${problem.options[body.selectedAnswer]}")`);
      console.log(`   - 실제 정답: ${problem.answer + 1}번 보기 ("${problem.options[problem.answer]}")`);

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

      console.log(`   🔍 [AI 호출] 마노스 AI 에이전트(manus-1.6-lite)에게 오답 원인 실시간 분석을 요청합니다. (대기 시간 발생)...`);
      const diagnosis = await diagnoseMistake({
        problem,
        selectedAnswer: body.selectedAnswer,
        client: new ManusAiClient(),
        timeoutMs: Number(process.env.MANUS_DIAGNOSIS_TIMEOUT_MS || 20_000),
      });
      logDiagnosisFallback({ diagnosis, questionId: problem.id });
      
      console.log(`   ✅ [AI 응답 완료] 마노스 AI 분석 완료!`);
      console.log(`      - 분석 원인: ${diagnosis.reason} (개념 격차: ${diagnosis.conceptGap})`);
      console.log(`      - 판단 근거: "${diagnosis.evidence}"`);
      console.log(`      - 추천 피드백: "${diagnosis.recommendation}"`);

      if (diagnosis.source === "manus_api") diagnosisCache.set(cacheKey, diagnosis);
      return sendJson(res, 200, withCreditPolicy(diagnosis, {
        requestedLiveAi,
        liveManusUsed: diagnosis.source === "manus_api",
        cacheHit: false,
      }));
    }

    if (req.method === "POST" && req.url === "/api/generate-similar-problem") {
      const body = await readJson(req);
      const problem = getProblems().find((item) => item.id === body.questionId);
      if (!problem) return sendJson(res, 404, { error: "problem_not_found" });
      const requestedLiveAi = body.useLiveAi === true;
      const cacheKey = buildGenerationCacheKey({
        questionId: problem.id,
        diagnosis: body.diagnosis,
        sequence: Number(body.sequence || 1),
      });

      console.log(`\n📥 [요청 수신] 유사문항 생성 요청 수신 (원래 문제 ID: ${problem.id})`);
      console.log(`   - 분석된 오답 원인: ${body.diagnosis?.reason || "알 수 없음"}`);

      if (requestedLiveAi && generatedProblemCache.has(cacheKey)) {
        console.log(`   ♻️  [캐시 히트] 이미 생성된 AI 유사 문항이 캐시 메모리에 있어 재사용합니다.`);
        return sendJson(res, 200, withCreditPolicy(generatedProblemCache.get(cacheKey), {
          requestedLiveAi,
          liveManusUsed: false,
          cacheHit: true,
        }));
      }

      console.log(`   🔍 [AI 호출] 마노스 AI 에이전트(manus-1.6-lite)에게 맞춤형 유사문항 실시간 생성을 요청합니다...`);
      const generatedProblem = await generateSimilarProblem({
        sourceProblem: problem,
        diagnosis: body.diagnosis,
        sequence: Number(body.sequence || 1),
        client: shouldUseLiveManus({ requestedLiveAi }) ? new ManusAiClient() : null,
        timeoutMs: Number(process.env.MANUS_GENERATION_TIMEOUT_MS || process.env.MANUS_DIAGNOSIS_TIMEOUT_MS || 20_000),
      });

      console.log(`   ✅ [AI 생성 완료] 맞춤형 문항이 준비되었습니다.`);
      console.log(`      - 출제된 질문: "${generatedProblem.question}"`);
      console.log(`      - 선택지 정보: ${generatedProblem.options.map((opt, idx) => `${idx + 1}. ${opt}`).join(" / ")}`);
      console.log(`      - 정답 위치: ${generatedProblem.answer + 1}번 보기 ("${generatedProblem.options[generatedProblem.answer]}")`);
      console.log(`      - 출제 사유: "${generatedProblem.sourceReason}"`);
      console.log(`      - 생성 방식: ${generatedProblem.generatedBy === "manus_api" ? "실시간 마노스 API 호출" : "안전 템플릿 fallback"}`);

      if (generatedProblem.generatedBy === "manus_api") generatedProblemCache.set(cacheKey, generatedProblem);
      return sendJson(res, 200, withCreditPolicy(generatedProblem, {
        requestedLiveAi,
        liveManusUsed: generatedProblem.generatedBy === "manus_api",
        cacheHit: false,
      }));
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
