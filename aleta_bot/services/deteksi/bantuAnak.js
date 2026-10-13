"use strict";

/**
 * ============================================================================
 * PEMBANTU DETEKSI JENIS "ANAK & PERMOHONAN UMUM" (agen Y, 13 Okt 2026)
 * ============================================================================
 *
 * Dipakai modul perwalian, asalUsul, pengangkatanAnak, waliAdhol, hadhanah,
 * dan lainLain. MURNI: tidak membaca basis data, tidak menulis apa pun.
 *
 * Bentuk teks yang dilayani diukur atas posita/petitum SIPP PA Donggala
 * (sipp_donggala salinan 9 Okt 2026; 91 perwalian, 13 asal usul, 13 wali
 * adhol, 19 lain-lain): daftar anak bertanda "a." / "1." / ";" / "dan",
 * nama huruf besar seluruhnya ("DEA PUSPITA") maupun besar-kecil, umur di
 * belakang nama ("Usia 15 tahun", "umur 1 tahun 9 bulan").
 */

const usulanService = require("../abtUsulanService");

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const BULAN_ALIAS = { pebruari: 2, nopember: 11, agustus: 8, augustus: 8, okt: 10, sept: 9 };

/** Posita/petitum SIPP (HTML) -> satu baris polos. */
function polos(teks) {
  return usulanService
    .polosPosita(String(teks || ""))
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Kalimat: dipecah pada titik koma dan penanda butir "N. Bahwa". */
function kalimat(teks) {
  return polos(teks)
    .split(/;\s*|\s(?=\d{1,2}\s*\.\s*Bahwa\b)|\s(?=Bahwa\b)/)
    .map((k) => k.trim())
    .filter((k) => k.length > 6);
}

/** Bulan Indonesia -> 1..12, null bila bukan nama bulan. */
function angkaBulan(nama) {
  const n = String(nama || "").toLowerCase();
  const i = BULAN.findIndex((b) => b.toLowerCase() === n);
  if (i >= 0) return i + 1;
  return BULAN_ALIAS[n] || null;
}

/** Tanggal pertama "12 Januari 2023" di teks -> "12 Januari 2023" (bulan dibakukan); "" bila tidak ada. */
function tanggalPertama(teks) {
  const re = /\b(\d{1,2})\s+([A-Za-z]+)\s+(?:tahun\s+)?(\d{4})\b/g;
  let m;
  while ((m = re.exec(String(teks || ""))) !== null) {
    const b = angkaBulan(m[2]);
    const h = Number(m[1]);
    if (b && h >= 1 && h <= 31) return `${String(h).padStart(2, "0")} ${BULAN[b - 1]} ${m[3]}`;
  }
  return "";
}

const ANGKA_KATA = ["nol", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas", "dua belas"];

/** "4 (empat) orang anak" dari "dikaruniai 4 (empat) orang anak" / "seorang anak"; "" bila tidak tertulis. */
function jumlahAnak(teks) {
  const t = String(teks || "");
  const m = t.match(/di\s*karuni(?:a|ai)\w*\s+(\d{1,2})\s*(?:\(\s*([a-z ]+?)\s*\))?\s*(?:orang\s+)?anak/i);
  if (m) {
    const n = Number(m[1]);
    if (!n) return "";
    return `${n} (${ANGKA_KATA[n] || String(m[2] || "").toLowerCase()}) orang anak`;
  }
  const kata = t.match(/di\s*karuni(?:a|ai)\w*\s+(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh)\s+(?:orang\s+)?anak/i);
  if (kata) {
    const n = ANGKA_KATA.indexOf(kata[1].toLowerCase());
    return `${n} (${ANGKA_KATA[n]}) orang anak`;
  }
  if (/di\s*karuni(?:a|ai)\w*\s+(?:seorang|satu\s+orang)\s+anak/i.test(t)) return "1 (satu) orang anak";
  return "";
}

/** Kata huruf besar yang bukan bagian daftar nama (pembuka keterangan sesudah nama). */
const BUKAN_NAMA_DAFTAR =
  /^(?:usia|umur|lahir|jenis|perempuan|laki|nik|tempat|tanggal|agama|pendidikan|pekerjaan|anak|adalah|berada|yang|sebagai|untuk|adapun|dengan|selanjutnya|kepada|bahwa|menetapkan|membebankan|primair|primer|subsid\w*)\b/i;

/**
 * Daftar nama dari potongan teks berisi satu atau beberapa nama:
 *   "a. Akbar bin Irwan, Usia 26 tahun ; b. Siska binti Irwan, Usia 21 tahun"
 *   "Khairul Thariq , umur 6 tahun Fairuz Manazil , umur 4 tahun"
 *   "Sakti Risky Aditiya bin Samsu Larija, Usia 15 tahun dan Nihaya S. Larija binti Samsu Larija"
 * @returns {Array<{nama: string, umur: number|null}>}
 */
function daftarNama(potongan) {
  const t = String(potongan || "")
    .replace(/\s*\(\s*[^)]{0,40}\)\s*/g, (s) => (/\b(?:umur|usia)\b/i.test(s) ? ` ${s.replace(/[()]/g, " ")} ` : " "))
    // "... dan anak perempuan bernama X" - penanda nama berikutnya menjadi pemisah.
    .replace(/[,\s]+(?:dan\s+|serta\s+)?(?:anak\s+)?(?:(?:laki-laki|perempuan)\s+)?(?:yang\s+)?be?r?nama\s*:?\s*/gi, " ; ")
    .replace(/\s+/g, " ")
    .trim();
  // Pemisah: titik koma, "dan"/"serta", penanda butir "a." / "1." / "2.1", dan ekor umur/lahir.
  const bagian = t.split(
    /\s*;\s*|\s+(?:dan|serta)\s+(?=[A-Z])|(?:^|\s)(?:[a-h]|\d{1,2}(?:\.\d)?)\s*[.)]\s+(?=[A-Z])|(?<=\b(?:tahun|bulan|\d{4}))[\s,.]+(?=[A-Z][a-z']+\s)|,\s*(?=[A-Z][a-z'’]{2,}\b)/
  );
  const hasil = [];
  for (const b of bagian) {
    const s = String(b || "")
      .replace(/^[\s,:.-]+/, "")
      .replace(/^(?:[a-h]|\d{1,2}(?:\.\d)?)\s*[.)]\s+/, "");
    if (!s || BUKAN_NAMA_DAFTAR.test(s) || /^(?:menetapkan|membebankan|mengabulkan|menyatakan)/i.test(s)) continue;
    const nama = potongEkorBukanNama(usulanService.namaDiAwal(s));
    if (!nama || nama.length < 3 || BUKAN_NAMA_DAFTAR.test(nama) || KATA_DOKUMEN.test(nama)) continue;
    const u = s.slice(nama.length).match(/^[\s,]*(?:\(?\s*)?(?:umur|usia|berumur|berusia)\s+(\d{1,2})\s*(?:\([^)]*\)\s*)?tahun/i);
    if (!hasil.some((h) => sama(h.nama, nama))) hasil.push({ nama, umur: u ? Number(u[1]) : null });
  }
  return hasil;
}

/** Kata dokumen/wilayah - potongan yang memuatnya bukan nama orang ("Sesuai Kutipan Akta Kelahiran Nomor"). */
const KATA_DOKUMEN = /\b(?:Sesuai|Kutipan|Akta|Nomor|Kependudukan|Propinsi|Provinsi|Kabupaten|Kecamatan|Desa|Kelurahan|Sertifikat|Surat|Keterangan|Dinas|Kantor|Pengadilan|Agama)\b/i;

/** "DEA PUSPITA Jenis Kelamin Perempuan" / "Irnatul Karima Binti Iwan Lahir" -> nama saja. */
function potongEkorBukanNama(nama) {
  const kata = String(nama || "").split(" ");
  const i = kata.findIndex(
    (k, n) => n > 0 && /^(?:lahir|jenis|umur|usia|no|nik|tempat|tanggal|agama|laki-laki|perempuan|pendidikan|pekerjaan|anak|bahwa|adapun|dengan|selanjutnya|yang)\.?$/i.test(k)
  );
  const hasil = (i > 0 ? kata.slice(0, i) : kata).join(" ");
  // "Bustamin bin Yod. Bahwa" - titik penutup kalimat sebelum kata yang dibuang ikut dibuang bila kata itu >= 3 huruf.
  return hasil.replace(/\s+(?:bin|binti|alias)$/i, "").replace(/([A-Za-z]{3,})\.$/, i > 0 ? "$1" : "$1.");
}

/** Bentuk banding nama: huruf kecil, hanya huruf/angka. */
function rapatNama(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Dua nama dianggap sama bila rapatnya sama, atau salah satunya = yang lain tanpa "bin/binti ...". */
function sama(a, b) {
  const ra = rapatNama(a);
  const rb = rapatNama(b);
  if (!ra || !rb) return false;
  if (ra === rb) return true;
  const inti = (s) => rapatNama(String(s).split(/\s+(?:bin|binti)\s+/i)[0]);
  return inti(a) === inti(b) && inti(a).length >= 4;
}

/** ["A", "B", "C"] -> "A, B dan C". */
function gabungDan(nama) {
  const d = (nama || []).filter(Boolean);
  if (d.length <= 1) return d[0] || "";
  return `${d.slice(0, -1).join(", ")} dan ${d[d.length - 1]}`;
}

/** Potongan sesudah pola sampai salah satu batas (tidak termasuk). */
function potongSesudah(teks, pola, batas) {
  const t = String(teks || "");
  const m = pola.exec(t);
  if (!m) return null;
  const sisa = t.slice(m.index + m[0].length);
  const b = batas ? sisa.search(batas) : -1;
  return { teks: (b >= 0 ? sisa.slice(0, b) : sisa).trim(), indeks: m.index, cocok: m[0] };
}

/** Isian fakta untuk kerangka deteksi (bentuk yang dibaca deteksi/index.usulanModul). */
function fakta(nilai, kalimatSumber, yakin, kodePola, asal) {
  if (!nilai) return null;
  return {
    nilai: String(nilai).replace(/\s+/g, " ").trim(),
    kalimat: String(kalimatSumber || "").slice(0, 400),
    yakin: yakin === "cukup" || yakin === "pasti" ? "cukup" : "ragu",
    kodePola,
    asal: asal || "posita",
  };
}

/** Menaruh fakta ke peta bila ada dan kodenya belum terisi. */
function taruh(peta, kode, isi) {
  if (isi && isi.nilai && !peta[kode]) peta[kode] = isi;
}

/** Kalimat (dari daftar) yang memuat semua pola `wajib`. */
function cariKalimat(daftar, ...wajib) {
  return (daftar || []).find((k) => wajib.every((w) => w.test(k))) || "";
}

module.exports = {
  BULAN,
  potongEkorBukanNama,
  polos,
  kalimat,
  angkaBulan,
  tanggalPertama,
  jumlahAnak,
  daftarNama,
  rapatNama,
  sama,
  gabungDan,
  potongSesudah,
  fakta,
  taruh,
  cariKalimat,
};
