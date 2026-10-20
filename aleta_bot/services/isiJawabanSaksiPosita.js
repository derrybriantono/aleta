"use strict";

/**
 * ============================================================================
 * POLA TAMBAHAN DARI POSITA UNTUK JAWABAN SAKSI (20 Okt 2026)
 * ============================================================================
 *
 * Mesin deteksi posita yang sudah ada di bot (dariPositaItsbat, tambahUsulanJenis, faktaDariPosita) tidak membaca
 * semua fakta yang ditanyakan kepada saksi. Berkas ini MENAMBAH pola untuk fakta yang belum terbaca, dibuat dari bunyi
 * posita PA Donggala 2026 yang sungguh ada (jenis: itsbat nikah, cerai, dispensasi kawin, wali adhal, ahli waris,
 * perwalian, asal usul anak). Murni (tanpa jaringan).
 *
 * Aturan: yang diambil hanya yang TERTULIS. Pola yang khas (bunyi baku gugatan) berkeyakinan "cukup"; pola longgar
 * (kalimat bebas) berkeyakinan "ragu" dengan keterangan untuk petugas. Tidak ada yang disimpulkan.
 *
 * Hasil: [{ kunci, nilai, yakin: "cukup"|"ragu", ket }] - kunci fakta milik isiJawabanSaksiFakta.js.
 */

const { bersihNilai, tanggalIndo, kuaBaku, rapat, jumlahAnakDariTeks } = require("./isiJawabanSaksiFakta");

/** Posita (HTML atau teks) -> teks polos, butir dipisah baris baru. */
function polosPosita(html) {
  return String(html == null ? "" : html)
    .replace(/\\n/g, "\n")
    .replace(/<\/(li|p|ol|ul|div|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/[ �]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

/** Butir posita: dipisah pada baris baru dan titik koma, nomor/"Bahwa" di depan dibuang. */
function butirPosita(html) {
  return polosPosita(html)
    .split(/\n|;\s+/)
    .map((k) => k.replace(/^\s*(?:\d+[.)]\s*)?(?:bahwa\s+)?/i, "").trim())
    .filter((k) => k.length > 8);
}

const SEBUTAN_ORANG = /^(?:Pemohon|Termohon|Penggugat|Tergugat)\b/i;

/** Memotong peristiwa pada kata sebab/akibat ("dikarenakan", "karena", "sehingga", ...) dan tanda baca akhir. */
function potongPeristiwa(t, maks = 170) {
  let s = rapat(t);
  s = s.split(/\s*(?:,\s*)?\b(?:dikarenakan|dikarena|karena|kerena|disebabkan|akibat|sehingga|hingga|yang\s+mengakibatkan|dengan\s+alasan|namun|dan\s+sejak\s+saat\s+itu)\b|[.;]\s/i)[0];
  s = bersihNilai(s);
  if (s.length > maks) {
    const potong = s.slice(0, maks);
    s = potong.slice(0, Math.max(potong.lastIndexOf(","), potong.lastIndexOf(" "))).trim();
  }
  return s;
}

// ============================================================================
// Itsbat nikah / asal usul anak
// ============================================================================

function itsbat(butir) {
  const hasil = [];
  for (const b of butir) {
    const m = /tidak\s+(?:mempunyai|memiliki)\s+(?:kutipan\s+)?akta\s+nikah[^.]*?,?\s*karena\s+(.+)$/i.exec(b);
    if (!m) continue;
    let sebab = m[1].split(/\s*,?\s*sehingga\b/i)[0];
    sebab = sebab.replace(/^pernikahan\s+tersebut\s+/i, "").replace(/\s+dan\s+pernikahan\s+tersebut\s+/i, " dan ");
    sebab = bersihNilai(sebab).replace(/\bKUA\b/g, "Kantor Urusan Agama");
    sebab = sebab.replace(/^Para\b/, "para");
    if (sebab.length >= 8) {
      hasil.push({ kunci: "sebabTidakTercatat", nilai: sebab, yakin: "cukup", ket: "Dari kalimat 'tidak mempunyai kutipan akta nikah, karena ...' pada posita." });
      break;
    }
  }
  // Mahar yang tidak terbaca mesin lama: "dengan maskawin berupa 10 Pohon Cengkeh dibayar tunai", "mas kawin: seperangkat alat salat".
  for (const b of butir) {
    const m = /\b(?:mas\s*kawin|maskawin|mahar)\s*(?:nya)?\s*(?:berupa|yaitu|sebesar|sejumlah|:)\s*(.+)$/i.exec(b);
    if (!m) continue;
    const mentah = m[1].split(/\s+(?:dibayar(?:kan)?|dan\s+dibayar|secara\s+tunai|tunai|dihutang|belum\s+dibayar)\b|[;]|\.\s+[A-Z]/i)[0];
    const nilai = bersihNilai(mentah);
    if (nilai.length >= 3 && nilai.length < 160) {
      const bayar = /\b(?:dihutang|belum\s+dibayar|terhutang)\b/i.test(m[1]) ? "dihutang" : /\btunai|kontan\b/i.test(m[1]) ? "dibayar tunai" : "";
      hasil.push({ kunci: "mahar", nilai: bayar ? `${nilai}, ${bayar}` : nilai, yakin: "cukup", ket: "Dari kalimat 'maskawin berupa ...' pada posita." });
      break;
    }
  }
  // Umur saat menikah: "Pemohon I berstatus Perjaka dengan usia 27 tahun, dan Pemohon II berstatus Perawan dengan usia 18 tahun"
  for (const b of butir) {
    const m = /berstatus\s+[A-Za-z]+(?:\s*\([^)]*\))?\s*(?:,\s*)?(?:dalam\s+|dengan\s+)?usia\s+(\d{1,2})\s*tahun[^.]*?berstatus\s+[A-Za-z]+(?:\s*\([^)]*\))?\s*(?:,\s*)?(?:dalam\s+|dengan\s+)?usia\s+(\d{1,2})\s*tahun/i.exec(b);
    if (m) {
      hasil.push({ kunci: "umurP1", nilai: m[1], yakin: "cukup" }, { kunci: "umurP2", nilai: m[2], yakin: "cukup" });
      break;
    }
  }
  // Anak yang dimohonkan (asal usul anak): "telah dikaruniai seorang anak yang bernama X yang lahir di T, pada hari Senin, tanggal 18 Agustus 2019"
  for (const b of butir) {
    const m = /dikaruniai\s+(?:seorang|satu|\d+\s*(?:\([^)]*\)\s*)?orang)?\s*anak\s+(?:laki-laki\s+|perempuan\s+)?(?:yang\s+)?bernama\s+(.+?)(?:\s+(?:yang\s+)?lahir\b|,|;|$)/i.exec(b);
    if (!m) continue;
    const nama = bersihNilai(m[1]);
    if (nama.length >= 3) hasil.push({ kunci: "anakNama", nilai: nama, yakin: "cukup", ket: "Dari kalimat 'dikaruniai seorang anak yang bernama ...' pada posita." });
    const lh = /\blahir\s+(?:di\s+)?([^,.;]+?)\s*,?\s*(?:pada\s+)?(?:hari\s+\w+\s*,?\s*)?(?:tanggal\s+)?(\d{1,2}\s+[A-Za-z]+\s+(?:19|20)\d{2})/i.exec(b);
    if (lh) {
      const tgl = tanggalIndo(lh[2]);
      if (tgl) hasil.push({ kunci: "anakLahirTgl", nilai: tgl, yakin: "cukup" });
      const tempat = bersihNilai(lh[1]);
      if (tempat && tempat.length < 60) hasil.push({ kunci: "anakLahirTempat", nilai: tempat, yakin: "cukup" });
    }
    break;
  }
  return hasil;
}

// ============================================================================
// Cerai
// ============================================================================

function cerai(butir) {
  const hasil = [];
  for (const b of butir) {
    const m = /puncak\w*[^.;]{0,80}?\bterjadi\s+(?:pada\s+)?(?:(?:tanggal|bulan|tahun)\s+)?((?:\d{1,2}\s+)?(?:Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember|Pebruari|Nopember)\s+(?:19|20)\d{2}|(?:19|20)\d{2})\s*,?\s*(.+)$/i.exec(b);
    if (!m) continue;
    const peristiwa = potongPeristiwa(m[2]);
    if (peristiwa.length >= 12 && SEBUTAN_ORANG.test(peristiwa)) {
      hasil.push({ kunci: "puncakPeristiwa", nilai: peristiwa, yakin: "cukup", ket: "Dari kalimat 'puncak keretakan ... terjadi pada ...' pada gugatan." });
      break;
    }
    if (peristiwa.length >= 12) {
      hasil.push({ kunci: "puncakPeristiwa", nilai: peristiwa, yakin: "ragu", ket: "Dari kalimat puncak perselisihan pada gugatan; bunyinya tidak baku, periksa." });
      break;
    }
  }
  return hasil;
}

// ============================================================================
// Dispensasi kawin
// ============================================================================

function dispensasi(butir) {
  const hasil = [];
  for (const b of butir) {
    const m = /menikahkan\s+anak\s+(?:para\s+)?Pemohon\s+(?:yang\s+)?bernama\s+(.+?)\s*\(\s*calon\s+mempelai\s+(wanita|perempuan|laki-laki|pria)\s*\)(?:.*?(?:dengan\s+)?(?:seorang\s+)?(?:laki-laki|perempuan|pria|wanita)\s+(?:yang\s+)?bernama\s+(.+?)\s*\(\s*calon\s+mempelai)?/i.exec(b);
    if (m) {
      hasil.push({ kunci: "anakNama", nilai: bersihNilai(m[1]).replace(/\s+/g, " "), yakin: "cukup" });
      hasil.push({ kunci: "anakJk", nilai: /wanita|perempuan/i.test(m[2]) ? "P" : "L", yakin: "cukup" });
      if (m[3]) hasil.push({ kunci: "calonNama", nilai: bersihNilai(m[3]).replace(/\s+/g, " "), yakin: "cukup" });
      break;
    }
  }
  for (const b of butir) {
    const m = /(?:anak\s+(?:para\s+)?Pemohon[^.;]*?)?(?:masih\s+)?berusia\s+(\d{1,2})\s+tahun/i.exec(b);
    if (m && /anak/i.test(b) && /(di\s+bawah\s+umur|masih\s+berusia|sampai\s+saat\s+ini)/i.test(b)) {
      hasil.push({ kunci: "anakUmur", nilai: m[1], yakin: "cukup" });
      break;
    }
  }
  for (const b of butir) {
    const m = /(?:Kantor\s+Urusan\s+Agama|KUA)\s+(?:Kecamatan\s+)?([A-Z][A-Za-z' -]{2,40}?)(?:\s*,|\s+Kabupaten|\s+Kota|\s+Provinsi|\s+guna|\s+untuk|$)/.exec(b);
    if (m && /ditolak|penolakan|melapor/i.test(b)) {
      hasil.push({ kunci: "kuaPenolak", nilai: bersihNilai(m[1]), yakin: "cukup" });
      break;
    }
  }
  for (const b of butir) {
    const m = /saling\s+(?:mengenal|kenal)\s+(?:selama|sejak|sudah|sekitar)\s+([^,.;(]{2,40}?)(?:,|\.|;|\(|$|\s+dan\s+hubungan)/i.exec(b);
    if (m) {
      hasil.push({ kunci: "lamaKenal", nilai: bersihNilai(m[1]).replace(/^selama\s+/i, ""), yakin: "cukup" });
      const h = /hubungan\s+mereka\s+(?:telah|sudah)\s+(sedemikian\s+erat(?:nya)?)/i.exec(b);
      if (h) hasil.push({ kunci: "eratHubungan", nilai: h[1].replace(/eratnya$/i, "erat"), yakin: "cukup" });
      const hamil = /sedang\s+hamil\s+(\d+\s*(?:bulan|minggu))/i.exec(b);
      if (hamil) hasil.push({ kunci: "hamil", nilai: hamil[1].toLowerCase(), yakin: "cukup" });
      break;
    }
  }
  return hasil;
}

// ============================================================================
// Wali adhal
// ============================================================================

function waliAdhal(butir) {
  const hasil = [];
  for (const b of butir) {
    const m = /(?:laki-laki|pria)\s+(?:pilihan\s+)?(?:yang\s+)?bernama\s*:?\s*(.+?)(?:\s*,\s*(?:NIK|Tempat|umur|agama)|\s+(?:NIK|umur)\b|,|$)/i.exec(b);
    if (m && /(menikah|pernikahan|perkawinan)/i.test(b)) {
      hasil.push({ kunci: "calonNama", nilai: bersihNilai(m[1]), yakin: "cukup" });
      const u = /\bumur\s+(\d{1,2})\s+tahun/i.exec(b);
      if (u) hasil.push({ kunci: "calonUmur", nilai: u[1], yakin: "cukup" });
      const pk = /pekerjaan\s+([^,]+?)(?:\s*,\s*tempat|\s*\(|,|$)/i.exec(b);
      if (pk) hasil.push({ kunci: "calonPekerjaan", nilai: bersihNilai(pk[1]), yakin: "cukup" });
      break;
    }
  }
  for (const b of butir) {
    const m = /(Ayah\s+Kandung|Kakek|Saudara\s+Laki-laki\s+Kandung|Paman)\s+Pemohon\s+yang\s+bernama\s+(.+?)(?:\s+yang\s+beralamat|,|\s+bin\b|$)/i.exec(b);
    if (m) {
      hasil.push({ kunci: "waliHubungan", nilai: m[1].toLowerCase(), yakin: "cukup" });
      hasil.push({ kunci: "waliNama", nilai: bersihNilai(m[2]), yakin: "cukup" });
      break;
    }
  }
  for (const b of butir) {
    const m = /tidak\s+(?:mendapatkan\s+restu|merestui|setuju|mau|bersedia)[^.;]*?(?:karena|dengan alasan|dikarenakan)\s+(.+)$/i.exec(b) || /enggan[^.;]*?(?:karena|dengan alasan|dikarenakan)\s+(.+)$/i.exec(b);
    if (m) {
      const alasan = potongPeristiwa(m[1], 200);
      if (alasan.length >= 8) {
        hasil.push({ kunci: "alasanWali", nilai: alasan, yakin: "ragu", ket: "Dari kalimat tentang penolakan wali pada permohonan; bunyinya bebas, periksa." });
        break;
      }
    }
  }
  for (const b of butir) {
    const m = /pada\s+tanggal\s+(\d{1,2}\s+[A-Za-z]+\s+(?:19|20)\d{2})[^.;]*?\bmelamar\b/i.exec(b);
    if (m) {
      const tgl = tanggalIndo(m[1]);
      if (tgl) {
        hasil.push({ kunci: "tglLamar", nilai: tgl, yakin: "cukup" });
        break;
      }
    }
  }
  return hasil;
}

// ============================================================================
// Ahli waris (P3HP), kewarisan, perwalian
// ============================================================================

function waris(butir) {
  const hasil = [];
  for (const b of butir) {
    const m = /(?:Almarhum(?:ah)?|Alm\.?|Almh\.?)\s+([A-Z][A-Za-z.' -]{2,50}?)\s+meninggal\s+dunia\s+pada\s+(?:tanggal\s+)?(\d{1,2}\s+[A-Za-z]+\s+(?:19|20)\d{2})/i.exec(b);
    if (m) {
      hasil.push({ kunci: "pewarisNama", nilai: bersihNilai(m[1]), yakin: "cukup" });
      const t = tanggalIndo(m[2]);
      if (t) hasil.push({ kunci: "wafatTgl", nilai: t, yakin: "cukup" });
      break;
    }
  }
  for (const b of butir) {
    const m = /meninggal(?:kan)?\s+(?:dunia\s+)?(?:di\s+)([A-Z][^,;.]{3,60})/.exec(b);
    if (m && /(?:meninggal|wafat)/i.test(b)) {
      hasil.push({ kunci: "wafatTempat", nilai: bersihNilai(m[1]), yakin: "ragu", ket: "Dari kalimat 'meninggal dunia di ...' pada posita; periksa." });
      break;
    }
  }
  for (let i = 0; i < butir.length; i++) {
    const b = butir[i];
    const m = /dikaruniai(?:kan)?\s+(\d+|[a-z]+)\s*(?:\([^)]*\)\s*)?orang\s+anak/i.exec(b);
    if (!m) continue;
    const n = jumlahAnakDariTeks(`${m[1]} orang anak`);
    if (n !== null) hasil.push({ kunci: "jumlahAnakPewaris", nilai: String(n), yakin: "cukup" });
    // daftar nama sesudah "yaitu:" (satu per baris, diawali "-" atau "a.")
    const nama = [];
    for (let k = i + 1; k < butir.length && nama.length < 12; k++) {
      const x = /^\s*(?:[-•*]|[a-z][.)])\s*(.+)$/i.exec(butir[k]);
      if (!x) break;
      const bersih = bersihNilai(x[1]).replace(/,\s*(bin|binti)\b/i, " $1");
      if (!/^[A-Za-z]/.test(bersih)) break;
      nama.push(bersih.replace(/^[A-Z .'-]+(?=\s+(?:bin|binti)\b)/i, (n0) => (n0 === n0.toUpperCase() ? n0.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : n0)));
    }
    if (nama.length) hasil.push({ kunci: "anakPewaris", nilai: nama.join(", ").replace(/, ([^,]+)$/, " dan $1"), yakin: "cukup" });
    break;
  }
  return hasil;
}

function perwalian(butir) {
  const hasil = [];
  for (const b of butir) {
    const m = /diterapkan\s+sebagai\s+wali|ditetapkan\s+sebagai\s+wali\s+(?:bagi|atas|dari)\s+anak\s+(?:Pemohon\s+)?(?:yang\s+)?bernama\s+(.+?)(?:,|;|\(|$)/i.exec(b);
    if (m && m[1]) hasil.push({ kunci: "anakNama", nilai: bersihNilai(m[1]), yakin: "cukup" });
  }
  return hasil;
}

/**
 * @param {string} posita  HTML/teks posita
 * @param {string} jenis   "itsbat"|"aua"|"cerai"|"dk"|"wa"|"paw"|"waris"|"perwalian"|"umum"|...
 */
function positaTambahan(posita, jenis) {
  const butir = butirPosita(posita);
  if (!butir.length) return [];
  switch (jenis) {
    case "itsbat":
    case "aua":
      return itsbat(butir);
    case "cg":
    case "ct":
    case "cerai":
      return cerai(butir);
    case "dk":
      return dispensasi(butir);
    case "wa":
      return waliAdhal(butir);
    case "paw":
    case "waris":
      return waris(butir);
    case "perwalian":
      return perwalian(butir);
    default:
      return [];
  }
}

module.exports = { positaTambahan, polosPosita, butirPosita, potongPeristiwa };
