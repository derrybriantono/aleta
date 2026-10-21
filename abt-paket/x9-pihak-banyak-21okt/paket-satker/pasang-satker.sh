#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-x9-pihak-banyak-21okt" (21 Okt 2026). Dijalankan DI SERVER sebagai root, dari folder paket.
# Isi: 6 fungsi tersimpan isian_rtf_* (romawi, tanggal, pihak_utama, pihak_nama, pihak_urutan, pihak_tambahan), 10 variabel baru (3507-3516) dan 6 baris
#      variabel yang DIUBAH (7047, 7048, 7097, 7098: cabang baru untuk pihak di atas batas lama; 8710 dan 7054: memanggil fungsi). Tidak ada blangko (RTF),
#      menu, isian tersimpan atau SIPP yang diubah; fungsi hanya MEMBACA tabel SIPP.
# Urutan: md5 -> PRASYARAT (baca saja) -> CADANGAN baris yang diubah (sesudah prasyarat lolos; tidak pernah menimpa cadangan lama) -> FUNGSI -> PASANG SQL
#         (satu transaksi) -> PERIKSA -> UJI atas perkara nyata (baca saja). Gagal sesudah FUNGSI = PULIH otomatis.
# Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_x9 SIPP_DB=sipp_donggala PY=python bash pasang-satker.sh
#         (nama basis ABT dan SIPP di berkas fungsi/uji disesuaikan otomatis; variabel tetap menyebut aps_badilag.isian_rtf_* sehingga uji penuh memakai basis render)
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-x9-pihak-banyak-21okt
HARAP='0|0|6|0|0|79|0'
ULANG='0|10|0|6|6|79|0'
CAD="$SINI/cadangan"
SDB="${SIPP_DB:-SIPP}"
ADB="${ABT_DB:-aps_badilag}"
gagal() { echo "GAGAL: $*"; exit 1; }
pulih() { echo "... memulihkan"; bash "$SINI/pulih-satker.sh" 2>&1 | tail -4; }

md5sum -c MD5SUMS.txt >/dev/null 2>&1 || gagal "isi paket rusak (md5sum -c MD5SUMS.txt) - salin ulang paket dengan scp"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || gagal "sandi DB tidak terbaca dari aleta-bot"
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="mysql -h $H -u root --default-character-set=latin1 $ADB"
myn() { $MY -N "$@" | tr -d '\r'; }   # klien mysql Windows menulis CRLF; di Linux tr tidak mengubah apa pun
NOMOR_UBAH=$(cat nomor-ubah.txt)
# berkas fungsi memakai nama basis SIPP "SIPP"; di basis uji laptop diganti nama basis ujinya
sqlf() { if [ "$SDB" = SIPP ]; then cat "$1"; else sed "s/SIPP\\./$SDB./g" "$1"; fi; }
set -o pipefail

# --- 1. PRASYARAT (baca saja) -------------------------------------------------------------------------------------------
p=$(myn < "$N-PRASYARAT.sql") || gagal "prasyarat tak terbaca - TIDAK ada yang diubah"
if [ "$p" != "$HARAP" ] && [ "$p" != "$ULANG" ]; then
  gagal "prasyarat '$p' (harus '$HARAP', atau '$ULANG' bila pasang ulang) - TIDAK ada yang diubah. Arti angka: lihat $N-PRASYARAT.sql"
fi
echo "PRASYARAT COCOK ($p)"
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"

# --- 2. CADANGAN (hanya saat pertama; pasang ulang TIDAK menimpa cadangan isi lama) ----------------------------------------
if [ "$p" = "$HARAP" ]; then
  [ -f "$CAD/abt_variabel-sebelum.sql" ] && mv "$CAD/abt_variabel-sebelum.sql" "$CAD/abt_variabel-sebelum.$(date +%Y%m%d%H%M%S).sql"
  mysqldump -h "$H" -u root --default-character-set=latin1 --skip-tz-utc --no-create-info --replace --skip-extended-insert \
    --complete-insert --skip-comments --hex-blob --where="no_var IN ($NOMOR_UBAH)" "$ADB" abt_variabel > "$CAD/abt_variabel-sebelum.sql" \
    || gagal "mysqldump abt_variabel gagal - TIDAK ada yang diubah"
  nlama=$(grep -c '^REPLACE' "$CAD/abt_variabel-sebelum.sql")
  [ "$nlama" = 6 ] || gagal "cadangan memuat $nlama baris (harus 6) - TIDAK ada yang diubah"
  echo "CADANGAN: $CAD/abt_variabel-sebelum.sql ($nlama baris lama)"
  # --- 3. FUNGSI ---------------------------------------------------------------------------------------------------------
  sqlf "$N-FUNGSI.sql" | $MY > "$CAD/fungsi-pasang.log" 2>&1 || { tail -5 "$CAD/fungsi-pasang.log"; pulih; gagal "fungsi tidak bisa dibuat - dipulihkan"; }
  echo "FUNGSI: $(myn -e "SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_name LIKE 'isian\\_rtf\\_%' AND routine_comment LIKE 'X9:%'") dibuat"
  # --- 4. PASANG SQL -----------------------------------------------------------------------------------------------------
  $MY < "$N-PASANG.sql" || { pulih; gagal "$N-PASANG.sql gagal (transaksi tidak di-COMMIT) - dipulihkan"; }
else
  [ -f "$CAD/abt_variabel-sebelum.sql" ] || echo "PERINGATAN: paket sudah terpasang tetapi $CAD/abt_variabel-sebelum.sql tidak ada - PULIH tidak dapat mengembalikan isi lama (ambil dari cadangan DB harian)"
  echo "PASANG ULANG: cadangan isi lama dibiarkan"
fi

# --- 5. PERIKSA ----------------------------------------------------------------------------------------------------------------
myn < "$N-PERIKSA.sql" > "$CAD/periksa-sesudah.txt" 2>&1
tail -1 "$CAD/periksa-sesudah.txt"
if [ "$(tail -1 "$CAD/periksa-sesudah.txt")" != "SEMUA COCOK" ]; then
  grep -v '	1$' "$CAD/periksa-sesudah.txt" | head -20
  [ "$p" = "$HARAP" ] && pulih
  gagal "PERIKSA tidak cocok$([ "$p" = "$HARAP" ] && echo ' - dipulihkan')"
fi

# --- 6. UJI atas perkara nyata (baca saja): panjang keluaran dan jumlah pihak per variabel; tanpa mencetak nama -----------------------------------------
SQ="mysql -h $H -u root --default-character-set=latin1 $SDB -N"
NU=$(awk -F'\t' '!/^#/ && NF==2' uji-kueri.tsv | wc -l | tr -d ' ')
PERKARA_UJI="$(cat perkara-uji.txt | tr '\n' ',' | sed "s/,\$//; s/,/','/g")"
for PID in $($SQ -e "SELECT perkara_id FROM perkara WHERE nomor_perkara IN ('$PERKARA_UJI')" 2>/dev/null | grep -v NULL | sort -u); do
  if ! sed "s/#perkara_id#/$PID/g; s/aps_badilag\\./$ADB./g" uji-kueri.tsv | awk -F'\t' '!/^#/ && NF==2 {print "SELECT \"" $1 "\" AS var, CHAR_LENGTH(IFNULL((SELECT x.data FROM (" $2 ") x LIMIT 1), \"\")) AS panjang, (CHAR_LENGTH(IFNULL((SELECT x.data FROM (" $2 ") x LIMIT 1), \"\")) - CHAR_LENGTH(REPLACE(IFNULL((SELECT x.data FROM (" $2 ") x LIMIT 1), \"\"), \"sebagai <strong>\", \"\"))) / 16 AS pihak;"}' \
       | $SQ > "$CAD/uji-$PID.txt" 2>&1; then
    echo "uji perkara $PID: GALAT $(head -c 300 "$CAD/uji-$PID.txt")"
    [ "$p" = "$HARAP" ] && pulih
    gagal "kueri variabel/fungsi tidak jalan di server ini$([ "$p" = "$HARAP" ] && echo ' - dipulihkan'). Kirim $CAD/uji-$PID.txt ke pengembang"
  fi
  tr -d '\r' < "$CAD/uji-$PID.txt" > "$CAD/uji-$PID.tmp" && mv "$CAD/uji-$PID.tmp" "$CAD/uji-$PID.txt"
  [ "$(grep -c . "$CAD/uji-$PID.txt")" = "$NU" ] || { [ "$p" = "$HARAP" ] && pulih; gagal "uji perkara $PID tidak menjawab $NU baris"; }
  echo "uji perkara $PID: $NU kueri jalan; pihak tercetak (var=jumlah): $(awk -F'\t' '$3>0 {printf "%s=%d ", $1, $3}' "$CAD/uji-$PID.txt")"
done
echo "SELESAI - paket $N terpasang. Cadangan: $CAD. Pulih: bash $SINI/pulih-satker.sh"
