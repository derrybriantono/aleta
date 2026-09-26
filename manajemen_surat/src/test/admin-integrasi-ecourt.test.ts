// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * LAYAR ADMIN INTEGRASI e-COURT - BUTIR 3, 25 SEPTEMBER 2026
 * ============================================================================
 *
 * Yang diminta pengguna: "cek kembali sinkronisasi data e-court ke seluruh
 * aplikasi ... saya ingin sinkron dan lengkap".
 *
 * Layar Admin Integrasi e-Court adalah satu-satunya tempat orang dapat bertanya
 * "apakah sinkronisasinya lengkap?", dan sampai hari ini pertanyaan itu tidak
 * terjawab di sana: yang tampil adalah jumlah dokumen TERSIMPAN, tanpa penyebut.
 *
 * ============================================================================
 * UJI INI MENJALANKAN KODENYA, BUKAN MENYISIR TEKSNYA
 * ============================================================================
 *
 * Seluruh pemeriksaan di bawah memanggil fungsi yang sesungguhnya dengan tiruan
 * basis data, sehingga uji ini MERAH bila kuerinya melempar galat atau
 * penggolongannya salah. Angka yang dipakukan di sini diukur pada basis data
 * setempat 25 Sep 2026:
 *
 *   sipp_donggala  2.527 perkara e-Court (COUNT(DISTINCT perkara_id)
 *                  FROM perkara_efiling_id)
 *   perkara_efiling  2.525 "Perkara Terdaftar", 5 "Menunggu Pendaftaran",
 *                  4 "Pendaftaran Ditolak", 3 "Pendaftaran Tidak Dapat
 *                  Dilanjutkan"
 *   status_pendaftaran_id 8 memuat DUA arti ("Menunggu Pendaftaran" 5 baris dan
 *                  "Perkara Terdaftar" 1 baris); id 11 juga DUA ("Pendaftaran
 *                  Ditolak" 4 dan "Pendaftaran Tidak Dapat Dilanjutkan" 3)
 *   basis `sipp` (PA Bungku) memuat teks kelima yang tidak ada di Donggala:
 *                  "Verifikasi Pendaftaran Perkara"
 */

const require_ = createRequire(import.meta.url);
const akar = path.resolve(process.cwd(), "..");

const JALUR_BOT_DB = require_.resolve(path.join(akar, "aleta_bot", "services", "botDbService.js"));
const JALUR_JEMBATAN = require_.resolve(
  path.join(akar, "aleta_bot", "services", "sippReadOnlyBridgeService.js")
);
const JALUR_LAYANAN = require_.resolve(
  path.join(akar, "aleta_bot", "services", "ecourtStatusService.js")
);
const JALUR_TOKO = require_.resolve(
  path.join(akar, "aleta_bot", "services", "ecourtStoreService.js")
);

type Baris = Record<string, unknown>;
type Layanan = {
  golonganPendaftaran: (teks: unknown) => string;
  riwayatPutaran: (opsi?: { limit?: number }) => Promise<Baris[]>;
  ringkasArsip: () => Promise<Baris>;
  ringkasPanggilan: () => Promise<Baris>;
  cakupanEcourt: (opsi?: { contoh?: number }) => Promise<Baris>;
  getStatus: (opsi?: { limit?: number }) => Promise<Baris>;
};

const cache = require_.cache as Record<string, { exports: unknown } | undefined>;
const disimpan = new Map<string, { exports: unknown } | undefined>();

function ganti(jalur: string, exports: unknown) {
  if (!disimpan.has(jalur)) disimpan.set(jalur, cache[jalur]);
  cache[jalur] = { exports };
}

afterEach(() => {
  for (const [jalur, semula] of disimpan) {
    if (semula) cache[jalur] = semula;
    else delete cache[jalur];
  }
  disimpan.clear();
});

/** fromMysqlDate tiruan yang menirukan yang asli, termasuk "tegaskan UTC". */
function fromMysqlDate(nilai: unknown) {
  if (!nilai) return null;
  if (nilai instanceof Date) return Number.isNaN(nilai.getTime()) ? null : nilai;
  const teks = String(nilai).trim();
  if (!teks) return null;
  const cocok = teks.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
  const tanggal = cocok ? new Date(`${cocok[1]}T${cocok[2]}Z`) : new Date(teks);
  return Number.isNaN(tanggal.getTime()) ? null : tanggal;
}

/**
 * Memuat ecourtStatusService dengan basis data dan jembatan tiruan.
 *
 * botDbService diganti SEBELUM layanannya dimuat, sehingga seluruh layanan yang
 * ditariknya ikut memakai tiruan yang sama - tidak ada satu pun sambungan MySQL
 * yang dibuka oleh uji ini.
 */
function muatLayanan({
  query,
  caseList,
}: {
  query: (sql: string, params: unknown[]) => unknown;
  caseList?: (params: Baris) => unknown;
}): { layanan: Layanan; sqlTercatat: string[]; paramJembatan: Baris[] } {
  const sqlTercatat: string[] = [];
  const paramJembatan: Baris[] = [];

  ganti(JALUR_BOT_DB, {
    query: async (sql: string, params: unknown[] = []) => {
      sqlTercatat.push(sql);
      return query(sql, params);
    },
    fromMysqlDate,
    toMysqlDate: (d: Date) => d.toISOString().slice(0, 19).replace("T", " "),
    addColumnIfMissing: async () => {},
    addIndexIfMissing: async () => {},
    initializeSchema: async () => true,
    ensureSchema: async () => true,
    getDbStatus: () => ({ schemaReady: true, lastError: "" }),
  });

  ganti(JALUR_JEMBATAN, {
    safeHandleBridgeOperation: async (operasi: string, params: Baris = {}) => {
      paramJembatan.push({ operasi, ...params });
      if (!caseList) return { ok: false, error: "tanpa_tiruan" };
      return { ok: true, data: caseList(params) };
    },
    handleBridgeOperation: async () => {
      throw new Error("tidak dipakai uji ini");
    },
  });

  delete cache[JALUR_LAYANAN];
  delete cache[JALUR_TOKO];
  const layanan = require_(JALUR_LAYANAN) as Layanan;
  return { layanan, sqlTercatat, paramJembatan };
}

function perkaraTiruan() {
  // Campuran yang persis seperti yang terukur, ditambah dua jebakan: teks
  // kelima dari basis PA Bungku, dan nomor e-Court yang bertukar.
  return [
    { nomorPerkara: "1/Pdt.G/2026/PA.Dgl", statusPendaftaran: "Perkara Terdaftar", sudahDibayar: true, nomorPerkaraEfiling: "1/Pdt.G/2026/PA.Dgl", tanggalPendaftaran: "2026-01-02" },
    { nomorPerkara: "2/Pdt.G/2026/PA.Dgl", statusPendaftaran: "Perkara Terdaftar", sudahDibayar: true, nomorPerkaraEfiling: "2/Pdt.G/2026/PA.Dgl", tanggalPendaftaran: "2026-01-03" },
    { nomorPerkara: "229/Pdt.G/2026/PA.Dgl", statusPendaftaran: "Menunggu Pendaftaran", sudahDibayar: true, nomorPerkaraEfiling: "229/Pdt.G/2026/PA.Dgl", tanggalPendaftaran: "2026-04-14" },
    { nomorPerkara: "52/Pdt.P/2021/PA.Dgl", statusPendaftaran: "Pendaftaran Ditolak", sudahDibayar: true, nomorPerkaraEfiling: "", tanggalPendaftaran: "2021-03-30" },
    { nomorPerkara: "9/Pdt.G/2025/PA.Dgl", statusPendaftaran: "Pendaftaran Tidak Dapat Dilanjutkan", sudahDibayar: false, nomorPerkaraEfiling: "", tanggalPendaftaran: "2025-09-26" },
    { nomorPerkara: "210/Pdt.G/2019/PA.Buk", statusPendaftaran: "Verifikasi Pendaftaran Perkara", sudahDibayar: true, nomorPerkaraEfiling: "", tanggalPendaftaran: "2019-07-15" },
    { nomorPerkara: "7/Pdt.G/2026/PA.Dgl", statusPendaftaran: "", sudahDibayar: true, nomorPerkaraEfiling: "", tanggalPendaftaran: "2026-02-02" },
    // Nomor bertukar - terukur 2 dari 2.529 baris di sipp_donggala.
    { nomorPerkara: "61/Pdt.G/2020/PA.Dgl", statusPendaftaran: "Perkara Terdaftar", sudahDibayar: true, nomorPerkaraEfiling: "63/Pdt.G/2020/PA.Dgl", tanggalPendaftaran: "2020-05-01" },
    // Tanggal rusak seperti yang sungguh pulang dari jembatan hari ini.
    { nomorPerkara: "88/Pdt.G/2026/PA.Dgl", statusPendaftaran: "Perkara Terdaftar", sudahDibayar: true, nomorPerkaraEfiling: "88/Pdt.G/2026/PA.Dgl", tanggalPendaftaran: "Tue Sep 08" },
  ];
}

describe("golonganPendaftaran - digolongkan dari teksnya", () => {
  it("keempat teks yang sungguh ada di sipp_donggala digolongkan terpisah", () => {
    const { layanan } = muatLayanan({ query: async () => [] });
    expect(layanan.golonganPendaftaran("Perkara Terdaftar")).toBe("terdaftar");
    expect(layanan.golonganPendaftaran("Menunggu Pendaftaran")).toBe("menunggu");
    expect(layanan.golonganPendaftaran("Pendaftaran Ditolak")).toBe("ditolak");
    expect(layanan.golonganPendaftaran("Pendaftaran Tidak Dapat Dilanjutkan")).toBe(
      "tidakDapatDilanjutkan"
    );
  });

  it("'Tidak Dapat Dilanjutkan' TIDAK ikut terhitung sebagai ditolak", () => {
    // Kedua teksnya berawalan "Pendaftaran", dan status_pendaftaran_id keduanya
    // 11. Urutan periksa yang salah akan menggabungkan 3 perkara batal ke dalam
    // hitungan 4 perkara ditolak - dan jumlahnya tetap terlihat masuk akal.
    const { layanan } = muatLayanan({ query: async () => [] });
    expect(layanan.golonganPendaftaran("Pendaftaran Tidak Dapat Dilanjutkan")).not.toBe("ditolak");
  });

  it("teks yang belum dikenal tidak dibulatkan menjadi terdaftar", () => {
    // Terukur pada basis `sipp` (PA Bungku): "Verifikasi Pendaftaran Perkara".
    // Menghitungnya sebagai terdaftar adalah persis cara satu perkara batal
    // lolos tanpa terlihat siapa pun.
    const { layanan } = muatLayanan({ query: async () => [] });
    expect(layanan.golonganPendaftaran("Verifikasi Pendaftaran Perkara")).toBe("lain");
    expect(layanan.golonganPendaftaran("")).toBe("tanpaKeadaan");
    expect(layanan.golonganPendaftaran(null)).toBe("tanpaKeadaan");
  });
});

describe("cakupanEcourt - penyebut dan perkara yang pendaftarannya bermasalah", () => {
  function siapkan() {
    return muatLayanan({
      query: async (sql) => {
        // Kueri ringkasKekuranganBerkas: dua perkara sudah pernah ditarik,
        // salah satunya masih kekurangan berkas.
        if (sql.includes("aleta_bot_ecourt_documents d")) {
          return [
            { nomorPerkara: "1/Pdt.G/2026/PA.Dgl", dokumen: 3, berkasAda: 3, tanpaBerkas: 0, tidakTersedia: 0, menunggu: 0, terakhir: null },
            { nomorPerkara: "2/Pdt.G/2026/PA.Dgl", dokumen: 2, berkasAda: 1, tanpaBerkas: 1, tidakTersedia: 0, menunggu: 0, terakhir: null },
          ];
        }
        return [];
      },
      caseList: () => ({ perkara: perkaraTiruan(), pendaftaranGanda: 2, jumlah: 9 }),
    });
  }

  it("cakupan dihitung terhadap seluruh perkara e-Court, bukan terhadap dokumen tersimpan", async () => {
    const { layanan } = siapkan();
    const hasil = await layanan.cakupanEcourt({ contoh: 25 });
    expect(hasil.ok).toBe(true);
    expect(hasil.totalSipp).toBe(9);
    expect(hasil.pernahDitarik).toBe(2);
    expect(hasil.belumPernahDitarik).toBe(7);
    expect(hasil.persenDitarik).toBe(22);
    // Hanya satu dari dua yang ditarik berkasnya utuh.
    expect(hasil.berkasLengkap).toBe(1);
    // Ketiganya harus berjumlah persis totalnya.
    expect((hasil.pernahDitarik as number) + (hasil.belumPernahDitarik as number)).toBe(hasil.totalSipp);
  });

  it("jendelanya 3650 hari - 365 hari menyembunyikan 3 dari 4 perkara bermasalah", async () => {
    const { layanan, paramJembatan } = siapkan();
    await layanan.cakupanEcourt();
    expect(paramJembatan).toHaveLength(1);
    expect(paramJembatan[0].operasi).toBe("ecourt.caseList");
    // Terukur: perkara bermasalah yang tertaut terdaftar 2020, 2021, 2023 dan
    // 2026. Jendela 365 hari hanya menyisakan yang 2026.
    expect(paramJembatan[0].sejakHari).toBe(3650);
    expect(paramJembatan[0].limit).toBe(5000);
  });

  it("keadaan pendaftaran digolongkan dan jumlahnya persis totalnya", async () => {
    const { layanan } = siapkan();
    const hasil = await layanan.cakupanEcourt();
    const p = hasil.pendaftaran as Record<string, number>;
    // Contohnya memuat 9 perkara: 4 terdaftar (1/, 2/, 61/, 88/) dan 5 sisanya
    // masing-masing satu golongan yang berbeda.
    expect(p).toEqual({
      terdaftar: 4,
      menunggu: 1,
      ditolak: 1,
      tidakDapatDilanjutkan: 1,
      lain: 1,
      tanpaKeadaan: 1,
    });
    const jumlah = Object.values(p).reduce((a, b) => a + b, 0);
    expect(jumlah).toBe(hasil.totalSipp);
  });

  it("yang bukan terdaftar masuk daftar bermasalah, dan yang batal disebut lebih dulu", async () => {
    const { layanan } = siapkan();
    const hasil = await layanan.cakupanEcourt({ contoh: 25 });
    // Lima dari sembilan: menunggu, ditolak, tidak dapat dilanjutkan, keadaan
    // yang belum dikenal, dan tanpa keadaan. Yang dua terakhir ikut DENGAN
    // SENGAJA - keadaan yang tidak dikenal tidak boleh lolos sebagai beres.
    expect(hasil.jumlahBermasalah).toBe(5);
    const daftar = hasil.bermasalah as { nomorPerkara: string; golongan: string }[];
    expect(daftar).toHaveLength(5);
    // Pendaftaran batal harus di atas pendaftaran yang sekadar menunggu:
    // yang pertama berarti perkaranya tidak boleh berjalan.
    expect(daftar[0].golongan).toBe("tidakDapatDilanjutkan");
    expect(daftar[1].golongan).toBe("ditolak");
    expect(daftar.map((d) => d.golongan)).toContain("lain");
    expect(daftar.map((d) => d.golongan)).toContain("tanpaKeadaan");
    // "menunggu" paling belakang - pendaftaran yang belum selesai memang
    // pekerjaan, tetapi bukan perkara yang terlarang disidangkan.
    expect(daftar[daftar.length - 1].golongan).toBe("menunggu");
  });

  it("perkara yang sudah pernah ditarik ditandai, sebab berkasnya sudah masuk arsip", async () => {
    const { layanan } = siapkan();
    const hasil = await layanan.cakupanEcourt({ contoh: 25 });
    const daftar = hasil.bermasalah as { nomorPerkara: string; pernahDitarik: boolean }[];
    for (const item of daftar) expect(item.pernahDitarik).toBe(false);
  });

  it("nomor SIPP yang berbeda dari nomor e-Court dilaporkan", async () => {
    // Terukur 2 dari 2.529 baris, dan keduanya BERTUKAR: perkara bernomor SIPP
    // 61/Pdt.G/2020 bernomor e-Court 63/Pdt.G/2020 dan sebaliknya. Menarik
    // dokumen dengan nomor yang salah membuat berkas perkara 61 mendarat di 63.
    const { layanan } = siapkan();
    const hasil = await layanan.cakupanEcourt({ contoh: 25 });
    expect(hasil.jumlahNomorBerselisih).toBe(1);
    expect(hasil.nomorBerselisih).toEqual([
      { nomorPerkara: "61/Pdt.G/2020/PA.Dgl", nomorEcourt: "63/Pdt.G/2020/PA.Dgl" },
    ]);
  });

  it("tanggal tak terbaca dari jembatan dikosongkan dan dihitung, bukan ditampilkan", async () => {
    // listEcourtCases memulangkan "Tue Sep 08" untuk SELURUH 2.527 barisnya
    // (safeString atas objek Date lalu slice(0,10)). "Mon Mar 30" tanpa tahun
    // lebih berbahaya daripada kosong: petugas membacanya sebagai tahun ini.
    const { layanan } = siapkan();
    const hasil = await layanan.cakupanEcourt({ contoh: 25 });
    expect(hasil.tanggalRusak).toBe(1);
    const daftar = hasil.bermasalah as { tanggalPendaftaran: string; tanggalTidakTerbaca: boolean }[];
    for (const item of daftar) {
      if (item.tanggalPendaftaran) expect(item.tanggalPendaftaran).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("belum dibayar dihitung dari sudahDibayar, bukan ditebak", async () => {
    const { layanan } = siapkan();
    const hasil = await layanan.cakupanEcourt();
    expect(hasil.belumDibayar).toBe(1);
  });

  it("SIPP yang tidak terbaca memulangkan ok:false, bukan nol", async () => {
    // Nol berarti "tidak ada perkara e-Court", dan itu jawaban yang salah dengan
    // wajah meyakinkan. ok:false membuat layar mengatakan penyebutnya belum ada.
    const { layanan } = muatLayanan({ query: async () => [] });
    const hasil = await layanan.cakupanEcourt();
    expect(hasil.ok).toBe(false);
    expect(hasil.totalSipp).toBeUndefined();
    expect(String(hasil.alasan)).toContain("tanpa_tiruan");
  });
});

describe("riwayatPutaran - keempat kolom yang sudah lama tersimpan", () => {
  function siapkan() {
    return muatLayanan({
      query: async (sql) => {
        if (sql.includes("aleta_bot_ecourt_sync_runs")) {
          return [
            { id: "c", dimulai_pada: "2026-09-22 08:00:00", selesai_pada: null, status: "berjalan", perkara_diperiksa: 30, dokumen_terlihat: 0, dokumen_baru: 0, berkas_terunduh: 0, jumlah_galat: 0, galat_terakhir: null, catatan: "" },
            { id: "b", dimulai_pada: "2026-09-21 08:00:00", selesai_pada: "2026-09-21 08:05:00", status: "sebagian", perkara_diperiksa: 20, dokumen_terlihat: 9, dokumen_baru: 5, berkas_terunduh: 4, jumlah_galat: 1, galat_terakhir: "timeout", catatan: "" },
            { id: "a", dimulai_pada: "2026-09-20 08:00:00", selesai_pada: "2026-09-20 08:10:00", status: "gagal", perkara_diperiksa: 10, dokumen_terlihat: 4, dokumen_baru: 0, berkas_terunduh: 0, jumlah_galat: 3, galat_terakhir: "HTTP 404", catatan: "" },
          ];
        }
        return [];
      },
    });
  }

  it("keempat kolomnya dipulangkan untuk SETIAP putaran, bukan hanya yang terakhir", async () => {
    const { layanan } = siapkan();
    const putaran = await layanan.riwayatPutaran({ limit: 10 });
    expect(putaran).toHaveLength(3);
    expect(putaran.map((p) => p.perkaraDiperiksa)).toEqual([30, 20, 10]);
    expect(putaran.map((p) => p.dokumenBaru)).toEqual([0, 5, 0]);
    expect(putaran.map((p) => p.berkasTerunduh)).toEqual([0, 4, 0]);
    expect(putaran.map((p) => p.jumlahGalat)).toEqual([0, 1, 3]);
  });

  it("putaran yang belum selesai berlama null, bukan nol", async () => {
    // Putaran yang masih berjalan dan putaran yang selesai seketika bukan hal
    // yang sama; nol akan menyamakan keduanya.
    const { layanan } = siapkan();
    const putaran = await layanan.riwayatPutaran();
    expect(putaran[0].lamaDetik).toBeNull();
    expect(putaran[1].lamaDetik).toBe(300);
    expect(putaran[2].lamaDetik).toBe(600);
  });

  it("terbaru lebih dulu, dan batasnya dijepit", async () => {
    const { layanan, sqlTercatat } = siapkan();
    await layanan.riwayatPutaran({ limit: 9999 });
    const sql = sqlTercatat.find((s) => s.includes("aleta_bot_ecourt_sync_runs")) || "";
    expect(sql).toContain("ORDER BY dimulai_pada DESC");
    expect(sql).toContain("LIMIT 50");
  });
});

describe("ringkasArsip dan ringkasPanggilan - tersimpan lama, belum pernah terbaca", () => {
  it("byte yang dihitung hanya berkas yang masih ada di disk", async () => {
    // Menjumlahkan yang sudah dibuang retensi membuat layar mengaku menyimpan
    // berkas yang tidak ada lagi.
    const { layanan } = muatLayanan({
      query: async (sql) => {
        if (sql.includes("aleta_bot_ecourt_files")) {
          return [
            { berkas: 3, perkara: 2, dokumen: 3, aktif: 2, dihapusRetensi: 1, byteAktif: 3000, byteSemua: 3500 },
          ];
        }
        return [];
      },
    });
    const arsip = await layanan.ringkasArsip();
    expect(arsip.byteAktif).toBe(3000);
    expect(arsip.byteSemua).toBe(3500);
    expect(arsip.dihapusRetensi).toBe(1);
    expect(arsip.aktif).toBe(2);
  });

  it("persetujuan yang tidak dikenal masuk 'lain', bukan dibulatkan ke 'belum'", async () => {
    // Kolomnya varchar(16) tanpa enum. Membulatkan nilai baru ke "belum" berarti
    // melaporkan pekerjaan yang tidak ada, atau menyembunyikan keadaan yang
    // tidak bernama.
    const { layanan } = muatLayanan({
      query: async (sql) => {
        if (sql.includes("aleta_bot_ecourt_panggilan")) {
          return [{ total: 3, perkara: 2, terkirim: 2 }];
        }
        if (sql.includes("aleta_bot_ecourt_pihak")) {
          return [
            { persetujuan: "setuju", jumlah: 1 },
            { persetujuan: "belum", jumlah: 1 },
            { persetujuan: "tolak", jumlah: 1 },
            { persetujuan: "entahlah", jumlah: 1 },
          ];
        }
        return [];
      },
    });
    const hasil = (await layanan.ringkasPanggilan()) as {
      panggilan: Record<string, number>;
      persetujuan: Record<string, number>;
    };
    expect(hasil.panggilan).toEqual({ total: 3, perkara: 2, terkirim: 2 });
    expect(hasil.persetujuan).toEqual({ setuju: 1, belum: 1, tolak: 1, lain: 1, total: 4 });
    // Jumlah golongan harus persis totalnya - selisihnya berarti ada yang luput.
    const { total, ...golongan } = hasil.persetujuan;
    expect(Object.values(golongan).reduce((a, b) => a + b, 0)).toBe(total);
  });
});

describe("getStatus - bagian baru ikut terkirim tanpa merusak yang lama", () => {
  it("SIPP yang mati tidak menghapus angka dokumen di sebelahnya", async () => {
    // Inilah sebab tiap bagian dibungkus aman() sendiri: satu sumber yang tidak
    // terjangkau tidak boleh mengosongkan seluruh layar.
    const { layanan } = muatLayanan({
      query: async (sql) => {
        if (sql.includes("COUNT(*) AS jumlah FROM aleta_bot_ecourt_documents")) return [{ jumlah: 7 }];
        if (sql.includes("aleta_bot_ecourt_sync_runs")) {
          return [
            { id: "x", dimulai_pada: "2026-08-28 07:11:55", selesai_pada: "2026-08-28 07:21:58", status: "gagal", perkara_diperiksa: 0, dokumen_terlihat: 0, dokumen_baru: 0, berkas_terunduh: 0, jumlah_galat: 0, galat_terakhir: "login manual tidak selesai sebelum batas waktu", catatan: "jembatan e-court manual" },
          ];
        }
        if (sql.includes("aleta_bot_ecourt_files")) {
          return [{ berkas: 0, perkara: 0, dokumen: 0, aktif: 0, dihapusRetensi: 0, byteAktif: 0, byteSemua: 0 }];
        }
        if (sql.includes("aleta_bot_ecourt_panggilan")) return [{ total: 0, perkara: 0, terkirim: 0 }];
        if (sql.includes("aleta_bot_ecourt_pihak")) return [];
        return [];
      },
      // Tanpa caseList: jembatannya menjawab gagal.
    });

    const status = (await layanan.getStatus({ limit: 5 })) as Record<string, unknown>;
    const dokumen = status.dokumen as Record<string, number>;
    expect(dokumen.total).toBe(7);

    // Cakupan ada tetapi mengaku tidak terbaca - BUKAN nol, dan bukan hilang.
    const cakupan = status.cakupan as Record<string, unknown>;
    expect(cakupan.ok).toBe(false);

    // Riwayat putaran tetap terkirim: ia dari basis bot, bukan dari SIPP.
    const putaran = status.putaran as Baris[];
    expect(putaran).toHaveLength(1);
    expect(putaran[0].status).toBe("gagal");
    expect(putaran[0].galatTerakhir).toBe("login manual tidak selesai sebelum batas waktu");

    // Bagian lama tetap ada bentuknya.
    expect(status).toHaveProperty("verifikasi");
    expect(status).toHaveProperty("nomor");
    expect(status).toHaveProperty("aturan");
    expect(status).toHaveProperty("arsip");
    expect(status).toHaveProperty("panggilan");
  });

  it("bagian baru bertahan melewati JSON, sebab itulah jalan ke layar", async () => {
    // Jalannya: getStatus -> res.json di internalGatewayRoutes -> gatewayFetch
    // -> ok() di route.ts -> fetch di komponen. Seluruhnya JSON, jadi Map, Date
    // atau undefined yang lolos ke sini akan hilang atau berubah bentuk TANPA
    // satu galat pun - dan layarnya menampilkan "-" yang terbaca seperti data.
    const { layanan } = muatLayanan({
      query: async (sql) => {
        if (sql.includes("aleta_bot_ecourt_documents d")) {
          return [
            { nomorPerkara: "1/Pdt.G/2026/PA.Dgl", dokumen: 3, berkasAda: 3, tanpaBerkas: 0, tidakTersedia: 0, menunggu: 0, terakhir: null },
          ];
        }
        if (sql.includes("aleta_bot_ecourt_sync_runs")) {
          return [
            { id: "x", dimulai_pada: "2026-09-22 08:00:00", selesai_pada: "2026-09-22 08:03:00", status: "sebagian", perkara_diperiksa: 4, dokumen_terlihat: 2, dokumen_baru: 2, berkas_terunduh: 1, jumlah_galat: 1, galat_terakhir: "HTTP 404", catatan: "" },
          ];
        }
        if (sql.includes("aleta_bot_ecourt_files")) {
          return [{ berkas: 2, perkara: 1, dokumen: 2, aktif: 2, dihapusRetensi: 0, byteAktif: 2048, byteSemua: 2048 }];
        }
        if (sql.includes("aleta_bot_ecourt_panggilan")) return [{ total: 1, perkara: 1, terkirim: 1 }];
        if (sql.includes("aleta_bot_ecourt_pihak")) return [{ persetujuan: "setuju", jumlah: 1 }];
        return [];
      },
      caseList: () => ({ perkara: perkaraTiruan(), pendaftaranGanda: 2, jumlah: 9 }),
    });

    const status = await layanan.getStatus({ limit: 5 });
    const lewatJson = JSON.parse(JSON.stringify(status)) as Record<string, never>;

    const cakupan = lewatJson.cakupan as unknown as Record<string, unknown>;
    expect(cakupan.ok).toBe(true);
    expect(cakupan.totalSipp).toBe(9);
    expect(cakupan.pernahDitarik).toBe(1);
    expect(Array.isArray(cakupan.bermasalah)).toBe(true);
    expect((cakupan.bermasalah as unknown[]).length).toBe(5);

    const putaran = lewatJson.putaran as unknown as Baris[];
    expect(putaran[0].berkasTerunduh).toBe(1);
    expect(putaran[0].lamaDetik).toBe(180);

    const arsip = lewatJson.arsip as unknown as Baris;
    expect(arsip.byteAktif).toBe(2048);

    const panggilan = lewatJson.panggilan as unknown as { persetujuan: Baris };
    expect(panggilan.persetujuan.setuju).toBe(1);
  });
});
