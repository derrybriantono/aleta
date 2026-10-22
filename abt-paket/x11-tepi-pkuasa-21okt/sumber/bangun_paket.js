"use strict";
/**
 * Bangun paket-satker/ paket x11 (21 Okt 2026): (a) hapus baris kalimat penutup saksi di perkara TANPA catatan Minutasi yang x7 lewati
 * (proses 293/296), (c) dua BAS "P (Kuasa)" non-Derry: #0184# kedua -> #0111# (skrip usulan x10, atas izin pengguna "asal pakai kuasa").
 * (b) pembersihan otomatis ke depan adalah KODE bot (aleta_bot/services/bersihPenutupSaksiService.js), bukan paket ini.
 * pakai: node sumber/bangun_paket.js   Keluaran (LF, ASCII): paket-satker/*
 */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const AKAR = path.resolve(__dirname, "..");
const PK = path.join(AKAR, "paket-satker");
const N = "abt-x11-tepi-pkuasa-21okt";
const MINUTASI = 220;
// md5 sebelum -> sesudah dua blangko BAS (server 21 Okt 2026, baca saja; sesudah = "#0184#" -> "#0111#", panjang sama)
const RTF = [
  ["c64698d83858d625204d43e9ddcef794", "58703bde7c2335e33eb01c1835846fac"],
  ["3d3ad23d726f3b4ace6ed76dd7e3bfce", "be3ce1b8bfc74665bd8402b9035d772a"],
];

function ascii(t, nama) {
  if (/[^\x09\x0a\x20-\x7e]/.test(t)) throw new Error(`${nama} harus ASCII`);
  return t;
}
/** Perkara TANPA catatan Minutasi (proses 220) yang ada di SIPP - termasuk yang proses terakhirnya sudah 293/296 (keputusan pengguna 21 Okt). */
function tanpaCatatan(a) {
  return `EXISTS (SELECT 1 FROM __SIPP__.perkara p WHERE p.perkara_id = ${a}.perkara_id)
  AND NOT EXISTS (SELECT 1 FROM __SIPP__.perkara_proses pp WHERE pp.perkara_id = ${a}.perkara_id AND pp.proses_id = ${MINUTASI})`;
}
function penutup(a) {
  return `${a}.jawaban IS NOT NULL AND CHAR_LENGTH(${a}.jawaban) > 0
  AND aps_badilag.isian_rtf_penutup(CONVERT(CAST(${a}.jawaban AS BINARY) USING latin1), IFNULL(CONVERT(CAST(${a}.pertanyaan AS BINARY) USING latin1), '')) = 1`;
}

function prasyaratSql() {
  return ascii(
    `-- Paket ABT "${N}" (21 Okt 2026): PRASYARAT (baca saja). Satu baris: A|B|C|D
--  A = isian_rtf_ket_saksi memanggil penyaring paket x6 (1)    B = fungsi isian_rtf_penutup ada (1)
--  C = tabel SIPP perkara dan perkara_proses ada (2)           D = isian_rtf_keterangan memanggil isian_rtf_penutup, paket x7 (1)
-- Syarat pasang: 1|1|2|1. Selain itu berhenti, tidak ada yang diubah. (Keadaan berkas RTF diperiksa pasang-satker.sh.)
SELECT CONCAT_WS('|',
 (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name='isian_rtf_ket_saksi' AND LOCATE('isian_rtf_saring_penutup', routine_definition) > 0),
 (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name='isian_rtf_penutup'),
 (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='__SIPP__' AND table_name IN ('perkara','perkara_proses')),
 (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name='isian_rtf_keterangan' AND LOCATE('isian_rtf_penutup', routine_definition) > 0)
) AS prasyarat;
`,
    "PRASYARAT.sql"
  );
}
function hitungSql() {
  return ascii(
    `-- Paket ABT "${N}": HITUNG (baca saja). Satu baris: T|R|C
--  T = seluruh baris abt_keterangan_saksi; R = baris di perkara tanpa catatan Minutasi; C = baris di sana yang jawabannya SELURUHNYA penutup (dihapus).
-- Sebelum: T|R|C; sesudah harus T-C|R-C|0.
SELECT CONCAT_WS('|',
 (SELECT COUNT(*) FROM aps_badilag.abt_keterangan_saksi),
 (SELECT COUNT(*) FROM aps_badilag.abt_keterangan_saksi k WHERE ${tanpaCatatan("k")}),
 (SELECT COUNT(*) FROM aps_badilag.abt_keterangan_saksi k WHERE ${tanpaCatatan("k")}
    AND ${penutup("k")})
) AS hitung;
`,
    "HITUNG.sql"
  );
}
function daftarSql() {
  return ascii(
    `-- Paket ABT "${N}": DAFTAR (baca saja) = id baris yang akan dihapus (perkara tanpa catatan Minutasi + jawaban seluruhnya penutup).
SELECT k.id FROM aps_badilag.abt_keterangan_saksi k
WHERE ${tanpaCatatan("k")}
  AND ${penutup("k")}
ORDER BY k.id;
`,
    "DAFTAR.sql"
  );
}
function perkaraSql() {
  return ascii(
    `-- Paket ABT "${N}": PERKARA (baca saja) = per perkara yang punya baris penutup: perkara_id, seluruh baris keterangan saksi, baris penutup.
SELECT k.perkara_id, COUNT(*) AS baris, SUM(IF(${tanpaCatatan("k").replace(/\s+/g, " ")} AND ${penutup("k").replace(/\s+/g, " ")}, 1, 0)) AS penutup
FROM aps_badilag.abt_keterangan_saksi k
WHERE k.perkara_id IN (SELECT e.perkara_id FROM (SELECT DISTINCT d.perkara_id FROM aps_badilag.abt_keterangan_saksi d WHERE ${tanpaCatatan("d")}
    AND ${penutup("d")}) e)
GROUP BY k.perkara_id ORDER BY k.perkara_id;
`,
    "PERKARA.sql"
  );
}
function hapusSql() {
  return ascii(
    `-- Paket ABT "${N}": HAPUS. Hanya id di DAFTAR (penanda __IDS__ diisi pasang-satker.sh) DAN yang masih memenuhi syarat saat dihapus.
DELETE k FROM aps_badilag.abt_keterangan_saksi k
WHERE k.id IN (__IDS__)
  AND ${tanpaCatatan("k")}
  AND ${penutup("k")};
SELECT ROW_COUNT();
`,
    "HAPUS.sql"
  );
}
function periksaSql() {
  return ascii(
    `-- Paket ABT "${N}" (21 Okt 2026): PERIKSA = tak ada lagi baris penutup utuh di perkara tanpa catatan Minutasi. Baris terakhir "SEMUA COCOK". Tidak mengubah apa pun.
SET @ok = 1;
SELECT 'perkara tanpa catatan Minutasi: tak ada baris keterangan saksi yang seluruhnya penutup' AS butir, (@c := ((SELECT COUNT(*) FROM abt_keterangan_saksi k WHERE ${tanpaCatatan("k").replace(/\s+/g, " ")} AND ${penutup("k").replace(/\s+/g, " ")})=0)) AS cocok;
SET @ok = @ok AND IFNULL(@c, 0);
SELECT IF(@ok = 1, 'SEMUA COCOK', 'ADA YANG TIDAK COCOK') AS hasil;
`,
    "PERIKSA.sql"
  );
}

const DAFTAR_RTF = RTF.map(([a, b]) => `${a} ${b}`).join("\n") + "\n";

function pasangSh() {
  return `#!/bin/bash
# =============================================================================
# PASANG paket ABT "${N}" (21 Okt 2026). Dijalankan DI SERVER sebagai root, dari folder paket. Prasyarat: paket x6 dan x7 terpasang.
# (a) hapus dari aps_badilag.abt_keterangan_saksi baris yang jawabannya SELURUHNYA kalimat penutup pada perkara TANPA catatan Minutasi (proses 220) yang
#     x7 lewati (proses terakhir 293/296); cadangan baris lengkap di cadangan/baris-dihapus.sql; baris keterangan perkara & perkara berminutasi tidak disentuh.
# (c) dua BAS non-Derry "P (Kuasa)" (berita_acara_sidang/1 BAS Pertama Standar/01-b dan 01-c): "#0184#" (kedua, sebenarnya tgl register) -> "#0111#"
#     (izin pengguna "boleh, asal pakai kuasa"); md5 sebelum/sesudah dikunci di rtf-md5.txt; cadangan berkas di cadangan/rtf/.
# Urutan: md5 -> PRASYARAT -> praperiksa berkas (md5 persis, tulis TIDAK) -> HITUNG -> CADANGAN -> HAPUS -> RTF -> PERIKSA -> HITUNG sesudah.
# Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_x11 SIPP_DB=sipp_x11 ABT_BLANGKO=<salinan _blangko_abt> bash pasang-satker.sh
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=${N}
CAD="$SINI/cadangan"
ADB="\${ABT_DB:-aps_badilag}"
B="\${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt}"
D="$B/berita_acara_sidang/1 BAS Pertama Standar"
gagal() { echo "GAGAL: $*"; exit 1; }
pulih() { echo "... memulihkan"; bash "$SINI/pulih-satker.sh" 2>&1 | tail -6; }

md5sum -c MD5SUMS.txt >/dev/null 2>&1 || gagal "isi paket rusak (md5sum -c MD5SUMS.txt) - salin ulang paket dengan scp"
if [ "\${ABT_LOKAL:-}" != 1 ] && [ -z "\${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || gagal "sandi DB tidak terbaca dari aleta-bot"
  export MYSQL_PWD
fi
SIPPDB="\${SIPP_DB:-}"
if [ -z "$SIPPDB" ]; then SIPPDB="$(docker exec aleta-bot sh -lc 'printf "%s" "$ALETA_BOT_DB_SIPP_NAME"')" || gagal "nama basis SIPP tak terbaca dari aleta-bot"; fi
[ -n "$SIPPDB" ] || gagal "nama basis SIPP kosong"
H="\${MYSQL_HOST:-127.0.0.1}"
MY="mysql -h $H -u root --default-character-set=latin1 $ADB"
myn() { $MY -N "$@" | tr -d '\\r'; }
sqlf() { if [ "$ADB" = aps_badilag ]; then sed "s/__SIPP__/$SIPPDB/g" "$1"; else sed -e "s/__SIPP__/$SIPPDB/g" -e "s/aps_badilag\\./$ADB./g" "$1"; fi; }
set -o pipefail
rdr() { sqlf "$N-$1.sql" | $MY -N | tr -d '\\r'; }
m5() { md5sum "$1" | cut -c1-32; }
sesudah_dari() { awk -v m="$1" '$1==m {print $2; exit}' rtf-md5.txt; }
sebelum_dari() { awk -v m="$1" '$2==m {print $1; exit}' rtf-md5.txt; }

# --- 1. PRASYARAT (baca saja) -------------------------------------------------------------------------------------------
p=$(rdr PRASYARAT) || gagal "prasyarat tak terbaca - TIDAK ada yang diubah"
echo "PRASYARAT ($p)  [x6-terpasang|fungsi-penutup|tabel-SIPP|x7-terpasang]"
[ "$p" = "1|1|2|1" ] || gagal "prasyarat tidak cocok (harus 1|1|2|1): pasang paket x6 dan x7 lebih dulu - TIDAK ada yang diubah."

# --- 2. praperiksa berkas RTF (tidak menulis) -----------------------------------------------------------------------------------
[ -d "$D" ] || gagal "folder blangko tak ada: $D - TIDAK ada yang diubah"
RTFBARU=0; RTFSUDAH=0; DAFTARRTF="$CAD/rtf-daftar.tmp"
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
: > "$DAFTARRTF"
while IFS= read -r f; do
  [ -n "$f" ] || continue
  mm=$(m5 "$f"); j0=$(grep -a -o '#0184#' "$f" | wc -l); j7=$(grep -a -o '#0207#' "$f" | wc -l); j1=$(grep -a -o '#0111#' "$f" | wc -l)
  if [ -n "$(sesudah_dari "$mm")" ] && [ "$j0" = 1 ] && [ "$j7" = 1 ] && [ "$j1" = 0 ]; then RTFBARU=$((RTFBARU+1)); printf '%s\\n' "$f" >> "$DAFTARRTF"
  elif [ -n "$(sebelum_dari "$mm")" ] && [ "$j0" = 0 ] && [ "$j1" = 1 ]; then RTFSUDAH=$((RTFSUDAH+1))
  else gagal "berkas RTF tak dikenal (md5 $mm; 0184=$j0 0207=$j7 0111=$j1): $(basename "$f") - TIDAK ada yang diubah"; fi
done < <(find "$D" -maxdepth 1 -type f \\( -name '01-b. BAS Pertama P (Kuasa) Tidak Hadir*Tunda Panggil PKuasanya*.rtf' -o -name '01-c. BAS Pertama P (Kuasa) Hadir*Tunda Panggil T.PA.Mj.rtf' \\) | sort)
echo "RTF: perlu diubah=$RTFBARU sudah-diubah=$RTFSUDAH"
[ $((RTFBARU + RTFSUDAH)) -gt 0 ] || gagal "tidak ada berkas BAS P (Kuasa) yang cocok di $D - TIDAK ada yang diubah"

# --- 3. HITUNG sebelum ----------------------------------------------------------------------------------------------------
HS=$(rdr HITUNG) || gagal "HITUNG tak terbaca - TIDAK ada yang diubah"
T0=$(echo "$HS" | cut -d'|' -f1); R0=$(echo "$HS" | cut -d'|' -f2); C0=$(echo "$HS" | cut -d'|' -f3)
echo "SEBELUM: seluruh baris=$T0; baris di perkara tanpa catatan Minutasi=$R0; baris penutup yang dihapus=$C0"
CAP=$(date +%Y%m%d%H%M%S)
if [ "$C0" != 0 ] || [ "$RTFBARU" != 0 ]; then
  UBAH=1
  # --- 4. CADANGAN (tidak pernah menimpa cadangan lama) ----------------------------------------------------------------
  for f in baris-dihapus.sql id-hapus.txt per-perkara-sebelum.tsv per-perkara-sesudah.tsv hitung-sebelum.txt hitung-sesudah.txt periksa-sesudah.txt rtf-sebelum.tsv; do
    [ -f "$CAD/$f" ] && mv "$CAD/$f" "$CAD/$f.$CAP"
  done
  echo "$HS" > "$CAD/hitung-sebelum.txt"
  rdr DAFTAR > "$CAD/id-hapus.txt" || gagal "DAFTAR tak terbaca - TIDAK ada yang diubah"
  NID=$(grep -c . "$CAD/id-hapus.txt")
  [ "$NID" = "$C0" ] || gagal "daftar id ($NID) tidak sama dengan HITUNG ($C0) - TIDAK ada yang diubah"
  rdr PERKARA > "$CAD/per-perkara-sebelum.tsv" || gagal "PERKARA tak terbaca - TIDAK ada yang diubah"
  if [ "$NID" -gt 0 ]; then
    IDS=$(paste -sd, "$CAD/id-hapus.txt")
    mysqldump -h "$H" -u root --default-character-set=latin1 --no-create-info --insert-ignore --skip-extended-insert --complete-insert --skip-comments --skip-triggers \\
      --where="id IN ($IDS)" "$ADB" abt_keterangan_saksi > "$CAD/baris-dihapus.sql" || gagal "cadangan baris gagal - TIDAK ada yang diubah"
    NCAD=$(grep -c '^INSERT' "$CAD/baris-dihapus.sql")
    [ "$NCAD" = "$NID" ] || gagal "cadangan baris ($NCAD) tidak sama dengan daftar ($NID) - TIDAK ada yang diubah"
  else
    : > "$CAD/baris-dihapus.sql"
  fi
  mkdir -p "$CAD/rtf" || gagal "tidak bisa membuat $CAD/rtf"
  : > "$CAD/rtf-sebelum.tsv"
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    cp -p "$f" "$CAD/rtf/$(basename "$f").sebelum-x11" || gagal "cadangan RTF gagal - TIDAK ada yang diubah"
    [ "$(m5 "$CAD/rtf/$(basename "$f").sebelum-x11")" = "$(m5 "$f")" ] || gagal "cadangan RTF tidak sama - TIDAK ada yang diubah"
    printf '%s\\t%s\\n' "$(m5 "$f")" "$f" >> "$CAD/rtf-sebelum.tsv"
  done < "$DAFTARRTF"
  echo "CADANGAN: $CAD (baris dihapus tercadang: $NID; perkara: $(grep -c . "$CAD/per-perkara-sebelum.tsv"); berkas RTF: $RTFBARU)"

  # --- 5. HAPUS baris ----------------------------------------------------------------------------------------------------
  if [ "$NID" -gt 0 ]; then
    IDS=$(paste -sd, "$CAD/id-hapus.txt")
    DIH=$(sqlf "$N-HAPUS.sql" | sed "s/__IDS__/$IDS/" | $MY -N | tr -d '\\r' | tail -1)
    echo "HAPUS: $DIH baris dihapus (diharapkan $NID)"
    [ "$DIH" = "$NID" ] || { pulih; gagal "baris terhapus ($DIH) tidak sama dengan daftar ($NID) - dipulihkan"; }
  fi
  # --- 6. RTF: "#0184#" -> "#0111#" (panjang sama; ditulis ke berkas yang sama agar pemilik/izin tetap) -----------------------------
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    mm=$(m5 "$f"); target=$(sesudah_dari "$mm")
    LC_ALL=C sed 's/#0184#/#0111#/' "$f" > "$CAD/rtf/tulis.tmp"
    [ "$(m5 "$CAD/rtf/tulis.tmp")" = "$target" ] || { rm -f "$CAD/rtf/tulis.tmp"; pulih; gagal "hasil sunting RTF tidak sama dengan yang dikunci ($(basename "$f")) - dipulihkan"; }
    cat "$CAD/rtf/tulis.tmp" > "$f" && rm -f "$CAD/rtf/tulis.tmp"
    [ "$(m5 "$f")" = "$target" ] || { pulih; gagal "berkas tertulis tidak sama ($(basename "$f")) - dipulihkan"; }
  done < "$DAFTARRTF"
  echo "RTF: $RTFBARU berkas diubah (#0184# -> #0111#)"
else
  UBAH=0
  echo "SUDAH bersih (tidak ada baris penutup di perkara tanpa catatan Minutasi; BAS P (Kuasa) sudah diubah) - hanya PERIKSA ulang"
fi
rm -f "$DAFTARRTF"

# --- 7. PERIKSA ----------------------------------------------------------------------------------------------------------------
rdr PERIKSA > "$CAD/periksa-sesudah.txt" 2>&1
if [ "$(tail -1 "$CAD/periksa-sesudah.txt")" != "SEMUA COCOK" ]; then
  cat "$CAD/periksa-sesudah.txt" | head -5
  [ "$UBAH" = 1 ] && pulih
  gagal "PERIKSA tidak cocok$([ "$UBAH" = 1 ] && echo ' - dipulihkan')"
fi
echo "PERIKSA: $(grep -c '	1$' "$CAD/periksa-sesudah.txt") butir cocok - SEMUA COCOK"
HA=$(rdr HITUNG) || gagal "HITUNG sesudah tak terbaca"
echo "$HA" > "$CAD/hitung-sesudah.txt"
T1=$(echo "$HA" | cut -d'|' -f1); R1=$(echo "$HA" | cut -d'|' -f2); C1=$(echo "$HA" | cut -d'|' -f3)
if [ "$UBAH" = 1 ]; then
  if [ "$T1" != "$((T0 - C0))" ] || [ "$R1" != "$((R0 - C0))" ] || [ "$C1" != 0 ]; then
    pulih; gagal "HITUNG sesudah ($HA) tidak sama dengan harapan ($((T0 - C0))|$((R0 - C0))|0) - dipulihkan"
  fi
  if [ -s "$CAD/per-perkara-sebelum.tsv" ]; then
    PL=$(cut -f1 "$CAD/per-perkara-sebelum.tsv" | paste -sd,)
    $MY -N -e "SELECT perkara_id, COUNT(*) FROM abt_keterangan_saksi WHERE perkara_id IN ($PL) GROUP BY perkara_id ORDER BY perkara_id" | tr -d '\\r' > "$CAD/per-perkara-sesudah.tsv"
  fi
fi
echo "SESUDAH: seluruh baris=$T1; baris di perkara tanpa catatan Minutasi=$R1; baris penutup=$C1"
echo "SELESAI - paket $N terpasang. Cadangan: $CAD. Pulih: bash $SINI/pulih-satker.sh"
`;
}

function pulihSh() {
  return `#!/bin/bash
# PULIH paket ABT "${N}" (21 Okt 2026) - deterministik:
#  1) baris yang dihapus dikembalikan dari cadangan/baris-dihapus.sql dengan INSERT IGNORE (yang sudah ada tidak ditimpa);
#  2) berkas RTF dikembalikan dari cadangan/rtf/*.sebelum-x11 HANYA bila md5-nya masih persis hasil paket (yang sudah diubah orang DIBIARKAN dan dilaporkan).
# Baris terakhir harus "PULIH COCOK". Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_x11 SIPP_DB=sipp_x11 ABT_BLANGKO=<salinan _blangko_abt> bash pulih-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=${N}
CAD="$SINI/cadangan"
ADB="\${ABT_DB:-aps_badilag}"
if [ "\${ABT_LOKAL:-}" != 1 ] && [ -z "\${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || { echo "GAGAL: sandi DB tidak terbaca"; exit 1; }
  export MYSQL_PWD
fi
H="\${MYSQL_HOST:-127.0.0.1}"
MY="mysql -h $H -u root --default-character-set=latin1 $ADB"
myn() { $MY -N "$@" | tr -d '\\r'; }
m5() { md5sum "$1" | cut -c1-32; }
set -o pipefail
[ -f "$CAD/hitung-sebelum.txt" ] || { echo "TIDAK ADA cadangan ($CAD/hitung-sebelum.txt) - tidak ada yang dipulihkan"; exit 1; }
BIARKAN=0
if [ -s "$CAD/baris-dihapus.sql" ]; then
  NCAD=$(grep -c '^INSERT' "$CAD/baris-dihapus.sql")
  IDS=$(paste -sd, "$CAD/id-hapus.txt")
  ADA0=$(myn -e "SELECT COUNT(*) FROM abt_keterangan_saksi WHERE id IN ($IDS)")
  $MY < "$CAD/baris-dihapus.sql" || { echo "GAGAL: baris tidak bisa dikembalikan"; exit 1; }
  ADA1=$(myn -e "SELECT COUNT(*) FROM abt_keterangan_saksi WHERE id IN ($IDS)")
  echo "BARIS: tercadang=$NCAD sudah-ada-sebelumnya=$ADA0 dikembalikan=$((ADA1 - ADA0)) ada-sekarang=$ADA1"
  [ "$ADA1" = "$NCAD" ] || BIARKAN=1
else
  echo "BARIS: tidak ada yang tercadang"
fi
KEMBALI=0; SUDAHLAMA=0
if [ -s "$CAD/rtf-sebelum.tsv" ]; then
  while IFS=$'\\t' read -r md f; do
    [ -n "$f" ] || continue
    cad="$CAD/rtf/$(basename "$f").sebelum-x11"
    [ -f "$cad" ] || { echo "BIARKAN $(basename "$f") (cadangan hilang)"; BIARKAN=1; continue; }
    now=$(m5 "$f" 2>/dev/null)
    target=$(awk -v m="$md" '$1==m {print $2; exit}' rtf-md5.txt)
    if [ "$now" = "$md" ]; then SUDAHLAMA=$((SUDAHLAMA+1))
    elif [ -n "$target" ] && [ "$now" = "$target" ]; then
      cat "$cad" > "$f" && [ "$(m5 "$f")" = "$md" ] && KEMBALI=$((KEMBALI+1)) || { echo "GAGAL: $(basename "$f") tidak bisa dikembalikan"; exit 1; }
    else echo "BIARKAN $(basename "$f") (sudah diubah sesudah dipasang)"; BIARKAN=1; fi
  done < "$CAD/rtf-sebelum.tsv"
fi
echo "RTF: kembali=$KEMBALI sudah-lama=$SUDAHLAMA"
if [ "$BIARKAN" = 0 ]; then echo "PULIH COCOK"; else echo "PULIH SEBAGIAN (lihat BIARKAN di atas)"; fi
`;
}

function tulis(nama, isi) {
  fs.writeFileSync(path.join(PK, nama), isi.replace(/\r\n/g, "\n"), "utf8");
}
function bangun() {
  fs.mkdirSync(PK, { recursive: true });
  const berkas = {
    [`${N}-PRASYARAT.sql`]: prasyaratSql(),
    [`${N}-HITUNG.sql`]: hitungSql(),
    [`${N}-DAFTAR.sql`]: daftarSql(),
    [`${N}-PERKARA.sql`]: perkaraSql(),
    [`${N}-HAPUS.sql`]: hapusSql(),
    [`${N}-PERIKSA.sql`]: periksaSql(),
    "rtf-md5.txt": DAFTAR_RTF,
    "pasang-satker.sh": pasangSh(),
    "pulih-satker.sh": pulihSh(),
  };
  for (const [nama, isi] of Object.entries(berkas)) tulis(nama, isi);
  const md5 = Object.keys(berkas)
    .sort()
    .map((nama) => `${crypto.createHash("md5").update(fs.readFileSync(path.join(PK, nama))).digest("hex")} *${nama}`)
    .join("\n");
  tulis("MD5SUMS.txt", md5 + "\n");
  return Object.keys(berkas);
}
module.exports = { prasyaratSql, hitungSql, daftarSql, perkaraSql, hapusSql, periksaSql, bangun, N, RTF };
if (require.main === module) console.log("paket ditulis:", bangun().join(", "));
