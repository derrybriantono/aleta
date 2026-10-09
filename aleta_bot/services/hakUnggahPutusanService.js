"use strict";

/**
 * ============================================================================
 * HAK UNGGAH PUTUSAN - LAPIS KEDUA DI GERBANG BOT (keputusan 9 Okt 2026)
 * ============================================================================
 *
 * "untuk putusan itu hanya bisa dilakukan oleh superadmin, admin dan hakim,
 * yang lain tidak boleh upload putusan ke sipp".
 *
 * Penjagaan UTAMA ada di rute portal (pastikanBolehUnggahPutusan di
 * manajemen_surat/src/server/modules/aleta-ecourt/akses.ts): hanya portal yang
 * tahu siapa yang login. Portal meneruskan PERAN yang memberinya hak itu
 * sebagai `peranPenekan`, dan rute bot yang MENULIS putusan - ke SIPP
 * (/sipp/putusan-unggah, /sidang/putus) maupun ke e-Court
 * (/ecourt-putusan/unggah) - menolak 403 bila peran itu kosong atau di luar
 * daftar. Gunanya: rute portal baru yang lupa memeriksa tetap tertahan di sini,
 * bukan diam-diam menulis putusan atas nama PP atau juru sita.
 *
 * Ketua dan Wakil Ketua termasuk: keduanya hakim yang mengetuai majelis.
 */
const PERAN_BOLEH_UNGGAH_PUTUSAN = Object.freeze(["super-admin", "admin", "hakim", "ketua", "wakil-ketua"]);

const PESAN_TOLAK =
  "Unggah putusan ke SIPP dan e-Court hanya untuk Hakim, Admin, dan Super Admin. Peran Anda tidak diberi hak ini.";

/**
 * { ok: true, peran } atau { ok: false, status: 403, alasan, pesan }.
 * `badan` = req.body; yang dibaca hanya badan.peranPenekan.
 */
function periksaHakUnggahPutusan(badan) {
  const peran = String((badan && badan.peranPenekan) || "")
    .trim()
    .toLowerCase();
  if (!peran) {
    return { ok: false, status: 403, alasan: "peran_penekan_tidak_disebut", pesan: PESAN_TOLAK };
  }
  if (!PERAN_BOLEH_UNGGAH_PUTUSAN.includes(peran)) {
    return { ok: false, status: 403, alasan: "peran_tidak_boleh_unggah_putusan", pesan: PESAN_TOLAK };
  }
  return { ok: true, peran };
}

module.exports = { PERAN_BOLEH_UNGGAH_PUTUSAN, PESAN_TOLAK, periksaHakUnggahPutusan };
