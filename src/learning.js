import { formatDate, scheduleReviewWithFsrs } from "./reviewScheduler.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export function scheduleNextReview({ isCorrect, priorSuccessStreak = 0, now = new Date() }) {
  return scheduleReviewWithFsrs({ isCorrect, priorSuccessStreak, now }).nextReviewAt;
}

export function createLearningEvent({
  problem,
  selectedAnswer,
  mistakeReason = "",
  misconceptionId = "",
  dataSource = "app_runtime",
  aiDiagnosis = null,
  retryResult,
  priorSuccessStreak = 0,
  now = new Date(),
}) {
  const isCorrect = selectedAnswer === problem.answer;
  const selectedReason = isCorrect ? "" : mistakeReason || aiDiagnosis?.reason || "concept_misunderstanding";
  const resolvedRetryResult = retryResult || (isCorrect ? "cleared" : "needs_retry");
  const resolvedMisconceptionId = misconceptionId || aiDiagnosis?.misconceptionId || deriveMisconceptionId({
    conceptId: problem.concept,
    mistakeReason: selectedReason,
  });

  const reviewSchedule = scheduleReviewWithFsrs({ isCorrect, priorSuccessStreak, now });

  return {
    id: `event_${problem.id}_${new Date(now).getTime()}_${Math.random().toString(16).slice(2, 8)}`,
    questionId: problem.id,
    subject: problem.subject,
    subjectKo: problem.subjectKo,
    conceptId: problem.concept,
    concept: problem.concept,
    conceptKo: problem.conceptKo,
    misconceptionId: resolvedMisconceptionId,
    dataSource,
    selectedAnswer,
    correctAnswer: problem.answer,
    isCorrect,
    mistakeReason: selectedReason,
    aiDiagnosis,
    aiSource: aiDiagnosis?.source || (aiDiagnosis ? "structured_diagnosis" : "manual"),
    confidence: aiDiagnosis?.confidence ?? null,
    retryResult: resolvedRetryResult,
    retryCleared: resolvedRetryResult === "retried_then_cleared",
    reviewedAt: formatDate(now),
    nextReviewAt: reviewSchedule.nextReviewAt,
    reviewSchedule,
  };
}

export function markRetryCleared(events, retryEventId) {
  let clearedEvent = null;
  const updatedEvents = events.map((event) => {
    if (event.id !== retryEventId || event.isCorrect) return event;
    clearedEvent = {
      ...event,
      retryResult: "retried_then_cleared",
      retryCleared: true,
    };
    return clearedEvent;
  });

  return {
    events: updatedEvents,
    clearedEvent,
  };
}

export function deriveMisconceptionId({ conceptId, mistakeReason }) {
  if (!mistakeReason) return "";
  if (conceptId === "fraction_common_denominator" && mistakeReason === "concept_misunderstanding") {
    return "fraction_denominator_direct_add";
  }
  if (conceptId === "ratio_part_total" && ["concept_misunderstanding", "problem_interpretation"].includes(mistakeReason)) {
    return "ratio_total_parts_confusion";
  }
  return `${conceptId}_${mistakeReason}`;
}

export function calculateConceptStats(events) {
  return events.reduce((acc, event) => {
    if (!acc[event.concept]) {
      acc[event.concept] = {
        concept: event.concept,
        conceptKo: event.conceptKo,
        subject: event.subject,
        attempts: 0,
        mistakes: 0,
        clears: 0,
        mistakeRate: 0,
      };
    }

    const stat = acc[event.concept];
    stat.attempts += 1;
    if (event.isCorrect) stat.clears += 1;
    else stat.mistakes += 1;
    stat.mistakeRate = Math.round((stat.mistakes / stat.attempts) * 100);
    return acc;
  }, {});
}

export function calculateMasteryScores(events) {
  const stats = calculateConceptStats(events);

  return Object.fromEntries(Object.values(stats).map((stat) => {
    const smoothedCorrect = stat.clears + 0.5;
    const smoothedAttempts = stat.attempts + 1;
    const masteryScore = Math.round((smoothedCorrect / smoothedAttempts) * 100);

    return [stat.concept, {
      concept: stat.concept,
      conceptKo: stat.conceptKo,
      subject: stat.subject,
      masteryScore,
      masteryLevel: getMasteryLevel(masteryScore),
      attempts: stat.attempts,
      clears: stat.clears,
      mistakes: stat.mistakes,
      mistakeRate: stat.mistakeRate,
      evidence: `${stat.clears}/${stat.attempts} 정답`,
    }];
  }));
}

function getMasteryLevel(score) {
  if (score >= 80) return "strong";
  if (score >= 50) return "developing";
  return "fragile";
}

export function getMistakeReasonDistribution(events) {
  return events.reduce((acc, event) => {
    if (!event.isCorrect && event.mistakeReason) {
      acc[event.mistakeReason] = (acc[event.mistakeReason] || 0) + 1;
    }
    return acc;
  }, {});
}

export function getTopRepeatedMistakeConcepts(events, limit = 3) {
  return Object.values(calculateConceptStats(events))
    .filter((stat) => stat.mistakes > 0)
    .sort((a, b) => b.mistakes - a.mistakes || b.attempts - a.attempts || a.conceptKo.localeCompare(b.conceptKo))
    .slice(0, limit);
}

export function getDueReviewConcepts(events, today = formatDate(new Date())) {
  const conceptStats = calculateConceptStats(events);
  const dueMap = events
    .filter((event) => event.nextReviewAt && event.nextReviewAt <= today)
    .reduce((acc, event) => {
      if (!acc[event.concept]) {
        acc[event.concept] = {
          concept: event.concept,
          conceptKo: event.conceptKo,
          subject: event.subject,
          dueCount: 0,
          mistakes: conceptStats[event.concept]?.mistakes || 0,
          mistakeRate: conceptStats[event.concept]?.mistakeRate || 0,
          source: "learning_events",
        };
      }
      acc[event.concept].dueCount += 1;
      return acc;
    }, {});

  return Object.values(dueMap)
    .sort((a, b) => b.dueCount - a.dueCount || b.mistakes - a.mistakes || a.conceptKo.localeCompare(b.conceptKo));
}

export function recommendReviewConcepts(events, problems = [], options = {}) {
  const today = options.today || formatDate(new Date());
  const limit = options.limit || 3;
  const masteryScores = calculateMasteryScores(events);
  const dueConcepts = getDueReviewConcepts(events, today);
  const dueByConcept = Object.fromEntries(dueConcepts.map((concept) => [concept.concept, concept]));
  const recentWrongCounts = getRecentWrongCounts(events, today);
  const conceptMap = new Map();

  for (const problem of problems) {
    if (!conceptMap.has(problem.concept)) {
      conceptMap.set(problem.concept, {
        concept: problem.concept,
        conceptKo: problem.conceptKo,
        subject: problem.subject,
        dueCount: 0,
        mistakes: 0,
        mistakeRate: 0,
      });
    }
  }

  for (const score of Object.values(masteryScores)) {
    conceptMap.set(score.concept, {
      ...(conceptMap.get(score.concept) || {}),
      ...score,
    });
  }

  for (const due of dueConcepts) {
    conceptMap.set(due.concept, {
      ...(conceptMap.get(due.concept) || {}),
      ...due,
    });
  }

  return [...conceptMap.values()]
    .map((concept) => {
      const masteryScore = masteryScores[concept.concept]?.masteryScore ?? 50;
      const dueCount = dueByConcept[concept.concept]?.dueCount || 0;
      const recentWrongCount = recentWrongCounts[concept.concept] || 0;
      const mistakes = masteryScores[concept.concept]?.mistakes || concept.mistakes || 0;
      const scoreFactors = {
        masteryGap: 100 - masteryScore,
        recentWrongBoost: recentWrongCount * 40,
        dueReviewBoost: dueCount * 20,
        mistakeBoost: mistakes * 10,
      };
      const priorityScore = Math.round(Object.values(scoreFactors).reduce((sum, value) => sum + value, 0));

      return {
        ...concept,
        masteryScore,
        dueCount,
        recentWrongCount,
        mistakes,
        scoreFactors,
        priorityScore,
        recommendationReason: getRecommendationReason({ masteryScore, recentWrongCount, dueCount }),
        traceSummary: buildRecommendationTraceSummary({
          masteryScore,
          recentWrongCount,
          dueCount,
          mistakes,
          priorityScore,
        }),
        source: "mastery_recent_mistake",
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore || a.conceptKo.localeCompare(b.conceptKo))
    .slice(0, limit);
}

export function buildRecommendationTrace(events, problems = [], options = {}) {
  return recommendReviewConcepts(events, problems, options).map(toRecommendationTraceItem);
}

function toRecommendationTraceItem(concept) {
  return {
    concept: concept.concept,
    conceptKo: concept.conceptKo,
    recommendationReason: concept.recommendationReason,
    priorityScore: concept.priorityScore,
    scoreFactors: concept.scoreFactors,
    traceSummary: concept.traceSummary,
    source: concept.source,
  };
}

function buildRecommendationTraceSummary({
  masteryScore,
  recentWrongCount,
  dueCount,
  mistakes,
  priorityScore,
}) {
  const parts = [`이해도 ${masteryScore}점`];
  if (recentWrongCount > 0) parts.push(`최근 3일 오답 ${recentWrongCount}개`);
  if (dueCount > 0) parts.push(`복습 도래 ${dueCount}개`);
  if (mistakes > 0) parts.push(`누적 오답 ${mistakes}개`);
  return `${parts.join(" · ")} -> 추천점수 ${priorityScore}점`;
}

function getRecentWrongCounts(events, today) {
  const todayTime = new Date(today).getTime();
  return events.reduce((acc, event) => {
    if (event.isCorrect) return acc;
    const reviewedTime = new Date(event.reviewedAt).getTime();
    const dayDiff = Math.round((todayTime - reviewedTime) / DAY_MS);
    if (dayDiff >= 0 && dayDiff <= 3) {
      acc[event.concept] = (acc[event.concept] || 0) + 1;
    }
    return acc;
  }, {});
}

function getRecommendationReason({ masteryScore, recentWrongCount, dueCount }) {
  if (masteryScore < 50 && recentWrongCount > 0) return "low_mastery_recent_mistake";
  if (recentWrongCount > 0) return "recent_mistake";
  if (dueCount > 0) return "review_due";
  if (masteryScore < 50) return "low_mastery";
  return "spacing_review";
}

export function calculateImprovementRate(beforeMistakes, afterMistakes) {
  if (!beforeMistakes || beforeMistakes <= 0) return 0;
  return Math.max(0, Math.round(((beforeMistakes - afterMistakes) / beforeMistakes) * 100));
}

export function getTodayQuestProgress(events, options = {}) {
  const today = options.today || formatDate(new Date());
  const todayEvents = events.filter((event) => event.reviewedAt === today);
  const attemptCount = Math.min(3, todayEvents.length);
  const diagnoseComplete = todayEvents.some((event) => !event.isCorrect && event.aiDiagnosis);
  const clearComplete = todayEvents.some((event) =>
    event.retryCleared === true || event.retryResult === "retried_then_cleared"
  );
  const solveComplete = attemptCount >= 3;
  const displayAttemptCount = solveComplete ? 3 : attemptCount;
  const completedCount = [solveComplete, diagnoseComplete, clearComplete].filter(Boolean).length;

  return {
    today,
    todayEvents,
    attemptCount,
    displayAttemptCount,
    solveComplete,
    diagnoseComplete,
    clearComplete,
    completedCount,
    percent: Math.round((completedCount / 3) * 100),
  };
}

export function buildDashboardModel(events, problems, options = {}) {
  const conceptStats = calculateConceptStats(events);
  const masteryScores = calculateMasteryScores(events);
  const topConcepts = getTopRepeatedMistakeConcepts(events, 3);
  const reasonDistribution = getMistakeReasonDistribution(events);
  const dueReviewConcepts = getDueReviewConcepts(events, options.today || formatDate(new Date()));
  const reviewRecommendations = recommendReviewConcepts(events, problems, {
    today: options.today || formatDate(new Date()),
    limit: 3,
  });
  const lowMasteryConcepts = Object.values(masteryScores)
    .sort((a, b) => a.masteryScore - b.masteryScore || b.mistakes - a.mistakes || a.conceptKo.localeCompare(b.conceptKo))
    .slice(0, 3);
  const todayReview = topConcepts[0] || {
    concept: problems[0]?.concept,
    conceptKo: problems[0]?.conceptKo,
    mistakes: 0,
    mistakeRate: 0,
  };
  const beforeMistakes = events.filter((event) => !event.isCorrect).length || 3;
  const unresolvedMistakes = events.filter((event) =>
    !event.isCorrect && event.retryResult !== "retried_then_cleared"
  ).length;
  const afterMistakes = beforeMistakes > 0 ? unresolvedMistakes : Math.max(0, topConcepts[0]?.mistakes ?? 1);

  return {
    conceptStats,
    masteryScores,
    lowMasteryConcepts,
    topConcepts,
    reasonDistribution,
    dueReviewConcepts,
    reviewRecommendations,
    recommendationTrace: reviewRecommendations.map(toRecommendationTraceItem),
    todayReview,
    improvementRate: calculateImprovementRate(beforeMistakes, afterMistakes),
  };
}
