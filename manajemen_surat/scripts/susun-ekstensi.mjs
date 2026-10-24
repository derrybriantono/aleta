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
  // Statistik beban penetapan (20 Okt 2026, B1): tampilan saja, dipakai papan konten.js
  // dan panel penetapan-sipp.js dari objek usulan.statistik yang sama.
  "penunjukan-statistik.js",
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
  // Alamat <-> wilayah, isi dengan Tab, dan pengingat merah di blangko data pihak/kuasa SIPP (22 Okt 2026).
  "pihak-lengkap.js",
  // Susun saksi menurut keadaan dan jenis perkara (18 Okt 2026): mesin katalog
  // (murni, tanpa DOM), data katalog yang DIHASILKAN dari saksi-katalog/*.json
  // oleh scripts/susun-saksi-katalog.mjs, dan borangnya. Dimuat di ABT sebelum
  // abt.js; borang dipasang abt.js lewat globalThis.AletaSaksiSusun.
  "saksi-katalog.js",
  "saksi-katalog-data.js",
  "saksi-susun.js",
  // Isi dari SIPP - mesin bersama (19 Okt 2026): pembobotan usulan, keputusan tulis/saran, dan
  // pembacaan sumber untuk "Isi otomatis dari SIPP" di Blangko Derry. Murni (tanpa DOM), dimuat di ABT
  // sebelum abt.js dan blangko-derry-isian.js.
  "isi-sipp-bersama.js",
  // Blangko ABT by Derry Briantono (tahap C-D, 16 Okt 2026) - skrip konten ABT
  // dan gayanya, dimuat sesudah checklist.js. abt-klien.js (klien rute ABT,
  // tahap A) dimuat sebelumnya; blangko-derry-isian.js (tahap F-G: perlu
  // diisi, bukti, tanya jawab, pratinjau, cetak) sesudahnya.
  "abt-klien.js",
  "blangko-derry.js",
  // Jawaban saksi otomatis + pilihan pengetahuan saksi di Blangko Derry (19 Okt 2026): pembantu murni,
  // dimuat sebelum blangko-derry-isian.js yang memakainya.
  "blangko-derry-saksi.js",
  // Tampilan tanya jawab saksi (20 Okt 2026): asal jawaban, ringkasan, isian opsional; pembantu murni sebelum blangko-derry-isian.js.
  "blangko-derry-saksi-tampil.js",
  // Tanya jawab saksi Blangko Derry menurut KATALOG jenis perkara (20 Okt 2026): murni, dimuat sebelum blangko-derry-isian.js.
  "blangko-derry-katalog.js",
  "blangko-derry-jawab-katalog.js",
  "blangko-derry-isian.js",
  // Cetak massal Blangko Derry (20 Okt 2026): jendela besar per peran, memakai pengemudi satu-perkara di blangko-derry-isian.js.
  "blangko-derry-massal.js",
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
  // Isi otomatis di borang penetapan SIPP (19 Okt 2026) - skrip konten SIPP
  // paling belakang (memakai ambilUsulanPenunjukan/idUntukTulis konten.js):
  // tombol "Isi otomatis" di borang PMH/PPP/PJS/PHS, hanya mengisi kolom.
  "penetapan-borang.js",
  // Kerjakan penetapan satu perkara - satu pintu (20 Okt 2026, agen P1): fungsi
  // aletaPenetapanKerja.kerjakan/keadaan/ambilKunci untuk tombol halaman SIPP
  // dan penanda halaman; satu sumber keadaan + satu kunci per perkara.
  "penetapan-kerja.js",
  // Penetapan Otomatis di halaman perkara SIPP (20 Okt 2026): tombol tebal paling
  // kiri + panel terbentang (mode, empat langkah, centang e-Doc, satu klik
  // tulis lalu unggah). Skrip konten SIPP paling belakang; gayanya sendiri.
  // Muat ulang otomatis sesudah penetapan, tetap di perkaranya (20 Okt 2026): ringkasan,
  // hitung mundur, kembali dari dasbor sekali, ringkasan tampil lagi sesudah memuat.
  "muat-ulang-sipp.js",
  // Pop-up (menu di tengah layar) untuk tombol aksi di halaman SIPP (22 Okt 2026, agen W54): Penetapan Otomatis,
  // Putusan Otomatis, Jadwalkan Putusan (satu/massal). Wadah saja; isi panel tidak berubah.
  "popup-aksi.js",
  "penetapan-sipp.js",
  // Putusan otomatis + e-Doc putusan + e-Doc anonimisasi dalam satu kali kerja (20 Okt 2026, agen B2):
  // skrip konten SIPP paling belakang; memakai abt-klien.js (kini juga dimuat di SIPP) untuk mencetak
  // Blangko Derry putusan dari ABT sesudah Putusan Akhir tersimpan.
  "putusan-edoc-sekaligus.js",
  // Tombol + panel "Putusan Otomatis" di halaman perkara SIPP (20 Okt 2026, agen B2): menjalankan
  // alur Putusan otomatis panel ekstensi dan e-Doc-nya; tepat di sebelah Penetapan Otomatis.
  "putusan-sipp.js",
  "putusan-sipp.css",
  // Pratinjau BAS/relaas di SIPP sebelum diunduh (20 Okt 2026).
  "pratinjau-bas-relaas.js",
  // Unggah hasil mediasi ke arsip perkara, tepat di bawah "Edit Hasil Mediasi" (21 Okt 2026).
  "mediasi-arsip.js",
  // Tombol "Tarik data" di kepala halaman perkara SIPP (21 Okt 2026): menarik e-Court satu perkara saja,
  // di sela penarikan utama (antrean & batas laju di server); sebelah kiri "Selamat Datang <pengguna>".
  "tarik-satu-perkara.js",
  // Unggah Putusan Terjadwal (21 Okt 2026, agen B3): tombol "Jadwalkan Putusan" di sebelah Putusan Otomatis (halaman perkara)
  // dan melayang di dashboard/daftar/jurnal; pemasangan berkas ke perkara (murni, dapat diuji); pelaksana peramban yang
  // mengisi & menyimpan Putusan Akhir pada waktunya lewat alur Putusan Otomatis. e-Doc dikerjakan server.
  "putusan-terjadwal-pasangan.js",
  "putusan-terjadwal.js",
  "putusan-terjadwal-peramban.js",
  "putusan-terjadwal.css",
  // Tombol "Kasir ALETA" di SIPP > Jurnal Perkara > Jurnal Keuangan Perkara (23 Okt 2026, T3): membuka tampilan Kasir
  // ekstensi di pop-up (popup-aksi.js); pengawas (panitera/panmud) hanya membaca.
  "kasir-jurnal-popup.js",
  "kasir-jurnal-popup.css",
  "penetapan-sipp.css",
  "blangko-derry.css",
  // Menu kiri ABT bisa digulir (19 Okt 2026) - skrip konten ABT: #navbar diberi
  // max-height + overflow-y supaya submenu Blangko Derry terjangkau; gaya saja.
  "abt-gulir.js",
  // Menu ABT By Derry dan ALETA di bilah atas SIPP (22 Okt 2026) - skrip konten SIPP dan ABT;
  // butir menu bergaya SIPP, tab baru lewat pekerja latar, tanpa sandi apa pun.
  "menu-atas.js",
  // Halaman e-Court yang dibuka dari menu E-Court (22 Okt 2026) - mengisi nama pengguna saja dan menjaga sesi.
  "ecourt-masuk.js",
  "ecourt-tema.js",
  "ecourt-tema.css",
  // Penjaga batas (17 Okt 2026): tidak ada kata ALETA yang ditulis ekstensi ke
  // SIPP/ABT. Dimuat document_start, SEBELUM tema-awal.js, supaya fetch sudah
  // terbungkus saat skrip konten lain berjalan.
  "penjaga-tanda.js",
  // Deteksi sisa blangko (17 Okt 2026): periksa putusan/BAS/relaas sebelum
  // diunduh atau diunggah (kurung siku, #nnnn#, "perlu di review", titik-titik,
  // garis isian, tulisan merah). Salinan JS dari src/lib/deteksi-sisa-blangko.ts;
  // dimuat paling depan di blok skrip konten SIPP/ABT/portal.
  "deteksi-sisa-blangko.js",
  "tema-awal.js",
  // Pusat tema (terang | gelap | sistem): satu sumber kebenaran, dimuat sebelum tema-awal.js (SIPP, ABT, portal).
  "tema-pusat.js",
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
  // Alamat portal yang hidup (K1, 19 Okt 2026): port 8008 dengan cadangan
  // port 80 - dimuat latar.js (importScripts) dan popup.html.
  "alamat-portal.js",
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
  // Pembaru otomatis (23 Okt 2026): pembantu lokal (native messaging host) dan pemasangnya.
  // Disajikan juga sebagai satu berkas .cmd oleh rute /ekstensi/pembaru/pemasang.
  "pembaru/pembaru-aleta.ps1",
  "pembaru/pasang-pembaru-aleta.cmd",
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
// Awalan folder yang SENGAJA tidak dikirim: sumber data yang sudah dilebur ke berkas lain.
const DIKECUALIKAN_AWALAN = [
  // Katalog Susun saksi per jenis (JSON); dilebur ke saksi-katalog-data.js oleh scripts/susun-saksi-katalog.mjs.
  "saksi-katalog/",
];

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
  (nama) => !didaftarkan.has(nama) && !DIKECUALIKAN.has(nama) && !DIKECUALIKAN_AWALAN.some((awalan) => nama.startsWith(awalan))
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
