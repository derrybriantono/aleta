import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import { penerimaPsp, teksRekeningPsp, type DaftarPsp, type KelompokInstrumen } from "@/lib/kasir-cetak";
import { rupiahTitik, tanggalIndonesia } from "@/lib/pembayaran-ecourt";
import { patahBaris, type KertasSkum } from "@/server/modules/aleta-ecourt/skum-ecourt-pdf";

/**
 * ============================================================================
 * PDF KASIR: DAFTAR PSP DAN INSTRUMEN PANGGILAN & PBT PER JURUSITA (3 Nov 2026)
 * ============================================================================
 *
 * Tabel berkolom tetap yang lebarnya dihitung dari kertas (A4/F4 tegak); isi sel dipatah ke baris
 * berikutnya, tidak pernah melewati margin. Nominal rata kanan berformat Rupiah bertitik. Halaman baru
 * mengulang kepala tabel. Ruang tanda tangan di akhir.
 */

const UKURAN: Record<KertasSkum, [number, number]> = { A4: [595.28, 841.89], F4: [609.45, 935.43] };
const HITAM = rgb(0, 0, 0);
const KELABU = rgb(0.4, 0.4, 0.4);
const GARIS = rgb(0.7, 0.7, 0.7);
const LATAR_KEPALA = rgb(0.93, 0.93, 0.93);

type Kolom = { judul: string; lebar: number; kanan?: boolean };

type Kanvas = {
  dok: PDFDocument;
  hal: PDFPage;
  y: number;
  biasa: PDFFont;
  tebal: PDFFont;
  kiri: number;
  kanan: number;
  lebarKertas: number;
  tinggiKertas: number;
};

async function kanvasBaru(kertas: KertasSkum, judul: string): Promise<Kanvas> {
  const [lebarKertas, tinggiKertas] = UKURAN[kertas];
  const dok = await PDFDocument.create();
  dok.setTitle(judul);
  const biasa = await dok.embedFont(StandardFonts.Helvetica);
  const tebal = await dok.embedFont(StandardFonts.HelveticaBold);
  const hal = dok.addPage([lebarKertas, tinggiKertas]);
  return { dok, hal, y: tinggiKertas - 48, biasa, tebal, kiri: 40, kanan: lebarKertas - 40, lebarKertas, tinggiKertas };
}

function teks(k: Kanvas, isi: string, x: number, ukuran: number, huruf: PDFFont, warna = HITAM) {
  const aman = patahBaris(huruf, isi, ukuran, 10_000)[0] ?? "";
  k.hal.drawText(aman, { x, y: k.y, size: ukuran, font: huruf, color: warna });
}

function judul(k: Kanvas, baris: string[], keterangan: string[]) {
  for (const [i, b] of baris.entries()) {
    const uk = i === 0 ? 13 : 11;
    const h = k.tebal;
    for (const p of patahBaris(h, b, uk, k.kanan - k.kiri)) {
      const w = h.widthOfTextAtSize(p, uk);
      k.hal.drawText(p, { x: k.kiri + (k.kanan - k.kiri - w) / 2, y: k.y, size: uk, font: h, color: HITAM });
      k.y -= uk + 5;
    }
  }
  k.y -= 2;
  for (const t of keterangan) {
    teks(k, t, k.kiri, 9, k.biasa, KELABU);
    k.y -= 13;
  }
  k.y -= 4;
}

function kepalaTabel(k: Kanvas, kolom: Kolom[]) {
  const tinggi = 18;
  k.hal.drawRectangle({ x: k.kiri, y: k.y - 5, width: k.kanan - k.kiri, height: tinggi, color: LATAR_KEPALA });
  let x = k.kiri;
  for (const c of kolom) {
    const w = k.tebal.widthOfTextAtSize(c.judul, 8.5);
    k.hal.drawText(c.judul, { x: c.kanan ? x + c.lebar - 4 - w : x + 4, y: k.y, size: 8.5, font: k.tebal, color: HITAM });
    x += c.lebar;
  }
  k.y -= tinggi + 2;
}

/** Satu baris tabel; sel dipatah, tinggi baris = sel tertinggi. Halaman baru bila tidak muat. */
function barisTabel(k: Kanvas, kolom: Kolom[], sel: string[], opsi: { tebal?: boolean } = {}) {
  const UK = 8.5;
  const huruf = opsi.tebal ? k.tebal : k.biasa;
  const isi = sel.map((s, i) => patahBaris(huruf, s || "", UK, kolom[i].lebar - 8));
  const tinggi = Math.max(...isi.map((x) => x.length)) * (UK + 2.5) + 5;
  if (k.y - tinggi < 60) {
    k.hal = k.dok.addPage([k.lebarKertas, k.tinggiKertas]);
    k.y = k.tinggiKertas - 48;
    kepalaTabel(k, kolom);
  }
  let x = k.kiri;
  for (const [i, c] of kolom.entries()) {
    let yy = k.y;
    for (const b of isi[i]) {
      const w = huruf.widthOfTextAtSize(b, UK);
      k.hal.drawText(b, { x: c.kanan ? x + c.lebar - 4 - w : x + 4, y: yy, size: UK, font: huruf, color: HITAM });
      yy -= UK + 2.5;
    }
    x += c.lebar;
  }
  k.y -= tinggi;
  k.hal.drawLine({ start: { x: k.kiri, y: k.y + UK }, end: { x: k.kanan, y: k.y + UK }, thickness: 0.4, color: GARIS });
}

/** Lebar kolom: bagian (pecahan) dari lebar isi. */
function susunKolom(k: Kanvas, bagian: [string, number, boolean?][]): Kolom[] {
  const lebar = k.kanan - k.kiri;
  const jumlah = bagian.reduce((s, b) => s + b[1], 0);
  return bagian.map(([j, b, kanan]) => ({ judul: j, lebar: (lebar * b) / jumlah, kanan: Boolean(kanan) }));
}

function tandaTangan(k: Kanvas, kiri: string, kanan: string, tempatTanggal: string, namaKiri = "", namaKanan = "") {
  if (k.y < 150) {
    k.hal = k.dok.addPage([k.lebarKertas, k.tinggiKertas]);
    k.y = k.tinggiKertas - 60;
  }
  k.y -= 24;
  const tengahKanan = k.kiri + (k.kanan - k.kiri) * 0.75;
  const tengahKiri = k.kiri + (k.kanan - k.kiri) * 0.25;
  const tulisTengah = (t: string, cx: number, huruf: PDFFont) => {
    const w = huruf.widthOfTextAtSize(t, 9.5);
    k.hal.drawText(t, { x: cx - w / 2, y: k.y, size: 9.5, font: huruf, color: HITAM });
  };
  tulisTengah(tempatTanggal, tengahKanan, k.biasa);
  k.y -= 14;
  tulisTengah(kiri, tengahKiri, k.biasa);
  tulisTengah(kanan, tengahKanan, k.biasa);
  k.y -= 64;
  tulisTengah(namaKiri ? `(${patahBaris(k.biasa, namaKiri, 9.5, 10_000)[0] ?? ""})` : "(..................................)", tengahKiri, k.biasa);
  tulisTengah(namaKanan ? `(${patahBaris(k.biasa, namaKanan, 9.5, 10_000)[0] ?? ""})` : "(..................................)", tengahKanan, k.biasa);
}

function periode(dari: string, sampai: string) {
  return dari === sampai ? tanggalIndonesia(dari) : `${tanggalIndonesia(dari)} s.d. ${tanggalIndonesia(sampai)}`;
}

/** Daftar Pengembalian Sisa Panjar untuk diserahkan / ditransfer. */
export async function buatPdfPsp(data: DaftarPsp, opsi: { kertas?: KertasSkum; satker?: string } = {}): Promise<Uint8Array> {
  const k = await kanvasBaru(opsi.kertas === "F4" ? "F4" : "A4", `Pengembalian Sisa Panjar ${data.dari}`);
  judul(k, ["DAFTAR PENGEMBALIAN SISA PANJAR", ...(opsi.satker ? [opsi.satker.toUpperCase()] : [])], [`Tanggal: ${periode(data.dari, data.sampai)} · ${data.jumlah} perkara`]);
  const sembunyi = Boolean(data.rekeningDisembunyikan);
  // 4 Nov 2026 (rancangan): kolom "Paraf / bukti transfer" di ujung kanan - diisi tangan saat diserahkan atau ditransfer.
  const kolom = susunKolom(k, sembunyi
    ? [["No", 0.5], ["Nomor perkara", 2], ["Tanggal", 1.3], ["Penerima", 2.6], ["Sisa panjar", 1.4, true], ["Paraf / bukti transfer", 1.8]]
    : [["No", 0.5], ["Nomor perkara", 2], ["Tanggal", 1.2], ["Penerima", 2.2], ["Bank / Nomor rekening", 2], ["Sisa panjar", 1.3, true], ["Paraf / bukti transfer", 1.6]]);
  kepalaTabel(k, kolom);
  data.daftar.forEach((b, i) => {
    const dasar = [String(i + 1), b.nomorPerkara, tanggalIndonesia(b.tanggal), penerimaPsp(b)];
    barisTabel(k, kolom, sembunyi ? [...dasar, rupiahTitik(b.jumlah), ""] : [...dasar, teksRekeningPsp(b), rupiahTitik(b.jumlah), ""]);
  });
  barisTabel(k, kolom, sembunyi ? ["", "Total", "", "", rupiahTitik(data.total), ""] : ["", "Total", "", "", "", rupiahTitik(data.total), ""], { tebal: true });
  tandaTangan(k, "Mengetahui, Panitera,", "Kasir,", periode(data.sampai, data.sampai));
  return k.dok.save();
}

/** Instrumen biaya panggilan & PBT SATU jurusita (dicetak terpisah per jurusita). */
export async function buatPdfInstrumen(
  kelompok: KelompokInstrumen,
  opsi: { dari: string; sampai: string; kertas?: KertasSkum; satker?: string }
): Promise<Uint8Array> {
  const k = await kanvasBaru(opsi.kertas === "F4" ? "F4" : "A4", `Instrumen ${kelompok.jurusita} ${opsi.dari}`);
  // 4 Nov 2026 (rancangan): judul tanpa singkatan, jumlah tugas disebut, penyerah (kasir) di kiri dan penerima (jurusita) di kanan.
  const tugas = kelompok.baris.length;
  judul(
    k,
    ["INSTRUMEN BIAYA PANGGILAN DAN PEMBERITAHUAN PUTUSAN", ...(opsi.satker ? [opsi.satker.toUpperCase()] : [])],
    [
      `Jurusita: ${kelompok.jurusita}`,
      `Jumlah tugas: ${tugas} relaas (${kelompok.jumlahPanggilan} panggilan, ${kelompok.jumlahPbt} PBT)`,
      `Tanggal: ${periode(opsi.dari, opsi.sampai)}`,
    ]
  );
  const kolom = susunKolom(k, [["No", 0.45], ["Nomor perkara", 1.75], ["Pihak", 1.9], ["Alamat", 2.6], ["Jenis", 1.8], ["Tanggal", 1.15], ["Biaya", 1.25, true]]);
  kepalaTabel(k, kolom);
  kelompok.baris.forEach((b, i) => {
    barisTabel(k, kolom, [String(i + 1), b.nomorPerkara, b.pihak || "-", b.alamat || "-", b.jenis, tanggalIndonesia(b.tanggal), rupiahTitik(b.jumlah)]);
  });
  barisTabel(k, kolom, ["", "Jumlah diterima jurusita", "", "", "", "", rupiahTitik(kelompok.total)], { tebal: true });
  tandaTangan(k, "Yang menyerahkan, Kasir,", "Yang menerima, Jurusita,", periode(opsi.sampai, opsi.sampai), "", kelompok.jurusitaId > 0 ? kelompok.jurusita : "");
  return k.dok.save();
}
