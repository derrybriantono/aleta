// @vitest-environment node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { pihakDipanggil as pihakDariPohon } from "@/lib/pohon-blangko";

/**
 * ============================================================================
 * ANTRIAN CETAK RELAAS HARIAN - DIJALANKAN ATAS DATA SUNGGUHAN
 * ============================================================================
 *
 * Menjaga relaasMassalService.relaasCetakHarian (rute bot
 * GET /internal/aleta-bot/sipp/relaas-cetak): dokumen yang LAHIR pada hari
 * juru sita mencetak - perkara yang didaftarkan/ditetapkan hari sidangnya,
 * sidang hari itu yang ditunda, jadwal yang diinput hari itu, dan putusan hari
 * itu.
 *
 * Layanannya DIJALANKAN atas sipp_donggala setempat dengan db_config
 * dijembatani mysql.exe - pola yang sama dengan relaas-massal-golongan.test.ts.
 * Tidak ada pemeriksaan yang membaca teks sumber: penjaga penyisir teks di
 * repositori ini sudah tiga kali hijau atas kode yang melempar galat.
 *
 * Angka pembanding dihitung dengan SQL TERPISAH yang dirumuskan berbeda dari
 * kueri layanan (OR alih-alih UNION untuk pendaftaran, "sidang berikutnya
 * menurut kronologi" alih-alih urutan+1), supaya cacat yang sama tidak muncul
 * di kedua sisi dan saling membenarkan.
 *
 * Bila mysql.exe tidak ada di mesin ini, uji data DILEWATI beserta sebabnya -
 * hanya untuk sebab itu. Kueri yang GAGAL dilempar apa adanya.
 */

const require_ = createRequire(import.meta.url);
const AKAR = path.resolve(process.cwd(), "..");
const AKAR_BOT = path.join(AKAR, "aleta_bot");
const MYSQL = "D:/Satker Asal/Website PA Bungku/xampp/mysql/bin/mysql.exe";
const BASIS = "sipp_donggala";
// Berkas sementara ke D: - disk C: tidak disentuh. Namanya memuat pid: dua
// jalanan uji yang bersamaan (sesi paralel) pernah berbagi satu berkas SQL dan
// saling menimpa kuerinya - merah palsu yang tidak ada hubungannya dengan kode.
const KERJA = "D:/aleta-dev/kerja/relaas-antrian";
const BERKAS_SQL = path.join(KERJA, `_uji-cetak-harian-${process.pid}.sql`);

const ADA_MYSQL = existsSync(MYSQL);

type Dokumen = {
  kunci: string;
  perkaraId: number;
  nomorPerkara: string;
  jenisPerkara: string;
  alurPerkaraId: number | null;
  jenisPerkaraId: number | null;
  golongan: string;
  sebabMasuk: string;
  d: number | null;
  sidangId: number | null;
  tanggalSidangTujuan: string;
  sidangAsalId: number | null;
  dihadiriOleh: number | string | null;
  pihakDipanggil: string;
  pihakKe: number | null;
  jurusita: { nama: string; nip: string; dariPenunjukan: boolean };
  sudahAdaRelaas: boolean | null;
  // Ruas tambahan telaah 25 Sep 2026 (di luar kontrak K1).
  keterangan: string[];
  prosesTerakhirId: number | null;
  statusPutusanId: number | null;
  statusPutusanNama: string;
  jumlahPihak: { pertama: number; kedua: number; lain: number } | null;
  jumlahPihakSasaran: number | null;
};

type TidakPerlu = {
  perkaraId: number;
  nomorPerkara: string;
  golongan: string;
  sidangAsalId: number | null;
  sebab: string;
};

type Tertunda = { perkaraId: number; nomorPerkara: string; sebab: string; keterangan: string };

type Hasil = {
  ok: boolean;
  alasan?: string;
  tanggal: string;
  dokumen: Dokumen[];
  tidakPerlu: TidakPerlu[];
  tertunda: Tertunda[];
  hariKerjaSebelumnya: { tanggal: string; dokumen: Dokumen[] };
  ringkas: {
    dokumen: number;
    perGolongan: Record<string, number>;
    perSebabMasuk: Record<string, number>;
    perJurusita: Record<string, number>;
    tidakPerlu: number;
    tertunda: number;
    sudahAdaRelaas: number;
  };
  catatan: string[];
};

type Layanan = {
  relaasCetakHarian: (tanggal: string) => Promise<Hasil>;
  GOLONGAN_CETAK: string[];
  SEBAB_MASUK: string[];
  tanggalSah: (t: string) => boolean;
  tanggalBerikut: (t: string) => string;
  tanggalMundur: (t: string, hari: number) => string;
  jamIso: (nilai: unknown) => string;
  nilaiSudahAda: (
    pihak: string,
    daftarPihak: (sisi: number) => Array<{ pihakId: number; barisId: number }>,
    ada: (sisi: number, p: { pihakId: number; barisId: number }) => boolean
  ) => boolean | null;
  pihakDipanggilDariSandi: (nilai: unknown) => string;
};

type ModulCjs = new (id: string) => { filename: string; loaded: boolean; exports: unknown };

/** Mengubah isian `?` menjadi nilai SQL. Larik menjadi daftar untuk `IN (?)`. */
function kutip(nilai: unknown): string {
  if (nilai === null || nilai === undefined) return "NULL";
  if (Array.isArray(nilai)) return nilai.length === 0 ? "NULL" : nilai.map(kutip).join(",");
  if (typeof nilai === "number") return String(nilai);
  if (nilai instanceof Date) return `'${nilai.toISOString().slice(0, 19).replace("T", " ")}'`;
  return `'${String(nilai).replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}

let jumlahKueri = 0;

function jalankanSql(sql: string, isian: unknown[]): Array<Record<string, string | null>> {
  let i = 0;
  const utuh = sql.replace(/\?/g, () => kutip(isian[i++]));
  mkdirSync(KERJA, { recursive: true });
  writeFileSync(BERKAS_SQL, utuh, "utf8");
  jumlahKueri += 1;
  const keluar = execFileSync(
    MYSQL,
    ["-u", "root", "-B", BASIS, `--execute=source ${BERKAS_SQL}`],
    { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }
  ).trim();
  if (!keluar) return [];
  const baris = keluar.split(/\r?\n/);
  const kepala = baris[0].split("\t");
  return baris.slice(1).map((b) => {
    const sel = b.split("\t");
    const o: Record<string, string | null> = {};
    kepala.forEach((k, j) => (o[k] = sel[j] === "NULL" ? null : sel[j]));
    return o;
  });
}

/**
 * Memuat layanan bot dengan db_config DIGANTI jembatan mysql.exe, SEBELUM
 * layanannya dimuat - kolam sambungan sungguhan tidak pernah dibuat.
 */
function muatLayanan(): Layanan {
  const jalurDb = require_.resolve(path.join(AKAR_BOT, "db_config"));
  const Modul = require_("node:module") as unknown as ModulCjs;
  const palsu = new Modul(jalurDb);
  palsu.filename = jalurDb;
  palsu.loaded = true;
  palsu.exports = {
    query: (
      sql: string,
      isian: unknown[],
      balik: (galat: Error | null, hasil: unknown) => void
    ) => {
      try {
        balik(null, jalankanSql(sql, isian || []));
      } catch (e) {
        // Galat SQL diteruskan APA ADANYA - larik kosong akan membuat uji ini
        // hijau atas layanan yang tidak dapat membaca apa pun.
        const galat = e as { stderr?: string; message?: string };
        const pesan = String(galat.stderr || galat.message || e)
          .split(/\r?\n/)[0]
          .slice(0, 400);
        balik(new Error(pesan), null);
      }
    },
  };
  const cache = require_.cache as unknown as Record<string, unknown>;
  cache[jalurDb] = palsu;
  return require_(path.join(AKAR_BOT, "services", "relaasMassalService.js")) as Layanan;
}

const layanan = muatLayanan();

/**
 * Tanggal yang dipakai, masing-masing karena satu hal yang dijaganya. Diukur
 * pada sipp_donggala 25 September 2026.
 *
 *   2026-04-29  6 didaftarkan, 4 sidang bersidang berikutnya (1 ikrar, 1 semua
 *               hadir), 3 putusan.
 *   2026-08-18  jaring (c): jadwal ikrar talak 19902 diinput hari itu untuk
 *               2 Sep, dan jadwal 19898 yang diinput untuk sidang HARI ITU
 *               (pencatatan susulan - tidak boleh menjadi dokumen).
 *   2026-09-04  18 putusan: 14 dibacakan di hadapan semua pihak, 4 Pdt.P yang
 *               sidang pembacaannya diinput susulan tanpa sandi (tidak
 *               diketahui); 4 jadwal susulan, satu bersandi sebelumnya 4.
 *   2026-10-15  (semula 2026-09-22, lihat catatan impor ulang di bawah) 40
 *               sidang tanpa sidang berikutnya maupun putusan - sesudah
 *               tanggal data terakhir (9 Okt), jadi semuanya tertunda.
 *   2026-04-22  hari pendaftaran terbanyak 2026: 25 perkara.
 *   2026-08-12  24 perkara didaftarkan + 10 sidang bersidang berikutnya.
 *   2026-06-30  (semula 2026-09-10) 180/Pdt.P/2026 (9891) didaftarkan tanpa
 *               jadwal ke-1 PADA HARI ITU - jadwalnya baru diinput 15 Jul.
 *               Inilah yang menggigit bila pendaftaran tidak diikutkan.
 *   2026-07-15  (semula 2026-09-12) hari jadwal ke-1 9891 diinput - perkara
 *               itu tidak boleh menjadi dokumen "didaftarkan" di dua tanggal.
 *
 * IMPOR ULANG 9 Oktober 2026: sipp_donggala diganti salinan produksi terbaru
 * (CREATE_TIME tabel perkara/perkara_jadwal_sidang/perkara_putusan 9 Okt
 * 11.45-12.20). Pada salinan itu 22 Sep sudah bersidang lanjutan (tertunda 0),
 * dan kelima perkara 10 Sep (10112-10116) ternyata berjadwal ke-1 sejak 10 Sep
 * 14.45 - fakta jangkarnya hilang, bukan perilakunya: relaasMassalService.js
 * tidak berubah sejak e8c1a3d, dan uji berbasis aturan (dihitung dari data
 * mentah) tetap hijau. Jangkar diganti dengan tanggal yang memuat keadaan yang
 * sama pada salinan baru.
 *   2026-01-05  perkara 9262: penunjukan Mustini TIDAK aktif (id 9410) lebih
 *               kecil daripada Tanty Restianty yang aktif (id 9473) - menggigit
 *               bila juru sita diambil dari penunjukan yang tidak aktif. Juga
 *               jadwal 18212 (578/Pdt.G/2025) beragenda "Sidang Ikrar Talak"
 *               tanpa penanda ikrar_talak, diinput hari itu.
 *
 * Ditambah telaah 25 September 2026:
 *   2026-02-05  88/Pdt.G/2026: sidang ke-1 bersandi 1 (bawaan borang SIPP)
 *               dengan alasan penundaan "Panggil Tergugat".
 *   2026-07-16  273/Pdt.G/2026 (9729): penetapan hari sidang ULANG untuk
 *               sidang ke-3 29 Jul; sidang ke-1 sudah 13 Mei.
 *   2026-05-20  246/Pdt.G/2026: pemberitahuan pihak 2 ada barisnya, tanpa
 *               tanggal dan tanpa berkas PBT - BELUM diberitahukan.
 *   2026-01-20  19/Pdt.G/2026 (9344) diputus "Dicabut" (status 67).
 *   2026-01-09  18/Pdt.G/2026 (9343) enam Tergugat, 1/Pdt.P/2026 (9348) tiga
 *               Pemohon - blangko hanya memuat pihak pertama tiap sisi.
 *   2026-08-19  hari kerja sebelumnya 18 Agu: sembilan panggilan, tujuh sudah
 *               berelaas di SIPP.
 */
const TANGGAL = {
  tersibuk: "2026-04-29",
  jaring: "2026-08-18",
  putusanPdtP: "2026-09-04",
  sesudahData: "2026-10-15",
  daftarRamai: "2026-04-22",
  daftarDanTunda: "2026-08-12",
  daftarTanpaPhs: "2026-06-30",
  phsTanpaDaftar: "2026-07-15",
  penunjukanTakAktif: "2026-01-05",
  sandiSatuPanggil: "2026-02-05",
  phsUlang: "2026-07-16",
  pbtKosong: "2026-05-20",
  dicabut: "2026-01-20",
  banyakPihak: "2026-01-09",
  kemarinLengkap: "2026-08-19",
} as const;
const SEMUA_TANGGAL: string[] = Object.values(TANGGAL);

const hasil: Record<string, Hasil> = {};
const kueriPerTanggal: Record<string, number> = {};

beforeAll(async () => {
  if (!ADA_MYSQL) return;
  for (const tanggal of SEMUA_TANGGAL) {
    jumlahKueri = 0;
    hasil[tanggal] = await layanan.relaasCetakHarian(tanggal);
    kueriPerTanggal[tanggal] = jumlahKueri;
  }
}, 900000);

// Berkas SQL milik proses ini saja - dibuang supaya berkas ber-pid tidak menumpuk.
afterAll(() => {
  rmSync(BERKAS_SQL, { force: true });
});

/** Normalisasi nama milik uji ini sendiri: gelar sesudah koma, titik, huruf. */
function kunciNama(nama: string): string {
  const koma = nama.indexOf(",");
  const inti = koma >= 0 ? nama.slice(0, koma) : nama;
  return inti.replace(/\./g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

function daftarTanggalSql(): string {
  return SEMUA_TANGGAL.map((t) => `'${t}'`).join(",");
}

// ===========================================================================
// SATUAN - TANPA BASIS DATA
// ===========================================================================

describe("tanggal, dan penilaian sudah-ada-relaas", () => {
  it("tanggal yang tidak ada di kalender ditolak, bukan dibandingkan diam-diam", () => {
    expect(layanan.tanggalSah("2026-02-28")).toBe(true);
    expect(layanan.tanggalSah("2028-02-29")).toBe(true);
    expect(layanan.tanggalSah("2026-02-30")).toBe(false);
    expect(layanan.tanggalSah("2026-13-01")).toBe(false);
    expect(layanan.tanggalSah("2026-9-4")).toBe(false);
    expect(layanan.tanggalSah("2026/09/04")).toBe(false);
  });

  it("hari berikutnya melewati batas bulan dan tahun", () => {
    expect(layanan.tanggalBerikut("2026-12-31")).toBe("2027-01-01");
    expect(layanan.tanggalBerikut("2028-02-28")).toBe("2028-02-29");
    expect(layanan.tanggalBerikut("2026-09-04")).toBe("2026-09-05");
  });

  it("tanggal mundur dan jam input terbaca dari Date maupun teks mysql", () => {
    expect(layanan.tanggalMundur("2027-01-03", 7)).toBe("2026-12-27");
    expect(layanan.tanggalMundur("2028-03-01", 1)).toBe("2028-02-29");
    expect(layanan.jamIso("2026-08-18 15:06:41")).toBe("15.06");
    expect(layanan.jamIso(new Date(2026, 7, 18, 9, 5, 0))).toBe("09.05");
    expect(layanan.jamIso("")).toBe("");
    expect(layanan.jamIso("2026-08-18")).toBe("");
  });

  it("sandi 1 tidak-perlu, sama dengan pohon-blangko", () => {
    for (const sandi of [null, "", 1, 2, 3, 4, 5, 10, "1"]) {
      expect(layanan.pihakDipanggilDariSandi(sandi)).toBe(pihakDariPohon(sandi));
    }
    expect(layanan.pihakDipanggilDariSandi(1)).toBe("tidak-perlu");
  });

  it("sebagian pihak saja = belum; pihak tak diketahui dan sebagian = tak ternilai", () => {
    const pihak = (sisi: number) =>
      sisi === 1 ? [{ pihakId: 11, barisId: 1 }] : sisi === 2 ? [{ pihakId: 22, barisId: 2 }] : [];
    const hanyaSatu = (_s: number, p: { pihakId: number }) => p.pihakId === 11;
    const semua = () => true;
    const tidakAda = () => false;
    expect(layanan.nilaiSudahAda("keduanya", pihak, semua)).toBe(true);
    expect(layanan.nilaiSudahAda("keduanya", pihak, hanyaSatu)).toBe(false);
    expect(layanan.nilaiSudahAda("pertama", pihak, hanyaSatu)).toBe(true);
    expect(layanan.nilaiSudahAda("kedua", pihak, hanyaSatu)).toBe(false);
    expect(layanan.nilaiSudahAda("tidak-diketahui", pihak, hanyaSatu)).toBeNull();
    expect(layanan.nilaiSudahAda("tidak-diketahui", pihak, tidakAda)).toBe(false);
    expect(layanan.nilaiSudahAda("tidak-diketahui", pihak, semua)).toBe(true);
    // Tanpa satu pun baris pihak tidak ada yang dapat dinilai.
    expect(layanan.nilaiSudahAda("keduanya", () => [], semua)).toBeNull();
  });
});

describe.skipIf(!ADA_MYSQL)("tanggal yang rusak dan tanggal kosong", () => {
  it("bentuk lain dan tanggal yang tidak ada dijawab ok:false, tanpa satu kueri pun", async () => {
    for (const rusak of ["2026/09/04", "kemarin", "2026-02-30", "2026-09-04' OR 1=1 --"]) {
      jumlahKueri = 0;
      const h = await layanan.relaasCetakHarian(rusak);
      expect(h.ok).toBe(false);
      expect(h.alasan).toBe("tanggal_tidak_berbentuk_yyyy_mm_dd");
      expect(jumlahKueri).toBe(0);
    }
  });

  it("tanggal kosong = hari ini menurut Asia/Makassar", async () => {
    const hariIni = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Makassar",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const h = await layanan.relaasCetakHarian("");
    expect(h.ok).toBe(true);
    expect(h.tanggal).toBe(hariIni);
  });
});

// ===========================================================================
// BENTUK JAWABAN - KONTRAK K1
// ===========================================================================

describe.skipIf(!ADA_MYSQL)("bentuk jawaban menurut kontrak", () => {
  it("kunci unik, stabil, dan berbentuk golongan:perkara:d:pihakKe", () => {
    for (const tanggal of SEMUA_TANGGAL) {
      const h = hasil[tanggal];
      expect(h.ok, tanggal).toBe(true);
      expect(h.tanggal).toBe(tanggal);
      const kunci = h.dokumen.map((x) => x.kunci);
      expect(new Set(kunci).size, `kunci kembar pada ${tanggal}`).toBe(kunci.length);
      for (const x of h.dokumen) {
        expect(x.kunci).toBe(`${x.golongan}:${x.perkaraId}:${x.d ?? 0}:${x.pihakKe ?? 0}`);
        expect(layanan.GOLONGAN_CETAK).toContain(x.golongan);
        expect(layanan.SEBAB_MASUK).toContain(x.sebabMasuk);
        expect(["keduanya", "pertama", "kedua", "tidak-diketahui"]).toContain(x.pihakDipanggil);
        expect(x.perkaraId).toBeGreaterThan(0);
        expect(typeof x.jurusita.nama).toBe("string");
        expect(x.jurusita.nama.length).toBeGreaterThan(0);
        expect([true, false, null]).toContain(x.sudahAdaRelaas);
      }
    }
  });

  it("pemberitahuan tidak bernomor sidang; panggilan bernomor sidang dan bersidang tujuan", () => {
    for (const tanggal of SEMUA_TANGGAL) {
      for (const x of hasil[tanggal].dokumen) {
        if (x.golongan === "pemberitahuan-putusan") {
          expect(x.d).toBeNull();
          expect(x.sidangId).toBeNull();
          expect(x.tanggalSidangTujuan).toBe("");
          expect(x.pihakKe).toBe(
            x.pihakDipanggil === "pertama" ? 1 : x.pihakDipanggil === "kedua" ? 2 : null
          );
        } else {
          expect(x.d, `${tanggal} ${x.kunci}`).toBeGreaterThan(0);
          expect(x.sidangId).toBeGreaterThan(0);
          expect(x.pihakKe).toBeNull();
          // Sidang yang dipanggil SESUDAH hari mencetak - panggilan untuk sidang
          // yang sudah lewat atau hari itu juga bukan panggilan.
          expect(x.tanggalSidangTujuan > tanggal, `${tanggal} ${x.kunci} ${x.tanggalSidangTujuan}`).toBe(
            true
          );
        }
      }
    }
  });

  it("ringkas berjumlah sama dengan daftarnya, dan keempat golongan selalu disebut", () => {
    for (const tanggal of SEMUA_TANGGAL) {
      const h = hasil[tanggal];
      expect(Object.keys(h.ringkas.perGolongan).sort()).toEqual([...layanan.GOLONGAN_CETAK].sort());
      expect(Object.keys(h.ringkas.perSebabMasuk).sort()).toEqual([...layanan.SEBAB_MASUK].sort());
      const jumlah = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
      expect(h.ringkas.dokumen).toBe(h.dokumen.length);
      expect(jumlah(h.ringkas.perGolongan)).toBe(h.dokumen.length);
      expect(jumlah(h.ringkas.perSebabMasuk)).toBe(h.dokumen.length);
      expect(jumlah(h.ringkas.perJurusita)).toBe(h.dokumen.length);
      expect(h.ringkas.tidakPerlu).toBe(h.tidakPerlu.length);
      expect(h.ringkas.tertunda).toBe(h.tertunda.length);
      expect(h.ringkas.sudahAdaRelaas).toBe(h.dokumen.filter((x) => x.sudahAdaRelaas === true).length);
      for (const g of layanan.GOLONGAN_CETAK) {
        expect(h.ringkas.perGolongan[g]).toBe(h.dokumen.filter((x) => x.golongan === g).length);
      }
    }
  });

  it("jumlah kueri per tanggal tetap sedikit", () => {
    for (const tanggal of SEMUA_TANGGAL) {
      // 5 jalan masuk (a)-(e) + penunjukan, NIP, pihak, relaas, pemberitahuan.
      expect(kueriPerTanggal[tanggal], tanggal).toBeLessThanOrEqual(10);
      expect(kueriPerTanggal[tanggal], tanggal).toBeGreaterThanOrEqual(5);
    }
  });
});

// ===========================================================================
// (a) DIDAFTARKAN - DICOCOKKAN DENGAN SQL YANG BERDIRI SENDIRI
// ===========================================================================

describe.skipIf(!ADA_MYSQL)("(a) perkara yang didaftarkan atau ditetapkan hari sidangnya", () => {
  /**
   * Harapan dihitung di sini dari data mentah: perkara lewat OR atas LEFT JOIN
   * (layanan memakai UNION), seluruh jadwalnya dibaca, lalu aturannya
   * diterapkan di JS:
   *   PHS ULANG  PHS pada T menetapkan jadwal bernomor > 1 yang bertanggal
   *              perkara_penetapan.sidang_pertama dan jatuh sesudah T,
   *              sedangkan sidang ke-1 tidak sesudah T -> jadwal itu yang
   *              dipanggil (golongan sidang-ditunda, kedua pihak);
   *   selain itu jadwal ke-1;
   *   tanpa jadwal, atau jadwalnya baru diinput SESUDAH T -> tertunda
   *   "jadwal-pertama-belum-ada"; sidangnya tidak sesudah T -> tertunda
   *   "sidang-pertama-sudah-lewat"; sisanya dokumen.
   */
  function harapanDaftar() {
    const perkara = jalankanSql(
      `SELECT p.perkara_id AS perkaraId, p.tanggal_pendaftaran AS tDaftar,
              pp.penetapan_hari_sidang AS tPhs, pp.sidang_pertama AS tSidangPhs
         FROM perkara p
         LEFT JOIN perkara_penetapan pp ON pp.perkara_id = p.perkara_id
        WHERE p.tanggal_pendaftaran IN (${daftarTanggalSql()})
           OR pp.penetapan_hari_sidang IN (${daftarTanggalSql()})`,
      []
    );
    const jadwal = jalankanSql(
      `SELECT perkara_id AS perkaraId, id, urutan, tanggal_sidang AS t, DATE(diinput_tanggal) AS masuk
         FROM perkara_jadwal_sidang WHERE perkara_id IN (?)`,
      [perkara.map((b) => Number(b.perkaraId))]
    );
    const hasilnya: Record<string, { dok: Map<number, { d: number; golongan: string }>; tunda: Map<number, string> }> = {};
    for (const tanggal of SEMUA_TANGGAL) {
      const dok = new Map<number, { d: number; golongan: string }>();
      const tunda = new Map<number, string>();
      for (const b of perkara.filter((x) => x.tDaftar === tanggal || x.tPhs === tanggal)) {
        const id = Number(b.perkaraId);
        const milik = jadwal.filter((j) => Number(j.perkaraId) === id);
        const satu = milik.find((j) => j.urutan === "1");
        const phs = milik
          .filter((j) => Number(j.urutan) > 1 && j.t === b.tSidangPhs)
          .sort((x, y) => Number(x.urutan) - Number(y.urutan))[0];
        const ulang =
          b.tPhs === tanggal && phs && String(phs.t) > tanggal && (!satu || !satu.t || String(satu.t) <= tanggal);
        const tujuan = ulang ? phs : satu;
        if (!tujuan || String(tujuan.masuk) > tanggal) tunda.set(id, "jadwal-pertama-belum-ada");
        else if (!tujuan.t || String(tujuan.t) <= tanggal) tunda.set(id, "sidang-pertama-sudah-lewat");
        else dok.set(id, { d: Number(tujuan.urutan), golongan: ulang ? "sidang-ditunda" : "sidang-pertama" });
      }
      hasilnya[tanggal] = { dok, tunda };
    }
    return hasilnya;
  }

  it("dokumen dan tertunda (a) sama dengan aturan yang dihitung dari data mentah", () => {
    const harapan = harapanDaftar();
    let jumlahDiperiksa = 0;
    for (const tanggal of SEMUA_TANGGAL) {
      const h = hasil[tanggal];
      const { dok, tunda } = harapan[tanggal];
      const dariLayanan = h.dokumen.filter((x) => x.sebabMasuk === "didaftarkan");
      expect(dariLayanan.map((x) => x.perkaraId).sort(), `didaftarkan pada ${tanggal}`).toEqual([...dok.keys()].sort());
      for (const x of dariLayanan) {
        const harap = dok.get(x.perkaraId);
        expect({ d: x.d, golongan: x.golongan }, `${tanggal} ${x.kunci}`).toEqual(harap);
        expect(x.pihakDipanggil).toBe("keduanya");
        expect(x.sidangAsalId).toBeNull();
      }
      const tundaLayanan = h.tertunda.filter(
        (x) => x.sebab === "jadwal-pertama-belum-ada" || x.sebab === "sidang-pertama-sudah-lewat"
      );
      expect(
        tundaLayanan.map((x) => `${x.perkaraId}:${x.sebab}`).sort(),
        `tertunda (a) pada ${tanggal}`
      ).toEqual([...tunda.entries()].map(([id, sebab]) => `${id}:${sebab}`).sort());
      jumlahDiperiksa += dok.size + tunda.size;
    }
    // Diukur 25 September 2026: 25 + 24 + 6 + 3 + 5 + 1 + ... perkara.
    expect(jumlahDiperiksa).toBeGreaterThanOrEqual(60);
  });

  it("perkara yang didaftarkan TANPA PHS setanggal tetap masuk pada hari pendaftarannya (sebagai tertunda bila jadwalnya belum ada)", () => {
    // Semula 10 Sep 2026 (10112-10116); sejak impor ulang 9 Okt kelimanya
    // berjadwal ke-1 setanggal - lihat catatan di atas TANGGAL.
    //
    // 30 Jun 2026: 180/Pdt.P/2026 (9891) didaftarkan tanpa jadwal ke-1 PADA
    // HARI ITU - jadwalnya baru diinput 15 Jul. Tanpa jalan "didaftarkan" ia
    // tidak muncul di mana pun pada tanggal ini.
    const h = hasil[TANGGAL.daftarTanpaPhs];
    const belumAda = h.tertunda.filter((x) => x.sebab === "jadwal-pertama-belum-ada");
    expect(belumAda.map((x) => x.perkaraId)).toEqual([9891]);
    expect(h.dokumen.some((x) => x.perkaraId === 9891)).toBe(false);
    // Bukan di dua tanggal: jadwal ke-1 9891 diinput 15 Jul UNTUK sidang 15 Jul
    // itu sendiri (pencatatan susulan), jadi pada hari inputnya pun ia bukan
    // dokumen "didaftarkan" - dan di seluruh tanggal paling banyak sekali.
    const phs = hasil[TANGGAL.phsTanpaDaftar];
    expect(phs.dokumen.filter((x) => x.perkaraId === 9891 && x.sebabMasuk === "didaftarkan")).toHaveLength(0);
    const didaftarkan = SEMUA_TANGGAL.flatMap((t) => hasil[t].dokumen.filter((x) => x.perkaraId === 9891 && x.sebabMasuk === "didaftarkan"));
    expect(didaftarkan.length).toBeLessThanOrEqual(1);
  });
});

// ===========================================================================
// (b) DITUNDA - SIDANG TUJUAN, BUKAN SIDANG ASAL
// ===========================================================================

describe.skipIf(!ADA_MYSQL)("(b) sidang hari itu yang punya sidang berikutnya", () => {
  it("dokumen ditunda + tidakPerlu dari (b) = seluruh sidang pada T yang bersidang berikutnya", () => {
    // "Sidang berikutnya" di sini menurut KRONOLOGI (tanggal lalu id), bukan
    // urutan+1 seperti di layanan - dua rumusan yang harus bertemu.
    const baris = jalankanSql(
      `SELECT j.tanggal_sidang AS t, j.id AS asal, j.dihadiri_oleh AS hadir,
              (SELECT n.id FROM perkara_jadwal_sidang n
                WHERE n.perkara_id = j.perkara_id
                  AND (n.tanggal_sidang > j.tanggal_sidang
                       OR (n.tanggal_sidang = j.tanggal_sidang AND n.id > j.id))
                ORDER BY n.tanggal_sidang, n.id LIMIT 1) AS tujuan
         FROM perkara_jadwal_sidang j
        WHERE j.tanggal_sidang IN (${daftarTanggalSql()})`,
      []
    );
    let jumlahDiperiksa = 0;
    for (const tanggal of SEMUA_TANGGAL) {
      const h = hasil[tanggal];
      const sql = baris.filter((b) => b.t === tanggal && b.tujuan !== null);
      const asalHariIni = new Set(
        baris.filter((b) => b.t === tanggal).map((b) => Number(b.asal))
      );
      const dariDokumen = h.dokumen
        .filter((x) => x.sebabMasuk === "ditunda")
        .map((x) => `${x.sidangAsalId}>${x.sidangId}`);
      const dariTidakPerlu = h.tidakPerlu
        .filter((x) => x.golongan !== "pemberitahuan-putusan" && asalHariIni.has(Number(x.sidangAsalId)))
        .map((x) => `${x.sidangAsalId}`);
      const harap = sql.map((b) => `${b.asal}>${b.tujuan}`);
      // Setiap dokumen (b) menunjuk pasangan asal>tujuan yang sama dengan SQL.
      for (const pasangan of dariDokumen) expect(harap, `${tanggal} ${pasangan}`).toContain(pasangan);
      // Dan jumlahnya lengkap: dokumen + tidakPerlu = sidang bersidang berikutnya.
      expect(dariDokumen.length + dariTidakPerlu.length, `(b) pada ${tanggal}`).toBe(sql.length);
      // tidakPerlu (b) hanya untuk semua-hadir (sandi 1) atau sidang tujuan sehari.
      for (const x of h.tidakPerlu.filter(
        (y) => y.golongan !== "pemberitahuan-putusan" && asalHariIni.has(Number(y.sidangAsalId))
      )) {
        const b = sql.find((s) => Number(s.asal) === Number(x.sidangAsalId));
        expect(b, `${tanggal} tidakPerlu ${x.sidangAsalId}`).toBeDefined();
        if (x.sebab === "semua-pihak-hadir") expect(b?.hadir).toBe("1");
      }
      jumlahDiperiksa += sql.length;
    }
    // Diukur 25 September 2026: 4 + 16 + 10 + 2 + ... sidang.
    expect(jumlahDiperiksa).toBeGreaterThanOrEqual(30);
  });

  it("d = nomor sidang TUJUAN yang sungguh ada di perkara itu, dan sidang asal bernomor d-1", () => {
    const panggilan = SEMUA_TANGGAL.flatMap((t) =>
      hasil[t].dokumen.filter((x) => x.golongan !== "pemberitahuan-putusan").map((x) => ({ t, x }))
    );
    const ids = [
      ...new Set(
        panggilan.flatMap(({ x }) => [x.sidangId, x.sidangAsalId]).filter((n): n is number => !!n)
      ),
    ];
    const jadwal = new Map(
      jalankanSql(
        `SELECT id, perkara_id AS perkaraId, urutan, tanggal_sidang AS tanggal
           FROM perkara_jadwal_sidang WHERE id IN (?)`,
        [ids]
      ).map((b) => [Number(b.id), b])
    );
    let ditunda = 0;
    for (const { t, x } of panggilan) {
      const tujuan = jadwal.get(Number(x.sidangId));
      expect(tujuan, `${t} ${x.kunci}`).toBeDefined();
      expect(Number(tujuan?.perkaraId)).toBe(x.perkaraId);
      expect(x.d, `${t} ${x.kunci}`).toBe(Number(tujuan?.urutan));
      expect(x.tanggalSidangTujuan).toBe(tujuan?.tanggal);
      if (x.sebabMasuk === "ditunda") {
        ditunda += 1;
        const asal = jadwal.get(Number(x.sidangAsalId));
        expect(asal?.tanggal, `${t} ${x.kunci}`).toBe(t);
        expect(Number(asal?.urutan), `${t} ${x.kunci}`).toBe((x.d ?? 0) - 1);
      }
    }
    expect(ditunda).toBeGreaterThan(10);
  });

  it("sandi 1 menjadi dokumen HANYA bila alasan penundaan/agenda menyebut panggilan - pihaknya ditanyakan", () => {
    // Sandi 1 ("Semua Pihak") juga nilai BAWAAN borang SIPP (tanpa opsi
    // kosong). Alasan penundaan sidang asal dan agenda sidang berikutnya
    // dibaca SENDIRI di sini, bukan dari layanan.
    const baris = jalankanSql(
      `SELECT j.id AS asal, j.alasan_ditunda AS alasan, n.agenda AS agenda
         FROM perkara_jadwal_sidang j
         JOIN perkara_jadwal_sidang n ON n.perkara_id = j.perkara_id AND n.urutan = j.urutan + 1
        WHERE j.dihadiri_oleh = 1 AND j.tanggal_sidang IN (${daftarTanggalSql()})`,
      []
    );
    const sebutPanggil = new Map(
      baris.map((b) => [Number(b.asal), /anggil/i.test(String(b.alasan ?? "")) || /anggil/i.test(String(b.agenda ?? ""))])
    );
    let ditanyakan = 0;
    let semuaHadir = 0;
    for (const tanggal of SEMUA_TANGGAL) {
      const h = hasil[tanggal];
      // Ikrar talak selalu memanggil kedua pihak, apa pun sandinya - di luar penjaga ini.
      for (const x of h.dokumen.filter(
        (y) => y.sebabMasuk === "ditunda" && y.golongan === "sidang-ditunda" && Number(y.dihadiriOleh) === 1
      )) {
        expect(sebutPanggil.get(Number(x.sidangAsalId)), `${tanggal} ${x.kunci}`).toBe(true);
        expect(x.pihakDipanggil).toBe("tidak-diketahui");
        expect(x.keterangan.join(" ")).toMatch(/"[^"]*anggil[^"]*"/i);
        ditanyakan += 1;
      }
      for (const x of h.tidakPerlu.filter((y) => y.sebab === "semua-pihak-hadir" && y.golongan !== "pemberitahuan-putusan")) {
        if (sebutPanggil.has(Number(x.sidangAsalId))) {
          expect(sebutPanggil.get(Number(x.sidangAsalId)), `${tanggal} ${x.nomorPerkara}`).toBe(false);
        }
      }
      semuaHadir += h.tidakPerlu.filter((x) => x.sebab === "semua-pihak-hadir").length;
    }
    // 88/Pdt.G/2026 (9422), 5 Feb 2026: sandi 1, alasan "Panggil Tergugat" -
    // SIPP mencatat relaas pos ke Tergugat untuk sidang 19 Feb.
    const h88 = hasil[TANGGAL.sandiSatuPanggil];
    const d88 = h88.dokumen.find((x) => x.perkaraId === 9422);
    expect(d88).toMatchObject({ golongan: "sidang-ditunda", d: 2, sidangAsalId: 18342, pihakDipanggil: "tidak-diketahui" });
    expect(d88?.keterangan.join(" ")).toContain('"Panggil Tergugat"');
    expect(h88.tidakPerlu.some((x) => x.perkaraId === 9422)).toBe(false);
    expect(ditanyakan).toBeGreaterThanOrEqual(1);
    // Diukur 25 September 2026: 2 + 7 + 14 + 7 + 2 + 5 + ... - harus ada.
    expect(semuaHadir).toBeGreaterThan(20);
  });

  it("pihak mengikuti sandi sidang asalnya, kecuali keadaan khusus yang DIKATAKAN keterangannya; ikrar talak selalu keduanya", () => {
    let biasa = 0;
    for (const tanggal of SEMUA_TANGGAL) {
      for (const x of hasil[tanggal].dokumen) {
        const ket = x.keterangan.join(" ");
        if (x.golongan === "ikrar-talak" || x.golongan === "sidang-pertama") {
          expect(x.pihakDipanggil, `${tanggal} ${x.kunci}`).toBe("keduanya");
          continue;
        }
        if (x.golongan === "sidang-ditunda" && /ULANG/.test(ket)) {
          expect(x.pihakDipanggil).toBe("keduanya");
          continue;
        }
        if (x.golongan === "sidang-ditunda" && (/sesudah putusan/.test(ket) || /anggil/i.test(ket))) {
          expect(x.pihakDipanggil).toBe("tidak-diketahui");
          continue;
        }
        expect(Number(x.dihadiriOleh), `${tanggal} ${x.kunci}`).not.toBe(1);
        expect(x.pihakDipanggil, `${tanggal} ${x.kunci}`).toBe(pihakDariPohon(x.dihadiriOleh));
        biasa += 1;
      }
    }
    expect(biasa).toBeGreaterThan(30);
  });
});

// ===========================================================================
// (c) JARING - JADWAL YANG DIINPUT HARI ITU
// ===========================================================================

describe.skipIf(!ADA_MYSQL)("(c) jaring jadwal baru", () => {
  it("penetapan hari sidang ikrar talak yang diinput hari itu tertangkap", () => {
    // 18 Agu 2026: jadwal 19902 (perkara 9850, ikrar talak 2 Sep) diinput hari
    // itu; sidang sebelumnya 3 Agu, jadi (b) tidak mencakupnya.
    const h = hasil[TANGGAL.jaring];
    const jaring = h.dokumen.filter((x) => x.sebabMasuk === "jadwal-baru");
    expect(jaring.map((x) => x.sidangId)).toEqual([19902]);
    expect(jaring[0]).toMatchObject({ golongan: "ikrar-talak", d: 10, pihakDipanggil: "keduanya" });
  });

  it("jadwal yang diinput untuk sidang hari itu juga (pencatatan susulan) BUKAN panggilan", () => {
    // 4 Sep 2026: jadwal 20050-20053 diinput "admin" pukul 22.44-22.49 untuk
    // sidang pagi itu; 20052 sandi sidang sebelumnya 4, jadi tanpa penyempitan
    // ia akan menjadi dokumen "keduanya" untuk sidang yang sudah lewat.
    for (const tanggal of [TANGGAL.putusanPdtP, TANGGAL.jaring]) {
      const h = hasil[tanggal];
      for (const susulan of [20050, 20051, 20052, 20053, 19898]) {
        expect(h.dokumen.some((x) => x.sidangId === susulan), `${tanggal} ${susulan}`).toBe(false);
      }
    }
    expect(hasil[TANGGAL.putusanPdtP].catatan.join(" ")).toContain("pencatatan susulan");
  });
});

// ===========================================================================
// (d) DIPUTUS
// ===========================================================================

describe.skipIf(!ADA_MYSQL)("(d) putusan hari itu", () => {
  it("setiap putusan pada T menjadi satu dokumen ATAU satu tidakPerlu (sandi 1)", () => {
    const baris = jalankanSql(
      `SELECT pu.tanggal_putusan AS t, pu.perkara_id AS perkaraId,
              (SELECT j.dihadiri_oleh FROM perkara_jadwal_sidang j
                WHERE j.perkara_id = pu.perkara_id AND j.tanggal_sidang = pu.tanggal_putusan
                ORDER BY j.urutan DESC LIMIT 1) AS hadir
         FROM perkara_putusan pu
        WHERE pu.tanggal_putusan IN (${daftarTanggalSql()})`,
      []
    );
    let diperiksa = 0;
    for (const tanggal of SEMUA_TANGGAL) {
      const h = hasil[tanggal];
      const sql = baris.filter((b) => b.t === tanggal);
      const harapTidakPerlu = sql.filter((b) => b.hadir === "1").map((b) => Number(b.perkaraId)).sort();
      const harapDok = sql.filter((b) => b.hadir !== "1").map((b) => Number(b.perkaraId)).sort();
      const dok = h.dokumen
        .filter((x) => x.golongan === "pemberitahuan-putusan")
        .map((x) => x.perkaraId)
        .sort();
      const tp = h.tidakPerlu
        .filter((x) => x.golongan === "pemberitahuan-putusan")
        .map((x) => x.perkaraId)
        .sort();
      expect(dok, `pemberitahuan pada ${tanggal}`).toEqual(harapDok);
      expect(tp, `tidak perlu diberi tahu pada ${tanggal}`).toEqual(harapTidakPerlu);
      diperiksa += sql.length;
    }
    // Diukur 25 September 2026: 3 + 11 + 18 + 2 + ... putusan.
    expect(diperiksa).toBeGreaterThanOrEqual(30);
  });

  it("putusan yang sandi pembacaannya kosong tetap dokumen, dan pihaknya ditanyakan", () => {
    const h = hasil[TANGGAL.putusanPdtP];
    const takTahu = h.dokumen.filter((x) => x.pihakDipanggil === "tidak-diketahui");
    expect(takTahu.map((x) => x.perkaraId).sort()).toEqual([10042, 10043, 10044, 10045]);
    for (const x of takTahu) expect(x.dihadiriOleh).toBeNull();
  });
});

// ===========================================================================
// TERTUNDA - SIDANG TANPA HASIL YANG TERCATAT
// ===========================================================================

describe.skipIf(!ADA_MYSQL)("tertunda", () => {
  it("sidang tanpa sidang berikutnya, tanpa putusan, dan bukan ikrar yang selesai = tertunda", () => {
    const baris = jalankanSql(
      `SELECT j.tanggal_sidang AS t, COUNT(*) AS n
         FROM perkara_jadwal_sidang j
        WHERE j.tanggal_sidang IN (${daftarTanggalSql()})
          AND NOT EXISTS (SELECT 1 FROM perkara_jadwal_sidang n
                           WHERE n.perkara_id = j.perkara_id
                             AND (n.tanggal_sidang > j.tanggal_sidang
                                  OR (n.tanggal_sidang = j.tanggal_sidang AND n.id > j.id)))
          AND NOT EXISTS (SELECT 1 FROM perkara_putusan pu
                           WHERE pu.perkara_id = j.perkara_id AND pu.tanggal_putusan <= j.tanggal_sidang)
          AND NOT (j.ikrar_talak = 'Y' AND EXISTS (SELECT 1 FROM perkara_ikrar_talak it
                           WHERE it.perkara_id = j.perkara_id AND it.tgl_ikrar_talak IS NOT NULL))
        GROUP BY j.tanggal_sidang`,
      []
    );
    for (const tanggal of SEMUA_TANGGAL) {
      const harap = Number(baris.find((b) => b.t === tanggal)?.n ?? 0);
      const hasilnya = hasil[tanggal].tertunda.filter((x) => x.sebab === "hasil-sidang-belum-dicatat");
      expect(hasilnya.length, `tertunda pada ${tanggal}`).toBe(harap);
      for (const x of hasil[tanggal].tertunda) expect(x.keterangan.length).toBeGreaterThan(20);
    }
    // 15 Okt 2026 sesudah data terakhir (impor ulang 9 Okt; semula 22 Sep
    // dengan 22 sidang): 40 sidang, semuanya tertunda.
    expect(hasil[TANGGAL.sesudahData].tertunda.length).toBe(40);
    expect(hasil[TANGGAL.sesudahData].dokumen.length).toBe(0);
  });
});

// ===========================================================================
// JURU SITA DAN SUDAH-ADA-RELAAS
// ===========================================================================

describe.skipIf(!ADA_MYSQL)("juru sita dan relaas yang sudah tercatat", () => {
  it("juru sita tiap dokumen dari penunjukan AKTIF perkaranya - bukan yang sudah diganti", () => {
    const perkaraIds = [
      ...new Set(SEMUA_TANGGAL.flatMap((t) => hasil[t].dokumen.map((x) => x.perkaraId))),
    ];
    const baris = jalankanSql(
      `SELECT perkara_id AS perkaraId, jurusita_nama AS nama, aktif
         FROM perkara_jurusita WHERE perkara_id IN (?)`,
      [perkaraIds]
    );
    let diperiksa = 0;
    for (const tanggal of SEMUA_TANGGAL) {
      for (const x of hasil[tanggal].dokumen) {
        const aktif = baris
          .filter((b) => Number(b.perkaraId) === x.perkaraId && b.aktif === "Y")
          .map((b) => kunciNama(String(b.nama)));
        if (aktif.length === 0) {
          expect(x.jurusita).toMatchObject({ nama: "tidak tercatat", dariPenunjukan: false });
          continue;
        }
        diperiksa += 1;
        expect(x.jurusita.dariPenunjukan).toBe(true);
        expect(aktif, `${tanggal} ${x.kunci} ${x.jurusita.nama}`).toContain(kunciNama(x.jurusita.nama));
      }
    }
    expect(diperiksa).toBeGreaterThan(50);
    // Perkara 9262: Mustini (tidak aktif, id lebih kecil) lawan Tanty Restianty.
    const d9262 = hasil[TANGGAL.penunjukanTakAktif].dokumen.find((x) => x.perkaraId === 9262);
    expect(d9262?.jurusita.nama).toBe("Tanty Restianty");
  });

  it("satu orang satu ejaan dalam satu jawaban - ia menjadi nama folder", () => {
    for (const tanggal of SEMUA_TANGGAL) {
      const perKunci = new Map<string, Set<string>>();
      for (const x of hasil[tanggal].dokumen) {
        const k = kunciNama(x.jurusita.nama);
        if (!perKunci.has(k)) perKunci.set(k, new Set());
        perKunci.get(k)?.add(x.jurusita.nama);
      }
      for (const [k, ejaan] of perKunci) expect(ejaan.size, `${tanggal} ${k}`).toBe(1);
    }
  });

  it("sudahAdaRelaas true hanya bila relaas/pemberitahuan sungguh tercatat di SIPP", () => {
    const panggilan = SEMUA_TANGGAL.flatMap((t) =>
      hasil[t].dokumen.filter((x) => x.golongan !== "pemberitahuan-putusan")
    );
    const relaas = jalankanSql(
      `SELECT sidang_id AS sidangId, perkara_id AS perkaraId, COUNT(*) AS n
         FROM perkara_pelaksanaan_relaas WHERE sidang_id IN (?)
        GROUP BY sidang_id, perkara_id`,
      [[...new Set(panggilan.map((x) => x.sidangId))]]
    );
    const ada = new Set(relaas.map((b) => `${b.sidangId}:${b.perkaraId}`));
    let benar = 0;
    let salah = 0;
    for (const x of panggilan) {
      if (!ada.has(`${x.sidangId}:${x.perkaraId}`)) {
        expect(x.sudahAdaRelaas, x.kunci).not.toBe(true);
        salah += 1;
      }
      if (x.sudahAdaRelaas === true) {
        expect(ada.has(`${x.sidangId}:${x.perkaraId}`), x.kunci).toBe(true);
        benar += 1;
      }
    }
    // Keduanya harus terjadi, kalau tidak penjaganya tidak menjaga apa pun.
    expect(benar).toBeGreaterThan(0);
    expect(salah).toBeGreaterThan(0);
  });
});

// ===========================================================================
// TELAAH 25 SEPTEMBER 2026 - DIJALANKAN ATAS DATA SUNGGUHAN
// ===========================================================================

describe.skipIf(!ADA_MYSQL)("telaah 25 September 2026", () => {
  it("PHS ulang: yang dipanggil sidang yang DITETAPKAN (ke-3, 29 Jul), bukan sidang ke-1 yang sudah lewat", () => {
    const h = hasil[TANGGAL.phsUlang];
    const d = h.dokumen.filter((x) => x.perkaraId === 9729);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({
      golongan: "sidang-ditunda",
      sebabMasuk: "didaftarkan",
      d: 3,
      sidangId: 19615,
      tanggalSidangTujuan: "2026-07-29",
      pihakDipanggil: "keduanya",
    });
    expect(d[0].keterangan.join(" ")).toContain("ULANG");
    // Jaring (c) tidak lagi menilai sidang ke-3 dari kehadiran sidang lama.
    expect(h.tidakPerlu.some((x) => x.perkaraId === 9729)).toBe(false);
  });

  it("tidak ada panggilan untuk sidang yang tidak sesudah hari cetak - di tanggal mana pun, di kelompok mana pun", () => {
    let diperiksa = 0;
    for (const tanggal of SEMUA_TANGGAL) {
      for (const x of [...hasil[tanggal].dokumen, ...hasil[tanggal].hariKerjaSebelumnya.dokumen]) {
        if (x.golongan === "pemberitahuan-putusan") continue;
        expect(x.tanggalSidangTujuan > tanggal, `${tanggal} ${x.kunci} -> ${x.tanggalSidangTujuan}`).toBe(true);
        diperiksa += 1;
      }
    }
    expect(diperiksa).toBeGreaterThan(80);
  });

  it("jadwal ke-1 yang baru diinput SESUDAH hari pendaftaran: tertunda di hari pendaftaran, dokumen di hari inputnya", () => {
    // Semula 10112 (baru diinput 2026-09-12); sejak impor ulang 9 Okt: 9891.
    const tunda = hasil[TANGGAL.daftarTanpaPhs].tertunda.find((x) => x.perkaraId === 9891);
    expect(tunda?.sebab).toBe("jadwal-pertama-belum-ada");
    expect(tunda?.keterangan).toContain("baru diinput 2026-07-15");
  });

  it("sidang ikrar tanpa penanda ikrar_talak dikenali dari agendanya", () => {
    // 578/Pdt.G/2025: jadwal 18212 (19 Jan 2026) beragenda "Sidang Ikrar
    // Talak", ikrar_talak 'T', jatuh sesudah putusan 17 Des 2025, diinput 5 Jan.
    const d = hasil[TANGGAL.penunjukanTakAktif].dokumen.find((x) => x.sidangId === 18212);
    expect(d).toMatchObject({ golongan: "ikrar-talak", pihakDipanggil: "keduanya", sebabMasuk: "jadwal-baru" });
    expect(d?.keterangan.join(" ")).toContain("Sidang Ikrar Talak");
  });

  it("status putusan tiap pemberitahuan = status_putusan.nama atas id-nya; 19/Pdt.G/2026 'Dicabut'", () => {
    const pbt = SEMUA_TANGGAL.flatMap((t) =>
      hasil[t].dokumen.filter((x) => x.golongan === "pemberitahuan-putusan").map((x) => ({ t, x }))
    );
    const baris = jalankanSql(
      `SELECT pu.perkara_id AS perkaraId, pu.tanggal_putusan AS t, pu.status_putusan_id AS id, sp.nama AS nama
         FROM perkara_putusan pu LEFT JOIN status_putusan sp ON sp.id = pu.status_putusan_id
        WHERE pu.perkara_id IN (?)`,
      [[...new Set(pbt.map(({ x }) => x.perkaraId))]]
    );
    for (const { t, x } of pbt) {
      const b = baris.find((y) => Number(y.perkaraId) === x.perkaraId && y.t === t);
      expect(x.statusPutusanNama, `${t} ${x.kunci}`).toBe(b?.nama ?? "");
      expect(x.statusPutusanId, `${t} ${x.kunci}`).toBe(b?.id ? Number(b.id) : null);
    }
    expect(hasil[TANGGAL.dicabut].dokumen.find((x) => x.perkaraId === 9344)).toMatchObject({
      statusPutusanId: 67,
      statusPutusanNama: "Dicabut",
    });
    expect(pbt.length).toBeGreaterThan(20);
  });

  it("pemberitahuan: baris tanpa tanggal DAN tanpa berkas PBT bukan tanda sudah diberitahukan", () => {
    const pbt = SEMUA_TANGGAL.flatMap((t) =>
      hasil[t].dokumen.filter((x) => x.golongan === "pemberitahuan-putusan" && x.pihakKe !== null).map((x) => ({ t, x }))
    );
    const baris = jalankanSql(
      `SELECT perkara_id AS perkaraId, pihak, tanggal_pemberitahuan_putusan AS tgl, edoc_pbt AS edoc
         FROM perkara_putusan_pemberitahuan_putusan WHERE perkara_id IN (?)`,
      [[...new Set(pbt.map(({ x }) => x.perkaraId))]]
    );
    let benar = 0;
    for (const { t, x } of pbt) {
      const milik = baris.filter((b) => Number(b.perkaraId) === x.perkaraId && Number(b.pihak) === x.pihakKe);
      const sah = milik.filter((b) => (b.tgl !== null && String(b.tgl) >= t) || (b.tgl === null && String(b.edoc ?? "").trim() !== ""));
      if (x.sudahAdaRelaas === true) {
        expect(sah.length, `${t} ${x.kunci}`).toBeGreaterThan(0);
        benar += 1;
      }
      if (milik.length > 0 && sah.length === 0) expect(x.sudahAdaRelaas, `${t} ${x.kunci}`).not.toBe(true);
    }
    // 246/Pdt.G/2026 (20 Mei 2026): kedua barisnya kosong - BELUM.
    const d246 = hasil[TANGGAL.pbtKosong].dokumen.find((x) => x.nomorPerkara === "246/Pdt.G/2026/PA.Dgl");
    expect(d246?.golongan).toBe("pemberitahuan-putusan");
    expect(d246?.sudahAdaRelaas).toBe(false);
    expect(benar).toBeGreaterThan(0);
  });

  it("jumlahPihakSasaran = baris pihak pada sisi yang dipanggil; kelebihan atas muatan blangko disebut di catatan", () => {
    const semua = SEMUA_TANGGAL.flatMap((t) => hasil[t].dokumen.map((x) => ({ t, x })));
    const hitung = jalankanSql(
      `SELECT perkara_id AS perkaraId, 1 AS sisi, COUNT(*) AS n FROM perkara_pihak1 WHERE perkara_id IN (?) GROUP BY perkara_id
       UNION ALL
       SELECT perkara_id, 2, COUNT(*) FROM perkara_pihak2 WHERE perkara_id IN (?) GROUP BY perkara_id`,
      [[...new Set(semua.map(({ x }) => x.perkaraId))], [...new Set(semua.map(({ x }) => x.perkaraId))]]
    );
    const n = (id: number, sisi: number) =>
      Number(hitung.find((b) => Number(b.perkaraId) === id && Number(b.sisi) === sisi)?.n ?? 0);
    for (const { t, x } of semua) {
      const sisi = x.pihakDipanggil === "keduanya" ? [1, 2] : x.pihakDipanggil === "pertama" ? [1] : x.pihakDipanggil === "kedua" ? [2] : [];
      const harap = sisi.length ? sisi.reduce((a, s) => a + n(x.perkaraId, s), 0) : null;
      expect(x.jumlahPihakSasaran, `${t} ${x.kunci}`).toBe(harap);
    }
    const h = hasil[TANGGAL.banyakPihak];
    // 18/Pdt.G/2026: satu Penggugat, ENAM Tergugat.
    expect(h.dokumen.find((x) => x.perkaraId === 9343)).toMatchObject({
      golongan: "sidang-pertama",
      jumlahPihak: { pertama: 1, kedua: 6, lain: 0 },
      jumlahPihakSasaran: 7,
    });
    // 1/Pdt.P/2026: tiga Pemohon, blangko permohonan memuat Pemohon I-II.
    expect(h.dokumen.find((x) => x.perkaraId === 9348)?.jumlahPihak?.pertama).toBe(3);
    const kalimat = h.catatan.find((c) => c.includes("pihak lain perlu relaas sendiri")) ?? "";
    const [, dok, lain] = kalimat.match(/^(\d+) dokumen .*; (\d+) pihak lain/) ?? [];
    expect(Number(dok)).toBeGreaterThanOrEqual(2);
    expect(Number(lain)).toBeGreaterThanOrEqual(5 + 1);
  });

  it("dari hari kerja sebelumnya: jalan (b) tanggal sidang terakhir sebelum T, TERPISAH dari dokumen dan ringkas", () => {
    const tanggal = TANGGAL.kemarinLengkap;
    const h = hasil[tanggal];
    expect(h.hariKerjaSebelumnya.tanggal).toBe("2026-08-18");
    const k = h.hariKerjaSebelumnya.dokumen;
    // SQL mandiri: sidang 18 Agu dengan sidang berikutnya MENURUT KRONOLOGI
    // yang dicatat SEBELUM 19 Agu dan jatuh SESUDAH 19 Agu; sandi 1 tanpa kata
    // "panggil" tidak dipanggil.
    const baris = jalankanSql(
      `SELECT j.id AS asal, j.dihadiri_oleh AS hadir, j.alasan_ditunda AS alasan,
              n.id AS tujuan, n.agenda AS agenda, n.tanggal_sidang AS t, n.diinput_tanggal AS masuk
         FROM perkara_jadwal_sidang j
         JOIN perkara_jadwal_sidang n ON n.id = (
               SELECT m.id FROM perkara_jadwal_sidang m
                WHERE m.perkara_id = j.perkara_id
                  AND (m.tanggal_sidang > j.tanggal_sidang OR (m.tanggal_sidang = j.tanggal_sidang AND m.id > j.id))
                ORDER BY m.tanggal_sidang, m.id LIMIT 1)
        WHERE j.tanggal_sidang = '2026-08-18'`,
      []
    );
    const harap = baris
      .filter((b) => String(b.masuk) < tanggal && String(b.t) > tanggal)
      .filter((b) => b.hadir !== "1" || /anggil/i.test(`${b.alasan ?? ""} ${b.agenda ?? ""}`))
      .map((b) => `${b.asal}>${b.tujuan}`)
      .sort();
    expect(k.map((x) => `${x.sidangAsalId}>${x.sidangId}`).sort()).toEqual(harap);
    expect(k.length).toBeGreaterThan(3);
    // Terpisah: tidak ada kunci/sidang yang juga di dokumen hari ini, dan ringkas hanya hari ini.
    const kunciHariIni = new Set(h.dokumen.map((x) => x.kunci));
    for (const x of k) {
      expect(kunciHariIni.has(x.kunci)).toBe(false);
      expect(x.keterangan[0]).toMatch(/^Dari sidang ke-\d+ tanggal 2026-08-18; jadwal sidang ke-\d+ dicatat 2026-08-18 pukul \d{2}\.\d{2}\./);
      expect(x.jurusita.nama.length).toBeGreaterThan(0);
    }
    expect(h.ringkas.dokumen).toBe(h.dokumen.length);
    // sudahAdaRelaas ikut dinilai: di tanggal ini sebagian besar sudah tercetak kemarin.
    expect(k.filter((x) => x.sudahAdaRelaas === true).length).toBeGreaterThan(0);
    expect(k.filter((x) => x.sudahAdaRelaas === false).length).toBeGreaterThan(0);
    // Di tanggal mana pun kelompok ini tidak berbagi sidang tujuan dengan dokumen hari itu.
    for (const t of SEMUA_TANGGAL) {
      const tujuanHariIni = new Set(hasil[t].dokumen.map((x) => x.sidangId));
      for (const x of hasil[t].hariKerjaSebelumnya.dokumen) expect(tujuanHariIni.has(x.sidangId), `${t} ${x.kunci}`).toBe(false);
    }
  });
});
