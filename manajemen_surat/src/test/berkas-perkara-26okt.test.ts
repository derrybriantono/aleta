// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import zlib from "node:zlib";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  BAWAAN_HALAMAN,
  DAFTAR_CIRI,
  KERTAS,
  berkasBlangko,
  bentukDariBerkas,
  ciriSampulAwal,
  daftarSusulan,
  KUNCI_SUSULAN,
  rangkaiSusulan,
  rapikanSampulAwal,
  susulanEfektif,
  berkasVarianUkuran,
  halamanBawaan,
  hitungDaftarIsi,
  jenisLayarBerkas,
  kodeKertasSah,
  kodeTimpaBoleh,
  nilaiTimpaDaftarIsi,
  rangkaiCiri,
  saringNilaiTimpa,
  teksRentang,
  uraiHalaman,
  type BarisDasar,
} from "@/lib/berkas-perkara";
import { FITUR_BERKAS_PERKARA, KATALOG_FITUR_SATKER, keadaanFitur } from "@/lib/fitur-satker";
import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { bacaBawaan, bacaSunting, simpanBawaan, simpanSunting } from "@/server/modules/berkas-perkara/layanan";

/**
 * Sampul dan Daftar Isi Berkas (26 Okt 2026): lib murni, penyimpanan di ALETA (pg-mem), saklar bawaan mati,
 * migrasi 0112 sejajar DDL, dan layanan bot (hitung halaman, jenis berkas e-Court, fakta atas SIPP tiruan).
 */

const AKAR = path.resolve(__dirname, "../../..");
const muat = createRequire(import.meta.url);
const bot: any = muat(path.join(AKAR, "aleta_bot/services/berkasPerkaraService.js"));

const dasar = (bundel: "A" | "B", kunci: string, halaman: number, sumber: "pasti" | "perkiraan" = "pasti"): BarisDasar => ({
  bundel,
  grup: "G",
  kunci,
  nama: `Dok ${kunci}`,
  tanggal: "2026-01-02",
  halaman,
  sumber,
});

describe("A - lib murni", () => {
  it("berkas dan folder per ukuran kertas", () => {
    expect(berkasBlangko("sampul", "a4")).toMatchObject({ folder: "derry_briantono/99 PTSP", berkas: "Sampul Berkas Perkara.rtf", jenisFolder: "ptsp" });
    expect(berkasBlangko("sampul", "f4").berkas).toBe("Sampul Berkas Perkara (F4).rtf");
    expect(berkasBlangko("daftar-isi", "legal")).toMatchObject({ berkas: "Daftar Isi Berkas (Legal).rtf", jenisFolder: "bas" });
    expect(kodeKertasSah("f4")).toBe(true);
    expect(kodeKertasSah("a3")).toBe(false);
    expect(Object.keys(KERTAS)).toEqual(["a4", "f4", "legal"]);
  });

  it("sampul cetak awal bawaan; lengkap pilihan kedua; varian permohonan dan pihak banyak menurut perkara", () => {
    expect(berkasBlangko("sampul", "a4", {}).berkas).toBe("Sampul Berkas Perkara.rtf");
    expect(berkasBlangko("sampul", "a4", { bentuk: "lengkap" }).berkas).toBe("Sampul Berkas Perkara (Lengkap).rtf");
    expect(berkasBlangko("sampul", "f4", { bentuk: "lengkap" }).berkas).toBe("Sampul Berkas Perkara (Lengkap) (F4).rtf");
    expect(berkasBlangko("sampul", "a4", { lawan: false }).berkas).toBe("Sampul Berkas Perkara (Permohonan).rtf");
    expect(berkasBlangko("sampul", "legal", { lawan: true, banyak: true }).berkas).toBe("Sampul Berkas Perkara (Pihak Banyak) (Legal).rtf");
    expect(berkasBlangko("sampul", "a4", { lawan: false, banyak: true }).berkas).toBe("Sampul Berkas Perkara (Permohonan Pihak Banyak).rtf");
    expect(berkasBlangko("daftar-isi", "a4", { lawan: false, banyak: true }).berkas).toBe("Daftar Isi Berkas.rtf");
    // yang tampil di daftar blangko: cetak awal dan lengkap saja
    for (const n of ["Sampul Berkas Perkara (Permohonan).rtf", "Sampul Berkas Perkara (Pihak Banyak).rtf", "Sampul Berkas Perkara (Permohonan Pihak Banyak) (F4).rtf", "Sampul Berkas Perkara (Lengkap) (Legal).rtf"]) expect(berkasVarianUkuran(n), n).toBe(true);
    for (const n of ["Sampul Berkas Perkara.rtf", "Sampul Berkas Perkara (Lengkap).rtf", "Daftar Isi Berkas.rtf"]) expect(berkasVarianUkuran(n), n).toBe(false);
    expect(jenisLayarBerkas("derry_briantono/99 PTSP", "Sampul Berkas Perkara (Lengkap).rtf")).toBe("sampul");
    expect(bentukDariBerkas("Sampul Berkas Perkara (Lengkap).rtf")).toBe("lengkap");
    expect(bentukDariBerkas("Sampul Berkas Perkara.rtf")).toBe("awal");
  });

  it("ciri sampul awal: lencana tanpa verstek/mediasi/rekonvensi/sita, ghaib dan mafqud bingkai ganda sendiri", () => {
    const h = ciriSampulAwal({ ecourt: true, kuasa: true, ghaib: true, verstek: true, mediasi: true, sita: true, kumulasi: true }, { kuasa: "P+T", kumulasi: "2" });
    expect(h["5861"]).toBe("[■ e-COURT]  [■ KUASA HUKUM P+T]");
    expect(h["5807"]).toBe("[● GHAIB T]");
    expect(h["5808"]).toBe("");
    expect(ciriSampulAwal({}, {})["5861"]).toContain("tidak ada ciri khusus");
  });

  it("ciri susulan: daftar menurut jenis, deteksi otomatis tertanda (oto), tangan menimpa, tak terbaca tidak dicentang", () => {
    expect(daftarSusulan("cg", true).map((d) => d.kunci)).toEqual(["mediasi", "eksepsi", "rekonvensi", "sita", "setempat", "sela", "ubah", "panjar", "cabut"]);
    expect(daftarSusulan("dk", false).map((d) => d.nama)).toEqual(["PERBAIKAN PERMOHONAN", "PEMERIKSAAN SETEMPAT", "TAMBAHAN PANJAR", "PENCABUTAN", "ANAK & CALON DIDENGAR"]);
    expect(daftarSusulan("in", false).at(-1)?.nama).toBe("PENGUMUMAN 14 HARI");
    const daftar = daftarSusulan("cg", true);
    const ef = susulanEfektif(daftar, { sita: true, eksepsi: true }, { eksepsi: false, panjar: true });
    expect(ef).toMatchObject({ sita: true, eksepsi: false, panjar: true, mediasi: false });
    const teks = rangkaiSusulan(daftar, ef, { sita: true, eksepsi: true });
    expect(teks).toContain("[X] PERMINTAAN SITA (oto)");
    expect(teks).toContain("[ ] EKSEPSI");
    expect(teks).toContain("[X] TAMBAHAN PANJAR   ");
    expect(KUNCI_SUSULAN).toEqual(bot.KUNCI_SUSULAN);
  });

  it("rapikan sampul awal: kotak ASCII jadi karakter kotak, tanda titik kosong dibuang tanpa menyentuh titik panjang", () => {
    const r = rapikanSampulAwal("{\\rtf1 [ ] A [X] B ... {\\highlight3 ...} Kuasa: ... ................ 3.14 x...y}");
    expect(r).toContain("{\\f1\\u9744?} A {\\f1\\u9746?} B");
    expect(r).not.toContain("highlight");
    expect(r).toContain("Kuasa:  ................ 3.14 x...y");
    expect(rapikanSampulAwal("tanpa kotak")).toBe("tanpa kotak");
  });

  it("varian ukuran disembunyikan dari daftar, berkas dasar menjadi layar kerja", () => {
    expect(berkasVarianUkuran("Sampul Berkas Perkara (F4).rtf")).toBe(true);
    expect(berkasVarianUkuran("Daftar Isi Berkas (Legal).rtf")).toBe(true);
    expect(berkasVarianUkuran("Sampul Berkas Perkara.rtf")).toBe(false);
    expect(jenisLayarBerkas("derry_briantono/99 PTSP", "Sampul Berkas Perkara.rtf")).toBe("sampul");
    expect(jenisLayarBerkas("98b Berkas Perkara - BAS", "Daftar Isi Berkas.rtf")).toBe("daftar-isi");
    expect(jenisLayarBerkas("99 PTSP", "Lain.rtf")).toBe("");
  });

  it("25 ciri tanpa NON e-COURT; rangkaian kosong = kalimat netral", () => {
    expect(DAFTAR_CIRI).toHaveLength(25);
    expect(DAFTAR_CIRI.some((c) => /non/i.test(c.nama))).toBe(false);
    expect(rangkaiCiri([])).toContain("tidak ada ciri khusus");
    expect(rangkaiCiri(["prodeo", "verstek"])).toContain("PRODEO");
  });

  it("halaman: otomatis, jumlah, rentang, salah", () => {
    expect(uraiHalaman("").tipe).toBe("oto");
    expect(uraiHalaman("3")).toEqual({ tipe: "jumlah", n: 3 });
    expect(uraiHalaman("5-9")).toEqual({ tipe: "rentang", a: 5, b: 9 });
    expect(uraiHalaman("abc").tipe).toBe("salah");
    expect(uraiHalaman("0").tipe).toBe("salah");
  });

  it("daftar isi: kumulatif per bundel, Bundel B mulai dari 1, sembunyi tidak dihitung, rentang manual terkunci", () => {
    const baris = [dasar("A", "a1", 3), dasar("A", "a2", 2, "perkiraan"), dasar("A", "a3", 4), dasar("B", "b1", 5), dasar("B", "b2", 1)];
    const h = hitungDaftarIsi(baris, {}, {});
    const a = h.baris.filter((b) => b.bundel === "A");
    expect(a.map((b) => [b.awal, b.akhir])).toEqual([[1, 3], [4, 5], [6, 9]]);
    expect(h.baris.filter((b) => b.bundel === "B").map((b) => [b.awal, b.akhir])).toEqual([[1, 5], [6, 6]]);
    expect(h.total.A).toMatchObject({ dokumen: 3, halaman: 9, perkiraan: 2, pasti: 7 });
    const sembunyi = hitungDaftarIsi(baris, { a2: { tampil: false } }, {});
    expect(sembunyi.total.A.halaman).toBe(7);
    expect(sembunyi.baris.find((b) => b.kunci === "a3")?.awal).toBe(4);
    const manual = hitungDaftarIsi(baris, { a2: { halamanTeks: "6-7" } }, {});
    expect(manual.baris.find((b) => b.kunci === "a2")).toMatchObject({ awal: 6, akhir: 7, sumberAkhir: "manual" });
    expect(manual.baris.find((b) => b.kunci === "a2")?.peringatan).toContain("terlewat");
    const lanjut = hitungDaftarIsi(baris, {}, { bundelB: "lanjut" });
    expect(lanjut.baris.find((b) => b.kunci === "b1")?.awal).toBe(10);
    expect(teksRentang({ awal: 1, akhir: 3 })).toBe("1-3");
    expect(teksRentang({ awal: 4, akhir: 4 })).toBe("4");
  });

  it("nilai timpa daftar isi memakai kode 5851-5859 dan hanya blok paket yang lolos saringan", () => {
    const n = nilaiTimpaDaftarIsi(hitungDaftarIsi([dasar("A", "a1", 2)], {}, {}).baris);
    expect(Object.keys(n).sort()).toEqual(["5851", "5852", "5853", "5854", "5856", "5857", "5858", "5859"]);
    expect(kodeTimpaBoleh("5801")).toBe(true);
    expect(kodeTimpaBoleh("5700")).toBe(true);
    expect(kodeTimpaBoleh("5890")).toBe(true);
    expect(kodeTimpaBoleh("5900")).toBe(false);
    expect(kodeTimpaBoleh("0001")).toBe(false);
    expect(saringNilaiTimpa({ "5801": "ok", "5842": "Aleta", "9999": "x", "5802": 5 })).toEqual({ "5801": "ok" });
  });

  it("nilai bawaan halaman", () => {
    expect(halamanBawaan("putusan")).toBe(BAWAAN_HALAMAN.putusan);
    expect(halamanBawaan("putusan", { putusan: 21 })).toBe(21);
    expect(halamanBawaan("tidak-dikenal")).toBeGreaterThanOrEqual(1);
  });
});

describe("B - saklar dan migrasi", () => {
  it("saklar berkas-perkara-khusus ada di katalog dan bawaannya MATI", () => {
    const f = KATALOG_FITUR_SATKER.find((x) => x.kode === FITUR_BERKAS_PERKARA);
    expect(f).toBeTruthy();
    expect(f?.bawaan).toBe("mati");
    expect(keadaanFitur(FITUR_BERKAS_PERKARA, {}).menyala).toBe(false);
  });

  it("migrasi 0112 memuat tiga tabel, jurnal idx 98, tanpa kata aplikasi dalam DDL", () => {
    const sql = readFileSync(path.join(AKAR, "manajemen_surat/drizzle/0112_aleta_berkas_perkara.sql"), "utf8");
    for (const t of ["aleta_berkas_susunan", "aleta_berkas_sampul", "aleta_berkas_bawaan"]) expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${t}`);
    const jurnal = JSON.parse(readFileSync(path.join(AKAR, "manajemen_surat/drizzle/meta/_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string }> };
    const e = jurnal.entries.find((x) => x.tag === "0112_aleta_berkas_perkara");
    expect(e?.idx).toBe(98);
    expect(jurnal.entries.filter((x) => x.idx === 98)).toHaveLength(1);
    for (const t of ["aleta_berkas_susunan", "aleta_berkas_sampul", "aleta_berkas_bawaan"]) expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain(t);
  });
});

describe("C - penyimpanan sunting di ALETA (pg-mem)", () => {
  let db: AletaDatabase;
  beforeAll(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: false });
  });
  afterAll(async () => {
    await db.close();
  });

  it("simpan, baca ulang, dan timpa seluruhnya", async () => {
    const r = await simpanSunting(db, {
      perkaraId: "77",
      nomor: "1/Pdt.G/2026/PA.Cth",
      aktor: "Derry",
      susunan: [
        { bundel: "A", kunci: "bas:1", halamanTeks: "4", tampil: true },
        { bundel: "A", kunci: "relaas:1:p", tampil: false },
        { bundel: "B", kunci: "x1", tambahan: true, judulManual: "Surat lain", tanggalManual: "2 Januari 2026", halamanTeks: "2" },
      ],
      tag: { prodeo: true, verstek: false },
      isian: { "5845": "catatan tangan" },
    });
    expect(r).toMatchObject({ ok: true, susunan: 3, tag: 2, isian: 1, ditolak: [] });
    const s = await bacaSunting(db, "77");
    expect(s.susunan["A:bas:1"]).toMatchObject({ halamanTeks: "4", tampil: true });
    expect(s.susunan["A:relaas:1:p"].tampil).toBe(false);
    expect(s.susunan["B:x1"]).toMatchObject({ tambahan: true, judulManual: "Surat lain" });
    expect(s.tag).toEqual({ prodeo: true, verstek: false });
    expect(s.isian["5845"]).toBe("catatan tangan");
    await simpanSunting(db, { perkaraId: "77", aktor: "Derry", susunan: [{ bundel: "A", kunci: "bas:2" }] });
    const lagi = await bacaSunting(db, "77");
    expect(Object.keys(lagi.susunan)).toEqual(["A:bas:2"]);
    expect(lagi.tag).toEqual({ prodeo: true, verstek: false });
  });

  it("menolak halaman salah, ciri tak dikenal, dan teks bernama aplikasi; perkara lain tak tersentuh", async () => {
    await simpanSunting(db, { perkaraId: "88", aktor: "x", susunan: [{ bundel: "A", kunci: "k1", halamanTeks: "2" }] });
    const r = await simpanSunting(db, {
      perkaraId: "99",
      aktor: "x",
      susunan: [
        { bundel: "A", kunci: "k1", halamanTeks: "dua" },
        { bundel: "A", kunci: "k2", judulManual: "dari Aleta" },
        { bundel: "A", kunci: "k3", halamanTeks: "1" },
        { bundel: "Z", kunci: "k4" },
      ],
      tag: { naga: true },
      isian: { a: "ada Aleta di sini", b: "aman" },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.susunan).toBe(1);
      expect(r.ditolak.length).toBe(5);
      expect(r.tag).toBe(0);
      expect(r.isian).toBe(1);
    }
    expect((await bacaSunting(db, "88")).susunan["A:k1"].halamanTeks).toBe("2");
    expect((await simpanSunting(db, { perkaraId: "x1", aktor: "x" })).ok).toBe(false);
  });

  it("bawaan halaman: simpan dan perbarui", async () => {
    expect(await simpanBawaan(db, { putusan: { halaman: 17, contoh: 40 }, "bad key": { halaman: 3, contoh: 1 } })).toBe(1);
    expect((await bacaBawaan(db)).putusan).toBe(17);
    await simpanBawaan(db, { putusan: { halaman: 19, contoh: 50 } });
    expect((await bacaBawaan(db)).putusan).toBe(19);
  });
});

/** PDF minimal berisi n halaman, dengan akar /Pages berhitungan /Count benar. */
function pdfTiruan(n: number, hitungSalah?: number): Buffer {
  const anak = Array.from({ length: n }, (_, i) => `${3 + i} 0 R`).join(" ");
  let s = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  s += `2 0 obj\n<< /Type /Pages /Kids [${anak}] /Count ${hitungSalah ?? n} >>\nendobj\n`;
  for (let i = 0; i < n; i += 1) s += `${3 + i} 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\n`;
  return Buffer.from(s + "trailer\n<< /Root 1 0 R >>\n%%EOF\n", "latin1");
}

describe("D - layanan bot (baca saja)", () => {
  it("struktur PDF: dua cara sepakat = pasti; tidak sepakat = ragu tanpa pdf-lib", async () => {
    expect(bot.strukturPdf(pdfTiruan(5))).toMatchObject({ count: 5, objek: 5 });
    expect(await bot.halamanPdf(pdfTiruan(5), { pdfLib: null })).toEqual({ halaman: 5, metode: "struktur", ragu: false });
    const beda = await bot.halamanPdf(pdfTiruan(4, 9), { pdfLib: null });
    expect(beda.ragu).toBe(true);
    expect(await bot.halamanPdf(Buffer.from("bukan pdf"), { pdfLib: null })).toBeNull();
  });

  it("pdf-lib menjadi juri bila ada dan dua cara berbeda", async () => {
    const lib = { PDFDocument: { load: async () => ({ getPageCount: () => 4 }) } };
    expect(await bot.halamanPdf(pdfTiruan(4, 9), { pdfLib: lib })).toEqual({ halaman: 4, metode: "pdf-lib", ragu: false });
  });

  it("DOCX: halaman dari docProps/app.xml", () => {
    const xml = Buffer.from("<Properties><Pages>7</Pages></Properties>");
    const nama = Buffer.from("docProps/app.xml");
    const data = zlib.deflateRawSync(xml);
    const lokal = Buffer.alloc(30);
    lokal.writeUInt32LE(0x04034b50, 0);
    lokal.writeUInt16LE(nama.length, 26);
    const berkasLokal = Buffer.concat([lokal, nama, data]);
    const pusat = Buffer.alloc(46);
    pusat.writeUInt32LE(0x02014b50, 0);
    pusat.writeUInt16LE(8, 10);
    pusat.writeUInt32LE(data.length, 20);
    pusat.writeUInt16LE(nama.length, 28);
    pusat.writeUInt32LE(0, 42);
    const dirPusat = Buffer.concat([pusat, nama]);
    const akhir = Buffer.alloc(22);
    akhir.writeUInt32LE(0x06054b50, 0);
    akhir.writeUInt16LE(1, 10);
    akhir.writeUInt32LE(dirPusat.length, 12);
    akhir.writeUInt32LE(berkasLokal.length, 16);
    const zip = Buffer.concat([berkasLokal, dirPusat, akhir]);
    expect(bot.halamanDocx(zip)).toEqual({ halaman: 7, metode: "app.xml", ragu: false });
    expect(bot.halamanDocx(Buffer.from("bukan zip"))).toBeNull();
  });

  it("jalur SIPP hanya resources/file/doc dan tanpa naik direktori", () => {
    const ada = () => true;
    expect(bot.jalurSipp("resources/file/doc/2026/01/a.pdf", ["/akar"], { ada })).toContain("a.pdf");
    expect(bot.jalurSipp("../etc/passwd", ["/akar"], { ada })).toBe("");
    expect(bot.jalurSipp("resources/file/doc/../../x", ["/akar"], { ada })).toBe("");
    expect(bot.jalurSipp("/abs/a.pdf", ["/akar"], { ada })).toBe("");
  });

  it("jenis berkas e-Court dari nama, median, id jenis perkara", () => {
    expect(bot.jenisEcourt("Surat Gugatan__ab12cd.pdf")).toBe("gugatan");
    expect(bot.jenisEcourt("Dokumen Bukti 1.pdf")).toBe("bukti");
    expect(bot.jenisEcourt("foto.jpg")).toBe("");
    expect(bot.median([3, 1, 2, 10])).toBe(2);
    expect(bot.median([])).toBeNull();
    expect(bot.KUNCI_JENIS[362]).toBe("dk");
    expect(bot.KUNCI_JENIS[347]).toBe("cg");
  });

  it("fakta: perkara tidak ada dijawab jujur; perkara dasar menghasilkan dokumen dan ciri tanpa menulis apa pun", async () => {
    const kosong = await bot.fakta({ perkaraId: 5 }, { kueri: async () => [] });
    expect(kosong.ok).toBe(false);
    const sql: string[] = [];
    const kueri = async (teks: string) => {
      sql.push(teks);
      if (/FROM perkara WHERE perkara_id/.test(teks)) return [{ perkara_id: 5, nomor_perkara: "5/Pdt.G/2026/PA.Cth", jenis_perkara_id: 347, alur_perkara_id: 15, prodeo: 1, tanggal_pendaftaran: "2026-01-05", tanggal_surat: "2026-01-04", petitum: "", posita: "" }];
      if (/FROM perkara_penetapan/.test(teks)) return [{ penetapan_hari_sidang: "2026-01-08" }];
      if (/FROM perkara_jadwal_sidang/.test(teks)) return [{ id: 1, tanggal_sidang: "2026-02-01", agenda: "Pembacaan gugatan", alasan_ditunda: "", sidang_keliling: "T", dihadiri_oleh: 1, ikrar_talak: "T", verzet: "T", edoc_bas: "" }];
      return [];
    };
    const f = await bot.fakta(
      { perkaraId: 5 },
      { kueri, akarEcourt: "/tidak/ada", penanda: { bahanPenanda: async () => ({ terbaca: {} }), ruasBaris: () => ({ penandaPerkara: { ghaib: false, prodeo: true }, penandaPihak: [{ kunci: "PNS", sisi: 2 }] }) }, kumulasi: { kumulasiBanyakPerkara: async () => ({}) } }
    );
    expect(f.ok).toBe(true);
    expect(f.perkara).toMatchObject({ jenis: "cg", permohonan: false });
    expect(f.ciri.prodeo).toBeTruthy();
    expect(f.ciri.pns).toMatchObject({ sisi: "T" });
    expect(f.dokumen.some((d: { kunci: string }) => d.kunci === "gugatan")).toBe(true);
    expect(f.dokumen.find((d: { kunci: string }) => d.kunci === "phs")).toMatchObject({ bundel: "A", sumber: "perkiraan" });
    expect(f.riwayat[0]).toMatchObject({ ke: 1, hadir: "P T" });
    // baca saja: tidak ada kueri tulis
    expect(sql.some((q) => /^\s*(INSERT|UPDATE|DELETE|REPLACE|ALTER|DROP)/i.test(q))).toBe(false);
  });
});
