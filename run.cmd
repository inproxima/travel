@echo off
rem Starts the travel planner. Usage: run [dev^|mock^|prod^|check^|test]
setlocal
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js 22.13 or newer is required. Install the LTS version from https://nodejs.org & exit /b 1)
node -e "const [a,b]=process.versions.node.split('.').map(Number); process.exit(a>22||(a===22&&b>=13)?0:1)" || (echo Your Node.js is too old. Install 22.13 or newer from https://nodejs.org & exit /b 1)
node scripts\run.mjs %*
