/**
 * 13 Okt 2026 10.05 (permintaan pengguna): "buat pengaturan penarikan data
 * setiap jam 8, dan jadwalkan penarikan tiap 30 menit - 60 menit secara
 * default".
 *
 *  - tarikan pagi 08.00 WITA Senin-Jumat (semua perkara e-Court yang bersidang
 *    hari itu, hanya daftar itu), susulan SEKALI bila bot menyala sesudahnya;
 *  - putaran berkala berselang ACAK 30-60 menit di jam kerja WITA, sidang hari
 *    ini ikut diutamakan di putaran yang sama (pengganti penarik 15 menit);
 *  - satu putaran pada satu waktu; pengaturan kosong di server = bawaan baru.
 *
 * Proses bot di container berjalan dalam UTC: seluruh waktu di sini UTC, dan
 * jawabannya harus benar menurut WITA.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

import { kalimatPagi, rentangSelang, type StatusPenarikan } from "@/lib/status-penarikan-ecourt";
import { ringkasTarikEcourt } from "@/lib/tarik-ecourt-status";

const AKAR_UJI = fs.mkdtempSync(path.join(process.env.TMP || os.tmpdir(), "aleta-jadwal-pagi-"));
const BERKAS_CONFIG = path.join(AKAR_UJI, "aleta-runtime.json");
const FOLDER_SESI = path.join(AKAR_UJI, "sesi");
process.env.ALETA_BOT_RUNTIME_CONFIG_PATH = BERKAS_CONFIG;
process.env.ALETA_ECOURT_SESSION_DIR = FOLDER_SESI;
process.env.ALETA_ECOURT_KREDENSIAL_DIR = FOLDER_SESI;
process.env.ALETA_BOT_DATA_DIR = path.join(AKAR_UJI, "data");
process.env.ALETA_ZONA_WAKTU = "Asia/Makassar";

const AKAR = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const catatan: Array<Record<string, unknown>> = [];
function tiru(rel: string, exports: Record<string, unknown>) {
  const jalur = require_.resolve(path.join(AKAR, rel));
  require_.cache[jalur] = { id: jalur, filename: jalur, loaded: true, exports } as unknown as NodeJS.Module;
}
// Tidak ada basis data yang disentuh uji ini.
tiru("aleta_bot/services/logService.js", {
  logSecurityEvent: async (d: Record<string, unknown>) => void catatan.push(d),
  logSystemEvent: async (d: Record<string, unknown>) => void catatan.push(d),
});
tiru("aleta_bot/services/ecourtAuditArsipService.js", { periksaArsip: async () => ({ diperiksa: 0, dibuang: 0 }) });
tiru("aleta_bot/services/ecourtPermintaanService.js", { ambilBerikutnya: async () => null, tandaiSelesai: async () => ({}) });

type Pengaturan = Record<string, unknown> & {
  aktif: boolean;
  selangMinMenit: number;
  selangMaksMenit: number;
  pagiAktif: boolean;
  jamPagi: number;
  menitPagi: number;
  jamMulai: number;
  jamSelesai: number;
  maksPerkara: number;
  jarakJam: number;
};
const J = require_(path.join(AKAR, "aleta_bot/services/ecourtSchedulerService.js")) as {
  getSettings: () => Pengaturan;
  saveSettings: (o: Record<string, unknown>) => { ok: boolean; alasan: string };
  periksaPengaturan: (o: Record<string, unknown>) => string;
  selangAcakMs: (p: Record<string, unknown>, acak?: () => number) => number;
  perluTarikanPagi: (o: Record<string, unknown>) => { perlu: boolean; susulan: boolean; tanggal: string; alasan: string };
  jadwalPagiBerikutnya: (o: Record<string, unknown>) => { waktu: string | null; susulan: boolean };
  waktuZona: (t: string, j: number, m: number) => number;
  putuskanDetak: (o: Record<string, unknown>) => { jalan: string | null; alasan: string; susulan?: boolean };
  detakPenjadwal: (kini: Date) => Promise<{ jalan: string | null; alasan: string; hasil?: Record<string, unknown> }>;
  aturAlat: (a: Record<string, unknown>) => void;
  bacaPagi: () => Record<string, unknown>;
  berhenti: () => void;
  getStatus: () => Record<string, unknown> & { pagi: Record<string, unknown>; berikutnya: string | null };
};

const BAWAAN = { aktif: true, jamMulai: 7, jamSelesai: 17, maksPerkara: 25, selangMinMenit: 30, selangMaksMenit: 60, pagiAktif: true, jamPagi: 8, menitPagi: 0 };
/** "2026-10-13 08:00" WITA -> Date (UTC+8). */
const wita = (t: string) => new Date(`${t.replace(" ", "T")}:00+08:00`);

describe("pengaturan: bawaan baru bila kosong, batas wajar, simpan sebagian", () => {
  it("runtime config server tanpa ecourtJadwal -> selang 30-60 menit, tarikan pagi 08.00, 25 perkara", () => {
    fs.writeFileSync(BERKAS_CONFIG, JSON.stringify({ ecourtPantauSesi: { aktif: true } }));
    expect(J.getSettings()).toMatchObject({
      selangMinMenit: 30,
      selangMaksMenit: 60,
      pagiAktif: true,
      jamPagi: 8,
      menitPagi: 0,
      maksPerkara: 25,
      jamMulai: 7,
      jamSelesai: 17,
      jarakJam: 1,
    });
  });

  it("validasi rentang: min >= 15, maks <= 240, min <= maks, jam pagi sebelum jam selesai", () => {
    expect(J.periksaPengaturan(BAWAAN)).toBe("");
    expect(J.periksaPengaturan({ ...BAWAAN, selangMinMenit: 10 })).toBe("selang_min_di_luar_15_sampai_240");
    expect(J.periksaPengaturan({ ...BAWAAN, selangMaksMenit: 300 })).toBe("selang_maks_di_luar_15_sampai_240");
    expect(J.periksaPengaturan({ ...BAWAAN, selangMinMenit: 70, selangMaksMenit: 60 })).toBe("selang_min_lebih_dari_maks");
    expect(J.periksaPengaturan({ ...BAWAAN, jamPagi: 17 })).toBe("jam_pagi_harus_sebelum_jam_selesai");
    expect(J.periksaPengaturan({ ...BAWAAN, menitPagi: 60 })).toBe("menit_pagi_di_luar_0_sampai_59");
    expect(J.periksaPengaturan({ ...BAWAAN, selangMinMenit: 45, selangMaksMenit: 45 })).toBe("");
  });

  it("simpan sebagian: ruas yang tidak dikirim (widget lama) dipertahankan; yang tidak sah tidak ditulis", () => {
    fs.writeFileSync(BERKAS_CONFIG, JSON.stringify({}));
    expect(J.saveSettings({ selangMinMenit: 20, selangMaksMenit: 45, jamPagi: 7, menitPagi: 30 }).ok).toBe(true);
    // Widget ekstensi mengirim ruas lama saja (jarakJam dkk).
    expect(J.saveSettings({ aktif: true, jarakJam: 3, jamMulai: 7, jamSelesai: 17, maksPerkara: 25 }).ok).toBe(true);
    expect(J.getSettings()).toMatchObject({ selangMinMenit: 20, selangMaksMenit: 45, jamPagi: 7, menitPagi: 30, pagiAktif: true });
    expect(J.saveSettings({ selangMinMenit: 90, selangMaksMenit: 60 })).toMatchObject({ ok: false, alasan: "selang_min_lebih_dari_maks" });
    expect(J.getSettings().selangMinMenit).toBe(20);
    // Mematikan tarikan pagi dicatat sebagai peristiwa keamanan tersendiri.
    expect(J.saveSettings({ pagiAktif: false }).ok).toBe(true);
    expect(J.getSettings().pagiAktif).toBe(false);
    expect(catatan.some((c) => c.eventType === "ecourt_tarikan_pagi_dimatikan")).toBe(true);
    J.berhenti();
  });
});

describe("selang acak putaran berkala", () => {
  it("dalam rentang, dengan pembangkit acak yang disuntik", () => {
    const p = { selangMinMenit: 30, selangMaksMenit: 60 };
    expect(J.selangAcakMs(p, () => 0)).toBe(30 * 60000);
    expect(J.selangAcakMs(p, () => 1)).toBe(60 * 60000);
    expect(J.selangAcakMs(p, () => 0.5)).toBe(45 * 60000);
    // Nilai acak di luar 0..1 dijepit.
    expect(J.selangAcakMs(p, () => 7)).toBe(60 * 60000);
    let benih = 12345;
    const acak = () => ((benih = (benih * 1103515245 + 12345) % 2147483648) / 2147483648);
    const sampel = Array.from({ length: 500 }, () => J.selangAcakMs(p, acak) / 60000);
    expect(Math.min(...sampel)).toBeGreaterThanOrEqual(30);
    expect(Math.max(...sampel)).toBeLessThanOrEqual(60);
    expect(new Set(sampel.map(Math.round)).size).toBeGreaterThan(10);
  });
});

describe("tarikan pagi menurut WITA (proses UTC)", () => {
  const p = { ...BAWAAN };
  it("belum waktunya / tepat waktu / susulan / sudah / akhir pekan / lewat jam kerja / dimatikan", () => {
    const cek = (t: string, o: Record<string, unknown> = {}) => J.perluTarikanPagi({ sekarangMs: wita(t).getTime(), pengaturan: p, ...o });
    expect(cek("2026-10-13 07:59")).toMatchObject({ perlu: false, alasan: "belum_waktunya" });
    expect(cek("2026-10-13 08:00")).toMatchObject({ perlu: true, susulan: false, tanggal: "2026-10-13" });
    expect(cek("2026-10-13 10:05")).toMatchObject({ perlu: true, susulan: true });
    expect(cek("2026-10-13 10:05", { terakhirTanggal: "2026-10-13" })).toMatchObject({ perlu: false, alasan: "sudah_hari_ini" });
    expect(cek("2026-10-17 09:00")).toMatchObject({ perlu: false, alasan: "akhir_pekan" });
    expect(cek("2026-10-13 17:30")).toMatchObject({ perlu: false, alasan: "lewat_jam_kerja" });
    expect(J.perluTarikanPagi({ sekarangMs: wita("2026-10-13 09:00").getTime(), pengaturan: { ...p, pagiAktif: false } })).toMatchObject({ perlu: false, alasan: "pagi_dimatikan" });
  });

  it("jadwal pagi berikutnya: hari ini 08.00, besok sesudah dijalankan, Senin sesudah Jumat", () => {
    expect(J.waktuZona("2026-10-13", 8, 0)).toBe(Date.parse("2026-10-13T00:00:00Z"));
    const j = (t: string, terakhirTanggal = "") => J.jadwalPagiBerikutnya({ sekarangMs: wita(t).getTime(), pengaturan: p, terakhirTanggal });
    expect(j("2026-10-13 06:30")).toEqual({ waktu: "2026-10-13T00:00:00.000Z", susulan: false });
    expect(j("2026-10-13 09:00", "2026-10-13")).toEqual({ waktu: "2026-10-14T00:00:00.000Z", susulan: false });
    expect(j("2026-10-16 09:00", "2026-10-16").waktu).toBe("2026-10-19T00:00:00.000Z");
    expect(j("2026-10-13 10:05")).toMatchObject({ susulan: true });
  });
});

describe("keputusan detak: satu saja, pagi didahulukan, tidak bertumpuk", () => {
  const p = { ...BAWAAN };
  it("aturan keputusan", () => {
    const d = (t: string, o: Record<string, unknown> = {}) => J.putuskanDetak({ sekarangMs: wita(t).getTime(), pengaturan: p, berkalaBerikutnyaMs: 0, ...o });
    expect(d("2026-10-13 08:01")).toMatchObject({ jalan: "pagi" });
    expect(d("2026-10-13 08:01", { sibuk: true })).toMatchObject({ jalan: null, alasan: "penarikan_lain_berjalan" });
    expect(d("2026-10-13 09:00", { terakhirPagiTanggal: "2026-10-13" })).toMatchObject({ jalan: "berkala" });
    expect(d("2026-10-13 09:00", { terakhirPagiTanggal: "2026-10-13", berkalaBerikutnyaMs: wita("2026-10-13 09:30").getTime() })).toMatchObject({ jalan: null, alasan: "belum_waktunya" });
    expect(d("2026-10-13 19:00", { terakhirPagiTanggal: "2026-10-13" })).toMatchObject({ jalan: null, alasan: "di_luar_jam_kerja" });
    expect(J.putuskanDetak({ sekarangMs: wita("2026-10-13 09:00").getTime(), pengaturan: { ...p, aktif: false } })).toMatchObject({ jalan: null, alasan: "penjadwal_mati" });
  });

  it("alur nyata: susulan pagi 10.05 (semua sidang, hanya daftar itu) -> berkala acak 30 menit kemudian dengan sidang yang belum 'sudah' diutamakan", async () => {
    // Akun utama sah -> penjadwal menyala walau pengaturan kosong.
    fs.writeFileSync(BERKAS_CONFIG, JSON.stringify({}));
    fs.mkdirSync(path.join(FOLDER_SESI, "utama", "Default"), { recursive: true });
    const tarikan: Array<Record<string, unknown>> = [];
    const dicatat: Array<[string[], unknown]> = [];
    J.aturAlat({
      acak: () => 0,
      sidangHari: async (_t: string, o: Record<string, unknown>) => {
        expect(o).toMatchObject({ semuaJenis: true });
        return ["497/Pdt.G/2026/PA.Dgl", "70/Pdt.P/2026/PA.Dgl"];
      },
      sidangPerluDiperiksa: async () => ["497/Pdt.G/2026/PA.Dgl"],
      catatTarik: (daftar: string[], kode: unknown) => void dicatat.push([daftar, kode]),
      jalankan: async (o: Record<string, unknown>) => {
        tarikan.push(o);
        return { dilewati: false, kode: 0, catatan: "Selesai." };
      },
      ambilPermintaan: async () => null,
    });

    const a = await J.detakPenjadwal(wita("2026-10-13 10:05"));
    expect(a).toMatchObject({ jalan: "pagi", susulan: true });
    expect(tarikan[0]).toMatchObject({ sumber: "pagi", utamakan: ["497/Pdt.G/2026/PA.Dgl", "70/Pdt.P/2026/PA.Dgl"], hanyaUtamakan: true });
    expect(J.bacaPagi()).toMatchObject({ tanggal: "2026-10-13", susulan: true, kode: 0, jumlahPerkara: 2 });
    expect(dicatat[0]).toEqual([["497/Pdt.G/2026/PA.Dgl", "70/Pdt.P/2026/PA.Dgl"], 0]);

    // Sekali saja: detak berikutnya tidak mengulang pagi, dan berkala belum waktunya.
    expect(await J.detakPenjadwal(wita("2026-10-13 10:06"))).toMatchObject({ jalan: null, alasan: "belum_waktunya" });
    expect(tarikan).toHaveLength(1);

    // acak = 0 -> 30 menit sesudah putaran terakhir dimulai.
    expect(await J.detakPenjadwal(wita("2026-10-13 10:34"))).toMatchObject({ jalan: null });
    const b = await J.detakPenjadwal(wita("2026-10-13 10:35"));
    expect(b).toMatchObject({ jalan: "berkala" });
    expect(tarikan[1]).toMatchObject({ sumber: "jadwal", utamakan: ["497/Pdt.G/2026/PA.Dgl"] });
    expect(tarikan[1].hanyaUtamakan).toBeUndefined();
    expect(tarikan[1].maksPerkara).toBeUndefined(); // jatah 25 perkara tetap dari pengaturan
  });

  it("tidak tumpang tindih: detak kedua selagi putaran berjalan dilewati; kalah cepat dari tombol = dicoba lagi", async () => {
    const tarikan: Array<Record<string, unknown>> = [];
    let lepas: (v: unknown) => void = () => {};
    J.aturAlat({
      acak: () => 1,
      sidangPerluDiperiksa: async () => [],
      jalankan: (o: Record<string, unknown>) => {
        tarikan.push(o);
        return new Promise((selesai) => {
          lepas = selesai;
        });
      },
    });
    const pertama = J.detakPenjadwal(wita("2026-10-13 12:00"));
    await new Promise((r) => setTimeout(r, 10));
    expect(await J.detakPenjadwal(wita("2026-10-13 12:01"))).toMatchObject({ jalan: null, alasan: "penarikan_lain_berjalan" });
    lepas({ dilewati: false, kode: 0 });
    expect(await pertama).toMatchObject({ jalan: "berkala" });
    expect(tarikan).toHaveLength(1);

    // Tombol "belum upload" sedang memegang kunci jembatan: putaran dilewati,
    // dan putaran berkala dicoba lagi pada detak berikutnya (tidak menunggu 60 menit).
    J.aturAlat({ jalankan: async () => ({ dilewati: true, alasan: "putaran_sebelumnya_belum_selesai" }) });
    expect(await J.detakPenjadwal(wita("2026-10-13 13:01"))).toMatchObject({ jalan: "berkala" });
    J.aturAlat({ jalankan: async (o: Record<string, unknown>) => (tarikan.push(o), { dilewati: false, kode: 0 }) });
    expect(await J.detakPenjadwal(wita("2026-10-13 13:02"))).toMatchObject({ jalan: "berkala" });
    expect(tarikan).toHaveLength(2);
    J.berhenti();
  });

  it("status penjadwal menyebut jam pagi dan putaran berkala yang sudah ditetapkan", () => {
    const s = J.getStatus();
    expect(s.pagi).toMatchObject({ jam: "08:00" });
    J.berhenti();
  });
});

describe("jembatan: sidang hari ini diutamakan di putaran yang sama", () => {
  const run = require_(path.join(AKAR, "aleta_bot/tools/ecourt-bridge/run.js")) as {
    parseArgs: (a: string[]) => Record<string, unknown>;
    susunTautanAkhir: (o: Record<string, unknown>) => { tautan: string[]; tertunda: number };
    alamatDiutamakan: (acuan: Record<string, unknown>, daftar: string[]) => { alamat: string[]; tidakKetemu: string[] };
  };
  it("--utamakan di depan, tidak memakan jatah 25; --hanya-utamakan hanya daftar itu", () => {
    expect(run.parseArgs(["--utamakan", "497/Pdt.G/2026/PA.Dgl, 70/Pdt.P/2026/PA.Dgl", "--hanya-utamakan"])).toMatchObject({
      utamakan: ["497/Pdt.G/2026/PA.Dgl", "70/Pdt.P/2026/PA.Dgl"],
      hanyaUtamakan: true,
    });
    const tautan = Array.from({ length: 40 }, (_, i) => `u${i}`);
    const a = run.susunTautanAkhir({ tautan, utama: ["s1", "u3"], maksPerkara: 25 });
    expect(a.tautan.slice(0, 2)).toEqual(["s1", "u3"]);
    expect(a.tautan).toHaveLength(27);
    expect(a.tautan.filter((u) => u === "u3")).toHaveLength(1);
    expect(run.susunTautanAkhir({ tautan, utama: ["s1"], maksPerkara: 0, hanyaUtama: true }).tautan).toEqual(["s1"]);
    const acuan = {
      perkara: new Map([["x", { nomorPerkara: "497/Pdt.G/2026/PA.Dgl", nomorRegister: "PA.DGL-10082026HXM" }]]),
      petaAlamat: new Map([["PA.DGL-10082026HXM", "https://ecourt/view/497"]]),
    };
    expect(run.alamatDiutamakan(acuan, ["497/Pdt.G/2026/PA.Dgl", "1/Pdt.G/2026/PA.Dgl"])).toEqual({
      alamat: ["https://ecourt/view/497"],
      tidakKetemu: ["1/Pdt.G/2026/PA.Dgl"],
    });
  });
});

describe("portal: kartu status & widget menyebut jadwal baru", () => {
  it("kalimat tarikan pagi dan rentang selang", () => {
    const s = {
      penjadwal: {
        aktif: true,
        zonaWaktu: "Asia/Makassar",
        selangMinMenit: 30,
        selangMaksMenit: 60,
        berikutnya: "2026-10-13T02:35:00.000Z",
        pagi: {
          aktif: true,
          jam: "08:00",
          berikutnya: "2026-10-14T00:00:00.000Z",
          susulan: false,
          terakhir: { tanggal: "2026-10-13", mulai: "2026-10-13T02:05:00.000Z", kode: 0, jumlahPerkara: 2, susulan: true },
        },
      },
    } as unknown as StatusPenarikan;
    expect(rentangSelang(s)).toBe("acak 30-60 menit");
    const k = kalimatPagi(s);
    expect(k).toContain("Tarikan pagi 08.00 WITA Senin-Jumat");
    expect(k).toContain("berikutnya 14 Okt 08.00 WITA");
    expect(k).toContain("Terakhir 13 Okt 10.05 WITA (susulan): 2 perkara sidang, berhasil.");
  });

  it("widget ekstensi: 'tiap 30-60 menit (acak)' bila bot baru, 'tiap N jam' bila bot lama", () => {
    const dasar = { jamMulai: 7, jamSelesai: 17, maksPerkara: 25, aktif: true };
    expect(ringkasTarikEcourt({ pengaturan: { ...dasar, jarakJam: 1, selangMinMenit: 30, selangMaksMenit: 60 }, dalamJamKerja: true }).keterangan).toMatch(
      /Menarik tiap 30-60 menit \(acak\), jam 07\.00-17\.00/
    );
    expect(ringkasTarikEcourt({ pengaturan: { ...dasar, jarakJam: 2 }, dalamJamKerja: true }).keterangan).toMatch(/tiap 2 jam/);
  });
});
