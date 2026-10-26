#!/bin/bash
# =============================================================================
# PULIH paket ABT "y5-pengumuman-kedua-26okt" di SATKER: kembalikan variabel 7063 ke isi lama.
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)"; export MYSQL_PWD
MY="mysql -h 127.0.0.1 -u root --default-character-set=latin1 aps_badilag"
$MY -N < abt-y5-pengumuman-kedua-26okt-PULIH.sql | tee /dev/stderr | tail -1 | grep -q "PULIH COCOK" || { echo "GAGAL memulihkan variabel 7063"; exit 1; }
echo "PULIH COCOK"
