# =============================================================================
# ALETA E-Court - memasang penyegar ekstensi sebagai Tugas Terjadwal
# =============================================================================
#
# Dijalankan SEKALI di tiap komputer petugas. Tidak perlu hak Administrator:
# tugasnya milik pengguna yang menjalankannya, bukan milik sistem.
#
# Sesudah ini, folder ekstensi disegarkan dari portal saat masuk Windows dan
# setiap 4 jam. Yang tersisa untuk dikerjakan orang hanya sekali: memuat
# foldernya di chrome://extensions - petunjuknya dicetak di akhir.
#
# Menjalankan ulang berkas ini aman; tugas yang sudah ada diganti.
#
#   Memasang : powershell -ExecutionPolicy Bypass -File pasang-sinkron.ps1
#   Mencabut : powershell -ExecutionPolicy Bypass -File pasang-sinkron.ps1 -Copot
# =============================================================================

param(
  [string]$Portal = "http://192.168.10.10/aleta",
  [switch]$Copot
)

$ErrorActionPreference = "Stop"
$namaTugas = "ALETA - sinkron ekstensi SIPP"
# Di akar profil, bukan di dalam AppData - lihat keterangan di sinkron-ekstensi.ps1.
$rumah = "$env:USERPROFILE\ALETA"
$skrip = Join-Path $rumah "sinkron-ekstensi.ps1"
$tujuan = Join-Path $rumah "ekstensi-sipp"
$startup = [Environment]::GetFolderPath("Startup")
$pintasan = Join-Path $startup "ALETA - sinkron ekstensi.cmd"

if ($Copot) {
  try {
    Unregister-ScheduledTask -TaskName $namaTugas -Confirm:$false -ErrorAction Stop
    Write-Output "Tugas terjadwal dicabut."
  } catch {
    Write-Output "Tugas terjadwal tidak ada - dilewati."
  }
  if (Test-Path $pintasan) {
    Remove-Item -LiteralPath $pintasan -Force
    Write-Output "Pemicu di folder Startup dihapus."
  }
  Write-Output "Folder ekstensi di $tujuan SENGAJA dibiarkan, supaya ekstensi yang"
  Write-Output "sedang dipakai tidak hilang mendadak. Hapus sendiri bila memang tidak dipakai lagi."
  exit 0
}

# -----------------------------------------------------------------------------
# 1. Salin skrip ke tempat yang tetap
# -----------------------------------------------------------------------------
# Tugas terjadwal menunjuk berkas berdasarkan letaknya. Bila yang ditunjuk
# berkas di flashdisk atau di folder unduhan, tugasnya akan gagal diam-diam
# begitu berkas itu pindah - dan diamnya tidak akan terlihat sampai ada yang
# menyadari ekstensinya tertinggal berminggu-minggu.
$asal = Join-Path $PSScriptRoot "sinkron-ekstensi.ps1"
if (-not (Test-Path $asal)) {
  Write-Output "GAGAL: sinkron-ekstensi.ps1 tidak ada di folder yang sama dengan berkas ini."
  exit 1
}
if (-not (Test-Path $rumah)) { New-Item -ItemType Directory -Force $rumah | Out-Null }
Copy-Item -LiteralPath $asal -Destination $skrip -Force
Write-Output "Skrip disalin ke $skrip"

# -----------------------------------------------------------------------------
# 2. Pasang pemicunya
# -----------------------------------------------------------------------------
# Dicoba Tugas Terjadwal lebih dulu karena ia dapat berjalan BERULANG di siang
# hari, menangkap komputer yang menyala berhari-hari tanpa pernah masuk ulang.
#
# Tetapi di banyak komputer kantor, membuat tugas terjadwal menuntut hak
# Administrator - bahkan untuk tugas milik pengguna sendiri. Karena itu ada
# jalur kedua lewat folder Startup, yang tidak menuntut izin apa pun dan
# berjalan saat masuk Windows. Untuk komputer yang dimatikan tiap malam,
# keduanya sama saja.
$argumen = "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$skrip`" -Portal `"$Portal`""
$caraPasang = ""

try {
  $aksi = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $argumen

  $saatMasuk = New-ScheduledTaskTrigger -AtLogOn
  $berkala = New-ScheduledTaskTrigger -Daily -At 7am
  $berkala.Repetition = (New-ScheduledTaskTrigger -Once -At 7am `
    -RepetitionInterval (New-TimeSpan -Hours 4) `
    -RepetitionDuration (New-TimeSpan -Hours 20)).Repetition

  $setelan = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
    -MultipleInstances IgnoreNew

  $pelaku = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

  Register-ScheduledTask -TaskName $namaTugas -Action $aksi -Trigger @($saatMasuk, $berkala) `
    -Settings $setelan -Principal $pelaku -Force -ErrorAction Stop | Out-Null

  $caraPasang = "tugas terjadwal"
  Write-Output "Tugas terjadwal '$namaTugas' terdaftar (saat masuk Windows, lalu tiap 4 jam)."
} catch {
  Write-Output "Tugas terjadwal tidak dapat dibuat ($($_.Exception.Message.Trim()))."
  Write-Output "Beralih ke folder Startup - tidak menuntut hak Administrator."

  $isi = @(
    "@echo off",
    "rem Disegarkan otomatis oleh ALETA. Hapus berkas ini untuk menghentikannya.",
    "start `"`" /min powershell.exe $argumen"
  ) -join "`r`n"
  Set-Content -LiteralPath $pintasan -Value $isi -Encoding ascii

  if (-not (Test-Path $pintasan)) {
    Write-Output "GAGAL: folder Startup pun tidak dapat ditulisi. Penyegaran harus dijalankan sendiri."
    exit 1
  }
  $caraPasang = "folder Startup"
  Write-Output "Terpasang di folder Startup: $pintasan"
  Write-Output "Penyegaran berjalan SAAT MASUK WINDOWS saja - tidak berulang di siang hari."
}

# -----------------------------------------------------------------------------
# 3. Jalankan sekali sekarang
# -----------------------------------------------------------------------------
Write-Output ""
Write-Output "Menyegarkan sekarang..."
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $skrip -Portal $Portal
Write-Output ""

if (-not (Test-Path (Join-Path $tujuan "manifest.json"))) {
  Write-Output "Penyegaran pertama GAGAL - periksa apakah $Portal terjangkau dari komputer ini."
  exit 1
}

$versi = (Get-Content (Join-Path $tujuan "manifest.json") -Raw | ConvertFrom-Json).version

Write-Output "============================================================"
Write-Output " Ekstensi ALETA v$versi siap di:"
Write-Output " $tujuan"
Write-Output " Penyegaran dipasang lewat: $caraPasang"
Write-Output "============================================================"
Write-Output ""
Write-Output " Sekali saja, muat foldernya di Chrome:"
Write-Output ""
Write-Output "   1. Buka  chrome://extensions"
Write-Output "   2. Nyalakan 'Developer mode' di pojok kanan atas"
Write-Output "   3. Tekan 'Load unpacked'"
Write-Output "   4. Pilih folder di atas"
Write-Output ""
Write-Output " Sesudah itu tidak perlu diulang. Pembaruan berikutnya masuk"
Write-Output " sendiri; cukup tutup Chrome sampai keluar lalu buka lagi."
Write-Output ""
Write-Output " Catatan penyegaran: $rumah\sinkron-ekstensi.log"
