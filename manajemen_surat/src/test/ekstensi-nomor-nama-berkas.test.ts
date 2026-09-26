// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * NOMOR PERKARA DARI NAMA BERKAS, DAN YANG TIDAK DIKIRIM - DIJALANKAN
 * ============================================================================
 *
 * Putusan massal dari berkas membaca nomor perkara dari NAMA berkas. Sampai
 * 25 September 2026 pembacanya menuntut garis miring - yang mustahil ada di
 * nama berkas Windows - sehingga cocok 0 dari 8.614 nama dokumen nyata di
 * folder unduhan petugas, termasuk 0 dari nama buatan ALETA sendiri. Fiturnya
 * mati sejak lahir tanpa satu galat pun.
 *
 * Uji ini MENJALANKAN fungsi yang sungguhan (dipotong dari konten.js, bukan
 * disalin) atas nama-nama berbentuk nyata. Ukur besarnya - 8.614 nama dan 197
 * naskah yang nomor isinya diketahui - ada di folder kerja
 * t1-ekstensi-unggah-simpan (ukur-nomor-dan-kiriman.ts), sebab daftar namanya
 * milik peramban petugas, bukan milik repo.
 *
 * Fixture: bentuk nama nyata; judul blangko saja, tanpa nama pihak.
 * ALETA_UJI_KONTEN menunjuk SALINAN konten.js untuk pembukti gigitan.
 */

const BERKAS_KONTEN = process.env.ALETA_UJI_KONTEN || path.resolve(process.cwd(), "../ekstensi-sipp/konten.js");
const konten = () => readFileSync(BERKAS_KONTEN, "utf8").replace(/\r\n/g, "\n");

/** Fungsi puncak - dibuka di kolom nol, ditutup "}" di kolom nol. */
function potongFungsi(isi: string, nama: string): string {
  const baris = isi.split("\n");
  const mulai = baris.findIndex((b) => new RegExp(`^(?:async )?function ${nama}\\(`).test(b));
  if (mulai < 0) throw new Error(`fungsi ${nama} tidak ketemu`);
  let j = mulai;
  while (j < baris.length && baris[j] !== "}") j += 1;
  return baris.slice(mulai, j + 1).join("\n");
}

/** Satu baris tetapan puncak. */
function tetapan(isi: string, nama: string): string {
  const baris = isi.split("\n").find((b) => b.startsWith(`const ${nama} = `));
  if (!baris) throw new Error(`tetapan ${nama} tidak ketemu`);
  return baris;
}

type Pilah = { nama: string; nomor: string; tolak: string; ganda: number };

function muatPembaca() {
  const isi = konten();
  const k: Record<string, unknown> = {};
  vm.createContext(k);
  // nomorDariNama bersarang di bagianMassalBerkas - dipotong apa adanya.
  const awal = isi.indexOf("  function nomorDariNama(nama) {");
  if (awal < 0) throw new Error("nomorDariNama (bersarang) tidak ketemu");
  const bersarang = isi.slice(awal, isi.indexOf("\n  }\n", awal) + 4);
  vm.runInContext(
    [
      tetapan(isi, "POLA_PERKARA"),
      potongFungsi(isi, "nomorDariNamaBerkas"),
      potongFungsi(isi, "tandaBukanNaskahPutusan"),
      potongFungsi(isi, "namaBerkasAnonim"),
      potongFungsi(isi, "pilahBerkasMassal"),
      bersarang,
      "this.nomorDariNama = nomorDariNama;",
      "this.nomorDariNamaBerkas = nomorDariNamaBerkas;",
      "this.pilah = (daftar) => pilahBerkasMassal(daftar.map((name) => ({ name })), nomorDariNama);",
    ].join("\n"),
    k
  );
  return k as unknown as {
    nomorDariNama: (n: string) => string;
    nomorDariNamaBerkas: (n: string) => string;
    pilah: (d: string[]) => Pilah[];
  };
}

// ---------------------------------------------------------------------------
describe("empat bentuk nama yang sungguh ada, ditambah garis miring lama", () => {
  const BENTUK: Array<[string, string]> = [
    // unduhan ALETA/ABT/Chrome (4.337 nama di folder petugas)
    ["100_Pdt.G_2026_PA.Dgl - [01] [Kabul Verstek] Cerai (Format Lengkap).rtf", "100/Pdt.G/2026/PA.Dgl"],
    // nama buatan ALETA sendiri (namaBerkas abt.js) - dahulu 0 dari 3
    ["492_Pdt.G_2026_PA.Dgl - Cerai Gugat - Dikabulkan verstek - anonimisasi.rtf", "492/Pdt.G/2026/PA.Dgl"],
    ["204_Pdt.P_2026_PA.Dgl - Itsbat Nikah - Dikabulkan.rtf", "204/Pdt.P/2026/PA.Dgl"],
    // e-Doc SIPP, nomornya terbalik (469)
    ["PA.Dgl_2025_Pdt.G_637_putusan_akhir.rtf", "637/Pdt.G/2025/PA.Dgl"],
    ["PA.Kng_2020_Pdt.G_24_putusan_anonimisasi.rtf", "24/Pdt.G/2020/PA.Kng"],
    // blangko lama bergaris bawah (970)
    ["01_Putusan_Cerai_Talak_Verstek_OK_299_Pdt_G_2021_PA_Buk_.rtf", "299/Pdt.G/2021/PA.Buk"],
    ["anonim_135_Pdt_G_2023_PA_Buk.rtf", "135/Pdt.G/2023/PA.Buk"],
    // unduhan Direktori Putusan MA (166)
    ["putusan_17_pdt.g_2021_pa.sgta_20210701.pdf", "17/Pdt.G/2021/PA.Sgta"],
    ["putusan_559_pdt.p_2021_pa.sor_20220908095312.pdf", "559/Pdt.P/2021/PA.Sor"],
    // garis miring lama
    ["492/Pdt.G/2026/PA.Dgl.rtf", "492/Pdt.G/2026/PA.Dgl"],
  ];

  for (const [nama, harap] of BENTUK) {
    it(`${nama} -> ${harap}`, () => {
      const p = muatPembaca();
      expect(p.nomorDariNama(nama)).toBe(harap);
    });
  }

  it("nol di depan nomor DIPERTAHANKAN - SIPP menyimpan perkara 2015 begitu", () => {
    const p = muatPembaca();
    expect(p.nomorDariNama("0302_Pdt.G_2015_PA.Dgl - [01] [Kabul Verstek] Cerai.rtf")).toBe("0302/Pdt.G/2015/PA.Dgl");
    expect(p.nomorDariNama("PA.Buk_2015_Pdt.G_0154_putusan_akhir.doc")).toBe("0154/Pdt.G/2015/PA.Buk");
    expect(p.nomorDariNama("putusan_0003_pdt.p_2015_pa.pst_20200726.pdf")).toBe("0003/Pdt.P/2015/PA.Pst");
  });

  it("jenis bertitik dua (gugatan sederhana) ikut terbaca", () => {
    const p = muatPembaca();
    expect(p.nomorDariNama("1_Pdt.G.S_2025_PA.Dgl - [01] Gugatan Sederhana.rtf")).toBe("1/Pdt.G.S/2025/PA.Dgl");
  });

  it("berkas kunci Word TIDAK dibaca - nomornya terpotong dua huruf", () => {
    // "~$6_Pdt.P_2022_PA.Buk - ..." adalah kunci milik "206_Pdt.P_2022_PA.Buk - ..."
    // yang sungguh ada di folder yang sama. Membacanya menghasilkan perkara 6.
    const p = muatPembaca();
    expect(p.nomorDariNama("~$6_Pdt.P_2022_PA.Buk - Isbat Nikah Kabul V.2.rtf")).toBe("");
  });

  it("dua nomor BERBEDA dalam satu nama tidak ditebak", () => {
    const p = muatPembaca();
    expect(p.nomorDariNama("100_Pdt.G_2026_PA.Dgl - salinan 101_Pdt.G_2026_PA.Dgl.rtf")).toBe("");
  });

  it("nama tanpa nomor tetap kosong, dan pemanggilan beruntun tidak saling mengganggu", () => {
    // POLA_PERKARA berbendera /g: tanpa lastIndex disetel ulang, pemanggilan
    // kedua mencari mulai dari tempat yang pertama berhenti.
    const p = muatPembaca();
    expect(p.nomorDariNama("@blangko CG baru.rtf")).toBe("");
    expect(p.nomorDariNama("492/Pdt.G/2026/PA.Dgl.rtf")).toBe("492/Pdt.G/2026/PA.Dgl");
    expect(p.nomorDariNama("492/Pdt.G/2026/PA.Dgl.rtf")).toBe("492/Pdt.G/2026/PA.Dgl");
  });
});

// ---------------------------------------------------------------------------
describe("yang ditandai dan TIDAK dikirim ke massal-dari-berkas", () => {
  const DITOLAK: Array<[string, RegExp]> = [
    ["PA.Kng_2020_Pdt.G_24_putusan_anonimisasi.rtf", /anonimisasi/],
    ["anonim_135_Pdt_G_2023_PA_Buk.rtf", /anonimisasi/],
    ["414_Pdt.G_2025_PA.Dgl - [02] BAS 1 P & T Hadir Mediasi.rtf", /BAS/],
    ["PA.Buk_2021_Pdt.G_163_bas_2.rtf", /BAS/],
    ["100_Pdt.G_2021_PA.Buk - @PHS Cerai (Contentious).rtf", /PHS/],
    ["phs_contesius_307_Pdt_G_2020_PA_Kng_.rtf", /PHS/],
    ["1_Pdt.G_2021_PA.Buk - A.3.a. Penunjukan Js-JsP.rtf", /penunjukan/],
    ["12_Pdt.G_2024_PA.Buk - Relaas Panggilan Sidang.rtf", /relaas/],
    ["1_Pdt.G_2021_PA.Buk - Sampul Berkas A - Contensius.rtf", /sampul/],
    ["125_Pdt.G_2023_PA.Buk - Akta Cerai.rtf", /akta/],
    ["PA.Buk_2021_Pdt.G_180_petitum.rtf", /petitum/],
    ["263_Pdt.G_2023_PA.Buk - 4. Pernyataan Para Pihak ttg Hasil Mediasi.rtf", /mediasi/],
    ["PA.Buk_2021_Pdt.G_76_penetapan_ikrar.rtf", /bukan putusan/],
    ["405_Pdt.G_2025_PA.Dgl - [01] Cerai V Kabul (Format Lengkap New).pdf", /\.pdf .*RTF atau TXT/],
    ["405_Pdt.G_2025_PA.Dgl - [01] Cerai V Kabul (Format Lengkap New).doc", /\.doc .*RTF atau TXT/],
    ["405_Pdt.G_2025_PA.Dgl - [01] Cerai V Kabul (Format Lengkap New).docx", /\.docx .*RTF atau TXT/],
    ["~$2_Pdt.G_2025_PA.Dgl - [01] Cerai V Kabul.rtf", /kunci sementara Word/],
  ];

  for (const [nama, sebab] of DITOLAK) {
    it(`ditolak: ${nama}`, () => {
      const [p] = muatPembaca().pilah([nama]);
      expect(p.tolak).toMatch(sebab);
    });
  }

  it("kata yang JUGA ada pada nama blangko putusan yang sah tidak menolak", () => {
    // Diukur atas nama nyata: "mediasi", "ikrar", "kuasa", "permohonan", dan
    // "posita" muncul pada blangko putusan sungguhan.
    const sah = [
      "370_Pdt.G_2026_PA.Dgl - [98] [Cabut] 2. Cerai P & T Hadir- Setelah Mediasi (Sebelum Jawaban).rtf",
      "164_Pdt.G_2024_PA.Buk - [01aa] CT Ikrar Talak - Tanpa Pembebanan.rtf",
      "175_Pdt.G_2022_PA.Buk - CT (Full) Kabul F Kuasa P V.2.rtf",
      "13_Pdt.P_2022_PA.Buk - Permohonan (Full) Gugur.rtf",
      "109_Pdt.G_2022_PA.Buk - CG (Lite) Verstek F Lengkap Posita.rtf",
      "PA.Dgl_2026_Pdt.G_66_putusan_akhir.rtf",
      "20_Pdt.G_2026_PA.Dgl - [01] Kabul.txt",
    ];
    const hasil = muatPembaca().pilah(sah);
    for (const p of hasil) {
      expect(p.tolak, p.nama).toBe("");
      expect(p.nomor, p.nama).not.toBe("");
    }
  });

  it("nomor yang punya lebih dari satu naskah menjadi PILIHAN, bukan yang terakhir menang", () => {
    const hasil = muatPembaca().pilah([
      "214_Pdt.G_2026_PA.Dgl - [01] Kabul.rtf",
      "214_Pdt.G_2026_PA.Dgl - [03] Menolak.rtf",
      "215_Pdt.G_2026_PA.Dgl - [01] Kabul.rtf",
    ]);
    expect(hasil.map((p) => p.ganda)).toEqual([2, 2, 0]);
  });
});

// ---------------------------------------------------------------------------
// Panelnya sendiri: pemilih, daftar, dan KIRIMAN yang sungguh terjadi.
const halaman: JSDOM[] = [];
afterEach(() => {
  while (halaman.length) halaman.pop()!.window.close();
});

function bukaPanelMassal() {
  const isi = konten();
  const dom = new JSDOM("<!doctype html><html><body><div id='wadah'></div></body></html>", {
    runScripts: "outside-only",
  });
  halaman.push(dom);
  const w = dom.window as unknown as Record<string, any>;
  const terkirim: Array<{ berkas: string; nomorPerkara: string }> = [];
  const antrean: any[] = [];
  w.alatAmbil = async (_alamat: string, opsi: { body: FormData }) => {
    const berkas = opsi.body.get("berkas") as File;
    terkirim.push({ berkas: berkas.name, nomorPerkara: String(opsi.body.get("nomorPerkara")) });
    return { ok: true, status: 200, json: async () => ({ ok: true, versi: 1 }) };
  };
  w.alatPesanGagal = (_g: unknown, s: number, apa: string) => `${apa} gagal: ${s}`;
  w.alatCatat = () => {};
  w.alatBuatAntrean = (pilihan: any) => ({ ...pilihan });
  w.alatSimpanAntrean = async (a: any) => void antrean.push(a);
  // Tidak ada antrean lama yang belum selesai di sini - boleh mengganti
  // (pertanyaannya diuji di ekstensi-massal-ujung-ke-ujung, bagian I).
  w.alatBolehGantiAntrean = async () => true;
  w.eval(
    [
      tetapan(isi, "ALETA_API_UNGGAH_NASKAH"),
      tetapan(isi, "BATAS_UNGGAH_NASKAH_MS"),
      tetapan(isi, "POLA_PERKARA"),
      potongFungsi(isi, "buatElemen"),
      potongFungsi(isi, "nomorDariNamaBerkas"),
      potongFungsi(isi, "tandaBukanNaskahPutusan"),
      potongFungsi(isi, "namaBerkasAnonim"),
      potongFungsi(isi, "pilahBerkasMassal"),
      potongFungsi(isi, "bagianMassalBerkas"),
      "window.__bagianMassalBerkas = bagianMassalBerkas;",
    ].join("\n")
  );
  const wadah = w.document.getElementById("wadah");
  const kotak = w.__bagianMassalBerkas(wadah);
  const pemilih = kotak.querySelector("input[type=file]") as HTMLInputElement;
  const tombol = kotak.querySelector("button") as HTMLButtonElement;
  const pilihBerkas = (nama: string[]) => {
    const daftar = nama.map((n) => new w.File(["{\\rtf1 isi}"], n, { type: "application/rtf" }));
    Object.defineProperty(pemilih, "files", { value: daftar, configurable: true });
    pemilih.dispatchEvent(new w.Event("change"));
  };
  const tungguSelesai = async () => {
    for (let i = 0; i < 200 && antrean.length === 0; i += 1) await new Promise((r) => setTimeout(r, 5));
  };
  return { w, kotak, pemilih, tombol, pilihBerkas, terkirim, antrean, tungguSelesai };
}

describe("panel putusan massal dari berkas - dijalankan di jsdom", () => {
  it("pemilihnya menerima RTF dan TXT saja, selaras dengan rute unggah-naskah", () => {
    const { pemilih } = bukaPanelMassal();
    expect(pemilih.accept).toBe(".rtf,.txt");
    expect(pemilih.multiple).toBe(true);
  });

  it("yang dikirim hanya naskah putusan bernomor; anonim, BAS, dan PDF TIDAK", async () => {
    const p = bukaPanelMassal();
    p.pilihBerkas([
      "100_Pdt.G_2026_PA.Dgl - [01] [Kabul Verstek] Cerai (Format Lengkap).rtf",
      "PA.Dgl_2025_Pdt.G_637_putusan_akhir.rtf",
      "492_Pdt.G_2026_PA.Dgl - Cerai Gugat - Dikabulkan verstek - anonimisasi.rtf",
      "414_Pdt.G_2025_PA.Dgl - [02] BAS 1 P & T Hadir Mediasi.rtf",
      "405_Pdt.G_2025_PA.Dgl - [01] Cerai V Kabul (Format Lengkap New).pdf",
      "@blangko CG baru.rtf",
    ]);
    expect(p.tombol.disabled).toBe(false);
    p.tombol.click();
    await p.tungguSelesai();
    expect(p.terkirim).toEqual([
      { berkas: "100_Pdt.G_2026_PA.Dgl - [01] [Kabul Verstek] Cerai (Format Lengkap).rtf", nomorPerkara: "100/Pdt.G/2026/PA.Dgl" },
      { berkas: "PA.Dgl_2025_Pdt.G_637_putusan_akhir.rtf", nomorPerkara: "637/Pdt.G/2025/PA.Dgl" },
    ]);
    expect(p.antrean[0].butir.map((b: { nomor: string }) => b.nomor)).toEqual([
      "100/Pdt.G/2026/PA.Dgl",
      "637/Pdt.G/2025/PA.Dgl",
    ]);
  });

  it("naskah ganda satu nomor TIDAK dikirim sampai petugas memilih salah satunya", async () => {
    const p = bukaPanelMassal();
    p.pilihBerkas(["214_Pdt.G_2026_PA.Dgl - [01] Kabul.rtf", "214_Pdt.G_2026_PA.Dgl - [03] Menolak.rtf"]);
    // Belum dipilih: tidak ada yang akan dikirim, tombolnya mati.
    expect(p.tombol.disabled).toBe(true);
    const pilihan = Array.from(p.kotak.querySelectorAll("input[type=radio]")) as HTMLInputElement[];
    expect(pilihan).toHaveLength(2);
    // Petugas memilih yang kedua.
    pilihan[1].checked = true;
    pilihan[1].dispatchEvent(new p.w.Event("change"));
    expect(p.tombol.disabled).toBe(false);
    p.tombol.click();
    await p.tungguSelesai();
    expect(p.terkirim.map((x) => x.berkas)).toEqual(["214_Pdt.G_2026_PA.Dgl - [03] Menolak.rtf"]);
  });
});
