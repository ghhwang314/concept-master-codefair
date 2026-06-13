오토-목표추진

목표: `AI 오답 코치` 작품설명서를 한국코드페어 제출 양식에 맞게 다시 점검하고, 안심톡 참고 문서의 구조처럼 읽기 쉽고 근거 있는 제출본으로 수정한다. 단순히 문장을 늘리지 말고, 출처·방법론·최근 교육 흐름·실제 MVP 기능이 자연스럽게 이어지게 만든다.

역할: 너는 한국코드페어 제출서류 편집자, 초6 학생 글쓰기 코치, 교육자료 근거 검증자다. 법률 검토자가 아니라 제출 문서 완성 담당자다.

기준 파일:
- 참고 구조: `C:\Users\pjmin\Desktop\새 폴더\코드페어 제출\새 폴더 (2)\작품설명서.pdf`
- 코드페어 예시: `C:\Users\pjmin\Downloads\2026 한국코드페어 참가 서식 (2) (2)\서식 2 작품설명서 예시_00.pdf`
- 현재 작업 폴더: `D:\Codex\tmp\geonho_handoff\concept-master-codefair`
- 기존 제출문서 후보: `D:\Codex\tmp\geonho_handoff\concept-master-codefair\SUBMISSION_DOCS`

학생 페르소나:
- 작성자는 초6 황건호다.
- 말투는 “저는 ~라고 생각했습니다”, “그래서 ~ 만들었습니다”처럼 학생이 직접 설명하는 느낌으로 한다.
- 문장은 제출용으로 정돈하되, 회사 보고서나 논문 말투처럼 만들지 않는다.
- 어려운 말은 쉬운 말로 풀어 쓴다. 예: “학습 분석”은 “풀이 기록을 모아 약한 개념을 찾는 것”으로 설명한다.
- 한 사람이 쓴 느낌을 유지한다. 장마다 말투가 달라지거나, AI가 쓴 것처럼 과장된 표현을 쓰지 않는다.
- 금지 표현: “본 연구는”, “혁신적 플랫폼”, “완성 서비스”, “대상 가능”, “코덱스가”, “심사용”, “제출 전 확인”, “무조건 향상”, “AI가 정답을 해결”.

핵심 사실:
- 현재 MVP는 초6 수학 중심이다.
- 과학은 전기 회로, 물질의 성질 같은 개념으로 확장할 계획이라고만 쓴다.
- AI는 정답을 대신 풀어 주는 기능이 아니라, 학생이 먼저 답을 고른 뒤 왜 틀렸는지 쉬운 말로 설명하는 코치 역할이다.
- AI 연결이 안 되면 준비된 기본 설명으로 이어지는 구조를 정직하게 쓴다.
- 실제 흐름은 문제 풀기 → 오답 기록 → 이유 설명 → 같은 개념 다시 풀기 → 회복 확인 → 자료 화면이다.
- 내부 코드명보다 학생이 이해하는 말인 “풀이 기록”, “개념 요약”, “반복 오답”, “오늘 복습”을 우선 사용한다.

반드시 넣을 근거 방향:
1. 교육부 AI 디지털교과서 방향: 학생 데이터 기반 맞춤형 학습, 강점·약점 확인, 교사와 AI 보조의 역할.
2. 생성형 AI 교육 활용 가이드: AI를 사람을 대신하는 도구가 아니라 도움을 주는 도구로 쓰고, 확인 절차를 둔다는 방향.
3. 피드백 방법론: 틀린 뒤 바로 이유를 알고 다시 시도하는 피드백이 학습에 중요하다는 근거.
4. 지능형 튜터링/맞춤 학습 연구: 학생의 답과 오답 정보를 이용해 개인별 도움을 주는 방식.
5. 수학 오개념/오답 진단 흐름: 단순 채점이 아니라 어떤 개념에서 틀렸는지 보는 방식.

우선 확인할 참고자료 후보:
- 교육부, 2025년 AI 디지털교과서 보도자료: https://www.moe.go.kr/boardCnts/viewRenew.do?boardID=294&boardSeq=101774
- 교육부 영문 AI Digital Textbook briefing: https://english.moe.go.kr/boardCnts/viewRenewal.do?boardID=254&boardSeq=95291
- UNESCO, Guidance for generative AI in education and research: https://www.unesco.org/en/articles/guidance-generative-ai-education-and-research
- U.S. Department of Education, Artificial Intelligence and the Future of Teaching and Learning: https://www.ed.gov/sites/ed/files/documents/ai-report/ai-report.pdf
- Hattie & Timperley, The Power of Feedback: https://eric.ed.gov/?id=EJ782448
- Kulik & Fletcher, Effectiveness of Intelligent Tutoring Systems: https://journals.sagepub.com/doi/abs/10.3102/0034654315581420
- K-12 Mathematics Learning Analytics review: https://learning-analytics.info/index.php/JLA/article/view/8299
- AI-supported math misconception diagnosis example: https://link.springer.com/article/10.1007/s44217-025-00742-w

작성 구조:
Ⅰ. 제작 동기와 목적
Ⅱ. 작품 설계
Ⅲ. 구현 내용
Ⅳ. 테스트와 결과
Ⅴ. 기대 효과와 발전 계획
Ⅵ. 참고자료

수정 기준:
- 안심톡 문서에서 배울 것은 큰 흐름, 표·그림 배치, 제출용 문장 밀도다. 내용은 AI 오답 코치에 맞게 새로 쓴다.
- 본문 중 근거가 필요한 문장에는 `(참고자료 [1])`처럼 표시한다.
- 마지막 참고자료에는 제목, 기관/저자, 연도, 전체 URL을 적는다. 인쇄해도 링크를 볼 수 있게 실제 주소를 모두 적는다.
- 표는 필요한 곳에만 넣는다. 권장 표: 문제점과 해결 방향, 오답이 공부 자료로 바뀌는 과정, 남기는 자료, 테스트 결과, 한계와 발전 계획.
- 표 번호 칸은 좁게, 설명 칸은 넓게 둔다. 가운데 정렬을 남발하지 말고 본문은 왼쪽 정렬한다.
- 그림은 사용자가 넣은 “오답이 공부 자료로 바뀌는 흐름” 이미지를 한 번만 쓰고, 같은 내용을 표로 반복하지 않는다.
- 줄간격, 글자 간격, 표 폭이 깨졌는지 PDF까지 확인한다.
- 분량은 가능하면 10~13쪽으로 맞추되 밑줄, 빈칸, 반복 문장으로 쪽수를 늘리지 않는다.
- 영어는 참고자료 제목과 불가피한 고유명사 외에는 쓰지 않는다.

검증:
- 양식 일치: 코드페어 서식 2 형태, 표지형 첫 장, 작품 기본 정보 불필요하면 제거.
- 문체 일치: 초6 학생이 직접 설명하는 느낌, 한 사람 목소리, 과장 없음.
- 근거 일치: 본문 인용 표시와 참고자료 목록이 서로 맞음.
- MVP 일치: 현재 구현은 초6 수학, 과학은 확장 계획, AI는 코치 역할.
- 제출 적합성: “제출 전 확인 기준” 같은 내부 검토 문장은 삭제.
- 산출물: 최종 DOCX와 PDF를 만들고 파일 경로를 보고한다. PDF 변환이 막히면 같은 명령을 5번 반복하지 말고 정확한 blocker와 DOCX 경로를 보고한다.

최종 보고:
1. 수정한 파일 경로
2. 참고자료가 들어간 위치
3. 안심톡 구조 반영 여부
4. 학생 페르소나 점검 결과
5. PDF/표/줄간격 확인 결과
6. 남은 위험 1~3개
7. 다음 한 동작
