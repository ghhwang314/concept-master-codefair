# ConceptMaster CodeFair ADR

## ADR-0001: DTT Before TDD

Status: accepted

Decision: Use DTT as `Definition -> Test -> Trace` for milestones. Use TDD only for risky implementation slices.

Reason: The project needs judge-facing traceability and handoff clarity more than repeated tiny tests that do not move the product.

## ADR-0002: Credit Saver By Default

Status: accepted

Decision: Default to `MANUS_CREDIT_SAVER_MODE=true`; live Manus calls require explicit one-shot arming from the UI.

Reason: Local testing and presentation practice must not consume credits repeatedly. The judge demo must remain available even when Manus is missing, slow, or invalid.

## ADR-0003: Menu-First Product Shell

Status: accepted

Decision: Keep the first screen focused on learning. Put details behind `학습`, `30초 데모`, `데이터`, and `연구근거` menu screens.

Reason: A CodeFair judge and an elementary student presenter both need a simple story before dense evidence.

## ADR-0004: Human-Verified Requires Real Use

Status: accepted

Decision: Auto tests can mark Auto-Verified only. Human-Verified requires a real Geonho/student trial record.

Reason: The contest story should be honest and defensible.
