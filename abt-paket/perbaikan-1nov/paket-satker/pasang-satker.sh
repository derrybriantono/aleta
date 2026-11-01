#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-perbaikan-1nov" (1 Nov 2026, agen Q; keputusan pengguna 89-B2/73 dan 92). Dijalankan DI SERVER sebagai root, dari folder paket.
# HANYA pengguna derry_briantono. Isi:
#   A. 4 variabel tanggal/hari pembuktian #0046# (2111/7119) dan #0047# (2112/7121): tahap pembuktian ditentukan DULU dari alasan ditunda
#      sidang sebelumnya ("pembuktian Tergugat" -> Tergugat; "pembuktian lanjutan Penggugat"/"saksi Penggugat" -> Penggugat; tanpa sebutan pihak
#      -> aturan tahap keputusan 52). Cabang Court Calendar TIDAK diubah. Tanpa variabel baru.
#   B. 5 perbaikan dasar hukum di 14 blangko RTF (daftar-tambal.tsv + tambal.tsv): kata saja yang diganti.
# URUTAN PASANG: KE-30, PALING AKHIR - sesudah tanya-jawab-format-1nov (md5 dasar = keadaan SESUDAH 29 paket ../URUTAN-PASANG-1nov.md).
# Urutan: md5 paket -> PRASYARAT SQL + BERKAS (baca saja) -> CADANGAN -> PASANG SQL (satu transaksi) -> PERIKSA -> UJI kueri (baca saja)
#         -> BERKAS -> PERIKSA BERKAS. Gagal sesudah PASANG = PULIH otomatis.
# Laptop: ABT_LOKAL=1 ABT_DB=<basis ABT uji> SIPP_DB=<basis SIPP uji> ABT_BLANGKO=<_blangko_abt uji> MYSQL_BIN=<folder mysql.exe> PY=python bash pasang-satker.sh
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-perbaikan-1nov
HARAP="$(sed -n 1p harap.txt | tr -d '\r')"
ULANG="$(sed -n 2p harap.txt | tr -d '\r')"
UBAH="$(grep -v '^#' nomor-variabel.txt | tr -d '\r' | paste -sd, -)"
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

# --- 2. CADANGAN (hanya pasang pertama; pasang ulang tidak menimpa cadangan asli) -------------------------------------
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
if [ "$p" = "$HARAP" ]; then
  [ -f "$CAD/abt_variabel-sebelum.sql" ] && mv "$CAD/abt_variabel-sebelum.sql" "$CAD/abt_variabel-sebelum.$(date +%Y%m%d%H%M%S).sql"
  "${BIN}mysqldump" -h "$H" -u root --default-character-set=latin1 --skip-tz-utc --no-create-info --replace --skip-extended-insert \
    --complete-insert --skip-comments --skip-triggers --hex-blob --where="no_var IN ($UBAH)" "$ADB" abt_variabel > "$CAD/abt_variabel-sebelum.sql" \
    || gagal "mysqldump abt_variabel gagal - TIDAK ada yang diubah"
  echo "CADANGAN: $CAD (baris variabel: $(grep -c '^REPLACE' "$CAD/abt_variabel-sebelum.sql"))"
fi

# --- 3. PASANG SQL + PERIKSA -------------------------------------------------------------------------------------------
$MY < "$N-PASANG.sql" || { pulih_sql; gagal "$N-PASANG.sql gagal (transaksi tidak di-COMMIT) - dipulihkan"; }
$MY -N < "$N-PERIKSA.sql" | tr -d '\r' > "$CAD/periksa-sesudah.txt"
tail -1 "$CAD/periksa-sesudah.txt" | cut -f1
if [ "$(tail -1 "$CAD/periksa-sesudah.txt" | cut -f1)" != "SEMUA COCOK" ]; then
  head -20 "$CAD/periksa-sesudah.txt"; pulih_sql
  gagal "PERIKSA tidak cocok - dipulihkan; berkas belum disentuh"
fi

# --- 4. UJI: kueri baru jalan di server ini (baca saja; MariaDB 5.5) -------------------------------------------------
# contoh 1 = perkara yang tundaan sidang sebelumnya "Pembuktian Tergugat" dan sidang sesudahnya beragenda kosong: #0047# (2112) harus berisi tanggal
# yang tidak lebih lambat dari sidang itu; contoh 2 = perkara sembarang yang punya sidang: keempat variabel harus jalan tanpa galat.
SQ="${BIN}mysql -h $H -u root --default-character-set=latin1 $SDB -N"
kueri_var() { # $1 nomor variabel, $2 perkara_id -> baris pertama kolom data
  Q=$($MY -N --raw -e "SELECT sql_query FROM abt_variabel WHERE no_var = $1" | tr -d '\r')
  Q="${Q%;}"
  Q2=$(printf '%s' "$Q" | sed "s|#perkara_id#|$2|g")
  $SQ -e "SELECT x.data FROM ($Q2) x LIMIT 1" 2>&1 | tr -d '\r'
}
C1=$($SQ -e "SELECT s.perkara_id, MIN(s.tanggal_sidang) FROM perkara_jadwal_sidang p JOIN perkara_jadwal_sidang s ON s.perkara_id = p.perkara_id AND s.tanggal_sidang > p.tanggal_sidang WHERE LOWER(IFNULL(p.alasan_ditunda,'')) REGEXP '^pembuktian[[:space:]]+tergugat[[:space:].]*\$' AND IFNULL(s.agenda,'') = '' AND NOT EXISTS (SELECT 1 FROM perkara_jadwal_sidang x WHERE x.perkara_id = p.perkara_id AND x.tanggal_sidang > p.tanggal_sidang AND x.tanggal_sidang < s.tanggal_sidang) GROUP BY s.perkara_id ORDER BY s.perkara_id DESC LIMIT 1" 2>/dev/null | tr -d '\r')
C2=$($SQ -e "SELECT perkara_id FROM perkara_jadwal_sidang GROUP BY perkara_id HAVING COUNT(*) >= 3 ORDER BY perkara_id DESC LIMIT 1" 2>/dev/null | tr -d '\r')
if [ -n "$C1" ]; then
  set -- $C1
  HA=$(kueri_var 2112 "$1")
  case "$HA" in
    [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]*) if [ "$HA" \> "$2" ]; then pulih_sql; gagal "2112 perkara $1 = $HA, lebih lambat dari sidang tundaan Tergugat $2 - dipulihkan; berkas belum disentuh"; fi; echo "UJI contoh 1: perkara $1 tundaan Pembuktian Tergugat -> Tanggal Pembuktian Tergugat $HA (sidang tundaan $2)" ;;
    *) pulih_sql; gagal "2112 tidak menjawab untuk perkara $1 ('${HA:0:150}') - dipulihkan; berkas belum disentuh" ;;
  esac
else
  echo "UJI contoh 1 dilewati: tidak ada perkara dengan tundaan 'Pembuktian Tergugat' lalu sidang beragenda kosong"
fi
if [ -n "$C2" ]; then
  for v in 2111 7119 2112 7121; do
    R=$(kueri_var $v "$C2")
    case "$R" in
      "") ;;
      [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]) ;;
      Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu) ;;
      *) pulih_sql; gagal "variabel $v galat untuk perkara $C2 ('${R:0:150}') - dipulihkan; berkas belum disentuh" ;;
    esac
  done
  echo "UJI contoh 2: perkara $C2 -> keempat variabel menjawab tanpa galat"
else
  echo "UJI contoh 2 dilewati: tidak ada perkara bersidang >= 3"
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
