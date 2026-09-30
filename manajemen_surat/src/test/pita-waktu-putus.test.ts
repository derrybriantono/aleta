// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { PITA_WAKTU_PUTUS, pitaWaktuPutus } from "@/lib/pita-waktu-putus";

/**
 * ============================================================================
 * PITA WAKTU PUTUS - SK DIRJEN BADILAG 048/DJA/SK.KP3.4.3/IV/2024
 * ============================================================================
 *
 * Diminta pengguna 24 September 2026: umur perkara di Antrian Sidang diberi
 * warna menurut unsur Waktu Putus Perkara SK - paling lama 3 bulan hijau,
 * 4 bulan kuning, 5 bulan oranye, lebih dari 5 bulan merah - atas hari
 * perkara berjalan DI LUAR hari mediasi.
 *
 * Yang dijaga di sini SATU SUMBER. Tangga 90/120/150 ditulis sekali, di
 * penilaianSippService (TANGGA_WAKTU_PUTUS), dan dipakai dua layar: unsur
 * waktuPutus di Status Perkara dan warna umur perkara di Antrian Sidang.
 * Sebelumnya Antrian mewarnai menurut sisa terhadap 150 hari dengan aturan
 * buatannya sendiri - perkara 100 hari netral di sana padahal nilai SK-nya
 * sudah turun dari 5 ke 3. Portal hanya menerjemahkan NILAI ke warna
 * (lib/pita-waktu-putus); ia tidak memutuskan pita dari jumlah hari.
 *
 * Penjaga layar (UmurPerkara dan Rincian waktu perkara) ditulis bersama
 * layarnya, bukan di sini.
 */

const require_ = createRequire(import.meta.url);
const akarBot = path.resolve(process.cwd(), "../aleta_bot");

type HasilWaktuPutus = {
  kotor: number;
  mediasi: number;
  mediasiMentah: number;
  potongan: { hari: number; hariMentah: number; sebab: string };
  bersih: number;
  nilai: number;
  sebutan: string;
  dariHari: number;
  sampaiHari: number | null;
  sisaDiPita: number | null;
};

const penilaian = require_(path.join(akarBot, "services/penilaianSippService.js")) as {
  TANGGA_WAKTU_PUTUS: ReadonlyArray<{ sampaiHari: number | null; nilai: number; sebutan: string }>;
  JARAK_PHS_GHAIB_HARI: number;
  hitungWaktuPutus: (fakta: Record<string, unknown>) => HasilWaktuPutus | null;
  poinPerkara: (fakta: Record<string, unknown>) => {
    rinci: Array<{ kunci: string; poin: number | null; terbaca: boolean; catatan: string }>;
  };
};

const baca = (jalur: string) => readFileSync(path.join(akarBot, jalur), "utf8").replace(/\r\n/g, "\n");
const berkasPenilaian = baca("services/penilaianSippService.js");
const berkasJadwal = baca("services/sippJadwalSidangService.js");
const berkasTahapan = baca("services/sippTahapanService.js");

/** Kode tanpa komentar - supaya angka di kalimat penjelas tidak ikut terhitung. */
function tanpaKomentar(kode: string): string {
  return kode.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** Fakta dengan tanggal putus `selisih` hari sesudah 1 Januari 2026. */
function fakta(selisih: number, tambahan: Record<string, unknown> = {}) {
  const daftar = new Date("2026-01-01T00:00:00");
  return {
    tanggalDaftar: daftar,
    tanggalPutus: new Date(daftar.getTime() + selisih * 24 * 60 * 60 * 1000),
    ...tambahan,
  };
}

// ===========================================================================
// (a) TEPI SUNGGUHAN
// ===========================================================================

describe("tepi pita dihitung bot, warnanya diterjemahkan portal", () => {
  // Hari pendaftaran ikut dihitung: selisih 89 hari = hari ke-90.
  const tepi: Array<[number, number, number, string]> = [
    [89, 90, 5, "hijau"],
    [90, 91, 3, "kuning"],
    [119, 120, 3, "kuning"],
    [120, 121, 1, "oranye"],
    [149, 150, 1, "oranye"],
    [150, 151, 0, "merah"],
  ];

  for (const [selisih, bersih, nilai, warna] of tepi) {
    it(`selisih ${selisih} hari = hari ke-${bersih} = nilai ${nilai} = ${warna}`, () => {
      const h = penilaian.hitungWaktuPutus(fakta(selisih));
      expect(h).not.toBeNull();
      expect(h!.bersih).toBe(bersih);
      expect(h!.nilai).toBe(nilai);
      expect(pitaWaktuPutus(h!.nilai)?.warna).toBe(warna);
    });
  }

  it("nilai yang tidak dikenal tidak ditebak menjadi warna", () => {
    expect(pitaWaktuPutus(null)).toBeNull();
    expect(pitaWaktuPutus(undefined)).toBeNull();
    expect(pitaWaktuPutus(2)).toBeNull();
    expect(penilaian.hitungWaktuPutus({ tanggalDaftar: new Date("2026-01-01T00:00:00") })).toBeNull();
  });
});

// ===========================================================================
// (b) SATU SUMBER: UNSUR SK DAN WARNA ANTRIAN SELALU SAMA
// ===========================================================================

describe("unsur waktuPutus Status Perkara dan warna Antrian dari fungsi yang sama", () => {
  const selisihUji = [0, 45, 89, 90, 119, 120, 149, 150, 400];
  const ragam: Array<[string, Record<string, unknown>]> = [
    ["tanpa potongan", {}],
    ["mediasi 20 hari", { hariMediasi: 20 }],
    ["perkara ghaib", { perkaraGhaib: true }],
    ["mediasi dan ghaib", { hariMediasi: 20, perkaraGhaib: true }],
  ];

  for (const [nama, tambahan] of ragam) {
    it(`${nama}: nilainya sama pada kesembilan selisih`, () => {
      for (const selisih of selisihUji) {
        const h = penilaian.hitungWaktuPutus(fakta(selisih, tambahan));
        const unsur = penilaian
          .poinPerkara(fakta(selisih, tambahan))
          .rinci.find((k) => k.kunci === "waktuPutus");
        expect(unsur, `selisih ${selisih}`).toBeTruthy();
        expect(h!.nilai, `selisih ${selisih}`).toBe(unsur!.poin);
        // Angka hari yang dibaca di Status Perkara pun angka yang sama.
        expect(unsur!.catatan, `selisih ${selisih}`).toContain(`= ${h!.bersih} hari`);
      }
    });
  }
});

// ===========================================================================
// (c) MEDIASI DAN GHAIB
// ===========================================================================

describe("potongan mediasi dan kelonggaran ghaib", () => {
  it("mediasi 20 hari: perkara hari ke-101 dihitung 81 hari, hijau", () => {
    const h = penilaian.hitungWaktuPutus(fakta(100, { hariMediasi: 20 }));
    expect(h!.kotor).toBe(101);
    expect(h!.bersih).toBe(81);
    expect(h!.nilai).toBe(5);
  });

  it("ghaib muda dijepit ke 1 hari, tidak terbaca negatif - nilainya tetap 5", () => {
    const h = penilaian.hitungWaktuPutus(fakta(50, { perkaraGhaib: true }));
    expect(h!.bersih).toBe(1);
    expect(h!.nilai).toBe(5);
    expect(h!.potongan.hariMentah).toBe(120);
    expect(h!.potongan.hari).toBe(50);
    expect(h!.potongan.sebab).toBe("perkara ghaib");
  });

  it("ghaib hari ke-221 dikurangi 120 penuh = 101 hari, kuning", () => {
    const h = penilaian.hitungWaktuPutus(fakta(220, { perkaraGhaib: true }));
    expect(h!.potongan.hari).toBe(120);
    expect(h!.bersih).toBe(101);
    expect(pitaWaktuPutus(h!.nilai)?.warna).toBe("kuning");
  });

  it("sisa hari di pita dihitung dari tepi atas pitanya", () => {
    const h = penilaian.hitungWaktuPutus(fakta(99));
    expect([h!.bersih, h!.dariHari, h!.sampaiHari, h!.sisaDiPita]).toEqual([100, 91, 120, 20]);
    expect(penilaian.hitungWaktuPutus(fakta(400))!.sisaDiPita).toBeNull();
  });
});

// ===========================================================================
// (d) LEGENDA PORTAL SAMA DENGAN TANGGA BOT
// ===========================================================================

describe("legenda di portal tidak berselisih dengan tangga bot", () => {
  it("urutan nilainya sama: 5, 3, 1, 0", () => {
    expect(penilaian.TANGGA_WAKTU_PUTUS.map((x) => x.nilai)).toEqual([5, 3, 1, 0]);
    expect(PITA_WAKTU_PUTUS.map((p) => p.nilai)).toEqual([5, 3, 1, 0]);
  });

  it("rentang tiap pita menyebut batas atas harinya", () => {
    let dariHari = 1;
    for (const anak of penilaian.TANGGA_WAKTU_PUTUS) {
      const pita = pitaWaktuPutus(anak.nilai);
      expect(pita, `nilai ${anak.nilai}`).toBeTruthy();
      if (anak.sampaiHari !== null) {
        expect(pita!.rentang).toContain(`${anak.sampaiHari} hari`);
        // Batas bawahnya juga - "91-120 hari", bukan hanya "120 hari".
        if (dariHari > 1) expect(pita!.rentang).toContain(`${dariHari}-${anak.sampaiHari} hari`);
        dariHari = anak.sampaiHari + 1;
      }
    }
    expect(pitaWaktuPutus(0)!.rentang).toContain("150 hari");
  });

  it("empat warna yang diminta pengguna, masing-masing dengan kelasnya", () => {
    expect(PITA_WAKTU_PUTUS.map((p) => p.warna)).toEqual(["hijau", "kuning", "oranye", "merah"]);
    // Kuning memakai yellow, bukan amber: amber-100 dan orange-100 nyaris
    // sama di layar, sehingga kuning dan oranye tidak dapat dibedakan.
    expect(pitaWaktuPutus(3)!.kelasKotak).toContain("yellow");
    expect(pitaWaktuPutus(3)!.kelasKotak).not.toContain("amber");
    expect(pitaWaktuPutus(1)!.kelasKotak).toContain("orange");
  });

  it("penciri ghaib SK: jarak PHS ke sidang pertama 120 hari", () => {
    expect(penilaian.JARAK_PHS_GHAIB_HARI).toBe(120);
  });
});

// ===========================================================================
// (f) BOT MEMAKAI FUNGSI SK, TIDAK MENULIS TANGGA KEDUA
// ===========================================================================

describe("tangga ditulis sekali di bot", () => {
  it("durasiBanyakPerkara menilai lewat hitungWaktuPutus", () => {
    const i = berkasJadwal.indexOf("async function durasiBanyakPerkara(");
    expect(i).toBeGreaterThan(0);
    const blok = berkasJadwal.slice(i, berkasJadwal.indexOf("\nfunction ", i));
    expect(blok).toContain("penilaianSippService.hitungWaktuPutus(");
    expect(blok).toContain("waktuPutusSk:");
    expect(blok).toContain("hariKotor:");
    // Kelonggaran SK DIPOTONG dari hariBersih (permintaan pengguna 24 Sep
    // 2026 petang) - tetapi TIDAK dari sisaHari terhadap SEMA 2/2014.
    // Tinjauan pagi itu menemukan akibat memotong keduanya: perkara 163 hari
    // tampil "43 hari, sisa 107", dan kewajiban lapornya hilang dari layar.
    expect(blok).toContain("perkaraGhaib: Boolean(ghaib),");
    expect(blok).toContain("kelonggaran:");
    expect(blok).toContain(
      "const hariSema = waktuPutus ? waktuPutus.kotor - waktuPutus.mediasi : null;"
    );
    expect(blok).toContain("sisaHari: hariSema === null ? null : AMBANG_DURASI_HARI - hariSema,");
    expect(blok).not.toContain("AMBANG_DURASI_HARI - hariBersih");
    // Penciri ghaib TIDAK ditulis dua kali - dibaca dari layanan tahapan,
    // penciri yang sama dengan layar Status Perkara.
    expect(blok).toContain("sippTahapanService.penandaGhaibBanyakPerkara(");
    expect(blok).not.toContain("JARAK_PHS_GHAIB_HARI");
    expect(blok).not.toContain("FROM perkara_penetapan");
    // Hitungan lama: tanpa hari pendaftaran, tanpa tangga SK.
    expect(blok).not.toContain("Math.max(0, hariTotal - hariMediasi)");
  });

  it("penilaianSippService tidak menulis ambang 90/120/150 di luar tangganya", () => {
    const kode = tanpaKomentar(berkasPenilaian);
    // Ungkapan inline lama harus hilang - ia tangga kedua.
    expect(kode).not.toContain("bersih <= 90 ? 5");
    expect(kode.match(/<=\s*(90|120|150)\b/g) ?? []).toEqual([]);
    // Satu-satunya tempat angka itu: TANGGA_WAKTU_PUTUS.
    expect(kode.match(/sampaiHari: 90\b/g) ?? []).toHaveLength(1);
    expect(kode.match(/sampaiHari: 120\b/g) ?? []).toHaveLength(1);
    expect(kode.match(/sampaiHari: 150\b/g) ?? []).toHaveLength(1);
  });

  it("unsur waktuPutus memanggil hitungWaktuPutus, bukan menghitung sendiri", () => {
    const i = berkasPenilaian.indexOf('kunci: "waktuPutus"');
    const blok = berkasPenilaian.slice(i, berkasPenilaian.indexOf('kunci: "waktuMinutasi"', i));
    expect(blok).toContain("hitungWaktuPutus(f)");
    expect(blok).not.toContain("kelonggaranWaktuPutus(");
  });
});

// ===========================================================================
// (h) SATU PENCIRI GHAIB
// ===========================================================================

describe("penciri ghaib SK dipakai dari satu tempat", () => {
  it("sippTahapanService memakai JARAK_PHS_GHAIB_HARI, bukan angka 120 sendiri", () => {
    expect(berkasTahapan).not.toContain("jarak >= 120)");
    expect(berkasTahapan).toContain("jarak >= penilaianSippService.JARAK_PHS_GHAIB_HARI");
    // Satu penciri, dua layar. penandaPerkara TIDAK boleh menulis sumbernya
    // sendiri lagi - ia memanggil fungsi yang sama dengan Antrian Sidang.
    // Sampai 24 September 2026 keduanya berbeda, dan 65, 76, serta
    // 158/Pdt.G/2025 berselisih antar-layar karenanya.
    const blokPenanda = berkasTahapan.slice(
      berkasTahapan.indexOf("async function penandaPerkara("),
      berkasTahapan.indexOf("async function pihakPerkara(")
    );
    expect(blokPenanda).toContain("penandaGhaibBanyakPerkara(");
    expect(blokPenanda).not.toContain("FROM perkara_pihak2 p");
    // Ambangnya disebut SEKALI di seluruh berkas - dua sebutan berarti dua
    // cabang yang suatu hari berselisih diam-diam.
    expect(berkasTahapan.match(/JARAK_PHS_GHAIB_HARI/g) ?? []).toHaveLength(1);
    expect(berkasTahapan).toContain("  penandaGhaibBanyakPerkara,");
  });
});

// ===========================================================================
// RUAS YANG DIKIRIM BOT KE ANTRIAN SIDANG - DIJALANKAN, BUKAN DIBACA
// ===========================================================================

type Catatan = { sql: string; params: unknown[] };

/**
 * Memuat sippJadwalSidangService dengan basis data dan pembaca skema palsu,
 * disuntikkan lewat require.cache SEBELUM layanannya dimuat (pola yang sama
 * dengan penanda-verzet-berulang.test.ts).
 */
function muatJadwal(
  jawab: (sql: string) => unknown[],
  { tabel = ["perkara_mediasi", "perkara_penetapan", "perkara_ikrar_talak"] }: { tabel?: string[] } = {}
) {
  const Module = require_("module") as unknown as new (id: string) => {
    filename: string;
    loaded: boolean;
    exports: unknown;
  };
  const jalurDb = require_.resolve(path.join(akarBot, "db_config"));
  const jalurSkema = require_.resolve(path.join(akarBot, "services/sippSkemaService"));
  const jalurLayanan = require_.resolve(path.join(akarBot, "services/sippJadwalSidangService"));
  const kueri: Catatan[] = [];

  const pasang = (jalur: string, isi: unknown) => {
    const m = new Module(jalur);
    m.filename = jalur;
    m.loaded = true;
    m.exports = isi;
    (require_.cache as Record<string, unknown>)[jalur] = m;
  };

  pasang(jalurDb, {
    query: (sql: string, params: unknown[], balik: (g: unknown, h: unknown) => void) => {
      kueri.push({ sql: String(sql), params });
      try {
        balik(null, jawab(String(sql)));
      } catch (galat) {
        balik(galat, null);
      }
    },
  });
  pasang(jalurSkema, {
    tabelAda: async (t: string) => tabel.includes(t),
    kolomAda: async () => false,
    kolomTabel: async () => new Set<string>(),
    pilihKolom: async () => "",
    kolomTerpilih: async () => ({
      tanggalPhs: "penetapan_hari_sidang",
      sidangPertama: "sidang_pertama",
      ikrarTanggal: "tgl_ikrar_talak",
    }),
  });

  // sippTahapanService IKUT dibuang dari cache. durasiBanyakPerkara kini
  // membaca penciri ghaib lewat layanan itu, dan layanan itu menyimpan db
  // palsu milik pemanggilan PERTAMA di dalam closure-nya. Tanpa baris ini,
  // pemanggilan kedua memakai `jawab` milik pemanggilan pertama dan ujinya
  // merah tanpa sebab yang terlihat.
  delete (require_.cache as Record<string, unknown>)[
    require_.resolve(path.join(akarBot, "services/sippTahapanService"))
  ];
  delete (require_.cache as Record<string, unknown>)[jalurLayanan];
  const layanan = require_(jalurLayanan) as {
    durasiBanyakPerkara: (id: number[]) => Promise<Record<string, Record<string, unknown>>>;
    daftarSidang: (isian: Record<string, unknown>) => Promise<{
      sidang: Array<Record<string, unknown>>;
    }>;
  };
  return { layanan, kueri };
}

/**
 * sippTahapanService dengan basis data dan pembaca skema palsu - untuk menguji
 * penciri ghaib bersamanya langsung, bukan lewat Antrian Sidang.
 */
function muatTahapan(
  jawab: (sql: string) => unknown[],
  {
    tabel = ["perkara_pihak2", "perkara_penetapan", "pihak"],
    kolom = { pihakGhaib: "ghaib", tanggalPhs: "penetapan_hari_sidang", sidangPertama: "sidang_pertama" },
  }: { tabel?: string[]; kolom?: Record<string, string> } = {}
) {
  const Module = require_("module") as unknown as new (id: string) => {
    filename: string;
    loaded: boolean;
    exports: unknown;
  };
  const jalurDb = require_.resolve(path.join(akarBot, "db_config"));
  const jalurSkema = require_.resolve(path.join(akarBot, "services/sippSkemaService"));
  const jalurTahapan = require_.resolve(path.join(akarBot, "services/sippTahapanService"));
  const kueri: Catatan[] = [];

  const pasang = (jalur: string, isi: unknown) => {
    const m = new Module(jalur);
    m.filename = jalur;
    m.loaded = true;
    m.exports = isi;
    (require_.cache as Record<string, unknown>)[jalur] = m;
  };

  pasang(jalurDb, {
    query: (sql: string, params: unknown[], balik: (g: unknown, h: unknown) => void) => {
      kueri.push({ sql: String(sql), params });
      try {
        balik(null, jawab(String(sql)));
      } catch (galat) {
        balik(galat, null);
      }
    },
  });
  pasang(jalurSkema, {
    tabelAda: async (t: string) => tabel.includes(t),
    kolomAda: async () => false,
    kolomTabel: async () => new Set<string>(),
    pilihKolom: async (_t: string, calon: string[]) => calon[0] ?? "",
    kolomTerpilih: async () => kolom,
  });

  delete (require_.cache as Record<string, unknown>)[jalurTahapan];
  const layanan = require_(jalurTahapan) as {
    penandaGhaibBanyakPerkara: (
      id: number[],
      pilihan?: { tanggal?: Record<string, { tanggalPhs: string; sidangPertama: string }> }
    ) => Promise<Record<string, { ghaib: boolean; sumber: string[]; jarakPhsHari: number | null }>>;
  };
  return { layanan, kueri };
}

describe("penciri ghaib bersama: empat sumber, satu jawaban", () => {
  it("penanda perkara_pihak2.ghaib menandai perkara yang jarak PHS-nya 119 hari", async () => {
    // Inilah 158/Pdt.G/2025 - jarak PHS 119 hari, sehari di bawah ambang SK,
    // tetapi pihaknya bertanda ghaib di SIPP. Sampai 24 September 2026
    // Antrian Sidang menjawab "bukan ghaib" untuk perkara ini sedangkan
    // Status Perkara menjawab "ghaib". Terukur bersama 65 dan 76/Pdt.G/2025.
    const { layanan } = muatTahapan((sql) => {
      if (sql.includes("FROM perkara_pihak2 k")) return [{ perkaraId: 8540 }];
      if (sql.includes("FROM perkara_penetapan pp")) {
        return [{ perkaraId: 8540, tanggalPhs: "2026-01-05", sidangPertama: "2026-05-04" }];
      }
      return [];
    });
    const peta = await layanan.penandaGhaibBanyakPerkara([8540]);
    expect(peta["8540"]).toMatchObject({ ghaib: true, jarakPhsHari: null });
    expect(peta["8540"].sumber).toContain("penanda ghaib pada pihak tergugat/termohon");
  });

  it("perkara tanpa satu pun sumber TIDAK punya kunci sama sekali", async () => {
    const { layanan } = muatTahapan((sql) =>
      sql.includes("FROM perkara_penetapan pp")
        ? [{ perkaraId: 7, tanggalPhs: "2026-01-05", sidangPertama: "2026-05-04" }]
        : []
    );
    const peta = await layanan.penandaGhaibBanyakPerkara([7]);
    expect(peta).toEqual({});
  });

  it("peta tanggal dari pemanggil menggantikan kueri penetapan", async () => {
    // Layar Status Perkara sudah membaca kedua tanggalnya; menanyakannya lagi
    // berarti kueri kedua untuk jawaban yang sama.
    const { layanan, kueri } = muatTahapan(() => []);
    const peta = await layanan.penandaGhaibBanyakPerkara([3], {
      tanggal: { "3": { tanggalPhs: "2026-01-05", sidangPertama: "2026-05-10" } },
    });
    expect(peta["3"]).toMatchObject({ ghaib: true, jarakPhsHari: 125 });
    expect(peta["3"].sumber).toContain("jarak PHS ke sidang pertama 125 hari");
    expect(kueri.some((k) => k.sql.includes("FROM perkara_penetapan pp"))).toBe(false);
  });
});

describe("durasi yang dikirim bot membawa nilai SK dengan nama ruas yang dibaca portal", () => {
  it("kelonggaran ghaib dipotong dari hariBersih, TIDAK dari sisa SEMA", async () => {
    const { layanan, kueri } = muatJadwal((sql) => {
      if (sql.includes("FROM perkara p") && sql.includes("tanggal_pendaftaran")) {
        return [
          // Diputus pada selisih 90 hari: hari ke-91, kuning.
          { perkaraId: 1, tanggalDaftar: "2026-01-01", tanggalPutusan: "2026-04-01" },
          // Ghaib (PHS ke sidang pertama 125 hari), diputus hari ke-161.
          { perkaraId: 2, tanggalDaftar: "2026-01-01", tanggalPutusan: "2026-06-09" },
          // Jarak PHS 119 hari: BUKAN ghaib menurut SK.
          { perkaraId: 3, tanggalDaftar: "2026-01-01", tanggalPutusan: "2026-06-09" },
        ];
      }
      if (sql.includes("FROM perkara_mediasi m")) return [];
      if (sql.includes("FROM perkara_penetapan pp")) {
        return [
          { perkaraId: 2, tanggalPhs: "2026-01-05", sidangPertama: "2026-05-10" },
          { perkaraId: 3, tanggalPhs: "2026-01-05", sidangPertama: "2026-05-04" },
        ];
      }
      return [];
    });

    const hasil = await layanan.durasiBanyakPerkara([1, 2, 3]);

    expect(hasil["1"]).toMatchObject({
      hariTotal: 90,
      hariKotor: 91,
      hariBersih: 91,
      waktuPutusSk: { nilai: 3, sebutan: "4 bulan", dariHari: 91, sampaiHari: 120, sisaDiPita: null },
    });
    expect(pitaWaktuPutus((hasil["1"].waktuPutusSk as { nilai: number }).nilai)?.warna).toBe("kuning");

    // Perkara ghaib (PHS ke sidang pertama 125 hari), hari ke-160:
    // hariBersih 40 dan nilai 5 (hijau) - kelonggaran SK 120 hari, diminta
    // pengguna 24 September 2026 petang.
    //
    // TETAPI sisaHari TETAP -10: batas lima bulan SEMA 2/2014 tidak mengenal
    // kelonggaran itu, dan kewajiban lapornya tidak boleh hilang. Inilah
    // temuan tinjauan 24 September 2026 yang dijaga di sini - rancangan pagi
    // itu memotong keduanya dan menampilkan "40 hari, sisa 110".
    expect(hasil["2"]).toMatchObject({
      hariKotor: 160,
      hariSema: 160,
      hariBersih: 40,
      sisaHari: -10,
      waktuPutusSk: { nilai: 5 },
      kelonggaran: { hari: 120, hariMentah: 120, sebab: "perkara ghaib", jarakPhsHari: 125 },
    });
    // Jarak PHS 119 hari: BUKAN ghaib - tidak ada kelonggaran sama sekali.
    expect(hasil["3"]).toMatchObject({
      hariKotor: 160,
      hariBersih: 160,
      sisaHari: -10,
      kelonggaran: null,
      waktuPutusSk: { nilai: 0 },
    });
    // Perkara biasa tidak ikut kena ruas kelonggaran.
    expect(hasil["1"]).toMatchObject({ kelonggaran: null, hariSema: 91 });

    // Penciri dibaca SEKALI lewat layanan tahapan, bukan ditulis ulang di
    // sini - dan karena itu kueri penetapannya tepat satu, bukan satu per
    // perkara.
    expect(kueri.filter((k) => k.sql.includes("FROM perkara_penetapan pp"))).toHaveLength(1);
  });

  it("ghaib muda: hariSema terkirim, supaya lencana tidak sendirian bertuliskan 1 hari", async () => {
    // Penjepitan di hitungWaktuPutus (potongan <= kotor - mediasi - 1) membuat
    // perkara ghaib yang berumur di bawah 121 hari selalu berhariBersih 1.
    // Terukur 24 September 2026: 12 dari 13 perkara ghaib yang belum putus di
    // sipp_donggala berada di keadaan itu - 37 sampai 114 hari, semuanya
    // "1 hari". Tanpa ruas hariSema, layar tidak punya angka kedua untuk
    // ditulis dan barisnya tampak rusak.
    const { layanan } = muatJadwal((sql) => {
      if (sql.includes("FROM perkara p") && sql.includes("tanggal_pendaftaran")) {
        // Didaftarkan 2026-01-01, diputus 2026-03-15: hari ke-74.
        return [{ perkaraId: 5, tanggalDaftar: "2026-01-01", tanggalPutusan: "2026-03-15" }];
      }
      if (sql.includes("FROM perkara_penetapan pp")) {
        return [{ perkaraId: 5, tanggalPhs: "2026-01-05", sidangPertama: "2026-05-10" }];
      }
      return [];
    });
    const hasil = await layanan.durasiBanyakPerkara([5]);
    expect(hasil["5"]).toMatchObject({
      hariKotor: 74,
      hariSema: 74,
      hariBersih: 1,
      sisaHari: 76,
      // Dijepit: 120 hari tidak muat pada perkara 74 hari.
      kelonggaran: { hari: 73, hariMentah: 120, sebab: "perkara ghaib" },
    });
  });

  it("sisaHari SEMA KEBAL terhadap kelonggaran ghaib", async () => {
    // Penjaga NILAI, bukan teks. Seandainya uji ini ada pada 24 September
    // 2026 pagi, ia akan menahan rancangan yang memotong ghaib dari sisaHari
    // sebelum tinjauan menemukannya pada perkara 232/Pdt.G/2026.
    const selisih = [0, 45, 89, 90, 119, 120, 149, 150, 400];
    const tanggalDari = (tambah: number) => {
      const t = new Date(Date.UTC(2026, 0, 1) + tambah * 24 * 60 * 60 * 1000);
      return t.toISOString().slice(0, 10);
    };

    for (const jarakHari of selisih) {
      const putus = tanggalDari(jarakHari);
      const ragam: Record<string, number | null> = {};
      for (const ghaib of [true, false]) {
        const { layanan } = muatJadwal((sql) => {
          if (sql.includes("FROM perkara p") && sql.includes("tanggal_pendaftaran")) {
            return [{ perkaraId: 9, tanggalDaftar: "2026-01-01", tanggalPutusan: putus }];
          }
          if (sql.includes("FROM perkara_penetapan pp")) {
            // 125 hari = ghaib menurut SK; 119 hari = bukan.
            return [
              {
                perkaraId: 9,
                tanggalPhs: "2026-01-05",
                sidangPertama: ghaib ? "2026-05-10" : "2026-05-04",
              },
            ];
          }
          return [];
        });
        const hasil = await layanan.durasiBanyakPerkara([9]);
        ragam[String(ghaib)] = hasil["9"].sisaHari as number | null;
      }
      expect([jarakHari, ragam.true]).toEqual([jarakHari, ragam.false]);
    }
  });

  it("gagal-tertutup: penciri ghaib yang melempar error berarti TANPA kelonggaran", async () => {
    // Arahnya disengaja. Gagal ke arah kelonggaran berarti menghijaukan
    // perkara yang sudah lewat lima bulan - kewajiban lapor SEMA hilang
    // justru ketika basis datanya sedang bermasalah.
    const { layanan } = muatJadwal((sql) => {
      if (sql.includes("FROM perkara p") && sql.includes("tanggal_pendaftaran")) {
        return [{ perkaraId: 6, tanggalDaftar: "2026-01-01", tanggalPutusan: "2026-06-09" }];
      }
      if (sql.includes("FROM perkara_penetapan pp")) throw new Error("penetapan tidak terbaca");
      return [];
    });
    const hasil = await layanan.durasiBanyakPerkara([6]);
    expect(hasil["6"]).toMatchObject({
      hariKotor: 160,
      hariBersih: 160,
      hariSema: 160,
      sisaHari: -10,
      kelonggaran: null,
    });
  });

  it("perkara berjalan: sisa hari di pita ikut dikirim", async () => {
    const hariIni = new Date();
    const daftar = new Date(hariIni.getFullYear(), hariIni.getMonth(), hariIni.getDate() - 9);
    const iso = `${daftar.getFullYear()}-${String(daftar.getMonth() + 1).padStart(2, "0")}-${String(daftar.getDate()).padStart(2, "0")}`;
    const { layanan } = muatJadwal((sql) =>
      sql.includes("FROM perkara p") && sql.includes("tanggal_pendaftaran")
        ? [{ perkaraId: 7, tanggalDaftar: iso, tanggalPutusan: null }]
        : []
    );
    const hasil = await layanan.durasiBanyakPerkara([7]);
    // Didaftarkan 9 hari lalu: hari ke-10, sisa 80 hari di pita hijau.
    expect(hasil["7"]).toMatchObject({ hariKotor: 10, hariBersih: 10, waktuPutusSk: { nilai: 5, sisaDiPita: 80 } });
  });

  it("mediasi dipotong, sisa SEMA dari hari di luar mediasi", async () => {
    const { layanan } = muatJadwal((sql) => {
      if (sql.includes("FROM perkara p") && sql.includes("tanggal_pendaftaran")) {
        return [{ perkaraId: 4, tanggalDaftar: "2026-01-01", tanggalPutusan: "2026-06-09" }];
      }
      if (sql.includes("FROM perkara_mediasi m")) {
        return [{ perkaraId: 4, mulai: "2026-01-20", selesai: "2026-02-19", hasil: "T", mediator: "" }];
      }
      return [];
    });
    const hasil = await layanan.durasiBanyakPerkara([4]);
    // Hari ke-160, mediasi 30 hari: 130 hari, oranye, sisa 20.
    expect(hasil["4"]).toMatchObject({ hariKotor: 160, hariMediasi: 30, hariBersih: 130, sisaHari: 20, waktuPutusSk: { nilai: 1 } });
  });
});

describe("ikrarTercatat: sidang ikrar yang ikrarnya sudah tercatat di perkara_ikrar_talak", () => {
  const barisJadwal = [
    // Ikrar tercatat pada tanggal sidang ini, alasan_ditunda "0".
    { sidangId: 11, perkaraId: 1, tanggalSidang: "2026-09-09", ikrarTalak: "Y", ditunda: "T", alasanDitunda: "0" },
    // Ikrar tercatat, tetapi pada sidang LAIN perkara itu.
    { sidangId: 12, perkaraId: 2, tanggalSidang: "2026-09-09", ikrarTalak: "Y", ditunda: "T", alasanDitunda: "" },
    // Bukan sidang ikrar walau perkaranya punya tanggal ikrar yang sama.
    { sidangId: 13, perkaraId: 3, tanggalSidang: "2026-09-09", ikrarTalak: "T", ditunda: "T", alasanDitunda: "" },
  ];
  const jawabIkrar = (sql: string) => {
    if (sql.includes("j.ikrar_talak         AS ikrarTalak")) return barisJadwal;
    if (sql.includes("FROM perkara_ikrar_talak it")) {
      return [
        // Tanggal dari mysql tiba sebagai Date.
        { perkaraId: 1, tanggalIkrar: new Date(2026, 8, 9) },
        { perkaraId: 2, tanggalIkrar: "2026-09-02" },
        { perkaraId: 3, tanggalIkrar: "2026-09-09" },
      ];
    }
    return [];
  };

  it("hanya sidang ikrar yang tanggal ikrarnya sama dengan tanggal sidangnya", async () => {
    const { layanan, kueri } = muatJadwal(jawabIkrar);
    const hasil = await layanan.daftarSidang({ dari: "2026-09-09", sampai: "2026-09-09" });
    expect(hasil.sidang.map((s) => [s.sidangId, s.ikrarTercatat])).toEqual([
      ["11", true],
      ["12", false],
      // Bendera ikrar T, tetapi ikrarnya diucapkan pada tanggal sidang ini:
      // sidang inilah sidang ikrarnya. Dahulu false - dan sidang beragenda
      // "Sidang Ikrar Talak" berbendera T tertuduh merah (tinjauan 24 Sep).
      ["13", true],
    ]);
    // Seluruh perkara di daftar ditanyakan, dalam satu kueri IN.
    const ikrar = kueri.find((k) => k.sql.includes("FROM perkara_ikrar_talak it"));
    expect(ikrar?.params).toEqual([1, 2, 3]);
    expect(ikrar?.sql).toContain("it.tgl_ikrar_talak AS tanggalIkrar");
    expect(hasil.sidang.every((s) => s.ikrarTerbaca === true && s.putusanTerbaca === true)).toBe(true);
  });

  it("kueri jadwal sendiri tidak menyentuh perkara_ikrar_talak - tabel yang hilang tidak menjatuhkan jadwal", async () => {
    const { layanan, kueri } = muatJadwal(jawabIkrar, { tabel: ["perkara_mediasi", "perkara_penetapan"] });
    const hasil = await layanan.daftarSidang({ dari: "2026-09-09", sampai: "2026-09-09" });
    expect(hasil.sidang).toHaveLength(3);
    expect(hasil.sidang.every((s) => s.ikrarTercatat === false)).toBe(true);
    expect(kueri.some((k) => k.sql.includes("perkara_ikrar_talak"))).toBe(false);
    // Tabel yang tidak ada = TIDAK DIKETAHUI, bukan "tidak ada ikrar".
    expect(hasil.sidang.every((s) => s.ikrarTerbaca === false)).toBe(true);
  });

  it("kueri ikrar gagal: jadwal tetap tampil dan ikrarTercatat false", async () => {
    const { layanan } = muatJadwal((sql) => {
      if (sql.includes("FROM perkara_ikrar_talak it")) throw new Error("tabel rusak");
      return jawabIkrar(sql);
    });
    const hasil = await layanan.daftarSidang({ dari: "2026-09-09", sampai: "2026-09-09" });
    expect(hasil.sidang).toHaveLength(3);
    expect(hasil.sidang.every((s) => s.ikrarTercatat === false)).toBe(true);
    expect(hasil.sidang.every((s) => s.ikrarTerbaca === false)).toBe(true);
    // Peta putusan tetap terbaca - kegagalan satu peta tidak menular.
    expect(hasil.sidang.every((s) => s.putusanTerbaca === true)).toBe(true);
  });

  it("kueri putusan gagal: putusanTerbaca false - portal tidak menuduh 'belum diputus'", async () => {
    // Diukur 18 sidang pada 4 September 2026 yang sudah diputus dan hanya
    // tertahan dari tanda merah oleh peta putusan ini.
    const { layanan } = muatJadwal((sql) => {
      if (sql.includes("FROM perkara_putusan")) throw new Error("ER_CANT_AGGREGATE_2COLLATIONS");
      return jawabIkrar(sql);
    });
    const hasil = await layanan.daftarSidang({ dari: "2026-09-09", sampai: "2026-09-09" });
    expect(hasil.sidang).toHaveLength(3);
    expect(hasil.sidang.every((s) => s.putusanTerbaca === false)).toBe(true);
  });
});
