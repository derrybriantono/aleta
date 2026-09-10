// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * SATU TABEL SIPP YANG BELUM DIISI MEMATIKAN DUA PENETAPAN
 * ============================================================================
 *
 * Usulan PMH untuk perkara bermajelis dahulu MENUNGGU baris di tabel
 * perkara_smartmajelis milik SIPP. Selama SIPP belum menjalankan Smart Majelis
 * untuk perkara itu, ALETA menyerah dengan alasan "belum_ada_usulan_smartmajelis".
 *
 * Akibatnya berantai, dan itu yang paling merugikan: PHS mencari hari sidang
 * lewat majelisKode, dan majelisKode ikut kosong - sehingga PHS berbunyi
 * "menunggu majelisnya ditentukan lebih dulu". Dua penetapan mati sekaligus,
 * dan petugas harus membuka Smart Majelis di SIPP lalu kembali.
 *
 * Padahal bahannya sudah di tangan dan seluruhnya dari SIPP sendiri: susunan
 * majelis yang BENAR-BENAR dipakai tahun ini beserta jumlah perkaranya - yang
 * selama ini sudah digambar pada pilihan manual, dan sudah dipercaya orang
 * untuk memilih dengan tangan.
 */

const require_ = createRequire(import.meta.url);
const layanan = require_(
  path.resolve(process.cwd(), "../aleta_bot/services/penunjukanService.js")
) as {
  susunPmh: (args: Record<string, unknown>) => {
    majelisKode: string;
    anggota: Array<{ hakimId: number; kode: string; nama: string }>;
    sebab: string;
    keterangan?: string;
    susunanTerpakai: unknown[];
  };
};

const HAKIM = [
  { hakimId: 1, kode: "A", nama: "Fahri Saifuddin" },
  { hakimId: 2, kode: "B", nama: "Sudarmin H.I.M. Tang" },
  { hakimId: 3, kode: "C", nama: "Himawan Tatura Wijaya" },
  { hakimId: 4, kode: "D", nama: "Idris" },
  { hakimId: 5, kode: "E", nama: "Derry Briantono" },
];

/** Dua susunan yang benar-benar dipakai - yang satu lebih berat. */
const SUSUNAN = [
  {
    kunci: "2-4-5",
    hakimId: [2, 4, 5],
    perkara: 147,
    anggota: [
      { hakimId: 2, kode: "B", nama: "Sudarmin H.I.M. Tang" },
      { hakimId: 4, kode: "D", nama: "Idris" },
      { hakimId: 5, kode: "E", nama: "Derry Briantono" },
    ],
  },
  {
    kunci: "1-3-5",
    hakimId: [1, 3, 5],
    perkara: 52,
    anggota: [
      { hakimId: 1, kode: "A", nama: "Fahri Saifuddin" },
      { hakimId: 3, kode: "C", nama: "Himawan Tatura Wijaya" },
      { hakimId: 5, kode: "E", nama: "Derry Briantono" },
    ],
  },
];

function panggil(smart: Record<string, unknown>, susunanTerpakai = SUSUNAN) {
  return layanan.susunPmh({
    bentuk: { bentuk: "majelis", sebab: "jenis perkara bermajelis" },
    smart,
    susunan: { terbaca: true, majelis: [] },
    hakimAktif: HAKIM,
    namaHakim: new Map(HAKIM.map((x) => [x.hakimId, x])),
    beban: new Map(),
    bebanMajelis: new Map(HAKIM.map((x) => [x.hakimId, x.hakimId * 10])),
    susunanTerpakai,
    aturan: {},
  });
}

describe("Smart Majelis belum jalan - ALETA mengusulkan sendiri", () => {
  const tanpaSmart = { ada: false, alasan: "belum_ada_usulan_smartmajelis" };

  it("usulannya tidak lagi kosong", () => {
    const pmh = panggil(tanpaSmart);
    expect(pmh.anggota).toHaveLength(3);
    expect(pmh.majelisKode).not.toBe("");
  });

  it("yang dipilih susunan dengan perkara PALING SEDIKIT", () => {
    // Asas yang sama dengan giliran panitera pengganti dan juru sita -
    // bukan aturan baru, hanya diterapkan pada majelis.
    const pmh = panggil(tanpaSmart);
    expect(pmh.anggota.map((x) => x.nama)).toEqual([
      "Fahri Saifuddin",
      "Himawan Tatura Wijaya",
      "Derry Briantono",
    ]);
  });

  it("majelisKode adalah kode KETUANYA - inilah yang dicari PHS", () => {
    // PHS membaca hariSidang[pmh.majelisKode]. Kode yang keliru berarti hari
    // sidangnya tidak ketemu, dan PHS kembali mati dengan sebab yang lain.
    const pmh = panggil(tanpaSmart);
    expect(pmh.majelisKode).toBe("A");
    expect(pmh.anggota[0].kode).toBe("A");
  });

  it("sebabnya menyatakan ini usulan ALETA, BUKAN Smart Majelis", () => {
    // Menuliskannya seolah dari Smart Majelis akan membuat orang menyangka
    // SIPP sudah memutuskan padahal belum.
    const pmh = panggil(tanpaSmart);
    expect(pmh.sebab).toContain("usulan ALETA");
    expect(pmh.sebab).toContain("Smart Majelis SIPP belum dijalankan");
    expect(pmh.keterangan).toContain("Bukan keluaran Smart Majelis");
  });

  it("jumlah perkaranya disebut, supaya dasarnya dapat diperiksa", () => {
    expect(panggil(tanpaSmart).keterangan).toContain("52 perkara");
  });

  it("susunan berdua tidak dipakai sebagai majelis", () => {
    // Majelis sekurangnya tiga orang. Susunan berdua di perkara_hakim_pn
    // biasanya sisa penggantian, bukan majelis yang berdiri.
    const berdua = [
      { kunci: "1-3", hakimId: [1, 3], perkara: 1, anggota: SUSUNAN[1].anggota.slice(0, 2) },
      ...SUSUNAN,
    ];
    const pmh = panggil(tanpaSmart, berdua);
    expect(pmh.anggota).toHaveLength(3);
  });
});

describe("Smart Majelis tetap didahulukan bila ada", () => {
  it("usulan SIPP dipakai apa adanya, bukan digantikan giliran ALETA", () => {
    // Perubahan ini TIDAK boleh mengambil alih keputusan SIPP. Kalau Smart
    // Majelis sudah jalan, itulah yang berlaku.
    const pmh = panggil({ ada: true, alasan: "", hakimId: [2, 4, 5], diganti: false, keterangan: "" });
    expect(pmh.sebab).toBe("usulan smart majelis");
    expect(pmh.anggota.map((x) => x.hakimId)).toEqual([2, 4, 5]);
  });
});

describe("kalau memang tidak ada bahannya, tetap menyerah - dengan sebab", () => {
  it("susunan kosong tidak dikarang", () => {
    const pmh = panggil({ ada: false, alasan: "belum_ada_usulan_smartmajelis" }, []);
    expect(pmh.anggota).toHaveLength(0);
    expect(pmh.majelisKode).toBe("");
    expect(pmh.sebab).toContain("susunan majelis tahun ini belum terbaca");
  });
});
