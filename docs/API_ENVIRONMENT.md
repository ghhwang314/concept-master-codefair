# API And Environment Handoff

## Purpose

ConceptMaster can run as a local demo with no live Manus call, and can use Manus only when the user explicitly arms one live AI request. This keeps CodeFair practice cheap and safe.

## Setup

1. Copy `.env.example` to `.env`.
2. Put the real key only in `.env`:

```text
MANUS_API_KEY=...
MANUS_CREDIT_SAVER_MODE=true
```

3. Run:

```powershell
npm test
npm start
```

4. Open `http://localhost:4173`.

## Credit Saver Rule

- Default local mode is `MANUS_CREDIT_SAVER_MODE=true`.
- Normal quiz and judge demo use deterministic fallback.
- The `AI 1회 사용` button arms exactly one live request.
- After the request is consumed, the app returns to credit saver behavior.
- Repeated identical live results can be served from in-memory cache during the same server run.

## Server-Only Secret Boundary

- `MANUS_API_KEY` is read by `src/manusClient.js` from `process.env`.
- The browser entry files must not reference `MANUS_API_KEY` or `Bearer ` auth.
- `.env` and other dotfiles are blocked by the static path guard.
- Do not paste real `.env` values into chat, docs, reports, screenshots, or submission files.

## Fallback Rule

The demo must still work when Manus is missing, slow, invalid, or credit saver mode is on.

- Diagnosis fallback source: `rule_based_fallback`.
- Credit saver fallback reason: `credit_saver_mode`.
- Generated retry problems remain `needs_review` until a human checks them.

## Validation

Run:

```powershell
python scripts/execute.py validate
```

Expected reports:

- `reports/token_harness/latest_status.v1.json`
- `reports/dtt_baseline/M0_BASELINE_STATUS.v1.json`
- `reports/api_environment/M2_API_ENVIRONMENT_STATUS.v1.json`

M2 is Auto-Verified only when the M2 report is `PASS`. Human-Verified still requires Geonho or another real student to use the app.
