// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cocokkanJenis, kodeVariabel, kunciJenis, persenTerisi, susunHasilUkur } from "@/lib/abt-wajib";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";

/**
 * ============================================================================
 * VARIABEL WAJIB ABT SEBELUM CETAK (KONTRAK TAHAP 6-7 BAGIAN 3)
 * ============================================================================
 *
 * Yang dijaga:
 *   - hitungan bot: penyebut "sejak variabel mulai dipakai", isian kosong/
 *     "..." tidak dihitung, perkara tanpa putusan tidak ikut, kode berangka
 *     nol-depan; operasinya HANYA SELECT dan berjalan lewat jembatan
 *     sungguhan dengan penggerak mysql disandera;
 *   - ambang portal: >= 90% aktif, 50-90% tersimpan mati, < 10 putusan dibuang;
 *   - saklar Super Admin tidak ditimpa ukur ulang;
 *   - bentuk jawaban GET ?jenis= persis kontrak; semua pegawai membaca,
 *     hanya Super Admin mengubah dan mengukur.
 *
 * Angka contoh diambil dari ukuran sungguhan atas salinan Donggala
 * (14 Sep 2026): Cerai Gugat 1214 1609/1643, Istbat 5105 680/705, 8171 450/705.
 */

// ============================================================================
// JEMBATAN BOT - hitungan murni dan operasi lewat sandera
// ============================================================================

const akar = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(akar, "aleta_bot/package.json"));
const jalurJembatan = require_.resolve(path.join(akar, "aleta_bot/services/sippReadOnlyBridgeService.js"));
const jalurExternal = require_.resolve(path.join(akar, "aleta_bot/services/externalDbService.js"));
const jalurLog = require_.resolve(path.join(akar, "aleta_bot/services/logService.js"));

type Jembatan = {
  handleBridgeOperation: (op: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>>;
  hitungVariabelTerisi: (masukan: Record<string, unknown>) => {
    jumlahPerkaraDasar: number;
    jenis: Array<{ jenis: string; jumlahPerkara: number; variabel: Array<{ noVar: string; nama: string; jumlahPerkara: number; jumlahTerisi: number; mulai: string }> }>;
  };
};

function muatJembatan(penjawab: (sql: string) => unknown[]): { jembatan: Jembatan; kueri: string[] } {
  const kueri: string[] = [];
  const buat = (jalur: string, isi: unknown) => {
    const Mod = require_("module") as { new (id: string): { exports: unknown; loaded: boolean } };
    const mod = new Mod(jalur);
    mod.exports = isi;
    mod.loaded = true;
    require_.cache[jalur] = mod as never;
  };
  buat(jalurExternal, {
    query: async (_kunci: string, sql: string) => {
      kueri.push(sql);
      return penjawab(sql);
    },
    sanitizeError: (galat: unknown) => String((galat as Error)?.message || galat),
  });
  buat(jalurLog, { logSystemEvent: async () => undefined, logAdminAction: async () => undefined, logQueryError: async () => undefined });
  delete require_.cache[jalurJembatan];
  return { jembatan: require_(jalurJembatan) as Jembatan, kueri };
}

afterEach(() => {
  delete require_.cache[jalurJembatan];
  delete require_.cache[jalurExternal];
  delete require_.cache[jalurLog];
});

describe("hitungVariabelTerisi (bot, murni)", () => {
  it("penyebut sejak variabel mulai dipakai; perkara lama tidak menghukum variabel baru", () => {
    const { jembatan } = muatJembatan(() => []);
    const dasar = [
      ...Array.from({ length: 10 }, (_, i) => ({ perkara_id: 100 + i, jenis: "Cerai Gugat", tgl: "2020-01-0" + ((i % 9) + 1) })),
      ...Array.from({ length: 10 }, (_, i) => ({ perkara_id: 200 + i, jenis: "Cerai Gugat", tgl: new Date(2025, 0, i + 1) })),
    ];
    const isi = [
      // 1214 diisi di semua 20 perkara.
      ...dasar.map((p) => ({ perkara_id: p.perkara_id, no_var: 1214 })),
      // 7035 baru dipakai 2025, diisi 9 dari 10 perkara 2025.
      ...dasar.slice(10, 19).map((p) => ({ perkara_id: p.perkara_id, no_var: "7035" })),
      // Perkara tanpa putusan (tidak ada di dasar) tidak ikut.
      { perkara_id: 999, no_var: 1214 },
      // Kode bukan angka dibuang.
      { perkara_id: 100, no_var: "x1" },
    ];
    const hasil = jembatan.hitungVariabelTerisi({ dasar, isi, nama: [{ no_var: 7, nama: "Anak" }, { no_var: "1214", nama: "Alat bukti" }] });
    expect(hasil.jumlahPerkaraDasar).toBe(20);
    const cg = hasil.jenis[0];
    expect(cg.jenis).toBe("Cerai Gugat");
    expect(cg.variabel.map((v) => [v.noVar, v.jumlahTerisi, v.jumlahPerkara])).toEqual([
      ["1214", 20, 20],
      ["7035", 9, 10],
    ]);
    expect(cg.variabel[0].nama).toBe("Alat bukti");
    // Tanggal Date dari penggerak dibaca sebagai tanggal, bukan teks Date.
    expect(cg.variabel[1].mulai).toBe("2025-01-01");
  });

  it("di bawah batas bawah atau kurang dari minimal putusan tidak dikirim", () => {
    const { jembatan } = muatJembatan(() => []);
    const dasar = Array.from({ length: 12 }, (_, i) => ({ perkara_id: i + 1, jenis: "Istbat", tgl: "2024-01-01" }));
    const isi = dasar.slice(0, 5).map((p) => ({ perkara_id: p.perkara_id, no_var: 8171 }));
    expect(jembatan.hitungVariabelTerisi({ dasar, isi }).jenis).toEqual([]);
    const sedikit = jembatan.hitungVariabelTerisi({ dasar: dasar.slice(0, 5), isi });
    expect(sedikit.jenis).toEqual([]);
  });

  it("operasi abt.ukurVariabelTerisi: empat kueri SELECT, isian '...' tersaring di SQL, hasil terhitung", async () => {
    const { jembatan, kueri } = muatJembatan((sql) => {
      if (/information_schema\.TABLES/.test(sql)) return [{ skema: "aps_badilag" }];
      if (/FROM `perkara` p/.test(sql)) {
        return Array.from({ length: 10 }, (_, i) => ({ perkara_id: i + 1, jenis: "Cerai Talak", tgl: "2025-02-02" }));
      }
      if (/abt_data_teks/.test(sql)) return Array.from({ length: 10 }, (_, i) => ({ perkara_id: i + 1, no_var: 1214 }));
      if (/abt_data_tanggal/.test(sql)) return [];
      if (/abt_variabel/.test(sql)) return [{ no_var: 1214, nama: "Alat-alat bukti CG/CT" }];
      return [];
    });
    const hasil = (await jembatan.handleBridgeOperation("abt.ukurVariabelTerisi", {})) as {
      ada: boolean;
      jenis: Array<{ jenis: string; variabel: Array<{ noVar: string; jumlahTerisi: number; jumlahPerkara: number }> }>;
    };
    expect(hasil.ada).toBe(true);
    expect(hasil.jenis[0]).toMatchObject({ jenis: "Cerai Talak" });
    expect(hasil.jenis[0].variabel[0]).toMatchObject({ noVar: "1214", jumlahTerisi: 10, jumlahPerkara: 10 });
    const dataKueri = kueri.filter((q) => !/information_schema/.test(q));
    expect(dataKueri).toHaveLength(4);
    for (const q of dataKueri) {
      expect(q.trim()).toMatch(/^SELECT\b/i);
      expect(q).not.toMatch(/\b(insert|update|delete|replace|drop|alter|create)\b/i);
    }
    expect(dataKueri.find((q) => /abt_data_teks` t\s*\nWHERE/.test(q))).toMatch(/NOT IN \('', '-', '\.', '\.\.\.'\)/);
  });

  it("APS Badilag tidak ditemukan: ada false beserta sebabnya, bukan hasil kosong yang tampak sah", async () => {
    const { jembatan } = muatJembatan(() => []);
    const hasil = await jembatan.handleBridgeOperation("abt.ukurVariabelTerisi", {});
    expect(hasil).toMatchObject({ ada: false });
    expect(String(hasil.sebab)).toMatch(/APS Badilag/);
  });
});

// ============================================================================
// ATURAN PORTAL
// ============================================================================

describe("aturan portal", () => {
  it("kunci jenis, kode, persen, dan pencocokan jenis", () => {
    expect(kunciJenis("Pengesahan Perkawinan/Istbat Nikah")).toBe("pengesahan perkawinan istbat nikah");
    expect(kodeVariabel("#7#")).toBe("0007");
    expect(kodeVariabel("12a")).toBe("");
    expect(persenTerisi(1609, 1643)).toBe(97.9);
    expect(persenTerisi(1, 0)).toBeNull();
    const ada = ["cerai gugat", "cerai talak", "pengesahan perkawinan istbat nikah"];
    expect(cocokkanJenis("Cerai Gugat", ada)).toBe("cerai gugat");
    expect(cocokkanJenis("Istbat Nikah", ada)).toBe("pengesahan perkawinan istbat nikah");
    // "cerai" cocok dengan dua - tidak menebak.
    expect(cocokkanJenis("Cerai", ada)).toBeNull();
  });

  it("ambang: >= 90% aktif, 50-90% mati, < 10 putusan dibuang", () => {
    const baris = susunHasilUkur({
      jenis: [
        {
          jenis: "Pengesahan Perkawinan/Istbat Nikah",
          variabel: [
            { noVar: "5105", jumlahPerkara: 705, jumlahTerisi: 680 },
            { noVar: "8171", jumlahPerkara: 705, jumlahTerisi: 450 },
            { noVar: "0303", jumlahPerkara: 702, jumlahTerisi: 300 },
            { noVar: "1551", jumlahPerkara: 9, jumlahTerisi: 9 },
          ],
        },
      ],
    });
    expect(baris.map((b) => [b.kode, b.aktifBawaan])).toEqual([
      ["5105", true],
      ["8171", false],
    ]);
  });
});

// ============================================================================
// RUTE
// ============================================================================

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-super";
let jawabanBot: () => { ok: boolean; data?: unknown; error?: string } = () => ({ ok: false, error: "bot mati" });

vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));
vi.mock("@/server/modules/aleta-sipp/aleta-sipp-datasource", async (asli) => {
  const modul = await asli<typeof import("@/server/modules/aleta-sipp/aleta-sipp-datasource")>();
  return { ...modul, callAletaBotSippBridge: async () => jawabanBot() };
});

type Hasil = { status: number; isi: { ok: boolean; data: Record<string, unknown>; error?: { message: string } } };

async function panggil(cara: "GET" | "PUT" | "POST", opsi: { query?: string; badan?: unknown } = {}): Promise<Hasil> {
  const rute = await import("@/app/api/aleta-ecourt/abt-wajib/route");
  const req = new NextRequest("http://localhost/api/x" + (opsi.query ? "?" + opsi.query : ""), {
    method: cara,
    headers: opsi.badan !== undefined ? { "content-type": "application/json" } : undefined,
    body: opsi.badan !== undefined ? JSON.stringify(opsi.badan) : undefined,
  });
  const fungsi = (rute as unknown as Record<string, (r: NextRequest) => Promise<Response>>)[cara];
  const jawaban = await fungsi(req);
  return { status: jawaban.status, isi: (await jawaban.json()) as Hasil["isi"] };
}

const HASIL_UKUR = {
  ada: true,
  diukurPada: "2026-09-14T08:00:00.000Z",
  jumlahPerkaraDasar: 2841,
  jenis: [
    {
      jenis: "Cerai Gugat",
      jumlahPerkara: 1643,
      variabel: [{ noVar: "1214", nama: "Alat-alat bukti CG/CT", jumlahPerkara: 1643, jumlahTerisi: 1609, mulai: "2022-06-09" }],
    },
    {
      jenis: "Pengesahan Perkawinan/Istbat Nikah",
      jumlahPerkara: 706,
      variabel: [
        { noVar: "5105", nama: "Alamat Tempat Menikah", jumlahPerkara: 705, jumlahTerisi: 680, mulai: "2018-07-27" },
        { noVar: "8171", nama: "Alasan Permohonan untuk", jumlahPerkara: 705, jumlahTerisi: 450, mulai: "2018-07-27" },
      ],
    },
  ],
};

describe("rute abt-wajib (pg-mem berbenih)", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-super";
    jawabanBot = () => ({ ok: true, data: HASIL_UKUR });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await db?.close();
    db = null;
  });

  it("tanpa sesi 401; jenis belum diukur: daftar kosong dengan catatan, bukan error", async () => {
    aktor = null;
    expect((await panggil("GET", { query: "jenis=Cerai%20Gugat" })).status).toBe(401);
    aktor = "usr-ppg";
    const r = await panggil("GET", { query: "jenis=Cerai%20Gugat" });
    expect(r.status).toBe(200);
    expect(r.isi.data).toMatchObject({ jenis: "Cerai Gugat", variabel: [], diukurPada: null });
    expect(String(r.isi.data.catatan)).toMatch(/CETAK tidak ditahan/);
  });

  it("ukur ulang (Super Admin) lalu GET ?jenis= berbentuk kontrak", async () => {
    const u = await panggil("POST", { badan: { tindakan: "ukur-ulang" } });
    expect(u.status).toBe(200);
    expect(u.isi.data.hasil).toMatchObject({ disimpan: 3, dihapus: 0, jenis: 2 });

    aktor = "usr-jurusita";
    const r = await panggil("GET", { query: "jenis=" + encodeURIComponent("Istbat Nikah") });
    expect(r.status).toBe(200);
    const data = r.isi.data as { jenis: string; variabel: Array<Record<string, unknown>>; diukurPada: string; catatan: string };
    expect(Object.keys(data).sort()).toEqual(["catatan", "diukurPada", "jenis", "jenisNama", "variabel"]);
    expect(data.jenis).toBe("pengesahan perkawinan istbat nikah");
    expect(data.diukurPada).toBe("2026-09-14T08:00:00.000Z");
    expect(data.variabel.map((v) => [v.kode, v.sumber, v.persenTerisi, v.aktif])).toEqual([
      ["5105", "ukur", 96.5, true],
      ["8171", "ukur", 63.8, false],
    ]);
    expect(data.variabel[0]).toMatchObject({ nama: "Alamat Tempat Menikah" });
  });

  it("saklar Super Admin tidak ditimpa ukur ulang; kode baru bersumber admin", async () => {
    await panggil("POST", { badan: { tindakan: "ukur-ulang" } });
    const p = await panggil("PUT", {
      badan: { jenis: "Cerai Gugat", variabel: [{ kode: "1214", aktif: false }, { kode: "7035", aktif: true }] },
    });
    expect(p.status).toBe(200);
    expect((p.isi.data.variabel as Array<Record<string, unknown>>).map((v) => [v.kode, v.sumber, v.aktif, v.persenTerisi])).toEqual([
      ["7035", "admin", true, null],
      ["1214", "ukur", false, 97.9],
    ]);

    await panggil("POST", { badan: { tindakan: "ukur-ulang" } });
    const r = await panggil("GET", { query: "jenis=cerai%20gugat" });
    const v = r.isi.data.variabel as Array<Record<string, unknown>>;
    expect(v.find((x) => x.kode === "1214")).toMatchObject({ aktif: false, ditetapkanAdmin: true });
    expect(v.find((x) => x.kode === "7035")).toMatchObject({ aktif: true, sumber: "admin" });
  });

  it("hasil ukur lama yang tidak lagi lolos dibuang bila belum disentuh admin", async () => {
    await panggil("POST", { badan: { tindakan: "ukur-ulang" } });
    jawabanBot = () => ({ ok: true, data: { ...HASIL_UKUR, jenis: [HASIL_UKUR.jenis[0]] } });
    const u = await panggil("POST", { badan: { tindakan: "ukur-ulang" } });
    expect(u.isi.data.hasil).toMatchObject({ disimpan: 1, dihapus: 2 });
  });

  it("bot gagal: 502 dan daftar lama tidak diubah", async () => {
    await panggil("POST", { badan: { tindakan: "ukur-ulang" } });
    jawabanBot = () => ({ ok: false, error: "ECONNREFUSED" });
    const u = await panggil("POST", { badan: { tindakan: "ukur-ulang" } });
    expect(u.status).toBe(502);
    expect(u.isi.error?.message).toMatch(/Daftar lama tidak diubah/);
    const r = await panggil("GET", { query: "jenis=Cerai%20Gugat" });
    expect((r.isi.data.variabel as unknown[]).length).toBe(1);
  });

  it("impor hasil ukur (Super Admin) memakai jalan yang sama", async () => {
    const u = await panggil("POST", { badan: { tindakan: "impor", hasil: HASIL_UKUR } });
    expect(u.status).toBe(200);
    expect(u.isi.data.hasil).toMatchObject({ disimpan: 3 });
    expect((await panggil("POST", { badan: { tindakan: "impor", hasil: { x: 1 } } })).status).toBe(400);
    expect((await panggil("POST", { badan: { tindakan: "tebak" } })).status).toBe(400);
  });

  it("Admin dan pegawai tidak dapat mengubah atau mengukur", async () => {
    for (const orang of ["usr-admin", "usr-hakim"]) {
      aktor = orang;
      expect((await panggil("PUT", { badan: { jenis: "Cerai Gugat", variabel: [{ kode: "1214", aktif: true }] } })).status, orang).toBe(403);
      expect((await panggil("POST", { badan: { tindakan: "ukur-ulang" } })).status, orang).toBe(403);
      expect((await panggil("POST", { badan: { tindakan: "impor", hasil: HASIL_UKUR } })).status, orang).toBe(403);
    }
    aktor = "usr-admin";
    const g = await panggil("GET");
    expect(g.status).toBe(200);
    expect(g.isi.data.bolehMenyunting).toBe(false);
  });

  it("PUT menolak kode dan aktif yang tidak sah", async () => {
    expect((await panggil("PUT", { badan: { jenis: "Cerai Gugat", variabel: [{ kode: "abc", aktif: true }] } })).status).toBe(400);
    expect((await panggil("PUT", { badan: { jenis: "Cerai Gugat", variabel: [{ kode: "1214", aktif: "ya" }] } })).status).toBe(400);
    expect((await panggil("PUT", { badan: { jenis: "", variabel: [{ kode: "1214", aktif: true }] } })).status).toBe(400);
    expect((await panggil("PUT", { badan: { jenis: "Cerai Gugat", variabel: [] } })).status).toBe(400);
  });
});
