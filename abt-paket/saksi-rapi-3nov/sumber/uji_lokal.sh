#!/bin/bash
# Uji fungsi paket di basis laptop (salinan abt_keterangan_saksi + fungsi terpasang dari aps_badilag_w189d, lihat PASANG.md):
#   pasang FUNGSI-LAMA -> bangun SQL -> pasang FUNGSI -> md5 -> bangun ulang -> PRASYARAT + PERIKSA. Lalu MD5SUMS.
# pakai (Git Bash, dari folder paket): W=aps_badilag_w195 bash sumber/uji_lokal.sh   (mysql di PATH)
set -eu
cd "$(dirname "$0")/.."
W="${W:-aps_badilag_w195}"
MY="mysql -h 127.0.0.1 -u root --default-character-set=latin1"
sed "s/aps_badilag\./$W./g" paket-satker/abt-saksi-rapi-3nov-FUNGSI-LAMA.sql | $MY $W
python sumber/bangun_sql.py .. paket-satker > /dev/null
sed "s/aps_badilag\./$W./g" paket-satker/abt-saksi-rapi-3nov-FUNGSI.sql | $MY $W
MD=$($MY -N $W -e "SELECT MD5(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(routine_definition, CONCAT(DATABASE(), '.abt_'), 'aps_badilag.abt_'), CHAR(92), ''), ' ', ''), CHAR(9), ''), CHAR(13), ''), CHAR(10), '')) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_name='isian_rtf_ket_saksi'")
python sumber/bangun_sql.py .. paket-satker "$MD"
echo "PRASYARAT: $($MY -N $W < paket-satker/abt-saksi-rapi-3nov-PRASYARAT.sql)"
echo "PERIKSA: $($MY -N $W < paket-satker/abt-saksi-rapi-3nov-PERIKSA.sql)"
cd paket-satker && md5sum $(ls | grep -v -e MD5SUMS -e cadangan) > MD5SUMS.txt && echo "MD5SUMS ditulis"
