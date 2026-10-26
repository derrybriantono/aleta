// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { gabungKonteksPerkara, versiBedaDiPcLain } from "@/lib/konteks-server";

/**
 * ============================================================================
 * U16 - PERKARA TERAKHIR DAN VERSI EKSTENSI MENGIKUTI PENGGUNA, SISI EKSTENSI (rantai B, 25 Okt 2026)
 * ============================================================================
 *   konteks-server.js    mati bawaan (tanpa satu permintaan pun); menyala: riwayat lokal digabung dengan salinan server dan
 *                        keduanya disamakan; 409 -> baca ulang dan gabung ulang; PC lain tidak ditimpa;
 *   konten.js            catatRiwayatPerkaraSipp memberi tahu modul sesudah riwayat lokal ditulis;
 *   popup-versi-pc.js    satu baris peringatan bila PC lain memakai versi berbeda; tersembunyi bila tidak ada/mati;
 *   satu aturan, dua salinan: gabung dan versiBeda JS = lib TS.
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const KONTEKS = baca("konteks-server.js");
const POPUP_JS = baca("popup-versi-pc.js");
const KONTEN = baca("konten.js");
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));

const terbuka: JSDOM[] = [];
afterEach(() => {
  while (terbuka.length) terbuka.pop()!.window.close();
});

const E = (n: number, menit: number) => ({
  nomor: `${n}/Pdt.G/2026/PA.Dgl`,
  url: `http://192.168.10.10/SIPP/perkara_detil_agama/AbC${n}==`,
  jenis: "Cerai Gugat",
  waktu: new Date(Date.UTC(2026, 9, 25, 3, 0, 0) - menit * 60000).toISOString(),
});

type Server = { setelan: Record<string, { nilai: unknown; diubahPada: string }>; put: any[]; get: number; bentrokSekali?: boolean; tolak?: boolean };
type Opsi = { saklar?: boolean; lokal?: unknown[]; server?: Server; versi?: string; url?: string };

function buka(o: Opsi = {}) {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { url: o.url ?? "http://192.168.10.10/SIPP/main", runScripts: "outside-only" } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpan: Record<string, unknown> = {};
  if (o.saklar) simpan.tampilanServer = { kinerja: { konteksDiServer: true } };
  if (o.lokal) simpan.riwayatPerkaraSipp = o.lokal;
  const server: Server = o.server ?? { setelan: {}, put: [], get: 0 };
  w.chrome = {
    runtime: { getManifest: () => ({ version: o.versi ?? "1.205.39" }), sendMessage: async () => ({}) },
    storage: {
      local: {
        get: async (k: string | string[]) => Object.fromEntries([k].flat().filter((n) => n in simpan).map((n) => [n, JSON.parse(JSON.stringify(simpan[n]))])),
        set: async (isi: Record<string, unknown>) => void Object.assign(simpan, JSON.parse(JSON.stringify(isi))),
      },
      onChanged: { addListener: () => undefined },
    },
  };
  const jawab = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => ({ ok: status < 400, data }) });
  w.alatAmbil = async (alamat: string, opsi: any) => {
    const metode = String((opsi && opsi.method) || "GET").toUpperCase();
    if (metode === "GET") {
      server.get += 1;
      return jawab({ setelan: JSON.parse(JSON.stringify(server.setelan)) });
    }
    const b = JSON.parse(opsi.body);
    server.put.push(b);
    if (server.tolak) return jawab({}, 500);
    const lama = server.setelan[b.kunci];
    if (server.bentrokSekali) {
      server.bentrokSekali = false;
      // PC lain menulis lebih dulu
      server.setelan[b.kunci] = { nilai: b.kunci === "konteks.perkara" ? [E(77, 0)] : (lama ? lama.nilai : {}), diubahPada: "2026-10-25T02:59:59.000Z" };
      return jawab({ pesan: "diubah dari PC lain" }, 409);
    }
    if (b.jikaDiubahPada !== (lama ? lama.diubahPada : "")) return jawab({ pesan: "diubah dari PC lain" }, 409);
    server.setelan[b.kunci] = { nilai: b.nilai, diubahPada: new Date(Date.UTC(2026, 9, 25, 3, 0, server.put.length)).toISOString() };
    return jawab({ kunci: b.kunci });
  };
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(KONTEKS, ctx, { filename: "konteks-server.js" });
  return { w, simpan, server, K: w.ALETA_KONTEKS_SERVER, ctx };
}

describe("konteks-server.js", () => {
  it("saklar mati (bawaan): tidak ada satu permintaan pun; riwayat lokal tidak disentuh", async () => {
    const h = buka({ saklar: false, lokal: [E(1, 5)] });
    await h.K.tungguSiap();
    expect(h.K.aktif()).toBe(false);
    expect(await h.K.selaraskan()).toEqual({ ok: false, lokalBerubah: false, serverBerubah: false });
    expect(await h.K.laporVersi()).toBe(false);
    h.K.catat();
    expect(h.server.get).toBe(0);
    expect(h.server.put).toEqual([]);
    expect(h.simpan.riwayatPerkaraSipp).toEqual([E(1, 5)]);
  });

  it("menggabung riwayat lokal dengan salinan server: lokal mendapat perkara dari PC lain (maks 8), server mendapat milik PC ini (maks 12)", async () => {
    const lokal = [E(1, 1), E(2, 2)];
    const serverEntri = [E(3, 3), E(4, 4), E(5, 5), E(6, 6), E(7, 7), E(8, 8), E(9, 9), E(10, 10), E(11, 11), E(12, 12)];
    const h = buka({ saklar: true, lokal, server: { setelan: { "konteks.perkara": { nilai: serverEntri, diubahPada: "2026-10-25T02:00:00.000Z" } }, put: [], get: 0 } });
    const r = await h.K.selaraskan();
    expect(r).toEqual({ ok: true, lokalBerubah: true, serverBerubah: true });
    const dipakai = h.simpan.riwayatPerkaraSipp as Array<{ nomor: string }>;
    expect(dipakai).toHaveLength(8);
    expect(dipakai.map((x) => x.nomor.split("/")[0])).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
    const tersimpan = h.server.setelan["konteks.perkara"].nilai as Array<{ nomor: string }>;
    expect(tersimpan).toHaveLength(12);
    expect(tersimpan.map((x) => x.nomor.split("/")[0])).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]);
    expect(h.server.put[0]).toMatchObject({ kunci: "konteks.perkara", jikaDiubahPada: "2026-10-25T02:00:00.000Z" });
    // selaras: dijalankan lagi tidak menulis apa pun
    const lagi = await h.K.selaraskan();
    expect(lagi).toEqual({ ok: true, lokalBerubah: false, serverBerubah: false });
    expect(h.server.put).toHaveLength(1);
  });

  it("penulisan pertama (server belum punya) memakai jikaDiubahPada kosong; hanya nomor/pintu masuk/jenis/waktu yang dikirim", async () => {
    const h = buka({ saklar: true, lokal: [{ ...E(1, 1), nik: "7203090101900001", pihak: "Rahasia" }] });
    await h.K.selaraskan();
    expect(h.server.put[0].jikaDiubahPada).toBe("");
    expect(Object.keys(h.server.put[0].nilai[0]).sort()).toEqual(["jenis", "nomor", "url", "waktu"]);
    expect(JSON.stringify(h.server.put)).not.toMatch(/7203090101900001|Rahasia/);
  });

  it("409 (PC lain menulis lebih dulu): dibaca ulang, digabung ulang, dan hasil PC lain tidak hilang", async () => {
    const h = buka({
      saklar: true,
      lokal: [E(1, 1)],
      server: { setelan: { "konteks.perkara": { nilai: [E(3, 3)], diubahPada: "2026-10-25T02:00:00.000Z" } }, put: [], get: 0, bentrokSekali: true },
    });
    const r = await h.K.selaraskan();
    expect(r.ok).toBe(true);
    expect(h.server.put).toHaveLength(2);
    const akhir = (h.server.setelan["konteks.perkara"].nilai as Array<{ nomor: string }>).map((x) => x.nomor.split("/")[0]);
    expect(akhir).toEqual(expect.arrayContaining(["1", "77"]));
    expect((h.simpan.riwayatPerkaraSipp as Array<{ nomor: string }>).map((x) => x.nomor.split("/")[0])).toEqual(expect.arrayContaining(["1", "77"]));
  });

  it("portal menolak/galat: gagal-aman (ok:false), riwayat lokal utuh, tidak melempar", async () => {
    const h = buka({ saklar: true, lokal: [E(1, 1)], server: { setelan: {}, put: [], get: 0, tolak: true } });
    expect((await h.K.selaraskan()).ok).toBe(false);
    expect(h.simpan.riwayatPerkaraSipp).toEqual([E(1, 1)]);
    const putus = buka({ saklar: true, lokal: [E(1, 1)] });
    putus.w.alatAmbil = async () => Promise.reject(new Error("putus"));
    expect((await putus.K.selaraskan()).ok).toBe(false);
    expect(await putus.K.laporVersi()).toBe(false);
  });

  it("laporVersi: mencatat id PC + versi; tidak mengulang dalam 6 jam untuk versi yang sama; versi baru langsung dilaporkan", async () => {
    const h = buka({ saklar: true });
    expect(await h.K.laporVersi()).toBe(true);
    expect(h.server.put).toHaveLength(1);
    const id = h.K.idPerangkat();
    expect(id).toMatch(/^pc/);
    const peta = h.server.setelan["perangkat.versi"].nilai as Record<string, { versi: string }>;
    expect(peta[id].versi).toBe("1.205.39");
    expect(await h.K.laporVersi()).toBe(true);
    expect(h.server.put).toHaveLength(1);
    h.w.chrome.runtime.getManifest = () => ({ version: "1.205.40" });
    expect(await h.K.laporVersi()).toBe(true);
    expect(h.server.put).toHaveLength(2);
    expect((h.server.setelan["perangkat.versi"].nilai as Record<string, { versi: string }>)[id].versi).toBe("1.205.40");
  });

  it("laporVersi menjaga PC lain di peta dan menyingkirkan yang paling lama melapor bila melebihi 8", async () => {
    const peta: Record<string, unknown> = {};
    for (let i = 0; i < 8; i += 1) peta[`pc-lain${i}`] = { versi: "1.205.38", waktu: new Date(Date.UTC(2026, 9, 1 + i)).toISOString(), nama: "" };
    const h = buka({ saklar: true, server: { setelan: { "perangkat.versi": { nilai: peta, diubahPada: "2026-10-20T00:00:00.000Z" } }, put: [], get: 0 } });
    await h.K.laporVersi({ paksa: true });
    const hasil = h.server.setelan["perangkat.versi"].nilai as Record<string, unknown>;
    expect(Object.keys(hasil)).toHaveLength(8);
    expect(Object.keys(hasil)).toContain(h.K.idPerangkat());
    expect(Object.keys(hasil)).not.toContain("pc-lain0");
    expect(Object.keys(hasil)).toContain("pc-lain7");
  });

  it("catat() menunda penyelarasan (digabung), tidak langsung mengirim", async () => {
    const h = buka({ saklar: true, lokal: [E(1, 1)] });
    await h.K.tungguSiap();
    h.K.catat();
    h.K.catat();
    await tunggu(30);
    expect(h.server.get).toBe(0);
  });

  it("aturan sama dengan lib TS: gabung dan versiBeda untuk masukan yang sama", async () => {
    const h = buka({ saklar: true });
    const a = [E(1, 10), E(2, 5), { nomor: "", url: "x", waktu: "x" }];
    const b = [E(1, 1), E(3, 20), null];
    expect(h.K.murni.gabung(a, b, 3)).toEqual(gabungKonteksPerkara(a, b, 3));
    const peta = {
      "pc-ini": { versi: "1.205.38", waktu: "2026-10-25T01:00:00Z" },
      "pc-a": { versi: "1.205.39", waktu: "2026-10-23T01:00:00Z" },
      "pc-b": { versi: "1.205.39", waktu: "2026-10-24T01:00:00Z" },
      "pc-c": { versi: "1.100.1", waktu: "2026-06-01T01:00:00Z" },
    };
    const sekarang = new Date("2026-10-25T03:00:00Z");
    expect(h.K.murni.versiBeda(peta, "pc-ini", "1.205.38", sekarang.getTime())).toEqual(versiBedaDiPcLain(peta, "pc-ini", "1.205.38", sekarang));
  });
});

describe("konten.js: catatRiwayatPerkaraSipp memberi tahu modul konteks sesudah menulis riwayat lokal", () => {
  const awal = KONTEN.indexOf("async function catatRiwayatPerkaraSipp(");
  const fungsi = KONTEN.slice(awal, KONTEN.indexOf("\n}\n", awal) + 3);

  function jalankan(modul: unknown) {
    const simpan: Record<string, unknown> = {};
    const lingkup: Record<string, unknown> = {
      KUNCI_RIWAYAT_SIPP: "riwayatPerkaraSipp",
      alamatHalamanPerkara: () => true,
      alamatMasukPerkara: () => "http://192.168.10.10/SIPP/perkara_detil_agama/AbC1==",
      location: { href: "http://192.168.10.10/SIPP/x" },
      chrome: { storage: { local: { get: async () => ({}), set: async (i: Record<string, unknown>) => void Object.assign(simpan, i) } } },
      globalThis: { ALETA_KONTEKS_SERVER: modul },
    };
    const f = new Function(...Object.keys(lingkup), `${fungsi}; return catatRiwayatPerkaraSipp;`)(...Object.values(lingkup)) as (n: string, k: unknown) => Promise<void>;
    return { f, simpan };
  }

  it("ada modul: catat() dipanggil sekali sesudah set lokal; tanpa modul: riwayat lokal saja seperti dulu", async () => {
    let n = 0;
    const a = jalankan({ catat: () => void n++ });
    await a.f("684/Pdt.G/2026/PA.Dgl", { identitas: { jenisPerkara: "Cerai Gugat" } });
    expect(n).toBe(1);
    expect((a.simpan.riwayatPerkaraSipp as Array<{ nomor: string }>)[0].nomor).toBe("684/Pdt.G/2026/PA.Dgl");
    const b = jalankan(undefined);
    await b.f("685/Pdt.G/2026/PA.Dgl", {});
    expect((b.simpan.riwayatPerkaraSipp as Array<{ nomor: string }>)[0].nomor).toBe("685/Pdt.G/2026/PA.Dgl");
  });
});

describe("popup-versi-pc.js", () => {
  function popup(o: { aktif?: boolean; peta?: unknown; versi?: string; idPc?: string }) {
    const dom = new JSDOM(
      `<!doctype html><html><body><div id="versiPcLainBaris" hidden><span id="versiPcLain"></span></div></body></html>`,
      { url: "chrome-extension://abc/popup.html", runScripts: "outside-only" } as ConstructorParameters<typeof JSDOM>[1]
    );
    terbuka.push(dom);
    const w = dom.window as any;
    const simpan: Record<string, unknown> = {
      tampilanServer: { kinerja: o.aktif ? { konteksDiServer: true } : {}, setelan: o.peta ? { "perangkat.versi": { nilai: o.peta, diubahPada: "x" } } : {} },
      idPerangkatAntrean: o.idPc ?? "pc-ini",
    };
    w.chrome = {
      runtime: { getManifest: () => ({ version: o.versi ?? "1.205.39" }) },
      storage: { local: { get: async (k: string[]) => Object.fromEntries([k].flat().filter((n) => n in simpan).map((n) => [n, simpan[n]])) }, onChanged: { addListener: () => undefined } },
    };
    const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
    vm.runInContext(KONTEKS, ctx, { filename: "konteks-server.js" });
    vm.runInContext(POPUP_JS, ctx, { filename: "popup-versi-pc.js" });
    return w.document as Document;
  }
  const sekarangIso = () => new Date().toISOString();

  it("PC lain memakai versi berbeda dan saklar menyala: baris tampil dengan versi dan jumlah PC", async () => {
    const d = popup({ aktif: true, peta: { "pc-ini": { versi: "1.205.39", waktu: sekarangIso() }, "pc-a": { versi: "1.205.38", waktu: sekarangIso() }, "pc-b": { versi: "1.205.38", waktu: sekarangIso() } } });
    await tunggu(30);
    expect(d.getElementById("versiPcLainBaris")!.hidden).toBe(false);
    const teks = d.getElementById("versiPcLain")!.textContent!;
    expect(teks).toContain("1.205.38 (2 PC)");
    expect(teks).toContain("1.205.39");
  });

  it("tersembunyi: saklar mati, tidak ada data, atau semua PC lain sama", async () => {
    for (const o of [
      { aktif: false, peta: { "pc-a": { versi: "1.205.38", waktu: sekarangIso() } } },
      { aktif: true },
      { aktif: true, peta: { "pc-a": { versi: "1.205.39", waktu: sekarangIso() } } },
      { aktif: true, peta: { "pc-ini": { versi: "1.205.30", waktu: sekarangIso() } } },
    ]) {
      const d = popup(o);
      await tunggu(30);
      expect(d.getElementById("versiPcLainBaris")!.hidden).toBe(true);
    }
  });
});

describe("terpasang di manifest dan popup", () => {
  const manifest = JSON.parse(baca("manifest.json"));
  it("konteks-server.js dimuat di blok SIPP dan portal; popup memuatnya sebelum popup-versi-pc.js", () => {
    const kelompok = manifest.content_scripts.filter((c: any) => c.js.includes("konteks-server.js"));
    expect(kelompok).toHaveLength(2);
    expect(kelompok.some((c: any) => c.js.includes("konten.js"))).toBe(true);
    expect(kelompok.some((c: any) => c.js.includes("aleta.js"))).toBe(true);
    const html = baca("popup.html");
    expect(html.indexOf("konteks-server.js")).toBeGreaterThan(0);
    expect(html.indexOf("konteks-server.js")).toBeLessThan(html.indexOf("popup-versi-pc.js"));
    expect(html).toContain('id="versiPcLainBaris"');
  });
});
