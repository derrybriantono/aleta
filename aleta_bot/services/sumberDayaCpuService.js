"use strict";

/**
 * ============================================================================
 * PEMANTAU SUMBER DAYA - CPU (permintaan 12 Okt 2026, butir 20)
 * ============================================================================
 *
 * Pelengkap sumberDayaService.js (RAM, disk, GPU). Berkas sendiri supaya
 * pengurai dan pembacanya dapat diuji tanpa menyentuh sisanya.
 *
 * ATURAN UTAMA: pemakaian CPU adalah LAJU - selisih penghitung antara dua
 * cuplikan dibagi selisih waktu. Satu angka sesaat (mis. nilai terakhir
 * netdata, atau "load" detik ini) menyesatkan: lonjakan satu detik tampak
 * seperti beban terus-menerus. Maka:
 *
 *   CPU seluruh server   /proc/stat dibaca dua kali; yang dihitung adalah
 *                        (1 - selisih idle / selisih total) di antaranya.
 *                        Di container tanpa lxcfs /proc/stat milik HOST
 *                        (sama dengan /proc/meminfo) - jumlah inti pun dari
 *                        sana. Cuplikan dasar disimpan antar-panggilan
 *                        (layar berdetak tiap 5 dtk -> jendela 3-5 dtk).
 *                        Panggilan pertama (atau sesudah > 30 dtk tak ada
 *                        yang bertanya) menunggu 1 dtk untuk cuplikan kedua,
 *                        tidak pernah mengarang angka dari satu cuplikan.
 *   Beban rata-rata      /proc/loadavg (1/5/15 menit), milik host juga.
 *   CPU per container    netdata di host (bot tidak melihat cgroup container
 *   dan layanan host     lain): grafik cgroup_<nama>.cpu dan
 *                        systemd_<layanan>.cpu, 100% = SATU inti. Yang dipakai
 *                        rata-rata 15 dtk dari /api/v1/data (netdata sendiri
 *                        yang menghitung selisih penghitung cgroup); bila
 *                        ditolak, nilai terakhir allmetrics (sesaat) dan
 *                        butirnya ditandai.
 *   Tanpa netdata        hanya container bot sendiri: penghitung cgroup
 *                        v1 (cpuacct.usage, nanodetik) atau v2 (cpu.stat
 *                        usage_usec), selisih dua cuplikan. Tidak terbaca =
 *                        null ("tidak terbaca"), BUKAN 0%.
 *
 * Seluruh berkas ini hanya MEMBACA.
 */

const fs = require("fs");
const os = require("os");

/** Ambang warna (persen dari seluruh kapasitas CPU server). */
const AMBANG_CPU = Object.freeze({ kuning: 70, merah: 90 });

const JENDELA_NETDATA_DETIK = 15;
const SAMPEL_MIN_MS = 500;
const SAMPEL_BASI_MS = 30 * 1000;
const JEDA_AWAL_MS = 1000;
const BATAS_TUNGGU_NETDATA_MS = 2500;

const BERKAS_CGROUP_CPU = Object.freeze([
  "/sys/fs/cgroup/cpu.stat", // v2 (usage_usec)
  "/sys/fs/cgroup/cpuacct/cpuacct.usage", // v1
  "/sys/fs/cgroup/cpu,cpuacct/cpuacct.usage", // v1, hierarki gabungan
  "/sys/fs/cgroup/cpu/cpuacct.usage", // v1, hierarki gabungan (nama lain)
]);

// ─── Pengurai murni (diuji) ──────────────────────────────────────────────────

function angka(x) {
  if (x === null || x === undefined || (typeof x === "string" && !x.trim())) return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function bulat1(x) {
  return Math.round(x * 10) / 10;
}

function bulat2(x) {
  return Math.round(x * 100) / 100;
}

/** "hijau" | "kuning" | "merah" | "kelabu" - sama dengan warnaAmbang di sumberDayaService. */
function warnaCpu(persen) {
  const p = angka(persen);
  if (p === null) return "kelabu";
  if (p >= AMBANG_CPU.merah) return "merah";
  if (p >= AMBANG_CPU.kuning) return "kuning";
  return "hijau";
}

/**
 * /proc/stat -> { jumlah, diam, inti } dalam jiffies.
 *   jumlah = user+nice+system+idle+iowait+irq+softirq+steal (guest sudah ada di user)
 *   diam   = idle+iowait
 *   inti   = jumlah baris cpuN (null bila tidak ada)
 * null bila baris "cpu " gabungan tidak ada atau rusak.
 */
function uraiProcStat(teks) {
  let gabungan = null;
  let inti = 0;
  for (const baris of String(teks || "").split(/\r?\n/)) {
    if (/^cpu\d+\s/.test(baris)) {
      inti += 1;
      continue;
    }
    const m = /^cpu\s+(.+)$/.exec(baris);
    if (!m) continue;
    const f = m[1].trim().split(/\s+/).map(Number);
    if (f.length < 4 || f.some((v) => !Number.isFinite(v) || v < 0)) continue;
    const [user, nice, system, idle, iowait = 0, irq = 0, softirq = 0, steal = 0] = f;
    gabungan = { jumlah: user + nice + system + idle + iowait + irq + softirq + steal, diam: idle + iowait };
  }
  return gabungan ? { ...gabungan, inti: inti || null } : null;
}

/**
 * Persen sibuk (0-100, satu desimal) di antara dua cuplikan /proc/stat.
 * null bila penghitung tidak maju (selisih <= 0) atau mundur (mesin dinyalakan
 * ulang di antara dua cuplikan).
 */
function persenAntarCuplikan(awal, akhir) {
  if (!awal || !akhir) return null;
  const dj = akhir.jumlah - awal.jumlah;
  const dd = akhir.diam - awal.diam;
  if (!(dj > 0) || dd < 0 || dd > dj) return null;
  return bulat1(Math.min(100, Math.max(0, (1 - dd / dj) * 100)));
}

/** /proc/loadavg -> { m1, m5, m15 }; null bila tidak terbaca. */
function uraiLoadavg(teks) {
  const m = /^\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(String(teks || ""));
  if (!m) return null;
  const [m1, m5, m15] = [m[1], m[2], m[3]].map(Number);
  if (![m1, m5, m15].every(Number.isFinite)) return null;
  return { m1, m5, m15 };
}

/**
 * Penghitung CPU cgroup -> nanodetik kumulatif.
 *   v1: cpuacct.usage = satu bilangan bulat (ns)
 *   v2: cpu.stat memuat "usage_usec N" (mikrodetik)
 * cpu.stat v1 (nr_periods, throttled_time, ...) TIDAK memuat usage_usec, jadi
 * tidak salah dibaca sebagai penghitung. null bila tidak dikenal.
 */
function uraiCpuUsageNs(teks) {
  const s = String(teks || "");
  const v2 = /^usage_usec\s+(\d+)\s*$/m.exec(s);
  if (v2) return Number(v2[1]) * 1000;
  const v1 = /^\s*(\d+)\s*$/.exec(s);
  return v1 ? Number(v1[1]) : null;
}

/** Inti yang dipakai (mis. 0,35) dari selisih penghitung ns dan selisih waktu ms. null bila tidak masuk akal. */
function intiDariNs(awalNs, akhirNs, awalMs, akhirMs) {
  const dns = akhirNs - awalNs;
  const dms = akhirMs - awalMs;
  if (!(dms > 0) || dns < 0 || !Number.isFinite(dns)) return null;
  return bulat2(dns / (dms * 1e6));
}

/**
 * Dimensi satu grafik CPU netdata -> inti yang dipakai (100% = satu inti ->
 * dibagi 100). Yang dijumlahkan "user" dan "system"; bila grafiknya memakai
 * nama dimensi lain, semuanya dijumlahkan. null bila tidak ada dimensi.
 */
function jumlahDimensiCpu(dimensi) {
  const entri = Object.entries(dimensi || {}).filter(([, v]) => angka(v) !== null);
  if (!entri.length) return null;
  const inti = entri.filter(([k]) => /^(user|system)$/i.test(k));
  const dipakai = inti.length ? inti : entri;
  return dipakai.reduce((s, [, v]) => s + Number(v), 0) / 100;
}

/**
 * Jawaban /api/v1/data?chart=..&points=1&group=average -> inti rata-rata.
 * Menerima bentuk polos {labels, data} dan bentuk jsonwrap {result:{labels,data}}.
 */
function uraiDataGrafikNetdata(json) {
  if (!json || typeof json !== "object") return null;
  const isi = json.result && typeof json.result === "object" && !Array.isArray(json.result) ? json.result : json;
  const label = Array.isArray(isi.labels) ? isi.labels : null;
  const baris = Array.isArray(isi.data) && Array.isArray(isi.data[0]) ? isi.data[0] : null;
  if (!label || !baris) return null;
  const dimensi = {};
  label.forEach((l, i) => {
    if (i === 0 || String(l) === "time") return;
    const v = angka(baris[i]);
    if (v !== null) dimensi[String(l)] = v;
  });
  return jumlahDimensiCpu(dimensi);
}

/** Nama grafik CPU netdata untuk satu butir (container -> cgroup_, layanan -> systemd_). */
function namaGrafikCpu(butir) {
  return `${butir.jenis === "container" ? "cgroup" : "systemd"}_${butir.kunci}.cpu`;
}

/** Nilai TERAKHIR (sesaat) grafik CPU dari hasil uraiNetdata. null bila grafiknya tidak ada. */
function intiSesaatDariGrafik(grafik, nama) {
  const g = grafik && grafik[nama];
  return g && g.dimensi ? jumlahDimensiCpu(g.dimensi) : null;
}

/**
 * Menempelkan cpuInti / cpuPersen / cpuSumber ke tiap butir rincian.
 *   rata:  Map nama grafik -> inti rata-rata (dari /api/v1/data), boleh kosong
 *   inti:  jumlah inti server (null -> cpuPersen null)
 * Yang tidak punya grafik: cpuInti null (tidak terbaca), bukan 0.
 */
function terapkanCpuKeButir(rincian, grafik, rata, inti) {
  for (const butir of [...((rincian && rincian.aleta) || []), ...((rincian && rincian.lain) || [])]) {
    const nama = namaGrafikCpu(butir);
    let nilai = rata && rata.get ? rata.get(nama) : undefined;
    let sumber = "rata-rata";
    if (nilai === undefined || nilai === null) {
      nilai = intiSesaatDariGrafik(grafik, nama);
      sumber = "sesaat";
    }
    if (nilai === null || nilai === undefined) {
      butir.cpuInti = null;
      butir.cpuPersen = null;
      butir.cpuSumber = null;
      continue;
    }
    butir.cpuInti = bulat2(nilai);
    butir.cpuPersen = inti > 0 ? bulat1(Math.min(100, (nilai / inti) * 100)) : null;
    butir.cpuSumber = sumber;
  }
  return rincian;
}

/**
 * Keping CPU untuk ringkasan dua sudut pandang.
 *   cpu:           { persen, inti, beban, jendelaDetik } seluruh server (dari ukurCpuServer)
 *   rincianAleta:  butir ALETA yang sudah ber-cpuInti (atau null)
 *   aletaSebagian: true bila hanya sebagian ALETA yang terukur (tanpa netdata)
 * ALETA = jumlah inti butir ALETA / inti server. Tanpa satu pun butir ber-cpuInti: null.
 */
function susunKepingCpu({ cpu, rincianAleta, aletaSebagian }) {
  const inti = cpu && cpu.inti > 0 ? cpu.inti : null;
  const persenServer = cpu && angka(cpu.persen) !== null ? cpu.persen : null;
  const jendelaDetik = cpu && angka(cpu.jendelaDetik) !== null ? cpu.jendelaDetik : null;
  const terbaca = (rincianAleta || []).filter((b) => Number.isFinite(b.cpuInti));
  const intiAleta = terbaca.length ? terbaca.reduce((s, b) => s + b.cpuInti, 0) : null;
  const persenAleta = intiAleta !== null && inti ? bulat1(Math.min(100, (intiAleta / inti) * 100)) : null;
  return {
    server: {
      persen: persenServer,
      warna: warnaCpu(persenServer),
      inti,
      intiTerpakai: persenServer !== null && inti ? bulat2((persenServer / 100) * inti) : null,
      beban: cpu && cpu.beban ? cpu.beban : null,
      jendelaDetik,
    },
    aleta: {
      persen: persenAleta,
      warna: warnaCpu(persenAleta),
      inti,
      intiTerpakai: intiAleta !== null ? bulat2(intiAleta) : null,
      beban: null,
      jendelaDetik,
      sebagian: Boolean(aletaSebagian),
    },
  };
}

// ─── Cuplikan antar-panggilan ────────────────────────────────────────────────

const status = new Map();

function tidur(ms) {
  return new Promise((selesai) => setTimeout(selesai, ms));
}

/**
 * Dua cuplikan { t (ms), ... } untuk dihitung selisihnya.
 *   - cuplikan sebelumnya 0,5-30 dtk lalu: dipakai sebagai dasar, cuplikan baru
 *     menjadi dasar berikutnya;
 *   - lebih baru dari 0,5 dtk: pasangan terakhir dipakai ulang (jendela terlalu
 *     pendek untuk bermakna);
 *   - tidak ada / terlalu tua: tunggu 1 dtk lalu cuplik lagi.
 * baca() -> { t, ... } | null.
 */
async function pasanganCuplikan(kunci, baca, { tunggu = tidur } = {}) {
  const sekarang = await baca();
  if (!sekarang) return null;
  const s = status.get(kunci);
  const umur = s ? sekarang.t - s.cuplikan.t : Infinity;
  if (s && umur >= SAMPEL_MIN_MS && umur <= SAMPEL_BASI_MS) {
    const pasangan = { awal: s.cuplikan, akhir: sekarang };
    status.set(kunci, { cuplikan: sekarang, pasangan });
    return pasangan;
  }
  if (s && umur >= 0 && umur < SAMPEL_MIN_MS && s.pasangan) return s.pasangan;
  await tunggu(JEDA_AWAL_MS);
  const akhir = await baca();
  if (!akhir) return null;
  const pasangan = { awal: sekarang, akhir };
  status.set(kunci, { cuplikan: akhir, pasangan });
  return pasangan;
}

/** Hanya untuk uji. */
function kosongkanCuplikanCpu() {
  status.clear();
}

// ─── Pembaca (menyentuh berkas / jaringan) ──────────────────────────────────

async function bacaTeks(berkas) {
  try {
    return await fs.promises.readFile(berkas, "utf8");
  } catch {
    return null;
  }
}

async function bacaProcStat() {
  const u = uraiProcStat(await bacaTeks("/proc/stat"));
  return u ? { t: Date.now(), ...u } : null;
}

async function bacaCgroupSendiri() {
  for (const berkas of BERKAS_CGROUP_CPU) {
    const ns = uraiCpuUsageNs(await bacaTeks(berkas));
    if (ns !== null) return { t: Date.now(), ns };
  }
  return null;
}

/**
 * CPU seluruh server: { persen, inti, beban, jendelaDetik }. Selalu mengembalikan
 * objek; persen null bila /proc/stat tidak terbaca atau tidak maju.
 */
async function ukurCpuServer(opsi) {
  const p = await pasanganCuplikan("server", bacaProcStat, opsi);
  const intiBaca = (p && p.akhir.inti) || (Array.isArray(os.cpus()) && os.cpus().length) || null;
  const beban = uraiLoadavg(await bacaTeks("/proc/loadavg"));
  if (!p) return { persen: null, inti: intiBaca, beban, jendelaDetik: null };
  return {
    persen: persenAntarCuplikan(p.awal, p.akhir),
    inti: intiBaca,
    beban,
    jendelaDetik: Math.max(1, Math.round((p.akhir.t - p.awal.t) / 1000)),
  };
}

/** Inti yang dipakai container bot sendiri (cgroup v1/v2); null bila tidak terbaca. */
async function ukurCpuContainerSendiri(opsi) {
  const p = await pasanganCuplikan("container-sendiri", bacaCgroupSendiri, opsi);
  return p ? intiDariNs(p.awal.ns, p.akhir.ns, p.awal.t, p.akhir.t) : null;
}

/** Rata-rata 15 dtk satu grafik CPU netdata (inti). null bila ditolak / tanpa data. */
async function bacaRataGrafikNetdata(alamat, nama, detik = JENDELA_NETDATA_DETIK) {
  const pengendali = new AbortController();
  const tunda = setTimeout(() => pengendali.abort(), BATAS_TUNGGU_NETDATA_MS);
  try {
    const url = `${alamat}/api/v1/data?chart=${encodeURIComponent(nama)}&after=-${detik}&points=1&group=average&format=json`;
    const r = await fetch(url, { signal: pengendali.signal });
    if (!r.ok) return null;
    return uraiDataGrafikNetdata(await r.json());
  } catch {
    return null;
  } finally {
    clearTimeout(tunda);
  }
}

/**
 * Menempelkan CPU netdata ke rincian: rata-rata 15 dtk per grafik (paralel),
 * dengan nilai sesaat allmetrics sebagai cadangan per butir.
 */
async function terapkanCpuNetdata(rincian, grafik, inti, alamat) {
  const semua = [...((rincian && rincian.aleta) || []), ...((rincian && rincian.lain) || [])];
  const rata = new Map();
  await Promise.all(
    semua.map(async (b) => {
      const nama = namaGrafikCpu(b);
      // Grafik yang tidak ada di allmetrics (cpuacct tidak aktif) tidak ditanyakan.
      if (!grafik || !grafik[nama]) return;
      const v = await bacaRataGrafikNetdata(alamat, nama);
      if (v !== null) rata.set(nama, v);
    })
  );
  return terapkanCpuKeButir(rincian, grafik, rata, inti);
}

/** Tanpa netdata: CPU container bot sendiri ditempelkan ke butir aleta-bot. */
function terapkanCpuContainerSendiri(butir, intiDipakai, inti) {
  if (!butir) return;
  if (intiDipakai === null || intiDipakai === undefined) {
    butir.cpuInti = null;
    butir.cpuPersen = null;
    butir.cpuSumber = null;
    return;
  }
  butir.cpuInti = intiDipakai;
  butir.cpuPersen = inti > 0 ? bulat1(Math.min(100, (intiDipakai / inti) * 100)) : null;
  butir.cpuSumber = "cgroup";
}

module.exports = {
  AMBANG_CPU,
  JENDELA_NETDATA_DETIK,
  warnaCpu,
  uraiProcStat,
  persenAntarCuplikan,
  uraiLoadavg,
  uraiCpuUsageNs,
  intiDariNs,
  jumlahDimensiCpu,
  uraiDataGrafikNetdata,
  namaGrafikCpu,
  intiSesaatDariGrafik,
  terapkanCpuKeButir,
  susunKepingCpu,
  pasanganCuplikan,
  kosongkanCuplikanCpu,
  ukurCpuServer,
  ukurCpuContainerSendiri,
  terapkanCpuNetdata,
  terapkanCpuContainerSendiri,
};
