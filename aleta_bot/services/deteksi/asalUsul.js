"use strict";

/**
 * ============================================================================
 * DETEKSI ASAL USUL ANAK (jenis_perkara_id 358)
 * ============================================================================
 *
 * Blangko: derry_briantono/8 Asal Usul Anak ([98] Cabut, [99] NO Poliandri),
 * "- BAS ASAL USUL ANAK -" dan "ALUR 13 Asal Usul Anak" (BAS 1 Kabul).
 *
 * Fakta pernikahan (5197, 5105, 8087, 1217, 0650, 0651, 1001, 1002, 1003,
 * 1046, 7211, 7212, 5178, 0007) sudah diurai jalur itsbat
 * (abtUsulanService.dariPositaItsbat, sumber "itsbat") - posita asal usul
 * PA Donggala memakai kalimat itsbat yang sama. Modul ini menambah yang
 * KHAS asal usul:
 *
 *   8603  nama anak yang dimohonkan (ISIAN MANUAL bila SIPP perkara_anak_pihak
 *         kosong - 10 dari 13 perkara asal usul tidak punya baris anak di SIPP).
 *         Dibaca dari petitum ("Menetapkan anak ... bernama X ... adalah anak
 *         (sah) dari Pemohon I dan Pemohon II"), cadangan posita ("dikaruniai
 *         ... anak ... bernama X"). Bentuk "A, B, C" (8602 menyambung "dan").
 *   8605  pernikahan resmi yang tercatat kemudian: "pada tanggal D di hadapan
 *         PPN KUA Kecamatan X, Kabupaten Y, Akta Nikah Nomor N" (bentuk isian
 *         yang dituliskan nama variabelnya).
 *
 * Tidak dideteksi: 8607 (fakta tambahan keterangan saksi - dari BAS, bukan
 * posita), 0378/9958 bukti surat (berkas e-Court), 0364/0366 (KTP e-Court -
 * jalur KTP yang sudah ada).
 */

const B = require("./bantuAnak");
const wilayah = require("./wilayah");

const variabel = Object.freeze([
  { kode: "8603", nama: "Nama anak yang dimohonkan (isian bila SIPP kosong)", sumber: "petitum", blangko: ["putusan", "bas"] },
  { kode: "8605", nama: "Pernikahan resmi/tercatat para Pemohon", sumber: "posita", blangko: ["putusan"] },
  { kode: "5197", nama: "Tanggal nikah", sumber: "posita", blangko: ["putusan", "bas"], catatan: "jalur itsbat" },
  { kode: "0007", nama: "Telah dikaruniai anak", sumber: "posita", blangko: ["bas"], catatan: "jalur itsbat" },
  { kode: "0378", nama: "Bukti surat", sumber: "berkas-ecourt", blangko: ["putusan"] },
  { kode: "8607", nama: "Fakta tambahan keterangan saksi", sumber: "saksi-sipp", blangko: ["putusan"] },
]);

/** Nama anak dari petitum: "Menetapkan (anak|anak-anak|ketiga anak ...) ... bernama : X ... adalah anak". */
function anakPetitum(petitum) {
  const t = String(petitum || "");
  const m = /Menetapkan\s+(?:[^;]{0,60}?\b)?anak(?:-anak)?\b[^;:]{0,60}?\bbe?r?nama\s*:?\s*/i.exec(t);
  if (!m) return null;
  let isi = t.slice(m.index + m[0].length);
  // Sampai butir berikutnya; tiap anak boleh berekor sendiri "Adalah anak dari Pemohon I dan Pemohon II" (231/2025).
  const b = isi.search(/(?:;|\s)\s*(?:\d{1,2}\s*\.\s*)?(?:Membebankan|Menetapkan\s+biaya|Memerintahkan|SUBSID\w*)\b/i);
  if (b >= 0) isi = isi.slice(0, b);
  if (!/\b(?:adalah|sebagai)\s+anak|\banak\s+(?:sah|kandung)\s+dari/i.test(isi)) return null;
  isi = isi
    .replace(/\b(?:adalah|sebagai)\s+anak(?:-anak)?\s+(?:sah\s+|kandung\s+)?(?:dari\s+)?[^;]*?(?=;|\s(?:[a-h]|\d{1,2})\s*[.)]\s+[A-Z]|$)/gi, " ; ")
    .replace(/,?\s*(?:tanggal\s+lahir|bertempat\s+tinggal)\b[^;]*?(?=;|$)/gi, " ; ");
  const daftar = B.daftarNama(isi);
  return daftar.length ? { daftar, kalimat: t.slice(m.index, m.index + m[0].length + isi.length + 30) } : null;
}

/** Nama anak dari posita: "telah dikaruniai ... anak ... bernama X yang lahir ...; Y ...". */
function anakPosita(positaPolos) {
  const t = String(positaPolos || "");
  const m = /di\s*karuni(?:a|ai)\w*\s+[^;]{0,60}?anak\b[^;:]{0,40}?\bbe?r?nama\s*:?\s*/i.exec(t);
  if (!m) return null;
  let isi = t.slice(m.index + m[0].length);
  const b = isi.search(/\s(?:\d{1,2}\s*\.\s*)?Bahwa\b/);
  if (b >= 0) isi = isi.slice(0, b);
  // Tiap anak berekor "yang lahir di X, pada hari ..., tanggal D, ..." - ekor itu bukan nama.
  isi = isi.replace(/\s*(?:yang\s+)?lahir\b[^;]*?(?=;|\s(?:[a-h]|\d{1,2})\s*[.)]\s+[A-Z]|$)/gi, " ; ");
  const daftar = B.daftarNama(isi);
  return daftar.length ? { daftar, kalimat: t.slice(m.index, m.index + m[0].length + Math.min(isi.length, 300)) } : null;
}

/** "pada tanggal D, Pemohon I dan Pemohon II telah melangsungkan pernikahan yang dicatat oleh Pegawai Pencatat Nikah ... KUA Kecamatan X ... Akta Nikah Nomor : N". */
function nikahTercatat(kalimat) {
  const k = kalimat.find((x) => /dicatat(?:kan)?\s+oleh\s+Pegawai\s+Pencatat\s+Nikah|tercatat\s+(?:di|pada)\s+(?:Kantor\s+Urusan\s+Agama|KUA)/i.test(x) && /melangsungkan\s+(?:pernikahan|perkawinan)/i.test(x));
  if (!k) return null;
  const tanggal = B.tanggalPertama(k);
  const kua = /(?:Kantor\s+Urusan\s+Agama|KUA)[\s\S]*$/i.exec(k);
  const komp = wilayah.komponenWilayah(kua ? kua[0] : k);
  const nomor = /Akta\s+Nikah\s+Nomor\s*:?\s*([0-9A-Za-z./-]+)/i.exec(k);
  if (!tanggal || !komp.kecamatan) return null;
  const bagian = [`pada tanggal ${tanggal} di hadapan PPN KUA Kecamatan ${komp.kecamatan}`];
  if (komp.kabupaten) bagian.push(komp.kabupaten);
  if (nomor) bagian.push(`Akta Nikah Nomor ${nomor[1].replace(/[.,]+$/, "")}`);
  return { nilai: bagian.join(", "), kalimat: k };
}

function deteksi(posita, opsi = {}) {
  // 0010 & 0011/Pdt.P/2016 didaftar Asal Usul Anak padahal petitumnya "Menyatakan sah pengangkatan anak".
  const pengangkatan = require("./pengangkatanAnak");
  if (pengangkatan.cocokTeks(B.polos(opsi.petitum || "")) && !/asal\s*-?\s*usul/i.test(B.polos(opsi.petitum || ""))) {
    return pengangkatan.deteksi(posita, opsi);
  }
  const peta = {};
  const polos = B.polos(posita);
  const pet = anakPetitum(B.polos(opsi.petitum || ""));
  const pos = anakPosita(polos);
  if (pet) {
    // Petitum dan posita menyebut anak yang sama -> cukup; berbeda/hanya satu sumber -> ragu.
    const sepakat = pos && pet.daftar.every((a) => pos.daftar.some((b) => B.sama(a.nama, b.nama)));
    B.taruh(peta, "8603", B.fakta(pet.daftar.map((d) => d.nama).join(", "), pet.kalimat, sepakat ? "cukup" : "ragu", "asal-usul-8603-petitum", "petitum"));
  } else if (pos) {
    B.taruh(peta, "8603", B.fakta(pos.daftar.map((d) => d.nama).join(", "), pos.kalimat, "ragu", "asal-usul-8603-posita"));
  }
  const nikah = nikahTercatat(B.kalimat(posita));
  if (nikah) B.taruh(peta, "8605", B.fakta(nikah.nilai, nikah.kalimat, "ragu", "asal-usul-8605-tercatat"));
  return peta;
}

module.exports = { kunci: "asal-usul", jenisPerkaraId: [358], variabel, deteksi, anakPetitum, anakPosita };
