@echo off
chcp 65001 > nul
echo ==========================================
echo   ConceptMaster 제출 서류 HTML 뷰어
echo ==========================================
echo.
echo [1] 작품요약서 열기
echo [2] 작품설명서 열기
echo [3] 심사 자가점검표 열기
echo [4] 붙여넣기 가이드 열기
echo [5] 사용성 테스트 체크리스트 열기
echo [6] 웹 에디터/서버 실행 (학습 앱 보기)
echo.
set /p menu="원하는 작업 번호를 입력하세요: "

if "%menu%"=="1" start "" "SUBMISSION_DOCS\작품요약서_건호_대상형_초안_20260608.html"
if "%menu%"=="2" start "" "SUBMISSION_DOCS\작품설명서_건호_대상형_초안_20260608.html"
if "%menu%"=="3" start "" "SUBMISSION_DOCS\심사기준_자가점검_건호_20260608.html"
if "%menu%"=="4" start "" "SUBMISSION_DOCS\붙여넣기_가이드_건호_20260608.html"
if "%menu%"=="5" start "" "GEONHO_HUMAN_TRIAL_CHECKLIST.html"
if "%menu%"=="6" (
    echo.
    echo 웹 앱 서버를 실행합니다... (localhost:4173)
    echo 서버를 종료하려면 이 창을 닫거나 Ctrl+C를 누르세요.
    echo.
    start "" "http://localhost:4173"
    "C:\Users\user\AppData\Roaming\Antigravity\bin\agy-node.cmd" src/server.mjs
)
pause
