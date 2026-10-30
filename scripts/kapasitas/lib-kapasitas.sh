#!/usr/bin/env bash
# ============================================================================
# ALETA - fungsi bersama skrip kapasitas penyimpanan (30 Okt 2026)
# ============================================================================
#
# Di-source oleh pindah-data-docker.sh dan kembalikan-data-docker.sh. Tidak
# menjalankan apa pun sendiri. Hanya bash 4.1+ (CentOS 7) dan alat bawaannya:
# df, du, find, awk, sed, python (2.7 atau 3) untuk menggabung JSON.
#
# Aturan yang dijaga di sini:
#   - tidak memformat, memartisi, atau menghapus data permanen apa pun;
#   - angka ruang selalu dalam BYTE (df -P -B1), bukan teks "1,2G";
#   - galat tidak ditelan: fungsi pemeriksa mengembalikan kode bukan-nol.

ALETA_APP_DIR="${ALETA_APP_DIR:-/var/www/html/aleta}"
ALETA_DATA_DIR="${ALETA_DATA_DIR:-/var/www/html/aleta-data}"
ALETA_LAPORAN_DIR="${ALETA_LAPORAN_DIR:-$ALETA_DATA_DIR/reports}"
ALETA_KAPASITAS_DIR="${ALETA_KAPASITAS_DIR:-$ALETA_LAPORAN_DIR/kapasitas}"
ALETA_DAEMON_JSON="${ALETA_DAEMON_JSON:-/etc/docker/daemon.json}"
ALETA_DOCKER_ROOT_LAMA="${ALETA_DOCKER_ROOT_LAMA:-/home/docker-data}"
ALETA_PG_LAMA="${ALETA_PG_LAMA:-/home/aleta-data/postgres}"
ALETA_URL_LOGIN="${ALETA_URL_LOGIN:-http://127.0.0.1:8008/aleta/login}"
ALETA_URL_LOGIN_CADANGAN="${ALETA_URL_LOGIN_CADANGAN:-http://127.0.0.1:3000/aleta/login}"

log()   { printf '\n\033[1;36m==>\033[0m %s\n' "$*"; }
info()  { printf '    %s\n' "$*"; }
warn()  { printf '\033[1;33m[!]\033[0m %s\n' "$*"; }
galat() { printf '\033[1;31m[x]\033[0m %s\n' "$*" >&2; }
die()   { galat "$*"; exit "${2:-1}"; }

# 1073741824 -> "1,0 GB" (basis 1024, sama dengan layar portal).
manusia() {
  awk -v b="${1:-0}" 'BEGIN {
    split("B KB MB GB TB", s, " "); i = 1; v = b + 0
    while (v >= 1024 && i < 5) { v /= 1024; i++ }
    if (i == 1) printf "%d %s", v, s[i]; else printf "%.1f %s", v, s[i]
  }'
}

# Naik ke induk terdekat yang ada (jalur tujuan boleh belum dibuat).
jalur_ada() {
  local j="$1"
  while [ ! -e "$j" ] && [ "$j" != "/" ]; do j="$(dirname "$j")"; done
  printf '%s\n' "$j"
}

# Byte bebas / total pada sebuah jalur.
byte_bebas() { df -P -B1 "$(jalur_ada "$1")" 2>/dev/null | awk 'NR==2 { print $4 }'; }
byte_total() { df -P -B1 "$(jalur_ada "$1")" 2>/dev/null | awk 'NR==2 { print $2 }'; }

# Titik pasang partisi dan perangkat tempat sebuah jalur berada.
titik_pasang()  { df -P "$(jalur_ada "$1")" 2>/dev/null | awk 'NR==2 { print $6 }'; }
perangkat_dari() { df -P "$(jalur_ada "$1")" 2>/dev/null | awk 'NR==2 { print $1 }'; }

# Jumlah ukuran SEMUA berkas biasa (apparent size) - tidak ikut ukuran folder,
# yang berbeda antar sistem berkas dan menyesatkan perbandingan.
ukuran_berkas() {
  [ -d "$1" ] || { echo 0; return 0; }
  find "$1" -xdev -type f -printf '%s\n' 2>/dev/null | awk '{ s += $1 } END { printf "%d\n", s }'
}

jumlah_entri() {
  [ -d "$1" ] || { echo 0; return 0; }
  find "$1" -xdev 2>/dev/null | wc -l | tr -d ' '
}

compose() {
  if docker compose version >/dev/null 2>&1; then
    (cd "$ALETA_APP_DIR" && docker compose "$@")
  else
    (cd "$ALETA_APP_DIR" && docker-compose "$@")
  fi
}

# Berkas compose yang dipakai server: override DULU (menang untuk target yang
# sama), lalu yang dasar - lihat memori compose-peladen-punya-override.
berkas_compose() {
  local f
  for f in docker-compose.override.yml docker-compose.yml; do
    if [ -f "$ALETA_APP_DIR/$f" ]; then printf '%s\n' "$ALETA_APP_DIR/$f"; fi
  done
  return 0
}

# Jalur host yang di-mount ke /var/lib/postgresql/data. Kosong bila tidak ketemu.
jalur_postgres() {
  local f hasil
  while IFS= read -r f; do
    hasil="$(sed -n 's/^[[:space:]]*-[[:space:]]*["'"'"']\{0,1\}\([^:"'"'"' ]*\):\/var\/lib\/postgresql\/data.*/\1/p' "$f" | head -n 1)"
    if [ -n "$hasil" ]; then printf '%s\n' "$hasil"; return 0; fi
  done < <(berkas_compose)
  return 0
}

# Data root Docker yang SEDANG dipakai daemon (kosong bila docker mati).
docker_root_sekarang() {
  timeout 30 docker info --format '{{.DockerRootDir}}' 2>/dev/null || true
}

python_bin() {
  if command -v python3 >/dev/null 2>&1; then echo python3
  elif command -v python >/dev/null 2>&1; then echo python
  fi
}

# Ubah/hapus kunci data-root di daemon.json tanpa menyentuh kunci lain.
#   ubah_daemon_json <berkas> set <jalur>   -> data-root = jalur (kunci lama "graph" dibuang)
#   ubah_daemon_json <berkas> hapus         -> buang data-root
# Berkas belum ada + set -> dibuat. Menulis lewat berkas sementara lalu rename.
ubah_daemon_json() {
  local berkas="$1" aksi="$2" nilai="${3:-}" py
  py="$(python_bin)"
  [ -n "$py" ] || { galat "python tidak ada; daemon.json tidak dapat digabung dengan aman."; return 1; }
  "$py" - "$berkas" "$aksi" "$nilai" <<'PY'
import json, os, sys
berkas, aksi, nilai = sys.argv[1], sys.argv[2], sys.argv[3]
isi = {}
if os.path.exists(berkas):
    teks = open(berkas).read().strip()
    if teks:
        isi = json.loads(teks)          # JSON rusak -> galat, berkas tidak disentuh
    if not isinstance(isi, dict):
        sys.stderr.write("daemon.json bukan objek JSON\n")
        sys.exit(2)
if aksi == "set":
    isi.pop("graph", None)              # kunci lama; bersama data-root membuat docker gagal start
    isi["data-root"] = nilai
elif aksi == "hapus":
    isi.pop("data-root", None)
else:
    sys.exit(3)
sem = berkas + ".tmp-aleta"
with open(sem, "w") as f:
    json.dump(isi, f, indent=2, sort_keys=True)
    f.write("\n")
os.replace(sem, berkas)
PY
}

# Nilai data-root di daemon.json ("" bila tidak ada).
daemon_data_root() {
  [ -f "$ALETA_DAEMON_JSON" ] || return 0
  sed -n 's/.*"data-root"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$ALETA_DAEMON_JSON" | head -n 1
}

# Bila unit systemd docker memaksa data root lewat argumen (bentrok dengan
# daemon.json), cetak barisnya dan kembalikan 0; selain itu kembalikan 1.
docker_unit_memaksa_root() {
  local teks
  teks="$( { systemctl cat docker 2>/dev/null; cat /etc/sysconfig/docker /etc/sysconfig/docker-storage 2>/dev/null; } | grep -E -- '(^|[[:space:]])(--graph|--data-root|-g)([= ]|$)' || true)"
  if [ -n "$teks" ]; then printf '%s\n' "$teks"; return 0; fi
  return 1
}

tunggu_docker() {
  local i
  for i in $(seq 1 60); do
    if timeout 10 docker info >/dev/null 2>&1; then return 0; fi
    sleep 2
  done
  return 1
}

# Status satu container: "running=true restart=<n> sehat=<status>" atau "tidak-ada".
status_kontainer() {
  local nama="$1" jalan restart sehat
  jalan="$(docker inspect -f '{{.State.Running}}' "$nama" 2>/dev/null || true)"
  [ -n "$jalan" ] || { echo "tidak-ada"; return 0; }
  restart="$(docker inspect -f '{{.RestartCount}}' "$nama" 2>/dev/null || echo '?')"
  sehat="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}-{{end}}' "$nama" 2>/dev/null || echo '-')"
  echo "running=$jalan restart=$restart sehat=$sehat"
}

# Hitung baris SEMUA tabel public Postgres -> "tabel|jumlah" terurut. Postgres harus hidup.
hitung_baris_postgres() {
  local nama="${1:-aleta-postgres}"
  docker exec -i "$nama" sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -F "|"' <<'SQL' | sort
SELECT format('SELECT %L, count(*) FROM %I.%I', table_name, table_schema, table_name)
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name
\gexec
SQL
}

kode_http() {
  curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$1" 2>/dev/null || echo 000
}

# 200 di salah satu alamat login portal.
login_portal_ok() {
  local k
  k="$(kode_http "$ALETA_URL_LOGIN")"
  info "GET $ALETA_URL_LOGIN -> $k"
  [ "$k" = "200" ] && return 0
  k="$(kode_http "$ALETA_URL_LOGIN_CADANGAN")"
  info "GET $ALETA_URL_LOGIN_CADANGAN -> $k"
  [ "$k" = "200" ]
}

# Partisi (bukan tempat jalur $1 berada) dengan ruang bebas terbesar -> "titik|bebasByte".
saran_tujuan() {
  local skip
  skip="$(perangkat_dari "$1")"
  df -P -B1 -x tmpfs -x devtmpfs -x overlay -x squashfs 2>/dev/null \
    | awk -v skip="$skip" 'NR>1 && $1 != skip && $6 !~ /^\/boot/ { print $4 "|" $6 }' \
    | sort -t'|' -k1,1nr | head -n 1 | awk -F'|' '{ print $2 "|" $1 }'
}

saran_tujuan_teks() {
  local s titik bebas
  s="$(saran_tujuan "$1")"
  if [ -z "$s" ]; then echo "tidak ada partisi lain"; return 0; fi
  titik="${s%%|*}"; bebas="${s#*|}"
  if [ "$titik" = "/" ]; then
    echo "partisi / ($(manusia "$bebas") bebas) -> tujuan /aleta-docker"
  else
    echo "partisi $titik ($(manusia "$bebas") bebas) -> tujuan $titik/aleta-docker"
  fi
}

# Laporan keadaan penyimpanan - hanya MEMBACA. Dipakai --periksa dan awal --jalankan.
laporan_penyimpanan() {
  log "Perangkat blok (lsblk)"
  if command -v lsblk >/dev/null 2>&1; then
    lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINT 2>/dev/null || true
  else
    info "lsblk tidak ada."
  fi

  log "Pemakaian partisi (df -h)"
  df -hP -x tmpfs -x devtmpfs -x overlay -x squashfs 2>/dev/null || true

  local root pg d
  root="$(docker_root_sekarang)"; [ -n "$root" ] || root="$ALETA_DOCKER_ROOT_LAMA"
  pg="$(jalur_postgres)"; [ -n "$pg" ] || pg="$ALETA_PG_LAMA"
  d="$(daemon_data_root)"

  log "Letak data"
  info "Data root Docker saat ini : $root  (partisi $(titik_pasang "$root"), bebas $(manusia "$(byte_bebas "$root")"))"
  info "Folder Postgres ALETA     : $pg  (partisi $(titik_pasang "$pg"), bebas $(manusia "$(byte_bebas "$pg")"))"
  info "Data ALETA (unggahan dll) : $ALETA_DATA_DIR  (partisi $(titik_pasang "$ALETA_DATA_DIR"), bebas $(manusia "$(byte_bebas "$ALETA_DATA_DIR")"))"
  info "data-root di daemon.json  : ${d:-<tidak diatur: bawaan>}"
  if docker_unit_memaksa_root >/dev/null; then
    warn "Unit/konfigurasi docker memaksa data root lewat argumen (bentrok dengan daemon.json):"
    docker_unit_memaksa_root | sed 's/^/        /'
  fi

  if [ "${ALETA_LAPORAN_CEPAT:-0}" != "1" ]; then
    log "Ukuran data yang akan dipindah (bisa beberapa menit; lewati dengan ALETA_LAPORAN_CEPAT=1)"
    info "Docker  : $(manusia "$(ukuran_berkas "$root")")"
    info "Postgres: $(manusia "$(ukuran_berkas "$pg")")"
  fi

  log "Disk atau ruang yang BELUM dipakai (hanya laporan - skrip ini tidak memformat atau memartisi apa pun)"
  local ada=0 nama tipe ukuran anak sisa vg tot bebas
  if command -v lsblk >/dev/null 2>&1; then
    while read -r nama tipe ukuran; do
      [ "$tipe" = "disk" ] || continue
      anak="$(lsblk -n -o NAME "/dev/$nama" 2>/dev/null | wc -l | tr -d ' ')"
      sisa="$(lsblk -n -o FSTYPE,MOUNTPOINT "/dev/$nama" 2>/dev/null | tr -d ' \n')"
      if [ "${anak:-0}" -le 1 ] && [ -z "$sisa" ]; then
        warn "Disk /dev/$nama ($ukuran) tampak KOSONG: tanpa partisi dan tanpa sistem berkas."
        info "Memakainya perlu dipartisi dan diformat oleh Anda sendiri (mis. fdisk/parted lalu mkfs.xfs dan mount di /aleta-docker)."
        info "Skrip ini TIDAK melakukannya. Setelah terpasang, jalankan: pindah-data-docker.sh --jalankan /aleta-docker"
        ada=1
      fi
    done < <(lsblk -dn -o NAME,TYPE,SIZE 2>/dev/null)
  fi
  if command -v vgs >/dev/null 2>&1; then
    while read -r vg tot bebas; do
      [ -n "$vg" ] || continue
      info "Grup volume LVM $vg: total $tot, belum dialokasikan $bebas"
      case "$bebas" in
        0|0.00*|"<0"*) ;;
        *)
          ada=1
          warn "Ada ruang LVM belum dialokasikan di $vg ($bebas). Memperluas volume dikerjakan Anda sendiri."
          ;;
      esac
    done < <(vgs --noheadings -o vg_name,vg_size,vg_free 2>/dev/null)
  fi
  [ "$ada" -eq 1 ] || info "Tidak ada disk kosong atau ruang LVM bebas yang terdeteksi."

  log "Total fisik dan saran tujuan"
  local fisik
  fisik="$(lsblk -bdn -o SIZE -e 7,11 2>/dev/null | awk '{ s += $1 } END { printf "%d", s }')"
  [ -n "$fisik" ] || fisik=0
  info "Total semua disk fisik: $(manusia "$fisik")"
  if [ "$fisik" -lt 1099511627776 ]; then
    warn "Total disk fisik di bawah 1 TB: 1 TB untuk ALETA TIDAK mungkin tanpa menambah disk."
    info "Yang mungkin: pindah ke partisi terbesar - $(saran_tujuan_teks "$root")."
  else
    info "Total disk fisik cukup untuk 1 TB; pastikan ruangnya berupa SATU partisi yang dipakai ALETA."
    info "Saran tujuan: $(saran_tujuan_teks "$root")."
  fi
  info "Catatan: XFS tidak dapat DIKECILKAN, jadi ruang menganggur di / tidak bisa dipindah ke /home; yang dipindah adalah datanya."
}
