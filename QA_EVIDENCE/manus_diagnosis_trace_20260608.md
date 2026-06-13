# Manus Diagnosis Trace QA - 2026-06-08

## Definition

When ConceptMaster diagnoses a wrong answer, the app must show whether the result came from Manus AI or from the safe rule-based fallback. If fallback is used, the app must expose a Korean reason such as timeout, API response error, missing structured output, or browser request failure without exposing secrets.

## Test

- `npm test`: 39 PASS / 0 FAIL
- `POST http://localhost:4173/api/diagnose`: live Manus path returned `source: "manus_api"`
- Live diagnosis task id: `CZ2tm79fggW4bCcSyKssm2`
- `GET http://localhost:4173/`: `id="diagnosis-trace"` and `AI 연결 상태` present
- `GET http://localhost:4173/src/app.js`: `labelDiagnosisTrace` and Korean fallback labels present

## Trace

- `src/diagnosis.js`
  - preserves safe rule-based fallback.
  - adds `fallbackReason`, `fallbackMessage`, and `aiTrace` when Manus is unavailable, slow, invalid, or structurally incomplete.
- `src/manusClient.js`
  - treats `structured_output_result.success=false` as a real structured-output failure instead of silently polling until a generic fallback.
- `src/server.mjs`
  - logs a safe fallback record with `questionId`, `source`, `fallbackReason`, and `path`; API keys and raw secrets are not logged.
- `index.html`
  - adds the `AI 연결 상태` row in the diagnosis modal.
- `src/app.js`
  - maps trace reasons to Korean labels and shows them in the modal, AI status title, and diagnosis evidence card.
- `tests/concept-master.test.mjs`
  - locks fallback reason tracing, structured output failure handling, visible diagnosis trace UI, and the 39 PASS readiness baseline.

## Boundary

- Fallback remains required for the 30-second judge demo contract.
- The API key stays server-side and is not included in browser-delivered files.
- This is Auto-Verified evidence. Human-Verified remains pending until Geonho or the owner completes the checklist.
