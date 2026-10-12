import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * ============================================================================
 * /aleta-ecourt?perkara=<nomor> MEMBUKA STATUS PERKARA ITU
 * ============================================================================
 *
 * Alamat ini disusun tombol "Salin tautan" pada bilah alat Status Perkara dan
 * oleh daftar perkara pada halaman rekap petugas (butir 6 dan 9, 27 September
 * 2026) - tetapi sampai hari itu tidak ada yang membacanya: tautannya selalu
 * mendarat di Dasbor. Yang diperiksa di sini yang SUNGGUH terjadi: menu Status
 * Perkara menjadi yang aktif, dan layarnya meminta perkara itu ke rutenya.
 */

const keadaan = vi.hoisted(() => ({
  portal: {
    institutionIdentity: { courtName: "PENGADILAN AGAMA CONTOH" },
    currentUser: { id: "u1", name: "Petugas Uji", roleId: "staf" } as Record<string, unknown> | null,
    accessibleModules: [] as unknown[],
    positions: [] as unknown[],
  },
}));

vi.mock("@/lib/app-state", () => ({ usePortal: () => keadaan.portal }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...sisa }: { href: string; children: unknown }) =>
    createElement("a", { href, ...sisa }, children as never),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

function pasangFetch() {
  const ambil = vi.fn(async (alamat: string) => {
    if (String(alamat).includes("/api/aleta-ecourt/status-perkara?nomor=")) {
      return new Response(
        JSON.stringify({ ok: true, data: { available: true, status: null, alasan: "perkara_tidak_ditemukan" } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    // Keadaan penghubung e-Court dan bacaan lain tidak diuji di sini.
    return new Promise<Response>(() => {});
  });
  vi.stubGlobal("fetch", ambil);
  return ambil;
}

const memintaStatus = (ambil: ReturnType<typeof vi.fn>) =>
  ambil.mock.calls.map((c) => String(c[0])).filter((a) => a.includes("/api/aleta-ecourt/status-perkara?nomor="));

describe("halaman ALETA e-Court membaca ?perkara=", () => {
  it("dengan ?perkara=: Status Perkara terbuka dan meminta nomor itu", async () => {
    window.history.replaceState({}, "", "/aleta-ecourt?perkara=12%2FPdt.G%2F2026%2FPA.Ctt");
    const ambil = pasangFetch();
    const { AletaEcourtPengguna } = await import("@/components/portal/aleta-ecourt-pengguna");
    render(createElement(AletaEcourtPengguna));

    const menu = screen.getByRole("navigation", { name: "Menu ALETA e-Court" });
    await waitFor(
      () => expect(within(menu).getByRole("button", { name: /Status Perkara/ }).getAttribute("aria-current")).toBe("page"),
      { timeout: 15_000 }
    );
    await waitFor(() => expect(memintaStatus(ambil)).toHaveLength(1), { timeout: 15_000 });
    const url = new URL(memintaStatus(ambil)[0], "http://portal.contoh");
    expect(url.searchParams.get("nomor")).toBe("12/Pdt.G/2026/PA.Ctt");
  }, 30_000);

  it("tanpa ?perkara=: Jadwal Sidang (bawaan 12 Okt), tidak ada perkara yang diminta", async () => {
    window.history.replaceState({}, "", "/aleta-ecourt");
    const ambil = pasangFetch();
    const { AletaEcourtPengguna } = await import("@/components/portal/aleta-ecourt-pengguna");
    render(createElement(AletaEcourtPengguna));
    const menu = screen.getByRole("navigation", { name: "Menu ALETA e-Court" });
    await new Promise((r) => setTimeout(r, 50));
    expect(within(menu).getByRole("button", { name: /Jadwal Sidang/ }).getAttribute("aria-current")).toBe("page");
    expect(memintaStatus(ambil)).toHaveLength(0);
  }, 30_000);
});
