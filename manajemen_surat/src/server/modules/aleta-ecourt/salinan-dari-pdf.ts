import { PDFDocument, PDFName, PDFRawStream, StandardFonts, rgb, type PDFFont, decodePDFRawStream } from "pdf-lib";

import {
  PT_PER_MM,
  bacaItemPdf,
  bubuhkanTtdPdf,
  padatkan,
  susunBaris,
  ukuranGambar,
  type AturTtd,
  type ItemTeks,
  type UkuranHalaman,
} from "./pdf-bubuh-ttd";

/**
 * ============================================================================
 * PDF SALINAN DARI PDF YANG MASIH KOSONG (5 Nov 2026)
 * ============================================================================
 *
 * PDF SALINAN lewat RTF (abt/pdf, salinanPutusanService) menyunting naskah SEBELUM LibreOffice. Berkas yang hanya berbentuk PDF
 * (putusan yang sudah dicetak dan belum bertuliskan SALINAN) tidak punya naskah untuk disunting, jadi tambahannya digambar LANGSUNG
 * di atas halaman PDF, letaknya dicari dari lapisan teks PDF (pdfjs, sama dengan pembubuh tanda tangan):
 *
 *   a. "SALINAN" kiri atas halaman pertama (di baris sendiri di atas judul PUTUSAN bila ruangnya ada; selain itu di pojok kiri atas
 *      bila kosong);
 *   b. "ttd" di bawah tiap label pejabat persidangan (Ketua Majelis, Hakim Anggota, Panitera Sidang/Pengganti, ...), di baris kosong
 *      pertama antara label dan nama;
 *   c. blok "Untuk Salinan / Pengadilan <nama> / Panitera," di akhir naskah, dengan tanda tangan ASLI (yang sudah disahkan) Panitera
 *      di atas namanya dan cap kantor - dibubuhkan pembubuh tanda tangan yang sama dengan salinan lewat RTF.
 *
 * ATURAN KERAS
 *   - Isi halaman asli tidak berubah selain tambahan itu (pdf-lib hanya menambah isi halaman; blok pengesah memakai halaman baru bila
 *     ruang di halaman terakhir tidak cukup).
 *   - TIDAK MENEBAK: pindaian tanpa lapisan teks, PDF yang sudah bertuliskan SALINAN, label pejabat yang tidak ditemukan, ruang
 *     tanda tangan yang tidak cukup, atau Panitera pengesah yang tidak dapat ditentukan = DITOLAK seluruhnya dengan sebab yang jelas.
 *     Tidak pernah menghasilkan salinan separuh.
 *   - Tidak menyimpan apa pun dan tidak menulis ke SIPP/ABT. Tidak ada kata "Aleta" yang ditambahkan ke PDF; metadata yang memuatnya
 *     dikosongkan.
 *   - Fungsi analisis dan tata letak MURNI (tanpa pdf-lib/pdfjs) agar dapat diuji.
 */

export type KodeTolakSalinanPdf =
  | "bukan_pdf"
  | "pdf_tidak_terbaca"
  | "tanpa_teks"
  | "sudah_salinan"
  | "label_tidak_ada"
  | "ruang_ttd_kurang"
  | "penanda_tak_muat"
  | "nama_pengadilan_kosong"
  | "pengesah_tidak_ada"
  | "pengesah_ganda"
  | "teks_tak_terkodekan"
  | "gagal_membuat";

export class SalinanPdfDitolak extends Error {
  kode: KodeTolakSalinanPdf;
  constructor(kode: KodeTolakSalinanPdf, pesan: string) {
    super(pesan);
    this.kode = kode;
  }
}

/** Label tempat tanda tangan pejabat persidangan - sama dengan LABEL_PEJABAT di bot (blokTandaTanganRtf). */
export const LABEL_PEJABAT = /^(ketua majelis|hakim ketua|hakim anggota(?: [ivx\d]+)?|hakim tunggal|hakim|panitera sidang|panitera pengganti|panitera),?$/i;
const LABEL_HAKIM = /^(ketua majelis|hakim ketua|hakim anggota|hakim tunggal|hakim)/i;
const LABEL_PANITERA = /^panitera/i;

/** Potongan teks satu sel/kolom pada sebuah baris (item yang berdekatan digabung; celah lebar = kolom lain). */
export type Segmen = { halaman: number; teks: string; xMin: number; xMax: number; y: number; tinggi: number };

const sebaris = (s: string) => s.replace(/\s+/g, " ").trim();

export function susunSegmen(item: ItemTeks[]): Segmen[] {
  const hasil: Segmen[] = [];
  for (const b of susunBaris(item)) {
    let sekarang: ItemTeks[] = [];
    const tutup = () => {
      if (!sekarang.length) return;
      const teks = sebaris(sekarang.map((i) => i.str).join(""));
      if (teks) {
        hasil.push({
          halaman: b.halaman,
          teks,
          xMin: Math.min(...sekarang.map((i) => i.x)),
          xMax: Math.max(...sekarang.map((i) => i.x + i.lebar)),
          y: b.y,
          tinggi: b.tinggi,
        });
      }
      sekarang = [];
    };
    let akhir = -Infinity;
    for (const it of b.item) {
      if (sekarang.length && it.x - akhir > 1.2 * Math.max(it.tinggi || 10, 8)) tutup();
      sekarang.push(it);
      akhir = it.x + it.lebar;
    }
    tutup();
  }
  return hasil;
}

export type TitikTtd = { halaman: number; label: string; pusat: number; y: number; ukuran: number; sudahAda: boolean };
export type TitikSalinan = { halaman: 1; x: number; y: number; ukuran: number; cara: "di_atas_judul" | "pojok_kiri_atas" };
export type AnalisisSalinan = { salinan: TitikSalinan; ttd: TitikTtd[]; ttdBaru: number; ttdSudahAda: number };

const PUNCAK = 0.72;
const KAKI = 0.22;

function tolak(kode: KodeTolakSalinanPdf, pesan: string): never {
  throw new SalinanPdfDitolak(kode, pesan);
}

/**
 * Analisis lapisan teks: apakah layak dijadikan salinan dan di mana tambahannya. Melempar SalinanPdfDitolak bila tidak.
 * Tahap pengesah (blok Untuk Salinan) dirancang terpisah oleh rancangBlokPengesah karena butuh ukuran tanda tangan Panitera.
 */
export function analisisSalinan(halaman: UkuranHalaman[], item: ItemTeks[]): AnalisisSalinan {
  const adaTeks = item.filter((i) => i.str.trim()).reduce((n, i) => n + i.str.trim().length, 0);
  if (!halaman.length || adaTeks < 80) {
    tolak(
      "tanpa_teks",
      "PDF ini tidak memiliki lapisan teks (kemungkinan hasil pindaian atau gambar), jadi letak nama pejabat tidak dapat dicari dan salinan tidak dibuat. Pakai PDF yang dicetak dari naskahnya, atau berkas RTF/DOCX/DOC."
    );
  }
  const baris = susunBaris(item);
  if (baris.some((b) => padatkan(b.teks) === "salinan" || padatkan(b.teks).includes("untuksalinan"))) {
    tolak("sudah_salinan", "Berkas PDF ini sudah bertuliskan SALINAN (atau memuat blok \"Untuk Salinan\"), jadi tidak diubah lagi supaya tidak bertumpuk.");
  }
  const segmen = susunSegmen(item);

  // b. label pejabat: hanya kelompok pada halaman TERAKHIR yang memuat label (blok tanda tangan ada di ujung naskah)
  const label = segmen.filter((s) => LABEL_PEJABAT.test(s.teks));
  if (!label.some((s) => LABEL_HAKIM.test(s.teks)) || !label.some((s) => LABEL_PANITERA.test(s.teks))) {
    tolak(
      "label_tidak_ada",
      "Label penanda tangan (Ketua Majelis atau Hakim, dan Panitera Sidang atau Pengganti) tidak ditemukan di lapisan teks PDF, jadi letak \"ttd\" tidak dapat dicari dan salinan tidak dibuat."
    );
  }
  const halamanBlok = Math.max(...label.map((s) => s.halaman));
  const dalamBlok = label.filter((s) => s.halaman === halamanBlok);
  if (!dalamBlok.some((s) => LABEL_HAKIM.test(s.teks)) || !dalamBlok.some((s) => LABEL_PANITERA.test(s.teks))) {
    tolak("label_tidak_ada", "Label Hakim dan Panitera tidak berada pada halaman yang sama, jadi letak \"ttd\" tidak dapat dipastikan dan salinan tidak dibuat.");
  }
  const ttd: TitikTtd[] = [];
  for (const l of dalamBlok) {
    const ukuran = Math.min(14, Math.max(9, l.tinggi || 11));
    const pusat = (l.xMin + l.xMax) / 2;
    // nama = segmen terdekat DI BAWAH label yang tumpang tindih mendatar dengannya, bukan label lain
    const bawah = segmen
      .filter((s) => s.halaman === l.halaman && s.y < l.y - (l.tinggi || 10) && !LABEL_PEJABAT.test(s.teks) && s.xMin < l.xMax && s.xMax > l.xMin)
      .sort((a, b) => b.y - a.y)[0];
    if (!bawah) {
      tolak("ruang_ttd_kurang", `Nama di bawah label "${l.teks.replace(/,$/, "")}" tidak ditemukan pada halaman yang sama, jadi \"ttd\" tidak dapat dipasang dan salinan tidak dibuat.`);
    }
    const yTtd = l.y - 1.25 * ukuran;
    const puncakNama = bawah.y + PUNCAK * (bawah.tinggi || 10);
    const sudahAda = item.some(
      (i) => i.halaman === l.halaman && /^ttd\.?$/i.test(i.str.trim()) && i.y < l.y - 0.5 * ukuran && i.y > bawah.y && i.x < l.xMax && i.x + i.lebar > l.xMin
    );
    if (!sudahAda && yTtd - KAKI * ukuran - 0.5 * ukuran < puncakNama) {
      tolak(
        "ruang_ttd_kurang",
        `Tidak ada ruang kosong antara label "${l.teks.replace(/,$/, "")}" dan namanya untuk menulis \"ttd\", jadi salinan tidak dibuat (isi halaman tidak digeser).`
      );
    }
    ttd.push({ halaman: l.halaman, label: l.teks.replace(/,$/, ""), pusat, y: yTtd, ukuran, sudahAda });
  }

  // a. SALINAN kiri atas halaman pertama
  const h1 = halaman[0];
  const itemH1 = item.filter((i) => i.halaman === 1 && i.str.trim().length >= 3);
  const xKiri = itemH1.length ? Math.min(...itemH1.map((i) => i.x)) : 56;
  const ukuranS = 12;
  const lebarS = ukuranS * 5.2;
  const bentur = (yDasar: number) =>
    item.some((i) => i.halaman === 1 && i.str.trim() && i.y + PUNCAK * (i.tinggi || 10) > yDasar - KAKI * ukuranS && i.y - KAKI * (i.tinggi || 10) < yDasar + PUNCAK * ukuranS && i.x < xKiri + lebarS && i.x + i.lebar > xKiri);
  const baris1 = baris.filter((b) => b.halaman === 1);
  const judul = baris1.find((b) => padatkan(b.teks) === "putusan");
  let salinan: TitikSalinan | null = null;
  if (judul) {
    const sebelum = baris1.filter((b) => b.y > judul.y + 0.5).sort((a, b) => a.y - b.y)[0];
    const batasAtas = sebelum ? sebelum.y - KAKI * (sebelum.tinggi || 10) - 2 : h1.tinggi - 20;
    const batasBawah = judul.y + PUNCAK * (judul.tinggi || 12) + 2;
    const y = (batasAtas - PUNCAK * ukuranS + batasBawah + KAKI * ukuranS) / 2;
    if (batasAtas - PUNCAK * ukuranS >= y && y - KAKI * ukuranS >= batasBawah && !bentur(y)) salinan = { halaman: 1, x: xKiri, y, ukuran: ukuranS, cara: "di_atas_judul" };
  }
  if (!salinan) {
    const y = h1.tinggi - 30;
    if (!bentur(y)) salinan = { halaman: 1, x: xKiri, y, ukuran: ukuranS, cara: "pojok_kiri_atas" };
  }
  if (!salinan) {
    tolak("penanda_tak_muat", "Tempat kosong untuk tulisan SALINAN di kiri atas halaman pertama tidak ditemukan (sudah terisi tulisan), jadi salinan tidak dibuat.");
  }
  const sudah = ttd.filter((t) => t.sudahAda).length;
  return { salinan, ttd, ttdBaru: ttd.length - sudah, ttdSudahAda: sudah };
}

export type RancanganBlok = {
  /** halaman 1-berbasis; halamanBaru = halaman tambahan sesudah halaman terakhir */
  halaman: number;
  halamanBaru: boolean;
  ukuran: number;
  baris: Array<{ teks: string; y: number; tebal?: boolean }>;
  pusat: number;
  namaPanitera: string;
};

/**
 * Letak blok pengesah di akhir naskah. `ruangTtdPt` = jarak label "Panitera," ke nama (untuk gambar tanda tangan).
 * Halaman terakhir dipakai bila muat di atas margin bawah; kalau tidak, halaman tambahan berukuran sama.
 */
export function rancangBlokPengesah(
  halaman: UkuranHalaman[],
  item: ItemTeks[],
  p: { namaPengadilan: string; namaPanitera: string; ruangTtdPt: number; lebarTeks: (teks: string, ukuran: number, tebal: boolean) => number }
): RancanganBlok {
  const n = halaman.length;
  const hAkhir = halaman[n - 1];
  const itemAkhir = item.filter((i) => i.halaman === n && i.str.trim());
  const tinggiTipikal = itemAkhir.length ? itemAkhir.map((i) => i.tinggi || 11).sort((a, b) => a - b)[Math.floor(itemAkhir.length / 2)] : 11;
  const ukuran = Math.min(12, Math.max(10, tinggiTipikal));
  const langkah = 1.3 * ukuran;
  const teks = ["Untuk Salinan", p.namaPengadilan, "Panitera,"];
  const lebar = Math.max(...[...teks, p.namaPanitera].map((t, i) => p.lebarTeks(t, ukuran, i === 3 ? true : false)));
  const tinggiBlok = 2 * langkah + p.ruangTtdPt + langkah * 0.4;
  const xKanan = itemAkhir.length ? Math.max(...itemAkhir.map((i) => i.x + i.lebar)) : hAkhir.lebar - 56;
  const pusat = Math.max(lebar / 2 + 28, Math.min(xKanan - lebar / 2, hAkhir.lebar - 28 - lebar / 2));
  const marginBawah = 40;
  const yBawahIsi = itemAkhir.length ? Math.min(...itemAkhir.map((i) => i.y - KAKI * (i.tinggi || 10))) : hAkhir.tinggi - 56;
  const puncak = yBawahIsi - 2 * langkah;
  let halamanBaru = false;
  let yAtas = puncak;
  if (yAtas - tinggiBlok - langkah < marginBawah) {
    halamanBaru = true;
    yAtas = hAkhir.tinggi - 64;
  }
  const baris = [
    { teks: teks[0], y: yAtas },
    { teks: teks[1], y: yAtas - langkah },
    { teks: teks[2], y: yAtas - 2 * langkah },
    { teks: p.namaPanitera, y: yAtas - 2 * langkah - p.ruangTtdPt, tebal: true },
  ];
  return { halaman: halamanBaru ? n + 1 : n, halamanBaru, ukuran, baris, pusat, namaPanitera: p.namaPanitera };
}

/** Jarak label "Panitera," ke nama supaya gambar tanda tangan tidak mengecil dan tidak menutupi label (aturan hitungLetakTtd). */
export function ruangUntukTtd(p: { rasio: number; ukuran: number; atur: Pick<AturTtd, "lebarTtdMm" | "ttdTurunMm"> & { tinggiTtdMaksMm?: number } }): number {
  const lebar = p.atur.lebarTtdMm * PT_PER_MM;
  const maks = (p.atur.tinggiTtdMaksMm ?? (p.atur.lebarTtdMm * 35) / 64) * PT_PER_MM;
  const tinggi = Math.min(lebar * p.rasio, maks);
  const tumpang = Math.max(0, Math.min(p.atur.ttdTurunMm * PT_PER_MM, p.ukuran / 3));
  return PUNCAK * p.ukuran - tumpang + tinggi + KAKI * p.ukuran + 3;
}

// ---------------------------------------------------------------------------
// Penerapan ke PDF
// ---------------------------------------------------------------------------

async function bersihkanMetadata(dok: PDFDocument) {
  const aleta = /a[\s._-]*l[\s._-]*e[\s._-]*t[\s._-]*a/i;
  const info: Array<[string | undefined, (s: string) => void]> = [
    [dok.getTitle(), (s) => dok.setTitle(s)],
    [dok.getAuthor(), (s) => dok.setAuthor(s)],
    [dok.getSubject(), (s) => dok.setSubject(s)],
    [dok.getKeywords(), (s) => dok.setKeywords(s ? [s] : [])],
    [dok.getCreator(), (s) => dok.setCreator(s)],
    [dok.getProducer(), (s) => dok.setProducer(s)],
  ];
  for (const [nilai, tulis] of info) if (nilai && aleta.test(nilai)) tulis("");
  try {
    const m = dok.catalog.get(PDFName.of("Metadata"));
    const aliran = m ? dok.context.lookup(m) : null;
    if (aliran instanceof PDFRawStream) {
      let isi = "";
      try {
        isi = Buffer.from(decodePDFRawStream(aliran).decode()).toString("utf8");
      } catch {
        isi = Buffer.from(aliran.contents).toString("latin1");
      }
      if (aleta.test(isi)) dok.catalog.delete(PDFName.of("Metadata"));
    }
  } catch {
    /* metadata XMP tak terbaca: dibiarkan */
  }
}

async function gambarTambahan(bita: Uint8Array, a: AnalisisSalinan, blok: RancanganBlok): Promise<Uint8Array> {
  let dok: PDFDocument;
  try {
    dok = await PDFDocument.load(bita, { updateMetadata: false });
  } catch {
    tolak("pdf_tidak_terbaca", "PDF tidak dapat dibuka (rusak atau dikunci kata sandi), jadi salinan tidak dibuat.");
  }
  const huruf = await dok.embedFont(StandardFonts.TimesRoman);
  const hurufTebal = await dok.embedFont(StandardFonts.TimesRomanBold);
  const halaman = dok.getPages();
  try {
    // a. SALINAN
    halaman[0].drawText("SALINAN", { x: a.salinan.x, y: a.salinan.y, size: a.salinan.ukuran, font: hurufTebal, color: rgb(0, 0, 0) });
    // b. ttd (yang sudah ada dibiarkan)
    for (const t of a.ttd) {
      if (t.sudahAda) continue;
      const lebar = huruf.widthOfTextAtSize("ttd", t.ukuran);
      halaman[t.halaman - 1].drawText("ttd", { x: t.pusat - lebar / 2, y: t.y, size: t.ukuran, font: huruf, color: rgb(0, 0, 0) });
    }
    // c. blok pengesah (gambar tanda tangan dibubuhkan sesudahnya oleh bubuhkanTtdPdf)
    let pg = halaman[halaman.length - 1];
    if (blok.halamanBaru) pg = dok.addPage([pg.getWidth(), pg.getHeight()]);
    for (const b of blok.baris) {
      const f: PDFFont = b.tebal ? hurufTebal : huruf;
      const w = f.widthOfTextAtSize(b.teks, blok.ukuran);
      pg.drawText(b.teks, { x: blok.pusat - w / 2, y: b.y, size: blok.ukuran, font: f, color: rgb(0, 0, 0) });
    }
  } catch (e) {
    tolak("teks_tak_terkodekan", `Tulisan tambahan tidak dapat dibuat (${e instanceof Error ? e.message.slice(0, 80) : "huruf tidak didukung"}), jadi salinan tidak dibuat.`);
  }
  await bersihkanMetadata(dok);
  return await dok.save({ useObjectStreams: false });
}

export type KeteranganSalinanPdf = {
  jenis: "putusan-pdf";
  salinan: string;
  ttdDitambah: number;
  ttdSudahAda: number;
  namaPanitera: string;
  gambarTtdPanitera: boolean;
  alasanTanpaGambar: string;
  capPanitera: boolean;
  blokHalamanBaru: boolean;
};

export type DepsSalinanPdf = {
  /** Nama pengadilan untuk baris "Pengadilan ..." (Identitas satker). */
  namaPengadilan: () => Promise<string>;
  /** Tanda tangan yang sudah disahkan: { id, namaPejabat, jabatan }. */
  daftarTtdSah: () => Promise<Array<{ id: number; namaPejabat: string; jabatan: string }>>;
  gambarTtd: (id: number) => Promise<Uint8Array | null>;
  cap: () => Promise<Uint8Array | null>;
  atur: Partial<AturTtd> & { lebarTtdMm: number; ttdTurunMm: number; tinggiTtdMaksMm?: number };
  lebarTeks?: (teks: string, ukuran: number, tebal: boolean) => number;
};

/**
 * Seluruh alurnya: PDF masuk -> PDF SALINAN keluar. Melempar SalinanPdfDitolak (kode + pesan bahasa Indonesia) bila tidak dapat
 * dikerjakan dengan aman. Satu implementasi untuk Isian SIPP, Blangko Derry, dan ALETA ABT (lewat rute salinan-dari-pdf).
 */
export async function buatSalinanDariPdf(bita: Uint8Array, deps: DepsSalinanPdf): Promise<{ pdf: Uint8Array; keterangan: KeteranganSalinanPdf }> {
  const kepala = Buffer.from(bita.subarray(0, 5)).toString("latin1");
  if (kepala !== "%PDF-") tolak("bukan_pdf", "Berkas ini bukan PDF.");
  let bacaan: Awaited<ReturnType<typeof bacaItemPdf>>;
  try {
    bacaan = await bacaItemPdf(bita);
  } catch {
    tolak("pdf_tidak_terbaca", "PDF tidak dapat dibaca (rusak atau dikunci kata sandi), jadi salinan tidak dibuat.");
  }
  const analisis = analisisSalinan(bacaan.halaman, bacaan.item);

  // Panitera pengesah: tepat SATU tanda tangan sah berjabatan "Panitera"; selain itu tidak ditebak.
  const namaPengadilan = sebaris(await deps.namaPengadilan());
  if (!namaPengadilan) tolak("nama_pengadilan_kosong", "Nama pengadilan belum diisi di Identitas satker, jadi baris \"Pengadilan ...\" pada blok Untuk Salinan tidak dapat ditulis dan salinan tidak dibuat.");
  const calon = (await deps.daftarTtdSah()).filter((t) => padatkan(t.jabatan) === "panitera");
  if (calon.length === 0) tolak("pengesah_tidak_ada", "Panitera pengesah salinan belum dapat ditentukan: belum ada tanda tangan sah berjabatan Panitera, jadi salinan tidak dibuat.");
  if (calon.length > 1) tolak("pengesah_ganda", "Panitera pengesah salinan belum dapat ditentukan: ada lebih dari satu tanda tangan sah berjabatan Panitera, jadi salinan tidak dibuat.");
  const panitera = calon[0];
  const gambar = await deps.gambarTtd(panitera.id).catch(() => null);
  const ukuran = gambar ? ukuranGambar(gambar) : null;

  const pdfLib = await PDFDocument.create();
  const fTebal = await pdfLib.embedFont(StandardFonts.TimesRomanBold);
  const fBiasa = await pdfLib.embedFont(StandardFonts.TimesRoman);
  const lebarTeks = deps.lebarTeks ?? ((t: string, u: number, tebal: boolean) => (tebal ? fTebal : fBiasa).widthOfTextAtSize(t, u));
  const atur = { ...deps.atur };
  const ukuranBlok = 11;
  const ruang = ukuran && ukuran.w > 0 && ukuran.h > 0 ? ruangUntukTtd({ rasio: ukuran.h / ukuran.w, ukuran: ukuranBlok, atur }) : 3 * 1.3 * ukuranBlok;
  let blok: RancanganBlok;
  try {
    blok = rancangBlokPengesah(bacaan.halaman, bacaan.item, { namaPengadilan, namaPanitera: panitera.namaPejabat, ruangTtdPt: ruang, lebarTeks });
  } catch (e) {
    tolak("teks_tak_terkodekan", `Nama pada blok Untuk Salinan tidak dapat ditulis (${e instanceof Error ? e.message.slice(0, 80) : "huruf tidak didukung"}), jadi salinan tidak dibuat.`);
  }

  let hasil = await gambarTambahan(bita, analisis, blok);
  let gambarTtdPanitera = false;
  let alasanTanpaGambar = "";
  let capPanitera = false;
  if (!gambar || !ukuran) {
    alasanTanpaGambar = "ttd_tidak_ada";
  } else {
    const cap = await deps.cap().catch(() => null);
    const r = await bubuhkanTtdPdf(hasil, [{ nama: panitera.namaPejabat, gambar, cap: cap && cap.length ? cap : null }], { atur, sesudahPenanda: true });
    if (r.dipasang.length) {
      hasil = r.pdf;
      gambarTtdPanitera = true;
      capPanitera = Boolean(r.geometri[0] && r.geometri[0].cap);
    } else alasanTanpaGambar = r.galat || "nama_panitera_tidak_ditemukan_di_pdf";
  }
  return {
    pdf: hasil,
    keterangan: {
      jenis: "putusan-pdf",
      salinan: analisis.salinan.cara,
      ttdDitambah: analisis.ttdBaru,
      ttdSudahAda: analisis.ttdSudahAda,
      namaPanitera: panitera.namaPejabat,
      gambarTtdPanitera,
      alasanTanpaGambar,
      capPanitera,
      blokHalamanBaru: blok.halamanBaru,
    },
  };
}
