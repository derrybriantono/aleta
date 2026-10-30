#!/usr/bin/env bash
# ============================================================================
# ALETA - ROLLBACK penuh pemindahan data Docker/Postgres (30 Okt 2026)
# ============================================================================
#
# Mengembalikan keadaan sebelum scripts/kapasitas/pindah-data-docker.sh:
#   - daemon.json dipulihkan dari cadangan (atau kunci data-root dibuang bila
#     berkas itu dulu tidak ada);
#   - berkas compose dipulihkan dari cadangannya (volume Postgres kembali);
#   - folder lama *.lama-<tanggal> diberi nama aslinya lagi;
#   - data yang TERTULIS SEJAK pemindahan (di tujuan baru) disalin balik ke
#     lokasi lama dengan rsync, supaya tidak ada perubahan yang hilang;
#   - docker + ALETA dinyalakan dan diverifikasi.
# Data di tujuan baru TIDAK dihapus.
#
# PEMAKAIAN (root):
#   bash scripts/kapasitas/kembalikan-data-docker.sh                 # state terakhir
#   bash scripts/kapasitas/kembalikan-data-docker.sh --state BERKAS  # state tertentu
#   bash scripts/kapasitas/kembalikan-data-docker.sh --ya            # tanpa tanya
#
# Bila folder *.lama sudah dihapus, skrip menyalin SELURUH data dari tujuan
# baru ke lokasi lama (butuh ruang di partisi lama) - jadi rollback tetap
# mungkin, hanya lebih lama.
set -Eeuo pipefail

SKRIP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-kapasitas.sh
. "$SKRIP_DIR/lib-kapasitas.sh"

BERKAS_STATE=""
YA=0
while [ $# -gt 0 ]; do
  case "$1" in
    --state) shift; BERKAS_STATE="${1:-}"; [ -n "$BERKAS_STATE" ] || die "--state butuh berkas" 64 ;;
    --ya) YA=1 ;;
    -h|--bantuan|--help) sed -n '2,26p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) die "Argumen tidak dikenal: $1" 64 ;;
  esac
  shift
done
[ -n "$BERKAS_STATE" ] || BERKAS_STATE="$ALETA_KAPASITAS_DIR/pindah-terakhir.state"
[ -f "$BERKAS_STATE" ] || die "Berkas state tidak ada: $BERKAS_STATE (belum pernah ada pemindahan?)" 66

[ "$(id -u)" -eq 0 ] || die "Jalankan sebagai root." 77
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$ALETA_LAPORAN_DIR" 2>/dev/null || true
LOG="$ALETA_LAPORAN_DIR/kembalikan-docker-$STAMP.log"
exec > >(tee -a "$LOG") 2>&1
echo "Log: $LOG"

# shellcheck disable=SC1090
. "$BERKAS_STATE"
: "${DOCKER_LAMA:?state tidak memuat DOCKER_LAMA (pemindahan belum sampai tahap salin)}"
: "${PG_LAMA:?state tidak memuat PG_LAMA}"
: "${DOCKER_BARU:?state tidak memuat DOCKER_BARU}"
: "${PG_BARU:?state tidak memuat PG_BARU}"
DAEMON_JSON="${DAEMON_JSON:-$ALETA_DAEMON_JSON}"
TAHAP="awal"

saat_galat() {
  local rc=$?
  trap - ERR
  galat "ROLLBACK GAGAL di tahap: $TAHAP (kode $rc). Log: $LOG"
  galat "Data di $DOCKER_BARU dan $PG_BARU TIDAK disentuh. Hubungi pengembang sebelum mengulang."
  exit "$rc"
}
trap saat_galat ERR

log "Rencana rollback"
info "Docker : $DOCKER_BARU  ->  $DOCKER_LAMA"
info "Postgres: $PG_BARU  ->  $PG_LAMA"
info "daemon.json: ${DAEMON_BACKUP:-<dulu tidak ada: kunci data-root dibuang>}"
info "compose    : ${COMPOSE_BACKUP:-<tidak diubah>}"
if [ "$YA" != "1" ]; then
  echo "ALETA akan MATI sementara. Ketik YA untuk melanjutkan:"
  read -r jawab
  [ "$jawab" = "YA" ] || die "Dibatalkan." 1
fi

# ------------------------------------------------------------------ berhenti
TAHAP="menghentikan ALETA dan docker"
log "Menghentikan ALETA dan docker"
if timeout 30 docker info >/dev/null 2>&1; then
  LAYANAN="$(compose config --services 2>/dev/null | grep -v '^postgres$' | tr '\n' ' ' || true)"
  if [ -n "${LAYANAN// /}" ]; then
    # shellcheck disable=SC2086
    compose stop -t 60 $LAYANAN || true
  fi
  compose stop -t 120 postgres || true
fi
systemctl stop docker || true
for i in $(seq 1 30); do pgrep -x dockerd >/dev/null 2>&1 || break; sleep 1; done
if pgrep -x dockerd >/dev/null 2>&1; then die "dockerd belum berhenti." 70; fi

# ------------------------------------------------------- nama asli data lama
TAHAP="memulihkan nama folder lama"
log "Nama folder lama"
pulihkan_nama() {
  local asli="$1" lama="$2"
  if [ -n "$lama" ] && [ -d "$lama" ] && [ ! -e "$asli" ]; then
    mv "$lama" "$asli"
    info "$lama -> $asli"
  elif [ -e "$asli" ]; then
    info "$asli sudah ada; dipakai apa adanya."
  else
    warn "Tidak ada $asli maupun $lama (sudah dihapus?) - akan disalin penuh dari tujuan baru."
    mkdir -p "$asli"
  fi
}
pulihkan_nama "$DOCKER_LAMA" "${LAMA_DOCKER:-}"
pulihkan_nama "$PG_LAMA" "${LAMA_PG:-}"

# --------------------------------------------------- salin balik data terbaru
TAHAP="menyalin balik data terbaru"
log "Menyalin balik perubahan sejak pemindahan (rsync --delete; lokasi lama dibuat sama dengan yang baru)"
SISA_DIBUTUHKAN="$(( $(ukuran_berkas "$DOCKER_BARU") + $(ukuran_berkas "$PG_BARU") ))"
if [ "$(byte_bebas "$DOCKER_LAMA")" -lt "$(( SISA_DIBUTUHKAN / 10 ))" ]; then
  die "Ruang di partisi lama terlalu sedikit untuk menyalin balik (butuh sedikitnya $(manusia "$(( SISA_DIBUTUHKAN / 10 ))"))." 75
fi
rsync -aHAX --numeric-ids --delete --info=stats1 "$DOCKER_BARU"/ "$DOCKER_LAMA"/
rsync -aHAX --numeric-ids --delete --info=stats1 "$PG_BARU"/ "$PG_LAMA"/
verifikasi_salinan() {
  local sisa
  sisa="$(rsync -aHAXn --numeric-ids --itemize-changes "$1"/ "$2"/ | head -n 20 || true)"
  if [ -n "$sisa" ]; then galat "$3: masih ada perbedaan:"; printf '%s\n' "$sisa" | sed 's/^/    /'; return 1; fi
}
verifikasi_salinan "$DOCKER_BARU" "$DOCKER_LAMA" docker-data
verifikasi_salinan "$PG_BARU" "$PG_LAMA" postgres
info "Lokasi lama identik dengan lokasi baru."

# --------------------------------------------------------------- konfigurasi
TAHAP="memulihkan konfigurasi"
log "Memulihkan daemon.json dan compose"
if [ -n "${DAEMON_BACKUP:-}" ] && [ -f "$DAEMON_BACKUP" ]; then
  cp -a "$DAEMON_BACKUP" "$DAEMON_JSON"
  info "daemon.json dipulihkan dari $DAEMON_BACKUP"
elif [ "${DAEMON_ASAL:-}" = "tidak-ada" ]; then
  if [ -f "$DAEMON_JSON" ]; then
    ubah_daemon_json "$DAEMON_JSON" hapus
    info "kunci data-root dibuang dari $DAEMON_JSON"
  fi
else
  die "Cadangan daemon.json ($DAEMON_BACKUP) tidak ditemukan." 66
fi
[ "$(daemon_data_root)" != "$DOCKER_BARU" ] || die "daemon.json masih menunjuk $DOCKER_BARU." 70

IFS=';' read -r -a PASANGAN <<< "${COMPOSE_BACKUP:-}"
for p in "${PASANGAN[@]-}"; do
  [ -n "$p" ] || continue
  f="${p%%=*}"; b="${p#*=}"
  if [ -f "$b" ]; then
    cp -a "$b" "$f"
    info "compose dipulihkan: $f"
  else
    die "Cadangan compose tidak ada: $b" 66
  fi
done
[ "$(jalur_postgres)" = "$PG_LAMA" ] || die "Volume Postgres di compose belum menunjuk $PG_LAMA." 70

# ------------------------------------------------------------------ nyalakan
TAHAP="menyalakan docker dan ALETA"
log "Menyalakan docker dan ALETA dari lokasi lama"
systemctl start docker
tunggu_docker || die "docker tidak menjawab." 70
[ "$(docker_root_sekarang)" = "$DOCKER_LAMA" ] || die "docker memakai data root '$(docker_root_sekarang)', bukan $DOCKER_LAMA." 70
info "docker info data-root: $(docker_root_sekarang)"
compose up -d postgres
for i in $(seq 1 60); do
  docker exec aleta-postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1 && break
  sleep 2
done
docker exec aleta-postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1 || die "Postgres tidak siap." 70
hitung_baris_postgres aleta-postgres > "$ALETA_KAPASITAS_DIR/kembalikan-$STAMP.baris.txt"
info "Baris tabel dicatat: $(wc -l < "$ALETA_KAPASITAS_DIR/kembalikan-$STAMP.baris.txt") tabel"
compose up -d

TAHAP="verifikasi akhir"
log "Verifikasi akhir (maks 3 menit)"
SEHAT=0
for i in $(seq 1 36); do
  gagal=0
  for k in aleta-postgres aleta-portal aleta-bot; do
    s="$(status_kontainer "$k")"
    case "$s" in
      *"running=true"*"restart=0"*) case "$s" in *"sehat=unhealthy"*|*"sehat=starting"*) gagal=1 ;; esac ;;
      *) gagal=1 ;;
    esac
  done
  if [ "$gagal" -eq 0 ]; then SEHAT=1; break; fi
  sleep 5
done
for k in aleta-postgres aleta-portal aleta-bot; do info "$k: $(status_kontainer "$k")"; done
[ "$SEHAT" -eq 1 ] || die "Kontainer belum sehat dengan RestartCount 0." 70
login_portal_ok || die "Login portal tidak menjawab 200." 70

trap - ERR
printf "ROLLBACK_PADA='%s'\n" "$(date -Iseconds)" >> "$BERKAS_STATE"
log "ROLLBACK SELESAI"
info "ALETA kembali berjalan dari $DOCKER_LAMA dan $PG_LAMA."
info "Data di tujuan baru TIDAK dihapus: $DOCKER_BARU dan $PG_BARU."
echo "Hapus sendiri bila sudah tidak diperlukan (hanya Anda yang menghapus permanen)."
