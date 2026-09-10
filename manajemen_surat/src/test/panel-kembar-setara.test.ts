// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * DUA SALINAN PERKAKAS PANEL - DIADU SEBELUM DISATUKAN
 * ============================================================================
 *
 * Tujuh fungsi panel hidup dua kali: satu di konten.js untuk panel SIPP, satu
 * di panel-alat.js untuk panel ABT. Catatan utang di panel-alat.js menyebut
 * penyatuannya "menuntut panel SIPP dibuka di layar sungguhan sesudahnya" -
 * dan halaman itu tidak dapat dibuka dari lingkungan pengembangan.
 *
 * Berkas ini menggantikan layar itu dengan sesuatu yang lebih keras: kedua
 * salinan DIJALANKAN atas panel palsu yang sama, melalui keadaan yang sama,
 * lalu hasilnya diadu ruas demi ruas. Yang setara terbukti setara; yang
 * berselisih ketahuan beserta selisihnya.
 *
 * ============================================================================
 * KENAPA INI BERGUNA WALAU PENYATUANNYA BELUM DIKERJAKAN
 * ============================================================================
 *
 * Selama keduanya masih hidup berdampingan, keduanya akan menyimpang - itu
 * selalu terjadi, dan menyimpangnya diam. Panel SIPP lalu berperilaku berbeda
 * dari panel ABT atas tarikan yang sama, dan tidak ada yang tahu sampai
 * seseorang membandingkannya dengan tangan.
 *
 * Uji ini menahan penyimpangan itu sejak sekarang, dan sekaligus menjadi jaring
 * pengaman ketika salinan konten.js kelak benar-benar dibuang.
 */

const akar = path.resolve(process.cwd(), "..");
const konten = readFileSync(path.join(akar, "ekstensi-sipp/konten.js"), "utf8").replace(/\r\n/g, "\n");
const alat = readFileSync(path.join(akar, "ekstensi-sipp/panel-alat.js"), "utf8").replace(/\r\n/g, "\n");

/**
 * Memotong fungsi bernama dari sumbernya.
 *
 * Bersandar pada satu hal yang benar di kedua berkas: fungsi puncak dibuka di
 * kolom nol dan ditutup oleh "}" di kolom nol juga. Kalau kelak ada yang
 * menjorokkannya, potongannya gagal dan ujinya berbunyi - bukan diam-diam
 * menguji potongan yang salah.
 */
function potongFungsi(isi: string, nama: string[]): string {
  const baris = isi.split("\n");
  const hasil: string[] = [];
  const ketemu = new Set<string>();

  for (let i = 0; i < baris.length; i += 1) {
    const cocok = baris[i].match(/^(?:async )?function ([A-Za-z_$][\w$]*)\(/);
    if (!cocok || !nama.includes(cocok[1])) continue;
    let j = i;
    while (j < baris.length && baris[j] !== "}") j += 1;
    if (j >= baris.length) throw new Error(`penutup fungsi ${cocok[1]} tidak ditemukan`);
    hasil.push(baris.slice(i, j + 1).join("\n"));
    ketemu.add(cocok[1]);
  }

  const hilang = nama.filter((n) => !ketemu.has(n));
  if (hilang.length) throw new Error(`fungsi tidak ditemukan: ${hilang.join(", ")}`);
  return hasil.join("\n\n");
}

type Kotak = { left: number; top: number; width: number; height: number };

type PanelPalsu = {
  style: Record<string, string>;
  dataset: Record<string, string>;
  classList: { add: (...k: string[]) => void; remove: (...k: string[]) => void; contains: (k: string) => boolean };
  getBoundingClientRect: () => Kotak;
  isConnected: boolean;
};

function panelPalsu(kotak: Kotak, kelasAwal: string[] = []): PanelPalsu {
  const kelas = new Set(kelasAwal);
  return {
    style: {},
    dataset: {},
    classList: {
      add: (...k) => k.forEach((x) => kelas.add(x)),
      remove: (...k) => k.forEach((x) => kelas.delete(x)),
      contains: (k) => kelas.has(k),
    },
    getBoundingClientRect: () => kotak,
    isConnected: true,
  };
}

const JENDELA = { innerWidth: 1366, innerHeight: 800 };

/** Perkakas versi konten.js, beserta keadaan lingkup modul yang dipakainya. */
function perkakasKonten() {
  const sumber = potongFungsi(konten, [
    "jepitKeLayar",
    "jepitTinggiKeRuangTersisa",
    "terapkanPosisi",
    "normalkanJangkar",
    "kembalikanBawaan",
  ]);
  const tersimpan: Record<string, unknown> = {};
  const chromePalsu = {
    storage: {
      local: {
        get: async () => ({ ...tersimpan }),
        set: async (isi: Record<string, unknown>) => Object.assign(tersimpan, isi),
        remove: async (kunci: string) => {
          delete tersimpan[kunci];
        },
      },
    },
  };

  const buat = new Function(
    "window",
    "chrome",
    `const KUNCI_POSISI = "posisiPanel";
     let keadaanPanel = null;
     ${sumber}
     return { jepitKeLayar, jepitTinggiKeRuangTersisa, terapkanPosisi, normalkanJangkar, kembalikanBawaan };`
  ) as (w: unknown, c: unknown) => Record<string, (...a: unknown[]) => unknown>;

  return { fn: buat(JENDELA, chromePalsu), tersimpan };
}

/** Perkakas versi panel-alat.js - tanpa keadaan lingkup modul. */
function perkakasAlat() {
  const sumber = potongFungsi(alat, [
    "alatJepitKeLayar",
    "alatJepitTinggi",
    "alatTerapkanPosisi",
    "alatNormalkanJangkar",
    "alatKembalikanBawaan",
  ]);
  const tersimpan: Record<string, unknown> = {};
  const chromePalsu = {
    storage: {
      local: {
        get: async () => ({ ...tersimpan }),
        set: async (isi: Record<string, unknown>) => Object.assign(tersimpan, isi),
        remove: async (kunci: string) => {
          delete tersimpan[kunci];
        },
      },
    },
  };

  // Tetapan yang dipakai fungsi-fungsi itu DIBACA dari sumbernya, tidak
  // ditulis ulang di sini. Nilai yang disalin akan menyimpang diam-diam, dan
  // uji yang memakai nilai menyimpang menguji kelas yang tidak ada.
  const cocokKelas = alat.match(/const KELAS_LENCANA = "([^"]+)"/);
  if (!cocokKelas) throw new Error("KELAS_LENCANA tidak ditemukan di panel-alat.js");

  const buat = new Function(
    "window",
    "chrome",
    `const KELAS_LENCANA = ${JSON.stringify(cocokKelas[1])};
     ${sumber}
     return { alatJepitKeLayar, alatJepitTinggi, alatTerapkanPosisi, alatNormalkanJangkar, alatKembalikanBawaan };`
  ) as (w: unknown, c: unknown) => Record<string, (...a: unknown[]) => unknown>;

  return { fn: buat(JENDELA, chromePalsu), tersimpan };
}

const K = perkakasKonten();
const A = perkakasAlat();

describe("penjepit tepi layar", () => {
  it("memulangkan angka yang sama", () => {
    for (const [kiri, atas, lebar] of [
      [100, 100, 320],
      [-50, -50, 320],
      [5000, 5000, 320],
      [1200, 700, 400],
    ]) {
      // Versi konten menerima tinggi sebagai argumen keempat dan TIDAK
      // memakainya - argumen mati yang menyamarkan bahwa keduanya sama.
      expect(K.fn.jepitKeLayar(kiri, atas, lebar, 200), `${kiri},${atas}`).toEqual(
        A.fn.alatJepitKeLayar(kiri, atas, lebar)
      );
    }
  });
});

describe("penjepit tinggi", () => {
  const keadaan: Array<[string, Kotak, string[], Record<string, string>]> = [
    ["panel biasa yang kelewat tinggi", { left: 100, top: 50, width: 320, height: 900 }, [], {}],
    ["panel yang muat", { left: 100, top: 50, width: 320, height: 300 }, [], {}],
    ["tinggi pilihan sendiri", { left: 100, top: 50, width: 320, height: 700 }, [], { tinggiSendiri: "1" }],
    ["panel penuh", { left: 0, top: 0, width: 1366, height: 800 }, ["aleta-panel-penuh"], {}],
    ["panel ciut", { left: 100, top: 50, width: 320, height: 40 }, ["aleta-panel-ciut"], {}],
  ];

  for (const [nama, kotak, kelas, dataset] of keadaan) {
    it(`sama pada ${nama}`, () => {
      const p1 = panelPalsu(kotak, kelas);
      const p2 = panelPalsu(kotak, kelas);
      Object.assign(p1.dataset, dataset);
      Object.assign(p2.dataset, dataset);

      K.fn.jepitTinggiKeRuangTersisa(p1);
      A.fn.alatJepitTinggi(p2);

      expect(p1.style, nama).toEqual(p2.style);
    });
  }
});

describe("menerapkan posisi tersimpan", () => {
  const posisiUji: Array<[string, Record<string, number> | null]> = [
    ["posisi dan ukuran lengkap", { kiri: 200, atas: 120, lebar: 400, tinggi: 500 }],
    ["hanya posisi", { kiri: 200, atas: 120 }],
    ["hanya ukuran", { lebar: 400, tinggi: 500 }],
    ["ukuran melebihi layar", { kiri: 0, atas: 0, lebar: 5000, tinggi: 5000 }],
    ["tinggi nol - tidak diatur sendiri", { kiri: 200, atas: 120, lebar: 400, tinggi: 0 }],
  ];

  for (const [nama, posisi] of posisiUji) {
    it(`sama pada ${nama}`, () => {
      const kotak = { left: 200, top: 120, width: 320, height: 400 };
      const p1 = panelPalsu(kotak);
      const p2 = panelPalsu(kotak);

      K.fn.terapkanPosisi(p1, posisi);
      A.fn.alatTerapkanPosisi(p2, posisi);

      expect(p1.style, nama).toEqual(p2.style);
      expect(p1.dataset, `${nama} - dataset`).toEqual(p2.dataset);
    });
  }

  it("keduanya diam ketika tidak ada posisi tersimpan", () => {
    const kotak = { left: 0, top: 0, width: 320, height: 400 };
    const p1 = panelPalsu(kotak);
    const p2 = panelPalsu(kotak);

    K.fn.terapkanPosisi(p1, null);
    A.fn.alatTerapkanPosisi(p2, null);

    expect(p1.style).toEqual({});
    expect(p2.style).toEqual({});
  });
});

describe("menormalkan jangkar", () => {
  it("sama ketika panel belum berjangkar kiri", () => {
    const kotak = { left: 812.4, top: 96.6, width: 320, height: 400 };
    const p1 = panelPalsu(kotak);
    const p2 = panelPalsu(kotak);

    K.fn.normalkanJangkar(p1);
    A.fn.alatNormalkanJangkar(p2);

    expect(p1.style).toEqual(p2.style);
    // Dibulatkan, supaya panel tidak bergeser sepersekian piksel tiap muat.
    expect(p1.style.left).toBe("812px");
  });

  it("sama ketika panel sudah berjangkar - keduanya tidak menyentuhnya", () => {
    const kotak = { left: 100, top: 100, width: 320, height: 400 };
    const p1 = panelPalsu(kotak);
    const p2 = panelPalsu(kotak);
    p1.style.left = "500px";
    p2.style.left = "500px";

    K.fn.normalkanJangkar(p1);
    A.fn.alatNormalkanJangkar(p2);

    expect(p1.style).toEqual(p2.style);
    expect(p1.style.top).toBeUndefined();
  });
});

describe("mengembalikan ke bawaan", () => {
  it("membersihkan gaya yang sama", () => {
    const kotak = { left: 100, top: 50, width: 320, height: 300 };
    const p1 = panelPalsu(kotak);
    const p2 = panelPalsu(kotak);

    for (const p of [p1, p2]) {
      Object.assign(p.style, {
        left: "200px",
        top: "120px",
        width: "400px",
        height: "500px",
        maxHeight: "500px",
      });
      p.dataset.tinggiSendiri = "1";
    }

    K.fn.kembalikanBawaan(p1);
    A.fn.alatKembalikanBawaan(p2, "posisiPanel");

    expect(p1.style).toEqual(p2.style);
    expect(p1.dataset.tinggiSendiri).toBeUndefined();
    expect(p2.dataset.tinggiSendiri).toBeUndefined();
  });
});

describe("lencana tidak dijepit tingginya", () => {
  /**
   * Selisih yang ditemukan perkakas ini, lalu ditutup.
   *
   * konten.js sudah lama berhenti pada panel yang sedang menjadi logo
   * melayang; panel-alat.js tidak punya penjaga setara. Belum berakibat
   * apa-apa - lencana selalu lebih pendek daripada lantai 160 piksel - tetapi
   * itu kebetulan, bukan penjagaan.
   */
  it("lencana sependek apa pun tidak tersentuh", () => {
    const lencana = panelPalsu({ left: 1200, top: 700, width: 44, height: 44 }, ["aleta-panel-lencana"]);
    A.fn.alatJepitTinggi(lencana);
    expect(lencana.style).toEqual({});
  });

  it("lencana yang TINGGI pun tidak dijepit - inilah yang dulu bocor", () => {
    // Tanpa penjaganya, yang ini mendapat tinggi paksa: logo melayang yang
    // tiba-tiba memanjang, tanpa gejala yang menunjukkan sebabnya.
    const lencanaBesar = panelPalsu({ left: 1200, top: 100, width: 44, height: 900 }, ["aleta-panel-lencana"]);
    A.fn.alatJepitTinggi(lencanaBesar);
    expect(lencanaBesar.style).toEqual({});
  });

  it("panel biasa setinggi itu TETAP dijepit - penjaganya tidak kebablasan", () => {
    // Penjaga yang terlalu longgar sama buruknya: panel biasa yang tidak
    // dijepit akan menutupi seluruh sisi kanan halaman SIPP.
    const biasa = panelPalsu({ left: 1200, top: 100, width: 320, height: 900 });
    A.fn.alatJepitTinggi(biasa);
    expect(biasa.style.height).toBeDefined();
  });
});
