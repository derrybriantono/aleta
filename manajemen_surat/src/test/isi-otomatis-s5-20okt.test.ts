// @vitest-environment node
/**
 * ============================================================================
 * 20 OKT 2026 - ISIAN OTOMATIS BLANGKO DERRY JENIS S5
 * dispensasi kawin (362), perwalian (354), asal usul anak (358), wali adhal (363), penetapan ahli waris / P3HP (371)
 * ============================================================================
 *
 * Yang dijaga (perilaku, bukan sekadar kode ada):
 *   A  pengisi per jenis (aleta_bot/services/isiOtomatisS5/*): data SIPP tiruan yang bentuknya disalin dari perkara sungguhan
 *      (nama diganti) -> nilai, keyakinan, dan keterangan yang benar; bila SIPP dan posita berbeda tidak ada usulan;
 *   B  usulanJenisS5 membaca SIPP lewat pembaca baca-saja (SELECT saja), jenis di luar S5 tidak disentuh, galat satu pembacaan
 *      tidak menggagalkan yang lain;
 *   C  mesin keputusan ekstensi: pasti/cukup + isian kosong = ditulis; ragu = saran; isian yang sudah ada tidak ditimpa; tanpa kata
 *      "ALETA" di nilai yang akan disimpan;
 *   D  petunjuk "diisi manual" + alasan dan isian opsional: salinan portal sama dengan bot; tidak menimpa isian yang sudah bertanda;
 *   E  jsdom: panel Blangko Derry sungguhan - usulan dari pengisi tadi terisi dan tersimpan ke ABT, yang ragu hanya saran, yang
 *      sudah diketik petugas tidak ditimpa, isian manual ditandai dengan alasannya.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { kodeTanyaJawab, kodeUntukNilai, statusNilaiLayar, susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import { PETUNJUK_ISIAN_S5, terapkanPetunjukS5 } from "@/app/api/aleta-ecourt/blangko-derry/petunjuk-s5";

const AKAR = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(AKAR, "aleta_bot", "package.json"));
const jalan = (...p: string[]) => path.join(AKAR, "aleta_bot", "services", ...p);

type Usulan = { kode: string; nama: string; nilai: string; keyakinan: string; sumber: Array<{ asal: string; kalimat: string }>; catatan: string; jagaIsianLama?: boolean; bentrok?: string };
type Data = Record<string, any>;
const S5 = require_(jalan("isiOtomatisJenisS5.js")) as {
  METADATA: Record<string, { manual?: boolean; alasan?: string; opsional?: boolean; labelPengguna?: string }>;
  berlaku: (kode: string, data: Data) => boolean;
  bacaData: (id: number, q: (sql: string, p?: unknown[]) => Promise<unknown>) => Promise<Data | null>;
  usulanDariData: (d: Data) => Usulan[];
  usulanJenisS5: (id: number, q: (sql: string, p?: unknown[]) => Promise<unknown>) => Promise<Usulan[]>;
};
const DK = require_(jalan("isiOtomatisS5", "dk.js")) as { pasangan: (m: Data[]) => { pria: Data | null; wanita: Data | null } };
const PAW = require_(jalan("isiOtomatisS5", "ahliWaris.js")) as {
  golongkan: (o: Data) => Record<string, any>;
  golonganTiada: (d: Data) => Record<string, boolean>;
  pecahDaftar: (t: string) => { butir: Array<{ nama: string; hubungan: string }>; berpenanda: boolean };
  pencairanDana: (t: string) => { nilai: string } | null;
  hartaPosita: (t: string) => { nilai: string } | null;
};
const PW = require_(jalan("isiOtomatisS5", "perwalian.js")) as { pemohonOrangTua: (p: string) => boolean | null };
const WA = require_(jalan("isiOtomatisS5", "waliAdhal.js")) as { statusPemohon: (p1: Data[], posita: string) => Usulan[] };
const BANTU = require_(jalan("isiOtomatisS5", "bantu.js")) as {
  umurTahun: (a: string, b: string) => number | null;
  rupiahBerbilang: (n: number) => string;
  isoKeTampil: (s: string) => string;
  samaNama: (a: string, b: string) => boolean;
};

const nilaiDari = (daftar: Usulan[], kode: string) => daftar.find((u) => u.kode === kode);
const kodeSemua = (daftar: Usulan[]) => daftar.map((u) => u.kode);

// ----------------------------------------------------------------------------
// Bahan: bentuk data disalin dari perkara sungguhan (nama diganti)
// ----------------------------------------------------------------------------
const POSITA_DK = `<p>1. Bahwa para Pemohon berencana akan menikahkan anak para Pemohon yang bernama Tri Wulandari binti Heru (calon mempelai wanita) dengan seorang laki-laki yang bernama Fadli bin Hasan (calon mempelai laki-laki);</p>
<p>2. Bahwa anak para Pemohon yang bernama Tri Wulandari binti Heru masih di bawah umur untuk persyaratan melangsungkan perkawinan yang sampai saat ini masih berusia 17 tahun;</p>
<p>3. Bahwa para Pemohon telah datang dan melapor ke Pegawai Pencatat Nikah Kantor Urusan Agama Kecamatan Sindue, Kabupaten Donggala, guna mencatatkan pernikahan anak para Pemohon tersebut, namun ditolak dengan alasan belum cukup umur;</p>
<p>4. Bahwa anak para Pemohon tersebut telah saling mengenal selama kurang lebih 1 (satu) tahun, agar terhindar dari pergaulan bebas dan perbuatan zina;</p>`;
const DATA_DK = (ubah: Data = {}): Data => ({
  perkaraId: 10095,
  perkara: { nomor: "223/Pdt.P/2026/PA.Dgl", jenisId: 362, alurId: 16, posita: POSITA_DK, petitum: "", tanggalDaftar: "2026-08-03" },
  pihak1: [],
  pihak2: [],
  mempelai: [
    { nama: "Fadli bin Hasan ", lahir: "1999-04-27", tempat: "Palu", pendidikan: "4", jenis: "1", pekerjaan: "15", nominal: "2500000", dimohonkan: "1" },
    { nama: "Tri Wulandari binti Heru", lahir: "2008-10-09", tempat: "Sibowi", pendidikan: "3", jenis: "2", pekerjaan: "3", nominal: "0", dimohonkan: "1" },
  ],
  anak: [],
  nikah: null,
  itsbat: null,
  alasanNikah: [{ alasanId: "5", nama: "MenghindariZina/HubunganCinta" }],
  ...ubah,
});

const POSITA_AUA = `1. Bahwa pada tanggal 06 Januari 2007 Pemohon I dan Pemohon II melangsungkan pernikahan menurut agama Islam di Kelurahan Labuan Bajo wilayah hukum Kantor Urusan Agama Kecamatan Banawa Kabupaten Donggala Provinsi Sulawesi Tengah; 2. Bahwa pada saat pernikahan tersebut Pemohon I berstatus Perjaka dalam usia 23 tahun, dan Pemohon II berstatus Janda dalam usia 28 tahun, Pernikahan dilangsungkan dengan wali nikah yang bernama Mansur Pelo (Ayah Kandung Pemohon II) dan yang menikahkan Imam Desa yang bernama Abu Rahman dan dihadiri 2 (dua) orang saksi nikah bernama Najib Hamid dan Hasan Basri, dengan mas kawin berupa cincin emas 3 gram dibayar tunai; 3. Bahwa setelah pernikahan Pemohon I dan Pemohon II hidup rukun dan telah dikaruniai 2 (dua) orang anak yang masing-masing Bernama: a. Fitrah bin Suryadi yang lahir di Donggala, pada tanggal 21 Februari 2008 b. Nurul binti Suryadi yang lahir di Donggala, pada tanggal 14 Desember 2009; 4. Bahwa anak tersebut belum memiliki akta kelahiran karena orang tuanya belum mencatatkan pernikahan secara resmi pada waktu itu;`;
const PETITUM_AUA = "PRIMER : 1. Mengabulkan permohonan Pemohon I dan Pemohon II; 2. Menetapkan 2 (dua) orang anak yang masing-masing benama: a. Fitrah bin Suryadi yang lahir di Donggala, pada tanggal 21 Februari 2008 b. Nurul binti Suryadi yang lahir di Donggala, pada tanggal 14 Desember 2009 Keduanya Adalah anak dari Pemohon I dan Pemohon II; 3. Menetapkan biaya perkara menurut hukum yang berlaku;";
const DATA_AUA = (ubah: Data = {}): Data => ({
  perkaraId: 10090,
  perkara: { nomor: "221/Pdt.P/2026/PA.Dgl", jenisId: 358, alurId: 16, posita: POSITA_AUA, petitum: PETITUM_AUA, tanggalDaftar: "2026-08-28" },
  pihak1: [],
  pihak2: [],
  mempelai: [],
  anak: [
    { nama: "Fitrah bin Suryadi", tempat: "Donggala", lahir: "2008-02-21", jk: "1", ke: "0" },
    { nama: "Nurul binti Suryadi", tempat: "Donggala", lahir: "2009-12-14", jk: "2", ke: "0" },
  ],
  nikah: null,
  itsbat: null,
  alasanNikah: [],
  ...ubah,
});

// P3HP: pewaris laki-laki, istri + 3 anak (pola nama bin Pewaris), dana BPJS
const POSITA_PAW = `1. Bahwa Almarhum Maulid Hakim bin Jamal telah meninggal dunia pada tanggal 13 Juni 2021 dikarenakan sakit; 2. Bahwa semasa hidupnya Alm. Maulid Hakim bin Jamal telah menikah dengan seorang Perempuan bernama Darma binti Tibe (Pemohon) pada tanggal 06 November 1992; 3. Bahwa Alm. Maulid Hakim bin Jamal meninggalkan Isteri, tiga orang anak dan juga meninggalkan Dana BPJS Ketenagakerjaan dengan nomor 22053736967 nama Maulid; 4. Bahwa maksud para Pemohon mengajukan permohonan untuk mencairkan dana tersebut; 5. Bahwa Pemohon bersedia membayar biaya perkara.`;
const PETITUM_PAW = "PRIMER : 1. Mengabulkan Permohonan Para Pemohon ; 2. Menyatakan bahwa Maulid Hakim bin Jamal telah meninggal dunia pada tanggal 13 Juni 2021; 3. Menetapkan ahli waris Maulid Hakim bin Jamal adalah: a. Darma binti Tibe, (Pemohon I); b. Fatimah binti Maulid Hakim, (Pemohon II); c. Akbar bin Maulid Hakim, (Pemohon III); d. Sulton bin Maulid Hakim (Pemohon IV) 4. Menetapkan Para Pemohon Ahli waris dari Maulid Hakim bin Jamal untuk pemberian izin untuk pencairan Dana Dana BPJS Ketenagakerjaan dengan nomor 22053736967 nama Maulid 5. Menetapkan biaya perkara menurut hukum yang berlaku.";
const DATA_PAW = (ubah: Data = {}): Data => ({
  perkaraId: 10172,
  perkara: { nomor: "229/Pdt.P/2026/PA.Dgl", jenisId: 371, alurId: 16, posita: POSITA_PAW, petitum: PETITUM_PAW, tanggalDaftar: "2026-09-02" },
  pihak1: [{ urutan: "1", nama: "Darma binti Tibe" }, { urutan: "2", nama: "Fatimah binti Maulid Hakim" }, { urutan: "3", nama: "Akbar bin Maulid Hakim" }, { urutan: "4", nama: "Sulton bin Maulid Hakim" }],
  pihak2: [],
  mempelai: [],
  anak: [],
  nikah: null,
  itsbat: null,
  alasanNikah: [],
  ...ubah,
});

// ============================================================================
describe("A1. dispensasi kawin: data calon mempelai SIPP", () => {
  it("nama, umur, tanggal lahir, pendidikan, pekerjaan, status dan alasan terisi dengan keyakinan yang benar", () => {
    const u = S5.usulanDariData(DATA_DK());
    // Nama sama dengan posita (spasi ujung SIPP dibuang) -> pasti, nama dengan bin/binti menurut SIPP.
    expect(nilaiDari(u, "0600")).toMatchObject({ nilai: "Fadli bin Hasan", keyakinan: "pasti" });
    expect(nilaiDari(u, "0606")).toMatchObject({ nilai: "Tri Wulandari binti Heru", keyakinan: "pasti" });
    // Umur pada tanggal pendaftaran: pria lahir 27 Apr 1999 -> 27 tahun (posita tidak menyebut -> cukup); wanita 9 Okt 2008 -> 17 tahun dan sama dengan posita -> pasti.
    expect(nilaiDari(u, "0601")).toMatchObject({ nilai: "27 tahun", keyakinan: "cukup" });
    expect(nilaiDari(u, "0607")).toMatchObject({ nilai: "17 tahun", keyakinan: "pasti" });
    expect(nilaiDari(u, "0349")).toMatchObject({ nilai: "09/10/2008", keyakinan: "cukup" });
    // Pendidikan kode 3 = SLTP (cukup); pekerjaan anak kode 3 = Pelajar (ragu: gaya tulis petugas beragam).
    expect(nilaiDari(u, "0609")).toMatchObject({ nilai: "SLTP", keyakinan: "cukup" });
    expect(nilaiDari(u, "0610")).toMatchObject({ nilai: "Pelajar", keyakinan: "ragu" });
    // Status: anak di bawah 19 tahun tanpa penyebutan duda/janda = gadis (cukup); pria dewasa 27 tahun = bujang hanya ragu.
    expect(nilaiDari(u, "2030")).toMatchObject({ nilai: "gadis", keyakinan: "cukup" });
    expect(nilaiDari(u, "2029")).toMatchObject({ nilai: "bujang", keyakinan: "ragu" });
    // Pekerjaan calon pria + penghasilan tercatat -> ragu dengan terbilang.
    expect(nilaiDari(u, "6331")).toMatchObject({ nilai: "karyawan swasta dengan penghasilan rata-rata sejumlah Rp2.500.000,00 (dua juta lima ratus ribu rupiah) per bulan", keyakinan: "ragu" });
    // Alasan mendesak dari kalimat posita.
    expect(nilaiDari(u, "9771")!.nilai).toMatch(/^agar terhindar dari pergaulan bebas dan perbuatan zina/);
  });

  it("setiap usulan membawa keterangan untuk ikon dan kutipan sumber; tanpa kata ALETA; selalu menjaga isian lama", () => {
    const u = S5.usulanDariData(DATA_DK());
    expect(u.length).toBeGreaterThan(8);
    for (const x of u) {
      expect(x.catatan.length, `catatan ${x.kode}`).toBeGreaterThan(10);
      expect(x.sumber.length, `sumber ${x.kode}`).toBeGreaterThan(0);
      expect(x.jagaIsianLama, `jaga ${x.kode}`).toBe(true);
      expect(JSON.stringify(x), x.kode).not.toMatch(/aleta/i);
      expect(["pasti", "cukup", "ragu"]).toContain(x.keyakinan);
    }
  });

  it("SIPP dan posita berbeda tentang umur: tidak ada usulan umur dari SIPP (bacaan posita yang lama berlaku)", () => {
    const d = DATA_DK();
    d.perkara.posita = d.perkara.posita.replace("17 tahun", "16 tahun");
    expect(nilaiDari(S5.usulanDariData(d), "0607")).toBeUndefined();
    // nama diri berbeda orang -> tidak ada usulan nama
    const e = DATA_DK();
    e.perkara.posita = e.perkara.posita.replace("Fadli bin Hasan", "Rizal bin Hasan");
    expect(nilaiDari(S5.usulanDariData(e), "0600")).toBeUndefined();
  });

  it("calon pria/wanita rancu (dua pria dimohonkan) tidak ditebak; penghasilan nol tidak membuat kalimat penghasilan", () => {
    const rancu = DATA_DK({
      mempelai: [
        { nama: "Anwar bin Basri", lahir: "2000-01-01", jenis: "1", pendidikan: "4", pekerjaan: "15", nominal: "0", dimohonkan: "1" },
        { nama: "Chandra bin Darwis", lahir: "2001-01-01", jenis: "1", pendidikan: "4", pekerjaan: "15", nominal: "0", dimohonkan: "1" },
        { nama: "Elsa binti Fauzi", lahir: "2009-01-01", jenis: "2", pendidikan: "3", pekerjaan: "3", nominal: "0", dimohonkan: "1" },
      ],
    });
    rancu.perkara.posita = "Bahwa para Pemohon mengajukan dispensasi kawin untuk anaknya.";
    const u = S5.usulanDariData(rancu);
    expect(nilaiDari(u, "0600")).toBeUndefined();
    expect(nilaiDari(u, "0606")).toBeDefined();
    expect(DK.pasangan(rancu.mempelai).pria).toBeNull();
    const tanpaUang = S5.usulanDariData(DATA_DK({ mempelai: [{ nama: "Fadli bin Hasan", lahir: "1999-04-27", jenis: "1", pendidikan: "4", pekerjaan: "15", nominal: "0", dimohonkan: "1" }, DATA_DK().mempelai[1]] }));
    expect(nilaiDari(tanpaUang, "6331")!.nilai).toBe("karyawan swasta");
    expect(nilaiDari(tanpaUang, "6331")!.catatan).toMatch(/penghasilan rata-rata tidak tercatat/);
  });

  it("calon yang posita-nya menyebut janda/duda tidak diberi status bujang/gadis", () => {
    const d = DATA_DK();
    d.perkara.posita += "<p>5. Bahwa calon mempelai laki-laki Fadli bin Hasan berstatus duda cerai;</p>";
    expect(nilaiDari(S5.usulanDariData(d), "2029")).toBeUndefined();
    expect(nilaiDari(S5.usulanDariData(d), "2030")).toBeDefined();
  });

  it("tanggal lahir kosong atau tak sah (0000-00-00) tidak menghasilkan umur", () => {
    const d = DATA_DK({ mempelai: [{ nama: "A bin B", lahir: "0000-00-00", jenis: "1", pendidikan: "0", pekerjaan: "0", nominal: "0", dimohonkan: "1" }, { nama: "C binti D", lahir: "", jenis: "2", pendidikan: "0", pekerjaan: "0", nominal: "0", dimohonkan: "1" }] });
    const u = S5.usulanDariData(d);
    expect(kodeSemua(u)).not.toContain("0601");
    expect(kodeSemua(u)).not.toContain("0607");
    expect(kodeSemua(u)).not.toContain("0349");
  });
});

describe("A2. asal usul anak: fakta nikah dari posita dan data anak SIPP", () => {
  it("fakta nikah dibaca dengan pengurai itsbat; nama anak dan tempat-tanggal lahir dari data anak SIPP", () => {
    const u = S5.usulanDariData(DATA_AUA());
    expect(nilaiDari(u, "0650")).toMatchObject({ nilai: "Najib Hamid", keyakinan: "cukup" });
    expect(nilaiDari(u, "0651")).toMatchObject({ nilai: "Hasan Basri", keyakinan: "cukup" });
    expect(nilaiDari(u, "1002")).toMatchObject({ nilai: "Perjaka", keyakinan: "cukup" });
    expect(nilaiDari(u, "1046")!.nilai).toMatch(/Ayah Kandung/i);
    // Tanggal nikah, umur, yang menikahkan dan mas kawin lebih rendah ketepatannya pada itsbat: hanya saran.
    for (const k of ["5197", "7211", "8087", "1001"]) expect(nilaiDari(u, k)?.keyakinan, k).toBe("ragu");
    expect(nilaiDari(u, "8603")).toMatchObject({ nilai: "Fitrah bin Suryadi, Nurul binti Suryadi", keyakinan: "pasti" });
    // Dua anak: nama masing-masing di depan tempat-tanggal lahir, hanya saran.
    expect(nilaiDari(u, "9709")).toMatchObject({ keyakinan: "ragu" });
    expect(nilaiDari(u, "9709")!.nilai).toBe("Fitrah bin Suryadi di Donggala pada tanggal 21 Februari 2008; Nurul binti Suryadi di Donggala pada tanggal 14 Desember 2009");
    expect(nilaiDari(u, "9710")!.nilai).toMatch(/^orang tuanya belum mencatatkan pernikahan secara resmi/);
  });

  it("satu anak: tempat-tanggal lahir cukup dalam bentuk isian (di ... pada tanggal ...)", () => {
    const u = S5.usulanDariData(DATA_AUA({ anak: [{ nama: "Fitrah bin Suryadi", tempat: "Donggala", lahir: "2008-02-21", jk: "1", ke: "0" }] }));
    expect(nilaiDari(u, "9709")).toMatchObject({ nilai: "di Donggala pada tanggal 21 Februari 2008", keyakinan: "cukup" });
  });

  it("tanpa data anak dan tanpa kalimat akta: tidak ada usulan 8603/9709/9710", () => {
    const d = DATA_AUA({ anak: [] });
    d.perkara.posita = d.perkara.posita.replace(/belum memiliki akta kelahiran karena[^;]*;/, "");
    const k = kodeSemua(S5.usulanDariData(d));
    expect(k).not.toContain("8603");
    expect(k).not.toContain("9709");
    expect(k).not.toContain("9710");
  });
});

describe("A3. penetapan ahli waris: golongan dari petitum dan posita", () => {
  it("pewaris laki-laki: istri, anak, pencairan dana, harta - cukup bila semua tergolong dan jumlah anak sama", () => {
    const u = S5.usulanDariData(DATA_PAW());
    expect(nilaiDari(u, "9702")).toMatchObject({ nilai: "Fatimah binti Maulid Hakim; Akbar bin Maulid Hakim; Sulton bin Maulid Hakim", keyakinan: "cukup" });
    expect(nilaiDari(u, "8608")!.nilai).toBe("Fatimah binti Maulid Hakim, Akbar bin Maulid Hakim, Sulton bin Maulid Hakim");
    expect(nilaiDari(u, "9701")).toMatchObject({ nilai: "Darma binti Tibe", keyakinan: "cukup" });
    expect(nilaiDari(u, "8610")).toMatchObject({ nilai: "Darma binti Tibe", keyakinan: "ragu" });
    expect(nilaiDari(u, "9700")!.nilai).toBe("Dana BPJS Ketenagakerjaan dengan nomor 22053736967 nama Maulid"); // "Dana Dana" diringkas
    expect(nilaiDari(u, "8614")!.nilai).toBe("Dana BPJS Ketenagakerjaan dengan nomor 22053736967 nama Maulid");
    // Tidak ada saudara/ayah/ibu: daftar terbaca penuh -> mengosongkannya benar (tidak berlaku, bukan kosong).
    const d = DATA_PAW();
    for (const k of ["9701"]) expect(S5.berlaku(k, d), k).toBe(true);
    for (const k of ["9703", "9704", "9718"]) expect(S5.berlaku(k, d), k).toBe(false);
    expect(kodeSemua(u)).not.toContain("9718");
  });

  it("jumlah anak di posita berbeda dari yang tergolong: semua turun menjadi ragu", () => {
    const d = DATA_PAW();
    d.perkara.posita = d.perkara.posita.replace("tiga orang anak", "empat orang anak");
    const u = S5.usulanDariData(d);
    expect(nilaiDari(u, "9702")!.keyakinan).toBe("ragu");
    expect(nilaiDari(u, "9701")!.keyakinan).toBe("ragu");
  });

  it("pewaris perempuan: anak memakai nama suami (pasangan di posita), bukan nama pewaris", () => {
    const d = DATA_PAW();
    d.perkara.posita = "1. Bahwa Almh. Sinta binti Kudo telah meninggal dunia pada tanggal 24 Mei 2026; 2. Bahwa semasa hidupnya Almh. Sinta binti Kudo telah menikah dengan seorang Lelaki bernama Sidik bin Laumala (Pemohon) pada tanggal 09 Mei 1994; 3. Bahwa Almh. Sinta binti Kudo meninggalkan suami, seorang anak, dan juga meninggalkan Dana BPJS Ketenagakerjaan dengan nomor 2205 nama Sinta;";
    d.perkara.petitum = "1. Mengabulkan; 3. Menetapkan ahli waris Sinta binti Kudo (Almh) adalah: a. Sidik bin Laumala, (Pemohon I); b. Rifal bin Sidik, (Pemohon II); 4. Menetapkan Para Pemohon Ahli waris dari Sinta binti Kudo untuk pencairan Dana BPJS 2205 5. Menetapkan biaya perkara";
    d.pihak1 = [];
    const g = PAW.golongkan({ petitum: d.perkara.petitum, posita: d.perkara.posita });
    expect(g.pasangan).toEqual(["Sidik bin Laumala"]);
    expect(g.anak).toEqual(["Rifal bin Sidik"]);
    expect(g.sisa).toEqual([]);
  });

  it("daftar dengan keterangan hubungan dalam kurung dan penanda strip dibaca; nama bertumpuk memakai nama Pemohon SIPP", () => {
    const { butir } = PAW.pecahDaftar("- SADUDIN Bin M.Tang (Anak kandung). - SALEHA Binti M. Tang (Anak kandung). - SIRAN Bin M. Tang (Anak kandung).");
    expect(butir.map((b) => b.hubungan)).toEqual(["anak", "anak", "anak"]);
    const g = PAW.golongkan({
      petitum: "Menetapkan ahli waris Ahmad bin Lici (Alm) adalah: Ulfa binti Agusti Indriyani binti Ahmad Hafid bin Ahmad Menetapkan Para Pemohon Ahli waris dari Ahmad untuk pencairan Dana BPJS 1 Menetapkan biaya",
      posita: "Bahwa Ahmad bin Lici (Alm) meninggalkan Isteri, dua orang anak, dan juga meninggalkan Dana BPJS 1;",
      pihak1: [{ nama: "Ulfa  binti Agusti" }, { nama: "Indriyani  binti Ahmad" }, { nama: "Hafid  bin Ahmad" }],
    });
    expect(g.dari).toBe("pihak");
    expect(g.anak).toEqual(["Indriyani binti Ahmad", "Hafid bin Ahmad"]);
    expect(g.pasangan).toEqual(["Ulfa binti Agusti"]);
  });

  it("petitum tanpa daftar dan posita tanpa golongan: tidak mengada-ada", () => {
    const d = DATA_PAW();
    d.perkara.petitum = "SUBSIDAIR : Atau apabila Pengadilan Agama berpendapat lain, mohon putusan yang seadil-adilnya.";
    d.perkara.posita = "Bahwa para pemohon adalah ahli waris sah dari Almarhum.";
    const k = kodeSemua(S5.usulanDariData(d));
    for (const x of ["9701", "9702", "9703", "9704", "9718", "8608"]) expect(k).not.toContain(x);
    expect(S5.berlaku("9703", d)).toBe(true); // tidak terbaca => tetap dihitung, bukan dianggap tiada
  });
});

describe("A4. perwalian dan wali adhal", () => {
  it("perwalian: pekerjaan Pemohon dari SIPP (ragu); hubungan Pemohon menentukan isian 0709/0712", () => {
    const d = {
      perkaraId: 1,
      perkara: { nomor: "1/Pdt.P/2026/PA.Dgl", jenisId: 354, alurId: 16, posita: "1. Bahwa Pemohon adalah ibu kandung dari anak Rifai bin Hasan; 2. Bahwa Alm. Hasan (Suami Pemohon) telah meninggal dunia pada tanggal 23 Januari 2023;", petitum: "", tanggalDaftar: "2026-08-20" },
      pihak1: [{ urutan: "1", nama: "Wisna binti Sabran", pekerjaan: "Mengurus Rumah Tangga" }],
      mempelai: [],
      anak: [{ nama: "Rifai bin Hasan ", tempat: "Palu", lahir: "2016-01-01" }],
    };
    const u = S5.usulanDariData(d);
    expect(nilaiDari(u, "6331")).toMatchObject({ nilai: "Mengurus Rumah Tangga", keyakinan: "ragu" });
    expect(nilaiDari(u, "5110")).toMatchObject({ nilai: "Rifai bin Hasan", keyakinan: "cukup" });
    expect(PW.pemohonOrangTua(d.perkara.posita)).toBe(true);
    expect(PW.pemohonOrangTua("1. Bahwa Pemohon merupakan Saudara Kandung dari anak Adzan bin Maudin;")).toBe(false);
    expect(S5.berlaku("0709", d)).toBe(true);
    expect(S5.berlaku("0709", { ...d, perkara: { ...d.perkara, posita: "1. Bahwa Pemohon merupakan Saudara Kandung dari anak Adzan bin Maudin;" } })).toBe(false);
  });

  it("wali adhal: status kawin Pemohon dari SIPP hanya bila bermakna (kode 1 'kawin' adalah bawaan SIPP)", () => {
    expect(WA.statusPemohon([{ statusKawin: "2" }], "")[0]).toMatchObject({ kode: "1002", nilai: "gadis", keyakinan: "cukup" });
    expect(WA.statusPemohon([{ statusKawin: "4" }], "")[0]).toMatchObject({ nilai: "janda" });
    expect(WA.statusPemohon([{ statusKawin: "1" }], "")).toEqual([]);
    expect(WA.statusPemohon([{ statusKawin: "2" }], "Bahwa Pemohon pernah menikah dan telah bercerai")).toEqual([]);
    const posita = "2. Bahwa Pemohon bermaksud akan melangsungkan pernikahan dengan seorang laki-laki pilihan yang bernama : Moh. Rizal bin Latif, NIK : 7203, umur 31 tahun, agama Islam, pendidikan SD, pekerjaan Karyawan Swasta ( Karyawan PT Samas), tempat tinggal di Desa Loli, Kecamatan Banawa;";
    const u = S5.usulanDariData({ perkaraId: 2, perkara: { nomor: "2/Pdt.P/2026/PA.Dgl", jenisId: 363, alurId: 16, posita, petitum: "", tanggalDaftar: "2026-05-25" }, pihak1: [{ statusKawin: "4", pekerjaan: "x" }], mempelai: [], anak: [] });
    expect(nilaiDari(u, "6331")).toMatchObject({ nilai: "Karyawan Swasta (Karyawan PT Samas)", keyakinan: "ragu" });
    expect(nilaiDari(u, "1002")!.nilai).toBe("janda");
  });
});

describe("A5. pembantu murni", () => {
  it("umur, tanggal, terbilang rupiah, kesamaan nama", () => {
    expect(BANTU.umurTahun("2008-10-09", "2026-08-03")).toBe(17);
    expect(BANTU.umurTahun("2008-10-09", "2026-10-09")).toBe(18);
    expect(BANTU.umurTahun("0000-00-00", "2026-08-03")).toBeNull();
    expect(BANTU.umurTahun("2030-01-01", "2026-08-03")).toBeNull();
    expect(BANTU.isoKeTampil("2008-10-09")).toBe("09/10/2008");
    expect(BANTU.isoKeTampil("2008-13-40")).toBe("");
    expect(BANTU.rupiahBerbilang(1500000)).toBe("Rp1.500.000,00 (satu juta lima ratus ribu rupiah)");
    expect(BANTU.rupiahBerbilang(150000)).toBe("Rp150.000,00 (seratus lima puluh ribu rupiah)");
    expect(BANTU.rupiahBerbilang(0)).toBe("");
    expect(BANTU.samaNama("Awliya bin Mohtar", "Awliya binti Mohtar")).toBe(true);
    expect(BANTU.samaNama("Rizal bin Hasan", "Fadli bin Hasan")).toBe(false);
  });
});

// ============================================================================
describe("B. usulanJenisS5 membaca SIPP lewat pembaca baca-saja", () => {
  /** Pembaca tiruan: mengembalikan baris menurut tabel yang disebut kueri; mencatat semua kueri. */
  function pembaca(peta: Record<string, unknown[]>, gagal: string[] = []) {
    const catatan: string[] = [];
    const q = async (sql: string) => {
      catatan.push(sql);
      for (const t of gagal) if (sql.includes(t)) throw new Error(`tabel ${t} tidak ada`);
      const kunci = Object.keys(peta).find((k) => new RegExp(`\\b${k}\\b`).test(sql.replace(/^SELECT[\s\S]*?\bFROM\b/i, "FROM")));
      return kunci ? peta[kunci] : [];
    };
    return { q, catatan };
  }
  const barisPerkara = (jenis: number, posita = POSITA_DK) => [{ nomor: "223/Pdt.P/2026/PA.Dgl", jenisId: jenis, alurId: 16, j: jenis, posita, petitum: "", tanggalDaftar: "2026-08-03" }];

  it("dispensasi kawin: kueri hanya SELECT; usulan sama dengan jalur data", async () => {
    const d = DATA_DK();
    const { q, catatan } = pembaca({ perkara_mempelai_dk: d.mempelai, perkara_alasan_nikah: d.alasanNikah, perkara: barisPerkara(362) });
    const u = await S5.usulanJenisS5(10095, q);
    expect(nilaiDari(u, "0606")).toMatchObject({ nilai: "Tri Wulandari binti Heru" });
    expect(catatan.length).toBeGreaterThan(5);
    for (const sql of catatan) expect(sql.trim(), sql).toMatch(/^SELECT\b/i);
    for (const sql of catatan) expect(sql, sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|REPLACE)\b/i);
  });

  it("jenis di luar S5 (cerai, itsbat) tidak disentuh: satu kueri jenis lalu selesai", async () => {
    const { q, catatan } = pembaca({ perkara: [{ j: 347 }] });
    expect(await S5.usulanJenisS5(5, q)).toEqual([]);
    expect(catatan).toHaveLength(1);
    const lain = pembaca({ perkara: [{ j: 360 }] });
    expect(await S5.usulanJenisS5(5, lain.q)).toEqual([]);
  });

  it("tabel yang tidak ada atau galat satu pembacaan tidak menggagalkan yang lain; id tak sah atau pembaca hilang = kosong", async () => {
    const d = DATA_DK();
    const { q } = pembaca({ perkara_mempelai_dk: d.mempelai, perkara: barisPerkara(362) }, ["perkara_alasan_nikah", "perkara_data_itsbat", "perkara_anak_pihak"]);
    const u = await S5.usulanJenisS5(10095, q);
    expect(nilaiDari(u, "0600")).toBeDefined();
    expect(await S5.usulanJenisS5(0, q)).toEqual([]);
    expect(await S5.usulanJenisS5(10095, undefined as never)).toEqual([]);
    const semuaGagal = async () => {
      throw new Error("db mati");
    };
    expect(await S5.usulanJenisS5(10095, semuaGagal)).toEqual([]);
    expect(await S5.bacaData(10095, semuaGagal)).toBeNull();
  });
});

// ============================================================================
describe("C. mesin keputusan ekstensi atas usulan jenis S5 (tidak menimpa)", () => {
  // isi-sipp-bersama.js adalah IIFE yang menaruh AletaIsiSipp di globalThis
  const mesin = (() => {
    const g = globalThis as Record<string, unknown>;
    // eslint-disable-next-line no-new-func
    new Function(readFileSync(path.join(AKAR, "ekstensi-sipp", "isi-sipp-bersama.js"), "utf8"))();
    return g.AletaIsiSipp as {
      pilihPerKode: (sumber: Usulan[][], boleh?: Set<string>) => Map<string, Usulan>;
      rencanakan: (u: Map<string, Usulan>, katalog: Array<Record<string, unknown>>, keIso: (t: string) => string, semua: Usulan[][]) => { tulis: Array<{ kode: string; nilai: string }>; saran: Array<{ kode: string; nilai: string }>; lewati: Array<{ kode: string; sebab: string }>; info: Record<string, { catatan: string; lencana: { yakin: { teks: string }; asal: { teks: string } } }> };
      menyebutAleta: (t: string) => boolean;
    };
  })();
  const keIso = (t: string) => {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
  };
  const katalog = (kosong: Record<string, boolean> = {}) =>
    ["0600", "0601", "0606", "0607", "0349", "0609", "0610", "2029", "2030", "6331"].map((kode) => ({ kode, nama: kode, jenis: kode === "0349" ? "tanggal" : "teks", opsi: [], kosong: kosong[kode] !== false }));

  it("pasti/cukup + kosong = ditulis; ragu = saran; sudah ada isinya = dilewati; lencana dan keterangan sampai ke kartu", () => {
    const u = S5.usulanDariData(DATA_DK());
    const rencana = mesin.rencanakan(mesin.pilihPerKode([u]), katalog({ "0606": false }), keIso, [u]);
    const tulis = new Map(rencana.tulis.map((t) => [t.kode, t.nilai]));
    expect(tulis.get("0600")).toBe("Fadli bin Hasan");
    expect(tulis.get("0349")).toBe("2008-10-09");
    expect(tulis.get("0609")).toBe("SLTP");
    expect(tulis.has("0606")).toBe(false); // sudah diketik petugas: tidak ditimpa
    expect(rencana.lewati).toContainEqual({ kode: "0606", sebab: "sudah ada isinya" });
    const saran = rencana.saran.map((s) => s.kode);
    expect(saran).toEqual(expect.arrayContaining(["0610", "2029", "6331"]));
    expect(saran).not.toContain("0600");
    expect(rencana.info["0610"].lencana.yakin.teks).toBe("yakin: ragu — periksa");
    expect(rencana.info["0600"].lencana.yakin.teks).toBe("yakin: pasti");
    expect(rencana.info["0600"].lencana.asal.teks).toBe("dari SIPP");
    expect(rencana.info["0610"].catatan.length).toBeGreaterThan(10);
  });

  it("tidak satu pun nilai usulan S5 (dari semua fixture) memuat kata ALETA", () => {
    for (const d of [DATA_DK(), DATA_AUA(), DATA_PAW()]) for (const x of S5.usulanDariData(d)) expect(mesin.menyebutAleta(x.nilai), `${x.kode}: ${x.nilai}`).toBe(false);
  });
});

// ============================================================================
describe("D. petunjuk manual / opsional", () => {
  it("salinan portal sama dengan METADATA bot; alasan ada dan tanpa istilah teknis atau kata ALETA", () => {
    const bot = S5.METADATA;
    expect(Object.keys(PETUNJUK_ISIAN_S5).sort()).toEqual(Object.keys(bot).sort());
    for (const [kode, m] of Object.entries(bot)) {
      const p = PETUNJUK_ISIAN_S5[kode];
      expect(p.manual ?? false, kode).toBe(m.manual ?? false);
      expect(p.opsional ?? false, kode).toBe(m.opsional ?? false);
      if (m.manual) {
        expect(p.alasan, kode).toBe(m.alasan);
        expect((m.alasan || "").length, kode).toBeGreaterThan(20);
      }
      if (m.opsional) {
        expect(p.labelPengguna, kode).toBe(m.labelPengguna);
        expect(m.labelPengguna, kode).toMatch(/bila ada/i);
      }
      expect(JSON.stringify(m), kode).not.toMatch(/aleta|sql|json|api|kueri/i);
    }
  });

  it("opsional: 9134 (petunjuk perbaikan permohonan), 8712-8714 (teguran panjar) dengan label jelas; yang manual tidak opsional", () => {
    for (const k of ["9134", "8712", "8713", "8714"]) expect(S5.METADATA[k], k).toMatchObject({ opsional: true });
    expect(S5.METADATA["9134"].labelPengguna).toBe("Petunjuk perbaikan permohonan dari majelis (bila ada)");
    for (const [k, m] of Object.entries(S5.METADATA)) expect(Boolean(m.manual && m.opsional), k).toBe(false);
  });

  it("terapkanPetunjukS5 menempelkan keterangan dan tidak menimpa isian yang sudah bertanda", () => {
    const susunan = {
      isian: [
        { kode: "8812", nama: "Tanggal ijazah" },
        { kode: "9134", nama: "Bas permohonan" },
        { kode: "8617", nama: "Cacat formil", manual: true, alasanManual: "alasan dari pekerjaan lain" },
        { kode: "0600", nama: "Nama pria" },
      ] as Array<Record<string, unknown> & { kode: string }>,
    };
    terapkanPetunjukS5(susunan);
    const [ijazah, bas, cacat, nama] = susunan.isian;
    expect(ijazah).toMatchObject({ manual: true });
    expect(String(ijazah.alasanManual)).toMatch(/ijazah/i);
    expect(bas).toMatchObject({ opsional: true, labelPengguna: "Petunjuk perbaikan permohonan dari majelis (bila ada)" });
    expect(cacat.alasanManual).toBe("alasan dari pekerjaan lain");
    expect(nama.manual).toBeUndefined();
  });

  it("setiap kode petunjuk adalah isian sungguhan blangko Derry (daftar cek), bukan kode karangan", () => {
    const daftar = JSON.parse(readFileSync(path.join(AKAR, "docs", "isi-sipp-abt", "DAFTAR-CEK.json"), "utf8")) as { isian: Array<{ kunci: string }> };
    const ada = new Set(daftar.isian.map((i) => i.kunci));
    for (const k of Object.keys(S5.METADATA)) expect(ada.has(k), k).toBe(true);
  });
});

// ============================================================================
// E. Panel Blangko Derry sungguhan di jsdom: usulan pengisi S5 -> terisi, tersimpan ke ABT, tidak menimpa, ditandai manual
// ============================================================================
const EKSTENSI = path.join(AKAR, "ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const irisanAbt = (mulai: string, selesai: string) => {
  const sumberAbt = baca("abt.js");
  const a = sumberAbt.indexOf(mulai);
  if (a < 0) throw new Error(`tidak ditemukan di abt.js: ${mulai}`);
  return sumberAbt.slice(a, sumberAbt.indexOf(selesai, a));
};
const SUMBER = ["panel-alat.js", "abt-klien.js", "blangko-derry.js", "isi-sipp-bersama.js", "blangko-derry-isian.js"].map(baca).join("\n;\n");
const ASAL = "http://192.168.10.10";
const ABT = `${ASAL}/aps_badilag/index.php/abt`;
const BERANDA = `${ABT}/main/beranda`;
const HARI_INI = "2026-10-15";
const NOMOR = "223/Pdt.P/2026/PA.Dgl";
const BLANGKO_DK = "[01] [Kabul] DK - Anak P Cewek";
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
async function sampai<T>(periksa: () => T, keterangan: string, batas = 8000): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let hasil: T | undefined;
    try {
      hasil = periksa();
    } catch {
      hasil = undefined;
    }
    if (hasil) return hasil as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${keterangan}`);
    await tunggu(5);
  }
}
const D = (kode: string, nama: string, jenis: string): [string, Definisi] => [kode, { kode, nama, jenis, sql: "", bawaan: "" }];
const KATALOG = new Map<string, Definisi>([
  D("0001", "No Perkara", "data_sipp"),
  D("0600", "Nama Pria (Dispensasi)", "data_teks"),
  D("0601", "Umur Pria (dispensasi)", "data_teks"),
  D("0606", "Nama Wanita (Dispensasi)", "data_teks"),
  D("0607", "Umur Wanita (dispensasi)", "data_teks"),
  D("0349", "Tgl. Lahir Wanita (Dispensasi)", "data_tanggal"),
  D("0609", "Pendidikan Wanita (dispensasi)", "data_teks"),
  D("0610", "Pekerjaan Wanita (dispensasi)", "data_teks"),
  D("2029", "Status Anak Pria (DK)", "data_teks"),
  D("8812", "Tanggal Ijazah", "data_tanggal"),
  D("8712", "CORET: NOMOR DAN TANGGAL SURAT TEGURAN PANITERA untuk menambah panjar", "data_teks"),
]);
const PENANDA_DK = ["0001", "0600", "0601", "0606", "0607", "0349", "0609", "0610", "2029", "8812", "8712"];
const MENU = `<button class="accordion">Blangko Derry (Daftar s.d. Produk)</button><div class="panel"><a href="${BERANDA}?a=D1&c=" title="(1 Blangko)">Putusan DK</a></div>`;
const HAL = `<div class="pricing-top tiga"><h3>Putusan DK</h3></div><p><a title='ukuran file 139 kb' href='#' onclick='showLoading();post("/aps_badilag/abt/main/cari", { a:"A01", b:"B01", c:"" });'># <span>${BLANGKO_DK}</span></a></p>`;
const popup = (kode: string, tipe: string, nilai: string) =>
  `<input type="hidden" name="var_type" value="${tipe}"><table><tr><td>Nomor Variabel</td><td>: ${kode}</td></tr><tr><td>Nama Variabel</td><td>: V${kode}</td></tr></table>Nomor Perkara <b>${NOMOR}</b>` +
  (tipe === "data_tanggal" ? `<input type='text' id='tgl_form' value='${nilai}'>` : `<textarea id="value">${nilai}</textarea>`);

type Minta = { url: string; cara: string; badan: string };
type Halaman = { w: any; minta: Minta[]; abt: Record<string, string> };
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(usulan: Usulan[], abtAwal: Record<string, string> = {}, simpananAwal: Record<string, unknown> = {}): Halaman {
  const dom = new JSDOM(`<!doctype html><html><head><title>ABT</title></head><body><div id="header"><div class="h_right"><b>Pengguna</b> Hakim</div></div><div id="wrapper"><div id="navbar">${MENU}</div><div id="content"></div></div></body></html>`, { url: BERANDA, runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = polos(simpananAwal);
  const pendengar: Array<(u: any, wilayah: string) => void> = [];
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.205.18" }), getURL: (x: string) => `chrome-extension://aleta-uji/${x}`, sendMessage: (_p: unknown, cb?: (h: unknown) => void) => cb && cb({ ok: true, id: 1 }), lastError: undefined },
    storage: {
      local: {
        get: async (kunci?: string | string[] | null) => {
          const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
          const hasil: Record<string, unknown> = {};
          for (const k of daftar) if (k in simpanan) hasil[k] = polos(simpanan[k]);
          return hasil;
        },
        set: async (isi: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(isi)) simpanan[k] = polos(v);
          setTimeout(() => pendengar.forEach((f) => f({}, "local")), 0);
        },
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: (f: (u: any, wilayah: string) => void) => void pendengar.push(f) },
    },
  };
  const minta: Minta[] = [];
  const abt: Record<string, string> = { ...abtAwal };
  const json = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });
  const html = (isi: string) => new Response(isi, { status: 200, headers: { "content-type": "text/html" } });
  const PK = {
    nomorPerkara: NOMOR, perkaraId: "10095", jenisPerkara: "Dispensasi Kawin", alurPerkaraId: 16, sudahPutus: false, tanggalPutusan: "", tanggalMinutasi: "", adaBerkasPutusan: false,
    lewatEcourt: null, ghaib: false, prodeo: false, majelisKode: "", majelisNama: "Hakim Satu, S.H.", paniteraNama: "PP Satu", jurusitaNama: "JS Satu", sebagai: ["hakim"],
    pihak: { penggugat: ["Heru bin Hasan"], tergugat: [] },
    sidang: [{ sidangId: `s${HARI_INI}`, tanggal: HARI_INI, jam: "09:00", agenda: "Pemeriksaan pokok perkara", ket: "", ditunda: false, urutan: 1, hadir: null, adaBas: null, ruangan: "" }],
  };
  w.fetch = async (alamat: string, opsi?: { method?: string; body?: unknown }) => {
    const url = String(alamat);
    const cara = String(opsi?.method || "GET").toUpperCase();
    const badan = typeof opsi?.body === "string" ? opsi.body : opsi?.body ? String(opsi.body) : "";
    minta.push({ url, cara, badan });
    if (url.includes("/ekstensi/siapa")) return json({ ok: true, data: { nama: "Hakim Satu", peran: "Hakim", roleId: "hakim", golonganMenu: ["hakim"], kapabilitas: {}, peranTambahan: [], bolehKasir: false } });
    if (url.includes("/aleta-ecourt/perkara-saya")) return json({ ok: true, data: { hariIni: HARI_INI, mode: "hari", dari: HARI_INI, sampai: HARI_INI, lihatSemua: false, nama: "Hakim Satu", sebagaiNama: "", sebagaiPeran: null, terpotong: false, jumlahSemua: 1, adaYangCocok: true, akun: null, perkara: [PK] } });
    if (url.includes("/aleta-ecourt/sidang?nomor=")) return json({ ok: true, data: { sipp: { jadwalPerkara: [] } } });
    if (url.includes("/aleta-ecourt/sidang?dari=")) return json({ ok: false }, 404);
    if (url.includes("/aleta-ecourt/sidang/skors?")) return json({ ok: true, data: { available: true, ok: true, riwayat: [], kalimatBas: "" } });
    if (url.includes("/aleta-ecourt/konseptor-langkah")) return json({ ok: true, data: { ada: true, peta: {}, drafH7: {}, keadaanTerbaca: true } });
    if (url.includes("/aleta-ecourt/blangko-derry/set-saksi")) return json({ ok: true, data: { ada: false } });
    if (url.includes("/aleta-ecourt/blangko-derry?hak=1")) return json({ ok: true, data: { saklar: { hakimBas: false, ppPutusan: false }, folder: [] } });
    if (url.includes("/aleta-ecourt/blangko-derry")) {
      const q = new URL(url, ASAL).searchParams;
      if (q.get("indeks") === "1") return json({ ok: true, data: { ada: true, akar: "derry_briantono", folder: [{ nama: "3 Dispensasi Kawin", jenis: "put", berkas: [`${BLANGKO_DK}.rtf`] }], sumber: "pohon", sebab: "" } });
      const s = susunIsian(PENANDA_DK, KATALOG, { P: "Pemohon", T: "Termohon" });
      terapkanPetunjukS5(s); // seperti route.ts
      const kode = kodeUntukNilai(s, q.get("semua") === "1");
      const n: Record<string, unknown> = {};
      for (const k of kode) n[k] = statusNilaiLayar(abt[k] ? { status: "terisi", teks: abt[k], nama: "", sebab: "" } : k === "0001" ? { status: "terisi", teks: NOMOR, nama: "", sebab: "" } : { status: "kosong", teks: "", nama: "", sebab: "" }, kodeTanyaJawab(s).has(k));
      return json({ ok: true, data: { ada: true, folder: `derry_briantono/${q.get("folder")}`, berkas: `${BLANGKO_DK}.rtf`, jumlahPenanda: s.penanda.length, sumberKatalog: "abt", katalogTersedia: true, ...s, nilai: q.get("perkaraId") ? n : undefined, nilaiAda: Boolean(q.get("perkaraId")), nilaiSebab: "" } });
    }
    if (url.includes("/aleta-bot/abt/usulan")) {
      const sumber = (() => {
        try {
          return String(JSON.parse(badan).sumber || "");
        } catch {
          return "";
        }
      })();
      if (sumber === "saksi") return json({ ok: true, data: { available: true, saksi: { usulan: [], huruf: [] } } });
      if (sumber === "itsbat" || sumber === "posita-lain") return json({ ok: true, data: { available: true, itsbat: { ok: false }, positaLain: { ok: false, alasan: "jenis_perkara_tidak_dilayani" } } });
      return json({ ok: true, data: { available: true, sipp: { ok: true, usulan: polos(usulan), jumlahKuasa: 0, prodeo: false } } });
    }
    if (url.includes("/aleta-ecourt/isi-gugatan")) return json({ ok: true, data: { usulan: [], tanyaJawab: [], kalimat: [], kontak: null } });
    if (url.includes("/aleta-ecourt/kuasa-gugatan")) return json({ ok: true, data: { usulan: [], ada: false } });
    if (url.includes("/aleta-ecourt/ktp-pihak")) return json({ ok: true, data: { pihak: [] } });
    if (url.includes("/aleta-ecourt/tanda-tangan")) return json({ ok: false, alasan: "tidak berwenang" }, 403);
    if (url === BERANDA || url === `${ABT}/main/beranda`) return html(`<div id="navbar">${MENU}</div>`);
    if (url.startsWith(`${BERANDA}?a=D1`)) return html(HAL);
    if (url === `${ABT}/main/cari` && cara === "POST") return { type: "opaqueredirect", status: 0, headers: { get: () => "" }, text: async () => "" };
    if (url.startsWith(`${ABT}/edit_data?`)) {
      const q = new URL(url).searchParams;
      const kode = q.get("no_var") || "";
      if (cara === "POST") {
        abt[kode] = String(new URLSearchParams(badan).get("value") || "");
        return html(`<font color='green' size='2'>DATA DISIMPAN</font>`);
      }
      const def = KATALOG.get(kode);
      return html(popup(kode, def ? def.jenis : "data_teks", abt[kode] || ""));
    }
    return json({ ok: false }, 404);
  };
  w.Response = Response;
  w.TextDecoder = TextDecoder;
  w.TextEncoder = TextEncoder;
  w.console.warn = () => {};
  w.console.info = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  w.HTMLElement.prototype.focus = function () {};
  w.eval(SUMBER);
  w.eval(irisanAbt("function teksSaksiMentah(baris)", "/** Banyaknya butir"));
  w.catatRiwayat = () => Promise.resolve();
  w.bacaRiwayat = async () => [];
  return { w, minta, abt };
}
const D_ = (h: Halaman) => h.w.document as Document;
const akarPanel = (h: Halaman) => D_(h).getElementById("aleta-bd-akar") as HTMLElement;
const q = (h: Halaman, s: string) => akarPanel(h).querySelector(s) as HTMLElement | null;
const klik = (h: Halaman, s: string) => {
  const el = q(h, s);
  if (!el) throw new Error(`tidak ada: ${s}`);
  el.click();
};
async function bukaDk(h: Halaman) {
  await sampai(() => D_(h).getElementById("aleta-bd-tawar") || h.w.aletaBlangkoDerry.keadaan().peran.length, "siap");
  (Array.from(D_(h).querySelectorAll("#navbar .accordion")).find((b) => /Blangko Derry/.test(b.textContent || "")) as HTMLElement).click();
  await sampai(() => q(h, "[data-pk]"), "daftar");
  klik(h, `[data-pk="${NOMOR}"]`);
  await sampai(() => q(h, '[data-bd2="bukamodal"]'), "tombol pilih blangko");
  klik(h, '[data-bd2="bukamodal"]');
  await sampai(() => {
    if (q(h, `[data-bl="${BLANGKO_DK}"]:not([disabled])`)) return true;
    const jumlah = akarPanel(h).querySelectorAll("[data-kelmodal]").length;
    for (let i = 0; i < jumlah; i += 1) {
      (akarPanel(h).querySelectorAll("[data-kelmodal]")[i] as HTMLElement | undefined)?.click();
      if (q(h, `[data-bl="${BLANGKO_DK}"]:not([disabled])`)) return true;
    }
    return false;
  }, "blangko DK");
  klik(h, `[data-bl="${BLANGKO_DK}"]`);
  await sampai(() => q(h, "#bd-perlu .bd-f") || q(h, ".bd-ok"), "perlu diisi tergambar");
}

describe("E. panel Blangko Derry di jsdom dengan usulan pengisi S5", () => {
  it("pasti/cukup terisi dan tersimpan ke ABT; ragu hanya saran; yang sudah diketik tidak ditimpa; tanggal d/m/Y; tanpa kata ALETA", async () => {
    const usulan = S5.usulanDariData(DATA_DK());
    const h = buka(usulan, { "0606": "Nama Ketikan Petugas" });
    await bukaDk(h);
    await sampai(() => h.abt["0600"] === "Fadli bin Hasan", "0600 tersimpan");
    await sampai(() => h.abt["0349"] === "09/10/2008", "0349 tersimpan sebagai tanggal ABT");
    await sampai(() => h.abt["0609"] === "SLTP", "0609 tersimpan");
    await sampai(() => h.abt["0601"] === "27 tahun" && h.abt["0607"] === "17 tahun", "umur tersimpan");
    // Sudah ada isinya: tidak ditimpa dan tidak ada tulisan ke kodenya.
    expect(h.abt["0606"]).toBe("Nama Ketikan Petugas");
    expect(h.minta.filter((m) => m.cara === "POST" && /no_var=0606/.test(m.url))).toEqual([]);
    // Ragu: saran samar, belum ditulis.
    const ragu = (await sampai(() => {
      const i = q(h, "#bd-i0610") as HTMLInputElement;
      return i && i.placeholder === "Pelajar" ? i : null;
    }, "saran ragu 0610")) as HTMLInputElement;
    expect(ragu.value).toBe("");
    expect(h.abt["0610"]).toBeUndefined();
    expect(h.abt["2029"]).toBeUndefined();
    // Tidak ada kata ALETA di muatan tulis ke ABT.
    const tulis = h.minta.filter((m) => m.cara === "POST" && /edit_data\?/.test(m.url));
    expect(tulis.length).toBeGreaterThanOrEqual(5);
    for (const m of tulis) expect(`${m.url} ${m.badan}`).not.toMatch(/aleta/i);
    // Lencana keyakinan ada di kartu yang terisi.
    const kartu0600 = q(h, '.bd-f[data-f="0600"]')!;
    expect(kartu0600.textContent).toContain("yakin: pasti");
    expect(q(h, '.bd-f[data-f="0610"]')!.textContent).toContain("yakin: ragu");
  });

  it("isian yang tidak mungkin otomatis ditandai 'diisi manual' dengan alasan di ikon keterangan; opsional dibawa sebagai data", async () => {
    const h = buka(S5.usulanDariData(DATA_DK()));
    await bukaDk(h);
    const kartu = (await sampai(() => q(h, '.bd-f[data-f="8812"]'), "kartu 8812")) as HTMLElement;
    expect(kartu.textContent).toContain("diisi manual");
    const ikon = kartu.querySelector(".bd-sumber") as HTMLElement;
    expect(ikon.getAttribute("title") || "").toMatch(/ijazah/i);
    // Isian yang terisi otomatis tidak ditandai manual.
    expect(q(h, '.bd-f[data-f="0600"]')!.textContent).not.toContain("diisi manual");
    // Opsional: ikut sebagai data isian (tampilannya ditangani sesuai desain "Isian tambahan").
    const isi = h.w.aletaBlangkoDerryIsian;
    expect(isi).toBeDefined();
  });

  it("saklar mati: tidak menulis apa pun ke ABT", async () => {
    const h = buka(S5.usulanDariData(DATA_DK()), {}, { blangkoDerryIsiOto: false });
    await bukaDk(h);
    await tunggu(150);
    expect(h.minta.filter((m) => m.cara === "POST" && /edit_data\?/.test(m.url))).toEqual([]);
  });
});
