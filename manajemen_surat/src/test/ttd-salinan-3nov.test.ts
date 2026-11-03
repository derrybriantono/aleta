// @vitest-environment node
/**
 * ============================================================================
 * TANDA TANGAN PDF SALINAN (3 Nov 2026) - putusan "ttd" + TTD asli Panitera, BAS TTD asli KM & PS
 * ============================================================================
 *
 * Keluhan Derry (uji tangan 1.205.63, 2 Nov): salinan putusan 633/Pdt.G/2026 ([01] [Kabul Verstek] Cerai (Format Lengkap))
 * tanpa "ttd" dan tanpa tanda tangan Panitera; salinan BAS 631/Pdt.G/2026 (BAS ALUR 04 [3]) tanpa tanda tangan, nama penanda
 * tangan terdorong sendirian ke halaman 3. Akar masalah (diukur):
 *   1. blok majelis putusan = TABEL #8500#, tiap sel SATU paragraf "Label,\par\par\par\par \b nama" - pembaca lama memotong di
 *      \pard saja ("Ketua Majelis,Himawan ...") sehingga "ttd" tidak pernah ditulis;
 *   2. tanda tangan BAS = SATU baris tabel dua sel bertumpuk - pembaca lama merangkai lintas sel dan tidak menemukan pasangan
 *      label-nama, jadi tidak ada tanda tangan asli yang diminta;
 *   3. pdfjs di portal terpasang (bundel Turbopack) gagal memuat pekerjanya ("Setting up fake worker failed: Cannot find module
 *      '/app/.next/server/chunks/pdf.worker.mjs'") - tanda tangan Panitera tidak pernah dibubuhkan walau bot sudah menyediakan
 *      ruangnya (PDF 633 = keluaran LibreOffice mentah, tanpa satu gambar pun);
 *   4. baris tabel tanda tangan BAS tanpa \trkeep terbelah LibreOffice (label halaman 2, nama halaman 3).
 *
 * Fixture (src/test/fixtures/ttd-salinan-3nov): blangko Derry SUNGGUHAN (pohon ABT 2 Nov) dirender seperti ABT dengan data
 * REKAAN (nama pihak & pejabat rekaan, nama bergelar tanpa spasi "S.H.I.,M.H."), lalu dirapikan seperti ekstensi = RTF yang
 * diterima bot. PDF *-lo74.pdf = keluaran LibreOffice 7.4.7.2 container aleta-bot (mesin PDF produksi) dari RTF keluaran bot
 * kode ini; sidik.json menjaga keduanya tetap sepasang. Gambar tanda tangan & cap = coretan rekaan berukuran piksel sama
 * dengan yang terdaftar (Panitera 428x307 JPG, PS 148x240 JPG, KM 254x201 PNG).
 *
 * Bila RTF keluaran bot sengaja diubah: buat ulang kedua PDF dengan LibreOffice 7.4 (container aleta-bot, rtfKePdf) dari
 * RTF keluaran bot, lihat PDF-nya, lalu perbarui sidik.json. Di mesin yang punya soffice, bagian 4 mengulang semua
 * pemeriksaan PDF atas hasil konversi baru.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { UKURAN_TTD_CAP_BAWAAN, ukuranUntukBot } from "@/lib/ukuran-ttd-cap";
import { muatPdfjs, pasangRintisanPeramban } from "@/server/modules/aleta-ecourt/baca-pdf";
import { bacaItemPdf, bubuhkanTtdPdf, susunBaris, type Baris } from "@/server/modules/aleta-ecourt/pdf-bubuh-ttd";

const AKAR = path.resolve(process.cwd(), "..");
const FIX = path.join(process.cwd(), "src/test/fixtures/ttd-salinan-3nov");
const muat = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const salinan = muat("./services/salinanPutusanService.js") as {
  susunSalinan: (r: string, o: { ttd: { jenis: string; isi: Buffer } | null; atur?: Record<string, number>; ttdDiPdf?: boolean }) => { rtf: string; laporan: Record<string, unknown> };
  tambahTtdPejabat: (r: string) => { rtf: string; ditambah: number; sudahAda: number };
  pejabatPenandatangan: (r: string) => Array<{ label: string; nama: string }>;
  jenisNaskahSalinan: (r: string) => "bas" | "putusan";
};
const rapi = muat("./services/rtfSofficeRapi.js") as {
  rapikanUntukSoffice: (b: Buffer) => { isi: Buffer; laporan: { cermin: number; nomorHalaman: number; barisTtd: number } };
};
const blok = muat("./services/blokTandaTanganRtf.js") as {
  bacaBaris: (r: string) => { baris: Array<{ teks: string; intbl: boolean; baris: number | null; sel: number | null; jenis: string }> };
};

const baca = (f: string) => readFileSync(path.join(FIX, f));
const PUTUSAN = baca("putusan-01-masuk.rtf").toString("latin1");
const BAS = baca("bas-04-3-masuk.rtf").toString("latin1");
const PDF_PUTUSAN = new Uint8Array(baca("putusan-01-salinan-lo74.pdf"));
const PDF_BAS = new Uint8Array(baca("bas-04-3-salinan-lo74.pdf"));
const TTD_PANITERA = { jenis: "jpg", isi: baca("ttd-panitera.jpg") };
const ATUR = ukuranUntukBot({ ...UKURAN_TTD_CAP_BAWAAN });
const SIDIK = JSON.parse(baca("sidik.json").toString("utf8")) as { putusanSalinan: string; basSalinan: string };
const md5 = (b: Buffer) => createHash("md5").update(b).digest("hex");

const NAMA = {
  km: "Hidayat Rekaan Wijaya, S.H.I.,M.H.",
  ha1: "Ilham Contoh, S.H.I., M.H.",
  ha2: "Dimas Percobaan, S.H.",
  ps: "Siti Nurcontoh, S.H.I., M.H",
  panitera: "Sri Rekaanwati, S.H.",
  psBas: "Rahmawati, S.H.",
};

/** Jalur rute bot /abt/pdf + rtfKePdf sampai RTF yang diubah LibreOffice. */
function keluaranBotPutusan(rtf = PUTUSAN): Buffer {
  const susun = salinan.susunSalinan(rtf, { ttd: TTD_PANITERA, atur: ATUR, ttdDiPdf: true });
  return rapi.rapikanUntukSoffice(Buffer.from(susun.rtf, "latin1")).isi;
}
const keluaranBotBas = (rtf = BAS): Buffer => rapi.rapikanUntukSoffice(Buffer.from(rtf, "latin1")).isi;

// ----------------------------------------------------------------------------
// Pembantu PDF: kemunculan teks berkoordinat (pt, asal kiri-bawah) dan jumlah gambar per halaman.
// ----------------------------------------------------------------------------
type Letak = { halaman: number; y: number; x1: number; x2: number; tinggi: number; tengah: number };
function cariSemua(baris: Baris[], teks: string): Letak[] {
  const hasil: Letak[] = [];
  for (const b of baris) {
    let i = b.teks.indexOf(teks);
    while (i >= 0) {
      const x1 = b.xAwal[i];
      const x2 = b.xAkhir[i + teks.length - 1];
      hasil.push({ halaman: b.halaman, y: b.y, x1, x2, tinggi: b.tinggi, tengah: (x1 + x2) / 2 });
      i = b.teks.indexOf(teks, i + teks.length);
    }
  }
  return hasil;
}
async function barisPdf(pdf: Uint8Array) {
  const { halaman, item } = await bacaItemPdf(pdf);
  return { halaman, item, baris: susunBaris(item) };
}
async function gambarPerHalaman(pdf: Uint8Array): Promise<number[]> {
  const pdfjs = await muatPdfjs();
  const dok = await pdfjs.getDocument({ data: new Uint8Array(pdf), useSystemFonts: true, isEvalSupported: false }).promise;
  const hasil: number[] = [];
  try {
    for (let n = 1; n <= dok.numPages; n += 1) {
      const ops = await (await dok.getPage(n)).getOperatorList();
      hasil.push(ops.fnArray.filter((f: number) => f === pdfjs.OPS.paintImageXObject || f === pdfjs.OPS.paintInlineImageXObject).length);
    }
  } finally {
    await dok.destroy();
  }
  return hasil;
}
/** Halaman memakai keadaan grafis /BM /Multiply (latar putih gambar tidak menutup tulisan di bawahnya). */
async function adaMultiply(pdf: Uint8Array, halaman: number): Promise<boolean> {
  const dok = await PDFDocument.load(pdf);
  const res = dok.getPages()[halaman - 1].node.Resources();
  const gs = res?.lookupMaybe(PDFName.of("ExtGState"), PDFDict);
  if (!gs) return false;
  return gs.entries().some(([, v]) => {
    const d = dok.context.lookupMaybe(v, PDFDict);
    return String(d?.get(PDFName.of("BM")) ?? "") === "/Multiply";
  });
}

/** Pemeriksaan PDF salinan putusan (fixture maupun konversi baru). */
async function periksaPdfPutusan(pdf: Uint8Array) {
  const { baris } = await barisPdf(pdf);
  const ttd = cariSemua(baris, "ttd").filter((t) => baris.some((b) => b.halaman === t.halaman && Math.abs(b.y - t.y) < 1 && b.teks.trim().replace(/\s+/g, " ").split(" ").every((k) => k === "ttd")));
  // tepat empat "ttd" di seluruh salinan
  expect(ttd).toHaveLength(4);
  // baris yang isinya HANYA label itu (sekali atau dua kolom "Hakim Anggota, Hakim Anggota,") - bukan kalimat yang memuatnya
  const label = (t: string) =>
    cariSemua(baris, t).filter((l) => baris.some((b) => b.halaman === l.halaman && Math.abs(b.y - l.y) < 1 && b.teks.split(t).every((x) => x.trim() === "")));
  const km = label("Ketua Majelis,");
  const ha = label("Hakim Anggota,");
  const ps = label("Panitera Sidang,");
  expect(km).toHaveLength(1);
  expect(ha).toHaveLength(2);
  expect(ps).toHaveLength(1);
  const pasangan: Array<[Letak, string]> = [
    [km[0], NAMA.km],
    [ha.sort((a, b) => a.tengah - b.tengah)[0], NAMA.ha1],
    [ha.sort((a, b) => a.tengah - b.tengah)[1], NAMA.ha2],
    [ps[0], NAMA.ps],
  ];
  for (const [lab, nama] of pasangan) {
    const n = cariSemua(baris, nama).filter((x) => x.halaman === lab.halaman && x.y < lab.y).sort((a, b) => b.y - a.y)[0];
    expect(n, `nama ${nama} sehalaman di bawah labelnya`).toBeTruthy();
    // "ttd" sehalaman, di antara label dan nama, rata tengah dengan labelnya, di baris kosong pertama (satu baris di bawah label)
    const t = ttd.find((x) => x.halaman === lab.halaman && x.y < lab.y && x.y > n.y && Math.abs(x.tengah - lab.tengah) < 3);
    expect(t, `"ttd" di ruang tanda tangan ${nama}`).toBeTruthy();
    expect(lab.y - t!.y).toBeGreaterThan(10);
    expect(lab.y - t!.y).toBeLessThan(30);
    expect(t!.y - n.y).toBeGreaterThan(30); // ruang tanda tangan tetap ada di antara "ttd" dan nama
  }
  // Blok "Untuk Salinan" utuh di satu halaman: penanda, "Panitera,", dan namanya
  const us = cariSemua(baris, "Untuk Salinan");
  const pan = cariSemua(baris, "Panitera,").filter((x) => x.halaman === us[0]?.halaman && x.y < us[0].y);
  const namaPan = cariSemua(baris, NAMA.panitera);
  expect(us).toHaveLength(1);
  expect(pan.length).toBeGreaterThan(0);
  expect(namaPan.at(-1)!.halaman).toBe(us[0].halaman);
  return { baris };
}

/** Pemeriksaan PDF salinan BAS: label dan nama penanda tangan sehalaman (tidak terbelah). */
async function periksaPdfBas(pdf: Uint8Array) {
  const { baris, halaman } = await barisPdf(pdf);
  const ps = cariSemua(baris, "Panitera Sidang,").at(-1)!;
  const km = cariSemua(baris, "Ketua Majelis,").at(-1)!;
  const nPs = cariSemua(baris, NAMA.psBas).at(-1)!;
  const nKm = cariSemua(baris, NAMA.km).at(-1)!;
  expect(ps.halaman).toBe(nPs.halaman);
  expect(km.halaman).toBe(nKm.halaman);
  expect(ps.halaman).toBe(km.halaman);
  expect(nPs.y).toBeLessThan(ps.y);
  expect(nKm.y).toBeLessThan(km.y);
  // tidak ada lagi halaman yang hanya berisi nama penanda tangan
  expect(ps.halaman).toBe(halaman.length);
  return { baris, halaman };
}

// ============================================================================
describe("0. pdfjs portal: pekerja dimuat di utas utama (sebab 3)", () => {
  it("PDF tetap terbaca walau import relatif pdf.worker.mjs tidak menemukan berkasnya (seperti bundel server)", async () => {
    pasangRintisanPeramban(); // pdf.mjs menyentuh DOMMatrix saat dimuat
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const lama = pdfjs.GlobalWorkerOptions.workerSrc;
    const g = globalThis as { pdfjsWorker?: unknown };
    delete g.pdfjsWorker;
    // jalur yang di server terpasang menghasilkan "Setting up fake worker failed: Cannot find module ..."
    pdfjs.GlobalWorkerOptions.workerSrc = path.join(os.tmpdir(), "tidak-ada", "pdf.worker.mjs");
    try {
      const { item } = await bacaItemPdf(PDF_BAS);
      expect(item.length).toBeGreaterThan(50);
      expect((g.pdfjsWorker as { WorkerMessageHandler?: unknown } | undefined)?.WorkerMessageHandler).toBeTruthy();
    } finally {
      pdfjs.GlobalWorkerOptions.workerSrc = lama;
    }
  });
});

describe("1. RTF blok tanda tangan blangko sungguhan (bot)", () => {
  it("putusan [01]: 'ttd' di keempat sel #8500# (KM, HA kiri, HA kanan, PS) pada baris kosong pertama, tanpa menambah baris", () => {
    const sebelum = blok.bacaBaris(PUTUSAN).baris.filter((b) => b.intbl);
    const h = salinan.susunSalinan(PUTUSAN, { ttd: TTD_PANITERA, atur: ATUR, ttdDiPdf: true });
    expect(h.laporan).toMatchObject({ ttdDitambah: 4, ttdSudahAda: 0, namaPanitera: NAMA.panitera, gambarTtdPanitera: true, untukSalinan: true });
    const sesudah = blok.bacaBaris(h.rtf).baris.filter((b) => b.intbl);
    const sel = (daftar: typeof sesudah, nama: string) => {
      const n = daftar.findIndex((b) => b.teks.trim() === nama);
      return daftar.filter((b) => b.baris === daftar[n].baris && b.sel === daftar[n].sel).map((b) => b.teks.trim());
    };
    for (const [label, nama] of [
      ["Ketua Majelis,", NAMA.km],
      ["Hakim Anggota,", NAMA.ha1],
      ["Hakim Anggota,", NAMA.ha2],
      ["Panitera Sidang,", NAMA.ps],
    ]) {
      // jumlah baris sel tetap (ttd menempati baris kosong, bukan baris baru)
      expect(sel(sesudah, nama)).toEqual([label, "ttd", "", "", nama]);
      expect(sel(sebelum, nama)).toEqual([label, "", "", "", nama]);
    }
    // diulang: tidak dobel
    expect(salinan.tambahTtdPejabat(h.rtf)).toMatchObject({ ditambah: 0, sudahAda: 4 });
  });

  it("panitera sidang = Panitera sendiri (label 'Panitera,') dan hakim tunggal ('Hakim,') juga ditulisi 'ttd'; blok Untuk Salinan tidak", () => {
    const varian = PUTUSAN.replace("Panitera Sidang,\\par", "Panitera,\\par").replace("Ketua Majelis,\\par", "Hakim,\\par");
    expect(varian).not.toBe(PUTUSAN);
    const h = salinan.susunSalinan(varian, { ttd: TTD_PANITERA, atur: ATUR, ttdDiPdf: true });
    expect(h.laporan.ttdDitambah).toBe(4);
    // "Panitera," di blok Untuk Salinan (sesudah majelis) tanpa "ttd": baris sesudahnya tetap kosong / nama Panitera
    const b = blok.bacaBaris(h.rtf).baris;
    const us = b.findIndex((x) => x.teks.includes("Untuk Salinan"));
    expect(b.slice(us).some((x) => x.teks.trim() === "ttd")).toBe(false);
  });

  it("BAS ALUR 04 [3]: penanda tangan dibaca per sel - Panitera Sidang & Ketua Majelis, nama bergelar tanpa spasi utuh", () => {
    expect(salinan.jenisNaskahSalinan(BAS)).toBe("bas");
    expect(salinan.pejabatPenandatangan(BAS)).toEqual([
      { label: "Panitera Sidang", nama: NAMA.psBas },
      { label: "Ketua Majelis", nama: NAMA.km },
    ]);
    // label "Panitera," (panitera sidang = Panitera) tetap terbaca
    expect(salinan.pejabatPenandatangan(BAS.replace("Panitera Sidang,}", "Panitera,}")).map((p) => p.label)).toEqual(["Panitera", "Ketua Majelis"]);
  });

  it("baris tabel tanda tangan diberi \\trkeep (BAS & blok Untuk Salinan); tabel agenda/rincian tidak disentuh; idempoten", () => {
    const bas = rapi.rapikanUntukSoffice(Buffer.from(BAS, "latin1"));
    expect(bas.laporan.barisTtd).toBe(1);
    const jumlah = (s: string) => (s.match(/\\trkeep(?![a-z])/g) ?? []).length;
    const keluar = bas.isi.toString("latin1");
    expect(jumlah(keluar) - jumlah(BAS)).toBe(2); // \trowd pembuka + \trowd salinan sebelum \row
    // teks naskah tidak berubah
    expect(blok.bacaBaris(keluar).baris.map((x) => x.teks)).toEqual(blok.bacaBaris(BAS).baris.map((x) => x.teks));
    expect(rapi.rapikanUntukSoffice(bas.isi).laporan.barisTtd).toBe(0);
    // putusan salinan: baris #8500# sudah ber-\trkeep, blok Untuk Salinan yang ditampakkan diberi \trkeep
    const put = salinan.susunSalinan(PUTUSAN, { ttd: TTD_PANITERA, atur: ATUR, ttdDiPdf: true }).rtf;
    expect(rapi.rapikanUntukSoffice(Buffer.from(put, "latin1")).laporan.barisTtd).toBe(1);
  });

  it("sidik: PDF fixture dibuat dari RTF keluaran bot kode ini (ubah RTF = buat ulang PDF LibreOffice 7.4 & periksa)", () => {
    expect(md5(keluaranBotPutusan()), "RTF salinan putusan berubah - buat ulang putusan-01-salinan-lo74.pdf").toBe(SIDIK.putusanSalinan);
    expect(md5(keluaranBotBas()), "RTF salinan BAS berubah - buat ulang bas-04-3-salinan-lo74.pdf").toBe(SIDIK.basSalinan);
  });
});

describe("2. PDF LibreOffice 7.4 (server) dari RTF keluaran bot", () => {
  it("putusan SALINAN: 'ttd' di 4 ruang tanda tangan (KM, HA kiri, HA kanan, PS), rata tengah di bawah label; blok Untuk Salinan utuh", async () => {
    await periksaPdfPutusan(PDF_PUTUSAN);
  });

  it("BAS SALINAN: label dan nama penanda tangan satu halaman (tidak lagi terbelah ke halaman berikut)", async () => {
    const { halaman } = await periksaPdfBas(PDF_BAS);
    expect(halaman).toHaveLength(3); // jumlah halaman sama dengan sebelum perbaikan
  });
});

describe("3. Tanda tangan dibubuhkan portal di PDF", () => {
  it("putusan: tanda tangan ASLI Panitera (+cap) di blok Untuk Salinan - rata tengah di atas nama, tidak menutup 'Panitera,'; majelis tanpa gambar", async () => {
    const r = await bubuhkanTtdPdf(PDF_PUTUSAN, [{ nama: NAMA.panitera, gambar: new Uint8Array(TTD_PANITERA.isi), cap: new Uint8Array(baca("cap.png")) }], { atur: ATUR, sesudahPenanda: true });
    expect(r.galat).toBe("");
    expect(r.dipasang).toEqual([NAMA.panitera]);
    const { baris } = await barisPdf(PDF_PUTUSAN);
    const nama = cariSemua(baris, NAMA.panitera).at(-1)!;
    const label = cariSemua(baris, "Panitera,").filter((x) => x.halaman === nama.halaman && x.y > nama.y).sort((a, b) => a.y - b.y)[0];
    const g = r.geometri[0];
    expect(g.halaman).toBe(nama.halaman);
    expect(Math.abs(g.ttd.kiri + g.ttd.lebar / 2 - nama.tengah)).toBeLessThan(0.6);
    expect(g.ttd.bawah).toBeGreaterThan(nama.y); // menimpa paling banyak sebagian atas huruf nama
    expect(g.ttd.bawah).toBeLessThan(nama.y + 0.72 * nama.tinggi + 0.01);
    expect(g.ttd.bawah + g.ttd.tinggi).toBeLessThanOrEqual(label.y - 0.22 * label.tinggi + 0.5); // tidak menutup "Panitera,"
    expect(g.cap).not.toBeNull();
    // gambar sungguh bertambah HANYA di halaman blok Untuk Salinan (tanda tangan + cap); halaman majelis ("ttd") tanpa gambar
    const asal = await gambarPerHalaman(PDF_PUTUSAN);
    const per = await gambarPerHalaman(r.pdf);
    const halMajelis = cariSemua(baris, "Ketua Majelis,").at(-1)!.halaman;
    expect(per.map((n, i) => n - asal[i])).toEqual(per.map((_, i) => (i === nama.halaman - 1 ? 2 : 0)));
    expect(per[halMajelis - 1]).toBe(halMajelis === nama.halaman ? 2 : 0);
    expect(await adaMultiply(r.pdf, nama.halaman)).toBe(true);
    // teks PDF tidak berubah
    expect((await bacaItemPdf(r.pdf)).item.map((i) => i.str)).toEqual((await bacaItemPdf(PDF_PUTUSAN)).item.map((i) => i.str));
  });

  it("BAS: tanda tangan ASLI Panitera Sidang dan Ketua Majelis di atas namanya masing-masing (nama SIPP berkapital/bertitik lain tetap ditemukan)", async () => {
    const r = await bubuhkanTtdPdf(
      PDF_BAS,
      [
        { nama: NAMA.psBas, gambar: new Uint8Array(baca("ttd-ps.jpg")) },
        // nama seperti tertulis di daftar tanda tangan (huruf besar, spasi sesudah koma) - blangko menulis "S.H.I.,M.H."
        { nama: "HIDAYAT REKAAN WIJAYA, S.H.I., M.H.", gambar: new Uint8Array(baca("ttd-km.png")) },
      ],
      { atur: ATUR }
    );
    expect(r.galat).toBe("");
    expect(r.dipasang).toHaveLength(2);
    const { baris, halaman } = await barisPdf(PDF_BAS);
    for (const [g, nama, labelTeks] of [
      [r.geometri[0], NAMA.psBas, "Panitera Sidang,"],
      [r.geometri[1], NAMA.km, "Ketua Majelis,"],
    ] as const) {
      const n = cariSemua(baris, nama).at(-1)!;
      const l = cariSemua(baris, labelTeks).at(-1)!;
      expect(g.halaman).toBe(n.halaman);
      expect(g.halaman).toBe(halaman.length);
      expect(Math.abs(g.ttd.kiri + g.ttd.lebar / 2 - n.tengah)).toBeLessThan(0.6);
      expect(g.ttd.bawah).toBeGreaterThan(n.y);
      expect(g.ttd.bawah + g.ttd.tinggi).toBeLessThanOrEqual(l.y - 0.22 * l.tinggi + 0.5);
      // gambar tidak melebar ke kolom tetangga
      expect(g.ttd.lebar).toBeLessThan(200);
    }
    const per = await gambarPerHalaman(r.pdf);
    expect(per[halaman.length - 1]).toBe(2);
    expect(per.reduce((a, b) => a + b, 0)).toBe(2);
    expect(await adaMultiply(r.pdf, halaman.length)).toBe(true);
  });

  it("cap yang tidak terbaca tidak membatalkan tanda tangannya; gambar rusak dilaporkan tanpa membatalkan yang lain", async () => {
    const rusak = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 9, 0, 0, 0, 9, 8, 6, 0, 0, 0, 1, 2, 3]);
    const r = await bubuhkanTtdPdf(PDF_PUTUSAN, [{ nama: NAMA.panitera, gambar: new Uint8Array(TTD_PANITERA.isi), cap: rusak }], { atur: ATUR, sesudahPenanda: true });
    expect(r.dipasang).toEqual([NAMA.panitera]);
    expect(r.galat).toMatch(/cap/);
    const r2 = await bubuhkanTtdPdf(
      PDF_BAS,
      [
        { nama: NAMA.psBas, gambar: rusak },
        { nama: NAMA.km, gambar: new Uint8Array(baca("ttd-km.png")) },
      ],
      { atur: ATUR }
    );
    expect(r2.dipasang).toEqual([NAMA.km]);
    expect(r2.tidakDitemukan).toEqual([NAMA.psBas]);
  });
});

// ----------------------------------------------------------------------------
// 4. Konversi baru dengan LibreOffice (hanya bila soffice ada: server / sesi awan) - pemeriksaan PDF yang sama.
// ----------------------------------------------------------------------------
const SOFFICE = process.env.ALETA_SOFFICE || "soffice";
const adaSoffice = (() => {
  try {
    execFileSync(SOFFICE, ["--version"], { stdio: "ignore", timeout: 20000 });
    return true;
  } catch {
    return false;
  }
})();

function soffice(rtf: Buffer): Uint8Array {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ttd-salinan-"));
  try {
    writeFileSync(path.join(dir, "naskah.rtf"), rtf);
    execFileSync(SOFFICE, ["--headless", "--norestore", `-env:UserInstallation=file://${path.join(dir, "profil").replace(/\\/g, "/")}`, "--convert-to", "pdf", "naskah.rtf", "--outdir", dir], { cwd: dir, timeout: 120000, stdio: "ignore" });
    return new Uint8Array(readFileSync(path.join(dir, "naskah.pdf")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("4. konversi LibreOffice baru (bila soffice ada)", () => {
  it.skipIf(!adaSoffice)("putusan & BAS SALINAN dari RTF keluaran bot kode ini: 'ttd' di 4 tempat, BAS tidak terbelah, tanda tangan terpasang", async () => {
    const put = soffice(keluaranBotPutusan());
    await periksaPdfPutusan(put);
    const r = await bubuhkanTtdPdf(put, [{ nama: NAMA.panitera, gambar: new Uint8Array(TTD_PANITERA.isi) }], { atur: ATUR, sesudahPenanda: true });
    expect(r.dipasang).toEqual([NAMA.panitera]);
    const bas = soffice(keluaranBotBas());
    await periksaPdfBas(bas);
    const rb = await bubuhkanTtdPdf(bas, [{ nama: NAMA.psBas, gambar: new Uint8Array(baca("ttd-ps.jpg")) }, { nama: NAMA.km, gambar: new Uint8Array(baca("ttd-km.png")) }], { atur: ATUR });
    expect(rb.dipasang).toHaveLength(2);
  }, 240_000);
});
