const VALID_REASONS = new Set([
  "concept_misunderstanding",
  "calculation_error",
  "problem_interpretation",
  "memory_gap",
]);

export async function diagnoseMistake({ problem, selectedAnswer, client, timeoutMs = 2500 }) {
  let aiTrace = buildAiTrace({
    fallbackReason: "client_missing",
    message: "Manus 진단 클라이언트가 없어 규칙 진단으로 전환했습니다.",
  });

  if (client?.diagnose) {
    try {
      const diagnosis = await withTimeout(client.diagnose({
        problem,
        selectedAnswer,
        selectedOption: problem.options[selectedAnswer],
        correctAnswer: problem.answer,
        correctOption: problem.options[problem.answer],
      }), timeoutMs);
      if (isValidDiagnosis(diagnosis)) return diagnosis;
      aiTrace = buildAiTrace({
        fallbackReason: "invalid_structured_diagnosis",
        message: "Manus 응답은 왔지만 진단 형식이 부족해 규칙 진단으로 전환했습니다.",
      });
    } catch (error) {
      // Rule-based fallback keeps the judged demo available without Manus API.
      aiTrace = buildAiTraceFromError(error);
    }
  }

  return fallbackDiagnosis({ problem, selectedAnswer, aiTrace });
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        const error = new Error("diagnosis_timeout");
        error.code = "diagnosis_timeout";
        reject(error);
      }, timeoutMs);
    }),
  ]);
}

export function fallbackDiagnosis({ problem, selectedAnswer, aiTrace = null }) {
  const selectedText = String(problem.options[selectedAnswer] || "");
  const questionText = `${problem.question} ${problem.explanation} ${selectedText}`;
  let reason = "concept_misunderstanding";
  let conceptGap = problem.conceptKo;
  let evidence = `선택한 답 "${selectedText}"이 정답 "${problem.options[problem.answer]}"과 다릅니다.`;

  if (/더|남은|필요|조건|핵심 주어|빈칸/.test(questionText)) {
    reason = "problem_interpretation";
    conceptGap = `${problem.conceptKo} 문제 조건 읽기`;
    evidence = "문제의 조건이나 핵심 표현을 먼저 확인해야 하는 유형입니다.";
  }

  if (/m\/s|N|kg|계산|÷|×|\+|-/.test(questionText) && /\d/.test(selectedText)) {
    reason = problem.concept.includes("fraction") ? "concept_misunderstanding" : "calculation_error";
  }

  if (/분모끼리|2\/7|3\/7/.test(selectedText)) {
    reason = "concept_misunderstanding";
    conceptGap = "분모가 다른 분수의 통분";
    evidence = "분모끼리 바로 더하는 대표 오답을 선택했습니다.";
  }

  return {
    reason,
    conceptGap,
    evidence,
    recommendation: `${problem.conceptKo}의 같은 개념 문제를 다시 풀고, 풀이 전 핵심 조건을 표시하세요.`,
    nextAction: "same_concept_retry",
    confidence: 0.74,
    source: "rule_based_fallback",
    fallbackReason: (aiTrace || {}).fallbackReason || "offline_rule_based_demo",
    fallbackMessage: (aiTrace || {}).message || "발표가 끊기지 않도록 규칙 진단으로 처리했습니다.",
    aiTrace: aiTrace || buildAiTrace({
      fallbackReason: "offline_rule_based_demo",
      message: "발표가 끊기지 않도록 규칙 진단으로 처리했습니다.",
    }),
  };
}

function isValidDiagnosis(diagnosis) {
  return Boolean(
    diagnosis &&
      VALID_REASONS.has(diagnosis.reason) &&
      diagnosis.conceptGap &&
      diagnosis.evidence &&
      diagnosis.recommendation &&
      diagnosis.nextAction
  );
}

function buildAiTraceFromError(error) {
  const message = String(error?.message || "");
  const code = String(error?.code || "");

  if (code === "diagnosis_timeout" || message === "diagnosis_timeout") {
    return buildAiTrace({
      fallbackReason: "diagnosis_timeout",
      message: "Manus 진단 응답 시간이 길어 규칙 진단으로 전환했습니다.",
    });
  }

  if (message.includes("API key") || message.includes("api key")) {
    return buildAiTrace({
      fallbackReason: "missing_api_key",
      message: "Manus API 키 설정이 없어 규칙 진단으로 전환했습니다.",
    });
  }

  if (code === "structured_output_failed" || message.includes("structured output")) {
    return buildAiTrace({
      fallbackReason: "structured_output_failed",
      message: "Manus가 구조화 진단 결과를 만들지 못해 규칙 진단으로 전환했습니다.",
    });
  }

  if (message.includes("did not return task_id")) {
    return buildAiTrace({
      fallbackReason: "task_create_failed",
      message: "Manus 작업 생성 응답이 부족해 규칙 진단으로 전환했습니다.",
    });
  }

  if (message.includes("waiting for user input")) {
    return buildAiTrace({
      fallbackReason: "waiting_for_user",
      message: "Manus 작업이 추가 입력을 기다려 규칙 진단으로 전환했습니다.",
    });
  }

  if (message.includes("stopped without structured diagnosis")) {
    return buildAiTrace({
      fallbackReason: "task_stopped_without_output",
      message: "Manus 작업은 끝났지만 구조화 진단이 없어 규칙 진단으로 전환했습니다.",
    });
  }

  if (message.includes("Manus API failed")) {
    return buildAiTrace({
      fallbackReason: "manus_api_http_error",
      message: "Manus API 응답 오류로 규칙 진단으로 전환했습니다.",
    });
  }

  if (error?.name === "AbortError") {
    return buildAiTrace({
      fallbackReason: "manus_request_timeout",
      message: "Manus 요청 시간이 초과되어 규칙 진단으로 전환했습니다.",
    });
  }

  return buildAiTrace({
    fallbackReason: "manus_client_error",
    message: "Manus 진단 처리 중 오류가 생겨 규칙 진단으로 전환했습니다.",
  });
}

function buildAiTrace({ fallbackReason, message }) {
  return {
    provider: "manus",
    path: "diagnosis",
    fallbackReason,
    message,
  };
}
