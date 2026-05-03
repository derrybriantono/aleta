$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$PortalDir = Join-Path $Root "manajemen_surat"
$BotDir = Join-Path $Root "aleta_bot"

function Get-AletaProcess {
  param([string]$PathMarker)
  Get-CimInstance Win32_Process |
    Where-Object {
      $_.Name -match "node|npm|powershell" -and
      $_.CommandLine -and
      $_.CommandLine.Contains($PathMarker)
    } |
    Select-Object ProcessId, Name, CommandLine
}

function Get-PortStatus {
  param([int]$Port)
  $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if (-not $connections) {
    [pscustomobject]@{ Port = $Port; Listening = $false; ProcessIds = "" }
    return
  }
  [pscustomobject]@{
    Port = $Port
    Listening = $true
    ProcessIds = (($connections | Select-Object -ExpandProperty OwningProcess -Unique) -join ",")
  }
}

Write-Host "ALETA Office Status"
Write-Host "Root: $Root"
Write-Host ""
Write-Host "Ports"
Get-PortStatus -Port 3000 | Format-Table -AutoSize
Get-PortStatus -Port 3003 | Format-Table -AutoSize

Write-Host ""
Write-Host "Portal processes"
Get-AletaProcess -PathMarker $PortalDir | Select-Object ProcessId, Name | Format-Table -AutoSize

Write-Host ""
Write-Host "ALETA Bot processes"
Get-AletaProcess -PathMarker $BotDir | Select-Object ProcessId, Name | Format-Table -AutoSize

Write-Host ""
Write-Host "Readiness"
Push-Location $Root
try {
  node scripts\aleta-office-server-readiness.mjs
} finally {
  Pop-Location
}
