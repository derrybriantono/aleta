"use strict";
/**
 * Pola kalimat penutup keterangan saksi dalam bentuk POSIX (MariaDB 5.5 REGEXP = Henry Spencer ERE):
 * tanpa \s, tanpa (?:...), tanpa \b, tanpa lookahead. Satu sumber dengan bot: POLA_PENUTUP_LENTUR dari
 * aleta_bot/services/penutupSaksi.js diterjemahkan secara mekanis (bukan ditulis ulang tangan), dan
 * uji (penutup-saksi-lentur.test.ts) menjaga isi FUNGSI.sql tetap sama dengan terjemahan ini.
 *
 * Teks yang dicocokkan SUDAH dinormalkan fungsi SQL: huruf kecil, spasi tunggal (tab/baris -> spasi, spasi
 * ganda dilipat), awalan butir/"bahwa" dan tanda baca ujung sudah dibuang. Karena itu:
 *   \s+ -> satu spasi        \s* -> spasi opsional        (?: -> (
 */
const path = require("node:path");

const RAIZ = path.resolve(__dirname, "../../..");
const { POLA_PENUTUP_LENTUR } = require(path.join(RAIZ, "aleta_bot/services/penutupSaksi.js"));

/** Terjemah mekanis sumber regex JS -> ERE POSIX; melempar galat bila masih ada konstruksi yang tak dikenal. */
function keposix(sumber) {
  const hasil = String(sumber).replace(/\(\?:/g, "(").replace(/\\s\+/g, " ").replace(/\\s\*/g, " ?");
  if (/\\|\(\?|\\b/.test(hasil)) throw new Error(`konstruksi JS tersisa dalam pola: ${hasil.slice(0, 120)}`);
  if (/'/.test(hasil)) throw new Error("tanda kutip dalam pola");
  return hasil;
}

const LENTUR = keposix(POLA_PENUTUP_LENTUR.source);

// Bagian lain dari adalahKalimatPenutupSaksi / pertanyaanPenutup (aleta_bot/services/penutupSaksi.js), ERE POSIX.
// "\b" JS (batas kata, \w = [A-Za-z0-9_]) -> (^|[^a-z0-9_]) di depan dan ([^a-z0-9_]|$) di belakang.
const KA = "(^|[^a-z0-9_])";
const KB = "([^a-z0-9_]|$)";
const POLA = {
  lentur: LENTUR,
  // "tidak ada yang (saya) ketahui" tanpa "lagi"/"lain" = jawaban perkara
  tidakAda: `${KA}tidak ada${KB}`,
  ketahui: `${KA}(ketahui|diketahui)${KB}`,
  lagiLain: `${KA}(lagi|lain)${KB}`,
  // bentuk bermakna ganda
  kesanggupan: `${KA}(sanggup|kuat|mampu)${KB}`,
  kerja: `${KA}(menjawab|memberi(kan)? keterangan|menerangkan|menjelaskan|melanjutkan|berbicara|bicara)${KB}`,
  pasti: `${KA}(cukup|sekian|terima kasih|tidak ada|sampai di sini|demikian|hanya itu|itu saja)${KB}`,
  // pertanyaan
  tanyaKesanggupanPerkara: `${KA}(sanggup|mampu|kuat|bisa|dapat)[^a-z0-9_?][^?]*(damai|rukun|nasihat|nasehat|pertahankan|bersatu|akur)`,
  tanyaPenutupA: "masih ada[^a-z0-9_?]([^?]*[^a-z0-9_?])?(sampaikan|sampikan|disampaikan|tanyakan|keterangan|hal lain)",
  tanyaPenutupB: `${KA}(sudah cukup|cukup sekian)${KB}`,
};

module.exports = { POLA, keposix, LENTUR };
