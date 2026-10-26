import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useLihatSebagaiAktif } from "@/lib/pakai-lihat-sebagai";

/**
 * Saklar Lihat Sebagai (E4, 26 Okt 2026): mati bawaan. Kait klien membaca /api/hak-akses/saya; menu dan halaman
 * hanya tampil bila terbukti menyala, dan gagal baca = tersembunyi (sama dengan server yang menolak rutenya).
 */

const potal = vi.hoisted(() => ({ nilai: { currentUser: { id: "u-sa", roleId: "super-admin", positionId: "pos-uji" } } as Record<string, unknown> }));
vi.mock("@/lib/app-state", () => ({ usePortal: () => potal.nilai }));
vi.mock("@/components/portal/lihat-sebagai-panel", () => ({ LihatSebagaiPanel: () => <div data-panel-lihat="">panel</div> }));

function tiruFetch(jawab: () => { ok: boolean; data?: unknown } | Error) {
  const f = vi.fn(async () => {
    const h = jawab();
    if (h instanceof Error) throw h;
    return { ok: h.ok, status: h.ok ? 200 : 500, json: async () => ({ ok: h.ok, data: h.data }) } as Response;
  });
  vi.stubGlobal("fetch", f);
  return f;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Penguji() {
  const a = useLihatSebagaiAktif();
  return <span data-hasil={String(a)}>{String(a)}</span>;
}

describe("useLihatSebagaiAktif", () => {
  it("menyala hanya bila server menjawab lihatSebagaiAktif: true", async () => {
    tiruFetch(() => ({ ok: true, data: { lihatSebagaiAktif: true } }));
    render(<Penguji />);
    await waitFor(() => expect(screen.getByText("true")).toBeTruthy());
  });

  it("mati bawaan (false), jawaban tanpa ruasnya, galat server, dan jaringan putus: semuanya false", async () => {
    for (const jawab of [() => ({ ok: true, data: { lihatSebagaiAktif: false } }), () => ({ ok: true, data: {} }), () => ({ ok: false }), () => new Error("putus")]) {
      cleanup();
      tiruFetch(jawab);
      render(<Penguji />);
      await waitFor(() => expect(screen.getByText("false")).toBeTruthy());
    }
  });
});

describe("halaman Lihat Sebagai", () => {
  it("saklar mati: tidak ada panel, ada keterangan cara menyalakannya", async () => {
    tiruFetch(() => ({ ok: true, data: { lihatSebagaiAktif: false } }));
    const { default: Halaman } = await import("@/app/(portal)/admin/lihat-sebagai/page");
    render(<Halaman />);
    await waitFor(() => expect(screen.getByText(/belum dinyalakan/i)).toBeTruthy());
    expect(document.querySelector("[data-panel-lihat]")).toBeNull();
  });

  it("saklar menyala dan Super Admin: panel tampil", async () => {
    tiruFetch(() => ({ ok: true, data: { lihatSebagaiAktif: true } }));
    const { default: Halaman } = await import("@/app/(portal)/admin/lihat-sebagai/page");
    render(<Halaman />);
    await waitFor(() => expect(document.querySelector("[data-panel-lihat]")).toBeTruthy());
  });
});
