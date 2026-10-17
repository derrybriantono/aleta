// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { kalimatPita, modeKembaran, susunPanggilanAksi } from "@/server/modules/sinkron/kembaran";

/**
 * ============================================================================
 * KEMBARAN DI LAPTOP (19 Okt 2026) - tulisan ke SIPP/ABT ditahan, bentrok dijaga
 * ============================================================================
 *
 * Membuktikan PERILAKU, bukan sekadar teks kode:
 *   A. mode kembaran mengalihkan SEMUA jalur tulis (kolam, transaksi, banyak
 *      pernyataan, berkas) ke antrean dan tidak satu pun sampai ke basis data;
 *      di mode biasa kolam tidak disentuh sama sekali;
 *   B. pemeriksa bentrok: server berubah sejak dicuplik = bentrok; tanggal
 *      substantif yang sudah terisi = ditahan; kunci unik ganda = bentrok;
 *   C. persetujuan dan dorong: hanya yang aman, hanya setelah disetujui,
 *      diperiksa ulang saat kirim, satu transaksi per kelompok, SQL & aktor
 *      asli tidak berubah, kata "Aleta" tidak pernah lolos ke SIPP;
 *   D. WhatsApp & e-Court mati, konfigurasi tarikan tak dapat menyalakannya;
 *   E. skrip tarik menolak tujuan terlarang.
 */
const AKAR = path.resolve(process.cwd(), "..");
const req = createRequire(import.meta.url);
const botReq = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const bot = (b: string) => botReq(path.join(AKAR, "aleta_bot", b));
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");

type Apa = any;
const mysql: Apa = botReq("mysql");

const Q: Apa = bot("services/kembaranSql.js");
const B: Apa = bot("services/kembaranBentrok.js");
const mode: Apa = bot("services/kembaranMode.js");
const antrean: Apa = bot("services/kembaranAntrean.js");
const penjaga: Apa = bot("services/penjagaKembaran.js");
const dorongModul: Apa = bot("services/kembaranDorong.js");
const berkasModul: Apa = bot("services/kembaranBerkas.js");

// ─── basis data tiruan ───────────────────────────────────────────────────────

type Baris = Record<string, unknown>;

/** Kolam tiruan: mencatat semua SQL yang SAMPAI ke "basis data", menjawab SELECT dari `jawab`. */
function buatKolam(jawab: (sql: string) => Baris[] | undefined = () => []) {
  const sampai: string[] = [];
  const jalankan = (sql: string, cb: (g: unknown, r?: unknown) => void) => {
    sampai.push(sql);
    if (/^\s*(SELECT|SHOW)\b/i.test(sql)) {
      const baris = jawab(sql);
      return setImmediate(() => cb(null, baris ?? []));
    }
    return setImmediate(() => cb(null, { affectedRows: 1, insertId: 0 }));
  };
  const pool: Apa = {
    config: { connectionConfig: {} },
    query(a: Apa, b?: Apa, c?: Apa) {
      const sql = typeof a === "object" ? a.sql : a;
      const nilai = typeof b === "function" ? undefined : b;
      const cb = typeof b === "function" ? b : c;
      return jalankan(nilai ? mysql.format(sql, nilai) : sql, cb);
    },
    getConnection(cb: Apa) {
      const conn: Apa = {
        config: {},
        query(a: Apa, b?: Apa, c?: Apa) {
          const sql = typeof a === "object" ? a.sql : a;
          const nilai = typeof b === "function" ? undefined : b;
          const cbk = typeof b === "function" ? b : c;
          return jalankan(nilai ? mysql.format(sql, nilai) : sql, cbk);
        },
        beginTransaction(...a: Apa[]) {
          sampai.push("<<BEGIN>>");
          const f = a.find((x) => typeof x === "function");
          setImmediate(() => f && f(null));
        },
        commit(...a: Apa[]) {
          sampai.push("<<COMMIT>>");
          const f = a.find((x) => typeof x === "function");
          setImmediate(() => f && f(null));
        },
        rollback(...a: Apa[]) {
          sampai.push("<<ROLLBACK>>");
          const f = a.find((x) => typeof x === "function");
          setImmediate(() => f && f(null));
        },
        release() {
          sampai.push("<<RELEASE>>");
        },
      };
      setImmediate(() => cb(null, conn));
    },
  };
  return { pool, sampai };
}

const tanya = (pool: Apa, sql: string, nilai?: unknown[]) =>
  new Promise<Apa>((ok, no) => {
    const cb = (g: unknown, r: unknown) => (g ? no(g) : ok(r));
    if (nilai) pool.query(sql, nilai, cb);
    else pool.query(sql, cb);
  });

const KUNCI_ENV = ["ALETA_MODE", "ALETA_KEMBARAN_DIR", "ALETA_KEMBARAN_CAP_TARIK", "ALETA_KEMBARAN_BERKAS_DIR"];
let lingkunganAsal: Record<string, string | undefined> = {};
let folderKerja = "";

beforeEach(() => {
  lingkunganAsal = Object.fromEntries(KUNCI_ENV.map((k) => [k, process.env[k]]));
  folderKerja = mkdtempSync(path.join(process.env.TEMP || os.tmpdir(), "kembaran-uji-"));
  process.env.ALETA_KEMBARAN_DIR = folderKerja;
  process.env.ALETA_MODE = "kembaran";
  antrean.aturPenyimpan(antrean.buatPenyimpanMemori());
});

afterEach(() => {
  for (const k of KUNCI_ENV) {
    if (lingkunganAsal[k] === undefined) delete process.env[k];
    else process.env[k] = lingkunganAsal[k];
  }
  antrean.aturPenyimpan(null);
  rmSync(folderKerja, { recursive: true, force: true });
});

// ─── A. pengalihan ───────────────────────────────────────────────────────────

describe("A - mode kembaran mengalihkan semua jalur tulis", () => {
  it("mode biasa: kolam dikembalikan apa adanya (tidak dibungkus)", async () => {
    process.env.ALETA_MODE = "";
    const { pool, sampai } = buatKolam();
    const asli = pool.query;
    expect(penjaga.pasang(pool, "sipp").query).toBe(asli);
    await tanya(pool, "UPDATE perkara SET a = 1 WHERE perkara_id = 5");
    expect(sampai).toEqual(["UPDATE perkara SET a = 1 WHERE perkara_id = 5"]);
    expect(await antrean.dapatkan().daftar({})).toEqual([]);
  });

  it("tulisan tidak sampai ke basis data; masuk antrean dengan cuplikan nilai lama; jawabannya meniru aslinya", async () => {
    const { pool, sampai } = buatKolam((sql) =>
      /FROM perkara_putusan/.test(sql) ? [{ perkara_id: 5, amar_putusan: "lama", tanggal_putusan: null }] : []
    );
    penjaga.pasang(pool, "sipp");
    const r = await tanya(pool, "UPDATE perkara_putusan SET amar_putusan = ? WHERE perkara_id = ?", ["baru", 5]);
    expect(r.affectedRows).toBe(1);
    expect(sampai.some((s) => /^UPDATE/i.test(s))).toBe(false);
    const [b] = await antrean.dapatkan().daftar({});
    expect(b.jenis).toBe("UPDATE");
    expect(b.sumber).toBe("sipp");
    expect(b.tabel).toBe("perkara_putusan");
    expect(b.sql).toBe("UPDATE perkara_putusan SET amar_putusan = 'baru' WHERE perkara_id = 5");
    expect(b.cuplikan.status).toBe("lengkap");
    expect(b.cuplikan.baris[0].amar_putusan).toBe("lama");
    expect(b.status).toBe("menunggu");
  });

  it("SELECT dan SET lewat; INSERT mendapat insertId semu yang besar", async () => {
    const { pool, sampai } = buatKolam(() => [{ n: 1 }]);
    penjaga.pasang(pool, "sipp");
    await tanya(pool, "SELECT 1 AS n");
    await tanya(pool, "SET NAMES utf8mb4");
    expect(sampai).toEqual(["SELECT 1 AS n", "SET NAMES utf8mb4"]);
    const r = await tanya(pool, "INSERT INTO sys_audittrail (a, b) VALUES (?, ?)", [1, "x"]);
    expect(r.insertId).toBeGreaterThan(1_000_000_000);
    expect(r.affectedRows).toBe(1);
  });

  it("jam relatif (NOW, CURDATE) dijadikan literal saat tulisan terjadi, bukan saat dikirim", async () => {
    const { pool } = buatKolam((sql) =>
      /DATE_FORMAT/.test(sql)
        ? [{ dt: "2026-10-19 07:15:00", d: "2026-10-19", t: "07:15:00", udt: "2026-10-18 23:15:00", ud: "2026-10-18", ut: "23:15:00" }]
        : []
    );
    penjaga.pasang(pool, "sipp");
    await tanya(pool, "UPDATE antrian_sidang SET waktu = NOW(), hari = CURDATE() WHERE id = 3");
    const [b] = await antrean.dapatkan().daftar({});
    expect(b.sql).toContain("waktu = '2026-10-19 07:15:00'");
    expect(b.sql).toContain("hari = '2026-10-19'");
    expect(b.sql).not.toMatch(/NOW\(|CURDATE\(/i);
  });

  it("tabel milik ALETA (aleta_*) tetap ditulis, bukan diantrekan", async () => {
    const { pool, sampai } = buatKolam();
    penjaga.pasang(pool, "sipp");
    await tanya(pool, "INSERT INTO aleta_bot_catatan (a) VALUES (1)");
    expect(sampai).toContain("INSERT INTO aleta_bot_catatan (a) VALUES (1)");
    expect(await antrean.dapatkan().daftar({})).toEqual([]);
  });

  it("DDL dan CALL diantrekan sebagai tulisan yang tidak dapat dikirim otomatis", async () => {
    const { pool, sampai } = buatKolam();
    penjaga.pasang(pool, "abt");
    await tanya(pool, "ALTER TABLE x ADD COLUMN y INT");
    await tanya(pool, "CALL prosedur_apa_saja()");
    await tanya(pool, "CREATE TEMPORARY TABLE sementara (a INT)");
    expect(sampai).toEqual(["CREATE TEMPORARY TABLE sementara (a INT)"]);
    const daftar = await antrean.dapatkan().daftar({});
    expect(daftar.map((b: Apa) => b.jenis)).toEqual(["DDL", "LAIN"]);
  });

  it("beberapa pernyataan dalam satu panggilan: bacaan jalan, tulisan diantrekan", async () => {
    const { pool, sampai } = buatKolam(() => [{ x: 1 }]);
    penjaga.pasang(pool, "sipp");
    const r = await tanya(pool, "SELECT 1; DELETE FROM perkara_proses WHERE id = 9");
    expect(Array.isArray(r)).toBe(true);
    expect(sampai.some((s) => /^DELETE/i.test(s))).toBe(false);
    expect((await antrean.dapatkan().daftar({}))[0].jenis).toBe("DELETE");
  });

  it("satu permintaan = satu kelompok; urutan tulisan terjaga", async () => {
    const { pool } = buatKolam();
    penjaga.pasang(pool, "sipp");
    await penjaga.denganKonteks({ operasi: "POST /jadwal-sidang/tunda", aktor: "hakim.satu" }, async () => {
      await tanya(pool, "UPDATE perkara_jadwal_sidang SET ditunda = 1 WHERE id = 1");
      await tanya(pool, "INSERT INTO sys_audittrail (u) VALUES ('hakim.satu')");
    });
    await tanya(pool, "UPDATE perkara SET z = 1 WHERE perkara_id = 2");
    const daftar = await antrean.dapatkan().daftar({});
    expect(daftar[0].kelompok).toBe(daftar[1].kelompok);
    expect(daftar[2].kelompok).not.toBe(daftar[0].kelompok);
    expect(daftar[0].urutan).toBeLessThan(daftar[1].urutan);
    expect(daftar[0].aktor).toBe("hakim.satu");
    expect(daftar[0].operasi).toBe("POST /jadwal-sidang/tunda");
  });

  it("transaksi: ROLLBACK membuang catatan, COMMIT melepasnya sekaligus dalam satu kelompok", async () => {
    const { pool, sampai } = buatKolam();
    penjaga.pasang(pool, "sipp");
    const conn: Apa = await new Promise((ok) => pool.getConnection((_g: unknown, c: unknown) => ok(c)));
    await new Promise((ok) => conn.beginTransaction(ok));
    await tanya(conn, "UPDATE perkara SET a = 1 WHERE perkara_id = 1");
    await tanya(conn, "UPDATE perkara SET a = 2 WHERE perkara_id = 2");
    await new Promise((ok) => conn.rollback(ok));
    expect(await antrean.dapatkan().daftar({})).toEqual([]);

    await new Promise((ok) => conn.beginTransaction(ok));
    await tanya(conn, "UPDATE perkara SET a = 3 WHERE perkara_id = 3");
    await tanya(conn, "UPDATE perkara SET a = 4 WHERE perkara_id = 4");
    expect(await antrean.dapatkan().daftar({})).toEqual([]); // belum komit
    await new Promise((ok) => conn.commit(ok));
    const daftar = await antrean.dapatkan().daftar({});
    expect(daftar).toHaveLength(2);
    expect(daftar[0].kelompok).toBe(daftar[1].kelompok);
    expect(sampai.some((s) => /^UPDATE/i.test(s))).toBe(false);
  });

  it("transaksi bertulisan teks (START TRANSACTION ... COMMIT) diikuti sama", async () => {
    const { pool } = buatKolam();
    penjaga.pasang(pool, "sipp");
    const conn: Apa = await new Promise((ok) => pool.getConnection((_g: unknown, c: unknown) => ok(c)));
    await tanya(conn, "START TRANSACTION");
    await tanya(conn, "DELETE FROM perkara_proses WHERE id = 7");
    await tanya(conn, "ROLLBACK");
    expect(await antrean.dapatkan().daftar({})).toEqual([]);
    await tanya(conn, "START TRANSACTION");
    await tanya(conn, "DELETE FROM perkara_proses WHERE id = 8");
    await tanya(conn, "COMMIT");
    expect(await antrean.dapatkan().daftar({})).toHaveLength(1);
  });

  it("antrean tak dapat ditulis = tulisan DIBATALKAN dengan galat, tidak diam-diam lolos", async () => {
    antrean.aturPenyimpan({
      ...antrean.buatPenyimpanMemori(),
      catatBanyak: async () => {
        throw new Error("disk penuh");
      },
    });
    const { pool, sampai } = buatKolam();
    penjaga.pasang(pool, "sipp");
    await expect(tanya(pool, "UPDATE perkara SET a = 1 WHERE perkara_id = 1")).rejects.toThrow(/DIBATALKAN/);
    expect(sampai.some((s) => /^UPDATE/i.test(s))).toBe(false);
  });

  it("db_config*.js dan kolam externalDbService memasang penjaga; berkas e-Doc lewat kembaranBerkas", () => {
    for (const b of ["db_config.js", "db_config4.js", "db_config5.js"]) {
      expect(baca(`aleta_bot/${b}`), b).toContain('require("./services/penjagaKembaran").pasang(db,');
    }
    expect(baca("aleta_bot/services/externalDbService.js")).toContain('require("./penjagaKembaran").pasang(pool,');
    for (const b of ["putusanUnggahService", "dokumenPenetapanService", "basUnggahService"]) {
      const kode = baca(`aleta_bot/services/${b}.js`);
      expect(kode, b).toContain("kembaranBerkas.");
      expect(kode, `${b} masih menulis langsung ke folder SIPP`).not.toMatch(/fs\.writeFileSync\((penuhAsli|penuhPdf|penuh),\s*(pdf|pdfTerbit)/);
    }
  });

  it("berkas e-Doc: mode biasa menulis ke folder; kembaran menahannya di antrean (tidak ada berkas di folder SIPP)", async () => {
    const akar = path.join(folderKerja, "SIPP");
    const penuh = path.join(akar, "resources/file/doc/2026/10/contoh.pdf");
    process.env.ALETA_MODE = "";
    await berkasModul.tulis(penuh, Buffer.from("PDF-biasa"), { akar });
    expect(readFileSync(penuh, "utf8")).toBe("PDF-biasa");
    rmSync(penuh);

    process.env.ALETA_MODE = "kembaran";
    await penjaga.denganKonteks({ operasi: "POST /unggah" }, async () => {
      await berkasModul.tulis(penuh, Buffer.from("PDF-kembaran"), { akar, flag: "wx" });
      await berkasModul.pindah(path.join(akar, "resources/file/doc/lama.pdf"), path.join(akar, "resources/file/doc/terhapus/lama.pdf"), { akar });
    });
    expect(existsSync(penuh)).toBe(false);
    const [t, p] = await antrean.dapatkan().daftar({});
    expect(t.jenis).toBe("BERKAS_TULIS");
    expect(t.berkas.relatif).toBe("resources/file/doc/2026/10/contoh.pdf");
    expect(t.berkas.tanpaTimpa).toBe(true);
    expect(readFileSync(t.berkas.simpan, "utf8")).toBe("PDF-kembaran");
    expect(p.jenis).toBe("BERKAS_PINDAH");
    expect(p.kelompok).toBe(t.kelompok);
    expect(() => berkasModul.relatifDariAkar("/di/luar/x.pdf", akar)).toThrow(/di luar folder SIPP/);
  });
});

// ─── pembaca SQL ─────────────────────────────────────────────────────────────

describe("pembaca SQL kembaran", () => {
  it("mengenali golongan pernyataan dan gagal tertutup untuk kata tak dikenal", () => {
    expect(Q.golongan("select * from x")).toBe("baca");
    expect(Q.golongan("/* k */ UPDATE x SET a=1")).toBe("UPDATE");
    expect(Q.golongan("REPLACE INTO x VALUES (1)")).toBe("REPLACE");
    expect(Q.golongan("TRUNCATE x")).toBe("DDL");
    expect(Q.golongan("MERGE INTO x")).toBe("LAIN");
    expect(Q.golongan("SELECT * FROM x INTO OUTFILE 'a'")).toBe("LAIN");
    expect(Q.pecahPernyataan("UPDATE a SET b=';'; SELECT 1;")).toEqual(["UPDATE a SET b=';'", "SELECT 1"]);
  });

  it("kata kunci di dalam teks tidak terbaca sebagai kata kunci", () => {
    const u = Q.uraiTulisan("UPDATE perkara_putusan SET amar_putusan = 'tunda WHERE x', b = 2 WHERE perkara_id = 5 LIMIT 1");
    expect(u.terbaca).toBe(true);
    expect(u.kolomUbah).toEqual(["amar_putusan", "b"]);
    expect(u.where).toBe("perkara_id = 5");
    expect(u.urutBatas).toBe("LIMIT 1");
    expect(Q.susunSelectCuplikan(u)).toBe("SELECT * FROM perkara_putusan WHERE perkara_id = 5 LIMIT 1");
  });

  it("INSERT banyak baris, bentuk SET, dan yang tak terbaca (SELECT, JOIN)", () => {
    const a = Q.uraiTulisan("INSERT INTO t (a,b) VALUES (1,'x,y'),(2,NULL)");
    expect(a.baris).toHaveLength(2);
    expect(a.baris[0][1]).toEqual({ tipe: "teks", nilai: "x,y" });
    expect(a.baris[1][1].tipe).toBe("null");
    expect(Q.uraiTulisan("INSERT INTO t SET a=1, b='q'").kolom).toEqual(["a", "b"]);
    expect(Q.uraiTulisan("INSERT INTO t2 SELECT * FROM t").terbaca).toBe(false);
    expect(Q.uraiTulisan("UPDATE a JOIN b ON a.x=b.x SET a.y=1").terbaca).toBe(false);
  });
});

// ─── B. pemeriksa bentrok ────────────────────────────────────────────────────

/** Baris antrean UPDATE siap periksa, dibuat lewat penjaga sungguhan. */
async function antreanUpdate(sql: string, lama: Baris[], nilai: unknown[] = []) {
  const { pool } = buatKolam((s) => (/^SELECT \* FROM/i.test(s) ? lama : []));
  penjaga.pasang(pool, "sipp");
  await tanya(pool, sql, nilai.length ? nilai : undefined);
  const daftar = await antrean.dapatkan().daftar({});
  return daftar[daftar.length - 1];
}

function ctxServer(rowsServer: Baris[], kunci = { utama: ["perkara_id"], unik: [] as string[][], terbaca: true }) {
  return {
    bacaServer: async () => rowsServer,
    kunciServer: async () => kunci,
  };
}

describe("B - pemeriksa bentrok", () => {
  it("UPDATE: server sama seperti cuplikan = aman", async () => {
    const b = await antreanUpdate("UPDATE perkara_putusan SET amar_putusan = 'baru' WHERE perkara_id = 5", [{ perkara_id: 5, amar_putusan: "lama" }]);
    const h = await B.periksaBaris(b, ctxServer([{ perkara_id: 5, amar_putusan: "lama" }]));
    expect(h.hasil).toBe("aman");
  });

  it("UPDATE: kolom yang akan diubah sudah berubah di server = BENTROK (tanpa jalan paksa)", async () => {
    const b = await antreanUpdate("UPDATE perkara_putusan SET amar_putusan = 'baru' WHERE perkara_id = 5", [{ perkara_id: 5, amar_putusan: "lama" }]);
    const h = await B.periksaBaris(b, ctxServer([{ perkara_id: 5, amar_putusan: "diubah panitera" }]));
    expect(h.hasil).toBe("bentrok");
    expect(h.alasan.join(" ")).toMatch(/amar_putusan.*berubah di server/);
  });

  it("UPDATE: kolom LAIN berubah di server = tetap aman, hanya dicatat", async () => {
    const b = await antreanUpdate("UPDATE perkara_putusan SET amar_putusan = 'baru' WHERE perkara_id = 5", [{ perkara_id: 5, amar_putusan: "lama", catatan: "x" }]);
    const h = await B.periksaBaris(b, ctxServer([{ perkara_id: 5, amar_putusan: "lama", catatan: "y" }]));
    expect(h.hasil).toBe("aman");
    expect(h.catatan.join(" ")).toMatch(/catatan/);
  });

  it("UPDATE: server sudah bernilai sama dengan nilai baru = aman (idempoten)", async () => {
    const b = await antreanUpdate("UPDATE perkara_putusan SET amar_putusan = 'baru' WHERE perkara_id = 5", [{ perkara_id: 5, amar_putusan: "lama" }]);
    const h = await B.periksaBaris(b, ctxServer([{ perkara_id: 5, amar_putusan: "baru" }]));
    expect(h.hasil).toBe("aman");
  });

  it("UPDATE: baris hilang / bertambah di server = bentrok", async () => {
    const b = await antreanUpdate("UPDATE perkara_putusan SET amar_putusan = 'baru' WHERE perkara_id = 5", [{ perkara_id: 5, amar_putusan: "lama" }]);
    expect((await B.periksaBaris(b, ctxServer([]))).hasil).toBe("bentrok");
    const dua = await B.periksaBaris(b, ctxServer([{ perkara_id: 5, amar_putusan: "lama" }, { perkara_id: 6, amar_putusan: "lama" }]));
    expect(dua.hasil).toBe("bentrok");
    expect(dua.alasan.join(" ")).toMatch(/Jumlah baris/);
  });

  it("DELETE: seluruh kolom dibandingkan", async () => {
    const b = await antreanUpdate("DELETE FROM perkara_proses WHERE perkara_id = 5", [{ perkara_id: 5, proses: "a" }]);
    expect((await B.periksaBaris(b, ctxServer([{ perkara_id: 5, proses: "a" }]))).hasil).toBe("aman");
    expect((await B.periksaBaris(b, ctxServer([{ perkara_id: 5, proses: "b" }]))).hasil).toBe("bentrok");
  });

  it("TANGGAL SUBSTANTIF: yang sudah terisi di server tidak diubah (ditahan), pengisian pertama boleh", async () => {
    const sql = "UPDATE perkara_putusan SET tanggal_putusan = '2026-10-19' WHERE perkara_id = 5";
    const kosong = await antreanUpdate(sql, [{ perkara_id: 5, tanggal_putusan: null }]);
    expect((await B.periksaBaris(kosong, ctxServer([{ perkara_id: 5, tanggal_putusan: null }]))).hasil).toBe("aman");
    // server diisi orang lain dengan tanggal lain sejak itu
    const terisi = await B.periksaBaris(kosong, ctxServer([{ perkara_id: 5, tanggal_putusan: new Date(2026, 9, 12) }]));
    expect(terisi.hasil).toBe("ditahan");
    expect(terisi.alasan.join(" ")).toMatch(/tidak boleh diubah/);
    // tanggal sama persis dengan yang diusulkan: bukan perubahan
    const sama = await antreanUpdate(sql, [{ perkara_id: 5, tanggal_putusan: new Date(2026, 9, 19) }]);
    expect((await B.periksaBaris(sama, ctxServer([{ perkara_id: 5, tanggal_putusan: new Date(2026, 9, 19) }]))).hasil).toBe("aman");
    // sidang, penetapan, minutasi sama kerasnya
    for (const kolom of ["tanggal_sidang", "tanggal_penetapan_majelis_hakim", "tanggal_minutasi"]) {
      expect(B.kolomSubstantif(kolom), kolom).toBe(true);
    }
    expect(B.kolomSubstantif("tanggal_pemberitahuan_putusan")).toBe(false);
  });

  it("INSERT: kunci unik yang sudah ada di server = bentrok; tidak ada = aman", async () => {
    const { pool } = buatKolam((s) => {
      if (/information_schema/.test(s)) return [{ nama: "PRIMARY", bukan_unik: 0, urut: 1, kolom: "id" }];
      return [];
    });
    penjaga.pasang(pool, "antrian");
    await tanya(pool, "INSERT INTO antrian_sidang (id, perkara_id) VALUES (?, ?)", [77, 5]);
    const [b] = await antrean.dapatkan().daftar({});
    expect(b.cuplikan.selectSql).toContain("`id` = '77'");
    expect((await B.periksaBaris(b, ctxServer([]))).hasil).toBe("aman");
    const ganda = await B.periksaBaris(b, ctxServer([{ id: 77 }]));
    expect(ganda.hasil).toBe("bentrok");
  });

  it("INSERT tanpa kunci unik yang dapat dirakit: aman dengan catatan 'tanpa pemeriksa duplikat'", async () => {
    const { pool } = buatKolam((s) => (/information_schema/.test(s) ? [{ nama: "PRIMARY", bukan_unik: 0, urut: 1, kolom: "id" }] : []));
    penjaga.pasang(pool, "sipp");
    await tanya(pool, "INSERT INTO sys_audittrail (user_name) VALUES ('x')");
    const [b] = await antrean.dapatkan().daftar({});
    const h = await B.periksaBaris(b, ctxServer([]));
    expect(h.hasil).toBe("aman");
    expect(h.catatan.join(" ")).toMatch(/Tanpa pemeriksa duplikat/);
  });

  it("DDL ditahan; pernyataan tak terbaca tak dapat diperiksa; cuplikan gagal tak dapat diperiksa", async () => {
    expect((await B.periksaBaris({ jenis: "DDL", sumber: "sipp", sql: "ALTER TABLE x" }, ctxServer([]))).hasil).toBe("ditahan");
    const tak = { jenis: "UPDATE", sumber: "sipp", sql: "UPDATE a JOIN b SET a.x=1", uraian: Q.uraiTulisan("UPDATE a JOIN b ON a.x=b.x SET a.y=1") };
    expect((await B.periksaBaris(tak, ctxServer([]))).hasil).toBe("tak_dapat_diperiksa");
    const b = await antreanUpdate("UPDATE perkara SET a = 1 WHERE perkara_id = 5", [{ perkara_id: 5, a: 0 }]);
    const rusak = { ...b, cuplikan: { status: "tak_terbaca", sebab: "kolam putus" } };
    expect((await B.periksaBaris(rusak, ctxServer([{ perkara_id: 5, a: 0 }]))).hasil).toBe("tak_dapat_diperiksa");
  });

  it("server tidak terjangkau = tak dapat diperiksa (bukan aman)", async () => {
    const b = await antreanUpdate("UPDATE perkara SET a = 1 WHERE perkara_id = 5", [{ perkara_id: 5, a: 0 }]);
    const ctx = {
      bacaServer: async () => {
        throw new Error("ECONNREFUSED");
      },
      kunciServer: async () => ({ utama: ["perkara_id"], unik: [], terbaca: true }),
    };
    const h = await B.periksaBaris(b, ctx);
    expect(h.hasil).toBe("tak_dapat_diperiksa");
    expect(h.alasan.join(" ")).toMatch(/Server tidak dapat dibaca/);
  });

  it("kata ALETA di pernyataan ditahan - tidak satu kata pun boleh masuk SIPP", async () => {
    const b = await antreanUpdate("UPDATE perkara SET keterangan = 'diinput lewat ALETA' WHERE perkara_id = 5", [{ perkara_id: 5, keterangan: "" }]);
    const ctx = { ...ctxServer([{ perkara_id: 5, keterangan: "" }]), mengandungAleta: bot("services/penjagaTandaSipp.js").tulisanBocor };
    const h = await B.periksaBaris(b, ctx);
    expect(h.hasil).toBe("ditahan");
    expect(h.alasan.join(" ")).toMatch(/ALETA/);
  });
});

// ─── C. persetujuan dan dorong ───────────────────────────────────────────────

/** Server tiruan: keadaan baris dapat diubah; semua SQL yang dikirim terekam per transaksi. */
function buatServer(keadaan: { rows: Baris[]; kunci?: Apa; affected?: number; insertId?: number; gagalKe?: number }) {
  const log: string[] = [];
  const berkas: string[] = [];
  let nomor = 0;
  const server = {
    async bacaServer() {
      return keadaan.rows;
    },
    async kunciServer() {
      return keadaan.kunci || { utama: ["perkara_id"], unik: [], terbaca: true };
    },
    async mulaiTransaksi(sumber: string) {
      log.push(`BEGIN ${sumber}`);
      return {
        async query(sql: string) {
          nomor += 1;
          if (keadaan.gagalKe === nomor) throw new Error("Duplicate entry");
          log.push(sql);
          return { affectedRows: keadaan.affected ?? 1, insertId: keadaan.insertId ?? 0 };
        },
        async komit() {
          log.push(`COMMIT ${sumber}`);
        },
        async batal() {
          log.push(`ROLLBACK ${sumber}`);
        },
        tutup() {},
      };
    },
    async periksaBerkas() {
      return { hasil: "aman", alasan: [], catatan: [] };
    },
    async kirimBerkas(b: Apa) {
      berkas.push(`KIRIM ${b.berkas.relatif}`);
      log.push(`BERKAS ${b.berkas.relatif}`);
    },
    async batalkanBerkas(b: Apa) {
      berkas.push(`BATAL ${b.berkas.relatif}`);
    },
    async pindahBerkas(b: Apa) {
      log.push(`PINDAH ${b.berkas.dariRelatif}`);
    },
    async batalkanPindah() {},
  };
  return { server, log, berkas };
}

async function siapkanTunda(opsi: { lama?: Baris[] } = {}) {
  // Satu permintaan "putus sidang": UPDATE utama + baris audit, aktor aslinya hakim.satu.
  const lama = opsi.lama ?? [{ perkara_id: 5, amar_putusan: "lama", tanggal_putusan: null }];
  const { pool } = buatKolam((s) => (/^SELECT \* FROM perkara_putusan/i.test(s) ? lama : /information_schema/.test(s) ? [{ nama: "PRIMARY", bukan_unik: 0, urut: 1, kolom: "perkara_id" }] : []));
  penjaga.pasang(pool, "sipp");
  await penjaga.denganKonteks({ operasi: "POST /putusan/tulis", aktor: "hakim.satu" }, async () => {
    await tanya(pool, "UPDATE perkara_putusan SET amar_putusan = ?, tanggal_putusan = ? WHERE perkara_id = ?", ["amar baru", "2026-10-19", 5]);
    await tanya(pool, "INSERT INTO sys_audittrail (user_name, aksi) VALUES (?, ?)", ["hakim.satu", "putus"]);
  });
}

describe("C - persetujuan dan dorong ke server", () => {
  it("setujui hanya baris yang sudah diperiksa dan aman; kelompok semua-atau-tidak", async () => {
    await siapkanTunda();
    const { server } = buatServer({ rows: [{ perkara_id: 5, amar_putusan: "lama", tanggal_putusan: null }] });
    const d = dorongModul.buatDorong({ penyimpan: antrean.dapatkan(), server });
    const [a, b] = await antrean.dapatkan().daftar({});
    // belum diperiksa -> ditolak
    expect((await d.setujui({ ids: [a.id], oleh: "Super Admin" })).disetujui).toBe(0);
    expect((await d.periksa({})).ringkas.aman).toBe(2);
    // tanpa nama penyetuju -> galat
    await expect(d.setujui({ ids: [a.id], oleh: "" })).rejects.toThrow();
    const r = await d.setujui({ kelompok: a.kelompok, oleh: "Super Admin" });
    expect(r.disetujui).toBe(2);
    const [a2, b2] = await antrean.dapatkan().ambil([a.id, b.id]);
    expect(a2.status).toBe("disetujui");
    expect(a2.disetujuiOleh).toBe("Super Admin");
    expect(b2.status).toBe("disetujui");
  });

  it("kirim: satu transaksi, SQL persis seperti dicatat (aktor & jam asli), berstatus terkirim", async () => {
    await siapkanTunda();
    const { server, log } = buatServer({ rows: [{ perkara_id: 5, amar_putusan: "lama", tanggal_putusan: null }] });
    const catat: Array<[string, Apa]> = [];
    const d = dorongModul.buatDorong({ penyimpan: antrean.dapatkan(), server, catat: (a: string, m: Apa) => catat.push([a, m]) });
    const dicatat = await antrean.dapatkan().daftar({});
    await d.periksa({});
    await d.setujui({ kelompok: dicatat[0].kelompok, oleh: "Super Admin" });
    const hasil = await d.kirim({ oleh: "Super Admin" });
    expect(hasil.terkirim).toBe(2);
    expect(log).toEqual([
      "BEGIN sipp",
      "UPDATE perkara_putusan SET amar_putusan = 'amar baru', tanggal_putusan = '2026-10-19' WHERE perkara_id = 5",
      "INSERT INTO sys_audittrail (user_name, aksi) VALUES ('hakim.satu', 'putus')",
      "COMMIT sipp",
    ]);
    const akhir = await antrean.dapatkan().daftar({});
    expect(akhir.every((b: Apa) => b.status === "terkirim")).toBe(true);
    expect(akhir[0].aktor).toBe("hakim.satu"); // aktor asli tetap tercatat
    expect(catat.map((c) => c[0])).toContain("kembaran_terkirim");
    expect(catat.find((c) => c[0] === "kembaran_terkirim")![1].aktorAsli).toEqual(["hakim.satu"]);
  });

  it("baris yang TIDAK disetujui tidak pernah dikirim", async () => {
    await siapkanTunda();
    const { server, log } = buatServer({ rows: [{ perkara_id: 5, amar_putusan: "lama", tanggal_putusan: null }] });
    const d = dorongModul.buatDorong({ penyimpan: antrean.dapatkan(), server });
    await d.periksa({});
    const hasil = await d.kirim({ oleh: "Super Admin" });
    expect(hasil.terkirim).toBe(0);
    expect(log).toEqual([]);
  });

  it("server berubah SESUDAH disetujui: diperiksa ulang saat kirim, tidak dikirim, persetujuan gugur", async () => {
    await siapkanTunda();
    const keadaan = { rows: [{ perkara_id: 5, amar_putusan: "lama", tanggal_putusan: null }] as Baris[] };
    const { server, log } = buatServer(keadaan);
    const d = dorongModul.buatDorong({ penyimpan: antrean.dapatkan(), server });
    const dicatat = await antrean.dapatkan().daftar({});
    await d.periksa({});
    await d.setujui({ kelompok: dicatat[0].kelompok, oleh: "Super Admin" });
    keadaan.rows = [{ perkara_id: 5, amar_putusan: "ditulis orang lain", tanggal_putusan: null }];
    const hasil = await d.kirim({ oleh: "Super Admin" });
    expect(hasil.terkirim).toBe(0);
    expect(hasil.dibatalkan).toBe(1);
    expect(log).toEqual([]);
    const akhir = await antrean.dapatkan().daftar({});
    expect(akhir.every((b: Apa) => b.status === "menunggu")).toBe(true);
    expect(akhir[0].hasil).toBe("bentrok");
    expect(akhir[0].disetujuiOleh).toBeFalsy();
  });

  it("bentrok tidak dapat disetujui; tanggal substantif terisi = ditahan", async () => {
    await siapkanTunda();
    const { server } = buatServer({ rows: [{ perkara_id: 5, amar_putusan: "lama", tanggal_putusan: new Date(2026, 9, 1) }] });
    const d = dorongModul.buatDorong({ penyimpan: antrean.dapatkan(), server });
    const dicatat = await antrean.dapatkan().daftar({});
    const ring = await d.periksa({});
    expect(ring.ringkas.ditahan).toBe(1);
    const r = await d.setujui({ ids: [dicatat[0].id], oleh: "Super Admin" });
    expect(r.disetujui).toBe(0);
    expect(r.ditolak[0].alasan).toMatch(/ditahan/);
  });

  it("jumlah baris yang terkena berbeda dari cuplikan: transaksi DIBATALKAN, berkas dibersihkan", async () => {
    await siapkanTunda();
    const { server, log } = buatServer({ rows: [{ perkara_id: 5, amar_putusan: "lama", tanggal_putusan: null }], affected: 2 });
    const d = dorongModul.buatDorong({ penyimpan: antrean.dapatkan(), server });
    const dicatat = await antrean.dapatkan().daftar({});
    await d.periksa({});
    await d.setujui({ kelompok: dicatat[0].kelompok, oleh: "Super Admin" });
    const hasil = await d.kirim({ oleh: "Super Admin" });
    expect(hasil.terkirim).toBe(0);
    expect(log).toContain("ROLLBACK sipp");
    expect(log).not.toContain("COMMIT sipp");
    const akhir = await antrean.dapatkan().daftar({});
    expect(akhir[0].status).toBe("gagal");
    expect(akhir[0].galat).toMatch(/seharusnya 1/);
    expect(akhir[1].status).toBe("menunggu");
  });

  it("insertId semu diganti nomor sungguhan pada baris anak di kelompok yang sama", async () => {
    const { pool } = buatKolam();
    penjaga.pasang(pool, "sipp");
    let semu = 0;
    await penjaga.denganKonteks({ operasi: "POST /x", aktor: "pp.satu" }, async () => {
      const r = await tanya(pool, "INSERT INTO perkara_penetapan (perkara_id, jenis) VALUES (5, 'PMH')");
      semu = r.insertId;
      await tanya(pool, "INSERT INTO perkara_penetapan_det (penetapan_id, isi) VALUES (?, 'x')", [semu]);
    });
    const { server, log } = buatServer({ rows: [], kunci: { utama: ["id"], unik: [], terbaca: true }, insertId: 4321 });
    const d = dorongModul.buatDorong({ penyimpan: antrean.dapatkan(), server });
    const dicatat = await antrean.dapatkan().daftar({});
    await d.periksa({});
    await d.setujui({ kelompok: dicatat[0].kelompok, oleh: "SA" });
    await d.kirim({ oleh: "SA" });
    expect(log.some((s) => s.includes("penetapan_det") && s.includes("(4321, 'x')"))).toBe(true);
    expect(log.join("\n")).not.toContain(String(semu));
  });

  it("berkas tiba lebih dulu dari barisnya dan dibatalkan bila baris gagal", async () => {
    const akar = path.join(folderKerja, "SIPP");
    const { pool } = buatKolam((s) => (/^SELECT \* FROM/i.test(s) ? [{ perkara_id: 5, edoc_bas: null }] : []));
    penjaga.pasang(pool, "sipp");
    await penjaga.denganKonteks({ operasi: "POST /bas/unggah", aktor: "pp.satu" }, async () => {
      await berkasModul.tulis(path.join(akar, "resources/file/doc/2026/10/bas.pdf"), Buffer.from("BAS"), { akar, flag: "wx" });
      await tanya(pool, "UPDATE perkara_jadwal_sidang SET edoc_bas = ? WHERE id = ? AND (edoc_bas IS NULL)", ["resources/file/doc/2026/10/bas.pdf", 9]);
    });
    const dicatat = await antrean.dapatkan().daftar({});
    expect(dicatat.map((b: Apa) => b.jenis)).toEqual(["BERKAS_TULIS", "UPDATE"]);

    const baik = buatServer({ rows: [{ perkara_id: 5, edoc_bas: null }], kunci: { utama: ["perkara_id"], unik: [], terbaca: true } });
    const d = dorongModul.buatDorong({ penyimpan: antrean.dapatkan(), server: baik.server });
    await d.periksa({});
    await d.setujui({ kelompok: dicatat[0].kelompok, oleh: "SA" });
    await d.kirim({ oleh: "SA" });
    expect(baik.log[0]).toBe("BERKAS resources/file/doc/2026/10/bas.pdf");
    expect(baik.log[1]).toBe("BEGIN sipp");
    expect(baik.log[2]).toMatch(/^UPDATE perkara_jadwal_sidang/);
  });

  it("tidak ada tombol paksa: baris bentrok tidak punya jalan kirim selain ditolak", async () => {
    await siapkanTunda();
    const { server } = buatServer({ rows: [] });
    const d = dorongModul.buatDorong({ penyimpan: antrean.dapatkan(), server });
    const dicatat = await antrean.dapatkan().daftar({});
    await d.periksa({});
    expect((await antrean.dapatkan().ambil([dicatat[0].id]))[0].hasil).toBe("bentrok");
    expect((await d.setujui({ ids: [dicatat[0].id], oleh: "SA" })).disetujui).toBe(0);
    expect(Object.keys(d)).not.toContain("paksa");
    const t = await d.tolak({ ids: [dicatat[0].id], oleh: "SA", alasan: "sudah diperbaiki manual" });
    expect(t.ditolak).toBe(1);
    expect((await antrean.dapatkan().ambil([dicatat[0].id]))[0].status).toBe("ditolak");
  });

  it("tujuan server yang sama dengan basis data laptop ditolak sebelum menyambung", () => {
    const env = {
      ALETA_BOT_DB_SIPP_HOST: "127.0.0.1",
      ALETA_BOT_DB_SIPP_PORT: "3306",
      ALETA_BOT_DB_SIPP_NAME: "sipp_donggala",
      ALETA_KEMBARAN_SERVER_DB_HOST: "localhost",
      ALETA_KEMBARAN_SERVER_DB_PORT: "3306",
      ALETA_KEMBARAN_SERVER_DB_USER: "root",
      ALETA_KEMBARAN_SERVER_DB_SIPP_NAME: "sipp_donggala",
    };
    expect(() => dorongModul.periksaTujuan("sipp", env)).toThrow(/sama dengan basis data laptop/);
    expect(() => dorongModul.periksaTujuan("sipp", { ...env, ALETA_KEMBARAN_SERVER_DB_PORT: "33306", ALETA_KEMBARAN_SERVER_DB_SIPP_NAME: "SIPP" })).not.toThrow();
    expect(() => dorongModul.periksaTujuan("sipp", { ...env, ALETA_KEMBARAN_SERVER_DB_USER: "" })).toThrow(/USER/);
  });

  it("jalur berkas di server dikunci: tanpa '..', tanpa garis miring awal", () => {
    expect(dorongModul.jalurServerAman("resources/file/doc/2026/10/a b.pdf")).toBe("resources/file/doc/2026/10/a b.pdf");
    expect(() => dorongModul.jalurServerAman("../etc/passwd")).toThrow();
    expect(() => dorongModul.jalurServerAman("/etc/passwd")).toThrow();
    expect(() => dorongModul.jalurServerAman("a/b;rm -rf x")).toThrow();
  });
});

// ─── D. WhatsApp dan e-Court mati ────────────────────────────────────────────

describe("D - WhatsApp dan e-Court dimatikan di mode kembaran", () => {
  it("konfigurasi tarikan yang menyalakan bot tidak dapat menyalakannya", () => {
    const { readRuntimeConfig } = bot("config/runtime-config.js");
    process.env.ALETA_MODE = "kembaran";
    const c = readRuntimeConfig();
    expect(c.botEnabled).toBe(false);
    expect(c.notificationsEnabled).toBe(false);
    expect(c.kirimPegawaiEnabled).toBe(false);
    expect(c.kirimPihakEnabled).toBe(false);
    expect(c.manualSendEnabled).toBe(false);
    expect(c.queueWorker.enabled).toBe(false);
  });

  it("tolakBilaKembaran melempar hanya di mode kembaran", () => {
    expect(() => mode.tolakBilaKembaran("WhatsApp")).toThrow(/dimatikan di mode kembaran/);
    process.env.ALETA_MODE = "";
    expect(() => mode.tolakBilaKembaran("WhatsApp")).not.toThrow();
  });

  it("setiap pintu WhatsApp dan e-Court menjaga mode kembaran", () => {
    const app = baca("aleta_bot/app.js");
    expect(app).toContain('kembaranMode.tolakBilaKembaran("WhatsApp")');
    expect(app).toMatch(/const startWhatsappClient = async[\s\S]{0,200}kembaranMode\.aktif\(\)/);
    expect(app).toMatch(/function jalankanPekerjaEcourt\(\) \{\s*\n\s*if \(kembaranMode\.aktif\(\)\) return;/);
    for (const b of ["ecourtPulihService", "ecourtVerifikasiHarianService", "ecourtSchedulerService", "ecourtSesiPantauService", "ecourtLoginService"]) {
      expect(baca(`aleta_bot/services/${b}.js`), b).toContain('require("./kembaranMode").aktif()');
    }
    expect(baca("aleta_bot/tools/ecourt-bridge/sesi.js")).toContain('tolakBilaKembaran("e-Court")');
  });

  it("pita: kalimat memakai waktu data dari cap tarik, bukan waktu tarik", () => {
    expect(mode.kalimatPita(null)).toBe("Mode kembaran - data belum pernah ditarik dari server");
    const kalimat = mode.kalimatPita({ tarikPada: "2026-10-19T00:30:00.000Z", bundelDibuat: "2026-10-17T18:00:00.000Z" });
    expect(kalimat).toBe("Mode kembaran - data per 18 Okt 2026 02.00 WITA");
    writeFileSync(path.join(folderKerja, "tarik.json"), JSON.stringify({ tarikPada: "2026-10-19T00:30:00.000Z", bundelDibuat: "2026-10-17T18:00:00.000Z" }));
    expect(mode.bacaCapTarik().tarikPada).toBe("2026-10-19T00:30:00.000Z");
    expect(mode.ringkasan().pita).toContain("data per 18 Okt 2026");
  });
});

// ─── E. skrip tarik ──────────────────────────────────────────────────────────

describe("E - skrip tarik", () => {
  // Jalur relatif dari variabel: vite-node memuatnya tanpa mengenali tipe .mjs (tsc tidak ikut menuntut berkas d.mts).
  const jalurTarik = "../../../scripts/kembaran/tarik.mjs";
  const jalurAlat = "../../../tools/sinkron-laptop/sinkron-laptop.mjs";
  const muatTarik = () => import(/* @vite-ignore */ jalurTarik) as Promise<Apa>;
  const muatAlat = () => import(/* @vite-ignore */ jalurAlat) as Promise<Apa>;

  it("menolak tujuan sipp (PA Bungku), drive C:, dan antrean yang sama dengan aleta_bot", async () => {
    const t = await muatTarik();
    expect(() => t.periksaKonfigurasiKembaran({ tujuan: { sipp: "SIPP" } })).toThrow(/DITOLAK/);
    expect(() => t.periksaKonfigurasiKembaran({ folderSimpan: "C:/sinkron" })).toThrow(/drive D:/);
    expect(() => t.periksaKonfigurasiKembaran({ folderKembaran: "C:/kembaran" })).toThrow(/drive D:/);
    expect(() => t.periksaKonfigurasiKembaran({ antrean: { basisData: "aleta_bot" } })).toThrow(/tidak boleh sama dengan aleta_bot/);
    expect(() => t.periksaKonfigurasiKembaran({ tujuan: { abt: "drop;table" } })).toThrow(/tidak sah/);
    expect(() => t.periksaKonfigurasiKembaran({})).not.toThrow();
  });

  it("konfigurasi turunannya lolos penjaga alat sinkron-laptop: cara ssh, semua pemulihan menyala, sipp -> sipp_donggala", async () => {
    const t = await muatTarik();
    const alat = await muatAlat();
    const k = t.periksaKonfigurasiKembaran({});
    const sinkron = alat.periksaKonfigurasi(t.susunKonfigurasiSinkron(k, { pulihkan: true }));
    expect(sinkron.cara).toBe("ssh");
    expect(sinkron.ssh.alias).toBe("aleta");
    for (const sumber of ["aleta", "sipp", "abt", "antrian", "aleta_bot"]) expect(sinkron.pulihkan[sumber].aktif, sumber).toBe(true);
    expect(sinkron.pulihkan.sipp.basisData).toBe("sipp_donggala");
    const unduhSaja = t.susunKonfigurasiSinkron(k, { pulihkan: false });
    expect(Object.values(unduhSaja.pulihkan).filter((v: Apa) => v && v.aktif)).toHaveLength(0);
    // Tujuan terlarang tetap dicegat alatnya sendiri (lapis kedua).
    expect(() => alat.periksaKonfigurasi({ ...t.susunKonfigurasiSinkron(k), pulihkan: { ...sinkron.pulihkan, sipp: { aktif: true, basisData: "sipp" } } })).toThrow(/DITOLAK/);
  });

  it("cap tarik dari manifest bundel terbaru; waktu data = waktu bundel dibuat", async () => {
    const t = await muatTarik();
    const simpan = path.join(folderKerja, "sinkron");
    for (const [nama, dibuat] of [
      ["20261016-020000", "2026-10-15T18:00:00.000Z"],
      ["20261017-020000", "2026-10-16T18:00:00.000Z"],
    ]) {
      mkdirSync(path.join(simpan, "arsip", nama), { recursive: true });
      writeFileSync(path.join(simpan, "arsip", nama, "MANIFEST.json"), JSON.stringify({ bundel: nama, dibuat, versiAplikasi: "1.205.2", berkas: [{ sumber: "sipp" }, { sumber: "aleta" }] }));
    }
    const k = t.periksaKonfigurasiKembaran({ folderSimpan: simpan.split("\\").join("/"), folderKembaran: folderKerja.split("\\").join("/") });
    const cap = await t.susunCapTarik(k, new Date("2026-10-19T00:30:00.000Z"));
    expect(cap.bundel).toBe("20261017-020000");
    expect(cap.bundelDibuat).toBe("2026-10-16T18:00:00.000Z");
    expect(cap.tarikPada).toBe("2026-10-19T00:30:00.000Z");
    expect(cap.sumber).toEqual(["sipp", "aleta"]);
    expect(mode.kalimatPita(cap)).toBe("Mode kembaran - data per 17 Okt 2026 02.00 WITA");
  });

  it("port yang tidak didengarkan dilaporkan bebas", async () => {
    const t = await muatTarik();
    expect(await t.portTerpakai(1, "127.0.0.1", 300)).toBe(false);
  });

  it("tarik.mjs memeriksa antrean dan proses hidup SEBELUM memulihkan, dan mencadangkan antrean", () => {
    const kode = baca("scripts/kembaran/tarik.mjs");
    const iAntrean = kode.indexOf("hitungAntreanBelumSelesai(k)");
    const iAlat = kode.indexOf("jalankanAlat(jalurSinkron, hanyaUnduh");
    expect(iAntrean).toBeGreaterThan(0);
    expect(iAntrean).toBeLessThan(iAlat);
    expect(kode.indexOf("portTerpakai(k.portBot)")).toBeLessThan(iAlat);
    expect(kode.indexOf("cadangkanAntrean(k)")).toBeLessThan(iAlat);
    expect(kode).toContain("status IN ('menunggu','disetujui','gagal')");
  });
});

// ─── F. portal ───────────────────────────────────────────────────────────────

describe("F - portal: pita dan layar Sinkron kembaran", () => {
  it("modeKembaran dan kalimat pita sama dengan sisi bot", () => {
    expect(modeKembaran({ ALETA_MODE: "kembaran" })).toBe(true);
    expect(modeKembaran({ ALETA_MODE: "Kembaran " })).toBe(true);
    expect(modeKembaran({})).toBe(false);
    for (const cap of [null, { tarikPada: "2026-10-19T00:30:00.000Z", bundelDibuat: "2026-10-17T18:00:00.000Z" }, { tarikPada: "2026-10-19T00:30:00.000Z" }]) {
      expect(kalimatPita(cap)).toBe(mode.kalimatPita(cap));
    }
  });

  it("aksi diteruskan ke rute bot yang benar dengan nama Super Admin; ids dibersihkan; tanpa aksi paksa", () => {
    expect(susunPanggilanAksi("kirim", {}, "Super Satu")).toMatchObject({ jalur: "/kirim", method: "POST", body: { oleh: "Super Satu" } });
    expect(susunPanggilanAksi("setujui", { ids: [3, "x", -1, 7], kelompok: "K1" }, "SA").body).toEqual({ ids: [3, 7], kelompok: "K1", oleh: "SA" });
    expect((susunPanggilanAksi("tolak", { alasan: "x".repeat(500) }, "SA").body as Apa).alasan).toHaveLength(300);
    expect(susunPanggilanAksi("periksa", { ids: [] }, "SA").jalur).toBe("/periksa");
    expect(susunPanggilanAksi("uji", {}, "SA").method).toBe("GET");
  });

  it("rute, halaman, pita, dan menu: Super Admin saja, hanya di mode kembaran, audit tercatat", () => {
    const aksi = baca("manajemen_surat/src/app/api/admin/sinkron-kembaran/aksi/route.ts");
    expect(aksi).toContain("pastikanAdminSinkron(db, actorUserId, true)");
    expect(aksi).toContain("if (!modeKembaran())");
    expect(aksi).toContain("SINKRON_KEMBARAN_${aksi.toUpperCase()}");
    expect(aksi).toContain('const AKSI: AksiKembaran[] = ["uji", "periksa", "setujui", "tolak", "kirim"];');
    const daftar = baca("manajemen_surat/src/app/api/admin/sinkron-kembaran/route.ts");
    expect(daftar).toContain("pastikanAdminSinkron(db, actorUserId, true)");
    const halaman = baca("manajemen_surat/src/app/(portal)/admin/sinkron-kembaran/page.tsx");
    expect(halaman).toContain('effectiveRoleId !== "super-admin"');
    expect(baca("manajemen_surat/src/app/(portal)/layout.tsx")).toContain("<PitaKembaran />");
    expect(baca("manajemen_surat/src/components/portal/pita-kembaran.tsx")).toContain("if (!modeKembaran()) return null;");
    expect(baca("manajemen_surat/src/components/portal/admin-hub.tsx")).toMatch(/isSuperAdmin && \(\s*<AdminMenuAction\s+href="\/admin\/sinkron-kembaran"/);
  });

  it("rute bot: semua tindakan ubah menolak di luar mode kembaran; tidak ada rute paksa", () => {
    const rute = baca("aleta_bot/routes/kembaranRoutes.js");
    for (const jalur of ["/antrean", "/uji", "/periksa", "/setujui", "/tolak", "/kirim"]) {
      expect(rute, jalur).toMatch(new RegExp(`router\\.(get|post)\\("${jalur}", wajibToken, wajibKembaran`));
    }
    expect(rute).not.toMatch(/paksa|force/i);
    expect(baca("aleta_bot/app.js")).toContain('app.use("/internal/aleta-bot/kembaran", require("./routes/kembaranRoutes"));');
  });
});
