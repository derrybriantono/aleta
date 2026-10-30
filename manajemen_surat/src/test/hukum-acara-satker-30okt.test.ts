// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HUKUM_ACARA, KATA_PROVINSI_JAWA_MADURA, bentukSatker, hukumAcaraDariProvinsi, isiCabangSatker, kueriHukumAcara, pilihanHukumAcara } from "@/lib/identitas-satker";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { keadaanHukumAcara, type KeadaanSatkerBot } from "@/server/modules/pengaturan-abt/identitas-satker";
import { cabangHukumAcaraSah } from "@/server/modules/pengaturan-abt/service";

/**
 * G6 6.1 (30 Okt 2026) - penanda hukum acara satker (RBg/HIR) di identitas satker.
 *   - #11850# paket hir-rbg-30okt: bentuk isian satker; otomatis dari provinsi (#9276#) - aturan portal = kueri paket;
 *   - Super Admin menetapkan Otomatis/RBg/HIR (Admin ditolak), tercatat, dapat Kembalikan; isi cabang hanya RBg/HIR (portal & bot).
 */

const akar = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(akar, "aleta_bot", "package.json"));
const servisBot = require_(path.join(akar, "aleta_bot/services/abtPengaturanService.js")) as {
  buatLayanan: (d: Record<string, unknown>) => { simpanKueriSatker: (b: unknown) => Promise<Record<string, unknown>> };
};

// Kueri #11850# PERSIS seperti dipasang paket (dibaca dari sumber paket, bukan disalin di sini).
const VARIABEL_PAKET = JSON.parse(readFileSync(path.join(akar, "abt-paket/hir-rbg-30okt/hasil/variabel.json"), "utf8")) as Array<{ no: number; sql: string }>;
const Q11850 = VARIABEL_PAKET.find((v) => v.no === 11850)!.sql;

describe("kueri #11850# paket = aturan portal", () => {
  it("bentuk isian satker, tanpa cabang satker (otomatis), provinsi Jawa/Madura = HIR selain itu RBg", () => {
    expect(bentukSatker(Q11850)).toBe(true);
    expect(pilihanHukumAcara(Q11850, "PA.Dgl")).toBe("otomatis");
    for (const k of KATA_PROVINSI_JAWA_MADURA) expect(Q11850.toLowerCase()).toContain(`'%${k}%'`);
    expect(hukumAcaraDariProvinsi("Sulawesi Tengah")).toBe("RBg");
    expect(hukumAcaraDariProvinsi("Jawa Timur")).toBe("HIR");
    expect(hukumAcaraDariProvinsi("DKI Jakarta")).toBe("HIR");
    expect(hukumAcaraDariProvinsi("Daerah Istimewa Yogyakarta")).toBe("HIR");
    expect(hukumAcaraDariProvinsi("Banten")).toBe("HIR");
    expect(hukumAcaraDariProvinsi("")).toBe("RBg");
    expect(hukumAcaraDariProvinsi("Kalimantan Barat")).toBe("RBg");
  });

  it("Super Admin menetapkan HIR lalu kembali otomatis: hanya cabang satker berubah", () => {
    const hir = kueriHukumAcara(Q11850, "PA.Dgl", "HIR");
    expect(isiCabangSatker(hir, "PA.Dgl")).toEqual({ ada: true, nilai: "HIR" });
    expect(pilihanHukumAcara(hir, "PA.Dgl")).toBe("HIR");
    expect(cabangHukumAcaraSah(hir)).toBe(true);
    expect(kueriHukumAcara(hir, "PA.Dgl", "otomatis")).toBe(Q11850);
    expect(() => kueriHukumAcara(Q11850, "PA.Dgl", "Rv")).toThrow(/RBg, atau HIR/);
    expect(cabangHukumAcaraSah(hir.replace("'HIR'", "'(SELECT 1)'"))).toBe(false);
    expect([...HUKUM_ACARA]).toEqual(["RBg", "HIR"]);
  });

  it("keadaan dari bacaan ABT: belum terpasang disebut sebabnya; terpasang = nilai, pilihan, provinsi", () => {
    const dasar: KeadaanSatkerBot = { sipp: { kodePN: "PA.Dgl", namaPN: "", namaPT: "", alamatPN: "", zonaWaktu: "" }, variabel: [], perkaraContoh: null };
    expect(keadaanHukumAcara(dasar)).toMatchObject({ ada: false, bisa: false, sebab: expect.stringMatching(/hir-rbg-30okt/) });
    const v = (noVar: string, sql_query: string, nilai: string) => ({ noVar, ada: true, nama: "", jenis: "data_sql", sql_query, default_data: "", dikunci: false, bentukSatker: true, nilai });
    const k = keadaanHukumAcara({ ...dasar, variabel: [v("11850", Q11850, "RBg"), v("9276", "", "Sulawesi Tengah")] });
    expect(k).toMatchObject({ ada: true, nilai: "RBg", pilihan: "otomatis", provinsi: "Sulawesi Tengah", otomatis: "RBg", bisa: true });
  });
});

describe("bot simpanKueriSatker #11850#: isi cabang hanya RBg/HIR", () => {
  let isi: string;
  const jalankan = async (sql: string, p: unknown[] = []) => {
    const s = sql.replace(/\s+/g, " ").trim();
    if (/FROM aps_badilag\.abt_variabel WHERE no_var = \?/.test(s)) return [{ sql_query: isi, default_data: null, locked: 0, data_type: "data_sql", no_var: p[0] }];
    if (/^SELECT perkara_id, nomor_perkara/.test(s)) return [{ perkara_id: "77", nomor_perkara: "1/Pdt.G/2026/PA.Dgl", jenis_perkara_nama: "Cerai Gugat" }];
    if (/^UPDATE aps_badilag\.abt_variabel SET sql_query = \? WHERE no_var = \?$/.test(s)) {
      isi = String(p[0]);
      return [];
    }
    throw new Error(`SQL tiruan tidak dikenal: ${s}`);
  };
  const layanan = servisBot.buatLayanan({
    kueri: jalankan,
    transaksi: async (kerja: (q: typeof jalankan) => Promise<unknown>) => kerja(jalankan),
    skemaAbt: "aps_badilag",
    akarBlangko: os.tmpdir(),
    buatMesin: () => ({ nilaiPenanda: async (_k: unknown, d: string[]) => new Map([[d[0], { status: "terisi", sebab: "", polos: "HIR" }]]) }),
  });
  beforeEach(() => {
    isi = Q11850;
  });
  it("HIR ditulis; isi selain RBg/HIR ditolak tanpa menulis", async () => {
    const jahat = Q11850.replace("WHEN '' THEN 'RBg'", "WHEN 'PA.Dgl' THEN 'X' WHEN '' THEN 'RBg'");
    await expect(layanan.simpanKueriSatker({ noVar: "11850", lama: { sql_query: Q11850 }, baru: { sql_query: jahat } })).rejects.toMatchObject({ kode: "bukan_satker" });
    expect(isi).toBe(Q11850);
    const hir = kueriHukumAcara(Q11850, "PA.Dgl", "HIR");
    await layanan.simpanKueriSatker({ noVar: "11850", lama: { sql_query: Q11850 }, baru: { sql_query: hir } });
    expect(isi).toBe(hir);
  });
});

// ─── rute: Super Admin saja, tercatat, Kembalikan ─────────────────────────────
let db: AletaDatabase | null = null;
let aktor = "usr-super";
let kueriAbt: Record<string, string> = {};
const panggilan: Array<{ jalur: string; body: Record<string, unknown> }> = [];
vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));
vi.mock("@/server/modules/pengaturan-abt/gateway", () => ({
  ambilGambarBotPengaturanAbt: async () => ({ ok: false }),
  panggilBotPengaturanAbt: async (jalur: string, pilihan: { method?: string; body?: Record<string, unknown> } = {}) => {
    panggilan.push({ jalur, body: pilihan.body ?? {} });
    if (jalur === "/satker")
      return {
        ok: true,
        data: {
          sipp: { kodePN: "PA.Dgl", namaPN: "PENGADILAN AGAMA DONGGALA", namaPT: "", alamatPN: "", zonaWaktu: "WITA" },
          variabel: [
            { noVar: "9276", ada: true, nama: "", jenis: "data_sql", sql_query: "", default_data: "", dikunci: false, bentukSatker: false, nilai: "Sulawesi Tengah" },
            { noVar: "11850", ada: true, nama: "", jenis: "data_sql", sql_query: kueriAbt["11850"], default_data: "", dikunci: false, bentukSatker: true, nilai: isiCabangSatker(kueriAbt["11850"], "PA.Dgl").nilai || "RBg" },
          ],
          perkaraContoh: null,
        },
      };
    if (jalur === "/satker/simpan") {
      const b = pilihan.body as { noVar: string; lama: { sql_query: string }; baru: { sql_query: string } };
      if (kueriAbt[b.noVar] !== b.lama.sql_query) return { ok: false, kode: "berubah", error: "sudah diubah", status: 409 };
      kueriAbt[b.noVar] = b.baru.sql_query;
      return { ok: true, data: { sebelum: b.lama, sesudah: b.baru, uji: null } };
    }
    return { ok: false, error: "jalur tidak dikenal", status: 404 };
  },
}));

async function rute(cara: "GET" | "POST", opsi: { query?: string; badan?: unknown } = {}) {
  const modul = (await import("@/app/api/pengaturan-sipp-abt/route")) as unknown as Record<string, (r: NextRequest) => Promise<Response>>;
  return modul[cara](
    new NextRequest("http://localhost/api/pengaturan-sipp-abt" + (opsi.query ? "?" + opsi.query : ""), {
      method: cara,
      headers: opsi.badan !== undefined ? { "content-type": "application/json" } : undefined,
      body: opsi.badan !== undefined ? JSON.stringify(opsi.badan) : undefined,
    })
  );
}

describe("rute hukum acara (pg-mem berbenih, bot tiruan)", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-super";
    panggilan.length = 0;
    kueriAbt = { "11850": Q11850 };
  });
  afterEach(async () => {
    await db?.close();
    db = null;
  });

  it("bacaan identitas memuat keadaan hukum acara; Super Admin menetapkan HIR, tercatat, Kembalikan = otomatis lagi; Admin ditolak", async () => {
    const g = (await (await rute("GET", { query: "bagian=satker" })).json()) as { data: { hukumAcara: Record<string, unknown> } };
    expect(g.data.hukumAcara).toMatchObject({ ada: true, pilihan: "otomatis", otomatis: "RBg", provinsi: "Sulawesi Tengah", bisa: true });
    aktor = "usr-admin";
    expect((await rute("POST", { badan: { tindakan: "terapkan-hukum-acara", pilihan: "HIR" } })).status).toBe(403);
    expect(kueriAbt["11850"]).toBe(Q11850);
    aktor = "usr-super";
    const r = await rute("POST", { badan: { tindakan: "terapkan-hukum-acara", pilihan: "HIR" } });
    expect(r.status).toBe(200);
    expect(isiCabangSatker(kueriAbt["11850"], "PA.Dgl").nilai).toBe("HIR");
    const ulang = (await (await rute("POST", { badan: { tindakan: "terapkan-hukum-acara", pilihan: "HIR" } })).json()) as { data: { dilewati: boolean } };
    expect(ulang.data.dilewati).toBe(true);
    const [c] = await db!.queryAll<Record<string, string>>("SELECT * FROM aleta_abt_suntingan WHERE jenis = 'satker'");
    expect(c).toMatchObject({ kunci: "11850", status: "tersimpan", oleh_id: "usr-super" });
    expect(c.ringkas).toMatch(/hukum acara HIR/);
    expect((await rute("POST", { badan: { tindakan: "kembalikan", id: c.id } })).status).toBe(200);
    expect(kueriAbt["11850"]).toBe(Q11850);
    expect((await rute("POST", { badan: { tindakan: "terapkan-hukum-acara", pilihan: "Rv" } })).status).toBe(400);
  });
});
