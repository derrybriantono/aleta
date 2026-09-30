"use strict";

/**
 * Dump MySQL untuk sinkron & cadangan (butir 29, 30 September 2026).
 *
 * Portal memanggil GET /internal/aleta-bot/sinkron/dump?sumber=<kunci> dan
 * menerima aliran gzip berisi SQL yang dapat dipulihkan dengan mysql.exe.
 * Seluruh pernyataan yang dikirim ke server melewati pastikanBacaSaja():
 * SELECT, SHOW, SET NAMES, dan transaksi baca - tidak ada yang lain.
 *
 * Konsistensi: satu transaksi REPEATABLE READ "WITH CONSISTENT SNAPSHOT"
 * (sama dengan mysqldump --single-transaction) - tabel InnoDB terbaca pada
 * satu titik waktu tanpa mengunci SIPP. Tabel MyISAM, bila ada, terbaca
 * apa adanya saat gilirannya (tanpa LOCK TABLES, yang akan menahan SIPP).
 */

const zlib = require("zlib");
const Types = require("mysql/lib/protocol/constants/types");

const f = require("./sinkronDumpFormat");

/** Kunci sumber -> cara mendapatkan kolam sambungannya. */
const SUMBER = {
  sipp: { sebutan: "SIPP", kolam: () => require("./externalDbService").createConnectionPool("sipp_primary") },
  abt: { sebutan: "ABT (aps_badilag)", kolam: () => require("./externalDbService").createConnectionPool("aps_badilag") },
  antrian: { sebutan: "Antrian sidang", kolam: () => require("./externalDbService").createConnectionPool("antrian_sidang") },
  aleta_bot: { sebutan: "ALETA Bot (MySQL)", kolam: () => require("../bot_db_config") },
};

const TIPE_ANGKA = new Set(
  ["TINY", "SHORT", "LONG", "INT24", "LONGLONG", "FLOAT", "DOUBLE", "NEWDECIMAL", "DECIMAL", "YEAR"]
    .map((n) => Types[n])
    .filter((n) => n !== undefined)
);
const TIPE_BUFFER_BILA_BINER = new Set(
  ["TINY_BLOB", "MEDIUM_BLOB", "LONG_BLOB", "BLOB", "STRING", "VAR_STRING"].map((n) => Types[n])
);
const CHARSET_BINER = 63;

/**
 * Semua nilai sebagai teks atau Buffer - tidak ada Date/Number JavaScript
 * yang dapat menggeser zona waktu atau memotong presisi DECIMAL/BIGINT.
 */
function typeCastDump(field, next) {
  const tipe = Types[field.type];
  if (tipe === Types.BIT || tipe === Types.GEOMETRY) return field.buffer();
  if (TIPE_BUFFER_BILA_BINER.has(tipe) && field.packet && field.packet.charsetNr === CHARSET_BINER) {
    return field.buffer();
  }
  void next;
  return field.string();
}

function ambilSambungan(kolam) {
  return new Promise((selesai, gagal) => {
    kolam.getConnection((galat, sambungan) => (galat ? gagal(galat) : selesai(sambungan)));
  });
}

function tanya(sambungan, sql, params = []) {
  f.pastikanBacaSaja(sql);
  return new Promise((selesai, gagal) => {
    sambungan.query({ sql, values: params, typeCast: typeCastDump }, (galat, baris) =>
      galat ? gagal(galat) : selesai(baris)
    );
  });
}

/** Menulis ke aliran dengan menghormati tekanan balik. */
function tulis(keluaran, teks) {
  if (keluaran.write(teks)) return Promise.resolve();
  return new Promise((selesai) => keluaran.once("drain", selesai));
}

/**
 * Menulis isi satu tabel sebagai INSERT berkelompok, baris demi baris.
 * Sambungan dijeda ketika aliran keluaran penuh supaya memori bot tidak
 * menampung satu tabel utuh.
 */
function alirkanTabel(sambungan, tabel, keluaran) {
  const sql = `SELECT * FROM ${f.kutipNama(tabel)}`;
  f.pastikanBacaSaja(sql);
  return new Promise((selesai, gagal) => {
    let kolom = [];
    let angka = [];
    let penampung = "";
    let jumlah = 0;
    const awalan = `INSERT INTO ${f.kutipNama(tabel)} VALUES `;
    const kuras = () => {
      if (!penampung) return true;
      const ok = keluaran.write(awalan + penampung + ";\n");
      penampung = "";
      return ok;
    };
    const kueri = sambungan.query({ sql, typeCast: typeCastDump });
    kueri
      .on("error", gagal)
      .on("fields", (medan) => {
        kolom = medan.map((m) => m.name);
        angka = medan.map((m) => TIPE_ANGKA.has(m.type));
      })
      .on("result", (baris) => {
        const nilai = kolom.map((nama, i) => f.nilaiSql(baris[nama], angka[i])).join(",");
        penampung += (penampung ? "," : "") + "(" + nilai + ")";
        jumlah += 1;
        if (penampung.length >= f.BATAS_INSERT_BYTE && !kuras()) {
          sambungan.pause();
          keluaran.once("drain", () => sambungan.resume());
        }
      })
      .on("end", () => {
        kuras();
        selesai(jumlah);
      });
  });
}

let sedangBerjalan = null;

/**
 * Menyusun dump satu sumber ke aliran `keluaran` (teks SQL, belum dimampatkan).
 * `pilihan.kolam` dapat diberikan langsung (uji dan alat ukur setempat).
 */
async function dumpSumber(kunci, keluaran, pilihan = {}) {
  const sumber = SUMBER[kunci];
  if (!sumber && !pilihan.kolam) throw new Error(`Sumber tidak dikenal: ${kunci}`);
  const kolam = pilihan.kolam || sumber.kolam();
  const sambungan = await ambilSambungan(kolam);
  const hitung = { tabel: 0, baris: 0, view: 0, rutin: 0, trigger: 0 };
  let batal = false;
  if (pilihan.sinyal) {
    pilihan.sinyal.addEventListener("abort", () => {
      batal = true;
      try {
        sambungan.destroy();
      } catch {
        /* sudah tertutup */
      }
    });
  }
  try {
    let charset = "utf8mb4";
    try {
      await tanya(sambungan, "SET NAMES utf8mb4");
    } catch {
      charset = "utf8";
      await tanya(sambungan, "SET NAMES utf8");
    }
    await tanya(sambungan, "SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    await tanya(sambungan, "START TRANSACTION /*!40100 WITH CONSISTENT SNAPSHOT */");

    const [{ db: namaDb }] = await tanya(sambungan, "SELECT DATABASE() AS db");
    await tulis(keluaran, f.kepalaDump({ sumber: kunci, namaDb, charset, dibuat: new Date().toISOString() }));

    const semua = await tanya(sambungan, "SHOW FULL TABLES");
    const kolomNama = semua.length ? Object.keys(semua[0])[0] : "";
    const tabel = semua.filter((b) => String(b.Table_type).toUpperCase() === "BASE TABLE").map((b) => String(b[kolomNama]));
    const namaView = semua.filter((b) => String(b.Table_type).toUpperCase() === "VIEW").map((b) => String(b[kolomNama]));

    // View dibuang lebih dulu: nama view dan tabel berbagi ruang nama.
    for (const v of namaView) await tulis(keluaran, `DROP VIEW IF EXISTS ${f.kutipNama(v)};\n`);

    for (const t of tabel) {
      if (batal) throw new Error("dibatalkan");
      const [buat] = await tanya(sambungan, `SHOW CREATE TABLE ${f.kutipNama(t)}`);
      await tulis(keluaran, `\n-- Tabel ${t}\nDROP TABLE IF EXISTS ${f.kutipNama(t)};\n${buat["Create Table"]};\n`);
      hitung.baris += await alirkanTabel(sambungan, t, keluaran);
      await tulis(keluaran, "COMMIT;\n");
      hitung.tabel += 1;
    }

    // Rutin sebelum view: view SIPP dapat memanggil fungsi tersimpan.
    for (const jenis of ["FUNCTION", "PROCEDURE"]) {
      const daftar = await tanya(sambungan, `SHOW ${jenis} STATUS WHERE Db = ?`, [namaDb]);
      for (const r of daftar) {
        const nama = String(r.Name);
        const [def] = await tanya(sambungan, `SHOW CREATE ${jenis} ${f.kutipNama(namaDb)}.${f.kutipNama(nama)}`);
        const isi = def && def[jenis === "FUNCTION" ? "Create Function" : "Create Procedure"];
        if (!isi) {
          await tulis(keluaran, `-- ${jenis} ${nama}: definisinya tidak terbaca (hak akses akun bot).\n`);
          continue;
        }
        await tulis(
          keluaran,
          `DROP ${jenis} IF EXISTS ${f.kutipNama(nama)};\nDELIMITER ;;\n${f.bersihkanDefinisi(isi, namaDb)} ;;\nDELIMITER ;\n`
        );
        hitung.rutin += 1;
      }
    }

    const trigger = await tanya(sambungan, "SHOW TRIGGERS");
    for (const tr of trigger) {
      const nama = String(tr.Trigger);
      const [def] = await tanya(sambungan, `SHOW CREATE TRIGGER ${f.kutipNama(nama)}`);
      const isi = def && def["SQL Original Statement"];
      if (!isi) continue;
      await tulis(
        keluaran,
        `DROP TRIGGER IF EXISTS ${f.kutipNama(nama)};\nDELIMITER ;;\n${f.bersihkanDefinisi(isi, namaDb)} ;;\nDELIMITER ;\n`
      );
      hitung.trigger += 1;
    }

    const view = [];
    for (const v of namaView) {
      const [def] = await tanya(sambungan, `SHOW CREATE VIEW ${f.kutipNama(v)}`);
      view.push({ nama: v, sql: f.bersihkanDefinisi(def["Create View"], namaDb) });
    }
    for (const v of f.urutkanView(view)) {
      await tulis(keluaran, `DROP VIEW IF EXISTS ${f.kutipNama(v.nama)};\n${v.sql};\n`);
      hitung.view += 1;
    }

    await tanya(sambungan, "ROLLBACK");
    await tulis(keluaran, f.kakiDump(hitung));
    return { namaDb, ...hitung };
  } finally {
    try {
      sambungan.release();
    } catch {
      /* sambungan sudah dihancurkan saat dibatalkan */
    }
  }
}

/**
 * Menjawab permintaan HTTP dengan aliran gzip. Satu dump pada satu waktu:
 * dump SIPP penuh membaca seluruh tabel, dan dua sekaligus hanya membebani
 * server induk dua kali lipat.
 */
async function jawabDump(req, res) {
  const kunci = String(req.query.sumber || "");
  if (!SUMBER[kunci]) {
    return res.status(400).json({ ok: false, error: "sumber_tidak_dikenal", message: `Sumber "${kunci}" tidak dikenal.` });
  }
  if (sedangBerjalan) {
    return res.status(409).json({ ok: false, error: "sedang_berjalan", message: `Dump ${sedangBerjalan} sedang berjalan.` });
  }
  sedangBerjalan = kunci;
  const pembatal = new AbortController();
  req.on("close", () => {
    if (!res.writableEnded) pembatal.abort();
  });
  const gzip = zlib.createGzip({ level: 6 });
  res.status(200);
  res.setHeader("Content-Type", "application/gzip");
  res.setHeader("Cache-Control", "no-store");
  gzip.pipe(res);
  try {
    const hasil = await dumpSumber(kunci, gzip, { sinyal: pembatal.signal });
    console.log(`[sinkron] dump ${kunci} (${hasil.namaDb}) selesai: ${hasil.tabel} tabel, ${hasil.baris} baris.`);
  } catch (galat) {
    const pesan = String((galat && galat.message) || galat).replace(/\s+/g, " ").slice(0, 200);
    console.error(`[sinkron] dump ${kunci} gagal: ${pesan}`);
    // Aliran sudah berjalan, jadi status HTTP tidak dapat diubah lagi. Penanda
    // gagal + TIDAK adanya penanda selesai membuat portal menolak dump ini.
    try {
      gzip.write(`\n${f.PENANDA_GAGAL}: ${pesan}\n`);
    } catch {
      /* aliran sudah tertutup */
    }
  } finally {
    sedangBerjalan = null;
    gzip.end();
  }
}

/** Sumber yang tersedia dan apakah sambungannya hidup - tanpa kredensial. */
async function periksaSumber() {
  const hasil = [];
  for (const [kunci, s] of Object.entries(SUMBER)) {
    const baris = { kunci, sebutan: s.sebutan, terjangkau: false, namaDb: "", error: "" };
    try {
      const sambungan = await ambilSambungan(s.kolam());
      try {
        const [r] = await tanya(sambungan, "SELECT DATABASE() AS db");
        baris.namaDb = String(r.db || "");
        baris.terjangkau = true;
      } finally {
        sambungan.release();
      }
    } catch (galat) {
      baris.error = String((galat && galat.code) || (galat && galat.message) || galat).slice(0, 120);
    }
    hasil.push(baris);
  }
  return { sedangBerjalan, sumber: hasil };
}

module.exports = { SUMBER, dumpSumber, jawabDump, periksaSumber, typeCastDump };
