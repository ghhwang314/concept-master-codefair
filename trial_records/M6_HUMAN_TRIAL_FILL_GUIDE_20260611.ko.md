# M6 사람 테스트 기록 가이드

이 파일은 `AI 오답 코치`가 Human-Verified가 되었다는 증거가 아닙니다.
실제 건호 또는 원장이 앱을 사용한 뒤 아래 항목을 기록 파일에 채워야 합니다.

## 기록 파일

```text
trial_records/human_trial_record_20260611_092517_0900_human-trial.v1.json
```

현재 상태:

```text
m6_status: NEEDS_RECORD_COMPLETION
human_verified: false
비어 있는 필드: 21개
```

## 테스트 순서

1. 프로젝트 폴더에서 `npm test`를 실행하고 PASS/FAIL을 기록합니다.
2. `npm start`를 실행합니다.
3. 브라우저에서 `http://localhost:4173`을 엽니다.
4. 화면에서 `테스트 시작` 또는 30초 테스트 버튼을 누릅니다.
5. 오답 기록, AI 진단, 같은 개념 재도전, 개선율, 풀이 로그, 개념 요약, 문제 준비 확인이 보이는지 확인합니다.
6. 건호가 자기 말로 설명하게 하고, 아래 설명 항목에 그대로 요약합니다.
7. 기록 파일을 채운 뒤 검증합니다.

## 기록 파일에 채울 값

`run`:

- `npm_test_result`: `PASS` 또는 `FAIL`
- `browser_load_result`: `PASS` 또는 `FAIL`
- `ai_status_top_bar`: 화면 상단에 보인 AI 상태 문구

`demo`:

- `demo_reached_data_screen`: `PASS` 또는 `FAIL`
- `improvement_rate_shown`: 화면에 보인 개선율, 예: `50%`
- `attempt_log_shown`: `PASS` 또는 `FAIL`
- `concept_summary_shown`: `PASS` 또는 `FAIL`
- `recommendation_trace_shown`: `PASS` 또는 `FAIL`
- `problem_bank_qa_shown`: `PASS` 또는 `FAIL`
- `generated_problem_qa_notice_shown_when_needed`: `PASS`, `FAIL`, 또는 `NA`

`explanation`:

- `why_features_were_built`: 왜 이 기능을 만들었는지
- `what_changed_after_wrong_answer`: 오답 후 무엇이 바뀌었는지
- `what_ai_helped_with`: AI가 무엇을 도왔는지
- `why_retry_uses_same_concept`: 왜 같은 개념 문제를 다시 푸는지
- `what_data_screen_proves`: 데이터 화면이 무엇을 증명하는지

`manus_and_fallback`:

- `fallback_demo_finished`: `PASS` 또는 `FAIL`
- `needs_review_or_qa_issue_shown`: `PASS`, `FAIL`, 또는 `NA`

`final`:

- `human_trial_decision`: `PASS` 또는 `FAIL`
- `reason`: 최종 판단 이유
- `next_one_action`: 다음 한 동작

## 검증 명령

```powershell
npm run trial:validate -- --record trial_records\human_trial_record_20260611_092517_0900_human-trial.v1.json
npm run trial:status
python scripts\execute.py validate
```

`trial:status`가 `HUMAN_VERIFIED`가 되려면 실제 사용 기록이 채워지고 validator가 PASS해야 합니다.
그 전까지는 Auto-Verified만 맞고, Human-Verified는 아닙니다.
