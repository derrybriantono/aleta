// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * K12 - PUTUSAN TERJADWAL: SATU TAB PER PC (rantai B, 25 Okt 2026)
 * ============================================================================
 *
 * putusan-terjadwal-peramban.js dijalankan SUNGGUHAN di jsdom bersama panel-alat.js dan
 * pengamat-bersama.js. Pekerja latar tiruan menjawab pertanyaan pemimpin. Yang dijaga:
 *   - saklar mati: tab selalu bertanya giliran ke portal (perilaku lama), tanpa menanyakan pemimpin;
 *   - saklar menyala dan tab BUKAN pemimpin: tidak ada permintaan giliran ke portal;
 *   - saklar menyala dan tab pemimpin: bertanya seperti biasa;
 *   - "Kerjakan sekarang" (paksa) tidak bergantung pada kepemimpinan;
 *   - pekerja latar tak menjawab: tetap bertanya (gagal-aman);
 *   - pewaktu 30 detik tetap berdetak di tab tersembunyi (hanya pemimpin yang bertanya).
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const ALAT = baca("panel-alat.js");
const HUB = baca("pengamat-bersama.js");
const PERAMBAN = baca("putusan-terjadwal-peramban.js");
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const NOMOR = "684/Pdt.G/2026/PA.Dgl";

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(30);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(o: { saklar: boolean; pemimpin?: boolean | "galat"; tersembunyi?: boolean }) {
  const dom = new JSDOM(
    `<!doctype html><html><head><title>SIPP</title></head><body><div id="konten"><p>Dashboard</p></div></body></html>`,
    { url: "http://192.168.10.10/SIPP/main", runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]
  );
  terbuka.push(dom);
  const w = dom.window as any;
  Object.defineProperty(w.document, "visibilityState", { get: () => (o.tersembunyi ? "hidden" : "visible"), configurable: true });
  const simpanan: Record<string, unknown> = { ujiTampilan: "ui", ujiIzinkanNyata: true };
  if (o.saklar) simpanan.tampilanServer = { kinerja: { pengamatTunggal: true } };
  const pesan: any[] = [];
  w.chrome = {
    runtime: {
      id: "uji",
      getManifest: () => ({ version: "1.205.39" }),
      getURL: (x: string) => x,
      sendMessage: async (p: any) => {
        pesan.push(p);
        if (o.pemimpin === "galat") throw new Error("latar mati");
        return { pemimpin: o.pemimpin !== false };
      },
    },
    storage: {
      local: {
        get: async (k?: string | string[]) => {
          const hasil: Record<string, unknown> = {};
          for (const n of [k].flat()) if (n != null && n in simpanan) hasil[n as string] = JSON.parse(JSON.stringify(simpanan[n as string]));
          return hasil;
        },
        set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, JSON.parse(JSON.stringify(isi))),
        remove: async (k: string | string[]) => void [k].flat().forEach((n) => delete simpanan[n]),
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  w.fetch = async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => "" });
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(HUB, ctx, { filename: "pengamat-bersama.js" });
  vm.runInContext(ALAT, ctx, { filename: "panel-alat.js" });
  vm.runInContext("alatSetelJedaSkala(0)", ctx);
  const giliran: string[] = [];
  Object.assign(w, {
    penggunaTerakhir: { nama: "Hakim Satu", peran: "Hakim" },
    boleh: () => true,
    cariNomorPerkara: () => "",
    namaPenggunaSipp: () => "Hakim Satu, S.H.",
    alatAmbil: async (alamat: string, opsi: any) => {
      const metode = String((opsi && opsi.method) || "GET").toUpperCase();
      if (metode === "GET") giliran.push(alamat);
      return { ok: true, status: 200, json: async () => ({ ok: true, data: { ada: false, alasan: "tidak_ada" } }) };
    },
  });
  vm.runInContext(PERAMBAN, ctx, { filename: "putusan-terjadwal-peramban.js" });
  return { w, giliran, pesan };
}
type H = ReturnType<typeof buka>;
const mod = (h: H) => h.w.aletaPutusanTerjadwalPeramban;
async function siap(h: H, saklar: boolean) {
  for (let i = 0; i < 200; i++) {
    if (typeof h.w.alatUjiMode === "function" && h.w.alatUjiMode() !== "lama" && (!saklar || h.w.ALETA_PENGAMAT.nyala())) return;
    await tunggu(10);
  }
  throw new Error("belum siap");
}

describe("putusan terjadwal: satu tab per PC", () => {
  it("saklar mati: tab bertanya giliran seperti dulu dan tidak menanyakan pemimpin", async () => {
    const h = buka({ saklar: false, pemimpin: false });
    await siap(h, false);
    const r = await mod(h).periksaSekarang();
    expect(r).toMatchObject({ alasan: "tidak_ada" });
    expect(h.giliran).toHaveLength(1);
    expect(h.pesan.filter((p) => p.jenis === "aleta-pemimpin")).toEqual([]);
  });

  it("saklar menyala, tab bukan pemimpin: tidak ada permintaan giliran ke portal", async () => {
    const h = buka({ saklar: true, pemimpin: false });
    await siap(h, true);
    const r = await mod(h).periksaSekarang();
    expect(r).toEqual({ diam: true, alasan: "bukan_pemimpin" });
    expect(h.giliran).toEqual([]);
    expect(h.pesan.find((p) => p.jenis === "aleta-pemimpin")).toMatchObject({ kunci: "putusan-terjadwal", terlihat: true });
    expect(mod(h).sedangBekerja()).toBe(false);
  });

  it("saklar menyala, tab pemimpin: bertanya giliran seperti biasa", async () => {
    const h = buka({ saklar: true, pemimpin: true });
    await siap(h, true);
    const r = await mod(h).periksaSekarang();
    expect(r).toMatchObject({ alasan: "tidak_ada" });
    expect(h.giliran).toHaveLength(1);
  });

  it("'Kerjakan sekarang' (paksa) tidak bergantung pada kepemimpinan", async () => {
    const h = buka({ saklar: true, pemimpin: false });
    await siap(h, true);
    await mod(h).periksaSekarang({ paksa: true });
    expect(h.giliran).toHaveLength(1);
  });

  it("pekerja latar tak menjawab: gagal-aman, tab tetap bertanya", async () => {
    const h = buka({ saklar: true, pemimpin: "galat" });
    await siap(h, true);
    await mod(h).periksaSekarang();
    expect(h.giliran).toHaveLength(1);
  });

  it("tab tersembunyi tetap boleh memimpin (kerja terjadwal tidak boleh terlewat karena tab di belakang)", async () => {
    const h = buka({ saklar: true, pemimpin: true, tersembunyi: true });
    await siap(h, true);
    await mod(h).periksaSekarang();
    expect(h.giliran).toHaveLength(1);
    expect(h.pesan.find((p) => p.jenis === "aleta-pemimpin")).toMatchObject({ terlihat: false });
  });
});
