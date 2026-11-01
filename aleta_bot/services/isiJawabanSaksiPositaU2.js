"use strict";

/**
 * ============================================================================
 * FAKTA TAMBAHAN DARI POSITA - DISPENSASI KAWIN, WALI ADHAL, PERWALIAN, ITSBAT (U2, 1 Nov 2026)
 * ============================================================================
 *
 * Melengkapi isiJawabanSaksiPosita.js (bukan pembaca kedua): hanya kunci yang BELUM dikeluarkan pembaca lama yang dikeluarkan di
 * sini (positaTambahan menyisihkan kunci yang sudah ada). Bunyi yang dibaca adalah bunyi baku posita PA Donggala:
 *
 *   dispensasi kawin   "Pemohon berencana akan menikahkan anak Pemohon yang bernama A dengan seorang laki-laki yang bernama B"
 *                      "Yang akan melaksanakan perkawinan dengan seorang laki-laki yang bernama:"  <- identitas calon di BARIS BERIKUTNYA
 *                      "A binti X, umur 16 tahun, ..., pekerjaan Pelajar"  /  "calon istri anak Pemohon telah hamil 7 bulan"
 *   wali adhal         "Bahwa Pemohon bermaksud akan melangsungkan pernikahan dengan seorang laki-laki pilihan yang bernama :" + baris identitas
 *   perwalian          "Irwandi bin Haderawi , umur 19 tahun" (daftar anak) dan "wali atas anak Irwandi ... untuk dapat mengurus Pendaftaran TNI-AD"
 *   itsbat             "membutuhkan Akta Nikah tersebut untuk kepastian hukum dan mengurus kepentingan hukum lainnya"
 *
 * Murni, tanpa jaringan; satu lintasan regex per butir. Yang ragu tidak dikeluarkan.
 */

const { bersihNilai } = require("./isiJawabanSaksiFakta");

/** Baris yang berakhir "... bernama :" digabung dengan baris identitas sesudahnya. */
function gabungBernama(butir) {
  const hasil = [];
  for (let i = 0; i < butir.length; i++) {
    let b = butir[i];
    if (/\bbernama\s*:?\s*$/i.test(b) && i + 1 < butir.length) {
      b = `${b.replace(/\s*:?\s*$/, "")} : ${butir[i + 1]}`;
      i++;
    }
    hasil.push(b);
  }
  return hasil;
}

const NAMA_ORANG = "([A-Z][A-Za-z'’`.\\-]*(?:\\s+(?:bin|binti|[A-Z][A-Za-z'’`.\\-]*)){0,6})";
const kunciNama = (t) => String(t || "").toLowerCase().replace(/[^a-z]/g, "").slice(0, 12);

/** "Muh. Arse bin Sultang, umur 25 tahun, ..., pekerjaan Petani, tempat tinggal ..." -> { nama, umur, pekerjaan } atau null. */
function identitas(b) {
  const m = new RegExp(`^\\s*(?:[a-z]\\s*[.)]\\s*)?${NAMA_ORANG}\\s*,?\\s*(?:umur|usia)\\s+(\\d{1,2})\\s*(?:\\([^)]*\\)\\s*)?tahun`, "i").exec(b);
  if (!m) return null;
  const pk = /pekerjaan\s*:?\s*([^,;]+?)\s*(?:,|;|tempat\s+tinggal|\.\s|$)/i.exec(b);
  const pekerjaan = pk ? bersihNilai(pk[1]) : "";
  return { nama: bersihNilai(m[1]), umur: m[2], pekerjaan: /^(?:tidak\s+ada|-|—)$/i.test(pekerjaan) ? "" : pekerjaan };
}

// ============================================================================
// Dispensasi kawin
// ============================================================================

function dispensasi(butirAsli) {
  const butir = gabungBernama(butirAsli);
  const hasil = [];
  // 1. siapa anak dan siapa calon
  let anak = "";
  let calon = "";
  for (const b of butir) {
    const m = new RegExp(`menikahkan\\s+anak\\s+(?:para\\s+)?Pemohon\\s+(?:yang\\s+)?bernama\\s+${NAMA_ORANG}\\s+dengan\\s+(?:seorang\\s+)?(?:laki-laki|perempuan|pria|wanita)?\\s*(?:yang\\s+)?(?:bernama\\s*:?\\s*)?${NAMA_ORANG}`, "i").exec(b);
    if (m) {
      anak = bersihNilai(m[1]);
      calon = bersihNilai(m[2]);
      break;
    }
  }
  // calon dari kalimat "... seorang laki-laki yang bernama : X bin Y, umur 25 tahun, ..." (baris identitas sudah digabung)
  let idCalon = null;
  for (const b of butir) {
    const m = new RegExp(`(?:laki-laki|perempuan|pria|wanita)\\s+(?:pilihan\\s+)?(?:yang\\s+)?bernama\\s*:\\s*(.+)$`, "i").exec(b);
    if (m && /(?:melaksanakan|melangsungkan)\s+(?:perkawinan|pernikahan)/i.test(b)) {
      idCalon = identitas(m[1]);
      if (idCalon) {
        if (!calon) calon = idCalon.nama;
        break;
      }
    }
  }
  // anak dan calon dari baris identitas bernomor/tersendiri
  const peta = new Map();
  for (const b of butir) {
    const id = identitas(b);
    if (id) peta.set(kunciNama(id.nama), id);
  }
  const idAnak = anak ? peta.get(kunciNama(anak)) : null;
  if (!idCalon && calon) idCalon = peta.get(kunciNama(calon)) || null;
  if (anak) hasil.push({ kunci: "anakNama", nilai: anak, yakin: "cukup", ket: "Dari kalimat 'berencana akan menikahkan anak Pemohon yang bernama ...' pada permohonan." });
  if (calon) hasil.push({ kunci: "calonNama", nilai: calon, yakin: "cukup", ket: "Dari kalimat tentang calon pasangan anak pada permohonan." });
  const umurAnak = idAnak ? idAnak.umur : (/anak[^.;]{0,120}?\bmasih\s+(?:berumur|berusia)\s+(\d{1,2})\s+tahun/i.exec(butir.join("\n")) || [])[1];
  if (umurAnak) hasil.push({ kunci: "anakUmur", nilai: umurAnak, yakin: "cukup" });
  if (idCalon) {
    hasil.push({ kunci: "calonUmur", nilai: idCalon.umur, yakin: "cukup", ket: "Dari baris data calon pasangan pada permohonan." });
    if (idCalon.pekerjaan) hasil.push({ kunci: "calonPekerjaan", nilai: idCalon.pekerjaan, yakin: "cukup" });
  }
  // 2. jenis kelamin anak: bin/binti pada nama anak; cadangan: sebutan "Calon Suami/Istri Anak Pemohon"
  const sebutCalon = /calon\s+(suami|isteri|istri)\s+anak\s+(?:para\s+)?Pemohon/i.exec(butir.join("\n"));
  if (anak && /\bbinti\b/i.test(anak)) hasil.push({ kunci: "anakJk", nilai: "P", yakin: "cukup" });
  else if (anak && /\bbin\b/i.test(anak)) hasil.push({ kunci: "anakJk", nilai: "L", yakin: "cukup" });
  else if (sebutCalon) hasil.push({ kunci: "anakJk", nilai: /suami/i.test(sebutCalon[1]) ? "P" : "L", yakin: "cukup" });
  // 3. kehamilan dan eratnya hubungan
  for (const b of butir) {
    const h = /\bhamil\s+(?:sekitar\s+|kurang\s+lebih\s+)?(\d+\s*(?:\([a-z ]+\)\s*)?(?:bulan|minggu))/i.exec(b);
    if (h) {
      hasil.push({ kunci: "hamil", nilai: h[1].replace(/\s*\([^)]*\)/, "").toLowerCase(), yakin: "cukup", ket: "Dari kalimat tentang kehamilan pada permohonan." });
      break;
    }
  }
  for (const b of butir) {
    const e = /hubungan\s+mereka\s+(?:telah|sudah)\s+(sedemikian\s+erat)(?:nya)?/i.exec(b);
    if (e) {
      hasil.push({ kunci: "eratHubungan", nilai: e[1].toLowerCase(), yakin: "cukup" });
      break;
    }
    const c = /(?:telah|sudah)\s+(saling\s+mencintai(?:\s+dan\s+(?:sudah\s+)?tidak\s+dapat\s+(?:lagi\s+)?dipisahkan)?)/i.exec(b);
    if (c && /dispensasi|diberi\s+izin|menikahkan|dinikahkan|mohon/i.test(b)) {
      hasil.push({ kunci: "eratHubungan", nilai: c[1].toLowerCase().replace(/\bsudah\s+/g, ""), yakin: "cukup", ket: "Dari kalimat 'telah saling mencintai ...' pada permohonan." });
      break;
    }
  }
  return hasil;
}

// ============================================================================
// Wali adhal
// ============================================================================

function waliAdhal(butirAsli) {
  const butir = gabungBernama(butirAsli);
  const hasil = [];
  for (const b of butir) {
    const m = /(?:laki-laki|pria)\s+(?:pilihan\s+)?(?:yang\s+)?bernama\s*:\s*(.+)$/i.exec(b);
    if (!m || !/(menikah|pernikahan|perkawinan)/i.test(b)) continue;
    const id = identitas(m[1]);
    if (!id) continue;
    hasil.push({ kunci: "calonNama", nilai: id.nama, yakin: "cukup", ket: "Dari baris data calon suami pada permohonan." });
    hasil.push({ kunci: "calonUmur", nilai: id.umur, yakin: "cukup" });
    if (id.pekerjaan) hasil.push({ kunci: "calonPekerjaan", nilai: id.pekerjaan, yakin: "cukup" });
    break;
  }
  for (const b of butir) {
    if (/(?:antara\s+Pemohon\s+dengan\s+calon\s+suami|Pemohon\s+dengan\s+calon\s+suami(?:nya)?)[^.;]{0,40}?\bsaling\s+mencintai\b/i.test(b)) {
      hasil.push({ kunci: "eratHubungan", nilai: "saling mencintai", yakin: "cukup", ket: "Dari kalimat 'Pemohon dengan calon suami sudah saling mencintai' pada permohonan." });
      break;
    }
  }
  return hasil;
}

// ============================================================================
// Perwalian
// ============================================================================

function perwalian(butirAsli, hasilLama) {
  const hasil = [];
  const anakNama = ((hasilLama || []).find((x) => x.kunci === "anakNama") || {}).nilai || "";
  // umur anak dari daftar anak ("Irwandi bin Haderawi , umur 19 tahun")
  if (anakNama && !(hasilLama || []).some((x) => x.kunci === "anakUmur")) {
    for (const b of butirAsli) {
      const id = identitas(b);
      if (id && kunciNama(id.nama) === kunciNama(anakNama)) {
        hasil.push({ kunci: "anakUmur", nilai: id.umur, yakin: "cukup", ket: "Dari daftar anak pada permohonan." });
        break;
      }
    }
  }
  // keperluan: "wali atas anak X untuk dapat mengurus Pendaftaran TNI-AD, mengingat ..."
  for (const b of butirAsli) {
    const m = /\b(?:wali|perwalian)[^;]{0,200}?\buntuk\s+(?:dapat\s+)?(mengurus\s+.{4,120}?)(?=\s*(?:,|;|\.\s|\s+mengingat|\s+karena|\s+sementara|\s+sampai|$))/i.exec(b);
    if (m) {
      hasil.push({ kunci: "tujuan", nilai: bersihNilai(m[1]), yakin: "cukup", ket: "Dari kalimat tentang keperluan perwalian pada permohonan." });
      break;
    }
  }
  return hasil;
}

// ============================================================================
// Itsbat: tujuan ("membutuhkan Akta Nikah ... untuk ...")
// ============================================================================

function tujuanItsbat(butir) {
  for (const b of butir) {
    const m = /\b(?:membutuhkan|memerlukan|membutuhkan)\s+(?:Akta|Buku|Kutipan)\s+Nikah(?:\s+tersebut)?\s+(?:untuk|guna)\s+(.{5,200}?)(?=\s*(?:;|\.\s+[A-Z]|\.\s*$|$))/i.exec(b) ||
      /\b(?:membutuhkan|memerlukan)\s+(?:Akta|Buku|Kutipan)\s+Nikah(?:\s+tersebut)?\s+dan\s+(mengurus\s+.{5,160}?)(?=\s*(?:;|\.\s+[A-Z]|\.\s*$|$))/i.exec(b);
    if (m) {
      const nilai = bersihNilai(m[1]).replace(/\s+Bahwa\b.*$/i, "").replace(/[\s,]+$/, "");
      if (nilai.length >= 5) return [{ kunci: "tujuan", nilai, yakin: "cukup", ket: "Dari kalimat 'membutuhkan Akta Nikah tersebut untuk ...' pada permohonan." }];
    }
  }
  return [];
}

// ============================================================================
// Penetapan ahli waris: pasangan pewaris dan dana yang hendak dicairkan
// ============================================================================

function ahliWaris(butir) {
  const hasil = [];
  const NM = "([A-Z][A-Za-z'’`.\\-]*(?:\\s+(?:bin|binti|[A-Z][A-Za-z'’`.\\-]*)){0,5})";
  // pasangan: "tidak pernah bercerai dengan Xxxs" / "meninggalkan seorang isteri bernama Xxxs"
  for (const b of butir) {
    const m = new RegExp(`tidak\\s+pernah\\s+bercerai\\s+dengan\\s+${NM}`).exec(b) || new RegExp(`meninggalkan\\s+(?:seorang\\s+)?(?:isteri|istri|suami)(?:\\s+yang)?\\s+bernama\\s+${NM}`, "i").exec(b);
    if (m) {
      const nama = bersihNilai(m[1]);
      if (nama.length >= 3 && !/^(?:Pemohon|Termohon|Pewaris)\b/.test(nama)) {
        hasil.push({ kunci: "pewarisPasangan", nilai: nama, yakin: "cukup", ket: "Dari kalimat tentang pasangan pewaris pada permohonan." });
        break;
      }
    }
  }
  // dana: butir yang menyebut tabungan / dana / pensiun di bank atau lembaga (maks tiga), tanpa "atas nama ..."
  const dana = [];
  for (const b of butir) {
    if (dana.length >= 3) break;
    const m = /(?:meninggalkan\s+|^)((?:uang\s+)?(?:dana\s+)?(?:tabungan|deposito|dana\s+pensiun|tunjangan|santunan|asuransi|gaji|dana)\b[^;]{4,200})/i.exec(b);
    if (!m || !/\b(?:bank|btn|bri|bni|mandiri|taspen|asabri|bpjs|asuransi|koperasi|pegadaian|rekening)\b/i.test(m[1])) continue;
    if (/\b(?:Pemohon|Termohon)\b|\bmengajukan\b|\bmenetapkan\b/i.test(m[1])) continue;
    let t = bersihNilai(m[1]).replace(/\s+atas\s+nama\s+.*$/i, "").replace(/[\s,;.]+$/, "");
    t = t.replace(/\s*,\s*namun\b.*$/i, "").replace(/\s+sejumlah\s+RP\./i, " sejumlah Rp.");
    if (t.length >= 8) dana.push(t.length > 140 ? t.slice(0, 140).replace(/\s+\S*$/, "") : t);
  }
  if (dana.length) {
    const nilai = dana.length === 1 ? dana[0] : `${dana.slice(0, -1).join("; ")} dan ${dana[dana.length - 1]}`;
    hasil.push({ kunci: "danaPencairan", nilai, yakin: "cukup", ket: "Dari kalimat tentang tabungan/dana peninggalan pada permohonan." });
  }
  return hasil;
}

/**
 * @param {string[]} butir      butir posita (butirPosita)
 * @param {string} jenis        "itsbat"|"aua"|"dk"|"wa"|"perwalian"|...
 * @param {Array} hasilLama     fakta yang sudah dikeluarkan pembaca lama (untuk kunci yang tidak boleh ditimpa)
 */
function tambahanU2(butir, jenis, hasilLama) {
  if (!Array.isArray(butir) || !butir.length) return [];
  switch (jenis) {
    case "itsbat":
    case "aua":
      return tujuanItsbat(butir);
    case "dk":
      return dispensasi(butir);
    case "wa":
      return waliAdhal(butir);
    case "perwalian":
      return perwalian(butir, hasilLama);
    case "paw":
    case "waris":
      return ahliWaris(butir);
    default:
      return [];
  }
}

module.exports = { tambahanU2, gabungBernama, identitas };
