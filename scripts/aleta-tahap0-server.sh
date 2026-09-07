#!/usr/bin/env bash
#
# =============================================================================
# TAHAP 0 - BAGIAN YANG HARUS DIKERJAKAN DI SERVER
# =============================================================================
#
# Berkas compose SENGAJA tidak ikut dipaketkan pada penaikan (lihat
# scripts/aleta-deploy-from-git.sh baris 111-133): yang berlaku adalah salinan
# di server, dan salinan itu berbeda 69 baris dari yang ada di git. Karena itu
# tiga perubahan tahap 0 di bawah diterapkan SENDIRI ke server, dengan tambalan
# yang menyasar, bukan dengan menimpa berkasnya.
#
# Yang dikerjakan:
#
#   1. ALETA_ECOURT_KREDENSIAL_DIR ditunjuk ke folder yang sudah terpasang.
#      Tanpa ini, kunci penyandian dan kredensial e-Court disimpan di
#      /root/.aleta-ecourt-session di dalam container - hilang tiap pembaruan,
#      dan petugas diminta memasukkan sandi lagi tanpa ada galat apa pun.
#
#   2. ALETA_BOT_DATA_DIR ditunjuk ke dalam volume runtime-data. Tanpa ini,
#      catatan cadangan yang ditulis JUSTRU KETIKA basis data bot mati
#      tersimpan di lapisan container dan ikut musnah.
#
#   3. Kunci dns pada layanan portal dibuang. Bentuk ${ALETA_DNS_PRIMARY:-}
#      memuai menjadi tulisan kosong, Docker menolaknya dengan "bad nameserver
#      address", dan portal mati - sudah terjadi 6 September 2026, sepuluh
#      menit. Bila DNS memang dibutuhkan, pakai docker-compose.dns.yml yang
#      hanya ikut bila disebut namanya.
#
# =============================================================================
# CARA MENJALANKAN
# =============================================================================
#
#   scp scripts/aleta-tahap0-server.sh aleta:/tmp/
#   ssh aleta "bash /tmp/aleta-tahap0-server.sh --periksa"    # lihat dulu
#   ssh aleta "bash /tmp/aleta-tahap0-server.sh --terapkan"   # baru kerjakan
#
# Naskah ini BERHENTI bila jangkarnya tidak ditemukan. Menambal berkas yang
# bentuknya sudah berbeda adalah cara membuat kerusakan yang sulit dilacak.
# =============================================================================

set -Eeuo pipefail

APP_DIR="${ALETA_APP_DIR:-/var/www/html/aleta}"
COMPOSE="$APP_DIR/docker-compose.yml"
MODE="${1:---periksa}"
CAP="$(date +%Y%m%d-%H%M%S)"

merah() { printf '\033[31m%s\033[0m\n' "$*"; }
hijau() { printf '\033[32m%s\033[0m\n' "$*"; }
biasa() { printf '%s\n' "$*"; }

if [ ! -f "$COMPOSE" ]; then
  merah "Tidak ada $COMPOSE. Set ALETA_APP_DIR bila foldernya berbeda."
  exit 66
fi

# --------------------------------------------------------------- pemeriksaan
ADA_KREDENSIAL=0
ADA_DATADIR=0
ADA_DNS=0
grep -q 'ALETA_ECOURT_KREDENSIAL_DIR' "$COMPOSE" && ADA_KREDENSIAL=1
grep -q 'ALETA_BOT_DATA_DIR' "$COMPOSE" && ADA_DATADIR=1
grep -qE '^\s*-\s*\$\{ALETA_DNS_(PRIMARY|SECONDARY):-\}\s*$' "$COMPOSE" && ADA_DNS=1

# Jangkar penyisipan: baris yang PASTI ada pada layanan aleta_bot.
JANGKAR='ALETA_ECOURT_SESSION_DIR'
if ! grep -q "$JANGKAR" "$COMPOSE"; then
  merah "Jangkar '$JANGKAR' tidak ada di $COMPOSE."
  merah "Bentuk berkasnya sudah berbeda dari yang diduga - naskah ini berhenti."
  merah "Kerjakan dengan tangan, lalu jalankan lagi dengan --periksa."
  exit 65
fi

biasa ""
biasa "== Keadaan sekarang di $COMPOSE =="
[ "$ADA_KREDENSIAL" -eq 1 ] && hijau "  sudah ada  ALETA_ECOURT_KREDENSIAL_DIR" || merah "  BELUM ada  ALETA_ECOURT_KREDENSIAL_DIR (kredensial e-Court hilang tiap pembaruan)"
[ "$ADA_DATADIR" -eq 1 ] && hijau "  sudah ada  ALETA_BOT_DATA_DIR" || merah "  BELUM ada  ALETA_BOT_DATA_DIR (catatan cadangan hilang tiap pembaruan)"
[ "$ADA_DNS" -eq 1 ] && merah "  MASIH ADA  kunci dns yang memuai kosong (portal dapat mati saat dinaikkan)" || hijau "  sudah bersih  tidak ada dns yang memuai kosong"
biasa ""

if [ "$MODE" != "--terapkan" ]; then
  biasa "Ini baru pemeriksaan. Jalankan dengan --terapkan untuk mengerjakannya."
  exit 0
fi

if [ "$ADA_KREDENSIAL" -eq 1 ] && [ "$ADA_DATADIR" -eq 1 ] && [ "$ADA_DNS" -eq 0 ]; then
  hijau "Tidak ada yang perlu dikerjakan."
  exit 0
fi

# ------------------------------------------------------------------- cadangan
CADANGAN="$APP_DIR/docker-compose.yml.sebelum-tahap0-$CAP"
cp -a "$COMPOSE" "$CADANGAN"
hijau "Cadangan disimpan: $CADANGAN"

# ------------------------------------------------------------------- tambalan
python3 - "$COMPOSE" <<'PY'
import io, re, sys

jalur = sys.argv[1]
teks = io.open(jalur, encoding="utf-8").read()
asal = teks

# 1 dan 2 - dua peubah lingkungan disisipkan tepat sesudah jangkarnya, dengan
# indentasi yang disalin dari jangkar itu sendiri supaya tidak merusak YAML.
m = re.search(r'^(\s*)ALETA_ECOURT_SESSION_DIR:.*$', teks, re.M)
if not m:
    print("JANGKAR HILANG - tidak ada yang diubah")
    sys.exit(65)
spasi = m.group(1)
sisip = []
if "ALETA_ECOURT_KREDENSIAL_DIR" not in teks:
    sisip.append(f"{spasi}# Kredensial e-Court tersandi BESERTA kunci penyandiannya. Tanpa ini")
    sisip.append(f"{spasi}# jatuh ke /root di dalam container - hilang tiap pembaruan.")
    sisip.append(f"{spasi}ALETA_ECOURT_KREDENSIAL_DIR: /usr/src/app/.ecourt-session")
if "ALETA_BOT_DATA_DIR" not in teks:
    sisip.append(f"{spasi}# Catatan cadangan yang ditulis ketika basis data bot mati.")
    sisip.append(f"{spasi}# Bawaannya <app>/data - di lapisan container, jadi ikut musnah.")
    sisip.append(f"{spasi}ALETA_BOT_DATA_DIR: /usr/src/app/runtime-data/catatan")
if sisip:
    teks = teks[: m.end()] + "\n" + "\n".join(sisip) + teks[m.end() :]

# 3 - kunci dns beserta kedua nilainya yang memuai kosong.
teks = re.sub(
    r'^[ \t]*dns:[ \t]*\n(?:[ \t]*-[ \t]*\$\{ALETA_DNS_(?:PRIMARY|SECONDARY):-\}[ \t]*\n)+',
    "",
    teks,
    flags=re.M,
)

if teks == asal:
    print("Tidak ada perubahan yang perlu ditulis.")
else:
    io.open(jalur, "w", encoding="utf-8").write(teks)
    print("Tambalan diterapkan.")
PY

# ------------------------------------------------------------------ verifikasi
biasa ""
biasa "== Memeriksa hasilnya =="
cd "$APP_DIR"
if ! docker compose config >/dev/null 2>&1; then
  merah "docker compose config GAGAL - berkas dikembalikan dari cadangan."
  cp -a "$CADANGAN" "$COMPOSE"
  docker compose config >/dev/null && hijau "Sudah kembali ke keadaan semula."
  exit 70
fi
hijau "docker compose config sah."

# ---------------------------------------------------------------------------
# HASIL CONFIG DIBACA SEKALI, DAN TIDAK LEWAT PIPA
# ---------------------------------------------------------------------------
#
# Bentuk sebelumnya menyalurkan hasil config ke `grep -q`. Hasil config
# panjangnya ribuan baris, dan `grep -q` berhenti membaca begitu ketemu -
# sehingga penulis di hulu mati kena SIGPIPE dengan kode 141. Skrip ini
# memakai `set -o pipefail`, jadi kode itulah yang menjadi kode pipeline.
#
# Akibatnya terbalik dan berbahaya: pemeriksaan `dns:` di bawah akan masuk ke
# cabang "sudah tidak ada" TEPAT KETIKA kunci itu masih ada - meluluskan
# justru keadaan yang hendak dicegahnya. Kunci dns yang mengembang kosong
# pernah mematikan portal sepuluh menit.
#
# Hasilnya dibaca sekali ke dalam peubah, lalu dicari dengan here-string.
# Tidak ada pipa, tidak ada yang dapat kena SIGPIPE. Isinya TIDAK PERNAH
# dicetak - hasil config memuat kata sandi basis data, token internal, dan
# kunci privat.
CONFIG_TEKS="$(docker compose config 2>/dev/null)"

for kunci in ALETA_ECOURT_KREDENSIAL_DIR ALETA_BOT_DATA_DIR; do
  if grep -qF -- "$kunci" <<< "$CONFIG_TEKS"; then
    hijau "  $kunci terbaca oleh Compose"
  else
    merah "  $kunci TIDAK terbaca - periksa dengan tangan"
  fi
done
if grep -qE '^\s*dns:' <<< "$CONFIG_TEKS"; then
  merah "  kunci dns MASIH ada pada hasil config - periksa dengan tangan"
else
  hijau "  tidak ada kunci dns pada hasil config"
fi

biasa ""
biasa "== Menyalakan ulang layanan yang terpengaruh =="
docker compose up -d aleta_bot
docker compose up -d portal

biasa ""
biasa "Tunggu sehat, lalu periksa:"
biasa "  docker compose ps"
biasa "  docker compose exec aleta_bot sh -c 'echo \$ALETA_ECOURT_KREDENSIAL_DIR; echo \$ALETA_BOT_DATA_DIR'"
biasa "  curl -s -o /dev/null -w '%{http_code}\\n' http://127.0.0.1:3000/aleta/api/public/institution"
biasa ""
hijau "Selesai. Cadangan tetap ada di $CADANGAN"
