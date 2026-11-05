// @vitest-environment node
/**
 * ============================================================================
 * PDF SALINAN DARI PDF YANG MASIH KOSONG (5 Nov 2026)
 * ============================================================================
 *
 * Modul server salinan-dari-pdf.ts: tulisan SALINAN, "ttd", dan blok "Untuk Salinan" digambar LANGSUNG di atas halaman PDF; letaknya dari
 * lapisan teks. PDF uji = REKAAN buatan pdf-lib (tanpa data pihak nyata); hasilnya dibaca balik lapisan teksnya dengan pembaca yang sama.
 *
 *   - PDF kosong -> salinan dengan SALINAN di atas judul, "ttd" di bawah tiap label (terpusat pada labelnya, di antara label dan nama),
 *     blok pengesah berikut tanda tangan Panitera; isi halaman asli utuh; tanpa kata "Aleta" di metadata;
 *   - PDF yang sudah bertuliskan SALINAN ditolak (tidak ditumpuk); pindaian tanpa lapisan teks ditolak; label tak ditemukan, ruang
 *     tanda tangan tak cukup, dan Panitera pengesah tak dapat ditentukan = ditolak seluruhnya (tidak ada salinan separuh);
 *   - blok pengesah yang tak muat di halaman terakhir memakai halaman tambahan;
 *   - penjaga: rute memakai kapabilitas yang sama dengan rute PDF dan tidak menulis ke SIPP/ABT.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { PDFDocument, PDFName, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { bacaItemPdf, type ItemTeks } from "@/server/modules/aleta-ecourt/pdf-bubuh-ttd";
import { SalinanPdfDitolak, analisisSalinan, buatSalinanDariPdf, susunSegmen, type DepsSalinanPdf } from "@/server/modules/aleta-ecourt/salinan-dari-pdf";

const FIX = path.join(process.cwd(), "src/test/fixtures/ttd-salinan-3nov");
const TTD = new Uint8Array(readFileSync(path.join(FIX, "ttd-panitera.jpg")));
const CAP = new Uint8Array(readFileSync(path.join(FIX, "cap.png")));
const SUDAH_SALINAN = new Uint8Array(readFileSync(path.join(FIX, "putusan-01-salinan-lo74.pdf")));

const NAMA = { km: "Dr. Budi Rekaan, S.H.", ha1: "Siti Rekaan, S.H.I.", ha2: "Andi Rekaan, S.H.", pp: "Rahmat Rekaan, S.H.", panitera: "Hj. Wati Rekaan, S.H." };

type Pilihan = {
  /** y label baris terakhir (menggeser blok ke bawah halaman) */
  yBawah?: number;
  tanpaLabelHakim?: boolean;
  tanpaLabelPanitera?: boolean;
  rapatNama?: boolean;
  sudahSalinan?: boolean;
  pindaian?: boolean;
  judul?: string;
  metadata?: boolean;
};

/** Putusan rekaan dua halaman: kop + judul + isi di halaman 1; isi + blok tanda tangan di halaman 2. */
async function buatPdfRekaan(p: Pilihan = {}) {
  const dok = await PDFDocument.create();
  const f = await dok.embedFont(StandardFonts.TimesRoman);
  const tebal = await dok.embedFont(StandardFonts.TimesRomanBold);
  const h1 = dok.addPage([595, 842]);
  const h2 = dok.addPage([595, 842]);
  if (p.metadata) {
    dok.setTitle("Putusan Aleta rekaan");
    dok.setProducer("ALETA pembuat rekaan");
    dok.setAuthor("Rekaan");
  }
  if (p.pindaian) {
    h1.drawRectangle({ x: 50, y: 50, width: 400, height: 600, color: rgb(0.9, 0.9, 0.9) });
    return await dok.save();
  }
  const tengah = (pg: PDFPage, teks: string, pusat: number, y: number, font: PDFFont = f, ukuran = 12) =>
    pg.drawText(teks, { x: pusat - font.widthOfTextAtSize(teks, ukuran) / 2, y, size: ukuran, font });
  tengah(h1, "PENGADILAN AGAMA RUJUKAN", 297, 800, tebal, 13);
  if (p.sudahSalinan) h1.drawText("SALINAN", { x: 72, y: 775, size: 12, font: tebal });
  tengah(h1, p.judul ?? "PUTUSAN", 297, 740, tebal, 14);
  for (let i = 0; i < 12; i += 1) h1.drawText(`Menimbang, bahwa isi rekaan nomor ${i + 1} untuk menguji tata letak salinan;`, { x: 72, y: 700 - i * 18, size: 12, font: f });
  for (let i = 0; i < 6; i += 1) h2.drawText(`Mengadili, bahwa isi rekaan lanjutan nomor ${i + 1} pada halaman terakhir;`, { x: 72, y: 780 - i * 18, size: 12, font: f });
  const dasar = p.yBawah ?? 120;
  const a = 520 + dasar;
  if (!p.tanpaLabelHakim) tengah(h2, "Ketua Majelis,", 297, a);
  tengah(h2, NAMA.km, 297, a - (p.rapatNama ? 14 : 80));
  const b = 400 + dasar;
  if (!p.tanpaLabelHakim) {
    tengah(h2, "Hakim Anggota,", 150, b);
    tengah(h2, "Hakim Anggota,", 440, b);
  }
  tengah(h2, NAMA.ha1, 150, b - 80);
  tengah(h2, NAMA.ha2, 440, b - 80);
  const c = 280 + dasar;
  if (!p.tanpaLabelPanitera) tengah(h2, "Panitera Pengganti,", 297, c);
  tengah(h2, NAMA.pp, 297, c - 80);
  return await dok.save();
}

const ATUR = { lebarTtdMm: 64, ttdTurunMm: 3, tinggiTtdMaksMm: 35 };
function deps(sebagian: Partial<DepsSalinanPdf> = {}): DepsSalinanPdf {
  return {
    namaPengadilan: async () => "Pengadilan Agama Rujukan",
    daftarTtdSah: async () => [
      { id: 7, namaPejabat: NAMA.panitera, jabatan: "Panitera" },
      { id: 8, namaPejabat: NAMA.pp, jabatan: "Panitera Pengganti" },
    ],
    gambarTtd: async () => TTD,
    cap: async () => CAP,
    atur: ATUR,
    ...sebagian,
  };
}
async function ditolak(bita: Uint8Array, d: DepsSalinanPdf = deps()) {
  try {
    await buatSalinanDariPdf(bita, d);
  } catch (e) {
    expect(e).toBeInstanceOf(SalinanPdfDitolak);
    return e as SalinanPdfDitolak;
  }
  throw new Error("seharusnya ditolak");
}
const kunci = (i: ItemTeks) => `${i.halaman}|${i.str}|${Math.round(i.x * 10)}|${Math.round(i.y * 10)}`;

describe("PDF kosong menjadi PDF SALINAN: penanda di tempat yang benar", () => {
  it("SALINAN di kiri atas halaman 1 (di atas judul), 'ttd' terpusat di bawah tiap label, blok pengesah di akhir; isi asli utuh", async () => {
    const masuk = await buatPdfRekaan();
    const { pdf, keterangan } = await buatSalinanDariPdf(masuk, deps());
    const sebelum = await bacaItemPdf(masuk);
    const sesudah = await bacaItemPdf(pdf);
    // isi asli tidak berubah (setiap potongan lama masih di tempat yang sama); yang bertambah hanya tambahan
    const lama = new Set(sesudah.item.map(kunci));
    for (const i of sebelum.item) expect(lama.has(kunci(i)), `hilang: ${i.str}`).toBe(true);
    expect(sesudah.halaman).toHaveLength(2);
    const segLama = susunSegmen(sebelum.item);
    const baru = sesudah.item.filter((i) => !new Set(sebelum.item.map(kunci)).has(kunci(i)));

    // a. SALINAN: halaman 1, rata kiri dengan isi, di antara kop dan judul PUTUSAN
    const salinan = sesudah.item.find((i) => i.str.trim() === "SALINAN");
    expect(salinan).toBeTruthy();
    expect(salinan!.halaman).toBe(1);
    expect(salinan!.x).toBeCloseTo(72, 0);
    expect(salinan!.y).toBeGreaterThan(740 + 10);
    expect(salinan!.y).toBeLessThan(800 - 10);
    expect(keterangan.salinan).toBe("di_atas_judul");

    // b. ttd: satu per label, terpusat pada labelnya, di antara label dan nama
    const label = segLama.filter((s) => /^(Ketua Majelis|Hakim Anggota|Panitera Pengganti),$/.test(s.teks));
    expect(label).toHaveLength(4);
    const ttd = baru.filter((i) => i.str.trim() === "ttd");
    expect(ttd).toHaveLength(4);
    expect(keterangan.ttdDitambah).toBe(4);
    for (const l of label) {
      const t = ttd.find((x) => Math.abs(x.x + x.lebar / 2 - (l.xMin + l.xMax) / 2) < 3 && x.y < l.y && x.halaman === l.halaman);
      expect(t, `ttd untuk ${l.teks}`).toBeTruthy();
      const nama = segLama.filter((s) => s.halaman === l.halaman && s.y < l.y - 20 && s.xMin < l.xMax && s.xMax > l.xMin).sort((a, b) => b.y - a.y)[0];
      expect(t!.y).toBeGreaterThan(nama.y + 12);
      expect(t!.y).toBeLessThan(l.y);
    }

    // c. blok pengesah di halaman terakhir: urut dari atas, nama Panitera pengesah, tanda tangan tertempel
    const blok = ["Untuk Salinan", "Pengadilan Agama Rujukan", "Panitera,", NAMA.panitera].map((t) => baru.find((i) => i.str.trim() === t));
    blok.forEach((b, n) => expect(b, `baris blok ${n}`).toBeTruthy());
    const ys = blok.map((b) => b!.y);
    expect([...ys].sort((a, b) => b - a)).toEqual(ys);
    expect(blok.every((b) => b!.halaman === 2)).toBe(true);
    expect(keterangan).toMatchObject({ jenis: "putusan-pdf", namaPanitera: NAMA.panitera, gambarTtdPanitera: true, capPanitera: true, alasanTanpaGambar: "", blokHalamanBaru: false });
    const dok = await PDFDocument.load(pdf);
    const xobj = dok.getPages()[1].node.Resources()?.lookup(PDFName.of("XObject"));
    expect(xobj && (xobj as unknown as { keys(): unknown[] }).keys().length).toBeGreaterThanOrEqual(2); // tanda tangan + cap
    // tanda tangan berada di atas nama dan di bawah label "Panitera,"
    const gambarSalah = ys[2] - ys[3];
    expect(gambarSalah).toBeGreaterThan(40);
  });

  it("tanpa kata 'Aleta' di metadata hasil (yang ada di berkas masukan dikosongkan), isi halaman tetap", async () => {
    const masuk = await buatPdfRekaan({ metadata: true });
    const { pdf } = await buatSalinanDariPdf(masuk, deps());
    const dok = await PDFDocument.load(pdf, { updateMetadata: false });
    for (const v of [dok.getTitle(), dok.getAuthor(), dok.getSubject(), dok.getCreator(), dok.getProducer(), dok.getKeywords()]) expect(String(v ?? "")).not.toMatch(/aleta/i);
    expect(Buffer.from(pdf).toString("latin1")).not.toMatch(/aleta/i);
    expect(dok.getAuthor()).toBe("Rekaan"); // yang bukan 'Aleta' dibiarkan
  });

  it("blok pengesah tak muat di halaman terakhir -> halaman tambahan berukuran sama; halaman asli utuh", async () => {
    const masuk = await buatPdfRekaan({ yBawah: -120 });
    const { pdf, keterangan } = await buatSalinanDariPdf(masuk, deps());
    const sesudah = await bacaItemPdf(pdf);
    expect(sesudah.halaman).toHaveLength(3);
    expect(sesudah.halaman[2]).toEqual(sesudah.halaman[1]);
    expect(keterangan.blokHalamanBaru).toBe(true);
    expect(sesudah.item.filter((i) => i.halaman === 3).map((i) => i.str.trim())).toEqual(expect.arrayContaining(["Untuk Salinan", "Pengadilan Agama Rujukan", "Panitera,", NAMA.panitera]));
    expect(keterangan.gambarTtdPanitera).toBe(true);
  });

  it("judul tak ditemukan -> SALINAN di pojok kiri atas bila kosong", async () => {
    const masuk = await buatPdfRekaan({ judul: "Perihal Rekaan" });
    const { keterangan, pdf } = await buatSalinanDariPdf(masuk, deps());
    expect(keterangan.salinan).toBe("pojok_kiri_atas");
    const s = (await bacaItemPdf(pdf)).item.find((i) => i.str.trim() === "SALINAN");
    expect(s!.y).toBeGreaterThan(842 - 45);
  });

  it("tanda tangan Panitera tak terbaca -> blok tetap ada, dilaporkan tanpa gambar (bukan diam-diam)", async () => {
    const { keterangan } = await buatSalinanDariPdf(await buatPdfRekaan(), deps({ gambarTtd: async () => null }));
    expect(keterangan.gambarTtdPanitera).toBe(false);
    expect(keterangan.alasanTanpaGambar).toBe("ttd_tidak_ada");
  });
});

describe("yang tidak dapat dikerjakan ditolak seluruhnya dengan pesan Indonesia yang jelas", () => {
  it("PDF berita acara sidang keluaran LibreOffice ditolak: salinannya memakai tanda tangan asli, bukan ttd", async () => {
    const bas = new Uint8Array(readFileSync(path.join(process.cwd(), "src/test/fixtures/nomor-halaman-3nov/bas-04-3-r1-lo74.pdf")));
    const e = await ditolak(bas);
    expect(e.message).toMatch(/berita acara sidang/);
  });

  it("PDF yang sudah bertuliskan SALINAN (rekaan dan keluaran LibreOffice) tidak ditumpuk", async () => {
    const a = await ditolak(await buatPdfRekaan({ sudahSalinan: true }));
    expect(a.kode).toBe("sudah_salinan");
    expect(a.message).toMatch(/sudah bertuliskan SALINAN/);
    const b = await ditolak(SUDAH_SALINAN);
    expect(b.kode).toBe("sudah_salinan");
  });

  it("hasil pindaian tanpa lapisan teks ditolak, tidak menebak letak", async () => {
    const e = await ditolak(await buatPdfRekaan({ pindaian: true }));
    expect(e.kode).toBe("tanpa_teks");
    expect(e.message).toMatch(/tidak memiliki lapisan teks/);
    expect(e.message).not.toMatch(/aleta/i);
  });

  it("label Hakim atau Panitera tak ditemukan -> ditolak", async () => {
    expect((await ditolak(await buatPdfRekaan({ tanpaLabelHakim: true }))).kode).toBe("label_tidak_ada");
    expect((await ditolak(await buatPdfRekaan({ tanpaLabelPanitera: true }))).kode).toBe("label_tidak_ada");
  });

  it("tak ada ruang antara label dan nama untuk 'ttd' -> ditolak (isi halaman tidak digeser)", async () => {
    const e = await ditolak(await buatPdfRekaan({ rapatNama: true }));
    expect(e.kode).toBe("ruang_ttd_kurang");
    expect(e.message).toMatch(/Ketua Majelis/);
  });

  it("Panitera pengesah tidak ada / lebih dari satu / nama pengadilan kosong -> ditolak, bukan ditebak", async () => {
    const masuk = await buatPdfRekaan();
    expect((await ditolak(masuk, deps({ daftarTtdSah: async () => [{ id: 8, namaPejabat: NAMA.pp, jabatan: "Panitera Pengganti" }] }))).kode).toBe("pengesah_tidak_ada");
    expect(
      (
        await ditolak(
          masuk,
          deps({
            daftarTtdSah: async () => [
              { id: 7, namaPejabat: NAMA.panitera, jabatan: "Panitera" },
              { id: 9, namaPejabat: "Lain Rekaan", jabatan: "panitera" },
            ],
          })
        )
      ).kode
    ).toBe("pengesah_ganda");
    expect((await ditolak(masuk, deps({ namaPengadilan: async () => "  " }))).kode).toBe("nama_pengadilan_kosong");
  });

  it("bukan PDF atau PDF rusak ditolak", async () => {
    expect((await ditolak(new Uint8Array(Buffer.from("{\\rtf1 bukan pdf}")))).kode).toBe("bukan_pdf");
    expect((await ditolak(new Uint8Array(Buffer.from("%PDF-1.4\nrusak sama sekali")))).kode).toBe("pdf_tidak_terbaca");
  });

  it("analisis murni: tanpa teks cukup = tanpa_teks", () => {
    expect(() => analisisSalinan([{ lebar: 595, tinggi: 842 }], [])).toThrowError(/lapisan teks/);
  });
});

describe("rute dan penjaga", () => {
  const rute = readFileSync(path.join(process.cwd(), "src/app/api/aleta-ecourt/putusan/salinan-dari-pdf/route.ts"), "utf8");
  it("memakai penjagaan hak yang SAMA dengan rute PDF (kapabilitas blangko-abt) dan tidak menulis ke SIPP/ABT", () => {
    expect(rute).toContain('pastikanKapabilitas(db, actorUserId, "blangko-abt")');
    expect(readFileSync(path.join(process.cwd(), "src/app/api/aleta-bot/abt/pdf/route.ts"), "utf8")).toContain('pastikanKapabilitas(db, actorUserId, "blangko-abt")');
    expect(rute).not.toMatch(/callAletaBotSippBridge|unggah|\.run\(|INSERT|UPDATE/i);
  });
  it("tidak ada kata Aleta pada tulisan yang digambar ke PDF", () => {
    const modul = readFileSync(path.join(process.cwd(), "src/server/modules/aleta-ecourt/salinan-dari-pdf.ts"), "utf8");
    const gambar = [...modul.matchAll(/drawText\(\s*(["'`][^"'`]*["'`])/g)].map((m) => m[1]);
    for (const g of gambar) expect(g).not.toMatch(/aleta/i);
    expect(modul).toContain('const teks = ["Untuk Salinan", p.namaPengadilan, "Panitera,"]');
  });
});
