# UI Korean Cleanup Trace

Date: 2026-06-08

## Definition

The judge-facing screen must not show raw internal values such as `rule_based_fallback`, `same_concept_retry`, `fraction_common_denominator`, `PASS:`, `TOP3`, or `XP`. The wrong-answer DNA list must render as readable Korean rows, not squeezed vertical text.

## Test

- `tests/concept-master.test.mjs::visible Korean UI hides raw English status labels and internal ids`
- `npm test`: 38 PASS / 0 FAIL
- `node --check src/app.js`: PASS
- `node --check src/misconceptionMap.js`: PASS
- `node --check src/readinessAudit.js`: PASS

## Trace

- `src/misconceptionMap.js::getMisconceptionLabel`
  - maps old and new misconception IDs to Korean display labels.
- `src/app.js`
  - maps AI source labels to Korean: `규칙 진단`, `AI 진단`, `기본 예시`.
  - maps retry reasons to Korean: `같은 개념 검수 문항`, `AI가 만든 같은 개념 문항`, `기본 예시 문항`.
  - maps data sources to Korean: `시작 예시`, `심사 데모`, `직접 풀이`.
- `index.html`
  - replaces visible `PASS:`, `TOP3`, `XP`, and `fallback 문항` copy.
  - keeps internal data hooks as attributes, not reader-facing copy.
- `styles.css`
  - adds `[hidden] { display: none !important; }`.
  - changes `.rank-list li` from flex to block and uses Korean-friendly wrapping.

## HTTP Evidence

`GET http://localhost:4173/` returned status 200.

Static HTML checks:

- `통과: 문항 검증 완료`: present
- `TOP3`: absent
- `PASS:`: absent
- ` XP`: absent
- `fallback 문항`: absent

## Browser Boundary

Codex Browser MCP could not attach because the shared profile is locked:

```text
Browser is already in use for C:\Users\pjmin\AppData\Local\ms-playwright\mcp-chrome-41da846
```

The current in-app browser is already at `http://localhost:4173/`; refresh the page to load the corrected UI.
