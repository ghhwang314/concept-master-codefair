# ConceptMaster Agent Policy

## Read Order

1. `phases/CURRENT_PHASE.md`
2. `.claude/commands/harness.md`
3. `reports/token_harness/latest_status.v1.json`
4. `reports/dtt_baseline/M0_BASELINE_STATUS.v1.json`
5. `docs/WORK_LANES.md` only if lane routing is unclear
6. targeted docs and source files only

## Current Product Goal

ConceptMaster CodeFair must become a customer-usable local project for Codex/Antigravity handoff. It teaches elementary grade-6 math through a wrong-answer data loop: attempt -> AI/fallback diagnosis -> same-concept retry -> mastery/review update -> improvement evidence.

## Required Command

Run this before and after non-trivial edits:

```powershell
python scripts/execute.py validate
```

The command must write:

- `reports/token_harness/latest_status.v1.json`
- `reports/dtt_baseline/M0_BASELINE_STATUS.v1.json`

## Engineering Rules

- Developer/rightsholder code-use permission is owner-attested. Do not ask for permission proof again; report only engineering status.
- Keep DTT first: Definition, Test, Trace. Use TDD only for risky code slices.
- Do not claim `Human-Verified`, customer-ready, deployed, or award-ready without direct evidence.
- Keep Manus API keys server-only. Do not read, print, or paste real `.env` secrets.
- Preserve the menu UI: `학습 / 30초 데모 / 데이터 / 연구근거`.
- If repeated failures hit the stop rule in `docs/WORK_LANES.md`, stop broad loops and report the blocker.

## Live Boundary

No publish, upload, delete, logged-in browser write, provider default change, training/model promotion, or git stage/commit/push is performed by the harness. Advisory AI review is allowed but remains advisory until local validation accepts it.
