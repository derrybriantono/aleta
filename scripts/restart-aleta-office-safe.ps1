$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
& (Join-Path $ScriptDir "stop-aleta-office.ps1")
Start-Sleep -Seconds 3
& (Join-Path $ScriptDir "start-aleta-office.ps1")
Start-Sleep -Seconds 5
& (Join-Path $ScriptDir "status-aleta-office.ps1")
