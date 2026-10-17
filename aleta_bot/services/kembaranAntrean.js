"use strict";

/**
 * ============================================================================
 * ANTREAN "MENUNGGU SINKRON" - tulisan ke SIPP/ABT yang ditahan di laptop
 * ============================================================================
 *
 * Disimpan di basis data TERSENDIRI di MySQL laptop (bawaan: `aleta_kembaran`),
 * BUKAN di `aleta_bot` atau Postgres portal. Alasannya satu: penarikan data dari
 * server (scripts/kembaran/tarik.mjs) memulihkan SIPP, ABT, aleta_bot, dan
 * Postgres ALETA dari cadangan server - menimpa isinya. Antrean yang ikut di
 * dalamnya akan hilang tepat pada saat ia paling dibutuhkan. Basis data
 * tersendiri ini tidak pernah disentuh pemulihan.
 *
 * Satu baris = satu pernyataan tulis (atau satu langkah berkas) persis seperti
 * yang akan dijalankan, dengan jam relatif sudah dijadikan literal dan nilai
 * parameter sudah diselipkan, sehingga yang dikirim Senin depan sama dengan
 * yang dilakukan petugas hari ini.
 *
 * Status baris:
 *   menunggu   baru dicatat
 *   disetujui  Super Admin menyetujui (hanya baris yang lolos pemeriksaan)
 *   ditolak    Super Admin menyingkirkan - tidak akan dikirim
 *   terkirim   sudah dijalankan di server
 *   gagal      dikirim tetapi ditolak server / tidak cocok (kelompoknya dibatalkan)
 * Hasil pemeriksaan (terpisah dari status):
 *   aman | bentrok | ditahan | tak_dapat_diperiksa | null (belum diperiksa)
 */

const mysql = require("mysql");

const STATUS = Object.freeze(["menunggu", "disetujui", "ditolak", "terkirim", "gagal"]);
const HASIL = Object.freeze(["aman", "bentrok", "ditahan", "tak_dapat_diperiksa"]);

function namaDb() {
  const n = String(process.env.ALETA_KEMBARAN_ANTREAN_DB || "aleta_kembaran").trim();
  if (!/^[A-Za-z0-9_]{1,64}$/.test(n)) throw new Error("ALETA_KEMBARAN_ANTREAN_DB tidak sah.");
  return n;
}

const SKEMA_TABEL = `
CREATE TABLE IF NOT EXISTS kembaran_tulis (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  kelompok VARCHAR(64) NOT NULL,
  urutan INT NOT NULL DEFAULT 1,
  dicatat_pada DATETIME NOT NULL,
  sumber VARCHAR(40) NOT NULL,
  jenis VARCHAR(24) NOT NULL,
  tabel VARCHAR(190) NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'menunggu',
  hasil VARCHAR(24) NULL,
  data LONGTEXT NOT NULL,
  KEY k_kelompok (kelompok, urutan),
  KEY k_status (status, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

function waktuMysql(d = new Date()) {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

/** Baris basis data <-> objek kerja. `data` memuat semua yang tidak perlu disaring lewat SQL. */
function keObjek(r) {
  let data = {};
  try {
    data = JSON.parse(r.data || "{}");
  } catch {
    data = {};
  }
  return {
    ...data,
    id: Number(r.id),
    kelompok: r.kelompok,
    urutan: Number(r.urutan),
    dicatatPada: data.dicatatPada || r.dicatat_pada,
    sumber: r.sumber,
    jenis: r.jenis,
    tabel: r.tabel || "",
    status: r.status,
    hasil: r.hasil || null,
  };
}

/** Bagian objek yang disimpan sebagai JSON (kolom saringan dikeluarkan). */
function keData(o) {
  const salin = { ...o };
  for (const k of ["id", "kelompok", "urutan", "sumber", "jenis", "tabel", "status", "hasil"]) delete salin[k];
  return JSON.stringify(salin);
}

// ---------------------------------------------------------------------------
// Penyimpan MySQL
// ---------------------------------------------------------------------------

function buatPenyimpanMysql(opsi = {}) {
  let kolam = opsi.kolam || null;
  let siap = null;

  function sambungan() {
    if (kolam) return kolam;
    kolam = mysql.createPool({
      host: process.env.ALETA_KEMBARAN_ANTREAN_HOST || process.env.ALETA_BOT_DB_HOST || "127.0.0.1",
      port: Number(process.env.ALETA_KEMBARAN_ANTREAN_PORT || process.env.ALETA_BOT_DB_PORT || 3306),
      user: process.env.ALETA_KEMBARAN_ANTREAN_USER || process.env.ALETA_BOT_DB_USER || "root",
      password: process.env.ALETA_KEMBARAN_ANTREAN_PASSWORD ?? process.env.ALETA_BOT_DB_PASSWORD ?? "",
      charset: "utf8mb4",
      connectionLimit: 3,
      multipleStatements: false,
      timezone: "Z",
    });
    return kolam;
  }

  function tanya(sql, params = []) {
    return new Promise((ok, no) => sambungan().query(sql, params, (g, r) => (g ? no(g) : ok(r))));
  }

  async function pastikan() {
    if (!siap) {
      siap = (async () => {
        const db = namaDb();
        await tanya(`CREATE DATABASE IF NOT EXISTS \`${db}\` DEFAULT CHARACTER SET utf8mb4`);
        await tanya(SKEMA_TABEL.replace("kembaran_tulis", `\`${db}\`.kembaran_tulis`));
      })().catch((g) => {
        siap = null;
        throw g;
      });
    }
    return siap;
  }

  const T = () => `\`${namaDb()}\`.kembaran_tulis`;

  return {
    nama: "mysql",
    async catatBanyak(baris) {
      await pastikan();
      const ids = [];
      for (const o of baris) {
        const r = await tanya(
          `INSERT INTO ${T()} (kelompok, urutan, dicatat_pada, sumber, jenis, tabel, status, hasil, data) VALUES (?,?,?,?,?,?,?,?,?)`,
          [
            o.kelompok,
            o.urutan || 1,
            waktuMysql(new Date(o.dicatatPada || Date.now())),
            o.sumber,
            o.jenis,
            (o.tabel || "").slice(0, 190) || null,
            o.status || "menunggu",
            o.hasil || null,
            keData(o),
          ]
        );
        ids.push(Number(r.insertId));
      }
      return ids;
    },
    async daftar({ status, kelompok, sumber, batas = 500, mulaiDariId = 0 } = {}) {
      await pastikan();
      const where = ["id > ?"];
      const p = [Number(mulaiDariId) || 0];
      if (status) {
        const daftarStatus = Array.isArray(status) ? status : [status];
        where.push(`status IN (${daftarStatus.map(() => "?").join(",")})`);
        p.push(...daftarStatus);
      }
      if (kelompok) {
        where.push("kelompok = ?");
        p.push(kelompok);
      }
      if (sumber) {
        where.push("sumber = ?");
        p.push(sumber);
      }
      const rows = await tanya(`SELECT * FROM ${T()} WHERE ${where.join(" AND ")} ORDER BY id ASC LIMIT ${Math.max(1, Math.min(5000, Number(batas) || 500))}`, p);
      return rows.map(keObjek);
    },
    async ambil(ids) {
      await pastikan();
      if (!ids.length) return [];
      const rows = await tanya(`SELECT * FROM ${T()} WHERE id IN (${ids.map(() => "?").join(",")}) ORDER BY id ASC`, ids.map(Number));
      return rows.map(keObjek);
    },
    async ubah(id, patch) {
      await pastikan();
      const [r] = await tanya(`SELECT * FROM ${T()} WHERE id = ?`, [Number(id)]);
      if (!r) return null;
      const o = { ...keObjek(r), ...patch };
      await tanya(`UPDATE ${T()} SET status = ?, hasil = ?, data = ? WHERE id = ?`, [o.status, o.hasil || null, keData(o), Number(id)]);
      return o;
    },
    async hitung() {
      await pastikan();
      const rows = await tanya(`SELECT status, hasil, COUNT(*) AS n FROM ${T()} GROUP BY status, hasil`);
      return rows.map((r) => ({ status: r.status, hasil: r.hasil || null, n: Number(r.n) }));
    },
    async tutup() {
      if (kolam) await new Promise((ok) => kolam.end(() => ok()));
      kolam = null;
      siap = null;
    },
  };
}

// ---------------------------------------------------------------------------
// Penyimpan memori (uji, dan cadangan bila MySQL laptop tidak dapat dipakai)
// ---------------------------------------------------------------------------

function buatPenyimpanMemori() {
  const baris = [];
  let nomor = 0;
  return {
    nama: "memori",
    async catatBanyak(rows) {
      return rows.map((o) => {
        nomor += 1;
        baris.push({ ...JSON.parse(JSON.stringify(o)), id: nomor, status: o.status || "menunggu", hasil: o.hasil || null });
        return nomor;
      });
    },
    async daftar({ status, kelompok, sumber, batas = 500, mulaiDariId = 0 } = {}) {
      const st = status ? (Array.isArray(status) ? status : [status]) : null;
      return baris
        .filter((o) => o.id > mulaiDariId && (!st || st.includes(o.status)) && (!kelompok || o.kelompok === kelompok) && (!sumber || o.sumber === sumber))
        .slice(0, batas)
        .map((o) => JSON.parse(JSON.stringify(o)));
    },
    async ambil(ids) {
      const set = new Set(ids.map(Number));
      return baris.filter((o) => set.has(o.id)).map((o) => JSON.parse(JSON.stringify(o)));
    },
    async ubah(id, patch) {
      const o = baris.find((x) => x.id === Number(id));
      if (!o) return null;
      Object.assign(o, JSON.parse(JSON.stringify(patch)));
      return JSON.parse(JSON.stringify(o));
    },
    async hitung() {
      const peta = new Map();
      for (const o of baris) {
        const k = `${o.status}|${o.hasil || ""}`;
        peta.set(k, (peta.get(k) || 0) + 1);
      }
      return [...peta].map(([k, n]) => {
        const [status, hasil] = k.split("|");
        return { status, hasil: hasil || null, n };
      });
    },
    async tutup() {},
  };
}

let penyimpan = null;

function dapatkan() {
  if (!penyimpan) penyimpan = buatPenyimpanMysql();
  return penyimpan;
}

/** Untuk uji: ganti penyimpan (mis. memori). */
function aturPenyimpan(p) {
  penyimpan = p;
}

module.exports = {
  STATUS,
  HASIL,
  namaDb,
  buatPenyimpanMysql,
  buatPenyimpanMemori,
  dapatkan,
  aturPenyimpan,
};
