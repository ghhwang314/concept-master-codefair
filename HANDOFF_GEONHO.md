# ConceptMaster Geonho Handoff

## What This Is

ConceptMaster is a CodeFair demo app for:

> AI 오답 코치: 오답 데이터를 바탕으로 AI가 약점 개념과 복습 순서를 추천하는 맞춤 재학습 시스템

The core idea should stay the same: students often repeat the same concept mistake, not the same exact question.

## Current Status

- Web app runs locally at `http://localhost:4173`.
- `npm test` current M6 baseline is `44 PASS / 0 FAIL`.
- The app has a server-only Manus API adapter.
- If Manus is missing, slow, or fails, the app falls back to deterministic rule-based diagnosis.
- The browser must never receive the Manus API key.
- The top bar shows AI status: waiting for Manus, Manus API connected, or fallback mode.
- The judge flow is scoped to six vetted elementary grade-6 math problems.
- The data screen shows `attempt_log`, `concept_summary`, source separation, problem-bank QA evidence, and recommendation trace.
- The demo screen shows six elementary math representative problems and the 2-minute presentation cue cards from `src/presentationPlan.js`.
- The research screen shows a DTT score trace from `src/dttTrace.js`: each contest claim is linked to a test, code path, and evidence document.
- The research screen shows a P0-P6 readiness audit from `src/readinessAudit.js`: current baseline, GitHub absorption, learning engine, AI quality, UX, submission package, and handoff status.
- Geonho's original one-page visual shell is now the visible app exterior: `assets/coach_*.png`, mascot panels, speech bubbles, grade selector overlay, XP/gem/streak header, subject filter tabs, green submit button, mini chart, daily quest panel, QA side panel, and demo guide banner.
- Latest scoring, AI/fallback, DTT, readiness, M5 log evidence, and GitHub evidence are visible through the menu screens without widening the product beyond elementary math.
- Codex in-app browser visual QA: `D:\Codex\reports\concept_master_codefair\geonho_original_visual_iab_20260607\geonho_original_visual_iab_qa.v1.json` reports `PASS`.
- Latest live API evidence is in `LIVE_MANUS_VERIFICATION.md`: diagnosis fallback, generation Manus path.
- Latest M6 handoff zip should be built with `npm run package:handoff`; scan evidence is written to `dist/package_scan.v1.json`.

## M0-M5 Evidence Snapshot

- M0/M1 baseline and handoff harness: `reports/dtt_baseline/M0_BASELINE_STATUS.v1.json`
- M2 Manus API/environment boundary: `reports/api_environment/M2_API_ENVIRONMENT_STATUS.v1.json`
- M3 retry success browser proof: `QA_EVIDENCE/m3_retry_success_browser_check_20260608.json`
- M4 judge package alignment: `QA_EVIDENCE/m4_submission_alignment_check_20260609.md`
- M5 run/modify handoff: `docs/HANDOFF_15_MIN.md`, `docs/PROBLEM_ADDITION_GUIDE.md`, `docs/AGENT_CONTINUATION_PROMPT.ko.md`, and `QA_EVIDENCE/m5_handoff_alignment_check_20260609.md`
- M6 Human-Verified gate: pending until `GEONHO_HUMAN_TRIAL_CHECKLIST.md` is filled after a real run.

## How To Run

Fast handoff path:

```text
docs/HANDOFF_15_MIN.md
```

Direct commands:

```powershell
npm install
npm test
Copy-Item .env.example .env
notepad .env
npm start
```

Open:

```text
http://localhost:4173
```

## Manus API Setup

Do not put the API key in HTML or browser JavaScript.

Put it only in `.env`:

```text
Use the MANUS_API_KEY variable with the real value only inside the local .env file.
MANUS_API_BASE_URL=https://api.manus.ai
MANUS_AGENT_PROFILE=manus-1.6-lite
MANUS_REQUEST_TIMEOUT_MS=15000
MANUS_POLL_INTERVAL_MS=2000
MANUS_MAX_POLLS=30
MANUS_DIAGNOSIS_TIMEOUT_MS=90000
```

`.env` is intentionally excluded from the handoff zip. The real key should be shared separately and rotated after public demos.

## Files To Study First

- `src/server.mjs`: static server and `/api/diagnose` route.
- `src/manusClient.js`: Manus v2 task API adapter.
- `src/diagnosis.js`: Manus success path plus fallback.
- `src/learning.js`: learning events, concept stats, review scheduling.
- `src/problems.js`: vetted problem bank and same-concept retry logic.
- `src/presentationPlan.js`: six representative problems and the 2-minute script contract.
- `src/dttTrace.js`: Definition -> Test -> Trace map for attempt data, AI diagnosis, retry, QA, mastery/review, and judge demo.
- `src/readinessAudit.js`: P0-P6 readiness evidence map, including the 44 PASS baseline and pending Human-Verified boundary.
- `docs/HANDOFF_15_MIN.md`: 15-minute run, env, demo, and continuation checklist.
- `docs/PROBLEM_ADDITION_GUIDE.md`: safe vetted problem addition rules and required tests.
- `docs/AGENT_CONTINUATION_PROMPT.ko.md`: compact DTT continuation prompt for Codex or Gemini Antigravity.
- `trial_records/human_trial_record.template.v1.json`: M6 machine-readable trial record template.
- `scripts/prepare_human_trial_record.py`: creates a dated trial record before Geonho or the owner runs the checklist.
- `scripts/start_human_trial.py`: creates a trial session packet with record path, app URL, server command, checklist path, and validation command.
- `scripts/status_human_trial.py`: reports whether M6 is waiting for a record, needs completion, or is Human-Verified by validator evidence.
- `scripts/validate_human_trial_record.py`: validates real M6 trial records without exposing API keys.
- `scripts/package_handoff.py`: creates a secret-free handoff zip with M6 scripts and trial templates included.
- `assets/coach_*.png`: Geonho visual shell assets. Keep them, but never copy `.env` from the external zip.
- `src/app.js`: browser UI, problem-bank evidence panel, and judge demo flow.
- `tests/concept-master.test.mjs`: acceptance tests.
- `LIVE_MANUS_VERIFICATION.md`: public-safe live API result, without the Manus key.
- `GEONHO_HUMAN_TRIAL_CHECKLIST.md`: student-use gate for npm test, browser load, AI status, 30-second demo, `attempt_log`, `concept_summary`, improvement rate, and Geonho's explanation.

## Current Demo Flow

1. Press `심사용 데모 시작`.
2. The app records an intentional wrong answer.
3. Manus or fallback diagnoses the mistake.
4. The app recommends another problem with the same concept.
5. The AI status label shows waiting, connected, or fallback while the diagnosis/generation steps run.
6. The demo finishes on the data screen, then shows weakness, repeated mistake TOP3, review concept, problem-bank QA evidence, recommendation trace, cause distribution, and improvement evidence.

## Next Work Priority

1. Run `GEONHO_HUMAN_TRIAL_CHECKLIST.md` with Geonho and record PASS/FAIL.
2. Run `npm run trial:start -- --tester Geonho`, start the app, fill the copied record after actual use, and run the printed `trial:validate` command.
3. Run `npm run trial:status` to confirm whether M6 is still pending or Human-Verified.
4. Prepare a deployable version without exposing `.env`.
5. Re-run the live Manus check once before the actual presentation; if diagnosis is still fallback, present fallback as the safe demo path instead of retrying repeatedly.
6. Have Geonho practice the six representative problems and 2-minute cue cards aloud.
7. Rebuild the handoff zip with `npm run package:handoff` before sharing files.

## M5/M6 Boundary

- M5 means another local developer can run and modify the repo in 15 minutes with tests and docs.
- M6 means Geonho or the owner actually runs the checklist and records PASS/FAIL.
- Do not say Human-Verified, customer-ready, deployed, or award-ready until M6 and delivery gates are actually recorded.

## Gemini Antigravity Prompt

```text
You are continuing ConceptMaster, a Korean CodeFair web app. Keep the existing idea unchanged: AI 오답 코치, a system that stores wrong-answer data and recommends weak concepts, review order, and same-concept retry problems.

Open the project, run npm test first, and preserve all existing tests. Do not put MANUS_API_KEY in HTML or browser JS. The key belongs only in .env and server code.

Improve the app in this order:
1. Preserve the judge-facing elementary grade-6 math scope.
2. Add tests for any new math problem: subject, concept, level, options, answer index, explanation.
3. Keep the visible AI status label working: Manus API connected, fallback mode, or loading.
4. Keep the judge demo safe under 30 seconds: wrong answer, AI diagnosis, same-concept retry, success, dashboard improvement.
5. Do not add friend, XP, tier, or decoration before the evidence screens are strong.

Acceptance criteria:
- npm test passes with the current M5 baseline.
- Manus key is never exposed to frontend files.
- The app works without Manus through fallback.
- With Manus key configured, /api/diagnose can return source=manus_api.
- The visible AI status label does not stay stuck on loading after the demo finishes.
- The judge flow remains elementary grade-6 math.
- The data screen shows `attempt_log`, `concept_summary`, and the problem-bank QA evidence panel.
- The first screen clearly shows 오늘의 AI 약점 진단, 반복 오답 개념 TOP3, 재학습 후 오답률 변화, 오늘 복습할 개념, and 오답 원인 분포.
```
