// @vitest-environment node

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Dua hal yang lahir bersama di 1.126.0, dan keduanya menyentuh tiga aplikasi
 * sekaligus - SIPP, ABT, dan halaman ALETA:
 *
 *   1. Enam warna gelap super admin. Satu nilai tersimpan, dipasang pada
 *      <html> halaman DAN akar panel, dibaca pada gambar pertama.
 *   2. Modus keterangan tiap saksi. Yang diuji fungsinya - dijalankan, bukan
 *      dibaca dari teks kodenya - sebab kalimat yang keluar itulah yang kelak
 *      dibacakan di persidangan.
 */

const akar = path.resolve(process.cwd(), "..");
const gaya = readFileSync(path.join(akar, "ekstensi-sipp/panel.css"), "utf8");
const alat = readFileSync(path.join(akar, "ekstensi-sipp/panel-alat.js"), "utf8");
const awal = readFileSync(path.join(akar, "ekstensi-sipp/tema-awal.js"), "utf8");
const popup = readFileSync(path.join(akar, "ekstensi-sipp/popup.js"), "utf8");
const konten = readFileSync(path.join(akar, "ekstensi-sipp/konten.js"), "utf8");
const abt = readFileSync(path.join(akar, "ekstensi-sipp/abt.js"), "utf8");

const NAMA = ["arang", "neon", "hangat", "pastel", "permata", "vibran"];

/** Daftar warna dari satu berkas, dibaca dari untai kodenya. */
function daftarWarna(sumber: string): string[] {
  const blok = sumber.slice(sumber.indexOf("const DAFTAR_WARNA_GELAP = ["));
  const akhir = blok.indexOf("];");
  return [...blok.slice(0, akhir).matchAll(/\["([a-z]*)", "/g)].map((m) => m[1]);
}

describe("enam warna gelap: sepasang aturan per warna, terkunci pada tema gelap", () => {
  for (const nama of NAMA) {
    it(`${nama} punya aturan halaman DAN aturan panel`, () => {
      // Halaman: hanya bersama data-aleta-tema-sipp="gelap". Panel: hanya bila
      // temanya bukan terang. Palet gelap di atas tema terang bukan warna,
      // melainkan kerusakan.
      expect(gaya).toContain(`html[data-aleta-warna="${nama}"][data-aleta-tema-sipp="gelap"] {`);
      expect(gaya).toContain(`.aleta-panel[data-warna="${nama}"]:not([data-tema="terang"]) {`);
    });
  }

  it("warna PERINGATAN tidak diganti di palet mana pun", () => {
    // Kuning dan merah berarti "tenggat lewat" dan "belum" - artinya harus
    // tetap sama apa pun paletnya.
    const blok = gaya.slice(gaya.indexOf("ENAM WARNA GELAP UNTUK SUPER ADMIN"));
    const aturan = blok.slice(0, blok.indexOf(".aleta-warna-pilih {"));
    expect(aturan).not.toMatch(/--s-kuning\s*:/);
    expect(aturan).not.toMatch(/--s-merah\s*:/);
    expect(aturan).not.toMatch(/--aleta-mendesak\s*:/);
    expect(aturan).not.toMatch(/--aleta-lewat\s*:/);
  });

  it("tulisannya tidak pernah putih murni", () => {
    const blok = gaya.slice(gaya.indexOf("ENAM WARNA GELAP UNTUK SUPER ADMIN"));
    const aturan = blok.slice(0, blok.indexOf(".aleta-warna-pilih {"));
    expect(aturan).not.toMatch(/--(?:s|aleta)-tulisan\s*:\s*#fff(?:fff)?\b/i);
  });
});

describe("palet dipakai SELURUH peta gelap, bukan hanya panelnya", () => {
  // Selama hanya ada satu palet, angka warna yang tertanam tidak kelihatan
  // salah. Begitu palet lain dipilih, tiap angka itu TETAP hijau sementara
  // sekitarnya berubah - "hijaunya tidak sinkron".
  const DIIZINKAN = new Set([
    "#7a1f19", "#ffe8e5", // tombol hapus - peringatan
    "#b42318",            // tulisan galat
    "#000", "#0a120f",    // bayangan dan latar paling bawah
    "#474747",            // panah select bawaan SIPP
    "#4a3a10", "#ffd98a", // sorotan <mark>
  ]);
  // Aturan yang warnanya BERARTI sesuatu - artinya tidak boleh berubah
  // menurut selera warna siapa pun.
  const POLA_DIIZINKAN = [
    /\.aleta-tanda-/,
    /\[style\*=/,
    /\bmark\b/,
    /\.button_one|\.sembilan|\.delapan/,
    /\.pricing-top/,
    /\.text-(red|green|yellow|muted)|\.bg-(aqua|green|yellow|red|blue|light-blue)/,
    /canvas#chartHakim/,
    /\.color-sendbtns/,
    // font[color="..."] - warna MUTLAK yang ditulis halaman SIPP sendiri di
    // dalam markahnya, dan artinya bukan selera: di dasbor merah dan biru
    // MEMBEDAKAN kolom (sisa bulan lalu dan perkara masuk), di bilah atas
    // warnanya membedakan golongan pengguna. Tiap warna diganti padanan
    // terangnya supaya terbaca di atas latar gelap - bukan diikutkan palet,
    // sebab palet yang mengubah arti bukan palet melainkan kerusakan.
    // Alasannya sama persis dengan [style*="color:..."] di atas.
    /font\[color=/,
  ];

  it("tidak satu aturan tema gelap pun memakai angka warna", () => {
    const tanpaCatatan = gaya.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
    const salah: string[] = [];
    for (const m of tanpaCatatan.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const pemilih = m[1].trim().replace(/\s+/g, " ");
      if (!pemilih.includes("data-aleta-tema-sipp")) continue;
      if (POLA_DIIZINKAN.some((p) => p.test(pemilih))) continue;
      for (const b of m[2].split("\n")) {
        if (/^\s*--/.test(b)) continue; // deklarasi token
        const tanpaCadangan = b.replace(/var\([^)]*\)/g, "");
        for (const w of tanpaCadangan.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
          if (DIIZINKAN.has(w[0].toLowerCase())) continue;
          salah.push(`${pemilih.slice(0, 70)} -> ${b.trim()}`);
        }
      }
    }
    expect(salah, salah.join("\n")).toEqual([]);
  });

  it("tiap palet mendeklarasikan kelima token selaras itu", () => {
    // Tanpa kelimanya, palet yang dipilih hanya mengubah separuh halaman.
    for (const nama of NAMA) {
      const blok = gaya.slice(gaya.indexOf(`html[data-aleta-warna="${nama}"][data-aleta-tema-sipp="gelap"] {`));
      const isi = blok.slice(0, blok.indexOf("}"));
      for (const token of ["--s-tulisan-atas", "--s-sorot-kuat", "--s-mati", "--s-tulisan-samar", "--s-garis-dalam"]) {
        expect(isi, `${nama} kehilangan ${token}`).toContain(token);
      }
    }
  });
});

describe("pemilih warnanya", () => {
  it("hanya bagi super admin, dan tidak digandakan", () => {
    const badan = alat.slice(alat.indexOf("function alatPemilihWarna("));
    expect(badan.slice(0, 600)).toContain('if (peran !== "super" && !/super/i.test(peran)) return null;');
    expect(badan.slice(0, 600)).toContain('if (wadah.querySelector(".aleta-warna-pilih")) return null;');
  });

  it("nama warnanya tidak dapat menyuntikkan apa pun ke atribut", () => {
    // Yang tersimpan hanya boleh salah satu dari daftar; selebihnya jatuh ke
    // bawaan. Nilai bebas ke setAttribute adalah pintu yang tidak perlu ada.
    const badan = alat.slice(alat.indexOf("function alatTerapkanWarna("));
    expect(badan.slice(0, 500)).toContain("const dikenal = DAFTAR_WARNA_GELAP.some(([k]) => k === nama);");
    expect(badan.slice(0, 500)).toContain('const bersih = dikenal ? nama : "";');
  });

  it("satu nilai, dua tempat: akar panel dan <html> halaman", () => {
    const badan = alat.slice(alat.indexOf("function alatTerapkanWarna("));
    expect(badan.slice(0, 900)).toContain('panel.setAttribute("data-warna", bersih)');
    expect(badan.slice(0, 900)).toContain('akar.setAttribute("data-aleta-warna", bersih)');
  });

  it("ketiga panel memasangnya", () => {
    // SIPP menyusun kepalanya sendiri; ABT dan ALETA lewat alatTombolKepala.
    expect(konten).toContain("alatPemilihWarna(panel, alatKepala,");
    expect(alat).toContain("alatPemilihWarna(panel, wadah, pilihan);");
  });

  it("dipasang pada gambar pertama, seperti temanya - dan hanya bila gelap", () => {
    const blok = awal.slice(awal.indexOf("WARNA GELAP PILIHAN"));
    expect(blok).toContain('window.localStorage.getItem("aleta-warna-gelap")');
    expect(blok).toContain('document.documentElement.setAttribute("data-aleta-warna", warna)');
    // Penjaganya: di dalam if (tema === "gelap").
    expect(blok.indexOf('if (tema === "gelap")')).toBeLessThan(blok.indexOf('getItem("aleta-warna-gelap")'));
  });

  it("popup dan panel memakai daftar yang SAMA", () => {
    // Popup tidak memuat skrip konten, jadi daftarnya disalin - dan salinan
    // yang tertinggal berarti popup menawarkan warna yang tidak dikenal panel.
    expect(daftarWarna(popup)).toEqual(daftarWarna(alat));
    expect(daftarWarna(alat)).toEqual(["", ...NAMA]);
  });
});

/* ----------------------------------------------------------------------------
   Modus keterangan saksi - diuji FUNGSINYA.
   ------------------------------------------------------------------------- */
const require_ = createRequire(import.meta.url);
const usulan = require_(path.resolve(process.cwd(), "../aleta_bot/services/abtUsulanService.js")) as {
  susunKeteranganSaksiSdg: (opsi: Record<string, unknown>) => {
    ok: boolean;
    saksi1: Array<{ no: string; tanya: string; jawab: string }>;
    saksi2: Array<{ no: string; tanya: string; jawab: string }>;
    modus: { saksi1: string; saksi2: string };
  };
};

const TEMPLAT = [
  { no: "1", tanya: "Apakah saksi kenal dengan Penggugat dan Tergugat?", jawab: "Ya, saya kenal karena saya tetangga;" },
  { no: "2", tanya: "Apakah saksi tahu penyebab perselisihan dan pertengkaran Penggugat dan Tergugat?", jawab: "Ya, penyebabnya yaitu ...;" },
  { no: "3", tanya: "Berapa kali saudara melihat dan mendengar Penggugat dan Tergugat bertengkar?", jawab: "Saya melihat kurang lebih tiga kali;" },
  { no: "4", tanya: "Bagaimana saudara bisa mengetahui penyebab perselisihan tersebut?", jawab: "Saya mengetahui karena saya melihat sendiri;" },
  { no: "5", tanya: "Apakah masih ada keterangan yang Saudara akan sampaikan?", jawab: "Sudah cukup;" },
];

const jawab = (daftar: Array<{ no: string; jawab: string }>, no: string) =>
  String(daftar.find((b) => b.no === no)?.jawab || "").toLowerCase();

describe("modus keterangan saksi", () => {
  it("tanpa modus, bentuk lama tetap berlaku - kedua saksi tahu semuanya", () => {
    const h = usulan.susunKeteranganSaksiSdg({ templat: TEMPLAT, alasan: ["judi", "mabuk"] });
    expect(h.ok).toBe(true);
    expect(h.modus).toEqual({ saksi1: "sama", saksi2: "sama" });
    expect(jawab(h.saksi1, "2")).toContain("judi");
    expect(jawab(h.saksi2, "2")).toContain("mabuk");
  });

  it("tidak-tahu: tahu berselisih dan berpisah, TIDAK menyebut satu pun alasan", () => {
    const h = usulan.susunKeteranganSaksiSdg({
      templat: TEMPLAT,
      alasan: ["judi", "mabuk"],
      modus: { saksi2: { modus: "tidak-tahu" } },
    });
    expect(h.modus.saksi2).toBe("tidak-tahu");
    expect(jawab(h.saksi2, "2")).toContain("tidak mengetahui");
    expect(jawab(h.saksi2, "2")).not.toContain("judi");
    expect(jawab(h.saksi2, "2")).not.toContain("mabuk");
    // Saksi 1 tidak ikut berubah.
    expect(jawab(h.saksi1, "2")).toContain("judi");
  });

  it("dari-cerita: menyebut sumber ceritanya, dan tidak mengaku melihat sendiri", () => {
    const h = usulan.susunKeteranganSaksiSdg({
      templat: TEMPLAT,
      alasan: ["judi"],
      pelaku: "Penggugat",
      lawan: "Tergugat",
      modus: { saksi1: { modus: "dari-cerita", sumber: "lawan" } },
    });
    expect(jawab(h.saksi1, "2")).toContain("cerita tergugat");
    expect(jawab(h.saksi1, "3")).toContain("tidak pernah");
    expect(jawab(h.saksi1, "4")).toContain("diceritakan oleh tergugat");
  });

  it("sebagian: hanya alasan yang dipilih untuk saksi itu, bukan seluruh dalil", () => {
    const h = usulan.susunKeteranganSaksiSdg({
      templat: TEMPLAT,
      alasan: ["judi", "mabuk", "tidak memberi nafkah"],
      modus: { saksi2: { modus: "sebagian", alasan: ["mabuk"] } },
    });
    expect(jawab(h.saksi2, "2")).toContain("mabuk");
    expect(jawab(h.saksi2, "2")).not.toContain("judi");
    expect(jawab(h.saksi2, "2")).not.toContain("nafkah");
    expect(jawab(h.saksi2, "2")).toContain("selebihnya saya tidak tahu");
  });

  it("tidak-melihat: tidak pernah menyaksikan, tahu dari sekitar", () => {
    const h = usulan.susunKeteranganSaksiSdg({
      templat: TEMPLAT,
      alasan: ["judi"],
      modus: { saksi1: { modus: "tidak-melihat" } },
    });
    expect(jawab(h.saksi1, "3")).toContain("tidak pernah menyaksikan");
    expect(jawab(h.saksi1, "4")).toContain("cerita keluarga dan tetangga");
  });

  it("modus yang salah eja jatuh ke 'sama' - dan itu DISEBUTKAN pada hasilnya", () => {
    const h = usulan.susunKeteranganSaksiSdg({
      templat: TEMPLAT,
      alasan: ["judi"],
      modus: { saksi1: { modus: "ngasal" } },
    });
    expect(h.modus.saksi1).toBe("sama");
  });

  it("pertanyaan yang bukan urusan modus tetap dari templat, dan penutup tidak dibubuhi pembuka", () => {
    const h = usulan.susunKeteranganSaksiSdg({
      templat: TEMPLAT,
      alasan: ["judi"],
      modus: { saksi1: { modus: "tidak-tahu" }, saksi2: { modus: "dari-cerita" } },
    });
    expect(jawab(h.saksi1, "1")).toContain("tetangga");
    expect(jawab(h.saksi1, "5")).toBe("sudah cukup;");
    expect(jawab(h.saksi2, "5")).toBe("sudah cukup;");
  });
});

describe("templat tanya-jawab ABT: dua bentuk, satu pembaca", () => {
  it("larik DAN objek diterima", () => {
    // Halaman yang sama menuliskan ajax_data dari dua sumber: keterangan yang
    // sudah tersimpan sebagai larik, templat sebagai OBJEK - model ABT
    // berakhir "return (object)$data;". Pola lama menuntut kurung siku, jadi
    // membaca keterangan selalu berhasil sementara memuat templat selalu
    // gagal: satu fungsi, dua jalur, hanya satu yang pernah dicoba.
    const badan = abt.slice(abt.indexOf("async function muatTemplatAbt("));
    expect(badan.slice(0, 2600)).toContain("([[{][\\s\\S]*?[\\]}])");
    expect(badan.slice(0, 2600)).toContain("Object.keys(urai)");
  });

  it("objek berkunci angka diurutkan menurut nomornya", () => {
    // Urutan kunci objek tidak dijamin bahasa mana pun, dan yang menentukan
    // urutan pertanyaan adalah nomornya.
    const badan = abt.slice(abt.indexOf("async function muatTemplatAbt("));
    expect(badan.slice(0, 2600)).toContain(".sort((a, b) => Number(a) - Number(b))");
  });

  it("templat kosong disebut apa adanya, bukan diteruskan sebagai nol baris", () => {
    const badan = abt.slice(abt.indexOf("async function muatTemplatAbt("));
    expect(badan.slice(0, 2600)).toContain("templat itu tidak memuat satu pun pertanyaan.");
  });
});

describe("kaki panel: pintasan di kiri, ikon dan seri di kanan", () => {
  const alatIsi = readFileSync(path.join(akar, "ekstensi-sipp/panel-alat.js"), "utf8");
  const aleta = readFileSync(path.join(akar, "ekstensi-sipp/aleta.js"), "utf8");

  it("ABT dan halaman ALETA memasang barisan pintasannya", () => {
    // Barisan itu pula yang MENDORONG ikon segarkan dan nomor seri ke kanan
    // lewat margin otomatisnya; tanpa barisnya keduanya berdiri di kiri.
    for (const [nama, isi] of [["abt.js", abt], ["aleta.js", aleta]] as const) {
      expect(isi, nama).toContain("alatBarisPintasan(");
      expect(isi, nama).toContain("alatPasangPintasan(");
    }
  });

  it("keempat pintasannya ada di kedua panel", () => {
    for (const [nama, isi] of [["abt.js", abt], ["aleta.js", aleta]] as const) {
      for (const t of ["Alt+A", "Alt+P", "Alt+R", "Alt+Enter"]) {
        expect(isi, `${nama} kehilangan ${t}`).toContain(`tombol: "${t}"`);
      }
    }
  });

  it("tiap pintasan punya sasaran yang dijalankan - bukan hanya tulisan", () => {
    // Menampilkan pintasan yang tidak berbuat apa-apa mengajari orang bahwa
    // pintasannya tidak dapat dipercaya di mana pun.
    for (const [nama, isi] of [["abt.js", abt], ["aleta.js", aleta]] as const) {
      const blok = isi.slice(isi.indexOf('tombol: "Alt+A"'), isi.indexOf('tombol: "Alt+Enter"') + 900);
      expect((blok.match(/jalankan:/g) || []).length, nama).toBeGreaterThanOrEqual(4);
    }
  });

  it("pendengarnya tidak menumpuk saat panel digambar ulang", () => {
    // ABT menggambar ulang panelnya tiap kali disegarkan.
    const badan = alatIsi.slice(alatIsi.indexOf("function alatPasangPintasan("));
    expect(badan.slice(0, 900)).toContain("document.removeEventListener(\"keydown\", window[tanda], true)");
  });

  it("tidak menyela orang yang sedang mengetik", () => {
    const badan = alatIsi.slice(alatIsi.indexOf("function alatPasangPintasan("));
    expect(badan.slice(0, 1400)).toContain('[contenteditable="true"]');
  });
});

describe("panel ABT menawarkan modusnya", () => {
  it("lima modus, tiga sumber cerita, dan alasan sebagian per saksi", () => {
    for (const m of ["sama", "sebagian", "tidak-tahu", "tidak-melihat", "dari-cerita"]) {
      expect(abt).toContain(`["${m}", `);
    }
    expect(abt).toContain('["pelaku", "Penggugat/Pemohon"]');
    expect(abt).toContain('["lawan", "Tergugat/Termohon"]');
    expect(abt).toContain("aleta-sdg-alasan-saksi");
  });

  it("pilihannya dikirim ke bot bersama sebutan pihak", () => {
    expect(abt).toContain("modus: bacaModus(),");
    expect(abt).toContain('pelaku: (peta.get("0046") || {}).nilai || "",');
  });

  it("di halaman tanya-jawab, halaman dimuat ulang HANYA bila seluruhnya tersimpan", () => {
    expect(abt).toContain("if (!gagal.length && halamanTanyaJawab()) {");
  });
});
