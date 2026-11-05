/**
 * ALETA ABT satu tema dengan panel Blangko ABT by Derry Briantono (5 Nov 2026), supaya pengguna tidak kaget saat pindah.
 * Warna tema halaman harus sama dengan warna panel; bila warna panel berubah, uji ini mengingatkan untuk menyamakan.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = process.cwd();
const tema = readFileSync(path.join(AKAR, "src/app/(portal)/aleta-abt/tema-panel.css"), "utf8");
const panel = readFileSync(path.join(AKAR, "../ekstensi-sipp/blangko-derry.css"), "utf8");
const tataLetak = readFileSync(path.join(AKAR, "src/app/(portal)/aleta-abt/layout.tsx"), "utf8");

function keHsl(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const maks = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (maks + min) / 2;
  const d = maks - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) h = maks === r ? ((g - b) / d) % 6 : maks === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return `${Math.round(((h * 60 + 360) % 360))} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
const warnaPanel = (blok: string, nama: string) => new RegExp(`--${nama}:\\s*(#[0-9a-f]{6})`, "i").exec(blok)?.[1] ?? "";
const warnaTema = (blok: string, nama: string) => new RegExp(`--${nama}:\\s*([^;]+);`).exec(blok)?.[1].trim() ?? "";

const panelTerang = panel.slice(panel.indexOf('#aleta-bd-akar[data-tema="terang"], #aleta-bd-tawar[data-tema="terang"]'));
const panelGelap = panel.slice(0, panel.indexOf('#aleta-bd-akar[data-tema="terang"], #aleta-bd-tawar[data-tema="terang"]'));
const temaGelap = tema.slice(tema.indexOf(".dark .aleta-abt-tema"));
const temaTerang = tema.slice(0, tema.indexOf(".dark .aleta-abt-tema"));

describe("ALETA ABT satu tema dengan panel Blangko ABT by Derry", () => {
  const PETA: Array<[string, string]> = [
    ["background", "bg"],
    ["foreground", "fg"],
    ["card", "panel"],
    ["muted", "panel2"],
    ["muted-foreground", "muted"],
    ["border", "line"],
    ["ring", "accent"],
    ["primary", "hijau"],
  ];
  it.each(PETA)("terang: %s sama dengan warna panel %s", (t, p) => {
    expect(warnaTema(temaTerang, t)).toBe(keHsl(warnaPanel(panelTerang, p)));
  });
  it.each(PETA)("gelap: %s sama dengan warna panel %s", (t, p) => {
    expect(warnaTema(temaGelap, t)).toBe(keHsl(warnaPanel(panelGelap, p)));
  });
  it("semua halaman ALETA ABT dibungkus tema ini", () => {
    expect(tataLetak).toContain('import "./tema-panel.css"');
    expect(tataLetak).toContain('className="aleta-abt-tema"');
  });
});
