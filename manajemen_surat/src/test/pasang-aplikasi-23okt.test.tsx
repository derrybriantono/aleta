import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TombolPasangAplikasi } from "@/components/layout/pasang-aplikasi";
import {
  aturUlangPasangAplikasi,
  kenaliPerangkat,
  pasangPendengarAplikasi,
  tentukanKeadaanPasang,
} from "@/lib/pasang-aplikasi";

/**
 * 23 Okt 2026 - ALETA dapat dipasang dari peramban ke HP Android dan iPhone/iPad.
 * Diuji: pengenalan perangkat, keadaan tombol, tombol satu-tekan saat peramban
 * menawarkan pasang, petunjuk per perangkat (termasuk Android lewat http),
 * manifest dengan basePath, dan pekerja latar yang tidak menyimpan data.
 */

const UA = {
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  ipadModern: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  android: "Mozilla/5.0 (Linux; Android 14; SM-A155F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36",
  windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
};

describe("pengenalan perangkat dan keadaan pasang", () => {
  it("iPhone, iPad modern (MacIntel + layar sentuh), Android, komputer", () => {
    expect(kenaliPerangkat(UA.iphone, "iPhone", 5)).toBe("ios");
    expect(kenaliPerangkat(UA.ipadModern, "MacIntel", 5)).toBe("ios");
    expect(kenaliPerangkat(UA.ipadModern, "MacIntel", 0)).toBe("lain"); // Mac sungguhan
    expect(kenaliPerangkat(UA.android, "Linux armv8l", 5)).toBe("android");
    expect(kenaliPerangkat(UA.windows, "Win32", 0)).toBe("lain");
  });

  it("terpasang menang; tawaran peramban = tombol; Android tanpa https perlu https", () => {
    const dasar = { terpasang: false, adaTawaran: false, aman: true, perangkat: "android" as const };
    expect(tentukanKeadaanPasang({ ...dasar, terpasang: true, adaTawaran: true })).toBe("terpasang");
    expect(tentukanKeadaanPasang({ ...dasar, adaTawaran: true })).toBe("tombol");
    expect(tentukanKeadaanPasang(dasar)).toBe("android-menu");
    expect(tentukanKeadaanPasang({ ...dasar, aman: false })).toBe("android-perlu-https");
    expect(tentukanKeadaanPasang({ ...dasar, perangkat: "ios", aman: false })).toBe("ios");
    expect(tentukanKeadaanPasang({ ...dasar, perangkat: "lain" })).toBe("lain");
  });
});

function aturLingkungan({ ua, platform = "", sentuh = 0, aman, standalone = false }: { ua: string; platform?: string; sentuh?: number; aman: boolean; standalone?: boolean }) {
  vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(ua);
  vi.spyOn(window.navigator, "platform", "get").mockReturnValue(platform);
  Object.defineProperty(window.navigator, "maxTouchPoints", { configurable: true, get: () => sentuh });
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: aman });
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: standalone && q.includes("standalone"),
    media: q,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
}

async function gambarTombol() {
  render(createElement(TombolPasangAplikasi));
  // Lingkungan dibaca satu putaran sesudah pasang (pola setTimeout 0).
  await act(async () => {
    await new Promise((r) => setTimeout(r, 5));
  });
}

describe("tombol Pasang di HP", () => {
  beforeEach(() => {
    aturUlangPasangAplikasi();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("peramban menawarkan pasang: satu tekan memanggil tawaran, lalu tombol hilang bila diterima", async () => {
    aturLingkungan({ ua: UA.android, platform: "Linux armv8l", sentuh: 5, aman: true });
    pasangPendengarAplikasi();
    await gambarTombol();
    const prompt = vi.fn(async () => undefined);
    const tawaran = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: "accepted" as const }),
    });
    await act(async () => {
      window.dispatchEvent(tawaran);
    });
    expect(tawaran.defaultPrevented).toBe(true); // bilah bawaan Chrome ditahan, ALETA yang menawarkan
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Pasang di HP/ }));
    });
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: /Pasang di HP/ })).toBeNull();
  });

  it("iPhone: petunjuk Bagikan > Tambah ke Layar Utama, tutup dengan Esc", async () => {
    aturLingkungan({ ua: UA.iphone, platform: "iPhone", sentuh: 5, aman: false });
    await gambarTombol();
    fireEvent.click(screen.getByRole("button", { name: /Pasang di HP/ }));
    const dialog = screen.getByRole("dialog", { name: "Pasang ALETA di HP" });
    expect(dialog.textContent).toContain("Tambah ke Layar Utama");
    expect(dialog.textContent).toContain("Bagikan");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Android lewat http: petunjuk pintasan + penjelasan perlu https dari server", async () => {
    aturLingkungan({ ua: UA.android, platform: "Linux armv8l", sentuh: 5, aman: false });
    await gambarTombol();
    fireEvent.click(screen.getByRole("button", { name: /Pasang di HP/ }));
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Tambahkan ke layar utama");
    expect(dialog.querySelector("[data-perlu-https]")).not.toBeNull();
  });

  it("Android lewat https tanpa tawaran: lewat menu Instal aplikasi, tanpa peringatan https", async () => {
    aturLingkungan({ ua: UA.android, platform: "Linux armv8l", sentuh: 5, aman: true });
    await gambarTombol();
    fireEvent.click(screen.getByRole("button", { name: /Pasang di HP/ }));
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Instal aplikasi");
    expect(dialog.querySelector("[data-perlu-https]")).toBeNull();
  });

  it("sudah dibuka sebagai aplikasi: tombol tidak tampil", async () => {
    aturLingkungan({ ua: UA.android, platform: "Linux armv8l", sentuh: 5, aman: true, standalone: true });
    await gambarTombol();
    expect(screen.queryByRole("button", { name: /Pasang di HP/ })).toBeNull();
  });
});

describe("manifest", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("alamat mulai, cakupan, dan ikon memakai basePath portal (/aleta)", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/aleta");
    vi.resetModules();
    const { default: manifest } = await import("@/app/manifest");
    const m = manifest();
    expect(m.start_url).toBe("/aleta/");
    expect(m.scope).toBe("/aleta/");
    expect(m.display).toBe("standalone");
    expect(m.short_name).toBe("ALETA");
    const ikon = m.icons ?? [];
    expect(ikon.map((i) => i.src)).toEqual(["/aleta/ikon-aplikasi/192", "/aleta/ikon-aplikasi/512", "/aleta/ikon-aplikasi/512"]);
    expect(ikon.some((i) => i.purpose === "maskable" && i.sizes === "512x512")).toBe(true);
  });
});

describe("pekerja latar (public/sw.js)", () => {
  function muatPekerja(fetchPalsu: (req: unknown) => Promise<unknown>) {
    const pendengar: Record<string, (e: unknown) => void> = {};
    const self = {
      addEventListener: (nama: string, f: (e: unknown) => void) => {
        pendengar[nama] = f;
      },
      skipWaiting: vi.fn(),
      clients: { claim: vi.fn(async () => undefined) },
    };
    const kode = readFileSync(path.resolve(__dirname, "../../public/sw.js"), "utf8");
    vm.runInNewContext(kode, { self, fetch: fetchPalsu, Response });
    return pendengar;
  }

  it("membuka halaman saat server tak terjangkau: halaman penjelasan 503, bukan galat peramban", async () => {
    const pendengar = muatPekerja(async () => {
      throw new TypeError("Failed to fetch");
    });
    let jawaban: Promise<Response> | null = null;
    pendengar.fetch({ request: { mode: "navigate" }, respondWith: (p: Promise<Response>) => (jawaban = p) });
    const r = await jawaban!;
    expect(r.status).toBe(503);
    expect(await r.text()).toContain("ALETA tidak tersambung ke server");
  });

  it("permintaan selain membuka halaman (API, berkas) tidak disentuh dan tidak disimpan", () => {
    const fetchPalsu = vi.fn();
    const pendengar = muatPekerja(fetchPalsu);
    const respondWith = vi.fn();
    pendengar.fetch({ request: { mode: "cors" }, respondWith });
    expect(respondWith).not.toHaveBeenCalled();
    expect(fetchPalsu).not.toHaveBeenCalled();
    const kode = readFileSync(path.resolve(__dirname, "../../public/sw.js"), "utf8");
    expect(kode).not.toMatch(/caches\.|cache\.put|indexedDB/); // tidak ada penyimpanan data portal di HP
  });
});
