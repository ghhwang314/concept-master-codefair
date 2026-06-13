# Human Trial Records

This folder stores Geonho or owner trial records for M6.

Current boundary:

- `human_trial_record.template.v1.json` is a template only.
- It does not make the project Human-Verified.
- Prepare a dated real trial record with:

```powershell
npm run trial:prepare -- --tester Geonho
```

- Fill that copied file after actual use, then validate it with:

```powershell
npm run trial:validate -- --record trial_records\<record-file>.json
```

Pass rule:

- A structurally valid FAIL trial record is useful blocker evidence, but it is not Human-Verified.
- Human-Verified is true only when a real recorded trial has `final.human_trial_decision` set to `PASS` and `human_verified` set to `true`.
- Do not store API keys, screenshots with keys, personal contact details, or `.env` values here.
