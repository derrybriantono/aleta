import type { PDFFont } from "pdf-lib";

import type { NaskahEvidenSkp, TabelNaskah } from "@/lib/eviden-skp-cetak";
import {
  hitungLebarKolom,
  hurufUkur,
  pecahSel,
  ruangSelTabel,
  ukurTeks,
  type HurufUkur,
} from "@/server/modules/aleta-ecourt/eviden-skp-ukur";
import {
  createXlsxWorkbook,
  xlsxRangeRef,
  type XlsxCellStyle,
  type XlsxFreeRow,
  type XlsxImage,
} from "@/server/shared/xlsx";

/**
 * ============================================================================
 * PENGGAMBAR EXCEL EVIDEN SKP (2.40.0)
 * ============================================================================
 *
 * Satu lembar yang dapat DICETAK seperti PDF-nya: kop berlogo dengan garis
 * ganda, judul, identitas, tabel indikator, tabel rincian (baris kepalanya
 * diulang tiap halaman cetak), catatan, dan dua blok tanda tangan.
 *
 * ============================================================================
 * SATU KISI UNTUK DUA TABEL
 * ============================================================================
 *
 * Excel hanya punya satu deret kolom. Kolom tabel rincian menjadi kisi
 * lembarnya - lebarnya dihitung sama dengan PDF - dan tabel indikator (empat
 * kolom) memakai sel gabung di atas kisi itu, dengan batas kolom yang
 * dijatuhkan ke garis kisi terdekat. Bila rincian kurang dari empat kolom,
 * kisinya gabungan batas kedua tabel.
 *
 * ============================================================================
 * TINGGI BARIS DIHITUNG, TIDAK DISERAHKAN KE EXCEL
 * ============================================================================
 *
 * Excel tidak menyesuaikan tinggi baris berteks lipat saat berkas dibuka - dan
 * tidak pernah untuk sel gabung. Tanpa tinggi yang ditulis, nama pihak yang
 * dilipat tiga baris tampil satu baris dan sisanya tersembunyi. Tinggi tiap
 * baris karena itu dihitung dengan ukuran huruf yang sama (Arial = Helvetica)
 * dan sedikit lebih longgar.
 */

const LEBAR_ISI: Record<"A4" | "F4", number> = {
  // Lebar kertas mendatar dikurangi margin kiri-kanan 1,5 cm, dalam titik.
  A4: 841.89 - 2 * ((1.5 / 2.54) * 72),
  F4: 935.43 - 2 * ((1.5 / 2.54) * 72),
};

const HURUF = "Arial";
const RUANG = 2.6;
const TINGGI_LOGO = 58;

/** Titik ke satuan lebar kolom Excel (lebar angka Calibri 11 = 7 piksel). */
function titikKeLebarExcel(pt: number): number {
  const piksel = (pt * 96) / 72;
  return Math.max(0.5, (piksel - 5) / 7);
}

function kumulatif(lebar: number[]): number[] {
  const hasil = [0];
  for (const w of lebar) hasil.push(hasil[hasil.length - 1] + w);
  return hasil;
}

/** Batas di antara dua deret batas - yang berjarak < 1 titik dianggap satu. */
function gabungBatas(a: number[], b: number[]): number[] {
  const semua = [...a, ...b].sort((x, y) => x - y);
  const hasil: number[] = [];
  for (const x of semua) if (hasil.length === 0 || x - hasil[hasil.length - 1] >= 1) hasil.push(x);
  return hasil;
}

/**
 * Menjatuhkan batas dalam yang diinginkan ke garis kisi terdekat, dengan
 * tiap bagian sekurang-kurangnya satu kolom kisi.
 */
function jatuhkanBatas(kisi: number[], diinginkan: number[]): number[] {
  const G = kisi.length - 1;
  const k = diinginkan.length + 1;
  const hasil: number[] = [0];
  for (let j = 0; j < diinginkan.length; j += 1) {
    const bawah = hasil[hasil.length - 1] + 1;
    const atas = G - (k - 1 - j);
    let terbaik = bawah;
    for (let i = bawah; i <= atas; i += 1) {
      if (Math.abs(kisi[i] - diinginkan[j]) < Math.abs(kisi[terbaik] - diinginkan[j])) terbaik = i;
    }
    hasil.push(Math.min(Math.max(terbaik, bawah), atas));
  }
  hasil.push(G);
  return hasil;
}

/** Tinggi baris (titik) untuk teks yang dilipat selebar `lebar` titik. */
function tinggiTeks(huruf: PDFFont, teks: string, ukuran: number, lebar: number): number {
  // Excel menggambar sedikit lebih lebar daripada ukuran Helvetica dan
  // menyisakan ruang tepi sel; keduanya dibayar di muka supaya teks tidak
  // pernah terpotong.
  const baris = pecahSel(huruf, teks, ukuran, Math.max(4, (lebar - 2 * RUANG) / 1.05)).baris.length;
  return baris * ukuran * 1.32 + 3;
}

export async function gambarXlsxEvidenSkp(naskah: NaskahEvidenSkp): Promise<Buffer> {
  const huruf: HurufUkur = await hurufUkur();
  const kertas = naskah.tataLetak.kertas;
  const W = LEBAR_ISI[kertas];
  const ukT = naskah.tataLetak.ukuranTabel;
  const UK_IND = 8.5;

  // --------------------------------------------------------------------------
  // Kisi kolom
  // --------------------------------------------------------------------------
  // Lebar dihitung dengan ruang sel yang sama dengan PDF/Word, supaya ketiga
  // format berkolom sama.
  const lebarRincian =
    naskah.tabel.kolom.length > 0
      ? hitungLebarKolom({
          kolom: naskah.tabel.kolom,
          baris: naskah.tabel.baris,
          lebarTersedia: W,
          ukuran: ukT,
          huruf,
          ruang: 2 * ruangSelTabel(naskah.tabel.kolom.length),
        })
      : [W / 4, W / 4, W / 4, W / 4];
  const lebarIndikator = naskah.indikator
    ? hitungLebarKolom({
        kolom: naskah.indikator.kolom,
        baris: naskah.indikator.baris,
        lebarTersedia: W,
        ukuran: UK_IND,
        huruf,
        ruang: 2 * ruangSelTabel(naskah.indikator.kolom.length),
      })
    : [];
  const batasRincian = kumulatif(lebarRincian);
  let kisi = lebarRincian.length >= 4 || !naskah.indikator ? batasRincian : gabungBatas(batasRincian, kumulatif(lebarIndikator));
  // Kisi kurang dari empat kolom tidak dapat memuat dua blok tanda tangan
  // yang terpisah - dipecah pada garis seperempat halaman.
  if (kisi.length - 1 < 4) kisi = gabungBatas(kisi, [0, W * 0.25, W * 0.5, W * 0.75, W]);
  const G = kisi.length - 1;
  const lebarKisi = kisi.slice(1).map((x, i) => x - kisi[i]);
  const lebarRentang = (c1: number, c2: number) => kisi[c2] - kisi[c1];
  /** Indeks garis kisi terdekat dari posisi x titik, dijepit ke [dari, sampai]. */
  const garisTerdekat = (x: number, dari = 0, sampai = G) => {
    let terbaik = dari;
    for (let i = dari; i <= sampai; i += 1) if (Math.abs(kisi[i] - x) < Math.abs(kisi[terbaik] - x)) terbaik = i;
    return terbaik;
  };
  /** Kolom kisi untuk tiap kolom rincian: [awal, akhir) */
  const rentangRincian = batasRincian.slice(0, -1).map((x, i) => [garisTerdekat(x), garisTerdekat(batasRincian[i + 1])] as const);
  const batasInd = naskah.indikator ? jatuhkanBatas(kisi, kumulatif(lebarIndikator).slice(1, -1)) : [];

  // --------------------------------------------------------------------------
  // Penulis baris
  // --------------------------------------------------------------------------
  const rows: XlsxFreeRow[] = [];
  const merges: string[] = [];
  const barisBaru = (tinggi?: number) => {
    rows.push({ height: tinggi, cells: [] });
    return rows.length - 1;
  };
  /** Menulis satu sel gabung [c1, c2) dan mencatat gabungannya. */
  const tulis = (r: number, c1: number, c2: number, nilai: string, gaya: XlsxCellStyle) => {
    rows[r].cells[c1] = { value: nilai, style: gaya };
    if (c2 - 1 > c1) merges.push(xlsxRangeRef(r, c1, r, c2 - 1));
  };
  const tinggikan = (r: number, tinggi: number) => {
    rows[r].height = Math.max(rows[r].height ?? 0, Math.round(tinggi * 100) / 100);
  };
  const gaya = (g: XlsxCellStyle): XlsxCellStyle => ({ fontName: HURUF, fontSize: 10, vertical: "top", wrap: true, ...g });

  // --------------------------------------------------------------------------
  // Kop
  // --------------------------------------------------------------------------
  const images: XlsxImage[] = [];
  let lebarLogo = 0;
  if (naskah.kop.logo && naskah.kop.logo.length > 24) {
    const data = Buffer.from(naskah.kop.logo);
    if (data.readUInt32BE(0) === 0x89504e47) {
      const lebarPx = data.readUInt32BE(16);
      const tinggiPx = data.readUInt32BE(20);
      if (lebarPx > 0 && tinggiPx > 0) {
        lebarLogo = (TINGGI_LOGO * lebarPx) / tinggiPx;
        images.push({ data, row: 0, column: 0, widthPt: lebarLogo, heightPt: TINGGI_LOGO, offsetXPt: 2, offsetYPt: 2, description: "Logo Mahkamah Agung" });
      }
    }
  }
  // Teks kop di antara dua zona logo yang sama lebar, supaya pusatnya tetap
  // pusat halaman dan tidak menimpa logonya.
  const zona = lebarLogo > 0 ? lebarLogo + 14 : 0;
  let kopAwal = zona > 0 ? garisTerdekat(zona, 0, G - 1) : 0;
  if (kisi[kopAwal] < zona && kopAwal < G - 1) kopAwal += 1;
  let kopAkhir = zona > 0 ? garisTerdekat(W - zona, kopAwal + 1, G) : G;
  if (kisi[kopAkhir] > W - zona && kopAkhir > kopAwal + 1) kopAkhir -= 1;
  const barisKop = naskah.kop.baris.length > 0 ? naskah.kop.baris : [{ teks: "", tebal: false, ukuran: 10 }];
  const awalKop = rows.length;
  let tinggiKop = 0;
  for (const b of barisKop) {
    const font = b.tebal ? huruf.tebal : huruf.biasa;
    const r = barisBaru();
    tulis(r, kopAwal, kopAkhir, b.teks, gaya({ bold: b.tebal, fontSize: b.ukuran, horizontal: "center", vertical: "center" }));
    const t = tinggiTeks(font, b.teks, b.ukuran, lebarRentang(kopAwal, kopAkhir));
    tinggikan(r, t);
    tinggiKop += t;
  }
  // Baris kop ditinggikan merata sampai setinggi logonya.
  if (tinggiKop < TINGGI_LOGO + 6) {
    const tambah = (TINGGI_LOGO + 6 - tinggiKop) / barisKop.length;
    for (let r = awalKop; r < rows.length; r += 1) tinggikan(r, (rows[r].height ?? 0) + tambah);
  }
  // Garis ganda di bawah kop, selebar halaman.
  const rGaris = barisBaru(4);
  tulis(rGaris, 0, G, "", { borderBottom: "double" });
  barisBaru(10);

  // --------------------------------------------------------------------------
  // Judul
  // --------------------------------------------------------------------------
  const judulBaris = (teks: string, g: XlsxCellStyle, ukuran: number, tebal: boolean) => {
    const r = barisBaru();
    tulis(r, 0, G, teks, gaya({ ...g, fontSize: ukuran, bold: tebal, horizontal: "center" }));
    tinggikan(r, tinggiTeks(tebal ? huruf.tebal : huruf.biasa, teks, ukuran, W));
  };
  judulBaris(naskah.judul, {}, 13, true);
  if (naskah.subjudul) judulBaris(naskah.subjudul, {}, 11, true);
  if (naskah.rentang) judulBaris(naskah.rentang, { color: "555555" }, 9, false);
  barisBaru(8);

  // --------------------------------------------------------------------------
  // Identitas
  // --------------------------------------------------------------------------
  const UK_ID = 9.5;
  const lebarLabel = Math.max(...naskah.identitas.map((i) => ukurTeks(huruf.biasa, i.label, UK_ID))) + 14;
  const cLabel = Math.min(Math.max(1, garisTerdekat(lebarLabel)), G - 1);
  for (const baris of naskah.identitas) {
    const r = barisBaru();
    const tebal = baris.label === "Nama";
    tulis(r, 0, cLabel, baris.label, gaya({ fontSize: UK_ID }));
    tulis(r, cLabel, G, `: ${baris.nilai}`, gaya({ fontSize: UK_ID, bold: tebal }));
    tinggikan(
      r,
      Math.max(
        tinggiTeks(huruf.biasa, baris.label, UK_ID, lebarRentang(0, cLabel)),
        tinggiTeks(tebal ? huruf.tebal : huruf.biasa, `: ${baris.nilai}`, UK_ID, lebarRentang(cLabel, G))
      )
    );
  }
  barisBaru(8);

  // --------------------------------------------------------------------------
  // Tabel
  // --------------------------------------------------------------------------
  const judulBagian = (teks: string) => {
    const r = barisBaru();
    tulis(r, 0, G, teks, gaya({ bold: true, fontSize: 10 }));
    tinggikan(r, tinggiTeks(huruf.tebal, teks, 10, W));
  };
  const RATA: Record<string, XlsxCellStyle["horizontal"]> = { kiri: "left", tengah: "center", kanan: "right" };

  const gambarTabel = (
    tabel: TabelNaskah,
    rentang: Array<readonly [number, number]>,
    ukuran: number,
    p: { selang: boolean; kosong: string }
  ): number => {
    const rKepala = barisBaru();
    tabel.kolom.forEach((k, i) => {
      const [c1, c2] = rentang[i];
      tulis(rKepala, c1, c2, k.judul, gaya({ bold: true, fontSize: ukuran, fill: "DCE6F0", border: "thin", horizontal: "center", vertical: "center" }));
      tinggikan(rKepala, tinggiTeks(huruf.tebal, k.judul, ukuran, lebarRentang(c1, c2)));
    });
    if (tabel.baris.length === 0) {
      const r = barisBaru();
      tulis(r, 0, G, p.kosong, gaya({ fontSize: ukuran, border: "thin", horizontal: "center", color: "555555" }));
      tinggikan(r, tinggiTeks(huruf.biasa, p.kosong, ukuran, W));
      return rKepala;
    }
    tabel.baris.forEach((b, nomor) => {
      const r = barisBaru();
      tabel.kolom.forEach((k, i) => {
        const [c1, c2] = rentang[i];
        const teks = b[k.kunci] ?? "";
        tulis(
          r,
          c1,
          c2,
          teks,
          gaya({
            fontSize: ukuran,
            border: "thin",
            horizontal: RATA[k.rata ?? "kiri"] ?? "left",
            ...(p.selang && nomor % 2 === 1 ? { fill: "F6F8FA" } : {}),
          })
        );
        tinggikan(r, tinggiTeks(huruf.biasa, teks, ukuran, lebarRentang(c1, c2)));
      });
    });
    return rKepala;
  };

  if (naskah.indikator) {
    judulBagian(naskah.judulIndikator);
    const rentangInd = naskah.indikator.kolom.map((_, i) => [batasInd[i], batasInd[i + 1]] as const);
    gambarTabel(naskah.indikator, rentangInd, UK_IND, { selang: false, kosong: naskah.tabelKosong });
    barisBaru(10);
  }
  // Tabel tanpa kolom tidak ditulis, juga judulnya dan baris kepala cetaknya.
  let rKepalaRincian: number | null = null;
  if (naskah.tabel.kolom.length > 0) {
    judulBagian(naskah.judulTabel);
    rKepalaRincian = gambarTabel(naskah.tabel, rentangRincian, ukT, { selang: true, kosong: naskah.tabelKosong });
    barisBaru(10);
  }

  // --------------------------------------------------------------------------
  // Catatan
  // --------------------------------------------------------------------------
  if (naskah.catatan.length > 0) {
    const r = barisBaru();
    tulis(r, 0, G, "Catatan:", gaya({ bold: true, fontSize: 9 }));
    tinggikan(r, tinggiTeks(huruf.tebal, "Catatan:", 9, W));
    naskah.catatan.forEach((c, i) => {
      const teks = `${i + 1}. ${c}`;
      const rc = barisBaru();
      tulis(rc, 0, G, teks, gaya({ fontSize: 8.5 }));
      tinggikan(rc, tinggiTeks(huruf.biasa, teks, 8.5, W));
    });
  }
  barisBaru(14);

  // --------------------------------------------------------------------------
  // Tanda tangan
  // --------------------------------------------------------------------------
  const UK_T = 10;
  const kiriAwal = garisTerdekat(W * 0.03, 0, G - 1);
  const kiriAkhir = Math.max(kiriAwal + 1, garisTerdekat(W * 0.41, kiriAwal + 1, G));
  const kananAwal = Math.min(Math.max(kiriAkhir, garisTerdekat(W * 0.59, 0, G - 1)), G - 1);
  const kananAkhir = Math.max(kananAwal + 1, garisTerdekat(W * 0.97, kananAwal + 1, G));
  const { kiri, kanan } = naskah.tandaTangan;
  const tulisDua = (teksKiri: string, teksKanan: string, g: [XlsxCellStyle, XlsxCellStyle], tinggiMin = 0) => {
    const r = barisBaru();
    const gk = gaya({ fontSize: UK_T, horizontal: "center", ...g[0] });
    const gn = gaya({ fontSize: UK_T, horizontal: "center", ...g[1] });
    tulis(r, kiriAwal, kiriAkhir, teksKiri, gk);
    if (kananAwal >= kiriAkhir) tulis(r, kananAwal, kananAkhir, teksKanan, gn);
    tinggikan(
      r,
      Math.max(
        tinggiMin,
        tinggiTeks(gk.bold ? huruf.tebal : huruf.biasa, teksKiri, UK_T, lebarRentang(kiriAwal, kiriAkhir)),
        tinggiTeks(gn.bold ? huruf.tebal : huruf.biasa, teksKanan, UK_T, lebarRentang(kananAwal, kananAkhir))
      )
    );
  };
  const jumlahAtas = Math.max(kiri.atas.length, kanan.atas.length);
  const atasKiri = [...Array(jumlahAtas - kiri.atas.length).fill(""), ...kiri.atas];
  const atasKanan = [...Array(jumlahAtas - kanan.atas.length).fill(""), ...kanan.atas];
  for (let i = 0; i < jumlahAtas; i += 1) tulisDua(atasKiri[i], atasKanan[i], [{}, {}]);
  barisBaru(58);
  tulisDua(kiri.nama, kanan.nama, [
    { bold: kiri.namaTerisi, underline: kiri.namaTerisi },
    { bold: kanan.namaTerisi, underline: kanan.namaTerisi },
  ]);
  tulisDua(kiri.nip, kanan.nip, [{}, {}]);

  // --------------------------------------------------------------------------
  // Lembar
  // --------------------------------------------------------------------------
  const kaki = naskah.kaki.replace(/&/g, "&&");
  return createXlsxWorkbook(
    [
      {
        kind: "free",
        name: naskah.judulPendek || "Eviden SKP",
        columns: lebarKisi.map((pt) => ({ width: Math.round(titikKeLebarExcel(pt) * 100) / 100 })),
        rows,
        merges,
        images,
        showGridLines: false,
        pageSetup: {
          orientation: "landscape",
          paper: kertas,
          fitToWidth: true,
          horizontalCentered: true,
          marginsCm: { left: 1.5, right: 1.5, top: 1.3, bottom: 1.6, header: 0.5, footer: 0.6 },
          ...(rKepalaRincian !== null ? { printTitleRows: { from: rKepalaRincian + 1, to: rKepalaRincian + 1 } } : {}),
          footer: `&L&"${HURUF},Regular"&8${kaki}&R&"${HURUF},Regular"&8Halaman &P dari &N`,
        },
      },
    ],
    {
      creator: "ALETA",
      createdAt: Number.isNaN(new Date(naskah.dihitungPada).getTime()) ? undefined : new Date(naskah.dihitungPada),
    }
  );
}
