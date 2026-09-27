import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import postcss from "postcss";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * TOMBOL UNDUH e-COURT DI JADWAL SIDANG SIPP, PADA MODE TERANG
 * ============================================================================
 *
 * Keluhan pengguna, 27 Sep 2026: tombol unduh berkas e-Court yang disisipkan
 * ke baris Jadwal Sidang SIPP "tidak nampak atau warna putih" pada mode terang,
 * dan hanya jelas pada mode gelap.
 *
 * Sebabnya bukan warna yang salah pilih, melainkan warna yang TIDAK ADA.
 * .aleta-unduh diwarnai token --aleta-* yang hanya didefinisikan di dalam
 * .aleta-panel, sedangkan kotak sisipan hidup di sel tabel SIPP. Di sana
 * var(--aleta-merek-tombol) tidak terdefinisi, deklarasinya gugur saat nilai
 * dihitung, dan tombolnya kehilangan latar serta garis tepinya - tulisannya
 * mewarisi abu SIPP, yang diputihkan SIPP sendiri begitu baris disorot.
 *
 * Uji penyapu teks tidak akan pernah menangkapnya: aturan .aleta-unduh ADA,
 * ditulis dengan benar, dan lulus pemeriksaan kontras mana pun yang membaca
 * nilainya dari blok .aleta-panel. Yang salah adalah TEMPAT tombolnya berdiri.
 * Karena itu uji ini menjalankan kaskadenya sendiri:
 *
 *   - kotak sisipan dibangun fungsi ASLI konten.js (kotakSisipan, tombolUnduh,
 *     buatElemen, keteranganSisa) di dalam tiruan tabel Jadwal Sidang;
 *   - panel.css diurai postcss, tiap pemilih dicocokkan dengan elemen
 *     sungguhan lewat element.matches, pemenangnya ditentukan !important,
 *     kekhususan, lalu urutan - seperti peramban;
 *   - var() diselesaikan lewat pewarisan leluhur, dan var yang tidak
 *     terdefinisi MENGGUGURKAN seluruh deklarasinya, termasuk seluruh longhand
 *     singkatan border - persis perilaku CSS yang menjadi sebab cacatnya.
 *
 * Tombol yang sama di DALAM panel dipakai sebagai pembanding: kalau
 * penyelesaiannya rusak dan menggugurkan semua, pembanding itulah yang merah
 * lebih dulu, sehingga uji ini tidak dapat lulus karena buta.
 *
 * Diukur juga di Chromium sungguhan (replika dengan CSS SIPP asli), 27 Sep 2026:
 * sebelum 3,95:1 dan 2,09:1 tanpa garis tepi; sesudah 6,16:1, garis 4,25:1
 * sampai 8,79:1; seluruh piksel mode gelap tidak berubah.
 */

const akar = path.resolve(process.cwd(), "..");
const gayaPanel = () => readFileSync(path.join(akar, "ekstensi-sipp/panel.css"), "utf8");
const konten = () => readFileSync(path.join(akar, "ekstensi-sipp/konten.js"), "utf8");

/**
 * Warna baris .cssTable milik SIPP (resources/css/table.css) - di luar repo
 * ini, jadi disalin sebagai tetapan:
 *   .cssTable tr:nth-child(even) {background-color:#F7F7F7}
 *   .cssTable tr:nth-child(odd)  {background-color:#C9E6C8}
 *   .cssTable tr:hover           {background:#85B39E; color:#fff}
 */
const BARIS_SIPP = { genap: "#f7f7f7", ganjil: "#c9e6c8", disorot: "#85b39e" } as const;

const AA_TULISAN = 4.5;
const AA_BENTUK = 3;

// ============================================================================
// WARNA
// ============================================================================

type Warna = [number, number, number, number];

const NAMA_WARNA: Record<string, Warna> = {
  transparent: [0, 0, 0, 0],
  white: [255, 255, 255, 1],
  black: [0, 0, 0, 1],
};

function pecahAtas(teks: string, pemisah: RegExp): string[] {
  const hasil: string[] = [];
  let dalam = 0;
  let kini = "";
  for (const ch of teks) {
    if (ch === "(") dalam += 1;
    if (ch === ")") dalam -= 1;
    if (dalam === 0 && pemisah.test(ch)) {
      if (kini.trim()) hasil.push(kini.trim());
      kini = "";
      continue;
    }
    kini += ch;
  }
  if (kini.trim()) hasil.push(kini.trim());
  return hasil;
}

function uraiWarna(teks: string): Warna | null {
  const t = teks.trim().toLowerCase();
  if (NAMA_WARNA[t]) return NAMA_WARNA[t];
  const heks = /^#([0-9a-f]{3,8})$/.exec(t);
  if (heks) {
    let h = heks[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((x) => x + x).join("");
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
  }
  const rgb = /^rgba?\((.*)\)$/.exec(t);
  if (rgb) {
    const bagian = rgb[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return [bagian[0], bagian[1], bagian[2], bagian.length > 3 ? bagian[3] : 1];
  }
  const campur = /^color-mix\(in srgb,(.*)\)$/.exec(t);
  if (campur) {
    const [a, b] = pecahAtas(campur[1], /,/);
    const bagi = (x: string) => {
      const p = /\s(\d+(?:\.\d+)?)%\s*$/.exec(x);
      return { warna: uraiWarna(p ? x.slice(0, p.index) : x), persen: p ? Number(p[1]) : null };
    };
    const kiri = bagi(a);
    const kanan = bagi(b);
    if (!kiri.warna || !kanan.warna) return null;
    const pKiri = kiri.persen ?? (kanan.persen === null ? 50 : 100 - kanan.persen);
    const w = pKiri / 100;
    return [0, 1, 2, 3].map((i) => kiri.warna![i] * w + kanan.warna![i] * (1 - w)) as Warna;
  }
  return null;
}

/** Warna atas yang (mungkin) tembus pandang, digambar di atas warna bawah. */
function tumpuk(atas: Warna, bawah: Warna): Warna {
  const a = atas[3];
  return [0, 1, 2].map((i) => atas[i] * a + bawah[i] * (1 - a)).concat(1) as Warna;
}

function luminansi(w: Warna): number {
  const f = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(w[0]) + 0.7152 * f(w[1]) + 0.0722 * f(w[2]);
}

function rasio(a: Warna, b: Warna): number {
  const x = luminansi(a);
  const y = luminansi(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// ============================================================================
// KASKADE
// ============================================================================

function tutupKurung(s: string, i: number, buka: string, tutup: string): number {
  let dalam = 0;
  for (let j = i; j < s.length; j += 1) {
    if (s[j] === buka) dalam += 1;
    else if (s[j] === tutup) {
      dalam -= 1;
      if (dalam === 0) return j;
    }
  }
  return s.length - 1;
}

type Kekhususan = [number, number, number];

function bandingKekhususan(x: Kekhususan, y: Kekhususan): number {
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}

/** Kekhususan satu pemilih kompleks, menurut Selectors Level 4. */
function kekhususan(pemilih: string): Kekhususan {
  let a = 0;
  let b = 0;
  let c = 0;
  let i = 0;
  const kata = /[\w-]/;
  while (i < pemilih.length) {
    const ch = pemilih[i];
    if (ch === "#") {
      a += 1;
      i += 1;
      while (i < pemilih.length && kata.test(pemilih[i])) i += 1;
    } else if (ch === ".") {
      b += 1;
      i += 1;
      while (i < pemilih.length && kata.test(pemilih[i])) i += 1;
    } else if (ch === "[") {
      b += 1;
      i = tutupKurung(pemilih, i, "[", "]") + 1;
    } else if (ch === ":") {
      if (pemilih[i + 1] === ":") {
        c += 1;
        i += 2;
        while (i < pemilih.length && kata.test(pemilih[i])) i += 1;
        if (pemilih[i] === "(") i = tutupKurung(pemilih, i, "(", ")") + 1;
        continue;
      }
      i += 1;
      let nama = "";
      while (i < pemilih.length && kata.test(pemilih[i])) nama += pemilih[i++];
      if (pemilih[i] === "(") {
        const akhir = tutupKurung(pemilih, i, "(", ")");
        const isi = pemilih.slice(i + 1, akhir);
        i = akhir + 1;
        if (nama === "where") continue;
        if (["is", "not", "has", "matches"].includes(nama)) {
          const terbesar = pecahAtas(isi, /,/)
            .map(kekhususan)
            .sort(bandingKekhususan)
            .pop() ?? [0, 0, 0];
          a += terbesar[0];
          b += terbesar[1];
          c += terbesar[2];
          continue;
        }
        b += 1;
        continue;
      }
      if (["before", "after", "first-line", "first-letter"].includes(nama)) c += 1;
      else b += 1;
    } else if (/[a-zA-Z]/.test(ch)) {
      c += 1;
      while (i < pemilih.length && kata.test(pemilih[i])) i += 1;
    } else {
      i += 1;
    }
  }
  return [a, b, c];
}

/**
 * Keadaan interaktif ditiru dengan atribut: :hover -> [data-uji-sorot],
 * :focus-visible -> [data-uji-fokus]. Kekhususannya sama (0,1,0), jadi
 * pemenang kaskadenya tidak bergeser karena penggantian ini.
 */
function tiruKeadaan(pemilih: string): string {
  return pemilih
    .replace(/:hover\b/g, "[data-uji-sorot]")
    .replace(/:focus-visible\b/g, "[data-uji-fokus]")
    .replace(/:focus-within\b/g, "[data-uji-fokus-dalam]")
    .replace(/:focus\b(?!-)/g, "[data-uji-fokus]")
    .replace(/:active\b/g, "[data-uji-aktif]");
}

type Deklarasi = {
  sifat: string;
  /** Nilai mentah; bila dari singkatan, seluruh singkatannya. */
  nilai: string;
  singkatan: "" | "background" | "border" | "outline";
  penting: boolean;
  kekhususan: Kekhususan;
  urutan: number;
  pemilih: string;
};

type Aturan = { pemilih: string[]; asli: string; deklarasi: Omit<Deklarasi, "kekhususan" | "pemilih" | "urutan">[]; urutan: number };

const LONGHAND: Record<string, Array<[string, Deklarasi["singkatan"]]>> = {
  background: [["background-color", "background"]],
  "background-color": [["background-color", ""]],
  color: [["color", ""]],
  border: [
    ["border-top-color", "border"],
    ["border-top-style", "border"],
    ["border-top-width", "border"],
  ],
  "border-color": [["border-top-color", ""]],
  "border-top-color": [["border-top-color", ""]],
  "border-style": [["border-top-style", ""]],
  "border-width": [["border-top-width", ""]],
  outline: [
    ["outline-color", "outline"],
    ["outline-style", "outline"],
    ["outline-width", "outline"],
  ],
  "outline-color": [["outline-color", ""]],
  "outline-style": [["outline-style", ""]],
  "outline-width": [["outline-width", ""]],
};

function uraiGaya(css: string): Aturan[] {
  const hasil: Aturan[] = [];
  let urutan = 0;
  postcss.parse(css).walkRules((aturan) => {
    // Aturan di dalam @media (cetak, gerak yang dikurangi) dan @keyframes
    // tidak menyentuh warna tombol di layar.
    if (aturan.parent && aturan.parent.type === "atrule") return;
    const deklarasi: Aturan["deklarasi"] = [];
    aturan.walkDecls((d) => {
      const sifat = d.prop.toLowerCase();
      if (sifat.startsWith("--")) {
        deklarasi.push({ sifat, nilai: d.value, singkatan: "", penting: d.important });
        return;
      }
      for (const [longhand, singkatan] of LONGHAND[sifat] ?? []) {
        deklarasi.push({ sifat: longhand, nilai: d.value, singkatan, penting: d.important });
      }
    });
    if (deklarasi.length === 0) return;
    hasil.push({ pemilih: aturan.selectors, asli: aturan.selector, deklarasi, urutan: urutan++ });
  });
  return hasil;
}

function cocok(el: Element, pemilih: string): boolean {
  if (pemilih.includes("::")) return false;
  try {
    return el.matches(tiruKeadaan(pemilih));
  } catch {
    return false;
  }
}

function deklarasiUntuk(el: Element, aturan: Aturan[]): Deklarasi[] {
  const hasil: Deklarasi[] = [];
  for (const satu of aturan) {
    const kena = satu.pemilih.filter((p) => cocok(el, p));
    if (kena.length === 0) continue;
    const kk = kena.map((p) => kekhususan(tiruKeadaan(p))).sort(bandingKekhususan).pop()!;
    for (const d of satu.deklarasi) {
      hasil.push({ ...d, kekhususan: kk, urutan: satu.urutan, pemilih: satu.asli });
    }
  }
  return hasil;
}

function pemenang(daftar: Deklarasi[], sifat: string): Deklarasi | null {
  const calon = daftar.filter((d) => d.sifat === sifat);
  calon.sort(
    (x, y) =>
      Number(x.penting) - Number(y.penting) ||
      bandingKekhususan(x.kekhususan, y.kekhususan) ||
      x.urutan - y.urutan
  );
  return calon.pop() ?? null;
}

const GUGUR = Symbol("gugur");

class Kaskade {
  constructor(private readonly aturan: Aturan[]) {}

  private deklarasi(el: Element) {
    return deklarasiUntuk(el, this.aturan);
  }

  /** Nilai sebuah token --x pada elemen ini, lewat pewarisan leluhur. */
  token(el: Element | null, nama: string, jejak: string[] = []): string | typeof GUGUR {
    for (let n: Element | null = el; n; n = n.parentElement) {
      const menang = pemenang(this.deklarasi(n), nama);
      if (menang) {
        if (jejak.includes(nama)) return GUGUR; // token menunjuk dirinya sendiri
        return this.ganti(n, menang.nilai, [...jejak, nama]);
      }
    }
    return GUGUR;
  }

  /** Mengganti seluruh var() di dalam nilai; satu saja gagal = gugur semua. */
  ganti(el: Element, nilai: string, jejak: string[] = []): string | typeof GUGUR {
    let hasil = nilai;
    for (let putaran = 0; putaran < 20; putaran += 1) {
      const i = hasil.indexOf("var(");
      if (i < 0) return hasil;
      const akhir = tutupKurung(hasil, i + 3, "(", ")");
      const [nama, ...cadangan] = pecahAtas(hasil.slice(i + 4, akhir), /,/);
      let isi: string | typeof GUGUR = this.token(el, nama.trim(), jejak);
      if (isi === GUGUR && cadangan.length > 0) isi = this.ganti(el, cadangan.join(","), jejak);
      if (isi === GUGUR) return GUGUR;
      hasil = hasil.slice(0, i) + isi + hasil.slice(akhir + 1);
    }
    return GUGUR;
  }

  /**
   * Nilai terhitung satu longhand. GUGUR bila deklarasi pemenangnya memuat
   * var yang tidak terdefinisi - itulah "invalid at computed-value time".
   */
  nilai(el: Element, sifat: string): string | typeof GUGUR | null {
    const menang = pemenang(this.deklarasi(el), sifat);
    if (!menang) return null;
    const utuh = this.ganti(el, menang.nilai);
    if (utuh === GUGUR) return GUGUR;
    if (!menang.singkatan || menang.singkatan === "background") return utuh.trim();
    const bagian = pecahAtas(utuh, /\s/);
    const gaya = bagian.find((x) => /^(none|hidden|solid|dashed|dotted|double|groove|ridge|inset|outset|auto)$/.test(x));
    const lebar = bagian.find((x) => /^(\d|\.\d|thin|medium|thick)/.test(x));
    const warna = bagian.find((x) => x !== gaya && x !== lebar);
    if (sifat.endsWith("-style")) return gaya ?? "none";
    if (sifat.endsWith("-width")) return lebar ?? "medium";
    return warna ?? "currentcolor";
  }

  warna(el: Element, sifat: string): Warna | typeof GUGUR | null {
    const n = this.nilai(el, sifat);
    if (n === GUGUR || n === null) return n;
    return uraiWarna(n);
  }
}

// ============================================================================
// TIRUAN BARIS JADWAL SIDANG, DENGAN KOTAK DARI konten.js ASLI
// ============================================================================

function potongFungsi(isi: string, nama: string): string {
  const baris = isi.replace(/\r\n/g, "\n").split("\n");
  const mulai = baris.findIndex((b) => new RegExp(`^(?:async )?function ${nama}\\(`).test(b));
  if (mulai < 0) throw new Error(`fungsi ${nama} tidak ketemu`);
  let j = mulai;
  while (j < baris.length && baris[j] !== "}") j += 1;
  return baris.slice(mulai, j + 1).join("\n");
}

const halaman: JSDOM[] = [];
afterEach(() => {
  while (halaman.length) halaman.pop()!.window.close();
});

function susunHalaman(temaSipp: "terang" | "gelap") {
  const dom = new JSDOM(
    `<!doctype html><html${temaSipp === "gelap" ? ' data-aleta-tema-sipp="gelap"' : ""}><body>
      <div class="cssTable"><table id="tableinfo"><tbody>
        <tr><td>No</td><td>Tanggal</td><td>Agenda Sidang</td><td>Ruang &amp; Data Persidangan</td></tr>
        <tr id="baris"><td>1</td><td>Selasa, 02 Des. 2025</td><td>Jawaban</td>
          <td id="sel">Ruang Sidang Utama<br><a href="#" class="btn btn-default btn-sm">Unggah BAS</a></td></tr>
      </tbody></table></div>
      <div class="aleta-panel" id="panel-gelap"><div class="aleta-berkas" id="berkas-gelap"></div></div>
      <div class="aleta-panel" data-tema="terang" id="panel-terang"><div class="aleta-berkas" id="berkas-terang"></div></div>
    </body></html>`,
    { runScripts: "outside-only" }
  );
  halaman.push(dom);
  const w = dom.window as unknown as Window & Record<string, unknown> & { eval: (s: string) => unknown };
  const isi = konten();
  w.eval(
    [
      'var TANDA = "data-aleta-tanda";',
      ...["buatElemen", "keteranganSisa", "tombolUnduh", "kotakSisipan"].map((n) => potongFungsi(isi, n)),
    ].join("\n\n")
  );
  const dokumen = [
    { judulDokumen: "Jawaban Tergugat", adaPdf: true, adaWord: true, sisaHari: 2, documentKey: "k1" },
  ];
  const d = dom.window.document;
  const kotakSisipan = w.kotakSisipan as (dok: unknown[], ambang: number, sebab: string) => HTMLElement;
  const tombolUnduh = w.tombolUnduh as (dok: unknown, format: string, label: string) => HTMLElement;
  d.getElementById("sel")!.appendChild(kotakSisipan(dokumen, 3, "cocok tanggal sidang"));
  d.getElementById("berkas-gelap")!.appendChild(tombolUnduh(dokumen[0], "pdf", "PDF"));
  d.getElementById("berkas-terang")!.appendChild(tombolUnduh(dokumen[0], "pdf", "PDF"));

  const tombolSisip = d.querySelector(".aleta-sisip .aleta-unduh") as HTMLElement;
  expect(tombolSisip, "kotakSisipan tidak lagi membuat tombol .aleta-unduh").not.toBeNull();
  return {
    d,
    tombolSisip,
    kotakSisip: d.querySelector(".aleta-sisip") as HTMLElement,
    baris: d.getElementById("baris") as HTMLElement,
    tombolPanelGelap: d.querySelector("#berkas-gelap .aleta-unduh") as HTMLElement,
    tombolPanelTerang: d.querySelector("#berkas-terang .aleta-unduh") as HTMLElement,
  };
}

function setelKeadaan(el: HTMLElement, keadaan: { sorot?: boolean; fokus?: boolean }) {
  el.toggleAttribute("data-uji-sorot", Boolean(keadaan.sorot));
  el.toggleAttribute("data-uji-fokus", Boolean(keadaan.fokus));
}

const kaskade = () => new Kaskade(uraiGaya(gayaPanel()));

function wajibWarna(nilai: Warna | typeof GUGUR | null, keterangan: string): Warna {
  expect(nilai, `${keterangan}: tidak ada deklarasi sama sekali`).not.toBeNull();
  expect(
    nilai,
    `${keterangan}: GUGUR - memakai token --aleta-* yang tidak terdefinisi di tempat tombol ini berdiri`
  ).not.toBe(GUGUR);
  const w = nilai as Warna;
  expect(w, `${keterangan}: nilai warnanya tidak terbaca`).not.toBeNull();
  return w;
}

// ============================================================================
// UJI
// ============================================================================

describe("pembanding: tombol yang sama di dalam panel terselesaikan warnanya", () => {
  // Kalau penyelesaian var()/color-mix di uji ini rusak, di sinilah merahnya -
  // bukan di uji mode terang yang kebetulan lulus karena semuanya gugur.
  it.each([
    ["panel gelap", "tombolPanelGelap"],
    ["panel terang", "tombolPanelTerang"],
  ] as const)("%s", (_nama, kunci) => {
    const k = kaskade();
    const tombol = susunHalaman("terang")[kunci];
    const latar = wajibWarna(k.warna(tombol, "background-color"), "latar");
    const tulisan = wajibWarna(k.warna(tombol, "color"), "tulisan");
    wajibWarna(k.warna(tombol, "border-top-color"), "garis tepi");
    expect(latar[3], "latar tombol panel tidak pekat").toBe(1);
    expect(rasio(tulisan, latar)).toBeGreaterThanOrEqual(AA_TULISAN);
  });
});

describe("tombol unduh sisipan Jadwal Sidang pada SIPP TERANG", () => {
  function sekeliling(k: Kaskade, kotak: HTMLElement, baris: keyof typeof BARIS_SIPP): Warna {
    // Latar kotak sisipan (hijau tembus pandang) di atas warna baris SIPP.
    const latarKotak = k.warna(kotak, "background-color");
    const bawah = uraiWarna(BARIS_SIPP[baris])!;
    if (!latarKotak || latarKotak === GUGUR) return bawah;
    return tumpuk(latarKotak, bawah);
  }

  it("latar, tulisan, dan garis tepinya BENAR-BENAR ada - tidak gugur karena token panel", () => {
    const k = kaskade();
    const { tombolSisip } = susunHalaman("terang");
    const latar = wajibWarna(k.warna(tombolSisip, "background-color"), "latar");
    wajibWarna(k.warna(tombolSisip, "color"), "tulisan");
    wajibWarna(k.warna(tombolSisip, "border-top-color"), "garis tepi");
    expect(latar[3], "latar tombol tembus pandang - tidak berbentuk tombol").toBe(1);
    expect(k.nilai(tombolSisip, "border-top-style")).toBe("solid");
    expect(k.nilai(tombolSisip, "border-top-width")).toMatch(/^[1-9]/);
  });

  it("tulisan >= 4,5:1 atas latarnya, biasa maupun disorot kursor", () => {
    const k = kaskade();
    const { tombolSisip } = susunHalaman("terang");
    for (const sorot of [false, true]) {
      setelKeadaan(tombolSisip, { sorot });
      const latar = wajibWarna(k.warna(tombolSisip, "background-color"), `latar sorot=${sorot}`);
      const tulisan = wajibWarna(k.warna(tombolSisip, "color"), `tulisan sorot=${sorot}`);
      expect(rasio(tulisan, latar), `tulisan : latar, sorot=${sorot}`).toBeGreaterThanOrEqual(AA_TULISAN);
    }
  });

  it("garis tepi >= 3:1 atas baris genap, ganjil, dan baris yang disorot SIPP", () => {
    const k = kaskade();
    const { tombolSisip, kotakSisip } = susunHalaman("terang");
    const kasus: Array<[keyof typeof BARIS_SIPP, boolean]> = [
      ["genap", false],
      ["ganjil", false],
      // Kursor di baris tetapi belum di tombol: SIPP memutihkan tulisan sel
      // dan menghijaukan barisnya - inilah keadaan "warna putih" dulu.
      ["disorot", false],
      ["disorot", true],
    ];
    for (const [baris, sorot] of kasus) {
      setelKeadaan(tombolSisip, { sorot });
      const garis = wajibWarna(k.warna(tombolSisip, "border-top-color"), `garis ${baris}`);
      const r = rasio(garis, sekeliling(k, kotakSisip, baris));
      expect(r, `garis tepi : baris ${baris} (sorot tombol=${sorot}) = ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        AA_BENTUK
      );
    }
  });

  it("cincin fokus papan ketik terlihat >= 3:1 atas sekelilingnya", () => {
    const k = kaskade();
    const { tombolSisip, kotakSisip } = susunHalaman("terang");
    setelKeadaan(tombolSisip, { fokus: true });
    expect(k.nilai(tombolSisip, "outline-style")).toBe("solid");
    const cincin = wajibWarna(k.warna(tombolSisip, "outline-color"), "cincin fokus");
    for (const baris of ["genap", "ganjil", "disorot"] as const) {
      const r = rasio(cincin, sekeliling(k, kotakSisip, baris));
      expect(r, `cincin fokus : baris ${baris} = ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_BENTUK);
    }
  });
});

describe("mode GELAP tidak berubah", () => {
  /**
   * Aturan khusus sisipan = aturan yang mengenai tombol sisipan pada SIPP
   * terang tetapi TIDAK mengenai tombol yang sama di dalam panel. Ditemukan
   * lewat pencocokan pemilih, bukan lewat mencari teks pemilihnya.
   */
  function aturanKhususSisip(): Set<number> {
    const aturan = uraiGaya(gayaPanel());
    const { tombolSisip, tombolPanelGelap } = susunHalaman("terang");
    const khusus = new Set<number>();
    for (const keadaan of [{}, { sorot: true }, { fokus: true }]) {
      setelKeadaan(tombolSisip, keadaan);
      setelKeadaan(tombolPanelGelap, keadaan);
      const diPanel = new Set(deklarasiUntuk(tombolPanelGelap, aturan).map((d) => d.urutan));
      for (const d of deklarasiUntuk(tombolSisip, aturan)) if (!diPanel.has(d.urutan)) khusus.add(d.urutan);
    }
    return khusus;
  }

  it("perbaikan mode terang memang memasang aturan khusus sisipan", () => {
    expect(aturanKhususSisip().size).toBeGreaterThan(0);
  });

  it("warna terhitung tombol sisipan pada SIPP gelap sama persis dengan tanpa aturan khusus itu", () => {
    const khusus = aturanKhususSisip();
    const semua = uraiGaya(gayaPanel());
    const penuh = new Kaskade(semua);
    const tanpa = new Kaskade(semua.filter((a) => !khusus.has(a.urutan)));
    const { tombolSisip } = susunHalaman("gelap");
    const sifat = [
      "background-color",
      "color",
      "border-top-color",
      "border-top-style",
      "border-top-width",
      "outline-color",
      "outline-style",
      "outline-width",
    ];
    for (const keadaan of [{}, { sorot: true }, { fokus: true }]) {
      setelKeadaan(tombolSisip, keadaan);
      for (const s of sifat) {
        expect(
          String(penuh.nilai(tombolSisip, s)),
          `${s} pada SIPP gelap, keadaan ${JSON.stringify(keadaan)}`
        ).toBe(String(tanpa.nilai(tombolSisip, s)));
      }
    }
  });
});
