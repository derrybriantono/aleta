// @vitest-environment node
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ============================================================================
 * TOMBOL "TARIK DATA" SATU PERKARA DI KEPALA SIPP (21 Okt 2026)
 * ============================================================================
 *
 * Permintaan hakim: tombol tarik data di kepala SIPP (sebelah kiri "Selamat
 * datang <pengguna>") hanya di halaman perkara, menarik e-Court HANYA perkara
 * itu, dan tidak memberatkan penarikan utama yang dikerjakan admin.
 *
 * Empat lapis, semuanya DIJALANKAN (bukan menyisir teks):
 *
 *   A. layanan bot (ecourtTarikSatuService): kebijakan sela, antrean satu pintu,
 *      batas laju, bukan e-Court, jejak, dan SIMULASI dampak ke putaran utama;
 *   B. penjadwal: keadaanGiliran hanya membaca;
 *   C. rute portal: hak (kemampuan "permintaan"), paksa hanya Admin, jejak;
 *   D. tarik-satu-perkara.js di jsdom atas replika kepala SIPP sungguhan:
 *      posisi di kiri "Selamat Datang", hanya di halaman perkara, hak, paksa,
 *      kemajuan, selesai, bukan e-Court, tanpa kata merek ke halaman SIPP.
 *
 * ALETA_TANGKAP_TARIKSATU=<awalan> menyimpan HTML tiap keadaan untuk tangkapan
 * Playwright (docs/rancangan/tarik-satu-perkara-21okt/tangkap.mjs).
 */

const AKAR = path.resolve(process.cwd(), "..");
const baca = (b: string) => fs.readFileSync(path.join(AKAR, "ekstensi-sipp", b), "utf8").replace(/\r\n/g, "\n");

const AKAR_UJI = fs.mkdtempSync(path.join(process.env.TMP || os.tmpdir(), "aleta-tarik-satu-"));
process.env.ALETA_BOT_RUNTIME_CONFIG_PATH = path.join(AKAR_UJI, "aleta-runtime.json");
process.env.ALETA_ECOURT_SESSION_DIR = path.join(AKAR_UJI, "sesi");
process.env.ALETA_ECOURT_KREDENSIAL_DIR = path.join(AKAR_UJI, "sesi");
process.env.ALETA_BOT_DATA_DIR = path.join(AKAR_UJI, "data");
process.env.ALETA_ZONA_WAKTU = "Asia/Makassar";

const require_ = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const catatan: Array<Record<string, unknown>> = [];
function tiru(rel: string, exports: Record<string, unknown>) {
  const jalur = require_.resolve(path.join(AKAR, rel));
  require_.cache[jalur] = { id: jalur, filename: jalur, loaded: true, exports } as unknown as NodeJS.Module;
}
tiru("aleta_bot/services/logService.js", {
  logSecurityEvent: async (d: Record<string, unknown>) => void catatan.push(d),
  logSystemEvent: async (d: Record<string, unknown>) => void catatan.push(d),
});
tiru("aleta_bot/services/ecourtAuditArsipService.js", { periksaArsip: async () => ({ diperiksa: 0, dibuang: 0 }) });
tiru("aleta_bot/services/ecourtPermintaanService.js", { ambilBerikutnya: async () => null, tandaiSelesai: async () => ({}) });

// ============================================================================
// A. LAYANAN BOT
// ============================================================================
type Giliran = {
  aktif: boolean;
  sibuk: boolean;
  penarikanLain: boolean;
  memulihkan: boolean;
  berkalaBerikutnyaMs: number | null;
  pagiBerikutnyaMs: number | null;
};
type Hasil = {
  ok: boolean;
  hasil?: string;
  alasan?: string;
  pesan?: string;
  terakhirDetik?: number | null;
  sisaSegarDetik?: number;
  tarikan?: Record<string, any> | null;
};
type Layanan = {
  minta: (o: { nomorPerkara: string; olehSiapa?: string; paksa?: boolean }) => Promise<Hasil>;
  keadaan: (n: string) => Promise<Record<string, any>>;
  timbang: () => Promise<void>;
  tungguSelesai: (n: string) => Promise<void>;
  _antrean: () => string[];
  _berjalan: () => string;
};
const S = require_(path.join(AKAR, "aleta_bot/services/ecourtTarikSatuService.js")) as {
  BATAS_ANTREAN: number;
  BATAS_TARIK_MS: number;
  BATAS_TUNGGU_MS: number;
  JEDA_SEGAR_MS: number;
  JEDA_PAKSA_MIN_MS: number;
  MARGIN_MS: number;
  buatLayanan: (deps: Record<string, unknown>) => Layanan;
  putuskanGiliran: (o: Record<string, unknown>) => { mulai: boolean; alasan: string; keterangan: string };
  umurTeks: (d: number) => string;
};

const NOMOR = "684/Pdt.G/2026/PA.Dgl";
const NOMOR_B = "701/Pdt.G/2026/PA.Dgl";
const MENIT = 60_000;
const BEBAS: Giliran = { aktif: true, sibuk: false, penarikanLain: false, memulihkan: false, berkalaBerikutnyaMs: null, pagiBerikutnyaMs: null };

/** Dunia tiruan: jam, penjadwal, jembatan, SIPP, jejak. Tidak ada jaringan, basis data, atau peramban. */
function dunia(o: { ecourt?: Record<string, boolean>; siap?: boolean; kunjungan?: Record<string, number> } = {}) {
  const jam = { ms: Date.UTC(2026, 9, 21, 2, 0, 0) };
  const g: Giliran = { ...BEBAS };
  const jalan: Array<{ nomor: string; mulaiMs: number; opsi: Record<string, any> }> = [];
  const jejak: Array<{ jenis: string; t: Record<string, any>; berhasil?: boolean; catatan?: string }> = [];
  const nunggu: Array<(h: Record<string, unknown>) => void> = [];
  let berkasDokumen: Array<Record<string, unknown>> = [];
  const ecourt = o.ecourt ?? { [NOMOR]: true, [NOMOR_B]: true, "9/Pdt.P/2026/PA.Dgl": false };
  const deps = {
    sekarang: () => new Date(jam.ms),
    tanpaPewaktu: true,
    berkasSimpanan: null,
    kueriSipp: async (_sql: string, p: string[]) => {
      const n = String(p[0]);
      return n in ecourt ? [{ perkaraId: 1, nomorPerkara: n, ecourt: ecourt[n] ? 1 : 0 }] : [];
    },
    kunjunganTerakhir: async (n: string) => o.kunjungan?.[n] ?? 0,
    akunSiap: () => o.siap !== false,
    penjadwal: {
      keadaanGiliran: () => ({ ...g }),
      jalankan: (opsi: Record<string, any>) =>
        new Promise((selesai) => {
          jalan.push({ nomor: String(opsi.nomorPerkara), mulaiMs: jam.ms, opsi });
          nunggu.push(selesai as (h: Record<string, unknown>) => void);
        }),
    },
    potret: async () => ({ dokumen: berkasDokumen, jumlahBerkas: new Map<string, number>() }),
    jejak: {
      sisip: async (t: Record<string, any>) => void jejak.push({ jenis: "sisip", t: { ...t } }),
      mulai: async (t: Record<string, any>) => void jejak.push({ jenis: "mulai", t: { ...t } }),
      akhir: async (t: Record<string, any>, berhasil: boolean, catatan: string) => void jejak.push({ jenis: "akhir", t: { ...t }, berhasil, catatan }),
    },
  };
  const layanan = S.buatLayanan(deps);
  return {
    layanan,
    jam,
    g,
    jalan,
    jejak,
    /** Menyelesaikan tarikan yang sedang berjalan dengan hasil jembatan itu. */
    selesaikan: async (nomor: string, hasil: Record<string, unknown> = { dilewati: false, kode: 0, catatan: "Selesai." }) => {
      const f = nunggu.shift();
      if (!f) throw new Error("tidak ada tarikan yang berjalan");
      f(hasil);
      await layanan.tungguSelesai(nomor);
    },
    dokumenBaru: (judul: string[]) => {
      berkasDokumen = judul.map((j, i) => ({ documentKey: `k${i}`, judulDokumen: j, peranPengunggah: "Penggugat" }));
    },
  };
}

describe("A1. kebijakan sela (murni): penarikan utama selalu lebih dulu", () => {
  const sekarangMs = 1_000_000_000;
  const p = (o: Partial<Giliran> = {}) => ({ ...BEBAS, ...o });

  it("bebas -> mulai", () => {
    expect(S.putuskanGiliran({ sekarangMs, penjadwal: p() })).toMatchObject({ mulai: true });
    // Penjadwal mati: tidak ada putaran utama yang dilindungi.
    expect(S.putuskanGiliran({ sekarangMs, penjadwal: p({ aktif: false, berkalaBerikutnyaMs: sekarangMs }) })).toMatchObject({ mulai: true });
  });

  it("putaran utama berjalan / dipilih, penarikan lain (menyeluruh, belum-ada, PuTTY), pemulihan sesi -> menunggu", () => {
    expect(S.putuskanGiliran({ sekarangMs, penjadwal: p({ sibuk: true }) })).toMatchObject({ mulai: false, alasan: "putaran_utama_berjalan" });
    expect(S.putuskanGiliran({ sekarangMs, penjadwal: p({ penarikanLain: true }) })).toMatchObject({ mulai: false, alasan: "penarikan_server_berjalan" });
    expect(S.putuskanGiliran({ sekarangMs, penjadwal: p({ memulihkan: true }) })).toMatchObject({ mulai: false, alasan: "pemulihan_sesi" });
  });

  it("putaran utama (berkala atau pagi) jatuh tempo dalam jendela tarikan + cadangan -> memberi jalan; lebih jauh -> boleh", () => {
    const jendela = S.BATAS_TARIK_MS + S.MARGIN_MS;
    for (const ruas of ["berkalaBerikutnyaMs", "pagiBerikutnyaMs"] as const) {
      expect(S.putuskanGiliran({ sekarangMs, penjadwal: p({ [ruas]: sekarangMs + jendela - 1 }) })).toMatchObject({ mulai: false, alasan: "putaran_utama_segera" });
      // Sudah jatuh tempo (akan jalan pada detak berikutnya) juga menahan.
      expect(S.putuskanGiliran({ sekarangMs, penjadwal: p({ [ruas]: sekarangMs - 5000 }) })).toMatchObject({ mulai: false, alasan: "putaran_utama_segera" });
      expect(S.putuskanGiliran({ sekarangMs, penjadwal: p({ [ruas]: sekarangMs + jendela }) })).toMatchObject({ mulai: true });
    }
  });

  it("bawaan: tarikan paling lama 4 menit + cadangan 1 menit; menunggu giliran paling lama 10 menit; segar 10 menit; paksa tidak di bawah 1 menit", () => {
    expect(S.BATAS_TARIK_MS).toBe(4 * MENIT);
    expect(S.MARGIN_MS).toBe(1 * MENIT);
    expect(S.BATAS_TUNGGU_MS).toBe(10 * MENIT);
    expect(S.JEDA_SEGAR_MS).toBe(10 * MENIT);
    expect(S.JEDA_PAKSA_MIN_MS).toBe(1 * MENIT);
    expect(S.BATAS_ANTREAN).toBe(5);
  });

  it("umurTeks: baru saja / menit / jam", () => {
    expect(S.umurTeks(10)).toBe("baru saja");
    expect(S.umurTeks(120)).toBe("2 menit lalu");
    expect(S.umurTeks(3 * 3600)).toBe("3 jam lalu");
  });
});

describe("A2. satu perkara: e-Court atau bukan, batas laju, bergabung, antrean", () => {
  it("bukan perkara e-Court: keterangan wajar, tidak ada yang diantrekan dan tidak ada jembatan dijalankan", async () => {
    const d = dunia();
    const h = await d.layanan.minta({ nomorPerkara: "9/Pdt.P/2026/PA.Dgl", olehSiapa: "Derry" });
    expect(h).toMatchObject({ ok: true, hasil: "bukan_ecourt" });
    expect(h.pesan).toMatch(/tidak didaftarkan lewat e-Court/);
    expect(d.jalan).toHaveLength(0);
    expect(d.layanan._antrean()).toEqual([]);
    expect(d.jejak).toHaveLength(0);
  });

  it("perkara tidak ada di SIPP / nomor kosong / SIPP tak terbaca: ditolak dengan sebab", async () => {
    const d = dunia();
    expect(await d.layanan.minta({ nomorPerkara: "1/Pdt.G/2020/PA.Dgl" })).toMatchObject({ ok: false, alasan: "perkara_tidak_ditemukan" });
    expect(await d.layanan.minta({ nomorPerkara: "   " })).toMatchObject({ ok: false, alasan: "nomor_perkara_kosong" });
    const rusak = S.buatLayanan({ sekarang: () => new Date(), tanpaPewaktu: true, berkasSimpanan: null, kueriSipp: async () => { throw new Error("mati"); }, akunSiap: () => true, penjadwal: { keadaanGiliran: () => BEBAS, jalankan: async () => ({}) }, jejak: { sisip: async () => {}, mulai: async () => {}, akhir: async () => {} } });
    expect(await rusak.minta({ nomorPerkara: NOMOR })).toMatchObject({ ok: false, alasan: "sipp_tidak_terbaca" });
  });

  it("sela kosong: dimulai seketika, hanya perkara itu (--perkara), tanpa batas 'maks perkara', batas waktu 4 menit, sumber sendiri", async () => {
    const d = dunia();
    const h = await d.layanan.minta({ nomorPerkara: NOMOR, olehSiapa: "Derry Briantono" });
    expect(h).toMatchObject({ ok: true, hasil: "dimulai" });
    expect(d.jalan).toHaveLength(1);
    expect(d.jalan[0].nomor).toBe(NOMOR);
    expect(d.jalan[0].opsi).toMatchObject({ nomorPerkara: NOMOR, maksPerkara: 0, sumber: "tarik-satu-sipp", batasMs: S.BATAS_TARIK_MS });
    // Tidak membawa opsi yang mengubah perilaku penarikan utama.
    expect(Object.keys(d.jalan[0].opsi).sort()).toEqual(["batasMs", "maksPerkara", "nomorPerkara", "padaKemajuan", "sumber"]);
    await d.selesaikan(NOMOR);
  });

  it("dua permintaan perkara yang sama (dua pengguna): bergabung, hanya satu tarikan", async () => {
    const d = dunia();
    await d.layanan.minta({ nomorPerkara: NOMOR, olehSiapa: "A" });
    const kedua = await d.layanan.minta({ nomorPerkara: NOMOR, olehSiapa: "B" });
    expect(kedua).toMatchObject({ ok: true, hasil: "bergabung" });
    expect(d.jalan).toHaveLength(1);
    await d.selesaikan(NOMOR);
  });

  it("satu tarikan sekaligus per server: perkara kedua menunggu giliran, lalu jalan sendiri setelah yang pertama selesai", async () => {
    const d = dunia();
    await d.layanan.minta({ nomorPerkara: NOMOR, olehSiapa: "A" });
    const b = await d.layanan.minta({ nomorPerkara: NOMOR_B, olehSiapa: "B" });
    expect(b).toMatchObject({ ok: true, hasil: "diantrekan" });
    expect(d.jalan).toHaveLength(1);
    expect(d.layanan._antrean()).toEqual([NOMOR_B]);
    await d.selesaikan(NOMOR);
    // Sesudah yang pertama selesai, antrean ditimbang seketika.
    await vi.waitFor(() => expect(d.jalan).toHaveLength(2));
    expect(d.jalan[1].nomor).toBe(NOMOR_B);
    await d.selesaikan(NOMOR_B);
  });

  it("antrean pendek: lewat batas ditolak dengan sebab (tidak diterima lalu terlupa)", async () => {
    const banyak: Record<string, boolean> = {};
    for (let i = 0; i < 12; i += 1) banyak[`${i + 1}/Pdt.G/2026/PA.Dgl`] = true;
    const d = dunia({ ecourt: banyak });
    d.g.sibuk = true;
    const hasil: Hasil[] = [];
    for (let i = 0; i < 12; i += 1) hasil.push(await d.layanan.minta({ nomorPerkara: `${i + 1}/Pdt.G/2026/PA.Dgl` }));
    expect(hasil.filter((x) => x.hasil === "diantrekan")).toHaveLength(S.BATAS_ANTREAN);
    expect(hasil.filter((x) => x.alasan === "antrean_penuh")).toHaveLength(12 - S.BATAS_ANTREAN);
    expect(d.jalan).toHaveLength(0);
  });

  it("akun e-Court tanpa sesi: ditolak sebelum menarik; tidak ada upaya masuk sendiri (jembatan tidak dijalankan)", async () => {
    const d = dunia({ siap: false });
    const h = await d.layanan.minta({ nomorPerkara: NOMOR });
    expect(h).toMatchObject({ ok: false, alasan: "akun_tidak_siap" });
    expect(d.jalan).toHaveLength(0);
  });

  it("batas laju: selesai ditarik lalu diminta lagi < 10 menit -> 'baru ditarik'; paksa lolos setelah 1 menit; < 1 menit tetap segar", async () => {
    const d = dunia();
    d.dokumenBaru(["Gugatan"]);
    await d.layanan.minta({ nomorPerkara: NOMOR, olehSiapa: "Derry" });
    await d.selesaikan(NOMOR);
    d.jam.ms += 3 * MENIT;
    const lagi = await d.layanan.minta({ nomorPerkara: NOMOR, olehSiapa: "Derry" });
    expect(lagi).toMatchObject({ ok: true, hasil: "segar" });
    expect(lagi.pesan).toBe("Baru ditarik 3 menit lalu.");
    expect(lagi.terakhirDetik).toBe(180);
    expect(lagi.sisaSegarDetik).toBe(7 * 60);
    expect(d.jalan).toHaveLength(1);
    // Paksa (Admin) 3 menit kemudian lolos...
    const paksa = await d.layanan.minta({ nomorPerkara: NOMOR, olehSiapa: "Admin", paksa: true });
    expect(paksa).toMatchObject({ ok: true, hasil: "dimulai" });
    await d.selesaikan(NOMOR);
    // ...tetapi paksa pun tidak di bawah 1 menit.
    d.jam.ms += 30_000;
    expect(await d.layanan.minta({ nomorPerkara: NOMOR, olehSiapa: "Admin", paksa: true })).toMatchObject({ hasil: "segar" });
    // Sesudah 10 menit tanpa paksa: boleh lagi.
    d.jam.ms += 11 * MENIT;
    expect(await d.layanan.minta({ nomorPerkara: NOMOR, olehSiapa: "Derry" })).toMatchObject({ hasil: "dimulai" });
    await d.selesaikan(NOMOR);
  });

  it("kunjungan penarikan utama (apa pun) ke perkara itu < 10 menit juga membuatnya segar - tidak ditarik dua kali", async () => {
    const d0 = dunia();
    const kunjungan = { [NOMOR]: d0.jam.ms - 4 * MENIT };
    const d = dunia({ kunjungan });
    const h = await d.layanan.minta({ nomorPerkara: NOMOR });
    expect(h).toMatchObject({ ok: true, hasil: "segar" });
    expect(h.pesan).toBe("Baru ditarik 4 menit lalu.");
    expect(d.jalan).toHaveLength(0);
  });

  it("hasil: 'N dokumen baru', judulnya, dan tarikan yang gagal / sesi habis tidak membuat perkara dianggap segar", async () => {
    const d = dunia();
    await d.layanan.minta({ nomorPerkara: NOMOR });
    d.dokumenBaru(["Gugatan", "Jawaban"]);
    await d.selesaikan(NOMOR);
    const k = await d.layanan.keadaan(NOMOR);
    expect(k.tarikan).toMatchObject({ status: "selesai", pesan: "Ditarik 2 dokumen baru", berkasBaru: 0 });
    expect(k.tarikan.dokumenBaru.map((x: { judul: string }) => x.judul)).toEqual(["Gugatan", "Jawaban"]);
    expect(k.terakhirTeks).toBe("baru saja");

    const e = dunia();
    await e.layanan.minta({ nomorPerkara: NOMOR_B });
    await e.selesaikan(NOMOR_B, { dilewati: false, kode: 2, catatan: "Sesi e-Court habis." });
    const ke = await e.layanan.keadaan(NOMOR_B);
    expect(ke.tarikan).toMatchObject({ status: "sesi-habis" });
    expect(ke.tarikan.pesan).toMatch(/Sesi e-Court habis/);
    expect(ke.terakhirDetik).toBeNull(); // tidak ada tarikan BERHASIL
    // Jeda singkat 1 menit sesudah gagal; lewat itu boleh coba lagi.
    expect(await e.layanan.minta({ nomorPerkara: NOMOR_B })).toMatchObject({ hasil: "segar" });
    e.jam.ms += 61_000;
    expect(await e.layanan.minta({ nomorPerkara: NOMOR_B })).toMatchObject({ hasil: "dimulai" });
    await e.selesaikan(NOMOR_B, { dilewati: false, kode: 1, catatan: "peramban macet" });
    expect((await e.layanan.keadaan(NOMOR_B)).tarikan).toMatchObject({ status: "gagal" });
  });

  it("kalah balapan (jembatan menjawab 'dilewati'): kembali menunggu di kepala antrean, tanpa jeda dan tanpa terhitung ditarik", async () => {
    const d = dunia();
    await d.layanan.minta({ nomorPerkara: NOMOR });
    d.g.sibuk = true;
    await d.selesaikan(NOMOR, { dilewati: true, alasan: "putaran_sebelumnya_belum_selesai" });
    const k = await d.layanan.keadaan(NOMOR);
    expect(k.tarikan.status).toBe("menunggu-giliran");
    expect(k.terakhirDetik).toBeNull();
    d.g.sibuk = false;
    await d.layanan.timbang();
    await vi.waitFor(() => expect(d.jalan).toHaveLength(2));
    await d.selesaikan(NOMOR);
  });

  it("jejak: siapa dan kapan diminta, kapan mulai, dan hasilnya", async () => {
    const d = dunia();
    await d.layanan.minta({ nomorPerkara: NOMOR, olehSiapa: "Derry Briantono" });
    await d.selesaikan(NOMOR);
    const jenis = d.jejak.map((x) => x.jenis);
    expect(jenis).toEqual(["sisip", "mulai", "akhir"]);
    expect(d.jejak[0].t).toMatchObject({ nomorPerkara: NOMOR, olehSiapa: "Derry Briantono", dimintaMs: Date.UTC(2026, 9, 21, 2, 0, 0) });
    expect(d.jejak[2]).toMatchObject({ berhasil: true });
    expect(String(d.jejak[2].catatan)).toMatch(/^selesai/);
  });
});

describe("A3. tidak memberatkan penarikan utama", () => {
  it("penarikan utama sedang berjalan: permintaan MENUNGGU (tidak membuka jembatan kedua), lalu jalan begitu penarikan utama selesai", async () => {
    const d = dunia();
    d.g.sibuk = true;
    const h = await d.layanan.minta({ nomorPerkara: NOMOR });
    expect(h).toMatchObject({ ok: true, hasil: "diantrekan" });
    expect(h.tarikan?.menungguKarena).toBe("putaran_utama_berjalan");
    for (let i = 0; i < 20; i += 1) {
      d.jam.ms += 20_000;
      await d.layanan.timbang();
    }
    expect(d.jalan).toHaveLength(0);
    d.g.sibuk = false;
    await d.layanan.timbang();
    await vi.waitFor(() => expect(d.jalan).toHaveLength(1));
    await d.selesaikan(NOMOR);
  });

  it("putaran utama hampir tiba: tarikan memberi jalan (tidak dimulai), dan dimulai lagi setelah putaran utama lewat", async () => {
    const d = dunia();
    d.g.berkalaBerikutnyaMs = d.jam.ms + 2 * MENIT;
    expect(await d.layanan.minta({ nomorPerkara: NOMOR })).toMatchObject({ hasil: "diantrekan" });
    expect(d.jalan).toHaveLength(0);
    // Putaran utama berjalan lalu selesai; jadwal berikutnya 40 menit lagi.
    d.jam.ms += 3 * MENIT;
    d.g.sibuk = true;
    await d.layanan.timbang();
    d.jam.ms += 20 * MENIT;
    d.g.sibuk = false;
    d.g.berkalaBerikutnyaMs = d.jam.ms + 40 * MENIT;
    // 23 menit sudah lewat: permintaan lama kedaluwarsa (batas tunggu 10 menit), bukan menggantung.
    await d.layanan.timbang();
    expect((await d.layanan.keadaan(NOMOR)).tarikan.status).toBe("ditunda");
    expect(d.jalan).toHaveLength(0);
  });

  it("menunggu giliran lebih dari 10 menit: dihentikan dengan keterangan wajar, tanpa jeda dan tanpa jejak 'ditarik'", async () => {
    const d = dunia();
    d.g.sibuk = true;
    await d.layanan.minta({ nomorPerkara: NOMOR, olehSiapa: "Derry" });
    d.jam.ms += 9 * MENIT;
    await d.layanan.timbang();
    expect((await d.layanan.keadaan(NOMOR)).tarikan.status).toBe("menunggu-giliran");
    d.jam.ms += 2 * MENIT;
    await d.layanan.timbang();
    const k = await d.layanan.keadaan(NOMOR);
    expect(k.tarikan).toMatchObject({ status: "ditunda", alasan: "menunggu_terlalu_lama" });
    expect(k.tarikan.pesan).toMatch(/Penarikan utama masih berjalan/);
    expect(k.terakhirDetik).toBeNull();
    expect(d.layanan._antrean()).toEqual([]);
    expect(d.jejak.at(-1)).toMatchObject({ jenis: "akhir", berhasil: false });
    // Boleh meminta lagi seketika (tidak ada jeda hukuman).
    d.g.sibuk = false;
    expect(await d.layanan.minta({ nomorPerkara: NOMOR })).toMatchObject({ hasil: "dimulai" });
    await d.selesaikan(NOMOR);
  });

  it("SIMULASI 3.000 skenario acak: putaran utama TIDAK PERNAH terlambat karena tarikan satu perkara (0 detik); tanpa kebijakan sela terlambat sampai 4 menit", async () => {
    let benih = 20261021;
    const acak = () => ((benih = (benih * 1103515245 + 12345) % 2147483648) / 2147483648);
    let terlambatMaks = 0;
    let terlambatMaksNaif = 0;
    let dimulai = 0;
    let memberiJalan = 0;
    for (let i = 0; i < 3000; i += 1) {
      const d = dunia();
      // Putaran utama jatuh tempo 0-20 menit lagi; permintaan datang kapan saja.
      const jatuhTempo = d.jam.ms + Math.floor(acak() * 20 * MENIT);
      d.g.berkalaBerikutnyaMs = jatuhTempo;
      const awal = d.jam.ms;
      const h = await d.layanan.minta({ nomorPerkara: NOMOR });
      // Lama tarikan acak 20 detik .. batas 4 menit (dimatikan paksa di batas).
      const lama = 20_000 + Math.floor(acak() * (S.BATAS_TARIK_MS - 20_000));
      if (h.hasil === "dimulai") {
        dimulai += 1;
        const mulai = d.jalan[0].mulaiMs;
        d.jam.ms = mulai + lama;
        await d.selesaikan(NOMOR);
        // Putaran utama baru dapat mulai pada max(jatuhTempo, akhir tarikan).
        terlambatMaks = Math.max(terlambatMaks, Math.max(0, d.jam.ms - jatuhTempo));
      } else {
        memberiJalan += 1;
        await d.layanan.timbang();
      }
      // Pembanding: tanpa kebijakan sela, tarikan dimulai begitu penjadwal tidak sibuk.
      const naif = awal + lama;
      terlambatMaksNaif = Math.max(terlambatMaksNaif, Math.max(0, naif - jatuhTempo));
    }
    expect(terlambatMaks).toBe(0);
    expect(terlambatMaksNaif).toBeGreaterThan(3 * MENIT);
    expect(terlambatMaksNaif).toBeLessThanOrEqual(S.BATAS_TARIK_MS);
    // Kebijakan tidak mati: sebagian besar skenario (jatuh tempo > 5 menit) tetap dimulai.
    expect(dimulai).toBeGreaterThan(1800);
    expect(dimulai + memberiJalan).toBe(3000);
    console.info(
      `[ukur] 3000 skenario: tarikan dimulai ${dimulai}, memberi jalan ${memberiJalan}; keterlambatan maksimum putaran utama ` +
        `${terlambatMaks / 1000} dtk (tanpa kebijakan sela: ${Math.round(terlambatMaksNaif / 1000)} dtk)`
    );
  });
});

// ============================================================================
// B. PENJADWAL: keadaanGiliran hanya membaca
// ============================================================================
type Penjadwal = {
  keadaanGiliran: (ms?: number) => Giliran;
  saveSettings: (o: Record<string, unknown>) => { ok: boolean };
  getStatus: () => Record<string, any>;
  bacaPagi: () => Record<string, unknown>;
  mulaiPenarikanPerkara: unknown;
  berhenti: () => void;
};
const J = require_(path.join(AKAR, "aleta_bot/services/ecourtSchedulerService.js")) as Penjadwal;
const wita = (t: string) => new Date(`${t.replace(" ", "T")}:00+08:00`).getTime();

describe("B. ecourtSchedulerService.keadaanGiliran", () => {
  it("penjadwal mati: tidak ada putaran utama yang dilindungi", () => {
    fs.writeFileSync(process.env.ALETA_BOT_RUNTIME_CONFIG_PATH!, JSON.stringify({ ecourtJadwal: { aktif: false } }));
    expect(J.keadaanGiliran(wita("2026-10-21 09:00"))).toMatchObject({ aktif: false, sibuk: false, berkalaBerikutnyaMs: null, pagiBerikutnyaMs: null });
  });

  it("menyala: tarikan pagi berikutnya dilaporkan (08.00 WITA hari kerja) dan keadaan sibuk dibaca dari penjadwal", () => {
    fs.writeFileSync(process.env.ALETA_BOT_RUNTIME_CONFIG_PATH!, JSON.stringify({ ecourtJadwal: { aktif: true, pagiAktif: true, jamPagi: 8, menitPagi: 0 } }));
    const k = J.keadaanGiliran(wita("2026-10-21 09:00"));
    expect(k.aktif).toBe(true);
    // Rabu 21 Okt 09.00: tarikan pagi hari ini sudah lewat jamnya (susulan) -> dianggap jatuh tempo SEKARANG.
    expect(k.pagiBerikutnyaMs).toBe(wita("2026-10-21 09:00"));
    const malam = J.keadaanGiliran(wita("2026-10-21 18:30"));
    expect(malam.pagiBerikutnyaMs).toBe(wita("2026-10-22 08:00"));
    expect(k.sibuk).toBe(false);
  });

  it("HANYA MEMBACA: memanggilnya berulang tidak mengubah jadwal, catatan tarikan pagi, maupun status penjadwal", () => {
    const sebelum = JSON.stringify([J.getStatus().berikutnya, J.getStatus().jumlahPutaran, J.getStatus().terakhirMulai, J.bacaPagi()]);
    for (let i = 0; i < 50; i += 1) J.keadaanGiliran(Date.now() + i * 1000);
    expect(JSON.stringify([J.getStatus().berikutnya, J.getStatus().jumlahPutaran, J.getStatus().terakhirMulai, J.bacaPagi()])).toBe(sebelum);
    J.berhenti();
  });

  it("jalur 'tarik satu perkara' tidak mengubah jalankanSatuPutaran: sumbernya sendiri dan tarikan per perkara tidak mencatat cap penarikan utama (kode sumber tidak diubah)", () => {
    const sumber = fs.readFileSync(path.join(AKAR, "aleta_bot/services/ecourtSchedulerService.js"), "utf8");
    // Cap waktu penarikan berhasil hanya untuk putaran tanpa nomor perkara dan bersumber jadwal/pagi/susulan.
    expect(sumber).toMatch(/!tanpaUnduh && !nomorPerkara && \["jadwal", "pagi", "susulan"\]\.includes\(sumber\)/);
    // Layanan tarik-satu tidak menyentuh jadwal penjadwal (hanya memanggil keadaanGiliran dan jalankanSatuPutaran).
    const layanan = fs.readFileSync(path.join(AKAR, "aleta_bot/services/ecourtTarikSatuService.js"), "utf8");
    expect(layanan).not.toMatch(/berkalaBerikutnyaMs\s*=/);
    expect(layanan).not.toMatch(/saveSettings|tulisPagi|catatBerhasil|mulaiUlang|hentikanPenarikan/);
    expect(layanan).not.toMatch(/ecourtLoginService|waitForManualLogin|\.login\(/);
  });
});

// ============================================================================
// C. RUTE PORTAL
// ============================================================================
const rute = vi.hoisted(() => ({
  aktor: { id: "usr_1", name: "Derry Briantono", roleId: "hakim" } as Record<string, unknown>,
  izin: true,
  diminta: [] as Array<{ nomor: string; oleh: string; paksa: boolean }>,
  dibaca: [] as string[],
  jawab: { ok: true, data: { ok: true, hasil: "dimulai", tarikan: { status: "berjalan" } } } as Record<string, any>,
  audit: [] as Array<Record<string, any>>,
}));

vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({}) }));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({
  pastikanKapabilitas: async (_db: unknown, _id: unknown, kunci: string) => {
    if (kunci !== "permintaan" || !rute.izin) {
      const { ApiError } = await import("@/server/shared/errors");
      throw new ApiError(403, "Peran Anda tidak diberi akses titip permintaan penarikan. Hubungi administrator ALETA.");
    }
    return rute.aktor;
  },
}));
vi.mock("@/lib/permissions", () => ({
  isPrivilegedAdmin: (u: { roleId?: string } | null) => u?.roleId === "admin" || u?.roleId === "super-admin",
}));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_1" }));
vi.mock("@/server/shared/admin-access-audit", () => ({
  handleAdminRouteError: (galat: unknown) => {
    throw galat;
  },
}));
vi.mock("@/server/shared/audit", () => ({ appendAuditLog: async (_db: unknown, isi: Record<string, any>) => void rute.audit.push(isi) }));
vi.mock("@/server/shared/ids", () => ({ nextPrefixedId: async () => "adt_uji" }));
vi.mock("@/server/shared/request", () => ({ readJsonBody: async (r: { __badan?: unknown }) => r.__badan ?? {} }));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", () => ({
  mintaGatewayTarikSatu: async (nomor: string, oleh: string, paksa: boolean) => {
    rute.diminta.push({ nomor, oleh, paksa });
    return rute.jawab;
  },
  getGatewayTarikSatu: async (nomor: string) => {
    rute.dibaca.push(nomor);
    return rute.jawab;
  },
}));

async function panggilRute(cara: "GET" | "POST", o: { badan?: unknown; kueri?: string } = {}) {
  const mod = await import("@/app/api/aleta-ecourt/tarik-satu/route");
  const permintaan = { nextUrl: new URL(`http://uji.local/api/aleta-ecourt/tarik-satu${o.kueri ?? ""}`), __badan: o.badan };
  try {
    const r = await (cara === "GET" ? mod.GET : mod.POST)(permintaan as unknown as Parameters<typeof mod.GET>[0]);
    return { status: r.status, isi: (await r.json()) as { ok: boolean; data?: any } };
  } catch (galat) {
    return { status: Number((galat as { status?: number }).status || 500), isi: { ok: false, data: { galat: String((galat as Error).message) } } };
  }
}

describe("C. rute portal /api/aleta-ecourt/tarik-satu", () => {
  beforeEach(() => {
    rute.aktor = { id: "usr_1", name: "Derry Briantono", roleId: "hakim" };
    rute.izin = true;
    rute.diminta = [];
    rute.dibaca = [];
    rute.audit = [];
    rute.jawab = { ok: true, data: { ok: true, hasil: "dimulai", tarikan: { status: "berjalan" } } };
  });

  it("peran tanpa kemampuan 'permintaan': GET dan POST ditolak 403 dan bot tidak dihubungi", async () => {
    rute.izin = false;
    expect((await panggilRute("POST", { badan: { nomorPerkara: NOMOR } })).status).toBe(403);
    expect((await panggilRute("GET", { kueri: `?nomor=${NOMOR}` })).status).toBe(403);
    expect(rute.diminta).toEqual([]);
    expect(rute.dibaca).toEqual([]);
  });

  it("pemegang perkara: diteruskan ke bot dengan NAMA dari akun yang masuk, bukan dari badan; paksa=false", async () => {
    const r = await panggilRute("POST", { badan: { nomorPerkara: `  ${NOMOR}  `, olehSiapa: "Orang Lain", oleh: "Orang Lain" } });
    expect(r.status).toBe(200);
    expect(rute.diminta).toEqual([{ nomor: NOMOR, oleh: "Derry Briantono", paksa: false }]);
    expect(r.isi.data).toMatchObject({ available: true, hasil: "dimulai", bolehPaksa: false });
  });

  it("paksa dari non-Admin: 403 TEGAS (bukan diabaikan diam-diam) dan bot tidak dihubungi", async () => {
    const r = await panggilRute("POST", { badan: { nomorPerkara: NOMOR, paksa: true } });
    expect(r.status).toBe(403);
    expect(r.isi.data.galat).toMatch(/hanya untuk Super Admin dan Admin/);
    expect(rute.diminta).toEqual([]);
  });

  it("paksa dari Admin / Super Admin: diteruskan paksa=true dan tercatat", async () => {
    for (const roleId of ["admin", "super-admin"]) {
      rute.aktor = { id: "usr_a", name: "Admin Server", roleId };
      rute.diminta = [];
      rute.audit = [];
      const r = await panggilRute("POST", { badan: { nomorPerkara: NOMOR, paksa: true } });
      expect(r.status).toBe(200);
      expect(rute.diminta).toEqual([{ nomor: NOMOR, oleh: "Admin Server", paksa: true }]);
      expect(r.isi.data.bolehPaksa).toBe(true);
      expect(rute.audit[0]).toMatchObject({ action: "MINTA_TARIK_SATU_PERKARA_PAKSA", entityType: "ecourt_tarik_satu", entityId: NOMOR });
    }
  });

  it("jejak ALETA: siapa dan kapan tercatat bila tarikan diterima (dimulai / diantrekan); tidak untuk 'segar' atau 'bukan e-Court'", async () => {
    await panggilRute("POST", { badan: { nomorPerkara: NOMOR } });
    expect(rute.audit).toHaveLength(1);
    expect(rute.audit[0]).toMatchObject({ actorUserId: "usr_1", action: "MINTA_TARIK_SATU_PERKARA", payload: { nomorPerkara: NOMOR, hasil: "dimulai", paksa: false, oleh: "Derry Briantono", lewat: "kepala-sipp" } });
    rute.audit = [];
    rute.jawab = { ok: true, data: { ok: true, hasil: "segar", terakhirDetik: 120 } };
    await panggilRute("POST", { badan: { nomorPerkara: NOMOR } });
    rute.jawab = { ok: true, data: { ok: true, hasil: "bukan_ecourt" } };
    await panggilRute("POST", { badan: { nomorPerkara: NOMOR } });
    expect(rute.audit).toEqual([]);
  });

  it("penolakan wajar bot (antrean penuh, akun e-Court tidak siap) sampai ke layar dengan alasannya, bukan 'bot tidak terjangkau'", async () => {
    rute.jawab = { ok: false, error: "antrean_penuh", status: 200, badan: { ok: false, alasan: "antrean_penuh", pesan: "Antrean tarikan satu perkara sedang penuh." } };
    const r = await panggilRute("POST", { badan: { nomorPerkara: NOMOR } });
    expect(r.isi.data).toMatchObject({ available: true, ok: false, alasan: "antrean_penuh" });
    rute.jawab = { ok: false, error: "bot_tidak_terjangkau" };
    const mati = await panggilRute("POST", { badan: { nomorPerkara: NOMOR } });
    expect(mati.isi.data).toMatchObject({ available: false, ok: false });
  });

  it("nomor kosong tidak diteruskan; GET meneruskan nomor dan memberi tahu apakah paksa boleh", async () => {
    expect((await panggilRute("POST", { badan: { nomorPerkara: "   " } })).isi.data).toMatchObject({ ok: false, alasan: "nomor_perkara_kosong" });
    expect(rute.diminta).toEqual([]);
    const r = await panggilRute("GET", { kueri: `?nomor=${encodeURIComponent(NOMOR)}` });
    expect(rute.dibaca).toEqual([NOMOR]);
    expect(r.isi.data.bolehPaksa).toBe(false);
  });
});

describe("C2. sambungan statis: bot, manifest, tanam", () => {
  it("rute bot terdaftar (POST dan GET), manifest dan daftar tanam memuat skrip, tanpa jalur tulis ke SIPP", () => {
    const rutebot = fs.readFileSync(path.join(AKAR, "aleta_bot/routes/internalGatewayRoutes.js"), "utf8");
    expect(rutebot).toMatch(/router\.post\("\/ecourt\/tarik-satu", requireInternalToken/);
    expect(rutebot).toMatch(/router\.get\("\/ecourt\/tarik-satu", requireInternalToken/);
    const manifest = JSON.parse(baca("manifest.json"));
    const skripSipp = manifest.content_scripts.find((c: { js: string[]; matches: string[] }) => c.js.includes("konten.js") && c.matches.some((m: string) => m.includes("/SIPP/")));
    expect(skripSipp.js).toContain("tarik-satu-perkara.js");
    // Tidak di ABT (aps_badilag) - hanya SIPP.
    const abt = manifest.content_scripts.filter((c: { matches: string[] }) => c.matches.some((m: string) => m.includes("aps_badilag")));
    expect(abt.every((c: { js: string[] }) => !c.js.includes("tarik-satu-perkara.js"))).toBe(true);
    expect(fs.readFileSync(path.join(AKAR, "manajemen_surat/scripts/susun-ekstensi.mjs"), "utf8")).toMatch(/"tarik-satu-perkara\.js"/);
    // Layanan bot hanya MEMBACA SIPP.
    const layanan = fs.readFileSync(path.join(AKAR, "aleta_bot/services/ecourtTarikSatuService.js"), "utf8");
    const sqlSipp = [...layanan.matchAll(/kueriSipp\(\s*`([\s\S]*?)`/g)].map((m) => m[1]);
    expect(sqlSipp.length).toBeGreaterThan(0);
    expect(sqlSipp.every((s) => /^\s*SELECT\b/i.test(s))).toBe(true);
    expect(layanan).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b[^`]*\bperkara\b[^`]*\bSIPP\b/i);
  });
});

// ============================================================================
// D. EKSTENSI DI JSDOM (replika kepala SIPP sungguhan)
// ============================================================================
const ALAT = baca("panel-alat.js");
const KONTEN = baca("konten.js");
const TARIK = baca("tarik-satu-perkara.js");
const ASAL = "http://192.168.10.10";
const polos = <T,>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));

async function sampai<T>(periksa: () => T, keterangan: string | (() => string), batas = 6000): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let hasil: T | undefined;
    try {
      hasil = periksa();
    } catch {
      hasil = undefined;
    }
    if (hasil) return hasil as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`habis waktu: ${typeof keterangan === "function" ? keterangan() : keterangan}`);
    await tunggu(15);
  }
}

const terbuka: JSDOM[] = [];
afterEach(() => {
  while (terbuka.length) terbuka.pop()!.window.close();
});

type Opsi = {
  url?: string;
  kapabilitas?: Record<string, boolean> | null;
  tarikGet?: () => Record<string, any>;
  tarikPost?: (badan: Record<string, any>) => { status?: number; data: Record<string, any> };
  tanpaKepala?: boolean;
};
const AKUN = "Derry Briantono";

/** Kepala SIPP persis markup header.php (aplikasi SIPP): #atas > .h_right (absolute) > table.badge. */
const KEPALA_SIPP =
  `<div class="wrapper"><div id="atas" style="overflow: hidden">` +
  `<div class="logo"><a href="/"><img src="/resources/img/logo.png"></a></div>` +
  `<div class="front"><h1 class="judulatas">Sistem Informasi Penelusuran Perkara</h1><h4 class="judulbawah">Pengadilan Agama Donggala</h4></div>` +
  `<div class="h_right" style="position:absolute;right:0;">` +
  `<table class='badge badge-dark' style='border-radius:2px;padding:5px;margin:0 0 4px 0;font-weight:normal;'><tr><td style='text-align:right;padding-right:3px;'>` +
  `Selamat Datang <font color='red'>${AKUN}</font><br> Anda Login Sebagai <font color='red'>Administrator</font>` +
  `</td><td>&nbsp;<a href='/index.php/logout' class='btn btn-danger btn-sm'><i class='fa fa-power-off'></i>&nbsp;Keluar</a></td></tr></table>` +
  `<div class="clear"></div><div style='float:right'><a class='btn btn-success btn-sm' href='/user_profile/x'><i class='fa fa-cog'></i>&nbsp;Edit Profile</a></div>` +
  `</div></div></div>`;

function buka(o: Opsi = {}) {
  const dasbor = o.url ? !/detil_perkara_agama/.test(o.url) : false;
  const isi = dasbor
    ? `<div id="dasbor">Beranda SIPP</div>`
    : `<table width="100%" id="submenus"><tr><td><table><tr><td id="backlist"><a class="btn btn-default btn-sm" href="/index.php/perkara">Kembali</a></td></tr></table></td></tr></table>` +
      `<div id="tabs1"><table class="data-umum"><tr><td id="first-child">Nomor Perkara</td><td colspan="2">${NOMOR}</td></tr>` +
      `<tr><td id="first-child">Jenis Perkara</td><td colspan="2">Cerai Gugat</td></tr></table></div>`;
  const dom = new JSDOM(`<!doctype html><html><head><title>SIPP</title></head><body>${o.tanpaKepala ? "" : KEPALA_SIPP}<div id="konten">${isi}</div></body></html>`, {
    url: o.url || `${ASAL}/SIPP/detil_perkara_agama`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  w.TextDecoder = globalThis.TextDecoder;
  w.Response = globalThis.Response;
  const simpanan: Record<string, unknown> = { ujiTampilan: "ui", ujiIzinkanNyata: true };
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.205.24" }), getURL: (x: string) => `chrome-extension://aleta-uji/${x}`, sendMessage: async () => ({}) },
    storage: {
      local: {
        get: async (kunci?: string | string[] | null) => {
          const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
          const hasil: Record<string, unknown> = {};
          for (const k of daftar) if (k in simpanan) hasil[k] = polos(simpanan[k]);
          return hasil;
        },
        set: async (x: Record<string, unknown>) => void Object.assign(simpanan, polos(x)),
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  const kapabilitas = o.kapabilitas === undefined ? null : o.kapabilitas;
  const kiriman: Array<{ url: string; cara: string; badan: string }> = [];
  w.fetch = async (alamat: string, opsi?: { method?: string; body?: unknown }) => {
    const url = String(alamat);
    const cara = String((opsi && opsi.method) || "GET").toUpperCase();
    kiriman.push({ url, cara, badan: typeof opsi?.body === "string" ? opsi.body : "" });
    let status = 200;
    let isiJawab: unknown = { ok: true, data: {} };
    if (url.includes("/api/aleta-ecourt/tarik-satu")) {
      if (cara === "POST") {
        const bawaanPost = (): { status?: number; data: Record<string, any> } => ({
          data: { available: true, ok: true, hasil: "dimulai", tarikan: { status: "berjalan", kemajuan: { persen: 8, teks: "Membuka peramban e-Court" } } },
        });
        const j = (o.tarikPost || bawaanPost)(JSON.parse(String(opsi?.body || "{}")));
        status = j.status || 200;
        isiJawab = status >= 400 ? { ok: false, error: { message: j.data.galat || "ditolak" } } : { ok: true, data: j.data };
      } else {
        isiJawab = { ok: true, data: (o.tarikGet || (() => ({ available: true, ok: true, ada: false, tarikan: null, terakhirDetik: null, bolehPaksa: false })))() };
      }
    } else if (url.includes("/aleta-bot/sipp-konteks?")) {
      isiJawab = {
        ok: true,
        data: {
          available: true,
          pengguna: { nama: AKUN, peran: "Hakim" },
          kapabilitas,
          konteks: {
            ok: true,
            nomorPerkara: NOMOR,
            nomorRegister: "",
            identitas: { ditemukan: true, jenisPerkara: "Cerai Gugat", jenisPerkaraLengkap: "Cerai Gugat", adaKumulasi: false, kumulasi: [], adaKuasa: false },
            ringkasan: { dokumen: 1 },
            dokumen: [{ judul: "Gugatan" }],
            selisih: [],
            nomorPihak: [],
            diperiksaPada: new Date().toISOString(),
            ambangMendesakHari: 3,
            hakim: null,
          },
        },
      };
    } else if (url.includes("/api/aleta-ecourt/ekstensi/tampilan")) {
      status = 404;
      isiJawab = {};
    } else if (url.includes("/aleta-ecourt/ekstensi/siapa")) {
      isiJawab = { ok: true, data: { nama: AKUN, peran: "Hakim", kapabilitas } };
    }
    const r: any = {
      ok: status >= 200 && status < 300,
      status,
      statusText: "",
      url,
      redirected: false,
      headers: { get: () => "application/json" },
      json: async () => polos(isiJawab),
      text: async () => JSON.stringify(isiJawab ?? {}),
      clone: () => r,
    };
    return r;
  };
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(ALAT, ctx, { filename: "panel-alat.js" });
  vm.runInContext("alatSetelJedaSkala(0)", ctx);
  vm.runInContext(KONTEN, ctx, { filename: "konten.js" });
  let segarPanggil = 0;
  w.segarkan = async () => void (segarPanggil += 1);
  vm.runInContext(TARIK, ctx, { filename: "tarik-satu-perkara.js" });
  return { w, d: w.document as Document, kiriman, segar: () => segarPanggil };
}
type Halaman = ReturnType<typeof buka>;

const api = (h: Halaman) => h.w.aletaTarikSatu;
const akar = (h: Halaman) => h.d.getElementById("aleta-tarik-satu") as HTMLElement | null;
const tombol = (h: Halaman) => h.d.querySelector("#aleta-tarik-satu .aleta-ts-tombol") as HTMLButtonElement | null;
const kabar = (h: Halaman) => String(h.d.querySelector("#aleta-tarik-satu .aleta-ts-teks")?.textContent || "");
const paksaBtn = (h: Halaman) => h.d.querySelector("#aleta-tarik-satu .aleta-ts-paksa") as HTMLButtonElement | null;

/** Menunggu tombol muncul: konten.js harus lebih dulu mendapat jawaban portal (hak dibaca dari sana). */
async function tombolSiap(h: Halaman) {
  return sampai(() => {
    api(h).pasang();
    return tombol(h);
  }, () => `tombol Tarik data; kepala: ${String(h.d.querySelector(".h_right")?.innerHTML || "").slice(0, 300)}`);
}

function simpanTangkapan(h: Halaman, nama: string) {
  const awalan = process.env.ALETA_TANGKAP_TARIKSATU;
  if (!awalan) return;
  fs.mkdirSync(path.dirname(awalan), { recursive: true });
  fs.writeFileSync(`${awalan}-${nama}.html`, h.d.documentElement.outerHTML);
}

describe("D. tombol Tarik data di kepala halaman perkara SIPP (jsdom)", () => {
  it("di halaman perkara: tombol ada DI DALAM .h_right, PERSIS di kiri tabel 'Selamat Datang' (sebelum table.badge), berlabel 'Tarik data'", async () => {
    const h = buka();
    await tombolSiap(h);
    const a = akar(h)!;
    const kepala = h.d.querySelector(".h_right")!;
    const badge = kepala.querySelector("table.badge")!;
    expect(a.parentElement).toBe(kepala);
    // Urutan DOM: tombol sebelum tabel sapaan; dan CSS-nya menaruhnya di sisi KIRI .h_right (right:100%).
    expect(a.nextElementSibling).toBe(badge);
    expect(kepala.firstElementChild).toBe(a);
    const gaya = h.d.getElementById("aleta-tarik-satu-gaya")!.textContent!;
    expect(gaya).toMatch(/#aleta-tarik-satu\.aleta-sisip\{position:absolute;z-index:2147483000;pointer-events:auto;right:100%;width:max-content;/);
    expect(tombol(h)!.textContent).toContain("Tarik data");
    // SIPP tidak diubah: tabel sapaan dan tombol Keluar utuh, "Selamat Datang" masih di sel yang sama.
    expect(badge.textContent).toContain("Selamat Datang");
    expect(badge.querySelector("a[href='/index.php/logout']")).toBeTruthy();
    expect(h.d.querySelectorAll("#aleta-tarik-satu")).toHaveLength(1);
    simpanTangkapan(h, "1-awal");
  });

  it("HANYA di halaman perkara: tidak ada di dasbor, daftar perkara, atau halaman tanpa kepala SIPP", async () => {
    for (const url of [`${ASAL}/SIPP/main`, `${ASAL}/SIPP/perkara`, `${ASAL}/SIPP/perkara_jurnal`]) {
      const h = buka({ url });
      await tunggu(250);
      api(h).pasang();
      expect(akar(h), url).toBeNull();
      expect(h.kiriman.filter((x) => x.url.includes("tarik-satu")), url).toHaveLength(0);
    }
    const tanpa = buka({ tanpaKepala: true });
    await tunggu(250);
    api(tanpa).pasang();
    expect(akar(tanpa)).toBeNull();
  });

  it("hak: peran tanpa kemampuan 'permintaan' tidak melihat tombol dan tidak memanggil server", async () => {
    const h = buka({ kapabilitas: { panel: true, permintaan: false } });
    await sampai(() => (h.w.eval("penggunaTerakhir") ? true : null), "konten.js mendapat jawaban portal");
    await tunggu(100);
    api(h).pasang();
    expect(akar(h)).toBeNull();
    expect(h.kiriman.filter((x) => x.url.includes("tarik-satu"))).toHaveLength(0);
  });

  it("saat dibuka: satu GET keadaan (tanpa menarik apa pun); 'Terakhir ditarik 3 menit lalu' bila pernah", async () => {
    const h = buka({ tarikGet: () => ({ available: true, ok: true, ada: false, tarikan: null, terakhirDetik: 180, bolehPaksa: false }) });
    await tombolSiap(h);
    await sampai(() => /Terakhir ditarik 3 menit lalu/.test(kabar(h)), () => `kabar: ${kabar(h)}`);
    const t = h.kiriman.filter((x) => x.url.includes("tarik-satu"));
    expect(t).toHaveLength(1);
    expect(t[0].cara).toBe("GET");
    expect(decodeURIComponent(t[0].url)).toContain(`nomor=${NOMOR}`);
  });

  it("klik: SATU POST ke portal berisi nomor perkara saja (tanpa paksa), ke jalur portal - tidak ada tulisan ke SIPP", async () => {
    const h = buka();
    await tombolSiap(h);
    tombol(h)!.click();
    await sampai(() => h.kiriman.some((x) => x.cara === "POST"), "POST terkirim");
    const post = h.kiriman.filter((x) => x.cara === "POST");
    expect(post).toHaveLength(1);
    expect(post[0].url).toBe("/aleta/api/aleta-ecourt/tarik-satu");
    expect(JSON.parse(post[0].badan)).toEqual({ nomorPerkara: NOMOR });
    // Semua permintaan non-GET ke jalur portal; tidak ada yang ke jalur SIPP.
    expect(h.kiriman.filter((x) => x.cara !== "GET").every((x) => x.url.startsWith("/aleta/api/"))).toBe(true);
    await sampai(() => /8% · Membuka peramban e-Court/.test(kabar(h)), () => `kabar: ${kabar(h)}`);
    expect(tombol(h)!.disabled).toBe(true);
    expect(h.d.querySelector("#aleta-tarik-satu .aleta-ts-garis")!.hasAttribute("hidden")).toBe(false);
    simpanTangkapan(h, "3-berjalan");
  });

  it("menunggu giliran (penarikan utama berjalan): keterangan jelas, tombol mati; lalu berjalan; lalu selesai: 'Ditarik 2 dokumen baru' dan panel digambar ulang", async () => {
    let fase: "tunggu" | "jalan" | "selesai" = "tunggu";
    const h = buka({
      tarikPost: () => ({ data: { available: true, ok: true, hasil: "diantrekan", tarikan: { status: "menunggu-giliran", menungguKarena: "putaran_utama_berjalan" } } }),
      tarikGet: () => ({
        available: true,
        ok: true,
        ada: true,
        terakhirDetik: fase === "selesai" ? 3 : null,
        bolehPaksa: false,
        tarikan:
          fase === "tunggu"
            ? { status: "menunggu-giliran", menungguKarena: "putaran_utama_berjalan" }
            : fase === "jalan"
              ? { status: "berjalan", kemajuan: { persen: 47, teks: "Membaca daftar dokumen (3 dokumen)" } }
              : { status: "selesai", pesan: "Ditarik 2 dokumen baru", selesaiDetik: 3, dokumenBaru: [{ judul: "Gugatan" }, { judul: "Jawaban" }] },
      }),
    });
    await tombolSiap(h);
    tombol(h)!.click();
    await sampai(() => /Menunggu giliran · penarikan utama sedang berjalan/.test(kabar(h)), () => `kabar: ${kabar(h)}`);
    expect(tombol(h)!.disabled).toBe(true);
    simpanTangkapan(h, "2-menunggu");
    fase = "jalan";
    await api(h).tanya(false);
    expect(kabar(h)).toBe("47% · Membaca daftar dokumen (3 dokumen)");
    fase = "selesai";
    await api(h).tanya(false);
    expect(kabar(h)).toMatch(/^Ditarik 2 dokumen baru · baru saja$/);
    expect(h.d.querySelector("#aleta-tarik-satu .aleta-ts-kabar")!.getAttribute("title")).toBe("Gugatan, Jawaban");
    expect(tombol(h)!.disabled).toBe(false);
    expect(h.segar()).toBeGreaterThanOrEqual(1); // panel perkara digambar ulang agar dokumen baru tampak
    simpanTangkapan(h, "4-selesai");
  });

  it("data masih segar: 'Baru ditarik 4 menit lalu'; peran biasa TIDAK ditawari tarik ulang", async () => {
    const h = buka({
      tarikPost: () => ({ data: { available: true, ok: true, hasil: "segar", terakhirDetik: 240, sisaSegarDetik: 360, bolehPaksa: false, tarikan: null } }),
    });
    await tombolSiap(h);
    tombol(h)!.click();
    await sampai(() => /Baru ditarik 4 menit lalu/.test(kabar(h)), () => `kabar: ${kabar(h)}`);
    expect(paksaBtn(h)!.hidden).toBe(true);
    simpanTangkapan(h, "5-segar");
  });

  it("Admin: data segar menawarkan 'Tarik ulang sekarang'; kliknya mengirim paksa=true", async () => {
    const h = buka({
      tarikGet: () => ({ available: true, ok: true, ada: false, tarikan: null, terakhirDetik: 240, bolehPaksa: true }),
      tarikPost: (b) => ({ data: b.paksa ? { available: true, ok: true, hasil: "dimulai", bolehPaksa: true, tarikan: { status: "berjalan", kemajuan: { persen: 5, teks: "Memeriksa jadwal SIPP" } } } : { available: true, ok: true, hasil: "segar", terakhirDetik: 240, bolehPaksa: true } }),
    });
    await tombolSiap(h);
    await sampai(() => !paksaBtn(h)!.hidden, () => `kabar: ${kabar(h)}; paksa hidden: ${paksaBtn(h)?.hidden}`);
    paksaBtn(h)!.click();
    await sampai(() => h.kiriman.some((x) => x.cara === "POST"), "POST paksa");
    expect(JSON.parse(h.kiriman.find((x) => x.cara === "POST")!.badan)).toEqual({ nomorPerkara: NOMOR, paksa: true });
    await sampai(() => /5% · Memeriksa jadwal SIPP/.test(kabar(h)), () => `kabar: ${kabar(h)}`);
    simpanTangkapan(h, "6-admin-paksa");
  });

  it("bukan perkara e-Court: keterangan wajar dan tombol mati", async () => {
    const h = buka({ tarikPost: () => ({ data: { available: true, ok: true, hasil: "bukan_ecourt", pesan: "Perkara ini tidak didaftarkan lewat e-Court." } }) });
    await tombolSiap(h);
    tombol(h)!.click();
    await sampai(() => /Bukan perkara e-Court/.test(kabar(h)), () => `kabar: ${kabar(h)}`);
    expect(tombol(h)!.disabled).toBe(true);
    expect(tombol(h)!.title).toMatch(/tidak didaftarkan lewat e-Court/);
    simpanTangkapan(h, "7-bukan-ecourt");
  });

  it("penolakan server (antrean penuh / akun e-Court tak siap / 403) ditampilkan apa adanya, tombol hidup kembali", async () => {
    const h = buka({ tarikPost: () => ({ data: { available: true, ok: false, alasan: "akun_tidak_siap", pesan: "Tidak ada akun e-Court yang sesinya siap. Minta admin masuk ulang di menu Integrasi e-Court." } }) });
    await tombolSiap(h);
    tombol(h)!.click();
    await sampai(() => /Tidak ada akun e-Court yang sesinya siap/.test(kabar(h)), () => `kabar: ${kabar(h)}`);
    expect(tombol(h)!.disabled).toBe(false);
    expect(h.d.querySelector("#aleta-tarik-satu .aleta-ts-kabar")!.getAttribute("data-nada")).toBe("galat");
    simpanTangkapan(h, "8-ditolak");
    const h403 = buka({ tarikPost: () => ({ status: 403, data: { galat: "Peran Anda tidak diberi akses." } }) });
    await tombolSiap(h403);
    tombol(h403)!.click();
    await sampai(() => /Peran Anda tidak diberi akses/.test(kabar(h403)), () => `kabar: ${kabar(h403)}`);
  });

  it("ganti perkara (SIPP dimuat tanpa memuat ulang halaman): keadaan perkara lama tidak terbawa; kepala digambar ulang SIPP: tombol dipasang lagi", async () => {
    const h = buka({ tarikGet: () => ({ available: true, ok: true, ada: false, tarikan: null, terakhirDetik: 180, bolehPaksa: false }) });
    await tombolSiap(h);
    // SIPP menulis ulang kepalanya: elemen kita hilang -> dipasang lagi tanpa GET kedua.
    akar(h)!.remove();
    api(h).pasang();
    expect(h.d.querySelectorAll("#aleta-tarik-satu")).toHaveLength(1);
    expect(h.kiriman.filter((x) => x.url.includes("tarik-satu") && x.cara === "GET")).toHaveLength(1);
  });

  it("TIDAK ADA kata merek di halaman SIPP: teks, judul (tooltip), dan aria tombol tidak memuat 'Aleta'", async () => {
    const h = buka({
      tarikGet: () => ({ available: true, ok: true, ada: true, terakhirDetik: 5, bolehPaksa: true, tarikan: { status: "selesai", pesan: "Ditarik 1 dokumen baru", selesaiDetik: 5, dokumenBaru: [{ judul: "Jawaban" }] } }),
    });
    await tombolSiap(h);
    await sampai(() => /Ditarik 1 dokumen baru/.test(kabar(h)), () => `kabar: ${kabar(h)}`);
    const bagian = akar(h)!;
    const semuaTeks = [bagian.textContent || ""];
    bagian.querySelectorAll("*").forEach((e) => {
      for (const a of ["title", "aria-label", "placeholder", "alt", "value"]) semuaTeks.push(e.getAttribute(a) || "");
    });
    expect(semuaTeks.join("\n")).not.toMatch(/aleta/i);
    // Sumber skrip pun tidak menuliskannya ke teks tampilan (kelas/id dikecualikan; komentar boleh).
    const literal = [...TARIK.matchAll(/["'`]([^"'`\n]{3,})["'`]/g)].map((m) => m[1]).filter((s) => /\s/.test(s) && !/^[#.\w-]+$/.test(s) && !/^\/aleta\/api\//.test(s));
    expect(literal.filter((s) => /aleta/i.test(s) && !/(aleta-ts|aleta-sisip|aleta-tarik-satu|aleta-uji-berubah)/i.test(s))).toEqual([]);
  });

});
