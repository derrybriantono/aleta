#!/usr/bin/env bash
# =============================================================================
# Menyusun paket installer ALETA.
#
# Bentuknya mengikuti paket sebelumnya persis - install.sh, INSTALL.md,
# aleta-installer.json, dan folder app/ - sebab install.sh di dalamnya menyalin
# app/. ke folder aplikasi, dan berubahnya susunan berarti berubahnya yang
# tersalin di server.
#
# Yang TIDAK ikut: rahasia, hasil build, dependensi, data, dan sampah kerja.
# Daftar pengecualiannya ditulis eksplisit di bawah, bukan diserahkan pada
# .gitignore - paket ini dipasang di server pengadilan, dan yang ikut terbawa
# ke sana harus disebutkan satu per satu, bukan disimpulkan.
# =============================================================================
set -Eeuo pipefail

VERSI="${1:?versi wajib disebut, misal 1.56.0}"
AKAR="$(cd "$(dirname "$0")/../.." && pwd)"
KELUAR="$AKAR/reports/installer"
NAMA="aleta-installer-$VERSI"
PANGGUNG="$(mktemp -d)"
TUJUAN="$PANGGUNG/$NAMA"

trap 'rm -rf "$PANGGUNG"' EXIT

mkdir -p "$TUJUAN/app"

# --- yang disalin ------------------------------------------------------------
BAGIAN=(
  aleta_bot
  manajemen_surat
  ekstensi-sipp
  deploy
  docs
  scripts
)

# --- yang tidak pernah ikut --------------------------------------------------
#
# node_modules dan .next dibangun ulang di server; menyertakannya membengkakkan
# paket puluhan kali lipat tanpa memberi apa pun.
#
# .env dikecualikan karena berisi kata sandi basis data dan token gerbang -
# paket ini berpindah lewat surel dan flashdisk.
#
# GAMBAR TIDAK DIKECUALIKAN BORONGAN. Percobaan pertama membuang seluruh *.png
# dan ikut membuang public/favicon.png serta public/mahkamah-agung-logo.png -
# keduanya dipakai aplikasi yang berjalan, dan hilangnya baru terasa pada
# pemasangan baru, ketika logonya tidak muncul dan tidak ada yang tahu kenapa.
#
# Karena itu yang dibuang disebut satu per satu: tangkapan layar panduan,
# tangkapan layar sisa pengujian, dan gambar bukti yang tertinggal di akar
# folder. Yang di public/ dan ikon ekstensi tetap ikut.
KECUALI=(
  --exclude=node_modules
  --exclude=.next
  --exclude=.git
  --exclude=.env
  --exclude=.env.local
  --exclude=.env.production
  --exclude=.env.development
  --exclude=.backup
  --exclude=.codex-logs
  --exclude=.claude
  --exclude=.tmp
  --exclude=.turbo
  --exclude=.vscode
  --exclude=coverage
  --exclude=playwright-report
  --exclude=test-results
  --exclude=archive_unused
  --exclude=tmp
  --exclude=data
  --exclude=sessions
  # Dokumen perkara yang sungguhan diunggah di mesin ini TIDAK boleh ikut:
  # paket ini dipasang di server pengadilan lain, dan membawanya berarti
  # menyerahkan dokumen satu pengadilan kepada pengadilan yang lain tanpa ada
  # yang memintanya.
  #
  # Pengecualiannya BERJALUR, bukan bernama. Percobaan pertama memakai
  # --exclude=uploads dan ikut membuang src/app/api/uploads/pdf/route.ts -
  # kode aplikasi yang kebetulan berada di folder bernama sama.
  --exclude='manajemen_surat/public/uploads'
  --exclude='manajemen_surat/uploads'
  --exclude='*.pdf'
  --exclude=.wwebjs_auth
  --exclude=.wwebjs_cache
  --exclude=screenshots
  --exclude='*.log'
  --exclude='*.bak*'
  --exclude='*.sqlite'
  --exclude='*.db'
  --exclude='*.tar.gz'
  --exclude='.next-start.err'
  --exclude='playwright-*.png'
  --exclude='institution-*.png'
  --exclude='whatsapp-*.png'
  --exclude='ai-settings-runtime-proof.png'
  --exclude='contoh-panduan-preview.png'
  --exclude='institution-enrichment-runtime.json'
)

for bagian in "${BAGIAN[@]}"; do
  ( cd "$AKAR" && tar --force-local -cf - "${KECUALI[@]}" "$bagian" ) | ( cd "$TUJUAN/app" && tar --force-local -xf - )
done

# --- pemeriksaan: berkas yang keberadaannya menentukan aplikasi berjalan ------
#
# Diperiksa DI SINI, bukan dipercaya. Pengecualian yang terlalu luas tidak gagal
# saat menyusun paket - ia gagal berbulan kemudian di server orang lain.
WAJIB_ADA=(
  app/manajemen_surat/public/favicon.png
  app/manajemen_surat/public/mahkamah-agung-logo.png
  app/manajemen_surat/package.json
  app/manajemen_surat/package-lock.json
  app/manajemen_surat/next.config.ts
  app/manajemen_surat/src/app/api/uploads/pdf/route.ts
  app/manajemen_surat/drizzle/0019_aleta_penunjukan_otomatis.sql
  app/manajemen_surat/drizzle/0020_aleta_pengisian_borang.sql
  app/aleta_bot/package.json
  app/aleta_bot/package-lock.json
  app/aleta_bot/app.js
  app/aleta_bot/services/penunjukanService.js
  app/ekstensi-sipp/manifest.json
  app/ekstensi-sipp/konten.js
  app/ekstensi-sipp/jembatan.js
  app/ekstensi-sipp/panel.css
  app/ekstensi-sipp/ikon/aleta-16.png
  app/ekstensi-sipp/ikon/aleta-32.png
  app/ekstensi-sipp/ikon/aleta-48.png
  app/ekstensi-sipp/ikon/aleta-128.png
)

kurang=0
for berkas in "${WAJIB_ADA[@]}"; do
  if [ ! -f "$TUJUAN/$berkas" ]; then
    echo "HILANG: $berkas" >&2
    kurang=1
  fi
done
if [ "$kurang" -ne 0 ]; then
  echo "Paket tidak disusun - ada berkas wajib yang terbuang pengecualian." >&2
  exit 1
fi

# Rahasia tidak boleh ikut, dan itu diperiksa, bukan diasumsikan.
if find "$TUJUAN" -name ".env" -o -name ".env.production" -o -name ".env.local" | grep -q .; then
  echo "Paket tidak disusun - ada berkas .env yang ikut terbawa." >&2
  exit 1
fi

# Dokumen perkara tidak boleh ikut. Ini yang paling mudah luput: uploads ada di
# dalam public/, dan public/ memang harus ikut.
for folder in public/uploads uploads; do
  if [ -d "$TUJUAN/app/manajemen_surat/$folder" ]; then
    echo "Paket tidak disusun - manajemen_surat/$folder ikut terbawa." >&2
    exit 1
  fi
done
if find "$TUJUAN" -name '*.pdf' | grep -q .; then
  echo "Paket tidak disusun - ada berkas PDF yang ikut terbawa." >&2
  exit 1
fi

# --- berkas tingkat atas -----------------------------------------------------
cp -a "$AKAR/docker-compose.yml" "$TUJUAN/app/"
cp -a "$AKAR/docker-compose.override.yml" "$TUJUAN/app/"
cp -a "$AKAR/.env.production.example" "$TUJUAN/app/"

cp -a "$AKAR/deploy/installer/install.sh" "$TUJUAN/install.sh"
cp -a "$AKAR/deploy/installer/INSTALL.md" "$TUJUAN/INSTALL.md"
chmod +x "$TUJUAN/install.sh"

JUMLAH="$(find "$TUJUAN" -type f | wc -l | tr -d ' ')"

# Keduanya DIBACA, bukan diketik. Versi ekstensi dan nomor migrasi terakhir
# berubah hampir tiap rilis, dan yang diketik di sini akan basi tanpa ada yang
# menyadarinya - catatan paket yang menyebut versi lama lebih menyesatkan
# daripada catatan yang tidak menyebut versi sama sekali.
# Manifest dibaca sebagai JSON, bukan dengan pola teks. Kunci "version" dan
# "manifest_version" hidup berdampingan di berkas yang sama, dan pola yang
# sedikit longgar akan mengambil angka 3 milik manifest_version - lalu catatan
# paketnya menyebut "Ekstensi Chrome 3".
VERSI_EKSTENSI="$(node -e 'process.stdout.write(String(require(process.argv[1]).version || ""))' "$TUJUAN/app/ekstensi-sipp/manifest.json")"

# Nomor migrasi tertinggi yang ikut dalam paket - empat angka di depan nama
# berkasnya, dipotong pada garis bawah pertama.
MIGRASI_TERAKHIR="$(ls "$TUJUAN/app/manajemen_surat/drizzle"/*.sql 2>/dev/null | sed 's|.*/||' | cut -d_ -f1 | sort -n | tail -1)"

# Keduanya diperiksa. Catatan paket yang menyebut versi kosong sama
# menyesatkannya dengan yang menyebut versi salah.
if [ -z "$VERSI_EKSTENSI" ] || [ -z "$MIGRASI_TERAKHIR" ]; then
  echo "Paket tidak disusun - versi ekstensi atau nomor migrasi tidak terbaca." >&2
  exit 1
fi

cat > "$TUJUAN/aleta-installer.json" <<JSON
{
  "product": "ALETA (Portal Manajemen Surat + WhatsApp Bot)",
  "version": "$VERSI",
  "builtAt": "$(date -Iseconds)",
  "packageName": "$NAMA.tar.gz",
  "supports": ["fresh-install", "update"],
  "fileCount": $JUMLAH,
  "excludesSecrets": true,
  "notes": [
    "Jalankan install.sh di server; mode fresh/update terdeteksi otomatis.",
    "Paket tidak berisi .env, node_modules, .next, database, PDF, atau session WhatsApp.",
    "Migrasi sampai $MIGRASI_TERAKHIR - yang belum pernah dijalankan berjalan sendiri saat portal dinyalakan.",
    "Ekstensi Chrome $VERSI_EKSTENSI: pasang ulang dari menu ALETA e-Court sesudah pembaruan."
  ]
}
JSON

mkdir -p "$KELUAR"
( cd "$PANGGUNG" && tar --force-local -czf "$KELUAR/$NAMA.tar.gz" "$NAMA" )

( cd "$KELUAR" && sha256sum "$NAMA.tar.gz" > "$NAMA.tar.gz.sha256" )

echo "paket   : $KELUAR/$NAMA.tar.gz"
echo "berkas  : $JUMLAH"
echo "ukuran  : $(du -h "$KELUAR/$NAMA.tar.gz" | cut -f1)"
cat "$KELUAR/$NAMA.tar.gz.sha256"
