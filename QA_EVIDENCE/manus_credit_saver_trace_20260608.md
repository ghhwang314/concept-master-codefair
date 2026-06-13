# Manus Credit Saver Trace - 2026-06-08

## Cause

The app had a real Manus key in `.env`, and the browser/server flow could call Manus automatically for wrong-answer diagnosis and same-concept problem generation. The local `.env` also had `MANUS_DIAGNOSIS_TIMEOUT_MS=90000`, which allowed one live diagnosis to wait up to 90 seconds.

## Fix

- Default local mode is now `MANUS_CREDIT_SAVER_MODE=true`.
- `MANUS_DIAGNOSIS_TIMEOUT_MS` is reduced to `15000`.
- `/api/diagnose` and `/api/generate-similar-problem` use fallback unless the request explicitly sends `useLiveAi: true`.
- The top bar has `AI 1회 사용`; it arms exactly one live AI request and then turns itself off.
- The 30-second judge demo always sends `useLiveAi: false`, so repeated presentation practice does not spend Manus credits.
- The server caches live Manus diagnosis and generated problem results for repeated same-input local testing.

## Zero-Credit Verification

No live Manus request was made during this verification.

- `npm test`: 40 PASS / 0 FAIL
- `node --check src/app.js`: PASS
- `node --check src/server.mjs`: PASS
- `node --check src/manusCreditPolicy.js`: PASS
- `POST /api/diagnose` without `useLiveAi`: `source=rule_based_fallback`, `fallbackReason=credit_saver_mode`, `creditPolicy.liveManusUsed=false`
- `POST /api/generate-similar-problem` without `useLiveAi`: `generatedBy=template_fallback`, `creditPolicy.liveManusUsed=false`
- `GET /`: `live-ai-once-button`, `AI 1회 사용`, and `diagnosis-trace` are present

## Boundary

- The Manus API key remains in `.env` only and is not exposed to browser-delivered files.
- Live Manus is still available for intentional one-shot checks through the UI button or by sending `useLiveAi: true`.
- This is Auto-Verified evidence. Human-Verified remains pending until Geonho or the owner completes the checklist.
