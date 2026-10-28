/**
 * 28 Okt 2026 - tampilan ALETA di SIPP dan portal ALETA TERSEMBUNYI BAWAAN (panel-alat.js 3c').
 *
 * Keputusan pengguna: ekstensi tidak tampak di SIPP dan portal ALETA kecuali dibutuhkan; fungsi dan fiturnya tidak mati.
 * Yang dijaga (perilaku):
 *   - SIPP dan portal: <html data-aleta-senyap> terpasang SEBELUM penyimpanan terbaca (tanpa kedipan) dan tetap sesudahnya;
 *   - ABT dan halaman lain tidak tersentuh; tampilan Lama tidak tersentuh (syarat mutlak fd9aad7);
 *   - saklar tetap per situs (tampilAletaHalaman) menampilkan; perubahan dari popup berlaku tanpa muat ulang;
 *   - pesan popup "aleta-tampil-tab" menampilkan/menyembunyikan untuk TAB INI (sessionStorage);
 *   - 28 Okt (keputusan pengguna): saklar situs juga di AKUN (setelan "tampil.halaman" di singgahan tampilanServer) -
 *     yang lebih baru antara peramban dan akun berlaku; Alt+Shift+A membalik saklar situs (peramban + PUT akun).
 *   - senyap 1 jam tetap menang atas tab yang ditampilkan; yang disembunyikan hanya tampilan (CSS senyap yang sama).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const AKAR = path.resolve(__dirname, "../../../ekstensi-sipp");
const sumberAlat = readFileSync(path.join(AKAR, "panel-alat.js"), "utf8").replace(/\r\n/g, "\n");

function jalankan(awal: Record<string, unknown>, alamat: { hostname: string; pathname: string }, sesi: Record<string, string> = {}) {
  const simpanan: Record<string, unknown> = { ...awal };
  const atribut = new Map<string, string>();
  const akar = {
    setAttribute: (n: string, v: string) => atribut.set(n, String(v)),
    removeAttribute: (n: string) => atribut.delete(n),
    getAttribute: (n: string) => (atribut.has(n) ? atribut.get(n)! : null),
    hasAttribute: (n: string) => atribut.has(n),
  };
  const tombol: Array<(e: any) => void> = [];
  const pesan: Array<(p: any, s: any, b: (x: any) => void) => unknown> = [];
  const ubahan: Array<(u: Record<string, { newValue: unknown }>, t: string) => void> = [];
  const permintaan: Array<{ url: string; method: string; body: string }> = [];
  const elemen = () => ({ setAttribute() {}, appendChild: (x: any) => x, classList: { add() {}, remove() {}, contains: () => false }, style: { setProperty() {} }, dataset: {}, addEventListener() {} });
  const k: any = {
    console, Date, JSON, Math, Number, String, Boolean, Array, Object, Promise, Error, Map, Set, RegExp,
    setTimeout: () => 0,
    clearTimeout() {},
    location: { ...alamat, search: "", href: `http://${alamat.hostname}${alamat.pathname}` },
    sessionStorage: { getItem: (x: string) => (x in sesi ? sesi[x] : null), setItem: (x: string, v: string) => void (sesi[x] = String(v)) },
    document: {
      documentElement: akar,
      createElement: elemen,
      querySelector: () => null,
      addEventListener: (jenis: string, f: (e: any) => void) => {
        if (jenis === "keydown") tombol.push(f);
      },
    },
    window: { addEventListener() {}, postMessage() {} },
    chrome: {
      runtime: { getManifest: () => ({ version: "1.205.52" }), onMessage: { addListener: (f: any) => pesan.push(f) } },
      storage: {
        onChanged: { addListener: (f: any) => ubahan.push(f) },
        local: {
          get: async (kunci: string[]) => {
            const h: Record<string, unknown> = {};
            for (const x of kunci) if (x in simpanan) h[x] = simpanan[x];
            return h;
          },
          set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, isi),
        },
      },
    },
    fetch: async (url: string, init?: { method?: string; body?: string }) => {
      permintaan.push({ url: String(url), method: init?.method ?? "GET", body: init?.body ?? "" });
      return { ok: true, status: 200, json: async () => ({}) };
    },
    navigator: {},
    Response: class {},
    AbortController: class {
      signal = {};
      abort() {}
    },
  };
  k.globalThis = k;
  vm.createContext(k);
  vm.runInContext(sumberAlat, k, { filename: "panel-alat.js" });
  const sembunyi = () => akar.getAttribute("data-aleta-senyap") === "ya";
  const tekan = (o: Record<string, unknown>) => {
    const e = { altKey: false, shiftKey: false, ctrlKey: false, metaKey: false, code: "", preventDefault() {}, ...o };
    for (const f of tombol) f(e);
  };
  const kirim = (p: unknown) => {
    let jawab: any;
    for (const f of pesan) f(p, {}, (x: any) => (jawab = jawab ?? x));
    return jawab;
  };
  const ubah = async (isi: Record<string, unknown>) => {
    Object.assign(simpanan, isi);
    for (const f of ubahan) f(Object.fromEntries(Object.entries(isi).map(([a, v]) => [a, { newValue: v }])), "local");
  };
  return { k, sembunyi, tekan, kirim, ubah, sesi, simpanan, permintaan };
}

const SIPP = { hostname: "192.168.10.10", pathname: "/SIPP/perkara" };
const SIPP_LOKAL = { hostname: "127.0.0.1", pathname: "/index.php/perkara" };
const PORTAL = { hostname: "192.168.10.10", pathname: "/aleta/jadwal-sidang" };
const ABT = { hostname: "192.168.10.10", pathname: "/aps_badilag/index.php/blangko" };
const UI = { ujiTampilan: "ui" };

async function siap(awal: Record<string, unknown>, alamat: { hostname: string; pathname: string }, sesi: Record<string, string> = {}) {
  const h = jalankan(awal, alamat, sesi);
  const sebelumTerbaca = h.sembunyi();
  await h.k.alatMuatUji();
  await h.k.alatMuatSenyap();
  return { ...h, sebelumTerbaca };
}

describe("bawaan: SIPP dan portal ALETA tersembunyi, situs lain tidak", () => {
  it("SIPP (server dan lokal) dan portal: tersembunyi sejak dimuat, juga sesudah penyimpanan terbaca", async () => {
    for (const alamat of [SIPP, SIPP_LOKAL, PORTAL]) {
      const h = await siap(UI, alamat);
      expect(h.sebelumTerbaca, alamat.pathname).toBe(true);
      expect(h.sembunyi(), alamat.pathname).toBe(true);
    }
  });

  it("ABT dan tampilan Lama tidak tersentuh", async () => {
    expect((await siap(UI, ABT)).sembunyi()).toBe(false);
    expect((await siap({ ujiTampilan: "lama" }, SIPP)).sembunyi()).toBe(false);
  });

  it("saklar tetap per situs menampilkan situs itu saja; perubahan dari popup berlaku tanpa muat ulang", async () => {
    expect((await siap({ ...UI, tampilAletaHalaman: { sipp: true } }, SIPP)).sembunyi()).toBe(false);
    expect((await siap({ ...UI, tampilAletaHalaman: { sipp: true } }, PORTAL)).sembunyi()).toBe(true);
    const h = await siap(UI, PORTAL);
    await h.ubah({ tampilAletaHalaman: { sipp: false, aleta: true } });
    expect(h.sembunyi()).toBe(false);
    await h.ubah({ tampilAletaHalaman: { sipp: false, aleta: false } });
    expect(h.sembunyi()).toBe(true);
  });
});

describe("ditampilkan bila dibutuhkan: per tab", () => {
  it("Alt+Shift+A membalik saklar situs: disimpan di peramban dan dikirim ke akun, melepas pilihan tab; tombol lain tidak", async () => {
    const h = await siap(UI, SIPP, { "aleta-tampil-tab": "tidak" });
    h.tekan({ altKey: true, code: "KeyA" });
    h.tekan({ ctrlKey: true, altKey: true, shiftKey: true, code: "KeyA" });
    expect(h.sembunyi()).toBe(true);
    expect(h.permintaan.filter((p) => p.method === "PUT")).toHaveLength(0);
    h.tekan({ altKey: true, shiftKey: true, code: "KeyA" });
    expect(h.sembunyi()).toBe(false);
    expect(h.sesi["aleta-tampil-tab"]).toBe("");
    expect(h.simpanan.tampilAletaHalaman).toMatchObject({ sipp: true, aleta: false });
    expect(typeof (h.simpanan.tampilAletaHalaman as { diubahPada?: unknown }).diubahPada).toBe("string");
    const put = h.permintaan.filter((p) => p.method === "PUT");
    expect(put).toHaveLength(1);
    expect(put[0].url).toBe("/aleta/api/aleta-ecourt/ekstensi/setelan");
    expect(JSON.parse(put[0].body)).toEqual({ kunci: "tampil.halaman", nilai: { sipp: true, aleta: false } });
    h.tekan({ altKey: true, shiftKey: true, code: "KeyA" });
    expect(h.sembunyi()).toBe(true);
    expect(h.simpanan.tampilAletaHalaman).toMatchObject({ sipp: false });
    expect(JSON.parse(h.permintaan.filter((p) => p.method === "PUT")[1].body).nilai).toEqual({ sipp: false, aleta: false });
  });

  it("akun menang bila lebih baru (masuk di PC lain); salinan peramban yang lebih baru menang (server tak terjangkau)", async () => {
    const akun = (sipp: boolean, pada: string) => ({ tampilanServer: { mode: "ui", fitur: {}, setelan: { "tampil.halaman": { nilai: { sipp }, diubahPada: pada } } } });
    // PC baru: tanpa salinan peramban, nilai akun berlaku.
    expect((await siap({ ...UI, ...akun(true, "2026-10-28T10:00:00.000Z") }, SIPP)).sembunyi()).toBe(false);
    // Salinan lama tanpa cap waktu (1.205.52) kalah dari akun.
    expect((await siap({ ...UI, ...akun(true, "2026-10-28T10:00:00.000Z"), tampilAletaHalaman: { sipp: false } }, SIPP)).sembunyi()).toBe(false);
    // Diubah di PC ini sesudah akun (belum terkirim): peramban menang.
    expect((await siap({ ...UI, ...akun(true, "2026-10-28T10:00:00.000Z"), tampilAletaHalaman: { sipp: false, diubahPada: "2026-10-28T11:00:00.000Z" } }, SIPP)).sembunyi()).toBe(true);
    // Akun berubah dari PC lain sesudahnya: berlaku tanpa muat ulang.
    const h = await siap({ ...UI, tampilAletaHalaman: { sipp: false, diubahPada: "2026-10-28T11:00:00.000Z" } }, SIPP);
    expect(h.sembunyi()).toBe(true);
    await h.ubah(akun(true, "2026-10-28T12:00:00.000Z"));
    expect(h.sembunyi()).toBe(false);
  });

  it("pilihan tab terbawa ke halaman SIPP berikutnya di tab yang sama, dan menang atas saklar situs", async () => {
    expect((await siap(UI, SIPP, { "aleta-tampil-tab": "ya" })).sembunyi()).toBe(false);
    expect((await siap({ ...UI, tampilAletaHalaman: { sipp: true } }, SIPP, { "aleta-tampil-tab": "tidak" })).sembunyi()).toBe(true);
  });

  it("pesan popup: tanpa nilai = menanyakan keadaan; tampil true/false menyetel tab ini", async () => {
    const h = await siap(UI, PORTAL);
    expect(h.kirim({ jenis: "aleta-tampil-tab" })).toEqual({ ok: true, situs: "aleta", tersembunyi: true });
    expect(h.kirim({ jenis: "aleta-tampil-tab", tampil: true })).toEqual({ ok: true, situs: "aleta", tersembunyi: false });
    expect(h.sembunyi()).toBe(false);
    expect(h.kirim({ jenis: "aleta-tampil-tab", tampil: false })).toEqual({ ok: true, situs: "aleta", tersembunyi: true });
    expect(h.kirim({ jenis: "lain" })).toBeUndefined();
  });

  it("senyap 1 jam tetap menyembunyikan walau tab ditampilkan", async () => {
    const h = await siap({ ...UI, ujiFitur: { "popup-12": true }, senyapSampai: Date.now() + 3600_000 }, SIPP, { "aleta-tampil-tab": "ya" });
    expect(h.sembunyi()).toBe(true);
  });

  it("ABT: pintasan dan pesan tidak dipasang", async () => {
    const h = await siap(UI, ABT);
    h.tekan({ altKey: true, shiftKey: true, code: "KeyA" });
    expect(h.sembunyi()).toBe(false);
    expect(h.kirim({ jenis: "aleta-tampil-tab", tampil: false })).toBeUndefined();
  });
});
