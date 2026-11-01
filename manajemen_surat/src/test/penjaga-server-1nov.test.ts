// @vitest-environment node
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PENGATURAN_PENJAGA_BAWAAN,
  bersihkanLaporanPenjagaHost,
  dalamJamTenang,
  pengaturanDariTersimpan,
  periksaPengaturanPenjaga,
  susunPesanKejadian,
  susunPesanPulih,
  temuanCadangan,
  temuanDisk,
  temuanHost,
  temuanLayanan,
  type LaporanPenjagaHost,
  type PengaturanPenjaga,
  type Temuan,
} from "@/lib/penjaga-server";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_PENJAGA_SERVER } from "@/server/db/schema";
import type { LaporanHost } from "@/server/modules/kapasitas/hitung";
import {
  bacaPengaturanPenjaga,
  jalankanPenjaga,
  kumpulkanTemuan,
  prosesTemuan,
  riwayatPenjaga,
  simpanPengaturanPenjaga,
  type DepsPenjaga,
  type Penerima,
} from "@/server/modules/penjaga-server/layanan";

/**
 * ============================================================================
 * PENJAGA SERVER (N4, 1 November 2026)
 * ============================================================================
 *
 * Tanpa server, tanpa WhatsApp sungguhan: waktu, bot, dan pengirim ditiru. Yang diuji adalah PERILAKU:
 * kapan dikabari, kapan tidak (tahan ulang, jam tenang, belum berturut-turut), kabar "pulih", penerima,
 * layanan mati, dan bahwa penjaga tidak pernah membersihkan apa pun. Skrip bash dijalankan sungguhan dengan
 * curl/docker/df tiruan di PATH.
 */

const REPO = path.resolve(process.cwd(), "..");
const dirTemp: string[] = [];
function dirBaru(awalan: string) {
  const d = mkdtempSync(path.join(os.tmpdir(), awalan));
  dirTemp.push(d);
  return d;
}
afterAll(() => {
  for (const d of dirTemp) rmSync(d, { recursive: true, force: true });
});

// 2026-11-01 12:00 WITA (bukan jam tenang) = 04:00 UTC.
const SIANG = Date.parse("2026-11-01T04:00:00Z");
const menit = (n: number) => n * 60_000;
const jam = (n: number) => n * 3_600_000;

const AMBANG = { ambangKuning: 80, ambangMerah: 90 };

function laporanHost(persenHome: number, persenRoot = 40): LaporanHost {
  const total = 1_000_000_000_000;
  const jalur = (kunci: string, titik: string, persen: number) => ({
    kunci,
    nama: kunci,
    jalur: titik,
    titik,
    perangkat: "/dev/sda",
    totalByte: total,
    terpakaiByte: (total * persen) / 100,
    sisaByte: total - (total * persen) / 100,
    ukuranByte: null,
  });
  return {
    dibuat: new Date(SIANG).toISOString(),
    intervalMenit: 10,
    dockerRoot: "/home/docker-data",
    postgresDir: "/home/aleta-data/postgres",
    jalur: [jalur("docker", "/home", persenHome), jalur("aleta-data", "/", persenRoot), jalur("postgres", "/home", persenHome)],
    partisi: [
      { perangkat: "/dev/sda3", titik: "/home", totalByte: total, terpakaiByte: (total * persenHome) / 100, sisaByte: total - (total * persenHome) / 100 },
      { perangkat: "/dev/sda2", titik: "/", totalByte: total, terpakaiByte: (total * persenRoot) / 100, sisaByte: total - (total * persenRoot) / 100 },
      { perangkat: "/dev/sda1", titik: "/boot", totalByte: total, terpakaiByte: total * 0.99, sisaByte: total * 0.01 },
    ],
    docker: null,
    pembersihanTerakhir: null,
  };
}

const KOSONG_HOST: LaporanPenjagaHost = { dibuat: new Date(SIANG).toISOString(), intervalMenit: 10, inode: [], temp: null, sertifikat: [], kontainer: [], abtWeb: null, portal: null };

// ───────────────────────────────────────────────────────────────────────────
// Aturan murni
// ───────────────────────────────────────────────────────────────────────────

describe("pengaturan penjaga", () => {
  it("bawaan: merah menyala, peringatan menyala, jam tenang 21.00-05.30, penerima semua Super Admin", () => {
    expect(PENGATURAN_PENJAGA_BAWAAN).toMatchObject({ merahAktif: true, peringatanAktif: true, jamTenangAktif: true, tenangMulai: "21:00", tenangSelesai: "05:30", penerimaIds: [], ulangMerahJam: 6 });
  });

  it("menolak angka di luar batas, jam yang bukan JJ:MM, saklar bukan benar/salah, dan batas merah <= kuning", () => {
    expect(periksaPengaturanPenjaga({ ulangMerahJam: 0 }).ok).toBe(false);
    expect(periksaPengaturanPenjaga({ ulangMerahJam: 3.5 }).ok).toBe(false);
    expect(periksaPengaturanPenjaga({ tenangMulai: "9:00" }).ok).toBe(false);
    expect(periksaPengaturanPenjaga({ tenangMulai: "25:00" }).ok).toBe(false);
    expect(periksaPengaturanPenjaga({ merahAktif: "ya" }).ok).toBe(false);
    expect(periksaPengaturanPenjaga({ inodeKuning: 90, inodeMerah: 90 }).ok).toBe(false);
    expect(periksaPengaturanPenjaga({ cadanganPeringatanJam: 100, cadanganMerahJam: 50 }).ok).toBe(false);
    expect(periksaPengaturanPenjaga(null).ok).toBe(false);
    const ok = periksaPengaturanPenjaga({ peringatanAktif: false, ulangMerahJam: 3, penerimaIds: ["a", "a", "b"] });
    expect(ok.ok && ok.pengaturan).toMatchObject({ peringatanAktif: false, merahAktif: true, ulangMerahJam: 3, penerimaIds: ["a", "b"] });
  });

  it("pengaturan tersimpan yang sebagian rusak: isian sah tetap dipakai, yang rusak jatuh ke bawaan", () => {
    const p = pengaturanDariTersimpan({ peringatanAktif: false, ulangMerahJam: 9999, tenangMulai: "xx" });
    expect(p.peringatanAktif).toBe(false);
    expect(p.ulangMerahJam).toBe(6);
    expect(p.tenangMulai).toBe("21:00");
  });
});

describe("jam tenang (WITA, melewati tengah malam)", () => {
  const p = { jamTenangAktif: true, tenangMulai: "21:00", tenangSelesai: "05:30" };
  const wita = (hhmm: string) => new Date(Date.parse(`2026-11-01T${hhmm}:00Z`) - jam(8));
  it("tenang 21.00 sampai sebelum 05.30; di luarnya tidak", () => {
    expect(dalamJamTenang(wita("20:59"), p)).toBe(false);
    expect(dalamJamTenang(wita("21:00"), p)).toBe(true);
    expect(dalamJamTenang(wita("23:59"), p)).toBe(true);
    expect(dalamJamTenang(wita("02:10"), p)).toBe(true);
    expect(dalamJamTenang(wita("05:29"), p)).toBe(true);
    expect(dalamJamTenang(wita("05:30"), p)).toBe(false);
    expect(dalamJamTenang(wita("12:00"), p)).toBe(false);
  });
  it("dimatikan atau mulai = selesai: tidak pernah tenang; rentang biasa (13.00-15.00) juga benar", () => {
    expect(dalamJamTenang(wita("23:00"), { ...p, jamTenangAktif: false })).toBe(false);
    expect(dalamJamTenang(wita("23:00"), { ...p, tenangSelesai: "21:00" })).toBe(false);
    const siang = { jamTenangAktif: true, tenangMulai: "13:00", tenangSelesai: "15:00" };
    expect(dalamJamTenang(wita("14:00"), siang)).toBe(true);
    expect(dalamJamTenang(wita("16:00"), siang)).toBe(false);
  });
});

describe("temuan ruang disk (memakai ambang Kapasitas yang sudah ada)", () => {
  it("/home 93% = merah, / 82% = peringatan, /boot diabaikan, yang di bawah ambang tidak jadi temuan", () => {
    const t = temuanDisk({ laporan: laporanHost(93, 82), partisiBot: null, kapasitas: AMBANG });
    expect(t.map((x) => [x.kunci, x.tingkat])).toEqual([
      ["disk:/home", "merah"],
      ["disk:/", "peringatan"],
    ]);
    expect(t[0].uraian).toMatch(/93%/);
    expect(t[0].uraian).toMatch(/batas merah 90%/);
    expect(t[0].uraian).toMatch(/data aplikasi/);
    expect(temuanDisk({ laporan: laporanHost(50, 40), partisiBot: null, kapasitas: AMBANG })).toEqual([]);
  });
  it("tepat di batas sudah berwarna (sama dengan cron: >=); ambang dari pengaturan, bukan angka tetap", () => {
    expect(temuanDisk({ laporan: laporanHost(80), partisiBot: null, kapasitas: AMBANG }).map((x) => x.tingkat)).toEqual(["peringatan"]);
    expect(temuanDisk({ laporan: laporanHost(80), partisiBot: null, kapasitas: { ambangKuning: 85, ambangMerah: 95 } })).toEqual([]);
  });
  it("tanpa laporan server: memakai partisi yang diukur bot (tanpa /boot)", () => {
    const t = temuanDisk({
      laporan: null,
      partisiBot: [
        { titik: "/home", totalByte: 1000, terpakaiByte: 960 },
        { titik: "/boot", totalByte: 1000, terpakaiByte: 990 },
      ],
      kapasitas: AMBANG,
    });
    expect(t.map((x) => x.kunci)).toEqual(["disk:/home"]);
  });
});

describe("temuan cadangan harian", () => {
  const p = PENGATURAN_PENJAGA_BAWAAN;
  const kini = new Date(SIANG);
  const catat = (jamLalu: number, byte = 50_000_000, berhasil = true) => ({ selesai: new Date(SIANG - jam(jamLalu)).toISOString(), berhasil, byte });
  it("normal (kemarin, ukuran biasa): tidak ada temuan; riwayat kosong: tidak menebak", () => {
    expect(temuanCadangan([catat(8), catat(32), catat(56)], kini, p)).toEqual([]);
    expect(temuanCadangan([], kini, p)).toEqual([]);
  });
  it("gagal = merah; tidak terbentuk > 36 jam = peringatan, > 72 jam = merah", () => {
    expect(temuanCadangan([catat(2, 0, false), catat(26)], kini, p)[0]).toMatchObject({ kunci: "cadangan", tingkat: "merah", judul: "Cadangan data gagal dibuat" });
    expect(temuanCadangan([catat(40)], kini, p)[0]).toMatchObject({ tingkat: "peringatan", judul: "Cadangan harian tidak terbentuk" });
    expect(temuanCadangan([catat(80)], kini, p)[0]).toMatchObject({ tingkat: "merah" });
  });
  it("terlalu kecil: jauh di bawah median cadangan sebelumnya, atau di bawah batas mutlak", () => {
    const kecil = temuanCadangan([catat(8, 10_000_000), catat(32), catat(56), catat(80)], kini, p);
    expect(kecil[0]).toMatchObject({ tingkat: "peringatan", judul: "Cadangan data terlalu kecil" });
    expect(kecil[0].uraian).toMatch(/jauh lebih kecil/);
    const mutlak = temuanCadangan([catat(8, 2_000)], kini, p);
    expect(mutlak[0]).toMatchObject({ judul: "Cadangan data terlalu kecil" });
    // tepat 50% dari biasanya belum dianggap kecil
    expect(temuanCadangan([catat(8, 25_000_000), catat(32), catat(56), catat(80)], kini, p)).toEqual([]);
  });
});

describe("temuan dari pemantau di server dan layanan", () => {
  const p = PENGATURAN_PENJAGA_BAWAAN;
  it("jumlah berkas (inode), sertifikat, kontainer berhenti/tidak sehat, halaman ABT mati", () => {
    const host: LaporanPenjagaHost = {
      ...KOSONG_HOST,
      inode: [
        { titik: "/", persen: 97 },
        { titik: "/home", persen: 88 },
        { titik: "/data", persen: 20 },
      ],
      sertifikat: [
        { nama: "aleta.example", hariTersisa: 3 },
        { nama: "lain.example", hariTersisa: 10 },
        { nama: "aman.example", hariTersisa: 60 },
      ],
      kontainer: [
        { nama: "aleta-portal", keadaan: "running", sehat: "healthy" },
        { nama: "aleta-bot", keadaan: "exited", sehat: "" },
        { nama: "aleta-postgres", keadaan: "running", sehat: "unhealthy" },
      ],
      abtWeb: { kode: 0 },
    };
    const t = temuanHost(host, p, AMBANG, new Set());
    const peta = Object.fromEntries(t.map((x) => [x.kunci, x]));
    expect(peta["inode:/"].tingkat).toBe("merah");
    expect(peta["inode:/home"].tingkat).toBe("peringatan");
    expect(peta["inode:/data"]).toBeUndefined();
    expect(peta["sertifikat:aleta.example"].tingkat).toBe("merah");
    expect(peta["sertifikat:lain.example"].tingkat).toBe("peringatan");
    expect(peta["sertifikat:aman.example"]).toBeUndefined();
    expect(peta["kontainer:aleta-bot"]).toMatchObject({ tingkat: "merah", butuhBerturut: 2 });
    expect(peta["kontainer:aleta-postgres"].tingkat).toBe("merah");
    expect(peta["kontainer:aleta-portal"]).toBeUndefined();
    expect(peta["web:abt"]).toMatchObject({ tingkat: "merah", butuhBerturut: 2 });
  });
  it("folder sementara di partisi yang sudah dipantau tidak dihitung dua kali; di partisi lain dihitung", () => {
    const host: LaporanPenjagaHost = { ...KOSONG_HOST, temp: { jalur: "/home/aleta-tmp", titik: "/home", persen: 95, sisaByte: 1000 } };
    expect(temuanHost(host, p, AMBANG, new Set(["/home"]))).toEqual([]);
    expect(temuanHost(host, p, AMBANG, new Set(["/"])).map((x) => x.kunci)).toEqual(["temp:sementara"]);
  });
  it("layanan: hanya yang MERAH dan yang dijaga; kuning/kelabu/ekstensi diam; perlu dua kali terlihat", () => {
    const t = temuanLayanan([
      { kunci: "bot", warna: "merah", ringkas: "ALETA Bot tidak menjawab." },
      { kunci: "sipp", warna: "kuning", ringkas: "lambat" },
      { kunci: "abt", warna: "kelabu", ringkas: "-" },
      { kunci: "ekstensi", warna: "merah", ringkas: "x" },
      { kunci: "basis-data", warna: "merah", ringkas: "tidak menjawab" },
    ]);
    expect(t.map((x) => x.kunci)).toEqual(["layanan:bot", "layanan:basis-data"]);
    expect(t.every((x) => x.butuhBerturut === 2 && x.tingkat === "merah")).toBe(true);
  });
  it("laporan pemantau mentah: isi aneh dibuang, bukan diperbaiki", () => {
    expect(bersihkanLaporanPenjagaHost(null)).toBeNull();
    expect(bersihkanLaporanPenjagaHost({ dibuat: "bukan tanggal" })).toBeNull();
    const l = bersihkanLaporanPenjagaHost({
      dibuat: new Date(SIANG).toISOString(),
      inode: [{ titik: "/", persen: 50 }, { titik: "/x", persen: 400 }, { persen: 3 }],
      sertifikat: [{ nama: "a", hariTersisa: "abc" }],
      kontainer: [{ nama: "aleta-bot", keadaan: "RUNNING", sehat: "" }],
      abtWeb: { kode: 200 },
    });
    expect(l?.inode).toEqual([{ titik: "/", persen: 50 }]);
    expect(l?.sertifikat).toEqual([]);
    expect(l?.kontainer).toEqual([{ nama: "aleta-bot", keadaan: "running", sehat: "" }]);
    expect(l?.abtWeb).toEqual({ kode: 200 });
  });
});

describe("bunyi pesan", () => {
  const dasar = { judul: "Ruang penyimpanan hampir habis", uraian: "Tempat penyimpanan /home sudah terpakai 93%.", mulaiAt: new Date(SIANG - menit(15)).toISOString(), tingkat: "merah" as const };
  it("kabar pertama, pengingat, memburuk, dan pulih: bahasa sehari-hari, jam WITA, tanpa istilah teknis", () => {
    const kini = new Date(SIANG);
    const pertama = susunPesanKejadian({ ...dasar, jumlahKabar: 0, kabarTingkat: "" }, kini, "merah");
    expect(pertama).toMatch(/^Penjaga server - PERLU DITANGANI/);
    expect(pertama).toMatch(/terlihat sejak 11\.45 WITA, dikabari 12\.00 WITA/i);
    const ulang = susunPesanKejadian({ ...dasar, jumlahKabar: 1, kabarTingkat: "merah" }, kini, "merah");
    expect(ulang).toMatch(/Pengingat ke-2/);
    const naik = susunPesanKejadian({ ...dasar, jumlahKabar: 1, kabarTingkat: "peringatan" }, kini, "merah");
    expect(naik).toMatch(/memburuk/);
    expect(susunPesanKejadian({ ...dasar, tingkat: "peringatan", jumlahKabar: 0, kabarTingkat: "" }, kini, "peringatan")).toMatch(/pemberitahuan/);
    const pulih = susunPesanPulih({ judul: dasar.judul, mulaiAt: dasar.mulaiAt, pulihAt: new Date(SIANG + menit(45)).toISOString() });
    expect(pulih).toMatch(/sudah pulih/);
    expect(pulih).toMatch(/Berlangsung 1 jam/);
    for (const teks of [pertama, ulang, naik, pulih]) expect(teks).not.toMatch(/\binode\b|ECONN|exception|\bstack\b|\bundefined\b|\bnull\b|\bNaN\b|bodoh|lalai|salah Anda/i);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Mesin kejadian (basis data memori, waktu dan pengirim tiruan)
// ───────────────────────────────────────────────────────────────────────────

let db: AletaDatabase | null = null;
let dirCermin = "";
const envAsli = process.env.ALETA_KAPASITAS_DIR;

beforeEach(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
  dirCermin = dirBaru("penjaga-cermin-");
  process.env.ALETA_KAPASITAS_DIR = dirCermin;
});
afterEach(async () => {
  await db?.close();
  db = null;
  if (envAsli === undefined) delete process.env.ALETA_KAPASITAS_DIR;
  else process.env.ALETA_KAPASITAS_DIR = envAsli;
  vi.restoreAllMocks();
});

const ADMIN: Penerima = [{ id: "u-1", nama: "Derry", nomor: "081234567890" }];

function pengirim(gagal = false) {
  const terkirim: Array<{ penerima: Penerima; pesan: string; kunci: string }> = [];
  const kirim = async (penerima: Penerima, pesan: string, kunci: string) => {
    if (gagal) return { terkirim: 0, gagal: penerima.length };
    terkirim.push({ penerima, pesan, kunci });
    return { terkirim: penerima.length, gagal: 0 };
  };
  return { kirim, terkirim };
}

function temuan(kunci: string, tingkat: "merah" | "peringatan", butuh = 1): Temuan {
  return { kunci, tingkat, judul: `Judul ${kunci}`, uraian: `Uraian ${kunci}`, butuhBerturut: butuh };
}

async function putaran(
  pada: number,
  daftar: Temuan[],
  kirim: ReturnType<typeof pengirim>["kirim"],
  opsi: { p?: Partial<PengaturanPenjaga>; dinilai?: string[]; penerima?: Penerima } = {}
) {
  const kelompok = new Set(opsi.dinilai ?? ["disk", "layanan", "cadangan", "inode", "kontainer", "temp", "sertifikat", "web", "pemantau"]);
  return prosesTemuan(
    db!,
    { temuan: daftar, dinilai: kelompok },
    { kini: new Date(pada), pengaturan: { ...PENGATURAN_PENJAGA_BAWAAN, ...(opsi.p ?? {}) }, penerima: async () => opsi.penerima ?? ADMIN, kirim }
  );
}

describe("satu pesan per kejadian, tahan ulang, pulih", () => {
  it("merah di tengah hari: SATU pesan; 5 menit kemudian tidak ada lagi; sesudah 6 jam satu pengingat", async () => {
    const k = pengirim();
    await putaran(SIANG, [temuan("disk:/home", "merah")], k.kirim);
    expect(k.terkirim).toHaveLength(1);
    expect(k.terkirim[0].pesan).toMatch(/PERLU DITANGANI/);
    await putaran(SIANG + menit(5), [temuan("disk:/home", "merah")], k.kirim);
    await putaran(SIANG + jam(3), [temuan("disk:/home", "merah")], k.kirim);
    await putaran(SIANG + jam(5) + menit(59), [temuan("disk:/home", "merah")], k.kirim);
    expect(k.terkirim).toHaveLength(1);
    await putaran(SIANG + jam(6), [temuan("disk:/home", "merah")], k.kirim);
    expect(k.terkirim).toHaveLength(2);
    expect(k.terkirim[1].pesan).toMatch(/Pengingat ke-2/);
    const { berlangsung } = await riwayatPenjaga(db!);
    expect(berlangsung).toHaveLength(1);
    expect(berlangsung[0].jumlahKabar).toBe(2);
  });

  it("pulih: kabar sekali sesudah stabil 10 menit, lalu diam; kejadian pindah ke riwayat dengan lama berlangsung", async () => {
    const k = pengirim();
    await putaran(SIANG, [temuan("disk:/home", "merah")], k.kirim);
    await putaran(SIANG + menit(30), [], k.kirim); // hilang -> pulih dicatat, belum dikabari (menunggu stabil)
    expect(k.terkirim).toHaveLength(1);
    await putaran(SIANG + menit(35), [], k.kirim);
    expect(k.terkirim).toHaveLength(1);
    await putaran(SIANG + menit(41), [], k.kirim);
    expect(k.terkirim).toHaveLength(2);
    expect(k.terkirim[1].pesan).toMatch(/sudah pulih/);
    expect(k.terkirim[1].pesan).toMatch(/Berlangsung 30 menit/);
    await putaran(SIANG + menit(60), [], k.kirim);
    await putaran(SIANG + jam(5), [], k.kirim);
    expect(k.terkirim).toHaveLength(2);
    const r = await riwayatPenjaga(db!);
    expect(r.berlangsung).toHaveLength(0);
    expect(r.riwayat).toHaveLength(1);
    expect(r.riwayat[0].kabarPulihAt).not.toBe("");
  });

  it("kejadian yang tidak pernah dikabari (mis. hanya sekali terlihat) tidak menghasilkan kabar pulih", async () => {
    const k = pengirim();
    await putaran(SIANG, [temuan("layanan:bot", "merah", 2)], k.kirim);
    await putaran(SIANG + menit(5), [], k.kirim);
    await putaran(SIANG + menit(30), [], k.kirim);
    expect(k.terkirim).toHaveLength(0);
  });

  it("layanan mati: baru dikabari sesudah dua putaran berturut-turut (mulai-ulang sesaat tidak membangunkan)", async () => {
    const k = pengirim();
    await putaran(SIANG, [temuan("layanan:bot", "merah", 2)], k.kirim);
    expect(k.terkirim).toHaveLength(0);
    await putaran(SIANG + menit(5), [temuan("layanan:bot", "merah", 2)], k.kirim);
    expect(k.terkirim).toHaveLength(1);
    expect(k.terkirim[0].pesan).toMatch(/Judul layanan:bot/);
  });

  it("naik-turun sesaat (mati, hidup, mati lagi dalam 10 menit) tetap SATU kejadian, tanpa kabar kedua", async () => {
    const k = pengirim();
    const mati = [temuan("layanan:bot", "merah", 2)];
    await putaran(SIANG, mati, k.kirim);
    await putaran(SIANG + menit(5), mati, k.kirim);
    expect(k.terkirim).toHaveLength(1);
    await putaran(SIANG + menit(10), [], k.kirim);
    await putaran(SIANG + menit(15), mati, k.kirim);
    await putaran(SIANG + menit(20), mati, k.kirim);
    expect(k.terkirim).toHaveLength(1);
    const r = await riwayatPenjaga(db!);
    expect(r.berlangsung).toHaveLength(1);
    expect(r.riwayat).toHaveLength(0);
  });
});

describe("jam tenang dan saklar", () => {
  const MALAM = Date.parse("2026-11-01T15:00:00Z"); // 23.00 WITA
  const PAGI = Date.parse("2026-11-01T22:30:00Z"); // 06.30 WITA

  it("peringatan di malam hari ditahan sampai pagi (dikirim sekali); merah di malam hari langsung dikirim", async () => {
    const k = pengirim();
    const p = { ulangMerahJam: 12 }; // pengingat merah tidak ikut campur dalam tes ini
    await putaran(MALAM, [temuan("disk:/", "peringatan"), temuan("cadangan", "merah")], k.kirim, { p });
    expect(k.terkirim).toHaveLength(1);
    expect(k.terkirim[0].pesan).toMatch(/Judul cadangan/);
    const h = await putaran(MALAM + menit(5), [temuan("disk:/", "peringatan"), temuan("cadangan", "merah")], k.kirim, { p });
    expect(h.ditahanJamTenang).toBe(1);
    expect(k.terkirim).toHaveLength(1);
    await putaran(PAGI, [temuan("disk:/", "peringatan"), temuan("cadangan", "merah")], k.kirim, { p });
    const pagi = k.terkirim.slice(1);
    expect(pagi).toHaveLength(1);
    expect(pagi[0].pesan).toMatch(/Judul disk:\//);
    expect(pagi[0].pesan).toMatch(/pemberitahuan/);
  });

  it("jam tenang dimatikan: peringatan malam hari langsung dikirim", async () => {
    const k = pengirim();
    await putaran(MALAM, [temuan("disk:/", "peringatan")], k.kirim, { p: { jamTenangAktif: false } });
    expect(k.terkirim).toHaveLength(1);
  });

  it("kabar pulih untuk kejadian merah dikirim malam hari; pulih peringatan menunggu pagi", async () => {
    const k = pengirim();
    await putaran(PAGI - jam(12), [temuan("disk:/", "peringatan")], k.kirim); // 18.30 WITA: sebelum tenang
    await putaran(MALAM - jam(1), [temuan("cadangan", "merah")], k.kirim);
    const awal = k.terkirim.length;
    expect(awal).toBe(2);
    await putaran(MALAM, [], k.kirim);
    await putaran(MALAM + menit(11), [], k.kirim);
    const malam = k.terkirim.slice(awal);
    expect(malam.map((m) => /sudah pulih/.test(m.pesan))).toEqual([true]);
    expect(malam[0].pesan).toMatch(/Judul cadangan/);
    await putaran(PAGI, [], k.kirim);
    const pagi = k.terkirim.slice(awal + 1);
    expect(pagi).toHaveLength(1);
    expect(pagi[0].pesan).toMatch(/Judul disk:\//);
  });

  it("naik dari peringatan ke merah: kabar baru segera (keadaannya memburuk), tidak menunggu 24 jam", async () => {
    const k = pengirim();
    await putaran(SIANG, [temuan("disk:/home", "peringatan")], k.kirim);
    await putaran(SIANG + menit(5), [temuan("disk:/home", "peringatan")], k.kirim);
    expect(k.terkirim).toHaveLength(1);
    await putaran(SIANG + menit(10), [temuan("disk:/home", "merah")], k.kirim);
    expect(k.terkirim).toHaveLength(2);
    expect(k.terkirim[1].pesan).toMatch(/memburuk/);
  });

  it("peringatan dimatikan: kuning diam tetapi tetap tercatat; merah tetap dikabari", async () => {
    const k = pengirim();
    await putaran(SIANG, [temuan("disk:/", "peringatan"), temuan("cadangan", "merah")], k.kirim, { p: { peringatanAktif: false } });
    expect(k.terkirim).toHaveLength(1);
    expect(k.terkirim[0].pesan).toMatch(/Judul cadangan/);
    expect((await riwayatPenjaga(db!)).berlangsung).toHaveLength(2);
  });

  it("merah dimatikan: kejadian merah diperlakukan sebagai pemberitahuan biasa; keduanya mati = diam sama sekali", async () => {
    const k = pengirim();
    await putaran(SIANG, [temuan("cadangan", "merah")], k.kirim, { p: { merahAktif: false } });
    expect(k.terkirim).toHaveLength(1);
    expect(k.terkirim[0].pesan).toMatch(/pemberitahuan/);
    const k2 = pengirim();
    await putaran(SIANG, [temuan("disk:/home", "merah")], k2.kirim, { p: { merahAktif: false, peringatanAktif: false } });
    expect(k2.terkirim).toHaveLength(0);
  });
});

describe("penerima, kegagalan kirim, banyak kejadian", () => {
  it("kirim gagal (bot mati): tidak dianggap terkirim, dicoba lagi putaran berikutnya, lalu tidak diulang", async () => {
    const gagal = pengirim(true);
    const h = await putaran(SIANG, [temuan("disk:/home", "merah")], gagal.kirim);
    expect(h.gagal).toBe(1);
    expect((await riwayatPenjaga(db!)).berlangsung[0]).toMatchObject({ kabarAt: "", catatan: expect.stringMatching(/belum terkirim/) });
    const baik = pengirim();
    await putaran(SIANG + menit(5), [temuan("disk:/home", "merah")], baik.kirim);
    expect(baik.terkirim).toHaveLength(1);
    await putaran(SIANG + menit(10), [temuan("disk:/home", "merah")], baik.kirim);
    expect(baik.terkirim).toHaveLength(1);
    expect((await riwayatPenjaga(db!)).berlangsung[0].catatan).toBe("");
  });

  it("pengirim yang melempar galat tidak menjatuhkan putaran", async () => {
    const h = await putaran(SIANG, [temuan("disk:/home", "merah")], async () => {
      throw new Error("bot mati");
    });
    expect(h.gagal).toBe(1);
  });

  it("tanpa penerima (tidak ada Super Admin bernomor): tidak mengirim, dicatat, tidak melempar", async () => {
    const k = pengirim();
    const h = await putaran(SIANG, [temuan("disk:/home", "merah")], k.kirim, { penerima: [] });
    expect(h.tanpaPenerima).toBe(true);
    expect(k.terkirim).toHaveLength(0);
    expect((await riwayatPenjaga(db!)).berlangsung[0].catatan).toMatch(/Belum ada penerima/);
  });

  it("penerima dibatasi pilihan Super Admin", async () => {
    const k = pengirim();
    const dua: Penerima = [...ADMIN, { id: "u-2", nama: "Lain", nomor: "081111111111" }];
    await putaran(SIANG, [temuan("disk:/home", "merah")], k.kirim, { penerima: dua, p: { penerimaIds: ["u-2"] } });
    expect(k.terkirim[0].penerima.map((p) => p.id)).toEqual(["u-2"]);
  });

  it("lebih dari tiga kejadian sekaligus (mis. server baru menyala): SATU pesan ringkasan, bukan hujan pesan", async () => {
    const k = pengirim();
    await putaran(SIANG, ["a", "b", "c", "d", "e"].map((x) => temuan(`disk:/${x}`, "merah")), k.kirim);
    expect(k.terkirim).toHaveLength(1);
    expect(k.terkirim[0].pesan).toMatch(/Ada 5 hal/);
    await putaran(SIANG + menit(5), ["a", "b", "c", "d", "e"].map((x) => temuan(`disk:/${x}`, "merah")), k.kirim);
    expect(k.terkirim).toHaveLength(1);
  });

  it("tiga kejadian atau kurang: satu pesan untuk tiap kejadian", async () => {
    const k = pengirim();
    await putaran(SIANG, [temuan("disk:/a", "merah"), temuan("cadangan", "merah"), temuan("web:abt", "merah")], k.kirim);
    expect(k.terkirim).toHaveLength(3);
  });

  it("sumber yang tidak terbaca putaran ini (tidak dinilai) tidak membuat kejadian dianggap pulih", async () => {
    const k = pengirim();
    await putaran(SIANG, [temuan("disk:/home", "merah")], k.kirim);
    await putaran(SIANG + menit(20), [], k.kirim, { dinilai: ["layanan", "cadangan"] }); // disk tidak terbaca
    await putaran(SIANG + menit(40), [], k.kirim, { dinilai: ["layanan", "cadangan"] });
    expect(k.terkirim).toHaveLength(1);
    expect((await riwayatPenjaga(db!)).berlangsung).toHaveLength(1);
  });

  it("isi pesan tidak memuat nomor penerima; log konsol tidak memuat nomor", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const k = pengirim();
    await putaran(SIANG, [temuan("disk:/home", "merah")], k.kirim);
    expect(k.terkirim[0].pesan).not.toContain("081234567890");
    expect(k.terkirim[0].pesan).not.toContain("6281234567890");
    expect(JSON.stringify([...log.mock.calls, ...err.mock.calls])).not.toMatch(/8123456789/);
  });

  it("riwayat pulih lebih dari 90 hari dibuang; yang lebih baru dan yang berlangsung tetap", async () => {
    const k = pengirim();
    await putaran(SIANG - 100 * 86_400_000, [temuan("disk:/lama", "merah")], k.kirim);
    await putaran(SIANG - 100 * 86_400_000 + menit(5), [], k.kirim);
    await putaran(SIANG - 10 * 86_400_000, [temuan("disk:/baru", "merah")], k.kirim);
    await putaran(SIANG - 10 * 86_400_000 + menit(5), [], k.kirim);
    await putaran(SIANG, [temuan("disk:/kini", "merah")], k.kirim);
    const r = await riwayatPenjaga(db!);
    expect(r.riwayat.map((x) => x.kunci)).toEqual(["disk:/baru"]);
    expect(r.berlangsung.map((x) => x.kunci)).toEqual(["disk:/kini"]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Pengumpulan + putaran lengkap (dep tiruan)
// ───────────────────────────────────────────────────────────────────────────

function depsTiruan(o: Partial<DepsPenjaga> & { kirim: DepsPenjaga["kirim"]; pada: () => number }): DepsPenjaga {
  return {
    kini: () => new Date(o.pada()),
    komponen: o.komponen ?? (async () => []),
    kapasitas: o.kapasitas ?? (async () => null),
    host: o.host ?? (async () => null),
    cadangan: o.cadangan ?? (async () => []),
    penerima: o.penerima ?? (async () => ADMIN),
    kirim: o.kirim,
  };
}

describe("kumpulkanTemuan dan jalankanPenjaga", () => {
  it("layanan mati (bot) lewat dua putaran dari komponen Pusat Kesehatan -> satu kabar; hidup lagi -> pulih", async () => {
    let t = SIANG;
    let botMati = true;
    const k = pengirim();
    const deps = depsTiruan({
      pada: () => t,
      kirim: k.kirim,
      komponen: async () => [
        { kunci: "bot", warna: botMati ? "merah" : "hijau", ringkas: botMati ? "ALETA Bot tidak menjawab." : "Berjalan." },
        { kunci: "whatsapp", warna: "hijau", ringkas: "tersambung" },
      ],
    });
    await jalankanPenjaga(db!, { deps });
    expect(k.terkirim).toHaveLength(0);
    t += menit(5);
    await jalankanPenjaga(db!, { deps });
    expect(k.terkirim).toHaveLength(1);
    expect(k.terkirim[0].pesan).toMatch(/ALETA Bot bermasalah/);
    expect(k.terkirim[0].pesan).toMatch(/WhatsApp, penarikan data SIPP/);
    botMati = false;
    t += menit(5);
    await jalankanPenjaga(db!, { deps });
    t += menit(11);
    await jalankanPenjaga(db!, { deps });
    expect(k.terkirim).toHaveLength(2);
    expect(k.terkirim[1].pesan).toMatch(/ALETA Bot bermasalah[\s\S]*sudah kembali normal/);
  });

  it("disk dari laporan server + cadangan gagal + inode dari pemantau; hasil kumpulan memuat kelompok yang dinilai", async () => {
    const k = pengirim();
    const deps = depsTiruan({
      pada: () => SIANG,
      kirim: k.kirim,
      kapasitas: async () => ({ laporan: laporanHost(93, 40), partisiBot: null, setelan: { ...AMBANG, pembersihanOtomatis: false, umurCacheJam: 72 }, hasil: { sumber: "host", basi: false, umurMenit: 1 } as never }),
      host: async () => ({ ...KOSONG_HOST, inode: [{ titik: "/home", persen: 96 }] }),
      cadangan: async () => [{ selesai: new Date(SIANG - jam(2)).toISOString(), berhasil: false, byte: 0 }],
    });
    const kum = await kumpulkanTemuan(deps, PENGATURAN_PENJAGA_BAWAAN);
    expect(kum.temuan.map((x) => x.kunci).sort()).toEqual(["cadangan", "disk:/home", "inode:/home"]);
    expect([...kum.dinilai].sort()).toEqual(["cadangan", "disk", "inode", "kontainer", "layanan", "pemantau", "sertifikat", "temp"]);
    await jalankanPenjaga(db!, { deps });
    expect(k.terkirim).toHaveLength(3);
  });

  it("laporan pemantau yang basi tidak dipercaya (kejadian dibiarkan); sumber yang gagal dibaca tidak dinilai", async () => {
    const basi: LaporanPenjagaHost = { ...KOSONG_HOST, dibuat: new Date(SIANG - jam(2)).toISOString(), inode: [{ titik: "/", persen: 99 }] };
    const kum = await kumpulkanTemuan(
      depsTiruan({ pada: () => SIANG, kirim: pengirim().kirim, host: async () => basi, komponen: async () => null, cadangan: async () => null }),
      PENGATURAN_PENJAGA_BAWAAN
    );
    expect(kum.temuan).toEqual([]);
    expect([...kum.dinilai]).toEqual([]);
  });

  it("kedua kabar mati: penjaga tidak berbuat apa-apa; pengaturan tersimpan dan terbaca ulang", async () => {
    const k = pengirim();
    await simpanPengaturanPenjaga(db!, { merahAktif: false, peringatanAktif: false });
    expect((await bacaPengaturanPenjaga(db!)).merahAktif).toBe(false);
    const h = await jalankanPenjaga(db!, { deps: depsTiruan({ pada: () => SIANG, kirim: k.kirim, cadangan: async () => [{ selesai: new Date(SIANG - jam(2)).toISOString(), berhasil: false, byte: 0 }] }) });
    expect(h).toBeNull();
    expect(k.terkirim).toHaveLength(0);
    expect((await riwayatPenjaga(db!)).berlangsung).toHaveLength(0);
  });

  it("simpan menolak isian buruk (400) dan tidak mengubah yang tersimpan; bawaan tanpa simpanan = merah dan peringatan menyala", async () => {
    expect(await bacaPengaturanPenjaga(db!)).toMatchObject({ merahAktif: true, peringatanAktif: true });
    await expect(simpanPengaturanPenjaga(db!, { ulangMerahJam: -5 })).rejects.toMatchObject({ status: 400 });
    expect((await bacaPengaturanPenjaga(db!)).ulangMerahJam).toBe(6);
  });

  it("putaran menulis cerminan penerima untuk pemantau di server (mode terbatas), hanya angka nomor, dan tidak menulis ulang bila sama", async () => {
    const k = pengirim();
    const deps = depsTiruan({ pada: () => SIANG, kirim: k.kirim });
    await jalankanPenjaga(db!, { deps });
    const jalur = path.join(dirCermin, "penjaga-penerima.json");
    expect(existsSync(jalur)).toBe(true);
    const isi = JSON.parse(readFileSync(jalur, "utf8")) as { merahAktif: boolean; penerima: Array<{ nomor: string }> };
    expect(isi.merahAktif).toBe(true);
    expect(isi.penerima).toEqual([{ nama: "Derry", nomor: "6281234567890" }]);
    const t1 = readFileSync(jalur, "utf8");
    await jalankanPenjaga(db!, { deps });
    expect(readFileSync(jalur, "utf8")).toBe(t1);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Tiga tempat pendaftaran tabel + keselamatan
// ───────────────────────────────────────────────────────────────────────────

describe("migrasi 0125 dan keselamatan (hanya mengabari)", () => {
  const akarPortal = process.cwd();
  it("SQL 0125 = cermin schema.ts; terdaftar di jurnal sebagai idx 109 dan di urutan simpan pg-mem; nomor diklaim", () => {
    const sql = readFileSync(path.join(akarPortal, "drizzle/0125_aleta_penjaga_server.sql"), "utf8");
    const rapat = (s: string) => s.replace(/--[^\n]*/g, "").replace(/;/g, "").replace(/\s+/g, " ").trim();
    expect(rapat(sql)).toBe(rapat([...DDL_PENJAGA_SERVER.tabel, ...DDL_PENJAGA_SERVER.indeks].join(" ")));
    const jurnal = JSON.parse(readFileSync(path.join(akarPortal, "drizzle/meta/_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string; when: number }> };
    expect(jurnal.entries.filter((e) => e.tag === "0125_aleta_penjaga_server")).toEqual([expect.objectContaining({ idx: 109 })]);
    const tanggal = jurnal.entries.map((e) => e.when);
    expect(tanggal).toEqual([...tanggal].sort((a, b) => a - b));
    expect(readFileSync(path.join(akarPortal, "src/server/db/client.ts"), "utf8")).toContain('"aleta_penjaga_kejadian"');
  });

  it("penjaga tidak punya jalur pembersihan: tak ada perintah hapus/bersih/hentikan di kode atau skrip", () => {
    const berkas = [
      path.join(akarPortal, "src/lib/penjaga-server.ts"),
      path.join(akarPortal, "src/server/modules/penjaga-server/layanan.ts"),
      path.join(REPO, "scripts/kapasitas/penjaga-host.sh"),
    ].map((j) => readFileSync(j, "utf8").replace(/^\s*(\/\/|\*|\/\*|#).*$/gm, ""));
    for (const isi of berkas) {
      expect(isi).not.toMatch(/rmSync|unlink|rmdir|\bprune\b|docker\s+(rm|stop|restart|kill|system|builder|volume|image)|systemctl|chmod\s+[0-7]*7[0-7]*\s+\//);
    }
    // skrip: satu-satunya `rm` menyentuh berkas penanda/badan miliknya sendiri di folder pertukaran
    const rm = berkas[2].match(/\brm\s+[^\n]*/g) ?? [];
    expect(rm.length).toBeGreaterThan(0);
    for (const baris of rm) expect(baris).toMatch(/^rm -f "\$(badan|S_[A-Z]+)"/);
    // satu-satunya DELETE di modul: riwayat kejadian milik penjaga sendiri
    const mesin = berkas[1];
    const hapus = mesin.match(/DELETE FROM \w+/g) ?? [];
    expect(hapus).toEqual(["DELETE FROM aleta_penjaga_kejadian"]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Skrip pemantau di server (bash sungguhan, curl/docker/df tiruan)
// ───────────────────────────────────────────────────────────────────────────

function cariBash(): string | null {
  const kandidat = [process.env.ALETA_BASH, "C:/Program Files/Git/bin/bash.exe", "C:/Program Files/Git/usr/bin/bash.exe", "/bin/bash", "/usr/bin/bash"].filter(Boolean) as string[];
  return kandidat.find((k) => existsSync(k)) ?? null;
}
const BASH = cariBash();
function posix(p: string) {
  return p.replace(/\\/g, "/").replace(/^([A-Za-z]):/, (_m, d: string) => `/${d.toLowerCase()}`);
}
const SKRIP = path.join(REPO, "scripts", "kapasitas");
const TOKEN_RAHASIA = "tokenrahasia-12345";

function sediakanHost(opsi: { mirror?: Record<string, unknown> | null } = {}) {
  const akar = dirBaru("penjaga-host-");
  const bin = path.join(akar, "bin");
  const app = path.join(akar, "app");
  const data = path.join(akar, "data");
  const kap = path.join(data, "reports", "kapasitas");
  for (const d of [bin, app, data, kap]) mkdirSync(d, { recursive: true });
  const p = posix(akar);
  writeFileSync(path.join(app, ".env.production"), `ALETA_BOT_INTERNAL_API_TOKEN=${TOKEN_RAHASIA}\nLAIN=1\n`);
  writeFileSync(path.join(akar, "kode-portal"), "200");
  writeFileSync(
    path.join(bin, "curl"),
    `#!/bin/bash
echo "$*" >> '${p}/curl-argumen.log'
url="\${@: -1}"
case "$url" in
  *enqueue*)
    echo "ENQUEUE $url" >> '${p}/enqueue.log'
    for a in "$@"; do case "$a" in @*) cat "\${a#@}" >> '${p}/enqueue.log'; echo >> '${p}/enqueue.log' ;; esac; done
    cat >> '${p}/curl-stdin.log'
    echo -n "$(cat '${p}/kode-bot' 2>/dev/null || echo 200)" ;;
  *login*) echo -n "$(cat '${p}/kode-portal')" ;;
  *) echo -n 200 ;;
esac
`
  );
  writeFileSync(
    path.join(bin, "docker"),
    `#!/bin/bash
echo "$@" >> '${p}/docker.log'
if [ "$1" = "ps" ]; then
  printf 'aleta-portal|running|Up 2 hours\\naleta-bot|exited|Exited (1) 3 minutes ago\\naleta-postgres|running|Up 2 hours (healthy)\\nlain-saja|exited|Exited (0) 1 day ago\\n'
fi
`
  );
  writeFileSync(
    path.join(bin, "df"),
    `#!/bin/bash
if [ "$1" = "-Pi" ]; then
  echo "Filesystem Inodes IUsed IFree IUse% Mounted on"
  echo "/dev/sim1 1000 970 30 97% /"
  echo "/dev/sim2 1000 100 900 10% /home"
else
  echo "Filesystem 1-blocks Used Available Capacity Mounted on"
  echo "/dev/sim1 1000 950 50 95% /"
fi
`
  );
  writeFileSync(
    path.join(bin, "openssl"),
    `#!/bin/bash
echo "notAfter=$(date -u -d '+3 days' '+%b %e %H:%M:%S %Y GMT')"
`
  );
  mkdirSync(path.join(akar, "cert", "aleta.example"), { recursive: true });
  writeFileSync(path.join(akar, "cert", "aleta.example", "fullchain.pem"), "x");
  for (const b of ["curl", "docker", "df", "openssl"]) chmodSync(path.join(bin, b), 0o755);
  if (opsi.mirror !== null) {
    writeFileSync(path.join(kap, "penjaga-penerima.json"), JSON.stringify(opsi.mirror ?? { versi: 1, merahAktif: true, penerima: [{ nama: "Derry", nomor: "6281234567890" }] }) + "\n");
  }
  const jalankan = (argumen = "", env: Record<string, string> = {}) =>
    spawnSync(BASH as string, ["-c", `export PATH='${posix(bin)}':"$PATH"; bash '${posix(path.join(SKRIP, "penjaga-host.sh"))}' ${argumen}`], {
      encoding: "utf8",
      timeout: 60_000,
      env: {
        ...process.env,
        ALETA_APP_DIR: posix(app),
        ALETA_DATA_DIR: posix(data),
        ALETA_KAPASITAS_DIR: posix(kap),
        ALETA_PENJAGA_PROBE_DETIK: "0",
        ALETA_CERT_FILES: `${p}/cert/*/fullchain.pem`,
        ALETA_TMP_DIR: posix(akar),
        ALETA_BOT_INTERNAL_API_TOKEN: "",
        ...env,
      },
    });
  const baca = (nama: string) => (existsSync(path.join(akar, nama)) ? readFileSync(path.join(akar, nama), "utf8") : "");
  const setKode = (nama: "kode-portal" | "kode-bot", kode: string) => writeFileSync(path.join(akar, nama), kode);
  const enqueue = () => (baca("enqueue.log").match(/^ENQUEUE /gm) ?? []).length;
  return { akar, kap, jalankan, baca, setKode, enqueue };
}

describe.skipIf(!BASH)("penjaga-host.sh (bash sungguhan, curl/docker/df tiruan)", () => {
  it("lolos bash -n dan berakhir baris LF; terpanggil dari cron kapasitas yang sama (bukan jadwal kedua)", () => {
    const jalur = path.join(SKRIP, "penjaga-host.sh");
    const isi = readFileSync(jalur, "utf8");
    expect(isi.startsWith("#!/usr/bin/env bash\n")).toBe(true);
    expect(isi.includes("\r")).toBe(false);
    expect(spawnSync(BASH as string, ["-n", posix(jalur)], { encoding: "utf8" }).stderr).toBe("");
    expect(readFileSync(path.join(SKRIP, "aleta-kapasitas-cron.sh"), "utf8")).toContain("penjaga-host.sh");
  });

  it("laporan penuh: inode, sertifikat, kontainer aleta- (yang berhenti terlihat), folder sementara; terbaca modul portal", () => {
    const h = sediakanHost();
    const r = h.jalankan("--paksa");
    expect(r.status, r.stderr).toBe(0);
    const mentah = JSON.parse(readFileSync(path.join(h.kap, "penjaga-host.json"), "utf8"));
    const l = bersihkanLaporanPenjagaHost(mentah)!;
    expect(l).not.toBeNull();
    expect(l.inode).toEqual([
      { titik: "/", persen: 97 },
      { titik: "/home", persen: 10 },
    ]);
    expect(l.kontainer.map((k) => [k.nama, k.keadaan, k.sehat])).toEqual([
      ["aleta-portal", "running", ""],
      ["aleta-bot", "exited", ""],
      ["aleta-postgres", "running", "healthy"],
    ]);
    expect(l.sertifikat[0].nama).toBe("aleta.example");
    expect(l.sertifikat[0].hariTersisa).toBeGreaterThanOrEqual(2);
    expect(l.sertifikat[0].hariTersisa).toBeLessThanOrEqual(3);
    expect(l.temp).toMatchObject({ persen: 95 });
    expect(l.portal).toEqual({ kode: 200 });
    // dan portal menafsirkannya menjadi temuan
    const t = temuanHost(l, PENGATURAN_PENJAGA_BAWAAN, AMBANG, new Set());
    expect(t.map((x) => x.kunci).sort()).toEqual(["inode:/", "kontainer:aleta-bot", "sertifikat:aleta.example", "temp:sementara"].sort());
  });

  it("hanya MENGUKUR: satu-satunya perintah docker adalah `ps`; tidak ada yang berubah di luar folder pertukaran", () => {
    const h = sediakanHost();
    h.jalankan("--paksa");
    const panggilan = h.baca("docker.log").split("\n").filter(Boolean);
    expect(panggilan).toHaveLength(1);
    expect(panggilan[0]).toMatch(/^ps -a --format/);
    expect(h.enqueue()).toBe(0);
  });

  it("alamat ABT diisi dan tidak menjawab -> laporan memuat kode 0; tidak diisi -> tidak diperiksa", () => {
    const h = sediakanHost();
    h.jalankan("--paksa");
    expect(JSON.parse(readFileSync(path.join(h.kap, "penjaga-host.json"), "utf8")).abtWeb).toBeNull();
    const g = sediakanHost();
    // curl tiruan menjawab 200 untuk alamat lain; ganti jadi kode 000 lewat URL berisi "login"
    const r = g.jalankan("--paksa", { ALETA_ABT_URL: "http://127.0.0.1:8056/login" });
    expect(r.status).toBe(0);
    expect(JSON.parse(readFileSync(path.join(g.kap, "penjaga-host.json"), "utf8")).abtWeb).toEqual({ kode: 200 });
    g.setKode("kode-portal", "000");
    g.jalankan("--paksa", { ALETA_ABT_URL: "http://127.0.0.1:8056/login" });
    expect(JSON.parse(readFileSync(path.join(g.kap, "penjaga-host.json"), "utf8")).abtWeb).toEqual({ kode: 0 });
  });

  it("portal mati: gagal sekali belum dikabari; dua kali berturut-turut = SATU kabar lewat bot (token tidak di argumen), tidak diulang sebelum 6 jam", () => {
    const h = sediakanHost();
    h.setKode("kode-portal", "000");
    h.jalankan();
    expect(h.enqueue()).toBe(0);
    const r2 = h.jalankan();
    expect(r2.status, r2.stderr).toBe(0);
    expect(h.enqueue()).toBe(1);
    const log = h.baca("enqueue.log");
    expect(log).toContain("/internal/aleta-bot/messages/enqueue");
    expect(log).toContain('"recipientNumber":"6281234567890"');
    expect(log).toMatch(/Portal ALETA tidak menjawab sejak \d\d\.\d\d WITA/);
    expect(log).toContain('"sourceApp":"aleta_bot_gateway"');
    // token lewat stdin curl, bukan argumen; nomor dan token tidak dicetak ke keluaran skrip
    expect(h.baca("curl-argumen.log")).not.toContain(TOKEN_RAHASIA);
    expect(h.baca("curl-stdin.log")).toContain(TOKEN_RAHASIA);
    expect(r2.stdout + r2.stderr).not.toContain(TOKEN_RAHASIA);
    expect(r2.stdout + r2.stderr).not.toMatch(/8123456789/);
    h.jalankan();
    h.jalankan();
    expect(h.enqueue()).toBe(1);
  });

  it("portal hidup lagi: SATU kabar pulih; sesudahnya diam; 404 (alamat salah) tidak dianggap mati", () => {
    const h = sediakanHost();
    h.setKode("kode-portal", "502");
    h.jalankan();
    h.jalankan();
    expect(h.enqueue()).toBe(1);
    h.setKode("kode-portal", "200");
    h.jalankan();
    expect(h.enqueue()).toBe(2);
    expect(h.baca("enqueue.log")).toMatch(/sudah pulih/);
    h.jalankan();
    expect(h.enqueue()).toBe(2);
    const n = sediakanHost();
    n.setKode("kode-portal", "404");
    n.jalankan();
    n.jalankan();
    n.jalankan();
    expect(n.enqueue()).toBe(0);
  });

  it("tanpa daftar penerima dari portal, atau kabar merah dimatikan di pengaturan: tidak mengirim apa pun", () => {
    const tanpa = sediakanHost({ mirror: null });
    tanpa.setKode("kode-portal", "000");
    tanpa.jalankan();
    const r = tanpa.jalankan();
    expect(r.status).toBe(0);
    expect(tanpa.enqueue()).toBe(0);
    const mati = sediakanHost({ mirror: { versi: 1, merahAktif: false, penerima: [{ nama: "D", nomor: "6281234567890" }] } });
    mati.setKode("kode-portal", "000");
    mati.jalankan();
    mati.jalankan();
    expect(mati.enqueue()).toBe(0);
  });

  it("bot menolak/mati (kode 500): tidak ditandai terkirim, dicoba lagi pada pemeriksaan berikutnya", () => {
    const h = sediakanHost();
    h.setKode("kode-portal", "000");
    h.setKode("kode-bot", "500");
    h.jalankan();
    h.jalankan();
    expect(h.enqueue()).toBe(1);
    h.setKode("kode-bot", "200");
    h.jalankan();
    expect(h.enqueue()).toBe(2);
    h.jalankan();
    expect(h.enqueue()).toBe(2);
  });

  it("ringan: jeda pemeriksaan cepat dihormati (portal tidak ditanya lagi sebelum 120 detik) dan pemeriksaan penuh tidak diulang sebelum 10 menit", () => {
    const h = sediakanHost();
    const env = { ALETA_PENJAGA_PROBE_DETIK: "120" };
    h.jalankan("", env);
    const curl1 = h.baca("curl-argumen.log").split("\n").filter(Boolean).length;
    const docker1 = h.baca("docker.log").split("\n").filter(Boolean).length;
    h.jalankan("", env);
    h.jalankan("", env);
    expect(h.baca("curl-argumen.log").split("\n").filter(Boolean).length).toBe(curl1);
    expect(h.baca("docker.log").split("\n").filter(Boolean).length).toBe(docker1);
    expect(curl1).toBe(1);
    expect(docker1).toBe(1);
  });

  it("dipanggil lewat cron kapasitas dengan --paksa: laporan penjaga ikut ditulis tanpa jadwal kedua", () => {
    const h = sediakanHost();
    const r = spawnSync(BASH as string, ["-c", `export PATH='${posix(path.join(h.akar, "bin"))}':"$PATH"; bash '${posix(path.join(SKRIP, "aleta-kapasitas-cron.sh"))}' --paksa`], {
      encoding: "utf8",
      timeout: 90_000,
      env: { ...process.env, ALETA_APP_DIR: posix(path.join(h.akar, "app")), ALETA_DATA_DIR: posix(path.join(h.akar, "data")), ALETA_KAPASITAS_DIR: posix(h.kap), ALETA_TMP_DIR: posix(h.akar) },
    });
    expect(r.status, r.stderr).toBe(0);
    expect(existsSync(path.join(h.kap, "penjaga-host.json"))).toBe(true);
    expect(existsSync(path.join(h.kap, "laporan.json"))).toBe(true);
  });
});
