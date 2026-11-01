// @vitest-environment node
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * 1 NOV 2026 (agen U2) - KETERANGAN SAKSI: ITSBAT, DISPENSASI KAWIN, JENIS LAIN
 * ============================================================================
 *
 * Yang dijaga (semua nama dan nomor REKAAN; bentuk kalimat meniru posita PA yang sungguh ada):
 *   1. yang menikahkan (imam desa / imam masjid / P3N) dibedakan dari wali nikah dan saksi nikah, pada kalimat panjang satu baris;
 *   2. satu pembaca untuk dua jalur: nilai di dariPositaItsbat (kode 8087, 1217, 0650, 0651) SAMA dengan fakta saksi (tidak bentrok);
 *   3. salah ketik "dikaruniayai" / "3 anak" terbaca; tujuan itsbat "membutuhkan Akta Nikah tersebut untuk ...";
 *   4. dispensasi kawin: identitas calon di baris sesudah "bernama :", umur anak, hamil, jenis kelamin anak; wali adhal: calon di baris berikutnya;
 *      perwalian: umur anak dari daftar anak, keperluan;
 *   5. keadaan perkara dari posita (modul ekstensi): dasar itsbat huruf a-e, bentuk berdua walau SIPP hanya memuat satu pemohon,
 *      sebab/umur calon/jenis kelamin anak dispensasi kawin; petugas tetap dapat mengubah (modul hanya memberi nilai awal);
 *   6. katalog: izin poligami tanpa anak tidak lagi menyebut anak-anak; asal usul anak "ibu saja" tidak menyebut Pemohon II.
 */

type Apa = any;
const REPO = path.resolve(__dirname, "../../..");
const EKS = path.join(REPO, "ekstensi-sipp");
const require_ = createRequire(import.meta.url);
const SVC = path.join(REPO, "aleta_bot/services");
const nikah: Apa = require_(path.join(SVC, "isiJawabanSaksiPositaNikah.js"));
const posita: Apa = require_(path.join(SVC, "isiJawabanSaksiPosita.js"));
const usulan: Apa = require_(path.join(SVC, "abtUsulanService.js"));
const fakta: Apa = require_(path.join(SVC, "isiJawabanSaksiFakta.js"));
const keadaanPosita: Apa = require_(path.join(EKS, "blangko-derry-keadaan-posita.js"));
const Mesin: Apa = require_(path.join(EKS, "saksi-katalog.js"));

const katalog: Apa[] = readdirSync(path.join(EKS, "saksi-katalog"))
  .filter((n) => n.endsWith(".json"))
  .sort()
  .map((n) => JSON.parse(readFileSync(path.join(EKS, "saksi-katalog", n), "utf8")))
  .filter((k) => !k.contoh);

const peran = (kalimat: string) => nikah.peranNikah([kalimat]);

describe("U2/1 - yang menikahkan, wali, dan saksi nikah pada satu kalimat", () => {
  it("imam desa dengan nama, wali ayah kandung, dua saksi", () => {
    const r = peran("pernikahan dilangsungkan dengan wali nikah ayah kandung Pemohon II yang bernama Xxxa dan yang menikahkan adalah Imam Desa Yyya yang bernama Xxxb dan dihadiri saksi nikah lebih dari dua orang diantaranya masing-masing bernama : Xxxc dan Xxxd dengan mahar uang tunai");
    expect(r.penikah).toBe("Imam Desa Yyya bernama Xxxb");
    expect(r.waliNama).toBe("Xxxa");
    expect(r.waliHubungan).toBe("ayah kandung Pemohon II");
    expect(r.saksi).toEqual(["Xxxc", "Xxxd"]);
  });

  it("bentuk kurung: 'Xxxb (Imam Desa Yyya)' menjadi 'Imam Desa Yyya bernama Xxxb'", () => {
    const r = peran("dengan wali nikah yaitu Xxxa (Ayah kandung Pemohon II) dan yang menikahkan adalah Xxxb (Imam Desa Loli Yyya), dihadiri saksi nikah bernama Xxxc dan Xxxd");
    expect(r.penikah).toBe("Imam Desa Loli Yyya bernama Xxxb");
    expect(r.waliNama).toBe("Xxxa");
  });

  it("'dinikahkan oleh', jabatan tanpa nama, dan 'yang menikahkan' sebelum wali tidak tertukar", () => {
    expect(peran("dinikahkan oleh Imam Desa Yyya bernama Xxxb").penikah).toBe("Imam Desa Yyya bernama Xxxb");
    expect(peran("dengan wali nikah ayah kandung dan yang menikahkan imam desa, dihadiri saksi nikah bernama Xxxc dan Xxxd dengan mahar").penikah).toBe("Imam Desa");
    const r = peran("yang menikahkan antara Pemohon I dengan Pemohon II adalah imam Desa Lero yang bernama Xxxb, wali nikah adalah paman kandung Pemohon II bernama Xxxa sedangkan yang menjadi saksi nikah adalah Xxxc dan Xxxd dengan mahar");
    expect(r).toMatchObject({ penikah: "Imam Desa Lero bernama Xxxb", waliNama: "Xxxa", waliHubungan: "paman kandung Pemohon II", saksi: ["Xxxc", "Xxxd"] });
  });

  it("wali yang mewakilkan akadnya: wali tetap wali, imam yang diwakili menjadi yang menikahkan", () => {
    const r = peran("dengan wali nikah saudara kandung Pemohon II bernama Xxxa yang akad nikahnya diwakilkan kepada imam Masjid bernama Xxxb untuk menikahkan Pemohon I dengan Pemohon II, dan dihadiri saksi nikah bernama Xxxc dan Xxxd");
    expect(r).toMatchObject({ waliNama: "Xxxa", penikah: "Imam Masjid bernama Xxxb", saksi: ["Xxxc", "Xxxd"] });
  });

  it("wali nikah adalah imam: yang menikahkan ikut terisi tetapi ditandai ragu", () => {
    const r = peran("pernikahan dilangsungkan dengan wali nikah imam Mesjid bernama Xxxa, dihadiri saksi nikah bernama Xxxc dan Xxxd dengan mas kawin berupa uang");
    expect(r.waliNama).toBe("Xxxa");
    expect(r.penikah).toBe("Imam Mesjid bernama Xxxa");
    expect(r.penikahRagu).toBe(true);
    const f = nikah.faktaNikahDariPosita(["pernikahan dilangsungkan dengan wali nikah imam Mesjid bernama Xxxa, dihadiri saksi nikah bernama Xxxc dan Xxxd dengan mas kawin berupa uang"]);
    expect(f.find((x: Apa) => x.kunci === "penikah").yakin).toBe("ragu");
  });

  it("wali hakim yang sekaligus menikahkan", () => {
    const r = peran("pernikahan dilangsungkan dengan wali hakim yang bernama H. Xxxa dan sekaligus menikahkan Pemohon II karena ayah kandung beragama lain dan dihadiri saksi nikah bernama Xxxc dan Xxxd dengan mas kawin");
    expect(r.waliNama).toBe("H. Xxxa");
    expect(r.waliHubungan).toBe("wali hakim");
    expect(r.penikah).toBe("wali hakim bernama H. Xxxa");
  });

  it("nama penghulu tidak pernah menjadi saksi nikah dan kolom kosong tidak diisi dari kata lain", () => {
    const kosong = peran("pernikahan dilangsungkan dengan wali nikah Ayah Kandung Bernama XXXA dan yang menikahkan Bernama dan dihadiri saksi Nikah lebih dari dua orang diantaranya masing-masing bernama :");
    expect(kosong.waliNama).toBe("XXXA");
    expect(kosong.penikah).toBeUndefined();
    expect(kosong.saksi).toBeUndefined();
    // yang menikahkan bernama, saksi kosong: nama penghulu BUKAN saksi nikah 1
    const f = nikah.faktaNikahDariPosita(["pernikahan dilangsungkan dengan wali nikah Ayah Kandung Bernama XXXA dan yang menikahkan Bernama XXXB dan dihadiri saksi Nikah lebih dari dua orang diantaranya masing-masing bernama :"]);
    expect(f.find((x: Apa) => /saksiNikah/.test(x.kunci))).toBeUndefined();
    expect(f.find((x: Apa) => x.kunci === "penikah")?.nilai).toBe("XXXB");
  });

  it("penanda isian blangko yang tidak diganti ('WALI NIKAH', 'SAKSI NIKAH I') bukan nama orang", () => {
    const r = peran("dengan wali nikah ayah kandung bernama WALI NIKAH dan Imam Desa Ketong yang bernama WAKIL WALI NIKAH yang menikahkan dan dihadiri saksi nikah bernama SAKSI NIKAH I dan SAKSI NIKAH II dengan mas kawin");
    expect(r.waliNama).toBeUndefined();
    expect(r.saksi).toBeUndefined();
  });

  it("salah ketik 'benama', pengantar 'dianataranya', angka urut, kurung keterangan, gelar sesudah koma", () => {
    expect(peran("dengan wali nikah Nasab Pemohon II yang benama Xxxa dan yang menikahkan adalah Imam Desa Toaya dan dihadiri saksi nikah lebih dari dua orang di antaranya masing – masing benama Xxxc dan Xxxd dengan mahar").saksi).toEqual(["Xxxc", "Xxxd"]);
    expect(peran("dihadiri saksi Nikah lebih dari Dua orang dianataranya masing-masing bernama : Xxxc Dan Xxxd dengan Mas Kawin").saksi).toEqual(["Xxxc", "Xxxd"]);
    expect(peran("dihadiri saksi nikah yang bernama: 1. Xxxc (Pegawai Syara) dan 2. Xxxd (Pegawai Syara), dengan mas uang").saksi).toEqual(["Xxxc", "Xxxd"]);
    expect(peran("dan yang menikahkan adalah Xxxb, S.Pd.I (Kepala KUA Yyya), dan dihadiri saksi nikah bernama Xxxc dan Xxxd").penikah).toBe("Kepala KUA Yyya bernama Xxxb, S.Pd.I");
  });

  it("nama berhuruf kecil tetap tidak diisi (ragu = titik-titik)", () => {
    expect(peran("dengan wali nikah ayah kandung Pemohon II bernama ludin dan yang menikahkan imam desa").waliNama).toBeUndefined();
  });

  it("kinerja: 300 kalimat nikah panjang dalam < 2 detik", () => {
    const k = "pernikahan dilangsungkan dengan wali nikah ayah kandung Pemohon II yang bernama Xxxa dan yang menikahkan adalah Imam Desa Yyya yang bernama Xxxb dan dihadiri saksi nikah lebih dari dua orang diantaranya masing-masing bernama : Xxxc dan Xxxd dengan mahar uang tunai";
    const awal = Date.now();
    for (let i = 0; i < 300; i++) nikah.peranNikah([k + " " + i]);
    expect(Date.now() - awal).toBeLessThan(2000);
  });
});

describe("U2/2 - satu pembaca untuk jalur ABT (dariPositaItsbat) dan fakta saksi", () => {
  const POSITA =
    "Bahwa pada tanggal 07 Mei 2017 telah terjadi pernikahan di Desa Yyyz; " +
    "Bahwa pada saat pernikahan tersebut Pemohon I berstatus Jejaka dalam usia 20 tahun dan Pemohon II berstatus Perawan dalam usia 19 tahun, pernikahan dilangsungkan dengan wali nikah ayah kandung Pemohon II yang bernama Xxxa dan yang menikahkan imam Masjid yang bernama Xxxb dan dihadiri saksi nikah lebih dari dua orang diantaranya masing-masing bernama : Xxxc dan Xxxd dengan Mas kawin uang Rp 110.000; " +
    "Bahwa setelah menikah hidup rukun dan dikaruniayai 3 anak; " +
    "Bahwa sampai sekarang tidak mempunyai Kutipan Akta Nikah, sementara saat ini para Pemohon membutuhkan Akta Nikah tersebut untuk kepastian hukum dan mengurus kepentingan hukum lainnya";
  const nilai = (kode: string) => (usulan.dariPositaItsbat(POSITA, { pemohon: "Pemohon I", pemohon2: "Pemohon II" }).usulan.find((u: Apa) => u.kode === kode) || {}).nilai;

  it("kode ABT 8087, 1217, 0650, 0651 sama dengan fakta saksi", () => {
    expect(nilai("8087")).toBe("Imam Masjid bernama Xxxb");
    expect(nilai("1217")).toBe("Xxxa");
    expect(nilai("0650")).toBe("Xxxc");
    expect(nilai("0651")).toBe("Xxxd");
    const f = posita.positaTambahan(POSITA, "itsbat", "");
    expect(f.find((x: Apa) => x.kunci === "penikah").nilai).toBe(nilai("8087"));
    expect(f.find((x: Apa) => x.kunci === "waliNama").nilai).toBe(nilai("1217"));
    expect(f.find((x: Apa) => x.kunci === "saksiNikah1").nilai).toBe(nilai("0650"));
  });

  it("dua sumber posita pada fakta yang sama tidak menjadi 'ragu' karena bentrok", () => {
    const u = usulan.dariPositaItsbat(POSITA, { pemohon: "Pemohon I", pemohon2: "Pemohon II" }).usulan.filter((x: Apa) => x.nilai);
    const F = fakta.bangunFakta({ usulan: u, tambahan: posita.positaTambahan(POSITA, "itsbat", "") });
    for (const kunci of ["penikah", "waliNama", "saksiNikah1", "saksiNikah2"]) {
      const a = F.ambil(kunci);
      expect(a, kunci).not.toBeNull();
      expect(a.yakin, kunci).not.toBe("ragu");
    }
  });

  it("salah ketik 'dikaruniayai 3 anak' terbaca sebagai tiga anak; tujuan itsbat terbaca", () => {
    expect(nilai("0007")).toMatch(/3\s+anak/);
    const f = posita.positaTambahan(POSITA, "itsbat", "");
    expect(f.find((x: Apa) => x.kunci === "tujuan").nilai).toBe("kepastian hukum dan mengurus kepentingan hukum lainnya");
  });

  it("wali yang imam dan tanpa kalimat menikahkan lain: usulan 8087 ditandai ragu", () => {
    const p = "Bahwa pada saat pernikahan tersebut Pemohon I berstatus perjaka dalam usia 19 tahun dan Pemohon II berstatus perawan dalam usia 17 tahun, pernikahan dilangsungkan dengan wali nikah imam Mesjid bernama Xxxa, dihadiri saksi nikah bernama Xxxc dan Xxxd dengan mas kawin berupa uang Rp 110.000";
    const u = usulan.dariPositaItsbat(p, {}).usulan.find((x: Apa) => x.kode === "8087");
    expect(u.nilai).toBe("Imam Mesjid bernama Xxxa");
    expect(u.keyakinan).toBe("ragu");
  });
});

describe("U2/3 - dispensasi kawin, wali adhal, perwalian dari posita baku", () => {
  const DK = [
    "Pemohon : Xxxp bin Yyyp, umur 53 tahun, pekerjaan Petani",
    "Xxxa binti Xxxp , umur 16 tahun, agama Islam, pendidikan SMP, pekerjaan Pelajar, tempat tinggal di Desa Yyyz",
    "Yang akan melaksanakan perkawinan dengan seorang laki-laki yang bernama:",
    "Xxxb bin Yyyb, umur 25 tahun, agama Islam, pendidikan SD, pekerjaan Petani, tempat tinggal di Desa Yyyc",
    "Selanjutnya disebut sebagai Calon Suami Anak Pemohon",
    "Pemohon berencana akan menikahkan anak Pemohon yang bernama Xxxa binti Xxxp dengan seorang laki-laki yang bernama Xxxb bin Yyyb.",
    "anak Pemohon yang bernama Xxxa binti Xxxp masih di bawah umur untuk persyaratan melangsungkan perkawinan, sampai saat ini masih berumur 16 tahun.",
    "anak Pemohon telah saling mencintai dengan calon suaminya dan calon istri sudah hamil 7 bulan karena itu mendesak.",
  ].join("\n");
  const F = (jenis: string, teks: string) => Object.fromEntries(posita.positaTambahan(teks, jenis, "").map((x: Apa) => [x.kunci, x.nilai]));

  it("dispensasi kawin: calon (nama, umur, pekerjaan) dari baris sesudah 'bernama :', anak, jenis kelamin, hamil", () => {
    const f = F("dk", DK);
    expect(f.anakNama).toBe("Xxxa binti Xxxp");
    expect(f.anakUmur).toBe("16");
    expect(f.anakJk).toBe("P");
    expect(f.calonNama).toBe("Xxxb bin Yyyb");
    expect(f.calonUmur).toBe("25");
    expect(f.calonPekerjaan).toBe("Petani");
    expect(f.hamil).toBe("7 bulan");
  });

  it("wali adhal: calon suami di baris sesudah 'laki-laki pilihan yang bernama :'", () => {
    const f = F(
      "wa",
      ["Bahwa Pemohon bermaksud akan melangsungkan pernikahan dengan seorang laki-laki pilihan yang bernama :", "Xxxb bin H. Yyyb, umur 46 tahun, agama Islam, pendidikan SLTA, pekerjaan : Swasta, tempat tinggal di Desa Yyyc", "Bahwa Pemohon dan calon suami telah menyampaikan maksud itu kepada kakak kandung Pemohon yang bernama Xxxw."].join("\n")
    );
    expect(f.calonNama).toBe("Xxxb bin H. Yyyb");
    expect(f.calonUmur).toBe("46");
    expect(f.calonPekerjaan).toBe("Swasta");
  });

  it("perwalian: umur anak dari daftar anak dan keperluan dari kalimat wali", () => {
    const f = F(
      "perwalian",
      ["Xxxk bin Yyyk , umur 19 tahun", "Pemohon hendak bertindak sebagai wali anak Xxxk bin Yyyk , disebabkan karena kedua orangtua telah menyerahkan anaknya", "dalam hal ini Pemohon hendak bertindak sebagai wali atas anak Xxxk bin Yyyk untuk dapat mengurus Pendaftaran TNI-AD, mengingat orangtua kandung anak tersebut berada jauh"].join("\n")
    );
    expect(f.anakNama).toBe("Xxxk bin Yyyk");
    expect(f.anakUmur).toBe("19");
    expect(f.tujuan).toBe("mengurus Pendaftaran TNI-AD");
  });

  it("wali adhal: 'sudah saling mencintai' menjadi hubungan calon", () => {
    const f = F("wa", "Bahwa, antara Pemohon dengan calon suami sudah saling mencintai, sehingga Pemohon berniat untuk melangsungkan pernikahan");
    expect(f.eratHubungan).toBe("saling mencintai");
  });

  it("penetapan ahli waris: pasangan pewaris dan dana yang hendak dicairkan", () => {
    const f = F(
      "paw",
      [
        "Xxxa binti Yyya, telah meninggal dunia pada tanggal 24 November 2018 dikarenakan sakit",
        "semasa hidupnya hingga meninggal dunia Xxxa binti Yyya tidak pernah bercerai dengan Xxxs Yyys dan tetap beragama Islam.",
        "Xxxa binti Yyya juga meninggalkan uang tabungan di Bank BRI dengan nomor rekening: 0060-01-002374-51-4 sejumlah RP. 10,500,000,00 (sepuluh juta lima ratus ribu rupiah) atas nama Xxxa .",
        "Pemohon bermaksud untuk mengambil uang dalam rekening tabungan tersebut",
      ].join("\n")
    );
    expect(f.pewarisPasangan).toBe("Xxxs Yyys");
    expect(f.danaPencairan).toMatch(/^uang tabungan di Bank BRI dengan nomor rekening: 0060-01-002374-51-4 sejumlah Rp\. 10,500,000,00/);
    expect(f.danaPencairan).not.toMatch(/atas nama/);
    // dua pemohon yang bermaksud mengambil uang BUKAN dana
    expect(f.danaPencairan).not.toMatch(/Pemohon/);
  });

  it("pembaca lama tidak ditimpa: kunci yang sudah ada dari pembaca lama dipertahankan", () => {
    const f = posita.positaTambahan("Pemohon berencana akan menikahkan anak Pemohon yang bernama Xxxa binti Xxxp dengan seorang laki-laki yang bernama Xxxb bin Yyyb.\nanak Pemohon masih berusia 15 tahun dan di bawah umur", "dk", "");
    expect(f.filter((x: Apa) => x.kunci === "anakUmur")).toHaveLength(1);
  });
});

describe("U2/4 - keadaan perkara dari posita (modul ekstensi)", () => {
  const its = (p: string, k: Apa = {}) => keadaanPosita.turunkan("itsbat-nikah", { posita: p, alurId: "16", jumlahPemohon: 2, ...k });

  it("dasar itsbat: sebelum 1974 -> huruf d; selain itu bawaan (tidak dikeluarkan)", () => {
    expect(its("Bahwa pada tanggal 26 Agustus 1965 Pemohon dan Pemohon II melangsungkan pernikahan menurut agama Islam di Desa Yyyz")).toEqual({ dasarItsbat: "huruf-d" });
    expect(its("Bahwa pada tanggal 07 Mei 2017 Pemohon I dan Pemohon II melangsungkan pernikahan menurut agama Islam")).toEqual({});
    expect(its("Bahwa Pemohon I dan Pemohon II melangsungkan pernikahan pada tahun 1973 di Desa Yyyz; Bahwa anak pertama lahir pada tahun 1990").dasarItsbat).toBe("huruf-d");
  });

  it("tahun lain di posita (kelahiran, akta cerai) tidak dianggap tahun nikah", () => {
    expect(its("Bahwa Pemohon II lahir pada tahun 1960 dan bercerai tahun 1970; Bahwa pada tanggal 07 Mei 2017 melangsungkan pernikahan di Desa Yyyz").dasarItsbat).toBeUndefined();
  });

  it("perceraian -> a, akta hilang -> b, keraguan syarat -> c", () => {
    expect(its("Bahwa pada tahun 2010 Pemohon melangsungkan pernikahan; Bahwa itsbat nikah ini dimohonkan dalam rangka penyelesaian perceraian").dasarItsbat).toBe("huruf-a");
    expect(its("Bahwa pada tahun 2010 Pemohon melangsungkan pernikahan; Bahwa kutipan akta nikah milik Pemohon telah hilang karena banjir").dasarItsbat).toBe("huruf-b");
    expect(its("Bahwa pada tahun 2010 Pemohon melangsungkan pernikahan; Bahwa terdapat keraguan tentang sah atau tidaknya salah satu syarat perkawinan").dasarItsbat).toBe("huruf-c");
  });

  it("SIPP hanya memuat satu pemohon padahal posita menyebut Pemohon II: bentuk berdua", () => {
    expect(its("Bahwa Pemohon I dan Pemohon II melangsungkan pernikahan pada tahun 2010", { jumlahPemohon: 1 }).bentuk).toBe("permohonan-berdua");
    // satu pemohon sungguhan tidak diubah
    expect(its("Bahwa Pemohon melangsungkan pernikahan dengan almarhum Xxxa pada tahun 2010", { jumlahPemohon: 1 }).bentuk).toBeUndefined();
  });

  it("gugatan yang suaminya sudah meninggal -> gugatan-pasangan-meninggal (pola ketat); wali yang meninggal bukan pasangan", () => {
    expect(its("Bahwa suami dari Pemohon yang bernama Xxxa telah meninggal dunia pada tanggal 17 Desember 2014", { alurId: "15", jumlahPemohon: 1 }).bentuk).toBe("gugatan-pasangan-meninggal");
    expect(its("Bahwa pernikahan dilangsungkan dengan wali hakim karena ayah kandung Pemohon telah meninggal dunia", { alurId: "15", jumlahPemohon: 1 }).bentuk).toBeUndefined();
  });

  it("dispensasi kawin: sebab hamil, calon di bawah umur, jenis kelamin anak", () => {
    const dk = (p: string) => keadaanPosita.turunkan("dispensasi-kawin", { posita: p });
    const p = [
      "Xxxa binti Xxxp , umur 16 tahun, agama Islam",
      "Yang akan melaksanakan perkawinan dengan seorang laki-laki yang bernama:",
      "Xxxb bin Yyyb, umur 17 tahun, agama Islam, pekerjaan Pelajar",
      "Selanjutnya disebut sebagai Calon Suami Anak Pemohon",
      "Pemohon berencana akan menikahkan anak Pemohon yang bernama Xxxa binti Xxxp dengan seorang laki-laki yang bernama Xxxb bin Yyyb.",
      "calon istri anak Pemohon telah hamil 7 bulan.",
    ].join("\n");
    expect(dk(p)).toEqual({ sebabDK: "hamil", calonJuga: "di-bawah-umur", jenisKelaminAnak: "perempuan" });
    expect(dk(p.replace("umur 17 tahun", "umur 25 tahun")).calonJuga).toBe("dewasa");
    // tidak hamil / umur calon tidak tertulis: tidak ditebak
    expect(dk("anak Pemohon yang bernama Xxxa binti Xxxp belum hamil dan masih sekolah").sebabDK).toBeUndefined();
    expect(dk("Pemohon berencana akan menikahkan anak Pemohon yang bernama Xxxa bin Xxxp dengan seorang perempuan yang bernama Xxxb binti Yyyb.").calonJuga).toBeUndefined();
    expect(dk("Pemohon berencana akan menikahkan anak Pemohon yang bernama Xxxa bin Xxxp dengan seorang perempuan yang bernama Xxxb binti Yyyb.").jenisKelaminAnak).toBe("laki-laki");
  });

  it("posita kosong atau jenis lain: tidak mengeluarkan apa pun; cepat", () => {
    expect(keadaanPosita.turunkan("itsbat-nikah", { posita: "" })).toEqual({});
    expect(keadaanPosita.turunkan("wali-adhal", { posita: "pernikahan 1960" })).toEqual({});
    const panjang = "Bahwa Pemohon I dan Pemohon II melangsungkan pernikahan pada tahun 2010 di Desa Yyyz. ".repeat(200);
    const awal = Date.now();
    for (let i = 0; i < 50; i++) its(panjang);
    expect(Date.now() - awal).toBeLessThan(1500);
  });

  it("keadaanDariData katalog Derry memakai posita; nilai yang tidak sah di katalog diabaikan; tanpa posita seperti dahulu", () => {
    const K: Apa = require_(path.join(EKS, "blangko-derry-katalog.js"));
    const kat = katalog.find((k) => k.kunci === "itsbat-nikah");
    (globalThis as Apa).AletaSaksiKatalog = Mesin;
    (globalThis as Apa).ALETA_SAKSI_KATALOG_DATA = katalog;
    const tanpa = K.keadaanDariData(kat, { alurId: "16", jumlahPemohon: 1, teksBlangko: "BAS" });
    expect(tanpa.keadaan).toEqual({ bentuk: "permohonan-sendiri" });
    const dengan = K.keadaanDariData(kat, { alurId: "16", jumlahPemohon: 1, teksBlangko: "BAS", posita: "Bahwa Pemohon I dan Pemohon II melangsungkan pernikahan pada tanggal 3 Mei 1960" });
    expect(dengan.keadaan).toEqual({ bentuk: "permohonan-berdua", dasarItsbat: "huruf-d" });
    expect(dengan.dariData).toEqual(["bentuk", "dasarItsbat"]);
    const dkKat = katalog.find((k) => k.kunci === "dispensasi-kawin");
    const dk = K.keadaanDariData(dkKat, { alurId: "16", jumlahPemohon: 1, teksBlangko: "BAS", posita: "calon istri anak Pemohon telah hamil 5 bulan. anak Pemohon yang bernama Xxxa binti Xxxp" });
    expect(dk.keadaan).toMatchObject({ sebabDK: "hamil", jenisKelaminAnak: "perempuan" });
  });
});

describe("U2/5 - katalog: izin poligami tanpa anak dan asal usul anak 'ibu saja'", () => {
  const poligami = Mesin.kenaliPaket(katalog, { jenisPerkaraId: "341", alurPerkaraId: "", nama: "" });
  const aua = katalog.find((k) => k.kunci === "asal-usul-anak");
  const semuaTeks = (q: Apa) => JSON.stringify([q.teks, q.teksVarian, q.hal, q.jawaban]);

  it("izin poligami: pada keadaan anak = tidak, tidak ada butir yang menyebut anak-anak", () => {
    const aktif = Mesin.pertanyaanAktif(poligami, Mesin.keadaanBawaan(poligami, { anak: "tidak" }), "P", { tingkat: ["inti", "pilihan", "tambahan", "jarang"] });
    // teks pertanyaan (jawaban butir bervarian menurut keadaan sudah ditangani di dalam butirnya sendiri, mis. q-pg-tanggungan)
    const bermasalah = aktif.filter((q: Apa) => /anak-anak|anaknya|anak mereka|beserta anak/i.test(JSON.stringify([q.teks, q.teksVarian])) && !/anak/.test(q.id));
    expect(bermasalah.map((q: Apa) => q.id)).toEqual([]);
    // butir tentang anak itu sendiri tidak ditanyakan
    expect(aktif.map((q: Apa) => q.id)).not.toContain("q-pg-anak-jumlah");
    expect(aktif.map((q: Apa) => q.id)).not.toContain("q-pg2-anak");
    // padanan tanpa anak ada untuk butir nafkah, kemampuan, keadilan, kekerasan, sikap keluarga
    for (const id of ["q-pg-nafkah-selama-ini-tt", "q-kemampuan-tt", "q-keadilan-tt", "q-pg-adil-kekerasan-tt"]) expect(aktif.map((q: Apa) => q.id), id).toContain(id);
  });

  it("izin poligami: pada keadaan anak = ada, butir lama tetap dan padanan tanpa anak tidak muncul", () => {
    const aktif = Mesin.pertanyaanAktif(poligami, Mesin.keadaanBawaan(poligami, { anak: "ada" }), "P", { tingkat: ["inti", "pilihan", "tambahan", "jarang"] }).map((q: Apa) => q.id);
    expect(aktif).toContain("q-pg-nafkah-selama-ini");
    expect(aktif).toContain("q-pg-anak-jumlah");
    expect(aktif.filter((id: string) => id.endsWith("-tt"))).toEqual([]);
  });

  it("asal usul anak 'ibu saja': tidak ada butir yang menyebut Pemohon II; suami-istri tetap seperti semula", () => {
    const ibu = Mesin.pertanyaanAktif(aua, Mesin.keadaanBawaan(aua, { pemohon: "ibu-saja" }), "P", { tingkat: ["inti", "pilihan", "tambahan", "jarang"] });
    const salah = ibu.filter((q: Apa) => /#0046# II|#0046# I\b/.test(semuaTeks(q)));
    expect(salah.map((q: Apa) => q.id)).toEqual([]);
    expect(ibu.map((q: Apa) => q.id)).toContain("q-pengasuhan-ibu");
    const berdua = Mesin.pertanyaanAktif(aua, Mesin.keadaanBawaan(aua, { pemohon: "suami-istri" }), "P", { tingkat: ["inti", "pilihan", "tambahan", "jarang"] }).map((q: Apa) => q.id);
    expect(berdua).toContain("q-pengasuhan");
    expect(berdua).not.toContain("q-pengasuhan-ibu");
  });

  it("katalog yang diubah tetap lolos pemeriksaan skema", () => {
    for (const kunci of ["izin-poligami", "izin-poligami-keluarga", "asal-usul-anak"]) {
      const kat = katalog.find((k) => k.kunci === kunci);
      const r = Mesin.periksaKatalog(kat, { namaBerkas: `${kunci}.json` });
      expect(r.galat, `${kunci}\n${r.galat.slice(0, 6).join("\n")}`).toEqual([]);
    }
  });
});
