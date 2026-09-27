import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

import type { NaskahEvidenSkp, TabelNaskah } from "@/lib/eviden-skp-cetak";
import {
  hitungLebarKolom,
  lebarTeks,
  pecahSel,
  ruangSelTabel,
  siapkanTeksPdf,
  type HurufUkur,
} from "@/server/modules/aleta-ecourt/eviden-skp-ukur";

/**
 * ============================================================================
 * PENGGAMBAR PDF EVIDEN SKP (2.40.0)
 * ============================================================================
 *
 * Menggambar NaskahEvidenSkp ke PDF dengan pdf-lib: kop berlogo dan bergaris
 * ganda, judul, identitas, tabel indikator, tabel rincian yang kepalanya
 * diulang di tiap halaman, catatan, tanda tangan dua pihak, dan "Halaman x
 * dari y" di kaki setiap halaman.
 *
 * Yang dijaga dengan sungguh-sungguh: TIDAK ADA teks tabel yang melewati
 * garis kolomnya. Teks panjang dilipat; kata yang sendirian lebih lebar dari
 * kolomnya dipotong (lihat pecahBaris); baris yang lebih tinggi dari sisa
 * halaman diteruskan ke halaman berikut bersama kepala tabelnya. Setiap teks
 * sel dapat dicatat beserta batas kolomnya (opsi catatUkuran) supaya uji dapat
 * MENGUKURNYA, bukan mempercayainya.
 */

const KERTAS_MENDATAR: Record<"A4" | "F4", [number, number]> = {
  // Titik PostScript: 1 inci = 72 titik. F4 = 215 x 330 mm.
  A4: [841.89, 595.28],
  F4: [935.43, 609.45],
};

const cm = (n: number) => (n / 2.54) * 72;

const HITAM = rgb(0, 0, 0);
const ABU = rgb(0.33, 0.33, 0.33);
const GARIS = rgb(0.25, 0.25, 0.25);
const LATAR_KEPALA = rgb(0.86, 0.9, 0.94);
const LATAR_SELANG = rgb(0.965, 0.973, 0.98);

/** Garis dasar satu baris teks yang puncaknya di `puncak` dan tingginya `tinggi`. */
function garisDasar(puncak: number, tinggi: number, ukuran: number): number {
  return puncak - tinggi / 2 - 0.35 * ukuran;
}

export type TeksSelTercatat = {
  tabel: string;
  halaman: number;
  teks: string;
  x: number;
  y: number;
  lebar: number;
  /** Batas dalam sel (sesudah ruang kiri-kanan). */
  batasKiri: number;
  batasKanan: number;
  /** Garis kolom itu sendiri. */
  garisKiri: number;
  garisKanan: number;
};

export type TataLetakTabelPdf = {
  tabel: string;
  ukuran: number;
  kolom: Array<{ x0: number; x1: number }>;
  halaman: number[];
};

export type HasilPdfEvidenSkp = {
  berkas: Buffer;
  jumlahHalaman: number;
  kertas: "A4" | "F4";
  ukuranHalaman: [number, number];
  /** Huruf yang tidak dapat dicetak huruf baku - ditandai "[?]" dan disebut di catatan. */
  hurufTakTercetak: number;
  tabel: TataLetakTabelPdf[];
  /** Hanya bila opsi catatUkuran. */
  teksSel: TeksSelTercatat[];
};

/** Menghitung huruf yang tidak tercetak di seluruh naskah, sebelum menggambar. */
function hitungTakTercetak(naskah: NaskahEvidenSkp, huruf: HurufUkur): number {
  let n = 0;
  const hitung = (font: PDFFont, teks: string) => {
    n += siapkanTeksPdf(font, teks).hilang;
  };
  for (const b of naskah.kop.baris) hitung(b.tebal ? huruf.tebal : huruf.biasa, b.teks);
  for (const t of [naskah.judul, naskah.subjudul, naskah.judulIndikator, naskah.judulTabel]) hitung(huruf.tebal, t);
  for (const t of [naskah.rentang, naskah.tabelKosong, naskah.kaki, ...naskah.catatan]) hitung(huruf.biasa, t);
  for (const i of naskah.identitas) {
    hitung(huruf.biasa, i.label);
    hitung(i.label === "Nama" ? huruf.tebal : huruf.biasa, i.nilai);
  }
  for (const tabel of [naskah.indikator, naskah.tabel]) {
    if (!tabel) continue;
    for (const k of tabel.kolom) hitung(huruf.tebal, k.judul);
    for (const b of tabel.baris) for (const k of tabel.kolom) hitung(huruf.biasa, b[k.kunci] ?? "");
  }
  for (const blok of [naskah.tandaTangan.kiri, naskah.tandaTangan.kanan]) {
    for (const t of blok.atas) hitung(huruf.biasa, t);
    hitung(blok.namaTerisi ? huruf.tebal : huruf.biasa, blok.nama);
    hitung(huruf.biasa, blok.nip);
  }
  return n;
}

async function sematkanLogo(dok: PDFDocument, logo: Uint8Array | null): Promise<PDFImage | null> {
  if (!logo || logo.length < 8) return null;
  try {
    const png = logo[0] === 0x89 && logo[1] === 0x50 && logo[2] === 0x4e && logo[3] === 0x47;
    return png ? await dok.embedPng(logo) : await dok.embedJpg(logo);
  } catch {
    // Logo yang rusak tidak boleh menggagalkan dokumen - kop tanpa logo tetap
    // kop yang benar isinya.
    return null;
  }
}

export async function gambarPdfEvidenSkp(
  naskahAsli: NaskahEvidenSkp,
  opsi: { catatUkuran?: boolean } = {}
): Promise<HasilPdfEvidenSkp> {
  const dok = await PDFDocument.create();
  const huruf: HurufUkur = {
    biasa: await dok.embedFont(StandardFonts.Helvetica),
    tebal: await dok.embedFont(StandardFonts.HelveticaBold),
  };

  // Huruf yang tidak tercetak dihitung LEBIH DAHULU supaya catatannya dapat
  // ikut tercetak di dokumen yang sama.
  const hurufTakTercetak = hitungTakTercetak(naskahAsli, huruf);
  const naskah: NaskahEvidenSkp =
    hurufTakTercetak > 0
      ? {
          ...naskahAsli,
          catatan: [
            ...naskahAsli.catatan,
            `${hurufTakTercetak} huruf tidak dapat dicetak huruf PDF dan ditandai "[?]" (misalnya huruf Arab). ` +
              "Bunyi utuhnya ada pada versi Word dan Excel dokumen ini.",
          ],
        }
      : naskahAsli;

  const judulPdf = [naskah.judulLengkap, naskah.namaOrang].filter(Boolean).join(" - ");
  dok.setTitle(judulPdf || "Eviden SKP");
  dok.setAuthor("ALETA");
  dok.setSubject("Eviden SKP");
  dok.setCreator("ALETA");
  dok.setProducer("ALETA (pdf-lib)");
  dok.setLanguage("id-ID");
  const saat = new Date(naskah.dihitungPada);
  if (!Number.isNaN(saat.getTime())) {
    dok.setCreationDate(saat);
    dok.setModificationDate(saat);
  }

  const kertas = naskah.tataLetak.kertas;
  const [lebarHal, tinggiHal] = KERTAS_MENDATAR[kertas];
  const m = { atas: cm(1.3), bawah: cm(1.6), kiri: cm(1.5), kanan: cm(1.5) };
  const lebarIsi = lebarHal - m.kiri - m.kanan;
  const kananIsi = lebarHal - m.kanan;

  const semuaHalaman: PDFPage[] = [];
  let halaman = dok.addPage([lebarHal, tinggiHal]);
  semuaHalaman.push(halaman);
  let y = tinggiHal - m.atas;

  const halamanBaru = () => {
    halaman = dok.addPage([lebarHal, tinggiHal]);
    semuaHalaman.push(halaman);
    y = tinggiHal - m.atas;
  };
  const sisaRuang = () => y - m.bawah;

  const teksSel: TeksSelTercatat[] = [];
  const tataLetakTabel: TataLetakTabelPdf[] = [];

  /** Menulis satu baris yang SUDAH disiapkan/dipenggal. */
  const tulis = (teks: string, x: number, dasar: number, font: PDFFont, ukuran: number, warna = HITAM) => {
    if (!teks) return;
    halaman.drawText(teks, { x, y: dasar, size: ukuran, font, color: warna });
  };

  /** Alinea terpusat/rata kiri yang dipenggal dan berpindah halaman bila perlu. */
  const alinea = (
    teks: string,
    font: PDFFont,
    ukuran: number,
    p: { x?: number; lebar?: number; rata?: "kiri" | "tengah"; tinggiBaris?: number; warna?: ReturnType<typeof rgb> } = {}
  ) => {
    const x = p.x ?? m.kiri;
    const lebar = p.lebar ?? lebarIsi;
    const lh = p.tinggiBaris ?? ukuran * 1.3;
    for (const baris of pecahSel(font, teks, ukuran, lebar).baris) {
      if (sisaRuang() < lh) halamanBaru();
      const w = lebarTeks(font, baris, ukuran);
      const bx = p.rata === "tengah" ? x + (lebar - w) / 2 : x;
      tulis(baris, bx, garisDasar(y, lh, ukuran), font, ukuran, p.warna ?? HITAM);
      y -= lh;
    }
  };

  // ==========================================================================
  // KOP
  // ==========================================================================
  const logo = await sematkanLogo(dok, naskah.kop.logo);
  const TINGGI_LOGO = 58;
  const lebarLogo = logo ? (TINGGI_LOGO * logo.width) / logo.height : 0;
  const puncakKop = y;
  if (logo) halaman.drawImage(logo, { x: m.kiri, y: puncakKop - TINGGI_LOGO, width: lebarLogo, height: TINGGI_LOGO });

  // Teks kop terpusat pada HALAMAN, dan dijauhkan dari logo sama lebar di
  // kiri dan kanan - supaya pusatnya tetap pusat halaman.
  const ruangKop = lebarIsi - 2 * (lebarLogo + 14);
  const barisKop: Array<{ teks: string; font: PDFFont; ukuran: number }> = [];
  for (const b of naskah.kop.baris) {
    const font = b.tebal ? huruf.tebal : huruf.biasa;
    for (const t of pecahSel(font, b.teks, b.ukuran, ruangKop).baris) barisKop.push({ teks: t, font, ukuran: b.ukuran });
  }
  const tinggiTeksKop = barisKop.reduce((j, b) => j + b.ukuran * 1.24, 0);
  const tinggiKop = Math.max(logo ? TINGGI_LOGO : 0, tinggiTeksKop);
  let yKop = puncakKop - (tinggiKop - tinggiTeksKop) / 2;
  for (const b of barisKop) {
    const lh = b.ukuran * 1.24;
    const w = lebarTeks(b.font, b.teks, b.ukuran);
    tulis(b.teks, m.kiri + (lebarIsi - w) / 2, garisDasar(yKop, lh, b.ukuran), b.font, b.ukuran);
    yKop -= lh;
  }
  // Garis ganda kop: tebal di atas, tipis di bawah.
  const yGaris = puncakKop - tinggiKop - 5;
  halaman.drawLine({ start: { x: m.kiri, y: yGaris }, end: { x: kananIsi, y: yGaris }, thickness: 1.8, color: HITAM });
  halaman.drawLine({ start: { x: m.kiri, y: yGaris - 2.9 }, end: { x: kananIsi, y: yGaris - 2.9 }, thickness: 0.6, color: HITAM });
  y = yGaris - 2.9 - 14;

  // ==========================================================================
  // JUDUL
  // ==========================================================================
  alinea(naskah.judul, huruf.tebal, 13, { rata: "tengah", tinggiBaris: 16.5 });
  if (naskah.subjudul) alinea(naskah.subjudul, huruf.tebal, 11, { rata: "tengah", tinggiBaris: 14 });
  if (naskah.rentang) alinea(naskah.rentang, huruf.biasa, 9, { rata: "tengah", tinggiBaris: 12, warna: ABU });
  y -= 8;

  // ==========================================================================
  // IDENTITAS
  // ==========================================================================
  const UK_ID = 9.5;
  const LH_ID = 12.6;
  const lebarLabel = Math.max(...naskah.identitas.map((i) => lebarTeks(huruf.biasa, siapkanTeksPdf(huruf.biasa, i.label).teks, UK_ID))) + 6;
  const xTitikDua = m.kiri + lebarLabel;
  const xNilai = xTitikDua + 9;
  const lebarNilai = kananIsi - xNilai;
  for (const baris of naskah.identitas) {
    const font = baris.label === "Nama" ? huruf.tebal : huruf.biasa;
    const pecahan = pecahSel(font, baris.nilai, UK_ID, lebarNilai).baris;
    if (sisaRuang() < LH_ID * Math.min(pecahan.length, 3)) halamanBaru();
    const label = pecahSel(huruf.biasa, baris.label, UK_ID, lebarLabel).baris[0] ?? "";
    tulis(label, m.kiri, garisDasar(y, LH_ID, UK_ID), huruf.biasa, UK_ID);
    tulis(":", xTitikDua, garisDasar(y, LH_ID, UK_ID), huruf.biasa, UK_ID);
    pecahan.forEach((t, i) => {
      if (i > 0 && sisaRuang() < LH_ID) halamanBaru();
      tulis(t, xNilai, garisDasar(y, LH_ID, UK_ID), font, UK_ID);
      y -= LH_ID;
    });
  }
  y -= 8;

  // ==========================================================================
  // TABEL
  // ==========================================================================
  const TINGGI_JUDUL_BAGIAN = 16;
  const judulBagian = (teks: string, ruangBerikut: number) => {
    // Judul bagian tidak boleh tertinggal sendirian di dasar halaman.
    if (sisaRuang() < TINGGI_JUDUL_BAGIAN + ruangBerikut) halamanBaru();
    alinea(teks, huruf.tebal, 10, { tinggiBaris: TINGGI_JUDUL_BAGIAN - 2 });
    y -= 2;
  };

  const gambarTabel = (
    nama: string,
    judul: string,
    tabel: TabelNaskah,
    ukuran: number,
    p: { selang: boolean; kosong: string }
  ) => {
    // Tabel tanpa kolom tidak digambar sama sekali, juga judulnya - bukan
    // kotak kosong setinggi -Infinity.
    if (tabel.kolom.length === 0) return;
    const RUANG = ruangSelTabel(tabel.kolom.length);
    const PAD_V = 1.9;
    const lh = ukuran * 1.22;
    const lebar = hitungLebarKolom({
      kolom: tabel.kolom,
      baris: tabel.baris,
      lebarTersedia: lebarIsi,
      ukuran,
      huruf,
      ruang: 2 * RUANG,
    });
    const x0: number[] = [];
    let akum = m.kiri;
    for (const w of lebar) {
      x0.push(akum);
      akum += w;
    }
    const tata: TataLetakTabelPdf = {
      tabel: nama,
      ukuran,
      kolom: lebar.map((w, i) => ({ x0: x0[i], x1: x0[i] + w })),
      halaman: [],
    };
    tataLetakTabel.push(tata);
    const catatHalaman = () => {
      const nomor = semuaHalaman.length;
      if (!tata.halaman.includes(nomor)) tata.halaman.push(nomor);
    };

    const rataSel = (i: number): "kiri" | "tengah" | "kanan" => tabel.kolom[i]?.rata ?? "kiri";
    const tulisSel = (
      i: number,
      teks: string,
      puncak: number,
      font: PDFFont,
      rata: "kiri" | "tengah" | "kanan"
    ) => {
      const kiri = x0[i] + RUANG;
      const kanan = x0[i] + lebar[i] - RUANG;
      const w = lebarTeks(font, teks, ukuran);
      const x = rata === "tengah" ? kiri + (kanan - kiri - w) / 2 : rata === "kanan" ? kanan - w : kiri;
      const dasar = garisDasar(puncak, lh, ukuran);
      tulis(teks, x, dasar, font, ukuran);
      if (opsi.catatUkuran && teks) {
        teksSel.push({
          tabel: nama,
          halaman: semuaHalaman.length,
          teks,
          x,
          y: dasar,
          lebar: w,
          batasKiri: kiri,
          batasKanan: kanan,
          garisKiri: x0[i],
          garisKanan: x0[i] + lebar[i],
        });
      }
    };

    const kepala = tabel.kolom.map((k, i) => pecahSel(huruf.tebal, k.judul, ukuran, lebar[i] - 2 * RUANG).baris);
    const tinggiKepala = Math.max(...kepala.map((b) => b.length)) * lh + 2 * PAD_V;
    const gambarKepala = () => {
      catatHalaman();
      for (let i = 0; i < lebar.length; i += 1) {
        halaman.drawRectangle({
          x: x0[i],
          y: y - tinggiKepala,
          width: lebar[i],
          height: tinggiKepala,
          color: LATAR_KEPALA,
          borderColor: GARIS,
          borderWidth: 0.5,
        });
        // Kepala dipusatkan tegak: kolom yang judulnya sebaris tidak menempel
        // di atas sementara tetangganya tiga baris.
        const geser = ((Math.max(...kepala.map((b) => b.length)) - kepala[i].length) * lh) / 2;
        kepala[i].forEach((t, j) => tulisSel(i, t, y - PAD_V - geser - j * lh, huruf.tebal, "tengah"));
      }
      y -= tinggiKepala;
    };

    const isi = tabel.baris.map((b) => tabel.kolom.map((k, i) => pecahSel(huruf.biasa, b[k.kunci] ?? "", ukuran, lebar[i] - 2 * RUANG).baris));
    const tinggiBaris = (sel: string[][], dari: number[]) =>
      Math.max(1, ...sel.map((b, i) => b.length - dari[i])) * lh + 2 * PAD_V;
    const ruangHalamanPenuh = tinggiHal - m.atas - m.bawah - tinggiKepala;

    // Judul bagian, kepala tabel, dan awal baris pertama selalu sehalaman.
    const pertama = isi[0] ? tinggiBaris(isi[0], isi[0].map(() => 0)) : lh + 2 * PAD_V;
    judulBagian(judul, tinggiKepala + Math.min(pertama, lh * 4 + 2 * PAD_V));
    gambarKepala();

    if (isi.length === 0) {
      const tinggi = lh + 2 * PAD_V;
      halaman.drawRectangle({ x: m.kiri, y: y - tinggi, width: lebarIsi, height: tinggi, borderColor: GARIS, borderWidth: 0.5 });
      const w = lebarTeks(huruf.biasa, p.kosong, ukuran);
      tulis(p.kosong, m.kiri + (lebarIsi - w) / 2, garisDasar(y - PAD_V, lh, ukuran), huruf.biasa, ukuran, ABU);
      y -= tinggi;
      return;
    }

    isi.forEach((sel, r) => {
      const dari = sel.map(() => 0);
      let mulai = false;
      let halamanSegar = false;
      for (;;) {
        const tinggiSisa = tinggiBaris(sel, dari);
        let muatBaris: number;
        if (tinggiSisa <= sisaRuang()) {
          muatBaris = Math.max(...sel.map((b, i) => b.length - dari[i]));
        } else if (!mulai && !halamanSegar && tinggiSisa <= ruangHalamanPenuh) {
          // Baris yang muat utuh di halaman baru dipindah utuh - tidak dibelah.
          halamanBaru();
          gambarKepala();
          halamanSegar = true;
          continue;
        } else {
          muatBaris = Math.floor((sisaRuang() - 2 * PAD_V) / lh);
          if (muatBaris < 1 && !halamanSegar) {
            halamanBaru();
            gambarKepala();
            halamanSegar = true;
            continue;
          }
          // Halaman baru yang kepalanya saja sudah hampir penuh tetap diberi
          // satu baris - tanpa ini perulangan tidak pernah berhenti.
          muatBaris = Math.max(1, muatBaris);
        }
        halamanSegar = false;

        const tinggi = Math.max(1, muatBaris) * lh + 2 * PAD_V;
        for (let i = 0; i < lebar.length; i += 1) {
          halaman.drawRectangle({
            x: x0[i],
            y: y - tinggi,
            width: lebar[i],
            height: tinggi,
            ...(p.selang && r % 2 === 1 ? { color: LATAR_SELANG } : {}),
            borderColor: GARIS,
            borderWidth: 0.5,
          });
          const potongan = sel[i].slice(dari[i], dari[i] + muatBaris);
          potongan.forEach((t, j) => tulisSel(i, t, y - PAD_V - j * lh, huruf.biasa, rataSel(i)));
          dari[i] += potongan.length;
        }
        y -= tinggi;
        catatHalaman();
        mulai = true;
        if (sel.every((b, i) => dari[i] >= b.length)) break;
        halamanBaru();
        gambarKepala();
        halamanSegar = true;
      }
    });
  };

  if (naskah.indikator) {
    gambarTabel("indikator", naskah.judulIndikator, naskah.indikator, 8.5, { selang: false, kosong: naskah.tabelKosong });
    y -= 12;
  }
  gambarTabel("rincian", naskah.judulTabel, naskah.tabel, naskah.tataLetak.ukuranTabel, {
    selang: true,
    kosong: naskah.tabelKosong,
  });
  y -= 12;

  // ==========================================================================
  // CATATAN
  // ==========================================================================
  if (naskah.catatan.length > 0) {
    judulBagian("Catatan:", 14);
    const UK_C = 8.5;
    const LH_C = 11;
    const jorok = 14;
    naskah.catatan.forEach((c, i) => {
      const pecahan = pecahSel(huruf.biasa, c, UK_C, lebarIsi - jorok).baris;
      pecahan.forEach((t, j) => {
        if (sisaRuang() < LH_C) halamanBaru();
        if (j === 0) tulis(`${i + 1}.`, m.kiri, garisDasar(y, LH_C, UK_C), huruf.biasa, UK_C);
        tulis(t, m.kiri + jorok, garisDasar(y, LH_C, UK_C), huruf.biasa, UK_C);
        y -= LH_C;
      });
    });
  }

  // ==========================================================================
  // TANDA TANGAN - kiri orang yang membuat, kanan Ketua yang mengetahui
  // ==========================================================================
  const UK_T = 10;
  const LH_T = 13.5;
  const RUANG_TTD = 58;
  const lebarBlok = lebarIsi * 0.38;
  const xBlokKiri = m.kiri + lebarIsi * 0.03;
  const xBlokKanan = m.kiri + lebarIsi * 0.59;
  const { kiri: ttdKiri, kanan: ttdKanan } = naskah.tandaTangan;
  const pecahBlok = (baris: string[], font: PDFFont) =>
    baris.flatMap((t) => (t ? pecahSel(font, t, UK_T, lebarBlok).baris : [""]));
  // Nama dan NIP yang panjang DILIPAT, tidak dipotong - nama yang terpotong
  // di bawah tanda tangan bukan nama orang itu lagi.
  const bagianTtd = (blok: typeof ttdKiri) => ({
    atas: pecahBlok(blok.atas, huruf.biasa),
    nama: pecahBlok([blok.nama], blok.namaTerisi ? huruf.tebal : huruf.biasa),
    nip: pecahBlok([blok.nip], huruf.biasa),
  });
  const bKiri = bagianTtd(ttdKiri);
  const bKanan = bagianTtd(ttdKanan);
  // Baris yang lebih sedikit ditambah baris kosong di ATAS, supaya nama
  // kedua pihak tetap sebaris.
  while (bKiri.atas.length < bKanan.atas.length) bKiri.atas.unshift("");
  while (bKanan.atas.length < bKiri.atas.length) bKanan.atas.unshift("");
  const barisNama = Math.max(bKiri.nama.length, bKanan.nama.length);
  const barisNip = Math.max(bKiri.nip.length, bKanan.nip.length);
  const tinggiTtd = 14 + (bKiri.atas.length + barisNama + barisNip) * LH_T + RUANG_TTD;
  // Blok tanda tangan tidak pernah terbelah: nama tanpa jabatannya di
  // halaman berikut tidak dapat ditandatangani.
  if (sisaRuang() < tinggiTtd) halamanBaru();
  y -= 14;

  const tulisTengahBlok = (teks: string, xBlok: number, font: PDFFont, garisBawah = false) => {
    if (!teks) return;
    const w = lebarTeks(font, teks, UK_T);
    const x = xBlok + (lebarBlok - w) / 2;
    const dasar = garisDasar(y, LH_T, UK_T);
    tulis(teks, x, dasar, font, UK_T);
    if (garisBawah) {
      halaman.drawLine({ start: { x, y: dasar - 1.6 }, end: { x: x + w, y: dasar - 1.6 }, thickness: 0.6, color: HITAM });
    }
  };
  const tulisDuaBlok = (kiri: string[], kanan: string[], jumlah: number, font: [PDFFont, PDFFont], garis: [boolean, boolean]) => {
    for (let i = 0; i < jumlah; i += 1) {
      tulisTengahBlok(kiri[i] ?? "", xBlokKiri, font[0], garis[0]);
      tulisTengahBlok(kanan[i] ?? "", xBlokKanan, font[1], garis[1]);
      y -= LH_T;
    }
  };

  tulisDuaBlok(bKiri.atas, bKanan.atas, bKiri.atas.length, [huruf.biasa, huruf.biasa], [false, false]);
  y -= RUANG_TTD;
  tulisDuaBlok(
    bKiri.nama,
    bKanan.nama,
    barisNama,
    [ttdKiri.namaTerisi ? huruf.tebal : huruf.biasa, ttdKanan.namaTerisi ? huruf.tebal : huruf.biasa],
    [ttdKiri.namaTerisi, ttdKanan.namaTerisi]
  );
  tulisDuaBlok(bKiri.nip, bKanan.nip, barisNip, [huruf.biasa, huruf.biasa], [false, false]);

  // ==========================================================================
  // KAKI HALAMAN - "Halaman x dari y"
  // ==========================================================================
  const jumlahHalaman = semuaHalaman.length;
  const UK_K = 7.5;
  const yKaki = cm(0.75);
  semuaHalaman.forEach((hal, i) => {
    halaman = hal;
    const nomor = `Halaman ${i + 1} dari ${jumlahHalaman}`;
    const wNomor = lebarTeks(huruf.biasa, nomor, UK_K);
    tulis(nomor, kananIsi - wNomor, yKaki, huruf.biasa, UK_K, ABU);
    const kaki = pecahSel(huruf.biasa, naskah.kaki, UK_K, lebarIsi - wNomor - 24).baris;
    tulis(kaki.length > 1 ? `${kaki[0]}…` : (kaki[0] ?? ""), m.kiri, yKaki, huruf.biasa, UK_K, ABU);
    hal.drawLine({
      start: { x: m.kiri, y: yKaki + UK_K + 2.5 },
      end: { x: kananIsi, y: yKaki + UK_K + 2.5 },
      thickness: 0.4,
      color: rgb(0.7, 0.7, 0.7),
    });
  });

  const bita = await dok.save();
  return {
    berkas: Buffer.from(bita),
    jumlahHalaman,
    kertas,
    ukuranHalaman: [lebarHal, tinggiHal],
    hurufTakTercetak,
    tabel: tataLetakTabel,
    teksSel,
  };
}
