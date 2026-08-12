@echo off
setlocal
title Local AI Chat Studio
set "CHAT_STUDIO_LAUNCHER=%~f0"
set "CHAT_STUDIO_LAUNCH_ARGS=%*"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$content = Get-Content -LiteralPath $env:CHAT_STUDIO_LAUNCHER -Raw; $marker = '#__POWER' + 'SHELL_BELOW__'; $offset = $content.LastIndexOf($marker); if ($offset -lt 0) { throw 'Launcher payload is missing' }; $script = $content.Substring($offset + $marker.Length); & ([scriptblock]::Create($script))"
set "LAUNCH_EXIT=%ERRORLEVEL%"
if not "%LAUNCH_EXIT%"=="0" pause
exit /b %LAUNCH_EXIT%

#__POWERSHELL_BELOW__
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Root = Split-Path -Parent $env:CHAT_STUDIO_LAUNCHER
$Runtime = Join-Path $Root ".runtime"
$UvDir = Join-Path $Runtime "uv"
$Uv = Join-Path $UvDir "uv.exe"
$NodeDir = Join-Path $Runtime "node"
$Node = Join-Path $NodeDir "node.exe"
$Npm = Join-Path $NodeDir "npm.cmd"
$Frontend = Join-Path $Root "frontend"
$AppUrl = "http://127.0.0.1:8506"
$HealthUrl = "$AppUrl/api/v1/health"
$CheckOnly = ([string]$env:CHAT_STUDIO_LAUNCH_ARGS).Trim() -eq "--check"

function Write-Step([string]$Message) {
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Test-AppHealth {
    try {
        $health = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 2
        return $health.status -eq "ok" -and [string]$health.version -eq "2"
    } catch {
        return $false
    }
}

function Test-LocalPort {
    $client = [Net.Sockets.TcpClient]::new()
    try {
        $pending = $client.BeginConnect("127.0.0.1", 8506, $null, $null)
        return $pending.AsyncWaitHandle.WaitOne(400) -and $client.Connected
    } catch {
        return $false
    } finally {
        $client.Dispose()
    }
}

function Get-FrontendState {
    $lock = Join-Path $Frontend "package-lock.json"
    $installedLock = Join-Path $Frontend "node_modules/.package-lock.json"
    $dist = Join-Path $Frontend "dist/index.html"
    $needsInstall = !(Test-Path $installedLock) -or (Get-Item $lock).LastWriteTimeUtc -gt (Get-Item $installedLock).LastWriteTimeUtc
    $needsBuild = !(Test-Path $dist)
    if (!$needsBuild) {
        $builtAt = (Get-Item $dist).LastWriteTimeUtc
        $inputs = @(
            Get-ChildItem (Join-Path $Frontend "src") -File -Recurse
            Get-Item (Join-Path $Frontend "package.json"), (Join-Path $Frontend "package-lock.json")
            Get-ChildItem $Frontend -File | Where-Object Name -Match "^(tsconfig.*\.json|vite\.config\..*|index\.html)$"
        )
        $needsBuild = $null -ne ($inputs | Where-Object LastWriteTimeUtc -gt $builtAt | Select-Object -First 1)
    }
    return @{ NeedsInstall = $needsInstall; NeedsBuild = $needsBuild }
}

function Install-Uv {
    Write-Step "Installing portable uv"
    New-Item -ItemType Directory -Path $UvDir -Force | Out-Null
    $env:UV_UNMANAGED_INSTALL = $UvDir
    $env:UV_NO_MODIFY_PATH = "1"
    $installer = Invoke-RestMethod -Uri "https://astral.sh/uv/install.ps1"
    & ([scriptblock]::Create($installer))
    if (!(Test-Path $Uv)) { throw "uv installation did not create $Uv" }
}

function Install-Node {
    Write-Step "Installing portable Node.js LTS"
    New-Item -ItemType Directory -Path $Runtime -Force | Out-Null
    $architecture = if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { "arm64" } else { "x64" }
    $releases = Invoke-RestMethod -Uri "https://nodejs.org/dist/index.json"
    $release = $releases | Where-Object { $_.lts -and $_.files -contains "win-$architecture-zip" } | Select-Object -First 1
    if (!$release) { throw "No supported Windows $architecture Node.js LTS archive was found" }

    $version = [string]$release.version
    $archiveName = "node-$version-win-$architecture.zip"
    $baseUrl = "https://nodejs.org/dist/$version"
    $downloads = Join-Path $Runtime "downloads"
    $archive = Join-Path $downloads $archiveName
    $checksums = Join-Path $downloads "SHASUMS256-$version.txt"
    $stage = Join-Path $Runtime "node-install-$PID"
    $runtimePrefix = [IO.Path]::GetFullPath($Runtime).TrimEnd("\") + "\"
    $stagePath = [IO.Path]::GetFullPath($stage)
    if (!$stagePath.StartsWith($runtimePrefix, [StringComparison]::OrdinalIgnoreCase)) { throw "Unsafe Node.js staging path" }
    New-Item -ItemType Directory -Path $downloads -Force | Out-Null

    try {
        Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/$archiveName" -OutFile $archive
        Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/SHASUMS256.txt" -OutFile $checksums
        $checksumLine = Get-Content $checksums | Where-Object { $_ -match "\s+$([regex]::Escape($archiveName))$" } | Select-Object -First 1
        if (!$checksumLine) { throw "Official checksum for $archiveName was not found" }
        $expected = ($checksumLine -split "\s+")[0].ToLowerInvariant()
        $actual = (Get-FileHash $archive -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actual -ne $expected) { throw "Node.js archive checksum verification failed" }

        Expand-Archive -LiteralPath $archive -DestinationPath $stage
        $expanded = Get-ChildItem $stage -Directory | Select-Object -First 1
        if (!$expanded -or !(Test-Path (Join-Path $expanded.FullName "node.exe"))) { throw "Node.js archive layout was not recognized" }
        if (Test-Path $NodeDir) { throw "Partial Node.js installation exists at $NodeDir; remove it and retry" }
        Move-Item -LiteralPath $expanded.FullName -Destination $NodeDir
    } finally {
        if (Test-Path $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
        if (Test-Path $archive) { Remove-Item -LiteralPath $archive -Force }
        if (Test-Path $checksums) { Remove-Item -LiteralPath $checksums -Force }
    }
    if (!(Test-Path $Node) -or !(Test-Path $Npm)) { throw "Node.js installation is incomplete" }
}

try {
    Set-Location $Root
    foreach ($required in @("pyproject.toml", "uv.lock", "frontend/package.json", "frontend/package-lock.json")) {
        if (!(Test-Path (Join-Path $Root $required))) { throw "Required project file is missing: $required" }
    }

    $frontendState = Get-FrontendState
    if ($CheckOnly) {
        Write-Host "Local AI Chat Studio launcher check" -ForegroundColor Green
        Write-Host "Repository:       $Root"
        Write-Host "Portable uv:      $(if (Test-Path $Uv) { 'ready' } else { 'would install' })"
        Write-Host "Portable Node:    $(if (Test-Path $Node) { 'ready' } else { 'would install' })"
        Write-Host "Python packages:  $(if (Test-Path (Join-Path $Root '.venv')) { 'present; uv sync will verify' } else { 'would install' })"
        Write-Host "npm packages:     $(if ($frontendState.NeedsInstall) { 'would install' } else { 'ready' })"
        Write-Host "Frontend build:   $(if ($frontendState.NeedsBuild) { 'would build' } else { 'ready' })"
        Write-Host "Ollama:           $(if (Get-Command ollama -ErrorAction SilentlyContinue) { 'available' } else { 'optional; not installed' })"
        Write-Host "Port 8506:        $(if (Test-AppHealth) { 'app already running' } elseif (Test-LocalPort) { 'occupied by another process' } else { 'available' })"
        exit 0
    }

    if (Test-AppHealth) {
        Write-Host "Local AI Chat Studio is already running." -ForegroundColor Green
        Start-Process $AppUrl
        exit 0
    }
    if (Test-LocalPort) { throw "Port 8506 is already used by another process" }

    if (!(Test-Path $Uv)) { Install-Uv }
    if (!(Test-Path $Node)) { Install-Node }

    $env:UV_PYTHON_INSTALL_DIR = Join-Path $Runtime "python"
    $env:UV_CACHE_DIR = Join-Path $Runtime "uv-cache"
    $env:UV_PROJECT_ENVIRONMENT = Join-Path $Root ".venv"
    $env:npm_config_cache = Join-Path $Runtime "npm-cache"
    $env:PATH = "$NodeDir;$UvDir;$env:PATH"

    Write-Step "Checking Python dependencies"
    & $Uv sync --locked
    if ($LASTEXITCODE -ne 0) { throw "Python dependency installation failed" }

    $frontendState = Get-FrontendState
    Push-Location $Frontend
    try {
        if ($frontendState.NeedsInstall) {
            Write-Step "Installing frontend dependencies"
            & $Npm ci --no-audit --no-fund
            if ($LASTEXITCODE -ne 0) { throw "Frontend dependency installation failed" }
        }
        if ($frontendState.NeedsBuild) {
            Write-Step "Building the frontend"
            & $Npm run build
            if ($LASTEXITCODE -ne 0) { throw "Frontend build failed" }
        }
    } finally {
        Pop-Location
    }

    if (!(Get-Command ollama -ErrorAction SilentlyContinue)) {
        Write-Host "`nNote: Ollama is not installed. The app will still work with configured cloud providers." -ForegroundColor Yellow
    }

    $poller = @"
`$deadline = (Get-Date).AddSeconds(60)
while ((Get-Date) -lt `$deadline) {
    try {
        `$health = Invoke-RestMethod -Uri '$HealthUrl' -TimeoutSec 2
        if (`$health.status -eq 'ok' -and [string]`$health.version -eq '2') { Start-Process '$AppUrl'; exit 0 }
    } catch {}
    Start-Sleep -Milliseconds 400
}
"@
    $encodedPoller = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($poller))
    Start-Process powershell.exe -WindowStyle Hidden -ArgumentList "-NoLogo", "-NoProfile", "-EncodedCommand", $encodedPoller | Out-Null

    Write-Step "Starting Local AI Chat Studio"
    Write-Host "The browser will open at $AppUrl when the server is ready. Press Ctrl+C to stop.`n"
    & $Uv run chat-studio
    exit $LASTEXITCODE
} catch {
    Write-Host "`nLaunch failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Run `"Launch Chat Studio.cmd --check`" for a non-installing status report." -ForegroundColor Yellow
    exit 1
}
