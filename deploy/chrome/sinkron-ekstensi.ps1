# =============================================================================
# ALETA E-Court - menyegarkan folder ekstensi dari portal
# =============================================================================
#
# Chrome MENOLAK memasang ekstensi swa-inang lewat kebijakan di komputer yang
# tidak terdeteksi terkelola perusahaan - dan komputer kantor berjalan sebagai
# WORKGROUP, bukan anggota domain. Jalur kebijakan karena itu buntu.
#
# Yang ditempuh sebagai gantinya: folder ekstensinya disegarkan dari portal,
# dan Chrome memuat isinya yang baru saat dibuka berikutnya. Bukan pembaruan
# seketika, tetapi tidak ada lagi petugas yang menjalankan versi lama berminggu
# tanpa satu pun tanda.
#
# ID ekstensi TIDAK berubah meskipun foldernya berpindah, karena manifest
# membawa kunci publiknya sendiri. Tanpa itu, Chrome mengarang ID dari letak
# folder dan setiap penyegaran akan tampak seperti ekstensi yang lain.
#
# Tidak perlu hak Administrator, tidak perlu akun Google, tidak perlu internet.
#
# Dijalankan berkala oleh Tugas Terjadwal - lihat pasang-sinkron.ps1.
# =============================================================================

# -----------------------------------------------------------------------------
# LETAK FOLDER: DI AKAR PROFIL, BUKAN DI DALAM AppData
# -----------------------------------------------------------------------------
# AppData DIVIRTUALKAN untuk aplikasi berpaket (MSIX/Microsoft Store): tulisan ke
# %LOCALAPPDATA% dialihkan diam-diam ke
# %LOCALAPPDATA%\Packages\<paket>\LocalCache\Local\... Proses yang menulis
# melihatnya seolah berhasil - Explorer dan Chrome tidak melihat apa pun.
#
# Kekeliruan itu sudah terjadi sekali dan gejalanya menyesatkan: catatan
# berbunyi BERHASIL, folder terbaca ada dari skrip, tetapi Chrome tetap tidak
# menemukannya. Akar profil tidak divirtualkan, dan sebagai bonus ia tidak
# tersembunyi sehingga mudah dipilih di dialog "Load unpacked".
param(
  [string]$Portal = "http://192.168.10.10/aleta",
  [string]$Tujuan = "$env:USERPROFILE\ALETA\ekstensi-sipp",
  [switch]$Paksa
)

$ErrorActionPreference = "Stop"
$catatan = "$env:USERPROFILE\ALETA\sinkron-ekstensi.log"

function Tulis($pesan) {
  $baris = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $pesan"
  Write-Output $baris
  try {
    $indukCatatan = Split-Path $catatan -Parent
    if (-not (Test-Path $indukCatatan)) { New-Item -ItemType Directory -Force $indukCatatan | Out-Null }
    Add-Content -Path $catatan -Value $baris -Encoding utf8
  } catch {}
}

try {
  # ---------------------------------------------------------------------------
  # 1. Versi yang disajikan portal
  # ---------------------------------------------------------------------------
  # Dibaca dari updates.xml, bukan dari paketnya - naskah itu hanya ratusan byte
  # sedangkan paketnya seperempat megabita. Komputer yang sudah mutakhir tidak
  # perlu mengunduh apa pun.
  $naskah = (Invoke-WebRequest -Uri "$Portal/api/aleta-ecourt/ekstensi/updates.xml" -UseBasicParsing -TimeoutSec 20).Content
  # Dicari pada elemen updatecheck saja. Pola yang longgar akan menangkap
  # version='1.0' pada deklarasi <?xml ...?> di baris pertama - dan angka itu
  # selamanya berbeda dari versi ekstensi, sehingga paket diunduh ulang terus.
  if ($naskah -notmatch "<updatecheck[^>]*\sversion='([^']+)'") {
    Tulis "GAGAL: updates.xml tidak memuat nomor versi. Portal mungkin sedang dibangun ulang."
    exit 1
  }
  $versiPortal = $matches[1]

  # ---------------------------------------------------------------------------
  # 2. Versi yang sekarang ada di komputer ini
  # ---------------------------------------------------------------------------
  $versiLokal = ""
  $manifestLokal = Join-Path $Tujuan "manifest.json"
  if (Test-Path $manifestLokal) {
    try { $versiLokal = (Get-Content $manifestLokal -Raw | ConvertFrom-Json).version } catch { $versiLokal = "" }
  }

  if ($versiLokal -eq $versiPortal -and -not $Paksa) {
    Tulis "sudah mutakhir (v$versiLokal)"
    exit 0
  }

  if ($versiLokal -eq "") {
    Tulis "belum ada salinan lokal - memasang v$versiPortal"
  } else {
    Tulis "v$versiLokal -> v$versiPortal, mengunduh"
  }

  # ---------------------------------------------------------------------------
  # 3. Unduh paket dan bongkar isinya
  # ---------------------------------------------------------------------------
  # Yang diunduh berkas .crx, bukan ZIP, karena alamat .crx terbuka TANPA sesi
  # portal - skrip ini tidak perlu menyimpan kredensial siapa pun. Isi .crx
  # adalah ZIP biasa yang didahului kepala bertanda tangan; kepalanya dilewati.
  $kerja = Join-Path $env:TEMP "aleta-sinkron-$([System.Guid]::NewGuid().ToString('N'))"
  New-Item -ItemType Directory -Force $kerja | Out-Null
  try {
    $berkasCrx = Join-Path $kerja "paket.crx"
    Invoke-WebRequest -Uri "$Portal/api/aleta-ecourt/ekstensi/paket.crx" -OutFile $berkasCrx -UseBasicParsing -TimeoutSec 120

    $bita = [System.IO.File]::ReadAllBytes($berkasCrx)
    if ($bita.Length -lt 16) { throw "paket terlalu kecil ($($bita.Length) byte)" }
    $penanda = [System.Text.Encoding]::ASCII.GetString($bita, 0, 4)
    if ($penanda -ne "Cr24") { throw "bukan berkas .crx (penanda '$penanda')" }

    $panjangKepala = [BitConverter]::ToUInt32($bita, 8)
    $mulai = 12 + $panjangKepala
    if ($mulai -ge $bita.Length) { throw "kepala .crx tidak masuk akal ($panjangKepala byte)" }

    $berkasZip = Join-Path $kerja "isi.zip"
    [System.IO.File]::WriteAllBytes($berkasZip, $bita[$mulai..($bita.Length - 1)])

    $bongkar = Join-Path $kerja "isi"
    Expand-Archive -LiteralPath $berkasZip -DestinationPath $bongkar -Force

    # -------------------------------------------------------------------------
    # 4. Periksa sebelum dipasang
    # -------------------------------------------------------------------------
    # Folder yang ditimpa dengan isi rusak membuat ekstensinya HILANG dari
    # Chrome, dan gejalanya tampak seperti kerusakan portal. Lebih baik gagal di
    # sini dan meninggalkan salinan lama yang masih bekerja.
    $manifestBaru = Join-Path $bongkar "manifest.json"
    if (-not (Test-Path $manifestBaru)) { throw "manifest.json tidak ada di dalam paket" }
    $m = Get-Content $manifestBaru -Raw | ConvertFrom-Json
    if ($m.version -ne $versiPortal) { throw "versi paket ($($m.version)) tidak sama dengan updates.xml ($versiPortal)" }
    if (-not $m.key) { throw "manifest tanpa ruas key - ID ekstensi akan berubah" }
    if (-not (Test-Path (Join-Path $bongkar "konten.js"))) { throw "konten.js tidak ada di dalam paket" }

    # -------------------------------------------------------------------------
    # 5. Pasang
    # -------------------------------------------------------------------------
    # -------------------------------------------------------------------------
    # DISALIN APA ADANYA, TANPA MENEBAK MANA YANG BERUBAH
    # -------------------------------------------------------------------------
    # Sebelumnya bagian ini memakai robocopy /MIR. Robocopy memutuskan sendiri
    # berkas mana yang "sudah sama" dari ukuran dan cap waktunya - dan justru
    # manifest.json selalu lolos saringan itu: cap waktunya tetap karena
    # berasal dari zip yang dibangun ulang secara pasti, dan "1.62.0" menjadi
    # "1.63.0" tidak mengubah jumlah hurufnya sedikit pun. Bendera /IS yang
    # seharusnya memaksa penyalinan pun tidak menolong; robocopy tetap menjawab
    # "sudah sinkron" dan tidak menyalin apa-apa.
    #
    # Akibatnya yang paling berbahaya BUKAN gagal seluruhnya, melainkan berhasil
    # SEBAGIAN: konten.js versi baru berjalan di atas manifest versi lama - izin
    # dan daftar berkas yang tidak lagi cocok dengan kodenya.
    #
    # Karena itu penyalinannya dikerjakan sendiri: semua ditimpa tanpa syarat,
    # dan yang sudah tidak ada di paket dihapus.
    if (-not (Test-Path $Tujuan)) { New-Item -ItemType Directory -Force $Tujuan | Out-Null }

    $panjangSumber = $bongkar.TrimEnd([char]92).Length + 1
    $panjangTujuan = $Tujuan.TrimEnd([char]92).Length + 1

    $isiPaket = @{}
    foreach ($berkas in Get-ChildItem $bongkar -Recurse -File) {
      $isiPaket[$berkas.FullName.Substring($panjangSumber)] = $true
    }

    # Yang sudah tidak ada lagi di paket dibuang lebih dulu. Berkas tertinggal
    # dari versi lama tetap dibaca Chrome bila manifest masih menyebutnya.
    foreach ($berkas in Get-ChildItem $Tujuan -Recurse -File) {
      $relatif = $berkas.FullName.Substring($panjangTujuan)
      if (-not $isiPaket.ContainsKey($relatif)) {
        Remove-Item -LiteralPath $berkas.FullName -Force -ErrorAction SilentlyContinue
      }
    }

    $gagalSalin = @()
    foreach ($relatif in $isiPaket.Keys) {
      $dari = Join-Path $bongkar $relatif
      $ke = Join-Path $Tujuan $relatif
      $induk = Split-Path $ke -Parent
      if (-not (Test-Path $induk)) { New-Item -ItemType Directory -Force $induk | Out-Null }
      try {
        Copy-Item -LiteralPath $dari -Destination $ke -Force -ErrorAction Stop
      } catch {
        $gagalSalin += "$relatif ($($_.Exception.Message))"
      }
    }

    if ($gagalSalin.Count -gt 0) {
      Tulis "GAGAL menyalin: $($gagalSalin -join '; ')"
      Tulis "Tutup Chrome sampai benar-benar keluar lalu jalankan lagi."
      exit 1
    }

    # Versi yang BENAR-BENAR mendarat, dibaca ulang dari disk.
    #
    # Melaporkan BERHASIL dari kode keluaran penyalin saja sudah pernah keliru
    # sekali: robocopy menjawab 0 sementara manifest tidak tersalin sama sekali.
    # Yang membuktikan penyegaran berhasil adalah isi berkasnya, bukan kata
    # program yang menyalinnya.
    $terpasang = ""
    try { $terpasang = (Get-Content (Join-Path $Tujuan "manifest.json") -Raw | ConvertFrom-Json).version } catch {}
    if ($terpasang -ne $versiPortal) {
      Tulis "GAGAL: sesudah disalin, versi terpasang masih '$terpasang' padahal seharusnya '$versiPortal'."
      Tulis "Tutup Chrome sampai benar-benar keluar lalu jalankan lagi."
      exit 1
    }

    $bukti = Get-Item (Join-Path $Tujuan "manifest.json")
    if ($bukti.Target) {
      Tulis "GAGAL: tulisan dialihkan ke $($bukti.Target)"
      Tulis "Jalankan skrip ini dari PowerShell biasa, bukan dari dalam aplikasi berpaket."
      exit 1
    }

    Tulis "BERHASIL dipasang v$versiPortal di $Tujuan"
    Tulis "Tutup Chrome sampai keluar lalu buka lagi supaya versi baru dipakai."
    exit 0
  } finally {
    Remove-Item -LiteralPath $kerja -Recurse -Force -ErrorAction SilentlyContinue
  }
} catch {
  Tulis "GAGAL: $($_.Exception.Message)"
  exit 1
}
