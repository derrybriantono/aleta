// @vitest-environment node
/**
 * ============================================================================
 * KUASA HUKUM DARI SURAT GUGATAN e-COURT (9 Okt 2026, butir 1-4 KUASA)
 * ============================================================================
 *
 * Contoh di bawah ditiru dari BENTUK gugatan ber-kuasa sungguhan di arsip
 * e-Court satker (perkara 273-602/Pdt.G/2026), dengan nama orang, kantor,
 * alamat, dan nomor DIGANTI. Diukur atas teksnya yang asli 9 Okt 2026
 * (D:/aleta-dev/kerja/abt-kuasa/ukur-hasil.json):
 *
 *   22 perkara ber-kuasa Penggugat (SIPP) yang gugatannya ada di arsip:
 *     21 menyebut kuasa (1 ditandatangani pihak sendiri - benar tidak terdeteksi)
 *     tanggal surat kuasa 20/20 yang menyebutnya, nama kantor 19/19, alamat 21/21
 *   10 pindaian lewat OCR server: hasil sama dengan lapisan teksnya
 *   40 gugatan tanpa kuasa: 0 salah tangkap
 */
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { gabungNama, isianAmanAbt, namaKantor, uraiKuasaGugatan } from "@/lib/kuasa-gugatan";
import {
  advokatSipp,
  bacaKuasaGugatan,
  pilihDokumenGugatan,
  susunUsulanKuasa,
  type BarisKuasaSipp,
} from "@/server/modules/aleta-ecourt/kuasa-gugatan";

// ─── Contoh gugatan (disamarkan) ─────────────────────────────────────────────

/** 273: kuasa SESUDAH identitas pemberi kuasa, nama kantor berkutip lengkung. */
const G_KUTIP = `Kepada Yth. Ketua Pengadilan Agama Donggala
Yang bertanda tangan di bawah ini:
Nama HASAN bin TAHIR Nik, 7203301005990009 umur 27 tahun, alamat Desa Ogoamas, Kecamatan Sojol Utara Kabupaten Donggala untuk selanjutnya disebut Penggugat yang dalam Perkara ini diwakilkan kepada Kuasanya :
DERRY BRIANTONO.,S.H.,M.H
ANDI SAPUTRA,SH
Keduanya Advokat Pengacara dan Konsultan Hukum Pada Kantor Hukum “DERRY & PARTNER’S” berkedudukan hukum di Jalan Dayodara II, Perumahan CPI IV Blok E No. 2, Kel. Talise Kec. Mantikulore, Kota Palu Provinsi Sulawesi Tengah. Dalam hal ini, berdasarkan Surat Kuasa Khusus tanggal 11 April 2026, selanjutnya disebut Penggugat;-----
M E L A W A N
SYAMSUL BIN ZAINUDDIN, pekerjaan wiraswasta alamat Jalan Cumi-cumi Nomor 25 kelurahan Lere. Selanjutnya disebut tergugat;
Bahwa pernikahan dicatat oleh Kantor Urusan Agama Kecamatan Sojol;`;

/** 308: "Kami ... pada X LAW OFFICE, beralamat di ..." sebelum identitas. */
const G_LAW_OFFICE = `Perihal : Gugatan Harta Bersama
Kepada Yth. Ketua Pengadilan Agama Donggala
Dengan Hormat,
Kami yang bertandatangan di bawah ini:
ADV. ZAINAL, S.H.,
ADV. ADI PRATAMA, S.H.,

Masing-masing sebagai Advokat dan Konsultan Hukum pada SIGIPALU FOR JUSTICE LAW OFFICE, beralamat di Jl. Mangga (Triple F Coffee & Café) Lantai 1, No. 30, Kelurahan Besusu Timur, Kecamatan Palu Timur, Kota Palu, Alamat elektronik kantor: kantor@contoh.id Berdasarkan Surat Kuasa Khusus tanggal 11 Mei 2026 selaku kuasa hukum, bertindak untuk dan atas nama: RINA binti KAMEDI. Selanjutnya disebut sebagai Penggugat.
Dengan ini mengajukan Gugatan Harta Bersama terhadap: ANDI bin MASUD, selanjutnya disebut sebagai Tergugat.`;

/** 324: kop surat + kutip pembuka tanpa penutup; tanggal "tertanggal". */
const G_KOP = `KANTOR ADVOKAT & KONSULTAN HUKUM
NUR, AMI, AZIZ. & PARTNERS
Jl.Sungai Wera No. 160 Kel. Ujuna Contact Person 0812
Kepada Yth. Ketua Pengadilan Agama Donggala
Yang bertanda tangan di bawah ini :
Nama : ANJAS Bin MARWAN, selanjutnya disebut sebagai PEMOHON.
Dalam hal ini memberikan kuasa penuh Kepada :
Hj. NURHANA, SH.
AMINUDIN K, SH, MH.
AZIZ MARHUM, SH.
Ketiganya adalah Advokat/Konsultan Hukum yang berdomisili Hukum pada kantor Advokat/Konsultan Hukum “NUR, AMI, AZIZ & PARTNERS yang beralamat di jalan Sungai Wera No.160, Kel. Ujuna, Kec. Palu Barat, Kota Palu, Provinsi Sulawesi Tengah, Alamat domisili Elektronik Email:nurhana@contoh.id bertindak untuk dan atas nama Pemberi Kuasa/Pemohon, berdasarkan Surat Kuasa Khusus tertanggal 27 Mei 2026, selanjutnya disebut sebagai Kuasa PEMOHON
Dalam hal ini hendak mengajukan Permohonan Cerai Talak terhadap Isteri yang bernama: NURDIAH Binti SUWARNO`;

/** 371: organisasi bantuan hukum dengan sebutan pendek; alamat jauh sesudah nama. */
const G_ORGANISASI = `Perihal: Gugatan Cerai
Kepada Yth, Ketua Pengadilan Agama Donggala
Dengan Hormat,
Kami yang bertandatangan dibawah ini:
ADV. ZAINAL, S.H.,
Masing- masing sebagai Advokat dan Konsultan Hukum pada Organisasi Bantuan Hukum Pos Bantuan Hukum Advokad Indonesia Sigi Biromaru, atau yang disebut POSBAKUMADIN SIGI BIROMARU, Unit Kerja Sulawesi Tengah, Kabupaten Sigi, Badan Hukum Nomor: AHU-0000.AH.01.04. Tahun 2011, yang beralamat kantor di JL. Trans Palu- Bangga, Desa Sibedi, Kecamatan Marawola, Kabupaten Sigi, Provinsi Sulawesi Tengah, Dengan Alamat elektronik Email: pos@contoh.id. Berdasarkan surat kuasa khusus Tanggal 06 Juni 2026, Bertindak untuk dan atas nama:
SILVA Binti ASMARA, beralamat di Desa POI. Untuk selanjutnya disebut sebagai Penggugat.
Dengan ini mengajukan Gugatan Cerai terhadap: GAFUR Bin HATA`;

/** 389: advokat perorangan tanpa nama kantor, tanpa tanggal surat kuasa. */
const G_PERORANGAN = `Kepada Yth Ketua Pengadilan Agama Donggala
Yang bertanda tangan di bawah ini:
 Nama : AHMAD S. MARDI, SH.
 Pekerjaan : Advokat/Pengacara
 Alamat : Jl. Banawa No. 50, RT/RW: 003/005, Kelurahan Ganti, Kecamatan Banawa Kabupaten Donggala, Provinsi Sulawesi Tengah.
 Alamat elektronik : ahmad@contoh.id.
Dalam hal ini bertindak untuk dan atas nama serta mewakili:
 Nama : ILHAM Bin MARJAN
Untuk selanjutnya disebut Pemohon.
Dengan ini mengajukan Permohonan Cerai Talak terhadap: AZIZAH Binti RAGA`;

/** 535: kop berkata "KANTOR Pengacara / Alamat :" - yang dipakai kalimat badan surat. */
const G_REKAN = `ADVOKAT/ HUKUM     IDA NURITA, S.H,  DAN  REKAN
KANTOR   Pengacara
Alamat : Jln. Anggur , Kel, Boyaoge, Kec. Tatanga Kota Palu Sulawesi Tengah
Email : ida@contoh.id
KepadaYth : Ketua Pengadilan Agama Donggala
Dengan Hormat
Yang Bertanda Tangan dibawah ini ;
FIKRI binti ANWAR, tempat tinggal di BTN Gonenggati, Kecamatan Banawa.
Dalam hal ini diwakili oleh Kuasa Hukumnya : IDA NURITA,S.H Dan JAMILAH,S.H. . Keduanya adalah  Advokat  pada Kantor  IDA NURITA,S.H, DAN REKAN , beralamat di Jln. Anggur, Kel, Boyaoge, Kec. Tatanga Kota Palu, Propinsi  Sulawesi Tengah. Sebagaimana Surat Kuasa Khusus tertanggal 13 Agustus 2026. Selanjutnya disebut sebagai PENGGUGAT
Dengan ini mengajukan Permohonan Cerai Gugat  terhadap :
FIAN bin TASLIM, alamat kantor dijalan Jati No.1 (Kantor Dinas Komunikasi Kabupaten Donggala)`;

/** 451 (PDF): nama LBH berkutip yang terpotong baris. */
const G_LBH = `Gugatan Cerai
Hal 1
LEMBAGA BANTUAN HUKUM
SULAWESI TENGAH
Kepada Yth , Ketua Pengadilan Agama Donggala
Dengan hormat,
Kami yang bertanda tangan di bawah ini :
1. ABDU RAHMAN, S.H;
2. MEY PRAWESTY, S.H;
Kesemuanya adalah Advokat pada kantor “LEMBAGA BANTUAN HUKUM
SULAWESI TENGAH” yang berkedudukan di Jl. Yojokodi No. 67 Kelurahan Besusu
Tengah Kecamatan Palu Timur Kota Palu Provinsi Sulawesi Tengah dengan domisili
elektronik email : lbh@contoh.id . Berdasarkan Surat Kuasa
Khusus tertanggal 06 Juli 2026 ( terlampir ), bertindak untuk dan atas nama :
RUBIA BINTI USMIN, selanjutnya disebut sebagai Penggugat ;
Dengan ini mengajukan cerai gugat terhadap :`;

/** Gugatan tanpa kuasa: "Kantor Urusan Agama" di posita tidak boleh terbaca kantor kuasa. */
const G_TANPA = `Kepada Yth. Ketua Pengadilan Agama Donggala
Yang bertanda tangan di bawah ini:
Nama : SITI binti LATIF, umur 30 tahun, alamat Desa Towale, selanjutnya disebut Penggugat.
Dengan ini mengajukan gugatan cerai terhadap: BUDI bin ALI, selanjutnya disebut Tergugat.
Bahwa Penggugat dan Tergugat menikah tanggal 1 Mei 2015 dicatat Kantor Urusan Agama Kecamatan Banawa;`;

describe("uraiKuasaGugatan - bentuk gugatan ber-kuasa sungguhan (disamarkan)", () => {
  it("kantor berkutip lengkung sesudah identitas pemberi kuasa (273)", () => {
    const h = uraiKuasaGugatan(G_KUTIP);
    expect(h.ada).toBe(true);
    expect(h.kantor?.nilai).toBe("DERRY & PARTNER’S");
    expect(h.tanggalSuratKuasa).toMatchObject({ nilai: "11/04/2026", iso: "2026-04-11" });
    expect(h.alamatKantor?.nilai).toBe("Jalan Dayodara II, Perumahan CPI IV Blok E No. 2, Kel. Talise Kec. Mantikulore, Kota Palu Provinsi Sulawesi Tengah");
    expect(h.advokat?.nilai).toEqual(["DERRY BRIANTONO, S.H., M.H", "ANDI SAPUTRA, SH"]);
  });

  it("LAW OFFICE sesudah 'pada'; alamat berhenti di alamat elektronik (308)", () => {
    const h = uraiKuasaGugatan(G_LAW_OFFICE);
    expect(h.kantor?.nilai).toBe("SIGIPALU FOR JUSTICE LAW OFFICE");
    expect(h.alamatKantor?.nilai).toBe("Jl. Mangga (Triple F Coffee & Café) Lantai 1, No. 30, Kelurahan Besusu Timur, Kecamatan Palu Timur, Kota Palu");
    expect(h.tanggalSuratKuasa?.iso).toBe("2026-05-11");
    expect(h.advokat?.nilai).toEqual(["ZAINAL, S.H.", "ADI PRATAMA, S.H."]);
  });

  it("kalimat badan surat mengalahkan kop; kutip pembuka tanpa penutup (324)", () => {
    const h = uraiKuasaGugatan(G_KOP);
    expect(h.kantor?.nilai).toBe("NUR, AMI, AZIZ & PARTNERS");
    expect(h.alamatKantor?.nilai).toBe("jalan Sungai Wera No.160, Kel. Ujuna, Kec. Palu Barat, Kota Palu, Provinsi Sulawesi Tengah");
    expect(h.tanggalSuratKuasa?.iso).toBe("2026-05-27");
    expect(h.advokat?.nilai).toEqual(["Hj. NURHANA, SH.", "AMINUDIN K, SH, MH.", "AZIZ MARHUM, SH."]);
  });

  it("organisasi bantuan hukum: sebutan pendeknya, alamat sesudah keterangan badan hukum (371)", () => {
    const h = uraiKuasaGugatan(G_ORGANISASI);
    expect(h.kantor?.nilai).toBe("POSBAKUMADIN SIGI BIROMARU");
    expect(h.alamatKantor?.nilai).toBe("JL. Trans Palu- Bangga, Desa Sibedi, Kecamatan Marawola, Kabupaten Sigi, Provinsi Sulawesi Tengah");
    expect(h.tanggalSuratKuasa?.iso).toBe("2026-06-06");
  });

  it("advokat perorangan: tanpa nama kantor dan tanpa tanggal - kosong, alamat dari 'Alamat :' (389)", () => {
    const h = uraiKuasaGugatan(G_PERORANGAN);
    expect(h.ada).toBe(true);
    expect(h.kantor).toBeNull();
    expect(h.tanggalSuratKuasa).toBeNull();
    expect(h.alamatKantor?.nilai).toBe("Jl. Banawa No. 50, RT/RW: 003/005, Kelurahan Ganti, Kecamatan Banawa Kabupaten Donggala, Provinsi Sulawesi Tengah");
    expect(h.advokat?.nilai).toEqual(["AHMAD S. MARDI, SH."]);
  });

  it("kop 'KANTOR Pengacara / Alamat :' tidak terbaca sebagai nama; kantor Tergugat diabaikan (535)", () => {
    const h = uraiKuasaGugatan(G_REKAN);
    expect(h.kantor?.nilai).toBe("IDA NURITA,S.H, DAN REKAN");
    expect(h.alamatKantor?.nilai).toBe("Jln. Anggur, Kel, Boyaoge, Kec. Tatanga Kota Palu, Propinsi Sulawesi Tengah");
    expect(h.tanggalSuratKuasa?.iso).toBe("2026-08-13");
  });

  it("nama LBH berkutip yang terpotong baris; 'Surat Kuasa / Khusus tertanggal' terpotong baris (451)", () => {
    const h = uraiKuasaGugatan(G_LBH);
    expect(h.kantor?.nilai).toBe("LEMBAGA BANTUAN HUKUM SULAWESI TENGAH");
    expect(h.alamatKantor?.nilai).toBe("Jl. Yojokodi No. 67 Kelurahan Besusu Tengah Kecamatan Palu Timur Kota Palu Provinsi Sulawesi Tengah");
    expect(h.tanggalSuratKuasa?.iso).toBe("2026-07-06");
  });

  it("gugatan tanpa kuasa: tidak ada yang terdeteksi, 'Kantor Urusan Agama' bukan kantor kuasa", () => {
    const h = uraiKuasaGugatan(G_TANPA);
    expect(h).toEqual({ ada: false, tanggalSuratKuasa: null, kantor: null, alamatKantor: null, advokat: null });
    expect(namaKantor("dicatat Kantor Urusan Agama Kecamatan Banawa")).toBeNull();
  });
});

describe("isian aman untuk literal SQL ABT", () => {
  it("kutip ganda & garis miring terbalik dibuang/diganti; tanda pisah jadi ASCII; kutip tunggal jadi U+2019 (aman di literal SQL berkutip tunggal, #7080#)", () => {
    expect(isianAmanAbt('Kantor Hukum “DERRY & PARTNER’S” – Palu\\Sigi "x"')).toBe("Kantor Hukum DERRY & PARTNER’S - Palu/Sigi x");
    expect(isianAmanAbt("  Jl.\n Mangga\t No. 1 ")).toBe("Jl. Mangga No. 1");
  });
  it("gabungNama: A / A dan B / A, B dan C", () => {
    expect(gabungNama(["A"])).toBe("A");
    expect(gabungNama(["A", "B"])).toBe("A dan B");
    expect(gabungNama(["A", "B", "C"])).toBe("A, B dan C");
  });
  it("nama kantor dari alamat_kantor SIPP ('Kantor Hukum GUMA Law Firm, Alamat: ...')", () => {
    expect(namaKantor("Kantor Hukum GUMA Law Firm,\nAlamat: The Mansion Office Fontana, Lantai 17")?.nama).toBe("GUMA Law Firm");
    expect(namaKantor("Jl. Padat Karya Blok KK BTN Tinggede")).toBeNull();
  });
});

// ─── Susunan usulan panel ────────────────────────────────────────────────────

const SIPP: BarisKuasaSipp[] = [
  { pihakKe: 1, urutan: 1, nama: "DERRY BRIANTONO, SH.,MH", alamat: "BTN Taman Ria", alamatKantor: "", nomorKuasa: "69/SK/VIII/2026", tanggalKuasa: "2026-08-11" },
  { pihakKe: 1, urutan: 2, nama: "Andi Saputra,S.H.", alamat: "Jl. Dayo", alamatKantor: "Jl. Dayo No. 2", nomorKuasa: "69/SK/VIII/2026", tanggalKuasa: "2026-08-11" },
  { pihakKe: 1, urutan: 3, nama: "Andi Saputra,S.H.", alamat: "Jl. Dayo", alamatKantor: "", nomorKuasa: "", tanggalKuasa: "" },
  { pihakKe: 2, urutan: 4, nama: "Kuasa Tergugat, S.H.", alamat: "Jl. Lain", alamatKantor: "", nomorKuasa: "70/SK/VIII/2026", tanggalKuasa: "2026-08-20" },
];
const peta = (u: Array<{ kode: string }>) => Object.fromEntries(u.map((x) => [x.kode, x])) as Record<string, any>;

describe("susunUsulanKuasa - #0156# #0184# #8538# #8537#", () => {
  it("dari lapisan teks gugatan: 'cukup' bertanda sumber gugatan-ecourt; advokat dari SIPP tanpa kembar dan tanpa kuasa Tergugat", () => {
    const daftar = susunUsulanKuasa({
      gugatan: uraiKuasaGugatan(G_KUTIP),
      sumberGugatan: { judul: "SURAT GUGATAN (Docx/Rtf)", documentKey: "k1", baca: "teks" },
      kuasaSipp: SIPP,
      tanggalDaftar: "2026-08-21",
    });
    expect(daftar.map((x) => x.kode)).toEqual(["0156", "0184", "8538", "8537"]);
    const u = peta(daftar);
    expect(u["0156"]).toMatchObject({ nilai: "DERRY & PARTNER’S", keyakinan: "cukup" });
    expect(u["0156"].sumber[0].asal).toBe("gugatan-ecourt");
    expect(u["0156"].sumber[0].kalimat).toContain('"SURAT GUGATAN (Docx/Rtf)" e-Court:');
    expect(u["0184"]).toMatchObject({ nilai: "11/04/2026", keyakinan: "cukup" });
    expect(u["8538"].nilai).toMatch(/^Jalan Dayodara II/);
    expect(u["8537"]).toMatchObject({ nilai: "DERRY BRIANTONO, SH.,MH dan Andi Saputra,S.H.", keyakinan: "pasti" });
    expect(u["8537"].sumber.map((s: any) => s.asal)).toEqual(["sipp", "gugatan-ecourt"]);
  });

  it("hasil OCR dan tanggal surat kuasa sesudah pendaftaran: 'ragu' (tidak dicentang sendiri)", () => {
    const u = peta(
      susunUsulanKuasa({
        gugatan: uraiKuasaGugatan(G_KUTIP),
        sumberGugatan: { judul: "Dokumen Gugatan", documentKey: "k2", baca: "ocr" },
        kuasaSipp: SIPP,
        tanggalDaftar: "2026-04-01",
      })
    );
    expect(u["0156"].keyakinan).toBe("ragu");
    expect(u["0156"].sumber[0].kalimat).toContain("(dibaca OCR)");
    expect(u["0184"].keyakinan).toBe("ragu");
    expect(u["0184"].catatan).toContain("SESUDAH tanggal pendaftaran");
  });

  it("gugatan tidak terbaca: kantor & alamat dari alamat_kantor SIPP ('ragu'), tanggal kosong dengan sebabnya", () => {
    const u = peta(
      susunUsulanKuasa({
        gugatan: null,
        sumberGugatan: null,
        kuasaSipp: [{ pihakKe: 1, urutan: 1, nama: "Syarif, S.H.", alamat: "BTN Nusantara", alamatKantor: "Kantor Hukum GUMA Law Firm,\nAlamat: The Mansion Office Fontana, Lantai 17", nomorKuasa: "", tanggalKuasa: "" }],
      })
    );
    expect(u["0156"]).toMatchObject({ nilai: "GUMA Law Firm", keyakinan: "ragu" });
    expect(u["0156"].sumber[0].asal).toBe("sipp");
    expect(u["8538"]).toMatchObject({ nilai: "The Mansion Office Fontana, Lantai 17", keyakinan: "ragu" });
    expect(u["0184"]).toMatchObject({ nilai: "", keyakinan: "kosong" });
    expect(u["0184"].catatan).toContain("tidak terbaca");
  });

  it("tanpa kuasa di gugatan maupun SIPP: semua kosong dengan sebabnya", () => {
    const u = susunUsulanKuasa({ gugatan: uraiKuasaGugatan(G_TANPA), sumberGugatan: { judul: "g", documentKey: "k", baca: "teks" }, kuasaSipp: [] });
    expect(u.every((x) => x.nilai === "" && x.keyakinan === "kosong")).toBe(true);
    expect(u[0].catatan).toContain("tidak menyebut kuasa hukum");
  });

  it("advokatSipp: urut menurut urutan, kembar (huruf besar/kecil, gelar) dibuang", () => {
    expect(advokatSipp(SIPP)).toEqual(["DERRY BRIANTONO, SH.,MH", "Andi Saputra,S.H."]);
  });
});

describe("bacaKuasaGugatan - memilih berkas", () => {
  it("surat gugatan Word lebih dulu; dokumen kuasa/bukti dan unggahan Tergugat tidak dibaca", () => {
    const d = pilihDokumenGugatan([
      { documentKey: "a", judulDokumen: "Dokumen Gugatan", adaPdf: true, adaWord: false, diunggahPada: "2026-08-01" },
      { documentKey: "b", judulDokumen: "SURAT GUGATAN (Docx/Rtf)", adaPdf: false, adaWord: true, diunggahPada: "2026-08-01" },
      { documentKey: "c", judulDokumen: "Surat Kuasa Khusus", adaPdf: true, adaWord: false },
      { documentKey: "d", judulDokumen: "Bukti Surat Gugatan", adaPdf: true, adaWord: false },
      { documentKey: "e", judulDokumen: "Jawaban atas gugatan", peranPengunggah: "Tergugat", adaPdf: true, adaWord: false },
    ]);
    expect(d.map((x) => x.documentKey)).toEqual(["b", "a"]);
  });

  it("berhenti pada berkas pertama yang menyebut kuasa; OCR dibolehkan sekali saja", async () => {
    const dibaca: string[] = [];
    const ocr: boolean[] = [];
    const h = await bacaKuasaGugatan("1/Pdt.G/2026/PA.Dgl", {
      rincian: async () => ({
        ok: true,
        dokumen: [
          { documentKey: "w", judulDokumen: "SURAT GUGATAN (Docx/Rtf)", adaPdf: false, adaWord: true },
          { documentKey: "p", judulDokumen: "Dokumen Gugatan", adaPdf: true, adaWord: false },
        ],
      }),
      ambilBerkas: async (key) => {
        dibaca.push(key);
        return Buffer.from(key);
      },
      bacaTeks: async (data, bolehOcr) => {
        ocr.push(bolehOcr);
        return data.toString() === "w" ? { teks: "", sumber: "", sebab: "teks_kosong" } : { teks: G_REKAN, sumber: "ocr", sebab: "" };
      },
      sipp: async () => ({ kuasaSipp: SIPP, tanggalDaftar: "2026-08-21" }),
    });
    expect(dibaca).toEqual(["w", "p"]);
    expect(ocr).toEqual([true, true]);
    expect(h.ada).toBe(true);
    expect(h.sumber).toEqual({ judul: "Dokumen Gugatan", documentKey: "p", baca: "ocr" });
    expect(h.usulan.find((u) => u.kode === "0156")).toMatchObject({ nilai: "IDA NURITA,S.H, DAN REKAN", keyakinan: "ragu" });
    expect(h.catatan[0]).toContain("teks tidak terbaca");
  });
});

// ─── Sisi bot: tanggal & nomor REGISTER kuasa khusus dari SIPP ────────────────

type Bot = {
  usulanKuasaSipp: (
    rows: Array<Record<string, unknown>>,
    opsi: { tanggalDaftar: string }
  ) => { kuasaSipp: Array<Record<string, unknown>>; usulan: Array<{ kode: string; nilai: string; keyakinan: string; catatan: string; nama: string }> };
};
const bot = createRequire(import.meta.url)(path.resolve(process.cwd(), "../aleta_bot/services/abtUsulanService.js")) as Bot;
const baris = (x: Record<string, unknown>) => ({ pihak_ke: 1, urutan: 1, nama: "A, S.H.", alamat: "", alamat_kantor: "", ...x });

describe("usulanKuasaSipp (bot) - #0132# = tanggal REGISTER, #8539# = nomor register", () => {
  it("bulan tanggal = bulan romawi nomor register: pasti - termasuk kuasa e-Court yang teregister sebelum perkaranya", () => {
    const u = peta(bot.usulanKuasaSipp([baris({ nomor_kuasa: "69/SK/VIII/2026", tanggal_kuasa: "2026-08-11" })], { tanggalDaftar: "2026-08-21" }).usulan);
    expect(u["0132"]).toMatchObject({ nilai: "11/08/2026", keyakinan: "pasti", nama: "Tgl. Register Kuasa Khusus Penggugat" });
    expect(u["8539"]).toMatchObject({ nilai: "69/SK/VIII/2026", keyakinan: "pasti" });
  });

  it("sebelum pendaftaran DAN bulannya beda dari register: itu tanggal surat kuasa - tidak diusulkan", () => {
    const u = peta(bot.usulanKuasaSipp([baris({ nomor_kuasa: "70/SK/VIII/2026", tanggal_kuasa: "2026-07-27" })], { tanggalDaftar: "2026-08-10" }).usulan);
    expect(u["0132"]).toMatchObject({ nilai: "", keyakinan: "ragu" });
    expect(u["0132"].catatan).toContain("tanggal SURAT KUASA");
  });

  it("#0156# tidak lagi diisi alamat advokat; kuasa Tergugat tidak dipakai untuk Penggugat", () => {
    const r = bot.usulanKuasaSipp(
      [baris({ pihak_ke: 2, nomor_kuasa: "71/SK/VIII/2026", tanggal_kuasa: "2026-08-20", alamat: "Jl. Tergugat" })],
      { tanggalDaftar: "2026-08-10" }
    );
    const u = peta(r.usulan);
    expect(u["0156"]).toMatchObject({ nilai: "", keyakinan: "kosong" });
    expect(u["0132"].nilai).toBe("");
    expect(u["8539"].nilai).toBe("");
    expect(r.kuasaSipp).toHaveLength(1);
  });
});
