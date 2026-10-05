"use strict";

/**
 * Akun e-Court MILIK SATU PENGGUNA ALETA, per peran (butir 20, 5 Okt 2026).
 *
 * ============================================================================
 * KENAPA ADA, PADAHAL SESI PRIBADI SUDAH ADA
 * ============================================================================
 *
 * Sejak 1 Okt (E10) tindakan tulis ke e-Court - verifikasi hakim, TTE
 * panitera, unggah salinan putusan - sudah memakai SESI pribadi orang yang
 * menekan tombolnya, tidak pernah akun penarik data. Tetapi sesi itu hanya
 * cookie: begitu e-Court memutusnya, hakim/panitera/PP/juru sita harus
 * mengetik ulang surel dan sandi e-Court-nya sendiri, padahal yang memang
 * harus diketik manusia hanyalah captcha. Pengguna lalu meminta akun e-Court
 * DISIMPAN per orang, seperti akun bersama di kartu "Akun e-Court" - supaya
 * yang mengunggah selalu akun orang yang sedang membuka ALETA/SIPP, dan
 * masuk ulang cukup dengan captcha.
 *
 * ============================================================================
 * YANG DISIMPAN DAN BAGAIMANA
 * ============================================================================
 *
 * Satu baris per (penggunaId, peran) di <sessionRoot>/pengguna/akun-pengguna.json
 * - folder yang sama dengan sesi pribadi, terpasang sebagai volume di server.
 * Surel DAN sandi disandi AES-256-GCM dengan kunci yang SAMA dengan simpanan
 * kredensial bersama (ecourtKredensialService.sandikan) - kunci di luar
 * folder aplikasi. Surel ikut disandi walau bukan rahasia: berkas ini memuat
 * daftar akun seluruh pegawai, dan salinan yang terbawa keluar tidak perlu
 * membawanya terbaca.
 *
 * ============================================================================
 * SANDI TIDAK PERNAH KELUAR DARI BOT
 * ============================================================================
 *
 * ambil() - satu-satunya yang membuka sandi - hanya dipanggil
 * ecourtSesiPenggunaService.kirimSambung tepat sebelum mengetikkannya ke
 * formulir login e-Court. Tidak ada rute gateway yang memanggilnya (dijaga
 * uji akun-ecourt-pengguna.test.ts). Daftar untuk layar tidak memuat sandi,
 * tersandi pun tidak. Log keamanan mencatat perbuatannya, bukan isinya.
 *
 * Yang TIDAK dilindungi penyandian ini sama dengan simpanan bersama: orang
 * yang sudah menguasai server (kunci dan berkasnya ada di mesin yang sama).
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const sesiEcourt = require("../tools/ecourt-bridge/sesi");

/** Peran e-Court - sama dengan sesi pribadi. Disalin, bukan diimpor, supaya tidak saling memuat. */
const PERAN_ECOURT = ["hakim", "panitera", "panitera-pengganti", "juru-sita", "lainnya"];

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
  return path.join(folder(), "akun-pengguna.json");
}

function kunci(penggunaId, peran) {
  return crypto.createHash("sha256").update(`akun|${penggunaId}|${peran}`).digest("hex").slice(0, 32);
}

function penyandi() {
  // Dimuat malas: modul kredensial membuat berkas kunci saat pertama dipakai.
  return require("./ecourtKredensialService");
}

function catatKeamanan(data) {
  try {
    void require("./logService").logSecurityEvent(data);
  } catch {
    /* jejak gagal tidak menggagalkan penyimpanan */
  }
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
    /* Windows tidak mengenal izin POSIX */
  }
}

function bukaSurel(baris) {
  return baris && baris.email ? penyandi().bukaSandi(baris.email) : "";
}

/** Baris untuk layar - TANPA sandi, tersandi pun tidak. */
function barisLayar(baris) {
  return {
    peran: baris.peran,
    email: bukaSurel(baris),
    adaSandi: Boolean(baris.sandi),
    diperbaruiPada: String(baris.diperbaruiPada || ""),
    diujiPada: String(baris.diujiPada || ""),
    hasilUji: String(baris.hasilUji || ""),
  };
}

/**
 * Menyimpan surel dan sandi akun e-Court milik penggunaId untuk satu peran.
 *
 * Sandi kosong mempertahankan sandi lama HANYA bila surelnya tidak berubah:
 * surel baru dengan sandi lama berarti mengetik sandi akun A ke akun B, dan
 * percobaan login berulang dengan sandi keliru dapat mengunci akun B.
 */
function simpan({ penggunaId, peran, namaPengguna = "", email = "", sandi = "", olehSiapa = "" } = {}) {
  const id = normalkanPengguna(penggunaId);
  const p = normalkanPeran(peran);
  if (!id || !p) return { ok: false, alasan: "pengguna_atau_peran_tidak_sah" };
  const surel = String(email || "").trim();
  if (!surel) return { ok: false, alasan: "email_kosong" };
  if (surel.length > 160) return { ok: false, alasan: "email_terlalu_panjang" };
  const sandiBaru = String(sandi || "");
  if (sandiBaru.length > 200) return { ok: false, alasan: "sandi_terlalu_panjang" };

  const semua = bacaSemua();
  const k = kunci(id, p);
  const lama = semua[k] || null;
  const surelLama = lama ? bukaSurel(lama) : "";
  let sandiTersandi = lama && lama.sandi ? lama.sandi : "";
  if (!sandiBaru) {
    if (!sandiTersandi) return { ok: false, alasan: "sandi_kosong" };
    if (surelLama.toLowerCase() !== surel.toLowerCase()) return { ok: false, alasan: "surel_berganti_sandi_wajib" };
  }
  try {
    if (sandiBaru) sandiTersandi = penyandi().sandikan(sandiBaru);
    semua[k] = {
      penggunaId: id,
      peran: p,
      namaPengguna: String(namaPengguna || (lama && lama.namaPengguna) || "").slice(0, 120),
      email: penyandi().sandikan(surel),
      sandi: sandiTersandi,
      diperbaruiPada: new Date().toISOString(),
      // Sandi atau surel berganti = hasil uji lama tidak berlaku lagi.
      diujiPada: sandiBaru || !lama ? "" : String(lama.diujiPada || ""),
      hasilUji: sandiBaru || !lama ? "" : String(lama.hasilUji || ""),
    };
    tulisSemua(semua);
  } catch (galat) {
    // Pesan galat sistem berkas tidak memuat sandi, tetapi tetap dipotong.
    return { ok: false, alasan: `gagal_menyimpan: ${String((galat && galat.code) || "galat")}` };
  }

  catatKeamanan({
    eventType: "ecourt_akun_pengguna_disimpan",
    severity: "warning",
    message: `Akun e-Court pribadi (${p}) pengguna ${id} disimpan.`,
    metadata: { penggunaId: id, peran: p, sandiDiganti: Boolean(sandiBaru), olehSiapa: String(olehSiapa || "") },
  });
  return { ok: true, alasan: "" };
}

function hapus({ penggunaId, peran, olehSiapa = "" } = {}) {
  const id = normalkanPengguna(penggunaId);
  const p = normalkanPeran(peran);
  if (!id || !p) return { ok: false, alasan: "pengguna_atau_peran_tidak_sah" };
  const semua = bacaSemua();
  const k = kunci(id, p);
  if (!semua[k]) return { ok: true, alasan: "tidak_ada_yang_dihapus" };
  delete semua[k];
  tulisSemua(semua);
  catatKeamanan({
    eventType: "ecourt_akun_pengguna_dihapus",
    severity: "warning",
    message: `Akun e-Court pribadi (${p}) pengguna ${id} dihapus.`,
    metadata: { penggunaId: id, peran: p, olehSiapa: String(olehSiapa || "") },
  });
  return { ok: true, alasan: "" };
}

/** Akun tersimpan milik SATU pengguna - untuk layar miliknya sendiri. */
function daftarMilik(penggunaId) {
  const id = normalkanPengguna(penggunaId);
  if (!id) return [];
  return Object.values(bacaSemua())
    .filter((b) => b && b.penggunaId === id)
    .map(barisLayar)
    .sort((a, b) => PERAN_ECOURT.indexOf(a.peran) - PERAN_ECOURT.indexOf(b.peran));
}

/** Seluruh akun tersimpan - untuk rekap admin. TANPA sandi. */
function daftarSemua() {
  return Object.values(bacaSemua())
    .filter((b) => b && b.penggunaId && b.peran)
    .map((b) => ({ penggunaId: b.penggunaId, namaPengguna: String(b.namaPengguna || ""), ...barisLayar(b) }));
}

function ada(penggunaId, peran) {
  const b = bacaSemua()[kunci(normalkanPengguna(penggunaId), normalkanPeran(peran))];
  return Boolean(b && b.email && b.sandi);
}

/**
 * Membuka surel dan sandi. HANYA untuk ecourtSesiPenggunaService.kirimSambung,
 * tepat sebelum diketikkan ke formulir login e-Court. Tidak ada rute yang
 * memanggilnya, dan tidak boleh ada.
 */
function ambil(penggunaId, peran) {
  const b = bacaSemua()[kunci(normalkanPengguna(penggunaId), normalkanPeran(peran))];
  if (!b || !b.email || !b.sandi) return null;
  const email = bukaSurel(b);
  const sandi = penyandi().bukaSandi(b.sandi);
  // Tanda keutuhan tidak cocok (berkas disunting / kunci berganti): berperilaku
  // seolah belum tersimpan - tidak ada percobaan login dengan sandi keliru.
  if (!email || !sandi) return null;
  return { email, sandi };
}

/** Hasil "Uji masuk" terakhir: berhasil | ditolak | gagal. */
function catatUji(penggunaId, peran, hasil) {
  const k = kunci(normalkanPengguna(penggunaId), normalkanPeran(peran));
  const semua = bacaSemua();
  if (!semua[k]) return false;
  semua[k].diujiPada = new Date().toISOString();
  semua[k].hasilUji = ["berhasil", "ditolak", "gagal"].includes(hasil) ? hasil : "gagal";
  tulisSemua(semua);
  return true;
}

module.exports = {
  PERAN_ECOURT,
  ada,
  ambil,
  catatUji,
  daftarMilik,
  daftarSemua,
  hapus,
  jalurSimpanan,
  simpan,
};
