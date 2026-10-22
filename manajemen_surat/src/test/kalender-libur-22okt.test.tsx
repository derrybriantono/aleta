import { readFileSync } from "node:fs";
import path from "node:path";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PemilihTanggalSidang } from "@/components/ui/pemilih-tanggal-sidang";

/**
 * 22 Okt 2026 - SATU kalender pemilih tanggal bertanda libur: libur nasional /
 * cuti bersama / Sabtu-Minggu dibedakan dan bernama, tidak dapat dipilih untuk
 * tanggal yang menulis, boleh dibuka untuk tanggal tampilan, hari ini & usulan
 * bertanda, papan ketik, dipakai di keempat tempat.
 */

function Contoh({ awal, catat, ...lain }: { awal: string; catat: (v: string) => void; usulan?: string; liburBolehDipilih?: boolean }) {
  const [nilai, setNilai] = useState(awal);
  return createElement(PemilihTanggalSidang, {
    value: nilai,
    "aria-label": "Tanggal",
    onChange: (v: string) => {
      catat(v);
      setNilai(v);
    },
    ...lain,
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const buka = () => fireEvent.click(screen.getByRole("button", { name: /Buka kalender/ }));

describe("kalender libur bersama", () => {
  it("libur nasional, cuti bersama, Sabtu/Minggu dibedakan, bernama, tidak dapat dipilih; usulan bertanda", () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => null })));
    render(createElement(Contoh, { awal: "2026-12-21", catat: vi.fn(), usulan: "2026-12-28" }));
    buka();
    const natal = screen.getByRole("button", { name: /25 Desember 2026, hari libur Kelahiran Yesus Kristus, tidak dapat dipilih - Libur nasional/ }) as HTMLButtonElement;
    expect(natal.disabled).toBe(true);
    expect(natal.getAttribute("data-jenis-libur")).toBe("nasional");
    expect(natal.title).toContain("Libur nasional: Kelahiran Yesus Kristus");
    const cuti = screen.getByRole("button", { name: /24 Desember 2026, hari libur .* - Cuti bersama/ }) as HTMLButtonElement;
    expect(cuti.getAttribute("data-jenis-libur")).toBe("cuti-bersama");
    expect(cuti.disabled).toBe(true);
    expect((screen.getByRole("button", { name: /27 Desember 2026, hari libur Minggu/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: /Senin, 28 Desember 2026, tanggal usulan/ }).getAttribute("data-usulan")).toBe("ya");
    const isi = screen.getByRole("dialog").textContent || "";
    expect(isi).toContain("Libur nasional");
    expect(isi).toContain("Cuti bersama");
    expect(isi).toContain("Usulan");
  });

  it("papan ketik: panah memindah, Enter memilih hari kerja, Esc menutup", () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => null })));
    const catat = vi.fn();
    render(createElement(Contoh, { awal: "2026-12-21", catat }));
    buka();
    const senin = screen.getByRole("button", { name: "Senin, 21 Desember 2026" });
    fireEvent.keyDown(senin, { key: "ArrowRight" });
    fireEvent.keyDown(screen.getByRole("button", { name: "Selasa, 22 Desember 2026" }), { key: "Enter" });
    expect(catat).toHaveBeenCalledWith("2026-12-22");
    buka();
    // Enter pada hari libur tidak memilih.
    fireEvent.keyDown(screen.getByRole("button", { name: /25 Desember 2026, hari libur/ }), { key: "Enter" });
    expect(catat).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("tanggal tampilan: libur bertanda tetapi boleh dibuka", () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => null })));
    const catat = vi.fn();
    render(createElement(Contoh, { awal: "2026-12-21", catat, liburBolehDipilih: true }));
    buka();
    const natal = screen.getByRole("button", { name: /25 Desember 2026, hari libur Kelahiran Yesus Kristus - Libur nasional/ }) as HTMLButtonElement;
    expect(natal.disabled).toBe(false);
    fireEvent.click(natal);
    expect(catat).toHaveBeenCalledWith("2026-12-25");
  });

  it("dipakai di tunda ringkas & Hasil Sidang, Per panitera sidang, tanggal tampilan Jadwal Sidang, dan Jadwal Mediasi", () => {
    const baca = (b: string) => readFileSync(path.resolve(process.cwd(), "src/components/portal", b), "utf8");
    expect(baca("hasil-sidang.tsx").match(/<PemilihTanggalSidang/g)?.length).toBeGreaterThanOrEqual(4);
    expect(baca("jadwal-keliling-hakim.tsx").match(/<PemilihTanggalSidang/g)?.length).toBeGreaterThanOrEqual(2);
    const sidang = baca("aleta-ecourt-sidang.tsx");
    expect(sidang.match(/<PemilihTanggalSidang[\s\S]{0,200}liburBolehDipilih/g)?.length).toBe(2);
    expect(sidang).not.toMatch(/<Input\s+type="date"\s+value=\{dari\}/);
    const mediasi = baca("aleta-ecourt-mediasi.tsx");
    expect(mediasi.match(/<PemilihTanggalSidang[^>]*liburBolehDipilih/g)?.length).toBe(2);
  });
});
