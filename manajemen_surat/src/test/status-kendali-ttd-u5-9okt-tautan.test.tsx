/**
 * ============================================================================
 * /aleta-ecourt#ttd MEMBUKA MENU TANDA TANGAN - AUDIT U5 9 OKTOBER 2026
 * ============================================================================
 *
 * Tautan "Berkas tanda tangan" (Peta penetapan, jawaban rute peta edoc -
 * TAUTAN_BERKAS_TANDA_TANGAN - dan panel ekstensi) menuju /aleta-ecourt#ttd.
 * Sampai perbaikan ini jangkarnya tidak dibaca dan tautannya mendarat di
 * Dasbor. [merah sebelum]
 *
 * Menunya hanya bagi Super Admin dan Admin: peran lain yang membuka tautan
 * yang sama tetap di Dasbor dan tidak melihat menunya sama sekali.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const keadaan = vi.hoisted(() => ({ peran: "admin" }));
vi.mock("@/lib/app-state", () => ({
  usePortal: () => ({
    currentUser: { id: "usr-x", name: "Uji", roleId: keadaan.peran, additionalRoleIds: [] },
    institutionIdentity: { courtName: "PA Contoh" },
  }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...sisa }: { href: string; children: unknown }) =>
    createElement("a", { href, ...sisa }, children as never),
}));
// Layar berat yang dimuat menurut menu tidak diuji di sini.
vi.mock("next/dynamic", () => ({ default: () => () => null }));

const { AletaEcourtPengguna } = await import("@/components/portal/aleta-ecourt-pengguna");

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("menu e-Court dibuka dari tautan berjangkar", () => {
  for (const jangkar of ["#ttd", "#tanda-tangan"]) {
    it(`admin: /aleta-ecourt${jangkar} membuka Tanda Tangan`, async () => {
      keadaan.peran = "admin";
      vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
      window.history.replaceState(null, "", `/aleta-ecourt${jangkar}`);
      render(<AletaEcourtPengguna />);
      const tombol = await screen.findByRole("button", { name: /Tanda Tangan/ });
      await waitFor(() => expect(tombol.getAttribute("aria-current")).toBe("page"));
    });
  }

  it("super admin: #ttd membuka Tanda Tangan", async () => {
    keadaan.peran = "super-admin";
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    window.history.replaceState(null, "", "/aleta-ecourt#ttd");
    render(<AletaEcourtPengguna />);
    const tombol = await screen.findByRole("button", { name: /Tanda Tangan/ });
    await waitFor(() => expect(tombol.getAttribute("aria-current")).toBe("page"));
  });

  it("panitera pengganti: #ttd tetap di Jadwal Sidang (bawaan 12 Okt) dan menu Tanda Tangan tidak ada", async () => {
    keadaan.peran = "panitera-pengganti";
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    window.history.replaceState(null, "", "/aleta-ecourt#ttd");
    render(<AletaEcourtPengguna />);
    const jadwal = await screen.findByRole("button", { name: /Jadwal Sidang/ });
    await new Promise((r) => setTimeout(r, 30));
    expect(jadwal.getAttribute("aria-current")).toBe("page");
    expect(screen.queryByRole("button", { name: /Tanda Tangan/ })).toBeNull();
  });

  it("tanpa jangkar: Jadwal Sidang (bawaan sejak 12 Okt 2026)", async () => {
    keadaan.peran = "admin";
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    window.history.replaceState(null, "", "/aleta-ecourt");
    render(<AletaEcourtPengguna />);
    const jadwal = await screen.findByRole("button", { name: /Jadwal Sidang/ });
    await new Promise((r) => setTimeout(r, 30));
    expect(jadwal.getAttribute("aria-current")).toBe("page");
  });
});
