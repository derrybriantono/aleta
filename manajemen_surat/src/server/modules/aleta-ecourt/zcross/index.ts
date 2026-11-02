import { PDFDocument } from "pdf-lib";

import { bersihkanZDocx, bukaDocx, cariJangkarDocx, paragrafDocx, rapatkanParagrafDocx, seksiDocx, simpanDocx, tanggalDariParagraf, tulisZDocx } from "./docx";
import { jumlahHalamanBukti, nomorBagianBerikutnya, rencanaZ, tanggalIndonesia, type LetakJangkar, type RencanaZ, type Tepi, type TemuanZ } from "./geometri";
import type { BentukKeluar, BentukMasuk, Mesin } from "./mesin";
import { bacaKataPdf, cariEkor, ekorParagraf, halamanEkor, letakDariKata, type HasilBacaPdf } from "./pdf-letak";
import { bersihkanZRtf, cariJangkarRtf, tanggalDariNaskah, tepiDariUkuran, tulisZRtf, ukuranDiPosisi, uraiRtf, rapatkanParagraf, type HasilUrai } from "./rtf";
import { uraiXml, atribut as attr, cari as cariXml } from "./xml-mini";

export type { Mesin } from "./mesin";
export { mesinSoffice, mesinWord, pilihMesinLokal } from "./mesin";

/**
 * Z CROSS OTOMATIS (31 Okt - 1 Nov 2026) - titik masuk. Penyesuaian dilakukan otomatis tiap naskah BAS dicetak, diunduh, atau diunggah.
 *
 *   lintasan 1  naskah -> PDF (mesin: Word / soffice) -> letak kata terakhir paragraf "...berikut:" / "...berupa:" (pdfjs)
 *   lintasan 2  tulis balik ke naskah ASAL (RTF: {\shp}, DOCX: wp:anchor, DOC: lewat DOCX): garis Z, tanggal, ganti halaman, nomor
 *               halaman bagian berikutnya = halaman Z + jumlah halaman bukti
 *
 * Bila tidak ada paragraf jangkar (BAS tanpa pembuktian) atau mesin gagal, naskah dikembalikan APA ADANYA dengan alasan di laporan: Z
 * otomatis tidak boleh menggagalkan cetak, unduh, atau unggah.
 */

export type OpsiZcross = {
  mesin: Mesin;
  /** Bentuk keluaran; bawaan = bentuk masukan. "pdf" = PDF dari naskah yang sudah disesuaikan. */
  keluar?: BentukKeluar;
  /** Tanggal di bawah garis bila naskah tidak memuatnya (bawaan: tanggal sidang di naskah, selainnya hari ini). */
  tanggal?: string;
  /** Jumlah bukti yang diajukan (bawaan: dihitung dari daftar di naskah). */
  jumlahBukti?: number;
  /** Jumlah halaman tiap bukti (dari PDF berkas bukti) menurut urutan; yang kosong dihitung 1 halaman. */
  halamanBukti?: ReadonlyArray<number | null | undefined>;
  /** Penyesuaian rumus nomor halaman (bawaan 1 = halaman Z + jumlah halaman bukti + 1: bukti menempati halaman sesudah Z). */
  tambahNomor?: number;
  /** Banyak ukur ulang maksimal untuk merapatkan kalimat (bawaan 3). */
  maksRapat?: number;
  /** Hanya naskah yang memuat bentuk "SC Z" (tanda Z blangko) yang disesuaikan; paragraf "...berikut:" biasa tanpa bentuk tidak disentuh (dipakai alur otomatis). */
  hanyaBentuk?: boolean;
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
  temuan: TemuanZ[];
};

export type HasilZcross = { bita: Uint8Array; bentuk: BentukKeluar; laporan: LaporanZcross };

type TulisHasil = { bita: Uint8Array; seksi: string; nomorDitulis: number | null };

interface NaskahZ {
  bentuk: "rtf" | "docx";
  paragrafTeks: string[];
  jangkarIndeks: number;
  jangkarVia: string;
  /** Dokumen tanpa Z (dan tanpa jarak huruf lama), dengan jarak huruf `twip` pada paragraf jangkar bila > 0. */
  dokumen(twip: number): Uint8Array;
  tepi(h: { lebar: number; tinggi: number }): Tepi;
  tanggalNaskah(): string | null;
  /** Bagian dengan nomor halaman awal sebelum jangkar: nomor awalnya dan paragraf pertamanya. */
  awalNomor(): { mulai: number; paragrafIndeks: number } | null;
  tulis(r: RencanaZ, nomor: number | null, tanggal: string, twip: number): TulisHasil;
}

const enc = new TextEncoder();
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
function naskahRtf(bita: Uint8Array): NaskahZ | null {
  const asal = bita2latin1(bita);
  const uraiAsal = uraiRtf(asal);
  const j = cariJangkarRtf(asal, uraiAsal);
  if (!j) return null;
  const indeks = j.indeks;
  const bersih = bersihkanZRtf(asal);
  const urai: HasilUrai = uraiRtf(bersih.rtf);
  const p = urai.paragraf[indeks];
  if (!p) return null;
  return {
    bentuk: "rtf",
    paragrafTeks: urai.paragraf.map((q) => q.teks),
    jangkarIndeks: indeks,
    jangkarVia: j.via,
    dokumen: (twip) => latin1ke(twip > 0 ? rapatkanParagraf(bersih.rtf, p, twip) : bersih.rtf),
    tepi: (h) => {
      const u = ukuranDiPosisi(bersih.rtf, urai, p.akhir);
      return { kiri: u.kiri, kanan: h.lebar - u.kanan, bawah: u.bawah };
    },
    tanggalNaskah: () => tanggalDariNaskah(urai),
    awalNomor: () => {
      let sd: (typeof urai.kejadian)[number] | null = null;
      for (const k of urai.kejadian) {
        if (k.jenis === "sectd" && k.pos <= p.akhir && /\\pgn(?:restart|starts)/.test(bersih.rtf.slice(k.pos, k.akhirKontrol))) sd = k;
      }
      if (!sd) return null;
      const m = /\\pgnstarts(-?\d+)/.exec(bersih.rtf.slice(sd.pos, sd.akhirKontrol));
      const mulai = m ? Number(m[1]) : 1;
      const awalBagian = urai.kejadian.filter((k) => k.jenis === "sect" && k.pos < sd.pos).pop()?.akhir ?? 0;
      const pa = urai.paragraf.find((q) => q.awal >= awalBagian && q.teks.trim());
      return pa ? { mulai, paragrafIndeks: pa.indeks } : null;
    },
    tulis: (r, nomor, tanggal, twip) => {
      const dasar = twip > 0 ? rapatkanParagraf(bersih.rtf, p, twip) : bersih.rtf;
      const hasil = tulisZRtf(dasar, indeks, { rencana: r, kotakTanggal: bersih.kotakTanggal, tanggal, nomorBerikut: nomor });
      return { bita: latin1ke(hasil.rtf), seksi: hasil.seksi, nomorDitulis: hasil.nomorDitulis };
    },
  };
}

// ----------------------------------------------------------------------------
// Adaptor DOCX
// ----------------------------------------------------------------------------
function naskahDocx(bita: Uint8Array): NaskahZ | null {
  const b = bukaDocx(bita);
  const akarAsal = uraiXml(b.xml);
  const parAsal = paragrafDocx(b.xml, akarAsal);
  const j = cariJangkarDocx(b.xml, parAsal);
  if (!j) return null;
  const indeks = j.indeks;
  const bersih = bersihkanZDocx(b.xml);
  const akar = uraiXml(bersih.xml);
  const par = paragrafDocx(bersih.xml, akar);
  const p = par[indeks];
  if (!p) return null;
  const hitungPgNum = () => {
    const seksi = seksiDocx(akar, par);
    let kena = -1;
    for (let i = 0; i < seksi.length; i += 1) {
      const awalBagian = i === 0 ? 0 : (seksi[i - 1].paragrafIndeks ?? 0) + 1;
      if (awalBagian > indeks) break;
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
    jangkarIndeks: indeks,
    jangkarVia: j.via,
    dokumen: (twip) => simpanDocx(b, twip > 0 ? rapatkanParagrafDocx(bersih.xml, p.simpul, twip) : bersih.xml),
    tepi: (h) => {
      // tepi dari seksi jangkar (w:pgMar), selainnya dari halaman PDF
      const seksi = seksiDocx(akar, par);
      const sek = seksi.find((s) => s.paragrafIndeks == null || s.paragrafIndeks >= indeks) ?? seksi[seksi.length - 1];
      const mar = sek ? cariXml(sek.sectPr, "w:pgMar")[0] : undefined;
      const kiri = mar ? Number(attr(mar, "w:left")) / 20 : NaN;
      const kanan = mar ? Number(attr(mar, "w:right")) / 20 : NaN;
      const bawah = mar ? Number(attr(mar, "w:bottom")) / 20 : NaN;
      return { kiri: Number.isFinite(kiri) ? kiri : 72, kanan: h.lebar - (Number.isFinite(kanan) ? kanan : 72), ...(Number.isFinite(bawah) && bawah > 0 ? { bawah } : {}) };
    },
    tanggalNaskah: () => tanggalDariParagraf(par.map((q) => q.teks)),
    awalNomor: hitungPgNum,
    tulis: (r, nomor, tanggal, twip) => {
      const xmlDasar = twip > 0 ? rapatkanParagrafDocx(bersih.xml, p.simpul, twip) : bersih.xml;
      const hasil = tulisZDocx(xmlDasar, indeks, { rencana: r, labelTanggal: bersih.labelTanggal, tanggal, nomorBerikut: nomor });
      return { bita: simpanDocx(b, hasil.xml), seksi: hasil.seksi, nomorDitulis: hasil.nomorDitulis };
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
// Pengukuran
// ----------------------------------------------------------------------------
type Ukuran = { letak: LetakJangkar; baca: HasilBacaPdf; pasti: boolean };

async function ukur(mesin: Mesin, dokumen: Uint8Array, bentuk: BentukMasuk, ekor: string[], ordinal: number): Promise<Ukuran | null> {
  const pdf = await mesin.ubah(dokumen, bentuk, "pdf");
  const baca = await bacaKataPdf(pdf);
  let { indeks, pasti } = cariEkor(baca.kata, ekor, ordinal);
  if (indeks < 0) {
    // cadangan: kata "berikut:" / "berupa:" TERAKHIR di seluruh PDF
    for (let i = baca.kata.length - 1; i >= 0; i -= 1) {
      if (/^(berikut|berupa)$/.test(baca.kata[i].norm)) {
        indeks = i;
        pasti = false;
        break;
      }
    }
  }
  if (indeks < 0) return null;
  const letak = letakDariKata(baca, indeks);
  return letak ? { letak, baca, pasti } : null;
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
  try {
    let kerja = bita;
    let bentukKerja: "rtf" | "docx" = bentukAsal === "rtf" ? "rtf" : "docx";
    if (bentukAsal === "doc") kerja = await opsi.mesin.ubah(bita, "doc", "docx");
    const naskah = bentukKerja === "rtf" ? naskahRtf(kerja) : naskahDocx(kerja);
    if (!naskah) return await apaAdanya('Tidak ada paragraf "...berikut:" / "...berupa:" (BAS tanpa pembuktian): Z tidak dipasang.');
    laporan.jangkar = naskah.jangkarVia;
    if (opsi.hanyaBentuk && naskah.jangkarVia !== "bentuk") return await apaAdanya('Naskah tidak memuat bentuk "SC Z": Z tidak dipasang otomatis.');

    const tail = ekorParagraf(naskah.paragrafTeks[naskah.jangkarIndeks]);
    let ordinal = 0;
    for (let i = 0; i < naskah.jangkarIndeks; i += 1) {
      const e = ekorParagraf(naskah.paragrafTeks[i]);
      if (e.length === tail.length && e.every((k, q) => k === tail[q])) ordinal += 1;
    }

    let twip = 0;
    let u = await ukur(opsi.mesin, naskah.dokumen(0), bentukKerja, tail, ordinal);
    if (!u) return await apaAdanya("Kata terakhir paragraf jangkar tidak ditemukan di PDF hasil render: Z tidak dipasang.");
    if (!u.pasti) laporan.temuan.push({ tingkat: "peringatan", pesan: "Letak paragraf jangkar di PDF dicocokkan dengan perkiraan (bukan ekor kalimat yang persis): periksa letak Z." });
    let tepi = naskah.tepi({ lebar: u.letak.lebarHalaman, tinggi: u.letak.tinggiHalaman });
    let rencana = rencanaZ(u.letak, tepi);

    // kalimat dirapatkan bila ruang di samping kata terakhir < 3 cm
    const maks = opsi.maksRapat ?? 3;
    for (let i = 0; i < maks && rencana.kurangRuang > 0.5; i += 1) {
      const hurufBaris = Math.max(8, u.letak.teksBaris.replace(/\s+/g, " ").length);
      const perlu = Math.ceil(((rencana.kurangRuang + 8) / hurufBaris) * 20);
      twip = Math.min(TWIP_RAPAT_MAKS, Math.max(twip + 1, twip + perlu));
      const ulang = await ukur(opsi.mesin, naskah.dokumen(twip), bentukKerja, tail, ordinal);
      if (!ulang) break;
      u = ulang;
      tepi = naskah.tepi({ lebar: u.letak.lebarHalaman, tinggi: u.letak.tinggiHalaman });
      rencana = rencanaZ(u.letak, tepi);
      if (twip >= TWIP_RAPAT_MAKS) break;
    }
    if (twip > 0) {
      laporan.dirapatkan = true;
      laporan.temuan.push({ tingkat: "info", pesan: `Kalimat terakhir dirapatkan (jarak huruf -${(twip / 20).toFixed(2)} pt) supaya garis atas Z memperoleh ruang di baris yang sama.` });
    }
    if (rencana.kurangRuang > 0.5) {
      laporan.temuan.push({ tingkat: "peringatan", pesan: `Ruang di samping kata terakhir tetap kurang dari 3 cm walau dirapatkan (${((rencana.atas.x2 - rencana.atas.x1) / (72 / 2.54)).toFixed(1)} cm): periksa tampilan Z.` });
    }
    laporan.temuan.push(...rencana.temuan);
    laporan.teksBarisJangkar = u.letak.teksBaris;

    // nomor halaman tampil halaman Z
    laporan.halamanFisikZ = u.letak.halaman;
    let tampil = u.letak.halaman;
    const awal = naskah.awalNomor();
    if (awal) {
      const ekorAwal = ekorParagraf(naskah.paragrafTeks[awal.paragrafIndeks]);
      let ordAwal = 0;
      for (let i = 0; i < awal.paragrafIndeks; i += 1) {
        const e = ekorParagraf(naskah.paragrafTeks[i]);
        if (e.length === ekorAwal.length && e.every((k, q) => k === ekorAwal[q])) ordAwal += 1;
      }
      const fisikAwal = halamanEkor(u.baca, ekorAwal, ordAwal);
      if (fisikAwal > 0) tampil = awal.mulai + (u.letak.halaman - fisikAwal);
      else laporan.temuan.push({ tingkat: "peringatan", pesan: "Awal nomor halaman bagian ini tidak ditemukan di PDF: nomor halaman Z dianggap sama dengan halaman fisik." });
    }
    laporan.halamanTampilZ = tampil;

    // jumlah halaman bukti
    const nBukti = opsi.jumlahBukti ?? hitungBuktiDariNaskah(naskah.paragrafTeks, naskah.jangkarIndeks);
    const hb = jumlahHalamanBukti({ jumlahBukti: nBukti, halamanPerBukti: opsi.halamanBukti });
    laporan.jumlahHalamanBukti = hb.jumlah;
    laporan.jumlahHalamanBuktiBawaan = hb.bawaan;
    if (hb.bawaan) {
      laporan.temuan.push({
        tingkat: "info",
        pesan: `Jumlah halaman bukti memakai bawaan (1 halaman per bukti${nBukti ? `, ${nBukti} bukti` : ""}): bukti menempati halaman ${tampil + 1}-${tampil + hb.jumlah}, halaman berikutnya bernomor ${nomorBagianBerikutnya(tampil, hb.jumlah, opsi.tambahNomor)}. Isi jumlah halaman bukti bila berbeda.`,
      });
    }
    const nomor = nomorBagianBerikutnya(tampil, hb.jumlah, opsi.tambahNomor);
    laporan.nomorBagianBerikut = nomor;
    laporan.halamanBuktiDari = tampil + 1;
    laporan.halamanBuktiSampai = tampil + hb.jumlah;

    const tanggal = naskah.tanggalNaskah() ?? opsi.tanggal ?? tanggalIndonesia();
    const tulis = naskah.tulis(rencana, nomor, tanggal, twip);
    laporan.seksi = tulis.seksi;
    if (tulis.seksi === "tanpa-bagian-berikut") {
      laporan.nomorBagianBerikut = null;
      laporan.temuan.push({ tingkat: "info", pesan: "Tidak ada bagian sesudah Z: ganti halaman dan nomor halaman tidak diatur." });
    }
    laporan.diubah = true;

    let akhir = tulis.bita;
    if (keluar === "pdf") akhir = await opsi.mesin.ubah(akhir, bentukKerja, "pdf");
    else if (keluar !== bentukKerja) akhir = await opsi.mesin.ubah(akhir, bentukKerja, keluar);
    return { bita: akhir, bentuk: keluar, laporan };
  } catch (e) {
    return await apaAdanya(`Penyesuaian Z gagal: ${e instanceof Error ? e.message.slice(0, 300) : String(e).slice(0, 300)}`).catch(() => ({ bita, bentuk: bentukAsal as BentukKeluar, laporan: { ...laporan, alasan: "Penyesuaian Z gagal." } }));
  }
}

void enc;
