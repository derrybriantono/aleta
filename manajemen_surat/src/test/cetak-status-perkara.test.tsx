/**
 * ============================================================================
 * CETAKAN STATUS PERKARA - PERSIAPANNYA DIJALANKAN, LINGKUPNYA DIURAI
 * ============================================================================
 *
 * Permintaan pengguna 27 September 2026, butir 2: hasil tombol Cetak di Status
 * Perkara "warnanya tidak cocok / putih semua" - tulisan tema gelap tercetak
 * di kertas putih.
 *
 * Warna terhitung di kertas DIUKUR di Chromium sungguhan (replika statis
 * dengan CSS hasil build portal, emulasi media print) - jsdom tidak menghitung
 * kaskade. Yang dijaga di sini adalah dua hal yang dapat dijalankan jsdom:
 *
 *   1. PERSIAPANNYA. beforeprint melepas .dark dan memasang tanda halaman;
 *      afterprint mengembalikan persis keadaan semula - DUA ARAH: layar
 *      gelap kembali gelap, layar terang TETAP terang. Cacat yang memasang
 *      .dark tanpa syarat selalu benar pada layar gelap, dan hanya terlihat
 *      pada layar terang.
 *
 *   2. LINGKUPNYA. Lembar cetak lain (hasil pencarian, jadwal, relaas,
 *      riwayat) tidak boleh berubah. Tiap selektor aturan cetak diurai dari
 *      lembar gayanya sendiri dan harus bergerbang pada tanda halaman atau
 *      pembungkus Status Perkara.
 */
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ATRIBUT_CATATAN_CETAK,
  ATRIBUT_CETAK_HALAMAN,
  GAYA_CETAK_STATUS_PERKARA,
  NILAI_CETAK_HALAMAN,
  PENANDA_PEMBUNGKUS_CETAK,
  mulaiCetakStatusPerkara,
  useCetakStatusPerkara,
} from "@/components/portal/cetak-status-perkara";

const html = () => document.documentElement;

function pasangPembungkus() {
  const div = document.createElement("div");
  div.setAttribute(PENANDA_PEMBUNGKUS_CETAK, "");
  div.textContent = "isi status perkara";
  document.body.appendChild(div);
  return div;
}

beforeEach(() => {
  html().className = "";
  html().removeAttribute(ATRIBUT_CETAK_HALAMAN);
  document.body.innerHTML = "";
});

afterEach(() => {
  cleanup();
  html().className = "";
  html().removeAttribute(ATRIBUT_CETAK_HALAMAN);
  document.body.innerHTML = "";
});

describe("persiapan cetak - dua arah", () => {
  it("layar GELAP: .dark dilepas selama mencetak, lalu dipasang kembali", () => {
    html().classList.add("dark");
    const pembungkus = pasangPembungkus();

    const pulihkan = mulaiCetakStatusPerkara(document, new Date("2026-09-27T02:15:00Z"));
    expect(pulihkan).not.toBeNull();
    expect(html().classList.contains("dark")).toBe(false);
    expect(html().getAttribute(ATRIBUT_CETAK_HALAMAN)).toBe(NILAI_CETAK_HALAMAN);
    // 02:15 UTC = 10:15 WITA - jam pengadilan, bukan jam mesin.
    expect(pembungkus.getAttribute(ATRIBUT_CATATAN_CETAK)).toBe(
      "Dicetak dari ALETA, Minggu, 27-09-2026 pukul 10:15 WITA. Bagian yang terciut di layar hanya tercetak judulnya."
    );

    pulihkan!();
    expect(html().classList.contains("dark")).toBe(true);
    expect(html().hasAttribute(ATRIBUT_CETAK_HALAMAN)).toBe(false);
    expect(pembungkus.hasAttribute(ATRIBUT_CATATAN_CETAK)).toBe(false);

    // Dipanggil dua kali (afterprint ganda) tidak mengubah apa pun lagi.
    pulihkan!();
    expect(html().classList.contains("dark")).toBe(true);
  });

  it("layar TERANG: tetap terang sesudah mencetak - .dark tidak dipasang tanpa syarat", () => {
    pasangPembungkus();
    const pulihkan = mulaiCetakStatusPerkara(document);
    expect(html().classList.contains("dark")).toBe(false);
    expect(html().getAttribute(ATRIBUT_CETAK_HALAMAN)).toBe(NILAI_CETAK_HALAMAN);
    pulihkan!();
    expect(html().classList.contains("dark")).toBe(false);
    expect(html().hasAttribute(ATRIBUT_CETAK_HALAMAN)).toBe(false);
  });

  it("lembar cetak LAIN sedang ditempel: tidak ada yang disentuh", () => {
    html().classList.add("dark");
    pasangPembungkus();
    const lembar = document.createElement("div");
    lembar.id = "aleta-cetak-jadwal";
    document.body.appendChild(lembar);

    expect(mulaiCetakStatusPerkara(document)).toBeNull();
    expect(html().classList.contains("dark")).toBe(true);
    expect(html().hasAttribute(ATRIBUT_CETAK_HALAMAN)).toBe(false);
  });

  it("halaman tanpa Status Perkara: tidak ada yang disentuh", () => {
    html().classList.add("dark");
    expect(mulaiCetakStatusPerkara(document)).toBeNull();
    expect(html().classList.contains("dark")).toBe(true);
  });
});

function Pendengar() {
  useCetakStatusPerkara();
  return null;
}

describe("beforeprint/afterprint - juga untuk Ctrl+P, bukan hanya tombol Cetak", () => {
  it("peristiwa peramban menjalankan persiapan dan pemulihannya", () => {
    html().classList.add("dark");
    pasangPembungkus();
    render(<Pendengar />);

    act(() => {
      window.dispatchEvent(new Event("beforeprint"));
    });
    expect(html().classList.contains("dark")).toBe(false);
    expect(html().getAttribute(ATRIBUT_CETAK_HALAMAN)).toBe(NILAI_CETAK_HALAMAN);

    act(() => {
      window.dispatchEvent(new Event("afterprint"));
    });
    expect(html().classList.contains("dark")).toBe(true);
    expect(html().hasAttribute(ATRIBUT_CETAK_HALAMAN)).toBe(false);
  });

  it("ditinggalkan di tengah mencetak: tema tetap kembali", () => {
    html().classList.add("dark");
    pasangPembungkus();
    const { unmount } = render(<Pendengar />);
    act(() => {
      window.dispatchEvent(new Event("beforeprint"));
    });
    expect(html().classList.contains("dark")).toBe(false);
    unmount();
    expect(html().classList.contains("dark")).toBe(true);
    // Sesudah dilepas, pendengarnya tidak tertinggal.
    act(() => {
      window.dispatchEvent(new Event("beforeprint"));
    });
    expect(html().classList.contains("dark")).toBe(true);
  });
});

/**
 * Selektor seluruh aturan cetak, diurai dari lembar gayanya lewat CSSOM -
 * bukan dicari sebagai potongan teks.
 */
function selektorCetak(css: string): string[] {
  const gaya = document.createElement("style");
  gaya.textContent = css;
  document.head.appendChild(gaya);
  const hasil: string[] = [];
  const telusur = (aturan: CSSRuleList) => {
    for (const satu of Array.from(aturan)) {
      if ("cssRules" in satu && (satu as CSSMediaRule).media) {
        expect((satu as CSSMediaRule).media.mediaText).toBe("print");
        telusur((satu as CSSMediaRule).cssRules);
      } else if ("selectorText" in satu) {
        hasil.push(...String((satu as CSSStyleRule).selectorText).split(/,(?![^(]*\))/).map((x) => x.trim()));
      } else {
        throw new Error(`aturan di luar @media print: ${satu.cssText}`);
      }
    }
  };
  telusur(gaya.sheet!.cssRules);
  gaya.remove();
  return hasil;
}

/** Selektor yang bergerbang: hanya dapat mengena di dalam Status Perkara yang sedang dicetak. */
function bergerbang(selektor: string): boolean {
  const gerbangHalaman = `html[${ATRIBUT_CETAK_HALAMAN}="${NILAI_CETAK_HALAMAN}"]`;
  return selektor.startsWith(gerbangHalaman) || selektor.startsWith(`[${PENANDA_PEMBUNGKUS_CETAK}]`);
}

describe("lingkup aturan cetak", () => {
  it("seluruh aturan berada di dalam @media print dan bergerbang pada halaman ini", () => {
    const selektor = selektorCetak(GAYA_CETAK_STATUS_PERKARA);
    expect(selektor.length).toBeGreaterThan(10);
    const bocor = selektor.filter((x) => !bergerbang(x));
    expect(bocor).toEqual([]);
  });

  it("penjaga lingkup MENGGIGIT: aturan tanpa gerbang tertangkap", () => {
    // Bukti bahwa penjaga di atas tidak hijau dengan sendirinya.
    const bocor = GAYA_CETAK_STATUS_PERKARA.replace(
      "@media print {",
      "@media print {\n  body > * { display: none !important; }"
    );
    expect(selektorCetak(bocor).filter((x) => !bergerbang(x))).toEqual(["body > *"]);
  });
});
