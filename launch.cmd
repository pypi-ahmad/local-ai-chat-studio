@echo off
setlocal enabledelayedexpansion
title Local AI Chat Studio — Setup ^& Launch
set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"
set "VENV=%ROOT%\.venv"
set "FRONTEND=%ROOT%\frontend"
set "DIST=%FRONTEND%\dist"

:: ── helpers ─────────────────────────────────────────────────────────────────

:step
echo.
echo ==^> %~1
goto :eof

:fail
echo.
echo ERROR: %~1
echo.
pause
exit /b 1

:: ── pre-flight checks ────────────────────────────────────────────────────────

call :step "Checking prerequisites"

where uv >nul 2>&1
if errorlevel 1 (
    echo uv is not installed.
    echo Install it from: https://docs.astral.sh/uv/getting-started/installation/
    echo   Windows:  winget install --id=astral-sh.uv -e
    echo   or curl:  powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
    call :fail "uv not found — install it and re-run"
    exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
    echo Node.js is not installed.
    echo Install it from: https://nodejs.org  (LTS recommended)
    call :fail "node not found — install Node.js and re-run"
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    call :fail "npm not found — reinstall Node.js from https://nodejs.org"
    exit /b 1
)

for /f "tokens=*" %%v in ('uv --version 2^>nul') do echo   uv      : %%v
for /f "tokens=*" %%v in ('node --version 2^>nul') do echo   node    : %%v
for /f "tokens=*" %%v in ('npm --version 2^>nul') do echo   npm     : %%v

:: ── Python venv + dependencies ───────────────────────────────────────────────

call :step "Setting up Python environment (venv in project root)"
cd /d "%ROOT%"

if not exist "%VENV%\Scripts\activate.bat" (
    echo Creating virtual environment...
    uv venv --python 3.12 "%VENV%"
    if errorlevel 1 call :fail "uv venv failed"
)

echo Syncing dependencies from lockfile...
uv sync --locked
if errorlevel 1 call :fail "uv sync failed — run 'uv lock --upgrade' if lock file is stale"

:: ── Frontend build ───────────────────────────────────────────────────────────

call :step "Building frontend"
cd /d "%FRONTEND%"

if not exist "node_modules" (
    echo Installing npm packages...
    npm ci --legacy-peer-deps
    if errorlevel 1 call :fail "npm ci failed"
)

if not exist "%DIST%\index.html" (
    echo Building production bundle...
    npm run build
    if errorlevel 1 call :fail "npm run build failed"
) else (
    echo Frontend already built — skipping (delete dist\ to force rebuild)
)

:: ── Launch ───────────────────────────────────────────────────────────────────

call :step "Starting Local AI Chat Studio"
cd /d "%ROOT%"
echo   URL: http://127.0.0.1:8506
echo   Stop: Ctrl+C
echo.

uv run chat-studio
if errorlevel 1 call :fail "chat-studio exited with an error"
exit /b 0
