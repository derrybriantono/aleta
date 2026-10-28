#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-romawi-pihak-28okt" (28 Okt 2026). Dijalankan DI SERVER sebagai root, dari folder paket.
# Isi: 7 variabel sampul pihak banyak (nomor-ubah.txt) menghitung angka romawi pihak dari PERINGKAT pihak (isian_rtf_pihak_peringkat + isian_rtf_romawi, keduanya sudah
#      ada di server), bukan dari nilai kolom `urutan` (perkara e-Court menomori urutan bersambung). Tidak ada fungsi baru, tidak ada blangko yang disentuh.
# Prasyarat: paket abt-pihak-urut-ecourt-27okt dan abt-pihak-urut-sisa-28okt sudah terpasang (diperiksa PRASYARAT).
# Urutan: md5 paket -> PRASYARAT (baca saja) -> CADANGAN baris variabel -> PASANG SQL (satu transaksi) -> PERIKSA -> UJI atas data nyata (baca saja).
#         Gagal di tengah = PULIH otomatis.
# Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_rm1 SIPP_DB=sipp_donggala bash pasang-satker.sh
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-romawi-pihak-28okt
HARAP=$(sed -n 1p harap.txt)
ULANG=$(sed -n 2p harap.txt)
NU=$(tr ',' '\n' < nomor-ubah.txt | grep -c .)
CAD="$SINI/cadangan"
SDB="${SIPP_DB:-SIPP}"
ADB="${ABT_DB:-aps_badilag}"
gagal() { echo "GAGAL: $*"; exit 1; }
pulih() { echo "... memulihkan"; ABT_DB="$ADB" SIPP_DB="$SDB" bash "$SINI/pulih-satker.sh" 2>&1 | tail -6; }

md5sum -c MD5SUMS.txt >/dev/null 2>&1 || gagal "isi paket rusak (md5sum -c MD5SUMS.txt) - salin ulang paket dengan scp, bukan editor"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || gagal "sandi DB tidak terbaca dari aleta-bot"
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="mysql -h $H -u root --default-character-set=latin1 $ADB"
myn() { $MY -N "$@" | tr -d '\r'; }
NOMOR_UBAH=$(cat nomor-ubah.txt)
# definisi fungsi di basis uji laptop memuat nama basis SIPP uji; md5 server dihitung atas nama "SIPP" - samakan dulu
sqlm() { if [ "$SDB" = SIPP ]; then cat "$1"; else sed "s/MD5(routine_definition)/MD5(REPLACE(routine_definition, '$SDB.', 'SIPP.'))/g" "$1"; fi; }
set -o pipefail

# --- 1. PRASYARAT (baca saja) -------------------------------------------------------------------------------------------
p=$(sqlm "$N-PRASYARAT.sql" | $MY -N | tr -d '\r') || gagal "prasyarat tak terbaca - TIDAK ada yang diubah"
if [ "$p" != "$HARAP" ] && [ "$p" != "$ULANG" ]; then
  gagal "prasyarat '$p' (harus '$HARAP', atau '$ULANG' bila pasang ulang) - TIDAK ada yang diubah. Arti angka: lihat $N-PRASYARAT.sql"
fi
echo "PRASYARAT COCOK ($p)"
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"

# --- 2. CADANGAN (hanya saat pertama; pasang ulang TIDAK menimpa cadangan isi lama) ----------------------------------------
if [ "$p" = "$HARAP" ]; then
  [ -f "$CAD/abt_variabel-sebelum.sql" ] && mv "$CAD/abt_variabel-sebelum.sql" "$CAD/abt_variabel-sebelum.$(date +%Y%m%d%H%M%S).sql"
  mysqldump -h "$H" -u root --default-character-set=latin1 --skip-tz-utc --no-create-info --replace --skip-extended-insert \
    --complete-insert --skip-comments --hex-blob --where="no_var IN ($NOMOR_UBAH)" "$ADB" abt_variabel > "$CAD/abt_variabel-sebelum.sql" \
    || gagal "mysqldump abt_variabel gagal - TIDAK ada yang diubah"
  nlama=$(grep -c '^REPLACE' "$CAD/abt_variabel-sebelum.sql")
  [ "$nlama" = "$NU" ] || gagal "cadangan memuat $nlama baris (harus $NU) - TIDAK ada yang diubah"
  echo "CADANGAN: $CAD/abt_variabel-sebelum.sql ($nlama baris lama)"
  # --- 3. PASANG SQL ----------------------------------------------------------------------------------------------------
  $MY < "$N-PASANG.sql" || { pulih; gagal "$N-PASANG.sql gagal (transaksi tidak di-COMMIT) - dipulihkan"; }
else
  [ -f "$CAD/abt_variabel-sebelum.sql" ] || echo "PERINGATAN: paket sudah terpasang tetapi $CAD/abt_variabel-sebelum.sql tidak ada - PULIH tidak dapat mengembalikan isi lama (ambil dari cadangan DB harian)"
  echo "PASANG ULANG: cadangan isi lama dibiarkan"
fi

# --- 4. PERIKSA ----------------------------------------------------------------------------------------------------------------
sqlm "$N-PERIKSA.sql" | $MY -N 2>&1 | tr -d '\r' > "$CAD/periksa-sesudah.txt"
tail -1 "$CAD/periksa-sesudah.txt"
if [ "$(tail -1 "$CAD/periksa-sesudah.txt")" != "SEMUA COCOK" ]; then
  grep -v '	1$' "$CAD/periksa-sesudah.txt" | head -20
  [ "$p" = "$HARAP" ] && pulih
  gagal "PERIKSA tidak cocok$([ "$p" = "$HARAP" ] && echo ' - dipulihkan')"
fi

# --- 5. UJI atas data nyata (baca saja) -----------------------------------------------------------------------------------------
SQ="mysql -h $H -u root --default-character-set=latin1 $SDB -N"
batal() { [ "$p" = "$HARAP" ] && pulih; gagal "$1$([ "$p" = "$HARAP" ] && echo ' - dipulihkan')"; }
nomor_ke_pid() { $SQ -e "SELECT perkara_id FROM perkara WHERE nomor_perkara IN ('$(tr '\n' ',' < "$1" | sed "s/,\$//; s/,/','/g")')" 2>/dev/null | tr -d '\r' | grep -v NULL | sort -u; }
jalan() { # jalan <LAMA|BARU> <pid> : keluaran ke $CAD/uji-<sisi>-<pid>.out/.err, mencetak jumlah galat
  ( echo "SET @pid = $2;"; sed "s/aps_badilag\\./$ADB./g" "$N-UJIVAR-$1.sql" ) | timeout 300 mysql -h "$H" -u root --default-character-set=latin1 --force "$SDB" -N > "$CAD/uji-$1-$2.out" 2> "$CAD/uji-$1-$2.err"
  grep -c '^ERROR' "$CAD/uji-$1-$2.err"
}
galat=0; adaRapat=0; baris=0
# (a) perkara berurutan RAPAT (pihak mulai 1, tanpa lubang, tanpa kembar): keluaran kueri BARU HARUS sama persis dengan kueri LAMA
for PID in $(nomor_ke_pid perkara-rapat.txt); do
  gl=$(jalan LAMA $PID); gb=$(jalan BARU $PID)
  n=$(grep -c . "$CAD/uji-BARU-$PID.out")
  if cmp -s "$CAD/uji-LAMA-$PID.out" "$CAD/uji-BARU-$PID.out" && [ "$gl" = 0 ] && [ "$gb" = 0 ]; then st="SAMA"; else st="BEDA"; galat=$((galat + 1)); head -3 "$CAD/uji-BARU-$PID.err"; fi
  echo "UJI rapat perkara $PID: $n baris, kueri lama dan baru $st ($gl/$gb galat)"
  adaRapat=$((adaRapat + 1)); baris=$((baris + n))
done
[ "$adaRapat" -ge 1 ] && [ "$baris" -ge 1 ] || batal "tidak ada perkara contoh rapat yang menghasilkan baris (periksa perkara-rapat.txt)"
[ "$galat" = 0 ] || batal "keluaran kueri baru BEDA dari lama pada perkara berurutan rapat (harus sama persis)"
# (a2) perkara rapat tetapi pihak I LEBIH DARI 20 (32 Pemohon): satu-satunya selisih yang dirancang ada di variabel 5896 (romawi jumlah pihak, dulu terpotong "XX")
for PID in $(nomor_ke_pid perkara-banyak.txt); do
  gl=$(jalan LAMA $PID); gb=$(jalan BARU $PID)
  vb=$(diff "$CAD/uji-LAMA-$PID.out" "$CAD/uji-BARU-$PID.out" | grep '^[<>]' | cut -c3- | cut -f1 | sort -u | tr '\n' ' ')
  if [ "$vb" = "5896 " ] && [ "$gl" = 0 ] && [ "$gb" = 0 ]; then st="OK"; else st="SALAH"; galat=$((galat + 1)); head -3 "$CAD/uji-BARU-$PID.err"; fi
  echo "UJI pihak > 20 perkara $PID: variabel yang berubah dari lama: ${vb:-tidak ada}(harus 5896 saja) $st ($gl/$gb galat)"
  [ "$st" = OK ] && echo "   5896 baru: $(awk -F'\t' '$1 == 5896 { print $2 }' "$CAD/uji-BARU-$PID.out")"
done
[ "$galat" = 0 ] || batal "perkara pihak > 20: selisih bukan hanya variabel 5896"
# (b) perkara TAK rapat (urutan bersambung e-Court): kueri baru berjalan tanpa galat; jumlah baris yang berubah dilaporkan
for PID in $(nomor_ke_pid perkara-takrapat.txt); do
  gl=$(jalan LAMA $PID); gb=$(jalan BARU $PID)
  nb=$(grep -c . "$CAD/uji-BARU-$PID.out")
  nd=$(diff "$CAD/uji-LAMA-$PID.out" "$CAD/uji-BARU-$PID.out" | grep -c '^>')
  echo "UJI tak rapat perkara $PID: $nb baris baru, $nd berubah dari lama, $gb galat"
  [ "$gb" = 0 ] || { head -3 "$CAD/uji-BARU-$PID.err"; galat=$((galat + 1)); }
done
[ "$galat" = 0 ] || batal "kueri baru berhenti dengan galat atas perkara tak rapat"
touch "$CAD/pasang.selesai"
echo "SELESAI - paket $N terpasang. Cadangan: $CAD. Pulih: bash $SINI/pulih-satker.sh"
