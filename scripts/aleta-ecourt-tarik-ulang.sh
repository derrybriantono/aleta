#!/usr/bin/env bash
# =============================================================================
# Menarik ULANG seluruh arsip e-Court dari nol, di latar belakang.
#
# Berbeda dengan aleta-ecourt-unduh-latar.sh yang MELENGKAPI arsip yang ada,
# skrip ini MENGHAPUS catatan lama lebih dulu lalu menarik semuanya kembali.
#
# KAPAN INI DIPERLUKAN
#
# Ketika catatan lama sudah tidak dapat dipercaya - misalnya berkasnya tercatat
# ada padahal berkas fisiknya hilang, atau statusnya keliru karena dicatat oleh
# versi ALETA yang lebih tua. Melengkapi tidak menolong dalam keadaan itu:
# perkara yang catatannya "sudah lengkap" justru akan dilewati.
#
# YANG DIHAPUS DAN YANG TIDAK
#
#   Dihapus  : catatan dokumen, catatan berkas, dan riwayat putaran penarikan
#   DIPERTAHANKAN: keputusan verifikasi hakim, konfirmasi nomor pihak, dan
#                  seluruh riwayat pesan WhatsApp
#
# Keputusan verifikasi adalah keputusan hukum yang diambil manusia. Ia tidak
# dapat ditarik ulang dari e-Court, dan menghapusnya berarti menghilangkan
# jejak siapa memutuskan apa. Begitu pula konfirmasi nomor: pihak sudah pernah
# ditanya, dan menanyai mereka lagi hanya karena arsip disusun ulang adalah
# gangguan yang tidak perlu.
#
# BERKAS DI DISK TIDAK IKUT DIHAPUS
#
# Berkas yang sudah terunduh dibiarkan. Penarikan akan menulis ulang yang
# memang berubah, dan menghapus lebih dulu berarti mengunduh ulang gigabita
# yang isinya sama persis - membebani server Mahkamah Agung tanpa alasan.
# =============================================================================
set -Eeuo pipefail

CONTAINER="${ALETA_BOT_CONTAINER:-aleta-bot}"
LOG_DIR="${ALETA_ECOURT_LOG_DIR:-/var/www/html/aleta-data/reports}"

log()  { printf '\n\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[!]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[x]\033[0m %s\n' "$*" >&2; exit 1; }

command -v docker >/dev/null 2>&1 || die "Docker tidak ditemukan."
docker inspect "$CONTAINER" >/dev/null 2>&1 || die "Container '$CONTAINER' tidak ada atau tidak berjalan."

mkdir -p "$LOG_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
LOG="$LOG_DIR/ecourt-tarik-ulang-$STAMP.log"
PIDFILE="$LOG_DIR/ecourt-unduh.pid"

if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE" 2>/dev/null)" 2>/dev/null; then
  die "Penarikan lain masih berjalan (PID $(cat "$PIDFILE")). Hentikan dulu, atau tunggu selesai."
fi

# --- Berapa yang akan dihapus, ditampilkan SEBELUM bertanya ---------------
log "Memeriksa isi arsip sekarang..."
docker exec "$CONTAINER" node -e "
  const d = require('./services/botDbService');
  d.query('SELECT COUNT(*) AS dokumen FROM aleta_bot_ecourt_documents')
    .then(async (r) => {
      const f = await d.query('SELECT COUNT(*) AS berkas FROM aleta_bot_ecourt_files');
      console.log('    Catatan dokumen :', r[0].dokumen);
      console.log('    Catatan berkas  :', f[0].berkas);
      process.exit(0);
    })
    .catch((e) => { console.log('    Tidak dapat dibaca:', e.message); process.exit(0); });
" || warn "Isi arsip tidak dapat dibaca. Lanjutkan hanya bila Anda yakin."

cat <<PERINGATAN

  Yang akan DIHAPUS:
     - Catatan dokumen e-Court
     - Catatan berkas e-Court
     - Riwayat putaran penarikan

  Yang DIPERTAHANKAN:
     - Keputusan verifikasi hakim
     - Konfirmasi nomor pihak
     - Riwayat pesan WhatsApp
     - Berkas yang sudah terunduh di disk

PERINGATAN

printf 'Ketik HAPUS untuk melanjutkan: '
read -r jawab
[ "$jawab" = "HAPUS" ] || die "Dibatalkan. Tidak ada yang dihapus."

log "Menghapus catatan arsip lama..."
docker exec "$CONTAINER" node -e "
  const d = require('./services/botDbService');
  (async () => {
    await d.query('DELETE FROM aleta_bot_ecourt_files');
    await d.query('DELETE FROM aleta_bot_ecourt_documents');
    await d.query('DELETE FROM aleta_bot_ecourt_sync_runs');
    console.log('    Catatan arsip dikosongkan.');
    process.exit(0);
  })().catch((e) => { console.error('    Gagal:', e.message); process.exit(1); });
" || die "Penghapusan gagal. Penarikan TIDAK dijalankan."

log "Menarik seluruh arsip di latar belakang..."
setsid nohup docker exec "$CONTAINER" \
  node tools/ecourt-bridge/run.js --terjadwal \
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

  ✅ Penarikan ulang berjalan di latar belakang (PID $(cat "$PIDFILE")).
     PuTTY boleh ditutup sekarang.

  Mengikuti jalannya:
     tail -f $LOG

  Bila berhenti dengan "sesi e-Court habis": login sekali dari menu
  Integrasi e-Court, lalu jalankan aleta-ecourt-unduh-latar.sh untuk
  melanjutkan - yang sudah terunduh tidak diulang.

SELESAI
