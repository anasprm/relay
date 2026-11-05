@echo off
rem One-click launcher for Windows: installs yt-dlp if needed, starts the
rem server, then opens the page in your default browser.
cd /d "%~dp0"

if not exist "bin\yt-dlp.exe" (
  echo First run - fetching yt-dlp...
  call npm run setup
  if errorlevel 1 (
    echo Setup failed. See README.md for manual installation.
    pause
    exit /b 1
  )
)

start "" cmd /c "timeout /t 2 >nul & start http://127.0.0.1:4173"
node server.js
pause
