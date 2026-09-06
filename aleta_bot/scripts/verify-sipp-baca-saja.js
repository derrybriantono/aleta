"use strict";

/**
 * ============================================================================
 * SIPP HANYA BOLEH DIBACA - DIPERIKSA DI SELURUH BOT, BUKAN SEBAGIAN
 * ============================================================================
 *
 * `verify-pemisahan-database.js` sudah menjaga hal ini dan tetap berjalan;
 * penjaga ini TIDAK menggantikannya. Yang ditutup di sini adalah empat celah
 * pada jangkauannya - diukur pada 7 September 2026, bukan dikira-kira:
 *
 *   1. Ia hanya memindai `aleta_bot/services/*.js`. Padahal TIGA berkas
 *      produksi di luar folder itu menyentuh SIPP dan tidak pernah dipindai
 *      sama sekali: detail.js, notifikasi.js, dan query.js - yang terakhir
 *      berisi 6.499 baris dan yang kedua 18.794 baris.
 *
 *   2. Ia hanya mengenali berkas yang memuat persis `require("../db_config")`
 *      dengan petik ganda. Petik tunggal membuat berkasnya dilewati seluruhnya
 *      - tanpa peringatan apa pun.
 *
 *   3. Ia menuntut peubah sambungannya bernama `db`. Padahal
 *      kendaliBerkasService.js menamainya `sipp`, sehingga seluruh kuerinya
 *      tidak pernah diperiksa walau berkasnya termasuk yang dipindai.
 *
 *   4. Ia hanya memeriksa kueri yang ditulis langsung sebagai tali kata
 *      bertanda punggung pada pemanggilannya. Padahal bentuk yang paling
 *      banyak dipakai justru `db.query(query)` - kuerinya disusun ke dalam
 *      peubah lebih dahulu. Ada 265 kueri berbentuk begitu di ketiga berkas
 *      pada butir 1, dan tidak satu pun pernah diperiksa.
 *
 * ============================================================================
 * MENGAPA INI PENTING
 * ============================================================================
 *
 * SIPP adalah basis data pengadilan yang sedang dipakai petugas saat ini juga.
 * Satu UPDATE yang lolos ke sana bukan bug yang dapat dibatalkan dengan
 * memasang versi sebelumnya - ia mengubah data perkara orang. Karena itu yang
 * dijaga bukan "sebagian besar kueri", melainkan seluruhnya.
 *
 * Berjalan tanpa jaringan dan tanpa basis data - hanya membaca berkas.
 */

const fs = require("fs");
const path = require("path");
const { kosongkanKomentar, nomorBaris } = require("./lib/kosongkan-komentar");

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

const AKAR = path.resolve(__dirname, "..");

/**
 * Folder yang tidak ikut dipindai.
 *
 * `scripts/` sengaja dikecualikan: naskah penjaga memang menuliskan contoh
 * kueri yang salah supaya dapat menguji penolakannya, dan memindai naskah
 * penjaga akan membuat penjaga menuduh dirinya sendiri.
 */
const LEWATI_FOLDER = new Set(["node_modules", "scripts", ".git", "data", "reports", "temp", "logs"]);

function kumpulkanBerkas(folder, hasil = []) {
  for (const isi of fs.readdirSync(folder, { withFileTypes: true })) {
    if (isi.isDirectory()) {
      if (LEWATI_FOLDER.has(isi.name)) continue;
      kumpulkanBerkas(path.join(folder, isi.name), hasil);
    } else if (isi.name.endsWith(".js")) {
      hasil.push(path.join(folder, isi.name));
    }
  }
  return hasil;
}

/** Kata kerja yang mengubah keadaan basis data. Lebih lengkap daripada daftar lama. */
const KATA_TULIS =
  /^(INSERT|UPDATE|DELETE|REPLACE|TRUNCATE|CREATE|ALTER|DROP|GRANT|REVOKE|RENAME|CALL|LOCK|UNLOCK|LOAD|HANDLER|SET|START|COMMIT|ROLLBACK|BEGIN)\b/i;
const KATA_BACA = /^(SELECT|SHOW|WITH|DESCRIBE|DESC|EXPLAIN)\b/i;

/**
 * Nama peubah sambungan SIPP di sebuah berkas.
 * Mengenali petik tunggal maupun ganda, dan nama apa pun - bukan hanya `db`.
 */
function peubahSipp(sumber) {
  const nama = new Set();
  const pola = /(?:const|let|var)\s+(\w+)\s*=\s*require\(\s*['"][^'"]*\bdb_config['"]\s*\)/g;
  let m;
  while ((m = pola.exec(sumber)) !== null) nama.add(m[1]);
  return [...nama];
}

/** Peubah bot (bot_db_config) - basis data ALETA sendiri, boleh ditulisi. */
function peubahBot(sumber) {
  const nama = new Set();
  const pola = /(?:const|let|var)\s+(\w+)\s*=\s*require\(\s*['"][^'"]*\bbot_db_config['"]\s*\)/g;
  let m;
  while ((m = pola.exec(sumber)) !== null) nama.add(m[1]);
  return [...nama];
}

/** Kata pertama sebuah kueri, sudah dibersihkan dari kurung dan spasi. */
function kataPertama(sql) {
  const bersih = String(sql).replace(/^[\s(]+/, "").trim();
  const m = bersih.match(/^[A-Za-z_]+/);
  return m ? m[0].toUpperCase() : "";
}

function periksaBerkas(jalur) {
  const relatif = path.relative(AKAR, jalur).split(path.sep).join("/");
  const mentah = fs.readFileSync(jalur, "utf8");
  const sumber = kosongkanKomentar(mentah);

  const sipp = peubahSipp(sumber);
  if (!sipp.length) return null;

  const bot = new Set(peubahBot(sumber));
  const pelanggaran = [];
  let jumlahDiperiksa = 0;
  let jumlahTakTerjangkau = 0;

  // ---- 1. kueri yang ditulis langsung pada pemanggilan ----
  for (const conn of sipp) {
    if (bot.has(conn)) continue;
    const pola = new RegExp(`\\b${conn}\\s*\\.\\s*query\\s*\\(\\s*\`([^\`]*)\``, "g");
    let m;
    while ((m = pola.exec(sumber)) !== null) {
      jumlahDiperiksa += 1;
      const kata = kataPertama(m[1]);
      if (!KATA_BACA.test(kata)) {
        pelanggaran.push(`${relatif}:${nomorBaris(sumber, m.index)} ${conn}.query diawali ${kata || "(kosong)"}`);
      }
    }
  }

  // ---- 2. kueri yang disusun ke dalam peubah lebih dahulu ----
  //
  // Inilah bentuk yang paling banyak dipakai, dan justru yang paling luput.
  // Yang dilacak: peubah bertali-kata-punggung yang KEMUDIAN diserahkan ke
  // <conn>.query(<peubah>).
  const nilaiPeubah = new Map();
  {
    const pola = /(?:const|let|var)\s+(\w+)\s*=\s*`([\s\S]*?)`/g;
    let m;
    while ((m = pola.exec(sumber)) !== null) {
      // Pemberian nilai terakhir yang menang, sebagaimana pembacaan biasa.
      nilaiPeubah.set(m[1], { sql: m[2], di: m.index });
    }
  }
  for (const conn of sipp) {
    if (bot.has(conn)) continue;
    const pola = new RegExp(`\\b${conn}\\s*\\.\\s*query\\s*\\(\\s*(\\w+)\\s*[,)]`, "g");
    let m;
    while ((m = pola.exec(sumber)) !== null) {
      const nama = m[1];
      const isi = nilaiPeubah.get(nama);
      if (!isi) {
        jumlahTakTerjangkau += 1;
        continue;
      }
      jumlahDiperiksa += 1;
      const kata = kataPertama(isi.sql);
      if (!KATA_BACA.test(kata)) {
        pelanggaran.push(
          `${relatif}:${nomorBaris(sumber, m.index)} ${conn}.query(${nama}) yang isinya diawali ${kata || "(kosong)"} pada baris ${nomorBaris(sumber, isi.di)}`
        );
      }
    }
  }

  // ---- 3. lewat pembungkus ----
  //
  // Bentuk yang paling lazim di services/: `function runQuery(sql, params)`
  // yang di dalamnya memanggil `db.query(sql, ...)`. Kueri sungguhannya ada
  // pada pemanggilan runQuery, bukan pada db.query.
  //
  // Dikenali dua bentuk deklarasi. Penjaga lama hanya mengenali `function
  // NAMA(`, sehingga pembungkus berbentuk panah - `const runQuery = (sql) =>`
  // - luput seluruhnya. Belum ada yang memakai bentuk itu hari ini; dikenali
  // sekarang supaya yang menulisnya kelak tidak lolos tanpa suara.
  const pembungkus = new Set();
  for (const conn of sipp) {
    if (bot.has(conn)) continue;
    const polaDeklarasi = [
      new RegExp(`function\\s+(\\w+)\\s*\\([^)]*\\)\\s*\\{[\\s\\S]{0,400}?\\b${conn}\\s*\\.\\s*query\\s*\\(`, "g"),
      new RegExp(`(?:const|let|var)\\s+(\\w+)\\s*=\\s*(?:async\\s*)?\\([^)]*\\)\\s*=>[\\s\\S]{0,400}?\\b${conn}\\s*\\.\\s*query\\s*\\(`, "g"),
    ];
    polaDeklarasi.forEach((pola) => {
      let m;
      while ((m = pola.exec(sumber)) !== null) pembungkus.add(m[1]);
    });
  }
  for (const nama of pembungkus) {
    // 3a. kueri ditulis langsung pada pemanggilan pembungkus
    const polaLangsung = new RegExp(`(?<![\\w.])${nama}\\s*\\(\\s*\`([^\`]*)\``, "g");
    let m;
    while ((m = polaLangsung.exec(sumber)) !== null) {
      jumlahDiperiksa += 1;
      const kata = kataPertama(m[1]);
      if (!KATA_BACA.test(kata)) {
        pelanggaran.push(`${relatif}:${nomorBaris(sumber, m.index)} ${nama}() diawali ${kata || "(kosong)"}`);
      }
    }
    // 3b. kueri disusun ke peubah lebih dahulu, lalu diserahkan ke pembungkus
    const polaPeubah = new RegExp(`(?<![\\w.])${nama}\\s*\\(\\s*(\\w+)\\s*[,)]`, "g");
    while ((m = polaPeubah.exec(sumber)) !== null) {
      const isi = nilaiPeubah.get(m[1]);
      if (!isi) {
        jumlahTakTerjangkau += 1;
        continue;
      }
      jumlahDiperiksa += 1;
      const kata = kataPertama(isi.sql);
      if (!KATA_BACA.test(kata)) {
        pelanggaran.push(
          `${relatif}:${nomorBaris(sumber, m.index)} ${nama}(${m[1]}) yang isinya diawali ${kata || "(kosong)"} pada baris ${nomorBaris(sumber, isi.di)}`
        );
      }
    }
  }

  // ---- 4. kata kerja tulis yang menempel langsung pada pemanggilan ----
  for (const conn of sipp) {
    if (bot.has(conn)) continue;
    const pola = new RegExp(`\\b${conn}\\s*\\.\\s*query\\s*\\(\\s*['"\`]\\s*(${KATA_TULIS.source.replace(/^\^|\\b$/g, "")})`, "gi");
    let m;
    while ((m = pola.exec(sumber)) !== null) {
      pelanggaran.push(`${relatif}:${nomorBaris(sumber, m.index)} menulis langsung lewat ${conn}.query`);
    }
  }

  return { relatif, sipp, pelanggaran, jumlahDiperiksa, jumlahTakTerjangkau };
}

function utama() {
  console.log("");
  console.log("== Uji diri pemindai ==");
  {
    const contoh = [
      'const db = require("../db_config");',
      '// db.query(`UPDATE perkara SET x=1`);  <- contoh di komentar, tidak boleh dituduh',
      'const u = "http://a//b";',
      'const q = `SELECT 1`;',
      "db.query(q);",
    ].join("\n");
    const bersih = kosongkanKomentar(contoh);
    periksa("contoh di dalam komentar tidak terbaca", !/UPDATE perkara/.test(bersih));
    periksa("garis miring ganda di dalam tali kata tetap utuh", /http:\/\/a\/\/b/.test(bersih));
    periksa("peubah sambungan terbaca", peubahSipp(bersih).includes("db"));
    periksa("petik tunggal juga terbaca", peubahSipp("const s = require('../db_config');").includes("s"));
    periksa("nama selain db terbaca", peubahSipp('const sipp = require("../db_config");').includes("sipp"));
    periksa("kata pertama membuang kurung pembuka", kataPertama("  ( SELECT 1 )") === "SELECT");
  }

  console.log("");
  console.log("== Berkas yang menyentuh SIPP ==");
  const semua = kumpulkanBerkas(AKAR);
  const hasil = semua.map(periksaBerkas).filter(Boolean);
  periksa("ada berkas yang menyentuh SIPP", hasil.length > 0, `dapat ${hasil.length}`);

  const diLuarServices = hasil.filter((h) => !h.relatif.startsWith("services/"));
  console.log(`        ${hasil.length} berkas menyentuh SIPP, ${diLuarServices.length} di antaranya di luar services/`);
  diLuarServices.forEach((h) =>
    console.log(`          ${h.relatif} (peubah: ${h.sipp.join(", ")}) - tidak dijangkau penjaga lama`)
  );

  const namaBukanDb = hasil.filter((h) => h.sipp.some((n) => n !== "db"));
  namaBukanDb.forEach((h) =>
    console.log(`          ${h.relatif} memakai nama "${h.sipp.join(", ")}" - tidak dijangkau penjaga lama`)
  );

  console.log("");
  console.log("== Setiap kueri ke SIPP diawali kata baca ==");
  const seluruhPelanggaran = hasil.flatMap((h) => h.pelanggaran);
  const totalDiperiksa = hasil.reduce((s, h) => s + h.jumlahDiperiksa, 0);
  const totalTakTerjangkau = hasil.reduce((s, h) => s + h.jumlahTakTerjangkau, 0);

  periksa(
    `${totalDiperiksa} kueri diperiksa, tidak satu pun menulis`,
    seluruhPelanggaran.length === 0,
    seluruhPelanggaran.slice(0, 6).join(" | ")
  );

  periksa("jumlah kueri yang terjangkau jauh lebih banyak daripada penjaga lama", totalDiperiksa > 200, `dapat ${totalDiperiksa}`);
  periksa("pembungkus berbentuk panah dikenali", (() => {
    // Bentuk yang luput dari penjaga lama. Diuji atas sumber buatan supaya
    // terbukti dikenali walau belum ada berkas yang memakainya hari ini.
    const contoh = [
      'const db = require("../db_config");',
      "const jalankan = async (sql) => db.query(sql);",
      "jalankan(`DELETE FROM perkara`);",
    ].join("\n");
    const pola = /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>[\s\S]{0,400}?\bdb\s*\.\s*query\s*\(/g;
    return pola.exec(contoh) !== null;
  })());

  if (totalTakTerjangkau) {
    console.log("");
    console.log(`        ${totalTakTerjangkau} pemanggilan kuerinya disusun dengan cara yang tidak terjangkau`);
    console.log("        pembacaan teks - misalnya dirakit dari beberapa potongan. Penjaga ini");
    console.log("        TIDAK menjanjikan menangkapnya, dan itu disebutkan supaya tidak ada yang");
    console.log("        menyangka cakupannya penuh.");
  }

  console.log("");
  console.log(`Hasil: ${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal > 0 ? 1 : 0);
}

utama();
