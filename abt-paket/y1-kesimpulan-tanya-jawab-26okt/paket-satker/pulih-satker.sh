#!/bin/bash
# =============================================================================
# PULIH paket ABT "y1-kesimpulan-tanya-jawab-26okt" di SATKER: hapus variabel 4950-4959.
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)"; export MYSQL_PWD
MY="mysql -h 127.0.0.1 -u root --default-character-set=latin1 aps_badilag"
$MY < abt-y1-kesimpulan-tanya-jawab-26okt-PULIH-HAPUS-BARU.sql || { echo "GAGAL menghapus variabel baru"; exit 1; }
echo "PULIH: variabel 4950-4959 dihapus (sisa_baris_baru harus 0)"
