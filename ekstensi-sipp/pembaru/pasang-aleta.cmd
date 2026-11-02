@echo off
rem ===========================================================================
rem  PEMASANG ALETA SEPAKET - klik dua kali, tanpa hak admin.
rem   1. memasang atau memperbarui ekstensi ALETA di %USERPROFILE%\.aleta\ekstensi
rem   2. menyalakan Mode Pengembang Chrome - hanya saat Chrome tertutup
rem   3. memasang pembaru otomatis - pasang-pembaru-aleta.cmd yang sudah ada
rem   4. membuka chrome://extensions untuk SATU langkah Load unpacked, sekali saja
rem  Menjalankan ulang aman: isinya diperbarui di tempat yang sama.
rem  Catatan kerja : %USERPROFILE%\.aleta\pasang.log
rem  Mencopot      : %USERPROFILE%\.aleta\copot-aleta.cmd
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
# PEMASANG ALETA SEPAKET (2 Nov 2026)
# ============================================================================
#
# Yang dikerjakan, berurutan:
#   1. Mencari pemasangan lama (konfigurasi pembaru, setelan Chrome - HANYA
#      DIBACA, folder sinkron lama) dan menawarkan pindah ke lokasi tetap.
#   2. Mengambil paket ekstensi (folder di samping berkas ini, atau dari server
#      portal: /pembaru/info lalu /pembaru/paket dengan sidik SHA-256), lalu
#      memasangnya di %USERPROFILE%\.aleta\ekstensi. Lokasi ini TETAP: Chrome
#      mengikat ekstensi "Load unpacked" pada alamat foldernya; ID, izin, dan
#      setelan petugas ikut alamat itu.
#   3. Mode Pengembang: extensions.ui.developer_mode = true di berkas
#      Preferences tiap profil Chrome - HANYA saat Chrome tertutup, dengan
#      cadangan. Secure Preferences TIDAK PERNAH ditulis.
#   4. Pembaru otomatis: menjalankan pasang-pembaru-aleta.cmd yang ikut paket,
#      diarahkan ke folder tetap tadi.
#   5. Load unpacked: Chrome bermerek tidak mengizinkan program lain memuat
#      ekstensi di luar Web Store tanpa tangan petugas. Yang dikerjakan di sini
#      hanya membuka chrome://extensions dan menyalin alamat folder ke papan
#      klip. Bila Chrome sudah memuat folder itu, langkah ini dilewati.
#
# Tidak ada sandi, token, atau kunci di berkas ini. Berkas ini sengaja ASCII.

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Set-StrictMode -Version 2

$AsalPortal = '@@ASAL_PORTAL@@'
$NAMA_MANIFEST = 'ALETA E-Court'
$ASAL_BAWAAN = @('http://192.168.10.10/aleta', 'http://192.168.10.10:8008/aleta')
$JENIS_BOLEH = @('js', 'css', 'html', 'json', 'png', 'md', 'txt', 'ps1', 'cmd')
$MAKS_PAKET = 64MB
$MAKS_ISI = 160MB
$MAKS_BERKAS = 1500

# Lokasi (dapat diganti lewat variabel lingkungan untuk pengujian).
$AKAR = if ($env:ALETA_PASANG_AKAR) { $env:ALETA_PASANG_AKAR } else { Join-Path $env:USERPROFILE '.aleta' }
$FOLDER_TETAP = Join-Path $AKAR 'ekstensi'
$DATA_CHROME = if ($env:ALETA_PASANG_PROFIL) { $env:ALETA_PASANG_PROFIL } else { Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data' }
$PROFIL_ASLI = -not $env:ALETA_PASANG_PROFIL
$RUMAH_PEMBARU = if ($env:ALETA_PEMBARU_RUMAH) { $env:ALETA_PEMBARU_RUMAH } else { Join-Path $env:LOCALAPPDATA 'ALETA\pembaru' }
$FOLDER_SINKRON_LAMA = if ($env:ALETA_PASANG_SINKRON) { $env:ALETA_PASANG_SINKRON } else { Join-Path $env:USERPROFILE 'ALETA\ekstensi-sipp' }
$LOG = Join-Path $AKAR 'pasang.log'
# Mode uji: tanpa membuka Chrome, tanpa papan klip; jawaban dari ALETA_JAWAB (dipisah koma).
$MODE_UJI = [bool]$env:ALETA_PASANG_UJI
$JAWABAN = New-Object System.Collections.Queue
if ($env:ALETA_JAWAB) { foreach ($j in ([string]$env:ALETA_JAWAB).Split(',')) { $JAWABAN.Enqueue($j.Trim()) } }

Add-Type -AssemblyName System.Web.Extensions
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

# ---------------------------------------------------------------------------
# Tampilan, catatan, pertanyaan
# ---------------------------------------------------------------------------
$script:Tertunda = New-Object System.Collections.ArrayList
$script:AsalDipakai = ''
$script:FolderPembaruLama = ''

function Tulis([string]$teks) { Write-Host $teks }

function Catat([string]$teks) {
    try {
        $baris = '{0} {1}' -f (Get-Date).ToString('yyyy-MM-dd HH:mm:ss'), $teks
        if (-not (Test-Path -LiteralPath $AKAR)) { $null = $script:Tertunda.Add($baris); return }
        if ((Test-Path -LiteralPath $LOG) -and ((Get-Item -LiteralPath $LOG -Force).Length -gt 200KB)) {
            Remove-Item -LiteralPath $LOG -Force
        }
        foreach ($t in $script:Tertunda) { [IO.File]::AppendAllText($LOG, $t + [Environment]::NewLine) }
        $script:Tertunda.Clear()
        [IO.File]::AppendAllText($LOG, $baris + [Environment]::NewLine)
    } catch { }
}

function Lapor([string]$teks) { Tulis $teks; Catat $teks }

function Ringkas([string]$teks) {
    $t = ($teks -replace '[\r\n]+', ' ').Trim()
    if ($t.Length -gt 240) { $t = $t.Substring(0, 240) }
    return $t
}

function Tanya([string]$pertanyaan, [string]$bawaan) {
    if ($JAWABAN.Count -gt 0) {
        $j = [string]$JAWABAN.Dequeue()
    } elseif ($MODE_UJI) {
        $j = $bawaan
    } else {
        $j = [string](Read-Host $pertanyaan)
    }
    $j = $j.Trim().ToUpperInvariant()
    Catat ('jawab "' + $pertanyaan + '": ' + $j)
    return $j
}

# ---------------------------------------------------------------------------
# Jalur dan manifest
# ---------------------------------------------------------------------------
function Jalur-Baku([string]$p) {
    try { return ([IO.Path]::GetFullPath($p)).TrimEnd('\') } catch { return ([string]$p).TrimEnd('\') }
}

function Jalur-Sama([string]$a, [string]$b) {
    if (-not $a -or -not $b) { return $false }
    return [string]::Equals((Jalur-Baku $a), (Jalur-Baku $b), [StringComparison]::OrdinalIgnoreCase)
}

# Alamat dengan huruf besar-kecil sebagaimana tercatat di disk (dipakai Chrome
# saat folder dipilih lewat jendela pilih folder).
function Jalur-Asli([string]$jalur) {
    try {
        $d = New-Object IO.DirectoryInfo((Jalur-Baku $jalur))
        $nama = New-Object System.Collections.ArrayList
        while ($null -ne $d.Parent) {
            $cocok = @($d.Parent.GetDirectories($d.Name))
            if ($cocok.Count -ge 1) { $nama.Insert(0, $cocok[0].Name) } else { $nama.Insert(0, $d.Name) }
            $d = $d.Parent
        }
        return ($d.FullName.ToUpperInvariant().TrimEnd('\') + '\' + ($nama.ToArray() -join '\'))
    } catch {
        return (Jalur-Baku $jalur)
    }
}

function Baca-Manifest([string]$folder) {
    $m = Join-Path $folder 'manifest.json'
    if (-not (Test-Path -LiteralPath $m)) { return $null }
    try { return ([IO.File]::ReadAllText($m) | ConvertFrom-Json) } catch { return $null }
}

function Nilai-Manifest([string]$folder, [string]$ruas) {
    $mf = Baca-Manifest $folder
    if ($null -eq $mf) { return '' }
    $p = $mf.PSObject.Properties[$ruas]
    if ($null -eq $p) { return '' }
    return [string]$p.Value
}

# Folder ekstensi ALETA yang sah: manifest bernama ALETA E-Court dan ada latar.js.
function Folder-Aleta([string]$folder) {
    if (-not $folder -or -not (Test-Path -LiteralPath $folder -PathType Container)) { return $false }
    if ((Nilai-Manifest $folder 'name') -ne $NAMA_MANIFEST) { return $false }
    return (Test-Path -LiteralPath (Join-Path $folder 'latar.js'))
}

function Sembunyikan([string]$jalur) {
    try {
        $item = Get-Item -LiteralPath $jalur -Force
        if (($item.Attributes -band [IO.FileAttributes]::Hidden) -eq 0) {
            $item.Attributes = $item.Attributes -bor [IO.FileAttributes]::Hidden
        }
    } catch {
        Catat ('atribut tersembunyi gagal: ' + (Ringkas $_.Exception.Message))
    }
}

# ---------------------------------------------------------------------------
# ID ekstensi - rumus Chrome: dari "key" manifest bila ada; bila tidak, dari
# alamat folder (UTF-16, huruf drive besar). SHA-256, 16 bita pertama, tiap
# angka heksa 0-f menjadi huruf a-p.
# ---------------------------------------------------------------------------
function Id-Dari-Bita([byte[]]$bita) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $h = $sha.ComputeHash($bita) } finally { $sha.Dispose() }
    $s = New-Object Text.StringBuilder
    for ($i = 0; $i -lt 16; $i++) {
        $null = $s.Append([char](97 + ($h[$i] -shr 4)))
        $null = $s.Append([char](97 + ($h[$i] -band 15)))
    }
    return $s.ToString()
}

function Ambil-Kunci([string]$t) {
    $m = [regex]::Match($t, '"key"\s*:\s*"([^"]*)"')
    if ($m.Success) { return $m.Groups[1].Value }
    return ''
}

function Id-Ekstensi([string]$folder) {
    $ids = New-Object System.Collections.ArrayList
    $kunci = Ambil-Kunci ([IO.File]::ReadAllText((Join-Path $folder 'manifest.json')))
    if ($kunci) {
        try {
            $null = $ids.Add((Id-Dari-Bita ([Convert]::FromBase64String($kunci))))
            return $ids.ToArray()
        } catch { }
    }
    foreach ($calon in @((Jalur-Baku $folder), (Jalur-Asli $folder))) {
        $p = $calon
        if ($p.Length -ge 2 -and $p[1] -eq ':') { $p = $p.Substring(0, 1).ToUpperInvariant() + $p.Substring(1) }
        $id = Id-Dari-Bita ([Text.Encoding]::Unicode.GetBytes($p))
        if (-not $ids.Contains($id)) { $null = $ids.Add($id) }
    }
    return $ids.ToArray()
}

# ---------------------------------------------------------------------------
# Setelan Chrome
# ---------------------------------------------------------------------------
function Penyusun-Json {
    $js = New-Object Web.Script.Serialization.JavaScriptSerializer
    $js.MaxJsonLength = [int]::MaxValue
    $js.RecursionLimit = 1000
    return $js
}

function Baca-Bersama([string]$jalur) {
    $fs = [IO.File]::Open($jalur, 'Open', 'Read', 'ReadWrite, Delete')
    try {
        $sr = New-Object IO.StreamReader($fs, [Text.Encoding]::UTF8)
        return $sr.ReadToEnd()
    } finally {
        $fs.Dispose()
    }
}

function Anak($d, [string]$k) {
    if (($d -is [System.Collections.IDictionary]) -and $d.ContainsKey($k)) { return $d[$k] }
    return $null
}

function Daftar-Profil {
    $hasil = New-Object System.Collections.ArrayList
    if (-not (Test-Path -LiteralPath $DATA_CHROME)) { return }
    foreach ($d in (Get-ChildItem -LiteralPath $DATA_CHROME -Directory -Force -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq 'Default' -or $_.Name -like 'Profile *' })) {
        if (Test-Path -LiteralPath (Join-Path $d.FullName 'Preferences')) { $null = $hasil.Add($d) }
    }
    return $hasil.ToArray()
}

# Ekstensi yang dimuat sebagai folder, menurut setelan Chrome (HANYA DIBACA).
function Ekstensi-Terdaftar {
    $js = Penyusun-Json
    $temu = New-Object System.Collections.ArrayList
    foreach ($p in @(Daftar-Profil)) {
        foreach ($nama in @('Secure Preferences', 'Preferences')) {
            $berkas = Join-Path $p.FullName $nama
            if (-not (Test-Path -LiteralPath $berkas)) { continue }
            try { $pref = $js.DeserializeObject((Baca-Bersama $berkas)) } catch { continue }
            $ekst = Anak (Anak $pref 'extensions') 'settings'
            if (-not ($ekst -is [System.Collections.IDictionary])) { continue }
            foreach ($id in @($ekst.Keys)) {
                $e = $ekst[$id]
                if (-not ($e -is [System.Collections.IDictionary]) -or -not $e.ContainsKey('path')) { continue }
                $folder = [string]$e['path']
                if (-not $folder -or -not [IO.Path]::IsPathRooted($folder)) { continue }
                $null = $temu.Add([pscustomobject]@{ Id = [string]$id; Folder = (Jalur-Baku $folder); Profil = $p.Name })
            }
        }
    }
    return $temu.ToArray()
}

function Mode-Pengembang-Menyala($profil) {
    try {
        $js = Penyusun-Json
        $pref = $js.DeserializeObject((Baca-Bersama (Join-Path $profil.FullName 'Preferences')))
        return ((Anak (Anak (Anak $pref 'extensions') 'ui') 'developer_mode') -eq $true)
    } catch {
        return $false
    }
}

function Chrome-Berjalan {
    # Profil uji (ALETA_PASANG_PROFIL) tidak dipakai Chrome yang sedang berjalan.
    if (-not $PROFIL_ASLI) { return $false }
    return (@(Get-Process -Name 'chrome' -ErrorAction SilentlyContinue).Count -gt 0)
}

function Tunggu-Chrome-Tutup([int]$detik) {
    $batas = (Get-Date).AddSeconds($detik)
    while ((Get-Date) -lt $batas) {
        if (-not (Chrome-Berjalan)) { return $true }
        foreach ($pr in @(Get-Process -Name 'chrome' -ErrorAction SilentlyContinue)) {
            try { if ($pr.MainWindowHandle -ne [IntPtr]::Zero) { $null = $pr.CloseMainWindow() } } catch { }
        }
        Start-Sleep -Milliseconds 700
    }
    return (-not (Chrome-Berjalan))
}

# Chrome menulis ulang Preferences saat ditutup, jadi perubahan hanya bertahan
# bila Chrome tertutup ketika ditulis. Chrome TIDAK dimatikan tanpa persetujuan.
function Pastikan-Chrome-Tertutup {
    while (Chrome-Berjalan) {
        Tulis ''
        Tulis 'Chrome masih terbuka. Mode Pengembang hanya dapat dinyalakan saat Chrome tertutup,'
        Tulis 'sebab Chrome menulis ulang setelannya ketika ditutup.'
        Tulis '  [Enter] saya sudah menutup Chrome - periksa lagi'
        Tulis '  [T]     tutupkan Chrome untuk saya (tab dapat dipulihkan saat Chrome dibuka lagi)'
        Tulis '  [L]     lewati - Mode Pengembang dinyalakan sendiri nanti di chrome://extensions'
        $j = Tanya 'Pilihan (Enter/T/L)' 'L'
        if ($j -eq 'L') { return $false }
        if ($j -eq 'T') {
            Tulis 'Menutup jendela Chrome...'
            Catat 'menutup jendela Chrome atas persetujuan petugas'
            if (-not (Tunggu-Chrome-Tutup 15)) {
                Tulis 'Chrome masih berjalan di latar belakang (mis. aplikasi latar Chrome).'
                $y = Tanya 'Hentikan paksa Chrome sekarang? (Y/T)' 'T'
                if ($y -eq 'Y') {
                    Catat 'menghentikan paksa chrome.exe atas persetujuan petugas'
                    Get-Process -Name 'chrome' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
                    $null = Tunggu-Chrome-Tutup 10
                }
            }
        }
    }
    return $true
}

function Tulis-Mode-Pengembang($profil) {
    $berkas = Join-Path $profil.FullName 'Preferences'
    $js = Penyusun-Json
    $teks = [IO.File]::ReadAllText($berkas)
    $pref = $js.DeserializeObject($teks)
    if (-not ($pref -is [System.Collections.IDictionary])) { throw 'Preferences bukan objek JSON' }
    $jumlahAwal = $pref.Count
    $ext = Anak $pref 'extensions'
    if (-not ($ext -is [System.Collections.IDictionary])) {
        if (-not $pref.ContainsKey('extensions')) { $jumlahAwal += 1 }
        $ext = $js.DeserializeObject('{}')
        $pref['extensions'] = $ext
    }
    $ui = Anak $ext 'ui'
    if (-not ($ui -is [System.Collections.IDictionary])) {
        $ui = $js.DeserializeObject('{}')
        $ext['ui'] = $ui
    }
    if ((Anak $ui 'developer_mode') -eq $true) { return 'sudah' }
    $ui['developer_mode'] = $true

    # Cadangan dulu (tiga terakhir per profil disimpan).
    $folderCadangan = Join-Path $AKAR 'cadangan-chrome'
    if (-not (Test-Path -LiteralPath $folderCadangan)) { $null = New-Item -ItemType Directory -Path $folderCadangan -Force }
    $awalanCadangan = ($profil.Name -replace '[^A-Za-z0-9]', '_') + '-Preferences-'
    $cadangan = Join-Path $folderCadangan ($awalanCadangan + (Get-Date).ToString('yyyyMMdd-HHmmss') + '.json')
    Copy-Item -LiteralPath $berkas -Destination $cadangan -Force
    @(Get-ChildItem -LiteralPath $folderCadangan -File -Force | Where-Object { $_.Name.StartsWith($awalanCadangan) } | Sort-Object Name -Descending | Select-Object -Skip 3) | ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force }

    # JSON utuh; diurai ulang dan diperiksa SEBELUM menimpa.
    $baru = $js.Serialize($pref)
    $cek = $js.DeserializeObject($baru)
    if (-not ($cek -is [System.Collections.IDictionary])) { throw 'hasil penyusunan Preferences bukan objek JSON' }
    if ($cek.Count -ne $jumlahAwal) { throw 'hasil penyusunan Preferences tidak utuh' }
    if ((Anak (Anak (Anak $cek 'extensions') 'ui') 'developer_mode') -ne $true) { throw 'hasil penyusunan Preferences tidak memuat developer_mode' }
    $sementara = $berkas + '.aleta-baru'
    [IO.File]::WriteAllText($sementara, $baru, (New-Object Text.UTF8Encoding($false)))
    try {
        [IO.File]::Replace($sementara, $berkas, [NullString]::Value)
    } catch {
        Copy-Item -LiteralPath $sementara -Destination $berkas -Force
        Remove-Item -LiteralPath $sementara -Force -ErrorAction SilentlyContinue
    }
    Catat ('mode pengembang dinyalakan: ' + $profil.Name + ' (cadangan ' + $cadangan + ')')
    return 'dinyalakan'
}

function Atur-Mode-Pengembang {
    $profil = @(Daftar-Profil)
    if ($profil.Count -eq 0) {
        return 'DILEWATI - Chrome belum pernah dibuka di akun Windows ini. Buka dan tutup Chrome sekali, lalu jalankan pemasang ini lagi.'
    }
    $perlu = @($profil | Where-Object { -not (Mode-Pengembang-Menyala $_) })
    if ($perlu.Count -eq 0) { return ('sudah menyala (' + $profil.Count + ' profil)') }
    if (-not (Pastikan-Chrome-Tertutup)) {
        return 'DILEWATI - Chrome masih terbuka. Nyalakan sendiri: chrome://extensions, sakelar "Mode pengembang" di kanan atas.'
    }
    $berhasil = 0
    $gagal = @()
    foreach ($p in $perlu) {
        try {
            $null = Tulis-Mode-Pengembang $p
            $berhasil += 1
        } catch {
            $gagal += $p.Name
            Catat ('mode pengembang gagal di ' + $p.Name + ': ' + (Ringkas $_.Exception.Message))
        }
    }
    if ($gagal.Count -gt 0) {
        return ('menyala di ' + $berhasil + ' profil; GAGAL di ' + ($gagal -join ', ') + ' - nyalakan sendiri di chrome://extensions')
    }
    return ('dinyalakan (' + $berhasil + ' profil)')
}

# ---------------------------------------------------------------------------
# Pemasangan lama di lokasi lain
# ---------------------------------------------------------------------------
function Cari-Lama($terdaftar) {
    $calon = New-Object System.Collections.ArrayList
    $script:FolderPembaruLama = ''
    $cfgBerkas = Join-Path $RUMAH_PEMBARU 'konfigurasi.json'
    if (Test-Path -LiteralPath $cfgBerkas) {
        try {
            $cfg = [IO.File]::ReadAllText($cfgBerkas) | ConvertFrom-Json
            $f = [string]$cfg.folder
            if ($f) { $script:FolderPembaruLama = Jalur-Baku $f; $null = $calon.Add($script:FolderPembaruLama) }
        } catch { }
    }
    foreach ($t in @($terdaftar)) { $null = $calon.Add($t.Folder) }
    # Folder penyegar lama (deploy/chrome/pasang-sinkron.ps1).
    if (Test-Path -LiteralPath $FOLDER_SINKRON_LAMA) { $null = $calon.Add((Jalur-Baku $FOLDER_SINKRON_LAMA)) }
    $hasil = New-Object System.Collections.ArrayList
    foreach ($c in $calon) {
        if (Jalur-Sama $c $FOLDER_TETAP) { continue }
        if (-not (Folder-Aleta $c)) { continue }
        $ada = $false
        foreach ($h in $hasil) { if (Jalur-Sama $h $c) { $ada = $true } }
        if (-not $ada) { $null = $hasil.Add($c) }
    }
    return $hasil.ToArray()
}

# ---------------------------------------------------------------------------
# Paket ekstensi
# ---------------------------------------------------------------------------
function Sidik-Berkas([string]$jalur) {
    $sha = [Security.Cryptography.SHA256]::Create()
    $fs = [IO.File]::Open($jalur, 'Open', 'Read', 'Read')
    try { $h = $sha.ComputeHash($fs) } finally { $fs.Dispose(); $sha.Dispose() }
    return (($h | ForEach-Object { $_.ToString('x2') }) -join '')
}

# Unduh langsung dari server (tanpa peramban, jadi tidak dicegat IDM).
function Minta([string]$alamat, [string]$tujuan) {
    $req = [Net.HttpWebRequest][Net.WebRequest]::Create($alamat)
    $req.Method = 'GET'
    $req.AllowAutoRedirect = $false
    $req.Timeout = 30000
    $req.ReadWriteTimeout = 120000
    $req.Proxy = $null
    $req.UserAgent = 'ALETA-Pemasang/1'
    $res = $req.GetResponse()
    try {
        if ([int]$res.StatusCode -ne 200) { throw ('server menjawab ' + [int]$res.StatusCode) }
        if ($res.ContentLength -gt $MAKS_PAKET) { throw 'paket terlalu besar' }
        $aliran = $res.GetResponseStream()
        if ($tujuan) { $keluar = [IO.File]::Create($tujuan) } else { $keluar = New-Object IO.MemoryStream }
        try {
            $buf = New-Object byte[] 65536
            $total = 0L
            while ($true) {
                $n = $aliran.Read($buf, 0, $buf.Length)
                if ($n -le 0) { break }
                $total += $n
                if ($total -gt $MAKS_PAKET) { throw 'paket terlalu besar' }
                $keluar.Write($buf, 0, $n)
            }
            if ($tujuan) { return [string]$total }
            return [Text.Encoding]::UTF8.GetString($keluar.ToArray())
        } finally {
            $keluar.Dispose()
            $aliran.Dispose()
        }
    } finally {
        $res.Close()
    }
}

function Daftar-Asal {
    $asal = New-Object System.Collections.ArrayList
    if ($AsalPortal -and -not $AsalPortal.StartsWith('@@') -and $AsalPortal -match '^http://[A-Za-z0-9.\-]+(:\d{1,5})?(/[A-Za-z0-9_\-]+)?$') {
        $null = $asal.Add($AsalPortal.TrimEnd('/'))
    }
    foreach ($a in $ASAL_BAWAAN) { if (-not ($asal -contains $a)) { $null = $asal.Add($a) } }
    return $asal.ToArray()
}

function Ambil-Dari-Server([string]$zip) {
    $galat = @()
    foreach ($asal in @(Daftar-Asal)) {
        try {
            Tulis ('Mengambil paket dari ' + $asal + ' ...')
            $info = (Minta ($asal + '/api/aleta-ecourt/ekstensi/pembaru/info') '') | ConvertFrom-Json
            $versi = [string]$info.versi
            $sidik = ([string]$info.sha256).ToLowerInvariant()
            if ($versi -notmatch '^\d{1,4}(\.\d{1,5}){1,3}$' -or $sidik -notmatch '^[0-9a-f]{64}$') { throw 'jawaban server tidak sah' }
            $null = Minta ($asal + '/api/aleta-ecourt/ekstensi/pembaru/paket?versi=' + $versi + '&sha256=' + $sidik) $zip
            if ((Sidik-Berkas $zip) -ne $sidik) { throw 'sidik paket tidak cocok' }
            Catat ('paket ' + $versi + ' dari ' + $asal + ' (sidik cocok)')
            return $asal
        } catch {
            $galat += ($asal + ': ' + (Ringkas $_.Exception.Message))
            Catat ('gagal mengambil dari ' + $asal + ': ' + (Ringkas $_.Exception.Message))
        }
    }
    throw ('Paket ekstensi tidak dapat diambil dari server. ' + ($galat -join ' | '))
}

function Nama-Aman([string]$rel) {
    if (-not $rel) { return $false }
    if ($rel.StartsWith('/') -or $rel.Contains(':') -or $rel.Contains('\')) { return $false }
    foreach ($seg in $rel.TrimEnd('/').Split('/')) {
        if ($seg -eq '' -or $seg -eq '.' -or $seg -eq '..') { return $false }
        if ($seg -notmatch '^[A-Za-z0-9._\-]+$') { return $false }
    }
    return $true
}

# Sama dengan Ekstrak-Aman di pembaru-aleta.ps1: nama aman, jenis dibatasi,
# tidak keluar folder, TIDAK ADA berkas yang dijalankan.
function Ekstrak-Aman([string]$zip, [string]$tujuan) {
    if (Test-Path -LiteralPath $tujuan) { Remove-Item -LiteralPath $tujuan -Recurse -Force }
    $null = New-Item -ItemType Directory -Path $tujuan -Force
    $akar = (Jalur-Baku $tujuan) + '\'
    $arsip = [IO.Compression.ZipFile]::OpenRead($zip)
    try {
        $butir = @($arsip.Entries)
        if ($butir.Count -gt $MAKS_BERKAS) { throw 'terlalu banyak berkas di paket' }
        $nama = @($butir | ForEach-Object { $_.FullName })
        $awalan = ''
        if ($nama -notcontains 'manifest.json') {
            $pertama = ($nama | Select-Object -First 1)
            if ($pertama -and $pertama.Contains('/')) {
                $kandidat = $pertama.Substring(0, $pertama.IndexOf('/') + 1)
                if ($nama -contains ($kandidat + 'manifest.json')) { $awalan = $kandidat }
            }
        }
        $totalIsi = 0L
        foreach ($e in $butir) {
            $rel = $e.FullName
            if ($awalan) {
                if (-not $rel.StartsWith($awalan)) { throw ('berkas di luar folder paket: ' + $rel) }
                $rel = $rel.Substring($awalan.Length)
                if (-not $rel) { continue }
            }
            if (-not (Nama-Aman $rel)) { throw ('nama berkas tidak aman: ' + $rel) }
            if ($rel.EndsWith('/')) { continue }
            $ujung = [IO.Path]::GetExtension($rel).TrimStart('.').ToLowerInvariant()
            if ($JENIS_BOLEH -notcontains $ujung) { throw ('jenis berkas tidak diizinkan: ' + $rel) }
            $totalIsi += $e.Length
            if ($totalIsi -gt $MAKS_ISI) { throw 'isi paket terlalu besar' }
            $dest = [IO.Path]::GetFullPath((Join-Path $tujuan ($rel.Replace('/', '\'))))
            if (-not $dest.StartsWith($akar, [StringComparison]::OrdinalIgnoreCase)) { throw ('keluar dari folder: ' + $rel) }
            $induk = Split-Path -Parent $dest
            if (-not (Test-Path -LiteralPath $induk)) { $null = New-Item -ItemType Directory -Path $induk -Force }
            [IO.Compression.ZipFileExtensions]::ExtractToFile($e, $dest, $true)
        }
    } finally {
        $arsip.Dispose()
    }
}

function Salin-Pohon([string]$dari, [string]$ke) {
    if (Test-Path -LiteralPath $ke) { Remove-Item -LiteralPath $ke -Recurse -Force }
    $null = New-Item -ItemType Directory -Path $ke -Force
    Get-ChildItem -LiteralPath $dari -Force | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $ke -Recurse -Force }
}

function Salin-Menimpa([string]$dari, [string]$ke) {
    # Bila folder tidak bisa ditukar (terkunci): berkas lain dahulu, manifest TERAKHIR.
    $akarDari = (Jalur-Baku $dari) + '\'
    $semua = @(Get-ChildItem -LiteralPath $dari -Recurse -File -Force)
    $urut = @($semua | Where-Object { $_.FullName.Substring($akarDari.Length) -ne 'manifest.json' }) + @($semua | Where-Object { $_.FullName.Substring($akarDari.Length) -eq 'manifest.json' })
    foreach ($b in $urut) {
        $dest = Join-Path $ke ($b.FullName.Substring($akarDari.Length))
        $induk = Split-Path -Parent $dest
        if (-not (Test-Path -LiteralPath $induk)) { $null = New-Item -ItemType Directory -Path $induk -Force }
        Copy-Item -LiteralPath $b.FullName -Destination $dest -Force
    }
}

# "key" manifest menentukan ID. Memperbarui di tempat: bentuk "key" disamakan
# PERSIS dengan yang terpasang (sama dengan pembaru-aleta.ps1). Pindah dari
# lokasi lama: "key" lama dibawa bila ada, supaya ID dan setelan tetap.
function Buang-Kunci([string]$t) {
    $r = New-Object Text.RegularExpressions.Regex(',\s*"key"\s*:\s*"[^"]*"')
    if ($r.IsMatch($t)) { return $r.Replace($t, '', 1) }
    $r2 = New-Object Text.RegularExpressions.Regex('"key"\s*:\s*"[^"]*"\s*,\s*')
    return $r2.Replace($t, '', 1)
}

function Pasang-Kunci([string]$t, [string]$kunci) {
    $i = $t.LastIndexOf('}')
    if ($i -lt 0) { throw 'manifest tidak sah' }
    return ($t.Substring(0, $i).TrimEnd() + ',' + [Environment]::NewLine + '  "key": "' + $kunci + '"' + [Environment]::NewLine + '}' + [Environment]::NewLine)
}

function Selaraskan-Kunci([string]$acuan, [string]$baru, [bool]$wajibSama) {
    $kAcuan = Ambil-Kunci ([IO.File]::ReadAllText((Join-Path $acuan 'manifest.json')))
    $jalurBaru = Join-Path $baru 'manifest.json'
    $tBaru = [IO.File]::ReadAllText($jalurBaru)
    $kBaru = Ambil-Kunci $tBaru
    $hasil = $tBaru
    if ($kAcuan) {
        if ($kBaru -ne $kAcuan) {
            if ($kBaru) { $hasil = Buang-Kunci $hasil }
            $hasil = Pasang-Kunci $hasil $kAcuan
        }
    } elseif ($wajibSama -and $kBaru) {
        $hasil = Buang-Kunci $hasil
    }
    if ($hasil -ne $tBaru) {
        $null = ($hasil | ConvertFrom-Json)
        [IO.File]::WriteAllText($jalurBaru, $hasil, (New-Object Text.UTF8Encoding($false)))
    }
    $akhir = Ambil-Kunci ([IO.File]::ReadAllText($jalurBaru))
    if ($kAcuan -and $akhir -ne $kAcuan) { throw 'kunci manifest tidak dapat diselaraskan' }
    if ($wajibSama -and -not $kAcuan -and $akhir) { throw 'kunci manifest tidak dapat diselaraskan' }
}

# Folder ekstensi tempat berkas .cmd ini berada (dijalankan dari ZIP yang sudah diekstrak).
function Sumber-Lokal {
    try {
        $dirCmd = Split-Path -Parent $env:ALETA_CMD
        if ((Split-Path -Leaf $dirCmd) -ne 'pembaru') { return '' }
        $akarEks = Split-Path -Parent $dirCmd
        if (Folder-Aleta $akarEks) { return (Jalur-Baku $akarEks) }
    } catch { }
    return ''
}

function Pasang-Berkas([string]$acuanLama) {
    if (-not (Test-Path -LiteralPath $AKAR)) { $null = New-Item -ItemType Directory -Path $AKAR -Force }
    Sembunyikan $AKAR
    Catat ('lokasi tetap: ' + $FOLDER_TETAP)
    $staging = Join-Path $AKAR 'ekstensi.baru'
    $lokal = Sumber-Lokal
    $script:AsalDipakai = ''
    if ($env:ALETA_PASANG_PAKET) {
        Tulis ('Memakai paket: ' + $env:ALETA_PASANG_PAKET)
        Ekstrak-Aman $env:ALETA_PASANG_PAKET $staging
    } elseif ($lokal -and (Jalur-Sama $lokal $FOLDER_TETAP)) {
        Lapor 'Dijalankan dari folder yang terpasang - berkas ekstensi tidak disalin ulang.'
        return
    } elseif ($lokal) {
        Tulis ('Memakai folder ekstensi di samping pemasang: ' + $lokal)
        Salin-Pohon $lokal $staging
    } else {
        $zip = Join-Path $AKAR 'paket-unduhan.zip'
        try {
            $script:AsalDipakai = Ambil-Dari-Server $zip
            Ekstrak-Aman $zip $staging
        } finally {
            if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force -ErrorAction SilentlyContinue }
        }
    }
    if (-not (Folder-Aleta $staging)) { throw 'Isi paket bukan ekstensi ALETA E-Court.' }

    if (Folder-Aleta $FOLDER_TETAP) {
        Selaraskan-Kunci $FOLDER_TETAP $staging $true
    } elseif ($acuanLama -and (Folder-Aleta $acuanLama)) {
        Selaraskan-Kunci $acuanLama $staging $false
    }

    $versiLama = Nilai-Manifest $FOLDER_TETAP 'version'
    $dariDalam = $env:ALETA_CMD -and (Jalur-Baku $env:ALETA_CMD).StartsWith((Jalur-Baku $FOLDER_TETAP) + '\', [StringComparison]::OrdinalIgnoreCase)
    if (-not (Test-Path -LiteralPath $FOLDER_TETAP)) {
        [IO.Directory]::Move($staging, $FOLDER_TETAP)
    } else {
        $tertukar = $false
        if (-not $dariDalam) {
            $lama = $FOLDER_TETAP + '.aleta-lama'
            try {
                if (Test-Path -LiteralPath $lama) { Remove-Item -LiteralPath $lama -Recurse -Force }
                [IO.Directory]::Move($FOLDER_TETAP, $lama)
                try {
                    [IO.Directory]::Move($staging, $FOLDER_TETAP)
                    $tertukar = $true
                } catch {
                    [IO.Directory]::Move($lama, $FOLDER_TETAP)
                    throw
                }
            } catch {
                Catat ('tukar folder gagal, menyalin: ' + (Ringkas $_.Exception.Message))
            }
        }
        if (-not $tertukar) {
            Salin-Menimpa $staging $FOLDER_TETAP
            Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
    $versi = Nilai-Manifest $FOLDER_TETAP 'version'
    if (-not (Folder-Aleta $FOLDER_TETAP)) { throw 'Folder ekstensi sesudah pemasangan tidak utuh.' }
    if ($versiLama) { Lapor ('Ekstensi diperbarui: ' + $versiLama + ' -> ' + $versi) } else { Lapor ('Ekstensi dipasang: versi ' + $versi) }

    # Pencopot dan salinan pemasang di akar, untuk dijalankan ulang kapan saja.
    $copot = Join-Path $FOLDER_TETAP 'pembaru\copot-aleta.cmd'
    if (Test-Path -LiteralPath $copot) { Copy-Item -LiteralPath $copot -Destination (Join-Path $AKAR 'copot-aleta.cmd') -Force }
    $salinanPemasang = Join-Path $AKAR 'pasang-aleta.cmd'
    if ($env:ALETA_CMD -and (Test-Path -LiteralPath $env:ALETA_CMD) -and -not (Jalur-Sama $env:ALETA_CMD $salinanPemasang)) {
        Copy-Item -LiteralPath $env:ALETA_CMD -Destination $salinanPemasang -Force
    }
}

# ---------------------------------------------------------------------------
# Pembaru otomatis (pemasang yang sudah ada, ikut di dalam paket)
# ---------------------------------------------------------------------------
function Pasang-Pembaru([string]$folder, [string[]]$ids) {
    $cmd = Join-Path $folder 'pembaru\pasang-pembaru-aleta.cmd'
    if (-not (Test-Path -LiteralPath $cmd)) { return 'TIDAK DIPASANG - pasang-pembaru-aleta.cmd tidak ada di folder ekstensi' }
    $asal = $script:AsalDipakai
    if (-not $asal) { $asal = @(Daftar-Asal)[0] }
    $atur = @{
        ALETA_PEMBARU_FOLDER = $folder
        ALETA_PEMBARU_ID = ($ids -join ',')
        ALETA_PEMBARU_ASAL = $asal
        ALETA_TANPA_JEDA = '1'
    }
    if ($env:ALETA_PASANG_PROFIL -and -not $env:ALETA_PEMBARU_PROFIL) { $atur['ALETA_PEMBARU_PROFIL'] = $env:ALETA_PASANG_PROFIL }
    $simpan = @{}
    foreach ($k in @($atur.Keys)) {
        $simpan[$k] = [Environment]::GetEnvironmentVariable($k)
        [Environment]::SetEnvironmentVariable($k, [string]$atur[$k])
    }
    Tulis ''
    try {
        # /c ""alamat"": cmd membuang sepasang kutip terluar, alamat tetap berkutip
        # (aman untuk nama pengguna berspasi atau berkurung).
        $proses = Start-Process -FilePath $env:ComSpec -ArgumentList ('/d /c ""' + $cmd + '""') -NoNewWindow -PassThru
        $null = $proses.Handle
        $proses.WaitForExit()
        $kode = $proses.ExitCode
    } finally {
        foreach ($k in @($simpan.Keys)) { [Environment]::SetEnvironmentVariable($k, $simpan[$k]) }
    }
    Catat ('pasang-pembaru-aleta.cmd selesai dengan kode ' + $kode)
    if ($kode -eq 0) { return 'terpasang' }
    return ('BELUM - pemasang pembaru berhenti dengan kode ' + $kode + ' (lihat keterangan di atas)')
}

function Salin-Ke-Papan([string]$teks) {
    if ($MODE_UJI) { return $false }
    try { Set-Clipboard -Value $teks; return $true } catch { }
    return $false
}

function Buka-Halaman-Ekstensi {
    if ($MODE_UJI) { return $false }
    $calon = @()
    foreach ($k in @('HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe', 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe')) {
        try { $v = [string](Get-ItemProperty -LiteralPath $k -ErrorAction Stop).'(default)'; if ($v) { $calon += $v.Trim('"') } } catch { }
    }
    $calon += (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe')
    if (${env:ProgramFiles(x86)}) { $calon += (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe') }
    $calon += (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
    foreach ($c in $calon) {
        if ($c -and (Test-Path -LiteralPath $c)) {
            try { Start-Process -FilePath $c -ArgumentList 'chrome://extensions/'; return $true } catch { }
        }
    }
    return $false
}

# ---------------------------------------------------------------------------
# Utama
# ---------------------------------------------------------------------------
function Utama {
    Tulis ''
    Tulis 'Pemasang ALETA (ekstensi + Mode Pengembang + pembaru otomatis)'
    Tulis '---------------------------------------------------------------'
    Catat ('mulai; lokasi tetap ' + $FOLDER_TETAP)

    # 1. Pemasangan lama di lokasi lain
    $terdaftar = @(Ekstensi-Terdaftar)
    $tetapDimuat = @($terdaftar | Where-Object { Jalur-Sama $_.Folder $FOLDER_TETAP }).Count -gt 0
    $lama = @(Cari-Lama $terdaftar)
    $folder = $FOLDER_TETAP
    $acuanLama = ''
    $pindah = $false
    if ($lama.Count -gt 0 -and -not $tetapDimuat) {
        Tulis ''
        Tulis 'Ditemukan ekstensi ALETA di lokasi lain:'
        foreach ($l in $lama) { Tulis ('  - ' + $l + '  (versi ' + (Nilai-Manifest $l 'version') + ')') }
        Tulis ''
        Tulis ('Lokasi tetap yang disarankan: ' + $FOLDER_TETAP)
        Tulis '(folder tersembunyi di profil Windows, tidak ikut terhapus saat membersihkan Unduhan/Desktop)'
        Tulis '  [B] pasang di lokasi tetap (disarankan). Folder lama TIDAK dihapus.'
        Tulis '      Sesudah dimuat, hapus kartu ALETA lama di chrome://extensions bila masih ada.'
        Tulis '      Bila ID ekstensinya berubah, setelan tampilan di ekstensi (bukan data portal) perlu diatur ulang.'
        Tulis '  [L] tetap memakai lokasi lama (hanya Mode Pengembang dan pembaru otomatis yang diatur)'
        Tulis '  [K] keluar tanpa mengubah apa pun'
        $j = Tanya 'Pilihan (B/L/K)' 'B'
        if ($j -eq 'K') {
            Lapor 'Dibatalkan. Tidak ada yang diubah.'
            return 0
        }
        if ($j -eq 'L') {
            $folder = $lama[0]
            if ($script:FolderPembaruLama -and (Folder-Aleta $script:FolderPembaruLama)) { $folder = $script:FolderPembaruLama }
            Lapor ('Tetap memakai lokasi lama: ' + $folder)
        } else {
            $pindah = $true
            $acuanLama = $lama[0]
            if ($script:FolderPembaruLama -and (Folder-Aleta $script:FolderPembaruLama)) { $acuanLama = $script:FolderPembaruLama }
        }
    }

    # 2. Berkas ekstensi
    if (Jalur-Sama $folder $FOLDER_TETAP) {
        Pasang-Berkas $acuanLama
    } elseif (-not (Test-Path -LiteralPath $AKAR)) {
        $null = New-Item -ItemType Directory -Path $AKAR -Force
        Sembunyikan $AKAR
    }

    # 3. Mode Pengembang
    Tulis ''
    Tulis 'Mode Pengembang Chrome...'
    $statusMode = Atur-Mode-Pengembang
    Lapor ('Mode Pengembang : ' + $statusMode)

    # 4. Pembaru otomatis
    $terdaftar = @(Ekstensi-Terdaftar)
    $dimuat = @($terdaftar | Where-Object { Jalur-Sama $_.Folder $folder })
    $ids = New-Object System.Collections.ArrayList
    foreach ($d in $dimuat) { if (-not $ids.Contains($d.Id)) { $null = $ids.Add($d.Id) } }
    foreach ($x in @(Id-Ekstensi $folder)) { if (-not $ids.Contains($x)) { $null = $ids.Add($x) } }
    Catat ('ID ekstensi: ' + ($ids.ToArray() -join ', '))
    Tulis ''
    Tulis 'Pembaru otomatis...'
    $statusPembaru = Pasang-Pembaru $folder ([string[]]$ids.ToArray())
    Lapor ('Pembaru otomatis: ' + $statusPembaru)

    # 5. Ringkasan dan langkah Load unpacked
    $versi = Nilai-Manifest $folder 'version'
    Tulis ''
    Tulis '==============================================================='
    Tulis ' SELESAI'
    Tulis ('  Lokasi ekstensi : ' + $folder + '  (versi ' + $versi + ')')
    Tulis ('  Mode Pengembang : ' + $statusMode)
    Tulis ('  Pembaru otomatis: ' + $statusPembaru)
    if ($dimuat.Count -gt 0) {
        Tulis '  Dimuat di Chrome: sudah - langkah Load unpacked dilewati'
    } else {
        Tulis '  Dimuat di Chrome: BELUM - satu langkah lagi, lihat di bawah'
    }
    Tulis ('  Catatan kerja   : ' + $LOG)
    if (Test-Path -LiteralPath (Join-Path $AKAR 'copot-aleta.cmd')) { Tulis ('  Mencopot        : ' + (Join-Path $AKAR 'copot-aleta.cmd')) }
    Tulis '==============================================================='
    Catat ('selesai; versi ' + $versi + '; dimuat=' + ($dimuat.Count -gt 0))

    if ($dimuat.Count -eq 0) {
        $disalin = Salin-Ke-Papan $folder
        $dibuka = Buka-Halaman-Ekstensi
        Tulis ''
        Tulis 'SATU LANGKAH TERAKHIR (sekali saja per komputer)'
        Tulis 'Chrome tidak mengizinkan program lain memuat ekstensi di luar Chrome Web Store'
        Tulis 'secara diam-diam, jadi langkah ini dikerjakan dengan tangan - SEKALI:'
        if ($dibuka) {
            Tulis '  1. Halaman chrome://extensions sudah dibuka di Chrome.'
        } else {
            Tulis '  1. Buka Chrome, ketik chrome://extensions di bilah alamat, tekan Enter.'
        }
        Tulis '  2. Pastikan sakelar "Mode pengembang" (Developer mode) di kanan atas menyala.'
        Tulis '  3. Klik "Muat yang belum dibuka" (Load unpacked).'
        if ($disalin) {
            Tulis '  4. Di jendela pilih folder: klik bilah alamat di atasnya, tekan Ctrl+V lalu Enter,'
            Tulis '     kemudian klik "Pilih Folder" (Select Folder). Alamat ini SUDAH disalin:'
        } else {
            Tulis '  4. Di jendela pilih folder: ketik alamat berikut di bilah alamat atasnya, Enter,'
            Tulis '     kemudian klik "Pilih Folder" (Select Folder):'
        }
        Tulis ('       ' + $folder)
        Tulis '     (folder .aleta sengaja tersembunyi, jadi tidak tampil bila dicari dengan mengeklik)'
        Tulis '  5. Kartu "ALETA E-Court" muncul. Pembaruan berikutnya berjalan sendiri.'
        if ($pindah) {
            Tulis '  6. Bila masih ada kartu ALETA E-Court lama (lokasi lain), klik Hapus (Remove) pada kartu lama.'
        }
        Tulis ''
        Tulis 'Bila ikon ALETA kemudian menyebut "Pembaruan otomatis" belum aktif, jalankan pemasang ini sekali lagi.'
    }
    return 0
}

try {
    $hasil = @(Utama)
    exit ([int]$hasil[$hasil.Count - 1])
} catch {
    $pesan = Ringkas $_.Exception.Message
    Catat ('GAGAL: ' + $pesan)
    Tulis ''
    Tulis ('GAGAL: ' + $pesan)
    Tulis ('Tidak ada yang dirusak. Catatan kerja: ' + $LOG)
    Tulis 'Jalankan lagi berkas ini; bila tetap gagal, hubungi pengelola ALETA.'
    exit 1
}
