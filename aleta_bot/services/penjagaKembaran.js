"use strict";

/**
 * ============================================================================
 * PENJAGA KEMBARAN - SATU PINTU UNTUK SEMUA TULISAN KE SIPP / ABT / ANTRIAN
 * ============================================================================
 *
 * Di mode kembaran (ALETA_MODE=kembaran) kolam sambungan SIPP, ABT, dan antrian
 * dibungkus di sini. Pernyataan BACA lewat apa adanya. Pernyataan TULIS tidak
 * pernah sampai ke basis data - ia dicatat ke antrean "menunggu sinkron" lengkap
 * dengan cuplikan nilai lama yang dibaca saat itu, lalu pemanggil menerima
 * jawaban yang bentuknya sama dengan jawaban sungguhan (affectedRows, insertId)
 * supaya layanan lama berjalan tanpa tahu bedanya.
 *
 * Mengapa di kolam, bukan di tiap layanan: ada puluhan layanan penulis (daftar
 * lengkapnya di penjagaTandaSipp.JALUR_TULIS_SIPP) dan akan ada lagi. Satu
 * pembungkus di pintu kolam menutup semuanya sekaligus, termasuk yang ditulis
 * kelak. Di mode biasa pasang() mengembalikan kolam apa adanya - tidak ada
 * perubahan perilaku sedikit pun.
 *
 * Yang SENGAJA tidak dialihkan:
 *   - tabel berawalan aleta_ (milik ALETA sendiri) - boleh ditulis di laptop;
 *   - CREATE/DROP TEMPORARY TABLE, SET, transaksi, SELECT.
 * Yang dialihkan dan TIDAK dapat dikirim otomatis (ditahan di antrean):
 *   - DDL (CREATE/ALTER/DROP/TRUNCATE) dan CALL / pernyataan tak dikenal.
 *
 * Konteks permintaan (AsyncLocalStorage): satu permintaan HTTP ke bot = satu
 * KELOMPOK. Semua tulisan permintaan itu disetujui dan dikirim bersama dalam
 * satu transaksi di server, sehingga baris audit tidak terpisah dari
 * tulisan utamanya.
 */

const crypto = require("crypto");
const { AsyncLocalStorage } = require("async_hooks");
const { EventEmitter } = require("events");
const mysql = require("mysql");

const mode = require("./kembaranMode");
const Q = require("./kembaranSql");
const B = require("./kembaranBentrok");
const antrean = require("./kembaranAntrean");

const als = new AsyncLocalStorage();

const statistik = { dialihkan: 0, diteruskanAleta: 0, gagalCatat: 0, terakhir: null };

// ---------------------------------------------------------------------------
// Konteks permintaan
// ---------------------------------------------------------------------------

function idKelompok() {
  return `K${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`;
}

function tebakAktor(req) {
  const kepala = (n) => String((req.headers && req.headers[n]) || "").trim();
  const badan = (req && req.body && typeof req.body === "object" ? req.body : {}) || {};
  for (const k of ["oleh", "olehNama", "olehUsername", "aktor", "actor", "actorName", "username", "petugas", "dibuatOleh"]) {
    const v = badan[k];
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, 190);
  }
  return kepala("x-aleta-aktor") || kepala("x-aleta-user-id") || null;
}

function buatKonteks(req) {
  return {
    kelompok: idKelompok(),
    urutan: 0,
    operasi: req ? `${req.method} ${req.baseUrl || ""}${req.path || ""}`.slice(0, 250) : null,
    aktor: req ? tebakAktor(req) : null,
  };
}

/** Express: pasang SESUDAH pembaca badan (JSON) supaya konteks bertahan sampai penangan rute. */
function middlewareExpress() {
  return function konteksKembaran(req, res, next) {
    if (!mode.aktif()) return next();
    return als.run(buatKonteks(req), () => next());
  };
}

function denganKonteks(konteks, fn) {
  return als.run({ kelompok: idKelompok(), urutan: 0, operasi: null, aktor: null, ...konteks }, fn);
}

function konteksSaatIni() {
  return als.getStore() || null;
}

// ---------------------------------------------------------------------------
// Cuplikan dan kunci
// ---------------------------------------------------------------------------

const cacheKunci = new Map();
const TTL_KUNCI_MS = 10 * 60 * 1000;

async function kunciLokal(sumber, bacaFn, skema, tabel) {
  const k = `${sumber}|${skema}|${tabel}`.toLowerCase();
  const ada = cacheKunci.get(k);
  if (ada && Date.now() - ada.pada < TTL_KUNCI_MS) return ada.nilai;
  const nilai = await B.kunciTabel(bacaFn, skema, tabel);
  if (nilai.terbaca) cacheKunci.set(k, { pada: Date.now(), nilai });
  return nilai;
}

async function bacaJam(bacaFn) {
  const rows = await bacaFn(
    "SELECT DATE_FORMAT(NOW(),'%Y-%m-%d %H:%i:%s') AS dt, DATE_FORMAT(CURDATE(),'%Y-%m-%d') AS d, DATE_FORMAT(CURTIME(),'%H:%i:%s') AS t, " +
      "DATE_FORMAT(UTC_TIMESTAMP(),'%Y-%m-%d %H:%i:%s') AS udt, DATE_FORMAT(UTC_TIMESTAMP(),'%Y-%m-%d') AS ud, DATE_FORMAT(UTC_TIMESTAMP(),'%H:%i:%s') AS ut"
  );
  return rows && rows[0] ? rows[0] : null;
}

let penghitungSemu = 1_900_000_000 + Math.floor(Math.random() * 90_000_000);
/** Nomor urut "semu" untuk insertId - cukup besar agar tidak bertabrakan dengan nomor sungguhan, muat di INT. */
function insertIdSemu() {
  penghitungSemu += 1;
  return penghitungSemu;
}

/** Menambahkan `nilai` pada tiap assignment UPDATE supaya pemeriksa tak perlu menguraikan ulang. */
function perkayaUraian(u) {
  if (u && u.assignments) {
    return { ...u, assignments: u.assignments.map((a) => ({ ...a, nilai: Q.nilaiLiteral(a.ekspresi) })) };
  }
  return u;
}

async function susunRekam({ sumber, stmt, bacaFn, konteks, tx }) {
  const golongan = Q.golongan(stmt);
  let literal = stmt;
  if (Q.memuatJamRelatif(stmt)) {
    const jam = await bacaJam(bacaFn).catch(() => null);
    if (jam) literal = Q.gantiJamRelatif(stmt, jam);
  }
  const u = perkayaUraian(Q.uraiTulisan(literal));
  const rekam = {
    kelompok: (konteks && konteks.kelompok) || (tx && tx.aktif && tx.kelompok) || idKelompok(),
    urutan: 1,
    dicatatPada: new Date().toISOString(),
    sumber,
    jenis: golongan,
    tabel: u.tabel || "",
    sql: literal,
    uraian: u,
    aktor: (konteks && konteks.aktor) || null,
    operasi: (konteks && konteks.operasi) || null,
    status: "menunggu",
    hasil: null,
    cuplikan: { status: "tidak_perlu" },
    insertIdSemu: null,
  };
  if (konteks) {
    konteks.urutan += 1;
    rekam.urutan = konteks.urutan;
  } else if (tx && tx.aktif) {
    tx.urutan += 1;
    rekam.urutan = tx.urutan;
  }

  if ((golongan === "UPDATE" || golongan === "DELETE") && u.terbaca) {
    const pilih = Q.susunSelectCuplikan(u);
    try {
      const rows = await bacaFn(pilih);
      rekam.cuplikan =
        rows.length > Q.BATAS_CUPLIKAN
          ? { status: "terpotong", selectSql: pilih }
          : { status: "lengkap", selectSql: pilih, baris: rows.map(B.serialBaris) };
    } catch (g) {
      rekam.cuplikan = { status: "tak_terbaca", selectSql: pilih, sebab: String((g && g.message) || g).slice(0, 200) };
    }
  } else if ((golongan === "INSERT" || golongan === "REPLACE") && u.terbaca) {
    rekam.insertIdSemu = insertIdSemu();
    try {
      const kunci = await kunciLokal(sumber, bacaFn, u.skema, u.tabel);
      const pilih = B.susunSelectKunci(u, kunci);
      if (pilih) {
        const rows = await bacaFn(pilih);
        rekam.cuplikan = { status: "lengkap", selectSql: pilih, baris: rows.slice(0, Q.BATAS_CUPLIKAN).map(B.serialBaris) };
      } else {
        rekam.cuplikan = { status: "tanpa_kunci" };
      }
    } catch (g) {
      rekam.cuplikan = { status: "tak_terbaca", sebab: String((g && g.message) || g).slice(0, 200) };
    }
  }
  return rekam;
}

function jawabanSemu(rekam) {
  const c = rekam.cuplikan || {};
  let terdampak = 1;
  if (rekam.jenis === "UPDATE" || rekam.jenis === "DELETE") {
    terdampak = c.status === "lengkap" ? (c.baris || []).length : 1;
  } else if (rekam.uraian && rekam.uraian.baris) {
    terdampak = rekam.uraian.baris.length;
  }
  return {
    fieldCount: 0,
    affectedRows: terdampak,
    insertId: rekam.insertIdSemu || 0,
    serverStatus: 2,
    warningCount: 0,
    message: `(Rows matched: ${terdampak}  Changed: ${terdampak}  Warnings: 0`,
    protocol41: true,
    changedRows: rekam.jenis === "UPDATE" ? terdampak : 0,
  };
}

// ---------------------------------------------------------------------------
// Inti: proses sekumpulan pernyataan
// ---------------------------------------------------------------------------

async function simpanRekam(rekam, tx) {
  if (tx && tx.aktif) {
    tx.tampung.push(rekam);
    return;
  }
  try {
    await antrean.dapatkan().catatBanyak([rekam]);
  } catch (g) {
    statistik.gagalCatat += 1;
    const galat = new Error(`Mode kembaran: tulisan tidak dapat dicatat ke antrean sinkron (${String((g && g.message) || g).slice(0, 160)}). Tulisan DIBATALKAN, bukan dilewatkan.`);
    galat.code = "KEMBARAN_ANTREAN_GAGAL";
    throw galat;
  }
}

/**
 * @param sumber   "sipp" | "abt" | "antrian" | kunci koneksi lain
 * @param literal  SQL (boleh beberapa pernyataan) dengan nilai sudah diselipkan
 * @param asliBaca (stmt) => Promise<hasil> eksekusi SUNGGUHAN di basis data lokal
 */
async function proses({ sumber, literal, asliBaca, tx }) {
  const daftar = Q.pecahPernyataan(literal);
  const hasil = [];
  const konteks = als.getStore() || null;
  for (const stmt of daftar) {
    if (!Q.adalahTulis(stmt)) {
      hasil.push(await asliBaca(stmt));
      continue;
    }
    const u = Q.uraiTulisan(stmt);
    if (u.terbaca && /^aleta_/i.test(u.tabel)) {
      // Tabel milik ALETA sendiri: tetap ditulis (di salinan laptop).
      statistik.diteruskanAleta += 1;
      hasil.push(await asliBaca(stmt));
      continue;
    }
    const rekam = await susunRekam({ sumber, stmt, bacaFn: asliBaca, konteks, tx });
    await simpanRekam(rekam, tx);
    statistik.dialihkan += 1;
    statistik.terakhir = new Date().toISOString();
    hasil.push(jawabanSemu(rekam));
  }
  return daftar.length === 1 ? hasil[0] : hasil;
}

function opsiFormat(sumberKonfig) {
  const k = (sumberKonfig && (sumberKonfig.connectionConfig || sumberKonfig)) || {};
  return { stringifyObjects: k.stringifyObjects, timezone: k.timezone };
}

function normalisasi(args, format) {
  const [a, b, c] = args;
  let sql;
  let values;
  let cb;
  if (a && typeof a === "object" && typeof a.sql === "string") {
    sql = a.sql;
    values = a.values;
  } else {
    sql = a;
  }
  if (typeof b === "function") cb = b;
  else {
    if (b !== undefined) values = b;
    if (typeof c === "function") cb = c;
  }
  if (typeof sql !== "string") return { dapatDialihkan: false };
  const literal = values !== undefined && values !== null ? mysql.format(sql, values, format.stringifyObjects, format.timezone) : sql;
  return { dapatDialihkan: true, literal, cb };
}

function lewatiPenjaga(args, format) {
  const n = normalisasi(args, format);
  if (!n.dapatDialihkan) return null;
  return Q.pecahPernyataan(n.literal).some(Q.adalahTulis) ? n : null;
}

function jalankan(n, ctx) {
  const emitter = new EventEmitter();
  emitter.sql = n.literal;
  emitter.stream = () => {
    throw new Error("Mode kembaran: aliran hasil tidak didukung untuk tulisan.");
  };
  proses({ sumber: ctx.sumber, literal: n.literal, asliBaca: ctx.asliBaca, tx: ctx.tx })
    .then((r) => {
      if (n.cb) n.cb(null, r, undefined);
    })
    .catch((g) => {
      if (n.cb) n.cb(g);
      else console.error("[penjagaKembaran]", g && g.message ? g.message : g);
    });
  return emitter;
}

function bacaDari(queryAsli) {
  return (stmt) =>
    new Promise((ok, no) => {
      queryAsli(stmt, (g, r) => (g ? no(g) : ok(r)));
    });
}

// ---------------------------------------------------------------------------
// Pembungkus koneksi dan kolam
// ---------------------------------------------------------------------------

async function lepasTampung(tx) {
  const rows = tx.tampung;
  tx.tampung = [];
  if (!rows.length) return;
  try {
    await antrean.dapatkan().catatBanyak(rows);
  } catch (g) {
    statistik.gagalCatat += 1;
    const galat = new Error(`Mode kembaran: transaksi tidak dapat dicatat ke antrean sinkron (${String((g && g.message) || g).slice(0, 160)}).`);
    galat.code = "KEMBARAN_ANTREAN_GAGAL";
    throw galat;
  }
}

const RE_MULAI_TX = /^\s*(START\s+TRANSACTION|BEGIN)\b/i;
const RE_COMMIT = /^\s*COMMIT\b/i;
const RE_ROLLBACK = /^\s*ROLLBACK\b(?!\s+TO\b)/i;

function bungkusKoneksi(conn, sumber) {
  if (!conn || conn.__kembaran) return conn;
  conn.__kembaran = true;
  const tx = { aktif: false, tampung: [], kelompok: null, urutan: 0 };
  conn.__kembaranTx = tx;
  const queryAsli = conn.query.bind(conn);
  const format = opsiFormat(conn.config);
  const asliBaca = bacaDari(queryAsli);

  conn.query = function queryKembaran(...args) {
    const n = lewatiPenjaga(args, format);
    if (n) return jalankan(n, { sumber, asliBaca, tx });
    // Transaksi bertulisan teks: ikuti keadaannya.
    const teks = typeof args[0] === "string" ? args[0] : args[0] && args[0].sql;
    if (typeof teks === "string") {
      if (RE_MULAI_TX.test(teks)) {
        tx.aktif = true;
        tx.tampung = [];
        tx.kelompok = idKelompok();
        tx.urutan = 0;
      } else if (RE_ROLLBACK.test(teks)) {
        tx.aktif = false;
        tx.tampung = [];
      } else if (RE_COMMIT.test(teks)) {
        const cb = [args[1], args[2]].find((x) => typeof x === "function");
        const lanjut = () => queryAsli(...args);
        tx.aktif = false;
        lepasTampung(tx).then(lanjut, (g) => (cb ? cb(g) : undefined));
        return new EventEmitter();
      }
    }
    return queryAsli(...args);
  };

  if (typeof conn.beginTransaction === "function") {
    const asliMulai = conn.beginTransaction.bind(conn);
    conn.beginTransaction = function (...a) {
      tx.aktif = true;
      tx.tampung = [];
      tx.kelompok = idKelompok();
      tx.urutan = 0;
      return asliMulai(...a);
    };
    const asliCommit = conn.commit.bind(conn);
    conn.commit = function (...a) {
      const cb = a.find((x) => typeof x === "function");
      tx.aktif = false;
      lepasTampung(tx).then(
        () => asliCommit(...a),
        (g) => {
          // Catatan gagal: transaksi lokal dibatalkan agar pemanggil tidak mengira tulisan itu tercatat.
          conn.rollback(() => (cb ? cb(g) : undefined));
        }
      );
    };
    const asliRollback = conn.rollback.bind(conn);
    conn.rollback = function (...a) {
      tx.aktif = false;
      tx.tampung = [];
      return asliRollback(...a);
    };
  }
  if (typeof conn.release === "function") {
    const asliRelease = conn.release.bind(conn);
    conn.release = function () {
      tx.aktif = false;
      tx.tampung = [];
      return asliRelease();
    };
  }
  return conn;
}

/**
 * Membungkus kolam `pool` (mysql.createPool). Mode biasa: dikembalikan apa adanya.
 */
function pasang(pool, sumber) {
  if (!mode.aktif() || !pool || pool.__kembaranPool) return pool;
  pool.__kembaranPool = sumber;
  const queryAsli = pool.query.bind(pool);
  const getConnAsli = pool.getConnection.bind(pool);
  const format = opsiFormat(pool.config);
  const asliBaca = bacaDari(queryAsli);

  pool.query = function queryKolamKembaran(...args) {
    const n = lewatiPenjaga(args, format);
    if (n) return jalankan(n, { sumber, asliBaca, tx: null });
    return queryAsli(...args);
  };
  pool.getConnection = function getConnectionKembaran(cb) {
    return getConnAsli((galat, conn) => {
      if (galat || !conn) return cb(galat, conn);
      return cb(null, bungkusKoneksi(conn, sumber));
    });
  };
  return pool;
}

/** Dasar baris antrean (kelompok, urutan, aktor, operasi) untuk penulis non-SQL (berkas). */
function dasarRekam() {
  const k = als.getStore();
  if (k) {
    k.urutan += 1;
    return { kelompok: k.kelompok, urutan: k.urutan, aktor: k.aktor, operasi: k.operasi };
  }
  return { kelompok: idKelompok(), urutan: 1, aktor: null, operasi: null };
}

function ringkasan() {
  return { aktif: mode.aktif(), ...statistik };
}

module.exports = {
  pasang,
  bungkusKoneksi,
  middlewareExpress,
  denganKonteks,
  konteksSaatIni,
  idKelompok,
  dasarRekam,
  proses,
  ringkasan,
  // untuk uji
  _normalisasi: normalisasi,
  _susunRekam: susunRekam,
  _jawabanSemu: jawabanSemu,
};
