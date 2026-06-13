# 건호 PC 실행 안내

이 압축본은 AI 오답 코치 MVP를 건호 PC에서 바로 실행해 보기 위한 파일 묶음입니다.

## 1. 준비

1. Node.js가 설치되어 있어야 합니다.
2. 압축을 풉니다.
3. 압축을 푼 폴더 안의 `concept-master-codefair` 폴더로 들어갑니다.
4. 그 폴더에서 PowerShell을 엽니다.

## 2. 바로 실행

```powershell
npm start
```

브라우저에서 아래 주소를 엽니다.

```text
http://localhost:4173
```

기본 상태에서는 실제 AI 키가 없어도 준비된 설명과 기본 문제 생성으로 데모가 이어집니다.

## 3. 테스트 확인

```powershell
npm test
```

현재 기준은 `47 pass, 0 fail`입니다.

## 4. AI 키를 넣고 싶을 때

AI를 실제로 연결하려면 먼저 `.env.example`을 `.env`로 복사합니다.

```powershell
Copy-Item .env.example .env
```

그다음 `.env` 파일의 `MANUS_API_KEY` 값을 실제 키로 바꿉니다.

키가 없어도 MVP 흐름은 멈추지 않고 기본 설명으로 작동합니다.

## 5. 포트가 이미 사용 중일 때

```powershell
$env:PORT=4174
npm start
```

그다음 브라우저에서 아래 주소를 엽니다.

```text
http://localhost:4174
```

## 6. 데모 흐름

1. 문제를 풉니다.
2. 오답이 풀이 기록에 남습니다.
3. AI 또는 기본 설명이 틀린 이유를 알려 줍니다.
4. 같은 개념 확인 문제를 다시 풉니다.
5. 오늘 복습과 자료 화면에서 기록을 확인합니다.

이 MVP는 AI가 정답을 대신 풀어 주는 앱이 아니라, 학생이 먼저 답을 고른 뒤 왜 틀렸는지 설명해 주는 오답 코치입니다.
