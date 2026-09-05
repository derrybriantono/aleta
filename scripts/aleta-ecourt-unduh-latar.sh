#!/usr/bin/env bash
# =============================================================================
# Menarik seluruh berkas e-Court di latar belakang.
#
# Dijalankan sekali untuk mengisi arsip dari nol. Setelah arsipnya terisi,
# penarikan berkala di menu Integrasi e-Court yang mengambil alih - skrip ini
# tidak perlu dijalankan lagi kecuali arsipnya perlu diisi ulang.
#
# TETAP BERJALAN SETELAH PUTTY DITUTUP
#
# Perintahnya dijalankan dengan setsid dan nohup, sehingga tidak ikut mati
# ketika sesi SSH terputus. Keluarannya ditulis ke berkas log yang dapat
# diikuti kapan saja.
#
# TIDAK MENGUNDUH ULANG YANG SUDAH ADA
#
# Perkara yang seluruh dokumennya sudah punya berkas dilewati tanpa halamannya
# dibuka sama sekali. Jadi menjalankan skrip ini berkali-kali aman: yang sudah
# lengkap tidak diminta lagi ke server Mahkamah Agung.
#
# SESI HABIS BUKAN KEGAGALAN
#
# Sesi e-Court berumur terbatas, dan penarikan menyeluruh dapat melewatinya.
# Bila itu terjadi, jembatan berhenti sendiri dengan kode 2. Login sekali lagi
# dari portal, lalu jalankan skrip ini lagi - yang sudah terunduh tidak diulang.
# =============================================================================
set -Eeuo pipefail

CONTAINER="${ALETA_BOT_CONTAINER:-aleta-bot}"
LOG_DIR="${ALETA_ECOURT_LOG_DIR:-/var/www/html/aleta-data/reports}"
MAKS="${1:-0}"

log()  { printf '\n\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[!]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[x]\033[0m %s\n' "$*" >&2; exit 1; }

command -v docker >/dev/null 2>&1 || die "Docker tidak ditemukan."
docker inspect "$CONTAINER" >/dev/null 2>&1 || die "Container '$CONTAINER' tidak ada atau tidak berjalan."

mkdir -p "$LOG_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
LOG="$LOG_DIR/ecourt-unduh-$STAMP.log"
PIDFILE="$LOG_DIR/ecourt-unduh.pid"

# Menolak dua penarikan sekaligus. Dua proses yang menarik perkara yang sama
# hanya menggandakan beban di server Mahkamah Agung tanpa mempercepat apa pun.
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE" 2>/dev/null)" 2>/dev/null; then
  die "Penarikan lain masih berjalan (PID $(cat "$PIDFILE")). Hentikan dulu, atau tunggu selesai."
fi

# Penarikan yang dimulai dari portal berjalan DI DALAM container, sehingga
# nomor prosesnya tidak berarti apa-apa di host - PIDFILE di atas tidak dapat
# melihatnya. Bot menandainya dengan berkas kunci berdetak di folder yang sama.
#
# Yang diperiksa waktu detaknya, bukan keberadaan berkasnya: kunci yang
# tertinggal karena bot berhenti mendadak tidak boleh memblokir penarikan
# selamanya.
KUNCI="$LOG_DIR/ecourt-unduh-aleta.lock"
if [ -f "$KUNCI" ]; then
  DETAK="$(sed -n 's/.*"detak":"\([^"]*\)".*//p' "$KUNCI" 2>/dev/null)"
  if [ -n "$DETAK" ]; then
    DETAK_EPOCH="$(date -d "$DETAK" +%s 2>/dev/null || echo 0)"
    SEKARANG="$(date +%s)"
    if [ "$DETAK_EPOCH" -gt 0 ] && [ $((SEKARANG - DETAK_EPOCH)) -lt 180 ]; then
      die "Penarikan dari portal ALETA masih berjalan (detak $DETAK). Pantau dari menu Integrasi e-Court, atau tunggu selesai."
    fi
  fi
fi

ARGS=(--terjadwal)
[ "$MAKS" != "0" ] && ARGS+=(--maks-perkara "$MAKS")

log "Menarik berkas e-Court di latar belakang..."
printf '    Container : %s\n' "$CONTAINER"
printf '    Batas     : %s\n' "$([ "$MAKS" = "0" ] && echo 'seluruh perkara pada acuan SIPP' || echo "$MAKS perkara")"
printf '    Log       : %s\n' "$LOG"

setsid nohup docker exec "$CONTAINER" \
  node tools/ecourt-bridge/run.js "${ARGS[@]}" \
  >>"$LOG" 2>&1 &

echo $! > "$PIDFILE"
sleep 2

if ! kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  warn "Proses tidak bertahan. Periksa lognya:"
  tail -20 "$LOG" 2>/dev/null || true
  rm -f "$PIDFILE"
  exit 1
fi

cat <<SELESAI

  ✅ Penarikan berjalan di latar belakang (PID $(cat "$PIDFILE")).
     PuTTY boleh ditutup sekarang - prosesnya tidak ikut mati.

  Mengikuti jalannya:
     tail -f $LOG

  Melihat ringkasan terakhir:
     grep -A 12 'Ringkasan sinkronisasi' $LOG

  Menghitung berkas yang sudah tersimpan:
     docker exec $CONTAINER node -e "const d=require('./services/botDbService');d.query('SELECT COUNT(*) dokumen, SUM(berkas_pdf IS NOT NULL) pdf, SUM(berkas_word IS NOT NULL) word FROM aleta_bot_ecourt_documents').then(r=>{console.log(r[0]);process.exit(0)})"

  Menghentikan:
     kill \$(cat $PIDFILE)

SELESAI
