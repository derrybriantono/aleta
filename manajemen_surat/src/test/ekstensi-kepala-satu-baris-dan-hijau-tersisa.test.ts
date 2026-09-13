/**
 * Ekstensi 1.128.0 - kepala panel satu baris, pemilih warna yang berfungsi,
 * dan hijau terakhir yang menyelip sesudah paletnya diganti.
 *
 * ============================================================================
 * TIGA HAL YANG DIJAGA DI SINI, DAN SEBABNYA
 * ============================================================================
 *
 * 1. Pemilih warna. Dari tujuh titik di kepala hanya SATU yang pernah
 *    terlihat: aturan ".aleta-alat-kepala button" menghapus latar setiap
 *    tombol kepala, dan pada titik warna latar itulah satu-satunya isinya.
 *    Aturan yang menyembunyikan itu masih ada - ia benar untuk tombol lain -
 *    jadi yang dijaga: aturan titik lebih spesifik darinya, dan di kepala
 *    hanya satu titik, tujuh lainnya di baris yang terbuka saat ditekan.
 *
 * 2. Hijau ABT dan SIPP. Ditemukan dengan MENGUKUR warna terhitung pada
 *    replika statis kedua halaman di ketujuh palet - bukan dari tangkapan
 *    layar. Tiap aturan di sini menjawab satu temuan pengukuran itu.
 *
 * 3. Hijau di aturan panel sendiri. Chip jenis perkara dan tombol unduh
 *    menulis hijaunya sebagai angka sejak sebelum ada palet. Yang dijaga
 *    bukan angkanya, melainkan: tidak ada lagi angka bernada hijau di aturan
 *    panel di luar warna yang BERARTI sesuatu, dan token turunannya terbaca
 *    pada ketujuh palet - diukur, bukan dipercaya.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const AKAR = path.resolve(__dirname, "../../../ekstensi-sipp");
const gaya = readFileSync(path.join(AKAR, "panel.css"), "utf8");
const alat = readFileSync(path.join(AKAR, "panel-alat.js"), "utf8");
const konten = readFileSync(path.join(AKAR, "konten.js"), "utf8");

const tanpaCatatan = gaya.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

function aturan(pemilih: string): string {
  for (const m of tanpaCatatan.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (m[1].trim().replace(/\s+/g, " ") === pemilih) return m[2];
  }
  throw new Error(`aturan tidak ditemukan: ${pemilih}`);
}

/** Aturan TERAKHIR dengan pemilih itu - yang menang di kaskade bila sama spesifiknya. */
function aturanTerakhir(pemilih: string): string {
  let akhir: string | null = null;
  for (const m of tanpaCatatan.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (m[1].trim().replace(/\s+/g, " ") === pemilih) akhir = m[2];
  }
  if (akhir === null) throw new Error(`aturan tidak ditemukan: ${pemilih}`);
  return akhir;
}

// ── warna ────────────────────────────────────────────────────────────────────
type RGB = [number, number, number];

function hex(warna: string): RGB {
  let h = warna.trim().replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
}

function nada(w: RGB): number | null {
  const [r, g, b] = w.map((v) => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d < 0.05) return null;
  let h: number;
  if (mx === r) h = ((g - b) / d) % 6;
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = Math.round(h * 60);
  return h < 0 ? h + 360 : h;
}

const hijau = (w: string) => { const h = nada(hex(w)); return h !== null && h >= 90 && h <= 180; };

/** color-mix(in srgb, A p%, B) untuk warna buram = campuran linear per kanal. */
function campur(a: RGB, persen: number, b: RGB): RGB {
  const p = persen / 100;
  return a.map((v, i) => Math.round(v * p + b[i] * (1 - p))) as RGB;
}

function luminans([r, g, b]: RGB): number {
  const k = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2];
}

function rasio(a: RGB, b: RGB): number {
  const x = luminans(a), y = luminans(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

function token(blok: string, nama: string): string | null {
  const m = blok.match(new RegExp(`${nama.replace(/[-]/g, "\\-")}\\s*:\\s*(#[0-9a-fA-F]{3,6})\\b`));
  return m ? m[1] : null;
}

// ============================================================================
describe("pemilih warna: satu titik di kepala, tujuh di baliknya", () => {
  const badan = alat.slice(alat.indexOf("function alatPemilihWarna("));
  const fungsi = badan.slice(0, badan.indexOf("\n}\n"));

  it("di kepala hanya satu tombol; barisnya tertutup sampai ditekan", () => {
    expect(fungsi).toContain('tombol.className = "aleta-warna-tombol";');
    expect(fungsi).toContain("kotak.hidden = true;");
    expect(fungsi).toContain('tombol.setAttribute("aria-expanded", ya ? "true" : "false");');
    expect(fungsi).toContain("wadah.appendChild(tombol);");
    expect(fungsi).toContain("wadah.appendChild(kotak);");
  });

  it("memilih satu warna menutup barisnya lagi, dan menandai tombol kepala", () => {
    const klikTitik = fungsi.slice(fungsi.indexOf('titik.addEventListener("click"'));
    expect(klikTitik.slice(0, 200)).toContain("alatTerapkanWarna(panel, nama, true);");
    expect(klikTitik.slice(0, 200)).toContain("tandai(nama);");
    expect(klikTitik.slice(0, 200)).toContain("buka(false);");
    // tandai() mewarnai tombol kepala dengan swatch palet yang aktif.
    expect(fungsi).toContain('tombol.style.setProperty("--titik", baris[2]);');
  });

  it("menekan di luar pemilih menutupnya", () => {
    expect(fungsi).toContain('document.addEventListener("pointerdown", (peristiwa) => {');
    expect(fungsi).toContain("if (kotak.hidden) return;");
  });

  it("pemulih warna tersimpan menandai lewat pemilihnya, bukan menebak urutan titik", () => {
    expect(fungsi).toContain("kotak.aletaTandai = tandai;");
    expect(alat).toContain('if (pemilih && typeof pemilih.aletaTandai === "function") pemilih.aletaTandai(warna);');
  });

  it("menekan celah baris titik tidak mulai menggeser panel", () => {
    expect(alat).toContain('closest("button, a, input, select, textarea, .aleta-warna-pilih")');
    expect(konten).toContain('closest("button, a, input, select, textarea, .aleta-warna-pilih")');
  });

  it("aturan titik LEBIH SPESIFIK daripada aturan tombol kepala yang menghapus latarnya", () => {
    // Aturan yang menyembunyikan enam titik itu sengaja dibiarkan - ia benar
    // untuk tombol tema, ciut, layar, dan tutup.
    const umum = aturan(".aleta-alat-kepala button");
    expect(umum).toContain("background: none;");
    expect(umum).toContain("border: 0;");
    // Titik dan tombol kepala memakai pemilih "button.kelas" - (0,2,1) di atas
    // (0,1,1) - dan menulis kembali persis yang dihapus aturan umum.
    const titik = aturan(".aleta-alat-kepala button.aleta-warna-tombol, .aleta-alat-kepala button.aleta-warna-titik");
    expect(titik).toContain("background: var(--titik, #7fd0a6);");
    expect(titik).toContain("border: 1px solid var(--aleta-garis-kuat);");
    expect(titik).toContain("padding: 0;");
    expect(titik).toContain("width: 14px;");
  });

  it("baris tujuh titik melayang di bawah kepala, tidak memakan lebar deret tombol", () => {
    const baris = aturan(".aleta-warna-pilih");
    expect(baris).toContain("position: absolute;");
    expect(baris).toContain("top: calc(100% + 6px);");
    expect(gaya).toContain(".aleta-warna-pilih[hidden] { display: none; }");
    // Aturan .aleta-alat-kepala pertama menyusun deretnya; yang terakhir -
    // milik pemilih warna - menjadikannya acuan posisi baris titik.
    expect(aturanTerakhir(".aleta-alat-kepala")).toContain("position: relative;");
  });

  it("pada tema terang tombol kepalanya pun ikut disembunyikan", () => {
    expect(gaya).toContain('.aleta-panel[data-tema="terang"] :is(.aleta-warna-pilih, .aleta-warna-tombol) { display: none; }');
  });

  it("chip peran yang panjang dipangkas, bukan mendorong deret ke baris kedua", () => {
    const chip = aturanTerakhir(".aleta-alat-kepala .aleta-kepala-peran");
    expect(chip).toContain("max-width: 9.5em;");
    expect(chip).toContain("text-overflow: ellipsis;");
  });
});

// ============================================================================
describe("hijau yang menyelip di ABT dan SIPP, satu aturan per temuan pengukuran", () => {
  const ABT = 'html[data-aleta-halaman="abt"][data-aleta-tema-sipp="gelap"]';
  const SIPP = 'html:not([data-aleta-halaman="abt"])[data-aleta-tema-sipp="gelap"]';

  it("kepala blangko ABT saat kursor di kartunya - #006640 milik ABT", () => {
    const b = aturan(`${ABT} :is(.pricing_inner_w3ls:hover .pricing-top, .pricing_inner_w3ls:hover a.with-zoom-anim)`);
    expect(b).toContain("background: var(--s-sorot-kuat) !important;");
  });

  it("kepala blangko memakai warna tua palet; warna kelompok tinggal garis kiri", () => {
    const b = aturan(`${ABT} .pricing-top`);
    expect(b).toContain("background: var(--s-hijau-tua) !important;");
    expect(b).toContain("box-shadow: inset 6px 0 0 var(--kelompok, var(--s-garis-hijau));");
    expect(b).not.toContain("brightness(");
    for (const k of ["satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan"]) {
      expect(aturan(`${ABT} .pricing-top.${k}`)).toMatch(/--kelompok:\s*#[0-9a-fA-F]{6};/);
    }
    expect(aturan(`${ABT} :is(.pricing-top h3, .pricing-top p)`)).toContain("color: var(--s-tulisan-atas) !important;");
  });

  it("kaki halaman ABT, peringatan DATA ISIAN, dan label-success", () => {
    expect(aturan(`${ABT} #footer`)).toContain("background: var(--s-hijau-tua) !important;");
    expect(aturan(`${ABT} .pring_agile_its font[size="3"]`)).toContain("color: var(--s-hijau-terang) !important;");
    const b = aturan(`${ABT} :is(.label-success, .badge-success, .progress-bar-success, .green-button a, .onoffswitch-inner::before, .codes.agileitsbg4)`);
    expect(b).toContain("background: var(--s-hijau) !important;");
  });

  it("bilah tab detail perkara SIPP (#usual2) dan label-success", () => {
    expect(aturan(`${SIPP} #usual2`)).toContain("background: var(--s-hijau-tua) !important;");
    expect(aturan(`${SIPP} :is(.label-success, .badge-success, .progress-bar-success)`)).toContain("background: var(--s-hijau) !important;");
  });

  it("gambar bilah atas SIPP dilepas HANYA pada palet selain dasar", () => {
    // Gambarnya hijau; multiply pun tidak mengubah nadanya. Pada palet dasar
    // teksturnya tetap - identitas halamannya.
    const b = aturan(`html:not([data-aleta-halaman="abt"])[data-aleta-warna][data-aleta-tema-sipp="gelap"] #atas`);
    expect(b).toContain("background-image: none !important;");
    expect(b).toContain("background-color: var(--s-hijau-tua) !important;");
    expect(aturan(`${SIPP} #atas`)).toContain("background-blend-mode: multiply;");
  });
});

// ============================================================================
describe("aturan panel sendiri tidak lagi menulis hijau sebagai angka", () => {
  // Warna yang BERARTI sesuatu - dan sebabnya satu untuk semuanya: artinya
  // tidak boleh berubah menurut selera warna siapa pun.
  const POLA_DIIZINKAN = [
    /\.aleta-tanda-(hijau|aman|merah|kuning|panel|lewat|mendesak)/, // lencana keadaan
    /\.aleta-sisip/, // penanda sisipan naskah
    /\.aleta-peran-super|data-peran="super"/, // rel pelangi super admin
    /\.aleta-abt-|\.aleta-cetak-tiga/, // di halaman ABT, di luar panel - tokennya --s-*
    /\.aleta-petunjuk/, // kelabu kepala tabel
    /\.aleta-usia-basi|\.aleta-unduh-gagal|\.aleta-chip-(merah|kuning)/, // peringatan
  ];

  it("tidak ada angka bernada hijau di aturan panel di luar warna yang berarti", () => {
    const salah: string[] = [];
    for (const m of tanpaCatatan.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const pemilih = m[1].trim().replace(/\s+/g, " ");
      if (!pemilih.startsWith(".aleta-")) continue;
      if (pemilih.includes("terang") || pemilih.includes("data-aleta-tema-sipp") || pemilih.includes("data-warna")) continue;
      if (POLA_DIIZINKAN.some((p) => p.test(pemilih))) continue;
      for (const b of m[2].split("\n")) {
        if (/^\s*--/.test(b)) continue; // deklarasi token
        const tanpaCadangan = b.replace(/var\([^)]*\)/g, "");
        for (const w of tanpaCadangan.matchAll(/#[0-9a-fA-F]{3,6}\b/g)) {
          if (hijau(w[0])) salah.push(`${pemilih.slice(0, 60)} -> ${b.trim()}`);
        }
      }
    }
    expect(salah, salah.join("\n")).toEqual([]);
  });

  it("chip jenis perkara dan tombol unduh memakai turunan merek", () => {
    expect(aturan(".aleta-tanda-jenis")).toContain("background: var(--aleta-merek-latar);");
    expect(aturan(".aleta-tanda-jenis")).toContain("color: var(--aleta-merek-tulisan);");
    expect(aturan(".aleta-unduh")).toContain("var(--aleta-merek-tombol)");
    expect(aturan(".aleta-permintaan-tombol")).toContain("var(--aleta-merek-tombol)");
  });

  it("kelima turunan dideklarasikan sekali, dihitung dari merek dan latar", () => {
    const dasar = aturan(".aleta-panel");
    for (const nama of ["latar", "garis", "tombol", "tombol-sorot", "tulisan"]) {
      expect(dasar).toMatch(new RegExp(`--aleta-merek-${nama}: color-mix\\(in srgb, var\\(--aleta-merek\\) \\d+%, var\\(--aleta-(latar|tulisan)\\)\\);`));
    }
  });
});

// ============================================================================
describe("turunan merek terbaca pada ketujuh palet panel - diukur, bukan dipercaya", () => {
  const dasar = aturan(".aleta-panel");
  const PALET = ["", "arang", "neon", "hangat", "pastel", "permata", "vibran"];
  const persen = (nama: string) => {
    const m = dasar.match(new RegExp(`--aleta-merek-${nama}: color-mix\\(in srgb, var\\(--aleta-merek\\) (\\d+)%`));
    if (!m) throw new Error(`turunan ${nama} tidak ada`);
    return Number(m[1]);
  };

  for (const nama of PALET) {
    const label = nama || "dasar (hijau SIPP)";
    const blok = nama ? aturan(`.aleta-panel[data-warna="${nama}"]:not([data-tema="terang"])`) : dasar;
    const ambil = (t: string) => hex(token(blok, t) || token(dasar, t) || "");
    const merek = ambil("--aleta-merek"), latar = ambil("--aleta-latar"), tulisan = ambil("--aleta-tulisan");

    it(`${label}: tulisan merek di atas latar merek memenuhi AA`, () => {
      const tulisanMerek = campur(merek, persen("tulisan"), tulisan);
      const latarMerek = campur(merek, persen("latar"), latar);
      expect(rasio(tulisanMerek, latarMerek), label).toBeGreaterThanOrEqual(4.5);
    });

    it(`${label}: tulisan panel di atas tombol merek dan sorotnya memenuhi AA`, () => {
      expect(rasio(tulisan, campur(merek, persen("tombol"), latar)), `${label}: tombol`).toBeGreaterThanOrEqual(4.5);
      expect(rasio(tulisan, campur(merek, persen("tombol-sorot"), latar)), `${label}: sorot`).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("tema terang mengganti merek dan latarnya - turunannya ikut sendiri", () => {
    const terang = aturan('.aleta-panel[data-tema="terang"]');
    expect(token(terang, "--aleta-merek")).toBeTruthy();
    expect(token(terang, "--aleta-latar")).toBeTruthy();
  });
});
