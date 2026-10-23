import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PemilihTanggalSidang } from "@/components/ui/pemilih-tanggal-sidang";

/**
 * 23 Okt 2026 - permintaan pengguna atas pemilih tanggal bersama:
 * ikon kalender bawaan peramban (tanpa tanda libur) disembunyikan selama tombol
 * kalender libur tampil; keterangan "hari libur" pada tanggal tampilan tidak
 * menambah tinggi kotak (baris alat tetap sejajar); Sabtu/Minggu merah.
 */

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function gambar(props: Record<string, unknown>) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => null })));
  return render(createElement(PemilihTanggalSidang, { onChange: () => undefined, "aria-label": "Tanggal uji", ...props } as never));
}

const IKON_BAWAAN_TERSEMBUNYI = "[&::-webkit-calendar-picker-indicator]:hidden";

describe("pemilih tanggal: satu ikon kalender", () => {
  it("ikon bawaan peramban disembunyikan bila kalender libur tampil, dan kembali bila saklarnya mati", () => {
    const nyala = gambar({ value: "2026-10-23", liburBolehDipilih: true });
    expect(within(nyala.container).getByLabelText("Tanggal uji").className).toContain(IKON_BAWAAN_TERSEMBUNYI);
    nyala.unmount();
    // Tanpa tombol kalender libur, ikon bawaan tetap menjadi satu-satunya jalan memilih dari kalender.
    const mati = gambar({ value: "2026-10-23", liburBolehDipilih: true, tampilKalender: false });
    expect(within(mati.container).getByLabelText("Tanggal uji").className).not.toContain(IKON_BAWAAN_TERSEMBUNYI);
  });
});

describe("pemilih tanggal: keterangan libur tidak mendorong baris", () => {
  it("tanggal tampilan: keterangan melayang di bawah kotak (absolute), tidak ikut tinggi kotak", () => {
    const { container } = gambar({ value: "2026-10-24", liburBolehDipilih: true });
    const ket = container.querySelector("[data-tanggal-libur]") as HTMLElement;
    expect(ket.textContent).toContain("Sabtu, 24 Oktober 2026 hari libur");
    expect(ket.className).toMatch(/\babsolute\b/);
    expect(ket.className).toMatch(/\btop-full\b/);
    expect(ket.className).toMatch(/\bpointer-events-none\b/);
  });

  it("tanggal yang menulis: keterangan tetap mengalir di bawah kotak (formulir, bukan baris alat)", () => {
    const { container } = gambar({ value: "2026-10-24" });
    const ket = container.querySelector("[data-tanggal-libur]") as HTMLElement;
    expect(ket.textContent).toContain("Pilih hari kerja lain");
    expect(ket.className).not.toMatch(/\babsolute\b/);
  });
});

describe("kalender libur: Sabtu/Minggu merah", () => {
  it("tanggal dan judul kolom Sab/Min merah tanpa latar; libur nasional tetap berlatar", () => {
    gambar({ value: "2026-12-21", liburBolehDipilih: true });
    fireEvent.click(screen.getByRole("button", { name: /Buka kalender/ }));
    const kalender = screen.getByRole("dialog");
    const sabtu = within(kalender).getByRole("button", { name: /Sabtu, 26 Desember 2026, hari libur/ });
    const minggu = within(kalender).getByRole("button", { name: /Minggu, 27 Desember 2026, hari libur/ });
    for (const el of [sabtu, minggu]) {
      expect(el.className).toContain("text-red-600");
      expect(el.className).not.toMatch(/\bbg-red-50\b/);
    }
    const natal = within(kalender).getByRole("button", { name: /25 Desember 2026, hari libur Kelahiran Yesus Kristus/ });
    expect(natal.className).toMatch(/\bbg-red-50\b/);
    const senin = within(kalender).getByRole("button", { name: "Senin, 21 Desember 2026" });
    expect(senin.className).not.toContain("text-red-600");
    expect(within(kalender).getByText("Sab").className).toContain("text-red-600");
    expect(within(kalender).getByText("Min").className).toContain("text-red-600");
    expect(within(kalender).getByText("Jum").className).not.toContain("text-red-600");
    expect(within(kalender).getByText("Sabtu/Minggu").className).toContain("text-red-600");
  });

  it("Sabtu/Minggu sebelum batas min tampil redup dan tidak dapat dipilih", () => {
    gambar({ value: "2026-10-23", min: "2026-10-23", liburBolehDipilih: true });
    fireEvent.click(screen.getByRole("button", { name: /Buka kalender/ }));
    const sabtu = screen.getByRole("button", { name: /Sabtu, 17 Oktober 2026/ }) as HTMLButtonElement;
    expect(sabtu.disabled).toBe(true);
    expect(sabtu.className).toContain("opacity-50");
  });
});
