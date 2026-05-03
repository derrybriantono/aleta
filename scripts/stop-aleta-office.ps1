$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$PortalDir = Join-Path $Root "manajemen_surat"
$BotDir = Join-Path $Root "aleta_bot"

function Stop-AletaProcess {
  param([string]$Label, [string]$PathMarker)
  $processes = Get-CimInstance Win32_Process |
    Where-Object {
      $_.Name -match "node|npm|powershell" -and
      $_.CommandLine -and
      $_.CommandLine.Contains($PathMarker)
    }
  if (-not $processes) {
    Write-Host "$Label: no matching process."
    return
  }
  foreach ($process in $processes) {
    Write-Host "Stopping $Label PID $($process.ProcessId)"
    Stop-Process -Id $process.ProcessId -Force
  }
}

Stop-AletaProcess -Label "Portal ALETA" -PathMarker $PortalDir
Stop-AletaProcess -Label "ALETA Bot" -PathMarker $BotDir
Write-Host "Stopped matching ALETA processes only. WhatsApp session folder was not touched."
