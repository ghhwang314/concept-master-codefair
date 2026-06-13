# Harness Command

Run from the project root:

```powershell
python scripts/execute.py validate
```

This command performs:

1. Phase and required-file validation.
2. Browser JavaScript syntax check: `node --check src/app.js`.
3. Product contract tests: `npm test`.
4. M0 baseline report write.

Expected output is compact JSON with:

- `status`
- `report_path`
- `baseline_report`

If it fails, open `reports/token_harness/latest_status.v1.json`, fix the first failing command, and rerun once. Do not start broad rewrites before the concrete blocker is understood.
