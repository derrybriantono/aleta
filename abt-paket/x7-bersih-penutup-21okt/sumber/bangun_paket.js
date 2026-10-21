"use strict";
/**
 * Bangun paket-satker/ paket x7 (21 Okt 2026): pembersihan isian TERSIMPAN kalimat penutup keterangan saksi.
 * pakai: node sumber/bangun_paket.js
 * Keluaran (LF, ASCII): paket-satker/abt-x7-bersih-penutup-21okt-{PRASYARAT,HITUNG,DAFTAR,PERKARA,FUNGSI,PERIKSA}.sql,
 * fungsi-lama.sql, pasang-satker.sh, pulih-satker.sh, MD5SUMS.txt.
 *
 * Aturan hapus (satu sumber dengan paket x6): baris abt_keterangan_saksi yang jawabannya SELURUHNYA kalimat penutup menurut
 * aps_badilag.isian_rtf_penutup(jawaban, pertanyaan) = 1 (pola bot; "tidak sanggup lagi" ikut kolom pertanyaan, keputusan 17 Okt),
 * HANYA untuk perkara BELUM minutasi: ada di SIPP.perkara, proses_terakhir_id < 220 (Minutasi) DAN tak punya baris
 * perkara_proses proses_id = 220. Perkara yang sudah minutasi, atau yang sudah lewat Minutasi walau catatan prosesnya tak ada
 * (Penetapan Hari Sidang Ikrar Talak 293, Akta Cerai 296, dst.), tidak disentuh: arsipnya harus sama dengan putusan/BAS yang ditandatangani.
 */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const AKAR = path.resolve(__dirname, "..");
const PK = path.join(AKAR, "paket-satker");
const N = "abt-x7-bersih-penutup-21okt";

// md5 routine_definition isian_rtf_keterangan di server 21 Okt 2026 (versi I3 / abt-netral-db-derry), dibaca baca-saja.
const MD5_KET_LAMA = "9b005e6442a8b8731f97f3b8dbe98a61";
const MINUTASI = 220;

function ascii(t, nama) {
  if (/[^\x09\x0a\x20-\x7e]/.test(t)) throw new Error(`${nama} harus ASCII`);
  return t;
}

/** Perkara BELUM minutasi untuk alias tabel `a` (berisi kolom perkara_id). */
function belumMinutasi(a) {
  return `EXISTS (SELECT 1 FROM __SIPP__.perkara p WHERE p.perkara_id = ${a}.perkara_id AND p.proses_terakhir_id < ${MINUTASI})
  AND NOT EXISTS (SELECT 1 FROM __SIPP__.perkara_proses pp WHERE pp.perkara_id = ${a}.perkara_id AND pp.proses_id = ${MINUTASI})`;
}
/** Jawaban SELURUHNYA kalimat penutup (aturan x6), alias `a`. */
function penutup(a) {
  return `${a}.jawaban IS NOT NULL AND CHAR_LENGTH(${a}.jawaban) > 0
  AND aps_badilag.isian_rtf_penutup(CONVERT(CAST(${a}.jawaban AS BINARY) USING latin1), IFNULL(CONVERT(CAST(${a}.pertanyaan AS BINARY) USING latin1), '')) = 1`;
}

function prasyaratSql() {
  return ascii(
    `-- Paket ABT "${N}" (21 Okt 2026): PRASYARAT (baca saja). Satu baris: A|B|C|D|E
--  A = isian_rtf_ket_saksi sudah memanggil penyaring paket x6 (1)  - x6 WAJIB terpasang lebih dulu
--  B = fungsi isian_rtf_penutup ada (1)
--  C = tabel SIPP perkara dan perkara_proses ada (2)
--  D = isian_rtf_keterangan masih TEPAT versi lama - md5 definisi, nama basis disamakan (1 sebelum, 0 sesudah)
--  E = isian_rtf_keterangan sudah memanggil isian_rtf_penutup (0 sebelum, 1 sesudah)
-- Syarat pasang: 1|1|2|1|0; pasang ulang: 1|1|2|0|1. Selain itu berhenti, tidak ada yang diubah.
SELECT CONCAT_WS('|',
 (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name='isian_rtf_ket_saksi' AND LOCATE('isian_rtf_saring_penutup', routine_definition) > 0),
 (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name='isian_rtf_penutup'),
 (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='__SIPP__' AND table_name IN ('perkara','perkara_proses')),
 (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name='isian_rtf_keterangan'
    AND LOCATE('isian_rtf_penutup', routine_definition) = 0
    AND MD5(REPLACE(routine_definition, CONCAT(DATABASE(), '.abt_'), CONCAT('aps_badilag', '.abt_'))) = '${MD5_KET_LAMA}'),
 (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name='isian_rtf_keterangan'
    AND LOCATE('isian_rtf_penutup', routine_definition) > 0)
) AS prasyarat;
`,
    "PRASYARAT.sql"
  );
}

function hitungSql() {
  return ascii(
    `-- Paket ABT "${N}": HITUNG (baca saja). Satu baris: T|R|C
--  T = seluruh baris abt_keterangan_saksi
--  R = baris di perkara BELUM minutasi (sasaran paket)
--  C = baris di perkara belum minutasi yang jawabannya SELURUHNYA kalimat penutup (yang akan dihapus)
-- Sebelum: T|R|C; sesudah harus T-C|R-C|0.
SELECT CONCAT_WS('|',
 (SELECT COUNT(*) FROM aps_badilag.abt_keterangan_saksi),
 (SELECT COUNT(*) FROM aps_badilag.abt_keterangan_saksi k WHERE ${belumMinutasi("k")}),
 (SELECT COUNT(*) FROM aps_badilag.abt_keterangan_saksi k WHERE ${belumMinutasi("k")}
    AND ${penutup("k")})
) AS hitung;
`,
    "HITUNG.sql"
  );
}

function daftarSql() {
  return ascii(
    `-- Paket ABT "${N}": DAFTAR (baca saja) = id baris abt_keterangan_saksi yang akan dihapus (perkara belum minutasi + jawaban seluruhnya penutup).
SELECT k.id FROM aps_badilag.abt_keterangan_saksi k
WHERE ${belumMinutasi("k")}
  AND ${penutup("k")}
ORDER BY k.id;
`,
    "DAFTAR.sql"
  );
}

/** Perkara yang terkena (untuk angka sebelum/sesudah per perkara): perkara_id, jumlah baris, jumlah baris penutup. */
function perkaraSql() {
  return ascii(
    `-- Paket ABT "${N}": PERKARA (baca saja) = per perkara yang punya baris penutup: perkara_id, seluruh baris keterangan saksi, baris penutup.
-- Sesudah paket, jumlah baris penutup 0 dan seluruh baris berkurang tepat sebanyak baris penutup (perkara_id saja, tanpa nama).
SELECT k.perkara_id, COUNT(*) AS baris, SUM(IF(${belumMinutasi("k").replace(/\s+/g, " ")} AND ${penutup("k").replace(/\s+/g, " ")}, 1, 0)) AS penutup
FROM aps_badilag.abt_keterangan_saksi k
WHERE k.perkara_id IN (SELECT e.perkara_id FROM (SELECT DISTINCT d.perkara_id FROM aps_badilag.abt_keterangan_saksi d WHERE ${belumMinutasi("d")}
    AND ${penutup("d")}) e)
GROUP BY k.perkara_id ORDER BY k.perkara_id;
`,
    "PERKARA.sql"
  );
}

/** isian_rtf_keterangan baru = versi lama + penyaring penutup (satu aturan dengan isian_rtf_ket_saksi paket x6). */
function fungsiSql() {
  let t = fs.readFileSync(path.join(__dirname, "fungsi-lama-server-21okt.sql"), "utf8").replace(/\r\n/g, "\n");
  const ganti = (dari, ke) => {
    if (t.split(dari).length !== 2) throw new Error(`penanda tidak tunggal: ${dari.slice(0, 60)}`);
    t = t.replace(dari, ke);
  };
  ganti("  DECLARE j LONGTEXT CHARSET utf8mb4;\n", "  DECLARE j LONGTEXT CHARSET utf8mb4;\n  DECLARE jq LONGTEXT CHARSET utf8mb4;\n");
  ganti("    SELECT jawaban FROM aps_badilag.abt_keterangan_terdakwa WHERE", "    SELECT jawaban, pertanyaan FROM aps_badilag.abt_keterangan_terdakwa WHERE");
  ganti("      FETCH cur INTO j;", "      FETCH cur INTO j, jq;");
  ganti(
    "      IF j IS NOT NULL AND CHAR_LENGTH(j) > 0 AND NOT (BINARY j = '0') THEN",
    "      IF j IS NOT NULL AND CHAR_LENGTH(j) > 0 AND NOT (BINARY j = '0')\n        AND isian_rtf_penutup(CONVERT(CAST(j AS BINARY) USING latin1), IFNULL(CONVERT(CAST(jq AS BINARY) USING latin1), '')) = 0 THEN"
  );
  ganti("COMMENT 'I3: jawab-menjawab lisan ABT", "COMMENT 'I3+X7: jawab-menjawab lisan ABT");
  ganti("(pengganti list_keterangan)'", "(pengganti list_keterangan), tanpa kalimat penutup (sudah cukup dst.)'");
  t = t.replace(/^-- X7: fungsi isian_rtf_keterangan VERSI LAMA[^\n]*\n-- Dipakai pulih-satker\.sh[^\n]*\n/, "");
  const kepala = `-- =====================================================================================================
-- X7 (21 Okt 2026): jawaban lisan (jawaban/replik/duplik, abt_keterangan_terdakwa) juga tidak mencetak kalimat penutup pemeriksaan
-- ("Sudah cukup;" atas "Apakah masih ada yang ingin Saudara sampaikan?"): isian_rtf_keterangan (variabel 9252-9254) kini melewati baris yang
-- jawabannya SELURUHNYA penutup menurut isian_rtf_penutup (paket x6, pola bot, kolom pertanyaan ikut menentukan). Selebihnya sama persis dengan
-- versi I3. Hanya MEMBACA abt_keterangan_terdakwa. Nama fungsi netral.
-- =====================================================================================================
`;
  return ascii(kepala + t, "FUNGSI.sql");
}

function hapusSql() {
  return ascii(
    `-- Paket ABT "${N}": HAPUS. Hanya id yang ada di DAFTAR (penanda __IDS__ diisi pasang-satker.sh) DAN yang masih memenuhi syarat saat dihapus.
DELETE k FROM aps_badilag.abt_keterangan_saksi k
WHERE k.id IN (__IDS__)
  AND ${belumMinutasi("k")}
  AND ${penutup("k")};
SELECT ROW_COUNT();
`,
    "HAPUS.sql"
  );
}

function periksaSql() {
  const butir = [];
  const cek = (nama, ekspresi) => butir.push(`SELECT '${nama}' AS butir, (@c := (${ekspresi})) AS cocok;\nSET @ok = @ok AND IFNULL(@c, 0);`);
  cek("isian_rtf_keterangan memanggil isian_rtf_penutup", `(SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_name='isian_rtf_keterangan' AND LOCATE('isian_rtf_penutup', routine_definition) > 0)=1`);
  cek("isian_rtf_keterangan tanpa pihak atau NULL tetap tanda strip titik-titik", `isian_rtf_keterangan(0, NULL, 'Tergugat')='- ...' AND isian_rtf_keterangan(0, '0', 'Tergugat')='- ...'`);
  cek("x6 masih benar: penutup dikenali, jawaban perkara tidak",
    `isian_rtf_penutup('Sudah cukup;', 'Apakah masih ada yang ingin Saudara sampaikan ?')=1 AND isian_rtf_penutup('Saya tidak sanggup lagi;', 'Apakah saksi masih sanggup untuk mendamaikan Penggugat dan Tergugat?')=0 AND isian_rtf_penutup('Selama pisah sudah tidak ada komunikasi;', '')=0`);
  cek("jawaban lisan: tak satu pun kelompok mencetak butir penutup",
    `(SELECT COUNT(*) FROM (SELECT DISTINCT perkara_id, pihak_id FROM abt_keterangan_terdakwa WHERE perkara_id IS NOT NULL AND pihak_id IS NOT NULL AND (jawaban LIKE '%cukup%' OR jawaban LIKE '%sekian%' OR jawaban LIKE '%tidak ada%')) g WHERE isian_rtf_keterangan(g.perkara_id, CAST(g.pihak_id AS CHAR), 'Tergugat') REGEXP '(^|[[:space:]])- Bahwa ((tidak ada|tidak|ya|iya|baik), )?((saya|saksi|tergugat|termohon) )?((sudah|telah|memang|sekarang) )*(cukup|sekian|tidak ada lagi|sampai di sini)( sekian| saja| dulu)*[ ;.,]*($|[[:space:]])')=0`);
  cek("perkara belum minutasi: tak ada lagi baris keterangan saksi yang seluruhnya penutup",
    `(SELECT COUNT(*) FROM abt_keterangan_saksi k WHERE ${belumMinutasi("k").replace(/\s+/g, " ")} AND ${penutup("k").replace(/\s+/g, " ")})=0`);
  return ascii(
    `-- Paket ABT "${N}" (21 Okt 2026): PERIKSA = fungsi jawaban lisan memakai penyaring x6 + tak ada lagi baris penutup di perkara belum minutasi.
-- Baris terakhir "SEMUA COCOK". Tidak mengubah apa pun. (Angka sebelum/sesudah dan perkara minutasi diperiksa pasang-satker.sh dari HITUNG.)
SET @ok = 1;
${butir.join("\n")}
SELECT IF(@ok = 1, 'SEMUA COCOK', 'ADA YANG TIDAK COCOK') AS hasil;
`,
    "PERIKSA.sql"
  );
}

function pasangSh() {
  return `#!/bin/bash
# =============================================================================
# PASANG paket ABT "${N}" (21 Okt 2026). Dijalankan DI SERVER sebagai root, dari folder paket.
# Isi: (1) hapus dari aps_badilag.abt_keterangan_saksi baris yang jawabannya SELURUHNYA kalimat penutup (isian_rtf_penutup, paket x6)
#      untuk perkara BELUM minutasi saja (SIPP.perkara proses_terakhir_id < 220 dan tanpa perkara_proses 220); baris keterangan perkara
#      dan perkara yang sudah minutasi TIDAK disentuh; (2) isian_rtf_keterangan (jawaban lisan) memakai penyaring yang sama.
# PRASYARAT: paket x6 sudah terpasang. Cadangan LENGKAP baris yang dihapus (INSERT IGNORE persis) di cadangan/baris-dihapus.sql.
# Urutan: md5 -> PRASYARAT -> HITUNG -> CADANGAN -> FUNGSI -> HAPUS -> PERIKSA -> HITUNG sesudah. Gagal sesudah CADANGAN = PULIH otomatis.
# Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_x7 SIPP_DB=sipp_x7 bash pasang-satker.sh   (nama basis di berkas SQL disesuaikan otomatis)
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=${N}
CAD="$SINI/cadangan"
ADB="\${ABT_DB:-aps_badilag}"
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
myn() { $MY -N "$@" | tr -d '\\r'; }   # klien mysql Windows menulis CRLF; di Linux tr tidak mengubah apa pun
# berkas SQL memakai nama basis aps_badilag dan penanda __SIPP__; disesuaikan di sini
sqlf() { if [ "$ADB" = aps_badilag ]; then sed "s/__SIPP__/$SIPPDB/g" "$1"; else sed -e "s/__SIPP__/$SIPPDB/g" -e "s/aps_badilag\\./$ADB./g" "$1"; fi; }
set -o pipefail
rdr() { sqlf "$N-$1.sql" | $MY -N | tr -d '\\r'; }

# --- 1. PRASYARAT (baca saja) -------------------------------------------------------------------------------------------
p=$(rdr PRASYARAT) || gagal "prasyarat tak terbaca - TIDAK ada yang diubah"
echo "PRASYARAT ($p)  [x6-terpasang|fungsi-penutup|tabel-SIPP|keterangan-lama|keterangan-baru]"
MODE=
if [ "$p" = "1|1|2|1|0" ]; then MODE=BARU
elif [ "$p" = "1|1|2|0|1" ]; then MODE=ULANG
else gagal "prasyarat tidak cocok (harus 1|1|2|1|0; 1|1|2|0|1 pada pasang ulang). Pasang paket x6 (abt-x6-penutup-saksi-21okt) lebih dulu; isian_rtf_keterangan harus versi I3 - TIDAK ada yang diubah."; fi
echo "MODE $MODE (SIPP=$SIPPDB)"
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
CAP=$(date +%Y%m%d%H%M%S)

# --- 2. HITUNG sebelum ----------------------------------------------------------------------------------------------------
HS=$(rdr HITUNG) || gagal "HITUNG tak terbaca - TIDAK ada yang diubah"
T0=$(echo "$HS" | cut -d'|' -f1); R0=$(echo "$HS" | cut -d'|' -f2); C0=$(echo "$HS" | cut -d'|' -f3)
UBAH=0; if [ "$MODE" = BARU ] || [ "$C0" != 0 ]; then UBAH=1; fi
echo "SEBELUM: seluruh baris=$T0; baris di perkara belum minutasi=$R0; baris penutup yang dihapus=$C0"

if [ "$MODE" = BARU ] || [ "$C0" != 0 ]; then
  # --- 3. CADANGAN (tidak pernah menimpa cadangan lama) ----------------------------------------------------------------
  for f in baris-dihapus.sql id-hapus.txt per-perkara-sebelum.tsv per-perkara-sesudah.tsv md5-ket-sebelum.txt md5-ket-sesudah.txt fungsi-sebelum.sql hitung-sebelum.txt hitung-sesudah.txt periksa-sesudah.txt; do
    [ -f "$CAD/$f" ] && mv "$CAD/$f" "$CAD/$f.$CAP"
  done
  echo "$HS" > "$CAD/hitung-sebelum.txt"
  mysqldump -h "$H" -u root --default-character-set=latin1 --routines --no-create-info --no-data --skip-triggers --skip-comments "$ADB" > "$CAD/fungsi-sebelum.sql" \\
    || gagal "cadangan fungsi DB gagal - TIDAK ada yang diubah"
  grep -q 'FUNCTION \`isian_rtf_keterangan\`' "$CAD/fungsi-sebelum.sql" || gagal "cadangan fungsi tidak memuat isian_rtf_keterangan - TIDAK ada yang diubah"
  myn -e "SELECT MD5(REPLACE(routine_definition, CONCAT(DATABASE(), '.abt_'), 'aps_badilag.abt_')) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_name='isian_rtf_keterangan'" > "$CAD/md5-ket-sebelum.txt"
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
  echo "CADANGAN: $CAD (baris dihapus tercadang: $NID; perkara: $(($(grep -c . "$CAD/per-perkara-sebelum.tsv"))))"

  # --- 4. FUNGSI (jawaban lisan) ---------------------------------------------------------------------------------------
  if [ "$MODE" = BARU ]; then
    sqlf "$N-FUNGSI.sql" | $MY > "$CAD/fungsi-pasang.log" 2>&1 || { tail -5 "$CAD/fungsi-pasang.log"; pulih; gagal "isian_rtf_keterangan tidak bisa dibuat - dipulihkan"; }
    myn -e "SELECT MD5(REPLACE(routine_definition, CONCAT(DATABASE(), '.abt_'), 'aps_badilag.abt_')) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_name='isian_rtf_keterangan'" > "$CAD/md5-ket-sesudah.txt"
  fi

  # --- 5. HAPUS (hanya id di daftar, dan hanya bila masih memenuhi syarat) -------------------------------------------------
  if [ "$NID" -gt 0 ]; then
    IDS=$(paste -sd, "$CAD/id-hapus.txt")
    DIH=$(sqlf "$N-HAPUS.sql" | sed "s/__IDS__/$IDS/" | $MY -N | tr -d '\\r' | tail -1)
    echo "HAPUS: $DIH baris dihapus (diharapkan $NID)"
    [ "$DIH" = "$NID" ] || { pulih; gagal "baris terhapus ($DIH) tidak sama dengan daftar ($NID) - dipulihkan"; }
  fi
else
  echo "SUDAH bersih (tidak ada baris penutup di perkara belum minutasi) - hanya PERIKSA ulang"
fi

# --- 6. PERIKSA ----------------------------------------------------------------------------------------------------------------
rdr PERIKSA > "$CAD/periksa-sesudah.txt" 2>&1
if [ "$(tail -1 "$CAD/periksa-sesudah.txt")" != "SEMUA COCOK" ]; then
  grep -v '	1$' "$CAD/periksa-sesudah.txt" | head -20
  [ "$UBAH" = 1 ] && pulih
  gagal "PERIKSA tidak cocok$([ "$UBAH" = 1 ] && echo ' - dipulihkan')"
fi
echo "PERIKSA: $(grep -c '	1$' "$CAD/periksa-sesudah.txt") butir cocok - SEMUA COCOK"

# --- 7. HITUNG sesudah: T-C | R-C | 0 ------------------------------------------------------------------------------------------
HA=$(rdr HITUNG) || gagal "HITUNG sesudah tak terbaca"
echo "$HA" > "$CAD/hitung-sesudah.txt"
T1=$(echo "$HA" | cut -d'|' -f1); R1=$(echo "$HA" | cut -d'|' -f2); C1=$(echo "$HA" | cut -d'|' -f3)
if [ "$MODE" = BARU ] || [ "$C0" != 0 ]; then
  if [ "$T1" != "$((T0 - C0))" ] || [ "$R1" != "$((R0 - C0))" ] || [ "$C1" != 0 ]; then
    pulih; gagal "HITUNG sesudah ($HA) tidak sama dengan harapan ($((T0 - C0))|$((R0 - C0))|0) - dipulihkan"
  fi
  if [ -s "$CAD/per-perkara-sebelum.tsv" ]; then
    PL=$(cut -f1 "$CAD/per-perkara-sebelum.tsv" | paste -sd,)
    $MY -N -e "SELECT perkara_id, COUNT(*) FROM abt_keterangan_saksi WHERE perkara_id IN ($PL) GROUP BY perkara_id ORDER BY perkara_id" | tr -d '\\r' > "$CAD/per-perkara-sesudah.tsv"
  fi
fi
echo "SESUDAH: seluruh baris=$T1; baris di perkara belum minutasi=$R1; baris penutup=$C1"
echo "PER PERKARA (perkara_id, baris sebelum, baris penutup, baris sesudah): $CAD/per-perkara-sebelum.tsv / per-perkara-sesudah.tsv"
echo "SELESAI - paket $N terpasang. Cadangan: $CAD. Pulih: bash $SINI/pulih-satker.sh"
`;
}

function pulihSh() {
  return `#!/bin/bash
# PULIH paket ABT "${N}" (21 Okt 2026) - deterministik:
#  1) baris yang dihapus dikembalikan dari cadangan/baris-dihapus.sql dengan INSERT IGNORE (baris yang sudah ada kembali atau kuncinya diisi
#     ulang oleh orang TIDAK ditimpa; jumlahnya dilaporkan);
#  2) isian_rtf_keterangan dikembalikan dari fungsi-lama.sql HANYA bila isinya (md5 definisi) masih persis hasil paket (atau fungsinya hilang).
# Baris terakhir harus "PULIH COCOK". Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_x7 SIPP_DB=sipp_x7 bash pulih-satker.sh
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
sqlf() { if [ "$ADB" = aps_badilag ]; then cat "$1"; else sed "s/aps_badilag\\./$ADB./g" "$1"; fi; }
set -o pipefail
[ -f "$CAD/hitung-sebelum.txt" ] || { echo "TIDAK ADA cadangan ($CAD/hitung-sebelum.txt) - tidak ada yang dipulihkan"; exit 1; }
BIARKAN=0
# 1. baris
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
# 2. fungsi
LAMA=$(awk 'NR==1{print $1}' "$CAD/md5-ket-sebelum.txt" 2>/dev/null)
BARU=$(awk 'NR==1{print $1}' "$CAD/md5-ket-sesudah.txt" 2>/dev/null)
NOW=$(myn -e "SELECT MD5(REPLACE(routine_definition, CONCAT(DATABASE(), '.abt_'), 'aps_badilag.abt_')) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_name='isian_rtf_keterangan'")
if [ -z "$LAMA" ]; then
  echo "FUNGSI: tidak ada cadangan md5 - tidak disentuh"
elif [ "$NOW" = "$LAMA" ]; then
  echo "isian_rtf_keterangan SUDAH versi lama"
elif [ -z "$NOW" ] || { [ -n "$BARU" ] && [ "$NOW" = "$BARU" ]; }; then
  sqlf "$SINI/fungsi-lama.sql" | $MY > "$CAD/fungsi-pulih.log" 2>&1 || { echo "GAGAL: fungsi lama tidak bisa dibuat ulang (lihat $CAD/fungsi-pulih.log)"; exit 1; }
  echo "isian_rtf_keterangan DIKEMBALIKAN ke versi lama"
else
  echo "BIARKAN isian_rtf_keterangan (sudah diubah sesudah dipasang)"; BIARKAN=1
fi
NOW2=$(myn -e "SELECT MD5(REPLACE(routine_definition, CONCAT(DATABASE(), '.abt_'), 'aps_badilag.abt_')) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_name='isian_rtf_keterangan'")
echo "FUNGSI isian_rtf_keterangan=$([ -n "$LAMA" ] && [ "$NOW2" = "$LAMA" ] && echo lama || echo lain)"
if [ "$BIARKAN" = 0 ] && { [ -z "$LAMA" ] || [ "$NOW2" = "$LAMA" ]; }; then echo "PULIH COCOK"; else echo "PULIH SEBAGIAN (lihat BIARKAN/PERINGATAN di atas)"; fi
`;
}

function tulis(nama, isi) {
  fs.writeFileSync(path.join(PK, nama), isi.replace(/\r\n/g, "\n"), "utf8");
}

function bangun() {
  fs.mkdirSync(PK, { recursive: true });
  const lama = ascii(fs.readFileSync(path.join(__dirname, "fungsi-lama-server-21okt.sql"), "utf8").replace(/\r\n/g, "\n"), "fungsi-lama");
  const berkas = {
    [`${N}-PRASYARAT.sql`]: prasyaratSql(),
    [`${N}-HITUNG.sql`]: hitungSql(),
    [`${N}-DAFTAR.sql`]: daftarSql(),
    [`${N}-PERKARA.sql`]: perkaraSql(),
    [`${N}-FUNGSI.sql`]: fungsiSql(),
    [`${N}-PERIKSA.sql`]: periksaSql(),
    [`${N}-HAPUS.sql`]: hapusSql(),
    "fungsi-lama.sql": lama,
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

module.exports = { hapusSql, prasyaratSql, hitungSql, daftarSql, perkaraSql, fungsiSql, periksaSql, bangun, N, MD5_KET_LAMA, belumMinutasi, penutup };

if (require.main === module) console.log("paket ditulis:", bangun().join(", "));
