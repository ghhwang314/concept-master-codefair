# Agent Continuation Prompt

너는 ConceptMaster CodeFair 프로젝트를 이어서 구현하는 AI 개발자다. 목표는 건호의 아이디어에서 벗어나지 않고, 초6 학생도 설명할 수 있는 “오답 DNA 지도”를 로컬에서 실행 가능한 제품 후보로 만드는 것이다.

핵심 제품 문장:
학생이 틀린 문제 데이터를 남기면, Manus API 또는 fallback 진단이 약한 개념과 실수 원인을 설명하고, 같은 개념 재도전 문제를 풀게 한 뒤, 데이터 화면에서 개선률과 `attempt_log`, `concept_summary`로 이해 회복을 증명한다.

먼저 실행:
```powershell
npm test
python scripts\execute.py validate
```

현재 M6 기준은 `44 PASS / 0 FAIL`이다. 이 기준이 깨지면 새 기능을 만들지 말고 첫 실패만 고친다.

반드시 읽을 파일:
1. `phases/CURRENT_PHASE.md`
2. `.claude/commands/harness.md`
3. `README.md`
4. `HANDOFF_GEONHO.md`
5. `docs/HANDOFF_15_MIN.md`
6. `docs/PROBLEM_ADDITION_GUIDE.md`
7. `docs/API_ENVIRONMENT.md`

보안/API 규칙:
- 실제 `MANUS_API_KEY`는 `.env`와 서버 코드에서만 사용한다.
- HTML, 브라우저 JS, 문서, 스크린샷, zip에는 키를 넣지 않는다.
- `MANUS_CREDIT_SAVER_MODE=true`가 기본이다.
- `AI 1회 사용`은 딱 한 번 live AI를 허용하고 다시 절약 모드로 돌아가야 한다.
- Manus가 없거나 느리면 `rule_based_fallback`으로 데모가 끝까지 돌아가야 한다.

DTT 방식:
작업마다 먼저 3줄로 고정한다.
Definition: 무엇을 바꿀지
Test: 무엇이 통과해야 맞는지
Trace: 어느 코드/문서/증거에 남길지

우선순위:
1. 심사용 30초 흐름: 오답 -> AI/fallback 진단 -> 같은 개념 재도전 -> 회복 -> 개선률
2. 데이터 화면: `attempt_log`, `concept_summary`, 문제 QA, 추천 근거
3. 연구근거 화면: DTT, P0-P6 readiness, Human-Verified 경계
4. 문제 추가: `src/problems.js`에 검수 문항만 추가하고 `answer`는 0부터 시작하는 index로 둔다.

하지 말 것:
- 친구, 랭킹, 장식부터 늘리지 않는다.
- “AI가 답을 대신 풀어준다”고 만들지 않는다.
- Human-Verified, 고객 납품 가능, 수상 보장 같은 확정 표현을 쓰지 않는다.
- 같은 실패 루트를 5번 넘게 반복하지 않는다. 브라우저 같은 화면 타임아웃은 2번이면 멈춘다.

완료 조건:
- `npm test` PASS
- `python scripts\execute.py validate` PASS
- M6는 `npm run trial:prepare -- --tester Geonho`로 기록 파일을 만들고 실제 사용 후 `npm run trial:validate -- --record trial_records\<record-file>.json`이 통과해야 한다.
- 키 노출 없음
- 데모가 fallback만으로도 끝남
- 변경 이유가 DTT와 증거 파일에 남음
