#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-w3b-blangko-baru-kuasa-wali" (21 Okt 2026, agen W3b). Dijalankan DI SERVER sebagai root, dari folder paket.
# Isi: 181 variabel baru, 14 menu baru, 274 blangko RTF baru. Hanya MENAMBAH: berkas, folder, variabel dan menu lama tidak diubah; tidak ada berkas yang ditimpa.
# Paket yang harus terpasang lebih dulu: paket gelombang 1 (variabel 4406/4407 U4 dan 9250-9260). PRASYARAT memeriksa semua variabel lama yang dirujuk blangko.
# Urutan: md5 -> PRASYARAT SQL + BERKAS (baca saja) -> CADANGAN (sesudah prasyarat lolos; tidak pernah menimpa cadangan lama)
#         -> PASANG SQL (satu transaksi) -> PERIKSA -> UJI kueri baru atas perkara nyata (baca saja) -> BERKAS (baru + sunting potongan)
#         -> PERIKSA BERKAS. Gagal sesudah PASANG = PULIH otomatis (berkas, folder baru & baris baru dikembalikan).
# Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_w3b ABT_BLANGKO=<_blangko_abt uji> SIPP_DB=sipp_donggala bash pasang-satker.sh
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-w3b-blangko-baru-kuasa-wali
HARAP='0|0|275|0|0'
ULANG='0|181|275|0|14'
CAD="$SINI/cadangan"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt}"
SDB="${SIPP_DB:-SIPP}"
ADB="${ABT_DB:-aps_badilag}"
PY="${PY:-python}"
gagal() { echo "GAGAL: $*"; exit 1; }

md5sum -c MD5SUMS.txt >/dev/null 2>&1 || gagal "isi paket rusak (md5sum -c MD5SUMS.txt) - salin ulang paket dengan scp"
while IFS= read -r f; do
  [ -d "$B/$f" ] || gagal "folder blangko $B/$f tidak ada - TIDAK ada yang diubah"
done < <(grep -v '^#' folder-ada.txt)
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || gagal "sandi DB tidak terbaca dari aleta-bot"
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="mysql -h $H -u root --default-character-set=latin1 $ADB"

# --- 1. PRASYARAT (baca saja) -------------------------------------------------------------------------------------------
p=$($MY -N < "$N-PRASYARAT.sql") || gagal "prasyarat tak terbaca - TIDAK ada yang diubah"
if [ "$p" != "$HARAP" ] && [ "$p" != "$ULANG" ]; then
  gagal "prasyarat '$p' (harus '$HARAP', atau '$ULANG' bila pasang ulang) - TIDAK ada yang diubah. Arti angka: lihat $N-PRASYARAT.sql"
fi
echo "PRASYARAT COCOK ($p)"
if [ "$p" = "$HARAP" ]; then
  while IFS= read -r f; do
    [ -e "$B/$f" ] && gagal "folder baru $B/$f sudah ada padahal paket belum terpasang - TIDAK ada yang diubah"
  done < <(grep -v '^#' folder-baru.txt)
fi
c=$($PY berkas_rtf.py cek "$B"); echo "$c"
[ "$(echo "$c" | tail -1)" = "BERKAS SIAP" ] || gagal "berkas tujuan tidak sesuai - TIDAK ada yang diubah"

# --- 2. CADANGAN (sesudah prasyarat; tidak pernah menimpa cadangan lama) ------------------------------------------------
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
for T in abt_variabel abt_data_teks abt_data_tanggal abt_menu; do
  [ -f "$CAD/$T-sebelum.sql" ] && mv "$CAD/$T-sebelum.sql" "$CAD/$T-sebelum.$(date +%Y%m%d%H%M%S).sql"
  if [ "$T" = abt_menu ]; then W="id IN (240,241,242,243,244,245,246,247,248,249,250,251,252,253)"; else W="no_var IN (3800,3801,3802,3803,3804,3805,3806,3807,3808,3809,3810,3811,3812,3813,3814,3815,3816,3817,3818,3819,3830,3831,3832,3833,3834,3835,3836,3837,3838,3839,3840,3841,3842,3843,3844,3845,3846,3847,3848,3849,3850,3851,3852,3853,3854,3855,3856,3857,3860,3861,3862,3863,3864,3865,3866,3867,3868,3869,3870,3871,3872,3873,3874,3875,3876,3877,3878,3879,3880,3881,3882,3883,3890,3891,3892,3893,3894,3895,3896,3897,3898,3899,3900,3901,3902,3903,3904,3905,3906,3907,3908,3909,3910,3911,3912,3913,3914,3915,3916,3917,3918,3919,3920,3921,3922,3923,3924,3925,3926,3927,3928,3929,3931,3932,3933,3934,3935,3936,3937,3938,3939,3940,3941,3942,3943,3944,3945,3946,3947,3948,3949,3950,3951,3952,3953,3954,3955,3956,3957,3958,3959,3960,3961,3962,3963,3964,3965,3966,3967,3968,3969,3970,3971,3972,3973,3974,3975,3976,3977,3978,3979,3980,3981,3982,3983,3984,3985,3986,3987,3988,3989,3990,3991,3992,3993,3994,3995,3996,3997,3998,3999)"; fi
  mysqldump -h "$H" -u root --default-character-set=latin1 --skip-tz-utc --no-create-info --replace --skip-extended-insert \
    --complete-insert --skip-comments --hex-blob --where="$W" "$ADB" "$T" > "$CAD/$T-sebelum.sql" \
    || gagal "mysqldump $T gagal - TIDAK ada yang diubah"
done
echo "CADANGAN: $CAD (variabel lama bernomor baru: $(grep -c '^REPLACE' "$CAD/abt_variabel-sebelum.sql"); menu: $(grep -c '^REPLACE' "$CAD/abt_menu-sebelum.sql"))"

# --- 3. PASANG SQL + PERIKSA -------------------------------------------------------------------------------------------
$MY < "$N-PASANG.sql" || { $MY -N < "$N-PULIH.sql"; gagal "$N-PASANG.sql gagal (transaksi tidak di-COMMIT) - dipulihkan"; }
$MY -N < "$N-PERIKSA.sql" > "$CAD/periksa-sesudah.txt"
tail -1 "$CAD/periksa-sesudah.txt"
if [ "$(tail -1 "$CAD/periksa-sesudah.txt")" != "SEMUA COCOK" ]; then
  grep -v '	1$' "$CAD/periksa-sesudah.txt"
  $MY -N < "$N-PULIH.sql"
  gagal "PERIKSA tidak cocok - baris baru dihapus; berkas belum disentuh"
fi

# --- 4. UJI kueri baru atas perkara nyata (baca saja) ------------------------------------------------------------------
SQ="mysql -h $H -u root --default-character-set=latin1 $SDB -N"
NU=$(awk -F'\t' '!/^#/ && NF==2' uji-kueri.tsv | wc -l | tr -d ' ')
if [ "$NU" != 0 ]; then
for PID in $($SQ -e "SELECT perkara_id FROM perkara WHERE nomor_perkara IN ('61/Pdt.P/2026/PA.Dgl','85/Pdt.P/2026/PA.Dgl','27/Pdt.P/2025/PA.Dgl','26/Pdt.G/2022/PA.Dgl','715/Pdt.G/2025/PA.Dgl','265/Pdt.G/2024/PA.Dgl')" 2>/dev/null | grep -v NULL | sort -u); do
  if ! sed "s/#perkara_id#/$PID/g" uji-kueri.tsv | awk -F'\t' '!/^#/ && NF==2 {print "SELECT " $1 " AS var, LEFT(REPLACE(IFNULL((SELECT x.data FROM (" $2 ") x LIMIT 1), \"(kosong)\"), CHAR(10), \" \"), 150) AS data;"}' \
       | $SQ > "$CAD/uji-$PID.txt" 2>&1; then
    echo "uji perkara $PID: GALAT $(head -c 300 "$CAD/uji-$PID.txt")"
    $MY -N < "$N-PULIH.sql"
    gagal "kueri variabel baru tidak jalan di server ini - baris baru dihapus; berkas belum disentuh. Kirim $CAD/uji-$PID.txt ke pengembang"
  fi
  [ "$(grep -c . "$CAD/uji-$PID.txt")" = "$NU" ] || { $MY -N < "$N-PULIH.sql"; gagal "uji perkara $PID tidak menjawab $NU baris - dipulihkan"; }
  cut -c1-170 "$CAD/uji-$PID.txt" | sed "s/^/uji perkara $PID: /"
done
fi

# --- 5. FOLDER BARU + BERKAS RTF ---------------------------------------------------------------------------------------
: > "$CAD/folder-dibuat.txt"
while IFS= read -r f; do
  [ -d "$B/$f" ] && { echo "FOLDER SUDAH ADA $f"; continue; }
  if mkdir "$B/$f"; then
    echo "$f" >> "$CAD/folder-dibuat.txt"; echo "FOLDER BARU $f"
    st=$(stat -c '%u:%g' "$(dirname "$B/$f")" 2>/dev/null) && chown "$st" "$B/$f" 2>/dev/null; chmod 755 "$B/$f"
  else
    $MY -N < "$N-PULIH.sql"; gagal "folder $f tidak bisa dibuat - baris baru dihapus"
  fi
done < <(grep -v '^#' folder-baru.txt)
hapus_folder_baru() { while IFS= read -r f; do rmdir "$B/$f" 2>/dev/null; done < "$CAD/folder-dibuat.txt"; }
$PY berkas_rtf.py pasang "$B" "$SINI" "$CAD" | tee "$CAD/berkas-pasang.txt"
if [ "${PIPESTATUS[0]}" != "0" ]; then
  $PY berkas_rtf.py pulih "$B" "$CAD"; hapus_folder_baru
  $MY -N < "$N-PULIH.sql"
  gagal "berkas RTF tidak terpasang - berkas, folder & baris baru dikembalikan (lihat $CAD/berkas-pasang.txt)"
fi
$PY berkas_rtf.py periksa "$B" "$CAD" | tee "$CAD/berkas-periksa.txt"
if [ "$(tail -1 "$CAD/berkas-periksa.txt")" != "BERKAS COCOK" ]; then
  $PY berkas_rtf.py pulih "$B" "$CAD"; hapus_folder_baru
  $MY -N < "$N-PULIH.sql"
  gagal "periksa berkas tidak cocok - berkas, folder & baris baru dikembalikan"
fi
echo "SELESAI - paket $N terpasang. Cadangan: $CAD. Pulih: bash $SINI/pulih-satker.sh"
