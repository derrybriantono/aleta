"use strict";

/**
 * ============================================================================
 * JAM KERJA SATKER - SATU TEMPAT (keputusan pengguna 104, 18 Okt 2026)
 * ============================================================================
 *
 * Tulisan ke basis data SIPP dibaca pusat. Petugas PA Donggala tidak pernah
 * menginput penetapan di luar jam kerja atau pada Sabtu/Minggu (audit pola 18
 * Okt 2026: 0 dari 883 perkara 2026), sedangkan ALETA tercatat menulis pukul
 * 03.18 dan 06.02 WITA. Karena itu tulisan OTOMATIS yang jatuh di luar jam
 * kerja diantrekan (antreanTulisSippService), dan tulisan MANUAL di luar jam
 * kerja ditanyakan dulu: antrekan (bawaan) atau tulis sekarang.
 *
 * Jam kerja (WITA, jam dinding satker - BUKAN jam SIPP):
 *
 *   Senin-Kamis  07.30 - 16.00
 *   Jumat        07.30 - 16.30
 *   Sabtu/Minggu dan hari libur: tidak ada
 *
 * ZONA. SIPP menulis cap waktunya dengan PHP Asia/Jakarta (WIB, terukur di
 * server 13 Okt 2026 - penetapanTulisService.waktuSipp), basis data dan
 * container ALETA berzona WITA (Asia/Makassar). Seluruh fungsi di berkas ini
 * bekerja dalam WITA; jam SIPP untuk batas yang sama = WITA - 60 menit.
 *
 * HARI LIBUR. Bukan daftar baru. Fungsi penyedia libur DISUNTIKKAN
 * (`setelPenyediaLibur`) - bawaannya hariLiburService yang sudah ada.
 * TODO sambungan: bila sumber tunggal daftar libur dari branch
 * fitur/libur-penetapan digabung, panggil setelPenyediaLibur(fungsinya) di
 * sini satu kali (fungsi (tanggalIso) => truthy bila libur).
 */

const ZONA_SATKER = "Asia/Makassar";
const MENIT_MULAI = 7 * 60 + 30;
const MENIT_AKHIR = { biasa: 16 * 60, jumat: 16 * 60 + 30 };
/** Selisih jam SIPP (WIB) terhadap jam satker (WITA), menit. */
const SELISIH_SIPP_MENIT = -60;

let penyediaLibur = null;

function liburBawaan(tanggal) {
  try {
    return require("./hariLiburService").hariLibur(tanggal);
  } catch {
    return null;
  }
}

/** Sambungan ke sumber tunggal daftar libur. null = kembali ke bawaan. */
function setelPenyediaLibur(fungsi) {
  penyediaLibur = typeof fungsi === "function" ? fungsi : null;
}

function liburkah(tanggal, libur) {
  const f = typeof libur === "function" ? libur : penyediaLibur || liburBawaan;
  return Boolean(f(tanggal));
}

const POLA = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/;

function urai(teks) {
  const m = POLA.exec(String(teks || ""));
  if (!m) return null;
  return { t: +m[1], b: +m[2], h: +m[3], jam: +(m[4] || 0), menit: +(m[5] || 0), detik: +(m[6] || 0) };
}

const p2 = (n) => String(n).padStart(2, "0");

/** Hari dalam pekan (0 Minggu .. 6 Sabtu) tanggal ISO, tanpa zona. */
function hariPekan(tanggal) {
  const u = urai(tanggal);
  return u ? new Date(Date.UTC(u.t, u.b - 1, u.h)).getUTCDay() : NaN;
}

function tambahHari(tanggal, n) {
  const u = urai(tanggal);
  const d = new Date(Date.UTC(u.t, u.b - 1, u.h + n));
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
}

/** Hari kerja: bukan Sabtu/Minggu dan bukan hari libur. */
function hariKerja(tanggal, { libur } = {}) {
  const hari = hariPekan(tanggal);
  if (!Number.isFinite(hari) || hari === 0 || hari === 6) return false;
  return !liburkah(String(tanggal).slice(0, 10), libur);
}

/** [menit mulai, menit akhir] jam kerja pada tanggal itu (WITA); null bila bukan hari kerja. */
function rentangKerja(tanggal, opsi = {}) {
  if (!hariKerja(tanggal, opsi)) return null;
  return [MENIT_MULAI, hariPekan(tanggal) === 5 ? MENIT_AKHIR.jumat : MENIT_AKHIR.biasa];
}

/** "YYYY-MM-DD HH:mm:ss" WITA sekarang (atau dari milidetik UTC). */
function sekarangSatker(ms = Date.now()) {
  const bagian = {};
  for (const p of new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_SATKER,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms))) {
    bagian[p.type] = p.value;
  }
  return `${bagian.year}-${bagian.month}-${bagian.day} ${bagian.hour}:${bagian.minute}:${bagian.second}`;
}

/** Apakah waktu WITA itu di dalam jam kerja? */
function dalamJamKerja(waktu, opsi = {}) {
  const u = urai(waktu);
  if (!u) return false;
  const tanggal = String(waktu).slice(0, 10);
  const r = rentangKerja(tanggal, opsi);
  if (!r) return false;
  const menit = u.jam * 60 + u.menit;
  return menit >= r[0] && menit < r[1];
}

/**
 * Awal jam kerja berikutnya (WITA) sesudah `waktu`. Bila `waktu` sudah di
 * dalam jam kerja, dipulangkan apa adanya. Hari libur dan akhir pekan
 * dilewati; paling jauh 60 hari ke depan.
 */
function jamKerjaBerikutnya(waktu, opsi = {}) {
  const u = urai(waktu);
  if (!u) return "";
  const teks = `${String(waktu).slice(0, 10)} ${p2(u.jam)}:${p2(u.menit)}:${p2(u.detik)}`;
  if (dalamJamKerja(teks, opsi)) return teks;
  let tanggal = teks.slice(0, 10);
  const menit = u.jam * 60 + u.menit;
  const hariIni = rentangKerja(tanggal, opsi);
  if (!(hariIni && menit < hariIni[0])) tanggal = tambahHari(tanggal, 1);
  for (let i = 0; i < 60; i += 1) {
    if (rentangKerja(tanggal, opsi)) return `${tanggal} ${p2(Math.floor(MENIT_MULAI / 60))}:${p2(MENIT_MULAI % 60)}:00`;
    tanggal = tambahHari(tanggal, 1);
  }
  return "";
}

const NAMA_HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/** Kalimat awam: "Senin, 20 Oktober 2026 pukul 07.30". */
function sebutWaktu(waktu) {
  const u = urai(waktu);
  if (!u) return "";
  return `${NAMA_HARI[hariPekan(waktu)]}, ${u.h} ${NAMA_BULAN[u.b - 1]} ${u.t} pukul ${p2(u.jam)}.${p2(u.menit)}`;
}

/** Kalimat untuk layar/widget saat tulisan diantrekan. */
function kalimatDiantrekan(waktu) {
  const s = sebutWaktu(waktu);
  return s
    ? `Di luar jam kerja - diantrekan, dikerjakan ${s} WITA.`
    : "Di luar jam kerja - diantrekan, dikerjakan pada jam kerja berikutnya.";
}

/** Batas jam kerja dalam jam SIPP (WIB), detik sejak tengah malam - untuk mesin jam penetapan. */
function rentangKerjaSipp(tanggalSipp, opsi = {}) {
  const r = rentangKerja(tanggalSipp, opsi) || [MENIT_MULAI, MENIT_AKHIR.biasa];
  return [(r[0] + SELISIH_SIPP_MENIT) * 60, (r[1] + SELISIH_SIPP_MENIT) * 60];
}

module.exports = {
  ZONA_SATKER,
  MENIT_MULAI,
  MENIT_AKHIR,
  SELISIH_SIPP_MENIT,
  setelPenyediaLibur,
  hariKerja,
  rentangKerja,
  rentangKerjaSipp,
  sekarangSatker,
  dalamJamKerja,
  jamKerjaBerikutnya,
  sebutWaktu,
  kalimatDiantrekan,
  tambahHari,
};
