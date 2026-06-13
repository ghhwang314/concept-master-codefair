# M6 Human Trial Gate Check

Generated at: 2026-06-09

## Definition

M6 Human-Verified must require an actual Geonho or owner trial record, not a blank checklist or assistant claim.

## Test

- Template gate command: `python scripts\validate_human_trial_record.py --record trial_records\human_trial_record.template.v1.json --mode template`
- Trial start command: `npm run trial:start -- --tester Geonho`
- Trial status command: `npm run trial:status`
- Record prepare command: `npm run trial:prepare -- --tester Geonho`
- Handoff package command: `npm run package:handoff`
- Handoff zip smoke command: `npm run package:smoke`
- Test contract: `tests/concept-master.test.mjs::M6 human trial validator blocks templates and accepts only recorded trial evidence`
- Harness command: `python scripts\execute.py validate`
- `npm test`: `44 PASS / 0 FAIL`
- `python scripts\execute.py validate`: `PASS`
- `npm run trial:validate-template`: `PASS`, `human_verified: false`
- `npm run trial:start -- --tester Geonho --date-time 2026-06-09T19:10:00+09:00 --output-dir <temp> --label geonho-start`: `PASS`, generated start packet with record path, app URL, checklist path, validation command, and `human_verified: false`
- `npm run trial:status`: reports `WAITING_FOR_TRIAL_RECORD`, `NEEDS_RECORD_COMPLETION`, or `HUMAN_VERIFIED` while reusing the same trial validator boundary.
- `python scripts\prepare_human_trial_record.py --tester Geonho --date-time 2026-06-09T19:00:00+09:00 --output-dir <temp> --label smoke`: `PASS`, generated `RECORDED` file with `human_verified: false`
- `npm run package:handoff`: `PASS`
- Handoff zip: latest path recorded in `dist/package_scan.v1.json`
- Package scan: `dist/package_scan.v1.json` reports required files present, `.env` absent, server logs absent, secret-like hits absent.
- Extracted zip smoke: `QA_EVIDENCE/m6_handoff_zip_smoke_20260609.json` reports `PASS`, including extracted `npm test`, trial template validation, trial record preparation, `trial:start` packet generation, `trial:status` pending-state report, root page load, and fallback `/api/diagnose`.
- Strict token harness validation: `PASS`
- Expected current state: template gate passes, but `human_verified` remains false.
- Negative gate: the blank template fails in `trial` mode.
- Positive gate: a complete recorded PASS fixture validates with `human_verified: true`.

## Trace

- Human checklist: `GEONHO_HUMAN_TRIAL_CHECKLIST.md`
- Trial record template: `trial_records/human_trial_record.template.v1.json`
- Record preparation helper: `scripts/prepare_human_trial_record.py`
- Human trial start packet helper: `scripts/start_human_trial.py`
- Human trial status helper: `scripts/status_human_trial.py`
- Handoff zip smoke helper: `scripts/smoke_handoff_zip.py`
- Validator: `scripts/validate_human_trial_record.py`
- Harness integration: `scripts/execute.py::human_trial_template_gate`
- Test integration: `tests/concept-master.test.mjs`
- Latest harness report: `reports/token_harness/latest_status.v1.json`
- Latest package scan: `dist/package_scan.v1.json`

## Boundary

- Auto-Verified can pass before a real trial.
- Human-Verified cannot pass from the template.
- A real trial record must be copied from the template, filled after actual use, and validated in `trial` mode.
- Live boundary opened: false.
