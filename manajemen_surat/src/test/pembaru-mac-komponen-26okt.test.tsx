import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bisaDipasang, deteksiOsPengguna } from "@/lib/deteksi-os-pemasang";

/**
 * ============================================================================
 * PORTAL MEMILIH PEMASANG PEMBARU OTOMATIS MENURUT SISTEM KOMPUTER (26 Okt 2026)
 * ============================================================================
 *
 * Halaman Ekstensi SIPP mengenali Windows / macOS dari peramban (userAgentData,
 * lalu platform / userAgent) dan mengunduh pemasang yang sesuai: Windows .cmd,
 * macOS .command. Tautan kecil "Windows / macOS" selalu ada untuk memilih
 * sendiri. Linux dan perangkat lain: keterangan "belum didukung".
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
  linux: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
};
const PLATFORM = { mac: "MacIntel", windows: "Win32", linux: "Linux x86_64" };

function setNavigator(os: keyof typeof UA, uadPlatform?: string) {
  Object.defineProperty(window.navigator, "userAgent", { value: UA[os], configurable: true });
  Object.defineProperty(window.navigator, "platform", { value: PLATFORM[os], configurable: true });
  Object.defineProperty(window.navigator, "userAgentData", { value: uadPlatform ? { platform: uadPlatform } : undefined, configurable: true });
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
      if (a.includes("/ekstensi/pembaru/pemasang")) {
        return new Response("#!/bin/bash\necho uji\n", { status: 200, headers: { "Content-Type": "application/octet-stream" } });
      }
      if (a.includes("/api/aleta-ecourt/ekstensi?info=versi")) {
        return new Response(JSON.stringify({ ok: true, versi: "1.205.39" }), { status: 200, headers: { "Content-Type": "application/json" } });
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
  await screen.findByText("Pembaruan otomatis (pasang sekali per komputer)", undefined, { timeout: 15_000 });
  const kotak = screen.getByText("Pembaruan otomatis (pasang sekali per komputer)").closest("div") as HTMLElement;
  return kotak;
}

describe("deteksiOsPengguna: petunjuk peramban -> sistem", () => {
  it("userAgentData lebih dulu, lalu platform, lalu userAgent; tanpa petunjuk = windows", () => {
    expect(deteksiOsPengguna({ userAgentData: { platform: "macOS" } })).toBe("mac");
    expect(deteksiOsPengguna({ userAgentData: { platform: "Windows" } })).toBe("windows");
    expect(deteksiOsPengguna({ platform: "MacIntel", userAgent: UA.mac })).toBe("mac");
    expect(deteksiOsPengguna({ platform: "Win32", userAgent: UA.windows })).toBe("windows");
    expect(deteksiOsPengguna({ userAgent: UA.linux })).toBe("linux");
    expect(deteksiOsPengguna(null)).toBe("windows");
    expect(deteksiOsPengguna({})).toBe("windows");
  });

  it("iPad (menyamar Macintosh dengan layar sentuh), iPhone, Android, ChromeOS = perangkat lain, tanpa pemasang", () => {
    expect(deteksiOsPengguna({ platform: "MacIntel", userAgent: UA.mac, maxTouchPoints: 5 })).toBe("lain");
    expect(deteksiOsPengguna({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" })).toBe("lain");
    expect(deteksiOsPengguna({ userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8)" })).toBe("lain");
    expect(deteksiOsPengguna({ userAgent: "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0)" })).toBe("lain");
    expect(bisaDipasang("mac")).toBe(true);
    expect(bisaDipasang("windows")).toBe(true);
    expect(bisaDipasang("linux")).toBe(false);
    expect(bisaDipasang("lain")).toBe(false);
  });
});

describe("halaman Ekstensi SIPP: pemasang pembaru otomatis menurut sistem", () => {
  it("Mac: tombol 'Unduh pemasang untuk macOS', langkah lewat Terminal, meminta ?os=mac dan menyimpan .command", async () => {
    setNavigator("mac", "macOS");
    const kotak = await bukaHalamanEkstensi();
    const tombol = within(kotak).getByRole("button", { name: "Unduh pemasang untuk macOS" });
    expect(kotak.textContent).toMatch(/Terminal/);
    expect(kotak.textContent).toContain("pasang-pembaru-aleta.command");
    expect(kotak.textContent).not.toMatch(/Klik dua kali berkas/);
    expect(kotak.textContent).not.toMatch(/Internet Download Manager/); // catatan IDM khusus Windows
    expect(kotak.textContent).toMatch(/terdeteksi:\s*macOS/);

    fireEvent.click(tombol);
    await waitFor(() => expect(unduhan).toEqual(["pasang-pembaru-aleta.command"]));
    expect(diminta.some((a) => a.includes("/ekstensi/pembaru/pemasang?os=mac"))).toBe(true);
    await waitFor(() => expect(screen.getByText(/Pemasang macOS terunduh/)).toBeTruthy());
  }, 40_000);

  it("Windows: tombol 'Unduh pemasang untuk Windows', klik dua kali, catatan IDM, meminta ?os=windows dan menyimpan .cmd", async () => {
    setNavigator("windows", "Windows");
    const kotak = await bukaHalamanEkstensi();
    const tombol = within(kotak).getByRole("button", { name: "Unduh pemasang untuk Windows" });
    expect(kotak.textContent).toMatch(/Klik dua kali berkas/);
    expect(kotak.textContent).toMatch(/Internet Download Manager/);
    expect(kotak.textContent).not.toMatch(/Terminal/);

    fireEvent.click(tombol);
    await waitFor(() => expect(unduhan).toEqual(["pasang-pembaru-aleta.cmd"]));
    expect(diminta.some((a) => a.includes("/ekstensi/pembaru/pemasang?os=windows"))).toBe(true);
  }, 40_000);

  it("tautan kecil Windows / macOS selalu ada: di Mac, 'Windows' mengunduh .cmd untuk komputer lain", async () => {
    setNavigator("mac", "macOS");
    const kotak = await bukaHalamanEkstensi();
    fireEvent.click(within(kotak).getByRole("button", { name: "Windows" }));
    await waitFor(() => expect(unduhan).toEqual(["pasang-pembaru-aleta.cmd"]));
    expect(diminta.filter((a) => a.includes("/pemasang?os=windows"))).toHaveLength(1);
    expect(within(kotak).getByRole("button", { name: "macOS" })).toBeTruthy();
  }, 40_000);

  it("Linux: keterangan belum didukung, tombol utama mati; memilih macOS secara manual tetap mengunduh", async () => {
    setNavigator("linux", "Linux");
    const kotak = await bukaHalamanEkstensi();
    expect(kotak.textContent).toMatch(/baru tersedia untuk Windows dan macOS/);
    expect(kotak.textContent).toMatch(/terdeteksi:\s*Linux/);
    const utama = within(kotak).getByRole("button", { name: "Unduh pemasang" }) as HTMLButtonElement;
    expect(utama.disabled).toBe(true);
    fireEvent.click(utama);
    expect(diminta.some((a) => a.includes("/pemasang"))).toBe(false);

    fireEvent.click(within(kotak).getByRole("button", { name: "macOS" }));
    await waitFor(() => expect(unduhan).toEqual(["pasang-pembaru-aleta.command"]));
  }, 40_000);

  it("server menolak (400): keterangan dari server ditampilkan, tidak ada unduhan", async () => {
    setNavigator("mac", "macOS");
    const awal = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const asli = awal.getMockImplementation()!;
    awal.mockImplementation(async (a: string) => {
      if (String(a).includes("/pemasang")) {
        diminta.push(String(a));
        return new Response(JSON.stringify({ ok: false, error: { message: "Linux belum didukung." } }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
      return asli(a);
    });
    const kotak = await bukaHalamanEkstensi();
    fireEvent.click(within(kotak).getByRole("button", { name: "Unduh pemasang untuk macOS" }));
    await waitFor(() => expect(screen.getByText("Linux belum didukung.")).toBeTruthy());
    expect(unduhan).toHaveLength(0);
  }, 40_000);
});
