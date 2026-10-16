// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import {
  KODE_IDE_L2,
  KUNCI_SAKLAR_IDE_L2,
  PERAN_IDE_L2,
  bersihkanNomorIdeL2,
  kodeIdeL2UntukGolongan,
  saringPenandaIdeL2,
} from "@/lib/sipp-ide-l2";

/**
 * ============================================================================
 * SIPP DENGAN IDE ALETA - GELOMBANG 1 (Tahap L2, 16 Okt 2026)
 * ============================================================================
 *
 * Yang dijaga, dengan logika yang DIJALANKAN (bukan toContain atas kode sendiri):
 *   A. aturan bot (aleta_bot/services/sippIdeL2Service.js) atas fakta buatan
 *      yang meniru keadaan nyata terukur (lihat kepala berkas layanan);
 *   B. pengumpul fakta bot dengan kueri tiruan: nomor -> perkara, bagian yang
 *      gagal dibaca TIDAK menghasilkan penanda "baik";
 *   C. saringan peran portal (lib/sipp-ide-l2.ts) dan kesamaan tabelnya dengan
 *      popup-ide-l2.js, sipp-ide-l2.js, dan katalog bot;
 *   D. ekstensi di halaman SIPP tiruan (JSDOM): penanda tergambar di sel nomor,
 *      klik membuka penjelasan + dasar, saklar mematikan, halaman detil.
 */

const akar = path.resolve(process.cwd(), "..");
const muat = createRequire(import.meta.url);
const baca = (b: string) => readFileSync(path.join(akar, b), "utf8").replace(/\r\n/g, "\n");

type Penanda = {
  kode: string;
  tingkat: string;
  label: string;
  jelas: string;
  dasar: string;
  sumber: string;
  perluDicek: boolean;
  angka?: number;
  hanyaDetil?: boolean;
};
type Kini = { tanggal: string; menit: number };
type Layanan = {
  KATALOG: Record<string, { dasar: unknown; sumber: string }>;
  KODE_SAKLAR: string[];
  tambahBulan: (t: string, n: number) => string;
  nilaiPerkara: (f: Record<string, unknown>, kini: Kini) => Penanda[];
  kodeTerbaca: (t: Record<string, boolean>) => Record<string, boolean>;
  penandaBanyakNomor: (
    nomor: string[],
    deps: Record<string, unknown>
  ) => Promise<{ perkara: Record<string, { perkaraId: number; penanda: Penanda[] }>; terbaca: Record<string, boolean>; tidakDikenal: string[] }>;
};
const layanan = muat(path.join(akar, "aleta_bot/services/sippIdeL2Service.js")) as Layanan;

const KINI: Kini = { tanggal: "2026-10-16", menit: 15 * 60 + 40 };

function fakta(ubah: Record<string, unknown> = {}) {
  return {
    perkaraId: 1,
    nomor: "600/Pdt.G/2026/PA.Dgl",
    alur: 15,
    jenisId: 347,
    tglDaftar: "2026-09-01",
    putus: null,
    jadwal: [],
    tunjuk: { pmh: "2026-09-02", ppp: "2026-09-02", pjs: "2026-09-02", phs: "2026-09-02" },
    ikrar: null,
    aktaCerai: false,
    pbt: {},
    sita: null,
    eksekusi: [],
    izin: null,
    durasi: null,
    ...ubah,
  };
}
const kode = (f: Record<string, unknown>, k: string, kini = KINI) => layanan.nilaiPerkara(f, kini).filter((p) => p.kode === k);
const sidang = (tanggal: string, lain: Record<string, unknown> = {}) => ({
  tanggal,
  urutan: 1,
  ditunda: "T",
  alasan: "",
  hadir: null,
  ikrar: "T",
  verzet: "T",
  keberatan: "T",
  ...lain,
});

// ============================================================================
describe("A. aturan penanda (bot, fungsi murni)", () => {
  it("katalog: sebelas kode, tiap kode bersumber & berdasar; sama dengan portal", () => {
    expect(layanan.KODE_SAKLAR).toEqual([...KODE_IDE_L2]);
    for (const k of layanan.KODE_SAKLAR) {
      expect(layanan.KATALOG[k].sumber.length, k).toBeGreaterThan(10);
      expect(layanan.KATALOG[k].dasar, k).toBeTruthy();
    }
  });

  it("belum ditunda: hanya sesudah 15.00, hanya bila belum ada tundaan/sidang berikutnya/putusan", () => {
    const f = fakta({ jadwal: [sidang("2026-10-16")] });
    expect(kode(f, "belum-ditunda").map((p) => p.tingkat)).toEqual(["merah"]);
    expect(kode(f, "belum-ditunda", { tanggal: "2026-10-16", menit: 14 * 60 + 59 })[0]).toMatchObject({ tingkat: "abu", hanyaDetil: true });
    expect(kode(fakta({ jadwal: [sidang("2026-10-16", { ditunda: "Y", alasan: "Panggil Tergugat" })] }), "belum-ditunda")).toEqual([]);
    expect(kode(fakta({ jadwal: [sidang("2026-10-16"), sidang("2026-10-23", { urutan: 2 })] }), "belum-ditunda")).toEqual([]);
    expect(kode(fakta({ jadwal: [sidang("2026-10-16")], putus: { tanggal: "2026-10-16", verstek: "Y", statusId: 62, bht: "" } }), "belum-ditunda")).toEqual([]);
    expect(kode(fakta({ jadwal: [sidang("2026-10-16", { alasan: "putus DIKABULKAN (verstek)" })] }), "belum-ditunda")).toEqual([]);
    expect(kode(fakta({ jadwal: [sidang("2026-10-15")] }), "belum-ditunda")).toEqual([]);
  });

  it("potensi verstek: gugatan belum putus, tergugat tidak pernah hadir (2/4), NULL tidak dihitung", () => {
    const absen = fakta({ jadwal: [sidang("2026-10-01", { hadir: 2 }), sidang("2026-10-08", { urutan: 2, hadir: 4 })] });
    expect(kode(absen, "potensi-verstek")[0]).toMatchObject({ tingkat: "kuning", angka: 2 });
    expect(kode(fakta({ jadwal: [sidang("2026-10-01", { hadir: 2 }), sidang("2026-10-08", { hadir: 1 })] }), "potensi-verstek")).toEqual([]);
    expect(kode(fakta({ jadwal: [sidang("2026-10-01", { hadir: 3 })] }), "potensi-verstek")).toEqual([]);
    expect(kode(fakta({ jadwal: [sidang("2026-10-01", { hadir: null })] }), "potensi-verstek")).toEqual([]);
    // sidang hari ini belum lewat; permohonan (alur 16) tidak mengenal verstek
    expect(kode(fakta({ jadwal: [sidang("2026-10-16", { hadir: 2 })] }), "potensi-verstek")).toEqual([]);
    expect(kode(fakta({ alur: 16, jadwal: [sidang("2026-10-01", { hadir: 2 })] }), "potensi-verstek")).toEqual([]);
    // sidang ikrar tidak ikut dihitung
    expect(kode(fakta({ jadwal: [sidang("2026-10-01", { hadir: 2, ikrar: "Y" })] }), "potensi-verstek")).toEqual([]);
    // cerai talak menyebut Termohon
    expect(kode(fakta({ jenisId: 346, jadwal: [sidang("2026-10-01", { hadir: 2 })] }), "potensi-verstek")[0].jelas).toMatch(/^Termohon/);
  });

  it("penetapan awal: kurang sesudah 3 hari = kuning; baru = abu (detil); tidak setanggal = kuning; lengkap = hijau (detil)", () => {
    const kurang = fakta({ tglDaftar: "2026-10-10", tunjuk: { pmh: "2026-10-11", ppp: "2026-10-11", pjs: "2026-10-11", phs: "" } });
    expect(kode(kurang, "penetapan-awal")[0]).toMatchObject({ tingkat: "kuning", label: "Belum ada PHS" });
    const baru = fakta({ tglDaftar: "2026-10-15", tunjuk: { pmh: "", ppp: "", pjs: "", phs: "" } });
    expect(kode(baru, "penetapan-awal")[0]).toMatchObject({ tingkat: "abu", hanyaDetil: true });
    const beda = fakta({ tunjuk: { pmh: "2026-09-02", ppp: "2026-09-02", pjs: "2026-09-03", phs: "2026-09-02" } });
    expect(kode(beda, "penetapan-awal")[0]).toMatchObject({ tingkat: "kuning", label: "Penetapan tidak setanggal" });
    expect(kode(fakta(), "penetapan-awal")[0]).toMatchObject({ tingkat: "hijau", hanyaDetil: true });
    expect(kode(fakta({ putus: { tanggal: "2026-10-01", verstek: "T", statusId: 62, bht: "" }, tunjuk: {} }), "penetapan-awal")).toEqual([]);
  });

  it("tanpa sidang berikutnya: sidang terakhir lewat, belum putus; > 7 hari merah", () => {
    expect(kode(fakta({ jadwal: [sidang("2026-10-12")] }), "tanpa-sidang-berikut")[0]).toMatchObject({ tingkat: "kuning", angka: 4 });
    expect(kode(fakta({ jadwal: [sidang("2026-10-01")] }), "tanpa-sidang-berikut")[0]).toMatchObject({ tingkat: "merah", angka: 15 });
    expect(kode(fakta({ jadwal: [sidang("2026-10-01"), sidang("2026-10-20")] }), "tanpa-sidang-berikut")).toEqual([]);
    expect(kode(fakta({ jadwal: [sidang("2026-10-16")] }), "tanpa-sidang-berikut")).toEqual([]);
    expect(kode(fakta({ jadwal: [] }), "tanpa-sidang-berikut")).toEqual([]);
    expect(kode(fakta({ jadwal: [sidang("2026-10-01")], putus: { tanggal: "2026-10-01", verstek: "T", statusId: 62, bht: "" } }), "tanpa-sidang-berikut")).toEqual([]);
  });

  it("sisa waktu ikrar: 6 bulan sejak PHS ikrar (Pasal 70 ayat 6 UU 7/1989)", () => {
    expect(layanan.tambahBulan("2026-08-31", 6)).toBe("2027-02-28");
    expect(layanan.tambahBulan("2026-04-16", 6)).toBe("2026-10-16");
    const talak = (it: Record<string, unknown> | null, bht = "2026-05-01") =>
      fakta({ jenisId: 346, putus: { tanggal: "2026-04-01", verstek: "T", statusId: 62, bht }, ikrar: it });
    expect(kode(talak({ phs: "2026-09-01", ikrar: "", status: "" }), "sisa-ikrar")[0]).toMatchObject({ tingkat: "abu", angka: 136 });
    expect(kode(talak({ phs: "2026-06-01", ikrar: "", status: "" }), "sisa-ikrar")[0]).toMatchObject({ tingkat: "kuning", angka: 46 });
    expect(kode(talak({ phs: "2026-05-01", ikrar: "", status: "" }), "sisa-ikrar")[0]).toMatchObject({ tingkat: "merah", angka: 16 });
    expect(kode(talak({ phs: "2026-03-01", ikrar: "", status: "" }), "sisa-ikrar")[0]).toMatchObject({ tingkat: "merah", label: "Lewat 6 bulan, ikrar belum" });
    // sudah ikrar / Pemohon tidak hadir (2) / rukun (3): selesai
    expect(kode(talak({ phs: "2026-03-01", ikrar: "2026-03-10", status: "1" }), "sisa-ikrar")).toEqual([]);
    expect(kode(talak({ phs: "2026-03-01", ikrar: "2026-03-10", status: "2" }), "sisa-ikrar")).toEqual([]);
    expect(kode(talak(null), "sisa-ikrar")[0]).toMatchObject({ tingkat: "kuning", label: "PHS ikrar belum ada" });
    expect(kode(talak(null, ""), "sisa-ikrar")[0]).toMatchObject({ hanyaDetil: true });
    // cerai gugat & talak ditolak: tidak ada ikrar
    expect(kode(fakta({ putus: { tanggal: "2026-04-01", verstek: "T", statusId: 62, bht: "2026-05-01" } }), "sisa-ikrar")).toEqual([]);
    expect(kode(fakta({ jenisId: 346, putus: { tanggal: "2026-04-01", verstek: "T", statusId: 63, bht: "2026-05-01" } }), "sisa-ikrar")).toEqual([]);
  });

  it("akta cerai: 7 hari sejak BHT (gugat) / ikrar (talak); ikrar gugur/rukun tanpa akta; pemberitahuan verstek", () => {
    const gugat = (bht: string, akta = false) => fakta({ putus: { tanggal: "2026-09-01", verstek: "T", statusId: 62, bht }, aktaCerai: akta });
    expect(kode(gugat("2026-10-13"), "akta-cerai")[0]).toMatchObject({ tingkat: "kuning", angka: 4 });
    expect(kode(gugat("2026-10-01"), "akta-cerai")[0]).toMatchObject({ tingkat: "merah", angka: -8 });
    expect(kode(gugat("2026-10-01", true), "akta-cerai")).toEqual([]);
    const talak = (status: string) =>
      fakta({ jenisId: 346, putus: { tanggal: "2026-05-01", verstek: "T", statusId: 62, bht: "2026-06-01" }, ikrar: { phs: "2026-06-05", ikrar: "2026-06-17", status } });
    expect(kode(talak("1"), "akta-cerai")[0]).toMatchObject({ tingkat: "merah" });
    expect(kode(talak("2"), "akta-cerai")).toEqual([]);
    expect(kode(talak("3"), "akta-cerai")).toEqual([]);
    const verstek = (lalu: string, pbt: Record<string, string> = {}) => fakta({ putus: { tanggal: lalu, verstek: "Y", statusId: 62, bht: "" }, pbt });
    expect(kode(verstek("2026-09-20"), "akta-cerai")[0]).toMatchObject({ label: "Putusan belum diberitahukan", angka: 26 });
    expect(kode(verstek("2026-10-10"), "akta-cerai")).toEqual([]);
    expect(kode(verstek("2026-09-20", { pihak2: "2026-09-25" }), "akta-cerai")).toEqual([]);
  });

  it("umur perkara & lewat 5 bulan memakai durasi bot (SK 048/2024 & SEMA 2/2014)", () => {
    const durasi = (nilai: number, hariBersih: number, hariSema: number) => ({
      hariKotor: hariSema + 3,
      hariMediasi: 3,
      hariBersih,
      hariSema,
      kelonggaran: null,
      waktuPutusSk: { nilai, sebutan: "x", sisaDiPita: 5 },
    });
    expect(kode(fakta({ durasi: durasi(5, 40, 40) }), "umur-perkara")[0]).toMatchObject({ tingkat: "hijau", label: "40 hari" });
    expect(kode(fakta({ durasi: durasi(3, 100, 100) }), "umur-perkara")[0].tingkat).toBe("kuning");
    expect(kode(fakta({ durasi: durasi(1, 130, 130) }), "umur-perkara")[0].tingkat).toBe("oranye");
    expect(kode(fakta({ durasi: durasi(0, 160, 160) }), "umur-perkara")[0].tingkat).toBe("merah");
    // ghaib (replika 16 Okt: 107 hari tampil "1 hari"): label = hari di luar mediasi + "(ghaib)", warna = nilai SK
    const ghaib = { ...durasi(5, 1, 107), kelonggaran: { hari: 106 } };
    expect(kode(fakta({ durasi: ghaib }), "umur-perkara")[0]).toMatchObject({ tingkat: "hijau", label: "107 hari (ghaib)" });
    expect(kode(fakta({ durasi: durasi(1, 150, 150) }), "lewat-5-bulan")).toEqual([]);
    // ghaib: SK memberi kelonggaran (hariBersih kecil), SEMA tidak (hariSema tetap)
    expect(kode(fakta({ durasi: durasi(5, 40, 160) }), "lewat-5-bulan")[0]).toMatchObject({ tingkat: "merah", angka: 160 });
    expect(kode(fakta({ durasi: durasi(0, 160, 160), putus: { tanggal: "2026-10-01", verstek: "T", statusId: 62, bht: "" } }), "lewat-5-bulan")).toEqual([]);
  });

  it("sita & eksekusi terpisah; jenis 'lain' yang berupa nama orang tidak ditampilkan", () => {
    const sita = (daftar: unknown[]) => fakta({ sita: { daftar } });
    const p = kode(sita([{ kode: "jaminan", nama: "Sita Jaminan", sumber: "petitum" }, { kode: "marital", nama: "Sita Marital", sumber: "petitum" }]), "sita")[0];
    expect(p).toMatchObject({ tingkat: "biru", label: "Sita Jaminan + Sita Marital" });
    expect(p.dasar).toMatch(/261 RBg/);
    expect(p.dasar).toMatch(/Pasal 78 huruf c UU 7\/1989/);
    // terukur 16 Okt: "Sita Wati Binti" = nama orang
    expect(kode(sita([{ kode: "lain", nama: "Sita Wati Binti", sumber: "petitum" }]), "sita")).toEqual([]);
    expect(kode(sita([{ kode: "lain", nama: "Sita Harta Waris", sumber: "petitum" }]), "sita")).toHaveLength(1);
    const eks = fakta({ eksekusi: [{ nomorRegister: "1/Pdt.Eks/2024/PA.Dgl", tahapTerakhir: { nama: "Aanmaning", tanggal: "2026-01-05" } }] });
    expect(kode(eks, "eksekusi")[0].jelas).toMatch(/1\/Pdt\.Eks\/2024\/PA\.Dgl.*Aanmaning \(5 Januari 2026\)/);
    expect(kode(eks, "sita")).toEqual([]);
  });

  it("izin cerai mengikuti izinCeraiService; sesudah putus tidak relevan", () => {
    expect(kode(fakta({ izin: { keadaan: "belum-ada" } }), "izin-cerai")[0].tingkat).toBe("merah");
    expect(kode(fakta({ izin: { keadaan: "belum-dicatat" } }), "izin-cerai")[0].tingkat).toBe("abu");
    expect(kode(fakta({ izin: { keadaan: "ada" } }), "izin-cerai")[0]).toMatchObject({ hanyaDetil: true });
    expect(kode(fakta({ izin: { keadaan: "belum-ada" }, putus: { tanggal: "2026-10-01", verstek: "T", statusId: 62, bht: "" } }), "izin-cerai")).toEqual([]);
  });

  it("penanda berdasar belum pasti menyebut 'perlu dicek'", () => {
    const semua = layanan.nilaiPerkara(fakta({ jadwal: [sidang("2026-10-16")], tglDaftar: "2026-10-10", tunjuk: {} }), KINI);
    expect(semua.find((p) => p.kode === "belum-ditunda")!.perluDicek).toBe(true);
    expect(semua.find((p) => p.kode === "penetapan-awal")!.perluDicek).toBe(true);
  });
});

// ============================================================================
describe("B. pengumpul fakta bot (kueri tiruan)", () => {
  function kueriTiruan(gagal: RegExp | null = null) {
    const dipanggil: string[] = [];
    const kueri = async (sql: string) => {
      dipanggil.push(sql);
      if (gagal && gagal.test(sql)) throw new Error("ER_TIRUAN");
      if (/FROM perkara WHERE nomor_perkara IN/.test(sql)) {
        return [{ perkaraId: 11, nomor: "601/Pdt.G/2026/PA.Dgl", alur: 15, jenisId: 347, tglDaftar: new Date(2026, 8, 1) }];
      }
      if (/FROM perkara_jadwal_sidang/.test(sql)) {
        return [{ perkaraId: 11, tanggal: new Date(2026, 9, 1), urutan: 1, ditunda: "Y", alasan: "Panggil Tergugat", hadir: 2, ikrar: "T", verzet: "T", keberatan: "T" }];
      }
      if (/MIN\(h\.tanggal_penetapan\)/.test(sql)) {
        return [{ perkaraId: 11, pmh: new Date(2026, 8, 2), ppp: new Date(2026, 8, 2), pjs: new Date(2026, 8, 2), phs: new Date(2026, 8, 2) }];
      }
      return [];
    };
    return { kueri, dipanggil };
  }
  const deps = (kueri: unknown) => ({
    kueri,
    kini: KINI,
    skema: { tabelAda: async () => true },
    sita: async () => ({ sita: {}, eksekusi: {} }),
    bahanPenanda: async () => ({ izinCerai: {}, terbaca: { izinCerai: true } }),
    durasi: async () => ({}),
  });

  it("nomor -> penanda; nomor tak dikenal dilaporkan; hanya SELECT", async () => {
    const t = kueriTiruan();
    const h = await layanan.penandaBanyakNomor(["601/Pdt.G/2026/PA.Dgl", "999/Pdt.G/2026/PA.Dgl"], deps(t.kueri));
    const p = h.perkara["601/Pdt.G/2026/PA.Dgl"];
    expect(p.perkaraId).toBe(11);
    // 1 Okt: tergugat tidak hadir, tidak ada sidang sesudahnya
    expect(p.penanda.map((x) => x.kode).sort()).toEqual(["penetapan-awal", "potensi-verstek", "tanpa-sidang-berikut"]);
    expect(h.tidakDikenal).toEqual(["999/Pdt.G/2026/PA.Dgl"]);
    expect(t.dipanggil.every((s) => /^\s*SELECT/i.test(s))).toBe(true);
  });

  it("bagian jadwal gagal dibaca: penanda dari jadwal tidak muncul, terbaca=false", async () => {
    const t = kueriTiruan(/perkara_jadwal_sidang/);
    const h = await layanan.penandaBanyakNomor(["601/Pdt.G/2026/PA.Dgl"], deps(t.kueri));
    expect(h.terbaca["potensi-verstek"]).toBe(false);
    expect(h.terbaca["tanpa-sidang-berikut"]).toBe(false);
    expect(h.terbaca["penetapan-awal"]).toBe(true);
    expect(h.perkara["601/Pdt.G/2026/PA.Dgl"].penanda.map((x) => x.kode)).toEqual(["penetapan-awal"]);
  });

  it("tabel tak terdaftar di sippSkemaService = tidak terbaca (bukan 'tidak ada')", async () => {
    const t = kueriTiruan();
    const h = await layanan.penandaBanyakNomor(["601/Pdt.G/2026/PA.Dgl"], {
      ...deps(t.kueri),
      skema: { tabelAda: async (x: string) => x !== "perkara_hakim_pn" },
    });
    expect(h.terbaca["penetapan-awal"]).toBe(false);
    expect(h.perkara["601/Pdt.G/2026/PA.Dgl"].penanda.some((x) => x.kode === "penetapan-awal")).toBe(false);
  });

  it("rute bot terdaftar dan hanya membaca", () => {
    const rute = baca("aleta_bot/routes/internalGatewayRoutes.js");
    expect(rute).toMatch(/router\.post\("\/sipp\/ide-l2\/penanda", requireInternalToken/);
    expect(rute).toMatch(/router\.get\("\/sipp\/ide-l2\/lima-bulan", requireInternalToken/);
    const kode = baca("aleta_bot/services/sippIdeL2Service.js");
    expect(kode).not.toMatch(/\b(INSERT|UPDATE|DELETE|REPLACE)\s+(INTO\s+)?[a-z_]+/i);
  });
});

// ============================================================================
describe("C. peran (portal) dan kesamaan tabel di semua tempat", () => {
  it("Super Admin/Admin semua; Ketua termasuk lewat 5 bulan; hakim tidak; juru sita hanya sita & eksekusi; pegawai umum tidak ada", () => {
    expect(kodeIdeL2UntukGolongan(["super-admin"])).toEqual([...KODE_IDE_L2]);
    expect(kodeIdeL2UntukGolongan(["admin"])).toEqual([...KODE_IDE_L2]);
    expect(kodeIdeL2UntukGolongan(["ketua"])).toContain("lewat-5-bulan");
    expect(kodeIdeL2UntukGolongan(["hakim"])).not.toContain("lewat-5-bulan");
    expect(kodeIdeL2UntukGolongan(["hakim"])).not.toContain("penetapan-awal");
    expect(kodeIdeL2UntukGolongan(["juru-sita"])).toEqual(["sita", "eksekusi"]);
    expect(kodeIdeL2UntukGolongan(["umum"])).toEqual([]);
    expect(kodeIdeL2UntukGolongan(["juru-sita", "panitera-pengganti"])).toContain("potensi-verstek");
  });

  it("saringan membuang kode yang tidak boleh dan kode tak dikenal", () => {
    const h = saringPenandaIdeL2(
      { "1/Pdt.G/2026/PA.Dgl": { perkaraId: 1, penanda: [{ kode: "sita" }, { kode: "lewat-5-bulan" }, { kode: "rahasia" }] } },
      kodeIdeL2UntukGolongan(["hakim"])
    );
    expect(h["1/Pdt.G/2026/PA.Dgl"].penanda.map((x) => x.kode)).toEqual(["sita"]);
  });

  it("nomor dari peramban dibersihkan (pola nomor perkara, unik, <= 100)", () => {
    expect(bersihkanNomorIdeL2(["12/Pdt.G/2026/PA.Dgl", "12/Pdt.G/2026/PA.Dgl", "x'; DROP", 5, "7/Pdt.P/2026/PA.Dgl"])).toEqual([
      "12/Pdt.G/2026/PA.Dgl",
      "7/Pdt.P/2026/PA.Dgl",
    ]);
    expect(bersihkanNomorIdeL2(Array.from({ length: 150 }, (_, i) => `${i + 1}/Pdt.G/2026/PA.Dgl`))).toHaveLength(100);
    expect(bersihkanNomorIdeL2(null)).toEqual([]);
  });

  function objekDari(sumber: string, nama: string) {
    const m = new RegExp(`const ${nama} = (\\{[\\s\\S]*?\\n  \\});`).exec(sumber);
    expect(m, `${nama} ada`).not.toBeNull();
    return new Function(`return (${m![1]});`)() as Record<string, unknown>;
  }

  it("tabel peran & kunci popup-ide-l2.js = lib/sipp-ide-l2.ts; kunci sipp-ide-l2.js sama", () => {
    const popup = baca("ekstensi-sipp/popup-ide-l2.js");
    expect(objekDari(popup, "PERAN_IDE_L2")).toEqual(PERAN_IDE_L2);
    const saklar = objekDari(popup, "SAKLAR_IDE_L2") as Record<string, [string, string | null]>;
    const dariPopup = Object.fromEntries(Object.values(saklar).filter(([, k]) => k).map(([kunci, k]) => [k, kunci]));
    expect(dariPopup).toEqual(KUNCI_SAKLAR_IDE_L2);
    for (const [id, [kunci]] of Object.entries(saklar)) expect(id).toBe(kunci);
    const konten = baca("ekstensi-sipp/sipp-ide-l2.js");
    expect(objekDari(konten, "KUNCI")).toEqual(KUNCI_SAKLAR_IDE_L2);
    const html = baca("ekstensi-sipp/popup.html");
    for (const id of Object.keys(saklar)) expect(html, id).toContain(`id="${id}"`);
  });

  it("terdaftar di manifest (skrip konten SIPP), susun-ekstensi, dan popup.html sesudah popup.js", () => {
    const manifest = JSON.parse(baca("ekstensi-sipp/manifest.json")) as { content_scripts: Array<{ matches: string[]; js?: string[] }> };
    const sipp = manifest.content_scripts.find((c) => c.matches.includes("http://192.168.10.10/SIPP/*") && (c.js || []).includes("konten.js"));
    expect(sipp!.js).toContain("sipp-ide-l2.js");
    expect(sipp!.js!.indexOf("sipp-ide-l2.js")).toBeGreaterThan(sipp!.js!.indexOf("konten.js"));
    const susun = baca("manajemen_surat/scripts/susun-ekstensi.mjs");
    expect(susun).toContain('"sipp-ide-l2.js"');
    expect(susun).toContain('"popup-ide-l2.js"');
    const html = baca("ekstensi-sipp/popup.html");
    expect(html.indexOf('<script src="popup-ide-l2.js">')).toBeGreaterThan(html.indexOf('<script src="popup.js">'));
  });
});

// ============================================================================
describe("D. ekstensi di halaman SIPP tiruan", () => {
  const KONTEN = baca("ekstensi-sipp/sipp-ide-l2.js");
  const terbuka: JSDOM[] = [];
  afterEach(() => {
    while (terbuka.length) terbuka.pop()!.window.close();
  });
  const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));

  const P = (kode: string, tingkat: string, label: string, lain: Record<string, unknown> = {}): Penanda => ({
    kode,
    tingkat,
    label,
    jelas: `Penjelasan ${label}.`,
    dasar: `Dasar ${label}.`,
    sumber: "SIPP",
    perluDicek: false,
    ...lain,
  });

  function buka(alamat: string, badan: string, simpanan: Record<string, unknown>, jawab: Record<string, unknown>, lima?: Record<string, unknown>) {
    const dom = new JSDOM(`<!doctype html><html><head><title>SIPP</title></head><body>${badan}</body></html>`, { url: alamat, runScripts: "outside-only" });
    terbuka.push(dom);
    const w = dom.window as any;
    const data = { ...simpanan };
    const pendengar: Array<(u: Record<string, { newValue?: unknown }>, t: string) => void> = [];
    w.chrome = {
      storage: {
        local: {
          get: async (k: string[]) => Object.fromEntries(k.filter((x) => x in data).map((x) => [x, data[x]])),
          set: async (isi: Record<string, unknown>) => {
            const ubah: Record<string, { newValue?: unknown }> = {};
            for (const [k, v] of Object.entries(isi)) {
              data[k] = v;
              ubah[k] = { newValue: v };
            }
            setTimeout(() => pendengar.forEach((f) => f(ubah, "local")), 0);
          },
        },
        onChanged: { addListener: (f: (u: Record<string, { newValue?: unknown }>, t: string) => void) => void pendengar.push(f) },
      },
    };
    const permintaan: Array<{ alamat: string; badan: unknown }> = [];
    w.fetch = async (a: string, init?: { body?: string }) => {
      permintaan.push({ alamat: String(a), badan: init && init.body ? JSON.parse(init.body) : null });
      const isi = String(a).includes("info=lima-bulan") ? lima || { tersedia: false } : jawab;
      return { ok: true, status: 200, json: async () => ({ ok: true, data: isi }) };
    };
    const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
    vm.runInContext(KONTEN, ctx, { filename: "sipp-ide-l2.js" });
    return { w, d: w.document as Document, permintaan, gudang: w.chrome.storage.local };
  }

  const DAFTAR =
    `<table id="tablePerkaraAll"><tbody>` +
    `<tr><td>1</td><td>601/Pdt.G/2026/PA.Dgl</td><td>Cerai Gugat</td></tr>` +
    `<tr><td>2</td><td>602/Pdt.G/2026/PA.Dgl</td><td>Cerai Talak</td></tr>` +
    `</tbody></table>` +
    // tabel di dalam panel ALETA bukan baris SIPP
    `<div id="aleta-panel-sipp"><table><tr><td>603/Pdt.G/2026/PA.Dgl</td></tr></table></div>`;
  const JAWAB = {
    tersedia: true,
    boleh: [...KODE_IDE_L2],
    perkara: {
      "601/Pdt.G/2026/PA.Dgl": {
        perkaraId: 1,
        penanda: [
          P("umur-perkara", "hijau", "40 hari"),
          P("potensi-verstek", "kuning", "Potensi verstek"),
          P("belum-ditunda", "merah", "Belum ditunda (lewat 15.00)", { perluDicek: true }),
          P("penetapan-awal", "hijau", "PMH/PPP/PJS/PHS lengkap", { hanyaDetil: true }),
        ],
      },
      "602/pdt.g/2026/pa.dgl": { perkaraId: 2, penanda: [] },
    },
  };

  async function siap(h: { d: Document }, pilih: string, ada = true) {
    for (let i = 0; i < 200; i += 1) {
      if (Boolean(h.d.querySelector(pilih)) === ada) return;
      await tunggu(10);
    }
    throw new Error(`tidak tercapai: ${pilih} ${ada ? "ada" : "hilang"}`);
  }

  it("daftar perkara: penanda di sel nomor, urut merah dulu, hanyaDetil tidak tampil; panel ALETA tidak dipindai", async () => {
    const h = buka("http://192.168.10.10/SIPP/index.php/perkara_list/abc", DAFTAR, {}, JAWAB, { tersedia: true, jumlah: 0, daftar: [], dasar: "SEMA 2/2014" });
    await siap(h, '[data-aleta-l2="baris"]');
    const sel = h.d.querySelectorAll<HTMLTableRowElement>("#tablePerkaraAll tr")[0].cells[1];
    const pil = Array.from(sel.querySelectorAll("button.aleta-l2-pil")).map((b) => b.textContent);
    expect(pil).toEqual(["Belum ditunda (lewat 15.00)", "Potensi verstek", "40 hari"]);
    expect(Array.from(sel.querySelectorAll("button")).every((b) => (b as HTMLButtonElement).type === "button")).toBe(true);
    expect(h.d.querySelectorAll<HTMLTableRowElement>("#tablePerkaraAll tr")[1].cells[1].querySelector("[data-aleta-l2]")).toBeNull();
    expect(h.permintaan[0].badan).toEqual({ nomorPerkara: ["601/Pdt.G/2026/PA.Dgl", "602/Pdt.G/2026/PA.Dgl"] });
    // kotak Ketua di atas tabel
    await siap(h, '[data-aleta-l2="lima"]');
    expect(h.d.querySelector('[data-aleta-l2="lima"]')!.textContent).toMatch(/tidak ada perkara/);
    expect(h.d.querySelector('[data-aleta-l2="lima"]')!.nextElementSibling!.id).toBe("tablePerkaraAll");
  });

  it("klik penanda membuka penjelasan + sumber + dasar (+ perlu dicek); Esc menutup", async () => {
    const h = buka("http://192.168.10.10/SIPP/index.php/perkara_list/abc", DAFTAR, {}, JAWAB);
    await siap(h, "button.aleta-l2-pil");
    const tombol = h.d.querySelector('button.aleta-l2-pil[data-kode="belum-ditunda"]') as HTMLButtonElement;
    tombol.click();
    const jelas = h.d.querySelector(".aleta-l2-jelas")!;
    expect(jelas.getAttribute("role")).toBe("dialog");
    expect(jelas.textContent).toContain("Penjelasan Belum ditunda");
    expect(jelas.textContent).toContain("Sumber data: SIPP");
    expect(jelas.textContent).toContain("Dasar: Dasar Belum ditunda");
    expect(jelas.textContent).toContain("perlu dicek pengguna");
    h.d.dispatchEvent(new h.w.KeyboardEvent("keydown", { key: "Escape" }));
    expect(h.d.querySelector(".aleta-l2-jelas")).toBeNull();
  });

  it("saklar per penanda & saklar induk: dibalik dari penyimpanan, halaman mengikuti tanpa memuat ulang", async () => {
    const h = buka("http://192.168.10.10/SIPP/index.php/perkara_list/abc", DAFTAR, { ideL2Verstek: false }, JAWAB);
    await siap(h, "button.aleta-l2-pil");
    expect(h.d.querySelector('[data-kode="potensi-verstek"]')).toBeNull();
    expect(h.d.querySelector('[data-kode="umur-perkara"]')).not.toBeNull();
    await h.gudang.set({ ideL2: false });
    await siap(h, "[data-aleta-l2]", false);
    await h.gudang.set({ ideL2: true, ideL2Verstek: true });
    await siap(h, '[data-kode="potensi-verstek"]');
    await h.gudang.set({ aktif: false });
    await siap(h, "[data-aleta-l2]", false);
  });

  it("saklar induk mati sejak awal: tidak ada permintaan ke portal sama sekali", async () => {
    const h = buka("http://192.168.10.10/SIPP/index.php/perkara_list/abc", DAFTAR, { ideL2: false }, JAWAB);
    await tunggu(700);
    expect(h.permintaan).toEqual([]);
    expect(h.d.querySelector("[data-aleta-l2]")).toBeNull();
  });

  it("halaman perkara: nomor dari baris 'Nomor Perkara', baris penanda sesudah #submenus termasuk yang hanya-detil", async () => {
    const badan =
      `<table id="submenus"><tr><td id="backlist"><a>Kembali</a></td></tr></table>` +
      `<div id="tabs1"><table><tr><td id="first-child">Nomor Perkara</td><td>601/Pdt.G/2026/PA.Dgl</td></tr>` +
      `<tr><td id="first-child">Posita</td><td>... putusan 556/Pdt.G/2024/PA.Dgl ...</td></tr></table></div>`;
    const h = buka("http://192.168.10.10/SIPP/index.php/perkara_detil_agama/xyz", badan, {}, JAWAB);
    await siap(h, '[data-aleta-l2="detil"]');
    const strip = h.d.querySelector('[data-aleta-l2="detil"]')!;
    expect(h.d.getElementById("submenus")!.nextElementSibling).toBe(strip);
    expect(Array.from(strip.querySelectorAll("button")).map((b) => b.textContent)).toContain("PMH/PPP/PJS/PHS lengkap");
    expect(h.permintaan[0].badan).toEqual({ nomorPerkara: ["601/Pdt.G/2026/PA.Dgl"] });
  });

  it("halaman SIPP lain (bukan daftar/perkara) tidak disentuh", async () => {
    const h = buka("http://192.168.10.10/SIPP/index.php/ref_biaya_perkara_list/1", DAFTAR, {}, JAWAB);
    await tunggu(700);
    expect(h.permintaan).toEqual([]);
  });
});
