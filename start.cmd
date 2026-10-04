@echo off
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. You can open dist\index.html directly instead.
  pause
  exit /b 1
)
node tools\serve.mjs
pause
