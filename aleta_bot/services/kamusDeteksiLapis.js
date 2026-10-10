"use strict";

/**
 * Pemuat LAPIS DATABASE kamus deteksi (10 Okt 2026, paket deteksi lengkap).
 *
 * Bot tidak pernah memanggil portal, jadi lapis database (tabel
 * aleta_kamus_deteksi_pola/_templat di Postgres portal) DIDORONG portal ke
 * PUT /internal/aleta-bot/kamus-deteksi/lapis setiap kali admin mengubahnya,
 * dan berkala dari instrumentation portal. Di sini lapis itu:
 *
 *   1. diperiksa (regex terkompilasi, kelompok & kode terisi) - baris rusak
 *      DIBUANG satu per satu, tidak menggagalkan sisanya;
 *   2. disimpan ke berkas di folder runtime-data yang TERPASANG volume
 *      (bot hidup ulang tetap memakainya tanpa menunggu portal);
 *   3. dipasang lewat kamusDeteksi.aturLapisDatabase.
 *
 * Saat bot hidup: muatLapisTersimpan() membaca berkas itu. Berkala: berkasnya
 * dibaca ulang bila waktu ubahnya berganti. Berkas tidak ada / rusak / kosong
 * = lapis kosong = perilaku benih murni (tidak pernah melempar).
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const kamusDeteksi = require("./kamusDeteksi");

function berkasLapis() {
  if (process.env.ALETA_KAMUS_DETEKSI_LAPIS_PATH) return process.env.ALETA_KAMUS_DETEKSI_LAPIS_PATH;
  const konfig = process.env.ALETA_BOT_RUNTIME_CONFIG_PATH || path.join(__dirname, "..", "config", "aleta-runtime.json");
  return path.join(path.dirname(konfig), "kamus-deteksi-lapis.json");
}

const BENDERA_SAH = /^[imsu]*$/;

let keadaan = { jumlahPola: 0, jumlahTemplat: 0, sidik: "", diterimaPada: "", mtimeMs: 0, ditolak: [] };

function teks(x) {
  return String(x == null ? "" : x).trim();
}

/** Memeriksa dan merapikan lapis. Mengembalikan {pola, templat, ditolak[]}. */
function rapikanLapis(isi) {
  const sumber = isi && typeof isi === "object" ? isi : {};
  const ditolak = [];
  const pola = [];
  const templat = [];
  for (const p of Array.isArray(sumber.pola) ? sumber.pola : []) {
    if (!p || typeof p !== "object") continue;
    const kode = teks(p.kode);
    const kelompok = teks(p.kelompok);
    const flags = p.flags == null ? "i" : teks(p.flags);
    if (!kode || !kelompok) {
      ditolak.push(`pola tanpa kode/kelompok`);
      continue;
    }
    if (!BENDERA_SAH.test(flags)) {
      ditolak.push(`${kode}: bendera "${flags}" tidak boleh`);
      continue;
    }
    try {
      // eslint-disable-next-line no-new
      new RegExp(String(p.regex || ""), flags);
    } catch (galat) {
      ditolak.push(`${kode}: regex tidak terkompilasi (${galat.message})`);
      continue;
    }
    if (!String(p.regex || "")) {
      ditolak.push(`${kode}: regex kosong`);
      continue;
    }
    const status = ["aktif", "nonaktif", "draf"].includes(teks(p.status)) ? teks(p.status) : "aktif";
    // Draf tidak pernah dipakai bot - portal pun tidak mengirimnya.
    if (status === "draf") continue;
    pola.push({ ...p, kode, kelompok, flags, status });
  }
  for (const t of Array.isArray(sumber.templat) ? sumber.templat : []) {
    if (!t || typeof t !== "object") continue;
    const kode = teks(t.kode);
    const kelompok = teks(t.kelompok);
    if (!kode || !kelompok || typeof t.teks !== "string") {
      ditolak.push(`templat ${kode || "(tanpa kode)"}: kode/kelompok/teks kosong`);
      continue;
    }
    const status = ["aktif", "nonaktif", "draf"].includes(teks(t.status)) ? teks(t.status) : "aktif";
    if (status === "draf") continue;
    templat.push({ ...t, kode, kelompok, status });
  }
  return { pola, templat, ditolak };
}

function sidikDari(lapis) {
  return crypto.createHash("sha256").update(JSON.stringify({ pola: lapis.pola, templat: lapis.templat })).digest("hex").slice(0, 16);
}

function pasang(lapis, sidikPortal, diterimaPada, mtimeMs, ditolak) {
  kamusDeteksi.aturLapisDatabase({ pola: lapis.pola, templat: lapis.templat });
  keadaan = {
    jumlahPola: lapis.pola.length,
    jumlahTemplat: lapis.templat.length,
    sidik: teks(sidikPortal) || sidikDari(lapis),
    diterimaPada: diterimaPada || "",
    mtimeMs: mtimeMs || 0,
    ditolak: ditolak || [],
  };
}

/**
 * Menerima lapis dari portal: periksa, simpan ke berkas, pasang.
 * Sidik yang dikirim portal disimpan apa adanya agar portal dapat
 * membandingkannya (selaras/tidak) tanpa menghitung ulang di dua bahasa.
 */
function terimaLapis(isi) {
  const lapis = rapikanLapis(isi);
  const diterimaPada = new Date().toISOString();
  const sidik = teks(isi && isi.sidik);
  const simpanan = { sidik, diterimaPada, pola: lapis.pola, templat: lapis.templat };
  let mtimeMs = 0;
  let galatSimpan = "";
  try {
    const berkas = berkasLapis();
    fs.mkdirSync(path.dirname(berkas), { recursive: true });
    const sementara = `${berkas}.tmp`;
    fs.writeFileSync(sementara, JSON.stringify(simpanan), "utf8");
    fs.renameSync(sementara, berkas);
    mtimeMs = fs.statSync(berkas).mtimeMs;
  } catch (galat) {
    // Tetap dipasang di memori; hanya bertahannya yang tertinggal.
    galatSimpan = galat.message;
  }
  pasang(lapis, sidik, diterimaPada, mtimeMs, lapis.ditolak);
  return { ok: true, diterima: { pola: lapis.pola.length, templat: lapis.templat.length }, ditolak: lapis.ditolak, galatSimpan };
}

/** Membaca berkas lapis (saat hidup / berkala). Tidak pernah melempar. */
function muatLapisTersimpan({ paksa = false } = {}) {
  const berkas = berkasLapis();
  let stat;
  try {
    stat = fs.statSync(berkas);
  } catch {
    return { dimuat: false, sebab: "berkas lapis belum ada" };
  }
  if (!paksa && stat.mtimeMs === keadaan.mtimeMs) return { dimuat: false, sebab: "tidak berubah" };
  try {
    const isi = JSON.parse(fs.readFileSync(berkas, "utf8"));
    const lapis = rapikanLapis(isi);
    pasang(lapis, isi.sidik, teks(isi.diterimaPada), stat.mtimeMs, lapis.ditolak);
    return { dimuat: true, pola: lapis.pola.length, templat: lapis.templat.length };
  } catch (galat) {
    return { dimuat: false, sebab: `berkas lapis rusak: ${galat.message}` };
  }
}

let detak = null;
/** Muat sekarang + baca ulang berkala (bawaan 5 menit). */
function mulaiPemuatLapis(selangMs = Number(process.env.ALETA_KAMUS_DETEKSI_SELANG_MS || 300000)) {
  const hasil = muatLapisTersimpan({ paksa: true });
  if (!detak && selangMs > 0) {
    detak = setInterval(() => muatLapisTersimpan(), selangMs);
    if (detak.unref) detak.unref();
  }
  return hasil;
}

function hentikanPemuatLapis() {
  if (detak) clearInterval(detak);
  detak = null;
}

function keadaanLapis() {
  return { ...keadaan, berkas: berkasLapis() };
}

/** Benih per kelompok, untuk layar Admin portal (citra portal tidak memuat aleta_bot). */
function benihSemua() {
  const hasil = {};
  for (const n of fs.existsSync(kamusDeteksi.FOLDER_BENIH) ? fs.readdirSync(kamusDeteksi.FOLDER_BENIH) : []) {
    if (!n.endsWith(".json")) continue;
    try {
      const isi = JSON.parse(fs.readFileSync(path.join(kamusDeteksi.FOLDER_BENIH, n), "utf8"));
      const kelompok = isi.kelompok || n.replace(/\.json$/, "");
      hasil[kelompok] = { versi: isi.versi || 1, pola: isi.pola || [], templat: isi.templat || [] };
    } catch (galat) {
      hasil[n.replace(/\.json$/, "")] = { pola: [], templat: [], galat: galat.message };
    }
  }
  return hasil;
}

/** Untuk uji: lupakan keadaan. */
function _setel() {
  hentikanPemuatLapis();
  keadaan = { jumlahPola: 0, jumlahTemplat: 0, sidik: "", diterimaPada: "", mtimeMs: 0, ditolak: [] };
}

module.exports = {
  terimaLapis,
  muatLapisTersimpan,
  mulaiPemuatLapis,
  hentikanPemuatLapis,
  keadaanLapis,
  benihSemua,
  rapikanLapis,
  berkasLapis,
  _setel,
};
