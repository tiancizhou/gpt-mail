@echo off
setlocal
cd /d "%~dp0"

echo Starting GPT Mail development server...
echo Project: %cd%
echo.

echo Checking port 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
  echo Stopping existing process on port 3000: %%a
  taskkill /PID %%a /F >nul 2>nul
)

echo.
call npm run dev

echo.
echo Server stopped or failed to start. Press any key to close this window.
pause >nul
