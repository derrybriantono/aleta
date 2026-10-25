/**
 * ============================================================================
 * K16 - MODE RINGAN DI PORTAL (rantai B, 25 Okt 2026)
 * ============================================================================
 *   - bawaan (saklar Super Admin mati, pilihan otomatis): tidak ada atribut, tidak ada tombol;
 *   - saklar menyala + komputer sederhana: atribut data-aleta-ringan di <html>, tombol tampil;
 *   - tombol memutar otomatis -> nyala -> mati dan menyimpannya di localStorage;
 *   - pilihan pengguna menang atas deteksi; tanpa saklar, pilihan "nyala" tetap dihormati.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PenandaModeRingan, TombolModeRingan, setelUlangSaklarRinganUntukUji } from "@/components/layout/mode-ringan";
import { KUNCI_MODE_RINGAN } from "@/lib/mode-ringan";

function tiruanServer(saklarOtomatis: boolean, status = 200) {
  vi.spyOn(globalThis, "fetch").mockImplementation(
    async () =>
      new Response(JSON.stringify({ ok: true, data: { saklar: { pengamatTunggal: false, modeRinganOtomatis: saklarOtomatis }, bolehMengubah: false } }), {
        status,
        headers: { "content-type": "application/json" },
      })
  );
}
function perangkat(memori: number | undefined, inti: number) {
  Object.defineProperty(window.navigator, "deviceMemory", { value: memori, configurable: true });
  Object.defineProperty(window.navigator, "hardwareConcurrency", { value: inti, configurable: true });
}
const Layar = () => (
  <>
    <PenandaModeRingan />
    <TombolModeRingan />
  </>
);
const ringan = () => document.documentElement.hasAttribute("data-aleta-ringan");

beforeEach(() => {
  setelUlangSaklarRinganUntukUji();
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-aleta-ringan");
  perangkat(4, 2);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("mode ringan portal", () => {
  it("bawaan: saklar mati walau komputer sederhana -> tanpa atribut dan tanpa tombol", async () => {
    tiruanServer(false);
    render(<Layar />);
    await act(async () => {
      await Promise.resolve();
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(ringan()).toBe(false);
    expect(screen.queryByRole("button", { name: /Mode ringan/ })).toBeNull();
  });

  it("saklar belum dapat dibaca (401/galat) = mati", async () => {
    tiruanServer(true, 401);
    render(<Layar />);
    await new Promise((r) => setTimeout(r, 30));
    expect(ringan()).toBe(false);
    expect(screen.queryByRole("button", { name: /Mode ringan/ })).toBeNull();
  });

  it("saklar menyala + komputer sederhana: atribut terpasang dan tombol tampil", async () => {
    tiruanServer(true);
    render(<Layar />);
    await waitFor(() => expect(ringan()).toBe(true));
    expect(screen.getByRole("button", { name: "Mode ringan: otomatis" })).toBeTruthy();
  });

  it("saklar menyala + komputer kuat: tidak ringan, tombol tetap ada untuk pilihan manual", async () => {
    perangkat(16, 16);
    tiruanServer(true);
    render(<Layar />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Mode ringan: otomatis" })).toBeTruthy());
    expect(ringan()).toBe(false);
  });

  it("tombol memutar otomatis -> nyala -> mati -> otomatis dan menyimpan pilihan", async () => {
    perangkat(16, 16);
    tiruanServer(true);
    render(<Layar />);
    const tombol = await screen.findByRole("button", { name: "Mode ringan: otomatis" });
    fireEvent.click(tombol);
    await waitFor(() => expect(ringan()).toBe(true));
    expect(window.localStorage.getItem(KUNCI_MODE_RINGAN)).toBe("nyala");
    fireEvent.click(screen.getByRole("button", { name: "Mode ringan: nyala" }));
    await waitFor(() => expect(ringan()).toBe(false));
    expect(window.localStorage.getItem(KUNCI_MODE_RINGAN)).toBe("mati");
    fireEvent.click(screen.getByRole("button", { name: "Mode ringan: mati" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Mode ringan: otomatis" })).toBeTruthy());
    expect(window.localStorage.getItem(KUNCI_MODE_RINGAN)).toBeNull();
  });

  it("pilihan mati menang atas deteksi tua; pilihan nyala menang walau saklar mati dan tombol tetap tampil agar bisa dibatalkan", async () => {
    tiruanServer(true);
    window.localStorage.setItem(KUNCI_MODE_RINGAN, "mati");
    const a = render(<Layar />);
    await new Promise((r) => setTimeout(r, 40));
    expect(ringan()).toBe(false);
    a.unmount();

    setelUlangSaklarRinganUntukUji();
    tiruanServer(false);
    window.localStorage.setItem(KUNCI_MODE_RINGAN, "nyala");
    render(<Layar />);
    await waitFor(() => expect(ringan()).toBe(true));
    expect(screen.getByRole("button", { name: "Mode ringan: nyala" })).toBeTruthy();
  });

  it("pilihan tersimpan yang rusak dianggap otomatis", async () => {
    tiruanServer(true);
    window.localStorage.setItem(KUNCI_MODE_RINGAN, "ngawur");
    render(<Layar />);
    await waitFor(() => expect(ringan()).toBe(true)); // otomatis + saklar + sederhana
  });
});
