#!/usr/bin/env bash
# =============================================================================
# Menyinkronkan kendali berkas di latar belakang.
#
# Membaca SIPP untuk mengetahui berkas apa yang SEHARUSNYA ada pada tiap
# perkara, lalu menyandingkannya dengan arsip e-Court ALETA. Hasilnya tersimpan
# di tabel kendali berkas dan langsung terlihat di portal.
#
# TETAP BERJALAN SETELAH PUTTY DITUTUP
#
# Perintahnya dijalankan dengan setsid dan nohup, sehingga tidak ikut mati
# ketika sesi SSH terputus. Keluarannya ditulis ke berkas log yang dapat
# diikuti kapan saja, dan kemajuannya juga terbaca dari portal tanpa SSH.
#
# TIDAK MENYENTUH SIPP SELAIN MEMBACA
#
# Seluruh kueri ke SIPP adalah SELECT. Skrip ini tidak mengubah satu baris pun
# di SIPP, dan tidak mengunduh apa pun dari server Mahkamah Agung - yang
# ditulisnya hanya tabel kendali milik ALETA sendiri.
#
# BEDA DENGAN aleta-ecourt-unduh-latar.sh
#
# Yang itu MENARIK BERKAS dari e-Court. Yang ini hanya MENGHITUNG apa yang
# kurang, tanpa membuka satu halaman pun di e-Court - jadi tidak memerlukan
# sesi login dan tidak dapat kehabisan sesi. Urutan yang lazim: jalankan yang
# ini dulu untuk tahu apa yang kurang, baru tarik berkasnya.
#
# CONTOH
#
#   sudo bash aleta-kendali-berkas.sh                       # seluruh perkara
#   sudo bash aleta-kendali-berkas.sh --sejak 2025-01-01    # sejak tanggal itu
#   sudo bash aleta-kendali-berkas.sh --maks 500            # 500 perkara terbaru
#   sudo bash aleta-kendali-berkas.sh --hanya-ecourt        # perkara e-Court saja
# =============================================================================
set -Eeuo pipefail

CONTAINER="${ALETA_BOT_CONTAINER:-aleta-bot}"
LOG_DIR="${ALETA_ECOURT_LOG_DIR:-/var/www/html/aleta-data/reports}"

log()  { printf '\n\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[!]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[x]\033[0m %s\n' "$*" >&2; exit 1; }

# --- pilihan -----------------------------------------------------------------
SEJAK=""
SAMPAI=""
MAKS=""
HANYA_ECOURT=""

while [ $# -gt 0 ]; do
  case "$1" in
    --sejak)        SEJAK="${2:-}";  shift 2 ;;
    --sampai)       SAMPAI="${2:-}"; shift 2 ;;
    --maks)         MAKS="${2:-}";   shift 2 ;;
    --hanya-ecourt) HANYA_ECOURT="1"; shift ;;
    -h|--help)      sed -n '2,34p' "$0"; exit 0 ;;
    *)              die "Pilihan tidak dikenal: $1 (lihat --help)" ;;
  esac
done

# Tanggal diperiksa di sini juga, bukan hanya di dalam bot. Salah ketik tanggal
# lebih baik ketahuan sebelum prosesnya dilepas ke latar belakang - setelah
# dilepas, kesalahannya baru terbaca dari log.
for T in "$SEJAK" "$SAMPAI"; do
  if [ -n "$T" ] && ! printf '%s' "$T" | grep -qE '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'; then
    die "Tanggal '$T' tidak sah. Bentuknya YYYY-MM-DD."
  fi
done

if [ -n "$MAKS" ] && ! printf '%s' "$MAKS" | grep -qE '^[0-9]+$'; then
  die "Batas '--maks' harus angka."
fi

command -v docker >/dev/null 2>&1 || die "Docker tidak ditemukan."
docker inspect "$CONTAINER" >/dev/null 2>&1 || die "Container '$CONTAINER' tidak ada atau tidak berjalan."

mkdir -p "$LOG_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
LOG="$LOG_DIR/kendali-berkas-$STAMP.log"
PIDFILE="$LOG_DIR/kendali-berkas.pid"

# Menolak dua sinkronisasi sekaligus dari host yang sama.
#
# Penolakan yang sesungguhnya ada di dalam bot - dialah yang tahu sinkronisasi
# dari portal maupun dari host lain. Pemeriksaan di sini hanya supaya kesalahan
# yang paling sering terjadi, yaitu menjalankan skrip ini dua kali, ketahuan
# seketika alih-alih setelah container dihubungi.
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE" 2>/dev/null)" 2>/dev/null; then
  die "Sinkronisasi lain masih berjalan (PID $(cat "$PIDFILE")). Hentikan dulu, atau tunggu selesai."
fi

ARGS=(--oleh "putty:${SUDO_USER:-${USER:-tidak diketahui}}")
[ -n "$SEJAK" ]        && ARGS+=(--sejak "$SEJAK")
[ -n "$SAMPAI" ]       && ARGS+=(--sampai "$SAMPAI")
[ -n "$MAKS" ]         && ARGS+=(--maks "$MAKS")
[ -n "$HANYA_ECOURT" ] && ARGS+=(--hanya-ecourt)

log "Menyinkronkan kendali berkas di latar belakang..."
printf '    Container : %s\n' "$CONTAINER"
printf '    Rentang   : %s s.d. %s\n' "${SEJAK:-tanpa batas awal}" "${SAMPAI:-tanpa batas akhir}"
printf '    Batas     : %s\n' "${MAKS:-seluruh perkara}"
printf '    Saringan  : %s\n' "$([ -n "$HANYA_ECOURT" ] && echo 'hanya perkara e-Court' || echo 'seluruh perkara')"
printf '    Log       : %s\n' "$LOG"

setsid nohup docker exec "$CONTAINER" \
  node scripts/kendali-berkas-sinkron.js "${ARGS[@]}" \
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

  ✅ Sinkronisasi berjalan di latar belakang (PID $(cat "$PIDFILE")).
     PuTTY boleh ditutup sekarang - prosesnya tidak ikut mati.

  Mengikuti jalannya:
     tail -f $LOG

  Melihat ringkasan terakhir:
     grep -A 8 'Ringkasan sinkronisasi kendali berkas' $LOG

  Memantau tanpa SSH:
     Portal ALETA e-Court, menu Kendali Berkas. Kemajuannya berdetak di sana
     walau PuTTY sudah ditutup.

  Melihat perkara yang paling banyak kurang berkasnya:
     docker exec $CONTAINER node -e "require('./services/kendaliBerkasService').daftarKurang({batas:20}).then(r=>{r.forEach(x=>console.log(x.jumlahKurang, x.nomorPerkara));process.exit(0)})"

  Menghentikan:
     kill \$(cat $PIDFILE)

     Kelompok yang sedang berjalan diselesaikan dulu, lalu berhenti rapi -
     baris yang sudah tersimpan tetap tersimpan.

SELESAI
