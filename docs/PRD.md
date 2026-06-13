# ConceptMaster CodeFair PRD

## Problem

Elementary students often repeat the same math misconception after a wrong answer because the mistake is recorded only as "wrong", not as a reusable learning signal. ConceptMaster turns wrong-answer data into a visible AI-assisted recovery loop.

## Users

- Student presenter: Geonho, who must explain the product in CodeFair Q&A.
- Judge: needs to see AI, data, testing, and learning value in under two minutes.
- Parent or teacher: needs a local handoff that runs with simple commands.
- Developer/agent: needs enough project context to continue in Codex or Antigravity.

## Requirements

1. The app stores problem attempts and classifies repeated misconception concepts.
2. The app diagnoses a wrong answer using Manus when explicitly armed, or deterministic fallback in credit saver mode.
3. The app recommends or generates a same-concept retry problem.
4. The app updates mastery, review schedule, improvement, and evidence panels after attempts.
5. The UI separates `학습`, `30초 데모`, `데이터`, and `연구근거` so the first screen is not overcrowded.
6. The project exposes one harness command for local continuation: `python scripts/execute.py validate`.
7. API keys stay server-only and are never delivered to browser files.

## Non-Goals

- Do not build a generic quiz generator.
- Do not mark generated problems as vetted without human review.
- Do not claim Human-Verified until Geonho or another real student completes a trial.
- Do not publish, upload, commit, or change provider defaults from the harness.

## Acceptance Criteria

- [ ] `npm test` passes.
- [ ] `node --check src/app.js` passes.
- [ ] `python scripts/execute.py validate` writes PASS reports.
- [ ] M0 baseline report points to UI/browser evidence and current tests.
- [ ] Handoff docs explain run, API, fallback, and next milestone.
