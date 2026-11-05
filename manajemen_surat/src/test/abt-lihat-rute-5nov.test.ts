// @vitest-environment node
/** Tombol Lihat di naskah (5 Nov 2026): penanda hanya untuk Super Admin, dan mesin hanya menaruhnya bila diminta. */
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


import { createRequire } from "node:module";
import path from "node:path";

const mesinAbt = createRequire(import.meta.url)(path.join(process.cwd(), "../aleta_bot/services/abtMesinVariabel.js"));
const JAWAB = { ok: true, data: { ok: true, berkas: "a.rtf", rtfBase64: Buffer.from("{\\rtf1 x}").toString("base64"), jumlahTerisi: 1, kosong: [] } };

describe("rute pratinjau: tandaLihat", () => {
  it("Super Admin yang meminta mendapat penanda", async () => {
    rute.aktor = { id: "u1", name: "X", roleId: "super-admin" };
    bridge.mockResolvedValue(JAWAB);
    const j = await kirim({ ...BADAN, tandaLihat: true });
    expect(j.status).toBe(200);
    expect(bridge.mock.calls[0][1]).toMatchObject({ tandaLihat: true, segar: true });
  });
  it("Super Admin yang tidak meminta tidak mendapat penanda", async () => {
    rute.aktor = { id: "u1", name: "X", roleId: "super-admin" };
    bridge.mockResolvedValue(JAWAB);
    await kirim({ ...BADAN });
    expect(bridge.mock.calls[0][1]).not.toHaveProperty("tandaLihat");
  });
  it("akun lain yang meminta diabaikan, termasuk Admin biasa", async () => {
    for (const roleId of ["hakim", "admin"]) {
      bridge.mockReset();
      rute.aktor = { id: "u1", name: "X", roleId };
      bridge.mockResolvedValue(JAWAB);
      await kirim({ ...BADAN, tandaLihat: true });
      expect(bridge.mock.calls[0][1], roleId).not.toHaveProperty("tandaLihat");
    }
  });
});

describe("mesin isian: penanda hanya bila diminta", () => {
  const katalog = [
    { no_var: "7001", nama: "Teks", data_type: "data_sql", sql_query: 'select "nilai" as data' },
    { no_var: "7002", nama: "Induk", data_type: "data_sql", sql_query: 'select "awal #7001# akhir" as data' },
    { no_var: "7003", nama: "Kosong", data_type: "data_sql", sql_query: 'select "" as data' },
  ];
  const kueri = async (sql: string) => {
    if (/abt_variabel/.test(sql)) return katalog;
    const m = /select "([^"]*)" as data/.exec(sql);
    return m && m[1] ? [{ data: m[1] }] : [];
  };
  it("tanpa permintaan naskah tidak berubah", async () => {
    const h = await mesinAbt.buatMesin({ kueri }).isiRtf("{\\rtf1 A #7001# B}", { perkaraId: "1" });
    expect(h.rtf).not.toContain("~~");
    expect(h.rtf).toContain("nilai");
  });
  it("diminta: hasil dan isian kosong diapit penanda, dan penanda selalu berpasangan", async () => {
    const h = await mesinAbt.buatMesin({ kueri }).isiRtf("{\\rtf1 A #7001# B #7003# C #7001#}", { perkaraId: "1", tandaLihat: true });
    expect(h.rtf.match(/~~ALV:7001~~/g)).toHaveLength(2);
    expect(h.rtf.match(/~~ALV:7003~~/g)).toHaveLength(1);
    expect(h.rtf.match(/~~ALV:\d+~~/g)!.length).toBe(h.rtf.match(/~~\/ALV~~/g)!.length);
    expect(h.rtf).toContain("~~ALV:7001~~nilai~~/ALV~~");
    expect(h.rtf).not.toMatch(/#\d{4}#/);
  });
});
