export const codefairDttRequirements = [
  {
    id: "attempt-data",
    definition: "Student answer attempts are stored with question, selected answer, correctness, concept, reason, and review date.",
    testRefs: ["tests/concept-master.test.mjs::learning events preserve required CodeFair evidence fields"],
    codeRefs: ["src/learning.js::createLearningEvent", "src/app.js::handleAnswer"],
    evidenceRefs: ["SUBMISSION_PACKAGE.md::core-data", "README.md::demo-flow"],
    scoreAxis: "data",
  },
  {
    id: "ai-diagnosis",
    definition: "Wrong answers produce structured AI diagnosis with reason, evidence, recommendation, next action, and safe fallback.",
    testRefs: ["tests/concept-master.test.mjs::AI diagnosis uses Manus adapter success and falls back safely"],
    codeRefs: ["src/diagnosis.js::diagnoseMistake", "src/manusClient.js::diagnose"],
    evidenceRefs: ["LIVE_MANUS_VERIFICATION.md::diagnose", "SUBMISSION_PACKAGE.md::limitations"],
    scoreAxis: "ai",
  },
  {
    id: "same-concept-retry",
    definition: "The next activity is a vetted or generated same-concept retry problem, not a generic quiz item.",
    testRefs: ["tests/concept-master.test.mjs::wrong answers recommend another same-concept problem"],
    codeRefs: ["src/problems.js::recommendNextProblem", "src/generation.js::generateSimilarProblem"],
    evidenceRefs: ["README.md::problem-bank", "SUBMISSION_PACKAGE.md::demo-script"],
    scoreAxis: "learning-loop",
  },
  {
    id: "qa-gate",
    definition: "Generated problems remain needs_review and expose QA issues until their structure is safe enough to render.",
    testRefs: ["tests/concept-master.test.mjs::generated problem quality gate flags missing review evidence"],
    codeRefs: ["src/problems.js::validateGeneratedProblem", "src/app.js::renderGeneratedQaNotice"],
    evidenceRefs: ["README.md::quality-boundary", "SUBMISSION_PACKAGE.md::limitations"],
    scoreAxis: "trust",
  },
  {
    id: "mastery-review",
    definition: "Retry results update mastery score, improvement rate, repeated mistakes, and ts-fsrs review schedule.",
    testRefs: ["tests/concept-master.test.mjs::mastery scores expose concept understanding", "tests/concept-master.test.mjs::review schedule uses vendored ts-fsrs"],
    codeRefs: ["src/learning.js::buildDashboardModel", "src/reviewScheduler.js::scheduleReviewWithFsrs"],
    evidenceRefs: ["README.md::learning-engine", "SUBMISSION_PACKAGE.md::core-data"],
    scoreAxis: "measurable-improvement",
  },
  {
    id: "judge-demo",
    definition: "Judges can see data -> AI -> retry -> improvement evidence inside the 30-second demo and 2-minute presentation script.",
    testRefs: ["tests/concept-master.test.mjs::presentation plan anchors a 2-minute script"],
    codeRefs: ["src/presentationPlan.js::buildPresentationPlan", "src/app.js::runJudgeDemo"],
    evidenceRefs: ["SUBMISSION_PACKAGE.md::two-minute-script", "HANDOFF_GEONHO.md::demo-path"],
    scoreAxis: "presentation",
  },
];

export function buildDttTrace(requirements = codefairDttRequirements) {
  return {
    method: "Definition -> Test -> Trace",
    requirementCount: requirements.length,
    scoreAxes: [...new Set(requirements.map((item) => item.scoreAxis))],
    requirements: requirements.map((item, index) => ({
      ...item,
      order: index + 1,
      traceLabel: `D${index + 1}: ${item.id}`,
      testCount: item.testRefs.length,
      codeCount: item.codeRefs.length,
      evidenceCount: item.evidenceRefs.length,
    })),
  };
}

export function validateDttTrace(trace = buildDttTrace()) {
  const issues = [];
  const requiredIds = [
    "attempt-data",
    "ai-diagnosis",
    "same-concept-retry",
    "qa-gate",
    "mastery-review",
    "judge-demo",
  ];

  if (trace.method !== "Definition -> Test -> Trace") {
    issues.push("trace method must be Definition -> Test -> Trace");
  }
  if (trace.requirementCount !== requiredIds.length) {
    issues.push(`expected ${requiredIds.length} requirements, got ${trace.requirementCount}`);
  }

  const ids = new Set((trace.requirements || []).map((item) => item.id));
  requiredIds.forEach((id) => {
    if (!ids.has(id)) issues.push(`missing requirement ${id}`);
  });

  (trace.requirements || []).forEach((item) => {
    if (!item.definition) issues.push(`${item.id}: missing definition`);
    if (!item.scoreAxis) issues.push(`${item.id}: missing score axis`);
    if (!Array.isArray(item.testRefs) || item.testRefs.length === 0) issues.push(`${item.id}: missing test refs`);
    if (!Array.isArray(item.codeRefs) || item.codeRefs.length === 0) issues.push(`${item.id}: missing code refs`);
    if (!Array.isArray(item.evidenceRefs) || item.evidenceRefs.length === 0) issues.push(`${item.id}: missing evidence refs`);
  });

  return {
    status: issues.length === 0 ? "PASS" : "FAIL",
    issueCount: issues.length,
    issues,
  };
}
