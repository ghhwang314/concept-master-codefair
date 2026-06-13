# Submission Docs Draft Trace - 2026-06-08

## Input files inspected

- `C:\Users\pjmin\Documents\카카오톡 받은 파일\서식 2 작품설명서_건호.hwp`
- `C:\Users\pjmin\Documents\카카오톡 받은 파일\코드페어 작품요약서 건호2 완.hwp`
- `C:\Users\pjmin\Documents\Codex\2026-06-02\ansimtalk-cube-ansimtalk-repo-github-pjmin19\README.md`
- `C:\Users\pjmin\Documents\Codex\2026-06-02\ansimtalk-cube-ansimtalk-repo-github-pjmin19\작품설계_최종보고서.md`
- `D:\Codex\products\concept-master-codefair\README.md`
- `D:\Codex\products\concept-master-codefair\SUBMISSION_PACKAGE.md`
- `D:\Codex\products\concept-master-codefair\LIVE_MANUS_VERIFICATION.md`
- `D:\Codex\products\concept-master-codefair\GEONHO_HUMAN_TRIAL_CHECKLIST.md`
- `D:\Codex\products\concept-master-codefair\QA_EVIDENCE\manus_credit_saver_trace_20260608.md`

## Official contest fact used

- 한국코드페어 SW공모전 주제: "AI와 데이터로 해결하는 우리 사회의 문제"
- Required submission files include 작품요약서 and 작품설명서(개발계획서).
- Public SW공모전 scoring structure used for revision: application/practical tool category has 100 points, split into 개발 목적, 설계와 방법론, 구현 및 유용성, 창의성, 제출 자료 at 20 points each, plus P/F 서류 구비 and 위험성 검토.

Source: https://kcf.or.kr/78
Scoring reference found in public official CodeFair materials/search excerpts: https://www.kcf.or.kr/post_file_download.cm?c=YTo1OntzOjEwOiJib2FyZF9jb2RlIjtzOjIyOiJiMjAyNTA1MjI0MGQyODA4YWVhMDg3IjtzOjk6InBvc3RfY29kZSI7czoyMjoicDIwMjUwODE4NjRkMTU3OTcyODIxMCI7czo5OiJmaWxlX2NvZGUiO3M6MjI6InAyMDI1MDgxOGZlNmM1YWU1NjYwNDciO3M6MTk6InBvc3RfZG93bmxvYWRfdG9rZW4iO3M6MTM6IjY5OGIwMThkOGVlZTciO3M6MTE6Im1lbWJlcl9jb2RlIjtOO30%3D

## Harness framing applied

- Problem: repeated elementary math misconception, especially same-concept wrong answers.
- Data: `attempt_log`, `concept_summary`, source separation between `demo_seed`, `judge_demo`, and `human_trial`.
- AI: Manus API diagnosis and same-concept retry generation, with fallback and cache boundaries.
- Verification: current Auto-Verified baseline is 40 PASS / 0 FAIL.
- Human boundary: Human-Verified remains pending until `GEONHO_HUMAN_TRIAL_CHECKLIST.md` is filled.
- AnsimTalk reference adapted: AI output is assistive, evidence/data flow is explicit, limits are stated without overclaiming.
- Scoring revision: documents now explicitly map to 개발 목적, 설계와 방법론, 구현 및 유용성, 창의성, 제출 자료, and 위험성 검토.

## Output files

- `D:\Codex\products\concept-master-codefair\SUBMISSION_DOCS\작품요약서_건호_대상형_초안_20260608.md`
- `D:\Codex\products\concept-master-codefair\SUBMISSION_DOCS\작품설명서_건호_대상형_초안_20260608.md`
- `D:\Codex\products\concept-master-codefair\SUBMISSION_DOCS\붙여넣기_가이드_건호_20260608.md`
- `D:\Codex\products\concept-master-codefair\SUBMISSION_DOCS\심사기준_자가점검_건호_20260608.md`

## Boundary

These drafts are copy-paste-ready text for HWP forms. The HWP binary files were inspected for section structure, but were not modified in place.
