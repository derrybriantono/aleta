import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ============================================================================
 * HALAMAN EKSTENSI SIPP: TOMBOL PEMASANG ALETA SEPAKET (2 Nov 2026)
 * ============================================================================
 *
 * Windows: tombol utama mengunduh pasang-aleta.cmd lewat ?bentuk=pemasang (dengan
 * sesi, lewat fetch), kotak keterangan menyebut lokasi pasang dan langkah satu
 * kali "Load unpacked"; ZIP lama dan pemasang pembaru tetap ada. Mac: tombol
 * pemasang Windows tidak tampil di atas, ZIP tetap tombol utama.
 */

vi.mock("@/lib/app-state", () => ({
  usePortal: () => ({
    institutionIdentity: { courtName: "PENGADILAN AGAMA CONTOH" },
    currentUser: { id: "u1", name: "Petugas Uji", roleId: "staf" },
    accessibleModules: [],
    positions: [],
  }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...sisa }: { href: string; children: unknown }) => createElement("a", { href, ...sisa }, children as never),
}));

const UA = {
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
};
const PLATFORM = { mac: "MacIntel", windows: "Win32" };

function setNavigator(os: keyof typeof UA, uadPlatform: string) {
  Object.defineProperty(window.navigator, "userAgent", { value: UA[os], configurable: true });
  Object.defineProperty(window.navigator, "platform", { value: PLATFORM[os], configurable: true });
  Object.defineProperty(window.navigator, "userAgentData", { value: { platform: uadPlatform }, configurable: true });
}

let diminta: string[] = [];
let unduhan: string[] = [];

beforeEach(() => {
  diminta = [];
  unduhan = [];
  window.history.replaceState({}, "", "/aleta-ecourt");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (alamat: string) => {
      const a = String(alamat);
      diminta.push(a);
      if (a.includes("/api/aleta-ecourt/ekstensi?bentuk=")) {
        return new Response("@echo off\r\n", { status: 200, headers: { "Content-Type": "application/octet-stream" } });
      }
      if (a.includes("/api/aleta-ecourt/ekstensi?info=versi")) {
        return new Response(JSON.stringify({ ok: true, versi: "1.205.62" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (/\/api\/aleta-ecourt\/ekstensi$/.test(a)) {
        return new Response(new Uint8Array([80, 75, 3, 4]), { status: 200, headers: { "Content-Type": "application/zip" } });
      }
      return new Promise<Response>(() => {});
    })
  );
  Object.defineProperty(URL, "createObjectURL", { value: () => "blob:uji", configurable: true, writable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: () => {}, configurable: true, writable: true });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    unduhan.push(this.download);
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function bukaHalamanEkstensi() {
  const { AletaEcourtPengguna } = await import("@/components/portal/aleta-ecourt-pengguna");
  render(createElement(AletaEcourtPengguna));
  const menu = screen.getByRole("navigation", { name: "Menu ALETA e-Court" });
  fireEvent.click(within(menu).getByRole("button", { name: /Ekstensi SIPP/ }));
  await screen.findByText("Pemasang ALETA sepaket (Windows, disarankan)", undefined, { timeout: 15_000 });
  return screen.getByText("Pemasang ALETA sepaket (Windows, disarankan)").closest("div") as HTMLElement;
}

describe("halaman Ekstensi SIPP: pemasang ALETA sepaket", () => {
  it("Windows: tombol utama mengunduh pasang-aleta.cmd lewat ?bentuk=pemasang; kotak menyebut lokasi .aleta dan Load unpacked sekali", async () => {
    setNavigator("windows", "Windows");
    const kotak = await bukaHalamanEkstensi();
    expect(kotak.textContent).toContain("%USERPROFILE%\\.aleta\\ekstensi");
    expect(kotak.textContent).toMatch(/Load unpacked/);
    expect(kotak.textContent).toMatch(/Mode Pengembang/);
    expect(kotak.textContent).toMatch(/tidak dapat diotomatiskan/);

    fireEvent.click(screen.getByRole("button", { name: "Unduh Pemasang ALETA (Windows)" }));
    await waitFor(() => expect(unduhan).toEqual(["pasang-aleta.cmd"]));
    expect(diminta.some((a) => a.endsWith("/api/aleta-ecourt/ekstensi?bentuk=pemasang"))).toBe(true);
    await waitFor(() => expect(screen.getByText(/Pemasang ALETA terunduh/)).toBeTruthy());

    fireEvent.click(within(kotak).getByRole("button", { name: /Unduh pencopot/ }));
    await waitFor(() => expect(unduhan).toEqual(["pasang-aleta.cmd", "copot-aleta.cmd"]));
    expect(diminta.some((a) => a.endsWith("/api/aleta-ecourt/ekstensi?bentuk=pencopot"))).toBe(true);
  }, 40_000);

  it("fitur lama tetap: ZIP tanpa ?bentuk dan pemasang pembaru (?os=windows) masih dapat diunduh", async () => {
    setNavigator("windows", "Windows");
    await bukaHalamanEkstensi();
    fireEvent.click(screen.getByRole("button", { name: "Unduh Ekstensi" }));
    await waitFor(() => expect(unduhan).toEqual(["aleta-ekstensi-sipp.zip"]));
    expect(diminta.some((a) => /\/api\/aleta-ecourt\/ekstensi$/.test(a))).toBe(true);
    expect(screen.getByRole("button", { name: "Unduh pemasang untuk Windows" })).toBeTruthy();
  }, 40_000);

  it("Mac: tombol pemasang Windows tidak tampil di atas; ZIP tetap tersedia", async () => {
    setNavigator("mac", "macOS");
    await bukaHalamanEkstensi();
    expect(screen.queryByRole("button", { name: "Unduh Pemasang ALETA (Windows)" })).toBeNull();
    expect(screen.getByRole("button", { name: "Unduh Ekstensi" })).toBeTruthy();
  }, 40_000);
});
