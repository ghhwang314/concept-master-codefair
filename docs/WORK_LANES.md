# ConceptMaster Work Lanes

Use this file only when the current phase does not already name the lane. Prefer `phases/CURRENT_PHASE.md` first.

## Mission

Build ConceptMaster CodeFair into a customer-usable local project that Codex, Antigravity, or another agent can open, validate, run, and continue without chat reconstruction. The product story is: wrong-answer data becomes AI diagnosis, same-concept retry, and visible improvement.

This is an AI-native project harness. Advisory AI review is pre-authorized for research and implementation review, but local files and validators are source of truth. Use WebAI, Gemini Pro, ChatGPT Pro, Deep Research, and OpenCode with `frequent_session_oriented_quiet` and `quiet_artifact_only` discipline: use one well-formed session, ask useful follow-up questions in the same session, prefer Gemini Pro thinking mode and ChatGPT Pro heavy mode for hard review, and avoid noisy low-context calls. The live authority boundary requires concrete execution status: publish, upload, delete, send, logged-in browser-write, provider change, training/model promotion, and git writes are not performed by default.

## Lane Map

| Lane ID | Objective | Success Metric | Validator | Automation Level | Execution Status | Next Artifact |
| --- | --- | --- | --- | --- | --- | --- |
| m0_m1_handoff_harness | Freeze current baseline and maintain Codex/Antigravity execution harness. | `python scripts/execute.py validate` PASS and reports written. | `scripts/execute.py validate` | high local automation | live boundary closed | `reports/dtt_baseline/M0_BASELINE_STATUS.v1.json` |
| m2_api_environment | Keep Manus API server-only, credit-saving, and fallback-safe. | No browser key exposure; API missing/slow/invalid still leaves demo usable. | `npm test` Manus/security tests | high local automation | Auto-Verified; provider default unchanged | `reports/api_environment/M2_API_ENVIRONMENT_STATUS.v1.json` |
| m3_learning_product | Improve actual student workflow: attempt, diagnosis, retry, mastery, review, improvement. | One wrong answer and retry success update visible learning evidence. | product tests plus browser smoke | medium-high local automation | Auto-Verified; no live publish | `QA_EVIDENCE/m3_retry_success_browser_check_20260608.json` |
| m4_judge_package | Keep 30-second demo, 2-minute script, Q&A, summary, explanation docs aligned with UI. | Geonho can rehearse from current docs and app. | submission package tests/checklist | medium local automation | Auto-Verified; Human-Verified only after real trial | `QA_EVIDENCE/m4_submission_alignment_check_20260609.md` |
| m5_customer_handoff | Make another developer or parent run and modify the project in 15 minutes. | README/HANDOFF/checklist explain run, API, limits, and problem additions. | harness validate plus handoff checklist | medium local automation | Auto-Verified; no deploy claim | `QA_EVIDENCE/m5_handoff_alignment_check_20260609.md` |
| m6_human_trial | Record a real Geonho/student use trial. | Trial notes prove what was used, explained, and blocked. | human trial checklist | manual required | active; Human-Verified may be set only after trial | updated `GEONHO_HUMAN_TRIAL_CHECKLIST.md` |

## Standard Harness Lanes

These lane IDs are retained for top-developer harness compatibility. They are not permission to widen the current phase; use them only when a future phase explicitly routes work there.

| Lane ID | Objective | Success Metric | Validator | Automation Level | Execution Status | Next Artifact |
| --- | --- | --- | --- | --- | --- | --- |
| planning_next_step | Convert a broad request into one current phase and one next action. | Phase has objective, scope, done criteria, and next artifact. | `python scripts/execute.py validate` | semi-auto planning | no live action | `phases/CURRENT_PHASE.md` |
| coding_automation | Implement, debug, and refactor scoped local code. | Harness PASS with changed files listed. | product tests or harness command | high local automation | git write gated | harness report |
| local_llm_and_proctoring | Use local LLM output as advisory routing/growth evidence. | Observation or route report exists without provider default change. | local LLM/proctor validator | high local automation | provider/training gated | local LLM report |
| discord_control_plane | Prepare control-signal packets without sending. | Command packet validates. | command-gate validator | medium automation | send gated | control packet |
| visual_asset_processing | Process images and visual QA locally. | Output asset and visual report exist. | visual QA validator | high local automation | upload/publish gated | visual report |
| creative_game_projects | Support game/prototype work if future scope changes. | Runnable artifact or smoke result. | project smoke | medium automation | account/upload gated | game report |
| idea_generation | Filter ideas into decisions and artifacts. | Accepted idea has rationale and next artifact. | ADR check | high advisory automation | no live action | `docs/ADR.md` |
| communication_prep | Draft messages without sending. | Draft exists and send flag remains false. | draft validator | high draft automation | send gated | draft packet |
| education_problem_solving | Support study/problem workflows. | Solution or study packet validates. | problem runner | medium automation | account submission gated | study report |
| fixed_thread_context | Maintain handoff and shared context. | Context validator PASS. | context validator | high local automation | coordinator live action gated | context report |
| naver_publish_prep | Prepare publish packages without publishing. | Package validation PASS. | package dry-run validator | high prep automation | publish/upload gated | package report |
| webai_research_intake | Use WebAI, Gemini Pro thinking mode, ChatGPT Pro heavy mode, Deep Research, and OpenCode as advisory reviewers. | Advisory session is captured and converted into local action. | advisory usage planner | pre-authorized advisory automation | publish/send/delete/provider/training/git gated | advisory packet |
| openclaw_and_external_agents | Absorb external-agent patterns locally. | Pattern captured with validator-backed scope. | absorption validator | medium-high advisory automation | install/live runtime gated | absorption report |
| cleanup_maintenance | Run narrow cleanup and maintenance checks. | Maintenance validator PASS or blocker report exists. | maintenance validator | high local automation | destructive file/git gated | maintenance report |
| hardware_iot | Support future hardware experiments. | Build/upload plan or smoke report exists. | compile/smoke validator | medium automation | device upload gated | smoke report |
| repository_git | Review repo state without git writes. | Status/review report generated. | git/status validator | medium analysis automation | stage/commit/push/PR gated | repo report |
| library_research | Run read-only research evidence workflows. | Source packet exists without protected data leak. | read-only research validator | medium automation | login/export gated | evidence packet |
| classification_work | Improve routing and taxonomy. | Classifier validation PASS. | classifier validator | high local automation | canonical promotion gated | classifier report |
| cafe24_ui_review | Review site UI before live edits. | UI review report exists. | UI review validator | medium review automation | site edit/publish gated | UI report |

## Stop Rule

If the same command, route, or browser path fails five times, or the same GUI path times out twice, stop and report the exact blocker, current PASS evidence, and one next safe action. Do not expand into broad GitHub research or repeated micro-tests without new evidence.
