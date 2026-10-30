#!/bin/bash
# Uji paket abt-titik-koma-30okt di basis salinan laptop (bawaan aps_badilag_bas29 = dump server 28 Okt + ket-saksi-kata +
# ket-saksi-baris + bukti-nomor). Keluaran LAMA vs BARU atas SEMUA kelompok saksi (perkara x saksi) dan SEMUA isian bukti
# (8 variabel) lewat pasang-satker.sh sungguhan, lalu PULIH dan pasang lagi. Banding dirinci banding.py.
set -u
DB="${1:-aps_badilag_bas29}"
SINI="${SINI:-$(cd "$(dirname "$0")/.." && pwd)}"
KEL="${KEL:-/d/Aplikasi/aleta/tmp/bas29/t30}"
export PATH="/d/satker asal/website pa bungku/xampp/mysql/bin:$PATH"
MY="mysql -h 127.0.0.1 -u root --default-character-set=latin1 $DB"
N=abt-titik-koma-30okt
mkdir -p "$KEL"
BK="no_var IN ('9955','9911','1214','9958','9956','8131','8132','0378')"
echo "PRASYARAT awal: $($MY -N < "$SINI/paket-satker/$N-PRASYARAT.sql")"
$MY -e "DROP TABLE IF EXISTS t30_kelompok, t30_lama, t30_baru, t30_bukti_lama, t30_bukti_baru;
CREATE TABLE t30_kelompok AS SELECT DISTINCT perkara_id, saksi_id FROM abt_keterangan_saksi WHERE saksi_id IS NOT NULL;
CREATE TABLE t30_lama AS SELECT perkara_id, saksi_id, isian_rtf_ket_saksi(perkara_id, saksi_id) o FROM t30_kelompok;
CREATE TABLE t30_bukti_lama AS SELECT no_var, perkara_id, isian_rtf_bukti(data) o FROM abt_data_teks WHERE $BK;" || exit 1
( cd "$SINI/paket-satker" && ABT_LOKAL=1 ABT_DB="$DB" bash pasang-satker.sh ) | tail -4
$MY -e "CREATE TABLE t30_baru AS SELECT perkara_id, saksi_id, isian_rtf_ket_saksi(perkara_id, saksi_id) o FROM t30_kelompok;
CREATE TABLE t30_bukti_baru AS SELECT no_var, perkara_id, isian_rtf_bukti(data) o FROM abt_data_teks WHERE $BK;"
$MY -N -e "SELECT 'saksi', COUNT(*), SUM(BINARY l.o = BINARY b.o), SUM(BINARY l.o <> BINARY b.o) FROM t30_lama l JOIN t30_baru b USING (perkara_id, saksi_id)
 UNION ALL SELECT 'bukti', COUNT(*), SUM(BINARY l.o = BINARY b.o), SUM(BINARY l.o <> BINARY b.o) FROM t30_bukti_lama l JOIN t30_bukti_baru b USING (no_var, perkara_id)" | sed 's/^/jenis | jumlah | sama | beda: /'
$MY -N -e "SELECT 'S', l.perkara_id, HEX(l.o), HEX(b.o) FROM t30_lama l JOIN t30_baru b USING (perkara_id, saksi_id) WHERE BINARY l.o <> BINARY b.o
 UNION ALL SELECT CONCAT('B', l.no_var), l.perkara_id, HEX(l.o), HEX(b.o) FROM t30_bukti_lama l JOIN t30_bukti_baru b USING (no_var, perkara_id) WHERE BINARY l.o <> BINARY b.o" > "$KEL/beda.tsv"
echo "baris beda: $(wc -l < "$KEL/beda.tsv") -> $KEL/beda.tsv"
echo "PULIH:"
( cd "$SINI/paket-satker" && ABT_LOKAL=1 ABT_DB="$DB" bash pulih-satker.sh ) | tail -2
$MY -N -e "SELECT COUNT(*), SUM(BINARY l.o = BINARY isian_rtf_ket_saksi(l.perkara_id, l.saksi_id)) FROM t30_lama l" | sed 's/^/sesudah pulih kelompok saksi | sama dengan lama: /'
$MY -N -e "SELECT COUNT(*), SUM(BINARY l.o = BINARY isian_rtf_bukti(d.data)) FROM t30_bukti_lama l JOIN abt_data_teks d USING (no_var, perkara_id)" | sed 's/^/sesudah pulih isian bukti | sama dengan lama: /'
echo "PASANG LAGI:"
( cd "$SINI/paket-satker" && ABT_LOKAL=1 ABT_DB="$DB" bash pasang-satker.sh ) | tail -2
