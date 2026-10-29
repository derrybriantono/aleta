#!/bin/bash
# Uji paket abt-ket-saksi-kata-30okt di basis salinan laptop (bawaan aps_badilag_bas29 = dump server 28 Okt, nama basis di
# fungsi diarahkan ke salinan). Bandingkan keluaran isian_rtf_ket_saksi LAMA vs BARU atas SEMUA kelompok saksi yang memuat
# pola (ya, / saya di dalam kata, Iya, di awal) + seperempat kelompok lain (perkara_id kelipatan 4) sebagai pembanding.
set -u
DB="${1:-aps_badilag_bas29}"
SINI="${SINI:-$(cd "$(dirname "$0")/.." && pwd)}"
export PATH="/d/satker asal/website pa bungku/xampp/mysql/bin:$PATH"
MY="mysql -h 127.0.0.1 -u root --default-character-set=latin1 $DB"
N=abt-ket-saksi-kata-30okt
f() { sed "s/aps_badilag\./$DB./g" "$SINI/paket-satker/$1"; }
echo "PRASYARAT awal: $($MY -N < "$SINI/paket-satker/$N-PRASYARAT.sql")"
$MY -e "DROP TABLE IF EXISTS k30_kelompok, k30_lama, k30_baru;
CREATE TABLE k30_kelompok AS SELECT DISTINCT perkara_id, saksi_id, MAX(LOWER(jawaban) REGEXP '[a-z]ya, |[a-z]saya|saya[a-z]|^iya, ') pola FROM abt_keterangan_saksi WHERE saksi_id IS NOT NULL GROUP BY perkara_id, saksi_id HAVING pola = 1 OR MOD(perkara_id, 4) = 0;
CREATE TABLE k30_lama AS SELECT perkara_id, saksi_id, isian_rtf_ket_saksi(perkara_id, saksi_id) o FROM k30_kelompok;"
f "$N-FUNGSI.sql" | $MY || { echo GAGAL FUNGSI; exit 1; }
echo "PRASYARAT sesudah pasang: $($MY -N < "$SINI/paket-satker/$N-PRASYARAT.sql")"
$MY -e "CREATE TABLE k30_baru AS SELECT perkara_id, saksi_id, isian_rtf_ket_saksi(perkara_id, saksi_id) o FROM k30_kelompok;"
$MY -N -e "SELECT k.pola, COUNT(*), SUM(BINARY l.o = BINARY b.o), SUM(BINARY l.o <> BINARY b.o) FROM k30_lama l JOIN k30_baru b USING (perkara_id, saksi_id) JOIN k30_kelompok k USING (perkara_id, saksi_id) GROUP BY k.pola" | sed 's/^/pola | kelompok | sama | beda: /'
$MY -N -e "SELECT SUBSTRING(l.o, 1, 2000), '||', SUBSTRING(b.o, 1, 2000) FROM k30_lama l JOIN k30_baru b USING (perkara_id, saksi_id) WHERE BINARY l.o <> BINARY b.o LIMIT 400" > /d/Aplikasi/aleta/tmp/bas29/k30-beda.txt
echo "UJI fungsi kata utuh (harus 1 semua):"
$MY -N -e "SELECT isian_rtf_ganti_kata('Saya tidak mengetahuinya, yang saya tahu', 'ya, ', '') = 'Saya tidak mengetahuinya, yang saya tahu',
  isian_rtf_ganti_kata('ya, saya kenal', 'ya, ', '') = 'saya kenal',
  isian_rtf_ganti_kata('saya kenal, kesayangan saya.', 'saya', 'saksi') = 'saksi kenal, kesayangan saksi.',
  isian_rtf_ganti_kata('Saya', 'saya', 'saksi') = 'saksi',
  isian_rtf_ganti_kata(NULL, 'saya', 'saksi') IS NULL"
echo "PULIH:"
f "$N-FUNGSI-LAMA.sql" | $MY || { echo GAGAL PULIH; exit 1; }
echo "PRASYARAT sesudah pulih: $($MY -N < "$SINI/paket-satker/$N-PRASYARAT.sql")"
$MY -N -e "SELECT COUNT(*), SUM(BINARY l.o = BINARY isian_rtf_ket_saksi(l.perkara_id, l.saksi_id)) FROM k30_lama l" | sed 's/^/sesudah pulih kelompok | sama dengan lama: /'
f "$N-FUNGSI.sql" | $MY && echo "PRASYARAT pasang lagi: $($MY -N < "$SINI/paket-satker/$N-PRASYARAT.sql")"
