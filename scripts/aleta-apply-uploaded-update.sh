#!/usr/bin/env bash
# =============================================================================
# Menerapkan paket pembaruan yang DIUNGGAH LEWAT HALAMAN WEB ALETA.
#
#   bash scripts/aleta-apply-uploaded-update.sh            # paket terbaru di inbox
#   bash scripts/aleta-apply-uploaded-update.sh <nama.tar.gz>
#   bash scripts/aleta-apply-uploaded-update.sh --watch    # pantau inbox terus-menerus
#
# LATAR ARSITEKTUR
# Portal berjalan di dalam container dan SENGAJA tidak diberi akses ke folder
# aplikasi maupun socket Docker. Bila diberi, siapa pun yang menembus portal
# langsung menguasai host. Karena itu portal hanya menampung berkas ke
# folder reports yang sudah dimount, lalu skrip inilah — dijalankan di host —
# yang memverifikasi dan menerapkannya.
#
# Skrip ini memverifikasi ulang paket SEBELUM menyentuh apa pun:
#   - checksum SHA256 cocok dengan yang dicatat portal
#   - isi arsip tidak memuat path absolut maupun ../ (path traversal)
#   - struktur paket sesuai (ada folder app/)
# =============================================================================
set -Eeuo pipefail

APP_DIR="${ALETA_APP_DIR:-/var/www/html/aleta}"
INBOX="${ALETA_UPDATE_INBOX:-/var/www/html/aleta-data/reports/updates/inbox}"
PROCESSED="$INBOX/diterapkan"
REJECTED="$INBOX/ditolak"
WATCH_INTERVAL="${ALETA_UPDATE_WATCH_INTERVAL:-30}"

log()  { printf '\n\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[!]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[x]\033[0m %s\n' "$*" >&2; exit 1; }

tolak() {
  local berkas="$1" alasan="$2"
  mkdir -p "$REJECTED"
  mv -f "$berkas" "$REJECTED/" 2>/dev/null || true
  [ -f "$berkas.sha256" ] && mv -f "$berkas.sha256" "$REJECTED/" 2>/dev/null || true
  printf '%s\n' "$(date -Iseconds) DITOLAK $(basename "$berkas"): $alasan" >> "$INBOX/hasil.log"
  die "Paket ditolak: $alasan"
}

periksa_paket() {
  local berkas="$1"
  local nama; nama="$(basename "$berkas")"

  log "Memverifikasi $nama"

  # 1) Checksum harus cocok dengan catatan portal.
  if [ -f "$berkas.sha256" ]; then
    local tercatat aktual
    tercatat="$(awk '{print $1}' < "$berkas.sha256")"
    aktual="$(sha256sum "$berkas" | awk '{print $1}')"
    [ "$tercatat" = "$aktual" ] || tolak "$berkas" "checksum tidak cocok (berkas rusak saat diunggah)"
    echo "    checksum cocok"
  else
    warn "Berkas checksum tidak ada, verifikasi checksum dilewati."
  fi

  # 2) Arsip harus bisa dibaca.
  tar -tzf "$berkas" >/dev/null 2>&1 || tolak "$berkas" "arsip rusak atau bukan tar.gz yang sah"

  # 3) TIDAK boleh ada path absolut atau ../ — ini penjagaan path traversal.
  #    Tanpa ini, arsip jahat bisa menimpa berkas di luar folder aplikasi.
  if tar -tzf "$berkas" | grep -qE '^/|(^|/)\.\.(/|$)'; then
    tolak "$berkas" "arsip memuat path absolut atau ../ (indikasi path traversal)"
  fi
  echo "    tidak ada path berbahaya"

  # 4) Struktur paket harus sesuai installer resmi.
  tar -tzf "$berkas" | grep -qE '(^|/)app/' || tolak "$berkas" "struktur paket tidak dikenali (folder app/ tidak ditemukan)"
  echo "    struktur paket sesuai"
}

terapkan() {
  local berkas="$1"
  local nama; nama="$(basename "$berkas")"

  periksa_paket "$berkas"

  log "Menerapkan $nama"
  # aleta-update.sh sudah menangani backup otomatis dan rebuild container.
  if bash "$APP_DIR/scripts/aleta-update.sh" "$berkas"; then
    mkdir -p "$PROCESSED"
    mv -f "$berkas" "$PROCESSED/"
    [ -f "$berkas.sha256" ] && mv -f "$berkas.sha256" "$PROCESSED/" || true
    printf '%s\n' "$(date -Iseconds) BERHASIL $nama" >> "$INBOX/hasil.log"
    log "Selesai. Paket dipindahkan ke $PROCESSED"
  else
    printf '%s\n' "$(date -Iseconds) GAGAL $nama" >> "$INBOX/hasil.log"
    die "Penerapan gagal. Paket dibiarkan di inbox untuk diperiksa."
  fi
}

paket_terbaru() {
  ls -1t "$INBOX"/*.tar.gz 2>/dev/null | head -1 || true
}

[ -d "$APP_DIR" ] || die "Folder aplikasi tidak ditemukan: $APP_DIR"
mkdir -p "$INBOX"

if [ "${1:-}" = "--watch" ]; then
  log "Memantau $INBOX setiap ${WATCH_INTERVAL}s. Tekan Ctrl+C untuk berhenti."
  while true; do
    berkas="$(paket_terbaru)"
    if [ -n "$berkas" ]; then
      terapkan "$berkas" || warn "Penerapan gagal, menunggu paket berikutnya."
    fi
    sleep "$WATCH_INTERVAL"
  done
fi

if [ -n "${1:-}" ]; then
  target="$INBOX/$(basename "$1")"
  [ -f "$target" ] || die "Paket tidak ditemukan di inbox: $target"
  terapkan "$target"
  exit 0
fi

berkas="$(paket_terbaru)"
[ -n "$berkas" ] || die "Tidak ada paket .tar.gz di $INBOX. Unggah dulu lewat halaman Pembaruan Sistem."
terapkan "$berkas"
