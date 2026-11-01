#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-tanya-jawab-format-1nov" (1 Nov 2026, agen M; keputusan pengguna 85 dan 86). Dijalankan DI SERVER sebagai root, dari folder paket.
# HANYA pengguna derry_briantono. Isi:
#   1. blangko RTF BAS/putusan: semua tanya jawab TERTULIS TANGAN (tabel dua kolom) dibentuk seperti keluaran ABT (Abt_model::kolom_kode_A4):
#      pertanyaan di kiri, jawaban di bawahnya di kanan diawali "- ", lebar sel 4250/8500 seragam; 98 BAS yang menulis "Susunan majelis ... sama dengan
#      sidang yang lalu;" sebagai teks biasa memakai #5404#; 3 BAS ALUR 05 [3a] bagian Tergugat memakai sebutan #0047# yang benar (daftar-tambal.tsv + tambal.tsv);
#   2. variabel #5404# diganti kueri baru (membandingkan susunan majelis/PP sidang ini dengan sidang sebelumnya, kalimat pergantian lengkap);
#      satu variabel, tanpa variabel/menu baru; satu transaksi, #5404# diubah hanya bila persis dasar (md5).
# URUTAN PASANG: KE-29, PALING AKHIR - sesudah bas-lanjutan-1nov (md5 dasar = keadaan SESUDAH 28 paket ../URUTAN-PASANG-1nov.md).
# Urutan: md5 -> PRASYARAT SQL + BERKAS (baca saja) -> CADANGAN -> PASANG SQL (satu transaksi) -> PERIKSA -> UJI kueri (baca saja)
#         -> BERKAS -> PERIKSA BERKAS. Gagal sesudah PASANG = PULIH otomatis.
# Laptop: ABT_LOKAL=1 ABT_DB=<basis ABT uji> SIPP_DB=<basis SIPP uji> ABT_BLANGKO=<_blangko_abt uji> MYSQL_BIN=<folder mysql.exe> PY=python bash pasang-satker.sh
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-tanya-jawab-format-1nov
HARAP="$(sed -n 1p harap.txt | tr -d '\r')"
ULANG="$(sed -n 2p harap.txt | tr -d '\r')"
UBAH="$(grep -v '^#' nomor-diubah.txt | paste -sd, -)"
CAD="$SINI/cadangan"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt}"
SDB="${SIPP_DB:-SIPP}"
ADB="${ABT_DB:-aps_badilag}"
PY="${PY:-python}"
BIN="${MYSQL_BIN:-}"; [ -n "$BIN" ] && BIN="$BIN/"
gagal() { echo "GAGAL: $*"; exit 1; }

md5sum -c MD5SUMS.txt >/dev/null 2>&1 || gagal "isi paket rusak (md5sum -c MD5SUMS.txt) - salin ulang paket dengan scp"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || gagal "sandi DB tidak terbaca dari aleta-bot"
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="${BIN}mysql -h $H -u root --default-character-set=latin1 $ADB"
pulih_sql() { $MY -N < "$N-PULIH.sql"; }

# --- 1. PRASYARAT (baca saja) -------------------------------------------------------------------------------------------
p=$($MY -N < "$N-PRASYARAT.sql") || gagal "prasyarat tak terbaca - TIDAK ada yang diubah"
p=$(echo "$p" | tr -d '\r')
if [ "$p" != "$HARAP" ] && [ "$p" != "$ULANG" ]; then
  gagal "prasyarat '$p' (harus '$HARAP' pasang pertama atau '$ULANG' pasang ulang) - TIDAK ada yang diubah. Arti angka: lihat $N-PRASYARAT.sql"
fi
echo "PRASYARAT COCOK ($p)"
c=$($PY tambal_rtf.py cek "$B"); echo "$c" | tail -3
[ "$(echo "$c" | tail -1)" = "BERKAS SIAP" ] || gagal "berkas tujuan tidak sesuai - TIDAK ada yang diubah"

# --- 2. CADANGAN ------------------------------------------------------------------------------------------------------
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
[ -f "$CAD/abt_variabel-sebelum.sql" ] && mv "$CAD/abt_variabel-sebelum.sql" "$CAD/abt_variabel-sebelum.$(date +%Y%m%d%H%M%S).sql"
"${BIN}mysqldump" -h "$H" -u root --default-character-set=latin1 --skip-tz-utc --no-create-info --replace --skip-extended-insert \
  --complete-insert --skip-comments --hex-blob --where="no_var IN ($UBAH)" "$ADB" abt_variabel > "$CAD/abt_variabel-sebelum.sql" \
  || gagal "mysqldump abt_variabel gagal - TIDAK ada yang diubah"
echo "CADANGAN: $CAD (baris variabel: $(grep -c '^REPLACE' "$CAD/abt_variabel-sebelum.sql"))"

# --- 3. PASANG SQL + PERIKSA -------------------------------------------------------------------------------------------
$MY < "$N-PASANG.sql" || { pulih_sql; gagal "$N-PASANG.sql gagal (transaksi tidak di-COMMIT) - dipulihkan"; }
$MY -N < "$N-PERIKSA.sql" | tr -d '\r' > "$CAD/periksa-sesudah.txt"
tail -1 "$CAD/periksa-sesudah.txt" | cut -f1
if [ "$(tail -1 "$CAD/periksa-sesudah.txt" | cut -f1)" != "SEMUA COCOK" ]; then
  head -20 "$CAD/periksa-sesudah.txt"; pulih_sql
  gagal "PERIKSA tidak cocok - dipulihkan; berkas belum disentuh"
fi

# --- 4. UJI: #5404# menjawab di server ini (baca saja) --------------------------------------------------------------
# contoh 1 = sidang ke-2 terbaru (umumnya "sama"); contoh 2 = sidang yang hakimnya BERGANTI di antara dua sidang (kalimat pergantian harus tersusun)
SQ="${BIN}mysql -h $H -u root --default-character-set=latin1 $SDB -N"
uji_kueri() { # $1 perkara, $2 tanggal sidang, $3 tanggal sidang sebelumnya
  Q=$($MY -N --raw -e "SELECT sql_query FROM abt_variabel WHERE no_var = 5404" | tr -d '\r')
  Q2=$(printf '%s' "$Q" | sed "s|#perkara_id#|$1|g; s|#0033#|$2|g; s|#6091#|$3|g; s|#6034#|Panitera Sidang|g")
  $SQ -e "SELECT x.data FROM ($Q2) x LIMIT 1" 2>&1 | tr -d '\r'
}
C1=$($SQ -e "SELECT s.perkara_id, s.tanggal_sidang, p.tanggal_sidang FROM perkara_jadwal_sidang s JOIN perkara_jadwal_sidang p ON p.perkara_id = s.perkara_id AND p.urutan = s.urutan - 1 WHERE s.urutan = 2 AND s.tanggal_sidang > '2000-01-01' AND p.tanggal_sidang > '2000-01-01' ORDER BY s.perkara_id DESC LIMIT 1" 2>/dev/null | tr -d '\r')
C2=$($SQ -e "SELECT s.perkara_id, s.tanggal_sidang, p.tanggal_sidang FROM perkara_hakim_pn h JOIN perkara_jadwal_sidang s ON s.perkara_id = h.perkara_id JOIN perkara_jadwal_sidang p ON p.perkara_id = s.perkara_id AND p.urutan = s.urutan - 1 WHERE h.aktif = 'T' AND h.tanggal_tidak_aktif IS NOT NULL AND h.tanggal_tidak_aktif > p.tanggal_sidang AND h.tanggal_tidak_aktif <= s.tanggal_sidang AND s.urutan >= 2 ORDER BY s.perkara_id DESC LIMIT 1" 2>/dev/null | tr -d '\r')
if [ -n "$C1" ]; then
  set -- $C1
  HA=$(uji_kueri "$1" "$2" "$3")
  case "$HA" in
    "Susunan majelis"*) echo "UJI contoh 1: perkara $1 -> ${HA:0:60}" ;;
    *) pulih_sql; gagal "kueri #5404# tidak menjawab di server ini ('${HA:0:150}') - dipulihkan; berkas belum disentuh" ;;
  esac
fi
if [ -n "$C2" ]; then
  set -- $C2
  HB=$(uji_kueri "$1" "$2" "$3")
  case "$HB" in
    "Susunan majelis sidang sebelumnya"*) echo "UJI contoh 2: perkara $1 hakim berganti -> ${HB:0:60}" ;;
    *) pulih_sql; gagal "kueri #5404# gagal untuk perkara dengan pergantian hakim ('${HB:0:150}') - dipulihkan; berkas belum disentuh" ;;
  esac
else
  echo "UJI contoh 2 dilewati: tidak ada perkara dengan pergantian hakim di antara dua sidang"
fi

# --- 5. BERKAS RTF ---------------------------------------------------------------------------------------------------------
$PY tambal_rtf.py pasang "$B" "$CAD" > "$CAD/berkas-pasang.txt"
if [ "$?" != "0" ]; then
  tail -5 "$CAD/berkas-pasang.txt"
  $PY tambal_rtf.py pulih "$B" "$CAD"; pulih_sql
  gagal "berkas RTF tidak terpasang - berkas & variabel dikembalikan (lihat $CAD/berkas-pasang.txt)"
fi
tail -1 "$CAD/berkas-pasang.txt"
$PY tambal_rtf.py periksa "$B" > "$CAD/berkas-periksa.txt"
tail -1 "$CAD/berkas-periksa.txt"
if [ "$(tail -1 "$CAD/berkas-periksa.txt" | tr -d '\r')" != "BERKAS COCOK" ]; then
  $PY tambal_rtf.py pulih "$B" "$CAD"; pulih_sql
  gagal "periksa berkas tidak cocok - berkas & variabel dikembalikan"
fi
echo "SELESAI - paket $N terpasang. Cadangan: $CAD. Pulih: bash $SINI/pulih-satker.sh"
