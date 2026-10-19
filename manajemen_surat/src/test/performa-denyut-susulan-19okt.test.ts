// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { bolehTundaSusulan, tungguSenggang } from "@/lib/muat-susulan";
import { bacaBagianDenyut } from "@/server/modules/aleta-ecourt/denyut";

/**
 * Performa muat 19 Okt 2026 - K2 (denyut widget) dan K3 (muat susulan portal
 * ditunda). Rute denyut menjawab tiap bagian dengan pengendali rute lamanya
 * sendiri: di sini pengendali itu dipalsukan dan dicatat apa yang diterimanya.
 */

const panggilan: Array<{ nama: string; url: string; kuki: string }> = [];
const rekam = (nama: string, status: number, isi: unknown) =>
  vi.fn(async (q: NextRequest) => {
    panggilan.push({ nama, url: q.nextUrl.pathname + q.nextUrl.search, kuki: q.headers.get("cookie") || "" });
    await new Promise((r) => setTimeout(r, 20));
    return Response.json(isi, { status });
  });

vi.mock("@/app/api/aleta-ecourt/sumber-daya/route", () => ({ GET: rekam("sumberDaya", 200, { ok: true, data: { ringkas: 1 } }) }));
vi.mock("@/app/api/aleta-ecourt/antrian/kehadiran-saya/route", () => ({
  GET: rekam("kehadiran", 403, { ok: false, error: { message: "Peran Anda tidak diberi akses" } }),
}));
vi.mock("@/app/api/aleta-ecourt/checklist/route", () => ({ GET: rekam("checklist", 200, { ok: true, data: { butir: [] } }) }));
vi.mock("@/app/api/aleta-ecourt/sidang/disidang/route", () => ({ GET: rekam("disidang", 200, { ok: true, data: { baris: [] } }) }));

const { GET: denyut } = await import("@/app/api/aleta-ecourt/denyut/route");

describe("bacaBagianDenyut", () => {
  it("hanya bagian dikenal, tanpa ganda, urutan baku", () => {
    expect(bacaBagianDenyut("kehadiran,sumberDaya,kehadiran,hapusSemua")).toEqual(["sumberDaya", "kehadiran"]);
    expect(bacaBagianDenyut("")).toEqual([]);
    expect(bacaBagianDenyut(null)).toEqual([]);
  });
});

describe("GET /api/aleta-ecourt/denyut", () => {
  it("tiap bagian = jawaban rute lamanya (status + isi), dengan kuki yang sama, BERSAMAAN", async () => {
    panggilan.length = 0;
    const mulai = Date.now();
    const jawab = await denyut(
      new NextRequest("http://192.168.10.10/aleta/api/aleta-ecourt/denyut?bagian=sumberDaya,kehadiran,checklist&peran=hakim", {
        headers: { cookie: "better-auth.session_token=uji" },
      })
    );
    const lama = Date.now() - mulai;
    const isi = (await jawab.json()) as { ok: boolean; data: { denyut: number; bagian: Record<string, { status: number; isi: unknown }> } };
    expect(jawab.status).toBe(200);
    expect(isi.data.denyut).toBe(1);
    expect(isi.data.bagian.sumberDaya).toEqual({ status: 200, isi: { ok: true, data: { ringkas: 1 } } });
    // 403 satu bagian tidak menjatuhkan bagian lain.
    expect(isi.data.bagian.kehadiran.status).toBe(403);
    expect(isi.data.bagian.checklist.status).toBe(200);
    expect(isi.data.bagian.disidang).toBeUndefined();
    expect(panggilan.map((p) => p.nama).sort()).toEqual(["checklist", "kehadiran", "sumberDaya"]);
    expect(panggilan.every((p) => p.kuki === "better-auth.session_token=uji")).toBe(true);
    expect(panggilan.find((p) => p.nama === "checklist")!.url).toContain("peran=hakim");
    expect(panggilan.find((p) => p.nama === "kehadiran")!.url).toContain("/api/aleta-ecourt/antrian/kehadiran-saya");
    // Tiga bagian @20 ms bersamaan, bukan 60 ms berurutan.
    expect(lama).toBeLessThan(55);
  });

  it("tanpa bagian: jawaban kosong, tidak ada rute yang dipanggil", async () => {
    panggilan.length = 0;
    const jawab = await denyut(new NextRequest("http://192.168.10.10/aleta/api/aleta-ecourt/denyut"));
    const isi = (await jawab.json()) as { data: { bagian: Record<string, unknown> } };
    expect(isi.data.bagian).toEqual({});
    expect(panggilan).toHaveLength(0);
  });
});

describe("K3 - muat susulan ditunda", () => {
  it("hanya halaman ALETA e-Court / ALETA SIPP, dengan atau tanpa basePath", () => {
    expect(bolehTundaSusulan("/aleta/aleta-ecourt", "/aleta")).toBe(true);
    expect(bolehTundaSusulan("/aleta/aleta-ecourt/rekap-petugas", "/aleta")).toBe(true);
    expect(bolehTundaSusulan("/aleta-sipp?tab=1", "")).toBe(true);
    expect(bolehTundaSusulan("/aleta/surat", "/aleta")).toBe(false);
    expect(bolehTundaSusulan("/aleta/portal", "/aleta")).toBe(false);
    expect(bolehTundaSusulan("/aleta/aleta-ecourtx", "/aleta")).toBe(false);
  });

  it("tungguSenggang: tidak lebih cepat dari min, memakai requestIdleCallback, tidak lebih lambat dari maks", async () => {
    const catatan: string[] = [];
    const jendela = {
      setTimeout: (f: () => void, ms: number) => {
        catatan.push(`tunda ${ms}`);
        return setTimeout(f, 0);
      },
      requestIdleCallback: (f: () => void, opsi?: { timeout: number }) => {
        catatan.push(`senggang ${opsi?.timeout}`);
        setTimeout(f, 0);
        return 1;
      },
    };
    await tungguSenggang(jendela, 1200, 4000);
    expect(catatan[0]).toBe("tunda 1200");
    expect(catatan).toContain("senggang 2800");
  });

  it("tanpa requestIdleCallback: selesai sesudah min saja", async () => {
    const catatan: number[] = [];
    await tungguSenggang({ setTimeout: (f: () => void, ms: number) => (catatan.push(ms), setTimeout(f, 0)) }, 900, 3000);
    expect(catatan).toEqual([900]);
  });

  it("app-state: kerangka (identitas, panel, hak Blangko Saya) segera; surat/disposisi/setelan lain menyusul", () => {
    const sumber = readFileSync(path.resolve(__dirname, "../lib/app-state.tsx"), "utf8");
    const i = sumber.indexOf("async function syncSecondaryPortalData(");
    const badan = sumber.slice(i, sumber.indexOf("async function runSyncDataFromBackend", i));
    expect(badan).toContain('await syncSusulanPortal(actorUserId, syncGeneration, "semua")');
    expect(badan.indexOf('"kerangka")')).toBeLessThan(badan.indexOf("await tungguSenggang()"));
    expect(badan.indexOf("await tungguSenggang()")).toBeLessThan(badan.indexOf('"lain")'));
    for (const r of ["/api/settings/institution", "/api/settings/panel", "/api/hak-akses/saya"]) {
      expect(badan).toMatch(new RegExp(`kerangka \\? requestBackendJson<[^>]+>\\("${r.replace(/\//g, "\\/")}"`));
    }
    for (const r of ["/api/surat?pageSize=100", "/api/disposisi", "/api/ai/settings", "/api/settings/whatsapp", "/api/settings/assistant-judge"]) {
      expect(badan).toContain(`lain ? requestBackendJson`);
      expect(badan).toContain(`("${r}"`);
    }
    // Kelompok "lain" tidak menimpa hak Blangko Saya dengan null.
    expect(badan).toContain("if (kerangka) {");
  });
});
