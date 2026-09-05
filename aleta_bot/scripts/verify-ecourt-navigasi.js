"use strict";

/**
 * Navigasi daftar perkara e-Court.
 *
 * Alamat e-Court berupa blob terenkripsi, jadi ALETA tidak dapat menyusun
 * alamat untuk satu perkara - ia harus menemukannya dari halaman daftar.
 * Modul navigasi inilah yang mempertemukan "apa" dari SIPP dengan "di mana"
 * dari e-Court.
 *
 * Seluruh pemeriksaan berjalan tanpa jaringan, tanpa peramban, tanpa database.
 */

const fs = require("fs");
const pathx = require("path");

const navigasi = require("../tools/ecourt-bridge/navigasi");

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

const baca = (...bagian) => fs.readFileSync(pathx.resolve(__dirname, "..", ...bagian), "utf8");
const runJs = baca("tools", "ecourt-bridge", "run.js");
const navJs = baca("tools", "ecourt-bridge", "navigasi.js");

console.log("\n== Alur perkara SIPP menentukan menu e-Court ==");
{
  // Id alur pada SIPP peradilan agama: 15 Pdt.G, 16 Pdt.P, 17 Pdt.G.S, 122 JN.
  periksa("Pdt.G -> gugatan", navigasi.menuUntukAlur("Pdt.G", "Perdata Gugatan") === "gugatan");
  periksa("Pdt.P -> permohonan", navigasi.menuUntukAlur("Pdt.P", "Perdata Permohonan") === "permohonan");
  periksa(
    "Pdt.G.S -> gugatan sederhana",
    navigasi.menuUntukAlur("Pdt.G.S", "Gugatan Sederhana") === "gugatan sederhana"
  );
  periksa("JN -> jinayat", navigasi.menuUntukAlur("JN", "Jinayat") === "jinayat");
  periksa("alur tak dikenal -> kosong", navigasi.menuUntukAlur("XYZ", "") === "");
  periksa(
    "kode kosong masih dapat ditebak dari nama",
    navigasi.menuUntukAlur("", "Gugatan Sederhana Agama") === "gugatan sederhana"
  );
}

console.log("\n== Gugatan Sederhana tidak tertukar dengan Gugatan ==");
{
  // Bahaya nyata: mencari "gugatan" dengan pencocokan "mengandung" akan
  // menangkap "Gugatan Sederhana" bila label itu kebetulan lebih dulu di
  // halaman - dan perkara ditarik dari daftar yang salah.
  const terbalik = new Map([
    ["gugatan sederhana", "/SEDERHANA"],
    ["daftar gugatan online", "/GUGATAN"],
    ["permohonan", "/PERMOHONAN"],
  ]);
  periksa("gugatan -> daftar gugatan", navigasi.pilihTautanMenu(terbalik, "gugatan") === "/GUGATAN");
  periksa(
    "gugatan sederhana -> daftar sederhana",
    navigasi.pilihTautanMenu(terbalik, "gugatan sederhana") === "/SEDERHANA"
  );
  periksa("permohonan -> daftar permohonan", navigasi.pilihTautanMenu(terbalik, "permohonan") === "/PERMOHONAN");
  periksa("menu tidak ada -> kosong", navigasi.pilihTautanMenu(terbalik, "jinayat") === "");
  periksa("kata kunci kosong -> kosong", navigasi.pilihTautanMenu(terbalik, "") === "");
}

console.log("\n== Alamat menu dibaca dari DOM, tidak ditanam ==");
{
  // Blob pada /pendaftaran/<blob> mungkin terikat sesi. Menanamnya di kode
  // berarti jembatan mati tanpa sebab yang jelas begitu blob itu berputar.
  const adaBlobTertanam = /\/pendaftaran\/[A-Za-z0-9+/=]{40,}/.test(navJs) || /\/pendaftaran\/[A-Za-z0-9+/=]{40,}/.test(runJs);
  periksa("tidak ada blob alamat yang ditanam di kode", !adaBlobTertanam);
  periksa("menu dibaca dari href halaman", /querySelectorAll\("a\[href\]"\)/.test(navJs));
  periksa("disaring pada jalur pendaftaran", /includes\("\/pendaftaran\/"\)/.test(navJs));
}

console.log("\n== Halaman detail TIDAK PERNAH diklik ==");
{
  // Halaman detail memuat tombol "Batal Verifikasi" dan "Hapus Tundaan
  // Sidang" - tombol yang mengubah keadaan resmi perkara. Satu klik yang
  // salah akan tercatat sebagai perbuatan hakim pemilik akun.
  const prosesCase = runJs.slice(runJs.indexOf("async function processCase"), runJs.indexOf("async function utama"));
  periksa("processCase tidak memanggil page.click", !/page\.click\(/.test(prosesCase));
  periksa("processCase tidak mengklik dari dalam halaman", !/\.click\(\)/.test(prosesCase));
  periksa("processCase tidak mengetik apa pun", !/page\.type\(/.test(prosesCase));
  periksa("berkas diambil dengan fetch, bukan klik", /fetch\(alamat/.test(runJs));

  // Klik hanya boleh ada di modul navigasi, yang berhenti di halaman daftar.
  const klikNavigasi = (navJs.match(/\.click\(\)/g) || []).length;
  periksa(`klik hanya di modul navigasi (${klikNavigasi} tempat)`, klikNavigasi > 0 && klikNavigasi <= 2);
  periksa("navigasi tidak menyentuh halaman detail", !/view_detil_pendaftaran["'`]\s*\)/.test(navJs.replace(/a\[href\*="view_detil_pendaftaran"\]/g, "")));
}

console.log("\n== Pencarian hanya menerima kecocokan PERSIS ==");
{
  // Pencarian DataTables mencocokkan sebagian. Mengambil baris pertama begitu
  // saja berarti menarik dokumen perkara yang salah - lalu mengirimkannya ke
  // pihak yang salah.
  const cari = navJs.slice(navJs.indexOf("async function cariPerkara"));
  periksa("dibandingkan dengan ===", /nomorRegister\.toUpperCase\(\) === kata\.toUpperCase\(\)/.test(cari));
  periksa("tidak mengambil baris pertama begitu saja", !/baris\[0\]/.test(cari));
  periksa("tanpa kecocokan -> kosong", /cocok \? cocok\.url : ""/.test(cari));
}

console.log("\n== Gagal-terbuka: penarikan tetap jalan bila navigasi gagal ==");
{
  const kumpul = runJs.slice(runJs.indexOf("async function kumpulkanTautan"), runJs.indexOf("/** Memproses satu halaman"));
  periksa("acuan mati -> kembalikan kosong", /if \(!acuan\.aktif/.test(kumpul));
  periksa("menu tak terbaca -> kembalikan kosong", /menu\.size === 0/.test(kumpul));
  periksa("sapuan kosong -> kembalikan kosong", /petaRegister\.size === 0/.test(kumpul));
  periksa("galat sapuan tidak dilempar", /catch \(error\)/.test(kumpul) && !/throw/.test(kumpul));
  periksa("ada jalan mundur ke cara lama", /tautan = scraper\.extractCaseLinks\(html\)/.test(runJs));
}

console.log("\n== Hanya kategori yang dibutuhkan yang dibuka ==");
{
  const kumpul = runJs.slice(runJs.indexOf("async function kumpulkanTautan"), runJs.indexOf("/** Memproses satu halaman"));
  periksa("kategori disusun dari acuan SIPP", /for \(const perkara of acuan\.perkara\.values\(\)\)/.test(kumpul));
  periksa("menu yang tidak ada dilewati, bukan gagal", /tidak ada di e-Court, dilewati/.test(kumpul));
  periksa("urutan mengikuti SIPP", /perkara terbaru/.test(kumpul) || /urutan SIPP/.test(kumpul));
}


console.log("\n== Sapuan menunggu PERUBAHAN, bukan sekian detik ==");
{
  // Kekeliruan yang sudah terjadi di server: jeda tetap 1,2 detik membuat
  // pembacaan terjadi sebelum tabel selesai menggambar ulang, sehingga isi
  // halaman SEBELUMNYA yang terbaca. Tidak terlihat sebagai galat sama sekali:
  // 40 halaman terbaca, tiap halaman melaporkan 10 baris, totalnya tetap 10.
  const sapu = navJs.slice(navJs.indexOf("async function sapuDaftar"), navJs.indexOf("async function cariPerkara"));
  periksa("menunggu tabel berubah, bukan tidur", /tungguTabelBerubah/.test(sapu));
  periksa("tidak lagi memakai jeda tetap antar halaman", !/tidur\(JEDA_DAFTAR_MS\)/.test(sapu));
  periksa("halaman tanpa baris baru menghentikan sapuan", /baru === 0/.test(sapu));
  periksa("halaman yang tak kunjung tergambar menghentikan sapuan", /tidak kunjung tergambar/.test(sapu));
  periksa("menghormati penanda Processing DataTables", /dataTables_processing/.test(navJs));
  periksa("punya batas waktu yang dapat diatur", /ALETA_ECOURT_TUNGGU_TABEL_MS/.test(navJs));

  // Sidik jari harus memakai lebih dari satu petunjuk. Jumlah baris saja tidak
  // cukup: halaman berikutnya kerap punya jumlah baris yang sama persis.
  const sidik = navJs.slice(navJs.indexOf("async function sidikJariTabel"), navJs.indexOf("async function tungguTabelBerubah"));
  periksa("sidik jari memakai info tabel", /dataTables_info/.test(sidik));
  periksa("sidik jari memakai tautan pertama dan terakhir", /tautan\[0\]/.test(sidik));
}


console.log("\n== Belum giliran BUKAN selisih data ==");
{
  // Angka yang sempat menyesatkan di server: 171 dilaporkan "tidak ditemukan
  // di e-Court", padahal 167 di antaranya ketemu - hanya belum giliran karena
  // batas maks-perkara. Mencampurkan keduanya membuat petugas mengira ada
  // ratusan perkara hilang dari e-Court, padahal tidak ada.
  const kumpul = runJs.slice(runJs.indexOf("async function kumpulkanTautan"), runJs.indexOf("/** Memproses satu halaman"));
  periksa(
    "perkara yang alamatnya ketemu dianggap terlihat",
    /belumTerlihat\.delete\(kunciPerkara/.test(kumpul)
  );
  periksa("yang tertunda dihitung terpisah", /tertundaKarenaBatas/.test(runJs));
  periksa("dilaporkan sebagai bukan selisih", /bukan selisih data/.test(runJs));
}

console.log("\n== Penarikan tertarget satu perkara ==");
{
  // Tanpa ini perkara lama tidak akan pernah terjaring: daftar SIPP diurutkan
  // dari yang terbaru, sehingga perkara yang sudah bersidang - dan justru
  // punya dokumen persidangan - selalu berada jauh di belakang.
  periksa("opsi --perkara ada", /"--perkara"/.test(runJs));
  periksa("menerima nomor perkara maupun nomor register", /nomorRegister \|\| ""\)\.toUpperCase\(\) === args\.perkara/.test(runJs));
  periksa("memakai peta alamat dari sapuan", /acuan\.petaAlamat/.test(runJs));
  periksa("peta alamat punya nilai awal", /petaAlamat: new Map\(\)/.test(runJs));
  periksa("perkara di luar acuan SIPP ditolak jelas", /tidak ada pada acuan SIPP/.test(runJs));
  periksa("perkara yang tak ketemu di e-Court dilaporkan", /tidak ketemu di daftar e-Court/.test(runJs));
}

console.log("\n== Batas waktu peramban ==");
{
  const sesi = baca("tools", "ecourt-bridge", "sesi.js");
  // Berkas satu sampai dua megabita pada jaringan lambat dapat melewati batas
  // bawaan Puppeteer, dan pesannya - Runtime.callFunctionOn timed out - tidak
  // menjelaskan berkas mana maupun mengapa.
  periksa("protocolTimeout dinaikkan", /protocolTimeout/.test(sesi));
  periksa("dapat diatur lewat env", /ALETA_ECOURT_PROTOCOL_TIMEOUT_MS/.test(sesi));
}


console.log("\n== Sesi habis MENGHENTIKAN putaran ==");
{
  // Sudah terjadi di server: sesi mati di perkara ke-65, lalu 130 perkara
  // berikutnya tetap diminta ke Mahkamah Agung - semuanya berakhir di halaman
  // login. Sembilan menit permintaan tanpa hasil, dan itu persis perilaku yang
  // membuat akun ditandai.
  periksa("halaman login dikenali di tengah putaran", /id="captchaimage"|Login Page/.test(runJs));
  periksa("dilempar sebagai galat bertanda", /sesiHabis: true/.test(runJs));
  periksa("putaran dihentikan, bukan dilewati", /error\.sesiHabis[\s\S]{0,400}break;/.test(runJs));
  periksa("keluar dengan kode sesi habis", /error\.sesiHabis[\s\S]{0,400}KODE_KELUAR = 2/.test(runJs));
  periksa("petugas diberi tahu cara memulihkan", /Login sekali dari portal/.test(runJs));
}

console.log("\n== Perkara lengkap tidak dibuka lagi ==");
{
  periksa("ada pemeriksaan kelengkapan", /perkaraSudahLengkap/.test(runJs));
  periksa("diperiksa SEBELUM halaman dibuka", runJs.indexOf("perkaraSudahLengkap") < runJs.indexOf("await processCase(page, url"));
  periksa("yang dilewati dihitung", /perkaraDilewati/.test(runJs));
  periksa("dapat dipaksa ulang", /--paksa-ulang/.test(runJs));

  const store = baca("services", "ecourtStoreService.js");
  const fungsi = store.slice(store.indexOf("async function perkaraSudahLengkap"), store.indexOf("async function needsRecheck"));
  // Dokumen yang belum diverifikasi majelis masih dapat diganti pihak dengan
  // unggahan baru berjudul sama. Melewatinya berarti melewatkan perbaikan itu.
  periksa("perkara dengan dokumen belum diverifikasi tidak dilewati", /menunggu === 0/.test(fungsi));
  periksa("perkara tanpa catatan tidak dilewati", /jumlah === 0\) return false/.test(fungsi));
  periksa("hanya berkas yang benar-benar ada dihitung", /jalur_berkas IS NOT NULL/.test(fungsi));
}

console.log(`\nLulus: ${lulus}, Gagal: ${gagal}`);
if (gagal > 0) {
  console.log("ADA PERIKSAAN YANG GAGAL.");
  process.exit(1);
}
