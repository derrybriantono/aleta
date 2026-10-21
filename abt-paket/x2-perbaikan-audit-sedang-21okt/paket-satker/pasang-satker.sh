#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-x2-perbaikan-audit-sedang-21okt" (21 Okt 2026). Dijalankan DI SERVER sebagai root, dari folder paket.
# Isi: 19 variabel baru (S8: 8155, 0207, 0074, 5052, 6115, 6116, 8439-8445 dan bantuan 10121-10126) dan 69 baris variabel yang DIUBAH
#      (S1 0015; S2 6032, 5101; S3 9003, 7105, 7106; S4 1241, 1242, 1251, 1252, 6149; S5 52 variabel tanpa data_type; S6 8544, 8545; S7 5128; S9 1335, 1372; S10 6271).
#      Tidak ada berkas blangko (RTF), menu, atau isian tersimpan per perkara yang disentuh.
# Urutan: md5 -> PRASYARAT (baca saja) -> CADANGAN baris yang akan diubah (sesudah prasyarat lolos; tidak pernah menimpa cadangan lama)
#         -> PASANG SQL (satu transaksi) -> PERIKSA -> UJI kueri baru/diubah atas perkara nyata (baca saja). Gagal sesudah PASANG = PULIH otomatis.
# Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_x2 SIPP_DB=sipp_donggala PY=python bash pasang-satker.sh
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-x2-perbaikan-audit-sedang-21okt
HARAP='0|0|69|0|9|0'
ULANG='0|19|0|69|9|0'
CAD="$SINI/cadangan"
SDB="${SIPP_DB:-SIPP}"
ADB="${ABT_DB:-aps_badilag}"
gagal() { echo "GAGAL: $*"; exit 1; }

md5sum -c MD5SUMS.txt >/dev/null 2>&1 || gagal "isi paket rusak (md5sum -c MD5SUMS.txt) - salin ulang paket dengan scp"
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

# --- 2. CADANGAN (hanya saat pertama; pasang ulang TIDAK menimpa cadangan isi lama) ----------------------------------------
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
if [ "$p" = "$HARAP" ]; then
  [ -f "$CAD/abt_variabel-sebelum.sql" ] && mv "$CAD/abt_variabel-sebelum.sql" "$CAD/abt_variabel-sebelum.$(date +%Y%m%d%H%M%S).sql"
  mysqldump -h "$H" -u root --default-character-set=latin1 --skip-tz-utc --no-create-info --replace --skip-extended-insert \
    --complete-insert --skip-comments --hex-blob --where="no_var IN ($NOMOR_UBAH)" "$ADB" abt_variabel > "$CAD/abt_variabel-sebelum.sql" \
    || gagal "mysqldump abt_variabel gagal - TIDAK ada yang diubah"
  nlama=$(grep -c '^REPLACE' "$CAD/abt_variabel-sebelum.sql")
  [ "$nlama" = 69 ] || gagal "cadangan memuat $nlama baris (harus 69) - TIDAK ada yang diubah"
  echo "CADANGAN: $CAD/abt_variabel-sebelum.sql ($nlama baris lama)"
else
  [ -f "$CAD/abt_variabel-sebelum.sql" ] || echo "PERINGATAN: paket sudah terpasang tetapi $CAD/abt_variabel-sebelum.sql tidak ada - PULIH tidak dapat mengembalikan isi lama (ambil dari cadangan DB harian)"
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

# --- 4. UJI kueri baru atas perkara nyata (baca saja) -------------------------------------------------------------------
SQ="mysql -h $H -u root --default-character-set=latin1 $SDB -N"
NU=$(awk -F'\t' '!/^#/ && NF==2' uji-kueri.tsv | wc -l | tr -d ' ')
PERKARA_UJI="$(cat perkara-uji.txt | tr '\n' ',' | sed "s/,\$//; s/,/','/g")"
for PID in $($SQ -e "SELECT perkara_id FROM perkara WHERE nomor_perkara IN ('$PERKARA_UJI')" 2>/dev/null | grep -v NULL | sort -u); do
  if ! sed "s/#perkara_id#/$PID/g" uji-kueri.tsv | awk -F'\t' '!/^#/ && NF==2 {print "SELECT " $1 " AS var, LEFT(REPLACE(IFNULL((SELECT x.data FROM (" $2 ") x LIMIT 1), \"(kosong)\"), CHAR(10), \" \"), 120) AS data;"}' \
       | $SQ > "$CAD/uji-$PID.txt" 2>&1; then
    echo "uji perkara $PID: GALAT $(head -c 300 "$CAD/uji-$PID.txt")"
    bash ./pulih-satker.sh
    gagal "kueri variabel baru tidak jalan di server ini - dipulihkan. Kirim $CAD/uji-$PID.txt ke pengembang"
  fi
  [ "$(grep -c . "$CAD/uji-$PID.txt")" = "$NU" ] || { bash ./pulih-satker.sh; gagal "uji perkara $PID tidak menjawab $NU baris - dipulihkan"; }
  echo "uji perkara $PID: $(grep -c . "$CAD/uji-$PID.txt") kueri jalan; berisi: $(awk -F"	" '$2!="(kosong)" && $2!="" {printf "%s ", $1}' "$CAD/uji-$PID.txt")(isi lengkap: $CAD/uji-$PID.txt)"
done
echo "SELESAI - paket $N terpasang. Cadangan: $CAD. Pulih: bash $SINI/pulih-satker.sh"
