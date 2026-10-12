"use strict";

/**
 * ============================================================================
 * PEMANTAU SUMBER DAYA SERVER - RAM, DISK, GPU (permintaan 6 Okt 2026, butir 3)
 * ============================================================================
 *
 * Dua sudut pandang yang diminta pengguna:
 *   (a) ALETA saja  - tiga container (aleta-portal, aleta-bot, aleta-postgres)
 *                     beserta citra/build cache Docker dan data ALETA;
 *   (b) seluruh server - termasuk Apache + PHP (SIPP, ABT, antrian), MariaDB,
 *                     dan layanan host lain.
 *
 * ============================================================================
 * DARI MANA TIAP ANGKA DIBACA (diukur di server 6 Okt 2026)
 * ============================================================================
 *
 * Bot berjalan privileged dengan jaringan host, TETAPI ruang PID-nya sendiri
 * (hanya 5 proses terlihat) dan soket Docker TIDAK dipasang. Karena itu:
 *
 *   RAM server     /proc/meminfo - di container tanpa lxcfs isinya milik HOST
 *                  (MemTotal 32367924 kB = `free` di host). Terpakai =
 *                  MemTotal - MemAvailable (cache yang dapat dilepas tidak
 *                  dihitung, sama dengan kolom "available" `free`).
 *   RAM per        API netdata di host (http://127.0.0.1:19999, terjangkau
 *   container &    karena bot memakai jaringan host). netdata membaca cgroup
 *   layanan        host: cgroup_<nama container>.mem dan systemd_<layanan>.mem
 *                  (rss, cache, swap dalam MiB). Satu permintaan allmetrics
 *                  bersaring (~32 KB). Tanpa netdata: hanya container bot
 *                  sendiri (/sys/fs/cgroup/memory/memory.stat) - portal
 *                  menambahkan miliknya sendiri; postgres tidak terukur.
 *   Disk partisi   statfs atas titik pasang di /proc/self/mountinfo: satu per
 *                  perangkat /dev/mapper/* (centos-root = "/", centos-home =
 *                  "/home"). netdata disk_space.* bila ada (namanya sudah
 *                  titik pasang host).
 *   Disk ALETA     (1) citra + build cache Docker dari berkas cuplikan
 *                  `docker system df` (scripts/aleta-sumber-daya-docker.sh,
 *                  dijalankan di HOST - bot tidak punya soket Docker);
 *                  (2) folder data yang dipasang ke bot (dijelajah tiap 10
 *                  menit, di latar); (3) skema MariaDB aleta_bot
 *                  (information_schema, satu skema saja: 30 ms - SEMUA skema
 *                  butuh 18,7 detik, jadi tidak dilakukan); (4) Postgres
 *                  ditambahkan portal (pg_database_size).
 *   GPU            /sys/class/drm/cardN/device (vendor, driver). Server ini:
 *                  Matrox G200e (0x102b:0x0522, driver mgag200) - kartu VGA
 *                  bawaan papan server untuk layar konsol, BUKAN GPU
 *                  komputasi, tanpa penghitung pemakaian. nvidia-smi tidak
 *                  ada, /dev/nvidia* tidak ada. Jawabannya "tidak ada GPU" -
 *                  tidak pernah angka karangan.
 *
 * Folder SIPP (75 GB, 101 ribu berkas) SENGAJA tidak dijelajah: berat, dan
 * ada satu inode rusak di sana yang memicu pesan kernel tiap kali disentuh.
 * Ukuran aplikasi lain di disk dibaca sebagai SISA partisi, bukan ditebak.
 *
 * Seluruh berkas ini hanya MEMBACA. Tidak ada yang ditulis ke host, ke
 * MariaDB, maupun ke netdata.
 */

const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

/* === 12OKT-J: CPU (pengurai dan pembaca di berkas sendiri) === */
const cpuSvc = require("./sumberDayaCpuService");
/* === AKHIR 12OKT-J === */

const KIB = 1024;
const MIB = 1024 * 1024;
const GIB = 1024 * 1024 * 1024;

/** Ambang warna (persen). Sama untuk ALETA dan seluruh server. */
const AMBANG = Object.freeze({
  ram: Object.freeze({ kuning: 75, merah: 90 }),
  disk: Object.freeze({ kuning: 80, merah: 90 }),
  gpu: Object.freeze({ kuning: 70, merah: 90 }),
  cpu: cpuSvc.AMBANG_CPU, // 12OKT-J
});

const SINGGAH_RINGKAS_MS = 3000;
const SINGGAH_FOLDER_MS = 10 * 60 * 1000;
const SINGGAH_SKEMA_MS = 30 * 60 * 1000;
const BATAS_ENTRI_FOLDER = 200000;

/**
 * Nama layanan host yang dikenal. Yang tidak terdaftar tetap tampil dengan
 * nama unit systemd-nya - tidak ada layanan yang disembunyikan.
 */
const NAMA_LAYANAN = Object.freeze({
  httpd: "Apache + PHP (SIPP, ABT, antrian, situs lain)",
  mariadb: "MariaDB (database SIPP, ABT, aleta_bot, dll.)",
  mysqld: "MySQL",
  docker: "Docker daemon (menjalankan container ALETA)",
  containerd: "containerd (runtime container ALETA)",
  netdata: "Netdata (pemantau)",
  soffice: "LibreOffice (soffice)",
  "gammu-smsd": "Gammu SMS",
  smb: "Samba (berbagi berkas)",
  nmb: "Samba NetBIOS",
  postfix: "Postfix (surel)",
  sshd: "SSH",
  firewalld: "firewalld",
  "systemd-journald": "journald (log sistem)",
  rsyslog: "rsyslog",
  NetworkManager: "NetworkManager",
  tuned: "tuned",
  polkit: "polkit",
  auditd: "auditd",
  crond: "cron",
});

/**
 * Layanan host yang ada HANYA untuk ALETA: di server ini Docker tidak
 * menjalankan apa pun selain container ALETA (semua 40 citra milik ALETA,
 * diperiksa 6 Okt 2026), jadi dockerd dan containerd dihitung ke ALETA.
 */
const LAYANAN_ALETA = Object.freeze(["docker", "containerd"]);

const NAMA_CONTAINER_ALETA = Object.freeze({
  "aleta-portal": "Portal ALETA (Next.js)",
  "aleta-bot": "ALETA Bot (Node)",
  "aleta-postgres": "PostgreSQL ALETA",
  docker_buildkit: "Docker buildkit (sisa build ALETA)",
});

// ─── Pengurai murni (diuji) ──────────────────────────────────────────────────

/** null, undefined, dan "" = tidak ada angka - Number(null) yang 0 tidak boleh lolos sebagai 0%. */
function angka(x) {
  if (x === null || x === undefined || (typeof x === "string" && !x.trim())) return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function persen(bagian, total) {
  if (!(Number(total) > 0) || !Number.isFinite(Number(bagian))) return null;
  return Math.round((Number(bagian) / Number(total)) * 1000) / 10;
}

/** "hijau" | "kuning" | "merah" | "kelabu" (tidak ada angka). */
function warnaAmbang(nilaiPersen, ambang) {
  if (nilaiPersen === null || nilaiPersen === undefined || nilaiPersen === "") return "kelabu";
  const p = Number(nilaiPersen);
  if (!Number.isFinite(p) || !ambang) return "kelabu";
  if (p >= ambang.merah) return "merah";
  if (p >= ambang.kuning) return "kuning";
  return "hijau";
}

/**
 * /proc/meminfo -> byte. Kernel tanpa MemAvailable (< 3.14) dihitung dari
 * MemFree + Buffers + Cached. null bila MemTotal tidak ada.
 */
function uraiMeminfo(teks) {
  const nilai = {};
  for (const baris of String(teks || "").split(/\r?\n/)) {
    const m = /^([A-Za-z0-9_()]+):\s+(\d+)(?:\s*kB)?\s*$/.exec(baris.trim());
    if (m) nilai[m[1]] = Number(m[2]) * KIB;
  }
  if (!(nilai.MemTotal > 0)) return null;
  const tersedia =
    nilai.MemAvailable !== undefined
      ? nilai.MemAvailable
      : (nilai.MemFree || 0) + (nilai.Buffers || 0) + (nilai.Cached || 0);
  const swapTotal = nilai.SwapTotal || 0;
  return {
    totalByte: nilai.MemTotal,
    tersediaByte: tersedia,
    terpakaiByte: Math.max(0, nilai.MemTotal - tersedia),
    cacheByte: (nilai.Cached || 0) + (nilai.Buffers || 0),
    swapTotalByte: swapTotal,
    swapTerpakaiByte: Math.max(0, swapTotal - (nilai.SwapFree || 0)),
  };
}

/**
 * memory.stat cgroup v1 -> { rssByte, cacheByte, swapByte, inactiveFileByte }.
 * total_* (hierarki) didahulukan; tanpa itu nilai cgroup itu sendiri.
 */
function uraiMemoryStat(teks) {
  const nilai = {};
  for (const baris of String(teks || "").split(/\r?\n/)) {
    const m = /^(\w+)\s+(\d+)\s*$/.exec(baris.trim());
    if (m) nilai[m[1]] = Number(m[2]);
  }
  const ambil = (k) => (nilai[`total_${k}`] !== undefined ? nilai[`total_${k}`] : nilai[k]);
  if (ambil("rss") === undefined && ambil("cache") === undefined) return null;
  return {
    rssByte: ambil("rss") || 0,
    cacheByte: ambil("cache") || 0,
    swapByte: ambil("swap") || 0,
    inactiveFileByte: ambil("inactive_file") || 0,
  };
}

/**
 * /proc/self/mountinfo -> [{ mayorMinor, akar, titik, jenisFs, sumber }].
 * Bentuk baris: id induk maj:min akar titik opsi [opsional...] - jenis sumber super
 */
function uraiMountinfo(teks) {
  const hasil = [];
  for (const baris of String(teks || "").split(/\r?\n/)) {
    if (!baris.trim()) continue;
    const [kiri, kanan] = baris.split(" - ");
    if (!kanan) continue;
    const a = kiri.trim().split(/\s+/);
    const b = kanan.trim().split(/\s+/);
    if (a.length < 5 || b.length < 2) continue;
    const buka = (s) => s.replace(/\\040/g, " ").replace(/\\011/g, "\t").replace(/\\134/g, "\\");
    hasil.push({ mayorMinor: a[2], akar: buka(a[3]), titik: buka(a[4]), jenisFs: b[0], sumber: buka(b[1]) });
  }
  return hasil;
}

/** Label partisi host dari nama perangkat LVM: centos-root -> "/", centos-home -> "/home". */
function labelPerangkat(sumber) {
  const s = String(sumber || "");
  const nama = s.split("/").pop() || s;
  if (/(^|-)root$/.test(nama)) return "/";
  const m = /-([a-z0-9_]+)$/.exec(nama);
  if (m && ["home", "var", "opt", "srv", "data", "tmp", "usr"].includes(m[1])) return `/${m[1]}`;
  return nama;
}

/**
 * Satu titik wakil per perangkat blok sungguhan (/dev/*, bukan loop) - titik
 * itu yang di-statfs. Overlay "/" container tidak diwakili sendiri: ia
 * menumpang di partisi yang memuat data Docker, yang sudah terwakili oleh
 * /etc/hosts (bind dari /home/docker-data/containers/...).
 */
function partisiDariMountinfo(daftar) {
  const per = new Map();
  for (const m of daftar || []) {
    if (!/^\/dev\//.test(m.sumber) || /^\/dev\/loop/.test(m.sumber)) continue;
    if (per.has(m.mayorMinor)) continue;
    per.set(m.mayorMinor, { titik: labelPerangkat(m.sumber), perangkat: m.sumber, titikDiContainer: m.titik });
  }
  return [...per.values()];
}

/**
 * Jawaban /api/v1/allmetrics?format=json netdata -> peta nama grafik ->
 * { satuan, dimensi: { nama: angka } }.
 */
function uraiNetdata(json) {
  const hasil = {};
  if (!json || typeof json !== "object") return hasil;
  for (const [nama, g] of Object.entries(json)) {
    if (!g || typeof g !== "object" || !g.dimensions || typeof g.dimensions !== "object") continue;
    const dimensi = {};
    for (const [kunci, d] of Object.entries(g.dimensions)) {
      const v = angka(d && d.value);
      if (v !== null) dimensi[kunci] = v;
    }
    hasil[nama] = { satuan: String(g.units || ""), dimensi, diperbarui: angka(g.last_updated) };
  }
  return hasil;
}

/** Nilai netdata ke byte menurut satuannya. null bila satuannya tidak dikenal. */
function keByte(nilai, satuan) {
  const v = angka(nilai);
  if (v === null) return null;
  const s = String(satuan || "").trim();
  const kali = { B: 1, KiB: KIB, MiB: MIB, GiB: GIB, TiB: GIB * 1024, KB: 1000, MB: 1e6, GB: 1e9, TB: 1e12 }[s];
  return kali ? Math.round(v * kali) : null;
}

/**
 * Ukuran ala Docker ("30.3GB", "751kB", "28.8GB (95%)", "0B") -> byte.
 * Docker memakai satuan desimal (units.HumanSize).
 */
function uraiUkuranDocker(teks) {
  const m = /^\s*([\d.]+)\s*([kKMGTP]?B)\b/.exec(String(teks || ""));
  if (!m) return null;
  const kali = { B: 1, kB: 1e3, KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12, PB: 1e15 }[m[2]];
  if (!kali) return null;
  return Math.round(Number(m[1]) * kali);
}

/** Baris JSON `docker system df --format '{{json .}}'` -> per jenis. */
function uraiDockerDf(teks) {
  const peta = { Images: "citra", Containers: "container", "Local Volumes": "volume", "Build Cache": "buildCache" };
  const hasil = {};
  for (const baris of String(teks || "").split(/\r?\n/)) {
    if (!baris.trim().startsWith("{")) continue;
    let x;
    try {
      x = JSON.parse(baris);
    } catch {
      continue;
    }
    const kunci = peta[x.Type];
    if (!kunci) continue;
    hasil[kunci] = {
      byte: uraiUkuranDocker(x.Size),
      dapatDiklaimByte: uraiUkuranDocker(x.Reclaimable),
      jumlah: angka(x.TotalCount),
      aktif: angka(x.Active),
    };
  }
  return hasil;
}

/** nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total --format=csv,noheader,nounits */
function uraiNvidiaSmi(teks) {
  const hasil = [];
  for (const baris of String(teks || "").split(/\r?\n/)) {
    const k = baris.split(",").map((s) => s.trim());
    if (k.length < 4 || !k[0]) continue;
    const pakai = angka(k[1]);
    const memPakai = angka(k[2]);
    const memTotal = angka(k[3]);
    hasil.push({
      nama: k[0],
      persen: pakai,
      memoriTerpakaiByte: memPakai === null ? null : memPakai * MIB,
      memoriTotalByte: memTotal === null ? null : memTotal * MIB,
    });
  }
  return hasil;
}

const VENDOR_GPU = Object.freeze({
  "0x10de": { nama: "NVIDIA", komputasi: true },
  "0x1002": { nama: "AMD", komputasi: true },
  "0x8086": { nama: "Intel", komputasi: true },
  "0x102b": { nama: "Matrox", komputasi: false },
  "0x1a03": { nama: "ASPEED", komputasi: false },
  "0x19a2": { nama: "Emulex (VGA BMC)", komputasi: false },
});

/**
 * Keadaan GPU dari perangkat drm dan (bila ada) nvidia-smi / amdgpu.
 *   perangkat: [{ vendor: "0x102b", device, driver, persen?, vramTerpakaiByte?, vramTotalByte? }]
 *   nvidia:    hasil uraiNvidiaSmi atau null
 * Kartu VGA papan server (Matrox, ASPEED) BUKAN GPU: tidak dihitung ada.
 */
function nilaiGpu(perangkat, nvidia) {
  if (perangkat === null && !(Array.isArray(nvidia) && nvidia.length)) {
    // /sys/class/drm tidak terbaca: "tidak tahu", bukan "tidak ada".
    return { ada: false, persen: null, keterangan: "GPU tidak terbaca: /sys/class/drm tidak ada di sini.", perangkat: [] };
  }
  const daftar = (perangkat || []).map((p) => {
    const v = VENDOR_GPU[String(p.vendor || "").toLowerCase()];
    return { ...p, namaVendor: v ? v.nama : String(p.vendor || "tidak dikenal"), komputasi: v ? v.komputasi : true };
  });
  const gpu = daftar.filter((p) => p.komputasi);
  const vga = daftar.filter((p) => !p.komputasi);
  const sebutVga = vga.length
    ? ` Yang ada hanya kartu VGA bawaan papan server (${vga
        .map((p) => `${p.namaVendor}${p.driver ? ` ${p.driver}` : ""}`)
        .join(", ")}) untuk layar konsol, tanpa penghitung pemakaian.`
    : "";
  if (Array.isArray(nvidia) && nvidia.length) {
    const terbaca = nvidia.filter((g) => g.persen !== null);
    const rata = terbaca.length ? Math.round((terbaca.reduce((s, g) => s + g.persen, 0) / terbaca.length) * 10) / 10 : null;
    return {
      ada: true,
      persen: rata,
      keterangan: `${nvidia.length} GPU NVIDIA (nvidia-smi).`,
      perangkat: nvidia.map((g) => ({ ...g, namaVendor: "NVIDIA" })),
    };
  }
  if (!gpu.length) {
    return { ada: false, persen: null, keterangan: `Tidak ada GPU di server ini.${sebutVga}`, perangkat: daftar };
  }
  const terbaca = gpu.filter((p) => angka(p.persen) !== null);
  const rata = terbaca.length ? Math.round((terbaca.reduce((s, p) => s + Number(p.persen), 0) / terbaca.length) * 10) / 10 : null;
  return {
    ada: true,
    persen: rata,
    keterangan: terbaca.length
      ? `${gpu.length} GPU (${gpu.map((p) => p.namaVendor).join(", ")}).`
      : `Ada GPU ${gpu.map((p) => p.namaVendor).join(", ")}, tetapi pemakaiannya tidak terbaca dari dalam container (butuh nvidia-smi atau driver amdgpu).`,
    perangkat: daftar,
  };
}

/**
 * Grafik memori netdata -> butir per container dan per layanan host.
 *   ALETA: cgroup_aleta-* dan cgroup_docker_buildkit (build ALETA).
 *   Lain:  systemd_<layanan> dan container lain.
 * RAM = rss (memori proses); cache berkas disebut terpisah karena dapat
 * dilepas kernel kapan saja.
 */
function susunRincianNetdata(grafik) {
  const aleta = [];
  const lain = [];
  for (const [nama, g] of Object.entries(grafik || {})) {
    let m = /^cgroup_(.+)\.mem$/.exec(nama);
    const jenis = m ? "container" : "layanan";
    if (!m) m = /^systemd_(.+)\.mem$/.exec(nama);
    if (!m) continue;
    const kunci = m[1];
    const d = g.dimensi || {};
    const butir = {
      kunci,
      nama: jenis === "container" ? NAMA_CONTAINER_ALETA[kunci] || `Container ${kunci}` : NAMA_LAYANAN[kunci] || `${kunci}.service`,
      jenis,
      ramByte: keByte(d.rss, g.satuan) || 0,
      cacheByte: keByte(d.cache, g.satuan) || 0,
      swapByte: keByte(d.swap, g.satuan) || 0,
    };
    const milikAleta =
      jenis === "container" ? kunci.startsWith("aleta-") || kunci === "docker_buildkit" : LAYANAN_ALETA.includes(kunci);
    if (milikAleta) aleta.push(butir);
    else if (butir.ramByte > 0 || butir.cacheByte > 0) lain.push(butir);
  }
  const urut = (a, b) => b.ramByte - a.ramByte || b.cacheByte - a.cacheByte || a.kunci.localeCompare(b.kunci);
  return { aleta: aleta.sort(urut), lain: lain.sort(urut) };
}

/** Partisi dari grafik disk_space.* netdata (GiB) - /run, /dev, /sys dibuang. */
function partisiNetdata(grafik) {
  const hasil = [];
  for (const [nama, g] of Object.entries(grafik || {})) {
    const m = /^disk_space\.(.+)$/.exec(nama);
    if (!m) continue;
    const titik = m[1];
    if (/^\/(run|dev|sys|proc)(\/|$)/.test(titik)) continue;
    const d = g.dimensi || {};
    const pakai = keByte(d.used, g.satuan);
    const sisa = keByte(d.avail, g.satuan);
    const cadangan = keByte(d.reserved_for_root, g.satuan) || 0;
    if (pakai === null || sisa === null) continue;
    hasil.push({ titik, totalByte: pakai + sisa + cadangan, terpakaiByte: pakai, sisaByte: sisa });
  }
  return hasil.sort((a, b) => a.titik.localeCompare(b.titik));
}

/** Partisi yang menentukan warna "disk server": yang paling penuh, /boot* diabaikan. */
function partisiPenentu(partisi) {
  let terpilih = null;
  for (const p of partisi || []) {
    if (/^\/boot(\/|$)/.test(p.titik)) continue;
    const pr = persen(p.terpakaiByte, p.totalByte);
    if (pr === null) continue;
    if (!terpilih || pr > terpilih.persen) terpilih = { ...p, persen: pr };
  }
  return terpilih;
}

/**
 * Ringkasan dua sudut pandang. Semua masukan sudah byte; null = tidak terukur.
 *   memori:   uraiMeminfo
 *   rincian:  { aleta: [...], lain: [...] }
 *   partisi:  [{ titik, totalByte, terpakaiByte }]
 *   diskAleta:{ byte, rincian: [...] }
 *   gpu:      nilaiGpu
 *   cpu:      ukurCpuServer (opsional; tanpanya keping CPU "tidak terbaca")
 *   cpuSebagian: true bila CPU ALETA hanya dari container bot (tanpa netdata)
 */
function hitungRingkas({ memori, rincian, partisi, diskAleta, gpu, cpu, cpuSebagian }) {
  const totalRam = memori ? memori.totalByte : null;
  const aletaRam = (rincian && rincian.aleta ? rincian.aleta : []).reduce((s, b) => s + (b.ramByte || 0), 0);
  const adaRamAleta = Boolean(rincian && rincian.aleta && rincian.aleta.length);
  const kapasitas = (partisi || []).filter((p) => !/^\/boot(\/|$)/.test(p.titik)).reduce((s, p) => s + (p.totalByte || 0), 0);
  const penentu = partisiPenentu(partisi);
  const pGpu = gpu && gpu.ada ? gpu.persen : null;
  const kepingGpu = {
    ada: Boolean(gpu && gpu.ada),
    persen: pGpu,
    warna: warnaAmbang(pGpu, AMBANG.gpu),
    keterangan: gpu ? gpu.keterangan : "GPU tidak terbaca.",
  };
  const ramAletaPersen = adaRamAleta ? persen(aletaRam, totalRam) : null;
  const diskAletaPersen = diskAleta && diskAleta.byte !== null ? persen(diskAleta.byte, kapasitas) : null;
  const ramServerPersen = memori ? persen(memori.terpakaiByte, memori.totalByte) : null;
  /* === 12OKT-J: keping CPU === */
  const kepingCpu = cpuSvc.susunKepingCpu({ cpu: cpu || null, rincianAleta: rincian && rincian.aleta, aletaSebagian: cpuSebagian });
  /* === AKHIR 12OKT-J === */
  return {
    aleta: {
      cpu: kepingCpu.aleta, // 12OKT-J
      ram: { byte: adaRamAleta ? aletaRam : null, totalByte: totalRam, persen: ramAletaPersen, warna: warnaAmbang(ramAletaPersen, AMBANG.ram) },
      disk: {
        byte: diskAleta ? diskAleta.byte : null,
        totalByte: kapasitas || null,
        persen: diskAletaPersen,
        warna: warnaAmbang(diskAletaPersen, AMBANG.disk),
        sebagian: Boolean(diskAleta && diskAleta.byte !== null && diskAleta.lengkap === false),
      },
      gpu: { ...kepingGpu, keterangan: kepingGpu.ada ? "Pemakaian GPU per aplikasi tidak terbaca." : kepingGpu.keterangan },
    },
    server: {
      cpu: kepingCpu.server, // 12OKT-J
      ram: {
        byte: memori ? memori.terpakaiByte : null,
        totalByte: totalRam,
        persen: ramServerPersen,
        warna: warnaAmbang(ramServerPersen, AMBANG.ram),
      },
      disk: penentu
        ? {
            byte: penentu.terpakaiByte,
            totalByte: penentu.totalByte,
            persen: penentu.persen,
            warna: warnaAmbang(penentu.persen, AMBANG.disk),
            partisi: penentu.titik,
          }
        : { byte: null, totalByte: null, persen: null, warna: "kelabu", partisi: null },
      gpu: kepingGpu,
    },
  };
}

// ─── Pembaca (menyentuh berkas / jaringan) ──────────────────────────────────

const AKAR_APP = process.env.ALETA_BOT_APP_DIR || path.resolve(__dirname, "..");
const ALAMAT_NETDATA = String(process.env.ALETA_NETDATA_URL || "http://127.0.0.1:19999").replace(/\/$/, "");
const SARING_NETDATA = [
  "system.ram",
  "mem.available",
  "mem.swap",
  "cgroup_*.mem",
  "systemd_*.mem",
  "disk_space.*",
].join(" ");

async function bacaTeks(berkas) {
  try {
    return await fs.promises.readFile(berkas, "utf8");
  } catch {
    return null;
  }
}

async function bacaNetdata() {
  if (String(process.env.ALETA_NETDATA || "1") === "0") return { ok: false, alasan: "dimatikan (ALETA_NETDATA=0)" };
  const pengendali = new AbortController();
  const tunda = setTimeout(() => pengendali.abort(), 2500);
  try {
    const url = `${ALAMAT_NETDATA}/api/v1/allmetrics?format=json&filter=${encodeURIComponent(SARING_NETDATA)}`;
    const r = await fetch(url, { signal: pengendali.signal });
    if (!r.ok) return { ok: false, alasan: `netdata HTTP ${r.status}` };
    const grafik = uraiNetdata(await r.json());
    if (!Object.keys(grafik).length) return { ok: false, alasan: "netdata menjawab kosong" };
    return { ok: true, grafik };
  } catch (galat) {
    return { ok: false, alasan: galat && galat.name === "AbortError" ? "netdata tidak menjawab (2,5 dtk)" : `netdata tidak terjangkau: ${galat.message || galat}` };
  } finally {
    clearTimeout(tunda);
  }
}

async function bacaPartisiStatfs() {
  const daftar = partisiDariMountinfo(uraiMountinfo(await bacaTeks("/proc/self/mountinfo")));
  const hasil = [];
  for (const p of daftar) {
    try {
      const s = await fs.promises.statfs(p.titikDiContainer);
      const total = Number(s.blocks) * Number(s.bsize);
      const sisa = Number(s.bavail) * Number(s.bsize);
      const bebas = Number(s.bfree) * Number(s.bsize);
      hasil.push({ titik: p.titik, perangkat: p.perangkat, totalByte: total, terpakaiByte: total - bebas, sisaByte: sisa });
    } catch {
      /* titik yang tidak dapat di-statfs dilewati */
    }
  }
  return hasil;
}

/** Perangkat drm: card0, card1 (bukan card0-VGA-1). */
async function bacaPerangkatGpu() {
  const akar = "/sys/class/drm";
  let nama = [];
  try {
    nama = (await fs.promises.readdir(akar)).filter((n) => /^card\d+$/.test(n));
  } catch {
    return null;
  }
  const hasil = [];
  for (const n of nama) {
    const dev = path.join(akar, n, "device");
    const vendor = String((await bacaTeks(path.join(dev, "vendor"))) || "").trim();
    const device = String((await bacaTeks(path.join(dev, "device"))) || "").trim();
    let driver = "";
    try {
      driver = path.basename(await fs.promises.readlink(path.join(dev, "driver")));
    } catch {
      driver = "";
    }
    const sibuk = String((await bacaTeks(path.join(dev, "gpu_busy_percent"))) || "").trim();
    const vramPakai = String((await bacaTeks(path.join(dev, "mem_info_vram_used"))) || "").trim();
    const vramTotal = String((await bacaTeks(path.join(dev, "mem_info_vram_total"))) || "").trim();
    hasil.push({
      kartu: n,
      vendor,
      device,
      driver,
      persen: sibuk ? angka(sibuk) : null,
      vramTerpakaiByte: vramPakai ? angka(vramPakai) : null,
      vramTotalByte: vramTotal ? angka(vramTotal) : null,
    });
  }
  return hasil;
}

function jalankanNvidiaSmi() {
  return new Promise((selesai) => {
    execFile(
      "nvidia-smi",
      ["--query-gpu=name,utilization.gpu,memory.used,memory.total", "--format=csv,noheader,nounits"],
      { timeout: 2500 },
      (galat, keluar) => selesai(galat ? null : uraiNvidiaSmi(keluar))
    );
  });
}

async function bacaGpu() {
  const perangkat = await bacaPerangkatGpu();
  const adaNvidia = (perangkat || []).some((p) => String(p.vendor).toLowerCase() === "0x10de");
  const nvidia = adaNvidia ? await jalankanNvidiaSmi() : null;
  return nilaiGpu(perangkat, nvidia);
}

/** Ukuran folder (byte, berkas) - dijelajah tanpa mengikuti tautan simbolik. */
async function ukurFolder(akar, batas = BATAS_ENTRI_FOLDER) {
  let byte = 0;
  let berkas = 0;
  let entri = 0;
  const antre = [akar];
  while (antre.length) {
    const dir = antre.pop();
    let isi;
    try {
      isi = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of isi) {
      entri += 1;
      if (entri > batas) return { byte, berkas, terpotong: true };
      const p = path.join(dir, e.name);
      if (e.isDirectory()) antre.push(p);
      else if (e.isFile()) {
        try {
          byte += (await fs.promises.lstat(p)).size;
          berkas += 1;
        } catch {
          /* berkas hilang di tengah jalan */
        }
      }
    }
  }
  return { byte, berkas, terpotong: false };
}

const FOLDER_ALETA = [
  { kunci: "ecourt", nama: "Arsip dokumen e-Court", rel: "data/ecourt" },
  { kunci: "sesi-ecourt", nama: "Sesi peramban e-Court", rel: ".ecourt-session" },
  { kunci: "wa", nama: "Sesi WhatsApp", rel: ".wwebjs_auth" },
  { kunci: "laporan", nama: "Laporan", rel: "reports" },
  { kunci: "runtime", nama: "Data runtime bot", rel: "runtime-data" },
];

const singgah = {
  ringkas: null,
  ringkasPada: 0,
  ringkasJalan: null,
  folder: null,
  folderPada: 0,
  folderJalan: null,
  skema: null,
  skemaPada: 0,
  skemaJalan: null,
};

function ukurFolderAleta() {
  if (singgah.folderJalan) return singgah.folderJalan;
  singgah.folderJalan = (async () => {
    const hasil = [];
    for (const f of FOLDER_ALETA) {
      const p = path.join(AKAR_APP, f.rel);
      try {
        await fs.promises.access(p);
      } catch {
        continue;
      }
      const u = await ukurFolder(p);
      hasil.push({ kunci: f.kunci, nama: f.nama, byte: u.byte, berkas: u.berkas, terpotong: u.terpotong });
    }
    singgah.folder = { daftar: hasil, diukurPada: new Date().toISOString() };
    singgah.folderPada = Date.now();
    return singgah.folder;
  })().finally(() => {
    singgah.folderJalan = null;
  });
  return singgah.folderJalan;
}

function ukurSkemaAletaBot() {
  if (singgah.skemaJalan) return singgah.skemaJalan;
  singgah.skemaJalan = new Promise((selesai) => {
    let db;
    try {
      db = require("../bot_db_config");
    } catch (galat) {
      selesai({ byte: null, alasan: String(galat.message || galat) });
      return;
    }
    const nama = process.env.ALETA_BOT_INTERNAL_DB_NAME || process.env.ALETA_BOT_DB_NAME || "aleta_bot";
    db.query(
      "SELECT SUM(data_length + index_length) AS b, COUNT(*) AS n FROM information_schema.TABLES WHERE table_schema = ?",
      [nama],
      (galat, baris) => {
        if (galat) selesai({ byte: null, alasan: String(galat.message || galat) });
        else selesai({ nama, byte: angka(baris && baris[0] && baris[0].b), tabel: angka(baris && baris[0] && baris[0].n) });
      }
    );
  })
    .then((h) => {
      singgah.skema = { ...h, diukurPada: new Date().toISOString() };
      singgah.skemaPada = Date.now();
      return singgah.skema;
    })
    .finally(() => {
      singgah.skemaJalan = null;
    });
  return singgah.skemaJalan;
}

const BERKAS_DOCKER = path.join(AKAR_APP, "runtime-data", "sumber-daya-docker.json");

/** Cuplikan `docker system df` yang ditulis skrip host - { dibuat, baris: "..." }. */
async function bacaCuplikanDocker() {
  const teks = await bacaTeks(process.env.ALETA_SUMBER_DAYA_DOCKER_FILE || BERKAS_DOCKER);
  if (!teks) return null;
  try {
    const isi = JSON.parse(teks);
    const df = uraiDockerDf(String(isi.df || ""));
    if (!Object.keys(df).length) return null;
    return { dibuat: String(isi.dibuat || ""), ...df };
  } catch {
    return null;
  }
}

/** Butir disk ALETA dari tiap sumbernya. byte null bila tidak satu pun terukur. */
function susunDiskAleta({ docker, folder, skema }) {
  const rincian = [];
  if (docker) {
    if (docker.citra) rincian.push({ kunci: "citra", nama: "Citra Docker ALETA", byte: docker.citra.byte, dapatDiklaimByte: docker.citra.dapatDiklaimByte, jumlah: docker.citra.jumlah });
    if (docker.buildCache) rincian.push({ kunci: "build-cache", nama: "Build cache Docker", byte: docker.buildCache.byte, dapatDiklaimByte: docker.buildCache.dapatDiklaimByte, jumlah: docker.buildCache.jumlah });
    if (docker.container) rincian.push({ kunci: "container", nama: "Lapisan tulis container", byte: docker.container.byte, jumlah: docker.container.jumlah });
    if (docker.volume && docker.volume.byte) rincian.push({ kunci: "volume", nama: "Volume Docker", byte: docker.volume.byte, jumlah: docker.volume.jumlah });
  }
  for (const f of (folder && folder.daftar) || []) rincian.push({ kunci: `folder-${f.kunci}`, nama: f.nama, byte: f.byte, berkas: f.berkas, terpotong: f.terpotong });
  if (skema && skema.byte !== null && skema.byte !== undefined) rincian.push({ kunci: "mariadb-aleta-bot", nama: `Database ${skema.nama || "aleta_bot"} (MariaDB)`, byte: skema.byte, tabel: skema.tabel });
  const terukur = rincian.filter((r) => Number.isFinite(r.byte));
  // Tanpa cuplikan Docker, bagian TERBESAR disk ALETA (citra + build cache)
  // belum terhitung - angkanya disebut "sebagian", bukan dibiarkan tampak kecil.
  return { byte: terukur.length ? terukur.reduce((s, r) => s + r.byte, 0) : null, lengkap: Boolean(docker), rincian };
}

async function bacaRincianCadangan() {
  // Tanpa netdata: hanya container bot sendiri.
  const stat = uraiMemoryStat(await bacaTeks("/sys/fs/cgroup/memory/memory.stat"));
  if (!stat) return { aleta: [], lain: [] };
  return {
    aleta: [{ kunci: "aleta-bot", nama: NAMA_CONTAINER_ALETA["aleta-bot"], jenis: "container", ramByte: stat.rssByte, cacheByte: stat.cacheByte, swapByte: stat.swapByte }],
    lain: [],
  };
}

async function kumpulkan() {
  const catatan = [];
  const sekarang = Date.now();
  if (!singgah.folder || sekarang - singgah.folderPada > SINGGAH_FOLDER_MS) void ukurFolderAleta().catch(() => undefined);
  if (!singgah.skema || sekarang - singgah.skemaPada > SINGGAH_SKEMA_MS) void ukurSkemaAletaBot().catch(() => undefined);

  /* === 12OKT-J: CPU diukur serentak (selisih dua cuplikan; panggilan pertama menunggu 1 dtk) === */
  const [meminfoTeks, nd, gpu, docker, cpuServer, cpuBotSendiri] = await Promise.all([
    bacaTeks("/proc/meminfo"),
    bacaNetdata(),
    bacaGpu(),
    bacaCuplikanDocker(),
    cpuSvc.ukurCpuServer(),
    cpuSvc.ukurCpuContainerSendiri(),
  ]);
  /* === AKHIR 12OKT-J === */
  const memori = uraiMeminfo(meminfoTeks);
  if (!memori) catatan.push("RAM server tidak terbaca (/proc/meminfo).");

  let rincian;
  let partisi = [];
  const sumber = { ramServer: "/proc/meminfo", rincian: "", disk: "", gpu: "/sys/class/drm" };
  if (nd.ok) {
    rincian = susunRincianNetdata(nd.grafik);
    partisi = partisiNetdata(nd.grafik);
    sumber.rincian = "netdata (cgroup host)";
    sumber.disk = "netdata disk_space";
    /* === 12OKT-J: CPU per container dan layanan === */
    await cpuSvc.terapkanCpuNetdata(rincian, nd.grafik, cpuServer.inti, ALAMAT_NETDATA);
    sumber.cpuRincian = `netdata cgroup_*.cpu / systemd_*.cpu (rata-rata ${cpuSvc.JENDELA_NETDATA_DETIK} dtk)`;
    /* === AKHIR 12OKT-J === */
  } else {
    rincian = await bacaRincianCadangan();
    sumber.rincian = "cgroup container bot saja";
    /* === 12OKT-J === */
    cpuSvc.terapkanCpuContainerSendiri(rincian.aleta[0], cpuBotSendiri, cpuServer.inti);
    sumber.cpuRincian = "cgroup container bot saja (cpuacct v1 / cpu.stat v2, selisih dua cuplikan)";
    /* === AKHIR 12OKT-J === */
    catatan.push(`Rincian per container dan layanan butuh netdata di host - ${nd.alasan}. Yang terukur hanya container bot.`);
  }
  if (!partisi.length) {
    partisi = await bacaPartisiStatfs();
    sumber.disk = "statfs (/proc/self/mountinfo)";
  }
  if (!docker) catatan.push("Citra dan build cache Docker belum terukur: jalankan scripts/aleta-sumber-daya-docker.sh di host (bot tidak memegang soket Docker).");

  const diskAleta = susunDiskAleta({ docker, folder: singgah.folder, skema: singgah.skema });
  /* === 12OKT-J === */
  sumber.cpuServer = cpuServer.persen === null ? "tidak terbaca (/proc/stat)" : `/proc/stat (selisih dua cuplikan, ${cpuServer.jendelaDetik} dtk)`;
  if (cpuServer.persen === null) catatan.push("CPU server tidak terbaca: /proc/stat tidak ada atau penghitungnya tidak maju.");
  const ringkas = hitungRingkas({ memori, rincian, partisi, diskAleta, gpu, cpu: cpuServer, cpuSebagian: !nd.ok });
  /* === AKHIR 12OKT-J === */
  const ramDikenal = [...rincian.aleta, ...rincian.lain].reduce((s, b) => s + (b.ramByte || 0), 0);
  return {
    ok: true,
    diukurPada: new Date().toISOString(),
    ambang: AMBANG,
    sumber,
    ringkas,
    rincian: {
      memori,
      aleta: rincian.aleta,
      lain: rincian.lain,
      // Sisa memori terpakai yang tidak tercatat di layanan mana pun:
      // kernel, slab, sesi pengguna, proses di luar unit systemd.
      ramLainnyaByte: memori && nd.ok ? Math.max(0, memori.terpakaiByte - ramDikenal) : null,
      partisi: partisi.map((p) => {
        const pr = persen(p.terpakaiByte, p.totalByte);
        return { ...p, persen: pr, warna: warnaAmbang(pr, AMBANG.disk) };
      }),
      diskAleta,
      docker: docker ? { dibuat: docker.dibuat } : null,
      folderDiukurPada: singgah.folder ? singgah.folder.diukurPada : null,
      gpu,
      cpu: { inti: cpuServer.inti, beban: cpuServer.beban, jendelaDetik: cpuServer.jendelaDetik }, // 12OKT-J
    },
    catatan,
  };
}

/** Ringkasan bersinggah (3 dtk) - permintaan serentak berbagi satu pengukuran. */
async function bacaSumberDaya({ paksa = false } = {}) {
  if (!paksa && singgah.ringkas && Date.now() - singgah.ringkasPada < SINGGAH_RINGKAS_MS) return singgah.ringkas;
  if (singgah.ringkasJalan) return singgah.ringkasJalan;
  singgah.ringkasJalan = kumpulkan()
    .then((h) => {
      singgah.ringkas = h;
      singgah.ringkasPada = Date.now();
      return h;
    })
    .finally(() => {
      singgah.ringkasJalan = null;
    });
  return singgah.ringkasJalan;
}

module.exports = {
  AMBANG,
  NAMA_LAYANAN,
  warnaAmbang,
  persen,
  uraiMeminfo,
  uraiMemoryStat,
  uraiMountinfo,
  labelPerangkat,
  partisiDariMountinfo,
  uraiNetdata,
  keByte,
  uraiUkuranDocker,
  uraiDockerDf,
  uraiNvidiaSmi,
  nilaiGpu,
  susunRincianNetdata,
  partisiNetdata,
  partisiPenentu,
  hitungRingkas,
  susunDiskAleta,
  bacaSumberDaya,
};
