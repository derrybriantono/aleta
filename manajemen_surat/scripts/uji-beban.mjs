#!/usr/bin/env node
/**
 * UJI BEBAN ALETA (K9, 25 Okt 2026) - meniru 100/200 perangkat yang membuka
 * Jadwal Sidang, widget di halaman SIPP, konteks SIPP, dan Status Perkara.
 *
 * ============================================================================
 * HANYA KE KEMBARAN LAPTOP
 * ============================================================================
 *
 * Skrip ini MENOLAK berjalan ke selain alamat loopback (localhost, 127.0.0.0/8,
 * [::1], *.localhost yang benar-benar menunjuk ke loopback). Server kantor
 * (192.168.10.10) dan alamat produksi lain ditolak sebelum satu permintaan pun
 * dikirim. Tidak ada tanda untuk melonggarkannya, sengaja: uji beban ke server
 * yang dipakai pegawai bisa melumpuhkan SIPP. Pengalihan (3xx) tidak diikuti.
 *
 * Pemakaian (dari manajemen_surat/):
 *
 *   ALETA_UJI_KUKI="<kuki sesi super admin kembaran>" \
 *     node scripts/uji-beban.mjs --sasaran http://localhost:3000/aleta \
 *       --perangkat 100 --durasi 120
 *
 *   atau masuk sendiri: ALETA_UJI_EMAIL dan ALETA_UJI_SANDI (akun kembaran),
 *   tambahkan --masuk. Kuki dan sandi hanya dibaca dari lingkungan, tidak
 *   pernah ditulis ke hasil, layar, atau repo.
 *
 * Pilihan: --perangkat 100[,200]  --durasi <detik>  --pemanasan <detik>
 *          --profil campuran|jadwal|widget  --keluaran <folder>
 *          --nomor <nomor perkara rekaan>  --kata-cari <kata>  --benih <angka>
 *          --skala-waktu <0..1> (hanya untuk uji skrip: memendekkan selang)
 *
 * Ukuran opsional dari MySQL kembaran (kueri SIPP/menit, sambungan terpakai):
 *   ALETA_UJI_SIPP_HOST (loopback saja), ALETA_UJI_SIPP_PORT,
 *   ALETA_UJI_SIPP_USER, ALETA_UJI_SIPP_SANDI, ALETA_UJI_SIPP_DB.
 *
 * Hasil: berkas JSON + ringkasan teks di folder keluaran (bawaan:
 * D:\Aplikasi\aleta\tmp\uji-beban). Berkas JSON itu dapat diimpor di
 * Admin > Pusat kesehatan. Tidak ada data perkara asli: nomor perkara dan kata
 * cari bawaan rekaan.
 */
import dns from "node:dns/promises";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SKRIP = fileURLToPath(import.meta.url);
const FOLDER_SKRIP = path.dirname(SKRIP);

export const VERSI_HASIL = 1;

/** Selang tiap jenis permintaan (ms) - sama dengan yang dipakai layar sungguhan. */
export const SELANG_MS = Object.freeze({
  jadwalPenuh: 45_000, // JEDA_MUAT_ULANG_MS di aleta-ecourt-sidang.tsx
  jadwalRingan: 8_000, // SELANG_RINGAN_HARI_INI_MS di lib/jadwal-ringan.ts
  disidang: 5_000, // SELANG_DISIDANG_MS di lib/disidang-langsung.ts
  widget: 15_000, // denyut widget (disidang 15 dtk, kehadiran 60 dtk)
  konteks: 30_000, // membuka/menyegarkan halaman perkara SIPP
  statusPerkara: 60_000, // pencarian/klik tag di Status Perkara
});

export const PROFIL = Object.freeze({
  /** Campuran wajar: semua perangkat membawa widget; sebagian membuka layar. */
  campuran: { jadwal: 0.4, konteks: 0.3, statusPerkara: 0.15, widget: 1 },
  /** Terburuk yang dikhawatirkan: setiap perangkat membuka layar Jadwal Sidang. */
  jadwal: { jadwal: 1, konteks: 0, statusPerkara: 0, widget: 1 },
  /** Hanya widget di halaman SIPP/ABT. */
  widget: { jadwal: 0, konteks: 0, statusPerkara: 0, widget: 1 },
});

// ---------------------------------------------------------------------------
// Penjaga sasaran: hanya loopback.
// ---------------------------------------------------------------------------

export class SasaranDitolak extends Error {
  constructor(pesan) {
    super(pesan);
    this.name = "SasaranDitolak";
  }
}

function loopbackIPv4(teks) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(teks);
  if (!m) return false;
  const bagian = m.slice(1).map(Number);
  if (bagian.some((n) => n > 255)) return false;
  return bagian[0] === 127;
}

/** true bila alamat IP hasil resolusi adalah loopback (127.0.0.0/8, ::1, ::ffff:127.x). */
export function alamatLoopback(alamat) {
  const a = String(alamat || "").trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (loopbackIPv4(a)) return true;
  if (a === "::1") return true;
  const dipetakan = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(a);
  return dipetakan ? loopbackIPv4(dipetakan[1]) : false;
}

/**
 * Memeriksa teks alamat sasaran SEBELUM ada permintaan. Mengembalikan
 * { url, asal, awalan, host }; melempar SasaranDitolak bila bukan loopback.
 * `awalan` = jalur dasar portal (mis. /aleta) tanpa garis miring penutup.
 */
export function periksaSasaran(teks) {
  let url;
  try {
    url = new URL(String(teks || "").trim());
  } catch {
    throw new SasaranDitolak(`Alamat sasaran tidak sah: "${String(teks || "").slice(0, 80)}".`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SasaranDitolak("Sasaran harus http:// atau https://.");
  }
  if (url.username || url.password) {
    throw new SasaranDitolak("Sasaran tidak boleh memuat nama pengguna atau sandi di alamat.");
  }
  const host = url.hostname.toLowerCase();
  const namaLokal = host === "localhost" || host.endsWith(".localhost");
  const ip = loopbackIPv4(host) || alamatLoopback(host);
  if (!namaLokal && !ip) {
    throw new SasaranDitolak(
      `Uji beban ditolak: "${host}" bukan kembaran laptop. Skrip ini hanya berjalan ke localhost/127.0.0.1/[::1]; ` +
        "server kantor (192.168.10.10) dan alamat produksi lain tidak pernah boleh diuji beban."
    );
  }
  const awalan = url.pathname.replace(/\/+$/, "");
  return { url, asal: url.origin, awalan, host, perluResolusi: namaLokal };
}

/**
 * Nama lokal ("localhost", "x.localhost") dapat dibelokkan oleh DNS/berkas hosts.
 * Semua alamat hasil resolusinya wajib loopback.
 */
export async function pastikanResolusiLoopback(host, cari = (h) => dns.lookup(h, { all: true })) {
  let hasil;
  try {
    hasil = await cari(host);
  } catch (galat) {
    throw new SasaranDitolak(`Nama "${host}" tidak dapat diresolusi (${galat?.code || galat?.message || "galat"}).`);
  }
  const daftar = Array.isArray(hasil) ? hasil : [hasil];
  if (!daftar.length || !daftar.every((h) => alamatLoopback(h?.address ?? h))) {
    throw new SasaranDitolak(`Uji beban ditolak: "${host}" tidak menunjuk ke loopback.`);
  }
}

// ---------------------------------------------------------------------------
// Statistik
// ---------------------------------------------------------------------------

/** Persentil nearest-rank (p dalam 0..100) dari larik angka. Kosong -> 0. */
export function persentil(nilai, p) {
  if (!nilai.length) return 0;
  const urut = [...nilai].sort((a, b) => a - b);
  const peringkat = Math.min(urut.length, Math.max(1, Math.ceil((p / 100) * urut.length)));
  return urut[peringkat - 1];
}

export function ringkasLatensi(nilai) {
  const bulat = (n) => Math.round(n * 10) / 10;
  return {
    p50: bulat(persentil(nilai, 50)),
    p95: bulat(persentil(nilai, 95)),
    p99: bulat(persentil(nilai, 99)),
    maks: bulat(nilai.length ? Math.max(...nilai) : 0),
  };
}

/** Kueri/menit dari dua bacaan Questions; `sampelSendiri` = kueri pengukur itu sendiri. */
export function hitungKueriPerMenit(awal, akhir, durasiDetik, sampelSendiri = 0) {
  if (!(durasiDetik > 0)) return 0;
  const selisih = Math.max(0, Number(akhir) - Number(awal) - sampelSendiri);
  return Math.round((selisih / durasiDetik) * 60);
}

function mulberry32(benih) {
  let a = benih >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Menyusun perangkat tiruan: daftar jenis permintaan yang dijalankan tiap
 * perangkat, deterministik menurut `benih`.
 */
export function susunPerangkat(jumlah, profil = "campuran", benih = 1) {
  const bobot = PROFIL[profil];
  if (!bobot) throw new Error(`Profil tidak dikenal: ${profil}. Pilihan: ${Object.keys(PROFIL).join(", ")}.`);
  const acak = mulberry32(benih);
  const perangkat = [];
  for (let i = 0; i < jumlah; i += 1) {
    const jenis = [];
    if (acak() < bobot.jadwal) jenis.push("jadwalPenuh", "jadwalRingan", "disidang");
    if (acak() < bobot.widget) jenis.push("widget");
    if (acak() < bobot.konteks) jenis.push("konteks");
    if (acak() < bobot.statusPerkara) jenis.push("statusPerkara");
    // Perangkat tanpa kegiatan tidak berguna diukur: setidaknya widget.
    if (!jenis.length) jenis.push("widget");
    perangkat.push({ nomor: i + 1, jenis });
  }
  return perangkat;
}

function tanggalLokal(d = new Date()) {
  const dua = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())}`;
}

/** Jalur (tanpa awalan portal) tiap jenis permintaan. */
export function jalurPermintaan(jenis, ctx) {
  const tgl = ctx.tanggal || tanggalLokal();
  switch (jenis) {
    case "jadwalPenuh":
      return `/api/aleta-ecourt/sidang?${new URLSearchParams({ dari: tgl, sampai: tgl, cari: "", kesiapan: "1" })}`;
    case "jadwalRingan":
      return `/api/aleta-ecourt/sidang/ringan?${new URLSearchParams({ dari: tgl, sampai: tgl })}`;
    case "disidang":
      return "/api/aleta-ecourt/sidang/disidang";
    case "widget":
      return "/api/aleta-ecourt/denyut?bagian=sumberDaya,kehadiran,checklist,disidang";
    case "konteks":
      return `/api/aleta-bot/sipp-konteks?${new URLSearchParams({ nomor: ctx.nomor })}`;
    case "statusPerkara":
      return `/api/aleta-ecourt/status-perkara?${new URLSearchParams({ cari: ctx.kataCari })}`;
    default:
      throw new Error(`Jenis permintaan tidak dikenal: ${jenis}`);
  }
}

// ---------------------------------------------------------------------------
// Pengumpul hasil
// ---------------------------------------------------------------------------

export function buatPengumpul() {
  const rute = new Map();
  return {
    catat(jenis, ms, status, ketGalat) {
      let r = rute.get(jenis);
      if (!r) {
        r = { jumlah: 0, galat: 0, botTakTerjangkau: 0, latensi: [], status: {}, galatContoh: {} };
        rute.set(jenis, r);
      }
      r.jumlah += 1;
      r.latensi.push(ms);
      r.status[status] = (r.status[status] || 0) + 1;
      if (ketGalat) {
        if (ketGalat === "bot_tidak_terjangkau") r.botTakTerjangkau += 1;
        else r.galat += 1;
        r.galatContoh[ketGalat] = (r.galatContoh[ketGalat] || 0) + 1;
      }
    },
    ringkas(durasiDetik) {
      const hasil = {};
      const semua = [];
      let jumlah = 0;
      let galat = 0;
      let bot = 0;
      for (const [jenis, r] of rute) {
        hasil[jenis] = {
          jumlah: r.jumlah,
          galat: r.galat,
          botTakTerjangkau: r.botTakTerjangkau,
          ...ringkasLatensi(r.latensi),
          status: r.status,
          galatContoh: r.galatContoh,
        };
        semua.push(...r.latensi);
        jumlah += r.jumlah;
        galat += r.galat;
        bot += r.botTakTerjangkau;
      }
      return {
        rute: hasil,
        total: {
          permintaan: jumlah,
          permintaanPerDetik: durasiDetik > 0 ? Math.round((jumlah / durasiDetik) * 10) / 10 : 0,
          galat,
          botTakTerjangkau: bot,
          persenGalat: jumlah ? Math.round((galat / jumlah) * 1000) / 10 : 0,
          ...ringkasLatensi(semua),
        },
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Pengukur sumber daya (laptop) dan MySQL kembaran (opsional)
// ---------------------------------------------------------------------------

function bacaCpu() {
  let idle = 0;
  let total = 0;
  for (const c of os.cpus()) {
    for (const n of Object.values(c.times)) total += n;
    idle += c.times.idle;
  }
  return { idle, total };
}

export function mulaiPengukurSumberDaya(selangMs = 2000) {
  const sampel = [];
  let sebelum = bacaCpu();
  let cpuProsesSebelum = process.cpuUsage();
  let waktuSebelum = process.hrtime.bigint();
  const ambil = () => {
    const kini = bacaCpu();
    const dTotal = kini.total - sebelum.total;
    const dIdle = kini.idle - sebelum.idle;
    const cpuMesin = dTotal > 0 ? ((dTotal - dIdle) / dTotal) * 100 : 0;
    sebelum = kini;
    const cpuP = process.cpuUsage(cpuProsesSebelum);
    const dt = Number(process.hrtime.bigint() - waktuSebelum) / 1000; // mikrodetik
    const cpuPenguji = dt > 0 ? ((cpuP.user + cpuP.system) / dt / os.cpus().length) * 100 : 0;
    cpuProsesSebelum = process.cpuUsage();
    waktuSebelum = process.hrtime.bigint();
    sampel.push({
      cpuMesin,
      cpuPenguji,
      ramMesinPersen: (1 - os.freemem() / os.totalmem()) * 100,
      ramPengujiMB: process.memoryUsage().rss / 1048576,
    });
  };
  const jam = setInterval(ambil, selangMs);
  jam.unref?.();
  return {
    berhenti() {
      clearInterval(jam);
      ambil();
      const rata = (k) => (sampel.length ? sampel.reduce((s, x) => s + x[k], 0) / sampel.length : 0);
      const maks = (k) => (sampel.length ? Math.max(...sampel.map((x) => x[k])) : 0);
      const b = (n) => Math.round(n * 10) / 10;
      return {
        inti: os.cpus().length,
        ramTotalGB: Math.round((os.totalmem() / 1073741824) * 10) / 10,
        cpuMesinRata: b(rata("cpuMesin")),
        cpuMesinMaks: b(maks("cpuMesin")),
        cpuPengujiRata: b(rata("cpuPenguji")),
        ramMesinRataPersen: b(rata("ramMesinPersen")),
        ramMesinMaksPersen: b(maks("ramMesinPersen")),
        ramPengujiMaksMB: b(maks("ramPengujiMB")),
        jumlahSampel: sampel.length,
      };
    },
  };
}

/**
 * Pengukur MySQL kembaran. Hanya bila ALETA_UJI_SIPP_HOST diisi DAN loopback.
 * Hanya membaca SHOW GLOBAL STATUS - tidak menulis apa pun.
 */
export async function mulaiPengukurSipp(env, selangMs = 5000, muatMysql) {
  const host = String(env.ALETA_UJI_SIPP_HOST || "").trim();
  if (!host) return { tersedia: false, alasan: "ALETA_UJI_SIPP_HOST tidak diisi", berhenti: async () => ({ tersedia: false, alasan: "ALETA_UJI_SIPP_HOST tidak diisi" }) };
  const kosong = (alasan) => ({ tersedia: false, alasan, berhenti: async () => ({ tersedia: false, alasan }) });
  if (!(host === "localhost" || alamatLoopback(host))) {
    return kosong(`ALETA_UJI_SIPP_HOST "${host}" bukan loopback; pengukuran MySQL dilewati`);
  }
  let mysql;
  try {
    mysql = muatMysql
      ? await muatMysql()
      : createRequire(path.resolve(FOLDER_SKRIP, "../../aleta_bot/package.json"))("mysql2/promise");
  } catch (galat) {
    return kosong(`mysql2 tidak dapat dimuat (${galat?.message || galat})`);
  }
  let sambungan;
  try {
    sambungan = await mysql.createConnection({
      host,
      port: Number(env.ALETA_UJI_SIPP_PORT) || 3306,
      user: env.ALETA_UJI_SIPP_USER || "root",
      password: env.ALETA_UJI_SIPP_SANDI || "",
      database: env.ALETA_UJI_SIPP_DB || undefined,
      connectTimeout: 5000,
    });
  } catch (galat) {
    return kosong(`tidak dapat tersambung ke MySQL kembaran (${galat?.code || galat?.message || galat})`);
  }
  const bacaStatus = async () => {
    const [baris] = await sambungan.query(
      "SHOW GLOBAL STATUS WHERE Variable_name IN ('Questions','Threads_connected','Threads_running','Max_used_connections')"
    );
    const peta = {};
    for (const b of baris) peta[b.Variable_name] = Number(b.Value);
    return peta;
  };
  const mulai = await bacaStatus();
  const waktuMulai = Date.now();
  const terhubung = [mulai.Threads_connected];
  const berjalan = [mulai.Threads_running];
  let sampelSendiri = 1; // pembacaan awal
  let terakhir = mulai;
  const jam = setInterval(async () => {
    try {
      const s = await bacaStatus();
      sampelSendiri += 1;
      terakhir = s;
      terhubung.push(s.Threads_connected);
      berjalan.push(s.Threads_running);
    } catch {
      /* satu sampel hilang tidak membatalkan uji */
    }
  }, selangMs);
  jam.unref?.();
  return {
    tersedia: true,
    async berhenti() {
      clearInterval(jam);
      let akhir = terakhir;
      try {
        akhir = await bacaStatus();
        sampelSendiri += 1;
      } catch {
        /* pakai sampel terakhir */
      }
      try {
        await sambungan.end();
      } catch {
        /* abaikan */
      }
      const durasi = (Date.now() - waktuMulai) / 1000;
      const rata = (a) => (a.length ? Math.round((a.reduce((s, x) => s + x, 0) / a.length) * 10) / 10 : 0);
      return {
        tersedia: true,
        kueriPerMenit: hitungKueriPerMenit(mulai.Questions, akhir.Questions, durasi, sampelSendiri),
        sambunganRata: rata(terhubung),
        sambunganMaks: Math.max(...terhubung, akhir.Threads_connected),
        kueriBerjalanMaks: Math.max(...berjalan, akhir.Threads_running),
        sambunganMaksSejakNyala: akhir.Max_used_connections,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Masuk (opsional) dan permintaan
// ---------------------------------------------------------------------------

/** Masuk ke kembaran dengan akun uji; mengembalikan teks kuki. Sandi tidak dicatat. */
export async function masukKembaran(sasaran, email, sandi, ambil = fetch) {
  const alamat = `${sasaran.asal}${sasaran.awalan}/api/auth/sign-in/email`;
  const jawaban = await ambil(alamat, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/json", origin: sasaran.asal },
    body: JSON.stringify({ email, password: sandi }),
  });
  if (!jawaban.ok) throw new Error(`Masuk ke kembaran gagal (HTTP ${jawaban.status}).`);
  const daftar = typeof jawaban.headers.getSetCookie === "function" ? jawaban.headers.getSetCookie() : [];
  const kuki = daftar.map((c) => c.split(";")[0]).filter(Boolean).join("; ");
  if (!kuki) throw new Error("Masuk berhasil tetapi kembaran tidak mengirim kuki sesi.");
  return kuki;
}

async function kirimSatu({ sasaran, kuki, jenis, ctx, pengumpul, mulaiCatat, batasMs, ambil }) {
  const alamat = `${sasaran.asal}${sasaran.awalan}${jalurPermintaan(jenis, ctx)}`;
  const t0 = performance.now();
  const kendali = new AbortController();
  const pewaktu = setTimeout(() => kendali.abort(), batasMs);
  let status = 0;
  let ketGalat = "";
  try {
    const jawaban = await ambil(alamat, {
      redirect: "manual",
      cache: "no-store",
      signal: kendali.signal,
      headers: { cookie: kuki, "user-agent": "AletaUjiBeban/1", accept: "application/json" },
    });
    status = jawaban.status;
    const badan = await jawaban.text();
    if (status >= 300 && status < 400) ketGalat = `alih_${status}`;
    else if (status >= 400) ketGalat = `http_${status}`;
    else {
      // Rute Jadwal/bot menjawab 200 dengan available:false bila bot tidak terjangkau.
      try {
        const isi = JSON.parse(badan);
        if (isi?.ok === false) ketGalat = "ok_false";
        else if (isi?.data?.available === false) ketGalat = "bot_tidak_terjangkau";
      } catch {
        ketGalat = "bukan_json";
      }
    }
  } catch (galat) {
    status = 0;
    ketGalat = galat?.name === "AbortError" ? "habis_waktu" : `jaringan_${galat?.cause?.code || galat?.code || "galat"}`;
  } finally {
    clearTimeout(pewaktu);
  }
  const ms = performance.now() - t0;
  if (performance.now() >= mulaiCatat) pengumpul.catat(jenis, ms, status, ketGalat);
}

/**
 * Menjalankan satu putaran uji (`perangkat` perangkat tiruan selama `durasiDetik`).
 * Pewaktu diberi jitter awal acak agar tidak serentak. Mengembalikan ringkasan.
 */
export async function jalankanPutaran(opsi) {
  const {
    sasaran,
    kuki,
    perangkat,
    durasiDetik,
    pemanasanDetik = 0,
    skalaWaktu = 1,
    ctx,
    batasMs = 20_000,
    ambil = fetch,
    env = process.env,
    muatMysql,
  } = opsi;
  const pengumpul = buatPengumpul();
  const pengukurSipp = await mulaiPengukurSipp(env, Math.max(200, 5000 * skalaWaktu), muatMysql);
  const pengukurSumber = mulaiPengukurSumberDaya(Math.max(100, 2000 * skalaWaktu));
  const mulai = performance.now();
  const mulaiCatat = mulai + pemanasanDetik * 1000;
  const akhir = mulai + (pemanasanDetik + durasiDetik) * 1000;
  const acak = mulberry32(opsi.benih ?? 1);
  const pewaktu = [];
  const berjalan = new Set();

  const jadwalkan = (jenis) => {
    const selang = Math.max(20, SELANG_MS[jenis] * skalaWaktu);
    const tembak = () => {
      if (performance.now() >= akhir) return;
      const p = kirimSatu({ sasaran, kuki, jenis, ctx, pengumpul, mulaiCatat, batasMs, ambil }).finally(() => berjalan.delete(p));
      berjalan.add(p);
    };
    const awal = setTimeout(() => {
      tembak();
      pewaktu.push(setInterval(tembak, selang));
    }, acak() * selang);
    pewaktu.push(awal);
  };
  for (const p of perangkat) for (const jenis of p.jenis) jadwalkan(jenis);

  await new Promise((selesai) => setTimeout(selesai, Math.max(0, akhir - performance.now())));
  for (const t of pewaktu) {
    clearTimeout(t);
    clearInterval(t);
  }
  await Promise.allSettled([...berjalan]);
  const sumberDaya = pengukurSumber.berhenti();
  const sipp = await pengukurSipp.berhenti();
  const ringkas = pengumpul.ringkas(durasiDetik);
  return {
    perangkat: perangkat.length,
    durasiDetik,
    pemanasanDetik,
    ...ringkas,
    sumberDaya,
    sipp,
  };
}

// ---------------------------------------------------------------------------
// Laporan
// ---------------------------------------------------------------------------

const NAMA_RUTE = {
  jadwalPenuh: "Jadwal Sidang penuh",
  jadwalRingan: "Jadwal Sidang ringan",
  disidang: "Sedang disidang",
  widget: "Widget (denyut)",
  konteks: "Konteks SIPP",
  statusPerkara: "Status Perkara",
};

export function teksRingkasan(hasil) {
  const baris = [];
  baris.push(`Uji beban ${hasil.perangkat} perangkat, ${hasil.durasiDetik} detik, profil ${hasil.profil}, sasaran ${hasil.sasaran}`);
  baris.push(
    `Total ${hasil.total.permintaan} permintaan (${hasil.total.permintaanPerDetik}/dtk), galat ${hasil.total.galat} (${hasil.total.persenGalat}%), ` +
      `bot tak terjangkau ${hasil.total.botTakTerjangkau}; p50 ${hasil.total.p50} ms, p95 ${hasil.total.p95} ms, p99 ${hasil.total.p99} ms, maks ${hasil.total.maks} ms`
  );
  for (const [jenis, r] of Object.entries(hasil.rute)) {
    baris.push(`  ${(NAMA_RUTE[jenis] || jenis).padEnd(22)} n=${String(r.jumlah).padStart(5)} galat=${String(r.galat).padStart(4)} p95=${String(r.p95).padStart(7)} ms p99=${String(r.p99).padStart(7)} ms`);
  }
  const s = hasil.sumberDaya;
  baris.push(`Laptop: CPU rata ${s.cpuMesinRata}% (maks ${s.cpuMesinMaks}%, penguji ${s.cpuPengujiRata}%), RAM rata ${s.ramMesinRataPersen}% (maks ${s.ramMesinMaksPersen}%) dari ${s.ramTotalGB} GB, ${s.inti} inti`);
  if (hasil.sipp?.tersedia) {
    baris.push(`SIPP kembaran: ${hasil.sipp.kueriPerMenit} kueri/menit, sambungan rata ${hasil.sipp.sambunganRata} (maks ${hasil.sipp.sambunganMaks}), kueri berjalan maks ${hasil.sipp.kueriBerjalanMaks}`);
  } else {
    baris.push(`SIPP kembaran: tidak diukur (${hasil.sipp?.alasan || "tidak tersedia"})`);
  }
  return baris.join("\n");
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export function bacaArgumen(argv) {
  const hasil = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      hasil._.push(a);
      continue;
    }
    const [k, v] = a.slice(2).split("=");
    if (v !== undefined) hasil[k] = v;
    else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) hasil[k] = argv[(i += 1)];
    else hasil[k] = true;
  }
  return hasil;
}

export async function utama(argv, env = process.env, deps = {}) {
  const arg = bacaArgumen(argv);
  const keluar = deps.keluar || ((t) => console.log(t));
  const ambil = deps.ambil || fetch;
  let sasaran;
  try {
    sasaran = periksaSasaran(arg.sasaran || env.ALETA_UJI_SASARAN || "http://localhost:3000");
    if (sasaran.perluResolusi) await pastikanResolusiLoopback(sasaran.host, deps.cariDns);
  } catch (galat) {
    keluar(`DITOLAK: ${galat.message}`);
    return 2;
  }

  let kuki = String(env.ALETA_UJI_KUKI || "").trim();
  if (!kuki && arg.masuk) {
    try {
      kuki = await masukKembaran(sasaran, env.ALETA_UJI_EMAIL, env.ALETA_UJI_SANDI, ambil);
    } catch (galat) {
      keluar(`GAGAL: ${galat.message}`);
      return 3;
    }
  }
  if (!kuki) {
    keluar("GAGAL: isi ALETA_UJI_KUKI (kuki sesi akun kembaran) atau ALETA_UJI_EMAIL + ALETA_UJI_SANDI dengan --masuk.");
    return 3;
  }

  const profil = String(arg.profil || "campuran");
  if (!PROFIL[profil]) {
    keluar(`GAGAL: profil "${profil}" tidak dikenal (${Object.keys(PROFIL).join(", ")}).`);
    return 3;
  }
  const jumlahList = String(arg.perangkat || "100")
    .split(",")
    .map((n) => Math.floor(Number(n)))
    .filter((n) => n > 0 && n <= 1000);
  if (!jumlahList.length) {
    keluar("GAGAL: --perangkat harus angka 1..1000 (mis. 100 atau 100,200).");
    return 3;
  }
  const durasiDetik = Math.max(1, Number(arg.durasi) || 60);
  const pemanasanDetik = Math.max(0, Number(arg.pemanasan ?? 5));
  const skalaWaktu = arg["skala-waktu"] ? Math.min(1, Math.max(0.005, Number(arg["skala-waktu"]))) : 1;
  const benih = Number(arg.benih) || 1;
  const ctx = {
    nomor: String(arg.nomor || "999/Pdt.G/2026/PA.Rekaan"),
    kataCari: String(arg["kata-cari"] || "Pdt.G"),
    tanggal: arg.tanggal ? String(arg.tanggal) : undefined,
  };
  const folder = path.resolve(String(arg.keluaran || env.ALETA_UJI_KELUARAN || "D:\\Aplikasi\\aleta\\tmp\\uji-beban"));
  fs.mkdirSync(folder, { recursive: true });

  const stempel = new Date().toISOString().replace(/[:.]/g, "-");
  const tampilSasaran = `${sasaran.asal}${sasaran.awalan}`;
  for (const jumlah of jumlahList) {
    keluar(`Mulai ${jumlah} perangkat, ${durasiDetik} detik (+${pemanasanDetik} pemanasan) ke ${tampilSasaran} ...`);
    const perangkat = susunPerangkat(jumlah, profil, benih);
    const hasilPutaran = await jalankanPutaran({
      sasaran,
      kuki,
      perangkat,
      durasiDetik,
      pemanasanDetik,
      skalaWaktu,
      ctx,
      benih,
      ambil,
      env,
      muatMysql: deps.muatMysql,
    });
    const hasil = {
      versi: VERSI_HASIL,
      dibuat: new Date().toISOString(),
      sasaran: tampilSasaran,
      profil,
      komputer: { nama: os.hostname(), sistem: `${os.platform()} ${os.release()}`, node: process.version },
      ...hasilPutaran,
      catatan: [
        "Semua perangkat tiruan memakai satu sesi akun kembaran.",
        "CPU/RAM adalah milik laptop penguji (penguji dan kembaran berbagi mesin).",
        ...(skalaWaktu < 1 ? [`Selang waktu dipendekkan ${skalaWaktu}x: hanya untuk membuktikan skrip bekerja, BUKAN angka beban.`] : []),
      ],
    };
    const dasar = path.join(folder, `uji-beban-${stempel}-${jumlah}-perangkat`);
    fs.writeFileSync(`${dasar}.json`, JSON.stringify(hasil, null, 2), "utf8");
    fs.writeFileSync(`${dasar}.txt`, teksRingkasan(hasil) + "\n", "utf8");
    keluar(teksRingkasan(hasil));
    keluar(`Hasil: ${dasar}.json`);
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SKRIP) {
  utama(process.argv.slice(2)).then(
    (kode) => process.exit(kode),
    (galat) => {
      console.error(galat);
      process.exit(1);
    }
  );
}
