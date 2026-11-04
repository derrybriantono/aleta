// @vitest-environment node
/**
 * ============================================================================
 * 4 NOV 2026 - RUTE PORTAL BLANGKO DERRY: PRATINJAU MESIN ALETA (A1), 19 FOLDER TANPA MENU (A7), TITIK-TITIK (A12)
 * ============================================================================
 *
 *   A1  POST blangko-derry/pratinjau: bot dipanggil blangko.isi dengan segar:true (tanpa tes, tanpa ketikan), hak dokumen dari sesi
 *       seperti GET, kemampuan "blangko-abt"; variabel galat dilaporkan agar ekstensi jatuh ke ABT lama.
 *   A7  ?indeks=1 tidak memuat 19 folder tanpa menu ABT (97 berkas), folder lain utuh; GET folder itu tetap dilayani.
 *   A12 GET ?titik=1: hanya enam variabel kalimat berlubang; kosong atau masih titik -> dilaporkan, terisi -> tidak.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FOLDER_DERRY_TANPA_MENU, folderDerryTanpaMenu } from "@/lib/tugas-blangko";
import { VARIABEL_TITIK_KALIMAT, kodeTitikDalamBlangko, nilaiMasihTitik } from "@/lib/variabel-titik-kalimat";
import { ApiError } from "@/server/shared/errors";

const bridge = vi.fn();
const rute = vi.hoisted(() => ({
  aktor: { id: "u1", name: "X", roleId: "hakim" } as Record<string, unknown>,
  izinBlangkoAbt: true,
}));

vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({ queryAll: async () => [], queryOne: async () => null }) }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "u1" }));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({
  pastikanKapabilitas: async (_db: unknown, _id: unknown, kemampuan: string) => {
    if (kemampuan === "blangko-abt" && !rute.izinBlangkoAbt) throw new ApiError(403, "Tanpa kemampuan blangko-abt.");
    return rute.aktor;
  },
}));
vi.mock("@/server/modules/aleta-sipp/aleta-sipp-datasource", () => ({ callAletaBotSippBridge: (...a: unknown[]) => bridge(...a) }));
vi.mock("@/server/modules/pengaturan-abt/service", () => ({ bacaHakBlangko: async () => ({ ada: true, saklar: { hakimBas: false, ppPutusan: false }, folder: [] }) }));
vi.mock("@/server/shared/admin-access-audit", () => ({
  handleAdminRouteError: (e: unknown) => {
    const status = e instanceof ApiError ? e.status : 500;
    return new Response(JSON.stringify({ ok: false, alasan: String((e as Error)?.message || e) }), { status });
  },
}));

const RTF = "{\\rtf1\\ansi\\pard Putusan Nomor 1\\par}";
const b64 = (t: string) => Buffer.from(t, "latin1").toString("base64");

async function ambil(q: string) {
  const m = await import("@/app/api/aleta-ecourt/blangko-derry/route");
  m.lupakanSinggahan();
  const r = await m.GET({ nextUrl: new URL(`http://localhost/aleta/api/aleta-ecourt/blangko-derry${q}`) } as never);
  return { status: r.status, isi: (await r.json()) as { ok: boolean; data?: any } };
}
async function kirim(badan: Record<string, unknown>) {
  const m = await import("@/app/api/aleta-ecourt/blangko-derry/pratinjau/route");
  const r = await m.POST({ json: async () => badan } as never);
  return { status: r.status, isi: (await r.json()) as { ok: boolean; data?: any; alasan?: string } };
}
const BADAN = { perkaraId: "10154", sidangKe: 2, folder: "1 Perceraian CG", berkas: "[01] A.rtf" };

beforeEach(() => {
  bridge.mockReset();
  rute.aktor = { id: "u1", name: "X", roleId: "hakim" };
  rute.izinBlangkoAbt = true;
});

describe("A1. POST pratinjau mesin ALETA", () => {
  it("memanggil blangko.isi dengan segar:true, tanpa tes dan tanpa ketikan; hanya mengembalikan naskah bersih dan hitungan", async () => {
    bridge.mockResolvedValue({ ok: true, data: { ok: true, berkas: "[01] A.rtf", jumlahTerisi: 5, kosong: [{ noVar: "8530", nama: "Isian", sebab: "belum diisi", status: "kosong" }], rtfBase64: b64(RTF), mesinGalat: "" } });
    const r = await kirim(BADAN);
    expect(r.status).toBe(200);
    expect(bridge).toHaveBeenCalledTimes(1);
    const [op, param, opsi] = bridge.mock.calls[0];
    expect(op).toBe("blangko.isi");
    expect(param).toMatchObject({ folder: "derry_briantono/1 Perceraian CG", berkas: "[01] A.rtf", perkaraId: "10154", sidangKe: 2, segar: true, nilai: {}, cadangan: {}, tanyaJawabSaksi: {} });
    expect(param).not.toHaveProperty("tes");
    expect(param).not.toHaveProperty("isianTangan");
    expect(opsi.timeoutMs).toBeLessThanOrEqual(60_000);
    expect(r.isi.data).toMatchObject({ jumlahTerisi: 5, kosong: 1, jumlahGalat: 0, mesinGalat: "", galat: [] });
    expect(Buffer.from(r.isi.data.rtfBase64, "base64").toString("latin1")).toContain("Putusan Nomor 1");
  });

  it("variabel galat/tidak ada di katalog/mesin tak terbaca dilaporkan sebagai galat (kosong biasa tidak)", async () => {
    bridge.mockResolvedValue({
      ok: true,
      data: {
        ok: true,
        jumlahTerisi: 1,
        rtfBase64: b64(RTF),
        kosong: [
          { noVar: "1", nama: "Kosong biasa", sebab: "belum diisi", status: "kosong" },
          { noVar: "2", nama: "Kueri gagal", sebab: "SQL", status: "galat" },
          { noVar: "3", nama: "Hilang", sebab: "tidak ada di katalog ABT", status: "takada" },
          { noVar: "4", nama: "", sebab: "mesin ABT tidak terbaca: putus" },
        ],
        mesinGalat: "",
      },
    });
    const r = await kirim(BADAN);
    expect(r.isi.data.kosong).toBe(4);
    expect(r.isi.data.jumlahGalat).toBe(3);
    expect(r.isi.data.galat.map((g: { nama: string }) => g.nama)).toEqual(["Kueri gagal", "Hilang", ""]);
  });

  it("bot gagal -> 502 dengan alasan (ekstensi jatuh ke ABT lama)", async () => {
    bridge.mockResolvedValue({ ok: false, error: "bot tidak menjawab" });
    const r = await kirim(BADAN);
    expect(r.status).toBe(502);
    expect(r.isi.alasan).toContain("bot tidak menjawab");
  });

  it("hak dokumen dari sesi: hakim tidak boleh folder relaas/BAS; bot tidak pernah dipanggil", async () => {
    const r1 = await kirim({ ...BADAN, folder: "98 Relaas" });
    expect(r1.status).toBe(403);
    const r2 = await kirim({ ...BADAN, folder: "1 Perceraian CG - BAS" });
    expect(r2.status).toBe(403);
    expect(bridge).not.toHaveBeenCalled();
  });

  it("tanpa kemampuan blangko-abt -> 403; masukan salah -> 400; nama berkas/folder berbahaya ditolak", async () => {
    rute.izinBlangkoAbt = false;
    expect((await kirim(BADAN)).status).toBe(403);
    rute.izinBlangkoAbt = true;
    expect((await kirim({ ...BADAN, perkaraId: "abc" })).status).toBe(400);
    expect((await kirim({ ...BADAN, berkas: "../x.rtf" })).status).toBe(400);
    expect((await kirim({ ...BADAN, folder: "../x" })).status).toBe(400);
    expect(bridge).not.toHaveBeenCalled();
  });

  it("admin meniru peran lewat sebagaiPeran, bukan-admin diabaikan", async () => {
    bridge.mockResolvedValue({ ok: true, data: { ok: true, rtfBase64: b64(RTF), kosong: [] } });
    rute.aktor = { id: "u1", name: "a", roleId: "super-admin" };
    expect((await kirim({ ...BADAN, folder: "1 Perceraian CG - BAS", sebagaiPeran: "hakim" })).status).toBe(403);
    expect((await kirim({ ...BADAN, folder: "1 Perceraian CG - BAS", sebagaiPeran: "pp" })).status).toBe(200);
    rute.aktor = { id: "u1", name: "h", roleId: "hakim" };
    expect((await kirim({ ...BADAN, folder: "1 Perceraian CG - BAS", sebagaiPeran: "pp" })).status).toBe(403);
  });

  it("bot: parameter segar melewati ingatan 60 detik; tanpa segar perilaku lama (BAS naskah, dsb.)", async () => {
    const { readFileSync } = await import("node:fs");
    const bot = readFileSync("../aleta_bot/services/sippReadOnlyBridgeService.js", "latin1");
    expect(bot).toContain("!params.segar && lama && Date.now() - lama.saat < 60000 ? lama.hasil");
    expect(bot).toContain("ingatanIsi.set(kunci, { saat: lama && !params.segar ? lama.saat : Date.now(), hasil: h });");
  });

  it("penjaga baca-saja route.ts utama tetap utuh: POST pratinjau bukan di sana", async () => {
    const { readFileSync } = await import("node:fs");
    const utama = readFileSync("src/app/api/aleta-ecourt/blangko-derry/route.ts", "utf8");
    expect(utama).not.toMatch(/export async function (POST|PUT|DELETE|PATCH)\b/);
    expect(utama).toMatch(/PERAN_TIRUAN = new Set\(\["hakim", "pp", "js", "ptsp"\]\)/);
  });
});

describe("A7. 19 folder tanpa menu ABT disembunyikan dari panel", () => {
  it("daftar 19 folder; dikenali dari nama maupun jalur; folder menu biasa tidak", () => {
    expect(FOLDER_DERRY_TANPA_MENU).toHaveLength(19);
    expect(new Set(FOLDER_DERRY_TANPA_MENU).size).toBe(19);
    expect(folderDerryTanpaMenu("ALUR 02 Cerai Verstek 2 Sidang")).toBe(true);
    expect(folderDerryTanpaMenu("derry_briantono/- BAS CONTRA PERCERAIAN -")).toBe(true);
    expect(folderDerryTanpaMenu("alur 07 cerai gugur")).toBe(true);
    expect(folderDerryTanpaMenu("1 Perceraian CG")).toBe(false);
    expect(folderDerryTanpaMenu("1 Perceraian CG - BAS")).toBe(false);
    expect(folderDerryTanpaMenu("BAS Itsbat Nikah Gugur dan Cabut")).toBe(true);
    expect(folderDerryTanpaMenu("")).toBe(false);
    // nama yang hanya mirip (ALUR 30 di folder jenis, bukan folder sendiri) tidak ikut tersembunyi
    expect(folderDerryTanpaMenu("4a Harta Bersama - BAS")).toBe(false);
    expect(folderDerryTanpaMenu("ALUR 14 Lain")).toBe(false);
  });

  it("?indeks=1 tidak memuat folder itu dan semua folder lain utuh (sumber pohon)", async () => {
    const aktif = ["1 Perceraian CG", "1 Perceraian CG - BAS", "2 Cerai Talak CT"];
    bridge.mockImplementation(async (op: string) => {
      if (op === "blangko.pohon") {
        const semua = [...aktif, ...FOLDER_DERRY_TANPA_MENU];
        return { ok: true, data: { ada: true, berkas: semua.map((f) => ({ jalur: `derry_briantono/${f}/[01] A.rtf` })) } };
      }
      return { ok: false, error: "tidak dikenal" };
    });
    rute.aktor = { id: "u1", name: "a", roleId: "super-admin" };
    const r = await ambil("?indeks=1");
    expect(r.status).toBe(200);
    const nama = (r.isi.data.folder as Array<{ nama: string }>).map((f) => f.nama).sort();
    expect(nama).toEqual([...aktif].sort());
  });

  it("?indeks=1 sumber katalog (cadangan) juga tidak memuatnya", async () => {
    bridge.mockImplementation(async (op: string, param: { folder?: string }) => {
      if (op === "blangko.pohon") return { ok: true, data: { ada: false, berkas: [] } };
      if (op === "blangko.katalog" && param.folder === "derry_briantono") return { ok: true, data: { ada: true, set: [{ nama: "1 Perceraian CG" }, { nama: "ALUR 01 Cerai Verstek 1 Sidang (Putus Sidang Pertama)" }] } };
      if (op === "blangko.katalog") return { ok: true, data: { ada: true, blangko: [{ berkas: "[01] A.rtf" }] } };
      return { ok: false, error: "tidak dikenal" };
    });
    rute.aktor = { id: "u1", name: "a", roleId: "super-admin" };
    const r = await ambil("?indeks=1");
    expect((r.isi.data.folder as Array<{ nama: string }>).map((f) => f.nama)).toEqual(["1 Perceraian CG"]);
  });

  it("membaca blangko di salah satu folder itu langsung tetap dilayani (berkas tidak dihapus/diblokir)", async () => {
    bridge.mockImplementation(async (op: string) => (op === "blangko.baca" ? { ok: true, data: { ada: true, berkas: "[1a] BAS.rtf", penanda: [] } } : { ok: false, error: "x" }));
    rute.aktor = { id: "u1", name: "a", roleId: "super-admin" };
    const r = await ambil(`?folder=${encodeURIComponent("ALUR 01 Cerai Verstek 1 Sidang (Putus Sidang Pertama)")}&berkas=${encodeURIComponent("[1a] BAS.rtf")}`);
    expect(r.status).toBe(200);
  });
});

describe("A12. ?titik=1 - variabel kalimat berlubang", () => {
  it("daftar enam variabel, nilai masih titik / kosong dikenali", () => {
    expect(Object.keys(VARIABEL_TITIK_KALIMAT).sort()).toEqual(["11161", "12034", "3615", "3628", "9325", "9327"]);
    for (const nama of Object.values(VARIABEL_TITIK_KALIMAT)) expect(nama).not.toMatch(/\d{4}|OTOMATIS/);
    expect(nilaiMasihTitik("")).toBe(true);
    expect(nilaiMasihTitik("  ")).toBe(true);
    expect(nilaiMasihTitik("pada tanggal ... di ...")).toBe(true);
    expect(nilaiMasihTitik("Rp........,00")).toBe(true);
    expect(nilaiMasihTitik("telah menolak")).toBe(false);
    expect(nilaiMasihTitik("Kesimpulan Pemohon: sudah diajukan.")).toBe(false);
    expect(kodeTitikDalamBlangko(["0001", "9327", "12034"]).sort()).toEqual(["12034", "9327"]);
    expect(kodeTitikDalamBlangko(["0001"])).toEqual([]);
  });

  function pasangBot(penanda: string[], nilai: Record<string, { status: string; teks: string }> | null) {
    bridge.mockImplementation(async (op: string) => {
      if (op === "blangko.baca") return { ok: true, data: { ada: true, berkas: "[01] A.rtf", penanda, penandaAbt: penanda } };
      if (op === "abt.nilaiPenanda") return nilai ? { ok: true, data: { ok: true, nilai } } : { ok: false, error: "bot mati" };
      return { ok: false, error: "tidak dikenal" };
    });
  }
  const URL_TITIK = `?titik=1&folder=${encodeURIComponent("1 Perceraian CG")}&berkas=${encodeURIComponent("[01] A.rtf")}&perkaraId=10154&sidangKe=1`;

  it("hanya variabel daftar yang dinilai; yang kosong/masih titik dilaporkan dengan nama tampil, yang terisi tidak", async () => {
    pasangBot(["0001", "12034", "9325", "3615"], {
      "12034": { status: "terisi", teks: "Kesimpulan Pemohon:\n...\nKesimpulan Termohon:\n..." },
      "9325": { status: "kosong", teks: "" },
      "3615": { status: "terisi", teks: "Pegawai Pencatat Nikah telah menolak" },
    });
    const r = await ambil(URL_TITIK);
    expect(r.status).toBe(200);
    expect(r.isi.data).toEqual({
      ada: true,
      adaVariabel: true,
      titik: [
        { kode: "9325", nama: "Waktu dan tempat perkawinan" },
        { kode: "12034", nama: "Kesimpulan kedua pihak" },
      ],
    });
    const panggilan = bridge.mock.calls.find((c) => c[0] === "abt.nilaiPenanda")!;
    expect([...panggilan[1].penanda].sort()).toEqual(["12034", "3615", "9325"]);
  });

  it("blangko tanpa variabel itu: tidak ada panggilan nilai sama sekali, ditandai adaVariabel:false", async () => {
    pasangBot(["0001", "0046"], {});
    const r = await ambil(URL_TITIK);
    expect(r.isi.data).toEqual({ ada: true, adaVariabel: false, titik: [] });
    expect(bridge.mock.calls.some((c) => c[0] === "abt.nilaiPenanda")).toBe(false);
  });

  it("bot tidak menjawab nilai -> ada:false (bukan alarm palsu); tanpa kemampuan blangko-abt -> 403", async () => {
    pasangBot(["12034"], null);
    const r = await ambil(URL_TITIK);
    expect(r.isi.data).toEqual({ ada: false, adaVariabel: true, titik: [] });
    rute.izinBlangkoAbt = false;
    expect((await ambil(URL_TITIK)).status).toBe(403);
  });
});
