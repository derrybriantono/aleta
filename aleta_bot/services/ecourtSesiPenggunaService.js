"use strict";

/**
 * Sesi e-Court PRIBADI - satu per pengguna ALETA per peran (perbaikan 1 Okt
 * 2026, butir E10).
 *
 * ============================================================================
 * TERPISAH DARI AKUN PENARIK DATA
 * ============================================================================
 *
 * Akun penarik data (ecourtAkunService, slot "utama" dan seterusnya) milik
 * pengadilan: dipakai penjadwal untuk MEMBACA e-Court. Sesi di berkas ini
 * milik ORANG: hakim yang memverifikasi dokumen e-litigasi, panitera yang
 * men-TTE salinan putusan, pengguna yang mengunggah salinan putusan. Tindakan
 * tulis ke e-Court hanya boleh atas nama akun orang yang menekan tombolnya -
 * tidak pernah lewat akun penarik.
 *
 * ============================================================================
 * YANG DISIMPAN: COOKIE TERSANDI. YANG TIDAK PERNAH DISIMPAN: SANDI
 * ============================================================================
 *
 * Sandi e-Court diketik pengguna ke layar sambung, diteruskan ke formulir
 * login e-Court, lalu hilang bersama peramban yang ditutup. Yang tersisa
 * hanyalah cookie sesi, disandi AES-256-GCM dengan kunci yang SAMA dengan
 * simpanan kredensial (ecourtKredensialService.sandikan) - kunci di luar folder
 * aplikasi. Tidak ada pengisian otomatis dari simpanan sandi BERSAMA di sini.
 *
 * Butir 20 (5 Okt 2026): pengguna BOLEH menyimpan akun e-Court MILIKNYA
 * SENDIRI per peran (ecourtAkunPenggunaService, tersandi). Bila tersimpan,
 * masuk ulang cukup captcha (kirimSambung pakaiTersimpan). Yang dibuka tetap
 * hanya akun milik penggunaId itu untuk peran itu.
 *
 * Sesi habis = cookie-nya dihapus dan pengguna masuk lagi sendiri lewat layar
 * Integrasi e-Court > Sesi e-Court saya. Tidak ada perpanjangan paksa dan
 * tidak ada login otomatis di latar: menekan "Lanjut" di gerbang e-Court
 * memutus sesi pemilik akun di perangkatnya sendiri.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const sesiEcourt = require("../tools/ecourt-bridge/sesi");

/** Peran e-Court yang dikenal. Yang lain ditolak, bukan ditebak. */
const PERAN_ECOURT = ["hakim", "panitera", "panitera-pengganti", "juru-sita", "lainnya"];

const SEBUTAN_PERAN = {
  hakim: "Hakim",
  panitera: "Panitera",
  "panitera-pengganti": "Panitera Pengganti",
  "juru-sita": "Juru Sita",
  lainnya: "Lainnya",
};

/**
 * Peran yang sesinya dipakai untuk tiap aksi, berurutan. Aksi tanpa sesi
 * peran yang cocok DITOLAK - tidak dialihkan ke peran lain di luar daftar.
 */
const PERAN_UNTUK_AKSI = {
  verifikasi: ["hakim"],
  tte: ["panitera"],
  // Juru sita ikut (butir 20, 5 Okt 2026): yang mengunggah adalah akun orang
  // yang sedang membuka ALETA/SIPP. Boleh tidaknya akun itu mengunggah
  // diputuskan e-Court sendiri - tombolnya harus tepat satu di halamannya,
  // atau pengemudi berhenti tanpa menyentuh apa pun.
  unggah: ["hakim", "panitera-pengganti", "panitera", "juru-sita"],
  baca: ["hakim", "panitera", "panitera-pengganti", "juru-sita", "lainnya"],
};

function normalkanPeran(peran) {
  const nilai = String(peran || "").trim().toLowerCase();
  return PERAN_ECOURT.includes(nilai) ? nilai : "";
}

function normalkanPengguna(id) {
  const nilai = String(id || "").trim();
  return /^[A-Za-z0-9_.:@-]{1,80}$/.test(nilai) ? nilai : "";
}

function folder() {
  return path.join(sesiEcourt.sessionRoot(), "pengguna");
}

function jalurSimpanan() {
  return path.join(folder(), "sesi-pengguna.json");
}

function kunci(penggunaId, peran) {
  return crypto.createHash("sha256").update(`${penggunaId}|${peran}`).digest("hex").slice(0, 32);
}

function bacaSemua() {
  try {
    const isi = JSON.parse(fs.readFileSync(jalurSimpanan(), "utf8"));
    return isi && typeof isi === "object" ? isi : {};
  } catch {
    return {};
  }
}

function tulisSemua(isi) {
  fs.mkdirSync(folder(), { recursive: true, mode: 0o700 });
  const jalur = jalurSimpanan();
  const sementara = `${jalur}.${process.pid}.tmp`;
  fs.writeFileSync(sementara, JSON.stringify(isi, null, 2), { mode: 0o600 });
  fs.renameSync(sementara, jalur);
  try {
    fs.chmodSync(jalur, 0o600);
  } catch {
    /* Windows */
  }
}

function penyandi() {
  // Dimuat malas: modul kredensial membuat berkas kunci saat pertama dipakai.
  return require("./ecourtKredensialService");
}

/** Akun e-Court tersimpan milik pengguna (butir 20). Dimuat malas. */
function akunPengguna() {
  return require("./ecourtAkunPenggunaService");
}

/** Baris untuk layar - TANPA cookie, tersandi pun tidak. */
function barisLayar(baris) {
  return {
    peran: baris.peran,
    sebutanPeran: SEBUTAN_PERAN[baris.peran] || baris.peran,
    namaAkunEcourt: String(baris.namaAkunEcourt || ""),
    tersambungPada: String(baris.tersambungPada || ""),
    terakhirDipakai: String(baris.terakhirDipakai || ""),
    diperiksaPada: String(baris.diperiksaPada || ""),
    keadaan: baris.kedaluwarsaPada ? "kedaluwarsa" : baris.cookies ? "tersambung" : "terputus",
    kedaluwarsaPada: String(baris.kedaluwarsaPada || ""),
  };
}

function daftarSesi(penggunaId) {
  const id = normalkanPengguna(penggunaId);
  if (!id) return [];
  return Object.values(bacaSemua())
    .filter((b) => b && b.penggunaId === id)
    .map(barisLayar)
    .sort((a, b) => PERAN_ECOURT.indexOf(a.peran) - PERAN_ECOURT.indexOf(b.peran));
}

function simpanSesi({ penggunaId, peran, namaPengguna = "", namaAkunEcourt = "", cookies }) {
  const id = normalkanPengguna(penggunaId);
  const p = normalkanPeran(peran);
  if (!id || !p) return { ok: false, alasan: "pengguna_atau_peran_tidak_sah" };
  if (!Array.isArray(cookies) || cookies.length === 0) return { ok: false, alasan: "cookie_kosong" };
  const semua = bacaSemua();
  const sekarang = new Date().toISOString();
  semua[kunci(id, p)] = {
    penggunaId: id,
    peran: p,
    namaPengguna: String(namaPengguna || "").slice(0, 120),
    namaAkunEcourt: String(namaAkunEcourt || "").slice(0, 120),
    cookies: penyandi().sandikan(JSON.stringify(cookies)),
    tersambungPada: sekarang,
    terakhirDipakai: "",
    diperiksaPada: sekarang,
    kedaluwarsaPada: "",
  };
  tulisSemua(semua);
  return { ok: true, alasan: "" };
}

/** Cookie terbuka - HANYA untuk ecourtAksiService. Tidak ada rute yang memanggilnya. */
function ambilCookies(penggunaId, peran) {
  const baris = bacaSemua()[kunci(normalkanPengguna(penggunaId), normalkanPeran(peran))];
  if (!baris || !baris.cookies || baris.kedaluwarsaPada) return null;
  const teks = penyandi().bukaSandi(baris.cookies);
  if (!teks) return null;
  try {
    const cookies = JSON.parse(teks);
    return Array.isArray(cookies) && cookies.length ? cookies : null;
  } catch {
    return null;
  }
}

function perbaruiCookies(penggunaId, peran, cookies, { namaAkunEcourt = "" } = {}) {
  const k = kunci(normalkanPengguna(penggunaId), normalkanPeran(peran));
  const semua = bacaSemua();
  if (!semua[k]) return false;
  if (Array.isArray(cookies) && cookies.length) semua[k].cookies = penyandi().sandikan(JSON.stringify(cookies));
  if (namaAkunEcourt) semua[k].namaAkunEcourt = String(namaAkunEcourt).slice(0, 120);
  semua[k].terakhirDipakai = new Date().toISOString();
  tulisSemua(semua);
  return true;
}

/** Sesi habis: cookie DIBUANG, baris tetap supaya layar dapat menyebut kapan. */
function tandaiKedaluwarsa(penggunaId, peran) {
  const k = kunci(normalkanPengguna(penggunaId), normalkanPeran(peran));
  const semua = bacaSemua();
  if (!semua[k]) return false;
  semua[k].cookies = "";
  semua[k].kedaluwarsaPada = new Date().toISOString();
  tulisSemua(semua);
  return true;
}

function catatDiperiksa(penggunaId, peran) {
  const k = kunci(normalkanPengguna(penggunaId), normalkanPeran(peran));
  const semua = bacaSemua();
  if (!semua[k]) return;
  semua[k].diperiksaPada = new Date().toISOString();
  tulisSemua(semua);
}

function hapusSesi(penggunaId, peran) {
  const k = kunci(normalkanPengguna(penggunaId), normalkanPeran(peran));
  const semua = bacaSemua();
  if (!semua[k]) return { ok: true, alasan: "tidak_ada_yang_dihapus" };
  delete semua[k];
  tulisSemua(semua);
  return { ok: true, alasan: "" };
}

/**
 * Sesi mana yang AKAN dipakai untuk satu aksi. null bila tidak ada - dan
 * pemanggil wajib menolak, bukan mencari akun lain.
 */
function pilihSesi(penggunaId, aksi) {
  const urutan = PERAN_UNTUK_AKSI[aksi] || [];
  const milik = daftarSesi(penggunaId);
  for (const peran of urutan) {
    const baris = milik.find((b) => b.peran === peran && b.keadaan === "tersambung");
    if (baris) return baris;
  }
  return null;
}

/**
 * Mengapa tidak ada sesi yang dapat dipakai untuk aksi ini (butir 20).
 *
 *   ""                         - ada sesi tersambung; tidak perlu alasan
 *   "sesi_habis_akun_tersimpan" - akun e-Court milik pengguna untuk peran
 *                                yang cocok TERSIMPAN; cukup "Uji masuk"
 *                                (ketik captcha)
 *   "akun_ecourt_belum_diisi"  - tidak ada akun tersimpan dan tidak pernah
 *                                ada sesi untuk peran yang cocok: pengguna
 *                                harus mengisi akunnya sendiri dulu
 *   `bawaan`                   - pernah tersambung tanpa menyimpan akun;
 *                                alasan lama (sesi_*_belum_tersambung /
 *                                kedaluwarsa) tetap dipakai
 *
 * Tidak satu pun cabangnya mencari akun orang lain.
 */
function alasanTanpaSesi(penggunaId, aksi, bawaan) {
  const id = normalkanPengguna(penggunaId);
  if (!id) return "pengguna_tidak_sah";
  if (pilihSesi(id, aksi)) return "";
  const urutan = PERAN_UNTUK_AKSI[aksi] || [];
  if (urutan.some((p) => akunPengguna().ada(id, p))) return "sesi_habis_akun_tersimpan";
  const milik = daftarSesi(id);
  if (milik.some((b) => urutan.includes(b.peran))) return bawaan;
  return "akun_ecourt_belum_diisi";
}

/** Sebutan peran yang boleh dipakai untuk satu aksi - untuk pesan ke layar. */
function sebutanPeranAksi(aksi) {
  return (PERAN_UNTUK_AKSI[aksi] || []).map((p) => SEBUTAN_PERAN[p] || p);
}

/** Keadaan sesi SELURUH pengguna - untuk rekap admin. Tanpa cookie. */
function daftarSesiSemua() {
  return Object.values(bacaSemua())
    .filter((b) => b && b.penggunaId && b.peran)
    .map((b) => ({ penggunaId: b.penggunaId, namaPengguna: String(b.namaPengguna || ""), ...barisLayar(b) }));
}

// ===========================================================================
// MENYAMBUNGKAN (login dengan captcha) - pengemudi peramban disuntikkan
// ===========================================================================

/** kunci pengguna|peran -> { token, dibuka } ; satu formulir per pengguna-peran. */
const menunggu = new Map();
const BATAS_LOGIN_SERENTAK = Number(process.env.ALETA_ECOURT_SESI_PRIBADI_SERENTAK || 3);

function pengemudiBawaan() {
  return require("./ecourtPerambanAksiService");
}

async function mulaiSambung({ penggunaId, peran }, { pengemudi = pengemudiBawaan() } = {}) {
  const id = normalkanPengguna(penggunaId);
  const p = normalkanPeran(peran);
  if (!id || !p) return { ok: false, alasan: "pengguna_atau_peran_tidak_sah" };
  const k = kunci(id, p);
  const lama = menunggu.get(k);
  if (lama) {
    pengemudi.batalLogin && pengemudi.batalLogin(lama.token);
    menunggu.delete(k);
  }
  if (menunggu.size >= BATAS_LOGIN_SERENTAK) return { ok: false, alasan: "terlalu_banyak_login_serentak" };
  const hasil = await pengemudi.mulaiLogin();
  if (!hasil.ok) return { ok: false, alasan: hasil.alasan || "gagal_membuka" };
  menunggu.set(k, { token: hasil.token, dibuka: Date.now() });
  // Akun tersimpan (butir 20): layar cukup meminta captcha. Surel boleh
  // tampil kepada pemiliknya - membantu memastikan akun yang benar. Sandi tidak.
  const tersimpan = akunPengguna().daftarMilik(id).find((a) => a.peran === p && a.adaSandi);
  return {
    ok: true,
    alasan: "",
    captcha: hasil.captcha || "",
    adaCaptcha: hasil.adaCaptcha !== false,
    akunTersimpan: tersimpan ? tersimpan.email : "",
  };
}

/**
 * Sandi diteruskan ke pengemudi dan TIDAK disentuh lagi sesudahnya: tidak
 * dicatat, tidak dikembalikan. Disimpan (tersandi) HANYA bila pengguna
 * mencentang simpanAkun DAN e-Court menerima login itu - sandi yang belum
 * terbukti benar tidak pernah masuk simpanan.
 *
 * pakaiTersimpan: surel dan sandi diambil dari akun e-Court tersimpan milik
 * pengguna ITU SENDIRI untuk peran ITU (butir 20). Tidak ada = ditolak, tidak
 * pernah mencari akun lain.
 */
async function kirimSambung(
  { penggunaId, peran, namaPengguna = "", email, sandi, captcha, pakaiTersimpan = false, simpanAkun = false },
  { pengemudi = pengemudiBawaan() } = {}
) {
  const id = normalkanPengguna(penggunaId);
  const p = normalkanPeran(peran);
  if (!id || !p) return { ok: false, alasan: "pengguna_atau_peran_tidak_sah" };
  const k = kunci(id, p);
  const tunggu = menunggu.get(k);
  if (!tunggu) return { ok: false, alasan: "sesi_login_kedaluwarsa" };
  menunggu.delete(k);
  let surel = String(email || "");
  let kataSandi = String(sandi || "");
  let dariSimpanan = false;
  if (pakaiTersimpan === true) {
    const t = akunPengguna().ambil(id, p);
    if (!t) {
      pengemudi.batalLogin && pengemudi.batalLogin(tunggu.token);
      return { ok: false, alasan: "akun_ecourt_belum_diisi" };
    }
    surel = t.email;
    kataSandi = t.sandi;
    dariSimpanan = true;
  }
  if (!surel || !kataSandi) {
    pengemudi.batalLogin && pengemudi.batalLogin(tunggu.token);
    return { ok: false, alasan: "email_atau_sandi_kosong" };
  }
  const sapu = (teks) => String(teks || "").split(kataSandi).join("***");
  let hasil;
  try {
    hasil = await pengemudi.kirimLogin(tunggu.token, { email: surel, sandi: kataSandi, captcha });
  } catch (galat) {
    hasil = { ok: false, alasan: `pengemudi_gagal: ${sapu(galat && galat.message).slice(0, 160)}` };
  }
  if (dariSimpanan) {
    akunPengguna().catatUji(id, p, hasil.ok ? "berhasil" : hasil.alasan === "login_ditolak_ecourt" ? "ditolak" : "gagal");
  }
  if (!hasil.ok) return { ok: false, alasan: sapu(hasil.alasan || "login_gagal") };
  const simpan = simpanSesi({ penggunaId: id, peran: p, namaPengguna, namaAkunEcourt: hasil.namaAkun, cookies: hasil.cookies });
  if (!simpan.ok) return simpan;
  let akunDisimpan = false;
  if (simpanAkun === true && !dariSimpanan) {
    const s = akunPengguna().simpan({ penggunaId: id, peran: p, namaPengguna, email: surel, sandi: kataSandi, olehSiapa: `pengguna:${id}` });
    akunDisimpan = s.ok;
    if (s.ok) akunPengguna().catatUji(id, p, "berhasil");
  }
  return { ok: true, alasan: "", namaAkunEcourt: sapu(hasil.namaAkun || ""), akunDisimpan, dariSimpanan };
}

async function periksa({ penggunaId, peran }, { pengemudi = pengemudiBawaan() } = {}) {
  const cookies = ambilCookies(penggunaId, peran);
  if (!cookies) return { ok: true, berlaku: false, alasan: "belum_tersambung" };
  const hasil = await pengemudi.periksaSesi({ cookies });
  if (!hasil.ok) return { ok: false, berlaku: null, alasan: hasil.alasan };
  if (hasil.berlaku) {
    perbaruiCookies(penggunaId, peran, hasil.cookies, { namaAkunEcourt: hasil.namaAkun });
    catatDiperiksa(penggunaId, peran);
    return { ok: true, berlaku: true, alasan: "", namaAkunEcourt: hasil.namaAkun || "" };
  }
  tandaiKedaluwarsa(penggunaId, peran);
  return { ok: true, berlaku: false, alasan: "sesi_habis" };
}

module.exports = {
  PERAN_ECOURT,
  PERAN_UNTUK_AKSI,
  SEBUTAN_PERAN,
  alasanTanpaSesi,
  ambilCookies,
  daftarSesi,
  daftarSesiSemua,
  sebutanPeranAksi,
  hapusSesi,
  jalurSimpanan,
  kirimSambung,
  mulaiSambung,
  normalkanPeran,
  normalkanPengguna,
  perbaruiCookies,
  periksa,
  pilihSesi,
  simpanSesi,
  tandaiKedaluwarsa,
};
