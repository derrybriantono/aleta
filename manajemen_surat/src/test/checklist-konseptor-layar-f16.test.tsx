// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChecklistKonseptor, LencanaKesiapanPutusan } from "@/components/portal/checklist-konseptor";
import { LANGKAH_KONSEPTOR, kelompokkanIsian, nilaiKemajuan, ringkasKemajuan } from "@/lib/konseptor-langkah";

/**
 * Checklist Konseptor Sementara di Jadwal Sidang (F1.6): lencana kesiapan di
 * Hari Putusan dan daftar langkah yang dibuka dari baris perkara.
 */

const PADA = "2026-10-17T00:10:00.000Z";
const KEMAJUAN = nilaiKemajuan(
  { amar: { selesai: true, oleh: "Hakim A", pada: PADA, catatan: "" } },
  {
    berkas: "[01] Putusan",
    terisi: 1,
    jumlah: 2,
    perLangkah: kelompokkanIsian([
      { kode: "8436", nama: "Kesimpulan Penggugat", terisi: true },
      { kode: "8437", nama: "Kesimpulan Tergugat", terisi: false },
    ]),
    oleh: "Hakim A",
    pada: PADA,
  }
);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LencanaKesiapanPutusan", () => {
  it("tanpa tunjukan tidak tampil; belum siap menyebut langkah; siap berwarna hijau", () => {
    const { container, rerender } = render(<LencanaKesiapanPutusan />);
    expect(container.textContent).toBe("");
    rerender(<LencanaKesiapanPutusan kemajuan={ringkasKemajuan(KEMAJUAN)} />);
    expect(screen.getByText("Draf 1/8 langkah").getAttribute("data-kesiapan-putusan")).toBe("belum");
    const semua = Object.fromEntries(LANGKAH_KONSEPTOR.map((l) => [l.kode, { selesai: true, oleh: "x", pada: PADA, catatan: "" }]));
    rerender(<LencanaKesiapanPutusan kemajuan={ringkasKemajuan(nilaiKemajuan(semua, null))} />);
    expect(screen.getByText("Draf siap dibacakan").getAttribute("data-kesiapan-putusan")).toBe("siap");
  });
});

describe("ChecklistKonseptor", () => {
  it("dibuka: memuat dari rute, menyebut isian blangko yang kosong, centang dikirim; 403 mengunci kotak", async () => {
    const panggilan: Array<{ url: string; body: unknown }> = [];
    let tolak = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, opsi: { method?: string; body?: string } = {}) => {
        panggilan.push({ url, body: opsi.body ? JSON.parse(opsi.body) : null });
        if (opsi.method === "POST" && tolak) return new Response(JSON.stringify({ ok: false, error: { message: "matriks peran" } }), { status: 403 });
        const data = opsi.method === "POST" ? { ok: true, alasan: "", kemajuan: KEMAJUAN } : { ada: true, peta: { "581": KEMAJUAN } };
        return new Response(JSON.stringify({ ok: true, data }), { status: 200 });
      })
    );
    const berubah = vi.fn();
    render(<ChecklistKonseptor perkaraId="581" nomorPerkara="581/Pdt.G/2026/PA.Dgl" kemajuan={ringkasKemajuan(KEMAJUAN)} onBerubah={berubah} />);
    expect(screen.getByRole("button", { name: /Checklist draf/ }).textContent).toContain("1/8");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Checklist draf/ }));
    });
    expect(panggilan[0].url).toContain("/api/aleta-ecourt/konseptor-langkah?perkaraId=581");
    expect(document.querySelector('[data-langkah="kesimpulan"]')!.getAttribute("data-status")).toBe("kosong");
    expect(document.body.textContent).toContain("Kesimpulan Tergugat");
    expect(document.querySelector('[data-langkah="amar"]')!.textContent).toContain("Hakim A");

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Tandai selesai: Duduk perkara"));
    });
    expect(panggilan.at(-1)!.body).toEqual({ perkaraId: "581", nomorPerkara: "581/Pdt.G/2026/PA.Dgl", langkah: "duduk", selesai: true });
    expect(berubah).toHaveBeenCalledTimes(1);

    tolak = true;
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Tandai selesai: Biaya perkara"));
    });
    expect(document.body.textContent).toContain("centang hanya oleh majelis dan panitera pengganti");
    expect((screen.getByLabelText("Tandai selesai: Biaya perkara") as HTMLInputElement).disabled).toBe(true);
  });
});
