// @vitest-environment node
/**
 * Widget SIPP/ABT lewat port 8008 dengan cadangan port 80 (K7, rantai F2, 25 Okt 2026).
 *
 *   A. portal: kepala CORS MATI bawaan; menyala hanya untuk asal yang terdaftar, jalur /api/,
 *      dan permintaan yang masuk lewat port tambahan; pra-pemeriksaan dijawab 204;
 *   B. proxy sungguhan (NextRequest): kontrak dengan jalur uji milik ekstensi;
 *   C. ekstensi (vm): hanya GET/HEAD ke /aleta/api/ berpindah, tulisan tetap di port 80,
 *      gagal jaringan/404/502/503/504 diulang di port 80, galat 401 dan pembatalan tidak.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { portPortalTambahan } from "@/lib/auth";
import { asalWidgetDiizinkan, keputusanCors, portTambahan } from "@/lib/cors-widget";
import { proxy } from "@/proxy";

const AKAR = path.resolve(process.cwd(), "..");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");

const simpanEnv = { ...process.env };
beforeEach(() => {
  delete process.env.ALETA_CORS_ASAL_WIDGET;
  delete process.env.ALETA_PORT_PORTAL_TAMBAHAN;
});
afterEach(() => {
  for (const k of ["ALETA_CORS_ASAL_WIDGET", "ALETA_PORT_PORTAL_TAMBAHAN"]) {
    if (simpanEnv[k] === undefined) delete process.env[k];
    else process.env[k] = simpanEnv[k];
  }
});

const ASAL_SIPP = "http://192.168.10.10";
const dasar = { metode: "GET", asal: ASAL_SIPP, host: "192.168.10.10:8008", jalur: "/api/aleta-bot/sipp-konteks", mintaMetode: null, mintaKepala: null };

describe("A. CORS widget di portal", () => {
  it("MATI bawaan: tanpa ALETA_CORS_ASAL_WIDGET tidak ada kepala CORS sama sekali", () => {
    expect(asalWidgetDiizinkan({})).toEqual([]);
    expect(keputusanCors(dasar, {})).toBeNull();
    expect(keputusanCors({ ...dasar, metode: "OPTIONS", mintaMetode: "GET" }, {})).toBeNull();
  });

  it("menyala: asal terdaftar lewat port 8008 pada jalur /api/ mendapat kepala dengan kuki diizinkan", () => {
    const env = { ALETA_CORS_ASAL_WIDGET: "http://192.168.10.10/ , http://127.0.0.1 " };
    expect(asalWidgetDiizinkan(env)).toEqual(["http://192.168.10.10", "http://127.0.0.1"]);
    const k = keputusanCors(dasar, env)!;
    expect(k.jawabLangsung).toBe(false);
    expect(k.headers).toEqual({ "Access-Control-Allow-Origin": ASAL_SIPP, "Access-Control-Allow-Credentials": "true", Vary: "Origin" });
  });

  it("tidak pernah '*', dan ditolak untuk asal lain, port 80, jalur bukan /api/, atau tanpa Origin", () => {
    const env = { ALETA_CORS_ASAL_WIDGET: ASAL_SIPP };
    expect(keputusanCors({ ...dasar, asal: "http://10.0.0.5" }, env)).toBeNull();
    expect(keputusanCors({ ...dasar, asal: null }, env)).toBeNull();
    expect(keputusanCors({ ...dasar, host: "192.168.10.10" }, env)).toBeNull(); // port 80
    expect(keputusanCors({ ...dasar, host: "192.168.10.10:8056" }, env)).toBeNull(); // bukan port tambahan
    expect(keputusanCors({ ...dasar, jalur: "/aleta-ecourt" }, env)).toBeNull();
    expect(asalWidgetDiizinkan({ ALETA_CORS_ASAL_WIDGET: "*" })).toEqual([]);
  });

  it("port tambahan mengikuti ALETA_PORT_PORTAL_TAMBAHAN yang sama dengan Better Auth", () => {
    for (const nilai of [undefined, "", "8008", "8008,9090", "80,443,abc,8123"]) {
      const env = nilai === undefined ? {} : { ALETA_PORT_PORTAL_TAMBAHAN: nilai };
      if (nilai === undefined) delete process.env.ALETA_PORT_PORTAL_TAMBAHAN;
      else process.env.ALETA_PORT_PORTAL_TAMBAHAN = nilai;
      expect(portTambahan(env)).toEqual(portPortalTambahan());
    }
    expect(keputusanCors({ ...dasar, host: "192.168.10.10:9090" }, { ALETA_CORS_ASAL_WIDGET: ASAL_SIPP, ALETA_PORT_PORTAL_TAMBAHAN: "8008,9090" })).not.toBeNull();
  });

  it("pra-pemeriksaan dijawab langsung: hanya GET/HEAD/OPTIONS, kepala diminta disaring", () => {
    const env = { ALETA_CORS_ASAL_WIDGET: ASAL_SIPP };
    const k = keputusanCors({ ...dasar, metode: "OPTIONS", mintaMetode: "GET", mintaKepala: "x-aleta-token, accept,<script>, content-type" }, env)!;
    expect(k.jawabLangsung).toBe(true);
    expect(k.headers["Access-Control-Allow-Methods"]).toBe("GET, HEAD, OPTIONS");
    expect(k.headers["Access-Control-Allow-Methods"]).not.toMatch(/POST|PUT|DELETE|PATCH/);
    expect(k.headers["Access-Control-Allow-Headers"]).toBe("x-aleta-token, accept, content-type");
    const tanpa = keputusanCors({ ...dasar, metode: "OPTIONS", mintaMetode: "GET" }, env)!;
    expect(tanpa.headers["Access-Control-Allow-Headers"]).toBe("Content-Type, Accept");
  });
});

function minta(url: string, init: { method?: string; headers?: Record<string, string> } = {}) {
  return new NextRequest(url, init);
}

describe("B. proxy sungguhan", () => {
  it("bawaan (env kosong): jawaban tidak memuat kepala CORS, kepala keamanan lama tetap ada", () => {
    const r = proxy(minta("http://192.168.10.10:8008/aleta/api/install", { headers: { origin: ASAL_SIPP, host: "192.168.10.10:8008" } }));
    expect(r.headers.get("access-control-allow-origin")).toBeNull();
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("cache-control")).toContain("no-store");
  });

  it("menyala: probe ekstensi (/aleta/api/install dengan asal SIPP lewat 8008) mendapat izin; lewat port 80 tidak", () => {
    process.env.ALETA_CORS_ASAL_WIDGET = ASAL_SIPP;
    const via8008 = proxy(minta("http://192.168.10.10:8008/aleta/api/install", { headers: { origin: ASAL_SIPP, host: "192.168.10.10:8008", "x-forwarded-host": "192.168.10.10:8008" } }));
    expect(via8008.headers.get("access-control-allow-origin")).toBe(ASAL_SIPP);
    expect(via8008.headers.get("access-control-allow-credentials")).toBe("true");
    expect(via8008.headers.get("vary")).toContain("Origin");
    expect(via8008.headers.get("x-content-type-options")).toBe("nosniff");
    const via80 = proxy(minta("http://192.168.10.10/aleta/api/install", { headers: { origin: ASAL_SIPP, host: "192.168.10.10" } }));
    expect(via80.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("menyala: pra-pemeriksaan OPTIONS dijawab 204 tanpa meneruskan ke rute", () => {
    process.env.ALETA_CORS_ASAL_WIDGET = ASAL_SIPP;
    const r = proxy(
      minta("http://192.168.10.10:8008/aleta/api/aleta-bot/sipp-konteks?nomor=1", {
        method: "OPTIONS",
        headers: { origin: ASAL_SIPP, host: "192.168.10.10:8008", "access-control-request-method": "GET", "access-control-request-headers": "accept" },
      })
    );
    expect(r.status).toBe(204);
    expect(r.headers.get("access-control-allow-origin")).toBe(ASAL_SIPP);
    expect(r.headers.get("access-control-allow-methods")).toBe("GET, HEAD, OPTIONS");
  });

  it("menyala tetapi asal asing: tidak ada izin", () => {
    process.env.ALETA_CORS_ASAL_WIDGET = ASAL_SIPP;
    const r = proxy(minta("http://192.168.10.10:8008/aleta/api/install", { headers: { origin: "http://situs-lain.test", host: "192.168.10.10:8008" } }));
    expect(r.headers.get("access-control-allow-origin")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// C. ekstensi
// ---------------------------------------------------------------------------
type Panggilan = { url: string; init?: Record<string, unknown> };
type Jawab = (p: Panggilan) => Promise<{ ok: boolean; status: number }> | { ok: boolean; status: number };

function muatShim(opsi: { lokasi?: Record<string, string>; jawab: Jawab }) {
  const panggilan: Panggilan[] = [];
  const penyimpanan: Record<string, string> = {};
  const lokasi = { protocol: "http:", hostname: "192.168.10.10", port: "", pathname: "/SIPP/perkara", ...opsi.lokasi };
  const ruang: Record<string, unknown> = {
    setTimeout,
    clearTimeout,
    AbortController,
    location: lokasi,
    sessionStorage: {
      getItem: (k: string) => (k in penyimpanan ? penyimpanan[k] : null),
      setItem: (k: string, v: string) => void (penyimpanan[k] = v),
    },
    fetch: async (url: string, init?: Record<string, unknown>) => {
      panggilan.push({ url, init });
      return opsi.jawab({ url, init });
    },
  };
  ruang.globalThis = ruang;
  vm.createContext(ruang);
  vm.runInContext(baca("ekstensi-sipp/portal-jalur.js"), ruang, { filename: "portal-jalur.js" });
  const fetchBungkus = ruang.fetch as (url: unknown, init?: Record<string, unknown>) => Promise<{ ok: boolean; status: number }>;
  return { fetch: fetchBungkus, panggilan, penyimpanan, api: ruang.AletaJalurPortal as Record<string, any>, ruang };
}

const tunggu = (ms = 5) => new Promise((r) => setTimeout(r, ms));
const sehat: Jawab = () => ({ ok: true, status: 200 });

describe("C. ekstensi: jalur cepat ke 8008 dengan cadangan port 80", () => {
  it("halaman yang tidak layak tidak dibungkus: port selain 80, host lain, halaman ALETA, https", () => {
    const kasus: Array<Record<string, string>> = [
      { port: "8056" },
      { hostname: "127.0.0.1" },
      { pathname: "/aleta/jadwal" },
      { protocol: "https:" },
    ];
    for (const lokasi of kasus) {
      const s = muatShim({ lokasi, jawab: sehat });
      expect(s.api.layak()).toBe(false);
      expect((s.ruang.fetch as { __aletaJalurCepat?: boolean }).__aletaJalurCepat).toBeUndefined();
    }
    const ok = muatShim({ jawab: sehat });
    expect(ok.api.layak()).toBe(true);
    expect((ok.ruang.fetch as { __aletaJalurCepat?: boolean }).__aletaJalurCepat).toBe(true);
  });

  it("permintaan PERTAMA tetap ke port 80 sambil menguji 8008; sesudah terbukti, GET/HEAD pindah dengan kuki", async () => {
    const s = muatShim({ jawab: sehat });
    await s.fetch("/aleta/api/aleta-bot/sipp-konteks?nomor=1", { headers: { Accept: "application/json" } });
    await tunggu();
    // permintaan asli dan uji berangkat bersamaan; urutannya tidak penting
    expect(s.panggilan.map((p) => p.url).sort()).toEqual(
      ["/aleta/api/aleta-bot/sipp-konteks?nomor=1", "http://192.168.10.10:8008/aleta/api/install"].sort()
    );
    expect(s.panggilan.find((p) => p.url.endsWith(":8008/aleta/api/install"))!.init).toMatchObject({ credentials: "include", mode: "cors" });
    expect(JSON.parse(s.penyimpanan["aleta-jalur-cepat"]).hidup).toBe(true);

    s.panggilan.length = 0;
    await s.fetch("/aleta/api/aleta-bot/sipp-konteks?nomor=2", { headers: { Accept: "application/json" }, credentials: "same-origin" });
    await s.fetch("/aleta/api/aleta-bot/sipp-konteks?nomor=3", { method: "HEAD" });
    expect(s.panggilan.map((p) => p.url)).toEqual([
      "http://192.168.10.10:8008/aleta/api/aleta-bot/sipp-konteks?nomor=2",
      "http://192.168.10.10:8008/aleta/api/aleta-bot/sipp-konteks?nomor=3",
    ]);
    // kuki ikut walau pemanggil menulis same-origin; kepala pemanggil dipertahankan
    expect(s.panggilan[0].init).toMatchObject({ credentials: "include", mode: "cors", headers: { Accept: "application/json" } });
  });

  it("tulisan dan yang bukan /aleta/api/ TIDAK pernah dipindah, juga saat 8008 hidup", async () => {
    const s = muatShim({ jawab: sehat });
    await s.fetch("/aleta/api/x");
    await tunggu();
    s.panggilan.length = 0;
    await s.fetch("/aleta/api/aleta-bot/penunjukan/tulis", { method: "POST", body: "{}" });
    await s.fetch("/aleta/api/x", { method: "put" });
    await s.fetch("/aleta/api/x", { method: "DELETE" });
    await s.fetch("/SIPP/perkara/list");
    await s.fetch("http://192.168.10.10/aleta/api/x");
    await s.fetch({ url: "/aleta/api/x" });
    expect(s.panggilan.map((p) => p.url)).toEqual([
      "/aleta/api/aleta-bot/penunjukan/tulis",
      "/aleta/api/x",
      "/aleta/api/x",
      "/SIPP/perkara/list",
      "http://192.168.10.10/aleta/api/x",
      { url: "/aleta/api/x" },
    ]);
  });

  it("8008 belum dibuka / asal belum diizinkan portal: semua tetap di port 80 dan uji tidak diulang-ulang", async () => {
    const s = muatShim({
      jawab: ({ url }) => {
        if (url.startsWith("http://192.168.10.10:8008")) throw new TypeError("Failed to fetch");
        return { ok: true, status: 200 };
      },
    });
    await s.fetch("/aleta/api/a");
    await tunggu();
    await s.fetch("/aleta/api/b");
    await s.fetch("/aleta/api/c");
    expect(s.panggilan.filter((p) => p.url.includes(":8008"))).toHaveLength(1); // satu uji saja
    expect(s.panggilan.filter((p) => p.url.startsWith("/aleta/api/")).map((p) => p.url)).toEqual(["/aleta/api/a", "/aleta/api/b", "/aleta/api/c"]);
    expect(JSON.parse(s.penyimpanan["aleta-jalur-cepat"]).hidup).toBe(false);
  });

  it("8008 gagal jaringan di tengah jalan: permintaan yang sama diulang di port 80 dan 8008 dianggap mati", async () => {
    let mati = false;
    const s = muatShim({
      jawab: ({ url }) => {
        if (url.startsWith("http://192.168.10.10:8008") && mati) throw new TypeError("Failed to fetch");
        return { ok: true, status: 200 };
      },
    });
    await s.fetch("/aleta/api/a");
    await tunggu();
    mati = true;
    s.panggilan.length = 0;
    const r = await s.fetch("/aleta/api/b?x=1", { headers: { Accept: "application/json" } });
    expect(r.ok).toBe(true);
    expect(s.panggilan.map((p) => p.url)).toEqual(["http://192.168.10.10:8008/aleta/api/b?x=1", "/aleta/api/b?x=1"]);
    expect(s.panggilan[1].init).toEqual({ headers: { Accept: "application/json" } }); // init asli, bukan yang diubah
    s.panggilan.length = 0;
    await s.fetch("/aleta/api/c");
    expect(s.panggilan.map((p) => p.url)).toEqual(["/aleta/api/c"]);
  });

  it("404/502/503/504 dari 8008 diulang di port 80; 401 dan 500 diteruskan apa adanya", async () => {
    for (const status of [404, 502, 503, 504]) {
      let jawabanCepat = 200;
      const s = muatShim({
        jawab: ({ url }) => (url.startsWith("http://192.168.10.10:8008/aleta/api/x") ? { ok: false, status: jawabanCepat } : { ok: true, status: 200 }),
      });
      await s.fetch("/aleta/api/a");
      await tunggu();
      jawabanCepat = status;
      s.panggilan.length = 0;
      const r = await s.fetch("/aleta/api/x");
      expect(r.status).toBe(200);
      expect(s.panggilan.map((p) => p.url)).toEqual(["http://192.168.10.10:8008/aleta/api/x", "/aleta/api/x"]);
      expect(JSON.parse(s.penyimpanan["aleta-jalur-cepat"]).hidup).toBe(false);
    }
    for (const status of [401, 500]) {
      const s = muatShim({
        jawab: ({ url }) => (url.startsWith("http://192.168.10.10:8008/aleta/api/x") ? { ok: false, status } : { ok: true, status: 200 }),
      });
      await s.fetch("/aleta/api/a");
      await tunggu();
      s.panggilan.length = 0;
      const r = await s.fetch("/aleta/api/x");
      expect(r.status).toBe(status);
      expect(s.panggilan).toHaveLength(1);
      expect(JSON.parse(s.penyimpanan["aleta-jalur-cepat"]).hidup).toBe(true);
    }
  });

  it("pembatalan oleh pemanggil (AbortError) diteruskan, tanpa ulang dan tanpa mematikan 8008", async () => {
    let batal = false;
    const s = muatShim({
      jawab: ({ url }) => {
        if (batal && url.startsWith("http://192.168.10.10:8008")) throw Object.assign(new Error("dibatalkan"), { name: "AbortError" });
        return { ok: true, status: 200 };
      },
    });
    await s.fetch("/aleta/api/a");
    await tunggu();
    batal = true;
    s.panggilan.length = 0;
    await expect(s.fetch("/aleta/api/x")).rejects.toMatchObject({ name: "AbortError" });
    expect(s.panggilan).toHaveLength(1);
    expect(JSON.parse(s.penyimpanan["aleta-jalur-cepat"]).hidup).toBe(true);
  });

  it("dimuat hanya di skrip konten SIPP dan ABT (setelah penjaga tanda), ikut paket ekstensi, probe sesuai CORS portal", () => {
    const manifest = JSON.parse(baca("ekstensi-sipp/manifest.json")) as { content_scripts: Array<{ matches: string[]; js: string[] }> };
    const pemuat = manifest.content_scripts.filter((c) => c.js.includes("portal-jalur.js"));
    expect(pemuat).toHaveLength(2);
    for (const c of pemuat) {
      expect(c.js[0]).toBe("portal-jalur.js");
      expect(c.matches.some((m) => m.includes("/aleta/"))).toBe(false);
    }
    expect(pemuat.map((c) => c.matches[0]).sort()).toEqual(["http://192.168.10.10/SIPP/*", "http://192.168.10.10/aps_badilag/*"]);
    const penjaga = manifest.content_scripts.find((c) => c.js.includes("penjaga-tanda.js"))!;
    expect(manifest.content_scripts.indexOf(penjaga)).toBeLessThan(manifest.content_scripts.indexOf(pemuat[0]));
    expect(baca("manajemen_surat/scripts/susun-ekstensi.mjs")).toContain('"portal-jalur.js"');
    expect(baca("manajemen_surat/src/server/shared/ekstensi-berkas.ts")).toContain("portal-jalur.js");
  });
});
