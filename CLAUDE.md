# ConceptMaster Cross-Agent Contract

This project is designed for Codex, Antigravity, Claude-style agents, and local developers to continue without chat history.

## Objective

Make ConceptMaster CodeFair a runnable local product candidate: `npm test`, `.env` setup, `npm start`, and a browser demo of wrong-answer data becoming AI/fallback diagnosis, same-concept retry, and visible improvement.

## Start Here

1. Read `phases/CURRENT_PHASE.md`.
2. Run `python scripts/execute.py validate`.
3. If PASS, work only on the next action named in the phase.
4. If FAIL, fix the first concrete blocker before widening scope.

## Source Of Truth

- Product behavior: `src/` and `tests/concept-master.test.mjs`
- Phase and milestone: `phases/CURRENT_PHASE.md`
- Harness report: `reports/token_harness/latest_status.v1.json`
- Baseline report: `reports/dtt_baseline/M0_BASELINE_STATUS.v1.json`
- Product plan: `docs/PRD.md`
- Architecture: `docs/ARCHITECTURE.md`
- Decisions: `docs/ADR.md`

## Boundary

Do not expose Manus secrets, do not claim Human-Verified without a real student trial, and do not perform publish/upload/delete/provider/training/git writes without a separate execution status.
