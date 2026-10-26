#!/bin/bash
# ===========================================================================
#  PEMASANG PEMBARU OTOMATIS ALETA - macOS. Cukup SEKALI per komputer, tanpa sudo.
#
#  Cara membuka (macOS menahan berkas unduhan sampai Anda mengizinkannya):
#    - Paling pasti: buka Terminal, ketik  bash  lalu spasi, seret berkas ini ke
#      jendela Terminal, tekan Enter. Cara ini tidak ditahan Gatekeeper dan tidak
#      memerlukan izin eksekusi.
#    - Atau klik kanan berkas ini > Buka (bukan klik dua kali), lalu pilih Buka
#      pada peringatan "pengembang tidak dikenal".
#    - Bila muncul "tidak punya izin": di Terminal ketik
#         chmod +x ~/Downloads/pasang-pembaru-aleta.command
#      dan hapus tanda unduhan dengan
#         xattr -d com.apple.quarantine ~/Downloads/pasang-pembaru-aleta.command
#
#  Untuk mencabut: jalankan dengan argumen  --cabut
#
#  Hanya menulis ke  ~/Library/Application Support/ALETA/pembaru  dan satu berkas
#  daftar pembantu di folder NativeMessagingHosts milik pengguna ini. Tidak
#  menyentuh profil peramban maupun setelan ALETA. Tidak menyimpan sandi apa pun.
# ===========================================================================

export LC_ALL=C
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

NAMA_HOST='id.aleta.pembaru'
NAMA_MANIFEST='ALETA E-Court'
ID_DIMINTA='@@ID_DIMINTA@@'
ASAL_PORTAL='@@ASAL_PORTAL@@'

# Isi pembantu (pembaru-aleta.sh) tertanam di sini oleh server; dijalankan dari folder
# ekstensi, bagian ini tidak terganti dan pembantu dibaca dari berkas di sampingnya.
tulis_host() {
cat <<'ALETA_AKHIR_HOST'
@@HOST_SH@@
ALETA_AKHIR_HOST
}

ASAL_BAWAAN='http://192.168.10.10/aleta
http://192.168.10.10:8008/aleta'
DASAR="$HOME/Library/Application Support"
RUMAH="${ALETA_PEMBARU_RUMAH:-$DASAR/ALETA/pembaru}"
TAB=$(printf '\t')
BARU='
'

CABUT=0
for a in "$@"; do
  case "$a" in
    --cabut|-cabut|/cabut|cabut) CABUT=1 ;;
  esac
done
case "$ID_DIMINTA" in @@*) ID_DIMINTA='' ;; esac
case "$ASAL_PORTAL" in @@*) ASAL_PORTAL='' ;; esac

tulis() { printf '%s\n' "$1"; }

jeda_tutup() {
  if [ -t 0 ]; then
    printf '\n'
    read -r -p 'Tekan Enter untuk menutup jendela ini. ' _ || true
  fi
}

selesai_dengan() {
  jeda_tutup
  exit "$1"
}

if [ "$(uname -s)" != "Darwin" ] && [ "$ALETA_PEMBARU_PAKSA_OS" != "1" ]; then
  tulis 'Pemasang ini khusus untuk macOS. Di Windows pakai pasang-pembaru-aleta.cmd.'
  tulis 'Linux belum didukung.'
  selesai_dengan 1
fi

# Peramban berbasis Chromium yang dikenali: "Nama|folder data pengguna".
daftar_peramban() {
  if [ -n "$ALETA_PEMBARU_PROFIL" ]; then
    printf 'Chrome|%s\n' "$ALETA_PEMBARU_PROFIL"
    return 0
  fi
  printf 'Chrome|%s\n' "$DASAR/Google/Chrome"
  printf 'Edge|%s\n' "$DASAR/Microsoft Edge"
  printf 'Brave|%s\n' "$DASAR/BraveSoftware/Brave-Browser"
  printf 'Chromium|%s\n' "$DASAR/Chromium"
}

# ---------------------------------------------------------------------------
# Mencabut
# ---------------------------------------------------------------------------
if [ "$CABUT" = 1 ]; then
  daftar_peramban | while IFS='|' read -r nama akar; do
    rm -f "$akar/NativeMessagingHosts/$NAMA_HOST.json" 2>/dev/null
  done
  if [ -n "$RUMAH" ] && [ "$RUMAH" != "/" ] && [ "$RUMAH" != "$HOME" ] && [ -d "$RUMAH" ]; then
    rm -rf "$RUMAH"
    rmdir "$(dirname "$RUMAH")" 2>/dev/null
  fi
  tulis 'Pembaru otomatis ALETA sudah dicabut. Ekstensi dan setelannya tidak berubah.'
  selesai_dengan 0
fi

# ---------------------------------------------------------------------------
# 1. Cari ekstensi ALETA yang dimuat sebagai folder (hanya MEMBACA setelan peramban)
# ---------------------------------------------------------------------------
JS_CARI='ObjC.import("Foundation");
function baca(p) {
  var s = $.NSString.stringWithContentsOfFileEncodingError($(p), $.NSUTF8StringEncoding, $());
  return s ? ObjC.unwrap(s) : "";
}
function run(a) {
  var hasil = [];
  try {
    var o = JSON.parse(baca(a[0]));
    var st = o && o.extensions && o.extensions.settings;
    if (st && typeof st === "object") {
      Object.keys(st).forEach(function (id) {
        try {
          var e = st[id];
          if (!e || typeof e.path !== "string" || e.path.charAt(0) !== "/") return;
          var m = JSON.parse(baca(e.path + "/manifest.json"));
          if (m && m.name === a[1]) hasil.push(id + "\t" + e.path);
        } catch (x) {}
      });
    }
  } catch (x) {}
  return "[[ALETA-MULAI]]" + hasil.join("\n") + "[[ALETA-AKHIR]]";
}'

sidik_aliran() {
  if command -v shasum >/dev/null 2>&1; then shasum -a 256 | cut -d' ' -f1; else sha256sum | cut -d' ' -f1; fi
}

ruas_manifest() {
  tr '\n\r' '  ' < "$1" 2>/dev/null | grep -oE "\"$2\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -n 1 | sed -E 's/^[^:]*:[[:space:]]*"(.*)"$/\1/'
}

# ID ekstensi yang dimuat sebagai folder: dari "key" manifest bila ada, selain itu dari alamat folder.
# Dipakai hanya bila osascript tidak memberi ID pasti; ID yang diminta ekstensi sendiri ditambahkan juga.
id_dari_folder() {
  local folder="$1" kunci hex
  kunci=$(ruas_manifest "$folder/manifest.json" key)
  if [ -n "$kunci" ]; then
    hex=$(printf '%s' "$kunci" | (base64 -D 2>/dev/null || base64 -d 2>/dev/null) | sidik_aliran | cut -c1-32)
  else
    hex=$(printf '%s' "$folder" | sidik_aliran | cut -c1-32)
  fi
  printf '%s' "$hex" | tr '0-9a-f' 'a-p'
}

TEMUAN=''
tambah_temuan() {
  local nama="$1" id="$2" folder="$3"
  printf '%s' "$id" | grep -Eq '^[a-p]{32}$' || return 0
  case "$folder" in /*) ;; *) return 0 ;; esac
  case "$TEMUAN" in *"$TAB$id$TAB$folder$BARU"*) return 0 ;; esac
  TEMUAN="${TEMUAN}${nama}${TAB}${id}${TAB}${folder}${BARU}"
}

cari_di_berkas() {
  local nama="$1" berkas="$2" keluar baris id folder daftar ultimo
  if command -v osascript >/dev/null 2>&1; then
    keluar=$(osascript -l JavaScript -e "$JS_CARI" "$berkas" "$NAMA_MANIFEST" 2>&1)
    case "$keluar" in
      *'[[ALETA-MULAI]]'*)
        keluar=$(printf '%s' "$keluar" | tr '\n' '\001' | sed -e 's/.*\[\[ALETA-MULAI\]\]//' -e 's/\[\[ALETA-AKHIR\]\].*//' | tr '\001' '\n')
        while IFS= read -r baris; do
          [ -n "$baris" ] || continue
          id=${baris%%"$TAB"*}
          folder=${baris#*"$TAB"}
          tambah_temuan "$nama" "$id" "$folder"
        done <<< "$keluar"
        ;;
    esac
  fi
  # Cadangan tanpa osascript (atau bila ia tidak menjawab): baca pasangan "ID ekstensi" dan "path"
  # dari teks setelan, lalu cocokkan lewat manifest foldernya. Hanya untuk folder yang belum
  # ditemukan dengan ID pasti.
  daftar=$(grep -oE '"[a-p]{32}"[[:space:]]*:[[:space:]]*\{|"path"[[:space:]]*:[[:space:]]*"/[^"]*"' "$berkas" 2>/dev/null)
  ultimo=''
  while IFS= read -r baris; do
    case "$baris" in
      '"path"'*)
        folder=$(printf '%s' "$baris" | sed -E 's/^[^:]*:[[:space:]]*"(.*)"$/\1/')
        [ -n "$folder" ] || continue
        case "$folder" in *\\*) continue ;; esac
        [ -f "$folder/manifest.json" ] || continue
        [ "$(ruas_manifest "$folder/manifest.json" name)" = "$NAMA_MANIFEST" ] || continue
        case "$TEMUAN" in *"$TAB$folder$BARU"*) continue ;; esac
        id=$ultimo
        [ -n "$id" ] || id=$(id_dari_folder "$folder")
        tambah_temuan "$nama" "$id" "$folder"
        ;;
      *) ultimo=$(printf '%s' "$baris" | sed -E 's/^"([a-p]{32})".*/\1/') ;;
    esac
  done <<< "$daftar"
}

cari_terpasang() {
  local nama akar profil nama_berkas berkas
  while IFS='|' read -r nama akar; do
    [ -d "$akar" ] || continue
    for profil in "$akar"/Default "$akar"/Profile\ *; do
      [ -d "$profil" ] || continue
      for nama_berkas in 'Secure Preferences' 'Preferences'; do
        berkas="$profil/$nama_berkas"
        [ -f "$berkas" ] || continue
        # Profil tanpa extensions.settings (mis. baru dibuat) dilewati begitu saja: tidak ada yang cocok.
        cari_di_berkas "$nama" "$berkas"
      done
    done
  done <<< "$(daftar_peramban)"
}

tulis ''
tulis 'Pemasang pembaru otomatis ALETA'
tulis '--------------------------------'
cari_terpasang

DAFTAR_FOLDER=$(printf '%s' "$TEMUAN" | awk -F"$TAB" 'NF >= 3 {print $3}' | sort -u)
if [ -n "$ID_DIMINTA" ]; then
  PILIH=$(printf '%s' "$TEMUAN" | awk -F"$TAB" -v id="$ID_DIMINTA" 'NF >= 3 && $2 == id {print $3}' | sort -u)
  [ -n "$PILIH" ] && DAFTAR_FOLDER=$PILIH
fi
JUMLAH=$(printf '%s\n' "$DAFTAR_FOLDER" | grep -c .)
FOLDER=''
if [ "$JUMLAH" -eq 1 ]; then
  FOLDER=$DAFTAR_FOLDER
elif [ "$JUMLAH" -gt 1 ]; then
  tulis 'Ditemukan beberapa salinan ekstensi ALETA:'
  n=0
  while IFS= read -r f; do
    n=$((n + 1))
    tulis "  $n. $f"
  done <<< "$DAFTAR_FOLDER"
  if [ -t 0 ]; then
    read -r -p 'Ketik nomor salinan yang dipakai sehari-hari: ' JAWAB
    case "$JAWAB" in
      ''|*[!0-9]*) ;;
      *) if [ "$JAWAB" -ge 1 ] && [ "$JAWAB" -le "$JUMLAH" ]; then FOLDER=$(printf '%s\n' "$DAFTAR_FOLDER" | sed -n "${JAWAB}p"); fi ;;
    esac
  fi
fi
if [ -z "$FOLDER" ]; then
  if [ "$JUMLAH" -gt 1 ]; then
    tulis 'Pilihan salinan tidak dikenali. Jalankan ulang berkas ini dari Terminal.'
  else
    tulis 'Ekstensi ALETA belum ditemukan di Chrome.'
    tulis 'Muat dulu ekstensinya (chrome://extensions > Developer mode > Load unpacked), lalu jalankan ulang berkas ini.'
  fi
  selesai_dengan 1
fi
IDS=$(printf '%s' "$TEMUAN" | awk -F"$TAB" -v f="$FOLDER" 'NF >= 3 && $3 == f {print $2}' | sort -u)
if [ -n "$ID_DIMINTA" ] && ! printf '%s\n' "$IDS" | grep -qxF "$ID_DIMINTA"; then
  IDS="${IDS}${BARU}${ID_DIMINTA}"
fi
IDS=$(printf '%s\n' "$IDS" | grep -E '^[a-p]{32}$' | sort -u)
tulis "Folder ekstensi : $FOLDER"

# ---------------------------------------------------------------------------
# 2. Tulis pembantu ke rumahnya (hanya milik pengguna ini)
# ---------------------------------------------------------------------------
mkdir -p "$RUMAH" || { tulis "Folder $RUMAH tidak dapat dibuat."; selesai_dengan 2; }
HOST="$RUMAH/pembaru-aleta.sh"
tulis_host > "$HOST.baru"
PERTAMA=$(head -n 1 "$HOST.baru")
case "$PERTAMA" in
  @@*)
    # Dijalankan dari folder ekstensi: pakai berkas di sampingnya.
    SAMPING="$(cd "$(dirname "$0")" && pwd)/pembaru-aleta.sh"
    if [ ! -f "$SAMPING" ]; then
      rm -f "$HOST.baru"
      tulis 'pembaru-aleta.sh tidak ditemukan di samping pemasang. Unduh pemasang dari portal ALETA.'
      selesai_dengan 2
    fi
    cp -f "$SAMPING" "$HOST.baru"
    ;;
esac
tr -d '\r' < "$HOST.baru" > "$HOST"
rm -f "$HOST.baru"
chmod 755 "$HOST"

ASAL_LIST="$ASAL_BAWAAN"
if printf '%s' "$ASAL_PORTAL" | grep -Eq '^http://[A-Za-z0-9.-]+(:[0-9]+)?(/[A-Za-z0-9_-]+)?$'; then
  HOST_PORTAL=${ASAL_PORTAL#http://}
  HOST_PORTAL=${HOST_PORTAL%%/*}
  HOST_PORTAL=${HOST_PORTAL%%:*}
  case "$HOST_PORTAL" in
    192.168.10.10|127.0.0.1) ASAL_LIST="${ASAL_LIST}${BARU}${ASAL_PORTAL%/}" ;;
  esac
fi
ASAL_LIST=$(printf '%s\n' "$ASAL_LIST" | sort -u)

printf '%s\n' "$FOLDER" > "$RUMAH/folder.txt"
printf '%s\n' "$ASAL_LIST" > "$RUMAH/asal.txt"
printf '%s\n' "$IDS" > "$RUMAH/id.txt"

jesc() {
  printf '%s' "$1" | tr '\n\r\t' '   ' | tr -d '\000-\037' | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}
ASAL_JSON=''
while IFS= read -r x; do
  [ -n "$x" ] || continue
  ASAL_JSON="${ASAL_JSON:+$ASAL_JSON, }\"$(jesc "$x")\""
done <<< "$ASAL_LIST"
ID_JSON=''
ORIGINS=''
while IFS= read -r x; do
  [ -n "$x" ] || continue
  ID_JSON="${ID_JSON:+$ID_JSON, }\"$x\""
  ORIGINS="${ORIGINS:+$ORIGINS, }\"chrome-extension://$x/\""
done <<< "$IDS"
printf '{\n  "folder": "%s",\n  "asal": [%s],\n  "id": [%s],\n  "dipasang": "%s"\n}\n' "$(jesc "$FOLDER")" "$ASAL_JSON" "$ID_JSON" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" > "$RUMAH/konfigurasi.json"

# ---------------------------------------------------------------------------
# 3. Daftarkan untuk peramban yang ada (berkas milik pengguna ini, tanpa sudo)
# ---------------------------------------------------------------------------
DIDAFTAR=''
while IFS='|' read -r nama akar; do
  [ -d "$akar" ] || continue
  mkdir -p "$akar/NativeMessagingHosts" || continue
  printf '{\n  "name": "%s",\n  "description": "Pembaru otomatis ekstensi ALETA",\n  "path": "%s",\n  "type": "stdio",\n  "allowed_origins": [%s]\n}\n' \
    "$NAMA_HOST" "$(jesc "$HOST")" "$ORIGINS" > "$akar/NativeMessagingHosts/$NAMA_HOST.json"
  DIDAFTAR="${DIDAFTAR:+$DIDAFTAR, }$nama"
done <<< "$(daftar_peramban)"

# Berkas yang ditulis pemasang ini bukan unduhan: buang tanda karantina bila ada.
if command -v xattr >/dev/null 2>&1; then
  for b in "$HOST" "$RUMAH/folder.txt" "$RUMAH/asal.txt" "$RUMAH/id.txt" "$RUMAH/konfigurasi.json"; do
    xattr -d com.apple.quarantine "$b" >/dev/null 2>&1 || true
  done
fi

if [ -z "$DIDAFTAR" ]; then
  tulis 'Pembantu terpasang tetapi tidak ada peramban Chrome/Edge/Brave/Chromium yang ditemukan. Hubungi pengelola ALETA.'
  selesai_dengan 2
fi
tulis "Didaftarkan di   : $DIDAFTAR"

# ---------------------------------------------------------------------------
# 4. Uji sendiri lewat berkas yang sama dengan yang dijalankan peramban
# ---------------------------------------------------------------------------
UJI=$(printf '\023\000\000\000{"perintah":"ping"}' | "$HOST" 2>/dev/null | tail -c +5)
case "$UJI" in
  *'"ok":true'*'"folderSah":true'*) ;;
  *)
    tulis 'Pembantu terpasang tetapi ujinya belum lolos. Hubungi pengelola ALETA.'
    selesai_dengan 2
    ;;
esac
VERSI_FOLDER=$(printf '%s' "$UJI" | sed -nE 's/.*"versiFolder":"([^"]*)".*/\1/p')
tulis "Versi ekstensi    : $VERSI_FOLDER"
tulis ''
tulis 'SELESAI. Mulai sekarang versi baru ALETA terpasang sendiri, tanpa unduhan dan tanpa bertanya.'
tulis 'Setelan Anda tidak berubah. Buka ikon ALETA di Chrome: "Pembaruan otomatis: aktif".'
selesai_dengan 0
