// @vitest-environment node
/**
 * ============================================================================
 * 3 NOV 2026 - GARIS Z (SC Z) TIDAK BOLEH MENIMPA TULISAN (uji tangan BAS 631/Pdt.G/2026, layar-5/6)
 * ============================================================================
 *
 * Gejala 1.205.63: BAS ALUR 04 [3] (jawaban, gugatan rekonvensi, court calendar) - garis Z dan "SC Z 1x / 02 November 2026" tercetak di
 * ATAS paragraf "Selanjutnya Ketua Majelis menyatakan ..." halaman 2, padahal halaman 1 bagian bawah kosong.
 * Akar masalah (dibuktikan 3 Nov):
 *   1. pdfjs di portal terpasang dibundel Next/Turbopack: pekerja "./pdf.worker.mjs" dicari di .next/server/chunks -> pengukuran Z GAGAL
 *      diam-diam -> naskah dikirim apa adanya (Z lama blangko tetap);
 *   2. Z lama blangko ada di paragraf KOSONG penutup bagian (isian #12030# menjadi paragraf ber-\par) - LibreOffice 7.4 membuang paragraf
 *      itu dan menambatkan bentuknya ke paragraf pertama bagian berikut (halaman 2); Word/WPS menggambarnya di halaman 1;
 *   3. jangkar Z melewati isian kosong "..." (Z menimpanya / "..." dipindah ke halaman sendiri), hanya Z TERAKHIR yang disesuaikan
 *      (BAS mediasi punya dua), dan garis bawah boleh turun melewati area teks bila halaman penuh.
 *
 *   A  pemeriksa silang (garis vs tulisan, tulisan vs tulisan) - GAGAL bila Z / tanggal menimpa tulisan;
 *   B  pdfjs dari dalam bundel (pekerja relatif tidak ada) - gagal tanpa aturPekerjaPdfjs, berhasil dengannya;
 *   C  perapian bot sebelum LibreOffice (bentuk di paragraf kosong penutup bagian);
 *   D  jangkar & penulisan RTF atas BAS Derry SUNGGUHAN (render ABT asli, data rekaan - fixtures/zcross-bas);
 *   E  orkestrasi dengan mesin palsu: tanpa ruang / bersilang garis -> Z tidak digambar, nomor halaman tetap;
 *   F  mesin sungguhan: Word (laptop) dan LibreOffice 7.4 server (ZCROSS_UJI_SOFFICE_JAUH=1) / soffice lokal (ZCROSS_MESIN=soffice):
 *      PDF hasil dibaca balik, TIDAK BOLEH ada satu pun pelanggaran silang di halaman mana pun.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { muatPdfjs } from "@/server/modules/aleta-ecourt/baca-pdf";
import { sesuaikanZcross, type Mesin } from "@/server/modules/aleta-ecourt/zcross";
import { RUANG_TANGGAL_AREA_TEKS, rencanaZ } from "@/server/modules/aleta-ecourt/zcross/geometri";
import { adaWord, mesinSoffice, mesinWord } from "@/server/modules/aleta-ecourt/zcross/mesin";
import { bacaGarisPdf } from "@/server/modules/aleta-ecourt/zcross/pdf-garis";
import { bacaKataPdf } from "@/server/modules/aleta-ecourt/zcross/pdf-letak";
import { periksaTumpang, ringkasPelanggaran, ruasMemotongKotak } from "@/server/modules/aleta-ecourt/zcross/periksa";
import { bersihkanZRtf, cariSemuaJangkarRtf, tulisBanyakZRtf, uraiRtf } from "@/server/modules/aleta-ecourt/zcross/rtf";

import { normalkanBahasaRtf, rapiBot, sepertiBot, sofficeServer } from "./fixtures/zcross-mesin-uji";

const lat1 = (b: Uint8Array) => Buffer.from(b).toString("latin1");
const bita = (s: string) => new Uint8Array(Buffer.from(s, "latin1"));
const FIX = path.join(process.cwd(), "src/test/fixtures/zcross-bas");
const fixture = (nama: string) => gunzipSync(readFileSync(path.join(FIX, `${nama}.rtf.gz`))).toString("latin1");

// ----------------------------------------------------------------------------
// A. Pemeriksa silang
// ----------------------------------------------------------------------------
async function pdfUji(gambar: (hal: ReturnType<PDFDocument["addPage"]>, font: Awaited<ReturnType<PDFDocument["embedFont"]>>) => void): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  gambar(pdf.addPage([595, 842]), font);
  return new Uint8Array(await pdf.save());
}
const atas = (y: number) => 842 - y; // pdf-lib: asal kiri-bawah

describe("A. pemeriksa silang Z", () => {
  it("ruas memotong kotak: mendatar melintasi badan huruf ya, garis bawah (underline) dan ruang kosong tidak", () => {
    const kotak = { x1: 100, x2: 200, y1: 92.6, y2: 99 };
    expect(ruasMemotongKotak({ x1: 50, y1: 96, x2: 300, y2: 96 }, kotak)).toBe(true);
    expect(ruasMemotongKotak({ x1: 50, y1: 101.5, x2: 300, y2: 101.5 }, kotak)).toBe(false);
    expect(ruasMemotongKotak({ x1: 210, y1: 96, x2: 300, y2: 96 }, kotak)).toBe(false);
    expect(ruasMemotongKotak({ x1: 250, y1: 45.8, x2: 50, y2: 145.8 }, kotak)).toBe(true); // diagonal melalui tengah kotak
    expect(ruasMemotongKotak({ x1: 300, y1: 50, x2: 100, y2: 150 }, kotak)).toBe(false); // diagonal lewat di sampingnya
  });

  it("PDF berisi Z yang mencoret kalimat dan tanggal yang menimpa kalimat -> pelanggaran; garis bawah, garis tabel dan Z di ruang kosong -> bersih", async () => {
    const buruk = await pdfUji((h, f) => {
      h.drawText("Selanjutnya Ketua Majelis menyatakan bahwa dengan adanya", { x: 113, y: atas(100), size: 12, font: f });
      h.drawText("rekonvensi, demi untuk memberikan kesempatan duplik", { x: 113, y: atas(120), size: 12, font: f });
      // Z lama (layar-5): garis atas di tengah tinggi huruf baris pertama, diagonal, garis bawah di baris kedua
      h.drawLine({ start: { x: 300, y: atas(96) }, end: { x: 540, y: atas(96) }, thickness: 0.75 });
      h.drawLine({ start: { x: 540, y: atas(96) }, end: { x: 113, y: atas(140) }, thickness: 0.75 });
      // "SC Z 1x" menimpa baris kedua
      h.drawText("SC Z 1x", { x: 120, y: atas(121), size: 12, font: f });
    });
    const p = periksaTumpang(await bacaKataPdf(buruk), await bacaGarisPdf(buruk));
    expect(p.some((x) => x.jenis === "garis-tulisan")).toBe(true);
    expect(p.some((x) => x.jenis === "tulisan-tulisan")).toBe(true);
    expect(ringkasPelanggaran(p)).toMatch(/hal 1/);

    const baik = await pdfUji((h, f) => {
      h.drawText("Kemudian Ketua Majelis meneliti jawaban yang telah diunggah", { x: 113, y: atas(100), size: 12, font: f });
      h.drawText("kepada Pemohon ke dalam SIP sebagai berikut;", { x: 113, y: atas(120), size: 12, font: f });
      h.drawLine({ start: { x: 113, y: atas(101.5) }, end: { x: 400, y: atas(101.5) }, thickness: 0.5 }); // garis bawah
      // tabel: garis di antara baris (tidak melintasi badan huruf)
      h.drawLine({ start: { x: 110, y: atas(104) }, end: { x: 540, y: atas(104) }, thickness: 0.5 });
      // Z di ruang kosong sesudah "berikut;" sampai bawah, tanggal di bawah garis
      h.drawLine({ start: { x: 390, y: atas(116) }, end: { x: 540, y: atas(116) }, thickness: 0.75 });
      h.drawLine({ start: { x: 540, y: atas(116) }, end: { x: 113, y: atas(700) }, thickness: 0.75 });
      h.drawLine({ start: { x: 113, y: atas(700) }, end: { x: 540, y: atas(700) }, thickness: 0.75 });
      h.drawText("SC Z 1x", { x: 113, y: atas(715), size: 12, font: f, color: rgb(0, 0, 0) });
      h.drawText("20 Juli 2026", { x: 113, y: atas(730), size: 12, font: f });
    });
    expect(periksaTumpang(await bacaKataPdf(baik), await bacaGarisPdf(baik))).toEqual([]);
  });
});

// ----------------------------------------------------------------------------
// B. pdfjs dari dalam bundel server
// ----------------------------------------------------------------------------
/**
 * Proses Node BARU (globalThis bersih - di proses uji pekerja pdfjs sudah termuat oleh uji lain): pdf.mjs disalin ke folder tanpa
 * pdf.worker.mjs (meniru .next/server/chunks portal terpasang), lalu dibaca (1) apa adanya dan (2) sesudah pekerja dipasang di
 * globalThis.pdfjsWorker - cara muatPdfjs (baca-pdf.ts, sama dengan perbaikan tanda tangan salinan f4bfe855).
 */
const PROBE_PDFJS = `
const [modul, pekerja, berkas] = process.argv.slice(2);
const g = globalThis;
if (!g.DOMMatrix) g.DOMMatrix = class { constructor(v) { [this.a, this.b, this.c, this.d, this.e, this.f] = Array.isArray(v) && v.length >= 6 ? v : [1, 0, 0, 1, 0, 0]; } multiply() { return this; } invertSelf() { return this; } translate() { return this; } scale() { return this; } };
if (!g.Path2D) g.Path2D = class {};
if (!g.ImageData) g.ImageData = class {};
const { readFileSync } = await import("node:fs");
const { pathToFileURL } = await import("node:url");
const pdfjs = await import(pathToFileURL(modul).href);
const baca = async () => {
  const dok = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(berkas)), useSystemFonts: true, isEvalSupported: false }).promise;
  const isi = await (await dok.getPage(1)).getTextContent();
  await dok.destroy();
  return isi.items.map((i) => i.str).join(" ");
};
// pekerja dipasang SEBELUM pemakaian pertama (pdfjs menyimpan hasil pemuatan pekerja palsunya - termasuk kegagalannya)
if (pekerja !== "-") g.pdfjsWorker = { WorkerMessageHandler: (await import(pathToFileURL(pekerja).href)).WorkerMessageHandler };
try { console.log("OK " + (await baca())); } catch (e) { console.log("GAGAL " + String(e && e.message || e)); }
`;

describe("B. pdfjs di portal terpasang (dibundel): pekerja di globalThis.pdfjsWorker", () => {
  it("pdf.mjs tanpa pdf.worker.mjs di sebelahnya GAGAL membaca (keadaan 1.205.63 - pengukuran Z gagal diam-diam); dengan pekerja di globalThis berhasil", async () => {
    const asli = path.join(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.mjs");
    const pekerja = path.join(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs");
    expect(existsSync(asli) && existsSync(pekerja)).toBe(true);
    const dasar = path.join(process.env.TMP || process.cwd(), "uji-pdfjs-bundel");
    mkdirSync(dasar, { recursive: true });
    const folder = mkdtempSync(path.join(dasar, "b-"));
    try {
      copyFileSync(asli, path.join(folder, "pdf.mjs"));
      writeFileSync(path.join(folder, "probe.mjs"), PROBE_PDFJS);
      const pdf = await pdfUji((h, f) => h.drawText("Bukti-bukti tersebut sebagai berikut:", { x: 113, y: 700, size: 12, font: f }));
      writeFileSync(path.join(folder, "uji.pdf"), pdf);
      // dua proses: (1) tanpa pekerja (keadaan portal 1.205.63), (2) pekerja dipasang di globalThis.pdfjsWorker sebelum pemakaian (muatPdfjs)
      const jalankan = (pk: string) =>
        execFileSync(process.execPath, [path.join(folder, "probe.mjs"), path.join(folder, "pdf.mjs"), pk, path.join(folder, "uji.pdf")], { encoding: "utf8", timeout: 60_000 }).trim().split("\n").pop() ?? "";
      expect(jalankan("-")).toMatch(/^GAGAL .*worker/i);
      expect(jalankan(pekerja)).toMatch(/^OK .*berikut:/);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  }, 90_000);

  it("muatPdfjs memasang pekerja di globalThis.pdfjsWorker (dipakai bacaKataPdf/bacaItemPdf/bacaGarisPdf - pengukuran Z)", async () => {
    await muatPdfjs();
    expect(typeof (globalThis as { pdfjsWorker?: { WorkerMessageHandler?: unknown } }).pdfjsWorker?.WorkerMessageHandler).toBe("function");
    const pdf = await pdfUji((h, f) => h.drawText("sebagai berikut:", { x: 113, y: 700, size: 12, font: f }));
    expect((await bacaKataPdf(pdf)).kata.map((k) => k.t).join(" ")).toContain("berikut:");
  });
});

// ----------------------------------------------------------------------------
// C. Perapian bot sebelum LibreOffice
// ----------------------------------------------------------------------------
describe("C. bot: bentuk di paragraf kosong penutup bagian diberi spasi tak terpecah", () => {
  const SHP = "{\\shp{\\*\\shpinst\\shpleft0\\shptop100\\shpright2000\\shpbottom900{\\sp{\\sn shapeType}{\\sv 202}}{\\shptxt \\pard SC Z 1x\\par}}}";
  it("paragraf kosong + bentuk + \\sect -> \\~ sebelum \\sect; paragraf bertulisan / tanpa bentuk / bentuk di kepala halaman tidak disentuh", () => {
    const kosong = `{\\rtf1\\ansi\\pard isian\\par \\pard {${SHP}}{\\sect }\\sectd\\sbkpage\\pard Selanjutnya\\par}`;
    const h = rapiBot.rapikanBentukAkhirBagian(kosong);
    expect(h.diubah).toBe(1);
    expect(h.rtf).toContain("\\~\\sect");
    // isi naskah tidak berubah (spasi tak terpecah tidak bertulisan)
    expect(uraiRtf(h.rtf).paragraf.map((p) => p.teks.trim())).toEqual(["isian", "", "Selanjutnya"]);
    const bertulisan = `{\\rtf1\\ansi\\pard isian ${SHP}{\\sect }\\sectd\\pard Selanjutnya\\par}`;
    expect(rapiBot.rapikanBentukAkhirBagian(bertulisan).diubah).toBe(0);
    const tanpaBentuk = `{\\rtf1\\ansi\\pard isian\\par \\pard {\\sect }\\sectd\\pard Selanjutnya\\par}`;
    expect(rapiBot.rapikanBentukAkhirBagian(tanpaBentuk).diubah).toBe(0);
    const diKepala = `{\\rtf1\\ansi{\\header \\pard ${SHP}\\par}\\pard isian\\par \\pard {\\sect }\\sectd\\pard Selanjutnya\\par}`;
    expect(rapiBot.rapikanBentukAkhirBagian(diKepala).diubah).toBe(0);
  });

  it("BAS ALUR 04 [3] sungguhan (jawaban kosong, mirip 631): tanda Z lama di paragraf kosong penutup bagian -> dirapikan", () => {
    const s = fixture("bas04-3-jawaban-kosong");
    expect(rapiBot.rapikanBentukAkhirBagian(s).diubah).toBe(1);
    // perapian lengkap jalur cetak bot (rtfSofficeRapi + rtfBentukAkhirBagian) memuat spasi tak terpecah itu
    expect(rapiBot.semua(Buffer.from(s, "latin1")).toString("latin1")).toContain("\\~\\sect");
  });
});

// ----------------------------------------------------------------------------
// D. Jangkar & penulisan atas BAS Derry sungguhan (render ABT asli, data rekaan)
// ----------------------------------------------------------------------------
describe("D. jangkar Z di BAS sungguhan", () => {
  it("BAS ALUR 04 [3] jawaban kosong: jangkar = isian '...' (bukan '...sebagai berikut;'), ganti halaman memakai pemisah blangko", () => {
    const s = fixture("bas04-3-jawaban-kosong");
    const u = uraiRtf(s);
    const j = cariSemuaJangkarRtf(s, u);
    expect(j.length).toBe(1);
    expect(u.paragraf[j[0].teksIndeks].teks.trim()).toBe("...");
    expect(u.paragraf[j[0].indeks].teks.trim()).toMatch(/sebagai berikut;$/);
    expect(j[0].akhirIndeks).toBeGreaterThan(j[0].teksIndeks);
    expect(u.paragraf[j[0].akhirIndeks].penutup).toBe("sect");
    // dibersihkan: tidak ada sisa Z lama, kotak tanggal lama dipakai ulang
    const b = bersihkanZRtf(s);
    expect(b.rtf).not.toMatch(/SC\s*Z|\\shpgrp/);
    expect(b.kotakPerJangkar[0]).toMatch(/SC Z 1x/);
    // ditulis: bentuk di paragraf "...", TIDAK ada pemisah bagian tambahan ("..." tidak dipindah ke halaman sendiri)
    const r = rencanaZ({ halaman: 1, lebarHalaman: 609.5, tinggiHalaman: 842, xAkhir: 123, yDasar: 593, ukuranHuruf: 12, teksBaris: "..." }, { kiri: 113.4, kanan: 552.8, bawah: 85 });
    const t = tulisBanyakZRtf(b.rtf, [{ teksIndeks: j[0].teksIndeks, akhirIndeks: j[0].akhirIndeks, rencana: r, kotakTanggal: b.kotakPerJangkar[0], tanggal: "20 Juli 2026", nomorBerikut: 14 }]);
    expect(t.per[0].seksi).toBe("dipakai");
    expect((t.rtf.match(/\\sect(?![a-z])/g) ?? []).length).toBe((b.rtf.match(/\\sect(?![a-z])/g) ?? []).length);
    const u2 = uraiRtf(t.rtf);
    expect(u2.paragraf[j[0].teksIndeks].shp.length).toBe(2);
    expect(u2.paragraf.map((p) => p.teks)).toEqual(u.paragraf.map((p) => p.teks));
    expect(t.rtf).toContain("\\pgnstarts14");
  });

  it("BAS mediasi: DUA tempat Z (formulir penjelasan + penetapan mediator); kotak 'SC Z' kedua tanpa tanggal ikut dibuang", () => {
    const s = fixture("bas04-1-mediasi");
    const j = cariSemuaJangkarRtf(s, uraiRtf(s));
    expect(j.length).toBe(2);
    const u = uraiRtf(s);
    expect(u.paragraf[j[0].teksIndeks].teks).toMatch(/sebagai berikut:\s*$/);
    expect(u.paragraf[j[1].teksIndeks].teks).toMatch(/penetapan sebagai berikut:\s*$/);
    const b = bersihkanZRtf(s);
    expect(b.rtf).not.toMatch(/SC\s*Z|\\shpgrp/);
    expect(b.kotakPerJangkar.every((k) => /SC Z 1x/.test(k ?? "") && /\d{4}/.test(k ?? ""))).toBe(true);
  });

  it("BAS ALUR 05 [2] laporan mediasi: Z bentuk bebas TANPA kotak 'SC Z' sesudah '... berikut ini :' ikut dikenali (dulu dibiarkan bentuk lama)", () => {
    const s = fixture("bas05-2-laporan-mediasi");
    const u = uraiRtf(s);
    const j = cariSemuaJangkarRtf(s, u);
    expect(j.length).toBe(1);
    expect(u.paragraf[j[0].teksIndeks].teks).toMatch(/berikut ini\s*:\s*$/);
    const b = bersihkanZRtf(s);
    expect(b.rtf).not.toMatch(/FreeForm/);
    expect(b.kotakPerJangkar[0]).toBeNull(); // tanpa kotak lama: kotak "SC Z 1x" + tanggal dibuat baru
  });

  it("BAS pembuktian dan verstek: satu tempat Z sesudah daftar bukti", () => {
    for (const nama of ["bas04-6-pembuktian", "bas02-2-verstek"]) {
      const s = fixture(nama);
      const u = uraiRtf(s);
      const j = cariSemuaJangkarRtf(s, u);
      expect(j.length, nama).toBe(1);
      expect(u.paragraf[j[0].teksIndeks].teks, nama).toMatch(/Bukti-bukti tersebut sebagai berikut:\s*$/);
    }
  });
});

// ----------------------------------------------------------------------------
// E. Orkestrasi dengan mesin palsu (letak diketahui)
// ----------------------------------------------------------------------------
const SP = (n: string, v: string | number) => `{\\sp{\\sn ${n}}{\\sv ${v}}}`;
const TANDA_Z =
  `{\\shp{\\*\\shpinst\\shpleft-36\\shptop1282\\shpright2323\\shpbottom2107\\shpbxcolumn\\shpbypara\\shpwr3\\shplid1026${SP("shapeType", 202)}${SP("wzName", "Text Box 3")}` +
  `{\\shptxt \\pard\\plain\\fs24 SC Z 1x\\par\\pard\\plain\\fs24 20 Juli 2026\\par}}}`;
/** BAS rekaan: `baris` paragraf satu baris, lalu pengantar, satu bukti, jangkar ber-tanda Z, pemisah bagian, kalimat sesudahnya. */
function basBaris(baris: number): string {
  let s = `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Arial;}}\\paperw12191\\paperh16840\\margl2268\\margr1134\\margt1701\\margb1701\r\n\\sectd\\sbkpage\\pgnrestart\\pgnstarts5\\marglsxn2268\\margrsxn1134\\margtsxn1701\\margbsxn1701\r\n`;
  for (let i = 1; i <= baris; i += 1) s += `\\pard\\plain\\f0\\fs24 Baris isi nomor ${i}.\\par\r\n`;
  s += `\\pard\\plain\\f0\\fs24 Penggugat menyerahkan bukti surat berupa:\\par\r\n\\pard\\plain\\f0\\fs24 Fotokopi surat (P.1);\\par\r\n`;
  s += `\\pard\\plain\\f0\\fs24 ${TANDA_Z}Bukti-bukti tersebut sebagai berikut:\\sect\r\n\\sectd\\sbkpage\\pgnrestart\\pgnstarts15\\pard\\plain\\f0\\fs24 Selanjutnya sidang ditutup.\\par}`;
  return s;
}

/** Mesin palsu: tiap paragraf satu baris 16 pt dari y=85 (atas) s.d. batas bawah area teks (margin 3 cm), \sect = halaman baru. */
function mesinTata(opsi: { garisTegak?: boolean } = {}): Mesin {
  return {
    nama: "uji",
    async ubah(isi, dari, ke) {
      if (ke !== "pdf") return isi;
      if (dari !== "rtf") throw new Error("mesin palsu hanya RTF");
      const u = uraiRtf(lat1(isi));
      const pdf = await PDFDocument.create();
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const tinggi = 842;
      const halamanBaru = () => {
        const h = pdf.addPage([609.5, tinggi]);
        if (opsi.garisTegak && pdf.getPageCount() === 1) h.drawLine({ start: { x: 330, y: tinggi - 60 }, end: { x: 330, y: 40 }, thickness: 0.5 });
        return h;
      };
      let hal = halamanBaru();
      let y = 85 + 12; // garis dasar baris pertama (dari atas)
      for (const p of u.paragraf) {
        const t = p.teks.trim();
        if (t) {
          if (y > tinggi - 85) {
            hal = halamanBaru();
            y = 97;
          }
          hal.drawText(t, { x: 113.4, y: tinggi - y, size: 12, font });
          y += 16;
        }
        if (p.penutup === "sect") {
          hal = halamanBaru();
          y = 97;
        }
      }
      return new Uint8Array(await pdf.save());
    },
  };
}

describe("E. orkestrasi: Z hanya di ruang kosong", () => {
  it("ruang cukup: Z digambar sesudah kalimat terakhir, nomor bagian berikut ditulis", async () => {
    const h = await sesuaikanZcross(bita(basBaris(10)), "rtf", { mesin: mesinTata(), hanyaBentuk: true, jumlahBukti: 1 });
    expect(h.laporan.diubah).toBe(true);
    expect(h.laporan.daftar?.[0].digambar).toBe(true);
    expect(lat1(h.bita)).toContain("zcross-garis");
    expect(lat1(h.bita)).toContain("\\pgnstarts7"); // halaman 5 + 1 bukti + 1
  });

  it("kalimat terakhir di baris terakhir halaman (tanpa ruang kosong): Z & tanggal TIDAK digambar, peringatan, nomor halaman tetap ditulis", async () => {
    // 42 baris per halaman (garis dasar 97..753 pt): 39 baris isi + pengantar + bukti + jangkar = baris ke-42 (dasar area teks 757 pt)
    const h = await sesuaikanZcross(bita(basBaris(39)), "rtf", { mesin: mesinTata(), hanyaBentuk: true, jumlahBukti: 1 });
    expect(h.laporan.diubah).toBe(true);
    expect(h.laporan.halamanFisikZ).toBe(1);
    expect(h.laporan.daftar?.[0]).toMatchObject({ digambar: false, sebab: "tanpa-ruang" });
    const rtf = lat1(h.bita);
    expect(rtf).not.toContain("zcross-garis");
    expect(rtf).not.toMatch(/SC\s*Z/); // tanda lama dibuang, tidak dipindah ke tempat lain
    expect(rtf).toContain("\\pgnstarts7");
    expect(h.laporan.temuan.some((t) => t.tingkat === "peringatan" && /tidak digambar/.test(t.pesan))).toBe(true);
  });

  it("ada garis lain (tabel/garis tegak) di ruang yang akan ditutup: Z tidak digambar (tidak pernah memotong garis/tabel)", async () => {
    const h = await sesuaikanZcross(bita(basBaris(10)), "rtf", { mesin: mesinTata({ garisTegak: true }), hanyaBentuk: true, jumlahBukti: 1 });
    expect(h.laporan.daftar?.[0]).toMatchObject({ digambar: false, sebab: "bersilang" });
    expect(lat1(h.bita)).not.toContain("zcross-garis");
    expect(h.laporan.temuan.some((t) => /menimpa tulisan/.test(t.pesan))).toBe(true);
  });

  it("kalimat jangkar tidak ditemukan di PDF: TIDAK menebak 'berikut' lain (court calendar); tanda Z lama dibuang (tanpa Z) + peringatan", async () => {
    const tanpaJangkar: Mesin = {
      nama: "uji",
      async ubah(isi, _dari, ke) {
        if (ke !== "pdf") return isi;
        // PDF hanya memuat kalimat court calendar "...sebagai berikut:" di halaman 2
        const pdf = await PDFDocument.create();
        const font = await pdf.embedFont(StandardFonts.Helvetica);
        pdf.addPage([609.5, 842]).drawText("Kemudian Ketua Majelis menyatakan sidang dibuka.", { x: 113, y: 700, size: 12, font });
        pdf.addPage([609.5, 842]).drawText("jadwal persidangan (court calendar) yang baru sebagai berikut:", { x: 113, y: 700, size: 12, font });
        return new Uint8Array(await pdf.save());
      },
    };
    const s = basBaris(5);
    const h = await sesuaikanZcross(bita(s), "rtf", { mesin: tanpaJangkar, hanyaBentuk: true });
    expect(h.laporan.alasan).toMatch(/tidak ditemukan/);
    const rtf = lat1(h.bita);
    // tidak ada Z sama sekali: bukan di "berikut:" court calendar, bukan tanda Z lama blangko
    expect(rtf).not.toContain("zcross-garis");
    expect(rtf).not.toMatch(/SC\s*Z/);
    expect(h.laporan.diubah).toBe(true);
    expect(h.laporan.temuan.some((t) => t.tingkat === "peringatan" && /tidak dapat dipasang/.test(t.pesan))).toBe(true);
    // teks naskah dan ganti halaman blangko tetap
    expect(uraiRtf(rtf).paragraf.map((p) => p.teks)).toEqual(uraiRtf(s).paragraf.map((p) => p.teks));
    expect(rtf).toContain("\\pgnstarts15");
  });
});

// ----------------------------------------------------------------------------
// F. Mesin sungguhan
// ----------------------------------------------------------------------------
type KasusMesin = { nama: string; mesin: Mesin };
const mesinUji: KasusMesin[] = [];
if (process.env.ZCROSS_UJI_MESIN !== "0" && adaWord()) mesinUji.push({ nama: "word", mesin: mesinWord() });
if (process.env.ZCROSS_UJI_SOFFICE_JAUH === "1") mesinUji.push({ nama: "soffice-server-7.4", mesin: sepertiBot(sofficeServer()) });
if ((process.env.ZCROSS_MESIN || "").toLowerCase() === "soffice") mesinUji.push({ nama: "soffice-lokal", mesin: sepertiBot(mesinSoffice()) });
const keluarRender = process.env.ZCROSS_RENDER_DIR || path.resolve(process.env.TMP || process.cwd(), "zcross-3nov");

const KASUS_BAS = [
  { berkas: "bas04-3-jawaban-kosong", z: 1, sesudah: /^Selanjutnya Ketua Majelis/ },
  { berkas: "bas04-3-jawaban-terisi", z: 1, sesudah: /^Selanjutnya Ketua Majelis/ },
  { berkas: "bas04-1-mediasi", z: 2, sesudah: null },
  { berkas: "bas04-6-pembuktian", z: 1, sesudah: null },
  { berkas: "bas02-2-verstek", z: 1, sesudah: null },
  { berkas: "bas05-2-laporan-mediasi", z: 1, sesudah: null },
];

describe.skipIf(!mesinUji.length)(`F. mesin sungguhan (${mesinUji.map((m) => m.nama).join(", ")}): PDF hasil tanpa satu pun silang`, () => {
  for (const m of mesinUji) {
    for (const k of KASUS_BAS) {
      it(`${m.nama} - ${k.berkas}: Z di ruang kosong sesudah tulisan terakhir, tanggal di bawah garis, tidak ada tulisan/tabel yang tertimpa`, async () => {
        const asal = fixture(k.berkas);
        const h = await sesuaikanZcross(bita(asal), "rtf", { mesin: m.mesin, hanyaBentuk: true });
        expect(h.laporan.diubah, JSON.stringify(h.laporan)).toBe(true);
        expect(h.laporan.daftar?.length).toBe(k.z);
        expect(h.laporan.daftar?.every((d) => d.digambar), JSON.stringify(h.laporan.daftar)).toBe(true);
        const rtf = lat1(h.bita);
        expect((rtf.match(/zcross-garis/g) ?? []).length).toBe(k.z);
        expect(rtf).not.toMatch(/\\shpgrp|FreeForm/);
        expect((rtf.match(/SC Z 1x/g) ?? []).length).toBe(k.z);
        // teks naskah tidak berubah
        expect(uraiRtf(rtf).paragraf.map((p) => p.teks)).toEqual(uraiRtf(asal).paragraf.map((p) => p.teks));

        const pdf = await m.mesin.ubah(h.bita, "rtf", "pdf");
        mkdirSync(keluarRender, { recursive: true });
        writeFileSync(path.join(keluarRender, `${m.nama}-${k.berkas}.pdf`), pdf);
        const baca = await bacaKataPdf(pdf);
        const garis = await bacaGarisPdf(pdf);
        // TIDAK ADA satu pun garis yang melintasi tulisan dan tidak ada tulisan yang saling menimpa - di SEMUA halaman
        const langgar = periksaTumpang(baca, garis);
        expect(langgar, ringkasPelanggaran(langgar, 6)).toEqual([]);

        for (const d of h.laporan.daftar ?? []) {
          const hz = d.halamanFisik;
          const tinggi = baca.halaman[hz - 1].tinggi;
          const g = garis.filter((x) => x.halaman === hz);
          // Z = diagonal + garis mendatar di ujung atas (garis atas) dan ujung bawahnya (garis bawah)
          const diag = g.find((x) => Math.abs(x.y2 - x.y1) > 20 && Math.abs(x.x2 - x.x1) > 20);
          expect(diag, `diagonal Z hal ${hz}`).toBeTruthy();
          const yAtas = Math.min(diag!.y1, diag!.y2);
          const yBawah = Math.max(diag!.y1, diag!.y2);
          const atasZ = g.find((x) => Math.abs(x.y1 - x.y2) < 0.5 && Math.abs(x.y1 - yAtas) < 1.5 && Math.abs(x.x2 - x.x1) > 5);
          const bawahZ = g.find((x) => Math.abs(x.y1 - x.y2) < 0.5 && Math.abs(x.y1 - yBawah) < 1.5 && Math.abs(x.x2 - x.x1) > 200);
          expect(atasZ && bawahZ, `garis atas/bawah Z hal ${hz}`).toBeTruthy();
          // garis atas: sebaris dengan tulisan TERAKHIR sebelum tanda Z, mulai SESUDAH kata terakhirnya
          const kataHal = baca.kata.filter((x) => x.halaman === hz && x.yDasar < tinggi - 1701 / 20);
          const sebaris = kataHal.filter((x) => x.yDasar - 12 <= atasZ!.y1 && atasZ!.y1 <= x.yDasar + 1);
          expect(sebaris.length, `tulisan sebaris garis atas hal ${hz}`).toBeGreaterThan(0);
          const ujung = sebaris.reduce((a, b) => (a.x2 > b.x2 ? a : b));
          expect(Math.min(atasZ!.x1, atasZ!.x2)).toBeGreaterThanOrEqual(ujung.x2 - 0.5);
          // tidak ada tulisan badan naskah di bawah baris itu pada halaman Z (yang ditutup memang ruang kosong) selain "SC Z 1x / tanggal"
          const diBawah = kataHal.filter((x) => x.yDasar > ujung.yDasar + 2 && x.yDasar < bawahZ!.y1);
          expect(diBawah.map((x) => x.t), `tulisan di dalam Z hal ${hz}`).toEqual([]);
          // garis bawah dekat batas bawah area teks; "SC Z 1x" + tanggal di bawahnya, masih di area teks
          expect(Math.abs(bawahZ!.y1 - (tinggi - 1701 / 20 - RUANG_TANGGAL_AREA_TEKS))).toBeLessThan(2.5);
          const label = kataHal.filter((x) => x.yDasar > bawahZ!.y1);
          expect(label.map((x) => x.t).join(" "), `tulisan di bawah garis Z hal ${hz}`).toMatch(/^SC Z 1x \d{1,2} \S+ \d{4}$/);
          expect(Math.max(...label.map((x) => x.yDasar))).toBeLessThan(tinggi - 1701 / 20 + 1);
        }
        // bagian sesudah Z dimulai di halaman berikutnya
        if (k.sesudah) {
          const hz = h.laporan.halamanFisikZ!;
          const pertama = baca.kata.filter((x) => x.halaman === hz + 1)[0];
          expect(pertama?.t ?? "").toMatch(/Selanjutnya/);
        }
      }, 240_000);
    }
  }

  it.skipIf(!mesinUji.some((x) => x.nama.startsWith("soffice")))(
    "pembanding LibreOffice: naskah 631 TANPA Z otomatis dengan perapian bot LAMA -> Z lama menimpa 'Selanjutnya ...' (pemeriksa menangkapnya); perapian baru -> bersih",
    async () => {
      const asal = Buffer.from(fixture("bas04-3-jawaban-kosong"), "latin1");
      // perapian versi 1.205.63 (cermin + nomor halaman saja) vs perapian baru (+ bentuk di paragraf kosong penutup bagian)
      const lama = Buffer.from(rapiBot.rapikanKotakNomorHalaman(rapiBot.rapikanBentukCermin(asal.toString("latin1")).rtf).rtf, "latin1");
      const polos = sofficeOtomatis();
      const pdfLama = await polos.ubah(new Uint8Array(normalkanBahasaRtf(lama)), "rtf", "pdf");
      writeFileSync(path.join(keluarRender, "pembanding-631-tanpa-z-perapian-lama.pdf"), pdfLama);
      const pLama = periksaTumpang(await bacaKataPdf(pdfLama), await bacaGarisPdf(pdfLama));
      expect(pLama.length, "Z lama di halaman 2 harus tertangkap").toBeGreaterThan(0);
      expect(pLama.every((x) => x.halaman === 2)).toBe(true);
      const pdfBaru = await polos.ubah(new Uint8Array(normalkanBahasaRtf(rapiBot.semua(asal))), "rtf", "pdf");
      writeFileSync(path.join(keluarRender, "pembanding-631-tanpa-z-perapian-baru.pdf"), pdfBaru);
      expect(periksaTumpang(await bacaKataPdf(pdfBaru), await bacaGarisPdf(pdfBaru))).toEqual([]);
    },
    240_000
  );
});

/** soffice TANPA perapian (server bila ZCROSS_UJI_SOFFICE_JAUH=1, selainnya lokal) - untuk pembanding perapian lama/baru. */
function sofficeOtomatis(): Mesin {
  return process.env.ZCROSS_UJI_SOFFICE_JAUH === "1" ? sofficeServer() : mesinSoffice();
}
