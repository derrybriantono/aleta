# ============================================================================
# PEMBARU OTOMATIS EKSTENSI ALETA  (pembantu lokal / native messaging host)
# ============================================================================
#
# Dipasang SEKALI per komputer oleh pasang-pembaru-aleta.cmd, tanpa hak admin,
# di %LOCALAPPDATA%\ALETA\pembaru. Chrome menjalankannya hanya ketika ekstensi
# ALETA memintanya (chrome.runtime.connectNative), lewat pembaru-aleta.cmd.
#
# Kenapa ada: ekstensi yang dimuat sebagai folder (Load unpacked) tidak dapat
# menimpa berkasnya sendiri, dan unduhan lewat Chrome dicegat Internet Download
# Manager (berkas ZIP-nya jadi 0 byte). Pembantu ini mengunduh LANGSUNG dari
# server, memeriksa sidiknya, lalu menyalin ke folder ekstensi - tanpa unduhan
# peramban dan tanpa menanyai petugas.
#
# Batas keamanan (semuanya diperiksa di sini, bukan hanya di ekstensi):
#   - hanya mengunduh dari asal server yang tertulis di konfigurasi.json;
#   - sidik SHA-256 paket harus sama dengan yang dikirim ekstensi;
#   - isi ZIP hanya diekstrak ke folder sementara di samping folder ekstensi
#     (nama aman, jenis berkas dibatasi), TIDAK ADA berkas yang dijalankan;
#   - hanya menyentuh folder ekstensi yang terdaftar dan manifest-nya bernama
#     "ALETA E-Court"; tidak menyentuh profil Chrome maupun setelan petugas.
#   - tidak menyimpan sandi apa pun.
#
# Protokol: pesan JSON berbingkai (4 bita panjang little-endian + UTF-8), satu
# jawaban akhir per perintah ("selesai": true). Perintah: ping, siapkan, pasang,
# pulihkan. Berkas ini sengaja ASCII saja.

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Set-StrictMode -Version 2

$VERSI_PEMBANTU = 1
$RUMAH = $PSScriptRoot
if (-not $RUMAH) { $RUMAH = Split-Path -Parent $MyInvocation.MyCommand.Path }
$NAMA_MANIFEST = 'ALETA E-Court'
$MAKS_PAKET = 64MB
$MAKS_ISI = 160MB
$MAKS_BERKAS = 1500
$JENIS_BOLEH = @('js', 'css', 'html', 'json', 'png', 'md', 'txt', 'ps1', 'cmd')

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

# ---------------------------------------------------------------------------
# Catatan kerja (berkas log kecil di samping skrip)
# ---------------------------------------------------------------------------
function Catat([string]$teks) {
    try {
        $log = Join-Path $RUMAH 'pembaru.log'
        if ((Test-Path -LiteralPath $log) -and ((Get-Item -LiteralPath $log).Length -gt 200KB)) {
            Remove-Item -LiteralPath $log -Force
        }
        $baris = '{0} {1}' -f (Get-Date).ToString('yyyy-MM-dd HH:mm:ss'), $teks
        [IO.File]::AppendAllText($log, $baris + [Environment]::NewLine)
    } catch { }
}

function Ringkas([string]$teks) {
    $t = ($teks -replace '[\r\n]+', ' ').Trim()
    if ($t.Length -gt 240) { $t = $t.Substring(0, 240) }
    return $t
}

# ---------------------------------------------------------------------------
# Bingkai pesan Chrome
# ---------------------------------------------------------------------------
$masuk = [Console]::OpenStandardInput()
$keluar = [Console]::OpenStandardOutput()

function Baca-Penuh([IO.Stream]$aliran, [byte[]]$isi, [int]$jumlah) {
    $sudah = 0
    while ($sudah -lt $jumlah) {
        $n = $aliran.Read($isi, $sudah, $jumlah - $sudah)
        if ($n -le 0) { return $sudah }
        $sudah += $n
    }
    return $sudah
}

function Baca-Pesan {
    $kepala = New-Object byte[] 4
    if ((Baca-Penuh $masuk $kepala 4) -lt 4) { return $null }
    $panjang = [BitConverter]::ToUInt32($kepala, 0)
    if ($panjang -gt 1048576) { throw 'pesan terlalu besar' }
    $badan = New-Object byte[] ([int]$panjang)
    if ((Baca-Penuh $masuk $badan ([int]$panjang)) -lt $panjang) { return $null }
    return ([Text.Encoding]::UTF8.GetString($badan) | ConvertFrom-Json)
}

function Kirim($obyek) {
    $json = $obyek | ConvertTo-Json -Compress -Depth 6
    $bita = [Text.Encoding]::UTF8.GetBytes($json)
    $kepala = [BitConverter]::GetBytes([uint32]$bita.Length)
    $keluar.Write($kepala, 0, 4)
    $keluar.Write($bita, 0, $bita.Length)
    $keluar.Flush()
}

function Ambil($obyek, [string]$nama) {
    if ($null -eq $obyek) { return $null }
    $p = $obyek.PSObject.Properties[$nama]
    if ($null -eq $p) { return $null }
    return $p.Value
}

function Galat([string]$kode, [string]$pesan) {
    return @{ ok = $false; galat = $kode; pesan = $pesan }
}

# ---------------------------------------------------------------------------
# Konfigurasi dan pemeriksaan folder
# ---------------------------------------------------------------------------
function Muat-Konfigurasi {
    $berkas = Join-Path $RUMAH 'konfigurasi.json'
    if (-not (Test-Path -LiteralPath $berkas)) { throw 'konfigurasi.json tidak ada - jalankan ulang pemasangnya' }
    return ([IO.File]::ReadAllText($berkas) | ConvertFrom-Json)
}

function Baca-Manifest([string]$folder) {
    $m = Join-Path $folder 'manifest.json'
    if (-not (Test-Path -LiteralPath $m)) { return $null }
    try { return ([IO.File]::ReadAllText($m) | ConvertFrom-Json) } catch { return $null }
}

# Folder ekstensi yang sah: ada, manifest-nya bernama ALETA E-Court, ada latar.js
# dan popup.html, dan bukan akar drive.
function Periksa-Folder([string]$folder) {
    if (-not $folder) { return 'folder belum dicatat' }
    try { $penuh = [IO.Path]::GetFullPath($folder) } catch { return 'alamat folder tidak sah' }
    if ($penuh.TrimEnd('\').Length -le 3) { return 'folder adalah akar drive' }
    if (-not (Test-Path -LiteralPath $penuh -PathType Container)) { return 'folder tidak ditemukan (dipindah atau dihapus)' }
    $mf = Baca-Manifest $penuh
    if ($null -eq $mf) { return 'manifest.json tidak terbaca' }
    if ((Ambil $mf 'name') -ne $NAMA_MANIFEST) { return 'folder ini bukan ekstensi ALETA E-Court' }
    if (-not (Test-Path -LiteralPath (Join-Path $penuh 'latar.js'))) { return 'latar.js tidak ada di folder' }
    return ''
}

function Asal-Diizinkan([string]$asal, $cfg) {
    $a = ([string]$asal).Trim().TrimEnd('/').ToLowerInvariant()
    if (-not $a) { return $false }
    foreach ($x in @(Ambil $cfg 'asal')) {
        if (([string]$x).Trim().TrimEnd('/').ToLowerInvariant() -eq $a) { return $true }
    }
    return $false
}

function Versi-Sah([string]$v) { return ($v -match '^\d{1,4}(\.\d{1,5}){1,3}$') }
function Sidik-Sah([string]$s) { return ($s -match '^[0-9a-f]{64}$') }

function Sidik-Berkas([string]$jalur) {
    $sha = [Security.Cryptography.SHA256]::Create()
    $fs = [IO.File]::Open($jalur, 'Open', 'Read', 'Read')
    try {
        $h = $sha.ComputeHash($fs)
    } finally {
        $fs.Dispose()
        $sha.Dispose()
    }
    return (($h | ForEach-Object { $_.ToString('x2') }) -join '')
}

# ---------------------------------------------------------------------------
# Unduh langsung dari server (tanpa peramban, jadi tanpa IDM)
# ---------------------------------------------------------------------------
function Unduh-Berkas([string]$alamat, [string]$tujuan, [long]$maks) {
    $req = [Net.HttpWebRequest][Net.WebRequest]::Create($alamat)
    $req.Method = 'GET'
    $req.AllowAutoRedirect = $false
    $req.Timeout = 30000
    $req.ReadWriteTimeout = 60000
    $req.Proxy = $null
    $req.UserAgent = 'ALETA-Pembaru/1'
    $res = $req.GetResponse()
    try {
        if ([int]$res.StatusCode -ne 200) { throw ('server menjawab ' + [int]$res.StatusCode) }
        $len = $res.ContentLength
        if ($len -gt $maks) { throw 'paket terlalu besar' }
        $masukHttp = $res.GetResponseStream()
        $berkas = [IO.File]::Create($tujuan)
        try {
            $buf = New-Object byte[] 65536
            $total = 0L
            while ($true) {
                $n = $masukHttp.Read($buf, 0, $buf.Length)
                if ($n -le 0) { break }
                $total += $n
                if ($total -gt $maks) { throw 'paket terlalu besar' }
                $berkas.Write($buf, 0, $n)
            }
            return $total
        } finally {
            $berkas.Dispose()
            $masukHttp.Dispose()
        }
    } finally {
        $res.Close()
    }
}

# ---------------------------------------------------------------------------
# Ekstrak ZIP dengan aman
# ---------------------------------------------------------------------------
function Nama-Aman([string]$rel) {
    if (-not $rel) { return $false }
    if ($rel.StartsWith('/') -or $rel.Contains(':') -or $rel.Contains('\')) { return $false }
    foreach ($seg in $rel.TrimEnd('/').Split('/')) {
        if ($seg -eq '' -or $seg -eq '.' -or $seg -eq '..') { return $false }
        if ($seg -notmatch '^[A-Za-z0-9._\-]+$') { return $false }
    }
    return $true
}

function Ekstrak-Aman([string]$zip, [string]$tujuan) {
    if (Test-Path -LiteralPath $tujuan) { Remove-Item -LiteralPath $tujuan -Recurse -Force }
    $null = New-Item -ItemType Directory -Path $tujuan
    $akar = [IO.Path]::GetFullPath($tujuan).TrimEnd('\') + '\'
    $arsip = [IO.Compression.ZipFile]::OpenRead($zip)
    try {
        $butir = @($arsip.Entries)
        if ($butir.Count -gt $MAKS_BERKAS) { throw 'terlalu banyak berkas di paket' }
        $nama = @($butir | ForEach-Object { $_.FullName })
        # Awalan folder tunggal (mis. "ekstensi-sipp/") dibuang bila manifest.json tidak di akar.
        $awalan = ''
        if ($nama -notcontains 'manifest.json') {
            $pertama = ($nama | Select-Object -First 1)
            if ($pertama -and $pertama.Contains('/')) {
                $kandidat = $pertama.Substring(0, $pertama.IndexOf('/') + 1)
                if ($nama -contains ($kandidat + 'manifest.json')) { $awalan = $kandidat }
            }
        }
        $jumlahBerkas = 0
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
            $sumber = $e.Open()
            try {
                $out = [IO.File]::Create($dest)
                try {
                    $buf = New-Object byte[] 65536
                    $baca = 0L
                    while ($true) {
                        $n = $sumber.Read($buf, 0, $buf.Length)
                        if ($n -le 0) { break }
                        $baca += $n
                        if ($baca -gt $e.Length) { throw ('ukuran berkas melebihi catatan: ' + $rel) }
                        $out.Write($buf, 0, $n)
                    }
                } finally {
                    $out.Dispose()
                }
            } finally {
                $sumber.Dispose()
            }
            $jumlahBerkas += 1
        }
        return $jumlahBerkas
    } finally {
        $arsip.Dispose()
    }
}

# ---------------------------------------------------------------------------
# Kebijakan "key" manifest: ID ekstensi TIDAK BOLEH berubah
# ---------------------------------------------------------------------------
# Folder yang dimuat tanpa "key" mendapat ID dari alamat foldernya; bila manifest
# baru membawa "key", ID-nya berganti dan SEMUA setelan petugas (chrome.storage)
# hilang. Maka: bentuk manifest baru disamakan dengan yang terpasang.
function Ada-Kunci([string]$t) { return ($t -match '"key"\s*:\s*"') }
function Ambil-Kunci([string]$t) {
    $m = [regex]::Match($t, '"key"\s*:\s*"([^"]*)"')
    if ($m.Success) { return $m.Groups[1].Value }
    return ''
}
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

function Selaraskan-Manifest([string]$folderLama, [string]$folderBaru) {
    $mLama = Join-Path $folderLama 'manifest.json'
    $mBaru = Join-Path $folderBaru 'manifest.json'
    $tLama = [IO.File]::ReadAllText($mLama)
    $tBaru = [IO.File]::ReadAllText($mBaru)
    $lamaAda = Ada-Kunci $tLama
    $baruAda = Ada-Kunci $tBaru
    $hasil = $tBaru
    if ($lamaAda) {
        $kLama = Ambil-Kunci $tLama
        if ((-not $baruAda) -or ((Ambil-Kunci $tBaru) -ne $kLama)) {
            if ($baruAda) { $hasil = Buang-Kunci $hasil }
            $hasil = Pasang-Kunci $hasil $kLama
        }
    } elseif ($baruAda) {
        $hasil = Buang-Kunci $hasil
    }
    if ($hasil -ne $tBaru) {
        $null = ($hasil | ConvertFrom-Json)
        [IO.File]::WriteAllText($mBaru, $hasil, (New-Object Text.UTF8Encoding($false)))
    }
    # Keadaan akhir wajib sama dengan yang terpasang.
    $akhir = [IO.File]::ReadAllText($mBaru)
    if ((Ada-Kunci $akhir) -ne $lamaAda) { throw 'kunci manifest tidak dapat diselaraskan' }
    if ($lamaAda -and ((Ambil-Kunci $akhir) -ne (Ambil-Kunci $tLama))) { throw 'kunci manifest berbeda dari yang terpasang' }
}

# ---------------------------------------------------------------------------
# Perintah
# ---------------------------------------------------------------------------
function Berkas-Tahap { return (Join-Path $RUMAH 'tahap.json') }

function Perintah-Ping {
    $folder = ''
    $sebab = ''
    $versiFolder = ''
    $ids = @()
    try {
        $cfg = Muat-Konfigurasi
        $folder = [string](Ambil $cfg 'folder')
        $ids = @(@(Ambil $cfg 'id') | Where-Object { $_ })
        $sebab = Periksa-Folder $folder
        if (-not $sebab) {
            $mf = Baca-Manifest $folder
            $versiFolder = [string](Ambil $mf 'version')
        }
    } catch {
        $sebab = Ringkas $_.Exception.Message
    }
    return @{ ok = $true; versiPembantu = $VERSI_PEMBANTU; folder = $folder; folderSah = ($sebab -eq ''); sebab = $sebab; versiFolder = $versiFolder; id = $ids }
}

function Bisa-Buat([string]$jalur) {
    try {
        if (Test-Path -LiteralPath $jalur) { Remove-Item -LiteralPath $jalur -Recurse -Force }
        $null = New-Item -ItemType Directory -Path $jalur
        Remove-Item -LiteralPath $jalur -Recurse -Force
        return $true
    } catch {
        return $false
    }
}

function Perintah-Siapkan($m) {
    $cfg = Muat-Konfigurasi
    $folder = [string](Ambil $cfg 'folder')
    $sebab = Periksa-Folder $folder
    if ($sebab) { return (Galat 'folder-tidak-sah' $sebab) }

    $asal = [string](Ambil $m 'asal')
    $versi = [string](Ambil $m 'versi')
    $sidik = ([string](Ambil $m 'sha256')).ToLowerInvariant()
    $ukuran = [long]0
    $uk = Ambil $m 'ukuran'
    if ($null -ne $uk) { $ukuran = [long]$uk }
    if (-not (Asal-Diizinkan $asal $cfg)) { return (Galat 'asal-ditolak' 'alamat server tidak ada dalam daftar yang diizinkan pembantu') }
    if (-not (Versi-Sah $versi)) { return (Galat 'versi-tidak-sah' 'nomor versi tidak sah') }
    if (-not (Sidik-Sah $sidik)) { return (Galat 'sidik-tidak-sah' 'sidik paket tidak sah') }

    $gembok = New-Object Threading.Mutex($false, 'Local\ALETA_Pembaru')
    if (-not $gembok.WaitOne(0)) { return (Galat 'sibuk' 'pembaruan lain sedang berjalan') }
    try {
        $tmp = Join-Path $RUMAH 'tmp'
        if (-not (Test-Path -LiteralPath $tmp)) { $null = New-Item -ItemType Directory -Path $tmp }
        Get-ChildItem -LiteralPath $tmp -Force | Remove-Item -Recurse -Force
        $zip = Join-Path $tmp ('paket-' + $versi + '.zip')
        $alamat = $asal.Trim().TrimEnd('/') + '/api/aleta-ecourt/ekstensi/pembaru/paket?versi=' + $versi + '&sha256=' + $sidik
        Catat ('siapkan ' + $versi + ' dari ' + $asal)
        $diunduh = Unduh-Berkas $alamat $zip $MAKS_PAKET
        if ($ukuran -gt 0 -and $diunduh -ne $ukuran) {
            Remove-Item -LiteralPath $zip -Force
            return (Galat 'ukuran-beda' ('ukuran paket ' + $diunduh + ' bita, seharusnya ' + $ukuran))
        }
        $hitung = Sidik-Berkas $zip
        if ($hitung -ne $sidik) {
            Remove-Item -LiteralPath $zip -Force
            return (Galat 'sidik-beda' 'sidik paket tidak cocok dengan yang diumumkan server - dibatalkan')
        }

        # Folder sementara DI SAMPING folder ekstensi (satu drive) supaya penukarannya satu langkah.
        $folderPenuh = [IO.Path]::GetFullPath($folder).TrimEnd('\')
        $staging = $folderPenuh + '.aleta-baru'
        $mode = 'tukar'
        if (-not (Bisa-Buat $staging)) {
            # Tidak bisa menulis di samping folder: sementara di rumah pembantu, dipasang dengan menyalin.
            $staging = Join-Path $tmp 'baru'
            $mode = 'salin'
        }
        $null = Ekstrak-Aman $zip $staging

        $mfBaru = Baca-Manifest $staging
        if ($null -eq $mfBaru) { throw 'manifest.json paket tidak terbaca' }
        if ((Ambil $mfBaru 'name') -ne $NAMA_MANIFEST) { throw 'paket bukan ekstensi ALETA E-Court' }
        if ([string](Ambil $mfBaru 'version') -ne $versi) { throw ('versi di paket ' + (Ambil $mfBaru 'version') + ', diminta ' + $versi) }
        foreach ($wajib in @('latar.js', 'popup.html')) {
            if (-not (Test-Path -LiteralPath (Join-Path $staging $wajib))) { throw ($wajib + ' tidak ada di paket') }
        }
        Selaraskan-Manifest $folderPenuh $staging

        $tahap = @{ versi = $versi; staging = $staging; folder = $folderPenuh; mode = $mode; sidik = $sidik; pada = (Get-Date).ToString('o') }
        [IO.File]::WriteAllText((Berkas-Tahap), ($tahap | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding($false)))
        Remove-Item -LiteralPath $zip -Force
        Catat ('siap ' + $versi + ' mode ' + $mode)
        return @{ ok = $true; siap = $true; versi = $versi; mode = $mode }
    } finally {
        $gembok.ReleaseMutex()
        $gembok.Dispose()
    }
}

function Salin-Menimpa([string]$dari, [string]$ke) {
    # Dipakai bila folder tidak bisa dipindah (terkunci): berkas lain dahulu, manifest TERAKHIR.
    $akarDari = [IO.Path]::GetFullPath($dari).TrimEnd('\') + '\'
    $semua = @(Get-ChildItem -LiteralPath $dari -Recurse -File -Force)
    $urut = @($semua | Where-Object { $_.FullName.Substring($akarDari.Length) -ne 'manifest.json' }) + @($semua | Where-Object { $_.FullName.Substring($akarDari.Length) -eq 'manifest.json' })
    foreach ($b in $urut) {
        $rel = $b.FullName.Substring($akarDari.Length)
        $dest = Join-Path $ke $rel
        $induk = Split-Path -Parent $dest
        if (-not (Test-Path -LiteralPath $induk)) { $null = New-Item -ItemType Directory -Path $induk -Force }
        Copy-Item -LiteralPath $b.FullName -Destination $dest -Force
    }
}

function Perintah-Pasang($m) {
    $cfg = Muat-Konfigurasi
    $folder = [IO.Path]::GetFullPath([string](Ambil $cfg 'folder')).TrimEnd('\')
    $sebab = Periksa-Folder $folder
    if ($sebab) { return (Galat 'folder-tidak-sah' $sebab) }
    $versi = [string](Ambil $m 'versi')
    if (-not (Versi-Sah $versi)) { return (Galat 'versi-tidak-sah' 'nomor versi tidak sah') }
    $berkasTahap = Berkas-Tahap
    if (-not (Test-Path -LiteralPath $berkasTahap)) { return (Galat 'belum-siap' 'paket belum disiapkan') }
    $tahap = [IO.File]::ReadAllText($berkasTahap) | ConvertFrom-Json
    if ([string](Ambil $tahap 'versi') -ne $versi) { return (Galat 'belum-siap' 'paket yang disiapkan bukan versi ini') }
    if (([IO.Path]::GetFullPath([string](Ambil $tahap 'folder'))).TrimEnd('\') -ne $folder) { return (Galat 'belum-siap' 'folder berubah sejak paket disiapkan') }
    $staging = [string](Ambil $tahap 'staging')
    $mfBaru = Baca-Manifest $staging
    if ($null -eq $mfBaru -or [string](Ambil $mfBaru 'version') -ne $versi) { return (Galat 'belum-siap' 'folder sementara tidak utuh') }

    $gembok = New-Object Threading.Mutex($false, 'Local\ALETA_Pembaru')
    if (-not $gembok.WaitOne(0)) { return (Galat 'sibuk' 'pembaruan lain sedang berjalan') }
    try {
        $lama = $folder + '.aleta-lama'
        $cara = ''
        if ([string](Ambil $tahap 'mode') -eq 'tukar') {
            try {
                if (Test-Path -LiteralPath $lama) { Remove-Item -LiteralPath $lama -Recurse -Force }
                [IO.Directory]::Move($folder, $lama)
                try {
                    [IO.Directory]::Move($staging, $folder)
                    $cara = 'tukar'
                } catch {
                    [IO.Directory]::Move($lama, $folder)
                    throw
                }
            } catch {
                Catat ('tukar folder gagal, menyalin: ' + (Ringkas $_.Exception.Message))
                $cara = ''
            }
        }
        if (-not $cara) {
            Salin-Menimpa $staging $folder
            $cara = 'salin'
            Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue
        }
        Remove-Item -LiteralPath $berkasTahap -Force -ErrorAction SilentlyContinue

        $mf = Baca-Manifest $folder
        if ($null -eq $mf -or [string](Ambil $mf 'version') -ne $versi) { return (Galat 'tidak-terverifikasi' 'folder sesudah pemasangan tidak berisi versi yang diminta') }
        Catat ('terpasang ' + $versi + ' cara ' + $cara)
        return @{ ok = $true; versi = $versi; cara = $cara }
    } finally {
        $gembok.ReleaseMutex()
        $gembok.Dispose()
    }
}

function Perintah-Pulihkan {
    $cfg = Muat-Konfigurasi
    $folder = [IO.Path]::GetFullPath([string](Ambil $cfg 'folder')).TrimEnd('\')
    $lama = $folder + '.aleta-lama'
    if (-not (Test-Path -LiteralPath $lama -PathType Container)) { return (Galat 'tanpa-cadangan' 'tidak ada salinan versi sebelumnya') }
    if ($null -eq (Baca-Manifest $lama)) { return (Galat 'tanpa-cadangan' 'salinan sebelumnya tidak utuh') }
    $sisa = $folder + '.aleta-gagal'
    if (Test-Path -LiteralPath $sisa) { Remove-Item -LiteralPath $sisa -Recurse -Force }
    [IO.Directory]::Move($folder, $sisa)
    [IO.Directory]::Move($lama, $folder)
    Remove-Item -LiteralPath $sisa -Recurse -Force -ErrorAction SilentlyContinue
    Catat 'dipulihkan ke versi sebelumnya'
    return @{ ok = $true; versi = [string](Ambil (Baca-Manifest $folder) 'version') }
}

function Tangani($m) {
    switch ([string](Ambil $m 'perintah')) {
        'ping' { return (Perintah-Ping) }
        'siapkan' { return (Perintah-Siapkan $m) }
        'pasang' { return (Perintah-Pasang $m) }
        'pulihkan' { return (Perintah-Pulihkan) }
        default { return (Galat 'perintah-tidak-dikenal' 'perintah tidak dikenal') }
    }
}

# ---------------------------------------------------------------------------
# Putaran utama: satu jawaban akhir per pesan sampai Chrome menutup pipa
# ---------------------------------------------------------------------------
while ($true) {
    $pesan = $null
    try {
        $pesan = Baca-Pesan
    } catch {
        Catat ('pesan tidak terbaca: ' + (Ringkas $_.Exception.Message))
        break
    }
    if ($null -eq $pesan) { break }
    try {
        $jawab = Tangani $pesan
    } catch {
        Catat ('galat: ' + (Ringkas $_.Exception.Message))
        $jawab = Galat 'gagal' (Ringkas $_.Exception.Message)
    }
    $jawab['selesai'] = $true
    Kirim $jawab
}
