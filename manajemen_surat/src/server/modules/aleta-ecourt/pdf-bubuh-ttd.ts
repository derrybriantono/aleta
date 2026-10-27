import { PDFDocument } from "pdf-lib";

import { UKURAN_TTD_CAP_BAWAAN, tinggiTtdMaksMm } from "@/lib/ukuran-ttd-cap";

import { pasangRintisanPeramban } from "./baca-pdf";

/**
 * ============================================================================
 * TANDA TANGAN DIBUBUHKAN DI PDF, POSISINYA DARI KOORDINAT BARIS NAMA (27 Okt 2026)
 * ============================================================================
 *
 * Dahulu gambar tanda tangan disisipkan di RTF sebagai bentuk mengambang yang posisinya DITEBAK dari tata letak paragraf
 * (rata kiri/tengah/kanan, lebar bidang tulis). Nama penanda tangan sering berada di sel tabel (dua kolom "Hakim Anggota"),
 * di blok yang dirata kanan, atau di bingkai - tebakan itu meleset: gambar menimpa nama lain, melayang di tepi kanan,
 * atau menutupi label jabatan.
 *
 * Kini PDF dari LibreOffice dibaca lebih dulu: tiap potongan teks beserta koordinatnya (pdfjs getTextContent) disusun menjadi
 * baris, baris yang memuat nama penanda tangan dicari, lalu gambar ditaruh
 *   - RATA TENGAH terhadap rentang mendatar nama itu (bukan terhadap kolom/halaman),
 *   - TEPAT di atas nama: tepi bawah gambar = puncak huruf nama dikurangi tumpang tindih kecil (ttdTurunMm, paling banyak sepertiga
 *     tinggi huruf), seperti tanda tangan sungguhan,
 *   - tidak keluar dari tepi halaman (digeser ke dalam), dan
 *   - tidak menutupi tulisan di atasnya (label "Hakim Anggota,", dst.): bila ruang kurang, gambar DIKECILKAN (paling banyak sampai
 *     separuh) dengan titik tengah dan tepi bawah tetap.
 * Yang dihitung murni (tanpa pdf-lib/pdfjs) agar dapat diuji: susunBaris, cariNamaDiBaris, hitungLetakTtd.
 */

export type ItemTeks = { str: string; x: number; y: number; lebar: number; tinggi: number; halaman: number };
export type UkuranHalaman = { lebar: number; tinggi: number };
export type Baris = {
  halaman: number;
  y: number;
  tinggi: number;
  teks: string;
  /** Tepi kiri/kanan (pt) tiap karakter `teks`. */
  xAwal: number[];
  xAkhir: number[];
  item: ItemTeks[];
};
export type TemuanNama = { indeks: number; halaman: number; xMin: number; xMax: number; y: number; tinggi: number; cara: string };
export type Letak = { kiri: number; bawah: number; lebar: number; tinggi: number; terhimpit: boolean; dikecilkan: number };
export type AturTtd = {
  lebarTtdMm: number;
  tinggiTtdMaksMm?: number;
  ttdTurunMm: number;
  lebarCapMm?: number;
  capGeserKiriMm?: number;
  capGeserAtasMm?: number;
  opasitasCap?: number;
};

export const PT_PER_MM = 72 / 25.4;
/** Jarak minimum gambar dari tepi halaman (mm). */
const MARGIN_TEPI_MM = 8;
/** Gambar boleh dikecilkan paling banyak sampai bagian ini dari ukuran aturan. */
const SKALA_MIN = 0.5;
/** Puncak huruf kapital/ascender nama terhadap tinggi huruf (item.height ~ ukuran huruf). */
const PUNCAK_HURUF = 0.72;
/** Kaki huruf (descender) di bawah garis dasar terhadap tinggi huruf. */
const KAKI_HURUF = 0.22;

const kecil = (s: string) => s.toLowerCase();
const hurufAngka = (c: string) => /[\p{L}\p{N}]/u.test(c);
/** Hanya huruf dan angka, huruf kecil - pencocokan nama tidak peka tanda baca/spasi. */
export const padatkan = (s: string) => Array.from(kecil(s)).filter(hurufAngka).join("");

/** Menyusun potongan teks menjadi baris (per halaman, atas ke bawah; dalam baris kiri ke kanan). */
export function susunBaris(item: ItemTeks[]): Baris[] {
  const bersih = item.filter((i) => i.str && i.str.trim().length > 0 && Number.isFinite(i.x) && Number.isFinite(i.y));
  const urut = bersih.slice().sort((a, b) => a.halaman - b.halaman || b.y - a.y || a.x - b.x);
  const kelompok: ItemTeks[][] = [];
  let sekarang: ItemTeks[] = [];
  let acuan: ItemTeks | null = null;
  for (const it of urut) {
    const toleransi = 0.35 * Math.max(it.tinggi || 10, acuan?.tinggi || 10);
    if (acuan && (it.halaman !== acuan.halaman || Math.abs(it.y - acuan.y) > toleransi)) {
      kelompok.push(sekarang);
      sekarang = [];
      acuan = null;
    }
    if (!acuan) acuan = it;
    sekarang.push(it);
  }
  if (sekarang.length) kelompok.push(sekarang);

  return kelompok.map((g) => {
    const dalam = g.slice().sort((a, b) => a.x - b.x);
    let teks = "";
    const xAwal: number[] = [];
    const xAkhir: number[] = [];
    let akhirSebelum = -Infinity;
    for (const it of dalam) {
      const celah = it.x - akhirSebelum;
      if (teks && celah > 0.18 * (it.tinggi || 10) && !teks.endsWith(" ") && !it.str.startsWith(" ")) {
        teks += " ";
        xAwal.push(akhirSebelum);
        xAkhir.push(it.x);
      }
      const n = it.str.length;
      for (let i = 0; i < n; i += 1) {
        xAwal.push(it.x + (it.lebar * i) / n);
        xAkhir.push(it.x + (it.lebar * (i + 1)) / n);
      }
      teks += it.str;
      akhirSebelum = it.x + it.lebar;
    }
    const tinggi = Math.max(...dalam.map((i) => i.tinggi || 0), 1);
    const ys = dalam.map((i) => i.y).sort((a, b) => a - b);
    return { halaman: dalam[0].halaman, y: ys[Math.floor(ys.length / 2)], tinggi, teks, xAwal, xAkhir, item: dalam };
  });
}

/** Rentang mendatar [xMin, xMax] dari karakter [mulai, akhir) pada `teks` baris. */
function rentangX(b: Baris, mulai: number, akhir: number): [number, number] {
  let xMin = Infinity;
  let xMax = -Infinity;
  for (let i = mulai; i < akhir && i < b.xAwal.length; i += 1) {
    if (b.teks[i] === " ") continue;
    xMin = Math.min(xMin, b.xAwal[i]);
    xMax = Math.max(xMax, b.xAkhir[i]);
  }
  return [xMin, xMax];
}

function padatDenganPeta(teks: string): { padat: string; peta: number[] } {
  const peta: number[] = [];
  let padat = "";
  Array.from(teks).forEach((c, i) => {
    if (hurufAngka(c)) {
      padat += kecil(c);
      peta.push(i);
    }
  });
  return { padat, peta };
}

/** Cadangan pencarian bila nama di PDF terpotong/ber-gelar lain: tanpa gelar (sebelum koma), lalu dua kata inti. */
export function variasiNama(nama: string): Array<{ cara: string; padat: string }> {
  const hasil: Array<{ cara: string; padat: string }> = [];
  const utuh = nama.replace(/\s*\(ketua\)/i, "");
  const tambah = (cara: string, teks: string) => {
    const p = padatkan(teks);
    if (p.length >= 5 && !hasil.some((h) => h.padat === p)) hasil.push({ cara, padat: p });
  };
  tambah("utuh", utuh);
  tambah("tanpa-gelar", utuh.split(",")[0]);
  const inti = utuh
    .split(/[\s,]+/)
    .filter((k) => k.replace(/[^\p{L}]/gu, "").length > 3 && !/\./.test(k))
    .slice(0, 2)
    .join(" ");
  tambah("inti", inti);
  return hasil;
}

/**
 * Mencari baris nama penanda tangan. Yang diambil kemunculan TERAKHIR (blok tanda tangan ada di ujung naskah), dibatasi oleh
 * penanda blok "Untuk Salinan": `sebelumPenanda` (PDF biasa - blok itu putih/tersembunyi dan namanya tidak boleh dibubuhi) atau
 * `sesudahPenanda` (PDF salinan - tanda tangan Panitera di blok itu).
 */
export function cariNamaDiBaris(baris: Baris[], nama: string, opsi: { sebelumPenanda?: boolean; sesudahPenanda?: boolean } = {}): TemuanNama | null {
  let penanda = -1;
  baris.forEach((b, i) => {
    if (padatkan(b.teks).includes("untuksalinan")) penanda = i;
  });
  const daftarIndeks: number[] = [];
  baris.forEach((_b, i) => {
    if (opsi.sebelumPenanda && penanda >= 0 && i >= penanda) return;
    if (opsi.sesudahPenanda && penanda >= 0 && i <= penanda) return;
    daftarIndeks.push(i);
  });
  for (const v of variasiNama(nama)) {
    for (let k = daftarIndeks.length - 1; k >= 0; k -= 1) {
      const i = daftarIndeks[k];
      const { padat, peta } = padatDenganPeta(baris[i].teks);
      const pos = padat.lastIndexOf(v.padat);
      if (pos < 0) continue;
      const awal = peta[pos];
      let akhir = peta[pos + v.padat.length - 1] + 1;
      // Tanda baca yang menempel di ujung nama ("S.H.", "M.H.,") ikut dalam rentang tengah.
      while (akhir < baris[i].teks.length && /[.,;:)\]]/.test(baris[i].teks[akhir])) akhir += 1;
      const [xMin, xMax] = rentangX(baris[i], awal, akhir);
      if (!Number.isFinite(xMin) || !Number.isFinite(xMax)) continue;
      return { indeks: i, halaman: baris[i].halaman, xMin, xMax, y: baris[i].y, tinggi: baris[i].tinggi, cara: v.cara };
    }
  }
  return null;
}

/**
 * Letak gambar (pt, asal kiri-bawah halaman). `rasio` = tinggi/lebar gambar. `sekitar` = potongan teks lain di halaman yang sama
 * (selain baris nama itu sendiri) - dipakai agar gambar tidak menutupi tulisan di atas nama.
 */
export function hitungLetakTtd(p: {
  nama: TemuanNama;
  halaman: UkuranHalaman;
  rasio: number;
  atur: AturTtd;
  sekitar: ItemTeks[];
  /** Pengali ukuran (mis. 1 untuk tanda tangan). */
  skala?: number;
}): Letak {
  const { nama, halaman, atur } = p;
  const lebarMaksMm = atur.lebarTtdMm * (p.skala ?? 1);
  let lebar = lebarMaksMm * PT_PER_MM;
  let tinggi = lebar * p.rasio;
  const tinggiMaksPt = (atur.tinggiTtdMaksMm ?? tinggiTtdMaksMm(atur.lebarTtdMm)) * (p.skala ?? 1) * PT_PER_MM;
  if (tinggi > tinggiMaksPt) {
    lebar = (lebar * tinggiMaksPt) / tinggi;
    tinggi = tinggiMaksPt;
  }
  const lebarAsal = lebar;
  const huruf = nama.tinggi > 0 ? nama.tinggi : 12;
  const puncakNama = nama.y + PUNCAK_HURUF * huruf;
  const tumpang = Math.max(0, Math.min(atur.ttdTurunMm * PT_PER_MM, huruf / 3));
  const bawah = puncakNama - tumpang;
  const pusat = (nama.xMin + nama.xMax) / 2;
  const margin = MARGIN_TEPI_MM * PT_PER_MM;

  // Gambar HARUS rata tengah terhadap nama. Bila terlalu lebar untuk muat di antara margin dengan tengah di tengah nama, gambar DIKECILKAN
  // (rasio tetap) - titik tengahnya tidak digeser. Paling kecil separuh ukuran aturan; baru bila masih tak muat, digeser seminimal mungkin.
  const setengahMuat = Math.max(0, Math.min(pusat - margin, halaman.lebar - margin - pusat));
  const faktorMuat = Math.min(1, (2 * setengahMuat) / lebar);
  let skala = Math.max(SKALA_MIN, faktorMuat);
  lebar *= skala;
  tinggi *= skala;

  // Tulisan lain yang terletak di atas nama dan tumpang tindih mendatar dengan gambar: batas atas yang tersedia.
  let batas = Infinity;
  const kiriPerkiraan = pusat - lebar / 2;
  for (const it of p.sekitar) {
    if (it.halaman !== nama.halaman || !it.str.trim()) continue;
    const dasar = it.y - KAKI_HURUF * (it.tinggi || 10); // tepi bawah tulisan itu
    if (dasar < bawah - 0.5) continue; // di bawah/sebaris dengan batas bawah gambar
    if (it.x + it.lebar < kiriPerkiraan || it.x > kiriPerkiraan + lebar) continue;
    batas = Math.min(batas, dasar);
  }
  let terhimpit = false;
  if (Number.isFinite(batas)) {
    const tersedia = batas - bawah;
    if (tinggi > tersedia) {
      // Batas bawah ukuran berlaku atas ukuran aturan (bukan atas ukuran yang sudah dikecilkan karena margin).
      const f = Math.max(SKALA_MIN / skala, tersedia / tinggi);
      lebar *= f;
      tinggi *= f;
      skala *= f;
      if (tinggi > tersedia + 0.5) terhimpit = true;
    }
  }
  // Tengah tetap di tengah nama; bergeser hanya bila ukuran terkecil pun tak muat di antara margin.
  let kiri = pusat - lebar / 2;
  kiri = Math.max(margin, Math.min(kiri, halaman.lebar - margin - lebar));
  return { kiri, bawah, lebar, tinggi, terhimpit, dikecilkan: Math.round((1 - lebar / lebarAsal) * 100) / 100 };
}

/** Membaca potongan teks berkoordinat dan ukuran halaman dari PDF (pdfjs, tanpa menggambar). */
export async function bacaItemPdf(bita: Uint8Array): Promise<{ halaman: UkuranHalaman[]; item: ItemTeks[] }> {
  pasangRintisanPeramban();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const dokumen = await pdfjs.getDocument({ data: new Uint8Array(bita), useSystemFonts: true, isEvalSupported: false }).promise;
  const halaman: UkuranHalaman[] = [];
  const item: ItemTeks[] = [];
  try {
    for (let n = 1; n <= dokumen.numPages; n += 1) {
      const h = await dokumen.getPage(n);
      const v = h.view as number[];
      halaman.push({ lebar: v[2] - v[0], tinggi: v[3] - v[1] });
      const isi = await h.getTextContent();
      for (const it of (isi.items ?? []) as Array<{ str?: string; transform?: number[]; width?: number; height?: number }>) {
        const t = it.transform;
        if (!it.str || !t || t.length < 6) continue;
        const ukuran = it.height && it.height > 0 ? it.height : Math.abs(t[3]) || Math.hypot(t[2], t[3]) || 10;
        item.push({ str: it.str, x: t[4], y: t[5], lebar: it.width ?? 0, tinggi: ukuran, halaman: n });
      }
    }
  } finally {
    await dokumen.destroy();
  }
  return { halaman, item };
}

function ukuranGambar(bita: Uint8Array): { jenis: "png" | "jpg"; w: number; h: number } | null {
  const b = Buffer.from(bita);
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50) return { jenis: "png", w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i += 1;
        continue;
      }
      const tanda = b[i + 1];
      const panjang = b.readUInt16BE(i + 2);
      if (tanda >= 0xc0 && tanda <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(tanda)) return { jenis: "jpg", w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
      i += 2 + panjang;
    }
  }
  return null;
}

export type TtdMasuk = { nama: string; gambar: Uint8Array; cap?: Uint8Array | null };
export type HasilBubuh = {
  pdf: Uint8Array;
  dipasang: string[];
  tidakDitemukan: string[];
  galat: string;
  geometri: Array<{ nama: string; halaman: number; ttd: Letak; cap: { kiri: number; bawah: number; diameter: number } | null; cara: string }>;
};

/**
 * Membubuhkan tanda tangan (dan cap, bila ada) pada PDF. Tidak melempar karena nama tidak ditemukan - yang tak ditemukan
 * dilaporkan. Metadata PDF tidak diubah (updateMetadata: false) supaya Producer/Creator/tanggal tetap seperti hasil konversi.
 */
export async function bubuhkanTtdPdf(
  bita: Uint8Array,
  daftar: TtdMasuk[],
  opsi: { atur?: Partial<AturTtd>; sebelumPenanda?: boolean; sesudahPenanda?: boolean } = {}
): Promise<HasilBubuh> {
  const atur: AturTtd = {
    lebarTtdMm: UKURAN_TTD_CAP_BAWAAN.lebarTtdMm,
    ttdTurunMm: UKURAN_TTD_CAP_BAWAAN.ttdTurunMm,
    lebarCapMm: UKURAN_TTD_CAP_BAWAAN.diameterCapMm,
    capGeserKiriMm: UKURAN_TTD_CAP_BAWAAN.capGeserKiriMm,
    capGeserAtasMm: UKURAN_TTD_CAP_BAWAAN.capGeserAtasMm,
    opasitasCap: UKURAN_TTD_CAP_BAWAAN.opasitasCap,
    ...(opsi.atur ?? {}),
  };
  const hasil: HasilBubuh = { pdf: bita, dipasang: [], tidakDitemukan: [], galat: "", geometri: [] };
  if (!daftar.length) return hasil;
  try {
    const { halaman, item } = await bacaItemPdf(bita);
    const baris = susunBaris(item);
    const dok = await PDFDocument.load(bita, { updateMetadata: false });
    const halamanPdf = dok.getPages();
    for (const d of daftar) {
      const temuan = cariNamaDiBaris(baris, d.nama, { sebelumPenanda: opsi.sebelumPenanda, sesudahPenanda: opsi.sesudahPenanda });
      const uk = ukuranGambar(d.gambar);
      if (!temuan || !uk || uk.w <= 0 || uk.h <= 0 || !halamanPdf[temuan.halaman - 1]) {
        hasil.tidakDitemukan.push(d.nama);
        continue;
      }
      const sekitar = item.filter((i) => i.halaman === temuan.halaman && !baris[temuan.indeks].item.includes(i));
      const letak = hitungLetakTtd({ nama: temuan, halaman: halaman[temuan.halaman - 1], rasio: uk.h / uk.w, atur, sekitar });
      const pg = halamanPdf[temuan.halaman - 1];
      let geoCap: { kiri: number; bawah: number; diameter: number } | null = null;
      if (d.cap && d.cap.length) {
        const ukCap = ukuranGambar(d.cap);
        if (ukCap && ukCap.w > 0 && ukCap.h > 0) {
          const kotak = (atur.lebarCapMm ?? 36) * PT_PER_MM;
          const lebarCap = ukCap.w >= ukCap.h ? kotak : (kotak * ukCap.w) / ukCap.h;
          const tinggiCap = ukCap.w >= ukCap.h ? (kotak * ukCap.h) / ukCap.w : kotak;
          let px = letak.kiri + letak.lebar / 2 - (atur.capGeserKiriMm ?? 13) * PT_PER_MM;
          const py = letak.bawah + letak.tinggi / 2 + (atur.capGeserAtasMm ?? 4) * PT_PER_MM;
          const margin = MARGIN_TEPI_MM * PT_PER_MM;
          px = Math.max(margin + lebarCap / 2, Math.min(px, halaman[temuan.halaman - 1].lebar - margin - lebarCap / 2));
          const gc = ukCap.jenis === "png" ? await dok.embedPng(d.cap) : await dok.embedJpg(d.cap);
          pg.drawImage(gc, { x: px - lebarCap / 2, y: py - tinggiCap / 2, width: lebarCap, height: tinggiCap, opacity: atur.opasitasCap ?? 0.88 });
          geoCap = { kiri: px - lebarCap / 2, bawah: py - tinggiCap / 2, diameter: kotak };
        }
      }
      const g = uk.jenis === "png" ? await dok.embedPng(d.gambar) : await dok.embedJpg(d.gambar);
      pg.drawImage(g, { x: letak.kiri, y: letak.bawah, width: letak.lebar, height: letak.tinggi });
      hasil.dipasang.push(d.nama);
      hasil.geometri.push({ nama: d.nama, halaman: temuan.halaman, ttd: letak, cap: geoCap, cara: temuan.cara });
    }
    if (hasil.dipasang.length) hasil.pdf = await dok.save({ useObjectStreams: false });
  } catch (e) {
    hasil.pdf = bita;
    hasil.dipasang = [];
    hasil.tidakDitemukan = daftar.map((d) => d.nama);
    hasil.geometri = [];
    hasil.galat = e instanceof Error ? e.message.slice(0, 200) : "PDF tidak dapat diubah";
  }
  return hasil;
}
