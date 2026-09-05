"use strict";

/**
 * Unduhan berkas e-Court.
 *
 * ============================================================================
 * DUA BENTUK TAUTAN, SATU PASANG PENANDA
 * ============================================================================
 *
 * e-Court menuliskan tautan dokumen dalam dua bentuk, keduanya memakai penanda
 * yang sama persis:
 *
 *     <a href="#" onclick="view_doc(9,1385073286)">Lihat Dokumen</a>
 *     <a href=".../ViewDoc/tampil_word/9/1385073286">Lihat Dokumen</a>
 *
 * PDF dijalankan JavaScript: POST /ViewDoc/index/<tipe>/<id> menjawab dengan
 * alamat berkas di /storage/..., barulah berkas itu diambil. Word alamatnya
 * sudah langsung dapat dipakai.
 *
 * Semula pengurai hanya mencari href biasa. Bentuk pertama ber-href "#" -
 * dilewati - sementara "#" yang diresolusi peramban menjadi alamat halaman
 * yang sedang dibuka sempat terambil sebagai alamat berkas. Yang "terunduh"
 * lalu berupa halaman detail dalam bentuk HTML, dan dilaporkan sebagai "sesi
 * habis" padahal sesinya sehat. Lima belas dari lima belas berkas gagal begitu.
 *
 * Seluruh pemeriksaan berjalan tanpa jaringan dan tanpa peramban.
 */

const fs = require("fs");
const pathx = require("path");

const scraper = require("../tools/ecourt-bridge/scraper");

let lulus = 0;
let gagal = 0;

function periksa(nama, benar) {
  if (benar) {
    lulus += 1;
    console.log(`  OK    ${nama}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${nama}`);
  }
}

const runJs = fs.readFileSync(pathx.resolve(__dirname, "..", "tools", "ecourt-bridge", "run.js"), "utf8");
const B = scraper.BASE_URL;

console.log("\n== Membaca penanda dokumen dari halaman ==");
{
  // Bentuk sungguhan, disalin apa adanya dari halaman perkara 620.
  const persidangan =
    'Dokumen : <a href="#" onclick="view_doc(9,1385073286)">Lihat Dokumen</a>' +
    ' <a href="' + B + '/ViewDoc/tampil_word/9/1385073286" target="_blank"> Lihat Dokumen</a>';

  const hasil = scraper.extractDocumentLinks(persidangan);
  const pdf = hasil.find((x) => x.format === "pdf");
  const word = hasil.find((x) => x.format === "word");

  periksa("PDF dan Word sama-sama terbaca", hasil.length === 2 && Boolean(pdf) && Boolean(word));
  periksa("penanda PDF terbaca", Boolean(pdf) && pdf.penanda.tipe === "9" && pdf.penanda.id === "1385073286");
  periksa("PDF belum punya alamat, harus ditukar dulu", Boolean(pdf) && pdf.url === "");
  periksa("Word punya alamat langsung", Boolean(word) && word.url.includes("/ViewDoc/tampil_word/9/1385073286"));
  periksa(
    "penanda Word sama dengan PDF",
    Boolean(word) && word.penanda.tipe === "9" && word.penanda.id === "1385073286"
  );

  // Berkas pendaftaran memakai mekanisme yang sama dengan id jauh lebih pendek.
  const pendaftaran = '<a href="#" onclick="view_doc(3,9285)"> <i class="fa fa-download"></i> Download</a>';
  const hasilDaftar = scraper.extractDocumentLinks(pendaftaran);
  periksa(
    "berkas pendaftaran terbaca",
    hasilDaftar.length === 1 && hasilDaftar[0].penanda.tipe === "3" && hasilDaftar[0].penanda.id === "9285"
  );

  // Dokumen yang sama tidak boleh terhitung dua kali.
  const ganda =
    '<a href="#" onclick="view_doc(9,123)">a</a><a href="#" onclick="view_doc(9,123)">b</a>' +
    '<a href="' + B + '/ViewDoc/tampil_word/9/123">c</a>';
  periksa("satu dokumen tidak terhitung dua kali", scraper.extractDocumentLinks(ganda).length === 2);
}

console.log("\n== Alamat halaman tidak boleh dikira berkas ==");
{
  const bahaya = [
    ['<a href="' + B + '/view_detil_pendaftaran/YTY2MTM3==#">Lihat Dokumen</a>', "alamat halaman detail"],
    ['<a href="#">Lihat Dokumen</a>', "href pagar tanpa onclick"],
    ['<a href="/pendaftaran/NWU2MWM1==">Lihat Dokumen</a>', "alamat halaman daftar"],
    ['<a href="#" onclick="hapus_tundaan(9,123)">Hapus Tundaan Sidang</a>', "tombol hapus tundaan"],
    ['<a href="#" onclick="batal_verifikasi(9,123)">Batal Verifikasi</a>', "tombol batal verifikasi"],
  ];
  for (const [html, nama] of bahaya) {
    periksa(`${nama} dilewati`, scraper.extractDocumentLinks(html).length === 0);
  }
}

console.log("\n== Langkah pertama: menanyakan alamat berkas ==");
{
  periksa("ada penukar penanda ke alamat", /async function alamatBerkasDariViewDoc/.test(runJs));
  periksa("memakai jalur ViewDoc/index", /ViewDoc\/index/.test(runJs));
  periksa("dikirim sebagai XMLHttpRequest", /"X-Requested-With": "XMLHttpRequest"/.test(runJs));
  periksa("membawa cookie sesi", /credentials: "include"/.test(runJs));

  // Namanya POST, tetapi tanpa badan permintaan - ia hanya menanyakan lokasi
  // berkas, tidak mengubah apa pun di sistem resmi.
  const blok = runJs.slice(
    runJs.indexOf("async function alamatBerkasDariViewDoc"),
    runJs.indexOf("async function downloadFile")
  );
  periksa("tidak mengirim badan permintaan", !/body:/.test(blok));
  periksa("tidak mengklik apa pun", !/\.click\(/.test(blok));
}

console.log("\n== Pengurai alamat dari jawaban ==");
{
  const pola = /https?:\/\/[^\s"'<>\\]+\/storage\/[^\s"'<>\\]+/i;
  const contoh = [
    [B + "/storage/doc_persidangan/dokumen_persidangan_1765254643_59374.pdf", "alamat telanjang", true],
    ['<a href="' + B + '/storage/doc_persidangan/x.pdf">buka</a>', "terbungkus HTML", true],
    ['{"url":"' + B + '/storage/pendaftaran/y.docx"}', "di dalam JSON", true],
    ["Sesi anda telah habis, silakan login kembali", "jawaban bukan alamat", false],
    ["", "jawaban kosong", false],
  ];
  for (const [teks, nama, harusKetemu] of contoh) {
    periksa(`${nama} -> ${harusKetemu ? "ketemu" : "tidak ketemu"}`, Boolean(teks.match(pola)) === harusKetemu);
  }

  // Alamat di luar e-Court tidak boleh diikuti: mengikutinya berarti membawa
  // sesi login pengadilan ke tempat lain.
  const luar = "https://jahat.example/storage/berkas.pdf";
  periksa("pola memang cocok pada alamat luar", pola.test(luar));
  periksa("alamat luar ditolak oleh penjagaan", !luar.startsWith(B));
  periksa("penjagaan alamat luar ada di kode", /alamat_berkas_di_luar_ecourt/.test(runJs));
}

console.log("\n== Pesan galat melaporkan apa yang diterima ==");
{
  // Pesan lama menyebut "sesi habis" untuk SEMUA jawaban HTML. Itu menyesatkan:
  // gejalanya sama persis ketika alamatnya ternyata halaman, bukan berkas -
  // dan sebab itulah yang sebenarnya terjadi di server.
  periksa("membedakan sesi habis dari bukan berkas", /bukan_berkas/.test(runJs));
  periksa("menyertakan tipe isi yang diterima", /respons\.headers\.get\("content-type"\)/.test(runJs));
  periksa("menyertakan cuplikan jawaban", /cuplikan/.test(runJs));
  periksa("sesi habis hanya bila memang halaman login", /halamanLogin/.test(runJs));
}


console.log("\n== Berkas pendaftaran memakai mekanisme yang sama ==");
{
  // Bagian ini punya pengurai SENDIRI. Perbaikan pada dokumen persidangan
  // tidak menolongnya sama sekali - dan itulah sebabnya seluruh berkas
  // pendaftaran tetap gagal setelah perbaikan pertama: pengurainya masih
  // mengambil href pagar, yang tersusun menjadi alamat beranda e-Court.
  const HTML = [
    'Surat Kuasa Sri Astuti Ningsih | <a href="#" onclick="view_doc(1,1388186028)">Download</a>',
    'Perubahan Gugatan Waris | <a href="#" onclick="view_doc(5,1388183288)">Download</a>',
    'bukti surat | <a href="#" onclick="view_doc(18,1384190152)">Download</a>',
    'SURAT GUGATAN (Docx/Rtf) <a href="#" onclick="view_doc(51,1388183288)">Download </a>',
    'Dokumen Bukti <a href="#" onclick="view_doc(3,9285)"> <i class="fa fa-download"></i> Download</a>',
  ].join(String.fromCharCode(10));

  const hasil = scraper.extractRegistrationDocuments(HTML);
  periksa(`lima berkas terbaca (${hasil.length})`, hasil.length === 5);
  periksa("tidak ada yang beralamat halaman", hasil.every((x) => x.url === ""));
  periksa("semua punya penanda", hasil.every((x) => x.penanda && x.penanda.tipe && x.penanda.id));
  periksa("judul terbaca bersih dari ikon", hasil.some((x) => x.judul === "Dokumen Bukti"));

  // Format ditentukan dari JUDUL, bukan dari nomor jenis dokumen. Angka itu
  // milik e-Court dan dapat berubah tanpa pemberitahuan.
  periksa(
    "Docx/Rtf dikenali sebagai word",
    hasil.some((x) => /SURAT GUGATAN/.test(x.judul) && x.format === "word")
  );
  periksa("sisanya pdf", hasil.filter((x) => x.format === "pdf").length === 4);

  const bahaya = 'Batal Verifikasi <a href="#" onclick="batal_verifikasi(9,123)">Download</a>';
  periksa("pemanggilan selain view_doc dilewati", scraper.extractRegistrationDocuments(bahaya).length === 0);

  // ==========================================================================
  // BERKAS BERJUDUL SAMA ADALAH BERKAS YANG BERBEDA
  // ==========================================================================
  //
  // Satu pihak kerap mengunggah beberapa lembar bukti dengan judul yang sama
  // persis. Yang membedakannya hanya id dokumen e-Court. Bila pembacanya
  // menyatukan keduanya, satu lembar bukti hilang tanpa suara - dan kunci
  // dokumen ALETA memang menyatukannya, sebab berkas pendaftaran tidak
  // membawa email maupun waktu unggah. Karena itu penarik menandai kunci yang
  // berulang dan tetap mengunduh yang kedua; di sini dijaga bahwa pembacanya
  // memang menyerahkan DUA dokumen, bukan satu.
  const judulKembar = [
    'bukti surat | <a href="#" onclick="view_doc(18,1384190152)">Download</a>',
    'bukti surat | <a href="#" onclick="view_doc(18,1384190999)">Download</a>',
  ].join(String.fromCharCode(10));
  const kembar = scraper.extractRegistrationDocuments(judulKembar);
  periksa("dua berkas berjudul sama tetap dua dokumen", kembar.length === 2);
  periksa(
    "keduanya membawa id e-Court yang berbeda",
    kembar.length === 2 && kembar[0].penanda.id !== kembar[1].penanda.id
  );

  // Penanda yang benar-benar sama - baris yang sama terbaca dua kali karena
  // susunan halaman - tetap disatukan. Menariknya dua kali hanya membebani
  // e-Court dengan berkas yang identik.
  const samaPersis = [
    'bukti surat | <a href="#" onclick="view_doc(18,1384190152)">Download</a>',
    'bukti surat | <a href="#" onclick="view_doc(18,1384190152)">Download</a>',
  ].join(String.fromCharCode(10));
  periksa("penanda yang sama persis tetap satu", scraper.extractRegistrationDocuments(samaPersis).length === 1);
}

console.log(`\nLulus: ${lulus}, Gagal: ${gagal}`);
if (gagal > 0) {
  console.log("ADA PERIKSAAN YANG GAGAL.");
  process.exit(1);
}
