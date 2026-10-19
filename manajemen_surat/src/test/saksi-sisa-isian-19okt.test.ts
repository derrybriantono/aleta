// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * 19 Okt 2026 - sisa titik-titik jawaban saksi: bug "diajukanbulan/tahun" dan fakta baru dari gugatan.
 *
 * Yang dijaga (abtUsulanService, murni, tanpa SIPP):
 *   A. tidak ada sisa penanda satuan ("bulan/tahun", "tahun/bulan") dan tidak ada kata menempel ("diajukanbulan");
 *      "sejak sebelum perkara ini diajukan" tidak ganda; lama pisah terisi bila terhitung
 *   B. dari gugatan: anak tinggal bersama siapa, awal "tidak rukun lagi", puncak tanpa "ketika ..." ganda,
 *      tempat tinggal sekarang tiap pihak (gugatan menang atas alamat SIPP), hanya bila terbaca jelas
 */
const req = createRequire(path.resolve(process.cwd(), "../aleta_bot/services/x.js"));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const svc: any = req("./abtUsulanService");

const ROW = {
  anak: ["Apakah Penggugat dan Tergugat sudah dikaruniai anak?", "Penggugat dan Tergugat sudah dikaruniai ... orang anak, sekarang anak tersebut tinggal bersama ...;"],
  rukun: ["Bagaimana keadaan rumah tangga Penggugat dan Tergugat selama ini?", "Awalnya rumah tangga Penggugat dan Tergugat rukun dan harmonis, namun sejak ... tidak rukun lagi;"],
  puncak: ["Apakah ada kejadian yang menjadi puncak perselisihan dan pertengkaran tersebut? Kapan?", "Puncaknya terjadi pada ... ketika ...;"],
  pisah: ["Apakah sekarang Penggugat dan Tergugat masih tinggal serumah? Sejak kapan berpisah?", "Tidak, Penggugat dan Tergugat sudah berpisah tempat tinggal sejak ..., sudah sekitar ... bulan/tahun;"],
  siapa: ["Siapa yang meninggalkan tempat tinggal bersama, dan sekarang masing-masing tinggal di mana?", "Yang meninggalkan tempat tinggal bersama adalah ...; sekarang Penggugat tinggal di ... dan Tergugat tinggal di ...;"],
} as const;

const isi = (posita: string, baris: keyof typeof ROW, opsi: Record<string, unknown> = {}) => {
  const fakta = svc.faktaDariPosita(posita, "Tergugat", "Penggugat", { tanggalSidang: "2026-10-15", ...opsi });
  const [tanya, jawab] = ROW[baris];
  const a = svc.lengkapiJawabanTemplat({ tanya, jawab, fakta });
  return svc.rapikanSisaIsian({ tanya, jawab: a, fakta, pelaku: "Tergugat", lawan: "Penggugat" }).jawab as string;
};

const LENGKAP =
  "Bahwa dari pernikahan tersebut telah dikaruniai 2 orang anak yang kini diasuh oleh Penggugat; " +
  "bahwa sejak bulan Maret 2021 keadaan rumah tangga Penggugat dan Tergugat mulai tidak harmonis dan sering terjadi perselisihan dan pertengkaran; " +
  "bahwa puncak keretakan terjadi pada bulan Agustus 2023, Tergugat pergi meninggalkan rumah kediaman bersama ke rumah orang tuanya di Desa Contoh sehingga Penggugat dan Tergugat telah pisah rumah selama kurang lebih 1 tahun 4 bulan; " +
  "bahwa Penggugat sekarang tinggal di rumah orang tua Penggugat di Kota Palu;";
// Pisah disebut tanpa tanggal maupun lama.
const PISAH_TANPA_TANGGAL = "Bahwa sejak beberapa waktu yang lalu Penggugat dan Tergugat telah pisah tempat tinggal dan tidak serumah lagi;";
const TANPA_APA_APA = "Bahwa Penggugat dan Tergugat sering bertengkar;";
const KUNJUNGAN =
  "Bahwa pada tahun 2021, Termohon izin kepada Pemohon untuk kembali ke rumah orang tua Termohon di Desa Contoh untuk mengambil pakaian Termohon, namun hingga saat itu Termohon tidak lagi kembali ke kediaman bersama, sehingga Pemohon dan Termohon telah pisah rumah selama kurang lebih 3 tahun;";

describe("A. sisa penanda dan kalimat ganda", () => {
  it("lama pisah terhitung mengisi 'sudah sekitar ... bulan/tahun'", () => {
    expect(isi(LENGKAP, "pisah")).toBe("Tidak, Penggugat dan Tergugat sudah berpisah tempat tinggal sejak bulan Agustus 2023, sudah sekitar 1 tahun 4 bulan;");
  });
  it("tanpa tanggal dan lama: 'sejak sebelum perkara ini diajukan' sekali, tanpa 'bulan/tahun' dan tanpa kata menempel", () => {
    const j = isi(PISAH_TANPA_TANGGAL, "pisah");
    expect(j).toBe("Tidak, Penggugat dan Tergugat sudah berpisah tempat tinggal sejak sebelum perkara ini diajukan;");
  });
  it("tidak satu pun baris/gugatan memuat sisa penanda satuan atau kata menempel", () => {
    for (const posita of [LENGKAP, PISAH_TANPA_TANGGAL, TANPA_APA_APA, KUNJUNGAN, ""]) {
      for (const k of Object.keys(ROW) as Array<keyof typeof ROW>) {
        const j = isi(posita, k);
        expect(j, `${k} | ${posita.slice(0, 30)}`).not.toMatch(/bulan\s*\/\s*tahun|tahun\s*\/\s*bulan|tanggal\s*\/\s*bulan|diajukan(?=[a-z])/i);
        expect(j, `${k} | ${posita.slice(0, 30)}`).not.toMatch(/sejak sebelum perkara ini diajukan,? sejak sebelum/i);
      }
    }
  });
});

describe("B. fakta dari gugatan, hanya bila terbaca jelas", () => {
  it("anak tinggal bersama siapa: dari 'diasuh oleh Penggugat'; tanpa keterangan tetap titik-titik; belum punya anak tanpa kalimat itu", () => {
    expect(isi(LENGKAP, "anak")).toBe("Penggugat dan Tergugat sudah dikaruniai 2 orang anak, sekarang anak tersebut tinggal bersama Penggugat;");
    expect(isi("Bahwa dari pernikahan tersebut telah dikaruniai 2 orang anak;", "anak")).toMatch(/tinggal bersama \.\.\.;$/);
    expect(isi("Bahwa Penggugat dan Tergugat belum dikaruniai anak;", "anak")).toBe("Penggugat dan Tergugat belum dikaruniai anak;");
    // bentuk lain
    expect(isi("Bahwa telah dikaruniai 1 orang anak dan hak asuh anak tersebut berada pada Tergugat;", "anak")).toMatch(/tinggal bersama Tergugat;$/);
    expect(isi("Bahwa telah dikaruniai 1 orang anak; Penggugat yang selama ini merawat anak tersebut;", "anak")).toMatch(/tinggal bersama Penggugat;$/);
  });
  it("sejak ... tidak rukun lagi: dari awal perselisihan; tanpa data tetap titik-titik", () => {
    expect(isi(LENGKAP, "rukun")).toBe("Awalnya rumah tangga Penggugat dan Tergugat rukun dan harmonis, namun sejak bulan Maret 2021 tidak rukun lagi;");
    expect(isi(TANPA_APA_APA, "rukun")).toContain("sejak ... tidak rukun lagi");
  });
  it("puncak: slot 'ketika' tidak ganda ketika peristiwa pisahnya terbaca", () => {
    const j = isi(LENGKAP.replace("pada bulan Agustus 2023", "pada bulan Agustus 2023"), "puncak");
    expect(j).toMatch(/^Puncaknya terjadi pada bulan Agustus 2023/);
    expect((j.match(/ketika/g) || []).length).toBeLessThanOrEqual(1);
  });
  it("siapa yang pergi dan tempat tinggal sekarang: dari gugatan; pihak tanpa data tetap titik-titik; kunjungan ke rumah pihak lain bukan tempat tinggal", () => {
    expect(isi(LENGKAP, "siapa")).toBe("Yang meninggalkan tempat tinggal bersama adalah Tergugat; sekarang Penggugat tinggal di rumah orang tua Penggugat di Kota Palu dan Tergugat tinggal di rumah orang tua Tergugat di Desa Contoh;");
    const sebagian = isi("Bahwa pada tanggal 3 Mei 2020 Tergugat pergi meninggalkan rumah kediaman bersama dan hingga kini tidak pernah kembali;", "siapa");
    expect(sebagian).toBe("Yang meninggalkan tempat tinggal bersama adalah Tergugat; sekarang Penggugat tinggal di ... dan Tergugat tinggal di ...;");
    // Kunjungan "kembali ke rumah orang tua Termohon untuk mengambil pakaian" bukan tempat tinggal Pemohon.
    expect(svc.tempatKiniPosita(svc.kalimatPosita(KUNJUNGAN), "Termohon", "Pemohon")).toEqual({ lawan: "", pelaku: "" });
    // Penggugat dan Tergugat sama-sama pindah: subjek tidak jelas -> tidak diisi.
    expect(svc.tempatKiniPosita(["Bahwa Penggugat dan Tergugat pindah ke rumah kontrakan di Kota Palu setelah pisah rumah"], "Tergugat", "Penggugat")).toEqual({ lawan: "", pelaku: "" });
  });
  it("alamat pihak di SIPP hanya cadangan: gugatan menang; tanpa keduanya tetap titik-titik", () => {
    const alamat = { alamatPihak: { lawan: "Jl. Merdeka No. 5, Kelurahan Boya, Kota Palu.", pelaku: "Desa Lalombi, Kecamatan Banawa" } };
    // Siapa yang pergi tidak diketahui: jawabannya pilihan (petugas wajib memilih), tempat tinggal terisi dari alamat SIPP.
    expect(isi(PISAH_TANPA_TANGGAL, "siapa", alamat)).toBe("Yang meninggalkan tempat tinggal bersama adalah Penggugat; sekarang Penggugat tinggal di Jl. Merdeka No. 5, Kelurahan Boya, Kota Palu dan Tergugat tinggal di Desa Lalombi, Kecamatan Banawa;");
    expect(isi(LENGKAP, "siapa", alamat)).toContain("Penggugat tinggal di rumah orang tua Penggugat di Kota Palu");
    expect(isi(LENGKAP, "siapa", alamat)).toContain("Tergugat tinggal di rumah orang tua Tergugat di Desa Contoh");
    expect(isi(TANPA_APA_APA, "siapa")).toContain("Penggugat tinggal di ... dan Tergugat tinggal di ...");
  });
});

describe("rute: alamat pihak dibaca hanya bila templat menanyakan tempat tinggal sekarang", () => {
  it("fungsi alamatPihakPerkara terdaftar; nomor kosong -> null tanpa menyentuh SIPP", async () => {
    expect(typeof svc.alamatPihakPerkara).toBe("function");
    expect(await svc.alamatPihakPerkara("")).toBeNull();
  });
});
