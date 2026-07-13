param(
  [Parameter(Mandatory = $true)]
  [string]$PortablePath,
  [int]$TimeoutSeconds = 45
)

$ErrorActionPreference = 'Stop'
$portable = (Resolve-Path $PortablePath).Path
$userData = Join-Path $env:TEMP ("four-quadrant-portable-" + [guid]::NewGuid().ToString('N'))
$startedAt = Get-Date
$launcher = $null
$appProcess = $null

try {
  New-Item -ItemType Directory -Path $userData -Force | Out-Null
  $env:FOUR_QUADRANT_USER_DATA = $userData
  $env:E2E_EXIT_ON_CLOSE = '1'
  $env:ELECTRON_ENABLE_LOGGING = '1'

  $launcher = Start-Process -FilePath $portable -PassThru
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

  do {
    Start-Sleep -Milliseconds 500
    $appProcess = Get-Process -ErrorAction SilentlyContinue |
      Where-Object {
        $_.StartTime -ge $startedAt -and
        $_.MainWindowHandle -ne 0 -and
        ($_.MainWindowTitle -like '*四象日志*' -or $_.ProcessName -eq '四象日志')
      } |
      Select-Object -First 1
  } while (-not $appProcess -and (Get-Date) -lt $deadline)

  if (-not $appProcess) {
    throw ('单文件绿色版在 {0} 秒内未显示四象日志主窗口。' -f $TimeoutSeconds)
  }

  Write-Host "单文件绿色版启动成功：PID=$($appProcess.Id)，窗口=$($appProcess.MainWindowTitle)"
}
finally {
  if ($appProcess) {
    Stop-Process -Id $appProcess.Id -Force -ErrorAction SilentlyContinue
  }
  if ($launcher -and -not $launcher.HasExited) {
    Stop-Process -Id $launcher.Id -Force -ErrorAction SilentlyContinue
  }
  Remove-Item Env:FOUR_QUADRANT_USER_DATA -ErrorAction SilentlyContinue
  Remove-Item Env:E2E_EXIT_ON_CLOSE -ErrorAction SilentlyContinue
  Remove-Item Env:ELECTRON_ENABLE_LOGGING -ErrorAction SilentlyContinue
  Remove-Item -Path $userData -Recurse -Force -ErrorAction SilentlyContinue
}
