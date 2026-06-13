# ConceptMaster CodeFair Architecture

## System Shape

ConceptMaster is a static browser app plus a small local Node server.

- `index.html` and `styles.css`: Duolingo-like learning shell and menu UI.
- `src/app.js`: browser state, rendering, menu flow, answer handling, judge demo.
- `src/server.mjs`: static server and API endpoints.
- `src/manusClient.js`: server-side Manus task API adapter.
- `src/manusCreditPolicy.js`: credit saver and one-shot live AI policy.
- `src/diagnosis.js`: deterministic diagnosis fallback and normalization.
- `src/generation.js`: same-concept retry generation and fallback.
- `src/learning.js`, `src/reviewScheduler.js`: attempt data, mastery, review schedule.
- `src/misconceptionMap.js`: wrong-answer DNA map.
- `src/dttTrace.js`, `src/readinessAudit.js`, `src/presentationPlan.js`: judge-facing evidence.
- `tests/concept-master.test.mjs`: acceptance and safety contract.

## Stable Entry Points

- Run tests: `npm test`
- Start app: `npm start`
- Harness: `python scripts/execute.py validate`
- Current phase: `phases/CURRENT_PHASE.md`
- Handoff prompt: `SUBMISSION_DOCS/DTT_CUSTOMER_USABLE_EXECUTION_PROMPT_20260608.md`

## Data And AI Flow

1. Student answers a problem.
2. Browser records attempt data in local storage.
3. On wrong answer, the app requests diagnosis.
4. Server chooses live Manus only when the browser explicitly arms one live request; otherwise fallback is used.
5. Diagnosis/retry result updates the misconception map, mastery, review schedule, and judge evidence cards.

## Boundaries

- `.env` is local only. Do not read or paste real secrets in reports.
- Browser-delivered files must not contain `MANUS_API_KEY` or bearer auth.
- Advisory AI output is not source of truth until local validation accepts it.
- Publish/upload/delete/logged-in browser writes/provider defaults/training/git writes require separate concrete execution status.

## Validation Map

| Area | Validation |
| --- | --- |
| Harness files | `scripts/hooks/validate_phase.py` |
| Browser JS syntax | `node --check src/app.js` |
| Product behavior and safety | `npm test` |
| M0 baseline | `reports/dtt_baseline/M0_BASELINE_STATUS.v1.json` |
