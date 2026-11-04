import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import { angkaSkum, type SkumEcourt } from "@/lib/pembayaran-ecourt";

/**
 * ============================================================================
 * e-SKUM e-COURT SEBAGAI PDF UTUH (Kasir 3 Nov 2026)
 * ============================================================================
 *
 * Cetak bawaan e-Court memotong kolom JUMLAH (kotak modal lebih lebar daripada kertas). Di sini isinya
 * yang SAMA - kop, judul, Nama/Alamat/Telp, kalimat kuasa, rincian bernomor, total, kode pendaftaran -
 * disusun ulang di kertas A4 atau F4 tegak dengan lebar kolom dihitung dari kertas: uraian yang panjang
 * dipatah ke baris berikutnya, kolom "Rp." dan JUMLAH rata kanan selalu di dalam margin.
 */

export type KertasSkum = "A4" | "F4";

const UKURAN: Record<KertasSkum, [number, number]> = {
  A4: [595.28, 841.89],
  F4: [609.45, 935.43],
};

const HITAM = rgb(0, 0, 0);
const GARIS = rgb(0.75, 0.75, 0.75);

/** Huruf di luar WinAnsi diganti "?" - pdf-lib melempar galat untuknya. */
function aman(huruf: PDFFont, teks: string): string {
  let hasil = "";
  for (const k of String(teks || "")) {
    try {
      huruf.widthOfTextAtSize(k, 10);
      hasil += k;
    } catch {
      hasil += "?";
    }
  }
  return hasil;
}

/** Patah teks agar muat `lebar` titik. */
export function patahBaris(huruf: PDFFont, teks: string, ukuran: number, lebar: number): string[] {
  const kata = aman(huruf, teks).split(/\s+/).filter(Boolean);
  const baris: string[] = [];
  let kini = "";
  for (const k of kata) {
    const coba = kini ? `${kini} ${k}` : k;
    if (huruf.widthOfTextAtSize(coba, ukuran) <= lebar || !kini) kini = coba;
    else {
      baris.push(kini);
      kini = k;
    }
  }
  if (kini) baris.push(kini);
  return baris.length ? baris : [""];
}

/** Rincian pembayaran yang menyertai e-SKUM (rancangan 4 Nov 2026); rekening hanya bila pencetak berhak melihatnya. */
export type PembayaranSkum = { status?: string; tanggal?: string; jam?: string; nomorPembayaran?: string; bank?: string; nomorRekening?: string };

const HARI_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
/** "2026-11-03" -> "Selasa, 3 November 2026". */
function hariTanggal(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  if (!m) return String(iso || "");
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return `${HARI_ID[d.getUTCDay()]}, ${Number(m[3])} ${BULAN_ID[Number(m[2]) - 1]} ${m[1]}`;
}

export async function buatPdfSkumEcourt(
  skum: SkumEcourt,
  opsi: { kertas?: KertasSkum; nomorPerkara?: string; pembayaran?: PembayaranSkum } = {}
): Promise<Uint8Array> {
  const kertas: KertasSkum = opsi.kertas === "F4" ? "F4" : "A4";
  const [lebarKertas, tinggiKertas] = UKURAN[kertas];
  const dok = await PDFDocument.create();
  dok.setTitle(`e-SKUM ${opsi.nomorPerkara || skum.kodePendaftaran || ""}`.trim());
  const biasa = await dok.embedFont(StandardFonts.Helvetica);
  const tebal = await dok.embedFont(StandardFonts.HelveticaBold);
  const kiri = 56;
  const kanan = lebarKertas - 56;
  const lebarIsi = kanan - kiri;
  let hal: PDFPage = dok.addPage([lebarKertas, tinggiKertas]);
  let y = tinggiKertas - 56;

  const halBaru = () => {
    hal = dok.addPage([lebarKertas, tinggiKertas]);
    y = tinggiKertas - 56;
  };
  const tengah = (teks: string, huruf: PDFFont, ukuran: number) => {
    for (const b of patahBaris(huruf, teks, ukuran, lebarIsi)) {
      const w = huruf.widthOfTextAtSize(b, ukuran);
      hal.drawText(b, { x: kiri + (lebarIsi - w) / 2, y, size: ukuran, font: huruf, color: HITAM });
      y -= ukuran + 4;
    }
  };
  const kananTeks = (teks: string, xKanan: number, huruf: PDFFont, ukuran: number, yy: number) => {
    const t = aman(huruf, teks);
    hal.drawText(t, { x: xKanan - huruf.widthOfTextAtSize(t, ukuran), y: yy, size: ukuran, font: huruf, color: HITAM });
  };

  // Kop
  const [namaPengadilan, ...kopLain] = skum.kop.length ? skum.kop : ["PENGADILAN AGAMA"];
  tengah(namaPengadilan, biasa, 15);
  for (const k of kopLain) tengah(k, biasa, 9);
  y -= 1;
  tengah(skum.judul || "SURAT KUASA UNTUK MEMBAYAR ELEKTRONIK (e-SKUM)", tebal, 10.5);
  hal.drawLine({ start: { x: kiri, y: y + 4 }, end: { x: kanan, y: y + 4 }, thickness: 1.2, color: HITAM });
  hal.drawLine({ start: { x: kiri, y: y + 1.5 }, end: { x: kanan, y: y + 1.5 }, thickness: 0.6, color: HITAM });
  y -= 18;
  if (skum.kodePendaftaran) {
    kananTeks(skum.kodePendaftaran, kanan, tebal, 9, y + 8);
  }

  // Identitas
  const UK = 10;
  hal.drawText(aman(biasa, "Kami yang bertanda tangan di bawah ini :"), { x: kiri, y, size: UK, font: biasa, color: HITAM });
  y -= UK + 6;
  const xNilai = kiri + (opsi.nomorPerkara ? 78 : 64);
  for (const [label, nilai] of [
    ...(opsi.nomorPerkara ? ([["Nomor Perkara", opsi.nomorPerkara]] as const) : []),
    ["Nama", skum.nama],
    ["Alamat", skum.alamat],
    ["Telp/HP", skum.telp],
  ] as const) {
    hal.drawText(label, { x: kiri, y, size: UK, font: biasa, color: HITAM });
    hal.drawText(":", { x: xNilai - 8, y, size: UK, font: biasa, color: HITAM });
    for (const b of patahBaris(biasa, nilai || "-", UK, kanan - xNilai)) {
      hal.drawText(b, { x: xNilai, y, size: UK, font: biasa, color: HITAM });
      y -= UK + 4;
    }
  }
  if (skum.pengantar) {
    y -= 2;
    for (const b of patahBaris(biasa, skum.pengantar, UK, lebarIsi)) {
      hal.drawText(b, { x: kiri, y, size: UK, font: biasa, color: HITAM });
      y -= UK + 4;
    }
  }
  y -= 10;

  // Tabel: URAIAN | Rp. | JUMLAH - lebar dari kertas, JUMLAH selalu muat.
  const lebarJumlah = Math.max(tebal.widthOfTextAtSize("JUMLAH", UK), biasa.widthOfTextAtSize(angkaSkum(99_999_999), UK)) + 8;
  const xJumlahKanan = kanan - 6;
  const xRp = xJumlahKanan - lebarJumlah - biasa.widthOfTextAtSize("Rp.", UK) - 6;
  const lebarUraian = xRp - kiri - 18;
  hal.drawText("URAIAN PEMBAYARAN", { x: kiri + 6, y, size: UK, font: tebal, color: HITAM });
  kananTeks("JUMLAH", xJumlahKanan, tebal, UK, y);
  y -= 8;
  hal.drawLine({ start: { x: kiri, y }, end: { x: kanan, y }, thickness: 0.8, color: HITAM });
  y -= UK + 6;
  for (const r of skum.rincian) {
    const baris = patahBaris(biasa, `${r.no}. ${r.uraian}`, UK, lebarUraian);
    const tinggi = baris.length * (UK + 3) + 8;
    if (y - tinggi < 120) halBaru();
    const yAwal = y;
    for (const b of baris) {
      hal.drawText(b, { x: kiri + 6, y, size: UK, font: biasa, color: HITAM });
      y -= UK + 3;
    }
    hal.drawText("Rp.", { x: xRp, y: yAwal, size: UK, font: biasa, color: HITAM });
    kananTeks(angkaSkum(r.jumlah), xJumlahKanan, biasa, UK, yAwal);
    y -= 5;
    hal.drawLine({ start: { x: kiri, y: y + UK - 1 }, end: { x: kanan, y: y + UK - 1 }, thickness: 0.4, color: GARIS });
    y -= 4;
  }

  // Total
  y -= 8;
  const tinggiTotal = 30;
  hal.drawRectangle({ x: kiri, y: y - tinggiTotal + UK, width: lebarIsi, height: tinggiTotal, borderColor: HITAM, borderWidth: 0.8 });
  hal.drawText("Total yang harus di bayarkan (Rp.)", { x: kiri + 8, y: y - 6, size: 11, font: tebal, color: HITAM });
  kananTeks(angkaSkum(skum.total), xJumlahKanan, tebal, 13, y - 7);
  y -= tinggiTotal + 10;

  // Rincian pembayaran (rancangan 4 Nov 2026): status, tanggal, nomor pembayaran, dan bank/rekening bila berhak.
  const by = opsi.pembayaran;
  if (by) {
    const baris: string[] = [];
    if (by.status) baris.push(`Status pembayaran: ${by.status}`);
    if (by.tanggal) baris.push(`Tanggal: ${hariTanggal(by.tanggal)}${by.jam ? ` pukul ${String(by.jam).slice(0, 5)}` : ""}`);
    if (by.nomorPembayaran) baris.push(`Nomor pembayaran: ${by.nomorPembayaran}`);
    if (by.bank || by.nomorRekening) baris.push(`Bank: ${[by.bank, by.nomorRekening ? `rekening ${by.nomorRekening}` : ""].filter(Boolean).join(" · ")}`);
    if (baris.length) {
      if (y - baris.length * (UK + 4) < 60) halBaru();
      for (const b of baris) {
        for (const p of patahBaris(biasa, b, UK, lebarIsi)) {
          hal.drawText(p, { x: kiri, y, size: UK, font: biasa, color: HITAM });
          y -= UK + 4;
        }
      }
    }
  }
  return dok.save();
}
