// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  BLANGKO_RELAAS,
  SET_BLANGKO,
  blangkoRelaas,
  jenjangkan,
  keadaanUntukGolongan,
  pihakDipanggil,
  labelBlangko,
  setPutusanUntukPerkara,
  setUntukPerkara,
  usulanPutusanDariJenjang,
  type BlangkoItem,
} from "@/lib/pohon-blangko";

/**
 * Pemilihan berjenjang blangko.
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 * Jenjangnya dibaca dari nama berkas, bukan dari daftar tulisan tangan. Karena
 * itu contoh di bawah ini adalah NAMA BERKAS SUNGGUHAN dari folder APS Badilag
 * di server, bukan nama karangan yang kebetulan cocok dengan pengurainya.
 *
 * Yang paling berbahaya bukan jenjang yang keliru - itu terlihat - melainkan
 * blangko yang HILANG dari jenjang karena namanya tidak mengikuti pola.
 * Blangko yang tidak muncul akan dicari panitera di luar ALETA, dan ia tidak
 * kembali.
 */

function blangko(sebagian: Partial<BlangkoItem> & { berkas: string }): BlangkoItem {
  return {
    kode: "",
    kategori: "",
    eCourt: false,
    judul: "",
    basKe: 0,
    basVarian: "",
    keadaan: "",
    tindakan: "",
    ...sebagian,
  };
}

// Diuraikan bot dari nama berkas sungguhan di - BAS VERSTEK PERCERAIAN -.
const BAS_VERSTEK: BlangkoItem[] = [
  blangko({
    berkas: "[01a] (E-Court) BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T.rtf",
    kode: "01a",
    eCourt: true,
    basKe: 1,
    keadaan: "P Hadir & T Tidak Hadir",
    tindakan: "Tunda Panggil T",
  }),
  blangko({
    berkas: "[01b] (E-Court) BAS 2 P Hadir & T Tidak Hadir Pokok Perkara - Putusan Verstek.rtf",
    kode: "01b",
    eCourt: true,
    basKe: 2,
    keadaan: "P Hadir & T Tidak Hadir Pokok Perkara",
    tindakan: "Putusan Verstek",
  }),
  blangko({
    berkas: "[09] (E-Court) BAS 2 P Hadir & T Tidak Hadir - Putusan Verstek - (3 Saksi).rtf",
    kode: "09",
    eCourt: true,
    basKe: 2,
    keadaan: "P Hadir & T Tidak Hadir",
    tindakan: "Putusan Verstek - (3 Saksi)",
  }),
  blangko({
    berkas: "[99] BAS 1 P & T Tidak Hadir - Tunda Panggil P & T.rtf",
    kode: "99",
    basKe: 1,
    keadaan: "P & T Tidak Hadir",
    tindakan: "Tunda Panggil P & T",
  }),
];

// Dari 1 Perceraian CG - blangko putusan, dijenjangkan menurut skenario akhir.
const PUTUSAN_CG: BlangkoItem[] = [
  blangko({
    berkas: "[01] [Kabul Verstek] Cerai (Format Lengkap).rtf",
    kode: "01",
    kategori: "Kabul Verstek",
    keadaan: "Cerai (Format Lengkap)",
  }),
  blangko({
    berkas: "[01ab] [Tolak Verstek] Cerai - Tidak ada bukti.rtf",
    kode: "01ab",
    kategori: "Tolak Verstek",
    keadaan: "Cerai",
    tindakan: "Tidak ada bukti",
  }),
  blangko({
    berkas: "[98] [Cabut] 1. Cerai P Hadir & T Tidak Hadir - Tanpa Mediasi (P & T Damai).rtf",
    kode: "98",
    kategori: "Cabut",
    keadaan: "1. Cerai P Hadir & T Tidak Hadir",
    tindakan: "Tanpa Mediasi (P & T Damai)",
  }),
];

describe("set menurut jenis perkara", () => {
  it("cerai gugat mendapat BAS perceraian dan putusan CG lebih dulu", () => {
    const urut = setUntukPerkara("Cerai Gugat");
    const cocok = urut.filter((set) => set.cocok).map((set) => set.id);

    expect(cocok).toContain("bas-verstek");
    expect(cocok).toContain("putusan-cg");
    expect(cocok).not.toContain("putusan-dispensasi");
    // BAS lebih dulu: halaman ini alat bantu tulis BAS.
    expect(urut[0].jenis).toBe("bas");
  });

  it("nama jenis perkara SIPP yang panjang tetap dikenali", () => {
    // SIPP menuliskannya "Pengesahan Perkawinan/Istbat Nikah" - dengan satu t,
    // dan digabung dua sebutan. Pencocokan ketat akan meleset di sini.
    const cocok = setUntukPerkara("Pengesahan Perkawinan/Istbat Nikah")
      .filter((set) => set.cocok)
      .map((set) => set.id);

    expect(cocok).toContain("bas-itsbat");
    expect(cocok).toContain("putusan-itsbat");
  });

  // Sejak 25 September 2026 set RELAAS ikut di SET_BLANGKO, dan ia dikecualikan
  // dengan sengaja dari setUntukPerkara: relaas dipilih menurut KEADAAN perkara
  // (sidang pertama, sidang ditunda, pemberitahuan putusan), bukan menurut jenis
  // perkaranya, dan ia punya panelnya sendiri. Jadi patokannya bukan lagi
  // SET_BLANGKO.length melainkan yang BERJENJANG saja - nilainya yang berubah,
  // bukan ketatnya.
  const SET_BERJENJANG = SET_BLANGKO.filter((set) => set.jenis !== "relaas");

  it("set yang tidak cocok tidak dibuang, hanya turun", () => {
    const urut = setUntukPerkara("Cerai Gugat");
    // Perkara kadang menuntut blangko yang tidak lazim. Set yang disembunyikan
    // berarti panitera keluar dari ALETA untuk mengambilnya - lalu tidak kembali.
    expect(urut).toHaveLength(SET_BERJENJANG.length);
    expect(urut.map((set) => set.id)).toContain("putusan-dispensasi");
  });

  it("jenis perkara yang tidak dikenali tetap memberi seluruh set berjenjang", () => {
    const urut = setUntukPerkara("Ekonomi Syariah");
    expect(urut).toHaveLength(SET_BERJENJANG.length);
    expect(urut.every((set) => !set.cocok)).toBe(true);
  });

  it("set relaas TIDAK ditawarkan pemilih berjenjang", () => {
    // Kalau ia ikut, pemilih BAS akan menawarkan blangko yang pertanyaan
    // penjenjangnya tidak berlaku sama sekali - dan panitera yang memilihnya
    // mendapat daftar kosong tanpa keterangan.
    for (const jenis of ["Cerai Gugat", "Cerai Talak", "Ekonomi Syariah", ""]) {
      expect(setUntukPerkara(jenis).map((set) => set.id), jenis).not.toContain("relaas-jurusita");
    }
    // Tetapi ia HARUS ada di katalognya, sebab panel relaas membacanya dari sana.
    expect(SET_BLANGKO.map((set) => set.id)).toContain("relaas-jurusita");
  });

  it("perkara tanpa jenis tidak menandai apa pun cocok", () => {
    expect(setUntukPerkara("").every((set) => !set.cocok)).toBe(true);
  });
});

describe("menjenjangkan BAS menurut nomor sidang", () => {
  it("sidang ke-1 dan ke-2 menjadi tingkat yang terpisah", () => {
    const jenjang = jenjangkan("bas", BAS_VERSTEK);

    expect(jenjang.map((t) => t.label)).toEqual(["Sidang ke-1", "Sidang ke-2"]);
    expect(jenjang[0].blangko).toHaveLength(2);
    expect(jenjang[1].blangko).toHaveLength(2);
  });

  it("tidak ada blangko yang hilang saat dijenjangkan", () => {
    // Blangko yang lenyap dari jenjang akan dicari di luar ALETA.
    const jenjang = jenjangkan("bas", BAS_VERSTEK);
    const semua = jenjang.flatMap((t) => t.blangko.map((b) => b.berkas));
    expect(semua.sort()).toEqual(BAS_VERSTEK.map((b) => b.berkas).sort());
  });

  it("blangko tanpa nomor sidang masuk Lainnya, dan Lainnya berada di akhir", () => {
    const jenjang = jenjangkan("bas", [
      ...BAS_VERSTEK,
      blangko({ berkas: "Blangko tanpa pola.rtf", judul: "Blangko tanpa pola", keadaan: "Blangko tanpa pola" }),
    ]);

    expect(jenjang[jenjang.length - 1].label).toBe("Lainnya");
    expect(jenjang[jenjang.length - 1].blangko).toHaveLength(1);
  });
});

describe("menjenjangkan putusan menurut skenario akhir", () => {
  it("tiap skenario menjadi tingkatnya sendiri", () => {
    const jenjang = jenjangkan("putusan", PUTUSAN_CG);
    expect(jenjang.map((t) => t.label).sort()).toEqual(["Cabut", "Kabul Verstek", "Tolak Verstek"]);
  });

  it("skenario tidak dijenjangkan menurut nomor sidang", () => {
    // Putusan disusun setelah hasilnya diketahui; nomor sidang bukan yang
    // pertama diketahui panitera di sini.
    const jenjang = jenjangkan("putusan", PUTUSAN_CG);
    expect(jenjang.some((t) => t.label.startsWith("Sidang"))).toBe(false);
  });
});

describe("nama blangko di dalam jenjangnya", () => {
  it("tidak mengulang nomor sidang yang sudah menjadi nama tingkat", () => {
    const label = labelBlangko("bas", BAS_VERSTEK[1]);
    expect(label).not.toContain("BAS 2");
    expect(label).toContain("P Hadir & T Tidak Hadir");
    expect(label).toContain("Putusan Verstek");
  });

  it("blangko tanpa keadaan maupun tindakan tetap punya nama", () => {
    // Nama kosong pada daftar pilihan berarti baris yang tidak dapat ditekan
    // dengan yakin - dan panitera akan melewatinya.
    const label = labelBlangko("bas", blangko({ berkas: "Aneh.rtf", judul: "Aneh" }));
    expect(label).toBe("Aneh");
  });
});

describe("usulan bawaan dari jenjang putusan - untuk pemetaan ekstensi", () => {
  const item = (berkas: string, kategori: string): BlangkoItem =>
    blangko({ berkas, kategori, judul: berkas.replace(/\.rtf$/i, "") });

  it("memilih skenario KABUL, dan yang pertama menurut urutan alami di dalamnya", () => {
    const jenjang = jenjangkan("putusan", [
      item("[01ab] [Tolak Verstek] Cerai - Tidak ada bukti.rtf", "Tolak Verstek"),
      item("[01b] [Kabul Verstek] Cerai (Ringkas).rtf", "Kabul Verstek"),
      item("[01] [Kabul Verstek] Cerai (Format Lengkap).rtf", "Kabul Verstek"),
      item("[98] [Cabut] 1. Cerai P Hadir.rtf", "Cabut"),
    ]);
    const usulan = usulanPutusanDariJenjang(jenjang);
    expect(usulan).toMatchObject({
      berkas: "[01] [Kabul Verstek] Cerai (Format Lengkap).rtf",
      kunciJenjang: "kabul verstek",
    });
  });

  it("tanpa jenjang kabul, jatuh ke jenjang pertama yang bukan 'lainnya'", () => {
    const jenjang = jenjangkan("putusan", [
      item("Blangko tanpa pola.rtf", ""),
      item("[02] [Tolak] IN.rtf", "Tolak"),
    ]);
    expect(usulanPutusanDariJenjang(jenjang)?.berkas).toBe("[02] [Tolak] IN.rtf");
  });

  it("hanya 'lainnya' berarti null - nama tanpa pola bukan bawaan, melainkan tebakan", () => {
    const jenjang = jenjangkan("putusan", [item("Blangko tanpa pola.rtf", ""), item("Lagi tanpa pola.rtf", "")]);
    expect(usulanPutusanDariJenjang(jenjang)).toBeNull();
    expect(usulanPutusanDariJenjang([])).toBeNull();
  });

  it("set putusan untuk jenis: BAS tidak ikut, dan hanya yang cocok", () => {
    const cg = setPutusanUntukPerkara("Cerai Gugat");
    expect(cg.length).toBeGreaterThan(0);
    expect(cg.every((s) => s.jenis === "putusan")).toBe(true);
    expect(cg.some((s) => s.id === "putusan-cg")).toBe(true);
    expect(cg.some((s) => s.id === "bas-verstek")).toBe(false);
    expect(setPutusanUntukPerkara("Dispensasi Kawin").map((s) => s.id)).toContain("putusan-dispensasi");
    expect(setPutusanUntukPerkara("Itsbat Nikah").map((s) => s.id)).toContain("putusan-itsbat");
    expect(setPutusanUntukPerkara("")).toEqual([]);
  });
});

/**
 * Sandi kehadiran SIPP dan pemetaan golongan bot.
 *
 * Arti sandinya dibaca dari borang SIPP (jadwal_sidang_p_edit.php): 1 "Semua
 * Pihak", 2 "<Pihak Pertama> Saja", 3 "<Pihak Kedua> Saja", 4 "Para Pihak
 * Tidak Hadir". Sampai 25 September 2026 sandi 1 dijawab "tidak-diketahui" -
 * 7.486 sidang disodorkan sebagai pertanyaan padahal SIPP sudah menjawabnya.
 */
describe("relaas: sandi kehadiran dan golongan", () => {
  it("empat sandi borang SIPP", () => {
    expect(pihakDipanggil(1)).toBe("tidak-perlu");
    expect(pihakDipanggil("1")).toBe("tidak-perlu");
    expect(pihakDipanggil(2)).toBe("kedua");
    expect(pihakDipanggil(3)).toBe("pertama");
    expect(pihakDipanggil(4)).toBe("keduanya");
  });

  it("kosong TIDAK terbaca sebagai sandi - ia jatuh ke 0, dan 0 bukan sandi borang", () => {
    for (const kosong of [null, undefined, "", "  "]) {
      expect(pihakDipanggil(kosong)).toBe("tidak-diketahui");
    }
  });

  it("sandi pihak ketiga dan 'sebagian' ditanyakan, tidak dipetakan", () => {
    for (const sandi of [0, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, "x"]) {
      expect(pihakDipanggil(sandi)).toBe("tidak-diketahui");
    }
  });

  it("semua hadir: sidang lanjutan dan pemberitahuan TIDAK punya blangko", () => {
    expect(blangkoRelaas("sidang-ditunda", "tidak-perlu")).toBeNull();
    expect(blangkoRelaas("pemberitahuan-putusan", "tidak-perlu")).toBeNull();
  });

  it("sidang pertama dan ikrar talak tetap dua pihak walau sandinya 1", () => {
    // Kehadiran yang terbaca untuk keduanya milik sidang yang belum terjadi.
    expect(blangkoRelaas("sidang-pertama", "tidak-perlu")?.keadaan).toBe("sidang-pertama");
    expect(blangkoRelaas("ikrar-talak", "tidak-perlu")?.keadaan).toBe("ikrar-talak");
  });

  it("sidang ditunda memilih blangko menurut siapa yang tidak hadir", () => {
    const pt = BLANGKO_RELAAS.find((x) => x.keadaan === "sidang-pertama")!.berkas;
    const t = BLANGKO_RELAAS.find((x) => x.keadaan === "sidang-ditunda")!.berkas;
    expect(blangkoRelaas("sidang-ditunda", pihakDipanggil(2))?.berkas).toBe(t);
    expect(blangkoRelaas("sidang-ditunda", pihakDipanggil(3))?.berkas).toBe(pt);
    expect(blangkoRelaas("sidang-ditunda", pihakDipanggil(4))?.berkas).toBe(pt);
  });

  it("golongan bot -> keadaan: 'sidang-lanjutan' memakai blangko sidang lanjutan", () => {
    expect(keadaanUntukGolongan("sidang-lanjutan")).toBe("sidang-ditunda");
    expect(keadaanUntukGolongan("sidang-ditunda")).toBe("sidang-ditunda");
    expect(keadaanUntukGolongan("sidang-pertama")).toBe("sidang-pertama");
    expect(keadaanUntukGolongan("ikrar-talak")).toBe("ikrar-talak");
    expect(keadaanUntukGolongan("pemberitahuan-putusan")).toBe("pemberitahuan-putusan");
  });

  it("golongan yang tidak dikenal dijawab null, bukan ditebak", () => {
    for (const g of ["", null, undefined, "delegasi", "amplop", "toString", "Sidang-Pertama"]) {
      expect(keadaanUntukGolongan(g)).toBeNull();
    }
  });
});
