"use strict";

/**
 * Bagian MURNI dari pembuat dump MySQL untuk sinkron & cadangan (butir 29,
 * 30 September 2026) - tanpa require apa pun, supaya dapat diuji dari rangkaian
 * uji portal tanpa menyalakan sambungan basis data.
 *
 * ============================================================================
 * KENAPA BOT MENULIS DUMP SENDIRI, BUKAN mysqldump
 * ============================================================================
 *
 * Container bot tidak memuat program mysqldump (Dockerfile hanya memasang
 * Chromium dan LibreOffice), sementara bot SATU-SATUNYA bagian ALETA yang
 * sudah memegang sambungan ke MySQL SIPP, ABT, dan antrian. Menambah paket ke
 * citra atau memberi portal kredensial MySQL berarti menambah jalan masuk
 * baru ke basis data induk; menulis dump dari sambungan yang sudah ada tidak.
 *
 * Bentuk keluarannya meniru mysqldump agar dapat dipulihkan dengan mysql.exe
 * biasa: DROP/CREATE TABLE, INSERT berkelompok, lalu rutin, trigger, dan view.
 * TANPA "CREATE DATABASE" maupun "USE" - basis data tujuan disebut pada baris
 * perintah pemulih, sehingga dump SIPP server tidak mungkin mendarat diam-diam
 * di basis data yang namanya kebetulan sama di laptop.
 */

/**
 * Hanya pernyataan BACA yang boleh dikirim ke server MySQL induk.
 *
 * Dump ini menyentuh SIPP produksi. Satu pernyataan tulis yang lolos karena
 * salah ketik di kode adalah kerusakan pada basis data pengadilan - jadi tiap
 * pernyataan melewati penjaga ini, bukan hanya diyakini aman.
 */
const POLA_BACA_SAJA =
  /^\s*(SELECT|SHOW|SET\s+SESSION\s+TRANSACTION|SET\s+NAMES|START\s+TRANSACTION|ROLLBACK)\b/i;

function tanpaKutipan(sql) {
  return String(sql)
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`]|``)*`/g, "``");
}

function pastikanBacaSaja(sql) {
  const teks = String(sql || "");
  const polos = tanpaKutipan(teks);
  if (!POLA_BACA_SAJA.test(teks)) {
    throw new Error(`Pernyataan ditolak (bukan baca saja): ${teks.slice(0, 60)}`);
  }
  if (/;\s*\S/.test(polos)) {
    throw new Error("Pernyataan ditolak: lebih dari satu pernyataan.");
  }
  if (/\bINTO\s+(OUTFILE|DUMPFILE|@)/i.test(polos) || /\bFOR\s+UPDATE\b/i.test(polos) || /\bLOCK\s+IN\s+SHARE\s+MODE\b/i.test(polos)) {
    throw new Error("Pernyataan ditolak: SELECT yang menulis berkas atau mengunci baris.");
  }
  return teks;
}

/** `nama` dengan tanda petik balik yang di-escape. */
function kutipNama(nama) {
  return "`" + String(nama).replace(/`/g, "``") + "`";
}

/** Sama dengan escapeString milik sqlstring (dipakai paket mysql). */
function kutipTeks(teks) {
  return (
    "'" +
    String(teks).replace(/[\0\b\t\n\r\x1a"'\\]/g, (c) => {
      switch (c) {
        case "\0":
          return "\\0";
        case "\b":
          return "\\b";
        case "\t":
          return "\\t";
        case "\n":
          return "\\n";
        case "\r":
          return "\\r";
        case "\x1a":
          return "\\Z";
        default:
          return "\\" + c;
      }
    }) +
    "'"
  );
}

const POLA_ANGKA = /^-?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;

/**
 * Satu nilai kolom sebagai literal SQL.
 *
 * Buffer (BLOB/BINARY/BIT/GEOMETRY) ditulis heksadesimal - sama dengan
 * mysqldump --hex-blob - supaya byte biner tidak dirusak pengodean teks.
 * Angka ditulis tanpa kutip hanya bila kolomnya memang angka DAN nilainya
 * berbentuk angka; selebihnya dikutip (MySQL tetap mengubahnya dengan tepat).
 */
function nilaiSql(nilai, kolomAngka) {
  if (nilai === null || nilai === undefined) return "NULL";
  if (Buffer.isBuffer(nilai)) return nilai.length ? "0x" + nilai.toString("hex") : "''";
  const teks = String(nilai);
  if (kolomAngka && POLA_ANGKA.test(teks)) return teks;
  return kutipTeks(teks);
}

/**
 * Membuang DEFINER dan awalan nama basis data SUMBER dari definisi view,
 * rutin, dan trigger.
 *
 * DEFINER menunjuk akun server (mis. root@localhost) yang belum tentu ada di
 * laptop - pemulihan view gagal diam-diam karenanya (sudah terjadi: 0 dari 125
 * view SIPP ikut terimpor). Awalan `nama_db`. lebih berbahaya: view yang
 * dipulihkan ke sipp_donggala tetapi masih menunjuk `sipp`.`perkara` akan
 * membaca basis data LAIN di laptop tanpa satu error pun.
 */
function bersihkanDefinisi(sql, namaDbSumber) {
  let hasil = String(sql || "").replace(/\s+DEFINER\s*=\s*(`[^`]*`|'[^']*'|[^\s@]+)@(`[^`]*`|'[^']*'|[^\s]+)/i, "");
  const db = String(namaDbSumber || "").trim();
  if (db) {
    const pola = new RegExp("`" + db.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/`/g, "``") + "`\\.", "gi");
    hasil = hasil.replace(pola, "");
  }
  return hasil;
}

/**
 * Urutan view supaya view yang dirujuk view lain dibuat lebih dulu.
 * view: [{ nama, sql }]. View yang saling merujuk (tidak mungkin di MySQL)
 * atau tidak terurai tetap ikut di akhir, bukan dibuang.
 */
function urutkanView(view) {
  const sisa = new Map(view.map((v) => [v.nama, v]));
  const hasil = [];
  let maju = true;
  while (sisa.size && maju) {
    maju = false;
    for (const [nama, v] of [...sisa]) {
      const bergantung = [...sisa.keys()].some(
        (lain) => lain !== nama && String(v.sql).includes("`" + lain.replace(/`/g, "``") + "`")
      );
      if (!bergantung) {
        hasil.push(v);
        sisa.delete(nama);
        maju = true;
      }
    }
  }
  return [...hasil, ...sisa.values()];
}

/** Penanda akhir - pemanggil (portal) menolak dump yang tidak memuatnya. */
const PENANDA_SELESAI = "-- ALETA-DUMP-SELESAI";
const PENANDA_GAGAL = "-- ALETA-DUMP-GAGAL";

function kepalaDump({ sumber, namaDb, charset, dibuat }) {
  return [
    `-- ALETA sinkron & cadangan: dump basis data "${sumber}" (${namaDb}) dari server`,
    `-- Dibuat ${dibuat}. Hanya pernyataan SELECT/SHOW yang dikirim ke server saat menyusunnya.`,
    "-- Tanpa CREATE DATABASE/USE: sebut basis data tujuan pada perintah pemulih, mis.",
    "--   mysql -u root sipp_donggala < berkas.sql",
    `SET NAMES ${charset};`,
    "SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;",
    "SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;",
    "SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO';",
    "SET autocommit=0;",
    "",
  ].join("\n");
}

function kakiDump(hitung) {
  return [
    "",
    "COMMIT;",
    "SET SQL_MODE=@OLD_SQL_MODE;",
    "SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;",
    "SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;",
    `${PENANDA_SELESAI} tabel=${hitung.tabel} baris=${hitung.baris} view=${hitung.view} rutin=${hitung.rutin} trigger=${hitung.trigger}`,
    "",
  ].join("\n");
}

/** Batas panjang satu INSERT berkelompok - aman untuk max_allowed_packet 1 MB. */
const BATAS_INSERT_BYTE = 256 * 1024;

module.exports = {
  POLA_BACA_SAJA,
  pastikanBacaSaja,
  kutipNama,
  kutipTeks,
  nilaiSql,
  bersihkanDefinisi,
  urutkanView,
  kepalaDump,
  kakiDump,
  PENANDA_SELESAI,
  PENANDA_GAGAL,
  BATAS_INSERT_BYTE,
};
