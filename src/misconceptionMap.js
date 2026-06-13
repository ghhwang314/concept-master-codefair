export const misconceptionLabels = {
  fraction_denominator_direct_add: "분모끼리 바로 더하는 오개념",
  ratio_total_parts_confusion: "전체 비의 합을 놓치는 오개념",
};

export function getMisconceptionLabel(misconceptionId = "") {
  if (!misconceptionId) return "오개념 없음";
  if (misconceptionLabels[misconceptionId]) return misconceptionLabels[misconceptionId];
  if (misconceptionId.includes("fraction_common_denominator")) return "통분하지 않고 바로 계산하는 오개념";
  if (misconceptionId.includes("ratio_part_total")) return "전체와 부분 비율을 헷갈리는 오개념";
  if (misconceptionId.includes("calculation_error")) return "계산 과정 실수";
  if (misconceptionId.includes("problem_interpretation")) return "문제 조건 해석 실수";
  if (misconceptionId.includes("memory_gap")) return "이전 개념 기억 부족";
  if (misconceptionId.includes("concept_misunderstanding")) return "개념 이해 부족";
  return "오개념 분류 대기";
}

export const requiredEvidenceDataSources = {
  demo_seed: "처음 예시",
  judge_demo: "30초 테스트 기록",
  human_trial: "학생 직접 풀이",
};

export function buildMisconceptionMap(events = [], problems = []) {
  const problemById = new Map(problems.map((problem) => [problem.id, problem]));
  const conceptMap = new Map();

  for (const event of events) {
    const problem = problemById.get(event.questionId) || {};
    const conceptId = event.conceptId || event.concept || problem.concept;
    if (!conceptId) continue;

    const conceptKo = event.conceptKo || problem.conceptKo || conceptId;
    const subject = event.subject || problem.subject || "math";
    const subjectKo = event.subjectKo || problem.subjectKo || "수학";
    if (!conceptMap.has(conceptId)) {
      conceptMap.set(conceptId, {
        conceptId,
        conceptKo,
        subject,
        subjectKo,
        attempts: 0,
        wrongAttempts: 0,
        retryClearedCount: 0,
        misconceptionCounts: {},
        dataSources: new Set(),
        aiSources: new Set(),
        nextReviewAt: "",
      });
    }

    const concept = conceptMap.get(conceptId);
    concept.attempts += 1;
    concept.dataSources.add(event.dataSource || "unknown");
    concept.aiSources.add(event.aiSource || event.aiDiagnosis?.source || "manual");

    if (event.nextReviewAt && (!concept.nextReviewAt || event.nextReviewAt < concept.nextReviewAt)) {
      concept.nextReviewAt = event.nextReviewAt;
    }

    const retryCleared = event.retryCleared === true || event.retryResult === "retried_then_cleared";
    if (retryCleared) concept.retryClearedCount += 1;

    if (!event.isCorrect) {
      concept.wrongAttempts += 1;
      const misconceptionId = event.misconceptionId || `${conceptId}_${event.mistakeReason || "unknown"}`;
      concept.misconceptionCounts[misconceptionId] = (concept.misconceptionCounts[misconceptionId] || 0) + 1;
    }
  }

  const concepts = [...conceptMap.values()].map((concept) => {
    const misconceptionEntries = Object.entries(concept.misconceptionCounts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const dominantMisconceptionId = misconceptionEntries[0]?.[0] || "";

    return {
      ...concept,
      retryCleared: concept.retryClearedCount > 0,
      dominantMisconceptionId,
      dominantMisconceptionKo: getMisconceptionLabel(dominantMisconceptionId),
      dataSources: [...concept.dataSources].sort(),
      aiSources: [...concept.aiSources].sort(),
      wrongRate: concept.attempts ? Math.round((concept.wrongAttempts / concept.attempts) * 100) : 0,
    };
  }).sort((a, b) => b.wrongAttempts - a.wrongAttempts || a.conceptKo.localeCompare(b.conceptKo));

  return {
    status: "PASS",
    attemptCount: events.length,
    wrongCount: events.filter((event) => !event.isCorrect).length,
    conceptCount: concepts.length,
    concepts,
  };
}

export function toAttemptLogRows(events = []) {
  return events.map((event) => ({
    eventId: event.id,
    questionId: event.questionId,
    conceptId: event.conceptId || event.concept,
    misconceptionId: event.misconceptionId || "",
    dataSource: event.dataSource || "unknown",
    isCorrect: event.isCorrect,
    retryCleared: event.retryCleared === true || event.retryResult === "retried_then_cleared",
    nextReviewAt: event.nextReviewAt || "",
    aiSource: event.aiSource || event.aiDiagnosis?.source || "manual",
  }));
}

export function toConceptSummaryRows(misconceptionMap = buildMisconceptionMap()) {
  return misconceptionMap.concepts.map((concept) => ({
    conceptId: concept.conceptId,
    conceptKo: concept.conceptKo,
    attempts: concept.attempts,
    wrongAttempts: concept.wrongAttempts,
    wrongRate: concept.wrongRate,
    dominantMisconceptionId: concept.dominantMisconceptionId,
    dominantMisconceptionKo: concept.dominantMisconceptionKo,
    retryCleared: concept.retryCleared,
    nextReviewAt: concept.nextReviewAt,
    dataSources: concept.dataSources.join("|"),
    aiSources: concept.aiSources.join("|"),
  }));
}

export function buildLearningEvidencePayload(events = [], problems = []) {
  const misconceptionMap = buildMisconceptionMap(events, problems);
  const attemptLog = toAttemptLogRows(events);
  const conceptSummary = toConceptSummaryRows(misconceptionMap);
  const observedSources = new Set(attemptLog.map((row) => row.dataSource));
  const dataSourceOrder = [
    ...Object.keys(requiredEvidenceDataSources),
    ...[...observedSources].filter((source) => !requiredEvidenceDataSources[source]).sort(),
  ];

  return {
    schema: "concept_master_m5_learning_evidence.v1",
    status: misconceptionMap.status,
    dataSources: dataSourceOrder.map((dataSource) => ({
      dataSource,
      role: requiredEvidenceDataSources[dataSource] || "추가 풀이",
      count: attemptLog.filter((row) => row.dataSource === dataSource).length,
    })),
    attempt_log: attemptLog,
    concept_summary: conceptSummary,
  };
}
