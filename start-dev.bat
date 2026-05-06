@echo off
setlocal
cd /d "%~dp0"

echo Starting GPT Mail development setup...
echo Project: %cd%
echo.

echo Installing npm dependencies...
call npm install
if errorlevel 1 goto failed

echo.
set /p INIT_DB=Do you need to initialize or update the database? This will run Prisma generate, migrate, and seed. [y/N]:
if /I "%INIT_DB%"=="Y" goto init_db
if /I "%INIT_DB%"=="YES" goto init_db
goto start_server

:init_db
echo.
echo Generating Prisma client...
call npx prisma generate
if errorlevel 1 goto failed

echo.
echo Running database migrations...
call npx prisma migrate dev
if errorlevel 1 goto failed

echo.
echo Seeding database...
call npm run prisma:seed
if errorlevel 1 goto failed

:start_server
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

:failed
echo.
echo Setup or server failed. Please check the error messages above.
pause >nul
exit /b 1

:end
echo.
echo Server stopped. Press any key to close this window.
pause >nul
