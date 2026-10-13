"use strict";

/**
 * ============================================================================
 * DETEKSI WALI ADHOL (jenis_perkara_id 363)
 * ============================================================================
 *
 * Blangko Derry belum punya folder wali adhol; yang dipakai BAS
 * "3 BAS Putus Standar/42-a. BAS Putus Wali Adhal" dan blangko putusan_penetapan.
 * Variabelnya (isian hakim 2023-2026 di aps_badilag): 1029 calon suami, 1030
 * umur calon, 1014 eratnya hubungan, 1046 status wali, 1217 nama wali, 6087
 * alasan wali menolak, 3333 KUA kecamatan tempat menikah, 1002/1003 status
 * sebelum nikah, 1357 alasan wali (bila bukan ayah).
 *
 * Posita wali adhol PA Donggala 2019-2026 SATU templat:
 *   "Pemohon bermaksud akan melangsungkan pernikahan dengan seorang laki-laki
 *    pilihan yang bernama : X, umur N tahun, ..."
 *   "Pemohon dan calon suami telah menyampaikan maksud tersebut kepada ayah
 *    kandung Pemohon yang bernama W ..."
 *   "niat Pemohon tidak mendapatkan restu dari pihak ... karena <alasan>"
 *   "akan segera melangsungkan pernikahan di Desa D, Kecamatan K, Kabupaten B"
 *
 * Tidak dideteksi: 1002/1003 (status sebelum nikah - posita tidak menyebutnya
 * kecuali sesekali, ukurannya 0), 1357 (bentuk isiannya beragam: kosong,
 * "karena ayah kandung sudah meninggal dunia"), 1262 alat bukti (e-Court).
 */

const B = require("./bantuAnak");
const wilayah = require("./wilayah");

const variabel = Object.freeze([
  { kode: "1029", nama: "Nama calon suami", sumber: "posita", blangko: ["bas", "putusan"] },
  { kode: "1030", nama: "Umur calon suami", sumber: "posita", blangko: ["bas", "putusan"] },
  { kode: "1014", nama: "Eratnya hubungan calon", sumber: "posita", blangko: ["bas"] },
  { kode: "1046", nama: "Status wali nikah", sumber: "posita", blangko: ["bas", "putusan"] },
  { kode: "1217", nama: "Nama wali nikah", sumber: "posita", blangko: ["bas", "putusan"] },
  { kode: "6087", nama: "Alasan wali nikah menolak", sumber: "posita", blangko: ["bas"] },
  { kode: "3333", nama: "KUA kecamatan tempat menikah", sumber: "posita", blangko: ["bas"] },
  { kode: "1002", nama: "Status Pemohon sebelum nikah", sumber: "posita", blangko: ["bas"], deteksi: false },
  { kode: "1003", nama: "Status calon sebelum nikah", sumber: "posita", blangko: ["bas"], deteksi: false },
  { kode: "1357", nama: "Alasan wali nikah (bila bukan ayah)", sumber: "posita", blangko: ["bas"], deteksi: false },
  { kode: "1262", nama: "Alat bukti", sumber: "berkas-ecourt", blangko: ["bas"] },
]);

const HUBUNGAN = "ayah\\s+kandung|paman\\s+kandung|paman|kakak\\s+kandung|kakak\\s+laki-laki|adik\\s+kandung|saudara\\s+(?:laki-laki\\s+)?kandung|kakek|saudara\\s+laki-laki|sepupu";

function deteksi(posita) {
  const t = B.polos(posita);
  const lu = require("../abtUsulanService");
  const peta = {};
  if (!t) return peta;

  // 1029 / 1030 - calon suami dan umurnya.
  const calon = /melangsungkan\s+pernikahan\s+dengan\s+(?:seorang\s+)?(?:laki-laki|pria)\s+(?:pilihan\s+)?(?:Pemohon\s+)?(?:yang\s+)?bernama\s*:?\s*/i.exec(t);
  if (calon) {
    const sisa = t.slice(calon.index + calon[0].length);
    const nama = B.potongEkorBukanNama(lu.namaDiAwal(sisa));
    const kal = t.slice(calon.index, calon.index + calon[0].length + 160);
    B.taruh(peta, "1029", B.fakta(nama, kal, "cukup", "wali-adhol-1029-calon"));
    const umur = /^[^;]{0,80}?\bumur\s+(\d{1,2})\s*(?:\([^)]*\)\s*)?tahun/i.exec(sisa.slice(nama.length));
    if (umur) B.taruh(peta, "1030", B.fakta(`${umur[1]} tahun`, kal, "cukup", "wali-adhol-1030-umur"));
  }

  // 1014 - "sudah saling mencintai".
  const erat = /\b(sudah\s+saling\s+mencintai|saling\s+mencintai)\b/i.exec(t);
  if (erat) B.taruh(peta, "1014", B.fakta("sudah saling mencintai", t.slice(Math.max(0, erat.index - 60), erat.index + 60), "ragu", "wali-adhol-1014-cinta"));

  // 1046 / 1217 - wali yang menolak: "menyampaikan maksud tersebut kepada <hubungan> Pemohon yang bernama W".
  const wali = new RegExp(`menyampaikan\\s+maksud\\s+(?:tersebut\\s+)?kepada\\s+(${HUBUNGAN})\\s+Pemohon\\s+(?:yang\\s+)?bernama\\s*:?\\s*`, "i").exec(t);
  if (wali) {
    const sisa = t.slice(wali.index + wali[0].length);
    const nama = B.potongEkorBukanNama(lu.namaDiAwal(sisa));
    const kal = t.slice(wali.index, wali.index + wali[0].length + 120);
    // Nama bergelar bersambung ("Annas, S.Sos., MM. bin Djikra Sahaba") tidak terbaca utuh oleh namaDiAwal:
    // bila sesudah nama masih ada kata huruf besar sebelum "yang beralamat"/kalimat berikutnya -> ragu.
    const ujung = sisa.search(/\s+(?:yang\s+beralamat|yang\s+tinggal|Bahwa)\b|;|\.\s+[A-Z][a-z]+\s/);
    const utuh = B.rapatNama(ujung >= 0 ? sisa.slice(0, ujung) : sisa.slice(0, 80)) === B.rapatNama(nama);
    B.taruh(peta, "1046", B.fakta(wali[1].toLowerCase().replace(/\s+/g, " "), kal, "cukup", "wali-adhol-1046-hubungan"));
    B.taruh(peta, "1217", B.fakta(nama, kal, utuh ? "cukup" : "ragu", "wali-adhol-1217-wali"));
  }

  // 6087 - alasan wali menolak.
  const tolak = /tidak\s+mendapat(?:kan)?\s+restu\s+dari\s+[^;]{0,80}?\bkarena\s+([^;]{8,240}?)(?=\s*;|\s+(?:\d{1,2}\s*\.\s*)?Bahwa\b|\.\s+[A-Z]|$)/i.exec(t);
  if (tolak) B.taruh(peta, "6087", B.fakta(`karena ${tolak[1].trim().replace(/[.,]+$/, "")}`, tolak[0], "ragu", "wali-adhol-6087-alasan"));

  // 3333 - "Kecamatan X, Kabupaten Y" tempat pernikahan akan dilangsungkan (KUA wali hakim).
  const tempat = /akan\s+(?:segera\s+)?melangsungkan\s+pernikahan\s+di\s+([^;]{5,200}?)(?=,?\s+dan\s+atas|;|\.\s|$)/i.exec(t);
  if (tempat) {
    const k = wilayah.komponenWilayah(tempat[1]);
    // Bentuk isian hakim: "Dolo Barat, Kabupaten Sigi" - tanpa kabupaten tidak lengkap -> ragu.
    if (k.kecamatan) B.taruh(peta, "3333", B.fakta([k.kecamatan, k.kabupaten].filter(Boolean).join(", "), tempat[0], k.kabupaten ? "cukup" : "ragu", "wali-adhol-3333-tempat"));
  }
  return peta;
}

/** Emas dari amar (untuk pengukuran): nama wali yang dinyatakan adhol, calon suami, KUA wali hakim. */
function emasAmar(amar) {
  const t = String(amar || "");
  const lu = require("../abtUsulanService");
  const hasil = {};
  const w = /wali\b[^;]{0,60}?\bbernama\s*\(?\s*/i.exec(t);
  if (w) hasil["1217"] = lu.namaDiAwal(t.slice(w.index + w[0].length).replace(/^\(/, ""));
  const c = /calon\s+suami(?:nya|\s+Pemohon)?\s+(?:yang\s+)?bernama\s*\(?\s*|seorang\s+laki-laki\s+bernama\s+|dengan\s+(?=[A-Z][a-z]+\s+bin\b)/i.exec(t);
  if (c) hasil["1029"] = lu.namaDiAwal(t.slice(c.index + c[0].length));
  const k = /Kepala\s+(?:Kantor\s+)?Urusan\s+Agama\s+(?:Kec(?:amatan|\.)\s*)([^;]{3,80})/i.exec(t);
  if (k) {
    const komp = wilayah.komponenWilayah(`Kecamatan ${k[1]}`);
    if (komp.kecamatan) hasil["3333"] = [komp.kecamatan, komp.kabupaten].filter(Boolean).join(", ");
  }
  for (const x of Object.keys(hasil)) if (!hasil[x]) delete hasil[x];
  return hasil;
}

module.exports = { kunci: "wali-adhol", jenisPerkaraId: [363], variabel, deteksi, emasAmar };
