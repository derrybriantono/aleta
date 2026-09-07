// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const panggil = vi.fn();

vi.mock("@/server/modules/aleta-sipp/aleta-sipp-datasource", () => ({
  callAletaBotSippBridge: (operasi: string, params: Record<string, unknown>) => panggil(operasi, params),
}));

const { createAletaDatabase } = await import("@/server/db/client");
type AletaDatabase = Awaited<ReturnType<typeof createAletaDatabase>>;

const { jalankanKeajekan } = await import("@/server/modules/aleta-ecourt/keajekan-berkala");
const { turunkanDariKorpus } = await import("@/server/modules/aleta-ecourt/blangko-aleta");
const { pelajariKorpus } = await import("@/server/modules/aleta-ecourt/korpus-blangko");

/**
 * Uji kemandirian ditempelkan pada pemeriksaan keajekan berkala (Tahap 6).
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 * Uji yang harus diingat orang untuk dijalankan adalah uji yang berhenti
 * dijalankan. Ketergantungan pada ABT selalu menyelinap kembali diam-diam -
 * satu pemanggilan baru yang tampak kecil, dan ALETA berhenti mandiri tanpa
 * seorang pun menyadarinya sampai hari ABT mati.
 *
 * Yang kedua, sama pentingnya: kegagalan uji kemandirian TIDAK BOLEH
 * menggagalkan pemeriksaan keajekan. Keduanya menjawab pertanyaan yang
 * berbeda, dan perkara yang berubah diam-diam tetap harus dilaporkan walau
 * pustaka blangko sedang bermasalah.
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

beforeEach(() => {
  panggil.mockReset();
  panggil.mockImplementation(async (operasi: string) => {
    // Berkas perkara: cukup menjawab kosong - yang diuji di sini bukan
    // pembacaan perkaranya.
    if (operasi === "kamus.jalankanKueri") return { ok: true, data: { ada: true, nilai: "Penggugat" } };
    if (operasi === "kamus.bacaKolom") return { ok: true, data: { ada: true, nilai: "Cerai Gugat" } };
    return { ok: true, data: null };
  });
});

const JALUR = "berita_acara_sidang/x/04-a. BAS Pertama P Hadir.rtf";

async function siapkanPustaka(basis: AletaDatabase) {
  const sekarang = new Date().toISOString();
  await basis.run(
    `INSERT INTO aleta_kamus_variabel
       (no_var, nama, jenis, sql_query, data_tabel, data_kolom, default_data,
        kelas, sebab_kelas, bersarang, jumlah_pakai, asal_skema, salin_id, dibuat_at, diubah_at)
     VALUES ('0046', 'Pemohon/ Penggugat', 'data_sql', 'select x as data', '', '', '', 'A', 'uji', '', 10, 'aps_badilag', 'uji', ?, ?)`,
    [sekarang, sekarang]
  );
  await pelajariKorpus(basis, {
    berkas: [
      {
        jalur: JALUR,
        alinea: ["BERITA ACARA SIDANG", "Perkara ini diperiksa dengan hadirnya #0046#;"],
        penanda: ["0046"],
        besarByte: 500,
      },
    ],
    oleh: "admin",
  });
  return turunkanDariKorpus(basis, { jalur: JALUR, kode: "BAS-01", nama: "BAS", oleh: "admin" });
}

describe("kemandirian diperiksa pada tiap pemeriksaan berkala", () => {
  it("tanpa pustaka blangko, kemandirian dilaporkan null - bukan gagal", async () => {
    // Tidak ada yang dapat diuji, dan itu berbeda dari gagal.
    const basis = await basisData();
    const hasil = await jalankanKeajekan(basis, { perkaraId: ["10096"], oleh: "berkala" });
    expect(hasil.kemandirian).toBeNull();
  });

  it("dengan pustaka blangko, kemandirian ikut diperiksa dan dilaporkan", async () => {
    const basis = await basisData();
    await siapkanPustaka(basis);

    const hasil = await jalankanKeajekan(basis, { perkaraId: ["10096"], oleh: "berkala" });

    expect(hasil.kemandirian).not.toBeNull();
    expect(hasil.kemandirian?.jumlahDiperiksa).toBe(1);
    expect(hasil.kemandirian?.mandiri).toBe(true);
    expect(hasil.kemandirian?.jumlahBergantung).toBe(0);
  });

  it("hasilnya tercatat supaya dapat ditelusuri antar pemeriksaan", async () => {
    const basis = await basisData();
    await siapkanPustaka(basis);
    await jalankanKeajekan(basis, { perkaraId: ["10096"], oleh: "berkala" });

    const catatan = await basis.queryOne<Record<string, unknown>>(
      `SELECT mandiri, dijalankan_oleh FROM aleta_uji_mandiri ORDER BY dijalankan_at DESC`
    );
    expect(Number(catatan?.mandiri)).toBe(1);
    expect(String(catatan?.dijalankan_oleh)).toBe("berkala");
  });

  it("blangko yang rusak membuat kemandirian TIDAK terpenuhi, dan disebutkan", async () => {
    const basis = await basisData();
    await siapkanPustaka(basis);
    // Blangko tanpa satu bagian pun tidak dapat terbit.
    await basis.run(`DELETE FROM aleta_blangko_bagian`);

    const hasil = await jalankanKeajekan(basis, { perkaraId: ["10096"], oleh: "berkala" });
    expect(hasil.kemandirian?.mandiri).toBe(false);
    expect(hasil.kemandirian?.jumlahBergantung).toBe(1);
  });

  it("kegagalan kemandirian TIDAK menggagalkan pemeriksaan keajekan", async () => {
    // Perkara yang berubah diam-diam tetap harus dilaporkan walau pustaka
    // blangko sedang bermasalah - keduanya menjawab pertanyaan yang berbeda.
    const basis = await basisData();
    await siapkanPustaka(basis);
    await basis.run(`DELETE FROM aleta_blangko_bagian`);

    const hasil = await jalankanKeajekan(basis, { perkaraId: ["10096", "10097"], oleh: "berkala" });
    expect(hasil.jalanId).toBeTruthy();
    expect(hasil.jumlahPerkara).toBe(2);
    expect(hasil.kemandirian?.mandiri).toBe(false);
  });
});
