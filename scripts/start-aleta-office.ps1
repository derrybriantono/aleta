$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$PortalDir = Join-Path $Root "manajemen_surat"
$BotDir = Join-Path $Root "aleta_bot"
$LogDir = Join-Path $Root "runtime-logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Test-Listening {
  param([int]$Port)
  [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Start-AletaProcess {
  param(
    [string]$Name,
    [string]$WorkingDirectory,
    [string]$Command,
    [string]$LogFile
  )
  Write-Host "Starting $Name..."
  Start-Process -FilePath "powershell" `
    -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "Set-Location '$WorkingDirectory'; $Command *>> '$LogFile'") `
    -WindowStyle Hidden `
    -WorkingDirectory $WorkingDirectory | Out-Null
}

if (-not (Test-Listening -Port 3000)) {
  Start-AletaProcess -Name "Portal ALETA" -WorkingDirectory $PortalDir -Command "npm run start" -LogFile (Join-Path $LogDir "portal-office.log")
} else {
  Write-Host "Port 3000 already listening; portal start skipped."
}

if (-not (Test-Listening -Port 3003)) {
  Start-AletaProcess -Name "ALETA Bot" -WorkingDirectory $BotDir -Command "node app.js" -LogFile (Join-Path $LogDir "aleta-bot-office.log")
} else {
  Write-Host "Port 3003 already listening; aleta_bot start skipped."
}

Write-Host "Start requested. Run scripts\status-aleta-office.ps1 to verify."
