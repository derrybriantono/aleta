"use strict";

/**
 * ============================================================================
 * PERWALIAN OLEH KERABAT (354) - isian blangko "[01b] Perwalian - Anak Yatim Piatu oleh Kerabat" (agen U4, 20 Okt 2026)
 * ============================================================================
 * Posita perwalian PA Donggala 2025-2026 yang diajukan bibi, kakak, paman, nenek atau tante memakai kalimat baku formulir:
 *   "Bahwa Pemohon adalah Saudara kandung (adik) dari Ibu Kandung <anak>"
 *   "Alm. Ramli Lupoyo (Ayah) telah meninggal dunia pada tanggal 27 Oktober 2022 (dibuktikan dengan kutipan akta kematian ...)"
 *
 *   4400  hubungan Pemohon dengan anak          dari kalimat "Pemohon adalah ..." + jenis kelamin Pemohon (SIPP) bila ia saudara orang tua anak
 *   4401  nama ayah kandung anak (almarhum)      "Alm. NAMA (Ayah) telah meninggal dunia"
 *   4402  nama ibu kandung anak (almarhumah)     "Almh. NAMA (Ibu) telah meninggal dunia"
 *   4403  tanggal ayah meninggal                 kalimat yang sama
 *   4404  tanggal ibu meninggal                  kalimat yang sama
 *
 * Hanya berlaku pada perwalian oleh KERABAT (pemohonOrangTua === false); pada perwalian oleh orang tua yang masih hidup isian ini tidak dipakai.
 * MURNI. "cukup" bila kalimat bakunya persis; "ragu" bila hubungan harus ditafsirkan.
 */

const B = require("../isiOtomatisS5/bantu");
const { pemohonOrangTua } = require("../isiOtomatisS5/perwalian");

const rapikan = (t) => String(t || "").replace(/\s+/g, " ").replace(/\s+([,;.])/g, "$1").trim();
const kecil = (t) => rapikan(t).toLowerCase();

/** Kata hubungan ke anak, mis. "saudara kandung dari ibu kandung" -> bibi/paman menurut jenis kelamin Pemohon. */
function hubungan(posita, jkPemohon) {
  const t = B.polos(posita);
  const m = /\bPemohon\s+(?:adalah|merupakan)\s+(?:seorang\s+)?([^;.]{3,140})/i.exec(t);
  if (!m) return null;
  const frasa = rapikan(m[1]);
  const lower = frasa.toLowerCase();
  const saudaraOrtu = /^(?:saudara|saudari|kakak|kaka|adik|abang)\s*(?:kandung)?\s*(?:\(\s*(?:kakak|kaka|adik|abang)\s*\))?\s*(?:dari|bagi)\s+(ibu|ayah|bapak)\s*(?:kandung)?\b/i.exec(lower);
  if (saudaraOrtu) {
    const sisi = /^(?:ibu)$/.test(saudaraOrtu[1]) ? "ibu" : "ayah";
    const kata = jkPemohon === "P" ? "bibi" : jkPemohon === "L" ? "paman" : "saudara kandung";
    return { nilai: `${kata} (saudara kandung dari ${sisi} kandung anak)`, kalimat: m[0], yakin: jkPemohon ? "cukup" : "ragu", catatan: jkPemohon ? "Dari kalimat 'Pemohon adalah saudara kandung dari ... orang tua anak' dan jenis kelamin Pemohon di SIPP." : "Jenis kelamin Pemohon tidak terbaca di SIPP: ditulis 'saudara kandung'; ganti bibi atau paman." };
  }
  const langsung = /^(paman|bibi|tante|om|nenek|kakek|kakak|kaka|adik|abang|saudara|saudari)(\s+(?:kandung|tiri|sepupu|ibu|ayah))?/i.exec(lower);
  if (langsung) {
    const kata = langsung[1].replace(/^kaka$/, "kakak").replace(/^saudari$/, "saudara");
    const sambung = (langsung[2] || "").trim();
    const nilai = [kata === "tante" ? "tante" : kata, sambung].filter(Boolean).join(" ");
    // "Tante dari anak X atau Adik Kandung dari Almh Y" -> tetap "tante"; kakak/adik/saudara dari ANAK = saudara kandung anak
    const dariAnak = /\bdari\s+anak\b/i.test(lower) || /\bdari\s+(?:alm|almh|almarhum|almarhumah)\b/i.test(lower);
    return { nilai: nilai, kalimat: m[0], yakin: dariAnak || !/\bdari\b/i.test(lower) ? "cukup" : "ragu", catatan: "Dari kalimat 'Pemohon adalah ...' pada posita; periksa dengan silsilah keluarga." };
  }
  return null;
}

function orangTuaMeninggal(posita) {
  const t = B.polos(posita);
  const hasil = {};
  const re = /(?:Alm\.?|Almh\.?|Almarhum(?:ah)?)\s+([A-Za-z][^()\n;]{1,70}?)\s*\(\s*(Ayah|Bapak|Ibu)\s*(?:Kandung)?\s*\)\s*(?:telah\s+)?meninggal\s+dunia\s+pada\s+tanggal\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})/gi;
  let m;
  while ((m = re.exec(t))) {
    const sisi = /^ibu$/i.test(m[2]) ? "ibu" : "ayah";
    if (hasil[sisi]) continue;
    hasil[sisi] = { nama: rapikan(m[1]).replace(/[.,]+$/, ""), tanggal: rapikan(m[3]), kalimat: rapikan(m[0]) };
  }
  return hasil;
}

function usulanU4Perwalian(d) {
  const posita = String((d.perkara && d.perkara.posita) || "");
  if (pemohonOrangTua(posita) === true) return [];
  const hasil = [];
  const jk = B.jenisKelamin((d.pihak1 && d.pihak1[0] && d.pihak1[0].jk) || "");
  const h = hubungan(posita, jk);
  if (h) hasil.push(B.butir({ kode: "4400", nama: "Hubungan Pemohon dengan anak", nilai: h.nilai, keyakinan: h.yakin, kalimat: h.kalimat, asal: "posita-gugatan", catatan: h.catatan, kodePola: "u4-pw-4400-hubungan" }));
  const om = orangTuaMeninggal(posita);
  const isi = (kode, nama, nilai, kalimat, ket) => B.butir({ kode, nama, nilai, keyakinan: "cukup", kalimat, asal: "posita-gugatan", catatan: ket, kodePola: `u4-pw-${kode}` });
  for (const sisi of ["ayah", "ibu"]) {
    const o = om[sisi];
    if (!o) continue;
    hasil.push(isi(sisi === "ayah" ? "4401" : "4402", `Nama ${sisi} kandung anak yang meninggal`, o.nama, o.kalimat, "Dari kalimat baku posita tentang kematian orang tua anak; tambahkan bin/binti bila belum tertulis."));
    const iso = B.indonesiaKeIso(o.tanggal);
    if (iso) hasil.push(isi(sisi === "ayah" ? "4403" : "4404", `Tanggal ${sisi} anak meninggal dunia`, B.isoKeTampil(iso), o.kalimat, "Dari kalimat baku posita; cocokkan dengan akta kematian."));
  }
  return hasil;
}

module.exports = { usulanU4Perwalian, hubungan, orangTuaMeninggal };
