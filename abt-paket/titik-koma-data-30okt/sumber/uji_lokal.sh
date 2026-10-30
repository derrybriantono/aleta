#!/bin/bash
# Uji paket abt-titik-koma-data-30okt di basis salinan laptop (aps_badilag_bas29: dump server 28 Okt + ket-saksi-kata +
# ket-saksi-baris + bukti-nomor + titik-koma). pasang -> pemicu diuji (baris uji disisipkan lalu dihapus, HANYA di salinan) ->
# pulih (data & pemicu persis lama) -> pasang lagi. Sidik seluruh tabel sebelum/sesudah pulih dibandingkan.
set -u
DB="${1:-aps_badilag_bas29}"
SINI="${SINI:-$(cd "$(dirname "$0")/.." && pwd)}"
export PATH="/d/satker asal/website pa bungku/xampp/mysql/bin:$PATH"
MY="mysql -h 127.0.0.1 -u root --default-character-set=latin1 $DB"
N=abt-titik-koma-data-30okt
SIDIK="SELECT COUNT(*), MD5(GROUP_CONCAT(MD5(CONCAT_WS('|', id, IFNULL(pertanyaan,'~'), IFNULL(jawaban,'~'))) ORDER BY id SEPARATOR '')) FROM abt_keterangan_saksi"
s0=$($MY -N -e "SET SESSION group_concat_max_len = 1073741824; $SIDIK")
echo "SIDIK AWAL: $s0"
echo "PRASYARAT awal: $($MY -N < "$SINI/paket-satker/$N-PRASYARAT.sql")"
$MY -N -e "SELECT COUNT(DISTINCT perkara_id) FROM abt_keterangan_saksi WHERE REPLACE(REPLACE(jawaban, CHAR(10), ' '), CHAR(13), ' ') REGEXP ';.*[[:alnum:]]|;[[:space:]]*;|^[[:space:]]*;|:[[:space:]]*;' AND jawaban LIKE '%;%' AND CHAR_LENGTH(jawaban) - CHAR_LENGTH(REPLACE(jawaban, ';', '')) > CHAR_LENGTH(isian_rtf_butir_rapi(jawaban, '')) - CHAR_LENGTH(REPLACE(isian_rtf_butir_rapi(jawaban, ''), ';', ''))" | sed 's/^/perkara terdampak: /'
( cd "$SINI/paket-satker" && ABT_LOKAL=1 ABT_DB="$DB" bash pasang-satker.sh ) | tail -7
echo "UJI PEMICU (baris uji di salinan, langsung dihapus):"
$MY -N -e "INSERT INTO abt_keterangan_saksi (id, perkara_id, saksi_id, pertanyaan, jawaban) SELECT MAX(id) + 1, -30, 0, 'uji-t30 ?', CONCAT('tidak berhasil;karena', CHAR(10), 'jauh ;;') FROM abt_keterangan_saksi;
  SELECT CONCAT('sisip -> ', jawaban) FROM abt_keterangan_saksi WHERE perkara_id = -30;
  UPDATE abt_keterangan_saksi SET jawaban = 'kenal ; rukun' WHERE perkara_id = -30;
  SELECT CONCAT('ubah -> ', jawaban) FROM abt_keterangan_saksi WHERE perkara_id = -30;
  DELETE FROM abt_keterangan_saksi WHERE perkara_id = -30;" 2>&1
echo "PULIH:"
( cd "$SINI/paket-satker" && ABT_LOKAL=1 ABT_DB="$DB" bash pulih-satker.sh ) | tail -5
s1=$($MY -N -e "SET SESSION group_concat_max_len = 1073741824; $SIDIK")
echo "SIDIK SESUDAH PULIH: $s1 ($([ "$s0" = "$s1" ] && echo SAMA PERSIS || echo BEDA))"
echo "PASANG LAGI:"
( cd "$SINI/paket-satker" && ABT_LOKAL=1 ABT_DB="$DB" bash pasang-satker.sh ) | tail -3
