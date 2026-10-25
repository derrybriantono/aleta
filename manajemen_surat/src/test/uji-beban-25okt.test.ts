// @vitest-environment node
/**
 * Uji beban K9 (25 Okt 2026) - yang dijaga adalah KEAMANANNYA dan ketepatan
 * ukurannya:
 *
 *   - skrip menolak server kantor dan alamat produksi mana pun SEBELUM satu
 *     permintaan pun dikirim, juga lewat tipuan alamat (nama pengguna di
 *     alamat, nama yang menyerupai localhost, nama lokal yang dibelokkan DNS);
 *   - pengalihan (3xx) tidak diikuti;
 *   - kuki tidak pernah tertulis ke hasil;
 *   - persentil dan kueri/menit dihitung benar.
 *
 * Satu putaran kecil dijalankan ke peladen tiruan di 127.0.0.1 (selang
 * dipendekkan) untuk membuktikan skrip bekerja; angkanya bukan angka beban.
 */
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  SasaranDitolak,
  alamatLoopback,
  hitungKueriPerMenit,
  jalurPermintaan,
  mulaiPengukurSipp,
  pastikanResolusiLoopback,
  periksaSasaran,
  persentil,
  susunPerangkat,
  utama,
} from "../../scripts/uji-beban.mjs";

const KUKI_RAHASIA = "sesi=RAHASIA-JANGAN-BOCOR-123";

describe("penjaga sasaran: hanya kembaran laptop", () => {
  it.each([
    "http://192.168.10.10",
    "http://192.168.10.10/aleta",
    "http://192.168.10.10:8008/aleta",
    "http://10.0.0.5",
    "https://aleta.example.com",
    "http://localhost.evil.com",
    "http://127.0.0.1.evil.com",
    "http://evil-localhost",
    // tipuan: yang dipakai adalah host sesudah @
    "http://localhost@192.168.10.10/",
    "http://127.0.0.1:80@192.168.10.10/",
    // angka lain yang bukan loopback
    "http://128.0.0.1",
    "http://[::ffff:c0a8:a0a]",
    "http://[fe80::1]",
    "ftp://localhost",
    "file:///etc/passwd",
    "",
    "bukan alamat",
  ])("menolak %s", (alamat) => {
    expect(() => periksaSasaran(alamat)).toThrow(SasaranDitolak);
  });

  it.each([
    ["http://localhost:3000", "localhost", ""],
    ["http://localhost:3000/aleta/", "localhost", "/aleta"],
    ["http://127.0.0.1:3000/aleta", "127.0.0.1", "/aleta"],
    ["http://127.5.6.7", "127.5.6.7", ""],
    ["http://[::1]:3000/aleta", "[::1]", "/aleta"],
    ["http://aleta.localhost:3000", "aleta.localhost", ""],
    // bentuk angka lain dinormalkan peramban/URL menjadi 127.0.0.1
    ["http://2130706433/", "127.0.0.1", ""],
  ])("menerima %s", (alamat, host, awalan) => {
    const s = periksaSasaran(alamat);
    expect(s.host).toBe(host);
    expect(s.awalan).toBe(awalan);
  });

  it("alamatLoopback hanya 127/8 dan ::1", () => {
    expect(alamatLoopback("127.0.0.1")).toBe(true);
    expect(alamatLoopback("::1")).toBe(true);
    expect(alamatLoopback("::ffff:127.0.0.1")).toBe(true);
    expect(alamatLoopback("192.168.10.10")).toBe(false);
    expect(alamatLoopback("0.0.0.0")).toBe(false);
    expect(alamatLoopback("127.0.0.256")).toBe(false);
    expect(alamatLoopback("")).toBe(false);
  });

  it("nama lokal yang DNS-nya dibelokkan ke alamat kantor ditolak", async () => {
    await expect(
      pastikanResolusiLoopback("aleta.localhost", async () => [{ address: "192.168.10.10", family: 4 }])
    ).rejects.toThrow(SasaranDitolak);
    await expect(
      pastikanResolusiLoopback("localhost", async () => [
        { address: "127.0.0.1", family: 4 },
        { address: "192.168.10.10", family: 4 },
      ])
    ).rejects.toThrow(SasaranDitolak);
    await expect(
      pastikanResolusiLoopback("localhost", async () => [
        { address: "127.0.0.1", family: 4 },
        { address: "::1", family: 6 },
      ])
    ).resolves.toBeUndefined();
    await expect(
      pastikanResolusiLoopback("hilang.localhost", async () => {
        throw Object.assign(new Error("x"), { code: "ENOTFOUND" });
      })
    ).rejects.toThrow(SasaranDitolak);
  });

  it("utama menolak server kantor dengan kode 2 tanpa mengirim satu permintaan pun", async () => {
    const ambil = vi.fn();
    const keluar = vi.fn();
    for (const sasaran of ["http://192.168.10.10", "http://192.168.10.10/aleta", "https://pa-donggala.example"]) {
      const kode = await utama(["--sasaran", sasaran, "--perangkat", "100"], { ALETA_UJI_KUKI: KUKI_RAHASIA }, { ambil, keluar });
      expect(kode).toBe(2);
    }
    expect(ambil).not.toHaveBeenCalled();
    expect(String(keluar.mock.calls[0][0])).toContain("DITOLAK");
  });

  it("alamat produksi dari lingkungan (ALETA_UJI_SASARAN) pun ditolak", async () => {
    const ambil = vi.fn();
    const kode = await utama([], { ALETA_UJI_SASARAN: "http://192.168.10.10/aleta", ALETA_UJI_KUKI: KUKI_RAHASIA }, { ambil, keluar: () => {} });
    expect(kode).toBe(2);
    expect(ambil).not.toHaveBeenCalled();
  });

  it("utama tidak punya tanda untuk melonggarkan penjaga", async () => {
    const ambil = vi.fn();
    for (const tanda of ["--izinkan-produksi", "--paksa", "--force", "--abaikan-penjaga"]) {
      const kode = await utama(["--sasaran", "http://192.168.10.10", tanda], { ALETA_UJI_KUKI: KUKI_RAHASIA }, { ambil, keluar: () => {} });
      expect(kode).toBe(2);
    }
    expect(ambil).not.toHaveBeenCalled();
  });
});

describe("hitungan", () => {
  it("persentil nearest-rank", () => {
    const seratus = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(persentil(seratus, 50)).toBe(50);
    expect(persentil(seratus, 95)).toBe(95);
    expect(persentil(seratus, 99)).toBe(99);
    expect(persentil([], 95)).toBe(0);
    expect(persentil([7], 99)).toBe(7);
    // tidak mengubah larik masukan
    const acak = [5, 1, 3];
    persentil(acak, 50);
    expect(acak).toEqual([5, 1, 3]);
  });

  it("kueri/menit mengurangi kueri pengukur sendiri", () => {
    // 1200 kueri dalam 60 dtk, 12 di antaranya milik pengukur -> 1188/menit
    expect(hitungKueriPerMenit(1000, 2200, 60, 12)).toBe(1188);
    expect(hitungKueriPerMenit(1000, 1000, 60, 5)).toBe(0);
    expect(hitungKueriPerMenit(1000, 4000, 0, 0)).toBe(0);
    expect(hitungKueriPerMenit(0, 300, 30, 0)).toBe(600);
  });

  it("perangkat tiruan deterministik dan sesuai profil", () => {
    const a = susunPerangkat(100, "campuran", 7);
    const b = susunPerangkat(100, "campuran", 7);
    expect(a).toEqual(b);
    expect(a).toHaveLength(100);
    expect(a.every((p) => p.jenis.length > 0)).toBe(true);
    const jadwal = susunPerangkat(200, "jadwal");
    expect(jadwal.every((p) => p.jenis.includes("jadwalPenuh") && p.jenis.includes("jadwalRingan") && p.jenis.includes("disidang"))).toBe(true);
    const widget = susunPerangkat(50, "widget");
    expect(widget.every((p) => p.jenis.length === 1 && p.jenis[0] === "widget")).toBe(true);
    const sebagian = a.filter((p) => p.jenis.includes("jadwalPenuh")).length;
    expect(sebagian).toBeGreaterThan(20);
    expect(sebagian).toBeLessThan(60);
    expect(() => susunPerangkat(1, "tidak-ada")).toThrow();
  });

  it("jalur permintaan sama dengan rute yang dipakai layar", () => {
    const ctx = { tanggal: "2026-10-25", nomor: "1/Pdt.G/2026/PA.Rekaan", kataCari: "Pdt.G" };
    expect(jalurPermintaan("jadwalPenuh", ctx)).toBe("/api/aleta-ecourt/sidang?dari=2026-10-25&sampai=2026-10-25&cari=&kesiapan=1");
    expect(jalurPermintaan("jadwalRingan", ctx)).toBe("/api/aleta-ecourt/sidang/ringan?dari=2026-10-25&sampai=2026-10-25");
    expect(jalurPermintaan("disidang", ctx)).toBe("/api/aleta-ecourt/sidang/disidang");
    expect(jalurPermintaan("widget", ctx)).toContain("/api/aleta-ecourt/denyut?bagian=");
    expect(jalurPermintaan("konteks", ctx)).toContain("/api/aleta-bot/sipp-konteks?nomor=");
    expect(jalurPermintaan("statusPerkara", ctx)).toContain("/api/aleta-ecourt/status-perkara?cari=");
  });
});

describe("pengukur MySQL kembaran", () => {
  it("menolak host MySQL yang bukan loopback tanpa tersambung", async () => {
    const muat = vi.fn();
    const p = await mulaiPengukurSipp({ ALETA_UJI_SIPP_HOST: "192.168.10.10" }, 5000, muat as never);
    expect(p.tersedia).toBe(false);
    expect(muat).not.toHaveBeenCalled();
  });

  it("tanpa host tidak mengukur", async () => {
    const p = await mulaiPengukurSipp({}, 5000);
    expect(p.tersedia).toBe(false);
  });

  it("membaca Questions dan Threads_connected tanpa menulis", async () => {
    const kueri: string[] = [];
    let q = 1000;
    const sambungan = {
      query: async (sql: string) => {
        kueri.push(sql);
        q += 11; // 10 kueri ALETA + 1 SHOW milik pengukur
        return [[
          { Variable_name: "Questions", Value: String(q) },
          { Variable_name: "Threads_connected", Value: "7" },
          { Variable_name: "Threads_running", Value: "2" },
          { Variable_name: "Max_used_connections", Value: "9" },
        ]];
      },
      end: async () => {},
    };
    const p = await mulaiPengukurSipp(
      { ALETA_UJI_SIPP_HOST: "127.0.0.1" },
      1_000_000,
      async () => ({ createConnection: async () => sambungan })
    );
    expect(p.tersedia).toBe(true);
    const hasil = await p.berhenti();
    expect(hasil.tersedia).toBe(true);
    expect(hasil.sambunganMaks).toBe(7);
    expect(hasil.sambunganMaksSejakNyala).toBe(9);
    expect(kueri.every((s) => /^SHOW GLOBAL STATUS/.test(s))).toBe(true);
  });
});

describe("putaran kecil ke peladen tiruan 127.0.0.1", () => {
  let peladen: http.Server;
  let asal = "";
  const diterima: Array<{ url: string; kuki: string | undefined }> = [];
  let alihkan = false;

  beforeAll(async () => {
    peladen = http.createServer((req, res) => {
      diterima.push({ url: req.url || "", kuki: req.headers.cookie });
      if (alihkan) {
        res.statusCode = 302;
        res.setHeader("location", "http://192.168.10.10/");
        res.end();
        return;
      }
      const u = req.url || "";
      res.setHeader("content-type", "application/json");
      if (u.includes("/sidang/disidang")) return void res.end(JSON.stringify({ ok: true, data: { available: false } }));
      if (u.includes("/status-perkara")) {
        res.statusCode = 500;
        return void res.end("{}");
      }
      res.end(JSON.stringify({ ok: true, data: { available: true } }));
    });
    await new Promise<void>((selesai) => peladen.listen(0, "127.0.0.1", selesai));
    asal = `http://127.0.0.1:${(peladen.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await new Promise<void>((selesai) => peladen.close(() => selesai()));
  });

  it("menjalankan putaran, menulis hasil tanpa kuki, dan menghitung galat", async () => {
    alihkan = false;
    diterima.length = 0;
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "uji-beban-"));
    const keluar: string[] = [];
    const kode = await utama(
      [
        "--sasaran", `${asal}/aleta`,
        "--perangkat", "20",
        "--durasi", "2",
        "--pemanasan", "0",
        "--profil", "jadwal",
        "--skala-waktu", "0.01",
        "--keluaran", folder,
        "--tanggal", "2026-10-25",
      ],
      { ALETA_UJI_KUKI: KUKI_RAHASIA },
      { keluar: (t) => keluar.push(t) }
    );
    expect(kode).toBe(0);
    expect(diterima.length).toBeGreaterThan(50);
    expect(diterima.every((d) => d.url.startsWith("/aleta/api/"))).toBe(true);
    expect(diterima.every((d) => d.kuki === KUKI_RAHASIA)).toBe(true);

    const berkas = fs.readdirSync(folder);
    const json = berkas.find((b) => b.endsWith(".json"))!;
    const teks = fs.readFileSync(path.join(folder, json), "utf8");
    expect(teks).not.toContain("RAHASIA");
    expect(keluar.join("\n")).not.toContain("RAHASIA");
    const hasil = JSON.parse(teks);
    expect(hasil.versi).toBe(1);
    expect(hasil.perangkat).toBe(20);
    expect(hasil.sasaran).toBe(`${asal}/aleta`);
    expect(hasil.total.permintaan).toBeGreaterThan(50);
    expect(hasil.rute.disidang.botTakTerjangkau).toBe(hasil.rute.disidang.jumlah);
    expect(hasil.rute.jadwalPenuh.galat).toBe(0);
    expect(hasil.total.p95).toBeGreaterThanOrEqual(hasil.total.p50);
    expect(hasil.sumberDaya.inti).toBeGreaterThan(0);
    expect(hasil.sipp.tersedia).toBe(false);
    expect(hasil.catatan.join(" ")).toContain("BUKAN angka beban");
    fs.rmSync(folder, { recursive: true, force: true });
  }, 30_000);

  it("pengalihan 3xx tidak diikuti dan dihitung galat", async () => {
    alihkan = true;
    diterima.length = 0;
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "uji-beban-"));
    const ambilAsli = globalThis.fetch;
    const opsiFetch: Array<RequestInit | undefined> = [];
    const ambil = ((alamat: string, opsi?: RequestInit) => {
      opsiFetch.push(opsi);
      return ambilAsli(alamat, opsi);
    }) as typeof fetch;
    const kode = await utama(
      ["--sasaran", asal, "--perangkat", "5", "--durasi", "1", "--pemanasan", "0", "--profil", "widget", "--skala-waktu", "0.01", "--keluaran", folder],
      { ALETA_UJI_KUKI: KUKI_RAHASIA },
      { keluar: () => {}, ambil }
    );
    expect(kode).toBe(0);
    expect(opsiFetch.length).toBeGreaterThan(0);
    expect(opsiFetch.every((o) => o?.redirect === "manual")).toBe(true);
    const hasil = JSON.parse(fs.readFileSync(path.join(folder, fs.readdirSync(folder).find((b) => b.endsWith(".json"))!), "utf8"));
    expect(hasil.rute.widget.galat).toBe(hasil.rute.widget.jumlah);
    expect(hasil.rute.widget.galatContoh.alih_302).toBe(hasil.rute.widget.jumlah);
    // peladen tiruan hanya didatangi di 127.0.0.1; tidak ada kunjungan ke alamat Location
    expect(diterima.every((d) => d.url.startsWith("/api/"))).toBe(true);
    fs.rmSync(folder, { recursive: true, force: true });
    alihkan = false;
  }, 30_000);

  it("tanpa kuki dan tanpa --masuk gagal dengan kode 3", async () => {
    const kode = await utama(["--sasaran", asal], {}, { keluar: () => {}, ambil: vi.fn() });
    expect(kode).toBe(3);
  });
});
