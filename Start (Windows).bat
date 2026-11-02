@echo off
title DreamBinder
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto no_node
node scripts\update.mjs
node scripts\launch.mjs
goto end
:no_node
echo Node.js is not installed. Get the LTS version from https://nodejs.org/ then double-click this file again.
:end
pause
