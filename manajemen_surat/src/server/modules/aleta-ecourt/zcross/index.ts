import { PDFDocument } from "pdf-lib";

import { bersihkanZDocx, bukaDocx, cariSemuaJangkarDocx, cariJangkarDocx, paragrafDocx, rapatkanParagrafDocx, seksiDocx, simpanDocx, tanggalDariParagraf, tulisBanyakZDocx } from "./docx";
import { bagianRencana, jumlahHalamanBukti, nomorBagianBerikutnya, rencanaZ, tanggalIndonesia, type LetakJangkar, type RencanaZ, type Tepi, type TemuanZ } from "./geometri";
import type { BentukKeluar, BentukMasuk, Mesin } from "./mesin";
import { bacaGarisPdf, type GarisPdf } from "./pdf-garis";
import { bacaKataPdf, cariEkor, ekorParagraf, halamanEkor, letakDariKata, normKata, type HasilBacaPdf, type Kata } from "./pdf-letak";
import { kotakKata, periksaTumpang, ringkasPelanggaran, ruasBerpotongan, ruasMemotongKotak, type Kotak, type Pelanggaran } from "./periksa";
import { bersihkanZRtf, cariSemuaJangkarRtf, cariJangkarRtf, tanggalDariNaskah, tulisBanyakZRtf, ukuranDiPosisi, uraiRtf, rapatkanParagraf, type HasilUrai } from "./rtf";
import { uraiXml, atribut as attr, cari as cariXml } from "./xml-mini";

export type { Mesin } from "./mesin";
export { mesinSoffice, mesinWord, pilihMesinLokal } from "./mesin";

/**
 * Z CROSS OTOMATIS (31 Okt - 1 Nov 2026; diperbaiki 3 Nov) - titik masuk. Penyesuaian dilakukan otomatis tiap naskah BAS dicetak, diunduh,
 * atau diunggah.
 *
 *   lintasan 1  naskah (Z lama dibuang) -> PDF (mesin: Word / soffice) -> letak kata TERAKHIR sebelum tiap tanda Z (pdfjs)
 *   lintasan 2  tulis balik ke naskah ASAL (RTF: {\shp}, DOCX: wp:anchor, DOC: lewat DOCX): garis Z, tanggal, ganti halaman, nomor
 *               halaman bagian berikutnya = halaman Z + jumlah halaman bukti/lampiran + 1
 *
 * 3 Nov 2026 (uji tangan BAS 631/Pdt.G/2026 - Z menimpa "Selanjutnya Ketua Majelis ..." di halaman berikut):
 *   - semua tanda Z di naskah disesuaikan (BAS mediasi punya dua), tidak hanya yang terakhir;
 *   - jangkar = tulisan TAMPAK terakhir sebelum tanda Z, termasuk isian kosong "..." (dulu "..." dilewati: Z menimpanya / "..." dipindah
 *     ke halaman sendiri), bentuk ditambatkan di paragraf bertulisan itu;
 *   - tidak ada lagi tebakan "kata berikut/berupa terakhir di seluruh PDF" bila kalimat jangkar tidak ketemu (bisa jatuh ke "...sebagai
 *     berikut:" court calendar di halaman lain) - Z tidak dipasang + alasan;
 *   - rencana Z DIPERIKSA terhadap tulisan & garis hasil ukur: bersilang / tanpa ruang kosong = Z tempat itu tidak digambar + peringatan;
 *     PDF akhir (keluar "pdf") diperiksa sekali lagi;
 *   - jumlah halaman lampiran Z bukan pembuktian (mediasi, jawab-menjawab) bawaan 1 - dulu seluruh paragraf di atasnya dihitung "bukti".
 *
 * Bila tidak ada tanda Z / mesin gagal / kalimat jangkar tidak ketemu, naskah dikembalikan APA ADANYA dengan alasan di laporan: Z otomatis
 * tidak boleh menggagalkan cetak, unduh, atau unggah.
 */

export type OpsiZcross = {
  mesin: Mesin;
  /** Bentuk keluaran; bawaan = bentuk masukan. "pdf" = PDF dari naskah yang sudah disesuaikan. */
  keluar?: BentukKeluar;
  /** Tanggal di bawah garis bila naskah tidak memuatnya (bawaan: tanggal sidang di naskah, selainnya hari ini). */
  tanggal?: string;
  /** Jumlah bukti/lampiran tempat Z TERAKHIR (bawaan: dihitung dari daftar bukti di naskah; selain pembuktian 1). */
  jumlahBukti?: number;
  /** Jumlah halaman tiap bukti/lampiran tempat Z TERAKHIR menurut urutan; yang kosong dihitung 1 halaman. */
  halamanBukti?: ReadonlyArray<number | null | undefined>;
  /** Penyesuaian rumus nomor halaman (bawaan 1 = halaman Z + jumlah halaman bukti + 1: bukti menempati halaman sesudah Z). */
  tambahNomor?: number;
  /** Banyak ukur ulang maksimal untuk merapatkan kalimat (bawaan 3). */
  maksRapat?: number;
  /** Hanya naskah yang memuat bentuk "SC Z" (tanda Z blangko) yang disesuaikan; paragraf "...berikut:" biasa tanpa bentuk tidak disentuh (dipakai alur otomatis). */
  hanyaBentuk?: boolean;
};

/** Ringkasan satu tempat Z. */
export type TempatZ = {
  halamanFisik: number;
  halamanTampil: number;
  /** false = garis & tanggal tidak digambar (sebab di `sebab`); ganti halaman & nomor tetap diatur. */
  digambar: boolean;
  sebab?: string;
  nomorBagianBerikut: number | null;
  jumlahHalamanLampiran: number;
  bawaan: boolean;
  jenis: "bukti" | "lampiran";
  teksBaris: string;
};

export type LaporanZcross = {
  diubah: boolean;
  alasan: string;
  mesin: string;
  bentukAsal: BentukMasuk | "";
  halamanFisikZ?: number;
  halamanTampilZ?: number;
  jumlahHalamanBukti?: number;
  jumlahHalamanBuktiBawaan?: boolean;
  nomorBagianBerikut?: number | null;
  /** Halaman yang ditempati bukti (sesudah halaman Z): dari - sampai. */
  halamanBuktiDari?: number;
  halamanBuktiSampai?: number;
  seksi?: string;
  dirapatkan?: boolean;
  jangkar?: string;
  teksBarisJangkar?: string;
  /** 3 Nov: semua tempat Z (yang terakhir = ruas tunggal di atas). */
  daftar?: TempatZ[];
  temuan: TemuanZ[];
};

export type HasilZcross = { bita: Uint8Array; bentuk: BentukKeluar; laporan: LaporanZcross };

type TitikZ = { ukurIndeks: number; teksIndeks: number; akhirIndeks: number; via: "bentuk" | "ujung-daftar" };

type TulisMasuk = { titik: TitikZ; rencana: RencanaZ | null; nomor: number | null };

interface NaskahZ {
  bentuk: "rtf" | "docx";
  paragrafTeks: string[];
  titik: TitikZ[];
  /** Dokumen tanpa Z lama (dan tanpa jarak huruf lama), dengan jarak huruf per paragraf teks (indeks -> twip) bila > 0. */
  dokumen(rapat: ReadonlyMap<number, number>): Uint8Array;
  tepi(h: { lebar: number; tinggi: number }, teksIndeks: number): Tepi & { atas?: number };
  tanggalNaskah(): string | null;
  /** Bagian dengan nomor halaman awal sebelum jangkar pertama: nomor awalnya dan paragraf pertamanya. */
  awalNomor(): { mulai: number; paragrafIndeks: number } | null;
  tulis(daftar: ReadonlyArray<TulisMasuk>, tanggal: string, rapat: ReadonlyMap<number, number>): { bita: Uint8Array; per: Array<{ seksi: string; nomorDitulis: number | null }> };
}

const dec = new TextDecoder("latin1");
const bita2latin1 = (b: Uint8Array): string => dec.decode(b);
function latin1ke(s: string): Uint8Array {
  const o = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) o[i] = s.charCodeAt(i) & 0xff;
  return o;
}

// ----------------------------------------------------------------------------
// Adaptor RTF
// ----------------------------------------------------------------------------
function naskahRtf(bita: Uint8Array, hanyaBentuk: boolean): NaskahZ | null {
  const asal = bita2latin1(bita);
  const uraiAsal = uraiRtf(asal);
  let semua = cariSemuaJangkarRtf(asal, uraiAsal);
  if (!semua.length && !hanyaBentuk) {
    const j = cariJangkarRtf(asal, uraiAsal);
    if (j) semua = [j];
  }
  if (!semua.length) return null;
  const bersih = bersihkanZRtf(asal);
  const urai: HasilUrai = uraiRtf(bersih.rtf);
  if (semua.some((j) => !urai.paragraf[j.teksIndeks] || !urai.paragraf[j.indeks])) return null;
  const kotakUntuk = new Map(semua.map((j, i) => [j.teksIndeks, bersih.kotakPerJangkar[i] ?? bersih.kotakTanggal] as const));
  const rapatkan = (rtf: string, rapat: ReadonlyMap<number, number>): string => {
    // dari paragraf paling belakang supaya letak paragraf di depannya tidak bergeser
    let hasil = rtf;
    for (const [i, twip] of [...rapat.entries()].filter(([, t]) => t > 0).sort((a, b) => b[0] - a[0])) hasil = rapatkanParagraf(hasil, urai.paragraf[i], twip);
    return hasil;
  };
  return {
    bentuk: "rtf",
    paragrafTeks: urai.paragraf.map((q) => q.teks),
    titik: semua.map((j) => ({ ukurIndeks: j.indeks, teksIndeks: j.teksIndeks, akhirIndeks: j.akhirIndeks, via: j.via })),
    dokumen: (rapat) => latin1ke(rapatkan(bersih.rtf, rapat)),
    tepi: (h, teksIndeks) => {
      const u = ukuranDiPosisi(bersih.rtf, urai, urai.paragraf[teksIndeks].akhir);
      return { kiri: u.kiri, kanan: h.lebar - u.kanan, bawah: u.bawah, atas: u.atas };
    },
    tanggalNaskah: () => tanggalDariNaskah(urai),
    awalNomor: () => {
      const batas = urai.paragraf[semua[0].teksIndeks].akhir;
      let sd: (typeof urai.kejadian)[number] | null = null;
      for (const k of urai.kejadian) {
        if (k.jenis === "sectd" && k.pos <= batas && /\\pgn(?:restart|starts)/.test(bersih.rtf.slice(k.pos, k.akhirKontrol))) sd = k;
      }
      if (!sd) return null;
      const m = /\\pgnstarts(-?\d+)/.exec(bersih.rtf.slice(sd.pos, sd.akhirKontrol));
      const mulai = m ? Number(m[1]) : 1;
      const awalBagian = urai.kejadian.filter((k) => k.jenis === "sect" && k.pos < sd.pos).pop()?.akhir ?? 0;
      const pa = urai.paragraf.find((q) => q.awal >= awalBagian && q.teks.trim());
      return pa ? { mulai, paragrafIndeks: pa.indeks } : null;
    },
    tulis: (daftar, tanggal, rapat) => {
      const dasar = rapatkan(bersih.rtf, rapat);
      const h = tulisBanyakZRtf(
        dasar,
        daftar.map((d) => ({ teksIndeks: d.titik.teksIndeks, akhirIndeks: d.titik.akhirIndeks, rencana: d.rencana, kotakTanggal: kotakUntuk.get(d.titik.teksIndeks) ?? null, tanggal, nomorBerikut: d.nomor }))
      );
      return { bita: latin1ke(h.rtf), per: h.per };
    },
  };
}

// ----------------------------------------------------------------------------
// Adaptor DOCX
// ----------------------------------------------------------------------------
function naskahDocx(bita: Uint8Array, hanyaBentuk: boolean): NaskahZ | null {
  const b = bukaDocx(bita);
  const akarAsal = uraiXml(b.xml);
  const parAsal = paragrafDocx(b.xml, akarAsal);
  let semua = cariSemuaJangkarDocx(b.xml, parAsal);
  if (!semua.length && !hanyaBentuk) {
    const j = cariJangkarDocx(b.xml, parAsal);
    if (j) semua = [j];
  }
  if (!semua.length) return null;
  const bersih = bersihkanZDocx(b.xml);
  const akar = uraiXml(bersih.xml);
  const par = paragrafDocx(bersih.xml, akar);
  if (semua.some((j) => !par[j.teksIndeks] || !par[j.indeks])) return null;
  const labelUntuk = new Map(semua.map((j, i) => [j.teksIndeks, bersih.labelPerJangkar[i] ?? bersih.labelTanggal] as const));
  const rapatkan = (xml: string, rapat: ReadonlyMap<number, number>): string => {
    // dari paragraf paling belakang: simpul paragraf di depannya tetap pada letaknya
    let hasil = xml;
    for (const [i, twip] of [...rapat.entries()].filter(([, t]) => t > 0).sort((a, c) => c[0] - a[0])) hasil = rapatkanParagrafDocx(hasil, par[i].simpul, twip);
    return hasil;
  };
  const hitungPgNum = () => {
    const seksi = seksiDocx(akar, par);
    const batas = semua[0].teksIndeks;
    let kena = -1;
    for (let i = 0; i < seksi.length; i += 1) {
      const awalBagian = i === 0 ? 0 : (seksi[i - 1].paragrafIndeks ?? 0) + 1;
      if (awalBagian > batas) break;
      const nomor = seksi[i].sectPr.anak.find((c) => c.nama === "w:pgNumType");
      if (nomor && attr(nomor, "w:start") != null) kena = i;
    }
    if (kena < 0) return null;
    const mulai = Number(attr(seksi[kena].sectPr.anak.find((c) => c.nama === "w:pgNumType")!, "w:start"));
    const awalBagian = kena === 0 ? 0 : (seksi[kena - 1].paragrafIndeks ?? 0) + 1;
    const pa = par.find((q) => q.indeks >= awalBagian && q.teks.trim());
    return pa ? { mulai: Number.isFinite(mulai) ? mulai : 1, paragrafIndeks: pa.indeks } : null;
  };
  return {
    bentuk: "docx",
    paragrafTeks: par.map((q) => q.teks),
    titik: semua.map((j) => ({ ukurIndeks: j.indeks, teksIndeks: j.teksIndeks, akhirIndeks: j.akhirIndeks, via: j.via })),
    dokumen: (rapat) => simpanDocx(b, rapatkan(bersih.xml, rapat)),
    tepi: (h, teksIndeks) => {
      // tepi dari seksi paragraf teks (w:pgMar), selainnya dari halaman PDF
      const seksi = seksiDocx(akar, par);
      const sek = seksi.find((s) => s.paragrafIndeks == null || s.paragrafIndeks >= teksIndeks) ?? seksi[seksi.length - 1];
      const mar = sek ? cariXml(sek.sectPr, "w:pgMar")[0] : undefined;
      const kiri = mar ? Number(attr(mar, "w:left")) / 20 : NaN;
      const kanan = mar ? Number(attr(mar, "w:right")) / 20 : NaN;
      const bawah = mar ? Number(attr(mar, "w:bottom")) / 20 : NaN;
      const atas = mar ? Math.abs(Number(attr(mar, "w:top"))) / 20 : NaN;
      return {
        kiri: Number.isFinite(kiri) ? kiri : 72,
        kanan: h.lebar - (Number.isFinite(kanan) ? kanan : 72),
        ...(Number.isFinite(bawah) && bawah > 0 ? { bawah } : {}),
        ...(Number.isFinite(atas) && atas > 0 ? { atas } : {}),
      };
    },
    tanggalNaskah: () => tanggalDariParagraf(par.map((q) => q.teks)),
    awalNomor: hitungPgNum,
    tulis: (daftar, tanggal, rapat) => {
      const xmlDasar = rapatkan(bersih.xml, rapat);
      const h = tulisBanyakZDocx(
        xmlDasar,
        daftar.map((d) => ({ teksIndeks: d.titik.teksIndeks, akhirIndeks: d.titik.akhirIndeks, rencana: d.rencana, labelTanggal: labelUntuk.get(d.titik.teksIndeks) ?? null, tanggal, nomorBerikut: d.nomor }))
      );
      return { bita: simpanDocx(b, h.xml), per: h.per };
    },
  };
}

// ----------------------------------------------------------------------------
// Jumlah bukti dari naskah
// ----------------------------------------------------------------------------
const POLA_PENGANTAR_BUKTI = /bukti[^.:]*berupa\s*:\s*$/i;

/** Banyak bukti = paragraf berisi di antara pengantar "...bukti ... berupa:" dan paragraf jangkar. */
export function hitungBuktiDariNaskah(paragraf: string[], indeksJangkar: number): number {
  let n = 0;
  for (let i = indeksJangkar - 1; i >= 0; i -= 1) {
    const t = paragraf[i].trim();
    if (!t) continue;
    if (POLA_PENGANTAR_BUKTI.test(t)) {
      // pengantar bukti elektronik ("Selanjutnya ... berupa:") bersambung ke daftar bukti surat di atasnya; pengantar pertama menutup hitungan
      if (/^selanjutnya\b/i.test(t)) continue;
      break;
    }
    n += 1;
  }
  return n;
}

/**
 * 3 Nov: banyak bukti HANYA bila tempat Z memang menutup daftar bukti (ada pengantar "...bukti ... berupa:" di atasnya, paling jauh 200
 * paragraf); selainnya null - Z jawab-menjawab / mediasi / court calendar menutup LAMPIRAN (bawaan 1 halaman), bukan bukti. Dulu seluruh
 * paragraf di atas Z mediasi terhitung "37 bukti" sehingga bagian berikutnya bernomor 43.
 */
export function buktiDariNaskah(paragraf: string[], indeksJangkar: number): number | null {
  let n = 0;
  for (let i = indeksJangkar - 1; i >= 0 && indeksJangkar - i <= 200; i -= 1) {
    const t = paragraf[i].trim();
    if (!t) continue;
    if (POLA_PENGANTAR_BUKTI.test(t)) {
      if (/^selanjutnya\b/i.test(t)) continue;
      return n;
    }
    n += 1;
  }
  return null;
}

/** Jumlah halaman tiap PDF bukti (urut). PDF yang tidak terbaca = null (dihitung 1 oleh pemanggil). */
export async function halamanDariPdfBukti(pdf: ReadonlyArray<Uint8Array | null | undefined>): Promise<Array<number | null>> {
  const hasil: Array<number | null> = [];
  for (const b of pdf) {
    if (!b || !b.length) {
      hasil.push(null);
      continue;
    }
    try {
      const d = await PDFDocument.load(b, { ignoreEncryption: true, updateMetadata: false });
      hasil.push(d.getPageCount());
    } catch {
      hasil.push(null);
    }
  }
  return hasil;
}

// ----------------------------------------------------------------------------
// Letak kata terakhir sebelum tanda Z
// ----------------------------------------------------------------------------
const kataTampak = (t: string): string[] => t.split(/\s+/).filter(Boolean);
const titikTiga = (t: string): string => t.replace(/…/g, "...");
const cocokKata = (k: Kata, tok: string): boolean =>
  titikTiga(k.t) === titikTiga(tok) || (normKata(k.t).length > 0 && normKata(k.t) === normKata(tok));

/**
 * Indeks kata PDF TERAKHIR paragraf teks: dari kata terakhir ekor paragraf ukur, maju sebanyak kata-kata tampak paragraf sesudahnya s.d.
 * paragraf teks (isian kosong "..."), melompati kepala/kaki halaman. -1 bila urutannya tidak cocok.
 */
export function kataTerakhirTeks(kata: ReadonlyArray<Kata>, iUkur: number, token: ReadonlyArray<string>, diLuarArea: (k: Kata) => boolean): number {
  let i = iUkur;
  for (const tok of token) {
    i += 1;
    while (i < kata.length && diLuarArea(kata[i]) && !cocokKata(kata[i], tok)) i += 1;
    if (i >= kata.length || !cocokKata(kata[i], tok)) return -1;
  }
  return i;
}

type Ukuran = { baca: HasilBacaPdf; garis: GarisPdf[]; letak: Array<{ letak: LetakJangkar; iTeks: number } | null> };

async function ukur(mesin: Mesin, naskah: NaskahZ, dokumen: Uint8Array, bentuk: "rtf" | "docx"): Promise<Ukuran> {
  const pdf = await mesin.ubah(dokumen, bentuk, "pdf");
  const baca = await bacaKataPdf(pdf);
  const garis = await bacaGarisPdf(pdf);
  const letak = naskah.titik.map((t) => {
    const ekor = ekorParagraf(naskah.paragrafTeks[t.ukurIndeks]);
    let ordinal = 0;
    for (let i = 0; i < t.ukurIndeks; i += 1) {
      const e = ekorParagraf(naskah.paragrafTeks[i]);
      if (e.length === ekor.length && e.every((k, q) => k === ekor[q])) ordinal += 1;
    }
    const { indeks, pasti } = cariEkor(baca.kata, ekor, ordinal);
    // 3 Nov: TIDAK ada lagi tebakan "berikut/berupa terakhir di PDF" - kalimat lain (court calendar) di halaman lain bisa terpilih
    if (indeks < 0 || !pasti) return null;
    // ekor berhenti di kata BERMAKNA terakhir paragraf ukur; tanda baca sesudahnya ("berikut ini :" -> ":") dan paragraf sesudahnya s.d.
    // paragraf teks (isian "...") ikut dijalani supaya garis atas mulai SESUDAH tulisan terakhir yang sungguh tercetak (3 Nov, BAS ALUR 05 [2])
    const kataUkur = kataTampak(naskah.paragrafTeks[t.ukurIndeks]);
    let ujungBermakna = kataUkur.length - 1;
    while (ujungBermakna >= 0 && !normKata(kataUkur[ujungBermakna])) ujungBermakna -= 1;
    const token = [...kataUkur.slice(ujungBermakna + 1), ...naskah.paragrafTeks.slice(t.ukurIndeks + 1, t.teksIndeks + 1).flatMap(kataTampak)];
    const k0 = baca.kata[indeks];
    const h0 = baca.halaman[k0.halaman - 1];
    const tp = naskah.tepi({ lebar: h0?.lebar ?? 595, tinggi: h0?.tinggi ?? 842 }, t.teksIndeks);
    const diLuarArea = (k: Kata) => {
      const h = baca.halaman[k.halaman - 1];
      const tinggi = h?.tinggi ?? 842;
      return (tp.bawah != null && k.yDasar > tinggi - tp.bawah + 2) || (tp.atas != null && k.yDasar < tp.atas - 2);
    };
    const iTeks = kataTerakhirTeks(baca.kata, indeks, token, diLuarArea);
    if (iTeks < 0) return null;
    const l = letakDariKata(baca, iTeks);
    return l ? { letak: l, iTeks } : null;
  });
  return { baca, garis, letak };
}

/**
 * Pelanggaran rencana Z terhadap HASIL UKUR (lintasan 1, Z lama sudah dibuang): halangan = tulisan di halaman Z yang ada SEBELUM/PADA kata
 * terakhir paragraf teks (urutan baca) + kepala/kaki halaman, dan garis (tabel) di halaman itu yang tidak di bawah kalimat terakhir. Tulisan
 * sesudah tanda Z pindah ke halaman berikut (ganti halaman) sehingga bukan halangan.
 */
export function silangRencana(r: RencanaZ, u: Pick<Ukuran, "baca" | "garis">, iTeks: number, tepi: { atas?: number }): Pelanggaran[] {
  const h = r.halaman;
  const { ruas, kotakTulisan } = bagianRencana(r);
  const hasil: Pelanggaran[] = [];
  const yTeks = u.baca.kata[iTeks]?.yDasar ?? r.atas.y;
  // halangan: semua tulisan halaman Z KECUALI yang sesudah kata terakhir DAN di bawah barisnya (isi sesudah tanda Z - pindah halaman).
  // Tulisan sebaris di kanan kata terakhir (mis. ":" yang terpisah spasi) tetap halangan.
  const halangan = u.baca.kata
    .map((k, i) => ({ k, i }))
    .filter(({ k, i }) => k.halaman === h && k.t.trim() && (i <= iTeks || k.yDasar <= yTeks + 2 || k.yDasar > r.batasAreaTeks + 2 || (tepi.atas != null && k.yDasar < tepi.atas - 2)));
  for (const g of ruas) {
    for (const { k } of halangan) {
      const kotak = kotakKata(k);
      if (ruasMemotongKotak(g, kotak)) hasil.push({ jenis: "garis-tulisan", halaman: h, garis: { halaman: h, ...g }, kata: k.t, kotak });
    }
  }
  for (const { k } of halangan) {
    const kotak = kotakKata(k);
    if (irisanKotak(kotak, kotakTulisan) > 0) hasil.push({ jenis: "tulisan-tulisan", halaman: h, kata: "SC Z", lawan: k.t, kotak });
  }
  const garisHal = u.garis.filter((g) => g.halaman === h && Math.min(g.y1, g.y2) <= yTeks + 2);
  for (const g of ruas) for (const lain of garisHal) if (ruasBerpotongan(g, lain)) hasil.push({ jenis: "garis-garis", halaman: h, garis: { halaman: h, ...g }, lawan: lain });
  return hasil;
}

function irisanKotak(a: Kotak, b: Kotak): number {
  return Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1)) * Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
}

/** Ruas garis PDF yang adalah bagian Z rencana `r` (ujung-ujungnya dekat ruas rencana, toleransi 3 pt), di halaman mana pun. */
function ruasMilikRencana(g: GarisPdf, r: RencanaZ): boolean {
  const dekat = (a: number, b: number) => Math.abs(a - b) <= 3;
  return bagianRencana(r).ruas.some(
    (q) => (dekat(g.x1, q.x1) && dekat(g.y1, q.y1) && dekat(g.x2, q.x2) && dekat(g.y2, q.y2)) || (dekat(g.x1, q.x2) && dekat(g.y1, q.y2) && dekat(g.x2, q.x1) && dekat(g.y2, q.y1))
  );
}

/**
 * Pemeriksaan PDF AKHIR: garis Z tergambar di halaman rencana, tidak memotong tulisan, dan tulisan "SC Z / tanggal" tidak menimpa tulisan
 * lain. Mengembalikan daftar rencana (indeks) yang melanggar beserta pelanggarannya.
 */
export async function periksaPdfAkhir(pdf: Uint8Array, rencana: ReadonlyArray<RencanaZ | null>): Promise<Array<{ indeks: number; pelanggaran: Pelanggaran[]; pindahHalaman: boolean }>> {
  const baca = await bacaKataPdf(pdf);
  const garis = await bacaGarisPdf(pdf);
  const hasil: Array<{ indeks: number; pelanggaran: Pelanggaran[]; pindahHalaman: boolean }> = [];
  rencana.forEach((r, indeks) => {
    if (!r) return;
    const milik = garis.filter((g) => ruasMilikRencana(g, r));
    const pindahHalaman = milik.length > 0 && milik.some((g) => g.halaman !== r.halaman);
    const { kotakTulisan } = bagianRencana(r);
    const p = periksaTumpang(baca, garis, { halaman: [...new Set([r.halaman, ...milik.map((g) => g.halaman)])], ruas: (g) => ruasMilikRencana(g, r) }).filter((x) => {
      if (x.jenis === "garis-tulisan") return true;
      // tumpang tindih tulisan hanya yang melibatkan tulisan "SC Z / tanggal" (di kotak tulisan Z halaman rencana)
      if (x.jenis === "tulisan-tulisan") return x.halaman === r.halaman && (irisanKotak(x.kotak, kotakTulisan) > 0 || (x.kotakLawan != null && irisanKotak(x.kotakLawan, kotakTulisan) > 0));
      return false;
    });
    if (p.length || pindahHalaman) hasil.push({ indeks, pelanggaran: p, pindahHalaman });
  });
  return hasil;
}

const TWIP_RAPAT_MAKS = 20;

/**
 * Menyesuaikan Z cross sebuah naskah BAS (RTF / DOCX / DOC). Tidak pernah melempar galat untuk naskah yang tidak punya jangkar atau mesin
 * yang gagal: naskah dikembalikan apa adanya (laporan.diubah = false, laporan.alasan terisi).
 */
export async function sesuaikanZcross(bita: Uint8Array, bentukAsal: BentukMasuk, opsi: OpsiZcross): Promise<HasilZcross> {
  const keluar: BentukKeluar = opsi.keluar ?? bentukAsal;
  const laporan: LaporanZcross = { diubah: false, alasan: "", mesin: opsi.mesin.nama, bentukAsal, temuan: [] };
  const apaAdanya = async (alasan: string): Promise<HasilZcross> => {
    laporan.alasan = alasan;
    if (keluar === bentukAsal) return { bita, bentuk: keluar, laporan };
    return { bita: await opsi.mesin.ubah(bita, bentukAsal, keluar), bentuk: keluar, laporan };
  };
  /**
   * 3 Nov (arahan koordinator, uji tangan BAS 631): penyesuaian GAGAL sesudah tanda Z blangko dikenali = TANPA Z + peringatan. Tanda Z
   * lama blangko (bentuk berkedudukan relatif paragraf, ukuran tetap) DIBUANG - tidak pernah dibiarkan tergambar di tempat yang belum
   * diperiksa (LibreOffice memindahkannya ke halaman berikut, di atas tulisan). Ganti halaman & nomor halaman blangko tidak diubah.
   */
  let kerjaTerakhir: { bita: Uint8Array; bentuk: "rtf" | "docx" } | null = null;
  const tanpaZLama = async (alasan: string): Promise<HasilZcross> => {
    const k = kerjaTerakhir;
    if (!k) return apaAdanya(alasan);
    let bersih: Uint8Array | null = null;
    if (k.bentuk === "rtf") {
      const b = bersihkanZRtf(bita2latin1(k.bita));
      if (b.jumlahBentukDibuang) bersih = latin1ke(b.rtf);
    } else {
      const d = bukaDocx(k.bita);
      const b = bersihkanZDocx(d.xml);
      if (b.jumlahBentukDibuang) bersih = simpanDocx(d, b.xml);
    }
    if (!bersih) return apaAdanya(alasan);
    laporan.alasan = alasan;
    laporan.diubah = true;
    laporan.temuan.push({ tingkat: "peringatan", pesan: `Garis Z tidak dapat dipasang otomatis (${alasan.replace(/[.:]\s*Z tidak dipasang\.?$/i, "")}): tanda Z bawaan blangko dibuang supaya tidak menimpa tulisan - periksa naskah dan beri garis Z dengan tangan bila perlu.` });
    let akhir = bersih;
    if (keluar === "pdf") akhir = await opsi.mesin.ubah(bersih, k.bentuk, "pdf");
    else if (keluar !== k.bentuk) akhir = await opsi.mesin.ubah(bersih, k.bentuk, keluar);
    return { bita: akhir, bentuk: keluar, laporan };
  };
  try {
    let kerja = bita;
    const bentukKerja: "rtf" | "docx" = bentukAsal === "rtf" ? "rtf" : "docx";
    if (bentukAsal === "doc") kerja = await opsi.mesin.ubah(bita, "doc", "docx");
    const naskah = bentukKerja === "rtf" ? naskahRtf(kerja, Boolean(opsi.hanyaBentuk)) : naskahDocx(kerja, Boolean(opsi.hanyaBentuk));
    if (!naskah) {
      return await apaAdanya(opsi.hanyaBentuk ? 'Naskah tidak memuat bentuk "SC Z": Z tidak dipasang otomatis.' : 'Tidak ada paragraf "...berikut:" / "...berupa:" (BAS tanpa pembuktian): Z tidak dipasang.');
    }
    kerjaTerakhir = { bita: kerja, bentuk: bentukKerja };
    const titik = naskah.titik;
    laporan.jangkar = titik[titik.length - 1].via;

    // lintasan 1 (+ ukur ulang bila kalimat dirapatkan)
    const rapat = new Map<number, number>();
    let u = await ukur(opsi.mesin, naskah, naskah.dokumen(rapat), bentukKerja);
    if (u.letak.some((l) => !l)) return await tanpaZLama("Kalimat terakhir sebelum tanda Z tidak ditemukan di PDF hasil render: Z tidak dipasang.");
    const rencanaDari = (uk: Ukuran) =>
      titik.map((t, i) => {
        const l = uk.letak[i]!.letak;
        return rencanaZ(l, naskah.tepi({ lebar: l.lebarHalaman, tinggi: l.tinggiHalaman }, t.teksIndeks));
      });
    let rencana = rencanaDari(u);
    // kalimat dirapatkan bila ruang di samping kata terakhir < 3 cm
    const maks = opsi.maksRapat ?? 3;
    for (let ulang = 0; ulang < maks && rencana.some((r) => r.kurangRuang > 0.5); ulang += 1) {
      let berubah = false;
      rencana.forEach((r, i) => {
        if (r.kurangRuang <= 0.5) return;
        const tIdx = titik[i].teksIndeks;
        const kini = rapat.get(tIdx) ?? 0;
        if (kini >= TWIP_RAPAT_MAKS) return;
        const hurufBaris = Math.max(8, u.letak[i]!.letak.teksBaris.replace(/\s+/g, " ").length);
        const perlu = Math.ceil(((r.kurangRuang + 8) / hurufBaris) * 20);
        rapat.set(tIdx, Math.min(TWIP_RAPAT_MAKS, Math.max(kini + 1, kini + perlu)));
        berubah = true;
      });
      if (!berubah) break;
      const ulangUkur = await ukur(opsi.mesin, naskah, naskah.dokumen(rapat), bentukKerja);
      if (ulangUkur.letak.some((l) => !l)) {
        rapat.clear();
        break;
      }
      u = ulangUkur;
      rencana = rencanaDari(u);
    }
    if (rapat.size && [...rapat.values()].some((t) => t > 0)) {
      laporan.dirapatkan = true;
      const maksTwip = Math.max(...rapat.values());
      laporan.temuan.push({ tingkat: "info", pesan: `Kalimat terakhir dirapatkan (jarak huruf -${(maksTwip / 20).toFixed(2)} pt) supaya garis atas Z memperoleh ruang di baris yang sama.` });
    }

    // periksa tiap rencana: ruang kosong cukup & tidak bersilang dengan tulisan/garis hasil ukur
    const pakai: Array<RencanaZ | null> = rencana.map((r, i) => {
      laporan.temuan.push(...r.temuan);
      if (!r.cukupRuang) return null;
      if (r.kurangRuang > 0.5) {
        laporan.temuan.push({ tingkat: "peringatan", pesan: `Ruang di samping kata terakhir tetap kurang dari 3 cm walau dirapatkan (${((r.atas.x2 - r.atas.x1) / (72 / 2.54)).toFixed(1)} cm): periksa tampilan Z.` });
      }
      const l = u.letak[i]!.letak;
      const silang = silangRencana(r, u, u.letak[i]!.iTeks, naskah.tepi({ lebar: l.lebarHalaman, tinggi: l.tinggiHalaman }, titik[i].teksIndeks));
      if (silang.length) {
        laporan.temuan.push({ tingkat: "peringatan", pesan: `Garis Z di halaman ${r.halaman} akan menimpa tulisan (${ringkasPelanggaran(silang, 2)}): Z tidak digambar di tempat itu.` });
        return null;
      }
      return r;
    });

    // nomor halaman tampil tiap tempat Z (berurutan; bagian sesudah tiap Z dimulai dari nomor yang ditulis untuknya)
    let mulaiNomor: number | null = null;
    let mulaiFisik = 1;
    const awal = naskah.awalNomor();
    if (awal) {
      const ekorAwal = ekorParagraf(naskah.paragrafTeks[awal.paragrafIndeks]);
      let ordAwal = 0;
      for (let i = 0; i < awal.paragrafIndeks; i += 1) {
        const e = ekorParagraf(naskah.paragrafTeks[i]);
        if (e.length === ekorAwal.length && e.every((k, q) => k === ekorAwal[q])) ordAwal += 1;
      }
      const fisikAwal = halamanEkor(u.baca, ekorAwal, ordAwal);
      if (fisikAwal > 0) {
        mulaiNomor = awal.mulai;
        mulaiFisik = fisikAwal;
      } else laporan.temuan.push({ tingkat: "peringatan", pesan: "Awal nomor halaman bagian ini tidak ditemukan di PDF: nomor halaman Z dianggap sama dengan halaman fisik." });
    }
    const tempat: TempatZ[] = [];
    const tulisMasuk: TulisMasuk[] = [];
    titik.forEach((t, i) => {
      const l = u.letak[i]!.letak;
      const tampil = mulaiNomor != null ? mulaiNomor + (l.halaman - mulaiFisik) : l.halaman;
      const terakhir = i === titik.length - 1;
      const bukti = buktiDariNaskah(naskah.paragrafTeks, t.ukurIndeks);
      const jumlah = terakhir && opsi.jumlahBukti != null ? opsi.jumlahBukti : (bukti ?? 1);
      const hb = jumlahHalamanBukti({ jumlahBukti: jumlah, halamanPerBukti: terakhir ? opsi.halamanBukti : undefined });
      const nomor = nomorBagianBerikutnya(tampil, hb.jumlah, opsi.tambahNomor);
      const jenis: TempatZ["jenis"] = bukti != null ? "bukti" : "lampiran";
      tempat.push({
        halamanFisik: l.halaman,
        halamanTampil: tampil,
        digambar: Boolean(pakai[i]),
        ...(pakai[i] ? {} : { sebab: rencana[i].cukupRuang ? "bersilang" : "tanpa-ruang" }),
        nomorBagianBerikut: nomor,
        jumlahHalamanLampiran: hb.jumlah,
        bawaan: hb.bawaan,
        jenis,
        teksBaris: l.teksBaris,
      });
      tulisMasuk.push({ titik: t, rencana: pakai[i], nomor });
      mulaiNomor = nomor;
      mulaiFisik = l.halaman + 1;
    });

    const tanggal = naskah.tanggalNaskah() ?? opsi.tanggal ?? tanggalIndonesia();
    let tulis = naskah.tulis(tulisMasuk, tanggal, rapat);
    let akhir = tulis.bita;
    let pdfAkhir: Uint8Array | null = null;
    if (keluar === "pdf") {
      pdfAkhir = await opsi.mesin.ubah(akhir, bentukKerja, "pdf");
      // PDF akhir diperiksa sekali lagi: Z yang tergambar di halaman lain / memotong tulisan dibuang dan PDF dibuat ulang
      const langgar = await periksaPdfAkhir(pdfAkhir, tulisMasuk.map((m) => m.rencana));
      if (langgar.length) {
        for (const x of langgar) {
          tulisMasuk[x.indeks] = { ...tulisMasuk[x.indeks], rencana: null };
          tempat[x.indeks] = { ...tempat[x.indeks], digambar: false, sebab: "bersilang" };
          laporan.temuan.push({
            tingkat: "peringatan",
            pesan: `Garis Z di halaman ${tempat[x.indeks].halamanFisik} ternyata ${x.pindahHalaman ? "tergambar di halaman lain" : `menimpa tulisan (${ringkasPelanggaran(x.pelanggaran, 2)})`}: Z tidak digambar di tempat itu.`,
          });
        }
        tulis = naskah.tulis(tulisMasuk, tanggal, rapat);
        akhir = tulis.bita;
        pdfAkhir = await opsi.mesin.ubah(akhir, bentukKerja, "pdf");
      }
    }

    // ringkasan (tempat Z TERAKHIR = ruas tunggal laporan; dipakai catatan halaman runut)
    const ujung = tempat[tempat.length - 1];
    laporan.daftar = tempat;
    laporan.teksBarisJangkar = ujung.teksBaris;
    laporan.halamanFisikZ = ujung.halamanFisik;
    laporan.halamanTampilZ = ujung.halamanTampil;
    laporan.jumlahHalamanBukti = ujung.jumlahHalamanLampiran;
    laporan.jumlahHalamanBuktiBawaan = ujung.bawaan;
    laporan.nomorBagianBerikut = ujung.nomorBagianBerikut;
    laporan.halamanBuktiDari = ujung.halamanTampil + 1;
    laporan.halamanBuktiSampai = ujung.halamanTampil + ujung.jumlahHalamanLampiran;
    for (const tz of tempat) {
      if (!tz.bawaan) continue;
      const kata = tz.jenis === "bukti" ? "bukti" : "lampiran";
      laporan.temuan.push({
        tingkat: "info",
        pesan: `Jumlah halaman ${kata} memakai bawaan (1 halaman per ${kata}${tz.jenis === "bukti" ? `, ${tz.jumlahHalamanLampiran} bukti` : ""}): ${kata} menempati halaman ${tz.halamanTampil + 1}-${tz.halamanTampil + tz.jumlahHalamanLampiran}, halaman berikutnya bernomor ${tz.nomorBagianBerikut}. Isi jumlah halaman ${kata} bila berbeda.`,
      });
    }
    const seksiUjung = tulis.per[tulis.per.length - 1];
    laporan.seksi = seksiUjung.seksi;
    if (seksiUjung.seksi === "tanpa-bagian-berikut") {
      laporan.nomorBagianBerikut = null;
      laporan.temuan.push({ tingkat: "info", pesan: "Tidak ada bagian sesudah Z: ganti halaman dan nomor halaman tidak diatur." });
    }
    laporan.diubah = true;

    if (keluar === "pdf") akhir = pdfAkhir ?? (await opsi.mesin.ubah(akhir, bentukKerja, "pdf"));
    else if (keluar !== bentukKerja) akhir = await opsi.mesin.ubah(akhir, bentukKerja, keluar);
    return { bita: akhir, bentuk: keluar, laporan };
  } catch (e) {
    const alasan = `Penyesuaian Z gagal: ${e instanceof Error ? e.message.slice(0, 300) : String(e).slice(0, 300)}`;
    try {
      return await tanpaZLama(alasan);
    } catch {
      return await apaAdanya(alasan).catch(() => ({ bita, bentuk: bentukAsal as BentukKeluar, laporan: { ...laporan, alasan: "Penyesuaian Z gagal." } }));
    }
  }
}
