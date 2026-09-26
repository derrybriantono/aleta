// @vitest-environment node

/**
 * ============================================================================
 * "TIDAK TERBACA" TIDAK BOLEH TAMPIL SEBAGAI "TIDAK ADA"
 * ============================================================================
 *
 * Penjaga ini MENJALANKAN layanannya, bukan menyapu teks sumbernya. Sebelum
 * ini seluruh penjagaan jalur berkas e-Court berbentuk expect(teks).toContain
 * atas kodenya sendiri - tetap hijau sementara kuerinya melempar galat.
 *
 * Yang dijaga di sini:
 *
 *   1. Kolom cermin berkas_pdf/berkas_word TIDAK lagi menjadi sumber jawaban.
 *      Terukur pada basis data yang berjalan: dari 394 dokumen, cerminnya
 *      terisi 23 pdf dan 8 word, sementara aleta_bot_ecourt_files mencatat 400
 *      berkas. Selama cermin dipakai, hakim menerima "berkasnya belum dapat
 *      dilampirkan" dan pihak menerima pemberitahuan tanpa lampiran untuk
 *      ratusan dokumen yang berkasnya ada di cakram.
 *
 *   2. Kueri berkas yang GAGAL tidak boleh menjadi "tidak ada berkas".
 *      Sejak cadangan cermin dibuang, adaPdf/adaWord semata-mata bergantung
 *      pada tabel berkas - satu kueri gagal menyembunyikan seluruh tombol
 *      unduh dan menulis "berkas belum tersimpan" di layar SIPP, keadaan yang
 *      tidak dapat dibedakan panitera dari arsip yang memang kosong.
 *
 * Basis datanya ditiru lewat require.cache - pola yang sama dengan
 * aleta_bot/scripts/verify-sipp-konteks.js - supaya galat kuerinya dapat
 * DIBUAT, bukan dibayangkan.
 */

import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const require_ = createRequire(import.meta.url);
const AKAR_BOT = path.resolve(process.cwd(), "../aleta_bot");
const NOMOR = "620/Pdt.G/2025/PA.Dgl";

type BarisDokumen = Record<string, unknown> & {
  document_key: string;
  nomor_perkara: string;
  berkas_pdf: string | null;
  berkas_word: string | null;
};

type BarisBerkas = {
  document_key: string;
  nomor_perkara: string;
  format: string;
  jalur_berkas: string;
  dihapus_retensi: string | null;
};

type Catatan = { eventType?: string; metadata?: Record<string, unknown> };

let akar = "";
let jalurAda = "";
let jalurHilang = "";

const dokumenRows: BarisDokumen[] = [];
const berkasRows: BarisBerkas[] = [];
const sippRows: Array<Record<string, unknown>> = [];
const catatan: Catatan[] = [];
let berkasMelempar = false;

let konteks: {
  dokumenPerkara: (nomor: string) => Promise<Array<Record<string, unknown>>>;
  getBerkas: (kunci: string, format?: string) => Promise<{ ok: boolean; alasan: string; namaBerkas?: string }>;
};
let pekerja: {
  lampiranDokumen: (kunci: string) => Promise<{ ok: boolean; reason?: string; fileName?: string }>;
};
let verifikasi: {
  listForPortal: (
    nama: string,
    opsi: { limit?: number; runtimeConfig?: Record<string, unknown> }
  ) => Promise<{ ok: boolean; dokumen: Array<Record<string, unknown>> }>;
};

/** Baris berkas dipulangkan dengan SEMUA nama alias yang dipakai pemanggilnya. */
function bentukBerkas(baris: BarisBerkas) {
  return {
    ...baris,
    documentKey: baris.document_key,
    nomorPerkara: baris.nomor_perkara,
    jalur: baris.jalur_berkas,
    dihapusRetensi: baris.dihapus_retensi,
    sidik_jari: "uji",
    ukuran_byte: 11,
    diunduh_pada: "2025-12-09 11:30:00",
  };
}

beforeAll(() => {
  akar = mkdtempSync(path.join(tmpdir(), "aleta-ecourt-berkas-"));
  // Akar dipasang SEBELUM modulnya dimuat: ecourtDocumentService membaca env
  // ini sekali saat dimuat, dan jalur di luar akar selalu ditolak.
  process.env.ALETA_BOT_ECOURT_DOCUMENT_ROOT = akar;

  const folder = path.join(akar, "620_Pdt_G_2025");
  mkdirSync(folder, { recursive: true });
  jalurAda = path.join(folder, "jawaban.pdf");
  writeFileSync(jalurAda, "%PDF-1.4 uji");
  jalurHilang = path.join(folder, "lenyap.pdf");

  // --- Tiruan basis data bot ---
  const botPath = require_.resolve(path.join(AKAR_BOT, "services/botDbService.js"));
  const botAsli = require_(path.join(AKAR_BOT, "services/botDbService.js"));
  require_.cache[botPath]!.exports = {
    ensureSchema: async () => true,
    addColumnIfMissing: async () => true,
    addIndexIfMissing: async () => true,
    toMysqlDate: botAsli.toMysqlDate,
    fromMysqlDate: botAsli.fromMysqlDate,
    getDbStatus: () => ({ ready: true }),
    query: async (sql: string, params: unknown[] = []) => {
      if (/^\s*(CREATE|ALTER|SHOW|INSERT|UPDATE|DELETE)/i.test(sql)) return [];

      if (/FROM aleta_bot_ecourt_files/i.test(sql)) {
        // Inilah galat yang dibuat: satu kueri berkas yang gagal. Bentuk
        // nyatanya pernah terjadi - kolom dihapus_retensi belum ada pada
        // pemasangan yang skemanya tidak ikut termigrasi.
        if (berkasMelempar) throw new Error("Unknown column 'dihapus_retensi' in 'where clause'");
        let hasil = berkasRows.slice();
        if (/nomor_perkara = \?/.test(sql)) hasil = hasil.filter((b) => b.nomor_perkara === params[0]);
        if (/document_key = \?/.test(sql)) hasil = hasil.filter((b) => b.document_key === params[0]);
        if (/format = \?/.test(sql)) hasil = hasil.filter((b) => b.format === params[1]);
        if (/dihapus_retensi IS NULL/.test(sql)) hasil = hasil.filter((b) => !b.dihapus_retensi);
        return hasil.map(bentukBerkas);
      }

      if (/FROM aleta_bot_ecourt_documents/i.test(sql)) {
        const kolomCermin = /berkas_word AS jalur/i.test(sql) ? "berkas_word" : "berkas_pdf";
        const lengkapi = (d: BarisDokumen) => ({ ...d, jalur: d[kolomCermin] });
        if (/WHERE nomor_perkara = \?/.test(sql)) {
          return dokumenRows.filter((d) => d.nomor_perkara === params[0]).map(lengkapi);
        }
        if (/WHERE document_key = \?/.test(sql)) {
          return dokumenRows.filter((d) => d.document_key === params[0]).map(lengkapi);
        }
        return dokumenRows.map(lengkapi);
      }

      return [];
    },
  };

  // --- Tiruan pencatat kejadian: isinya diperiksa, bukan dibuang ---
  const logPath = require_.resolve(path.join(AKAR_BOT, "services/logService.js"));
  const logAsli = require_(path.join(AKAR_BOT, "services/logService.js"));
  require_.cache[logPath]!.exports = {
    ...logAsli,
    logSystemEvent: async (data: Catatan) => {
      catatan.push(data);
      return true;
    },
    logSecurityEvent: async (data: Catatan) => {
      catatan.push(data);
      return true;
    },
  };

  // --- Tiruan SIPP ---
  const sippPath = require_.resolve(path.join(AKAR_BOT, "db_config.js"));
  require_(path.join(AKAR_BOT, "db_config.js"));
  require_.cache[sippPath]!.exports = {
    query(sql: string, params: unknown, callback: unknown) {
      const selesai = typeof params === "function" ? params : callback;
      if (typeof selesai !== "function") return;
      (selesai as (galat: unknown, rows: unknown) => void)(null, sippRows.slice());
    },
  };

  konteks = require_(path.join(AKAR_BOT, "services/sippKonteksService.js"));
  pekerja = require_(path.join(AKAR_BOT, "services/ecourtNotificationWorker.js"));
  verifikasi = require_(path.join(AKAR_BOT, "services/ecourtVerificationService.js"));
});

afterAll(() => {
  try {
    rmSync(akar, { recursive: true, force: true });
  } catch {
    // Folder sementara; kegagalan membersihkannya tidak menggagalkan uji.
  }
});

beforeEach(() => {
  dokumenRows.length = 0;
  berkasRows.length = 0;
  sippRows.length = 0;
  catatan.length = 0;
  berkasMelempar = false;
});

function seedDokumen(ubah: Partial<BarisDokumen> = {}) {
  dokumenRows.push({
    document_key: "k1",
    nomor_perkara: NOMOR,
    judul_dokumen: "Jawaban Tergugat",
    jenis_dokumen: "Jawaban",
    peran_pengunggah: "Tergugat",
    status_verifikasi: "belum",
    agenda: "Jawaban Tergugat",
    diunggah_pada: "2025-12-09 11:30:00",
    batas_unggah: null,
    batas_unggah_teks: "",
    tanggal_sidang: null,
    nomor_register: "",
    registrasi_ecourt: "",
    berkas_pdf: null,
    berkas_word: null,
    diberitahukan_pada: null,
    alasan_tidak_diberitahukan: "",
    sumber_url: "",
    ...ubah,
  });
}

function seedBerkas(ubah: Partial<BarisBerkas> = {}) {
  berkasRows.push({
    document_key: "k1",
    nomor_perkara: NOMOR,
    format: "pdf",
    jalur_berkas: jalurAda,
    dihapus_retensi: null,
    ...ubah,
  });
}

function catatanBerkas() {
  return catatan.filter((c) => c.eventType === "ecourt_berkas_tidak_terbaca");
}

describe("Panel SIPP: catatan berkas yang gagal dibaca", () => {
  it("menyalakan tombol unduh dari tabel berkas, tanpa menyentuh cermin", async () => {
    seedDokumen();
    seedBerkas();

    const hasil = await konteks.dokumenPerkara(NOMOR);
    expect(hasil).toHaveLength(1);
    expect(hasil[0].adaPdf).toBe(true);
    expect(hasil[0].adaWord).toBe(false);
    expect(hasil[0].berkasTidakTerbaca).toBe(false);
    expect(catatanBerkas()).toHaveLength(0);
  });

  it("tidak lagi memakai cermin sebagai cadangan", async () => {
    // Cerminnya menunjuk berkas yang SUNGGUH ada di cakram, tetapi tidak ada
    // barisnya di aleta_bot_ecourt_files. Jawabannya tetap "tidak ada" - dan
    // yang penting, itu jawaban yang SAMA dengan layar arsip portal.
    seedDokumen({ berkas_pdf: jalurAda, berkas_word: jalurAda });

    const hasil = await konteks.dokumenPerkara(NOMOR);
    expect(hasil[0].adaPdf).toBe(false);
    expect(hasil[0].adaWord).toBe(false);
    expect(hasil[0].berkasTidakTerbaca).toBe(false);
  });

  it("kueri berkas yang melempar tidak menjadi 'tidak ada berkas'", async () => {
    seedDokumen();
    seedBerkas();
    berkasMelempar = true;

    const hasil = await konteks.dokumenPerkara(NOMOR);
    expect(hasil).toHaveLength(1);

    // Nilainya harus TIDAK DIKETAHUI, bukan false. false berarti ekstensi
    // berhak menuliskan "berkas belum tersimpan" ke layar SIPP.
    expect(hasil[0].adaPdf).toBeNull();
    expect(hasil[0].adaWord).toBeNull();
    expect(hasil[0].berkasTidakTerbaca).toBe(true);
  });

  it("mencatat sebab kegagalannya, lengkap dengan perkaranya", async () => {
    seedDokumen();
    berkasMelempar = true;

    await konteks.dokumenPerkara(NOMOR);

    const dicatat = catatanBerkas();
    expect(dicatat.length).toBeGreaterThan(0);
    expect(dicatat[0].metadata?.jalur).toBe("sippKonteksService.dokumenPerkara");
    expect(dicatat[0].metadata?.nomorPerkara).toBe(NOMOR);
    expect(String(dicatat[0].metadata?.errorMessage)).toContain("dihapus_retensi");
  });
});

describe("Unduhan ekstensi: alasan yang dikirim harus jujur", () => {
  it("menyerahkan berkasnya ketika catatannya terbaca", async () => {
    seedDokumen();
    seedBerkas();

    const hasil = await konteks.getBerkas("k1", "pdf");
    expect(hasil.ok).toBe(true);
    expect(hasil.namaBerkas).toBe("jawaban.pdf");
  });

  it("tidak menjawab 'berkas_belum_tersimpan' ketika kuerinya gagal", async () => {
    seedDokumen();
    seedBerkas();
    berkasMelempar = true;

    const hasil = await konteks.getBerkas("k1", "pdf");
    expect(hasil.ok).toBe(false);
    // Inilah kalimat bohong yang dilarang: routes/internalGatewayRoutes.js
    // mengirim alasan ini apa adanya ke ekstensi bersama status 404.
    expect(hasil.alasan).not.toBe("berkas_belum_tersimpan");
    expect(hasil.alasan).toBe("catatan_berkas_tidak_terbaca");
    expect(catatanBerkas()[0]?.metadata?.jalur).toBe("sippKonteksService.getBerkas");
  });

  it("masih menyebut 'berkas_belum_tersimpan' bila memang tidak ada catatannya", async () => {
    // Alasan lamanya TETAP dipakai untuk keadaan yang memang benar begitu -
    // yang dibetulkan hanya keadaan yang salah disebut.
    seedDokumen();

    const hasil = await konteks.getBerkas("k1", "pdf");
    expect(hasil.ok).toBe(false);
    expect(hasil.alasan).toBe("berkas_belum_tersimpan");
    expect(catatanBerkas()).toHaveLength(0);
  });
});

describe("Lampiran WhatsApp dan layar hakim: satu sumber", () => {
  it("menemukan lampiran lewat tabel berkas walau cerminnya kosong", async () => {
    seedDokumen();
    seedBerkas();

    const lampiran = await pekerja.lampiranDokumen("k1");
    expect(lampiran.ok).toBe(true);
    expect(lampiran.fileName).toBe("jawaban.pdf");
  });

  it("cermin sendirian tidak lagi menghasilkan lampiran", async () => {
    seedDokumen({ berkas_pdf: jalurAda });

    const lampiran = await pekerja.lampiranDokumen("k1");
    expect(lampiran.ok).toBe(false);
  });

  it("salinan yang lenyap tidak menghalangi salinan lama yang utuh", async () => {
    // listFiles memulangkan terbaru lebih dulu dan TIDAK menyaring
    // dihapus_retensi, sedangkan pickBestAttachment hanya menguji satu calon
    // per format. Tanpa penyaringan ke cakram, satu salinan yang sudah lenyap
    // membatalkan lampiran yang sebenarnya masih ada.
    seedBerkas({ jalur_berkas: jalurHilang });
    seedBerkas({ jalur_berkas: jalurAda });

    const lampiran = await pekerja.lampiranDokumen("k1");
    expect(lampiran.ok).toBe(true);
    expect(lampiran.fileName).toBe("jawaban.pdf");
  });

  it("kegagalan membaca catatan berkas dicatat dan disebut apa adanya", async () => {
    seedDokumen();
    seedBerkas();
    berkasMelempar = true;

    const lampiran = await pekerja.lampiranDokumen("k1");
    expect(lampiran.ok).toBe(false);
    expect(String(lampiran.reason)).toContain("catatan_berkas_tidak_terbaca");
    expect(catatanBerkas()[0]?.metadata?.jalur).toBe("ecourtNotificationWorker.lampiranDokumen");
  });

  it("layar verifikasi majelis membaca tabel berkas, bukan cermin", async () => {
    seedDokumen();
    seedBerkas();
    sippRows.push({ nama_gelar: "Drs. H. Ahmad Yani, S.H., M.H." });

    const runtimeConfig = {
      employeeRecipients: [
        {
          name: "Drs. H. Ahmad Yani, S.H., M.H.",
          roleId: "hakim",
          positionName: "Hakim",
          whatsappNumber: "6285242120977",
        },
      ],
    };

    const hasil = await verifikasi.listForPortal("Drs. H. Ahmad Yani, S.H., M.H.", { runtimeConfig });
    expect(hasil.ok).toBe(true);
    expect(hasil.dokumen).toHaveLength(1);
    expect(hasil.dokumen[0].adaBerkas).toBe(true);
  });

  it("layar verifikasi majelis tidak percaya cermin yang terisi sendirian", async () => {
    seedDokumen({ berkas_pdf: jalurAda, berkas_word: jalurAda });
    sippRows.push({ nama_gelar: "Drs. H. Ahmad Yani, S.H., M.H." });

    const runtimeConfig = {
      employeeRecipients: [
        {
          name: "Drs. H. Ahmad Yani, S.H., M.H.",
          roleId: "hakim",
          positionName: "Hakim",
          whatsappNumber: "6285242120977",
        },
      ],
    };

    const hasil = await verifikasi.listForPortal("Drs. H. Ahmad Yani, S.H., M.H.", { runtimeConfig });
    expect(hasil.dokumen).toHaveLength(1);
    expect(hasil.dokumen[0].adaBerkas).toBe(false);
  });
});
