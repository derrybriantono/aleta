"use strict";

/**
 * ALETA E-Court — skrip konten untuk halaman SIPP.
 *
 * ============================================================================
 * TIDAK MENGUBAH SIPP SAMA SEKALI
 * ============================================================================
 *
 * Skrip ini hanya MENAMBAH elemen ke halaman. Ia tidak pernah:
 *   - mengubah atau menghapus elemen milik SIPP
 *   - mengisi formulir SIPP
 *   - mengirim apa pun ke SIPP
 *
 * Begitu ekstensi mulai menulis ke SIPP lewat formulirnya, seluruh keunggulan
 * "tidak menyentuh SIPP" hilang - dan kesalahannya akan tampak seperti
 * kesalahan petugas, bukan kesalahan ekstensi.
 *
 * ============================================================================
 * MENYERAH DIAM-DIAM
 * ============================================================================
 *
 * Bila nomor perkara tidak ditemukan, ALETA tidak terjangkau, atau tampilan
 * SIPP berubah sehingga tidak dikenali - skrip ini TIDAK menampilkan apa pun.
 * Tidak ada kotak galat, tidak ada tata letak yang bergeser.
 *
 * SIPP adalah aplikasi yang dipakai bekerja sehari-hari. Lapisan bantu yang
 * merusak tampilannya lebih merugikan daripada lapisan bantu yang absen.
 */

// ============================================================================
// K11 (26 Okt 2026): PANEL DIMUAT SAAT DIPAKAI
// ============================================================================
//
// Kode panel perkara (susunPanel dan seluruh turunannya, ±550 KB), panel daftar
// (susunPanelDaftar, ±70 KB) dan bagian yang dipakai keduanya (±230 KB) dahulu
// dimuat di SETIAP halaman SIPP, termasuk beranda dan menu yang tidak pernah
// menggambar panel. Kini mereka berkas terpisah (konten-panel-bersama.js,
// konten-panel-perkara.js, konten-panel-daftar.js) yang dimuat modul-malas.js
// lewat pekerja latar TEPAT sebelum dipakai: segarkan() mengenali jenis halaman
// lebih dulu (perkara / daftar / bukan keduanya), lalu menunggu modulnya.
//
// Isinya POTONGAN UTUH konten.js yang lama - tidak satu pernyataan pun diubah.
// Pembagiannya dari graf rujukan: yang dapat dicapai dari kode inti ini TANPA
// lewat susunPanel / susunPanelDaftar tetap di sini; sisanya pindah. Satu-satunya
// pintu ke modul adalah susunPanel (3 pemanggil: segarkan, gambarDariSimpanan,
// gambarUlangKonteks - masing-masing menunggu modulnya, ditandai K11-GUARD) dan
// susunPanelDaftar (segarkan). Tanpa pemuat (uji, jsdom) semua kode sudah ada
// dan penunggu ini langsung lewat.
function modulPanelSiap(id) {
  const pemuat = globalThis.AletaModul;
  return !pemuat || pemuat.siap(id) === true;
}

async function pastikanModulPanel(id) {
  if (modulPanelSiap(id)) return true;
  try {
    return (await globalThis.AletaModul.pastikan(id)) === true;
  } catch {
    return false;
  }
}

const ALETA_API = "/aleta/api/aleta-bot/sipp-konteks";
const ALETA_API_MASSAL = "/aleta/api/aleta-bot/sipp-konteks/massal";
const ALETA_API_PERMINTAAN = "/aleta/api/aleta-bot/ecourt/permintaan";
const ALETA_BERKAS = "/aleta/api/aleta-ecourt/berkas";
// Kabar perubahan data SIPP (A8 / U17): satu baca ringan ke jejak Cermin Perkara. Kapabilitasnya
// "panel", sama dengan sipp-konteks; saklar Kabar perubahan di Pemantau Cermin Perkara MATI bawaan.
const ALETA_API_KABAR = "/aleta/api/aleta-ecourt/kabar-perubahan";
const ALETA_API_PENUNJUKAN = "/aleta/api/aleta-bot/penunjukan";
const ALETA_API_RUANGAN = "/aleta/api/aleta-bot/penunjukan/ruangan";

/**
 * ============================================================================
 * DAFTAR RUANGAN SIDANG - DIBACA SEKALI, DISIMPAN SELAMA HALAMAN HIDUP
 * ============================================================================
 *
 * Ruangan pengadilan berubah beberapa kali setahun, bukan beberapa kali
 * semenit. Membacanya ulang tiap kali papan penunjukan digambar menambah satu
 * permintaan jaringan pada tiap tekanan tanpa menambah satu keterangan pun.
 *
 * null  = belum pernah dibaca
 * []    = sudah dibaca dan memang kosong (SIPP tanpa tabel ruangan_sidang)
 */
let ruanganTersimpan = null;
let ruanganSedangDibaca = false;

async function muatRuangan() {
  if (ruanganTersimpan !== null || ruanganSedangDibaca) return ruanganTersimpan;
  ruanganSedangDibaca = true;
  try {
    const respons = await alatAmbil(
      ALETA_API_RUANGAN,
      { credentials: "include", cache: "no-store" },
      "Membaca daftar ruangan sidang"
    );
    const luar = await respons.json();
    const isi = (luar && luar.data) || luar || {};
    ruanganTersimpan = Array.isArray(isi.ruangan) ? isi.ruangan : [];
  } catch {
    // Gagal dibaca BUKAN "tidak ada ruangan": yang pertama membuat pemilihnya
    // tidak digambar sama sekali, yang kedua akan menggambar daftar kosong
    // yang terbaca seperti pengadilan tanpa ruang sidang.
    ruanganTersimpan = null;
  } finally {
    ruanganSedangDibaca = false;
  }
  return ruanganTersimpan;
}
const ALETA_API_SIAPA = "/aleta/api/aleta-ecourt/ekstensi/siapa";
const PENANDA = "aleta-panel-sipp";

/**
 * Mencari nomor perkara yang sedang DIBUKA, bukan sekadar yang pertama terlihat.
 *
 * ============================================================================
 * HALAMAN DAFTAR BUKAN HALAMAN PERKARA
 * ============================================================================
 *
 * Fungsi ini semula mengambil nomor perkara pertama yang ditemukan di halaman.
 * Di halaman Daftar Perkara, nomor pertama adalah baris teratas tabel - dan
 * panel pun memuat perkara itu, seolah petugas sedang membukanya. Padahal
 * petugas belum memilih apa pun.
 *
 * Akibatnya bukan sekadar salah tampil: panel menampilkan keadaan verifikasi
 * dan nomor pihak milik perkara yang tidak sedang diperiksa siapa pun, dan
 * tombol verifikasi hakim ikut muncul untuk perkara yang keliru.
 *
 * PENENTUNYA JUMLAH, BUKAN ALAMAT
 *
 * Halaman daftar selalu memuat LEBIH DARI SATU nomor perkara; halaman perkara
 * hanya satu. Aturan itu berlaku di semua jenis perkara dan semua versi SIPP.
 * Alamat halaman dipakai sebagai penguat saja - namanya berbeda-beda
 * (detil_perkara_agama, detil_perkara, dan seterusnya), jadi menggantungkan
 * keputusan padanya membuat ekstensi diam di halaman yang seharusnya aktif.
 */

/**
 * Halaman yang TIDAK BOLEH disentuh ekstensi sama sekali.
 *
 * ============================================================================
 * DOKUMEN RESMI TIDAK BOLEH MEMUAT KETERANGAN ALETA
 * ============================================================================
 *
 * "Cetak Relas" pada halaman Jadwal Sidang membuka halaman tersendiri, dan
 * alamatnya tetap di bawah /SIPP/ - misalnya
 *
 *     /SIPP/c_template_relaas_agama/popup_relaas/<blob>
 *
 * sehingga ekstensi ikut berjalan di sana. Halaman itu memuat tepat satu nomor
 * perkara, jadi pemeriksaan "lebih dari satu nomor berarti daftar" pun
 * meloloskannya - panel akan muncul, lalu ikut tercetak.
 *
 * Yang beredar kemudian adalah relas panggilan - dokumen resmi pengadilan yang
 * disampaikan jurusita kepada pihak berperkara - dengan keterangan dari sistem
 * yang bukan SIPP tercetak di dalamnya. Itu tidak boleh terjadi sekali pun.
 *
 * Daftar ini sengaja LEBIH LUAS daripada yang diketahui: nama templat cetak di
 * SIPP bermacam-macam dan bertambah antar versi. Salah menahan diri di halaman
 * yang sebenarnya aman hanya membuat panel tidak muncul di satu tempat; salah
 * menampilkan di halaman cetak merusak dokumen resmi.
 */
const POLA_HALAMAN_CETAK = [
  "/c_template",
  "/popup_",
  "/cetak",
  "/print",
  "/template_",
  "/laporan_cetak",
  "/amplop",
  "/instrumen",
];

function halamanCetakAtauTemplat() {
  const jalur = String(location.pathname || "").toLowerCase();
  return POLA_HALAMAN_CETAK.some((pola) => jalur.includes(pola));
}

const POLA_PERKARA = /\b(\d{1,5}\/[A-Za-z]{1,10}(?:\.[A-Za-z]{1,4}){0,2}\/\d{4}\/[A-Za-z]{2,4}\.[A-Za-z]{2,6})\b/g;

/** Apakah alamat halaman ini menyerupai halaman detail perkara? */
function alamatHalamanPerkara() {
  return /detil[_-]?perkara|detail[_-]?perkara/i.test(String(location.pathname || ""));
}

/**
 * ============================================================================
 * ALAMAT HALAMAN PERKARA YANG BOLEH DIBUKA ULANG
 * ============================================================================
 *
 * location.reload() pada halaman detail perkara SIPP selalu berakhir di
 * dasbor, dan itu bukan kebetulan. Nomor perkaranya tidak pernah ada di
 * alamat; controller mengambilnya dari flash session yang HABIS begitu
 * dibaca:
 *
 *     $idperkara = $this->nativesession->get_flash_session('perkara_id');
 *     if(!is_numeric($idperkara)){ redirect('main'); }
 *
 * Pemuatan kedua membaca sesi yang sudah kosong, lalu dialihkan ke 'main'.
 *
 * Pintu masuk yang sesungguhnya adalah perkara_detil/<enc>, dengan <enc>
 * nomor perkara yang disandikan. SIPP sendiri memakainya dari daftar
 * perkara, dan ia boleh dipakai berkali-kali.
 *
 * <enc> milik halaman ini sudah tercetak di halamannya sendiri - pemuat tab
 * Data Umum memakainya tanpa syarat, pada perkara apa pun:
 *
 *     $('#tabs1').load('<?php echo base_url("open_dataumum/".$enc);?>');
 *
 * Alamat pangkalnya ikut terbaca dari sana sekalian, jadi tidak perlu
 * menebak ada tidaknya index.php maupun nama folder pemasangannya.
 */
function alamatMasukPerkara() {
  if (!alamatHalamanPerkara()) return "";
  const isi = document.documentElement ? String(document.documentElement.innerHTML || "") : "";
  const cocok = /(https?:\/\/[^'"\s]*?\/)open_dataumum\/([^'"\/\s?#]+)/.exec(isi);
  if (!cocok) return "";
  return `${cocok[1]}perkara_detil/${cocok[2]}`;
}

/**
 * Jalur tulis ke SIPP -> modul bersama (muat-ulang-sipp.js): alamat halaman
 * disimpan SEBELUM menulis, ringkasan + muat ulang otomatis SESUDAH selesai
 * (gagal = hanya tombol). Daftar jalur: docs/muat-ulang/DAFTAR-JALUR-TULIS-SIPP.md.
 */
async function catatAlamatSebelumTulis(nomor) {
  const mu = globalThis.aletaMuatUlangSipp;
  if (!mu) return;
  try {
    await mu.catatAlamat(String(nomor || ""));
  } catch {
    /* alamat hanya kemudahan */
  }
}

/** @param {{nomor?:string, judulOk:string, judulGagal?:string, baris:Array<{jenis,teks,ok?}>, wadah?:HTMLElement, tanpaOtomatis?:boolean}} o */
function muatUlangSesudahTulis(o) {
  const mu = globalThis.aletaMuatUlangSipp;
  if (!mu) return null;
  try {
    return mu.jadwalkan({
      nomor: String(o.nomor || ""),
      ringkasan: mu.ringkasan(o.judulOk, o.baris, o.judulGagal),
      wadah: o.wadah,
      tanpaOtomatis: o.tanpaOtomatis === true,
    });
  } catch {
    return null;
  }
}

/**
 * ============================================================================
 * NOMOR PERKARA DIBACA DARI SIPP, BUKAN DARI PANEL ALETA SENDIRI
 * ============================================================================
 *
 * innerText badan halaman ikut memuat panel ALETA - panel itu ditempel ke
 * body. Sampai 5 Oktober 2026 nomor di dalam panel ikut dihitung: kartu
 * "Perkara berikutnya", daftar antrean putusan massal, dan riwayat menyebut
 * nomor perkara LAIN. Begitu salah satunya tergambar, halaman detail perkara
 * terbaca memuat dua nomor = "halaman daftar", segarkan() pulang tanpa
 * menggambar ulang, dan panel membeku: blangko Putusan Akhir yang baru
 * dibuka tidak pernah ditanggapi ("Blangko terbuka - … dibaca di Putusan
 * otomatis…" lalu diam, blangkonya kosong).
 *
 * Nomor yang tertulis di elemen milik ALETA dikurangkan dari hitungannya.
 * Nomor yang juga tertulis di halaman SIPP tetap terhitung, sebab
 * kemunculannya di SIPP tidak ikut terkurangi. Elemen ALETA yang tidak
 * tergambar (display:none) tidak dikurangkan - innerText badan pun tidak
 * memuatnya.
 */
const PENUNJUK_ELEMEN_ALETA = `#${PENANDA}, [data-aleta-tanda], .aleta-sisip, .aleta-tanda`;

function nomorDiElemenAleta() {
  const jumlah = new Map();
  if (!document.body || typeof document.querySelectorAll !== "function") return jumlah;
  for (const el of Array.from(document.querySelectorAll(PENUNJUK_ELEMEN_ALETA))) {
    // Hanya akar: elemen ALETA di dalam elemen ALETA sudah terhitung induknya.
    const induk = el.parentElement;
    if (induk && typeof induk.closest === "function" && induk.closest(PENUNJUK_ELEMEN_ALETA)) continue;
    try {
      if (typeof el.checkVisibility === "function" && !el.checkVisibility()) continue;
    } catch {
      /* peramban tanpa checkVisibility: dihitung */
    }
    const teks = String(el.innerText || "");
    const pola = new RegExp(POLA_PERKARA.source, "g");
    let m;
    while ((m = pola.exec(teks)) !== null) jumlah.set(m[1], (jumlah.get(m[1]) || 0) + 1);
  }
  return jumlah;
}

/**
 * ============================================================================
 * HALAMAN SATU PERKARA YANG MENYEBUT PERKARA LAIN (6 Oktober 2026, butir 7)
 * ============================================================================
 *
 * "Lebih dari satu nomor berarti daftar" keliru di halaman detail perkara
 * yang memang MENYEBUT perkara lain di isinya sendiri:
 *
 *   - Posita di tab Data Umum: "...dengan nomor putusan 556/Pdt.G/2024/PA.Dgl
 *     dan perkara tersebut telah putus..." - diukur atas sipp_donggala,
 *     131 dari 10.120 perkara (cerai ulang, harta bersama, verzet);
 *   - tab Akta Cerai (nomor akta "123/AC/2026/PA.Dgl"), tab Banding ("Nomor
 *     Perkara Tingkat Pertama" + nomor banding), dan baris "Terkait Nomor
 *     Perkara" pada alur restitusi.
 *
 * Halaman itu terbaca "daftar": panel menampilkan DAFTAR PERKARA beserta
 * seluruh menu massal, dan menu per perkara - termasuk unggah edoc putusan
 * dan edoc anonimisasi hakim - hilang.
 *
 * Di halaman beralamat detail perkara, nomor milik halaman dibaca dari baris
 * "Nomor Perkara" tab Data Umum - baris yang dicetak SIPP untuk perkara itu
 * sendiri (data_umum.php: td#first-child "Nomor Perkara"). Tab yang sedang
 * tidak dipilih tetap ada di DOM, jadi textContent dibaca, bukan innerText.
 * Label lain yang diawali "Nomor Perkara" (Tingkat Pertama, Banding,
 * Terkait...) TIDAK cocok: labelnya harus persis.
 */
const LABEL_NOMOR_PERKARA = /^nomor\s+perkara\s*:?$/i;

function nomorUtamaHalamanPerkara() {
  if (!document.body || typeof document.querySelectorAll !== "function") return "";
  for (const sel of Array.from(document.querySelectorAll("td, th"))) {
    if (typeof sel.closest === "function" && sel.closest(PENUNJUK_ELEMEN_ALETA)) continue;
    const label = String(sel.textContent || "").replace(/\s+/g, " ").trim();
    if (!LABEL_NOMOR_PERKARA.test(label)) continue;
    let isi = sel.nextElementSibling;
    // Satu sel penyela ":" di antara label dan isinya pada sebagian versi SIPP.
    if (isi && /^:?$/.test(String(isi.textContent || "").trim())) isi = isi.nextElementSibling || isi;
    if (!isi) continue;
    const pola = new RegExp(POLA_PERKARA.source);
    const cocok = pola.exec(String(isi.textContent || ""));
    if (cocok) return cocok[1];
  }
  return "";
}

function cariNomorPerkara() {
  // Halaman detail perkara: nomornya sendiri dari baris "Nomor Perkara" -
  // nomor perkara LAIN di posita, akta, atau banding tidak menjadikannya
  // halaman daftar (butir 7, 6 Okt 2026; lihat nomorUtamaHalamanPerkara).
  if (alamatHalamanPerkara()) {
    const utama = nomorUtamaHalamanPerkara();
    if (utama) return utama;
  }

  const teks = document.body ? String(document.body.innerText || "") : "";
  const milikAleta = nomorDiElemenAleta();

  // Seluruh nomor perkara yang berbeda di halaman ini - yang tertulis di
  // panel ALETA tidak dihitung (lihat di atas).
  const semua = new Set();
  POLA_PERKARA.lastIndex = 0;
  let cocok;
  while ((cocok = POLA_PERKARA.exec(teks)) !== null) {
    const sisa = milikAleta.get(cocok[1]) || 0;
    if (sisa > 0) {
      milikAleta.set(cocok[1], sisa - 1);
      continue;
    }
    semua.add(cocok[1]);
    if (semua.size > 1) break; // sudah cukup untuk tahu ini daftar
  }

  // Lebih dari satu berarti halaman daftar. Diam.
  if (semua.size > 1) return "";

  if (semua.size === 1) return [...semua][0];

  // Tidak ada di badan halaman, tetapi mungkin ada di judul - sebagian halaman
  // SIPP memuat nomor perkara hanya di judul jendela.
  if (alamatHalamanPerkara()) {
    const dariJudul = String(document.title || "").match(
      /\b(\d{1,5}\/[A-Za-z]{1,10}(?:\.[A-Za-z]{1,4}){0,2}\/\d{4}\/[A-Za-z]{2,4}\.[A-Za-z]{2,6})\b/
    );
    if (dariJudul) return dariJudul[1];
  }

  return "";
}

/**
 * ============================================================================
 * SAKLAR DIBACA SEKALI, BUKAN SETIAP HALAMAN BERUBAH
 * ============================================================================
 *
 * Ketiga saklar dulu dibaca dari chrome.storage pada SETIAP penyegaran, dan
 * penyegaran dipicu tiap kali DOM SIPP berubah. Pada halaman bertabel besar
 * itu berarti ratusan pembacaan penyimpanan sepanjang satu halaman - masing-
 * masing melompat ke proses ekstensi dan kembali, dan seluruhnya menahan
 * penyegaran yang seharusnya seketika.
 *
 * Sekarang nilainya dibaca sekali lalu disimpan di memori. Perubahan tetap
 * sampai: chrome.storage.onChanged di kaki berkas ini memperbaruinya, dan
 * saklar dari popup tetap berlaku tanpa memuat ulang halaman.
 */
const saklar = { aktif: true, tandaiHalaman: false, sisipJadwal: false, siap: false };

/**
 * ============================================================================
 * SALINAN DI MEMORI DAPAT BASI - DAN BASINYA TIDAK BERBUNYI
 * ============================================================================
 *
 * Salinan ini diperbarui pendengar chrome.storage.onChanged di kaki berkas.
 * Pendengar itu tidak selalu sampai:
 *
 *   - tab yang dibekukan peramban tidak menerimanya selama dibekukan;
 *   - ekstensi yang dimuat ulang meninggalkan tab lama tanpa pendengar sama
 *     sekali, sementara salinannya masih memegang nilai lama;
 *   - pemasangannya dibungkus try/catch yang diam bila gagal.
 *
 * Pada ketiganya centang di tingkap ekstensi berkata satu hal dan halaman
 * mengerjakan yang lain - persis keluhan 23 September 2026.
 *
 * `paksa` dipakai sekali tiap putaran penggambaran, bukan sekali tiap
 * pemanggilan: satu pembacaan penyimpanan per penyegaran, bukan tiga.
 */
async function muatSaklar(paksa = false) {
  if (saklar.siap && !paksa) return saklar;
  try {
    const simpan = await chrome.storage.local.get(["aktif", "tandaiHalaman", "sisipJadwal"]);
    saklar.aktif = simpan.aktif !== false;
    // ========================================================================
    // PENANDAAN HALAMAN KINI BAWAANNYA MENYALA
    // ========================================================================
    //
    // Dulu mati, dengan alasan yang masih benar: menyisipkan tanda ke dalam
    // halaman kerja orang tanpa mereka minta bukan keputusan yang pantas
    // diambil sendiri oleh sebuah pembaruan.
    //
    // Yang berubah bukan alasannya, melainkan akibatnya. Saklar ini terkubur
    // di popup ikon peramban - tempat yang hampir tidak pernah dibuka - dan
    // akibatnya penanda ghaib, izin atasan, dan panjar menipis TIDAK PERNAH
    // muncul di daftar perkara. Yang membacanya menyimpulkan penandanya rusak,
    // padahal ia memang tidak pernah dinyalakan. Itu dua kali dilaporkan
    // sebagai kerusakan, dan dua kali yang diperiksa adalah datanya - yang
    // ternyata benar.
    //
    // Penanda hanya MENAMBAH keterangan dan tidak mengubah satu pun data SIPP,
    // jadi harganya rendah dan gunanya tinggi. Yang tidak menginginkannya
    // tetap dapat mematikannya, dan pilihan itu diingat - dibaca "!== false",
    // bukan "=== true".
    saklar.tandaiHalaman = simpan.tandaiHalaman !== false;
    // Penyisipan berkas ke dalam tabel SIPP TETAP mati secara bawaan: ia
    // membuat berkas ALETA tampak seperti berkas SIPP, dan itu jauh lebih
    // mudah disalahpahami daripada label yang jelas bukan milik SIPP.
    saklar.sisipJadwal = simpan.sisipJadwal === true;
  } catch {
    // Penyimpanan tidak terjangkau: bawaannya tetap dipakai.
    saklar.aktif = true;
    saklar.tandaiHalaman = true;
    saklar.sisipJadwal = false;
  }
  saklar.siap = true;
  return saklar;
}

/** Apakah ekstensi dinyalakan? Bawaannya menyala. */
async function sedangAktif() {
  return (await muatSaklar()).aktif;
}

/**
 * Apakah petugas mengizinkan tampilan SIPP ditandai?
 *
 * Bawaannya MATI. Panel di sisi kanan hanya menambah lapisan di atas halaman
 * dan mudah diabaikan; menandai isi halaman SIPP sendiri lebih jauh dari itu -
 * dan halaman SIPP adalah tempat kerja orang, bukan tempat kita berkreasi.
 * Karena itu harus dinyalakan sendiri, bukan menyala diam-diam setelah
 * pembaruan.
 */
async function sedangMenandai() {
  return (await muatSaklar()).tandaiHalaman;
}

/**
 * Apakah petugas mengizinkan berkas disisipkan ke dalam tabel SIPP?
 *
 * Saklar TERSENDIRI, bukan ikut "Tandai halaman SIPP". Menandai hanya
 * menempelkan label kecil yang jelas bukan milik SIPP; menyisipkan berkas ke
 * dalam sel tabel membuat ALETA dan SIPP tampak menyatu - dan itu memang
 * tujuannya, tetapi juga yang membuatnya lebih berisiko disalahpahami
 * sebagai berkas resmi SIPP.
 *
 * Bawaannya MATI.
 */
async function sedangMenyisipkan() {
  return (await muatSaklar()).sisipJadwal;
}

function buatElemen(tag, kelas, teks) {
  const el = document.createElement(tag);
  if (kelas) el.className = kelas;
  if (teks !== undefined) el.textContent = teks;
  return el;
}

/** Keterangan sisa hari, dengan tenggat lewat dinyatakan tegas. */
function keteranganSisa(sisaHari, ambang) {
  if (sisaHari === null || sisaHari === undefined) return null;
  if (sisaHari < 0) return { teks: `lewat ${Math.abs(sisaHari)} hari`, nada: "lewat" };
  if (sisaHari === 0) return { teks: "hari ini", nada: "mendesak" };
  if (sisaHari <= ambang) return { teks: `${sisaHari} hari lagi`, nada: "mendesak" };
  return { teks: `${sisaHari} hari lagi`, nada: "aman" };
}

/**
 * ============================================================================
 * PENANDA NOMOR PIHAK DIMATIKAN - UNTUK SEMENTARA
 * ============================================================================
 *
 * "nomor belum dikonfirmasi" dan "tidak ada nomor di SIPP" ditempelkan pada
 * hampir setiap nama pihak di halaman SIPP. Keduanya benar - tetapi tidak ada
 * yang tahu harus berbuat apa dengannya, dan penanda yang tidak dapat
 * ditindaklanjuti mengajari orang mengabaikan penanda.
 *
 * Itu kerugian yang menular: begitu mata terbiasa melewati dua penanda kuning
 * pada tiap nama, penanda GHAIB yang merah pun ikut terlewat.
 *
 * Dimatikan lewat saklar, bukan dihapus. Alur verifikasi nomornya sendiri
 * masih hidup dan masih dipakai bot untuk memutuskan siapa yang boleh
 * dikirimi pemberitahuan WhatsApp - yang dimatikan hanya penempelannya ke
 * halaman SIPP. Menghapus kodenya berarti membuang jalan pulang ketika kelak
 * artinya sudah disepakati.
 */
const TANDAI_NOMOR_PIHAK = false;

async function pesanGalat(respons) {
  try {
    const isi = await respons.json();
    const galat = isi && isi.error;
    if (galat && typeof galat === "object") return String(galat.message || "");
    return String(galat || (isi && isi.message) || (isi && isi.alasan) || "");
  } catch {
    return "";
  }
}

function tombolUnduh(dokumen, format, label) {
  const tombol = buatElemen("button", "aleta-unduh", label);
  tombol.title = `Unduh ${label} — ${dokumen.judulDokumen || "dokumen"}`;

  /** Menampilkan kegagalan pada tombolnya sendiri, lengkap dengan sebabnya. */
  function tandaiGagal(pesan, singkat) {
    const semula = tombol.dataset.labelAsli || label;
    tombol.textContent = singkat || "gagal";
    // Sebab lengkapnya masuk ke title: teksnya kerap sepanjang satu kalimat,
    // dan tombol di dalam baris dokumen tidak punya ruang untuk itu.
    tombol.title = pesan || `Unduh ${label}`;
    tombol.classList.add("aleta-unduh-gagal");
    setTimeout(() => {
      tombol.textContent = semula;
      tombol.title = `Unduh ${label} — ${dokumen.judulDokumen || "dokumen"}`;
      tombol.classList.remove("aleta-unduh-gagal");
      tombol.disabled = false;
    }, 6000);
  }

  tombol.dataset.labelAsli = label;

  tombol.addEventListener("click", async () => {
    const semula = tombol.textContent;
    tombol.disabled = true;
    tombol.textContent = "…";

    try {
      const alamat = `${ALETA_BERKAS}?documentKey=${encodeURIComponent(dokumen.documentKey)}&format=${format}`;
      const respons = await alatAmbil(alamat, { credentials: "include", cache: "no-store" }, "Unduh berkas");

      if (!respons.ok) {
        const pesan = await pesanGalat(respons);
        if (respons.status === 401) {
          tandaiGagal("Sesi ALETA habis. Masuk lagi lalu ulangi.", "masuk dulu");
        } else if (respons.status === 403) {
          tandaiGagal(pesan || "Peran Anda tidak diberi akses mengunduh berkas.", "ditolak");
        } else {
          tandaiGagal(pesan || alatPesanGagal(null, respons.status, "Unduh berkas"));
        }
        return;
      }

      // ======================================================================
      // JAWABAN GALAT TIDAK BOLEH TERSIMPAN SEBAGAI BERKAS
      // ======================================================================
      //
      // Server dapat menjawab 200 dengan tubuh JSON berisi sebab kegagalan.
      // Menyimpannya apa adanya menghasilkan berkas bernama berkas.json yang
      // tampak seperti unduhan berhasil - inilah sebab laporan "berkasnya
      // hilang": berkasnya tidak hilang, yang terunduh memang bukan berkasnya.
      const tipe = String(respons.headers.get("content-type") || "").toLowerCase();
      if (tipe.includes("application/json")) {
        const pesan = await pesanGalat(respons);
        tandaiGagal(pesan || "Server menjawab keterangan, bukan berkas.");
        return;
      }

      const blob = await respons.blob();

      // Berkas kosong berarti gagal, sekalipun statusnya 200.
      if (blob.size === 0) {
        tandaiGagal("Berkasnya kosong di server. Tarik ulang perkara ini.");
        return;
      }

      // Diterbitkan pekerja latar, bukan tautan blob:http halaman SIPP - yang
      // kedua ditahan Chrome "site isn't using a secure connection" (14 Okt).
      const u = await alatUnduh(blob, String(namaBerkasDari(respons, dokumen, format)));
      if (!u.ok) {
        tandaiGagal(u.pesan || "Berkas tidak dapat disimpan.");
        return;
      }

      tombol.textContent = semula;
      tombol.disabled = false;
    } catch (kesalahan) {
      // Kalimatnya sudah disusun alatAmbil - lengkap dengan sebabnya dan daftar
      // yang tetap jalan tanpa ALETA. Membungkusnya lagi hanya memanjangkannya.
      tandaiGagal(String((kesalahan && kesalahan.message) || kesalahan));
    }
  });

  return tombol;
}

/** Nama berkas dari jawaban server, dengan cadangan bila tidak disebutkan. */
function namaBerkasDari(respons, dokumen, format) {
  const kepala = respons.headers.get("content-disposition") || "";
  const cocok = kepala.match(/filename="?([^";]+)"?/i);
  if (cocok) {
    try {
      return decodeURIComponent(cocok[1]);
    } catch {
      return cocok[1];
    }
  }
  const judul = (dokumen.judulDokumen || "dokumen").replace(/[\/:*?"<>|]/g, "");
  return `${judul}.${format === "word" ? "docx" : "pdf"}`;
}

// ─── Bagian yang dapat dilipat sendiri-sendiri ───────────────────────────────
//
// Panel memuat empat jenis keterangan, dan petugas yang berbeda memerlukan yang
// berbeda: panitera melihat berkas, hakim melihat verifikasi, jurusita melihat
// nomor pihak. Memaksa semuanya tampil sekaligus membuat panel panjang dan
// menutupi halaman SIPP yang justru sedang dikerjakan.
//
// Keadaan lipatan disimpan PER BAGIAN, bukan per perkara: petugas yang tidak
// pernah memakai satu bagian melipatnya sekali, dan tetap terlipat di perkara
// berikutnya.

const KUNCI_LIPATAN = "lipatanBagian";

/** Keadaan lipatan, dibaca sekali lalu disimpan di memori. */
let lipatanTersimpan = null;

async function muatLipatan() {
  if (lipatanTersimpan) return lipatanTersimpan;
  try {
    const simpan = await chrome.storage.local.get([KUNCI_LIPATAN]);
    lipatanTersimpan = simpan[KUNCI_LIPATAN] || {};
  } catch {
    lipatanTersimpan = {};
  }
  return lipatanTersimpan;
}

// ─── Keadaan perkara selengkapnya, diambil hanya bila diminta ────────────────
//
// ============================================================================
// DIMUAT SAAT DIBUKA, BUKAN SAAT PANEL DIGAMBAR
// ============================================================================
//
// Menu-menu di bawah ini membaca seluruh keadaan perkara: tahapan beserta
// ketepatan penginputannya, kelengkapan berkas, putusan, upaya hukum, dan
// penilaian SK. Itu bacaan yang jauh lebih berat daripada konteks e-Court -
// puluhan kueri ke SIPP untuk satu perkara.
//
// Menariknya setiap panel digambar berarti setiap perkara yang DILIHAT sekilas
// membayar ongkos penuh, padahal menu-menu ini jarang dibuka. Karena itu
// permintaannya baru berangkat saat menunya dibuka pertama kali, lalu hasilnya
// dipakai bersama seluruh menu - satu permintaan untuk semuanya.

let simpananStatus = { nomor: "", data: null, sedang: null };

/**
 * Menu malas yang hidup di halaman ini.
 *
 * Panel digambar ulang tiap kali perkara berganti, dan tiap gambar melahirkan
 * menu baru - jadi daftar ini dikosongkan di sana, bukan dibiarkan tumbuh
 * sepanjang umur halaman.
 */
let menuMalasHidup = [];

/**
 * ============================================================================
 * MEMBATALKAN SIMPANAN KEADAAN PERKARA
 * ============================================================================
 *
 * `simpananStatus` menyimpan satu jawaban keadaan perkara selama halaman
 * hidup, dan SELURUH menu panel membacanya dari sana - Berkas, Perkara,
 * Putusan, semuanya. Itu yang membuat mereka sepakat satu sama lain.
 *
 * Sampai ALETA menulis sesuatu.
 *
 * Simpanan itu dahulu hanya dibatalkan ketika pengambilannya GAGAL. Ketika
 * penetapan berhasil ditulis, ia dibiarkan apa adanya - sehingga:
 *
 *   - menu yang sudah terbuka tetap memajang keadaan SEBELUM penetapan
 *   - menu yang baru dibuka sesudahnya ikut menggambar dari simpanan basi itu
 *   - dan keduanya berselisih dengan halaman SIPP di belakangnya, yang sudah
 *     berubah
 *
 * Yang terlihat petugas: tab Berkas dan tab Perkara menyebutkan hal yang
 * berbeda tentang perkara yang sama, dan tidak satu pun cocok dengan apa yang
 * baru saja ia kerjakan. Tidak ada galat yang berbunyi - datanya memang
 * terbaca, hanya terbaca dari kemarin.
 *
 * Satu-satunya jalan memperbaikinya dahulu: menutup lalu membuka halaman SIPP.
 */
function lupakanStatusPerkara(nomor) {
  // Nomor yang disebut dicocokkan supaya menulis pada perkara A tidak membuang
  // simpanan perkara B yang sedang dibaca di tab sebelah.
  if (nomor && simpananStatus.nomor && simpananStatus.nomor !== nomor) return false;
  simpananStatus = { nomor: "", data: null, sedang: null };

  // Simpanan yang dibuang tidak menolong menu yang SUDAH terbentang - ia
  // sudah selesai menggambar dan tidak akan mengambil apa pun lagi. Menu
  // itulah yang paling dilihat orang sesudah menulis, dan justru itulah yang
  // dahulu paling lama basi.
  for (const kotak of menuMalasHidup) {
    try {
      if (kotak && typeof kotak.gambarUlang === "function") kotak.gambarUlang();
    } catch (galat) {
      // Satu menu yang gagal digambar tidak boleh menghentikan yang lain.
    }
  }
  return true;
}

/**
 * ============================================================================
 * PAPAN PENUNJUKAN
 * ============================================================================
 *
 * Menampilkan usulan PMH, PPP, PJS, dan PHS untuk perkara yang sedang dibuka.
 *
 * TAHAP INI BELUM MENULIS APA PUN. Tombol Kerjakan sengaja dibiarkan mati,
 * dan itu bukan pekerjaan yang tertinggal - selama beberapa hari pertama,
 * usulannya memang perlu diadu dengan penunjukan sungguhan sebelum ia diberi
 * izin menyentuh formulir. Kalau usulannya sering meleset, ketahuannya di sini,
 * bukan sesudah tercatat di SIPP.
 *
 * Dimuat malas seperti menu lain: hitungan gilirannya menyapu seluruh
 * penunjukan juru sita tahun berjalan, dan itu tidak pantas dijalankan pada
 * tiap perkara yang kebetulan dibuka.
 */
async function ambilUsulanPenunjukan(nomor, pilihanMajelis, andaian) {
  // Libur tambahan Pengaturan - dibaca sekali per halaman, tidak ditunggu.
  if (typeof ccMuatLiburTambahan === "function") void ccMuatLiburTambahan();
  const majelis = Array.isArray(pilihanMajelis) && pilihanMajelis.length > 0
    ? `&majelis=${encodeURIComponent(pilihanMajelis.join(","))}`
    : "";
  // Andaian antrean massal - perkara yang sudah diperiksa sebelumnya dan
  // dianggap tertulis. Lihat serialkanAndaian.
  const teksAndaian = serialkanAndaian(andaian);
  const parameterAndaian = teksAndaian ? `&andaian=${encodeURIComponent(teksAndaian)}` : "";
  const respons = await alatAmbil(
    `${ALETA_API_PENUNJUKAN}?nomor=${encodeURIComponent(nomor)}${majelis}${parameterAndaian}`,
    { credentials: "include", cache: "no-store" },
    "Menyusun usulan penunjukan"
  );

  if (respons.status === 401) throw new Error("Belum masuk ALETA.");
  if (respons.status === 403) {
    throw new Error("Peran Anda tidak diberi akses papan penunjukan.");
  }
  if (!respons.ok) throw new Error(alatPesanGagal(null, respons.status, "Menyusun usulan penunjukan"));

  const isi = await respons.json();
  const data = isi && isi.data ? isi.data : isi;
  if (!data || data.available === false) {
    throw new Error((data && data.message) || "ALETA Bot belum dapat dihubungi.");
  }
  return data;
}

/**
 * ============================================================================
 * NILAI UNTUK MESIN TULIS - ID, BUKAN NAMA
 * ============================================================================
 *
 * nilaiUntukBorang di atas memulangkan NAMA, sebab yang diisinya kotak
 * formulir SIPP yang memang menerima nama. Mesin tulis langsung tidak: ia
 * menulis ke perkara_hakim_pn, perkara_panitera_pn, dan perkara_jurusita, dan
 * ketiganya berkolom id.
 *
 * Keduanya sengaja dipisah alih-alih satu fungsi yang memulangkan keduanya.
 * Nama dan id diambil dari sumber yang sama dan dengan urutan menang yang sama
 * - susunan yang dipilih mengalahkan pilihan per-orang, dan keduanya
 * mengalahkan usulan - tetapi yang keliru di antara keduanya berakibat sangat
 * berbeda. Nama yang salah tertulis di formulir dan terlihat sebelum disimpan;
 * id yang salah langsung mendarat di basis data atas nama orang lain.
 */
/**
 * ============================================================================
 * TANGGAL SIDANG YANG DITULIS - PILIHAN PETUGAS SELALU MENANG (butir 38)
 * ============================================================================
 *
 * 5 Okt 2026, perkara 630/Pdt.G/2026/PA.Dgl: petugas menyalakan "Pilih tanggal
 * sendiri dari kalender" dan memilih 15 Oktober; papan menampilkan 15
 * Oktober; yang tertulis ke SIPP 21 Oktober - usulan ALETA. Sebabnya di dua
 * fungsi di sini (nilaiUntukBorang dan idUntukTulis): tanggal pilihan hanya
 * dipakai bila ia salah satu calon hari sidang majelis, dan tanggal dari
 * kalender memang TIDAK PERNAH ada di daftar calon - jadi ia selalu jatuh
 * kembali ke usulan, diam-diam, sementara papannya (gambarPenunjukan)
 * menampilkan tanggal pilihan.
 *
 * Sekarang tanggal yang dipilih tangan - dari daftar calon maupun dari
 * kalender - SELALU yang ditulis. Usulan hanya dipakai bila petugas tidak
 * memilih apa pun. Tanggal pilihan yang melanggar aturan TIDAK diganti:
 * masalahTanggalSidang menolaknya dengan sebab, dan petugas memilih ulang.
 */
function tanggalSidangTerpilih(usulan, pilihanManual = {}) {
  const manual = String((pilihanManual && pilihanManual.phs) || "").trim();
  if (manual) return manual;
  return String((usulan && usulan.phs && usulan.phs.usulan) || "");
}

/**
 * Sebab tanggal sidang PILIHAN TANGAN tidak dapat ditulis - "" bila sah.
 *
 * Aturannya aturan addSidangPertama_c SIPP sendiri: format tanggal, tidak
 * sebelum tanggal penetapan, bukan Sabtu/Minggu. Usulan ALETA sudah
 * memenuhinya; yang diperiksa hanya pilihan tangan.
 */
function masalahTanggalSidang(usulan, pilihanManual = {}) {
  const manual = String((pilihanManual && pilihanManual.phs) || "").trim();
  if (!manual) {
    // Usulan mesin yang jatuh pada hari libur (mis. libur tambahan Pengaturan
    // yang belum dikenal bot) juga ditahan, dengan sebabnya (18 Okt 2026).
    const usul = String((usulan && usulan.phs && usulan.phs.usulan) || "").slice(0, 10);
    const jenisUsul = Number(((usulan && usulan.perkara) || {}).jenisPerkaraId || 0);
    const awas = jenisUsul === 746 || typeof peringatanLiburPhs !== "function" ? "" : peringatanLiburPhs(usul);
    return awas ? `Usulan hari sidang ${awas}` : "";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(manual)) {
    return `Tanggal sidang pilihan Anda (${manual}) tidak terbaca. Pilih ulang dari kalender.`;
  }
  const penetapan = String((usulan && usulan.tanggalPenetapan) || "");
  if (penetapan && manual < penetapan) {
    return `Tanggal sidang pilihan Anda (${sebutTanggal(manual)}) mendahului tanggal penetapan ${sebutTanggal(penetapan)}. Pilih tanggal lain - ALETA tidak menggantinya sendiri.`;
  }
  // Jenis perkara 746 dikecualikan SIPP sendiri ("panggih, 10 maret 2026").
  const perkara = (usulan && usulan.perkara) || {};
  const jenisPerkara = Number(perkara.jenisPerkaraId ?? perkara.jenis_perkara_id ?? 0);
  const libur = jenisPerkara === 746 ? "" : hariAkhirPekan(manual);
  if (libur) {
    return `Tanggal sidang pilihan Anda jatuh pada hari ${libur} (${sebutTanggal(manual)}) - SIPP menolak hari sidang di hari libur. Pilih tanggal lain - ALETA tidak menggantinya sendiri.`;
  }
  // Libur nasional, cuti bersama, dan libur tambahan Pengaturan (18 Okt 2026).
  // SIPP sendiri hanya menolak Sabtu/Minggu - yang ini dicegah ALETA.
  const nasional = jenisPerkara === 746 || typeof ccBukanHariKerja !== "function" ? "" : ccBukanHariKerja(manual);
  if (nasional) {
    return `Tanggal sidang pilihan Anda (${sebutTanggal(manual)}) hari ${nasional.replace(/^libur: /, "libur ")}. Pilih hari kerja lain - ALETA tidak menggantinya sendiri.`;
  }
  return "";
}

/** Peringatan bila tanggal sidang (usulan atau pilihan) jatuh pada hari libur. */
function peringatanLiburPhs(iso) {
  const t = String(iso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || typeof ccBukanHariKerja !== "function") return "";
  const libur = ccBukanHariKerja(t);
  return libur ? `${sebutTanggal(t)} hari ${libur.replace(/^libur: /, "libur ")} - pilih hari sidang lain sebelum menetapkan.` : "";
}

function idUntukTulis(jenis, usulan, pilihanManual = {}) {
  if (jenis === "pmh") {
    const anggota = (usulan.pmh && usulan.pmh.anggota) || [];
    const kolam = (usulan.pmh && usulan.pmh.hitungan) || [];
    const susunanDipilih = susunanTerpilih(usulan.pmh, pilihanManual.majelis);

    const hakimId = [];
    for (const urutan of [0, 1, 2]) {
      const dariSusunan = susunanDipilih ? susunanDipilih.anggota[urutan] : null;
      const dariOrang = pilihanDari(kolam, (pilihanManual.pmhKursi || [])[urutan]);
      const orang = dariSusunan || dariOrang || anggota[urutan];
      const id = Number(orang && (orang.hakimId ?? orang.id));
      if (Number.isFinite(id) && id > 0) hakimId.push(id);
    }

    // Hakim tunggal memang satu kursi. Yang tidak boleh: majelis yang hanya
    // terbaca dua kursi - itu susunan yang tidak lengkap, dan menuliskannya
    // menghasilkan majelis cacat yang harus dibongkar dengan tangan.
    const bentuk = (usulan.pmh && usulan.pmh.bentuk) || "";
    if (bentuk === "majelis" && hakimId.length !== 3) return null;
    if (hakimId.length === 0) return null;
    return { hakimId };
  }

  if (jenis === "ppp") {
    const pp =
      pilihanDari(usulan.ppp && usulan.ppp.calon, pilihanManual.ppp) ||
      (usulan.ppp && usulan.ppp.usulan);
    const id = Number(pp && (pp.paniteraId ?? pp.id));
    return Number.isFinite(id) && id > 0 ? { petugasId: id } : null;
  }

  if (jenis === "pjs") {
    const js =
      pilihanDari(usulan.pjs && usulan.pjs.calon, pilihanManual.pjs) ||
      (usulan.pjs && usulan.pjs.usulan);
    const id = Number(js && (js.jurusitaId ?? js.id));
    return Number.isFinite(id) && id > 0 ? { petugasId: id } : null;
  }

  if (jenis === "phs") {
    const tanggalSidang = tanggalSidangTerpilih(usulan, pilihanManual);
    if (!tanggalSidang) return null;

    // ========================================================================
    // RUANGAN - TERMASUK SIDANG KELILING
    // ========================================================================
    //
    // Sebelum ini ruangannya dipatok pada mesin tulis: ruanganId 1, "Ruang
    // Sidang 1 Dalam Gedung". Penetapan hari sidang untuk sidang keliling
    // karena itu SELALU menulis ruangan yang keliru, dan kolom
    // sidang_keliling pada perkara_jadwal_sidang selalu 0.
    //
    // Gagalnya diam: penetapannya berhasil, berkasnya tercetak, sidangnya
    // digelar - dan laporan sidang keliling menghitung nol. Yang menyadarinya
    // baru penyusun laporan tahunan, berbulan-bulan kemudian.
    //
    // Dikirim HANYA bila petugas memilihnya. Tanpa pilihan, mesin tulis
    // memakai bawaannya sendiri - perilaku lama, utuh.
    const ruanganId = Number(pilihanManual.ruangan);
    const hasil = Number.isFinite(ruanganId) && ruanganId > 0 ? { tanggalSidang, ruanganId } : { tanggalSidang };
    // Jam sidang pilihan petugas (kartu Penetapan UI Baru, 19 Okt 2026). Tanpa
    // pilihan tidak dikirim: mesin tulis memakai bawaannya sendiri (09:00).
    const jam = String(pilihanManual.jam || "");
    if (/^\d{2}:\d{2}$/.test(jam) && jam !== "09:00") hasil.jamSidang = jam;
    return hasil;
  }

  return null;
}

/**
 * ============================================================================
 * ANDAIAN ANTREAN MASSAL - PERKARA YANG SUDAH DIPERIKSA DIANGGAP TERTULIS
 * ============================================================================
 *
 * Penetapan massal memeriksa dua puluh perkara lebih dahulu, lalu
 * menuliskannya satu per satu. Pada pemeriksaan, seluruh perkara dihitung
 * bot atas keadaan basis data yang SAMA - semuanya mengusulkan majelis,
 * panitera pengganti, dan juru sita berbeban terendah yang sama. Pada
 * penulisan, usulan diambil ulang sesudah tiap perkara tertulis, sehingga
 * bergilir. Pratinjaunya benar satu per satu dan keliru sebagai antrean.
 *
 * Karena itu usulan perkara ke-n diminta dengan andaian perkara 1..n-1
 * sudah tertulis - siapa majelisnya, panitera penggantinya, juru sitanya,
 * kapan sidangnya - dan bot menambahkannya ke beban sebelum menghitung.
 * Bentuk ringkasnya di alamat, sama persis dengan pembacanya di portal
 * (src/lib/andaian-penunjukan.ts):
 *
 *   perkaraId:hakim.hakim.hakim:paniteraId:jurusitaId:tanggalSidang
 *
 * Dibatasi 25 - sebesar BATAS_PERKARA_MASSAL.
 */
const BATAS_ANDAIAN = 25;

function serialkanAndaian(daftar) {
  if (!Array.isArray(daftar) || daftar.length === 0) return "";
  return daftar
    .slice(0, BATAS_ANDAIAN)
    .map((a) =>
      [
        a.perkaraId > 0 ? String(a.perkaraId) : "",
        (a.hakimId || []).filter((x) => x > 0).join("."),
        a.paniteraId > 0 ? String(a.paniteraId) : "",
        a.jurusitaId > 0 ? String(a.jurusitaId) : "",
        a.tanggalSidang || "",
      ].join(":")
    )
    .join(";");
}

/**
 * ============================================================================
 * MENETAPKAN LEWAT ALETA - TANPA BERPINDAH AKUN SIPP
 * ============================================================================
 *
 * Dahulu tombol Kerjakan hanya dapat mengisi BORANG SIPP yang sedang terbuka.
 * Di halaman yang borangnya tidak terbuka - halaman detail perkara, tempat
 * panel ini paling sering dibuka - ia menolak dengan "Borang penunjukan tidak
 * terbuka di halaman ini", dan satu-satunya jalan yang tersisa adalah membuka
 * empat halaman borang sambil berganti empat akun.
 *
 * Padahal mesin tulisnya sudah ada, lengkap, dan sudah dipakai Data Umum: ia
 * menulis ke perkara, perkara_penetapan, perkara_hakim_pn, perkara_panitera_pn,
 * perkara_jurusita, perkara_jadwal_sidang, perkara_penetapan_hari_sidang -
 * BESERTA barisnya di sys_audittrail, sebagaimana SIPP sendiri mencatat ketika
 * seorang petugas menekan Simpan.
 *
 * Yang belum ada cuma jalannya ke sana. Inilah jalannya.
 *
 * ============================================================================
 * KERING DULU, SELALU
 * ============================================================================
 *
 * Tekanan pertama TIDAK menulis apa pun. Ia meminta rencana keempat langkah
 * dan menggambarkannya: pernyataan apa, ke tabel mana, atas nama siapa.
 * Menulis menuntut tekanan KEDUA, atas rencana yang sudah terbaca.
 *
 * Itu bukan kehati-hatian yang berlebihan. Penetapan yang salah tidak dapat
 * dibatalkan dengan menekan ulang - ia harus dibongkar dengan tangan dari
 * beberapa tabel sekaligus, dan jejaknya di sys_audittrail tetap tinggal.
 *
 * ============================================================================
 * BERHENTI PADA KEGAGALAN PERTAMA
 * ============================================================================
 *
 * Urutannya tidak dapat dibalik: SIPP menolak PPP dan PJS selama majelisnya
 * belum ada, dan PHS menetapkan hari sidang BAGI majelis itu. Kalau PMH gagal,
 * meneruskan ke PPP hanya menambah kegagalan yang sebabnya sama - dan yang
 * membacanya akan menyangka ada empat masalah, padahal satu.
 */
/**
 * Rantai penetapan itu sendiri - tanpa satu pun elemen layar.
 *
 * Dipakai dua jalur: tombol Tetapkan pada satu perkara, dan penetapan massal
 * atas perkara terpilih di halaman daftar. Satu salinan, supaya urutan yang
 * tidak dapat dibalik itu hanya ada di satu tempat.
 */
/**
 * ============================================================================
 * KODE PENOLAKAN BOT MENJADI KALIMAT YANG DAPAT DIKERJAKAN
 * ============================================================================
 *
 * Bot menjawab penolakan dengan kode: "akun_pejabat_tidak_ketemu",
 * "tanggal_penetapan_tidak_sah", "pmh_belum_ada". Kode itu tepat dan singkat
 * - dan tidak berarti apa pun bagi petugas yang membacanya di panel.
 *
 * Lebih buruk lagi sebelumnya: seluruh penolakan tampil sebagai "ditolak",
 * satu kata yang sama untuk sebab yang berbeda-beda, sebab rute portal
 * meneruskan pembungkus gerbangnya dan bukan jawaban botnya. Penetapan
 * massal yang berhenti di perkara pertama karena itu tidak dapat ditelusuri
 * sama sekali.
 *
 * Yang diterjemahkan di sini hanya BUNYINYA. Kodenya tetap dibawa apa adanya
 * pada hasil, sebab penjaga _sudah_ada di beberapa tempat mencocokkannya.
 */
const KALIMAT_ALASAN = [
  {
    pola: /^akun_pejabat_tidak_ketemu$/,
    kalimat: (akun) =>
      `Akun SIPP ${akun ? `"${akun}"` : "pejabat penetapnya"} tidak ada di SIPP. ` +
      "Perbaiki pemetaan jabatan di ALETA - yang disimpan di sana harus NAMA AKUN SIPP " +
      "(seperti ketua, hakim1, panitera), bukan nama orangnya.",
  },
  // Butir 17 (13 Okt 2026): penetapan tercatat atas akun SIPP PEJABATNYA -
  // akun yang tidak pasti DITOLAK, tidak pernah jatuh ke akun yang masuk.
  {
    pola: /^pejabat_belum_dipilih$/,
    kalimat: () =>
      "Pejabat penetapnya belum dipilih. Pilih pejabat pada \"Pejabat yang menetapkan\" - penetapan dicatat di SIPP atas nama akun pejabat itu.",
  },
  {
    pola: /^sedang_dikerjakan$/,
    kalimat: () =>
      "Perkara ini sedang dikerjakan penetapannya oleh pekerjaan lain (tab, tombol di halaman SIPP, atau antrean). Tunggu selesai, lalu muat ulang - yang sudah tertulis dilewati.",
  },
  {
    pola: /^kunci_tidak_tersedia$/,
    kalimat: () => "Pagar penetapan di server ALETA tidak dapat dipakai sekarang, jadi tidak ada yang ditulis. Coba lagi sebentar lagi.",
  },
  {
    pola: /^keadaan_tidak_terbaca$/,
    kalimat: () => "Keadaan penetapan perkara ini tidak terbaca dari SIPP, jadi tidak ada yang ditulis. Coba lagi sebentar lagi.",
  },
  {
    pola: /^bongkar_tanpa_perintah$/,
    kalimat: () => "Membongkar hanya dapat dilakukan dengan menekan tombol Bongkar sendiri.",
  },
  {
    pola: /^pejabat_tidak_sah$/,
    kalimat: (akun) =>
      `Akun ${akun ? `"${akun}"` : "pilihan"} bukan pejabat yang berwenang untuk langkah ini (PMH: Ketua/Wakil/Plh Ketua; PPP/PJS: Panitera/Plh Panitera). Pilih pejabat lain.`,
  },
  {
    pola: /^akun_pejabat_ganda$|^akun_ketua_majelis_ganda$/,
    kalimat: () =>
      "Pejabat ini punya lebih dari satu akun SIPP yang hidup, sehingga akun yang dicatat tidak dapat dipastikan. ALETA tidak memilihkannya - blokir akun lama di SIPP lebih dulu.",
  },
  {
    pola: /^akun_pejabat_diblokir$/,
    kalimat: (akun) =>
      `Akun SIPP ${akun ? `"${akun}"` : "pejabat"} diblokir atau kedaluwarsa - penetapan tidak dicatat atas akun mati. Pilih pejabat lain atau aktifkan akunnya di SIPP.`,
  },
  {
    pola: /^akun_bukan_pejabat$/,
    kalimat: (akun) =>
      `Akun SIPP ${akun ? `"${akun}"` : "itu"} tidak tertaut ke hakim maupun panitera di SIPP, jadi bukan akun pejabat. Penetapan tidak dicatat atas akun admin/meja.`,
  },
  {
    pola: /^akun_ketua_majelis_tidak_ada$/,
    kalimat: () =>
      "Ketua majelis perkara ini belum punya akun SIPP yang hidup - PHS tidak dapat dicatat atas namanya. Tautkan akunnya di SIPP (user_hakim) lebih dulu.",
  },
  {
    pola: /^pejabat_phs_bukan_majelis$/,
    kalimat: (akun) =>
      `Akun ${akun ? `"${akun}"` : "pilihan"} bukan anggota majelis perkara ini - PHS hanya dicatat atas ketua/anggota majelisnya.`,
  },
  {
    pola: /^pemetaan_jabatan_tidak_terbaca$/,
    kalimat: () => "Daftar akun pejabat SIPP tidak terbaca dari ALETA Bot - coba lagi sebentar.",
  },
  {
    pola: /^akun_sipp_belum_terbaca$/,
    kalimat: () =>
      "Akun SIPP Anda tidak terbaca di halaman ini. Masuk ke SIPP lebih dulu di peramban ini - akun yang masuk dicatat ALETA sebagai penekan; di SIPP penetapan tercatat atas nama pejabatnya.",
  },
  {
    pola: /^akun_sipp_tidak_ketemu$/,
    kalimat: (akun) =>
      `Akun SIPP ${akun ? `"${akun}"` : "yang sedang masuk"} tidak ditemukan di daftar pengguna SIPP. Muat ulang halaman SIPP, lalu coba lagi.`,
  },
  {
    pola: /^akun_sipp_ganda$/,
    kalimat: (akun) =>
      `Nama ${akun ? `"${akun}"` : "akun SIPP ini"} dipakai lebih dari satu akun SIPP, dan akun mana yang sedang masuk dari komputer ini tidak dapat dipastikan. ALETA tidak memilihkannya - keluar lalu masuk kembali ke SIPP, kemudian coba lagi.`,
  },
  {
    pola: /^tanggal_sidang_hari_libur$/,
    kalimat: () => "Tanggal sidang jatuh pada hari libur (Sabtu/Minggu, libur nasional, atau cuti bersama). Pilih hari kerja lain; ALETA tidak menggantinya sendiri.",
  },
  {
    pola: /^sidang_mendahului_penetapan$/,
    kalimat: () => "Tanggal sidang mendahului tanggal penetapannya. Pilih tanggal lain; ALETA tidak menggantinya sendiri.",
  },
  {
    pola: /^tanggal_penetapan_hari_libur$/,
    kalimat: () => "Tanggal penetapan jatuh pada hari libur (Sabtu/Minggu, libur nasional, atau cuti bersama). Penetapan tidak dibuat pada hari libur.",
  },
  {
    pola: /^tanggal_penetapan_masa_depan$/,
    kalimat: () => "Tanggal penetapan melebihi hari ini - SIPP menolaknya.",
  },
  {
    pola: /^tanggal_penetapan_sebelum_pendaftaran$/,
    kalimat: () => "Tanggal penetapan majelis mendahului tanggal pendaftaran perkara - SIPP menolaknya.",
  },
  {
    pola: /^tanggal_penetapan_tidak_sah$/,
    kalimat: () => "Tanggal penetapannya tidak terbaca. Perkara ini mungkin belum punya tanggal pendaftaran yang sah di SIPP.",
  },
  {
    pola: /^perkara_tidak_ketemu$/,
    kalimat: () => "Perkara ini tidak ditemukan di SIPP.",
  },
  {
    pola: /^operator_tidak_disebut$/,
    kalimat: () => "Akun ALETA Anda tidak terbaca. Muat ulang panel, lalu coba lagi.",
  },
  {
    pola: /^(pmh|ppp|pjs)_belum_ada$/,
    kalimat: (_akun, kode) =>
      `${kode.split("_")[0].toUpperCase()} belum tersimpan di SIPP, padahal langkah ini menuntutnya lebih dulu.`,
  },
  {
    pola: /_sudah_ada$/,
    kalimat: (_akun, kode) => `${kode.replace(/_sudah_ada$/, "").toUpperCase()} memang sudah ada di SIPP.`,
  },
  {
    pola: /^tanggal_penetapan_mendahului$/,
    kalimat: () =>
      "Tanggal penetapan ini mendahului penetapan yang sudah ada di SIPP. Langkah sisa ditanggali sama dengan PMH yang sudah ada, atau sesudahnya.",
  },
  {
    // Mode coba (Super Admin mencoba tampilan baru tanpa izin tindakan nyata)
    // menahan SELURUH kiriman, termasuk uji kering penetapan.
    pola: /^mode_coba$/,
    kalimat: () =>
      "Mode coba sedang aktif di peramban ini - tidak ada yang dikirim ke ALETA maupun SIPP. Centang 'Izinkan tindakan nyata' pada ikon ALETA di pojok peramban, lalu coba lagi.",
  },
  {
    // Mode kering dan mode latihan menahan kiriman yang SAMA dengan mode coba
    // (uji rilis 9 Okt 2026). Tanpa terjemahan ini penetapan massal menulis
    // "PMH: mode_latihan" pada tiap perkara, dan tidak berhenti.
    pola: /^mode_kering$/,
    kalimat: () =>
      "Mode kering sedang aktif di peramban ini - tidak ada yang dikirim ke ALETA maupun SIPP, termasuk pemeriksaan penetapan. Matikan Mode kering di Perkakas Super Admin, lalu coba lagi.",
  },
  {
    pola: /^mode_latihan$/,
    kalimat: () =>
      "LATIHAN: mode latihan menyala di peramban ini - tidak ada yang dikirim ke ALETA maupun SIPP, termasuk pemeriksaan penetapan. Lihat catatan latihan; matikan mode latihan pada ikon ALETA untuk menetapkan sungguhan.",
  },
  {
    // Jawaban portal tanpa kode bot (uji rilis 9 Okt 2026) - lihat
    // jawabanTulisTanpaAlasan di rantaiPenetapan.
    pola: /^aleta_belum_masuk$/,
    kalimat: () =>
      "Sesi ALETA Anda habis atau belum masuk di peramban ini. Masuk ke portal ALETA di tab lain, lalu tekan lagi - perkara yang sudah tertulis akan dilewati.",
  },
  {
    pola: /^aleta_tanpa_akses$/,
    kalimat: () => "Peran Anda tidak diberi akses menulis penetapan di ALETA.",
  },
  {
    pola: /^jenis_tidak_didukung$/,
    kalimat: () => "Jenis penetapan ini tidak dikenali ALETA.",
  },
  // Uji rilis U1 (9 Okt 2026) - lihat jawabPenetapanMenurutStatus.
  {
    pola: /^belum_masuk_aleta$/,
    kalimat: () =>
      "Sesi ALETA di peramban ini sudah habis (atau belum masuk). Buka portal ALETA di tab lain, masuk, lalu tekan lagi - langkah ini belum ditulis ke SIPP.",
  },
  {
    pola: /^tidak_berwenang_aleta$/,
    kalimat: () =>
      "Akun ALETA Anda tidak diberi akses menuliskan penetapan (kemampuan papan penunjukan). Hubungi administrator ALETA - langkah ini belum ditulis ke SIPP.",
  },
];

/** Bunyi yang dibaca petugas untuk satu kode penolakan. */
function kalimatAlasan(kode, akun) {
  const teks = String(kode || "").trim();
  if (!teks) return "";
  for (const satu of KALIMAT_ALASAN) {
    if (satu.pola.test(teks)) return satu.kalimat(akun, teks);
  }
  // Yang belum punya terjemahannya dibiarkan apa adanya - kode yang asing
  // masih dapat dicari, sedangkan kalimat karangan tidak.
  return teks;
}

/**
 * Mengirim seluruh langkah sisa satu perkara SEKALIGUS (uji rilis U1, 9 Okt
 * 2026) dan mengisi tempatnya di `hasil`. Bot menuliskannya dalam satu
 * transaksi: berhasil semua, atau tidak satu pun tertulis.
 *
 * Bila pemeriksaan di panel sudah gagal pada salah satu langkah (tanggal
 * sidang tidak sah, usulan tidak tersusun), tidak ada yang dikirim - menulis
 * sebagian rantai justru yang hendak dihindari.
 */
/**
 * Keputusan 104 (18 Okt 2026): menulis penetapan di luar jam kerja satker
 * (Senin-Kamis 07.30-16.00, Jumat 07.30-16.30 WITA, atau hari libur) DITANYAKAN
 * dulu - Antrekan (bawaan, dikerjakan sendiri pada jam kerja berikutnya) atau
 * Tulis sekarang. Kotak kecil di atas halaman, bukan window.confirm, supaya
 * kedua pilihannya bernama jelas.
 */
function tanyaJamKerjaPenetapan(pesan) {
  return new Promise((selesai) => {
    // Latar redup + agak kabur di belakang kotak (26 Okt 2026); token bersama di panel.css.
    const tirai = document.createElement("div");
    tirai.className = "aleta-tirai-latar";
    tirai.setAttribute("aria-hidden", "true");
    tirai.style.cssText = "position:fixed;inset:0;z-index:2147483645;background:var(--aleta-tirai-warna,rgba(15,23,42,.38));-webkit-backdrop-filter:var(--aleta-tirai-filter,none);backdrop-filter:var(--aleta-tirai-filter,none)";
    const kotak = document.createElement("div");
    kotak.setAttribute("role", "alertdialog");
    kotak.className = "aleta-tanya-jam-kerja";
    kotak.style.cssText =
      "position:fixed;z-index:2147483646;left:50%;top:18%;transform:translateX(-50%);max-width:440px;" +
      "background:#fffbeb;color:#78350f;border:1px solid #f59e0b;border-radius:8px;padding:14px 16px;" +
      "box-shadow:0 8px 24px rgba(0,0,0,.18);font:14px/1.45 system-ui,sans-serif";
    const teks = document.createElement("p");
    teks.style.margin = "0 0 10px";
    teks.textContent = pesan || "Sekarang di luar jam kerja. Penetapan akan dikerjakan pada jam kerja berikutnya.";
    const baris = document.createElement("div");
    baris.style.cssText = "display:flex;gap:8px;flex-wrap:wrap";
    const tombol = (label, nilai, utama) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.style.cssText = utama
        ? "background:#b45309;color:#fff;border:0;border-radius:6px;padding:6px 14px;cursor:pointer"
        : "background:#fff;color:#78350f;border:1px solid #b45309;border-radius:6px;padding:6px 14px;cursor:pointer";
      b.addEventListener("click", () => {
        kotak.remove();
        tirai.remove();
        selesai(nilai);
      });
      return b;
    };
    const antre = tombol("Antrekan", "antrekan", true);
    baris.append(antre, tombol("Tulis sekarang", "sekarang", false));
    kotak.append(teks, baris);
    document.body.appendChild(tirai);
    document.body.appendChild(kotak);
    antre.focus();
  });
}

/**
 * Penetapan yang SEDANG ditulis di halaman ini, per nomor perkara. Satu kunci
 * untuk SEMUA jalan menulis di halaman (kartu Penetapan, tombol Tetapkan, dan
 * tombol "Penetapan Otomatis" di halaman SIPP): tekanan kedua dari jalan mana
 * pun selagi yang pertama berjalan DITOLAK, bukan ditulis ganda (20 Okt 2026,
 * temuan penetapan ganda 684/Pdt.G/2026/PA.Dgl). Uji kering tidak menulis,
 * jadi tidak dikunci.
 */
const kunciTulisPenetapan = new Set();

const NAMA_HARI = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

/** Nama hari akhir pekan bila tanggalnya jatuh di sana, kalau tidak kosong. */
function hariAkhirPekan(tanggalIso) {
  const cocok = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(tanggalIso || ""));
  if (!cocok) return "";
  // Dibuat sebagai tanggal SETEMPAT, bukan UTC: new Date("2026-09-26")
  // dibaca sebagai tengah malam UTC, dan di WITA itu sudah pukul delapan
  // pagi hari yang sama - benar hari ini, keliru pada zona di sebelah barat.
  const d = new Date(Number(cocok[1]), Number(cocok[2]) - 1, Number(cocok[3]));
  if (Number.isNaN(d.getTime())) return "";
  const hari = d.getDay();
  return hari === 0 || hari === 6 ? NAMA_HARI[hari] : "";
}

/** "2026-09-22" menjadi "Selasa, 22-09-2026" - yang dibaca orang, bukan mesin. */
function sebutTanggal(tanggalIso) {
  const cocok = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(tanggalIso || ""));
  if (!cocok) return String(tanggalIso || "");
  const d = new Date(Number(cocok[1]), Number(cocok[2]) - 1, Number(cocok[3]));
  if (Number.isNaN(d.getTime())) return String(tanggalIso || "");
  return `${NAMA_HARI[d.getDay()]}, ${cocok[3]}-${cocok[2]}-${cocok[1]}`;
}

/**
 * Siapa yang menetapkan satu penetapan, beserta akun SIPP-nya.
 *
 * Dibaca dari rencana kerja - di situlah pelaksana tiap langkah sudah
 * ditentukan dari penautan akun-jabatan, bukan ditebak dari nama. Bila
 * rencananya belum ada, jabatannya saja yang disebut; itu tetap lebih berguna
 * daripada diam.
 */
/**
 * ============================================================================
 * ANGKANYA BOBOT, DAN SELAMA INI DISEBUT "PERKARA"
 * ============================================================================
 *
 * "Tanty Restianty - 278.5 perkara" tidak dapat dipahami siapa pun, sebab
 * tidak ada setengah perkara. Angkanya memang bukan jumlah perkara melainkan
 * BEBAN BERBOBOT, dihitung penyusun usulan supaya pemerataan tidak menyamakan
 * perkara yang berat dengan yang ringan:
 *
 *   cerai gugat, cerai talak, itsbat nikah            1,0
 *   harta bersama, kewarisan, P3HP, wasiat, eksyar    2,0
 *   selain itu                                        1,5
 *
 * Dua perbaikan sekaligus, dan yang kedua lebih penting daripada yang pertama:
 * angkanya dibulatkan supaya tidak berdesimal, DAN namanya diluruskan menjadi
 * "beban". Membulatkan saja hanya menyembunyikan desimalnya - yang menyesatkan
 * bukan koma lima itu melainkan kata "perkara" di belakangnya.
 */
function sebutBeban(nilai) {
  const angka = Number(nilai);
  if (!Number.isFinite(angka)) return "";
  return `beban ${Math.round(angka)}`;
}

/**
 * Teks petugas/majelis tercatat dari SIPP memisahkan nama dengan markah HTML mentah
 * ("Fahri Saifuddin</br>Himawan Tatura Wijaya</br>Derry Briantono"). Di layar menjadi
 * "Fahri Saifuddin, Himawan Tatura Wijaya, Derry Briantono" - tanpa penyisipan HTML
 * (hanya teks), sisa penanda lain dibuang.
 */
function bersihkanPemisahBr(teks) {
  return String(teks == null ? "" : teks)
    .replace(/<\s*\/?\s*br\s*\/?\s*>/gi, ", ")
    .replace(/<[^>]*>/g, "")
    .replace(/(?:\s*,){2,}/g, ",")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/^[,\s]+|[,\s]+$/g, "");
}

/**
 * Mencari satu calon dari daftarnya menurut pengenal yang dipilih.
 *
 * Mengembalikan null bila tidak ketemu - dan pemanggilnya jatuh kembali ke
 * usulan semula. Pilihan yang menunjuk orang yang sudah tidak ada di daftar
 * (misalnya sesudah papan dimuat ulang dan kolamnya berubah) tidak boleh
 * menghasilkan penetapan tanpa nama.
 */
/**
 * Susunan majelis yang sedang dipilih, atau null.
 *
 * Kuncinya rangkaian hakim_id yang disambung tanda hubung - dibuat di layanan,
 * bukan di sini, supaya kunci yang dikirim balik pasti cocok dengan yang
 * ditawarkan. Susunan yang kuncinya sudah tidak ada di daftar - misalnya
 * sesudah salah seorang hakimnya pindah - memulangkan null, dan pemanggilnya
 * jatuh kembali ke pilihan per-orang atau ke usulan.
 */
function susunanTerpilih(pmh, kunci) {
  if (!kunci) return null;
  const daftar = (pmh && pmh.susunanTerpakai) || [];
  return daftar.find((x) => x.kunci === kunci) || null;
}

function pilihanDari(daftar, pengenal) {
  if (!Array.isArray(daftar) || !pengenal) return null;
  return (
    daftar.find(
      (x) =>
        String(x.id ?? x.hakimId ?? x.paniteraId ?? x.jurusitaId ?? x.nama) === String(pengenal)
    ) || null
  );
}

/**
 * ============================================================================
 * MENGGANTI MAJELIS = MENGHITUNG ULANG SELURUH RANTAINYA
 * ============================================================================
 *
 * Panitera sidang, hari sidang, dan penanda tangan PHS semuanya TURUNAN dari
 * majelis. Menggantinya di dropdown tanpa menghitung ulang turunannya berarti
 * menampilkan majelis A di atas panitera, hari, dan penanda tangan majelis B -
 * dan itulah yang terjadi selama ini.
 *
 * Perhitungannya diserahkan ke server, bukan ditiru di sini: server-lah yang
 * memegang SK, hari sidang tiap majelis, dan beban tiap orang. Meniru
 * sebagian di peramban berarti dua salinan aturan yang perlahan menyimpang.
 *
 * Yang DIPERTAHANKAN dari data lama: mode papan, pilihan manual lain
 * (juru sita, tanggal bebas, ruangan), dan pejabat yang dipilih. Yang diganti
 * hanya usulan dan rencananya.
 */
/** Kunci susunan - bentuk yang sama dengan yang disusun bot: id dipisah "-". */
function kunciSusunan(hakimId) {
  return (Array.isArray(hakimId) ? hakimId : []).map((x) => String(x)).join("-");
}

/**
 * ============================================================================
 * MENYALAKAN TOMBOL KERJAKAN - ATAU MENJELASKAN KENAPA TIDAK
 * ============================================================================
 *
 * Empat hal harus benar sekaligus:
 *
 *   1. Perannya diberi kewenangan mengisi
 *   2. Peta kolom formulirnya sudah lengkap
 *   3. Borang itu memang sedang terbuka di halaman ini
 *   4. Ada nilai yang hendak diisikan
 *
 * Yang tidak terpenuhi DISEBUTKAN, bukan dibiarkan sebagai tombol kelabu
 * tanpa keterangan. Tombol mati tanpa alasan membuat orang menekannya
 * berulang kali lalu menyimpulkan aplikasinya rusak.
 */
/**
 * Nama pemakai SIPP yang SEDANG masuk, dibaca dari kepala halamannya.
 *
 * SIPP menulis di kepala tiap halaman:
 *
 *     Selamat Datang <font color='...'>NAMA LENGKAP</font>
 *     <br> Anda Login Sebagai <font color='...'>JABATAN</font>
 *
 * Keduanya berada dalam satu sel, jadi <font> PERTAMA-lah namanya.
 *
 * Mengembalikan "" bila tidak terbaca - dan itu ditangani sebagai "tidak tahu",
 * bukan sebagai "bukan siapa-siapa".
 */
/**
 * Riwayat perkara yang dibuka di SIPP - dibaca panel di halaman ALETA.
 *
 * Hanya halaman DETAIL yang dicatat: alamatnya menunjuk satu perkara, sehingga
 * tautannya membuka perkara itu lagi. Halaman daftar juga memuat nomor
 * perkara, tetapi alamatnya menunjuk daftar - tautan yang mengantar ke tempat
 * yang salah lebih buruk daripada tidak ada tautan.
 *
 * Delapan yang terakhir, tanpa kembar. Ini kemudahan, bukan catatan: gagal
 * menulisnya tidak boleh menyentuh apa pun yang lain.
 */
const KUNCI_RIWAYAT_SIPP = "riwayatPerkaraSipp";

async function catatRiwayatPerkaraSipp(nomor, konteks) {
  if (!nomor || !alamatHalamanPerkara()) return;
  try {
    const simpan = await chrome.storage.local.get([KUNCI_RIWAYAT_SIPP]);
    const lama = Array.isArray(simpan[KUNCI_RIWAYAT_SIPP]) ? simpan[KUNCI_RIWAYAT_SIPP] : [];
    const baru = [
      {
        nomor,
        // Alamat yang sama masalahnya: location.href halaman ini tidak
        // dapat dibuka ulang, jadi yang disimpan pintu masuknya.
        url: alamatMasukPerkara() || location.href,
        jenis: (konteks && konteks.identitas && konteks.identitas.jenisPerkara) || "",
        waktu: new Date().toISOString(),
      },
      ...lama.filter((x) => x && x.nomor !== nomor),
    ].slice(0, 8);
    await chrome.storage.local.set({ [KUNCI_RIWAYAT_SIPP]: baru });
    // U16 (rantai B): salinan ke server per pengguna, hanya bila saklar konteksDiServer menyala (mati = tidak ada yang dikirim).
    if (globalThis.ALETA_KONTEKS_SERVER) globalThis.ALETA_KONTEKS_SERVER.catat();
  } catch {
    /* riwayat hanya kemudahan */
  }
}

function namaPenggunaSipp() {
  const semua = document.querySelectorAll("font");
  for (const huruf of semua) {
    const induk = huruf.parentElement;
    if (!induk) continue;
    if (!String(induk.textContent || "").includes("Selamat Datang")) continue;
    const nama = String(huruf.textContent || "").trim();
    if (nama) return nama;
  }
  return "";
}

/**
 * perkara_id sebagaimana tertulis pada borang SIPP yang sedang terbuka.
 *
 * ============================================================================
 * DI HALAMAN PERKARA AGAMA, INI SELALU KOSONG - DAN ITU BUKAN CACAT
 * ============================================================================
 *
 * Diperiksa 22 September 2026, sesudah unggah putusan selalu ditolak dengan
 * "perkara_id belum disebut.". Andaian lama di sini - "borang Putusan Akhir
 * harus membawanya" - SALAH:
 *
 *   - SIPP mengenali perkara pada borang Putusan Akhir lewat `enc`, nomor
 *     perkara yang tersandi (edit_putusan_akhir.php). perkara_id hanya dipakai
 *     pada borang grasi dan peninjauan kembali.
 *   - Di halaman detil_perkara_agama, #frm_putusan bahkan belum lahir sampai
 *     tingkapnya dibuka; tab Putusan Akhir hanya memuat halaman tampilan.
 *
 * Jadi fungsi ini memang hampir selalu memulangkan untai kosong, dan itu
 * TIDAK boleh menjadi kegagalan. Kedua rute yang menerimanya - unggah-naskah
 * dan unggah-sipp - menanyakannya sendiri ke SIPP lewat gerbang bila kosong.
 * Yang satu sudah punya jalan mundur itu sejak awal; yang lain baru diberi
 * pada 2.32.0, dan selama itu tidak satu pun unggahan dari halaman ini
 * berhasil.
 *
 * Fungsinya dipertahankan, bukan dibuang: pada borang yang MEMANG membawanya,
 * membacanya di sini menghemat satu perjalanan ke gerbang.
 */
function perkaraIdDariHalaman() {
  const pola = 'input[name="perkara_id"], input#perkara_id, input[name="perkaraId"]';
  const borang = document.querySelector("#frm_putusan");
  const medan = (borang && borang.querySelector(pola)) || document.querySelector(pola);
  return medan && medan.value ? String(medan.value).trim() : "";
}

/**
 * ============================================================================
 * MENYIMPAN BORANG PUTUSAN - DAN MEMBUKTIKANNYA DARI BASIS DATA, BUKAN DOM
 * ============================================================================
 *
 * Sampai 1.123.0 ALETA berhenti sesudah mengisi: "Periksa, lalu tekan Simpan
 * sendiri". Itu pagar yang disengaja, dan pagar itu kini dibuka atas
 * permintaan - dengan satu syarat yang menggantikannya: TERSIMPAN harus
 * DIBUKTIKAN, bukan diakui.
 *
 * Membuktikannya tidak dapat dari DOM. frm_putusan memakai SubmitHandling
 * (lihat edit_putusan_akhir.php baris 704) yang mengirim lewat AJAX lalu
 * menggambar ulang #konten - tombolnya "berhasil ditekan" walau simpanannya
 * ditolak pengesahan di sisi peladen, dan panel akan berkata tersimpan pada
 * putusan yang tidak pernah masuk.
 *
 * Karena itu yang ditanya SIPP sendiri, lewat ALETA: sudahkah perkara ini
 * punya baris putusan, dan berubahkah tanggalnya. Dibaca SEBELUM menekan dan
 * dibaca lagi sesudahnya - selisih itulah buktinya.
 *
 * Sejak 25 September 2026 JAWABAN SIPP atas kiriman borangnya ikut didengar
 * (jembatan.js, dengarJawabanSimpan): st 0 berarti ditolak pengesahan, dan
 * pesan SIPP-nya ditampilkan SEKETIKA - tanpa sepuluh detik jajak yang dulu
 * berakhir dengan pesan umum. st 1 membuat jajak basis data dimulai seketika,
 * tanpa tidur sedetik di awal. Tanpa jawaban, jajak lama tetap berjalan.
 */

/**
 * Tombol Simpan pada borang putusan SIPP.
 *
 * Dua penunjuk, keduanya DI DALAM #frm_putusan. Penunjuk cadangan "#simpan"
 * tanpa lingkup dibuang pada 25 September 2026: id itu dipakai 323 view SIPP,
 * dan pada halaman yang memuat dua borang ia menunjuk Simpan milik borang
 * lain. Tidak ada yang menebak dari tulisan tombolnya - "Simpan" juga nama
 * tombol pada belasan borang lain di halaman yang sama.
 */
const PENUNJUK_SIMPAN_PUTUSAN = [
  "#frm_putusan #simpan",
  "#frm_putusan input[type='submit']",
];

/**
 * ============================================================================
 * BERBICARA DENGAN JEMBATAN
 * ============================================================================
 *
 * jembatan.js berjalan di dunia UTAMA dan dapat menyentuh jQuery, select2,
 * serta CKEditor milik halaman SIPP - yang tidak terlihat dari sini sama
 * sekali. Percakapannya lewat postMessage, satu pertanyaan satu jawaban,
 * dicocokkan dengan nomor urut.
 *
 * Tiap permintaan punya batas waktu. Jembatan yang tidak menjawab - karena
 * halaman berpindah di tengah, atau skripnya belum sempat termuat - tidak
 * boleh membuat pengisian menggantung tanpa akhir: yang menunggu selamanya
 * tampak seperti aplikasi yang membeku, dan yang membacanya akan menekan
 * Kerjakan sekali lagi.
 */
const BATAS_TUNGGU_JEMBATAN = 5000;
/** Paling lama menunggu CKEditor blangko siap sebelum diisi (lihat kirimKeJembatan). */
const BATAS_CKEDITOR_SIAP_MS = 10000;
let nomorPermintaan = 0;

function kirimKeJembatanLangsung(pesan) {
  return new Promise((selesai) => {
    nomorPermintaan += 1;
    const id = `aleta-${Date.now()}-${nomorPermintaan}`;
    let sudah = false;

    const dengar = (peristiwa) => {
      if (peristiwa.source !== window) return;
      const isi = peristiwa.data;
      if (!isi || isi.sumber !== "aleta-jembatan-jawab" || isi.id !== id) return;
      if (sudah) return;
      sudah = true;
      window.removeEventListener("message", dengar);
      clearTimeout(pewaktu);
      selesai(isi);
    };

    const pewaktu = setTimeout(() => {
      if (sudah) return;
      sudah = true;
      window.removeEventListener("message", dengar);
      selesai({ ok: false, alasan: "jembatan_tidak_menjawab" });
    }, BATAS_TUNGGU_JEMBATAN);

    window.addEventListener("message", dengar);
    window.postMessage({ sumber: "aleta-jembatan", id, ...pesan }, "*");
  });
}

/**
 * ============================================================================
 * SATU PINTU KE JEMBATAN - DICATAT, DAPAT DITAHAN, DAPAT DIPULIHKAN
 * ============================================================================
 *
 * Tiap perintah ke halaman SIPP lewat sini. Karena satu pintu, tiga hal dapat
 * dikerjakan sekaligus tanpa menyentuh satu pun dari puluhan pemanggilnya:
 *
 *   MENCATAT. Perintah yang gagal masuk kotak hitam apa adanya - bukan
 *   pesannya yang sudah diterjemahkan untuk petugas.
 *
 *   MENAHAN. Mode kering menahan perintah "tekan" saja. Medan tetap diisi,
 *   sebab yang ingin dilihat justru isiannya; SIPP tidak menyimpan apa pun
 *   sampai tombol Simpan miliknya ditekan, dan tombol itulah yang ditahan.
 *
 *   MENGINGAT JALAN PULANG. Sebelum satu medan diisi, nilai lamanya dibaca
 *   lebih dulu. Satu perjalanan tambahan ke jembatan - sepersekian milidetik -
 *   dan dari situlah "pulihkan" di laci perkakas menjadi mungkin.
 */
async function kirimKeJembatan(pesan) {
  const jenis = String((pesan && pesan.jenis) || "");
  const penunjuk = String((pesan && pesan.penunjuk) || "");

  // Mode latihan (ide sipp-28) - lihat bagian 3d panel-alat.js. Menahan
  // "tekan" DAN "isi"; bacaan (baca, nilai, pilihan) tetap berjalan supaya
  // panel memperlihatkan apa yang akan dikerjakannya. Diperiksa paling awal:
  // saklar ini yang paling ketat, dan catatannya harus lengkap walau mode
  // kering ikut menyala. Selama mati, baris ini tidak berbuat apa-apa.
  if ((jenis === "tekan" || jenis === "isi") && typeof alatLatihanNyala === "function" && alatLatihanNyala()) {
    if (typeof t7JembatanLatihan === "function") return t7JembatanLatihan(pesan, jenis, penunjuk);
    return { ok: false, alasan: "mode_latihan" };
  }

  if (jenis === "tekan" && alatKeringNyala()) {
    alatCatat("kering", `DITAHAN tekan ${penunjuk}`, "mode kering aktif - SIPP tidak menyimpan apa pun");
    alatCatatTindakan({
      jenis: "tekan-ditahan",
      penunjuk,
      label: `tekan ${penunjuk}`,
      nilaiBaru: "(ditahan mode kering)",
      dapatPulih: false,
    });
    return { ok: false, alasan: "mode_kering" };
  }
  // Mode coba (Super Admin sedang mencoba tampilan Baru / UI Baru) menahan
  // tombol Simpan SIPP dengan cara yang sama - lihat alatCobaAktif.
  if (jenis === "tekan" && alatCobaAktif()) {
    alatCatat("coba", `DITAHAN tekan ${penunjuk}`, "mode coba aktif - SIPP tidak menyimpan apa pun");
    alatCatatTindakan({
      jenis: "tekan-ditahan",
      penunjuk,
      label: `tekan ${penunjuk}`,
      nilaiBaru: "(ditahan mode coba)",
      dapatPulih: false,
    });
    return { ok: false, alasan: "mode_coba" };
  }

  // Menekan Simpan borang SIPP dari ALETA: SIPP sendiri yang memuat ulang. Pengawal
  // (muat-ulang-sipp.js) hanya menjaga agar halaman tidak berakhir di dasbor -
  // petugas dikembalikan ke alamat semula SEKALI saja.
  if (jenis === "tekan" && /simpan|submit/i.test(penunjuk) && globalThis.aletaMuatUlangSipp) {
    try {
      await globalThis.aletaMuatUlangSipp.pasangPengawal("");
    } catch {
      /* pengawal hanya kemudahan */
    }
  }

  // Penjaga batas di SATU PINTU (audit jejak 18 Okt 2026): dulu hanya isiBorang yang
  // memeriksa; isian CKEditor (pertimbangan/amar), alamat, email/HP lewat pintu ini
  // tanpa pemeriksaan. Teks yang memuat kata ALETA (selain data SIPP yang tampil di
  // halaman, mis. nama pihak) tidak diisikan ke kolom SIPP.
  if (jenis === "isi" && typeof AletaPenjagaTanda !== "undefined" && typeof pesan.nilai === "string") {
    const tahan = AletaPenjagaTanda.periksaTeks(pesan.nilai, String(pesan.label || penunjuk || "isian"));
    if (!tahan.ok) {
      alatCatat("jembatan", `DITAHAN isi ${penunjuk}`, tahan.pesan);
      return { ok: false, alasan: tahan.pesan };
    }
  }

  // lamaTerbaca dibedakan dari nilaiLama yang kosong, dan bedanya menentukan.
  //
  // Medan yang memang kosong sebelumnya PUNYA jalan pulang: dikosongkan lagi.
  // Medan yang nilai lamanya GAGAL DIBACA tidak punya - dan menawarkan
  // "Pulihkan" untuknya justru akan MENGOSONGKAN medan yang tadinya berisi,
  // dengan meyakinkan, atas nama mengembalikan keadaan. Karena itu yang
  // gagal dibaca tidak pernah ditawari tombol itu.
  let nilaiLama = "";
  let lamaTerbaca = false;
  if (jenis === "isi") {
    try {
      const bacaSekali = () =>
        kirimKeJembatanLangsung({
          jenis: "nilai",
          penunjuk,
          jenisMedan: pesan.jenisMedan,
        });
      let baca = await bacaSekali();
      // CKEditor blangko yang baru dibuka belum siap (jembatan: siap=false):
      // ditunggu menurut KEADAANNYA, diperiksa tiap 50 ms, paling lama
      // BATAS_CKEDITOR_SIAP_MS - bukan jeda tetap. Bacaan yang sama juga
      // memberi nilai lama untuk jalan pulang, jadi editor yang sudah siap
      // tidak menambah satu pun perjalanan.
      if (baca && baca.ok && baca.siap === false) {
        const mulai = Date.now();
        const batasSiap = typeof BATAS_CKEDITOR_SIAP_MS === "number" ? BATAS_CKEDITOR_SIAP_MS : 10000;
        while (baca && baca.ok && baca.siap === false && Date.now() - mulai < batasSiap) {
          await new Promise((selesai) => setTimeout(selesai, 50));
          baca = await bacaSekali();
        }
        if (baca && baca.ok && baca.siap === false) {
          alatCatat("jembatan", `isi ${penunjuk} ditunda`, "CKEditor belum siap");
          return {
            ok: false,
            alasan: `ckeditor_belum_siap - editor ${penunjuk} belum selesai dibangun SIPP dalam ${Math.round(batasSiap / 1000)} detik`,
          };
        }
      }
      if (baca && baca.ok && baca.tampak !== false) {
        nilaiLama = String(baca.nilai === undefined || baca.nilai === null ? "" : baca.nilai);
        lamaTerbaca = true;
      }
    } catch {
      /* nilai lama tidak terbaca - medannya tetap diisi, hanya tanpa jalan pulang */
    }
  }

  // 17 Okt 2026 - keputusan pengguna: "isi form itu otomatis langsung isi,
  // jangan seperti manusia". Isian medan DAN tekanan tombol di layar SIPP
  // langsung dikerjakan, tanpa jeda tiruan manusia (sebelumnya tekanan didahului
  // jeda tiruan manusia "simpan" 0,9-2,2 detik, juga untuk tombol buka-tab/popup).
  // Yang tetap meniru petugas hanyalah tulisan ke database SIPP oleh bot dan
  // jarak antar baris simpanan beruntun (lihat ccInputKeSipp).

  const jawab = await kirimKeJembatanLangsung(pesan);

  if (jenis === "isi") {
    alatCatatTindakan({
      jenis: "isi",
      penunjuk,
      jenisMedan: String(pesan.jenisMedan || "teks"),
      label: penunjuk,
      nilaiLama,
      nilaiBaru: String(pesan.nilai === undefined || pesan.nilai === null ? "" : pesan.nilai),
      dapatPulih: Boolean(jawab && jawab.ok) && lamaTerbaca,
    });
  } else if (jenis === "tekan") {
    alatCatatTindakan({
      jenis: "tekan",
      penunjuk,
      label: `tekan ${penunjuk}`,
      nilaiBaru: "(ditekan)",
      dapatPulih: false,
    });
  }

  if (!jawab || !jawab.ok) {
    alatCatat("jembatan", `${jenis} ${penunjuk} gagal`, (jawab && jawab.alasan) || "tanpa alasan");
  }
  return jawab;
}

/**
 * Pemulih memakai jalur LANGSUNG, dan itu disengaja dua kali.
 *
 * Pertama, memulihkan tidak boleh ikut tercatat sebagai tindakan baru -
 * riwayat yang mencatat pemulihannya sendiri akan tumbuh tanpa henti.
 * Kedua, memulihkan tidak boleh ditahan mode kering: mengembalikan keadaan
 * selalu boleh, justru ketika mode kering sedang menyala.
 */
alatDaftarkanPemulih(async (baris) => {
  const jawab = await kirimKeJembatanLangsung({
    jenis: "isi",
    penunjuk: baris.penunjuk,
    jenisMedan: baris.jenisMedan || "teks",
    nilai: baris.nilaiLama,
  });
  return { ok: Boolean(jawab && jawab.ok), alasan: (jawab && jawab.alasan) || "" };
});

/**
 * Penunjuk yang MENENTUKAN di halaman SIPP.
 *
 * Yang wajib hanya kerangka halamannya - kalau ketiganya hilang, yang terbuka
 * bukan SIPP. Sisanya milik halaman tertentu saja: menandainya wajib hanya
 * akan membuat laporan penuh peringatan palsu di halaman yang memang tidak
 * memilikinya, dan peringatan palsu adalah cara tercepat membuat orang
 * berhenti membaca laporan.
 */
alatDaftarkanPenunjuk("Kerangka SIPP", ["#konten", ".wrapper"], { wajib: true });
alatDaftarkanPenunjuk("Bilah atas", ["#atas"], { wajib: true });
alatDaftarkanPenunjuk("Menu utama", ["#cssmenu"], { wajib: true });
alatDaftarkanPenunjuk("Tab perkara", ["#usual2", ".usual"], { wajib: false, saat: "halaman detail perkara" });
alatDaftarkanPenunjuk("Tabel detail", [".cssTable", "#tableDetilPerkara"], { wajib: false, saat: "halaman detail perkara" });
alatDaftarkanPenunjuk("Simpan putusan", PENUNJUK_SIMPAN_PUTUSAN, { wajib: false, saat: "blangko putusan" });

/**
 * Mengisi satu formulir, kolom demi kolom.
 *
 * Berhenti pada kegagalan PERTAMA. Meneruskan sesudah satu kolom gagal
 * menghasilkan formulir yang terisi sebagian tanpa ada yang tahu bagian mana
 * yang kosong - dan yang menekan Simpan kemudian menyimpan campuran antara
 * yang diisi ALETA dan yang tertinggal dari isian sebelumnya.
 */
async function isiBorang(medanBorang, nilaiKolom) {
  const hasil = [];

  for (const kolom of medanBorang) {
    const nilai = nilaiKolom[kolom.medan];
    if (nilai === undefined || nilai === null || nilai === "") {
      if (kolom.wajib) {
        return { ok: false, alasan: `nilai untuk ${kolom.medan} belum ada`, hasil };
      }
      continue;
    }

    // 17 Okt 2026 (penjaga batas): tidak ada kata ALETA yang diisikan ke kolom SIPP.
    // Nama pihak "Aleta" yang tampil di halaman SIPP itu sendiri tidak dihitung.
    const tahanTanda = typeof AletaPenjagaTanda !== "undefined" ? AletaPenjagaTanda.periksaTeks(nilai, kolom.medan) : { ok: true };
    if (!tahanTanda.ok) return { ok: false, alasan: tahanTanda.pesan, hasil };

    const jawab = await kirimKeJembatan({
      jenis: "isi",
      penunjuk: kolom.penunjuk,
      jenisMedan: kolom.jenis,
      nilai,
    });

    hasil.push({ medan: kolom.medan, nilai, ...jawab });
    if (!jawab.ok) {
      return { ok: false, alasan: `${kolom.medan}: ${jawab.alasan || "gagal diisi"}`, hasil };
    }
  }

  return { ok: true, alasan: "", hasil };
}

/*
 * ============================================================================
 * COURT CALENDAR OTOMATIS - BUTIR 29 (panitera sidang, PP, Admin, Super Admin)
 * ============================================================================
 *
 * Bagian "Court Calendar otomatis" di kelompok Perkara: menyusun rencana
 * persidangan perkara ini (perkara_court_calendar), dapat disunting baris per
 * baris, lalu DIINPUT SEKALIGUS ke SIPP lewat blangko "Tambah Court Calender"
 * SIPP sendiri. Tampil hanya di tampilan Baru/UI Baru (Lama tetap identik),
 * untuk golongan panitera dan admin, dan hanya bila boleh("data-umum") - hak
 * yang sama dengan putusan otomatis, satu-satunya pengisian blangko SIPP lain
 * yang dikerjakan PP.
 *
 * ============================================================================
 * POLANYA DIUKUR, BUKAN DIKARANG - sipp_donggala, perkara didaftar >= 2022
 * ============================================================================
 *
 * Skrip ukur: D:/aleta-dev/kerja/court-calendar/ (ekstrak.sql, ukur.js,
 * ukur2.js, ukur3.sql). 6.854 baris Court Calendar, 8.562 sidang.
 *
 *   Siapa mengisi berapa baris (median):
 *     cerai gugat       1.826 dari 2.240 perkara berkalender, median 2 baris
 *                       (1.265 perkara tepat 2 baris)
 *     cerai talak         433 dari 497, median 3
 *     itsbat (Pdt.P)      576 dari 798, median 1 (517 tepat 1 baris)
 *     dispensasi kawin     63 dari 77,  median 1
 *     permohonan lain     110 dari 136, median 2
 *     ekonomi syariah       0 dari 2   - tanpa data; aturannya dari PERMA
 *   Baris diinput SEBELUM tanggal rencananya 2.510, pada harinya 3.637,
 *   sesudahnya 707 - Court Calendar di satker ini sebagian besar disusun saat
 *   sidang pertama, dan sebagian ditulis menyusul (keterangan "putus verstek").
 *
 *   Rencana yang disusun di depan (>= 2 baris dalam satu sesi input):
 *     cerai gugat, putus verstek (n=385): Sidang Pertama -> Pemeriksaan Pokok
 *       Perkara 124 kali, jarak median 14 hari (q25 7, q75 14)
 *     cerai gugat, hadir (n=88): sidang pertama -> mediasi (med 11 hari);
 *       rantai e-Litigasi jawaban -> replik -> duplik -> pembuktian, jarak
 *       median 5 / 3 / 6 hari, jam 15:00, keterangan "Elitigasi"
 *     cerai talak hadir (n=26): jawaban -> replik 4, replik -> duplik 5,5,
 *       duplik -> pembuktian 6,5 hari
 *
 *   Jarak sidang yang SUNGGUH terjadi (perkara_jadwal_sidang, median hari):
 *     pendaftaran -> sidang 1   cerai gugat 13 (n=2.236), cerai talak 13
 *                               (497), itsbat Pdt.P 21 (798), dispensasi 10
 *                               (77), permohonan lain 12 (136), itsbat Pdt.G 17
 *     sidang 1 -> pokok perkara 14 (n=426)     sidang 1 -> laporan mediasi 14
 *     laporan mediasi -> jawaban 3 (30/26)     jawaban -> replik 4 (47/46)
 *     replik -> duplik 3 (48/45)               duplik -> pembuktian 5 (48/43)
 *     pembuktian -> pembuktian 7 (60/56)       pembuktian -> kesimpulan 2
 *     kesimpulan -> putusan 6 (36/41)          permohonan: tiap langkah 7
 *     putusan cerai talak -> sidang ikrar: 35 hari terbanyak (60 dari 248),
 *       lalu 28 (45)
 *   Jumlah sidang: cerai gugat verstek median 2 (n=1.740) - pemeriksaan pokok,
 *   pembuktian, dan putusan verstek pada sidang kedua; itsbat Pdt.P median 1.
 *
 *   Jam: 6.438 dari 8.541 baris 09:00; jawaban/replik/duplik/kesimpulan 15:00
 *   (aturan yang sama dengan jamSidangBerikut di portal, @/lib/bawaan-tunda).
 *   Keterangan: 5.024 dari 8.541 kosong; "Elitigasi" pada rantai jawab-menjawab
 *   perkara e-Court. Hari: Selasa 976, Senin 685, Rabu 426, Kamis 400, Jumat
 *   208 (rencana 2025+) - jarak 7/14 hari mempertahankan hari sidang majelis.
 *
 * ============================================================================
 * SATU MESIN DENGAN TUNDA SIDANG, BUKAN DUA
 * ============================================================================
 *
 * Portal sudah punya aturan tanggal/jam sidang berikutnya (1.180.0,
 * @/lib/bawaan-tunda): tundaan mediasi 21 hari, jam sore untuk jawab-menjawab
 * dan kesimpulan. Rencana di sini MEMAKAI angka yang sama (CC_HARI.laporanMediasi
 * = HARI_TUNDA_MEDIASI, CC_TAHAP_SORE = TAHAP_SORE) - dijaga uji
 * ekstensi-court-calendar-otomatis.test.ts yang membaca keduanya. Data
 * menyebut 14 hari untuk sidang 1 -> laporan mediasi; aturan pengguna 21 hari
 * yang dipakai supaya borang tunda dan Court Calendar tidak berselisih.
 * Sebaliknya borang tunda MEMBACA Court Calendar (kedua pihak hadir ->
 * tanggal rencana berikutnya) - kalender yang terisi di sini menajamkannya.
 *
 * ============================================================================
 * MENULIS LEWAT JALAN SIPP SENDIRI
 * ============================================================================
 *
 * Blangko SIPP (court_calendar/court_calendar_v.php) dikirim SubmitHandling:
 * $.ajax POST serializeArray ke manage_court_calendar/validateInput, dijawab
 * {st, msg}. Panel mengirim POST yang SAMA - medan yang sama (tgl_sidang
 * dd/mm/yyyy, jamSidang, agenda_sidang, keterangan, nomor_perkara, enc) yang
 * dibaca dari blangko Tambah Court Calender perkara ini - dengan sesi SIPP
 * petugas yang sedang masuk. Pengesahan SIPP tetap berlaku (Sabtu/Minggu
 * ditolak, tanggal sebelum pendaftaran ditolak), diinput_oleh = akun SIPP
 * petugas, dan tidak ada tanda ALETA di baris mana pun. Dipilih daripada
 * menekan tombol tingkap berulang kali: tiap Simpan memunculkan tingkap pesan
 * dan memuat ulang #konten, sehingga N baris = N kali menutup dua tingkap -
 * rapuh, dan hasilnya sama persis.
 *
 *   Sebelum menulis   daftar Court Calendar SIPP dibaca segar; baris yang sama
 *                     persis (tanggal, jam, agenda) tidak dikirim lagi.
 *   Saat menulis      mode latihan dan mode coba menahan POST di kait fetch
 *                     (423); mode kering menahannya di sini; tiap simpanan
 *                     didahului alatJedaManusia("simpan").
 *   Sesudah menulis   daftar dibaca ULANG dan tiap baris dicari di sana -
 *                     "tersimpan" hanya disebut bila memang terbaca kembali.
 */

/**
 * Hari libur nasional & cuti bersama SKB 2024-2027 - SALINAN @/lib/hari-libur
 * (manajemen_surat; uji court-calendar-sidang menuntut sama persis). Tambahan
 * dari Pengaturan (libur daerah, cuti bersama tambahan) dibaca dari
 * /api/hari-libur saat panel dimuat dan diterapkan ccTerapkanLiburTambahan.
 */
const CC_LIBUR = {
  "2024-01-01": "Tahun Baru Masehi",
  "2024-02-08": "Isra Mikraj",
  "2024-02-09": "cuti bersama Tahun Baru Imlek",
  "2024-02-10": "Tahun Baru Imlek",
  "2024-03-11": "Hari Suci Nyepi",
  "2024-03-12": "cuti bersama Nyepi",
  "2024-03-29": "Wafat Isa Almasih",
  "2024-03-31": "Paskah",
  "2024-04-08": "cuti bersama Idul Fitri",
  "2024-04-09": "cuti bersama Idul Fitri",
  "2024-04-10": "Idul Fitri",
  "2024-04-11": "Idul Fitri",
  "2024-04-12": "cuti bersama Idul Fitri",
  "2024-04-15": "cuti bersama Idul Fitri",
  "2024-05-01": "Hari Buruh",
  "2024-05-09": "Kenaikan Isa Almasih",
  "2024-05-10": "cuti bersama Kenaikan Isa Almasih",
  "2024-05-23": "Waisak",
  "2024-05-24": "cuti bersama Waisak",
  "2024-06-01": "Hari Lahir Pancasila",
  "2024-06-17": "Idul Adha",
  "2024-06-18": "cuti bersama Idul Adha",
  "2024-07-07": "Tahun Baru Islam",
  "2024-08-17": "Hari Kemerdekaan",
  "2024-09-16": "Maulid Nabi",
  "2024-12-25": "Natal",
  "2024-12-26": "cuti bersama Natal",
  "2025-01-01": "Tahun Baru Masehi",
  "2025-01-27": "Isra Mikraj",
  "2025-01-28": "cuti bersama Tahun Baru Imlek",
  "2025-01-29": "Tahun Baru Imlek",
  "2025-03-28": "cuti bersama Nyepi",
  "2025-03-29": "Hari Suci Nyepi",
  "2025-03-31": "Idul Fitri",
  "2025-04-01": "Idul Fitri",
  "2025-04-02": "cuti bersama Idul Fitri",
  "2025-04-03": "cuti bersama Idul Fitri",
  "2025-04-04": "cuti bersama Idul Fitri",
  "2025-04-07": "cuti bersama Idul Fitri",
  "2025-04-18": "Wafat Isa Almasih",
  "2025-04-20": "Paskah",
  "2025-05-01": "Hari Buruh",
  "2025-05-12": "Waisak",
  "2025-05-13": "cuti bersama Waisak",
  "2025-05-29": "Kenaikan Isa Almasih",
  "2025-05-30": "cuti bersama Kenaikan Isa Almasih",
  "2025-06-01": "Hari Lahir Pancasila",
  "2025-06-06": "Idul Adha",
  "2025-06-09": "cuti bersama Idul Adha",
  "2025-06-27": "Tahun Baru Islam",
  "2025-08-17": "Hari Kemerdekaan",
  "2025-08-18": "cuti bersama HUT Kemerdekaan",
  "2025-09-05": "Maulid Nabi",
  "2025-12-25": "Natal",
  "2025-12-26": "cuti bersama Natal",
  "2026-01-01": "Tahun Baru Masehi",
  "2026-01-16": "Isra Mikraj",
  "2026-02-16": "cuti bersama Tahun Baru Imlek",
  "2026-02-17": "Tahun Baru Imlek",
  "2026-03-18": "cuti bersama Nyepi",
  "2026-03-19": "Hari Suci Nyepi",
  "2026-03-20": "cuti bersama Idul Fitri",
  "2026-03-21": "Idul Fitri",
  "2026-03-22": "Idul Fitri",
  "2026-03-23": "cuti bersama Idul Fitri",
  "2026-03-24": "cuti bersama Idul Fitri",
  "2026-04-03": "Wafat Isa Almasih",
  "2026-04-05": "Paskah",
  "2026-05-01": "Hari Buruh",
  "2026-05-14": "Kenaikan Isa Almasih",
  "2026-05-15": "cuti bersama Kenaikan Isa Almasih",
  "2026-05-27": "Idul Adha",
  "2026-05-28": "cuti bersama Idul Adha",
  "2026-05-31": "Waisak",
  "2026-06-01": "Hari Lahir Pancasila",
  "2026-06-16": "Tahun Baru Islam",
  "2026-08-17": "Hari Kemerdekaan",
  "2026-08-25": "Maulid Nabi",
  "2026-12-24": "cuti bersama Natal",
  "2026-12-25": "Natal",
  "2027-01-01": "Tahun Baru Masehi",
  "2027-01-05": "Isra Mikraj",
  "2027-02-05": "cuti bersama Tahun Baru Imlek",
  "2027-02-06": "Tahun Baru Imlek",
  "2027-03-08": "Hari Suci Nyepi",
  "2027-03-09": "cuti bersama Idul Fitri",
  "2027-03-10": "Idul Fitri",
  "2027-03-11": "Idul Fitri",
  "2027-03-12": "cuti bersama Idul Fitri",
  "2027-03-15": "cuti bersama Idul Fitri",
  "2027-03-25": "cuti bersama Wafat Isa Almasih",
  "2027-03-26": "Wafat Isa Almasih",
  "2027-03-28": "Paskah",
  "2027-05-01": "Hari Buruh",
  "2027-05-06": "Kenaikan Isa Almasih",
  "2027-05-17": "Idul Adha",
  "2027-05-18": "cuti bersama Idul Adha",
  "2027-05-19": "cuti bersama Waisak",
  "2027-05-20": "Waisak",
  "2027-06-01": "Hari Lahir Pancasila",
  "2027-06-06": "Tahun Baru Islam",
  "2027-08-15": "Maulid Nabi",
  "2027-08-17": "Hari Kemerdekaan",
  "2027-12-24": "cuti bersama Natal",
  "2027-12-25": "Natal",
  "2027-12-26": "Isra Mikraj",
};

function ccIsoSah(iso) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""));
}

function ccHariKe(iso) {
  if (!ccIsoSah(iso)) return -1;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Sebab tanggal ini bukan hari sidang ("" = hari kerja). */
function ccBukanHariKerja(iso) {
  const h = ccHariKe(iso);
  if (h === 0 || h === 6) return h === 0 ? "hari Minggu" : "hari Sabtu";
  return CC_LIBUR[iso] ? `libur: ${CC_LIBUR[iso]}` : "";
}

/**
 * Libur tambahan dari Pengaturan portal (libur daerah, cuti bersama tambahan,
 * tanggal SKB yang dibatalkan) - diterapkan ke CC_LIBUR yang sama, sehingga
 * seluruh pemeriksaan libur di panel ikut. Gagal dibaca = tetap daftar SKB.
 */
const ALETA_API_HARI_LIBUR = "/aleta/api/hari-libur";
let ccLiburTambahanDimuat = null;

function ccTerapkanLiburTambahan(tambahan) {
  for (const t of Array.isArray(tambahan) ? tambahan : []) {
    const tanggal = String((t && t.tanggal) || "");
    if (!ccIsoSah(tanggal)) continue;
    if (t.aksi === "hapus") delete CC_LIBUR[tanggal];
    else if (String(t.nama || "").trim()) CC_LIBUR[tanggal] = String(t.nama).trim();
  }
}

function ccMuatLiburTambahan() {
  if (ccLiburTambahanDimuat) return ccLiburTambahanDimuat;
  ccLiburTambahanDimuat = (async () => {
    try {
      if (typeof alatAmbil !== "function") return false;
      const respons = await alatAmbil(ALETA_API_HARI_LIBUR, { credentials: "include", cache: "no-store" }, "Membaca daftar hari libur");
      if (!respons || !respons.ok) return false;
      const luar = await respons.json();
      const isi = (luar && luar.data) || luar || {};
      ccTerapkanLiburTambahan(isi.tambahan);
      return true;
    } catch {
      return false;
    }
  })();
  return ccLiburTambahanDimuat;
}

/**
 * Menyusun kepala panel: seberapa segar datanya, dan keadaan perkara sekilas.
 *
 * ============================================================================
 * KAPAN DATA INI DIAMBIL
 * ============================================================================
 *
 * Ini bukan kenyamanan, melainkan penjagaan. Panel menampilkan keadaan perkara
 * menurut ALETA, dan ALETA hanya setahu penarikan terakhirnya. Bila penarikan
 * terakhir tiga hari lalu, "0 dokumen" berarti "belum ada tiga hari lalu" -
 * bukan "pihak belum mengunggah". Hakim yang tidak tahu bedanya dapat mengambil
 * keputusan atas dasar yang keliru.
 *
 * Karena itu umur data selalu ditampilkan, dan berubah mencolok setelah sehari.
 */

// ─── Panel dapat digeser, dan posisinya diingat ──────────────────────────────
//
// Panel melayang di sisi kanan dan menutupi kolom kanan tabel SIPP - pada
// halaman Daftar Perkara, kolom Status Perkara dan tombol [detil] tertutup
// seluruhnya. Petugas yang perlu kolom itu terpaksa menutup panel, dan panel
// yang selalu ditutup sama saja dengan panel yang tidak ada.
//
// Posisinya disimpan di penyimpanan ekstensi, bukan per halaman: petugas
// memindahkannya sekali, lalu tetap di sana.

const KUNCI_POSISI = "posisiPanel";

// Ukuran ikut disimpan bersama posisinya.
//
// Lebar 340 piksel cukup untuk sebagian besar layar, tetapi tidak untuk semua:
// pada layar sempit ia menutupi kolom SIPP, dan pada layar lebar ia memaksa
// menggulir untuk membaca daftar yang sebenarnya muat. Keduanya berakhir sama -
// panel yang ditutup, lalu tidak dipakai lagi.
//
// Disimpan di penyimpanan ekstensi, bukan per halaman: petugas mengaturnya
// sekali, lalu tetap begitu di seluruh SIPP.

let keadaanPanel = null;

async function muatPosisi() {
  try {
    const simpan = await chrome.storage.local.get([KUNCI_POSISI]);
    const posisi = simpan[KUNCI_POSISI];
    if (!posisi || typeof posisi !== "object") return null;
    return posisi;
  } catch {
    return null;
  }
}

/**
 * Menyimpan sebagian keadaan tanpa menghapus sisanya.
 *
 * Menggeser panel TIDAK BOLEH melupakan ukurannya, dan sebaliknya. Menulis
 * seluruh objek dari satu peristiwa saja adalah cara paling mudah kehilangan
 * yang satunya - dan hilangnya baru terasa sesudah petugas mengatur ulang
 * untuk kedua kalinya.
 */
function simpanKeadaanPanel(sebagian) {
  keadaanPanel = { ...(keadaanPanel || {}), ...sebagian };
  try {
    void chrome.storage.local.set({ [KUNCI_POSISI]: keadaanPanel });
  } catch {
    /* penyimpanan tidak tersedia: panel tetap dapat diatur, hanya tidak diingat */
  }
}

/** Mengembalikan panel ke ukuran dan tempat bawaannya. */
// ============================================================================
// TEMA TERANG/GELAP - PANEL DAN HALAMAN SIPP
// ============================================================================
//
// Dua hal yang sengaja dipisah, karena wewenangnya berbeda:
//
//   PANEL  milik ALETA sepenuhnya. Warnanya peubah CSS, jadi temanya utuh dan
//          dapat dijamin - kontras dijaga pada kedua sisi.
//   SIPP   BUKAN milik kita. Ia aplikasi pihak lain yang tata letaknya tidak
//          kita kendalikan dan dapat berubah kapan saja tanpa pemberitahuan.
//
// Karena itu tema SIPP dikerjakan sebagai LAPISAN TIPIS dan dapat dimatikan
// sendiri: hanya latar, tulisan, dan garis tabel yang disentuh, dan tidak satu
// pun ukuran atau tata letaknya. Menyapu seluruh gaya SIPP - misalnya dengan
// filter invert pada html - memang cepat, tetapi ia membalik warna FOTO dan
// tanda tangan pindaian juga, dan dokumen pengadilan yang warnanya terbalik
// adalah harga yang terlalu mahal untuk sebuah kenyamanan mata.
//
// Bawaannya MATI untuk SIPP. Mengubah tampilan aplikasi orang lain tanpa
// diminta adalah hal terakhir yang boleh dilakukan lapisan bantu.


let temaSekarang = "gelap";
let temaSippMenyala = false;

/**
 * ============================================================================
 * TEMA TERANG MENGEMBALIKAN SIPP APA ADANYA
 * ============================================================================
 *
 * Sebelumnya lapisan tema dipasang pada SIPP untuk KEDUA tema - gelap maupun
 * terang - hanya dengan warna yang berbeda. Akibatnya tema terang pun tetap
 * mengubah SIPP: latarnya diputihkan, garis tabelnya diganti, dan hasilnya
 * bukan SIPP yang asli melainkan SIPP versi ALETA yang kebetulan terang.
 *
 * Itu keliru pada asasnya. SIPP bukan milik kita. Lapisan tema hanya masuk akal
 * sebagai KERINGANAN untuk mata - dan keringanan itu hanya dibutuhkan pada tema
 * gelap, ketika halaman putih menyilaukan di sebelah panel yang gelap.
 *
 * Karena itu aturannya kini sesederhana ini:
 *
 *   panel gelap   + saklar menyala  -> SIPP diberi lapisan gelap
 *   panel terang                    -> lapisannya DILEPAS, SIPP kembali asli
 *
 * Berpindah ke tema terang dengan begitu selalu mengembalikan SIPP ke keadaan
 * semula, tanpa perlu mengingat saklar mana yang pernah ditekan.
 */
/**
 * ============================================================================
 * SALINAN TEMA DIURUS tema-pusat.js
 * ============================================================================
 *
 * Dulu berkas ini menulis salinan aleta-tema-sipp sendiri dengan tiga nilai
 * (terang / gelap / mati), sementara panel ABT menulis kunci yang sama dengan
 * dua nilai. SIPP dan ABT satu origin, sehingga tiap pindah di antara
 * keduanya salinannya saling menimpa dan halaman berkedip gelap-terang.
 *
 * Sekarang pilihan (terang | gelap | sistem), lapisan gelap SIPP, salinan
 * sinkronnya, dan penanda <html> semuanya ditulis SATU penulis - pusat tema.
 * Yang tersisa di sini hanya mengikuti hasilnya: temaSekarang adalah tema
 * yang SUDAH DIURAIKAN (sistem sudah menjadi terang atau gelap), temaSippMenyala
 * adalah saklar lapisan.
 */
function keadaanTemaPusat() {
  const pusat = globalThis.AletaTemaPusat;
  if (pusat) return pusat.keadaan();
  return { pilihan: "gelap", resolusi: "gelap", waktu: 0, lapisan: true };
}


/** Penanda gaya yang disisipkan ke dalam bingkai CKEditor. */
const GAYA_CKEDITOR = "aleta-tema-ckeditor";

/**
 * ==========================================================================
 * BIDANG KETIKNYA IFRAME, DAN BERKAS GAYA BERHENTI DI TEPINYA
 * ==========================================================================
 *
 * Layar Putusan Akhir memuat tiga CKEditor. Bilah alatnya bagian dari
 * halaman dan sudah diwarnai panel.css, tetapi bidang ketiknya dokumen
 * TERSENDIRI di dalam iframe, dengan contents.css milik SIPP yang memaksa
 * latar putih.
 *
 * Karena keduanya satu origin, contentDocument-nya dapat dicapai - dan
 * itulah satu-satunya jalan. Tanpa ini, tiga bidang putih seluas layar
 * tetap berdiri di atas halaman gelap, dan justru bidang itulah yang paling
 * lama dipandang saat menulis putusan.
 *
 * ==========================================================================
 * GAYANYA DISISIPKAN KE <head>, TIDAK PERNAH KE <body>
 * ==========================================================================
 *
 * getData() milik CKEditor membaca body.innerHTML - itulah yang tersimpan
 * sebagai amar dan pertimbangan di SIPP. Satu elemen <style> di dalam body
 * akan ikut tersimpan ke dalam putusan, lalu ikut tercetak.
 *
 * Di dalam <head> ia tidak pernah terbaca getData(), sehingga naskah yang
 * tersimpan sama persis dengan tanpa ekstensi ini.
 */
function warnaiSatuBingkai(bingkai, gelap) {
  let dok = null;
  try {
    dok = bingkai.contentDocument;
  } catch {
    // Bingkai yang belum siap atau berbeda origin - dilewati diam-diam;
    // yang hilang hanya warnanya.
    return;
  }
  if (!dok || !dok.head) return;

  const lama = dok.getElementById(GAYA_CKEDITOR);
  if (!gelap) {
    // Mencabutnya mengembalikan bidang ketik persis seperti semula - sifat
    // yang sama dengan penanda tema di halaman induknya.
    if (lama) lama.remove();
    return;
  }
  if (lama) return;

  const gaya = dok.createElement("style");
  gaya.id = GAYA_CKEDITOR;
  gaya.textContent = [
    "html, body { background: #141d19 !important; color: #dfe8e2 !important; }",
    "body { caret-color: #7fd0a6; }",
    "a { color: #7fd0a6 !important; }",
    "table, td, th { border-color: #27342e !important; }",
    "hr { border-color: #27342e !important; }",
    "::selection { background: #22432f; color: #ffffff; }",
    // Naskah yang ditempel dari Word membawa warnanya sendiri, dan warna
    // itu hampir selalu hitam - hitam di atas gelap berarti hilang sama
    // sekali. Yang dibatalkan HANYA yang mendekati hitam; warna yang
    // sengaja dipilih penulis, seperti merah pada catatan, dibiarkan.
    '[style*="color:#000"], [style*="color: #000"], [style*="color:black"],' +
      ' [style*="color: black"], [style*="color:rgb(0,0,0)"], [style*="color: rgb(0, 0, 0)"],' +
      ' font[color="#000000"], font[color="black"] { color: inherit !important; }',
    // Begitu pula latar putih yang ikut tertempel.
    '[style*="background-color:#fff"], [style*="background-color: #fff"],' +
      ' [style*="background:#fff"], [style*="background: #fff"],' +
      ' [style*="background-color:white"], [style*="background-color: white"]' +
      " { background-color: transparent !important; }",
  ].join("\n");
  dok.head.appendChild(gaya);
}

/**
 * Mewarnai seluruh bingkai CKEditor yang ada di halaman.
 *
 * Dipanggil tiap kali tema diterapkan dan tiap kali halaman berubah -
 * CKEditor baru selesai membangun bingkainya beberapa saat SESUDAH tingkap
 * Putusan Akhir muncul, jadi sekali panggil pada saat tingkapnya dibuka
 * tidak pernah cukup.
 *
 * Pendengar load dipasang sekali per bingkai: CKEditor menulis ulang isi
 * bingkainya saat berpindah antara Sumber dan WYSIWYG, dan tulisan ulang
 * itu membuang gaya yang sudah disisipkan.
 */
function warnaiCkeditor() {
  const gelap =
    document.documentElement.getAttribute("data-aleta-tema-sipp") === "gelap";
  const bingkai = document.querySelectorAll(
    "iframe.cke_wysiwyg_frame, iframe.cke_panel_frame"
  );
  for (const satu of bingkai) {
    warnaiSatuBingkai(satu, gelap);
    if (satu.dataset.aletaTema !== "1") {
      satu.dataset.aletaTema = "1";
      satu.addEventListener("load", () => {
        warnaiSatuBingkai(
          satu,
          document.documentElement.getAttribute("data-aleta-tema-sipp") === "gelap"
        );
      });
    }
  }
}

function terapkanTemaSipp() {
  // ==========================================================================
  // SATU PENANDA, BUKAN SATU LEMBAR GAYA YANG DISUNTIKKAN
  // ==========================================================================
  //
  // Dulu seluruh gaya gelapnya ditulis di dalam berkas ini sebagai teks, lalu
  // disuntikkan sebagai <style>. Cara itu punya tiga kelemahan yang semuanya
  // terasa begitu temanya harus benar-benar lengkap:
  //
  //   1. Gaya di dalam JavaScript tidak diperiksa siapa pun - salah tanda
  //      kurung baru ketahuan ketika halamannya sudah telanjur aneh.
  //   2. Kekhususan pemilihnya rendah, sehingga tiap aturan menuntut
  //      !important walau tidak ada yang menyainginya.
  //   3. Ia dibangun ulang tiap kali temanya diganti.
  //
  // Sekarang gayanya tinggal di panel.css - berkas gaya yang memang sudah
  // dipasang di tiap halaman SIPP - di bawah pemilih html[data-aleta-tema-sipp].
  // Fungsi ini hanya memasang dan mencabut penandanya.
  //
  // Sifat terpentingnya tetap: mencabut penanda itu mengembalikan SIPP persis
  // seperti semula, sebab tidak ada satu pun gaya yang menempel di elemennya.
  //
  // Penanda yang sama dipakai lencana baris untuk memilih warnanya, sehingga
  // keduanya mustahil berselisih.
  //
  // Penandanya SAMA dengan yang dipasang pusat pada document_start (aturan
  // yang sama: gelap DAN lapisan menyala); dipasang di sini juga hanya bila
  // berbeda, supaya tidak ada penulisan atribut yang sia-sia.
  const akar = document.documentElement;
  if (!temaSippMenyala || temaSekarang !== "gelap") {
    if (akar.hasAttribute("data-aleta-tema-sipp")) akar.removeAttribute("data-aleta-tema-sipp");
    warnaiCkeditor();
    return;
  }
  if (akar.getAttribute("data-aleta-tema-sipp") !== "gelap") akar.setAttribute("data-aleta-tema-sipp", "gelap");
  warnaiCkeditor();
}

async function muatTema() {
  // Sinkron dari pusat: tidak menunggu chrome.storage, jadi panel yang digambar
  // ulang (SIPP memicunya terus-menerus) tidak pernah membaca nilai usang
  // yang sedang dalam perjalanan ditulis.
  const kini = keadaanTemaPusat();
  temaSekarang = kini.resolusi === "terang" ? "terang" : "gelap";
  // Gelap adalah bawaan, termasuk untuk halaman SIPP; yang pernah mematikan
  // lapisannya tetap mendapati SIPP-nya asli (saklar disimpan pusat).
  temaSippMenyala = kini.lapisan !== false;
}

/**
 * Tombol tema di kepala panel.
 *
 * Satu tekanan mengganti pilihan tema: terang -> gelap -> ikuti sistem ->
 * terang. Pilihan DIMINTA dari pusat tema (tema-pusat.js), yang memasang
 * penanda halaman seketika dan menyimpannya; panel mengikuti hasilnya lewat
 * pendengar di bawah. Tekanan sambil menahan Shift menyalakan atau mematikan
 * lapisan gelap untuk halaman SIPP - dipisah karena yang kedua mengubah
 * aplikasi milik orang lain, dan hal semacam itu tidak boleh terjadi karena
 * tangan meleset satu piksel.
 */
/** Judul tombol tema SIPP. Tampilan Lama memakai judul lamanya, persis. */
function judulTombolTemaSipp(pilihan) {
  // Keadaan SIPP disebut apa adanya, termasuk ketika saklarnya menyala
  // tetapi lapisannya memang tidak dipasang karena temanya terang. Tanpa
  // itu, tombolnya berkata "menyala" sementara SIPP tampak tidak berubah -
  // dan yang membacanya menyimpulkan saklarnya rusak.
  const keadaanSipp = !temaSippMenyala
    ? "mati"
    : temaSekarang === "gelap"
      ? "menyala"
      : "menyala, tetapi tidak dipasang pada tema terang";
  const awal = alatTemaDuaKeadaan() ? `Ganti ke tema ${temaSekarang === "gelap" ? "terang" : "gelap"}. ` : `${alatJudulTombolTema(pilihan)} `;
  return (
    awal +
    `Tahan Shift untuk ${temaSippMenyala ? "mematikan" : "menyalakan"} tema gelap pada halaman SIPP ` +
    `(sekarang ${keadaanSipp}). Tema terang selalu mengembalikan SIPP seperti semula.`
  );
}

/**
 * Mengikuti pusat tema: setiap perubahan efektif - dari tombol ini, dari tab
 * lain, dari popup, atau dari tampilan sistem yang berganti - sampai ke sini
 * SEKALI, dan yang sudah sama tidak dikabarkan. Menggantikan pendengar
 * chrome.storage yang dahulu membaca temaPanel mentah (terang/gelap).
 */
function ikutiPusatTemaSipp(kabar) {
  temaSekarang = kabar.resolusi === "terang" ? "terang" : "gelap";
  temaSippMenyala = kabar.lapisan !== false;
  const panel = document.getElementById(PENANDA);
  alatTanpaTransisi(() => {
    if (panel && panel.getAttribute("data-tema") !== temaSekarang) panel.setAttribute("data-tema", temaSekarang);
    terapkanTemaSipp();
    const tombol = panel && panel.querySelector(".aleta-tema");
    if (tombol) {
      alatTampilkanTombolTema(tombol, kabar.pilihan);
      tombol.title = judulTombolTemaSipp(kabar.pilihan);
    }
  });
}

if (globalThis.AletaTemaPusat) globalThis.AletaTemaPusat.dengar(ikutiPusatTemaSipp);

function kembalikanBawaan(panel) {
  // Perbaikan 2 Okt (S, butir 11 - UI Baru): panel yang dilepas dari labuh
  // kanan oleh klik 2x sudut kembali berlabuh. Hanya bila memang pernah dilepas.
  const lepasLabuhTadi = Boolean(keadaanPanel && keadaanPanel.lepasLabuh);
  keadaanPanel = null;
  try {
    void chrome.storage.local.remove(KUNCI_POSISI);
  } catch {
    /* penyimpanan tidak tersedia - yang penting tampilannya sudah kembali */
  }
  for (const sifat of ["left", "top", "right", "bottom", "width", "height", "maxHeight"]) {
    panel.style[sifat] = "";
  }

  // ==========================================================================
  // DIJANGKARKAN KE KANAN SECARA EKSPLISIT - SAMA DENGAN panel-alat.js
  // ==========================================================================
  //
  // Bawaan panel adalah top 12px KANAN 12px, dan membersihkan gaya sebaris
  // seharusnya mengembalikannya ke sana. Nyatanya tidak selalu: panel yang
  // pernah digeser sudah dijangkarkan ulang ke kiri (right:auto + left px),
  // dan pada halaman yang aturan CSS-nya bertumpuk jangkar kanan tidak selalu
  // menang kembali. Hasilnya panel melompat ke KIRI, menutupi tempat kerja.
  //
  // Ditulis di SINI juga, bukan hanya di panel-alat.js: keduanya kembar, dan
  // ada penjaga yang menuntut keduanya membersihkan gaya yang sama persis.
  // Memperbaiki satu saja berarti panel SIPP tetap melompat sementara ABT
  // sudah benar - selisih yang justru paling membingungkan.
  panel.style.right = "12px";
  panel.style.top = "12px";
  panel.style.left = "auto";
  panel.style.bottom = "auto";

  // Kembali ke batas bawaan: tinggi pilihan sendiri sudah ikut dibuang
  // bersama posisinya.
  delete panel.dataset.tinggiSendiri;
  // Panel yang sedang menjadi lencana ikut dibentangkan. Mengembalikan
  // "bawaan" tetapi meninggalkannya sebagai lingkaran berarti menjawab
  // setengah - dan yang menekannya justru sedang mencari panelnya.
  panel.classList.remove("aleta-panel-penuh", "aleta-panel-ciut", KELAS_LENCANA);
  jepitTinggiKeRuangTersisa(panel);
  if (lepasLabuhTadi && typeof t7TerapkanLabuh === "function") t7TerapkanLabuh();
}

/**
 * ============================================================================
 * CIUT MENJADI LENCANA - SATU BENTUK DI SIPP, ABT, DAN HALAMAN ALETA
 * ============================================================================
 *
 * Sampai 1.105.0 ada DUA bentuk ciut di ekstensi yang sama:
 *
 *   ABT dan halaman ALETA  aleta-panel-lencana. Keadaannya DISIMPAN, dan
 *                          dipulihkan tiap kali panelnya digambar.
 *   SIPP                   aleta-panel-logo. Lingkaran juga, tetapi
 *                          keadaannya tidak pernah disimpan.
 *
 * Yang kedua itu sebab laporan "kadang tidak menciut jadi logo melayang".
 * Halaman SIPP mengubah DOM-nya terus-menerus - tiap tabel yang dimuat, tiap
 * tab yang dibuka - dan tiap perubahan itu dapat membuat panel digambar
 * ULANG. Panel yang baru lahir tidak membawa kelas logonya, jadi ia
 * terbentang lagi seolah tombolnya tidak pernah ditekan. Bukan kadang-kadang
 * gagal menciut: menciutnya berhasil, lalu dibatalkan oleh halamannya.
 *
 * Sekarang keduanya satu bentuk, satu kelas, dan satu keadaan tersimpan.
 *
 * Ukuran terbentangnya dicatat di elemennya sendiri, bukan di penyimpanan:
 * ia hanya berlaku selama halaman ini terbuka, dan menuliskannya ke
 * chrome.storage berarti satu tulisan tiap kali tombolnya ditekan.
 */
function ciutkanKeLencana(panel, jadikanLencana) {
  if (!panel) return;
  const sedang = panel.classList.contains(KELAS_LENCANA);
  const mau = jadikanLencana === undefined ? !sedang : Boolean(jadikanLencana);
  if (mau === sedang) return;

  if (mau) {
    const kotak = panel.getBoundingClientRect();
    panel.dataset.lebarSemula = String(Math.round(kotak.width));
    panel.dataset.tinggiSemula = String(Math.round(kotak.height));
    panel.classList.add(KELAS_LENCANA);
    panel.classList.remove("aleta-panel-penuh");
    panel.style.width = "";
    panel.style.height = "";
    panel.style.maxHeight = "";
    panel.title = "Klik untuk membentangkan panel ALETA";
  } else {
    panel.classList.remove(KELAS_LENCANA);
    panel.removeAttribute("title");
    if (panel.dataset.lebarSemula) panel.style.width = `${panel.dataset.lebarSemula}px`;
    if (panel.dataset.tinggiSemula) {
      panel.style.height = `${panel.dataset.tinggiSemula}px`;
      panel.style.maxHeight = "none";
    }
    jepitTinggiKeRuangTersisa(panel);
  }

  // Dijepit ke tepi layar SESUDAH ukurannya berubah, bukan sebelum: lencana
  // yang diletakkan di pojok kanan bawah akan menjulur keluar begitu ia
  // membentang menjadi panel selebar tiga ratus piksel.
  const kotak = panel.getBoundingClientRect();
  const aman = jepitKeLayar(kotak.left, kotak.top, kotak.width, kotak.height);
  panel.style.left = `${aman.kiri}px`;
  panel.style.top = `${aman.atas}px`;
  panel.style.right = "auto";
  panel.style.bottom = "auto";

  const tombol = panel.querySelector ? panel.querySelector(".aleta-lipat") : null;
  if (tombol) {
    tombol.textContent = mau ? "▢" : "–";
    tombol.title = mau ? "Bentangkan panel" : "Ciutkan menjadi lencana";
  }

  simpanKeadaanPanel({ kiri: Math.round(aman.kiri), atas: Math.round(aman.atas), lencana: mau });
}

/** Menjaga panel tetap terlihat walau jendela diperkecil setelah digeser. */
function jepitKeLayar(kiri, atas, lebar, tinggi) {
  const batasKiri = Math.min(Math.max(kiri, 0), Math.max(window.innerWidth - lebar, 0));
  const batasAtas = Math.min(Math.max(atas, 0), Math.max(window.innerHeight - 40, 0));
  return { kiri: batasKiri, atas: batasAtas };
}

function terapkanPosisi(panel, posisi) {
  keadaanPanel = posisi ? { ...posisi } : null;
  /* === POSISI-AWAL 12 Okt === */
  // Sesi baru (atau belum pernah menarik ukuran): panel kanan atas dengan
  // ukuran bawaan yang nyaman - lihat alatTerapkanUkuranAwal di panel-alat.js.
  // Dipasang selagi panel masih berjangkar kanan atas (normalkanJangkar
  // dipanggil sesudahnya). Yang sudah tersimpan tidak disentuh.
  try {
    if (typeof alatTerapkanUkuranAwal === "function") alatTerapkanUkuranAwal(panel, posisi);
  } catch {
    /* tanpa ukuran bawaan, panel.css tetap berlaku */
  }
  /* === AKHIR POSISI-AWAL === */
  if (!posisi) return;

  // Ukuran lebih dulu: posisinya dijepit terhadap ukuran yang SUDAH berlaku,
  // bukan terhadap ukuran bawaan yang sebentar lagi berubah.
  if (typeof posisi.lebar === "number" && posisi.lebar > 0) {
    panel.style.width = `${Math.min(posisi.lebar, Math.max(window.innerWidth - 20, 260))}px`;
  }
  if (typeof posisi.tinggi === "number" && posisi.tinggi > 0) {
    // Tinggi pilihan petugas mengalahkan batas tiga per lima - lihat
    // jepitTinggiKeRuangTersisa. Yang dibatasi tetap tepi layar.
    panel.dataset.tinggiSendiri = "1";
    panel.style.height = `${Math.min(posisi.tinggi, Math.max(window.innerHeight - 20, 160))}px`;
    // Batas bawaan dilepas hanya bila tingginya memang diatur sendiri -
    // kalau tidak, panel setinggi apa pun tetap terpotong pada batas itu.
    panel.style.maxHeight = "none";
  }

  if (typeof posisi.kiri !== "number" || typeof posisi.atas !== "number") {
    jepitTinggiKeRuangTersisa(panel);
    return;
  }
  const kotak = panel.getBoundingClientRect();
  const aman = jepitKeLayar(posisi.kiri, posisi.atas, kotak.width || 320, kotak.height || 200);
  panel.style.left = `${aman.kiri}px`;
  panel.style.top = `${aman.atas}px`;
  panel.style.right = "auto";
  panel.style.bottom = "auto";

  jepitTinggiKeRuangTersisa(panel);
}

/**
 * ============================================================================
 * PANEL YANG BARU MUNCUL TIDAK DAPAT DIGULUNG
 * ============================================================================
 *
 * Tingginya dijepit terhadap SELURUH tinggi jendela - innerHeight dikurangi 20 -
 * sedangkan posisinya dipasang menyusul, di mana saja panel itu terakhir
 * ditinggalkan. Panel setinggi hampir satu layar yang dipasang 300 piksel dari
 * atas karena itu berujung 300 piksel DI BAWAH tepi layar.
 *
 * Yang membuatnya membingungkan: tidak ada yang tampak rusak. Panelnya utuh,
 * kepalanya terbaca, dan isinya kelihatan. Yang tidak terjadi hanya
 * menggulung - sebab .aleta-isi memang tidak meluap: kotaknya sendiri cukup
 * tinggi untuk seluruh isinya. Yang meluap keluar layar adalah PANELNYA, dan
 * panel ber-overflow:hidden tidak menggulung.
 *
 * Karena itu tingginya dijepit terhadap ruang yang benar-benar tersisa DI BAWAH
 * posisinya, bukan terhadap tinggi jendela. Begitu tingginya muat di layar,
 * .aleta-isi kembali meluap sebagaimana mestinya, dan gulirnya hidup lagi.
 *
 * Dijalankan juga saat jendela diubah ukurannya - lihat pemanggilnya - sebab
 * jendela yang dipendekkan menimbulkan keadaan yang persis sama.
 */
function jepitTinggiKeRuangTersisa(panel) {
  if (!panel) return;
  if (panel.classList.contains("aleta-panel-penuh")) return;
  // Panel yang sedang ciut memang hanya setinggi kepalanya.
  if (panel.classList.contains("aleta-panel-ciut")) return;
  // Lencana punya ukurannya sendiri dari CSS dan tidak boleh dijepit -
  // yang dijepit akan menjadi logo melayang yang tiba-tiba memanjang.
  if (panel.classList.contains(KELAS_LENCANA)) return;

  const kotak = panel.getBoundingClientRect();
  const sisa = Math.max(window.innerHeight - kotak.top - 12, 160);

  // ==========================================================================
  // BERHENTI DI SEPERTIGA LAYAR, TIDAK SAMPAI KE DASAR
  // ==========================================================================
  //
  // Menjepit ke ruang yang tersisa saja membuat panel selalu tumbuh sampai
  // menyentuh tepi bawah jendela - dan panel setinggi layar penuh menutup
  // seluruh sisi kanan halaman SIPP, termasuk paginasi dan tombol yang
  // letaknya memang di bawah.
  //
  // Batasnya sepertiga tinggi jendela, dengan atap separuh layar. Cukup
  // untuk memuat kepala, satu bagian terbuka, dan kakinya sekaligus; dan
  // menyisakan dua pertiga halaman SIPP yang tetap terlihat utuh di
  // baliknya.
  //
  // Batas pertamanya tiga per lima, dan itu masih terlalu tinggi: pada
  // layar 1080 berarti hampir 600 piksel, dan begitu isinya lebih panjang
  // daripada jatahnya panel itu terpotong di tepi bawah.
  //
  // Ini batas BAWAAN, bukan kurungan: petugas yang menarik sudutnya lebih
  // panjang tetap mendapat tingginya sendiri - lihat terapkanPosisi, yang
  // menyetel tinggi lebih dulu lalu memanggil fungsi ini hanya sebagai
  // pengaman terhadap tepi layar.
  const batasIdaman = Math.min(
    Math.max(Math.round(window.innerHeight / 2), 320),
    Math.round((window.innerHeight * 2) / 3)
  );
  const batas = Math.min(sisa, panel.dataset.tinggiSendiri === "1" ? sisa : batasIdaman);
  if (kotak.height <= batas) return;

  panel.style.height = `${Math.round(batas)}px`;
  panel.style.maxHeight = `${Math.round(batas)}px`;
}

/**
 * Menjangkarkan panel pada kiri-atas, bukan pada kanan-atas.
 *
 * Bawaannya menempel ke tepi kanan (right: 14px). Pada jangkar itu, menarik
 * sudut kanan-bawah untuk MELEBARKAN justru menumbuhkan panel ke KIRI sementara
 * sudut yang ditarik diam di tempat - terasa terbalik, dan orang berhenti
 * mencoba. Dijangkarkan ulang sesudah terpasang, pada koordinat yang persis
 * sama, sehingga tampilannya tidak bergeser sedikit pun.
 */
function normalkanJangkar(panel) {
  if (panel.style.left) return;
  const kotak = panel.getBoundingClientRect();
  panel.style.left = `${Math.round(kotak.left)}px`;
  panel.style.top = `${Math.round(kotak.top)}px`;
  panel.style.right = "auto";
  panel.style.bottom = "auto";
}

/**
 * Menjaga panel tetap terjangkau saat jendela diperkecil.
 *
 * Sesudah dijangkarkan pada kiri-atas, panel tidak lagi mengikuti tepi kanan.
 * Jendela yang diperkecil - atau layar kedua yang dicabut - dapat meninggalkan
 * panel di luar layar, dan panel yang tidak terlihat tidak dapat digeser
 * kembali.
 */
function jagaTetapTerlihat() {
  const panel = document.getElementById(PENANDA);
  if (!panel) return;

  // Hanya panel yang SUDAH dijangkarkan yang perlu digeser kembali. Yang
  // belum pernah digeser masih menempel pada tepi kanan lewat CSS, dan
  // tepi itu mengikuti jendelanya sendiri.
  //
  // Dulu seluruh fungsi ini keluar di sini bila panelnya belum berjangkar -
  // termasuk penjepit tinggi di bawah. Akibatnya panel yang baru muncul
  // pada halaman yang belum pernah digeser tidak pernah dijepit sama
  // sekali, dan jendela yang dipendekkan meninggalkannya terpotong di tepi
  // bawah tanpa guliran. Kembarannya di panel-alat.js tidak pernah punya
  // cacat ini: di sana yang dipagari hanya bagian geser.
  if (panel.style.left) {
    const kotak = panel.getBoundingClientRect();
    const aman = jepitKeLayar(kotak.left, kotak.top, kotak.width, kotak.height);
    panel.style.left = `${aman.kiri}px`;
    panel.style.top = `${aman.atas}px`;
  }

  // Jendela yang dipendekkan menimbulkan keadaan yang sama dengan panel yang
  // baru muncul: tingginya melewati tepi bawah, dan gulirnya mati.
  jepitTinggiKeRuangTersisa(panel);
}

window.addEventListener("resize", jagaTetapTerlihat);

/** Selisih waktu menjadi kalimat pendek: "3 jam lalu". */
function usiaData(waktuIso) {
  const waktu = new Date(String(waktuIso || ""));
  if (Number.isNaN(waktu.getTime())) return { teks: "waktu tidak diketahui", basi: true };

  const menit = Math.max(Math.round((Date.now() - waktu.getTime()) / 60000), 0);
  if (menit < 2) return { teks: "baru saja", basi: false };
  if (menit < 60) return { teks: `${menit} menit lalu`, basi: false };

  const jam = Math.round(menit / 60);
  if (jam < 24) return { teks: `${jam} jam lalu`, basi: false };

  const hari = Math.round(jam / 24);
  return { teks: `${hari} hari lalu`, basi: true };
}

/**
 * 1.184.0 (5 Okt 2026, butir 32): "menunggu majelis" hanya untuk dokumen
 * persidangan perkara GUGATAN dan GUGATAN SEDERHANA - sama persis dengan
 * ecourtStoreService.dokumenMenungguMajelis di bot (angka ringkasan sudah
 * dihitung di sana). Berkas pendaftaran (tanpa tanggal unggah) dan perkara
 * permohonan tidak pernah menunggu verifikasi majelis.
 */
const KTN_POLA_BERKAS_PENDAFTARAN =
  /^(?:surat\s+gugatan|dokumen\s+gugatan|gugatan|surat\s+permohonan|dokumen\s+permohonan|permohonan|surat\s+kuasa|kuasa|dokumen\s+bukti|ktp|kartu\s+tanda\s+penduduk|kartu\s+keluarga|buku\s+nikah|kutipan\s+akta|akta|bukti)\b/i;

function ktnDokumenMenungguMajelis(d, nomor) {
  if (!d || d.statusVerifikasi !== "belum") return false;
  // Lama dan Baru-tanpa-saklar identik dengan fd9aad7 (syarat mutlak Tahap 7): bunyi lama; aturan baru di UI Baru.
  if (typeof alatUjiMode === "function" && alatUjiMode() !== "ui") return true;
  const n = String(d.nomorPerkara || nomor || "");
  if (n && !/\/Pdt\.G(?:\.S)?\//i.test(n)) return false;
  return !(!d.diunggahPada && KTN_POLA_BERKAS_PENDAFTARAN.test(String(d.judulDokumen || "").trim()));
}

/** Deretan angka keadaan perkara, hanya yang bernilai bukan nol. */
function barisRingkasan(ringkasan) {
  const r = ringkasan || {};
  const butir = [
    { nilai: r.selisihGenting, label: "selisih genting", warna: "merah" },
    { nilai: r.tenggatLewat, label: "tenggat lewat", warna: "merah" },
    { nilai: r.tenggatMendesak, label: "tenggat mendesak", warna: "kuning" },
    { nilai: r.menungguVerifikasi, label: "menunggu majelis", warna: "kuning" },
    // nomor bermasalah dimatikan bersama penandanya - lihat TANDAI_NOMOR_PIHAK.
    ...(TANDAI_NOMOR_PIHAK
      ? [{ nilai: r.nomorBermasalah, label: "nomor bermasalah", warna: "kuning" }]
      : []),
    { nilai: r.dokumen, label: "dokumen", warna: "abu" },
  ].filter((x) => Number(x.nilai) > 0);

  if (butir.length === 0) return null;

  const baris = buatElemen("div", "aleta-ringkasan");
  for (const x of butir) {
    const chip = buatElemen("span", `aleta-chip aleta-chip-${x.warna}`);
    chip.appendChild(buatElemen("strong", "", String(x.nilai)));
    chip.appendChild(buatElemen("span", "", ` ${x.label}`));
    baris.appendChild(chip);
  }
  return baris;
}
/**
 * ============================================================================
 * PITA IDENTITAS - SATU BENTUK DI KEPALA DAN DI KAKI, PADA SETIAP PANEL
 * ============================================================================
 *
 * Lima hal yang harus terbaca tanpa mencari: siapa yang masuk ALETA, akun
 * SIPP mana yang sedang dipakai, nomor perkara yang dibuka, jenis perkaranya,
 * dan seri ekstensi yang berjalan. Selama ini kelimanya tersebar - nama ALETA
 * di baris kedua isi, akun SIPP di kepala, versi di kaki, jenis perkara di
 * chip - dan pada panel yang tergulung ke bawah, separuhnya tidak terlihat.
 *
 * Yang diminta petugas sederhana: kelimanya ada di ATAS dan di BAWAH, pada
 * letak dan huruf yang sama, di panel mana pun - perkara, daftar, ditolak,
 * maupun ajakan masuk. Karena itu satu fungsi ini yang menggambar keduanya;
 * yang berbeda hanya wadahnya. Mengubah urutan atau hurufnya di sini mengubah
 * kepala dan kaki sekaligus, dan tidak ada cara membuat keduanya berbeda
 * tanpa sengaja.
 *
 * Yang tidak terbaca TIDAK ditulis - bukan "tidak diketahui". Panel ajakan
 * masuk memang belum tahu siapa yang masuk ALETA; menuliskan tanda tanya di
 * sana hanya menambah satu kata yang harus dibaca tanpa pernah menjawab.
 */
function pitaIdentitas(opsi) {
  const o = opsi || {};
  const pita = buatElemen("div", "aleta-identitas-panel");

  const tambah = (kelas, label, teks, judul) => {
    const kotak = buatElemen("span", kelas);
    if (label) kotak.appendChild(buatElemen("span", "aleta-id-label", label));
    kotak.appendChild(document.createTextNode(teks));
    if (judul) kotak.title = judul;
    pita.appendChild(kotak);
    return kotak;
  };

  // Siapa yang masuk ALETA - bukan siapa yang masuk SIPP. Dua orang yang
  // berbeda pada satu meja adalah keadaan yang biasa, dan keduanya harus
  // terbaca berdampingan.
  const namaAleta = penggunaTerakhir && penggunaTerakhir.nama ? String(penggunaTerakhir.nama) : "";
  if (namaAleta) {
    const peran = penggunaTerakhir.peran ? ` (${penggunaTerakhir.peran})` : "";
    tambah("aleta-id-akun aleta-id-aleta", "ALETA", namaAleta, `Masuk ke ALETA sebagai ${namaAleta}${peran}.`);
  }

  // Akun SIPP dibaca dari halaman, bukan dari server: SIPP tidak menyediakan
  // cara lain, dan yang tertulis di halaman itulah yang tercatat ketika
  // tombol Simpan SIPP ditekan.
  const akunSipp = namaPenggunaSipp();
  if (akunSipp) {
    const kotakAkun = buatElemen("span", "aleta-akun-sipp", akunSipp);
    kotakAkun.title = `Halaman SIPP ini sedang dibuka dengan akun ${akunSipp}.`;
    kotakAkun.prepend(buatElemen("span", "aleta-id-label", "SIPP"));
    pita.appendChild(kotakAkun);
  }

  // Nomor dan jenis perkara TIDAK lagi di pita - keduanya turun ke baris
  // kedua panel, tempat chip identitasnya memang sudah berdiri. Di pita
  // keduanya mengulang baris itu satu jengkal di atasnya. Perilaku tukar
  // dan salinnya ikut turun - lihat tombolNomorTukar.


  // Seri ekstensi TIDAK lagi di pita: ia pindah ke baris kaki, satu-satunya
  // tempat yang memang dibaca orang ketika melapor. Di pita ia mengulang
  // dirinya di kepala dan kaki sekaligus.
  return pita;
}

/** Kaki panel: pita identitas yang sama persis dengan kepalanya. */
function kakiPanel(opsi) {
  const kaki = buatElemen("div", "aleta-kaki");
  kaki.title = "Keterangan dari ALETA. SIPP tidak diubah.";
  // Pita identitas TIDAK diulang di kaki. Nomor dan jenis perkara sudah
  // ada di kepala, dua jengkal di atasnya; mengulangnya hanya memakan satu
  // baris yang seharusnya milik isi panel. opsi tetap diterima supaya
  // pemanggilnya tidak perlu berubah.
  void opsi;

  // Pintasan yang tidak diketahui siapa pun sama saja dengan pintasan yang
  // tidak ada. Disebutkan di kaki panel - satu baris, tempat yang memang
  // dibaca orang ketika mencari tahu panel ini bisa apa.
  // ==========================================================================
  // SATU BARIS, BUKAN TIGA
  // ==========================================================================
  //
  // Kaki panel pernah memakan tiga baris: pita identitas, kalimat pintasan
  // sepanjang lebar panel, dan tombol segarkan selebar tulisannya. Pada
  // panel setinggi separuh layar itu seperenam tempatnya - dan tempat itu
  // milik isi panel, bukan milik keterangan yang dibaca sekali.
  //
  // Pintasannya disingkat menjadi tombolnya saja; keterangan lengkapnya
  // pindah ke title, yang muncul saat kursor diam di atasnya. Segarkan
  // menjadi ikon di ujung kanan baris yang sama.
  const barisKaki = buatElemen("div", "aleta-kaki-baris");
  const pintasan = buatElemen(
    "div",
    "aleta-kaki-pintasan",
    PINTASAN_PANEL.map((x) => x.tombol).join(" · ")
  );
  pintasan.title =
    PINTASAN_PANEL.map((x) => `${x.tombol}  ${x.nama}`).join("\n") +
    "\n\nTidak berlaku selagi mengetik di kolom isian.";

  // Saklar panel ringkas, di samping deretan pintasan - diminta pengguna
  // 22 September 2026. Dipasang SEBELUM pintasannya: .aleta-kaki-pintasan
  // memegang margin-right otomatis yang mendorong ikon segarkan dan nomor
  // versi ke kanan, dan tombol yang ditaruh sesudahnya ikut terdorong ke sana.
  //
  // Panel ini menyusun kakinya sendiri, tidak memakai alatBarisPintasan -
  // jadi tombolnya dipasang di sini pula. Menyatukan keduanya bukan
  // pekerjaan hari ini: bentuk barisnya berbeda, dan penjaga menyisir teks
  // PINTASAN_PANEL.map((x) di berkas ini.
  const bungkusKiri = buatElemen("div", "aleta-kaki-kiri");
  bungkusKiri.appendChild(alatTombolRingkas());
  bungkusKiri.appendChild(pintasan);
  barisKaki.appendChild(bungkusKiri);

  // ==========================================================================
  // SEGARKAN ADA DI KAKI, BUKAN HANYA DI KEPALA
  // ==========================================================================
  //
  // Tombol ↺ di kepala mengembalikan UKURAN DAN POSISI panel - bukan
  // datanya. Tidak ada satu pun jalan membaca ulang keterangan perkara
  // selain memuat ulang seluruh halaman SIPP, dan memuat ulang halaman
  // orang yang sedang mengisi borang membuang isian yang belum disimpan.
  //
  // Di kaki, sebab di sanalah pandangan berhenti sesudah membaca panelnya -
  // dan sebab kepala sudah memuat lima tombol.
  const segar = buatElemen("button", "aleta-kaki-segar", "↻");
  segar.type = "button";
  segar.setAttribute("aria-label", "Segarkan");
  segar.title = "Segarkan - membaca ulang keterangan perkara dari ALETA. Halaman SIPP tidak dimuat ulang, dan isian yang belum disimpan tidak hilang.";
  segar.addEventListener("click", () => {
    segar.disabled = true;
    segar.classList.add("aleta-kaki-segar-jalan");
    // Penjaga nomorTerakhir dikosongkan lebih dulu - tanpa itu segarkan()
    // memulangkan diri sendiri tanpa membaca apa pun.
    nomorTerakhir = "";
    konteksTerakhir = null;
    void segarkan();
  });
  barisKaki.appendChild(segar);

  // Seri ekstensi yang BENAR-BENAR berjalan di peramban ini, dari manifestnya
  // sendiri. Gunanya saat melapor: "panelnya keliru" tanpa nomor seri membuat
  // pemeriksaan dimulai dari menebak versi mana yang sedang dipakai orang itu.
  try {
    const seri = chrome.runtime.getManifest().version;
    if (seri) {
      const versi = buatElemen("span", "aleta-kaki-versi", `v${seri}`);
      versi.title = "Seri ekstensi ALETA yang terpasang di peramban ini.";
      barisKaki.appendChild(versi);
    }
  } catch {
    /* di luar konteks ekstensi: kaki tetap tampil tanpa nomor seri */
  }
  kaki.appendChild(barisKaki);
  return kaki;
}

/**
 * Panel RINGAN dari Cermin Perkara (A6, 25 Okt 2026).
 *
 * Dipakai hanya bila ALETA Bot / SIPP tidak menjawab tetapi portal MASIH
 * memegang salinan keadaan perkara ini (jawaban sipp-konteks memuat
 * `keadaanCermin`; saklar Panel ekstensi di Pemantau Cermin Perkara menyala).
 * Isinya ringkasan non-pribadi - tahapan, majelis, sidang, putusan, penanda -
 * bertanda "Cermin · diperbarui hh.mm". Menu tindakan (verifikasi, tulis SIPP)
 * TIDAK ada di sini: cermin hanya untuk dibaca, dan menulis selalu menunggu
 * jalur lama yang membaca ulang SIPP. Begitu bot menjawab, panel penuh
 * menggantikannya sendiri pada penyegaran berikutnya.
 */
function jamCerminPanel(iso) {
  const t = iso ? new Date(iso) : null;
  if (!t || Number.isNaN(t.getTime())) return "-";
  try {
    return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Makassar", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .format(t)
      .replace(":", ".");
  } catch {
    return "-";
  }
}

function susunPanelCermin(keadaan, pesan) {
  const k = keadaan || {};
  const panel = buatElemen("div", "aleta-panel");
  panel.id = PENANDA;
  panel.setAttribute("data-cermin", "1");

  const kepala = buatElemen("div", "aleta-kepala");
  kepala.appendChild(buatElemen("span", "aleta-merek", "ALETA"));
  kepala.appendChild(pitaIdentitas({ nomorPerkara: k.nomorPerkara || cariNomorPerkara() }));
  panel.appendChild(kepala);

  const isi = buatElemen("div", "aleta-isi");
  const tanda = buatElemen("div", "aleta-kosong");
  tanda.setAttribute("data-testid", "tanda-cermin-panel");
  tanda.textContent =
    `Cermin · diperbarui ${jamCerminPanel(k.diperbaruiPada)}. ` +
    `${pesan ? String(pesan) + " " : ""}` +
    "Ini salinan keadaan perkara; menu tindakan tersedia lagi begitu ALETA Bot menjawab.";
  isi.appendChild(tanda);

  const tambah = (judul, ket) => {
    if (!ket) return;
    const baris = buatElemen("div", "aleta-baris");
    baris.appendChild(buatElemen("div", "aleta-baris-judul", judul));
    baris.appendChild(buatElemen("div", "aleta-baris-ket", ket));
    isi.appendChild(baris);
  };
  tambah("Jenis perkara", [k.jenisPerkara, k.prodeo ? "(prodeo)" : ""].filter(Boolean).join(" "));
  tambah("Tahapan", [k.tahapan, k.proses].filter(Boolean).join(" — "));
  tambah(
    "Majelis dan petugas",
    [k.majelis && `Majelis: ${k.majelis}`, k.panitera && `PP: ${k.panitera}`, k.jurusita && `JS: ${k.jurusita}`].filter(Boolean).join(" · ")
  );
  const mendatang = Array.isArray(k.sidangMendatang) ? k.sidangMendatang : [];
  tambah(
    "Sidang",
    [
      k.sidangTerakhir && `Terakhir ${k.sidangTerakhir}`,
      mendatang.length
        ? "Berikut: " + mendatang.map((s) => `${s.tanggal}${s.jam ? " " + s.jam : ""}${s.agenda ? " (" + s.agenda + ")" : ""}${s.ditunda ? " ditunda" : ""}`).join(", ")
        : k.sidangBerikut && `Berikut ${k.sidangBerikut}`,
      k.jumlahSidang ? `${k.jumlahSidang} kali bersidang` : "",
    ]
      .filter(Boolean)
      .join(" · ")
  );
  const p = k.putusan || {};
  tambah(
    "Putusan",
    p.tanggal
      ? [`${p.status || "Diputus"} ${p.tanggal}`, p.verstek ? "verstek" : "", p.minutasi && `minutasi ${p.minutasi}`, p.bht && `BHT ${p.bht}`].filter(Boolean).join(" · ")
      : ""
  );
  if (Array.isArray(k.tag) && k.tag.length) tambah("Penanda", k.tag.map((x) => x.label).join(", "));

  panel.appendChild(isi);
  panel.appendChild(kakiPanel({ nomorPerkara: k.nomorPerkara || cariNomorPerkara() }));
  return panel;
}

function susunPanelDitolak(pesan) {
  const panel = buatElemen("div", "aleta-panel");
  panel.id = PENANDA;

  const kepala = buatElemen("div", "aleta-kepala");
  kepala.appendChild(buatElemen("span", "aleta-merek", "ALETA"));
  kepala.appendChild(pitaIdentitas({ nomorPerkara: cariNomorPerkara() }));
  panel.appendChild(kepala);

  const isi = buatElemen("div", "aleta-isi");
  isi.appendChild(
    buatElemen(
      "div",
      "aleta-kosong",
      pesan || "Peran Anda tidak diberi akses ke ekstensi ini. Hubungi administrator ALETA."
    )
  );

  panel.appendChild(isi);
  panel.appendChild(kakiPanel({ nomorPerkara: cariNomorPerkara() }));
  return panel;
}

function susunAjakanMasuk() {
  const panel = buatElemen("div", "aleta-panel");
  panel.id = PENANDA;

  const kepala = buatElemen("div", "aleta-kepala");
  kepala.appendChild(buatElemen("span", "aleta-merek", "ALETA"));
  // Belum ada yang masuk ALETA, jadi pitanya hanya memuat akun SIPP, nomor
  // perkara, dan seri - dan tetap pada letak yang sama dengan panel lain.
  kepala.appendChild(pitaIdentitas({ nomorPerkara: cariNomorPerkara() }));
  panel.appendChild(kepala);

  const isi = buatElemen("div", "aleta-isi");
  isi.appendChild(buatElemen("div", "aleta-kosong", "Masuk ke ALETA untuk melihat keterangan perkara ini."));
  // Disebutkan supaya tidak ada yang memuat ulang halaman SIPP tanpa perlu -
  // dan supaya yang menunggu tahu bahwa memang ada yang ditunggu.
  isi.appendChild(
    buatElemen("div", "aleta-kosong-lembut", "Panel ini menyambung sendiri begitu Anda selesai masuk.")
  );

  const tautan = buatElemen("a", "aleta-tombol", "Buka ALETA");
  tautan.href = "/aleta";
  tautan.target = "_blank";
  tautan.rel = "noreferrer noopener";
  isi.appendChild(tautan);
  susunMasukSesiSippDiAjakan(isi); // MASUK-SESI-SIPP 11 Okt

  panel.appendChild(isi);
  panel.appendChild(kakiPanel({ nomorPerkara: cariNomorPerkara() }));
  return panel;
}

/* === MASUK-SESI-SIPP 11 Okt === */
/**
 * ============================================================================
 * MASUK OTOMATIS DARI SIPP KE ALETA (11 Okt 2026)
 * ============================================================================
 *
 * Permintaan pengguna: petugas yang sudah masuk SIPP harus dikenali ALETA.
 * Sebelumnya panel di sini hanya berbunyi "Masuk ke ALETA" dan menunggu.
 *
 * Panel TIDAK mengirim nama dari kepala halaman (siapa pun dapat menulisnya).
 * Ia hanya meminta portal - satu asal dengan SIPP, sehingga cookie sesi SIPP
 * ikut terkirim sendiri - dan portal meminta bot membuka cookie itu dengan
 * kunci SIPP. Akun ALETA dipilih di server: tautan Manajemen Akun, NIP, atau
 * nama SIPP yang sama dan tunggal. Ganda/ragu = tidak masuk; panel
 * menerangkan sebabnya dan menawarkan tautan manual.
 *
 * Otomatis SEKALI per pemuatan halaman, dan ditahan sesudah petugas keluar
 * ALETA dengan sengaja (latar.js: masuk-sesi-boleh). Tombol "Masuk dengan
 * akun SIPP ini" selalu dapat ditekan sendiri.
 */
const ALETA_API_MASUK_SESI = "/aleta/api/auth/sign-in/sipp-sesi";
const ALETA_API_TAUTKAN_SESI = "/aleta/api/auth/sipp-sesi/tautkan";
const KUNCI_TAUTKAN_SESUDAH_MASUK = "aletaTautkanSippSesudahMasuk";
let masukSesiSudahDicoba = false;
let masukSesiHasil = null;

async function masukAletaDariSesiSipp(manual) {
  if (!manual && masukSesiSudahDicoba) return masukSesiHasil;
  masukSesiSudahDicoba = true;
  if (manual) {
    await alatPesanLatar({ sumber: "aleta-panel", jenis: "masuk-sesi-lepas" });
  } else {
    const izin = await alatPesanLatar({ sumber: "aleta-panel", jenis: "masuk-sesi-boleh" });
    if (izin && izin.ok === true && izin.boleh === false) {
      masukSesiHasil = { jenis: "ditahan", pesan: "Anda keluar dari ALETA tadi - tekan \"Masuk dengan akun SIPP ini\" bila ingin masuk lagi." };
      return masukSesiHasil;
    }
  }
  try {
    const r = await fetch(ALETA_API_MASUK_SESI, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const isi = await r.json().catch(() => null);
    if (r.ok && isi && typeof isi === "object") masukSesiHasil = isi;
    else if (r.status === 404) masukSesiHasil = { jenis: "tidak-tersedia", pesan: "" };
    else masukSesiHasil = { jenis: "tolak", pesan: String((isi && (isi.message || isi.pesan)) || "ALETA menolak masuk dengan sesi SIPP ini.").slice(0, 300) };
  } catch {
    masukSesiHasil = { jenis: "tak-terjangkau", pesan: "ALETA belum dapat dihubungi." };
  }
  return masukSesiHasil;
}

function kalimatMasukSesi(hasil) {
  if (!hasil) return "";
  if (hasil.pesan) return String(hasil.pesan);
  if (hasil.jenis === "tanpa-sesi") return "Sesi SIPP di peramban ini belum terbaca ALETA - muat ulang halaman SIPP, atau masuk ALETA seperti biasa.";
  if (hasil.jenis === "dimatikan") return "Masuk otomatis dari SIPP dimatikan di server ALETA.";
  return "";
}

function susunMasukSesiSippDiAjakan(isi) {
  const kabar = buatElemen("div", "aleta-kosong-lembut", kalimatMasukSesi(masukSesiHasil));
  kabar.setAttribute("data-aleta-masuk-sesi", (masukSesiHasil && masukSesiHasil.jenis) || "");
  if (!kabar.textContent) kabar.hidden = true;
  isi.appendChild(kabar);

  if (masukSesiHasil && masukSesiHasil.jenis === "tidak-tersedia") return;
  const tombol = buatElemen("button", "aleta-tombol", "Masuk dengan akun SIPP ini");
  tombol.type = "button";
  tombol.addEventListener("click", async () => {
    tombol.disabled = true;
    tombol.textContent = "Memeriksa sesi SIPP…";
    const hasil = await masukAletaDariSesiSipp(true);
    if (hasil && hasil.jenis === "masuk") {
      nomorTerakhir = "";
      void segarkan();
      return;
    }
    kabar.hidden = false;
    kabar.textContent = kalimatMasukSesi(hasil) || "Belum dapat masuk dengan sesi SIPP ini.";
    tombol.disabled = false;
    tombol.textContent = "Masuk dengan akun SIPP ini";
    if (hasil && hasil.jenis === "ragu") tampilkanTautkanManual();
  });
  isi.appendChild(tombol);

  // Nama ganda / belum ada tautan: tautkan sendiri sesudah masuk ALETA.
  const tautkan = buatElemen("a", "aleta-tombol", "Masuk ALETA lalu tautkan akun SIPP ini");
  tautkan.href = "/aleta/login";
  tautkan.target = "_blank";
  tautkan.rel = "noreferrer noopener";
  tautkan.hidden = !(masukSesiHasil && masukSesiHasil.jenis === "ragu");
  tautkan.addEventListener("click", () => {
    try {
      sessionStorage.setItem(KUNCI_TAUTKAN_SESUDAH_MASUK, String(Date.now()));
    } catch {
      /* tanpa sessionStorage: tautkan lewat Manajemen Akun */
    }
  });
  isi.appendChild(tautkan);
  function tampilkanTautkanManual() {
    tautkan.hidden = false;
  }
}

/** Dipanggil sesudah konteks perkara terbaca (ALETA sudah masuk). */
async function tautkanSesiSippBilaDiminta() {
  let diminta = "";
  try {
    diminta = sessionStorage.getItem(KUNCI_TAUTKAN_SESUDAH_MASUK) || "";
    if (diminta) sessionStorage.removeItem(KUNCI_TAUTKAN_SESUDAH_MASUK);
  } catch {
    return;
  }
  // Permintaan basi (lebih dari 30 menit) tidak dikerjakan.
  if (!diminta || Date.now() - Number(diminta) > 30 * 60 * 1000) return;
  let pesan = "";
  try {
    const r = await fetch(ALETA_API_TAUTKAN_SESI, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const isi = await r.json().catch(() => null);
    if (isi && isi.jenis === "tertaut") pesan = `Akun SIPP ${isi.usernameSipp} kini tertaut ke akun ALETA Anda.`;
    else if (isi && isi.jenis === "sudah") pesan = `Akun SIPP ${isi.usernameSipp} memang sudah tertaut ke akun ALETA Anda.`;
    else pesan = String((isi && (isi.pesan || isi.message)) || "Tautan akun SIPP belum dapat disimpan.");
  } catch {
    pesan = "Tautan akun SIPP belum dapat disimpan - ALETA tidak terjangkau.";
  }
  const panel = document.getElementById(PENANDA);
  const wadah = panel && panel.querySelector(".aleta-isi");
  if (!wadah) return;
  const kabar = buatElemen("div", "aleta-kosong-lembut", pesan);
  kabar.setAttribute("data-aleta-tautkan-sesi", "1");
  wadah.insertBefore(kabar, wadah.firstChild);
}
/* === AKHIR MASUK-SESI-SIPP === */

// ─── Menandai halaman SIPP ────────────────────────────────────────────────────
//
// Aturan yang tidak boleh dilanggar bagian ini:
//
//   1. HANYA MENAMBAH. Tidak mengubah teks, nilai, atribut, atau susunan yang
//      sudah ada di SIPP. Yang disisipkan hanya elemen baru bertanda
//      data-aleta-tanda, plus satu kelas sorotan pada baris.
//   2. DAPAT DICABUT UTUH. Mematikan saklarnya harus mengembalikan halaman ke
//      keadaan semula, tanpa memuat ulang.
//   3. TIDAK MENYENTUH FORMULIR. Tidak menekan tombol, tidak mengisi isian,
//      tidak mengirim apa pun. SIPP adalah sistem resmi; yang tercatat di sana
//      harus selalu hasil perbuatan manusia.
//
// Yang ditandai adalah keterangan yang MEMANG TIDAK ADA di SIPP: tenggat
// unggah e-Court dan keadaan nomor pihak. Menandai hal yang sudah tertulis di
// layar hanya menambah keramaian tanpa menambah pengetahuan.

const TANDA = "data-aleta-tanda";
const SOROT = "aleta-baris-disorot";

function bersihkanTanda() {
  // Melepas sorotan mengubah atribut class pada baris SIPP - perubahan yang
  // penyaring tidak dapat mengenali sebagai milik ALETA, karena barisnya
  // memang milik SIPP. Karena itu pembersihan pun dikerjakan tanpa pengamat.
  tanpaPengamat(() => {
    document.querySelectorAll(`[${TANDA}]`).forEach((el) => el.remove());
    document.querySelectorAll(`.${SOROT}`).forEach((el) => el.classList.remove(SOROT));
  });
}

/**
 * Satu penanda kecil di dalam tabel SIPP.
 *
 * `judul` menerangkan ARTI penandanya saat disentuh tetikus. Tanpa itu,
 * "1 nomor bermasalah" hanya memberi tahu ada sesuatu - tidak memberi tahu
 * masalahnya apa, apalagi apa yang harus dikerjakan. Penanda yang tidak dapat
 * ditindaklanjuti pada akhirnya diabaikan, dan penanda yang diabaikan sama
 * saja dengan penanda yang tidak ada.
 */
function labelTanda(teks, warna, { judul = "" } = {}) {
  const span = buatElemen("span", `aleta-tanda aleta-tanda-${warna}`, teks);
  span.setAttribute(TANDA, "1");
  if (judul) span.title = `ALETA: ${judul}`;
  return span;
}

function samakan(teks) {
  return String(teks || "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** Menempelkan ringkasan e-Court di sebelah judul halaman perkara. */
/**
 * ============================================================================
 * YANG DITANDAI HANYA YANG TIDAK ADA DI SIPP
 * ============================================================================
 *
 * Penanda lama menampilkan "5 dokumen e-Court", "1 nomor bermasalah", dan
 * hitungan tenggat. Ketiganya SUDAH ada di panel ALETA yang terbuka persis di
 * sebelahnya - jadi penandanya tidak menambah apa pun, ia mengulang. Dan ia
 * mengulang di halaman milik orang lain, yang merupakan tempat paling mahal
 * untuk sebuah pengulangan.
 *
 * Aturannya sekarang dua, dan keduanya harus terpenuhi:
 *
 *   1. TIDAK ADA di halaman SIPP itu. Kalau petugas dapat membacanya dengan
 *      menggulung halaman, menempelkannya lagi hanya menambah keramaian.
 *   2. MENGUBAH cara perkara itu ditangani hari ini. Keterangan yang benar
 *      tetapi tidak mengubah apa pun adalah keterangan yang akan diabaikan
 *      pada hari ketiga, lalu menulari penanda lain ikut diabaikan.
 *
 * Yang lolos keduanya:
 *
 *   PIHAK GHAIB      SIPP menyimpannya di perkara_pihak2.ghaib dan tidak
 *                    menampilkannya di halaman detail. Ia mengubah seluruh
 *                    tata cara: panggilan lewat pengumuman, tenggat 120 atau
 *                    180 hari, dan bentuk relaas yang berbeda.
 *   PERLU IZIN ATASAN  Pihak PNS, TNI, atau Polri tidak dapat disidangkan
 *                    sebelum izin atasannya keluar. Jadwal sidang pertama
 *                    yang disamakan dengan perkara biasa akan tertunda.
 *   DIDUGA MAFQUD    Tidak punya kolomnya sendiri di SIPP - hanya pencirinya:
 *                    tundaan panjang berulang. Disebut sebagai DUGAAN.
 *   TENGGAT LEWAT    Batas unggah e-Court ada di e-Court, bukan di SIPP, dan
 *                    yang lewat berarti pihak kehilangan kesempatan menanggapi.
 *
 * Yang sengaja DIBUANG: jumlah dokumen, jumlah nomor bermasalah, dan hitungan
 * tenggat mendesak. Ketiganya keterangan, bukan tindakan.
 */
function tandaiJudul(konteks) {
  const judul = document.querySelector("h1, h2, .page-title, .panel-title");
  if (!judul || judul.querySelector(`[${TANDA}]`)) return;

  const p = konteks.penanda || {};

  // Ghaib lebih dulu dan berwarna merah: dari seluruh penanda, inilah yang
  // paling mengubah pekerjaan hari itu.
  if (p.ghaib === true) {
    judul.appendChild(
      labelTanda("PIHAK GHAIB", "merah", {
        judul:
          `Panggilan lewat pengumuman, tenggat 120 atau 180 hari. ` +
          `${(p.sumberGhaib || []).join("; ") || "penanda ghaib pada SIPP"}.`,
      })
    );
  }

  if (p.perluIzinAtasan) {
    const sebutan = (p.instansi || []).map((x) => x.label).join(", ");
    judul.appendChild(
      labelTanda(`IZIN ATASAN — ${sebutan || "PNS/TNI/Polri"}`, "kuning", {
        judul:
          "Pihak berstatus PNS, TNI, atau Polri. Persidangan menunggu izin atasannya, " +
          "sehingga hari sidang pertama tidak dapat disamakan dengan perkara biasa.",
      })
    );
  }

  // Dugaan, dan ditulis sebagai dugaan. Mafqud tidak punya kolom di SIPP -
  // yang ada hanya pencirinya, dan penanda yang menyatakan lebih daripada yang
  // diketahui akan dipercaya lebih daripada yang pantas.
  if (p.mafqud) {
    judul.appendChild(
      labelTanda("diduga mafqud", "kuning", {
        judul:
          `Diduga dari pola tundaan: ${p.tundaanPanjang || 0} kali tundaan panjang. ` +
          "Ini penanda untuk diperiksa, bukan keterangan resmi.",
      })
    );
  }

  const r = konteks.ringkasan || {};
  if (r.tenggatLewat > 0) {
    judul.appendChild(
      labelTanda(`${r.tenggatLewat} tenggat e-Court lewat`, "merah", {
        judul: "Batas unggah e-Court sudah terlampaui. SIPP tidak menampilkan batas ini.",
      })
    );
  }

  // ==========================================================================
  // SEMBILAN KEADAAN LAIN YANG SIPP SIMPAN TETAPI TIDAK TAMPILKAN
  // ==========================================================================
  //
  // Urutannya menurun dari yang paling menghentikan pekerjaan ke yang paling
  // sekadar perlu diketahui. Yang di atas berwarna merah, yang di bawah
  // kuning atau abu - supaya satu pandangan sudah memisahkan "berhenti
  // sekarang" dari "ingat nanti".
  const t = konteks.penandaLain || {};

  // Panjar habis menghentikan perkara karena UANG, bukan karena hukum - dan
  // baru ketahuan ketika juru sita gagal berangkat.
  if (t.panjar) {
    const rupiah = new Intl.NumberFormat("id-ID").format(t.panjar.sisa);
    judul.appendChild(
      labelTanda(t.panjar.habis ? "PANJAR HABIS" : `panjar menipis Rp${rupiah}`, "merah", {
        judul:
          `Saldo panjar Rp${rupiah} per ${t.panjar.tanggal}. ` +
          "Dihitung dari transaksi biaya - SIPP tidak menampilkan saldonya di halaman ini.",
      })
    );
  }

  if (t.delegasi) {
    judul.appendChild(
      labelTanda(`delegasi belum dikirim balik (${t.delegasi.hari} hari)`, "merah", {
        judul: `Delegasi ${t.delegasi.jenis} dari ${t.delegasi.asal}, diterima ${t.delegasi.tanggalTerima}. Pengadilan pengaju menunggu.`,
      })
    );
  }

  if (t.upayaHukum) {
    for (const u of t.upayaHukum) {
      judul.appendChild(
        labelTanda(`berkas ${u.label} belum dikirim (${u.hari} hari)`, "merah", {
          judul: `Permohonan ${u.label} ${u.tanggalMohon}, berkasnya belum dikirim ke pengadilan tingkat atas.`,
        })
      );
    }
  }

  if (t.aktaCerai) {
    judul.appendChild(
      labelTanda(`akta cerai belum terbit (${t.aktaCerai.hari} hari)`, "kuning", {
        judul: `Sudah BHT ${t.aktaCerai.bht}. Hak pihak atas akta cerai sudah jatuh tempo.`,
      })
    );
  }

  if (t.mediasi) {
    judul.appendChild(
      labelTanda("mediasi belum dimulai", "kuning", {
        judul:
          `Mediator ${t.mediasi.mediator || "sudah ditunjuk"} sejak ${t.mediasi.tanggalPenunjukan} ` +
          `(${t.mediasi.hari} hari), tetapi mediasinya belum dimulai.`,
      })
    );
  }

  if (t.berjalanLama) {
    judul.appendChild(
      labelTanda(`berjalan ${t.berjalanLama.hari} hari`, "kuning", {
        judul:
          `Terdaftar ${t.berjalanLama.tanggalDaftar} dan belum putus. ` +
          "Melewati lima bulan, batas terakhir sebelum unsur waktu putus SK 048/2024 bernilai nol.",
      })
    );
  }

  // Keempat berikut tidak menuntut tindakan hari ini - ia mengubah CARA
  // perkaranya diperlakukan, dan itu perlu diketahui sebelum salah langkah.
  if (t.verzet) {
    // ========================================================================
    // PERLAWANAN KEDUA DISEBUT ANGKANYA, TIDAK DIDIAMKAN
    // ========================================================================
    //
    // Satu perkara dapat dilawan lebih dari sekali. Selama penandanya berbunyi
    // "VERZET" saja, perlawanan kedua tampak persis sama dengan yang pertama -
    // padahal yang kedua mengubah cara majelis membaca berkasnya, dan tanggal
    // yang tergambar adalah tanggal perlawanan yang mana pun terbaca lebih
    // dulu. Angka itu jarang muncul, dan justru karena jarang ia tidak pernah
    // ketahuan bila tidak disebutkan.
    const jumlah = Number(t.verzet.jumlah || 1);
    const lama = Array.isArray(t.verzet.sebelumnya) ? t.verzet.sebelumnya : [];
    const riwayat = lama.length
      ? ` Perlawanan sebelumnya: ${lama.map((x) => x.tanggalDaftar || "tanggal tidak terbaca").join(", ")}.`
      : "";

    judul.appendChild(
      labelTanda(jumlah > 1 ? `VERZET ke-${jumlah}` : "VERZET", "kuning", {
        judul:
          `Perlawanan atas putusan verstek, terdaftar ${t.verzet.tanggalDaftar}.` +
          (jumlah > 1 ? ` Ini perlawanan ke-${jumlah} atas perkara yang sama.` : "") +
          riwayat,
      })
    );
  }

  if (t.rekonvensi) {
    judul.appendChild(
      labelTanda("ada rekonvensi", "kuning", {
        judul:
          `Gugatan balik terdaftar ${t.rekonvensi.tanggalDaftar}. ` +
          "Putusan wajib memuat amar untuk konvensi DAN rekonvensi.",
      })
    );
  }

  if (t.prodeo) {
    judul.appendChild(
      labelTanda("PRODEO", "abu", {
        judul: "Perkara dibebaskan biaya. Tidak boleh ditagih panjar.",
      })
    );
  }
}

/**
 * Menandai baris pihak yang nomornya belum terkonfirmasi atau tidak ada.
 *
 * Pencocokan dilakukan pada teks sel, bukan pada id atau struktur tabel SIPP -
 * struktur itu berbeda antar versi SIPP dan antar jenis perkara, sedangkan
 * namanya tetap. Yang tidak cocok dibiarkan tanpa tanda: lebih baik tidak
 * menandai daripada menandai baris yang salah.
 */
function tandaiPihak(konteks) {
  if (!TANDAI_NOMOR_PIHAK) return;

  // ==========================================================================
  // NILAINYA "terverifikasi", BUKAN "terkonfirmasi"
  // ==========================================================================
  //
  // Sebelumnya dibandingkan dengan "terkonfirmasi" - nilai yang tidak pernah
  // dihasilkan server sama sekali. Akibatnya perbandingannya selalu benar,
  // dan SETIAP pihak ditandai "nomor belum dikonfirmasi" di halaman SIPP,
  // termasuk yang nomornya justru sudah diverifikasi.
  //
  // Salahnya tidak pernah terlihat karena pihak yang sudah terverifikasi
  // memang masih sedikit: penandanya tampak benar hampir sepanjang waktu, dan
  // baru keliru pada perkara yang justru sudah beres.
  const bermasalah = (konteks.nomorPihak || []).filter(
    (o) => !o.adaNomor || o.statusVerifikasi !== "terverifikasi"
  );
  if (bermasalah.length === 0) return;

  const sel = Array.from(document.querySelectorAll("td"));
  if (sel.length === 0) return;

  for (const orang of bermasalah) {
    const cari = samakan(orang.nama);
    if (!cari) continue;

    for (const td of sel) {
      if (td.querySelector(`[${TANDA}]`)) continue;
      if (!samakan(td.textContent).startsWith(cari)) continue;

      const baris = td.closest("tr");
      if (baris) baris.classList.add(SOROT);

      td.appendChild(
        orang.adaNomor
          ? labelTanda("nomor belum dikonfirmasi", "kuning")
          : labelTanda("tidak ada nomor di SIPP", "abu")
      );
      break; // Satu tanda per orang sudah cukup.
    }
  }
}

// ─── Menyisipkan dokumen e-Court ke baris Jadwal Sidang ──────────────────────
//
// ============================================================================
// KENAPA HANYA TANGGAL YANG DIPAKAI
// ============================================================================
//
// Baris Jadwal Sidang di SIPP dan dokumen di e-Court sama-sama punya agenda,
// dan menggodanya besar: "Jawaban Tergugat" ada di keduanya. Tetapi agenda
// adalah teks bebas - SIPP menulis "penyampaian perbaikan gugatan" sementara
// e-Court menulis "Perbaikan Gugatan", dan satu perkara dapat punya dua agenda
// yang bunyinya mirip.
//
// Dokumen yang muncul di baris agenda yang keliru berarti hakim membuka berkas
// yang salah - dan letaknya tampak masuk akal, sehingga tidak ada yang
// menyadarinya. Karena itu pencocokan HANYA memakai tanggal sidang, dan bila
// satu tanggal punya lebih dari satu dokumen, seluruhnya ditampilkan apa adanya
// tanpa menebak mana milik agenda yang mana.
//
// ============================================================================
// HANYA MENAMBAH DI AKHIR SEL
// ============================================================================
//
// Sel yang disisipi memuat tombol "Unggah BAS" - tombol yang mengunggah
// dokumen resmi ke SIPP. Sisipan selalu ditambahkan di AKHIR sel, tidak pernah
// di depan maupun di antara kontrol SIPP, supaya tidak ada tombol yang bergeser
// ke tempat yang tidak diharapkan petugas.

const BULAN_SINGKAT = {
  jan: 0, feb: 1, mar: 2, apr: 3, mei: 4, jun: 5,
  jul: 6, agu: 7, agt: 7, sep: 8, okt: 9, nov: 10, nop: 10, des: 11,
};

/** Membaca "Selasa, 02 Des. 2025" menjadi tanggal. Mengembalikan "" bila gagal. */
function tanggalDariTeksSipp(teks) {
  // Nama bulan diterima singkat maupun lengkap. SIPP memakai keduanya:
  // "02 Des. 2025" pada Jadwal Sidang, "02 Januari 2026" pada Court Calendar.
  const cocok = String(teks || "").match(/(\d{1,2})\s+([A-Za-z]{3,10})\.?\s+(\d{4})/);
  if (!cocok) return "";

  const bulan = BULAN_SINGKAT[cocok[2].slice(0, 3).toLowerCase()];
  if (bulan === undefined) return "";

  const hari = Number(cocok[1]);
  const tahun = Number(cocok[3]);
  if (!hari || !tahun) return "";

  // Dibandingkan sebagai teks YYYY-MM-DD, bukan sebagai objek tanggal. Objek
  // tanggal membawa zona waktu, dan dokumen yang diunggah pukul 23.30 WIB dapat
  // jatuh ke tanggal sebelumnya bila dibandingkan dalam UTC.
  return `${tahun}-${String(bulan + 1).padStart(2, "0")}-${String(hari).padStart(2, "0")}`;
}

/** Tanggal ISO dari dokumen ALETA, dipotong ke hari saja. */
function tanggalDokumen(dokumen) {
  const nilai = dokumen && dokumen.tanggalSidang;
  if (!nilai) return "";
  const teks = String(nilai);
  const cocok = teks.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return cocok ? `${cocok[1]}-${cocok[2]}-${cocok[3]}` : "";
}

/** Sel "Ruang & Data Persidangan" pada satu baris jadwal. */
function selPersidangan(baris) {
  // Dikenali dari isinya, bukan dari urutan kolom: urutan kolom berbeda antar
  // jenis perkara, sedangkan tombol Unggah BAS selalu ada di sel ini.
  for (const sel of Array.from(baris.querySelectorAll("td"))) {
    if (/Unggah BAS|Data Persidangan/i.test(sel.textContent || "")) return sel;
  }
  return null;
}

/** Menyusun kotak sisipan untuk satu baris jadwal. */
function kotakSisipan(dokumenSehari, ambangHari, sebabCocok = "") {
  const kotak = buatElemen("div", "aleta-sisip");
  kotak.setAttribute(TANDA, "1");

  // Bertanda ALETA secara terlihat. Tanpa ini, tautan di dalam tabel SIPP
  // terbaca sebagai bagian SIPP - dan petugas mengira berkasnya berasal dari
  // sistem resmi.
  //
  // Sebab pencocokannya ikut disebut. Berkas yang menempel karena AGENDA-nya
  // memang menunggunya berbeda derajat kepastiannya dari berkas yang menempel
  // karena kebetulan bertanggal sama, dan yang membacanya berhak tahu yang
  // mana - sebelum mengunduh dan memakainya.
  kotak.appendChild(
    buatElemen("div", "aleta-sisip-judul", sebabCocok ? `ALETA · e-Court · ${sebabCocok}` : "ALETA · e-Court")
  );

  for (const dokumen of dokumenSehari) {
    const baris = buatElemen("div", "aleta-sisip-baris");

    const judul = buatElemen("span", "aleta-sisip-nama", dokumen.judulDokumen || dokumen.jenisDokumen || "Dokumen");
    baris.appendChild(judul);

    if (dokumen.adaPdf) baris.appendChild(tombolUnduh(dokumen, "pdf", "PDF"));
    if (dokumen.adaWord) baris.appendChild(tombolUnduh(dokumen, "word", "Word"));

    // Tenggat unggah ikut ditampilkan di baris yang sama - inilah keterangan
    // yang tidak dimiliki SIPP sama sekali.
    if (dokumen.sisaHari !== null && dokumen.sisaHari !== undefined) {
      const ket = keteranganSisa(dokumen.sisaHari, ambangHari);
      if (ket && ket.teks) {
        baris.appendChild(buatElemen("span", `aleta-tanda aleta-tanda-${ket.warna}`, ket.teks));
      }
    }

    const menungguMajelis =
      typeof ktnDokumenMenungguMajelis === "function"
        ? ktnDokumenMenungguMajelis(dokumen, typeof cariNomorPerkara === "function" ? cariNomorPerkara() : "")
        : dokumen.statusVerifikasi === "belum";
    if (menungguMajelis) {
      baris.appendChild(buatElemen("span", "aleta-tanda aleta-tanda-kuning", "menunggu majelis"));
    } else if (dokumen.statusVerifikasi === "valid") {
      baris.appendChild(buatElemen("span", "aleta-tanda aleta-tanda-hijau", "sudah diverifikasi"));
    }

    kotak.appendChild(baris);
  }

  return kotak;
}

/**
 * Menyisipkan dokumen e-Court ke tiap baris Jadwal Sidang yang tanggalnya cocok.
 *
 * Baris yang tidak punya dokumen dibiarkan apa adanya - menambahkan "tidak ada
 * dokumen" di setiap baris hanya menambah keramaian tanpa menambah pengetahuan.
 */
/**
 * ============================================================================
 * TAHAPAN e-LITIGASI, DAN BERKAS YANG MENJADI MILIKNYA
 * ============================================================================
 *
 * Tiap tahapan e-Litigasi punya satu jenis berkas yang menjadi miliknya:
 * agenda Jawaban menunggu berkas jawaban, agenda Replik menunggu replik. Yang
 * membuka baris agenda Jawaban di SIPP sedang mencari jawabannya - bukan
 * seluruh berkas yang kebetulan bertanggal sama.
 *
 * Urutannya menentukan: "duplik rekonvensi" diperiksa SEBELUM "duplik", sebab
 * yang belakangan juga cocok dengan yang pertama dan akan merebutnya.
 */
/**
 * ============================================================================
 * URUTANNYA MENENTUKAN, DAN YANG BERAWALAN REKONVENSI HARUS DI DEPAN
 * ============================================================================
 *
 * Daftar ini dibaca berurutan dan yang PERTAMA cocok yang dipakai. "Duplik
 * Rekonvensi" juga cocok dengan pola /\bduplik\b/, jadi ia harus lebih dulu -
 * kalau tidak, berkas duplik konvensi dan rekonvensi tertukar, dan
 * tertukarnya tidak berbunyi apa pun: kotaknya tetap terisi, isinya saja yang
 * milik tahapan lain.
 *
 * Tiga baris rekonvensi ditambahkan 22 September 2026 atas permintaan
 * pengguna, yang menyebut "jawaban, replik, duplik, duplik rekonvensi,
 * kesimpulan, fotokopi alat bukti dan lainnya".
 */
const TAHAPAN_BERKAS = [
  { agenda: /duplik\s+rekonvensi/i, berkas: /duplik\s+rekonvensi/i },
  { agenda: /jawaban\s+rekonvensi/i, berkas: /jawaban\s+rekonvensi/i },
  { agenda: /replik\s+rekonvensi/i, berkas: /replik\s+rekonvensi/i },
  { agenda: /kesimpulan\s+rekonvensi/i, berkas: /kesimpulan\s+rekonvensi/i },
  { agenda: /\bjawaban\b/i, berkas: /\bjawaban\b/i },
  { agenda: /\breplik\b/i, berkas: /\breplik\b/i },
  { agenda: /\bduplik\b/i, berkas: /\bduplik\b/i },
  { agenda: /\bkesimpulan\b/i, berkas: /\bkesimpulan\b/i },
  // "fotokopi alat bukti" dan "bukti surat" sama-sama tertangkap /bukti/.
  { agenda: /pembuktian|bukti/i, berkas: /bukti|pembuktian/i },
  { agenda: /gugatan|permohonan/i, berkas: /gugatan|permohonan/i },
];

/** Sebutan berkas - judul lebih dulu, lalu jenisnya. */
function sebutanDokumen(dokumen) {
  return `${dokumen.judulDokumen || ""} ${dokumen.jenisDokumen || ""}`.trim();
}

/**
 * Berkas yang menjadi milik agenda ini.
 *
 * Mengembalikan daftar kosong bila agendanya bukan tahapan pertukaran berkas -
 * dan itu bukan kegagalan: agenda "Panggil Tergugat" memang tidak menunggu
 * berkas apa pun, dan menempelkan berkas di sana hanya menambah kotak yang
 * harus dilewati mata.
 */
function berkasUntukAgenda(agendaTeks, dokumen) {
  const teks = String(agendaTeks || "");
  if (!teks) return [];

  const tahapan = TAHAPAN_BERKAS.find((x) => x.agenda.test(teks));
  if (!tahapan) return [];

  return dokumen.filter((d) => tahapan.berkas.test(sebutanDokumen(d)));
}

function sisipkanKeJadwalSidang(konteks) {
  const dokumen = Array.isArray(konteks.dokumen) ? konteks.dokumen : [];
  if (dokumen.length === 0) return;

  // Dikelompokkan per tanggal lebih dulu.
  const perTanggal = new Map();
  for (const d of dokumen) {
    const tanggal = tanggalDokumen(d);
    if (!tanggal) continue; // tanpa tanggal sidang: tidak dapat dicocokkan
    const daftar = perTanggal.get(tanggal) || [];
    daftar.push(d);
    perTanggal.set(tanggal, daftar);
  }

  const ambang = Number(konteks.ambangMendesakHari) || 3;

  for (const baris of Array.from(document.querySelectorAll("tr"))) {
    const sel = selPersidangan(baris);
    if (!sel) continue;
    if (sel.querySelector(`[${TANDA}]`)) continue; // sudah disisipi

    // ======================================================================
    // TANGGAL LEBIH DULU, KATA SEBAGAI CADANGAN
    // ======================================================================
    //
    // Urutannya pernah dibalik dua kali, dan keduanya benar pada zamannya.
    //
    // Mula-mula HANYA tanggal. Lalu agenda didahulukan - sebab waktu itu tiap
    // dokumen menerima tanggal yang sama (agenda terakhir perkara ditempelkan
    // ke seluruh dokumennya, dan tanggal sidangnya tidak pernah terisi sama
    // sekali), sehingga baris beragenda Jawaban kebanjiran replik dan duplik
    // yang kebetulan setanggal.
    //
    // Sejak 23 September 2026 dasarnya berubah: tiap dokumen membawa tanggal
    // sidang BLOKNYA SENDIRI, dibaca dari kepala blok agenda di halaman
    // e-Court ("Silahkan Mengupload Berkas Persidangan Sebelum : <tanggal>
    // Pukul : <jam>"). Tanggal itu tidak lagi kebetulan - ia keterangan
    // e-Court sendiri tentang sidang mana yang menunggu berkas itu.
    //
    // Karena itu tanggal kembali didahulukan, dan kali ini alasannya terukur:
    // pencocokan dari kata-kata GAGAL memisahkan pada 15,6% pasangan
    // (perkara, kata-tahapan) - 304 dari 1.947 pasangan punya lebih dari satu
    // baris sidang berkata sama, dan berkas yang sama menempel di semuanya.
    // Perkara 1396 punya tujuh baris beragenda "bukti".
    //
    // Kata TETAP dipakai sebagai cadangan: dokumen lama yang tersimpan
    // sebelum perbaikan masih bertanggal kosong, dan tanpa cadangan ini
    // seluruh sisipannya lenyap sekaligus.
    const tanggal = tanggalDariTeksSipp(baris.textContent);
    const cocokTanggal = tanggal ? perTanggal.get(tanggal) : null;
    if (cocokTanggal && cocokTanggal.length > 0) {
      sel.appendChild(kotakSisipan(cocokTanggal, ambang, "cocok tanggal sidang"));
      continue;
    }

    const cocokAgenda = berkasUntukAgenda(baris.textContent, dokumen);
    if (cocokAgenda.length === 0) continue;

    sel.appendChild(kotakSisipan(cocokAgenda, ambang, "cocok agenda"));
  }
}

async function terapkanTanda(konteks) {
  bersihkanTanda();

  // Dua saklar yang BERDIRI SENDIRI. Petugas boleh menyisipkan berkas ke
  // Jadwal Sidang tanpa menandai halaman, atau sebaliknya - memaksa yang
  // satu menuntut yang lain hanya membuat salah satunya tidak terpakai.
  const menandai = await sedangMenandai();
  const menyisipkan = await sedangMenyisipkan();
  if (!menandai && !menyisipkan) return;

  try {
    // Seluruh penulisan dikerjakan dengan pengamat dilepas - lihat catatan
    // pada tanpaPengamat. Penanda dan sisipan menyentuh puluhan sel tabel,
    // dan tiap sentuhan dulu menjadwalkan penyegaran berikutnya.
    tanpaPengamat(() => {
      if (menandai) {
        tandaiJudul(konteks);
        tandaiPihak(konteks);
      }
      if (menyisipkan) sisipkanKeJadwalSidang(konteks);
    });
  } catch {
    // Struktur halaman SIPP di luar dugaan. Tanda dibatalkan seluruhnya supaya
    // tidak ada sisa setengah jadi yang membingungkan.
    bersihkanTanda();
  }
}

// ─── Penanda baris pada halaman Daftar Perkara ───────────────────────────────
//
// Halaman daftar memuat sampai 50 perkara. Tanpa penanda, petugas harus membuka
// satu per satu untuk tahu mana yang perlu perhatian - dan itu berarti puluhan
// halaman SIPP dibuka hanya untuk menemukan bahwa tidak ada apa-apa.
//
// Ringkasannya diminta SEKALI untuk seluruh baris, bukan satu permintaan per
// perkara. Lima puluh permintaan sekaligus dari satu halaman membebani bot dan
// SIPP tanpa alasan.
//
// Yang ditandai hanya ANGKA - berapa dokumen menunggu majelis, berapa tenggat
// mendesak. Tidak ada nama pihak, tidak ada nomor telepon: halaman daftar
// terlihat siapa saja yang lewat di belakang layar.

const POLA_PERKARA_BARIS = /\b(\d{1,5}\/[A-Za-z]{1,10}(?:\.[A-Za-z]{1,4}){0,2}\/\d{4}\/[A-Za-z]{2,4}\.[A-Za-z]{2,6})\b/;

/**
 * Sel yang benar-benar memuat nomor perkaranya.
 *
 * Dicari, bukan dipatok pada kolom kedua: susunan kolom SIPP berbeda antar
 * halaman daftar - perdata gugatan, permohonan, dan jinayat tidak sama - dan
 * kolom kedua pada salah satunya adalah tanggal register.
 */
function cariSelNomorPerkara(semuaSel, nomor) {
  for (const sel of semuaSel) {
    if (String(sel.textContent || "").includes(nomor)) return sel;
  }
  return null;
}

/** Mengumpulkan baris tabel yang memuat nomor perkara. */
function barisPerkaraDiHalaman() {
  const hasil = [];
  const terlihat = new Set();

  for (const baris of Array.from(document.querySelectorAll("tr"))) {
    if (baris.querySelector(`[${TANDA}]`)) continue;

    // ======================================================================
    // DICOCOKKAN PER SEL, BUKAN ATAS SELURUH BARISNYA
    // ======================================================================
    //
    // textContent satu baris tabel menyambung isi tiap selnya TANPA pemisah
    // apa pun - berbeda dari innerText, yang menyisipkannya. Sel kolom "No"
    // berisi "1", sel berikutnya "564/Pdt.G/2026/PA.Dgl", dan keduanya
    // terbaca sebagai satu untai "1564/Pdt.G/2026/PA.Dgl".
    //
    // Lalu \d{1,5} di depan polanya menelan angka urut itu sebagai bagian
    // nomor perkaranya, dan yang dipulangkan nomor perkara yang tidak pernah
    // ada. Akibatnya diam: penandanya tidak menemukan selnya sehingga tidak
    // tertempel, dan ringkasan massalnya menanyakan perkara yang tidak ada
    // sehingga menjawab kosong - halaman penuh perkara terbaca sebagai
    // "tidak ada yang berkeadaan khusus".
    //
    // innerText memang memisahkannya, tetapi ia menuntut peramban menghitung
    // tata letak tiap baris; pada tabel berisi lima puluh baris itu terasa.
    // Menyapu selnya sendiri lebih murah DAN lebih tepat.
    let nomor = "";
    for (const sel of baris.cells ? Array.from(baris.cells) : []) {
      const cocokSel = String(sel.textContent || "").match(POLA_PERKARA_BARIS);
      if (cocokSel) {
        nomor = cocokSel[1];
        break;
      }
    }
    if (!nomor) continue;
    if (terlihat.has(nomor)) continue;
    terlihat.add(nomor);
    hasil.push({ nomor, baris });
  }
  return hasil;
}

/** Menempelkan penanda ringkas pada satu baris daftar. */
function tempelPenandaBaris(baris, nomor, ringkas, identitas) {
  // ==========================================================================
  // DITEMPEL DI KOLOM NOMOR PERKARA, BUKAN DI KOLOM "NO"
  // ==========================================================================
  //
  // Sebelumnya penandanya masuk ke sel PERTAMA - kolom nomor urut, selebar dua
  // angka. Penanda selebar "PIHAK GHAIB" di dalam kolom selebar "322" akan
  // meluber atau terpotong, dan pada halaman selebar lima puluh baris ia
  // menjadi kolom yang paling ramai sekaligus paling tidak terbaca.
  //
  // Yang benar kolom nomor perkara: di situlah mata berhenti ketika memindai
  // daftar, dan di situ pula sudah ada tulisan (e-Court) sehingga penanda
  // tambahan terbaca sebagai keterangan perkara itu - bukan sebagai hiasan
  // pada nomor urut.
  const semuaSel = baris.querySelectorAll("td");
  const sel = cariSelNomorPerkara(semuaSel, nomor) || semuaSel[1] || semuaSel[0];
  if (!sel) return;

  // ==========================================================================
  // DI BARIS SENDIRI DI BAWAH NOMORNYA, BUKAN MENYAMBUNG DI BELAKANGNYA
  // ==========================================================================
  //
  // Menempel langsung ke sel membuat penandanya menyambung di belakang nomor
  // perkara pada baris yang sama - dan nomor perkara sendiri sudah panjang
  // ("399/Pdt.G/2026/PA.Dgl" ditambah keterangan e-Court). Dua penanda saja
  // sudah melebarkan kolomnya dan mendorong seluruh tabel ke kanan.
  //
  // Wadahnya dibuat hanya bila ada yang digambar: baris kosong setinggi tiga
  // piksel pada lima puluh baris daftar adalah tabel yang jadi lebih panjang
  // tanpa satu keterangan pun bertambah.
  let wadah = null;
  const taruh = (elemen) => {
    if (!wadah) {
      wadah = buatElemen("div", "aleta-tanda-baris");
      wadah.setAttribute(TANDA, "1");
      sel.appendChild(wadah);
    }
    wadah.appendChild(elemen);
  };

  // ==========================================================================
  // IDENTITAS PERKARA LEBIH DAHULU - INILAH YANG DICARI DI HALAMAN DAFTAR
  // ==========================================================================
  //
  // Kelimanya keadaan yang mengubah cara perkara ditangani, dan tidak satu pun
  // tampil di kolom mana pun halaman daftar SIPP. Justru di sinilah penanda
  // paling berharga: pada halaman detail panel ALETA sudah terbuka di
  // sebelahnya, sedangkan di sini petugas memindai lima puluh baris sekaligus.
  if (identitas) {
    if (identitas.ghaib) {
      taruh(
        labelTanda("GHAIB", "merah", {
          judul: "Pihak ghaib - panggilan lewat pengumuman, tenggat 120 atau 180 hari.",
        })
      );
    }
    if (identitas.izinAtasan) {
      taruh(
        labelTanda("izin atasan", "kuning", {
          judul: "Pihak PNS, TNI, atau Polri - persidangan menunggu izin atasannya.",
        })
      );
    }
    if (identitas.verzet) {
      taruh(
        labelTanda("verzet", "kuning", { judul: "Perlawanan atas putusan verstek." })
      );
    }
    if (identitas.prodeo) {
      taruh(
        labelTanda("prodeo", "abu", { judul: "Dibebaskan biaya - tidak boleh ditagih panjar." })
      );
    }
    if (identitas.kuasa) {
      taruh(
        labelTanda("kuasa", "abu", { judul: "Perkara ini memakai kuasa hukum." })
      );
    }
  }

  // ==========================================================================
  // "BELUM DITARIK ALETA" DIBUANG
  // ==========================================================================
  //
  // Ia menempel pada hampir SETIAP baris - halaman daftar memuat lima puluh
  // perkara dan sebagian besar memang belum pernah ditarik dari e-Court. Yang
  // dikabarkannya pun bukan tentang perkaranya, melainkan tentang keadaan
  // ALETA sendiri: petugas tidak dapat berbuat apa pun dengannya, dan penanda
  // yang tidak dapat ditindaklanjuti mengajari orang melewati seluruh penanda.
  //
  // Keterangannya tidak hilang - ia tetap ada di panel perkara itu, tempat
  // tombol Tarik memang tersedia.
  if (ringkas === null) return;

  // ==========================================================================
  // ENAM SINYAL DATANG, EMPAT YANG DIGAMBAR
  // ==========================================================================
  //
  // Ringkasan massal membawa enam angka; penanda ini dulu hanya menggambar
  // empat. Dua yang dibuang justru dua yang paling menjawab "kenapa penanda
  // ini ada sama sekali" - sebab keduanya TIDAK ADA di layar SIPP mana pun:
  //
  //   nomorBermasalah   nomor pihak yang belum terverifikasi. SIPP menyimpan
  //                     nomornya, tetapi tidak pernah tahu nomor itu benar
  //                     milik orangnya - dan panggilan lewat WhatsApp ke nomor
  //                     yang salah adalah panggilan yang tidak pernah sampai.
  //   selisihGenting    catatan ALETA berbeda dari keadaan di e-Court. Yang
  //                     satu bilang berkasnya sudah masuk, yang lain tidak -
  //                     dan tidak ada satu layar pun yang menyandingkannya.
  //
  // Keduanya kini digambar lebih dulu, sebelum tenggat: yang menuntut
  // pemeriksaan orang didahulukan atas yang menuntut penjadwalan.
  if (TANDAI_NOMOR_PIHAK && ringkas.nomorBermasalah > 0) {
    taruh(
      labelTanda(`${ringkas.nomorBermasalah} nomor bermasalah`, "merah", {
        judul:
          "Nomor pihak yang belum terverifikasi. Pemberitahuan WhatsApp ke nomor ini belum tentu sampai kepada orangnya.",
      })
    );
  }
  if (ringkas.selisihGenting > 0) {
    taruh(
      labelTanda(`${ringkas.selisihGenting} selisih e-Court`, "merah", {
        judul:
          "Catatan ALETA berbeda dari keadaan di e-Court untuk perkara ini. Perlu disandingkan sebelum dipakai.",
      })
    );
  }

  if (ringkas.tenggatLewat > 0) {
    taruh(
      labelTanda(`${ringkas.tenggatLewat} tenggat lewat`, "merah", {
        judul: "Berkas e-Court yang batas unggahnya sudah terlampaui.",
      })
    );
  }
  if (ringkas.tenggatMendesak > 0) {
    taruh(
      labelTanda(`${ringkas.tenggatMendesak} mendesak`, "kuning", {
        judul: "Berkas e-Court yang batas unggahnya tinggal beberapa hari lagi.",
      })
    );
  }
  if (ringkas.menungguVerifikasi > 0) {
    taruh(
      labelTanda(`${ringkas.menungguVerifikasi} menunggu majelis`, "kuning", {
        judul:
          "Berkas sudah diunggah pihak tetapi belum diverifikasi majelis, sehingga belum dapat diberitahukan ke pihak lawan.",
      })
    );
  }

  // Hijau hanya bila TIDAK ADA satu pun yang menuntut tindakan - termasuk dua
  // sinyal baru di atas. Menandai perkara hijau sementara nomornya bermasalah
  // adalah kabar baik yang keliru, dan kabar baik yang keliru lebih merugikan
  // daripada tidak ada kabar.
  if (
    ringkas.dokumen > 0 &&
    ringkas.tenggatLewat === 0 &&
    ringkas.tenggatMendesak === 0 &&
    ringkas.menungguVerifikasi === 0 &&
    ringkas.nomorBermasalah === 0 &&
    ringkas.selisihGenting === 0
  ) {
    taruh(
      labelTanda(`${ringkas.dokumen} dokumen`, "hijau", {
        judul: "Berkas e-Court perkara ini lengkap dan tidak ada yang menunggu tindakan.",
      })
    );
  }
}

let nomorDaftarTerakhir = "";
let ringkasanDaftarTerakhir = null;

/** Menandai seluruh baris pada halaman daftar. */
async function tandaiHalamanDaftar() {
  const baris = barisPerkaraDiHalaman();
  if (baris.length < 2) return null; // bukan halaman daftar
  /** nomor perkara -> { pmh, ppp, pjs, phs } sebagaimana ada di SIPP. */
  const penetapanPer = {};

  if (!(await sedangMenandai())) {
    // Penandanya mati, tetapi ini TETAP halaman daftar - panel ringkas di
    // sisi kanan tetap digambar, dengan keterangan kenapa barisnya polos.
    return { jumlah: baris.length, ditandai: false, bertanda: 0, sebab: {} };
  }

  // Halaman yang sama tidak diminta ulang setiap DOM berubah sedikit.
  const sidik = baris.map((x) => x.nomor).join("|");
  if (sidik === nomorDaftarTerakhir) return ringkasanDaftarTerakhir;
  nomorDaftarTerakhir = sidik;

  try {
    const respons = await fetch(ALETA_API_MASSAL, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nomorPerkara: baris.map((x) => x.nomor) }),
    });
    if (!respons.ok) return null;

    const hasil = await respons.json();
    const isi = hasil?.data ?? hasil;
    if (!isi?.available || !isi?.perkara) return null;

    const sebab = {};
    let bertanda = 0;
    tanpaPengamat(() => {
      for (const item of baris) {
        if (!(item.nomor in isi.perkara)) continue;
        const identitas = (isi.identitas || {})[item.nomor] || null;
        // Keempat penetapan awal, apa adanya dari SIPP. Dipakai panel
        // penetapan massal untuk menawarkan hanya yang masih dapat
        // dikerjakan - lihat bagianPenetapanMassal.
        if (identitas && identitas.penetapan) penetapanPer[item.nomor] = identitas.penetapan;
        tempelPenandaBaris(item.baris, item.nomor, isi.perkara[item.nomor], identitas);
        // Dihitung untuk panel ringkas. Yang dihitung KEADAAN perkaranya, bukan
        // jumlah lencananya: satu perkara yang ghaib sekaligus prodeo tetap
        // satu perkara yang perlu diperiksa.
        let punya = false;
        for (const [kunci, nyala] of Object.entries(identitas || {})) {
          if (nyala !== true) continue;
          sebab[kunci] = (sebab[kunci] || 0) + 1;
          punya = true;
        }
        if (punya) bertanda += 1;
      }
    });

    ringkasanDaftarTerakhir = { jumlah: baris.length, ditandai: true, bertanda, sebab, penetapan: penetapanPer };
    return ringkasanDaftarTerakhir;
  } catch {
    // Halaman daftar tetap berjalan seperti biasa bila ALETA tidak terjangkau.
    return null;
  }
}

// ─── Meneruskan permintaan penarikan ─────────────────────────────────────────
//
// Perkara yang belum pernah ditarik ALETA tidak dapat ditampilkan apa pun.
// Alih-alih panel kosong tanpa jalan keluar, petugas dapat meneruskan
// permintaan - dikerjakan penjadwal di putaran berikutnya, bukan saat itu juga.
//
// Menariknya seketika berarti petugas menunggu satu sampai tiga menit di depan
// layar: alamat e-Court buram, jadi daftar harus disapu lebih dulu sebelum
// halaman perkaranya dapat ditemukan.

function kotakPermintaan(nomorPerkara, keadaanAwal) {
  const kotak = buatElemen("div", "aleta-permintaan");

  const pesan = buatElemen("div", "aleta-permintaan-pesan");
  const tombol = buatElemen("button", "aleta-permintaan-tombol", "Tarik dari e-Court");
  tombol.type = "button";
  // Butir 8 (1.189.x): garis proses + persen dari tahap NYATA jembatan
  // (keadaan.kemajuan, dilaporkan bot selama permintaan dikerjakan).
  const garis = buatElemen("div", "aleta-b8-garis");
  garis.setAttribute("role", "progressbar");
  garis.setAttribute("aria-valuemin", "0");
  garis.setAttribute("aria-valuemax", "100");
  garis.style.cssText = "display:none;height:6px;border-radius:3px;background:rgba(127,127,127,.25);overflow:hidden;margin:4px 0;";
  const isiGaris = buatElemen("div", "aleta-b8-garis-isi");
  isiGaris.style.cssText = "height:100%;width:0;background:#0284c7;transition:width .5s;";
  garis.appendChild(isiGaris);
  let pewaktuTanya = null;
  let mulaiTanya = 0;

  function gambarKemajuan(k) {
    if (!k || !Number.isFinite(Number(k.persen))) {
      garis.style.display = "none";
      return "";
    }
    const persen = Math.max(0, Math.min(100, Math.round(Number(k.persen))));
    garis.style.display = "";
    garis.setAttribute("aria-valuenow", String(persen));
    isiGaris.style.width = `${persen}%`;
    return `${persen}% · ${k.teks || k.label || "Menarik dari e-Court"}`;
  }

  /** Tanya keadaan berkala selama diantrekan/dikerjakan (paling lama 10 menit). */
  function tanyaBerkala() {
    if (pewaktuTanya) return;
    if (!mulaiTanya) mulaiTanya = Date.now();
    const sekali = async () => {
      pewaktuTanya = null;
      if (Date.now() - mulaiTanya > 10 * 60 * 1000) return;
      if (!kotak.isConnected) {
        // Kotak baru disisipkan sesudah keadaannya terbaca - beri waktu.
        if (Date.now() - mulaiTanya < 15000) tanyaBerkala();
        return;
      }
      try {
        const respons = await alatAmbil(
          `${ALETA_API_PERMINTAAN}?nomor=${encodeURIComponent(nomorPerkara)}`,
          { credentials: "include", cache: "no-store" },
          "Membaca kemajuan penarikan"
        );
        const hasil = respons.ok ? await respons.json() : null;
        const isi = hasil?.data ?? hasil;
        if (isi && isi.available !== false) tampilkanKeadaan(isi.keadaan ?? null);
      } catch {
        // Tidak terbaca sekali - ditanya lagi pada detak berikutnya.
      }
    };
    pewaktuTanya = setTimeout(sekali, 3000);
  }

  function tampilkanKeadaan(keadaan) {
    if (!keadaan) {
      pesan.textContent = "Perkara ini belum pernah ditarik ALETA.";
      tombol.style.display = "";
      gambarKemajuan(null);
      return;
    }
    if (keadaan.status === "menunggu" || keadaan.status === "dikerjakan") {
      const nyata = keadaan.status === "dikerjakan" ? gambarKemajuan(keadaan.kemajuan) : gambarKemajuan(null);
      pesan.textContent =
        keadaan.status === "dikerjakan"
          ? nyata || "Sedang ditarik dari e-Court..."
          : "Sudah diantrekan. Akan ditarik pada putaran berikutnya.";
      tombol.style.display = "none";
      tanyaBerkala();
      return;
    }
    gambarKemajuan(null);
    if (keadaan.status === "gagal") {
      pesan.textContent = `Penarikan terakhir gagal${keadaan.catatan ? `: ${keadaan.catatan}` : "."}`;
      tombol.style.display = "";
      return;
    }
    pesan.textContent = "Penarikan terakhir sudah selesai. Muat ulang halaman untuk melihat hasilnya.";
    tombol.style.display = "none";
  }

  tombol.addEventListener("click", async () => {
    tombol.disabled = true;
    pesan.textContent = "Meneruskan permintaan...";
    try {
      const respons = await alatAmbil(
        ALETA_API_PERMINTAAN,
        {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nomorPerkara }),
        },
        "Meneruskan permintaan penarikan"
      );
      const hasil = await respons.json();
      const isi = hasil?.data ?? hasil;

      if (isi?.ok) {
        tampilkanKeadaan({ status: "menunggu" });
      } else {
        // Penolakan disampaikan apa adanya. "Baru saja ditarik" bukan
        // kegagalan - itu penjagaan yang bekerja, dan petugas berhak tahu
        // bedanya dari galat.
        pesan.textContent = ALASAN_PERMINTAAN[isi?.alasan] || `Tidak dapat diantrekan (${isi?.alasan || "tidak diketahui"}).`;
        tombol.disabled = false;
      }
    } catch {
      pesan.textContent = "ALETA tidak dapat dihubungi.";
      tombol.disabled = false;
    }
  });

  kotak.appendChild(pesan);
  kotak.appendChild(garis);
  kotak.appendChild(tombol);
  tampilkanKeadaan(keadaanAwal);
  return kotak;
}

const ALASAN_PERMINTAAN = {
  baru_saja_ditarik: "Perkara ini baru saja ditarik. Coba lagi nanti.",
  antrean_penuh: "Antrean penarikan sedang penuh. Coba lagi beberapa saat lagi.",
  sudah_diantrekan: "Sudah diantrekan sebelumnya.",
  nomor_perkara_kosong: "Nomor perkara tidak terbaca.",
  database_bot_tidak_siap: "Database ALETA Bot belum siap.",
};

/**
 * Menyisipkan kotak permintaan ke panel, setelah keadaannya diketahui.
 *
 * Keadaan dibaca lebih dulu supaya tombol tidak ditawarkan pada perkara yang
 * permintaannya sudah mengantre - petugas yang menekannya dua kali tidak
 * menghasilkan dua penarikan, tetapi juga tidak perlu dibuat bingung.
 */
async function sisipkanPermintaan(panel, nomorPerkara) {
  // Audit hak 23 Okt 2026: "Tarik dari e-Court" menitip permintaan (kemampuan
  // "permintaan", rute aleta-bot/ecourt/permintaan menolak 403 tanpanya) - sama
  // dengan tombol di tarik-satu-perkara.js. Peran yang pasti tidak diberi tidak
  // ditawari tombolnya; belum terbaca tetap ditawari (aturan boleh()).
  if (boleh("permintaan") === false) return;
  let keadaan = null;
  try {
    const respons = await fetch(
      `${ALETA_API_PERMINTAAN}?nomor=${encodeURIComponent(nomorPerkara)}`,
      { credentials: "include", cache: "no-store" }
    );
    if (respons.ok) {
      const hasil = await respons.json();
      const isi = hasil?.data ?? hasil;
      keadaan = isi?.keadaan ?? null;
    }
  } catch {
    keadaan = null;
  }

  const isiPanel = panel.querySelector(".aleta-isi");
  if (!isiPanel) return;
  isiPanel.appendChild(kotakPermintaan(nomorPerkara, keadaan));
}

/**
 * ============================================================================
 * PINTASAN PAPAN TIK
 * ============================================================================
 *
 * Segalanya di panel menuntut tetikus. Bagi yang mengerjakan puluhan perkara
 * berturut-turut, perjalanan tangan dari papan tik ke tetikus dan kembali
 * itu bagian yang paling lambat dari seluruh pekerjaan - lebih lambat
 * daripada ALETA-nya sendiri.
 *
 * Empat pintasan, dan seluruhnya memakai Alt:
 *
 *   Alt+A      ciutkan / bentangkan panel
 *   Alt+P      buka kelompok Penetapan dan bawa ke layar
 *   Alt+R      buka Riwayat ALETA
 *   Alt+Enter  tekan tombol Tetapkan
 *
 * ============================================================================
 * KENAPA ALT, DAN KENAPA TIDAK MENGAMBIL ALIH APA PUN
 * ============================================================================
 *
 * SIPP tidak memakai satu pun accesskey (diperiksa atas seluruh view-nya)
 * dan halaman detail perkaranya tidak memasang pendengar papan tik sama
 * sekali, jadi Alt+huruf memang kosong di sana. Sekalipun begitu:
 *
 *   - pintasan DIABAIKAN ketika kursor sedang di kolom isian, textarea,
 *     select, atau elemen contenteditable - termasuk CKEditor SIPP. Petugas
 *     yang sedang mengetik posita tidak sedang meminta panel ditutup.
 *   - preventDefault HANYA dipanggil ketika pintasannya benar-benar
 *     dikenali. Tombol yang tidak dikenali diteruskan apa adanya ke SIPP.
 *   - Alt+Enter TIDAK menetapkan seketika. Ia menekan tombolnya, dan tombol
 *     itu tetap meminta tekanan kedua seperti biasa - pengesahan tidak
 *     boleh hilang hanya karena jalannya lebih pendek.
 */
const PINTASAN_PANEL = [
  { tombol: "Alt+A", nama: "ciutkan / bentangkan panel" },
  { tombol: "Alt+P", nama: "buka Penetapan" },
  { tombol: "Alt+R", nama: "buka Riwayat ALETA" },
  { tombol: "Alt+Enter", nama: "tekan Tetapkan" },
];

/** Sedang mengetik di suatu tempat - pintasan tidak boleh menyela. */
function sedangMengetik(sasaran) {
  const simpul = sasaran instanceof Element ? sasaran : null;
  if (!simpul) return false;
  if (simpul.isContentEditable) return true;
  return Boolean(simpul.closest("input, textarea, select, [contenteditable=\"true\"]"));
}

/** Membuka satu kelompok atau bagian menurut kuncinya, lalu membawanya ke layar. */
function bukaBagianPanel(panel, kunci) {
  const kotak = panel.querySelector(`[data-kunci="${kunci}"]`);
  if (!kotak) return false;
  const kepala = kotak.querySelector(".aleta-kelompok-judul, .aleta-bagian-judul");
  const isi = kotak.querySelector(".aleta-kelompok-isi, .aleta-bagian-isi");
  if (!kepala || !isi) return false;
  // Ditekan HANYA bila sedang terlipat. Menekan yang sudah terbuka akan
  // menutupnya - dan yang menekan Alt+P sedang meminta membukanya.
  if (isi.style.display === "none") kepala.click();
  if (typeof kotak.scrollIntoView === "function") {
    kotak.scrollIntoView({ block: "nearest" });
  }
  return true;
}

function pintasanPapanTik(peristiwa) {
  if (!peristiwa.altKey || peristiwa.ctrlKey || peristiwa.metaKey) return;
  if (sedangMengetik(peristiwa.target)) return;

  const panel = document.getElementById(PENANDA);
  if (!panel) return;

  const tombol = String(peristiwa.key || "").toLowerCase();

  if (tombol === "a") {
    peristiwa.preventDefault();
    ciutkanKeLencana(panel);
    return;
  }

  // Sisanya menuntut panel yang terbentang - bagian yang dicari memang tidak
  // terlihat pada lencana. Panelnya dibentangkan dahulu, lalu dikerjakan.
  if (tombol === "p" || tombol === "r") {
    peristiwa.preventDefault();
    ciutkanKeLencana(panel, false);
    bukaBagianPanel(panel, tombol === "p" ? "kerjakan" : "riwayatAleta");
    return;
  }

  if (peristiwa.key === "Enter") {
    const tetapkan = panel.querySelector(".aleta-tombol-tetapkan");
    if (!tetapkan || tetapkan.disabled) return;
    peristiwa.preventDefault();
    ciutkanKeLencana(panel, false);
    bukaBagianPanel(panel, "kerjakan");
    tetapkan.click();
  }
}

// Pada fase TANGKAP, supaya pintasan tetap sampai walau halaman SIPP kelak
// memasang pendengarnya sendiri dan menghentikan gelembungnya.
document.addEventListener("keydown", pintasanPapanTik, true);

// Perhatian kembali ke tab ini: yang tertunda selagi tersembunyi dikerjakan
// sekarang. Tanpa ini, tab yang dibuka di latar belakang tetap kosong sampai
// halamannya berubah dengan sendirinya - dan pada halaman perkara yang diam,
// itu berarti selamanya.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (!tertundaKarenaTersembunyi) return;
  void segarkan();
});

/**
 * Kabar perubahan data SIPP (A8 / U17, 25 Okt 2026).
 *
 * Halaman perkara SIPP tidak menyegarkan dirinya. Selama panel ini terlihat, tiap
 * 30 detik (hanya saat tab terlihat) ia menanyakan ke portal apakah Cermin Perkara
 * mencatat perubahan data perkara ini SESUDAH keadaan yang dibaca petugas. Bila ya,
 * pita di puncak panel memberi kabar bersama pukul perubahannya dan tombol
 * "Muat ulang halaman". Yang dikabarkan hanya BAGIAN yang berubah dan pukulnya -
 * cermin tidak menyimpan siapa yang mengubah, jadi tidak ada nama petugas.
 *
 * Diam sepenuhnya bila saklarnya mati, cermin tertinggal, atau portal tidak menjawab
 * (tanpa pita, tanpa galat). Hanya membaca; tidak menulis ke SIPP.
 */
const JEDA_KABAR_MS = 30000;

function kabarKeadaan() {
  if (!globalThis.__aletaKabar) {
    globalThis.__aletaKabar = { nomor: "", token: "", berubah: null, sibuk: false, diamSampai: 0, jam: null };
  }
  return globalThis.__aletaKabar;
}

function kabarKalimat(berubah) {
  const bagian = (berubah.bagian || []).map((b) => (b === "sidang" ? "jadwal sidang" : "data perkara"));
  const apa = bagian.length ? bagian.join(" dan ") : "data perkara";
  const jam = jamCerminPanel(berubah.diubahPada);
  return berubah.dariAleta
    ? `${apa[0].toUpperCase()}${apa.slice(1)} berubah pukul ${jam} - mungkin dari tindakan di ALETA. Muat ulang halaman SIPP untuk melihatnya.`
    : `${apa[0].toUpperCase()}${apa.slice(1)} perkara ini berubah di SIPP pukul ${jam}. Muat ulang halaman SIPP untuk melihatnya.`;
}

/** Memasang / membuang pita kabar pada panel. Idempoten; dipanggil tiap panel digambar dan tiap tanya selesai. */
function kabarPasangPita(panel) {
  if (!panel || typeof panel.querySelector !== "function") return;
  const k = kabarKeadaan();
  const lama = panel.querySelector("#aleta-kabar");
  if (!k.berubah) {
    if (lama) lama.remove();
    return;
  }
  if (lama) return;
  const pita = buatElemen("div", "aleta-pita-luring aleta-pita-luring-segar");
  pita.id = "aleta-kabar";
  pita.setAttribute("data-kabar", "1");
  pita.setAttribute("role", "status");
  pita.appendChild(buatElemen("span", "", kabarKalimat(k.berubah)));
  const muat = buatElemen("button", "aleta-tombol aleta-tombol-kecil", "Muat ulang halaman");
  muat.type = "button";
  muat.addEventListener("click", () => location.reload());
  const abai = buatElemen("button", "aleta-tombol aleta-tombol-kecil", "Abaikan");
  abai.type = "button";
  abai.addEventListener("click", () => {
    k.berubah = null;
    tanpaPengamat(() => kabarPasangPita(document.getElementById(PENANDA)));
  });
  pita.appendChild(document.createTextNode(" "));
  pita.appendChild(muat);
  pita.appendChild(document.createTextNode(" "));
  pita.appendChild(abai);
  panel.insertBefore(pita, panel.firstChild);
}

/** Kabar hanya di tampilan baru: tampilan Lama (Klasik) harus identik dengan sebelum Tahap 7, termasuk permintaannya. */
function kabarModeBoleh() {
  try {
    return typeof alatUjiMode === "function" && String(alatUjiMode() || "lama") !== "lama";
  } catch {
    return false;
  }
}

async function kabarPeriksa() {
  const k = kabarKeadaan();
  if (!kabarModeBoleh() || k.sibuk || document.visibilityState !== "visible" || Date.now() < k.diamSampai) return;
  const panel = document.getElementById(PENANDA);
  const nomor = nomorTerakhir;
  // Hanya panel satu perkara (bukan panel daftar, bukan ajakan masuk / panel ditolak).
  if (!panel || !nomor || nomor === "*daftar*" || (panel.dataset && panel.dataset.mode === "daftar")) return;
  if (k.nomor !== nomor) {
    k.nomor = nomor;
    k.token = "";
    k.berubah = null;
  }
  k.sibuk = true;
  try {
    const url = `${ALETA_API_KABAR}?nomor=${encodeURIComponent(nomor)}${k.token ? `&sejak=${encodeURIComponent(k.token)}` : ""}`;
    const pembatal = new AbortController();
    const batas = setTimeout(() => pembatal.abort(), 8000);
    let respons;
    try {
      respons = await fetch(url, { credentials: "include", cache: "no-store", signal: pembatal.signal });
    } finally {
      clearTimeout(batas);
    }
    if (!respons.ok) {
      // 401/403/5xx: diam dan coba lagi nanti (tidak menambah beban portal yang sedang berat).
      k.diamSampai = Date.now() + 120000;
      return;
    }
    const hasil = await respons.json();
    const kabar = (hasil && hasil.data ? hasil.data : hasil || {}).kabar;
    if (k.nomor !== nomorTerakhir) return; // perkara berganti selagi menunggu
    if (!kabar || kabar.aktif !== true) {
      // Saklar mati / cermin tertinggal / belum tercermin: tanpa pita, tanya lagi 5 menit kemudian.
      k.diamSampai = Date.now() + 300000;
      k.berubah = null;
      tanpaPengamat(() => kabarPasangPita(document.getElementById(PENANDA)));
      return;
    }
    if (!k.token) {
      // Tanya pertama = keadaan dasar yang sedang dibaca petugas.
      k.token = String(kabar.token || "");
    } else if (kabar.berubah) {
      k.berubah = { diubahPada: kabar.diubahPada, bagian: kabar.bagian || [], dariAleta: kabar.kemungkinanDariAleta === true };
    }
    tanpaPengamat(() => kabarPasangPita(document.getElementById(PENANDA)));
  } catch {
    k.diamSampai = Date.now() + 120000;
  } finally {
    k.sibuk = false;
  }
}

/** Menyalakan pemantau sekali (idempoten); tanya pertama segera, berikutnya tiap JEDA_KABAR_MS. */
function kabarMulaiPantau() {
  const k = kabarKeadaan();
  // Perkara baru dibuka: keadaan dasar diambil sebentar lagi (nomorTerakhir baru terisi sesudah panel tergambar).
  if (nomorTerakhir && k.nomor !== nomorTerakhir && !k.segera) {
    k.segera = setTimeout(() => {
      k.segera = null;
      void kabarPeriksa();
    }, 1500);
  }
  if (k.jam) return;
  k.jam = setInterval(() => void kabarPeriksa(), JEDA_KABAR_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void kabarPeriksa();
  });
  void kabarPeriksa();
}

function tampilkan(elemen) {
  tanpaPengamat(() => {
    const lama = document.getElementById(PENANDA);
    if (lama) {
      // Panel lama boleh masih menunggu panggilan latar untuk lencananya.
      // Membiarkannya berangkat berarti menembakkan kueri untuk perkara yang
      // sudah tidak dilihat siapa pun - dan berpindah perkara dengan cepat
      // akan meninggalkan antrean panggilan yang seluruhnya sia-sia.
      if (typeof lama.batalLencana === "function") lama.batalLencana();
      lama.remove();
    }
    document.body.appendChild(elemen);
    // Petunjuk dua detik untuk tiap tombol yang bertitle - pembantu bersama
    // di panel-alat.js, yang sama dengan panel ABT dan ALETA.
    alatPasangPetunjuk(elemen);
    kabarPasangPita(elemen);
  });
  kabarMulaiPantau();
}

let nomorTerakhir = "";
let sedangAmbil = false;

/**
 * ==========================================================================
 * SIAPA YANG MASUK ALETA - DI HALAMAN YANG BUKAN HALAMAN PERKARA
 * ==========================================================================
 *
 * penggunaTerakhir hanya terisi dari jawaban konteks perkara, dan jawaban
 * itu tidak pernah datang di dashboard maupun daftar perkara. Akibatnya
 * pita di sana hanya memuat akun SIPP, sedangkan di halaman perkara ia
 * memuat keduanya - dua kepala yang berbeda untuk satu ekstensi.
 *
 * Dibaca dari rute yang sama dengan panel ABT dan panel halaman ALETA,
 * SEKALI per pemuatan halaman, dan hasilnya disimpan. Kegagalannya tidak
 * menggagalkan apa pun: pitanya sekadar kembali memuat akun SIPP saja.
 */
async function muatPenggunaAleta() {
  if (penggunaTerakhir && penggunaTerakhir.nama) return penggunaTerakhir;
  try {
    let respons = await alatAmbil(
      ALETA_API_SIAPA,
      { credentials: "include", cache: "no-store" },
      "Membaca akun ALETA"
    );
    /* === MASUK-SESI-SIPP 11 Okt === */
    if (respons.status === 401) {
      const hasilMasukSesi = await masukAletaDariSesiSipp(false);
      if (hasilMasukSesi && hasilMasukSesi.jenis === "masuk") {
        respons = await alatAmbil(ALETA_API_SIAPA, { credentials: "include", cache: "no-store" }, "Membaca akun ALETA");
      }
    }
    /* === AKHIR MASUK-SESI-SIPP === */
    if (!respons.ok) return null;
    const luar = await respons.json();
    const isi = luar && luar.data ? luar.data : luar;
    // Versi tipe keluaran yang berlaku (16 hex, atau null bila tabelnya tak
    // terbaca). Dengannya alatTipeKeluaran memakai singgahan tanpa bertanya
    // ke portal selama versinya sama. Portal lama tanpa ruas ini: dibiarkan.
    if (isi && Object.prototype.hasOwnProperty.call(isi, "versiTipe")) alatSetelVersiTipe(isi.versiTipe);
    if (isi && isi.nama) {
      penggunaTerakhir = { nama: isi.nama, peran: isi.peran || "" };
      // Hak unggah putusan dari peladen (9 Okt 2026) - portal lama tanpa ruas
      // ini: dihitung dari nama perannya (alatBolehUnggahPutusan).
      if (typeof isi.bolehUnggahPutusan === "boolean") penggunaTerakhir.bolehUnggahPutusan = isi.bolehUnggahPutusan;
      // Hak Kasir (1.189.x) dari peladen - tab/bagian Kasir.
      if (typeof isi.bolehKasir === "boolean") penggunaTerakhir.bolehKasir = isi.bolehKasir;
      if (typeof isi.bolehMengerjakanKasir === "boolean") penggunaTerakhir.bolehMengerjakanKasir = isi.bolehMengerjakanKasir;
      // R 11 Okt: peran tambahan (kasir, petugas_ptsp, ...) - golongan menu Kasir/PTSP.
      if (Array.isArray(isi.peranTambahan)) penggunaTerakhir.peranTambahan = isi.peranTambahan.slice();
      /* === HAK-PERAN 12 Okt === */
      // Golongan menu dari matriks peran portal (jabatan + peran tambahan).
      if (Array.isArray(isi.golonganMenu)) penggunaTerakhir.golonganMenu = isi.golonganMenu.slice();
      /* === AKHIR HAK-PERAN === */
      if (isi.kapabilitas) kapabilitasTerakhir = isi.kapabilitas;
    }
  } catch {
    /* pita tetap tampil dengan akun SIPP saja */
  }
  return penggunaTerakhir;
}

/**
 * ==========================================================================
 * BORANG SIPP DATANG BELAKANGAN, DAN PANELNYA SUDAH TERGAMBAR
 * ==========================================================================
 *
 * Dua bagian panel hanya digambar bila borangnya memang ada di halaman:
 * Isi formulir putusan menuntut #frm_putusan, dan Isi alasan perkara
 * menuntut #frm_data_umum. Keduanya dikenali dari borangnya sendiri, bukan
 * dari alamat halaman - dan itu memang benar, sebab alamat SIPP berubah
 * bentuk antar versi sedangkan id borangnya tidak.
 *
 * Tetapi keduanya TIDAK ada saat halaman perkara pertama kali dibuka. SIPP
 * memuatnya lewat AJAX ke dalam tingkap yang melayang di atas halaman yang
 * sama: alamatnya tidak berpindah, dan nomor perkaranya tidak berubah.
 *
 * Penjaga nomorTerakhir karena itu menolak menggambar ulang, dan kedua
 * bagian itu tidak pernah muncul sama sekali. Yang menekan "Tambah Putusan
 * Akhir" melihat borang SIPP terbuka dengan panel ALETA di sebelahnya yang
 * tidak menawarkan apa pun - lalu menyimpulkan fiturnya tidak ada.
 *
 * Maka yang dijaga bukan lagi nomor perkaranya saja, melainkan nomor
 * perkara BESERTA borang yang sedang terbuka.
 */
function tandaBorang() {
  return `${document.querySelector("#frm_putusan") ? "1" : "0"}${
    document.querySelector("#frm_data_umum") ? "1" : "0"
  }`;
}

/** Borang yang ada di halaman saat panel terakhir digambar. */
let borangTerakhir = "";
/** Usulan penunjukan yang terakhir dibaca - dipakai menebak peta kolom. */
let usulanTerakhir = null;

/**
 * ============================================================================
 * KETIKA ALETA TIDAK TERJANGKAU, PANEL TIDAK KOSONG - IA MENJADI TUA
 * ============================================================================
 *
 * Sebelumnya, portal yang mati berarti panel yang tidak digambar sama sekali.
 * Yang dilihat petugas: ekstensi yang kadang ada kadang tidak - dan
 * kesimpulan yang selalu sama, bahwa ekstensinya rusak. Sesudah beberapa
 * kali begitu, orang berhenti memakainya.
 *
 * Sekarang konteks tiap perkara yang berhasil dibaca ikut disimpan. Ketika
 * panggilan berikutnya gagal, panel digambar dari simpanan itu, dengan pita
 * yang menyebutkan usianya - bukan disembunyikan, dan bukan pula disamarkan
 * sebagai data segar.
 *
 * ============================================================================
 * YANG DIBACA BOLEH TUA, YANG DITULIS TIDAK PERNAH
 * ============================================================================
 *
 * Ini batas yang menentukan seluruh rancangannya. Usulan majelis dihitung
 * dari giliran dan beban perkara yang berubah tiap hari; menetapkan majelis
 * dari usulan kemarin berarti menuliskan giliran yang sudah tidak berlaku ke
 * dalam berkas perkara yang sungguhan - dan itu jauh lebih buruk daripada
 * panel yang tidak muncul.
 *
 * Karena itu SELURUH kewenangan menulis dimatikan selama panel luring -
 * lihat boleh(). Satu titik, bukan sembilan penjagaan yang tersebar, sebab
 * penjagaan yang tersebar akan tertinggal satu begitu ada menu baru.
 */
const KUNCI_SIMPANAN_KONTEKS = "simpananKonteks";
// Dua belas perkara terakhir. Cukup untuk satu pagi kerja, dan tetap jauh di
// bawah batas penyimpanan ekstensi.
const BATAS_SIMPANAN_KONTEKS = 12;
// Lebih tua dari ini tidak ditawarkan lagi: yang dibaca dari kemarin lebih
// mungkin menyesatkan daripada menolong.
const UMUR_SIMPANAN_MAKS = 12 * 60 * 60 * 1000;

/** Kewenangan menulis dimatikan selama yang tergambar data simpanan. */
let sedangLuring = false;

// Panel luring mencoba lagi sendiri, berkala. Tiga puluh detik cukup lama
// untuk tidak membebani portal yang sedang sakit, dan cukup singkat untuk
// tidak membuat petugas menunggu tanpa tahu ia sedang menunggu apa.
const JEDA_COBA_LURING = 30000;

// Jeda sebelum panel didahului dari simpanan. Empat ratus milidetik: di
// bawah itu portal yang sehat pun kalah balapan dan panel berkedip tanpa
// perlu; di atasnya, penantiannya sudah terasa.
const JEDA_PENDAHULU_MS = 400;

/** Penyegaran yang dilewati karena tabnya tersembunyi - lihat segarkan(). */
let tertundaKarenaTersembunyi = false;

// Batas panggilan konteks. Lebih longgar daripada batas permintaan panel
// biasa: inilah panggilan yang paling berat di seluruh ekstensi - ia
// membaca dokumen, nomor pihak, selisih, hakim, dan identitas sekaligus.
const BATAS_KONTEKS_MS = 12000;
let jamCobaLuring = null;

function mulaiMencobaLagi(nomor) {
  if (jamCobaLuring) return;
  jamCobaLuring = setInterval(() => {
    // Penjaga nomorTerakhir yang memotong pemeriksaan berulang dilepas untuk
    // satu putaran - hanya itu yang menahan panggilan berikutnya.
    if (nomorTerakhir === nomor) nomorTerakhir = "";
    void segarkan();
  }, JEDA_COBA_LURING);
}

function berhentiMencobaLagi() {
  if (!jamCobaLuring) return;
  clearInterval(jamCobaLuring);
  jamCobaLuring = null;
}
const KEWENANGAN_MENULIS = ["kerjakan", "penunjukan", "data-umum", "penunjukan-otomatis"];

async function simpanKonteksLuring(nomor, isi) {
  if (!nomor || !isi) return;
  try {
    const simpan = await chrome.storage.local.get([KUNCI_SIMPANAN_KONTEKS]);
    const lama = simpan[KUNCI_SIMPANAN_KONTEKS];
    const peta = lama && typeof lama === "object" ? { ...lama } : {};
    peta[nomor] = {
      konteks: isi.konteks,
      pengguna: isi.pengguna || null,
      kapabilitas: isi.kapabilitas || null,
      waktu: new Date().toISOString(),
    };

    // Yang paling tua dibuang lebih dahulu. Tanpa batas, penyimpanan
    // ekstensi tumbuh sepanjang tahun oleh perkara yang tidak pernah dibuka
    // lagi - dan kuota yang habis membuat SELURUH setelan gagal tersimpan,
    // termasuk posisi panel dan temanya.
    const urut = Object.keys(peta).sort(
      (a, b) => new Date(peta[b].waktu).getTime() - new Date(peta[a].waktu).getTime()
    );
    const dipangkas = {};
    for (const kunci of urut.slice(0, BATAS_SIMPANAN_KONTEKS)) dipangkas[kunci] = peta[kunci];

    await chrome.storage.local.set({ [KUNCI_SIMPANAN_KONTEKS]: dipangkas });
  } catch {
    /* simpanan hanya kemudahan - gagal menyimpannya tidak boleh berakibat apa-apa */
  }
}

async function ambilKonteksLuring(nomor) {
  if (!nomor) return null;
  try {
    const simpan = await chrome.storage.local.get([KUNCI_SIMPANAN_KONTEKS]);
    const peta = simpan[KUNCI_SIMPANAN_KONTEKS];
    const satu = peta && typeof peta === "object" ? peta[nomor] : null;
    if (!satu || !satu.konteks) return null;
    const umur = Date.now() - new Date(satu.waktu).getTime();
    if (!Number.isFinite(umur) || umur < 0 || umur > UMUR_SIMPANAN_MAKS) return null;
    return satu;
  } catch {
    return null;
  }
}

/**
 * Menggambar panel dari simpanan. Dipanggil HANYA ketika panggilan sungguhan
 * gagal - bukan sebagai pendahuluan yang cepat, sebab panel yang lahir tua
 * lalu berganti segar sedetik kemudian terbaca sebagai kedipan.
 */
/**
 * @param {{menyegarkan?: boolean}} [opsi] menyegarkan berarti panggilan
 *        sungguhannya MASIH TERBANG - panel ini hanya mendahuluinya supaya
 *        ada yang terbaca, dan jawaban yang segar akan menggantinya.
 */
async function gambarDariSimpanan(nomor, opsi = {}) {
  const simpanan = await ambilKonteksLuring(nomor);
  if (!simpanan) return false;

  nomorTerakhir = nomor;
  konteksTerakhir = simpanan.konteks;
  penggunaTerakhir = simpanan.pengguna || null;
  kapabilitasTerakhir = simpanan.kapabilitas || null;
  sedangLuring = true;

  await muatLipatan();
  await muatTema();
  const posisi = await muatPosisi();

  if (!(await pastikanModulPanel("panel-perkara"))) return false; // K11-GUARD
  const panel = susunPanel(simpanan.konteks);
  panel.setAttribute("data-tema", temaSekarang);
  panel.insertBefore(pitaLuring(simpanan.waktu, opsi.menyegarkan === true), panel.firstChild);
  tampilkan(panel);
  terapkanTemaSipp();
  terapkanPosisi(panel, posisi);
  normalkanJangkar(panel);
  if (posisi && posisi.lencana) ciutkanKeLencana(panel, true);

  // Yang mendahului panggilan yang MASIH terbang tidak perlu penjadwal
  // percobaan ulang - jawabannya sedang dalam perjalanan.
  if (opsi.menyegarkan !== true) mulaiMencobaLagi(nomor);
  return true;
}

/** Pita yang menyebutkan panel ini dibaca dari simpanan, beserta usianya. */
function pitaLuring(waktuIso, menyegarkan = false) {
  const pita = buatElemen("div", "aleta-pita-luring");
  // usiaData memulangkan { teks, basi }, bukan untai - dibaca sebagai untai
  // ia menjadi [object Object] di tengah kalimat.
  const usia = usiaData(waktuIso).teks;

  // Dua keadaan yang berbeda, dan membedakannya penting: yang satu berkata
  // "ALETA mati", yang lain "ALETA sedang menjawab, ini dulu sambil
  // menunggu". Menyebut keduanya "tidak terjangkau" membuat portal yang
  // hanya berat terbaca sebagai portal yang mati.
  if (menyegarkan) {
    pita.classList.add("aleta-pita-luring-segar");
    pita.textContent = `Menyegarkan dari ALETA — sementara ini keterangan simpanan${usia ? `, ${usia}` : ""}.`;
    pita.title = "Panel digambar lebih dahulu dari simpanan supaya ada yang terbaca. Begitu jawaban ALETA tiba, panel diperbarui dan menetapkan hidup kembali.";
    return pita;
  }

  pita.textContent = `ALETA tidak terjangkau — keterangan ini dari simpanan${usia ? `, ${usia}` : ""}. Menetapkan dimatikan sementara.`;
  pita.title = "Usulan penetapan dihitung dari giliran dan beban perkara yang berubah tiap hari, jadi usulan lama tidak boleh dituliskan ke SIPP.";
  return pita;
}

// ─── Menunggu pengguna masuk portal ──────────────────────────────────────────
//
// Panel yang menampilkan "Masuk ke ALETA" dulu MENGUNCI nomor perkaranya, dan
// penjaga nomorTerakhir memotong setiap pemeriksaan berikutnya. Akibatnya
// petugas yang menuruti ajakan itu - masuk di tab lain, lalu kembali - tetap
// melihat ajakan yang sama, dan satu-satunya jalan keluarnya memuat ulang
// halaman SIPP. Yang tampak: ekstensi tidak bekerja meskipun sudah masuk.
//
// Sekarang panel itu menunggu sendiri. Yang menahan tidak dilepas seluruhnya -
// pemeriksaan berkala tetap dijeda supaya tidak memanggil ALETA tiap detik -
// tetapi kembalinya perhatian ke tab ini memicu pemeriksaan SEKETIKA, karena
// itulah saat yang paling mungkin sesudah orang selesai masuk.

const JEDA_TUNGGU_MASUK = 5000;
let jamTungguMasuk = null;

/**
 * ============================================================================
 * JARAKNYA MUNDUR SENDIRI - LIMA DETIK HANYA UNTUK MENIT PERTAMA
 * ============================================================================
 *
 * Penantian ini dipasang ketika panel berbunyi "Masuk ke ALETA", dan ia
 * bertahan selama halamannya terbuka. Pada layar yang ditinggal semalam,
 * jarak tetap lima detik berarti tujuh ribu panggilan ke portal untuk satu
 * pertanyaan yang jawabannya tidak berubah - dan pada portal yang sedang
 * berat, tiap satunya ikut memperlambat yang sedang dipakai orang.
 *
 * Menit pertama yang paling menentukan: di situlah orang benar-benar sedang
 * masuk di tab sebelah. Sesudah itu jaraknya melar sampai setengah menit,
 * dan kembalinya perhatian ke tab ini tetap memicu pemeriksaan SEKETIKA -
 * lihat periksaSegeraBilaMenunggu.
 */
const JEDA_TUNGGU_MAKS = 30000;
let jedaTungguSekarang = JEDA_TUNGGU_MASUK;

function mulaiMenungguMasuk() {
  if (jamTungguMasuk) return;
  jedaTungguSekarang = JEDA_TUNGGU_MASUK;
  const jadwalkan = () => {
    jamTungguMasuk = setTimeout(() => {
      nomorTerakhir = "";
      void segarkan();
      jedaTungguSekarang = Math.min(Math.round(jedaTungguSekarang * 1.6), JEDA_TUNGGU_MAKS);
      jadwalkan();
    }, jedaTungguSekarang);
  };
  jadwalkan();
}

function berhentiMenungguMasuk() {
  if (!jamTungguMasuk) return;
  clearTimeout(jamTungguMasuk);
  jamTungguMasuk = null;
  jedaTungguSekarang = JEDA_TUNGGU_MASUK;
}

/** Perhatian kembali ke tab ini - saat paling mungkin sesudah orang masuk. */
function periksaSegeraBilaMenunggu() {
  if (!jamTungguMasuk) return;
  if (document.visibilityState === "hidden") return;
  nomorTerakhir = "";
  void segarkan();
}

document.addEventListener("visibilitychange", periksaSegeraBilaMenunggu);
window.addEventListener("focus", periksaSegeraBilaMenunggu);
// Disimpan supaya saklar penandaan berlaku seketika tanpa memanggil ALETA
// lagi - data yang sama sudah ada di tangan.
let konteksTerakhir = null;

// Nama dan jabatan pengguna ALETA yang sedang masuk. Panel ini melayang di
// atas halaman SIPP, dan SIPP punya akun sendiri yang belum tentu orang yang
// sama - menyebutkannya membuat perbedaan itu terlihat sebelum ada yang
// terlanjur mengira keduanya satu.
let penggunaTerakhir = null;

/**
 * Kewenangan peran yang sedang masuk, dari rute konteks.
 *
 * null berarti belum terbaca - dan pada keadaan itu menu yang berkewenangan
 * TETAP digambar. Menyembunyikannya saat ragu akan membuat pemasangan baru
 * tampak kehilangan separuh fiturnya, dan yang disalahkan biasanya
 * ekstensinya, bukan jawaban yang belum sampai.
 */
let kapabilitasTerakhir = null;

/** Apakah peran ini boleh memakai satu kemampuan. Ragu berarti boleh. */
function boleh(kunci) {
  // Satu titik yang mematikan seluruh jalan menulis ketika yang tergambar
  // data simpanan - lihat catatan pada KUNCI_SIMPANAN_KONTEKS. Ditaruh di
  // sini, bukan di tiap menu, sebab penjagaan yang tersebar akan tertinggal
  // satu begitu ada menu baru yang menulis.
  if (sedangLuring && KEWENANGAN_MENULIS.includes(kunci)) return false;
  if (!kapabilitasTerakhir) return true;
  return kapabilitasTerakhir[kunci] !== false;
}

/**
 * Menyimpan alamat portal ALETA untuk dipakai popup ekstensi.
 *
 * Popup berjalan di origin chrome-extension://, sehingga tautan "/aleta" di
 * sana menunjuk ke dalam ekstensi - dan petugas menerima halaman "Your file
 * couldn't be accessed" alih-alih halaman login.
 *
 * Skrip konten inilah yang tahu alamat sesungguhnya, karena ia berjalan di
 * halaman SIPP. Disimpan lewat penyimpanan bersama, bukan dengan meminta izin
 * "tabs" - izin itu memberi ekstensi kemampuan membaca alamat SELURUH tab
 * peramban, jauh lebih luas daripada yang dibutuhkan.
 */
// Pencatatnya pindah ke panel-alat.js supaya ABT dan halaman ALETA ikut
// mencatat - lihat alatCatatAsalPortal di sana. Yang di sini tinggal
// panggilannya.

/**
 * ============================================================================
 * SIAPA YANG MASUK SIPP, DICATAT UNTUK POPUP
 * ============================================================================
 *
 * Popup ekstensi berjalan di origin chrome-extension:// dan tidak melihat
 * halaman SIPP sama sekali. Nama akun SIPP hanya diketahui dari halamannya -
 * dari sapaan "Selamat Datang" di kepala - sehingga skrip inilah satu-satunya
 * yang dapat mencatatnya.
 *
 * Yang disimpan hanya nama tampilan yang memang sudah tertulis besar di kepala
 * halaman SIPP: tidak ada sandi, tidak ada pengenal sesi, tidak ada data
 * perkara. Waktunya ikut dicatat supaya popup dapat mengatakan "terakhir
 * dilihat", bukan menyajikan nama lama seolah-olah keadaan sekarang.
 */
let akunSippTercatat = "";

function catatAkunSipp() {
  let nama = "";
  try {
    nama = namaPenggunaSipp();
  } catch {
    return;
  }
  if (!nama || nama === akunSippTercatat) return;
  akunSippTercatat = nama;
  try {
    void chrome.storage.local.set({
      akunSipp: nama,
      akunSippPada: new Date().toISOString(),
    });
  } catch {
    /* penyimpanan tidak tersedia: popup mengatakannya belum diketahui */
  }
}

/**
 * Menggambar ulang panel dari konteks yang SUDAH ada di memori.
 *
 * Dipakai ketika yang berubah hanya borang SIPP di halaman, bukan
 * perkaranya. Tidak ada satu pun keterangan perkara yang berubah ketika
 * tingkap Putusan Akhir dibuka, jadi menanyakannya lagi ke portal hanya
 * menambah satu penantian - dan pada portal yang sedang berat, penantian
 * itu yang justru terlihat sebagai ekstensi yang macet.
 *
 * Penandaan baris halaman sengaja TIDAK diulang: ia sudah terpasang sejak
 * penggambaran sebelumnya, dan mengulangnya berarti menyapu seluruh tabel
 * tiap kali sebuah tingkap dibuka.
 */
async function gambarUlangKonteks() {
  if (!konteksTerakhir) return;
  await muatLipatan();
  await muatTema();
  const posisi = await muatPosisi();
  if (!(await pastikanModulPanel("panel-perkara"))) return; // K11-GUARD
  const panel = susunPanel(konteksTerakhir);
  panel.setAttribute("data-tema", temaSekarang);
  tampilkan(panel);
  terapkanTemaSipp();
  terapkanPosisi(panel, posisi);
  normalkanJangkar(panel);
  if (posisi && posisi.lencana) ciutkanKeLencana(panel, true);
}

async function segarkan() {
  // Halaman cetak dan templat diperiksa PALING AWAL, sebelum saklar mana
  // pun dibaca. Petugas yang menyalakan penandaan tidak sedang menyetujui
  // keterangan ALETA tercetak di relas panggilan.
  if (halamanCetakAtauTemplat()) return;

  // ==========================================================================
  // TAB YANG TIDAK DILIHAT TIDAK MEMANGGIL PORTAL
  // ==========================================================================
  //
  // Petugas membuka SIPP di beberapa tab sekaligus - satu daftar perkara,
  // beberapa halaman perkara - dan tiap tab memasang pengamat DOM-nya
  // sendiri. Pada portal yang sedang berat, tab yang tidak dilihat siapa pun
  // ikut menambah antrean permintaan, dan yang menanggung lambatnya justru
  // tab yang sedang dipandang.
  //
  // Ditunda, bukan dibatalkan: kembalinya perhatian ke tab ini memanggil
  // segarkan() lagi - lihat pendengar visibilitychange di kaki berkas.
  if (document.visibilityState === "hidden") {
    tertundaKarenaTersembunyi = true;
    return;
  }
  tertundaKarenaTersembunyi = false;

  alatCatatAsalPortal();
  catatAkunSipp();

  // Saklar disegarkan dari penyimpanan sekali tiap putaran - lihat catatan
  // pada muatSaklar tentang salinan yang dapat basi tanpa berbunyi.
  await muatSaklar(true);

  if (!(await sedangAktif())) {
    const lama = document.getElementById(PENANDA);
    if (lama) {
      if (typeof lama.batalLencana === "function") lama.batalLencana();
      lama.remove();
    }
    bersihkanTanda();
    nomorTerakhir = "";
    konteksTerakhir = null;
    return;
  }

  // R 11 Okt (butir 4): halaman daftar jurnal keuangan SELALU halaman daftar -
  // juga bila saringannya hanya menyisakan satu perkara (nomor tunggal itu
  // bukan halaman perkara) atau barisnya tidak terbaca, supaya Kasir massal
  // bagi yang boleh tetap ada di tempatnya.
  const r11Jurnal = await r11SiapHalamanJurnalDaftar();
  const nomor = r11Jurnal ? "" : cariNomorPerkara();
  if (!nomor && alamatHalamanPerkara()) {
    // Halaman detail perkara yang nomornya belum terbaca (tab Data Umum
    // belum termuat) BUKAN halaman daftar: panel daftar dan menu massalnya
    // tidak pernah digambar di sini (butir 7, 6 Okt 2026). Pengamat DOM
    // memanggil segarkan() lagi begitu Data Umum tiba. Panel perkara yang
    // sudah tergambar dibiarkan: nomornya akan terbaca sama lagi.
    return;
  }
  if (!nomor) {
    // Bukan halaman perkara. Bila ini halaman daftar, barisnya ditandai -
    // itu justru tempat penanda paling berguna: petugas melihat puluhan
    // perkara sekaligus dan langsung tahu mana yang perlu dibuka.
    let ringkasan = await tandaiHalamanDaftar();
    if (!ringkasan && r11Jurnal) ringkasan = r11RingkasanJurnal();
    if (!ringkasan) {
      // Bukan halaman daftar juga - halaman awal, laporan, atau referensi.
      // Panel perkara yang tertinggal dari halaman sebelumnya dibuang supaya
      // tidak menerangkan perkara yang sudah tidak dibuka.
      nomorTerakhir = "";
      return;
    }
    // Panel yang sama tidak digambar ulang tiap pengamat berbunyi - menggambar
    // ulang membuang keadaan lipatan dan posisi yang baru saja diatur.
    void pastikanModulPanel("panel-daftar"); // K11-PRA
    const adaPanel = document.getElementById(PENANDA);
    if (adaPanel && adaPanel.dataset.mode === "daftar" && nomorTerakhir === "*daftar*") return;

    await muatLipatan();
    await muatTema();
    // Akun ALETA dibaca lebih dulu supaya pita di halaman daftar sama
    // dengan pita di halaman perkara - lihat muatPenggunaAleta.
    await muatPenggunaAleta();
    const posisi = await muatPosisi();
    if (!(await pastikanModulPanel("panel-daftar"))) return; // K11-GUARD
    const panel = susunPanelDaftar(ringkasan);
    panel.dataset.mode = "daftar";
    panel.setAttribute("data-tema", temaSekarang);
    tampilkan(panel);
    terapkanTemaSipp();
    terapkanPosisi(panel, posisi);
    normalkanJangkar(panel);
    // Panel yang ditinggalkan sebagai lencana lahir kembali sebagai lencana.
    // Tanpa baris ini, tiap penggambaran ulang - dan halaman SIPP memicunya
    // terus-menerus - membentangkannya lagi tanpa ada yang memintanya.
    if (posisi && posisi.lencana) ciutkanKeLencana(panel, true);
    nomorTerakhir = "*daftar*";
    return;
  }
  void pastikanModulPanel("panel-perkara"); // K11-PRA: muat sejajar dengan permintaan ke portal
  if (sedangAmbil) return;

  // Perkara yang sama, tetapi borang yang terbuka berubah: tingkap Putusan
  // Akhir atau Data Umum baru muncul, atau baru ditutup. Panelnya digambar
  // ulang dari konteks yang sudah ada - portal tidak ditanya lagi.
  const borang = tandaBorang();
  if (nomor === nomorTerakhir) {
    if (borang === borangTerakhir) {
      // ====================================================================
      // ISI HALAMAN BERTAMBAH SESUDAH PANEL DIGAMBAR
      // ====================================================================
      //
      // Halaman perkara SIPP memuat isinya BERTAHAP: baris Jadwal Sidang,
      // Data Relaas, dan Data Persidangan datang lewat AJAX beberapa saat
      // sesudah panel ALETA selesai digambar. Ketika baris-baris itu muncul,
      // pengamat DOM memanggil segarkan() - dan dahulu segarkan() pulang di
      // sini, sebab nomor perkaranya memang belum berganti.
      //
      // Akibatnya penanda halaman dan sisipan berkas hanya pernah terpasang
      // pada isi yang SUDAH ada saat panel pertama digambar, dan pengguna
      // melaporkannya sebagai "saklarnya tercentang tetapi tidak muncul,
      // kecuali saya matikan lalu nyalakan lagi" - sebab mematikan dan
      // menyalakan menempuh jalur lain, yaitu pendengar chrome.storage yang
      // memanggil terapkanTanda secara langsung.
      //
      // Penandaannya karena itu diulang di sini, dan hanya itu: konteks
      // perkaranya tidak diminta ulang ke portal, panelnya tidak digambar
      // ulang, dan keadaan lipatan maupun posisinya tidak tersentuh.
      //
      // Tidak berputar: terapkanTanda mengerjakan seluruh tulisannya di dalam
      // tanpaPengamat(), jadi sentuhannya sendiri tidak memicu pengamat.
      if (konteksTerakhir) await terapkanTanda(konteksTerakhir);
      return;
    }
    borangTerakhir = borang;
    if (konteksTerakhir) {
      await gambarUlangKonteks();
      return;
    }
    // Konteksnya belum pernah terbaca - jalur biasa di bawah yang
    // mengambilnya, sekalian menggambar bagian borangnya.
  }
  borangTerakhir = borang;

  sedangAmbil = true;
  try {
    // ======================================================================
    // PANEL TIDAK MENUNGGU PORTAL YANG BERAT
    // ======================================================================
    //
    // Panggilan ini menahan SELURUH panel: sampai ia menjawab, tidak ada
    // apa pun yang tergambar. Pada portal yang sedang berat itu berarti
    // halaman perkara SIPP terbuka tanpa panel selama beberapa detik, dan
    // yang melihatnya menyimpulkan ekstensinya tidak jalan.
    //
    // Sekarang ia diberi PENDAHULU: bila belum menjawab dalam jeda pendek
    // dan perkara ini pernah terbaca sebelumnya, panelnya digambar dari
    // simpanan dengan pita yang menyebutkan ia sedang disegarkan. Begitu
    // jawaban yang segar tiba, panel digambar ulang.
    //
    // Portal yang cepat tidak pernah melihat pendahulu ini sama sekali -
    // jawabannya menang balapan, dan tidak ada satu kedipan pun.
    const pendahulu = setTimeout(() => {
      void gambarDariSimpanan(nomor, { menyegarkan: true });
    }, JEDA_PENDAHULU_MS);

    // Batas waktu supaya panggilan yang menggantung tidak menahan
    // sedangAmbil selamanya - selama ia menahan, tidak ada penyegaran
    // berikutnya yang boleh berjalan sama sekali.
    const pembatal = new AbortController();
    const batasKonteks = setTimeout(() => pembatal.abort(), BATAS_KONTEKS_MS);

    let respons;
    try {
      // Same-origin: cookie sesi portal ikut sendiri, tanpa CORS dan tanpa
      // menyimpan kredensial apa pun di ekstensi.
      respons = await fetch(`${ALETA_API}?nomor=${encodeURIComponent(nomor)}`, {
        credentials: "include",
        cache: "no-store",
        signal: pembatal.signal,
      });
    } finally {
      clearTimeout(pendahulu);
      clearTimeout(batasKonteks);
    }

    if (respons.status === 401) {
      nomorTerakhir = nomor;
      /* === MASUK-SESI-SIPP 11 Okt === */
      // Petugas sudah masuk SIPP: portal diminta membuktikan sesi SIPP itu
      // lewat bot dan memasukkannya ke akun ALETA yang sama (tautan/NIP/nama
      // tunggal). Berhasil = panel digambar ulang dengan sesi ALETA baru.
      const hasilMasukSesi = await masukAletaDariSesiSipp(false);
      if (hasilMasukSesi && hasilMasukSesi.jenis === "masuk") {
        nomorTerakhir = "";
        setTimeout(() => void segarkan(), 0);
        return;
      }
      /* === AKHIR MASUK-SESI-SIPP === */
      tampilkan(susunAjakanMasuk());
      mulaiMenungguMasuk();
      return;
    }

    // 403 berarti sudah masuk tetapi perannya tidak diberi akses - lihat
    // catatan pada susunPanelDitolak.
    if (respons.status === 403) {
      // Sudah masuk, hanya tidak berwenang. Menunggu tidak ada gunanya lagi.
      berhentiMenungguMasuk();
      nomorTerakhir = nomor;
      tampilkan(susunPanelDitolak(await pesanGalat(respons)));
      return;
    }
    if (!respons.ok) {
      // ALETA menjawab, tetapi bukan jawaban yang dapat dipakai - 500, 502,
      // atau portal yang sedang dibangun ulang. Simpanan dipakai bila ada.
      await gambarDariSimpanan(nomor);
      return;
    }

    const hasil = await respons.json();
    const isi = hasil?.data ?? hasil;
    if (!isi?.available || !isi?.konteks?.ok) {
      // A6 (25 Okt 2026): bot tidak menjawab tetapi portal memegang salinan keadaan perkara (Cermin
      // Perkara): gambar panel RINGAN supaya panel tidak hilang. Tidak menimpa panel yang sudah ada;
      // penyegaran berikutnya mencoba lagi dan menggantinya dengan panel penuh begitu bot menjawab.
      if (isi && isi.keadaanCermin && isi.keadaanCermin.nomorPerkara && !document.getElementById(PENANDA)) {
        berhentiMenungguMasuk();
        tampilkan(susunPanelCermin(isi.keadaanCermin, isi.message));
      }
      return;
    }

    berhentiMenungguMasuk();
    nomorTerakhir = nomor;
    konteksTerakhir = isi.konteks;
    void tautkanSesiSippBilaDiminta(); // MASUK-SESI-SIPP 11 Okt
    // Jawaban yang segar mengakhiri keadaan luring, dan mengisi simpanan
    // untuk panggilan berikutnya yang barangkali gagal.
    sedangLuring = false;
    berhentiMencobaLagi();
    void simpanKonteksLuring(nomor, isi);
    // Siapa yang sedang memakai ALETA - bukan siapa yang masuk SIPP.
    penggunaTerakhir = isi.pengguna || null;
    // Kewenangan perannya. Menu yang tidak dapat dipakai tidak digambar sama
    // sekali - sebelumnya ia tetap muncul dan baru menolak sesudah ditekan.
    kapabilitasTerakhir = isi.kapabilitas || null;

    // Perkara ini dicatat sebagai yang terakhir dibuka. Panel di halaman
    // ALETA membacanya untuk menawarkan jalan kembali dengan satu klik.
    void catatRiwayatPerkaraSipp(nomor, isi.konteks);

    // Keadaan lipatan dan posisi dibaca SEBELUM panel digambar, supaya
    // panel tidak sempat berkedip di tempat lama lalu melompat.
    await muatLipatan();
    // Tema dibaca bersama lipatan, dengan alasan yang sama: panel yang lahir
    // gelap lalu berpindah terang sepersekian detik kemudian terbaca sebagai
    // kedipan, bukan sebagai tema.
    await muatTema();
    const posisi = await muatPosisi();

    if (!(await pastikanModulPanel("panel-perkara"))) return; // K11-GUARD
    const panel = susunPanel(isi.konteks);
    panel.setAttribute("data-tema", temaSekarang);
    tampilkan(panel);
    terapkanTemaSipp();
    terapkanPosisi(panel, posisi);
    normalkanJangkar(panel);
    // Panel yang ditinggalkan sebagai lencana lahir kembali sebagai lencana.
    // Tanpa baris ini, tiap penggambaran ulang - dan halaman SIPP memicunya
    // terus-menerus - membentangkannya lagi tanpa ada yang memintanya.
    if (posisi && posisi.lencana) ciutkanKeLencana(panel, true);

    // Perkara tanpa dokumen sama sekali: tawarkan menariknya, jangan
    // biarkan panel kosong tanpa jalan keluar. Perkara yang SUDAH punya
    // dokumen tidak ditawari - penarikan berkala yang mengurusnya, dan
    // tombol yang selalu ada mengundang penekanan tanpa alasan.
    if ((isi.konteks.dokumen || []).length === 0) {
      void sisipkanPermintaan(panel, isi.konteks.nomorPerkara);
    }
    await terapkanTanda(isi.konteks);
    // Form ikrar talak terisi otomatis bila sidang ikrar sudah terlaksana (18 Okt 2026, butir 31).
    if (typeof ikrarOtomatis === "function") void ikrarOtomatis(isi.konteks);
  } catch {
    // Jaringan bermasalah, ALETA mati, jawaban bukan JSON. Dulu ketiganya
    // berakhir sama: tidak menampilkan apa pun, dan petugas menyimpulkan
    // ekstensinya rusak. Sekarang simpanan dipakai bila ada - dan bila tidak
    // ada pun, diamnya tetap seperti dulu: SIPP berjalan seperti biasa.
    try {
      await gambarDariSimpanan(nomor);
    } catch {
      /* simpanan pun gagal - tidak ada yang dapat dikerjakan lagi */
    }
  } finally {
    sedangAmbil = false;
  }
}

/**
 * SIPP memuat isi tabnya lewat AJAX.
 *
 * Menyisipkan saat halaman siap saja TIDAK cukup - nomor perkara sering baru
 * muncul setelah tab pertama selesai dimuat. Inilah sebab paling umum lapisan
 * semacam ini "kadang muncul kadang tidak".
 *
 * Pengamat dibatasi jedanya supaya perubahan DOM yang beruntun tidak memicu
 * puluhan permintaan.
 */
let jeda = null;

/**
 * ============================================================================
 * SISIPAN ALETA SENDIRI TIDAK BOLEH MEMICU PENYEGARAN
 * ============================================================================
 *
 * Pengamat ini mendengarkan SELURUH isi halaman. Panel, penanda baris, dan
 * sisipan jadwal semuanya ditulis ke dalam halaman yang sama - sehingga tiap
 * kali ALETA menggambar, pengamatnya sendiri terpicu dan menjadwalkan
 * penyegaran berikutnya. Penyegaran itu menggambar lagi, dan seterusnya.
 *
 * Putarannya memang berhenti sendiri - penjaga nomorTerakhir memotongnya -
 * tetapi tidak sebelum beberapa putaran penuh berjalan pada tiap halaman,
 * lengkap dengan pembacaan penyimpanan dan penyapuan seluruh baris tabel.
 * Itulah yang terasa sebagai tersendat.
 *
 * Karena itu perubahan yang berasal DARI DALAM elemen ALETA diabaikan.
 */
function elemenAleta(simpul) {
  if (!simpul || simpul.nodeType !== 1) return false;
  const el = /** @type {Element} */ (simpul);
  if (el.id === PENANDA) return true;
  if (el.hasAttribute && el.hasAttribute(TANDA)) return true;
  const kelas = el.classList;
  return Boolean(kelas && (kelas.contains("aleta-sisip") || kelas.contains("aleta-tanda")));
}

/**
 * Apakah satu perubahan berasal dari ALETA sendiri?
 *
 * Pada perubahan childList, target adalah INDUKNYA - dan induk itu elemen
 * SIPP: panel disisipkan ke body, penanda ke sel tabel, sisipan jadwal ke
 * sel Ruang & Data Persidangan. Memeriksa targetnya saja karena itu tidak
 * menangkap apa pun; yang harus diperiksa simpul yang DITAMBAHKAN.
 */
function perubahanDariAleta(perubahan) {
  if (perubahan.type !== "childList") return elemenAleta(perubahan.target);

  const ditambah = Array.from(perubahan.addedNodes || []);
  const dihapus = Array.from(perubahan.removedNodes || []);
  if (ditambah.length === 0 && dihapus.length === 0) return false;

  // Hanya bila SELURUH simpul yang berubah milik ALETA. Satu simpul SIPP saja
  // sudah cukup menjadikannya perubahan yang perlu ditanggapi.
  return [...ditambah, ...dihapus].every(elemenAleta);
}

const pengamat = new (globalThis.ALETA_PENGAMAT ? globalThis.ALETA_PENGAMAT.Pengamat : MutationObserver)((daftar) => {
  let adaDariSipp = false;
  for (const perubahan of daftar) {
    if (!perubahanDariAleta(perubahan)) {
      adaDariSipp = true;
      break;
    }
  }
  if (!adaDariSipp) return;

  if (jeda) clearTimeout(jeda);
  jeda = setTimeout(() => {
    // Bingkai CKEditor selesai dibangun beberapa saat sesudah tingkap
    // Putusan Akhir muncul. Di sinilah ia tertangkap - tanpa satu pun
    // pengamat tambahan, dan tanpa jam yang berdetak terus.
    warnaiCkeditor();
    // Dikerjakan saat peramban senggang, supaya penyapuan tabel tidak pernah
    // bersaing dengan gulir atau ketikan petugas. Peramban lama yang belum
    // punya requestIdleCallback tetap dilayani lewat jalur biasa.
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => void segarkan(), { timeout: 1200 });
    } else {
      void segarkan();
    }
  }, 400);
});

/**
 * Menjalankan penggambaran ALETA dengan pengamat DILEPAS.
 *
 * Penyaring di atas sudah menutup sebagian besar jalannya, tetapi ia bersandar
 * pada pengenalan tiap simpul - dan simpul yang terlewat mengenali dirinya
 * akan memicu putaran gambar-amati-gambar lagi. Melepas pengamat selama
 * menggambar menutup jalan itu seluruhnya, bukan sebagian.
 */
function tanpaPengamat(kerja) {
  pengamat.disconnect();
  try {
    kerja();
  } finally {
    // Perubahan yang menumpuk selama dilepas sengaja TIDAK diambil kembali:
    // itulah justru perubahan buatan ALETA sendiri.
    pengamat.takeRecords();
    pengamat.observe(document.body, { childList: true, subtree: true });
  }
}
pengamat.observe(document.body, { childList: true, subtree: true });
// Audit 17 Okt: pemilih berkas ALETA tidak ikut terbaca SubmitHandling unggah e-Doc SIPP (panel-alat.js).
if (typeof alatJagaPemilihBerkasSipp === "function") alatJagaPemilihBerkasSipp(document);

// Saklar dari popup berlaku seketika, tanpa memuat ulang halaman SIPP.
// Memuat ulang halaman kerja orang hanya karena sebuah saklar ditekan adalah
// gangguan yang tidak perlu - dan menghindarinya juga menghemat satu izin.
chrome.storage.onChanged.addListener((perubahan, wilayah) => {
  if (wilayah !== "local") return;

  // Salinan di memori diperbarui lebih dulu - itulah yang dibaca seluruh
  // pemeriksaan di bawah, dan membiarkannya basi berarti saklarnya seolah
  // tidak berfungsi sampai halaman dimuat ulang.
  if (perubahan.aktif) saklar.aktif = perubahan.aktif.newValue !== false;
  // 17 (12 Okt sore): kunci yang DIHAPUS (newValue tak ada) kembali ke bawaan MENYALA -
  // sama dengan muatSaklar ("!== false"). Dulu "=== true" membuat penghapusan kunci
  // mematikan penanda sampai halaman dimuat ulang, padahal bacaan awalnya menyala.
  if (perubahan.tandaiHalaman) saklar.tandaiHalaman = perubahan.tandaiHalaman.newValue !== false;
  if (perubahan.sisipJadwal) saklar.sisipJadwal = perubahan.sisipJadwal.newValue === true;

  // ==========================================================================
  // TEMA IKUT SEKETIKA, TERMASUK DARI TAB LAIN - LEWAT PUSAT
  // ==========================================================================
  //
  // Petugas lazim membuka SIPP di beberapa tab sekaligus. Perubahan tema dari
  // tab lain, popup, atau tampilan sistem sampai lewat ikutiPusatTemaSipp
  // (pusat memantau chrome.storage, localStorage, dan matchMedia sendiri);
  // pendengar ini tidak lagi membaca temaPanel mentah.

  // ==========================================================================
  // WARNA PALET IKUT SEKETIKA JUGA - INI YANG DULU TERTINGGAL
  // ==========================================================================
  //
  // Tema (gelap/terang) sudah diikuti sejak lama oleh blok di atas, tetapi
  // WARNA paletnya tidak: panel ABT mendapatkannya lewat alatPasangPanel yang
  // memasang alatDengarkanTemaPalet, sedangkan panel SIPP dibangun sendiri di
  // berkas ini dan tidak pernah memanggilnya.
  //
  // Akibatnya persis seperti yang dilaporkan: mengganti warna di popup
  // mengubah ABT seketika sementara SIPP diam sampai dimuat ulang - dan yang
  // membacanya menyimpulkan popupnya tidak berlaku untuk SIPP.
  //
  // Yang dipanggil di sini alatSelaraskanWarna, bukan alatTerapkanWarna
  // langsung: hanya ia yang tahu panel mana yang sudah DILEPAS dari popup,
  // dan panel yang dilepas memang tidak boleh ikut.
  if (perubahan[KUNCI_WARNA_GELAP]) {
    const nama = String(perubahan[KUNCI_WARNA_GELAP].newValue || "");
    void alatSelaraskanWarna(nama);
  }

  if (perubahan.aktif) {
    nomorTerakhir = "";
    void segarkan();
    return;
  }

  // ==========================================================================
  // POSISI DIKEMBALIKAN DARI POPUP CHROME
  // ==========================================================================
  //
  // Panel dapat tergeser sampai keluar layar - terutama sesudah berpindah ke
  // monitor yang lebih kecil, atau sesudah jendela diperkecil ketika panelnya
  // sedang di tepi kanan. Kalau sudah begitu, TIDAK ADA jalan mengembalikannya
  // dari panel itu sendiri: tombolnya ikut hilang bersama panelnya.
  //
  // Karena itu jalan keluarnya harus dari luar - dari popup ikon Chrome, satu-
  // satunya yang selalu terjangkau. Popup menghapus posisi tersimpan, dan
  // pendengar ini yang mengembalikan panelnya ke tempat semula tanpa memuat
  // ulang halaman.
  if (perubahan[KUNCI_POSISI] && perubahan[KUNCI_POSISI].newValue === undefined) {
    const panel = document.getElementById(PENANDA);
    if (panel) {
      kembalikanBawaan(panel);
      panel.classList.remove("aleta-panel-penuh", KELAS_LENCANA);
      panel.removeAttribute("title");
      // Tombolnya ikut dikembalikan. Panel yang sudah terbentang tetapi
      // tombolnya masih bertuliskan "bentangkan" membuat tekanan berikutnya
      // mengerjakan kebalikan dari yang dibaca orang.
      const lipat = panel.querySelector(".aleta-lipat");
      if (lipat) {
        lipat.textContent = "–";
        lipat.title = "Ciutkan menjadi lencana";
      }
    }
  }

  // Saklar penandaan tidak perlu memanggil ALETA lagi: konteks perkara yang
  // sedang dibuka masih tersimpan.
  if (perubahan.tandaiHalaman || perubahan.sisipJadwal) {
    if (konteksTerakhir) void terapkanTanda(konteksTerakhir);
    else bersihkanTanda();
  }
});

void segarkan();

/*
 * ============================================================================
 * TAHAP 7 - PANEL SIPP DALAM TAMPILAN BARU DAN UI BARU, DAN MODE LATIHAN
 * ============================================================================
 *
 * Rencana "ekstensi dulu", 29 September 2026. Polanya sama dengan Tahap 4 di
 * aleta.js: semua yang ada di blok ini TAMBAHAN yang menumpang pada panel
 * lama yang sudah jadi. susunPanel tetap menyusun panelnya persis seperti
 * sebelumnya, lalu t7Tata menata dan menambahinya di ujungnya. Sebabnya satu:
 * tampilan Lama harus tetap sama sampai ke DOM, permintaan, penyimpanan, dan
 * terutama apa yang ditulis ke SIPP - dan cara paling pasti untuk itu adalah
 * tidak menyentuh jalur yang menyusunnya.
 *
 * Tiga pagar, ditanyakan ke panel-alat.js lewat pembungkus yang memeriksa
 * keberadaannya dahulu (uji lama memuat berkas ini dengan sebagian fungsi
 * panel-alat.js saja - yang tidak diketahui dianggap "Lama"):
 *
 *   tampilan Lama       t7Tata hanya mencatat tanda tampilan - di WeakMap,
 *                       bukan di elemen - lalu pulang. Tidak ada atribut,
 *                       permintaan, pengamat, maupun pewaktu.
 *   ide sipp-N          hanya bila alatFiturNyala("sipp-N"), di Baru maupun
 *                       UI Baru.
 *   perbaikan D1-D15    hanya dalam UI Baru (alatKulit() === "modern").
 *
 * Titik sambung di jalur lama, masing-masing MENDELEGASIKAN apa adanya dalam
 * tampilan Lama: t7Tata (ujung susunPanel), t7GambarPenilaian (menu
 * Penilaian SK), t7RaporAgen (praperiksa), t7PasangPenyunting (kotak teks
 * putusan otomatis). Mode latihan punya titiknya sendiri di kirimKeJembatan
 * dan berlaku di SEMUA tampilan - lihat t7JembatanLatihan.
 *
 * ============================================================================
 * TIDAK ADA JALAN TULIS BARU
 * ============================================================================
 *
 * Tidak satu pun fitur di sini menulis ke SIPP. Yang menulis tetap tombol
 * lama, dengan pendengarnya yang lama:
 *
 *   bilah bawah penetapan   MENEKAN tombol Tetapkan yang sama - dua tekanan
 *                           seperti biasa, rencananya tampil lebih dulu
 *   Zona berbahaya          MEMINDAHKAN tombol pembongkar yang sama ke menu ⋯
 *                           dan menambah gerbang ketik nomor perkara
 *   templat pertimbangan    hanya menyisip ke kotak teks PANEL; baru sampai ke
 *                           SIPP lewat "Isikan yang dicentang" yang sudah ada
 *   penyunting teks kaya    menyunting kotak teks panel yang sama
 *
 * Permintaan baru seluruhnya GET, kecuali Laporkan masalah (sipp-30) yang
 * menulis ke Masukan portal - bukan ke SIPP - dan tetap tunduk pada mode
 * kering, mode latihan, dan mode coba (lihat ALETA_COBA_BOLEH).
 */
const T7_KUNCI_TAB = "tabPanelSipp";
const T7_ATRIBUT_LABUH = "data-aleta-sipp-labuh";
const T7_LEBAR_BAWAAN = 470;
/** Tanda tampilan saat panel disusun - di luar elemennya, supaya DOM Lama tidak berubah. */
const t7TandaPanel = new WeakMap();
/** Panel yang sedang ditata (satu halaman, satu panel perkara). */
let t7Keadaan = null;
/** Pengamat <body> untuk labuh - satu per halaman, hanya lahir dalam UI Baru. */
let t7PengamatLabuh = null;
let t7LebarTersimpan = 0;

// ─── Pembungkus fondasi Tahap 1 ──────────────────────────────────────────────

function t7Mode() {
  try {
    return typeof alatUjiMode === "function" ? String(alatUjiMode() || "lama") : "lama";
  } catch {
    return "lama";
  }
}

function t7Aktif() {
  return t7Mode() !== "lama";
}

function t7Modern() {
  try {
    return t7Aktif() && typeof alatKulit === "function" && alatKulit() === "modern";
  } catch {
    return false;
  }
}

function t7Nyala(kode) {
  try {
    return typeof alatFiturNyala === "function" && alatFiturNyala(kode) === true;
  } catch {
    return false;
  }
}

/** Ringkasan tampilan: berubah = panel perlu disusun ulang. */
function t7TandaTampilan() {
  const nyala = [];
  for (let i = 1; i <= 30; i += 1) if (t7Nyala(`sipp-${i}`)) nyala.push(i);
  return `${t7Mode()}|${t7Modern() ? "modern" : "klasik"}|${nyala.join(",")}`;
}

function t7Tulis(isi) {
  try {
    Promise.resolve(chrome.storage.local.set(isi)).catch(() => {
      /* berlaku untuk halaman ini saja */
    });
  } catch {
    /* di luar konteks ekstensi */
  }
}

/**
 * Satu bacaan GET ke portal. Pulang { ok, status, data, pesan } dan TIDAK
 * PERNAH melempar. 404 = rutenya belum ada di server yang terpasang, dan itu
 * disebut apa adanya ("belum tersedia di server"), bukan sebagai galat.
 */
async function t7AmbilJson(alamat, keterangan) {
  const opsi = { credentials: "include", cache: "no-store" };
  try {
    // Lewat alatAmbil, seperti tiap permintaan yang kegagalannya dibaca petugas.
    const respons = await alatAmbil(alamat, opsi, keterangan);
    let badan = null;
    try {
      badan = await respons.json();
    } catch {
      badan = null;
    }
    if (respons.status === 404) {
      return { ok: false, status: 404, data: null, pesan: `${keterangan}: belum tersedia di server.` };
    }
    if (!respons.ok) {
      const dariPortal = badan && badan.error && badan.error.message ? String(badan.error.message) : "";
      const pesan =
        dariPortal ||
        (badan && badan.pesan ? String(badan.pesan) : "") ||
        (typeof alatPesanGagal === "function" ? alatPesanGagal(null, respons.status, keterangan) : `${keterangan} gagal (status ${respons.status}).`);
      return { ok: false, status: respons.status, data: null, pesan };
    }
    const data = badan && typeof badan === "object" && "data" in badan ? badan.data : badan;
    return { ok: true, status: respons.status, data, pesan: "" };
  } catch (galat) {
    const pesan =
      typeof alatPesanGagal === "function" ? alatPesanGagal(galat, 0, keterangan) : `${keterangan} gagal: ${String((galat && galat.message) || galat)}`;
    return { ok: false, status: 0, data: null, pesan };
  }
}

/** Teks polos dari HTML medan kaya - untuk catatan latihan dan cuplikan. */
function t7TeksPolos(html) {
  const s = String(html || "");
  if (!/[<&]/.test(s)) return s;
  try {
    const dok = new DOMParser().parseFromString(s, "text/html");
    return String((dok.body && dok.body.textContent) || "").replace(/\s+/g, " ").trim();
  } catch {
    return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }
}

// ─── Mode latihan: jembatan ──────────────────────────────────────────────────

/**
 * "tekan" dan "isi" selama mode latihan (ide sipp-28). Tidak satu pesan pun
 * berangkat ke jembatan - halaman SIPP tidak tersentuh sama sekali.
 *
 *   tekan  dijawab gagal "mode_latihan": pemanggil menyebut Simpan tidak
 *          ditekan (bunyiSimpanTidakDitekan), dan tidak ada yang mengira
 *          SIPP sudah menyimpan.
 *   isi    dijawab BERHASIL dengan tanda latihan, supaya alurnya berjalan
 *          sampai ujung dan SELURUH medan yang akan diisi tercatat - bukan
 *          hanya medan pertama. Yang dicatat nilai yang AKAN diisikan.
 *
 * Riwayat tindakan (jalan pulang di laci perkakas) sengaja tidak diisi: tidak
 * ada medan yang berubah, jadi tidak ada yang perlu dipulihkan - dan baris
 * "pulihkan" yang palsu akan mengisi medan SIPP atas nama mengembalikannya.
 */
function t7JembatanLatihan(pesan, jenis, penunjuk) {
  const catat = (b) => {
    try {
      if (typeof alatCatatLatihan === "function") alatCatatLatihan(b);
    } catch {
      /* catatan hilang, penahanannya tetap */
    }
  };
  if (jenis === "tekan") {
    catat({ jenis: "tekan", sebutan: "Menekan tombol Simpan SIPP", rinci: `${penunjuk} - TIDAK ditekan` });
    return Promise.resolve({ ok: false, alasan: "mode_latihan" });
  }
  const mentah = pesan && pesan.nilai !== undefined && pesan.nilai !== null ? String(pesan.nilai) : "";
  const teks = String((pesan && pesan.jenisMedan) || "") === "kaya" ? t7TeksPolos(mentah) : mentah;
  catat({
    jenis: "isi",
    sebutan: `Mengisi medan SIPP ${penunjuk}`,
    rinci: teks ? `akan diisi: "${teks.length > 160 ? `${teks.slice(0, 160)}…` : teks}"` : "akan dikosongkan",
  });
  return Promise.resolve({ ok: true, latihan: true, alasan: "mode_latihan" });
}

/**
 * Membuka satu kelompok atau bagian dari mana pun (menu, langkah, cari):
 * tabnya dipindah lebih dulu - bagian yang SUDAH terbuka tidak ditekan
 * kepalanya oleh bukaBagianPanel, jadi tabnya tidak akan pindah sendiri.
 */
function t7Buka(k, kunci) {
  const sasaran = k.panel.querySelector(`[data-kunci="${kunci}"]`);
  const kel = sasaran ? sasaran.closest(".aleta-kelompok") || (sasaran.classList.contains("aleta-kelompok") ? sasaran : null) : null;
  if (kel && kel.dataset.kunci && k.panel.hasAttribute("data-t7-tab")) t7PilihTab(k.panel, kel.dataset.kunci, false);
  bukaBagianPanel(k.panel, kunci);
}

/** D3: pindah tab - kelompok lain disembunyikan lewat CSS, lipatannya tidak disentuh. */
function t7PilihTab(panel, kunci, simpan) {
  // Tab yang disembunyikan menu peran (data-mps-sembunyi) tidak dapat dipilih.
  if (!panel || !panel.querySelector(`.aleta-t7-tab[data-t7-ke="${kunci}"]:not([data-mps-sembunyi])`)) return;
  panel.setAttribute("data-t7-tab", kunci);
  for (const t of Array.from(panel.querySelectorAll(".aleta-t7-tab"))) {
    t.setAttribute("aria-selected", t.getAttribute("data-t7-ke") === kunci ? "true" : "false");
  }
  // R 11 Okt: baris atas (Langkah/Perkara berikutnya) milik tab utama saja.
  if (typeof r11SetelTabUtama === "function") r11SetelTabUtama(panel);
  if (simpan) t7Tulis({ [T7_KUNCI_TAB]: kunci });
  t7GulirTabKeTampak(panel);
}

/**
 * V2 (18 Okt, layar kecil): bilah tab dapat digulir ke samping di layar sempit.
 * Tab yang baru dipilih digulir ke tengah bilah supaya tidak tersembunyi di
 * luar tepi - hanya bilahnya yang digulir, halaman SIPP tidak ikut bergerak.
 */
function t7GulirTabKeTampak(panel) {
  try {
    const bilah = panel.querySelector(".aleta-t7-tabbar");
    const tab = bilah && bilah.querySelector('.aleta-t7-tab[aria-selected="true"]');
    if (!bilah || !tab || bilah.scrollWidth <= bilah.clientWidth + 1) return;
    const tujuan = tab.offsetLeft - Math.max(0, (bilah.clientWidth - tab.offsetWidth) / 2);
    bilah.scrollLeft = Math.max(0, tujuan);
  } catch {
    /* tanpa gulir otomatis, bilah tetap dapat digulir tangan */
  }
}

// ─── sipp-16 / sipp-17: buka di ALETA, salin cepat ───────────────────────────

function t7AlamatAleta(nomor) {
  return `${location.origin}/aleta/aleta-ecourt?perkara=${encodeURIComponent(String(nomor || ""))}`;
}

// ─── D1: panel berlabuh di kanan ─────────────────────────────────────────────

/**
 * Atribut <html data-aleta-sipp-labuh="kanan"> hanya selama panel UI Baru
 * TERBENTANG. Lencana, layar penuh, panel yang dibuang, dan kembali ke Lama
 * melepasnya - halaman SIPP kembali selebar semula. Pola yang sama dengan
 * letak "samping" panel portal (Tahap 4).
 */
function t7TerapkanLabuh() {
  const panel = document.getElementById(PENANDA);
  let nyala = false;
  if (panel && panel.isConnected && panel.getAttribute("data-t7") === "ui" && t7Modern()) {
    nyala = !panel.classList.contains(KELAS_LENCANA) && !panel.classList.contains("aleta-panel-penuh");
    // Perbaikan 2 Okt (S, butir 11): dilepas lewat klik 2x sudut = mengambang
    // sampai "↺ kembali ke bawaan" (kembalikanBawaan).
    if (keadaanPanel && keadaanPanel.lepasLabuh) nyala = false;
  }
  try {
    const akar = document.documentElement;
    if (nyala) {
      akar.setAttribute(T7_ATRIBUT_LABUH, "kanan");
      if (t7LebarTersimpan) akar.style.setProperty("--aleta-t7-lebar", `${t7LebarTersimpan}px`);
    } else if (akar.hasAttribute(T7_ATRIBUT_LABUH)) {
      akar.removeAttribute(T7_ATRIBUT_LABUH);
      akar.style.removeProperty("--aleta-t7-lebar");
    }
  } catch {
    /* tanpa atributnya, panel mengambang seperti semula */
  }
  // 21 Okt 2026: pengamat dipasang juga pada panel yang LAHIR sebagai lencana (semua panel bawaannya terlipat) -
  // dulu hanya bila sudah berlabuh, sehingga panel yang dibentangkan dari lencana tidak pernah berlabuh kanan.
  if (panel && panel.isConnected && panel.getAttribute("data-t7") === "ui" && t7Modern() && !panel.aletaT7Diamati) {
    panel.aletaT7Diamati = true;
    const p = new MutationObserver(() => t7TerapkanLabuh());
    p.observe(panel, { attributes: true, attributeFilter: ["class"] });
    if (t7Keadaan) t7Keadaan.pengamat.push(p);
  }
  if (nyala && !t7PengamatLabuh && document.body) {
    // Panel yang dibuang (saklar induk dimatikan, perkara berganti) harus
    // melepas labuhnya - hanya childList langsung <body>, tidak menyelam.
    t7PengamatLabuh = new MutationObserver(() => {
      // Halaman yang sedang ditutup dapat mengirim satu kabar terakhir sesudah
      // dokumennya tiada - dibiarkan tanpa galat (pola sama dengan pengamat lain).
      try {
        if (!document.getElementById(PENANDA)) t7TerapkanLabuh();
      } catch {
        /* dokumen sudah tiada - tidak ada panel yang perlu dilepas labuhnya */
      }
    });
    t7PengamatLabuh.observe(document.body, { childList: true });
  }
  t7SetelSembul();
}

/**
 * ============================================================================
 * SEMBUL SIPP TIDAK TERTUTUP PANEL (perbaikan 5 Okt butir 15)
 * ============================================================================
 *
 * Jendela sembul SIPP (.popup / .popup2nd / #popup-detil: "TAMBAH REFERENSI
 * DATA PIHAK", "TAMBAH DATA PIHAK SAKSI", ...) adalah lapisan fixed selebar
 * layar - margin-right body milik panel berlabuh tidak menyentuhnya, sehingga
 * sisi kanannya tertutup panel. Selama panel berlabuh kanan, area sembul
 * dipersempit ke kiri (lebar = layar - lebar panel); kartu KTP di kiri ikut
 * dihindari bila sisanya masih cukup lebar.
 *
 * KECUALI panel lebih lebar dari setengah halaman: sembul dibiarkan apa
 * adanya (tertutup panel saja) - mempersempitnya sampai kurang dari separuh
 * layar merusak tata letak blangko SIPP lebih parah daripada tertutup.
 *
 * Yang diubah hanya atribut dan dua peubah CSS di <html>; DOM SIPP tidak
 * disentuh. Dipanggil saat labuh berubah, tuas lebar digeser, jendela
 * diubah ukurannya, dan kartu KTP dibuka/ditutup (saksiscan.js).
 */
const T7_ATRIBUT_SEMBUL = "data-aleta-sembul-geser";
const T7_SEMBUL_SISA_MIN = 640;
let t7SembulDengar = false;

function t7SetelSembul() {
  let akar = null;
  try {
    akar = document.documentElement;
  } catch {
    return;
  }
  if (!akar) return;
  const lebarLayar = Number(window.innerWidth) || 0;
  let kanan = 0;
  if (akar.getAttribute(T7_ATRIBUT_LABUH) === "kanan" && lebarLayar >= 900) {
    const panel = document.getElementById(PENANDA);
    let lebarPanel = 0;
    try {
      lebarPanel = panel ? Math.round(panel.getBoundingClientRect().width) : 0;
    } catch {
      lebarPanel = 0;
    }
    if (!lebarPanel) lebarPanel = Math.min(t7LebarTersimpan || T7_LEBAR_BAWAAN, Math.round(lebarLayar * 0.6));
    if (lebarPanel <= lebarLayar / 2) kanan = lebarPanel;
  }
  let kiri = 0;
  const kartu = document.querySelector(".aleta-c2-saksi:not([hidden])");
  if (kartu) {
    let lebarKartu = 0;
    try {
      const r = kartu.getBoundingClientRect();
      lebarKartu = Math.round(r.right || r.width || 0);
    } catch {
      lebarKartu = 0;
    }
    if (lebarKartu > 0) lebarKartu += 12;
    if (lebarKartu > 0 && lebarLayar - kanan - lebarKartu >= T7_SEMBUL_SISA_MIN) kiri = lebarKartu;
  }
  try {
    if (kiri || kanan) {
      akar.setAttribute(T7_ATRIBUT_SEMBUL, "ya");
      akar.style.setProperty("--aleta-sembul-kiri", `${kiri}px`);
      akar.style.setProperty("--aleta-sembul-kanan", `${kanan}px`);
    } else if (akar.hasAttribute(T7_ATRIBUT_SEMBUL)) {
      akar.removeAttribute(T7_ATRIBUT_SEMBUL);
      akar.style.removeProperty("--aleta-sembul-kiri");
      akar.style.removeProperty("--aleta-sembul-kanan");
    }
  } catch {
    /* sembul tetap selebar layar */
  }
  if (!t7SembulDengar) {
    t7SembulDengar = true;
    window.addEventListener("resize", () => t7SetelSembul());
  }
}

// ─── Penyusunan ulang saat tampilan berganti ─────────────────────────────────

/**
 * Pengalih di popup (Lama / Baru / UI Baru, saklar fitur) berlaku seketika:
 * panel yang tandanya berbeda digambar ulang dari konteks yang sudah ada -
 * portal tidak ditanya lagi. Dalam Lama yang tidak pernah berganti, tandanya
 * sama dan tidak ada yang dikerjakan.
 */
function t7UjiBerubah() {
  const panel = document.getElementById(PENANDA);
  if (!panel) {
    t7TerapkanLabuh();
    return;
  }
  const lama = t7TandaPanel.get(panel);
  if (lama === undefined || lama === t7TandaTampilan()) return;
  t7TandaPanel.set(panel, t7TandaTampilan());
  if (!t7Modern()) t7TerapkanLabuh();
  if (typeof gambarUlangKonteks === "function" && konteksTerakhir) void gambarUlangKonteks();
}

document.addEventListener("aleta-uji-berubah", t7UjiBerubah);

function a30Aktif() {
  return typeof t7Aktif === "function" && t7Aktif();
}

// ─── 1.189.x butir 1 & 3: tab Kasir (basmassal.js, IIFE aletaKasir*) ─────────

/**
 * Hak Kasir akun ALETA yang masuk: jawaban server (pengguna.bolehKasir dari
 * sipp-konteks) atau dihitung dari nama peran (alatBolehKasir, panel-alat.js).
 * Rute kasir tetap menolak sendiri - ini kenyamanan.
 */
function a30BolehKasir() {
  if (typeof globalThis.aletaKasirPasang !== "function" || typeof alatBolehKasir !== "function") return false;
  try {
    return alatBolehKasir(typeof penggunaTerakhir !== "undefined" ? penggunaTerakhir : null) === true;
  } catch {
    return false;
  }
}

/* === R 11 Okt === */
/*
 * ============================================================================
 * TAMPILAN KASIR & PER PERAN (perbaikan 11 Okt 2026, agen R)
 * ============================================================================
 *
 * Temuan pengguna di 1.192.0 (SIPP lokal, Super Admin):
 *
 *  1. Halaman jurnal per perkara (detil_biaya): tab Kasir terpilih, tetapi
 *     Penetapan, PTSP, Riwayat ALETA, Langkah/Perkara berikutnya ikut tampil.
 *     SEBABNYA: aturan CSS penyaring tab (panel.css, "Hanya kelompok tab yang
 *     dipilih yang tampil") tidak memuat kasirKel - memilih tab Kasir tidak
 *     menyembunyikan kelompok mana pun; dan baris atas (.aleta-t7-atas:
 *     Langkah berikutnya, Perkara berikutnya) bukan anggota kelompok mana pun
 *     sehingga tampil di SEMUA tab. Sekarang: penyaring kasirKel ditambahkan,
 *     baris atas milik tab utama (tab pertama menu peran), dan halaman jurnal
 *     per perkara = Kasir saja bagi yang boleh Kasir - juga Super Admin
 *     (konteks halaman mengalahkan "semua").
 *  3. Lencana bulat di samping tab Kasir seperti tab lain. Sumbernya
 *     globalThis.aletaKasirRingkas({ perkaraId, nomorPerkara, segar }) milik
 *     basmassal.js (agen K, 5d751d7) -> { usulan, kejadian, keadaan, saldo }
 *     (juga diterima: { terbuka, lengkap, teks?, nada? } | angka) | null.
 *     Bila belum ada: cadangan ringan GET rute kasir per perkara yang
 *     sudah ada (jumlah usulan tercentang), disinggah 2 menit per perkara.
 *     Peristiwa "aleta-kasir-berubah" di document = segarkan lencana.
 *  4. Kasir massal/pengingat/rekap pindah dari tab per perkara dan dashboard
 *     ke halaman daftar jurnal keuangan (jurnal_perkara_list/*,
 *     all_jurnal_perkara). Fiturnya sama - hanya tempatnya.
 *  5. Golongan menu Kasir & PTSP (panel-alat.js alatGolonganMenuSemua).
 *
 * Tampilan Lama tidak tersentuh: semua jalur di sini dijaga a30Aktif().
 */
const R11_API_KASIR = "/aleta/api/aleta-ecourt/sidang/kasir";

/** Halaman DAFTAR jurnal keuangan ("JURNAL KEUANGAN PERKARA PERDATA GUGATAN/PERMOHONAN"). */
function r11HalamanJurnalDaftar() {
  return /\/(?:jurnal_perkara_list|all_jurnal_perkara|jurnal_all_perkara)(?:\/|$)/i.test(String(location.pathname || ""));
}

/** Seperti r11DaftarHanyaKasir, sesudah akun ALETA terbaca (segarkan memanggilnya sebelum panel apa pun). */
async function r11SiapHalamanJurnalDaftar() {
  if (!r11HalamanJurnalDaftar() || typeof a30Aktif !== "function" || !a30Aktif()) return false;
  if (typeof muatPenggunaAleta === "function") await muatPenggunaAleta();
  return a30BolehKasir();
}

/** Ringkasan daftar pengganti bila baris jurnal tidak terbaca sebagai daftar perkara. */
function r11RingkasanJurnal() {
  let jumlah = 0;
  try {
    jumlah = typeof barisPerkaraDiHalaman === "function" ? barisPerkaraDiHalaman().length : 0;
  } catch {
    jumlah = 0;
  }
  return { jumlah, ditandai: true, bertanda: 0, sebab: {}, penetapan: {}, r11Cadangan: true };
}

/** data-r11-tab-utama: tab terpilih = tab pertama yang tampak (pemilik baris atas). */
function r11SetelTabUtama(panel) {
  if (!panel || typeof panel.getAttribute !== "function") return;
  const pilihan = panel.getAttribute("data-t7-tab") || "";
  const pertama = panel.querySelector(":scope > .aleta-t7-tabbar > .aleta-t7-tab:not([data-mps-sembunyi])");
  const utama = pertama ? pertama.getAttribute("data-t7-ke") : pilihan;
  if (pilihan && pilihan === utama) {
    if (!panel.hasAttribute("data-r11-tab-utama")) panel.setAttribute("data-r11-tab-utama", "");
  } else if (panel.hasAttribute("data-r11-tab-utama")) {
    panel.removeAttribute("data-r11-tab-utama");
  }
}

/** nomor perkara -> Promise<"perkaraId" | ""> (rute Kasir ?cari=, hanya SELECT); disinggah per halaman. */
const r11SinggahId = new Map();
function r11CariPerkaraId(nomor) {
  const n = String(nomor || "").trim();
  if (!n) return Promise.resolve("");
  if (r11SinggahId.has(n)) return r11SinggahId.get(n);
  const janji = (async () => {
    const r = await alatAmbil(`${R11_API_KASIR}?cari=${encodeURIComponent(n)}`, { credentials: "include", cache: "no-store" }, "Mencari perkara Kasir");
    if (!r || !r.ok) return "";
    const luar = await r.json().catch(() => null);
    const isi = luar && luar.data ? luar.data : luar;
    const cocok = (isi && Array.isArray(isi.perkara) ? isi.perkara : []).find((p) => p && String(p.nomorPerkara || "").trim() === n);
    return cocok && /^\d+$/.test(String(cocok.perkaraId)) ? String(cocok.perkaraId) : "";
  })().catch(() => "");
  r11SinggahId.set(n, janji);
  // Gagal/tidak ketemu tidak disinggah selamanya - halaman berikutnya boleh mencoba lagi.
  janji.then((id) => {
    if (!id) r11SinggahId.delete(n);
  });
  return janji;
}

/** Kalimat untuk permintaan yang ditahan mode coba / kering / latihan (423). */
function a30PesanDitahan(badan, apa) {
  const alasan = String((badan && badan.alasan) || "");
  const sebutan =
    alasan === "mode_latihan" ? "mode latihan" : alasan === "mode_kering" ? "mode kering" : alasan === "mode_coba" ? "mode coba" : "mode uji";
  return `${apa} ditahan ${sebutan} - tidak ada yang dikirim. ${String((badan && badan.pesan) || "").trim()}`.trim();
}

const s1Jeda = (ms) => new Promise((selesai) => setTimeout(selesai, ms));

/** Menunggu `cari()` memulangkan sesuatu, paling lama batasMs. */
async function s1Tunggu(cari, batasMs, jedaMs) {
  const mulai = Date.now();
  for (;;) {
    let hasil = null;
    try {
      hasil = cari();
    } catch {
      hasil = null;
    }
    if (hasil) return hasil;
    if (Date.now() - mulai >= batasMs) return null;
    await s1Jeda(jedaMs || 100);
  }
}

/* === IKRAR-OTOMATIS 18 Okt === */
/**
 * ============================================================================
 * FORM IKRAR TALAK TERISI OTOMATIS SAAT HALAMAN PERKARA DIBUKA (18 Okt 2026, butir 31)
 * ============================================================================
 *
 * Keputusan pengguna: form "Data Penetapan Ikrar Talak" SIPP diisi dari Jadwal Sidang
 * (tombol, lewat bot) DAN otomatis bila halaman perkara SIPP dibuka - seperti Putusan
 * otomatis. Syaratnya dijawab portal (GET ikrar-borang), bukan disimpulkan di sini:
 *
 *   - sidang ikrar sudah berketerangan ikrar terlaksana ("Ikrar Telah Dilaksanakan"),
 *   - form ikrar SIPP masih kosong (belum diikrarkan / tanpa amar),
 *   - tanggal ikrar sah (bukan akhir pekan / masa depan / mendahului putusan).
 *
 * Yang dikerjakan ekstensi hanya yang dikerjakan petugas dengan tangan, lewat jalan
 * yang ditawarkan SIPP sendiri: tab "Ikrar Talak" -> "Edit Data Penetapan Ikrar" (tautan
 * SIPP menjalankan popup_form miliknya; tidak ada alamat yang dirakit di sini) -> isi
 * tanggal, status, keadaan istri, dan amar -> Simpan.
 *
 * ATURAN SIMPAN sama dengan borang penetapan lain (Penunjukan otomatis): saklar
 * simpanOtomatis dari portal. Mati (bawaan) = borang terisi, petugas yang menekan Simpan.
 * Nyala = ALETA menekan Simpan satu kali. Mode latihan/kering/coba menahannya seperti
 * biasa (kirimKeJembatan). Tanpa kata ALETA di isian (AletaPenjagaTanda lewat isiBorang);
 * tanggal substantif tidak diubah - nilainya dari tanggal sidang ikrar di SIPP.
 *
 * SEKALI per perkara per pemuatan halaman; akun SIPP yang tidak berwenang tidak melihat
 * tautan Edit, jadi tidak ada yang terjadi. Akun yang tercatat di SIPP = akun yang
 * sedang masuk (borang di layar), bukan ketua majelis - berbeda dari tombol Jadwal Sidang.
 */
const IKRAR_API_BORANG = "/aleta/api/aleta-ecourt/ikrar-borang";
const IKRAR_BORANG = "#frm_verzet_putusan";
const IKRAR_MEDAN = [
  { medan: "tgl_ikrar", penunjuk: `${IKRAR_BORANG} input[name="tgl_ikrar"]`, jenis: "tanggal", wajib: true },
  { medan: "status_penetapan", penunjuk: `${IKRAR_BORANG} select[name="status_penetapan"]`, jenis: "pilih", wajib: true },
  { medan: "keadaan_istri", penunjuk: `${IKRAR_BORANG} select[name="keadaan_istri"]`, jenis: "pilih", wajib: true },
  { medan: "amar", penunjuk: `${IKRAR_BORANG} textarea[name="amar"]`, jenis: "kaya", wajib: true },
];
const ikrarOtoDicoba = new Set();
let ikrarOtoBerjalan = false;

function ikrarCariTautanEdit() {
  return document.querySelector('a[onclick*="edit_ikrar_talak_penetapan/"]');
}

function ikrarKabar(teks, gagal) {
  const panel = document.getElementById(PENANDA);
  const wadah = panel && panel.querySelector(".aleta-isi");
  if (!wadah) return;
  let k = wadah.querySelector("[data-aleta-ikrar-otomatis]");
  if (!k) {
    k = buatElemen("div", "aleta-kosong-lembut", "");
    k.setAttribute("data-aleta-ikrar-otomatis", "1");
    wadah.insertBefore(k, wadah.firstChild);
  }
  k.className = gagal ? "aleta-kosong-lembut aleta-abt-gagal" : "aleta-kosong-lembut";
  k.textContent = teks;
}

/** Membuka borang lewat tautan SIPP. Pulang { ok:true } atau { ok:false, pesan }. Tidak pernah melempar. */
async function ikrarBukaBorang() {
  if (document.querySelector(IKRAR_BORANG)) return { ok: true, sudah: true };
  let tautan = ikrarCariTautanEdit();
  if (!tautan) {
    const tab = document.querySelector('a[href="#tabs24"]');
    if (!tab) return { ok: false, pesan: "Tab Ikrar Talak tidak ada di halaman ini." };
    tab.click();
    tautan = await s1Tunggu(() => ikrarCariTautanEdit(), 15000, 50);
    if (!tautan) {
      return { ok: false, pesan: "Tab Ikrar Talak terbuka, tetapi tautan Edit Data Penetapan Ikrar tidak ada - akun SIPP ini tidak berwenang mengisinya." };
    }
  }
  tautan.click();
  const borang = await s1Tunggu(() => document.querySelector(IKRAR_BORANG), 15000, 50);
  if (!borang) return { ok: false, pesan: "Form ikrar tidak terbuka dalam 15 detik sesudah Edit Data Penetapan Ikrar ditekan." };
  return { ok: true };
}

async function ikrarOtomatis(konteks) {
  const nomor = String((konteks && konteks.nomorPerkara) || "").trim();
  if (!nomor || ikrarOtoBerjalan || ikrarOtoDicoba.has(nomor)) return;
  // Bukan halaman perkara cerai talak bersidang ikrar (tab Ikrar Talak tidak ada): diam.
  if (!document.querySelector('a[href="#tabs24"]') && !document.querySelector(IKRAR_BORANG)) return;
  ikrarOtoDicoba.add(nomor);
  ikrarOtoBerjalan = true;
  try {
    const j = await t7AmbilJson(`${IKRAR_API_BORANG}?nomor=${encodeURIComponent(nomor)}`, "Membaca isian form ikrar");
    if (!j.ok || !j.data || j.data.perlu !== true || !j.data.nilai) {
      alatCatat("ikrar-otomatis", `${nomor}: tidak diisi`, (j.data && j.data.alasan) || j.pesan || "");
      return;
    }
    const d = j.data;
    ikrarKabar(`Form ikrar talak ${nomor} kosong sedangkan ikrar sudah dilaksanakan - ALETA mengisinya…`, false);
    const buka = await ikrarBukaBorang();
    if (!buka.ok) {
      ikrarKabar(`${nomor}: ${buka.pesan}`, true);
      alatCatat("ikrar-otomatis", `${nomor}: form ikrar tidak terbuka`, buka.pesan);
      return;
    }
    // Borang yang dibuka petugas sendiri dan sudah terisi tidak ditimpa.
    const tglSekarang = document.querySelector(`${IKRAR_BORANG} input[name="tgl_ikrar"]`);
    if (tglSekarang && String(tglSekarang.value || "").trim()) {
      ikrarKabar(`Form ikrar talak ${nomor} sudah berisi tanggal ikrar - tidak ditimpa.`, false);
      return;
    }
    const isi = await isiBorang(IKRAR_MEDAN, d.nilai);
    if (!isi.ok) {
      ikrarKabar(`Form ikrar talak ${nomor} terisi sebagian (${isi.alasan}) - periksa lalu tekan Simpan sendiri.`, true);
      return;
    }
    const catatan = (Array.isArray(d.andaian) ? d.andaian : []).join(" ");
    if (d.simpanOtomatis !== "nyala") {
      ikrarKabar(`Form ikrar talak ${nomor} terisi (tanggal ikrar ${d.tanggalIkrar || ""}). Periksa, lalu tekan Simpan di SIPP. ${catatan}`.trim(), false);
      return;
    }
    const simpan = await kirimKeJembatan({ jenis: "tekan", penunjuk: `${IKRAR_BORANG} #simpan` });
    if (!simpan || !simpan.ok) {
      ikrarKabar(`Form ikrar talak ${nomor} terisi, tetapi Simpan tidak dapat ditekan (${(simpan && simpan.alasan) || "gagal"}). Tekan sendiri.`, true);
      return;
    }
    const tertutup = await s1Tunggu(() => !document.querySelector(IKRAR_BORANG), 8000, 100);
    ikrarKabar(
      tertutup
        ? `Form ikrar talak ${nomor} terisi dan disimpan (tanggal ikrar ${d.tanggalIkrar || ""}). ${catatan}`.trim()
        : `Form ikrar talak ${nomor} terisi dan Simpan ditekan, tetapi form belum tertutup - periksa pesan SIPP.`,
      !tertutup
    );
  } catch (galat) {
    ikrarKabar(`Form ikrar talak ${nomor} gagal diisi otomatis: ${String((galat && galat.message) || galat).slice(0, 120)}`, true);
  } finally {
    ikrarOtoBerjalan = false;
  }
}

/*
 * ============================================================================
 * PERBAIKAN 2 OKTOBER 2026 - PANEL SIPP (agen S, blok S2)
 * ============================================================================
 *
 * Pesan pengguna sesudah memakai 1.177.0 (DAFTAR "2 Okt"). Gerbang K1: semua
 * yang TAMPAK di sini hanya UI Baru (s2Aktif = s1Aktif = t7Modern). Lama dan
 * Baru tidak pernah memanggil blok ini, KECUALI butir 14 (jeda tulis) yang
 * memang perilaku tulis global (KONTRAK K1/K4).
 *
 *   butir 3   putusan massal SIPP: "Blangko utama" di atas daftar, dan per
 *             perkara yang putusannya berbeda tombol "Blangko berbeda…" untuk
 *             memilih blangko lain (aletaMassalBarisBlangko milik R bila ada;
 *             belum ada = kendali baris sederhana di sini). Pilihannya ikut
 *             antrean (butir.blangko) dan disimpan di chrome.storage.local
 *             "blangkoPutusanMassal" supaya tahap ABT dapat memakainya. Draf
 *             yang sudah ada di ALETA TIDAK diubah oleh pilihan ini.
 *   butir 7   tag peran di kepala tiap lipatan panel SIPP (opsi `peran`
 *             alatJadikanLipat milik W, K2): Penetapan "Ketua", Putusan
 *             "Hakim", Juru Sita "Jurusita", BAS massal "Panitera", dst.
 *             Tag yang sudah dipasang pemilik bagiannya tidak ditimpa.
 *   butir 14  (17 Okt: DICABUT untuk layar) isian dan tekanan tombol SIPP lewat
 *             jembatan langsung, tanpa alatJedaManusia. Tidak ada penanda ALETA
 *             yang disisipkan ke isian atau elemen SIPP yang ikut tersimpan.
 *   butir 15  "Perkara berikutnya" menurut kepentingan peran: hakim/ketua =
 *             perkara yang perlu putusan, PP = BAS, juru sita = relaas/PBT
 *             (persidangan ikut di belakangnya). Antrean Direktori Putusan
 *             gagal, sesi e-Court, cadangan, dst. HANYA Super Admin & Admin
 *             (kartu checklist lengkap t7KartuBerikutnya, tidak berubah).
 *   butir 17  Penetapan: "Upload edoc penetapan (PMH/PPP/PJS/PHS)" - otomatis
 *             dari ABT (GET penetapan-edoc/peta, POST penetapan-edoc/unggah,
 *             rute E) + bagian lipat terpisah untuk upload manual. Sumber TTE
 *             dan cap disebut sebelum tombol. 404 = "belum tersedia di
 *             server". DIROMBAK 19 Okt 2026: unggah otomatis pindah ke tombol
 *             "e-Doc" per baris kartu Penetapan; yang manual menjadi bagian
 *             "Edoc penetapan (PMH/PPP/PJS/PHS) manual"; passphrase TTE
 *             dihapus dari panel dan tidak dikirim (atur di Tanda tangan
 *             pejabat portal).
 *   butir 19  bawaan buka/tutup: di tiap tab hanya bagian UTAMA yang terbuka,
 *             sisanya tertutup; kartu tambahan di dalam tab tertutup. Pilihan
 *             petugas yang tersimpan selalu menang.
 *
 * Permintaan baru: GET /aleta/api/aleta-ecourt/checklist?peran=<peran>
 * (rute lama, peran ditentukan golongan), GET .../penetapan-edoc/peta?nomor=,
 * POST .../penetapan-edoc/unggah (menulis ke SIPP lewat bot - hanya atas klik +
 * konfirmasi; tidak masuk ALETA_COBA_BOLEH).
 */
const S2_API_EDOC_PETA = "/aleta/api/aleta-ecourt/penetapan-edoc/peta";
const S2_API_EDOC_UNGGAH = "/aleta/api/aleta-ecourt/penetapan-edoc/unggah";
const S2_BATAS_UNGGAH_EDOC_MS = 180000;
/** Kode SIPP -> nama resmi. Layar menyebut NAMANYA (kode hanya di kurung); kode dipakai rute. */
const S2_NAMA_PENETAPAN = {
  PMH: "Penetapan Majelis Hakim",
  PPP: "Penunjukan Panitera Pengganti",
  PJS: "Penunjukan Juru Sita",
  PHS: "Penetapan Hari Sidang",
};
const S2_JENIS_PENETAPAN = Object.keys(S2_NAMA_PENETAPAN);

// ─── Butir 14: jeda seperti manusia untuk tulisan ke SIPP ────────────────────

/** alatJedaManusia (W) bila ada; tidak pernah melempar. Pulang milidetik yang dijalani. */
async function s2JedaTulis(jenis, alamat) {
  if (typeof alatJedaManusia !== "function") return 0;
  try {
    return Number(await alatJedaManusia(jenis || "simpan", alamat ? { alamat } : undefined)) || 0;
  } catch {
    return 0;
  }
}

// ─── Butir 17: upload edoc penetapan (PMH/PPP/PJS/PHS) ───────────────────────

function s2JenisPenetapan(x) {
  const t = String(x || "").trim().toUpperCase();
  return S2_JENIS_PENETAPAN.includes(t) ? t : "";
}

/**
 * Jawaban peta (rute E) dibaca longgar: daftar per jenis di `jenis` / `peta` /
 * `dokumen` / `penetapan` (larik atau peta), sumber TTE di `tte` / `ttd` /
 * `tandaTangan`, cap di `cap`. Murni.
 */
function s2BacaPetaEdoc(data) {
  const d = data && typeof data === "object" ? data : {};
  const mentah = d.jenis || d.peta || d.dokumen || d.penetapan || [];
  const larik = Array.isArray(mentah)
    ? mentah
    : mentah && typeof mentah === "object"
      ? Object.entries(mentah).map(([jenis, v]) => ({ ...(v && typeof v === "object" ? v : { tersedia: Boolean(v) }), jenis }))
      : [];
  const per = new Map();
  for (const x of larik) {
    if (!x || typeof x !== "object") continue;
    const jenis = s2JenisPenetapan(x.jenis || x.kode || x.kunci);
    if (!jenis || per.has(jenis)) continue;
    const ada = x.tersedia === true || x.ada === true || x.siap === true;
    per.set(jenis, {
      jenis,
      ada,
      sebab: String(x.sebab || x.alasan || (ada ? "" : "belum tersedia di ABT")),
      nama: String(x.nama || x.blangko || x.berkas || ""),
      penandatangan: String(x.penandatangan || x.ttd || x.pejabat || ""),
      sudah: x.sudahDiunggah === true || x.sudahAda === true,
      // Butir 7 (1.189.x): kapan terakhir diunggah (perkara_dokumen_penetapan).
      terakhir: String(x.terakhirDiunggah || ""),
    });
  }
  const jenis = S2_JENIS_PENETAPAN.map((j) => per.get(j) || { jenis: j, ada: false, sebab: "tidak ada di peta ABT", nama: "", penandatangan: "", sudah: false });
  const t = d.tte || d.ttd || d.tandaTangan || null;
  const tte = t && typeof t === "object" ? { nama: String(t.nama || t.pejabat || ""), sumber: String(t.sumber || ""), siap: t.siap !== false } : null;
  const c = d.cap && typeof d.cap === "object" ? d.cap : null;
  const cap = c ? { ada: c.ada === true || c.siap === true, nama: String(c.nama || ""), sumber: String(c.sumber || "") } : null;
  const tautanCap = typeof d.tautanCap === "string" && d.tautanCap.startsWith("/aleta/") ? d.tautanCap : "";
  return { jenis, tte, cap, tautanCap };
}

/** Mode yang menahan tulisan: passphrase TIDAK dikirim sama sekali (catatan latihan menyimpan badan). */
function s2ModeMenahan(alamat) {
  try {
    if (typeof alatLatihanNyala === "function" && alatLatihanNyala()) return "mode latihan";
    if (typeof alatKeringNyala === "function" && alatKeringNyala()) return "mode kering";
    if (typeof alatCobaMenahan === "function" && alatCobaMenahan(alamat, "POST")) return "mode coba";
  } catch {
    return "";
  }
  return "";
}

function s2KalimatGagal(respons, luar, d, apa) {
  return (
    (d && (d.sebab || d.pesan || d.alasan)) ||
    (luar && luar.error && luar.error.message) ||
    (typeof alatPesanGagal === "function" ? alatPesanGagal(null, respons.status, apa) : `Gagal (${respons.status}).`)
  );
}

/**
 * Satu kiriman ke rute unggah. Pulang { status, ok, d, luar, pesan }. Tidak
 * pernah melempar; passphrase tidak pernah masuk pesan yang ditampilkan.
 */
async function s2KirimEdoc(badan, apa) {
  let respons = null;
  let luar = null;
  try {
    respons = await alatAmbil(
      S2_API_EDOC_UNGGAH,
      { method: "POST", body: badan, credentials: "include", batasMs: S2_BATAS_UNGGAH_EDOC_MS, ...(typeof badan === "string" ? { headers: { "Content-Type": "application/json" } } : {}) },
      apa
    );
    try {
      luar = await respons.json();
    } catch {
      luar = null;
    }
  } catch (galat) {
    return { status: 0, ok: false, d: null, luar: null, pesan: String((galat && galat.message) || galat) };
  }
  const d = luar && typeof luar === "object" && "data" in luar ? luar.data : luar;
  if (respons.status === 404) return { status: 404, ok: false, d, luar, pesan: "Upload edoc penetapan belum tersedia di server - tidak ada yang dikirim." };
  if (respons.status === 423) {
    return { status: 423, ok: false, d, luar, pesan: typeof a30PesanDitahan === "function" ? a30PesanDitahan(luar, apa) : `${apa} ditahan mode uji - tidak ada yang dikirim.` };
  }
  if (!respons.ok || !d || d.ok === false) return { status: respons.status, ok: false, d, luar, pesan: `Tidak terunggah: ${s2KalimatGagal(respons, luar, d, apa)}` };
  return { status: respons.status, ok: true, d, luar, pesan: "" };
}

// ─── Butir 7 (1.189.x): e-Doc penetapan yang SUDAH terupload ────────────────
//
// Sumber keadaan: tabel dokumen penetapan SIPP (perkara_dokumen_penetapan),
// dibaca bot di peta edoc (sudahDiunggah, terakhirDiunggah). Mengunggah ulang
// MENIMPA yang lama - jadi petugas diberi tahu "sudah terupload" dan ditanya
// "yakin menimpa yang lama?" lebih dulu. Peta yang tidak terbaca = tidak
// diketahui, bukan "belum ada": pertanyaannya tetap tidak dibuat-buat.

/** Tanggal ringkas dari cap waktu SIPP ("2026-10-05 09:12:00" / ISO). Murni. */
function b7TanggalSingkat(t) {
  const s = String(t || "").trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  return m ? `${m[1]} ${m[2]}` : s.slice(0, 16);
}

/** Kalimat "PMH, PHS sudah terupload di e-Doc SIPP (terakhir ...)". Murni. */
function b7KalimatSudah(sudah) {
  return (sudah || [])
    .map((x) => {
      const kode = String(x.jenis || "").toUpperCase();
      const nama = S2_NAMA_PENETAPAN[kode] || kode;
      return `${nama} (${kode}) sudah terupload di e-Doc SIPP${x.terakhir ? ` - terakhir ${b7TanggalSingkat(x.terakhir)}` : ""}`;
    })
    .join("; ");
}

/** Dari peta yang sudah dibaca (s2BacaPetaEdoc), jenis terpilih yang sudah terupload. Murni. */
function b7SudahDariPeta(peta, jenis) {
  const diminta = (jenis || []).map((j) => String(j).toUpperCase());
  return peta && Array.isArray(peta.jenis) ? peta.jenis.filter((x) => x.sudah && diminta.includes(x.jenis)) : [];
}

/** Membaca peta edoc perkara: null bila tidak terbaca. */
async function b7BacaSudahTerunggah(nomorPerkara, jenis) {
  const nomor = String(nomorPerkara || "");
  if (!nomor) return null;
  const j = await t7AmbilJson(`${S2_API_EDOC_PETA}?nomor=${encodeURIComponent(nomor)}`, "Membaca e-Doc penetapan yang sudah ada");
  if (!j.ok) return null;
  return b7SudahDariPeta(s2BacaPetaEdoc(j.data), jenis);
}

/** Konfirmasi jendela: true = boleh menimpa. */
function b7KonfirmasiTimpaEdoc(nomorPerkara, sudah) {
  if (!sudah || !sudah.length) return true;
  try {
    return (
      window.confirm(
        `${nomorPerkara}: ${b7KalimatSudah(sudah)}.\n\nMengunggah lagi akan MENIMPA e-Doc yang lama. Yakin menimpa yang lama?`
      ) === true
    );
  } catch {
    return false;
  }
}

/*
 * ============================================================================
 * PERBAIKAN 6 OKTOBER 2026 - EDOC PENETAPAN DARI BLANGKO ABT (butir 17-20)
 * ============================================================================
 *
 * UI Baru saja (s1Aktif). Dua jalan, satu mesin (e6UnggahEdocPenetapan):
 *
 *   OTOMATIS  sesudah penetapan PMH/PHS TERTULIS lewat "Penetapan dan
 *             Penunjukan Perkara" (tetapkanLewatAleta), untuk tiap jenis
 *             yang di Peta penetapan (Integrasi e-Court) aktif + unggah
 *             otomatis: blangko ABT-nya ("@ 1 - PMH", "@ 2 - PHS") dicetak
 *             lewat latar.js ("relaas-rtf" - sesi ABT petugas, jalan yang
 *             sama dengan cetak relaas massal), dikirim ke rute unggah edoc
 *             penetapan yang SUDAH ADA (S2_API_EDOC_UNGGAH, s2KirimEdoc), dan
 *             ALETA membubuhkan tanda tangan sesuai nama + cap di atasnya
 *             sebelum mengunggahnya ke e-Doc tab Penetapan SIPP.
 *   TOMBOL    bagian "Edoc penetapan dari blangko ABT" di tab PTSP: periksa
 *             dulu (kering - tidak ada yang ditulis), lalu unggah.
 *
 * Penjaga: mode latihan/kering/coba menahan (s2ModeMenahan), rute menolak
 * kiriman otomatis untuk jenis yang unggah otomatisnya mati, dan tidak ada
 * jalur tulis ke SIPP selain rute unggah yang sudah ada. Tanpa tanda ALETA
 * di SIPP: pelakunya akun SIPP yang sedang masuk (namaPenggunaSipp).
 */
const E6_API_PETA = "/aleta/api/aleta-ecourt/penetapan-edoc/peta-penetapan";

/** Peta penetapan dari portal. Pulang { ok, butir } | { ok:false, pesan }. */
async function e6BacaPeta() {
  const j = await t7AmbilJson(E6_API_PETA, "Membaca peta penetapan");
  if (!j.ok) return { ok: false, pesan: j.pesan };
  const butir = j.data && Array.isArray(j.data.butir) ? j.data.butir : [];
  return { ok: true, butir };
}

/** Jenis yang dipakai: aktif, bernama blangko, (otomatis: unggah otomatis menyala). Murni. */
function e6JenisDipakai(butir, jenis, otomatis) {
  const diminta = (jenis || []).map((x) => String(x).toLowerCase());
  return (butir || []).filter(
    (b) => b && diminta.includes(String(b.jenis)) && b.aktif === true && String(b.namaBerkas || "").trim() && (!otomatis || b.otomatisUnggah === true)
  );
}

/** perkara_id: dari konteks halaman bila ada, kalau tidak dari peta edoc (bot membaca SIPP). */
async function e6PerkaraId(nomorPerkara, perkaraId) {
  const id = String(perkaraId || "").trim();
  if (/^\d+$/.test(id) && !/^0+$/.test(id)) return id;
  const j = await t7AmbilJson(`${S2_API_EDOC_PETA}?nomor=${encodeURIComponent(String(nomorPerkara || ""))}`, "Mengenali perkara");
  const p = j.ok && j.data && j.data.perkara ? String(j.data.perkara.perkaraId || "") : "";
  return /^\d+$/.test(p) ? p : "";
}

/** Meminta latar.js mencetak SATU blangko ABT untuk satu perkara (RTF base64). */
async function e6CetakRtfAbt(perkaraId, butir) {
  try {
    const jawab = await chrome.runtime.sendMessage({
      sumber: "aleta-panel",
      jenis: "relaas-rtf",
      asal: location.origin,
      asalAbt: `${location.origin}/aps_badilag`,
      perkaraId: String(perkaraId),
      berkas: String(butir.namaBerkas || ""),
      utamakan: String(butir.kelompok || ""),
    });
    return jawab && typeof jawab === "object" ? jawab : { ok: false, sebab: "ekstensi tidak menjawab" };
  } catch (galat) {
    return { ok: false, sebab: `ekstensi tidak menjawab: ${String((galat && galat.message) || galat)}` };
  }
}

/** Kalimat hasil per jenis - termasuk tanda tangan siapa dan peringatannya. Murni. */
function e6RingkasHasil(d) {
  const berkas = d && Array.isArray(d.berkas) ? d.berkas : [];
  return berkas
    .map((x) => {
      const jenis = String(x.jenis || "").toUpperCase();
      if (!x.ok) return `${jenis}: gagal${x.sebab ? ` (${x.sebab})` : ""}`;
      const ttd = x.tandaTangan ? `ttd ${x.tandaTangan}` : "TANPA tanda tangan";
      const per = Array.isArray(x.peringatan) && x.peringatan.length ? ` - ${x.peringatan.join(" ")}` : "";
      return `${jenis}: ${d.kering ? "siap" : "terunggah"}, ${ttd}${per}`;
    })
    .join(" · ");
}

/**
 * Mesin bersama: cetak blangko ABT tiap jenis lalu kirim ke rute unggah.
 * @param {{nomorPerkara, perkaraId, jenis: string[], otomatis: boolean, kering: boolean, kabar: HTMLElement}} p
 */
async function e6UnggahEdocPenetapan(p) {
  const tulis = (teks, buruk) => {
    if (!p.kabar) return;
    p.kabar.className = buruk ? "aleta-abt-kabar aleta-abt-gagal" : "aleta-abt-kabar";
    p.kabar.textContent = teks;
  };
  const kering = p.kering !== false;
  if (!kering) {
    const ditahan = s2ModeMenahan(S2_API_EDOC_UNGGAH);
    if (ditahan) {
      tulis(`Edoc penetapan tidak diunggah: ditahan ${ditahan} - tidak ada yang dikirim.`);
      return { ok: false, ditahan };
    }
  }
  const peta = await e6BacaPeta();
  if (!peta.ok) {
    tulis(`Edoc penetapan: ${peta.pesan}`, true);
    return { ok: false };
  }
  let dipakai = e6JenisDipakai(peta.butir, p.jenis, p.otomatis);
  if (!dipakai.length) {
    if (!p.otomatis) tulis("Tidak ada jenis yang dipilih yang aktif di Peta penetapan (Integrasi e-Court).", true);
    return { ok: false, alasan: "tidak_ada_jenis" };
  }
  // Butir 7 (1.189.x): e-Doc yang SUDAH terupload tidak ditimpa diam-diam.
  // Tombol: "sudah terupload - yakin menimpa yang lama?". Otomatis (sesudah
  // penetapan tertulis): yang sudah ada DILEWATI dan disebut - menimpanya
  // hanya lewat tombol, atas persetujuan petugas.
  let dilewati = "";
  if (!kering) {
    const sudah = await b7BacaSudahTerunggah(p.nomorPerkara, dipakai.map((b) => b.jenis));
    if (sudah && sudah.length) {
      if (p.otomatis) {
        const kodeSudah = sudah.map((x) => x.jenis);
        dipakai = dipakai.filter((b) => !kodeSudah.includes(String(b.jenis).toUpperCase()));
        dilewati = `${b7KalimatSudah(sudah)} - tidak ditimpa otomatis (unggah ulang lewat tombol bila perlu).`;
        if (!dipakai.length) {
          tulis(dilewati);
          return { ok: false, alasan: "sudah_terunggah", dilewati: kodeSudah };
        }
      } else if (!p.timpaDisetujui && !b7KonfirmasiTimpaEdoc(p.nomorPerkara, sudah)) {
        // timpaDisetujui: tombol e-Doc per baris kartu Penetapan sudah menanyakan
        // "yakin menimpa yang lama?" sendiri - tidak ditanya dua kali.
        tulis("Dibatalkan - e-Doc lama di SIPP tidak diubah, tidak ada yang dikirim.");
        return { ok: false, dibatalkan: true };
      }
    }
  }
  const perkaraId = await e6PerkaraId(p.nomorPerkara, p.perkaraId);
  if (!perkaraId) {
    tulis("Edoc penetapan: perkara tidak dikenali di SIPP.", true);
    return { ok: false };
  }
  const abt = [];
  const gagal = [];
  for (const asal of dipakai) {
    // I9 17 Okt: PHS perkara bersita - pilihan tangan "dikabulkan"/"ditolak" memakai varian @ 2a / @ 2b (tanpa jatuh ke @ 2: bawaannya
    // bertuliskan sita ditangguhkan, bertentangan dengan pilihan petugas). Tanpa pilihan = bawaan @ 2 (blok ditangguhkan terisi sendiri).
    const varianSita = String(asal.jenis) === "phs" && p.sita && asal.varianSita ? String(asal.varianSita[p.sita] || "") : "";
    const b = varianSita ? { ...asal, namaBerkas: varianSita } : asal;
    tulis(`Mencetak ${String(b.jenis).toUpperCase()} dari blangko ABT "${b.namaBerkas}"…`);
    let r = await e6CetakRtfAbt(perkaraId, b);
    let namaDipakai = b.namaBerkas;
    // I9 17 Okt: berkas tunggal (PPP "@ 0a", PJS "@ 0b") belum ada di ABT satker -> berkas gabungan "@ 0" (bot memotong bagiannya lewat ciri isi).
    const cadangan = String(b.namaBerkasCadangan || "").trim();
    if (!(r && r.ok && r.rtfBase64) && !(r && r.perluMasuk) && cadangan && cadangan !== b.namaBerkas) {
      tulis(`Blangko "${b.namaBerkas}" tidak ada di ABT ini - mencoba cadangan "${cadangan}"…`);
      const r2 = await e6CetakRtfAbt(perkaraId, { ...b, namaBerkas: cadangan });
      if (r2 && r2.ok && r2.rtfBase64) {
        r = r2;
        namaDipakai = cadangan;
      }
    }
    if (r && r.ok && r.rtfBase64) abt.push({ jenis: b.jenis, isiBase64: r.rtfBase64, berkas: namaDipakai });
    else gagal.push(`${String(b.jenis).toUpperCase()}: ${(r && r.sebab) || "tidak tercetak"}${r && r.perluMasuk ? " (masuk ke ABT lebih dahulu)" : ""}`);
  }
  if (!abt.length) {
    tulis(`Edoc penetapan belum ${kering ? "dapat diperiksa" : "terunggah"} - ${gagal.join("; ")}`, true);
    return { ok: false, gagal };
  }
  tulis(`${kering ? "Memeriksa" : "Mengunggah"} ${abt.map((x) => String(x.jenis).toUpperCase()).join(" dan ")}…`);
  if (!kering) {
    await s2JedaTulis("unggah", S2_API_EDOC_UNGGAH);
    await catatAlamatSebelumTulis(String(p.nomorPerkara || ""));
  }
  const badan = {
    nomorPerkara: String(p.nomorPerkara || ""),
    perkaraId,
    abt,
    otomatis: Boolean(p.otomatis),
    konfirmasi: !kering,
    kering,
    olehUsername: namaPenggunaSipp() || "",
  };
  const hasil = await s2KirimEdoc(JSON.stringify(badan), "Upload edoc penetapan");
  // e-Doc penetapan baru terunggah: tab Penetapan SIPP basi sampai dimuat ulang. Pemanggil yang
  // mengurutkan banyak langkah (panel Penetapan Otomatis, e-Doc sesudah menulis) memuat ulang SEKALI sendiri.
  if (hasil.ok && !kering && !p.tanpaMuatUlang) {
    const berkasHasil = hasil.d && Array.isArray(hasil.d.berkas) ? hasil.d.berkas : [];
    muatUlangSesudahTulis({
      nomor: String(p.nomorPerkara || ""),
      judulOk: "e-Doc penetapan terunggah ke SIPP.",
      judulGagal: "e-Doc penetapan belum terunggah seluruhnya.",
      baris: berkasHasil.length
        ? berkasHasil.map((x) => ({ jenis: String(x.jenis || ""), teks: x.ok ? "e-Doc terunggah" : `gagal${x.sebab ? ` (${x.sebab})` : ""}`, ok: x.ok !== false }))
        : abt.map((x) => ({ jenis: String(x.jenis || ""), teks: "e-Doc terunggah", ok: true })),
    });
  }
  const ringkas = hasil.d ? e6RingkasHasil({ ...hasil.d, kering }) : "";
  const tambahan = (gagal.length ? ` · tidak tercetak: ${gagal.join("; ")}` : "") + (dilewati ? ` · ${dilewati}` : "");
  if (hasil.ok) tulis(`${ringkas || (kering ? "Siap diunggah." : "Terunggah ke e-Doc SIPP.")}${tambahan}`, Boolean(gagal.length));
  else tulis(`${hasil.pesan}${ringkas ? ` · ${ringkas}` : ""}${tambahan}`, hasil.status !== 404);
  return { ok: hasil.ok, hasil };
}
