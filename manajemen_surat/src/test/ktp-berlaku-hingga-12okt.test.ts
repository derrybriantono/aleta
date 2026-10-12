// @vitest-environment node
/**
 * ============================================================================
 * "BERLAKU HINGGA" KTP -> PENANDA KTP ELEKTRONIK (12 Okt 2026, Agen M, keputusan pengguna 2)
 * ============================================================================
 *
 * Variabel ABT 11114 "Penanda KTP Elektronik": KTP tanpa kedaluwarsa ("SEUMUR HIDUP") = "Elektronik (KTP-el)". Sumbernya
 * berkas KTP e-Court. Yang dijaga di sini (tanpa basis data):
 *   A. uraiBerlakuHingga: seumur hidup (termasuk salah baca OCR), tanggal kedaluwarsa, tidak terbaca - TIDAK menebak;
 *   B. pembaca KTP (PDF berlapis teks) membawa berlakuHingga per halaman; hasilDariBacaan meneruskannya ke bot;
 *   C. bot (fungsi murni): berlakuBersih/berlakuTampil, susunBaris membawa berlaku-hingga ke baris tabel.
 * Penyimpanan di basis data bot + kueri 11114 atas tabel itu diuji di tanggal-ktp-ecourt-12okt.test.ts (bagian D).
 */
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { uraiBerlakuHingga } from "@/app/api/aleta-ecourt/saksi-scan/urai-ktp";
import { bacaKtpBanyak, type HasilBacaKtp } from "@/server/modules/aleta-ecourt/ktp-ocr";
import { hasilDariBacaan } from "@/server/modules/aleta-ecourt/ktp-pihak";

type Apa = any;
const AKAR = path.resolve(__dirname, "../../..");
const muat = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const K: Apa = muat(path.join(AKAR, "aleta_bot/services/ktpPihakService.js"));

const KTP = (berlaku: string[]) => [
  "PROVINSI SULAWESI TENGAH",
  "KABUPATEN DONGGALA",
  "NIK : 7203094505900001",
  "Nama : SITI AMINAH",
  "Tempat/Tgl Lahir : DONGGALA, 05-05-1990",
  "Jenis kelamin : PEREMPUAN Gol. Darah : O",
  "Alamat : JL. TRANS SULAWESI NO. 10",
  "Kel/Desa : LABUAN SALUMBONE",
  "Kecamatan : LABUAN",
  "Agama : ISLAM",
  "Status Perkawinan : KAWIN",
  "Pekerjaan : MENGURUS RUMAH TANGGA",
  "Kewarganegaraan : WNI",
  ...berlaku,
];

describe("A. uraiBerlakuHingga", () => {
  const baca = (baris: string[]) => uraiBerlakuHingga(baris.join("\n"), 2026);

  it("'Berlaku Hingga : SEUMUR HIDUP' = seumur_hidup, juga bila blok penerbitan (tanggal terbit) terseret ke baris yang sama", () => {
    expect(baca(KTP(["Berlaku Hingga : SEUMUR HIDUP"]))).toBe("seumur_hidup");
    expect(baca(KTP(["Berlaku Hingga : SEUMUR HIDUP 18-02-2012"]))).toBe("seumur_hidup");
    expect(baca(KTP(["Berlaku Hingga : SEUMUR HIDUP", "DONGGALA", "18-02-2012"]))).toBe("seumur_hidup");
  });

  it("label berdiri sendiri, nilainya di baris sesudahnya (lapisan teks PDF)", () => {
    expect(baca(KTP(["Berlaku Hingga", ": SEUMUR HIDUP"]))).toBe("seumur_hidup");
    expect(baca(KTP(["Berlaku Hingga :", "31-12-2017", "DONGGALA", "12-03-2009"]))).toBe("31/12/2017");
  });

  it("salah baca OCR yang lazim pada label dan tulisan tetap dikenali", () => {
    expect(baca(KTP(["Beriaku Hingga : SEUMUR H1DUP"]))).toBe("seumur_hidup");
    expect(baca(KTP(["Berlaku Hingga : SEUMUR HIDUF"]))).toBe("seumur_hidup");
    expect(baca(KTP(["Berlaku Hingga : SEUMUR  HIDUP"]))).toBe("seumur_hidup");
    expect(baca(KTP(["Berlaku Hingga : seumur hidup"]))).toBe("seumur_hidup");
  });

  it("tanpa baris berlabel (OCR tak menangkapnya): tulisan SEUMUR HIDUP di mana pun = seumur_hidup (hanya ada pada KTP-el)", () => {
    expect(baca(KTP(["SEUMUR HIDUP", "DONGGALA", "18-02-2012"]))).toBe("seumur_hidup");
  });

  it("tanggal kedaluwarsa (KTP bentuk lama) = dd/mm/yyyy; tanggal terbit di blok kanan tidak tertukar dengannya", () => {
    expect(baca(KTP(["Berlaku Hingga : 31-12-2017", "DONGGALA", "12-03-2009"]))).toBe("31/12/2017");
    expect(baca(KTP(["Berlaku Hingga : 14 Maret 2014"]))).toBe("14/03/2014");
  });

  it("MERAGUKAN = '' (tidak ditebak): tanggal di baris berlabel sama dengan tanggal terbit di bawah; tahun mustahil; tanpa apa pun", () => {
    // KTP-el yang tulisan seumur hidup-nya rusak: tanggal terbit terseret ke baris Berlaku Hingga dan muncul lagi di bawah.
    expect(baca(KTP(["Berlaku Hingga : 18-02-2012", "DONGGALA", "18-02-2012"]))).toBe("");
    expect(baca(KTP(["Berlaku Hingga : 31-12-1850"]))).toBe("");
    expect(baca(KTP(["Berlaku Hingga : 31-12-2090"]))).toBe("");
    expect(baca(KTP(["Berlaku Hingga :"]))).toBe("");
    expect(baca(KTP([]))).toBe("");
    expect(uraiBerlakuHingga("", 2026)).toBe("");
  });

  it("bila ada 'seumur hidup' DAN tanggal di baris berlabel: seumur hidup menang (tulisan itu hanya ada pada KTP-el)", () => {
    expect(baca(KTP(["Berlaku Hingga : 18-02-2012", "SEUMUR HIDUP"]))).toBe("seumur_hidup");
  });
});

describe("B. pembaca KTP dan kiriman ke bot membawa berlakuHingga", () => {
  async function buatPdf(halaman: string[][]): Promise<Buffer> {
    const { PDFDocument, StandardFonts } = createRequire(path.join(process.cwd(), "package.json"))("pdf-lib");
    const dok = await PDFDocument.create();
    const huruf = await dok.embedFont(StandardFonts.Helvetica);
    for (const baris of halaman) {
      const h = dok.addPage([595, 842]);
      baris.forEach((b, i) => h.drawText(b, { x: 40, y: 800 - i * 20, size: 12, font: huruf }));
    }
    return Buffer.from(await dok.save());
  }
  const BUDI = KTP(["Berlaku Hingga : 31-12-2017", "DONGGALA", "12-03-2009"]).map((b) => b.replace("7203094505900001", "7203091203850002").replace("SITI AMINAH", "BUDI SANTOSO").replace("PEREMPUAN", "LAKI-LAKI").replace("05-05-1990", "12-03-1985"));

  it("PDF dua halaman: KTP-el (seumur hidup) dan KTP bentuk lama (31/12/2017), masing-masing pada orangnya sendiri", async () => {
    const pdf = await buatPdf([KTP(["Berlaku Hingga : SEUMUR HIDUP 18-02-2012"]), BUDI]);
    const hasil = await bacaKtpBanyak(pdf, { tahunKini: 2026 });
    const peta = Object.fromEntries(hasil.map((h) => [h.medan.nik, h]));
    expect(peta["7203094505900001"].berlakuHingga).toBe("seumur_hidup");
    expect(peta["7203091203850002"].berlakuHingga).toBe("31/12/2017");
    expect(peta["7203094505900001"].medan.tanggalTerbit).toBe("18/02/2012"); // tanggal terbit tetap terbaca
  });

  it("hasilDariBacaan meneruskan berlakuHingga (kosong bila tidak terbaca) ke kiriman bot", () => {
    const baik = (nik: string, berlaku?: string): HasilBacaKtp =>
      ({ ok: true, teks: "", medan: { nik, nama: "X", tanggalLahir: "05/05/1990", tanggalTerbit: "18/02/2012", kotaTerbit: "Donggala" }, nik: { sah: true }, catatan: [], terbaca: [], sumber: "teks-pdf", berlakuHingga: berlaku }) as unknown as HasilBacaKtp;
    const h = hasilDariBacaan("f1", [baik("7203094505900001", "seumur_hidup"), baik("7203091203850002", "31/12/2017"), baik("7203091203850003")], 2);
    expect(h.ktp.map((k) => k.berlakuHingga)).toEqual(["seumur_hidup", "31/12/2017", ""]);
    expect(h.versi).toBe(2);
  });
});

describe("C. bot: berlakuBersih / berlakuTampil / susunBaris", () => {
  it("bentuk simpanan: 'seumur_hidup', tanggal ISO, atau ''; masukan lain tidak pernah ditebak", () => {
    expect(K.berlakuBersih("seumur_hidup")).toBe("seumur_hidup");
    expect(K.berlakuBersih("SEUMUR_HIDUP")).toBe("seumur_hidup");
    expect(K.berlakuBersih("31/12/2017")).toBe("2017-12-31");
    expect(K.berlakuBersih("2017-12-31")).toBe("2017-12-31");
    for (const rusak of ["", null, undefined, "31/02/2017", "abc", "seumur hidup", "0000-00-00", "2017-13-01"]) expect(K.berlakuBersih(rusak)).toBe("");
  });

  it("bentuk tampil untuk portal/panel: 'seumur_hidup', dd/mm/yyyy, atau ''", () => {
    expect(K.berlakuTampil("seumur_hidup")).toBe("seumur_hidup");
    expect(K.berlakuTampil("2017-12-31")).toBe("31/12/2017");
    expect(K.berlakuTampil("")).toBe("");
    expect(K.berlakuTampil("sampah")).toBe("");
  });

  it("susunBaris membawa berlaku-hingga ke baris tabel", () => {
    const pihak = { cabang: 1, urutan: 1, pihakId: 5, nama: "SITI AMINAH", nik: "7203094505900001", tanggalLahirIso: "1990-05-05" };
    const dasar = {
      cocok: { pihak, cocok: "nik", kuat: true, ambigu: false },
      pihakDiCabang: { 1: 1 },
      sebutan: { satu: "Penggugat", dua: "Tergugat" },
      perkara: { perkaraId: 9, tanggalDaftarIso: "2026-01-10" },
      fileId: "f",
      urut: 1,
      documentKey: "d",
      nomorPerkara: "1/Pdt.G/2026/PA.Dgl",
      sumberBaca: "teks-pdf",
      versi: K.VERSI_KTP_PIHAK,
      hariIniIso: "2026-10-12",
    };
    const ktp = { nik: "7203094505900001", nikSah: true, nama: "Siti Aminah", tanggalLahir: "05/05/1990", tanggalTerbit: "18/02/2012", kotaTerbit: "Donggala", sumber: "teks-pdf" };
    expect(K.susunBaris({ ...dasar, ktp: { ...ktp, berlakuHingga: "seumur_hidup" } }).berlakuHingga).toBe("seumur_hidup");
    expect(K.susunBaris({ ...dasar, ktp: { ...ktp, berlakuHingga: "31/12/2017" } }).berlakuHingga).toBe("2017-12-31");
    expect(K.susunBaris({ ...dasar, ktp }).berlakuHingga).toBe(""); // server lama / tidak terbaca
  });

  it("versi aturan baca dinaikkan (bacaan versi 1 dibaca ulang untuk mengisi berlaku-hingga); kolom disusulkan tanpa mengubah DDL paket ABT yang terpasang", () => {
    expect(K.VERSI_KTP_PIHAK).toBe(2);
    expect(K.KOLOM_SUSULAN.map((k: Apa) => k.nama)).toEqual(["berlaku_hingga"]);
    expect(K.DDL_KTP_PIHAK).not.toContain("berlaku_hingga"); // DDL dasar dipakai paket abt-tanggal-ktp (sudah terpasang): tidak berubah
  });
});
