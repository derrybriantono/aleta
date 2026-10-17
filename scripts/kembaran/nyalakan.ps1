# ALETA - menyalakan KEMBARAN di laptop (tanpa Docker). Jalankan lewat PowerShell, BUKAN Git Bash
# (MSYS merusak NEXT_PUBLIC_BASE_PATH=/aleta menjadi C:/Program Files/Git/aleta).
#
#   powershell -File scripts\kembaran\nyalakan.ps1                 bot + portal (mode dev)
#   powershell -File scripts\kembaran\nyalakan.ps1 -Apa bot        bot saja
#   powershell -File scripts\kembaran\nyalakan.ps1 -Portal produksi portal hasil `npm run build` (bukan dev)
#   powershell -File scripts\kembaran\nyalakan.ps1 -Henti          mematikan bot dan portal kembaran
#
# Prasyarat (sekali): MySQL XAMPP hidup (sipp_donggala, aps_badilag, aleta_bot), PostgreSQL 16
# hidup, manajemen_surat\.env.local dan aleta_bot\.env sudah ada, token internal bot-portal sama.
# SIPP lokal (port 8056) dinyalakan terpisah: D:\sipp-server\jalankan-sipp.ps1
#
# TIDAK PERNAH menyalakan WhatsApp: ALETA_MODE=kembaran mematikannya di dalam kode bot.
param(
  [ValidateSet('semua', 'bot', 'portal')][string]$Apa = 'semua',
  [ValidateSet('dev', 'produksi')][string]$Portal = 'dev',
  [switch]$Henti
)

$ErrorActionPreference = 'Stop'
$akar = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$kerja = 'D:\Aplikasi\aleta\kembaran'
$log = Join-Path $kerja 'log'
New-Item -ItemType Directory -Force $log | Out-Null
New-Item -ItemType Directory -Force 'D:\Aplikasi\aleta\tmp' | Out-Null

# Tidak satu pun berkas sementara ke drive C:
$env:TMP = 'D:\Aplikasi\aleta\tmp'
$env:TEMP = 'D:\Aplikasi\aleta\tmp'
$env:npm_config_cache = 'D:\Aplikasi\aleta\cache\npm'

if ($Henti) {
  foreach ($p in 3003, 3000) {
    $dengar = Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue
    foreach ($d in $dengar) { Stop-Process -Id $d.OwningProcess -Force -ErrorAction SilentlyContinue; Write-Host "Dimatikan: port $p (proses $($d.OwningProcess))" }
  }
  return
}

# --- Penanda mode dan basis data (salinan hasil tarikan, bukan server) ---------------------------------
$env:ALETA_MODE = 'kembaran'
$env:ALETA_KEMBARAN_DIR = $kerja
$env:ALETA_BOT_DB_HOST = '127.0.0.1'
$env:ALETA_BOT_DB_PORT = '3306'
$env:ALETA_BOT_DB_NAME = 'aleta_bot'
$env:ALETA_BOT_DB_SIPP_NAME = 'sipp_donggala'
$env:ALETA_BOT_DB_APS_NAME = 'aps_badilag'
$env:ALETA_BOT_DB5_NAME = 'aps_badilag'
$env:ALETA_BOT_DB_ANTRIAN_NAME = 'sipp_turunan_antrian'
$env:ALETA_BOT_DB4_NAME = 'sipp_turunan_antrian'
$env:ALETA_SIPP_ROOT = 'D:\Aplikasi\SIPP'
$env:ALETA_BOT_QUEUE_WORKER_ENABLED = 'false'
$env:ALETA_BOT_BASE_URL = 'http://127.0.0.1:3003'
# Sambungan ke MySQL SERVER untuk mendorong antrean (terowongan ssh: ssh -N -L 33306:127.0.0.1:3306 aleta).
# Isi ALETA_KEMBARAN_SERVER_DB_USER / _PASSWORD di aleta_bot\.env - JANGAN di berkas ini.
if (-not $env:ALETA_KEMBARAN_SERVER_DB_HOST) { $env:ALETA_KEMBARAN_SERVER_DB_HOST = '127.0.0.1' }
if (-not $env:ALETA_KEMBARAN_SERVER_DB_PORT) { $env:ALETA_KEMBARAN_SERVER_DB_PORT = '33306' }

if ($Apa -in 'semua', 'bot') {
  Write-Host 'Menyalakan bot kembaran (port 3003) ...'
  Start-Process -FilePath 'node' -ArgumentList 'app.js' -WorkingDirectory (Join-Path $akar 'aleta_bot') `
    -RedirectStandardOutput (Join-Path $log 'bot.out.log') -RedirectStandardError (Join-Path $log 'bot.err.log') -WindowStyle Hidden
}

if ($Apa -in 'semua', 'portal') {
  $env:NEXT_PUBLIC_BASE_PATH = '/aleta'
  $env:NEXT_TELEMETRY_DISABLED = '1'
  $perintah = if ($Portal -eq 'produksi') { 'start' } else { 'dev' }
  Write-Host "Menyalakan portal kembaran (port 3000, mode $Portal, basePath /aleta) ..."
  Start-Process -FilePath 'npm.cmd' -ArgumentList 'run', $perintah -WorkingDirectory (Join-Path $akar 'manajemen_surat') `
    -RedirectStandardOutput (Join-Path $log 'portal.out.log') -RedirectStandardError (Join-Path $log 'portal.err.log') -WindowStyle Hidden
}

Write-Host "Catatan: $log"
Write-Host 'Portal: http://127.0.0.1:3000/aleta   (pita "Mode kembaran" tampil di puncak halaman)'
Write-Host 'Bot:    http://127.0.0.1:3003/health  (mode: kembaran)'
