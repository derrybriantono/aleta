// @vitest-environment node
/**
 * ============================================================================
 * PENETAPAN KEMBALI DALAM SATU TRANSAKSI - UJI RILIS 9 OKT 2026 (U4)
 * ============================================================================
 *
 * Penetapan kembali (Jadwal Sidang -> Penetapan kembali) menonaktifkan
 * majelis/PP/JS lama (UPDATE ... aktif='T') lalu menyisipkan yang baru. Sampai
 * 1.188.0 langkahnya ditulis lepas-lepas lewat kolam sambungan: INSERT yang
 * gagal sesudah UPDATE meninggalkan perkara TANPA majelis aktif sama sekali.
 *
 * Kini rute bot menjalankannya lewat sidangHasilService.jalankanRencanaUtuh
 * (pola kasus 273): satu sambungan, START TRANSACTION .. COMMIT, gagal =
 * ROLLBACK. Basis data SIPP ditiru dengan transaksi sungguhan (salin-pulih).
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { kalimatTolakKembali } from "@/lib/penetapan-kembali";

const require_ = createRequire(import.meta.url);
const AKAR_BOT = path.resolve(process.cwd(), "../aleta_bot");

type Hakim = { id: number; perkara_id: number; hakim_id: number; aktif: string };
let hakim: Hakim[];
let audit: number;
let gagalPada: RegExp | null;

function jawab(sqlMentah: string, p: unknown[]): unknown {
  const sql = sqlMentah.replace(/\s+/g, " ").trim();
  if (gagalPada && gagalPada.test(sql)) {
    const g = new Error("ER_DUP_ENTRY: Duplicate entry for key 'PRIMARY'") as Error & { code?: string };
    g.code = "ER_LOCK_WAIT_TIMEOUT";
    throw g;
  }
  if (/COALESCE\(MAX\(id\), 0\) \+ 1 AS berikutnya FROM perkara_hakim_pn/.test(sql)) {
    return [{ berikutnya: Math.max(0, ...hakim.map((h) => h.id)) + 1 }];
  }
  if (/^UPDATE perkara_hakim_pn SET aktif = 'T'/.test(sql)) {
    hakim.filter((h) => h.perkara_id === p[0]).forEach((h) => (h.aktif = "T"));
    return { affectedRows: 3 };
  }
  if (/^INSERT INTO perkara_hakim_pn/.test(sql)) {
    hakim.push({ id: Number(p[0]), perkara_id: Number(p[1]), hakim_id: Number(p[2]), aktif: "Y" });
    return { affectedRows: 1 };
  }
  if (/^INSERT INTO sys_audittrail/.test(sql)) {
    audit += 1;
    return { affectedRows: 1, insertId: audit };
  }
  throw new Error(`tiruan tidak mengenal: ${sql.slice(0, 80)}`);
}

const db = {
  query(sql: string, params: unknown, cb: (g: unknown, r?: unknown) => void) {
    const selesai = typeof params === "function" ? (params as typeof cb) : cb;
    setImmediate(() => {
      try {
        selesai(null, jawab(String(sql), Array.isArray(params) ? params : []));
      } catch (g) {
        selesai(g);
      }
    });
  },
  getConnection(cb: (g: unknown, s?: unknown) => void) {
    let cadangan: { hakim: Hakim[]; audit: number } | null = null;
    const sambungan = {
      query(sql: string, params: unknown, cb2?: (g: unknown, r?: unknown) => void) {
        const selesai = (typeof params === "function" ? params : cb2) as (g: unknown, r?: unknown) => void;
        setImmediate(() => {
          const t = String(sql).trim().toUpperCase();
          try {
            if (t === "START TRANSACTION") {
              cadangan = { hakim: hakim.map((h) => ({ ...h })), audit };
              return selesai(null, {});
            }
            if (t === "COMMIT") {
              cadangan = null;
              return selesai(null, {});
            }
            if (t === "ROLLBACK") {
              if (cadangan) ({ hakim, audit } = cadangan);
              cadangan = null;
              return selesai(null, {});
            }
            selesai(null, jawab(String(sql), Array.isArray(params) ? params : []));
          } catch (g) {
            selesai(g);
          }
        });
      },
      release() {},
    };
    setImmediate(() => cb(null, sambungan));
  },
};

type Layanan = { jalankanRencanaUtuh: (r: unknown, o: { kering: boolean }) => Promise<Record<string, unknown>> };
let layanan: Layanan;

beforeAll(() => {
  for (const k of Object.keys(require_.cache)) {
    if (k.startsWith(AKAR_BOT) && !k.includes("node_modules")) delete require_.cache[k];
  }
  const jalurDb = require_.resolve(path.join(AKAR_BOT, "db_config.js"));
  require_.cache[jalurDb] = { id: jalurDb, filename: jalurDb, loaded: true, exports: db } as unknown as NodeJS.Module;
  layanan = require_(path.join(AKAR_BOT, "services/sidangHasilService.js")) as Layanan;
});

beforeEach(() => {
  hakim = [
    { id: 100, perkara_id: 9988, hakim_id: 32, aktif: "Y" },
    { id: 101, perkara_id: 9988, hakim_id: 26, aktif: "Y" },
    { id: 102, perkara_id: 9988, hakim_id: 31, aktif: "Y" },
  ];
  audit = 0;
  gagalPada = null;
});

/** Bentuk langkah PMH kembali (penetapanKembaliService): nonaktifkan lama, audit, sisipkan baru. */
const rencanaPmhKembali = {
  ok: true,
  langkah: [
    { tabel: "perkara_hakim_pn", aksi: "UPDATE", sql: "UPDATE perkara_hakim_pn SET aktif = 'T' WHERE perkara_id = ?", params: [9988], keterangan: "nonaktifkan majelis lama" },
    { tabel: "sys_audittrail", aksi: "INSERT", sql: "INSERT INTO sys_audittrail (datetime) VALUES (?)", params: ["2026-10-09 10:00:00"], keterangan: "audit" },
    { tabel: "perkara_hakim_pn", aksi: "INSERT", sql: "INSERT INTO perkara_hakim_pn (id, perkara_id, hakim_id) VALUES (?,?,?)", params: [0, 9988, 33], idDihitung: { tabel: "perkara_hakim_pn", posisiParam: 0 }, keterangan: "majelis baru 33" },
    { tabel: "perkara_hakim_pn", aksi: "INSERT", sql: "INSERT INTO perkara_hakim_pn (id, perkara_id, hakim_id) VALUES (?,?,?)", params: [0, 9988, 26], idDihitung: { tabel: "perkara_hakim_pn", posisiParam: 0 }, keterangan: "majelis baru 26" },
  ],
};

const aktif = () => hakim.filter((h) => h.perkara_id === 9988 && h.aktif === "Y").map((h) => h.hakim_id);

describe("penetapan kembali = satu transaksi", () => {
  it("berhasil: majelis lama nonaktif, majelis baru aktif", async () => {
    const hasil = await layanan.jalankanRencanaUtuh(rencanaPmhKembali, { kering: false });
    expect(hasil.ok, JSON.stringify(hasil)).toBe(true);
    expect(aktif()).toEqual([33, 26]);
  });

  it("INSERT majelis baru gagal SESUDAH majelis lama dinonaktifkan: dibatalkan utuh - perkara tidak pernah tanpa majelis aktif", async () => {
    gagalPada = /^INSERT INTO perkara_hakim_pn .*/;
    const hasil = await layanan.jalankanRencanaUtuh(rencanaPmhKembali, { kering: false });
    expect(hasil.ok).toBe(false);
    expect(hasil.alasan).toBe("gagal_menulis");
    expect(hasil.dipulihkan).toBe(true);
    expect(aktif()).toEqual([32, 26, 31]);
    expect(audit).toBe(0);
  });

  it("bukti sebabnya: penjalan LEPAS-LEPAS (dipakai rute sampai 1.188.0) meninggalkan perkara tanpa majelis aktif", async () => {
    gagalPada = /^INSERT INTO perkara_hakim_pn .*/;
    const tulis = require_(path.join(AKAR_BOT, "services/penetapanTulisService.js")) as Layanan & {
      jalankanRencana: (r: unknown, o: { kering: boolean }) => Promise<Record<string, unknown>>;
    };
    const hasil = await tulis.jalankanRencana(rencanaPmhKembali, { kering: false });
    expect(hasil.ok).toBe(false);
    expect(aktif()).toEqual([]);
  });

  it("rute bot memakai penjalan bertransaksi, bukan penjalan lepas-lepas", () => {
    const rute = readFileSync(path.join(AKAR_BOT, "routes/penetapanKembaliRoutes.js"), "utf8");
    expect(rute).toContain("sidangHasilService.jalankanRencanaUtuh(rencana, { kering })");
    expect(rute).not.toMatch(/penetapanTulisService\.jalankanRencana\(/);
  });

  it("layar menyebut bahwa kegagalan menulis dibatalkan utuh", () => {
    expect(kalimatTolakKembali("gagal_menulis")).toMatch(/dibatalkan, tidak ada yang tertinggal/);
    expect(kalimatTolakKembali("server_sipp_tidak_terhubung")).toMatch(/tidak ada yang ditulis/);
  });
});
