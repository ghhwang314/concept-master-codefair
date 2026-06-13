# 15-Minute Local Handoff

Purpose: let Geonho, Codex, Gemini Antigravity, or another local developer run and continue ConceptMaster without rebuilding the project from chat.

Status boundary:

- Current target baseline after M6 gate hardening: `npm test` = `44 PASS / 0 FAIL`.
- Auto-Verified means deterministic tests and local browser evidence passed.
- Human-Verified is still false until `GEONHO_HUMAN_TRIAL_CHECKLIST.md` is filled after a real Geonho or owner run.
- This is a local customer/contest handoff candidate, not a deployed customer-ready product.

## 0-3 Minutes: Validate The Repo

Run from `D:\Codex\products\concept-master-codefair`:

```powershell
npm test
python scripts\execute.py validate
```

Expected evidence:

- `reports/token_harness/latest_status.v1.json`
- `reports/dtt_baseline/M0_BASELINE_STATUS.v1.json`
- `reports/api_environment/M2_API_ENVIRONMENT_STATUS.v1.json`

If either command fails, fix only the first concrete failure before editing UI or adding features.

## 3-6 Minutes: Set Environment

```powershell
Copy-Item .env.example .env
notepad .env
```

Put the real key only in `.env`. Keep this default unless a single live check is required:

```text
MANUS_CREDIT_SAVER_MODE=true
```

Rules:

- Do not paste real keys into chat, screenshots, docs, HTML, browser JavaScript, or zip files.
- The browser must never contain `MANUS_API_KEY` or `Bearer `.
- The app still works without Manus through `rule_based_fallback`.
- The top-bar `AI 1회 사용` button arms one live call, then returns to credit saver behavior.

## 6-9 Minutes: Run The App

```powershell
npm start
```

Open:

```text
http://localhost:4173
```

Use the menu tabs in this order:

1. `학습`: solve or run the demo.
2. `30초 데모`: show the judge loop.
3. `데이터`: show `attempt_log`, `concept_summary`, problem QA, and improvement.
4. `연구근거`: show DTT and P0-P6 readiness evidence.

## 9-12 Minutes: Judge Demo Check

Click `심사용 데모 시작`.

The visible loop must be:

```text
wrong answer -> AI/fallback diagnosis -> same-concept retry -> previous wrong marked recovered -> improvement rate shown
```

Known M3 evidence:

- `QA_EVIDENCE/m3_retry_success_browser_check_20260608.json`
- `QA_EVIDENCE/m3_retry_success_data_tab_20260608.png`

## 12-15 Minutes: Continue Safely

Read next:

- `docs/PROBLEM_ADDITION_GUIDE.md`
- `docs/API_ENVIRONMENT.md`
- `docs/AGENT_CONTINUATION_PROMPT.ko.md`
- `HANDOFF_GEONHO.md`
- `trial_records/README.md`

M6 record helper:

```powershell
npm run trial:start -- --tester Geonho
npm run trial:status
npm run trial:prepare -- --tester Geonho
npm run trial:validate -- --record trial_records\<record-file>.json
```

Use `trial:start` first when Geonho or the owner is about to test. It prints the record path, app URL, server command, checklist path, and validation command while keeping `human_verified: false`.
Use `trial:status` any time to see whether M6 is still waiting, needs record completion, or is Human-Verified by the validator.

Before changing behavior, write one DTT slice:

```text
Definition: what should change
Test: what proves it
Trace: which code/doc/evidence records it
```

Stop rule: if the same command route fails 5 times, or the same browser route times out twice, stop and report the exact failing route, blocker string, current passed evidence, and one next safe action.

## Evidence Map

- M0/M1 baseline: `reports/dtt_baseline/M0_BASELINE_STATUS.v1.json`
- M2 API boundary: `reports/api_environment/M2_API_ENVIRONMENT_STATUS.v1.json`
- M3 retry success: `QA_EVIDENCE/m3_retry_success_browser_check_20260608.json`
- M4 judge package: `QA_EVIDENCE/m4_submission_alignment_check_20260609.md`
- M5 handoff package: `QA_EVIDENCE/m5_handoff_alignment_check_20260609.md`
- M6 human trial: `GEONHO_HUMAN_TRIAL_CHECKLIST.md` plus a validated `trial_records/*.json` record remains pending until real use is recorded.
- Handoff zip scan: `dist/package_scan.v1.json`

Zip build:

```powershell
npm run package:handoff
```
