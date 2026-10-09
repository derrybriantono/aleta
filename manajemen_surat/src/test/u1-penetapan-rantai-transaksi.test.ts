// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * SISA PENETAPAN SATU PERKARA: UTUH ATAU BATAL (uji rilis U1, 9 Okt 2026)
 * ============================================================================
 *
 * Temuan U4: penulisan PMH/PPP/PJS/PHS (per perkara, massal, tahap sisa
 * 1.188.0) berlangkah banyak TANPA transaksi - gagal di tengah meninggalkan
 * perkara separuh tertulis, dan menekan ulang ditolak "<jenis>_sudah_ada"
 * (cacat yang sama dengan tunda 273). tulisRantaiUtuh menulis seluruh langkah
 * sisa dalam SATU sambungan/transaksi; rencana tiap langkah disusun di dalam
 * transaksi itu sehingga PPP/PJS/PHS melihat PMH yang belum di-COMMIT.
 *
 * Dijaga dengan MENJALANKAN penetapanTulisService atas SIPP tiruan yang
 * benar-benar bertransaksi: tulisan sebuah sambungan baru terlihat di luar
 * sesudah COMMIT, dan ROLLBACK membuangnya. Bentuk tiruan mengikuti
 * penetapan-audit-petugas.test.ts.
 */

const AKAR = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(AKAR, "aleta_bot/package.json"));

type Baris = Record<string, unknown>;
type Tulisan = { sql: string; params: unknown[] };
type Keadaan = { pmh: string | null; ppp: string | null; pjs: string | null; phs: string | null; adaPenetapan: number; adaSmartMajelis: number };

const PENGGUNA = [{ userid: 11, username: "derry briantono", fullname: "Derry Briantono, S.H.", block: 0 }];
const HAKIM: Record<number, Baris> = {
  32: { hakimId: 32, kode: "A", nip: "198208312007041001", nama: "Fahri Saifuddin, S.H.I., M.H.", namaPolos: "Fahri Saifuddin" },
  26: { hakimId: 26, kode: "C1", nip: "197806052005021002", nama: "Himawan Tatura Wijaya, S.H.I.,M.H.", namaPolos: "Himawan Tatura Wijaya" },
  31: { hakimId: 31, kode: "C3", nip: "199401022017121003", nama: "Derry Briantono, S.H.", namaPolos: "Derry Briantono" },
};

function sippBertransaksi(awal: Partial<Keadaan> = {}) {
  const tetap: Keadaan = { pmh: null, ppp: null, pjs: null, phs: null, adaPenetapan: 0, adaSmartMajelis: 0, ...awal };
  const terkomit: Tulisan[] = [];
  const perintah: string[] = [];
  const kunci = { gagalPada: "" as string }; // pola SQL yang dibuat gagal
  const idBerikutnya: Record<string, number> = {
    perkara_hakim_pn: 29317,
    perkara_panitera_pn: 10576,
    perkara_jurusita: 10359,
    perkara_jadwal_sidang: 20322,
    perkara_penetapan_hari_sidang: 23722,
  };

  const jawab = (keadaan: Keadaan, tulisan: Tulisan[], sql: string, p: unknown[]): unknown => {
    const max = /COALESCE\(MAX\(id\), 0\) \+ 1 AS berikutnya FROM (\w+)/.exec(sql);
    if (max) return [{ berikutnya: idBerikutnya[max[1]] || 1 }];
    if (/COALESCE\(MAX\(urutan\), 0\) \+ 1/.test(sql)) return [{ berikutnya: 1 }];
    if (/DATE_FORMAT\(NOW\(\)/.test(sql)) return [{ saat: "2026-10-09 09:02:11" }];
    if (/FROM perkara p\b/.test(sql)) {
      return [{ perkaraId: 10222, nomorPerkara: "653/Pdt.G/2026/PA.Dgl", jenisPerkaraId: 347, tanggalDaftar: "2026-10-09", didaftar: "2026-10-09 08:40:00", ...keadaan }];
    }
    if (/FROM sys_user_online/.test(sql)) return [];
    if (/FROM sys_users WHERE username = \?/.test(sql)) return PENGGUNA.filter((u) => u.username === String(p[0]));
    if (/FROM sys_users WHERE TRIM\(fullname\) = \?/.test(sql)) return PENGGUNA.filter((u) => u.fullname === String(p[0]));
    if (/FROM hakim_pn/.test(sql)) return p.map((x) => HAKIM[Number(x)]).filter(Boolean);
    if (/FROM panitera_pn/.test(sql)) return [{ id: 21, kode: "D", nip: "198906242011012009", namaGelar: "Andini Puspita Sari, S.Sy.", nama: "Andini Puspita Sari" }];
    if (/FROM jurusita/.test(sql)) return [{ id: 28, kode: "", nip: "198409012006042002", namaGelar: "Tanty Restianty, A.Md.", nama: "Tanty Restianty" }];
    if (/FROM ruangan_sidang/.test(sql)) return [{ id: 3, nama: "Ruang Sidang Utama", keliling: "0" }];
    if (/FROM ref_majelis_tetap/.test(sql)) return [{ majelisId: 35, kompetensiId: 22, skId: 3, hakim: "26,32,31" }];
    if (/^\s*(INSERT|UPDATE|REPLACE|DELETE)/i.test(sql)) {
      if (kunci.gagalPada && new RegExp(kunci.gagalPada).test(sql)) {
        const g = new Error("Lock wait timeout exceeded; try restarting transaction") as Error & { code: string };
        g.code = "ER_LOCK_WAIT_TIMEOUT";
        throw g;
      }
      tulisan.push({ sql: sql.replace(/\s+/g, " ").trim(), params: [...p] });
      const ke = /^\s*INSERT INTO (\w+)/i.exec(sql);
      if (ke && idBerikutnya[ke[1]] !== undefined) idBerikutnya[ke[1]] += 1;
      // Keadaan perkara_penetapan menurut tulisan (dilihat sambungan ini saja
      // sampai COMMIT).
      if (/^\s*INSERT INTO perkara_penetapan\b/i.test(sql)) Object.assign(keadaan, { pmh: "2026-10-09", adaPenetapan: 10222, adaSmartMajelis: 10222 });
      if (/^\s*UPDATE perkara_penetapan\b/i.test(sql) && /penetapan_panitera_pengganti\s*=/.test(sql)) keadaan.ppp = "2026-10-09";
      if (/^\s*UPDATE perkara_penetapan\b/i.test(sql) && /penetapan_jurusita\s*=/.test(sql)) keadaan.pjs = "2026-10-09";
      if (/^\s*UPDATE perkara_penetapan\b/i.test(sql) && /penetapan_hari_sidang\s*=/.test(sql)) keadaan.phs = "2026-10-09";
      return { affectedRows: 1, insertId: 0 };
    }
    return [];
  };

  const db = {
    // Kolam: hanya yang sudah di-COMMIT.
    query(sql: string, params: unknown, selesai: (g: unknown, h: unknown) => void) {
      try {
        selesai(null, jawab({ ...tetap }, [], String(sql), Array.isArray(params) ? params : []));
      } catch (g) {
        selesai(g, null);
      }
    },
    getConnection(selesai: (g: unknown, s: unknown) => void) {
      let lokal: Keadaan = { ...tetap };
      let tertunda: Tulisan[] = [];
      let dalamTransaksi = false;
      const sambungan = {
        dilepas: false,
        query(sql: string, params: unknown, cb: (g: unknown, h: unknown) => void) {
          const s = String(sql).trim();
          if (/^START TRANSACTION$/i.test(s)) {
            perintah.push("START");
            dalamTransaksi = true;
            lokal = { ...tetap };
            tertunda = [];
            return cb(null, {});
          }
          if (/^COMMIT$/i.test(s)) {
            perintah.push("COMMIT");
            Object.assign(tetap, lokal);
            terkomit.push(...tertunda);
            tertunda = [];
            dalamTransaksi = false;
            return cb(null, {});
          }
          if (/^ROLLBACK$/i.test(s)) {
            perintah.push("ROLLBACK");
            tertunda = [];
            lokal = { ...tetap };
            dalamTransaksi = false;
            return cb(null, {});
          }
          try {
            const hasil = jawab(lokal, tertunda, String(sql), Array.isArray(params) ? params : []);
            if (!dalamTransaksi) {
              terkomit.push(...tertunda);
              tertunda = [];
              Object.assign(tetap, lokal);
            }
            cb(null, hasil);
          } catch (g) {
            cb(g, null);
          }
        },
        release() {
          sambungan.dilepas = true;
          perintah.push("RELEASE");
        },
      };
      selesai(null, sambungan);
    },
  };
  return { db, tetap, terkomit, perintah, kunci };
}

type Layanan = {
  tulisRantaiUtuh: (m: Record<string, unknown>, alat?: Record<string, unknown>) => Promise<Record<string, any>>;
};

function muatLayanan(db: unknown): Layanan {
  const pasang = (berkas: string, exports: unknown) => {
    const jalur = require_.resolve(path.join(AKAR, "aleta_bot", berkas));
    require_.cache[jalur] = { id: jalur, filename: jalur, loaded: true, exports } as unknown as NodeJS.Module;
  };
  pasang("db_config.js", db);
  const jalurSkema = require_.resolve(path.join(AKAR, "aleta_bot/services/sippSkemaService.js"));
  delete require_.cache[jalurSkema];
  const skema = require_(jalurSkema) as Record<string, unknown>;
  pasang("services/sippSkemaService.js", { ...skema, tabelAda: async () => true });
  const jalur = require_.resolve(path.join(AKAR, "aleta_bot/services/penetapanTulisService.js"));
  delete require_.cache[jalur];
  return require_(jalur) as Layanan;
}

const LANGKAH: Record<string, Record<string, unknown>> = {
  pmh: { jenis: "pmh", hakimId: [26, 32, 31] },
  ppp: { jenis: "ppp", petugasId: 21 },
  pjs: { jenis: "pjs", petugasId: 28 },
  phs: { jenis: "phs", tanggalSidang: "2026-10-21", ruanganId: 3 },
};

function minta(jenis: string[], tanggal = "2026-10-09") {
  return {
    perkaraId: 10222,
    tanggalPenetapan: tanggal,
    olehUsername: "Derry Briantono, S.H.",
    operator: "SUPER ADMIN DERRY",
    ip: "192.168.9.109",
    langkah: jenis.map((j) => LANGKAH[j]),
  };
}

const tabelDi = (t: Tulisan[]) => [...new Set(t.map((x) => (/^(?:INSERT INTO|UPDATE) (\w+)/i.exec(x.sql) || [])[1]).filter(Boolean))];

describe("tulisRantaiUtuh: satu sambungan, satu transaksi per perkara", () => {
  it("perkara kosong: keempatnya tertulis dalam SATU transaksi lalu COMMIT; jeda per langkah", async () => {
    const sipp = sippBertransaksi();
    const layanan = muatLayanan(sipp.db);
    const jeda: string[] = [];
    const r = await layanan.tulisRantaiUtuh(minta(["pmh", "ppp", "pjs", "phs"]), { jeda: async (j: string) => void jeda.push(j) });
    expect(r.ok, JSON.stringify(r).slice(0, 400)).toBe(true);
    expect(r.hasil.map((x: any) => [x.jenis, x.ok])).toEqual([["pmh", true], ["ppp", true], ["pjs", true], ["phs", true]]);
    expect(sipp.perintah).toEqual(["START", "COMMIT", "RELEASE"]);
    expect(sipp.tetap).toMatchObject({ pmh: "2026-10-09", ppp: "2026-10-09", pjs: "2026-10-09", phs: "2026-10-09" });
    expect(tabelDi(sipp.terkomit)).toEqual(expect.arrayContaining(["perkara_penetapan", "perkara_hakim_pn", "perkara_panitera_pn", "perkara_jurusita", "perkara_jadwal_sidang", "sys_audittrail"]));
    expect(jeda).toEqual(["simpan", "pindah", "simpan", "pindah", "simpan", "pindah", "simpan"]);
  });

  it("gagal di tengah (PJS): ROLLBACK, NOL baris tertulis, dan perkaranya dapat diulang utuh", async () => {
    const sipp = sippBertransaksi();
    const layanan = muatLayanan(sipp.db);
    sipp.kunci.gagalPada = "^\\s*INSERT INTO perkara_jurusita";
    const r = await layanan.tulisRantaiUtuh(minta(["pmh", "ppp", "pjs", "phs"]), { jeda: async () => undefined });
    expect(r.ok).toBe(false);
    expect(r.jenis).toBe("pjs");
    expect(r.dipulihkan).toBe(true);
    expect(sipp.perintah).toEqual(["START", "ROLLBACK", "RELEASE"]);
    expect(sipp.terkomit).toEqual([]);
    expect(sipp.tetap).toMatchObject({ pmh: null, ppp: null, pjs: null, phs: null });
    // PMH dan PPP yang sempat dijalankan di dalam transaksi ikut dibatalkan.
    expect(r.hasil.filter((x: any) => x.ok).map((x: any) => x.jenis)).toEqual(["pmh", "ppp"]);

    // Diulang sesudah sebabnya hilang: tidak ditolak "_sudah_ada", tertulis utuh.
    sipp.kunci.gagalPada = "";
    const ulang = await layanan.tulisRantaiUtuh(minta(["pmh", "ppp", "pjs", "phs"]), { jeda: async () => undefined });
    expect(ulang.ok, JSON.stringify(ulang).slice(0, 400)).toBe(true);
    expect(sipp.tetap).toMatchObject({ pmh: "2026-10-09", ppp: "2026-10-09", pjs: "2026-10-09", phs: "2026-10-09" });
  });

  it("gagal di langkah TERAKHIR (PHS, baris audit): PMH/PPP/PJS pun tidak tertinggal", async () => {
    const sipp = sippBertransaksi();
    const layanan = muatLayanan(sipp.db);
    sipp.kunci.gagalPada = "^\\s*INSERT INTO perkara_penetapan_hari_sidang";
    const r = await layanan.tulisRantaiUtuh(minta(["pmh", "ppp", "pjs", "phs"]), { jeda: async () => undefined });
    expect(r).toMatchObject({ ok: false, jenis: "phs", dipulihkan: true });
    expect(sipp.terkomit).toEqual([]);
  });

  it("tahap sisa (PMH tangan): hanya PPP, PJS, PHS - dan tetap satu transaksi", async () => {
    const sipp = sippBertransaksi({ pmh: "2026-10-09", adaPenetapan: 10222, adaSmartMajelis: 10222 });
    const layanan = muatLayanan(sipp.db);
    const r = await layanan.tulisRantaiUtuh(minta(["ppp", "pjs", "phs"]), { jeda: async () => undefined });
    expect(r.ok, JSON.stringify(r).slice(0, 400)).toBe(true);
    expect(sipp.perintah).toEqual(["START", "COMMIT", "RELEASE"]);
    expect(sipp.terkomit.some((t) => /^INSERT INTO perkara_hakim_pn/.test(t.sql))).toBe(false);
  });

  it("langkah yang ternyata sudah ada (panel basi) dilewati, bukan menggagalkan", async () => {
    const sipp = sippBertransaksi({ pmh: "2026-10-09", adaPenetapan: 10222, adaSmartMajelis: 10222 });
    const layanan = muatLayanan(sipp.db);
    const r = await layanan.tulisRantaiUtuh(minta(["pmh", "ppp", "pjs", "phs"]), { jeda: async () => undefined });
    expect(r.ok, JSON.stringify(r).slice(0, 400)).toBe(true);
    expect(r.hasil[0]).toMatchObject({ jenis: "pmh", sudahAda: true });
  });

  it("rantai yang tidak berurutan / kosong ditolak tanpa membuka sambungan", async () => {
    const sipp = sippBertransaksi();
    const layanan = muatLayanan(sipp.db);
    expect(await layanan.tulisRantaiUtuh(minta(["ppp", "pmh"]))).toMatchObject({ ok: false, alasan: "rantai_tidak_berurutan" });
    expect(await layanan.tulisRantaiUtuh(minta([]))).toMatchObject({ ok: false, alasan: "rantai_kosong" });
    expect(sipp.perintah).toEqual([]);
  });

  it("di luar rantai, kueri tetap lewat kolam biasa (perilaku lama utuh)", async () => {
    const sipp = sippBertransaksi();
    const layanan = muatLayanan(sipp.db) as unknown as { susunRencanaTulis: (m: Record<string, unknown>) => Promise<Record<string, any>> };
    const rencana = await layanan.susunRencanaTulis({ ...minta(["pmh"]), ...LANGKAH.pmh, kering: true });
    expect(rencana.ok).toBe(true);
    expect(sipp.perintah).toEqual([]);
  });
});
