#!/bin/bash
# =============================================================================
# PULIH paket ABT "w2a-kebendaan" di SATKER: hapus variabel 4780-4849 dan kembalikan semua blangko dari cadangan
# yang dibuat pasang-satker.sh.
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
CAD="$(pwd)/cadangan"
DASAR=/var/www/html/aps_badilag/_blangko_abt/derry_briantono
TAB=$(printf '\t')
[ -s "$CAD/DAFTAR-SUDAH" ] || { echo "GAGAL: cadangan $CAD/DAFTAR-SUDAH tidak ada"; exit 1; }
MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)"; export MYSQL_PWD
MY="mysql -h 127.0.0.1 -u root --default-character-set=latin1 aps_badilag"
$MY < abt-w2a-PULIH-HAPUS-BARU.sql || { echo "GAGAL menghapus variabel baru"; exit 1; }
SALAH=0
while IFS="$TAB" read -r NN FOLDER BERKAS PRA BARU; do
  [ -z "$NN" ] && continue
  [ -s "$CAD/rtf/$NN.rtf" ] || { echo "cadangan hilang: $FOLDER/$BERKAS"; SALAH=1; continue; }
  cat "$CAD/rtf/$NN.rtf" > "$DASAR/$FOLDER/$BERKAS"
  [ "$(md5sum "$DASAR/$FOLDER/$BERKAS" | cut -d' ' -f1)" = "$PRA" ] || { echo "md5 sesudah pulih berbeda: $FOLDER/$BERKAS"; SALAH=1; }
done < "$CAD/DAFTAR-SUDAH"
[ "$SALAH" = "0" ] && echo "PULIH selesai: variabel dihapus, semua blangko kembali ke md5 semula" || echo "PULIH SEBAGIAN - periksa pesan di atas"
