$pluginRoot = 'C:\Users\ahmad\.understand-anything\repo\understand-anything-plugin'
$projectRoot = 'D:\AI\Github\local-ai-chat-studio'
$packageJson = Get-Content -Raw (Join-Path $pluginRoot 'package.json') | ConvertFrom-Json
$viewerUrl = "https://github.com/Egonex-AI/Understand-Anything/releases/download/v$($packageJson.version)/understand-anything-viewer.tgz"
$logDir = Join-Path $projectRoot '.ua\dashboard'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$stdout = Join-Path $logDir 'viewer.stdout.log'
$stderr = Join-Path $logDir 'viewer.stderr.log'
$process = Start-Process -FilePath 'npx.cmd' -ArgumentList @('--yes', $viewerUrl, $projectRoot) -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
$deadline = (Get-Date).AddSeconds(55)
$dashboardUrl = $null
do {
    Start-Sleep -Milliseconds 500
    if (Test-Path $stdout) {
        $match = Select-String -Path $stdout -Pattern 'https?://127\.0\.0\.1:\d+\?token=\S+' | Select-Object -Last 1
        if ($match) {
            $dashboardUrl = $match.Matches[0].Value
        }
    }
} while (-not $dashboardUrl -and (Get-Date) -lt $deadline -and -not $process.HasExited)
Write-Output "PID=$($process.Id)"
Write-Output "VERSION=$($packageJson.version)"
if ($dashboardUrl) {
    Write-Output "DASHBOARD_URL=$dashboardUrl"
} else {
    Write-Output "FAST_PATH_FAILED=$($process.HasExited)"
    if (Test-Path $stdout) { Get-Content $stdout -Tail 30 }
    if (Test-Path $stderr) { Get-Content $stderr -Tail 30 }
}
