@echo off
title DreamBinder
cd /d "%~dp0"
where npm >nul 2>nul
if errorlevel 1 goto no_node
echo Getting DreamBinder ready (the first time takes a minute or two)...
call npm install --no-audit --no-fund
if errorlevel 1 goto failed
call npm run build
if errorlevel 1 goto failed
start "" cmd /c "timeout /t 4 >nul & start http://localhost:3000"
echo.
echo DreamBinder is running at http://localhost:3000 - leave this window open. Close it to stop.
call npm start
goto end
:no_node
echo Node.js is not installed. Get the LTS version from https://nodejs.org/ then double-click this file again.
goto end
:failed
echo Something went wrong. Scroll up to see the error.
:end
pause
