// @vitest-environment node

import { createRequire } from "node:module";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * TANGGAL DARI JEMBATAN SIPP TIDAK BOLEH KEHILANGAN TAHUNNYA
 * ============================================================================
 *
 * Ditemukan 25 September 2026 saat membangun layar Admin Integrasi e-Court.
 *
 * `listEcourtCases` memetakan tanggal pendaftaran dengan
 * `safeString(row.tanggalPendaftaran).slice(0, 10)`. Kolom SIPP-nya bertipe
 * DATE, dan penggerak mysql memulangkannya sebagai OBJEK Date - bukan teks.
 * String(Date) berbunyi "Tue Sep 08 2026 00:00:00 GMT+0800 (...)", jadi
 * memotongnya pada aksara ke-10 menghasilkan "Tue Sep 08".
 *
 * Rusak pada SELURUH 2.527 perkara e-Court, dan tak satu pun galat terbit:
 * hasilnya tetap string, tetap masuk JSON, tetap digambar layar. Ia lebih
 * berbahaya daripada kosong - petugas membaca "Sep 08" sebagai tahun ini,
 * sedangkan tahunnya dapat 2020.
 *
 * ============================================================================
 * MENGAPA UJI INI MENJALANKAN JEMBATANNYA, BUKAN MENYISIR TEKSNYA
 * ============================================================================
 *
 * Penyisir teks tidak dapat melihat cacat ini: `safeString(...).slice(0, 10)`
 * adalah ungkapan yang sah dan terbaca wajar - yang salah hanya ARTINYA ketika
 * masukannya Date. Satu-satunya cara membuktikannya adalah memberi jembatan itu
 * sebuah Date sungguhan lalu membaca apa yang keluar.
 *
 * Penggerak SIPP disandera lewat require.cache, jadi tidak ada satu sambungan
 * basis data pun yang dibuka.
 */

const akar = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(akar, "aleta_bot/package.json"));

const jalurJembatan = require_.resolve(path.join(akar, "aleta_bot/services/sippReadOnlyBridgeService.js"));
const jalurExternal = require_.resolve(path.join(akar, "aleta_bot/services/externalDbService.js"));
const jalurLog = require_.resolve(path.join(akar, "aleta_bot/services/logService.js"));

/** Satu baris seperti yang DIPULANGKAN penggerak mysql untuk kolom DATE. */
function barisSipp(tanggal: unknown) {
  return {
    perkaraId: 9648,
    nomorPerkara: "564/Pdt.G/2026/PA.Dgl",
    efilingId: "EF-1",
    nomorRegister: "REG-1",
    tanggalPendaftaran: tanggal,
    statusPendaftaran: "Perkara Terdaftar",
    statusPembayaran: "1",
    nomorPerkaraEfiling: "564/Pdt.G/2026/PA.Dgl",
    alurId: 1,
    alurKode: "Pdt.G",
    alurNama: "Gugatan",
  };
}

function pasangSandera(baris: unknown[]) {
  const buat = (jalur: string, isi: unknown) => {
    const mod = new (require_("module") as { new (id: string): { exports: unknown; loaded: boolean } })(
      jalur
    );
    mod.exports = isi;
    mod.loaded = true;
    require_.cache[jalur] = mod as never;
  };

  buat(jalurExternal, {
    query: async () => baris,
    sanitizeError: (galat: unknown) => String((galat as Error)?.message || galat),
  });
  buat(jalurLog, {
    logSystemEvent: async () => undefined,
    logAdminAction: async () => undefined,
  });

  delete require_.cache[jalurJembatan];
  return require_(jalurJembatan) as {
    handleBridgeOperation: (
      operasi: string,
      params?: Record<string, unknown>
    ) => Promise<{ perkara: Array<Record<string, unknown>>; jumlah: number }>;
  };
}

afterEach(() => {
  delete require_.cache[jalurJembatan];
  delete require_.cache[jalurExternal];
  delete require_.cache[jalurLog];
});

describe("jembatan SIPP - tanggal pendaftaran e-Court", () => {
  it("objek Date dari penggerak mysql menjadi ISO utuh, bukan 'Tue Sep 08'", async () => {
    // Bentuk yang SUNGGUH dipulangkan penggerak untuk kolom DATE.
    const jembatan = pasangSandera([barisSipp(new Date(2026, 8, 8))]);
    const hasil = await jembatan.handleBridgeOperation("ecourt.caseList", {
      limit: 10,
      sejakHari: 3650,
    });

    expect(Array.isArray(hasil.perkara)).toBe(true);
    expect(hasil.perkara).toHaveLength(1);
    const tanggal = String(hasil.perkara[0].tanggalPendaftaran);

    expect(tanggal).toBe("2026-09-08");
    // Penegasan tersendiri atas bentuk yang rusak, supaya kegagalannya terbaca
    // sebagai apa adanya bila kelak dikembalikan.
    expect(tanggal).not.toMatch(/^[A-Z][a-z]{2} [A-Z][a-z]{2} \d{2}$/);
    expect(tanggal).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("teks ISO tetap lewat apa adanya", async () => {
    // Sebagian setelan penggerak memulangkan teks, bukan Date. Keduanya harus
    // menghasilkan jawaban yang sama.
    const jembatan = pasangSandera([barisSipp("2026-09-08")]);
    const hasil = await jembatan.handleBridgeOperation("ecourt.caseList", { limit: 10 });
    expect(String(hasil.perkara[0].tanggalPendaftaran)).toBe("2026-09-08");
  });

  it("0000-00-00 tidak menjadi tanggal karangan", async () => {
    // SIPP menyimpan tanggal kosong sebagai 0000-00-00. new Date() atasnya
    // menjawab 30 November -1 - angka yang terbaca seolah data sungguhan.
    const jembatan = pasangSandera([barisSipp("0000-00-00")]);
    const hasil = await jembatan.handleBridgeOperation("ecourt.caseList", { limit: 10 });
    expect(String(hasil.perkara[0].tanggalPendaftaran)).toBe("");
  });

  it("kosong tetap kosong, bukan tanggal hari ini", async () => {
    const jembatan = pasangSandera([barisSipp(null)]);
    const hasil = await jembatan.handleBridgeOperation("ecourt.caseList", { limit: 10 });
    expect(String(hasil.perkara[0].tanggalPendaftaran)).toBe("");
  });
});
