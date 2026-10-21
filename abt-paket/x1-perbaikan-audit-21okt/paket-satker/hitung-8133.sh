#!/bin/bash
# Hitung BACA SAJA berapa perkara yang isian 8133 ("Alat Bukti Dispen") tersimpannya masih memuat teks bawaan LAMA (yang memuat NIK/nomor KK orang lain).
# Isi lama diambil dari cadangan/abt_variabel-sebelum.sql (dibuat pasang-satker.sh sebelum 8133 diubah). Isian tersimpan TIDAK diubah.
# Keluaran: hanya angka dan perkara_id (tanpa NIK/nama); daftar juga ditulis ke cadangan/perkara-8133-data-lama.txt.
# Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_x1 bash hitung-8133.sh
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
CAD="$SINI/cadangan"
ADB="${ABT_DB:-aps_badilag}"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || { echo "GAGAL: sandi DB tidak terbaca"; exit 1; }
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="mysql -h $H -u root --default-character-set=latin1 $ADB"
[ -f "$CAD/abt_variabel-sebelum.sql" ] || { echo "GAGAL: $CAD/abt_variabel-sebelum.sql tidak ada"; exit 1; }
lama() {
  echo "CREATE TEMPORARY TABLE x1_lama LIKE abt_variabel;"
  grep '^REPLACE' "$CAD/abt_variabel-sebelum.sql" | sed 's/^REPLACE INTO `abt_variabel`/REPLACE INTO x1_lama/'
}
# deret 16 angka (NIK / nomor KK) pada teks bawaan lama
ANGKA=$({ lama; echo "SELECT default_data FROM x1_lama WHERE no_var=8133;"; } | $MY -N | grep -oE '[0-9]{16}' | sort -u)
JML=$(echo "$ANGKA" | grep -c .)
[ "$JML" -gt 0 ] || { echo "ISIAN 8133: teks bawaan lama tidak memuat deret 16 angka (tidak ada yang dihitung)"; : > "$CAD/perkara-8133-data-lama.txt"; exit 0; }
W=""
for a in $ANGKA; do W="$W OR t.data LIKE '%$a%'"; done
W="${W# OR }"
TOTAL=$($MY -N -e "SELECT COUNT(*) FROM abt_data_teks WHERE no_var=8133")
PERSIS=$({ lama; echo "SELECT t.perkara_id FROM abt_data_teks t JOIN x1_lama l ON l.no_var=t.no_var WHERE t.no_var=8133 AND t.data = l.default_data ORDER BY t.perkara_id;"; } | $MY -N | tr '\n' ' ')
MEMUAT=$($MY -N -e "SELECT t.perkara_id FROM abt_data_teks t WHERE t.no_var=8133 AND ($W) ORDER BY t.perkara_id" | tr '\n' ' ')
{
  echo "isian 8133 tersimpan: $TOTAL perkara"
  echo "persis sama dengan teks bawaan lama: $(echo $PERSIS | wc -w) perkara: ${PERSIS:-tidak ada}"
  echo "memuat salah satu dari $JML deret 16 angka teks bawaan lama: $(echo $MEMUAT | wc -w) perkara: ${MEMUAT:-tidak ada}"
} | tee "$CAD/perkara-8133-data-lama.txt"
