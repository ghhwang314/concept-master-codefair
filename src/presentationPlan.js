import { getDefaultJudgeProblems } from "./problems.js";

export const representativeProblemIds = [
  "math_frac_001",
  "math_frac_002",
  "math_frac_003",
  "math_frac_004",
  "math_ratio_001",
  "math_ratio_002",
];

export const presentationCueCards = [
  {
    stage: "problem",
    durationSeconds: 20,
    title: "문제 정의",
    screen: "학습",
    speakerLine: "초6 학생은 분수 통분이나 비례식에서 답만 외우고 넘어가 같은 오개념을 반복합니다.",
    proof: "AI 오답 코치는 이 반복 오답을 오답 기록 데이터로 저장합니다.",
  },
  {
    stage: "attempt",
    durationSeconds: 20,
    title: "오답 데이터 저장",
    screen: "30초 테스트",
    speakerLine: "테스트 시작을 누르면 학생의 선택, 정답, 개념 태그, 오답 사유가 attempt_log로 남습니다.",
    proof: "demo_seed, judge_demo, human_trial 출처와 개념별 wrong-rate가 데이터 화면에서 같이 보입니다.",
  },
  {
    stage: "diagnosis",
    durationSeconds: 20,
    title: "AI 오답 이유 설명",
    screen: "진단 모달",
    speakerLine: "오답이면 AI 보조 또는 기본 설명이 원인, 근거, 다시 볼 내용을 정리합니다.",
    proof: "AI 응답이 늦으면 기본 설명으로 바뀌고 도움 방식 라벨이 그 사실을 표시합니다.",
  },
  {
    stage: "generation",
    durationSeconds: 20,
    title: "비슷한 문제 준비",
    screen: "학습",
    speakerLine: "앱은 같은 초6 수학 개념의 비슷한 문제를 준비하고, 정답 번호와 해설을 문제 준비 확인으로 점검합니다.",
    proof: "생성 문항은 사람 확인 전까지 선생님 확인 필요 상태로 남아 과신을 막습니다.",
  },
  {
    stage: "retry",
    durationSeconds: 20,
    title: "비슷한 문제 다시 풀기",
    screen: "학습",
    speakerLine: "학생이 같은 개념 문제를 다시 풀면 다시 풀기 성공 여부가 attempt에 연결됩니다.",
    proof: "다시 풀기 성공은 이해도 점수와 다음 복습일 계산에 반영됩니다.",
  },
  {
    stage: "evidence",
    durationSeconds: 20,
    title: "개선률 증거",
    screen: "데이터",
    speakerLine: "마지막에는 데이터 화면으로 이동해 오답 기록 지도, concept_summary, 개선률, 추천 근거를 보여줍니다.",
    proof: "데이터에서 이유 설명, 다시 풀기, 개선률 상승을 한 흐름으로 확인합니다.",
  },
];

export function buildPresentationPlan(problems = getDefaultJudgeProblems()) {
  const problemById = new Map(problems.map((problem) => [problem.id, problem]));
  const representativeProblems = representativeProblemIds
    .map((id) => problemById.get(id))
    .filter(Boolean);

  return {
    representativeProblemIds: [...representativeProblemIds],
    representativeProblems,
    cueCards: presentationCueCards.map((card, index) => ({
      ...card,
      order: index + 1,
    })),
  };
}

export function validatePresentationPlan(plan = buildPresentationPlan(), problems = getDefaultJudgeProblems()) {
  const issues = [];
  const ids = new Set(problems.map((problem) => problem.id));
  const plannedIds = plan.representativeProblemIds || [];

  if (plannedIds.length < 5 || plannedIds.length > 7) {
    issues.push("representative problem count must be 5-7");
  }

  plannedIds.forEach((id) => {
    if (!ids.has(id)) issues.push(`${id}: representative problem not found`);
  });

  const subjects = new Set((plan.representativeProblems || []).map((problem) => problem.subject));
  if (subjects.size !== 1 || !subjects.has("math")) {
    issues.push("representative problems must stay scoped to elementary math");
  }

  const duration = (plan.cueCards || []).reduce((total, card) => total + Number(card.durationSeconds || 0), 0);
  if (duration !== 120) issues.push(`cue card duration must total 120 seconds, got ${duration}`);

  const scriptText = (plan.cueCards || [])
    .map((card) => `${card.title || ""} ${card.speakerLine || ""} ${card.proof || ""}`)
    .join(" ");
  for (const term of ["오답 기록", "AI", "비슷한 문제", "문제 준비", "다시 풀기", "개선률", "attempt_log", "concept_summary"]) {
    if (!scriptText.includes(term)) issues.push(`missing cue term ${term}`);
  }

  return {
    status: issues.length === 0 ? "PASS" : "FAIL",
    issueCount: issues.length,
    issues,
  };
}
