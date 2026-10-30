import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StatistikBlangkoPanel } from "@/components/portal/statistik-blangko-panel";
import { susunStatistik } from "@/lib/statistik-blangko";

/** G6 6.4 - layar Statistik pemakaian blangko: memuat ringkasan dari rute, folder dapat dibuka, tanpa tombol hapus/pindah. */
describe("layar Statistik pemakaian blangko", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("menampilkan jumlah cetak, folder (terbuka: paling sering & tidak pernah), per jenis, dan varian mirip", async () => {
    const data = susunStatistik(
      [
        { kelompok: "1 Perceraian CG", berkas: "[01] Kabul Verstek", jenisPerkara: "Cerai Gugat", perkaraId: "1", pada: "2026-10-01T01:00:00Z", sumber: "cetak" },
        { kelompok: "1 Perceraian CG", berkas: "[01] Kabul Verstek", jenisPerkara: "Cerai Gugat", perkaraId: "2", pada: "2026-10-02T01:00:00Z", sumber: "cetak" },
      ],
      {
        berkas: [
          { rel: "1 Perceraian CG/[01] Kabul Verstek.rtf", folder: "1 Perceraian CG", nama: "[01] Kabul Verstek" },
          { rel: "1 Perceraian CG/[01b] Kabul Verstek varian.rtf", folder: "1 Perceraian CG", nama: "[01b] Kabul Verstek varian" },
        ],
        ganda: [{ folder: "1 Perceraian CG", a: "1 Perceraian CG/[01] Kabul Verstek.rtf", b: "1 Perceraian CG/[01b] Kabul Verstek varian.rtf", mirip: 0.95 }],
        dipindai: "2026-10-30T10:00:00Z",
      }
    );
    const ambil = vi.fn(async () => new Response(JSON.stringify({ ok: true, data }), { status: 200 }));
    vi.stubGlobal("fetch", ambil);
    render(<StatistikBlangkoPanel />);
    await waitFor(() => expect(screen.getByText(/2 cetakan tercatat/)).toBeTruthy());
    expect(String((ambil.mock.calls[0] as unknown[])[0])).toContain("/api/aleta-ecourt/statistik-blangko");
    fireEvent.click(screen.getByText("1 Perceraian CG", { selector: "span" }));
    expect(screen.getByText("Paling sering")).toBeTruthy();
    expect(screen.getAllByText("[01b] Kabul Verstek varian").length).toBeGreaterThan(0);
    expect(screen.getByText("95%")).toBeTruthy();
    expect(screen.getByText("Cerai Gugat")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /hapus|pindah|arsipkan/i })).toBeNull();
  });

  it("galat rute ditampilkan dengan kalimat awam", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: false, error: { message: "Hanya Super Admin dan Admin." } }), { status: 403 })));
    render(<StatistikBlangkoPanel />);
    await waitFor(() => expect(screen.getByText("Hanya Super Admin dan Admin.")).toBeTruthy());
  });
});
