// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { KehadiranSidang } from "@/components/portal/bas-kehadiran-sidang";

/**
 * Audit 17 Okt 2026 - usulan BAS "Dari kehadiran yang dicatat di antrian"
 * (F3.2): KehadiranSidang tidak meneruskan sebutan maupun "tanpa pihak
 * kedua", sehingga permohonan Pdt.P mendapat usulan resmi "Tergugat ...
 * tidak hadir" untuk pihak yang tidak ada, dan cerai talak tertulis
 * Penggugat/Tergugat.
 */

const jawab = (data: unknown) => new Response(JSON.stringify({ ok: true, data }), { status: 200 });

function tiruFetch(hadir: Array<Record<string, unknown>>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (alamat: string) => {
      if (String(alamat).includes("/bas/kehadiran")) return jawab({ kehadiran: {}, bunyi: [] });
      if (String(alamat).includes("/antrian/kehadiran")) return jawab({ kehadiran: { "77": { hadir } } });
      return jawab({});
    })
  );
}

afterEach(() => vi.unstubAllGlobals());

const RIWAYAT = [{ sidangKe: 1, tanggalSidang: "2026-10-01", agenda: "Pemeriksaan" }];

describe("KehadiranSidang - usulan BAS memakai sebutan perkara", () => {
  it("permohonan Pdt.P: tidak ada usulan untuk pihak kedua yang tidak ada", async () => {
    tiruFetch([{ peran: "pemohon", sisi: "pihak_1", nama: "Siti", jam: "08:47" }]);
    render(<KehadiranSidang perkaraId="77" nomorPerkara="12/Pdt.P/2026/PA.Dgl" jenisPerkara="Pengesahan Perkawinan/Istbat Nikah" riwayatSidang={RIWAYAT} />);
    const kotak = await screen.findByText("Dari kehadiran yang dicatat di antrian");
    const isi = kotak.closest("[data-usulan-bas-kehadiran]")!.textContent ?? "";
    expect(isi).not.toMatch(/Tergugat|Termohon/);
    expect(isi).not.toMatch(/tidak hadir/);
    expect(isi).toMatch(/Pemohon/);
  });

  it("cerai talak: sebutannya Pemohon/Termohon, bukan Penggugat/Tergugat", async () => {
    tiruFetch([{ peran: "pemohon", sisi: "pihak_1", nama: "Ahmad", jam: "08:47" }]);
    render(<KehadiranSidang perkaraId="77" nomorPerkara="45/Pdt.G/2026/PA.Dgl" jenisPerkara="Cerai Talak" riwayatSidang={RIWAYAT} />);
    const kotak = await screen.findByText("Dari kehadiran yang dicatat di antrian");
    const isi = kotak.closest("[data-usulan-bas-kehadiran]")!.textContent ?? "";
    expect(isi).toMatch(/Pemohon/);
    expect(isi).not.toMatch(/Penggugat|Tergugat/);
  });
});
