"use strict";

/**
 * Menghitung sisa waktu mengajukan banding.
 *
 * Ini satu-satunya informasi di seluruh layanan ALETA yang HANGUS bila
 * terlambat. Pihak yang kehilangan hak bandingnya karena tidak tahu tenggang
 * waktunya tidak dapat diperbaiki setelahnya — berbeda dari informasi lain yang
 * kalau terlambat hanya merepotkan.
 *
 * ATURAN YANG DIPAKAI mengikuti cara pengadilan sendiri mencatatnya di SIPP:
 * tenggang 14 hari dihitung sejak putusan DIUCAPKAN bagi pihak yang hadir pada
 * pembacaan putusan, dan sejak putusan DIBERITAHUKAN bagi pihak yang tidak
 * hadir. Kolom `dihadiri_oleh` pada data putusan menentukan pihak mana yang
 * memerlukan pemberitahuan, dan tanggalnya diambil dari catatan pemberitahuan
 * putusan per pihak.
 *
 * BATAS YANG HARUS DIJAGA: angka ini adalah PERKIRAAN untuk membantu pihak
 * mengingat, bukan penetapan resmi. Yang berlaku tetap catatan pengadilan.
 * Karena akibat kekeliruannya berat, setiap tampilan wajib menyatakan itu, dan
 * bila tanggal acuannya belum jelas modul ini memilih TIDAK menampilkan angka
 * sama sekali daripada menampilkan angka yang bisa keliru.
 */

/** Tenggang banding perkara perdata. */
const APPEAL_DAYS = 14;

/**
 * Arti kolom `dihadiri_oleh` pada data putusan, dibaca dari cara SIPP dipakai:
 *   4 - kedua pihak tidak hadir, keduanya perlu diberitahu
 *   3 - pihak 1 tidak hadir
 *   2 - pihak 2 tidak hadir
 *   selain itu - kedua pihak hadir saat putusan dibacakan
 */
function partyNeedsNotification(dihadiriOleh, pihakKe) {
  const kode = Number(dihadiriOleh);
  const pihak = String(pihakKe || "").trim();
  const pihakSatu = pihak === "1" || pihak.toLowerCase() === "p";
  const pihakDua = pihak === "2" || pihak.toLowerCase() === "t";

  if (kode === 4) return true;
  if (kode === 3) return pihakSatu;
  if (kode === 2) return pihakDua;

  // Kode lain — termasuk kosong atau belum diisi — diperlakukan sebagai HADIR,
  // sehingga tenggang dihitung sejak putusan dibacakan. Ini pilihan yang
  // disengaja ke arah yang lebih AMAN: bila ternyata pihaknya tidak hadir,
  // tenggang sebenarnya justru lebih panjang, dan yang terjadi hanyalah orang
  // datang lebih awal ke PTSP. Sebaliknya bila kita menebak ke arah yang lebih
  // longgar lalu keliru, haknya benar-benar hilang. Karena itu setiap tampilan
  // wajib menyertakan bahwa angkanya perkiraan dan meminta memastikan ke PTSP.
  return false;
}

function toIsoDate(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(fromIso, toIso) {
  const a = new Date(`${fromIso}T00:00:00Z`).getTime();
  const b = new Date(`${toIso}T00:00:00Z`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86400000);
}

/**
 * Menghitung tenggang banding untuk SATU pihak.
 *
 * @returns {{status: string, ...}} status menentukan apa yang layak ditampilkan:
 *   "belum_putus"      - belum ada putusan
 *   "sudah_bht"        - sudah berkekuatan hukum tetap, tenggang tidak berlaku lagi
 *   "menunggu_beritahu"- pihak tidak hadir dan belum diberitahu; hitungan belum mulai
 *   "berjalan"         - tenggang sedang berjalan, ada sisa hari
 *   "habis"            - tenggang sudah lewat
 */
function computeAppealDeadline({
  tanggalPutusan = "",
  tanggalBht = "",
  dihadiriOleh = null,
  tanggalPemberitahuan = "",
  pihakKe = "",
  today = new Date(),
} = {}) {
  const putusan = toIsoDate(tanggalPutusan);
  const hariIni = toIsoDate(today);

  if (!putusan) return { status: "belum_putus" };
  if (toIsoDate(tanggalBht)) return { status: "sudah_bht", tanggalBht: toIsoDate(tanggalBht) };

  const perluDiberitahu = partyNeedsNotification(dihadiriOleh, pihakKe);
  const pemberitahuan = toIsoDate(tanggalPemberitahuan);

  // Pihak yang tidak hadir dan belum diberitahu: hitungannya BELUM dimulai.
  // Menampilkan angka di sini akan menyesatkan ke dua arah sekaligus.
  if (perluDiberitahu && !pemberitahuan) {
    return { status: "menunggu_beritahu", tanggalPutusan: putusan };
  }

  const mulai = perluDiberitahu ? pemberitahuan : putusan;
  const batas = addDays(mulai, APPEAL_DAYS);
  const sisa = daysBetween(hariIni, batas);
  if (sisa === null) return { status: "belum_putus" };

  return {
    status: sisa >= 0 ? "berjalan" : "habis",
    dasar: perluDiberitahu ? "pemberitahuan" : "putusan",
    tanggalMulai: mulai,
    tanggalBatas: batas,
    sisaHari: sisa,
  };
}

module.exports = {
  APPEAL_DAYS,
  addDays,
  computeAppealDeadline,
  daysBetween,
  partyNeedsNotification,
};
