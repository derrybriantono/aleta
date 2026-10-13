"use strict";

/**
 * ============================================================================
 * DETEKSI PENGANGKATAN ANAK (jenis_perkara_id 352 "Pengesahan Anak"; di
 * PA Donggala didaftar sebagai "Lain-Lain" 369 - lewat lainLain.js - dan dua
 * kali sebagai Asal Usul Anak 358 pada 2016)
 * ============================================================================
 *
 * Blangko: derry_briantono/9a Lain-Lain (Pengangkatan Anak)/[01] [Kabul],
 * BAS 45-a Putus Pengangkatan Anak. Isian khas (variabel 8618-8623):
 *
 *   8603  nama anak yang diangkat (8602 OTOMATIS memakainya bila SIPP kosong)
 *   8618  tempat dan tanggal lahir anak: "Bogor pada tanggal 21 Oktober 2013"
 *         - hanya bila posita/petitum menyebut TEMPAT lahir; posita PA Donggala
 *         umumnya menyebut tanggalnya saja, tempatnya datang dari akta (amar).
 *   8619  orang tua kandung: "A bin B dan C binti D"
 *   8622  status perkawinan Pemohon: "seorang duda" / "suami istri"
 *   8623  hubungan Pemohon dengan calon anak angkat (paman, kakek, ...)
 *
 * Tidak dideteksi: 8620 keterangan orang tua kandung di persidangan (BAS),
 * 8621 alat bukti surat (berkas e-Court), 1038-1045 / 6128-6131 / 8134 (BAS
 * 45-a, variabelnya tidak bertipe di abt_variabel - tidak dapat disimpan).
 */

const B = require("./bantuAnak");

const variabel = Object.freeze([
  { kode: "8603", nama: "Nama anak yang diangkat", sumber: "posita", blangko: ["putusan"] },
  { kode: "8618", nama: "Tempat dan tanggal lahir anak", sumber: "posita", blangko: ["putusan"] },
  { kode: "8619", nama: "Nama orang tua kandung anak", sumber: "posita", blangko: ["putusan"] },
  { kode: "8622", nama: "Status perkawinan Pemohon", sumber: "posita", blangko: ["putusan"] },
  { kode: "8623", nama: "Hubungan Pemohon dengan calon anak angkat", sumber: "posita", blangko: ["putusan"] },
  { kode: "8620", nama: "Keterangan orang tua kandung di persidangan", sumber: "saksi-sipp", blangko: ["putusan"] },
  { kode: "8621", nama: "Alat bukti surat pengangkatan anak", sumber: "berkas-ecourt", blangko: ["putusan"] },
]);

/** Anak yang diangkat: "hendak mengangkat (adopsi) (seorang) anak yang bernama X" / "menjadikan anak bernama : X ... sebagai calon anak angkat". */
function anakDiangkat(teks) {
  const t = String(teks || "");
  const m =
    /(?:mengangkat|pengangkatan)\s+(?:\(\s*adopsi\s*\)\s+)?(?:seorang\s+)?anak\s+(?:\(\s*adopsi\s*\)\s+)?(?:yang\s+)?be?r?nama\s*:?\s*/i.exec(t) ||
    /menjadikan\s+anak\s+(?:yang\s+)?be?r?nama\s*:?\s*/i.exec(t) ||
    /terhadap\s+(?:\d+\s*\([a-z]+\)\s+)?anak(?:\s+(?:laki-laki|perempuan))?\s+(?:yang\s+)?(?:masing-masing\s+)?be?r?nama\s*:?\s*/i.exec(t);
  if (!m) return null;
  let isi = t.slice(m.index + m[0].length);
  const b = isi.search(/\s(?:yang\s+merupakan|yang\s+dilakukan|anak\s+tersebut|berjenis|sebagai\s+calon|yang\s+adalah)\b|;|\s(?:\d{1,2}\s*\.\s*)?(?:Bahwa|Membebankan|Memerintahkan|Menetapkan)\b/i);
  if (b >= 0) isi = isi.slice(0, b);
  isi = isi.replace(/^\s*-\s*/, "").replace(/\s+-\s*(?=[A-Z])/g, " ; ");
  const daftar = B.daftarNama(isi);
  return daftar.length ? { daftar, kalimat: t.slice(m.index, m.index + m[0].length + isi.length + 40).slice(0, 400) } : null;
}

/** Orang tua kandung: "anak kandung dari (pasangan suami istri yang bernama)? (Bapak)? A dan (Ibu)? B". */
function orangTuaKandung(t) {
  const m = /anak\s+kandung\s+dari\s+(?:pasangan\s+suami\s+ist(?:e)?ri\s+)?(?:yang\s+bernama\s+)?(?:Bapak\s+)?([A-Z][^;]{2,80}?)\s+dan\s+(?:Ibu\s+)?([A-Z][^;]{2,80})/.exec(String(t || ""));
  if (!m) return null;
  const lu = require("../abtUsulanService");
  const a = B.potongEkorBukanNama(lu.namaDiAwal(m[1]));
  const b = B.potongEkorBukanNama(lu.namaDiAwal(m[2]));
  return a && b ? { nilai: `${a} dan ${b}`, kalimat: m[0] } : null;
}

function deteksi(posita, opsi = {}) {
  const peta = {};
  const t = B.polos(posita);
  const pet = B.polos(opsi.petitum || "");
  const lu = require("../abtUsulanService");

  const aPet = anakDiangkat(pet);
  const aPos = anakDiangkat(t);
  const anak = aPet || aPos;
  if (anak) {
    const sepakat = aPet && aPos && aPet.daftar.length === aPos.daftar.length && aPet.daftar.every((a) => aPos.daftar.some((b) => B.sama(a.nama, b.nama)));
    // Nama terlengkap (petitum sering menambah "bin ...").
    const nama = anak.daftar.map((d) => {
      const lain = (aPos && aPos !== anak ? aPos.daftar : aPet ? aPet.daftar : []).find((x) => B.sama(x.nama, d.nama));
      return lain && lain.nama.length > d.nama.length ? lain.nama : d.nama;
    });
    B.taruh(peta, "8603", B.fakta(nama.join(", "), anak.kalimat, sepakat ? "cukup" : "ragu", aPet ? "angkat-8603-petitum" : "angkat-8603-posita", aPet ? "petitum" : "posita"));
  }

  // 8618 - hanya bila TEMPAT lahir tertulis: "lahir di X(,)? (pada)? tanggal D".
  const lahir = /\blahir\s+di\s+([A-Z][A-Za-z' -]{2,40}?)\s*,?\s*(?:pada\s+)?(?:hari\s+\w+\s*,?\s*)?(?:tanggal\s*,?\s*)?(\d{1,2}\s+[A-Za-z]+\s+\d{4})/.exec(`${t} ${pet}`);
  if (lahir) B.taruh(peta, "8618", B.fakta(`${lahir[1].trim()} pada tanggal ${B.tanggalPertama(lahir[2])}`, lahir[0], "ragu", "angkat-8618-lahir"));

  const ortu = orangTuaKandung(t);
  if (ortu) B.taruh(peta, "8619", B.fakta(ortu.nilai, ortu.kalimat, "ragu", "angkat-8619-ortu"));

  // 8622 - status perkawinan Pemohon.
  const duda = /\bPemohon\s+(?:ber)?status\s+(duda|janda)\b/i.exec(t);
  if (duda) B.taruh(peta, "8622", B.fakta(`seorang ${duda[1].toLowerCase()}`, duda[0], "ragu", "angkat-8622-status"));
  else if (/\b(?:para\s+Pemohon|Pemohon\s+I\s+dan\s+Pemohon\s+II)\b[^;]{0,60}?(?:pasangan\s+suami\s+ist(?:e)?ri|telah\s+melangsungkan\s+pernikahan|telah\s+menikah)/i.test(t)) {
    B.taruh(peta, "8622", B.fakta("suami istri", "", "ragu", "angkat-8622-pasangan"));
  }

  // 8623 - hubungan tegas: "Pemohon adalah paman/kakek/... dari anak tersebut" / "anak tersebut adalah keponakan/cucu Pemohon".
  const hub = /\bPemohon(?:\s+I{1,2})?\s+adalah\s+(paman|bibi|tante|kakek|nenek|kakak(?:\s+kandung)?|om)\s+(?:kandung\s+)?(?:dari\s+)?(?:anak|calon)/i.exec(t);
  if (hub) B.taruh(peta, "8623", B.fakta(hub[1].toLowerCase(), hub[0], "ragu", "angkat-8623-hubungan"));
  void lu;
  return peta;
}

/** Emas dari amar (pengukuran): nama anak dan tempat/tanggal lahir. */
function emasAmar(amar) {
  const hasil = {};
  const a = anakDiangkat(amar);
  if (a) hasil["8603"] = a.daftar.map((d) => d.nama);
  const l = /\blahir\s+di\s+([A-Z][A-Za-z' -]{2,40}?)\s*,?\s*(?:pada\s+)?(?:tanggal\s+)?(\d{1,2}\s+[A-Za-z]+\s+\d{4})/.exec(String(amar || ""));
  if (l) hasil["8618"] = `${l[1].trim()} pada tanggal ${B.tanggalPertama(l[2])}`;
  return hasil;
}

/** Posita/petitum pengangkatan anak? (dipakai lainLain.js dan asalUsul 2016) */
function cocokTeks(teks) {
  return /\b(?:mengangkat\s+(?:\(\s*adopsi\s*\)\s+)?(?:seorang\s+)?anak|pengangkatan\s+anak|calon\s+anak\s+angkat|anak\s+angkat)\b/i.test(String(teks || ""));
}

module.exports = { kunci: "pengangkatan-anak", jenisPerkaraId: [352], variabel, deteksi, emasAmar, cocokTeks, anakDiangkat };
