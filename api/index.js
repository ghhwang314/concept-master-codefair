import { diagnoseMistake, fallbackDiagnosis } from "../src/diagnosis.js";
import { generateSimilarProblem } from "../src/generation.js";
import { buildCreditPolicy, shouldUseLiveManus } from "../src/manusCreditPolicy.js";
import { ManusAiClient } from "../src/manusClient.js";
import {
  getProblems,
  normalizeGeneratedProblem,
  validateGeneratedProblem,
  attachGeneratedQualityGate,
  createTemplateProblem
} from "../src/problems.js";
import { loadEnvFile } from "../src/env.js";
import { normalize, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = normalize(join(fileURLToPath(new URL("..", import.meta.url))));
loadEnvFile(root);

const diagnosisCache = new Map();
const generatedProblemCache = new Map();
const activeTasks = new Map();

export default async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const taskId = urlObj.searchParams.get("taskId");

    if (req.method === "GET" && urlObj.pathname.includes("/api/status")) {
      return res.status(200).json({ configured: !!process.env.MANUS_API_KEY });
    }

    if (req.url.includes("/api/diagnose")) {
      if (req.method === "GET" && taskId) {
        const task = activeTasks.get(taskId);
        if (!task) {
          // If task not found (e.g. cold start), return fallback immediately
          console.warn(`[Vercel API] task ${taskId} not found (cold start?), returning rule-based fallback`);
          const diagnosis = fallbackDiagnosis({
            problem: null,
            selectedAnswer: null,
            aiTrace: {
              provider: "manus",
              path: "diagnosis",
              fallbackReason: "client_missing",
              message: "서버가 재기동되어 오프라인 모드 진단으로 처리했습니다.",
            },
          });
          return res.status(200).json({
            status: "completed",
            diagnosis: withCreditPolicy(diagnosis, {
              requestedLiveAi: false,
              liveManusUsed: false,
              cacheHit: false,
            }),
          });
        }

        try {
          const client = new ManusAiClient();
          const result = await client.checkDiagnosis(taskId);
          if (result) {
            if (result.source === "manus_api") diagnosisCache.set(task.cacheKey, result);
            activeTasks.delete(taskId);
            return res.status(200).json({
              status: "completed",
              diagnosis: withCreditPolicy(result, {
                requestedLiveAi: task.requestedLiveAi,
                liveManusUsed: true,
                cacheHit: false,
              }),
            });
          }
          return res.status(200).json({ status: "processing" });
        } catch (error) {
          console.warn("[Vercel API] async diagnosis poll failed, falling back", error.message);
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
          return res.status(200).json({
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
        const body = req.body || {};
        const problem = getProblems().find((item) => item.id === body.questionId);
        if (!problem) return res.status(404).json({ error: "problem_not_found" });
        const requestedLiveAi = body.useLiveAi === true;
        const cacheKey = buildDiagnosisCacheKey({ questionId: problem.id, selectedAnswer: body.selectedAnswer });

        console.log(`\n📥 [요청 수신] 오답 진단 요청 수신 (문제 ID: ${problem.id})`);

        if (requestedLiveAi && diagnosisCache.has(cacheKey)) {
          console.log(`   ♻️  [캐시 히트] 이전에 분석 완료된 AI 진단 결과가 캐시 메모리에 있어 이를 재사용합니다.`);
          return res.status(200).json(withCreditPolicy(diagnosisCache.get(cacheKey), {
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
          return res.status(200).json(withCreditPolicy(diagnosis, {
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
        return res.status(200).json({ status: "processing", taskId: newTaskId });
      }
    }

    if (req.url.includes("/api/generate-similar-problem")) {
      if (req.method === "GET" && taskId) {
        const task = activeTasks.get(taskId);
        if (!task) {
          console.warn(`[Vercel API] task ${taskId} not found, returning rule-based problem template`);
          const fallback = createTemplateProblem({ sourceProblem: null, sequence: 1 });
          return res.status(200).json({
            status: "completed",
            problem: withCreditPolicy(fallback, {
              requestedLiveAi: false,
              liveManusUsed: false,
              cacheHit: false,
            }),
          });
        }

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
            return res.status(200).json({
              status: "completed",
              problem: withCreditPolicy(finalProblem, {
                requestedLiveAi: task.requestedLiveAi,
                liveManusUsed: gate.renderSafe,
                cacheHit: false,
              }),
            });
          }
          return res.status(200).json({ status: "processing" });
        } catch (error) {
          console.warn("[Vercel API] async generation poll failed, falling back", error.message);
          activeTasks.delete(taskId);
          const fallback = createTemplateProblem({ sourceProblem: task.problem, sequence: task.sequence });
          return res.status(200).json({
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
        const body = req.body || {};
        const problem = getProblems().find((item) => item.id === body.questionId);
        if (!problem) return res.status(404).json({ error: "problem_not_found" });
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
          return res.status(200).json(withCreditPolicy(generatedProblemCache.get(cacheKey), {
            requestedLiveAi,
            liveManusUsed: false,
            cacheHit: true,
          }));
        }

        if (!shouldUseLiveManus({ requestedLiveAi })) {
          console.log(`   ⚠️  [규칙 기반 fallback] 크레딧 절약 또는 로컬 오프라인 모드로 인해 안전 템플릿 문항을 즉시 반환합니다.`);
          const fallback = createTemplateProblem({ sourceProblem: problem, sequence });
          return res.status(200).json(withCreditPolicy(fallback, {
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
        return res.status(200).json({ status: "processing", taskId: newTaskId });
      }
    }

    return res.status(404).send("Not found");
  } catch (error) {
    console.error("Vercel Serverless Function Error:", error);
    return res.status(500).json({ error: "server_error", message: error.message });
  }
}

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
