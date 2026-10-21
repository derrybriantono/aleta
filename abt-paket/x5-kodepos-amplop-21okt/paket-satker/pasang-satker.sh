#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-x5-kodepos-amplop-21okt" (21 Okt 2026). Dijalankan DI SERVER sebagai root, dari folder paket.
# Isi: 4 variabel baru (9290 kode pos Penggugat/Pemohon, 9291 kode pos Tergugat/Termohon, 9292/9293 alamat + ", Kode Pos NNNNN"), 1 baris diubah (8172 Nomor Kode Pos amplop
#      surat tercatat) dan 6 blangko RTF amplop Derry ("98 Relaas": [JS] 8.1.1-8.3.2) yang disunting SATU penanda (#0101# -> #9292#, #0105# -> #9293#; md5 dijaga).
#      Tidak ada blangko lain, folder, menu, atau isian tersimpan per perkara yang disentuh.
# Urutan: md5 -> PRASYARAT SQL + BERKAS (baca saja) -> CADANGAN (sesudah prasyarat lolos; tidak pernah menimpa cadangan lama)
#         -> PASANG SQL (satu transaksi) -> PERIKSA -> UJI kueri atas perkara nyata (baca saja) -> SUNTING BERKAS -> PERIKSA BERKAS.
#         Gagal sesudah PASANG = PULIH otomatis (berkas dikembalikan lebih dulu, lalu SQL).
# Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_x5 ABT_BLANGKO=<_blangko_abt uji> SIPP_DB=sipp_donggala PY=python bash pasang-satker.sh
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-x5-kodepos-amplop-21okt
HARAP='0|0|1|0|0|0'
ULANG='0|4|0|1|0|0'
CAD="$SINI/cadangan"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt}"
SDB="${SIPP_DB:-SIPP}"
ADB="${ABT_DB:-aps_badilag}"
PY="${PY:-python}"
gagal() { echo "GAGAL: $*"; exit 1; }

md5sum -c MD5SUMS.txt >/dev/null 2>&1 || gagal "isi paket rusak (md5sum -c MD5SUMS.txt) - salin ulang paket dengan scp"
while IFS= read -r f; do
  [ -d "$B/$f" ] || gagal "folder blangko $B/$f tidak ada - TIDAK ada yang diubah"
done < <(grep -v '^#' folder-ada.txt)
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || gagal "sandi DB tidak terbaca dari aleta-bot"
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="mysql -h $H -u root --default-character-set=latin1 $ADB"
NOMOR_BARU=$(cat nomor-baru.txt)
NOMOR_UBAH=$(cat nomor-ubah.txt)

# --- 1. PRASYARAT (baca saja) -------------------------------------------------------------------------------------------
p=$($MY -N < "$N-PRASYARAT.sql") || gagal "prasyarat tak terbaca - TIDAK ada yang diubah"
if [ "$p" != "$HARAP" ] && [ "$p" != "$ULANG" ]; then
  gagal "prasyarat '$p' (harus '$HARAP', atau '$ULANG' bila pasang ulang) - TIDAK ada yang diubah. Arti angka: lihat $N-PRASYARAT.sql"
fi
echo "PRASYARAT COCOK ($p)"
c=$($PY berkas_rtf.py cek "$B"); echo "$c"
[ "$(echo "$c" | tail -1)" = "BERKAS SIAP" ] || gagal "berkas blangko tidak sesuai - TIDAK ada yang diubah"

# --- 2. CADANGAN (hanya saat pertama; pasang ulang TIDAK menimpa cadangan isi lama) ----------------------------------------
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
if [ "$p" = "$HARAP" ]; then
  [ -f "$CAD/abt_variabel-sebelum.sql" ] && mv "$CAD/abt_variabel-sebelum.sql" "$CAD/abt_variabel-sebelum.$(date +%Y%m%d%H%M%S).sql"
  mysqldump -h "$H" -u root --default-character-set=latin1 --skip-tz-utc --no-create-info --replace --skip-extended-insert \
    --complete-insert --skip-comments --hex-blob --where="no_var IN ($NOMOR_UBAH)" "$ADB" abt_variabel > "$CAD/abt_variabel-sebelum.sql" \
    || gagal "mysqldump abt_variabel gagal - TIDAK ada yang diubah"
  nlama=$(grep -c '^REPLACE' "$CAD/abt_variabel-sebelum.sql")
  [ "$nlama" = 1 ] || gagal "cadangan memuat $nlama baris (harus 1) - TIDAK ada yang diubah"
  echo "CADANGAN: $CAD/abt_variabel-sebelum.sql ($nlama baris lama)"
else
  [ -f "$CAD/abt_variabel-sebelum.sql" ] || echo "PERINGATAN: paket sudah terpasang tetapi $CAD/abt_variabel-sebelum.sql tidak ada - PULIH tidak dapat mengembalikan isi lama 8172 (ambil dari cadangan DB harian)"
  echo "PASANG ULANG: cadangan isi lama dibiarkan"
fi

# --- 3. PASANG SQL + PERIKSA -------------------------------------------------------------------------------------------
$MY < "$N-PASANG.sql" || { bash ./pulih-satker.sh; gagal "$N-PASANG.sql gagal (transaksi tidak di-COMMIT) - dipulihkan"; }
$MY -N < "$N-PERIKSA.sql" > "$CAD/periksa-sesudah.txt"
tail -1 "$CAD/periksa-sesudah.txt"
if [ "$(tail -1 "$CAD/periksa-sesudah.txt")" != "SEMUA COCOK" ]; then
  grep -v '	1$' "$CAD/periksa-sesudah.txt"
  bash ./pulih-satker.sh
  gagal "PERIKSA tidak cocok - dipulihkan"
fi

# --- 4. UJI kueri baru dan diubah atas perkara nyata (baca saja) -------------------------------------------------------------------
SQ="mysql -h $H -u root --default-character-set=latin1 $SDB -N"
NU=$(awk -F'\t' '!/^#/ && NF==2' uji-kueri.tsv | wc -l | tr -d ' ')
for PID in $($SQ -e "SELECT perkara_id FROM perkara WHERE YEAR(tanggal_pendaftaran) = YEAR(CURDATE()) ORDER BY perkara_id DESC LIMIT ${UJI_JUMLAH:-8}" 2>/dev/null | grep -v NULL | sort -u); do
  if ! sed "s/#perkara_id#/$PID/g" uji-kueri.tsv | awk -F'\t' '!/^#/ && NF==2 {print "SELECT " $1 " AS var, RIGHT(REPLACE(IFNULL((SELECT x.data FROM (" $2 ") x LIMIT 1), \"(kosong)\"), CHAR(10), \" \"), 70) AS data;"}' \
       | $SQ > "$CAD/uji-$PID.txt" 2>&1; then
    echo "uji perkara $PID: GALAT $(head -c 300 "$CAD/uji-$PID.txt")"
    bash ./pulih-satker.sh
    gagal "kueri variabel baru atau diubah tidak jalan di server ini - dipulihkan. Kirim $CAD/uji-$PID.txt ke pengembang"
  fi
  [ "$(grep -c . "$CAD/uji-$PID.txt")" = "$NU" ] || { bash ./pulih-satker.sh; gagal "uji perkara $PID tidak menjawab $NU baris - dipulihkan"; }
  echo "uji perkara $PID: $(grep -c . "$CAD/uji-$PID.txt") kueri jalan; berisi: $(awk -F"	" '$2!="(kosong)" && $2!="" {printf "%s ", $1}' "$CAD/uji-$PID.txt")(isi lengkap: $CAD/uji-$PID.txt)"
done

# --- 5. SUNTING BLANGKO RTF + PERIKSA ---------------------------------------------------------------------------------------------
$PY berkas_rtf.py pasang "$B" "$CAD" | tee "$CAD/berkas-pasang.txt"
if [ "${PIPESTATUS[0]}" != "0" ]; then
  $PY berkas_rtf.py pulih "$B" "$CAD"
  bash ./pulih-satker.sh
  gagal "berkas blangko tidak tersunting - berkas dan variabel dikembalikan (lihat $CAD/berkas-pasang.txt)"
fi
$PY berkas_rtf.py periksa "$B" "$CAD" | tee "$CAD/berkas-periksa.txt"
if [ "$(tail -1 "$CAD/berkas-periksa.txt")" != "BERKAS COCOK" ]; then
  bash ./pulih-satker.sh
  gagal "periksa berkas tidak cocok - berkas dan variabel dikembalikan"
fi
echo "SELESAI - paket $N terpasang. Cadangan: $CAD. Pulih: bash $SINI/pulih-satker.sh"
