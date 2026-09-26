import { createElement } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import BlangkoMandiriPage from "@/app/(portal)/admin/blangko-mandiri/page";
import { personas } from "@/lib/mock-data";
import { type UserPersona } from "@/lib/types";
import { createAletaDatabase } from "@/server/db/client";
import { GOLONGAN_SAKLAR, geserSaklar, saklarMenyala } from "@/server/modules/aleta-ecourt/blangko-aleta";

/**
 * ============================================================================
 * PENJAGA /admin/blangko-mandiri DAN SAKLAR PERIKSA
 * ============================================================================
 *
 * 1. Halaman dijaga PERAN BERLAKU (super-admin/admin), seperti
 *    /admin/aleta-ecourt. Penjaga lamanya memeriksa id "aleta-ecourt-admin" di
 *    accessiblePortalApps - id yang tidak pernah ada di portalApps - sehingga
 *    halamannya tertutup bagi SIAPA PUN (diukur ukur-portalapps2.ts: false
 *    untuk super-admin dan admin).
 * 2. geserSaklar menolak golongan di luar daftar layar. Sebelumnya
 *    "golongan-ngawur" tercatat ok:true beserta riwayatnya - pergeseran yang
 *    tampak berhasil tetapi tidak mengubah blangko apa pun.
 * 3. Daftar golongan peladen = daftar yang SUNGGUH ditanyakan layar Blangko
 *    Mandiri (diukur dari permintaan yang dikirim layarnya, bukan dari teks
 *    sumbernya).
 */

let portal: { currentUser: UserPersona | null } = { currentUser: null };

vi.mock("@/lib/app-state", () => ({ usePortal: () => portal }));
vi.mock("@/components/portal/blangko-mandiri", async (asli) => {
  const modul = await asli<typeof import("@/components/portal/blangko-mandiri")>();
  return { ...modul, BlangkoMandiri: () => createElement("div", { "data-testid": "layar-blangko-mandiri" }, "layar") };
});
vi.mock("@/components/portal/shared", async (asli) => {
  const modul = await asli<typeof import("@/components/portal/shared")>();
  return { ...modul, AccessDeniedCard: () => createElement("div", { "data-testid": "akses-ditolak" }, "ditolak") };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function sebagai(id: string) {
  const p = personas.find((x) => x.id === id);
  if (!p) throw new Error(`persona ${id} tidak ada`);
  portal = { currentUser: p };
}

// ============================================================================
describe("/admin/blangko-mandiri dijaga peran berlaku", () => {
  it("terbuka untuk super-admin dan admin", () => {
    for (const id of ["usr-super", "usr-admin"]) {
      sebagai(id);
      render(createElement(BlangkoMandiriPage));
      expect(screen.getByTestId("layar-blangko-mandiri"), id).toBeInTheDocument();
      expect(screen.queryByTestId("akses-ditolak"), id).toBeNull();
      cleanup();
    }
  });

  it("tertutup untuk peran lain (panitera, hakim, ketua) dan tanpa pengguna", () => {
    for (const id of ["usr-panitera", "usr-hakim", "usr-ketua"]) {
      sebagai(id);
      render(createElement(BlangkoMandiriPage));
      expect(screen.getByTestId("akses-ditolak"), id).toBeInTheDocument();
      expect(screen.queryByTestId("layar-blangko-mandiri"), id).toBeNull();
      cleanup();
    }
    portal = { currentUser: null };
    render(createElement(BlangkoMandiriPage));
    expect(screen.getByTestId("akses-ditolak")).toBeInTheDocument();
  });
});

// ============================================================================
describe("geserSaklar hanya menerima golongan layar", () => {
  it("'golongan-ngawur' ditolak tanpa baris dan tanpa riwayat; golongan layar tetap bergeser", async () => {
    const db = await createAletaDatabase({ useInMemory: true, seed: true });
    try {
      const hitung = async (tabel: string) =>
        Number((await db.queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM ${tabel}`))?.n ?? 0);
      const ngawur = await geserSaklar(db, { golongan: "golongan-ngawur", menyala: true, alasan: "uji", oleh: "Ketua" });
      expect(ngawur.ok).toBe(false);
      expect(ngawur.sebab).toMatch(/golongan-ngawur/);
      expect(await hitung("aleta_saklar_periksa")).toBe(0);
      expect(await hitung("aleta_saklar_riwayat")).toBe(0);
      expect(await saklarMenyala(db, "golongan-ngawur")).toBe(false);

      for (const g of GOLONGAN_SAKLAR) {
        const r = await geserSaklar(db, { golongan: g, menyala: true, alasan: "uji", oleh: "Ketua" });
        expect(r, g).toEqual({ ok: true, sebab: "" });
        expect(await saklarMenyala(db, g), g).toBe(true);
      }
      expect(await hitung("aleta_saklar_riwayat")).toBe(GOLONGAN_SAKLAR.length);
    } finally {
      await db.close();
    }
  }, 120_000);

  it("GOLONGAN_SAKLAR = golongan yang SUNGGUH ditanyakan layar Blangko Mandiri", async () => {
    const { BlangkoMandiri } = await vi.importActual<typeof import("@/components/portal/blangko-mandiri")>(
      "@/components/portal/blangko-mandiri"
    );
    const ditanya: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((alamat: string) => {
        const url = new URL(String(alamat), "http://localhost");
        const g = url.searchParams.get("saklar");
        if (g) ditanya.push(g);
        return Promise.resolve({
          ok: true,
          json: async () => ({
            ok: true,
            data: g
              ? { menyala: false }
              : {
                  blangko: [],
                  statistik: { jumlah: 0, jumlahBerkas: 0, perKelas: { A: 0, B: 0, C: 0 }, perJenis: [] },
                  pergeseran: [],
                  ringkas: { jumlahMati: 0, matiDanTerpakai: 0 },
                  temuan: [],
                },
          }),
        } as unknown as Response);
      })
    );
    render(createElement(BlangkoMandiri));
    // Saklar hidup di tab Pustaka; tab itu baru dipasang saat dibuka.
    await userEvent.click(screen.getByRole("tab", { name: "Pustaka" }));
    await waitFor(() => expect(ditanya.length).toBeGreaterThanOrEqual(GOLONGAN_SAKLAR.length));
    expect([...new Set(ditanya)].sort()).toEqual([...GOLONGAN_SAKLAR].sort());
  });
});
