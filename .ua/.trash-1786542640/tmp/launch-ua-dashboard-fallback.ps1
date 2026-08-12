$projectRoot = 'D:\AI\Github\local-ai-chat-studio'
$dashboardRoot = 'C:\Users\ahmad\.understand-anything\repo\understand-anything-plugin\packages\dashboard'
$logDir = Join-Path $projectRoot '.ua\dashboard'
$stdout = Join-Path $logDir 'vite.stdout.log'
$stderr = Join-Path $logDir 'vite.stderr.log'
$environment = @{ GRAPH_DIR = $projectRoot }
$process = Start-Process -FilePath 'npx.cmd' -ArgumentList @('vite', '--host', '127.0.0.1') -WorkingDirectory $dashboardRoot -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -Environment $environment -PassThru
$deadline = (Get-Date).AddSeconds(55)
$dashboardUrl = $null
do {
    Start-Sleep -Milliseconds 500
    foreach ($path in @($stdout, $stderr)) {
        if (Test-Path $path) {
            $match = Select-String -Path $path -Pattern 'https?://127\.0\.0\.1:\d+\?token=\S+' | Select-Object -Last 1
            if ($match) { $dashboardUrl = $match.Matches[0].Value }
        }
    }
} while (-not $dashboardUrl -and (Get-Date) -lt $deadline -and -not $process.HasExited)
Write-Output "PID=$($process.Id)"
if ($dashboardUrl) {
    Write-Output "DASHBOARD_URL=$dashboardUrl"
} else {
    Write-Output "FALLBACK_FAILED=$($process.HasExited)"
    if (Test-Path $stdout) { Get-Content $stdout -Tail 30 }
    if (Test-Path $stderr) { Get-Content $stderr -Tail 30 }
}
