# ALETA - MENGUNCI SIPP/ABT LOKAL MENJADI HANYA-BACA selama mode kembaran (keputusan pengguna 18 Okt 2026, butir 23).
#
#   powershell -File scripts\kembaran\kunci-sipp-abt.ps1            kunci  (dipanggil nyalakan.ps1)
#   powershell -File scripts\kembaran\kunci-sipp-abt.ps1 -Balik     buka kembali (dipanggil nyalakan.ps1 -Henti)
#   powershell -File scripts\kembaran\kunci-sipp-abt.ps1 -Uji       hanya menampilkan SQL yang akan dijalankan
#
# MASALAHNYA. Halaman SIPP dan ABT lokal (port 8056) menyambung ke MySQL XAMPP sebagai akun `root`
# (config.ini SIPP, application/config/database.php ABT - folder ABT tidak boleh disunting). ALETA sendiri
# (bot kembaran) juga butuh menulis ke salinan lokal, jadi MySQL read_only global tidak bisa dipakai
# (root punya hak SUPER dan lolos darinya, dan bot ikut terkunci).
#
# CARANYA - tanpa mengubah sandi satu akun pun dan tanpa menyentuh berkas SIPP/ABT:
#   1. Hak akun `root` (semua host-nya) dibaca lewat SHOW GRANTS dan disimpan UTUH di
#      <folderKembaran>\kunci-sipp-abt\grants-asli.sql.
#   2. Akun baru `kembaran_penuh` dibuat dengan hak dan HASH SANDI yang sama persis (GRANT yang sama, nama
#      akunnya saja diganti), lalu dicoba masuk. Gagal = berhenti, `root` belum disentuh.
#   3. Lewat `kembaran_penuh`, hak `root` DICABUT lalu diganti SELECT saja pada sipp_donggala, aps_badilag,
#      dan sipp_turunan_antrian. Aplikasi SIPP/ABT yang masuk sebagai `root` jadi hanya dapat membaca; sandinya
#      tetap, jadi tidak ada konfigurasi aplikasi yang berubah.
#   4. nyalakan.ps1 menjalankan bot kembaran sebagai `kembaran_penuh` (ALETA_BOT_DB_USER) agar ALETA tetap menulis.
#
# MEMBALIK (-Balik): hak asli `root` dipasang kembali PERSIS dari grants-asli.sql (hash sandi yang sama),
# lalu `kembaran_penuh` dihapus. Selama terkunci, alat lain yang memakai `root` (Navicat, tarik.mjs) hanya-baca:
# jalankan tarik.mjs SEBELUM menyalakan kembaran, atau sesudah -Henti.
#
# Sandi `root` (bila ada) dibaca dari variabel lingkungan yang disebut konfigurasi.json: mysql.sandiDariEnv.
# Tidak pernah ada sandi di berkas ini.
param(
  [switch]$Balik,
  [switch]$Uji,
  [string]$Konfigurasi = 'D:\Aplikasi\aleta\kembaran\konfigurasi.json'
)

$ErrorActionPreference = 'Stop'
$AKUN_PENUH = 'kembaran_penuh'
$DB_BACA = @('sipp_donggala', 'aps_badilag', 'sipp_turunan_antrian')

$env:TMP = 'D:\Aplikasi\aleta\tmp'
$env:TEMP = 'D:\Aplikasi\aleta\tmp'
New-Item -ItemType Directory -Force 'D:\Aplikasi\aleta\tmp' | Out-Null

# --- Konfigurasi -----------------------------------------------------------------------------------------
$k = if (Test-Path $Konfigurasi) { Get-Content -Raw $Konfigurasi | ConvertFrom-Json } else { $null }
$mysqlExe = 'D:\satker asal\website pa bungku\xampp\mysql\bin\mysql.exe'
$dbHost = '127.0.0.1'; $dbPort = 3306; $penggunaAsli = 'root'; $sandiEnv = ''; $folder = 'D:\Aplikasi\aleta\kembaran'
if ($k) {
  if ($k.folderKembaran) { $folder = ($k.folderKembaran -replace '/', '\') }
  if ($k.mysql) {
    if ($k.mysql.mysqlExe) { $mysqlExe = ($k.mysql.mysqlExe -replace '/', '\') }
    if ($k.mysql.host) { $dbHost = $k.mysql.host }
    if ($k.mysql.port) { $dbPort = [int]$k.mysql.port }
    if ($k.mysql.sandiDariEnv) { $sandiEnv = $k.mysql.sandiDariEnv }
  }
}
if (-not ($folder -match '^[Dd]:\\' -or $folder -match '^[Cc]:\\aleta\\')) { throw "folderKembaran harus di drive D: (atau C:\aleta\): $folder" }
$kerja = Join-Path $folder 'kunci-sipp-abt'
$berkasGrants = Join-Path $kerja 'grants-asli.sql'
$berkasKeadaan = Join-Path $kerja 'keadaan.json'
New-Item -ItemType Directory -Force $kerja | Out-Null
if ($sandiEnv -and (Get-Item -Path "Env:$sandiEnv" -ErrorAction SilentlyContinue)) { $env:MYSQL_PWD = (Get-Item -Path "Env:$sandiEnv").Value }

# --- Pembantu --------------------------------------------------------------------------------------------
# SQL dikirim lewat berkas sementara + stdin (bukan argumen) supaya tanda kutip/backtick aman.
function Jalankan-Sql([string]$pengguna, [string]$sql, [switch]$Baca) {
  if ($Uji -and -not $Baca) { Write-Host "[uji] sebagai ${pengguna}:`n$sql"; return @() }
  $f = Join-Path $env:TMP ("kunci-" + [guid]::NewGuid().ToString('N') + '.sql')
  try {
    Set-Content -Path $f -Value $sql -Encoding UTF8
    $hasil = Get-Content -Raw $f | & $mysqlExe -h $dbHost -P $dbPort -u $pengguna --batch --skip-column-names 2>&1
    if ($LASTEXITCODE -ne 0) { throw "mysql gagal (pengguna $pengguna): $($hasil -join ' ')" }
    return @($hasil | ForEach-Object { "$_" } | Where-Object { $_ -ne '' })
  } finally { Remove-Item -Force $f -ErrorAction SilentlyContinue }
}
function Kutip([string]$s) { return $s.Replace("'", "''") }

# --- BALIK -----------------------------------------------------------------------------------------------
if ($Balik) {
  if (-not (Test-Path $berkasKeadaan)) { Write-Host 'Kunci SIPP/ABT tidak aktif (tidak ada catatan keadaan) - tidak ada yang dibalik.'; return }
  $keadaan = Get-Content -Raw $berkasKeadaan | ConvertFrom-Json
  if (-not (Test-Path $berkasGrants)) { throw "Tidak ada $berkasGrants - hak asli tidak dapat dipasang kembali. Pasang hak root secara manual." }
  $hostList = @($keadaan.host)
  $sql = ''
  foreach ($h in $hostList) { $sql += "REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'root'@'$(Kutip $h)';`n" }
  $sql += (Get-Content -Raw $berkasGrants) + "`nFLUSH PRIVILEGES;`n"
  Write-Host 'Membuka kunci: memasang kembali hak asli root ...'
  Jalankan-Sql $AKUN_PENUH $sql | Out-Null
  if (-not $Uji) {
    $cek = Jalankan-Sql 'root' 'SHOW GRANTS FOR CURRENT_USER();' -Baca
    if (-not ($cek -join ' ' -match 'ALL PRIVILEGES ON \*\.\*')) { throw 'Hak root belum pulih penuh; akun kembaran_penuh DIPERTAHANKAN. Periksa grants-asli.sql.' }
  }
  $drop = ''
  foreach ($h in $hostList) { $drop += "DROP USER IF EXISTS '$AKUN_PENUH'@'$(Kutip $h)';`n" }
  Jalankan-Sql 'root' ($drop + "FLUSH PRIVILEGES;`n") | Out-Null
  if (-not $Uji) {
    Move-Item -Force $berkasGrants (Join-Path $kerja ("grants-asli.dipulihkan-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.sql'))
    Remove-Item -Force $berkasKeadaan
  }
  Write-Host 'SIPP/ABT lokal kembali bisa menulis (hak root dipulihkan).'
  return
}

# --- KUNCI -----------------------------------------------------------------------------------------------
if ((Test-Path $berkasKeadaan) -and -not $Uji) {
  $lama = Get-Content -Raw $berkasKeadaan | ConvertFrom-Json
  if ($lama.terkunci) { Write-Host 'SIPP/ABT lokal sudah terkunci (hanya-baca).'; return }
}

$hostList = @(Jalankan-Sql $penggunaAsli "SELECT Host FROM mysql.user WHERE User='root';" -Baca)
if ($hostList.Count -eq 0) { throw 'Akun root tidak ditemukan di MySQL.' }

# 1. Simpan hak asli UTUH (sebelum apa pun diubah).
$grantsAsli = ''
$grantsPenuh = ''
foreach ($h in $hostList) {
  $baris = @(Jalankan-Sql $penggunaAsli "SHOW GRANTS FOR 'root'@'$(Kutip $h)';" -Baca)
  foreach ($g in $baris) {
    $grantsAsli += $g.TrimEnd(';') + ";`n"
    $grantsPenuh += ($g.Replace("'root'@'$h'", "'$AKUN_PENUH'@'$h'")).TrimEnd(';') + ";`n"
  }
}
if (-not $grantsAsli) { throw 'SHOW GRANTS root kosong - dibatalkan.' }
if (-not $Uji) {
  Set-Content -Path $berkasGrants -Value $grantsAsli -Encoding UTF8
  (@{ terkunci = $false; host = $hostList; waktu = (Get-Date).ToString('s') } | ConvertTo-Json) | Set-Content -Path $berkasKeadaan -Encoding UTF8
}

# 2. Akun penuh dengan hak dan hash sandi yang sama; coba masuk SEBELUM root disentuh.
Write-Host "Membuat akun $AKUN_PENUH (hak dan sandi sama dengan root) ..."
Jalankan-Sql $penggunaAsli ($grantsPenuh + "FLUSH PRIVILEGES;`n") | Out-Null
if (-not $Uji) {
  try { Jalankan-Sql $AKUN_PENUH 'SELECT 1;' -Baca | Out-Null }
  catch {
    Remove-Item -Force $berkasKeadaan -ErrorAction SilentlyContinue
    throw "Akun $AKUN_PENUH tidak dapat masuk; root TIDAK diubah. $($_.Exception.Message)"
  }
}

# 3. Lewat akun penuh: root -> SELECT saja.
$sql = ''
foreach ($h in $hostList) {
  $sql += "REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'root'@'$(Kutip $h)';`n"
  foreach ($db in $DB_BACA) { $sql += "GRANT SELECT ON ``$db``.* TO 'root'@'$(Kutip $h)';`n" }
}
$sql += "FLUSH PRIVILEGES;`n"
Write-Host 'Mengunci root menjadi SELECT-saja pada sipp_donggala, aps_badilag, sipp_turunan_antrian ...'
Jalankan-Sql $AKUN_PENUH $sql | Out-Null
if (-not $Uji) {
  (@{ terkunci = $true; host = $hostList; waktu = (Get-Date).ToString('s') } | ConvertTo-Json) | Set-Content -Path $berkasKeadaan -Encoding UTF8
}
Write-Host "SIPP/ABT lokal HANYA-BACA. ALETA kembaran harus memakai akun $AKUN_PENUH (nyalakan.ps1 mengaturnya)."
