#!/bin/bash
# ============================================================================
# PEMBARU OTOMATIS EKSTENSI ALETA - macOS  (pembantu lokal / native messaging host)
# ============================================================================
#
# Padanan pembaru-aleta.ps1 (Windows). Dipasang SEKALI per komputer oleh
# pasang-pembaru-aleta.command, tanpa sudo, di
# ~/Library/Application Support/ALETA/pembaru. Chrome (atau Edge/Brave/Chromium)
# menjalankannya hanya ketika ekstensi ALETA memintanya (connectNative).
#
# Kenapa ada: ekstensi yang dimuat sebagai folder (Load unpacked) tidak dapat
# menimpa berkasnya sendiri. Pembantu ini mengunduh LANGSUNG dari server,
# memeriksa sidiknya, lalu menyalin ke folder ekstensi - tanpa unduhan
# peramban dan tanpa menanyai petugas.
#
# Batas keamanan (semuanya diperiksa di sini, bukan hanya di ekstensi):
#   - hanya mengunduh dari asal server yang tertulis di asal.txt;
#   - sidik SHA-256 paket harus sama dengan yang dikirim ekstensi;
#   - isi ZIP hanya diekstrak ke folder sementara di samping folder ekstensi
#     (nama aman, jenis berkas dibatasi, tanpa tautan simbolik), TIDAK ADA
#     berkas yang dijalankan;
#   - hanya menyentuh folder ekstensi yang terdaftar dan manifest-nya bernama
#     "ALETA E-Court"; tidak menyentuh profil peramban maupun setelan petugas;
#   - tidak menyimpan sandi apa pun.
#
# Protokol: pesan JSON berbingkai (4 bita panjang little-endian + UTF-8), satu
# jawaban akhir per perintah ("selesai": true). Perintah: ping, siapkan, pasang,
# pulihkan, perangkat (BACA SAJA). Sama dengan pembantu Windows.
#
# Berkas ini sengaja ASCII saja dan hanya memakai alat bawaan macOS (bash 3.2,
# curl, unzip, shasum, sed, awk). Tanpa Python dan tanpa Homebrew.

export LC_ALL=C
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

VERSI_PEMBANTU=1
NAMA_MANIFEST='ALETA E-Court'
MAKS_PAKET=67108864
MAKS_ISI=167772160
MAKS_BERKAS=1500
MAKS_PESAN=65536
JENIS_BOLEH=' js css html json png md txt ps1 cmd '

RUMAH=$(cd "$(dirname "$0")" 2>/dev/null && pwd -P)
[ -n "$RUMAH" ] || RUMAH=$(pwd -P)

# ---------------------------------------------------------------------------
# Catatan kerja (berkas log kecil di samping skrip)
# ---------------------------------------------------------------------------
catat() {
  local log="$RUMAH/pembaru.log"
  {
    if [ -f "$log" ] && [ "$(wc -c < "$log" | tr -d ' ')" -gt 204800 ]; then rm -f "$log"; fi
    printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" >> "$log"
  } 2>/dev/null
  return 0
}

ringkas() {
  printf '%s' "$1" | tr '\r\n' '  ' | cut -c1-240
}

# Menyiapkan teks untuk dimasukkan ke string JSON.
jesc() {
  local r
  r=$(printf '%s' "$1" | tr '\n\r\t' '   ' | tr -d '\000-\037' | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')
  printf '%s' "$r"
}

# ---------------------------------------------------------------------------
# Bingkai pesan Chrome
# ---------------------------------------------------------------------------
kirim() {
  local j="$1" n b0 b1 b2 b3
  n=$(printf '%s' "$j" | wc -c | tr -d ' ')
  b0=$((n & 255))
  b1=$(((n >> 8) & 255))
  b2=$(((n >> 16) & 255))
  b3=$(((n >> 24) & 255))
  printf "$(printf '\\%03o\\%03o\\%03o\\%03o' "$b0" "$b1" "$b2" "$b3")"
  printf '%s' "$j"
}

# Pulang 0 = ada pesan di $PESAN, 1 = pipa ditutup, 2 = pesan terlalu besar.
baca_pesan() {
  local kepala n
  PESAN=''
  kepala=$(dd bs=1 count=4 2>/dev/null | od -An -tu1 | tr -s ' \n' '  ')
  set -- $kepala
  [ "$#" -ge 4 ] || return 1
  n=$(($1 + $2 * 256 + $3 * 65536 + $4 * 16777216))
  if [ "$n" -gt "$MAKS_PESAN" ]; then return 2; fi
  if [ "$n" -gt 0 ]; then
    PESAN=$(dd bs=1 count="$n" 2>/dev/null)
  fi
  return 0
}

# Ruas bernilai teks atau bilangan bulat dari pesan datar. Nilai diperiksa ketat
# oleh pemanggil, jadi pembacaan ini sengaja sederhana.
ambil_ruas() {
  printf '%s' "$1" | tr '\n\r' '  ' | sed -nE "s/.*\"$2\"[[:space:]]*:[[:space:]]*(\"([^\"]*)\"|(-?[0-9]+)).*/\\2\\3/p" | head -n 1
}

galat() {
  printf '{"ok":false,"galat":"%s","pesan":"%s"}' "$1" "$(jesc "$2")"
}

# Galat yang menghentikan perintah (dipakai di dalam $( ) per perintah).
henti_galat() {
  galat "$1" "$2"
  exit 0
}

# ---------------------------------------------------------------------------
# Konfigurasi dan pemeriksaan folder
# ---------------------------------------------------------------------------
baca_satu() {
  local v
  v=$(head -n 1 "$RUMAH/$1" 2>/dev/null)
  while [ "${#v}" -gt 1 ] && [ "${v%/}" != "$v" ]; do v=${v%/}; done
  printf '%s' "$v"
}

# Nilai ruas teks pertama pada manifest.json ($1 berkas, $2 nama ruas).
ruas_manifest() {
  tr '\n\r' '  ' < "$1" 2>/dev/null | grep -oE "\"$2\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -n 1 | sed -E 's/^[^:]*:[[:space:]]*"(.*)"$/\1/'
}

# Folder ekstensi yang sah: ada, manifest-nya bernama ALETA E-Court, ada latar.js
# dan popup.html. Mencetak sebab bila tidak sah, kosong bila sah.
periksa_folder() {
  local f="$1" kosong
  if [ -z "$f" ]; then echo 'folder belum dicatat'; return 0; fi
  case "$f" in
    /*) ;;
    *) echo 'alamat folder tidak sah'; return 0 ;;
  esac
  if printf '%s' "$f" | grep -Eq '(^|/)\.{1,2}(/|$)'; then echo 'alamat folder tidak sah'; return 0; fi
  kosong=$(printf '%s' "$f" | tr -cd '/' | wc -c | tr -d ' ')
  if [ "$f" = "/" ] || [ "$f" = "$HOME" ] || [ "$kosong" -lt 2 ]; then echo 'folder terlalu tinggi (bukan folder ekstensi)'; return 0; fi
  if [ ! -d "$f" ]; then echo 'folder tidak ditemukan (dipindah atau dihapus)'; return 0; fi
  if [ ! -f "$f/manifest.json" ]; then echo 'manifest.json tidak terbaca'; return 0; fi
  if [ "$(ruas_manifest "$f/manifest.json" name)" != "$NAMA_MANIFEST" ]; then echo 'folder ini bukan ekstensi ALETA E-Court'; return 0; fi
  if [ ! -f "$f/latar.js" ]; then echo 'latar.js tidak ada di folder'; return 0; fi
  return 0
}

asal_diizinkan() {
  local a x
  a=$(printf '%s' "$1" | tr 'A-Z' 'a-z' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's:/*$::')
  [ -n "$a" ] || return 1
  [ -f "$RUMAH/asal.txt" ] || return 1
  while IFS= read -r x; do
    x=$(printf '%s' "$x" | tr 'A-Z' 'a-z' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's:/*$::')
    if [ -n "$x" ] && [ "$x" = "$a" ]; then return 0; fi
  done < "$RUMAH/asal.txt"
  return 1
}

versi_sah() { printf '%s' "$1" | grep -Eq '^[0-9]{1,4}(\.[0-9]{1,5}){1,3}$'; }
sidik_sah() { printf '%s' "$1" | grep -Eq '^[0-9a-f]{64}$'; }

sidik_berkas() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | cut -d' ' -f1
  else
    sha256sum "$1" | cut -d' ' -f1
  fi
}

ukuran_berkas() { wc -c < "$1" | tr -d ' '; }

# ---------------------------------------------------------------------------
# Kunci agar dua pembaruan tidak berjalan bersamaan (pengganti Mutex Windows)
# ---------------------------------------------------------------------------
ambil_kunci() {
  local k="$RUMAH/kunci.d" p
  if mkdir "$k" 2>/dev/null; then echo "$$" > "$k/pid"; return 0; fi
  p=$(cat "$k/pid" 2>/dev/null)
  if [ -n "$p" ] && ! kill -0 "$p" 2>/dev/null; then
    rm -rf "$k"
    if mkdir "$k" 2>/dev/null; then echo "$$" > "$k/pid"; return 0; fi
  fi
  return 1
}
lepas_kunci() { rm -rf "$RUMAH/kunci.d" 2>/dev/null; }

# ---------------------------------------------------------------------------
# Ekstrak ZIP dengan aman
# ---------------------------------------------------------------------------
nama_aman() {
  local rel="$1"
  [ -n "$rel" ] || return 1
  printf '%s' "$rel" | grep -Eq '^[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*/?$' || return 1
  if printf '%s' "$rel" | grep -Eq '(^|/)\.{1,2}(/|$)'; then return 1; fi
  return 0
}

# Memeriksa daftar isi ZIP SEBELUM mengekstrak. Mengisi AWALAN_ZIP dan GALAT_ZIP.
periksa_zip() {
  local zip="$1" daftar jml=0 nama rel ext pertama kandidat total
  AWALAN_ZIP=''
  GALAT_ZIP=''
  daftar=$(unzip -Z1 "$zip" 2>/dev/null) || { GALAT_ZIP='berkas paket bukan ZIP yang sah'; return 1; }
  [ -n "$daftar" ] || { GALAT_ZIP='paket kosong'; return 1; }
  if ! printf '%s\n' "$daftar" | grep -qxF 'manifest.json'; then
    pertama=$(printf '%s\n' "$daftar" | head -n 1)
    case "$pertama" in
      */*)
        kandidat=${pertama%%/*}/
        if printf '%s\n' "$daftar" | grep -qxF "${kandidat}manifest.json"; then AWALAN_ZIP=$kandidat; fi
        ;;
    esac
  fi
  while IFS= read -r nama; do
    [ -n "$nama" ] || continue
    jml=$((jml + 1))
    rel=$nama
    if [ -n "$AWALAN_ZIP" ]; then
      case "$rel" in
        "$AWALAN_ZIP"*) rel=${rel#"$AWALAN_ZIP"} ;;
        *) GALAT_ZIP="berkas di luar folder paket: $nama"; return 1 ;;
      esac
      [ -n "$rel" ] || continue
    fi
    if ! nama_aman "$rel"; then GALAT_ZIP="nama berkas tidak aman: $rel"; return 1; fi
    case "$rel" in */) continue ;; esac
    case "$rel" in
      *.*) ext=$(printf '%s' "${rel##*.}" | tr 'A-Z' 'a-z') ;;
      *) ext='' ;;
    esac
    case "$JENIS_BOLEH" in
      *" $ext "*) [ -n "$ext" ] || { GALAT_ZIP="jenis berkas tidak diizinkan: $rel"; return 1; } ;;
      *) GALAT_ZIP="jenis berkas tidak diizinkan: $rel"; return 1 ;;
    esac
  done <<< "$daftar"
  if [ "$jml" -gt "$MAKS_BERKAS" ]; then GALAT_ZIP='terlalu banyak berkas di paket'; return 1; fi
  total=$(unzip -l "$zip" 2>/dev/null | tail -n 1 | awk '{print $1}')
  case "$total" in
    ''|*[!0-9]*) GALAT_ZIP='ukuran isi paket tidak terbaca'; return 1 ;;
  esac
  if [ "$total" -gt "$MAKS_ISI" ]; then GALAT_ZIP='isi paket terlalu besar'; return 1; fi
  return 0
}

# Mengekstrak ZIP yang sudah lolos periksa_zip ke $2 (dibuat baru).
ekstrak_aman() {
  local zip="$1" tujuan="$2" sementara="$2.unzip" asing
  rm -rf "$tujuan" "$sementara"
  mkdir -p "$sementara" || { GALAT_ZIP='folder sementara tidak dapat dibuat'; return 1; }
  if ! unzip -q -o "$zip" -d "$sementara" >/dev/null 2>&1; then
    rm -rf "$sementara"
    GALAT_ZIP='ZIP tidak dapat diekstrak'
    return 1
  fi
  asing=$(find "$sementara" ! -type f ! -type d 2>/dev/null | head -n 1)
  if [ -n "$asing" ]; then
    rm -rf "$sementara"
    GALAT_ZIP='paket memuat tautan atau berkas khusus - ditolak'
    return 1
  fi
  if [ -n "$AWALAN_ZIP" ]; then
    mv "${sementara}/${AWALAN_ZIP%/}" "$tujuan" || { rm -rf "$sementara"; GALAT_ZIP='folder paket tidak dapat dipindah'; return 1; }
    rm -rf "$sementara"
  else
    mv "$sementara" "$tujuan" || { rm -rf "$sementara"; GALAT_ZIP='folder paket tidak dapat dipindah'; return 1; }
  fi
  chmod -R u+rwX "$tujuan" 2>/dev/null
  return 0
}

# ---------------------------------------------------------------------------
# Kebijakan "key" manifest: ID ekstensi TIDAK BOLEH berubah
# ---------------------------------------------------------------------------
# Folder yang dimuat tanpa "key" mendapat ID dari alamat foldernya; bila manifest
# baru membawa "key", ID-nya berganti dan SEMUA setelan petugas (chrome.storage)
# hilang. Maka: bentuk manifest baru disamakan dengan yang terpasang.
ada_kunci() { tr '\n\r' '  ' < "$1" | grep -Eq '"key"[[:space:]]*:[[:space:]]*"'; }
ambil_kunci() {
  tr '\n\r' '  ' < "$1" | grep -oE '"key"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n 1 | sed -E 's/^[^:]*:[[:space:]]*"(.*)"$/\1/'
}
buang_kunci() {
  local t
  t=$(tr '\n\r' '  ' < "$1")
  if printf '%s' "$t" | grep -Eq ',[[:space:]]*"key"[[:space:]]*:[[:space:]]*"[^"]*"'; then
    t=$(printf '%s' "$t" | sed -E 's/,[[:space:]]*"key"[[:space:]]*:[[:space:]]*"[^"]*"//')
  else
    t=$(printf '%s' "$t" | sed -E 's/"key"[[:space:]]*:[[:space:]]*"[^"]*"[[:space:]]*,[[:space:]]*//')
  fi
  printf '%s\n' "$t" > "$1"
}
pasang_kunci() {
  local t
  t=$(cat "$1")
  case "$t" in *\}*) ;; *) return 1 ;; esac
  t=${t%\}*}
  while [ -n "$t" ] && [ "${t%[[:space:]]}" != "$t" ]; do t=${t%[[:space:]]}; done
  printf '%s,\n  "key": "%s"\n}\n' "$t" "$2" > "$1"
}

# Pulang 0 bila selaras; mencetak sebab bila gagal.
selaraskan_manifest() {
  local mL="$1/manifest.json" mB="$2/manifest.json" lamaAda=0 baruAda=0 kL kB
  ada_kunci "$mL" && lamaAda=1
  ada_kunci "$mB" && baruAda=1
  if [ "$lamaAda" = 1 ]; then
    kL=$(ambil_kunci "$mL")
    kB=$(ambil_kunci "$mB")
    if [ "$baruAda" = 0 ] || [ "$kB" != "$kL" ]; then
      [ "$baruAda" = 1 ] && buang_kunci "$mB"
      pasang_kunci "$mB" "$kL" || { echo 'manifest tidak sah'; return 1; }
    fi
  elif [ "$baruAda" = 1 ]; then
    buang_kunci "$mB"
  fi
  baruAda=0
  ada_kunci "$mB" && baruAda=1
  if [ "$baruAda" != "$lamaAda" ]; then echo 'kunci manifest tidak dapat diselaraskan'; return 1; fi
  if [ "$lamaAda" = 1 ] && [ "$(ambil_kunci "$mB")" != "$(ambil_kunci "$mL")" ]; then echo 'kunci manifest berbeda dari yang terpasang'; return 1; fi
  case "$(tr -d '[:space:]' < "$mB" | cut -c1)" in
    '{') ;;
    *) echo 'manifest hasil penyelarasan tidak sah'; return 1 ;;
  esac
  return 0
}

# ---------------------------------------------------------------------------
# Perintah
# ---------------------------------------------------------------------------
perintah_ping() {
  local folder sebab='' versiFolder='' ids='' id sah=false
  if [ ! -f "$RUMAH/folder.txt" ]; then
    sebab='konfigurasi tidak ada - jalankan ulang pemasangnya'
  else
    folder=$(baca_satu folder.txt)
    sebab=$(periksa_folder "$folder")
    [ -z "$sebab" ] && versiFolder=$(ruas_manifest "$folder/manifest.json" version)
  fi
  [ -z "$sebab" ] && sah=true
  if [ -f "$RUMAH/id.txt" ]; then
    while IFS= read -r id; do
      [ -n "$id" ] || continue
      ids="${ids:+$ids,}\"$(jesc "$id")\""
    done < "$RUMAH/id.txt"
  fi
  printf '{"ok":true,"versiPembantu":%s,"platform":"mac","folder":"%s","folderSah":%s,"sebab":"%s","versiFolder":"%s","id":[%s],"perintah":["ping","siapkan","pasang","pulihkan","perangkat"]}' \
    "$VERSI_PEMBANTU" "$(jesc "$folder")" "$sah" "$(jesc "$sebab")" "$(jesc "$versiFolder")" "$ids"
}

# perangkat: identitas komputer untuk jejak masuk ALETA. HANYA MEMBACA.
#   namaKomputer  nama host lokal (huruf, angka, titik, minus)
#   mac           MAC adaptor ke gateway utama
#   osRinci       "macOS 14.5 (23F79)"
#   akunWindows   nama akun pengguna (nama ruas dipertahankan: kontrak dengan server;
#                 server membuangnya kecuali saklar Super Admin dinyalakan)
perintah_perangkat() {
  local nama mac='' ifc osr akun sv bv
  nama=$(scutil --get LocalHostName 2>/dev/null)
  [ -n "$nama" ] || nama=$(hostname -s 2>/dev/null)
  nama=$(printf '%s' "$nama" | tr -c 'A-Za-z0-9._-' '-' | cut -c1-63)
  ifc=$(route -n get default 2>/dev/null | awk '/interface:/{print $2; exit}')
  if [ -n "$ifc" ]; then
    mac=$(ifconfig "$ifc" 2>/dev/null | awk '/ether /{print toupper($2); exit}')
  fi
  printf '%s' "$mac" | grep -Eq '^([0-9A-F]{2}:){5}[0-9A-F]{2}$' || mac=''
  sv=$(sw_vers -productVersion 2>/dev/null)
  bv=$(sw_vers -buildVersion 2>/dev/null)
  if [ -n "$sv" ]; then osr="macOS $sv${bv:+ ($bv)}"; else osr=$(uname -sr 2>/dev/null); fi
  osr=$(printf '%s' "$osr" | tr -cd 'A-Za-z0-9 ._()/-')
  akun=$(id -un 2>/dev/null)
  printf '{"ok":true,"namaKomputer":"%s","mac":[%s],"osRinci":"%s","akunWindows":"%s"}' \
    "$(jesc "$nama")" "${mac:+\"$mac\"}" "$(jesc "$osr")" "$(jesc "$akun")"
}

# Unduh langsung (tanpa peramban). Mengisi UKURAN_UNDUH atau GALAT_UNDUH (variabel global:
# dipanggil LANGSUNG, bukan lewat $( ), supaya nilainya sampai ke pemanggil).
unduh_berkas() {
  local alamat="$1" tujuan="$2" maks="$3" kode rc ukuran
  GALAT_UNDUH=''
  UKURAN_UNDUH=0
  kode=$(curl -sS --noproxy '*' --connect-timeout 30 --max-time 220 --max-filesize "$maks" --proto '=http,https' -A 'ALETA-Pembaru/1' -o "$tujuan" -w '%{http_code}' "$alamat" 2>"$RUMAH/.curl.err")
  rc=$?
  if [ "$rc" -ne 0 ]; then
    if [ "$rc" -eq 63 ]; then GALAT_UNDUH='paket terlalu besar'; else GALAT_UNDUH="server tidak terjangkau ($(ringkas "$(cat "$RUMAH/.curl.err" 2>/dev/null)"))"; fi
    rm -f "$tujuan" "$RUMAH/.curl.err"
    return 1
  fi
  rm -f "$RUMAH/.curl.err"
  if [ "$kode" != "200" ]; then
    GALAT_UNDUH="server menjawab $kode"
    rm -f "$tujuan"
    return 1
  fi
  ukuran=$(ukuran_berkas "$tujuan")
  if [ "$ukuran" -gt "$maks" ]; then GALAT_UNDUH='paket terlalu besar'; rm -f "$tujuan"; return 1; fi
  UKURAN_UNDUH=$ukuran
  return 0
}

bisa_buat() {
  rm -rf "$1" 2>/dev/null
  mkdir "$1" 2>/dev/null || return 1
  rmdir "$1" 2>/dev/null || return 1
  return 0
}

perintah_siapkan() {
  local folder sebab asal versi sidik ukuran diunggah hitung tmp zip alamat staging mode mfname mfver wajib salah
  [ -f "$RUMAH/folder.txt" ] || henti_galat 'gagal' 'konfigurasi tidak ada - jalankan ulang pemasangnya'
  folder=$(baca_satu folder.txt)
  sebab=$(periksa_folder "$folder")
  [ -z "$sebab" ] || henti_galat 'folder-tidak-sah' "$sebab"

  asal=$(ambil_ruas "$PESAN" asal)
  versi=$(ambil_ruas "$PESAN" versi)
  sidik=$(ambil_ruas "$PESAN" sha256 | tr 'A-Z' 'a-z')
  ukuran=$(ambil_ruas "$PESAN" ukuran)
  case "$ukuran" in ''|*[!0-9]*) ukuran=0 ;; esac
  asal_diizinkan "$asal" || henti_galat 'asal-ditolak' 'alamat server tidak ada dalam daftar yang diizinkan pembantu'
  versi_sah "$versi" || henti_galat 'versi-tidak-sah' 'nomor versi tidak sah'
  sidik_sah "$sidik" || henti_galat 'sidik-tidak-sah' 'sidik paket tidak sah'

  ambil_kunci || henti_galat 'sibuk' 'pembaruan lain sedang berjalan'
  trap 'lepas_kunci' EXIT

  tmp="$RUMAH/tmp"
  mkdir -p "$tmp"
  rm -rf "$tmp"/* 2>/dev/null
  zip="$tmp/paket-$versi.zip"
  alamat="${asal%/}/api/aleta-ecourt/ekstensi/pembaru/paket?versi=$versi&sha256=$sidik"
  catat "siapkan $versi dari $asal"
  unduh_berkas "$alamat" "$zip" "$MAKS_PAKET" || henti_galat 'gagal' "$GALAT_UNDUH"
  diunggah=$UKURAN_UNDUH
  if [ "$ukuran" -gt 0 ] && [ "$diunggah" -ne "$ukuran" ]; then
    rm -f "$zip"
    henti_galat 'ukuran-beda' "ukuran paket $diunggah bita, seharusnya $ukuran"
  fi
  hitung=$(sidik_berkas "$zip")
  if [ "$hitung" != "$sidik" ]; then
    rm -f "$zip"
    henti_galat 'sidik-beda' 'sidik paket tidak cocok dengan yang diumumkan server - dibatalkan'
  fi

  # Folder sementara DI SAMPING folder ekstensi (satu volume) supaya penukarannya satu langkah.
  staging="${folder}.aleta-baru"
  mode=tukar
  if ! bisa_buat "$staging" || ! bisa_buat "${staging}.unzip"; then
    staging="$tmp/baru"
    mode=salin
  fi
  periksa_zip "$zip" || { rm -f "$zip"; henti_galat 'gagal' "$GALAT_ZIP"; }
  ekstrak_aman "$zip" "$staging" || { rm -f "$zip"; henti_galat 'gagal' "$GALAT_ZIP"; }

  mfname=$(ruas_manifest "$staging/manifest.json" name)
  mfver=$(ruas_manifest "$staging/manifest.json" version)
  [ -n "$mfname" ] || { rm -rf "$staging"; henti_galat 'gagal' 'manifest.json paket tidak terbaca'; }
  [ "$mfname" = "$NAMA_MANIFEST" ] || { rm -rf "$staging"; henti_galat 'gagal' 'paket bukan ekstensi ALETA E-Court'; }
  [ "$mfver" = "$versi" ] || { rm -rf "$staging"; henti_galat 'gagal' "versi di paket $mfver, diminta $versi"; }
  for wajib in latar.js popup.html; do
    [ -f "$staging/$wajib" ] || { rm -rf "$staging"; henti_galat 'gagal' "$wajib tidak ada di paket"; }
  done
  salah=$(selaraskan_manifest "$folder" "$staging") || { rm -rf "$staging"; henti_galat 'gagal' "$salah"; }

  printf '%s\n%s\n%s\n%s\n%s\n' "$versi" "$staging" "$folder" "$mode" "$sidik" > "$RUMAH/tahap.txt"
  rm -f "$zip"
  catat "siap $versi mode $mode"
  printf '{"ok":true,"siap":true,"versi":"%s","mode":"%s"}' "$versi" "$mode"
}

# Dipakai bila folder tidak bisa dipindah: berkas lain dahulu, manifest TERAKHIR.
salin_menimpa() {
  local dari="$1" ke="$2" rel daftar="$RUMAH/tmp/daftar-salin.txt"
  mkdir -p "$RUMAH/tmp"
  (cd "$dari" && find . -type f ! -path './manifest.json' -print) > "$daftar" || return 1
  while IFS= read -r rel; do
    [ -n "$rel" ] || continue
    mkdir -p "$ke/$(dirname "$rel")" || return 1
    cp -f "$dari/$rel" "$ke/$rel" || return 1
  done < "$daftar"
  rm -f "$daftar"
  cp -f "$dari/manifest.json" "$ke/manifest.json" || return 1
  return 0
}

perintah_pasang() {
  local folder sebab versi tv ts tf tm staging lama cara='' mfver
  [ -f "$RUMAH/folder.txt" ] || henti_galat 'gagal' 'konfigurasi tidak ada - jalankan ulang pemasangnya'
  folder=$(baca_satu folder.txt)
  sebab=$(periksa_folder "$folder")
  [ -z "$sebab" ] || henti_galat 'folder-tidak-sah' "$sebab"
  versi=$(ambil_ruas "$PESAN" versi)
  versi_sah "$versi" || henti_galat 'versi-tidak-sah' 'nomor versi tidak sah'
  [ -f "$RUMAH/tahap.txt" ] || henti_galat 'belum-siap' 'paket belum disiapkan'
  tv=$(sed -n '1p' "$RUMAH/tahap.txt")
  ts=$(sed -n '2p' "$RUMAH/tahap.txt")
  tf=$(sed -n '3p' "$RUMAH/tahap.txt")
  tm=$(sed -n '4p' "$RUMAH/tahap.txt")
  [ "$tv" = "$versi" ] || henti_galat 'belum-siap' 'paket yang disiapkan bukan versi ini'
  [ "$tf" = "$folder" ] || henti_galat 'belum-siap' 'folder berubah sejak paket disiapkan'
  staging=$ts
  [ -d "$staging" ] && [ "$(ruas_manifest "$staging/manifest.json" version)" = "$versi" ] || henti_galat 'belum-siap' 'folder sementara tidak utuh'

  ambil_kunci || henti_galat 'sibuk' 'pembaruan lain sedang berjalan'
  trap 'lepas_kunci' EXIT

  lama="${folder}.aleta-lama"
  if [ "$tm" = tukar ]; then
    rm -rf "$lama" 2>/dev/null
    if [ ! -e "$lama" ] && mv "$folder" "$lama" 2>/dev/null; then
      if [ ! -e "$folder" ] && mv "$staging" "$folder" 2>/dev/null; then
        cara=tukar
      else
        mv "$lama" "$folder" 2>/dev/null
        catat 'tukar folder gagal, menyalin'
      fi
    else
      catat 'memindahkan folder lama gagal, menyalin'
    fi
  fi
  if [ -z "$cara" ]; then
    salin_menimpa "$staging" "$folder" || henti_galat 'gagal' 'berkas tidak dapat disalin ke folder ekstensi'
    cara=salin
    rm -rf "$staging" 2>/dev/null
  fi
  rm -f "$RUMAH/tahap.txt"

  mfver=$(ruas_manifest "$folder/manifest.json" version)
  [ "$mfver" = "$versi" ] || henti_galat 'tidak-terverifikasi' 'folder sesudah pemasangan tidak berisi versi yang diminta'
  catat "terpasang $versi cara $cara"
  printf '{"ok":true,"versi":"%s","cara":"%s"}' "$versi" "$cara"
}

perintah_pulihkan() {
  local folder lama sisa
  [ -f "$RUMAH/folder.txt" ] || henti_galat 'gagal' 'konfigurasi tidak ada - jalankan ulang pemasangnya'
  folder=$(baca_satu folder.txt)
  lama="${folder}.aleta-lama"
  [ -d "$lama" ] || henti_galat 'tanpa-cadangan' 'tidak ada salinan versi sebelumnya'
  [ -f "$lama/manifest.json" ] || henti_galat 'tanpa-cadangan' 'salinan sebelumnya tidak utuh'
  sisa="${folder}.aleta-gagal"
  rm -rf "$sisa" 2>/dev/null
  mv "$folder" "$sisa" 2>/dev/null || henti_galat 'gagal' 'folder ekstensi tidak dapat dipindah'
  mv "$lama" "$folder" 2>/dev/null || { mv "$sisa" "$folder" 2>/dev/null; henti_galat 'gagal' 'salinan sebelumnya tidak dapat dikembalikan'; }
  rm -rf "$sisa" 2>/dev/null
  catat 'dipulihkan ke versi sebelumnya'
  printf '{"ok":true,"versi":"%s"}' "$(jesc "$(ruas_manifest "$folder/manifest.json" version)")"
}

tangani() {
  local perintah
  perintah=$(ambil_ruas "$PESAN" perintah)
  case "$perintah" in
    ping) (perintah_ping) </dev/null ;;
    siapkan) (perintah_siapkan) </dev/null ;;
    pasang) (perintah_pasang) </dev/null ;;
    pulihkan) (perintah_pulihkan) </dev/null ;;
    perangkat) (perintah_perangkat) </dev/null ;;
    *) galat 'perintah-tidak-dikenal' 'perintah tidak dikenal' ;;
  esac
}

# ---------------------------------------------------------------------------
# Putaran utama: satu jawaban akhir per pesan sampai peramban menutup pipa
# ---------------------------------------------------------------------------
while :; do
  baca_pesan
  st=$?
  if [ "$st" -eq 2 ]; then catat 'pesan terlalu besar'; break; fi
  [ "$st" -eq 0 ] || break
  jawab=$(tangani 2>/dev/null)
  case "$jawab" in
    '{'*'}') ;;
    *) catat 'perintah tidak menghasilkan jawaban'; jawab=$(galat 'gagal' 'pembantu tidak menghasilkan jawaban') ;;
  esac
  jawab="${jawab%\}},\"selesai\":true}"
  kirim "$jawab"
done
exit 0
