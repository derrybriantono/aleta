#!/bin/bash
# =============================================================================
# PULIH paket ABT "u5-ahli-waris" di SATKER: hapus variabel 4500-4599 dan kembalikan 3 blangko RTF dari cadangan
# yang dibuat pasang-satker.sh.
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
CAD="$(pwd)/cadangan"
B=/var/www/html/aps_badilag/_blangko_abt/derry_briantono/"9 Penetapan Ahli Waris"
F01="$B/[01] [Kabul] PAW - Ahli Waris Anak Kandung (Suami-Istri dan Orang Tua Pewaris Telah Meninggal).rtf"
F01B="$B/[01b] [Kabul] PAW - Susunan Ahli Waris Dinamis (Pasangan, Anak, Ayah, Ibu - Pertimbangan Bagian Otomatis).rtf"
F01C="$B/[01c] [Kabul] PAW - Susunan Ahli Waris Lengkap (Cucu Pengganti, Kakek, Nenek, Saudara Seibu - Aul dan Radd Otomatis).rtf"
[ -s "$CAD/rtf-sebelum-01c.rtf" ] || { echo "GAGAL: cadangan $CAD/rtf-sebelum-01c.rtf tidak ada"; exit 1; }
MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)"; export MYSQL_PWD
MY="mysql -h 127.0.0.1 -u root --default-character-set=latin1 aps_badilag"
$MY < abt-u5-PULIH-HAPUS-BARU.sql || { echo "GAGAL menghapus variabel baru"; exit 1; }
[ -s "$CAD/rtf-sebelum-01.rtf" ] && cat "$CAD/rtf-sebelum-01.rtf" > "$F01"
[ -s "$CAD/rtf-sebelum-01b.rtf" ] && cat "$CAD/rtf-sebelum-01b.rtf" > "$F01B"
[ -s "$CAD/rtf-sebelum-01c.rtf" ] && cat "$CAD/rtf-sebelum-01c.rtf" > "$F01C"
md5sum "$F01" "$F01B" "$F01C"
echo "harus: ed404d72a8f2cb783cd8b897d9730613 / 9438b0c63a8efef348a454475299f655 / 80930f5537a2ccffb82ae8ceae44c35f"
