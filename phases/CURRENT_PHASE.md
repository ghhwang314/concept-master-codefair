# Current Phase

## Objective

Advance M6 human trial: have Geonho or the owner run the app from the current M5 handoff, record PASS/FAIL evidence in `GEONHO_HUMAN_TRIAL_CHECKLIST.md`, and keep Human-Verified false unless the checklist is actually completed.

## Scope

- M0/M1 baseline and handoff harness are Auto-Verified in `reports/dtt_baseline/M0_BASELINE_STATUS.v1.json`.
- M2 API/environment boundary is Auto-Verified in `reports/api_environment/M2_API_ENVIRONMENT_STATUS.v1.json`.
- M3 learning product flow is Auto-Verified by `QA_EVIDENCE/m3_retry_success_browser_check_20260608.json`.
- M4 judge package alignment is Auto-Verified by `QA_EVIDENCE/m4_submission_alignment_check_20260609.md`.
- M5 run/modify handoff is Auto-Verified by `QA_EVIDENCE/m5_handoff_alignment_check_20260609.md`.
- Work only on human-trial recording, trial blockers, and narrow fixes found by the checklist unless a lower milestone regresses.
- Keep the menu UI: `학습 / 30초 데모 / 데이터 / 연구근거`.
- Do not claim `Human-Verified`, customer-ready, deployed, or award-ready until a real student trial and explicit delivery gate exist.

## Read First

1. `.claude/commands/harness.md`
2. `reports/token_harness/latest_status.v1.json`
3. `reports/dtt_baseline/M0_BASELINE_STATUS.v1.json`
4. `reports/api_environment/M2_API_ENVIRONMENT_STATUS.v1.json`
5. `QA_EVIDENCE/m3_retry_success_browser_check_20260608.json`
6. `QA_EVIDENCE/m4_submission_alignment_check_20260609.md`
7. `QA_EVIDENCE/m5_handoff_alignment_check_20260609.md`
8. `README.md`
9. `HANDOFF_GEONHO.md`
10. `docs/HANDOFF_15_MIN.md`
11. `docs/PROBLEM_ADDITION_GUIDE.md`
12. `GEONHO_HUMAN_TRIAL_CHECKLIST.md`
13. `trial_records/human_trial_record.template.v1.json`
14. `scripts/validate_human_trial_record.py`
15. `scripts/prepare_human_trial_record.py`

## Harness Command

```powershell
python scripts/execute.py validate
```

## Done Criteria

- [ ] `GEONHO_HUMAN_TRIAL_CHECKLIST.md` is filled with date/time, tester, npm test result, browser load result, AI status, demo result, data evidence, and Geonho explanation.
- [ ] A dated record is prepared with `npm run trial:prepare -- --tester Geonho`.
- [ ] A copied `trial_records/*.json` record validates with `python scripts\validate_human_trial_record.py --record trial_records\<record-file>.json --mode trial`.
- [ ] Trial notes say whether the 30-second demo reached the data screen and what improvement rate was shown.
- [ ] The explanation gate distinguishes "AI helped diagnose and recommend" from "AI solved the problem for me".
- [ ] Any issue found during trial is recorded as a concrete blocker with one next action.
- [ ] If the checklist is not actually filled, Human-Verified remains false.
- [ ] `python scripts/execute.py validate` returns PASS after any code change.
- [ ] Live-boundary flags remain false for publish/upload/delete/browser-write/provider/training/git.

## Live Boundary

- publish_upload_delete_browser_write_opened: false
- browser_or_vm_authority_opened: false
- provider_default_changed: false
- training_run_performed: false
- git_stage_commit_push_performed: false

## Next Action

Run `GEONHO_HUMAN_TRIAL_CHECKLIST.md` with Geonho or the owner. If the run is not available yet, stop at Auto-Verified and report that M6 is waiting for real human-use evidence.
