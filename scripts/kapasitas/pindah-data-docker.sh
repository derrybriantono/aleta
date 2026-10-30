#!/usr/bin/env bash
# ============================================================================
# ALETA - pindahkan data Docker dan Postgres ke partisi yang besar (30 Okt 2026)
# ============================================================================
#
# MASALAH: /home (200 GB) memuat data root Docker (/home/docker-data) DAN
# Postgres portal (/home/aleta-data/postgres). Ia penuh berulang kali (100% 28
# Agu, 95% 2 Okt, 100% 20 Okt) oleh cache build, sementara / (715 GB) hampir
# kosong. Skrip ini memindahkan keduanya ke TUJUAN (mis. /aleta-docker di
# partisi /) lalu memverifikasinya. Data lama TIDAK dihapus.
#
# PEMAKAIAN (jalankan sebagai root di server, lewat `ssh aleta`):
#
#   bash scripts/kapasitas/pindah-data-docker.sh                       # = --periksa
#   bash scripts/kapasitas/pindah-data-docker.sh --periksa             # hanya laporan
#   bash scripts/kapasitas/pindah-data-docker.sh --jalankan /aleta-docker [--ya]
#
#   --periksa           (bawaan) laporan saja: lsblk, df, letak data, ukuran,
#                       disk kosong, saran tujuan. TANPA ubahan apa pun.
#   --jalankan TUJUAN   pindahkan. Tanpa --ya meminta ketikan "YA" dulu.
#                       Waktu henti: ALETA mati selama salinan (± 1-3 menit per
#                       10 GB; lihat docs/kapasitas-penyimpanan.md).
#
# YANG DIKERJAKAN --jalankan (berhenti di galat pertama, semua ke log):
#   1 laporan awal           2 cek ruang tujuan >= 1,5x ukuran data
#   3 cadangan DB (wajib)    4 hentikan ALETA lalu docker
#   5 rsync -aHAX            6 verifikasi salinan (uji rsync kering + hitung berkas)
#   7 ubah daemon.json (data-root) dan volume Postgres di compose (dicadangkan)
#   8 nyalakan docker + ALETA, verifikasi (data-root, kontainer, login, baris tabel)
#   9 ganti nama data lama menjadi *.lama-<tanggal> (TIDAK dihapus)
#
# ROLLBACK PENUH: scripts/kapasitas/kembalikan-data-docker.sh
#
# YANG TIDAK PERNAH DILAKUKAN: memformat, memartisi, menghapus data permanen.
# Disk kosong hanya DILAPORKAN beserta petunjuknya.
#
# Variabel: ALETA_APP_DIR (/var/www/html/aleta), ALETA_DATA_DIR
# (/var/www/html/aleta-data), ALETA_DAEMON_JSON (/etc/docker/daemon.json),
# ALETA_IZINKAN_PARTISI_SAMA=1 (hanya untuk uji), ALETA_FAKTOR_RUANG (1.5).
set -Eeuo pipefail

SKRIP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-kapasitas.sh
. "$SKRIP_DIR/lib-kapasitas.sh"

MODE="periksa"
TUJUAN=""
YA=0
while [ $# -gt 0 ]; do
  case "$1" in
    --periksa) MODE="periksa" ;;
    --jalankan)
      MODE="jalankan"
      shift
      TUJUAN="${1:-}"
      [ -n "$TUJUAN" ] || die "--jalankan butuh jalur TUJUAN, mis. --jalankan /aleta-docker" 64
      ;;
    --ya) YA=1 ;;
    -h|--bantuan|--help) sed -n '2,38p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) die "Argumen tidak dikenal: $1 (lihat --bantuan)" 64 ;;
  esac
  shift
done
TUJUAN="${TUJUAN%/}"

FAKTOR_RUANG="${ALETA_FAKTOR_RUANG:-1.5}"
STAMP="$(date +%Y%m%d-%H%M%S)"
TANGGAL="$(date +%Y%m%d)"
mkdir -p "$ALETA_KAPASITAS_DIR" 2>/dev/null || true
LOG="$ALETA_LAPORAN_DIR/pindah-docker-$STAMP.log"
mkdir -p "$ALETA_LAPORAN_DIR" 2>/dev/null || true
exec > >(tee -a "$LOG") 2>&1
echo "Log: $LOG"

[ "$(id -u)" -eq 0 ] || die "Jalankan sebagai root." 77
command -v docker >/dev/null 2>&1 || die "docker tidak terpasang." 69

# ---------------------------------------------------------------- mode periksa
if [ "$MODE" = "periksa" ]; then
  laporan_penyimpanan
  log "Selesai (mode --periksa: tidak ada yang diubah)"
  info "Untuk memindahkan:  bash $0 --jalankan <TUJUAN>   (kebijakan: izin pengguna dulu)"
  exit 0
fi

# ------------------------------------------------------------- mode jalankan
TAHAP="awal"
LAYANAN_DIHENTIKAN=0
KONFIG_DIUBAH=0
STATE="$ALETA_KAPASITAS_DIR/pindah-$STAMP.state"

simpan_state() {
  # KEY='nilai' - dapat di-source kembalikan-data-docker.sh. Nilai tanpa tanda kutip tunggal.
  printf "%s='%s'\n" "$1" "$2" >> "$STATE"
  cp -f "$STATE" "$ALETA_KAPASITAS_DIR/pindah-terakhir.state"
}

saat_galat() {
  local rc=$?
  trap - ERR
  galat "GAGAL di tahap: $TAHAP (kode $rc). Log: $LOG"
  if [ "$LAYANAN_DIHENTIKAN" = "1" ] && [ "$KONFIG_DIUBAH" = "0" ]; then
    warn "Konfigurasi belum diubah - menyalakan docker dan ALETA kembali dari lokasi LAMA."
    if systemctl start docker && tunggu_docker && compose up -d; then
      info "ALETA dinyalakan kembali dari lokasi lama. Periksa: docker ps"
    else
      galat "Penyalaan kembali otomatis gagal. Nyalakan manual: systemctl start docker && cd $ALETA_APP_DIR && docker compose up -d"
    fi
  elif [ "$KONFIG_DIUBAH" = "1" ]; then
    warn "Konfigurasi SUDAH diubah. Kembalikan ke keadaan semula dengan:"
    warn "  bash $SKRIP_DIR/kembalikan-data-docker.sh"
  fi
  exit "$rc"
}
trap saat_galat ERR

# Lanjutkan proses yang terputus (tujuan sama, belum SELESAI): pakai STAMP,
# cadangan, dan letak lama yang SUDAH tercatat, supaya daemon.json yang sudah
# diubah tidak dicadangkan sebagai "asli" dan letak lama tidak salah dibaca.
LANJUT=0
TERAKHIR="$ALETA_KAPASITAS_DIR/pindah-terakhir.state"
DAEMON_BACKUP=""; DAEMON_ASAL=""; COMPOSE_BACKUP=""; ASAL_DOCKER=""; ASAL_PG=""; FASE=""; SEBELUM=""
if [ -f "$TERAKHIR" ]; then
  (
    # shellcheck disable=SC1090
    . "$TERAKHIR"
    [ "${DEST:-}" = "$TUJUAN" ] && [ "${SELESAI:-0}" != "1" ] && [ -n "${STAMP_ASAL:-}" ]
  ) && LANJUT=1
fi
if [ "$LANJUT" = "1" ]; then
  # shellcheck disable=SC1090
  . "$TERAKHIR"
  STAMP_BARU="$STAMP"
  STAMP="$STAMP_ASAL"
  STATE="$ALETA_KAPASITAS_DIR/pindah-$STAMP.state"
  ASAL_DOCKER="${DOCKER_LAMA:-}"
  ASAL_PG="${PG_LAMA:-}"
  info "Melanjutkan proses yang terputus ($STAMP, fase '${FASE:-awal}'); log baru $STAMP_BARU."
fi
DEST="$TUJUAN"
if [ "$LANJUT" = "0" ]; then
  : > "$STATE"
  simpan_state STAMP_ASAL "$STAMP"
  simpan_state DEST "$DEST"
fi
simpan_state SELESAI 0

# ---------------------------------------------------------------- pra-syarat
TAHAP="pra-syarat"
log "Pra-syarat"
for alat in rsync python curl awk sed find df tee timeout; do
  if [ "$alat" = "python" ]; then
    [ -n "$(python_bin)" ] || die "python tidak ada (dipakai menggabung daemon.json)." 69
  else
    command -v "$alat" >/dev/null 2>&1 || die "$alat tidak ada. Untuk rsync: yum install -y rsync" 69
  fi
done
case "$DEST" in
  /*) ;;
  *) die "TUJUAN harus jalur mutlak (diawali /): $DEST" 64 ;;
esac
if ! printf '%s' "$DEST" | grep -Eq '^/[A-Za-z0-9._/-]+$'; then
  die "TUJUAN hanya boleh huruf, angka, titik, garis bawah, garis miring, strip: $DEST" 64
fi
[ "$DEST" != "/" ] || die "TUJUAN tidak boleh /" 64

if docker_unit_memaksa_root >/dev/null; then
  galat "Unit/konfigurasi docker memaksa data root lewat argumen; daemon.json akan bentrok:"
  docker_unit_memaksa_root | sed 's/^/    /'
  die "Hapus argumen --graph/--data-root/-g dari unit docker lebih dulu (dikerjakan Anda), lalu ulangi." 78
fi

DOCKER_LAMA="$(docker_root_sekarang)"
[ -n "$DOCKER_LAMA" ] || DOCKER_LAMA="$(daemon_data_root)"
[ -n "$DOCKER_LAMA" ] || DOCKER_LAMA="$ALETA_DOCKER_ROOT_LAMA"
PG_LAMA="$(jalur_postgres)"
[ -n "$PG_LAMA" ] || PG_LAMA="$ALETA_PG_LAMA"
[ -z "$ASAL_DOCKER" ] || DOCKER_LAMA="$ASAL_DOCKER"
[ -z "$ASAL_PG" ] || PG_LAMA="$ASAL_PG"
for j in "$DOCKER_LAMA" "$PG_LAMA"; do
  printf '%s' "$j" | grep -Eq '^/[A-Za-z0-9._/-]+$' || die "Jalur data lama memuat karakter tak aman: $j" 64
done
DOCKER_BARU="$DEST/docker-data"
PG_BARU="$DEST/postgres"

# Sudah selesai sebelumnya? (idempoten)
if [ "$DOCKER_LAMA" = "$DOCKER_BARU" ] && [ "$PG_LAMA" = "$PG_BARU" ]; then
  log "Sudah berada di $DEST - tidak ada yang dipindah"
  info "Data root Docker: $DOCKER_LAMA"
  info "Postgres        : $PG_LAMA"
  info "Memeriksa kontainer saja:"
  for k in aleta-postgres aleta-portal aleta-bot; do info "$k: $(status_kontainer "$k")"; done
  login_portal_ok || warn "Login portal tidak menjawab 200."
  trap - ERR
  exit 0
fi

[ -d "$DOCKER_LAMA" ] || die "Data root Docker lama tidak ada: $DOCKER_LAMA" 66
[ -d "$PG_LAMA" ] || die "Folder Postgres lama tidak ada: $PG_LAMA (compose: $(berkas_compose | tr '\n' ' '))" 66
case "$DEST/" in "$DOCKER_LAMA"/*|"$PG_LAMA"/*) die "TUJUAN berada di dalam data lama." 64 ;; esac
case "$DOCKER_LAMA/" in "$DEST"/*) die "Data lama berada di dalam TUJUAN." 64 ;; esac

mkdir -p "$DEST"
P_LAMA="$(perangkat_dari "$DOCKER_LAMA")"
P_BARU="$(perangkat_dari "$DEST")"
if [ "$P_LAMA" = "$P_BARU" ] && [ "${ALETA_IZINKAN_PARTISI_SAMA:-0}" != "1" ]; then
  die "TUJUAN ($DEST) berada di partisi yang SAMA dengan data lama ($P_LAMA). Memindahkan tidak menambah ruang." 78
fi

ALETA_LAPORAN_CEPAT=1 laporan_penyimpanan

# ---------------------------------------------------------------- cek ruang
TAHAP="cek ruang tujuan"
log "Cek ruang tujuan (butuh >= ${FAKTOR_RUANG}x ukuran data)"
U_DOCKER="$(ukuran_berkas "$DOCKER_LAMA")"
U_PG="$(ukuran_berkas "$PG_LAMA")"
SUDAH_ADA="$(( $(ukuran_berkas "$DOCKER_BARU") + $(ukuran_berkas "$PG_BARU") ))"
BUTUH="$(awk -v a="$U_DOCKER" -v b="$U_PG" -v f="$FAKTOR_RUANG" -v s="$SUDAH_ADA" 'BEGIN { x = (a + b) * f - s; if (x < 0) x = 0; printf "%d", x }')"
BEBAS="$(byte_bebas "$DEST")"
info "Data    : $(manusia "$((U_DOCKER + U_PG))") (Docker $(manusia "$U_DOCKER") + Postgres $(manusia "$U_PG"))"
info "Butuh   : $(manusia "$BUTUH") bebas di $(titik_pasang "$DEST") (sudah tersalin sebelumnya: $(manusia "$SUDAH_ADA"))"
info "Tersedia: $(manusia "$BEBAS")"
[ "$BEBAS" -ge "$BUTUH" ] || die "Ruang di tujuan tidak cukup." 75

if [ "$YA" != "1" ]; then
  echo
  echo "AKAN DIPINDAHKAN:  $DOCKER_LAMA -> $DOCKER_BARU"
  echo "                   $PG_LAMA -> $PG_BARU"
  echo "ALETA akan MATI sementara selama penyalinan. Ketik YA untuk melanjutkan:"
  read -r jawab
  [ "$jawab" = "YA" ] || die "Dibatalkan." 1
fi

# ------------------------------------------------------------- cadangan DB
if [ -z "$FASE" ]; then
TAHAP="cadangan database"
log "Cadangan database (wajib berhasil)"
[ "$(docker inspect -f '{{.State.Running}}' aleta-postgres 2>/dev/null || true)" = "true" ] \
  || die "Kontainer aleta-postgres tidak berjalan; cadangan tidak dapat dibuat." 69
if [ -f /root/cadangan-db.sh ]; then
  info "Menjalankan /root/cadangan-db.sh"
  bash /root/cadangan-db.sh
else
  CAD_DIR="$(dirname "$ALETA_APP_DIR")/aleta-backups"
  mkdir -p "$CAD_DIR"
  CAD="$CAD_DIR/pindah-docker-$STAMP-postgres.sql.gz"
  info "/root/cadangan-db.sh tidak ada; membuat pg_dumpall ke $CAD"
  docker exec aleta-postgres sh -c 'pg_dumpall -U "$POSTGRES_USER"' | gzip > "$CAD"
  gzip -t "$CAD"
  [ "$(stat -c %s "$CAD")" -gt 1024 ] || die "Cadangan terlalu kecil: $CAD" 66
  info "Cadangan: $CAD ($(manusia "$(stat -c %s "$CAD")"))"
  simpan_state CADANGAN_DB "$CAD"
fi

# ----------------------------------------------------------------- berhenti
TAHAP="menghentikan ALETA dan docker"
log "Menghentikan ALETA (kecuali Postgres), menghitung baris, lalu Postgres dan docker"
LAYANAN_DIHENTIKAN=1
LAYANAN="$(compose config --services 2>/dev/null | grep -v '^postgres$' | tr '\n' ' ' || true)"
if [ -n "${LAYANAN// /}" ]; then
  # shellcheck disable=SC2086
  compose stop -t 60 $LAYANAN
fi
SEBELUM="$ALETA_KAPASITAS_DIR/pindah-$STAMP.baris-sebelum.txt"
hitung_baris_postgres aleta-postgres > "$SEBELUM"
[ -s "$SEBELUM" ] || die "Penghitungan baris tabel Postgres kosong; dibatalkan sebelum menyalin." 70
info "Baris tabel dicatat: $(wc -l < "$SEBELUM") tabel -> $SEBELUM"
compose stop -t 120 postgres
systemctl stop docker
for i in $(seq 1 30); do pgrep -x dockerd >/dev/null 2>&1 || break; sleep 1; done
if pgrep -x dockerd >/dev/null 2>&1; then die "dockerd belum berhenti." 70; fi
info "docker berhenti."
simpan_state SEBELUM "$SEBELUM"
simpan_state FASE berhenti
FASE="berhenti"
else
  log "Dilanjutkan: cadangan dan penghentian sudah dikerjakan (fase $FASE)"
  [ -s "$SEBELUM" ] || die "Catatan baris sebelum pemindahan tidak ada: $SEBELUM" 70
  LAYANAN_DIHENTIKAN=1
  systemctl stop docker 2>/dev/null || true
fi

# -------------------------------------------------------------------- salin
TAHAP="rsync"
log "Menyalin dengan rsync -aHAX (ini bagian yang lama)"
if [ "$(command -v getenforce >/dev/null 2>&1 && getenforce || echo Disabled)" = "Enforcing" ]; then
  warn "SELinux Enforcing: label dibawa oleh -X; setelah selesai diperiksa dengan ls -Zd."
fi
mkdir -p "$DOCKER_BARU" "$PG_BARU"
rsync -aHAX --numeric-ids --info=stats1 "$DOCKER_LAMA"/ "$DOCKER_BARU"/
rsync -aHAX --numeric-ids --info=stats1 "$PG_LAMA"/ "$PG_BARU"/
simpan_state DOCKER_LAMA "$DOCKER_LAMA"
simpan_state PG_LAMA "$PG_LAMA"
simpan_state DOCKER_BARU "$DOCKER_BARU"
simpan_state PG_BARU "$PG_BARU"

TAHAP="verifikasi salinan"
log "Verifikasi salinan"
verifikasi_salinan() {
  local lama="$1" baru="$2" nama="$3" sisa n1 n2 b1 b2
  sisa="$(rsync -aHAXn --numeric-ids --itemize-changes "$lama"/ "$baru"/ | head -n 20 || true)"
  if [ -n "$sisa" ]; then galat "$nama: rsync kering masih melihat perbedaan:"; printf '%s\n' "$sisa" | sed 's/^/    /'; return 1; fi
  n1="$(jumlah_entri "$lama")"; n2="$(jumlah_entri "$baru")"
  b1="$(ukuran_berkas "$lama")"; b2="$(ukuran_berkas "$baru")"
  info "$nama: entri $n1 / $n2, ukuran berkas $(manusia "$b1") / $(manusia "$b2")"
  [ "$n1" = "$n2" ] && [ "$b1" = "$b2" ]
}
verifikasi_salinan "$DOCKER_LAMA" "$DOCKER_BARU" "docker-data"
verifikasi_salinan "$PG_LAMA" "$PG_BARU" "postgres"
info "Salinan identik."
simpan_state FASE salin

# -------------------------------------------------------------- konfigurasi
TAHAP="mengubah konfigurasi"
log "Mengubah daemon.json dan compose (dengan cadangan)"
if [ -z "$DAEMON_BACKUP" ]; then
  if [ -f "$ALETA_DAEMON_JSON" ]; then
    DAEMON_BACKUP="$ALETA_DAEMON_JSON.bak-pindah-$STAMP"
    cp -a "$ALETA_DAEMON_JSON" "$DAEMON_BACKUP"
    DAEMON_ASAL="ada"
  else
    DAEMON_BACKUP=""
    DAEMON_ASAL="tidak-ada"
    mkdir -p "$(dirname "$ALETA_DAEMON_JSON")"
  fi
  simpan_state DAEMON_BACKUP "$DAEMON_BACKUP"
  simpan_state DAEMON_ASAL "$DAEMON_ASAL"
  simpan_state DAEMON_JSON "$ALETA_DAEMON_JSON"
fi
ubah_daemon_json "$ALETA_DAEMON_JSON" set "$DOCKER_BARU"
KONFIG_DIUBAH=1
info "daemon.json: data-root = $(daemon_data_root)"
[ "$(daemon_data_root)" = "$DOCKER_BARU" ] || die "daemon.json tidak berisi data-root yang diharapkan." 70

if [ "$PG_LAMA" != "$PG_BARU" ]; then
  while IFS= read -r f; do
    if grep -qF "$PG_LAMA:/var/lib/postgresql/data" "$f"; then
      if [ ! -f "$f.bak-pindah-$STAMP" ]; then cp -a "$f" "$f.bak-pindah-$STAMP"; fi
      # Jalur dijaga hanya berisi karakter aman (diperiksa di atas), '#' sebagai pemisah sed.
      sed -i "s#\\([\"' ]\\)${PG_LAMA}:/var/lib/postgresql/data#\\1${PG_BARU}:/var/lib/postgresql/data#" "$f"
      COMPOSE_BACKUP="$COMPOSE_BACKUP$f=$f.bak-pindah-$STAMP;"
      simpan_state COMPOSE_BACKUP "$COMPOSE_BACKUP"
      info "compose diubah: $f"
    fi
  done < <(berkas_compose)
fi
[ "$(jalur_postgres)" = "$PG_BARU" ] || die "Volume Postgres di compose belum menunjuk $PG_BARU." 70
simpan_state FASE konfig

# ---------------------------------------------------------------- nyalakan
TAHAP="menyalakan docker dan ALETA"
log "Menyalakan docker dan ALETA dari lokasi baru"
systemctl start docker
tunggu_docker || die "docker tidak menjawab." 70
[ "$(docker_root_sekarang)" = "$DOCKER_BARU" ] || die "docker memakai data root '$(docker_root_sekarang)', bukan $DOCKER_BARU." 70
info "docker info data-root: $(docker_root_sekarang)"

compose up -d postgres
for i in $(seq 1 60); do
  docker exec aleta-postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1 && break
  sleep 2
done
docker exec aleta-postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1 || die "Postgres tidak siap." 70

TAHAP="verifikasi baris tabel"
SESUDAH="$ALETA_KAPASITAS_DIR/pindah-$STAMP.baris-sesudah.txt"
hitung_baris_postgres aleta-postgres > "$SESUDAH"
if diff -u "$SEBELUM" "$SESUDAH" > "$ALETA_KAPASITAS_DIR/pindah-$STAMP.baris.diff"; then
  info "Jumlah baris $(wc -l < "$SESUDAH") tabel SAMA dengan sebelum pemindahan."
else
  head -n 30 "$ALETA_KAPASITAS_DIR/pindah-$STAMP.baris.diff" | sed 's/^/    /'
  die "Jumlah baris tabel BERBEDA dari sebelum pemindahan." 70
fi

TAHAP="menyalakan seluruh ALETA"
compose up -d
TAHAP="verifikasi akhir"
log "Verifikasi akhir (menunggu kontainer sehat, maks 3 menit)"
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
info "Verifikasi lulus."

# --------------------------------------------------------- data lama diganti nama
TAHAP="mengganti nama data lama"
log "Data lama diganti nama (TIDAK dihapus)"
ganti_nama() {
  local lama="$1" baru="$lama.lama-$TANGGAL" n=2
  [ -e "$lama" ] || { info "$lama sudah tidak ada." >&2; return 0; }
  while [ -e "$baru" ]; do baru="$lama.lama-$TANGGAL-$n"; n=$((n + 1)); done
  if grep -qF " $lama" /proc/mounts 2>/dev/null; then
    warn "$lama masih dipakai sebagai titik pasang; tidak diganti nama." >&2
    return 0
  fi
  mv "$lama" "$baru"
  info "$lama -> $baru" >&2
  printf '%s\n' "$baru"
}
LAMA_DOCKER="$(ganti_nama "$DOCKER_LAMA" | tail -n 1)"
LAMA_PG="$(ganti_nama "$PG_LAMA" | tail -n 1)"
simpan_state LAMA_DOCKER "$LAMA_DOCKER"
simpan_state LAMA_PG "$LAMA_PG"
simpan_state SELESAI 1
trap - ERR

log "SELESAI"
info "Data root Docker baru : $DOCKER_BARU"
info "Postgres baru         : $PG_BARU"
info "Partisi $(titik_pasang "$DEST"): bebas $(manusia "$(byte_bebas "$DEST")")"
info "Partisi $(titik_pasang "$DOCKER_LAMA"): bebas $(manusia "$(byte_bebas "$(dirname "$DOCKER_LAMA")")") (belum bertambah sebelum data lama dihapus)"
echo
echo "RUANG LAMA BELUM DIBEBASKAN. Setelah ALETA stabil beberapa hari, HAPUS SENDIRI (penghapusan permanen hanya oleh Anda):"
echo "    rm -rf '$LAMA_DOCKER'"
echo "    rm -rf '$LAMA_PG'"
echo "Bila ada masalah SEBELUM itu:  bash $SKRIP_DIR/kembalikan-data-docker.sh"
echo "Pasang pemantau ruang (cron host):  lihat docs/kapasitas-penyimpanan.md"
