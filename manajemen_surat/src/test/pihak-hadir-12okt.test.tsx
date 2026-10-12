/**
 * Jadwal Sidang, 12 Okt 2026 - agen H, butir 18:
 * nama pihak yang sudah hadir hari ini hijau + "(hadir)" (tanpa jam), saklar `pihak-hadir`.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { CONTOH_TAMPILAN } from "@/components/portal/contoh-tampilan";
import { NamaPihakHadir } from "@/components/portal/pihak-hadir";
import { pihakHadirHariIni } from "@/lib/pihak-hadir";
import { SAKLAR_TAMPILAN, tampil, tampilanBawaan } from "@/lib/tampilan-antrian-sidang";

const layar = readFileSync(path.resolve(process.cwd(), "src/components/portal/aleta-ecourt-sidang.tsx"), "utf8");
const HARI_INI = "2026-10-12";

afterEach(() => cleanup());

describe("pihakHadirHariIni (logika murni)", () => {
  it("satu sisi hadir: hanya sisi itu", () => {
    expect(pihakHadirHariIni({ pihak1: "08:15", pihak2: "" }, HARI_INI, HARI_INI)).toEqual({ pihak1: true, pihak2: false });
    expect(pihakHadirHariIni({ pihak1: "", pihak2: "08:37" }, HARI_INI, HARI_INI)).toEqual({ pihak1: false, pihak2: true });
    expect(pihakHadirHariIni({ pihak1: "09:21", pihak2: "08:37" }, HARI_INI, HARI_INI)).toEqual({ pihak1: true, pihak2: true });
  });

  it("gagal-tertutup: tanpa antrian, bukan hari ini, atau tanggal tak terbaca", () => {
    const kosong = { pihak1: false, pihak2: false };
    expect(pihakHadirHariIni(undefined, HARI_INI, HARI_INI)).toEqual(kosong);
    expect(pihakHadirHariIni(null, HARI_INI, HARI_INI)).toEqual(kosong);
    expect(pihakHadirHariIni({ pihak1: "08:15", pihak2: "08:20" }, "2026-10-13", HARI_INI)).toEqual(kosong);
    expect(pihakHadirHariIni({ pihak1: "08:15", pihak2: "08:20" }, "", HARI_INI)).toEqual(kosong);
    expect(pihakHadirHariIni({ pihak1: "08:15" }, undefined, HARI_INI)).toEqual(kosong);
  });

  it("pembatalan kehadiran (kolom dikosongkan) = kembali normal", () => {
    expect(pihakHadirHariIni({ pihak1: "   ", pihak2: "" }, HARI_INI, HARI_INI)).toEqual({ pihak1: false, pihak2: false });
  });
});

describe("render NamaPihakHadir", () => {
  function Baris({ a }: { a: { pihak1?: string; pihak2?: string } }) {
    const h = pihakHadirHariIni(a, HARI_INI, HARI_INI);
    return (
      <div>
        <div data-testid="p">
          <NamaPihakHadir aktif hadir={h.pihak1}>
            <span>Fulan bin Fulan</span>
          </NamaPihakHadir>
        </div>
        <div data-testid="t">
          <NamaPihakHadir aktif hadir={h.pihak2}>
            <span>Fulanah binti Fulan</span>
          </NamaPihakHadir>
        </div>
      </div>
    );
  }

  it("satu sisi hadir: hijau + (hadir) tanpa jam; sisi lain tidak", () => {
    render(<Baris a={{ pihak1: "08:15", pihak2: "" }} />);
    const p = screen.getByTestId("p");
    const t = screen.getByTestId("t");
    const tanda = p.querySelector("[data-pihak-hadir]") as HTMLElement;
    expect(tanda).not.toBeNull();
    expect(tanda.className).toContain("text-emerald-700");
    expect(tanda.className).toContain("dark:text-emerald-400");
    expect(p.textContent).toContain("Fulan bin Fulan");
    expect(p.textContent).toContain("(hadir)");
    expect(p.textContent).not.toMatch(/\d{2}:\d{2}/);
    expect(t.querySelector("[data-pihak-hadir]")).toBeNull();
    expect(t.textContent).toBe("Fulanah binti Fulan");
  });

  it("saklar mati: tidak ada tanda walau sudah hadir", () => {
    render(
      <NamaPihakHadir aktif={false} hadir>
        <span>Fulan</span>
      </NamaPihakHadir>
    );
    expect(document.querySelector("[data-pihak-hadir]")).toBeNull();
    expect(document.body.textContent).toBe("Fulan");
  });
});

describe("saklar pihak-hadir", () => {
  it("terdaftar di kelompok penanda, menyala bawaan, tidak wajib, punya contoh", () => {
    const s = SAKLAR_TAMPILAN.find((x) => x.kunci === "pihak-hadir");
    expect(s?.kelompok).toBe("penanda");
    expect(s?.wajib ?? false).toBe(false);
    expect(s?.bawaanMati ?? false).toBe(false);
    expect(tampil(tampilanBawaan(), "pihak-hadir")).toBe(true);
    expect(s?.keterangan).toContain("(hadir)");
    expect(CONTOH_TAMPILAN["pihak-hadir"]).toBeTruthy();
  });

  it("layar memakai saklar, NamaPihakHadir pada P, T, dan rincian; jam di nama tidak ditulis", () => {
    expect(layar).toContain('tampil(tampilan, "pihak-hadir")');
    expect(layar).toContain("hadir={hadirIni(baris).pihak1}");
    expect(layar).toContain("hadir={hadirIni(baris).pihak2}");
    expect(layar).toContain("pihakHadir={hadirIni(baris)}");
    expect(layar).toContain("kelompok.sisi === 1 ? pihakHadir.pihak1 : pihakHadir.pihak2");
  });
});
