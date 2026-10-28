"use strict";

/**
 * ============================================================================
 * AKUN KASIR SIPP - SATU AKUN UNTUK SEMUA TULISAN KASIR ALETA (28 Okt 2026)
 * ============================================================================
 *
 * Keputusan pengguna: jurnal yang ditulis Kasir ALETA (Kasir otomatis, Kasir
 * Manual satu hari, "Jalankan sekarang") SELALU tercatat di SIPP atas AKUN
 * KASIR - kolom diinput_oleh baris jurnal dan sys_audittrail memakai akun itu -
 * siapa pun pengguna ALETA yang menekan tombolnya. Pengguna ALETA yang
 * menekan hanya tercatat di jejak ALETA (aleta_bot_jejak_penetapan.operator).
 * Pola yang sama dengan penetapan PMH/PPP/PJS/PHS (penetapanTulisService
 * .akunPejabatPasti): akun dipastikan di sys_users, tidak diblokir, tidak
 * kedaluwarsa - tidak ada jalan jatuh ke akun yang sedang masuk.
 *
 * Akun kasir DITENTUKAN DARI SIPP: pengguna yang tergabung di grup Kasir
 * (sys_user_group.groupid = 702, sama dengan GRUP_JABATAN evidenSkpJabatan)
 * dan masih aktif.
 *   - tepat satu     -> itu akunnya;
 *   - lebih dari satu -> Super Admin/admin memilih sekali (disimpan di basis
 *                       data ALETA bot, aleta_bot_kasir_akun); tanpa pilihan
 *                       TIDAK ada yang ditulis;
 *   - tidak ada      -> TIDAK ada yang ditulis; pesan jelas.
 * Pilihan yang akunnya tak lagi hidup/anggota grup Kasir diabaikan.
 */

const GRUP_KASIR = 702;
const TABEL = "aleta_bot_kasir_akun";

function bersih(nilai) {
  return String(nilai === null || nilai === undefined ? "" : nilai).trim();
}

function akunHidup(baris) {
  if (!baris) return false;
  if (String(baris.block ?? "0") !== "0") return false;
  const habis = baris.kedaluwarsa ? new Date(baris.kedaluwarsa) : null;
  return !(habis instanceof Date && !Number.isNaN(habis.valueOf()) && habis.valueOf() < Date.now());
}

const PESAN = Object.freeze({
  akun_kasir_tidak_ada: "Belum ada akun kasir di SIPP (pengguna grup Kasir yang aktif) - Kasir ALETA tidak menulis apa pun. Tambahkan akun kasir di SIPP.",
  akun_kasir_belum_dipilih: "Ada lebih dari satu akun kasir di SIPP - Super Admin atau admin memilih akun yang dipakai Kasir ALETA dulu.",
});

function buatLayanan(deps = {}) {
  const kueri =
    deps.kueri ||
    ((sql, params = []) =>
      new Promise((selesai, gagal) => {
        require("../db_config").query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil)));
      }));
  const kueriAleta =
    deps.kueriAleta ||
    ((sql, params = []) =>
      new Promise((selesai, gagal) => {
        require("../bot_db_config").query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil)));
      }));

  let siap = null;
  function pastikanTabel() {
    if (siap) return siap;
    siap = kueriAleta(`
      CREATE TABLE IF NOT EXISTS ${TABEL} (
        id TINYINT UNSIGNED NOT NULL,
        username VARCHAR(60) NOT NULL DEFAULT '',
        diubah_oleh VARCHAR(120) NOT NULL DEFAULT '',
        diubah DATETIME NULL,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch((galat) => {
      siap = null;
      throw galat;
    });
    return siap;
  }

  /** Pengguna SIPP aktif di grup Kasir (urut username). */
  async function calon() {
    const baris = await kueri(
      `SELECT DISTINCT su.userid, su.username, su.fullname, su.block, su.user_expired AS kedaluwarsa
         FROM sys_users su JOIN sys_user_group ug ON ug.userid = su.userid
        WHERE ug.groupid = ?
        ORDER BY su.username ASC`,
      [GRUP_KASIR]
    );
    return (Array.isArray(baris) ? baris : [])
      .filter((b) => b && bersih(b.username) && akunHidup(b))
      .map((b) => ({ username: bersih(b.username), nama: bersih(b.fullname) }));
  }

  async function bacaPilihan() {
    await pastikanTabel();
    const baris = await kueriAleta(`SELECT username, diubah_oleh AS diubahOleh FROM ${TABEL} WHERE id = 1 LIMIT 1`, []);
    const b = Array.isArray(baris) && baris[0];
    return b ? { username: bersih(b.username), diubahOleh: bersih(b.diubahOleh) } : { username: "", diubahOleh: "" };
  }

  /**
   * Akun kasir yang berlaku.
   * @returns {Promise<{ ok: true, username, nama, calon, dipilih } | { ok: false, alasan, pesan, calon, dipilih }>}
   */
  async function tentukan() {
    let daftar;
    try {
      daftar = await calon();
    } catch (galat) {
      return { ok: false, alasan: "akun_kasir_tidak_terbaca", pesan: "Akun kasir SIPP tidak terbaca - Kasir ALETA tidak menulis apa pun.", calon: [], dipilih: "" };
    }
    const pilihan = await bacaPilihan().catch(() => ({ username: "", diubahOleh: "" }));
    const dipilih = daftar.find((c) => c.username === pilihan.username) || null;
    if (dipilih) return { ok: true, username: dipilih.username, nama: dipilih.nama, calon: daftar, dipilih: dipilih.username };
    if (daftar.length === 1) return { ok: true, username: daftar[0].username, nama: daftar[0].nama, calon: daftar, dipilih: "" };
    const alasan = daftar.length === 0 ? "akun_kasir_tidak_ada" : "akun_kasir_belum_dipilih";
    return { ok: false, alasan, pesan: PESAN[alasan], calon: daftar, dipilih: "" };
  }

  /** Super Admin/admin memilih (hak diperiksa rute portal). Hanya anggota grup Kasir yang aktif. */
  async function simpanPilihan(minta = {}) {
    const operator = bersih(minta.operator).slice(0, 120);
    if (!operator) return { ok: false, alasan: "operator_tidak_disebut" };
    const username = bersih(minta.username);
    const daftar = await calon();
    if (username && !daftar.some((c) => c.username === username)) {
      return { ok: false, alasan: "akun_bukan_kasir", pesan: `Akun "${username.slice(0, 60)}" bukan pengguna grup Kasir yang aktif di SIPP.`, calon: daftar };
    }
    await pastikanTabel();
    await kueriAleta(
      `INSERT INTO ${TABEL} (id, username, diubah_oleh, diubah) VALUES (1, ?, ?, UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE username = VALUES(username), diubah_oleh = VALUES(diubah_oleh), diubah = UTC_TIMESTAMP()`,
      [username, operator]
    );
    return { ok: true, akun: await tentukan() };
  }

  return { calon, tentukan, simpanPilihan, bacaPilihan };
}

let bawaan = null;
function layananBawaan() {
  if (!bawaan) bawaan = buatLayanan();
  return bawaan;
}

module.exports = {
  GRUP_KASIR,
  TABEL,
  PESAN,
  akunHidup,
  buatLayanan,
  tentukan: () => layananBawaan().tentukan(),
  simpanPilihan: (minta) => layananBawaan().simpanPilihan(minta),
};
