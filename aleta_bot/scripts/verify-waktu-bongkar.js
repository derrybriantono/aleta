"use strict";

/**
 * ============================================================================
 * JAM BONGKAR - DIBUKTIKAN, BUKAN DIJAGA TEKSNYA SAJA
 * ============================================================================
 *
 * Empat hal yang harus benar, dan tidak satu pun dapat dibuktikan penjaga
 * teks:
 *
 *   1. PMH mendapat jam SEKARANG - tidak ada baris bertanggal masa depan
 *   2. urutannya PHS < PJS < PPP < PMH - mengikuti urutan bongkar
 *   3. tiap jeda 1 sampai 10 menit, tidak pernah nol, tidak pernah mundur
 *   4. jedanya TETAP untuk satu perkara, dan BERBEDA dari jeda jalur tulis
 *      perkara yang sama - dua rangkaian berjeda identik pun sebuah tanda
 *
 * Berjalan tanpa jaringan dan tanpa basis data - db_config diganti penadah
 * yang menjawab NOW() dengan jam tetap.
 */

let lulus = 0;
let gagal = 0;

function periksa(nama, benar, tambahan = "") {
  if (benar) {
    lulus += 1;
    console.log(`  OK    ${nama}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${nama}${tambahan ? ` - ${tambahan}` : ""}`);
  }
}

const SEKARANG = "2026-09-15 15:19:43";

const dbPath = require.resolve("../db_config");
require("../db_config");
require.cache[dbPath].exports = {
  query: (sql, params, selesai) => {
    if (/NOW\(\)/i.test(String(sql))) return selesai(null, [{ saat: SEKARANG }]);
    return selesai(null, []);
  },
};

const layanan = require("../services/penetapanTulisService");

const keMenit = (teks) => Math.round(new Date(String(teks).replace(" ", "T")).getTime() / 60000);

(async () => {
  console.log("jam bongkar - empat pejabat, empat menit berbeda");

  const jam = await layanan.waktuBongkar(10119);
  console.log(`        ${["phs", "pjs", "ppp", "pmh"].map((j) => `${j}=${jam[j]}`).join("  ")}`);

  periksa("keempat langkah mendapat jam", ["phs", "pjs", "ppp", "pmh"].every((j) => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(jam[j] || "")));
  periksa("PMH = sekarang, bukan masa depan", jam.pmh === SEKARANG, jam.pmh);

  const m = { phs: keMenit(jam.phs), pjs: keMenit(jam.pjs), ppp: keMenit(jam.ppp), pmh: keMenit(jam.pmh) };
  periksa("urutan PHS < PJS < PPP < PMH", m.phs < m.pjs && m.pjs < m.ppp && m.ppp < m.pmh, JSON.stringify(m));

  const jeda = [m.pjs - m.phs, m.ppp - m.pjs, m.pmh - m.ppp];
  periksa("tiap jeda 1-10 menit", jeda.every((x) => x >= 1 && x <= 10), jeda.join(","));
  periksa("tidak ada yang lebih dari sekarang", ["phs", "pjs", "ppp"].every((j) => m[j] < m.pmh));

  const lagi = await layanan.waktuBongkar(10119);
  periksa("tetap untuk perkara yang sama", JSON.stringify(lagi) === JSON.stringify(jam));

  // Jeda jalur tulis untuk perkara yang sama, dihitung dari waktuLangkah.
  const tulis = ["pmh", "ppp", "pjs", "phs"].map((jenis) =>
    keMenit(layanan.waktuLangkah({ perkaraId: 10119, tanggalPenetapan: "2026-09-15", jenis, saatServer: SEKARANG }))
  );
  const jedaTulis = [tulis[1] - tulis[0], tulis[2] - tulis[1], tulis[3] - tulis[2]];
  periksa(
    "pola jedanya berbeda dari jalur tulis perkara yang sama",
    jedaTulis.join(",") !== jeda.join(","),
    `tulis ${jedaTulis.join(",")} vs bongkar ${jeda.join(",")}`
  );

  // Dua perkara berbeda - jedanya tidak identik (bukan satu pola untuk semua).
  const lain = await layanan.waktuBongkar(10118);
  const ml = { phs: keMenit(lain.phs), pjs: keMenit(lain.pjs), ppp: keMenit(lain.ppp), pmh: keMenit(lain.pmh) };
  const jedaLain = [ml.pjs - ml.phs, ml.ppp - ml.pjs, ml.pmh - ml.ppp];
  periksa("perkara lain berjeda lain", jedaLain.join(",") !== jeda.join(","), `${jeda.join(",")} vs ${jedaLain.join(",")}`);

  console.log(`\nlulus ${lulus}, gagal ${gagal}`);
  process.exit(gagal === 0 ? 0 : 1);
})().catch((galat) => {
  console.error("GAGAL TOTAL", galat);
  process.exit(1);
});
