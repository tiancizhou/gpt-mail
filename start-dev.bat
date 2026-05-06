@echo off
setlocal
cd /d "%~dp0"

echo Starting GPT Mail development setup...
echo Project: %cd%
echo.

set NEED_INSTALL=0
if not exist "node_modules" set NEED_INSTALL=1
if not exist "node_modules\.bin\next.cmd" set NEED_INSTALL=1
if not exist "node_modules\@libsql\client" set NEED_INSTALL=1
if "%NEED_INSTALL%"=="0" (
  echo npm dependencies are complete. Skipping npm install.
) else (
  echo npm dependencies are missing or incomplete. Running npm install...
  call npm install
  if errorlevel 1 goto install_failed
)

if not exist "prisma\dev.db" (
  echo.
  echo Database not found. Initializing database...
  call npm run db:init
  if errorlevel 1 goto failed
  call npm run db:seed
  if errorlevel 1 goto failed
) else (
  echo Database already exists. Skipping initialization.
)

echo.
echo Checking port 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
  echo Stopping existing process on port 3000: %%a
  taskkill /PID %%a /F >nul 2>nul
)

echo.
echo Starting GPT Mail development server...
call npm run dev
if errorlevel 1 goto failed

goto end

:install_failed
echo.
echo npm install failed. Please check the error messages above, then run this script again.
echo You can also retry after closing editors, terminals, or dev servers that may be locking node_modules.
pause >nul
exit /b 1

:failed
echo.
echo Setup or server failed. Please check the error messages above.
pause >nul
exit /b 1

:end
echo.
echo Server stopped. Press any key to close this window.
pause >nul
