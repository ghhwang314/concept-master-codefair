# ConceptMaster CodeFair

AI 오답 코치: 오답 데이터를 바탕으로 AI가 약점 개념과 복습 순서를 추천하는 맞춤 재학습 시스템.

## Product Scope

ConceptMaster is not a generic quiz generator. It is a wrong-answer learning loop:

1. The student solves a problem and the app stores the attempt.
2. Manus API diagnoses the likely mistake reason.
3. The app generates or recommends a same-concept retry problem.
4. The dashboard updates concept error rate, mastery score, repeated mistake concepts, reason distribution, and improvement evidence.
5. The judge flow is narrowed to six vetted elementary grade-6 math problems, with repeated concept groups for same-concept retry.
6. The data screen exposes `attempt_log`, `concept_summary`, problem-bank QA, and recommendation trace so judges can see both data coverage and why a concept was selected.
7. The research screen exposes a DTT score trace so judges can connect each contest claim to a test, code path, and submission artifact.

This keeps the CodeFair story focused on data and AI: wrong-answer data becomes a concrete intervention, and retry evidence shows whether understanding improved.

## DTT Score Trace

ConceptMaster uses DTT as `Definition -> Test -> Trace`, not as repetitive low-value testing. The trace is implemented in `src/dttTrace.js` and rendered on the research screen through `#dtt-trace-list`.

The six locked requirements are:

- attempt data
- AI diagnosis
- same-concept retry
- QA gate
- mastery and review update
- 30-second judge demo and 2-minute presentation script

Each item points to a matching acceptance test, implementation file, and evidence document so the project reads as a measured AI learning loop instead of a generic quiz app.

## P0-P6 Readiness Audit

The research screen also renders `src/readinessAudit.js` through `#readiness-audit-list`.
It separates the current `44 PASS` Auto-Verified baseline from the still-pending Human-Verified student trial, and maps P0-P6 to evidence, risks, and the next action.

## Geonho Visual Shell

Geonho's original one-page visual shell is the visible UI: grade selector overlay, XP/gem/streak header, mascot cards, evidence grid, subject filter tabs, green submit button, QA side panel, mini chart, and daily quest panel.
The latest ConceptMaster data, AI, DTT, readiness audit, Manus boundary, and tests remain wired underneath through hidden support nodes so the user-facing exterior stays Geonho's original shape.
Latest Codex in-app browser QA evidence is recorded at `D:\Codex\reports\concept_master_codefair\geonho_original_visual_iab_20260607\geonho_original_visual_iab_qa.v1.json`.

## Run

```powershell
npm test
Copy-Item .env.example .env
# Edit .env and put the real MANUS_API_KEY there.
npm start
```

Open `http://localhost:4173`.

For a 15-minute Codex, Gemini Antigravity, or local developer handoff, read `docs/HANDOFF_15_MIN.md` first. For safe problem-bank edits, read `docs/PROBLEM_ADDITION_GUIDE.md`. For a compact continuation prompt under 4000 characters, use `docs/AGENT_CONTINUATION_PROMPT.ko.md`.

## Manus API Boundary

- `MANUS_API_KEY` is read only by `src/server.mjs` through `.env` or process environment.
- `ManusAiClient` calls the Manus v2 task API through `https://api.manus.ai/v2/task.create` and polls `task.listMessages`.
- `MANUS_CREDIT_SAVER_MODE=true` is the default local setting. In this mode `/api/diagnose` and `/api/generate-similar-problem` use deterministic fallback unless the browser sends `useLiveAi: true`.
- The top-bar `AI 1회 사용` button arms exactly one live AI request. After that request, the app returns to credit saver mode.
- Server-side in-memory caches reuse the same live diagnosis or generated problem for the same input so repeated local testing does not spend extra credits.
- The browser never receives the API key.
- If Manus API is missing, slow, or invalid, the app uses deterministic diagnosis and template problem fallback so the judge demo remains available.
- The judge demo sends `useLiveAi: false` so repeated presentation practice does not spend Manus credits.
- The top bar and diagnosis modal show whether the app used live Manus, cached Manus, credit saver fallback, or another fallback reason.
- Latest local live check is recorded in `LIVE_MANUS_VERIFICATION.md`: diagnosis finished as `rule_based_fallback`, similar-problem generation finished as `manus_api`.

## Generated Problem QA Gate

Every AI or fallback generated retry problem is kept as `reviewStatus: "needs_review"` until a human checks it. The quality gate requires:

- `conceptId`
- `difficulty`
- `question`
- `options`
- `answer`
- `explanation`
- `hint`
- `sourceReason`

Render-unsafe AI output falls back to a safe template problem and keeps the rejection reason in `qaIssues`.

The full source problem bank still keeps earlier vetted examples, but the judge-facing flow is scoped to elementary grade-6 math through `getDefaultJudgeProblems()`. The data screen renders `attempt_log`, `concept_summary`, and `summarizeProblemBank`, so the judge-facing UI is tied to the actual problem data.

## Adding Problems

Use `docs/PROBLEM_ADDITION_GUIDE.md` before editing `src/problems.js`.
Vetted source problems need a unique `id`, subject labels, concept labels, `level`, `question`, `options`, zero-based `answer`, and `explanation`.
If a new concept should appear in the CodeFair judge demo, add at least two vetted elementary math problems for that concept so same-concept retry can work, then rerun:

```powershell
npm test
python scripts\execute.py validate
```

## Review Recommendation Logic

The "오늘 복습할 개념" list is ranked from three signals:

- low `masteryScore`
- recent wrong answers
- due review count from the vendored `ts-fsrs` scheduler with a 7-day MVP cap

`recommendationTrace` shows the score factors behind the top concepts: mastery gap, recent wrong-answer boost, due-review boost, and cumulative mistake boost. This keeps the recommendation explainable for CodeFair judges while still showing the OATutor/pyBKT and FSRS direction.

## Upstream Code Use

The project now directly vendors `ts-fsrs@5.4.1` from `open-spaced-repetition/ts-fsrs`:

- Vendored runtime: `src/vendor/ts-fsrs/index.mjs`
- License copy: `src/vendor/ts-fsrs/LICENSE`
- Local adapter: `src/reviewScheduler.js`

ConceptMaster uses the upstream FSRS scheduler for correct-answer review dates with `enable_short_term: false` and `enable_fuzz: false`. The MVP caps review intervals at 7 days so a CodeFair judge can understand and demo the loop quickly. Wrong answers still stay on same-day retry because the product goal is immediate same-concept repair.

## GitHub Research Applied

The GitHub research was applied as a small tutor data structure instead of a large new dependency. OATutor's problem-to-skill model is reflected in `buildProblemConceptMap()`:

- every judge problem maps to one concept id
- every concept has repeated vetted problems for same-concept retry
- generated problems stay outside judge-source evidence until human review
- each concept has a default misconception id for `attempt_log` and `concept_summary`

`pyBKT`, `mathdial`, and Khan's tutoring accuracy dataset remain research references for the explanation and future evaluation direction. They are not imported into the runtime, so the CodeFair demo stays small enough for an elementary student to explain.

## Non-goals Before Submission

- Friend features, ranks, XP, or social sharing.
- A general chatbot.
- Large-scale LMS accounts or teacher admin screens.
- Claiming that AI fully solves learning. The app shows AI-assisted diagnosis and review, with generated problems marked `needs_review`.

## CodeFair Demo Flow

1. Click `심사용 데모 시작`.
2. The app records an intentional wrong answer.
3. AI/fallback diagnosis explains the likely mistake reason.
4. The app recommends or generates a same-concept retry problem.
5. The demo finishes on the data screen so judges immediately see improvement evidence and the recommendation trace.
6. The AI status label shows live Manus waiting/connected/fallback state during the flow.
7. The dashboard shows concept mistake data, mastery score, today's review concepts, improvement evidence, `attempt_log`, `concept_summary`, and problem-bank QA coverage.
8. The recommendation trace explains the top concept with score factors, not a hidden AI claim.
9. The demo screen includes 2-minute cue cards and six elementary math representative problems tied to real problem IDs.

The first screen also includes a 30-second judge demo rail:

`틀림 기록 -> AI 진단 -> 유사문항 생성 -> 재도전 -> 개선률 상승`

Submission writing support is in `SUBMISSION_PACKAGE.md`.

## Human Trial Gate

Before calling the demo Human-Verified, run `GEONHO_HUMAN_TRIAL_CHECKLIST.md`.
It records `npm test`, browser load, AI status, the 30-second demo, improvement rate, `attempt_log`, `concept_summary`, and Geonho's own explanation of why features were built, what changed, and what AI helped with.

Machine-readable M6 trial flow:

```powershell
npm run trial:start -- --tester Geonho
npm run trial:status
npm run trial:prepare -- --tester Geonho
npm run trial:validate -- --record trial_records\<record-file>.json
```

`trial:start` creates a dated record plus the app URL, server command, checklist path, and validation command for the real student run. It does not start Human-Verified status by itself.
`trial:status` reports whether M6 is `WAITING_FOR_TRIAL_RECORD`, `NEEDS_RECORD_COMPLETION`, or `HUMAN_VERIFIED`.

The prepared record starts as `human_verified: false`; it becomes Human-Verified evidence only after actual use is filled and the trial validator passes.

Keep `.env` out of any zip or public handoff. Use `.env.example` for setup instructions.
Build a fresh local handoff zip with:

```powershell
npm run package:handoff
```

The package scan is written to `dist/package_scan.v1.json` and must show `.env` absent before sharing.
