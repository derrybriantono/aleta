@echo off
rem ===========================================================================
rem  PEMASANG PEMBARU OTOMATIS ALETA - cukup SEKALI per komputer, tanpa hak admin.
rem  Klik dua kali berkas ini. Untuk mencabut: jalankan dengan argumen /cabut.
rem  Hanya menulis ke %LOCALAPPDATA%\ALETA\pembaru dan kunci registri milik
rem  pengguna ini (HKCU). Tidak menyentuh profil Chrome maupun setelan ALETA.
rem ===========================================================================
setlocal
set "ALETA_CMD=%~f0"
set "ALETA_ARG=%*"
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "$t=[IO.File]::ReadAllText($env:ALETA_CMD,[Text.Encoding]::UTF8); $i=$t.IndexOf('#PS'+'-MULAI'); & ([ScriptBlock]::Create($t.Substring($i)))"
set "SANDI=%errorlevel%"
echo.
pause
exit /b %SANDI%
#PS-MULAI
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2
$NAMA_HOST = 'id.aleta.pembaru'
$NAMA_MANIFEST = 'ALETA E-Court'
$IdDiminta = '@@ID_DIMINTA@@'
$AsalPortal = '@@ASAL_PORTAL@@'
$IsiHost = @'
@@HOST_PS1@@
'@

$ASAL_BAWAAN = @('http://192.168.10.10/aleta', 'http://192.168.10.10:8008/aleta')
$RUMAH = if ($env:ALETA_PEMBARU_RUMAH) { $env:ALETA_PEMBARU_RUMAH } else { Join-Path $env:LOCALAPPDATA 'ALETA\pembaru' }
$DASAR_REG = if ($env:ALETA_PEMBARU_REG) { $env:ALETA_PEMBARU_REG } else { 'HKCU:\Software' }
$Cabut = ([string]$env:ALETA_ARG) -match '(?i)(^|\s)[/-]cabut'

function Tulis($teks) { Write-Host $teks }

function Kunci-Peramban {
    $daftar = New-Object System.Collections.ArrayList
    if ($env:ALETA_PEMBARU_PROFIL) {
        $null = $daftar.Add([pscustomobject]@{ Nama = 'Chrome'; Akar = $env:ALETA_PEMBARU_PROFIL; Kunci = ($DASAR_REG + '\Google\Chrome\NativeMessagingHosts\' + $NAMA_HOST) })
        return $daftar.ToArray()
    }
    $null = $daftar.Add([pscustomobject]@{ Nama = 'Chrome'; Akar = (Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data'); Kunci = ($DASAR_REG + '\Google\Chrome\NativeMessagingHosts\' + $NAMA_HOST) })
    $null = $daftar.Add([pscustomobject]@{ Nama = 'Edge'; Akar = (Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\User Data'); Kunci = ($DASAR_REG + '\Microsoft\Edge\NativeMessagingHosts\' + $NAMA_HOST) })
    return $daftar.ToArray()
}

if ($Cabut) {
    foreach ($k in @(Kunci-Peramban)) {
        if (Test-Path -LiteralPath $k.Kunci) { Remove-Item -LiteralPath $k.Kunci -Recurse -Force }
    }
    if (Test-Path -LiteralPath $RUMAH) { Remove-Item -LiteralPath $RUMAH -Recurse -Force }
    Tulis 'Pembaru otomatis ALETA sudah dicabut. Ekstensi dan setelannya tidak berubah.'
    return
}

# ---------------------------------------------------------------------------
# 1. Cari ekstensi ALETA yang dimuat sebagai folder (hanya MEMBACA setelan Chrome)
# ---------------------------------------------------------------------------
function Baca-Berkas-Bersama([string]$jalur) {
    $fs = [IO.File]::Open($jalur, 'Open', 'Read', 'ReadWrite, Delete')
    try {
        $sr = New-Object IO.StreamReader($fs, [Text.Encoding]::UTF8)
        return $sr.ReadToEnd()
    } finally {
        $fs.Dispose()
    }
}

function Cari-Terpasang {
    Add-Type -AssemblyName System.Web.Extensions
    $js = New-Object Web.Script.Serialization.JavaScriptSerializer
    $js.MaxJsonLength = [int]::MaxValue
    $temu = New-Object System.Collections.ArrayList
    foreach ($p in @(Kunci-Peramban)) {
        $akar = $p.Akar
        if (-not (Test-Path -LiteralPath $akar)) { continue }
        foreach ($profil in (Get-ChildItem -LiteralPath $akar -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq 'Default' -or $_.Name -like 'Profile *' })) {
            foreach ($nama in @('Secure Preferences', 'Preferences')) {
                $berkas = Join-Path $profil.FullName $nama
                if (-not (Test-Path -LiteralPath $berkas)) { continue }
                try {
                    $pref = $js.DeserializeObject((Baca-Berkas-Bersama $berkas))
                    $ekst = $pref['extensions']['settings']
                } catch { continue }
                foreach ($id in $ekst.Keys) {
                    $e = $ekst[$id]
                    if (-not ($e -is [System.Collections.IDictionary]) -or -not $e.ContainsKey('path')) { continue }
                    $folder = [string]$e['path']
                    if (-not [IO.Path]::IsPathRooted($folder)) { continue }
                    $m = Join-Path $folder 'manifest.json'
                    if (-not (Test-Path -LiteralPath $m)) { continue }
                    try { $mf = [IO.File]::ReadAllText($m) | ConvertFrom-Json } catch { continue }
                    if ($mf.name -ne $NAMA_MANIFEST) { continue }
                    $null = $temu.Add([pscustomobject]@{ Id = [string]$id; Folder = $folder; Peramban = $p.Nama })
                }
            }
        }
    }
    return $temu.ToArray()
}

Tulis ''
Tulis 'Pemasang pembaru otomatis ALETA'
Tulis '--------------------------------'
$temu = @(Cari-Terpasang)
if ($IdDiminta -and -not $IdDiminta.StartsWith('@@')) {
    $pilih = @($temu | Where-Object { $_.Id -eq $IdDiminta })
    if ($pilih.Count -gt 0) { $temu = $pilih }
}
$folderPilihan = ''
$daftarFolder = @($temu | ForEach-Object { $_.Folder.TrimEnd('\') } | Sort-Object -Unique)
if ($daftarFolder.Count -eq 1) {
    $folderPilihan = $daftarFolder[0]
} elseif ($daftarFolder.Count -gt 1) {
    Tulis 'Ditemukan beberapa salinan ekstensi ALETA:'
    for ($i = 0; $i -lt $daftarFolder.Count; $i++) { Tulis ('  ' + ($i + 1) + '. ' + $daftarFolder[$i]) }
    $jawab = Read-Host 'Ketik nomor salinan yang dipakai sehari-hari'
    $n = 0
    if ([int]::TryParse($jawab, [ref]$n) -and $n -ge 1 -and $n -le $daftarFolder.Count) { $folderPilihan = $daftarFolder[$n - 1] }
}
if (-not $folderPilihan) {
    Tulis 'Ekstensi ALETA belum ditemukan di Chrome.'
    Tulis 'Muat dulu ekstensinya (chrome://extensions > Developer mode > Load unpacked), lalu jalankan ulang berkas ini.'
    exit 1
}
$idFolder = @($temu | Where-Object { $_.Folder.TrimEnd('\') -eq $folderPilihan } | ForEach-Object { $_.Id } | Sort-Object -Unique)
if ($IdDiminta -and -not $IdDiminta.StartsWith('@@') -and ($idFolder -notcontains $IdDiminta)) { $idFolder += $IdDiminta }
Tulis ('Folder ekstensi : ' + $folderPilihan)

# ---------------------------------------------------------------------------
# 2. Tulis pembantu ke rumahnya (hanya milik pengguna ini)
# ---------------------------------------------------------------------------
if (-not (Test-Path -LiteralPath $RUMAH)) { $null = New-Item -ItemType Directory -Path $RUMAH -Force }
$utf8 = New-Object Text.UTF8Encoding($false)

$teksHost = $IsiHost
if ($teksHost.Trim().StartsWith('@@HOST')) {
    # Dijalankan dari folder ekstensi: pakai berkas di sampingnya.
    $sampingan = Join-Path (Split-Path -Parent $env:ALETA_CMD) 'pembaru-aleta.ps1'
    if (-not (Test-Path -LiteralPath $sampingan)) { throw 'pembaru-aleta.ps1 tidak ditemukan di samping pemasang' }
    $teksHost = [IO.File]::ReadAllText($sampingan)
}
[IO.File]::WriteAllText((Join-Path $RUMAH 'pembaru-aleta.ps1'), ($teksHost.Trim() + "`r`n"), $utf8)

$peluncur = "@echo off`r`n" + '"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%~dp0pembaru-aleta.ps1"' + "`r`n"
[IO.File]::WriteAllText((Join-Path $RUMAH 'pembaru-aleta.cmd'), $peluncur, [Text.Encoding]::ASCII)

$asal = @($ASAL_BAWAAN)
# Asal tambahan dari portal hanya diterima bila hostnya sama dengan yang diizinkan manifest ekstensi.
if ($AsalPortal -and -not $AsalPortal.StartsWith('@@') -and $AsalPortal -match '^http://[A-Za-z0-9.\-]+(:\d+)?(/[A-Za-z0-9_\-]+)?$') {
    $hostPortal = ([Uri]$AsalPortal).Host
    if (@('192.168.10.10', '127.0.0.1') -contains $hostPortal) { $asal += $AsalPortal.TrimEnd('/') }
}
$asal = @($asal | Sort-Object -Unique)
$cfg = [ordered]@{ folder = $folderPilihan; asal = $asal; id = $idFolder; dipasang = (Get-Date).ToString('o') }
[IO.File]::WriteAllText((Join-Path $RUMAH 'konfigurasi.json'), ($cfg | ConvertTo-Json -Depth 4), $utf8)

$asalUsul = @($idFolder | ForEach-Object { 'chrome-extension://' + $_ + '/' })
$manifestHost = [ordered]@{
    name = $NAMA_HOST
    description = 'Pembaru otomatis ekstensi ALETA'
    path = (Join-Path $RUMAH 'pembaru-aleta.cmd')
    type = 'stdio'
    allowed_origins = $asalUsul
}
$jalurManifest = Join-Path $RUMAH ($NAMA_HOST + '.json')
[IO.File]::WriteAllText($jalurManifest, ($manifestHost | ConvertTo-Json -Depth 4), $utf8)

# ---------------------------------------------------------------------------
# 3. Daftarkan di registri pengguna (HKCU) untuk peramban yang ada
# ---------------------------------------------------------------------------
$didaftar = @()
foreach ($k in @(Kunci-Peramban)) {
    if ($k.Nama -ne 'Chrome' -and -not (Test-Path -LiteralPath $k.Akar)) { continue }
    if (-not (Test-Path -LiteralPath $k.Kunci)) { $null = New-Item -Path $k.Kunci -Force }
    Set-ItemProperty -LiteralPath $k.Kunci -Name '(default)' -Value $jalurManifest
    $didaftar += $k.Nama
}
Tulis ('Didaftarkan di   : ' + ($didaftar -join ', '))

# ---------------------------------------------------------------------------
# 4. Uji sendiri lewat peluncur yang sama dengan yang dipakai Chrome
# ---------------------------------------------------------------------------
function Uji-Pembantu {
    $psi = New-Object Diagnostics.ProcessStartInfo
    $psi.FileName = (Join-Path $RUMAH 'pembaru-aleta.cmd')
    $psi.UseShellExecute = $false
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.CreateNoWindow = $true
    $proses = [Diagnostics.Process]::Start($psi)
    try {
        $json = [Text.Encoding]::UTF8.GetBytes('{"perintah":"ping"}')
        $kepala = [BitConverter]::GetBytes([uint32]$json.Length)
        $proses.StandardInput.BaseStream.Write($kepala, 0, 4)
        $proses.StandardInput.BaseStream.Write($json, 0, $json.Length)
        $proses.StandardInput.BaseStream.Flush()
        $out = $proses.StandardOutput.BaseStream
        $buf = New-Object byte[] 4
        $tugas = $out.ReadAsync($buf, 0, 4)
        if (-not $tugas.Wait(20000) -or $tugas.Result -lt 4) { return $null }
        $panjang = [BitConverter]::ToUInt32($buf, 0)
        $isi = New-Object byte[] ([int]$panjang)
        $sudah = 0
        while ($sudah -lt $panjang) {
            $t = $out.ReadAsync($isi, $sudah, ([int]$panjang - $sudah))
            if (-not $t.Wait(20000) -or $t.Result -le 0) { return $null }
            $sudah += $t.Result
        }
        return ([Text.Encoding]::UTF8.GetString($isi) | ConvertFrom-Json)
    } finally {
        try { $proses.StandardInput.Close() } catch { }
        if (-not $proses.WaitForExit(5000)) { $proses.Kill() }
    }
}
$uji = Uji-Pembantu
if ($null -eq $uji -or -not $uji.ok -or -not $uji.folderSah) {
    Tulis 'Pembantu terpasang tetapi ujinya belum lolos. Hubungi pengelola ALETA.'
    exit 2
}
Tulis ('Versi ekstensi    : ' + $uji.versiFolder)
Tulis ''
Tulis 'SELESAI. Mulai sekarang versi baru ALETA terpasang sendiri, tanpa unduhan dan tanpa bertanya.'
Tulis 'Setelan Anda tidak berubah. Buka ikon ALETA di Chrome: "Pembaruan otomatis: aktif".'
