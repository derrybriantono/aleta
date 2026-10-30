import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/**
 * ============================================================================
 * BUNDEL SATU PDF PER PERKARA (5.1, 30 Okt 2026) - MURNI
 * ============================================================================
 *
 * Menggabung sampul, daftar isi, lalu dokumen-dokumen perkara menurut urutan daftar isi menjadi SATU PDF. Setiap halaman dokumen
 * diberi nomor kecil di pojok kanan bawah sesuai rentang di daftar isi (halaman pertama dokumen = "awal" barisnya), sehingga nomor di
 * daftar isi dan nomor di halaman yang sama. Sampul dan daftar isi tidak bernomor.
 *
 * Tanpa jaringan, tanpa basis data, tidak menyimpan apa pun. Isi dokumen memuat nama dan alamat para pihak: hanya hidup di memori.
 *
 *   - dokumen tanpa satu pun PDF (belum diunggah, atau berbentuk RTF/DOC) diganti halaman penanda sebanyak yang disebut daftar isi,
 *     bernomor, supaya nomor halaman sesudahnya tetap benar dan petugas melihat apa yang belum ada;
 *   - dokumen yang jumlah halaman aslinya berbeda dari daftar isi tetap bernomor dari "awal" dan dilaporkan sebagai peringatan
 *     (daftar isi tidak diubah di sini);
 *   - satu berkas PDF rusak tidak menggagalkan bundel: dilaporkan, dan baris itu diperlakukan seperti tanpa PDF.
 */

export type BarisBundel = {
  kunci: string;
  nama: string;
  /** Nomor halaman pertama dan terakhir menurut daftar isi. */
  awal: number;
  akhir: number;
  /** PDF yang ada untuk baris ini (urut); kosong = dokumen tidak ada dalam bentuk PDF. */
  berkas: Uint8Array[];
  /** Jumlah berkas yang ada tetapi bukan PDF (hanya untuk keterangan penanda). */
  bukanPdf?: number;
};

export type HasilBundel = {
  pdf: Uint8Array;
  /** Jumlah halaman seluruh bundel (termasuk sampul dan daftar isi). */
  halaman: number;
  halamanSampul: number;
  halamanDaftarIsi: number;
  peringatan: string[];
  /** Ringkasan per baris untuk ditampilkan kepada petugas. */
  baris: Array<{ kunci: string; nama: string; awal: number; akhir: number; halamanAsli: number; penanda: boolean }>;
};

const A4: [number, number] = [595.28, 841.89];

/** Teks aman untuk huruf standar PDF (WinAnsi): karakter di luar itu diganti. */
export function teksAman(x: unknown): string {
  return String(x ?? "")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .replace(/[^\x20-\x7E -ÿ]/g, "?")
    .trim();
}

/** Titik pada tampilan halaman (pojok kiri bawah tampilan = 0,0) -> titik di ruang pengguna halaman, beserta putaran teks. Menghormati /Rotate. */
export function titikTampilan(lebar: number, tinggi: number, putaran: number, dx: number, dy: number): { x: number; y: number; derajat: number } {
  const sudut = ((Math.round(putaran / 90) * 90) % 360 + 360) % 360;
  if (sudut === 90) return { x: lebar - dy, y: dx, derajat: 90 };
  if (sudut === 180) return { x: lebar - dx, y: tinggi - dy, derajat: 180 };
  if (sudut === 270) return { x: dy, y: tinggi - dx, derajat: 270 };
  return { x: dx, y: dy, derajat: 0 };
}

function ukuranTampilan(halaman: PDFPage): { lebar: number; tinggi: number; putaran: number } {
  const { width, height } = halaman.getSize();
  const putaran = halaman.getRotation().angle;
  const tegak = Math.round(putaran / 90) % 2 === 1;
  return { lebar: tegak ? height : width, tinggi: tegak ? width : height, putaran };
}

function bubuhiNomor(halaman: PDFPage, font: PDFFont, nomor: number): void {
  const teks = `Hlm. ${nomor}`;
  const ukuran = 9;
  const { lebar, putaran } = ukuranTampilan(halaman);
  const lebarTeks = font.widthOfTextAtSize(teks, ukuran);
  const dx = lebar - 28 - lebarTeks;
  const dy = 16;
  const { width, height } = halaman.getSize();
  const t = titikTampilan(width, height, putaran, dx, dy);
  const k = titikTampilan(width, height, putaran, dx - 3, dy - 2.5);
  halaman.drawRectangle({ x: k.x, y: k.y, width: lebarTeks + 6, height: ukuran + 5, color: rgb(1, 1, 1), opacity: 0.9, rotate: degrees(k.derajat) });
  halaman.drawText(teks, { x: t.x, y: t.y, size: ukuran, font, color: rgb(0, 0, 0), rotate: degrees(t.derajat) });
}

function bungkus(teks: string, font: PDFFont, ukuran: number, lebarMaks: number): string[] {
  const kata = teks.split(" ");
  const baris: string[] = [];
  let kini = "";
  for (const k of kata) {
    const coba = kini ? `${kini} ${k}` : k;
    if (font.widthOfTextAtSize(coba, ukuran) > lebarMaks && kini) {
      baris.push(kini);
      kini = k;
    } else kini = coba;
  }
  if (kini) baris.push(kini);
  return baris;
}

function halamanPenanda(dokumen: PDFDocument, font: PDFFont, tebal: PDFFont, nama: string, ke: number, dari: number, bukanPdf: number): PDFPage {
  const h = dokumen.addPage(A4);
  const [w, tinggi] = A4;
  h.drawRectangle({ x: 40, y: 40, width: w - 80, height: tinggi - 80, borderColor: rgb(0.6, 0.6, 0.6), borderWidth: 1, borderDashArray: [6, 4] });
  const judul = ke === 1 ? "DOKUMEN BELUM ADA DALAM BENTUK PDF" : "DOKUMEN BELUM ADA DALAM BENTUK PDF (lanjutan)";
  h.drawText(judul, { x: 60, y: tinggi - 110, size: 13, font: tebal, color: rgb(0.45, 0.1, 0.1) });
  const garis = bungkus(teksAman(nama) || "(tanpa nama)", tebal, 12, w - 120);
  let y = tinggi - 140;
  for (const g of garis) {
    h.drawText(g, { x: 60, y, size: 12, font: tebal, color: rgb(0, 0, 0) });
    y -= 17;
  }
  const alasan = bukanPdf > 0 ? `Di arsip hanya ada ${bukanPdf} berkas bukan PDF (RTF, DOC, atau DOCX).` : "Belum ada berkasnya di arsip perkara.";
  const catatan = `${alasan} Daftar isi menyediakan ${dari} halaman untuk dokumen ini; halaman ini menjaga nomor halaman sesudahnya tetap sama dengan daftar isi. Ganti halaman ini dengan dokumennya.`;
  y -= 10;
  for (const g of bungkus(catatan, font, 11, w - 120)) {
    h.drawText(g, { x: 60, y, size: 11, font, color: rgb(0.2, 0.2, 0.2) });
    y -= 15;
  }
  return h;
}

async function salinHalaman(tujuan: PDFDocument, sumber: Uint8Array): Promise<PDFPage[]> {
  const doc = await PDFDocument.load(sumber, { ignoreEncryption: true, updateMetadata: false });
  const salinan = await tujuan.copyPages(doc, doc.getPageIndices());
  return salinan.map((h) => tujuan.addPage(h));
}

export async function susunBundel(opsi: { sampul?: Uint8Array | null; daftarIsi?: Uint8Array | null; baris: BarisBundel[]; judul?: string }): Promise<HasilBundel> {
  const keluar = await PDFDocument.create({ updateMetadata: false });
  const font = await keluar.embedFont(StandardFonts.Helvetica);
  const tebal = await keluar.embedFont(StandardFonts.HelveticaBold);
  const peringatan: string[] = [];
  let halamanSampul = 0;
  let halamanDaftarIsi = 0;
  if (opsi.sampul && opsi.sampul.length) {
    try {
      halamanSampul = (await salinHalaman(keluar, opsi.sampul)).length;
    } catch {
      peringatan.push("Sampul tidak dapat dibaca sebagai PDF; bundel dibuat tanpa sampul.");
    }
  }
  if (opsi.daftarIsi && opsi.daftarIsi.length) {
    try {
      halamanDaftarIsi = (await salinHalaman(keluar, opsi.daftarIsi)).length;
    } catch {
      peringatan.push("Daftar isi tidak dapat dibaca sebagai PDF; bundel dibuat tanpa daftar isi.");
    }
  }
  const ringkas: HasilBundel["baris"] = [];
  for (const b of opsi.baris) {
    const diminta = Math.max(1, b.akhir - b.awal + 1);
    const halaman: PDFPage[] = [];
    let rusak = 0;
    for (const berkas of b.berkas) {
      try {
        halaman.push(...(await salinHalaman(keluar, berkas)));
      } catch {
        rusak += 1;
      }
    }
    if (rusak) peringatan.push(`${b.nama}: ${rusak} berkas PDF rusak dan dilewati.`);
    let penanda = false;
    if (!halaman.length) {
      penanda = true;
      for (let i = 1; i <= diminta; i += 1) halaman.push(halamanPenanda(keluar, font, tebal, b.nama, i, diminta, b.bukanPdf ?? 0));
      peringatan.push(`${b.nama}: belum ada PDF-nya (${b.bukanPdf ? "berkas yang ada bukan PDF" : "tidak ada berkas"}); diganti ${diminta} halaman penanda.`);
    } else if (halaman.length !== diminta) {
      peringatan.push(`${b.nama}: daftar isi menyebut ${diminta} halaman, berkasnya ${halaman.length} halaman. Nomor halaman dimulai dari ${b.awal}; periksa daftar isi.`);
    }
    halaman.forEach((h, i) => bubuhiNomor(h, font, b.awal + i));
    ringkas.push({ kunci: b.kunci, nama: b.nama, awal: b.awal, akhir: b.akhir, halamanAsli: penanda ? 0 : halaman.length, penanda });
  }
  if (opsi.judul) keluar.setTitle(teksAman(opsi.judul));
  keluar.setProducer("");
  keluar.setCreator("");
  const pdf = await keluar.save();
  return { pdf, halaman: keluar.getPageCount(), halamanSampul, halamanDaftarIsi, peringatan, baris: ringkas };
}
