// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const panggil = vi.fn();

vi.mock("@/server/modules/aleta-sipp/aleta-sipp-datasource", () => ({
  callAletaBotSippBridge: (operasi: string, params: Record<string, unknown>) => panggil(operasi, params),
}));

const { createAletaDatabase } = await import("@/server/db/client");
type AletaDatabase = Awaited<ReturnType<typeof createAletaDatabase>>;

const { bacaBanyak, bacaVariabel, kamusSiap, riwayatSalin, salinKamus, statistikKamus } = await import(
  "@/server/modules/aleta-ecourt/kamus-variabel"
);

/**
 * Kamus variabel ALETA (Tahap 0 - Kemandirian Blangko).
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 * Tiga hal, dan seluruh berkas ini ada untuk ketiganya:
 *
 *   - definisi disalin APA ADANYA. sql_query tidak dirapikan sedikit pun,
 *     karena menafsirkan definisi adalah persis sebab tujuh cacat pemetaan yang
 *     ditemukan pada 87 pemetaan tangan sebelumnya;
 *
 *   - penyalinan yang gagal TIDAK meninggalkan kamus setengah jadi. Kamus
 *     setengah tersalin menjawab sebagian pertanyaan dengan benar dan sebagian
 *     lagi dengan diam - jauh lebih berbahaya daripada kamus kosong yang
 *     berhenti dengan jelas;
 *
 *   - membaca kamus TIDAK menyentuh ABT. Inilah inti kemandirian: sesudah
 *     disalin, mencabut folder ABT tidak boleh menggagalkan apa pun.
 */

let db: AletaDatabase | null = null;

async function basisData() {
  db = await createAletaDatabase({ useInMemory: true, seed: false, runMigrations: false });
  return db;
}

afterEach(async () => {
  await db?.close?.();
  db = null;
});

beforeEach(() => panggil.mockReset());

const CONTOH = [
  {
    noVar: "0046",
    nama: "Pemohon/ Penggugat",
    jenis: "data_sql",
    sqlQuery:
      'select (case when alur_perkara_id=16 then "Pemohon" else "Penggugat" end) as data from perkara where perkara_id=#perkara_id#',
    dataTabel: "",
    dataKolom: "",
    defaultData: "",
  },
  {
    noVar: "0098",
    nama: "Nama #0046#",
    jenis: "data_sipp",
    sqlQuery: "",
    dataTabel: "perkara_pihak1",
    dataKolom: "nama",
    defaultData: "",
  },
  {
    noVar: "1001",
    nama: "Mas kawin",
    jenis: "data_teks",
    sqlQuery: "",
    dataTabel: "",
    dataKolom: "",
    defaultData: "",
  },
  {
    noVar: "9999",
    nama: "Tanpa jenis",
    jenis: "",
    sqlQuery: "",
    dataTabel: "",
    dataKolom: "",
    defaultData: "",
  },
];

function jawabAbt(variabel: unknown = CONTOH, tambahan: Record<string, unknown> = {}) {
  panggil.mockImplementation(async (operasi: string) => {
    if (operasi === "abt.semuaVariabel") {
      return { ok: true, data: { ada: true, skema: "aps_badilag", variabel, ...tambahan } };
    }
    return { ok: true, data: null };
  });
}

describe("menyalin definisi dari ABT", () => {
  it("menyalin seluruh baris beserta kelasnya", async () => {
    const basis = await basisData();
    jawabAbt();

    const hasil = await salinKamus(basis, { oleh: "admin" });

    expect(hasil.ok).toBe(true);
    expect(hasil.jumlahBaris).toBe(4);
    expect(hasil.rekap).toEqual({ A: 2, B: 1, C: 1 });
    expect(hasil.asalSkema).toBe("aps_badilag");
  });

  it("sql_query disimpan APA ADANYA, tidak dirapikan", async () => {
    // Menafsirkan definisi adalah sebab seluruh cacat yang ditemukan. Yang
    // menyatakan arti sebuah variabel adalah ABT, bukan pembacanya.
    const basis = await basisData();
    jawabAbt();
    await salinKamus(basis, { oleh: "admin" });

    const butir = await bacaVariabel(basis, "0046");
    expect(butir?.sqlQuery).toBe(CONTOH[0].sqlQuery);
    expect(butir?.nama).toBe("Pemohon/ Penggugat");
  });

  it("variabel bersarang ikut tersimpan supaya penyelesai tidak mengurai ulang", async () => {
    const basis = await basisData();
    jawabAbt();
    await salinKamus(basis, { oleh: "admin" });

    // #0098# bernama "Nama #0046#" - ia bergantung pada #0046#.
    expect((await bacaVariabel(basis, "0098"))?.bersarang).toEqual(["0046"]);
    expect((await bacaVariabel(basis, "1001"))?.bersarang).toEqual([]);
  });

  it("jumlah pemakaian di pustaka blangko ikut tercatat bila diberikan", async () => {
    const basis = await basisData();
    jawabAbt();
    await salinKamus(basis, { oleh: "admin", pemakaian: { "0046": 12935, "0098": 403 } });

    expect((await bacaVariabel(basis, "0046"))?.jumlahPakai).toBe(12935);
    // Yang tidak disebutkan bernilai nol - terdefinisi tetapi belum terpakai,
    // dan itu keterangan, bukan kesalahan.
    expect((await bacaVariabel(basis, "1001"))?.jumlahPakai).toBe(0);
  });

  it("penyalinan ulang memperbarui baris, tidak menggandakannya", async () => {
    const basis = await basisData();
    jawabAbt();
    await salinKamus(basis, { oleh: "admin" });

    const diubah = CONTOH.map((x) => (x.noVar === "1001" ? { ...x, nama: "Mas kawin (diperbarui)" } : x));
    jawabAbt(diubah);
    const kedua = await salinKamus(basis, { oleh: "admin" });

    expect(kedua.jumlahBaris).toBe(4);
    expect((await statistikKamus(basis)).jumlah).toBe(4);
    expect((await bacaVariabel(basis, "1001"))?.nama).toBe("Mas kawin (diperbarui)");
  });
});

describe("penyalinan yang gagal tidak meninggalkan kamus setengah jadi", () => {
  it("ABT tidak terbaca: kamus tetap kosong dan sebabnya tercatat", async () => {
    const basis = await basisData();
    panggil.mockImplementation(async () => ({
      ok: true,
      data: { ada: false, sebab: "Basis data APS Badilag tidak ditemukan.", variabel: [] },
    }));

    const hasil = await salinKamus(basis, { oleh: "admin" });

    expect(hasil.ok).toBe(false);
    expect(hasil.sebab).toMatch(/tidak ditemukan/i);
    expect((await statistikKamus(basis)).jumlah).toBe(0);

    const riwayat = await riwayatSalin(basis);
    expect(riwayat[0].keadaan).toBe("gagal");
    expect(riwayat[0].sebab).toMatch(/tidak ditemukan/i);
  });

  it("ABT mengembalikan nol baris: penyalinan dibatalkan, bukan dianggap berhasil", async () => {
    // Nol baris dari tabel berisi 1.253 definisi berarti ada yang salah pada
    // sambungannya. Menganggapnya berhasil akan mengosongkan kamus yang tadinya
    // benar.
    const basis = await basisData();
    jawabAbt([]);

    const hasil = await salinKamus(basis, { oleh: "admin" });
    expect(hasil.ok).toBe(false);
    expect(hasil.sebab).toMatch(/nol baris/i);
    expect((await riwayatSalin(basis))[0].keadaan).toBe("gagal");
  });

  it("baris tanpa no_var dibuang, tidak masuk kamus sebagai kode kosong", async () => {
    const basis = await basisData();
    jawabAbt([...CONTOH, { noVar: "", nama: "Tanpa nomor", jenis: "data_teks" }]);

    const hasil = await salinKamus(basis, { oleh: "admin" });
    expect(hasil.jumlahBaris).toBe(4);
  });
});

describe("membaca kamus tidak menyentuh ABT", () => {
  it("sesudah disalin, pembacaan tidak memanggil jembatan sama sekali", async () => {
    // Inilah inti kemandirian: mencabut folder ABT tidak boleh menggagalkan
    // apa pun yang sudah tersalin.
    const basis = await basisData();
    jawabAbt();
    await salinKamus(basis, { oleh: "admin" });

    panggil.mockReset();
    panggil.mockImplementation(async (operasi: string) => ({ ok: true, data: null, operasi }));

    expect((await bacaVariabel(basis, "0046"))?.nama).toBe("Pemohon/ Penggugat");
    expect((await bacaBanyak(basis, ["0046", "1001", "0000"])).size).toBe(2);
    expect((await statistikKamus(basis)).jumlah).toBe(4);
    expect(panggil).not.toHaveBeenCalled();
  });

  it("kode yang tidak ada di kamus dikembalikan null, bukan ditebak", async () => {
    const basis = await basisData();
    jawabAbt();
    await salinKamus(basis, { oleh: "admin" });

    expect(await bacaVariabel(basis, "7211")).toBeNull();
  });
});

describe("keadaan kamus", () => {
  it("kamus yang belum pernah disalin menyatakan dirinya belum siap", async () => {
    // Penyelesai Tahap 1 memakainya untuk berhenti dengan sebab yang jelas,
    // bukan mengisi naskah dengan kekosongan.
    const basis = await basisData();
    const keadaan = await kamusSiap(basis);

    expect(keadaan.siap).toBe(false);
    expect(keadaan.jumlah).toBe(0);
    expect(keadaan.sebab).toMatch(/belum pernah disalin/i);
  });

  it("sesudah disalin, kamus menyatakan dirinya siap", async () => {
    const basis = await basisData();
    jawabAbt();
    await salinKamus(basis, { oleh: "admin" });

    const keadaan = await kamusSiap(basis);
    expect(keadaan.siap).toBe(true);
    expect(keadaan.jumlah).toBe(4);
  });

  it("statistik memuat pembagian kelas dan penyalinan terakhir", async () => {
    const basis = await basisData();
    jawabAbt();
    await salinKamus(basis, { oleh: "Ketua" });

    const statistik = await statistikKamus(basis);
    expect(statistik.perKelas).toEqual({ A: 2, B: 1, C: 1 });
    expect(statistik.penyalinanTerakhir?.keadaan).toBe("selesai");
    expect(statistik.penyalinanTerakhir?.oleh).toBe("Ketua");
    expect(statistik.penyalinanTerakhir?.asalSkema).toBe("aps_badilag");
  });
});
