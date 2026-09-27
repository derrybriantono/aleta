/**
 * ============================================================================
 * LAYANAN PETA DI BOT - SATU KUERI SELURUH JENIS, GOLONGAN PER DESA
 * ============================================================================
 *
 * Sejak bulatan peta dapat memilih golongannya sendiri (semua / cerai /
 * dispensasi / itsbat / lainnya), `hitung` membaca SELURUH jenis dalam satu
 * kueri dan menyaring daftar serta kartunya di Node. Dua hal yang dapat rusak
 * diam-diam dan karena itu DIJALANKAN di sini, bukan disisir teksnya:
 *
 *   1. Saringan Node harus menjawab persis seperti `jenis_perkara_text IN
 *      (...)` di MySQL - kolasinya tidak membedakan besar-kecil huruf dan
 *      mengabaikan spasi di ekor.
 *   2. Titik peta harus membawa hitungan per kelas yang jumlahnya tepat, dan
 *      daftar perkara desa yang diketuk harus disaring golongan yang sama.
 *
 * `db.query` dipalsukan pada modul db_config yang SAMA yang dipakai layanan,
 * jadi SQL dan parameternya yang sungguh dikirim dapat diperiksa - tanpa
 * menyentuh basis data mana pun.
 */
import { createRequire } from "node:module";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

const akar = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(akar, "aleta_bot/package.json"));

type Kueri = { sql: string; params: unknown[] };
type Db = { query: (sql: string, params: unknown[], cb: (e: unknown, h?: unknown) => void) => void };
const db = require_(path.join(akar, "aleta_bot/db_config.js")) as Db;
const layanan = require_(path.join(akar, "aleta_bot/services/petaPerkaraService.js")) as {
  cocokKelompok: (b: Record<string, unknown>, k: string) => boolean;
  saringGolongan: (g: unknown, alias?: string) => { sql: string; params: unknown[] } | null;
  titikDesa: (baris: Array<Record<string, unknown>>) => {
    titik: Array<Record<string, unknown> & { kode: string; perkara: number; kelas: Record<string, { perkara: number; lelaki: number; perempuan: number; jenis?: Record<string, number> }> }>;
    tanpaKode: number;
    tanpaKodeKelas: Record<string, number>;
  };
  kecamatanTanpaDesa: (baris: Array<Record<string, unknown>>) => Array<{ kode: string; perkara: number; kelas: Record<string, number> }>;
  hitung: (m: Record<string, unknown>) => Promise<Record<string, unknown>>;
  perkaraDesa: (k: string, kode: string, dari: string, sampai: string, golongan?: string) => Promise<Record<string, unknown>>;
  daftarJenis: () => Promise<Array<{ kunci: string; golongan: string }>>;
};

let tercatat: Kueri[] = [];
let jawaban: (k: Kueri) => unknown[] = () => [];
const asli = db.query;

beforeEach(() => {
  tercatat = [];
  db.query = (sql, params, cb) => {
    const k = { sql: String(sql), params: params ?? [] };
    tercatat.push(k);
    setImmediate(() => cb(null, jawaban(k)));
  };
});
afterEach(() => {
  db.query = asli;
});

/** Baris hasil kueri barisWilayah - satu per perkara. */
function baris(jenisPerkaraId: number | null, jenisPerkara: string, kodeKelurahan: string, kelamin = "P", lain: Record<string, unknown> = {}) {
  const kec = kodeKelurahan.split(".").slice(0, 3).join(".");
  return {
    jenisPerkaraId,
    jenisPerkara,
    kelamin,
    kodeProvinsi: "72",
    kodeKabupaten: kodeKelurahan ? kodeKelurahan.slice(0, 5) : "",
    kodeKecamatan: kodeKelurahan ? kec : "",
    kodeKelurahan,
    namaProvinsi: "Sulawesi Tengah",
    namaKabupaten: "Kabupaten Donggala",
    namaKecamatan: kodeKelurahan ? "Banawa" : null,
    namaKelurahan: kodeKelurahan ? "Ganti" : null,
    faktor: null,
    ...lain,
  };
}

const BARIS = [
  baris(347, "Cerai Gugat", "72.03.08.1020", "P", { faktor: "Perselisihan" }),
  baris(347, "Cerai Gugat", "72.03.08.1020", "P"),
  baris(346, "Cerai Talak", "72.03.08.1020", "L"),
  baris(362, "Dispensasi Kawin", "72.03.08.1020", "L"),
  baris(360, "Pengesahan Perkawinan/Istbat Nikah", "72.03.08.1020", "L"),
  baris(360, "Istbat Nikah", "72.03.08.2001", "P"),
  baris(354, "Perwalian", "72.03.08.2001", "P"),
  // Ejaan yang MySQL anggap sama dengan "Cerai Gugat" (kolasi _ci + PAD SPACE).
  baris(347, "cerai gugat  ", "72.03.08.2001", "P"),
  // Tanpa kode desa sama sekali.
  baris(347, "Cerai Gugat", "", "P"),
  // Kecamatan berkode, desa tidak (bentuk yang mungkin ada di data peladen).
  baris(362, "Dispensasi Kawin", "", "L", { kodeKecamatan: "72.03.09", namaKecamatan: "Labuan" }),
];

describe("saringan kelompok di Node = saringan MySQL", () => {
  it("perceraian: tidak membedakan besar-kecil huruf, mengabaikan spasi di ekor", () => {
    expect(layanan.cocokKelompok({ jenisPerkara: "Cerai Gugat" }, "perceraian")).toBe(true);
    expect(layanan.cocokKelompok({ jenisPerkara: "cerai gugat  " }, "perceraian")).toBe(true);
    expect(layanan.cocokKelompok({ jenisPerkara: "CERAI TALAK" }, "perceraian")).toBe(true);
    expect(layanan.cocokKelompok({ jenisPerkara: "Dispensasi Kawin" }, "perceraian")).toBe(false);
    // Spasi di DEPAN tidak diabaikan MySQL - di sini pun tidak.
    expect(layanan.cocokKelompok({ jenisPerkara: " Cerai Gugat" }, "perceraian")).toBe(false);
  });

  it("satu jenis: persis namanya; NULL tidak pernah cocok", () => {
    expect(layanan.cocokKelompok({ jenisPerkara: "Istbat Nikah" }, "Istbat Nikah")).toBe(true);
    expect(layanan.cocokKelompok({ jenisPerkara: "Pengesahan Perkawinan/Istbat Nikah" }, "Istbat Nikah")).toBe(false);
    expect(layanan.cocokKelompok({ jenisPerkara: null }, "")).toBe(false);
  });

  it("nama kelompok dari peramban tidak menembus lewat prototipe", () => {
    expect(layanan.cocokKelompok({ jenisPerkara: "constructor" }, "constructor")).toBe(true);
    expect(layanan.cocokKelompok({ jenisPerkara: "Cerai Gugat" }, "constructor")).toBe(false);
  });
});

describe("titik peta membawa hitungan per kelas", () => {
  it("per desa, per kelas, lengkap dengan kelamin dan rincian jenis 'lainnya'", () => {
    const { titik, tanpaKode, tanpaKodeKelas } = layanan.titikDesa(BARIS);
    const ganti = titik.find((t) => t.kode === "72.03.08.1020")!;
    expect(ganti.perkara).toBe(5);
    expect(ganti.kelas).toEqual({
      ceraiGugat: { perkara: 2, lelaki: 0, perempuan: 2 },
      ceraiTalak: { perkara: 1, lelaki: 1, perempuan: 0 },
      dispensasi: { perkara: 1, lelaki: 1, perempuan: 0 },
      itsbat: { perkara: 1, lelaki: 1, perempuan: 0 },
    });
    const kedua = titik.find((t) => t.kode === "72.03.08.2001")!;
    // Kedua ejaan itsbat, satu kelas.
    expect(kedua.kelas.itsbat.perkara).toBe(1);
    expect(kedua.kelas.lainnya).toEqual({ perkara: 1, lelaki: 0, perempuan: 1, jenis: { Perwalian: 1 } });
    expect(kedua.kelas.ceraiGugat.perkara).toBe(1);
    // Jumlah kelas = jumlah desa, di tiap desa.
    for (const t of titik) {
      const jml = Object.values(t.kelas).reduce((n, k) => n + k.perkara, 0);
      expect(jml, t.kode).toBe(t.perkara);
    }
    expect(tanpaKode).toBe(2);
    expect(tanpaKodeKelas).toEqual({ ceraiGugat: 1, dispensasi: 1 });
  });

  it("kecamatan berkode tanpa kode desa dikirim tersendiri - untuk label kecamatan", () => {
    const sisa = layanan.kecamatanTanpaDesa(BARIS);
    expect(sisa).toEqual([expect.objectContaining({ kode: "72.03.09", perkara: 1, kelas: { dispensasi: 1 } })]);
  });
});

describe("hitung: SATU kueri tanpa saringan jenis, daftar disaring di Node", () => {
  it("kuerinya tidak menyaring jenis, dan membawa jenis_perkara_id", async () => {
    jawaban = () => BARIS;
    const h = await layanan.hitung({ kelompok: "perceraian", tingkat: "kelurahan", periode: "total" });
    expect(tercatat).toHaveLength(1);
    expect(tercatat[0].sql).toContain("pk.jenis_perkara_id   AS jenisPerkaraId");
    expect(tercatat[0].sql).not.toMatch(/jenis_perkara_text\s+(IN|=)/);
    expect(tercatat[0].params).toEqual(["1900-01-01", "2999-12-31"]);

    // Kartu dan daftar: HANYA perceraian - termasuk "cerai gugat  " yang
    // MySQL anggap sama (4 perkara: 3 gugat + 1 talak... + 1 tanpa desa).
    const ringkas = h.ringkas as { diputus: number };
    expect(ringkas.diputus).toBe(5);
    expect(h.jenisMuncul).toEqual({ "Cerai Gugat": 3, "Cerai Talak": 1, "cerai gugat  ": 1 });
    expect((h.faktor as Array<{ nama: string }>).map((f) => f.nama)).toEqual(["Perselisihan"]);

    // Peta: SELURUH jenis, per kelas.
    expect(h.titikSeluruhJenis).toBe(true);
    const titik = h.titik as Array<{ perkara: number }>;
    expect(titik.reduce((n, t) => n + t.perkara, 0)).toBe(8);
    expect(h.titikTanpaKode).toBe(2);
    expect(h.kecamatanTanpaDesa).toHaveLength(1);
  });

  it("kelompok satu jenis tetap menyaring daftarnya", async () => {
    jawaban = () => BARIS;
    const h = await layanan.hitung({ kelompok: "Dispensasi Kawin", tingkat: "kelurahan", periode: "total" });
    expect((h.ringkas as { diputus: number }).diputus).toBe(2);
    expect(h.perceraian).toBe(false);
    // ...sedangkan titik petanya tetap seluruh jenis.
    expect((h.titik as Array<{ perkara: number }>).reduce((n, t) => n + t.perkara, 0)).toBe(8);
  });
});

describe("daftar perkara desa yang diketuk mengikuti golongan bulatannya", () => {
  it("saringan golongan lewat jenis_perkara_id", () => {
    expect(layanan.saringGolongan("cerai")).toEqual({ sql: "pk.jenis_perkara_id IN (?,?)", params: [347, 346] });
    expect(layanan.saringGolongan("dispensasi")).toEqual({ sql: "pk.jenis_perkara_id IN (?)", params: [362] });
    expect(layanan.saringGolongan("itsbat")).toEqual({ sql: "pk.jenis_perkara_id IN (?)", params: [360] });
    expect(layanan.saringGolongan("lainnya")?.sql).toContain("NOT IN (?,?,?,?)");
    expect(layanan.saringGolongan("lainnya")?.params).toEqual([347, 346, 362, 360]);
    expect(layanan.saringGolongan("lainnya")?.sql).toContain("IS NULL");
    expect(layanan.saringGolongan("semua")).toEqual({ sql: "1 = 1", params: [] });
    for (const x of ["", "constructor", "toString", "Cerai", null]) expect(layanan.saringGolongan(x)).toBeNull();
  });

  it("golongan dikenal MENGGANTIKAN kelompok; tidak dikenal jatuh kembali ke kelompok", async () => {
    jawaban = () => [];
    await layanan.perkaraDesa("perceraian", "72.03.08.1020", "2026-01-01", "2026-12-31", "dispensasi");
    expect(tercatat[0].sql).toContain("pk.jenis_perkara_id IN (?)");
    expect(tercatat[0].sql).not.toContain("jenis_perkara_text IN");
    expect(tercatat[0].params).toEqual(["2026-01-01", "2026-12-31", "72.03.08.1020", 362]);

    await layanan.perkaraDesa("perceraian", "72.03.08.1020", "2026-01-01", "2026-12-31", "bukan-golongan");
    expect(tercatat[1].sql).toContain("pk.jenis_perkara_text IN (?,?)");
    expect(tercatat[1].params).toEqual(["2026-01-01", "2026-12-31", "72.03.08.1020", "Cerai Gugat", "Cerai Talak"]);
  });
});

describe("telaah 2.40.0: jenis tunggal dapat dihitung tepat dari muatan peta", () => {
  it("tiap desa membawa kelamin PER JENIS - untuk bulatan jenis tunggal", () => {
    const { titik } = layanan.titikDesa(BARIS);
    const kedua = titik.find((t) => t.kode === "72.03.08.2001") as unknown as {
      jenisKelamin: Record<string, { lelaki: number; perempuan: number }>;
    };
    expect(kedua.jenisKelamin).toEqual({
      "Istbat Nikah": { lelaki: 0, perempuan: 1 },
      Perwalian: { lelaki: 0, perempuan: 1 },
      "cerai gugat  ": { lelaki: 0, perempuan: 1 },
    });
  });

  it("baris tanpa kode desa dan sisa kecamatan membawa rincian nama jenisnya", async () => {
    const { tanpaKodeJenis } = layanan.titikDesa(BARIS) as unknown as { tanpaKodeJenis: Record<string, number> };
    expect(tanpaKodeJenis).toEqual({ "Cerai Gugat": 1, "Dispensasi Kawin": 1 });
    const [sisa] = layanan.kecamatanTanpaDesa(BARIS) as unknown as Array<{ jenis: Record<string, number> }>;
    expect(sisa.jenis).toEqual({ "Dispensasi Kawin": 1 });

    jawaban = () => BARIS;
    const h = await layanan.hitung({ kelompok: "Perwalian", tingkat: "kelurahan", periode: "total" });
    expect(h.titikTanpaKodeJenis).toEqual({ "Cerai Gugat": 1, "Dispensasi Kawin": 1 });
  });

  it("tanpa golongan, daftar desa disaring KELOMPOK halaman - persis seperti tabelnya", async () => {
    jawaban = () => [];
    await layanan.perkaraDesa("Kewarisan", "72.03.08.1020", "2026-01-01", "2026-12-31", "");
    expect(tercatat[0].sql).toContain("pk.jenis_perkara_text = ?");
    expect(tercatat[0].params).toEqual(["2026-01-01", "2026-12-31", "72.03.08.1020", "Kewarisan"]);
  });
});

describe("menu jenis membawa golongannya", () => {
  it("dari NOMOR jenisnya, bukan nama", async () => {
    jawaban = () => [
      { jenis: "Cerai Gugat", jenisId: 347, n: 10 },
      { jenis: "Cerai Talak", jenisId: 346, n: 4 },
      { jenis: "Pengesahan Perkawinan/Istbat Nikah", jenisId: 360, n: 7 },
      { jenis: "Istbat Nikah", jenisId: 360, n: 1 },
      { jenis: "Dispensasi Kawin", jenisId: 362, n: 2 },
      { jenis: "Perwalian", jenisId: 354, n: 1 },
    ];
    const menu = await layanan.daftarJenis();
    expect(tercatat[0].sql).toContain("MIN(p.jenis_perkara_id) AS jenisId");
    expect(Object.fromEntries(menu.map((m) => [m.kunci, m.golongan]))).toEqual({
      perceraian: "cerai",
      "Pengesahan Perkawinan/Istbat Nikah": "itsbat",
      "Istbat Nikah": "itsbat",
      "Dispensasi Kawin": "dispensasi",
      Perwalian: "lainnya",
    });
  });
});
