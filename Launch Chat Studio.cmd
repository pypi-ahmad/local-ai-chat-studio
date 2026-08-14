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
$PythonStateFile = Join-Path $Runtime "python-setup.sha256"
$FrontendInstallStateFile = Join-Path $Runtime "frontend-install.sha256"
$FrontendBuildStateFile = Join-Path $Runtime "frontend-build.sha256"
$AppUrl = "http://127.0.0.1:8506"
$HealthUrl = "$AppUrl/api/v1/health"
$CheckOnly = ([string]$env:CHAT_STUDIO_LAUNCH_ARGS).Trim() -eq "--check"

function Write-Step([string]$Message) {
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Get-Sha256File([string]$Path) {
    $sha = [Security.Cryptography.SHA256]::Create()
    $stream = [IO.File]::OpenRead($Path)
    try { return ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace("-", "").ToLowerInvariant() }
    finally { $stream.Dispose(); $sha.Dispose() }
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

function Get-PortOwnerIds {
    $owners = @()
    if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
        $owners = @(Get-NetTCPConnection -LocalPort 8506 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)
    }
    if (!$owners) {
        $owners = @(netstat -ano -p tcp 2>$null | ForEach-Object {
            if ($_ -match '^\s*TCP\s+\S+:8506\s+\S+\s+LISTENING\s+(\d+)\s*$') { [int]$Matches[1] }
        } | Select-Object -Unique)
    }
    return @($owners | Where-Object { $_ -and $_ -ne $PID })
}

function Wait-PortClear([int]$Seconds) {
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        if (!(Test-LocalPort)) { return $true }
        Start-Sleep -Milliseconds 250
    }
    return !(Test-LocalPort)
}

function Clear-LocalPort {
    if (!(Test-LocalPort)) { return }
    if (Test-AppHealth) {
        Write-Step "Stopping the previous Local AI Chat Studio"
        try {
            Invoke-RestMethod -Method Post -Uri "$AppUrl/api/v1/runtime/shutdown" -Headers @{ "X-Local-Studio" = "shutdown" } -TimeoutSec 5 | Out-Null
        } catch {
            Write-Host "Managed shutdown was unavailable; resolving the port owner." -ForegroundColor Yellow
        }
        if (Wait-PortClear 8) { return }
    }

    $owners = @(Get-PortOwnerIds)
    if (!$owners) { throw "Port 8506 is occupied, but its owning process could not be identified" }
    foreach ($owner in $owners) {
        $process = Get-Process -Id $owner -ErrorAction SilentlyContinue
        $label = if ($process) { "$($process.ProcessName) (PID $owner)" } else { "PID $owner" }
        Write-Step "Terminating port 8506 owner: $label"
        Stop-Process -Id $owner -Force -ErrorAction Stop
    }
    if (!(Wait-PortClear 8)) { throw "Port 8506 could not be cleared" }
}

function Get-PythonSetupFingerprint {
    $projectHash = Get-Sha256File (Join-Path $Root "pyproject.toml")
    $lockHash = Get-Sha256File (Join-Path $Root "uv.lock")
    return "$projectHash`:$lockHash"
}

function Test-PythonSetup {
    $python = Join-Path $Root ".venv/Scripts/python.exe"
    $entrypoint = Join-Path $Root ".venv/Scripts/chat-studio.exe"
    if (!(Test-Path $python) -or !(Test-Path $entrypoint) -or !(Test-Path $PythonStateFile)) {
        return $false
    }
    return (Get-Content -LiteralPath $PythonStateFile -Raw).Trim() -eq (Get-PythonSetupFingerprint)
}

function Get-FilesFingerprint([IO.FileInfo[]]$Files) {
    $lines = @($Files | Sort-Object FullName -Unique | ForEach-Object {
        $relative = [IO.Path]::GetRelativePath($Root, $_.FullName).Replace("\", "/")
        $hash = Get-Sha256File $_.FullName
        "$relative`:$hash"
    })
    $bytes = [Text.Encoding]::UTF8.GetBytes(($lines -join "`n"))
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace("-", "").ToLowerInvariant() }
    finally { $sha.Dispose() }
}

function Get-FrontendInstallFingerprint {
    return Get-FilesFingerprint @(
        Get-Item (Join-Path $Frontend "package.json"), (Join-Path $Frontend "package-lock.json")
    )
}

function Get-FrontendBuildFingerprint {
    $inputs = @(
        Get-ChildItem (Join-Path $Frontend "src") -File -Recurse
        Get-Item (Join-Path $Frontend "package.json"), (Join-Path $Frontend "package-lock.json")
        Get-ChildItem $Frontend -File | Where-Object Name -Match "^(tsconfig.*\.json|vite\.config\..*|vitest\.config\..*|index\.html)$"
    )
    return Get-FilesFingerprint $inputs
}

function Get-FrontendState {
    $lock = Join-Path $Frontend "package-lock.json"
    $installedLock = Join-Path $Frontend "node_modules/.package-lock.json"
    $dist = Join-Path $Frontend "dist/index.html"
    if (Test-Path $FrontendInstallStateFile) {
        $needsInstall = !(Test-Path $installedLock) -or
            (Get-Content $FrontendInstallStateFile -Raw).Trim() -ne (Get-FrontendInstallFingerprint)
    } else {
        $needsInstall = !(Test-Path $installedLock) -or (Get-Item $lock).LastWriteTimeUtc -gt (Get-Item $installedLock).LastWriteTimeUtc
    }
    if (Test-Path $FrontendBuildStateFile) {
        $needsBuild = !(Test-Path $dist) -or
            (Get-Content $FrontendBuildStateFile -Raw).Trim() -ne (Get-FrontendBuildFingerprint)
    } else {
        $needsBuild = !(Test-Path $dist)
        if (!$needsBuild) {
            $builtAt = (Get-Item $dist).LastWriteTimeUtc
            $buildInputs = @(
                Get-ChildItem (Join-Path $Frontend "src") -File -Recurse
                Get-Item (Join-Path $Frontend "package.json"), (Join-Path $Frontend "package-lock.json")
                Get-ChildItem $Frontend -File | Where-Object Name -Match "^(tsconfig.*\.json|vite\.config\..*|vitest\.config\..*|index\.html)$"
            )
            $needsBuild = $null -ne ($buildInputs | Where-Object LastWriteTimeUtc -gt $builtAt | Select-Object -First 1)
        }
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
        $actual = Get-Sha256File $archive
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

    $pythonReady = Test-PythonSetup
    $frontendState = Get-FrontendState
    if ($CheckOnly) {
        Write-Host "Local AI Chat Studio launcher check" -ForegroundColor Green
        Write-Host "Repository:       $Root"
        Write-Host "Portable uv:      $(if (Test-Path $Uv) { 'ready' } else { 'would install' })"
        Write-Host "Portable Node:    $(if (Test-Path $Node) { 'ready' } else { 'would install' })"
        Write-Host "Python packages:  $(if ($pythonReady) { 'ready' } else { 'would install or update' })"
        Write-Host "npm packages:     $(if ($frontendState.NeedsInstall) { 'would install' } else { 'ready' })"
        Write-Host "Frontend build:   $(if ($frontendState.NeedsBuild) { 'would build' } else { 'ready' })"
        Write-Host "Ollama:           $(if (Get-Command ollama -ErrorAction SilentlyContinue) { 'available' } else { 'optional; not installed' })"
        $owners = @(Get-PortOwnerIds)
        Write-Host "Port 8506:        $(if (Test-AppHealth) { 'Studio running; would restart' } elseif (Test-LocalPort) { "occupied; would terminate PID(s) $($owners -join ', ')" } else { 'available' })"
        exit 0
    }

    Clear-LocalPort

    if (!(Test-Path $Uv)) { Install-Uv }
    if (!(Test-Path $Node)) { Install-Node }

    $env:UV_PYTHON_INSTALL_DIR = Join-Path $Runtime "python"
    $env:UV_CACHE_DIR = Join-Path $Runtime "uv-cache"
    $env:UV_PROJECT_ENVIRONMENT = Join-Path $Root ".venv"
    $env:npm_config_cache = Join-Path $Runtime "npm-cache"
    $env:PATH = "$NodeDir;$UvDir;$env:PATH"

    if (!$pythonReady) {
        Write-Step "Installing Python dependencies"
        & $Uv sync --locked
        if ($LASTEXITCODE -ne 0) { throw "Python dependency installation failed" }
        New-Item -ItemType Directory -Path $Runtime -Force | Out-Null
        Set-Content -LiteralPath $PythonStateFile -Value (Get-PythonSetupFingerprint) -NoNewline
    }

    $frontendState = Get-FrontendState
    if (!$frontendState.NeedsInstall -and !(Test-Path $FrontendInstallStateFile)) {
        Set-Content -LiteralPath $FrontendInstallStateFile -Value (Get-FrontendInstallFingerprint) -NoNewline
    }
    if (!$frontendState.NeedsBuild -and !(Test-Path $FrontendBuildStateFile)) {
        Set-Content -LiteralPath $FrontendBuildStateFile -Value (Get-FrontendBuildFingerprint) -NoNewline
    }
    Push-Location $Frontend
    try {
        if ($frontendState.NeedsInstall) {
            Write-Step "Installing frontend dependencies"
            & $Npm ci --legacy-peer-deps --no-audit --no-fund
            if ($LASTEXITCODE -ne 0) { throw "Frontend dependency installation failed" }
            Set-Content -LiteralPath $FrontendInstallStateFile -Value (Get-FrontendInstallFingerprint) -NoNewline
        }
        if ($frontendState.NeedsBuild) {
            Write-Step "Building the frontend"
            & $Npm run build
            if ($LASTEXITCODE -ne 0) { throw "Frontend build failed" }
            Set-Content -LiteralPath $FrontendBuildStateFile -Value (Get-FrontendBuildFingerprint) -NoNewline
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
    & $Uv run --no-sync chat-studio
    exit $LASTEXITCODE
} catch {
    Write-Host "`nLaunch failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Run `"Launch Chat Studio.cmd --check`" for a non-installing status report." -ForegroundColor Yellow
    exit 1
}
