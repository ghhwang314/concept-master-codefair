# Problem Addition Guide

Purpose: add useful problems without breaking the CodeFair story. ConceptMaster is not a general quiz generator; it proves that wrong-answer data can diagnose a weak concept and route the student to the same concept again.

## Where To Edit

Add vetted source problems in:

```text
src/problems.js
```

Run after every change:

```powershell
npm test
python scripts\execute.py validate
```

## Required Fields For A Vetted Problem

Each item in `problemBank` must include:

```js
{
  id: "math_ratio_003",
  subject: "math",
  subjectKo: "수학",
  concept: "ratio_part_total",
  conceptKo: "비례식과 전체량 나누기",
  level: "bronze",
  question: "문항 본문",
  options: ["보기1", "보기2", "보기3", "보기4"],
  answer: 1,
  explanation: "왜 정답인지 초6 학생이 이해할 수 있게 설명"
}
```

Validation rules:

- `id` must be unique.
- `answer` is a zero-based option index. `answer: 1` means the second option is correct.
- `options` must contain at least two choices; four choices are preferred for the visible quiz.
- `subject`, `subjectKo`, `concept`, `conceptKo`, `level`, `question`, and `explanation` must be non-empty strings.
- `level` should stay one of `bronze`, `silver`, or `gold` for the current UI.

## Judge-Facing Elementary Math Rule

The default CodeFair demo uses:

```js
getDefaultJudgeProblems()
```

That function currently filters to elementary math concepts in:

```js
elementaryMathConcepts
```

To add a new judge concept:

1. Add at least two vetted problems with the same `concept` so same-concept retry can work.
2. Keep `subject: "math"` and `subjectKo: "수학"` for the judge flow.
3. Add the concept id to `elementaryMathConcepts` only after both problems are ready.
4. Check that the 30-second demo still reaches data evidence quickly.

If the new problem is science or English, it can stay in the general bank, but it should not widen the CodeFair judge story unless the presentation docs are rewritten.

## GitHub Research Applied: Skill Map

GitHub review found that serious tutor projects such as OATutor separate a problem from the skill/concept it measures. ConceptMaster applies that pattern in a smaller CodeFair-safe form through:

```js
buildProblemConceptMap(getDefaultJudgeProblems())
```

The map must prove:

- every judge problem has a `conceptId`
- every judge problem has at least one same-concept retry problem
- every judge problem is vetted source material, not generated output
- every concept group has enough repeated problems for wrong-answer repair
- each concept has a default misconception id that can connect attempts to `concept_summary`

This is the current acceptance line for adding CodeFair judge problems. Do not add a new judge concept unless the skill map still returns `PASS`.

## Generated Problem Boundary

AI or fallback generated problems are not vetted source problems. They must stay:

```text
reviewStatus: "needs_review"
reviewLabel: "검수 필요"
```

Generated problem QA requires:

- `conceptId`
- `difficulty`
- `question`
- `options`
- `answer`
- `explanation`
- `hint`
- `sourceReason`

Only move a generated problem into `problemBank` after a human reviews it and rewrites it as a clean vetted problem.

## Minimum Test Expectations

Existing tests already check:

- problem bank completeness
- `validateProblemBank()` returning `PASS`
- elementary grade-6 math judge scope
- same-concept retry before generated fallback
- generated problem QA gate
- 30-second demo contract
- secret boundary for Manus key
- visible evidence screens

If a new problem changes the judge set, update or add tests in:

```text
tests/concept-master.test.mjs
```

Do not accept a problem addition until `npm test` and `python scripts\execute.py validate` both pass.
