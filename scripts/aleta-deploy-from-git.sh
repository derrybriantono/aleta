#!/usr/bin/env bash
set -Eeuo pipefail

# =============================================================================
# MENAIKKAN ALETA DARI SATU RUJUKAN GIT
# =============================================================================
#
# Dijalankan di MESIN YANG PUNYA REPO (bukan di server - server tidak punya
# git terpasang). Isinya dipaketkan dengan `git archive`, dikirim, lalu
# diterapkan lewat scripts/aleta-update.sh yang sudah ada.
#
# =============================================================================
# KENAPA DARI GIT, BUKAN DARI FOLDER KERJA
# =============================================================================
#
# Dua cara menaikkan yang dipakai sebelum ini sama-sama punya lubang yang
# tidak berbunyi:
#
#   1. Menyalin berkas satu per satu lewat scp. Pada 6 Sep 2026 satu penaikan
#      dikerjakan dalam empat gelombang salinan; satu berkas terlewat berarti
#      produksi rusak diam-diam. Cara ini juga MELEWATI aleta-update.sh,
#      sehingga tidak ada tarball cadangan yang dibuat sama sekali.
#
#   2. aleta-make-update.sh, yang memaketkan dari folder kerja memakai DAFTAR
#      SALIN. Komentar di dalamnya mencatat sendiri akibatnya ketika satu
#      baris terlupa: "update dilaporkan berhasil, service menyala, hanya
#      perilakunya tidak berubah." Folder kerja juga dapat memuat perubahan
#      yang belum di-commit, sehingga yang berjalan di server tidak ada
#      jejaknya di mana pun.
#
# `git archive` menyertakan SELURUH berkas terlacak menurut rujukannya - tidak
# ada daftar yang bisa terlupa, dan tidak mungkin memuat sesuatu yang belum
# di-commit. Berkas .env tidak ikut karena memang tidak terlacak.
#
# =============================================================================
# BERKAS YANG DIHAPUS
# =============================================================================
#
# Menimpa tidak menghapus. aleta-update.sh membersihkan manajemen_surat/src
# dan manajemen_surat/drizzle, tetapi tidak menyentuh aleta_bot. Karena itu
# skrip ini mencatat rujukan yang terpasang di server (.aleta-deployed-ref),
# lalu pada penaikan berikutnya menghapus tepat berkas yang hilang antara
# kedua rujukan - bukan menebak, bukan menyapu.
#
# Pada penaikan pertama catatannya belum ada, dan itu dikatakan apa adanya.
#
# =============================================================================
# PEMAKAIAN
# =============================================================================
#
#   bash scripts/aleta-deploy-from-git.sh                 # HEAD
#   bash scripts/aleta-deploy-from-git.sh v1.86.0         # tag/commit tertentu
#   bash scripts/aleta-deploy-from-git.sh HEAD --dry-run  # paketkan saja
#
# Variabel:
#   ALETA_SSH        alias/host ssh server        (bawaan: aleta)
#   ALETA_REMOTE_DIR folder aplikasi di server    (bawaan: /var/www/html/aleta)
#   ALETA_SERVICES   layanan yang dibangun        (bawaan: portal aleta_bot)
# =============================================================================

REF="${1:-HEAD}"
DRY_RUN=0
[ "${2:-}" = "--dry-run" ] && DRY_RUN=1

SSH_HOST="${ALETA_SSH:-aleta}"
REMOTE_DIR="${ALETA_REMOTE_DIR:-/var/www/html/aleta}"
SERVICES="${ALETA_SERVICES:-portal aleta_bot}"
REF_FILE="$REMOTE_DIR/.aleta-deployed-ref"

info() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
gagal() { printf '\n\033[31mGAGAL: %s\033[0m\n' "$*" >&2; exit 1; }

# --------------------------------------------------------------- 1. penjagaan
info "Memeriksa keadaan repo"

git rev-parse --git-dir >/dev/null 2>&1 || gagal "Bukan di dalam repo git."

# Folder kerja HARUS bersih. Inti skrip ini adalah menaikkan sesuatu yang
# punya jejak; menaikkan perubahan yang belum di-commit mengembalikan persis
# masalah yang hendak dihapus.
if [ -n "$(git status --porcelain)" ]; then
  git status --short
  gagal "Ada perubahan belum di-commit. Commit dulu - yang dinaikkan harus punya jejak di git."
fi

FULL_REF="$(git rev-parse "$REF" 2>/dev/null)" || gagal "Rujukan tidak dikenali: $REF"
SHORT_REF="$(git rev-parse --short "$REF")"
VERSION="$(git show "$FULL_REF:manajemen_surat/src/lib/patch-notes.ts" 2>/dev/null \
  | sed -n 's/^export const APP_VERSION = "\([^"]*\)";.*/\1/p' | head -n 1)"
[ -n "$VERSION" ] || gagal "APP_VERSION tidak terbaca pada rujukan $REF."

echo "  rujukan  : $REF -> $SHORT_REF"
echo "  versi    : $VERSION"
echo "  layanan  : $SERVICES"
echo "  server   : $SSH_HOST:$REMOTE_DIR"

# ---------------------------------------------------------------- 2. paketkan
info "Memaketkan dari git archive"

PKG_NAME="aleta-update-$VERSION"
KERJA="$(mktemp -d)"
trap 'rm -rf "$KERJA"' EXIT

mkdir -p "$KERJA/$PKG_NAME"
git archive --format=tar "$FULL_REF" | tar -x -C "$KERJA/$PKG_NAME"

# ---------------------------------------------------------------------------
# SETELAN SERVER TIDAK IKUT, WALAU TERLACAK GIT
# ---------------------------------------------------------------------------
#
# Berkas compose ada di dalam repo, tetapi yang berlaku adalah salinan di
# SERVER - dan keduanya sudah lama berbeda. Diukur 6 Sep 2026: 69 baris
# berbeda antara keduanya. Salinan server memuat pemasangan blangko APS
# Badilag yang tidak ada di git, sedangkan salinan git memuat baris
#
#     dns:
#       - ${ALETA_DNS_PRIMARY:-}
#
# yang mengembang menjadi kosong bila .env tidak ada di folder aplikasi -
# dan Docker menolak menjalankan container dengan alamat DNS kosong.
#
# Menimpakan salinan git membuat portal MATI: container terbentuk lalu gagal
# start dengan "bad nameserver address". Itu benar-benar terjadi pada
# percobaan pertama skrip ini, dan portal padam sekitar sepuluh menit.
#
# aleta-make-update.sh - pemaket yang sudah lama dipakai - memang tidak
# pernah menyertakan berkas compose. Keputusan itu benar dan diikuti di sini.
#
# Perubahan pada compose diterapkan SENDIRI ke server, sengaja, bukan
# menumpang penaikan kode.
rm -f "$KERJA/$PKG_NAME"/docker-compose*.yml
rm -f "$KERJA/$PKG_NAME/aleta_bot/docker-compose.yml"
rm -f "$KERJA/$PKG_NAME/manajemen_surat/docker-compose.postgres.yml"

# Setelan mesin pengembang - tidak ada gunanya di server.
rm -rf "$KERJA/$PKG_NAME/.claude" "$KERJA/$PKG_NAME/aleta_bot/.claude" \
       "$KERJA/$PKG_NAME/manajemen_surat/.claude"

# Setelan hidup yang ditulis bot saat berjalan. Tidak terlacak git sehingga
# semestinya tidak pernah ikut - dibuang juga di sini supaya tetap aman bila
# suatu saat ada yang meng-commit-nya.
rm -f "$KERJA/$PKG_NAME/aleta_bot/config/aleta-runtime.json"

# Manifest yang dituntut aleta-update.sh. Dibuat di sini, bukan disimpan di
# repo, supaya isinya selalu cocok dengan rujukan yang benar-benar dipaketkan.
cat > "$KERJA/$PKG_NAME/aleta-update.json" <<JSON
{
  "version": "$VERSION",
  "gitRef": "$FULL_REF",
  "gitRefShort": "$SHORT_REF",
  "builtBy": "aleta-deploy-from-git.sh",
  "builtAt": "$(date -Iseconds)"
}
JSON

BUNDLE="$KERJA/$PKG_NAME.tar.gz"
tar -czf "$BUNDLE" -C "$KERJA" "$PKG_NAME"
( cd "$KERJA" && sha256sum "$PKG_NAME.tar.gz" > "$PKG_NAME.tar.gz.sha256" )

JUMLAH="$(find "$KERJA/$PKG_NAME" -type f | wc -l | tr -d ' ')"
echo "  $JUMLAH berkas dipaketkan, $(du -h "$BUNDLE" | cut -f1)"
echo "  berkas compose SENGAJA tidak disertakan - itu setelan server"

if [ "$DRY_RUN" = "1" ]; then
  SIMPAN="${TMPDIR:-/tmp}/$PKG_NAME.tar.gz"
  cp "$BUNDLE" "$SIMPAN"
  info "Uji kering - tidak ada yang dikirim"
  echo "  paket disimpan: $SIMPAN"
  exit 0
fi

# ------------------------------------------------- 3. berkas yang harus hilang
info "Memeriksa berkas yang dihapus sejak penaikan terakhir"

REF_LAMA="$(ssh "$SSH_HOST" "cat '$REF_FILE' 2>/dev/null || true" | tr -d '\r\n ')"
DIHAPUS=""
if [ -z "$REF_LAMA" ]; then
  echo "  Belum ada catatan rujukan di server - penaikan pertama lewat skrip ini."
  echo "  Berkas yang dihapus sebelum ini tidak dapat dikenali dan mungkin masih tertinggal."
elif ! git cat-file -e "$REF_LAMA^{commit}" 2>/dev/null; then
  echo "  Rujukan tersimpan ($REF_LAMA) tidak ada di repo ini - dilewati."
else
  DIHAPUS="$(git diff --name-only --diff-filter=D "$REF_LAMA" "$FULL_REF" || true)"
  if [ -n "$DIHAPUS" ]; then
    echo "$DIHAPUS" | sed 's/^/  hapus: /'
  else
    echo "  Tidak ada berkas yang dihapus."
  fi
fi

# --------------------------------------------------------- 4. kirim & terapkan
info "Mengirim paket"
scp -q "$BUNDLE" "$BUNDLE.sha256" "$SSH_HOST:/tmp/"

info "Menandai image yang sedang berjalan (jalan mundur cepat)"
TANDA="sebelum-$SHORT_REF-$(date +%Y%m%d-%H%M)"
ssh "$SSH_HOST" "
  set -e
  P=\$(docker inspect aleta-portal --format '{{.Image}}' 2>/dev/null | cut -c8-19 || true)
  B=\$(docker inspect aleta-bot --format '{{.Image}}' 2>/dev/null | cut -c8-19 || true)
  [ -n \"\$P\" ] && docker tag \$P aleta-portal-backup:$TANDA && echo '  portal -> aleta-portal-backup:$TANDA'
  [ -n \"\$B\" ] && docker tag \$B aleta-bot-backup:$TANDA && echo '  bot    -> aleta-bot-backup:$TANDA'
  true
"

if [ -n "$DIHAPUS" ]; then
  info "Menghapus berkas yang sudah tidak ada di rujukan baru"
  echo "$DIHAPUS" | while IFS= read -r berkas; do
    [ -n "$berkas" ] || continue
    ssh "$SSH_HOST" "rm -f '$REMOTE_DIR/$berkas' && echo '  terhapus: $berkas'"
  done
fi

info "Menerapkan paket di server"
# ALETA_BUILD_REF diteruskan supaya cap build membawa penanda commit-nya.
# aleta-update.sh membuat tarball cadangan, membangun, dan menaikkan.
ssh "$SSH_HOST" "
  cd '$REMOTE_DIR' &&
  ALETA_BUILD_REF='$SHORT_REF' ALETA_UPDATE_SERVICES='$SERVICES' \
    bash scripts/aleta-update.sh /tmp/$PKG_NAME.tar.gz
" || {
  printf '\n\033[31m== PENAIKAN GAGAL ==\033[0m\n'
  echo "Jalan mundur CEPAT (detik):"
  echo "  ssh $SSH_HOST \"cd $REMOTE_DIR && docker tag aleta-portal-backup:$TANDA aleta-portal:latest && docker compose up -d --force-recreate portal\""
  echo "  ssh $SSH_HOST \"cd $REMOTE_DIR && docker tag aleta-bot-backup:$TANDA aleta-aleta_bot:latest && docker compose up -d --force-recreate aleta_bot\""
  echo "Jalan mundur PENUH (menit): lihat pesan aleta-update.sh di atas untuk nama tarballnya."
  exit 1
}

# ------------------------------------------------------------- 5. pembuktian
info "Membuktikan yang naik memang rujukan ini"

CAP="$(ssh "$SSH_HOST" "docker exec aleta-portal cat /app/BUILD-STAMP.txt 2>/dev/null || true" | tr -d '\r')"
echo "  cap build: ${CAP:-(tidak terbaca)}"
case "$CAP" in
  *"$SHORT_REF"*) echo "  cocok dengan $SHORT_REF" ;;
  *) gagal "Cap build tidak memuat $SHORT_REF - yang naik bukan rujukan ini." ;;
esac

SEHAT="$(ssh "$SSH_HOST" "
  curl -s -o /dev/null -w 'portal=%{http_code} ' -m 25 http://127.0.0.1/aleta/
  curl -s -o /dev/null -w 'bot=%{http_code}' -m 25 http://127.0.0.1:3003/internal/aleta-bot/sipp/analisa/daftar
" | tr -d '\r')"
echo "  $SEHAT"
case "$SEHAT" in
  *portal=30*|*portal=200*) ;;
  *) gagal "Portal tidak menjawab sebagaimana mestinya: $SEHAT" ;;
esac

# Rujukan dicatat SETELAH terbukti naik, bukan sebelum - supaya penaikan yang
# gagal tidak meninggalkan catatan yang berbohong.
ssh "$SSH_HOST" "printf '%s\n' '$FULL_REF' > '$REF_FILE'"

info "Selesai"
echo "  versi   : $VERSION"
echo "  rujukan : $SHORT_REF"
echo "  cadangan: aleta-portal-backup:$TANDA / aleta-bot-backup:$TANDA"
