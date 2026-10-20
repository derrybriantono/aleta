"use strict";

/**
 * ============================================================================
 * DETEKSI IZIN KAWIN (jenis_perkara_id 361) - agen W3a-B, 21 Okt 2026
 * ============================================================================
 *
 * Blangko Derry: "3a Izin Kawin" dan "3a Izin Kawin - BAS" (ALUR 62). Pemohon = calon mempelai yang belum berumur 21 tahun
 * (Pasal 6 ayat (5) UU 1/1974); orang tua/wali/keluarga garis lurus yang didengar BUKAN pihak SIPP, sehingga nama dan hubungannya
 * dibaca dari kalimat posita. Perkara jenis ini hampir tidak ada di SIPP PA Donggala (0 perkara 361 pada 21 Okt 2026):
 * pola di bawah disusun dari bentuk posita permohonan perkawinan serumpun (wali adhal, dispensasi kawin) dan DIUJI dengan
 * kalimat sintetis; BELUM diukur atas perkara nyata jenis ini. Karena itu nilai yang bergantung pada tafsir ditandai "ragu".
 *
 * Variabel (paket abt-w3a-blangko-baru-perkawinan, 3640-3659):
 *   3640 nama calon pasangan | 3641 umur calon pasangan | 3644/3645 orang pertama yang didengar (nama, hubungan)
 *   3646/3647 orang kedua yang didengar | 3649 keadaan orang tua (angka 1-5) | 3651 alasan tidak memberi izin.
 * Tidak dideteksi: 3650 (keterangan di sidang), 3654 (bukti surat - berkas e-Court), 3656 (penilaian majelis), 3657 (kesiapan).
 */

const B = require("./bantuAnak");

const variabel = Object.freeze([
  { kode: "3640", nama: "Nama calon pasangan Pemohon", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "3641", nama: "Umur calon pasangan Pemohon", sumber: "posita", blangko: ["putusan"] },
  { kode: "3644", nama: "Orang yang didengar ke-1 - nama", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "3645", nama: "Orang yang didengar ke-1 - hubungan dengan Pemohon", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "3646", nama: "Orang yang didengar ke-2 - nama", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "3647", nama: "Orang yang didengar ke-2 - hubungan dengan Pemohon", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "3649", nama: "Keadaan orang tua/wali (angka 1-5)", sumber: "posita", blangko: ["putusan"] },
  { kode: "3651", nama: "Alasan tidak memberi izin / belum menyatakan pendapat", sumber: "posita", blangko: ["putusan"] },
  { kode: "3650", nama: "Pokok keterangan orang yang didengar", sumber: "bas", blangko: ["putusan", "bas"], deteksi: false },
  { kode: "3654", nama: "Alat bukti surat", sumber: "berkas-ecourt", blangko: ["putusan", "bas"], deteksi: false },
  { kode: "3656", nama: "Pertimbangan majelis atas keberatan", sumber: "majelis", blangko: ["putusan"], deteksi: false },
]);

/** Hubungan keluarga yang sah sebagai pemberi izin (Pasal 6 ayat (2), (3), (4) UU 1/1974). */
const HUBUNGAN = "ayah\\s+kandung|ibu\\s+kandung|ayah|ibu|bapak|kakek|nenek|paman|bibi|saudara\\s+(?:laki-laki\\s+)?kandung|kakak\\s+kandung|wali|orang\\s+yang\\s+memelihara";
const PENAWAR = "(?:Pemohon|Pemohon\\s+I)";
/** Sikap menolak memberi izin. */
const TOLAK = "(?:tidak|belum)\\s+(?:mau\\s+|bersedia\\s+)?(?:memberi(?:kan)?\\s+(?:izin|restu|persetujuan)|menyetujui|merestui|mengizinkan|memperbolehkan|membolehkan|setuju)|menolak\\s+(?:memberi(?:kan)?\\s+(?:izin|restu|persetujuan)|menyetujui|merestui|mengizinkan)|keberatan";

function bersihAlasan(s) {
  return String(s || "").trim().replace(/[.,;:]+$/, "");
}

/** Orang yang disebut "ayah kandung Pemohon yang bernama X" dalam satu kalimat: [{hubungan, nama}] (urut kemunculan). */
function orangDiKalimat(kal, lu) {
  const hasil = [];
  const re = new RegExp(`\\b(${HUBUNGAN})\\s+(?:kandung\\s+)?${PENAWAR}\\s*(?:yang\\s+)?(?:bernama|bernama\\s*:|,)\\s*:?\\s*`, "gi");
  let m;
  while ((m = re.exec(kal)) !== null) {
    const sisa = kal.slice(m.index + m[0].length);
    const nama = B.potongEkorBukanNama(lu.namaDiAwal(sisa));
    if (!nama || nama.length < 3) continue;
    const hub = m[1].toLowerCase().replace(/\s+/g, " ");
    // "ayah" tanpa "kandung" pada posita PA berarti ayah kandung; dibakukan agar sama dengan isian petugas.
    const baku = /^(ayah|ibu|bapak)$/.test(hub) ? `${hub === "bapak" ? "ayah" : hub} kandung` : hub;
    if (!hasil.some((h) => B.sama(h.nama, nama))) hasil.push({ hubungan: baku, nama, indeks: m.index });
  }
  return hasil;
}

function deteksi(posita) {
  const peta = {};
  const t = B.polos(posita);
  if (!t) return peta;
  const lu = require("../abtUsulanService");
  const kal = B.kalimat(posita);

  // 3640 / 3641 - calon pasangan: "hendak menikah dengan seorang laki-laki bernama X, umur N tahun".
  const calon = /(?:hendak|akan|ingin|bermaksud|berencana)\s+(?:segera\s+)?(?:melangsungkan\s+)?(?:pernikahan|perkawinan|menikah|kawin|menikahi)\s+(?:dengan\s+)?(?:seorang\s+)?(?:laki-laki|pria|perempuan|wanita|gadis|pemuda)?\s*(?:pilihan\s+Pemohon\s+)?(?:yang\s+)?bernama\s*:?\s*/i.exec(t)
    || /calon\s+(?:suami|istri|isteri)\s+(?:Pemohon\s+)?(?:yang\s+)?bernama\s*:?\s*/i.exec(t);
  if (calon) {
    const sisa = t.slice(calon.index + calon[0].length);
    const nama = B.potongEkorBukanNama(lu.namaDiAwal(sisa));
    const k = t.slice(calon.index, calon.index + calon[0].length + 160);
    if (nama && nama.length >= 3) {
      B.taruh(peta, "3640", B.fakta(nama, k, "cukup", "izin-kawin-3640-calon"));
      const umur = /^[^;]{0,80}?\b(?:umur|berumur|usia|berusia)\s+(\d{1,2})\s*(?:\([^)]*\)\s*)?tahun/i.exec(sisa.slice(nama.length));
      if (umur) B.taruh(peta, "3641", B.fakta(umur[1], k, "cukup", "izin-kawin-3641-umur-calon"));
    }
  }

  // 3644-3647 / 3651 - orang yang menolak memberi izin (dan orang lain yang disebut).
  const orang = [];
  for (const k of kal) {
    // orang tua yang sudah meninggal tidak bisa didengar: kalimatnya hanya dipakai untuk 3649
    if (/\b(?:meninggal|wafat)\b|\balm(?:arhum(?:ah)?|\.)/i.test(k)) continue;
    const tolak = new RegExp(TOLAK, "i").test(k);
    for (const o of orangDiKalimat(k, lu)) {
      const ada = orang.find((x) => B.sama(x.nama, o.nama));
      if (ada) {
        if (tolak && !ada.tolak) {
          ada.tolak = true;
          ada.kalimat = k;
        }
      } else {
        orang.push({ ...o, tolak, kalimat: k });
      }
    }
  }
  const urut = [...orang.filter((o) => o.tolak), ...orang.filter((o) => !o.tolak)].slice(0, 2);
  urut.forEach((o, i) => {
    const kodeNama = i === 0 ? "3644" : "3646";
    const kodeHub = i === 0 ? "3645" : "3647";
    // Orang yang kalimatnya memuat penolakan = pasti yang dimintai izin; yang lain hanya disebut -> ragu.
    const yakin = o.tolak ? "cukup" : "ragu";
    B.taruh(peta, kodeNama, B.fakta(o.nama, o.kalimat, yakin, `izin-kawin-${kodeNama}-orang`));
    B.taruh(peta, kodeHub, B.fakta(o.hubungan, o.kalimat, yakin, `izin-kawin-${kodeHub}-hubungan`));
  });

  // 3651 - alasan: "tidak memberikan izin ... karena <alasan>" (alasan menurut Pemohon: selalu ragu).
  for (const k of kal) {
    const alasan = new RegExp(`(?:${TOLAK})[^;]{0,120}?\\bkarena\\s+([^;]{8,240}?)(?=\\s*;|\\s+(?:\\d{1,2}\\s*\\.\\s*)?Bahwa\\b|\\.\\s+[A-Z]|$)`, "i").exec(k);
    if (alasan) {
      B.taruh(peta, "3651", B.fakta(`karena ${bersihAlasan(alasan[1])}`, k, "ragu", "izin-kawin-3651-alasan"));
      break;
    }
  }

  // 3649 - keadaan orang tua. Hanya bila posita tegas menyebut orang tua yang telah meninggal dunia.
  const wafat = { ayah: false, ibu: false };
  let kalWafat = "";
  for (const k of kal) {
    if (/\b(?:ayah|bapak)(?:\s+kandung)?\s+Pemohon\b[^;]{0,120}?\b(?:telah\s+)?(?:meninggal|wafat)\b/i.test(k) || /\bPemohon\b[^;]{0,60}?\b(?:ayah|bapak)\b[^;]{0,60}?\b(?:telah\s+)?(?:meninggal|wafat)\b/i.test(k)) {
      wafat.ayah = true;
      kalWafat = kalWafat || k;
    }
    if (/\bibu(?:\s+kandung)?\s+Pemohon\b[^;]{0,120}?\b(?:telah\s+)?(?:meninggal|wafat)\b/i.test(k) || /\bPemohon\b[^;]{0,60}?\bibu\b[^;]{0,60}?\b(?:telah\s+)?(?:meninggal|wafat)\b/i.test(k)) {
      wafat.ibu = true;
      kalWafat = kalWafat || k;
    }
    if (/\bkedua\s+orang\s+tua\s+(?:kandung\s+)?Pemohon\b[^;]{0,80}?\b(?:telah\s+)?(?:meninggal|wafat)\b/i.test(k)) {
      wafat.ayah = true;
      wafat.ibu = true;
      kalWafat = k;
    }
  }
  if (wafat.ayah && wafat.ibu) B.taruh(peta, "3649", B.fakta("4", kalWafat, "cukup", "izin-kawin-3649-kedua-wafat"));
  else if (wafat.ayah || wafat.ibu) B.taruh(peta, "3649", B.fakta("2", kalWafat, "cukup", "izin-kawin-3649-satu-wafat"));
  else {
    const mampu = kal.find((k) => /\b(?:ayah|ibu|bapak|orang\s+tua)(?:\s+kandung)?\s+Pemohon\b[^;]{0,80}?\b(?:tidak\s+mampu\s+menyatakan\s+kehendak|gangguan\s+jiwa|stroke|lumpuh\s+total|tidak\s+sadarkan\s+diri|koma)\b/i.test(k));
    if (mampu) B.taruh(peta, "3649", B.fakta("3", mampu, "ragu", "izin-kawin-3649-tidak-mampu"));
  }
  return peta;
}

module.exports = { kunci: "izin-kawin", jenisPerkaraId: [361], variabel, deteksi, orangDiKalimat };
