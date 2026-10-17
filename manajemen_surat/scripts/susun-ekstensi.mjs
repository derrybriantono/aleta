#!/usr/bin/env node
/**
 * Menanam isi ekstensi peramban ke dalam kode portal.
 *
 * ============================================================================
 * KENAPA DITANAM, BUKAN DIBACA DARI DISK
 * ============================================================================
 *
 * Portal berjalan di dalam container yang dibangun dari folder manajemen_surat
 * saja. Folder ekstensi-sipp adalah folder sebelahnya - TIDAK ikut ke dalam
 * image, sehingga membacanya dari disk saat berjalan akan selalu gagal di
 * server, meskipun berhasil saat pengembangan.
 *
 * Menanam isinya sebagai modul menghilangkan seluruh kelas masalah itu
 * sekaligus: tidak ada pencarian jalur, tidak ada ketergantungan pada
 * process.cwd(), tidak ada berkas yang bisa hilang saat penelusuran bundel.
 *
 * Jalankan ulang setiap kali berkas ekstensi berubah:
 *   node scripts/susun-ekstensi.mjs
 *
 * Ada pengujian yang membandingkan hasil tanam ini dengan berkas aslinya,
 * sehingga keduanya tidak dapat berbeda tanpa ketahuan.
 *
 * ============================================================================
 * DUA PENJAGA YANG DIPASANG DI SINI, DAN SEBABNYA
 * ============================================================================
 *
 * 1. BERKAS YANG ADA DI FOLDER TETAPI TIDAK DIDAFTARKAN
 *
 *    Daftar BERKAS ditulis tangan, dan itu disengaja - ia daftar apa yang
 *    SENGAJA dikirim ke peramban petugas, bukan hasil penyapuan folder. Tetapi
 *    berkas baru yang lupa didaftarkan tidak ikut tertanam, dan gejalanya
 *    bukan galat melainkan fitur yang "tidak muncul": skrip kontennya tidak
 *    ada di dalam ZIP, Chrome memasang ekstensi tanpanya, dan tidak ada satu
 *    pun pesan di mana pun.
 *
 *    Karena itu folder disapu, dan tiap berkas yang tidak didaftarkan
 *    MENGHENTIKAN penyusunan. Yang memang tidak ingin dikirim didaftarkan di
 *    DIKECUALIKAN, terang-terangan, dengan sebabnya.
 *
 * 2. ISI BERUBAH TETAPI VERSINYA TIDAK DINAIKKAN
 *
 *    Ini kegagalan yang paling sunyi dari semuanya, dan ia sudah hampir
 *    terjadi berkali-kali: sunting konten.js, jalankan skrip ini, lupa
 *    menaikkan manifest.json. Portal lalu menyajikan isi BARU dengan nomor
 *    versi LAMA. Akibatnya:
 *
 *      - Chrome tidak pernah memperbarui ekstensi yang sudah terpasang; ia
 *        membandingkan nomor versi, bukan isinya
 *      - popup ekstensi tidak pernah berkata "perlu diperbarui", sebab
 *        nomornya sama
 *      - petugas memakai ekstensi lama sambil melihat portal menyebut versi
 *        yang sama, dan tidak ada satu pun yang salah di layar
 *
 *    Yang dijaga di sini: sidik isi disimpan bersama hasil tanam. Bila isinya
 *    berbeda dari sidik yang tersimpan sementara versinya TIDAK berubah,
 *    penyusunan dihentikan beserta sebabnya. Sidiknya dihitung dengan ruas
 *    version DIKOSONGKAN, supaya menaikkan versi saja tidak pernah dianggap
 *    perubahan isi.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const BERKAS = [
  "manifest.json",
  "konten.js",
  "abt.js",
  "aleta.js",
  "panel-alat.js",
  // Widget checklist milestone - skrip konten tersendiri, terpisah dari panel
  // ALETA, dimuat di SIPP, ABT, dan portal sesudah panel-alat.js.
  "checklist.js",
  // Tab Juru Sita (perbaikan 30 Sep 2026, butir 15-16) - skrip konten
  // bersama panel SIPP dan ABT, dimuat sesudah panel-alat.js dan sebelum
  // konten.js/abt.js; menyediakan globalThis.aletaJurusitaPasang.
  "jurusita.js",
  // BAS massal (perbaikan 30 Sep sore, U4) - skrip konten bersama panel SIPP
  // dan ABT, dimuat sesudah jurusita.js dan sebelum konten.js/abt.js;
  // menyediakan globalThis.aletaBasMassalPasang.
  "basmassal.js",
  // Isi data saksi/pihak dari foto KTP (perbaikan 2 Okt 2026 butir 16, agen
  // C) - skrip konten SIPP yang memasang dirinya sendiri pada blangko "Tambah
  // Referensi Data Pihak"; dimuat sesudah basmassal.js, sebelum konten.js.
  "saksiscan.js",
  // Blangko ABT by Derry Briantono (tahap C-D, 16 Okt 2026) - skrip konten ABT
  // dan gayanya, dimuat sesudah checklist.js. abt-klien.js (klien rute ABT,
  // tahap A) dimuat sebelumnya; blangko-derry-isian.js (tahap F-G: perlu
  // diisi, bukti, tanya jawab, pratinjau, cetak) sesudahnya.
  "abt-klien.js",
  "blangko-derry.js",
  "blangko-derry-isian.js",
  // Checklist konseptor sementara (F1.6, 17 Okt 2026) - skrip konten ABT
  // sesudah blangko-derry-isian.js: lapor isian blangko putusan ke portal dan
  // alat "Checklist konseptor putusan" di menu Alat saya.
  "konseptor-langkah.js",
  // Putusan Advance (F4.4, 17 Okt 2026) - skrip konten ABT sesudah
  // konseptor-langkah.js: alat "Putusan Advance (periksa draf)" di Alat saya
  // hakim; hanya membaca draf Blangko Derry dan menampilkan rapor portal.
  "putusan-advance.js",
  // SIPP dengan Ide ALETA gelombang 1 (tahap L1, 16 Okt 2026) - skrip konten
  // SIPP dan ABT, dimuat paling belakang: tombol Buka di ABT/ALETA, pita Isi
  // dengan ALETA, Putusan Akhir dari berkas, cek dobel e-Doc; di ABT menerima
  // serah terima nomor perkara untuk Blangko ABT by Derry Briantono.
  "sipp-ide-l1.js",
  // SIPP dengan Ide ALETA gelombang 2 (tahap M1, 16 Okt 2026) - skrip konten
  // SIPP sesudah sipp-ide-l1.js (memakai penghitung kolom L1): Isi dengan
  // ALETA di Tunda/Edit Jadwal, Relaas, Putusan Sela, Rekonvensi, Saksi
  // Putusan, Tambah Biaya (Kasir), dan Arsip.
  "sipp-ide-m1.js",
  // SIPP dengan Ide ALETA gelombang 2 (tahap M2, 16 Okt 2026) - skrip konten
  // SIPP sesudah L1: kotak penyatu SIPP-ABT-ALETA di halaman perkara (status
  // blangko, BAS belum diunggah, tugas, selisih 3 sumber) dan penyembunyi
  // tombol ALETA yang dobel penuh (saklar sippTampilDobel memunculkannya).
  "sipp-ide-m2.js",
  "blangko-derry.css",
  // Penjaga batas (17 Okt 2026): tidak ada kata ALETA yang ditulis ekstensi ke
  // SIPP/ABT. Dimuat document_start, SEBELUM tema-awal.js, supaya fetch sudah
  // terbungkus saat skrip konten lain berjalan.
  "penjaga-tanda.js",
  "tema-awal.js",
  // Unduhan universal (17 Okt 2026): unduhan SIPP/ALETA/Blangko Derry lewat
  // chrome.downloads supaya tidak diblokir Chrome di situs http.
  "unduh-universal.js",
  "unduh-halaman.js",
  // Pekerja latar. Satu-satunya tempat requestUpdateCheck dan reload dapat
  // dipanggil - skrip konten tidak punya keduanya.
  "latar.js",
  "jembatan.js",
  "panel.css",
  "popup.html",
  "popup.js",
  // Daftar 120 saklar fitur ide (tahap 1, 1.172.0) - dimuat popup.html
  // sebelum popup.js. Disusun dari berkas ide, bukan disunting tangan.
  "daftar-fitur.js",
  // Penampil PDF SALINAN (14 Okt 2026) - dibuka latar.js lewat chrome.tabs.create.
  "salinan.html",
  "salinan.js",
  // SIPP dengan Ide ALETA gelombang 1 (Tahap L2, 16 Okt 2026): sepuluh penanda
  // di halaman SIPP (skrip konten, dimuat sesudah checklist.js) dan saklarnya
  // di popup (dimuat popup.html sesudah popup.js).
  "sipp-ide-l2.js",
  "popup-ide-l2.js",
  "PASANG.md",
];

// Ikon TIDAK dapat ditanam sebagai teks: ia berkas PNG, dan membacanya sebagai
// utf8 merusak bitanya tanpa satu pun galat. Karena itu ikon ditanam terpisah
// sebagai base64, lalu dikembalikan menjadi bita saat ZIP disusun.
//
// Melewatkannya sama sekali lebih buruk lagi: manifest menunjuk ikon/*.png,
// dan Chrome MENOLAK memasang ekstensi yang ikonnya tidak ada. Ekstensi yang
// diunduh dari portal akan gagal dipasang seluruhnya.
const BERKAS_BINER = [
  "ikon/aleta-16.png",
  "ikon/aleta-32.png",
  "ikon/aleta-48.png",
  "ikon/aleta-128.png",
];

/**
 * Berkas yang ADA di folder tetapi memang tidak dikirim.
 *
 * Didaftarkan terang-terangan supaya penyapuan folder di bawah tidak menuntut
 * penjelasan tiap kali dijalankan - dan supaya yang menambah berkas baru harus
 * memutuskan: dikirim, atau dikecualikan beserta sebabnya.
 */
const DIKECUALIKAN = new Map([
  // Belum ada. Contoh yang pernah dipertimbangkan: berkas catatan
  // pengembangan, atau ikon sumber berformat .svg yang tidak dipakai Chrome.
]);

const sumber = path.resolve(process.cwd(), "..", "ekstensi-sipp");
const tujuan = path.resolve(process.cwd(), "src/server/shared/ekstensi-berkas.ts");

/** Seluruh berkas di dalam folder ekstensi, relatif terhadap akarnya. */
function sapuFolder(akar, awalan = "") {
  const hasil = [];
  for (const butir of fs.readdirSync(path.join(akar, awalan), { withFileTypes: true })) {
    const relatif = awalan ? `${awalan}/${butir.name}` : butir.name;
    if (butir.isDirectory()) hasil.push(...sapuFolder(akar, relatif));
    else hasil.push(relatif);
  }
  return hasil;
}

// ─── Penjaga 1: tidak ada berkas yang lolos tanpa keputusan ──────────────────
const didaftarkan = new Set([...BERKAS, ...BERKAS_BINER]);
const adaDiFolder = sapuFolder(sumber);
const tanpaKeputusan = adaDiFolder.filter(
  (nama) => !didaftarkan.has(nama) && !DIKECUALIKAN.has(nama)
);

if (tanpaKeputusan.length > 0) {
  console.error("Ada berkas di ekstensi-sipp yang belum diputuskan:");
  for (const nama of tanpaKeputusan) console.error(`  - ${nama}`);
  console.error("");
  console.error("Tambahkan ke BERKAS/BERKAS_BINER bila memang dikirim ke peramban,");
  console.error("atau ke DIKECUALIKAN beserta sebabnya bila memang tidak.");
  console.error("Dibiarkan berarti berkasnya tidak ikut tertanam, dan gejalanya");
  console.error("bukan galat melainkan fitur yang tidak muncul tanpa sebab.");
  process.exit(1);
}

const hilang = [...didaftarkan].filter((nama) => !fs.existsSync(path.join(sumber, nama)));
if (hilang.length > 0) {
  console.error("Berkas ekstensi yang didaftarkan tidak ada di folder:");
  for (const nama of hilang) console.error(`  - ${nama}`);
  process.exit(1);
}

// ─── Membaca isinya ──────────────────────────────────────────────────────────
const isiTeks = new Map();
for (const nama of BERKAS) {
  isiTeks.set(nama, fs.readFileSync(path.join(sumber, nama), "utf8"));
}

const isiBiner = new Map();
for (const nama of BERKAS_BINER) {
  isiBiner.set(nama, fs.readFileSync(path.join(sumber, nama)).toString("base64"));
}

const manifest = JSON.parse(isiTeks.get("manifest.json"));
const versi = String(manifest.version || "");
if (!versi) {
  console.error("manifest.json tidak punya ruas version.");
  process.exit(1);
}

/**
 * Sidik isi ekstensi, dengan ruas version DIKOSONGKAN.
 *
 * Dikosongkan supaya menaikkan versi saja tidak pernah terbaca sebagai
 * perubahan isi - kalau tidak, penjaga di bawah akan menuntut versi dinaikkan
 * setiap kali versi dinaikkan, selamanya.
 */
function hitungSidik() {
  const cerna = crypto.createHash("sha256");

  // Pemisahnya ditulis lewat fromCharCode, bukan sebagai huruf di dalam
  // template. Sebabnya nyata dan baru saja terjadi: alat penyuntingan dapat
  // menukar spasi di dalam template literal dengan bita lain tanpa satu pun
  // gejala, dan sidik yang dihitung penyusunnya lalu berbeda dari sidik yang
  // dihitung ulang pengujiannya - dua angka yang seharusnya mustahil beda.
  const pisah = String.fromCharCode(10);

  const suap = (nama, isi) => {
    cerna.update(nama);
    cerna.update(pisah);
    cerna.update(isi);
    cerna.update(pisah);
  };

  for (const [nama, isi] of isiTeks) {
    if (nama === "manifest.json") {
      // Ruas version DIKOSONGKAN: kalau tidak, penjaga di bawah akan
      // menuntut versi dinaikkan setiap kali versi dinaikkan, selamanya.
      const tanpaVersi = JSON.parse(isi);
      tanpaVersi.version = "";
      suap(nama, JSON.stringify(tanpaVersi));
    } else {
      suap(nama, isi);
    }
  }
  for (const [nama, isi] of isiBiner) suap(nama, isi);

  return cerna.digest("hex");
}

const sidik = hitungSidik();

// ─── Penjaga 2: isi berubah menuntut versi dinaikkan ─────────────────────────
if (fs.existsSync(tujuan)) {
  const lama = fs.readFileSync(tujuan, "utf8");
  const sidikLama = lama.match(/EKSTENSI_SIDIK = "([0-9a-f]{64})"/);
  const versiLama = lama.match(/EKSTENSI_VERSI = "([^"]*)"/);

  if (sidikLama && versiLama && sidikLama[1] !== sidik && versiLama[1] === versi) {
    console.error("Isi ekstensi berubah, tetapi versinya masih " + versi + ".");
    console.error("");
    console.error("Chrome memperbarui ekstensi dengan membandingkan NOMOR VERSI,");
    console.error("bukan isinya. Menanam isi baru dengan nomor lama berarti:");
    console.error("  - ekstensi yang sudah terpasang tidak akan pernah diperbarui");
    console.error("  - popup tidak akan pernah berkata \"perlu diperbarui\"");
    console.error("  - dan tidak ada satu pun yang salah di layar");
    console.error("");
    console.error("Naikkan version di ekstensi-sipp/manifest.json lebih dulu.");
    console.error("Bila memang HANYA ingin menanam ulang tanpa perubahan isi,");
    console.error("jalankan dengan ALETA_TANAM_PAKSA=1.");
    if (process.env.ALETA_TANAM_PAKSA !== "1") process.exit(1);
    console.error("");
    console.error("ALETA_TANAM_PAKSA=1 - diteruskan atas permintaan.");
  }
}

// ─── Menulis hasilnya ────────────────────────────────────────────────────────
const bagian = [...isiTeks].map(([nama, isi]) => `  ${JSON.stringify(nama)}: ${JSON.stringify(isi)},`);
const bagianBiner = [...isiBiner].map(([nama, isi]) => `  ${JSON.stringify(nama)}: ${JSON.stringify(isi)},`);

const keluaran = `// DIHASILKAN OTOMATIS oleh scripts/susun-ekstensi.mjs — jangan disunting tangan.
//
// Isi ekstensi peramban ditanam di sini karena folder ekstensi-sipp tidak ikut
// ke dalam container portal. Jalankan ulang skrip itu setiap kali berkas
// ekstensi berubah; ada pengujian yang menjaga keduanya tetap sama.

export const EKSTENSI_BERKAS: Record<string, string> = {
${bagian.join("\n")}
};

/** Berkas biner (ikon), disandikan base64. Dikembalikan jadi bita saat dikemas. */
export const EKSTENSI_BINER: Record<string, string> = {
${bagianBiner.join("\n")}
};

export const EKSTENSI_NAMA_BERKAS = [
  ...Object.keys(EKSTENSI_BERKAS),
  ...Object.keys(EKSTENSI_BINER),
];

/**
 * Versi ekstensi, disalin dari manifest saat penanaman.
 *
 * Bukan pengganti manifestnya - portal tetap membacanya dari sana. Ia ada
 * supaya pengujian dapat memastikan keduanya tidak pernah berselisih tanpa
 * harus mengurai JSON, dan supaya penjaga di penyusunnya punya pembanding.
 */
export const EKSTENSI_VERSI = ${JSON.stringify(versi)};

/**
 * Sidik isi ekstensi, dihitung dengan ruas version dikosongkan.
 *
 * Dipakai penyusunnya untuk menolak menanam isi baru dengan nomor versi lama -
 * kegagalan yang paling sunyi dari semuanya, sebab Chrome memperbarui ekstensi
 * dengan membandingkan nomor versi dan bukan isinya.
 */
export const EKSTENSI_SIDIK = ${JSON.stringify(sidik)};
`;

fs.writeFileSync(tujuan, keluaran, "utf8");
console.log(
  `Ditanam ${BERKAS.length} berkas teks dan ${BERKAS_BINER.length} ikon ` +
    `(versi ${versi}, sidik ${sidik.slice(0, 12)}) ke ${path.relative(process.cwd(), tujuan)}`
);
