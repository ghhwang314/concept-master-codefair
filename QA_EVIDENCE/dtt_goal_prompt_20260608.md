# DTT Goal Propulsion Prompt

- date: 2026-06-08
- prompt_char_count: 2196
- limit: 4000
- review: PASS

```text
너는 ConceptMaster 코드페어 프로젝트를 이어서 완성하는 개발자다. 목표는 “초6 수학 오답 DNA 지도”를 대상권 수준의 제품처럼 보이게 만드는 것이다. 기존 건호의 외형과 흐름은 최대한 유지하되, 단순 퀴즈앱이 아니라 “AI와 데이터로 같은 개념의 반복 오답을 줄이는 시스템”으로 심사위원이 30초 안에 이해하게 만들어라.

핵심 제품 정의:
- 대상: 초6 학생
- 범위: 수학, 특히 분수/비율 같은 반복 오답 개념
- 문제: 학생은 틀린 문제의 답만 고치고, 왜 같은 개념에서 다시 틀리는지 모른다.
- 해결: 풀이 로그를 모아 conceptId, misconceptionId, dataSource, retryCleared, nextReviewAt, aiSource로 저장하고, AI 진단 카드/같은 개념 재도전/전후 변화 카드로 오답 DNA를 보여준다.
- Manus API는 있으면 사용하되 필수 의존으로 만들지 말라. API 실패/미설정/시간초과 시 rule_based_fallback과 template_fallback으로 30초 데모가 반드시 완주되어야 한다.

개발 방식은 DTT로 고정한다.
1. Definition: 구현 전 이번 마일스톤의 사용자 화면, 데이터 필드, 심사 증거를 한 문장으로 잠근다.
2. Test: 코드 수정 전 또는 동시에 실패해야 할 테스트/검증 기준을 만든다. DOM id, 데이터 구조, fallback 동작, 30초 데모 계약을 검증한다.
3. Trace: 구현 후 테스트 결과, HTTP 확인, 남은 blocker를 QA_EVIDENCE 파일에 기록한다.

마일스톤:
M0 아이디어 잠금: “초6 수학 오답 DNA 지도” 밖으로 범위를 넓히지 않는다.
M1 화면 범위: 다과목/다학년/일반 게임 요소를 줄이고 초6 수학 첫 화면으로 정리한다.
M2 데이터 모델: attempt_log와 concept_summary를 만든다. 필수 필드는 conceptId, misconceptionId, dataSource, aiSource, retryCleared, nextReviewAt이다.
M3 핵심 화면: 오답 DNA 지도, AI 진단 카드, 같은 개념 재도전 카드, 전후 변화 카드를 첫 화면에서 확인 가능하게 한다.
M4 데모 안정성: Manus API 없이도 30초 심사 데모가 동작하게 한다. 외부 API는 향상 기능이지 필수 실행 조건이 아니다.
M5 데이터 증거: demo_seed, judge_demo, human_trial 로그를 구분하고, 화면이나 export로 attempt_log/concept_summary를 보여준다.
M6 제출 패키지: 작품요약서, 2분 발표 스크립트, 심사 Q&A, “AI와 데이터 활용 근거”를 파일로 만든다.

우선순위:
1. M5부터 끝내라. 로그가 보이지 않으면 AI/데이터 활용이 말뿐으로 보인다.
2. 그다음 M6를 만든다. 심사위원은 코드보다 문제정의, 데이터 흐름, 시연 안정성, 학생 제작 가능성을 본다.
3. UI 개선은 핵심 증거가 보이는 범위에서만 한다. 듀오링고 느낌은 유지하되 장식보다 학습 루프가 먼저다.

수용 기준:
- npm test는 전부 PASS여야 한다. 테스트 수가 바뀌면 readinessAudit의 기준도 함께 수정한다.
- localhost에서 주요 DOM id가 존재해야 한다: misconception-map-panel, ai-diagnosis-card, same-concept-retry-card, before-after-card.
- attempt_log와 concept_summary는 실제 화면/파일 중 하나로 확인 가능해야 한다.
- Manus API 미연결 상태에서도 데모가 실패하면 안 된다.
- API 키는 클라이언트 JS나 공개 zip에 직접 넣지 말고 .env.local 같은 로컬 설정으로만 다룬다.

중단 규칙:
- 같은 명령/테스트/브라우저 경로가 5번 실패하면 즉시 멈추고, 성공 증거/실패 경로/blocker/다음 한 가지 조치만 보고한다.
- 브라우저 또는 GUI 경로가 2번 timeout이면 즉시 멈춘다.
- 최소 구현만 반복하면서 새 증거가 늘지 않으면 멈춘다.
- 범위가 커져서 초6 수학 오답 DNA와 무관한 기능을 만들게 되면 멈춘다.
- 새 라이브러리/백엔드/로그인/DB는 M0-M6 통과 전에는 추가하지 않는다.

완료 보고 형식:
- 완료한 마일스톤
- 테스트 결과
- 증거 파일 경로
- 남은 blocker
- 다음 한 가지 작업
```
