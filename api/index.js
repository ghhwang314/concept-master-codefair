import { diagnoseMistake, fallbackDiagnosis } from "../src/diagnosis.js";
import { generateSimilarProblem } from "../src/generation.js";
import { buildCreditPolicy, shouldUseLiveManus } from "../src/manusCreditPolicy.js";
import { ManusAiClient } from "../src/manusClient.js";
import { getProblems } from "../src/problems.js";
import { loadEnvFile } from "../src/env.js";
import { normalize, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = normalize(join(fileURLToPath(new URL("..", import.meta.url))));
loadEnvFile(root);

const diagnosisCache = new Map();
const generatedProblemCache = new Map();

export default async function handler(req, res) {
  try {
    if (req.method === "POST" && req.url.includes("/api/diagnose")) {
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

      console.log(`   🔍 [AI 호출] 마노스 AI 에이전트(manus-1.6-lite)에게 오답 원인 실시간 분석을 요청합니다...`);
      const diagnosis = await diagnoseMistake({
        problem,
        selectedAnswer: body.selectedAnswer,
        client: new ManusAiClient(),
        timeoutMs: Number(process.env.MANUS_DIAGNOSIS_TIMEOUT_MS || 20_000),
      });
      logDiagnosisFallback({ diagnosis, questionId: problem.id });
      
      console.log(`   ✅ [AI 응답 완료] 마노스 AI 분석 완료!`);

      if (diagnosis.source === "manus_api") diagnosisCache.set(cacheKey, diagnosis);
      return res.status(200).json(withCreditPolicy(diagnosis, {
        requestedLiveAi,
        liveManusUsed: diagnosis.source === "manus_api",
        cacheHit: false,
      }));
    }

    if (req.method === "POST" && req.url.includes("/api/generate-similar-problem")) {
      const body = req.body || {};
      const problem = getProblems().find((item) => item.id === body.questionId);
      if (!problem) return res.status(404).json({ error: "problem_not_found" });
      const requestedLiveAi = body.useLiveAi === true;
      const cacheKey = buildGenerationCacheKey({
        questionId: problem.id,
        diagnosis: body.diagnosis,
        sequence: Number(body.sequence || 1),
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

      console.log(`   🔍 [AI 호출] 마노스 AI 에이전트(manus-1.6-lite)에게 맞춤형 유사문항 실시간 생성을 요청합니다...`);
      const generatedProblem = await generateSimilarProblem({
        sourceProblem: problem,
        diagnosis: body.diagnosis,
        sequence: Number(body.sequence || 1),
        client: (requestedLiveAi && process.env.MANUS_API_KEY) ? new ManusAiClient() : null,
        timeoutMs: Number(process.env.MANUS_GENERATION_TIMEOUT_MS || process.env.MANUS_DIAGNOSIS_TIMEOUT_MS || 20_000),
      });

      console.log(`   ✅ [AI 생성 완료] 맞춤형 문항이 준비되었습니다.`);

      if (generatedProblem.generatedBy === "manus_api") generatedProblemCache.set(cacheKey, generatedProblem);
      return res.status(200).json(withCreditPolicy(generatedProblem, {
        requestedLiveAi,
        liveManusUsed: generatedProblem.generatedBy === "manus_api",
        cacheHit: false,
      }));
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
