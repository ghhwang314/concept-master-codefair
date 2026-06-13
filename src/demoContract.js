export const DEMO_API_TIMEOUT_MS = 4_500;

export const JUDGE_DEMO_STAGE_IDS = [
  "wrong",
  "diagnosis",
  "generation",
  "retry",
  "improvement",
];

export function buildJudgeDemoContract({
  apiTimeoutMs = DEMO_API_TIMEOUT_MS,
  localDelayMs = {
    wrong: 500,
    diagnosisReview: 750,
    generationReview: 700,
    retryReview: 500,
  },
} = {}) {
  const maxDurationMs =
    localDelayMs.wrong +
    apiTimeoutMs +
    localDelayMs.diagnosisReview +
    apiTimeoutMs +
    localDelayMs.generationReview +
    localDelayMs.retryReview;

  return {
    name: "ConceptMaster 30-second judge demo",
    maxDurationMs,
    requiredMaxDurationMs: 30_000,
    stages: [...JUDGE_DEMO_STAGE_IDS],
    dataSource: "judge_demo",
    diagnosisFallback: "rule_based_fallback",
    generationFallback: "template_fallback",
    retryResult: "retried_then_cleared",
    externalApiRequired: false,
  };
}

export function validateJudgeDemoContract(contract = buildJudgeDemoContract()) {
  const issues = [];

  if (contract.maxDurationMs > contract.requiredMaxDurationMs) {
    issues.push(`demo max duration ${contract.maxDurationMs}ms exceeds ${contract.requiredMaxDurationMs}ms`);
  }
  if (contract.externalApiRequired !== false) {
    issues.push("demo must not require live Manus API");
  }
  if (contract.dataSource !== "judge_demo") {
    issues.push("demo dataSource must be judge_demo");
  }
  if (contract.diagnosisFallback !== "rule_based_fallback") {
    issues.push("diagnosis fallback must be rule_based_fallback");
  }
  if (contract.generationFallback !== "template_fallback") {
    issues.push("generation fallback must be template_fallback");
  }
  if (contract.retryResult !== "retried_then_cleared") {
    issues.push("retry result must mark understanding recovery");
  }
  if (JSON.stringify(contract.stages) !== JSON.stringify(JUDGE_DEMO_STAGE_IDS)) {
    issues.push("judge demo stages must stay wrong -> diagnosis -> generation -> retry -> improvement");
  }

  return {
    status: issues.length === 0 ? "PASS" : "FAIL",
    issueCount: issues.length,
    issues,
  };
}
