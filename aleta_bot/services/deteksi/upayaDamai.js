"use strict";

/**
 * ============================================================================
 * SIAPA YANG MENDAMAIKAN (1268 UPAYA DAMAI) - 27 Okt 2026
 * ============================================================================
 *
 * Kalimat 1268 tetap seperti sekarang ("pihak keluarga telah berusaha untuk mendamaikan
 * {lawan} dan {pelaku}, namun tidak berhasil"); yang disesuaikan hanya PELAKU upaya damainya:
 *
 *   keluarga   keluarga / orang tua / mertua / saudara
 *   aparat     pemerintah desa/kelurahan, RT/RW, tokoh adat/agama/masyarakat, KUA, aparat keamanan
 *   keduanya   keluarga DAN aparat
 *   lainnya    tetangga, teman, mediator, saksi sendiri
 *   ""         tidak terbaca -> kalimat bawaan, ruas dapat dipilih manual dari empat pilihan
 *
 * Pola (kamus-deteksi/awal/perukun.json + lapis database; ruas tambahan `kategori`, `teks`, `urut`)
 * hanya dicari di jendela kalimat sekitar kata upaya damainya, bukan seluruh kalimat. Murni.
 */

const kamus = require("../kamusDeteksi");

const KELOMPOK = "perukun";
let cache = { versi: -1, daftar: null };

function polaPerukun() {
  const v = kamus.versi();
  if (cache.versi === v && cache.daftar) return cache.daftar;
  const daftar = kamus
    .polaKelompok(KELOMPOK)
    .filter((p) => (p.status || "aktif") === "aktif" && p.kategori)
    .sort((a, b) => (a.urut || 0) - (b.urut || 0));
  cache = { versi: v, daftar };
  return daftar;
}

/**
 * @param kalimat {string}
 * @param jangkar {RegExp} kata upaya damai; jendelanya 60 huruf sebelum dan 140 sesudah (terpotong titik koma)
 * @returns {{kategori: ""|"keluarga"|"aparat"|"keduanya"|"lainnya", kunci: string[], teks: string[]}}
 */
function perukunDari(kalimat, jangkar) {
  const k = String(kalimat || "");
  let jendela = k;
  if (jangkar) {
    const m = jangkar.exec(k);
    if (m) {
      const sesudah = k.slice(m.index, m.index + 140).split(";")[0];
      jendela = k.slice(Math.max(0, m.index - 60), m.index) + sesudah;
    }
  }
  jendela = jendela.slice(0, 300);
  const kunci = [];
  const teks = [];
  const kategori = new Set();
  for (const p of polaPerukun()) {
    if (p.re.test(jendela)) {
      kunci.push(p.kunci);
      kategori.add(p.kategori);
      if (!teks.includes(p.teks || p.label)) teks.push(p.teks || p.label);
    }
  }
  return ringkas(kunci, teks, kategori);
}

function ringkas(kunci, teks, kategori) {
  const ada = (x) => kategori.has(x);
  let hasil = "";
  if (ada("keluarga") && ada("aparat")) hasil = "keduanya";
  else if (ada("keluarga")) hasil = "keluarga";
  else if (ada("aparat")) hasil = "aparat";
  else if (ada("lainnya")) hasil = "lainnya";
  return { kategori: hasil, kunci, teks };
}

/** Gabungan beberapa hasil (saksi 1, saksi 2, posita): irisan tidak dipaksakan - semua yang disebut dipakai. */
function gabungPerukun(daftar) {
  const kunci = [];
  const teks = [];
  const kategori = new Set();
  const peta = new Map(polaPerukun().map((p) => [p.kunci, p]));
  for (const d of daftar || []) {
    if (!d || !d.kategori) continue;
    for (const k of d.kunci) {
      if (kunci.includes(k)) continue;
      kunci.push(k);
      const p = peta.get(k);
      if (p) {
        kategori.add(p.kategori);
        if (!teks.includes(p.teks || p.label)) teks.push(p.teks || p.label);
      }
    }
  }
  return ringkas(kunci, teks, kategori);
}

function dan(x) {
  if (x.length <= 1) return x.join("");
  if (x.length === 2) return `${x[0]} dan ${x[1]}`;
  return `${x.slice(0, -1).join(", ")}, dan ${x[x.length - 1]}`;
}

/** Frasa pelaku di kalimat: "pihak keluarga", "aparat pemerintah desa dan tokoh adat", "pihak keluarga serta ...". */
function teksPerukun(p) {
  if (!p || !p.kategori) return "";
  const peta = new Map(polaPerukun().map((x) => [x.kunci, x]));
  const dari = (kat) => p.kunci.map((k) => peta.get(k)).filter((x) => x && x.kategori === kat).map((x) => x.teks || x.label);
  const keluarga = dari("keluarga")[0] || "pihak keluarga";
  const aparat = dan([...new Set(dari("aparat"))].slice(0, 3));
  switch (p.kategori) {
    case "keluarga":
      return keluarga;
    case "aparat":
      return aparat;
    case "keduanya":
      return `${keluarga} serta ${aparat}`;
    case "lainnya":
      return dari("lainnya")[0] || "pihak lain";
    default:
      return "";
  }
}

/** Empat pilihan manual (bila pendamainya tidak terbaca): kategori -> frasa pelaku baku. */
const PILIHAN_BAKU = Object.freeze([
  { kategori: "keluarga", keadaan: "didamaikan keluarga", frasa: "pihak keluarga" },
  { kategori: "aparat", keadaan: "didamaikan aparat (pemerintah desa/kelurahan, tokoh agama/adat, KUA, RT/RW)", frasa: "aparat pemerintah desa/kelurahan dan tokoh masyarakat setempat" },
  { kategori: "keduanya", keadaan: "didamaikan keluarga dan aparat", frasa: "pihak keluarga serta aparat pemerintah desa/kelurahan dan tokoh masyarakat setempat" },
  { kategori: "lainnya", keadaan: "didamaikan pihak lain", frasa: "pihak lain" },
]);

module.exports = { perukunDari, gabungPerukun, teksPerukun, PILIHAN_BAKU, KELOMPOK };
