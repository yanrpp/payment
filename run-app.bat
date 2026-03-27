@echo off
setlocal enabledelayedexpansion

echo ========================================
echo         PAYMENT APP LAUNCHER
echo ========================================
echo.

REM ตรวจสอบ Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
  echo ERROR: Node.js is not installed or not in PATH
  pause
  exit /b 1
)

REM ตรวจสอบ npm
npm --version >nul 2>&1
if %errorlevel% neq 0 (
  echo ERROR: npm is not installed or not in PATH
  pause
  exit /b 1
)

REM ติดตั้ง dependencies ถ้ายังไม่มี
if not exist "node_modules" (
  echo Installing dependencies...
  npm install
  if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
  )
)

echo.
echo Choose an option:
echo 1. Run in development mode
echo 2. Run production directly (npm start)
echo 3. Run with PM2 (start/restart ecosystem)
echo 4. PM2 status
echo 5. PM2 stop and delete app
echo 6. Exit
echo.
set /p choice="Enter your choice (1-6): "

if "%choice%"=="1" goto DEV
if "%choice%"=="2" goto PROD_DIRECT
if "%choice%"=="3" goto PM2_RUN
if "%choice%"=="4" goto PM2_STATUS
if "%choice%"=="5" goto PM2_STOP
if "%choice%"=="6" goto EXIT_OK

echo Invalid choice.
pause
exit /b 1

:DEV
echo.
echo Starting development server at http://localhost:3008
npm run dev
goto END

:PROD_DIRECT
echo.
echo Building project...
npm run build
if %errorlevel% neq 0 (
  echo ERROR: Build failed
  pause
  exit /b 1
)
echo.
echo Starting production server at http://localhost:3008
npm run start
goto END

:PM2_RUN
pm2 --version >nul 2>&1
if %errorlevel% neq 0 (
  echo ERROR: PM2 not found. Install with:
  echo npm i -g pm2
  pause
  exit /b 1
)

echo.
echo Building project before PM2 start...
npm run build
if %errorlevel% neq 0 (
  echo ERROR: Build failed
  pause
  exit /b 1
)

if not exist "logs" mkdir logs

echo.
echo Starting/Reloading PM2 ecosystem...
pm2 startOrReload ecosystem.config.cjs --env production
if %errorlevel% neq 0 (
  echo ERROR: PM2 startOrReload failed
  pause
  exit /b 1
)

pm2 save
echo.
echo PM2 is running. App URL: http://localhost:3008
pm2 status
goto END

:PM2_STATUS
pm2 --version >nul 2>&1
if %errorlevel% neq 0 (
  echo ERROR: PM2 not found. Install with:
  echo npm i -g pm2
  pause
  exit /b 1
)
echo.
pm2 status
goto END

:PM2_STOP
pm2 --version >nul 2>&1
if %errorlevel% neq 0 (
  echo ERROR: PM2 not found. Install with:
  echo npm i -g pm2
  pause
  exit /b 1
)
echo.
pm2 stop payment
pm2 delete payment
pm2 save
echo PM2 app "payment" stopped and deleted.
goto END

:EXIT_OK
echo.
echo Goodbye!
goto END

:END
pause
