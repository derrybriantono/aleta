// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * BUTIR 14 (13 Okt 2026): ITSBAT 228/Pdt.P/2026/PA.Dgl - "Tidak ada data baru"
 * ============================================================================
 *
 * Posita di bawah = posita SIPP perkara 228/Pdt.P/2026/PA.Dgl apa adanya (HTML
 * <p>, spasi ganda, "Desa  Lembantongoa", KUA tanpa kata "Kecamatan" di butir
 * 7); hanya NAMA ORANG (wali, imam, saksi nikah, anak) diganti nama pengganti.
 * Sebelum perbaikan: 1002, 1046, 5105, 5178 tidak sampai ke panel (diserahkan
 * ke "bawaan ABT" yang tidak pernah tersimpan) dan 5105 bawaan ABT berbunyi
 * "wilayah hukum Kantor Urusan Agama Palolo, ...". Rute disimulasikan seperti
 * /abt/usulan sumber 'itsbat': dariPositaItsbat -> saringUsulanItsbat ->
 * tambahUsulanJenis, dengan muatan ekstensi (pemohon = isi #0046# "Pemohon").
 */

type Usulan = { kode: string; nilai: string; keyakinan: string };
type Hasil = { usulan: Usulan[]; bawaanAbt: Array<{ kode: string }>; belumSiap: Array<{ kode: string }> };
const require_ = createRequire(import.meta.url);
const bot = (n: string) => require_(path.resolve(process.cwd(), `../aleta_bot/services/${n}`));
const U = bot("abtUsulanService.js") as { dariPositaItsbat: (p: string, o: object) => Hasil };
const L = bot("abtUsulanLainService.js") as { saringUsulanItsbat: (h: Hasil, j: string) => Hasil };
const D = bot("deteksiJenisPerkaraService.js") as { tambahUsulanJenis: (h: Hasil, p: string, o: object) => Hasil };
const I = bot("deteksi/itsbat.js") as {
  statusWali: (k: string[]) => { nilai: string };
  anakDariPosita: (k: string[]) => { nilai: string };
  deteksi: (p: string, o: object) => Record<string, { nilai: string }>;
};

const POSITA_228 = [
  "<p>1. Bahwa pada hari Senin, 17 November 2025 Pemohon I dan Pemohon II melangsungkan pernikahan menurut agama Islam, bertempat di Desa Lembantongoa , di wilayah hukum Kantor Urusan Agama Kecamatan Palolo, Kabupaten Sigi, Provinsi Sulawesi Tengah;</p>",
  "<p>2. Bahwa pada saat pernikahan tersebut Pemohon I berstatus Perjaka dalam usia 21 tahun, dan Pemohon II berstatus Perawan  dalam usia 18 tahun Pernikahan dilangsungkan dengan wali nikah yaitu Xwali Yyy (Ayah Kandung Pemohon II) dan yang menikahkan adalah Ximam (Imam Desa), dan dihadiri saksi nikah bernama Xsaksi dan Ysaksi Zzz, dengan mas kawin berupa Rp.1.100.000 (Satu Juta Seratus Ribu Rupiah) dan dibayar tunai;</p>",
  "<p>3. Bahwa antara Pemohon I dan Pemohon II tidak ada pertalian nasab, pertalian kerabat dan pertalian sesusuan serta memenuhi syarat dan tidak ada larangan untuk melangsungkan pernikahan, baik menurut ketentuan Hukum Islam maupun peraturan perundang-undangan yang berlaku;</p>",
  "<p>4. Bahwa setelah pernikahan Pemohon I dan Pemohon II hidup rukun sebagaimana layaknya suami istri, dan telah dikaruniai seorang anak yang bernama Xanak bin Yayah, usia 6 bulan;</p>",
  "<p>5. Bahwa selama pernikahan tersebut tidak ada pihak ketiga yang mengganggu gugat pernikahan Pemohon I dan Pemohon II tersebut dan selama itu pula Pemohon I dan Pemohon II tetap beragama Islam ;</p>",
  "<p>6. Bahwa sampai sekarang Pemohon I dan Pemohon II tidak mempunyai Kutipan Akta Nikah, karena Para Pemohon masih berstatus belum cukup umur saat pernikahan dan pernikahan tersebut tidak terdaftar di Kantor Urusan Agama Kecamatan Palolo, Kabupaten Sigi, Provinsi Sulawesi Tengah, sehingga pernikahan tersebut tidak dicatatkan di KUA yang berwenang, sementara saat ini para Pemohon I dan Pemohon II membutuhkan Akta Nikah tersebut untuk mengurus Buku Nikah dan untuk kepentingan hukum lainnya;</p>",
  "<p>7. Bahwa para Pemohon I dan Pemohon II mengajukan permohonan ini kepada Majelis Hakim untuk menetapkan sahnya perkawinan antara Pemohon I dengan Pemohon II yang terjadi pada hari Senin, 17 November 2025 di Desa  Lembantongoa, di wilayah hukum Kantor Urusan Agama Palolo, Kabupaten Sigi, Provinsi Sulawesi Tengah;</p>",
  "<p>8. Bahwa para Pemohon bersedia membayar biaya perkara sesuai dengan ketentuan yang berlaku.</p>",
].join("\n");

function rute(posita: string, pemohon = "Pemohon"): Hasil {
  const it = L.saringUsulanItsbat(U.dariPositaItsbat(posita, { pemohon, pemohon2: "" }), "");
  return D.tambahUsulanJenis(it, posita, { jenisPerkara: "360" });
}
const nilai = (h: Hasil, kode: string) => (h.usulan.find((u) => u.kode === kode) || { nilai: "" }).nilai;

describe("228/Pdt.P/2026: semua variabel itsbat terbaca dan sampai ke panel", () => {
  const h = rute(POSITA_228);
  it("1002, 1046, 5105 (bentuk benar), 5178 diusulkan ALETA, tidak ada yang diserahkan ke bawaan ABT", () => {
    expect(nilai(h, "1002")).toBe("Perjaka");
    expect(nilai(h, "1003")).toBe("Perawan");
    expect(nilai(h, "1046")).toBe("Ayah Kandung Pemohon II");
    expect(nilai(h, "5105")).toBe("Desa Lembantongoa, Kecamatan Palolo, Kabupaten Sigi, Provinsi Sulawesi Tengah");
    expect(nilai(h, "5178")).toBe("Kantor Urusan Agama Kecamatan Palolo, Kabupaten Sigi, Provinsi Sulawesi Tengah");
    expect(h.bawaanAbt.map((b) => b.kode)).toEqual([]);
  });
  it("variabel lain tetap: tanggal, umur, wali, saksi, mahar, anak", () => {
    expect(nilai(h, "5197")).toBe("17 November 2025");
    expect(nilai(h, "7211")).toBe("21 tahun");
    expect(nilai(h, "7212")).toBe("18 tahun");
    expect(nilai(h, "1217")).toBe("Xwali Yyy");
    expect(nilai(h, "0007")).toBe("telah dikaruniai seorang anak");
    expect(h.usulan.filter((u) => ["1002", "1046", "5105", "5178"].includes(u.kode)).every((u) => u.keyakinan === "cukup")).toBe(true);
  });
});

describe("bentuk posita lain (nyata, nama diganti)", () => {
  it("status wali: kurung sesudah nama, langsung, huruf besar, wali hakim; kurung berisi nama bukan status", () => {
    expect(I.statusWali(["wali nikah yaitu Xx (Paman Kandung Pemohon karena ayah kandung Pemohon telah meninggal dunia )"]).nilai).toBe("Paman Kandung Pemohon");
    expect(I.statusWali(["dengan wali nikah saudara kandung Pemohon II bernama Xx"]).nilai).toBe("Saudara Kandung Pemohon II");
    expect(I.statusWali(["Wali Nikah adalah AYAH KANDUNG yang bernama XX sedangkan yang menjadi saksi"]).nilai).toBe("Ayah Kandung");
    expect(I.statusWali(["pernikahan dilangsungkan dengan wali hakim dan yang menikahkan"]).nilai).toBe("Wali Hakim");
    expect(I.statusWali(["wali nikah adalah Paman (Xx) dan yang menikahkan"]).nilai).toBe("Paman");
  });
  it("anak: sisa templat 'telah/belum' dan 'belum dikarunia 1 orang anak' tidak diisi", () => {
    expect(I.anakDariPosita(["dan telah/belum dikaruniai 1 orang anak, masing-masing bernama:"]).nilai).toBe("");
    expect(I.anakDariPosita(["dan belum dikarunia 1 orang anak"]).nilai).toBe("");
    expect(I.anakDariPosita(["dan telah dikaruniai 2 (dua) orang anak"]).nilai).toBe("telah dikaruniai 2 (dua) orang anak");
    expect(I.anakDariPosita(["hidup rukun dan belum dikaruniai anak"]).nilai).toBe("belum dikaruniai anak");
  });
  it("cerai gugat kumulasi: #1002# = status #0046# (Penggugat = istri), 7211/7212 menurut jenis kelamin", () => {
    const p =
      "Bahwa pada saat pernikahan tersebut Tergugat berstatus Perjaka dalam usia 39 tahun, dan Penggugat berstatus Perawan dalam usia 35 tahun, pernikahan dilangsungkan dengan wali nikah adalah Sepupu Penggugat yang bernama Xx;";
    const f = I.deteksi(p, { pemohon: "Penggugat" });
    expect(f["1002"].nilai).toBe("Perawan");
    expect(f["1003"].nilai).toBe("Perjaka");
    expect(f["7211"].nilai).toBe("39 tahun");
    expect(f["7212"].nilai).toBe("35 tahun");
  });
  it("itsbat kontentius: status yang DISEBUT untuk #0046# (Pemohon = janda) dipakai apa adanya; lawannya menurut kata status", () => {
    const p =
      "Bahwa pada saat pernikahan tersebut almarhum Xxx berstatus Duda dalam usia 45 tahun dan Pemohon berstatus Janda dalam usia 40 tahun;";
    const f = I.deteksi(p, { pemohon: "Pemohon" });
    expect(f["1002"].nilai).toBe("Janda");
    expect(f["1003"].nilai).toBe("Duda");
    expect(f["7211"].nilai).toBe("45 tahun");
    expect(f["7212"].nilai).toBe("40 tahun");
  });
  it("itsbat kontentius: pasangan yang telah meninggal (1025/1246/1247) - ragu, nama di awal kalimat", () => {
    const f = I.deteksi(
      "Bahwa Xxxa bin Yyya telah meninggal lebih dulu karena sakit pada tanggal 19 November 2025 sesuai dengan Kutipan Akta Kematian Nomor : 7203-KM-27112025-0004;",
      { pemohon: "Pemohon" }
    ) as Record<string, { nilai: string; yakin: string }>;
    expect(f["1025"]).toMatchObject({ nilai: "Xxxa bin Yyya", yakin: "ragu" });
    expect(f["1246"].nilai).toBe("19 November 2025");
    expect(f["1247"].nilai).toBe("sakit");
    expect(I.deteksi("Bahwa Pemohon telah meninggalkan rumah;", {})["1025"]).toBeUndefined();
  });
  it("tempat menikah: sebutan terakhir menang, ruas kosong dilengkapi; posita tanpa tempat = kosong", () => {
    const p =
      "Bahwa pada tanggal 1 Mei 2020 Pemohon I dan Pemohon II melangsungkan pernikahan di Desa Doda, Kecamatan Kinovaro, Kabupaten Donggala; " +
      "Bahwa para Pemohon memohon penetapan sahnya perkawinan yang terjadi pada tanggal 1 Mei 2020 di Desa Doda, Kecamatan Kinovaro, Kabupaten Sigi, Provinsi Sulawesi Tengah;";
    expect(I.deteksi(p, {})["5105"].nilai).toBe("Desa Doda, Kecamatan Kinovaro, Kabupaten Sigi, Provinsi Sulawesi Tengah");
    expect(I.deteksi("Bahwa Pemohon I dan Pemohon II telah menikah pada tanggal 1 Mei 2020;", {})["5105"]).toBeUndefined();
  });
});
