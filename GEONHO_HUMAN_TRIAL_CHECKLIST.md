# Geonho Human Trial Checklist

Purpose: move ConceptMaster from Auto-Verified evidence to a real student-use gate before CodeFair submission. This file is not proof by itself. It becomes Human-Verified only after Geonho or the owner fills in the run result.

Machine-readable M6 record:

1. Create a dated trial start packet:

```powershell
npm run trial:start -- --tester Geonho
```

This prints the record path, app URL, server command, checklist path, and validation command. It does not make the project Human-Verified.

Alternative record-only helper:

```powershell
npm run trial:prepare -- --tester Geonho
```

2. Start the app and fill the copied JSON from this checklist after actual use.
3. Validate it:

```powershell
npm run trial:validate -- --record trial_records\<record-file>.json
npm run trial:status
```

`trial:status` is the quick status check. It must not say `HUMAN_VERIFIED` until the filled record passes validation.

The template itself is checked by `python scripts\execute.py validate`, but it does not make the project Human-Verified.

## 1. Setup Check

Run these commands in `D:\Codex\products\concept-master-codefair`.

```powershell
npm test
npm start
```

Open:

```text
http://localhost:4173
```

Record:

```text
Date/time:
Tester:
npm test result: PASS/FAIL
Expected Auto-Verified baseline before trial: 44 PASS / 0 FAIL
Browser load result: PASS/FAIL
AI status shown in top bar: Manus / fallback / waiting / other
```

## 2. 30-second demo

Run the 30-second demo once without explaining from memory. The screen must show this loop:

```text
wrong answer data -> AI diagnosis -> same-concept retry -> improvement rate -> attempt_log / concept_summary
```

Record:

```text
Demo reached data screen: PASS/FAIL
Improvement rate shown:
attempt_log shown: PASS/FAIL
concept_summary shown: PASS/FAIL
Recommendation trace shown: PASS/FAIL
Problem-bank QA shown: PASS/FAIL
Generated problem QA notice shown when needed: PASS/FAIL
```

## 3. Geonho explanation gate

Geonho should answer these in his own words.

```text
1. why features were built:
2. what changed after the wrong answer:
3. what AI helped with:
4. why the retry problem uses the same concept:
5. what the data screen proves:
```

Pass condition: the explanation connects data, Manus or fallback diagnosis, same-concept retry, attempt_log, concept_summary, review date, and improvement rate. If the answer is only "AI made a quiz", mark this section FAIL.

## 4. Manus and fallback boundary

Manus API is useful evidence, but the demo must remain safe if Manus is slow.

```text
Manus diagnosis source if visible:
Generated retry problem source if visible:
If fallback appears, did the demo still finish: PASS/FAIL
Any needs_review or QA issue shown:
```

Do not paste API keys into this file. Do not put `.env` into the handoff zip. `.env.example` is okay.

## 5. Issue list

Record only concrete issues.

```text
Issue 1:
Issue 2:
Issue 3:
```

## 6. Final trial decision

Choose one.

```text
Human trial decision: PASS/FAIL
Reason:
Next one action:
```

Status boundary:

- Auto-Verified means deterministic tests and local QA passed.
- Human-Verified means Geonho or the owner actually ran this checklist and recorded PASS evidence.
- Until this file is filled, the project is not Human-Verified.
- The JSON validator must also pass before the record is treated as M6 evidence.
