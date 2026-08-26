"use strict";

/**
 * Sesi peramban e-Court yang bertahan antar penjalanan.
 *
 * ============================================================================
 * MASALAH YANG DISELESAIKAN
 * ============================================================================
 *
 * Sebelum ini, tiap kali jembatan dijalankan peramban dibuka bersih: cookie
 * kosong, sesi kosong, dan petugas harus mengetik email, sandi, serta captcha
 * dari awal. Untuk pekerjaan yang idealnya dijalankan tiap hari, itu beban
 * yang membuat orang berhenti menjalankannya.
 *
 * Dengan userDataDir, peramban memakai folder profil yang sama setiap kali.
 * Cookie dan sesi yang sudah ada tetap tersimpan, sehingga selama sesi
 * e-Court belum kedaluwarsa, penjalanan berikutnya langsung masuk tanpa
 * login lagi.
 *
 * ============================================================================
 * YANG TIDAK DILAKUKAN, DAN KENAPA
 * ============================================================================
 *
 * Captcha tetap diisi manusia. Yang disimpan di sini adalah HASIL login yang
 * sudah dilakukan petugas sendiri - bukan cara melewati captcha, dan bukan
 * sandi yang disimpan lalu diketikkan ulang oleh program.
 *
 * Sesi e-Court tetap punya masa berlaku dan akan habis sendiri. Bila itu
 * terjadi, jembatan meminta login manual sekali lagi seperti biasa. Tidak ada
 * upaya memperpanjang sesi secara paksa.
 *
 * ============================================================================
 * FOLDER INI BERISI KREDENSIAL
 * ============================================================================
 *
 * Isi folder profil setara dengan "sedang login" di komputer itu. Siapa pun
 * yang dapat membacanya dapat masuk sebagai petugas tersebut ke sistem
 * Mahkamah Agung.
 *
 * Karena itu foldernya:
 *   - dibuat dengan izin 0700 (hanya pemiliknya yang dapat membaca)
 *   - berada di luar folder aplikasi supaya tidak ikut terpaket installer
 *   - tidak boleh ikut dicadangkan bersama kode
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

/**
 * Letak folder profil.
 *
 * Sengaja TIDAK di dalam folder aplikasi: paket installer dan pencadangan
 * kode mengambil isi folder aplikasi, dan sesi login pengadilan tidak boleh
 * ikut tersalin ke mana-mana.
 */
function sessionDir() {
  const dariEnv = String(process.env.ALETA_ECOURT_SESSION_DIR || "").trim();
  if (dariEnv) return path.resolve(dariEnv);
  return path.join(os.homedir(), ".aleta-ecourt-session");
}

/**
 * Menyiapkan folder profil dan mengembalikan letaknya.
 *
 * Kegagalan membuat folder TIDAK menghentikan jembatan: kalau profil tidak
 * dapat dipakai, peramban dibuka bersih dan petugas login manual seperti
 * sebelumnya. Kehilangan kemudahan jauh lebih ringan daripada jembatan yang
 * menolak jalan sama sekali.
 *
 * @returns {{ ok: boolean, dir: string, alasan: string }}
 */
function ensureSessionDir() {
  const dir = sessionDir();
  try {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    // mkdir tidak mengubah izin folder yang sudah ada, jadi ditegaskan lagi.
    try {
      fs.chmodSync(dir, 0o700);
    } catch {
      // Windows tidak mengenal izin POSIX; diabaikan dengan sengaja.
    }
    return { ok: true, dir, alasan: "" };
  } catch (error) {
    return { ok: false, dir: "", alasan: String(error.message || error) };
  }
}

/** Apakah profil ini sudah pernah dipakai login? */
function sessionExists() {
  const dir = sessionDir();
  try {
    return fs.existsSync(path.join(dir, "Default"));
  } catch {
    return false;
  }
}

/**
 * Menghapus sesi tersimpan.
 *
 * Dipakai bila petugas berganti akun, atau bila komputernya akan diserahkan
 * ke orang lain. Ini satu-satunya cara "logout" yang benar - menghapus
 * jejaknya, bukan sekadar menutup peramban.
 */
function clearSession() {
  const dir = sessionDir();
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    return { ok: true, alasan: "" };
  } catch (error) {
    return { ok: false, alasan: String(error.message || error) };
  }
}

/**
 * Pilihan peluncuran peramban, sudah termasuk profil yang bertahan.
 *
 * @param {{ headless?: boolean }} opsi
 */
function launchOptions({ headless = false } = {}) {
  const opsi = {
    headless,
    defaultViewport: null,
    args: ["--start-maximized", "--no-sandbox"],
  };

  const sesi = ensureSessionDir();
  if (sesi.ok) opsi.userDataDir = sesi.dir;
  return { opsi, sesi };
}

module.exports = { clearSession, ensureSessionDir, launchOptions, sessionDir, sessionExists };
