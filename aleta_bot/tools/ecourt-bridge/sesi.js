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
/**
 * Nama slot bawaan.
 *
 * Pemasangan yang hanya punya satu akun tidak perlu tahu bahwa slot itu ada -
 * seluruh pemanggil yang tidak menyebut slot mendapat yang ini.
 */
const SLOT_BAWAAN = "utama";

/**
 * Membersihkan nama slot.
 *
 * Nama slot menjadi bagian JALUR FOLDER. Nama seperti "../../etc" akan membuat
 * profil peramban ditulis di luar folder sesi, dan clearSession menghapus
 * folder di luar sana. Karena itu hanya huruf kecil, angka, dan tanda hubung
 * yang diterima - sisanya jatuh ke slot bawaan.
 */
function bersihkanSlot(slot) {
  const nama = String(slot || "").trim().toLowerCase();
  if (!/^[a-z0-9-]{1,32}$/.test(nama)) return SLOT_BAWAAN;
  return nama;
}

/** Folder induk seluruh slot. */
function sessionRoot() {
  const dariEnv = String(process.env.ALETA_ECOURT_SESSION_DIR || "").trim();
  if (dariEnv) return path.resolve(dariEnv);
  return path.join(os.homedir(), ".aleta-ecourt-session");
}

/**
 * Letak folder profil satu slot.
 *
 * Tiap akun memakai folder sendiri. Profil peramban hanya dapat dipakai satu
 * proses pada satu waktu - dua akun berbagi satu folder berarti keduanya saling
 * menimpa sesi, dan yang terjadi bukan bergiliran melainkan saling
 * mengeluarkan.
 */
function sessionDir(slot) {
  return path.join(sessionRoot(), bersihkanSlot(slot));
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
function ensureSessionDir(slot) {
  const dir = sessionDir(slot);
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
function sessionExists(slot) {
  const dir = sessionDir(slot);
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
function clearSession(slot) {
  const dir = sessionDir(slot);
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    return { ok: true, alasan: "" };
  } catch (error) {
    return { ok: false, alasan: String(error.message || error) };
  }
}

/**
 * Membuang kunci profil Chromium yang tertinggal.
 *
 * ============================================================================
 * SERVER DIMATIKAN MENDADAK = KUNCI TERTINGGAL
 * ============================================================================
 *
 * Chromium menaruh SingletonLock (tautan simbolik bernama "namaHost-pid"),
 * SingletonCookie dan SingletonSocket di folder profil. Bila server dimatikan
 * tanpa menutup peramban, ketiganya tertinggal di volume. Pada penyalaan
 * berikutnya Chromium membaca "profil sedang dipakai proses lain" dan menolak
 * terbuka - SETIAP penarikan dan login e-Court gagal, padahal cookie sesinya
 * sendiri masih utuh. Gejalanya tampak seperti sesi hilang.
 *
 * Kunci dianggap tertinggal HANYA bila: nama host-nya beda dengan mesin ini
 * (container dibuat ulang), atau prosesnya sudah tidak ada, atau prosesnya
 * ada tetapi bukan Chromium (nomor proses dipakai ulang oleh proses lain
 * setelah container dinyalakan lagi). Kunci milik peramban yang benar-benar
 * hidup tidak pernah disentuh.
 *
 * @returns {{ dibuang: string[], alasan: string }}
 */
function bersihkanKunciUsang(dir, opsi = {}) {
  const namaHost = opsi.namaHost || os.hostname();
  const pidHidup = opsi.pidHidup || pidChromiumHidup;
  const nama = ["SingletonLock", "SingletonCookie", "SingletonSocket"];
  const jalurKunci = path.join(dir, "SingletonLock");

  let sasaran = null;
  try {
    sasaran = fs.readlinkSync(jalurKunci);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      // Tanpa kunci utama, sisa dua lainnya pun tidak berguna - buang bila ada.
      sasaran = null;
      let adaSisa = false;
      for (const n of nama) {
        try {
          fs.lstatSync(path.join(dir, n));
          adaSisa = true;
        } catch {
          /* tidak ada */
        }
      }
      if (!adaSisa) return { dibuang: [], alasan: "" };
    } else {
      // Bukan tautan (berkas biasa) atau tidak terbaca: perlakukan sebagai sisa.
      sasaran = "";
    }
  }

  let usang = false;
  let alasan = "";
  if (sasaran === null || sasaran === "") {
    usang = true;
    alasan = "kunci_tanpa_penunjuk";
  } else {
    const cocok = String(sasaran).match(/^(.*)-(\d+)$/);
    if (!cocok) {
      usang = true;
      alasan = "penunjuk_tak_dikenali";
    } else if (cocok[1] !== namaHost) {
      usang = true;
      alasan = "host_berbeda";
    } else if (!pidHidup(Number(cocok[2]))) {
      usang = true;
      alasan = "proses_tidak_ada";
    }
  }
  if (!usang) return { dibuang: [], alasan: "" };

  const dibuang = [];
  for (const n of nama) {
    const target = path.join(dir, n);
    try {
      fs.lstatSync(target);
      fs.unlinkSync(target);
      dibuang.push(n);
    } catch {
      /* tidak ada atau tidak dapat dibuang: Chromium sendiri yang akan menolak */
    }
  }
  return { dibuang, alasan };
}

/** Apakah pid ini proses Chromium yang hidup? (Linux membaca /proc; lainnya: ada saja.) */
function pidChromiumHidup(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
  } catch (error) {
    // EPERM berarti ada tetapi bukan milik kita - tetap hidup.
    if (!error || error.code !== "EPERM") return false;
  }
  try {
    const nama = fs.readFileSync(`/proc/${pid}/comm`, "utf8").trim().toLowerCase();
    return nama.includes("chrom");
  } catch {
    // Tanpa /proc (Windows/macOS) tidak dapat dibedakan: anggap hidup, jangan merusak.
    return true;
  }
}

/**
 * Pilihan peluncuran peramban, sudah termasuk profil yang bertahan.
 *
 * @param {{ headless?: boolean }} opsi
 */
function launchOptions({ headless = false, slot = SLOT_BAWAAN } = {}) {
  // Mode kembaran (laptop): e-Court adalah sistem Mahkamah Agung - peramban tidak dibuka dari sini.
  require("../../services/kembaranMode").tolakBilaKembaran("e-Court");
  const opsi = {
    headless,
    defaultViewport: null,
    args: ["--start-maximized", "--no-sandbox"],
    // Berkas perkara kerap berukuran satu sampai dua megabita, dan
    // pengunduhan berjalan DI DALAM halaman supaya cookie sesi ikut
    // terbawa. Pada jaringan pengadilan yang lambat, satu berkas dapat
    // melewati batas bawaan Puppeteer (180 detik) - dan yang terlihat
    // hanyalah pesan Runtime.callFunctionOn timed out, yang tidak
    // menjelaskan apa pun tentang berkas mana atau mengapa.
    protocolTimeout: Number(process.env.ALETA_ECOURT_PROTOCOL_TIMEOUT_MS || 300000),
  };

  const sesi = ensureSessionDir(slot);
  if (sesi.ok) {
    opsi.userDataDir = sesi.dir;
    // Sisa kunci dari penutupan mendadak jangan sampai memblokir peluncuran.
    try {
      bersihkanKunciUsang(sesi.dir);
    } catch {
      /* pembersihan gagal bukan alasan membatalkan peluncuran */
    }
  }
  return { opsi, sesi };
}

module.exports = {
  SLOT_BAWAAN,
  bersihkanSlot,
  bersihkanKunciUsang,
  clearSession,
  ensureSessionDir,
  launchOptions,
  sessionDir,
  sessionExists,
  sessionRoot,
};
