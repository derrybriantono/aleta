import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// 27 Okt: menu "Alat saya" yang tinggi didorong ke top 8px sehingga naik ke belakang kepala panel
// (z-index 35) dan bagian atasnya terpotong. Kini menu tetap di bawah (atau di atas) tombol dan digulir di dalam.
const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const JS = readFileSync(path.join(AKAR, "blangko-derry.js"), "utf8");
const CSS = readFileSync(path.join(AKAR, "blangko-derry.css"), "utf8");
const SUMBER = JS.slice(JS.indexOf("  function taruh(pop, jangkar) {"), JS.indexOf("  const JANGKAR ="));

type Kotak = { top: number; bottom: number; left: number; right: number };
function jalankan(vh: number, jangkar: Kotak, tinggiIsi: number) {
  const pop = { hidden: true, offsetWidth: 320, offsetHeight: tinggiIsi, scrollHeight: tinggiIsi, style: {} as Record<string, string> };
  const tombol = { getBoundingClientRect: () => jangkar };
  const taruh = new Function("S", "document", "window", `${SUMBER}; return taruh;`)(
    { skala: 1 },
    { documentElement: { clientWidth: 1400 } },
    { innerWidth: 1400, innerHeight: vh },
  ) as (p: typeof pop, j: typeof tombol) => void;
  taruh(pop, tombol);
  const top = parseFloat(pop.style.top);
  return { top, bawah: top + parseFloat(pop.style.maxHeight) };
}

describe("menu Alat saya tidak terpotong (27 Okt)", () => {
  const tombol = { top: 140, bottom: 165, left: 1240, right: 1330 };

  it("menu lebih tinggi dari layar tetap mulai di bawah tombol dan muat di layar", () => {
    for (const vh of [1080, 768, 600]) {
      const r = jalankan(vh, tombol, 2000);
      expect(r.top).toBeGreaterThanOrEqual(tombol.bottom);
      expect(r.bawah).toBeLessThanOrEqual(vh - 8);
    }
  });

  it("tombol di dekat dasar layar: menu dibuka ke atas tanpa menutupi tombol", () => {
    const bawah = { top: 700, bottom: 725, left: 1240, right: 1330 };
    const r = jalankan(768, bawah, 2000);
    expect(r.bawah).toBeLessThanOrEqual(bawah.top);
    expect(r.top).toBeGreaterThanOrEqual(8);
  });

  it("menu pendek memakai tinggi aslinya", () => {
    const r = jalankan(1080, tombol, 300);
    expect(r.bawah - r.top).toBe(300);
  });

  it("kotak melayang berada di atas kepala panel yang menempel", () => {
    const zMelayang = Number(/\.bd-float \{[^}]*z-index:\s*(\d+)/.exec(CSS)?.[1]);
    const zKepala = Number(/\.bd-layar > \.bd-atas \{[^}]*z-index:\s*(\d+)/.exec(CSS)?.[1]);
    expect(zMelayang).toBeGreaterThan(zKepala);
  });
});
