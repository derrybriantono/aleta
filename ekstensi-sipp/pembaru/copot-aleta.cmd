@echo off
rem ===========================================================================
rem  PENCOPOT ALETA - klik dua kali, tanpa hak admin.
rem   1. mencabut pembaru otomatis, atas konfirmasi
rem   2. menghapus folder %USERPROFILE%\.aleta beserta ekstensinya, atas konfirmasi
rem  Kartu ekstensi di Chrome dihapus sendiri di chrome://extensions - Chrome
rem  tidak mengizinkan program lain mencabut ekstensi dari profilnya.
rem ===========================================================================
setlocal
set "ALETA_CMD=%~f0"
set "ALETA_ARG=%*"
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "$t=[IO.File]::ReadAllText($env:ALETA_CMD,[Text.Encoding]::UTF8); $i=$t.IndexOf('#PS'+'-MULAI'); & ([ScriptBlock]::Create($t.Substring($i)))"
set "SANDI=%errorlevel%"
echo.
if not defined ALETA_TANPA_JEDA pause
exit /b %SANDI%
#PS-MULAI
# ============================================================================
# PENCOPOT ALETA (2 Nov 2026) - pasangan pasang-aleta.cmd
# ============================================================================
# Tidak ada yang dihapus tanpa jawaban "Y". Setelan Chrome (Preferences,
# Secure Preferences) TIDAK disentuh; Mode Pengembang dibiarkan.
# Berkas ini sengaja ASCII.

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2

$NAMA_HOST = 'id.aleta.pembaru'
$AKAR = if ($env:ALETA_PASANG_AKAR) { $env:ALETA_PASANG_AKAR } else { Join-Path $env:USERPROFILE '.aleta' }
$RUMAH_PEMBARU = if ($env:ALETA_PEMBARU_RUMAH) { $env:ALETA_PEMBARU_RUMAH } else { Join-Path $env:LOCALAPPDATA 'ALETA\pembaru' }
$DASAR_REG = if ($env:ALETA_PEMBARU_REG) { $env:ALETA_PEMBARU_REG } else { 'HKCU:\Software' }
$KUNCI_REG = @(
    ($DASAR_REG + '\Google\Chrome\NativeMessagingHosts\' + $NAMA_HOST),
    ($DASAR_REG + '\Microsoft\Edge\NativeMessagingHosts\' + $NAMA_HOST)
)
$MODE_UJI = [bool]$env:ALETA_PASANG_UJI
$JAWABAN = New-Object System.Collections.Queue
if ($env:ALETA_JAWAB) { foreach ($j in ([string]$env:ALETA_JAWAB).Split(',')) { $JAWABAN.Enqueue($j.Trim()) } }

function Tulis([string]$teks) { Write-Host $teks }

function Tanya([string]$pertanyaan) {
    if ($JAWABAN.Count -gt 0) { $j = [string]$JAWABAN.Dequeue() } elseif ($MODE_UJI) { $j = 'T' } else { $j = [string](Read-Host $pertanyaan) }
    return $j.Trim().ToUpperInvariant()
}

function Catat([string]$teks) {
    try {
        if (Test-Path -LiteralPath $AKAR) {
            $baris = '{0} copot: {1}' -f (Get-Date).ToString('yyyy-MM-dd HH:mm:ss'), $teks
            [IO.File]::AppendAllText((Join-Path $AKAR 'pasang.log'), $baris + [Environment]::NewLine)
        }
    } catch { }
}

Tulis ''
Tulis 'Pencopot ALETA'
Tulis '--------------'

# 1. Pembaru otomatis
$adaPembaru = (Test-Path -LiteralPath $RUMAH_PEMBARU) -or (@($KUNCI_REG | Where-Object { Test-Path -LiteralPath $_ }).Count -gt 0)
if ($adaPembaru) {
    Tulis ('Pembaru otomatis terpasang di ' + $RUMAH_PEMBARU)
    if ((Tanya 'Cabut pembaru otomatis ALETA? (Y/T)') -eq 'Y') {
        foreach ($k in $KUNCI_REG) { if (Test-Path -LiteralPath $k) { Remove-Item -LiteralPath $k -Recurse -Force } }
        if (Test-Path -LiteralPath $RUMAH_PEMBARU) { Remove-Item -LiteralPath $RUMAH_PEMBARU -Recurse -Force }
        Catat 'pembaru otomatis dicabut'
        Tulis 'Pembaru otomatis sudah dicabut.'
    } else {
        Tulis 'Pembaru otomatis dibiarkan.'
    }
} else {
    Tulis 'Pembaru otomatis tidak terpasang - dilewati.'
}

# 2. Folder .aleta
Tulis ''
if (Test-Path -LiteralPath $AKAR) {
    Tulis ('Folder ALETA: ' + $AKAR)
    Tulis 'Sebaiknya hapus dulu kartu "ALETA E-Court" di chrome://extensions (tombol Hapus/Remove);'
    Tulis 'bila foldernya dihapus lebih dulu, Chrome menampilkan galat pada kartu itu sampai dihapus.'
    if ((Tanya ('Hapus folder ' + $AKAR + ' beserta ekstensinya? (Y/T)')) -eq 'Y') {
        $diri = ''
        try { $diri = [IO.Path]::GetFullPath([string]$env:ALETA_CMD) } catch { }
        $akarPenuh = [IO.Path]::GetFullPath($AKAR).TrimEnd('\')
        if ($diri -and $diri.StartsWith($akarPenuh + '\', [StringComparison]::OrdinalIgnoreCase)) {
            # Berkas ini berada di dalam folder yang dihapus: sisanya dihapus sesudah jendela ini tertutup.
            Get-ChildItem -LiteralPath $akarPenuh -Force | Where-Object { -not [string]::Equals($_.FullName, $diri, [StringComparison]::OrdinalIgnoreCase) } | ForEach-Object { Remove-Item -LiteralPath $_.FullName -Recurse -Force }
            $induk = (Get-CimInstance Win32_Process -Filter ('ProcessId=' + $PID)).ParentProcessId
            $perintah = 'Wait-Process -Id ' + $induk + ' -ErrorAction SilentlyContinue; Start-Sleep -Seconds 1; Remove-Item -LiteralPath ''' + $akarPenuh.Replace("'", "''") + ''' -Recurse -Force -ErrorAction SilentlyContinue'
            Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe') -WindowStyle Hidden -ArgumentList ('-NoProfile -ExecutionPolicy Bypass -Command "' + $perintah + '"')
            Tulis 'Folder ALETA dihapus (sisa terakhir terhapus setelah jendela ini ditutup).'
        } else {
            Remove-Item -LiteralPath $akarPenuh -Recurse -Force
            Tulis 'Folder ALETA sudah dihapus.'
        }
    } else {
        Catat 'folder dibiarkan'
        Tulis 'Folder ALETA dibiarkan.'
    }
} else {
    Tulis ('Folder ' + $AKAR + ' tidak ada - dilewati.')
}

Tulis ''
Tulis 'SELESAI. Mode Pengembang Chrome dibiarkan; matikan sendiri di chrome://extensions bila tidak dipakai.'
exit 0
