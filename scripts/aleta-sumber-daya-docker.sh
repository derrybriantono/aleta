#!/usr/bin/env bash
# ALETA - cuplikan `docker system df` untuk pemantau sumber daya (butir 3, 6 Okt 2026).
#
# Bot tidak memegang soket Docker, jadi ukuran citra dan build cache ALETA
# (di server ini ±110 GB di /home) hanya terlihat dari HOST. Skrip ini menulis
# keluaran `docker system df` ke folder runtime bot; bot membacanya dan
# menyebut umur cuplikannya di Admin > Sumber daya server.
#
# Hanya MEMBACA Docker. Tulisannya satu berkas kecil (atomik: tulis lalu mv).
# Dipanggil di akhir scripts/aleta-update.sh. Agar ikut terbarui di antara
# pembaruan, pasang di cron host (dilakukan pengguna sendiri, sebagai root):
#   echo '*/30 * * * * root /var/www/html/aleta/scripts/aleta-sumber-daya-docker.sh >/dev/null 2>&1' \
#     > /etc/cron.d/aleta-sumber-daya
set -euo pipefail

TUJUAN_DIR="${ALETA_BOT_RUNTIME_DIR:-/var/www/html/aleta-data/aleta-bot-runtime}"
TUJUAN="$TUJUAN_DIR/sumber-daya-docker.json"

command -v docker >/dev/null 2>&1 || { echo "docker tidak ada" >&2; exit 1; }
[ -d "$TUJUAN_DIR" ] || { echo "folder runtime bot tidak ada: $TUJUAN_DIR" >&2; exit 1; }

DF="$(timeout 60 docker system df --format '{{json .}}')"
# Baris JSON dibungkus sebagai satu string JSON: hanya \ dan " yang perlu
# diloloskan, ganti baris menjadi \n.
DF_JSON="$(printf '%s' "$DF" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | awk 'BEGIN{ORS=""} {if (NR>1) print "\\n"; print}')"

SEMENTARA="$(mktemp "$TUJUAN_DIR/.sumber-daya-docker.XXXXXX")"
printf '{"dibuat":"%s","df":"%s"}\n' "$(date -Iseconds)" "$DF_JSON" > "$SEMENTARA"
chmod 644 "$SEMENTARA"
mv -f "$SEMENTARA" "$TUJUAN"
echo "cuplikan docker system df ditulis ke $TUJUAN"
