"use strict";

/**
 * ============================================================================
 * PENJAGA RANTAI PEMBUKTIAN PENAIKAN
 * ============================================================================
 *
 * Penaikan ke server berdiri di atas satu janji: yang berjalan di server
 * benar-benar rujukan git yang dikirim, bukan sisa build lama yang kebetulan
 * masih ada. Janji itu dibuktikan lewat cap build - sebuah berkas kecil di
 * dalam image yang memuat penanda commit.
 *
 * Rantainya empat sambungan, dan TIAP sambungan diam saat putus:
 *
 *   1. aleta-deploy-from-git.sh  meneruskan ALETA_BUILD_REF ke aleta-update.sh
 *   2. aleta-update.sh           meneruskannya sebagai --build-arg
 *   3. Dockerfile portal         menerima ARG-nya dan menuliskannya ke cap
 *   4. aleta-deploy-from-git.sh  membaca cap itu dan menolak bila tidak cocok
 *
 * Sambungan kedua putus sejak lama: peubahnya diterima lalu berhenti, tidak
 * pernah diteruskan ke build. Akibatnya cap build hanya berisi tanggal,
 * pembuktian pada langkah 4 selalu gagal, dan penaikan berhenti pada langkah
 * terakhir - walau kodenya sebenarnya sudah naik dengan benar.
 *
 * Yang membuatnya bertahan lama: kegagalannya terjadi SESUDAH server berubah,
 * sehingga tampak seperti "penaikan berhasil tetapi pembuktiannya rewel",
 * bukan seperti rantai yang putus.
 */

const fs = require("fs");
const path = require("path");

const AKAR = path.resolve(__dirname, "..", "..");

let lulus = 0;
let gagal = 0;

function cek(nama, syarat, keterangan) {
  if (syarat) {
    lulus += 1;
    return;
  }
  gagal += 1;
  console.log(`  GAGAL  ${nama}${keterangan ? ` - ${keterangan}` : ""}`);
}

function baca(relatif) {
  const p = path.join(AKAR, relatif);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
}

const DEPLOY = baca("scripts/aleta-deploy-from-git.sh");
const UPDATE = baca("scripts/aleta-update.sh");
const DOCKERFILE = baca("manajemen_surat/Dockerfile");

console.log("Rantai pembuktian penaikan\n");

cek("skrip penaikan ada", DEPLOY !== null, "scripts/aleta-deploy-from-git.sh hilang");
cek("skrip penerapan ada", UPDATE !== null, "scripts/aleta-update.sh hilang");
cek("Dockerfile portal ada", DOCKERFILE !== null, "manajemen_surat/Dockerfile hilang");

if (!DEPLOY || !UPDATE || !DOCKERFILE) {
  console.log(`\nHasil: ${lulus} lulus, ${gagal} gagal`);
  process.exit(1);
}

/* -------------------------------------------------- sambungan 1: deploy -> update */

console.log("== Sambungan 1: penaikan meneruskan penanda ke penerapan ==");

cek(
  "penaikan menghitung penanda pendek dari rujukan git",
  /SHORT_REF="\$\(git rev-parse --short "\$REF"\)"/.test(DEPLOY),
  "penanda harus datang dari git, bukan diketik"
);
cek(
  "penaikan meneruskan ALETA_BUILD_REF saat memanggil penerapan",
  /ALETA_BUILD_REF='\$SHORT_REF'/.test(DEPLOY),
  "tanpa ini, penerapan tidak pernah tahu commit mana yang sedang naik"
);

/* ------------------------------------------------ sambungan 2: update -> build */

console.log("== Sambungan 2: penerapan meneruskannya ke docker build ==");

// Inilah sambungan yang dulu putus. Memeriksa keberadaan nama peubahnya saja
// TIDAK cukup - dulu pun namanya ada di berkas itu, hanya tidak pernah sampai
// ke perintah build.
cek(
  "penerapan menyusun --build-arg berisi ALETA_BUILD_REF",
  /--build-arg "ALETA_BUILD_REF=\$ALETA_BUILD_REF"/.test(UPDATE),
  "menyebut nama peubahnya saja tidak membuatnya sampai ke build"
);
cek(
  "dan larik itu benar-benar dipakai pada perintah build",
  /compose build \$\{BUILD_ARGS\[@\]\+"\$\{BUILD_ARGS\[@\]\}"\}/.test(UPDATE),
  "larik yang disusun tetapi tidak dipakai sama saja dengan tidak ada"
);
cek(
  "bentuknya tahan larik kosong pada bash 4.2",
  /\$\{BUILD_ARGS\[@\]\+"\$\{BUILD_ARGS\[@\]\}"\}/.test(UPDATE),
  'bash 4.2 di server menganggap "${ARR[@]}" pada larik kosong sebagai peubah tak terikat'
);
cek(
  "penerapan mengatakan apa adanya bila penandanya tidak diberikan",
  /penanda build tidak diberikan/.test(UPDATE),
  "cap tanpa penanda harus disebut, bukan didiamkan"
);

/* ------------------------------------------- sambungan 3: Dockerfile -> cap */

console.log("== Sambungan 3: Dockerfile menuliskannya ke cap build ==");

cek(
  "Dockerfile menerima ARG ALETA_BUILD_REF",
  /^ARG ALETA_BUILD_REF/m.test(DOCKERFILE),
  "--build-arg untuk ARG yang tidak dideklarasikan hanya menjadi peringatan, lalu hilang"
);
cek(
  "Dockerfile menyusun cap yang memuat penanda itu",
  /ALETA_STAMP=.*ALETA_BUILD_REF/.test(DOCKERFILE),
  "capnya harus memuat penandanya, bukan tanggal saja"
);
cek(
  "Dockerfile menulis cap ke /app/BUILD-STAMP.txt",
  /> \/app\/BUILD-STAMP\.txt/.test(DOCKERFILE),
  "letaknya harus tetap - skrip penaikan membacanya dari sana"
);

/* ------------------------------------------------ sambungan 4: pembuktian */

console.log("== Sambungan 4: penaikan menolak bila capnya tidak cocok ==");

cek(
  "penaikan membaca cap build dari kontainer yang berjalan",
  /docker exec aleta-portal cat \/app\/BUILD-STAMP\.txt/.test(DEPLOY),
  "membaca dari tempat lain berarti membuktikan sesuatu yang lain"
);
cek(
  "penaikan GAGAL bila cap tidak memuat penandanya",
  /gagal "Cap build tidak memuat \$SHORT_REF/.test(DEPLOY),
  "pembuktian yang hanya mencetak peringatan bukan pembuktian"
);
cek(
  "penaikan mencatat rujukan hanya SESUDAH terbukti",
  DEPLOY.indexOf("Cap build tidak memuat") < DEPLOY.lastIndexOf("$REF_FILE"),
  "catatan yang ditulis sebelum pembuktian akan berbohong saat penaikan gagal"
);

/* ------------------------------------------------------- kesehatan sesudahnya */

console.log("== Sesudah naik, kesehatannya diperiksa ==");

cek(
  "penaikan memeriksa portal menjawab",
  /http:\/\/127\.0\.0\.1\/aleta\//.test(DEPLOY),
  "naik tanpa memeriksa berarti tidak tahu portalnya mati"
);
cek(
  "penaikan menandai image lama sebagai jalan mundur",
  /aleta-portal-backup:/.test(DEPLOY) && /aleta-bot-backup:/.test(DEPLOY),
  "tanpa penanda, jalan mundur cepat tidak ada"
);

console.log(`\nHasil: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal === 0 ? 0 : 1);
