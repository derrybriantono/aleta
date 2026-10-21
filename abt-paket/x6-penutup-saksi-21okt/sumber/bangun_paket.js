"use strict";
/**
 * Bangun paket-satker/ paket x6 dari sumber: templat-fungsi.sql + pola dari aleta_bot/services/penutupSaksi.js
 * (diterjemahkan mekanis oleh pola_posix.js) + contoh.js (harapan dihitung fungsi bot).
 * pakai: node sumber/bangun_paket.js
 * Keluaran (LF, ASCII): paket-satker/abt-x6-penutup-saksi-21okt-{FUNGSI,PRASYARAT,PERIKSA,HITUNG}.sql, pasang-satker.sh,
 * pulih-satker.sh, MD5SUMS.txt (fungsi-lama.sql dibuat dari sumber/fungsi-lama-server-21okt.sql).
 */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { POLA } = require("./pola_posix.js");
const { daftarContoh } = require("./contoh.js");

const AKAR = path.resolve(__dirname, "..");
const PK = path.join(AKAR, "paket-satker");
const N = "abt-x6-penutup-saksi-21okt";
const RAIZ = path.resolve(AKAR, "../..");
const { adalahKalimatPenutupSaksi } = require(path.join(RAIZ, "aleta_bot/services/penutupSaksi.js"));

// md5 routine_definition isian_rtf_ket_saksi di server 21 Okt 2026 (versi I3 / abt-netral-db-derry), dibaca baca-saja.
const MD5_KET_SAKSI_LAMA = "f984ebccf51a11d4f3779cc9092fd491";

const ISI = {
  __TIDAK_ADA__: POLA.tidakAda,
  __KETAHUI__: POLA.ketahui,
  __LAGI_LAIN__: POLA.lagiLain,
  __LENTUR__: POLA.lentur,
  __KESANGGUPAN__: POLA.kesanggupan,
  __KERJA__: POLA.kerja,
  __PASTI__: POLA.pasti,
  __TANYA_KESANGGUPAN__: POLA.tanyaKesanggupanPerkara,
  __TANYA_PENUTUP_A__: POLA.tanyaPenutupA,
  __TANYA_PENUTUP_B__: POLA.tanyaPenutupB,
};

function pastikanAscii(t, nama) {
  if (/[^\x09\x0a\x20-\x7e]/.test(t)) throw new Error(`${nama} harus ASCII`);
  return t;
}

function fungsiSql() {
  let t = fs.readFileSync(path.join(__dirname, "templat-fungsi.sql"), "utf8").replace(/\r\n/g, "\n");
  for (const [k, v] of Object.entries(ISI)) {
    if (!t.includes(k)) throw new Error(`penanda ${k} tidak ada di templat`);
    t = t.split(k).join(v);
  }
  if (/__[A-Z_]+__/.test(t)) throw new Error("penanda templat tersisa");
  return pastikanAscii(t, "FUNGSI.sql");
}

/** Literal SQL tanpa garis miring terbalik (tidak bergantung sql_mode): ' digandakan, baris baru lewat CHAR(10). */
function lit(s) {
  const bagian = String(s).split("\n").map((b) => `'${b.replace(/'/g, "''")}'`);
  if (bagian.length === 1) return bagian[0];
  return `CONCAT(${bagian.join(", CHAR(10), ")})`;
}

const SEBELUM = "1|0|1|0";
const SESUDAH = "1|2|0|1";

function prasyaratSql() {
  return pastikanAscii(
    `-- Paket ABT "${N}" (21 Okt 2026): PRASYARAT (baca saja). Satu baris: A|B|C|D|E|F
--  A = fungsi isian_rtf_ket_saksi (1)
--  B = fungsi baru isian_rtf_penutup + isian_rtf_saring_penutup (0 sebelum, 2 sesudah)
--  C = isian_rtf_ket_saksi masih TEPAT versi lama (md5 definisi, nama basis disamakan) (1 sebelum, 0 sesudah)
--  D = isian_rtf_ket_saksi sudah memanggil isian_rtf_saring_penutup (0 sebelum, 1 sesudah)
--  E = variabel abt_variabel yang memanggil isian_rtf_ket_saksi (info; 7 di server 21 Okt: 9259-9265)
--  F = fungsi isian_rtf_* seluruhnya (info; 20 sebelum, 22 sesudah)
-- Syarat pasang: A|B|C|D = ${SEBELUM}; pasang ulang: ${SESUDAH}. Selain itu berhenti, tidak ada yang diubah.
SELECT CONCAT_WS('|',
 (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name='isian_rtf_ket_saksi'),
 (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name IN ('isian_rtf_penutup','isian_rtf_saring_penutup')),
 (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name='isian_rtf_ket_saksi'
    AND LOCATE('isian_rtf_saring_penutup', routine_definition) = 0
    AND MD5(REPLACE(routine_definition, CONCAT(DATABASE(), '.abt_'), 'aps_badilag.abt_')) = '${MD5_KET_SAKSI_LAMA}'),
 (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name='isian_rtf_ket_saksi'
    AND LOCATE('isian_rtf_saring_penutup', routine_definition) > 0),
 (SELECT COUNT(*) FROM abt_variabel WHERE LOCATE('isian_rtf_ket_saksi', IFNULL(sql_query, '')) > 0),
 (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name LIKE 'isian\\_rtf\\_%')
) AS prasyarat;
`,
    "PRASYARAT.sql"
  );
}

/** Kelompok saksi (perkara, saksi) yang KELUARANNYA memuat butir penutup (detektor kasar yang bebas dari fungsi penyaring). */
function hitungSql() {
  return pastikanAscii(
    `-- Paket ABT "${N}": HITUNG (baca saja) = berapa kelompok saksi (perkara + saksi) yang keluaran isian_rtf_ket_saksi-nya memuat
-- butir kalimat penutup ("- Bahwa sudah cukup;", "cukup sekian", "tidak ada lagi ...", "sampai di sini"). Sebelum paket > 0, sesudah 0.
-- Detektor ini kasar dan berdiri sendiri (bukan pola penyaring); bentuk "tidak sanggup lagi" tidak dihitung (keterangan perkara
-- bila pertanyaannya soal mendamaikan).
SELECT COUNT(*) AS kelompok_memuat_penutup
FROM (SELECT DISTINCT perkara_id, saksi_id FROM abt_keterangan_saksi
       WHERE perkara_id IS NOT NULL AND saksi_id IS NOT NULL
         AND (jawaban LIKE '%cukup%' OR jawaban LIKE '%sekian%' OR jawaban LIKE '%tidak ada%' OR jawaban LIKE '%sampai di sini%')) g
WHERE isian_rtf_ket_saksi(g.perkara_id, CAST(g.saksi_id AS CHAR))
      REGEXP '(^|<br>)-   Bahwa ((tidak ada|tidak|ya|iya|baik), )?((saya|saksi) )?((sudah|telah|memang|sekarang) )*(cukup|sekian|tidak ada lagi|sampai di sini)( sekian| saja| dulu)*[ ;.,]*(<br>|$)';
`,
    "HITUNG.sql"
  );
}

function periksaSql() {
  const contoh = daftarContoh(adalahKalimatPenutupSaksi);
  const satu = contoh.map((x) => `SELECT ${lit(x.t)} AS t, ${lit(x.q)} AS q, ${x.e} AS e`).join("\n UNION ALL ");
  const positif = contoh.filter((x) => x.e === 1).length;
  const butir = [];
  const cek = (nama, ekspresi) => butir.push(`SELECT ${lit(nama)} AS butir, (@c := (${ekspresi})) AS cocok;\nSET @ok = @ok AND IFNULL(@c, 0);`);
  cek("tiga fungsi ada", `(SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name IN ('isian_rtf_penutup','isian_rtf_saring_penutup','isian_rtf_ket_saksi'))=3`);
  cek("isian_rtf_ket_saksi memanggil penyaring", `(SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_name='isian_rtf_ket_saksi' AND LOCATE('isian_rtf_saring_penutup', routine_definition) > 0)=1`);
  cek("variabel pemanggil tidak berubah (nama fungsi sama)", `(SELECT COUNT(*) FROM abt_variabel WHERE no_var BETWEEN 9259 AND 9265 AND LOCATE('isian_rtf_ket_saksi', IFNULL(sql_query, '')) > 0)=7`);
  cek(`isian_rtf_penutup sama dengan bot atas ${contoh.length} contoh (${positif} penutup, ${contoh.length - positif} bukan)`,
    `(SELECT COUNT(*) FROM (\n${satu}\n) z WHERE isian_rtf_penutup(z.t, z.q) <> z.e)=0`);
  cek("isian_rtf_penutup: NULL dan teks sangat panjang bukan penutup", `isian_rtf_penutup(NULL, NULL)=0 AND isian_rtf_penutup(REPEAT('cukup ', 100), '')=0`);
  cek("saring: penutup di ujung jawaban beberapa baris dibuang", `isian_rtf_saring_penutup(${lit("Tergugat pergi sejak 2024;\nSudah cukup;")}, '')='Tergugat pergi sejak 2024;'`);
  cek("saring: seluruh jawaban penutup (terbelah baris) -> kosong", `isian_rtf_saring_penutup(${lit("Sudah\ncukup;")}, '')='' AND isian_rtf_saring_penutup('Sudah cukup;', '')='' AND isian_rtf_saring_penutup(NULL, '')=''`);
  cek("saring: pecahan baris di tengah kalimat tidak dipotong", `isian_rtf_saring_penutup(${lit("nafkah yang diberikan Tergugat kepada Penggugat tidak\ncukup;")}, '')=${lit("nafkah yang diberikan Tergugat kepada Penggugat tidak\ncukup;")}`);
  cek("saring: jawaban biasa tidak berubah sama sekali", `isian_rtf_saring_penutup('Saya kenal Penggugat dan Tergugat;', '')='Saya kenal Penggugat dan Tergugat;' AND isian_rtf_saring_penutup(${lit("Satu;\n\nDua;")}, '')=${lit("Satu;\n\nDua;")}`);
  cek("saring: tidak sanggup lagi - jawaban perkara bila pertanyaannya mendamaikan, penutup bila pertanyaannya penutup",
    `isian_rtf_saring_penutup('Saya tidak sanggup lagi;', 'Apakah saksi masih sanggup untuk mendamaikan Penggugat dan Tergugat?')='Saya tidak sanggup lagi;' AND isian_rtf_saring_penutup('Saya tidak sanggup lagi;', 'Apakah masih ada yang ingin saudara sampaikan?')='' AND isian_rtf_saring_penutup('Saya tidak sanggup lagi;', '')='Saya tidak sanggup lagi;'`);
  cek("isian_rtf_ket_saksi tanpa saksi/NULL tetap '...'", `isian_rtf_ket_saksi(0, NULL)='...' AND isian_rtf_ket_saksi(0, '0')='...'`);
  cek("data nyata: tidak ada kelompok saksi yang keluarannya memuat butir penutup",
    `(SELECT COUNT(*) FROM (SELECT DISTINCT perkara_id, saksi_id FROM abt_keterangan_saksi WHERE perkara_id IS NOT NULL AND saksi_id IS NOT NULL AND (jawaban LIKE '%cukup%' OR jawaban LIKE '%sekian%' OR jawaban LIKE '%tidak ada%' OR jawaban LIKE '%sampai di sini%')) g WHERE isian_rtf_ket_saksi(g.perkara_id, CAST(g.saksi_id AS CHAR)) REGEXP '(^|<br>)-   Bahwa ((tidak ada|tidak|ya|iya|baik), )?((saya|saksi) )?((sudah|telah|memang|sekarang) )*(cukup|sekian|tidak ada lagi|sampai di sini)( sekian| saja| dulu)*[ ;.,]*(<br>|$)')=0`);
  cek("data nyata: jumlah butir - Bahwa keluaran = jumlah jawaban yang bukan penutup",
    `(SELECT COUNT(*) FROM (SELECT g.perkara_id, g.saksi_id, isian_rtf_ket_saksi(g.perkara_id, CAST(g.saksi_id AS CHAR)) AS o,
       (SELECT COUNT(*) FROM abt_keterangan_saksi k WHERE k.perkara_id = g.perkara_id AND k.saksi_id = g.saksi_id AND k.jawaban IS NOT NULL AND CHAR_LENGTH(k.jawaban) > 0 AND NOT (BINARY k.jawaban = '0')
          AND CHAR_LENGTH(isian_rtf_saring_penutup(CONVERT(CAST(k.jawaban AS BINARY) USING latin1), IFNULL(CONVERT(CAST(k.pertanyaan AS BINARY) USING latin1), ''))) > 0) AS n
       FROM (SELECT DISTINCT perkara_id, saksi_id FROM abt_keterangan_saksi WHERE perkara_id IS NOT NULL AND saksi_id IS NOT NULL AND (jawaban LIKE '%cukup%' OR jawaban LIKE '%sekian%' OR jawaban LIKE '%tidak ada%' OR jawaban LIKE '%sampai di sini%')) g) z
     WHERE CASE WHEN z.n = 0 THEN z.o <> '...' ELSE ((CHAR_LENGTH(z.o) - CHAR_LENGTH(REPLACE(z.o, '-   Bahwa ', ''))) / 10) <> z.n END)=0`);
  return pastikanAscii(
    `-- Paket ABT "${N}" (21 Okt 2026): PERIKSA = fungsi ada + perilakunya sama dengan penyaring bot (contoh dihitung oleh aleta_bot/services/penutupSaksi.js)
-- + tak satu pun kelompok saksi di data nyata mencetak butir penutup. Baris terakhir "SEMUA COCOK". Tidak mengubah apa pun.
SET @ok = 1;
${butir.join("\n")}
SELECT IF(@ok = 1, 'SEMUA COCOK', 'ADA YANG TIDAK COCOK') AS hasil;
`,
    "PERIKSA.sql"
  );
}

function fungsiLama() {
  const berkas = path.join(__dirname, "fungsi-lama-server-21okt.sql");
  return pastikanAscii(fs.readFileSync(berkas, "utf8").replace(/\r\n/g, "\n"), "fungsi-lama");
}

function pasangSh() {
  return `#!/bin/bash
# =============================================================================
# PASANG paket ABT "${N}" (21 Okt 2026). Dijalankan DI SERVER sebagai root, dari folder paket. HANYA basis ABT (aps_badilag): tiga fungsi
# tersimpan (isian_rtf_penutup, isian_rtf_saring_penutup baru; isian_rtf_ket_saksi diganti). Tidak menyentuh abt_variabel, blangko (RTF), menu,
# isian tersimpan per perkara, abt_keterangan_saksi, atau SIPP. Variabel 9259-9265 tetap memanggil isian_rtf_ket_saksi (nama sama).
# Urutan: md5 -> PRASYARAT (baca saja) -> HITUNG sebelum -> CADANGAN -> FUNGSI -> PERIKSA -> HITUNG sesudah (harus 0).
#         Gagal sesudah FUNGSI = PULIH otomatis (fungsi lama dikembalikan dari fungsi-lama.sql).
# Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_x6 bash pasang-satker.sh   (nama basis di berkas SQL disesuaikan otomatis)
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=${N}
CAD="$SINI/cadangan"
ADB="\${ABT_DB:-aps_badilag}"
gagal() { echo "GAGAL: $*"; exit 1; }
pulih() { echo "... memulihkan"; bash "$SINI/pulih-satker.sh" 2>&1 | tail -4; }

md5sum -c MD5SUMS.txt >/dev/null 2>&1 || gagal "isi paket rusak (md5sum -c MD5SUMS.txt) - salin ulang paket dengan scp"
if [ "\${ABT_LOKAL:-}" != 1 ] && [ -z "\${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || gagal "sandi DB tidak terbaca dari aleta-bot"
  export MYSQL_PWD
fi
H="\${MYSQL_HOST:-127.0.0.1}"
MY="mysql -h $H -u root --default-character-set=latin1 $ADB"
myn() { $MY -N "$@" | tr -d '\\r'; }   # klien mysql Windows menulis CRLF; di Linux tr tidak mengubah apa pun
# berkas SQL memakai nama basis aps_badilag; di basis uji laptop diganti nama basis ujinya
sqlf() { if [ "$ADB" = aps_badilag ]; then cat "$1"; else sed "s/aps_badilag\\./$ADB./g" "$1"; fi; }
set -o pipefail

# --- 1. PRASYARAT (baca saja) -------------------------------------------------------------------------------------------
p=$(myn < "$N-PRASYARAT.sql") || gagal "prasyarat tak terbaca - TIDAK ada yang diubah"
inti=$(echo "$p" | cut -d'|' -f1-4)
echo "PRASYARAT ($p)  [ket_saksi|fungsi-baru|versi-lama|versi-baru|variabel-pemanggil|fungsi-isian_rtf]"
MODE=
if [ "$inti" = "${SEBELUM}" ]; then MODE=BARU
elif [ "$inti" = "${SESUDAH}" ]; then MODE=ULANG
else gagal "prasyarat tidak cocok (harus ${SEBELUM}; ${SESUDAH} pada pasang ulang): isian_rtf_ket_saksi bukan versi paket I3 yang diharapkan atau sudah diubah - TIDAK ada yang diubah."; fi
echo "MODE $MODE"
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
CAP=$(date +%Y%m%d%H%M%S)

if [ "$MODE" = BARU ]; then
  # --- 2. CADANGAN (tidak pernah menimpa cadangan lama) -----------------------------------------------------------------
  for f in fungsi-sebelum.sql md5-sebelum.txt md5-sesudah.txt hitung-sebelum.txt hitung-sesudah.txt periksa-sesudah.txt; do
    [ -f "$CAD/$f" ] && mv "$CAD/$f" "$CAD/$f.$CAP"
  done
  mysqldump -h "$H" -u root --default-character-set=latin1 --routines --no-create-info --no-data --skip-triggers --skip-comments \\
    "$ADB" > "$CAD/fungsi-sebelum.sql" || gagal "cadangan fungsi DB gagal - TIDAK ada yang diubah"
  grep -q 'FUNCTION \`isian_rtf_ket_saksi\`' "$CAD/fungsi-sebelum.sql" || gagal "cadangan fungsi tidak memuat isian_rtf_ket_saksi - TIDAK ada yang diubah"
  myn -e "SELECT MD5(REPLACE(routine_definition, CONCAT(DATABASE(), '.abt_'), 'aps_badilag.abt_')) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_name='isian_rtf_ket_saksi'" > "$CAD/md5-sebelum.txt"
  HS=$(myn < "$N-HITUNG.sql") || gagal "HITUNG sebelum tak terbaca - TIDAK ada yang diubah"
  echo "$HS" > "$CAD/hitung-sebelum.txt"
  echo "CADANGAN: $CAD (fungsi: $(grep -c 'FUNCTION \`' "$CAD/fungsi-sebelum.sql"); md5 lama: $(cat "$CAD/md5-sebelum.txt"))"
  echo "SEBELUM: $HS kelompok saksi mencetak butir kalimat penutup"

  # --- 3. FUNGSI -----------------------------------------------------------------------------------------------------------
  sqlf "$N-FUNGSI.sql" | $MY > "$CAD/fungsi-pasang.log" 2>&1 || { tail -5 "$CAD/fungsi-pasang.log"; pulih; gagal "fungsi tidak bisa dibuat - dipulihkan"; }
  myn -e "SELECT MD5(REPLACE(routine_definition, CONCAT(DATABASE(), '.abt_'), 'aps_badilag.abt_')) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_name='isian_rtf_ket_saksi'" > "$CAD/md5-sesudah.txt"
else
  echo "SUDAH terpasang - hanya PERIKSA ulang"
fi

# --- 4. PERIKSA ----------------------------------------------------------------------------------------------------------------
myn < "$N-PERIKSA.sql" > "$CAD/periksa-sesudah.txt" 2>&1
if [ "$(tail -1 "$CAD/periksa-sesudah.txt")" != "SEMUA COCOK" ]; then
  grep -v '	1$' "$CAD/periksa-sesudah.txt" | head -20
  [ "$MODE" = BARU ] && pulih
  gagal "PERIKSA tidak cocok$([ "$MODE" = BARU ] && echo ' - fungsi dikembalikan')"
fi
echo "PERIKSA: $(grep -c '	1$' "$CAD/periksa-sesudah.txt") butir cocok - SEMUA COCOK"

# --- 5. HITUNG sesudah (harus 0) ---------------------------------------------------------------------------------------------
HA=$(myn < "$N-HITUNG.sql") || gagal "HITUNG sesudah tak terbaca"
echo "$HA" > "$CAD/hitung-sesudah.txt"
if [ "$HA" != 0 ]; then
  [ "$MODE" = BARU ] && pulih
  gagal "HITUNG sesudah = $HA (harus 0)$([ "$MODE" = BARU ] && echo ' - fungsi dikembalikan')"
fi
echo "SESUDAH: $HA kelompok saksi mencetak butir kalimat penutup"
FB=$(myn -e "SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_name LIKE 'isian\\\\_rtf\\\\_%'")
echo "FUNGSI isian_rtf_*: $FB"
echo "SELESAI - paket $N terpasang. Cadangan: $CAD. Pulih: bash $SINI/pulih-satker.sh"
`;
}

function pulihSh() {
  return `#!/bin/bash
# PULIH paket ABT "${N}" (21 Okt 2026) - deterministik:
#  1) isian_rtf_ket_saksi dikembalikan dari fungsi-lama.sql HANYA bila isinya (md5 definisi) masih persis hasil paket (atau fungsinya hilang
#     karena pasang terputus di tengah);
#     yang sudah diubah orang sesudah dipasang DIBIARKAN dan dilaporkan;
#  2) dua fungsi baru dibuang HANYA bila tidak ada lagi fungsi/variabel yang memanggilnya.
# Baris terakhir harus "PULIH COCOK". Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_x6 bash pulih-satker.sh
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
LAMA=$(awk 'NR==1{print $1}' "$CAD/md5-sebelum.txt" 2>/dev/null)
BARU=$(awk 'NR==1{print $1}' "$CAD/md5-sesudah.txt" 2>/dev/null)
[ -n "$LAMA" ] || { echo "TIDAK ADA cadangan ($CAD/md5-sebelum.txt) - tidak ada yang dipulihkan"; exit 1; }
NOW=$(myn -e "SELECT MD5(REPLACE(routine_definition, CONCAT(DATABASE(), '.abt_'), 'aps_badilag.abt_')) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_name='isian_rtf_ket_saksi'")
BIARKAN=0
if [ "$NOW" = "$LAMA" ]; then
  echo "isian_rtf_ket_saksi SUDAH versi lama"
elif [ -z "$NOW" ] || { [ -n "$BARU" ] && [ "$NOW" = "$BARU" ]; }; then
  sqlf "$SINI/fungsi-lama.sql" | $MY > "$CAD/fungsi-pulih.log" 2>&1 || { echo "GAGAL: fungsi lama tidak bisa dibuat ulang (lihat $CAD/fungsi-pulih.log)"; exit 1; }
  echo "isian_rtf_ket_saksi DIKEMBALIKAN ke versi lama"
else
  echo "BIARKAN isian_rtf_ket_saksi (sudah diubah sesudah dipasang)"; BIARKAN=1
fi
PAKAI=$(myn -e "SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_name <> 'isian_rtf_saring_penutup' AND (LOCATE('isian_rtf_saring_penutup', routine_definition) > 0) ")
PAKAI2=$(myn -e "SELECT COUNT(*) FROM abt_variabel WHERE LOCATE('isian_rtf_saring_penutup', IFNULL(sql_query,'')) > 0 OR LOCATE('isian_rtf_penutup', IFNULL(sql_query,'')) > 0")
if [ "$PAKAI" = 0 ] && [ "$PAKAI2" = 0 ]; then
  $MY -e "DROP FUNCTION IF EXISTS isian_rtf_saring_penutup; DROP FUNCTION IF EXISTS isian_rtf_penutup;" && echo "FUNGSI BARU DIBUANG" || echo "PERINGATAN: fungsi baru tidak terbuang"
else
  echo "PERINGATAN: fungsi baru DIBIARKAN - masih dipanggil ($PAKAI fungsi, $PAKAI2 variabel)"; BIARKAN=1
fi
FB=$(myn -e "SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_name IN ('isian_rtf_penutup','isian_rtf_saring_penutup')")
NOW2=$(myn -e "SELECT MD5(REPLACE(routine_definition, CONCAT(DATABASE(), '.abt_'), 'aps_badilag.abt_')) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_name='isian_rtf_ket_saksi'")
echo "FUNGSI baru=$FB ket_saksi=$([ "$NOW2" = "$LAMA" ] && echo lama || echo lain)"
if [ "$BIARKAN" = 0 ] && [ "$FB" = 0 ] && [ "$NOW2" = "$LAMA" ]; then echo "PULIH COCOK"; else echo "PULIH SEBAGIAN (lihat BIARKAN/PERINGATAN di atas)"; fi
`;
}

function tulis(nama, isi) {
  const p = path.join(PK, nama);
  fs.writeFileSync(p, isi.replace(/\r\n/g, "\n"), "utf8");
  return p;
}

function bangun() {
  fs.mkdirSync(PK, { recursive: true });
  const berkas = {
    [`${N}-FUNGSI.sql`]: fungsiSql(),
    [`${N}-PRASYARAT.sql`]: prasyaratSql(),
    [`${N}-PERIKSA.sql`]: periksaSql(),
    [`${N}-HITUNG.sql`]: hitungSql(),
    "fungsi-lama.sql": fungsiLama(),
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

module.exports = { fungsiSql, prasyaratSql, periksaSql, hitungSql, bangun, N, ISI, MD5_KET_SAKSI_LAMA, SEBELUM, SESUDAH };

if (require.main === module) {
  const dibuat = bangun();
  console.log("paket ditulis:", dibuat.join(", "));
}
