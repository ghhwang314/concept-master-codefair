# M4 Submission Alignment Check - 2026-06-09

## Definition

The judge package must match the verified product flow: wrong answer data -> AI/fallback diagnosis -> same-concept retry -> retry success -> data-tab evidence and improvement.

## Test

- `python scripts\execute.py validate`
- Latest result: PASS
- Product tests at M4 checkpoint: 42 PASS / 0 FAIL
- M3 browser evidence: `QA_EVIDENCE/m3_retry_success_browser_check_20260608.json`

## Trace

Updated judge-facing artifacts:

- `SUBMISSION_PACKAGE.md`
- `SUBMISSION_DOCS/작품요약서_건호_대상형_초안_20260608.md`
- `SUBMISSION_DOCS/작품설명서_건호_대상형_초안_20260608.md`
- `SUBMISSION_DOCS/붙여넣기_가이드_건호_20260608.md`
- `SUBMISSION_DOCS/심사기준_자가점검_건호_20260608.md`
- `README.md`
- `HANDOFF_GEONHO.md`
- `src/readinessAudit.js`
- `tests/concept-master.test.mjs`

## Checks

- 30-second demo wording now references the current retry-success evidence.
- 2-minute script explains AI as wrong-answer-data diagnosis, not answer outsourcing.
- Judge Q&A includes the "AI did not solve it for the student" boundary.
- Submission docs used the M4 checkpoint 42 PASS baseline; the current M6 gate baseline is now 44 PASS.
- Submission docs cite the M3 browser proof where the retry success marks the previous wrong answer as recovered and shows improvement at 50%.
- Human-Verified, customer-ready, deployed, and award-guarantee claims remain absent from judge-facing completion language.

## Live Boundary

- publish_upload_delete_browser_write_opened: false
- browser_or_vm_authority_opened: false
- provider_default_changed: false
- training_run_performed: false
- git_stage_commit_push_performed: false
