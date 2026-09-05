"use strict";

/**
 * Menyimpan surel dan sandi akun e-Court, tersandi, untuk mengisi formulir
 * login sendiri.
 *
 * ============================================================================
 * KENAPA INI DIBUAT, PADAHAL SEBELUMNYA SENGAJA TIDAK
 * ============================================================================
 *
 * Semula ALETA memang tidak menyimpan sandi sama sekali. Yang membuatnya
 * berubah bukan kemudahan, melainkan kenyataan di meja: sesi e-Court habis
 * sendiri, kerap di luar jam kerja, dan penarikan berhenti sampai ada petugas
 * yang sempat mengetik ulang surel dan sandi. Yang benar-benar tidak dapat
 * diotomatiskan hanyalah captcha - dan captcha memang harus begitu.
 *
 * Jadi yang disimpan di sini mempersingkat pekerjaan dari "cari catatan sandi,
 * ketik surel, ketik sandi, ketik captcha" menjadi "ketik captcha".
 *
 * ============================================================================
 * SANDI TIDAK PERNAH KELUAR DARI SERVER
 * ============================================================================
 *
 * Sandi hanya dibuka di dalam proses bot, tepat sebelum diketikkan ke formulir
 * login e-Court. Ia TIDAK PERNAH:
 *
 *   - dikirim ke portal, dalam bentuk apa pun
 *   - dimuat dalam jawaban API mana pun
 *   - dicatat ke log, termasuk log galat
 *
 * Yang boleh dilihat portal hanya: slot mana yang punya sandi tersimpan, dan
 * surelnya. Fungsi ambil() yang membuka sandinya sengaja tidak punya rute
 * gateway - satu-satunya pemanggilnya ecourtLoginService.
 *
 * ============================================================================
 * TERSANDI DENGAN KUNCI DI LUAR FOLDER APLIKASI
 * ============================================================================
 *
 * Berkas simpanan dan kuncinya diletakkan di folder yang sama dengan profil
 * sesi e-Court - di luar folder aplikasi. Alasannya sama: paket installer dan
 * pencadangan kode mengambil isi folder aplikasi, dan sandi pengadilan tidak
 * boleh ikut terbawa ke mana-mana.
 *
 * Penyandiannya AES-256-GCM. GCM dipilih bukan CBC karena ia sekaligus
 * memeriksa keutuhan: berkas yang disunting orang akan ditolak saat dibuka,
 * bukan menghasilkan sandi yang salah dan dikirim ke e-Court berkali-kali
 * sampai akunnya terkunci.
 *
 * ============================================================================
 * YANG TIDAK DILINDUNGI PENYANDIAN INI
 * ============================================================================
 *
 * Kuncinya ada di mesin yang sama dengan berkasnya - memang harus, sebab bot
 * membukanya tanpa manusia. Jadi yang dilindungi adalah salinan berkas yang
 * terbawa keluar: cadangan, paket installer, folder aplikasi yang tersalin.
 * Yang TIDAK dilindungi adalah orang yang sudah menguasai server itu sendiri.
 *
 * Ini disebutkan terang-terangan supaya tidak ada yang mengira menyalakan
 * fitur ini membuat sandi aman dari administrator server.
 */

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const logService = require("./logService");
const sesiEcourt = require("../tools/ecourt-bridge/sesi");

/** Folder simpanan - sama dengan folder profil sesi, di luar folder aplikasi. */
function folderSimpanan() {
  return (
    process.env.ALETA_ECOURT_KREDENSIAL_DIR || path.join(os.homedir(), ".aleta-ecourt-session")
  );
}

function jalurKunci() {
  return path.join(folderSimpanan(), "kredensial.kunci");
}

function jalurSimpanan() {
  return path.join(folderSimpanan(), "kredensial.json");
}

function pastikanFolder() {
  const folder = folderSimpanan();
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
  return folder;
}

/**
 * Kunci penyandian, dibuat sekali lalu dipakai seterusnya.
 *
 * Izin berkasnya 0600 - hanya pemilik proses yang boleh membacanya. Pada
 * Windows izin POSIX tidak berlaku; itu disebutkan pada laporan keadaan supaya
 * tidak disangka terlindungi padahal tidak.
 */
function ambilKunci() {
  pastikanFolder();
  const jalur = jalurKunci();

  if (fs.existsSync(jalur)) {
    const isi = fs.readFileSync(jalur);
    if (isi.length >= 32) return isi.subarray(0, 32);
    // Berkas kunci rusak atau terpotong. Membuat kunci baru akan membuat
    // seluruh sandi tersimpan tidak dapat dibuka - dan itu jauh lebih baik
    // daripada diam-diam memakai kunci yang tidak utuh.
    throw new Error("berkas_kunci_rusak");
  }

  const kunci = crypto.randomBytes(32);
  fs.writeFileSync(jalur, kunci, { mode: 0o600 });
  try {
    fs.chmodSync(jalur, 0o600);
  } catch {
    /* Windows tidak mengenal izin POSIX - dilaporkan pada keadaan() */
  }
  return kunci;
}

function sandikan(teks) {
  const kunci = ambilKunci();
  const iv = crypto.randomBytes(12);
  const alat = crypto.createCipheriv("aes-256-gcm", kunci, iv);
  const isi = Buffer.concat([alat.update(String(teks), "utf8"), alat.final()]);
  const tanda = alat.getAuthTag();
  return `${iv.toString("base64")}.${tanda.toString("base64")}.${isi.toString("base64")}`;
}

function bukaSandi(tersandi) {
  const bagian = String(tersandi || "").split(".");
  if (bagian.length !== 3) return "";
  try {
    const kunci = ambilKunci();
    const alat = crypto.createDecipheriv(
      "aes-256-gcm",
      kunci,
      Buffer.from(bagian[0], "base64")
    );
    alat.setAuthTag(Buffer.from(bagian[1], "base64"));
    const isi = Buffer.concat([alat.update(Buffer.from(bagian[2], "base64")), alat.final()]);
    return isi.toString("utf8");
  } catch {
    // Tanda keutuhan tidak cocok: berkasnya disunting, atau kuncinya berganti.
    // Mengembalikan kosong berarti sistem berperilaku seolah sandi belum
    // pernah disimpan - petugas login manual, dan tidak ada percobaan dengan
    // sandi keliru yang dapat mengunci akun.
    return "";
  }
}

function bacaSimpanan() {
  const jalur = jalurSimpanan();
  if (!fs.existsSync(jalur)) return {};
  try {
    const isi = JSON.parse(fs.readFileSync(jalur, "utf8"));
    return isi && typeof isi === "object" ? isi : {};
  } catch {
    return {};
  }
}

function tulisSimpanan(isi) {
  pastikanFolder();
  const jalur = jalurSimpanan();
  fs.writeFileSync(jalur, JSON.stringify(isi, null, 2), { mode: 0o600 });
  try {
    fs.chmodSync(jalur, 0o600);
  } catch {
    /* Windows - lihat catatan pada ambilKunci */
  }
}

/**
 * Slot untuk MENULIS - lebih ketat daripada membaca.
 *
 * bersihkanSlot() milik sesi mengembalikan slot bawaan bila masukannya tidak
 * sah. Untuk membaca keadaan itu masuk akal. Untuk MENYIMPAN SANDI tidak:
 * slot yang salah ketik, atau kotak yang terlanjur kosong, akan menaruh sandi
 * satu akun ke akun lain tanpa ada yang menyadarinya - dan percobaan login
 * berikutnya memakai sandi keliru berkali-kali sampai akun itu terkunci.
 *
 * Karena itu menulis menuntut slot yang disebut dengan tegas.
 */
function slotUntukMenulis(slot) {
  const nama = String(slot || "").trim().toLowerCase();
  if (!/^[a-z0-9-]{1,32}$/.test(nama)) return "";
  return nama;
}

/**
 * Menyimpan surel dan sandi satu slot.
 *
 * Sandi boleh dikosongkan untuk mengubah surel saja tanpa mengetik ulang
 * sandinya - itulah sebabnya sandi kosong TIDAK menghapus sandi yang ada.
 */
function simpan({ slot = "", email = "", sandi = "", olehSiapa = "" } = {}) {
  const kunciSlot = slotUntukMenulis(slot);
  if (!kunciSlot) return { ok: false, alasan: "slot_tidak_sah" };

  const surel = String(email || "").trim();
  if (!surel) return { ok: false, alasan: "email_kosong" };

  const simpanan = bacaSimpanan();
  const sebelumnya = simpanan[kunciSlot] || {};

  const sandiBaru = String(sandi || "");
  let tersandi = sebelumnya.sandi || "";
  if (sandiBaru) {
    try {
      tersandi = sandikan(sandiBaru);
    } catch (error) {
      return { ok: false, alasan: `gagal_menyandi: ${error.message}` };
    }
  }

  simpanan[kunciSlot] = {
    email: surel,
    sandi: tersandi,
    diperbaruiPada: new Date().toISOString(),
  };

  try {
    tulisSimpanan(simpanan);
  } catch (error) {
    return { ok: false, alasan: `gagal_menulis: ${error.message}` };
  }

  // Yang dicatat perbuatannya, bukan isinya. Log keamanan dibaca banyak orang.
  void logService.logSecurityEvent({
    eventType: "ecourt_kredensial_disimpan",
    severity: "warning",
    message: `Surel dan sandi akun e-Court slot ${kunciSlot} disimpan untuk pengisian otomatis.`,
    metadata: { slot: kunciSlot, sandiDiganti: Boolean(sandiBaru), olehSiapa: String(olehSiapa || "") },
  });

  return { ok: true, alasan: "" };
}

/** Menghapus simpanan satu slot. */
function hapus({ slot = "", olehSiapa = "" } = {}) {
  const kunciSlot = slotUntukMenulis(slot);
  if (!kunciSlot) return { ok: false, alasan: "slot_tidak_sah" };

  const simpanan = bacaSimpanan();
  if (!simpanan[kunciSlot]) return { ok: true, alasan: "tidak_ada_yang_dihapus" };

  delete simpanan[kunciSlot];
  try {
    tulisSimpanan(simpanan);
  } catch (error) {
    return { ok: false, alasan: `gagal_menulis: ${error.message}` };
  }

  void logService.logSecurityEvent({
    eventType: "ecourt_kredensial_dihapus",
    severity: "warning",
    message: `Simpanan sandi akun e-Court slot ${kunciSlot} dihapus.`,
    metadata: { slot: kunciSlot, olehSiapa: String(olehSiapa || "") },
  });

  return { ok: true, alasan: "" };
}

/**
 * Membuka surel dan sandi satu slot.
 *
 * HANYA untuk ecourtLoginService, tepat sebelum mengetikkannya ke formulir
 * e-Court. Tidak ada rute gateway yang memanggil ini, dan tidak boleh ada.
 */
function ambil(slot = "") {
  const kunciSlot = sesiEcourt.bersihkanSlot(slot);
  if (!kunciSlot) return null;

  const simpanan = bacaSimpanan();
  const baris = simpanan[kunciSlot];
  if (!baris || !baris.email) return null;

  const sandi = baris.sandi ? bukaSandi(baris.sandi) : "";
  if (!sandi) return null;

  return { email: String(baris.email), sandi };
}

/**
 * Slot mana saja yang punya simpanan - TANPA sandinya.
 *
 * Inilah yang boleh dilihat portal.
 */
function daftar() {
  const simpanan = bacaSimpanan();
  return Object.entries(simpanan).map(([slot, baris]) => ({
    slot,
    email: String((baris && baris.email) || ""),
    adaSandi: Boolean(baris && baris.sandi),
    diperbaruiPada: String((baris && baris.diperbaruiPada) || ""),
  }));
}

/** Apakah slot ini siap dipakai untuk pengisian otomatis? */
function siapOtomatis(slot = "") {
  const kunciSlot = sesiEcourt.bersihkanSlot(slot);
  if (!kunciSlot) return false;
  const simpanan = bacaSimpanan();
  const baris = simpanan[kunciSlot];
  return Boolean(baris && baris.email && baris.sandi);
}

/** Keadaan simpanan untuk layar pengaturan. */
function keadaan() {
  const folder = folderSimpanan();
  let izinKunci = "";
  try {
    if (fs.existsSync(jalurKunci())) {
      izinKunci = (fs.statSync(jalurKunci()).mode & 0o777).toString(8);
    }
  } catch {
    izinKunci = "";
  }

  return {
    folder,
    adaKunci: fs.existsSync(jalurKunci()),
    izinKunci,
    // Izin POSIX tidak berlaku di Windows. Disebutkan supaya tidak disangka
    // terlindungi padahal tidak.
    izinBerlaku: process.platform !== "win32",
    jumlahTersimpan: daftar().length,
  };
}

module.exports = {
  ambil,
  slotUntukMenulis,
  bukaSandi,
  daftar,
  hapus,
  keadaan,
  sandikan,
  simpan,
  siapOtomatis,
};
