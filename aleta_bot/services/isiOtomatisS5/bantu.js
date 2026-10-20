"use strict";

/**
 * Pembantu pengisi otomatis jenis S5 (dispensasi kawin, perwalian, asal usul anak, wali adhal, penetapan ahli waris).
 * MURNI: tanpa basis data, tanpa jaringan. Dipakai modul-modul di folder ini.
 */

const KEYAKINAN = Object.freeze(["pasti", "cukup", "ragu"]);
const BULAN = Object.freeze(["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]);
const BULAN_ALIAS = Object.freeze({ pebruari: 2, nopember: 11, augustus: 8, okt: 10, sept: 9 });

/**
 * Satu usulan isian dalam bentuk yang dibaca ekstensi (sama dengan butir abtIsianSippLanjutan.js).
 * asal: "sipp" (data terstruktur SIPP), "data-nikah", "posita-gugatan" (kalimat posita/petitum) - menentukan lencana asal.
 */
function butir({ kode, nama, nilai, keyakinan, kalimat, asal, catatan, kodePola }) {
  const yakin = KEYAKINAN.includes(keyakinan) ? keyakinan : "ragu";
  return {
    kode: String(kode),
    nama: nama || String(kode),
    nilai: String(nilai == null ? "" : nilai),
    keyakinan: yakin,
    bentrok: "",
    sumber: kalimat ? [{ saksi: 0, asal: asal || "sipp", kalimat: String(kalimat).replace(/\s+/g, " ").trim().slice(0, 400) }] : [],
    catatan: catatan || "",
    dihitung: false,
    jagaIsianLama: true,
    kodePola: kodePola || `s5-${kode}`,
  };
}

/** Huruf kecil, hanya huruf/angka satu spasi - pembanding nama dan teks. */
const normal = (s) => String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const rapat = (s) => normal(s).replace(/ /g, "");

/** Nama tanpa "bin/binti ..." (nama diri saja), huruf kecil rapat. */
const intiNama = (s) => rapat(String(s || "").split(/\s+(?:bin|binti)\s+/i)[0]);

/** Dua nama sama bila rapatnya sama, atau nama dirinya sama (panjang >= 4). */
function samaNama(a, b) {
  const ra = rapat(a);
  const rb = rapat(b);
  if (!ra || !rb) return false;
  if (ra === rb) return true;
  const ia = intiNama(a);
  return ia === intiNama(b) && ia.length >= 4;
}

/** Spasi ganda dan spasi ujung dibuang ("Fardin bin Hasamatu " -> "Fardin bin Hasamatu"). */
const rapikanNama = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").replace(/\s+([,.])/g, "$1").trim();

function isoValid(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m || m[1] === "0000" || m[2] === "00" || m[3] === "00") return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 ? { t: Number(m[1]), b: Number(m[2]), h: Number(m[3]) } : null;
}

/** "YYYY-MM-DD" -> "DD/MM/YYYY" (bentuk tampil usulan tanggal); "" bila bukan tanggal sungguhan. */
function isoKeTampil(iso) {
  const d = isoValid(iso);
  return d ? `${String(d.h).padStart(2, "0")}/${String(d.b).padStart(2, "0")}/${d.t}` : "";
}

/** "YYYY-MM-DD" -> "05 Juni 2026" (bentuk tulis naskah); "" bila bukan tanggal. */
function isoKeIndonesia(iso) {
  const d = isoValid(iso);
  return d ? `${String(d.h).padStart(2, "0")} ${BULAN[d.b - 1]} ${d.t}` : "";
}

/** "5 Juni 2026" / "05 juni 2026" -> "YYYY-MM-DD"; "" bila bukan tanggal. */
function indonesiaKeIso(teks) {
  const m = /\b(\d{1,2})\s+([A-Za-z]+)\s+(?:tahun\s+)?(\d{4})\b/.exec(String(teks || ""));
  if (!m) return "";
  const nama = m[2].toLowerCase();
  let b = BULAN.findIndex((x) => x.toLowerCase() === nama) + 1;
  if (!b) b = BULAN_ALIAS[nama] || 0;
  if (!b) return "";
  const iso = `${m[3]}-${String(b).padStart(2, "0")}-${String(Number(m[1])).padStart(2, "0")}`;
  return isoValid(iso) ? iso : "";
}

/** Umur penuh (tahun) pada tanggal acuan; null bila salah satu tanggal tidak sah atau lahir sesudah acuan. */
function umurTahun(lahirIso, acuanIso) {
  const l = isoValid(lahirIso);
  const a = isoValid(acuanIso);
  if (!l || !a) return null;
  let u = a.t - l.t;
  if (a.b < l.b || (a.b === l.b && a.h < l.h)) u -= 1;
  return u >= 0 ? u : null;
}

const SATUAN = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];
function terbilangBulat(x) {
  const v = Math.floor(Number(x));
  if (!Number.isFinite(v) || v < 0) return "";
  if (v === 0) return "nol";
  const baca = (n) => {
    if (n < 12) return SATUAN[n];
    if (n < 20) return `${SATUAN[n - 10]} belas`;
    if (n < 100) return `${SATUAN[Math.floor(n / 10)]} puluh${n % 10 ? ` ${SATUAN[n % 10]}` : ""}`;
    if (n < 200) return `seratus${n % 100 ? ` ${baca(n % 100)}` : ""}`;
    if (n < 1000) return `${SATUAN[Math.floor(n / 100)]} ratus${n % 100 ? ` ${baca(n % 100)}` : ""}`;
    if (n < 2000) return `seribu${n % 1000 ? ` ${baca(n % 1000)}` : ""}`;
    if (n < 1e6) return `${baca(Math.floor(n / 1000))} ribu${n % 1000 ? ` ${baca(n % 1000)}` : ""}`;
    if (n < 1e9) return `${baca(Math.floor(n / 1e6))} juta${n % 1e6 ? ` ${baca(n % 1e6)}` : ""}`;
    if (n < 1e12) return `${baca(Math.floor(n / 1e9))} miliar${n % 1e9 ? ` ${baca(n % 1e9)}` : ""}`;
    return "";
  };
  return baca(v);
}

/** 1500000 -> "Rp1.500.000,00 (satu juta lima ratus ribu rupiah)"; "" bila bukan angka positif. */
function rupiahBerbilang(n) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v <= 0) return "";
  const t = terbilangBulat(v);
  if (!t) return "";
  return `Rp${String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ".")},00 (${t} rupiah)`;
}

/** 7 -> "7 (tujuh)"; di luar 0..99 hanya angkanya. */
function angkaBerbilang(n) {
  const v = Number(n);
  if (!Number.isInteger(v) || v < 0 || v > 999) return String(n);
  return `${v} (${terbilangBulat(v)})`;
}

/** Nama jenis kelamin dari sandi SIPP (L/P, 1/2). */
const jenisKelamin = (jk) => (/^(L|1)$/i.test(String(jk || "")) ? "L" : /^(P|2)$/i.test(String(jk || "")) ? "P" : "");

/** "a, b dan c". */
function daftarKalimat(daftar) {
  const d = (daftar || []).filter(Boolean);
  if (d.length <= 1) return d.join("");
  if (d.length === 2) return `${d[0]} dan ${d[1]}`;
  return `${d.slice(0, -1).join(", ")}, dan ${d[d.length - 1]}`;
}

/** Posita/petitum HTML -> satu baris polos (entitas umum diurai). */
function polos(html) {
  return String(html == null ? "" : html)
    .replace(/<\s*br\s*\/?>/gi, " ")
    .replace(/<\/\s*(?:p|div|li|tr)\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&rsquo;|&lsquo;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

module.exports = {
  KEYAKINAN,
  BULAN,
  butir,
  normal,
  rapat,
  intiNama,
  samaNama,
  rapikanNama,
  isoValid,
  isoKeTampil,
  isoKeIndonesia,
  indonesiaKeIso,
  umurTahun,
  terbilangBulat,
  rupiahBerbilang,
  angkaBerbilang,
  jenisKelamin,
  daftarKalimat,
  polos,
};
