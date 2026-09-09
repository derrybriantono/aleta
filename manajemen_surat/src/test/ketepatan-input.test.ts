// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * KETEPATAN PENGINPUTAN - JARAK ANTARA PERISTIWA DAN SAAT DIKETIK
 * ============================================================================
 *
 * Sebelas butir ketaatan yang sudah ada mengukur TANGGAL PERISTIWANYA.
 * Penetapan yang BERTANGGAL 3 Januari tetapi baru DIKETIK 20 Januari karena
 * itu terbaca patuh sempurna - jaraknya nol hari dari pendaftaran - padahal
 * selama tujuh belas hari SIPP tidak memuat keterangan yang seharusnya sudah
 * ada, dan siapa pun yang membuka perkara itu melihat perkara yang belum
 * bermajelis.
 *
 * Empat butir katalog e-Audit menyebutkan kekurangan ini dengan kalimatnya
 * sendiri: "Butir ini menuntut tanggal PENGINPUTAN. Yang dinilai tanggal
 * penetapannya, dan keduanya dapat berbeda jauh."
 *
 * ============================================================================
 * ATURANNYA SUDAH ADA - DI TEMPAT YANG SALAH
 * ============================================================================
 *
 * Skala nilainya sudah dipakai ALETA tiap hari, terkubur di dalam satu kueri
 * pemberitahuan WhatsApp di notifikasi.js. Aturan yang hidup di dalam kueri
 * pemberitahuan tidak dapat diuji, tidak dapat disandingkan, dan tidak muncul
 * di rapor mana pun - ia dipakai tiap hari dan tidak pernah dapat
 * dipertanggungjawabkan.
 *
 * Uji terakhir di berkas ini mengikat keduanya: bila skala di notifikasi.js
 * berubah dan yang di mesin penilaian tidak, yang gagal uji itu.
 */

const require_ = createRequire(import.meta.url);
const akarBot = path.resolve(process.cwd(), "../aleta_bot");

type Baris = {
  nomorPerkara: string;
  tanggalPeristiwa: string;
  tanggalDiinput: string;
  jarakHari: number | null;
  nilaiSkala: number | null;
  memenuhi: boolean;
  sebabTidakMemenuhi: string;
};

const layanan = require_(path.join(akarBot, "services/penilaianKetepatanInputService.js")) as {
  PERISTIWA: Array<{ kunci: string; kode: string; tabel: string; ruas: string }>;
  RUAS_INPUT: string;
  SKALA: Array<{ sampaiHari: number; nilai: number }>;
  daftarkanSemua: () => string[];
  nilaiSkala: (n: unknown) => number | null;
  sebutanJarak: (n: unknown) => string;
  selisihHari: (a: string, b: string) => number | null;
  susunKueri: (p: { tabel: string; ruas: string }) => string;
};

describe("skala nilai - murni, dan dapat diuji tanpa SIPP", () => {
  it("memberi lima hanya pada hari yang sama", () => {
    expect(layanan.nilaiSkala(0)).toBe(5);
    expect(layanan.nilaiSkala(1)).toBe(3);
    expect(layanan.nilaiSkala(2)).toBe(2);
    expect(layanan.nilaiSkala(3)).toBe(1);
    expect(layanan.nilaiSkala(4)).toBe(0);
    expect(layanan.nilaiSkala(30)).toBe(0);
  });

  it("baris yang diketik SEBELUM peristiwanya tidak bernilai, bukan bernilai sempurna", () => {
    // Selisih negatif berarti tanggalnya keliru. Menilainya lima akan
    // menyembunyikan justru temuan yang paling perlu dilihat - dan tanggal
    // mundur kadang berarti sesuatu yang lebih daripada salah ketik.
    expect(layanan.nilaiSkala(-1)).toBeNull();
    expect(layanan.nilaiSkala(-30)).toBeNull();
    expect(layanan.sebutanJarak(-2)).toContain("SEBELUM");
  });

  it("yang tidak terhitung tidak dipaksa jadi angka", () => {
    expect(layanan.nilaiSkala(null)).toBeNull();
    expect(layanan.nilaiSkala("bukan angka")).toBeNull();
  });

  it("selisih hari dihitung apa adanya", () => {
    // Contoh yang menjadi sebab butir ini ada.
    expect(layanan.selisihHari("2026-01-03", "2026-01-20")).toBe(17);
    expect(layanan.selisihHari("2026-01-03", "2026-01-03")).toBe(0);
    expect(layanan.selisihHari("2026-03-01", "2026-02-27")).toBe(-2);
    expect(layanan.selisihHari("", "2026-01-03")).toBeNull();
  });
});

describe("penilaiannya berdiri sesuai kontrak mesin", () => {
  const kerangka = require_(path.join(akarBot, "services/kerangkaPenilaianService.js")) as {
    ambil: (kunci: string) => unknown;
    celaDefinisi: (def: unknown) => string[];
  };

  it("keempatnya terdaftar dan tanpa cela", () => {
    const kunci = layanan.daftarkanSemua();
    expect(kunci).toHaveLength(4);

    for (const satu of kunci) {
      const def = kerangka.ambil(satu);
      expect(def, satu).toBeTruthy();
      // MS04 - penilaian WAJIB dapat menyebutkan buktinya. Definisi tanpa
      // baris() ditolak kerangka, dan penolakan itulah yang menegakkannya.
      expect(kerangka.celaDefinisi(def), satu).toEqual([]);
    }
  });

  it("kueri yang disusun menyebut kolom jejaknya", () => {
    const sql = layanan.susunKueri({ tabel: "perkara_hakim_pn", ruas: "tanggal_penetapan" });
    expect(sql).toContain(layanan.RUAS_INPUT);
    expect(sql).toContain("tanggal_penetapan");
    // Rentangnya disaring dari tanggal pendaftaran perkaranya, sama seperti
    // seluruh penilaian lain - supaya angkanya dapat disandingkan.
    expect(sql).toContain("p.tanggal_pendaftaran >= ?");
  });
});

describe("baris bukti - dijalankan dengan basis data palsu", () => {
  /**
   * Memuat layanan dengan basis data dan pembaca skema palsu.
   *
   * Yang diuji di sini KEPUTUSANNYA atas tiap baris, bukan perilaku MySQL.
   * Menyambung ke SIPP sungguhan hanya akan menguji MySQL, dan menuntut
   * perkara yang kebetulan berjarak input tertentu ada di sana.
   */
  function muat(baris: Array<Record<string, unknown>>, punyaJejak = true) {
    const Module = require_("module") as unknown as new (id: string) => {
      filename: string;
      loaded: boolean;
      exports: unknown;
    };

    const pasang = (jalur: string, isi: unknown) => {
      const m = new Module(jalur);
      m.filename = jalur;
      m.loaded = true;
      m.exports = isi;
      (require_.cache as Record<string, unknown>)[jalur] = m;
    };

    pasang(require_.resolve(path.join(akarBot, "db_config")), {
      query: (_sql: string, _params: unknown[], balik: (g: unknown, h: unknown) => void) =>
        balik(null, baris),
    });
    pasang(require_.resolve(path.join(akarBot, "services/sippSkemaService")), {
      kolomAda: async () => punyaJejak,
      tabelAda: async () => true,
    });

    const jalur = require_.resolve(path.join(akarBot, "services/penilaianKetepatanInputService"));
    delete (require_.cache as Record<string, unknown>)[jalur];
    return require_(jalur) as typeof layanan & {
      daftarkanSemua: () => string[];
    };
  }

  const rentang = { mulai: "2026-01-01", selesai: "2026-12-31" };

  async function jalankan(baris: Array<Record<string, unknown>>, punyaJejak = true) {
    const ulang = muat(baris, punyaJejak);
    const kerangka = require_(path.join(akarBot, "services/kerangkaPenilaianService.js")) as {
      ambil: (k: string) => { baris: (r: unknown) => Promise<Baris[]> } | null;
      lupakanSemua: () => void;
    };
    kerangka.lupakanSemua();
    ulang.daftarkanSemua();
    const def = kerangka.ambil("ketepatanInputPenetapanMajelis");
    return (await def!.baris(rentang)) as Baris[];
  }

  it("diinput pada hari yang sama memenuhi", async () => {
    const hasil = await jalankan([
      { nomorPerkara: "1/Pdt.G/2026", peristiwa: "2026-01-03", diinput: "2026-01-03" },
    ]);
    expect(hasil).toHaveLength(1);
    expect(hasil[0].memenuhi).toBe(true);
    expect(hasil[0].nilaiSkala).toBe(5);
  });

  it("tujuh belas hari kemudian TIDAK memenuhi, dan sebabnya disebut", async () => {
    // Inilah keadaan yang membuat butir ini ada.
    const hasil = await jalankan([
      { nomorPerkara: "2/Pdt.G/2026", peristiwa: "2026-01-03", diinput: "2026-01-20" },
    ]);
    expect(hasil[0].memenuhi).toBe(false);
    expect(hasil[0].jarakHari).toBe(17);
    expect(hasil[0].nilaiSkala).toBe(0);
    expect(hasil[0].sebabTidakMemenuhi).toContain("17");
  });

  it("tanpa jejak dihitung TIDAK memenuhi, bukan dikeluarkan", async () => {
    // Mengeluarkannya dari penyebut akan membuat pengadilan yang jejaknya
    // paling banyak hilang justru bernilai paling baik.
    const hasil = await jalankan([
      { nomorPerkara: "3/Pdt.G/2026", peristiwa: "2026-01-03", diinput: null },
    ]);
    expect(hasil).toHaveLength(1);
    expect(hasil[0].memenuhi).toBe(false);
    expect(hasil[0].sebabTidakMemenuhi).toContain("jejak");
  });

  it("peristiwa yang belum terjadi dikeluarkan, bukan dihitung gagal", async () => {
    // Ia bukan terlambat - ia belum ada, dan itu urusan butir ketaatan lain.
    const hasil = await jalankan([
      { nomorPerkara: "4/Pdt.G/2026", peristiwa: null, diinput: null },
    ]);
    expect(hasil).toHaveLength(0);
  });

  it("SIPP tanpa kolom jejak tidak menghasilkan angka apa pun", async () => {
    // Bukan nol yang menuduh - penilaian tanpa baris tidak punya penyebut,
    // sehingga ia tidak menghasilkan angka sama sekali.
    const hasil = await jalankan(
      [{ nomorPerkara: "5/Pdt.G/2026", peristiwa: "2026-01-03", diinput: "2026-01-03" }],
      false
    );
    expect(hasil).toHaveLength(0);
  });
});

describe("skalanya tidak boleh menyimpang dari yang sudah dipakai", () => {
  it("sama persis dengan skala di pemberitahuan harian", () => {
    // Skala yang sama hidup di dua tempat: di sini, dan di dalam kueri
    // pemberitahuan WhatsApp yang mengirimkannya tiap hari. Dua tempat yang
    // mengucapkan hal sama akan menyimpang - dan bila menyimpang, angka rapor
    // dan angka yang diterima petugas lewat WhatsApp akan berbeda untuk
    // perkara yang persis sama.
    const notifikasi = readFileSync(path.join(akarBot, "notifikasi.js"), "utf8");

    for (const tingkat of layanan.SKALA) {
      const pola = new RegExp(
        `DATEDIFF\\(q\\.diinput_tanggal, q\\.tanggal\\) = ${tingkat.sampaiHari} THEN ${tingkat.nilai}`
      );
      expect(pola.test(notifikasi), `${tingkat.sampaiHari} hari -> ${tingkat.nilai}`).toBe(true);
    }
  });

  it("keempatnya punya tempat di katalog e-Audit", () => {
    // Penilaian yang berjalan tanpa tercatat di mana pun adalah pekerjaan yang
    // tidak dapat dipertanggungjawabkan - dan pada suatu hari tidak ada yang
    // tahu mengapa ia ada.
    const katalog = require_(path.join(akarBot, "services/katalogEAuditService.js")) as {
      DI_LUAR_KATALOG: Record<string, string>;
    };
    for (const p of layanan.PERISTIWA) {
      expect(katalog.DI_LUAR_KATALOG[p.kunci], p.kunci).toBeTruthy();
    }
  });

  it("ambangnya membawa dasarnya, dan tidak mengaku peraturan", () => {
    // Dasar peraturannya belum diperiksa terhadap naskah resmi. Menandainya
    // "peraturan" berarti menuliskan dasar hukum yang belum tentu ada - dan
    // ambang yang mengaku berdasar peraturan tidak boleh diubah pimpinan.
    const ambang = require_(path.join(akarBot, "services/ambangPenilaianService.js")) as {
      ambangBerlaku: (kunci: string, tanggal: string) => { sifat: string; dasar: string } | null;
    };
    const berlaku = ambang.ambangBerlaku("ketepatanInput", "2026-09-10");
    expect(berlaku).toBeTruthy();
    expect(berlaku!.sifat).toBe("kebijakan");
    expect(berlaku!.dasar).toContain("belum diperiksa");
  });
});
