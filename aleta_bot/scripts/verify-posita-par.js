"use strict";

/**
 * ============================================================================
 * ANGKA BUTIR YANG DITELAN \par - DIBUKTIKAN, BUKAN DIDUGA
 * ============================================================================
 *
 * Skrip ini menjalankan perapian posita ALETA lalu MENIRU
 * TemplateHelper::cleanHtmlTagSpecial milik ABT apa adanya, baris demi baris,
 * dan memeriksa apakah nomor butirnya selamat sampai ke teks RTF.
 *
 * Tiruannya dibaca langsung dari
 * /var/www/html/aps_badilag/application/libraries/TemplateHelper.php:
 *
 *   18  str_replace("</p>", "\par", $text)        <- tanpa spasi
 *   19  str_replace(" <p",  "<p",    $text)       <- spasi di depan dibuang
 *   20  str_replace("-   ", "-\tab ", $text)
 *   22  str_replace(".   ", ".\tab ", $text)
 *   25  str_replace("   ",  "\tab ",  $text)
 *   26  preg_replace('/<br\s*\/?>/i', "\par ", $text)
 *   30  str_replace("  ", " ", $text)
 *   42  filter_var($text, FILTER_SANITIZE_STRING)  <- seluruh tag disapu
 *
 * Yang diuji BUKAN tiruannya melainkan akibatnya: sesudah semua itu, apakah
 * masih ada `\par` yang langsung menempel pada huruf atau angka. Bila ada,
 * pembaca RTF akan menelannya.
 *
 * Berjalan tanpa jaringan dan tanpa basis data.
 */

const layanan = require("../services/sippPositaService");

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

/** Tiruan cleanHtmlTagSpecial - hanya langkah yang menyentuh pemisah. */
function keRtf(teks) {
  let t = String(teks);
  t = t.split("</p>").join("\\par");
  t = t.split(" <p").join("<p");
  t = t.split("-   ").join("-\\tab ");
  t = t.split("-  ").join("-\\tab ");
  t = t.split(".   ").join(".\\tab ");
  t = t.split(".  ").join(".\\tab ");
  t = t.split("    ").join("\\tab ");
  t = t.split("   ").join("\\tab ");
  t = t.replace(/<br\s*\/?>/gi, "\\par ");
  t = t.split("  ").join(" ");
  // filter_var(FILTER_SANITIZE_STRING) menyapu seluruh tag yang tersisa.
  t = t.replace(/<[^>]*>/g, "");
  return t;
}

/**
 * Kata kendali RTF yang MENEMPEL pada huruf atau angka.
 *
 * `\par2` dibaca sebagai kata kendali berparameter 2 - angkanya ditelan.
 * `\parKedua` dibaca sebagai kata kendali bernama "parKedua" - seluruh katanya
 * ditelan. Keduanya yang dicari di sini.
 */
function parMenempel(rtf) {
  const cocok = [];
  const pola = /\\par([0-9A-Za-z])/g;
  let satu;
  while ((satu = pola.exec(rtf)) !== null) {
    cocok.push(rtf.slice(satu.index, satu.index + 28).replace(/\n/g, " "));
  }
  return cocok;
}

// ---------------------------------------------------------------- bahannya
//
// Posita 521/Pdt.G/2026/PA.Dgl apa adanya dari SIPP - bentuk yang dipakai
// 6.269 dari 8.097 posita PA Donggala.
const POSITA_ASLI =
  "<p>1. Bahwa pada tanggal 15 Maret 1997, Penggugat dan Tergugat telah melangsungkan pernikahan;</p>" +
  "<p>2. Bahwa setelah menikah, Penggugat dan Tergugat tinggal bersama di rumah Tergugat.</p>" +
  "<p>3. Bahwa setelah menikah Penggugat dan Tergugat dikaruniai 2 (dua) orang anak bernama;</p>" +
  "<p>1. Clara Pranandita binti Umar M Paewa, Usia 26 tahun</p>" +
  "<p>2. Chariel Pichard Paewa bin Umar M Paewa, Usia 20 tahun</p>" +
  "<p>Kedua anak tersebut saat ini dalam pengasuhan Tergugat</p>" +
  "<p>4. Bahwa sejak bulan Juni 2009 keadaan rumah tangga mulai tidak harmonis.</p>";

(async () => {
  console.log("posita - angka butir yang ditelan \\par");

  // ======================================================================
  // 1. Keadaan SEBELUM diperbaiki masih dapat dilihat akibatnya
  // ======================================================================
  const rtfAsli = keRtf(POSITA_ASLI);
  const menempelAsli = parMenempel(rtfAsli);
  periksa(
    "posita apa adanya MEMANG menghasilkan \\par yang menempel",
    menempelAsli.length >= 6,
    `${menempelAsli.length} tempat`
  );
  if (menempelAsli.length > 0) {
    console.log(`        contoh: ${menempelAsli.slice(0, 3).join("  |  ")}`);
  }

  // ======================================================================
  // 2. Sesudah dirapikan ALETA, tidak satu pun tersisa
  // ======================================================================
  const rapi = layanan.rapikanTeksPosita(POSITA_ASLI);
  const rtfRapi = keRtf(rapi);
  const menempelRapi = parMenempel(rtfRapi);
  periksa(
    "sesudah dirapikan, tidak ada \\par yang menempel",
    menempelRapi.length === 0,
    menempelRapi.slice(0, 3).join("  |  ")
  );

  // ======================================================================
  // 3. Nomor butirnya sungguh terbaca di teks RTF-nya
  // ======================================================================
  for (const butir of ["1. Bahwa", "2. Bahwa", "3. Bahwa", "4. Bahwa"]) {
    periksa(`butir "${butir}" utuh di RTF`, rtfRapi.includes(butir));
  }
  periksa('anak "1. Clara" utuh di RTF', rtfRapi.includes("1. Clara"));
  periksa('anak "2. Chariel" utuh di RTF', rtfRapi.includes("2. Chariel"));
  periksa('paragraf "Kedua anak tersebut" utuh di RTF', rtfRapi.includes("Kedua anak tersebut"));

  // ======================================================================
  // 4. Tidak satu huruf pun isinya berubah
  // ======================================================================
  const kata = (teks) =>
    teks
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  periksa(
    "isi positanya tidak berubah, hanya pemisahnya",
    kata(rapi) === kata(POSITA_ASLI),
    `${kata(rapi).length} vs ${kata(POSITA_ASLI).length} huruf`
  );

  // ======================================================================
  // 5. Penanda bertingkat dan berkurung
  // ======================================================================
  const bertingkat = layanan.rapikanTeksPosita(
    "1. Bahwa Penggugat menuntut. 1.1 Bahwa nafkah lampau. 1.2 Bahwa nafkah iddah. a) Bahwa mut'ah."
  );
  periksa("butir 1.1 dikenali dan dipecah", bertingkat.includes("1.1"), bertingkat.slice(0, 160));
  periksa("butir 1.2 dikenali", bertingkat.includes("1.2"));
  periksa("anak butir berkurung a) dikenali", bertingkat.includes("a)"));
  periksa(
    "yang bertingkat digeser melekuk seperti anak butir",
    /<p>\s{3}1\.1/.test(bertingkat) || bertingkat.includes("<p>   1.1"),
    bertingkat.slice(0, 200)
  );

  // ======================================================================
  // 6. Paragraf hampa dibuang - itulah jarak yang tidak rata
  // ======================================================================
  const berhampa = layanan.rapikanTeksPosita("<p>1. Bahwa satu;</p><p>&nbsp;</p><p>2. Bahwa dua;</p>");
  periksa("paragraf hampa dibuang", !/<p[^>]*>(?:\s|&nbsp;)*<\/p>/i.test(berhampa), berhampa);

  console.log(`\nlulus ${lulus}, gagal ${gagal}`);
  process.exit(gagal === 0 ? 0 : 1);
})().catch((galat) => {
  console.error("GAGAL TOTAL", galat);
  process.exit(1);
});
