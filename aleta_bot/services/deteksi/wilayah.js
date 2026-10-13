"use strict";

/**
 * ============================================================================
 * WILAYAH DARI KALIMAT POSITA - DESA, KECAMATAN, KABUPATEN/KOTA, PROVINSI
 * ============================================================================
 *
 * Kerangka bersama deteksi per jenis (aleta_bot/services/deteksi/). Dipakai
 * oleh semua jenis yang menyebut tempat: tempat menikah (itsbat, cerai,
 * dispensasi kawin, asal usul), KUA, tempat tinggal bersama.
 *
 * Posita menulis tempat dengan banyak bentuk, semuanya nyata (posita itsbat
 * PA Donggala 2017-2026):
 *   "di Desa Lembantongoa , di wilayah hukum Kantor Urusan Agama Kecamatan Palolo, Kabupaten Sigi, Provinsi Sulawesi Tengah"
 *   "di Desa Omu Kecamatan Gumbasa Kabupaten Sigi"
 *   "di wilayah hukum Kantor Urusan Agama KecamatanDamsolKabupatenDonggalaPropinsi Sulawesi Tengah"   (kata tertempel)
 *   "di Wilayah Desa Labuan Lelea di rumah kecamatan Labuan kabupaten Donggala Propinsi Sulawesi Tengah"
 *   "di wilayah hukum Kantor Urusan Agama Palolo, Kabupaten Sigi"                                    (tanpa "Kecamatan")
 *
 * Yang dikembalikan hanya yang TERTULIS: nama wilayah = kata-kata berhuruf
 * awal besar sesudah kata penandanya, paling banyak 4 kata, berhenti pada
 * tanda baca, kata huruf kecil, atau kata penanda berikutnya. Tidak ada yang
 * ditebak (kecamatan tidak diturunkan dari desa, dst.).
 */

/** Kata yang menghentikan nama wilayah (huruf kecil untuk perbandingan). */
const HENTI = new Set([
  "desa", "kelurahan", "dusun", "kecamatan", "kec", "kabupaten", "kab", "kota", "provinsi", "propinsi", "prov",
  "kantor", "kua", "wilayah", "hukum", "pemohon", "termohon", "penggugat", "tergugat", "di", "dan", "yang", "namun",
  "pada", "tanggal", "urusan", "agama", "setempat", "rt", "rw", "jalan", "jl", "no", "nomor", "sehingga", "karena",
  "tidak", "dengan", "serta", "rumah", "masjid", "mesjid", "lingkungan", "dalam", "sesuai", "menurut", "tersebut",
  "pegawai", "pencatat", "nikah", "tahun", "hari", "sejak", "sampai", "hingga", "telah", "untuk", "oleh",
]);

/** Kata penanda wilayah yang tertempel ke kata sebelum/sesudahnya diberi spasi. */
function rapatWilayah(teks) {
  // Urutan penting: "KecamatanDamsolKabupatenDonggala" -> penanda + nama dahulu, lalu nama + penanda.
  return String(teks || "")
    .replace(/(Desa|Kelurahan|Kecamatan|Kabupaten|Provinsi|Propinsi)(?=[A-Z][a-z])/g, "$1 ")
    .replace(/([a-z])(?=(?:Desa|Kelurahan|Kecamatan|Kabupaten|Kota|Provinsi|Propinsi|Kantor)\b)/g, "$1 ")
    // "Sigi Biromaru,Kabupaten Sigi" - koma tanpa spasi.
    .replace(/,(?=[A-Za-z])/g, ", ")
    .replace(/[ \s]+/g, " ");
}

/** "SIGI" -> "Sigi"; kata berhuruf campur dibiarkan. */
function judulKata(kata) {
  return /^[A-Z][A-Z'’-]+$/.test(kata) && kata.length > 2 ? kata.charAt(0) + kata.slice(1).toLowerCase() : kata;
}

/** Nama wilayah di AWAL teks (sesudah kata penandanya); "" bila tidak ada. */
function namaWilayahDiAwal(teks) {
  const kata = [];
  const pola = /\S+/g;
  const t = String(teks || "").replace(/^[\s:]+/, "");
  let m;
  while ((m = pola.exec(t)) !== null) {
    const token = m[0];
    const inti = token.replace(/[,;:.)\]’'"]+$/, "");
    const berekor = inti.length !== token.length;
    if (!inti || !/^[A-Z][A-Za-z'’-]*$/.test(inti)) break;
    if (HENTI.has(inti.toLowerCase())) break;
    kata.push(judulKata(inti));
    if (berekor || kata.length >= 4) break;
  }
  return kata.join(" ");
}

/** Nama sesudah pola penanda pertama yang cocok di `t`; "" bila tidak ada. */
function namaSesudahPola(t, pola) {
  const re = new RegExp(pola.source, pola.flags.includes("g") ? pola.flags : `${pola.flags}g`);
  let m;
  while ((m = re.exec(t)) !== null) {
    const nama = namaWilayahDiAwal(t.slice(m.index + m[0].length));
    if (nama) return nama;
  }
  return "";
}

/**
 * Komponen wilayah dari sepotong teks.
 * @returns {{desa: string, kecamatan: string, kabupaten: string, provinsi: string}}
 *   desa       "Desa X" / "Kelurahan X" (penanda ikut)
 *   kecamatan  NAMA saja ("Palolo") - dari "Kecamatan X", "Kec. X", atau
 *              "Kantor Urusan Agama (Kecamatan) X" / "KUA X"
 *   kabupaten  "Kabupaten X" / "Kota X"
 *   provinsi   "Provinsi X" (ejaan "Propinsi" dibakukan)
 */
function komponenWilayah(teks) {
  const t = rapatWilayah(teks);
  const hasil = { desa: "", kecamatan: "", kabupaten: "", provinsi: "" };
  const desa = /\b(Desa|Kelurahan)\s+/gi;
  let m;
  while ((m = desa.exec(t)) !== null) {
    const nama = namaWilayahDiAwal(t.slice(m.index + m[0].length));
    if (nama) {
      hasil.desa = `${m[1].charAt(0).toUpperCase()}${m[1].slice(1).toLowerCase()} ${nama}`;
      break;
    }
  }
  hasil.kecamatan =
    namaSesudahPola(t, /\b(?:Kecamatan\s+|Kec\.\s*)/i) ||
    namaSesudahPola(t, /\b(?:Kantor\s+Urusan\s+Agama|KUA)\s+(?:\(KUA\)\s+)?(?:Kecamatan\s+|Kec\.\s*)?/i);
  const kab = namaSesudahPola(t, /\b(?:Kabupaten\s+|Kab\.\s*)/i);
  const kota = kab ? "" : namaSesudahPola(t, /\bKota\s+(?=[A-Z])/);
  hasil.kabupaten = kab ? `Kabupaten ${kab}` : kota ? `Kota ${kota}` : "";
  const prov = namaSesudahPola(t, /\b(?:Provinsi\s+|Propinsi\s+|Prov\.\s*)/i);
  hasil.provinsi = prov ? `Provinsi ${prov}` : "";
  return hasil;
}

/** Bentuk perbandingan: huruf kecil, hanya huruf/angka. */
function rapat(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Dua komponen tidak bertentangan: tiap ruas yang ada di keduanya sama. */
function selaras(a, b) {
  return ["desa", "kecamatan", "kabupaten", "provinsi"].every((k) => !a[k] || !b[k] || rapat(a[k]) === rapat(b[k]));
}

/** "Desa X, Kecamatan Y, Kabupaten Z, Provinsi W" - ruas kosong dilewati. */
function tulisWilayah(k) {
  return [k.desa, k.kecamatan ? `Kecamatan ${k.kecamatan}` : "", k.kabupaten, k.provinsi].filter(Boolean).join(", ");
}

module.exports = { HENTI, rapatWilayah, namaWilayahDiAwal, komponenWilayah, selaras, tulisWilayah, rapat };
