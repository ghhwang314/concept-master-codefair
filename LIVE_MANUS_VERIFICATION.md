# Live Manus Verification

검증일: 2026-06-06 15:25 KST

## 범위

- 서버: `http://localhost:4173`
- `.env` 존재 여부: 있음
- API 키 값: 문서와 브라우저 파일에 기록하지 않음
- 목적: 발표 전 실제 Manus 경로와 fallback 경로를 과장 없이 구분

## 측정 결과

| Endpoint | HTTP | elapsed_ms | live source result | judge-facing interpretation |
| --- | ---: | ---: | --- | --- |
| `/api/diagnose` | PASS | 69532 | `rule_based_fallback` | 진단은 Manus 응답 대신 fallback 진단으로 완료됨 |
| `/api/generate-similar-problem` | PASS | 53325 | `generatedBy: manus_api` | 같은 개념 유사문항 생성은 Manus 경로로 완료됨 |

## 제출용 판단

- 현재 앱은 Manus가 느리거나 실패해도 90초 데모를 끊지 않고 fallback으로 완료한다.
- 실제 측정에서 진단은 `rule_based_fallback`, 생성은 `manus_api`였다.
- 따라서 발표 문구는 “Manus API와 fallback을 모두 갖춘 AI 오답 코치”가 맞고, “모든 단계가 항상 Manus API로 성공한다”라고 말하면 안 된다.
- 화면의 `AI 상태` 라벨은 이 경계를 심사위원에게 보여주기 위한 장치다.

## 다음 안전 행동

발표 전 한 번 더 같은 측정을 하되, 같은 fallback 결과가 반복되면 API 반복 호출 대신 fallback 정상 시연을 기준으로 발표한다.
