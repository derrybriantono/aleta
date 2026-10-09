import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import { rupiahPenuh, tanggalPanjang, type RekapKasir } from "@/lib/kasir-otomatis";

/**
 * ============================================================================
 * REKAP PENGELUARAN KASIR SEBAGAI PDF (1.189.x butir 5)
 * ============================================================================
 *
 * "Rekap sebagai PDF yang mudah dipahami": satu halaman ringkasan di atas
 * (total keluar, total masuk, PNBP & setorannya, sisa panjar dikembalikan),
 * lalu tabel per jenis biaya bertotal dan berpersen, per hari bila
 * periodenya lebih dari sehari, dan per perkara. Kepala tabel diulang di tiap
 * halaman; nomor halaman di kaki.
 *
 * Huruf baku PDF (WinAnsi): huruf di luar latin1 diganti padanannya atau "?"
 * - nomor perkara dan nama jenis biaya SIPP memang latin1.
 */

const A4: [number, number] = [595.28, 841.89];
const TEPI = 40;
const HITAM = rgb(0.1, 0.1, 0.12);
const ABU = rgb(0.42, 0.45, 0.5);
const GARIS = rgb(0.82, 0.84, 0.87);
const LATAR_KEPALA = rgb(0.93, 0.95, 0.97);
const AKSEN = rgb(0.05, 0.4, 0.55);

function latin1(teks: string): string {
  return String(teks ?? "")
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/·/g, "-")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

type Kolom = { judul: string; lebar: number; kanan?: boolean };

class Penulis {
  doc: PDFDocument;
  huruf: PDFFont;
  tebal: PDFFont;
  halaman!: PDFPage;
  y = 0;
  kaki: string;

  constructor(doc: PDFDocument, huruf: PDFFont, tebal: PDFFont, kaki: string) {
    this.doc = doc;
    this.huruf = huruf;
    this.tebal = tebal;
    this.kaki = kaki;
    this.halamanBaru();
  }

  halamanBaru() {
    this.halaman = this.doc.addPage(A4);
    this.y = A4[1] - TEPI;
  }

  pastikan(tinggi: number): boolean {
    if (this.y - tinggi < TEPI + 24) {
      this.halamanBaru();
      return true;
    }
    return false;
  }

  potong(teks: string, lebar: number, ukuran: number, tebal = false): string {
    const f = tebal ? this.tebal : this.huruf;
    let t = latin1(teks);
    if (f.widthOfTextAtSize(t, ukuran) <= lebar) return t;
    while (t.length > 1 && f.widthOfTextAtSize(`${t}...`, ukuran) > lebar) t = t.slice(0, -1);
    return `${t}...`;
  }

  teks(teks: string, opsi: { x?: number; ukuran?: number; tebal?: boolean; warna?: ReturnType<typeof rgb>; spasi?: number } = {}) {
    const ukuran = opsi.ukuran ?? 10;
    this.pastikan(ukuran + 4);
    this.halaman.drawText(latin1(teks), {
      x: opsi.x ?? TEPI,
      y: this.y - ukuran,
      size: ukuran,
      font: opsi.tebal ? this.tebal : this.huruf,
      color: opsi.warna ?? HITAM,
    });
    this.y -= ukuran + (opsi.spasi ?? 4);
  }

  jarak(n: number) {
    this.y -= n;
  }

  judulBagian(teks: string) {
    this.pastikan(40);
    this.jarak(6);
    this.teks(teks, { ukuran: 12, tebal: true, warna: AKSEN, spasi: 6 });
  }

  tabel(kolom: Kolom[], baris: string[][], opsi: { total?: string[] } = {}) {
    const ukuran = 8.5;
    const tinggi = 15;
    const lebarTotal = kolom.reduce((s, k) => s + k.lebar, 0);
    const kepala = () => {
      this.halaman.drawRectangle({ x: TEPI, y: this.y - tinggi, width: lebarTotal, height: tinggi, color: LATAR_KEPALA });
      let x = TEPI;
      for (const k of kolom) {
        const isi = this.potong(k.judul, k.lebar - 6, ukuran, true);
        const w = this.tebal.widthOfTextAtSize(isi, ukuran);
        this.halaman.drawText(isi, { x: k.kanan ? x + k.lebar - 3 - w : x + 3, y: this.y - tinggi + 4.5, size: ukuran, font: this.tebal, color: HITAM });
        x += k.lebar;
      }
      this.y -= tinggi;
    };
    const satuBaris = (isi: string[], tebal: boolean) => {
      if (this.pastikan(tinggi)) kepala();
      let x = TEPI;
      kolom.forEach((k, i) => {
        const t = this.potong(isi[i] ?? "", k.lebar - 6, ukuran, tebal);
        const f = tebal ? this.tebal : this.huruf;
        const w = f.widthOfTextAtSize(t, ukuran);
        this.halaman.drawText(t, { x: k.kanan ? x + k.lebar - 3 - w : x + 3, y: this.y - tinggi + 4.5, size: ukuran, font: f, color: HITAM });
        x += k.lebar;
      });
      this.halaman.drawLine({ start: { x: TEPI, y: this.y - tinggi }, end: { x: TEPI + lebarTotal, y: this.y - tinggi }, thickness: 0.5, color: GARIS });
      this.y -= tinggi;
    };
    this.pastikan(tinggi * 3);
    kepala();
    for (const b of baris) satuBaris(b, false);
    if (opsi.total) satuBaris(opsi.total, true);
    this.jarak(6);
  }

  akhiri() {
    const semua = this.doc.getPages();
    semua.forEach((h, i) => {
      const kanan = `Halaman ${i + 1} dari ${semua.length}`;
      h.drawText(latin1(this.kaki), { x: TEPI, y: 22, size: 7.5, font: this.huruf, color: ABU });
      h.drawText(kanan, { x: A4[0] - TEPI - this.huruf.widthOfTextAtSize(kanan, 7.5), y: 22, size: 7.5, font: this.huruf, color: ABU });
    });
  }
}

export type OpsiPdfRekap = { dibuat: Date; olehNama?: string; satker?: string };

export async function buatPdfRekapKasir(r: RekapKasir, opsi: OpsiPdfRekap): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(latin1(`Rekap Pengeluaran Kasir - ${r.label}`));
  doc.setSubject("Rekap Buku Jurnal Keuangan Perkara");
  const huruf = await doc.embedFont(StandardFonts.Helvetica);
  const tebal = await doc.embedFont(StandardFonts.HelveticaBold);
  const jam = opsi.dibuat;
  const duaDigit = (n: number) => String(n).padStart(2, "0");
  const dibuat = `${tanggalPanjang(`${jam.getFullYear()}-${duaDigit(jam.getMonth() + 1)}-${duaDigit(jam.getDate())}`)} ${duaDigit(jam.getHours())}.${duaDigit(jam.getMinutes())}`;
  const p = new Penulis(doc, huruf, tebal, `Disusun dari Buku Jurnal Keuangan Perkara SIPP - dicetak ${dibuat}${opsi.olehNama ? ` oleh ${opsi.olehNama}` : ""}`);

  // ─── Kepala ────────────────────────────────────────────────────────────────
  p.teks("REKAP PENGELUARAN KASIR", { ukuran: 16, tebal: true, spasi: 6 });
  if (opsi.satker) p.teks(opsi.satker, { ukuran: 10, warna: ABU });
  p.teks(`${r.label}  (${tanggalPanjang(r.dari)}${r.dari !== r.sampai ? ` s.d. ${tanggalPanjang(r.sampai)}` : ""})`, { ukuran: 11, spasi: 10 });

  // ─── Ringkasan ─────────────────────────────────────────────────────────────
  p.judulBagian("Ringkasan");
  const ringkas: Array<[string, string]> = [
    ["Total pengeluaran", rupiahPenuh(r.totalKeluar)],
    ["Jumlah transaksi keluar", `${r.jumlahBarisKeluar.toLocaleString("id-ID")} baris`],
    ["Perkara yang bertransaksi", `${r.perPerkara.length.toLocaleString("id-ID")} perkara${r.perkaraTerpotong ? " (terpotong 3.000)" : ""}`],
    ["Total pemasukan (panjar)", rupiahPenuh(r.totalMasuk)],
    ["PNBP", rupiahPenuh(r.totalPnbp)],
    ["PNBP tercatat disetor", `${rupiahPenuh(r.pnbpDisetor)}${r.totalPnbp > r.pnbpDisetor ? `  (belum tercatat ${rupiahPenuh(r.totalPnbp - r.pnbpDisetor)})` : ""}`],
    ["Sisa panjar dikembalikan", rupiahPenuh(r.sisaDikembalikan)],
  ];
  for (const [kiri, kanan] of ringkas) {
    p.pastikan(16);
    p.halaman.drawText(latin1(kiri), { x: TEPI, y: p.y - 10, size: 10, font: huruf, color: ABU });
    p.halaman.drawText(latin1(kanan), { x: TEPI + 190, y: p.y - 10, size: 10, font: tebal, color: HITAM });
    p.jarak(15);
  }

  // ─── Per jenis biaya ───────────────────────────────────────────────────────
  p.judulBagian("Pengeluaran per jenis biaya");
  if (!r.pengeluaran.length) {
    p.teks("Tidak ada pengeluaran pada periode ini.", { warna: ABU });
  } else {
    p.tabel(
      [
        { judul: "No", lebar: 24, kanan: true },
        { judul: "Jenis biaya", lebar: 245 },
        { judul: "Transaksi", lebar: 55, kanan: true },
        { judul: "Perkara", lebar: 50, kanan: true },
        { judul: "Jumlah", lebar: 90, kanan: true },
        { judul: "%", lebar: 51, kanan: true },
      ],
      r.pengeluaran.map((j, i) => [String(i + 1), j.nama, j.baris.toLocaleString("id-ID"), j.perkara.toLocaleString("id-ID"), rupiahPenuh(j.jumlah), `${j.persen.toLocaleString("id-ID")}%`]),
      { total: ["", "TOTAL PENGELUARAN", r.jumlahBarisKeluar.toLocaleString("id-ID"), "", rupiahPenuh(r.totalKeluar), "100%"] }
    );
  }
  if (r.pemasukan.length) {
    p.judulBagian("Pemasukan");
    p.tabel(
      [
        { judul: "No", lebar: 24, kanan: true },
        { judul: "Jenis", lebar: 300 },
        { judul: "Transaksi", lebar: 70, kanan: true },
        { judul: "Jumlah", lebar: 121, kanan: true },
      ],
      r.pemasukan.map((j, i) => [String(i + 1), j.nama, j.baris.toLocaleString("id-ID"), rupiahPenuh(j.jumlah)]),
      { total: ["", "TOTAL PEMASUKAN", "", rupiahPenuh(r.totalMasuk)] }
    );
  }

  // ─── Per hari ──────────────────────────────────────────────────────────────
  if (r.dari !== r.sampai && r.perHari.length) {
    p.judulBagian("Per hari");
    p.tabel(
      [
        { judul: "Tanggal", lebar: 145 },
        { judul: "Pemasukan", lebar: 110, kanan: true },
        { judul: "Pengeluaran", lebar: 110, kanan: true },
        { judul: "di antaranya PNBP", lebar: 100, kanan: true },
        { judul: "Baris", lebar: 50, kanan: true },
      ],
      r.perHari.map((h) => [tanggalPanjang(h.tanggal), rupiahPenuh(h.masuk), rupiahPenuh(h.keluar), rupiahPenuh(h.pnbp), String(h.baris)]),
      { total: ["JUMLAH", rupiahPenuh(r.totalMasuk), rupiahPenuh(r.totalKeluar), rupiahPenuh(r.totalPnbp), ""] }
    );
  }

  // ─── Per perkara ───────────────────────────────────────────────────────────
  p.judulBagian("Per perkara");
  if (!r.perPerkara.length) {
    p.teks("Tidak ada perkara yang bertransaksi pada periode ini.", { warna: ABU });
  } else {
    p.tabel(
      [
        { judul: "No", lebar: 28, kanan: true },
        { judul: "Nomor perkara", lebar: 140 },
        { judul: "Jenis perkara", lebar: 110 },
        { judul: "Pemasukan", lebar: 80, kanan: true },
        { judul: "Pengeluaran", lebar: 80, kanan: true },
        { judul: "Sisa dikembalikan", lebar: 77, kanan: true },
      ],
      r.perPerkara.map((x, i) => [String(i + 1), x.nomorPerkara, x.jenisPerkara, rupiahPenuh(x.masuk), rupiahPenuh(x.keluar), x.sisaDikembalikan ? rupiahPenuh(x.sisaDikembalikan) : "-"]),
      {
        total: [
          "",
          "JUMLAH",
          "",
          rupiahPenuh(r.perPerkara.reduce((s, x) => s + x.masuk, 0)),
          rupiahPenuh(r.perPerkara.reduce((s, x) => s + x.keluar, 0)),
          rupiahPenuh(r.sisaDikembalikan),
        ],
      }
    );
  }

  p.akhiri();
  return doc.save();
}
