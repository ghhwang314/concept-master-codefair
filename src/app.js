import { diagnoseMistake, fallbackDiagnosis } from "./diagnosis.js";
import { generateSimilarProblem } from "./generation.js";
import { ManusAiClient } from "./manusClient.js";
import {
  buildDashboardModel,
  createLearningEvent,
  getTodayQuestProgress,
  markRetryCleared,
} from "./learning.js";
import { buildDttTrace } from "./dttTrace.js";
import { buildPresentationPlan } from "./presentationPlan.js";
import { buildReadinessAudit } from "./readinessAudit.js";
import {
  DEMO_API_TIMEOUT_MS,
  JUDGE_DEMO_STAGE_IDS,
} from "./demoContract.js";
import {
  createTemplateProblem,
  getDefaultJudgeProblems,
  recommendNextProblem,
  summarizeProblemBank,
  validateProblemBank,
} from "./problems.js";
import {
  buildLearningEvidencePayload,
  buildMisconceptionMap,
  getMisconceptionLabel,
} from "./misconceptionMap.js";
import { formatDate } from "./reviewScheduler.js";

const STORAGE_KEY = "concept-master-codefair.learningEvents.v1";
const GRADE_STORAGE_KEY = "concept-master-codefair.selectedGrade.v1";
const USER_API_KEY_STORAGE_KEY = "concept-master-codefair.userApiKey.v1";
const aiStatusLabels = {
  idle: "AI 보조 대기 중",
  waiting: "틀린 이유 정리 중",
  connected: "AI 보조 완료",
  fallback: "기본 설명 사용 중",
};

const reasonLabels = {
  concept_misunderstanding: "개념 미이해",
  calculation_error: "계산 실수",
  problem_interpretation: "문제 해석",
  memory_gap: "기억 부족",
};

const masteryLevelLabels = {
  fragile: "연습 필요",
  developing: "성장 중",
  strong: "강함",
};

const recommendationReasonLabels = {
  low_mastery_recent_mistake: "최근에 자주 틀림",
  recent_mistake: "최근 오답",
  review_due: "복습도래",
  low_mastery: "연습 필요",
  spacing_review: "간격복습",
};

const dataSourceLabels = {
  demo_seed: "시작 예시",
  judge_demo: "테스트 기록",
  human_trial: "직접 풀이",
  app_runtime: "앱 기록",
  unknown: "추가 풀이",
};

const aiSourceLabels = {
  manus_api: "AI 보조",
  rule_based_fallback: "기본 설명",
  template_fallback: "기본 예시",
  structured_diagnosis: "AI 정리",
  manual: "직접 풀이",
};

const retryReasonLabels = {
  same_concept_retry: "비슷한 문제",
  ai_generated_same_concept: "AI가 만든 같은 개념 문항",
  fallback_generated_same_concept: "기본 예시 문항",
  client_demo_template_fallback: "기본 예시 문항",
};

const diagnosisTraceLabels = {
  manus_api_success: "AI가 이유를 찾아줌",
  diagnosis_timeout: "AI 응답이 늦어 기본 설명 사용",
  missing_api_key: "AI 설정 전이라 기본 설명 사용",
  structured_output_failed: "AI 답을 정리하지 못해 기본 설명 사용",
  invalid_structured_diagnosis: "AI 답이 부족해 기본 설명 사용",
  task_create_failed: "AI 보조 시작 실패로 기본 설명 사용",
  waiting_for_user: "AI가 추가 입력을 기다림",
  task_stopped_without_output: "AI 답이 없어 기본 설명 사용",
  manus_api_http_error: "AI 연결이 안 되어 기본 설명 사용",
  manus_request_timeout: "AI 응답이 늦어 기본 설명 사용",
  manus_client_error: "AI 처리 오류로 기본 설명 사용",
  client_missing: "AI 연결 전이라 기본 설명 사용",
  browser_api_request_failed: "AI 응답을 받지 못해 기본 설명 사용",
  credit_saver_mode: "기본 설명으로 진행했어요",
  cached_manus_result: "저장된 AI 보조 사용",
  offline_rule_based_demo: "테스트 안전용 기본 설명",
  github_pages_static: "GitHub Pages 정적 배포 모드 (기본 설명 제공)",
};

const isStaticHosting = typeof window !== "undefined" && (window.location.hostname.endsWith("github.io") || window.location.protocol === "file:");
const demoStages = JUDGE_DEMO_STAGE_IDS;
const gradeLabels = {
  elementary_6: "초6 수학",
};

let problems = getDefaultJudgeProblems();
let currentProblemIndex = 0;
let latestWrongEvent = null;
let learningEvents = loadEvents();
learningEvents = applyTodayResetFromUrl(learningEvents);
let selectedSubject = "math";
let selectedAnswerIndex = null;
let liveAiAlways = true;
let selectedModalAnswerIndex = null;
let modalProblem = null;
let pendingRetryEventId = null;

const els = {
  gradeOverlay: document.getElementById("grade-select-overlay"),
  gradeButtons: [...document.querySelectorAll("[data-grade]")],
  gradeBadge: document.getElementById("grade-badge"),
  changeGradeButton: document.getElementById("change-grade-btn"),
  liveAiOnceButton: document.getElementById("live-ai-once-button"),
  judgeDemoButton: document.getElementById("judge-demo-button"),
  todaySolvedCount: document.getElementById("today-solved-count"),
  todayProgressScore: document.getElementById("today-progress-score"),
  menuTabs: [...document.querySelectorAll("[data-screen-target]")],
  screens: [...document.querySelectorAll("[data-screen]")],
  demoGuideBanner: document.getElementById("demo-guide-banner"),
  demoGuideStep: document.getElementById("demo-guide-step"),
  demoGuideTitle: document.getElementById("demo-guide-title"),
  demoGuideDesc: document.getElementById("demo-guide-desc"),
  guideProgressFill: document.getElementById("guide-progress-fill"),
  demoSummary: document.getElementById("demo-summary"),
  demoStageList: document.getElementById("demo-stage-list"),
  presentationCueList: document.getElementById("presentation-cue-list"),
  representativeProblems: document.getElementById("representative-problems"),
  aiStatus: document.getElementById("ai-status"),
  aiStatusText: document.getElementById("ai-status-text"),
  todayReviewTitle: document.getElementById("today-review-title"),
  todayReviewCopy: document.getElementById("today-review-copy"),
  improvementPanel: document.getElementById("improvement-panel"),
  improvementRate: document.getElementById("improvement-rate"),
  misconceptionMapPanel: document.getElementById("misconception-map-panel"),
  aiDiagnosisCard: document.getElementById("ai-diagnosis-card"),
  diagnosisCardTitle: document.getElementById("diagnosis-card-title"),
  diagnosisCardCopy: document.getElementById("diagnosis-card-copy"),
  sameConceptRetryCard: document.getElementById("same-concept-retry-card"),
  retryCardTitle: document.getElementById("retry-card-title"),
  retryCardCopy: document.getElementById("retry-card-copy"),
  beforeAfterCard: document.getElementById("before-after-card"),
  beforeMistakeCount: document.getElementById("before-mistake-count"),
  afterMistakeCount: document.getElementById("after-mistake-count"),
  beforeAfterCopy: document.getElementById("before-after-copy"),
  topConcepts: document.getElementById("top-concepts"),
  masteryList: document.getElementById("mastery-list"),
  todayReviewConcepts: document.getElementById("today-review-concepts"),
  recommendationTracePanel: document.getElementById("recommendation-trace-panel"),
  recommendationTrace: document.getElementById("recommendation-trace"),
  misconceptionMapList: document.getElementById("misconception-map-list"),
  dataSourceSummary: document.getElementById("data-source-summary"),
  attemptLogPreview: document.getElementById("attempt-log-preview"),
  conceptSummaryPreview: document.getElementById("concept-summary-preview"),
  learningLogJson: document.getElementById("learning-log-json"),
  problemBankSummary: document.getElementById("problem-bank-summary"),
  problemBankSubjects: document.getElementById("problem-bank-subjects"),
  reasonBars: document.getElementById("reason-bars"),
  legendConceptCount: document.getElementById("legend-concept-count"),
  legendCalcCount: document.getElementById("legend-calc-count"),
  legendInterpCount: document.getElementById("legend-interp-count"),
  questProgressFill: document.getElementById("quest-progress-fill"),
  questProgressText: document.getElementById("quest-progress-text"),
  questSolveItem: document.getElementById("quest-item-solve"),
  questDiagnoseItem: document.getElementById("quest-item-diagnose"),
  questClearItem: document.getElementById("quest-item-clear"),
  questSolveText: document.getElementById("quest-solve-text"),
  questDiagnoseText: document.getElementById("quest-diagnose-text"),
  questClearText: document.getElementById("quest-clear-text"),
  questionConcept: document.getElementById("question-concept"),
  questionText: document.getElementById("question-text"),
  answerOptions: document.getElementById("answer-options"),
  subjectFilterTabs: [...document.querySelectorAll("[data-subject]")],
  submitAnswerButton: document.getElementById("submit-answer-button"),
  nextQuestionButton: document.getElementById("next-question-button"),
  quizFeedback: document.getElementById("quiz-feedback"),
  generatedQaNotice: document.getElementById("generated-qa-notice"),
  qaStatus: document.getElementById("qa-status"),
  qaCopy: document.getElementById("qa-copy"),
  eventLog: document.getElementById("event-log"),
  dttTraceList: document.getElementById("dtt-trace-list"),
  readinessAuditList: document.getElementById("readiness-audit-list"),
  modal: document.getElementById("diagnosis-modal"),
  selectedAnswer: document.getElementById("selected-answer"),
  correctAnswer: document.getElementById("correct-answer"),
  diagnosisReason: document.getElementById("diagnosis-reason"),
  diagnosisTrace: document.getElementById("diagnosis-trace"),
  mistakeReasonSelect: document.getElementById("mistake-reason-select"),
  diagnosisEvidence: document.getElementById("diagnosis-evidence"),
  diagnosisRecommendation: document.getElementById("diagnosis-recommendation"),
  nextReviewDate: document.getElementById("next-review-date"),
  retryConceptButton: document.getElementById("retry-concept-button"),
  modalDiagnosisBody: document.getElementById("modal-diagnosis-body"),
  modalQuizBody: document.getElementById("modal-quiz-body"),
  modalQuestionConcept: document.getElementById("modal-question-concept"),
  modalQuestionText: document.getElementById("modal-question-text"),
  modalAnswerOptions: document.getElementById("modal-answer-options"),
  modalGeneratedQaNotice: document.getElementById("modal-generated-qa-notice"),
  modalQuizFeedback: document.getElementById("modal-quiz-feedback"),
  modalActionsNormal: document.getElementById("modal-actions-normal"),
  modalActionsQuiz: document.getElementById("modal-actions-quiz"),
  modalSubmitAnswerButton: document.getElementById("modal-submit-answer-button"),
  modalCloseQuizButton: document.getElementById("modal-close-quiz-button"),
  quizBubble: document.querySelector(".quiz-bubble"),
  viewDashboardBtn: document.getElementById("view-dashboard-btn"),
  viewQuizBtn: document.getElementById("view-quiz-btn"),
  dashboardViewContainer: document.getElementById("dashboard-view-container"),
  quizViewContainer: document.getElementById("quiz-view-container"),
  judgeEvidenceSections: document.querySelector(".judge-evidence-sections"),
  todayReviewPanel: document.querySelector(".today-review-panel"),
  distributionPanel: document.querySelector(".distribution-panel"),
  evidenceGrid: document.querySelector(".evidence-grid"),
  resetHistoryBtn: document.getElementById("reset-history-btn"),
  apiKeyInput: document.getElementById("manus-api-key-input"),
  saveApiKeyBtn: document.getElementById("save-api-key-btn"),
  clearApiKeyBtn: document.getElementById("clear-api-key-btn"),
  apiStatusDot: document.getElementById("api-status-dot"),
  apiStatusText: document.getElementById("api-status-text"),
};

initialize();

function initialize() {
  organizeMenuLayout();

  // 상단 대시보드 / 문제풀이 화면 분할 탭 리스너 연동
  if (els.viewDashboardBtn && els.viewQuizBtn) {
    els.viewDashboardBtn.addEventListener("click", () => {
      els.viewDashboardBtn.classList.add("is-active");
      els.viewQuizBtn.classList.remove("is-active");
      
      // 대시보드 홈 복귀 시 오답 통계/복습 개념 카드를 원래 대시보드 그리드 하단으로 환원
      if (els.evidenceGrid) {
        if (els.todayReviewPanel) els.evidenceGrid.append(els.todayReviewPanel);
        if (els.distributionPanel) els.evidenceGrid.append(els.distributionPanel);
      }
      
      els.dashboardViewContainer?.classList.remove("hidden-view");
      els.judgeEvidenceSections?.classList.remove("hidden-view");
      els.quizViewContainer?.classList.add("hidden-view");
    });

    els.viewQuizBtn.addEventListener("click", () => {
      els.viewQuizBtn.classList.add("is-active");
      els.viewDashboardBtn.classList.remove("is-active");
      els.quizViewContainer?.classList.remove("hidden-view");
      els.dashboardViewContainer?.classList.add("hidden-view");
      els.judgeEvidenceSections?.classList.add("hidden-view");

      // 문제풀이 활성화 시, 질문을 즉시 렌더링하고 스크롤 포커스 이동
      renderQuestion();
      const quizPanel = document.querySelector(".quiz-panel");
      if (quizPanel) {
        quizPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      // 문제풀이 탭 아래쪽으로 대시보드의 마지막 2개 통계창을 동적으로 이관하여 함께 노출
      if (els.quizViewContainer) {
        if (els.todayReviewPanel) els.quizViewContainer.append(els.todayReviewPanel);
        if (els.distributionPanel) els.quizViewContainer.append(els.distributionPanel);
      }
    });
  }

  if (learningEvents.length === 0) {
    learningEvents = seedDemoEvents();
    saveEvents();
  }

  if (els.resetHistoryBtn) {
    els.resetHistoryBtn.addEventListener("click", () => {
      if (confirm("오늘의 학습 및 퀘스트 기록을 모두 초기화하시겠습니까?")) {
        localStorage.removeItem(STORAGE_KEY);
        window.location.href = window.location.pathname;
      }
    });
  }

  initializeGradeSelector();
  els.menuTabs.forEach((button) => {
    button.addEventListener("click", () => setActiveScreen(button.dataset.screenTarget, { scroll: true }));
  });
  els.subjectFilterTabs.forEach((button) => {
    button.addEventListener("click", () => setSubjectFilter(button.dataset.subject));
  });
  els.liveAiOnceButton.addEventListener("click", () => {
    liveAiAlways = !liveAiAlways;
    renderLiveAiOnceButton();
  });
  els.judgeDemoButton.addEventListener("click", () => {
    if (els.viewQuizBtn) els.viewQuizBtn.click(); // 데모 시작 시 문제풀이 화면으로 포커스
    setActiveScreen("demo", { scroll: true });
    runJudgeDemo();
  });
  els.nextQuestionButton.addEventListener("click", () => {
    currentProblemIndex = getNextProblemIndex();
    renderQuestion();
  });
  els.submitAnswerButton.addEventListener("click", () => {
    if (selectedAnswerIndex !== null) handleAnswer(selectedAnswerIndex);
  });
  els.retryConceptButton.addEventListener("click", retryLatestConcept);
  els.mistakeReasonSelect.addEventListener("change", updateLatestMistakeReason);
  els.modalSubmitAnswerButton.addEventListener("click", handleModalSubmit);
  els.modalCloseQuizButton.addEventListener("click", () => {
    els.modal.close();
  });
  els.modal.addEventListener("close", () => {
    renderQuestion();
    renderQa();
    if (els.viewQuizBtn) els.viewQuizBtn.click(); // 모달이 닫히면 바로 문제풀이 화면으로 안내
  });

  renderQa();
  renderDashboard();
  renderPresentationPlan();
  renderDttTrace();
  renderReadinessAudit();
  renderQuestion();
  setAiStatus("idle");
  renderLiveAiOnceButton();
  setDemoStage("");
  hideDemoGuide();
  setActiveScreen("learn");
  initializeApiKeySettings();
}

function organizeMenuLayout() {
  const menuSections = document.querySelector(".judge-evidence-sections");
  const subjectSwitcher = document.querySelector(".subject-switcher");
  const appMenu = document.getElementById("app-menu");
  const demoGuide = document.getElementById("demo-guide-banner");
  const heroSection = document.querySelector(".learning-hero");
  const pathSection = document.querySelector(".dna-path-section");
  const learnScreen = document.querySelector('[data-screen="learn"]');
  const dataScreen = document.querySelector('[data-screen="data"]');
  const learningTools = document.querySelector(".learning-tools");
  const workbench = document.querySelector(".workbench");
  const detailEvidence = document.querySelector(".detail-evidence-grid");

  if (menuSections && subjectSwitcher && menuSections.previousElementSibling !== subjectSwitcher) {
    subjectSwitcher.after(menuSections);
  }

  if (menuSections && demoGuide && appMenu && !menuSections.contains(demoGuide)) {
    appMenu.after(demoGuide);
  }

  if (learnScreen && heroSection && !learnScreen.contains(heroSection)) {
    learnScreen.prepend(heroSection);
  }

  if (learnScreen && pathSection && !learnScreen.contains(pathSection)) {
    heroSection && learnScreen.contains(heroSection) ? heroSection.after(pathSection) : learnScreen.prepend(pathSection);
  }

  if (learnScreen && learningTools && !learnScreen.contains(learningTools)) {
    learnScreen.append(learningTools);
  }

  // learnScreen이 workbench를 강제로 안으로 뺏기지 않도록 주석 처리하여 격리 유지
  // if (learnScreen && workbench && !learnScreen.contains(workbench)) {
  //   learnScreen.append(workbench);
  // }

  if (dataScreen && detailEvidence && !dataScreen.contains(detailEvidence)) {
    dataScreen.prepend(detailEvidence);
  }
}

function initializeGradeSelector() {
  const savedGrade = localStorage.getItem(GRADE_STORAGE_KEY);
  if (savedGrade && gradeLabels[savedGrade]) {
    applyGrade(savedGrade);
  } else {
    applyGrade("elementary_6");
  }

  els.gradeButtons.forEach((button) => {
    button.addEventListener("click", () => applyGrade(button.dataset.grade));
  });

  els.changeGradeButton.addEventListener("click", () => {
    els.gradeOverlay.classList.remove("hidden");
  });
}

function applyGrade(grade) {
  localStorage.setItem(GRADE_STORAGE_KEY, grade);
  els.gradeBadge.textContent = gradeLabels[grade] || "학년 선택됨";
  els.gradeOverlay.classList.add("hidden");
}

function setSubjectFilter(subject) {
  selectedSubject = subject || "math";
  const nextIndex = problems.findIndex((problem) => problem.subject === selectedSubject);
  currentProblemIndex = nextIndex >= 0 ? nextIndex : 0;
  els.subjectFilterTabs.forEach((button) => {
    const active = button.dataset.subject === selectedSubject;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  renderQuestion();
}

function getFilteredProblemIndexes() {
  const indexes = problems
    .map((problem, index) => ({ problem, index }))
    .filter(({ problem }) => problem.subject === selectedSubject)
    .map(({ index }) => index);
  return indexes.length ? indexes : problems.map((_, index) => index);
}

function getNextProblemIndex() {
  const indexes = getFilteredProblemIndexes();
  const currentOffset = indexes.indexOf(currentProblemIndex);
  const nextOffset = currentOffset >= 0 ? (currentOffset + 1) % indexes.length : 0;
  return indexes[nextOffset];
}

function setActiveScreen(screenName, options = {}) {
  els.screens.forEach((screen) => {
    const active = screen.dataset.screen === screenName;
    screen.classList.toggle("is-active", active);
    screen.hidden = !active;
  });
  els.menuTabs.forEach((button) => {
    const active = button.dataset.screenTarget === screenName;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  if (options.scroll) {
    document.querySelector(".judge-evidence-sections")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function clearJudgeEvidenceFocus() {
  els.improvementPanel.classList.remove("is-demo-focus");
  els.misconceptionMapPanel.classList.remove("is-demo-focus");
  els.aiDiagnosisCard.classList.remove("is-demo-focus");
  els.sameConceptRetryCard.classList.remove("is-demo-focus");
  els.beforeAfterCard.classList.remove("is-demo-focus");
  els.recommendationTracePanel.classList.remove("is-demo-focus");
}

function loadEvents() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveEvents() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(learningEvents));
}

function applyTodayResetFromUrl(events) {
  const params = new URLSearchParams(window.location.search);
  if (params.get("resetToday") !== "1") return events;

  const today = formatDate(new Date());
  const resetEvents = events.filter((event) => event.reviewedAt !== today);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(resetEvents));
  params.delete("resetToday");
  const nextQuery = params.toString();
  const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
  window.history.replaceState({}, "", nextUrl);
  return resetEvents;
}

function setDemoStage(activeStage) {
  [...els.demoStageList.querySelectorAll("[data-stage]")].forEach((item) => {
    const stage = item.dataset.stage;
    item.classList.toggle("is-active", stage === activeStage);
    item.classList.toggle("is-complete", demoStages.indexOf(stage) < demoStages.indexOf(activeStage));
  });
}

function renderDemoSummary(text) {
  els.demoSummary.textContent = text;
}

function showDemoGuide(step, title, description, progressPercent) {
  els.demoGuideBanner.hidden = false;
  els.demoGuideStep.textContent = `${step}단계 / 5단계`;
  els.demoGuideTitle.textContent = title;
  els.demoGuideDesc.textContent = description;
  els.guideProgressFill.style.width = `${progressPercent}%`;
}

function hideDemoGuide() {
  els.demoGuideBanner.hidden = true;
}

function setAiStatus(status, detail = "") {
  const nextStatus = aiStatusLabels[status] ? status : "idle";
  els.aiStatusText.textContent = aiStatusLabels[nextStatus];
  els.aiStatus.title = detail || aiStatusLabels[nextStatus];
  els.aiStatus.dataset.status = nextStatus;
  els.aiStatus.classList.remove("loading", "waiting", "connected", "fallback");
  els.aiStatus.classList.add(nextStatus === "idle" ? "loading" : nextStatus);
}

function labelDataSource(source) {
  return dataSourceLabels[source] || "추가 기록";
}

function labelAiSource(source) {
  return aiSourceLabels[source] || "도움 기록";
}

function labelRetryReason(reason) {
  return retryReasonLabels[reason] || "비슷한 문제 다시 풀기";
}

function labelDiagnosisTrace(diagnosis) {
  if (diagnosis?.creditPolicy?.cacheHit) return diagnosisTraceLabels.cached_manus_result;
  if (diagnosis?.source === "manus_api") return diagnosisTraceLabels.manus_api_success;
  const reason = diagnosis?.fallbackReason || diagnosis?.aiTrace?.fallbackReason || "offline_rule_based_demo";
  return diagnosisTraceLabels[reason] || "AI 연결 실패로 기본 설명 사용";
}

function consumeLiveAiOnce() {
  return liveAiAlways;
}

function renderLiveAiOnceButton() {
  els.liveAiOnceButton.classList.toggle("is-armed", liveAiAlways);
  els.liveAiOnceButton.textContent = liveAiAlways ? "AI 보조 켜짐" : "기본 설명 모드";
  els.liveAiOnceButton.setAttribute("aria-pressed", String(liveAiAlways));
}

function labelQaStatus(status) {
  return status === "PASS" ? "통과" : "확인 필요";
}

function conceptKoFromId(conceptId) {
  return problems.find((problem) => problem.concept === conceptId)?.conceptKo || conceptId || "개념 대기";
}

function seedDemoEvents() {
  return [
    createLearningEvent({ problem: problems[0], selectedAnswer: 0, mistakeReason: "concept_misunderstanding", dataSource: "demo_seed", now: new Date("2026-05-29") }),
    createLearningEvent({ problem: problems[1], selectedAnswer: 1, mistakeReason: "calculation_error", dataSource: "demo_seed", now: new Date("2026-05-30") }),
    createLearningEvent({ problem: problems[4], selectedAnswer: 0, mistakeReason: "problem_interpretation", dataSource: "demo_seed", now: new Date("2026-05-30") }),
    createLearningEvent({ problem: problems[5], selectedAnswer: problems[5].answer, dataSource: "demo_seed", now: new Date("2026-05-31") }),
  ];
}

function renderQa() {
  const result = validateProblemBank(problems);
  const summary = summarizeProblemBank(problems);
  els.qaStatus.textContent = result.status === "PASS" ? "통과: 문제 준비 완료" : "확인 필요: 문제 수정 필요";
  els.qaCopy.textContent = result.status === "PASS"
    ? `초6 수학 ${problems.length}개 문항의 정답 번호, 해설, 개념 태그가 준비되었습니다.`
    : result.issues.join(" / ");
  renderProblemBankSummary(summary);
}

function renderProblemBankSummary(summary) {
  const metrics = [
    ["문항", summary.problemCount],
    ["준비 완료", summary.vettedCount],
    ["과목", summary.subjectCount],
    ["반복 개념", summary.repeatedConceptGroups],
    ["준비 상태", labelQaStatus(summary.status)],
  ];

  els.problemBankSummary.innerHTML = "";
  metrics.forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "qa-metric";
    const labelEl = document.createElement("span");
    labelEl.textContent = label;
    const valueEl = document.createElement("b");
    valueEl.textContent = String(value);
    item.append(labelEl, valueEl);
    els.problemBankSummary.append(item);
  });

  els.problemBankSubjects.innerHTML = "";
  summary.subjects.forEach((subject) => {
    const li = document.createElement("li");
    li.textContent = `${subject.subjectKo} ${subject.count}개`;
    els.problemBankSubjects.append(li);
  });
}

function renderPresentationPlan() {
  const plan = buildPresentationPlan(problems);
  const studentSteps = [
    ["오답 기록", "틀린 답을 고르면 기록표에 남아요."],
    ["이유 설명", "AI 또는 기본 설명이 왜 틀렸는지 짧게 알려줘요."],
    ["비슷한 문제 준비", "같은 개념 문제를 한 번 더 준비해요."],
    ["다시 풀기", "비슷한 문제를 풀어 이해했는지 확인해요."],
    ["회복 확인", "진행률과 오답 기록이 바뀌는지 봐요."],
  ];

  els.presentationCueList.innerHTML = "";
  studentSteps.forEach(([title, copy], index) => {
    const li = document.createElement("li");
    li.innerHTML = `<b>${index + 1}. ${title}</b><span>${copy}</span>`;
    els.presentationCueList.append(li);
  });

  els.representativeProblems.innerHTML = "";
  const conceptCounts = new Map();
  plan.representativeProblems.forEach((problem) => {
    conceptCounts.set(problem.conceptKo, (conceptCounts.get(problem.conceptKo) || 0) + 1);
  });
  conceptCounts.forEach((count, conceptKo) => {
    const li = document.createElement("li");
    li.innerHTML = `<b>${conceptKo}</b><span>${count}문제 준비됨</span>`;
    els.representativeProblems.append(li);
  });
}

function renderDttTrace() {
  const trace = buildDttTrace();
  els.dttTraceList.innerHTML = "";
  trace.requirements.forEach((requirement) => {
    const li = document.createElement("li");
    const primaryTest = requirement.testRefs[0].replace("tests/concept-master.test.mjs::", "");
    const primaryCode = requirement.codeRefs[0];
    li.innerHTML = `
      <b>${requirement.traceLabel}</b>
      <span>${requirement.definition}</span>
      <em>Test: ${primaryTest}</em>
      <em>Trace: ${primaryCode}</em>
    `;
    els.dttTraceList.append(li);
  });
}

function renderReadinessAudit() {
  const audit = buildReadinessAudit();
  els.readinessAuditList.innerHTML = "";
  audit.milestones.forEach((milestone) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <b>${milestone.traceLabel}</b>
      <span>${milestone.status} · ${milestone.scoreAxis}</span>
      <em>Evidence: ${milestone.evidenceRefs[0]}</em>
      <em>Risk: ${milestone.risks[0]}</em>
    `;
    els.readinessAuditList.append(li);
  });
}

function renderDashboard() {
  const model = buildDashboardModel(learningEvents, problems);
  const review = model.todayReview;
  els.todayReviewTitle.textContent = review?.conceptKo || "오답 기록 필요";
  els.todayReviewCopy.textContent = review?.mistakes
    ? `${review.mistakes}번 틀린 개념입니다. 오늘은 비슷한 문제를 다시 풀어 보세요.`
    : "아직 반복 오답이 적습니다. 새 문제를 풀어 약점 기록을 모으세요.";
  els.improvementRate.textContent = `${model.improvementRate}%`;

  els.topConcepts.innerHTML = "";
  const topConcepts = model.topConcepts.length ? model.topConcepts : [{ conceptKo: "오답 기록 수집 중", mistakes: 0, mistakeRate: 0 }];
  topConcepts.forEach((concept) => {
    const li = document.createElement("li");
    li.innerHTML = `<b>${concept.conceptKo}</b><br>${concept.mistakes}회 오답 · 오답률 ${concept.mistakeRate}%`;
    els.topConcepts.append(li);
  });

  renderReasonBars(model.reasonDistribution);
  renderReasonLegend(model.reasonDistribution);
  renderMasteryList(model.lowMasteryConcepts);
  renderDueReviewConcepts(model.reviewRecommendations);
  renderRecommendationTrace(model.recommendationTrace);
  const misconceptionMap = buildMisconceptionMap(learningEvents, problems);
  renderMisconceptionMap(misconceptionMap);
  renderVisibleEvidenceCards(model, misconceptionMap);
  renderDataEvidence();
  renderEventLog();
  renderGamifiedProgress(model);
  renderQuestProgress(model);
}

function renderVisibleEvidenceCards(model, misconceptionMap) {
  const lastWrongEvent = [...learningEvents].reverse().find((event) => !event.isCorrect);
  const latestClearedEvent = [...learningEvents].reverse().find((event) => event.retryCleared || event.retryResult === "retried_then_cleared");
  const retryRecommendation = lastWrongEvent
    ? recommendNextProblem({
      events: learningEvents,
      problems,
      currentQuestionId: lastWrongEvent.questionId,
    })
    : null;
  const unresolvedMistakes = learningEvents.filter((event) =>
    !event.isCorrect && event.retryResult !== "retried_then_cleared" && event.retryCleared !== true
  ).length;
  const wrongCount = learningEvents.filter((event) => !event.isCorrect).length;
  const topDna = misconceptionMap.concepts[0];

  els.diagnosisCardTitle.textContent = lastWrongEvent?.aiDiagnosis?.conceptGap || lastWrongEvent?.conceptKo || "오답 이유 대기";
  els.diagnosisCardCopy.textContent = lastWrongEvent
    ? `${reasonLabels[lastWrongEvent.mistakeReason] || lastWrongEvent.mistakeReason} · ${lastWrongEvent.aiDiagnosis?.evidence || "학생 선택과 정답 차이를 보고 판단"} · ${labelAiSource(lastWrongEvent.aiSource || lastWrongEvent.aiDiagnosis?.source || "manual")} · ${labelDiagnosisTrace(lastWrongEvent.aiDiagnosis)}`
    : "학생이 먼저 답을 고르면 AI 또는 기본 설명이 왜 틀렸는지 정리해 줍니다.";

  els.retryCardTitle.textContent = retryRecommendation?.problem?.conceptKo || latestClearedEvent?.conceptKo || "다시 풀기 대기";
  els.retryCardCopy.textContent = retryRecommendation?.problem
    ? `${retryRecommendation.problem.reviewStatus === "vetted" ? "준비된 문제" : "선생님 확인 필요"} · ${labelRetryReason(retryRecommendation.reason)}`
    : "오답이 생기면 같은 개념의 다음 문제로 바로 이어집니다.";

  els.beforeMistakeCount.textContent = String(wrongCount);
  els.afterMistakeCount.textContent = String(unresolvedMistakes);
  els.beforeAfterCopy.textContent = topDna
    ? `${topDna.conceptKo}: ${topDna.dominantMisconceptionKo} · 개선률 ${model.improvementRate}%`
    : "다시 풀고 맞히면 남은 오답 수와 개선률이 함께 바뀝니다.";
}

function renderMisconceptionMap(map) {
  if (!els.misconceptionMapList) return;
  els.misconceptionMapList.innerHTML = "";
  const concepts = map.concepts.length
    ? map.concepts
    : [{
      conceptKo: "오답 기록 수집 중",
      dominantMisconceptionKo: "아직 대표 오개념 없음",
      wrongAttempts: 0,
      attempts: 0,
      retryCleared: false,
      nextReviewAt: "",
    }];

  concepts.forEach((concept) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <b>${concept.conceptKo}</b>
      <span>${concept.dominantMisconceptionKo}</span>
      <em>${concept.wrongAttempts}/${concept.attempts} 오답 · 다시 풀기 ${concept.retryCleared ? "성공" : "필요"} · 다음 복습 ${concept.nextReviewAt || "대기"}</em>
    `;
    els.misconceptionMapList.append(li);
  });
}

function focusJudgeEvidence() {
  setActiveScreen("data");
  clearJudgeEvidenceFocus();
  els.improvementPanel.classList.add("is-demo-focus");
  els.misconceptionMapPanel.classList.add("is-demo-focus");
  els.aiDiagnosisCard.classList.add("is-demo-focus");
  els.sameConceptRetryCard.classList.add("is-demo-focus");
  els.beforeAfterCard.classList.add("is-demo-focus");
  els.recommendationTracePanel.classList.add("is-demo-focus");
  els.misconceptionMapPanel.scrollIntoView({ behavior: "smooth", block: "center" });
}

function renderMasteryList(lowMasteryConcepts) {
  els.masteryList.innerHTML = "";
  const concepts = lowMasteryConcepts.length
    ? lowMasteryConcepts
    : [{ conceptKo: "이해도 기록 수집 중", masteryScore: 0, masteryLevel: "fragile", evidence: "0/0 정답" }];

  concepts.forEach((concept) => {
    const li = document.createElement("li");
    li.innerHTML = `<b>${concept.conceptKo}</b><br>${concept.masteryScore}점 · ${masteryLevelLabels[concept.masteryLevel] || concept.masteryLevel} · ${concept.evidence}`;
    els.masteryList.append(li);
  });
}

function renderDueReviewConcepts(dueReviewConcepts) {
  els.todayReviewConcepts.innerHTML = "";
  const concepts = dueReviewConcepts.length
    ? dueReviewConcepts
    : [{ conceptKo: "복습 기록 수집 중", dueCount: 0, mistakeRate: 0 }];

  concepts.slice(0, 3).forEach((concept) => {
    const li = document.createElement("li");
    const reason = recommendationReasonLabels[concept.recommendationReason] || "복습 추천";
    const mastery = Number.isFinite(concept.masteryScore) ? `${concept.masteryScore}점` : "수집 중";
    li.innerHTML = `<b>${concept.conceptKo}</b><br>${reason} · 이해도 ${mastery} · 복습 ${concept.dueCount}개`;
    els.todayReviewConcepts.append(li);
  });
}

function renderRecommendationTrace(recommendationTrace) {
  els.recommendationTrace.innerHTML = "";
  const traces = recommendationTrace.length
    ? recommendationTrace
    : [{
      conceptKo: "추천 근거 수집 중",
      priorityScore: 0,
      traceSummary: "문제를 풀면 이해도, 최근 오답, 복습할 때가 된 개수가 추천 점수로 바뀝니다.",
    }];

  traces.slice(0, 3).forEach((trace) => {
    const li = document.createElement("li");
    li.innerHTML = `<b>${trace.conceptKo}</b><br>${trace.traceSummary}`;
    els.recommendationTrace.append(li);
  });
}

function renderDataEvidence() {
  const payload = buildLearningEvidencePayload(learningEvents, problems);

  els.dataSourceSummary.innerHTML = "";
  payload.dataSources.forEach((source) => {
    const item = document.createElement("div");
    item.className = "data-source-pill";

    const label = document.createElement("span");
    label.textContent = labelDataSource(source.dataSource);
    const count = document.createElement("b");
    count.textContent = String(source.count);
    const role = document.createElement("em");
    role.textContent = source.role;

    item.append(label, count, role);
    els.dataSourceSummary.append(item);
  });

  els.attemptLogPreview.innerHTML = "";
  const attemptRows = payload.attempt_log.length
    ? payload.attempt_log
    : [{
      questionId: "대기",
      conceptId: "오답 기록 수집 중",
      dataSource: "demo_seed",
      isCorrect: false,
      retryCleared: false,
      nextReviewAt: "",
      aiSource: "manual",
    }];

  attemptRows.slice(-6).reverse().forEach((row) => {
    const li = document.createElement("li");
    const answerText = row.isCorrect ? "맞혔어요" : "다시 볼 문제";
    const retryText = row.retryCleared ? "다시 풀기 성공" : "다시 풀기 필요";
    li.innerHTML = `
      <b>${conceptKoFromId(row.conceptId)}</b>
      <span>${answerText} · ${retryText}</span>
      <em>${getMisconceptionLabel(row.misconceptionId)} · 다음 복습 ${row.nextReviewAt || "대기"}</em>
    `;
    els.attemptLogPreview.append(li);
  });

  els.conceptSummaryPreview.innerHTML = "";
  const summaryRows = payload.concept_summary.length
    ? payload.concept_summary
    : [{
      conceptId: "오답 기록 수집 중",
      conceptKo: "개념 대기",
      attempts: 0,
      wrongAttempts: 0,
      wrongRate: 0,
      dominantMisconceptionId: "",
      retryCleared: false,
      dataSources: "demo_seed",
      aiSources: "manual",
    }];

  summaryRows.forEach((row) => {
    const li = document.createElement("li");
    const retryText = row.retryCleared ? "이제 다시 맞히는 중" : "조금 더 연습하기";
    li.innerHTML = `
      <b>${row.conceptKo}</b>
      <span>${row.attempts}번 중 ${row.wrongAttempts}번 다시 봄 · ${retryText}</span>
      <em>${getMisconceptionLabel(row.dominantMisconceptionId)}</em>
    `;
    els.conceptSummaryPreview.append(li);
  });

  els.learningLogJson.textContent = [
    `오늘 볼 기록: ${payload.attempt_log.length}개`,
    `다시 볼 개념: ${payload.concept_summary.length}개`,
    ...payload.dataSources.map((source) => `${labelDataSource(source.dataSource)} ${source.count}개`),
  ].join("\n");
}

function renderReasonBars(distribution) {
  els.reasonBars.innerHTML = "";
  const entries = Object.entries(distribution);
  const total = entries.reduce((sum, [, count]) => sum + count, 0) || 1;
  if (entries.length === 0) {
    els.reasonBars.textContent = "오답 원인이 아직 없습니다.";
    return;
  }

  entries.forEach(([reason, count]) => {
    const row = document.createElement("div");
    row.className = "reason-row";
    row.innerHTML = `
      <span>${reasonLabels[reason] || reason}</span>
      <div class="bar"><span style="width:${Math.round((count / total) * 100)}%"></span></div>
      <b>${count}</b>
    `;
    els.reasonBars.append(row);
  });
}

function renderReasonLegend(distribution) {
  els.legendConceptCount.textContent = String(distribution.concept_misunderstanding || 0);
  els.legendCalcCount.textContent = String(distribution.calculation_error || 0);
  els.legendInterpCount.textContent = String(distribution.problem_interpretation || 0);
}

function renderGamifiedProgress(model) {
  const todayProgress = getTodayQuestProgress(learningEvents);
  els.todaySolvedCount.textContent = `${todayProgress.todayEvents.length}문제`;
  els.todayProgressScore.textContent = `${todayProgress.percent}%`;
}

function renderQuestProgress() {
  const progress = getTodayQuestProgress(learningEvents);

  els.questSolveItem.classList.toggle("completed", progress.solveComplete);
  els.questDiagnoseItem.classList.toggle("completed", progress.diagnoseComplete);
  els.questClearItem.classList.toggle("completed", progress.clearComplete);
  els.questSolveText.textContent = `오늘의 개념 도전 (${progress.displayAttemptCount}/3)`;
  els.questDiagnoseText.textContent = `이유 설명 확인 (${progress.diagnoseComplete ? 1 : 0}/1)`;
  els.questClearText.textContent = `약점 극복 성공 (${progress.clearComplete ? 1 : 0}/1)`;
  els.questProgressFill.style.width = `${progress.percent}%`;
  els.questProgressText.textContent = `${progress.percent}% 완료`;
}

function renderEventLog() {
  els.eventLog.innerHTML = "";
  learningEvents.slice(-3).reverse().forEach((event) => {
    const li = document.createElement("li");
    const answerText = event.isCorrect ? "맞혔어요" : "다시 볼 문제";
    li.innerHTML = `<b>${event.conceptKo}</b><span>${answerText} · 다음 복습 ${event.nextReviewAt || "대기"}</span>`;
    els.eventLog.append(li);
  });
}

function formatConceptHeader(problem) {
  const diffLabels = { bronze: "하", silver: "중", gold: "상" };
  const diffText = diffLabels[problem.difficulty || problem.level] || (problem.difficulty || problem.level);
  
  if (problem.generatedBy === "manus_api") {
    return `✦ AI 맞춤형 문제: ${problem.conceptKo} (난이도: ${diffText})`;
  } else if (problem.generatedBy) {
    return `✦ 맞춤형 문제: ${problem.conceptKo} (난이도: ${diffText})`;
  }
  return `${problem.conceptKo} (난이도: ${diffText})`;
}

function renderQuestion() {
  const problem = problems[currentProblemIndex];
  selectedAnswerIndex = null;
  els.questionConcept.textContent = formatConceptHeader(problem);
  
  els.questionConcept.style.color = "";
  if (problem.generatedBy === "manus_api") {
    els.questionConcept.style.color = "#0070f3"; // Blue for AI
    if (els.quizBubble) {
      els.quizBubble.innerHTML = "같은 개념으로<br>다시 연습해봐!";
    }
  } else {
    if (els.quizBubble) {
      els.quizBubble.innerHTML = "이 문제를<br>풀어봐!";
    }
  }
  
  els.questionText.textContent = problem.question;
  els.quizFeedback.textContent = "";
  els.answerOptions.innerHTML = "";
  els.submitAnswerButton.disabled = true;

  problem.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.className = "answer-option";
    button.type = "button";
    button.innerHTML = `<span>${index + 1}. ${option}</span><span class="option-badge">${index + 1}</span>`;
    button.addEventListener("click", () => selectAnswer(index));
    els.answerOptions.append(button);
  });
  renderGeneratedQaNotice(problem);
}

function selectAnswer(index) {
  selectedAnswerIndex = index;
  [...els.answerOptions.querySelectorAll(".answer-option")].forEach((button, buttonIndex) => {
    button.classList.toggle("selected", buttonIndex === index);
  });
  els.submitAnswerButton.disabled = false;
}

function renderGeneratedQaNotice(problem) {
  if (!problem.generatedBy) {
    els.generatedQaNotice.hidden = true;
    els.generatedQaNotice.textContent = "";
    return;
  }

  const sourceLabel = problem.generatedBy === "manus_api" ? "AI 생성 문항" : "기본 예시 문항";
  const gateStatus = problem.qualityGateStatus || "NEEDS_REVIEW";
  const issueText = problem.qaIssues?.length ? ` · ${problem.qaIssues.join(" / ")}` : "";
  els.generatedQaNotice.hidden = false;
  els.generatedQaNotice.textContent = `${sourceLabel} · ${problem.reviewStatus === "vetted" ? "준비된 문제" : "선생님 확인 필요"} · 준비 ${labelQaStatus(gateStatus)}${issueText}`;
}

async function handleAnswer(selectedAnswer) {
  const problem = problems[currentProblemIndex];
  els.submitAnswerButton.disabled = true;
  if (selectedAnswer === problem.answer) {
    const retryCleared = pendingRetryEventId
      ? markRetryCleared(learningEvents, pendingRetryEventId)
      : null;
    if (retryCleared?.clearedEvent) {
      learningEvents = retryCleared.events;
      latestWrongEvent = retryCleared.clearedEvent;
    }
    const event = createLearningEvent({
      problem,
      selectedAnswer,
      dataSource: "human_trial",
      retryResult: retryCleared?.clearedEvent ? "retried_then_cleared" : undefined,
      now: new Date(),
    });
    pendingRetryEventId = null;
    learningEvents.push(event);
    saveEvents();
    els.quizFeedback.textContent = retryCleared?.clearedEvent
      ? "다시 풀기 성공입니다. 이전 오답이 회복 처리되고 개선률이 갱신되었습니다."
      : "정답입니다. 이 개념은 다음 복습 일정으로 넘어갑니다.";
    renderDashboard();
    return event;
  }

  setAiStatus("waiting");
  els.quizFeedback.textContent = "오답입니다. 틀린 이유를 정리하고 있습니다.";
  const diagnosis = await requestDiagnosis(problem, selectedAnswer, { useLiveAi: consumeLiveAiOnce() });
  const diagnosisTraceLabel = labelDiagnosisTrace(diagnosis);
  setAiStatus(diagnosis.source === "manus_api" ? "connected" : "fallback", diagnosisTraceLabel);
  if (diagnosis.source !== "manus_api") {
    els.quizFeedback.textContent = `${diagnosisTraceLabel}. 이유 찾기는 이어서 진행됩니다.`;
  }
  const event = createLearningEvent({
    problem,
    selectedAnswer,
    mistakeReason: diagnosis.reason,
    aiDiagnosis: diagnosis,
    dataSource: "human_trial",
    now: new Date(),
  });
  learningEvents.push(event);
  latestWrongEvent = event;
  pendingRetryEventId = null;
  saveEvents();
  renderDashboard();
  showDiagnosisModal(problem, selectedAnswer, diagnosis, event);
  els.submitAnswerButton.disabled = false;
  return event;
}

async function requestDiagnosis(problem, selectedAnswer, options = {}) {
  const userApiKey = localStorage.getItem(USER_API_KEY_STORAGE_KEY);
  if (userApiKey) {
    try {
      const client = new ManusAiClient({ apiKey: userApiKey });
      const diagnosis = await diagnoseMistake({
        problem,
        selectedAnswer,
        client,
        timeoutMs: Number(options.timeoutMs || 25_000),
      });
      return diagnosis;
    } catch (error) {
      console.warn("[ConceptMaster] browser direct diagnosis fallback", error);
      return fallbackDiagnosis({
        problem,
        selectedAnswer,
        aiTrace: {
          provider: "browser_direct",
          path: "diagnosis",
          fallbackReason: "browser_api_request_failed",
          message: "브라우저에서 직접 AI 진단 요청 중 오류가 발생하여 기본 설명으로 전환했습니다.",
        },
      });
    }
  }

  if (isStaticHosting) {
    return fallbackDiagnosis({
      problem,
      selectedAnswer,
      aiTrace: {
        provider: "browser",
        path: "diagnosis",
        fallbackReason: "github_pages_static",
        message: "GitHub Pages 정적 배포 모드(서버 없음)로 기본 설명을 제공합니다.",
      },
    });
  }
  try {
    const response = await postJson("/api/diagnose", {
      questionId: problem.id,
      selectedAnswer,
      useLiveAi: options.useLiveAi === true,
    }, options.timeoutMs);
    return response;
  } catch (error) {
    console.warn("[ConceptMaster] browser diagnosis fallback", {
      questionId: problem.id,
      reason: "browser_api_request_failed",
      message: error.message,
    });
    return fallbackDiagnosis({
      problem,
      selectedAnswer,
      aiTrace: {
        provider: "browser",
        path: "diagnosis",
        fallbackReason: "browser_api_request_failed",
      message: "브라우저가 서버 응답을 받지 못해 기본 설명으로 전환했습니다.",
      },
    });
  }
}

async function postJson(url, body, timeoutMs) {
  const controller = timeoutMs ? new AbortController() : null;
  const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller?.signal,
    });
    if (!response.ok) throw new Error("api_failed");
    return await response.json();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function showDiagnosisModal(problem, selectedAnswer, diagnosis, event) {
  els.modalDiagnosisBody.style.display = "block";
  els.modalActionsNormal.style.display = "flex";
  els.modalQuizBody.style.display = "none";
  els.modalActionsQuiz.style.display = "none";
  els.modalQuizFeedback.textContent = "";

  els.selectedAnswer.textContent = problem.options[selectedAnswer];
  els.correctAnswer.textContent = problem.options[problem.answer];
  
  const detailedReasons = {
    concept_misunderstanding: "개념 미이해 (해당 수학 개념의 원리나 공식을 충분히 이해하지 못해 잘못된 풀이를 적용한 경우입니다. 개념 카드를 다시 보며 통분과 연산 규칙을 복습해 보세요.)",
    calculation_error: "계산 실수 (개념은 맞게 잡았으나 연산 과정에서 숫자를 잘못 계산하여 아깝게 틀린 경우입니다. 풀이 과정을 한 번 더 차분히 검산하는 습관이 필요합니다.)",
    problem_interpretation: "문제 해석 오류 (문제 문장에서 구하고자 하는 핵심 조건이나 힌트, 혹은 단위를 잘못 읽어 아예 다른 방향으로 식을 세운 경우입니다. 문제를 꼼꼼히 끝까지 읽는 연습이 필요합니다.)",
    memory_gap: "기억 부족 (이전에 배웠던 선행 지식을 기억해내지 못해 풀이를 완성하지 못한 경우입니다. 최소공배수 등 선수 개념 복습이 요구됩니다.)"
  };
  
  els.diagnosisReason.textContent = detailedReasons[diagnosis.reason] || reasonLabels[diagnosis.reason] || diagnosis.reason;
  els.diagnosisTrace.textContent = labelDiagnosisTrace(diagnosis);
  els.mistakeReasonSelect.value = diagnosis.reason;
  els.diagnosisEvidence.textContent = diagnosis.evidence;
  els.diagnosisRecommendation.textContent = diagnosis.recommendation;
  els.nextReviewDate.textContent = event.nextReviewAt;

  if (typeof els.modal.showModal === "function") {
    els.modal.showModal();
  }
}

function updateLatestMistakeReason() {
  if (!latestWrongEvent) return;
  const reason = els.mistakeReasonSelect.value;
  const nextMisconceptionId = `${latestWrongEvent.conceptId || latestWrongEvent.concept}_${reason}`;
  latestWrongEvent = {
    ...latestWrongEvent,
    mistakeReason: reason,
    misconceptionId: nextMisconceptionId,
  };
  learningEvents = learningEvents.map((event) => event.id === latestWrongEvent.id ? latestWrongEvent : event);
  saveEvents();
  renderDashboard();
}

async function retryLatestConcept() {
  if (!latestWrongEvent) return;
  els.retryConceptButton.disabled = true;
  els.retryConceptButton.textContent = "비슷한 문제 준비 중";
  setAiStatus("waiting");

  let recommendation;
  try {
    recommendation = await requestGeneratedSimilarProblem(latestWrongEvent, { useLiveAi: consumeLiveAiOnce() });
    setAiStatus(recommendation.problem.generatedBy === "manus_api" ? "connected" : "fallback");
  } catch {
    recommendation = recommendNextProblem({
      events: learningEvents,
      problems,
      currentQuestionId: latestWrongEvent.questionId,
    });
    setAiStatus("fallback");
  } finally {
    els.retryConceptButton.disabled = false;
    els.retryConceptButton.textContent = "비슷한 문제 다시 풀기";
  }

  const next = recommendation.problem;
  if (!problems.some((problem) => problem.id === next.id)) problems = [...problems, next];
  currentProblemIndex = problems.findIndex((problem) => problem.id === next.id);
  pendingRetryEventId = latestWrongEvent.id;

  showModalQuiz(next);
}

function showModalQuiz(problem) {
  modalProblem = problem;
  selectedModalAnswerIndex = null;

  els.modalDiagnosisBody.style.display = "none";
  els.modalActionsNormal.style.display = "none";
  
  els.modalQuizBody.style.display = "block";
  els.modalActionsQuiz.style.display = "flex";
  
  els.modalQuestionConcept.textContent = formatConceptHeader(problem);
  els.modalQuestionConcept.style.color = "";
  if (problem.generatedBy === "manus_api") {
    els.modalQuestionConcept.style.color = "#0070f3"; // Blue for AI
  }
  els.modalQuestionText.textContent = problem.question;
  els.modalAnswerOptions.innerHTML = "";
  els.modalQuizFeedback.textContent = "";
  els.modalSubmitAnswerButton.disabled = true;
  els.modalSubmitAnswerButton.textContent = "확인";

  if (problem.generatedBy) {
    const sourceLabel = problem.generatedBy === "manus_api" ? "AI 생성 문항" : "기본 예시 문항";
    const gateStatus = problem.qualityGateStatus || "NEEDS_REVIEW";
    const issueText = problem.qaIssues?.length ? ` · ${problem.qaIssues.join(" / ")}` : "";
    els.modalGeneratedQaNotice.hidden = false;
    els.modalGeneratedQaNotice.textContent = `${sourceLabel} · ${problem.reviewStatus === "vetted" ? "준비된 문제" : "선생님 확인 필요"} · 준비 ${labelQaStatus(gateStatus)}${issueText}`;
  } else {
    els.modalGeneratedQaNotice.hidden = true;
  }

  problem.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.className = "answer-option";
    button.type = "button";
    button.innerHTML = `<span>${index + 1}. ${option}</span><span class="option-badge">${index + 1}</span>`;
    button.addEventListener("click", () => {
      if (els.modalSubmitAnswerButton.textContent === "확인 완료") return;
      selectedModalAnswerIndex = index;
      [...els.modalAnswerOptions.querySelectorAll(".answer-option")].forEach((btn, btnIndex) => {
        btn.classList.toggle("selected", btnIndex === index);
      });
      els.modalSubmitAnswerButton.disabled = false;
    });
    els.modalAnswerOptions.append(button);
  });
}

function handleModalSubmit() {
  if (!modalProblem || selectedModalAnswerIndex === null) return;

  if (els.modalSubmitAnswerButton.textContent === "확인 완료") {
    els.modal.close();
    return;
  }

  const isCorrect = selectedModalAnswerIndex === modalProblem.answer;
  if (isCorrect) {
    const retryCleared = pendingRetryEventId
      ? markRetryCleared(learningEvents, pendingRetryEventId)
      : null;
    if (retryCleared?.clearedEvent) {
      learningEvents = retryCleared.events;
      latestWrongEvent = retryCleared.clearedEvent;
    }
    const event = createLearningEvent({
      problem: modalProblem,
      selectedAnswer: selectedModalAnswerIndex,
      dataSource: "human_trial",
      retryResult: retryCleared?.clearedEvent ? "retried_then_cleared" : undefined,
      now: new Date(),
    });
    learningEvents.push(event);
    pendingRetryEventId = null;
    saveEvents();
    renderDashboard();

    els.modalQuizFeedback.style.color = "#2e7d32";
    els.modalQuizFeedback.textContent = "정답입니다! 오답의 개념 이해가 완전히 회복되었습니다.";
    els.modalSubmitAnswerButton.textContent = "확인 완료";
    els.modalSubmitAnswerButton.disabled = false;
  } else {
    const event = createLearningEvent({
      problem: modalProblem,
      selectedAnswer: selectedModalAnswerIndex,
      dataSource: "human_trial",
      now: new Date(),
    });
    learningEvents.push(event);
    saveEvents();
    renderDashboard();

    els.modalQuizFeedback.style.color = "#c62828";
    els.modalQuizFeedback.textContent = `오답입니다. 해설: ${modalProblem.explanation}`;
    els.modalSubmitAnswerButton.textContent = "확인 완료";
    els.modalSubmitAnswerButton.disabled = false;
  }
}

async function requestGeneratedSimilarProblem(event, options = {}) {
  const userApiKey = localStorage.getItem(USER_API_KEY_STORAGE_KEY);
  if (userApiKey) {
    try {
      const client = new ManusAiClient({ apiKey: userApiKey });
      const sourceProblem = problems.find((p) => p.id === event.questionId);
      const generatedProblem = await generateSimilarProblem({
        sourceProblem,
        diagnosis: event.aiDiagnosis,
        sequence: learningEvents.length + 1,
        client,
        timeoutMs: Number(options.timeoutMs || 25_000),
      });
      return {
        problem: generatedProblem,
        reason: generatedProblem.generatedBy === "manus_api" ? "ai_generated_same_concept" : "fallback_generated_same_concept",
      };
    } catch (error) {
      console.warn("[ConceptMaster] browser direct generation fallback", error);
      const sourceProblem = problems.find((p) => p.id === event.questionId);
      const problem = createTemplateProblem({ sourceProblem, sequence: learningEvents.length + 1 });
      return {
        problem,
        reason: "fallback_generated_same_concept",
      };
    }
  }

  if (isStaticHosting) {
    const sourceProblem = problems.find((p) => p.id === event.questionId);
    const problem = createTemplateProblem({ sourceProblem, sequence: learningEvents.length + 1 });
    return {
      problem,
      reason: "fallback_generated_same_concept",
    };
  }
  const problem = await postJson("/api/generate-similar-problem", {
      questionId: event.questionId,
      diagnosis: event.aiDiagnosis,
      sequence: learningEvents.length + 1,
      useLiveAi: options.useLiveAi === true,
  }, options.timeoutMs);
  return {
    problem,
    reason: problem.generatedBy === "manus_api" ? "ai_generated_same_concept" : "fallback_generated_same_concept",
  };
}

async function runJudgeDemo() {
  els.judgeDemoButton.disabled = true;
  els.judgeDemoButton.textContent = "테스트 진행 중";
  setAiStatus("idle");
  learningEvents = [];
  currentProblemIndex = 0;
  problems = getDefaultJudgeProblems();
  renderQuestion();
  renderGeneratedQaNotice(problems[0]);
  renderDemoSummary("1단계: 자주 틀리는 개념에서 오답을 하나 고릅니다.");
  showDemoGuide(1, "오답 기록하기", "어떤 답을 골랐는지 풀이 기록에 저장합니다.", 20);
  setDemoStage("wrong");
  await delay(500);

  const problem = problems[0];
  const selectedAnswer = 0;
  renderDemoSummary("2단계: AI 또는 기본 설명이 왜 틀렸는지와 다시 볼 개념을 알려줍니다.");
  showDemoGuide(2, "이유 설명", "AI 또는 기본 설명이 오답 이유와 다시 볼 내용을 정리합니다.", 40);
  setDemoStage("diagnosis");
  setAiStatus("waiting");
  const diagnosis = await requestDiagnosis(problem, selectedAnswer, { timeoutMs: DEMO_API_TIMEOUT_MS, useLiveAi: false });
  setAiStatus(diagnosis.source === "manus_api" ? "connected" : "fallback", labelDiagnosisTrace(diagnosis));
  const wrongEvent = createLearningEvent({
    problem,
    selectedAnswer,
    mistakeReason: diagnosis.reason,
    aiDiagnosis: diagnosis,
    dataSource: "judge_demo",
    now: new Date(),
  });
  learningEvents.push(wrongEvent);
  latestWrongEvent = wrongEvent;
  saveEvents();
  renderDashboard();
  showDiagnosisModal(problem, selectedAnswer, diagnosis, wrongEvent);
  await delay(750);
  if (els.modal.open) els.modal.close();

  renderDemoSummary("3단계: 같은 개념을 다시 확인하는 비슷한 문제를 준비합니다.");
  showDemoGuide(3, "비슷한 문제 준비", "같은 개념을 다시 풀 수 있는 문제를 준비하고 확인 상태를 표시합니다.", 60);
  setDemoStage("generation");
  let generatedRecommendation;
  setAiStatus("waiting");
  try {
    generatedRecommendation = await requestGeneratedSimilarProblem(wrongEvent, { timeoutMs: DEMO_API_TIMEOUT_MS, useLiveAi: false });
    setAiStatus(generatedRecommendation.problem.generatedBy === "manus_api" ? "connected" : "fallback");
  } catch {
    generatedRecommendation = {
      problem: createTemplateProblem({ sourceProblem: problem, sequence: 1 }),
      reason: "client_demo_template_fallback",
    };
    setAiStatus("fallback");
  }
  const retryProblem = generatedRecommendation.problem;
  if (!problems.some((item) => item.id === retryProblem.id)) problems = [...problems, retryProblem];
  currentProblemIndex = problems.findIndex((item) => item.id === retryProblem.id);
  renderQuestion();
  renderQa();
  await delay(700);

  renderDemoSummary("4단계: 비슷한 문제를 다시 풀고 맞힙니다.");
  showDemoGuide(4, "다시 풀기 성공", "다시 푼 결과가 이해도 점수와 복습일 계산으로 이어집니다.", 80);
  setDemoStage("retry");
  const successEvent = createLearningEvent({
    problem: retryProblem,
    selectedAnswer: retryProblem.answer,
    dataSource: "judge_demo",
    retryResult: "retried_then_cleared",
    priorSuccessStreak: 0,
    now: new Date(),
  });
  learningEvents = learningEvents.map((event) =>
    event.id === wrongEvent.id ? { ...event, retryResult: "retried_then_cleared", retryCleared: true } : event
  );
  learningEvents.push(successEvent);
  saveEvents();

  renderQuestion();
  renderDashboard();
  await delay(500);

  const model = buildDashboardModel(learningEvents, problems);
  setDemoStage("improvement");
  renderDemoSummary(`5단계 완료: 다시 풀기 성공으로 개선률 ${model.improvementRate}%와 이해도 점수가 갱신되었습니다.`);
  showDemoGuide(5, "회복 확인", "데이터 화면에서 다시 풀기 이후의 개선률과 추천 이유를 확인합니다.", 100);
  if (els.viewDashboardBtn) els.viewDashboardBtn.click();
  focusJudgeEvidence();
  els.quizFeedback.textContent = "테스트 완료: 오답 기록 -> 이유 설명 -> 비슷한 문제 다시 풀기 -> 개선률 갱신";
  els.judgeDemoButton.disabled = false;
  els.judgeDemoButton.textContent = "테스트 다시 시작";
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function initializeApiKeySettings() {
  if (!els.apiKeyInput || !els.saveApiKeyBtn || !els.clearApiKeyBtn) return;

  const savedKey = localStorage.getItem(USER_API_KEY_STORAGE_KEY);
  if (savedKey) {
    els.apiKeyInput.value = savedKey;
    updateApiStatus("connected");
  } else {
    updateApiStatus("disconnected");
  }

  els.saveApiKeyBtn.addEventListener("click", async () => {
    const key = els.apiKeyInput.value.trim();
    if (!key) {
      alert("API Key를 입력해 주세요.");
      return;
    }

    updateApiStatus("checking");
    try {
      const isValid = await verifyManusApiKey(key);
      if (isValid) {
        localStorage.setItem(USER_API_KEY_STORAGE_KEY, key);
        updateApiStatus("connected");
        alert("Manus API 연결에 성공했습니다!");
        renderDashboard();
      } else {
        updateApiStatus("error", "인증 실패");
        alert("유효하지 않은 API Key입니다. 다시 확인해 주세요.");
      }
    } catch (error) {
      console.error(error);
      updateApiStatus("error", "연결 실패");
      alert("Manus API 서버에 연결할 수 없습니다. 네트워크를 확인해 주세요.");
    }
  });

  els.clearApiKeyBtn.addEventListener("click", () => {
    if (confirm("연결된 API Key를 삭제하시겠습니까?")) {
      localStorage.removeItem(USER_API_KEY_STORAGE_KEY);
      els.apiKeyInput.value = "";
      updateApiStatus("disconnected");
      alert("API Key가 삭제되었습니다. 다시 Fallback 모드로 실행됩니다.");
      renderDashboard();
    }
  });
}

function updateApiStatus(status, customText = "") {
  if (!els.apiStatusDot || !els.apiStatusText) return;

  if (status === "connected") {
    els.apiStatusDot.style.background = "#22c55e";
    els.apiStatusText.textContent = "연결 완료";
    els.saveApiKeyBtn.disabled = true;
    els.apiKeyInput.disabled = true;
  } else if (status === "checking") {
    els.apiStatusDot.style.background = "#eab308";
    els.apiStatusText.textContent = "확인 중...";
    els.saveApiKeyBtn.disabled = true;
    els.apiKeyInput.disabled = true;
  } else if (status === "error") {
    els.apiStatusDot.style.background = "#ef4444";
    els.apiStatusText.textContent = customText || "연결 오류";
    els.saveApiKeyBtn.disabled = false;
    els.apiKeyInput.disabled = false;
  } else {
    els.apiStatusDot.style.background = "#64748b";
    els.apiStatusText.textContent = "연결 대기";
    els.saveApiKeyBtn.disabled = false;
    els.apiKeyInput.disabled = false;
  }
}

async function verifyManusApiKey(key) {
  const client = new ManusAiClient({ apiKey: key, requestTimeoutMs: 5000 });
  try {
    await client.getJson("/v2/task.listMessages", { task_id: "test_check" });
    return true; 
  } catch (error) {
    if (error.status === 401) {
      return false;
    }
    if (error.status && error.status !== 401) {
      return true;
    }
    throw error;
  }
}
