#!/bin/bash
# PULIH paket ABT "abt-w3b-blangko-baru-kuasa-wali" (21 Okt 2026, agen W3b) - deterministik: berkas baru dihapus HANYA bila md5-nya masih isi paket, berkas yang
# diganti dikembalikan dari cadangan HANYA bila isinya masih isi paket (yang sudah disunting dibiarkan dan dilaporkan), folder baru
# dihapus HANYA bila kosong, isian nomor baru disalin ke cadangan (FK CASCADE) lalu baris baru dihapus HANYA bila masih isi paket.
# Baris terakhir harus "PULIH COCOK". Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_w3b ABT_BLANGKO=<_blangko_abt uji> bash pulih-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-w3b-blangko-baru-kuasa-wali
CAD="$SINI/cadangan"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt}"
ADB="${ABT_DB:-aps_badilag}"
PY="${PY:-python}"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || { echo "GAGAL: sandi DB tidak terbaca"; exit 1; }
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="mysql -h $H -u root --default-character-set=latin1 $ADB"
mkdir -p "$CAD"
for T in abt_data_teks abt_data_tanggal; do
  mysqldump -h "$H" -u root --default-character-set=latin1 --skip-tz-utc --no-create-info --replace --skip-extended-insert \
    --complete-insert --skip-comments --hex-blob --where="no_var IN (3800,3801,3802,3803,3804,3805,3806,3807,3808,3809,3810,3811,3812,3813,3814,3815,3816,3817,3818,3819,3830,3831,3832,3833,3834,3835,3836,3837,3838,3839,3840,3841,3842,3843,3844,3845,3846,3847,3848,3849,3850,3851,3852,3853,3854,3855,3856,3857,3860,3861,3862,3863,3864,3865,3866,3867,3868,3869,3870,3871,3872,3873,3874,3875,3876,3877,3878,3879,3880,3881,3882,3883,3890,3891,3892,3893,3894,3895,3896,3897,3898,3899,3900,3901,3902,3903,3904,3905,3906,3907,3908,3909,3910,3911,3912,3913,3914,3915,3916,3917,3918,3919,3920,3921,3922,3923,3924,3925,3926,3927,3928,3929,3931,3932,3933,3934,3935,3936,3937,3938,3939,3940,3941,3942,3943,3944,3945,3946,3947,3948,3949,3950,3951,3952,3953,3954,3955,3956,3957,3958,3959,3960,3961,3962,3963,3964,3965,3966,3967,3968,3969,3970,3971,3972,3973,3974,3975,3976,3977,3978,3979,3980,3981,3982,3983,3984,3985,3986,3987,3988,3989,3990,3991,3992,3993,3994,3995,3996,3997,3998,3999)" "$ADB" "$T" > "$CAD/$T-isian-sebelum-pulih.$(date +%Y%m%d%H%M%S).sql" \
    || { echo "GAGAL: isian nomor baru tidak bisa dicadangkan - tidak ada yang dipulihkan"; exit 1; }
done
$PY berkas_rtf.py pulih "$B" "$CAD" || echo "PERINGATAN: sebagian berkas tidak dipulihkan (lihat di atas)"
while IFS= read -r f; do
  [ -d "$B/$f" ] || continue
  rmdir "$B/$f" 2>/dev/null && echo "FOLDER DIHAPUS $f" || echo "PERINGATAN: folder $f tidak kosong, dibiarkan"
done < <(grep -v '^#' folder-baru.txt)
$MY -N < "$N-PULIH.sql" || { echo "GAGAL: PULIH SQL berhenti"; exit 1; }
