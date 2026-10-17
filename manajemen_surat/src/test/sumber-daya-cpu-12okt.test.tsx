import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { moduleVisibility, modules, personas } from "@/lib/mock-data";
import { getAccessibleModules } from "@/lib/permissions";

/**
 * ============================================================================
 * SUMBER DAYA SERVER - CPU (12 Oktober 2026, butir 20 dan 21)
 * ============================================================================
 *
 *   - CPU adalah LAJU antara dua cuplikan (/proc/stat, cgroup), bukan angka
 *     sesaat; panggilan pertama menunggu cuplikan kedua, tak pernah menebak;
 *   - cgroup v1 (cpuacct.usage) dan v2 (cpu.stat usage_usec) dikenali, dan
 *     cpu.stat v1 tidak salah dibaca;
 *   - netdata: 100% = satu inti; rata-rata /api/v1/data didahulukan, nilai
 *     sesaat allmetrics hanya cadangan dan ditandai;
 *   - tidak terbaca = null/kelabu, TIDAK PERNAH 0% hijau (juga untuk jawaban
 *     bot lama tanpa CPU);
 *   - ALETA = jumlah inti butir ALETA / inti server; beban rata-rata hanya
 *     milik seluruh server;
 *   - halaman memuat CPU di kartu ALETA, Seluruh server, dan kolom tabel;
 *   - butir "Sumber daya server" di sidebar admin kelompok Sistem, hak sama
 *     dengan halamannya (Super Admin dan Admin, bukan peran lain).
 */

const require_ = createRequire(import.meta.url);
const cpu = require_(path.resolve(process.cwd(), "../aleta_bot/services/sumberDayaCpuService.js")) as Record<string, any>;
const sd = require_(path.resolve(process.cwd(), "../aleta_bot/services/sumberDayaService.js")) as Record<string, any>;

const PROC_STAT_A = `cpu  1000 0 500 8000 500 0 0 0 0 0
cpu0 250 0 125 2000 125 0 0 0 0 0
cpu1 250 0 125 2000 125 0 0 0 0 0
cpu2 250 0 125 2000 125 0 0 0 0 0
cpu3 250 0 125 2000 125 0 0 0 0 0
intr 12345 1 2
ctxt 999
`;
// 10 dtk kemudian: +1000 jiffies total, +250 diam -> 75% sibuk.
const PROC_STAT_B = `cpu  1500 0 750 8200 550 0 0 0 0 0
cpu0 375 0 187 2050 137 0 0 0 0 0
cpu1 375 0 187 2050 137 0 0 0 0 0
cpu2 375 0 187 2050 137 0 0 0 0 0
cpu3 375 0 187 2050 137 0 0 0 0 0
`;

describe("pengurai CPU di bot", () => {
  it("/proc/stat: jumlah, diam (idle+iowait), dan inti dari baris cpuN", () => {
    const a = cpu.uraiProcStat(PROC_STAT_A);
    expect(a).toEqual({ jumlah: 10000, diam: 8500, inti: 4 });
    expect(cpu.uraiProcStat("intr 1 2")).toBeNull();
    expect(cpu.uraiProcStat("cpu  1 2")).toBeNull();
    expect(cpu.uraiProcStat("cpu  a b c d")).toBeNull();
    // kernel lama: hanya 4 kolom
    expect(cpu.uraiProcStat("cpu  10 0 10 80\n")).toEqual({ jumlah: 100, diam: 80, inti: null });
  });

  it("persen = 1 - selisih diam / selisih total; penghitung mundur atau diam = null (bukan 0%)", () => {
    const a = cpu.uraiProcStat(PROC_STAT_A);
    const b = cpu.uraiProcStat(PROC_STAT_B);
    expect(cpu.persenAntarCuplikan(a, b)).toBe(75);
    expect(cpu.persenAntarCuplikan(b, a)).toBeNull(); // mesin dinyalakan ulang di antara
    expect(cpu.persenAntarCuplikan(a, a)).toBeNull(); // penghitung tak maju
    expect(cpu.persenAntarCuplikan(null, a)).toBeNull();
    // seluruhnya diam
    expect(cpu.persenAntarCuplikan({ jumlah: 0, diam: 0 }, { jumlah: 100, diam: 100 })).toBe(0);
  });

  it("loadavg: tiga angka pertama; rusak = null", () => {
    expect(cpu.uraiLoadavg("0.52 0.61 0.70 2/512 12345\n")).toEqual({ m1: 0.52, m5: 0.61, m15: 0.7 });
    expect(cpu.uraiLoadavg("")).toBeNull();
    expect(cpu.uraiLoadavg("x y z")).toBeNull();
  });

  it("cgroup v1 (cpuacct.usage, ns) dan v2 (cpu.stat usage_usec); cpu.stat v1 tidak salah dibaca", () => {
    expect(cpu.uraiCpuUsageNs("123456789000\n")).toBe(123456789000);
    expect(cpu.uraiCpuUsageNs("usage_usec 2500000\nuser_usec 2000000\nsystem_usec 500000\nnr_periods 0\n")).toBe(2_500_000_000);
    expect(cpu.uraiCpuUsageNs("nr_periods 0\nnr_throttled 0\nthrottled_time 0\n")).toBeNull();
    expect(cpu.uraiCpuUsageNs("")).toBeNull();
    // 3 dtk, 1,5 dtk CPU -> 0,5 inti
    expect(cpu.intiDariNs(0, 1.5e9, 1000, 4000)).toBe(0.5);
    expect(cpu.intiDariNs(10, 5, 1000, 4000)).toBeNull(); // penghitung mundur
    expect(cpu.intiDariNs(0, 5, 4000, 4000)).toBeNull(); // waktu tak maju
  });

  it("netdata: 100% = satu inti (user + system); bentuk polos dan jsonwrap; tanpa data = null", () => {
    expect(cpu.jumlahDimensiCpu({ user: 30, system: 20 })).toBeCloseTo(0.5);
    expect(cpu.jumlahDimensiCpu({ user: 150, system: 50, guest: 999 })).toBeCloseTo(2); // guest tidak dihitung dobel
    expect(cpu.jumlahDimensiCpu({ cpu: 25 })).toBeCloseTo(0.25); // nama dimensi lain: semuanya
    expect(cpu.jumlahDimensiCpu({})).toBeNull();
    const polos = { labels: ["time", "user", "system"], data: [[1791265477, 12, 8]] };
    expect(cpu.uraiDataGrafikNetdata(polos)).toBeCloseTo(0.2);
    expect(cpu.uraiDataGrafikNetdata({ api: 1, result: polos })).toBeCloseTo(0.2);
    expect(cpu.uraiDataGrafikNetdata({ labels: ["time", "user", "system"], data: [[1, null, null]] })).toBeNull();
    expect(cpu.uraiDataGrafikNetdata({ labels: ["time"], data: [] })).toBeNull();
    expect(cpu.uraiDataGrafikNetdata(null)).toBeNull();
  });
});

describe("cuplikan antar-panggilan", () => {
  beforeEach(() => cpu.kosongkanCuplikanCpu());

  const pembaca = (urutan: Array<{ t: number; jumlah: number; diam: number } | null>) => {
    let i = 0;
    return vi.fn(async () => urutan[Math.min(i++, urutan.length - 1)]);
  };

  it("panggilan pertama menunggu 1 dtk lalu mencuplik lagi - tak pernah angka dari satu cuplikan", async () => {
    const baca = pembaca([
      { t: 1000, jumlah: 100, diam: 90 },
      { t: 2000, jumlah: 200, diam: 150 },
    ]);
    const tunggu = vi.fn(async () => undefined);
    const p = await cpu.pasanganCuplikan("k", baca, { tunggu });
    expect(tunggu).toHaveBeenCalledWith(1000);
    expect(p.awal.t).toBe(1000);
    expect(p.akhir.t).toBe(2000);
  });

  it("panggilan berikutnya (3-5 dtk kemudian) memakai cuplikan terakhir sebagai dasar, tanpa menunggu", async () => {
    const tunggu = vi.fn(async () => undefined);
    await cpu.pasanganCuplikan("k", pembaca([{ t: 0, jumlah: 0, diam: 0 }, { t: 1000, jumlah: 100, diam: 50 }]), { tunggu });
    tunggu.mockClear();
    const p = await cpu.pasanganCuplikan("k", pembaca([{ t: 6000, jumlah: 600, diam: 300 }]), { tunggu });
    expect(tunggu).not.toHaveBeenCalled();
    expect(p.awal.t).toBe(1000);
    expect(p.akhir.t).toBe(6000);
  });

  it("dua panggilan nyaris serentak (< 0,5 dtk) berbagi pasangan - jendela sependek itu tak bermakna", async () => {
    const tunggu = vi.fn(async () => undefined);
    await cpu.pasanganCuplikan("k", pembaca([{ t: 0, jumlah: 0, diam: 0 }, { t: 1000, jumlah: 100, diam: 50 }]), { tunggu });
    const p1 = await cpu.pasanganCuplikan("k", pembaca([{ t: 5000, jumlah: 500, diam: 250 }]), { tunggu });
    const p2 = await cpu.pasanganCuplikan("k", pembaca([{ t: 5100, jumlah: 510, diam: 255 }]), { tunggu });
    expect(p2).toBe(p1);
  });

  it("dasar yang sudah basi (> 30 dtk) tidak dipakai: menunggu cuplikan baru", async () => {
    const tunggu = vi.fn(async () => undefined);
    await cpu.pasanganCuplikan("k", pembaca([{ t: 0, jumlah: 0, diam: 0 }, { t: 1000, jumlah: 100, diam: 50 }]), { tunggu });
    tunggu.mockClear();
    const p = await cpu.pasanganCuplikan(
      "k",
      pembaca([
        { t: 600000, jumlah: 9000, diam: 4000 },
        { t: 601000, jumlah: 9100, diam: 4050 },
      ]),
      { tunggu }
    );
    expect(tunggu).toHaveBeenCalledTimes(1);
    expect(p.akhir.t - p.awal.t).toBe(1000);
  });

  it("sumber tidak terbaca: null (tidak mengarang)", async () => {
    expect(await cpu.pasanganCuplikan("k", pembaca([null]), { tunggu: async () => undefined })).toBeNull();
  });
});

describe("butir per aplikasi dan keping ringkasan", () => {
  const butir = (jenis: string, kunci: string) => ({ jenis, kunci, ramByte: 1, cacheByte: 0, swapByte: 0 });
  const grafik = {
    "cgroup_aleta-bot.cpu": { satuan: "percentage", dimensi: { user: 8, system: 4 } },
    "cgroup_aleta-portal.cpu": { satuan: "percentage", dimensi: { user: 2, system: 1 } },
    "systemd_docker.cpu": { satuan: "percentage", dimensi: { user: 1, system: 1 } },
    "systemd_mariadb.cpu": { satuan: "percentage", dimensi: { user: 90, system: 30 } },
  };

  it("nama grafik: container -> cgroup_X.cpu, layanan -> systemd_X.cpu", () => {
    expect(cpu.namaGrafikCpu(butir("container", "aleta-bot"))).toBe("cgroup_aleta-bot.cpu");
    expect(cpu.namaGrafikCpu(butir("layanan", "httpd"))).toBe("systemd_httpd.cpu");
  });

  it("rata-rata didahulukan atas nilai sesaat; sesaat hanya cadangan dan ditandai; tanpa grafik = null, bukan 0", () => {
    const rincian = {
      aleta: [butir("container", "aleta-bot"), butir("container", "aleta-portal"), butir("container", "aleta-postgres")],
      lain: [butir("layanan", "mariadb")],
    };
    const rata = new Map([["cgroup_aleta-bot.cpu", 0.3]]);
    cpu.terapkanCpuKeButir(rincian, grafik, rata, 8);
    const [bot, portal, pg] = rincian.aleta as any[];
    expect(bot).toMatchObject({ cpuInti: 0.3, cpuPersen: 3.8, cpuSumber: "rata-rata" });
    expect(portal).toMatchObject({ cpuInti: 0.03, cpuPersen: 0.4, cpuSumber: "sesaat" });
    expect(pg).toMatchObject({ cpuInti: null, cpuPersen: null, cpuSumber: null });
    // mariadb memakai 1,2 inti dari 8 = 15%
    expect((rincian.lain[0] as any).cpuPersen).toBe(15);
    // tanpa jumlah inti server: inti ada, persen tidak
    const tanpaInti = { aleta: [butir("container", "aleta-bot")], lain: [] };
    cpu.terapkanCpuKeButir(tanpaInti, grafik, new Map(), null);
    expect((tanpaInti.aleta[0] as any).cpuPersen).toBeNull();
    expect((tanpaInti.aleta[0] as any).cpuInti).toBe(0.12);
  });

  it("ALETA = jumlah inti butir ALETA / inti server; server = persen /proc/stat dengan beban 1/5/15", () => {
    const aleta = [
      { cpuInti: 0.3 },
      { cpuInti: 0.1 },
      { cpuInti: null }, // tidak terbaca tidak dihitung 0 dan tidak menggagalkan jumlahnya
    ];
    const k = cpu.susunKepingCpu({
      cpu: { persen: 12, inti: 8, beban: { m1: 0.5, m5: 0.6, m15: 0.7 }, jendelaDetik: 5 },
      rincianAleta: aleta,
      aletaSebagian: false,
    });
    expect(k.server).toMatchObject({ persen: 12, warna: "hijau", inti: 8, intiTerpakai: 0.96, beban: { m1: 0.5, m5: 0.6, m15: 0.7 }, jendelaDetik: 5 });
    expect(k.aleta).toMatchObject({ persen: 5, warna: "hijau", inti: 8, intiTerpakai: 0.4, beban: null, sebagian: false });
  });

  it("ambang 70/90: batasnya persis; tanpa angka kelabu", () => {
    expect(cpu.warnaCpu(69.9)).toBe("hijau");
    expect(cpu.warnaCpu(70)).toBe("kuning");
    expect(cpu.warnaCpu(89.9)).toBe("kuning");
    expect(cpu.warnaCpu(90)).toBe("merah");
    expect(cpu.warnaCpu(null)).toBe("kelabu");
    expect(sd.AMBANG.cpu).toEqual({ kuning: 70, merah: 90 });
  });

  it("tidak ada butir ALETA ber-CPU (atau CPU server tak terbaca): null dan kelabu, bukan 0% hijau", () => {
    const k = cpu.susunKepingCpu({ cpu: { persen: null, inti: 8, beban: null, jendelaDetik: null }, rincianAleta: [{ cpuInti: null }], aletaSebagian: true });
    expect(k.server).toMatchObject({ persen: null, warna: "kelabu", intiTerpakai: null });
    expect(k.aleta).toMatchObject({ persen: null, warna: "kelabu", intiTerpakai: null, sebagian: true });
    expect(cpu.susunKepingCpu({ cpu: null, rincianAleta: null }).server.persen).toBeNull();
  });

  it("hitungRingkas membawa keping CPU di kedua sudut pandang; tanpa masukan cpu tetap utuh (tidak terbaca)", () => {
    const memori = sd.uraiMeminfo("MemTotal: 1000 kB\nMemAvailable: 500 kB\n");
    const gpu = sd.nilaiGpu([], null);
    const r = sd.hitungRingkas({
      memori,
      rincian: { aleta: [{ kunci: "aleta-bot", ramByte: 1, cpuInti: 2 }], lain: [] },
      partisi: [],
      diskAleta: null,
      gpu,
      cpu: { persen: 95, inti: 4, beban: { m1: 3.9, m5: 3, m15: 2 }, jendelaDetik: 4 },
      cpuSebagian: false,
    });
    expect(r.server.cpu).toMatchObject({ persen: 95, warna: "merah", intiTerpakai: 3.8 });
    expect(r.aleta.cpu).toMatchObject({ persen: 50, warna: "hijau", intiTerpakai: 2 });
    const tanpa = sd.hitungRingkas({ memori, rincian: { aleta: [], lain: [] }, partisi: [], diskAleta: null, gpu });
    expect(tanpa.server.cpu).toMatchObject({ persen: null, warna: "kelabu" });
    expect(tanpa.aleta.cpu).toMatchObject({ persen: null, warna: "kelabu" });
  });

  it("tanpa netdata: container bot sendiri dari cgroup, ditandai sumbernya", () => {
    const bot = { jenis: "container", kunci: "aleta-bot" } as Record<string, unknown>;
    cpu.terapkanCpuContainerSendiri(bot, 0.5, 4);
    expect(bot).toMatchObject({ cpuInti: 0.5, cpuPersen: 12.5, cpuSumber: "cgroup" });
    cpu.terapkanCpuContainerSendiri(bot, null, 4);
    expect(bot).toMatchObject({ cpuInti: null, cpuPersen: null, cpuSumber: null });
    expect(() => cpu.terapkanCpuContainerSendiri(undefined, 1, 4)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Portal
// ---------------------------------------------------------------------------

const layanan = await import("@/server/modules/sumber-daya/layanan");
const { SumberDayaPanel, keteranganCpu, formatInti } = await import("@/components/portal/sumber-daya-panel");

const GIB = 1024 ** 3;
const AMBANG = { ram: { kuning: 75, merah: 90 }, disk: { kuning: 80, merah: 90 }, gpu: { kuning: 70, merah: 90 }, cpu: { kuning: 70, merah: 90 } };
const kepingCpu = (persen: number | null, ubah: Record<string, unknown> = {}) => ({
  persen,
  warna: persen === null ? "kelabu" : persen >= 90 ? "merah" : persen >= 70 ? "kuning" : "hijau",
  inti: 8,
  intiTerpakai: persen === null ? null : Math.round(persen * 8) / 100,
  beban: null,
  jendelaDetik: 5,
  ...ubah,
});

function jawabanBot(ubah: Record<string, unknown> = {}) {
  return {
    ok: true,
    diukurPada: "2026-10-12T05:00:00.000Z",
    ambang: AMBANG,
    sumber: { cpuServer: "/proc/stat (selisih dua cuplikan, 5 dtk)" },
    ringkas: {
      aleta: {
        cpu: kepingCpu(3.8),
        ram: { byte: 1 * GIB, totalByte: 30 * GIB, persen: 3.3, warna: "hijau" },
        disk: { byte: 100 * GIB, totalByte: 900 * GIB, persen: 11, warna: "hijau" },
        gpu: { ada: false, persen: null, warna: "kelabu", keterangan: "Tidak ada GPU di server ini." },
      },
      server: {
        cpu: kepingCpu(12, { beban: { m1: 0.52, m5: 0.61, m15: 0.7 }, intiTerpakai: 0.96 }),
        ram: { byte: 6 * GIB, totalByte: 30 * GIB, persen: 20, warna: "hijau" },
        disk: { byte: 140 * GIB, totalByte: 200 * GIB, persen: 70, warna: "hijau", partisi: "/home" },
        gpu: { ada: false, persen: null, warna: "kelabu", keterangan: "Tidak ada GPU di server ini." },
      },
    },
    rincian: {
      memori: { totalByte: 30 * GIB, tersediaByte: 24 * GIB, terpakaiByte: 6 * GIB, cacheByte: 0, swapTotalByte: 0, swapTerpakaiByte: 0 },
      aleta: [
        { kunci: "aleta-bot", nama: "ALETA Bot (Node)", jenis: "container", ramByte: 563e6, cacheByte: 41e6, swapByte: 0, cpuInti: 0.3, cpuPersen: 3.8, cpuSumber: "rata-rata" },
        { kunci: "aleta-postgres", nama: "PostgreSQL ALETA", jenis: "container", ramByte: 11e6, cacheByte: 1e6, swapByte: 0, cpuInti: null, cpuPersen: null, cpuSumber: null },
      ],
      lain: [
        { kunci: "mariadb", nama: "MariaDB", jenis: "layanan", ramByte: 2e9, cacheByte: 1e6, swapByte: 0, cpuInti: 1.2, cpuPersen: 15, cpuSumber: "sesaat" },
      ],
      ramLainnyaByte: null,
      partisi: [],
      diskAleta: { byte: null, rincian: [] },
      docker: null,
      folderDiukurPada: null,
      cpu: { inti: 8, beban: { m1: 0.52, m5: 0.61, m15: 0.7 }, jendelaDetik: 5 },
      gpu: { ada: false, persen: null, keterangan: "Tidak ada GPU di server ini.", perangkat: [] },
    },
    catatan: [],
    ...ubah,
  };
}

describe("portal: pembersihan jawaban bot dan tambahan portal", () => {
  it("CPU lolos apa adanya (persen, inti, beban, per butir)", () => {
    const b = layanan.bersihkanJawabanBot(jawabanBot())!;
    expect(b.ringkas.server.cpu).toMatchObject({ persen: 12, inti: 8, intiTerpakai: 0.96, beban: { m1: 0.52, m5: 0.61, m15: 0.7 } });
    expect(b.ringkas.aleta.cpu.persen).toBe(3.8);
    expect(b.ambang.cpu).toEqual({ kuning: 70, merah: 90 });
    expect(b.rincian.cpu).toEqual({ inti: 8, beban: { m1: 0.52, m5: 0.61, m15: 0.7 }, jendelaDetik: 5 });
    expect(b.rincian.aleta[0]).toMatchObject({ cpuInti: 0.3, cpuPersen: 3.8, cpuSumber: "rata-rata" });
    expect(b.rincian.lain[0].cpuSumber).toBe("sesaat");
  });

  it("bot lama tanpa CPU: tidak terbaca (kelabu, null) - bukan 0% dan tidak jatuh", () => {
    const lama = jawabanBot();
    delete (lama.ringkas.aleta as Record<string, unknown>).cpu;
    delete (lama.ringkas.server as Record<string, unknown>).cpu;
    delete (lama.rincian as Record<string, unknown>).cpu;
    delete (lama as Record<string, unknown>).ambang;
    const b = layanan.bersihkanJawabanBot(lama)!;
    expect(b.ringkas.server.cpu).toMatchObject({ persen: null, warna: "kelabu", inti: null, beban: null });
    expect(b.ringkas.aleta.cpu).toMatchObject({ persen: null, warna: "kelabu" });
    expect(b.rincian.cpu).toEqual({ inti: null, beban: null, jendelaDetik: null });
    expect(b.ambang.cpu).toEqual({ kuning: 70, merah: 90 });
  });

  it("warna asing, beban rusak, dan sumber asing dibersihkan", () => {
    const rusak = jawabanBot();
    (rusak.ringkas.server as Record<string, unknown>).cpu = kepingCpu(50, { warna: "ungu", beban: { m1: "x", m5: 1, m15: 1 } });
    (rusak.rincian.aleta[0] as Record<string, unknown>).cpuSumber = "ramalan";
    const b = layanan.bersihkanJawabanBot(rusak)!;
    expect(b.ringkas.server.cpu.warna).toBe("kelabu");
    expect(b.ringkas.server.cpu.beban).toBeNull();
    expect(b.rincian.aleta[0].cpuSumber).toBeNull();
  });

  it("tanpa netdata portal menambahkan CPU container-nya sendiri ke ALETA - dan angkanya SEBAGIAN", () => {
    const b = layanan.bersihkanJawabanBot(
      jawabanBot({
        rincian: { ...jawabanBot().rincian, aleta: [{ kunci: "aleta-bot", nama: "ALETA Bot (Node)", jenis: "container", ramByte: 1, cacheByte: 0, swapByte: 0, cpuInti: 0.4, cpuPersen: 5 }] },
      })
    )!;
    b.ringkas.aleta.cpu = { ...b.ringkas.aleta.cpu, persen: 5, intiTerpakai: 0.4 };
    const h = layanan.gabungTambahanPortal(b, { postgresByte: null, portalSendiri: { ramByte: 250e6, cacheByte: 1, cpuInti: 0.2 } });
    const portal = h.rincian.aleta.find((x) => x.kunci === "aleta-portal")!;
    expect(portal).toMatchObject({ cpuInti: 0.2, cpuPersen: 2.5, cpuSumber: "cgroup" });
    expect(h.ringkas.aleta.cpu).toMatchObject({ intiTerpakai: 0.6, persen: 7.5, sebagian: true });
  });

  it("portal belum punya dua cuplikan (cpuInti null): butirnya tidak terbaca, jumlah ALETA tidak berubah", () => {
    const b = layanan.bersihkanJawabanBot(jawabanBot())!;
    b.rincian.aleta = b.rincian.aleta.filter((x) => x.kunci !== "aleta-portal");
    const sebelum = b.ringkas.aleta.cpu.intiTerpakai;
    const h = layanan.gabungTambahanPortal(b, { postgresByte: null, portalSendiri: { ramByte: 1, cacheByte: 0, cpuInti: null } });
    expect(h.rincian.aleta.find((x) => x.kunci === "aleta-portal")).toMatchObject({ cpuInti: null, cpuPersen: null });
    expect(h.ringkas.aleta.cpu.intiTerpakai).toBe(sebelum);
    expect(h.ringkas.aleta.cpu.sebagian).toBe(true);
  });
});

describe("portal: CPU container sendiri (cgroup v1 dan v2)", () => {
  beforeEach(() => layanan.kosongkanSinggahSumberDaya());

  it("uraiCpuUsageNs sama dengan di bot", () => {
    expect(layanan.uraiCpuUsageNs("5000000000\n")).toBe(5e9);
    expect(layanan.uraiCpuUsageNs("usage_usec 4000000\nuser_usec 1\n")).toBe(4e9);
    expect(layanan.uraiCpuUsageNs("nr_periods 0\nthrottled_time 5\n")).toBeNull();
    expect(layanan.intiDariCuplikan({ ns: 0, t: 0 }, { ns: 2e9, t: 4000 })).toBe(0.5);
    expect(layanan.intiDariCuplikan({ ns: 5, t: 0 }, { ns: 1, t: 4000 })).toBeNull();
  });

  it("pembacaan pertama = null (dasar saja); kedua = selisih; v2 dipakai bila v1 tak ada; tak terbaca = null", async () => {
    let ns = 1_000_000_000;
    let t = 10_000;
    const v2 = async (berkas: string) => {
      if (berkas !== "/sys/fs/cgroup/cpu.stat") throw new Error("ENOENT");
      return `usage_usec ${ns / 1000}\nuser_usec 0\n`;
    };
    expect(await layanan.cpuPortalSendiri(v2, () => t)).toBeNull();
    ns += 2_000_000_000; // 2 dtk CPU
    t += 4000; // dalam 4 dtk
    expect(await layanan.cpuPortalSendiri(v2, () => t)).toBe(0.5);
    // < 0,5 dtk kemudian: hasil terakhir dipakai ulang, dasar tidak bergeser
    t += 100;
    expect(await layanan.cpuPortalSendiri(v2, () => t)).toBe(0.5);
    // v1
    layanan.kosongkanSinggahSumberDaya();
    const v1 = async (berkas: string) => {
      if (berkas !== "/sys/fs/cgroup/cpuacct/cpuacct.usage") throw new Error("ENOENT");
      return String(ns);
    };
    await layanan.cpuPortalSendiri(v1, () => t);
    ns += 1_000_000_000;
    expect(await layanan.cpuPortalSendiri(v1, () => t + 2000)).toBe(0.5);
    // tidak ada cgroup sama sekali
    layanan.kosongkanSinggahSumberDaya();
    expect(await layanan.cpuPortalSendiri(async () => { throw new Error("ENOENT"); }, () => t)).toBeNull();
  });

  it("dasar basi (> 60 dtk): tidak menghitung selisih panjang, kembali menaruh dasar", async () => {
    let ns = 0;
    const baca = async (b: string) => {
      if (b !== "/sys/fs/cgroup/cpuacct/cpuacct.usage") throw new Error("x");
      return String(ns);
    };
    await layanan.cpuPortalSendiri(baca, () => 0);
    ns = 5e9;
    expect(await layanan.cpuPortalSendiri(baca, () => 10 * 60 * 1000)).toBeNull();
  });
});

describe("halaman Sumber daya server memuat CPU", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("format: inti pecahan dan keterangan (inti terpakai, beban 1/5/15, SEBAGIAN)", () => {
    expect(formatInti(8)).toBe("8");
    expect(formatInti(0.96)).toBe("0,96");
    expect(formatInti(null)).toBe("-");
    const k = layanan.bersihkanJawabanBot(jawabanBot())!.ringkas.server.cpu;
    const teks = keteranganCpu(k, false);
    expect(teks).toContain("0,96 inti terpakai dari 8 inti");
    expect(teks).toContain("beban rata-rata 0,52 / 0,61 / 0,70 (1 / 5 / 15 menit)");
    expect(keteranganCpu({ ...k, sebagian: true }, true)).toContain("SEBAGIAN");
    expect(keteranganCpu({ ...k, sebagian: true }, false)).not.toContain("SEBAGIAN");
    expect(keteranganCpu({ ...k, persen: null }, false)).toContain("tidak terbaca");
  });

  it("kartu ALETA dan Seluruh server menampilkan CPU; tabel punya kolom CPU % per aplikasi", async () => {
    const data = layanan.bersihkanJawabanBot(jawabanBot())!;
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: true, data })));
    const { container } = render(<SumberDayaPanel />);
    await waitFor(() => expect(container.querySelectorAll('[data-meter="CPU"]').length).toBe(2));
    const [kartuAleta, kartuServer] = Array.from(container.querySelectorAll('[data-meter="CPU"]')) as HTMLElement[];
    expect(kartuAleta.textContent).toContain("3,8%");
    expect(kartuServer.textContent).toContain("12%");
    expect(kartuServer.textContent).toContain("0,96 inti terpakai dari 8 inti");
    expect(kartuServer.textContent).toContain("beban rata-rata 0,52 / 0,61 / 0,70");
    expect(kartuAleta.textContent).not.toContain("beban rata-rata");
    expect(kartuServer.querySelector("[data-warna]")?.getAttribute("data-warna")).toBe("hijau");

    expect(screen.getAllByText("CPU %").length).toBe(2); // tabel ALETA dan aplikasi lain
    const bot = container.querySelector('[data-butir="aleta-bot"] [data-cpu]')!;
    expect(bot.textContent).toBe("3,8%");
    expect(bot.getAttribute("title")).toBe("0,3 inti dari 8 inti");
    // tidak terbaca: strip, bukan 0%
    const pg = container.querySelector('[data-butir="aleta-postgres"] [data-cpu]')!;
    expect(pg.getAttribute("data-cpu")).toBe("tidak-terbaca");
    expect(pg.textContent).toBe("-");
    // nilai sesaat ditandai bintang
    const maria = container.querySelector('[data-butir="mariadb"] [data-cpu]')!;
    expect(maria.textContent).toBe("15%*");
    expect(within(container as HTMLElement).getByText(/CPU 70% \/ 90%/)).toBeTruthy();
  });

  it("CPU server tidak terbaca: kartu menulis 'tidak terbaca', bukan 0%", async () => {
    const lama = jawabanBot();
    delete (lama.ringkas.server as Record<string, unknown>).cpu;
    delete (lama.ringkas.aleta as Record<string, unknown>).cpu;
    const data = layanan.bersihkanJawabanBot(lama)!;
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: true, data })));
    const { container } = render(<SumberDayaPanel />);
    await waitFor(() => expect(container.querySelectorAll('[data-meter="CPU"]').length).toBe(2));
    for (const m of Array.from(container.querySelectorAll('[data-meter="CPU"]'))) {
      expect(m.textContent).toContain("tidak terbaca");
      expect(m.querySelector("[data-warna]")?.getAttribute("data-warna")).toBe("kelabu");
    }
  });

  it("bentuk mentah lama (tanpa .cpu sama sekali di data) tidak menjatuhkan halaman", async () => {
    const mentah = jawabanBot();
    delete (mentah.ringkas.server as Record<string, unknown>).cpu;
    delete (mentah.ringkas.aleta as Record<string, unknown>).cpu;
    delete (mentah.rincian as Record<string, unknown>).cpu;
    delete (mentah as Record<string, unknown>).ambang;
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: true, data: { ...mentah, ambang: { ram: AMBANG.ram, disk: AMBANG.disk, gpu: AMBANG.gpu } } })));
    const { container } = render(<SumberDayaPanel />);
    await waitFor(() => expect(container.querySelectorAll('[data-meter="CPU"]').length).toBe(2));
  });
});

// ---------------------------------------------------------------------------
// Butir 21: sidebar admin
// ---------------------------------------------------------------------------

describe("sidebar admin: Sumber daya server di kelompok Sistem", () => {
  const sumber = readFileSync(path.resolve(process.cwd(), "src/components/layout/portal-shell-v2.tsx"), "utf8");

  it("terdaftar sebagai modul ke /admin/sumber-daya dengan hak sama dengan halamannya", () => {
    const m = modules.find((x) => x.id === "server-resources")!;
    expect(m).toBeTruthy();
    expect(m.href).toBe("/admin/sumber-daya");
    expect(m.label).toBe("Sumber Daya Server");
    expect([...m.roleIds].sort()).toEqual(["admin", "super-admin"]);
    // halaman membatasi persis dua peran itu
    const halaman = readFileSync(path.resolve(process.cwd(), "src/app/(portal)/admin/sumber-daya/page.tsx"), "utf8");
    expect(halaman).toMatch(/!== "super-admin" && effectiveRoleId !== "admin"/);
  });

  it("kelompok Sistem memuatnya setelah Pembaruan dan Backup; ada di himpunan menu admin; deskripsi ringkas sesuai", () => {
    expect(sumber).toMatch(/id: "system",\s*label: "Sistem",\s*moduleIds: \["system-updates", "backup-system", "server-resources"(?:, "fitur-satker")?\]/);
    // 18 Okt 2026: menu Fitur Satker (Super Admin) ditaruh SESUDAH Sumber daya server; urutan tiga menu pertama dipertahankan.
    expect(sumber).toMatch(/adminSidebarIds[\s\S]*?"server-resources"[\s\S]*?\]\);/);
    expect(sumber).toContain('"server-resources": "RAM, CPU, disk, dan GPU server."');
    expect(sumber).toContain("server: Server");
  });

  it("Super Admin dan Admin melihatnya; hakim dan peran lain tidak", () => {
    const untuk = (roleId: string) => {
      const orang = personas.find((p) => p.roleId === roleId)!;
      return getAccessibleModules(orang, moduleVisibility).some((x) => x.id === "server-resources");
    };
    expect(untuk("super-admin")).toBe(true);
    expect(untuk("admin")).toBe(true);
    expect(untuk("hakim")).toBe(false);
    for (const p of personas) {
      if (p.roleId === "super-admin" || p.roleId === "admin") continue;
      expect(getAccessibleModules(p, moduleVisibility).some((x) => x.id === "server-resources")).toBe(false);
    }
  });

  it("jalur data tidak melebar: rute admin tetap pastikanAdminIstimewa", () => {
    const rute = readFileSync(path.resolve(process.cwd(), "src/app/api/admin/sumber-daya/route.ts"), "utf8");
    expect(rute).toContain("pastikanAdminIstimewa");
  });
});
