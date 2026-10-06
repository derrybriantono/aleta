// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * PEMANTAU SUMBER DAYA - PENGURAI DI BOT (butir 3, 6 Oktober 2026)
 * ============================================================================
 *
 * aleta_bot/services/sumberDayaService.js SUNGGUHAN, atas contoh yang diambil
 * dari server 6 Okt 2026 (/proc/meminfo, memory.stat, mountinfo container bot,
 * allmetrics netdata, `docker system df`, perangkat drm Matrox). Yang dijaga:
 *
 *   - angka byte dari tiap sumber benar satuannya (kB, MiB, GiB, "30.3GB");
 *   - ALETA dipisah dari aplikasi lain: aleta-*, buildkit, dockerd,
 *     containerd = ALETA; httpd, mariadb, netdata = lain;
 *   - ambang warna di batasnya persis (74,9 hijau, 75 kuning, 90 merah);
 *   - "tidak ada GPU" untuk kartu VGA papan server, tanpa angka karangan;
 *   - disk server = partisi TERPENUH, /boot diabaikan; disk ALETA tanpa
 *     cuplikan Docker disebut "sebagian".
 */

const require_ = createRequire(import.meta.url);
const sd = require_(path.resolve(process.cwd(), "../aleta_bot/services/sumberDayaService.js")) as Record<string, any>;

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

const MEMINFO = `MemTotal:       32367924 kB
MemFree:         2422180 kB
MemAvailable:   27069776 kB
Buffers:              64 kB
Cached:         23823560 kB
SwapCached:         1234 kB
SwapTotal:      16318460 kB
SwapFree:       16264700 kB
`;

const MEMORY_STAT = `cache 1000
rss 2000
swap 0
inactive_file 10
total_cache 159236096
total_rss 539525120
total_swap 0
total_inactive_file 112181248
`;

const MOUNTINFO = [
  "232 103 0:38 / / rw,relatime master:64 - overlay overlay rw,lowerdir=/home/docker-data/overlay2/l/X,upperdir=/home/docker-data/overlay2/b/diff,workdir=/home/docker-data/overlay2/b/work",
  "233 232 0:41 / /proc rw,nosuid,nodev,noexec,relatime - proc proc rw",
  "270 232 253:0 /usr/share/zoneinfo/Asia/Makassar /usr/share/zoneinfo/Etc/UTC ro,relatime - xfs /dev/mapper/centos-root rw,attr2",
  "271 232 253:2 /docker-data/containers/264c/hosts /etc/hosts rw,relatime - xfs /dev/mapper/centos-home rw,attr2",
  "276 232 253:0 /var/www/html/SIPP /usr/src/app/SIPP ro,relatime - xfs /dev/mapper/centos-root rw,attr2",
  "280 232 7:0 / /mnt/citra ro - squashfs /dev/loop0 ro",
  "281 232 0:50 / /usr/src/app/folder\\040berspasi rw - tmpfs tmpfs rw",
].join("\n");

const nd = (satuan: string, dimensi: Record<string, number>) => ({
  name: "x",
  units: satuan,
  last_updated: 1791265477,
  dimensions: Object.fromEntries(Object.entries(dimensi).map(([k, v]) => [k, { name: k, value: v }])),
});

/** Bentuk allmetrics?format=json netdata v2.11 (nilai 6 Okt 2026, dibulatkan). */
const NETDATA = {
  "system.ram": nd("MiB", { free: 2104, used: 4882, cached: 24621, buffers: 0.06 }),
  "cgroup_aleta-bot.mem": nd("MiB", { cache: 150.6, rss: 509.4, swap: 0, rss_huge: 2, mapped_file: 0 }),
  "cgroup_aleta-portal.mem": nd("MiB", { cache: 21, rss: 244, swap: 0 }),
  "cgroup_aleta-postgres.mem": nd("MiB", { cache: 70, rss: 4, swap: 0 }),
  "cgroup_docker_buildkit.mem": nd("MiB", { cache: 398, rss: 0, swap: 0 }),
  "systemd_mariadb.mem": nd("MiB", { cache: 802, rss: 2006, swap: 0 }),
  "systemd_httpd.mem": nd("MiB", { cache: 363.36, rss: 160.14, swap: 0.0039 }),
  "systemd_docker.mem": nd("MiB", { cache: 4660, rss: 364, swap: 0 }),
  "systemd_containerd.mem": nd("MiB", { cache: 67, rss: 30.6, swap: 0 }),
  "systemd_netdata.mem": nd("MiB", { cache: 80, rss: 191.6, swap: 0 }),
  "systemd_kdump.mem": nd("MiB", { cache: 0, rss: 0, swap: 0 }),
  "cgroup_aleta-bot.mem_usage": nd("MiB", { ram: 555.7, swap: 0 }),
  "disk_space./": nd("GiB", { avail: 599.91, used: 114.3, reserved_for_root: 0 }),
  "disk_space./home": nd("GiB", { avail: 78.67, used: 121.23, reserved_for_root: 0 }),
  "disk_space./boot": nd("GiB", { avail: 0.1, used: 0.9, reserved_for_root: 0 }),
  "disk_space./run": nd("GiB", { avail: 15, used: 0.1, reserved_for_root: 0 }),
  "rusak.tanpa_dimensi": { units: "MiB" },
};

const DOCKER_DF = [
  '{"Active":"4","Reclaimable":"28.8GB (95%)","Size":"30.3GB","TotalCount":"40","Type":"Images"}',
  '{"Active":"3","Reclaimable":"0B (0%)","Size":"751kB","TotalCount":"4","Type":"Containers"}',
  '{"Active":"0","Reclaimable":"0B","Size":"0B","TotalCount":"0","Type":"Local Volumes"}',
  '{"Active":"0","Reclaimable":"80.05GB","Size":"80.05GB","TotalCount":"311","Type":"Build Cache"}',
  "bukan json",
].join("\n");

describe("pengurai /proc dan cgroup", () => {
  it("meminfo: kB -> byte; terpakai = total - MemAvailable; swap terpakai", () => {
    const m = sd.uraiMeminfo(MEMINFO);
    expect(m.totalByte).toBe(32367924 * 1024);
    expect(m.tersediaByte).toBe(27069776 * 1024);
    expect(m.terpakaiByte).toBe((32367924 - 27069776) * 1024);
    expect(m.swapTerpakaiByte).toBe((16318460 - 16264700) * 1024);
  });

  it("meminfo kernel lama tanpa MemAvailable: free + buffers + cached; tanpa MemTotal: null", () => {
    const m = sd.uraiMeminfo("MemTotal: 1000 kB\nMemFree: 100 kB\nBuffers: 50 kB\nCached: 250 kB\n");
    expect(m.tersediaByte).toBe(400 * 1024);
    expect(m.terpakaiByte).toBe(600 * 1024);
    expect(sd.uraiMeminfo("MemFree: 1 kB")).toBeNull();
    expect(sd.uraiMeminfo("")).toBeNull();
  });

  it("memory.stat: total_* (hierarki) didahulukan atas nilai cgroup sendiri", () => {
    const s = sd.uraiMemoryStat(MEMORY_STAT);
    expect(s).toEqual({ rssByte: 539525120, cacheByte: 159236096, swapByte: 0, inactiveFileByte: 112181248 });
    expect(sd.uraiMemoryStat("cache 5\nrss 7\n")).toEqual({ rssByte: 7, cacheByte: 5, swapByte: 0, inactiveFileByte: 0 });
    expect(sd.uraiMemoryStat("apa 1")).toBeNull();
  });

  it("mountinfo: satu titik per perangkat blok; overlay, proc, tmpfs, loop dibuang; label LVM", () => {
    const daftar = sd.uraiMountinfo(MOUNTINFO);
    expect(daftar).toHaveLength(7);
    expect(daftar.find((m: any) => m.jenisFs === "tmpfs").titik).toBe("/usr/src/app/folder berspasi");
    const p = sd.partisiDariMountinfo(daftar);
    expect(p).toEqual([
      { titik: "/", perangkat: "/dev/mapper/centos-root", titikDiContainer: "/usr/share/zoneinfo/Etc/UTC" },
      { titik: "/home", perangkat: "/dev/mapper/centos-home", titikDiContainer: "/etc/hosts" },
    ]);
    expect(sd.labelPerangkat("/dev/sda1")).toBe("sda1");
    expect(sd.labelPerangkat("/dev/mapper/vg-var")).toBe("/var");
  });
});

describe("netdata: ALETA dipisah dari aplikasi lain", () => {
  const grafik = sd.uraiNetdata(NETDATA);

  it("allmetrics -> peta grafik; yang tanpa dimensi dibuang", () => {
    expect(grafik["systemd_httpd.mem"]).toEqual({
      satuan: "MiB",
      dimensi: { cache: 363.36, rss: 160.14, swap: 0.0039 },
      diperbarui: 1791265477,
    });
    expect(grafik["rusak.tanpa_dimensi"]).toBeUndefined();
    expect(sd.uraiNetdata(null)).toEqual({});
  });

  it("satuan: MiB/GiB biner, KB/MB desimal, satuan asing = null", () => {
    expect(sd.keByte(1, "MiB")).toBe(MIB);
    expect(sd.keByte(2, "GiB")).toBe(2 * GIB);
    expect(sd.keByte(1, "MB")).toBe(1e6);
    expect(sd.keByte(1, "persen")).toBeNull();
    expect(sd.keByte("x", "MiB")).toBeNull();
  });

  it("ALETA = container aleta-*, buildkit, dockerd, containerd; lain = httpd, mariadb, netdata; yang nol dibuang", () => {
    const r = sd.susunRincianNetdata(grafik);
    expect(r.aleta.map((b: any) => b.kunci).sort()).toEqual(
      ["aleta-bot", "aleta-portal", "aleta-postgres", "containerd", "docker", "docker_buildkit"].sort()
    );
    expect(r.lain.map((b: any) => b.kunci)).toEqual(["mariadb", "netdata", "httpd"]);
    const httpd = r.lain.find((b: any) => b.kunci === "httpd");
    expect(httpd.ramByte).toBe(Math.round(160.14 * MIB));
    expect(httpd.cacheByte).toBe(Math.round(363.36 * MIB));
    expect(httpd.jenis).toBe("layanan");
    expect(httpd.nama).toMatch(/SIPP, ABT/);
    const bot = r.aleta.find((b: any) => b.kunci === "aleta-bot");
    // RAM = rss (memori proses), BUKAN mem_usage (yang memasukkan cache aktif).
    expect(bot.ramByte).toBe(Math.round(509.4 * MIB));
    expect(bot.jenis).toBe("container");
    // Urut menurun menurut RAM di tiap kelompok.
    expect(r.aleta[0].kunci).toBe("aleta-bot");
  });

  it("partisi dari disk_space: /run dibuang, total = pakai + sisa + cadangan root", () => {
    const p = sd.partisiNetdata(grafik);
    expect(p.map((x: any) => x.titik)).toEqual(["/", "/boot", "/home"]);
    const home = p.find((x: any) => x.titik === "/home");
    expect(home.totalByte).toBe(Math.round(78.67 * GIB) + Math.round(121.23 * GIB));
  });

  it("disk server = partisi TERPENUH; /boot (90%) tidak menentukan", () => {
    const penentu = sd.partisiPenentu(sd.partisiNetdata(grafik));
    expect(penentu.titik).toBe("/home");
    expect(penentu.persen).toBeCloseTo(60.6, 1);
  });
});

describe("ambang warna", () => {
  it("batasnya persis: di bawah kuning hijau, tepat di ambang naik", () => {
    const a = sd.AMBANG.ram;
    expect([a.kuning, a.merah]).toEqual([75, 90]);
    expect(sd.warnaAmbang(0, a)).toBe("hijau");
    expect(sd.warnaAmbang(74.9, a)).toBe("hijau");
    expect(sd.warnaAmbang(75, a)).toBe("kuning");
    expect(sd.warnaAmbang(89.9, a)).toBe("kuning");
    expect(sd.warnaAmbang(90, a)).toBe("merah");
    expect(sd.warnaAmbang(100, a)).toBe("merah");
    expect(sd.warnaAmbang(79.9, sd.AMBANG.disk)).toBe("hijau");
    expect(sd.warnaAmbang(80, sd.AMBANG.disk)).toBe("kuning");
  });

  it("tanpa angka = kelabu, bukan hijau", () => {
    for (const x of [null, undefined, "", "abc", Number.NaN]) expect(sd.warnaAmbang(x, sd.AMBANG.ram)).toBe("kelabu");
    expect(sd.warnaAmbang(50, null)).toBe("kelabu");
  });
});

describe("Docker dan GPU", () => {
  it("ukuran ala Docker desimal; 'Reclaimable' berekor persen", () => {
    expect(sd.uraiUkuranDocker("30.3GB")).toBe(30.3e9);
    expect(sd.uraiUkuranDocker("751kB")).toBe(751000);
    expect(sd.uraiUkuranDocker("28.8GB (95%)")).toBe(28.8e9);
    expect(sd.uraiUkuranDocker("0B")).toBe(0);
    expect(sd.uraiUkuranDocker("banyak")).toBeNull();
  });

  it("docker system df per jenis; baris rusak dilewati", () => {
    const df = sd.uraiDockerDf(DOCKER_DF);
    expect(df.citra).toEqual({ byte: 30.3e9, dapatDiklaimByte: 28.8e9, jumlah: 40, aktif: 4 });
    expect(df.buildCache.byte).toBe(80.05e9);
    expect(df.volume.byte).toBe(0);
  });

  it("Matrox G200e (VGA papan server, server ini): TIDAK ADA GPU, persen null, warna kelabu", () => {
    const g = sd.nilaiGpu([{ kartu: "card0", vendor: "0x102b", device: "0x0522", driver: "mgag200", persen: null }], null);
    expect(g.ada).toBe(false);
    expect(g.persen).toBeNull();
    expect(g.keterangan).toMatch(/^Tidak ada GPU/);
    expect(g.keterangan).toMatch(/Matrox mgag200/);
    const r = sd.hitungRingkas({ memori: null, rincian: { aleta: [], lain: [] }, partisi: [], diskAleta: null, gpu: g });
    expect(r.server.gpu).toMatchObject({ ada: false, persen: null, warna: "kelabu" });
    expect(r.aleta.gpu).toMatchObject({ ada: false, warna: "kelabu" });
  });

  it("drm ada tetapi kosong: tidak ada GPU; drm tidak terbaca: disebut TIDAK TERBACA, bukan 'tidak ada'", () => {
    expect(sd.nilaiGpu([], null)).toMatchObject({ ada: false, persen: null, keterangan: "Tidak ada GPU di server ini." });
    const buta = sd.nilaiGpu(null, null);
    expect(buta).toMatchObject({ ada: false, persen: null });
    expect(buta.keterangan).toMatch(/tidak terbaca/);
    expect(buta.keterangan).not.toMatch(/^Tidak ada GPU/);
  });

  it("NVIDIA lewat nvidia-smi: rata-rata pemakaian; Intel tanpa penghitung: ada, persen null", () => {
    const smi = sd.uraiNvidiaSmi("NVIDIA T4, 40, 1024, 15360\nNVIDIA T4, 80, 2048, 15360\n");
    expect(smi[0]).toEqual({ nama: "NVIDIA T4", persen: 40, memoriTerpakaiByte: 1024 * MIB, memoriTotalByte: 15360 * MIB });
    const g = sd.nilaiGpu([{ vendor: "0x10de" }], smi);
    expect(g).toMatchObject({ ada: true, persen: 60 });
    expect(sd.warnaAmbang(g.persen, sd.AMBANG.gpu)).toBe("hijau");
    const intel = sd.nilaiGpu([{ vendor: "0x8086", driver: "i915", persen: null }], null);
    expect(intel).toMatchObject({ ada: true, persen: null });
    expect(intel.keterangan).toMatch(/tidak terbaca/);
  });
});

describe("ringkasan ALETA dan seluruh server", () => {
  const memori = sd.uraiMeminfo(MEMINFO);
  const grafik = sd.uraiNetdata(NETDATA);
  const rincian = sd.susunRincianNetdata(grafik);
  const partisi = sd.partisiNetdata(grafik);
  const gpu = sd.nilaiGpu([{ vendor: "0x102b", driver: "mgag200" }], null);

  it("RAM ALETA = jumlah RSS kelompok ALETA / MemTotal; RAM server = MemTotal - MemAvailable", () => {
    const disk = sd.susunDiskAleta({ docker: sd.uraiDockerDf(DOCKER_DF), folder: null, skema: null });
    const r = sd.hitungRingkas({ memori, rincian, partisi, diskAleta: disk, gpu });
    const rssAleta = rincian.aleta.reduce((s: number, b: any) => s + b.ramByte, 0);
    expect(r.aleta.ram.byte).toBe(rssAleta);
    expect(r.aleta.ram.persen).toBe(Math.round((rssAleta / memori.totalByte) * 1000) / 10);
    expect(r.server.ram.persen).toBeCloseTo(16.4, 1);
    expect(r.server.ram.warna).toBe("hijau");
    expect(r.server.disk.partisi).toBe("/home");
    // Disk ALETA = citra + build cache + lapisan container, terhadap kapasitas partisi selain /boot.
    expect(r.aleta.disk.byte).toBe(30.3e9 + 80.05e9 + 751000);
    expect(r.aleta.disk.sebagian).toBe(false);
  });

  it("tanpa cuplikan Docker: disk ALETA disebut SEBAGIAN", () => {
    const disk = sd.susunDiskAleta({
      docker: null,
      folder: { daftar: [{ kunci: "wa", nama: "Sesi WhatsApp", byte: 242899719, berkas: 588 }] },
      skema: { nama: "aleta_bot", byte: 104136704, tabel: 44 },
    });
    expect(disk.byte).toBe(242899719 + 104136704);
    expect(disk.lengkap).toBe(false);
    expect(disk.rincian.map((x: any) => x.kunci)).toEqual(["folder-wa", "mariadb-aleta-bot"]);
    const r = sd.hitungRingkas({ memori, rincian, partisi, diskAleta: disk, gpu });
    expect(r.aleta.disk.sebagian).toBe(true);
  });

  it("tanpa netdata (tidak ada butir ALETA): RAM ALETA tidak terukur = null dan kelabu, bukan 0% hijau", () => {
    const r = sd.hitungRingkas({ memori, rincian: { aleta: [], lain: [] }, partisi: [], diskAleta: null, gpu });
    expect(r.aleta.ram).toMatchObject({ byte: null, persen: null, warna: "kelabu" });
    expect(r.aleta.disk).toMatchObject({ byte: null, persen: null, warna: "kelabu" });
    expect(r.server.disk).toMatchObject({ persen: null, warna: "kelabu" });
  });

  it("RAM hampir penuh: merah di kedua sudut pandang bila ALETA sendiri yang memakannya", () => {
    const penuh = { ...memori, terpakaiByte: Math.round(memori.totalByte * 0.95) };
    const rakus = { aleta: [{ kunci: "aleta-bot", ramByte: Math.round(memori.totalByte * 0.91) }], lain: [] };
    const r = sd.hitungRingkas({ memori: penuh, rincian: rakus, partisi, diskAleta: null, gpu });
    expect(r.server.ram.warna).toBe("merah");
    expect(r.aleta.ram.warna).toBe("merah");
  });
});
