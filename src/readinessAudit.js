export const codefairReadinessMilestones = [
  {
    id: "P0",
    title: "Baseline fixed",
    scoreAxis: "verification",
    status: "Auto-Verified",
    evidenceRefs: [
      "npm test: 44 PASS",
      "QA_EVIDENCE/qa_result.json: browser smoke PASS",
      "QA_EVIDENCE/m3_retry_success_browser_check_20260608.json: M3 retry-success smoke PASS",
      "LIVE_MANUS_VERIFICATION.md: live Manus source evidence",
    ],
    risks: ["Human trial is not recorded yet."],
  },
  {
    id: "P1",
    title: "GitHub absorption",
    scoreAxis: "research-use",
    status: "Scoped",
    evidenceRefs: [
      "src/vendor/ts-fsrs/index.mjs: vendored scheduler",
      "src/reviewScheduler.js: capped CodeFair adapter",
      "README.md: upstream code-use boundary",
    ],
    risks: ["OATutor, Oppia, and pyBKT remain pattern references, not copied runtimes."],
  },
  {
    id: "P2",
    title: "Learning engine",
    scoreAxis: "data",
    status: "Explained",
    evidenceRefs: [
      "src/learning.js: wrong-rate, repeated mistake, mastery, review date",
      "tests/concept-master.test.mjs: dashboard and mastery contracts",
      "src/misconceptionMap.js: attempt_log and concept_summary evidence payload",
    ],
    risks: ["Seed data proves the loop; real student data still needs trial capture."],
  },
  {
    id: "P3",
    title: "AI quality",
    scoreAxis: "ai",
    status: "Fallback-safe",
    evidenceRefs: [
      "src/manusClient.js: Manus v2 task adapter",
      "src/diagnosis.js: structured diagnosis and fallback",
      "QA_EVIDENCE/manus_diagnosis_trace_20260608.md: live Manus diagnosis trace",
      "QA_EVIDENCE/manus_credit_saver_trace_20260608.md: default credit saver mode",
      "LIVE_MANUS_VERIFICATION.md: diagnosis fallback, generation Manus path",
    ],
    risks: ["Live diagnosis can be slow, so fallback status must stay visible."],
  },
  {
    id: "P4",
    title: "Elementary math judge UX",
    scoreAxis: "presentation",
    status: "Visible",
    evidenceRefs: [
      "index.html: elementary math scope, wrong-answer DNA map, data screen, research screen",
      "src/app.js: 30-second judge demo flow",
    ],
    risks: ["Do not add decoration that hides the data -> AI -> retry -> improvement loop."],
  },
  {
    id: "P5",
    title: "Submission package",
    scoreAxis: "submission",
    status: "Ready for student trial",
    evidenceRefs: [
      "SUBMISSION_PACKAGE.md: summary, architecture, 2-minute script, judge Q&A, limitations",
      "QA_EVIDENCE/m4_submission_alignment_check_20260609.md: judge package aligned to M3 proof",
      "GEONHO_HUMAN_TRIAL_CHECKLIST.md: explanation and trial gate",
    ],
    risks: ["Award language must stay judge-readable, not guaranteed."],
  },
  {
    id: "P6",
    title: "Handoff package",
    scoreAxis: "handoff",
    status: "Packaged",
    evidenceRefs: [
      "dist/concept-master-codefair-geonho-*.zip",
      "package_scan.v1.json: .env excluded, QA evidence included",
      "docs/HANDOFF_15_MIN.md: 15-minute local run and modify path",
      "docs/PROBLEM_ADDITION_GUIDE.md: vetted problem addition rules",
      "QA_EVIDENCE/m5_handoff_alignment_check_20260609.md: M5 handoff Auto-Verified",
    ],
    risks: ["Human-Verified remains false until Geonho or owner fills the checklist."],
  },
];

export function buildReadinessAudit({
  milestones = codefairReadinessMilestones,
  testBaseline = "44 PASS",
  latestPackage = "dist/concept-master-codefair-geonho-*.zip",
} = {}) {
  return {
    method: "P0-P6 readiness evidence",
    testBaseline,
    latestPackage,
    autoVerified: true,
    humanVerified: false,
    milestoneCount: milestones.length,
    nextAction: "Run GEONHO_HUMAN_TRIAL_CHECKLIST.md with Geonho and record PASS/FAIL evidence.",
    milestones: milestones.map((item, index) => ({
      ...item,
      order: index + 1,
      traceLabel: `${item.id}: ${item.title}`,
    })),
  };
}

export function validateReadinessAudit(audit = buildReadinessAudit()) {
  const issues = [];
  const requiredIds = ["P0", "P1", "P2", "P3", "P4", "P5", "P6"];

  if (audit.method !== "P0-P6 readiness evidence") {
    issues.push("readiness audit method must be P0-P6 readiness evidence");
  }
  if (audit.testBaseline !== "44 PASS") {
    issues.push(`expected current 44 PASS baseline, got ${audit.testBaseline}`);
  }
  if (audit.autoVerified !== true) {
    issues.push("Auto-Verified boundary must be true after deterministic test evidence");
  }
  if (audit.humanVerified !== false) {
    issues.push("Human-Verified must stay false until the student trial is recorded");
  }
  if (audit.milestoneCount !== requiredIds.length) {
    issues.push(`expected ${requiredIds.length} milestones, got ${audit.milestoneCount}`);
  }

  const ids = new Set((audit.milestones || []).map((item) => item.id));
  requiredIds.forEach((id) => {
    if (!ids.has(id)) issues.push(`missing milestone ${id}`);
  });

  (audit.milestones || []).forEach((item) => {
    if (!item.title) issues.push(`${item.id}: missing title`);
    if (!item.scoreAxis) issues.push(`${item.id}: missing score axis`);
    if (!item.status) issues.push(`${item.id}: missing status`);
    if (!Array.isArray(item.evidenceRefs) || item.evidenceRefs.length === 0) {
      issues.push(`${item.id}: missing evidence refs`);
    }
    if (!Array.isArray(item.risks) || item.risks.length === 0) {
      issues.push(`${item.id}: missing risks`);
    }
  });

  return {
    status: issues.length === 0 ? "PASS" : "FAIL",
    issueCount: issues.length,
    issues,
  };
}
