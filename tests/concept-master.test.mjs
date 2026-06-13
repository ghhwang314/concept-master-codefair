import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  calculateConceptStats,
  calculateImprovementRate,
  buildDashboardModel,
  calculateMasteryScores,
  buildRecommendationTrace,
  createLearningEvent,
  getTodayQuestProgress,
  getMistakeReasonDistribution,
  getTopRepeatedMistakeConcepts,
  markRetryCleared,
  recommendReviewConcepts,
  scheduleNextReview,
} from "../src/learning.js";
import {
  diagnoseMistake,
  fallbackDiagnosis,
} from "../src/diagnosis.js";
import { generateSimilarProblem } from "../src/generation.js";
import {
  buildDttTrace,
  validateDttTrace,
} from "../src/dttTrace.js";
import {
  buildJudgeDemoContract,
  validateJudgeDemoContract,
} from "../src/demoContract.js";
import {
  buildCreditPolicy,
  shouldUseLiveManus,
} from "../src/manusCreditPolicy.js";
import { ManusAiClient } from "../src/manusClient.js";
import {
  buildPresentationPlan,
  validatePresentationPlan,
} from "../src/presentationPlan.js";
import {
  buildReadinessAudit,
  validateReadinessAudit,
} from "../src/readinessAudit.js";
import { scheduleReviewWithFsrs } from "../src/reviewScheduler.js";
import {
  buildProblemConceptMap,
  createTemplateProblem,
  getDefaultMisconceptionForConcept,
  getDefaultJudgeProblems,
  getElementaryMathProblems,
  getProblems,
  recommendNextProblem,
  summarizeProblemBank,
  validateGeneratedProblem,
  validateProblemBank,
} from "../src/problems.js";
import {
  buildLearningEvidencePayload,
  buildMisconceptionMap,
  toAttemptLogRows,
  toConceptSummaryRows,
} from "../src/misconceptionMap.js";
import { isSafeStaticPath } from "../src/staticSecurity.js";

test("problem bank is complete enough for a judged demo and passes QA", () => {
  const problems = getProblems();
  assert.ok(problems.length >= 20, "demo needs at least twenty vetted problems");
  assert.deepEqual([...new Set(problems.map((problem) => problem.subject))].sort(), ["english", "math", "science"]);
  assert.ok(problems.every((problem) => problem.reviewStatus === "vetted"));

  const conceptCounts = problems.reduce((counts, problem) => {
    counts[problem.concept] = (counts[problem.concept] || 0) + 1;
    return counts;
  }, {});
  const repeatedConceptCount = Object.values(conceptCounts).filter((count) => count >= 2).length;
  assert.ok(repeatedConceptCount >= 8, "same-concept retry needs repeated concept groups");

  const result = validateProblemBank(problems);
  assert.deepEqual(result.issues, []);
});

test("default judge flow is scoped to elementary grade-6 math", () => {
  const problems = getDefaultJudgeProblems();

  assert.equal(problems.length, 6);
  assert.equal(getElementaryMathProblems().length, 6);
  assert.deepEqual([...new Set(problems.map((problem) => problem.subject))], ["math"]);
  assert.deepEqual([...new Set(problems.map((problem) => problem.concept))], [
    "fraction_common_denominator",
    "ratio_part_total",
  ]);
  assert.equal(problems.some((problem) => problem.concept === "linear_equation_transfer"), false);
  assert.ok(problems.every((problem) => problem.reviewStatus === "vetted"));
});

test("default judge problem summary exposes elementary math QA evidence", () => {
  const summary = summarizeProblemBank(getDefaultJudgeProblems());

  assert.equal(summary.status, "PASS");
  assert.equal(summary.problemCount, 6);
  assert.equal(summary.vettedCount, 6);
  assert.equal(summary.subjectCount, 1);
  assert.equal(summary.conceptCount, 2);
  assert.equal(summary.repeatedConceptGroups, 2);
  assert.deepEqual(summary.subjects, [
    { subject: "math", subjectKo: "수학", count: 6 },
  ]);
  assert.match(summary.summaryText, /6/);
  assert.match(summary.summaryText, /2/);
});

test("GitHub research application exposes an OATutor-style skill map for judge problems", () => {
  const skillMap = buildProblemConceptMap(getDefaultJudgeProblems());

  assert.equal(skillMap.status, "PASS");
  assert.equal(skillMap.researchPattern, "problem_skill_retry_map");
  assert.equal(skillMap.rowCount, 6);
  assert.equal(skillMap.conceptCount, 2);
  assert.deepEqual(skillMap.issues, []);
  assert.ok(skillMap.rows.every((row) => row.hasSameConceptRetry));
  assert.ok(skillMap.rows.every((row) => row.sameConceptRetryProblemIds.length >= 1));
  assert.ok(skillMap.rows.every((row) => row.reviewStatus === "vetted"));
  assert.ok(skillMap.rows.every((row) => row.sourceType === "vetted_source"));
  assert.deepEqual([...new Set(skillMap.rows.map((row) => row.misconceptionId))].sort(), [
    "fraction_denominator_direct_add",
    "ratio_total_parts_confusion",
  ]);
  assert.deepEqual(
    skillMap.conceptGroups.map((group) => ({
      conceptId: group.conceptId,
      problemCount: group.problemCount,
      vettedProblemCount: group.vettedProblemCount,
      generatedProblemCount: group.generatedProblemCount,
    })),
    [
      {
        conceptId: "fraction_common_denominator",
        problemCount: 4,
        vettedProblemCount: 4,
        generatedProblemCount: 0,
      },
      {
        conceptId: "ratio_part_total",
        problemCount: 2,
        vettedProblemCount: 2,
        generatedProblemCount: 0,
      },
    ]
  );
  assert.equal(getDefaultMisconceptionForConcept("new_math_concept"), "new_math_concept_concept_misunderstanding");
});

test("presentation plan anchors a 2-minute script to elementary math representative problems", () => {
  const problems = getDefaultJudgeProblems();
  const plan = buildPresentationPlan(problems);
  const validation = validatePresentationPlan(plan, problems);

  assert.equal(validation.status, "PASS");
  assert.deepEqual(validation.issues, []);
  assert.equal(plan.representativeProblems.length, 6);
  assert.equal(plan.cueCards.reduce((total, card) => total + card.durationSeconds, 0), 120);
  assert.deepEqual([...new Set(plan.representativeProblems.map((problem) => problem.subject))], ["math"]);
  assert.equal(plan.representativeProblems[0].id, "math_frac_001");

  const scriptText = plan.cueCards.map((card) => `${card.title} ${card.speakerLine} ${card.proof}`).join(" ");
  for (const requiredTerm of ["오답 기록", "AI", "비슷한 문제", "문제 준비", "다시 풀기", "개선률"]) {
    assert.match(scriptText, new RegExp(requiredTerm));
  }
});

test("DTT trace links the full CodeFair loop to tests, code, and evidence", () => {
  const trace = buildDttTrace();
  const validation = validateDttTrace(trace);

  assert.equal(validation.status, "PASS");
  assert.deepEqual(validation.issues, []);
  assert.equal(trace.method, "Definition -> Test -> Trace");
  assert.equal(trace.requirementCount, 6);
  assert.deepEqual(trace.requirements.map((item) => item.id), [
    "attempt-data",
    "ai-diagnosis",
    "same-concept-retry",
    "qa-gate",
    "mastery-review",
    "judge-demo",
  ]);

  for (const requirement of trace.requirements) {
    assert.ok(requirement.definition.length > 40);
    assert.ok(requirement.testRefs.some((ref) => ref.startsWith("tests/concept-master.test.mjs::")));
    assert.ok(requirement.codeRefs.some((ref) => ref.startsWith("src/")));
    assert.ok(requirement.evidenceRefs.some((ref) => ref.endsWith(".md::core-data") || ref.includes(".md::")));
    assert.ok(requirement.scoreAxis);
  }

  assert.ok(trace.scoreAxes.includes("data"));
  assert.ok(trace.scoreAxes.includes("ai"));
  assert.ok(trace.scoreAxes.includes("measurable-improvement"));
  assert.ok(trace.scoreAxes.includes("presentation"));
});

test("readiness audit locks P0-P6 milestones to current evidence without overclaiming human verification", () => {
  const audit = buildReadinessAudit();
  const validation = validateReadinessAudit(audit);

  assert.equal(validation.status, "PASS");
  assert.deepEqual(validation.issues, []);
  assert.equal(audit.method, "P0-P6 readiness evidence");
  assert.equal(audit.testBaseline, "44 PASS");
  assert.equal(audit.autoVerified, true);
  assert.equal(audit.humanVerified, false);
  assert.equal(audit.milestoneCount, 7);
  assert.deepEqual(audit.milestones.map((item) => item.id), ["P0", "P1", "P2", "P3", "P4", "P5", "P6"]);
  assert.ok(audit.milestones.every((item) => item.scoreAxis));
  assert.ok(audit.milestones.every((item) => item.evidenceRefs.length > 0));
  assert.ok(audit.milestones.every((item) => item.risks.length > 0));
  assert.ok(audit.milestones.find((item) => item.id === "P0").evidenceRefs.some((ref) => ref.includes("npm test: 44 PASS")));
  assert.ok(audit.milestones.find((item) => item.id === "P0").evidenceRefs.some((ref) => ref.includes("m3_retry_success_browser_check_20260608.json")));
  assert.ok(audit.milestones.find((item) => item.id === "P3").evidenceRefs.some((ref) => ref.includes("LIVE_MANUS_VERIFICATION.md")));
  assert.ok(audit.milestones.find((item) => item.id === "P6").evidenceRefs.some((ref) => ref.includes("concept-master-codefair-geonho-")));
  assert.ok(audit.nextAction.includes("GEONHO_HUMAN_TRIAL_CHECKLIST.md"));
});

test("learning events preserve required CodeFair evidence fields", () => {
  const problem = getProblems()[0];
  const event = createLearningEvent({
    problem,
    selectedAnswer: 0,
    mistakeReason: "concept_misunderstanding",
    aiDiagnosis: {
      reason: "concept_misunderstanding",
      conceptGap: "분모가 다른 분수의 통분",
      evidence: "분모끼리 더하는 오답을 선택함",
      recommendation: "통분 후 분자를 더하는 문제를 재학습",
      nextAction: "same_concept_retry",
      confidence: 0.82,
    },
    now: new Date("2026-05-31T09:00:00+09:00"),
  });

  assert.equal(event.questionId, problem.id);
  assert.equal(event.subject, problem.subject);
  assert.equal(event.conceptId, problem.concept);
  assert.equal(event.concept, problem.concept);
  assert.equal(event.misconceptionId, "fraction_denominator_direct_add");
  assert.equal(event.dataSource, "app_runtime");
  assert.equal(event.aiSource, "structured_diagnosis");
  assert.equal(event.retryCleared, false);
  assert.equal(event.selectedAnswer, 0);
  assert.equal(event.correctAnswer, problem.answer);
  assert.equal(event.isCorrect, false);
  assert.equal(event.mistakeReason, "concept_misunderstanding");
  assert.equal(event.aiDiagnosis.reason, "concept_misunderstanding");
  assert.equal(event.retryResult, "needs_retry");
  assert.equal(event.nextReviewAt, "2026-05-31");
  assert.equal(event.reviewSchedule.schedulerSource, "immediate_retry");
});

test("today quest progress starts at zero when only past records exist", () => {
  const problems = getDefaultJudgeProblems();
  const events = [
    createLearningEvent({ problem: problems[0], selectedAnswer: 0, mistakeReason: "concept_misunderstanding", dataSource: "demo_seed", now: new Date("2026-05-29") }),
    createLearningEvent({ problem: problems[1], selectedAnswer: 1, mistakeReason: "calculation_error", dataSource: "demo_seed", now: new Date("2026-05-30") }),
    createLearningEvent({ problem: problems[5], selectedAnswer: problems[5].answer, dataSource: "demo_seed", retryResult: "retried_then_cleared", now: new Date("2026-05-31") }),
  ];

  const progress = getTodayQuestProgress(events, { today: "2026-06-09" });

  assert.equal(progress.attemptCount, 0);
  assert.equal(progress.displayAttemptCount, 0);
  assert.equal(progress.solveComplete, false);
  assert.equal(progress.diagnoseComplete, false);
  assert.equal(progress.clearComplete, false);
  assert.equal(progress.percent, 0);
});

test("today quest progress completes only from today's solve, diagnosis, and retry evidence", () => {
  const problems = getDefaultJudgeProblems();
  const events = [
    createLearningEvent({ problem: problems[0], selectedAnswer: 0, mistakeReason: "concept_misunderstanding", dataSource: "demo_seed", now: new Date("2026-05-29") }),
    createLearningEvent({
      problem: problems[0],
      selectedAnswer: 0,
      mistakeReason: "concept_misunderstanding",
      aiDiagnosis: { reason: "concept_misunderstanding", source: "rule_based_fallback" },
      now: new Date("2026-06-09"),
    }),
    createLearningEvent({ problem: problems[1], selectedAnswer: problems[1].answer, now: new Date("2026-06-09") }),
    createLearningEvent({ problem: problems[2], selectedAnswer: problems[2].answer, retryResult: "retried_then_cleared", now: new Date("2026-06-09") }),
  ];

  const progress = getTodayQuestProgress(events, { today: "2026-06-09" });

  assert.equal(progress.attemptCount, 3);
  assert.equal(progress.displayAttemptCount, 3);
  assert.equal(progress.solveComplete, true);
  assert.equal(progress.diagnoseComplete, true);
  assert.equal(progress.clearComplete, true);
  assert.equal(progress.percent, 100);
});

test("wrong-answer DNA map exposes misconception, data source, retry, and review evidence", () => {
  const problems = getDefaultJudgeProblems();
  const [fractionsA, fractionsB, , , ratioA, ratioB] = problems;
  const events = [
    createLearningEvent({
      problem: fractionsA,
      selectedAnswer: 0,
      mistakeReason: "concept_misunderstanding",
      dataSource: "demo_seed",
      now: new Date("2026-06-01"),
    }),
    createLearningEvent({
      problem: fractionsB,
      selectedAnswer: fractionsB.answer,
      dataSource: "judge_demo",
      retryResult: "retried_then_cleared",
      now: new Date("2026-06-01"),
    }),
    createLearningEvent({
      problem: ratioA,
      selectedAnswer: 0,
      mistakeReason: "problem_interpretation",
      dataSource: "human_trial",
      aiDiagnosis: { reason: "problem_interpretation", source: "rule_based_fallback" },
      now: new Date("2026-06-02"),
    }),
    createLearningEvent({
      problem: ratioB,
      selectedAnswer: ratioB.answer,
      dataSource: "human_trial",
      now: new Date("2026-06-03"),
    }),
  ];

  const map = buildMisconceptionMap(events, problems);
  assert.equal(map.status, "PASS");
  assert.equal(map.attemptCount, 4);
  assert.equal(map.wrongCount, 2);
  assert.equal(map.conceptCount, 2);
  assert.equal(map.concepts[0].conceptId, "fraction_common_denominator");
  assert.equal(map.concepts[0].dominantMisconceptionId, "fraction_denominator_direct_add");
  assert.equal(map.concepts[0].retryCleared, true);
  assert.ok(map.concepts[0].dataSources.includes("demo_seed"));
  assert.ok(map.concepts.find((concept) => concept.conceptId === "ratio_part_total").aiSources.includes("rule_based_fallback"));

  const attemptRows = toAttemptLogRows(events);
  assert.deepEqual(Object.keys(attemptRows[0]), [
    "eventId",
    "questionId",
    "conceptId",
    "misconceptionId",
    "dataSource",
    "isCorrect",
    "retryCleared",
    "nextReviewAt",
    "aiSource",
  ]);
  assert.equal(attemptRows[0].dataSource, "demo_seed");
  assert.equal(attemptRows[1].retryCleared, true);

  const summaryRows = toConceptSummaryRows(map);
  assert.equal(summaryRows.length, 2);
  assert.equal(summaryRows[0].dominantMisconceptionId, "fraction_denominator_direct_add");
});

test("M3 visible evidence cards expose diagnosis, retry, and before-after proof", async () => {
  const [html, appText, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
  ]);

  for (const id of [
    "misconception-map-panel",
    "ai-diagnosis-card",
    "same-concept-retry-card",
    "before-after-card",
    "diagnosis-card-title",
    "retry-card-title",
    "before-mistake-count",
    "after-mistake-count",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }

  assert.match(html, /오답 기록 지도/);
  assert.match(html, /AI 오답 코치 카드/);
  assert.match(html, /비슷한 문제 다시 풀기/);
  assert.match(html, /다시 풀기 확인/);
  assert.equal(html.includes("system-hidden"), false);
  assert.match(appText, /renderVisibleEvidenceCards/);
  assert.match(appText, /diagnosisCardTitle/);
  assert.match(appText, /sameConceptRetryCard/);
  assert.match(appText, /beforeAfterCard/);
  assert.match(css, /\.judge-flow-card/);
  assert.match(css, /\.before-after-metrics/);
});

test("M4 judge demo contract is fallback-safe under 30 seconds without Manus API", () => {
  const contract = buildJudgeDemoContract();
  const validation = validateJudgeDemoContract(contract);

  assert.equal(validation.status, "PASS");
  assert.deepEqual(validation.issues, []);
  assert.equal(contract.externalApiRequired, false);
  assert.equal(contract.dataSource, "judge_demo");
  assert.equal(contract.diagnosisFallback, "rule_based_fallback");
  assert.equal(contract.generationFallback, "template_fallback");
  assert.equal(contract.retryResult, "retried_then_cleared");
  assert.ok(contract.maxDurationMs < 30_000);
  assert.deepEqual(contract.stages, ["wrong", "diagnosis", "generation", "retry", "improvement"]);
});

test("Manus credit saver policy prevents automatic live calls unless one-shot live AI is requested", () => {
  assert.equal(shouldUseLiveManus({ env: {} }), false);
  assert.equal(shouldUseLiveManus({ requestedLiveAi: true, env: {} }), true);
  assert.equal(shouldUseLiveManus({ requestedLiveAi: true, env: { MANUS_LIVE_DISABLED: "true" } }), false);
  assert.equal(shouldUseLiveManus({ env: { MANUS_CREDIT_SAVER_MODE: "false" } }), true);

  assert.deepEqual(buildCreditPolicy({ requestedLiveAi: true, liveManusUsed: false, cacheHit: true, env: {} }), {
    creditSaverMode: true,
    liveDisabled: false,
    requestedLiveAi: true,
    liveManusUsed: false,
    cacheHit: true,
  });
});

test("M5 learning evidence separates demo_seed, judge_demo, and human_trial logs on the data screen", async () => {
  const problems = getDefaultJudgeProblems();
  const [fractionsA, fractionsB, , , ratioA] = problems;
  const events = [
    createLearningEvent({
      problem: fractionsA,
      selectedAnswer: 0,
      mistakeReason: "concept_misunderstanding",
      dataSource: "demo_seed",
      now: new Date("2026-06-01"),
    }),
    createLearningEvent({
      problem: fractionsB,
      selectedAnswer: fractionsB.answer,
      dataSource: "judge_demo",
      retryResult: "retried_then_cleared",
      now: new Date("2026-06-01"),
    }),
    createLearningEvent({
      problem: ratioA,
      selectedAnswer: 0,
      mistakeReason: "problem_interpretation",
      dataSource: "human_trial",
      aiDiagnosis: { reason: "problem_interpretation", source: "rule_based_fallback" },
      now: new Date("2026-06-02"),
    }),
  ];
  const payload = buildLearningEvidencePayload(events, problems);

  assert.equal(payload.schema, "concept_master_m5_learning_evidence.v1");
  assert.equal(payload.status, "PASS");
  assert.deepEqual(payload.dataSources.map((source) => source.dataSource), ["demo_seed", "judge_demo", "human_trial"]);
  assert.deepEqual(payload.dataSources.map((source) => source.count), [1, 1, 1]);
  assert.equal(payload.attempt_log.length, 3);
  assert.equal(payload.concept_summary.length, 2);
  assert.ok(payload.concept_summary.some((row) => row.dataSources.includes("human_trial")));

  const [html, appText, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
  ]);

  for (const id of [
    "learning-log-evidence-panel",
    "concept-summary-evidence-panel",
    "data-source-summary",
    "attempt-log-preview",
    "concept-summary-preview",
    "learning-log-json",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }

  assert.match(html, /attempt_log/);
  assert.match(html, /concept_summary/);
  assert.match(appText, /buildLearningEvidencePayload/);
  assert.match(appText, /renderDataEvidence/);
  assert.match(appText, /attempt_log/);
  assert.match(appText, /concept_summary/);
  assert.match(css, /\.data-evidence-grid/);
  assert.match(css, /\.structured-log-list/);
  assert.match(css, /\.json-evidence/);
});

test("dashboard metrics expose concept error rate, reason distribution, repeated mistakes, and improvement", () => {
  const problems = getProblems();
  const [fractionsA, fractionsB, motion] = problems;
  const events = [
    createLearningEvent({ problem: fractionsA, selectedAnswer: 0, mistakeReason: "concept_misunderstanding", now: new Date("2026-05-31") }),
    createLearningEvent({ problem: fractionsB, selectedAnswer: 1, mistakeReason: "calculation_error", now: new Date("2026-05-31") }),
    createLearningEvent({ problem: fractionsB, selectedAnswer: fractionsB.answer, mistakeReason: "", now: new Date("2026-05-31") }),
    createLearningEvent({ problem: motion, selectedAnswer: motion.answer, mistakeReason: "", now: new Date("2026-05-31") }),
  ];

  const stats = calculateConceptStats(events);
  assert.equal(stats[fractionsA.concept].attempts, 3);
  assert.equal(stats[fractionsA.concept].mistakes, 2);
  assert.equal(stats[fractionsA.concept].mistakeRate, 67);

  assert.deepEqual(getMistakeReasonDistribution(events), {
    concept_misunderstanding: 1,
    calculation_error: 1,
  });

  assert.equal(getTopRepeatedMistakeConcepts(events, 1)[0].concept, fractionsA.concept);
  assert.equal(calculateImprovementRate(3, 1), 67);
});

test("dashboard improvement treats retried wrong answers as resolved evidence", () => {
  const problems = getProblems();
  const [fractionsA, fractionsB] = problems;
  const events = [
    createLearningEvent({
      problem: fractionsA,
      selectedAnswer: 0,
      mistakeReason: "concept_misunderstanding",
      retryResult: "retried_then_cleared",
      now: new Date("2026-06-01"),
    }),
    createLearningEvent({
      problem: fractionsB,
      selectedAnswer: fractionsB.answer,
      priorSuccessStreak: 0,
      now: new Date("2026-06-01"),
    }),
  ];

  const model = buildDashboardModel(events, problems, { today: "2026-06-01" });
  assert.equal(model.improvementRate, 100);
});

test("manual same-concept retry clears the previous wrong answer before dashboard refresh", () => {
  const [wrongProblem, retryProblem] = getDefaultJudgeProblems();
  const wrongEvent = createLearningEvent({
    problem: wrongProblem,
    selectedAnswer: 0,
    mistakeReason: "concept_misunderstanding",
    dataSource: "human_trial",
    now: new Date("2026-06-08"),
  });

  const retryUpdate = markRetryCleared([wrongEvent], wrongEvent.id);
  assert.equal(retryUpdate.clearedEvent.retryResult, "retried_then_cleared");
  assert.equal(retryUpdate.clearedEvent.retryCleared, true);

  const successEvent = createLearningEvent({
    problem: retryProblem,
    selectedAnswer: retryProblem.answer,
    dataSource: "human_trial",
    retryResult: "retried_then_cleared",
    now: new Date("2026-06-08"),
  });

  const events = [...retryUpdate.events, successEvent];
  const model = buildDashboardModel(events, getDefaultJudgeProblems(), { today: "2026-06-08" });
  assert.equal(model.improvementRate, 100);
  assert.equal(model.topConcepts[0].conceptKo, "분수의 통분과 덧셈");
});

test("mastery scores expose concept understanding from retry evidence", () => {
  const problems = getProblems();
  const [fractionsA, fractionsB, motion] = problems;
  const events = [
    createLearningEvent({ problem: fractionsA, selectedAnswer: 0, mistakeReason: "concept_misunderstanding", now: new Date("2026-05-31") }),
    createLearningEvent({ problem: fractionsB, selectedAnswer: fractionsB.answer, now: new Date("2026-05-31") }),
    createLearningEvent({ problem: motion, selectedAnswer: motion.answer, now: new Date("2026-05-31") }),
    createLearningEvent({ problem: motion, selectedAnswer: motion.answer, priorSuccessStreak: 1, now: new Date("2026-06-01") }),
  ];

  const scores = calculateMasteryScores(events);
  assert.equal(scores[fractionsA.concept].masteryScore, 50);
  assert.equal(scores[fractionsA.concept].masteryLevel, "developing");
  assert.equal(scores[fractionsA.concept].evidence, "1/2 정답");
  assert.equal(scores[motion.concept].masteryScore, 83);
  assert.equal(scores[motion.concept].masteryLevel, "strong");

  const model = buildDashboardModel(events, problems, { today: "2026-06-01" });
  assert.equal(model.masteryScores[fractionsA.concept].masteryScore, 50);
  assert.equal(model.lowMasteryConcepts[0].concept, fractionsA.concept);
});

test("review schedule uses vendored ts-fsrs with a CodeFair MVP cap", () => {
  const base = new Date("2026-05-31T09:00:00+09:00");
  assert.equal(scheduleNextReview({ isCorrect: false, priorSuccessStreak: 0, now: base }), "2026-05-31");
  assert.equal(scheduleNextReview({ isCorrect: true, priorSuccessStreak: 0, now: base }), "2026-06-03");
  assert.equal(scheduleNextReview({ isCorrect: true, priorSuccessStreak: 1, now: base }), "2026-06-07");
  assert.equal(scheduleNextReview({ isCorrect: true, priorSuccessStreak: 2, now: base }), "2026-06-07");

  const fsrsSchedule = scheduleReviewWithFsrs({ isCorrect: true, priorSuccessStreak: 1, now: base });
  assert.equal(fsrsSchedule.schedulerSource, "ts-fsrs");
  assert.equal(fsrsSchedule.rating, "Good");
  assert.equal(fsrsSchedule.rawNextReviewAt > fsrsSchedule.nextReviewAt, true);
  assert.equal(fsrsSchedule.intervalDays, 7);
});

test("upstream ts-fsrs code is vendored and wired into review scheduling", async () => {
  const [runtime, license, upstreamPackage, readme] = await Promise.all([
    readFile(new URL("../src/vendor/ts-fsrs/index.mjs", import.meta.url), "utf8"),
    readFile(new URL("../src/vendor/ts-fsrs/LICENSE", import.meta.url), "utf8"),
    readFile(new URL("../src/vendor/ts-fsrs/package.upstream.json", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
  ]);

  assert.match(runtime, /class FSRS/);
  assert.match(runtime, /function createEmptyCard/);
  assert.match(license, /MIT License/);
  assert.match(upstreamPackage, /"name": "ts-fsrs"/);
  assert.match(upstreamPackage, /open-spaced-repetition\/ts-fsrs/);
  assert.match(readme, /src\/vendor\/ts-fsrs\/index\.mjs/);
  assert.match(readme, /enable_short_term: false/);
  assert.match(readme, /recommendationTrace/);
});

test("dashboard model exposes today's review concepts from due learning events", () => {
  const problems = getProblems();
  const [fractionsA, fractionsB, motion] = problems;
  const events = [
    createLearningEvent({ problem: fractionsA, selectedAnswer: 0, mistakeReason: "concept_misunderstanding", now: new Date("2026-05-31") }),
    createLearningEvent({ problem: fractionsB, selectedAnswer: fractionsB.answer, now: new Date("2026-05-31") }),
    createLearningEvent({ problem: motion, selectedAnswer: motion.answer, now: new Date("2026-05-31") }),
  ];

  const model = buildDashboardModel(events, problems, { today: "2026-05-31" });

  assert.ok(Array.isArray(model.dueReviewConcepts));
  assert.equal(model.dueReviewConcepts[0].concept, fractionsA.concept);
  assert.equal(model.dueReviewConcepts[0].dueCount, 1);
  assert.equal(model.dueReviewConcepts[0].source, "learning_events");
});

test("review recommendations prioritize low mastery and recent wrong-answer concepts", () => {
  const problems = getProblems();
  const [fractionsA, fractionsB, motion, equation] = problems;
  const events = [
    createLearningEvent({ problem: motion, selectedAnswer: motion.answer, now: new Date("2026-05-28") }),
    createLearningEvent({ problem: motion, selectedAnswer: motion.answer, priorSuccessStreak: 1, now: new Date("2026-05-29") }),
    createLearningEvent({ problem: equation, selectedAnswer: equation.answer, now: new Date("2026-05-29") }),
    createLearningEvent({ problem: fractionsA, selectedAnswer: 0, mistakeReason: "concept_misunderstanding", now: new Date("2026-06-01") }),
    createLearningEvent({ problem: fractionsB, selectedAnswer: 1, mistakeReason: "calculation_error", now: new Date("2026-06-01") }),
  ];

  const recommendations = recommendReviewConcepts(events, problems, {
    today: "2026-06-01",
    limit: 3,
  });

  assert.equal(recommendations.length, 3);
  assert.equal(recommendations[0].concept, fractionsA.concept);
  assert.equal(recommendations[0].recommendationReason, "low_mastery_recent_mistake");
  assert.equal(recommendations[0].masteryScore, 17);
  assert.ok(recommendations[0].priorityScore > recommendations[1].priorityScore);

  const model = buildDashboardModel(events, problems, { today: "2026-06-01" });
  assert.equal(model.reviewRecommendations[0].concept, fractionsA.concept);
});

test("recommendation trace explains why the top concept was selected", () => {
  const problems = getProblems();
  const [fractionsA, fractionsB, motion, equation] = problems;
  const events = [
    createLearningEvent({ problem: motion, selectedAnswer: motion.answer, now: new Date("2026-05-28") }),
    createLearningEvent({ problem: equation, selectedAnswer: equation.answer, now: new Date("2026-05-29") }),
    createLearningEvent({ problem: fractionsA, selectedAnswer: 0, mistakeReason: "concept_misunderstanding", now: new Date("2026-06-01") }),
    createLearningEvent({ problem: fractionsB, selectedAnswer: 1, mistakeReason: "calculation_error", now: new Date("2026-06-01") }),
  ];

  const trace = buildRecommendationTrace(events, problems, {
    today: "2026-06-01",
    limit: 2,
  });

  assert.equal(trace[0].concept, fractionsA.concept);
  assert.equal(trace[0].priorityScore, 223);
  assert.deepEqual(trace[0].scoreFactors, {
    masteryGap: 83,
    recentWrongBoost: 80,
    dueReviewBoost: 40,
    mistakeBoost: 20,
  });
  assert.match(trace[0].traceSummary, /이해도 17점/);
  assert.match(trace[0].traceSummary, /최근 3일 오답 2개/);
  assert.match(trace[0].traceSummary, /복습 도래 2개/);
});

test("wrong answers recommend another same-concept problem before generating unverified templates", () => {
  const problems = getProblems();
  const [fractionsA, fractionsB] = problems;
  const events = [
    createLearningEvent({ problem: fractionsA, selectedAnswer: 0, mistakeReason: "concept_misunderstanding", now: new Date("2026-05-31") }),
  ];

  const recommendation = recommendNextProblem({
    events,
    problems,
    currentQuestionId: fractionsA.id,
  });

  assert.equal(recommendation.problem.id, fractionsB.id);
  assert.equal(recommendation.reason, "same_concept_retry");
  assert.equal(recommendation.problem.reviewStatus, "vetted");

  const generated = recommendNextProblem({
    events,
    problems: [fractionsA],
    currentQuestionId: fractionsA.id,
  });

  assert.equal(generated.problem.reviewStatus, "needs_review");
  assert.equal(generated.problem.generatedFrom, fractionsA.id);
  assert.match(generated.problem.reviewLabel, /확인 필요/);
});

test("template-generated similar problems are clearly excluded from vetted QA status", () => {
  const sourceProblem = getProblems()[0];
  const generated = createTemplateProblem({ sourceProblem, sequence: 2 });

  assert.equal(generated.reviewStatus, "needs_review");
  assert.equal(generated.generatedFrom, sourceProblem.id);
  assert.equal(validateProblemBank([sourceProblem, generated]).status, "PASS");
});

test("AI similar problem generation normalizes Manus output and falls back safely", async () => {
  const sourceProblem = getProblems()[0];
  const manusProblem = {
    conceptId: sourceProblem.concept,
    difficulty: "bronze",
    question: "1/6 + 1/3의 값은 무엇인가요?",
    options: ["2/9", "1/2", "2/6", "3/18"],
    answer: 1,
    explanation: "1/3을 2/6으로 통분하면 1/6 + 2/6 = 3/6 = 1/2입니다.",
    hint: "분모를 6으로 맞춰 보세요.",
    sourceReason: "분모가 다른 분수의 통분을 다시 연습하기 위한 문제",
  };
  const okClient = { generateSimilarProblem: async () => manusProblem };

  const generated = await generateSimilarProblem({
    sourceProblem,
    diagnosis: { reason: "concept_misunderstanding" },
    client: okClient,
  });

  assert.equal(generated.generatedBy, "manus_api");
  assert.equal(generated.reviewStatus, "needs_review");
  assert.equal(generated.conceptId, sourceProblem.concept);
  assert.equal(generated.difficulty, "bronze");
  assert.equal(generated.sourceReason, manusProblem.sourceReason);
  assert.equal(generated.answer, 1);

  const brokenClient = { generateSimilarProblem: async () => { throw new Error("network"); } };
  const fallback = await generateSimilarProblem({ sourceProblem, client: brokenClient, sequence: 4 });
  assert.equal(fallback.generatedBy, "template_fallback");
  assert.equal(fallback.reviewStatus, "needs_review");
  assert.equal(fallback.conceptId, sourceProblem.concept);
  assert.equal(fallback.difficulty, sourceProblem.level);
});

test("generated problem quality gate flags missing review evidence without marking it vetted", async () => {
  const sourceProblem = getProblems()[0];
  const incompleteManusProblem = {
    conceptId: sourceProblem.concept,
    difficulty: "bronze",
    question: "1/8 + 1/4의 값은 무엇인가요?",
    options: ["2/12", "3/8", "1/2", "2/8"],
    answer: 1,
    explanation: "1/4을 2/8로 통분하면 1/8 + 2/8 = 3/8입니다.",
    hint: "분모를 8로 맞춰 보세요.",
  };
  const client = { generateSimilarProblem: async () => incompleteManusProblem };

  const generated = await generateSimilarProblem({
    sourceProblem,
    diagnosis: { reason: "concept_misunderstanding" },
    client,
  });

  assert.equal(generated.generatedBy, "manus_api");
  assert.equal(generated.reviewStatus, "needs_review");
  assert.equal(generated.qualityGateStatus, "NEEDS_REVIEW");
  assert.ok(generated.qaIssues.some((issue) => issue.includes("missing sourceReason")));
  assert.equal(validateGeneratedProblem(generated).status, "NEEDS_REVIEW");
});

test("render-unsafe generated problems use fallback and keep the rejection reason visible", async () => {
  const sourceProblem = getProblems()[0];
  const unsafeManusProblem = {
    conceptId: sourceProblem.concept,
    difficulty: "bronze",
    question: "1/9 + 1/3의 값은 무엇인가요?",
    options: ["4/9"],
    answer: 3,
    explanation: "보기와 정답 index가 맞지 않는 깨진 문항입니다.",
    hint: "분모를 9로 맞춰 보세요.",
    sourceReason: "렌더링 안전성 테스트용 깨진 문항",
  };
  const client = { generateSimilarProblem: async () => unsafeManusProblem };

  const generated = await generateSimilarProblem({
    sourceProblem,
    diagnosis: { reason: "concept_misunderstanding" },
    client,
    sequence: 9,
  });

  assert.equal(generated.generatedBy, "template_fallback");
  assert.equal(generated.reviewStatus, "needs_review");
  assert.equal(generated.qualityGateStatus, "NEEDS_REVIEW");
  assert.ok(generated.qaIssues.some((issue) => issue.includes("not render-safe")));
  assert.equal(validateGeneratedProblem(generated).renderSafe, true);
});

test("AI diagnosis uses Manus adapter success and falls back safely on failure", async () => {
  const problem = getProblems()[0];
  const manuscript = {
    reason: "problem_interpretation",
    conceptGap: "문제 조건을 먼저 읽는 전략",
    evidence: "더 필요한 양을 묻는 조건을 놓침",
    recommendation: "조건 표시 후 식 세우기",
    nextAction: "same_concept_retry",
    confidence: 0.91,
  };
  const okClient = { diagnose: async () => manuscript };

  assert.deepEqual(await diagnoseMistake({ problem, selectedAnswer: 0, client: okClient }), manuscript);

  const brokenClient = { diagnose: async () => { throw new Error("network"); } };
  const fallback = await diagnoseMistake({ problem, selectedAnswer: 0, client: brokenClient });
  assert.equal(fallback.nextAction, "same_concept_retry");
  assert.ok(["concept_misunderstanding", "calculation_error", "problem_interpretation", "memory_gap"].includes(fallback.reason));
  assert.equal(fallback.source, "rule_based_fallback");
  assert.equal(fallback.fallbackReason, "manus_client_error");
  assert.match(fallback.fallbackMessage, /규칙 진단/);
  assert.equal(fallback.aiTrace.provider, "manus");
});

test("AI diagnosis falls back on empty or slow Manus responses", async () => {
  const problem = getProblems()[0];
  const emptyClient = { diagnose: async () => ({}) };
  const emptyFallback = await diagnoseMistake({ problem, selectedAnswer: 0, client: emptyClient });
  assert.equal(emptyFallback.source, "rule_based_fallback");
  assert.equal(emptyFallback.fallbackReason, "invalid_structured_diagnosis");

  const slowClient = { diagnose: async () => new Promise((resolve) => setTimeout(resolve, 50, {
    reason: "calculation_error",
    conceptGap: "late response",
    evidence: "late response",
    recommendation: "late response",
    nextAction: "same_concept_retry",
  })) };
  const slowFallback = await diagnoseMistake({ problem, selectedAnswer: 0, client: slowClient, timeoutMs: 5 });
  assert.equal(slowFallback.source, "rule_based_fallback");
  assert.equal(slowFallback.fallbackReason, "diagnosis_timeout");
  assert.match(slowFallback.fallbackMessage, /응답 시간/);
});

test("Manus client uses official v2 task API with server-only key header", async () => {
  const problem = getProblems()[0];
  const calls = [];
  const diagnosis = {
    reason: "concept_misunderstanding",
    conceptGap: "분모 통분",
    evidence: "학생이 2/7을 선택했습니다.",
    recommendation: "같은 개념 문제를 다시 풀어 보세요.",
    nextAction: "same_concept_retry",
    confidence: 0.88,
  };
  const client = new ManusAiClient({
    apiKey: "test-manus-key",
    baseUrl: "https://api.manus.ai",
    pollIntervalMs: 1,
    maxPolls: 1,
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      if (String(url).endsWith("/v2/task.create")) {
        return jsonResponse({ ok: true, task_id: "task_123" });
      }
      if (String(url).includes("/v2/task.listMessages")) {
        return jsonResponse({
          messages: [
            {
              type: "structured_output_result",
              structured_output_result: {
                success: true,
                value: diagnosis,
              },
            },
          ],
        });
      }
      throw new Error(`unexpected url ${url}`);
    },
  });

  const result = await client.diagnose({
    problem,
    selectedAnswer: 0,
    selectedOption: problem.options[0],
    correctAnswer: problem.answer,
    correctOption: problem.options[problem.answer],
  });

  assert.equal(result.source, "manus_api");
  assert.equal(result.taskId, "task_123");
  assert.equal(calls[0].url, "https://api.manus.ai/v2/task.create");
  assert.equal(calls[0].options.headers["x-manus-api-key"], "test-manus-key");
  assert.equal(calls[0].options.headers.authorization, undefined);
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.structured_output_schema.additionalProperties, false);
  assert.match(body.message.content[0].text, /ConceptMaster/);
  assert.match(calls[1].url, /\/v2\/task\.listMessages\?task_id=task_123/);
});

test("Manus client can request a structured same-concept problem", async () => {
  const problem = getProblems()[0];
  const calls = [];
  const generatedProblem = {
    conceptId: problem.concept,
    difficulty: "bronze",
    question: "3/8 + 1/4의 값은 무엇인가요?",
    options: ["4/12", "1/2", "5/8", "3/12"],
    answer: 2,
    explanation: "1/4을 2/8로 통분하면 3/8 + 2/8 = 5/8입니다.",
    hint: "1/4을 8분의 몇으로 바꿀 수 있는지 먼저 보세요.",
    sourceReason: "통분 개념을 다른 숫자로 다시 확인하기 위한 문제",
  };
  const client = new ManusAiClient({
    apiKey: "test-manus-key",
    baseUrl: "https://api.manus.ai",
    pollIntervalMs: 1,
    maxPolls: 1,
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      if (String(url).endsWith("/v2/task.create")) {
        return jsonResponse({ ok: true, task_id: "task_generate_123" });
      }
      if (String(url).includes("/v2/task.listMessages")) {
        return jsonResponse({
          messages: [
            {
              type: "structured_output_result",
              structured_output_result: {
                success: true,
                value: generatedProblem,
              },
            },
          ],
        });
      }
      throw new Error(`unexpected url ${url}`);
    },
  });

  const result = await client.generateSimilarProblem({
    sourceProblem: problem,
    diagnosis: { reason: "concept_misunderstanding", conceptGap: problem.conceptKo },
  });

  assert.equal(result.source, "manus_api");
  assert.equal(result.taskId, "task_generate_123");
  assert.equal(result.question, generatedProblem.question);
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.structured_output_schema.properties.conceptId.type, "string");
  assert.equal(body.structured_output_schema.required.includes("sourceReason"), true);
  assert.equal(body.structured_output_schema.properties.options.minItems, undefined);
  assert.equal(body.structured_output_schema.properties.options.maxItems, undefined);
  assert.equal(body.structured_output_schema.properties.answer.minimum, undefined);
  assert.equal(body.structured_output_schema.properties.answer.maximum, undefined);
  assert.match(body.message.content[0].text, /same concept/);
});

test("Manus client surfaces structured output failure for diagnosis tracing", async () => {
  const problem = getProblems()[0];
  const client = new ManusAiClient({
    apiKey: "test-manus-key",
    baseUrl: "https://api.manus.ai",
    pollIntervalMs: 1,
    maxPolls: 1,
    fetchImpl: async (url) => {
      if (String(url).endsWith("/v2/task.create")) {
        return jsonResponse({ ok: true, task_id: "task_failed_structured_output" });
      }
      if (String(url).includes("/v2/task.listMessages")) {
        return jsonResponse({
          messages: [
            {
              type: "structured_output_result",
              structured_output_result: {
                success: false,
                value: {},
                error: "Failed to extract structured output",
              },
            },
          ],
        });
      }
      throw new Error(`unexpected url ${url}`);
    },
  });

  await assert.rejects(
    client.diagnose({
      problem,
      selectedAnswer: 0,
      selectedOption: problem.options[0],
      correctAnswer: problem.answer,
      correctOption: problem.options[problem.answer],
    }),
    (error) => {
      assert.equal(error.code, "structured_output_failed");
      assert.match(error.message, /structured output/);
      return true;
    }
  );
});

test("Manus client reads polling timeout configuration from server environment", () => {
  const previous = {
    MANUS_REQUEST_TIMEOUT_MS: process.env.MANUS_REQUEST_TIMEOUT_MS,
    MANUS_POLL_INTERVAL_MS: process.env.MANUS_POLL_INTERVAL_MS,
    MANUS_MAX_POLLS: process.env.MANUS_MAX_POLLS,
  };

  process.env.MANUS_REQUEST_TIMEOUT_MS = "17000";
  process.env.MANUS_POLL_INTERVAL_MS = "2500";
  process.env.MANUS_MAX_POLLS = "40";

  try {
    const client = new ManusAiClient({ apiKey: "test-key", fetchImpl: async () => jsonResponse({}) });
    assert.equal(client.requestTimeoutMs, 17000);
    assert.equal(client.pollIntervalMs, 2500);
    assert.equal(client.maxPolls, 40);
  } finally {
    restoreEnv(previous);
  }
});

test("fallback diagnosis is deterministic enough for offline demo mode", () => {
  const problem = getProblems()[0];
  const diagnosis = fallbackDiagnosis({ problem, selectedAnswer: 0 });
  assert.equal(diagnosis.reason, "concept_misunderstanding");
  assert.match(diagnosis.recommendation, /같은 개념/);
});

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

function restoreEnv(snapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

test("Manus credentials are kept out of browser-delivered files", async () => {
  const browserFiles = [
    "index.html",
    "styles.css",
    "src/app.js",
    "src/demoContract.js",
    "src/diagnosis.js",
    "src/dttTrace.js",
    "src/learning.js",
    "src/misconceptionMap.js",
    "src/problems.js",
  ];

  for (const file of browserFiles) {
    const text = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    assert.equal(text.includes("MANUS_API_KEY"), false, `${file} must not reference MANUS_API_KEY`);
    assert.equal(text.includes("Bearer "), false, `${file} must not contain bearer auth wiring`);
  }
});

test("static server path guard blocks env and other dotfiles", () => {
  assert.equal(isSafeStaticPath("index.html"), true);
  assert.equal(isSafeStaticPath("src/app.js"), true);
  assert.equal(isSafeStaticPath(".env"), false);
  assert.equal(isSafeStaticPath(".env.example"), false);
  assert.equal(isSafeStaticPath("src/.secret"), false);
  assert.equal(isSafeStaticPath("../server.mjs"), false);
});

test("HTML evidence screen includes review concepts, mistake reason selection, and bounded AI wording", async () => {
  const [html, appText, readme, serverText] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/app.js", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
    readFile(new URL("../src/server.mjs", import.meta.url), "utf8"),
  ]);
  const publicCopy = `${html}\n${appText}\n${readme}`;

  assert.match(html, /id="today-review-concepts"/);
  assert.match(html, /id="mastery-list"/);
  assert.match(html, /id="improvement-panel"/);
  assert.match(html, /id="misconception-map-panel"/);
  assert.match(html, /id="misconception-map-list"/);
  assert.match(html, /id="recommendation-trace-panel"/);
  assert.match(html, /id="recommendation-trace"/);
  assert.match(html, /id="problem-bank-evidence-panel"/);
  assert.match(html, /id="problem-bank-summary"/);
  assert.match(html, /id="problem-bank-subjects"/);
  assert.match(html, /id="presentation-cue-list"/);
  assert.match(html, /id="representative-problems"/);
  assert.match(html, /id="dtt-trace-panel"/);
  assert.match(html, /id="dtt-trace-list"/);
  assert.match(html, /id="readiness-audit-panel"/);
  assert.match(html, /id="readiness-audit-list"/);
  assert.match(html, /id="generated-qa-notice"/);
  assert.match(html, /id="ai-status"/);
  assert.match(html, /id="live-ai-once-button"/);
  assert.match(html, /AI 1회 사용/);
  assert.match(html, /id="diagnosis-trace"/);
  assert.match(html, /도움 방식/);
  assert.match(html, /id="app-menu"/);
  assert.match(html, /data-screen-target="learn"/);
  assert.doesNotMatch(html, /data-screen-target="research"/);
  assert.doesNotMatch(html, />연구근거</);
  assert.match(html, /data-screen="learn"/);
  assert.match(html, /data-screen="research"/);
  assert.match(html, /class="lesson-map"/);
  assert.match(html, /id="demo-stage-list"/);
  assert.match(html, /id="demo-summary"/);
  assert.match(html, /data-stage="wrong"/);
  assert.match(html, /data-stage="diagnosis"/);
  assert.match(html, /data-stage="generation"/);
  assert.match(html, /data-stage="retry"/);
  assert.match(html, /data-stage="improvement"/);
  assert.match(html, /개념 이해도/);
  assert.match(html, /오답 원인 선택/);
  assert.match(html, /id="mistake-reason-select"/);
  assert.match(appText, /renderMasteryList/);
  assert.match(appText, /demoStages/);
  assert.match(appText, /setActiveScreen/);
  assert.match(appText, /setDemoStage/);
  assert.match(appText, /renderDemoSummary/);
  assert.match(appText, /renderGeneratedQaNotice/);
  assert.match(appText, /DEMO_API_TIMEOUT_MS/);
  assert.match(appText, /setAiStatus/);
  assert.match(appText, /틀린 이유 정리 중/);
  assert.match(appText, /AI 보조 완료/);
  assert.match(appText, /기본 설명 사용 중/);
  assert.match(appText, /qualityGateStatus/);
  assert.match(appText, /qaIssues/);
  assert.match(appText, /reviewRecommendations/);
  assert.match(appText, /recommendationTrace/);
  assert.match(appText, /renderRecommendationTrace/);
  assert.match(appText, /buildMisconceptionMap/);
  assert.match(appText, /renderMisconceptionMap/);
  assert.match(appText, /getDefaultJudgeProblems/);
  assert.match(appText, /summarizeProblemBank/);
  assert.match(appText, /renderProblemBankSummary/);
  assert.match(appText, /buildPresentationPlan/);
  assert.match(appText, /renderPresentationPlan/);
  assert.match(appText, /buildDttTrace/);
  assert.match(appText, /renderDttTrace/);
  assert.match(appText, /buildReadinessAudit/);
  assert.match(appText, /renderReadinessAudit/);
  assert.match(appText, /focusJudgeEvidence/);
  assert.match(appText, /setActiveScreen\("data"\)/);
  assert.match(appText, /recommendationReasonLabels/);
  assert.match(appText, /\/api\/generate-similar-problem/);
  assert.match(appText, /비슷한 문제 준비 중/);
  assert.match(serverText, /\/api\/generate-similar-problem/);
  assert.match(serverText, /shouldUseLiveManus/);
  assert.match(serverText, /diagnosisCache/);
  assert.match(serverText, /buildCreditPolicy/);
  assert.match(serverText, /\.mjs": "text\/javascript; charset=utf-8"/);
  assert.match(html, /https:\/\/github\.com\/CAHLR\/OATutor/);
  assert.match(html, /https:\/\/github\.com\/CAHLR\/pyBKT/);
  assert.match(html, /https:\/\/github\.com\/open-spaced-repetition\/ts-fsrs/);
  assert.match(html, /https:\/\/github\.com\/oppia\/oppia/);
  assert.match(html, /https:\/\/github\.com\/AOSSIE-Org\/EduAid/);
  assert.match(publicCopy, /이번 제출본은 초6 수학 오답 흐름을 먼저 보여 줍니다/);
  assert.equal(publicCopy.includes("AI가 모든 것을 해결한다"), false);
  assert.equal(html.includes("data-grade=\"middle_"), false);
  assert.equal(html.includes("data-grade=\"high_"), false);
  assert.equal(html.includes("data-subject=\"korean\""), false);
  assert.equal(html.includes("data-subject=\"science\""), false);
  assert.equal(html.includes("data-subject=\"english\""), false);
});

test("Geonho visual shell is absorbed without replacing the scoring system", async () => {
  const [html, css, appText, readme, ...assetBuffers] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
    readFile(new URL("../src/app.js", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
    readFile(new URL("../assets/coach_header.png", import.meta.url)),
    readFile(new URL("../assets/coach_diagnosis.png", import.meta.url)),
    readFile(new URL("../assets/coach_quiz.png", import.meta.url)),
    readFile(new URL("../assets/coach_qa.png", import.meta.url)),
    readFile(new URL("../assets/coach_mascot.png", import.meta.url)),
  ]);

  assert.ok(assetBuffers.every((buffer) => buffer.byteLength > 100_000));
  assert.match(html, /assets\/coach_header\.png/);
  assert.match(html, /assets\/coach_diagnosis\.png/);
  assert.match(html, /assets\/coach_quiz\.png/);
  assert.match(html, /assets\/coach_qa\.png/);
  assert.match(html, /id="demo-guide-banner"/);
  assert.match(html, /id="guide-progress-fill"/);
  assert.match(html, /id="grade-select-overlay"/);
  assert.match(html, /id="grade-badge"/);
  assert.match(html, /aria-label="오늘의 학습 요약"/);
  assert.match(html, /id="today-solved-count"/);
  assert.match(html, /id="today-progress-score"/);
  assert.match(html, /오늘 풀이/);
  assert.match(html, /진행률/);
  assert.match(html, /class="subject-filter-container"/);
  assert.match(html, /id="submit-answer-button"/);
  assert.match(html, /class="panel quest-panel"/);
  assert.match(html, /id="quest-progress-fill"/);
  assert.match(html, /class="header-title-container"/);
  assert.match(html, /class="quiz-body-wrapper"/);
  assert.match(css, /\.header-mascot/);
  assert.match(css, /\.speech-bubble/);
  assert.match(css, /\.quiz-mascot-img/);
  assert.match(css, /\.demo-guide-banner/);
  assert.match(css, /\.grade-overlay/);
  assert.match(css, /\.duo-score-pill b/);
  assert.match(css, /\.duo-score-pill em/);
  assert.match(css, /\.filter-tab/);
  assert.match(css, /\.submit-btn-green/);
  assert.match(css, /\.quest-progress-bar/);
  assert.match(css, /\.judge-evidence-sections/);
  assert.match(appText, /showDemoGuide/);
  assert.match(appText, /hideDemoGuide/);
  assert.match(appText, /initializeGradeSelector/);
  assert.match(appText, /setSubjectFilter/);
  assert.match(appText, /selectAnswer/);
  assert.match(appText, /renderQuestProgress/);
  assert.match(appText, /buildReadinessAudit/);
  assert.match(appText, /buildDttTrace/);
  assert.match(readme, /src\/readinessAudit\.js/);
});

test("visible Korean UI hides raw English status labels and internal ids", async () => {
  const [html, appText, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(html, /PASS:/);
  assert.doesNotMatch(html, /TOP3/);
  assert.doesNotMatch(html, /XP/);
  assert.doesNotMatch(html, /🔥 12/);
  assert.doesNotMatch(html, /💎 320/);
  assert.doesNotMatch(html, /1250점/);
  assert.doesNotMatch(html, /fallback 문항/);
  assert.match(html, /통과: 문제 준비 완료/);
  assert.match(html, /반복 오답 개념/);
  assert.match(html, /비슷한 문제/);
  assert.match(html, /data-log-kind="attempt_log"/);
  assert.match(html, /data-log-kind="concept_summary"/);

  assert.match(appText, /labelAiSource/);
  assert.match(appText, /labelDataSource/);
  assert.match(appText, /labelRetryReason/);
  assert.match(appText, /labelDiagnosisTrace/);
  assert.doesNotMatch(appText, /마노스 1\.6 Lite/);
  assert.match(appText, /consumeLiveAiOnce/);
  assert.match(appText, /useLiveAi: false/);
  assert.match(appText, /기본 설명으로 진행했어요/);
  assert.match(appText, /getMisconceptionLabel/);
  assert.match(appText, /기본 설명/);
  assert.match(appText, /기본 예시/);
  assert.match(css, /\[hidden\]\s*\{/);
  assert.match(css, /\.rank-list li\s*\{[\s\S]*display: block/);
  assert.match(css, /word-break: keep-all/);
});

test("CodeFair submission package includes summary, architecture, 2-minute script, judge Q&A, and M5 evidence", async () => {
  const submission = await readFile(new URL("../SUBMISSION_PACKAGE.md", import.meta.url), "utf8");

  assert.match(submission, /# ConceptMaster CodeFair Submission Package/);
  assert.match(submission, /## 작품요약서 문장/);
  assert.match(submission, /## 기술 구조도/);
  assert.match(submission, /## 30초 시연 흐름/);
  assert.match(submission, /## 2분 영상 대본/);
  assert.match(submission, /## 심사 Q&A/);
  assert.match(submission, /## 한계와 개선계획/);
  assert.match(submission, /초6 수학/);
  assert.match(submission, /오답 DNA/);
  assert.match(submission, /attempt_log/);
  assert.match(submission, /concept_summary/);
  assert.match(submission, /demo_seed/);
  assert.match(submission, /judge_demo/);
  assert.match(submission, /human_trial/);
  assert.match(submission, /Manus API/);
  assert.match(submission, /mastery score/);
  assert.match(submission, /DTT Score Trace/);
  assert.match(submission, /dttTrace/);
  assert.match(submission, /Definition -> Test -> Trace/);
  assert.match(submission, /대표문항/);
  assert.match(submission, /44 PASS/);
  assert.match(submission, /m3_retry_success_browser_check_20260608\.json/);
  assert.match(submission, /개선률 50%/);
  assert.match(submission, /AI가 문제를 대신 풀어 준 것/);
  assert.doesNotMatch(submission, /40 PASS/);
});

test("M4 submission docs are aligned to the latest M3 browser evidence", async () => {
  const [summaryFinal, explanationFinal, explanation, m3Evidence] = await Promise.all([
    readFile(new URL("../SUBMISSION_DOCS/서식1_작품요약서_AI오답코치_건호_최종_20260613.docx", import.meta.url)),
    readFile(new URL("../SUBMISSION_DOCS/서식2_작품설명서_AI오답코치_건호_최종_구조맞춤_20260613.docx", import.meta.url)),
    readFile(new URL("../SUBMISSION_DOCS/작품설명서_건호_대상형_초안_20260608.md", import.meta.url), "utf8"),
    readFile(new URL("../QA_EVIDENCE/m3_retry_success_browser_check_20260608.json", import.meta.url), "utf8"),
  ]);
  const docs = explanation;

  assert.ok(summaryFinal.byteLength > 10_000);
  assert.ok(explanationFinal.byteLength > 1_000_000);
  assert.match(docs, /44개 통과/);
  assert.match(docs, /이전 오답이 `회복`/);
  assert.match(docs, /개선률 50%/);
  assert.match(docs, /m3_retry_success_browser_check_20260608\.json/);
  assert.match(docs, /정답만 알려주는 퀴즈앱이 아니라|정답 제공 중심이 아니라/);
  assert.match(m3Evidence, /"status": "PASS"/);
  assert.match(m3Evidence, /"improvement": "50%"/);
  assert.doesNotMatch(docs, /40개 테스트가 통과/);
  assert.doesNotMatch(docs, /Human-Verified.*완료/);
});

test("Geonho human trial checklist turns Auto-Verified evidence into a student-use gate", async () => {
  const [checklist, readme, handoff] = await Promise.all([
    readFile(new URL("../GEONHO_HUMAN_TRIAL_CHECKLIST.md", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
    readFile(new URL("../HANDOFF_GEONHO.md", import.meta.url), "utf8"),
  ]);

  assert.match(checklist, /# Geonho Human Trial Checklist/);
  assert.match(checklist, /npm test/);
  assert.match(checklist, /npm start/);
  assert.match(checklist, /30-second demo/);
  assert.match(checklist, /AI status/);
  assert.match(checklist, /Manus/);
  assert.match(checklist, /fallback/);
  assert.match(checklist, /improvement rate/);
  assert.match(checklist, /why features were built/);
  assert.match(checklist, /what changed/);
  assert.match(checklist, /what AI helped with/);
  assert.match(checklist, /Auto-Verified/);
  assert.match(checklist, /Human-Verified/);
  assert.match(checklist, /\.env/);
  assert.match(checklist, /PASS\/FAIL/);
  assert.equal(checklist.includes("sk-"), false);

  assert.match(readme, /GEONHO_HUMAN_TRIAL_CHECKLIST\.md/);
  assert.match(handoff, /GEONHO_HUMAN_TRIAL_CHECKLIST\.md/);
});

test("M5 handoff pack lets another agent run, configure, and add problems without overclaiming delivery", async () => {
  const [handoff15, problemGuide, prompt, readme, handoff, readinessSource] = await Promise.all([
    readFile(new URL("../docs/HANDOFF_15_MIN.md", import.meta.url), "utf8"),
    readFile(new URL("../docs/PROBLEM_ADDITION_GUIDE.md", import.meta.url), "utf8"),
    readFile(new URL("../docs/AGENT_CONTINUATION_PROMPT.ko.md", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
    readFile(new URL("../HANDOFF_GEONHO.md", import.meta.url), "utf8"),
    readFile(new URL("../src/readinessAudit.js", import.meta.url), "utf8"),
  ]);
  const combined = `${handoff15}\n${problemGuide}\n${prompt}\n${readme}\n${handoff}\n${readinessSource}`;

  assert.match(handoff15, /15-Minute Local Handoff/);
  assert.match(handoff15, /npm test/);
  assert.match(handoff15, /python scripts\\execute\.py validate/);
  assert.match(handoff15, /Copy-Item \.env\.example \.env/);
  assert.match(handoff15, /npm start/);
  assert.match(handoff15, /http:\/\/localhost:4173/);
  assert.match(handoff15, /MANUS_CREDIT_SAVER_MODE=true/);
  assert.match(handoff15, /AI 1회 사용/);
  assert.match(handoff15, /rule_based_fallback/);
  assert.match(handoff15, /Auto-Verified/);
  assert.match(handoff15, /Human-Verified/);
  assert.match(handoff15, /not a deployed customer-ready product/);
  assert.match(handoff15, /M0_BASELINE_STATUS\.v1\.json/);
  assert.match(handoff15, /M2_API_ENVIRONMENT_STATUS\.v1\.json/);
  assert.match(handoff15, /m3_retry_success_browser_check_20260608\.json/);
  assert.match(handoff15, /m4_submission_alignment_check_20260609\.md/);
  assert.match(handoff15, /m5_handoff_alignment_check_20260609\.md/);

  assert.match(problemGuide, /src\/problems\.js/);
  assert.match(problemGuide, /answer: 1/);
  assert.match(problemGuide, /zero-based option index/);
  assert.match(problemGuide, /validateProblemBank/);
  assert.match(problemGuide, /elementaryMathConcepts/);
  assert.match(problemGuide, /at least two vetted problems/);
  assert.match(problemGuide, /reviewStatus: "needs_review"/);
  assert.match(problemGuide, /tests\/concept-master\.test\.mjs/);

  assert.match(prompt, /DTT 방식/);
  assert.match(prompt, /44 PASS \/ 0 FAIL/);
  assert.match(prompt, /같은 실패 루트를 5번/);
  assert.match(prompt, /브라우저 같은 화면 타임아웃은 2번/);
  assert.ok([...prompt].length <= 4000, "continuation prompt must stay within 4000 Korean characters");

  assert.match(readme, /docs\/HANDOFF_15_MIN\.md/);
  assert.match(readme, /docs\/PROBLEM_ADDITION_GUIDE\.md/);
  assert.match(readme, /docs\/AGENT_CONTINUATION_PROMPT\.ko\.md/);
  assert.match(handoff, /M0-M5 Evidence Snapshot/);
  assert.match(handoff, /44 PASS \/ 0 FAIL/);
  assert.match(readinessSource, /docs\/HANDOFF_15_MIN\.md/);
  assert.match(readinessSource, /docs\/PROBLEM_ADDITION_GUIDE\.md/);

  assert.equal(combined.includes("sk-"), false);
  assert.equal(combined.includes("MANUS_API_KEY="), false);
  assert.doesNotMatch(combined, /Human-Verified.*완료/);
  assert.doesNotMatch(combined, /대상 확정/);
});

test("M6 human trial validator blocks templates and accepts only recorded trial evidence", async () => {
  const python = process.env.PYTHON || "python";

  // Check if python is available and executable in the local path
  const pythonCheck = spawnSync(python, ["--version"], { encoding: "utf8" });
  if (pythonCheck.status !== 0 || pythonCheck.error) {
    console.log("Skipping Python-based M6 validator test: python is not available in the environment.");
    return;
  }

  const validatorPath = fileURLToPath(new URL("../scripts/validate_human_trial_record.py", import.meta.url));
  const preparePath = fileURLToPath(new URL("../scripts/prepare_human_trial_record.py", import.meta.url));
  const startPath = fileURLToPath(new URL("../scripts/start_human_trial.py", import.meta.url));
  const statusPath = fileURLToPath(new URL("../scripts/status_human_trial.py", import.meta.url));
  const templatePath = fileURLToPath(new URL("../trial_records/human_trial_record.template.v1.json", import.meta.url));
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

  assert.equal(packageJson.scripts["trial:prepare"], "python scripts/prepare_human_trial_record.py");
  assert.equal(packageJson.scripts["trial:start"], "python scripts/start_human_trial.py");
  assert.equal(packageJson.scripts["trial:status"], "python scripts/status_human_trial.py");
  assert.match(packageJson.scripts["trial:validate-template"], /validate_human_trial_record\.py/);
  assert.match(packageJson.scripts["trial:validate"], /--mode trial/);

  const runValidator = (args) => {
    const result = spawnSync(python, [validatorPath, ...args], {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      encoding: "utf8",
    });
    assert.equal(result.error, undefined);
    return {
      exitCode: result.status,
      stdout: JSON.parse(result.stdout),
      stderr: result.stderr,
    };
  };

  const templateResult = runValidator(["--record", templatePath, "--mode", "template"]);
  assert.equal(templateResult.exitCode, 0);
  assert.equal(templateResult.stdout.status, "PASS");
  assert.equal(templateResult.stdout.human_verified, false);

  const blankTrialResult = runValidator(["--record", templatePath, "--mode", "trial"]);
  assert.notEqual(blankTrialResult.exitCode, 0);
  assert.equal(blankTrialResult.stdout.status, "FAIL");
  assert.equal(blankTrialResult.stdout.human_verified, false);
  assert.ok(blankTrialResult.stdout.issues.includes("trial_mode_requires_RECORDED_status"));
  assert.ok(blankTrialResult.stdout.issues.includes("missing_required_field:run.date_time"));

  const tempDir = await mkdtemp(join(tmpdir(), "conceptmaster-human-trial-"));
  try {
    const emptyDir = await mkdtemp(join(tmpdir(), "conceptmaster-human-trial-empty-"));
    const waitingStatus = spawnSync(python, [
      statusPath,
      "--records-dir",
      emptyDir,
    ], {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      encoding: "utf8",
    });
    assert.equal(waitingStatus.status, 0);
    const waitingOutput = JSON.parse(waitingStatus.stdout);
    assert.equal(waitingOutput.status, "PASS");
    assert.equal(waitingOutput.m6_status, "WAITING_FOR_TRIAL_RECORD");
    assert.equal(waitingOutput.human_verified, false);
    await rm(emptyDir, { recursive: true, force: true });

    const preparedResult = spawnSync(python, [
      preparePath,
      "--tester",
      "Geonho",
      "--date-time",
      "2026-06-09T19:00:00+09:00",
      "--output-dir",
      tempDir,
      "--label",
      "geonho",
    ], {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      encoding: "utf8",
    });
    assert.equal(preparedResult.status, 0);
    const preparedOutput = JSON.parse(preparedResult.stdout);
    assert.equal(preparedOutput.status, "PASS");
    assert.equal(preparedOutput.record_status, "RECORDED");
    assert.equal(preparedOutput.human_verified, false);
    assert.match(preparedOutput.validate_command.join(" "), /--mode trial/);

    const preparedRecord = JSON.parse(await readFile(preparedOutput.record_path, "utf8"));
    assert.equal(preparedRecord.record_status, "RECORDED");
    assert.equal(preparedRecord.human_verified, false);
    assert.equal(preparedRecord.run.tester, "Geonho");
    assert.equal(preparedRecord.run.date_time, "2026-06-09T19:00:00+09:00");
    const preparedTrialResult = runValidator(["--record", preparedOutput.record_path, "--mode", "trial"]);
    assert.notEqual(preparedTrialResult.exitCode, 0);
    assert.equal(preparedTrialResult.stdout.human_verified, false);
    assert.ok(preparedTrialResult.stdout.issues.includes("expected_PASS_FAIL_or_NA:run.npm_test_result"));

    const startResult = spawnSync(python, [
      startPath,
      "--tester",
      "Geonho",
      "--date-time",
      "2026-06-09T19:10:00+09:00",
      "--output-dir",
      tempDir,
      "--label",
      "geonho-start",
      "--port",
      "4173",
    ], {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      encoding: "utf8",
    });
    assert.equal(startResult.status, 0);
    const startOutput = JSON.parse(startResult.stdout);
    assert.equal(startOutput.status, "PASS");
    assert.equal(startOutput.human_verified, false);
    assert.equal(startOutput.app_url, "http://localhost:4173");
    assert.deepEqual(startOutput.server_command, ["npm", "start"]);
    assert.match(startOutput.checklist_path, /GEONHO_HUMAN_TRIAL_CHECKLIST\.md/);
    assert.match(startOutput.validate_command.join(" "), /trial:validate/);
    assert.match(startOutput.validate_command.join(" "), /--record/);
    assert.ok(startOutput.trial_steps.some((step) => step.includes("30-second demo")));
    const startRecord = JSON.parse(await readFile(startOutput.record_path, "utf8"));
    assert.equal(startRecord.record_status, "RECORDED");
    assert.equal(startRecord.human_verified, false);
    assert.equal(startRecord.run.tester, "Geonho");
    assert.equal(startRecord.run.date_time, "2026-06-09T19:10:00+09:00");

    const incompleteStatus = spawnSync(python, [
      statusPath,
      "--records-dir",
      tempDir,
    ], {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      encoding: "utf8",
    });
    assert.equal(incompleteStatus.status, 0);
    const incompleteOutput = JSON.parse(incompleteStatus.stdout);
    assert.equal(incompleteOutput.status, "PASS");
    assert.equal(incompleteOutput.m6_status, "NEEDS_RECORD_COMPLETION");
    assert.equal(incompleteOutput.validator_status, "FAIL");
    assert.equal(incompleteOutput.human_verified, false);
    assert.ok(incompleteOutput.issues.includes("expected_PASS_FAIL_or_NA:run.npm_test_result"));

    const passRecordPath = join(tempDir, "human_trial_pass.json");
    const passRecord = {
      schema: "concept_master_human_trial_record.v1",
      record_status: "RECORDED",
      human_verified: true,
      baseline: {
        expected_auto_verified_baseline: "44 PASS / 0 FAIL",
        harness_report: "reports/token_harness/latest_status.v1.json",
      },
      run: {
        date_time: "2026-06-09T19:00:00+09:00",
        tester: "Geonho",
        npm_test_result: "PASS",
        browser_load_result: "PASS",
        ai_status_top_bar: "fallback",
      },
      demo: {
        demo_reached_data_screen: "PASS",
        improvement_rate_shown: "50%",
        attempt_log_shown: "PASS",
        concept_summary_shown: "PASS",
        recommendation_trace_shown: "PASS",
        problem_bank_qa_shown: "PASS",
        generated_problem_qa_notice_shown_when_needed: "N/A",
      },
      explanation: {
        why_features_were_built: "오답이 반복되는 개념을 찾기 위해 만들었다.",
        what_changed_after_wrong_answer: "오답 기록이 생기고 비슷한 문제 다시 풀기로 회복 여부가 표시됐다.",
        what_ai_helped_with: "AI 또는 기본 도움이 왜 틀렸는지와 다시 볼 개념을 정리했다.",
        why_retry_uses_same_concept: "같은 개념을 다시 풀어야 실수가 줄었는지 확인할 수 있기 때문이다.",
        what_data_screen_proves: "attempt_log, concept_summary, 개선률로 이해 회복을 확인했다.",
      },
      manus_and_fallback: {
        manus_diagnosis_source_if_visible: "rule_based_fallback",
        generated_retry_problem_source_if_visible: "same_concept_retry",
        fallback_demo_finished: "PASS",
        needs_review_or_qa_issue_shown: "N/A",
      },
      issues: [],
      final: {
        human_trial_decision: "PASS",
        reason: "30초 테스트와 설명 gate를 통과했다.",
        next_one_action: "발표 전 같은 흐름을 한 번 더 연습한다.",
      },
    };
    await writeFile(passRecordPath, JSON.stringify(passRecord, null, 2), "utf8");

    const passResult = runValidator(["--record", passRecordPath, "--mode", "trial"]);
    assert.equal(passResult.exitCode, 0);
    assert.equal(passResult.stdout.status, "PASS");
    assert.equal(passResult.stdout.human_verified, true);

    const passStatus = spawnSync(python, [
      statusPath,
      "--record",
      passRecordPath,
    ], {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      encoding: "utf8",
    });
    assert.equal(passStatus.status, 0);
    const passStatusOutput = JSON.parse(passStatus.stdout);
    assert.equal(passStatusOutput.m6_status, "HUMAN_VERIFIED");
    assert.equal(passStatusOutput.validator_status, "PASS");
    assert.equal(passStatusOutput.human_verified, true);

    passRecord.explanation.what_ai_helped_with = "AI made a quiz";
    await writeFile(passRecordPath, JSON.stringify(passRecord, null, 2), "utf8");
    const weakExplanationResult = runValidator(["--record", passRecordPath, "--mode", "trial"]);
    assert.notEqual(weakExplanationResult.exitCode, 0);
    assert.equal(weakExplanationResult.stdout.human_verified, false);
    assert.ok(weakExplanationResult.stdout.issues.includes("weak_explanation_ai_made_a_quiz"));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("live Manus verification note records public-safe source evidence", async () => {
  const note = await readFile(new URL("../LIVE_MANUS_VERIFICATION.md", import.meta.url), "utf8");

  assert.match(note, /2026-06-06/);
  assert.match(note, /\/api\/diagnose/);
  assert.match(note, /rule_based_fallback/);
  assert.match(note, /\/api\/generate-similar-problem/);
  assert.match(note, /manus_api/);
  assert.equal(note.includes("sk-"), false);
  assert.equal(note.includes("MANUS_API_KEY="), false);
});
