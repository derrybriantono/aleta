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

const ALETA_API = "/aleta/api/aleta-bot/sipp-konteks";
const ALETA_API_MASSAL = "/aleta/api/aleta-bot/sipp-konteks/massal";
const ALETA_API_PERMINTAAN = "/aleta/api/aleta-bot/ecourt/permintaan";
const ALETA_BERKAS = "/aleta/api/aleta-ecourt/berkas";
// Keadaan perkara selengkapnya - tahapan, berkas, putusan, upaya hukum, dan
// penilaian SK. Kapabilitasnya SAMA dengan sipp-konteks ("panel"), jadi menu
// tambahan ini tidak membuka satu pun pintu baru bagi peran mana pun.
const ALETA_API_STATUS = "/aleta/api/aleta-ecourt/status-perkara";
const ALETA_API_PENUNJUKAN = "/aleta/api/aleta-bot/penunjukan";
// Namanya "borang", bukan "formulir".
//
// Sempat tertulis "formulir" dan itu membuat SELURUH tombol Kerjakan mati:
// alamatnya menjawab 404, siapkanKerjakan berhenti pada baris pertama, dan
// tombolnya tinggal diam bertuliskan "ALETA menjawab 404." Rutenya sendiri
// tidak pernah berpindah - yang berpindah hanya sebutannya dalam bahasa
// manusia, dan penggantian nama itu ikut terbawa ke alamat yang seharusnya
// tetap.
const ALETA_API_BORANG = "/aleta/api/aleta-bot/penunjukan/borang";
const ALETA_API_CATAT = "/aleta/api/aleta-bot/penunjukan/catat";
const ALETA_API_ANTREAN = "/aleta/api/aleta-bot/penunjukan/antrean";
const ALETA_API_BERKAS_GUGATAN = "/aleta/api/aleta-bot/penunjukan/berkas";
const ALETA_API_BERKAS_ARSIP = "/aleta/api/aleta-bot/penunjukan/berkas-arsip";
const ALETA_API_TULIS = "/aleta/api/aleta-bot/penunjukan/tulis";
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
const ALETA_API_HAPUS = "/aleta/api/aleta-bot/penunjukan/hapus";
const ALETA_API_HAPUS_SEMUA = "/aleta/api/aleta-bot/penunjukan/hapus-semua";
const ALETA_API_RIWAYAT = "/aleta/api/aleta-bot/penunjukan/riwayat";
const ALETA_API_MASUK_PEJABAT = "/aleta/api/aleta-ecourt/masuk-pejabat";
const ALETA_API_EKSTENSI = "/aleta/api/aleta-ecourt/ekstensi";
const ALETA_API_ISIAN_PUTUSAN = "/aleta/api/aleta-ecourt/putusan/isian-sipp";
const ALETA_API_PRAPERIKSA_PUTUSAN = "/aleta/api/aleta-ecourt/putusan/praperiksa";
const ALETA_API_SIAPA = "/aleta/api/aleta-ecourt/ekstensi/siapa";
const ALETA_API_UNGGAH_NASKAH = "/aleta/api/aleta-ecourt/putusan/unggah-naskah";
const ALETA_API_UNGGAH_SIPP = "/aleta/api/aleta-ecourt/putusan/unggah-sipp";
/**
 * Mengunggah naskah lebih lama daripada membaca satu bagian panel: berkasnya
 * terkirim, diurai, lalu disimpan sebagai draf. Membatalkannya di detik
 * kesembilan tidak melindungi apa pun - naskahnya sudah sampai, dan yang
 * hilang hanya jawabannya.
 */
const BATAS_UNGGAH_NASKAH_MS = 45000;

/**
 * ============================================================================
 * MENULIS KE SIPP MENUNGGU LEBIH LAMA - DAN HARUS LEBIH LAMA DARIPADA GERBANG
 * ============================================================================
 *
 * Batas ini TIDAK boleh lebih pendek daripada batas gerbangnya. Terbaca dari
 * kedua angkanya:
 *
 *     gerbang   timeoutMs: 60000    whatsapp-gateway-client.ts, gatewayUnggahPutusanSipp
 *
 * Selama ini unggah ke SIPP memakai BATAS_UNGGAH_NASKAH_MS yang 45 detik -
 * lebih pendek daripada gerbangnya. Unggahan yang memakan 45 sampai 60 detik
 * karena itu dibatalkan ekstensi sementara botnya terus bekerja: petugas
 * melihat galat, dan berkasnya mungkin tetap tertulis. Komentar pada
 * gerbangnya sendiri sudah menyebut akibatnya - "membatalkannya di tengah
 * meninggalkan berkas yang sudah tertulis tanpa barisnya".
 *
 * Yang paling sering terkena ANONIMISASI, dan sebabnya aritmetika: putusan dan
 * anonimisasi dikirim dalam SATU permintaan, jadi bitanya dua kali lipat - dan
 * yang dua kali lipat itulah yang menyeberangi garis 45 detik.
 *
 * Urutan batas waktu harus MENAIK dari dalam ke luar: bot, gerbang, lalu
 * ekstensi. Yang di luar menyerah lebih dahulu meninggalkan pekerjaan setengah
 * jalan tanpa ada yang tahu hasilnya - dan itu keadaan yang paling sulit
 * diperbaiki, sebab tidak ada yang tahu apa yang sudah tertulis.
 */
const BATAS_UNGGAH_SIPP_MS = 90000;
const ALETA_API_ALASAN_PERKARA = "/aleta/api/aleta-ecourt/alasan-perkara";
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
 * Memuat ulang halaman perkara ini. Lewat pintu masuk yang sah bila ada, dan
 * sebagai upaya terakhir memuat ulang apa adanya - halaman selain detail
 * perkara memang tidak punya masalah sesi ini.
 */
function muatUlangHalamanPerkara() {
  const alamat = alamatMasukPerkara();
  if (alamat) location.assign(alamat);
  else location.reload();
}

function cariNomorPerkara() {
  const teks = document.body ? String(document.body.innerText || "") : "";

  // Seluruh nomor perkara yang berbeda di halaman ini.
  const semua = new Set();
  POLA_PERKARA.lastIndex = 0;
  let cocok;
  while ((cocok = POLA_PERKARA.exec(teks)) !== null) {
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

async function muatSaklar() {
  if (saklar.siap) return saklar;
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

const STATUS_NOMOR = {
  terverifikasi: { teks: "nomor terkonfirmasi", nada: "aman" },
  menunggu: { teks: "menunggu jawaban konfirmasi", nada: "mendesak" },
  ditolak: { teks: "salah alamat — perbaiki di SIPP", nada: "lewat" },
  belum_pernah_ditanya: { teks: "belum dikonfirmasi", nada: "netral" },
};

/**
 * Tombol unduh satu berkas.
 *
 * Berkasnya diambil lewat fetch lalu disimpan dari blob, bukan lewat tautan
 * biasa. Tautan biasa pada halaman SIPP akan berpindah halaman atau membuka
 * tab baru tanpa membawa sesi pada sebagian penyiapan - dan petugas menerima
 * halaman login alih-alih berkasnya, di tengah halaman perkara yang sedang
 * dikerjakan.
 */
/**
 * Membaca pesan dari jawaban galat portal.
 *
 * Bentuknya { ok: false, error: { message, details } } - error adalah OBYEK,
 * bukan teks. Memperlakukannya sebagai teks menghasilkan "[object Object]"
 * pada tombol, yang lebih tidak berguna daripada kata "gagal" saja.
 */
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

      const url = URL.createObjectURL(blob);
      const tautan = document.createElement("a");
      tautan.href = url;
      tautan.download = namaBerkasDari(respons, dokumen, format);
      document.body.appendChild(tautan);
      tautan.click();
      tautan.remove();

      // Alamat obyek TIDAK dilepas seketika. Peramban membaca blobnya setelah
      // klik selesai diproses, dan melepasnya di baris yang sama membatalkan
      // sebagian unduhan tanpa pesan apa pun - berkas yang seolah hilang.
      setTimeout(() => URL.revokeObjectURL(url), 60000);

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

/**
 * Kotak keputusan verifikasi untuk hakim.
 *
 * ============================================================================
 * DUA LANGKAH, SELALU
 * ============================================================================
 *
 * Tombol pertama tidak menyentuh jaringan sama sekali - ia hanya membuka
 * pertanyaan. Baru tombol kedua yang mengirim, dan hanya tombol kedua yang
 * membawa konfirmasi:true.
 *
 * Ini keputusan hukum yang menentukan apakah dokumen resmi masuk berkas
 * perkara. Satu jempol yang salah pencet di layar sempit tidak boleh
 * menghasilkan keputusan seperti itu.
 */
function kotakVerifikasi(dokumen) {
  const kotak = buatElemen("div", "aleta-verifikasi");

  const tampilkanPilihan = () => {
    kotak.textContent = "";
    kotak.appendChild(buatElemen("span", "aleta-verifikasi-label", "Verifikasi:"));
    kotak.appendChild(tombolPilih(dokumen, "valid", "Valid", kotak));
    kotak.appendChild(tombolPilih(dokumen, "tidak_valid", "Tidak Valid", kotak));
  };

  const tampilkanKonfirmasi = (keputusan, label) => {
    kotak.textContent = "";
    kotak.appendChild(
      buatElemen("div", "aleta-verifikasi-tanya", `Simpan keputusan ${label}? Pastikan dokumennya sudah dibaca.`)
    );

    const ya = buatElemen("button", "aleta-verifikasi-ya", "Ya, simpan");
    ya.addEventListener("click", async () => {
      ya.disabled = true;
      ya.textContent = "Menyimpan…";
      const hasil = await kirimKeputusan(dokumen, keputusan);
      kotak.textContent = "";
      kotak.appendChild(
        buatElemen("div", hasil.ok ? "aleta-verifikasi-hasil" : "aleta-verifikasi-gagal", hasil.pesan)
      );
      if (hasil.ok) {
        // Muat ulang panel supaya statusnya ikut berubah.
        nomorTerakhir = "";
        setTimeout(() => void segarkan(), 1200);
      }
    });

    const batal = buatElemen("button", "aleta-verifikasi-batal", "Batal");
    batal.addEventListener("click", tampilkanPilihan);

    kotak.appendChild(ya);
    kotak.appendChild(batal);
  };

  function tombolPilih(dok, keputusan, label) {
    const tombol = buatElemen("button", "aleta-verifikasi-pilih", label);
    // Tombol pertama TIDAK mengirim apa pun - hanya membuka pertanyaan.
    tombol.addEventListener("click", () => tampilkanKonfirmasi(keputusan, label));
    return tombol;
  }

  tampilkanPilihan();
  return kotak;
}

/** Mengirim keputusan ke ALETA. Konfirmasi selalu true dari sini. */
async function kirimKeputusan(dokumen, keputusan) {
  try {
    const respons = await alatAmbil(
      ALETA_API,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentKey: dokumen.documentKey, keputusan, konfirmasi: true }),
      },
      "Menyimpan keputusan"
    );

    if (respons.status === 401 || respons.status === 403) {
      return { ok: false, pesan: "Sesi ALETA habis. Masuk lagi lalu ulangi." };
    }

    const hasil = await respons.json();
    const isi = hasil?.data ?? hasil;

    if (isi?.ok) {
      return { ok: true, pesan: `Tersimpan: ${keputusan === "valid" ? "VALID" : "TIDAK VALID"}` };
    }

    const alasan = {
      bukan_anggota_majelis: "Anda tidak tercatat sebagai majelis pada perkara ini.",
      bukan_hakim_terdaftar: "Akun Anda tidak terdaftar sebagai hakim.",
      konfirmasi_belum_diberikan: "Konfirmasi belum diberikan.",
      dokumen_tidak_ditemukan: "Dokumen tidak ditemukan lagi.",
    }[isi?.alasan];

    return { ok: false, pesan: alasan || `Tidak tersimpan (${isi?.alasan || "tidak diketahui"}).` };
  } catch (galat) {
    return { ok: false, pesan: String((galat && galat.message) || galat) };
  }
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

function simpanLipatan(kunci, terlipat) {
  lipatanTersimpan = { ...(lipatanTersimpan || {}), [kunci]: terlipat };
  try {
    void chrome.storage.local.set({ [KUNCI_LIPATAN]: lipatanTersimpan });
  } catch {
    /* penyimpanan tidak tersedia: lipatan tetap bekerja, hanya tidak diingat */
  }
}

/**
 * Membuat satu bagian panel.
 *
 * @param {string} judul Judul yang terlihat petugas.
 * @param {string} kunci Nama tetap untuk mengingat lipatannya. TIDAK boleh
 *   diambil dari judul: judul memuat angka yang berubah - "Dokumen e-Court (3)"
 *   - sehingga lipatannya akan terlupa setiap jumlah dokumennya berubah.
 * @param {boolean} bawaanTerlipat Keadaan awal bila belum pernah diatur petugas.
 */
function bagian(judul, kunci = "", bawaanTerlipat = false) {
  const kotak = buatElemen("div", "aleta-bagian");
  const namaKunci = kunci || judul;
  kotak.dataset.kunci = namaKunci;

  const kepala = buatElemen("button", "aleta-bagian-judul");
  kepala.type = "button";
  kepala.appendChild(buatElemen("span", "aleta-bagian-panah", "▾"));
  kepala.appendChild(buatElemen("span", "aleta-bagian-teks", judul));

  // Tempat lencana, disiapkan kosong. Diisi belakangan oleh setLencana()
  // begitu keadaannya diketahui - sebagian seketika dari konteks, sebagian
  // sedetik kemudian dari panggilan latar.
  const tempatLencana = buatElemen("span", "aleta-bagian-lencana");
  kepala.appendChild(tempatLencana);

  const isi = buatElemen("div", "aleta-bagian-isi");

  const tersimpan = lipatanTersimpan ? lipatanTersimpan[namaKunci] : undefined;
  const terlipatAwal = typeof tersimpan === "boolean" ? tersimpan : bawaanTerlipat;
  terapkanLipatan(kepala, isi, terlipatAwal);

  kepala.addEventListener("click", () => {
    const sedangTerlipat = isi.style.display === "none";
    terapkanLipatan(kepala, isi, !sedangTerlipat);
    simpanLipatan(namaKunci, !sedangTerlipat);
  });

  kotak.appendChild(kepala);
  kotak.appendChild(isi);

  // Pemanggil menambahkan barisnya ke .aleta-bagian-isi, bukan ke kotaknya.
  kotak.isi = isi;
  kotak.lencana = tempatLencana;
  return kotak;
}

function terapkanLipatan(kepala, isi, terlipat) {
  isi.style.display = terlipat ? "none" : "";
  const panah = kepala.querySelector(".aleta-bagian-panah");
  if (panah) panah.textContent = terlipat ? "▸" : "▾";
  kepala.setAttribute("aria-expanded", terlipat ? "false" : "true");
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

async function ambilStatusPerkara(nomor) {
  if (simpananStatus.nomor === nomor) {
    if (simpananStatus.data) return simpananStatus.data;
    if (simpananStatus.sedang) return simpananStatus.sedang;
  }

  const janji = (async () => {
    const respons = await alatAmbil(
      `${ALETA_API_STATUS}?nomor=${encodeURIComponent(nomor)}`,
      { credentials: "include", cache: "no-store" },
      "Membaca keadaan perkara"
    );
    if (!respons.ok) throw new Error(await pesanGalat(respons));
    const hasil = await respons.json();
    const isi = hasil?.data ?? hasil;

    // Sebabnya disebutkan apa adanya. "Tidak terbaca" saja membuat petugas
    // menduga ekstensinya rusak, padahal jawabannya kerap sederhana: botnya
    // sedang mati, atau nomor perkaranya memang tidak ada di SIPP.
    if (isi?.available === false) {
      throw new Error(isi.message || "ALETA Bot belum dapat dihubungi.");
    }
    if (!isi?.status) {
      throw new Error(
        isi?.alasan
          ? `Keadaan perkara tidak terbaca: ${String(isi.alasan).replace(/_/g, " ")}.`
          : "Keadaan perkara tidak terbaca dari ALETA."
      );
    }
    return isi.status;
  })();

  simpananStatus = { nomor, data: null, sedang: janji };
  try {
    const hasil = await janji;
    simpananStatus = { nomor, data: hasil, sedang: null };
    return hasil;
  } catch (galat) {
    // Kegagalan TIDAK disimpan: menu yang gagal sekali karena jaringan harus
    // dapat dicoba lagi hanya dengan menutup dan membukanya.
    simpananStatus = { nomor: "", data: null, sedang: null };
    throw galat;
  }
}

/**
 * Bagian panel yang isinya baru diambil saat dibuka.
 *
 * Terlipat sebagai bawaan - itulah yang membuatnya tidak berongkos. Saat
 * dibuka pertama kali ia menampilkan "Memuat", lalu menggambar sendiri.
 * Kegagalan disebutkan apa adanya, bukan dibiarkan kosong: menu kosong tanpa
 * keterangan terbaca sebagai perkara yang tidak punya data.
 */
function bagianMalas(judul, kunci, nomor, gambar) {
  const kotak = bagian(judul, kunci, true);
  let sudahDimuat = false;

  // Didaftarkan supaya dapat digambar ulang dari luar. Tanpa ini, membatalkan
  // simpanan hanya menolong menu yang BELUM dibuka - yang sudah terbentang
  // tetap memajang gambar lama sampai panelnya ditutup dan dibuka lagi.
  menuMalasHidup.push(kotak);

  // Menu ini sekarang tidak lagi menunggu ditekan untuk menyebutkan isinya:
  // lencananya diisi panggilan latar, dan itu yang membuat panel dapat dibaca
  // tanpa membuka satu pun menu.
  kotak.kunciLencana = kunci;

  const kepala = kotak.querySelector(".aleta-bagian-judul");
  const muatBagian = () => {
    const isi = kotak.isi;
    if (sudahDimuat || isi.style.display === "none") return;
    sudahDimuat = true;

    isi.appendChild(buatElemen("div", "aleta-memuat", "Memuat dari ALETA…"));
    void (async () => {
      try {
        const status = await ambilStatusPerkara(nomor);
        isi.textContent = "";
        gambar(isi, status);
        if (!isi.hasChildNodes()) {
          isi.appendChild(buatElemen("div", "aleta-kosong", "Tidak ada keterangan untuk bagian ini."));
        }
      } catch (galat) {
        isi.textContent = "";
        isi.appendChild(
          buatElemen("div", "aleta-gagal", String(galat.message || galat).slice(0, 200))
        );
        // Boleh dicoba lagi: tutup lalu buka kembali menunya.
        sudahDimuat = false;
      }
    })();
  };

  /**
   * Menggambar ulang dari awal.
   *
   * Yang TERBUKA digambar ulang seketika; yang tertutup cukup ditandai belum
   * dimuat, supaya ia mengambil yang baru saat dibuka. Menggambar ulang menu
   * yang tertutup berarti memanggil ALETA untuk sesuatu yang tidak sedang
   * dilihat siapa pun.
   */
  kotak.gambarUlang = () => {
    sudahDimuat = false;
    const isi = kotak.isi;
    if (!isi || isi.style.display === "none") return;
    isi.textContent = "";
    muatBagian();
  };

  kepala.addEventListener("click", muatBagian);

  // Dimuat juga ketika bagiannya SUDAH terbentang dari sesi sebelumnya.
  //
  // Keadaan lipatan disimpan antar-sesi. Bila tersimpan sebagai TERBUKA,
  // bagian ini tergambar terbentang tetapi kosong - dan baru terisi sesudah
  // ditekan DUA kali: sekali menutup, sekali membuka. Terbaca sebagai menu
  // yang rusak, padahal hanya pemuatnya yang tidak pernah dipanggil.
  if (kotak.isi.style.display !== "none") {
    setTimeout(muatBagian, 0);
  }

  return kotak;
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
 * NAMA KOLOM YANG DIKENAL ALETA
 * ============================================================================
 *
 * Kunci di sini BUKAN nama kolom di SIPP - ia nama perannya menurut ALETA.
 * Peta kolom di pengaturanlah yang menghubungkan keduanya, dan itu sebabnya
 * daftar ini tetap sama walau formulir SIPP berganti bentuk.
 *
 * "simpan" berbeda dari yang lain: ia tombol, bukan isian. Ia hanya dipakai
 * bila penyimpanan otomatis dinyalakan di pengaturan - dan bawaannya mati.
 */
const MEDAN_DIKENAL = {
  pmh: ["tanggal_penetapan", "nomor_sk", "hakim_ketua", "hakim_anggota_1", "hakim_anggota_2"],
  ppp: ["tanggal_penetapan", "nomor_sk", "panitera"],
  pjs: ["tanggal_penetapan", "nomor_sk", "jurusita"],
  phs: ["tanggal_penetapan", "tanggal_sidang"],
};

/**
 * Nilai yang hendak diisikan untuk satu formulir, disusun dari usulannya.
 *
 * Yang tidak ada nilainya TIDAK dimasukkan sebagai teks kosong. Kolom yang
 * diisi kosong menimpa isian yang mungkin sudah benar di sana; kolom yang
 * dilewati membiarkannya apa adanya.
 */
function nilaiUntukBorang(formulir, usulan, pilihanManual = {}) {
  const nilai = {};
  const tanggal = usulan.tanggalPenetapan || "";
  if (tanggal) nilai.tanggal_penetapan = tanggal;

  if (formulir === "pmh") {
    // ======================================================================
    // KETIGA KURSINYA DAPAT DIPILIH, BUKAN HANYA KETUA
    // ======================================================================
    //
    // Sebelumnya pilihan manual hanya menimpa KETUA majelis - anggota 1 dan 2
    // tetap dari usulan, apa pun yang dipilih petugas. Akibatnya "manual" pada
    // perkara bermajelis tidak pernah benar-benar manual: yang dapat diubah
    // sepertiga susunannya.
    //
    // Sekarang tiap kursi punya pilihannya sendiri, dan pilihan per-majelis
    // mengisi ketiganya sekaligus.
    const anggota = (usulan.pmh && usulan.pmh.anggota) || [];
    const kolam = (usulan.pmh && usulan.pmh.hitungan) || [];
    const susunanDipilih = susunanTerpilih(usulan.pmh, pilihanManual.majelis);

    for (const [urutan, medan] of [
      [0, "hakim_ketua"],
      [1, "hakim_anggota_1"],
      [2, "hakim_anggota_2"],
    ]) {
      // Urutan sumbernya disengaja: susunan majelis yang dipilih menang atas
      // pilihan per-orang, dan keduanya menang atas usulan. Yang memilih satu
      // susunan utuh sedang menyatakan maksud yang lebih besar daripada satu
      // kursi, dan kursi yang tertinggal dari pilihan sebelumnya tidak boleh
      // menyelinap masuk.
      const dariSusunan = susunanDipilih ? susunanDipilih.anggota[urutan] : null;
      const dariOrang = pilihanDari(kolam, (pilihanManual.pmhKursi || [])[urutan]);
      const orang = dariSusunan || dariOrang || anggota[urutan];
      if (orang && orang.nama) nilai[medan] = orang.nama;
    }
  } else if (formulir === "ppp") {
    const pp = pilihanDari(usulan.ppp && usulan.ppp.calon, pilihanManual.ppp)
      || (usulan.ppp && usulan.ppp.usulan);
    if (pp) nilai.panitera = pp.nama;
  } else if (formulir === "pjs") {
    const js = pilihanDari(usulan.pjs && usulan.pjs.calon, pilihanManual.pjs)
      || (usulan.pjs && usulan.pjs.usulan);
    if (js) nilai.jurusita = js.nama;
  } else if (formulir === "phs") {
    // Tanggal yang dipilih hanya dipakai bila ia memang salah satu hari sidang
    // majelis itu - kalau tidak, jatuh kembali ke usulan. Tanggal yang tidak
    // ada di daftar berarti daftarnya berubah sesudah papan digambar.
    const calon = (usulan.phs && usulan.phs.calon) || [];
    const dipilih = calon.find((x) => x.tanggal === pilihanManual.phs);
    const tanggalSidang = (dipilih && dipilih.tanggal) || (usulan.phs && usulan.phs.usulan) || "";
    if (tanggalSidang) nilai.tanggal_sidang = tanggalSidang;
  }

  return nilai;
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
    const calon = (usulan.phs && usulan.phs.calon) || [];
    const dipilih = calon.find((x) => x.tanggal === pilihanManual.phs);
    const tanggalSidang =
      (dipilih && dipilih.tanggal) || (usulan.phs && usulan.phs.usulan) || "";
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
    return Number.isFinite(ruanganId) && ruanganId > 0
      ? { tanggalSidang, ruanganId }
      : { tanggalSidang };
  }

  return null;
}

/** Urutan yang tidak dapat dibalik - SIPP menolak PPP/PJS sebelum majelisnya ada. */
const URUTAN_TULIS = ["pmh", "ppp", "pjs", "phs"];

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

/** Andaian dari satu usulan yang lolos uji kering - siapa yang AKAN ditulis. */
function andaianDari(usulan, pilihanManual) {
  const pmh = idUntukTulis("pmh", usulan, pilihanManual) || {};
  const ppp = idUntukTulis("ppp", usulan, pilihanManual) || {};
  const pjs = idUntukTulis("pjs", usulan, pilihanManual) || {};
  const phs = idUntukTulis("phs", usulan, pilihanManual) || {};
  const hasil = {
    perkaraId: Number((usulan.perkara && usulan.perkara.perkaraId) || 0),
    hakimId: Array.isArray(pmh.hakimId) ? pmh.hakimId : [],
    paniteraId: Number(ppp.petugasId) || 0,
    jurusitaId: Number(pjs.petugasId) || 0,
    tanggalSidang: phs.tanggalSidang || "",
  };
  if (hasil.hakimId.length === 0 && !hasil.paniteraId && !hasil.jurusitaId && !hasil.tanggalSidang) {
    return null;
  }
  return hasil;
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
    pola: /^jenis_tidak_didukung$/,
    kalimat: () => "Jenis penetapan ini tidak dikenali ALETA.",
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

async function rantaiPenetapan(usulan, data, kering) {
  const perkaraId = Number((usulan.perkara && usulan.perkara.perkaraId) || 0);
  if (!perkaraId) return [{ jenis: "pmh", ok: false, alasan: "perkara tidak dikenali" }];

  const pilihanManual = (data && data.pilihanManual) || {};
  const pejabat = (data && data.pejabatDipilih) || {};
  const rencana = (data && data.rencana && data.rencana.langkah) || [];

  const hasil = [];
  // Jenis yang SUDAH lulus lebih dahulu pada rantai ini. Dikirim supaya uji
  // kering menilai PHS atas keadaan yang akan ada sesudah PMH ditulis, bukan
  // atas keadaan sekarang - tanpa itu PHS selalu ditolak "pmh_belum_ada" pada
  // perkara yang baru didaftarkan, dan tidak satu pun penetapan pernah
  // tertulis.
  const rantaiSebelum = [];
  for (const jenis of URUTAN_TULIS) {
    const nilai = idUntukTulis(jenis, usulan, pilihanManual);
    if (!nilai) {
      hasil.push({ jenis, ok: false, alasan: "belum ada usulan yang dapat ditulis" });
      break;
    }

    // Pejabat penetapnya: pilihan petugas bila ada, kalau tidak yang dipilih
    // mesin. Yang dikirim USERNAME akun SIPP-nya - itulah yang tercatat pada
    // kolom pengguna dan pada baris sys_audittrail.
    const langkah = rencana.find((x) => x.jenis === jenis);
    const otomatis = langkah && langkah.akun ? langkah.akun.username : "";
    const olehUsername = pejabat[jenis] || otomatis;
    if (!olehUsername) {
      hasil.push({ jenis, ok: false, alasan: "akun pejabat penetapnya belum diketahui" });
      break;
    }

    let jawab;
    try {
      const respons = await alatAmbil(
        ALETA_API_TULIS,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jenis,
            perkaraId,
            tanggalPenetapan: usulan.tanggalPenetapan || "",
            ...nilai,
            olehUsername,
            kering,
            rantaiSebelum: rantaiSebelum.slice(),
          }),
        },
        kering ? "Menyusun rencana penetapan" : "Menulis penetapan"
      );
      const luar = await respons.json();
      jawab = luar && luar.data ? luar.data : luar;
    } catch (galat) {
      hasil.push({ jenis, ok: false, alasan: String((galat && galat.message) || galat) });
      break;
    }

    const berhasil = jawab && jawab.ok !== false;

    // Tulisan yang SUNGGUHAN mengubah SIPP membuat simpanan keadaan perkara
    // basi seketika. Dibatalkan di sini, bukan di pemanggil: tiap jenis
    // penetapan lewat gelung ini, dan menaruhnya di pemanggil berarti satu
    // jenis yang ditambahkan kelak akan terlewat tanpa berbunyi.
    //
    // Uji keringnya TIDAK membatalkan apa pun - ia memang tidak menulis.
    if (berhasil && !kering) lupakanStatusPerkara(String((usulan.perkara && usulan.perkara.nomorPerkara) || ""));

    const kode = berhasil ? "" : String((jawab && jawab.alasan) || "ditolak");
    hasil.push({
      jenis,
      ok: berhasil,
      // Kodenya dibawa apa adanya - penjaga _sudah_ada mencocokkannya.
      alasan: kode,
      // Dan bunyinya, untuk dibaca orang.
      bunyi: berhasil
        ? ""
        : kalimatAlasan(kode, (jawab && jawab.username) || olehUsername),
      atasNama: jawab && jawab.atasNama,
      langkah: (jawab && jawab.langkah) || [],
      andaian: (jawab && jawab.andaian) || [],
      // Kosong pada keadaan biasa. Berisi ketika rantainya dilanjutkan pada
      // hari yang berbeda - lihat catatanTanggal di penetapanTulisService.
      catatanTanggal: (jawab && jawab.catatanTanggal) || [],
      // Dibawa supaya hasil SESUDAH eksekusi dapat mengulang apa yang
      // sungguh ditulis, bukan hanya mengatakan "ditetapkan".
      tanggalPenetapan: (jawab && jawab.tanggalPenetapan) || "",
      olehUsername,
    });
    // ======================================================================
    // LANGKAH YANG SUDAH ADA DILEWATI - RANTAINYA TIDAK BERHENTI
    // ======================================================================
    //
    // Sebelumnya tiap penolakan memutus rantai, termasuk "pmh_sudah_ada" -
    // dan itu membuat perkara yang PMH-nya sudah ditetapkan tetapi PPP, PJS,
    // dan PHS-nya belum TIDAK PERNAH dapat dilanjutkan. Pada penetapan
    // massal akibatnya lebih besar lagi: satu perkara semacam itu di urutan
    // pertama menghentikan seluruh halaman.
    //
    // "Sudah ada" bukan kegagalan - ia keadaan yang memang dituju. Langkahnya
    // dicatat sebagai sudah ada, dimasukkan ke rantaiSebelum (sebab ia
    // sungguh-sungguh ada, dan langkah berikutnya menuntutnya), lalu rantai
    // berjalan terus. Yang benar-benar gagal tetap memutus.
    if (!berhasil) {
      if (/_sudah_ada$/.test(kode)) {
        rantaiSebelum.push(jenis);
        continue;
      }
      break;
    }
    rantaiSebelum.push(jenis);
  }

  return hasil;
}

async function tetapkanLewatAleta(tombol, kabar, usulan, data, keadaan, kering) {
  const perkaraId = Number((usulan.perkara && usulan.perkara.perkaraId) || 0);
  if (!perkaraId) {
    kabar.textContent = "Perkara tidak dikenali.";
    return { ok: false };
  }

  const hasil = await rantaiPenetapan(usulan, data, kering);

  // Rapor hanya disusun untuk uji kering - pada penulisan sungguhan yang
  // dibaca orang hasilnya, bukan ramalannya.
  gambarHasilTulis(kabar, hasil, kering, kering ? raporPraperiksa(usulan, data, hasil) : null);
  return { ok: hasil.every((x) => x.ok), hasil };
}

/**
 * ============================================================================
 * MEMBATALKAN PENETAPAN YANG SUDAH TERTULIS
 * ============================================================================
 *
 * Penetapan yang salah tidak dapat diperbaiki dengan menekan ulang: tabelnya
 * menolak baris kedua, dan yang tertinggal perkara yang separuh tertulis.
 * Sebelum ada tombol ini, jalan keluarnya membongkar dengan tangan dari
 * beberapa tabel sekaligus.
 *
 * Yang dibatalkan selalu langkah TERAKHIR yang masih ada, dari PHS ke PMH.
 * Urutannya tidak dapat dibalik - membongkar majelis selagi hari sidangnya
 * masih berdiri meninggalkan sidang bagi majelis yang sudah tidak ada - dan
 * servernya menolak permintaan semacam itu. Yang dikerjakan di sini hanya
 * mencarikan langkah yang memang boleh dibongkar.
 *
 * Dua tekanan, sama seperti menulis: yang pertama memperlihatkan rencananya,
 * yang kedua membongkar.
 */
const URUTAN_BONGKAR = ["phs", "pjs", "ppp", "pmh"];

async function mintaBongkar(perkaraId, jenis, olehUsername, kering) {
  try {
    const respons = await alatAmbil(
      ALETA_API_HAPUS,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jenis, perkaraId, olehUsername, kering }),
      },
      kering ? "Menyusun rencana pembatalan" : "Membatalkan penetapan"
    );
    const luar = await respons.json();
    return (luar && luar.data ? luar.data : luar) || { ok: false, alasan: "tanpa_jawaban" };
  } catch (galat) {
    return { ok: false, alasan: String((galat && galat.message) || galat) };
  }
}

/**
 * Membongkar SELURUH rantai penetapan satu perkara dalam satu permintaan.
 *
 * Rantainya diurus bot, bukan di sini. Empat permintaan terpisah dari
 * peramban adalah empat kesempatan berhenti di tengah - dan perkara yang
 * separuh terbongkar justru keadaan yang paling sukar dibereskan.
 */
async function mintaBongkarSemua(perkaraId, akunPerJenis, kering) {
  try {
    const respons = await alatAmbil(
      ALETA_API_HAPUS_SEMUA,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perkaraId, akunPerJenis, kering }),
      },
      kering ? "Menyusun rencana pembatalan menyeluruh" : "Membatalkan seluruh penetapan"
    );
    const luar = await respons.json();
    return (luar && luar.data ? luar.data : luar) || { ok: false, alasan: "tanpa_jawaban" };
  } catch (galat) {
    return { ok: false, alasan: String((galat && galat.message) || galat) };
  }
}

/**
 * Langkah terakhir yang masih ada dan boleh dibongkar.
 *
 * Dicari dengan uji kering, bukan ditebak dari layar: yang tahu langkah mana
 * yang masih berdiri adalah basis data SIPP, dan panel ini mungkin sudah lama
 * terbuka sejak keadaannya berubah.
 */
async function cariLangkahDibongkar(perkaraId, akunPerJenis) {
  for (const jenis of URUTAN_BONGKAR) {
    const oleh = akunPerJenis[jenis] || "";
    if (!oleh) continue;
    const jawab = await mintaBongkar(perkaraId, jenis, oleh, true);
    if (jawab && jawab.ok) return { jenis, oleh, rencana: jawab };
  }
  return null;
}

function bagianBatalkanPenetapan(usulan, data) {
  const perkaraId = Number((usulan.perkara && usulan.perkara.perkaraId) || 0);
  const kotak = buatElemen("div", "aleta-tetap-kaki");
  if (!perkaraId) return kotak;

  const tombol = buatElemen("button", "aleta-portal-tautan", "Batalkan penetapan terakhir");
  tombol.type = "button";
  const kabar = buatElemen("span", "aleta-tetap-sebab", "");

  // Akun pejabat tiap langkah - sama dengan yang dipakai menuliskannya, supaya
  // pembongkarannya tercatat atas nama yang sama.
  const rencanaLangkah = (data && data.rencana && data.rencana.langkah) || [];
  const akunPerJenis = {};
  for (const langkah of rencanaLangkah) {
    if (langkah && langkah.jenis && langkah.akun && langkah.akun.username) {
      akunPerJenis[langkah.jenis] = langkah.akun.username;
    }
  }
  for (const jenis of URUTAN_BONGKAR) {
    if (!akunPerJenis[jenis] && data && data.pejabatDipilih && data.pejabatDipilih[jenis]) {
      akunPerJenis[jenis] = data.pejabatDipilih[jenis];
    }
  }

  let siapDibongkar = null;

  tombol.addEventListener("click", async () => {
    tombol.disabled = true;

    if (!siapDibongkar) {
      kabar.textContent = "Mencari penetapan yang dapat dibatalkan…";
      const ketemu = await cariLangkahDibongkar(perkaraId, akunPerJenis);
      if (!ketemu) {
        kabar.textContent =
          "Tidak ada penetapan yang dapat dibatalkan dari sini. Langkah yang sudah diikuti langkah " +
          "berikutnya harus dibatalkan dari yang paling akhir lebih dulu.";
        tombol.disabled = false;
        return;
      }
      siapDibongkar = ketemu;
      const jumlah = (ketemu.rencana.rencana || []).length;
      kabar.textContent =
        `${ketemu.jenis.toUpperCase()} akan dibongkar atas nama ${ketemu.oleh} - ${jumlah} pernyataan, ` +
        "termasuk baris Riwayat Perkara. Belum ada yang dihapus. Tekan sekali lagi untuk membatalkan.";
      tombol.textContent = `Batalkan ${ketemu.jenis.toUpperCase()} sekarang`;
      tombol.disabled = false;
      return;
    }

    kabar.textContent = `Membatalkan ${siapDibongkar.jenis.toUpperCase()}…`;
    const hasil = await mintaBongkar(perkaraId, siapDibongkar.jenis, siapDibongkar.oleh, false);
    if (!hasil || !hasil.ok) {
      kabar.textContent = `Gagal: ${(hasil && hasil.alasan) || "tidak diketahui"}`;
      tombol.disabled = false;
      return;
    }
    kabar.textContent = `${siapDibongkar.jenis.toUpperCase()} dibatalkan. Halaman dimuat ulang sebentar lagi.`;
    setTimeout(muatUlangHalamanPerkara, 2000);
  });

  kotak.appendChild(tombol);
  kotak.appendChild(kabar);

  // ==========================================================================
  // DAN SATU LAGI: SELURUHNYA SEKALIGUS
  // ==========================================================================
  //
  // Membatalkan satu per satu menuntut empat kali dua tekanan, berurutan dari
  // PHS mundur ke PMH. Delapan tekanan yang urutannya harus diingat adalah
  // delapan kesempatan berhenti di tengah, dan perkara yang separuh
  // terbongkar justru keadaan yang paling sukar dibereskan.
  //
  // Tetap DUA tekanan, sama seperti yang lain: yang pertama memperlihatkan
  // rencananya langkah demi langkah beserta cacah pernyataannya, yang kedua
  // membongkar. Yang membaca rencana itu tahu persis apa yang akan hilang
  // sebelum satu baris pun hilang.
  kotak.appendChild(tombolBongkarSemua(perkaraId, akunPerJenis));
  return kotak;
}

/** Tombol yang membongkar seluruh rantai penetapan satu perkara. */
function tombolBongkarSemua(perkaraId, akunPerJenis) {
  const baris = buatElemen("div", "aleta-bongkar-semua");
  const tombol = buatElemen("button", "aleta-portal-tautan", "Batalkan SELURUH penetapan perkara ini");
  tombol.type = "button";
  const kabar = buatElemen("span", "aleta-tetap-sebab", "");
  let sudahDiperlihatkan = false;

  tombol.addEventListener("click", async () => {
    tombol.disabled = true;

    if (!sudahDiperlihatkan) {
      kabar.textContent = "Menyusun rencana pembatalan menyeluruh…";
      const rencana = await mintaBongkarSemua(perkaraId, akunPerJenis, true);
      const langkah = (rencana && rencana.langkah) || [];

      if (langkah.length === 0) {
        kabar.textContent =
          (rencana && rencana.berhentiKarena && rencana.berhentiKarena.alasan) ||
          "Tidak ada penetapan yang dapat dibatalkan pada perkara ini.";
        tombol.disabled = false;
        return;
      }

      kabar.textContent = "";
      const daftar = buatElemen("div", "aleta-bongkar-rencana");
      daftar.appendChild(
        buatElemen(
          "div",
          "aleta-tulis-judul",
          "Akan dibongkar berurutan - belum ada yang dihapus:"
        )
      );
      for (const x of langkah) {
        const nama = (x.atasNama && x.atasNama.namaLengkap) || (x.atasNama && x.atasNama.username) || "";
        daftar.appendChild(
          buatElemen(
            "div",
            "aleta-baris-ket",
            `${String(x.jenis).toUpperCase()} — ${x.jumlahPernyataan} pernyataan pada ${(x.tabel || []).length} tabel` +
              (nama ? ` · atas nama ${nama}` : "")
          )
        );
      }
      if (rencana.berhentiKarena) {
        daftar.appendChild(
          buatElemen(
            "div",
            "aleta-baris-ket aleta-lencana-lewat",
            `Berhenti di ${String(rencana.berhentiKarena.jenis).toUpperCase()}: ${rencana.berhentiKarena.alasan}`
          )
        );
      }
      kabar.appendChild(daftar);

      sudahDiperlihatkan = true;
      tombol.textContent = `Bongkar ${langkah.length} penetapan sekarang`;
      tombol.disabled = false;
      return;
    }

    kabar.textContent = "Membongkar…";
    const hasil = await mintaBongkarSemua(perkaraId, akunPerJenis, false);
    const langkah = (hasil && hasil.langkah) || [];
    const berhasil = langkah.filter((x) => x.ok).length;

    if (!hasil || !hasil.ok) {
      const sebab =
        (hasil && hasil.berhentiKarena && hasil.berhentiKarena.alasan) ||
        (hasil && hasil.alasan) ||
        "tidak diketahui";
      // Yang SUDAH terbongkar disebutkan, bukan ditelan bersama pesan gagal:
      // yang membacanya perlu tahu sampai mana perkaranya terbongkar.
      kabar.textContent = berhasil
        ? `Berhenti sesudah ${berhasil} langkah: ${sebab}`
        : `Gagal: ${sebab}`;
      tombol.disabled = false;
      return;
    }

    kabar.textContent = `${berhasil} penetapan dibatalkan. Halaman dimuat ulang sebentar lagi.`;
    setTimeout(muatUlangHalamanPerkara, 2000);
  });

  baris.appendChild(tombol);
  baris.appendChild(kabar);
  return baris;
}

/**
 * ============================================================================
 * PRAPERIKSA - APA YANG AKAN TERJADI, DALAM KALIMAT
 * ============================================================================
 *
 * Uji kering dulu menjawab "7 pernyataan disiapkan" per langkah. Itu benar,
 * dan itu tidak menolong siapa pun: yang hendak diketahui petugas sebelum
 * menekan bukan berapa baris SQL yang akan berjalan, melainkan SIAPA yang
 * akan ditunjuk, KENAPA orang itu, KAPAN sidangnya, dan apakah ada yang
 * mengganjal.
 *
 * Rapor ini menjawab keempatnya, dan cacah pernyataannya tetap ada di bawah
 * sebagai rinciannya - yang dibaca ketika ada yang perlu ditelusuri.
 *
 * ============================================================================
 * SELURUHNYA DIHITUNG DI SINI, TANPA SATU PUN PANGGILAN BARU
 * ============================================================================
 *
 * Bahannya sudah ada di layar: usulan beserta sebabnya, pilihan manual yang
 * sedang berlaku, dan rencana kerja yang menyebut akun pelaksana tiap
 * langkah. Menambah panggilan hanya untuk merapikan kalimat berarti menunda
 * jawabannya demi jawaban yang sama.
 */
function raporPraperiksa(usulan, data, hasilKering) {
  const pilihanManual = (data && data.pilihanManual) || {};
  const baris = [];
  const ganjalan = [];

  // ==========================================================================
  // TANGGAL PENETAPAN - PALING ATAS, SEBAB IA MENGIKAT KETIGA LANGKAH LAIN
  // ==========================================================================
  //
  // Dahulu tidak pernah dipajang sama sekali. Selama seluruh langkah wajib
  // setanggal, itu masih dapat dimaklumi - tanggalnya hanya satu dan tidak
  // dapat lain. Sejak rantainya boleh dilanjutkan pada hari yang berbeda,
  // justru tanggal inilah yang paling perlu diperiksa sebelum ditekan.
  if (usulan.tanggalPenetapan) {
    baris.push({
      label: "Tanggal penetapan",
      nilai: sebutTanggal(usulan.tanggalPenetapan),
      sebab: "",
    });
  }

  const pmh = usulan.pmh || {};
  const susunan = susunanTerpilih(pmh, pilihanManual.majelis);
  const anggota = (susunan && susunan.anggota) || pmh.anggota || [];
  const namaMajelis = anggota.map((x) => x && x.nama).filter(Boolean).join(", ");
  if (namaMajelis) {
    baris.push({ label: pmh.bentuk === "majelis" ? "Majelis" : "Hakim", nilai: namaMajelis, sebab: pmh.sebab || "" });
  }
  if (pmh.perluNilai) ganjalan.push("Nilai sengketa belum diisi di SIPP - isi dahulu di Data Umum.");

  const ppp = usulan.ppp || {};
  const pppTerpilih = pilihanDari(ppp.calon, pilihanManual.ppp) || ppp.usulan;
  if (pppTerpilih) {
    baris.push({ label: "Panitera pengganti", nilai: pppTerpilih.nama || "", sebab: ppp.sebab || "" });
  }

  const pjs = usulan.pjs || {};
  const pjsTerpilih = pilihanDari(pjs.calon, pilihanManual.pjs) || pjs.usulan;
  if (pjsTerpilih) {
    baris.push({ label: "Juru sita", nilai: pjsTerpilih.nama || "", sebab: pjs.sebab || "" });
  }
  if (pjs.peringatan) ganjalan.push(pjs.peringatan);

  const phs = usulan.phs || {};
  const nilaiPhs = idUntukTulis("phs", usulan, pilihanManual);
  const tanggalSidang = (nilaiPhs && nilaiPhs.tanggalSidang) || "";
  if (tanggalSidang) {
    const sebabPhs = [phs.sebab, phs.jarakHari ? `${phs.jarakHari} hari sejak daftar` : ""]
      .filter(Boolean)
      .join(" · ");
    baris.push({ label: "Hari sidang", nilai: sebutTanggal(tanggalSidang), sebab: sebabPhs });
  }

  // ==========================================================================
  // RUANG SIDANG - DIKIRIM SEJAK LAMA, TIDAK PERNAH DIPAJANG
  // ==========================================================================
  //
  // pilihanManual.ruangan sudah diteruskan ke mesin tulis sejak ruangan dapat
  // dipilih, tetapi tidak pernah muncul di pratinjau. Akibatnya ruangan yang
  // keliru - sidang keliling yang tertulis di dalam gedung - tidak dapat
  // ketahuan sebelum ditekan, dan gagalnya diam: penetapannya berhasil,
  // berkasnya tercetak, sidangnya digelar, dan laporan sidang keliling
  // menghitung nol.
  //
  // Namanya dicari dari daftar yang sudah tersimpan, bukan nomornya yang
  // dipajang: "3" tidak memberi tahu siapa pun ruangan mana yang dimaksud.
  const idRuangan = Number(pilihanManual.ruangan);
  if (Number.isFinite(idRuangan) && idRuangan > 0) {
    const tempat = (ruanganTersimpan || []).find((r) => String(r.id) === String(idRuangan));
    baris.push({
      label: "Ruang sidang",
      // Daftarnya belum terbaca - dikatakan apa adanya, bukan disamarkan
      // menjadi nomor yang tampak pasti.
      nilai: tempat ? tempat.nama || `ruangan ${idRuangan}` : `ruangan ${idRuangan} (namanya belum terbaca)`,
      sebab: "pilihan Anda",
    });
  }

  // ==========================================================================
  // PEJABAT PENETAP TIAP LANGKAH - SIAPA YANG MENANDATANGANINYA
  // ==========================================================================
  //
  // Dahulu hanya muncul ketika BERMASALAH, sebagai ganjalan. Pada keadaan
  // biasa - yang paling sering - pratinjau sama sekali tidak menyebut atas
  // nama siapa penetapan akan tertulis, padahal namanya itulah yang mendarat
  // di kolom pengguna dan di sys_audittrail.
  //
  // Yang dipilih tangan ditandai. Tanpa tanda itu, petugas yang baru saja
  // memilih pejabat lain tidak punya cara memastikan pilihannya sampai -
  // dan pilihan yang tidak sampai tidak berbunyi apa pun.
  const pejabatDipilih = (data && data.pejabatDipilih) || {};
  for (const langkah of (data && data.rencana && data.rencana.langkah) || []) {
    const jenis = String((langkah && langkah.jenis) || "").toUpperCase();
    if (!jenis) continue;
    const tangan = pejabatDipilih[String(langkah.jenis)];
    const akun = (langkah && langkah.akun) || {};
    const username = tangan || akun.username || "";
    if (!username) continue;
    const nama = akun.namaLengkap || akun.nama || "";
    baris.push({
      label: `Penetap ${jenis}`,
      nilai: nama ? `${nama} (${username})` : username,
      sebab: tangan ? "pilihan Anda" : "",
    });
  }

  // Rantai yang dilanjutkan pada hari berbeda - dari bot, bukan dihitung
  // ulang di sini. Bukan ganjalan: ia sah, dan satu dari lima perkara di
  // satker ini memang begitu. Tetapi ia HARUS terbaca sebelum ditekan.
  for (const hasil of hasilKering || []) {
    for (const catatan of (hasil && hasil.catatanTanggal) || []) {
      if (catatan) ganjalan.push(catatan);
    }
  }

  // ==========================================================================
  // GANJALAN YANG TIDAK DAPAT DILIHAT DARI LAYAR SIPP
  // ==========================================================================
  //
  // Ketiganya keadaan yang sah menurut basis data - SIPP akan menerimanya
  // tanpa mengeluh - tetapi keliru menurut hukum acara atau menurut kalender.
  // Yang menemukannya sesudah penetapan tertulis harus membongkar empat
  // langkah untuk memperbaiki satu tanggal.
  const akhirPekan = hariAkhirPekan(tanggalSidang);
  if (akhirPekan) ganjalan.push(`Hari sidang jatuh pada ${akhirPekan}.`);

  const jarak = Number(phs.jarakHari);
  if (Number.isFinite(jarak) && jarak > 0 && jarak < JARAK_SIDANG_MINIMUM) {
    ganjalan.push(
      `Hari sidang hanya ${jarak} hari sejak pendaftaran - panggilan patut menuntut sekurang-kurangnya ${JARAK_SIDANG_MINIMUM} hari.`
    );
  }

  // Catatan tentang pejabat penetapnya: Plh yang tercatat tetapi tidak
  // dipakai, pejabat yang berhalangan tanpa Plh, ketua majelis yang baru
  // pasti sesudah PMH tersimpan.
  const langkahRencana = (data && data.rencana && data.rencana.langkah) || [];
  for (const langkah of langkahRencana) {
    const akun = langkah && langkah.akun;
    if (akun && akun.siap === false && akun.sebab) {
      ganjalan.push(`${String(langkah.jenis || "").toUpperCase()}: ${akun.sebab}`);
    }
    for (const c of (langkah && langkah.catatanPenetap) || []) {
      if (c) ganjalan.push(`${String(langkah.jenis || "").toUpperCase()}: ${c}`);
    }
  }

  // Yang DITOLAK uji kering karena sudah ada di SIPP - itu bukan kegagalan
  // ALETA, itu keadaan perkaranya, dan menyebutnya sebagai kegagalan membuat
  // orang mencari kerusakan yang tidak ada.
  const sudahAda = (hasilKering || [])
    .filter((x) => !x.ok && /_sudah_ada$/.test(String(x.alasan || "")))
    .map((x) => String(x.jenis).toUpperCase());

  return { baris, ganjalan, sudahAda };
}

/** Sekurang-kurangnya sekian hari antara pendaftaran dan sidang pertama. */
const JARAK_SIDANG_MINIMUM = 7;

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

/** Menggambarkan hasil keempat langkah - kering maupun sungguhan. */
function gambarHasilTulis(kabar, hasil, kering, rapor) {
  kabar.textContent = "";
  const kotak = buatElemen("div", "aleta-tulis-hasil");

  kotak.appendChild(
    buatElemen(
      "div",
      "aleta-tulis-judul",
      kering
        ? "Rencana penetapan - belum ada yang ditulis. Periksa, lalu tekan sekali lagi."
        : "Hasil penetapan"
    )
  );

  // Rapor dalam kalimat lebih dahulu, rincian pernyataannya di bawah. Yang
  // memeriksa sebelum menekan membaca yang pertama; yang menelusuri sesudah
  // ada yang keliru membaca yang kedua.
  if (kering && rapor) kotak.appendChild(gambarRaporPraperiksa(rapor));

  for (const satu of hasil) {
    const baris = buatElemen("div", satu.ok ? "aleta-tulis-baris" : "aleta-tulis-baris aleta-tulis-gagal");
    const atas = satu.atasNama && (satu.atasNama.namaLengkap || satu.atasNama.username);
    baris.appendChild(
      buatElemen(
        "span",
        "aleta-tulis-jenis",
        `${satu.jenis.toUpperCase()}${atas ? ` — ${atas}` : ""}`
      )
    );
    baris.appendChild(
      buatElemen(
        "span",
        "aleta-tulis-ket",
        satu.ok
          ? kering
            ? `${(satu.langkah || []).length} pernyataan disiapkan`
            : "ditetapkan"
          : // Bunyinya, bukan kodenya - lihat kalimatAlasan. Kodenya tetap
            // dipakai penjaga di tempat lain, tetapi yang DIBACA orang harus
            // menyebutkan jalan keluarnya.
            satu.bunyi || satu.alasan
      )
    );
    kotak.appendChild(baris);

    // ======================================================================
    // TANGGALNYA DIULANG SESUDAH EKSEKUSI
    // ======================================================================
    //
    // Yang sudah tertulis ke SIPP tidak dapat dilihat lagi dari panel tanpa
    // membuka SIPP. Rapor praperiksa menyebut tanggalnya sebelum ditekan,
    // lalu hilang begitu tertulis - sehingga yang ingin memastikan apa yang
    // barusan terjadi harus berpindah aplikasi.
    //
    // Hanya pada penulisan SUNGGUHAN: pada uji kering tanggalnya sudah
    // disebut rapor di atas, dan mengulangnya di tiap baris hanya
    // memanjangkan yang sudah terbaca.
    if (!kering && satu.ok && satu.tanggalPenetapan) {
      kotak.appendChild(
        buatElemen("div", "aleta-tulis-ket", `Bertanggal ${sebutTanggal(satu.tanggalPenetapan)}`)
      );
    }

    for (const catatan of satu.catatanTanggal || []) {
      if (catatan) kotak.appendChild(buatElemen("div", "aleta-tulis-ket", catatan));
    }

    // Andaian yang dipakai menyusun langkah ini - mis. PHS dinilai dengan
    // menganggap PMH sudah ditulis. Disebutkan supaya yang membacanya tahu
    // rencana ini dinilai atas keadaan yang BELUM ada.
    for (const satuAndaian of satu.andaian || []) {
      kotak.appendChild(buatElemen("div", "aleta-tulis-ket", `Andaian: ${satuAndaian}`));
    }
  }

  // Yang tidak sempat dijalankan disebut apa adanya. Diamnya membuat orang
  // menyangka keempatnya sudah dikerjakan padahal berhenti di langkah kedua.
  const sudah = new Set(hasil.map((x) => x.jenis));
  const belum = URUTAN_TULIS.filter((x) => !sudah.has(x));
  if (belum.length > 0) {
    kotak.appendChild(
      buatElemen(
        "div",
        "aleta-tulis-ket",
        `Tidak dilanjutkan: ${belum.map((x) => x.toUpperCase()).join(", ")} - urutannya tidak dapat dibalik.`
      )
    );
  }

  kabar.appendChild(kotak);
}

/** Menggambar rapor praperiksa - lihat raporPraperiksa. */
function gambarRaporPraperiksa(rapor) {
  const kotak = buatElemen("div", "aleta-praperiksa");

  for (const b of rapor.baris) {
    const baris = buatElemen("div", "aleta-praperiksa-baris");
    baris.appendChild(buatElemen("span", "aleta-praperiksa-label", b.label));
    const nilai = buatElemen("span", "aleta-praperiksa-nilai");
    nilai.appendChild(buatElemen("span", "aleta-praperiksa-isi", b.nilai));
    if (b.sebab) nilai.appendChild(buatElemen("span", "aleta-praperiksa-sebab", b.sebab));
    baris.appendChild(nilai);
    kotak.appendChild(baris);
  }

  if (rapor.sudahAda.length > 0) {
    kotak.appendChild(
      buatElemen(
        "div",
        "aleta-praperiksa-catatan",
        `Sudah ada di SIPP dan karena itu dilewati: ${rapor.sudahAda.join(", ")}.`
      )
    );
  }

  for (const g of rapor.ganjalan) {
    kotak.appendChild(buatElemen("div", "aleta-praperiksa-ganjal", g));
  }

  if (rapor.baris.length === 0 && rapor.ganjalan.length === 0) {
    kotak.appendChild(
      buatElemen("div", "aleta-praperiksa-catatan", "Tidak ada usulan yang dapat diperiksa.")
    );
  }

  return kotak;
}

/** Baris catatan untuk satu formulir - apa yang diisikan, dan dari mana asalnya. */
function barisCatatan(formulir, nilai, usulan, pilihanManual = {}) {
  const sebab =
    formulir === "pmh"
      ? (usulan.pmh && usulan.pmh.sebab) || ""
      : formulir === "ppp"
        ? (usulan.ppp && usulan.ppp.sebab) || ""
        : formulir === "pjs"
          ? (usulan.pjs && usulan.pjs.sebab) || ""
          : (usulan.phs && usulan.phs.sebab) || "";

  /**
   * Apakah medan ini benar-benar berasal dari pilihan tangan.
   *
   * Bukan sekadar "cara papan sedang manual": petugas dapat menyalakan manual
   * lalu tidak mengubah apa pun, dan mencatat seluruhnya sebagai pilihan
   * tangan akan menghapus jejak bahwa usulan ALETA-lah yang dipakai. Yang
   * dicatat manual hanya medan yang memang ada pilihannya.
   */
  const dipilihTangan = (medan) => {
    if (formulir === "ppp") return Boolean(pilihanManual.ppp);
    if (formulir === "pjs") return Boolean(pilihanManual.pjs);
    if (formulir === "phs") return medan === "tanggal_sidang" && Boolean(pilihanManual.phs);
    if (formulir === "pmh") {
      if (pilihanManual.majelis) return medan.startsWith("hakim_");
      const kursi = pilihanManual.pmhKursi || [];
      const urutan = { hakim_ketua: 0, hakim_anggota_1: 1, hakim_anggota_2: 2 }[medan];
      return urutan !== undefined && Boolean(kursi[urutan]);
    }
    return false;
  };

  return Object.entries(nilai).map(([medan, isi]) => ({
    jenis: formulir,
    medan,
    nilai: String(isi),
    asal: dipilihTangan(medan) ? "manual" : "otomatis",
    alasan: dipilihTangan(medan)
      ? `${sebab} · diubah tangan${pilihanManual.majelis && formulir === "pmh" ? " lewat pilihan majelis" : ""}`
      : sebab,
  }));
}

/**
 * Sederet pil pilihan yang DAPAT ditekan.
 *
 * ============================================================================
 * DULU HANYA PENANDA - DAN ITU MENYESATKAN
 * ============================================================================
 *
 * Semula pilnya berupa <span> tanpa penangan apa pun: bentuknya persis tombol,
 * warnanya membedakan yang aktif, tetapi menekannya tidak melakukan apa-apa.
 * Yang membacanya wajar menyimpulkan aplikasinya rusak - dan kesimpulan itu
 * jauh lebih merugikan daripada tidak ada saklar sama sekali.
 *
 * Sekarang ia benar-benar tombol. Pemanggil yang TIDAK memberi onPilih
 * mendapat pil yang tampak mati dan menyebutkan dirinya belum dapat diubah -
 * bukan tombol hidup yang diam.
 */
function saklarPapan(nama, pilihan, aktif, onPilih) {
  const baris = buatElemen("div", "aleta-saklar");
  baris.appendChild(buatElemen("span", "aleta-saklar-nama", nama));

  for (const pil of pilihan) {
    const tombol = buatElemen("button", "aleta-saklar-pil", pil.label);
    tombol.type = "button";
    if (pil.nilai === aktif) tombol.classList.add("aleta-saklar-aktif");

    if (typeof onPilih === "function") {
      tombol.addEventListener("click", () => {
        if (pil.nilai === aktif) return;
        onPilih(pil.nilai);
      });
    } else {
      tombol.disabled = true;
      tombol.title = "Keadaan sekarang - belum dapat diubah dari sini.";
    }

    baris.appendChild(tombol);
  }
  return baris;
}

/**
 * Pilihan orang untuk satu penetapan, pada cara MANUAL.
 *
 * ============================================================================
 * DAFTARNYA SUDAH ADA - HANYA BELUM PERNAH DIGAMBAR
 * ============================================================================
 *
 * Layanan penunjukan sejak awal mengirim SELURUH kolam calon, bukan hanya yang
 * terpilih: `daftar` untuk panitera pengganti dan juru sita, `hitungan` untuk
 * hakim. Yang tergambar selama ini hanya juaranya.
 *
 * Karena itu cara manual tidak menuntut satu pun panggilan baru ke server. Yang
 * ditambahkan hanya kemampuan MEMILIH yang lain dari daftar yang sudah datang.
 *
 * ============================================================================
 * URUTANNYA TIDAK DIACAK - YANG DIUSULKAN TETAP DI ATAS
 * ============================================================================
 *
 * Daftarnya sudah terurut menurut keadilan beban, dan urutan itu dipertahankan.
 * Manual berarti "saya boleh memilih yang lain", bukan "usulannya dibuang":
 * yang memilih manual pun tetap perlu tahu siapa yang semestinya, supaya
 * penyimpangannya adalah keputusan - bukan ketidaktahuan.
 */
function pilihanOrang(label, daftar, terpilihId, onPilih) {
  const baris = buatElemen("div", "aleta-pilih");
  baris.appendChild(buatElemen("span", "aleta-pilih-nama", label));

  const kotak = document.createElement("select");
  kotak.className = "aleta-pilih-kotak";

  for (const orang of daftar) {
    const opsi = document.createElement("option");
    opsi.value = String(orang.id);
    opsi.textContent = orang.label;
    if (String(orang.id) === String(terpilihId)) opsi.selected = true;
    kotak.appendChild(opsi);
  }

  kotak.addEventListener("change", () => onPilih(kotak.value));
  baris.appendChild(kotak);
  return baris;
}

/**
 * Satu baris penetapan: judulnya, usulannya, dan SEBABNYA.
 *
 * Sebabnya selalu ikut ditampilkan, bukan disembunyikan di balik tanda tanya.
 * Usulan yang muncul tanpa alasan hanya bisa dipercaya atau tidak dipercaya;
 * usulan yang menyebutkan dasarnya bisa DIPERIKSA - dan memeriksa itulah
 * seluruh gunanya papan ini ada sebelum tombolnya dinyalakan.
 */
/**
 * Jabatan yang MENETAPKAN tiap penetapan - bukan yang ditunjuk di dalamnya.
 *
 * Dua hal yang mudah tertukar saat membaca papan: PMH berisi nama hakimnya,
 * tetapi yang MENETAPKAN adalah Ketua Pengadilan. PHS berisi tanggal, dan yang
 * menetapkannya ketua majelis perkara itu - bukan pimpinan.
 */
const SEBUTAN_PENETAP = {
  pmh: "Ketua Pengadilan",
  ppp: "Panitera",
  pjs: "Panitera",
  phs: "ketua majelis",
};

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

/** Keterangan sekali pakai yang menerangkan angka beban di atasnya. */
function keteranganBeban() {
  return buatElemen(
    "div",
    "aleta-tetap-hitung",
    "Beban dihitung berbobot - cerai & itsbat 1, harta bersama/waris/wasiat/ekonomi syariah 2, selain itu 1,5."
  );
}

function penetapUntuk(data, jenis) {
  const jabatan = SEBUTAN_PENETAP[jenis] || "";
  const rencana = data && data.rencana;
  const langkah =
    rencana && Array.isArray(rencana.langkah)
      ? rencana.langkah.find((x) => x.jenis === jenis)
      : null;
  // ==========================================================================
  // YANG DIPILIH PETUGAS MENANG ATAS PILIHAN MESIN
  // ==========================================================================
  //
  // `langkah.akun` adalah calon yang DIPILIH MESIN. Ketika petugas mengganti
  // pejabatnya pada "Pejabat yang menetapkan", yang berubah hanya
  // data.pejabatDipilih - dan baris keterangan ini tetap menyebut nama lama.
  //
  // Selisih itu tidak berbunyi: yang tertulis di SIPP adalah pilihan petugas,
  // yang terbaca di layar pilihan mesin. Keduanya masuk akal, keduanya tampak
  // benar, dan hanya satu yang tercatat.
  const dipilih = data && data.pejabatDipilih && data.pejabatDipilih[jenis];
  const calonDipilih =
    dipilih && langkah && Array.isArray(langkah.calon)
      ? langkah.calon.find((x) => x.username === dipilih)
      : null;
  const akun = calonDipilih || (langkah ? langkah.akun : null);

  if (!akun) return jabatan ? `Ditetapkan ${jabatan}` : "";

  // Sebutan dari server MENANG atas daftar di atas. PMH ditandatangani Ketua -
  // kecuali Ketua sedang berhalangan, dan yang menandatangani Wakil atau
  // seorang Hakim sebagai Plh; PPP/PJS ditandatangani Panitera, kecuali ia
  // berhalangan dan ada Plh Panitera. Daftar di atas tidak dapat mengetahui
  // itu; yang merakit rencana tahu, karena ia membaca penugasan yang berlaku.
  const sebutan = akun.sebutan || jabatan;

  const bagian = [`Ditetapkan ${sebutan}`];
  if (akun.namaLengkap) bagian.push(`— ${akun.namaLengkap}`);
  if (akun.username) bagian.push(`(akun ${akun.username})`);

  let teks = bagian.join(" ");
  // Ketua majelis baru pasti SESUDAH PMH tersimpan; sampai saat itu yang
  // tertulis di sini masih dugaan dari usulan, dan itu disebutkan apa adanya.
  if (akun.tentatif) teks += " · dipastikan ulang setelah penetapan majelis tersimpan";
  if (akun.siap === false && akun.sebab) teks += ` · ${akun.sebab}`;

  // Catatan tentang penetapnya dibaca petugas DI SINI, pada baris yang
  // menyebut namanya - bukan di tempat lain. Di sinilah tertulis SK Plh yang
  // tercatat tetapi tidak dipakai, dan keadaan pejabatnya berhalangan tanpa
  // Plh sama sekali. Sebelum ini keduanya hanya ada di dalam rencana, terkirim
  // sampai ke peramban lalu tidak pernah digambar - sama saja dengan diam.
  const catatan = Array.isArray(langkah.catatanPenetap) ? langkah.catatanPenetap : [];
  for (const c of catatan) {
    if (c) teks += ` · ${c}`;
  }
  return teks;
}

function barisPenetapan(judul, isiTeks, sebab, peringatan, penetap) {
  const baris = buatElemen("div", "aleta-tetap");
  baris.appendChild(buatElemen("span", "aleta-tetap-label", judul));

  const nilai = buatElemen("span", "aleta-tetap-nilai");
  nilai.appendChild(
    buatElemen("span", isiTeks ? "aleta-tetap-isi" : "aleta-tetap-kosong", isiTeks || "belum dapat diusulkan")
  );
  if (sebab) nilai.appendChild(buatElemen("span", "aleta-tetap-sebab", sebab));
  // Siapa yang menetapkan dibedakan dari sebab usulannya: yang satu menjawab
  // "mengapa nama ini", yang lain "akun siapa yang harus mengerjakannya".
  if (penetap) nilai.appendChild(buatElemen("span", "aleta-tetap-penetap", penetap));
  if (peringatan) nilai.appendChild(buatElemen("span", "aleta-tetap-awas", peringatan));

  baris.appendChild(nilai);
  return baris;
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

async function muatUlangUsulan(isi, data, hakimId) {
  const nomor =
    (data && data.nomorPerkara) ||
    (data && data.usulan && data.usulan.perkara && data.usulan.perkara.nomorPerkara);
  if (!nomor) return;

  isi.textContent = "";
  isi.appendChild(buatElemen("div", "aleta-memuat", "Menghitung ulang untuk majelis itu…"));
  try {
    const baru = await ambilUsulanPenunjukan(nomor, hakimId);
    data.usulan = baru.usulan;
    data.rencana = baru.rencana;
    if (baru.pengaturan) data.pengaturan = baru.pengaturan;
    data.majelisDipilih = Array.isArray(hakimId) && hakimId.length > 0 ? hakimId : null;
    // ======================================================================
    // TANGGAL SIDANG MILIK MAJELIS LAMA DILEPAS
    // ======================================================================
    //
    // Hari sidang tiap majelis berbeda - A Rabu, B Selasa. Tanggal yang
    // dipilih dari daftar hari sidang majelis B tidak ada di daftar majelis
    // A, dan tanpa baris ini ia jatuh ke jalur "tanggal bebas": tetap
    // terpakai, dengan peringatan "di luar hari sidang majelis". Peringatan
    // itu benar, tetapi tanggalnya bukan pilihan orang - ia sisa.
    //
    // Yang DIPERTAHANKAN: tanggal bebas yang sengaja dibuka lewat saklarnya.
    // Itu keputusan yang diketik, bukan sisa dari majelis lain.
    if (data.pilihanManual && !data.pilihanManual.phsBebas) {
      data.pilihanManual.phs = "";
    }
    // Pejabat penetap disusun ulang server untuk majelis baru - pilihan lama
    // menunjuk ketua majelis yang sudah tidak berlaku.
    data.pejabatDipilih = {};
    usulanTerakhir = data;
  } catch (galat) {
    isi.textContent = "";
    isi.appendChild(buatElemen("div", "aleta-gagal", String(galat.message || galat).slice(0, 200)));
    return;
  }
  isi.textContent = "";
  gambarPenunjukan(isi, data);
}

function gambarPenunjukan(isi, data) {
  const usulan = data.usulan;
  if (!usulan || usulan.ok === false) {
    isi.appendChild(
      buatElemen(
        "div",
        "aleta-kosong",
        (usulan && usulan.alasan === "perkara_tidak_ketemu")
          ? "Perkara ini tidak ketemu di SIPP."
          : "Usulan penunjukan belum dapat disusun."
      )
    );
    return;
  }

  // ==========================================================================
  // CARA: OTOMATIS ATAU MANUAL
  // ==========================================================================
  //
  // Otomatis memakai usulan apa adanya. Manual membuka daftar calon untuk tiap
  // penetapan, dan yang dipilih menimpa usulannya - hanya untuk penetapan yang
  // benar-benar diubah. Yang tidak disentuh tetap memakai usulan; manual bukan
  // berarti seluruhnya harus diisi ulang tangan.
  //
  // Pilihannya disimpan pada objek `pilihanManual` yang hidup selama papan ini
  // tergambar, dan dibaca kembali oleh tombol Kerjakan. Ia sengaja TIDAK
  // disimpan ke penyimpanan: penunjukan menyangkut satu perkara pada satu saat,
  // dan pilihan yang tertinggal dari perkara sebelumnya adalah cara paling
  // halus menetapkan orang yang salah.
  const pilihanManual = data.pilihanManual || {};
  data.pilihanManual = pilihanManual;

  const caraAktif = data.caraPapan || (data.bolehOtomatis ? "otomatis" : "manual");
  data.caraPapan = caraAktif;

  isi.appendChild(
    saklarPapan(
      "Cara",
      [
        { nilai: "manual", label: "Manual" },
        { nilai: "otomatis", label: "Otomatis" },
      ],
      caraAktif,
      (nilai) => {
        data.caraPapan = nilai;
        // Berpindah ke otomatis MEMBUANG pilihan manual. Menyimpannya diam-diam
        // berarti menekan "Otomatis" lalu tetap mendapat orang yang dipilih
        // tangan - saklar yang berbohong tentang apa yang akan terjadi.
        if (nilai === "otomatis") data.pilihanManual = {};
        // Majelis yang dipilih di mode lama ikut dilepas, dan usulannya
        // dihitung ulang dari giliran. Menyimpannya diam-diam berarti saklar
        // yang berbohong tentang apa yang akan terjadi.
        if (data.majelisDipilih) {
          void muatUlangUsulan(isi, data, null);
          return;
        }
        isi.textContent = "";
        gambarPenunjukan(isi, data);
      }
    )
  );

  const aturan = (data.pengaturan && data.pengaturan.aturan) || {};

  // ==========================================================================
  // USULAN PMH TIDAK DIGAMBAR DI MODE MANUAL
  // ==========================================================================
  //
  // Ketiga hal ini menerangkan USULAN mesin: saklar kolam hakim tunggal, baris
  // "Penetapan Majelis Hakim" beserta sebabnya, dan hitungan beban tiap hakim
  // yang menjadi dasar usulan itu.
  //
  // Di mode manual tidak ada usulan yang sedang berlaku - majelisnya dipilih
  // sendiri pada dropdown tepat di bawah. Yang terbaca petugas karena itu dua
  // susunan berdampingan: satu yang dipilihnya dan satu lagi yang tidak akan
  // dipakai, tanpa penanda mana yang mana.
  //
  // Saklar "Hakim tunggal" lebih menyesatkan lagi: ia menampilkan PENGATURAN,
  // bukan pilihan - menekannya tidak mengubah apa pun. Di sebelah saklar
  // "Manual/Otomatis" yang memang bekerja, ia terbaca seolah ikut bekerja.
  const manual = caraAktif === "manual";
  const pmh = usulan.pmh || {};

  // Saklar "Hakim tunggal" hanya di mode otomatis: ia menampilkan PENGATURAN,
  // bukan pilihan - menekannya tidak mengubah apa pun, dan di sebelah saklar
  // Manual/Otomatis yang bekerja ia terbaca seolah ikut bekerja.
  if (!manual) {
    isi.appendChild(
      saklarPapan(
        "Hakim tunggal",
        [
          { nilai: "hakim", label: "Hakim" },
          { nilai: "ketua-wakil", label: "Ketua/Wakil" },
        ],
        aturan.kolamHakimTunggal === "ketua-wakil" ? "ketua-wakil" : "hakim"
      )
    );
  }

  // ==========================================================================
  // KEPALA "PENETAPAN MAJELIS HAKIM" ADA DI KEDUA MODE
  // ==========================================================================
  //
  // Kepala ini pernah disembunyikan di mode manual, dan waktu itu alasannya
  // benar: ia menampilkan usulan mesin yang BERBEDA dari majelis yang dipilih
  // di dropdown - dua susunan berdampingan tanpa penanda mana yang mana.
  //
  // Sejak mengganti majelis memuat ulang usulannya, yang tertulis di sini
  // adalah majelis yang dipilih itu sendiri, beserta panitera dan penanda
  // tangan yang mengikutinya - bukan lagi usulan tandingan. Dan tanpa kepala
  // ini, dropdown Majelis berdiri sendiri tanpa penjelasan sementara tiap
  // dropdown lain punya kepalanya; pembaca lalu mengira tiap dropdown milik
  // kepala di BAWAHNYA, dan seluruh susunan terbaca bergeser satu.
  const namaMajelis = (pmh.anggota || []).map((x) => x.nama).join(", ");
  isi.appendChild(
    barisPenetapan(
      "Penetapan Majelis Hakim",
      (pmh.majelisKode ? `${pmh.majelisKode} — ` : "") + namaMajelis,
      pmh.sebab,
      pmh.perluNilai ? "Nilai sengketa belum diisi di SIPP - isi dulu di Data Umum." : "",
      penetapUntuk(data, "pmh")
    )
  );

  if (!manual) {
    // Hitungan hakim tunggal ditampilkan terbuka: angka inilah yang membuat
    // "paling sedikit" dapat diperiksa, bukan sekadar dipercaya. Di mode
    // manual angkanya sudah ada pada tiap baris dropdown.
    if ((pmh.hitungan || []).length > 1) {
      isi.appendChild(
        buatElemen(
          "div",
          "aleta-tetap-hitung",
          pmh.hitungan.map((x) => `${x.nama} ${Math.round(Number(x.jumlah) || 0)}`).join("  ·  ")
        )
      );
      isi.appendChild(keteranganBeban());
    }
  }

  // ========================================================================
  // PILIHAN HAKIM: PER MAJELIS ATAU PER ORANG
  // ========================================================================
  //
  // Dua cara memilih hakim, dan keduanya memang diperlukan:
  //
  //   per majelis  - satu tekanan mengganti ketiganya sekaligus, memakai
  //                  susunan yang memang dipakai sehari-hari;
  //   per orang    - satu kursi diganti sementara dua lainnya tetap, misalnya
  //                  ketika seorang anggota berhalangan.
  //
  // Susunan yang ditawarkan BUKAN dari SK. Tabel ref_majelis_tetap di
  // pengadilan ini berisi 106 baris dan tidak satu pun aktif, jadi menawarkan
  // susunan menurut SK berarti menawarkan daftar kosong. Yang ditawarkan
  // susunan yang benar-benar dipakai tahun ini - dan itu memang yang diminta:
  // tidak terikat SK.
  const bolehPilihHakim = data.caraPapan === "manual" && (pmh.hitungan || []).length > 1;
  const adaSusunan = ((pmh.susunanTerpakai || []).length) > 0;

  if (bolehPilihHakim && adaSusunan) {
    isi.appendChild(
      saklarPapan(
        "Pilih",
        [
          { nilai: "majelis", label: "Per majelis" },
          { nilai: "orang", label: "Per orang" },
        ],
        pilihanManual.caraHakim || "majelis",
        (nilai) => {
          pilihanManual.caraHakim = nilai;
          // Berpindah cara MEMBUANG pilihan cara sebelumnya. Menyimpannya
          // diam-diam membuat susunan yang tidak terlihat lagi tetap mengisi
          // formulir - persis cacat yang sama sudah dihindari pada saklar
          // Otomatis/Manual.
          if (nilai === "majelis") pilihanManual.pmhKursi = [];
          else pilihanManual.majelis = "";
          isi.textContent = "";
          gambarPenunjukan(isi, data);
        }
      )
    );
  }

  const caraHakim = adaSusunan ? pilihanManual.caraHakim || "majelis" : "orang";

  // ==========================================================================
  // DROPDOWN MAJELIS ADA DI MODE OTOMATIS JUGA
  // ==========================================================================
  //
  // Di mode otomatis yang berubah hanya SATU keputusan - majelisnya - dan
  // seluruh turunannya tetap dihitung mesin. Memaksa petugas pindah ke manual
  // untuk itu berarti memaksanya memilih ulang panitera, juru sita, dan hari
  // sidang yang sebenarnya tidak hendak diubahnya.
  //
  // Pilihan per orang tetap milik mode manual: menyusun majelis dari tiga
  // kursi terpisah adalah pekerjaan manual, bukan sekadar mengganti pilihan.
  const bolehPilihMajelis = adaSusunan && caraHakim === "majelis" && (pmh.hitungan || []).length > 1;
  if (bolehPilihMajelis) {
    isi.appendChild(
      pilihanOrang(
        "Majelis",
        pmh.susunanTerpakai.map((x) => ({
          id: x.kunci,
          // Nama lengkap ketiganya, bukan kodenya: kode majelis di SIPP tidak
          // tetap - A, B, C1 berpindah orang - dan yang memilih perlu melihat
          // siapa, bukan huruf apa.
          // ==============================================================
          // KODE MAJELIS HANYA UNTUK YANG DITETAPKAN SK
          // ==============================================================
          //
          // Susunan di luar SK tetap dapat dipilih - majelis memang disusun
          // ulang ketika ada yang cuti - tetapi TANPA kode di sebelahnya.
          // Kode majelis milik SK; menempelkannya pada susunan yang tidak
          // ditetapkan siapa pun berarti menulis kode karangan ke berkas
          // perkara, dan laporan yang mengelompokkan menurut majelis akan
          // menghitungnya sebagai majelis itu.
          //
          // Urutannya sudah disusun bot: yang ber-SK di atas.
          label:
            (x.majelisKode ? `${x.majelisKode} — ` : "") +
            `${x.anggota.map((a) => a.nama).join(" · ")} — ${sebutBeban(x.perkara)}` +
            (x.majelisKode ? "" : " · di luar SK"),
        })),
        pilihanManual.majelis ?? (data.majelisDipilih ? kunciSusunan(data.majelisDipilih) : ""),
        (nilai) => {
          pilihanManual.majelis = nilai;
          const terpilih = (pmh.susunanTerpakai || []).find((x) => String(x.kunci) === String(nilai));
          // Id hakimnya dikirim ke server; yang kembali adalah usulan utuh untuk
          // majelis itu - panitera sidang, hari sidang, penanda tangan PHS.
          void muatUlangUsulan(isi, data, terpilih ? terpilih.hakimId : null);
        }
      )
    );
  }

  if (bolehPilihHakim && caraHakim === "orang") {
    // Tiga kursi, tiga dropdown. Yang sudah dipakai kursi lain digugurkan dari
    // pilihan kursi berikutnya - satu orang tidak dapat menjadi ketua sekaligus
    // anggota, dan SIPP akan menolaknya belakangan dengan galat yang tidak
    // menyebut sebabnya.
    const kursi = pilihanManual.pmhKursi || [];
    const jumlahKursi = Math.max((pmh.anggota || []).length, 1);

    for (let urutan = 0; urutan < jumlahKursi; urutan += 1) {
      const dipakaiLain = kursi
        .filter((_, i) => i !== urutan)
        .map((x) => String(x))
        .filter(Boolean);

      isi.appendChild(
        pilihanOrang(
          urutan === 0 ? "Ketua" : `Anggota ${urutan}`,
          pmh.hitungan
            .filter((x) => !dipakaiLain.includes(String(x.hakimId ?? x.id ?? x.nama)))
            .map((x) => ({
              id: x.hakimId ?? x.id ?? x.nama,
              label: `${x.nama} — ${sebutBeban(x.jumlah)}`,
            })),
          kursi[urutan] ?? "",
          (nilai) => {
            const baru = [...(pilihanManual.pmhKursi || [])];
            baru[urutan] = nilai;
            pilihanManual.pmhKursi = baru;
            // Menggambar ulang, sama seperti PPP dan PJS: tombol Kerjakan
            // disiapkan sekali saat papan digambar, jadi pilihan yang tidak
            // menggambar ulang akan tampil berubah tetapi mengisi nilai lama.
            isi.textContent = "";
            gambarPenunjukan(isi, data);
          }
        )
      );
    }
  }

  // --- PPP ---------------------------------------------------------------
  const ppp = usulan.ppp || {};
  const pppTerpilih = pilihanDari(ppp.calon, pilihanManual.ppp) || ppp.usulan;
  isi.appendChild(
    barisPenetapan(
      "Penunjukan Panitera Pengganti",
      pppTerpilih ? `${pppTerpilih.kode || ""} — ${pppTerpilih.nama}`.replace(/^ — /, "") : "",
      ppp.sebab,
      "",
      penetapUntuk(data, "ppp")
    )
  );
  if (data.caraPapan === "manual" && (ppp.calon || []).length > 1) {
    isi.appendChild(
      pilihanOrang(
        "Panitera pengganti",
        ppp.calon.map((x) => ({
          id: x.id ?? x.paniteraId ?? x.nama,
          // Kode panitera sidang menurut SK di depan namanya - dan hanya
          // bagi yang memang disebut SK untuk majelis ini. Yang lain tetap
          // dapat dipilih, di bawahnya, tanpa kode.
          label:
            (x.kodeSk ? `${x.kodeSk} — ` : "") +
            `${x.nama}${x.jumlah !== undefined ? ` — ${sebutBeban(x.jumlah)}` : ""}` +
            (x.dariSk ? " · panitera sidang majelis ini" : ""),
        })),
        pilihanManual.ppp ?? (ppp.usulan ? ppp.usulan.id ?? ppp.usulan.nama : ""),
        (nilai) => {
          pilihanManual.ppp = nilai;
          isi.textContent = "";
          gambarPenunjukan(isi, data);
        }
      )
    );
  }

  // --- PJS ---------------------------------------------------------------
  const pjs = usulan.pjs || {};
  const pjsTerpilih = pilihanDari(pjs.calon, pilihanManual.pjs) || pjs.usulan;
  isi.appendChild(
    barisPenetapan(
      "Penunjukan Juru Sita",
      pjsTerpilih ? pjsTerpilih.nama : "",
      pjs.sebab,
      pjs.peringatan,
      penetapUntuk(data, "pjs")
    )
  );
  if (data.caraPapan === "manual" && (pjs.calon || []).length > 1) {
    isi.appendChild(
      pilihanOrang(
        "Juru sita",
        pjs.calon.map((x) => ({
          id: x.id ?? x.jurusitaId ?? x.nama,
          label: `${x.nama}${x.jumlah !== undefined ? ` — ${sebutBeban(x.jumlah)}` : ""}`,
        })),
        pilihanManual.pjs ?? (pjs.usulan ? pjs.usulan.id ?? pjs.usulan.nama : ""),
        (nilai) => {
          pilihanManual.pjs = nilai;
          isi.textContent = "";
          gambarPenunjukan(isi, data);
        }
      )
    );
  }

  // --- PHS ---------------------------------------------------------------
  const phs = usulan.phs || {};
  const phsDipilih = (phs.calon || []).find((x) => x.tanggal === pilihanManual.phs);
  // Tanggal yang dipilih sendiri dari kalender TIDAK ada di daftar calon.
  // Tanpa cabang ini, barisnya tetap menampilkan tanggal usulan sementara yang
  // akan ditulis tanggal pilihan - selisih yang tidak terlihat sampai
  // penetapannya sudah tersimpan.
  const phsTerbaca = phsDipilih
    ? phsDipilih.sebut
    : pilihanManual.phs
      ? pilihanManual.phs
      : phs.sebut;
  const bebanTerpilih =
    phsDipilih && phsDipilih.jumlahSidang !== null && phsDipilih.jumlahSidang !== undefined
      ? ` · ${phsDipilih.jumlahSidang} sidang pada hari itu`
      : "";
  isi.appendChild(
    barisPenetapan(
      "Penetapan Hari Sidang",
      phsTerbaca,
      phs.sebab + (phs.jarakHari ? ` · ${phs.jarakHari} hari sejak daftar` : "") + bebanTerpilih,
      "",
      penetapUntuk(data, "phs")
    )
  );

  // PHS-lah yang paling sering perlu digeser - majelisnya berhalangan, atau
  // hari itu sudah terlalu penuh - dan sampai sekarang ia satu-satunya
  // penetapan yang tidak dapat dipilih sama sekali.
  //
  // Yang ditawarkan hanya HARI SIDANG MAJELIS ITU, pekan ini dan tiga pekan
  // sesudahnya. Hari sembarang akan menghasilkan penetapan hari sidang pada
  // hari majelis itu tidak bersidang.
  // ==========================================================================
  // SIDANG KELILING TIDAK DAPAT DITETAPKAN DI MODE OTOMATIS - SAMPAI SEKARANG
  // ==========================================================================
  //
  // Pilihan hari sidang dan ruang sidang selama ini hanya digambar di mode
  // MANUAL. Akibatnya penetapan sidang keliling menuntut petugas berpindah ke
  // manual dan memilih ulang majelis, panitera pengganti, dan juru sita -
  // padahal yang hendak diubahnya hanya TEMPATNYA.
  //
  // Yang paling merugikan bukan kerepotannya melainkan yang terjadi kalau ia
  // tidak berpindah: penetapannya tetap berhasil, dengan ruangan dalam gedung
  // dan sidang_keliling nol. Tidak ada yang berbunyi, dan laporan sidang
  // keliling menghitung nol.
  //
  // Karena itu saklarnya ada di kedua mode. Di mode otomatis ia membuka HANYA
  // hari sidang dan ruangannya; siapa yang bersidang tetap ditentukan mesin.
  if (!manual && (phs.calon || []).length > 0) {
    const saklarKeliling = buatElemen("label", "aleta-pilih-bebas");
    const kotakKeliling = document.createElement("input");
    kotakKeliling.type = "checkbox";
    kotakKeliling.checked = Boolean(pilihanManual.sidkel);
    saklarKeliling.appendChild(kotakKeliling);
    saklarKeliling.appendChild(
      buatElemen("span", "aleta-pilih-bebas-nama", "Sidang keliling - pilih hari dan tempatnya")
    );
    kotakKeliling.addEventListener("change", () => {
      pilihanManual.sidkel = kotakKeliling.checked;
      // Mematikannya MELEPAS kembali hari dan ruangannya. Menyimpannya
      // diam-diam berarti saklar yang mati tetapi penetapannya tetap tertulis
      // di luar gedung - saklar yang berbohong tentang apa yang akan terjadi.
      if (!kotakKeliling.checked) {
        pilihanManual.phs = "";
        pilihanManual.ruangan = "";
        pilihanManual.phsBebas = false;
      }
      isi.textContent = "";
      gambarPenunjukan(isi, data);
    });
    isi.appendChild(saklarKeliling);
  }

  const bukaTempat = manual || Boolean(pilihanManual.sidkel);
  if (bukaTempat && (phs.calon || []).length > 1) {
    // ======================================================================
    // BERAPA SIDANG YANG SUDAH ADA PADA TANGGAL ITU
    // ======================================================================
    //
    // Menetapkan hari sidang tanpa mengetahui hari itu sudah seberapa penuh
    // adalah cara paling mudah menumpuk dua puluh perkara pada satu hari
    // sementara hari berikutnya kosong. Kalender SIPP menunjukkan jadwal satu
    // PERKARA, bukan beban satu HARI.
    //
    // Yang tidak terbaca ditulis apa adanya sebagai "beban belum terbaca",
    // bukan sebagai nol. Tanggal yang tampak lengang padahal penuh akan
    // menumpuk sidang justru pada hari yang paling sibuk.
    const sebutBeban = (x) => {
      if (x.jumlahSidang === null || x.jumlahSidang === undefined) return "beban belum terbaca";
      if (x.jumlahSidang === 0) return "belum ada sidang";
      return `${x.jumlahSidang} sidang`;
    };

    // ======================================================================
    // TANGGAL DARI KALENDER IKUT BERDIRI DI DAFTAR INI
    // ======================================================================
    //
    // Daftar ini disusun dari phs.calon - keempat hari sidang majelisnya.
    // Tanggal yang dipilih sendiri dari kalender di bawah TIDAK ada di
    // antaranya, sehingga daftarnya jatuh kembali ke baris pertama sementara
    // yang sungguh akan ditulis adalah tanggal kalender.
    //
    // Yang terbaca dari situ: "sudah saya pilih tanggalnya, tetapi hari
    // sidangnya tidak ikut berubah" - dan dugaan berikutnya, yang wajar,
    // adalah bahwa pilihan kalendernya tidak terpakai.
    //
    // Sekarang tanggal kalender disisipkan sebagai baris tambahan, PALING
    // ATAS dan bertanda asalnya. Ia tidak menggantikan satu pun calon:
    // memilih kembali salah satu calon tetap dapat dilakukan dengan satu
    // gerakan yang sama.
    const calonTampil = phs.calon.map((x) => ({
      id: x.tanggal,
      label:
        `${x.sebut} — ${x.usulan ? "usulan" : `mundur ${x.pekan} pekan`}` +
        ` · ${sebutBeban(x)}`,
    }));
    const dariKalender = String(pilihanManual.phs || "");
    if (dariKalender && !calonTampil.some((c) => c.id === dariKalender)) {
      calonTampil.unshift({
        id: dariKalender,
        label: `${sebutTanggal(dariKalender)} — dipilih dari kalender`,
      });
    }

    isi.appendChild(
      pilihanOrang(
        "Hari sidang",
        calonTampil,
        pilihanManual.phs ?? "",
        (nilai) => {
          pilihanManual.phs = nilai;
          // Memilih kembali salah satu hari sidang majelis berarti tidak lagi
          // memakai tanggal kalender - saklarnya ikut ditutup supaya kotak
          // kalender tidak tertinggal terbuka dengan tanggal yang sudah tidak
          // dipakai, yang kemudian terbaca sebagai dua pilihan yang berselisih.
          if ((phs.calon || []).some((x) => x.tanggal === nilai)) {
            pilihanManual.phsBebas = false;
          }
          isi.textContent = "";
          gambarPenunjukan(isi, data);
        }
      )
    );

    // ======================================================================
    // RUANG SIDANG - DAN INILAH TEMPAT SIDANG KELILING DIPILIH
    // ======================================================================
    //
    // Sebelum ini ruangannya dipatok pada mesin tulis: "Ruang Sidang 1 Dalam
    // Gedung", selalu. Penetapan hari sidang untuk sidang keliling karena itu
    // menulis ruangan yang keliru DAN kolom sidang_keliling nol - sedangkan
    // penetapannya berhasil, berkasnya tercetak, dan sidangnya digelar.
    //
    // Gagal yang paling mahal adalah yang tidak berbunyi: yang menyadarinya
    // baru penyusun laporan tahunan, ketika sidang keliling terhitung nol.
    //
    // Diukur di PA Donggala, sidang 2025-2026: 459 sidang digelar di luar
    // gedung - 180 sidang keliling dan 279 pelayanan terpadu.
    //
    // TERPADU DIPISAH DARI KELILING, sebab SIPP sendiri memisahkannya
    // (ruangan_sidang.sidang_keliling = 0 pada keempat ruangan Terpadu).
    // Menyatukannya membuat laporan sidang keliling melebih-lebihkan diri.
    if (ruanganTersimpan === null) {
      // Dibaca di latar; papannya digambar ulang begitu daftarnya tiba.
      void muatRuangan().then((daftar) => {
        if (!daftar) return;
        isi.textContent = "";
        gambarPenunjukan(isi, data);
      });
    } else if (ruanganTersimpan.length > 0) {
      const SEBUT = {
        "dalam-gedung": "Dalam gedung",
        keliling: "Sidang keliling",
        terpadu: "Sidang terpadu",
      };
      // ====================================================================
      // YANG SERING DIPAKAI DI ATAS, DAN SAAT SIDKEL MENYALA KELILING DULU
      // ====================================================================
      //
      // Urutan dasarnya sudah disusun portal menurut pemakaian 24 bulan
      // terakhir. Ketika petugas menyatakan ini sidang keliling, ruangan
      // keliling dan terpadu dinaikkan ke atas daftar - yang dicarinya tidak
      // boleh berada di bawah tiga belas baris ruangan dalam gedung.
      //
      // Yang di dalam gedung TIDAK dibuang: sidang keliling yang batal dan
      // dipindahkan ke kantor terjadi, dan daftar yang menyembunyikannya
      // memaksa petugas mematikan saklarnya lalu kehilangan tanggal yang
      // sudah dipilih.
      const urutTempat = Boolean(pilihanManual.sidkel)
        ? [...ruanganTersimpan].sort((a, b) => {
            const luar = (r) => (r.sifat === "keliling" ? 0 : r.sifat === "terpadu" ? 1 : 2);
            return luar(a) - luar(b);
          })
        : ruanganTersimpan;

      isi.appendChild(
        pilihanOrang(
          "Ruang sidang",
          urutTempat.map((r) => ({
            id: String(r.id),
            // Sifatnya disebut pada tiap barisnya, bukan hanya pada
            // pengelompokan: yang memilih cepat membaca satu baris, bukan
            // judul kelompok tiga baris di atasnya.
            //
            // Seberapa sering dipakai ikut tertulis. "Belum pernah dipakai"
            // adalah keterangan yang paling perlu dibaca sebelum memilih -
            // ruangan yang tidak pernah dipakai biasanya memang sudah tidak
            // dipakai lagi, hanya belum dinonaktifkan di SIPP.
            label:
              `${r.nama} — ${SEBUT[r.sifat] || r.sifat}` +
              (r.dipakai === undefined
                ? ""
                : r.dipakai > 0
                  ? ` · ${r.dipakai} sidang 2 tahun terakhir`
                  : " · belum pernah dipakai"),
          })),
          pilihanManual.ruangan ?? "",
          (nilai) => {
            pilihanManual.ruangan = nilai;
            isi.textContent = "";
            gambarPenunjukan(isi, data);
          }
        )
      );

      // ====================================================================
      // TEMPATNYA SUNGGUHAN - KUA WILAYAH ITU
      // ====================================================================
      //
      // "Sidang Keliling Sigi Biromaru" adalah nama baris di SIPP, bukan
      // alamat. Yang perlu diketahui petugas yang menyiapkan panggilan adalah
      // ke mana para pihak dipanggil - dan untuk sidang keliling di sini
      // tempatnya KUA kecamatan itu.
      //
      // Dicocokkan dari ref_kua di sisi bot menurut ekor nama ruangannya.
      // Yang tidak berpasangan tidak menampilkan apa pun - menebak alamat
      // lebih buruk daripada diam.
      const tempatTerpilih = ruanganTersimpan.find(
        (r) => String(r.id) === String(pilihanManual.ruangan)
      );
      if (tempatTerpilih && tempatTerpilih.kua) {
        isi.appendChild(
          buatElemen(
            "div",
            "aleta-tetap-hitung",
            `Tempat: ${tempatTerpilih.kua}` +
              (tempatTerpilih.kuaAlamat ? ` — ${tempatTerpilih.kuaAlamat}` : "")
          )
        );
      }
    }

    // ======================================================================
    // TANGGAL BEBAS - DI BALIK SAKLAR, BUKAN BERDAMPINGAN
    // ======================================================================
    //
    // Keempat calon di atas adalah hari sidang majelis itu sendiri. Tanggal
    // sembarang menghasilkan penetapan hari sidang pada hari majelis itu TIDAK
    // bersidang - dan itu bukan kelonggaran, itu kekeliruan.
    //
    // Tetapi keadaan yang menuntutnya memang ada: sidang keliling yang harinya
    // menyesuaikan kecamatan, hari libur nasional yang menggeser seluruh
    // jadwal, atau majelis yang harinya sedang diubah dan belum tercatat.
    //
    // Karena itu ia ADA tetapi di balik saklar. Yang membukanya melakukannya
    // dengan sadar, dan peringatannya dibaca pada saat yang sama - bukan
    // sesudah penetapannya terlanjur tersimpan.
    const saklarBebas = buatElemen("label", "aleta-pilih-bebas");
    const kotakBebas = document.createElement("input");
    kotakBebas.type = "checkbox";
    kotakBebas.checked = Boolean(pilihanManual.phsBebas);
    saklarBebas.appendChild(kotakBebas);
    saklarBebas.appendChild(
      buatElemen("span", "aleta-pilih-bebas-nama", "Pilih tanggal sendiri dari kalender")
    );
    isi.appendChild(saklarBebas);

    if (pilihanManual.phsBebas) {
      const barisBebas = buatElemen("div", "aleta-pilih");
      barisBebas.appendChild(buatElemen("span", "aleta-pilih-nama", "Tanggal"));

      const kalender = document.createElement("input");
      kalender.type = "date";
      kalender.className = "aleta-pilih-kotak";
      kalender.value = pilihanManual.phs || phs.usulan || "";
      // ====================================================================
      // BATAS BAWAHNYA HARI INI, BUKAN TANGGAL USULAN
      // ====================================================================
      //
      // Sebelum ini batasnya tanggal usulan, sehingga SELURUH tanggal sebelum
      // usulan - termasuk hari ini dan pekan depan - tampil kelabu dan tidak
      // dapat ditekan. Alasannya jeda minimal menurut SK, dan alasan itu
      // benar; tetapi kalender bukan tempat menegakkannya.
      //
      // Keadaan yang menuntut tanggal lebih awal memang ada dan sah: perkara
      // yang harus disidangkan cepat, sidang keliling yang jadwalnya sudah
      // diumumkan, atau penetapan yang dibuat mundur untuk hari sidang yang
      // sudah berlalu. Kalender yang mengunci semuanya memaksa petugas
      // kembali mengetik di borang SIPP - dan di sana tidak ada peringatan
      // apa pun.
      //
      // Karena itu batasnya HARI INI - tanggal yang sudah lewat memang tidak
      // dapat dijadikan hari sidang pertama - dan jeda minimalnya diberitahu
      // sebagai peringatan yang dibaca, bukan sebagai pintu yang dikunci.
      kalender.min = new Date().toISOString().slice(0, 10);
      kalender.addEventListener("change", () => {
        pilihanManual.phs = kalender.value;
        isi.textContent = "";
        gambarPenunjukan(isi, data);
      });
      barisBebas.appendChild(kalender);
      isi.appendChild(barisBebas);

      const dipilihBebas = pilihanManual.phs;

      // Jeda minimalnya tidak lagi dikunci kalender, jadi ia harus BERBUNYI.
      // Yang memilih tanggal lebih awal dari usulan sedang memperpendek jeda
      // panggilan, dan itu keputusan yang boleh diambil - asal disadari.
      if (dipilihBebas && phs.usulan && dipilihBebas < phs.usulan) {
        isi.appendChild(
          buatElemen(
            "div",
            "aleta-tetap-awas",
            `Lebih awal dari usulan ${phs.usulan}. Usulan itu hari sidang terdekat yang masih memenuhi jeda panggilan menurut SK - memajukannya memperpendek jeda tersebut.`
          )
        );
      }

      const adaDiCalon = (phs.calon || []).some((x) => x.tanggal === dipilihBebas);
      if (dipilihBebas && !adaDiCalon) {
        isi.appendChild(
          buatElemen(
            "div",
            "aleta-tetap-awas",
            "Tanggal ini di luar hari sidang majelis tersebut. Pastikan majelisnya memang bersidang hari itu."
          )
        );
      }
    }

    kotakBebas.addEventListener("change", () => {
      pilihanManual.phsBebas = kotakBebas.checked;
      // Menutup saklarnya mengembalikan pilihan ke calon - kalau tidak,
      // tanggal bebas yang sudah terpilih tetap terpakai diam-diam sementara
      // kalendernya sudah tidak terlihat lagi.
      if (!kotakBebas.checked && !(phs.calon || []).some((x) => x.tanggal === pilihanManual.phs)) {
        pilihanManual.phs = "";
      }
      isi.textContent = "";
      gambarPenunjukan(isi, data);
    });
  }

  // --- keempatnya setanggal ----------------------------------------------
  if (usulan.tanggalPenetapan) {
    isi.appendChild(
      buatElemen(
        "div",
        "aleta-tetap-hitung",
        `Tanggal penetapan keempatnya: ${usulan.tanggalPenetapan}`
      )
    );
  }

  // ========================================================================
  // ATAS NAMA SIAPA INI AKAN TERCATAT - DIBACA SEBELUM TOMBOLNYA DITEKAN
  // ========================================================================
  //
  // Siapa penetapnya memang sudah tertulis pada tiap baris di atas, tetapi
  // tersebar - satu keterangan kecil di ujung baris PMH, satu lagi di baris
  // PPP, dan seterusnya. Yang menekan tombol tidak sedang membaca empat baris
  // itu; ia sedang melihat tombolnya.
  //
  // Karena penetapan ini akan tercatat di SIPP atas nama PEJABAT - bukan atas
  // nama operator yang menekannya - namanya harus terbaca tepat di sebelah
  // tombolnya, sebagai kalimat terakhir sebelum ditekan. Satu nama yang salah
  // di sini berarti satu berkas perkara yang tercatat atas nama orang yang
  // tidak mengerjakannya, dan itu tidak dapat dibetulkan dengan menekan ulang.
  // ==========================================================================
  // KOTAK RINGKASAN INI DICABUT - IA MENGULANG, DAN ULANGANNYA DAPAT BERBEDA
  // ==========================================================================
  //
  // Dahulu di sini berdiri kotak merah "Akan tercatat di SIPP atas nama",
  // mendaftar keempat penetap sekali lagi. Maksudnya baik: nama penetapnya
  // terbaca tepat di sebelah tombol, bukan tersebar di empat baris di atas.
  //
  // Dua hal membuatnya lebih merugikan daripada menolong.
  //
  // Pertama, ia membaca `langkah.akun` - pilihan BAWAAN mesin - sementara
  // "Pejabat yang menetapkan" tepat di bawahnya membiarkan pilihan itu
  // diganti. Petugas yang mengganti PMH ke Wakil Ketua tetap membaca nama
  // Ketua pada kotak merah. Ringkasan yang berbeda dari yang akan ditulis
  // lebih buruk daripada tidak ada ringkasan sama sekali.
  //
  // Kedua, keterangan penetap sudah ada pada tiap barisnya - dan sejak
  // sekarang keterangan itu IKUT BERUBAH ketika pejabatnya diganti. Kotak ini
  // tinggal salinan ketiga dari keterangan yang sama.

  // ========================================================================
  // PEJABAT PENETAPNYA DAPAT DIPINDAH - BAWAANNYA YANG DIPILIH MESIN
  // ========================================================================
  //
  // Aturannya benar hampir selalu: Ketua bila hadir, Wakil bila Ketua
  // berhalangan, Plh bila keduanya tidak ada. "Hampir" itulah sebabnya
  // pilihan ini ada - cuti yang belum tercatat, rapat mendadak, atau
  // penandatanganan yang memang diserahkan kepada Wakil atas kesepakatan
  // pimpinan. Mesin tidak tahu satu pun dari itu.
  //
  // Yang ditawarkan hanya CALON YANG SAH untuk langkah itu. Membuka seluruh
  // akun akan membuat penetapan dapat tercatat atas nama siapa saja, dan itu
  // bukan kemudahan melainkan lubang.
  //
  // Ketua majelis sengaja tidak punya pilihan: PHS ditandatangani ketua
  // majelis perkara itu sendiri, dan majelisnya sudah ditetapkan pada langkah
  // sebelumnya - jadi tidak ada yang perlu dipilih.
  const langkahBercalon = ((data && data.rencana && data.rencana.langkah) || []).filter(
    (x) => Array.isArray(x.calon) && x.calon.length > 1
  );

  if (langkahBercalon.length > 0) {
    if (!data.pejabatDipilih) data.pejabatDipilih = {};

    const kotakPejabat = buatElemen("div", "aleta-tetap-pejabat");
    kotakPejabat.appendChild(
      buatElemen("div", "aleta-tetap-atasnama-judul", "Pejabat yang menetapkan")
    );

    for (const langkah of langkahBercalon) {
      const baris = buatElemen("div", "aleta-tetap-pejabat-baris");
      baris.appendChild(buatElemen("span", "aleta-tetap-pejabat-jenis", langkah.jenis.toUpperCase()));

      const pilih = buatElemen("select", "aleta-pilih");
      for (const calon of langkah.calon) {
        const opsi = document.createElement("option");
        opsi.value = calon.username;
        // Sebutan jabatannya ikut, sebab nama saja tidak menyatakan kewenangan -
        // dan yang memilih sedang memutuskan siapa yang menandatangani.
        opsi.textContent =
          `${calon.namaLengkap}${calon.sebutan ? ` — ${calon.sebutan}` : ""}` +
          (calon.otomatis ? " (pilihan ALETA)" : "") +
          (calon.siap === false ? " — akunnya belum siap" : "");
        if (calon.otomatis) opsi.selected = true;
        pilih.appendChild(opsi);
      }

      // Bawaannya disimpan sejak awal, bukan hanya ketika diubah. Kalau tidak,
      // yang tidak menyentuh pilihan ini akan mengirim nama kosong - dan yang
      // kosong ditolak rutenya dengan sebab yang tidak menunjuk ke sini.
      const otomatis = langkah.calon.find((x) => x.otomatis);
      if (otomatis) data.pejabatDipilih[langkah.jenis] = otomatis.username;

      pilih.addEventListener("change", () => {
        data.pejabatDipilih[langkah.jenis] = pilih.value;
        // ==================================================================
        // PAPANNYA DIGAMBAR ULANG - KETERANGANNYA IKUT BERUBAH
        // ==================================================================
        //
        // Sebelum ini pilihan tersimpan diam-diam dan tidak satu pun yang
        // terlihat berubah. Baris "Ditetapkan Ketua Pengadilan - Fahri
        // Saifuddin" tetap berbunyi begitu meskipun yang dipilih Wakil Ketua,
        // dan satu-satunya cara mengetahui pilihan itu tersimpan adalah
        // mempercayainya.
        //
        // Nama yang salah di sini berarti berkas perkara tercatat atas nama
        // orang yang tidak mengerjakannya, dan itu tidak dapat dibetulkan
        // dengan menekan ulang. Layar yang tidak berubah pada keputusan
        // seberat itu bukan kehalusan yang hilang - ia kehilangan satu-satunya
        // kesempatan petugas menyadari salah pilih.
        isi.textContent = "";
        gambarPenunjukan(isi, data);
      });

      baris.appendChild(pilih);
      kotakPejabat.appendChild(baris);
    }

    isi.appendChild(kotakPejabat);
  }

  // --- tombol Kerjakan ----------------------------------------------------
  // ==========================================================================
  // TOMBOL KERJAKAN PUNYA KEWENANGANNYA SENDIRI
  // ==========================================================================
  //
  // Papan penunjukan MEMBACA dan mengusulkan; tombol ini MENULIS ke SIPP atas
  // nama yang menekannya, dan tulisannya tidak dapat dibedakan dari pengisian
  // tangan. Karena itu keduanya dipisah: banyak jabatan perlu membaca
  // usulannya, jauh lebih sedikit yang boleh menuliskannya.
  //
  // Yang tidak berwenang tetap melihat papannya lengkap - usulan majelis,
  // panitera pengganti, juru sita, hari sidang - lalu mengetiknya sendiri di
  // borang SIPP seperti sebelum ada ekstensi ini.
  if (!boleh("kerjakan")) {
    const catatan = buatElemen(
      "div",
      "aleta-kosong-lembut",
      "Usulan di atas dapat disalin ke formulir SIPP. Peran Anda tidak diberi akses menuliskannya langsung dari panel."
    );
    isi.appendChild(catatan);
    return;
  }

  const kaki = buatElemen("div", "aleta-tetap-kaki");
  const tombol = buatElemen("button", "aleta-tombol aleta-tombol-mati aleta-tombol-tetapkan", "Tetapkan");
  tombol.type = "button";
  tombol.disabled = true;
  const kabar = buatElemen("span", "aleta-tetap-sebab", "Memeriksa formulir di halaman ini…");
  kaki.appendChild(tombol);
  kaki.appendChild(kabar);
  isi.appendChild(kaki);

  // Jalan kembali, bagi penetapan yang salah atau yang berhenti separuh
  // tertulis. Ditaruh di bawah tombol menetapkan, bukan di sebelahnya:
  // membatalkan bukan tindakan yang pantas berdampingan sejajar dengan
  // menetapkan.
  isi.appendChild(bagianBatalkanPenetapan(usulan, data));

  void siapkanKerjakan(tombol, kabar, usulan, data);
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

/** Membandingkan nama tanpa mempersoalkan spasi berlebih dan besar-kecil huruf. */
function namaSama(a, b) {
  const rapikan = (x) => String(x || "").replace(/\s+/g, " ").trim().toLowerCase();
  const kiri = rapikan(a);
  const kanan = rapikan(b);
  return kiri !== "" && kiri === kanan;
}

async function siapkanKerjakan(tombol, kabar, usulan, data) {
  let keadaan;
  try {
    // perkaraId ikut dikirim supaya jawabannya membawa penerusan yang menunggu
    // untuk perkara ini - papan lalu dapat menampilkan "sudah diteruskan"
    // alih-alih menawarkan penerusan kedua atas hal yang sama.
    const alamat = `${ALETA_API_BORANG}?perkaraId=${encodeURIComponent(
      String((usulan.perkara && usulan.perkara.perkaraId) || "")
    )}`;
    const respons = await alatAmbil(alamat, { credentials: "include", cache: "no-store" }, "Memeriksa kewenangan");
    if (!respons.ok) throw new Error(alatPesanGagal(null, respons.status, "Memeriksa kewenangan"));
    const isi = await respons.json();
    keadaan = isi && isi.data ? isi.data : isi;
  } catch (galat) {
    kabar.textContent = String(galat.message || galat).slice(0, 160);
    return;
  }

  if (!keadaan || keadaan.bolehMengisi !== true) {
    kabar.textContent = "Peran Anda tidak diberi kewenangan mengisi formulir.";
    return;
  }

  const terbuka = await borangSedangTerbuka(keadaan.medan || []);
  if (!terbuka.formulir) {
    // ========================================================================
    // BORANG TIDAK TERBUKA BUKAN LAGI JALAN BUNTU
    // ========================================================================
    //
    // Dahulu di sini panel menyerah: "Borang penunjukan tidak terbuka di
    // halaman ini." Padahal halaman detail perkara - tempat panel ini paling
    // sering dibuka - memang tidak punya borang itu, sehingga tombol Kerjakan
    // praktis tidak pernah dapat ditekan, dan keempat penetapan tetap menuntut
    // empat kali buka halaman sambil berganti empat akun.
    //
    // Sekarang ada jalan kedua: ALETA menuliskannya sendiri. Yang ditulis dan
    // ke tabel mana persis sama dengan yang dituliskan SIPP ketika seorang
    // petugas menekan Simpan, sys_audittrail-nya ikut.
    tombol.textContent = "Tetapkan dan tuliskan ke SIPP";
    tombol.classList.remove("aleta-tombol-mati");
    tombol.disabled = false;
    kabar.textContent =
      "Formulir SIPP tidak terbuka di halaman ini. ALETA dapat menuliskan keempatnya langsung - " +
      "tekan sekali untuk melihat rencananya lebih dulu.";

    let rencanaSudahDibaca = false;
    tombol.addEventListener("click", async () => {
      tombol.disabled = true;
      const semula = tombol.textContent;
      tombol.textContent = rencanaSudahDibaca ? "Menulis…" : "Menyusun…";

      const hasil = await tetapkanLewatAleta(
        tombol,
        kabar,
        usulan,
        data,
        keadaan,
        !rencanaSudahDibaca
      );

      if (!rencanaSudahDibaca && hasil.ok) {
        // Rencananya terbaca dan seluruhnya siap - barulah tekanan berikutnya
        // menulis. Rencana yang sebagian gagal TIDAK membuka jalan itu.
        rencanaSudahDibaca = true;
        tombol.textContent = "Tuliskan ke SIPP";
        tombol.disabled = false;
        return;
      }

      if (!rencanaSudahDibaca) {
        // Gagal pada uji kering: tetap dapat dicoba lagi sesudah dibetulkan.
        tombol.textContent = semula;
        tombol.disabled = false;
        return;
      }

      // Sesudah benar-benar menulis, tombolnya TIDAK dihidupkan lagi. Menekan
      // kedua kalinya akan menuliskan penetapan yang sama untuk kedua kalinya,
      // dan membongkarnya menuntut tangan.
      tombol.textContent = hasil.ok ? "Penetapan selesai" : "Berhenti - periksa sebabnya";

      // ====================================================================
      // HALAMAN DIMUAT ULANG SESUDAH PENETAPAN BENAR-BENAR TERTULIS
      // ====================================================================
      //
      // Yang berubah ada di basis data SIPP, bukan di halaman ini. Tanpa
      // memuat ulang, tab Penetapan tetap kosong dan Riwayat Perkara tetap
      // hanya menyebut pendaftaran - petugas menyimpulkan penetapannya gagal
      // padahal keempatnya sudah tersimpan, lalu menekannya sekali lagi.
      //
      // Diberi jeda supaya hasil tiap langkah sempat terbaca lebih dahulu.
      if (hasil.ok) {
        kabar.appendChild(
          buatElemen(
            "div",
            "aleta-tetap-sebab",
            "Penetapan tersimpan. Halaman dimuat ulang sebentar lagi supaya tab Penetapan dan Riwayat Perkara menampilkan hasilnya."
          )
        );
        setTimeout(muatUlangHalamanPerkara, 2500);
      }
    });
    return;
  }

  const formulir = terbuka.formulir;
  const catatanBorang = (keadaan.borang || []).find((x) => x.borang === formulir);
  if (catatanBorang && catatanBorang.siap !== true) {
    kabar.textContent = `Peta kolom formulir ${formulir.toUpperCase()} belum lengkap: ${catatanBorang.alasan}`;
    return;
  }

  // Pilihan manual ikut - kalau tidak, dropdown-nya berubah di layar tetapi
  // yang terisi ke formulir tetap usulan semula, dan itu jauh lebih berbahaya
  // daripada tidak ada pilihan manual sama sekali.
  const nilai = nilaiUntukBorang(formulir, usulan, (data && data.pilihanManual) || {});
  if (Object.keys(nilai).length === 0) {
    kabar.textContent = `Belum ada usulan yang dapat diisikan ke formulir ${formulir.toUpperCase()}.`;
    return;
  }

  // ==========================================================================
  // KEEMPAT PENETAPAN MILIK JABATAN YANG BERBEDA
  // ==========================================================================
  //
  //   PMH  Ketua Pengadilan       PPP  Panitera
  //   PJS  Panitera               PHS  ketua majelis
  //
  // Selama ini satu operator mengerjakan keempatnya dengan masuk-keluar empat
  // akun SIPP. Jejaknya lalu menyebut nama pejabatnya sementara yang menekan
  // tombolnya orang lain - dan tidak ada catatan yang menyebutkan itu.
  //
  // Yang dikerjakan panel ini: bila formulir yang terbuka BUKAN urusan jabatan
  // yang sedang masuk, tombolnya berubah dari Kerjakan menjadi Teruskan.
  // Usulannya disimpan lengkap, lalu muncul di panel pejabatnya begitu ia
  // membuka SIPP dengan akunnya sendiri - tinggal diperiksa dan ditekan.
  //
  // Empat kali masuk-keluar akun berubah jadi empat orang menekan sekali.
  const bolehJenis = keadaan.bolehJenis || {};
  const untukJabatan = keadaan.untukJabatan || {};
  const sudahDititipkan = (keadaan.antrean || []).find((x) => x.jenis === formulir);

  if (sudahDititipkan) {
    // Penerusan yang sama tidak ditawarkan dua kali. Yang berwenang tetap dapat
    // mengerjakannya - tombolnya di bawah - tetapi operator yang sudah
    // meneruskan tidak perlu meneruskan lagi.
    kabar.textContent = `Sudah diteruskan ke ${untukJabatan[formulir] || "pejabat berwenang"}, menunggu dikerjakan.`;
    if (bolehJenis[formulir] !== true) {
      tombol.textContent = "Menunggu";
      return;
    }
  }

  // ==========================================================================
  // PERTANYAAN YANG BENAR: AKUN SIPP MANA YANG SEDANG TERBUKA
  // ==========================================================================
  //
  // Sebelumnya keputusan berganti akun diambil dari KEWENANGAN PERAN ALETA -
  // "bolehkah peran ini menetapkan". Itu pertanyaan yang salah, dan akibatnya
  // dua-duanya buruk:
  //
  //   - Pada mode longgar (bawaan) jawabannya SELALU boleh, dan bagi Super
  //     Admin selalu boleh berapa pun modenya. Tombol berganti akun karena itu
  //     TIDAK PERNAH muncul sama sekali.
  //
  //   - Lebih berat: petugas yang masuk SIPP dengan akun mana pun tetap
  //     ditawari Kerjakan. Menekan Simpan sesudahnya membuat SIPP mencatat
  //     penetapan atas akun yang KEBETULAN sedang terbuka - bukan atas nama
  //     pejabat yang seharusnya.
  //
  // Yang menentukan siapa tercatat bukan izin ALETA, melainkan sesi SIPP.
  // Karena itu yang dibandingkan sekarang: nama pada kepala halaman SIPP
  // dengan nama pejabat pelaksana langkah ini menurut rencana.
  const rencana = data && data.rencana;
  const langkahRencana =
    rencana && Array.isArray(rencana.langkah)
      ? rencana.langkah.find((x) => x.jenis === formulir)
      : null;
  const akunSeharusnya = langkahRencana ? langkahRencana.akun : null;
  const namaSekarang = namaPenggunaSipp();

  // ==========================================================================
  // PHS MENUNGGU PMH, DAN ITU BUKAN KELAMBANAN
  // ==========================================================================
  //
  // PHS dikerjakan ketua majelis perkara ini, dengan akunnya sendiri. Sampai
  // PMH tersimpan, ketuanya belum ada - yang ada baru usulan, dan usulan boleh
  // berubah. Menawarkan tombolnya sekarang berarti menawarkan sesi SIPP atas
  // nama hakim yang belum tentu ketua majelisnya.
  //
  // Servernya menolak permintaan semacam itu; yang dikerjakan di sini hanya
  // mengatakannya lebih awal, supaya petugas tidak menabrak penolakan setelah
  // meninggalkan halaman perkaranya.
  if (akunSeharusnya && akunSeharusnya.tentatif) {
    tombol.textContent = "Menunggu Penetapan Majelis";
    kabar.textContent =
      "Kerjakan Penetapan Majelis Hakim lebih dulu. Ketua majelis yang menetapkan hari sidang baru pasti sesudah penetapan majelis tersimpan, dan ALETA membacanya dari majelis yang tercatat - bukan dari usulan.";
    return;
  }

  // Akun kosong berarti langkah ini memang dikerjakan operator dengan akunnya
  // sendiri - Data Umum. Tidak ada yang perlu ditukar.
  const perluGantiAkun =
    Boolean(akunSeharusnya) &&
    namaSekarang !== "" &&
    !namaSama(namaSekarang, akunSeharusnya.namaLengkap);

  if (perluGantiAkun) {
    // ========================================================================
    // AKUN YANG TERBUKA BUKAN AKUN PELAKSANA - DUA JALAN
    // ========================================================================
    //
    //   Utama   : "Masuk sebagai X" - operator berganti sesi ke akun pejabat
    //             pelaksana langkah ini lewat mesin tahap 4, lalu mengerjakannya
    //             sendiri. Inilah yang menghapus keharusan buka-tutup banyak
    //             akun: sesi lama ditutup, akun pejabat dipasang, pendaratannya
    //             dibuktikan, semuanya di /masuk-pejabat. Yang menulis penetapan
    //             tetap operator - mengisi, memeriksa, menekan Simpan.
    //
    //   Kedua   : "Teruskan" - menitipkan usulannya untuk dikerjakan pejabatnya
    //             sendiri di lain waktu, tanpa berganti akun. Dipertahankan bagi
    //             yang memang menghendaki alur titipan.
    const namaJabatan = untukJabatan[formulir] || "pejabat berwenang";
    // Nama ORANGNYA, bukan sebutan jabatannya. Yang perlu diperiksa petugas
    // sebelum menekan adalah akun siapa yang akan dipakai - "Ketua Pengadilan"
    // tidak menjawab itu, "Fahri Saifuddin" menjawabnya.
    const namaPejabat = String(akunSeharusnya.namaLengkap || namaJabatan);
    const akunSipp = String(akunSeharusnya.username || "");
    const nomorPerkara = String((usulan.perkara && usulan.perkara.nomorPerkara) || "");
    const perkaraId = String((usulan.perkara && usulan.perkara.perkaraId) || "");

    tombol.disabled = false;
    tombol.classList.remove("aleta-tombol-mati");
    tombol.textContent = `Masuk sebagai ${namaPejabat}`;
    kabar.textContent =
      `Anda sedang masuk sebagai ${namaSekarang}. ${formulir.toUpperCase()} dikerjakan ` +
      `${namaJabatan} - ${namaPejabat}${akunSipp ? ` (akun ${akunSipp})` : ""}. ` +
      "Berganti akun dulu supaya penetapannya tercatat atas nama yang benar.";

    // Akun yang belum siap disebutkan sebabnya, dan tombolnya tetap dapat
    // ditekan - penolakan sebenarnya terjadi di sisi server, dan alasannya
    // sampai ke sini apa adanya.
    if (akunSeharusnya.siap === false && akunSeharusnya.sebab) {
      kabar.textContent += ` Catatan: ${akunSeharusnya.sebab}`;
    }

    tombol.addEventListener("click", () => {
      // Berganti sesi mengubah akun SIPP untuk SELURUH peramban, jadi
      // ditegaskan sekali sebelum meninggalkan halaman perkara ini.
      const setuju = window.confirm(
        `Masuk SIPP sebagai ${namaPejabat}${akunSipp ? ` (akun ${akunSipp})` : ""}?\n\n` +
          `Sesi ${namaSekarang} akan ditutup, dan halaman ini berpindah ke SIPP.`
      );
      if (!setuju) return;
      if (!nomorPerkara) {
        kabar.textContent = "Nomor perkara tidak terbaca - tidak dapat berganti akun.";
        return;
      }
      tombol.disabled = true;
      tombol.classList.add("aleta-tombol-mati");
      kabar.textContent = `Menutup sesi dan masuk sebagai ${namaPejabat}…`;
      const alamat =
        `${ALETA_API_MASUK_PEJABAT}?jenis=${encodeURIComponent(formulir)}` +
        `&nomor=${encodeURIComponent(nomorPerkara)}` +
        `&perkaraId=${encodeURIComponent(perkaraId)}`;
      window.location.href = alamat;
    });

    // Pilihan kedua: teruskan tanpa berganti akun.
    const teruskan = buatElemen(
      "button",
      "aleta-tautan",
      `atau teruskan ke ${namaJabatan} tanpa berganti akun`
    );
    teruskan.addEventListener("click", () => {
      teruskan.disabled = true;
      void titipkanBorang({ tombol: teruskan, kabar, formulir, nilai, usulan, untukJabatan });
    });
    tombol.insertAdjacentElement("afterend", teruskan);
    return;
  }

  // Akun SIPP-nya sudah benar - tetapi peran ALETA-nya belum tentu berwenang.
  // Ini hanya terjadi pada mode ketat; pada mode longgar semua peran boleh.
  if (bolehJenis[formulir] !== true) {
    const namaJabatan = untukJabatan[formulir] || "pejabat berwenang";
    tombol.disabled = false;
    tombol.classList.remove("aleta-tombol-mati");
    tombol.textContent = `Teruskan ke ${namaJabatan}`;
    kabar.textContent = `${formulir.toUpperCase()} ditetapkan ${namaJabatan}. Teruskan usulannya - tidak perlu berganti akun.`;
    tombol.addEventListener("click", () => {
      tombol.disabled = true;
      tombol.classList.add("aleta-tombol-mati");
      void titipkanBorang({ tombol, kabar, formulir, nilai, usulan, untukJabatan });
    });
    return;
  }

  const medanBorang = (keadaan.medan || []).filter(
    (x) => x.borang === formulir && x.medan !== "simpan"
  );
  const medanSimpan = (keadaan.medan || []).find(
    (x) => x.borang === formulir && x.medan === "simpan"
  );
  const simpanOtomatis = keadaan.simpanOtomatis === "nyala";

  tombol.disabled = false;
  tombol.classList.remove("aleta-tombol-mati");
  tombol.textContent = `Kerjakan ${formulir.toUpperCase()}`;
  kabar.textContent = simpanOtomatis
    ? `Mengisi dan menyimpan ${Object.keys(nilai).length} kolom.`
    : `Mengisi ${Object.keys(nilai).length} kolom. Simpan tetap Anda yang menekan.`;

  // Akun SIPP yang sedang terbuka tidak terbaca dari kepala halaman. Bukan
  // alasan untuk menahan pengisian - mengisi tidak menulis apa pun - tetapi
  // petugas perlu tahu bahwa pemeriksaan akun TIDAK berjalan, sebab yang
  // menentukan siapa tercatat adalah tekanan Simpan-nya sendiri.
  if (akunSeharusnya && namaSekarang === "") {
    kabar.textContent +=
      ` Akun SIPP yang terbuka tidak terbaca - pastikan sendiri Anda memakai akun ${akunSeharusnya.namaLengkap}.`;
  }

  tombol.addEventListener("click", () => {
    // Dimatikan seketika. Tanpa ini, tekanan kedua saat yang pertama masih
    // berjalan akan mencatat pengisian dua kali untuk satu penetapan.
    tombol.disabled = true;
    tombol.classList.add("aleta-tombol-mati");
    void kerjakanBorang({
      tombol,
      kabar,
      formulir,
      nilai,
      medanBorang,
      medanSimpan,
      simpanOtomatis,
      usulan,
      data,
      // Bila penetapan ini pernah diteruskan operator, penerusannya ditutup
      // sesudah pengisiannya berhasil - supaya ia tidak terus muncul sebagai
      // pekerjaan yang menunggu padahal sudah dikerjakan.
      idTitipan: sudahDititipkan ? sudahDititipkan.id : "",
    });
  });
}

/**
 * Mengerjakan satu formulir: catat, isi, simpan bila diizinkan, lalu periksa.
 *
 * ============================================================================
 * DICATAT SEBELUM DIISI
 * ============================================================================
 *
 * Urutannya begitu karena pengisian yang gagal di tengah adalah yang paling
 * perlu ditelusuri - dan kalau catatannya baru ditulis sesudah berhasil,
 * justru itulah yang tidak meninggalkan jejak sama sekali.
 */
/**
 * Meneruskan usulan untuk dikerjakan pejabat yang berwenang.
 *
 * ============================================================================
 * YANG DITITIPKAN PEKERJAANNYA, BUKAN AKUNNYA
 * ============================================================================
 *
 * Tidak ada kata sandi yang disimpan, tidak ada yang masuk atas nama siapa
 * pun. Yang disimpan usulan yang sudah disiapkan - dan pejabatnya tetap
 * memeriksa lalu menekannya sendiri, dengan akunnya sendiri.
 *
 * Usulannya disimpan BEKU. Giliran juru sita bergeser tiap ada penetapan
 * baru, dan usulan yang berubah diam-diam antara diteruskan dan dikerjakan
 * adalah usulan yang tidak pernah diperiksa siapa pun dalam bentuk yang
 * akhirnya tercatat.
 */
async function titipkanBorang({ tombol, kabar, formulir, nilai, usulan, untukJabatan }) {
  kabar.textContent = "Meneruskan…";

  const ringkasan = Object.entries(nilai)
    .map(([kolom, isi]) => `${kolom}: ${isi}`)
    .join(" · ")
    .slice(0, 280);

  try {
    const respons = await alatAmbil(ALETA_API_ANTREAN, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        perkaraId: String((usulan.perkara && usulan.perkara.perkaraId) || ""),
        nomorPerkara: String((usulan.perkara && usulan.perkara.nomorPerkara) || ""),
        jenis: formulir,
        usulan: nilai,
        ringkasan,
      }),
    }, "Meneruskan usulan");
    const isi = await respons.json();
    const jawab = isi && isi.data ? isi.data : isi;

    if (!jawab || jawab.ok !== true) {
      kabar.textContent = `Tidak dapat diteruskan: ${(jawab && jawab.alasan) || respons.status}`;
      tombol.disabled = false;
      tombol.classList.remove("aleta-tombol-mati");
      return;
    }

    tombol.textContent = "Sudah diteruskan";
    kabar.textContent = `Menunggu ${jawab.untuk || untukJabatan[formulir] || "pejabat berwenang"} membuka perkara ini di SIPP.`;
  } catch (galat) {
    kabar.textContent = String(galat.message || galat).slice(0, 160);
    tombol.disabled = false;
    tombol.classList.remove("aleta-tombol-mati");
  }
}

/**
 * Menutup penerusan sesudah penetapannya benar-benar dikerjakan.
 *
 * Kegagalannya tidak dilaporkan sebagai kegagalan pengisian - formulirnya sudah
 * terisi, dan penerusan yang tertinggal terbuka hanya berarti satu baris yang
 * perlu ditutup tangan. Menyatakan pengisiannya gagal karena itu akan
 * membuat orang mengulangi pengisian yang sudah berhasil.
 */
async function tutupTitipan(id, formulir) {
  if (!id) return;
  try {
    await fetch(ALETA_API_ANTREAN, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, keadaan: "dikerjakan", akunSipp: akunSipp() }),
    });
  } catch (galat) {
    /* penerusannya tetap terbuka - dapat ditutup dari daftar */
  }
}

async function kerjakanBorang(rencana) {
  const { tombol, kabar, formulir, nilai, medanBorang, medanSimpan, simpanOtomatis, usulan, data } =
    rencana;
  const idTitipan = rencana.idTitipan || "";

  const kembalikan = (pesan) => {
    kabar.textContent = pesan;
    tombol.disabled = false;
    tombol.classList.remove("aleta-tombol-mati");
  };

  // --- 1. catat -----------------------------------------------------------
  kabar.textContent = "Mencatat…";
  let dicatat = [];
  try {
    const respons = await alatAmbil(ALETA_API_CATAT, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        perkaraId: String((usulan.perkara && usulan.perkara.perkaraId) || ""),
        nomorPerkara: String((usulan.perkara && usulan.perkara.nomorPerkara) || ""),
        akunSipp: akunSipp(),
        baris: barisCatatan(formulir, nilai, usulan, (data && data.pilihanManual) || {}),
      }),
    }, "Mencatat penetapan");
    const isi = await respons.json();
    const jawab = isi && isi.data ? isi.data : isi;
    if (!jawab || jawab.ok !== true) {
      kembalikan(`Tidak dicatat: ${(jawab && jawab.alasan) || respons.status}`);
      return;
    }
    dicatat = jawab.dicatat || [];
    if (jawab.peringatanUrutan) kabar.textContent = jawab.peringatanUrutan;
  } catch (galat) {
    kembalikan(String(galat.message || galat).slice(0, 160));
    return;
  }

  // --- 2. isi -------------------------------------------------------------
  kabar.textContent = "Mengisi formulir…";
  const hasilIsi = await isiBorang(medanBorang, nilai);
  if (!hasilIsi.ok) {
    kembalikan(`Berhenti di ${hasilIsi.alasan}. Formulir terisi sebagian - periksa sebelum menyimpan.`);
    return;
  }

  // --- 3. simpan, hanya bila memang dinyalakan -----------------------------
  if (!simpanOtomatis || !medanSimpan || !medanSimpan.penunjuk) {
    // Penerusannya ditutup di sini, bukan sesudah Simpan: yang menutupnya bukan
    // tersimpannya, melainkan bahwa pejabat berwenang sudah mengerjakannya.
    // Menunggu Simpan berarti penerusan yang formulirnya sudah terisi tetap
    // muncul sebagai pekerjaan yang menunggu.
    await tutupTitipan(idTitipan, formulir);
    kabar.textContent = `${formulir.toUpperCase()} terisi. Periksa, lalu tekan Simpan di SIPP.`;
    tombol.textContent = "Sudah diisi";
    return;
  }

  await tutupTitipan(idTitipan, formulir);
  kabar.textContent = "Menyimpan…";
  const jawabSimpan = await kirimKeJembatan({ jenis: "tekan", penunjuk: medanSimpan.penunjuk });
  if (!jawabSimpan.ok) {
    kembalikan(`Terisi, tetapi Simpan tidak dapat ditekan: ${jawabSimpan.alasan}. Tekan sendiri.`);
    return;
  }

  // --- 4. periksa balik ----------------------------------------------------
  //
  // Mengisi formulir tidak sama dengan tercatat. Tanpa langkah ini, catatannya
  // hanya membuktikan ALETA mengetik - bukan bahwa pengadilan mencatat.
  kabar.textContent = "Memeriksa ke SIPP…";
  await new Promise((tunggu) => setTimeout(tunggu, 1500));

  try {
    const respons = await alatAmbil(ALETA_API_CATAT, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nomorPerkara: String((usulan.perkara && usulan.perkara.nomorPerkara) || ""),
        idBaris: dicatat,
        harapan: { [formulir]: usulan.tanggalPenetapan || "" },
      }),
    }, "Memeriksa ke SIPP");
    const isi = await respons.json();
    const jawab = isi && isi.data ? isi.data : isi;
    if (jawab && jawab.mendarat === "ya") {
      kabar.textContent = `${formulir.toUpperCase()} tercatat di SIPP.`;
      tombol.textContent = "Selesai";
    } else {
      kabar.textContent = `Belum terbaca di SIPP (${(jawab && jawab.mendarat) || "tidak tahu"}). Periksa halamannya.`;
      tombol.textContent = "Perlu diperiksa";
    }
  } catch (galat) {
    kabar.textContent = `Tersimpan, tetapi pemeriksaannya gagal: ${String(galat.message || galat).slice(0, 90)}`;
  }
}

/**
 * Akun SIPP yang sedang dipakai, dari halaman SIPP sendiri.
 *
 * Dicatat karena akun SIPP dan akun ALETA belum tentu orang yang sama - panel
 * ini melayang di atas halaman yang punya sesi sendiri. Kalau tidak ketemu,
 * dikosongkan; menebaknya lebih buruk daripada mengakui tidak tahu.
 */
function akunSipp() {
  const petunjuk = document.querySelector(".user-name, .username, #user_name, .navbar .dropdown-toggle");
  return petunjuk ? String(petunjuk.textContent || "").trim().slice(0, 60) : "";
}

/**
 * ============================================================================
 * DATA UMUM DARI BERKAS GUGATAN
 * ============================================================================
 *
 * Petugas memilih berkas gugatan yang diunggah - .docx, .doc, .rtf, atau .pdf
 * teks - dan ALETA memetik isian Data Umum darinya.
 *
 * HASILNYA SELALU DITAMPILKAN LEBIH DULU, beserta potongan kalimat asal tiap
 * petikan. Gugatan ditulis manusia dan tidak ada dua yang bentuknya sama;
 * petikan yang muncul tanpa asal-usul hanya bisa dipercaya atau tidak
 * dipercaya, sedangkan yang menyebutkan barisnya bisa dicocokkan dalam dua
 * detik.
 *
 * Berkasnya TIDAK disimpan di mana pun. Ia dibaca, dipetik, lalu dilepas.
 */
/**
 * ============================================================================
 * ENAM RUAS YANG DIPETIK TETAPI TIDAK PERNAH DIGAMBAR
 * ============================================================================
 *
 * Pemetik di server mengembalikan ENAM BELAS ruas, dan daftar ini dulu hanya
 * menyebut sepuluh. Yang hilang justru ruas Data Umum yang paling dicari saat
 * mendaftarkan perkara perkawinan - tanggal menikah, nomor dan tanggal kutipan
 * akta nikah, KUA tempat menikah - beserta obyek sengketa, posita, dan
 * keterangan surat gugatannya.
 *
 * Akibatnya papan ini terbaca seolah ALETA hanya bisa memetik data PIHAK,
 * padahal data pernikahannya sudah terpetik sejak awal dan hanya dibuang di
 * layar. Ruas yang tidak ada di daftar ini lenyap tanpa jejak: tidak ada
 * galat, dan tidak ada yang menyebutkan bahwa ia pernah ada.
 *
 * Urutannya sengaja mengikuti urutan borang Data Umum SIPP, bukan urutan
 * pemetiknya. Yang membaca papan ini sedang mengisi borang itu baris demi
 * baris, dan daftar yang urutannya berbeda memaksanya melompat-lompat.
 */
const NAMA_PETIKAN = {
  // --- keterangan surat ---------------------------------------------------
  tanggalSurat: "Tanggal surat",
  nomorSurat: "Nomor surat",

  // --- data pernikahan ----------------------------------------------------
  tanggalMenikah: "Tanggal menikah",
  tanggalAktaNikah: "Tanggal kutipan akta nikah",
  nomorAktaNikah: "Nomor kutipan akta nikah",
  kuaTempatMenikah: "KUA tempat menikah",

  // --- para pihak ---------------------------------------------------------
  penggugat: "Penggugat / Pemohon",
  umurPenggugat: "Umur",
  agamaPenggugat: "Agama",
  pekerjaanPenggugat: "Pekerjaan",
  pendidikanPenggugat: "Pendidikan",
  alamatPenggugat: "Alamat penggugat",
  // Alamat yang SUDAH dirapikan berdiri di sebelah alamat mentahnya, bukan
  // menggantikannya. Alamat ini tercetak pada relaas panggilan dan pada
  // identitas para pihak di kepala putusan; yang memilihnya harus dapat
  // menyandingkan keduanya lebih dulu. Asalnya menyebutkan apa yang diubah,
  // dan apa yang masih kurang tetapi TIDAK ditambahkan sendiri.
  alamatPenggugatRapi: "Alamat penggugat (dirapikan)",
  tergugat: "Tergugat / Termohon",
  alamatTergugat: "Alamat tergugat",
  alamatTergugatRapi: "Alamat tergugat (dirapikan)",
  // Beberapa sekaligus - lihat catatan pada penggambarnya.
  domisiliElektronik: "Domisili elektronik",

  // --- isi gugatan --------------------------------------------------------
  obyekSengketa: "Obyek sengketa",
  nilaiSengketa: "Nilai sengketa",
  posita: "Posita",
  petitum: "Petitum",
};

function gambarPetikan(isi, hasil) {
  if (hasil.kasar) {
    isi.appendChild(
      buatElemen(
        "div",
        "aleta-tetap-awas",
        "Berkas .doc lama hanya dapat dibaca kasar - petikannya lebih mungkin meleset. Periksa tiap baris."
      )
    );
  }

  let adaIsi = false;
  for (const [kunci, label] of Object.entries(NAMA_PETIKAN)) {
    const petikan = hasil.petikan ? hasil.petikan[kunci] : null;
    if (!petikan) continue;

    // Sebagian ruas memulangkan BEBERAPA petikan sekaligus - domisili
    // elektronik, misalnya, sebab gugatan dapat memuat surel penggugat dan
    // tergugat berdampingan. Masing-masing digambar barisnya sendiri beserta
    // kalimat asalnya: yang menentukan surel ini milik siapa justru kalimat
    // itu, dan menggabungkannya menjadi satu baris membuang keterangannya.
    if (Array.isArray(petikan)) {
      for (const satu of petikan) {
        if (!satu || !satu.nilai) continue;
        adaIsi = true;
        isi.appendChild(barisPenetapan(label, String(satu.nilai).slice(0, 180), satu.asal, ""));
      }
      continue;
    }

    if (!petikan.nilai) continue;
    adaIsi = true;
    isi.appendChild(barisPenetapan(label, petikan.nilai.slice(0, 180), petikan.asal, ""));
  }

  if (!adaIsi) {
    isi.appendChild(
      buatElemen(
        "div",
        "aleta-kosong",
        `Tidak ada isian yang dikenali dari berkas ini (${hasil.panjangTeks || 0} huruf terbaca).`
      )
    );
  }
}

/**
 * ============================================================================
 * BERKAS GUGATAN YANG SUDAH ADA DI ARSIP ALETA
 * ============================================================================
 *
 * Sampai sekarang berkas gugatan harus DICARI dan DIPILIH petugas dari
 * cakramnya sendiri - padahal berkas yang sama sudah ditarik ALETA dari
 * e-Court sejak hari perkara itu didaftarkan, dan daftarnya sudah tergambar
 * di panel ini juga, beberapa baris di bawah.
 *
 * Yang dikerjakan petugas selama ini: membuka e-Court, mengunduh gugatannya
 * sekali lagi, menyimpannya entah di mana, lalu memilihnya di sini. Tiga
 * langkah untuk berkas yang sudah ada di tangan ALETA.
 *
 * Pemilih berkas manual TIDAK dibuang: perkara yang berkasnya belum pernah
 * ditarik - dan perkara lama memang banyak yang begitu - tetap perlu jalan
 * itu. Yang ditambahkan hanya jalan yang lebih pendek bila memang ada.
 */
const POLA_BERKAS_GUGATAN = /gugatan|permohonan/i;

/** Dokumen e-Court perkara ini yang menyerupai berkas gugatan. */
function dokumenGugatan(konteks) {
  const semua = (konteks && Array.isArray(konteks.dokumen) && konteks.dokumen) || [];
  const cocok = semua.filter((d) => POLA_BERKAS_GUGATAN.test(sebutanDokumen(d)));
  // Kalau tidak ada yang menyerupai gugatan, seluruh dokumennya ditawarkan -
  // judul dokumen e-Court tidak selalu menyebut kata gugatan, dan daftar
  // kosong di sini terbaca sebagai ALETA yang tidak punya berkasnya sama
  // sekali padahal berkasnya ada.
  const dipakai = cocok.length > 0 ? cocok : semua;
  return dipakai.filter((d) => d && d.documentKey).slice(0, 6);
}

/** Membaca satu berkas arsip dan memetik Data Umum darinya. */
async function bacaBerkasArsip(documentKey, format) {
  const respons = await alatAmbil(
    ALETA_API_BERKAS_ARSIP,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentKey, format: format || "pdf" }),
    },
    "Membaca berkas dari arsip ALETA"
  );
  if (respons.status === 403) throw new Error("Peran Anda tidak diberi akses papan penunjukan.");
  if (!respons.ok) throw new Error(alatPesanGagal(null, respons.status, "Membaca berkas dari arsip ALETA"));
  const luar = await respons.json();
  return luar && luar.data ? luar.data : luar;
}

/** Data Umum dari berkas gugatan yang diunggah petugas. */
function bagianDataUmum(konteks) {
  const kotak = bagian("Data Umum dari berkas gugatan", "dataUmum", true);
  const isi = kotak.isi;

  const kaki = buatElemen("div", "aleta-tetap-kaki");
  const pemilih = document.createElement("input");
  pemilih.type = "file";
  pemilih.accept = ".docx,.doc,.rtf,.pdf,.txt";
  pemilih.className = "aleta-berkas";
  kaki.appendChild(pemilih);
  isi.appendChild(kaki);

  const kabar = buatElemen("div", "aleta-tetap-sebab", "Pilih berkas gugatan untuk dibaca.");
  isi.appendChild(kabar);

  const hasilKotak = buatElemen("div", "aleta-petikan");

  // Jalan yang lebih pendek, digambar DI ATAS pemilih berkas: berkas yang
  // sudah ada di arsip dibaca dengan satu tekanan, tanpa mengunduh apa pun.
  const arsip = dokumenGugatan(konteks);
  if (arsip.length > 0) {
    const kotakArsip = buatElemen("div", "aleta-arsip-gugatan");
    kotakArsip.appendChild(
      buatElemen(
        "div",
        "aleta-tetap-sebab",
        "Sudah ada di arsip ALETA - tidak perlu diunduh dari e-Court lebih dahulu:"
      )
    );
    for (const d of arsip) {
      const baris = buatElemen("div", "aleta-arsip-baris");
      baris.appendChild(
        buatElemen("span", "aleta-arsip-judul", d.judulDokumen || d.jenisDokumen || "Dokumen")
      );
      const tombolBaca = buatElemen("button", "aleta-portal-tautan", "Baca berkas ini");
      tombolBaca.type = "button";
      tombolBaca.addEventListener("click", async () => {
        tombolBaca.disabled = true;
        hasilKotak.textContent = "";
        kabar.textContent = `Membaca ${d.judulDokumen || "berkas"} dari arsip…`;
        try {
          const hasil = await bacaBerkasArsip(d.documentKey);
          if (!hasil || hasil.ok !== true) {
            kabar.textContent =
              (hasil && (hasil.pesan || hasil.alasan)) || "Berkas tidak dapat dibaca.";
            tombolBaca.disabled = false;
            return;
          }
          kabar.textContent = `${hasil.nama} terbaca dari arsip ALETA. Periksa tiap baris sebelum dipakai.`;
          gambarPetikan(hasilKotak, hasil);
          gambarKerjakanDataUmum(hasilKotak, hasil, konteks);
        } catch (galat) {
          kabar.textContent = String(galat.message || galat).slice(0, 180);
        } finally {
          tombolBaca.disabled = false;
        }
      });
      baris.appendChild(tombolBaca);
      kotakArsip.appendChild(baris);
    }
    isi.appendChild(kotakArsip);
  }

  isi.appendChild(hasilKotak);

  pemilih.addEventListener("change", () => {
    const berkas = pemilih.files && pemilih.files[0];
    if (!berkas) return;

    hasilKotak.textContent = "";
    kabar.textContent = `Membaca ${berkas.name}…`;

    void (async () => {
      try {
        const badan = new FormData();
        badan.append("berkas", berkas);
        const respons = await alatAmbil(
          ALETA_API_BERKAS_GUGATAN,
          { method: "POST", credentials: "include", body: badan },
          "Membaca berkas gugatan"
        );
        if (respons.status === 403) throw new Error("Peran Anda tidak diberi akses papan penunjukan.");
        if (!respons.ok) throw new Error(alatPesanGagal(null, respons.status, "Membaca berkas gugatan"));

        const luar = await respons.json();
        const hasil = luar && luar.data ? luar.data : luar;

        if (!hasil || hasil.ok !== true) {
          kabar.textContent =
            (hasil && (hasil.pesan || hasil.alasan)) || "Berkas tidak dapat dibaca.";
          return;
        }

        kabar.textContent = `${hasil.nama} terbaca. Periksa tiap baris sebelum dipakai.`;
        gambarPetikan(hasilKotak, hasil);
        gambarKerjakanDataUmum(hasilKotak, hasil, konteks);
      } catch (galat) {
        kabar.textContent = String(galat.message || galat).slice(0, 180);
      }
    })();
  });

  return kotak;
}

/**
 * ============================================================================
 * MENGISIKAN DATA UMUM KE SIPP
 * ============================================================================
 *
 * Enam ruas yang dapat diisikan, dan hanya enam. Sisanya - nama pihak, alamat,
 * pekerjaan, obyek sengketa - sengaja TIDAK ikut: para pihak punya tabelnya
 * sendiri beserta aturan kumulasi dan kuasa hukumnya, dan mengisikannya dari
 * petikan mesin menuntut ketelitian yang belum dapat dijamin.
 *
 * ============================================================================
 * KERING LEBIH DAHULU, DAN ITU BUKAN PILIHAN
 * ============================================================================
 *
 * Tekanan pertama SELALU kering: yang muncul daftar pernyataan yang akan
 * dikirim, beserta ruas mana yang dilewati karena sudah terisi di SIPP.
 * Menulis menuntut tekanan KEDUA pada tombol yang berbeda, yang baru muncul
 * sesudah hasil keringnya terbaca.
 *
 * Petikan dari berkas gugatan adalah hasil baca mesin atas dokumen yang
 * ditulis manusia. Menaruh tombol tulis sebagai tekanan pertama berarti
 * mempertaruhkan berkas perkara pada ketepatan pembacaan yang belum sempat
 * dilihat siapa pun.
 */
function gambarKerjakanDataUmum(isi, hasil, konteks) {
  const perkaraId = String((konteks && konteks.identitas && konteks.identitas.perkaraId) || "");
  if (!perkaraId) return;

  const petikan = hasil.petikan || {};
  const ambil = (kunci) => {
    const p = petikan[kunci];
    return p && p.nilai ? String(p.nilai).trim() : "";
  };

  const dataUmum = {
    tanggalSurat: ambil("tanggalSurat"),
    nomorSurat: ambil("nomorSurat"),
    tanggalMenikah: ambil("tanggalMenikah"),
    tanggalAktaNikah: ambil("tanggalAktaNikah"),
    nomorAktaNikah: ambil("nomorAktaNikah"),
    kuaTempatMenikah: ambil("kuaTempatMenikah"),
  };
  if (!Object.values(dataUmum).some(Boolean)) return;

  const kaki = buatElemen("div", "aleta-tetap-kaki");
  const kabar = buatElemen("div", "aleta-tetap-sebab", "");
  const tombol = buatElemen("button", "aleta-tombol", "Periksa dulu - belum ditulis");
  tombol.type = "button";

  let rencanaSiap = null;

  const kirim = async (kering) => {
    tombol.disabled = true;
    kabar.textContent = kering ? "Menyusun pernyataan…" : "Menuliskan ke SIPP…";
    try {
      const respons = await alatAmbil(ALETA_API_TULIS, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jenis: "dataUmum",
          perkaraId: Number(perkaraId),
          tanggalPenetapan: new Date().toISOString().slice(0, 10),
          dataUmum,
          // Akun pejabat yang akan tercatat sebagai pengisi. Diambil dari
          // halaman SIPP yang sedang terbuka - itulah yang dilihat petugas,
          // dan menebaknya dari tempat lain akan berselisih dengan yang
          // tertulis di kepala panel.
          olehUsername: namaPenggunaSipp(),
          kering,
        }),
      }, "Menulis Data Umum");
      const luar = await respons.json();
      const h = luar && luar.data ? luar.data : luar;

      if (h.ok === false) {
        kabar.textContent =
          h.alasan === "tidak_ada_yang_perlu_diisi"
            ? `Tidak ada yang perlu diisi - seluruhnya sudah terisi di SIPP. ${(h.dilewati || []).join("; ")}`
            : `Ditolak: ${h.alasan || "sebab tidak disebut"}`;
        tombol.disabled = false;
        return;
      }

      if (kering) {
        rencanaSiap = true;
        const baris = (h.rencana || []).map((x) => `${x.tabel} ${x.aksi} — ${x.keterangan}`);
        kabar.textContent =
          `Akan tercatat atas nama ${h.atasNama ? h.atasNama.namaLengkap || h.atasNama.username : "?"}. ` +
          `${baris.length} pernyataan: ${baris.join(" · ")}. ` +
          `${(h.dilewati || []).length > 0 ? `Dilewati: ${(h.dilewati || []).join("; ")}.` : ""}`;
        tombol.textContent = "Tuliskan ke SIPP";
        tombol.disabled = false;
        return;
      }

      // Data Umum menulis ke tabel perkara - keadaan yang dipajang menu
      // Berkas dan Perkara ikut berubah karenanya.
      lupakanStatusPerkara(String((konteks && konteks.nomorPerkara) || ""));
      kabar.textContent = `Tersimpan. ${(h.selesai || []).length} pernyataan dijalankan.`;
      tombol.textContent = "Sudah ditulis";
    } catch (galat) {
      kabar.textContent = String(galat.message || galat).slice(0, 180);
      tombol.disabled = false;
    }
  };

  tombol.addEventListener("click", () => void kirim(!rencanaSiap));

  kaki.appendChild(tombol);
  isi.appendChild(kaki);
  isi.appendChild(kabar);
}

/**
 * ============================================================================
 * BACA BORANG - MENGISI PETA KOLOM DARI KENYATAAN
 * ============================================================================
 *
 * Menyebutkan kolom apa saja yang benar-benar ada di halaman ini, lengkap
 * dengan label dan penunjuknya, untuk disalin ke pengaturan peta kolom.
 *
 * Ini yang membuat penunjuk kolom tidak pernah perlu ditebak. Penunjuk yang
 * salah tidak gagal dengan jelas - ia mengenai kolom LAIN, dan nama juru sita
 * masuk ke kolom panitera tanpa ada yang tahu sampai relaasnya terbit.
 *
 * Nilai kolomnya sengaja TIDAK ikut disebutkan: formulir perkara yang sedang
 * terbuka memuat data pihak berperkara, dan yang dibutuhkan hanya namanya.
 */
/**
 * ============================================================================
 * MENGISI BORANG PUTUSAN AKHIR SIPP DARI DRAF ALETA
 * ============================================================================
 *
 * Borang Putusan Akhir menuntut potongan yang terpisah-pisah, dan tiga di
 * antaranya panjang: Pertimbangan Hukum, Amar, dan Amar Anonim. Ketiganya
 * CKEditor, dan selama ini disalin tangan dari naskah putusan - satu per satu,
 * sambil berpindah jendela, pada hari yang paling sibuk.
 *
 * ============================================================================
 * TIGA HAL YANG SENGAJA TIDAK DIKERJAKAN DI SINI
 * ============================================================================
 *
 * 1. TIDAK MEMUTUSKAN APA PUN. Naskahnya dipecah dan namanya disamarkan di
 *    portal, yang diuji tiap pemeriksaan berkala. Berkas ini hanya menaruh
 *    hasilnya ke kolom yang benar.
 *
 * 2. TIDAK MENEKAN SIMPAN. Yang tersimpan di sini menjadi putusan resmi.
 *    Petugas membaca lalu menyimpan sendiri - dan itu bukan kehati-hatian yang
 *    berlebihan, melainkan satu-satunya tempat manusia masih membacanya.
 *
 * 3. TIDAK MENYENTUH STATUS PUTUSAN, VERSTEK, DAN SUMBER HUKUM. Pilihannya
 *    sudah disaring SIPP menurut jenis dan alur perkara, dan salah pilih di
 *    situ mengubah jenis putusannya - bukan sekadar salah ketik. Yang
 *    dikerjakan ALETA hanya isian teks panjang yang selama ini disalin tangan.
 */
/**
 * ============================================================================
 * ISIAN ALASAN PADA LAYAR INFO PERKARA AGAMA (DATA UMUM)
 * ============================================================================
 *
 * Layar ini menuntut satu medan "alasan" yang berbeda untuk tiap jenis perkara
 * agama, dan hanya satu di antaranya yang tampak pada satu perkara: alasan
 * poligami, alasan pembatalan kawin, alasan penguasaan anak, alasan pengesahan
 * anak, alasan asal usul anak, alasan itsbat nikah, alasan dispensasi kawin.
 * Seluruhnya tersimpan ke satu tabel dengan penanda yang berbeda, dan angka
 * itulah yang kelak menjadi laporan statistik perkara agama.
 *
 * Sama seperti borang putusan, tidak satu pun aturan "medan mana untuk perkara
 * mana" disalin ke sini. Yang dikerjakan: menanyakan kepada HALAMAN medan mana
 * yang sedang tampak, lalu meminta ALETA memilih satu dari daftar pilihan yang
 * halaman itu sendiri berikan.
 *
 * Bedanya dengan borang putusan hanya pada BUKTINYA. Data Umum diisi pada hari
 * perkara didaftarkan - belum ada draf putusan, belum ada pertimbangan hukum -
 * jadi yang dibaca adalah posita dan petitum yang ada di layar yang sama.
 */
function bagianIsiAlasanPerkara(nomorPerkara) {
  const kotak = bagian("Isi formulir Data Umum dari posita", "isiAlasanPerkara", true);
  const isi = kotak.isi;

  isi.appendChild(
    buatElemen(
      "div",
      "aleta-tetap-sebab",
      "Membaca posita dan petitum yang ada di layar ini, lalu mengisikan dua hal yang " +
        "berbeda sifatnya. Data pernikahan DIPETIK apa adanya - nomor akta dan tanggalnya " +
        "tertulis di positanya, dan tiap petikan dapat Anda sunting sebelum diisikan. " +
        "Medan alasan DIUSULKAN - angka itulah yang kelak menjadi laporan statistik perkara " +
        "agama, jadi periksa tiap usulan. Tombol Simpan tetap Anda yang menekan."
    )
  );

  const tombol = buatElemen("button", "aleta-permintaan-tombol", "Baca posita, susun isian");
  tombol.type = "button";
  const kabar = buatElemen("div", "aleta-abt-kabar");
  const wadah = buatElemen("div", "aleta-isian-putusan");
  isi.appendChild(tombol);
  isi.appendChild(kabar);
  isi.appendChild(wadah);

  // Penunjuknya berbasis NAMA, bukan id, mengikuti pilihan yang sama pada
  // borang putusan: pada borang SIPP ada select yang memakai id milik select
  // lain, dan querySelector("#...") memulangkan yang mana pun yang lebih dulu
  // di dokumen. Nama medan tidak kembar, dan namanya pula yang dikirim ke
  // peladen.
  //
  // Medan berisi BANYAK pilihan sekaligus - objek wakaf dan akad syariah
  // tambahan - sengaja TIDAK ditawarkan. Keduanya digambar oleh alat pilihan
  // ganda milik halaman, yang menyimpan pilihannya di tempat lain dari select
  // aslinya: menyetel nilainya membuat daftar di layar tidak ikut berubah,
  // sehingga petugas melihat satu hal dan yang tersimpan hal lain.
  const CALON_ALASAN = [
    { penunjuk: 'select[name="alasan_poligami"]', label: "Alasan Pengajuan Poligami" },
    { penunjuk: 'select[name="batal_kawin"]', label: "Alasan Pembatalan Kawin" },
    { penunjuk: 'select[name="alasan_kuasa_anak"]', label: "Alasan Pengajuan Penguasaan Anak" },
    { penunjuk: 'select[name="alasan_sah_anak"]', label: "Alasan Pengajuan Pengesahan Anak" },
    { penunjuk: 'select[name="alasan_asalusul"]', label: "Alasan Pengajuan Asal Usul Anak" },
    { penunjuk: 'select[name="alasan_isbat"]', label: "Alasan Pengajuan Isbat Nikah" },
    { penunjuk: 'select[name="alasan_dispen"]', label: "Alasan Pengajuan Dispensasi Kawin" },
    { penunjuk: 'select[name="bidang_ekonomi_syariah"]', label: "Bidang Ekonomi Syariah" },
    { penunjuk: 'select[name="akad_syariah_primer"]', label: "Jenis Akad Syariah" },
  ];

  // ────────────────────────────────────────────────────────────────────────
  // MEDAN YANG DIPETIK, BUKAN DIUSULKAN
  // ────────────────────────────────────────────────────────────────────────
  //
  // Perkara cerai menuntut empat isian bertanda bintang yang seluruhnya
  // tertulis apa adanya pada alinea pertama posita: tanggal menikah, tanggal
  // dan nomor kutipan akta nikah, serta KUA tempat menikah. Permohonan itsbat
  // menuntut tanggal dan tempat pernikahannya.
  //
  // Menyalinnya bukan penilaian melainkan ketelitian - dan ketelitian itulah
  // yang paling cepat luntur pada perkara kesepuluh di hari yang sama. Karena
  // itu tiap petikan diperlihatkan BESERTA kalimat asalnya dan dapat disunting
  // sebelum diisikan.
  //
  // KUA sengaja tidak ada di daftar ini. Medannya daftar yang dicari ke
  // peladen ketika petugas mengetik, dan pilihannya belum ada di halaman
  // sebelum ia mengetik - jadi tidak ada yang dapat diisikan tanpa menebak
  // kodenya. Namanya tetap diperlihatkan, supaya yang harus diketik sudah
  // terbaca tanpa menggulung ke positanya.
  const CALON_PETIKAN = [
    { penunjuk: 'input[name="tgl_nikah"]', label: "Tanggal Menikah", kunciPetik: "tglNikah", jenisMedan: "tanggal" },
    {
      penunjuk: 'input[name="tgl_kutipan_akta_nikah"]',
      label: "Tgl. Kutipan Akta Nikah",
      kunciPetik: "tglKutipanAktaNikah",
      jenisMedan: "tanggal",
    },
    {
      penunjuk: 'input[name="no_kutipan_akta_nikah"]',
      label: "No. Kutipan Akta Nikah",
      kunciPetik: "noKutipanAktaNikah",
      jenisMedan: "teks",
    },
    {
      penunjuk: 'input[name="tgl_menikah_isbat"]',
      label: "Tanggal Menikah (Isbat)",
      kunciPetik: "tglNikah",
      jenisMedan: "tanggal",
    },
    {
      penunjuk: 'input[name="tempat_menikah_isbat"]',
      label: "Tempat Menikah (Isbat)",
      kunciPetik: "tempatNikah",
      jenisMedan: "teks",
    },
  ];

  tombol.addEventListener("click", async () => {
    tombol.disabled = true;
    wadah.textContent = "";
    kabar.className = "aleta-abt-kabar";
    kabar.textContent = "Membaca posita…";

    // ────────────────────────────────────────────────────────────────────
    // BUKTI DIBACA DARI LAYAR, BUKAN DARI BASIS DATA
    // ────────────────────────────────────────────────────────────────────
    //
    // Yang dinilai haruslah yang sedang dilihat petugas. Ia mungkin baru
    // menempelkan positanya dan belum menekan Simpan; membacanya dari basis
    // data di saat itu memulangkan kekosongan, dan usulannya akan mengaku
    // "tidak ditemukan" atas kalimat yang jelas terpampang.
    const bacaPosita = await kirimKeJembatan({
      jenis: "nilai",
      penunjuk: "#posita",
      jenisMedan: "kaya",
    });
    const bacaPetitum = await kirimKeJembatan({
      jenis: "nilai",
      penunjuk: "#petitum",
      jenisMedan: "kaya",
    });
    let posita = (bacaPosita && bacaPosita.ok && bacaPosita.nilai) || "";
    const petitum = (bacaPetitum && bacaPetitum.ok && bacaPetitum.nilai) || "";
    let asalPosita = "posita di layar ini";

    // ────────────────────────────────────────────────────────────────────
    // POSITA KOSONG BUKAN JALAN BUNTU LAGI
    // ────────────────────────────────────────────────────────────────────
    //
    // Perkara e-Court yang baru didaftarkan kerap punya kolom posita yang
    // masih kosong di SIPP - isinya memang masih di berkas gugatannya, dan
    // mengetiknya ke SIPP justru salah satu pekerjaan yang hendak ditolong
    // menu ini. Sampai sekarang menu ini menyerah di situ: tidak ada teks,
    // tidak ada usulan, dan yang membacanya menyimpulkan ALETA tidak bisa
    // apa-apa pada perkara yang paling membutuhkannya.
    //
    // Cadangannya berkas gugatan yang SUDAH ada di arsip ALETA - bukan
    // berkas yang harus dicari petugas. Kalau arsipnya pun kosong, menu ini
    // menyerah seperti dahulu, dan itu jawaban yang jujur.
    //
    // Asalnya SELALU disebutkan. Usulan yang disusun dari berkas, lalu
    // dibaca seolah-olah disusun dari layar, membuat orang mencari kalimat
    // yang memang tidak ada di layarnya.
    if (!posita.trim()) {
      const arsip = dokumenGugatan(konteksTerakhir);
      if (arsip.length > 0) {
        kabar.textContent = "Posita kosong di SIPP - membaca berkas gugatan dari arsip ALETA…";
        try {
          const hasil = await bacaBerkasArsip(arsip[0].documentKey);
          const dari = hasil && hasil.ok === true && hasil.petikan ? hasil.petikan.posita : null;
          if (dari && dari.nilai) {
            posita = dari.nilai;
            asalPosita = `berkas ${hasil.nama} di arsip ALETA`;
          }
        } catch {
          /* arsipnya tidak terbaca - menu ini menyerah seperti dahulu */
        }
      }
    }

    kabar.textContent = "Memeriksa medan alasan yang tampak…";

    const medanTampak = [];
    for (const calon of CALON_ALASAN) {
      const jawabPilihan = await kirimKeJembatan({ jenis: "pilihan", penunjuk: calon.penunjuk });
      if (!jawabPilihan || !jawabPilihan.ok || !jawabPilihan.tampak) continue;
      const pilihan = (jawabPilihan.pilihan || []).map((x) => ({ nilai: x.nilai, label: x.label }));
      if (pilihan.length === 0) continue;
      medanTampak.push({
        kunci: calon.penunjuk,
        label: calon.label,
        pilihan,
        nilaiSekarang: jawabPilihan.nilaiSekarang || "",
      });
    }

    // Medan petikan ditanyakan dengan cara yang sama: yang menentukan ada dan
    // tampaknya adalah HALAMAN, bukan daftar jenis perkara di sini.
    const petikanTampak = [];
    for (const calon of CALON_PETIKAN) {
      const jawabNilai = await kirimKeJembatan({ jenis: "nilai", penunjuk: calon.penunjuk });
      if (!jawabNilai || !jawabNilai.ok || !jawabNilai.tampak) continue;
      petikanTampak.push({ ...calon, nilaiSekarang: jawabNilai.nilai || "" });
    }

    // Obyek Sengketa - satu-satunya kotak di layar ini yang isinya bukan dari
    // posita melainkan kebiasaan satker. Kebiasaannya baru diminta bila
    // kotaknya memang tampak.
    const bacaObyek = await kirimKeJembatan({ jenis: "nilai", penunjuk: 'textarea[name="obyek_gugatan"]' });
    const obyekTampak = Boolean(bacaObyek && bacaObyek.ok && bacaObyek.tampak);
    const obyekSekarang = (obyekTampak && bacaObyek.nilai) || "";

    if (medanTampak.length === 0 && petikanTampak.length === 0 && !obyekTampak) {
      kabar.className = "aleta-abt-kabar";
      kabar.textContent =
        "Layar ini tidak menampilkan satu pun medan yang dapat ALETA isikan untuk jenis perkara ini.";
      tombol.disabled = false;
      return;
    }

    let usulanMedan = [];
    let dataNikah = null;
    let dataObyek = null;
    try {
      const respons = await alatAmbil(
        ALETA_API_ALASAN_PERKARA,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            nomorPerkara: nomorPerkara || "",
            teks: { posita, petitum },
            // Dicatat di sisi server juga: usulan yang disusun dari berkas
            // dan usulan yang disusun dari layar tidak sama nilainya bila
            // kelak diukur ketepatannya.
            asalPosita,
            medan: medanTampak.map((x) => ({ kunci: x.kunci, label: x.label, pilihan: x.pilihan })),
            mintaObyek: obyekTampak,
          }),
        },
        "Menyusun usulan alasan"
      );
      if (!respons.ok) throw new Error(alatPesanGagal(null, respons.status, "Menyusun usulan alasan"));
      const luar = await respons.json();
      const jawab = luar && luar.data ? luar.data : luar;
      if (!jawab || !jawab.ada) {
        kabar.className = "aleta-abt-kabar";
        kabar.textContent = (jawab && jawab.sebab) || "Tidak ada usulan yang dapat disusun.";
        tombol.disabled = false;
        return;
      }
      usulanMedan = jawab.usulan || [];
      dataNikah = jawab.nikah || null;
      dataObyek = jawab.obyekSengketa || null;
      // Asal positanya disebutkan apa adanya. Usulan yang disusun dari berkas
      // gugatan, lalu dibaca seolah-olah disusun dari layar, membuat orang
      // mencari kalimat yang memang tidak ada di layarnya.
      kabar.textContent =
        `${petikanTampak.length} medan dapat dipetik dan ${medanTampak.length} medan alasan tampak, ` +
        `dibaca dari ${jawab.panjangTeks} huruf ${asalPosita} dan petitum.`;
    } catch (galat) {
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent = String((galat && galat.message) || galat);
      tombol.disabled = false;
      return;
    }

    // ────────────────────────────────────────────────────────────────────
    // KARTU PETIKAN - NILAINYA DAPAT DISUNTING SEBELUM DIISIKAN
    // ────────────────────────────────────────────────────────────────────
    //
    // Yang diisikan adalah isi kotak saat Terapkan ditekan, BUKAN petikan
    // semula. Sebagian petugas menambahkan kata "Duplikat" di depan nomor akta
    // pengganti, dan sebagian kabupaten menuliskan kecamatan alih-alih desa -
    // keduanya satu suntingan kecil, dan tanpa kotak ini seluruh petikannya
    // menjadi tidak terpakai.
    const petikanTerap = [];
    for (const petik of petikanTampak) {
      const hasilPetik = (dataNikah && dataNikah[petik.kunciPetik]) || null;
      const kartu = buatElemen("div", "aleta-abt-kartu");

      const kepala = buatElemen("div", "aleta-abt-kartu-kepala");
      const centang = document.createElement("input");
      centang.type = "checkbox";
      centang.className = "aleta-abt-centang";
      centang.checked = Boolean(hasilPetik && hasilPetik.nilai);
      centang.disabled = !(hasilPetik && hasilPetik.nilai);
      kepala.appendChild(centang);
      kepala.appendChild(buatElemen("span", "aleta-abt-nama", petik.label));
      kepala.appendChild(
        buatElemen(
          "span",
          `aleta-tanda ${hasilPetik && hasilPetik.nilai ? "aleta-tanda-hijau" : "aleta-tanda-abu"}`,
          hasilPetik && hasilPetik.nilai ? "terbaca di posita" : "tidak terbaca"
        )
      );
      kartu.appendChild(kepala);

      const sanding = buatElemen("div", "aleta-abt-sanding");
      const kini = buatElemen("div", "aleta-abt-kini");
      kini.appendChild(buatElemen("span", "aleta-abt-label", "sekarang"));
      kini.appendChild(buatElemen("span", "aleta-abt-isi", petik.nilaiSekarang || "(masih kosong)"));
      sanding.appendChild(kini);
      kartu.appendChild(sanding);

      const kotakIsi = document.createElement("input");
      kotakIsi.type = "text";
      kotakIsi.className = "aleta-abt-sunting-kotak";
      kotakIsi.value = (hasilPetik && hasilPetik.nilai) || "";
      kotakIsi.setAttribute("aria-label", petik.label);
      kotakIsi.addEventListener("input", () => {
        centang.disabled = !kotakIsi.value.trim();
        if (centang.disabled) centang.checked = false;
      });
      kartu.appendChild(kotakIsi);

      if (hasilPetik && hasilPetik.kutipan) {
        const kutip = buatElemen("div", "aleta-abt-kutipan");
        kutip.appendChild(buatElemen("span", "aleta-abt-asal", "Posita"));
        kutip.appendChild(buatElemen("span", "aleta-abt-kalimat", hasilPetik.kutipan));
        kartu.appendChild(kutip);
      }

      wadah.appendChild(kartu);
      petikanTerap.push({
        kunci: petik.penunjuk,
        label: petik.label,
        jenisMedan: petik.jenisMedan,
        centang,
        nilai: () => kotakIsi.value.trim(),
      });
    }

    // KUA hanya diberitahukan. Medannya daftar yang dicari ke peladen, dan
    // mengisinya menuntut kode yang tidak ada di halaman - jadi yang berguna
    // adalah menyebutkan namanya, bukan berpura-pura dapat mengisinya.
    if (dataNikah && dataNikah.kua && dataNikah.kua.nilai) {
      const kabarKua = buatElemen(
        "div",
        "aleta-tetap-sebab",
        `KUA tempat menikah menurut posita: ${dataNikah.kua.nilai}. Ketik nama itu pada kotak ` +
          "KUA Tempat Menikah - daftarnya dicari SIPP sendiri, dan ALETA tidak dapat memilihkannya."
      );
      wadah.appendChild(kabarKua);
    }

    // ────────────────────────────────────────────────────────────────────
    // KARTU OBYEK SENGKETA - KEBIASAAN SATKER, BUKAN PEMBACAAN POSITA
    // ────────────────────────────────────────────────────────────────────
    //
    // Tidak ada satu pun kalimat posita yang menyebut "Pernikahan/Perceraian".
    // Yang menentukan isinya adalah apa yang selama ini ditulis satker untuk
    // jenis perkara yang sama, dan angka itu diperlihatkan apa adanya.
    // Dicentang sendiri hanya bila kebiasaannya nyaris bulat; selebihnya
    // ditawarkan, dengan pilihan lainnya disebut.
    if (obyekTampak) {
      const teratas = (dataObyek && dataObyek.usulan && dataObyek.usulan[0]) || null;
      const kartu = buatElemen("div", "aleta-abt-kartu");
      const kepala = buatElemen("div", "aleta-abt-kartu-kepala");
      const centang = document.createElement("input");
      centang.type = "checkbox";
      centang.className = "aleta-abt-centang";
      centang.checked = Boolean(teratas && teratas.nilai && dataObyek.yakin);
      centang.disabled = !(teratas && teratas.nilai);
      kepala.appendChild(centang);
      kepala.appendChild(buatElemen("span", "aleta-abt-nama", "Obyek Sengketa"));
      const nadaObyek = !teratas
        ? { kelas: "aleta-tanda-abu", teks: (dataObyek && dataObyek.sebab) || "belum ada riwayat" }
        : dataObyek.yakin
        ? { kelas: "aleta-tanda-hijau", teks: `kebiasaan satker: ${teratas.jumlah} dari ${dataObyek.total}` }
        : { kelas: "aleta-tanda-kuning", teks: `tidak bulat: ${teratas.jumlah} dari ${dataObyek.total}` };
      kepala.appendChild(buatElemen("span", `aleta-tanda ${nadaObyek.kelas}`, nadaObyek.teks));
      kartu.appendChild(kepala);

      const sandingObyek = buatElemen("div", "aleta-abt-sanding");
      const kiniObyek = buatElemen("div", "aleta-abt-kini");
      kiniObyek.appendChild(buatElemen("span", "aleta-abt-label", "sekarang"));
      kiniObyek.appendChild(buatElemen("span", "aleta-abt-isi", obyekSekarang || "(masih kosong)"));
      sandingObyek.appendChild(kiniObyek);
      kartu.appendChild(sandingObyek);

      const kotakObyek = document.createElement("input");
      kotakObyek.type = "text";
      kotakObyek.className = "aleta-abt-sunting-kotak";
      kotakObyek.value = (teratas && teratas.nilai) || "";
      kotakObyek.setAttribute("aria-label", "Obyek Sengketa");
      kotakObyek.addEventListener("input", () => {
        centang.disabled = !kotakObyek.value.trim();
        if (centang.disabled) centang.checked = false;
      });
      kartu.appendChild(kotakObyek);

      const lainnya = ((dataObyek && dataObyek.usulan) || []).slice(1).filter((x) => x && x.nilai);
      if (lainnya.length > 0) {
        kartu.appendChild(
          buatElemen(
            "div",
            "aleta-abt-catatan",
            `Pernah ditulis juga untuk ${(dataObyek && dataObyek.jenisPerkara) || "jenis perkara ini"}: ` +
              lainnya.map((x) => `${x.nilai} (${x.jumlah})`).join("; ")
          )
        );
      }

      wadah.appendChild(kartu);
      petikanTerap.push({
        kunci: 'textarea[name="obyek_gugatan"]',
        label: "Obyek Sengketa",
        jenisMedan: "teks",
        centang,
        nilai: () => kotakObyek.value.trim(),
      });
    }

    const pilihanTerap = [];
    for (const medan of medanTampak) {
      const usul = usulanMedan.find((x) => x.kunci === medan.kunci) || null;
      const sekarang =
        (medan.pilihan.find((x) => String(x.nilai) === String(medan.nilaiSekarang)) || {}).label || "";
      const kartu = buatElemen("div", "aleta-abt-kartu");

      const kepala = buatElemen("div", "aleta-abt-kartu-kepala");
      const centang = document.createElement("input");
      centang.type = "checkbox";
      centang.className = "aleta-abt-centang";
      // Yang berselisih TIDAK dicentang sendiri: justru itu yang paling perlu
      // dibaca manusia.
      centang.checked = Boolean(usul && usul.nilai) && usul.keyakinan !== "bentrok";
      centang.disabled = !(usul && usul.nilai);
      kepala.appendChild(centang);
      kepala.appendChild(buatElemen("span", "aleta-abt-nama", medan.label));
      const nada =
        !usul || !usul.nilai
          ? { kelas: "aleta-tanda-abu", teks: "tidak ditemukan" }
          : usul.keyakinan === "bentrok"
          ? { kelas: "aleta-tanda-merah", teks: "posita menyebut lebih dari satu" }
          : usul.keyakinan === "pasti"
          ? { kelas: "aleta-tanda-hijau", teks: "disebut posita" }
          : { kelas: "aleta-tanda-kuning", teks: "mendekati" };
      kepala.appendChild(buatElemen("span", `aleta-tanda ${nada.kelas}`, nada.teks));
      kartu.appendChild(kepala);

      const sanding = buatElemen("div", "aleta-abt-sanding");
      const kini = buatElemen("div", "aleta-abt-kini");
      kini.appendChild(buatElemen("span", "aleta-abt-label", "sekarang"));
      kini.appendChild(buatElemen("span", "aleta-abt-isi", sekarang || "(belum dipilih)"));
      sanding.appendChild(kini);
      if (usul && usul.nilai) {
        const usulBaris = buatElemen("div", "aleta-abt-usul");
        usulBaris.appendChild(buatElemen("span", "aleta-abt-label", "usulan"));
        usulBaris.appendChild(buatElemen("span", "aleta-abt-isi", usul.nilaiLabel));
        sanding.appendChild(usulBaris);
      }
      kartu.appendChild(sanding);

      if (usul && usul.kutipan) {
        const kutip = buatElemen("div", "aleta-abt-kutipan");
        kutip.appendChild(buatElemen("span", "aleta-abt-asal", "Posita"));
        kutip.appendChild(buatElemen("span", "aleta-abt-kalimat", usul.kutipan));
        kartu.appendChild(kutip);
      }
      if (usul && usul.alasan) kartu.appendChild(buatElemen("div", "aleta-abt-catatan", usul.alasan));

      wadah.appendChild(kartu);
      if (usul && usul.nilai) {
        pilihanTerap.push({ kunci: medan.kunci, nilai: usul.nilai, label: medan.label, centang });
      }
    }

    const terapAlasan = buatElemen("button", "aleta-permintaan-tombol", "Isikan yang dicentang");
    terapAlasan.type = "button";
    const hasilAlasan = buatElemen("div", "aleta-abt-kabar");
    wadah.appendChild(terapAlasan);
    wadah.appendChild(hasilAlasan);

    terapAlasan.addEventListener("click", async () => {
      const dipilih = pilihanTerap.filter((x) => x.centang.checked);
      // Isi kotak dibaca SEKARANG, bukan petikan semula: tanpa itu suntingan
      // petugas hilang tanpa satu pun tanda, dan yang masuk borang justru yang
      // sudah ia perbaiki.
      const dipetik = petikanTerap.filter((x) => x.centang.checked && x.nilai());
      if (dipilih.length === 0 && dipetik.length === 0) {
        hasilAlasan.textContent = "Tidak ada yang dicentang.";
        return;
      }
      terapAlasan.disabled = true;
      const gagal = [];
      let berhasil = 0;

      for (const satu of dipilih) {
        hasilAlasan.textContent = `Memilih ${satu.label}…`;
        const hasil = await kirimKeJembatan({
          jenis: "isi",
          penunjuk: satu.kunci,
          jenisMedan: "pilih",
          nilai: satu.nilai,
        });
        if (hasil && hasil.ok) berhasil += 1;
        else gagal.push(`${satu.label}: ${(hasil && hasil.alasan) || "tidak terisi"}`);
      }

      for (const satu of dipetik) {
        hasilAlasan.textContent = `Mengisi ${satu.label}…`;
        // "tanggal" - jembatan yang juga menyentuh datepicker jQuery UI.
        // Menyetel value saja membuat tampilannya berubah sementara tanggal
        // yang dipegang datepicker tetap yang lama.
        const hasil = await kirimKeJembatan({
          jenis: "isi",
          penunjuk: satu.kunci,
          jenisMedan: satu.jenisMedan,
          nilai: satu.nilai(),
        });
        if (hasil && hasil.ok) berhasil += 1;
        else gagal.push(`${satu.label}: ${(hasil && hasil.alasan) || "tidak terisi"}`);
      }

      terapAlasan.disabled = false;
      hasilAlasan.className = gagal.length ? "aleta-abt-kabar aleta-abt-gagal" : "aleta-abt-kabar";
      hasilAlasan.textContent = gagal.length
        ? `${berhasil} terisi, ${gagal.length} gagal: ${gagal.join("; ")}`
        : `${berhasil} alasan terisi. Periksa seluruhnya, lalu tekan Simpan sendiri.`;
    });

    tombol.disabled = false;
  });

  return kotak;
}

/**
 * perkara_id sebagaimana tertulis pada borang SIPP yang sedang terbuka.
 *
 * Borang Putusan Akhir harus membawanya - tanpa itu SIPP sendiri tidak tahu
 * putusan ini milik perkara yang mana. Membacanya di sini menghemat satu
 * pertanyaan ke SIPP lewat gerbang, yang jawabannya menghitung seluruh
 * keadaan perkara padahal yang dibutuhkan satu angka.
 *
 * Kosong bukan kegagalan: portal menanyakannya sendiri bila tidak disebut.
 */
function perkaraIdDariHalaman() {
  const pola = 'input[name="perkara_id"], input#perkara_id, input[name="perkaraId"]';
  const borang = document.querySelector("#frm_putusan");
  const medan = (borang && borang.querySelector(pola)) || document.querySelector(pola);
  return medan && medan.value ? String(medan.value).trim() : "";
}

/**
 * ============================================================================
 * MENGUNGGAH PUTUSAN AKHIR DAN ANONIMISASINYA SEKALIGUS
 * ============================================================================
 *
 * Keduanya diunggah lewat tingkap "Kelola Dokumen Elektronik (E-Doc)" SIPP,
 * satu per satu: dua kali buka tingkap, dua kali pilih berkas, dua kali
 * tunggu - padahal keduanya berasal dari naskah yang sama dan dikerjakan
 * pada menit yang sama.
 *
 * Yang ditulis di sini meniru SIPP apa adanya - nama berkas, letak folder
 * menurut tanggal putusan, baris dirput_dokumen, dan antrean Direktori
 * Putusan. Lihat putusanUnggahService.js di bot untuk sumber tiap aturannya.
 *
 * PDF SAJA. SIPP menerima .doc lalu mengubahnya lewat soffice; ALETA tidak
 * menjalankan pengubah itu, sebab pengubahan yang gagal separuh
 * meninggalkan berkas rusak yang barisnya sudah terlanjur tercatat.
 */
function bagianUnggahPutusanSipp(nomorPerkara) {
  const kotak = bagian("Unggah putusan ke SIPP", "unggahPutusanSipp", true);
  const isi = kotak.isi;

  isi.appendChild(
    buatElemen(
      "div",
      "aleta-tetap-sebab",
      "Putusan akhir dan anonimisasinya diunggah sekaligus - berkas, kolom dokumen, " +
        "baris Direktori Putusan, dan antreannya. PDF saja."
    )
  );

  const pilihBerkas = (label, keterangan) => {
    const baris = buatElemen("div", "aleta-unggah-sipp-baris");
    baris.appendChild(buatElemen("div", "aleta-unggah-sipp-label", label));
    if (keterangan) baris.appendChild(buatElemen("div", "aleta-tetap-sebab", keterangan));
    const pemilih = document.createElement("input");
    pemilih.type = "file";
    pemilih.accept = ".pdf,application/pdf";
    pemilih.className = "aleta-berkas";
    baris.appendChild(pemilih);
    isi.appendChild(baris);
    return pemilih;
  };

  const pilihPutusan = pilihBerkas("Putusan akhir", "Tersimpan di resources/file/doc menurut tanggal putusannya.");
  const pilihAnonim = pilihBerkas(
    "Putusan anonimisasi",
    "Tersimpan di resources/file/anonimisasi. Inilah yang terbit di Direktori Putusan."
  );

  const tombol = buatElemen("button", "aleta-permintaan-tombol", "Unggah ke SIPP");
  tombol.type = "button";
  const kabar = buatElemen("div", "aleta-abt-kabar");
  isi.appendChild(tombol);
  isi.appendChild(kabar);

  tombol.addEventListener("click", async () => {
    const berkasPutusan = pilihPutusan.files && pilihPutusan.files[0];
    const berkasAnonim = pilihAnonim.files && pilihAnonim.files[0];
    if (!berkasPutusan && !berkasAnonim) {
      kabar.className = "aleta-abt-kabar";
      kabar.textContent = "Belum ada berkas yang dipilih.";
      return;
    }

    tombol.disabled = true;
    kabar.className = "aleta-abt-kabar";
    kabar.textContent = "Mengunggah…";

    let jawab;
    try {
      const badan = new FormData();
      badan.append("perkaraId", perkaraIdDariHalaman());
      badan.append("nomorPerkara", nomorPerkara || "");
      badan.append("olehUsername", namaPenggunaSipp() || "");
      if (berkasPutusan) badan.append("putusan", berkasPutusan);
      if (berkasAnonim) badan.append("anonimisasi", berkasAnonim);
      const respons = await alatAmbil(
        ALETA_API_UNGGAH_SIPP,
        { method: "POST", body: badan, credentials: "include", batasMs: BATAS_UNGGAH_SIPP_MS },
        "Mengunggah putusan ke SIPP"
      );
      if (!respons.ok) {
        throw new Error(alatPesanGagal(null, respons.status, "Mengunggah putusan ke SIPP"));
      }
      const luar = await respons.json();
      jawab = luar && luar.data ? luar.data : luar;
    } catch (galat) {
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent = String((galat && galat.message) || galat);
      tombol.disabled = false;
      return;
    }

    tombol.disabled = false;
    if (!jawab || !jawab.ok) {
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent =
        (jawab && (jawab.sebab || jawab.pesan || jawab.alasan)) ||
        "Unggahannya tidak dapat dikerjakan.";
      return;
    }

    // Tiap berkas dilaporkan sendiri-sendiri. Satu yang gagal di antara dua
    // bukan "gagal" - yang satunya sudah benar-benar tertulis ke SIPP.
    const rinci = buatElemen("div", "aleta-unggah-rinci");
    for (const b of jawab.berkas || []) {
      const baris = buatElemen("div", "aleta-unggah-baris");
      baris.appendChild(
        buatElemen("span", "aleta-unggah-judul", b.jenis === "anonimisasi" ? "Anonimisasi" : "Putusan akhir")
      );
      baris.appendChild(
        buatElemen(
          "span",
          b.ok ? "aleta-unggah-jumlah" : "aleta-unggah-kosong",
          b.ok ? b.jalur : `${b.alasan}${b.pesan ? ` — ${b.pesan}` : ""}`
        )
      );
      rinci.appendChild(baris);
    }
    kabar.textContent = jawab.antrean
      ? "Terunggah, dan perkara ini masuk antrean Direktori Putusan."
      : "Terunggah. Perkara ini sudah ada di antrean Direktori Putusan sebelumnya.";
    isi.appendChild(rinci);

    // ======================================================================
    // HALAMAN PERKARA DIBUKA KEMBALI - DAN HANYA BILA ADA YANG SUNGGUH MASUK
    // ======================================================================
    //
    // Kolom dokumen pada borang putusan baru memperlihatkan berkasnya sesudah
    // halaman dibaca ulang; tanpa itu petugas melihat kolom kosong tepat
    // sesudah diberi tahu berkasnya terunggah, dan menduga unggahannya gagal.
    //
    // muatUlangHalamanPerkara, BUKAN location.reload(): halaman borang SIPP
    // dibuka lewat sesi kilat, dan memuat ulangnya mendaratkan petugas di
    // dasbor - jauh dari perkara yang sedang dikerjakannya.
    //
    // Tidak dijalankan bila tidak satu berkas pun masuk: memuat ulang halaman
    // hanya akan menghapus pesan yang menerangkan kenapa ia gagal.
    const adaYangMasuk = (jawab.berkas || []).some((b) => b.ok);
    if (adaYangMasuk) {
      kabar.textContent += " Halaman perkara dibuka kembali…";
      setTimeout(muatUlangHalamanPerkara, 1500);
    }
  });

  return kotak;
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
 */

/**
 * Tombol Simpan pada borang putusan SIPP.
 *
 * Tiga penunjuk, dicoba berurutan. Yang pertama paling tepat; dua sisanya
 * menjaga bila SIPP satker lain menamainya berbeda. Tidak ada yang menebak
 * dari tulisan tombolnya - "Simpan" juga nama tombol pada belasan borang lain
 * di halaman yang sama.
 */
const PENUNJUK_SIMPAN_PUTUSAN = [
  "#frm_putusan #simpan",
  "#frm_putusan input[type='submit']",
  "#simpan",
];

/** Keadaan putusan yang SEGAR - tanpa simpanan, sebab inilah yang dibandingkan. */
async function bacaPutusanSegar(nomorPerkara) {
  try {
    const respons = await alatAmbil(
      `${ALETA_API_STATUS}?nomor=${encodeURIComponent(nomorPerkara)}`,
      { credentials: "include", cache: "no-store" },
      "Membaca keadaan putusan"
    );
    if (!respons.ok) return null;
    const hasil = await respons.json();
    const isi = hasil?.data ?? hasil;
    const status = isi?.status;
    if (!status) return null;
    const p = status.putusan || {};
    const lengkap = status.putusanLengkap || {};
    return {
      sudahPutus: Boolean(p.sudahPutus),
      tanggal: String(lengkap.tanggalPutusan || p.tanggalPutusan || ""),
      status: String(lengkap.statusPutusan || ""),
    };
  } catch {
    // Tidak terbaca bukan "belum tersimpan" - dua keadaan yang berbeda, dan
    // menyamakannya membuat putusan yang benar-benar masuk dilaporkan gagal.
    return null;
  }
}

function samaPutusan(a, b) {
  if (!a || !b) return false;
  return a.sudahPutus === b.sudahPutus && a.tanggal === b.tanggal && a.status === b.status;
}

/**
 * Menekan Simpan, menunggu SIPP benar-benar mencatatnya, lalu membuka kembali
 * halaman perkaranya.
 *
 * @returns {Promise<{ok: boolean, bunyi: string}>}
 */
async function simpanPutusanLaluBuka(nomorPerkara, kabar) {
  const sebelum = await bacaPutusanSegar(nomorPerkara);

  let ditekan = null;
  for (const penunjuk of PENUNJUK_SIMPAN_PUTUSAN) {
    ditekan = await kirimKeJembatan({ jenis: "tekan", penunjuk });
    if (ditekan && ditekan.ok) break;
  }
  if (!ditekan || !ditekan.ok) {
    return {
      ok: false,
      bunyi:
        "Isiannya sudah masuk borang, tetapi tombol Simpan SIPP tidak ditemukan di halaman ini - " +
        "tekan Simpan sendiri.",
    };
  }

  // SubmitHandling mengirim lewat AJAX; tidak ada satu pun peristiwa yang
  // dapat ditunggu dari luar. Yang ditunggu karena itu AKIBATNYA di basis
  // data - sepuluh kali, sedetik sekali.
  if (kabar) kabar.textContent = "Simpan ditekan - menunggu SIPP mencatatnya…";
  for (let ke = 0; ke < 10; ke += 1) {
    await new Promise((selesai) => setTimeout(selesai, 1000));
    const sesudah = await bacaPutusanSegar(nomorPerkara);
    if (!sesudah) continue;
    // Berubah berarti tersimpan. Perkara yang belum pernah diputus berubah
    // dari sudahPutus=false; yang diperbaiki berubah tanggal atau statusnya.
    if (!samaPutusan(sebelum, sesudah) || (!sebelum && sesudah.sudahPutus)) {
      if (kabar) kabar.textContent = "Tersimpan di SIPP. Halaman perkara dibuka kembali…";
      setTimeout(muatUlangHalamanPerkara, 900);
      return { ok: true, bunyi: "Tersimpan di SIPP." };
    }
  }

  return {
    ok: false,
    bunyi:
      "Simpan sudah ditekan, tetapi sesudah sepuluh detik SIPP belum mencatat perubahan apa pun. " +
      "Periksa borangnya - biasanya ada isian wajib yang ditolak SIPP. Halaman TIDAK dimuat ulang " +
      "supaya isian yang sudah masuk tidak hilang.",
  };
}

/**
 * ============================================================================
 * PRAPERIKSA PUTUSAN - AGEN YANG MEMBACA DAN BERHENTI (Tahap 2 rencana agen)
 * ============================================================================
 *
 * Tepat sebelum borang Putusan Akhir diisi dari draf ALETA, agen membaca
 * fakta SIPP - jadwal sidang, majelis, pihak, putusan yang sudah ada,
 * petitum - dan mengadunya dengan draf serta isian borang: tanggal putusan
 * yang diketik petugas, Status Putusan, verstek. Seluruh penimbangannya di
 * portal (src/lib/praperiksa-putusan.ts), di tempat yang dapat diuji; di
 * sini hanya membaca borang, meminta rapor, menggambarnya, dan BERHENTI.
 *
 * Tiga tingkat: hentikan (pertentangan yang dibuktikan dari SIPP - Isikan
 * mati, antrean menandai perkaranya ditahan), perhatian (tidak dapat
 * dipastikan mesin), catatan (apa yang diperiksa dan apa yang tidak dapat).
 * Tidak ada yang diperbaiki sendiri. Agen ini membaca; orang yang memutuskan.
 *
 * Yang tidak dapat diminta - portal tidak menjawab - DISEBUT, bukan
 * didiamkan: rapor yang kosong akan dibaca sebagai rapor yang lolos.
 */
const PENUNJUK_TANGGAL_PUTUSAN = ["#tgl_putusan", 'input[name="tgl_putusan"]', 'input[name="tanggal_putusan"]'];

/** Isian borang yang HANYA ada di halaman: tanggal putusan, status, verstek. */
async function bacaUsulanBorangPutusan() {
  let tanggalPutusan = "";
  for (const penunjuk of PENUNJUK_TANGGAL_PUTUSAN) {
    const jawab = await kirimKeJembatan({ jenis: "nilai", penunjuk });
    if (jawab && jawab.ok) {
      tanggalPutusan = String(jawab.nilai || "");
      break;
    }
  }
  const terpilih = async (penunjuk) => {
    const jawab = await kirimKeJembatan({ jenis: "pilihan", penunjuk });
    if (!jawab || !jawab.ok) return { nilai: "", label: "" };
    const nilai = String(jawab.nilaiSekarang || "");
    const pilihan = (jawab.pilihan || []).find((x) => String(x.nilai) === nilai);
    return { nilai, label: pilihan ? String(pilihan.label || "") : "" };
  };
  const status = await terpilih('select[name="status_putusan"]');
  const verstek = await terpilih('select[name="verstek"]');
  return {
    tanggalPutusan,
    // "-1" adalah "Pilih Status Putusan" - belum dipilih, bukan status.
    statusPutusan: status.nilai === "-1" ? "" : status.label,
    // Borang SIPP menulis Y/T pada nilainya sendiri (edit_putusan_akhir.php).
    verstek: verstek.nilai === "Y" || verstek.nilai === "T" ? verstek.nilai : "",
  };
}

/** Meminta rapor praperiksa dari ALETA. Melempar bila ALETA tidak menjawab. */
async function mintaPraperiksaPutusan(nomorPerkara, usulan) {
  const respons = await alatAmbil(
    ALETA_API_PRAPERIKSA_PUTUSAN,
    {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nomorPerkara: nomorPerkara || "", ...(usulan || {}) }),
    },
    "Praperiksa putusan"
  );
  if (!respons.ok) throw new Error(alatPesanGagal(null, respons.status, "Praperiksa putusan"));
  const luar = await respons.json();
  return luar && luar.data ? luar.data : luar;
}

/** Judul-judul yang menahan, dalam satu kalimat - untuk catatan antrean dan kotak hitam. */
function ringkasHentikan(rapor) {
  return ((rapor && rapor.temuan) || [])
    .filter((t) => t.tingkat === "hentikan")
    .map((t) => t.judul)
    .join("; ");
}

/** Menggambar rapor agen: yang menahan di atas, perhatian di tengah, catatan di bawah. */
function gambarRaporAgen(rapor) {
  const kotak = buatElemen("div", "aleta-praperiksa aleta-praperiksa-agen");
  const kepala = buatElemen("div", "aleta-praperiksa-kepala");
  kepala.appendChild(buatElemen("span", "aleta-praperiksa-judul-agen", "Praperiksa ALETA"));
  kepala.appendChild(
    buatElemen(
      "span",
      `aleta-praperiksa-ringkas${rapor.hentikan ? " aleta-praperiksa-ringkas-henti" : ""}`,
      rapor.ringkas || ""
    )
  );
  kotak.appendChild(kepala);

  for (const t of rapor.temuan || []) {
    const kelas =
      t.tingkat === "hentikan"
        ? "aleta-praperiksa-henti"
        : t.tingkat === "perhatian"
        ? "aleta-praperiksa-ganjal"
        : "aleta-praperiksa-catatan";
    const baris = buatElemen("div", kelas);
    baris.appendChild(buatElemen("span", "aleta-praperiksa-judul", t.judul || ""));
    if (t.rincian) baris.appendChild(buatElemen("span", "aleta-praperiksa-rincian", t.rincian));
    kotak.appendChild(baris);
  }
  if (!(rapor.temuan || []).length) {
    kotak.appendChild(buatElemen("div", "aleta-praperiksa-catatan", "Tidak ada temuan."));
  }
  return kotak;
}

/**
 * Menjalankan praperiksa dan menggambarnya ke wadah. Pulang rapornya, atau
 * null bila tidak dapat diminta - dan ketidakdapatan itu ikut digambar.
 */
async function jalankanPraperiksaPanel(nomorPerkara, wadah) {
  const tempat = buatElemen("div", "aleta-praperiksa-tempat");
  tempat.appendChild(buatElemen("div", "aleta-memuat", "Praperiksa: membaca fakta SIPP dan mengadunya dengan draf…"));
  wadah.appendChild(tempat);
  try {
    const usulan = await bacaUsulanBorangPutusan();
    const rapor = await mintaPraperiksaPutusan(nomorPerkara, usulan);
    tempat.textContent = "";
    if (!rapor || !rapor.ada) {
      tempat.appendChild(
        buatElemen(
          "div",
          "aleta-praperiksa-catatan",
          `Praperiksa tidak dijalankan: ${(rapor && rapor.sebab) || "tidak ada jawaban"}.`
        )
      );
      return null;
    }
    tempat.appendChild(gambarRaporAgen(rapor));
    alatCatat("praperiksa", `${nomorPerkara}: ${rapor.ringkas}`, ringkasHentikan(rapor));
    return rapor;
  } catch (galat) {
    tempat.textContent = "";
    tempat.appendChild(
      buatElemen(
        "div",
        "aleta-praperiksa-ganjal",
        `Praperiksa tidak dapat diminta: ${String((galat && galat.message) || galat)}. ` +
          "Tidak ada yang diperiksa - ini bukan tanda lolos."
      )
    );
    return null;
  }
}

/**
 * Praperiksa untuk alur massal - tanpa wadah gambar; rapornya dipulangkan
 * dan yang menahan dituliskan pemanggil ke catatan antrean.
 *
 * Tidak dapat diminta bukan lolos, tetapi juga bukan pertentangan: dicatat
 * di kotak hitam, dan antrean berjalan seperti sebelum agen ini ada.
 */
async function praperiksaSebelumMengisi(nomorPerkara, kabar) {
  if (kabar) kabar.textContent = "Praperiksa: mengadu draf dengan fakta SIPP…";
  try {
    const usulan = await bacaUsulanBorangPutusan();
    const rapor = await mintaPraperiksaPutusan(nomorPerkara, usulan);
    if (!rapor || !rapor.ada) {
      alatCatat("praperiksa", `${nomorPerkara}: tidak dijalankan - ${(rapor && rapor.sebab) || "tidak ada jawaban"}`, "");
      return null;
    }
    alatCatat("praperiksa", `${nomorPerkara}: ${rapor.ringkas}`, ringkasHentikan(rapor));
    return rapor;
  } catch (galat) {
    alatCatat("praperiksa", `${nomorPerkara}: tidak dapat diminta - ${String((galat && galat.message) || galat)}`, "");
    return null;
  }
}

function bagianIsiPutusan(nomorPerkara) {
  const kotak = bagian("Putusan otomatis", "isiPutusan", true);
  const isi = kotak.isi;

  const terang = buatElemen(
    "div",
    "aleta-tetap-sebab",
    "Mengambil draf putusan ALETA yang terbaru untuk perkara ini, lalu mengisikan " +
      "Pertimbangan Hukum, Amar, dan Amar Anonim ke formulir di halaman ini. Sesudah " +
      "SELURUH yang dicentang terisi, Simpan ditekan sendiri dan halaman perkara dibuka " +
      "kembali - tetapi hanya setelah SIPP terbukti mencatatnya. Satu isian gagal berarti " +
      "Simpan tidak ditekan sama sekali."
  );
  isi.appendChild(terang);

  const tombol = buatElemen("button", "aleta-permintaan-tombol", "Ambil usulan dari ALETA");
  tombol.type = "button";
  const kabar = buatElemen("div", "aleta-abt-kabar");
  const wadah = buatElemen("div", "aleta-isian-putusan");
  isi.appendChild(tombol);
  isi.appendChild(kabar);

  // ========================================================================
  // NASKAH YANG SUDAH JADI, DITERIMA APA ADANYA
  // ========================================================================
  //
  // Draf ALETA yang dirakit dari fakta adalah jalan yang seharusnya, tetapi
  // hari ini naskah putusan masih ditulis hakim di templat satker. Menyuruh
  // menyalin pertimbangan 8.000 aksara ke CKEditor dengan tangan - lalu
  // amarnya, lalu amar anonimnya - bukan otomisasi apa pun.
  //
  // RTF, BUKAN PDF. Keduanya memuat naskah yang sama, tetapi PDF memecah
  // tiap paragraf menjadi baris cetak dan menyelipkan perabot halamannya
  // ke tengah naskah. Diukur pada satu putusan yang sama: RTF 151 paragraf
  // utuh, PDF 417 potongan baris. Menyambungnya kembali menuntut terkaan,
  // dan terkaan yang salah menyambung satu pertimbangan ke pertimbangan
  // berikutnya. Portal menolak PDF beserta sebabnya, bukan diam-diam.
  const kotakUnggah = buatElemen('div', 'aleta-unggah-naskah');
  kotakUnggah.appendChild(
    buatElemen(
      "div",
      "aleta-tetap-sebab",
      "Belum ada drafnya? Ambil dari naskah putusan yang sudah Anda tulis - berkas RTF-nya, bukan PDF."
    )
  );
  const kakiUnggah = buatElemen('div', 'aleta-tetap-kaki');
  const pemilih = document.createElement("input");
  pemilih.type = "file";
  pemilih.accept = ".rtf,.txt";
  pemilih.className = "aleta-berkas";
  kakiUnggah.appendChild(pemilih);
  kotakUnggah.appendChild(kakiUnggah);
  // Ringkasan panjang tiap bagian punya wadahnya SENDIRI, bukan wadah usulan.
  // Pembacaan usulan mengosongkan wadahnya lebih dulu, sehingga ringkasan yang
  // ditaruh di sana akan terhapus sepersekian detik sesudah ditulis - tepat
  // ketika yang membacanya sedang memeriksa apakah potongannya masuk akal.
  const wadahUnggah = buatElemen("div", "aleta-unggah-hasil");
  kotakUnggah.appendChild(wadahUnggah);
  isi.appendChild(kotakUnggah);

  pemilih.addEventListener('change', async () => {
    const berkas = pemilih.files && pemilih.files[0];
    if (!berkas) return;
    pemilih.disabled = true;
    tombol.disabled = true;
    wadah.textContent = "";
    wadahUnggah.textContent = "";
    kabar.className = "aleta-abt-kabar";
    kabar.textContent = `Membaca ${berkas.name}…`;

    let jawab;
    try {
      const badan = new FormData();
      badan.append("berkas", berkas);
      badan.append("nomorPerkara", nomorPerkara || "");
      badan.append("perkaraId", perkaraIdDariHalaman());
      const respons = await alatAmbil(
        ALETA_API_UNGGAH_NASKAH,
        {
          method: "POST",
          body: badan,
          credentials: "include",
          batasMs: BATAS_UNGGAH_NASKAH_MS,
        },
        "Mengirim naskah putusan"
      );
      if (!respons.ok) {
        throw new Error(alatPesanGagal(null, respons.status, "Mengirim naskah putusan"));
      }
      const luar = await respons.json();
      jawab = luar && luar.data ? luar.data : luar;
    } catch (galat) {
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent = String((galat && galat.message) || galat);
      pemilih.disabled = false;
      tombol.disabled = false;
      return;
    }

    pemilih.disabled = false;
    tombol.disabled = false;
    pemilih.value = "";

    if (!jawab || !jawab.ok) {
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent = (jawab && jawab.sebab) || "Naskahnya tidak dapat dibaca.";
      return;
    }

    // Panjang tiap bagian diperlihatkan SEBELUM apa pun diisikan. Bagian
    // yang terpotong salah hampir selalu kelihatan dari panjangnya - amar
    // 8.000 aksara berarti pertimbangan ikut terbawa ke dalamnya.
    const rinci = buatElemen('div', 'aleta-unggah-rinci');
    for (const b of jawab.bagian || []) {
      const baris = buatElemen('div', 'aleta-unggah-baris');
      baris.appendChild(buatElemen('span', 'aleta-unggah-judul', b.judul));
      baris.appendChild(
        buatElemen(
          'span',
          b.aksara ? 'aleta-unggah-jumlah' : 'aleta-unggah-kosong',
          b.aksara ? `${b.aksara.toLocaleString('id-ID')} aksara` : (b.halangan || 'kosong')
        )
      );
      rinci.appendChild(baris);
    }
    wadahUnggah.textContent = '';
    wadahUnggah.appendChild(rinci);

    kabar.className = "aleta-abt-kabar";
    kabar.textContent =
      `Draf v${jawab.versi} tersimpan dari ${berkas.name}. ` +
      (jawab.perabotDibuang
        ? `${jawab.perabotDibuang} baris perabot halaman dibuang. `
        : "") +
      "Mengambil usulannya…";

    // Langsung disambung ke pembacaan usulan - yang mengunggah naskah
    // memang hendak mengisikannya, bukan hendak berhenti di sini.
    tombol.click();
  });

  isi.appendChild(wadah);

  /** Satu baris usulan: judul, cuplikan, dan centang. */
  function barisIsian(judul, penunjuk, teks, keterangan) {
    const baris = buatElemen("div", "aleta-abt-kartu");
    const kepala = buatElemen("div", "aleta-abt-kartu-kepala");
    const centang = document.createElement("input");
    centang.type = "checkbox";
    centang.className = "aleta-abt-centang";
    centang.checked = Boolean(teks);
    centang.disabled = !teks;
    kepala.appendChild(centang);
    kepala.appendChild(buatElemen("span", "aleta-abt-nama", judul));
    baris.appendChild(kepala);

    if (keterangan) baris.appendChild(buatElemen("div", "aleta-abt-catatan", keterangan));

    // ======================================================================
    // YANG DIISIKAN ADALAH YANG TERBACA DI SINI, BUKAN YANG DIUSULKAN
    // ======================================================================
    //
    // Sebelumnya usulannya hanya dapat diterima atau ditolak seluruhnya.
    // Satu kata yang keliru pada pertimbangan 8.000 aksara berarti seluruh
    // usulannya dibatalkan, lalu disalin tangan dari naskahnya - pekerjaan
    // yang justru hendak dihapus alat ini.
    //
    // Sekarang teksnya disunting di tempat. Yang dikirim ke borang SIPP
    // adalah isi kotak ini apa adanya, sehingga tidak pernah ada selisih
    // antara yang dibaca petugas dan yang tersimpan.
    const sunting = document.createElement("textarea");
    sunting.className = "aleta-abt-isi aleta-sunting";
    sunting.value = teks || "";
    sunting.rows = teks && teks.length > 400 ? 8 : 4;
    sunting.spellcheck = false;
    if (!teks) {
      sunting.placeholder = "(kosong pada draf - boleh diisi sendiri)";
      sunting.classList.add("aleta-abt-isi-kosong");
    }
    // Menyunting yang tadinya kosong berarti memang hendak memakainya.
    sunting.addEventListener("input", () => {
      const ada = sunting.value.trim().length > 0;
      centang.disabled = !ada;
      if (!ada) centang.checked = false;
    });
    baris.appendChild(sunting);

    return {
      baris,
      centang,
      penunjuk,
      judul,
      // Dibaca saat ditekan, bukan saat digambar.
      get teks() {
        return sunting.value;
      },
    };
  }

  // ────────────────────────────────────────────────────────────────────
  // MEDAN PILIHAN - BERBEDA MENURUT JENIS PERKARA DAN STATUS PUTUSAN
  // ────────────────────────────────────────────────────────────────────
  //
  // Perkara cerai yang dikabulkan menuntut faktor perceraian, nusyuz, qobla,
  // dan kadang keadaan istri. Dispensasi kawin menuntut alasan pengajuan -
  // hamil, pergaulan bebas, dan seterusnya. Izin poligami, itsbat, dan
  // pembatalan perkawinan masing-masing punya daftarnya sendiri.
  //
  // Tidak satu pun aturan itu disalin ke sini. Yang dikerjakan: menanyakan
  // kepada HALAMAN medan mana yang sedang tampak beserta daftar pilihannya,
  // lalu meminta ALETA memilih satu berdasarkan bunyi putusan. Medan yang
  // disembunyikan SIPP tidak pernah ditawarkan, dan itu sebabnya panel ini
  // tidak perlu tahu satu pun nomor jenis perkara.
  //
  // Penunjuknya berbasis NAMA, bukan id, dan itu bukan selera. Pada borang
  // SIPP yang ini, select "status_reskom" memakai id="faktor_cerai" - id
  // yang sama dengan select faktor perceraian. querySelector("#faktor_cerai")
  // memulangkan yang mana pun yang lebih dulu di dokumen, dan pada hari
  // urutannya berubah, faktor perceraian akan terisi dengan hasil reskom
  // tanpa satu pun tanda. Nama medan tidak kembar, dan namanya pula yang
  // dikirim ke peladen.
  //
  // URUTANNYA BUKAN SELERA. Status Putusan berdiri paling depan sebab ia
  // yang MENENTUKAN medan mana saja yang muncul sesudahnya: sebelum ia
  // dipilih, SIPP menyembunyikan faktor perceraian, nusyuz, qobla, dan
  // keadaan istri seluruhnya. Itu pula sebab bagian ini dulu tampak tidak
  // mengusulkan apa-apa - yang dibaca hanya medan yang kebetulan sudah
  // tampak, dan pada borang yang baru dibuka memang tidak ada satu pun.
  //
  // template_amar SENGAJA TIDAK ADA DI SINI. Ia bukan keterangan perkara
  // melainkan pemilih templat yang MENIMPA isi Amar begitu dipilih -
  // menimpa amar yang baru saja diisikan dari naskah putusan yang
  // sesungguhnya. Yang hendak memakai templat memilihnya sendiri.
  const CALON_MEDAN_PANEL = [
    { penunjuk: 'select[name="status_putusan"]', label: "Status Putusan" },
    { penunjuk: 'select[name="verstek"]', label: "Putusan Verstek" },
    { penunjuk: 'input[name="sumber_hukum[]"]', label: "Sumber Hukum", banyak: true },
    { penunjuk: 'select[name="faktor_cerai"]', label: "Faktor Penyebab Perceraian" },
    { penunjuk: 'select[name="faktor_cerai_sekunder"]', label: "Faktor Penyebab Perceraian (Sekunder)" },
    { penunjuk: 'input[name="status_nusyuz"]', label: "Status Nusyuz" },
    { penunjuk: 'select[name="qobla"]', label: "Qobla/Ba'da Dukhul" },
    { penunjuk: 'select[name="keadaan_istri"]', label: "Keadaan Istri" },
    { penunjuk: 'select[name="alasan_dispen"]', label: "Alasan Pengajuan Dispensasi Kawin" },
    { penunjuk: 'select[name="akad_syariah_primer"]', label: "Jenis Akad Syariah" },
    { penunjuk: 'select[name="status_reskom"]', label: "Hasil Reskom" },
    { penunjuk: 'select[name="pengakhiran_id"]', label: "Jenis Pengakhiran" },
  ];

  /**
   * Berapa medan pilihan yang SEDANG tampak di borang.
   *
   * Dipakai mengenali borang yang berubah bentuk sesudah sebagian isinya
   * dipilih - lihat catatan pada pembacaan ulang di bawah. Yang dihitung
   * hanya jumlahnya; daftar lengkapnya dibaca ulang oleh pembacaan itu
   * sendiri, dan membacanya dua kali di sini hanya menggandakan kerja.
   */
  /**
   * ==========================================================================
   * MEDAN YANG MENGUBAH BENTUK BORANG
   * ==========================================================================
   *
   * Memilih Status Putusan membuat SIPP memunculkan medan yang sebelumnya
   * tidak ada di halaman sama sekali: faktor perceraian, nusyuz, qobla,
   * keadaan isteri. Memilih Qobla menentukan muncul-tidaknya keadaan isteri
   * lagi. Keduanya bukan keterangan biasa - keduanya PINTU.
   *
   * Selama pintunya tertutup, medan di baliknya tidak dapat dibaca, tidak
   * dapat diusulkan, dan tidak dapat dicentang. Panel karena itu membukanya
   * sendiri: usulan pintunya diterapkan lebih dulu, borangnya dibiarkan
   * menggambar ulang, lalu isinya dibaca. Yang di baliknya ikut ditawarkan
   * dalam satu daftar, sekali tekan.
   *
   * Yang diterapkan HANYA pintunya, dan hanya bila ALETA memang
   * mengusulkannya. Sisanya tetap menunggu petugas mencentang - tidak ada
   * satu pun medan lain yang tersentuh sebelum tombol Isikan ditekan.
   */
  const MEDAN_PINTU = ['select[name="status_putusan"]', 'select[name="qobla"]'];

  /** Membaca seluruh medan yang SEDANG tampak, beserta pilihannya. */
  async function bacaMedanTampak() {
    const hasil = [];
    for (const calon of CALON_MEDAN_PANEL) {
      const jawabPilihan = await kirimKeJembatan({ jenis: "pilihan", penunjuk: calon.penunjuk });
      if (!jawabPilihan || !jawabPilihan.ok || !jawabPilihan.tampak) continue;
      const pilihan = (jawabPilihan.pilihan || []).map((x) => ({ nilai: x.nilai, label: x.label }));
      if (pilihan.length === 0) continue;
      hasil.push({
        kunci: calon.penunjuk,
        label: calon.label,
        pilihan,
        banyak: Boolean(calon.banyak),
        nilaiSekarang: jawabPilihan.nilaiSekarang || "",
      });
    }
    return hasil;
  }

  /** Meminta ALETA mengusulkan nilai untuk sekumpulan medan. */
  async function mintaUsulanMedan(daftar, jenisPerkara) {
    if (daftar.length === 0) return [];
    const respons = await alatAmbil(
      ALETA_API_ISIAN_PUTUSAN,
      {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nomorPerkara: nomorPerkara || "",
          jenisPerkara: jenisPerkara || "",
          medan: daftar.map((x) => ({
            kunci: x.kunci,
            label: x.label,
            pilihan: x.pilihan,
            banyak: x.banyak,
          })),
        }),
      },
      "Menyusun usulan pilihan"
    );
    if (!respons.ok) throw new Error(alatPesanGagal(null, respons.status, "Menyusun usulan pilihan"));
    const luar = await respons.json();
    const isiUsulan = luar && luar.data ? luar.data : luar;
    return (isiUsulan && isiUsulan.usulan) || [];
  }

  async function hitungMedanTampak() {
    let jumlah = 0;
    for (const calon of CALON_MEDAN_PANEL) {
      const jawab = await kirimKeJembatan({ jenis: "pilihan", penunjuk: calon.penunjuk });
      if (jawab && jawab.ok && jawab.tampak && (jawab.pilihan || []).length > 0) jumlah += 1;
    }
    return jumlah;
  }

  // Rapor praperiksa terakhir untuk perkara ini. Dibaca lagi saat Isikan
  // ditekan: yang menahan MENAHAN sampai orang menyatakan sudah membacanya.
  let raporAgen = null;

  tombol.addEventListener("click", async () => {
    tombol.disabled = true;
    wadah.textContent = "";
    kabar.className = "aleta-abt-kabar";
    kabar.textContent = "Membaca draf putusan…";

    let jawab;
    try {
      const respons = await alatAmbil(
        `${ALETA_API_ISIAN_PUTUSAN}?nomorPerkara=${encodeURIComponent(nomorPerkara || "")}`,
        { credentials: "include", cache: "no-store" },
        "Membaca draf putusan"
      );
      if (!respons.ok) throw new Error(alatPesanGagal(null, respons.status, "Membaca draf putusan"));
      const luar = await respons.json();
      jawab = luar && luar.data ? luar.data : luar;
    } catch (galat) {
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent = String((galat && galat.message) || galat);
      tombol.disabled = false;
      return;
    }

    if (!jawab || !jawab.ada) {
      kabar.className = "aleta-abt-kabar";
      kabar.textContent = (jawab && jawab.sebab) || "Belum ada draf putusan untuk perkara ini.";
      tombol.disabled = false;
      return;
    }

    kabar.textContent = `Draf versi ${jawab.versi} (${jawab.keadaan}).`;

    // Praperiksa lebih dulu daripada usulan isian: yang membaca panel ini
    // harus melihat pertentangannya SEBELUM melihat tombol Isikan.
    raporAgen = await jalankanPraperiksaPanel(nomorPerkara, wadah);

    for (const satu of jawab.catatan || []) {
      wadah.appendChild(buatElemen("div", "aleta-tetap-sebab", satu));
    }
    if ((jawab.belumTerisi || []).length) {
      wadah.appendChild(
        buatElemen(
          "div",
          "aleta-gagal",
          `Belum terisi pada draf: ${jawab.belumTerisi.join(", ")}. Bagian itu tidak akan diisikan.`
        )
      );
    }

    const daftar = [
      barisIsian("Pertimbangan Hukum", "#perhum", jawab.pertimbangan, ""),
      barisIsian("Amar Putusan", "#amar", jawab.amar, ""),
      barisIsian(
        "Amar Anonim",
        "#amar_anonim",
        jawab.amarAnonim,
        (jawab.namaDisamarkan || []).length
          ? `Nama yang disamarkan: ${jawab.namaDisamarkan
              .map((x) => `${x.nama} → ${x.menjadi}`)
              .join("; ")}`
          : ""
      ),
    ];
    for (const satu of daftar) wadah.appendChild(satu.baris);


    // ======================================================================
    // PINTUNYA DIBUKA LEBIH DULU, BARU ISINYA DIBACA
    // ======================================================================
    //
    // Berputar sampai tidak ada lagi medan baru yang muncul, paling banyak
    // tiga kali - Status Putusan membuka faktor perceraian dan qobla, dan
    // qobla membuka keadaan isteri: dua pintu bersusun, tidak pernah lebih.
    // Batasnya tetap ada supaya borang yang berperilaku tak terduga tidak
    // memutar panel ini tanpa akhir.
    const jenisUntukUsulan = (jawab && jawab.jenisPerkara) || "";
    let medanTampak = [];
    let usulanMedan = [];
    const sudahDibuka = new Set();
    let gagalUsulan = null;

    for (let putaran = 0; putaran < 3; putaran += 1) {
      const terbaca = await bacaMedanTampak();
      const baru = terbaca.filter((x) => !medanTampak.some((y) => y.kunci === x.kunci));
      if (baru.length === 0) break;

      let usulanBaru = [];
      try {
        usulanBaru = await mintaUsulanMedan(baru, jenisUntukUsulan);
      } catch (galat) {
        gagalUsulan = String((galat && galat.message) || galat);
        medanTampak = terbaca;
        break;
      }
      medanTampak = terbaca;
      usulanMedan = usulanMedan.concat(usulanBaru);

      // Pintu yang BELUM dibuka dan memang diusulkan ALETA - diterapkan
      // supaya medan di baliknya ikut terbaca pada putaran berikutnya.
      let adaYangDibuka = false;
      for (const pintu of MEDAN_PINTU) {
        if (sudahDibuka.has(pintu)) continue;
        const usul = usulanBaru.find((x) => x.kunci === pintu);
        if (!usul || !usul.nilai) continue;
        const hasilIsi = await kirimKeJembatan({
          jenis: "isi",
          penunjuk: pintu,
          jenisMedan: "pilih",
          nilai: usul.nilai,
        });
        sudahDibuka.add(pintu);
        if (hasilIsi && hasilIsi.ok) adaYangDibuka = true;
      }
      if (!adaYangDibuka) break;
      // SIPP menggambar ulang bagian borangnya - diberi waktu sebentar
      // sebelum dibaca lagi.
      await new Promise((selesai) => setTimeout(selesai, 350));
    }

    const pilihanTerap = [];
    if (medanTampak.length > 0) {
      wadah.appendChild(
        buatElemen(
          "div",
          "aleta-tetap-sebab",
          `Formulir ini juga menuntut ${medanTampak.length} pilihan yang berbeda menurut jenis perkara ` +
            "dan status putusannya. Angka inilah yang kelak menjadi laporan faktor penyebab perceraian " +
            "dan statistik dispensasi - jadi periksa tiap usulan sebelum dicentang." +
            (sudahDibuka.size > 0
              ? " Status Putusan sudah dipilihkan lebih dulu supaya medan di baliknya ikut terbaca; ubah sendiri bila keliru."
              : "")
        )
      );

      // Usulannya sudah tersusun pada putaran buka-pintu di atas; yang
      // gagal disebutkan di sini, satu kali.
      if (gagalUsulan) {
        wadah.appendChild(buatElemen("div", "aleta-gagal", gagalUsulan));
      }

      for (const medan of medanTampak) {
        const usul = usulanMedan.find((x) => x.kunci === medan.kunci) || null;
        const sekarang = (medan.pilihan.find((x) => String(x.nilai) === String(medan.nilaiSekarang)) || {}).label || "";
        const kartu = buatElemen("div", "aleta-abt-kartu");

        const kepala = buatElemen("div", "aleta-abt-kartu-kepala");
        const centang = document.createElement("input");
        centang.type = "checkbox";
        centang.className = "aleta-abt-centang";
        // Yang berselisih TIDAK dicentang sendiri: justru itu yang paling
        // perlu dibaca manusia.
        centang.checked = Boolean(usul && usul.nilai) && usul.keyakinan !== "bentrok";
        // Medan tanpa usulan pun boleh diisi sendiri, jadi centangnya hanya
        // mati selama memang belum ada yang terpilih - bukan selama ALETA
        // tidak mengusulkan apa pun.
        centang.disabled = !(usul && usul.nilai);
        kepala.appendChild(centang);
        kepala.appendChild(buatElemen("span", "aleta-abt-nama", medan.label));
        const nada =
          !usul || !usul.nilai
            ? { kelas: "aleta-tanda-abu", teks: "tidak ditemukan" }
            : usul.keyakinan === "bentrok"
            ? { kelas: "aleta-tanda-merah", teks: "naskah menyebut lebih dari satu" }
            : usul.keyakinan === "pasti"
            ? { kelas: "aleta-tanda-hijau", teks: "disebut naskah" }
            : { kelas: "aleta-tanda-kuning", teks: "mendekati" };
        kepala.appendChild(buatElemen("span", `aleta-tanda ${nada.kelas}`, nada.teks));
        kartu.appendChild(kepala);

        const sanding = buatElemen("div", "aleta-abt-sanding");
        const kini = buatElemen("div", "aleta-abt-kini");
        kini.appendChild(buatElemen("span", "aleta-abt-label", "sekarang"));
        kini.appendChild(buatElemen("span", "aleta-abt-isi", sekarang || "(belum dipilih)"));
        sanding.appendChild(kini);
        if (usul && usul.nilai) {
          const usulBaris = buatElemen("div", "aleta-abt-usul");
          usulBaris.appendChild(buatElemen("span", "aleta-abt-label", "usulan"));
          usulBaris.appendChild(buatElemen("span", "aleta-abt-isi", usul.nilaiLabel));
          sanding.appendChild(usulBaris);
        }
        kartu.appendChild(sanding);

        if (usul && usul.kutipan) {
          const kutip = buatElemen("div", "aleta-abt-kutipan");
          kutip.appendChild(buatElemen("span", "aleta-abt-asal", "Putusan"));
          kutip.appendChild(buatElemen("span", "aleta-abt-kalimat", usul.kutipan));
          kartu.appendChild(kutip);
        }
        if (usul && usul.alasan) kartu.appendChild(buatElemen("div", "aleta-abt-catatan", usul.alasan));

        // ====================================================================
        // PILIHANNYA DAPAT DIGANTI DI PANEL, TANPA MENINGGALKANNYA
        // ====================================================================
        //
        // Usulan yang keliru dulu hanya dapat ditolak - lalu petugas mencari
        // medannya sendiri di borang yang panjang, sambil mengingat apa yang
        // tadi dibacanya di panel. Sekarang daftarnya ada di sini, berisi
        // pilihan yang SAMA PERSIS dengan yang ditawarkan borang, dan yang
        // terpilih di sinilah yang diisikan.
        //
        // Medan bernilai banyak memakai kotak centang, sebab memilih satu
        // dari daftar tidak pernah dapat menyatakan tiga sumber hukum.
        let bacaPilihanPanel = null;
        if (medan.banyak) {
          const kotakBanyak = buatElemen("div", "aleta-pilih-banyak");
          const terusul = new Set(
            ((usul && usul.nilaiBanyak) || []).map((x) => String(x.nilai))
          );
          const semua = [];
          for (const pil of medan.pilihan) {
            const label = buatElemen("label", "aleta-pilih-banyak-baris");
            const kotak = document.createElement("input");
            kotak.type = "checkbox";
            kotak.value = String(pil.nilai);
            kotak.checked = terusul.has(String(pil.nilai));
            kotak.className = "aleta-abt-centang";
            label.appendChild(kotak);
            label.appendChild(buatElemen("span", "", pil.label));
            kotakBanyak.appendChild(label);
            semua.push(kotak);
          }
          kartu.appendChild(kotakBanyak);
          bacaPilihanPanel = () => semua.filter((x) => x.checked).map((x) => x.value);
          // Mencentang salah satu sumber hukum berarti medannya memang hendak
          // dipakai - centang induknya menyala sendiri, dan padam lagi ketika
          // seluruhnya dilepas.
          for (const kotak of semua) {
            kotak.addEventListener("change", () => {
              const ada = semua.some((x) => x.checked);
              centang.disabled = !ada;
              centang.checked = ada;
            });
          }
        } else {
          const pilih = document.createElement("select");
          pilih.className = "aleta-pilih-sendiri";
          for (const pil of medan.pilihan) {
            const opsi = document.createElement("option");
            opsi.value = String(pil.nilai);
            opsi.textContent = pil.label;
            pilih.appendChild(opsi);
          }
          // Usulannya yang terpilih lebih dulu; bila tidak ada usulan,
          // nilai yang sudah ada di borang.
          pilih.value = String((usul && usul.nilai) || medan.nilaiSekarang || "");
          pilih.addEventListener("change", () => {
            centang.disabled = !pilih.value;
            if (!pilih.value) centang.checked = false;
            else centang.checked = true;
          });
          kartu.appendChild(pilih);
          bacaPilihanPanel = () => (pilih.value ? [pilih.value] : []);
        }

        wadah.appendChild(kartu);
        // Medan yang tidak punya usulan pun tetap dapat dipilih sendiri -
        // itulah sebab daftarnya digambar di atas, di luar penjaga ini.
        {
          // Kotak centang diisikan satu per satu: mencentang satu kotak tidak
          // pernah membatalkan kotak lain, jadi seluruhnya memang harus
          // disebut. Medan biasa tetap satu nilai.
          pilihanTerap.push({
            kunci: medan.kunci,
            label: medan.label,
            centang,
            // Dibaca saat ditekan - yang berlaku pilihan petugas, bukan
            // usulan yang mungkin sudah digantinya sejak tadi.
            get nilaiSemua() {
              return bacaPilihanPanel();
            },
          });
        }
      }
    }

    const terap = buatElemen("button", "aleta-permintaan-tombol", "Isikan yang dicentang");
    terap.type = "button";
    const hasilTerap = buatElemen("div", "aleta-abt-kabar");

    // ======================================================================
    // YANG MENAHAN MENAHAN - SAMPAI ORANG MENYATAKAN SUDAH MEMBACANYA
    // ======================================================================
    //
    // Tombol Isikan mati selama praperiksa menemukan pertentangan yang
    // dibuktikan dari SIPP. Ia dapat dinyalakan lagi, tetapi lewat kotak
    // centang yang bunyinya jelas - dan bila dipilih, Simpan TIDAK ditekan
    // sendiri: keputusan itu milik petugas, termasuk menekan Simpan.
    if (raporAgen && raporAgen.hentikan) {
      terap.disabled = true;
      const tetap = buatElemen("label", "aleta-praperiksa-tetap");
      const centangTetap = document.createElement("input");
      centangTetap.type = "checkbox";
      centangTetap.className = "aleta-abt-centang";
      tetap.appendChild(centangTetap);
      tetap.appendChild(
        buatElemen(
          "span",
          "",
          "Saya sudah membaca yang menahan di atas - tetap isikan borangnya. Simpan TIDAK akan ditekan sendiri."
        )
      );
      wadah.appendChild(tetap);
      centangTetap.addEventListener("change", () => {
        terap.disabled = !centangTetap.checked;
      });
    }

    wadah.appendChild(terap);
    wadah.appendChild(hasilTerap);

    terap.addEventListener("click", async () => {
      const dipilih = daftar.filter((x) => x.centang.checked && x.teks);
      const medanDipilih = pilihanTerap.filter((x) => x.centang.checked);
      if (dipilih.length === 0 && medanDipilih.length === 0) {
        hasilTerap.textContent = "Tidak ada yang dicentang.";
        return;
      }
      terap.disabled = true;
      const gagal = [];
      let berhasil = 0;

      // Medan pilihan lebih dulu. Sebagian di antaranya MENGUBAH tampilan
      // borang - memilih qobla menentukan muncul-tidaknya keadaan istri -
      // dan mengisinya sesudah teks panjang berarti perubahan itu terjadi
      // ketika petugas sudah berhenti memperhatikan.
      for (const satu of medanDipilih) {
        hasilTerap.textContent = `Memilih ${satu.label}…`;
        const nilaiDipakai = satu.nilaiSemua || [];
        if (nilaiDipakai.length === 0) {
          gagal.push(`${satu.label}: belum ada yang dipilih`);
          continue;
        }
        for (const nilai of nilaiDipakai) {
          const hasil = await kirimKeJembatan({
            jenis: "isi",
            penunjuk: satu.kunci,
            jenisMedan: "pilih",
            nilai,
          });
          if (hasil && hasil.ok) berhasil += 1;
          else gagal.push(`${satu.label}: ${(hasil && hasil.alasan) || "tidak terisi"}`);
        }
      }

      for (const satu of dipilih) {
        hasilTerap.textContent = `Mengisi ${satu.judul}…`;
        // "kaya" - jembatan yang menyentuh CKEditor. Menyetel value pada
        // textarea aslinya membuat tampilannya berubah tanpa nilainya ikut,
        // dan yang tersimpan kemudian bukan yang terlihat.
        const hasil = await kirimKeJembatan({
          jenis: "isi",
          penunjuk: satu.penunjuk,
          jenisMedan: "kaya",
          nilai: satu.teks,
        });
        if (hasil && hasil.ok) berhasil += 1;
        else gagal.push(`${satu.judul}: ${(hasil && hasil.alasan) || "tidak terisi"}`);
      }
      terap.disabled = false;
      hasilTerap.className = gagal.length ? "aleta-abt-kabar aleta-abt-gagal" : "aleta-abt-kabar";
      hasilTerap.textContent = gagal.length
        ? `${berhasil} terisi, ${gagal.length} gagal: ${gagal.join("; ")}`
        : `${berhasil} isian terisi.`;

      // ====================================================================
      // MEDAN YANG BARU LAHIR SESUDAH STATUS PUTUSAN DIPILIH
      // ====================================================================
      //
      // Memilih "Dikabulkan" pada perkara cerai gugat membuat SIPP
      // memunculkan Faktor Penyebab Perceraian primer dan sekunder,
      // Qobla/Ba'da, Status Nusyuz, dan Keadaan Istri - lima medan yang
      // beberapa detik lalu belum ada di halaman sama sekali, dan karena itu
      // tidak pernah ikut ditanyakan ke ALETA.
      //
      // Membiarkannya berarti otomisasi berhenti tepat di tempat yang paling
      // banyak isiannya, dan petugas mengisi lima pilihan dengan tangan
      // justru sesudah diberi tahu bahwa isiannya sudah terisi.
      //
      // Dijalankan hanya bila jumlah medan yang tampak benar-benar
      // BERTAMBAH. Tanpa syarat itu, tiap pengisian memanggil pembacaan
      // berikutnya tanpa akhir.
      const tampakSesudah = await hitungMedanTampak();
      if (tampakSesudah > medanTampak.length) {
        hasilTerap.textContent =
          `${hasilTerap.textContent} Borang memunculkan ` +
          `${tampakSesudah - medanTampak.length} pilihan baru - dibacakan ulang…`;
        tombol.click();
        return;
      }

      // ====================================================================
      // TERSIMPAN, BUKAN SEKADAR TERISI
      // ====================================================================
      //
      // Sampai 1.123.0 ALETA berhenti di sini dan menyuruh petugas menekan
      // Simpan sendiri. Dibuka atas permintaan, dengan dua pagar yang
      // menggantikannya:
      //
      //   1. HANYA BILA SELURUHNYA TERISI. Satu isian gagal berarti borangnya
      //      belum utuh, dan menyimpan borang yang belum utuh menghasilkan
      //      putusan yang salah di berkas perkara yang sungguhan.
      //   2. TERSIMPANNYA DIBUKTIKAN dari SIPP, bukan dari tombol yang
      //      berhasil ditekan - lihat simpanPutusanLaluBuka.
      //
      // Halaman perkaranya dibuka kembali hanya setelah terbukti tersimpan.
      // Memuat ulang lebih awal membuang isian yang belum diterima SIPP.
      if (gagal.length > 0) {
        hasilTerap.textContent += " Simpan TIDAK ditekan selama masih ada yang gagal.";
        return;
      }
      if (raporAgen && raporAgen.hentikan) {
        hasilTerap.textContent +=
          " Simpan TIDAK ditekan: praperiksa menahan dan Anda memilih mengisi sendiri - " +
          "periksa borangnya, lalu tekan Simpan SIPP sendiri.";
        alatCatat(
          "praperiksa",
          `${nomorPerkara}: diisi meski ditahan (${ringkasHentikan(raporAgen)}) - Simpan diserahkan ke petugas`,
          ""
        );
        return;
      }
      terap.disabled = true;
      const hasilSimpan = await simpanPutusanLaluBuka(nomorPerkara, hasilTerap);
      terap.disabled = false;
      hasilTerap.className = hasilSimpan.ok
        ? "aleta-abt-kabar"
        : "aleta-abt-kabar aleta-abt-gagal";
      hasilTerap.textContent = `${berhasil} isian terisi. ${hasilSimpan.bunyi}`;
    });

    tombol.disabled = false;
  });

  return kotak;
}

/**
 * ============================================================================
 * RIWAYAT ALETA - APA SAJA YANG PERNAH DIKERJAKAN ALETA PADA PERKARA INI
 * ============================================================================
 *
 * Sampai 1.105.0 pertanyaan itu dijawab dari layar Audit Trail SIPP: tiap
 * baris yang ditulis ALETA diakhiri "[ALETA] diisikan operator <nama>".
 *
 * Tempatnya keliru. sys_audittrail catatan milik SIPP, dibaca petugas SIPP,
 * dan tidak ada satu pun baris SIPP yang menyebut alat yang dipakai
 * mengetiknya - sehingga baris ALETA menonjol sebagai sesuatu yang
 * disisipkan. Sejak 1.106.0 basis data SIPP tidak memuat satu kata pun
 * tentang ALETA.
 *
 * Riwayatnya pindah ke sini, dan justru menjadi lebih lengkap:
 *
 *   - percobaan yang DITOLAK ikut tercatat beserta sebabnya; di sys_audittrail
 *     yang gagal tidak pernah meninggalkan jejak sama sekali,
 *   - tabel apa saja yang disentuh tiap langkah tercatat utuh,
 *   - akun SIPP dan operator ALETA tercatat berdampingan - dua orang yang
 *     belum tentu sama, dan perbedaannya justru yang dicari bila kelak ada
 *     yang bertanya.
 *
 * Dimuat saat dibuka, bukan saat panel digambar: yang membuka panel belum
 * tentu sedang mencari riwayat, dan satu panggilan per perkara yang dilihat
 * sekilas adalah ongkos yang tidak perlu.
 */
function bagianRiwayatAleta(nomorPerkara) {
  const kotak = bagian("Riwayat ALETA", "riwayatAleta", true);
  let sudahDimuat = false;

  const kepala = kotak.querySelector(".aleta-bagian-judul");
  const muatBagian = () => {
    const isi = kotak.isi;
    if (sudahDimuat || isi.style.display === "none") return;
    sudahDimuat = true;

    isi.appendChild(buatElemen("div", "aleta-memuat", "Membaca riwayat ALETA…"));
    void (async () => {
      let hasil = null;
      try {
        const respons = await alatAmbil(
          `${ALETA_API_RIWAYAT}?nomorPerkara=${encodeURIComponent(nomorPerkara)}&batas=30`,
          { credentials: "include", cache: "no-store" },
          "riwayat ALETA"
        );
        if (!respons.ok) {
          isi.textContent = "";
          isi.appendChild(
            buatElemen("div", "aleta-gagal", await pesanGalat(respons))
          );
          sudahDimuat = false;
          return;
        }
        hasil = await respons.json();
      } catch (galat) {
        isi.textContent = "";
        isi.appendChild(buatElemen("div", "aleta-gagal", String(galat.message || galat)));
        sudahDimuat = false;
        return;
      }

      isi.textContent = "";
      const baris = (hasil && Array.isArray(hasil.baris) && hasil.baris) || [];
      if (baris.length === 0) {
        isi.appendChild(
          buatElemen(
            "div",
            "aleta-kosong",
            "ALETA belum pernah menulis apa pun pada perkara ini."
          )
        );
        return;
      }

      const NAMA_JENIS = {
        pmh: "Penetapan Majelis Hakim",
        ppp: "Penunjukan Panitera Pengganti",
        pjs: "Penunjukan Juru Sita",
        phs: "Penetapan Hari Sidang",
        dataUmum: "Isian Data Umum",
      };

      for (const jejak of baris) {
        const kotakBaris = buatElemen("div", "aleta-baris");

        const judul = jejak.aksi === "hapus" ? "Dibatalkan" : "Ditulis";
        kotakBaris.appendChild(
          buatElemen(
            "div",
            "aleta-baris-judul",
            `${judul} — ${NAMA_JENIS[jejak.jenis] || jejak.jenis || "tidak disebut"}`
          )
        );

        // Waktunya menurut jam pembacanya sendiri. Menyebut zona waktu di
        // panel selebar tiga ratus piksel hanya menambah satu hal yang harus
        // dibaca tanpa pernah menjawab pertanyaan siapa pun.
        const waktu = jejak.waktu ? new Date(jejak.waktu) : null;
        const waktuTerbaca =
          waktu && !Number.isNaN(waktu.getTime()) ? waktu.toLocaleString("id-ID") : "";

        const bagianKet = [];
        if (waktuTerbaca) bagianKet.push(waktuTerbaca);
        // Nama pejabatnya lebih dahulu, nama akunnya di dalam kurung: yang
        // membaca riwayat mencari orangnya, bukan akunnya - tetapi akun itu
        // yang tercatat di sys_audittrail, jadi keduanya harus dapat
        // dipertemukan bila kelak ada yang membandingkan.
        const pejabat = jejak.namaPejabat || jejak.akunSipp;
        if (pejabat) {
          bagianKet.push(
            jejak.namaPejabat && jejak.akunSipp
              ? `atas nama ${jejak.namaPejabat} (${jejak.akunSipp})`
              : `atas nama ${pejabat}`
          );
        }
        if (jejak.operator) bagianKet.push(`operator ${jejak.operator}`);
        kotakBaris.appendChild(
          buatElemen("div", "aleta-baris-ket", bagianKet.join(" · "))
        );

        // Yang gagal ditulis TEGAS, bukan diselipkan. Baris yang terbaca
        // seperti baris berhasil padahal gagal justru menyesatkan lebih jauh
        // daripada tidak ada barisnya sama sekali.
        if (!jejak.berhasil) {
          kotakBaris.appendChild(
            buatElemen(
              "div",
              "aleta-baris-ket aleta-lencana-lewat",
              `tidak jadi — ${jejak.alasan || "sebabnya tidak tercatat"}`
            )
          );
        } else if (Array.isArray(jejak.tabel) && jejak.tabel.length) {
          kotakBaris.appendChild(
            buatElemen(
              "div",
              "aleta-baris-ket",
              `${jejak.jumlahLangkah} langkah · ${jejak.tabel.join(", ")}`
            )
          );
        }

        isi.appendChild(kotakBaris);
      }

      isi.appendChild(
        buatElemen(
          "div",
          "aleta-kosong-lembut",
          "Tercatat di basis data ALETA. Basis data SIPP tidak memuat keterangan apa pun tentang ALETA."
        )
      );
    })();
  };

  if (kepala) kepala.addEventListener("click", muatBagian);
  setTimeout(muatBagian, 0);
  return kotak;
}

/**
 * ============================================================================
 * PETA KOLOM YANG MENGUSULKAN DIRINYA SENDIRI
 * ============================================================================
 *
 * Peta kolom formulir diisi tangan, sekali pasang: penunjuk tiap kolom SIPP
 * dibaca dari menu ini lalu disalin ke Pengaturan. Dua hal membuatnya
 * mahal. Pertama, yang menyalin harus tahu kolom mana yang berpadanan
 * dengan medan ALETA yang mana - dan nama kolom SIPP tidak selalu
 * menjelaskan dirinya. Kedua, peta itu usang diam-diam begitu SIPP berganti
 * versi dan penunjuknya bergeser.
 *
 * Yang dikerjakan di sini: mencocokkan ISI kolom di halaman dengan nilai
 * yang memang diusulkan ALETA untuk perkara ini. Kolom yang berisi nama
 * juru sita yang diusulkan ALETA hampir pasti kolom juru sita - dan itu
 * dugaan yang dapat diperiksa, bukan tebakan dari nama kolom.
 *
 * ============================================================================
 * MENGUSULKAN, TIDAK PERNAH MEMASANG
 * ============================================================================
 *
 * Peta yang keliru mengisi kolom yang salah pada formulir yang sungguhan.
 * Karena itu yang dihasilkan menu ini USULAN yang disalin manusia ke
 * Pengaturan - bukan peta yang dipasang sendiri. Perbedaannya kecil di
 * layar dan besar akibatnya: yang menyalin membaca dahulu.
 */
function bakuNilai(nilai) {
  return String(nilai || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    // Gelar dan tanda bacanya dibuang: SIPP menuliskan "Idris, S.H.I., M.H."
    // sedangkan kolomnya kerap hanya berisi "Idris".
    .replace(/[.,]/g, "")
    .trim();
}

/** Tanggal apa pun bentuknya menjadi YYYY-MM-DD, supaya dapat diadu. */
function tanggalBaku(teks) {
  const isi = String(teks || "").trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(isi);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const lokal = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(isi);
  if (lokal) {
    const dua = (n) => String(n).padStart(2, "0");
    return `${lokal[3]}-${dua(lokal[2])}-${dua(lokal[1])}`;
  }
  return "";
}

/** Nilai yang diketahui ALETA untuk perkara ini, beserta nama medannya. */
function nilaiDikenal(usulan) {
  const dikenal = [];
  if (!usulan) return dikenal;

  const pmh = usulan.pmh || {};
  (pmh.anggota || []).forEach((orang, urutan) => {
    if (orang && orang.nama) {
      dikenal.push({
        medan: urutan === 0 ? "hakim_ketua" : `hakim_anggota${urutan}`,
        nilai: orang.nama,
      });
    }
  });

  const ppp = (usulan.ppp && usulan.ppp.usulan) || null;
  if (ppp && ppp.nama) dikenal.push({ medan: "panitera_pengganti", nilai: ppp.nama });

  const pjs = (usulan.pjs && usulan.pjs.usulan) || null;
  if (pjs && pjs.nama) dikenal.push({ medan: "jurusita", nilai: pjs.nama });

  const sidang = (usulan.phs && usulan.phs.usulan) || "";
  if (sidang) dikenal.push({ medan: "tanggal_sidang", nilai: sidang, tanggal: true });

  if (usulan.tanggalPenetapan) {
    dikenal.push({ medan: "tanggal_penetapan", nilai: usulan.tanggalPenetapan, tanggal: true });
  }

  return dikenal;
}

/**
 * Kolom halaman mana yang isinya berpadanan dengan nilai yang dikenal.
 *
 * Satu medan hanya diusulkan SEKALI - pada padanan pertamanya. Halaman SIPP
 * kerap memuat nama yang sama di dua tempat (kolom isian dan kolom bacaan
 * di sebelahnya), dan mengusulkan keduanya berarti menyerahkan pilihan
 * kepada yang menyalin tanpa memberinya dasar memilih.
 */
function usulkanPetaKolom(usulan, medanHalaman) {
  const dikenal = nilaiDikenal(usulan);
  if (dikenal.length === 0) return [];

  const sudah = new Set();
  const hasil = [];

  for (const kolom of medanHalaman || []) {
    if (!kolom || !kolom.penunjuk) continue;
    const isiKolom = String(kolom.nilai || "").trim();
    if (!isiKolom) continue;

    for (const calon of dikenal) {
      if (sudah.has(calon.medan)) continue;

      const cocok = calon.tanggal
        ? tanggalBaku(isiKolom) !== "" && tanggalBaku(isiKolom) === tanggalBaku(calon.nilai)
        : bakuNilai(isiKolom) === bakuNilai(calon.nilai);
      if (!cocok) continue;

      sudah.add(calon.medan);
      hasil.push({
        medan: calon.medan,
        penunjuk: kolom.penunjuk,
        jenisMedan: kolom.ckeditor ? "kaya" : kolom.select2 || kolom.tag === "select" ? "pilih" : calon.tanggal ? "tanggal" : "teks",
        contoh: isiKolom.slice(0, 60),
        label: kolom.label || kolom.nama || kolom.id || "",
      });
      break;
    }
  }

  return hasil;
}

function bagianBacaBorang() {
  const kotak = bagian("Peta kolom formulir (sekali pasang)", "bacaBorang", true);
  let sudahDimuat = false;

  const kepala = kotak.querySelector(".aleta-bagian-judul");
  const muatBagian = () => {
    const isi = kotak.isi;
    if (sudahDimuat || isi.style.display === "none") return;
    sudahDimuat = true;

    isi.appendChild(buatElemen("div", "aleta-memuat", "Membaca halaman…"));
    void (async () => {
      const jawab = await kirimKeJembatan({ jenis: "baca" });
      isi.textContent = "";

      if (!jawab.ok) {
        isi.appendChild(
          buatElemen("div", "aleta-gagal", jawab.alasan || "Halaman tidak dapat dibaca.")
        );
        sudahDimuat = false;
        return;
      }

      const berpenunjuk = (jawab.medan || []).filter((x) => x.penunjuk);
      if (berpenunjuk.length === 0) {
        isi.appendChild(
          buatElemen("div", "aleta-kosong", "Tidak ada kolom isian di halaman ini.")
        );
        return;
      }

      // ====================================================================
      // ALAT PEMASANGAN, BUKAN PENAMPIL DATA
      // ====================================================================
      //
      // Yang tergambar di sini PENUNJUK kolom - #ijin_cerai_pihak1 dan
      // sejenisnya - bukan isinya. Tanpa keterangan itu, daftarnya terbaca
      // sebagai fitur yang gagal mengambil data, dan yang membacanya
      // menyimpulkan ALETA tidak dapat membaca SIPP.
      //
      // Gunanya sekali pasang: penunjuk ini disalin ke Pengaturan - Peta kolom
      // formulir, dan peta itulah yang kemudian dipakai tombol Kerjakan
      // mengisi formulir sendiri. Sesudah petanya lengkap, menu ini tidak
      // perlu dibuka lagi.
      isi.appendChild(
        buatElemen(
          "div",
          "aleta-tetap-sebab",
          "Ini alat PEMASANGAN, bukan penampil data. Yang tercantum di bawah adalah " +
            "penunjuk kolom di halaman ini - bukan isinya."
        )
      );
      isi.appendChild(
        buatElemen(
          "div",
          "aleta-tetap-sebab",
          `${berpenunjuk.length} kolom terbaca. Salin penunjuknya ke Pengaturan - Peta kolom ` +
            "formulir. Sesudah petanya lengkap, tombol Kerjakan dapat mengisi formulir ini " +
            "sendiri, dan menu ini tidak perlu dibuka lagi."
        )
      );

      // Usulan peta lebih dahulu, daftar mentahnya di bawah. Yang sedang
      // memasang membaca yang pertama; yang mencari kolom yang belum
      // terpetakan membaca yang kedua.
      const usulanPeta = usulkanPetaKolom(usulanTerakhir, jawab.medan || []);
      if (usulanPeta.length > 0) {
        const kotakUsulan = buatElemen("div", "aleta-peta-usulan");
        kotakUsulan.appendChild(
          buatElemen(
            "div",
            "aleta-tulis-judul",
            `${usulanPeta.length} kolom berisi nilai yang memang diusulkan ALETA untuk perkara ini`
          )
        );
        kotakUsulan.appendChild(
          buatElemen(
            "div",
            "aleta-tetap-sebab",
            "Dugaan dari ISI kolomnya, bukan dari namanya. Periksa dahulu, lalu salin ke Pengaturan - Peta kolom formulir. ALETA tidak memasangnya sendiri."
          )
        );
        for (const u of usulanPeta) {
          kotakUsulan.appendChild(
            barisPenetapan(
              u.medan,
              u.penunjuk,
              `${u.jenisMedan} · berisi "${u.contoh}"${u.label ? ` · ${u.label}` : ""}`,
              ""
            )
          );
        }
        kotakUsulan.appendChild(
          tombolSalin(
            JSON.stringify(
              usulanPeta.map((u) => ({ medan: u.medan, penunjuk: u.penunjuk, jenisMedan: u.jenisMedan })),
              null,
              2
            ),
            "Salin usulan peta kolom"
          )
        );
        isi.appendChild(kotakUsulan);
      }

      for (const kolom of berpenunjuk.slice(0, 120)) {
        const petunjukJenis = kolom.ckeditor
          ? "kaya"
          : kolom.select2 || kolom.tag === "select"
            ? "pilih"
            : "teks";
        isi.appendChild(
          barisPenetapan(
            petunjukJenis,
            kolom.penunjuk,
            kolom.label || `${kolom.tag} ${kolom.nama || kolom.id}`,
            ""
          )
        );
      }
    })();
  };

  kepala.addEventListener("click", muatBagian);

  // Dimuat juga ketika bagiannya SUDAH terbentang dari sesi sebelumnya.
  //
  // Keadaan lipatan disimpan antar-sesi. Bila tersimpan sebagai TERBUKA,
  // bagian ini tergambar terbentang tetapi kosong - dan baru terisi sesudah
  // ditekan DUA kali: sekali menutup, sekali membuka. Terbaca sebagai menu
  // yang rusak, padahal hanya pemuatnya yang tidak pernah dipanggil.
  if (kotak.isi.style.display !== "none") {
    setTimeout(muatBagian, 0);
  }

  return kotak;
}

/**
 * ============================================================================
 * BAGIAN "PENETAPAN YANG DAPAT ANDA TETAPKAN" DIBUANG
 * ============================================================================
 *
 * Bagian itu mencocokkan nama pengguna SIPP yang sedang masuk dengan pejabat
 * yang berwenang menandatangani tiap penetapan, lalu menyebutkan mana yang
 * "urusan Anda". Dasarnya satu anggapan: tiap pejabat membuka SIPP dengan
 * akunnya sendiri, sehingga yang tercatat sebagai pengisi adalah dia.
 *
 * Anggapan itu sudah tidak berlaku. Sejak ALETA menuliskan penetapan atas nama
 * pejabatnya - keputusan pimpinan pengadilan ini - siapa yang sedang membuka
 * SIPP tidak lagi menentukan apa pun. Operator yang mengerjakan, dan nama
 * pejabatnya tetap yang tercatat.
 *
 * Karena itu pertanyaannya berganti, dan bagiannya ikut berganti:
 *
 *   dulu   "boleh tidak saya mengerjakan ini?"
 *   kini   "kalau saya tekan sekarang, tercatat atas nama siapa?"
 *
 * Pertanyaan kedua dijawab keterangan penetap pada tiap baris penetapan, yang
 * ikut berubah ketika pejabatnya diganti pada "Pejabat yang menetapkan".
 * (Kotak ringkasan "Akan tercatat di SIPP atas..." yang dahulu berdiri di atas
 * tombol Kerjakan sudah dicabut: ia membaca pilihan bawaan mesin, sehingga
 * dapat menyebut nama yang BUKAN yang akan ditulis.)
 * Mempertahankan bagian lamanya berarti menyimpan
 * satu kotak yang menanyakan hal yang tidak lagi menentukan - dan yang paling
 * merugikan, ia terbaca seperti gerbang izin padahal tidak pernah menahan apa
 * pun sekali pun.
 *
 * Antrean PENERUSAN ikut terbawa keluar. Ia menjawab "ada pekerjaan menunggu
 * saya di perkara lain", dan itu berguna - tetapi seluruh alurnya bersandar
 * pada seseorang menekan "teruskan" kepada pejabat, yang justru tidak lagi
 * diperlukan. Rutenya dibiarkan hidup di server; yang dibuang hanya
 * gambarannya di sini.
 */

/** Papan penunjukan, dimuat hanya ketika menunya dibuka. */
function bagianPenunjukan(nomor) {
  const kotak = bagian("Penetapan dan Penunjukan Perkara", "penunjukan", true);
  let sudahDimuat = false;

  const kepala = kotak.querySelector(".aleta-bagian-judul");
  const muatBagian = () => {
    const isi = kotak.isi;
    if (sudahDimuat || isi.style.display === "none") return;
    sudahDimuat = true;

    isi.appendChild(buatElemen("div", "aleta-memuat", "Menyusun usulan…"));
    void (async () => {
      try {
        const data = await ambilUsulanPenunjukan(nomor);
        // Nomor perkaranya ikut disimpan: pemuat ulang usulan (ganti majelis)
        // membutuhkannya, dan bentuk usulan bukan tempat yang aman untuk
        // bergantung.
        data.nomorPerkara = nomor;
        // Disimpan supaya menu Peta kolom formulir dapat mencocokkan isi
        // kolom di halaman dengan nilai yang memang diusulkan ALETA - lihat
        // usulkanPetaKolom. Hanya dibaca; tidak ada yang menulisinya lagi.
        usulanTerakhir = data;
        isi.textContent = "";
        gambarPenunjukan(isi, data);
      } catch (galat) {
        isi.textContent = "";
        isi.appendChild(
          buatElemen("div", "aleta-gagal", String(galat.message || galat).slice(0, 200))
        );
        // Boleh dicoba lagi: tutup lalu buka kembali menunya.
        sudahDimuat = false;
      }
    })();
  };

  kepala.addEventListener("click", muatBagian);

  // Dimuat juga ketika bagiannya SUDAH terbentang dari sesi sebelumnya.
  //
  // Keadaan lipatan disimpan antar-sesi. Bila tersimpan sebagai TERBUKA,
  // bagian ini tergambar terbentang tetapi kosong - dan baru terisi sesudah
  // ditekan DUA kali: sekali menutup, sekali membuka. Terbaca sebagai menu
  // yang rusak, padahal hanya pemuatnya yang tidak pernah dipanggil.
  if (kotak.isi.style.display !== "none") {
    setTimeout(muatBagian, 0);
  }

  return kotak;
}

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
      const baca = await kirimKeJembatanLangsung({
        jenis: "nilai",
        penunjuk,
        jenisMedan: pesan.jenisMedan,
      });
      if (baca && baca.ok && baca.tampak !== false) {
        nilaiLama = String(baca.nilai === undefined || baca.nilai === null ? "" : baca.nilai);
        lamaTerbaca = true;
      }
    } catch {
      /* nilai lama tidak terbaca - medannya tetap diisi, hanya tanpa jalan pulang */
    }
  }

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
alatDaftarkanPenunjuk("Simpan putusan", PENUNJUK_SIMPAN_PUTUSAN, { wajib: false, saat: "borang putusan" });

/**
 * Borang mana yang sedang terbuka di halaman ini.
 *
 * ============================================================================
 * DITENTUKAN DARI KOLOMNYA, BUKAN DARI ALAMAT HALAMAN
 * ============================================================================
 *
 * Nama halaman SIPP berbeda-beda antar jenis perkara dan antar versi - persis
 * seperti detil_perkara_agama dan detil_perkara yang sudah lebih dulu memaksa
 * pengenalan panel memakai isi halaman, bukan alamatnya.
 *
 * Yang dipakai di sini: formulir yang SELURUH kolom wajibnya ada di halaman ini.
 * Kalau tidak ada satu pun yang cocok, tidak ada yang diisi - lebih baik
 * tombol yang diam daripada tombol yang mengisi formulir yang salah.
 */
async function borangSedangTerbuka(petaKolom) {
  const jawab = await kirimKeJembatan({ jenis: "baca" });
  if (!jawab.ok) return { formulir: "", alasan: jawab.alasan || "formulir_tidak_terbaca", medanHalaman: [] };

  const adaDiHalaman = new Set();
  for (const kolom of jawab.medan || []) {
    if (kolom.penunjuk) adaDiHalaman.add(kolom.penunjuk);
  }

  const perBorang = new Map();
  for (const kolom of petaKolom) {
    if (!perBorang.has(kolom.borang)) perBorang.set(kolom.borang, []);
    perBorang.get(kolom.borang).push(kolom);
  }

  for (const [formulir, daftar] of perBorang) {
    const wajib = daftar.filter((x) => x.wajib);
    const diperiksa = wajib.length > 0 ? wajib : daftar;
    if (diperiksa.length === 0) continue;
    if (diperiksa.every((x) => adaDiHalaman.has(x.penunjuk))) {
      return { formulir, alasan: "", medanHalaman: jawab.medan || [] };
    }
  }

  return { formulir: "", alasan: "tidak_ada_formulir_yang_cocok", medanHalaman: jawab.medan || [] };
}

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

/** Satu baris keterangan: nama di kiri, nilainya di kanan. */
function barisNilai(nama, nilai, nada = "") {
  const baris = buatElemen("div", `aleta-nilai${nada ? ` aleta-${nada}` : ""}`);
  baris.appendChild(buatElemen("span", "aleta-nilai-nama", nama));
  baris.appendChild(buatElemen("span", "aleta-nilai-isi", nilai));
  return baris;
}

/** Tahapan perkara beserta ketepatan waktu penginputannya. */
/**
 * ============================================================================
 * LENCANA TIAP MENU
 * ============================================================================
 *
 * Sebelumnya kedua belas menu berbentuk sama persis, entah di baliknya ada
 * masalah atau tidak ada apa-apa. Membaca panel berarti membukanya satu per
 * satu untuk mencari tahu - dua belas kali, tiap perkara.
 *
 * Lencana ini menjawabnya sebelum dibuka. Sumbernya SATU panggilan yang sama
 * dengan yang dipakai kelima menu itu sendiri, dan hasilnya memang sudah
 * disimpan per nomor perkara - jadi tidak ada kueri tambahan sama sekali.
 *
 * Yang dikembalikan { teks, nada } per kunci menu. nada mengikuti kelas yang
 * sudah ada: lewat (merah), mendesak (kuning), aman (hijau), netral (abu).
 */
/**
 * Memasang lencana pada satu menu.
 *
 * Aman dipanggil pada menu yang tidak ada - panggilan latar boleh selesai
 * sesudah panelnya ditutup atau digambar ulang, dan melempar galat di situ
 * hanya akan mematikan sisa pemasangan lencana yang lain.
 */
function setLencana(kotak, ringkas) {
  if (!kotak || !kotak.lencana || !ringkas || !ringkas.teks) return;
  kotak.lencana.textContent = ringkas.teks;
  kotak.lencana.className = `aleta-bagian-lencana aleta-lencana-${ringkas.nada || "netral"}`;
}

/**
 * ============================================================================
 * KELOMPOK MENU
 * ============================================================================
 *
 * Dua belas menu datar menjadi empat kelompok. Yang berubah susunannya, bukan
 * isinya - tiap menu tetap ada, tetap dapat dibuka, dan tidak satu keterangan
 * pun hilang.
 *
 * Urutannya mengikuti perjalanan perkara: berkas masuk, perkara berjalan,
 * perkara putus, lalu yang dikerjakan. Bukan urutan kapan menunya dibuat -
 * yang selama ini menentukan.
 *
 * Kelompok yang tertutup menyebutkan ringkasannya di kepalanya sendiri,
 * sehingga menutupnya tidak menyembunyikan apa pun yang perlu diketahui
 * sebelum memutuskan membukanya.
 */
function kelompok(judul, kunci, bawaanTerlipat = false) {
  const kotak = buatElemen("div", "aleta-kelompok");
  // Sasaran tetap bagi pintasan papan tik dan bagi uji - lihat
  // pintasanPapanTik. Judulnya berubah sewaktu-waktu, kuncinya tidak.
  kotak.dataset.kunci = kunci;

  const kepala = buatElemen("button", "aleta-kelompok-judul");
  kepala.type = "button";
  kepala.appendChild(buatElemen("span", "aleta-bagian-panah", "▾"));
  kepala.appendChild(buatElemen("span", "aleta-kelompok-teks", judul));
  const ringkas = buatElemen("span", "aleta-kelompok-ringkas");
  kepala.appendChild(ringkas);

  const isi = buatElemen("div", "aleta-kelompok-isi");

  const tersimpan = lipatanTersimpan ? lipatanTersimpan[`kel:${kunci}`] : undefined;
  const terlipatAwal = typeof tersimpan === "boolean" ? tersimpan : bawaanTerlipat;
  terapkanLipatan(kepala, isi, terlipatAwal);

  kepala.addEventListener("click", () => {
    const sedangTerlipat = isi.style.display === "none";
    terapkanLipatan(kepala, isi, !sedangTerlipat);
    simpanLipatan(`kel:${kunci}`, !sedangTerlipat);
  });

  kotak.appendChild(kepala);
  kotak.appendChild(isi);
  kotak.isi = isi;
  kotak.ringkas = ringkas;

  /**
   * Ringkasan kepala kelompok, disusun dari lencana anak-anaknya.
   *
   * Yang disebut hanya yang paling genting - satu kelompok berisi empat menu
   * tidak dapat memuat empat lencana di kepalanya tanpa jadi sesak, dan yang
   * ditanya orang memang "ada yang perlu dikerjakan di dalam sini?".
   */
  kotak.perbaruiRingkas = () => {
    const urutanNada = { lewat: 3, mendesak: 2, aman: 1, netral: 0 };
    let terburuk = null;
    for (const lencana of isi.querySelectorAll(".aleta-bagian-lencana")) {
      const teks = String(lencana.textContent || "").trim();
      if (!teks) continue;
      const nada = (lencana.className.match(/aleta-lencana-(\w+)/) || [])[1] || "netral";
      if (!terburuk || urutanNada[nada] > urutanNada[terburuk.nada]) {
        terburuk = { teks, nada };
      }
    }
    if (!terburuk) return;
    ringkas.textContent = terburuk.teks;
    ringkas.className = `aleta-kelompok-ringkas aleta-lencana-${terburuk.nada}`;
  };

  return kotak;
}

function ringkasanBagian(status) {
  const hasil = {};

  // --- Tahapan: berapa tahap yang sudah bertanggal ------------------------
  const tahapan = status.tahapan;
  if (!tahapan || !tahapan.terbaca) {
    hasil.tahapan = { teks: "tidak terbaca", nada: "netral" };
  } else {
    const tahap = tahapan.tahap || [];
    const berTanggal = tahap.filter((x) => x.terbaca && x.tanggal).length;
    // Yang terlambat diinput lebih penting daripada yang belum ada - yang
    // pertama sudah terjadi dan tidak dapat diperbaiki, yang kedua memang
    // belum waktunya.
    const terlambat = tahap.filter(
      (x) => x.hariSampaiInput !== null && x.hariSampaiInput !== undefined && Number(x.hariSampaiInput) > 3
    ).length;
    hasil.tahapan = terlambat > 0
      ? { teks: `${terlambat} terlambat diinput`, nada: "lewat" }
      : { teks: `${berTanggal}/${tahap.length}`, nada: "netral" };
  }

  // --- Kelengkapan berkas SIPP: yang paling buruk di antara ketiganya -----
  {
    const relaas = Array.isArray(status.relaas) ? status.relaas : [];
    const jadwal = Array.isArray(status.jadwal) ? status.jadwal : [];
    const berdokumen = relaas.filter((x) => x.adaDokumen).length;
    const berBas = jadwal.filter((x) => x.adaBas).length;
    const adaPetitum = Boolean(status.petitum && status.petitum.ada);

    if (!adaPetitum) {
      hasil.berkasSipp = { teks: "gugatan belum diunggah", nada: "lewat" };
    } else if (relaas.length > 0 && berdokumen < relaas.length) {
      hasil.berkasSipp = { teks: `relaas ${berdokumen}/${relaas.length}`, nada: "mendesak" };
    } else if (jadwal.length > 0 && berBas < jadwal.length) {
      hasil.berkasSipp = { teks: `BAS ${berBas}/${jadwal.length}`, nada: "mendesak" };
    } else {
      hasil.berkasSipp = { teks: "lengkap", nada: "aman" };
    }
  }

  // --- Putusan dan upaya hukum --------------------------------------------
  {
    const putus = status.putusan || {};
    if (!putus.sudahPutus) {
      // Belum putus BUKAN kekurangan - perkaranya memang masih berjalan.
      hasil.putusan = { teks: "belum putus", nada: "netral" };
    } else if (!putus.tanggalMinutasi) {
      hasil.putusan = { teks: "belum diminutasi", nada: "mendesak" };
    } else if (!putus.tanggalBht) {
      hasil.putusan = { teks: "belum BHT", nada: "netral" };
    } else {
      const upaya = Array.isArray(status.upayaHukum) ? status.upayaHukum.length : 0;
      hasil.putusan = upaya > 0
        ? { teks: `${upaya} upaya hukum`, nada: "netral" }
        : { teks: "sudah BHT", nada: "aman" };
    }
  }

  // --- Putusan di e-Court --------------------------------------------------
  {
    const pe = status.putusanEcourt;
    if (!pe) {
      hasil.putusanEcourt = { teks: "belum putus", nada: "netral" };
    } else if (pe.keadaan === "putusan_ecourt_error") {
      hasil.putusanEcourt = { teks: "tidak terbit di e-Court", nada: "lewat" };
    } else if (pe.perluTindakan) {
      hasil.putusanEcourt = { teks: pe.sebutan || "perlu tindakan", nada: "mendesak" };
    } else {
      hasil.putusanEcourt = { teks: pe.sebutan || "beres", nada: "aman" };
    }
  }

  // --- Penilaian SK 048/2024 ----------------------------------------------
  {
    const sk = status.penilaianSk;
    const rinci = sk && Array.isArray(sk.rinci) ? sk.rinci : [];
    if (rinci.length === 0) {
      hasil.penilaianSk = { teks: "belum dapat dihitung", nada: "netral" };
    } else {
      const penuh = rinci.filter((x) => x.terbaca && x.poin === 5).length;
      const kurang = rinci.filter((x) => x.terbaca && x.poin !== null && x.poin < 5).length;
      hasil.penilaianSk = {
        teks: `${penuh}/${rinci.length} penuh`,
        nada: kurang > 0 ? "mendesak" : "aman",
      };
    }
  }

  return hasil;
}

/**
 * Ringkasan yang dapat dihitung TANPA menunggu panggilan apa pun.
 *
 * Sumbernya konteks yang sudah di tangan saat panel digambar. Karena itu
 * lencana ini sudah terpasang sejak baris pertama tergambar, tidak menunggu
 * apa-apa - dan menu yang paling sering menuntut tindakan justru ada di sini.
 */
function ringkasanSeketika(konteks) {
  const hasil = {};
  const r = konteks.ringkasan || {};

  if (konteks.dokumen && konteks.dokumen.length > 0) {
    hasil.dokumen = { teks: String(konteks.dokumen.length), nada: "netral" };
  }

  if (konteks.selisih && konteks.selisih.length > 0) {
    const tinggi = konteks.selisih.filter((x) => x.kegentingan === "tinggi").length;
    hasil.selisih = {
      teks: `${konteks.selisih.length} tidak cocok`,
      nada: tinggi > 0 ? "lewat" : "mendesak",
    };
  }

  const berTenggat = (konteks.dokumen || []).filter(
    (d) => d.batasUnggahTeks || d.sisaHari !== null
  );
  if (berTenggat.length > 0) {
    // Yang paling mepet yang disebut - itulah yang menentukan mendesak
    // tidaknya, bukan rata-ratanya.
    const sisa = berTenggat
      .map((d) => d.sisaHari)
      .filter((x) => x !== null && x !== undefined);
    const paling = sisa.length > 0 ? Math.min(...sisa) : null;
    hasil.tenggat =
      paling === null
        ? { teks: `${berTenggat.length} dokumen`, nada: "netral" }
        : paling < 0
          ? { teks: `lewat ${Math.abs(paling)} hari`, nada: "lewat" }
          : {
              teks: paling === 0 ? "habis hari ini" : `${paling} hari lagi`,
              nada: paling <= (konteks.ambangMendesakHari || 3) ? "mendesak" : "netral",
            };
  }

  const nomor = konteks.nomorPihak || [];
  if (nomor.length > 0) {
    // Nilainya salah satu dari empat yang ditetapkan nomorVerificationService:
    // terverifikasi, menunggu, ditolak, belum_pernah_ditanya. TIDAK ada nilai
    // bernama "terkonfirmasi" - membandingkannya dengan itu membuat setiap
    // pihak terbaca bermasalah, termasuk yang nomornya justru sudah beres.
    const tanpaNomor = nomor.filter((x) => !x.adaNomor).length;
    const ditolak = nomor.filter((x) => x.adaNomor && x.statusVerifikasi === "ditolak").length;
    const belum = nomor.filter(
      (x) => x.adaNomor && x.statusVerifikasi !== "terverifikasi" && x.statusVerifikasi !== "ditolak"
    ).length;

    // Diurut menurut kegentingan: yang tidak punya nomor sama sekali tidak
    // dapat dihubungi; yang ditolak berarti salah alamat dan harus dibetulkan
    // di SIPP; yang belum dikonfirmasi masih menunggu jawaban.
    hasil.nomorPihak =
      tanpaNomor > 0
        ? { teks: `${tanpaNomor} tanpa nomor`, nada: "lewat" }
        : ditolak > 0
          ? { teks: `${ditolak} salah alamat`, nada: "lewat" }
          : belum > 0
            ? { teks: `${belum} belum dikonfirmasi`, nada: "mendesak" }
            : { teks: `${nomor.length} terverifikasi`, nada: "aman" };
  }

  if (r.dokumen === 0 && nomor.length === 0) {
    hasil.dokumen = { teks: "tidak ada", nada: "netral" };
  }

  return hasil;
}

function gambarTahapan(isi, status) {
  const tahapan = status.tahapan;
  if (!tahapan || !tahapan.terbaca) {
    isi.appendChild(
      buatElemen("div", "aleta-kosong", (tahapan && tahapan.alasan) || "Tahapan tidak terbaca dari SIPP.")
    );
    return;
  }

  for (const tahap of tahapan.tahap || []) {
    const baris = buatElemen("div", "aleta-baris");
    baris.appendChild(buatElemen("div", "aleta-baris-judul", tahap.label || tahap.kunci));

    if (!tahap.terbaca) {
      baris.appendChild(buatElemen("div", "aleta-baris-ket", tahap.alasan || "tidak terbaca"));
      isi.appendChild(baris);
      continue;
    }

    const ket = buatElemen("div", "aleta-baris-ket", tahap.tanggal || "belum ada tanggal");

    // Jeda penginputan: inilah yang dinilai SK, dan yang tidak dapat dilihat
    // di SIPP tanpa menghitung sendiri dua tanggal di dua halaman berbeda.
    if (tahap.hariSampaiInput !== null && tahap.hariSampaiInput !== undefined) {
      const hari = Number(tahap.hariSampaiInput);
      const nada = hari <= 1 ? "aman" : hari <= 3 ? "mendesak" : "lewat";
      const tanda = buatElemen(
        "span",
        `aleta-tanda-panel aleta-tanda-${nada}`,
        hari <= 0 ? "diinput hari itu juga" : `diinput ${hari} hari kemudian`
      );
      ket.appendChild(document.createTextNode(" "));
      ket.appendChild(tanda);
    }
    baris.appendChild(ket);

    if (tahap.diinputOleh) {
      baris.appendChild(buatElemen("div", "aleta-baris-ket", `diinput ${tahap.diinputOleh}`));
    }
    isi.appendChild(baris);
  }
}

/** Kelengkapan berkas pokok: gugatan, relaas, dan berita acara sidang. */
function gambarBerkasSipp(isi, status) {
  const relaas = Array.isArray(status.relaas) ? status.relaas : [];
  const jadwal = Array.isArray(status.jadwal) ? status.jadwal : [];
  const berdokumen = relaas.filter((x) => x.adaDokumen).length;
  const berBas = jadwal.filter((x) => x.adaBas).length;

  isi.appendChild(
    barisNilai(
      "Gugatan / permohonan",
      status.petitum && status.petitum.ada ? "sudah diunggah" : "belum diunggah",
      status.petitum && status.petitum.ada ? "aman" : "lewat"
    )
  );
  isi.appendChild(
    barisNilai(
      "Relaas berdokumen",
      relaas.length === 0 ? "belum ada relaas" : `${berdokumen} dari ${relaas.length}`,
      relaas.length > 0 && berdokumen === relaas.length ? "aman" : "mendesak"
    )
  );
  isi.appendChild(
    barisNilai(
      "Berita acara sidang",
      jadwal.length === 0 ? "belum ada sidang" : `${berBas} dari ${jadwal.length} sidang`,
      jadwal.length > 0 && berBas === jadwal.length ? "aman" : "mendesak"
    )
  );

  const arsip = status.arsipKeterangan;
  if (arsip && arsip.terbaca) {
    isi.appendChild(
      barisNilai(
        "Arsip berkas",
        arsip.sudahDiarsipkan ? "sudah diarsipkan" : "belum diarsipkan",
        arsip.sudahDiarsipkan ? "aman" : "netral"
      )
    );
  }
}

/** Putusan dan upaya hukum sesudahnya. */
function gambarPutusan(isi, status) {
  const p = status.putusan || {};
  const lengkap = status.putusanLengkap || {};

  if (!p.sudahPutus) {
    isi.appendChild(buatElemen("div", "aleta-kosong", "Perkara ini belum diputus."));
    return;
  }

  isi.appendChild(barisNilai("Tanggal putusan", lengkap.tanggalPutusan || p.tanggalPutusan || "—"));
  if (lengkap.statusPutusan) isi.appendChild(barisNilai("Status putusan", lengkap.statusPutusan));
  if (lengkap.sumberHukum) isi.appendChild(barisNilai("Sumber hukum", lengkap.sumberHukum));
  isi.appendChild(barisNilai("Minutasi", p.tanggalMinutasi || "belum", p.tanggalMinutasi ? "aman" : "mendesak"));
  isi.appendChild(
    barisNilai("Berkekuatan hukum tetap", p.tanggalBht || "belum", p.tanggalBht ? "aman" : "netral")
  );

  const upaya = Array.isArray(status.upayaHukum) ? status.upayaHukum : [];
  if (upaya.length === 0) {
    isi.appendChild(barisNilai("Upaya hukum", "tidak ada yang tercatat", "netral"));
    return;
  }
  for (const u of upaya) {
    const sudah = (u.tahapan || []).filter((t) => t.tanggal).length;
    const dapat = (u.tahapan || []).filter((t) => t.adaKolom).length;
    isi.appendChild(
      barisNilai(
        u.jenis,
        [
          u.nomorPerkara || "tanpa nomor",
          u.dicabut ? "dicabut" : u.tanggalPutusan ? `diputus ${u.tanggalPutusan}` : "belum diputus",
          dapat > 0 ? `${sudah}/${dapat} tahap` : "",
        ]
          .filter(Boolean)
          .join(" · "),
        u.tanggalPutusan || u.dicabut ? "aman" : "mendesak"
      )
    );
  }
}

/**
 * Apakah putusannya benar-benar terbit di e-Court.
 *
 * Tiga hal dapat gagal berturut-turut tanpa satu pun peringatan: barisnya
 * tidak terbentuk di e-Court, salinannya belum diunggah, atau Panitera belum
 * menandatanganinya. Ketiganya baru ketahuan saat para pihak menanyakan
 * salinan putusannya.
 *
 * Panel ini melayang tepat di atas halaman SIPP yang sedang dibuka petugas -
 * tempat paling masuk akal untuk menyebutkannya.
 */
function gambarPutusanEcourt(isi, status) {
  const p = status.putusanEcourt;
  if (!p) {
    isi.appendChild(
      buatElemen("div", "aleta-kosong", "Perkara ini belum diputus, jadi belum ada yang diperiksa.")
    );
    return;
  }

  const nada =
    p.keadaan === "putusan_ecourt_error" ? "lewat" : p.perluTindakan ? "mendesak" : "aman";

  const kepala = buatElemen("div", `aleta-baris aleta-${nada}`);
  kepala.appendChild(buatElemen("div", "aleta-baris-judul", p.sebutan));
  if (p.keterangan) kepala.appendChild(buatElemen("div", "aleta-baris-ket", p.keterangan));
  isi.appendChild(kepala);

  const e = p.ecourt;
  if (!e) {
    isi.appendChild(
      buatElemen(
        "div",
        "aleta-baris-ket",
        "Keadaan e-Court perkara ini belum pernah dibaca ALETA."
      )
    );
    return;
  }

  if (e.nomorPutusan) isi.appendChild(barisNilai("Nomor putusan e-Court", e.nomorPutusan));
  if (e.tanggalPutusanTeks) isi.appendChild(barisNilai("Tanggal putusan", e.tanggalPutusanTeks));
  if (e.tanggalBhtTeks) isi.appendChild(barisNilai("Tanggal BHT", e.tanggalBhtTeks));

  isi.appendChild(
    barisNilai(
      "Dokumen salinan putusan",
      e.dokumenAda ? "sudah diunggah" : "belum diunggah",
      e.dokumenAda ? "aman" : "mendesak"
    )
  );
  isi.appendChild(barisNilai("Diupload oleh", e.diunggahOleh || "\u2014"));
  isi.appendChild(barisNilai("Tanggal upload", e.tanggalUnggahTeks || "\u2014"));
  isi.appendChild(barisNilai("Panitera", e.paniteraNama || "\u2014"));
  isi.appendChild(
    barisNilai(
      "Tanda tangan elektronik",
      e.paniteraTte
        ? `sudah di-TTE${e.paniteraTanggalTte ? ` \u00b7 ${e.paniteraTanggalTte}` : ""}`
        : "belum di-TTE oleh Panitera",
      e.paniteraTte ? "aman" : "mendesak"
    )
  );
}

/** Penilaian SK Dirjen Badilag 048/2024 untuk perkara ini. */
function gambarPenilaian(isi, status) {
  const sk = status.penilaianSk;
  const rinci = sk && Array.isArray(sk.rinci) ? sk.rinci : [];
  if (rinci.length === 0) {
    isi.appendChild(buatElemen("div", "aleta-kosong", "Penilaian SK belum dapat dihitung."));
    return;
  }

  // Yang ditampilkan hanya unsur yang BELUM sempurna. Panel selebar 340 piksel
  // tidak dapat memuat dua puluh sembilan unsur, dan yang sudah bernilai penuh
  // tidak menuntut tindakan apa pun.
  const perluPerhatian = rinci.filter((x) => x.terbaca && x.poin !== null && x.poin < 5);
  const takTerbaca = rinci.filter((x) => !x.terbaca);

  isi.appendChild(
    barisNilai(
      "Unsur bernilai penuh",
      `${rinci.filter((x) => x.terbaca && x.poin === 5).length} dari ${rinci.length}`
    )
  );

  for (const unsur of perluPerhatian.slice(0, 12)) {
    const nada = unsur.poin === 0 ? "lewat" : unsur.poin <= 2 ? "mendesak" : "netral";
    isi.appendChild(barisNilai(unsur.label, `${unsur.poin} poin · ${unsur.keterangan || ""}`.trim(), nada));
  }
  if (perluPerhatian.length > 12) {
    isi.appendChild(
      buatElemen("div", "aleta-baris-ket", `dan ${perluPerhatian.length - 12} unsur lain di portal`)
    );
  }
  if (takTerbaca.length > 0) {
    isi.appendChild(barisNilai("Belum tersambung", `${takTerbaca.length} unsur`, "netral"));
  }
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

function simpanPosisi(kiri, atas) {
  simpanKeadaanPanel({ kiri, atas });
}

function simpanUkuran(lebar, tinggi) {
  simpanKeadaanPanel({ lebar, tinggi });
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

const KUNCI_TEMA = "temaPanel";
const KUNCI_TEMA_SIPP = "temaSipp";

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
 * SALINAN TEMA UNTUK PEMUATAN BERIKUTNYA
 * ============================================================================
 *
 * chrome.storage.local hanya dapat dibaca secara asinkron, dan apa pun yang
 * menunggunya sudah pasti terlambat: halaman digambar lebih dulu, putih, lalu
 * berubah gelap - kelebat yang paling terasa justru pada daftar perkara
 * panjang dan tiap kali membuka satu perkara.
 *
 * Karena itu keputusannya disalin ke localStorage halaman ini, yang SINKRON,
 * dan dibaca tema-awal.js pada document_start - sebelum satu piksel pun
 * digambar. chrome.storage tetap sumber kebenarannya; yang di sini hanya
 * cache, ditulis ulang tiap kali temanya berubah.
 *
 * Tiga nilai, bukan dua, sebab keadaannya memang tiga: panel gelap dengan
 * lapisan SIPP menyala, panel terang (lapisannya dilepas), dan panel gelap
 * dengan lapisan SIPP sengaja dimatikan. Yang ketiga harus dapat dibedakan
 * dari yang pertama, kalau tidak halaman akan berkelebat gelap bagi orang yang
 * justru mematikannya.
 */
const KUNCI_SALINAN_TEMA = "aleta-tema-sipp";

function simpanSalinanTema() {
  const nilai = temaSekarang !== "gelap" ? "terang" : temaSippMenyala ? "gelap" : "mati";
  try {
    window.localStorage.setItem(KUNCI_SALINAN_TEMA, nilai);
  } catch {
    // Penyimpanan halaman tidak tersedia. Temanya tetap berlaku untuk halaman
    // ini; yang hilang hanya kecepatan pada pemuatan berikutnya.
  }
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
  const akar = document.documentElement;
  simpanSalinanTema();
  if (!temaSippMenyala || temaSekarang !== "gelap") {
    akar.removeAttribute("data-aleta-tema-sipp");
    warnaiCkeditor();
    return;
  }
  akar.setAttribute("data-aleta-tema-sipp", "gelap");
  warnaiCkeditor();
}

async function muatTema() {
  try {
    const simpan = await chrome.storage.local.get([KUNCI_TEMA, KUNCI_TEMA_SIPP]);
    temaSekarang = simpan[KUNCI_TEMA] === "terang" ? "terang" : "gelap";
    // ========================================================================
    // GELAP ADALAH BAWAAN, TERMASUK UNTUK HALAMAN SIPP
    // ========================================================================
    //
    // Sebelumnya lapisan gelap pada SIPP bawaannya MATI, dengan alasan yang
    // masih benar: mengubah tampilan aplikasi orang lain tanpa diminta bukan
    // keputusan yang pantas diambil sendiri oleh sebuah pembaruan.
    //
    // Yang berubah bukan alasannya, melainkan siapa yang meminta. Pemakainya
    // sendiri yang memutuskan gelap sebagai bawaan, dan keputusan itu murah
    // untuk dibatalkan: satu tekanan pada tombol tema mengembalikan SIPP persis
    // seperti semula, dan pilihan itu diingat.
    //
    // Dibaca sebagai "!== false", bukan "=== true": yang pernah mematikannya
    // tetap mendapati SIPP-nya asli sesudah pembaruan ini.
    temaSippMenyala = simpan[KUNCI_TEMA_SIPP] !== false;
  } catch {
    // Penyimpanan tidak tersedia - tema bawaan tetap dipakai, dan panelnya
    // tetap terbaca. Ini kenyamanan, bukan syarat.
  }
}

/**
 * Tombol tema di kepala panel.
 *
 * Satu tekanan mengganti tema PANEL. Tekanan sambil menahan Shift ikut
 * menyalakan atau mematikan tema untuk halaman SIPP - dipisah karena yang
 * kedua mengubah aplikasi milik orang lain, dan hal semacam itu tidak boleh
 * terjadi karena tangan meleset satu piksel.
 */
function tombolTema(panel) {
  const tombol = buatElemen("button", "aleta-tema", temaSekarang === "gelap" ? "☀" : "☾");
  tombol.type = "button";

  const perbaruiJudul = () => {
    tombol.textContent = temaSekarang === "gelap" ? "☀" : "☾";
    // Keadaan SIPP disebut apa adanya, termasuk ketika saklarnya menyala
    // tetapi lapisannya memang tidak dipasang karena temanya terang. Tanpa
    // itu, tombolnya berkata "menyala" sementara SIPP tampak tidak berubah -
    // dan yang membacanya menyimpulkan saklarnya rusak.
    const keadaanSipp = !temaSippMenyala
      ? "mati"
      : temaSekarang === "gelap"
        ? "menyala"
        : "menyala, tetapi tidak dipasang pada tema terang";
    tombol.title =
      `Ganti ke tema ${temaSekarang === "gelap" ? "terang" : "gelap"}. ` +
      `Tahan Shift untuk ${temaSippMenyala ? "mematikan" : "menyalakan"} tema gelap pada halaman SIPP ` +
      `(sekarang ${keadaanSipp}). Tema terang selalu mengembalikan SIPP seperti semula.`;
  };
  perbaruiJudul();

  tombol.addEventListener("click", (peristiwa) => {
    if (peristiwa.shiftKey) {
      temaSippMenyala = !temaSippMenyala;
    } else {
      temaSekarang = temaSekarang === "gelap" ? "terang" : "gelap";
    }
    // Tampilan didahulukan; penyimpanan menyusul. Lihat catatan yang sama di
    // alatTombolKepala - menunggu chrome.storage membuat tombolnya terasa
    // tidak berfungsi, dan yang menekannya menekan sekali lagi.
    alatTanpaTransisi(() => {
      panel.setAttribute("data-tema", temaSekarang);
      terapkanTemaSipp();
      perbaruiJudul();
    });
    try {
      void chrome.storage.local.set({
        [KUNCI_TEMA]: temaSekarang,
        [KUNCI_TEMA_SIPP]: temaSippMenyala,
      });
    } catch {
      /* tidak tersimpan - temanya tetap berlaku untuk halaman ini */
    }
  });

  return tombol;
}

function kembalikanBawaan(panel) {
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

/**
 * Memasang lencananya dan pendengar yang membentangkannya kembali.
 *
 * Logonya dari berkas ekstensi, bukan huruf yang digambar dengan CSS: yang
 * melayang di atas halaman aplikasi lain harus dapat dikenali dalam sekejap
 * sebagai milik ALETA, dan sekejap itu tidak cukup untuk membaca.
 *
 * Tarikan DIBEDAKAN dari klik lewat JARAK, bukan waktu - lihat pasangGeser,
 * yang menandai panel dengan data-baru-digeser. Tanpa pembeda itu tiap
 * tarikan berakhir dengan lencana yang terbentang kembali, sebab tiap
 * tarikan diakhiri satu klik di atas lencananya.
 */
function pasangLencana(panel) {
  const lencana = buatElemen("div", "aleta-lencana");
  let alamatLogo = "";
  try {
    alamatLogo = chrome.runtime.getURL("ikon/aleta-32.png");
  } catch {
    /* di luar ekstensi - huruf yang dipakai sebagai gantinya */
  }
  if (alamatLogo) {
    const gambar = document.createElement("img");
    gambar.src = alamatLogo;
    gambar.alt = "ALETA";
    gambar.draggable = false;
    lencana.appendChild(gambar);
  } else {
    lencana.textContent = "A";
  }
  panel.appendChild(lencana);

  const bentangkan = (peristiwa) => {
    if (!panel.classList.contains(KELAS_LENCANA)) return;
    if (panel.dataset.baruDigeser === "1") {
      // Tarikan, bukan klik. Penandanya dilepas supaya klik BERIKUTNYA -
      // yang jarinya diam - dapat membentangkan.
      delete panel.dataset.baruDigeser;
      return;
    }
    peristiwa.preventDefault();
    peristiwa.stopPropagation();
    ciutkanKeLencana(panel, false);
  };
  lencana.addEventListener("click", bentangkan);
  lencana.addEventListener("dblclick", (peristiwa) => {
    delete panel.dataset.baruDigeser;
    bentangkan(peristiwa);
  });
  return lencana;
}

/** Menjaga panel tetap terlihat walau jendela diperkecil setelah digeser. */
function jepitKeLayar(kiri, atas, lebar, tinggi) {
  const batasKiri = Math.min(Math.max(kiri, 0), Math.max(window.innerWidth - lebar, 0));
  const batasAtas = Math.min(Math.max(atas, 0), Math.max(window.innerHeight - 40, 0));
  return { kiri: batasKiri, atas: batasAtas };
}

function terapkanPosisi(panel, posisi) {
  keadaanPanel = posisi ? { ...posisi } : null;
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

/**
 * Mengingat ukuran sesudah petugas selesai menarik sudutnya.
 *
 * Ditunda sejenak: menarik sudut memicu puluhan peristiwa per detik, dan
 * menulis penyimpanan sebanyak itu membuat tarikannya sendiri tersendat.
 */
function pasangPengingatUkuran(panel) {
  if (typeof ResizeObserver !== "function") return;
  let tunda = null;
  let pertama = true;

  const pengamat = new ResizeObserver(() => {
    // Pengukuran pertama datang dari penggambaran, bukan dari tarikan orang.
    if (pertama) {
      pertama = false;
      return;
    }
    if (tunda) clearTimeout(tunda);
    tunda = setTimeout(() => {
      const kotak = panel.getBoundingClientRect();
      simpanUkuran(Math.round(kotak.width), Math.round(kotak.height));
      panel.style.maxHeight = "none";
    }, 400);
  });

  pengamat.observe(panel);
}

/**
 * Menjadikan kepala panel sebagai pegangan geser.
 *
 * Tombol di dalam kepala TIDAK ikut memulai geseran - kalau ikut, menekan
 * tombol lipat akan tertangkap sebagai awal geseran dan tombolnya jadi sulit
 * ditekan.
 */
/**
 * ============================================================================
 * MENARIK PANEL DARI SEGALA SISI
 * ============================================================================
 *
 * Delapan pegangan: empat sisi dan empat sudut.
 *
 * Menarik tepi KIRI atau ATAS mengubah dua hal sekaligus - ukurannya dan
 * tempatnya - sebab tepi seberangnya harus tetap diam. Menaruh lebar baru
 * tanpa memindahkan panelnya membuat seluruh panel ikut melompat ke kiri,
 * dan tarikan yang seharusnya memperlebar justru terasa menggeser.
 *
 * Batas dijepit LEBIH DULU, baru tempatnya dihitung dari ukuran yang sudah
 * dijepit itu. Kalau urutannya dibalik, panel yang sudah menyentuh lebar
 * minimum masih terus bergeser mengikuti kursor walau ukurannya berhenti
 * berubah - tepi seberang yang seharusnya diam malah berjalan sendiri.
 */
const ARAH_TARIK = [
  { nama: "u", x: 0, y: -1, sudut: false },
  { nama: "s", x: 0, y: 1, sudut: false },
  { nama: "b", x: -1, y: 0, sudut: false },
  { nama: "t", x: 1, y: 0, sudut: false },
  { nama: "ub", x: -1, y: -1, sudut: true },
  { nama: "ut", x: 1, y: -1, sudut: true },
  { nama: "sb", x: -1, y: 1, sudut: true },
  { nama: "st", x: 1, y: 1, sudut: true },
];

/** Sama dengan min-width/min-height di panel.css - dijaga sepasang. */
const TARIK_LEBAR_MIN = 260;
const TARIK_TINGGI_MIN = 150;

function pasangUbahUkuran(panel) {
  for (const arah of ARAH_TARIK) {
    const pegangan = buatElemen("div", "aleta-tarik aleta-tarik--" + arah.nama);
    if (arah.sudut) pegangan.classList.add("aleta-tarik--sudut");

    pegangan.addEventListener("pointerdown", (peristiwa) => {
      if (peristiwa.button !== 0) return;

      const kotak = panel.getBoundingClientRect();
      const mulaiX = peristiwa.clientX;
      const mulaiY = peristiwa.clientY;
      const awalKiri = kotak.left;
      const awalAtas = kotak.top;
      const awalLebar = kotak.width;
      const awalTinggi = kotak.height;

      // Batas atas dihitung sekali di awal tarikan, bukan tiap gerakan:
      // membaca innerWidth puluhan kali per detik memaksa peramban
      // menghitung ulang tata letak halaman SIPP di belakangnya.
      const lebarMaks = Math.min(window.innerWidth - 20, 900);
      const tinggiMaks = window.innerHeight - 20;

      const jepit = (nilai, kecil, besar) => Math.min(Math.max(nilai, kecil), Math.max(besar, kecil));

      const saatGerak = (gerak) => {
        const geserX = gerak.clientX - mulaiX;
        const geserY = gerak.clientY - mulaiY;

        let lebar = awalLebar;
        let tinggi = awalTinggi;
        let kiri = awalKiri;
        let atas = awalAtas;

        if (arah.x === 1) {
          lebar = jepit(awalLebar + geserX, TARIK_LEBAR_MIN, lebarMaks);
        } else if (arah.x === -1) {
          lebar = jepit(awalLebar - geserX, TARIK_LEBAR_MIN, lebarMaks);
          // Tepi kanan tetap di tempatnya.
          kiri = awalKiri + (awalLebar - lebar);
        }

        if (arah.y === 1) {
          tinggi = jepit(awalTinggi + geserY, TARIK_TINGGI_MIN, tinggiMaks);
        } else if (arah.y === -1) {
          tinggi = jepit(awalTinggi - geserY, TARIK_TINGGI_MIN, tinggiMaks);
          // Tepi bawah tetap di tempatnya.
          atas = awalAtas + (awalTinggi - tinggi);
        }

        if (arah.x !== 0) {
          panel.style.width = lebar + "px";
          panel.style.left = Math.max(kiri, 0) + "px";
          panel.style.right = "auto";
        }
        if (arah.y !== 0) {
          panel.style.height = tinggi + "px";
          panel.style.top = Math.max(atas, 0) + "px";
          panel.style.bottom = "auto";
          // Batas bawaan dilepas begitu tingginya diatur sendiri - kalau
          // tidak, panel setinggi apa pun tetap terpotong pada batas itu.
          panel.style.maxHeight = "none";
        }
      };

      const saatLepas = () => {
        document.removeEventListener("pointermove", saatGerak);
        document.removeEventListener("pointerup", saatLepas);
        document.removeEventListener("pointercancel", saatLepas);
        document.body.classList.remove("aleta-mengubah-ukuran");

        const akhir = panel.getBoundingClientRect();
        simpanUkuran(Math.round(akhir.width), Math.round(akhir.height));
        simpanPosisi(Math.round(akhir.left), Math.round(akhir.top));
      };

      // Dipasang pada document: kursor kerap mendahului tepi panel saat
      // ditarik cepat, dan pegangan selebar enam piksel tidak akan sempat
      // menerima gerakannya sendiri.
      document.addEventListener("pointermove", saatGerak);
      document.addEventListener("pointerup", saatLepas);
      document.addEventListener("pointercancel", saatLepas);
      document.body.classList.add("aleta-mengubah-ukuran");
      peristiwa.preventDefault();
      peristiwa.stopPropagation();
    });

    panel.appendChild(pegangan);
  }
}

function pasangGeser(panel, kepala) {
  let menggeser = false;
  let mulaiX = 0;
  let mulaiY = 0;
  let awalKiri = 0;
  let awalAtas = 0;

  panel.addEventListener("mousedown", (peristiwa) => {
    if (peristiwa.button !== 0) return;
    if (peristiwa.target.closest("button, a, input, select, textarea, .aleta-warna-pilih")) return;
    // ========================================================================
    // LENCANA DIGESER DARI LENCANANYA, PANEL DARI KEPALANYA
    // ========================================================================
    //
    // Pendengar ini dulu dipasang pada KEPALA panel, dan kepala itu
    // display:none begitu panelnya menjadi lencana - sehingga lencana yang
    // dijanjikan dapat digeser sesungguhnya tidak pernah dapat digeser sama
    // sekali. Satu-satunya jalan menyingkirkannya adalah membentangkannya
    // kembali lalu menggeser panelnya, yaitu justru yang tidak diinginkan
    // orang yang baru saja menciutkannya.
    //
    // Sekarang dipasang pada panel, dengan pagar ini: panel yang terbentang
    // tetap hanya digeser dari kepalanya - menyeret badannya berarti menyeret
    // teks yang sedang dibaca - sedangkan lencana digeser dari mana saja.
    if (!panel.classList.contains(KELAS_LENCANA) && !kepala.contains(peristiwa.target)) return;
    // Pegangan tarik menindih enam piksel teratas kepala panel. Tanpa penjaga
    // ini, menarik tepi atas menggeser DAN mengubah ukuran sekaligus - panel
    // melompat menjauh dari kursor sambil memendek. pointerdown tidak dapat
    // menghentikan mousedown lewat stopPropagation, sebab keduanya deretan
    // peristiwa yang terpisah, jadi penjaganya harus di sini.
    if (peristiwa.target.closest(".aleta-tarik")) return;

    const kotak = panel.getBoundingClientRect();
    menggeser = true;
    mulaiX = peristiwa.clientX;
    mulaiY = peristiwa.clientY;
    awalKiri = kotak.left;
    awalAtas = kotak.top;

    panel.classList.add("aleta-menggeser");
    peristiwa.preventDefault();
  });

  const saatGerak = (peristiwa) => {
    if (!menggeser) return;
    // Ambang empat piksel memisahkan TARIKAN dari KLIK. Dibaca pendengar
    // klik pada panel yang sedang berbentuk logo: tanpa pembeda ini, tiap
    // tarikan berakhir dengan logo yang terbentang kembali - sebab tiap
    // tarikan diakhiri satu klik di atas logonya, dan logonya jadi terasa
    // tidak dapat dipindahkan sama sekali.
    if (Math.abs(peristiwa.clientX - mulaiX) > 4 || Math.abs(peristiwa.clientY - mulaiY) > 4) {
      panel.dataset.baruDigeser = "1";
    }
    const kotak = panel.getBoundingClientRect();
    const aman = jepitKeLayar(
      awalKiri + (peristiwa.clientX - mulaiX),
      awalAtas + (peristiwa.clientY - mulaiY),
      kotak.width,
      kotak.height
    );
    panel.style.left = `${aman.kiri}px`;
    panel.style.top = `${aman.atas}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
  };

  const saatLepas = () => {
    if (!menggeser) return;
    menggeser = false;
    panel.classList.remove("aleta-menggeser");
    const kotak = panel.getBoundingClientRect();
    simpanPosisi(Math.round(kotak.left), Math.round(kotak.top));
  };

  // Dipasang pada document, bukan pada panel: kursor kerap keluar dari panel
  // saat digeser cepat, dan tanpa ini panel tersangkut mengikuti kursor.
  document.addEventListener("mousemove", saatGerak);
  document.addEventListener("mouseup", saatLepas);
}

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
 * Menyalin teks ke papan klip.
 *
 * SIPP berjalan di HTTP, dan navigator.clipboard hanya tersedia pada konteks
 * aman. Jadi jalur cadangan di bawah bukan kemewahan - itulah yang biasanya
 * dipakai.
 *
 * Cadangannya memakai pemilihan teks pada elemen buatan sendiri, BUKAN
 * textarea yang diisi lewat .value. Mengisi .value adalah satu-satunya cara
 * ekstensi ini dapat menulis ke kolom formulir, dan kemampuan itu sengaja
 * tidak dimilikinya sama sekali - halaman SIPP memuat kolom yang mengubah
 * data perkara, dan larangan yang tidak punya pengecualian jauh lebih mudah
 * dijaga daripada larangan yang punya satu.
 */
async function salinTeks(teks) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(teks);
      return true;
    }
  } catch {
    /* jatuh ke cara cadangan */
  }

  try {
    const wadah = buatElemen("span", "aleta-salinan-sementara", teks);
    wadah.setAttribute(TANDA, "1");
    document.body.appendChild(wadah);

    const jangkauan = document.createRange();
    jangkauan.selectNodeContents(wadah);
    const pilihan = window.getSelection();
    pilihan.removeAllRanges();
    pilihan.addRange(jangkauan);

    const berhasil = document.execCommand("copy");

    pilihan.removeAllRanges();
    wadah.remove();
    return berhasil;
  } catch {
    return false;
  }
}

/** Baris nomor register e-Court beserta tombol salinnya. */
/**
 * Nilai yang disalin dengan menekannya.
 *
 * Tanpa tombol "Salin" tersendiri di sebelahnya - tombol itu memakan lebar
 * yang setara dengan nomor perkaranya sendiri, pada panel selebar 340 piksel.
 * Yang menggantikannya: nilainya sendiri dapat ditekan, dan berubah sebentar
 * jadi "Tersalin" supaya penekanannya terasa berhasil.
 */
function tombolSalin(nilai, judul) {
  const tombol = buatElemen("button", "aleta-salin-nilai", nilai);
  tombol.type = "button";
  tombol.title = judul || "Salin";
  tombol.addEventListener("click", async (peristiwa) => {
    peristiwa.stopPropagation();
    const semula = tombol.textContent;
    const berhasil = await salinTeks(nilai);
    tombol.textContent = berhasil ? "Tersalin" : "Gagal salin";
    tombol.classList.add("aleta-salin-berhasil");
    setTimeout(() => {
      tombol.textContent = semula;
      tombol.classList.remove("aleta-salin-berhasil");
    }, 1200);
  });
  return tombol;
}

function barisNomorRegister(nomorRegister) {
  const baris = buatElemen("div", "aleta-register");
  baris.appendChild(buatElemen("span", "aleta-register-label", "Register e-Court"));
  baris.appendChild(buatElemen("code", "aleta-register-nilai", nomorRegister));

  const tombol = buatElemen("button", "aleta-salin", "Salin");
  tombol.type = "button";
  // SIPP tidak menampilkan nomor register di mana pun, padahal itulah yang
  // dipakai untuk mencari perkara di e-Court. Selama ini petugas mengambilnya
  // lewat database.
  tombol.title = "Salin nomor register untuk dicari di e-Court";
  tombol.addEventListener("click", async () => {
    const berhasil = await salinTeks(nomorRegister);
    tombol.textContent = berhasil ? "Tersalin" : "Gagal salin";
    setTimeout(() => {
      tombol.textContent = "Salin";
    }, 1500);
  });

  baris.appendChild(tombol);
  return baris;
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
 * Penanda identitas perkara: jenis perkara, kumulasi, dan kuasa hukum.
 *
 * ============================================================================
 * TIDAK ADA PENANDA LEBIH BAIK DARIPADA PENANDA YANG KELIRU
 * ============================================================================
 *
 * Bila SIPP tidak terbaca, bot mengirim identitas bernilai null. Dalam keadaan
 * itu baris ini TIDAK muncul sama sekali. Menampilkan "tanpa kuasa" ketika yang
 * sebenarnya terjadi adalah "tidak terbaca" akan membuat petugas menyurati
 * pihak secara langsung padahal pihaknya berkuasa hukum - keliru yang tidak
 * kelihatan sampai suratnya sudah terkirim.
 */
function barisIdentitas(identitas) {
  if (!identitas || !identitas.ditemukan) return null;

  const baris = buatElemen("div", "aleta-identitas");

  if (identitas.jenisPerkara) {
    const chip = buatElemen("span", `aleta-tanda-jenis ${kelasJenis(identitas.jenisPerkara)}`, identitas.jenisPerkara);
    if (identitas.jenisPerkaraLengkap && identitas.jenisPerkaraLengkap !== identitas.jenisPerkara) {
      chip.title = identitas.jenisPerkaraLengkap;
    }
    baris.appendChild(chip);
  }

  if (identitas.adaKumulasi) {
    const chip = buatElemen("span", "aleta-tanda-kumulasi", `Kumulasi: ${identitas.kumulasi.join(", ")}`);
    chip.title = `Perkara ini dikumulasikan dengan ${identitas.kumulasi.length} jenis perkara lain.`;
    baris.appendChild(chip);
  }

  if (identitas.adaKuasa) {
    // Sisi mana yang berkuasa hukum menentukan kepada siapa pemberitahuan
    // dialamatkan - "pakai kuasa" saja tidak cukup untuk memutuskan itu.
    const sisi = [];
    if (identitas.kuasaPenggugat) sisi.push("penggugat/pemohon");
    if (identitas.kuasaTergugat) sisi.push("tergugat/termohon");

    const chip = buatElemen(
      "span",
      "aleta-tanda-kuasa",
      sisi.length > 0 ? `Kuasa: ${sisi.join(" & ")}` : "Pakai kuasa hukum"
    );
    chip.title = identitas.kuasa
      .map((k) => (k.pihak ? `${k.nama} (${k.pihak})` : k.nama))
      .join("\n");
    baris.appendChild(chip);
  }
  // Yang TIDAK berkuasa hukum tidak diberi chip. "Tanpa kuasa hukum" adalah
  // keadaan sebagian besar perkara, dan chip yang ada di hampir setiap
  // perkara berhenti dibaca - lalu chip kuasa yang sungguhan, yang jarang
  // dan justru menentukan kepada siapa surat dialamatkan, ikut tidak dibaca.

  return baris.childNodes.length > 0 ? baris : null;
}

/**
 * Membandingkan versi yang TERPASANG dengan versi yang disajikan portal.
 *
 * ============================================================================
 * MENGAPA INI ADA
 * ============================================================================
 *
 * Ekstensi yang dimuat unpacked - dan begitulah cara ekstensi ini dipasang -
 * TIDAK PERNAH diperbarui sendiri. Chrome memang tidak menyediakannya. Yang
 * terjadi kemudian: petugas berhari-hari menjalankan versi lama tanpa satu pun
 * tanda, dan gejalanya menyerupai kerusakan portal.
 *
 * Itu bukan dugaan. Pada 3 September 2026 tombol Kerjakan tidak muncul, dan
 * waktu terbuang mencari sebabnya di portal - padahal ekstensinya memang belum
 * diperbarui.
 *
 * ============================================================================
 * MENYERAH DIAM-DIAM
 * ============================================================================
 *
 * Bila alamatnya tidak terjangkau, jawabannya tidak dikenali, atau versinya
 * sama - TIDAK ada yang digambar. Pemberitahuan versi bukan hal yang layak
 * merusak panel bila pemeriksaannya sendiri gagal.
 */
function bandingVersi(a, b) {
  const pecah = (x) => String(x || "").split(".").map((n) => Number(n) || 0);
  const kiri = pecah(a);
  const kanan = pecah(b);
  for (let i = 0; i < Math.max(kiri.length, kanan.length); i += 1) {
    const selisih = (kiri[i] || 0) - (kanan[i] || 0);
    if (selisih !== 0) return selisih;
  }
  return 0;
}

async function periksaVersiEkstensi(isi) {
  let terpasang = "";
  try {
    terpasang = String(chrome.runtime.getManifest().version || "");
  } catch {
    return; // di luar konteks ekstensi
  }
  if (!terpasang) return;

  try {
    const respons = await fetch(`${ALETA_API_EKSTENSI}?info=versi`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!respons.ok) return;
    const luar = await respons.json();
    const data = luar && luar.data ? luar.data : luar;
    const disajikan = String((data && data.versi) || "");
    if (!disajikan) return;

    // Hanya bila portal LEBIH BARU. Versi pengembangan yang lebih maju daripada
    // portal tidak perlu ditegur.
    if (bandingVersi(disajikan, terpasang) <= 0) return;

    const kabar = buatElemen("div", "aleta-versi-baru");
    kabar.appendChild(
      buatElemen(
        "div",
        "aleta-versi-judul",
        `Versi baru tersedia: ${disajikan} — terpasang ${terpasang}`
      )
    );
    kabar.appendChild(
      buatElemen(
        "div",
        "aleta-versi-sebab",
        "Ekstensi tidak memperbarui dirinya sendiri. Unduh dari portal ALETA, lalu tekan Muat Ulang di halaman Ekstensi Chrome."
      )
    );
    isi.insertBefore(kabar, isi.firstChild);
  } catch {
    /* portal tidak terjangkau - panel tetap utuh tanpa pemberitahuan */
  }
}

/**
 * ============================================================================
 * SATU DERET TOMBOL KEPALA, DIPAKAI SEMUA PANEL
 * ============================================================================
 *
 * Dulu hanya panel PERKARA yang punya deretan lengkapnya. Panel daftar
 * perkara - yang tampil di dashboard, daftar perdata, dan tiap halaman SIPP
 * yang bukan halaman perkara - hanya punya tema dan tutup.
 *
 * Akibatnya persis yang dilaporkan: di halaman perkara panelnya dapat
 * diciutkan, dilayarpenuhkan, dan dikembalikan; di halaman lain tidak ada satu
 * pun dari ketiganya. Satu ekstensi dengan dua perilaku pada dua halaman
 * terbaca sebagai ekstensi yang rusak di salah satunya.
 *
 * Sekarang deretnya satu, dan keduanya memakainya.
 */
function pasangTombolKepala(panel, kepala, keadaanAwal) {
  let keadaanPanel = keadaanAwal || null;
  // Tombol tema - lihat pasangTema().
  // ==========================================================================
  // TOMBOL KEPALA DI KANAN, DALAM URUTAN YANG SAMA DENGAN PANEL ABT DAN ALETA
  // ==========================================================================
  //
  // Kedua panel itu menaruh tombolnya di dalam .aleta-alat-kepala, yang
  // margin-left: auto - tombolnya di ujung kanan, merek di kiri. Panel ini
  // menempelkannya langsung ke kepala satu per satu, sehingga seluruhnya
  // berkumpul di sebelah merek dengan ruang kosong di kanan. Tiga panel
  // satu ekstensi yang kepalanya berbeda-beda mengajari orang bahwa
  // ketiganya alat yang berbeda.
  //
  // Urutannya mengikuti panel-alat: tema, ciutkan, layar penuh, bawaan,
  // tutup - supaya jari yang sudah hafal di satu panel tidak salah tekan di
  // panel lain.
  const alatKepala = buatElemen("span", "aleta-alat-kepala");

  // Lingkungan lebih dahulu daripada chip peran: yang menentukan aman atau
  // tidaknya sebuah tekanan bukan siapa Anda, melainkan SIPP yang mana.
  const lencanaLingkungan = alatLencanaLingkungan(penggunaTerakhir && penggunaTerakhir.peran);
  if (lencanaLingkungan) alatKepala.appendChild(lencanaLingkungan);
  alatTandaiLingkungan(panel);
  // Didaftarkan supaya warna dari popup menemukannya - dan supaya pelepasan
  // warna panel ini dikenali alatSelaraskanWarna. temaHalaman sengaja false:
  // tema halaman SIPP diurus terapkanTemaSipp di berkas ini, dan dua yang
  // mengurus hal yang sama akan saling menimpa.
  alatDaftarkanPanelTema(panel, { temaHalaman: false }, KUNCI_POSISI);
  alatPasangGulir(panel);
  // Chip peran berdiri PALING KIRI di deret ini - tepat sebelum tombol
  // tema. Ia keterangan, bukan tombol, dan menaruhnya di tengah deret
  // tombol membuat orang mencoba menekannya.
  if (penggunaTerakhir && penggunaTerakhir.peran) {
    const chipPeran = buatElemen(
      "span",
      `aleta-kepala-peran ${alatKelasPeran(penggunaTerakhir.peran)}`,
      penggunaTerakhir.peran
    );
    chipPeran.title = `Peran Anda di ALETA: ${penggunaTerakhir.peran}.`;
    alatKepala.appendChild(chipPeran);
    // Perannya ikut ditandai pada AKAR panel, bukan hanya pada chipnya -
    // dari situlah rel gradasi di tepi atas panel mengambil warnanya. Satu
    // atribut, dan ketiga panel ikut tanpa satu baris tambahan.
    alatTandaiPeranPanel(panel, penggunaTerakhir.peran);
  }
  alatKepala.appendChild(tombolTema(panel));
  // Enam warna gelap super admin - ikon saja, sesudah tombol tema. Panel
  // SIPP menyusun kepalanya sendiri, jadi pemilihnya dipasang di sini; yang
  // tersimpan dipulihkan lebih dulu supaya titik yang aktif benar.
  void alatWarnaTersimpan().then((warna) => {
    alatTerapkanWarna(panel, warna, false);
    alatPemilihWarna(panel, alatKepala, { peran: penggunaTerakhir && penggunaTerakhir.peran });
    alatTombolPerkakas(panel, alatKepala, {
      peran: penggunaTerakhir && penggunaTerakhir.peran,
      perkara: cariNomorPerkara(),
      akun: {
        aleta: penggunaTerakhir && penggunaTerakhir.nama ? `ALETA ${penggunaTerakhir.nama}` : "",
        sipp: akunSipp() ? `SIPP ${akunSipp()}` : "",
      },
    });
  });

  // ==========================================================================
  // LAYAR PENUH DAN CIUT MENJADI LOGO
  // ==========================================================================
  //
  // Dua kebutuhan yang berlawanan, dan keduanya nyata pada hari kerja yang
  // sama:
  //
  //   LAYAR PENUH  ketika membaca daftar panjang - tahapan, berkas, penilaian.
  //                Panel selebar 340 piksel memaksa menggulung untuk sesuatu
  //                yang sebenarnya muat pada layar.
  //   LOGO         ketika sedang mengisi formulir SIPP dan panelnya menghalangi.
  //                Menciutkan ke kepala saja masih menyisakan sebatang kotak
  //                selebar panel yang menutupi kolom di bawahnya.
  //
  // Keduanya dapat dibatalkan dengan menekan tombol yang sama, dan keduanya
  // TIDAK menghapus posisi tersimpan - panel kembali ke tempatnya semula.
  const penuh = buatElemen("button", "aleta-penuh", "⛶");
  penuh.type = "button";
  penuh.title = "Layar penuh";
  penuh.addEventListener("click", () => {
    const sedangPenuh = panel.classList.toggle("aleta-panel-penuh");
    penuh.textContent = sedangPenuh ? "⤢" : "⛶";
    penuh.title = sedangPenuh ? "Keluar dari layar penuh" : "Layar penuh";
    // Gaya inline dari geser dan ubah ukuran harus MENGALAH pada layar penuh,
    // kalau tidak panel tetap terpaku di tempat lamanya walau kelasnya ganti.
    // Nilainya tidak dibuang - hanya dilepas, dan dipasang kembali saat keluar.
    if (sedangPenuh) {
      for (const sifat of ["left", "top", "width", "height", "maxHeight"]) {
        panel.style[sifat] = "";
      }
    } else if (keadaanPanel) {
      terapkanPosisi(panel, keadaanPanel);
    }
  });
  alatKepala.appendChild(penuh);


  // Lencana melayang beserta pendengar yang membentangkannya kembali -
  // lihat pasangLencana. Satu bentuk yang sama dengan panel ABT dan panel
  // halaman ALETA.
  pasangLencana(panel);

  // ==========================================================================
  // ESCAPE DAN KLIK GANDA DI LUAR - DUA JALAN KELUAR YANG SELAMA INI HILANG
  // ==========================================================================
  //
  // Keduanya dipasang alatPasangJalanKeluar, dan alatPasangJalanKeluar hanya
  // dipanggil dari alatPasangPanel - satu-satunya pintu yang TIDAK dilewati
  // panel SIPP. Panel ini menyusun kepalanya sendiri (lihat catatan di atas)
  // dan memasang geser serta ubah-ukurannya sendiri pula, sehingga kedua
  // jalan keluar itu tidak pernah sampai ke sini.
  //
  // Itulah "klik dua kali dan escape tidak berfungsi di sipp": bukan
  // pendengarnya yang salah, melainkan tidak ada satu pun pendengar yang
  // dipasang.
  //
  // Menciutnya lewat ciutkanKeLencana milik berkas ini, bukan alatCiutkan:
  // keadaan lencana panel SIPP disimpan lewat simpanKeadaanPanel, dan dua
  // penyimpan untuk satu keadaan akan saling menimpa.
  alatPasangJalanKeluar(panel, KUNCI_POSISI, {
    ciutkan: () => ciutkanKeLencana(panel, true),
  });

  // Tombol kembali ke bawaan.
  //
  // Panel yang dapat digeser dan diubah ukurannya juga dapat tersesat: ditarik
  // ke luar layar, dikecilkan sampai tidak terbaca, atau dilebarkan menutupi
  // SIPP. Tanpa jalan pulang, satu-satunya cara memperbaikinya adalah membongkar
  // penyimpanan ekstensi - dan tidak ada petugas yang akan melakukan itu.
  const bawaan = buatElemen("button", "aleta-bawaan", "↺");
  bawaan.type = "button";
  bawaan.title = "Kembalikan ukuran dan posisi panel ke semula";
  bawaan.addEventListener("click", () => kembalikanBawaan(panel));
  alatKepala.appendChild(bawaan);

  // ==========================================================================
  // MENCIUTKAN BERARTI MENJADI LOGO - BUKAN MENYISAKAN KOTAK
  // ==========================================================================
  //
  // Dulu ada DUA tombol: berlian yang menciutkan menjadi logo, dan minus yang
  // menyembunyikan isi tetapi menyisakan kepalanya - sebatang kotak selebar
  // panel yang menutupi kolom di bawahnya tanpa menampilkan satu pun
  // keterangan. Yang kedua itu yang dilaporkan sebagai "kotak melayang".
  //
  // Dua tombol yang sama-sama "mengecilkan" tetapi menghasilkan bentuk yang
  // berbeda menuntut orang mengingat bedanya. Sekarang satu, dan hasilnya
  // yang memang berguna: logo bulat yang dapat digeser dan dibuka lagi
  // dengan satu klik.
  const lipat = buatElemen("button", "aleta-lipat", "–");
  lipat.type = "button";
  lipat.title = "Ciutkan menjadi lencana";
  lipat.addEventListener("click", () => {
    panel.classList.remove("aleta-panel-ciut");
    ciutkanKeLencana(panel, true);
  });
  // Ciutkan berdiri TEPAT sesudah tema, sebelum layar penuh - urutan
  // panel-alat. insertBefore, sebab tombol layar penuh sudah lebih dulu
  // dibuat di atas.
  alatKepala.insertBefore(lipat, penuh);

  // Saklar mati di kepala panel.
  //
  // Saklarnya memang sudah ada di popup ekstensi, tetapi popup itu berada
  // di bilah ekstensi Chrome - tempat yang harus dicari lebih dulu. Petugas
  // yang panelnya menghalangi pekerjaan butuh mematikannya SEKARANG, dan
  // yang tidak menemukan saklarnya akan menutup panel berulang kali setiap
  // halaman - lalu berhenti memakai ekstensinya sama sekali.
  alatKepala.appendChild(tombolMatikan());
  kepala.appendChild(alatKepala);
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
  barisKaki.appendChild(pintasan);

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

/** Jati diri perkara yang dibawa pita, dari konteks panel perkara. */
/**
 * Kelas warna chip menurut KELUARGA jenis perkara.
 *
 * Cerai gugat dan cerai talak tampil sama persis selama ini, padahal
 * keduanya berbeda alur, berbeda pihak yang berperkara, dan berbeda medan
 * yang muncul pada borang putusan. Warnanya kini menyebut keluarganya, dan
 * dipakai pada chip pita DAN chip identitas di badan panel - dua chip untuk
 * satu jenis harus berwarna sama, atau keduanya berhenti dipercaya.
 *
 * Urutan pemeriksaannya penting: ekonomi syariah adalah gugatan, dan cerai
 * talak memuat kata "talak" yang tidak ada pada cerai gugat - jadi keduanya
 * diperiksa SEBELUM pola gugat yang lebih umum.
 */
function kelasJenis(jenis) {
  const j = String(jenis || "").toLowerCase();
  if (!j) return "aleta-jenis-lain";
  if (/syariah|ekonomi/.test(j)) return "aleta-jenis-syariah";
  if (/talak/.test(j)) return "aleta-jenis-talak";
  if (/gugat/.test(j)) return "aleta-jenis-gugat";
  if (
    /dispensasi|itsbat|isbat|wali|permohonan|penetapan|pdt\.?\s*p\b|poligami|perwalian|pengangkatan|asal.usul|ahli\s*waris/.test(
      j
    )
  ) {
    return "aleta-jenis-permohonan";
  }
  return "aleta-jenis-lain";
}

/**
 * ============================================================================
 * NOMOR PERKARA: KLIK MENUKAR, KLIK GANDA MENYALIN
 * ============================================================================
 *
 * Nomor perkara dipakai di SIPP; nomor register dipakai di e-Court. Petugas
 * yang berpindah antara keduanya membutuhkan yang satu lalu yang lain, dan
 * menyalinnya adalah pekerjaan yang paling sering dikerjakan di baris ini.
 *
 * Klik tunggal ditunda sekejap dan dibatalkan oleh klik ganda - tanpa
 * penundaan itu, tiap klik ganda menukar nomornya dua kali lalu menyalin
 * yang tampil sesudahnya, yakni yang semula. Yang disalin selalu yang sedang
 * TAMPIL, sebab itulah yang dilihat orang ketika menekannya.
 *
 * Menggantikan dua tombol salin yang dulu terpisah - nomor perkara di baris
 * kedua, nomor register di baris ketiga. Satu tempat untuk keduanya.
 */
function tombolNomorTukar(nomorPerkara, nomorRegister) {
  const nomor = String(nomorPerkara || "");
  const register = String(nomorRegister || "");
  const kotakNomor = buatElemen("span", "aleta-nomor-tukar", nomor);
  kotakNomor.setAttribute("role", "button");
  kotakNomor.tabIndex = 0;
  let tampilRegister = false;
  const judul = () =>
    register
      ? `${tampilRegister ? "Nomor register e-Court" : "Nomor perkara"}. Klik: tukar ke ${
          tampilRegister ? "nomor perkara" : "nomor register e-Court"
        }. Klik ganda: salin.`
      : "Nomor perkara yang sedang dibuka. Klik ganda: salin.";
  const gambar = () => {
    kotakNomor.textContent = tampilRegister ? register : nomor;
    kotakNomor.classList.toggle("aleta-nomor-tukar-register", tampilRegister);
    // Petunjuk dua detik memindahkan title ke data-aleta-tip pada sentuhan
    // pertama; keduanya diperbarui supaya penjelasannya mengikuti keadaan.
    kotakNomor.title = judul();
    if (kotakNomor.hasAttribute("data-aleta-tip")) kotakNomor.setAttribute("data-aleta-tip", judul());
  };
  gambar();
  let jamKlik = null;
  kotakNomor.addEventListener("click", () => {
    if (!register) return;
    if (jamKlik) clearTimeout(jamKlik);
    jamKlik = setTimeout(() => {
      jamKlik = null;
      tampilRegister = !tampilRegister;
      gambar();
    }, 250);
  });
  kotakNomor.addEventListener("dblclick", async () => {
    if (jamKlik) {
      clearTimeout(jamKlik);
      jamKlik = null;
    }
    const berhasil = await salinTeks(tampilRegister ? register : nomor);
    if (!berhasil) return;
    kotakNomor.classList.add("aleta-nomor-tukar-tersalin");
    setTimeout(() => kotakNomor.classList.remove("aleta-nomor-tukar-tersalin"), 700);
  });
  return kotakNomor;
}

function jatiPita(konteks) {
  const identitas = (konteks && konteks.identitas) || {};
  return {
    nomorPerkara: (konteks && konteks.nomorPerkara) || "",
    // Nomor register e-Court - yang dicari petugas di aplikasi e-Court, dan
    // yang selama ini harus dibuka lewat bagian tersendiri. Di pita ia
    // ditukar dengan satu klik.
    nomorRegister: (konteks && konteks.nomorRegister) || "",
    jenisPerkara: identitas.jenisPerkara || "",
    jenisPerkaraLengkap: identitas.jenisPerkaraLengkap || "",
  };
}

function susunPanel(konteks) {
  const panel = buatElemen("div", "aleta-panel");
  panel.id = PENANDA;

  // --- Kepala ---
  const kepala = buatElemen("div", "aleta-kepala");

  // Logo lembaga di kepala panel.
  //
  // Panel ini melayang di atas halaman SIPP dan tampilannya menyerupai bagian
  // SIPP sendiri. Logo membuat asalnya terbaca sekilas - siapa yang berbicara
  // di sini - tanpa perlu membaca tulisan apa pun.
  //
  // Berkasnya diambil lewat chrome.runtime.getURL: alamat chrome-extension://
  // yang benar hanya diketahui peramban. Bila gagal - berkas belum diumumkan
  // sebagai sumber terjangkau - logonya dilepas, dan kepalanya tetap utuh.
  try {
    const logo = document.createElement("img");
    logo.className = "aleta-logo";
    logo.alt = "";
    logo.src = chrome.runtime.getURL("ikon/aleta-32.png");
    logo.addEventListener("error", () => logo.remove());
    kepala.appendChild(logo);
  } catch {
    /* di luar konteks ekstensi: kepala tetap tampil tanpa logo */
  }

  kepala.appendChild(buatElemen("span", "aleta-merek", "ALETA"));

  // ==========================================================================
  // AKUN SIPP YANG SEDANG MASUK - DAN EMPAT KETERANGAN LAINNYA
  // ==========================================================================
  //
  // Satu keterangan yang menjawab pertanyaan paling menentukan sebelum menekan
  // apa pun: SIPP ini sedang dibuka dengan akun siapa. Selama ini jawabannya
  // hanya ada di sudut kanan atas halaman SIPP - tertutup panel ini sendiri
  // pada layar sempit, dan tidak terlihat sama sekali ketika panel dilebarkan.
  //
  // Dibaca dari halaman, bukan dari server: SIPP tidak menyediakan cara lain,
  // dan yang tertulis di halaman itulah yang menentukan siapa yang tercatat
  // ketika tombol Simpan SIPP ditekan.
  //
  // Bila tidak terbaca, TIDAK ditulis apa-apa. Menuliskan "tidak diketahui" di
  // kepala panel hanya menambah satu kata yang harus dibaca tiap kali tanpa
  // pernah menjawab apa pun.
  // Digambar oleh pitaIdentitas - bentuk yang sama persis dengan kaki panel.
  kepala.appendChild(pitaIdentitas(jatiPita(konteks)));

  pasangTombolKepala(panel, kepala, keadaanPanel);

  panel.appendChild(kepala);
  pasangGeser(panel, kepala);
  pasangUbahUkuran(panel);
  pasangPengingatUkuran(panel);

  const isi = buatElemen("div", "aleta-isi");
  panel.appendChild(isi);

  // Pemberitahuan versi ditaruh PALING ATAS, sebelum keterangan perkara.
  //
  // Ekstensi yang dimuat unpacked tidak pernah memperbarui dirinya sendiri.
  // Bila yang terpasang tertinggal dari portal, gejalanya menyerupai kerusakan
  // portal - tombol yang tidak muncul, jawaban yang tidak dikenali - dan yang
  // dicari orang adalah kesalahan di tempat yang salah.
  void periksaVersiEkstensi(isi);

  // ==========================================================================
  // KEPALA PANEL: DUA BARIS, BUKAN ENAM
  // ==========================================================================
  //
  // Sebelumnya enam baris berdiri sendiri-sendiri sebelum menu pertama: umur
  // data, pengguna, klasifikasi, kuasa hukum, nomor register, dan ringkasan.
  // Keenamnya keterangan pendukung, dan keenamnya memakan tinggi yang sama
  // dengan enam baris menu - padahal yang dicari orang menunya.
  //
  // Sekarang dua: baris pertama tentang PERKARANYA, baris kedua tentang SIAPA
  // yang membaca dan sejauh mana datanya. Tidak ada yang dibuang.
  const usia = usiaData(konteks.diperiksaPada);

  // ------------------------------------------------------------------------
  // BARIS PERTAMA BADAN: NOMOR YANG DAPAT DITUKAR DAN CHIP IDENTITAS
  // ------------------------------------------------------------------------
  //
  // Nomor perkara dan nomor register e-Court berdiri di satu tempat ini:
  // klik menukar, klik ganda menyalin yang sedang tampil. Dulu keduanya dua
  // tombol salin terpisah di dua baris, dan pita di kepala mengulang
  // nomornya sekali lagi - tiga tempat untuk satu nomor.
  const barisPerkara = buatElemen("div", "aleta-kepala-perkara");
  if (konteks.nomorPerkara) {
    barisPerkara.appendChild(tombolNomorTukar(konteks.nomorPerkara, konteks.nomorRegister || ""));
  }

  // Chip identitas dipindahkan ke baris ini apa adanya - jenis perkara,
  // kumulasi, dan kuasa hukum tetap lengkap dengan judul dan warnanya.
  const identitas = barisIdentitas(konteks.identitas);
  if (identitas) {
    while (identitas.firstChild) barisPerkara.appendChild(identitas.firstChild);
  }
  if (barisPerkara.childNodes.length > 0) isi.appendChild(barisPerkara);

  // --- Baris 2: siapa membaca, dan sejauh mana datanya ---------------------
  const barisSiapa = buatElemen("div", "aleta-kepala-siapa");
  // Nama pengguna TIDAK diulang di sini - ia sudah berdiri di pita, satu
  // baris di atasnya. Chip perannya pindah ke kepala, berdampingan dengan
  // tombol tema: di sana ia terbaca sekilas tanpa menuntut baris tersendiri.
  // Nomor register tidak lagi punya tombolnya sendiri di sini - ia dapat
  // ditukar dari nomor perkara di baris pertama badan (tombolNomorTukar).

  // Umur data TIDAK ikut dipadatkan ketika ia bermasalah. Yang basi tetap
  // mendapat barisnya sendiri dan warnanya sendiri - itu satu-satunya
  // keterangan di kepala yang dapat membatalkan seluruh isi panel di bawahnya.
  if (usia.basi) {
    if (barisSiapa.childNodes.length > 0) isi.appendChild(barisSiapa);
    const tanda = buatElemen(
      "div",
      "aleta-usia aleta-usia-basi",
      `Data ALETA diperiksa ${usia.teks}`
    );
    tanda.title = "Data mungkin tertinggal dari e-Court.";
    isi.appendChild(tanda);
  } else {
    barisSiapa.appendChild(buatElemen("span", "aleta-kepala-usia", `diperiksa ${usia.teks}`));
    isi.appendChild(barisSiapa);
  }
  const r = konteks.ringkasan;
  const seketika = ringkasanSeketika(konteks);

  // Menu yang lencananya diisi panggilan latar. Dikumpulkan supaya dapat
  // diisi belakangan tanpa mencari-cari elemennya lagi di DOM.
  const menuMalas = {};

  // Daftar menu hidup dikosongkan tiap panel digambar ulang. Dibiarkan
  // bertambah, ia akan menyimpan menu dari perkara-perkara sebelumnya yang
  // elemennya sudah dibuang dari halaman - dan menggambar ulang menu yang
  // sudah tidak ada memanggil ALETA untuk sesuatu yang tidak ada yang melihat.
  menuMalasHidup = [];
  const kelompokSemua = [];

  /** Membuat menu malas sekaligus mendaftarkannya untuk diberi lencana. */
  const malas = (judul, kunci, gambar) => {
    const kotak = bagianMalas(judul, kunci, konteks.nomorPerkara, gambar);
    menuMalas[kunci] = kotak;
    return kotak;
  };

  // ==========================================================================
  // KERJAKAN DI PALING ATAS, DAN SATU-SATUNYA YANG TERBUKA
  // ==========================================================================
  //
  // Panel ini dibuka orang yang sedang MENGERJAKAN perkara, bukan yang sedang
  // membacanya. Sebelumnya Kerjakan duduk paling bawah di balik tiga kelompok
  // keterangan, sehingga menetapkan satu perkara menuntut menggulung melewati
  // berkas, tahapan, dan putusan lebih dahulu - tiap kali, untuk tiap perkara.
  //
  // Ketiga kelompok lain kini terlipat seluruhnya. Kepalanya tetap menyebutkan
  // yang paling genting di dalamnya, jadi yang hanya ingin membaca tidak
  // kehilangan apa pun - ia menekan sekali, dan itu memang niatnya.
  //
  // Digambar hanya bila perannya memang berwenang. Sebelumnya ketiganya tetap
  // muncul untuk semua orang dan baru menolak sesudah ditekan.
  // Kelompok ini digambar bila SALAH SATU isinya boleh dipakai. Menuntut
  // keduanya akan menyembunyikan Data Umum dari operator penjaga sidang, yang
  // justru dibuat untuk itu; menuntut salah satunya lalu menggambar keduanya
  // akan menawarkan papan penunjukan kepada yang tidak berwenang.
  if (boleh("penunjukan") || boleh("data-umum")) {
    const kelKerja = kelompok("Penetapan", "kerjakan", false);

    if (boleh("penunjukan")) kelKerja.isi.appendChild(bagianPenunjukan(konteks.nomorPerkara));
    if (boleh("data-umum")) kelKerja.isi.appendChild(bagianDataUmum(konteks));


    // Dan hanya di layar Info Perkara Agama (Data Umum). Dikenali dari borangnya
    // sendiri (#frm_data_umum) dengan alasan yang sama: alamat SIPP berubah
    // bentuk antar versi, id borangnya tidak.
    if (boleh("data-umum") && document.querySelector("#frm_data_umum")) {
      kelKerja.isi.appendChild(bagianIsiAlasanPerkara(konteks.nomorPerkara));
    }

    // Alat pemasangan, bukan keterangan perkara - jawabannya sama pada perkara
    // mana pun. Dibatasi ke Super Admin dan Admin, yang memang satu-satunya
    // yang dapat menyunting peta kolomnya.
    if (boleh("penunjukan-otomatis") && penggunaTerakhir && /admin/i.test(penggunaTerakhir.peran || "")) {
      kelKerja.isi.appendChild(bagianBacaBorang());
    }

    // Riwayat perbuatan ALETA pada perkara ini - termasuk yang gagal.
    // Ditaruh di kelompok yang sama dengan yang mengerjakannya: yang
    // bertanya "tadi jadi tidak?" sedang menatap tombol Tetapkan, bukan
    // sedang mencari menu lain.
    if (boleh("penunjukan")) kelKerja.isi.appendChild(bagianRiwayatAleta(konteks.nomorPerkara));

    isi.appendChild(kelKerja);
    kelompokSemua.push(kelKerja);
  }

  // ==========================================================================
  // KELOMPOK BERKAS
  // ==========================================================================
  //
  // Dokumen yang masuk, tenggat yang berjalan, dan berkas yang belum lengkap.
  const kelBerkas = kelompok("Berkas", "berkas", true);

  // Selisih dengan e-Court paling atas: ia satu-satunya yang menyatakan ada
  // yang KELIRU, bukan sekadar belum selesai.
  if (konteks.selisih.length > 0) {
    const kotak = bagian("Tidak cocok dengan e-Court", "selisih");
    setLencana(kotak, seketika.selisih);
    for (const item of konteks.selisih) {
      const baris = buatElemen(
        "div",
        `aleta-baris aleta-${item.kegentingan === "tinggi" ? "lewat" : "mendesak"}`
      );
      baris.appendChild(buatElemen("div", "aleta-baris-judul", item.judulDokumen || "Dokumen"));
      baris.appendChild(buatElemen("div", "aleta-baris-ket", item.penjelasan));
      kotak.isi.appendChild(baris);
    }
    kelBerkas.isi.appendChild(kotak);
  }

  const berTenggat = konteks.dokumen.filter((d) => d.batasUnggahTeks || d.sisaHari !== null);
  if (berTenggat.length > 0) {
    const kotak = bagian("Batas waktu unggah e-Court", "tenggat");
    setLencana(kotak, seketika.tenggat);
    for (const d of berTenggat) {
      const sisa = keteranganSisa(d.sisaHari, konteks.ambangMendesakHari);
      const baris = buatElemen("div", `aleta-baris${sisa ? ` aleta-${sisa.nada}` : ""}`);
      baris.appendChild(
        buatElemen("div", "aleta-baris-judul", d.judulDokumen || d.agenda || "Dokumen")
      );
      const ket = buatElemen("div", "aleta-baris-ket");
      ket.textContent = d.batasUnggahTeks || "";
      if (sisa) {
        const tanda = buatElemen("span", `aleta-tanda-panel aleta-tanda-${sisa.nada}`, sisa.teks);
        ket.appendChild(document.createTextNode(" "));
        ket.appendChild(tanda);
      }
      baris.appendChild(ket);
      kotak.isi.appendChild(baris);
    }
    kelBerkas.isi.appendChild(kotak);
  }

  if (konteks.dokumen.length > 0) {
    const kotak = bagian("Dokumen e-Court", "dokumen");
    setLencana(kotak, seketika.dokumen);
    for (const d of konteks.dokumen) {
      const baris = buatElemen("div", "aleta-baris");
      baris.appendChild(buatElemen("div", "aleta-baris-judul", d.judulDokumen || "Dokumen"));

      const bagianKet = [];
      if (d.peranPengunggah) bagianKet.push(`dari ${d.peranPengunggah}`);
      if (d.statusVerifikasi === "tidak_perlu") {
        bagianKet.push("berkas pendaftaran");
      } else if (d.statusVerifikasi === "valid") {
        bagianKet.push("sudah diverifikasi");
      } else if (d.statusVerifikasi === "tidak_valid") {
        bagianKet.push("dinyatakan tidak valid");
      } else {
        bagianKet.push("menunggu majelis");
      }
      if (d.sudahDiberitahukan) bagianKet.push("pihak sudah diberi tahu");
      else if (d.alasanTidakDiberitahukan) {
        bagianKet.push(d.alasanTidakDiberitahukan.replace(/_/g, " "));
      }
      baris.appendChild(buatElemen("div", "aleta-baris-ket", bagianKet.join(" · ")));

      const tombolBerkas = buatElemen("div", "aleta-berkas");
      if (d.adaPdf) tombolBerkas.appendChild(tombolUnduh(d, "pdf", "PDF"));
      if (d.adaWord) tombolBerkas.appendChild(tombolUnduh(d, "word", "Word"));
      if (!d.adaPdf && !d.adaWord) {
        tombolBerkas.appendChild(
          buatElemen("span", "aleta-berkas-kosong", "berkas belum tersimpan")
        );
      }
      baris.appendChild(tombolBerkas);

      // Tombol verifikasi hanya untuk hakim pada majelis perkara ini, dan
      // hanya untuk dokumen yang belum diverifikasi. Jawaban "boleh atau
      // tidak" datang dari server - ekstensi tidak menebaknya sendiri.
      // Berkas pendaftaran tidak dapat diverifikasi di e-Court, jadi
      // tombolnya tidak boleh muncul: menampilkannya berarti mengundang hakim
      // mengambil keputusan hukum atas dokumen yang tidak menunggu keputusan
      // apa pun.
      if (
        konteks.hakim &&
        konteks.hakim.bolehVerifikasi &&
        d.statusVerifikasi !== "valid" &&
        d.statusVerifikasi !== "tidak_perlu"
      ) {
        baris.appendChild(kotakVerifikasi(d));
      }
      kotak.isi.appendChild(baris);
    }
    kelBerkas.isi.appendChild(kotak);
  }

  kelBerkas.isi.appendChild(malas("Kelengkapan berkas SIPP", "berkasSipp", gambarBerkasSipp));
  isi.appendChild(kelBerkas);
  kelompokSemua.push(kelBerkas);

  // ==========================================================================
  // KELOMPOK 2 - PERKARA
  // ==========================================================================
  //
  // Bagaimana perkara ini berjalan: tahapannya sampai mana, nomor pihaknya
  // sudah dikonfirmasi belum, dan bagaimana penilaiannya menurut SK.
  //
  // Tertutup sebagai bawaan - pertanyaannya penting tetapi tidak mendesak,
  // dan kepalanya sudah menyebutkan yang paling genting di dalamnya.
  const kelPerkara = kelompok("Perkara", "perkara", true);
  kelPerkara.isi.appendChild(malas("Tahapan dan ketepatan input", "tahapan", gambarTahapan));

  // Menu Nomor pihak ikut dimatikan bersama penandanya - lihat
  // TANDAI_NOMOR_PIHAK. Menyisakan menunya di panel sementara penandanya
  // hilang dari halaman menghasilkan dua keterangan yang berselisih tentang
  // hal yang sama.
  if (TANDAI_NOMOR_PIHAK && konteks.nomorPihak.length > 0) {
    // Nomor pihak terlipat sendiri di dalam kelompoknya: keadaan nomor jarang
    // jadi alasan orang membuka panel ini, dan daftar nomor yang selalu
    // terbuka memajang data pribadi lebih lama daripada perlu.
    const kotak = bagian("Nomor pihak", "nomorPihak", true);
    setLencana(kotak, seketika.nomorPihak);
    for (const orang of konteks.nomorPihak) {
      const keadaan = orang.adaNomor
        ? STATUS_NOMOR[orang.statusVerifikasi] || STATUS_NOMOR.belum_pernah_ditanya
        : { teks: "tidak ada nomor di SIPP", nada: "lewat" };

      const baris = buatElemen("div", `aleta-baris aleta-${keadaan.nada}`);
      baris.appendChild(buatElemen("div", "aleta-baris-judul", orang.nama));
      baris.appendChild(
        buatElemen(
          "div",
          "aleta-baris-ket",
          `${orang.nomorSamar ? `${orang.nomorSamar} · ` : ""}${keadaan.teks}`
        )
      );
      kotak.isi.appendChild(baris);
    }
    kelPerkara.isi.appendChild(kotak);
  }

  kelPerkara.isi.appendChild(malas("Penilaian SK 048/2024", "penilaianSk", gambarPenilaian));
  isi.appendChild(kelPerkara);
  kelompokSemua.push(kelPerkara);

  // ==========================================================================
  // KELOMPOK 3 - PUTUSAN
  // ==========================================================================
  //
  // Pada perkara yang belum putus, kedua menu di dalamnya memang kosong - dan
  // kepalanya menyebutkan "belum putus" tanpa perlu dibuka. Itulah yang dulu
  // menuntut membuka dua menu untuk menemukan dua keterangan kosong.
  // ==========================================================================
  // PUTUSAN OTOMATIS DUDUK DI KELOMPOK PUTUSAN, BUKAN PENETAPAN
  // ==========================================================================
  //
  // Sebelumnya ia duduk di kelompok Penetapan, bersama papan penunjukan
  // majelis dan Data Umum. Itu keliru dua kali: yang mencarinya orang yang
  // sedang membuka borang Putusan Akhir, dan yang dikerjakannya putusan -
  // bukan penetapan. Yang mencari fitur ini membuka kelompok Putusan lebih
  // dahulu, tidak menemukannya, lalu menyimpulkan fiturnya tidak ada.
  //
  // Kelompoknya juga DIBENTANGKAN ketika borang putusan sedang terbuka.
  // Yang sedang berdiri di layar Putusan Akhir tidak sedang menunggu
  // diminta menekan satu lipatan lagi.
  const adaBorangPutusan = Boolean(document.querySelector("#frm_putusan"));
  const kelPutusan = kelompok("Putusan", "putusanKel", !adaBorangPutusan);
  if (boleh("data-umum") && adaBorangPutusan) {
    kelPutusan.isi.appendChild(bagianIsiPutusan(konteks.nomorPerkara));
  }
  // Unggahan MENULIS ke SIPP - berkas ke cakram, empat baris ke basis
  // datanya - jadi kewenangannya "penunjukan", sama dengan menuliskan
  // penetapan. Tidak digantungkan pada borang putusan yang terbuka: berkas
  // putusan kerap diunggah belakangan, pada hari yang lain.
  if (boleh("penunjukan")) {
    kelPutusan.isi.appendChild(bagianUnggahPutusanSipp(konteks.nomorPerkara));
  }
  // Antrean putusan massal - bila ada, disisipkan di puncak isi supaya
  // langkah yang sedang ditunggu terbaca lebih dulu daripada perkaranya.
  if (boleh("data-umum")) {
    void bagianAntreanSipp(konteks.nomorPerkara).then((k) => {
      if (k && isi.isConnected) isi.insertBefore(k, isi.firstChild);
    });
  }
  kelPutusan.isi.appendChild(malas("Putusan dan upaya hukum", "putusan", gambarPutusan));
  kelPutusan.isi.appendChild(malas("Putusan di e-Court", "putusanEcourt", gambarPutusanEcourt));
  isi.appendChild(kelPutusan);
  kelompokSemua.push(kelPutusan);

  // --- Tidak ada apa-apa untuk perkara ini ---
  if (r.dokumen === 0 && konteks.nomorPihak.length === 0) {
    isi.appendChild(
      buatElemen("div", "aleta-kosong", "Belum ada data e-Court untuk perkara ini di ALETA.")
    );
  }

  for (const kel of kelompokSemua) kel.perbaruiRingkas();

  // ==========================================================================
  // LENCANA YANG MENYUSUL
  // ==========================================================================
  //
  // Lima menu di atas berbagi SATU panggilan, dan hasilnya memang sudah
  // disimpan per nomor perkara - membuka salah satunya sudah menarik data
  // kelimanya. Yang dikerjakan di sini hanya memajukan panggilan itu supaya
  // lencananya terisi tanpa ada yang perlu membuka apa pun.
  //
  // DITUNDA dan di latar, bukan sebelum panel digambar. Panelnya tetap muncul
  // seketika seperti sebelumnya; lencananya menyusul sedetik kemudian. Kalau
  // dijalankan lebih dulu, seluruh panel menunggu satu panggilan yang bahkan
  // belum tentu ada yang membutuhkannya.
  //
  // Kegagalannya DIABAIKAN diam-diam: lencana adalah kenyamanan, dan menu yang
  // gagal memuat sudah menyebutkan sebabnya sendiri saat dibuka.
  const tundaLencana = setTimeout(() => {
    void (async () => {
      try {
        const status = await ambilStatusPerkara(konteks.nomorPerkara);
        const ringkas = ringkasanBagian(status);
        for (const [kunci, nilai] of Object.entries(ringkas)) {
          setLencana(menuMalas[kunci], nilai);
        }
        for (const kel of kelompokSemua) kel.perbaruiRingkas();
      } catch (galat) {
        /* lencana tidak terisi - menunya tetap dapat dibuka seperti biasa */
      }
    })();
  }, 900);

  // Dibatalkan bila panelnya digambar ulang sebelum panggilannya berangkat -
  // berpindah perkara dengan cepat tidak boleh meninggalkan antrean panggilan
  // untuk perkara yang sudah tidak dilihat siapa pun.
  panel.batalLencana = () => clearTimeout(tundaLencana);

  // Kaki = kepala. Satu fungsi menggambar keduanya; lihat pitaIdentitas.
  panel.appendChild(kakiPanel(jatiPita(konteks)));

  return panel;
}

/**
 * Panel saat peran pengguna tidak diberi akses.
 *
 * ============================================================================
 * DITOLAK BUKAN BELUM MASUK
 * ============================================================================
 *
 * Sebelumnya 403 diperlakukan sama dengan 401, sehingga pengguna yang sudah
 * masuk tetapi tidak berwenang diminta "Masuk ke ALETA" - lalu masuk, lalu
 * ditolak lagi, tanpa pernah diberi tahu apa yang sebenarnya terjadi.
 *
 * Pesannya tidak menyebut kemampuan apa yang kurang secara rinci. Yang perlu
 * diketahui pengguna adalah kepada siapa harus meminta, bukan bagian mana dari
 * penjagaan yang menahannya.
 */
/**
 * Tombol matikan di kepala panel.
 *
 * Dulu disusun sebaris di dalam susunPanel, sehingga panel daftar - yang lahir
 * belakangan - tidak punya tombolnya sama sekali. Satu aturan di satu tempat:
 * tiap panel yang punya kepala mendapat tombol yang sama persis.
 */
function tombolMatikan() {
  const matikan = buatElemen("button", "aleta-matikan", "×");
  matikan.type = "button";
  matikan.title = "Matikan ALETA E-Court untuk halaman ini (dapat dinyalakan lagi dari ikon ekstensi)";
  matikan.addEventListener("click", () => {
    try {
      void chrome.storage.local.set({ aktif: false });
    } catch {
      // Penyimpanan tidak tersedia: panel tetap ditutup untuk halaman ini.
      const lama = document.getElementById(PENANDA);
      if (lama) lama.remove();
    }
  });
  return matikan;
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

/**
 * ============================================================================
 * PANEL UNTUK HALAMAN DAFTAR PERKARA
 * ============================================================================
 *
 * Sebelumnya panel HANYA muncul di halaman satu perkara. Di halaman daftar -
 * tempat petugas menghabiskan sebagian besar waktunya, memindai puluhan baris
 * sekaligus - tidak ada apa pun dari ALETA. Yang membukanya menyimpulkan
 * ekstensinya mati, lalu memuat ulang halaman, lalu melapor rusak.
 *
 * Isinya sengaja sedikit dan hanya yang benar-benar menjawab pertanyaan
 * halaman ini: dari sekian perkara di layar, berapa yang perlu diperiksa, dan
 * karena apa. Rincian tiap perkara sudah tertempel pada barisnya masing-masing;
 * mengulanginya di sini hanya menambah tempat kedua yang harus dibaca.
 */
const NAMA_KEADAAN = {
  ghaib: "pihak ghaib",
  izinAtasan: "perlu izin atasan",
  verzet: "verzet",
  prodeo: "prodeo",
  kuasa: "memakai kuasa hukum",
  mafqud: "diduga mafqud",
};

/**
 * ============================================================================
 * PENETAPAN MASSAL DARI HALAMAN DAFTAR PERKARA
 * ============================================================================
 *
 * Pendaftaran satu pagi kerap berisi belasan perkara, dan keempat penetapan
 * tiap perkara menuntut membuka halamannya satu per satu. Panel ini sudah
 * membaca seluruh nomor perkara di halaman daftar - ia hanya belum pernah
 * boleh mengerjakan apa-apa dengannya.
 *
 * ============================================================================
 * TIGA PAGAR YANG MEMBUATNYA TIDAK MENJADI ALAT PERUSAK MASSAL
 * ============================================================================
 *
 *   1. TIDAK ADA yang tercentang sendiri. Menetapkan seluruh halaman hanya
 *      karena tombolnya tertekan adalah kesalahan yang tidak dapat
 *      dibatalkan dengan satu tekanan pula.
 *   2. DUA tekanan, sama seperti satu perkara: yang pertama menjalankan uji
 *      kering atas TIAP perkara terpilih dan memperlihatkan hasilnya baris
 *      demi baris, yang kedua menuliskannya.
 *   3. Berhenti pada kegagalan PERTAMA. Kegagalan pada penetapan massal
 *      hampir selalu bersifat menyeluruh - ALETA mati, akun pejabat keliru,
 *      kewenangan dicabut - dan meneruskannya berarti mengulang kesalahan
 *      yang sama belasan kali sebelum ada yang sempat membacanya.
 *
 * Perkara yang keempat penetapannya SUDAH ada dilewati tanpa berbunyi; itu
 * bukan kegagalan, itu perkara yang memang sudah dikerjakan.
 */
const BATAS_PERKARA_MASSAL = 25;

/** Urutan rantai penetapan - sama dengan urutan rantaiPenetapan itu sendiri. */
const URUTAN_RANTAI = ["pmh", "ppp", "pjs", "phs"];

/**
 * Langkah yang MASIH kurang pada satu perkara.
 *
 * Kosong berarti keempatnya sudah ada. Bila keadaannya tidak diketahui -
 * SIPP tidak terbaca, atau perkaranya tidak ada pada ringkasan - keempatnya
 * dianggap kurang. Menganggapnya lengkap berarti menyembunyikan perkara yang
 * barangkali justru belum ditetapkan sama sekali, dan itu kekeliruan yang
 * tidak terlihat siapa pun.
 */
function langkahKurang(keadaan) {
  if (!keadaan) return [...URUTAN_RANTAI];
  return URUTAN_RANTAI.filter((x) => keadaan[x] !== true);
}

function bagianPenetapanMassal(ringkasan) {
  const kotak = bagian("Penetapan massal", "penetapanMassal", true);

  const baris = barisPerkaraDiHalaman();
  if (baris.length < 2) {
    kotak.isi.appendChild(
      buatElemen("div", "aleta-kosong", "Halaman ini bukan daftar perkara.")
    );
    return kotak;
  }

  // ==========================================================================
  // YANG SUDAH LENGKAP TIDAK DITAWARKAN SAMA SEKALI
  // ==========================================================================
  //
  // Sebelumnya seluruh perkara di halaman ditawarkan, termasuk yang keempat
  // penetapannya sudah lengkap sejak berbulan-bulan lalu. Petugas
  // mencentangnya, menunggu, lalu diberi tahu "sudah ditetapkan" satu per
  // satu - dan daftar yang sebagian besar isinya tidak dapat dikerjakan
  // mengajari orang untuk berhenti membacanya.
  //
  // Yang TANGGUNG justru ditawarkan, dan inilah tambahannya: perkara yang
  // PMH-nya sudah ada tetapi PPP, PJS, dan PHS-nya belum dapat dilanjutkan
  // dari tempat ia berhenti. Rantai penetapan memang sudah melewati langkah
  // yang ada; yang kurang hanya menawarkannya.
  const keadaanPer = (ringkasan && ringkasan.penetapan) || {};
  const seluruhNomor = [...new Set(baris.map((x) => x.nomor))];
  const kurangPer = new Map();
  for (const nomor of seluruhNomor) {
    const kurang = langkahKurang(keadaanPer[nomor]);
    if (kurang.length > 0) kurangPer.set(nomor, kurang);
  }
  const sudahLengkap = seluruhNomor.length - kurangPer.size;

  if (kurangPer.size === 0) {
    kotak.isi.appendChild(
      buatElemen(
        "div",
        "aleta-kosong",
        `Keempat penetapan sudah lengkap pada ${seluruhNomor.length} perkara di halaman ini. Tidak ada yang perlu dikerjakan.`
      )
    );
    return kotak;
  }

  const nomorSemua = [...kurangPer.keys()].slice(0, BATAS_PERKARA_MASSAL);
  const terpilih = new Set();

  // Disebut apa adanya bila halamannya memuat lebih banyak daripada yang
  // ditawarkan. "25 perkara terbaca" pada halaman berisi lima puluh perkara
  // adalah kalimat yang keliru, dan yang membacanya akan menyangka
  // setengah halamannya tidak terbaca ALETA.
  kotak.isi.appendChild(
    buatElemen(
      "div",
      "aleta-tetap-sebab",
      `${nomorSemua.length} perkara masih ada penetapan yang belum dikerjakan` +
        (kurangPer.size > nomorSemua.length
          ? ` (dari ${kurangPer.size}; yang ditawarkan ${nomorSemua.length} pertama)`
          : "") +
        (sudahLengkap
          ? `. ${sudahLengkap} perkara lain di halaman ini sudah lengkap dan tidak ditawarkan`
          : "") +
        ". Centang yang hendak ditetapkan — tidak ada yang tercentang sendiri."
    )
  );

  // Tiap perkara satu BUTIR: baris centangnya, lalu rinciannya di bawah -
  // lihat gambarRincianMassal. Belangnya per butir, bukan per baris.
  const daftar = buatElemen("div", "aleta-massal-daftar aleta-massal-daftar-penetapan");
  const kotakCentang = new Map();
  for (const nomor of nomorSemua) {
    const label = buatElemen("label", "aleta-massal-baris");
    const centang = document.createElement("input");
    centang.type = "checkbox";
    centang.className = "aleta-massal-centang";
    centang.addEventListener("change", () => {
      if (centang.checked) terpilih.add(nomor);
      else terpilih.delete(nomor);
      perbaruiTombol();
    });
    kotakCentang.set(nomor, centang);
    label.appendChild(centang);
    label.appendChild(buatElemen("span", "aleta-massal-nomor", nomor));
    // Apa yang kurang disebutkan sejak awal, bukan sesudah diperiksa. Yang
    // memilih perlu tahu ia sedang melanjutkan rantai yang tanggung, bukan
    // memulai dari nol.
    const kurang = kurangPer.get(nomor) || [];
    const awalnya =
      kurang.length === URUTAN_RANTAI.length
        ? "belum ditetapkan"
        : `kurang ${kurang.map((x) => x.toUpperCase()).join(
)}`;
    const keadaan = buatElemen("span", "aleta-massal-keadaan", awalnya);
    label.appendChild(keadaan);
    const butir = buatElemen("div", "aleta-massal-butir");
    butir.appendChild(label);
    daftar.appendChild(butir);
  }
  kotak.isi.appendChild(daftar);

  // ==========================================================================
  // SIDANG KELILING PADA PENETAPAN MASSAL
  // ==========================================================================
  //
  // Penetapan massal memang dipakai justru untuk sidang keliling: satu hari
  // keliling menghasilkan belasan perkara yang seluruhnya ditetapkan ke tempat
  // yang sama. Sampai sekarang panel ini tidak punya pilihan tempat sama
  // sekali, jadi seluruhnya tertulis "Ruang Sidang 1 Dalam Gedung" dengan
  // sidang_keliling nol.
  //
  // Gagalnya diam - penetapannya berhasil, berkasnya tercetak, sidangnya
  // digelar - dan yang menyadarinya baru penyusun laporan tahunan.
  //
  // HANYA TEMPATNYA yang disamakan, bukan tanggalnya. Tiap majelis punya hari
  // sidangnya sendiri, dan menyamakan tanggal seluruh perkara terpilih akan
  // menetapkan sidang pada hari majelisnya tidak bersidang - belasan perkara
  // sekaligus, dalam satu tekanan.
  const tempatMassal = { ruangan: "" };
  const saklarMassal = buatElemen("label", "aleta-pilih-bebas");
  const kotakMassal = document.createElement("input");
  kotakMassal.type = "checkbox";
  saklarMassal.appendChild(kotakMassal);
  saklarMassal.appendChild(
    buatElemen("span", "aleta-pilih-bebas-nama", "Sidang keliling - satu tempat untuk semuanya")
  );
  kotak.isi.appendChild(saklarMassal);

  const barisTempat = buatElemen("div", "aleta-massal-tempat");
  barisTempat.hidden = true;
  kotak.isi.appendChild(barisTempat);

  function gambarTempatMassal() {
    barisTempat.textContent = "";
    if (!kotakMassal.checked) {
      barisTempat.hidden = true;
      tempatMassal.ruangan = "";
      return;
    }
    barisTempat.hidden = false;

    if (ruanganTersimpan === null) {
      barisTempat.appendChild(buatElemen("div", "aleta-tetap-sebab", "Membaca daftar ruangan…"));
      void muatRuangan().then(() => gambarTempatMassal());
      return;
    }
    if (!ruanganTersimpan.length) {
      barisTempat.appendChild(
        buatElemen("div", "aleta-tetap-sebab", "Daftar ruangan tidak terbaca - tempatnya tidak dapat dipilih.")
      );
      return;
    }

    const SEBUT_MASSAL = {
      "dalam-gedung": "Dalam gedung",
      keliling: "Sidang keliling",
      terpadu: "Sidang terpadu",
    };
    // Keliling dan terpadu di atas: yang menyalakan saklar ini sedang mencari
    // salah satunya, bukan ruangan dalam gedung.
    const urut = [...ruanganTersimpan].sort((a, b) => {
      const luar = (r) => (r.sifat === "keliling" ? 0 : r.sifat === "terpadu" ? 1 : 2);
      return luar(a) - luar(b);
    });
    barisTempat.appendChild(
      pilihanOrang(
        "Ruang sidang",
        urut.map((r) => ({
          id: String(r.id),
          label:
            `${r.nama} — ${SEBUT_MASSAL[r.sifat] || r.sifat}` +
            (r.dipakai === undefined
              ? ""
              : r.dipakai > 0
                ? ` · ${r.dipakai} sidang 2 tahun terakhir`
                : " · belum pernah dipakai"),
        })),
        tempatMassal.ruangan,
        (nilai) => {
          tempatMassal.ruangan = nilai;
          gambarTempatMassal();
        }
      )
    );

    const dipilih = ruanganTersimpan.find((r) => String(r.id) === String(tempatMassal.ruangan));
    if (dipilih && dipilih.kua) {
      barisTempat.appendChild(
        buatElemen(
          "div",
          "aleta-tetap-hitung",
          `Tempat: ${dipilih.kua}${dipilih.kuaAlamat ? ` — ${dipilih.kuaAlamat}` : ""}`
        )
      );
    }
    barisTempat.appendChild(
      buatElemen(
        "div",
        "aleta-tetap-sebab",
        "Hanya TEMPATNYA yang disamakan. Hari sidang tiap perkara tetap mengikuti hari majelisnya."
      )
    );
  }

  kotakMassal.addEventListener("change", gambarTempatMassal);

  const pilihSemua = buatElemen("button", "aleta-portal-tautan", "Centang semua");
  pilihSemua.type = "button";
  pilihSemua.addEventListener("click", () => {
    const semuanyaTercentang = terpilih.size === nomorSemua.length;
    for (const [nomor, centang] of kotakCentang) {
      centang.checked = !semuanyaTercentang;
      if (centang.checked) terpilih.add(nomor);
      else terpilih.delete(nomor);
    }
    pilihSemua.textContent = semuanyaTercentang ? "Centang semua" : "Kosongkan centang";
    perbaruiTombol();
  });
  kotak.isi.appendChild(pilihSemua);

  const kaki = buatElemen("div", "aleta-tetap-kaki");
  const tombol = buatElemen("button", "aleta-tombol aleta-tombol-mati", "Periksa perkara terpilih");
  tombol.type = "button";
  tombol.disabled = true;
  const kabar = buatElemen("span", "aleta-tetap-sebab", "");
  kaki.appendChild(tombol);
  kaki.appendChild(kabar);
  kotak.isi.appendChild(kaki);

  let sudahDiperiksa = false;

  function perbaruiTombol() {
    // Mengubah centang SESUDAH diperiksa mengembalikan tombol ke tahap
    // memeriksa. Tanpa itu, tekanan kedua akan menuliskan perkara yang
    // rencananya tidak pernah diperlihatkan.
    sudahDiperiksa = false;
    tombol.textContent = terpilih.size ? `Periksa ${terpilih.size} perkara terpilih` : "Periksa perkara terpilih";
    tombol.disabled = terpilih.size === 0;
    tombol.classList.toggle("aleta-tombol-mati", terpilih.size === 0);
  }

  /** Menandai satu baris pada daftar - dipakai selagi berjalan. */
  function tandaiBaris(nomor, teks, nada) {
    const centang = kotakCentang.get(nomor);
    const induk = centang && centang.parentElement;
    const tempat = induk && induk.querySelector(".aleta-massal-keadaan");
    if (!tempat) return;
    tempat.textContent = teks;
    tempat.className = `aleta-massal-keadaan${nada ? ` aleta-lencana-${nada}` : ""}`;
  }

  /**
   * ==========================================================================
   * RINCIAN DI BAWAH TIAP PERKARA - YANG SELAMA INI HANYA DILIHAT PAPAN SATU
   * ==========================================================================
   *
   * Papan satu perkara menggambar rapor uji kering: majelis, panitera
   * pengganti, juru sita, hari sidang, dan ganjalannya (akhir pekan, kurang
   * dari tujuh hari, nilai sengketa kosong, pejabat berhalangan). Penetapan
   * massal hanya menulis "siap ditetapkan" - lalu menulis belasan penetapan
   * yang majelis dan hari sidangnya tidak pernah diperlihatkan.
   *
   * Rapornya rapor yang SAMA (raporPraperiksa), digambar ringkas di bawah
   * baris centangnya; andaian dari bot ("PHS dinilai seolah PMH sudah
   * tertulis") ikut tertera.
   */
  function gambarRincianMassal(nomor, rapor, hasil) {
    const centang = kotakCentang.get(nomor);
    const butir = centang && centang.parentElement && centang.parentElement.parentElement;
    if (!butir) return;
    let wadah = butir.querySelector(".aleta-massal-rincian");
    if (!wadah) {
      wadah = buatElemen("div", "aleta-massal-rincian");
      butir.appendChild(wadah);
    }
    wadah.textContent = "";
    const isiBaris = (rapor.baris || []).map((b) => `${b.label}: ${b.nilai}`).join(" · ");
    if (isiBaris) wadah.appendChild(buatElemen("div", "aleta-massal-rincian-isi", isiBaris));
    for (const ganjalan of rapor.ganjalan || []) {
      wadah.appendChild(buatElemen("div", "aleta-massal-ganjalan", ganjalan));
    }
    for (const satu of hasil || []) {
      for (const andaianBot of satu.andaian || []) {
        wadah.appendChild(
          buatElemen("div", "aleta-massal-rincian-isi", `Andaian ${String(satu.jenis).toUpperCase()}: ${andaianBot}`)
        );
      }
    }
    if (rapor.sudahAda && rapor.sudahAda.length > 0) {
      wadah.appendChild(
        buatElemen("div", "aleta-massal-rincian-isi", `Sudah ada di SIPP: ${rapor.sudahAda.join(", ")}.`)
      );
    }
  }

  async function jalankan(kering) {
    const urut = nomorSemua.filter((x) => terpilih.has(x));
    let berhasil = 0;
    let dilewati = 0;
    // Perkara yang sudah lolos uji kering di antrean ini - dikirim sebagai
    // andaian bagi perkara berikutnya, supaya gilirannya dihitung berurutan.
    // Pada penulisan sungguhan tidak diperlukan: yang sudah tertulis memang
    // sudah ada di basis data ketika perkara berikutnya diminta usulannya.
    const andaian = [];

    for (const nomor of urut) {
      tandaiBaris(nomor, kering ? "memeriksa…" : "menetapkan…", "");
      kabar.textContent = `${nomor} — ${kering ? "diperiksa" : "ditetapkan"}…`;

      let data;
      try {
        data = await ambilUsulanPenunjukan(nomor, null, kering ? andaian : []);
      } catch (galat) {
        tandaiBaris(nomor, String(galat.message || galat).slice(0, 60), "lewat");
        kabar.textContent = `Berhenti di ${nomor}: ${String(galat.message || galat).slice(0, 120)}`;
        return { berhasil, dilewati, berhentiDi: nomor };
      }

      const usulan = data && data.usulan;
      if (!usulan || usulan.ok === false) {
        tandaiBaris(nomor, "usulan tidak dapat disusun", "lewat");
        kabar.textContent = `Berhenti di ${nomor}: usulan tidak dapat disusun.`;
        return { berhasil, dilewati, berhentiDi: nomor };
      }

      // Tempat yang dipilih disisipkan ke tiap perkara - rantaiPenetapan
      // membacanya dari data.pilihanManual, tempat yang sama yang dipakai
      // papan satu perkara. Tanpa baris ini saklarnya tergambar tetapi tidak
      // mengubah apa pun.
      if (tempatMassal.ruangan) {
        data.pilihanManual = { ...(data.pilihanManual || {}), ruangan: tempatMassal.ruangan };
      }

      const hasil = await rantaiPenetapan(usulan, data, kering);
      const gagal = hasil.filter((x) => !x.ok);

      // Yang SUDAH ada bukan kegagalan - perkara itu memang sudah
      // dikerjakan, dan menyebutnya gagal membuat orang mencari kerusakan
      // yang tidak ada.
      const sudahAda = gagal.filter((x) => /_sudah_ada$/.test(String(x.alasan || "")));
      const gagalSungguhan = gagal.filter((x) => !/_sudah_ada$/.test(String(x.alasan || "")));
      const dikerjakan = hasil.filter((x) => x.ok).length;

      // Rincian yang akan (atau sudah) ditulis - dan, pada uji kering,
      // andaian bagi perkara berikutnya di antrean.
      gambarRincianMassal(nomor, raporPraperiksa(usulan, data, hasil), hasil);
      if (kering && gagalSungguhan.length === 0) {
        const satuAndaian = andaianDari(usulan, data.pilihanManual || {});
        if (satuAndaian) andaian.push(satuAndaian);
      }

      // Rantai yang TANGGUNG: sebagian langkahnya memang sudah ada, dan
      // sisanya baru saja dikerjakan. Itu keberhasilan, bukan kegagalan -
      // dan bukan pula "dilewati", sebab ada yang benar-benar tertulis.
      //
      // Sebelumnya keduanya tidak dibedakan: satu langkah yang sudah ada
      // membuat seluruh perkaranya dihitung sebagai dilewati, padahal tiga
      // langkah lainnya baru saja ditulis ke SIPP.
      if (gagalSungguhan.length === 0 && dikerjakan === 0) {
        dilewati += 1;
        tandaiBaris(nomor, "sudah ditetapkan", "aman");
        continue;
      }
      if (gagalSungguhan.length === 0 && sudahAda.length > 0) {
        berhasil += 1;
        tandaiBaris(
          nomor,
          `${kering ? "siap" : "selesai"} — ${dikerjakan} langkah, ${sudahAda.length} sudah ada`,
          "aman"
        );
        continue;
      }
      gagal.length = 0;
      gagal.push(...gagalSungguhan);

      if (gagal.length > 0) {
        const bunyiGagal = gagal[0].bunyi || gagal[0].alasan;
        tandaiBaris(nomor, `${gagal[0].jenis.toUpperCase()}: ${gagal[0].alasan}`.slice(0, 70), "lewat");
        // Kalimat penuhnya di kabar - baris daftarnya terlalu sempit untuk
        // kalimat yang menyebutkan jalan keluarnya, dan justru kalimat itulah
        // yang dicari orang ketika seluruh halaman berhenti di perkara pertama.
        kabar.textContent = `Berhenti di ${nomor} pada ${gagal[0].jenis.toUpperCase()}: ${bunyiGagal}`;
        return { berhasil, dilewati, berhentiDi: nomor };
      }

      berhasil += 1;
      tandaiBaris(nomor, kering ? "siap ditetapkan" : "ditetapkan", "aman");
    }

    return { berhasil, dilewati, berhentiDi: null };
  }

  tombol.addEventListener("click", async () => {
    tombol.disabled = true;

    if (!sudahDiperiksa) {
      const hasil = await jalankan(true);
      if (hasil.berhentiDi) {
        tombol.disabled = false;
        return;
      }
      sudahDiperiksa = true;
      kabar.textContent =
        `${hasil.berhasil} perkara siap ditetapkan` +
        (hasil.dilewati ? `, ${hasil.dilewati} sudah ditetapkan dan akan dilewati` : "") +
        ". Belum ada yang ditulis - rinciannya tertera di bawah tiap perkara, dihitung berurutan. Tekan sekali lagi untuk menetapkan.";
      tombol.textContent = `Tetapkan ${hasil.berhasil} perkara sekarang`;
      tombol.disabled = hasil.berhasil === 0;
      return;
    }

    const hasil = await jalankan(false);
    if (hasil.berhentiDi) {
      // Yang SUDAH tertulis disebutkan. Tanpa itu, yang membacanya tidak
      // tahu sampai mana halaman ini terkerjakan, dan menekan lagi dari awal.
      kabar.textContent += ` — ${hasil.berhasil} perkara sudah tertulis sebelum berhenti.`;
      tombol.disabled = false;
      return;
    }
    kabar.textContent =
      `Selesai: ${hasil.berhasil} perkara ditetapkan` +
      (hasil.dilewati ? `, ${hasil.dilewati} dilewati karena sudah ada` : "") +
      ". Muat ulang halaman daftar untuk melihat keadaannya yang baru.";
    tombol.textContent = "Selesai";
  });

  return kotak;
}

function susunPanelDaftar(ringkasan) {
  const panel = buatElemen("div", "aleta-panel");
  panel.id = PENANDA;

  const kepala = buatElemen("div", "aleta-kepala");

  // Logo dipasang di SINI juga, bukan hanya di panel perkara: dalam bentuk
  // logo melayang, logo inilah SATU-SATUNYA yang terlihat. Tanpa ia, yang
  // tersisa lingkaran kosong yang tidak dapat dikenali sebagai apa pun.
  try {
    const logo = document.createElement("img");
    logo.className = "aleta-logo";
    logo.alt = "";
    logo.src = chrome.runtime.getURL("ikon/aleta-32.png");
    logo.addEventListener("error", () => logo.remove());
    kepala.appendChild(logo);
  } catch {
    /* di luar konteks ekstensi: kepala tetap tampil tanpa logo */
  }

  kepala.appendChild(buatElemen("span", "aleta-merek", "ALETA"));
  // Pita yang sama dengan panel perkara - tanpa nomor, sebab halaman ini
  // memuat banyak perkara sekaligus.
  kepala.appendChild(pitaIdentitas({}));

  // Deret tombol yang SAMA dengan panel perkara - lihat pasangTombolKepala.
  // Sebelumnya hanya tema dan tutup, sehingga di dashboard dan daftar perkara
  // panelnya tidak dapat diciutkan maupun dilayarpenuhkan sama sekali.
  pasangTombolKepala(panel, kepala, null);
  panel.appendChild(kepala);
  pasangGeser(panel, kepala);
  pasangUbahUkuran(panel);

  const isi = buatElemen("div", "aleta-isi");
  isi.appendChild(
    buatElemen("div", "aleta-bagian-judul", `DAFTAR PERKARA — ${ringkasan.jumlah} di halaman ini`)
  );

  if (!ringkasan.ditandai) {
    // Disebut apa adanya, beserta jalan keluarnya. Panel yang hanya berkata
    // "tidak ada penanda" membuat orang mengira tidak ada yang perlu diperiksa.
    isi.appendChild(
      buatElemen(
        "div",
        "aleta-kosong",
        'Penandaan baris sedang dimatikan. Nyalakan "Tandai halaman SIPP" pada ikon ALETA di pojok peramban.'
      )
    );
  } else if (ringkasan.bertanda === 0) {
    isi.appendChild(
      buatElemen("div", "aleta-kosong", "Tidak ada perkara di halaman ini yang berkeadaan khusus.")
    );
  } else {
    isi.appendChild(
      buatElemen("div", "aleta-baris-ket", `${ringkasan.bertanda} perkara perlu diperiksa:`)
    );
    const daftar = buatElemen("div", "aleta-identitas");
    for (const [kunci, jumlah] of Object.entries(ringkasan.sebab).sort((a, b) => b[1] - a[1])) {
      daftar.appendChild(
        buatElemen("span", "aleta-tanda-panel", `${jumlah} ${NAMA_KEADAAN[kunci] || kunci}`)
      );
    }
    isi.appendChild(daftar);
    isi.appendChild(
      buatElemen(
        "div",
        "aleta-baris-ket",
        "Penandanya tertempel di bawah nomor perkara pada barisnya masing-masing."
      )
    );
  }

  // Penetapan massal hanya bagi yang memang boleh menulis penetapan - dan
  // hanya di halaman yang benar-benar daftar perkara. Menggambarnya bagi
  // yang tidak berwenang berarti menawarkan tombol yang akan menolak.
  if (boleh("penunjukan") && boleh("kerjakan")) {
    isi.appendChild(bagianPenetapanMassal(ringkasan));
  }
  if (boleh("data-umum")) {
    // Fitur 2: antrean SIPP disusun dari tanggal sidang, tanpa lewat ABT.
    isi.appendChild(bagianMassalSipp());
    // Fitur 3: antrean yang sama, tetapi bermula dari BERKAS. Diletakkan
    // sesudah yang dari tanggal sidang, bukan sebelumnya: yang dari tanggal
    // sidang dipakai tiap hari, yang dari berkas hanya ketika naskahnya sudah
    // terkumpul di satu folder.
    bagianMassalBerkas(isi);
    void bagianAntreanSipp("").then((k) => {
      if (k && isi.isConnected) isi.appendChild(k);
    });
  }

  panel.appendChild(isi);

  panel.appendChild(kakiPanel({}));

  // Digeser dan diubah ukurannya seperti panel perkara. Panel yang satu bisa
  // dipindahkan dan yang lain tidak terbaca sebagai kerusakan, bukan sebagai
  // dua panel yang berbeda.
  pasangGeser(panel, kepala);
  pasangUbahUkuran(panel);
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

  panel.appendChild(isi);
  panel.appendChild(kakiPanel({ nomorPerkara: cariNomorPerkara() }));
  return panel;
}

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

    if (dokumen.statusVerifikasi === "belum") {
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
const TAHAPAN_BERKAS = [
  { agenda: /duplik\s+rekonvensi/i, berkas: /duplik\s+rekonvensi/i },
  { agenda: /\bjawaban\b/i, berkas: /\bjawaban\b/i },
  { agenda: /\breplik\b/i, berkas: /\breplik\b/i },
  { agenda: /\bduplik\b/i, berkas: /\bduplik\b/i },
  { agenda: /\bkesimpulan\b/i, berkas: /\bkesimpulan\b/i },
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
    // AGENDA LEBIH DULU, TANGGAL SEBAGAI CADANGAN
    // ======================================================================
    //
    // Sebelumnya HANYA tanggal. Akibatnya baris beragenda Jawaban menerima
    // seluruh berkas yang kebetulan bertanggal sama - replik, duplik,
    // kesimpulan - dan yang sedang mencari jawabannya harus memilah sendiri.
    // Lebih buruk lagi: berkas yang tanggal sidangnya tidak tercatat tidak
    // pernah tertempel di mana pun, meski agendanya jelas menunggunya.
    //
    // Sekarang agendanya diperiksa lebih dulu. Bila agenda baris ini adalah
    // tahapan pertukaran berkas dan ada berkas yang menjadi miliknya, itulah
    // yang ditempelkan - beserta sebab pencocokannya, supaya yang membacanya
    // tahu ini bukan kebetulan tanggal.
    const cocokAgenda = berkasUntukAgenda(baris.textContent, dokumen);
    if (cocokAgenda.length > 0) {
      sel.appendChild(kotakSisipan(cocokAgenda, ambang, "cocok agenda"));
      continue;
    }

    // Tanggal dibaca dari sel kedua baris ini, tempat SIPP menuliskannya.
    const tanggal = tanggalDariTeksSipp(baris.textContent);
    if (!tanggal) continue;

    const cocok = perTanggal.get(tanggal);
    if (!cocok || cocok.length === 0) continue;

    sel.appendChild(kotakSisipan(cocok, ambang, "cocok tanggal sidang"));
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

  function tampilkanKeadaan(keadaan) {
    if (!keadaan) {
      pesan.textContent = "Perkara ini belum pernah ditarik ALETA.";
      tombol.style.display = "";
      return;
    }
    if (keadaan.status === "menunggu" || keadaan.status === "dikerjakan") {
      pesan.textContent =
        keadaan.status === "dikerjakan"
          ? "Sedang ditarik dari e-Court..."
          : "Sudah diantrekan. Akan ditarik pada putaran berikutnya.";
      tombol.style.display = "none";
      return;
    }
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

  tampilkanKeadaan(keadaanAwal);
  kotak.appendChild(pesan);
  kotak.appendChild(tombol);
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
  });
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
    const respons = await alatAmbil(
      ALETA_API_SIAPA,
      { credentials: "include", cache: "no-store" },
      "Membaca akun ALETA"
    );
    if (!respons.ok) return null;
    const luar = await respons.json();
    const isi = luar && luar.data ? luar.data : luar;
    if (isi && isi.nama) {
      penggunaTerakhir = { nama: isi.nama, peran: isi.peran || "" };
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

  const nomor = cariNomorPerkara();
  if (!nomor) {
    // Bukan halaman perkara. Bila ini halaman daftar, barisnya ditandai -
    // itu justru tempat penanda paling berguna: petugas melihat puluhan
    // perkara sekaligus dan langsung tahu mana yang perlu dibuka.
    const ringkasan = await tandaiHalamanDaftar();
    if (!ringkasan) {
      // Bukan halaman daftar juga - halaman awal, laporan, atau referensi.
      // Panel perkara yang tertinggal dari halaman sebelumnya dibuang supaya
      // tidak menerangkan perkara yang sudah tidak dibuka.
      nomorTerakhir = "";
      return;
    }
    // Panel yang sama tidak digambar ulang tiap pengamat berbunyi - menggambar
    // ulang membuang keadaan lipatan dan posisi yang baru saja diatur.
    const adaPanel = document.getElementById(PENANDA);
    if (adaPanel && adaPanel.dataset.mode === "daftar" && nomorTerakhir === "*daftar*") return;

    await muatLipatan();
    await muatTema();
    // Akun ALETA dibaca lebih dulu supaya pita di halaman daftar sama
    // dengan pita di halaman perkara - lihat muatPenggunaAleta.
    await muatPenggunaAleta();
    const posisi = await muatPosisi();
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
  if (sedangAmbil) return;

  // Perkara yang sama, tetapi borang yang terbuka berubah: tingkap Putusan
  // Akhir atau Data Umum baru muncul, atau baru ditutup. Panelnya digambar
  // ulang dari konteks yang sudah ada - portal tidak ditanya lagi.
  const borang = tandaBorang();
  if (nomor === nomorTerakhir) {
    if (borang === borangTerakhir) return;
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
    if (!isi?.available || !isi?.konteks?.ok) return;

    berhentiMenungguMasuk();
    nomorTerakhir = nomor;
    konteksTerakhir = isi.konteks;
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

const pengamat = new MutationObserver((daftar) => {
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

// Saklar dari popup berlaku seketika, tanpa memuat ulang halaman SIPP.
// Memuat ulang halaman kerja orang hanya karena sebuah saklar ditekan adalah
// gangguan yang tidak perlu - dan menghindarinya juga menghemat satu izin.
chrome.storage.onChanged.addListener((perubahan, wilayah) => {
  if (wilayah !== "local") return;

  // Salinan di memori diperbarui lebih dulu - itulah yang dibaca seluruh
  // pemeriksaan di bawah, dan membiarkannya basi berarti saklarnya seolah
  // tidak berfungsi sampai halaman dimuat ulang.
  if (perubahan.aktif) saklar.aktif = perubahan.aktif.newValue !== false;
  if (perubahan.tandaiHalaman) saklar.tandaiHalaman = perubahan.tandaiHalaman.newValue === true;
  if (perubahan.sisipJadwal) saklar.sisipJadwal = perubahan.sisipJadwal.newValue === true;

  // ==========================================================================
  // TEMA DAN PALET IKUT SEKETIKA, TERMASUK DARI TAB LAIN
  // ==========================================================================
  //
  // Petugas lazim membuka SIPP di beberapa tab sekaligus - daftar perkara,
  // detail, jadwal sidang. Mengganti tema di salah satunya dulu tidak
  // menyentuh yang lain sampai dimuat ulang, dan yang terbaca dari situ bukan
  // "berlaku per tab" melainkan "saklarnya tidak berfungsi".
  if (perubahan[KUNCI_TEMA] || perubahan[KUNCI_TEMA_SIPP]) {
    if (perubahan[KUNCI_TEMA]) {
      temaSekarang = perubahan[KUNCI_TEMA].newValue === "terang" ? "terang" : "gelap";
    }
    if (perubahan[KUNCI_TEMA_SIPP]) {
      temaSippMenyala = perubahan[KUNCI_TEMA_SIPP].newValue !== false;
    }
    const panel = document.getElementById(PENANDA);
    alatTanpaTransisi(() => {
      if (panel) panel.setAttribute("data-tema", temaSekarang);
      terapkanTemaSipp();
      const tombol = panel && panel.querySelector(".aleta-tema");
      if (tombol) tombol.textContent = temaSekarang === "gelap" ? "☀" : "☾";
    });
  }

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
 * PUTUSAN MASSAL DI SIPP - MELANJUTKAN ANTREAN, SATU PERKARA DI HALAMANNYA
 * ============================================================================
 *
 * Dua jalan masuk, satu mesin:
 *
 *   FITUR 2  ALETA membaca sidang pada satu tanggal, menyusun antrean SIPP
 *            sendiri, dan mengisikan putusan tiap perkara.
 *   FITUR 3  Antrean datang dari tahap ABT (tab lain menuliskannya ke
 *            chrome.storage); di sini tinggal isian datanya.
 *
 * Kenapa PER PERKARA DI HALAMANNYA, bukan berpindah sendiri:
 *
 *   Borang putusan SIPP hanya dapat diisi ketika halamannya terbuka - jembatan
 *   menyentuh CKEditor dan select2 di halaman ini, bukan di halaman lain.
 *   Membuka perkara berikutnya menuntut tautan perkara_detil/<token>, dan
 *   tokennya hasil enkripsi SIPP yang tidak dapat dibuat dari sini. Karena itu
 *   antreannya melangkah bersama Anda: begitu satu perkara tersimpan, ALETA
 *   menandainya selesai dan menyebut perkara berikutnya - Anda membukanya,
 *   dan pada mode otomatis ALETA langsung mengisikannya begitu borangnya ada.
 *
 * Yang membuatnya AMAN: tiap perkara diperiksa lebih dulu apakah sudah putus
 * (tidak diisi ulang), isiannya dibuktikan tersimpan dari SIPP - bukan dari
 * tombol yang berhasil ditekan - dan satu perkara gagal tidak menyentuh sisa
 * antrean.
 */

/** Bagian antrean SIPP: muncul di panel perkara DAN panel daftar bila ada antrean. */
async function bagianAntreanSipp(nomorHalaman) {
  const antrean = await alatMuatAntrean();
  if (!antrean || antrean.tahap !== "sipp") return null;

  const kotak = bagian("Putusan massal · lanjutan SIPP", "antreanSipp", false);
  const isi = kotak.isi;
  const h = alatAntreanRingkas(antrean);

  isi.appendChild(
    buatElemen(
      "div",
      "aleta-tetap-sebab",
      `Antrean dari ${antrean.tahap === "sipp" ? "tahap ABT" : "jadwal sidang"} — ` +
        `${h.selesai} selesai, ${h.menunggu + h.jalan} menunggu, ${h.gagal} gagal, ${h.tertahan || 0} ditahan praperiksa. ` +
        `Mode: ${antrean.modus === "otomatis" ? "otomatis" : "manual (berhenti tiap perkara)"}.`
    )
  );

  // Peta nomor→butir untuk mengenali "apakah perkara halaman ini di antrean".
  const berikutnya = alatAntreanBerikutnya(antrean);
  const daftar = buatElemen("div", "aleta-massal-daftar");
  for (const b of antrean.butir) {
    const baris = buatElemen("div", `aleta-perkakas-baris ${b.keadaan === "selesai" ? "aleta-perkakas-baik" : b.keadaan === "gagal" ? "aleta-perkakas-buruk" : b.keadaan === "dilewati" ? "" : "aleta-perkakas-awas"}`);
    baris.appendChild(buatElemen("span", "aleta-perkakas-nama", b.nomor));
    baris.appendChild(
      buatElemen("span", "aleta-perkakas-nilai", b.catatan || NAMA_KEADAAN_ANTREAN[b.keadaan] || b.keadaan)
    );
    daftar.appendChild(baris);
  }
  isi.appendChild(daftar);

  const kabar = buatElemen("div", "aleta-abt-kabar");
  isi.appendChild(kabar);

  const aksi = buatElemen("div", "aleta-abt-aksi");
  isi.appendChild(aksi);

  const halamanIni = nomorHalaman || cariNomorPerkara();
  const butirIni = antrean.butir.find(
    (x) => x.nomor === halamanIni && (x.keadaan === "menunggu" || x.keadaan === "jalan")
  );
  const adaBorang = Boolean(document.querySelector("#frm_putusan"));

  if (butirIni && adaBorang) {
    // Perkara halaman ini memang yang ditunggu, dan borangnya terbuka.
    const tombol = buatElemen("button", "aleta-permintaan-tombol", "Isi putusan & simpan (dari draf ALETA)");
    tombol.type = "button";
    aksi.appendChild(tombol);
    tombol.addEventListener("click", () => void jalankanSatuAntreanSipp(antrean, butirIni, kabar, tombol));

    // Mode otomatis: langsung jalan, tanpa menunggu ditekan.
    if (antrean.modus === "otomatis") {
      kabar.textContent = "Mode otomatis — mengisi perkara ini…";
      setTimeout(() => void jalankanSatuAntreanSipp(antrean, butirIni, kabar, tombol), 600);
    }
  } else if (berikutnya) {
    // Bukan perkara yang ditunggu (atau borangnya belum dibuka). Sebutkan
    // yang berikutnya, dan biarkan orang membukanya - tautannya tidak dapat
    // dibuat dari sini.
    isi.appendChild(
      buatElemen(
        "div",
        "aleta-massal-jeda",
        adaBorang
          ? `Perkara berikutnya di antrean: ${berikutnya.nomor}. Buka perkara itu di SIPP, lalu buka borang putusannya.`
          : `Perkara berikutnya: ${berikutnya.nomor}. Buka perkaranya dan buka tab Putusan — ALETA akan mengisikannya${antrean.modus === "otomatis" ? " sendiri" : ""}.`
      )
    );
  } else {
    isi.appendChild(buatElemen("div", "aleta-tetap-sebab", "Seluruh antrean selesai."));
  }

  const hentikan = buatElemen("button", "aleta-perkakas-aksi", "Akhiri antrean");
  hentikan.type = "button";
  hentikan.title = "Membuang antrean ini. Perkara yang sudah tersimpan tetap tersimpan.";
  hentikan.addEventListener("click", async () => {
    await alatSimpanAntrean(null);
    alatCatat("massal", "antrean SIPP diakhiri oleh pengguna", "");
    kotak.remove();
  });
  aksi.appendChild(hentikan);

  return kotak;
}

const NAMA_KEADAAN_ANTREAN = {
  menunggu: "menunggu",
  jalan: "sedang dikerjakan",
  selesai: "selesai",
  gagal: "gagal",
  dilewati: "dilewati",
  jeda: "dijeda",
  tertahan: "ditahan praperiksa",
};

/**
 * Satu perkara antrean, di halaman yang sedang terbuka:
 *   1. sudah putus?  -> lewati, jangan isi ganda
 *   2. baca draf ALETA
 *   3. isi Pertimbangan, Amar, Amar Anonim
 *   4. Simpan, dibuktikan dari SIPP
 * Sesudah itu antrean maju satu langkah.
 */
async function jalankanSatuAntreanSipp(antrean, butir, kabar, tombol) {
  if (tombol) tombol.disabled = true;
  butir.keadaan = "jalan";
  await alatSimpanAntrean(antrean);

  // 1. Jangan isi ulang yang sudah putus.
  const segar = await bacaPutusanSegar(butir.nomor);
  if (segar && segar.sudahPutus) {
    butir.keadaan = "dilewati";
    butir.catatan = "sudah putus - tidak diisi ulang";
    await alatSimpanAntrean(antrean);
    if (kabar) kabar.textContent = `${butir.nomor} sudah putus - dilewati.`;
    alatCatat("massal", `${butir.nomor}: dilewati (sudah putus)`, "");
    if (tombol) tombol.disabled = false;
    return;
  }

  // 2. Draf ALETA.
  let draf;
  try {
    if (kabar) kabar.textContent = "Membaca draf putusan…";
    const respons = await alatAmbil(
      `${ALETA_API_ISIAN_PUTUSAN}?nomorPerkara=${encodeURIComponent(butir.nomor)}`,
      { credentials: "include", cache: "no-store" },
      "Membaca draf putusan"
    );
    if (!respons.ok) throw new Error(alatPesanGagal(null, respons.status, "Membaca draf putusan"));
    const luar = await respons.json();
    draf = luar && luar.data ? luar.data : luar;
  } catch (galat) {
    butir.keadaan = "gagal";
    butir.catatan = String((galat && galat.message) || galat);
    await alatSimpanAntrean(antrean);
    if (kabar) kabar.textContent = butir.catatan;
    alatCatat("massal-galat", `${butir.nomor}: draf ${butir.catatan}`, "");
    if (tombol) tombol.disabled = false;
    return;
  }
  if (!draf || !draf.ada) {
    butir.keadaan = "gagal";
    butir.catatan = (draf && draf.sebab) || "belum ada draf putusan";
    await alatSimpanAntrean(antrean);
    if (kabar) kabar.textContent = butir.catatan;
    if (tombol) tombol.disabled = false;
    return;
  }

  // 2b. Praperiksa - agen yang membaca fakta SIPP dan BERHENTI bila
  // bertentangan. Di antrean tidak ada kotak centang "tetap isikan": yang
  // ditahan ditandai, disebut sebabnya, dan dibiarkan untuk dibuka orang.
  const raporAgen = await praperiksaSebelumMengisi(butir.nomor, kabar);
  if (raporAgen && raporAgen.hentikan) {
    butir.keadaan = "tertahan";
    butir.catatan = `ditahan praperiksa: ${ringkasHentikan(raporAgen)}`;
    await alatSimpanAntrean(antrean);
    if (kabar) {
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent = "";
      kabar.appendChild(gambarRaporAgen(raporAgen));
    }
    alatCatat("praperiksa", `${butir.nomor}: ${butir.catatan}`, "");
    if (tombol) tombol.disabled = false;
    return;
  }

  // 3. Isi tiga medan CKEditor.
  const isian = [
    ["#perhum", draf.pertimbangan],
    ["#amar", draf.amar],
    ["#amar_anonim", draf.amarAnonim],
  ];
  const gagal = [];
  let terisi = 0;
  for (const [penunjuk, teks] of isian) {
    if (!teks) continue;
    if (kabar) kabar.textContent = `Mengisi ${penunjuk}…`;
    const hasil = await kirimKeJembatan({ jenis: "isi", penunjuk, jenisMedan: "kaya", nilai: teks });
    if (hasil && hasil.ok) terisi += 1;
    else gagal.push(`${penunjuk}: ${(hasil && hasil.alasan) || "tidak terisi"}`);
  }
  if (gagal.length > 0) {
    butir.keadaan = "gagal";
    butir.catatan = `${terisi} terisi, gagal: ${gagal.join("; ")} — Simpan tidak ditekan`;
    await alatSimpanAntrean(antrean);
    if (kabar) {
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent = butir.catatan;
    }
    alatCatat("massal-galat", `${butir.nomor}: ${butir.catatan}`, "");
    if (tombol) tombol.disabled = false;
    return;
  }

  // 4. Simpan, dibuktikan dari SIPP.
  const hasilSimpan = await simpanPutusanLaluBuka(butir.nomor, kabar);
  if (hasilSimpan.ok) {
    butir.keadaan = "selesai";
    butir.catatan =
      "tersimpan di SIPP" +
      (raporAgen && raporAgen.jumlah && raporAgen.jumlah.perhatian
        ? ` · ${raporAgen.jumlah.perhatian} perhatian praperiksa`
        : raporAgen
        ? ""
        : " · tanpa praperiksa");
    alatCatatTindakan({
      jenis: "isi-putusan",
      penunjuk: butir.nomor,
      label: `putusan ${butir.nomor}`,
      nilaiBaru: "(tersimpan)",
      dapatPulih: false,
    });
    alatCatat("massal", `${butir.nomor}: putusan tersimpan`, "");
  } else {
    butir.keadaan = "gagal";
    butir.catatan = hasilSimpan.bunyi;
    alatCatat("massal-galat", `${butir.nomor}: simpan ${hasilSimpan.bunyi}`, "");
  }
  await alatSimpanAntrean(antrean);

  // simpanPutusanLaluBuka memuat ulang halaman perkara sendiri bila berhasil;
  // panel akan lahir kembali, membaca antrean, dan menunjuk perkara berikutnya.
  if (kabar && !hasilSimpan.ok) {
    kabar.className = "aleta-abt-kabar aleta-abt-gagal";
    kabar.textContent = butir.catatan;
  }
  if (tombol) tombol.disabled = false;
}


/**
 * ============================================================================
 * FITUR 3 - ANTREAN PUTUSAN MASSAL DARI BERKAS
 * ============================================================================
 *
 * Bermula dari BERKAS, bukan dari tanggal sidang. Petugas memilih beberapa
 * naskah putusan sekaligus; tiap berkas dicocokkan dengan perkaranya lewat
 * nomor yang tertulis pada NAMA berkasnya, dikirim ke ALETA sebagai draf, lalu
 * masuk antrean yang sama dengan antrean massal biasa.
 *
 * Sesudah antreannya jadi, pengisian borang SIPP dikerjakan mesin yang sudah
 * ada - satu perkara sekali, di halaman yang sedang dibuka. Tidak ada jalur
 * pengisian baru; yang ditambahkan hanya cara MENGISI ANTREANNYA.
 *
 * ============================================================================
 * YANG TIDAK DICOCOKKAN, TIDAK DITEBAK
 * ============================================================================
 *
 * Berkas yang nomor perkaranya tidak terbaca dari namanya ditandai dan
 * dilewati - bukan dipasangkan ke perkara terdekat, dan bukan pula dikirim
 * dengan nomor kosong.
 *
 * Memasangkan naskah putusan ke perkara yang salah berarti putusan orang lain
 * masuk ke berkas orang ini. Itu tidak dapat dibatalkan dengan menekan ulang:
 * drafnya sudah tersimpan, dan yang mengisi borang berikutnya akan membacanya
 * sebagai naskah yang sah.
 */
function bagianMassalBerkas(isi) {
  const kotak = buatElemen("div", "aleta-tetap-bagian");
  kotak.appendChild(buatElemen("div", "aleta-tetap-judul", "Putusan massal - dari berkas"));
  kotak.appendChild(
    buatElemen(
      "div",
      "aleta-tetap-sebab",
      "Pilih beberapa naskah putusan sekaligus. Nomor perkaranya dibaca dari NAMA berkas, " +
        "diperlihatkan untuk diperiksa, lalu tiap naskah disimpan sebagai draf dan masuk antrean."
    )
  );

  const pemilih = document.createElement("input");
  pemilih.type = "file";
  pemilih.multiple = true;
  pemilih.accept = ".rtf,.doc,.docx,.pdf";
  pemilih.className = "aleta-berkas";
  kotak.appendChild(pemilih);

  const daftar = buatElemen("div", "aleta-massal-daftar");
  kotak.appendChild(daftar);

  const tombol = buatElemen("button", "aleta-permintaan-tombol", "Kirim naskah lalu susun antrean");
  tombol.type = "button";
  tombol.disabled = true;
  kotak.appendChild(tombol);

  const kabar = buatElemen("div", "aleta-abt-kabar");
  kotak.appendChild(kabar);

  /** Berkas beserta nomor perkara yang terbaca dari namanya. */
  let pasangan = [];

  /**
   * Nomor perkara dari nama berkas.
   *
   * POLA_PERKARA berbendera /g, dan RegExp berbendera g MENGINGAT posisinya di
   * antara pemanggilan. Tanpa menyetel lastIndex, berkas kedua dicari mulai
   * dari tempat berkas pertama berhenti - dan nomor yang ada tidak ketemu.
   * Jebakan yang sama sudah tercatat di pemakaian POLA_PERKARA yang lain.
   */
  function nomorDariNama(nama) {
    POLA_PERKARA.lastIndex = 0;
    const cocok = POLA_PERKARA.exec(String(nama || ""));
    return cocok ? cocok[1] : "";
  }

  function gambarDaftar() {
    daftar.textContent = "";
    let cocok = 0;
    for (const p of pasangan) {
      const baris = buatElemen("div", "aleta-massal-baris");
      baris.appendChild(buatElemen("span", "aleta-massal-nomor", p.berkas.name));
      const tanda = buatElemen(
        "span",
        "aleta-massal-keadaan",
        p.nomor || "nomor perkara tidak terbaca dari namanya - dilewati"
      );
      tanda.classList.add(p.nomor ? "aleta-lencana-aman" : "aleta-lencana-mendesak");
      baris.appendChild(tanda);
      daftar.appendChild(baris);
      if (p.nomor) cocok += 1;
    }
    tombol.disabled = cocok === 0;
    kabar.className = "aleta-abt-kabar";
    kabar.textContent = `${pasangan.length} berkas dipilih; ${cocok} terbaca nomornya.`;
  }

  pemilih.addEventListener("change", () => {
    pasangan = Array.from(pemilih.files || []).map((berkas) => ({
      berkas,
      nomor: nomorDariNama(berkas.name),
    }));
    gambarDaftar();
  });

  tombol.addEventListener("click", async () => {
    const dikerjakan = pasangan.filter((p) => p.nomor);
    if (dikerjakan.length === 0) return;
    tombol.disabled = true;
    pemilih.disabled = true;

    const berhasil = [];
    let gagal = 0;
    // BERURUTAN, dan itu disengaja. Tiap berkas dikirim utuh ke peladen lalu
    // diurai di sana; mengirim dua puluh sekaligus berarti dua puluh naskah
    // berada di memori peladen pada saat yang sama. Yang ditunggu orang di
    // sini pengunggahan sekali seumur hari, bukan tiap kali layar dibuka.
    for (let i = 0; i < dikerjakan.length; i += 1) {
      const p = dikerjakan[i];
      kabar.textContent = `Mengirim ${i + 1} dari ${dikerjakan.length}: ${p.berkas.name}…`;
      try {
        const badan = new FormData();
        badan.append("berkas", p.berkas);
        badan.append("nomorPerkara", p.nomor);
        // perkaraId TIDAK dikirim - ia tidak diketahui dari berkas, dan rute
        // naskah memang membolehkannya kosong. Menebaknya berarti menautkan
        // draf ke perkara yang salah.
        const respons = await alatAmbil(
          ALETA_API_UNGGAH_NASKAH,
          { method: "POST", body: badan, credentials: "include", batasMs: BATAS_UNGGAH_NASKAH_MS },
          "Mengirim naskah putusan"
        );
        if (!respons.ok) throw new Error(alatPesanGagal(null, respons.status, "Mengirim naskah putusan"));
        const luar = await respons.json();
        const jawab = luar && luar.data ? luar.data : luar;
        if (!jawab || !jawab.ok) throw new Error((jawab && jawab.sebab) || "naskahnya tidak dapat dibaca");
        berhasil.push({ nomor: p.nomor, perkaraId: "", jenis: "" });
      } catch (galat) {
        gagal += 1;
        alatCatat("massal-galat", `${p.nomor}: ${String((galat && galat.message) || galat)}`, "");
      }
    }

    pemilih.disabled = false;
    tombol.disabled = false;

    if (berhasil.length === 0) {
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent = `Tidak satu pun naskah tersimpan. ${gagal} gagal - lihat catatan.`;
      return;
    }

    const antrean = alatBuatAntrean({
      tanggalSidang: "",
      tahap: "sipp",
      modus: "draf",
      butir: berhasil,
    });
    await alatSimpanAntrean(antrean);
    kabar.className = "aleta-abt-kabar";
    kabar.textContent =
      `${berhasil.length} draf tersimpan dan masuk antrean` +
      (gagal ? `, ${gagal} gagal` : "") +
      ". Buka perkara pertamanya di SIPP; panel antrean akan menuntun sisanya.";
  });

  isi.appendChild(kotak);
  return kotak;
}

/*
 * ============================================================================
 * FITUR 2 - ANTREAN PUTUSAN SIPP DARI TANGGAL SIDANG, TANPA LEWAT ABT
 * ============================================================================
 *
 * Draf putusan tiap perkara sudah ada di ALETA - dari naskah yang diunggah
 * lewat panel perkara, atau dari tahap ABT sebelumnya. Yang belum ada hanya
 * cara mengerjakannya BERURUTAN untuk seluruh perkara yang bersidang pada
 * satu tanggal, tanpa membuka jadwal, mencatat nomornya, lalu mengetik satu
 * per satu.
 *
 * Bagian ini menyusun antreannya; yang menjalankannya bagianAntreanSipp yang
 * sama dengan lanjutan dari ABT - satu mesin, dua pintu masuk. Sebelum masuk
 * antrean, draf tiap perkara diperiksa: yang belum punya draf tidak dijanjikan
 * akan diisi, melainkan disebut apa adanya dan dilewati.
 */
function bagianMassalSipp() {
  const kotak = bagian("Putusan massal · SIPP", "putusanMassalSipp", true);
  const isi = kotak.isi;
  const keadaan = { tanggal: alatTanggalIso(new Date()), sidang: [], draf: new Map() };

  isi.appendChild(
    buatElemen(
      "div",
      "aleta-tetap-sebab",
      "Perkara yang bersidang pada tanggal ini dan sudah punya draf putusan di ALETA disusun menjadi antrean. " +
        "Tidak ada yang tercentang sendiri; yang sudah putus tidak ditawarkan."
    )
  );
  isi.appendChild(alatPemilihTanggal((t) => {
    keadaan.tanggal = t;
    void muat();
  }));

  const kabar = buatElemen("div", "aleta-abt-kabar");
  isi.appendChild(kabar);
  const daftar = buatElemen("div", "aleta-massal-daftar");
  isi.appendChild(daftar);

  const barisModus = buatElemen("div", "aleta-massal-pilihan");
  const pilihModus = document.createElement("select");
  pilihModus.className = "aleta-massal-pilih-berkas";
  for (const [nilai, label] of [
    ["manual", "Manual — berhenti di tiap perkara supaya diperiksa dahulu"],
    ["otomatis", "Otomatis — ALETA mengisi dan menyimpan begitu borangnya terbuka"],
  ]) {
    const o = document.createElement("option");
    o.value = nilai;
    o.textContent = label;
    pilihModus.appendChild(o);
  }
  barisModus.appendChild(pilihModus);
  isi.appendChild(barisModus);

  const aksi = buatElemen("div", "aleta-abt-aksi");
  const tombolSusun = buatElemen("button", "aleta-permintaan-tombol", "Susun antrean");
  tombolSusun.type = "button";
  tombolSusun.disabled = true;
  aksi.appendChild(tombolSusun);
  isi.appendChild(aksi);

  const centangPer = new Map();

  async function adaDraf(nomor) {
    if (keadaan.draf.has(nomor)) return keadaan.draf.get(nomor);
    let hasil = { ada: false, sebab: "belum diperiksa" };
    try {
      const respons = await alatAmbil(
        `${ALETA_API_ISIAN_PUTUSAN}?nomorPerkara=${encodeURIComponent(nomor)}`,
        { credentials: "include", cache: "no-store" },
        "Memeriksa draf putusan"
      );
      if (respons.ok) {
        const luar = await respons.json();
        const d = luar && luar.data ? luar.data : luar;
        // ==================================================================
        // JAWABANNYA DISIMPAN UTUH, BUKAN DIBUANG
        // ==================================================================
        //
        // Rute ini memulangkan SELURUH draf - bukan jawaban ya/tidak.
        // Sebelumnya isinya dibuang dan hanya { ada, sebab } yang disimpan,
        // lalu pengisian borang menariknya LAGI utuh. Dua tarikan untuk satu
        // draf yang sama, dan tarikan keduanya justru yang ditunggu petugas.
        hasil = { ada: Boolean(d && d.ada), sebab: (d && d.sebab) || "", isi: d || null };
      } else {
        hasil = { ada: false, sebab: alatPesanGagal(null, respons.status, "Memeriksa draf putusan") };
      }
    } catch (galat) {
      hasil = { ada: false, sebab: String((galat && galat.message) || galat) };
    }
    keadaan.draf.set(nomor, hasil);
    return hasil;
  }

  /**
   * Menjalankan kerja atas banyak butir, BERBARENGAN tetapi terbatas.
   *
   * Enam sekaligus, bukan seluruhnya. Dua puluh permintaan serentak ke SIPP
   * lewat satu gerbang menukar menunggu dengan menumpuk - dan yang menumpuk
   * membuat permintaan lain di layar yang sama ikut tertahan, termasuk yang
   * sedang ditunggu orang lain.
   *
   * Urutan pemanggilannya tidak dijamin; yang menuntut urutan harus
   * menuliskan hasilnya ke tempatnya sendiri, bukan menumpuknya berurutan.
   */
  async function berbarenganTerbatas(daftar, sekaligus, kerja) {
    const butir = Array.from(daftar);
    let berikut = 0;
    async function pekerja() {
      for (;;) {
        const i = berikut;
        berikut += 1;
        if (i >= butir.length) return;
        await kerja(butir[i], i);
      }
    }
    const jumlah = Math.max(1, Math.min(sekaligus, butir.length));
    await Promise.all(Array.from({ length: jumlah }, () => pekerja()));
  }

  async function muat() {
    daftar.textContent = "";
    centangPer.clear();
    tombolSusun.disabled = true;
    kabar.className = "aleta-abt-kabar";
    kabar.textContent = `Membaca sidang ${keadaan.tanggal}…`;
    try {
      keadaan.sidang = await alatSidangPadaTanggal(keadaan.tanggal);
    } catch (galat) {
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent = String((galat && galat.message) || galat);
      return;
    }
    if (keadaan.sidang.length === 0) {
      kabar.textContent = `Tidak ada sidang pada ${keadaan.tanggal}.`;
      return;
    }
    const belum = keadaan.sidang.filter((s) => !s.sudahPutus);
    kabar.textContent = `${keadaan.sidang.length} perkara bersidang; ${belum.length} belum putus. Memeriksa draf…`;

    for (const s of keadaan.sidang) {
      const label = buatElemen("label", "aleta-massal-baris");
      const centang = document.createElement("input");
      centang.type = "checkbox";
      centang.className = "aleta-massal-centang";
      centang.disabled = true;
      label.appendChild(centang);
      label.appendChild(buatElemen("span", "aleta-massal-nomor", s.nomor));
      label.appendChild(buatElemen("span", "aleta-massal-keadaan", [s.jenis || "jenis tidak terbaca", s.agenda].filter(Boolean).join(" · ")));
      const tanda = buatElemen("span", "aleta-massal-keadaan", s.sudahPutus ? "sudah putus" : "memeriksa draf…");
      if (s.sudahPutus) tanda.classList.add("aleta-lencana-aman");
      label.appendChild(tanda);
      daftar.appendChild(label);
      centangPer.set(s.nomor, { centang, sidang: s, tanda });
    }

    // ========================================================================
    // DIPERIKSA BERBARENGAN, ENAM SEKALIGUS
    // ========================================================================
    //
    // Dahulu berurutan, dengan komentar yang menyebutnya "satu permintaan
    // ringan per perkara". Ringan ia tidak: rutenya memulangkan SELURUH draf.
    // Pada dua puluh perkara yang masing-masing memakan setengah detik, itu
    // sepuluh detik menunggu sebelum satu baris pun dapat dicentang.
    //
    // Hasilnya tetap dituliskan ke barisnya masing-masing begitu tiba,
    // sehingga daftarnya terisi berangsur seperti sediakala - yang berubah
    // hanya kecepatannya, bukan cara membacanya.
    let siap = 0;
    await berbarenganTerbatas(belum, 6, async (s) => {
      const d = await adaDraf(s.nomor);
      const t = centangPer.get(s.nomor);
      if (!t) return;
      if (d.ada) {
        t.centang.disabled = false;
        t.tanda.textContent = "draf ada";
        siap += 1;
      } else {
        t.tanda.textContent = d.sebab ? `tanpa draf: ${d.sebab}` : "belum ada draf";
        t.tanda.classList.add("aleta-lencana-mendesak");
        t.centang.title = "Unggah naskah putusannya dahulu di panel perkara, atau kerjakan lewat tahap ABT.";
      }
    });
    kabar.textContent = `${keadaan.sidang.length} perkara bersidang; ${belum.length} belum putus; ${siap} punya draf dan dapat dicentang.`;
    tombolSusun.disabled = siap === 0;
  }

  tombolSusun.addEventListener("click", async () => {
    const dipilih = [...centangPer.values()]
      .filter((x) => x.centang.checked && !x.centang.disabled)
      .map((x) => x.sidang);
    if (dipilih.length === 0) {
      kabar.textContent = "Tidak ada yang dicentang.";
      return;
    }
    const antrean = alatBuatAntrean({
      tanggalSidang: keadaan.tanggal,
      tahap: "sipp",
      modus: pilihModus.value,
      kering: false,
      butir: dipilih.map((s) => ({ nomor: s.nomor, perkaraId: s.perkaraId, jenis: s.jenis })),
    });
    await alatSimpanAntrean(antrean);
    alatCatat("massal", `antrean SIPP disusun dari sidang ${keadaan.tanggal}: ${dipilih.length} perkara (${pilihModus.value})`, "");
    kabar.textContent =
      `Antrean ${dipilih.length} perkara disusun (${pilihModus.value}). Buka perkara pertama - ${dipilih[0].nomor} - lalu tab Putusan; ` +
      "bagian “Putusan massal · lanjutan SIPP” akan memandu tiap langkahnya.";
    tombolSusun.disabled = true;
  });

  // Dimuat saat dibuka, bukan saat panel digambar - sama seperti menu malas
  // lainnya: yang membuka panel daftar belum tentu hendak memutus massal.
  const kepala = kotak.querySelector(".aleta-bagian-judul");
  let sudah = false;
  if (kepala) {
    kepala.addEventListener("click", () => {
      if (sudah) return;
      sudah = true;
      void muat();
    });
  }
  return kotak;
}
