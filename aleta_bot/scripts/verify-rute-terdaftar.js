"use strict";

/**
 * ============================================================================
 * SETIAP RUTE YANG DITULIS HARUS BENAR-BENAR TERDAFTAR
 * ============================================================================
 *
 * Ada satu cacat yang lolos dari SELURUH penjagaan yang lazim, dan ia sudah
 * terjadi di berkas ini:
 *
 *   Sebuah rute baru disisipkan ke tempat yang salah - masuk ke dalam badan
 *   penangan rute tetangganya, bukan sejajar dengannya. Sebabnya sepele:
 *   jangkar penyisipan mencari `});` yang pertama, sementara `res.json({...});`
 *   di dalam penangan itu juga berakhir dengan `});`.
 *
 * Yang membuatnya mahal: berkasnya SAH secara tata bahasa. `node --check`
 * lulus. `require("../routes/internalGatewayRoutes")` lulus tanpa galat. Uji
 * yang memeriksa keberadaan teks rutenya di dalam berkas pun lulus - teksnya
 * memang ada di sana. Yang tidak lulus hanya satu: server menjawab
 * "Cannot GET /internal/aleta-bot/sipp/prompt-putusan", dan itu baru
 * ketahuan sesudah dinaikkan.
 *
 * ============================================================================
 * YANG DIPERIKSA DI SINI
 * ============================================================================
 *
 * Bukan teks di dalam berkas, melainkan tumpukan rute milik router yang SUDAH
 * JADI sesudah modulnya dimuat. Keduanya dibandingkan:
 *
 *   - setiap `router.<cara>("<jalur>")` yang tertulis harfiah di dalam berkas
 *     WAJIB muncul pada `router.stack`;
 *   - sebaliknya, rute yang terdaftar tetapi tidak tertulis harfiah dilaporkan
 *     sebagai keterangan, bukan kegagalan - rute yang jalurnya disusun dari
 *     peubah memang tidak terjangkau pembacaan teks.
 *
 * Komentar dikosongkan lebih dahulu. Tanpa itu, contoh rute yang ditulis di
 * dalam keterangan akan dituduh hilang, dan penjaga yang menuduh berkas benar
 * adalah penjaga yang akan dimatikan orang.
 *
 * Berjalan tanpa jaringan dan tanpa basis data.
 */

const fs = require("fs");
const path = require("path");

// Pemindai komentar dipakai bersama beberapa penjaga - satu salinan saja,
// supaya perbaikannya tidak perlu diulang di tiap tempat.
const { kosongkanKomentar } = require("./lib/kosongkan-komentar");

let lulus = 0;
let gagal = 0;

function periksa(nama, benar, keterangan) {
  if (benar) {
    lulus += 1;
    console.log(`  OK    ${nama}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${nama}${keterangan ? ` - ${keterangan}` : ""}`);
  }
}

const BERKAS_RUTE = [
  { modul: "../routes/internalGatewayRoutes", berkas: "routes/internalGatewayRoutes.js" },
];

function kunci(cara, jalur) {
  return `${String(cara).toLowerCase()} ${jalur}`;
}

async function utama() {
  console.log("");
  console.log("== Pemindai komentar penjaga ini sendiri ==");
  {
    const contoh = [
      '// router.get("/contoh-di-komentar", x);',
      '/* router.post("/juga-di-komentar", y); */',
      'router.get("/sungguhan", z);',
    ].join("\n");
    const bersih = kosongkanKomentar(contoh);
    periksa("rute di dalam komentar satu baris tidak terbaca", !/\/contoh-di-komentar/.test(bersih));
    periksa("rute di dalam komentar berblok tidak terbaca", !/\/juga-di-komentar/.test(bersih));
    periksa("rute sungguhan tetap terbaca", /\/sungguhan/.test(bersih));
    periksa("panjang baris tidak berubah", kosongkanKomentar(contoh).split("\n").length === 3);
    periksa(
      "garis miring ganda di dalam tali kata bukan komentar",
      /http:\/\/a/.test(kosongkanKomentar('const u = "http://a"; router.get("/x", z);'))
    );
  }

  for (const { modul, berkas } of BERKAS_RUTE) {
    console.log("");
    console.log(`== ${berkas} ==`);

    const jalurBerkas = path.resolve(__dirname, "..", berkas);
    periksa("berkas rute ada", fs.existsSync(jalurBerkas));
    if (!fs.existsSync(jalurBerkas)) continue;

    const sumber = kosongkanKomentar(fs.readFileSync(jalurBerkas, "utf8"));

    // Hanya jalur yang ditulis harfiah. Yang disusun dari peubah memang tidak
    // dijanjikan tertangkap di sini, dan itu disebutkan pada laporannya.
    const tertulis = [];
    const pola = /router\s*\.\s*(get|post|put|patch|delete|all)\s*\(\s*(["'`])([^"'`]+)\2/g;
    let cocok;
    while ((cocok = pola.exec(sumber)) !== null) {
      tertulis.push({ cara: cocok[1], jalur: cocok[3] });
    }

    // Jumlah pemanggilan router.<cara>( seluruhnya, termasuk yang jalurnya
    // bukan tulisan harfiah - selisihnya dilaporkan supaya tidak ada yang
    // menyangka penjaga ini menjangkau semuanya.
    const seluruhPemanggilan = (sumber.match(/router\s*\.\s*(get|post|put|patch|delete|all)\s*\(/g) || []).length;

    periksa("ada rute yang tertulis harfiah", tertulis.length > 20, `dapat ${tertulis.length}`);

    let router;
    try {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      router = require(modul);
    } catch (galat) {
      periksa("modul rute dapat dimuat", false, galat.message);
      continue;
    }
    periksa("modul rute dapat dimuat", true);

    const tumpukan = (router && router.stack) || [];
    const terdaftar = new Set();
    const jalurTerdaftar = new Set();
    tumpukan.forEach((lapis) => {
      if (!lapis.route) return;
      jalurTerdaftar.add(lapis.route.path);
      Object.keys(lapis.route.methods || {}).forEach((cara) => {
        terdaftar.add(kunci(cara, lapis.route.path));
      });
    });

    periksa("router memuat tumpukan rute", jalurTerdaftar.size > 20, `dapat ${jalurTerdaftar.size}`);

    const hilang = tertulis.filter((r) => !terdaftar.has(kunci(r.cara, r.jalur)));
    periksa(
      `seluruh ${tertulis.length} rute yang tertulis benar-benar terdaftar`,
      hilang.length === 0,
      hilang.length
        ? `tidak terdaftar: ${hilang.map((r) => `${r.cara.toUpperCase()} ${r.jalur}`).join(", ")} ` +
          "- kemungkinan besar tersisip ke dalam badan penangan rute tetangganya"
        : ""
    );

    // Rute ganda: dua pendaftaran dengan cara dan jalur yang sama membuat yang
    // kedua tidak pernah terpanggil, dan tidak ada galat apa pun.
    const dihitung = new Map();
    tertulis.forEach((r) => {
      const k = kunci(r.cara, r.jalur);
      dihitung.set(k, (dihitung.get(k) || 0) + 1);
    });
    const ganda = [...dihitung.entries()].filter(([, n]) => n > 1);
    periksa(
      "tidak ada rute yang didaftarkan dua kali",
      ganda.length === 0,
      ganda.map(([k, n]) => `${k} (${n} kali)`).join(", ")
    );

    console.log(`        ${tertulis.length} rute tertulis harfiah, ${jalurTerdaftar.size} jalur terdaftar`);
    if (seluruhPemanggilan > tertulis.length) {
      console.log(
        `        ${seluruhPemanggilan - tertulis.length} pemanggilan router.<cara>( jalurnya bukan tulisan harfiah - tidak dijanjikan tertangkap`
      );
    }
  }

  console.log("");
  console.log(`Hasil: ${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal > 0 ? 1 : 0);
}

utama().catch((galat) => {
  console.error(galat);
  process.exit(1);
});
