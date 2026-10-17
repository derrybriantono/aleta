// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import * as TS from "@/lib/deteksi-sisa-blangko";
import { susunZip } from "@/server/shared/zip";

/**
 * ============================================================================
 * DETEKSI SISA BLANGKO PADA PUTUSAN / BAS / RELAAS (17 Okt 2026)
 * ============================================================================
 *
 * Satu aturan, dua salinan: ekstensi-sipp/deteksi-sisa-blangko.js (JS murni,
 * ekstensi) dan src/lib/deteksi-sisa-blangko.ts (portal). Uji ini:
 *   1. aturan yang diminta (positif) dan pengecualian kutipan (negatif) pada JS;
 *   2. salinan TS memberi hasil SAMA dengan JS atas masukan yang sama
 *      (RTF, teks, DOCX XML, DOCX zip) - menjaga keduanya selaras;
 *   3. dialog + kait unggah SIPP + alatUnduh/alatAmbil (jsdom): bersih -> tanpa
 *      dialog; ada temuan -> dialog dengan tiga pilihan; Batal menahan;
 *   4. TIDAK satu kata "Aleta" pada kalimat dialog dan daftar masalah.
 *
 * Seluruh naskah di sini rekaan - tidak ada data perkara asli.
 */

const AKAR = path.resolve(__dirname, "../../..");
const req = createRequire(import.meta.url);
const JS = req(path.join(AKAR, "ekstensi-sipp/deteksi-sisa-blangko.js")) as typeof TS;
const SUMBER_JS = readFileSync(path.join(AKAR, "ekstensi-sipp/deteksi-sisa-blangko.js"), "utf8");
const SUMBER_ALAT = readFileSync(path.join(AKAR, "ekstensi-sipp/panel-alat.js"), "utf8");

// ---------------------------------------------------------------------------
// Pembuat masukan rekaan
// ---------------------------------------------------------------------------
const WARNA = String.raw`{\colortbl;\red0\green0\blue0;\red255\green0\blue0;\red192\green0\blue0;\red0\green0\blue255;\red255\green165\blue0;}`;
function rtf(...paragraf: string[]): string {
  return String.raw`{\rtf1\ansi\deff0{\fonttbl{\f0 Times New Roman;}}${WARNA}\f0\fs24 ` + paragraf.map((p) => `${p}\\par `).join("") + "}";
}
function docxXml(...paragraf: Array<Array<{ t: string; warna?: string; highlight?: string }>>): string {
  const isi = paragraf
    .map((runs) => {
      const r = runs
        .map((x) => {
          const pr = (x.warna ? `<w:color w:val="${x.warna}"/>` : "") + (x.highlight ? `<w:highlight w:val="${x.highlight}"/>` : "");
          return `<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ""}<w:t xml:space="preserve">${x.t.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</w:t></w:r>`;
        })
        .join("");
      return `<w:p>${r}</w:p>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${isi}</w:body></w:document>`;
}
function docxBita(xml: string): Uint8Array {
  return new Uint8Array(
    susunZip([
      { nama: "[Content_Types].xml", isi: Buffer.from('<?xml version="1.0"?><Types/>') },
      { nama: "word/document.xml", isi: Buffer.from(xml, "utf8") },
    ])
  );
}

const jenisDari = (h: { temuan: Array<{ jenis: string }> }) => h.temuan.map((t) => t.jenis);

// ---------------------------------------------------------------------------
describe("1. aturan yang diminta (positif)", () => {
  const kasus: Array<[string, string, string]> = [
    ["kurung kosong", "Nama Penggugat [ ] bertempat tinggal", "kurung"],
    ["kurung berisi isian", "Pemohon [nama pemohon] bertempat tinggal", "kurung"],
    ["kurung titik", "Tergugat [...] bertempat tinggal", "kurung"],
    ["kurung ganda", "Pemohon [[nama]] bertempat tinggal", "kurung"],
    ["variabel #nnnn#", "Penggugat bernama #0046# telah hadir", "tanda"],
    ["variabel {{...}}", "Penggugat bernama {{nama_penggugat}} telah hadir", "tanda"],
    ["variabel <<...>>", "Penggugat bernama <<nama>> telah hadir", "tanda"],
    ["kata placeholder", "Isi placeholder tanggal sidang", "tanda"],
    ["isi di sini", "Tulis alamat, isi di sini saja", "tanda"],
    ["XXXX huruf besar", "Nomor perkara XXXX/Pdt.G/2026", "tanda"],
    ["perlu di review", "Pertimbangan ini perlu di review dahulu", "perbaikan"],
    ["perlu direview", "Pertimbangan ini perlu direview", "perbaikan"],
    ["perlu dicek", "Angka ini perlu dicek", "perbaikan"],
    ["periksa kembali", "Periksa kembali amar putusan", "perbaikan"],
    ["TODO", "TODO lengkapi pertimbangan", "perbaikan"],
    ["titik isian 4+", "umur .... tahun, agama Islam", "titik"],
    ["titik isian panjang", "bin/binti ..................... pekerjaan tani", "titik"],
    ["elipsis tunggal", "pada tanggal … di Donggala", "titik"],
    ["garis isian", "tanggal ______ bulan Oktober", "garis"],
    ["bin/binti belum dipilih", "Fulan bin/binti Fulan", "kalimat"],
    ["pilih salah satu", "(pilih salah satunya) sesuai keadaan", "kalimat"],
    ["kalimat Nomor ... tanggal ...", "Nomor ........ tanggal ........ dibacakan di persidangan", "titik"],
  ];
  for (const [nama, teks, jenis] of kasus) {
    it(nama, () => {
      const h = JS.periksaTeks(teks);
      expect(jenisDari(h)).toContain(jenis);
    });
  }

  it("tulisan merah RTF (\\cf2 merah, \\cf4 biru tidak, \\cf5 jingga tidak, \\cf3 merah tua ya)", () => {
    const h = JS.periksaRtf(rtf(String.raw`Bahwa {\cf2 kalimat ini masih perlu diganti} lalu normal`, String.raw`Teks {\cf4 biru saja} dan {\cf5 jingga saja}`, String.raw`Ada {\cf3 merah tua C00000} di sini`));
    const merah = h.temuan.filter((t) => t.jenis === "merah");
    expect(merah.map((t) => t.cocok)).toEqual(["kalimat ini masih perlu diganti", "merah tua C00000"]);
    expect(merah[0].paragraf).toBe(1);
    expect(merah[1].paragraf).toBe(3);
  });

  it("highlight merah RTF dan DOCX serta w:color merah / mirip merah", () => {
    expect(jenisDari(JS.periksaRtf(rtf(String.raw`Ada {\highlight2 sorotan merah} di sini`)))).toContain("merah");
    const h = JS.periksaDocxXml(
      docxXml(
        [{ t: "Normal " }, { t: "merah murni", warna: "FF0000" }],
        [{ t: "merah tua", warna: "C00000" }],
        [{ t: "biru", warna: "0000FF" }, { t: " hitam", warna: "000000" }, { t: " jingga", warna: "FFA500" }],
        [{ t: "sorot", highlight: "red" }]
      )
    );
    expect(h.temuan.filter((t) => t.jenis === "merah").map((t) => t.cocok)).toEqual(["merah murni", "merah tua", "sorot"]);
  });

  it("letak: nomor paragraf dan perkiraan halaman (\\page memajukan halaman; paragraf dihitung dari tempat mulainya)", () => {
    const h = JS.periksaRtf(rtf("Paragraf satu bersih", String.raw`\page Paragraf dua [nama] di halaman dua`, String.raw`Paragraf tiga {\page}terbelah [kosong] halaman`));
    const k = h.temuan.filter((t) => t.jenis === "kurung");
    expect(k.map((t) => [t.paragraf, t.halaman])).toEqual([
      [2, 2],
      [3, 2],
    ]);
    // pemisah halaman di tengah paragraf tidak memecah paragraf
    expect(h.jumlahParagraf).toBe(3);
  });

  it("letak tanpa pemisah halaman: perkiraan dari banyaknya tulisan", () => {
    const panjang = Array.from({ length: 40 }, (_, i) => `Paragraf nomor ${i + 1} ${"kata ".repeat(40)}`);
    const h = JS.periksaRtf(rtf(...panjang, "Penutup [nama]"));
    const k = h.temuan.find((t) => t.jenis === "kurung")!;
    expect(k.paragraf).toBe(41);
    expect(k.halaman).toBeGreaterThan(3);
  });
});

// ---------------------------------------------------------------------------
describe("2. pengecualian dan naskah bersih (negatif)", () => {
  const bersih: Array<[string, string]> = [
    ["ayat dalam kutip lurus", 'Allah berfirman: "Talak itu dua kali ... atau menceraikan dengan baik" dan seterusnya'],
    ["ayat dalam kutip miring", "Allah berfirman: “Talak itu dua kali … atau menceraikan dengan baik” dan seterusnya"],
    ["kutipan pasal dalam kutip tunggal", "Pasal 39 menyatakan '...sebagian...' bahwa perceraian dilakukan di sidang"],
    ["elipsis di awal kutipan", "Hadis sahih: “… dan sesungguhnya sebaik-baik kalian adalah yang terbaik akhlaknya”"],
    ["elipsis di akhir kutipan", "Hadis sahih: “Perbuatan halal yang paling dibenci Allah adalah …”"],
    ["berdampingan teks Arab", "فَإِمْسَاكٌ بِمَعْرُوفٍ ... أَوْ تَسْرِيحٌ بِإِحْسَانٍ"],
    ["didahului firman Allah (tanpa tanda kutip)", "Sebagaimana firman Allah dalam surat Al-Baqarah ayat 229 talak itu dua kali ... atau menceraikan dengan cara yang baik"],
    ["didahului dalam kitab", "Dalam kitab Fath al-Mu'in disebutkan bahwa seorang istri berhak atas nafkah ... selama masa iddah"],
    ["kurung siku angka dan sic", "QS. An-Nisa [4]: 34 dan kutipan [sic]"],
    ["kurung siku keterangan terbitan", "(Al-Suyuthi, Al-Asybah, [Beirut: Dar al-Kutub, 1990], hlm. 50)"],
    ["titik pengantar sebelum nominal Rp", "Biaya panggilan Tergugat ........................ Rp. 60.000,-"],
    ["titik pengantar elipsis Unicode sebelum Rp", "PNBP ………………………… Rp 20.000,-"],
    ["garis pemisah satu baris penuh", "________________________________________________"],
    ["anonimisasi xxx huruf kecil dan NIK 16 x", "Penggugat ( xxx ) bin xxx, NIK xxxxxxxxxxxxxxxx, tempat tinggal xxx"],
    ["angka romawi XXX", "sebagaimana Bab XXX Kompilasi"],
    ["memeriksa kembali (bukan periksa kembali)", "Pengadilan Tinggi memeriksa kembali perkara ini dan perlu diperiksa saksi lain"],
    ["tanda baca merah saja", "Normal"],
    ["teks putusan biasa", "Menimbang, bahwa Penggugat dan Tergugat telah menikah pada tanggal 12 Maret 2015, dst. sebagaimana tersebut di atas."],
  ];
  for (const [nama, teks] of bersih) {
    it(`bersih: ${nama}`, () => {
      const h = JS.periksaTeks(teks);
      expect(h.temuan, JSON.stringify(h.temuan)).toEqual([]);
    });
  }

  it("kutipan yang isinya HANYA titik-titik tetap blangko", () => {
    expect(jenisDari(JS.periksaTeks('Firman Allah: "...." selesai'))).toContain("titik");
    expect(jenisDari(JS.periksaTeks("Firman Allah: “…” selesai"))).toContain("titik");
  });

  it("titik panjang di dalam kutip tetap blangko (bukan elipsis kutipan)", () => {
    expect(jenisDari(JS.periksaTeks('Firman Allah: "Talak itu dua kali .............. atau" selesai'))).toContain("titik");
  });

  it("garis isian di tengah kalimat tetap blangko (hanya baris pemisah penuh yang lolos)", () => {
    expect(jenisDari(JS.periksaTeks("Tanda tangan: ______________"))).toContain("garis");
  });

  it("tanda baca saja yang berwarna merah tidak dihitung", () => {
    const h = JS.periksaRtf(rtf(String.raw`Teks biasa{\cf2 ;} dan{\cf2 , }lanjut`));
    expect(h.temuan).toEqual([]);
  });

  it("RTF dengan tabel font dan warna tidak membocorkan nama font ke naskah", () => {
    const h = JS.periksaRtf(rtf("Menimbang bahwa semuanya bersih"));
    expect(h.jumlahParagraf).toBe(1);
    expect(h.temuan).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe("3. salinan TS dan JS memberi hasil SAMA", () => {
  const teksKorpus = [
    "Nama Penggugat [ ] bertempat tinggal, umur ..... tahun",
    'Allah berfirman: "Talak itu dua kali ... atau menceraikan" dan Pasal ... menyatakan',
    "فَإِمْسَاكٌ بِمَعْرُوفٍ ... أَوْ تَسْرِيحٌ",
    "Biaya panggilan ........ Rp. 60.000,- dan perlu direview, TODO, #0046# {{x}} <<y>> XXXX",
    "________________",
    "tanggal _____ bin/binti Fulan pilih salah satu",
    "(Al-Suyuthi, [Beirut: Dar al-Fikr, 1990], hlm. 50) QS [4]: 34 [sic] [x] [[a b]]",
    "Hadis: “… dan sebaik-baik kalian” serta ‘…sebagian…’ dan placeholder, isi di sini",
    "bersih saja tanpa masalah apa pun di sini.",
  ];
  it("periksaTeks", () => {
    for (const t of teksKorpus) expect(TS.periksaTeks(t), t).toEqual(JS.periksaTeks(t));
  });

  const rtfKorpus = [
    rtf(String.raw`Bahwa {\cf2 merah} lalu normal [nama]`, String.raw`Baris dua {\page}halaman dua ...... {\cf3 merah tua}`, String.raw`ᕵ\'e9 Arab ... dan \'93kutipan ...\'94`),
    rtf(String.raw`{\highlight2 sorot} {\cf0 biasa} #1234# {\*\generator Msftedit;}teks`),
  ];
  it("periksaRtf", () => {
    for (const r of rtfKorpus) {
      expect(TS.periksaRtf(r)).toEqual(JS.periksaRtf(r));
      expect(TS.bacaRtfParagraf(r)).toEqual(JS.bacaRtfParagraf(r));
    }
  });

  it("periksaDocxXml dan periksaDocxBita (zip sungguhan)", async () => {
    const xml = docxXml(
      [{ t: "Ada " }, { t: "merah", warna: "FF0000" }, { t: " dan [nama] ..... " }],
      [{ t: "Normal bersih." }],
      [{ t: "sorot", highlight: "red" }, { t: " #0046# &amp; <tag>" }]
    );
    expect(TS.periksaDocxXml(xml)).toEqual(JS.periksaDocxXml(xml));
    const bita = docxBita(xml);
    const a = await TS.periksaDocxBita(bita);
    const b = await JS.periksaDocxBita(bita);
    expect(a).toEqual(b);
    expect(a!.temuan.length).toBeGreaterThan(3);
  });

  it("periksaBita mengenali RTF / DOCX / teks dari isinya (bukan akhiran) dan melewati yang tak terbaca", async () => {
    const enc = new TextEncoder();
    const r = enc.encode(rtf("ada [nama] di sini"));
    for (const nama of ["a.rtf", "a.doc", "a.rtf.doc", "tanpa-akhiran"]) {
      const a = await TS.periksaBita(r, nama);
      const b = await JS.periksaBita(r, nama);
      expect(a).toEqual(b);
      expect(a.dibaca).toBe(true);
      expect(a.bentuk).toBe("rtf");
    }
    expect((await JS.periksaBita(docxBita(docxXml([{ t: "[a]" }])), "x.docx")).bentuk).toBe("docx");
    const pdf = await JS.periksaBita(enc.encode("%PDF-1.4 ..."), "x.pdf");
    expect(pdf.dibaca).toBe(false);
    const biner = await JS.periksaBita(Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]), "x.doc");
    expect(biner.dibaca).toBe(false);
    expect((await JS.periksaBita(new Uint8Array(0), "x.rtf")).dibaca).toBe(false);
  });

  it("jenis naskah dari nama dan alamat sama", () => {
    const nama = ["630_Pdt.G_2026_PA.Dgl - [06] BAS 6 P & T Hadir.rtf", "Relaas Panggilan Sidang.rtf", "Putusan Cerai Gugat.rtf", "Penetapan Putusan Ikrar Talak.rtf", "gugatan.rtf", "Berita Acara Sidang.rtf"];
    for (const n of nama) expect(TS.jenisNaskahDariNama(n), n).toBe(JS.jenisNaskahDariNama(n));
    expect(JS.jenisNaskahDariNama(nama[0])).toBe("bas");
    expect(JS.jenisNaskahDariNama(nama[1])).toBe("relaas");
    expect(JS.jenisNaskahDariNama(nama[2])).toBe("putusan");
    expect(JS.jenisNaskahDariNama(nama[3])).toBe("");
    expect(JS.jenisNaskahDariNama(nama[4])).toBe("");
    const alamat = [
      "/aleta/api/aleta-ecourt/berkas-sipp?jenis=relaas&id=1",
      "/aleta/api/aleta-ecourt/berkas-sipp?jenis=bas&id=1",
      "/aleta/api/aleta-ecourt/berkas-sipp?jenis=putusan-anonim&id=1",
      "/aleta/api/aleta-ecourt/berkas-sipp?jenis=resi&id=1",
      "/aleta/api/aleta-ecourt/putusan/unggah-sipp",
      "/aleta/api/aleta-ecourt/putusan/unggah-naskah",
      "/aleta/api/aleta-ecourt/bas/unggah-sipp",
      "/aleta/api/aleta-ecourt/ecourt-putusan/unggah",
      "/aleta/api/aleta-ecourt/relaas-massal/cetak?tanggal=2026-10-17",
      "/aleta/api/aleta-ecourt/bas-massal?tanggal=2026-10-17",
      "/aleta/api/aleta-ecourt/sidang",
    ];
    for (const a of alamat) expect(TS.jenisNaskahDariAlamat(a), a).toBe(JS.jenisNaskahDariAlamat(a));
    expect(alamat.map((a) => JS.jenisNaskahDariAlamat(a))).toEqual(["relaas", "bas", "putusan", "", "putusan", "putusan", "bas", "putusan", "relaas", "bas", ""]);
  });

  it("susunDaftarTxt sama dan memuat jenis, letak, dan kalimat bermasalah", () => {
    const h = JS.periksaTeks("Pemohon [nama] umur ..... tahun");
    const a = TS.susunDaftarTxt(h.temuan, { nama: "putusan.rtf", jenis: "putusan" });
    const b = JS.susunDaftarTxt(h.temuan, { nama: "putusan.rtf", jenis: "putusan" });
    expect(a).toBe(b);
    expect(b).toContain("DAFTAR MASALAH");
    expect(b).toContain("Kurung siku yang belum diganti");
    expect(b).toContain("paragraf ke-1");
    expect(b).toContain("«[nama]»");
    expect(b).toContain("\r\n");
    expect(/aleta/i.test(b)).toBe(false);
  });

  it("aturan regex di dua berkas memuat keluarga pola yang sama (penjaga penyimpangan)", () => {
    const ts = readFileSync(path.join(AKAR, "manajemen_surat/src/lib/deteksi-sisa-blangko.ts"), "utf8");
    for (const potong of [
      "(?:pilih|pilihlah)\\s+salah\\s+satu(?:nya)?\\b",
      "\\bperlu\\s+(?:di\\s?)?(?:review|reviu|cek|check)\\w*",
      "#\\d{2,6}#",
      "X{4,}",
      "bin\\s*\\/\\s*binti",
      "_{3,}",
      "merahKah",
    ]) {
      expect(SUMBER_JS.includes(potong), `JS: ${potong}`).toBe(true);
      expect(ts.includes(potong), `TS: ${potong}`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// jsdom: dialog, kait SIPP, alatUnduh, alatAmbil
// ---------------------------------------------------------------------------
type Jendela = any;
const terbuka: JSDOM[] = [];
afterEach(() => {
  while (terbuka.length) terbuka.pop()!.window.close();
});
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));

function buka(html: string, url: string, opsi: { alat?: boolean } = {}) {
  const dom = new JSDOM(html, { url, runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as Jendela;
  const ctx = (dom as JSDOM & { getInternalVMContext(): vm.Context }).getInternalVMContext();
  w.TextDecoder = TextDecoder;
  w.TextEncoder = TextEncoder;
  w.Blob = Blob;
  w.DecompressionStream = DecompressionStream;
  w.Response = Response;
  const unduhan: Array<{ nama: string; tipe: string; teks: string; opsi: unknown }> = [];
  if (opsi.alat) {
    // panel-alat.js sungguhan; alatUnduh asli dipakai (chrome.runtime.sendMessage ditiru sesudah dimuat).
    vm.runInContext(SUMBER_JS, ctx, { filename: "deteksi-sisa-blangko.js" });
    vm.runInContext(SUMBER_ALAT, ctx, { filename: "panel-alat.js" });
    w.chrome = { runtime: { sendMessage: (_p: unknown, cb: (h: unknown) => void) => cb({ ok: true, id: 1 }), lastError: null } };
  } else {
    w.alatUnduh = async (blob: Blob, nama: string, o: unknown) => {
      unduhan.push({ nama, tipe: blob.type, teks: await blob.text(), opsi: o });
      return { ok: true, lewat: "ekstensi" };
    };
    vm.runInContext(SUMBER_JS, ctx, { filename: "deteksi-sisa-blangko.js" });
  }
  return { w, d: w.document as Document, ctx, unduhan };
}

function berkasRtf(w: Jendela, nama: string, isi: string) {
  const bita = Buffer.from(isi, "latin1");
  // jsdom belum punya Blob.arrayBuffer (Chrome punya): ditiru lewat FileReader pada prototipe,
  // supaya File yang disalin FormData pun tetap terbaca.
  const protoBlob = Object.getPrototypeOf(w.File.prototype);
  if (typeof protoBlob.arrayBuffer !== "function") {
    protoBlob.arrayBuffer = function arrayBuffer(this: Blob) {
      return new Promise((selesai, gagal) => {
        const pembaca = new w.FileReader();
        pembaca.onload = () => selesai(pembaca.result);
        pembaca.onerror = () => gagal(pembaca.error);
        pembaca.readAsArrayBuffer(this);
      });
    };
  }
  return new w.File([bita], nama, { type: "application/rtf" });
}

const tombol = (d: Document, teks: string) => Array.from(d.querySelectorAll("button")).find((b) => (b.textContent || "").includes(teks)) as HTMLButtonElement | undefined;
const dialog = (d: Document) => d.querySelector('[role="dialog"]');

describe("4. dialog peringatan (ekstensi)", () => {
  const RTF_KOTOR = rtf("Penggugat bernama [nama penggugat], umur ..... tahun", String.raw`Bahwa {\cf2 bagian ini merah}`);
  const RTF_BERSIH = rtf("Menimbang, bahwa Penggugat dan Tergugat telah menikah.");

  it("naskah bersih: tanpa dialog, lanjut", async () => {
    const h = buka("<!doctype html><body></body>", "http://192.168.10.10/SIPP/perkara_detil_agama/x");
    const f = berkasRtf(h.w, "putusan.rtf", RTF_BERSIH);
    const hasil = await h.w.aletaDeteksiSisa.tinjau(f, { nama: "putusan.rtf", jenis: "putusan", aksi: "unggah" });
    expect(hasil.lanjut).toBe(true);
    expect(dialog(h.d)).toBeNull();
  });

  it("jenis bukan putusan/BAS/relaas: tidak diperiksa sama sekali", async () => {
    const h = buka("<!doctype html><body></body>", "http://192.168.10.10/SIPP/x");
    const f = berkasRtf(h.w, "surat.rtf", RTF_KOTOR);
    const hasil = await h.w.aletaDeteksiSisa.tinjau(f, { nama: "surat.rtf", jenis: "", aksi: "unggah" });
    expect(hasil.lanjut).toBe(true);
    expect(dialog(h.d)).toBeNull();
  });

  it("ada temuan: dialog menyebut jenis + cuplikan + letak; 'Lanjut saja' meneruskan", async () => {
    const h = buka("<!doctype html><body></body>", "http://192.168.10.10/SIPP/x");
    const f = berkasRtf(h.w, "putusan.rtf", RTF_KOTOR);
    const janji = h.w.aletaDeteksiSisa.tinjau(f, { nama: "putusan.rtf", jenis: "putusan", aksi: "unggah" });
    await tunggu(30);
    const dlg = dialog(h.d)!;
    expect(dlg).not.toBeNull();
    const teks = dlg.textContent || "";
    expect(teks).toContain("Naskah ini masih memuat sisa blangko");
    expect(teks).toContain("Kurung siku yang belum diganti");
    expect(teks).toContain("[nama penggugat]");
    expect(teks).toContain("Titik-titik isian yang belum diisi");
    expect(teks).toContain("Tulisan berwarna merah");
    expect(teks).toContain("paragraf ke-1");
    expect(teks).toContain("diunggah");
    expect(/aleta/i.test(teks)).toBe(false);
    expect(tombol(h.d, "Unduh daftar masalah (.txt) lalu lanjut")).toBeTruthy();
    expect(tombol(h.d, "Lanjut saja")).toBeTruthy();
    expect(tombol(h.d, "Batal")).toBeTruthy();
    tombol(h.d, "Lanjut saja")!.click();
    const hasil = await janji;
    expect(hasil.lanjut).toBe(true);
    expect(dialog(h.d)).toBeNull();
    // Berkas yang sama dilanjutkan sekali: tidak ditanya lagi dalam tiga menit.
    const lagi = await h.w.aletaDeteksiSisa.tinjau(f, { nama: "putusan.rtf", jenis: "putusan", aksi: "unggah" });
    expect(lagi.lanjut).toBe(true);
    expect(dialog(h.d)).toBeNull();
  });

  it("Batal menahan; Esc sama dengan Batal", async () => {
    const h = buka("<!doctype html><body></body>", "http://192.168.10.10/SIPP/x");
    const f1 = berkasRtf(h.w, "bas-1.rtf", RTF_KOTOR);
    const j1 = h.w.aletaDeteksiSisa.tinjau(f1, { nama: "bas-1.rtf", jenis: "bas", aksi: "unduh" });
    await tunggu(30);
    expect(dialog(h.d)!.textContent).toContain("diunduh");
    tombol(h.d, "Batal")!.click();
    expect((await j1).lanjut).toBe(false);
    const f2 = berkasRtf(h.w, "bas-2.rtf", RTF_KOTOR + " ");
    const j2 = h.w.aletaDeteksiSisa.tinjau(f2, { nama: "bas-2.rtf", jenis: "bas", aksi: "unduh" });
    await tunggu(30);
    h.d.dispatchEvent(new h.w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect((await j2).lanjut).toBe(false);
    expect(dialog(h.d)).toBeNull();
  });

  it("'Unduh daftar masalah' menyimpan .txt lewat jalur unduh aman lalu lanjut", async () => {
    const h = buka("<!doctype html><body></body>", "http://192.168.10.10/SIPP/x");
    const f = berkasRtf(h.w, "Relaas Panggilan.rtf", RTF_KOTOR);
    const janji = h.w.aletaDeteksiSisa.tinjau(f, { nama: "Relaas Panggilan.rtf", jenis: "relaas", aksi: "unduh" });
    await tunggu(30);
    tombol(h.d, "Unduh daftar masalah (.txt) lalu lanjut")!.click();
    const hasil = await janji;
    expect(hasil.lanjut).toBe(true);
    expect(h.unduhan).toHaveLength(1);
    expect(h.unduhan[0].nama).toBe("Daftar masalah - Relaas Panggilan.txt");
    expect(h.unduhan[0].tipe).toContain("text/plain");
    expect(h.unduhan[0].teks).toContain("«[nama penggugat]»");
    expect(h.unduhan[0].opsi).toEqual({ tanpaPeriksaSisa: true });
    expect(/aleta/i.test(h.unduhan[0].teks)).toBe(false);
  });
});

describe("5. kait unggah langsung di halaman SIPP (tingkap e-Doc)", () => {
  const HALAMAN = (dari: string) => `<!doctype html><html><body>
<form id="frm_upload_file" method="post" action="http://192.168.10.10/SIPP/fileupload_c/validatePost" enctype="multipart/form-data">
<input type="hidden" name="enc" value="x"><input type="hidden" name="from" value="${dari}">
<input type="file" name="fileform" id="fileform"><input type="submit" id="simpan" value="Simpan"></form></body></html>`;
  const RTF_KOTOR = rtf("Putusan [isi di sini] umur ..... tahun");

  function pasangForm(h: ReturnType<typeof buka>, nama: string, isi: string) {
    const f = berkasRtf(h.w, nama, isi);
    const el = h.d.getElementById("fileform") as HTMLInputElement;
    Object.defineProperty(el, "files", { configurable: true, get: () => [f] });
    let terkirim = 0;
    h.d.getElementById("frm_upload_file")!.addEventListener("submit", (e) => {
      terkirim += 1;
      e.preventDefault();
    });
    return () => terkirim;
  }

  it("bersih: borang SIPP terkirim persis seperti biasa, tanpa dialog", async () => {
    const h = buka(HALAMAN("bas"), "http://192.168.10.10/SIPP/perkara_detil_agama/x");
    const terkirim = pasangForm(h, "bas.rtf", rtf("Sidang dibuka dan ditutup dengan baik."));
    (h.d.getElementById("simpan") as HTMLInputElement).click();
    await tunggu(40);
    expect(dialog(h.d)).toBeNull();
    expect(terkirim()).toBe(1);
  });

  it("BAS dengan sisa blangko: dialog muncul SEBELUM terkirim; Lanjut -> terkirim sekali; Batal -> tidak terkirim", async () => {
    const h = buka(HALAMAN("bas"), "http://192.168.10.10/SIPP/perkara_detil_agama/x");
    const terkirim = pasangForm(h, "bas.rtf", RTF_KOTOR);
    (h.d.getElementById("simpan") as HTMLInputElement).click();
    await tunggu(40);
    expect(dialog(h.d)).not.toBeNull();
    expect(terkirim()).toBe(0);
    tombol(h.d, "Lanjut saja")!.click();
    await tunggu(40);
    expect(terkirim()).toBe(1);
    expect(dialog(h.d)).toBeNull();

    const h2 = buka(HALAMAN("bas"), "http://192.168.10.10/SIPP/perkara_detil_agama/x");
    const terkirim2 = pasangForm(h2, "bas-lain.rtf", RTF_KOTOR + " ");
    (h2.d.getElementById("simpan") as HTMLInputElement).click();
    await tunggu(40);
    tombol(h2.d, "Batal")!.click();
    await tunggu(40);
    expect(terkirim2()).toBe(0);
  });

  it("e-Doc selain putusan/BAS/relaas (dokpmh) tidak disentuh", async () => {
    const h = buka(HALAMAN("dokpmh"), "http://192.168.10.10/SIPP/perkara_detil_agama/x");
    const terkirim = pasangForm(h, "pmh.rtf", RTF_KOTOR);
    (h.d.getElementById("simpan") as HTMLInputElement).click();
    await tunggu(40);
    expect(dialog(h.d)).toBeNull();
    expect(terkirim()).toBe(1);
  });

  it("kait TIDAK dipasang di ABT maupun portal", async () => {
    for (const url of ["http://192.168.10.10/aps_badilag/index.php/x", "http://192.168.10.10/aleta/x"]) {
      const h = buka(HALAMAN("bas"), url);
      const terkirim = pasangForm(h, "bas.rtf", RTF_KOTOR);
      (h.d.getElementById("simpan") as HTMLInputElement).click();
      await tunggu(40);
      expect(dialog(h.d), url).toBeNull();
      expect(terkirim(), url).toBe(1);
    }
  });
});

describe("6. alatUnduh dan alatAmbil (panel-alat.js sungguhan)", () => {
  const RTF_KOTOR = rtf("Pemohon [nama], umur ..... tahun");

  it("alatUnduh: BAS bersih -> unduh biasa; BAS kotor + Batal -> tidak diunduh; + Lanjut -> diunduh", async () => {
    const h = buka("<!doctype html><body></body>", "http://192.168.10.10/SIPP/x", { alat: true });
    const kirim: string[] = [];
    h.w.chrome.runtime.sendMessage = (p: { nama: string }, cb: (x: unknown) => void) => {
      kirim.push(p.nama);
      cb({ ok: true, id: 1 });
    };
    const bersih = new Blob([rtf("Sidang berjalan lancar.")], { type: "application/rtf" });
    const a = await h.w.alatUnduh(bersih, "630_Pdt.G_2026_PA.Dgl - [06] BAS 6 P & T Hadir.rtf");
    expect(a.ok).toBe(true);
    expect(kirim).toHaveLength(1);

    const kotor = new Blob([RTF_KOTOR], { type: "application/rtf" });
    const janji = h.w.alatUnduh(kotor, "631_Pdt.G_2026_PA.Dgl - [06] BAS 6 P & T Hadir.rtf");
    await tunggu(40);
    tombol(h.d, "Batal")!.click();
    const b = await janji;
    expect(b.ok).toBe(false);
    expect(b.dibatalkan).toBe(true);
    expect(kirim).toHaveLength(1);

    const janji2 = h.w.alatUnduh(new Blob([RTF_KOTOR + " "], { type: "application/rtf" }), "632_Pdt.G_2026_PA.Dgl - [06] BAS 6 P & T Hadir.rtf");
    await tunggu(40);
    tombol(h.d, "Lanjut saja")!.click();
    expect((await janji2).ok).toBe(true);
    expect(kirim).toHaveLength(2);
  });

  it("alatUnduh: nama bukan putusan/BAS/relaas (mis. surat) tidak diperiksa", async () => {
    const h = buka("<!doctype html><body></body>", "http://192.168.10.10/SIPP/x", { alat: true });
    const hasil = await h.w.alatUnduh(new Blob([RTF_KOTOR], { type: "application/rtf" }), "Surat Panggilan.rtf");
    expect(hasil.ok).toBe(true);
    expect(dialog(h.d)).toBeNull();
  });

  it("alatAmbil: unggah FormData ke unggah-sipp diperiksa; Batal -> fetch tidak dipanggil; slot anonim dilewati", async () => {
    const h = buka("<!doctype html><body></body>", "http://192.168.10.10/SIPP/x", { alat: true });
    const semua: string[] = [];
    h.w.fetch = async (alamat: unknown) => {
      semua.push(String(alamat));
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    };
    // Hanya unggahan yang dihitung (panel dapat memanggil rute lain sendiri).
    const unggahan = () => semua.filter((a) => /unggah-sipp/.test(a)).length;
    const badan = new h.w.FormData();
    badan.append("putusan", berkasRtf(h.w, "putusan.rtf", RTF_KOTOR), "putusan.rtf");
    badan.append("anonimisasi", berkasRtf(h.w, "putusan - anonim.rtf", RTF_KOTOR + " "), "putusan - anonim.rtf");
    const janji = h.w.alatAmbil("/aleta/api/aleta-ecourt/putusan/unggah-sipp", { method: "POST", body: badan, credentials: "include" }, "Mengunggah putusan ke SIPP");
    janji.catch(() => undefined);
    await tunggu(60);
    // satu dialog saja (putusan); anonimisasi tidak ikut diperiksa
    expect(h.d.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    tombol(h.d, "Batal")!.click();
    await expect(janji).rejects.toMatchObject({ dibatalkan: true });
    expect(unggahan()).toBe(0);

    const badan2 = new h.w.FormData();
    badan2.append("putusan", berkasRtf(h.w, "putusan2.rtf", RTF_KOTOR + "  "), "putusan2.rtf");
    const janji2 = h.w.alatAmbil("/aleta/api/aleta-ecourt/putusan/unggah-sipp", { method: "POST", body: badan2, credentials: "include" }, "Mengunggah putusan ke SIPP");
    await tunggu(60);
    tombol(h.d, "Lanjut saja")!.click();
    const r = await janji2;
    expect(r.ok).toBe(true);
    expect(unggahan()).toBe(1);
  });

  it("alatAmbil: permintaan biasa (GET) dan unggahan ke rute lain tidak diperiksa", async () => {
    const h = buka("<!doctype html><body></body>", "http://192.168.10.10/SIPP/x", { alat: true });
    h.w.fetch = async () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    const badan = new h.w.FormData();
    badan.append("berkas", berkasRtf(h.w, "surat.rtf", RTF_KOTOR), "surat.rtf");
    const r = await h.w.alatAmbil("/aleta/api/aleta-ecourt/dokumen/unggah", { method: "POST", body: badan, credentials: "include" }, "Mengunggah");
    expect(r.ok).toBe(true);
    expect(dialog(h.d)).toBeNull();
  });
});

describe("7. pemasangan", () => {
  it("manifest memuat deteksi-sisa-blangko.js di blok SIPP, ABT, dan portal sebelum panel-alat.js", () => {
    const m = JSON.parse(readFileSync(path.join(AKAR, "ekstensi-sipp/manifest.json"), "utf8")) as { content_scripts: Array<{ js: string[] }> };
    const blok = m.content_scripts.filter((b) => b.js.includes("panel-alat.js"));
    expect(blok).toHaveLength(3);
    for (const b of blok) expect(b.js.indexOf("deteksi-sisa-blangko.js")).toBeGreaterThanOrEqual(0);
    for (const b of blok) expect(b.js.indexOf("deteksi-sisa-blangko.js")).toBeLessThan(b.js.indexOf("panel-alat.js"));
  });

  it("skrip penyusun ekstensi memasukkan berkasnya", () => {
    expect(readFileSync(path.join(AKAR, "manajemen_surat/scripts/susun-ekstensi.mjs"), "utf8")).toContain('"deteksi-sisa-blangko.js"');
  });

  it("Blangko Derry memeriksa SEKALI di lakukanCetak sebelum RTF diunduh / diunggah", () => {
    const sumber = readFileSync(path.join(AKAR, "ekstensi-sipp/blangko-derry-isian.js"), "utf8");
    const awal = sumber.indexOf("async function lakukanCetak(");
    const periksa = sumber.indexOf("aletaDeteksiSisa.tinjau(", awal);
    const unduh = sumber.indexOf("await unduh(", awal);
    expect(periksa).toBeGreaterThan(awal);
    expect(periksa).toBeLessThan(unduh);
    expect(sumber.match(/aletaDeteksiSisa\.tinjau\(/g)).toHaveLength(1);
  });

  it("modul ekstensi tidak menulis kata ALETA ke SIPP: tanpa fetch/XHR/borang, dan teks dialognya bebas ALETA", () => {
    // Satu-satunya jaringan di modul ini: tidak ada. Kelas DOM berawalan aleta-sisa- hanya di halaman, bukan data kirim.
    expect(SUMBER_JS).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|sendBeacon|\.submit\(\)\s*;\s*\/\/\s*kirim/);
    const teksTampil = [...SUMBER_JS.matchAll(/"([^"\n]{12,})"/g), ...SUMBER_JS.matchAll(/`([^`\n]{12,})`/g)].map((m) => m[1]).filter((s) => !/^(?:\/|\.|#|[a-z-]+:)/.test(s));
    expect(teksTampil.filter((s) => /aleta/i.test(s) && !/aleta-sisa-tabir/.test(s)), "kalimat bermuatan kata Aleta").toEqual([]);
  });

  it("relaas massal: pekerja latar mencatat sisa blangko tanpa menahan cetak; panel menampilkannya", () => {
    const latar = readFileSync(path.join(AKAR, "ekstensi-sipp/latar.js"), "utf8");
    expect(latar).toContain('importScripts("deteksi-sisa-blangko.js")');
    expect(latar).toContain("const sisa = relaasPeriksaSisa(rtf);");
    expect(latar.indexOf("const sisa = relaasPeriksaSisa(rtf);")).toBeLessThan(latar.indexOf("await terbitkanUnduhan(`data:application/rtf;base64,${relaasBase64(rtf)}`"));
    expect(readFileSync(path.join(AKAR, "ekstensi-sipp/jurusita.js"), "utf8")).toContain("Masih memuat sisa blangko");
  });
});
