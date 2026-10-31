"use strict";

/**
 * ============================================================================
 * USULAN ISIAN UNTUK BLANGKO ABT
 * ============================================================================
 *
 * ABT (Aplikasi Blangko Terpadu) menyusun putusan dari sekumpulan variabel
 * bernomor empat angka. Untuk blangko "[01] [Kabul Verstek] Cerai (Format
 * Lengkap)", tiga belas variabel berderet dari 0222 sampai 0156 - dan
 * ketiganya belas itu BUKAN daftar isian sembarangan.
 *
 * Dibaca dari berkas blangkonya sendiri di server, ketiga belasnya muncul
 * persis satu kali, berderet dalam satu baris, tepat sesudah "A. Surat :".
 * Mereka bukan kalimat yang dicetak di situ - mereka KERANGKA FAKTA yang
 * menyuapi variabel "(OTOMATIS)": 8521 (fakta hukum), 8522 (pertimbangan
 * petitum), 8528 (alat bukti saksi), dan 8530 (petitum). Itu sebabnya keempat
 * variabel otomatis itu berbunyi "TIDAK BENAR QUERY NYA" selama kerangkanya
 * kosong: mesin pertimbangannya tidak punya bahan.
 *
 * ============================================================================
 * DUA SUMBER YANG BERBEDA, DAN TIDAK BOLEH DICAMPUR
 * ============================================================================
 *
 * Delapan yang pertama memang ada di dalam keterangan saksi:
 *
 *   0222  kapan perselisihan mulai      -> menegakkan sifat TERUS-MENERUS
 *   5227  alasan-alasan gugatan          -> dalil yang harus dibuktikan
 *   0246  kapan pisah rumah              -> titik awal hitungan
 *   9944  lama pisah                     -> tidak ada harapan rukun
 *   7035  siapa yang meninggalkan        -> menentukan pihak yang pergi
 *   1268  upaya damai keluarga           -> syarat sebelum dinyatakan pecah
 *   8503  huruf alasan perceraian        -> pasal yang dipakai
 *   4020  penyalur blok kuning           -> mengikuti 8503
 *
 * Lima yang terakhir TIDAK ADA di mulut saksi, dan tidak boleh berpura-pura
 * ada:
 *
 *   0132  tanggal surat kuasa            -> SIPP, perkara_pengacara
 *   0156  kantor kuasa                   -> SIPP, perkara_pengacara.alamat
 *   0661  nomor SK prodeo                -> TIDAK ADA di SIPP
 *   0663  tanggal penetapan prodeo       -> TIDAK ADA di SIPP
 *   0227  tanggal fasakh/murtad          -> TIDAK ADA di SIPP
 *
 * Ketiga yang terakhir dinyatakan apa adanya sebagai "tidak ada sumbernya",
 * bukan dikosongkan diam-diam. Satu tombol yang mengaku dapat mengisi
 * ketiga belasnya adalah cara tercepat membuat orang berhenti mempercayai
 * seluruh tombolnya.
 *
 * ============================================================================
 * YANG SENGAJA TIDAK DIKERJAKAN DI SINI
 * ============================================================================
 *
 * Layanan ini TIDAK menulis apa pun - tidak ke SIPP, tidak ke basis data
 * aps_badilag, dan sama sekali tidak ke folder APS Badilag yang memang hanya
 * dibaca. Ia menghasilkan USULAN. Yang menuliskannya ke ABT adalah ekstensi di
 * peramban petugas, lewat rute simpan milik ABT sendiri, sesudah petugas
 * memeriksa dan menekan tombolnya.
 *
 * Layanan ini juga TIDAK memilih huruf alasan perceraian sendiri. Ia
 * mengusulkan beserta sebabnya; hurufnya tetap dipilih manusia - lihat
 * catatan pada usulkanHuruf().
 */

const db = require("../db_config");
const aturanAlasan = require("./abtAturanAlasan");
const { rapikanAlamatPihak } = require("./alamatPihakRapi");
const kalimatBaku = require("./abtKalimatBaku");
const ragamBawaan = require("./ragamBasBawaan");
const pemilih = require("./pemilihRagam");
/* === P1-P3-S6 10 Okt === */
// Pola deteksi alasan/waktu/pelaku dibaca dari kamus (kamus-deteksi/awal + lapis database).
const deteksiAlasan = require("./deteksiAlasanService");
/* === AKHIR P1-P3-S6 === */
// R2 14 Okt: sebab perselisihan 5227 yang tidak tertangkap ciri lama (cerai talak).
const sebabCerai = require("./deteksi/sebabCerai");
const upayaDamaiPerukun = require("./deteksi/upayaDamai");

/** Kueri baca-saja ke SIPP. Satu-satunya cara berkas ini menyentuh SIPP. */
function runQuery(sql, params) {
  return new Promise((resolve, reject) => {
    db.query(sql, params || [], (error, hasil) => {
      if (error) reject(error);
      else resolve(hasil);
    });
  });
}

const BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

/**
 * Memecah keterangan saksi menjadi butir-butir.
 *
 * Petugas mengetiknya sebagai daftar berawalan "- Bahwa ...", satu fakta satu
 * baris. Bentuk itu dipertahankan sebagai satuan terkecil supaya tiap usulan
 * dapat menunjuk KALIMAT yang melahirkannya - bukan sekadar "ada di keterangan
 * saksi 1", yang menuntut orang membaca ulang seluruh bloknya.
 */
function butirKeterangan(teks) {
  return String(teks || "")
    .split(/\r?\n|;\s*(?=-|–|Bahwa\b)/i)
    .map((baris) => baris.replace(/^[\s\-–•]+/, "").replace(/\s+/g, " ").trim())
    .filter((baris) => baris.length > 3);
}

/** Mencari butir pertama yang memuat semua kata kunci wajib. */
function cariButir(butir, wajib, terlarang) {
  const larang = terlarang || [];
  for (const baris of butir) {
    const kecil = baris.toLowerCase();
    if (!wajib.every((kata) => kecil.includes(kata))) continue;
    if (larang.some((kata) => kecil.includes(kata))) continue;
    return baris;
  }
  return "";
}

/**
 * Bulan dan tahun dari sepotong kalimat, dalam bentuk yang dipakai blangko.
 * 31 Okt (keputusan pengguna butir 16): opsi `tanggal` - bila kalimat menyebut hari ("sejak tanggal 23 Juli 2024"),
 * nilainya "tanggal 23 Juli 2024" (bentuk "tanggal _" variabel 0222/0246). Tanpa opsi bentuknya tetap seperti dahulu.
 */
function ambilBulanTahun(kalimat, opsi) {
  const teks = String(kalimat || "");
  if (opsi && opsi.tanggal) {
    const polaTanggal = new RegExp(`(?:\\btanggal\\s+|\\b)(\\d{1,2})\\s+(${BULAN.join("|")}|Pebruari|Nopember)\\s*,?\\s+(?:tahun\\s+)?(\\d{4})\\b`, "i");
    const t = teks.match(polaTanggal);
    const hari = t ? Number(t[1]) : 0;
    if (t && hari >= 1 && hari <= 31) {
      const kecil = t[2].toLowerCase();
      const baku = kecil === "pebruari" ? "februari" : kecil === "nopember" ? "november" : kecil;
      const namaBulan = BULAN.find((b) => b.toLowerCase() === baku);
      return { nilai: `tanggal ${t[1]} ${namaBulan} ${t[3]}`, jenis: "tanggal" };
    }
  }
  // S5=H1 (10 Okt 2026): "bulan Desember tahun 2013" dan ejaan petugas
  // "Pebruari"/"Nopember" dahulu jatuh ke cadangan tahun - terukur pada
  // 392/Pdt.G/2025 ("sejak bulan Desember tahun 2013" -> "tahun 2013",
  // isian petugas "bulan Desember 2013").
  const polaBulan = new RegExp(`\\b(${BULAN.join("|")}|Pebruari|Nopember)\\s*,?\\s+(?:tahun\\s+)?(\\d{4})\\b`, "i");
  const cocokBulan = teks.match(polaBulan);
  if (cocokBulan) {
    const kecil = cocokBulan[1].toLowerCase();
    const baku = kecil === "pebruari" ? "februari" : kecil === "nopember" ? "november" : kecil;
    const namaBulan = BULAN.find((b) => b.toLowerCase() === baku);
    return { nilai: `bulan ${namaBulan} ${cocokBulan[2]}`, jenis: "bulan" };
  }
  const cocokAwalAkhir = teks.match(/\b(awal|akhir|pertengahan)\s+tahun\s+(\d{4})\b/i);
  if (cocokAwalAkhir) {
    return { nilai: `${cocokAwalAkhir[1].toLowerCase()} tahun ${cocokAwalAkhir[2]}`, jenis: "awal-akhir" };
  }
  const cocokTahun = teks.match(/\b(?:sejak|pada|tahun)\s+(\d{4})\b/i) || teks.match(/\b(20\d{2}|19\d{2})\b/);
  if (cocokTahun) return { nilai: `tahun ${cocokTahun[1]}`, jenis: "tahun" };
  return { nilai: "", jenis: "" };
}

/** Lama pisah dalam bentuk "_ (_) tahun _ (_) bulan" seperti diminta 9944. */
function ambilLamaPisah(kalimat) {
  const teks = String(kalimat || "").toLowerCase();
  const tahun = teks.match(/(\d+)\s*(?:\(\s*[a-z]+\s*\)\s*)?tahun/);
  const bulan = teks.match(/(\d+)\s*(?:\(\s*[a-z]+\s*\)\s*)?bulan/);
  const potong = [];
  if (tahun) potong.push(`${tahun[1]} tahun`);
  if (bulan) potong.push(`${bulan[1]} bulan`);
  return potong.join(" ");
}

/**
 * ============================================================================
 * LAMA PISAH DIHITUNG, BUKAN DIPERCAYA BEGITU SAJA
 * ============================================================================
 *
 * Saksi berkata "kira-kira sudah sekitar 4 bulan". Kalimat itu benar pada hari
 * saksi diperiksa - dan mulai keliru pada sidang berikutnya. Sidang yang
 * ditunda dua kali membuat angka yang tertulis di putusan lebih pendek
 * daripada kenyataannya, dan tidak ada satu pun yang memberi tahu.
 *
 * Karena itu 9944 dihitung dari 0246 sampai TANGGAL SIDANG - tanggal yang ada
 * di halaman ABT itu sendiri, variabel 0033 - lalu disandingkan dengan angka
 * yang disebut saksi. Bila keduanya berbeda, keduanya ditampilkan; yang
 * memutuskan tetap manusia, sebab "sejak Mei" bisa berarti awal Mei atau akhir
 * Mei, dan selisih itu tidak dapat diperas dari kalimatnya.
 */
const POLA_BULAN_TAHUN = /^(?:bulan\s+|tanggal\s+(\d{1,2})\s+)?([A-Za-z]+)?\s*(\d{4})$/;

function bulanKeAngka(nama) {
  const i = BULAN.findIndex((b) => b.toLowerCase() === String(nama || "").toLowerCase());
  return i < 0 ? null : i;
}

/** Tanggal sidang "22 September 2026" atau "22/09/2026" menjadi Date. */
function uraikanTanggal(teks) {
  const bersih = String(teks || "").replace(/\s+/g, " ").trim();
  const angka = bersih.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (angka) return new Date(Number(angka[3]), Number(angka[2]) - 1, Number(angka[1]));
  const panjang = bersih.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (panjang) {
    const bulan = bulanKeAngka(panjang[2]);
    if (bulan === null) return null;
    return new Date(Number(panjang[3]), bulan, Number(panjang[1]));
  }
  return null;
}

/**
 * Menghitung lama pisah dari nilai 0246 sampai tanggal sidang.
 *
 * Mengembalikan null bila salah satunya tidak terbaca - lebih baik tidak
 * mengusulkan apa pun daripada mengusulkan angka yang dihitung dari tanggal
 * yang salah dibaca.
 */
function hitungLamaPisah(nilai0246, tanggalSidang) {
  const cocok = String(nilai0246 || "").replace(/\s+/g, " ").trim().match(POLA_BULAN_TAHUN);
  if (!cocok) return null;
  const hariMulai = cocok[1] ? Number(cocok[1]) : 0;
  const bulanMulai = cocok[2] ? bulanKeAngka(cocok[2]) : 0;
  if (bulanMulai === null) return null;
  const sidang = uraikanTanggal(tanggalSidang);
  if (!sidang || Number.isNaN(sidang.getTime())) return null;

  const mulai = new Date(Number(cocok[3]), bulanMulai, hariMulai || 1);
  if (sidang < mulai) return null;

  let bulan = (sidang.getFullYear() - mulai.getFullYear()) * 12 + (sidang.getMonth() - mulai.getMonth());
  // 31 Okt: hari mulai diketahui - bulan yang belum genap tidak dihitung (23 Juli -> 22 Oktober = 2 bulan).
  if (hariMulai && sidang.getDate() < hariMulai) bulan -= 1;
  if (bulan < 0) bulan = 0;
  const tahun = Math.floor(bulan / 12);
  const sisaBulan = bulan % 12;

  const potong = [];
  if (tahun > 0) potong.push(`${tahun} tahun`);
  if (sisaBulan > 0 || tahun === 0) potong.push(`${sisaBulan} bulan`);
  return { teks: potong.join(" "), totalBulan: bulan };
}

/**
 * ============================================================================
 * HURUF ALASAN PERCERAIAN DIUSULKAN, TIDAK DIPUTUSKAN
 * ============================================================================
 *
 * Blangko ini menyebut "A, B, F, H (FASAKH)". Huruf-huruf itu menunjuk alasan
 * perceraian di dalam peraturan, dan ARTI TIAP HURUF TIDAK DITULIS DI SINI.
 *
 * Alasannya bukan kehati-hatian yang berlebihan: satu huruf yang salah
 * mengubah dasar hukum putusan, dan yang membacanya di layar tidak punya cara
 * memeriksa apakah petanya benar. Peta huruf ke pasal harus diambil dari
 * naskah resmi dan dikunci bersama tautannya sebelum dipakai memilih apa pun.
 *
 * Sampai itu ada, yang dikerjakan fungsi ini hanya MENGUMPULKAN CIRI - kata
 * kunci apa saja yang muncul di keterangan saksi - lalu menyerahkan
 * kesimpulannya kepada manusia. Ciri bukan kesimpulan, dan bedanya dinyatakan
 * di tampilan.
 */
/**
 * ============================================================================
 * SATU CIRI, BANYAK BUNYI - SEBAB POSITA TIDAK PERNAH SERAGAM
 * ============================================================================
 *
 * Posita disusun ulang oleh tiap penyusunnya. Perkara yang persis sama dapat
 * berbunyi "terjadi perselisihan dan pertengkaran", "sering cekcok", "sudah
 * tidak harmonis lagi", atau "rumah tangga tidak rukun" - dan gugatan berbeda
 * dari permohonan lagi bunyinya. Daftar yang hanya mengenal satu bunyi akan
 * menyatakan perkara itu tidak berciri apa-apa, padahal positanya jelas.
 *
 * Tiap baris di bawah karena itu satu BUNYI, bukan satu alasan; beberapa baris
 * boleh menunjuk kunci yang sama. Yang dicocokkan `kata` harus muncul SEMUA di
 * dalam satu kalimat yang sama - bukan tersebar di seluruh naskah, sebab dua
 * kata yang berjauhan bukan satu pernyataan.
 *
 * ============================================================================
 * YANG SENGAJA TIDAK DITAMBAHKAN, DAN KENAPA
 * ============================================================================
 *
 * Tidak ada penyangkal di sini - tidak ada aturan yang membatalkan kecocokan
 * karena kalimatnya memuat "tidak". Dalam bahasa Indonesia kata itu justru
 * kerap MENEGASKAN alasannya: "tidak memberi nafkah", "tidak pernah pulang",
 * "tidak menjalankan kewajiban". Penyangkal yang dipasang tanpa memahami
 * kalimatnya akan memadamkan justru alasan yang paling sering didalilkan.
 *
 * Kata yang terlalu umum juga ditolak meski menggoda: "sakit" muncul pada
 * "sakit hati", "pergi" pada hampir tiap posita. Ciri yang salah menyala
 * membuat tiap perkara tampak punya satu alasan lebih banyak daripada yang
 * sebenarnya didalilkan - dan yang membacanya di layar tidak punya cara
 * memeriksanya.
 */
/* === P1-P3-S6 10 Okt === */
// Baris-baris CIRI_ALASAN (beserta catatan ukurnya) kini DATA di kamus-deteksi/awal/alasan.json -
// pola berjenis "ciri": sebab = kunci lama, kata = kata lama, hanyaDeteksi sama. Urutannya
// dipertahankan, sehingga 5227, SDG, dan cermin portal (bawaan-alasan.ts) tidak berubah.
// Lapis database (layar Admin "Kamus deteksi & kalimat") berlaku lewat segarkanCiriAlasan().
const CIRI_ALASAN = deteksiAlasan.ciriAlasanDariKamus();
/* === AKHIR P1-P3-S6 === */

/**
 * ============================================================================
 * BARIS YANG BOLEH MENYUSUN KETERANGAN SAKSI SDG
 * ============================================================================
 *
 * CIRI_ALASAN dipakai dua pekerjaan yang arahnya berlawanan:
 *   deteksi  membaca keterangan saksi di BAS menjadi variabel ABT (5227,
 *            8503) - salah baca di sini terlihat sebagai usulan yang
 *            diperiksa petugas;
 *   SDG      membaca POSITA, lalu mencetak alasannya sebagai UCAPAN saksi di
 *            draf berita acara ("sama dengan gugatan", alasanDariPosita).
 *
 * 37 baris bertanda hanyaDeteksi ditambahkan 25 September 2026 dan diukur
 * untuk deteksi saja, atas isian 5227 manusia. Diukur terhadap BAS petugas
 * sungguhan (973 perkara cerai PA Donggala yang BAS-nya memuat alasan;
 * ukur-sdg-bas.js di folder kerja t1-deteksi-saksi-bot), memakainya untuk SDG
 * mengubah alasan pada 504 perkara (514 dari 1.119 posita), dan dari alasan
 * yang dicetak SDG, bagian yang juga diterangkan saksi di BAS petugas turun
 * dari 0,906 menjadi 0,851. Tambahannya hanya 485 dari 714 yang diterangkan
 * saksi - "berkata kasar" 54 dari 109, "bersikap kasar" 3 dari 12. Empat
 * kunci barunya pun tidak dikenal panel SDG (DAFTAR_ALASAN_SDG di abt.js)
 * dan tercetak sebagai label mentah ("... dan judi dan temperamental").
 *
 * Maka SDG tetap memakai 63 baris lamanya - keluarannya sama persis dengan
 * sebelum 25 September - sampai pekerjaan ragam BAS mengukur baris-baris itu
 * dan memberinya bunyi. Membuka satu baris untuk SDG berarti membuang
 * tandanya DAN memperbarui BARIS_SDG di saksi-deteksi-korpus.test.ts;
 * penjaganya merah bila hanya satu yang dilakukan.
 *
 * 26 September 2026 (permintaan pengguna 1 dan 7): baris yang kalimat BAS
 * petugasnya dibaca satu per satu dan benar sedikitnya 9 dari 10 dibuka -
 * keempat kunci perilaku di atas, "wanita lain", "perempuan lain", "shabu",
 * "obat + terlarang", "pemukulan", "dipukul", "mengancam + tajam" - beserta
 * kunci baru "menikah lagi", "tidak memiliki pekerjaan tetap", dan "masalah
 * ekonomi". Semua kunci terbuka punya bunyi korpus (frasaCiri) atau berbunyi
 * sendiri ("masalah ekonomi"), sehingga label mentah tidak tercetak. Yang
 * tetap hanyaDeteksi dan sebabnya tertulis di barisnya masing-masing.
 */
const CIRI_ALASAN_SDG = CIRI_ALASAN.filter((baris) => !baris.hanyaDeteksi);
/** Kunci yang SELURUH barisnya hanyaDeteksi - tidak pernah diucapkan saksi SDG. */
const KUNCI_HANYA_DETEKSI = new Set(
  CIRI_ALASAN.filter((baris) => !CIRI_ALASAN_SDG.some((b) => b.kunci === baris.kunci)).map((baris) => baris.kunci)
);
/* === P1-P3-S6 10 Okt === */
// Lapis database kamus dapat menambah/mematikan baris ciri sesudah modul dimuat. Ketiga
// himpunan di atas disegarkan DI TEMPAT (rujukan yang sudah dipegang pemakai tetap sah)
// bila sidik baris ciri kamus berubah. Dipanggil di awal tiap pemakaian tingkat atas.
let sidikCiriTerpasang = deteksiAlasan.sidikCiri(CIRI_ALASAN);
function segarkanCiriAlasan() {
  const baru = deteksiAlasan.ciriAlasanDariKamus();
  const sidik = deteksiAlasan.sidikCiri(baru);
  if (sidik === sidikCiriTerpasang) return false;
  sidikCiriTerpasang = sidik;
  CIRI_ALASAN.splice(0, CIRI_ALASAN.length, ...baru);
  CIRI_ALASAN_SDG.splice(0, CIRI_ALASAN_SDG.length, ...baru.filter((baris) => !baris.hanyaDeteksi));
  KUNCI_HANYA_DETEKSI.clear();
  for (const baris of baru) if (!CIRI_ALASAN_SDG.some((b) => b.kunci === baris.kunci)) KUNCI_HANYA_DETEKSI.add(baris.kunci);
  return true;
}
/* === AKHIR P1-P3-S6 === */

/** Benar bila SATU kalimat memenuhi seluruh kata sebuah baris ciri. */
function kalimatBerciri(kalimatKecil, baris) {
  return baris.kata.every((kata) => kalimatKecil.includes(kata));
}

/**
 * Ciri yang ditemukan pada sekumpulan kalimat.
 *
 * Dicocokkan PER KALIMAT, bukan atas naskah yang disambung menjadi satu.
 * Bentuk lamanya menyambung seluruh butir lebih dahulu, sehingga aturan
 * berkata lebih dari satu dapat terpenuhi oleh dua kata yang berada di
 * paragraf yang berbeda - "dihukum" di butir 2 dan "penjara" di butir 9
 * bukan pernyataan bahwa seseorang dihukum penjara.
 *
 * Satu tempat untuk ketiga pemakainya - usulan dari keterangan saksi, alasan
 * dari posita, dan pencarian kalimat pemicunya - supaya ketiganya tidak
 * pernah menjawab berbeda atas naskah yang sama.
 */
function ciriDariKalimat(butir, daftarCiri) {
  const kecil = (butir || []).map((k) => String(k || "").toLowerCase());
  const daftar = daftarCiri || CIRI_ALASAN;
  const ciri = [];
  for (const baris of daftar) {
    if (ciri.includes(baris.kunci)) continue;
    if (kecil.some((k) => barisBerlaku(k, baris, daftar))) ciri.push(baris.kunci);
  }
  return ciri;
}

/**
 * Satu kalimat memenuhi satu baris ciri - kata barisnya lengkap, dan
 * saringan konteksnya lolos. Dipakai ciriDariKalimat dan kalimatPemicu
 * supaya kalimat pemicu yang ditampilkan selalu kalimat yang menyalakannya.
 */
function barisBerlaku(kalimatKecil, baris, daftar) {
  return (
    kalimatBerciri(kalimatKecil, baris) &&
    !objekMenikahLagi(kalimatKecil, baris, daftar) &&
    menikahLagiTerjadi(kalimatKecil, baris) &&
    !hanyaNafkahBatin(kalimatKecil, baris)
  );
}

/**
 * W49 22 Okt 2026: baris ciri "nafkah" (kata tunggal) tidak berlaku bila SETIAP
 * kata nafkah di kalimat itu "nafkah batin" - "Tergugat kurang memberikan
 * perhatian ... hingga kurangnya memberikan nafkah batin" (87/Pdt.G/2026) dahulu
 * menjadi "Tergugat melalaikan kewajiban nafkah lahir" di 5227 dan di keterangan
 * saksi susunan. Nafkah batin punya sebabnya sendiri (sebab-nafkah-batin).
 */
function hanyaNafkahBatin(kalimatKecil, baris) {
  if (!baris || baris.kunci !== "tidak memberi nafkah") return false;
  const kata = Array.isArray(baris.kata) ? baris.kata : [];
  if (kata.length !== 1 || kata[0] !== "nafkah") return false;
  const semua = kalimatKecil.match(/nafkah(?:\s+(?:lahir|batin|lahir\s+(?:dan|maupun)\s+batin|lahir\s*\/\s*batin))?/g) || [];
  return semua.length > 0 && semua.every((x) => /^nafkah\s+batin$/.test(x));
}

/**
 * ============================================================================
 * "MENIKAH LAGI" HANYA PERKAWINAN PELAKU YANG SUDAH TERJADI
 * ============================================================================
 *
 * Kalimat 5227 dan keterangan saksi SDG selalu berbunyi "{pelaku} telah
 * menikah lagi" - pelaku = variabel 0047 = Tergugat/Termohon. Pemeriksa 26
 * September 2026 membaca 896 kalimat berkata nikah di BAS petugas dan posita
 * perkara cerai: +-18 salah, dan kalimat SDG-nya menuduh:
 *   - subjeknya PIHAK LAWAN - "Ya, Pemohon telah menikah lagi" (396/Pdt.G/
 *     2025, cerai talak) menjadi "Termohon telah menikah lagi";
 *   - baru NIAT, izin, ancaman, atau suruhan - "Tergugat ingin menikah
 *     lagi namun tidak mendapat restu", "meminta izin ingin menikah lagi",
 *     "menyuruh Pemohon untuk menikah lagi", "harus menikah lagi";
 *   - tidak terjadi - "Termohon tidak jadi menikah dengan laki-laki
 *     tersebut".
 * Tiap kemunculan kata baris diperiksa sendiri; cukup SATU yang lolos
 * ("Tergugat ingin menikah lagi ... dan sekarang Tergugat sudah menikah
 * dengan wanita tersebut" tetap menikah lagi). Dikenali dari KUNCI baris,
 * supaya daftar ciri kiriman portal diperlakukan sama.
 */
// P1-P3-S6 10 Okt: POLA_NIAT_NIKAH dan POLA_BUKAN_SUBJEK dipindah apa adanya ke
// kamus-deteksi/awal/pelaku.json (kunci "niat-nikah" dan "bukan-subjek").
/** Sebutan pihak di depan kata nikah yang BUKAN subjeknya: objek, milik, atau sasaran. */
/** Sebutan pihak yang mengajukan perkara (0046) - bukan pelaku. */
const SEBUTAN_LAWAN = new Set(["penggugat", "pemohon"]);

function menikahLagiTerjadi(kalimatKecil, baris) {
  if (baris.kunci !== "menikah lagi") return true;
  const kata = baris.kata[0];
  let uj = null;
  for (let i = kalimatKecil.indexOf(kata); i >= 0; i = kalimatKecil.indexOf(kata, i + 1)) {
    if (!uj) uj = deteksiAlasan.penguji("pelaku");
    const depan = kalimatKecil.slice(0, i);
    if (uj.uji("niat-nikah", depan.slice(-40))) continue;
    let subjek = "";
    for (const m of depan.matchAll(/\b(penggugat|tergugat|pemohon|termohon)\b/g)) {
      if (uj.uji("bukan-subjek", depan.slice(Math.max(0, m.index - 20), m.index))) continue;
      subjek = m[1];
    }
    if (SEBUTAN_LAWAN.has(subjek)) continue;
    return true;
  }
  return false;
}

/**
 * ============================================================================
 * "MENIKAH LAGI DENGAN WANITA LAIN" BUKAN PERSELINGKUHAN
 * ============================================================================
 *
 * Baris "wanita lain", "perempuan lain", "laki-laki lain", "lelaki lain",
 * dan "pria lain" hanya MENAMAI orang ketiganya. Dalam kalimat yang juga
 * menyatakan perkawinan ("Tergugat telah menikah lagi dengan wanita lain"),
 * orang itu istri/suami barunya - bukan tanda perselingkuhan - dan
 * menghitungnya membuat saksi SDG berkata "Tergugat berselingkuh dan telah
 * menikah lagi" dari satu kalimat posita. Baris yang menyatakan hubungan itu
 * sendiri ("selingkuh", "idaman lain", "menjalin hubungan") tetap dihitung.
 *
 * Dikenali dari KATA barisnya, bukan dari tanda di baris, supaya daftar ciri
 * kiriman portal (putusan.alasan.ciri) diperlakukan sama.
 */
const KATA_OBJEK_PIHAK_LAIN = new Set(["wanita lain", "perempuan lain", "laki-laki lain", "lelaki lain", "pria lain"]);
/**
 * Benar bila SETIAP kemunculan kata objek dalam kalimat itu didahului kata
 * perkawinan dalam 30 huruf di depannya ("menikah lagi dengan wanita lain").
 * "memiliki hubungan dengan wanita lain dan sudah menikah lagi" tetap
 * dihitung sebagai pihak lain - orang itu disebut sebagai hubungan, bukan
 * sebagai pasangan nikah.
 */
function objekMenikahLagi(kalimatKecil, baris, daftar) {
  if (baris.kata.length !== 1 || !KATA_OBJEK_PIHAK_LAIN.has(baris.kata[0])) return false;
  if (!daftar.some((b) => b.kunci === "menikah lagi" && kalimatBerciri(kalimatKecil, b))) return false;
  const kata = baris.kata[0];
  for (let i = kalimatKecil.indexOf(kata); i >= 0; i = kalimatKecil.indexOf(kata, i + 1)) {
    if (!/menikah|kawin/.test(kalimatKecil.slice(Math.max(0, i - 30), i))) return false;
  }
  return true;
}

/**
 * Daftar ciri yang berlaku untuk satu permintaan.
 *
 * Bila portal mengirim daftar putusan.alasan.ciri (opsi.tipeKeluaran), itu
 * yang dipakai - sudah disaring abtKalimatBaku.bacaDaftarTipe. Bila tidak,
 * CIRI_ALASAN di atas. Entri yang ditolak dipulangkan, bukan ditelan.
 */
function daftarCiriEfektif(opsi) {
  segarkanCiriAlasan(); // P1-P3-S6 10 Okt: lapis database kamus
  const baca = kalimatBaku.bacaDaftarTipe(opsi, kalimatBaku.DAFTAR_TIPE.ciri);
  if (!baca.ada) return { daftar: CIRI_ALASAN, asal: "tertanam", ditolak: baca.ditolak };
  return { daftar: baca.entri, asal: "portal", ditolak: baca.ditolak };
}

function usulkanHuruf(butirGabungan, opsi) {
  return ciriDariKalimat(butirGabungan, daftarCiriEfektif(opsi).daftar);
}

/**
 * ============================================================================
 * CERMIN BAWAAN TIGA DAFTAR ALASAN (kontrak K10)
 * ============================================================================
 *
 * Bentuk Record<KunciDaftar, Array<{kunci, nilai, data?, urutan}>> dari
 * konstanta yang SUNGGUH dipakai bot:
 *   putusan.alasan.ciri        CIRI_ALASAN, satu baris satu entri
 *   bersama.alasan.frasa       KALIMAT.frasaCiri
 *   putusan.upaya-damai.bunyi  KALIMAT.upayaDamai
 *
 * Portal menyimpan salinannya di src/lib/tipe-keluaran/bawaan/bawaan-alasan.ts
 * (CERMIN_ALASAN); ujinya menjalankan fungsi ini dan menuntut keduanya sama
 * persis. Bila salah satu diubah tanpa yang lain, ujinya merah.
 */
function cerminAlasan() {
  const K = kalimatBaku.KALIMAT;
  return {
    [kalimatBaku.DAFTAR_TIPE.ciri]: CIRI_ALASAN.map((baris, urutan) => ({
      kunci: baris.kunci,
      nilai: baris.kata.join(" + "),
      data: { kata: [...baris.kata] },
      urutan,
    })),
    [kalimatBaku.DAFTAR_TIPE.frasa]: Object.entries(K.frasaCiri).map(([kunci, aturan], urutan) => {
      const data = aturan.akibat ? { urutan: aturan.urutan, akibat: true } : { urutan: aturan.urutan };
      // setara (t2-ragam-bas-bot): bunyi sepadan untuk keterangan saksi SDG.
      if (Array.isArray(aturan.setara) && aturan.setara.length) data.setara = [...aturan.setara];
      return { kunci, nilai: aturan.frasa, data, urutan };
    }),
    [kalimatBaku.DAFTAR_TIPE.upayaDamai]: kalimatBaku.KEADAAN_UPAYA_DAMAI.map((kunci, urutan) => ({
      kunci,
      nilai: K.upayaDamai[kunci],
      urutan,
    })),
  };
}

/**
 * Tingkat keyakinan sebuah usulan.
 *
 *   pasti  kedua saksi mengatakan hal yang sama
 *   cukup  hanya satu saksi yang mengatakannya
 *   bentrok kedua saksi mengatakan hal yang BERBEDA - ini bukan sekadar
 *           masalah pengisian, melainkan masalah pembuktian, dan harus
 *           terlihat sebelum putusan disusun, bukan sesudah dibaca hakim
 */
function gabungkan(dariSaksi1, dariSaksi2) {
  const a = (dariSaksi1 || "").trim();
  const b = (dariSaksi2 || "").trim();
  if (a && b) {
    if (a.toLowerCase() === b.toLowerCase()) return { nilai: a, keyakinan: "pasti", bentrok: "" };
    return { nilai: a, keyakinan: "bentrok", bentrok: b };
  }
  if (a) return { nilai: a, keyakinan: "cukup", bentrok: "" };
  if (b) return { nilai: b, keyakinan: "cukup", bentrok: "" };
  return { nilai: "", keyakinan: "kosong", bentrok: "" };
}

/**
 * 31 Okt (butir 16): dua bacaan waktu setara bila sama persis, atau yang satu "bulan X YYYY" dan yang lain
 * "tanggal N X YYYY" pada bulan itu. Memulangkan bentuk yang LEBIH RINCI, atau "" bila tidak setara.
 */
function waktuSetara(a, b) {
  const x = String(a || "").trim();
  const y = String(b || "").trim();
  if (!x || !y) return "";
  if (x.toLowerCase() === y.toLowerCase()) return x;
  // Hari ditulis "05" atau "5" - sama.
  const baku = (t) => t.toLowerCase().replace(/^tanggal\s+0*(\d)/, "tanggal $1");
  if (baku(x) === baku(y)) return x;
  const bulanDari = (t) => {
    const m = t.match(/^(?:bulan|tanggal\s+\d{1,2})\s+(\S+\s+\d{4})$/i);
    return m ? m[1].toLowerCase() : "";
  };
  const tgl = (t) => /^tanggal\s/i.test(t);
  if (tgl(x) && tgl(y)) return "";
  const bx = bulanDari(x);
  if (!bx || bx !== bulanDari(y)) return "";
  return tgl(x) ? x : y;
}

/** gabungkan() untuk 0222/0246: bulan & tanggal di bulan itu = sama (pasti), nilai = yang lebih rinci. */
function gabungkanWaktu(dariSaksi1, dariSaksi2) {
  const g = gabungkan(dariSaksi1, dariSaksi2);
  if (g.keyakinan === "bentrok") {
    const rinci = waktuSetara(dariSaksi1, dariSaksi2);
    if (rinci) return { nilai: rinci, keyakinan: "pasti", bentrok: "" };
  }
  return g;
}

function usulan(kode, nama, hasil, sumber) {
  const u = {
    kode,
    nama,
    nilai: hasil.nilai,
    keyakinan: hasil.keyakinan,
    bentrok: hasil.bentrok,
    catatan: hasil.catatan || "",
    dihitung: hasil.dihitung === true,
    sumber: sumber || [],
  };
  // Dua ruas yang hanya ada bila memang ada isinya, supaya usulan lain tidak
  // berubah bentuk:
  //   pilihan    bunyi-bunyi yang ditawarkan ketika nilainya SENGAJA tidak
  //              diisi (1268 "belum ada upaya") - dipilih manusia
  //   pembanding angka hitungan yang disandingkan dengan ucapan saksi (9944)
  if (Array.isArray(hasil.pilihan) && hasil.pilihan.length) u.pilihan = hasil.pilihan;
  if (hasil.pembanding) u.pembanding = hasil.pembanding;
  return u;
}

/**
 * Menurunkan delapan variabel dari dua keterangan saksi.
 *
 * Tiap usulan membawa kalimat asalnya beserta nomor saksinya. Yang
 * memverifikasi tidak perlu membaca ulang dua blok panjang - cukup membaca
 * satu baris di sebelah usulannya.
 */
/**
 * Kalimat yang memicu satu ciri, dari satu daftar butir.
 *
 * Dikembalikan yang PERTAMA cocok - keterangan saksi menyebut satu hal sekali,
 * dan bila lebih dari sekali, yang pertama yang menjadi dasar.
 */
function kalimatPemicu(butir, ciri, daftarCiri) {
  const daftar = daftarCiri || CIRI_ALASAN;
  const aturan = daftar.filter((c) => c.kunci === ciri);
  for (const baris of butir) {
    const kecil = String(baris || "").toLowerCase();
    if (aturan.some((c) => barisBerlaku(kecil, c, daftar))) return baris;
  }
  return "";
}

/**
 * Sumber 5227, disusun berpasangan per alasan.
 *
 * Urutannya: alasan pertama saksi 1, alasan pertama saksi 2, alasan kedua
 * saksi 1, dan seterusnya - sehingga keduanya berdampingan di layar dan dapat
 * dibandingkan tanpa menggulung.
 *
 * Dibatasi enam pasang: panel setinggi tiga per lima layar, dan daftar yang
 * lebih panjang daripada itu berhenti dibaca.
 */
function sumberBerpasangan(ciri, b1, b2, daftarCiri) {
  const hasil = [];
  for (const nama of ciri) {
    const k1 = kalimatPemicu(b1, nama, daftarCiri);
    const k2 = kalimatPemicu(b2, nama, daftarCiri);
    if (k1) hasil.push({ saksi: 1, kalimat: k1 });
    if (k2) hasil.push({ saksi: 2, kalimat: k2 });
    if (hasil.length >= 12) break;
  }
  return hasil;
}

/* ============================================================================
 * PENGURAI PER VARIABEL - DIPERLUAS 25 SEPTEMBER 2026, DAN DIUKUR DULU
 * ============================================================================
 *
 * Tiap aturan di bawah diukur atas 347 perkara cerai PA Donggala yang
 * variabel ABT-nya sudah diisi manusia, dengan 49 nilai yang diubah sesudah
 * 1 September 2026 dikeluarkan (bisa jadi tulisan panel ALETA sendiri). Skrip
 * dan angkanya di folder kerja t1-deteksi-saksi-bot (ukur-t1.js); angka
 * sebelum-sesudah dicatat pada tiap aturan.
 *
 * Yang TIDAK berubah: aturannya tetap per saksi, lalu digabung dengan
 * gabungkan() - sehingga "pasti", "cukup", dan "bentrok" tetap berarti sama.
 */

// 0222 - kata konflik yang dipakai saksi. Dahulu hanya "perselisihan":
// 45 dari 64 yang terlewat berkata "tidak rukun", "berselisih", atau
// "bertengkar" tanpa satu kali pun menyebut "perselisihan".
// P1-P3-S6 10 Okt: POLA_KONFLIK, POLA_MULAI, POLA_ADA_TAHUN, POLA_PISAH_RUMAH dan pola
// sebaris di kalimatAwalKonflik/kalimatPisahRumah/lamaDiucapkan dipindah APA ADANYA ke
// kamus-deteksi/awal/waktu.json (kunci konflik, mulai, tahun, pisah-rumah, konflik-terjadi,
// titik-akhir, pisah-kata, puncak, pisah-lama, lama-sebelum-pisah, bukan-lama).
// 0246 - bentuk pisah rumah. "puncak ... pada bulan X, ... pergi meninggalkan
// rumah" adalah bentuk 16 dari 33 yang terlewat: tidak memuat kata "pisah".

/**
 * Kalimat awal konflik: kata konflik + "sejak/mulai" + tahun, dalam satu butir.
 *
 * Cadangannya kalimat konflik yang "terjadi (pada) <waktu>" - "perselisihan
 * dan pertengkaran Penggugat dan Tergugat terjadi bulan Agustus 2023" - asal
 * BUKAN puncak atau pertengkaran terakhir: keduanya titik akhir, bukan awal.
 */
function kalimatAwalKonflik(butir) {
  const w = deteksiAlasan.penguji("waktu");
  return (
    butir.find((b) => w.uji("konflik", b) && w.uji("mulai", b) && w.uji("tahun", b)) ||
    butir.find(
      (b) => w.uji("konflik", b) && w.uji("konflik-terjadi", b) && !w.uji("titik-akhir", b) && w.uji("tahun", b)
    ) ||
    // 27 Okt: "namun pada bulan Maret 2016 sudah tidak rukun" (waktu tanpa kata sejak/mulai di depannya).
    butir.find((b) => w.uji("mulai-pada", b) && !w.uji("titik-akhir", b)) ||
    ""
  );
}

/**
 * Kalimat pisah rumah.
 *
 * Bentuk lamanya lebih dulu ("pisah ... sejak <tahun>"), lalu bentuk lain yang
 * bertahun - termasuk "puncak ... pada bulan X, ... pergi meninggalkan".
 * Kalimat tanpa tahun tidak dipilih: ia tidak dapat mengisi 0246 dan hanya
 * menutupi kalimat sesudahnya yang dapat.
 */
function kalimatPisahRumah(butir) {
  const w = deteksiAlasan.penguji("waktu");
  return (
    butir.find((b) => w.uji("pisah-kata", b) && w.uji("mulai", b) && w.uji("tahun", b)) ||
    butir.find((b) => w.uji("pisah-rumah", b) && w.uji("tahun", b)) ||
    // Cadangan terakhir: kalimat PUNCAK bertanggal. Pada templat satker,
    // puncak perselisihan adalah hari salah satu pihak pergi; terukur naik
    // 276 -> 282 dari 316 tanpa satu pun jawaban benar yang berubah salah.
    butir.find((b) => w.uji("puncak", b) && w.uji("tahun", b)) ||
    ""
  );
}

/**
 * Lama pisah yang DIUCAPKAN saksi: "N tahun" dan/atau "N bulan" sesudah kata
 * pisahnya.
 *
 * Berbeda dari ambilLamaPisah (yang dipakai faktaDariPosita dan tidak
 * disentuh di sini) dalam dua hal yang terukur:
 *   - angka berkurung panjang ikut terbaca: "12 (dua belas) bulan";
 *   - hanya bagian SESUDAH kata pisahnya yang dibaca, supaya umur anak
 *     ("anak umur 3 tahun") di awal kalimat tidak terbaca sebagai lama pisah.
 * Kalimat "N tahun" tanpa kata "bulan" kini dikenali - dahulu syarat
 * pencariannya kata "bulan".
 */
const ANGKA_KATA = {
  satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9,
  sepuluh: 10, sebelas: 11, "dua belas": 12, "tiga belas": 13, "empat belas": 14, "lima belas": 15,
};
const POLA_KATA_ANGKA = Object.keys(ANGKA_KATA).sort((a, b) => b.length - a.length).join("|");

/**
 * Banyaknya satuan (tahun/bulan) di sepotong kalimat, dalam tiga bentuk yang
 * dipakai saksi sungguhan:
 *   "2 (dua) tahun"   angka lalu kata berkurung
 *   "empat (4) tahun" kata lalu angka berkurung - bentuk ini dahulu lolos
 *   "satu tahun"      kata saja
 * Mengembalikan null bila tidak ada.
 */
function banyakSatuan(teks, satuan) {
  const t = String(teks || "").toLowerCase();
  const angka = t.match(new RegExp(`(?:^|[^\\d])(\\d{1,2})\\s*(?:\\([^)]{1,40}\\)\\s*)?${satuan}`));
  if (angka) return Number(angka[1]);
  const kataBerkurung = t.match(new RegExp(`\\b(?:${POLA_KATA_ANGKA})\\s*\\((\\d{1,2})\\)\\s*${satuan}`));
  if (kataBerkurung) return Number(kataBerkurung[1]);
  const kata = t.match(new RegExp(`\\b(${POLA_KATA_ANGKA})\\s+${satuan}`));
  if (kata) return ANGKA_KATA[kata[1]];
  // "setahun" dan "sebulan" - satu kata, tanpa angka.
  if (new RegExp(`\\bse${satuan}\\b`).test(t)) return 1;
  return null;
}

function lamaDiucapkan(butir) {
  const w = deteksiAlasan.penguji("waktu");
  for (const b of butir) {
    const i = w.cari("pisah-lama", b);
    if (i < 0) continue;
    const sisa = b.slice(i);
    let tahun = banyakSatuan(sisa, "tahun");
    let bulan = banyakSatuan(sisa, "bulan");
    if (tahun === null && bulan === null) {
      // S5=H1 (10 Okt 2026): lamanya DISEBUT SEBELUM kata pisahnya - "sudah
      // 8 bulan pisah rumah", "sudah ± 2 tahun Tergugat pergi meninggalkan".
      // Hanya bila didahului penanda lama (sudah/telah/selama/kurang lebih/
      // sekitar/±) dalam 40 huruf sebelum kata pisahnya, supaya umur anak
      // ("anak umur 3 tahun ... pisah") tidak terbaca.
      const depan = b.slice(Math.max(0, i - 40), i);
      const m = w.cocok("lama-sebelum-pisah", depan);
      if (!m || w.uji("bukan-lama", m[0])) continue;
      tahun = banyakSatuan(m[1], "tahun");
      bulan = banyakSatuan(m[1], "bulan");
      if (tahun === null && bulan === null) continue;
    }
    const potong = [];
    if (tahun !== null) potong.push(`${tahun} tahun`);
    if (bulan !== null) potong.push(`${bulan} bulan`);
    return { nilai: potong.join(" "), kalimat: b };
  }
  return { nilai: "", kalimat: "" };
}

/** Total bulan dari "N tahun M bulan", atau null. */
function totalBulan(teks) {
  const t = String(teks || "").toLowerCase();
  const tahun = t.match(/(\d+)\s*(?:\([^)]*\)\s*)?tahun/);
  const bulan = t.match(/(\d+)\s*(?:\([^)]*\)\s*)?bulan/);
  if (!tahun && !bulan) return null;
  return (tahun ? Number(tahun[1]) * 12 : 0) + (bulan ? Number(bulan[1]) : 0);
}

/**
 * 7035 - siapa yang pergi, dibaca dari SUBJEK kalimatnya.
 *
 * Bentuk lamanya mengambil sebutan yang disebut PALING AKHIR di kalimat
 * "meninggalkan ...". Itu benar untuk "yang meninggalkan ... adalah Tergugat",
 * dan salah untuk "Tergugat pergi meninggalkan Penggugat" - yang terakhir
 * disebut justru yang DITINGGALKAN. Terukur 269 dari 335 benar.
 *
 * Sekarang, per butir yang memuat kata pergi/meninggalkan:
 *   1. sesudah "adalah": "yang meninggalkan ... adalah Termohon"
 *   2. tepat sebelum "(yang) (telah/sudah) (pergi) meninggalkan"
 *   3. tepat sebelum "pergi/pulang/kembali/keluar"
 * Butir yang tidak memenuhi satu pun dilewati - pencarian berlanjut ke butir
 * berikutnya, bukan berhenti dengan jawaban kosong.
 *
 * Butir yang masih memuat pilihan templat "Penggugat/Tergugat" juga
 * dilewati: itu jawaban templat yang tidak diisi petugas, bukan keterangan.
 * Dahulu sebutan pertamanya terbaca sebagai yang pergi - 441/Pdt.G/2025,
 * 550/Pdt.G/2025, dan 77/Pdt.G/2026 berbalik dari benar menjadi salah.
 * "adalahTergugat" (spasi hilang, 550/Pdt.G/2025 saksi 1) tetap terbaca.
 *
 * @returns {{sisi: ""|"pelaku"|"lawan", kalimat: string}}
 *   pelaku = 0047 = Tergugat/Termohon; lawan = 0046 = Penggugat/Pemohon
 */
const POLA_PILIHAN_SEBUTAN = /(?:penggugat|tergugat|pemohon|termohon)\s*\/\s*(?:penggugat|tergugat|pemohon|termohon)/;
// P1-P3-S6 10 Okt: siapaPergiDari membaca pemicu, pilihan templat, dan ketiga bentuk subjek
// dari kamus-deteksi/awal/pelaku.json (pergi-pemicu, pilihan-templat, pergi-subjek urut 1-3).
// POLA_PILIHAN_SEBUTAN tetap di sini untuk siapaPergiPosita (posita, bukan saksi).

function siapaPergiDari(butir) {
  const sisi = (kata) => (/tergugat|termohon/i.test(kata) ? "pelaku" : "lawan");
  const uj = deteksiAlasan.penguji("pelaku");
  for (const b of butir) {
    const k = b.toLowerCase();
    if (!uj.uji("pergi-pemicu", k)) continue;
    if (uj.uji("pilihan-templat", k)) continue;
    const m = uj.cocok("pergi-subjek", k);
    if (m) return { sisi: sisi(m[1]), kalimat: b };
  }
  return { sisi: "", kalimat: "" };
}

/* Sisi yang pergi menurut POSITA kini dibaca siapaPergiPosita (butir 24) -
 * subjek peristiwa perginya, bukan sebutan terdekat sebelum 'meninggalkan'
 * pertama di kalimat pertama yang memuatnya. */

/* 1268 - kata upaya damai. Dahulu hanya dirukunkan/didamaikan/rukunkan: 76
 * perkara terlewat karena saksi berkata "mendamaikan" (34), "menasihati/
 * menasehati" (40), atau "rukun kembali" (29). */
// "diupayakan untuk rukun" dan "pernah diusahakan oleh keluarga" ikut sejak
// terukur: keduanya bentuk saksi sungguhan yang tidak memuat kata di atas.
const POLA_UPAYA_DAMAI = /(dirukunkan|didamaikan|rukunkan|mendamaikan|menasihati|menasehati|dinasihati|dinasehati|rukun kembali|upaya damai|upaya perdamaian|memusyawarahkan|dimusyawarahkan|diupayakan\s+(untuk\s+)?rukun|diusahakan\s+oleh)/i;
// Keterangan bahwa upaya itu BELUM atau TIDAK PERNAH ada. Dituntut kata
// damainya sendiri sesudah "belum/tidak (pernah) (ada)" - "tidak berhasil
// dirukunkan" bukan keadaan ini, begitu pula "tidak mau rukun".
const POLA_BELUM_ADA_UPAYA =
  /\b(belum|tidak)\s+(pernah\s+)?(ada\s+)?(upaya|usaha|diupayakan|didamaikan|dirukunkan|dinasehati|dinasihati|dimusyawarahkan|mendamaikan|merukunkan|menasehati|menasihati|(berusaha|berupaya|mencoba)\s+(untuk\s+)?(mendamaikan|merukunkan|menasehati|menasihati|memusyawarahkan|bermusyawarah))/i;
// "berhasil dirukunkan" - satu-satunya keadaan yang boleh berbunyi berhasil.
const POLA_BERHASIL_RUKUN = /berhasil\s+(dirukunkan|didamaikan)/i;
const POLA_TIDAK_BERHASIL = /(tidak|belum|tak)\s+berhasil/i;
// Rukun lalu retak lagi: yang tercatat tetap gagal.
const POLA_RETAK_LAGI = /(namun|tetapi|tapi|akan tetapi)\s+(kemudian\s+|akhirnya\s+)?(kembali|lagi)\s+(lagi\s+)?(cekcok|bertengkar|berselisih|ribut)/i;

/**
 * Keadaan upaya damai menurut satu saksi.
 *
 * @returns {{keadaan: ""|"gagal"|"berhasil"|"belum-ada", kalimat: string}}
 */
function upayaDamaiDari(butir) {
  const belum = butir.find((b) => POLA_BELUM_ADA_UPAYA.test(b));
  if (belum) return { keadaan: "belum-ada", kalimat: belum };
  const kalimat = butir.find((b) => POLA_UPAYA_DAMAI.test(b)) || "";
  if (!kalimat) return { keadaan: "", kalimat: "" };
  const berhasil = POLA_BERHASIL_RUKUN.test(kalimat) && !POLA_TIDAK_BERHASIL.test(kalimat) && !POLA_RETAK_LAGI.test(kalimat);
  // 27 Okt: siapa yang mendamaikan (keluarga / aparat / keduanya / lainnya), dibaca di sekitar kata upaya damainya.
  return { keadaan: berhasil ? "berhasil" : "gagal", kalimat, perukun: upayaDamaiPerukun.perukunDari(kalimat, POLA_UPAYA_DAMAI) };
}

/**
 * ============================================================================
 * S5=H1 (10 Okt 2026) - KESEPAKATAN SAKSI DAN TINGKAT YAKIN, TERPISAH
 * ============================================================================
 *
 * `keyakinan` tetap berarti apa yang dikatakan para saksi (pasti = kedua
 * saksi sama) - lencana lama dan centangnya bergantung padanya. Dua ruas
 * baru untuk 0222/0246/9944/5227:
 *   kesepakatan  "sama" | "berbeda" | "satu saksi" | "dihitung" | "posita" | ""
 *   tingkat      "pasti" | "cukup" | "ragu" - SEBERAPA SERING usulan dalam
 *                golongan itu SAMA dengan isian akhir petugas, terukur atas
 *                putusan nyata. Hanya "pasti" yang ikut "Input semua yang
 *                pasti" (H3); "ragu" tidak dicentang sendiri.
 *   dasarTingkat ciri golongannya, untuk dibaca petugas.
 * Kedua saksi sama BELUM tentu pasti: "sejak tahun 2023" dari kedua saksi
 * hanya 1 dari 3 sama dengan isian petugas (petugas menulis bulannya dari
 * posita). Angka per golongan ada di ATURAN_TINGKAT_S5.
 */
function normalWaktu(x) {
  // 31 Okt: "tanggal 23 Juli 2024" dibandingkan dengan posita pada tingkat bulan.
  const t = String(x || "").toLowerCase().replace(/^(?:bulan|tanggal\s+\d{1,2})\s+/, "").replace(/[.,;]+$/, "").replace(/\s+/g, " ").trim();
  return t;
}

/**
 * S5=H1 - SIAPA PELAKU SEBAB ITU. Kalimat 5227 selalu berbunyi "{pelaku}
 * ..." (pelaku = 0047 = Tergugat/Termohon). Bila subjek kalimat pemicunya
 * PIHAK YANG MENGAJUKAN (0046 = Penggugat/Pemohon) - "Penggugat pergi
 * meninggalkan", "Pemohon berjudi" - memasukkannya berarti menuduh pihak
 * yang salah di putusan. Ciri itu dikeluarkan dari kalimat dan disebut.
 *
 * Subjek = sebutan TERAKHIR sebelum kata cirinya dalam 70 huruf, yang tidak
 * didahului kata objek/milik (POLA_BUKAN_SUBJEK: "kepada", "keluarga",
 * "menuduh" tidak termasuk - "Tergugat menuduh Penggugat selingkuh" berarti
 * Penggugat dituduh, dan itu pun bukan perbuatan Tergugat). Kata pasif
 * ("dipukul") dan ciri tanpa pelaku (perselisihan, ekonomi, campur tangan
 * keluarga) tidak dinilai. "Penggugat dan Tergugat ..." tidak dinilai.
 * @returns {"pelaku"|"lawan"|"tuduhan"|""}
 */
const KUNCI_TANPA_PELAKU = new Set(["perselisihan terus-menerus", "masalah ekonomi", "campur tangan keluarga"]);
// P1-P3-S6 10 Okt: POLA_KATA_TUDUH, POLA_SELA_MINTA, POLA_SELA_SAMBUNG, POLA_AWAL_KLAUSA
// (dan POLA_BUKAN_SUBJEK) dipindah APA ADANYA ke kamus-deteksi/awal/pelaku.json (kunci tuduh,
// sela-minta, sela-sambung, awal-klausa, bukan-subjek). pelakuSatuKata menerima penguji
// kamus dari pemanggilnya (dibangun sekali per kalimat, bukan per kemunculan).
// Sela yang menyambung KE PERBUATAN LAIN - sesudahnya bukan lagi isi tuduhan (kunci sela-sambung).
// Sebutan pihak yang mengajukan dianggap SUBJEK hanya di awal klausa -
// "uang Penggugat untuk bermain judi", "barang pribadi Penggugat agar ...",
// "nama baik Penggugat kepada selingkuhan Tergugat" bukan perbuatannya.
// (kunci awal-klausa)
/** Penilaian satu kemunculan kata ciri di kalimat (huruf kecil). */
function pelakuSatuKata(kecil, i, ujiPelaku) {
  const uj = ujiPelaku || deteksiAlasan.penguji("pelaku");
  const depan = kecil.slice(Math.max(0, i - 70), i);
  const semua = [...depan.matchAll(/(penggugat|tergugat|pemohon|termohon)/g)];
  if (!semua.length) return "";
  const m = semua[semua.length - 1];
  const sebelum = depan.slice(0, m.index);
  const sela = depan.slice(m.index + m[0].length);
  if (/[.;]/.test(sela) || /\boleh\b/.test(sela)) return "";
  const sisi = /tergugat|termohon/.test(m[1]) ? "pelaku" : "lawan";
  // "Tergugat menuduh Penggugat selingkuh" - tuduhan, bukan perbuatan.
  if (sisi === "lawan" && uj.uji("tuduh", sebelum)) {
    return sela.length <= 30 && !uj.uji("sela-sambung", sela) && !/,/.test(sela) ? "tuduhan" : "";
  }
  if (uj.uji("bukan-subjek", sebelum) || /\bme\w+\s+$/.test(sebelum)) {
    // Sebutan itu OBJEK ("memukul Penggugat, mencekik") - subjeknya sebutan
    // sebelumnya, bila ada dan tidak terpotong titik.
    if (semua.length < 2) return "";
    const s2 = semua[semua.length - 2];
    const sela2 = depan.slice(s2.index + s2[0].length);
    if (/[.;]/.test(sela2) || uj.uji("bukan-subjek", depan.slice(0, s2.index))) return "";
    return /tergugat|termohon/.test(s2[1]) ? "pelaku" : "";
  }
  if (/(penggugat|tergugat|pemohon|termohon)\s+(dan|&|serta|maupun|bersama)\s+$/.test(sebelum)) return "";
  if (sisi === "lawan" && (sela.length > 40 || /,/.test(sela) || uj.uji("sela-minta", sela) || uj.uji("sela-sambung", sela))) return "";
  if (sisi === "lawan" && !uj.uji("awal-klausa", sebelum)) return "";
  return sisi;
}
function pelakuCiri(kalimat, ciri, daftar) {
  if (!kalimat || KUNCI_TANPA_PELAKU.has(ciri)) return "";
  const kecil = String(kalimat).toLowerCase();
  const d = daftar || CIRI_ALASAN;
  const uj = deteksiAlasan.penguji("pelaku");
  const hasil = new Set();
  for (const baris of d) {
    if (baris.kunci !== ciri || !barisBerlaku(kecil, baris, d)) continue;
    const kata = baris.kata[0];
    if (/^di[a-z]/.test(kata)) continue;
    for (let i = kecil.indexOf(kata); i >= 0; i = kecil.indexOf(kata, i + 1)) hasil.add(pelakuSatuKata(kecil, i, uj));
  }
  // Satu kemunculan yang dilakukan pelaku cukup untuk memasukkannya.
  if (hasil.has("pelaku")) return "pelaku";
  if (hasil.has("lawan")) return "lawan";
  if (hasil.has("tuduhan")) return "tuduhan";
  return "";
}

function golonganS5(kode, info, u) {
  const gab = info.gab || {};
  const dariPosita = gab.dariPosita || (Array.isArray(u.sumber) && u.sumber.length > 0 && u.sumber.every((x) => x && x.asal === "posita"));
  const kesepakatan = dariPosita
    ? "posita"
    : gab.dihitung
    ? "dihitung"
    : gab.keyakinan === "pasti"
    ? "sama"
    : gab.keyakinan === "bentrok"
    ? "berbeda"
    : gab.keyakinan === "cukup"
    ? "satu saksi"
    : gab.keyakinan === "ragu" && kode === "5227"
    ? "sama"
    : "";
  const fitur = [];
  if (kode === "0222" || kode === "0246") {
    fitur.push(/^(?:bulan|tanggal) /.test(u.nilai) ? "bulan" : /^(awal|akhir|pertengahan) /.test(u.nilai) ? "bagian" : "tahun");
    if (gab.diperkaya) fitur.push("bulan-dari-posita");
    const p = normalWaktu(info.posita);
    const n = normalWaktu(u.nilai);
    if (!p) fitur.push("tanpa-posita");
    else if (p === n) fitur.push("posita-sama");
    else if (p.slice(-4) === n.slice(-4)) fitur.push("posita-tahun-sama");
    else fitur.push("posita-beda");
  } else if (kode === "9944") {
    const pb = u.pembanding;
    if (!pb) fitur.push("tanpa-hitung");
    else fitur.push(totalBulan(u.nilai) === pb.totalBulan ? "hitung-sama" : Math.abs(totalBulan(u.nilai) - pb.totalBulan) <= 2 ? "hitung-dekat" : "hitung-beda");
    const p = totalBulan(info.posita);
    if (p === null) fitur.push("tanpa-posita");
    else fitur.push(p === totalBulan(u.nilai) ? "posita-sama" : "posita-beda");
    const kal = (info.ucap || []).map((x) => String((x && x.kalimat) || "")).join(" ");
    if (/(tahun|bulan)\s+(lebih|lewat)\b/i.test(kal)) fitur.push("lebih");
  } else if (kode === "5227") {
    if (!info.gugatanTerbaca) fitur.push("tanpa-posita");
  }
  return { kesepakatan, fitur };
}

/**
 * Aturan tingkat yakin per golongan, berurutan (yang pertama cocok menang).
 * Golongan yang tidak tercantum = "cukup". Ambang: pasti >= 95% sama dengan
 * isian akhir petugas pada n >= 20; ragu bila < 75%.
 *
 * Terukur 10 Okt 2026 atas putusan PA Donggala yang SUDAH diputus (salinan
 * server 9 Okt; keterangan saksi abt_keterangan_saksi + posita SIPP, isian
 * petugas abt_data_teks; ukur.js di D:/aleta-dev/kerja/saksi-ke-hakim):
 *   0222 sama+bulan+posita sama          98/101  97%  -> pasti
 *   0246 sama+bulan+posita sama         180/185  97%  -> pasti
 *   0222/0246 bulan diambil dari posita  23/42   55%  -> ragu
 *   0222/0246 posita menyebut lain        9/19   47%  -> ragu
 *   0246 tahun saja, posita diam          1/6         -> ragu
 *   9944 dihitung dari 0246 ke sidang     9/43   21%  -> ragu
 *   9944 posita menyebut lama lain       ~40%         -> ragu
 *   9944 ucapan beda dgn hitungan         ~45%        -> ragu
 *   9944 sama+hitung dekat+posita sama   90/101  89%  -> cukup (tidak ada
 *        golongan 9944 yang mencapai 95% - 9944 TIDAK PERNAH pasti)
 *   5227 kedua saksi sama: susunan alasan persis sama dengan petugas hanya
 *        25/301 (8%), beririsan 238/301 (79%) - petugas memilih sebagian
 *        alasan. 5227 TIDAK PERNAH pasti; tetap dicentang seperti dahulu.
 */
const ATURAN_TINGKAT_S5 = [
  { kode: "0222", kesepakatan: "sama", dengan: ["bulan", "posita-sama"], tanpa: ["bulan-dari-posita"], tingkat: "pasti" },
  { kode: "0246", kesepakatan: "sama", dengan: ["bulan", "posita-sama"], tanpa: ["bulan-dari-posita"], tingkat: "pasti" },
  ...["0222", "0246"].flatMap((kode) => [
    { kode, dengan: ["bulan-dari-posita"], tingkat: "ragu" },
    { kode, dengan: ["posita-beda"], tingkat: "ragu" },
    { kode, dengan: ["posita-tahun-sama"], tingkat: "ragu" },
    { kode, dengan: ["tahun", "tanpa-posita"], tingkat: "ragu" },
  ]),
  { kode: "9944", kesepakatan: "dihitung", tingkat: "ragu" },
  { kode: "9944", dengan: ["posita-beda"], tingkat: "ragu" },
  { kode: "9944", dengan: ["hitung-beda"], tingkat: "ragu" },
  { kode: "5227", tingkat: "cukup" },
];

function tingkatS5(kode, kesepakatan, fitur) {
  if (!kesepakatan) return "";
  if (kesepakatan === "posita" || kesepakatan === "berbeda") return "ragu";
  for (const a of ATURAN_TINGKAT_S5) {
    if (a.kode !== kode) continue;
    if (a.kesepakatan && a.kesepakatan !== kesepakatan) continue;
    if ((a.dengan || []).some((f) => !fitur.includes(f))) continue;
    if ((a.tanpa || []).some((f) => fitur.includes(f))) continue;
    return a.tingkat;
  }
  return "cukup";
}

function tandaiS5(daftar, peta) {
  for (const u of daftar) {
    const info = peta[u.kode];
    if (!info) continue;
    if (!u.nilai) {
      u.kesepakatan = "";
      u.tingkat = "";
      continue;
    }
    const { kesepakatan, fitur } = golonganS5(u.kode, info, u);
    u.kesepakatan = kesepakatan;
    u.tingkat = tingkatS5(u.kode, kesepakatan, fitur);
    u.dasarTingkat = [kesepakatan, ...fitur].join(", ");
    // Keyakinan "ragu" dari bot sendiri tidak pernah naik menjadi pasti.
    if (u.keyakinan === "ragu") u.tingkat = "ragu";
    if (info.gab && info.gab.nilaiSaksi) u.nilaiSaksi = info.gab.nilaiSaksi;
  }
}

function dariKeteranganSaksi(teksSaksi1, teksSaksi2, tanggalSidang, pihak, posita, opsi) {
  const b1 = butirKeterangan(teksSaksi1);
  const b2 = butirKeterangan(teksSaksi2);

  const sumberDari = (kalimat, nomor) => (kalimat ? [{ saksi: nomor, kalimat }] : []);

  // Posita dipecah sekali di sini: dipakai cadangan 0222 dan saringan 5227.
  const butirPosita = butirKeterangan(posita);

  // ==========================================================================
  // 0222 - AWAL KONFLIK: SAKSI LEBIH DULU, POSITA HANYA BILA SAKSI DIAM
  // ==========================================================================
  //
  // Kata konflik diperluas (berselisih, bertengkar, tidak rukun, tidak
  // harmonis, cekcok) + "sejak/mulai" + tahun. Terukur atas perkara yang
  // 0222-nya diisi manusia sebelum 1 September 2026 (ukur-t1.js dan
  // coba-0222-posita.js di folder kerja t1-deteksi-saksi-bot):
  //   kata lama "perselisihan" + "sejak"        72,5%
  //   kata diperluas, saksi saja                77,2%  (250/324)
  //   + posita bila KEDUA saksi tidak menyebut   87,7%  (284/324)
  //   posita lebih dulu                          90,1%  (292/324) - TIDAK dipakai
  //
  // Sebagian besar yang terlewat bukan salah baca: saksinya memang tidak
  // menyebut tahun ("sejak Tergugat kembali dari Tangerang", "2 bulan setelah
  // menikah"), dan petugas mengisi 0222 dari dalil posita. Cadangan posita
  // karena itu dipakai - tetapi hanya bila kedua saksi diam, berkeyakinan
  // "ragu", bersumber "Posita", dan catatannya menyebut bahwa itu dalil yang
  // belum dikuatkan saksi. Posita tidak pernah MENGALAHKAN saksi walau terukur
  // lebih sering sama dengan isian petugas: fakta di putusan dibuktikan saksi.
  // Bila keduanya berbeda, bunyi posita disebut di catatan sebagai pembanding.
  const konflik1 = kalimatAwalKonflik(b1);
  const konflik2 = kalimatAwalKonflik(b2);
  const awal = gabungkanWaktu(ambilBulanTahun(konflik1, { tanggal: true }).nilai, ambilBulanTahun(konflik2, { tanggal: true }).nilai);
  let konflikPosita = kalimatAwalKonflik(butirPosita);
  let awalPosita = ambilBulanTahun(konflikPosita).nilai;
  if (!awalPosita && butirPosita.length) {
    // S5=H1: pembaca posita per peristiwa (butir 24) sebagai cadangan kedua.
    const lain = awalKonflikPosita(butirPosita);
    if (lain.nilai) {
      awalPosita = lain.nilai;
      konflikPosita = lain.kalimat;
    }
  }
  let sumberAwal = [...sumberDari(konflik1, 1), ...sumberDari(konflik2, 2)];
  if (!awal.nilai && awalPosita) {
    awal.nilai = awalPosita;
    awal.keyakinan = "ragu";
    awal.catatan =
      "Kedua saksi tidak menyebut kapan perselisihan mulai; diambil dari posita - dalil yang belum dikuatkan saksi.";
    sumberAwal = [{ saksi: 0, asal: "posita", kalimat: konflikPosita }];
  } else if (awal.nilai && awalPosita && awalPosita.toLowerCase() !== awal.nilai.toLowerCase()) {
    awal.catatan = `Posita menyebut "${awalPosita}"; yang diusulkan keterangan saksi.`;
  }

  // 0246 - pisah rumah, termasuk bentuk "puncak ... pergi meninggalkan".
  const pisah1 = kalimatPisahRumah(b1);
  const pisah2 = kalimatPisahRumah(b2);
  const pisah = gabungkanWaktu(ambilBulanTahun(pisah1, { tanggal: true }).nilai, ambilBulanTahun(pisah2, { tanggal: true }).nilai);
  let sumberPisah = [...sumberDari(pisah1, 1), ...sumberDari(pisah2, 2)];

  // ==========================================================================
  // S5=H1 (10 Okt 2026) - POSITA MENGISI KARTU YANG "TIDAK DITEMUKAN"
  // ==========================================================================
  //
  // Dua keadaan, keduanya TERUKUR atas putusan nyata PA Donggala yang sudah
  // diputus (ukur.js di D:/aleta-dev/kerja/saksi-ke-hakim, salinan 9 Okt):
  //   1. kedua saksi diam -> nilai posita, keyakinan "ragu" (tidak dicentang
  //      sendiri), asal "posita": dalil yang belum dikuatkan saksi.
  //   2. saksi hanya menyebut TAHUN, posita menyebut bulan pada tahun yang
  //      sama -> bulannya dari posita. Petugas menulis "bulan Mei 2023" saat
  //      saksi berkata "sejak tahun 2023" (271, 430, 458, 468/Pdt.G/2025):
  //      bulannya diambil dari dalil yang tahunnya dikuatkan saksi.
  // Tingkat yakin (pasti/cukup/ragu) diberikan sesudahnya oleh tingkatS5().
  const pisahPosita = butirPosita.length ? pisahSejakPosita(butirPosita) : { nilai: "", kalimat: "" };
  const perkayaBulan = (gab, nilaiPosita, kalimatPosita, sumberLama) => {
    const thn = String(gab.nilai || "").match(/^tahun (\d{4})$/);
    const bln = String(nilaiPosita || "").match(/(?:bulan \S+|(?:awal|akhir|pertengahan) tahun) (\d{4})$/);
    if (!thn || !bln || thn[1] !== bln[1]) return sumberLama;
    gab.nilaiSaksi = gab.nilai;
    gab.nilai = nilaiPosita.replace(/^(awal|akhir|pertengahan) bulan /, "bulan ");
    gab.diperkaya = true;
    gab.catatan = `Saksi menyebut ${gab.nilaiSaksi}; bulannya dari posita ("${nilaiPosita}").`;
    return [...sumberLama, { saksi: 0, asal: "posita", kalimat: kalimatPosita }];
  };
  const isiDariPosita = (gab, nilaiPosita, kalimatPosita, nama) => {
    gab.nilai = nilaiPosita;
    gab.keyakinan = "ragu";
    gab.dariPosita = true;
    gab.catatan = `Kedua saksi tidak menyebut ${nama}; diambil dari posita - dalil yang belum dikuatkan saksi.`;
    return [{ saksi: 0, asal: "posita", kalimat: kalimatPosita }];
  };
  if (!pisah.nilai && pisahPosita.nilai) {
    sumberPisah = isiDariPosita(pisah, pisahPosita.nilai.replace(/^(awal|akhir|pertengahan) bulan /, "bulan "), pisahPosita.kalimat, "sejak kapan pisah rumah");
  } else if (pisah.nilai && pisah.keyakinan !== "bentrok") {
    sumberPisah = perkayaBulan(pisah, pisahPosita.nilai, pisahPosita.kalimat, sumberPisah);
  }
  if (awal.nilai && !awal.dariPosita && awal.keyakinan !== "bentrok" && sumberAwal.every((s) => s.asal !== "posita")) {
    sumberAwal = perkayaBulan(awal, awalPosita, konflikPosita, sumberAwal);
  }

  // ==========================================================================
  // 9944 - UCAPAN SAKSI LEBIH DULU, HITUNGAN SEBAGAI PEMBANDING DAN CADANGAN
  // ==========================================================================
  //
  // Sampai 2.35.0 yang dihitung dari 0246 sampai tanggal sidang MENGALAHKAN
  // yang diucapkan. Alasannya masuk akal - angka ucapan basi pada sidang
  // berikutnya - tetapi terukur: hanya 38,6% yang sama dengan isian
  // manusia, sebab "sejak Mei" dihitung dari 1 Mei, sedangkan saksi dan
  // petugas menulis "1 tahun 4 bulan" dan hitungannya "1 tahun 6 bulan".
  // Akibatnya angka di putusan berbeda dengan angka di berita acara yang sama.
  //
  // Keputusan pengguna 9: ucapan saksi lebih dulu. Hitungannya tetap
  // disandingkan (ruas `pembanding` dan catatan), dan HANYA dipakai bila
  // kedua saksi tidak menyebut angka sama sekali.
  const ucap1 = lamaDiucapkan(b1);
  const ucap2 = lamaDiucapkan(b2);
  const lama = gabungkan(ucap1.nilai, ucap2.nilai);
  // 27 Okt: 0246 yang hanya tahun / awal-pertengahan-akhir tahun (hitungLamaPisah tidak membacanya) dihitung sebagai
  // perkiraan - "lebih kurang N tahun M bulan", keyakinan ragu.
  let dihitung = hitungLamaPisah(pisah.nilai, tanggalSidang);
  if (!dihitung) {
    const kira = lamaSejakAcuan(pisah.nilai, tanggalSidang);
    if (kira && kira.taksiran) dihitung = { teks: `lebih kurang ${kira.teks}`, totalBulan: kira.totalBulan, taksiran: true };
  }
  if (dihitung) {
    lama.pembanding = { teks: dihitung.teks, totalBulan: dihitung.totalBulan, dari: pisah.nilai, sampai: tanggalSidang };
    if (!lama.nilai) {
      lama.nilai = dihitung.teks;
      lama.dihitung = true;
      // S5=H1: titik awalnya dari posita (pisah.dariPosita) -> hitungannya
      // pun dalil yang belum dikuatkan saksi.
      lama.keyakinan = pisah.dariPosita || dihitung.taksiran ? "ragu" : "cukup";
      if (pisah.dariPosita) lama.dariPosita = true;
      lama.catatan =
        `Saksi tidak menyebut lamanya; dihitung dari ${pisah.nilai} sampai tanggal sidang ${tanggalSidang}` +
        (dihitung.taksiran ? " (perkiraan: bulan mulai pisah tidak disebut)." : ".");
    } else if (totalBulan(lama.nilai) !== dihitung.totalBulan) {
      lama.catatan =
        `Saksi menyebut "${lama.nilai}"; dihitung dari ${pisah.nilai} sampai sidang ${tanggalSidang} ` +
        `hasilnya ${dihitung.teks}. Yang diusulkan ucapan saksi, supaya sama dengan berita acara.`;
    }
  }

  let sumberLama = [...sumberDari(ucap1.kalimat || pisah1, 1), ...sumberDari(ucap2.kalimat || pisah2, 2)];
  if (!lama.nilai && butirPosita.length) {
    // S5=H1: kedua saksi diam dan tidak ada yang dapat dihitung - lama pisah
    // yang didalilkan posita, "ragu".
    const lamaPosita = lamaPisahPosita(butirPosita);
    if (lamaPosita && lamaPosita.nilai) {
      sumberLama = isiDariPosita(lama, lamaPosita.nilai, lamaPosita.kalimat, "lama pisah");
    }
  }

  // 7035 - siapa yang meninggalkan kediaman bersama. Jawabannya satu kata,
  // dan blangkonya memang menuntut satu kata.
  //
  // ==========================================================================
  // SEBUTAN PIHAKNYA IKUT JENIS PERKARA - DAN DULU TIDAK
  // ==========================================================================
  //
  // Sampai 2.32.0 fungsi ini hanya mencari untai "tergugat" dan "penggugat".
  // Pada perkara PERMOHONAN dan CERAI TALAK pihaknya disebut Pemohon dan
  // Termohon, jadi kalimat "Yang meninggalkan tempat tinggal bersama adalah
  // Termohon;" DITEMUKAN - kutipannya tetap tampil di panel - tetapi
  // nilainya kosong, dan lencananya berbunyi "tidak ditemukan".
  //
  // Terukur pada abt_keterangan_saksi (66.506 jawaban): dari 4.337 jawaban
  // yang memuat kata "meninggalkan", 846 (19,5%) HANYA menyebut
  // Pemohon/Termohon - menyentuh 331 perkara.
  //
  // Yang dipulangkan sekarang SEBUTAN YANG DIPAKAI PERKARA ITU, bukan untai
  // tetap: pihak.pelaku dan pihak.lawan datang dari variabel ABT 0046 dan
  // 0047, yang memang berisi "Pemohon"/"Penggugat" dan
  // "Termohon"/"Tergugat" menurut perkaranya.
  //
  // PERHATIAN pada urutan huruf: "termohon" TIDAK memuat "pemohon" sebagai
  // bagian kata (t-e-r-m-o-h-o-n), jadi keduanya aman dicari terpisah. Yang
  // TIDAK boleh dipakai adalah "mohon" telanjang - ia menyala pada keduanya.
  //
  // Subjeknya dibaca dari letaknya di kalimat - lihat siapaPergiDari.
  //
  // ==========================================================================
  // NAMA RUASNYA MENJEBAK - PERIKSA SEBELUM MENYUNTING
  // ==========================================================================
  //
  //   pihak.pelaku  = variabel ABT 0047 = "Tergugat" / "Termohon"
  //   pihak.lawan   = variabel ABT 0046 = "Penggugat" / "Pemohon"
  //
  // Kebalikan dari yang disangka namanya, dan sudah dua kali tertukar di
  // repo ini. Lihat VAR_PIHAK_LAWAN/VAR_PIHAK_PELAKU di ekstensi-sipp/abt.js -
  // di sanalah pasangannya ditetapkan. siapaPergiDari memulangkan SISI
  // ("pelaku"/"lawan") yang ditetapkan dari kata tergugat/termohon di
  // kalimatnya sendiri, bukan dari nama ruas.
  //
  // Cadangannya untai lama - perkara yang variabel 0046/0047-nya belum
  // terbaca tetap mendapat jawaban, hanya sebutannya bentuk gugatan.
  const sebutanTergugat = String((pihak && pihak.pelaku) || "").trim() || "Tergugat";
  const sebutanPenggugat = String((pihak && pihak.lawan) || "").trim() || "Penggugat";
  const siapa = (butir) => {
    const hasil = siapaPergiDari(butir);
    if (!hasil.sisi) return { nilai: "", kalimat: hasil.kalimat };
    return { nilai: hasil.sisi === "pelaku" ? sebutanTergugat : sebutanPenggugat, kalimat: hasil.kalimat };
  };
  const siapa1 = siapa(b1);
  const siapa2 = siapa(b2);
  const pergi = gabungkan(siapa1.nilai, siapa2.nilai);

  // ==========================================================================
  // 1268 - TIGA KEADAAN, DAN "BELUM PERNAH ADA UPAYA" TIDAK DIISI SENDIRI
  // ==========================================================================
  //
  // Dahulu apa pun yang bukan "tidak berhasil" dianggap berhasil, sehingga
  // "belum pernah ada upaya untuk merukunkan" menjadi kalimat "pihak keluarga
  // telah berusaha untuk mendamaikan ..." dengan keyakinan pasti - fakta yang
  // terbalik, masuk putusan.
  //
  // Keputusan pengguna 8:
  //   - kata upaya damai diperluas (mendamaikan, menasihati/menasehati,
  //     rukun kembali, upaya damai);
  //   - bunyi berhasil HANYA bila saksi menyebut "berhasil dirukunkan";
  //   - "belum/tidak pernah ada upaya" (oleh saksi MANA PUN) tidak
  //     menghasilkan kalimat: nilainya kosong, keyakinannya "ragu", dan dua
  //     bunyi ditawarkan - bunyi baku gagal dan bunyi belum-ada. Satker lazim
  //     menulis formula "tidak berhasil", jadi pilihannya milik petugas.
  const damai1 = upayaDamaiDari(b1);
  const damai2 = upayaDamaiDari(b2);
  let upaya;
  let perukunSaksi = { kategori: "", kunci: [], teks: [] };
  if (damai1.keadaan === "belum-ada" || damai2.keadaan === "belum-ada") {
    const pilihan = ["gagal", "belum-ada"]
      .map((keadaan) => ({ keadaan, nilai: kalimatBaku.kalimatUpayaDamai(keadaan, pihak, opsi) }))
      .filter((x) => x.nilai);
    const siapaBelum = [damai1.keadaan === "belum-ada" ? 1 : 0, damai2.keadaan === "belum-ada" ? 2 : 0].filter(Boolean);
    upaya = {
      nilai: "",
      keyakinan: "ragu",
      bentrok: "",
      pilihan,
      catatan:
        `Saksi ${siapaBelum.join(" dan ")} menerangkan belum/tidak pernah ada upaya damai. ` +
        "Kalimatnya tidak diisi otomatis - pilih salah satu bunyi, atau tulis sendiri.",
    };
  } else {
    // Kalimatnya dari pustaka, bukan disusun di sini - lihat abtKalimatBaku.js.
    // 27 Okt: pelaku upaya damai gabungan kedua saksi; hanya yang BUKAN "pihak keluarga" biasa mengubah frasa.
    perukunSaksi = upayaDamaiPerukun.gabungPerukun([damai1.perukun, damai2.perukun]);
    const frasaPerukun = perukunSaksi.kategori && perukunSaksi.kategori !== "keluarga" ? upayaDamaiPerukun.teksPerukun(perukunSaksi) : "";
    const kalimatDari = (d) => (d.keadaan ? kalimatBaku.kalimatUpayaDamai(d.keadaan, pihak, opsi, d.keadaan === "belum-ada" ? "" : frasaPerukun) : "");
    upaya = gabungkan(kalimatDari(damai1), kalimatDari(damai2));
    // Keadaannya terbaca tetapi bunyinya tidak tersedia (dimatikan lewat
    // pengaturan): disebut, bukan menjadi "tidak ditemukan" yang menyesatkan.
    const tanpaBunyi = [damai1, damai2].filter((d) => d.keadaan && !kalimatDari(d)).map((d) => d.keadaan);
    if (tanpaBunyi.length) {
      upaya.catatan = `Keadaan "${tanpaBunyi[0]}" terbaca, tetapi bunyinya tidak tersedia di daftar putusan.upaya-damai.bunyi.`;
    }
  }

  // 19 Okt (isian 2): kedua saksi diam soal upaya damai, posita menyebutnya -> kalimat baku sesuai posita. "Berhasil/gagal" dan
  // "keluarga tidak pernah mendamaikan" ditulis menurut apa yang didalilkan (keyakinan "cukup"; sumbernya posita dan
  // tertulis demikian di lencana). Posita yang diam tetap kosong.
  let sumberDamai = [...sumberDari(damai1.kalimat, 1), ...sumberDari(damai2.kalimat, 2)];
  if (!damai1.keadaan && !damai2.keadaan && butirPosita.length) {
    const dp = upayaDamaiPosita(butirPosita);
    perukunSaksi = dp.perukun || perukunSaksi;
    const frasaPosita = perukunSaksi.kategori && perukunSaksi.kategori !== "keluarga" ? upayaDamaiPerukun.teksPerukun(perukunSaksi) : "";
    const bunyiPosita = dp.keadaan ? kalimatBaku.kalimatUpayaDamai(dp.keadaan, pihak, opsi, dp.keadaan === "belum-ada" ? "" : frasaPosita) : "";
    if (bunyiPosita) {
      upaya = {
        nilai: bunyiPosita,
        keyakinan: "cukup",
        bentrok: "",
        catatan: "Kedua saksi tidak menyebut upaya damai; diambil dari posita - dalil yang belum dikuatkan saksi.",
      };
      sumberDamai = [{ saksi: 0, asal: "posita", kalimat: dp.kalimat }];
    }
  }

  // ==========================================================================
  // 5227 - HANYA ALASAN YANG BERSESUAIAN ANTARA KEDUA SAKSI
  // ==========================================================================
  //
  // Dulu cirinya diambil dari GABUNGAN keterangan kedua saksi. Itu membuat
  // 5227 memuat alasan yang hanya diketahui satu orang, dan pada persidangan
  // yang bukan hal kecil: keterangan satu saksi tanpa penguat bukanlah alat
  // bukti yang berdiri sendiri - unus testis nullus testis.
  //
  // Sekarang cirinya diambil dari IRISAN. Contoh yang diminta:
  //
  //   saksi 1  mabuk, madat, memukul
  //   saksi 2  mabuk, memukul
  //   hasil    mabuk dan memukul        madat TIDAK ikut
  //
  // Yang hanya disebut satu saksi TIDAK dibuang diam-diam. Ia dikembalikan
  // sebagai ciriSepihak beserta saksi mana yang menyebutnya, dan panel
  // menampilkannya - supaya yang memutuskan tetap manusia, dan supaya tidak
  // ada yang mengira alasannya tidak terbaca oleh mesin.
  const daftarCiri = daftarCiriEfektif(opsi);
  const ciriSaksi1 = ciriDariKalimat(b1, daftarCiri.daftar);
  const ciriSaksi2 = ciriDariKalimat(b2, daftarCiri.daftar);
  const berdua = ciriSaksi1.filter((x) => ciriSaksi2.includes(x));

  // ==========================================================================
  // SARINGAN KETIGA: APA YANG DIDALILKAN DALAM GUGATAN
  // ==========================================================================
  //
  // Dua saksi yang bersesuaian belum cukup. Yang diperiksa dan diputus adalah
  // DALIL GUGATAN; keterangan saksi membuktikan dalil itu, bukan menambah
  // dalil baru. Alasan yang terbukti di persidangan tetapi tidak pernah
  // didalilkan tidak dapat menjadi dasar putusan - itu memutus melebihi yang
  // dituntut.
  //
  // Diukur pada perkara 510/Pdt.G/2026/PA.Dgl:
  //
  //   gugatan   mabuk, kekerasan fisik, judi online
  //   saksi 1   judi, kekerasan, nafkah, perselisihan
  //   saksi 2   judi, kekerasan, nafkah, perselisihan
  //
  // Tanpa saringan ini, 5227 memuat "melalaikan kewajiban nafkah lahir" -
  // dua saksi memang menerangkannya, tetapi gugatannya tidak pernah
  // mendalilkannya. Dengan saringan ini ia keluar, dan disebut terpisah.
  //
  // Positanya boleh tidak terbaca - halaman yang belum memuatnya, atau
  // perkara yang positanya kosong. Bila begitu, saringan ini TIDAK berlaku
  // dan hasilnya kembali seperti sebelumnya; yang tidak boleh terjadi adalah
  // 5227 menjadi kosong karena gugatannya kebetulan tidak terbaca.
  const ciriPosita = butirPosita.length ? ciriDariKalimat(butirPosita, daftarCiri.daftar) : null;

  const ciriDisaring = ciriPosita ? berdua.filter((x) => ciriPosita.includes(x)) : berdua;
  // S5=H1: ciri yang subjek kalimat pemicunya pihak yang mengajukan (0046)
  // tidak masuk kalimat "{pelaku} ..." - lihat pelakuCiri.
  const ciriPelakuLawan = [];
  const pelakuLawanDi = (nama, sumberButir) => {
    for (const [asal, butir] of sumberButir) {
      const k = kalimatPemicu(butir, nama, daftarCiri.daftar);
      const siapa = k ? pelakuCiri(k, nama, daftarCiri.daftar) : "";
      if (siapa === "lawan" || siapa === "tuduhan") return { ciri: nama, asal, kalimat: k, sebab: siapa };
    }
    return null;
  };
  const ciri = ciriDisaring.filter((nama) => {
    const t = pelakuLawanDi(nama, [["saksi 1", b1], ["saksi 2", b2]]);
    if (t) ciriPelakuLawan.push(t);
    return !t;
  });

  const ciriSepihak = [
    ...ciriSaksi1.filter((x) => !ciriSaksi2.includes(x)).map((nama) => ({ nama, saksi: 1 })),
    ...ciriSaksi2.filter((x) => !ciriSaksi1.includes(x)).map((nama) => ({ nama, saksi: 2 })),
  ];
  // Keputusan pengguna 10: ciri satu saksi tampil sebagai tanda "hanya saksi
  // N" - tidak dicentang, tidak masuk kalimat. Bentuknya lengkap dengan
  // kalimat pemicunya supaya dapat diperiksa tanpa membaca ulang keterangan.
  const tandaSepihak = ciriSepihak.map((x) => ({
    ciri: x.nama,
    saksi: x.saksi,
    label: `hanya saksi ${x.saksi}`,
    kalimat: kalimatPemicu(x.saksi === 1 ? b1 : b2, x.nama, daftarCiri.daftar),
  }));

  // Dua keadaan yang berbeda sama sekali, dan keduanya harus terbaca:
  //
  //   terbukti tak didalilkan   kedua saksi menerangkannya, gugatan diam
  //   didalilkan belum terbukti gugatan mendalilkannya, saksi tidak menguatkan
  //
  // Yang kedua yang paling mahal didiamkan: ia dalil yang harus dibuktikan,
  // dan bila memang tidak terbukti, ia dalil yang harus ditolak - bukan
  // dalil yang dilupakan.
  const ciriDiluarGugatan = ciriPosita ? berdua.filter((x) => !ciriPosita.includes(x)) : [];
  const ciriBelumTerbukti = ciriPosita ? ciriPosita.filter((x) => !berdua.includes(x)) : [];
  // Pihaknya dibaca ekstensi dari variabel 0047 dan 0046 di halaman ABT -
  // "Tergugat" pada cerai gugat, "Termohon" pada cerai talak. Tidak diturunkan
  // dari klasifikasi perkara: menebaknya berarti salah menyebut pihak pada
  // perkara yang klasifikasinya tidak terduga.
  const alasanTersusun = kalimatBaku.susunAlasanRinci(ciri, pihak, opsi);
  const kalimatAlasan = alasanTersusun.kalimat;
  // Ciri yang dikuatkan kedua saksi tetapi tidak punya frasa baku (zina,
  // penjara, cacat badan, taklik - lihat abtKalimatBaku.js). Ia TIDAK ikut
  // kalimat, dan justru karena itu harus terbaca: keyakinannya turun menjadi
  // "ragu" dan catatannya menyebut ciri mana yang harus ditulis sendiri.
  const ciriTanpaFrasa = alasanTersusun.tanpaFrasa;
  const hasil5227 = {
    nilai: kalimatAlasan,
    keyakinan: !ciri.length ? "kosong" : ciriTanpaFrasa.length ? "ragu" : "pasti",
    bentrok: "",
    catatan: ciriTanpaFrasa.length
      ? `Kedua saksi juga menerangkan ${ciriTanpaFrasa.join(", ")}, tetapi belum ada frasa bakunya - ` +
        "kalimat di atas TIDAK memuatnya; tambahkan sendiri bila terbukti."
      : "",
  };
  let sumber5227 = sumberBerpasangan(ciri, b1, b2, daftarCiri.daftar);
  const ciriPositaPelaku = (ciriPosita || []).filter((nama) => {
    const t = pelakuLawanDi(nama, [["posita", butirPosita]]);
    if (t && !ciriPelakuLawan.some((x) => x.ciri === nama)) ciriPelakuLawan.push(t);
    return !t;
  });
  if (!ciri.length && ciriPositaPelaku.length) {
    // S5=H1: kedua saksi tidak menerangkan alasan yang sama (atau yang sama
    // tidak didalilkan) - kalimatnya disusun dari DALIL posita, "ragu".
    const dariPosita = kalimatBaku.susunAlasanRinci(ciriPositaPelaku, pihak, opsi);
    if (dariPosita.kalimat) {
      hasil5227.nilai = dariPosita.kalimat;
      hasil5227.keyakinan = "ragu";
      hasil5227.dariPosita = true;
      hasil5227.catatan =
        (berdua.length
          ? "Alasan yang diterangkan kedua saksi tidak didalilkan gugatan"
          : "Kedua saksi tidak menerangkan alasan yang sama") + "; disusun dari posita - dalil yang belum dikuatkan saksi.";
      sumber5227 = ciriPositaPelaku
        .slice(0, 6)
        .map((nama) => ({ saksi: 0, asal: "posita", kalimat: kalimatPemicu(butirPosita, nama, daftarCiri.daftar) }))
        .filter((x) => x.kalimat);
    }
  }

  /* === R2 14 Okt: SEBAB 5227 DIPERLUAS (deteksi/sebabCerai.js) === */
  // Cerai talak: kewajiban nafkah ada pada suami - ciri nafkah tidak pernah
  // menjadi "Termohon melalaikan ..." (abtKalimatBaku.susunAlasanRinci).
  // Disebut di catatan bila ia satu-satunya yang tertinggal.
  const catatanNafkahCt = (alasanTersusun.tidakBerlaku || []).length
    ? `Cerai talak: kewajiban nafkah lahir ada pada ${sebutanPenggugat} (suami) - "${sebutanTergugat} melalaikan kewajiban nafkah lahir" tidak diusulkan.`
    : "";
  if (catatanNafkahCt) hasil5227.catatan = [hasil5227.catatan, catatanNafkahCt].filter(Boolean).join(" ");
  // Sebab yang tidak tertangkap ciri lama (keluarga ikut campur, merendahkan
  // / tidak menghargai sebagai kepala keluarga, tidak taat, ...). Galat di
  // sini tidak boleh mematahkan usulan lama.
  let sebab5227 = null;
  try {
    sebab5227 = sebabCerai.perluas5227({
      ciri,
      ciriPositaPelaku,
      b1,
      b2,
      butirPosita,
      pihak: { pelaku: sebutanTergugat, lawan: sebutanPenggugat },
      peta: kalimatBaku.frasaCiriEfektif(opsi).peta,
      susunLama: (daftar) => kalimatBaku.susunAlasanRinci(daftar, pihak, opsi).kalimat,
      lama: {
        nilai: hasil5227.nilai,
        dariPosita: Boolean(hasil5227.dariPosita),
        hanyaPerselisihan:
          hasil5227.nilai === kalimatBaku.isiPenandaPihak(kalimatBaku.KALIMAT.hanyaPerselisihan, sebutanTergugat, sebutanPenggugat),
      },
    });
  } catch (_) {
    sebab5227 = null;
  }
  if (sebab5227) {
    hasil5227.nilai = sebab5227.nilai;
    hasil5227.dariPosita = sebab5227.dariPosita;
    // Ciri tanpa frasa yang kini terwakili sebab baru tidak lagi "tertinggal".
    for (let i = ciriTanpaFrasa.length - 1; i >= 0; i--) if (sebab5227.tertutup.includes(ciriTanpaFrasa[i])) ciriTanpaFrasa.splice(i, 1);
    const sisaTanpaFrasa = ciriTanpaFrasa.length
      ? `Kedua saksi juga menerangkan ${ciriTanpaFrasa.join(", ")}, tetapi belum ada frasa bakunya - kalimat di atas TIDAK memuatnya; tambahkan sendiri bila terbukti.`
      : "";
    hasil5227.keyakinan = sisaTanpaFrasa ? "ragu" : sebab5227.keyakinan;
    hasil5227.catatan = [sisaTanpaFrasa, sebab5227.catatan, catatanNafkahCt].filter(Boolean).join(" ");
    sumber5227 = sebab5227.sumber;
  }
  /* === AKHIR R2 === */

  // Entri daftar dari pengaturan yang ditolak penyaring - disebut, bukan
  // ditelan. Ruasnya hanya ada bila memang ada yang ditolak.
  const tipeKeluaranDitolak = [
    ...daftarCiri.ditolak,
    ...alasanTersusun.ditolak,
    ...kalimatBaku.bunyiUpayaDamaiEfektif(opsi).ditolak,
  ];

  // ==========================================================================
  // NOMOR 4 - PEMERIKSA SILANG DUA SAKSI
  // ==========================================================================
  //
  // Yang dikumpulkan bukan hanya selisih pada enam variabel di atas, melainkan
  // juga selisih pada fakta yang tidak punya variabelnya sendiri - berapa kali
  // saksi melihat pertengkaran, misalnya. Keduanya persoalan pembuktian yang
  // sama beratnya, dan keduanya lebih murah ditemukan sekarang daripada
  // sesudah putusan dibacakan.
  const selisih = [];
  const bandingkan = (judul, a, b) => {
    const kiri = (a || "").trim();
    const kanan = (b || "").trim();
    if (kiri && kanan && kiri.toLowerCase() !== kanan.toLowerCase() && !waktuSetara(kiri, kanan)) {
      selisih.push({ hal: judul, saksi1: kiri, saksi2: kanan });
    }
  };
  bandingkan("Awal konflik", ambilBulanTahun(konflik1, { tanggal: true }).nilai, ambilBulanTahun(konflik2, { tanggal: true }).nilai);
  bandingkan("Pisah rumah", ambilBulanTahun(pisah1, { tanggal: true }).nilai, ambilBulanTahun(pisah2, { tanggal: true }).nilai);
  bandingkan("Lama pisah", ucap1.nilai, ucap2.nilai);
  bandingkan("Yang meninggalkan", siapa1.nilai, siapa2.nilai);

  const kali = (butir) => {
    const kalimat = cariButir(butir, ["sebanyak"]);
    const angka = kalimat.match(/sebanyak\s+(\d+)\s*kali/i);
    return angka ? `${angka[1]} kali` : "";
  };
  bandingkan("Berapa kali saksi melihat pertengkaran", kali(b1), kali(b2));

  // ==========================================================================
  // NOMOR 6 - HURUF ALASAN: DIUSULKAN MENURUT KEPUTUSAN 11, TIDAK DICENTANG
  // ==========================================================================
  //
  // Dahulu aturanAlasan.usulkan() atas SELURUH teks kedua saksi: B menyala
  // pada kata "meninggalkan", D pada "memukul". Kini dari ciri yang sudah
  // disaring dan dari lama pisah yang diusulkan 9944 - lihat
  // abtAturanAlasan.usulkanUntukBlangko01.
  const hurufBlangko = aturanAlasan.usulkanUntukBlangko01({
    ciriSaksi1,
    ciriSaksi2,
    ciri,
    lamaPisahBulan: totalBulan(lama.nilai),
  });

  const hasil = {
    butir: { saksi1: b1.length, saksi2: b2.length, posita: butirPosita.length },
    ciriSepihak,
    tandaSepihak,
    ciriDiluarGugatan,
    ciriBelumTerbukti,
    ciriTanpaFrasa,
    // Benar bila gugatannya benar-benar terbaca dan ikut menyaring. Layar
    // memakainya untuk membedakan "tidak ada yang di luar gugatan" dari
    // "gugatannya tidak terbaca sehingga tidak diperiksa".
    gugatanTerbaca: Boolean(ciriPosita),
    ciri,
    selisih,
    // Nomor 6: huruf alasan diusulkan beserta bunyi resminya, tanpa satu pun
    // ditandai terpilih - lihat abtAturanAlasan.js.
    huruf: hurufBlangko.huruf,
    hurufTidakDiusulkan: hurufBlangko.tidakDiusulkan,
    // Perbaikan 1 Okt 2026 butir 9 (panel ABT UI Baru, ⓘ "kenapa diambil"):
    // INTI keterangan tiap saksi per ciri - kalimat pemicu yang sama dengan
    // yang menyalakan ciri itu (kalimatPemicu), dan kalimat posita yang
    // mendalilkannya. Ruas tambahan; ekstensi lama mengabaikannya.
    intiCiri: [...new Set([...ciriSaksi1, ...ciriSaksi2, ...(ciriPosita || [])])].map((nama) => ({
      ciri: nama,
      saksi1: kalimatPemicu(b1, nama, daftarCiri.daftar),
      saksi2: kalimatPemicu(b2, nama, daftarCiri.daftar),
      posita: ciriPosita ? kalimatPemicu(butirPosita, nama, daftarCiri.daftar) : "",
    })),
    hurufBelumSiap: aturanAlasan.belumSiap(),
    usulan: [
      usulan(
        "0222",
        "Awal Konflik",
        awal,
        sumberAwal
      ),
      usulan(
        "5227",
        "Alasan-Alasan Cerai",
        hasil5227,
        // ====================================================================
        // SUMBERNYA BERPASANGAN - SATU DARI TIAP SAKSI, PER ALASAN
        // ====================================================================
        //
        // Bentuk lamanya mengambil empat kalimat pertama dari gabungan
        // [...b1, ...b2] lalu memberi label dengan b1.includes(kalimat).
        // Dua hal salah sekaligus:
        //
        //   1. b1 selalu di depan, dan biasanya sudah menyumbang empat
        //      kalimat sendiri - sehingga slice(0, 4) tidak pernah sampai ke
        //      b2. Di layar yang tampak hanya "Saksi 1", berulang-ulang.
        //   2. b1.includes(kalimat) menandai kalimat yang bunyinya sama
        //      persis sebagai milik saksi 1, walau ia dari saksi 2.
        //
        // Yang dibutuhkan justru perbandingannya: 5227 kini disusun dari
        // alasan yang disebut KEDUA saksi, dan yang membaca harus dapat
        // melihat kalimat masing-masing berdampingan untuk menilai apakah
        // keduanya memang menerangkan hal yang sama.
        //
        // Karena itu sumbernya disusun PER ALASAN, berpasangan: kalimat
        // saksi 1 lalu kalimat saksi 2 untuk alasan yang sama, berurutan.
        sumber5227
      ),
      usulan("0246", "Pisah Rumah", pisah, sumberPisah),
      // Sumbernya kalimat yang MENYEBUT lamanya bila ada; bila tidak, kalimat
      // pisah rumah yang menjadi titik awal hitungan.
      usulan("9944", "Lama Pisah", lama, sumberLama),
      usulan(
        "7035",
        "Meninggalkan Kediaman Bersama",
        pergi,
        [...sumberDari(siapa1.kalimat, 1), ...sumberDari(siapa2.kalimat, 2)]
      ),
      usulan(
        "1268",
        "Upaya Damai Keluarga",
        upaya,
        sumberDamai
      ),
    ],
  };
  if (ciriPelakuLawan.length) {
    hasil.ciriPelakuLawan = ciriPelakuLawan;
    const u5227 = hasil.usulan.find((u) => u.kode === "5227");
    const daftarLawan = ciriPelakuLawan
      .map((x) => `${x.ciri} (${x.asal}${x.sebab === "tuduhan" ? `, tuduhan terhadap ${sebutanPenggugat}` : `, dilakukan ${sebutanPenggugat}`})`)
      .join(", ");
    u5227.catatan = [u5227.catatan, `Bukan perbuatan ${sebutanTergugat} menurut kalimatnya - tidak dimasukkan: ${daftarLawan}.`]
      .filter(Boolean)
      .join(" ");
  }
  tandaiS5(hasil.usulan, {
    "0222": { gab: awal, posita: awalPosita },
    "0246": { gab: pisah, posita: pisahPosita.nilai },
    "9944": { gab: lama, posita: butirPosita.length ? lamaPisahPosita(butirPosita).nilai || "" : "", ucap: [ucap1, ucap2] },
    "5227": { gab: hasil5227, gugatanTerbaca: Boolean(ciriPosita) },
  });
  if (tipeKeluaranDitolak.length) hasil.tipeKeluaranDitolak = tipeKeluaranDitolak;
  /* === P1-P3-S6 10 Okt === */
  // P1 sebab & huruf dari pola kamus, P3 subjek perbuatan per kalimat, S6 kesesuaian
  // kedua saksi per huruf & per fakta, P2 petunjuk waktu yang tidak dapat mengisi
  // variabel. Semuanya ruas TAMBAHAN - usulan lama tidak berubah (diukur: 2.277 perkara
  // nyata, keluaran lama identik). Galat di sini tidak boleh mematahkan usulan lama.
  try {
    const det = deteksiAlasan.deteksiPerkara({
      b1,
      b2,
      butirPosita,
      pihak,
      lamaPisahBulan: totalBulan(lama.nilai),
      lamaSaksi1: totalBulan(ucap1.nilai),
      lamaSaksi2: totalBulan(ucap2.nilai),
    });
    hasil.deteksiAlasan = det;
    hasil.kesesuaian = {
      huruf: det.huruf
        .filter((h) => h.usul || h.kesesuaian.status !== "tidak ada")
        .map((h) => ({ huruf: h.huruf, usul: h.usul, didalilkan: h.didalilkan, ...h.kesesuaian })),
      fakta: [
        deteksiAlasan.kesesuaianFakta("0222", "Awal Konflik", ambilBulanTahun(konflik1, { tanggal: true }).nilai, ambilBulanTahun(konflik2, { tanggal: true }).nilai),
        deteksiAlasan.kesesuaianFakta("0246", "Pisah Rumah", ambilBulanTahun(pisah1, { tanggal: true }).nilai, ambilBulanTahun(pisah2, { tanggal: true }).nilai),
        deteksiAlasan.kesesuaianFakta("9944", "Lama Pisah", ucap1.nilai, ucap2.nilai),
        deteksiAlasan.kesesuaianFakta("7035", "Meninggalkan Kediaman Bersama", siapa1.nilai, siapa2.nilai),
        deteksiAlasan.kesesuaianFakta("1268", "Upaya Damai Keluarga", damai1.keadaan, damai2.keadaan),
      ],
      pelakuBerbeda: det.pelakuBerbeda,
    };
    // Kartu huruf (ekstensi abt.js) membaca h.kesesuaian di samping kesimpulannya.
    for (const h of hasil.huruf) {
      const d = det.huruf.find((x) => x.huruf === h.huruf);
      if (d) h.kesesuaian = d.kesesuaian;
    }
    // u.kodePola (keputusan orkestrator 10 Okt): kode pola kamus yang paling menentukan
    // tiap usulan, untuk jejak koreksi & calon tinjauan pola. Hanya bila usulan itu
    // memang lahir dari kalimat saksi yang dibaca pola kamus (posita/hitungan tidak).
    const pasangKode = (kode, kodePola) => {
      const u = hasil.usulan.find((x) => x.kode === kode);
      if (u && u.nilai && kodePola) u.kodePola = kodePola;
    };
    const kalimatSaksi = (kode) => {
      const u = hasil.usulan.find((x) => x.kode === kode);
      const s = u && Array.isArray(u.sumber) ? u.sumber.find((x) => x && !x.asal && x.kalimat) : null;
      return s ? s.kalimat : "";
    };
    pasangKode("0222", deteksiAlasan.kodePolaKunci("waktu", "konflik", kalimatSaksi("0222")));
    const k0246 = kalimatSaksi("0246");
    const kodePisah = ["pisah-kata", "pisah-rumah", "puncak"].map((k) => deteksiAlasan.kodePolaKunci("waktu", k, k0246)).find(Boolean) || "";
    pasangKode("0246", kodePisah);
    pasangKode("9944", lama.dihitung ? (lama.dariPosita ? "" : kodePisah) : deteksiAlasan.kodePolaKunci("waktu", "pisah-lama", ucap1.kalimat || ucap2.kalimat));
    pasangKode("7035", deteksiAlasan.kodePolaKunci("pelaku", "pergi-subjek", String(siapa1.kalimat || siapa2.kalimat || "").toLowerCase()));
    if (ciri.length) pasangKode("5227", deteksiAlasan.kodePolaSebab(ciri[0], kalimatPemicu(b1, ciri[0], daftarCiri.daftar) || kalimatPemicu(b2, ciri[0], daftarCiri.daftar)));
    const u9944 = hasil.usulan.find((x) => x.kode === "9944");
    for (const h of hasil.huruf) {
      const p = String((h.pemicu || [])[0] || "");
      const s = det.sebab.find((x) => x.sebab === p);
      const kodePola = /^lama pisah/.test(p) ? (u9944 && u9944.kodePola) || "" : s && s.pola.length ? s.pola[0] : "";
      if (kodePola) h.kodePola = kodePola;
    }
    // G1 30 Okt: golongan huruf alasan (pasti F saja / usulan / kosong) untuk isi otomatis panel Blangko Derry. Ruas tambahan.
    try {
      hasil.hurufAlasan = require("./hurufAlasanOtomatis").golonganHurufAlasan({ deteksi: det.huruf, lama9944: u9944, pisah0246: hasil.usulan.find((x) => x.kode === "0246"), butirPosita, tanggalAcuan: tanggalSidang });
    } catch {
      /* golongan huruf tidak tersedia: usulan lain tetap */
    }
    // P2: kartu 0222/0246 yang kosong - saksi menyebut waktunya tetapi tanpa tahun.
    const wkt = deteksiAlasan.penguji("waktu");
    /* === KDL2 11 Okt === */
    // Tanggal nikah posita - dasar perkiraan "N bulan setelah menikah".
    const opsiWaktu = { tanggalNikah: deteksiAlasan.tanggalNikahDari(butirPosita) };
    /* === AKHIR KDL2 === */
    // Ruas petunjukWaktu selalu dikirim bila ada; catatan kartu hanya bila kartunya kosong.
    for (const [kode, gab] of [["0222", awal], ["0246", pisah]]) {
      const u = hasil.usulan.find((x) => x.kode === kode);
      const petunjuk = [
        [1, deteksiAlasan.petunjukWaktu(b1, kode, wkt, tanggalSidang, opsiWaktu)],
        [2, deteksiAlasan.petunjukWaktu(b2, kode, wkt, tanggalSidang, opsiWaktu)],
      ]
        .filter(([, p]) => p)
        .map(([saksi, p]) => ({ saksi, ...p }));
      if (!u || !petunjuk.length) continue;
      u.petunjukWaktu = petunjuk;
      if (gab.nilai) continue;
      u.kodePola = petunjuk[0].kode;
      /* === KDL2 11 Okt === */
      const dasarPerkiraan = (x) =>
        /setelah-menikah/.test(x.kode) ? "dihitung dari tanggal nikah di posita" : /sejak-lalu/.test(x.kode) ? "dihitung mundur dari tanggal sidang" : "dihitung dari lama yang disebut dan tanggal sidang";
      const bunyi = petunjuk.map((x) => `saksi ${x.saksi} "${x.teks}"${x.perkiraan ? ` (perkiraan ${x.perkiraan}, ${dasarPerkiraan(x)})` : ""}`);
      /* === AKHIR KDL2 === */
      u.catatan = [u.catatan, `Petunjuk saksi: ${bunyi.join(", ")} - tahunnya tidak disebut; isi sendiri dari BAS/posita.`]
        .filter(Boolean)
        .join(" ");
    }
  } catch (galat) {
    hasil.deteksiAlasanGalat = String((galat && galat.message) || galat);
  }
  /* === AKHIR P1-P3-S6 === */
  /* === R2 14 Okt === */
  if (sebab5227) {
    hasil.sebab5227 = sebab5227.butir;
    const u = hasil.usulan.find((x) => x.kode === "5227");
    if (u && u.nilai && sebab5227.kodePola) u.kodePola = sebab5227.kodePola;
  }
  /* === AKHIR R2 === */
  /* === RINCIAN 5227 27 Okt === */
  // Gugatan = acuan utama, saksi menguatkan, jawab-menjawab minor (deteksi/alasanRincian.js). Hanya
  // bila pemanggil meminta (opsi.rincianAlasan === true); galat di sini tidak mematahkan usulan lain.
  if (opsi && opsi.rincianAlasan === true) {
    try {
      const rinci = require("./deteksi/alasanRincian");
      const sisi = opsi.saksiPihak && typeof opsi.saksiPihak === "object" ? opsi.saksiPihak : {};
      const rincian = rinci.deteksiRincian({
        // 28 Okt: posita ABT kosong -> posita SIPP (opsi.positaRincian, dibaca rute) agar saksi tetap dicocokkan per alasan.
        gugatan: butirPosita.length ? butirPosita : butirKeterangan(String(opsi.positaRincian || "")),
        saksi: [
          { no: 1, pihak: sisi.saksi1 || "", butir: b1 },
          { no: 2, pihak: sisi.saksi2 || "", butir: b2 },
        ],
        jawab: (Array.isArray(opsi.jawab) ? opsi.jawab : []).slice(0, 6).map((j) => ({ jenis: String((j && j.jenis) || "jawaban").slice(0, 20), butir: butirKeterangan(String((j && j.teks) || "").slice(0, 60000)) })),
        pihak,
      });
      rinci.terapkan(hasil, rincian);
    } catch (galat) {
      hasil.rincianAlasanGalat = String((galat && galat.message) || galat);
    }
  }
  /* === AKHIR RINCIAN 5227 === */
  /* === PENDAMAI 1268 27 Okt === */
  // Siapa yang mendamaikan: terbaca -> disebut di kartu; tidak terbaca -> empat pilihan manual (keluarga / aparat /
  // keduanya / lainnya) di samping kalimat bawaan. Kartu yang tidak berupa upaya (kosong / belum ada) tidak disentuh.
  try {
    const u1268 = hasil.usulan.find((x) => x && x.kode === "1268");
    const keadaanDamai = [damai1.keadaan, damai2.keadaan].find((k) => k === "gagal" || k === "berhasil") || (u1268 && u1268.nilai ? "gagal" : "");
    if (u1268 && u1268.nilai && keadaanDamai && !(damai1.keadaan === "belum-ada" || damai2.keadaan === "belum-ada")) {
      if (perukunSaksi.kategori) {
        u1268.perukun = { kategori: perukunSaksi.kategori, rincian: perukunSaksi.teks };
      } else {
        u1268.perukun = { kategori: "", rincian: [] };
        u1268.pilihan = upayaDamaiPerukun.PILIHAN_BAKU.map((p) => ({
          keadaan: p.keadaan,
          nilai: kalimatBaku.kalimatUpayaDamai(keadaanDamai, pihak, opsi, p.kategori === "keluarga" ? "" : p.frasa),
        })).filter((p) => p.nilai);
        u1268.catatan = [u1268.catatan, "Pihak yang mendamaikan tidak disebut; bunyi bawaan memakai pihak keluarga - pilih bunyi lain bila yang mendamaikan aparat, keduanya, atau pihak lain."].filter(Boolean).join(" ");
      }
    }
  } catch (galat) {
    hasil.pendamaiGalat = String((galat && galat.message) || galat);
  }
  /* === AKHIR PENDAMAI 1268 === */
  return hasil;
}

/**
 * Lima variabel yang sumbernya SIPP, bukan saksi.
 *
 * Dua yang ada dijawab dengan nilainya; tiga yang tidak ada dijawab dengan
 * sebabnya. Membiarkan yang tidak ada tampak seperti "belum diisi" membuat
 * petugas menunggu jawaban yang tidak akan pernah datang.
 */
async function dariSipp(nomorPerkara) {
  const nomor = String(nomorPerkara || "").trim();
  if (!nomor) return { ok: false, alasan: "nomor_kosong", usulan: [] };

  // ==========================================================================
  // JENIS PERKARA DAN STATUS PUTUSAN IKUT DIBACA - UNTUK NAMA BERKAS
  // ==========================================================================
  //
  // Nama berkas unduhan ABT berbentuk "nomor perkara - jenis perkara - status
  // putusan". Pada papan massal ketiganya sudah datang bersama daftar sidang;
  // pada halaman satu perkara TIDAK ADA satu pun permintaan yang
  // memulangkannya, sehingga namanya tinggal nomor perkara - atau, ketika
  // konteksnya belum sempat pulih, nama bawaan peramban.
  //
  // Ditumpangkan pada kueri yang memang sudah berjalan di sini, bukan pada
  // permintaan baru: panel ABT punya anggaran waktu yang ketat, dan satu
  // perjalanan tambahan tiap membuka halaman adalah harga yang tidak perlu
  // dibayar hanya untuk menamai berkas.
  const baris = await runQuery(
    `SELECT p.perkara_id, p.prodeo,
            p.jenis_perkara_text AS jenisPerkara,
            pp.status_putusan_text AS statusPutusan,
            pp.putusan_verstek AS verstek,
            DATE_FORMAT(p.tanggal_pendaftaran, '%Y-%m-%d') AS tanggalDaftar
       FROM perkara p
       LEFT JOIN perkara_putusan pp ON pp.perkara_id = p.perkara_id
      WHERE p.nomor_perkara = ? LIMIT 1`,
    [nomor]
  );
  if (!Array.isArray(baris) || !baris[0]) {
    return { ok: false, alasan: "perkara_tidak_ditemukan", usulan: [] };
  }
  const perkaraId = baris[0].perkara_id;
  const prodeo = Number(baris[0].prodeo) === 1;
  const keteranganPerkara = {
    jenisPerkara: String(baris[0].jenisPerkara || "").trim(),
    statusPutusan: String(baris[0].statusPutusan || "").trim(),
    verstek: String(baris[0].verstek || "") === "Y",
  };

  // Kuasa hukum dari SIPP - lihat usulanKuasaSipp (9 Okt 2026, butir 1-4 KUASA).
  // pihak_pengacara.alamat_kantor ikut dibaca sebagai cadangan alamat/nama
  // kantor; SIPP yang tidak punya tabelnya tetap dijawab tanpa kolom itu.
  let kuasa;
  try {
    kuasa = await runQuery(
      `SELECT pp.pihak_ke, pp.urutan, pp.nama, pp.alamat, pk.alamat_kantor, pp.nomor_kuasa,
              DATE_FORMAT(pp.tanggal_kuasa, '%Y-%m-%d') AS tanggal_kuasa
         FROM perkara_pengacara pp
         LEFT JOIN pihak_pengacara pk ON pk.pihak_id = pp.pengacara_id
        WHERE pp.perkara_id = ? AND pp.aktif = 'Y'
        ORDER BY pp.urutan, pp.id`,
      [perkaraId]
    );
  } catch {
    kuasa = await runQuery(
      `SELECT pihak_ke, urutan, nama, alamat, '' AS alamat_kantor, nomor_kuasa,
              DATE_FORMAT(tanggal_kuasa, '%Y-%m-%d') AS tanggal_kuasa
         FROM perkara_pengacara
        WHERE perkara_id = ? AND aktif = 'Y'
        ORDER BY urutan, id`,
      [perkaraId]
    );
  }
  const k = usulanKuasaSipp(Array.isArray(kuasa) ? kuasa : [], { tanggalDaftar: baris[0].tanggalDaftar });

  // Butir 9 (1.189.x): alamat + surel para pihak untuk "Alamat Putusan"
  // (8548/8549). Hanya DIBACA - alamat di SIPP tidak diubah (juru sita
  // memakainya untuk PBT). Perapiannya di portal (rapikanAlamat PTSP).
  const alamatPihak = await bacaAlamatPihak(perkaraId, nomor).catch(() => []);

  /* === PEKERJAAN 11 Okt === */
  // Kategori pekerjaan pihak (PNS/TNI/POLRI/BUMN/BUMD/desa) dari teks SIPP - kartu info panel ABT.
  // Aturan yang sama dipakai kueri ABT 8510/8524/8533 (paket abt-pekerjaan-dinamis).
  const pekerjaanPihak = await require("./pekerjaanPihakService")
    .bacaPekerjaanPihak(perkaraId, runQuery)
    .catch(() => []);
  /* === AKHIR PEKERJAAN === */

  const hasil = [
    ...k.usulan,
    {
      kode: "0661",
      nama: "No. SK Prodeo",
      nilai: "",
      keyakinan: "tidak_ada_sumber",
      bentrok: "",
      sumber: [],
      catatan: prodeo
        ? "Perkara ini PRODEO menurut SIPP, tetapi nomor SK-nya tidak disimpan SIPP di mana pun. Harus diisi tangan dari penetapannya."
        : "Perkara ini bukan prodeo menurut SIPP.",
    },
    {
      kode: "0663",
      nama: "Tgl. Pertimbangan/Penetapan Prodeo",
      nilai: "",
      keyakinan: "tidak_ada_sumber",
      bentrok: "",
      sumber: [],
      catatan: prodeo
        ? "Perkara ini PRODEO, tetapi tanggal penetapannya tidak disimpan SIPP. Harus diisi tangan."
        : "Perkara ini bukan prodeo menurut SIPP.",
    },
    {
      kode: "0227",
      nama: "Tanggal Fasakh / Murtad / Meninggalkan Agama",
      nilai: "",
      keyakinan: "tidak_ada_sumber",
      bentrok: "",
      sumber: [],
      catatan: "SIPP tidak punya kolom untuk tanggal ini. Hanya dapat diisi tangan.",
    },
  ];

  // 19 Okt (isian 2): Tgl Nikah (5197) dari data pernikahan perkara atau kalimat pernikahan pada posita.
  try {
    for (const u of await usulanTanggalNikahSipp(perkaraId)) if (!hasil.some((x) => x.kode === u.kode)) hasil.push(u);
  } catch {
    /* tanggal nikah bersifat tambahan: gagal membaca tidak menggagalkan usulan SIPP lain */
  }

  // Z1 18 Okt: isian popup yang datanya ada di SIPP (kesepakatan perdamaian, alasan cabut karena mediasi, batas ikrar,
  // pengumuman itsbat, kuasa Tergugat) - lihat abtIsianSippLanjutan.js dan docs/isi-sipp-abt/DAFTAR-CEK.md.
  try {
    const lanjutan = await require("./abtIsianSippLanjutan").usulanLanjutanSipp(perkaraId, runQuery);
    for (const u of lanjutan) if (!hasil.some((x) => x.kode === u.kode)) hasil.push(u);
  } catch {
    /* usulan lanjutan bersifat tambahan: gagal membaca tidak menggagalkan usulan SIPP lain */
  }

  /* === U2 20 Okt === */
  // Keadaan anak (mumayyiz atau belum) dan yang kini mengasuh anak dari tab Anak SIPP untuk putusan cerai - lihat abtIsianPutusanCerai20okt.js.
  // Dipasang SEBELUM blok S3 supaya data terstruktur tab Anak mengalahkan tebakan dari posita. Hanya SELECT.
  try {
    const cerai = await require("./abtIsianPutusanCerai20okt").usulanPutusanCerai(perkaraId, runQuery);
    for (const u of cerai) if (!hasil.some((x) => x.kode === u.kode)) hasil.push(u);
  } catch {
    /* pengisi tambahan: gagal membaca tidak menggagalkan usulan SIPP lain */
  }
  /* === AKHIR U2 === */
  /* === S3 20 Okt === */
  // Isian popup cerai/ikrar/itsbat yang datanya ada di SIPP (delegasi, penetapan kembali ikrar, anak, umur dari tanggal lahir) atau di
  // posita+petitum SIPP (nafkah, hak asuh, 7035, 8503, 9686) - lihat abtIsianLengkap20okt.js. Hanya SELECT.
  try {
    const lengkap = await require("./abtIsianLengkap20okt").usulanLengkap(perkaraId, runQuery);
    for (const u of lengkap) if (!hasil.some((x) => x.kode === u.kode)) hasil.push(u);
  } catch {
    /* pengisi tambahan: gagal membaca tidak menggagalkan usulan SIPP lain */
  }
  /* === AKHIR S3 === */
  // S5 20 Okt: isian "Perlu diisi" jenis dispensasi kawin, perwalian, asal usul anak, wali adhal, penetapan ahli waris
  // (data calon mempelai/anak/pihak SIPP + posita/petitum) - lihat isiOtomatisJenisS5.js. Usulan yang lebih yakin menggantikan.
  try {
    const PANGKAT_S5 = { pasti: 3, cukup: 2, ragu: 1 };
    for (const u of await require("./isiOtomatisJenisS5").usulanJenisS5(perkaraId, runQuery)) {
      const i = hasil.findIndex((x) => x.kode === u.kode);
      if (i < 0) hasil.push(u);
      else if ((PANGKAT_S5[u.keyakinan] || 0) > (PANGKAT_S5[hasil[i].keyakinan] || 0) && hasil[i].keyakinan !== "tidak_ada_sumber") hasil[i] = u;
    }
  } catch {
    /* pengisi jenis bersifat tambahan: gagal membaca tidak menggagalkan usulan SIPP lain */
  }

  // S6 20 Okt: isian otomatis jenis harta bersama, kewarisan, wasiat, hibah, wakaf, poligami, pencegahan/pembatalan,
  // hak asuh/nafkah anak, Lain-Lain, ekonomi syariah - lihat isiOtomatisJenisS6.js (jenis lain dijawab [] tanpa pembacaan tambahan).
  try {
    const s6 = await require("./isiOtomatisJenisS6").usulanJenisS6(perkaraId, runQuery);
    for (const u of s6) if (!hasil.some((x) => x.kode === u.kode)) hasil.push(u);
  } catch {
    /* usulan jenis bersifat tambahan: gagal membaca tidak menggagalkan usulan SIPP lain */
  }

  // W2a 21 Okt: isian tambahan harta bersama (utang bersama) dan kewarisan (ahli waris terstruktur, bagian KHI, penguasa, harta bersama
  // pewaris, utang/wasiat) - semua "ragu" (saran), lihat isiOtomatisW2a.js. Tidak menimpa usulan yang sudah ada.
  try {
    const w2a = await require("./isiOtomatisW2a").usulanW2a(perkaraId, runQuery);
    for (const u of w2a) if (!hasil.some((x) => x.kode === u.kode)) hasil.push(u);
  } catch {
    /* usulan jenis bersifat tambahan: gagal membaca tidak menggagalkan usulan SIPP lain */
  }

  return {
    ok: true,
    perkaraId,
    prodeo,
    jumlahKuasa: k.kuasaSipp.length,
    // Baris kuasa SIPP apa adanya - dibaca rute portal /aleta-ecourt/kuasa-gugatan
    // sebagai cadangan nama/alamat kantor dan daftar advokat (#8537#).
    kuasaSipp: k.kuasaSipp,
    tanggalDaftar: String(baris[0].tanggalDaftar || ""),
    // Dipakai panel untuk menamai berkas - lihat namaBerkas di abt.js.
    keteranganPerkara,
    // Butir 9: dibaca rute portal abt/usulan -> usulan 8548/8549.
    alamatPihak,
    /* === PEKERJAAN 11 Okt === */
    pekerjaanPihak,
    /* === AKHIR PEKERJAAN === */
    usulan: hasil,
  };
}

/** Huruf saja, huruf kecil - pembanding nama SIPP vs e-Court. Murni. */
function bakuNamaPihak(nama) {
  return String(nama || "")
    .toLowerCase()
    .replace(/\b(bin|binti)\b.*$/, "")
    .replace(/[^a-z]+/g, " ")
    .trim();
}

/**
 * Surel e-Court untuk tiap pihak SIPP (butir 9). Murni.
 *   1. nama sama (tanpa "bin/binti ...") -> surelnya;
 *   2. bila tidak: satu-satunya pihak e-Court di sisi itu (Penggugat/Pemohon =
 *      1, Tergugat/Termohon = 2) yang bersurel.
 * Kuasa/advokat tidak pernah dipakai - surelnya bukan domisili pihak.
 */
function padankanSurelEcourt(pihakSipp, pihakEcourt) {
  const ec = (Array.isArray(pihakEcourt) ? pihakEcourt : []).filter(
    (p) => p && /@/.test(String(p.email || "")) && !/kuasa|advokat|pengacara/i.test(String(p.peran || ""))
  );
  const sisiDari = (peran) =>
    /penggugat|pemohon|pelawan|pembanding/i.test(String(peran || "")) ? 1 : /tergugat|termohon|terlawan|terbanding/i.test(String(peran || "")) ? 2 : 0;
  return (Array.isArray(pihakSipp) ? pihakSipp : []).map((p) => {
    const n = bakuNamaPihak(p.nama);
    let cocok = n ? ec.find((e) => bakuNamaPihak(e.nama) === n) : null;
    if (!cocok) {
      const sisi = ec.filter((e) => sisiDari(e.peran) === Number(p.pihakKe));
      if (sisi.length === 1 && Number(p.urutan) === 1) cocok = sisi[0];
    }
    return { ...p, emailEcourt: cocok ? String(cocok.email).trim() : "" };
  });
}

/** Alamat + surel SIPP para pihak, ditambah surel e-Court yang tersimpan di ALETA. */
async function bacaAlamatPihak(perkaraId, nomorPerkara) {
  const baris = await runQuery(
    `SELECT 1 AS pihak_ke, pp.urutan, pp.nama, pp.alamat, COALESCE(p.email, '') AS email
       FROM perkara_pihak1 pp LEFT JOIN pihak p ON p.id = pp.pihak_id
      WHERE pp.perkara_id = ?
     UNION ALL
     SELECT 2 AS pihak_ke, pp.urutan, pp.nama, pp.alamat, COALESCE(p.email, '') AS email
       FROM perkara_pihak2 pp LEFT JOIN pihak p ON p.id = pp.pihak_id
      WHERE pp.perkara_id = ?`,
    [perkaraId, perkaraId]
  );
  const sipp = (Array.isArray(baris) ? baris : []).map((b) => ({
    pihakKe: Number(b.pihak_ke) || 0,
    urutan: Number(b.urutan) || 1,
    nama: String(b.nama || "").trim(),
    alamat: String(b.alamat || "").trim(),
    emailSipp: String(b.email || "").trim(),
  }));
  let ecourt = [];
  try {
    const { normalizeCaseNumber } = require("./ecourtTextService");
    ecourt = await require("./botDbService").query(
      "SELECT nama, peran, email FROM aleta_bot_ecourt_pihak WHERE nomor_perkara = ?",
      [normalizeCaseNumber(nomorPerkara)]
    );
  } catch {
    ecourt = []; // tanpa data e-Court: surel SIPP saja
  }
  return padankanSurelEcourt(sipp, ecourt);
}

/**
 * ============================================================================
 * KUASA HUKUM DARI SIPP: TANGGAL & NOMOR REGISTER KUASA KHUSUS (9 Okt 2026)
 * ============================================================================
 *
 * Pengguna: "#0132# Tgl. Kuasa Penggugat itu bukan tanggal surat kuasa tetapi
 * tanggal register kuasa khusus di pengadilan agama".
 *
 * SIPP menyimpan register kuasa khusus di perkara_pengacara.nomor_kuasa dan
 * .tanggal_kuasa (borang SIPP menamainya "Nomor/Tanggal Surat Kuasa", tetapi
 * register Surat Kuasa APS Badilag membaca nomor_kuasa sebagai nomor register).
 * Diukur di satker 9 Okt 2026, 180 baris aktif 2024-2026 berpola
 * "<urut>/SK/<bulan romawi>/<tahun>" - nomor URUT KEPANITERAAN, berurutan lintas
 * advokat - dan pada 160 di antaranya (89%) bulan tanggal_kuasa sama dengan
 * bulan romawi nomornya: itu tanggal register. Sisanya (20 baris) petugas
 * mengetik tanggal SURAT KUASA ke kolom itu: tanggalnya SEBELUM tanggal
 * pendaftaran perkara dan bulannya berbeda dari nomor register.
 *
 * Maka:
 *   - bulannya = bulan romawi nomor register                -> "pasti" (termasuk
 *     kuasa e-Court yang didaftarkan sebelum perkaranya teregister)
 *   - bulan berbeda / nomor tak berpola, atau tanggal
 *     sebelum pendaftaran                                   -> "ragu" (tidak dicentang)
 *   - bulan berbeda DAN sebelum pendaftaran                 -> TIDAK diusulkan,
 *     catatan menyebut tanggal itu kemungkinan tanggal surat kuasa.
 *
 * Kuasa Penggugat = pihak_ke 1 (sampai 1.188.0 baris kuasa Tergugat pun dapat
 * terbaca sebagai "kuasa pertama"). #0156# (nama kantor) TIDAK lagi diisi
 * alamat advokat - nama kantornya dibaca dari surat gugatan e-Court oleh portal.
 */
const BULAN_ROMAWI = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12 };

function bersihkanKuasa(x) {
  return String(x == null ? "" : x).replace(/\s+/g, " ").trim();
}

function bulanNomorRegister(nomor) {
  const m = /^\s*\d+\s*\/\s*S\.?\s*K\.?\s*\/\s*([IVXivx]+)\s*\/\s*(\d{4})\b/.exec(String(nomor || ""));
  if (!m) return null;
  const bulan = BULAN_ROMAWI[m[1].toUpperCase()];
  return bulan ? { bulan, tahun: Number(m[2]) } : null;
}

function isoKeTampil(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  return m && m[1] !== "0000" ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/**
 * @param rows baris perkara_pengacara aktif (pihak_ke, urutan, nama, alamat,
 *        alamat_kantor, nomor_kuasa, tanggal_kuasa "YYYY-MM-DD")
 * @param opsi {tanggalDaftar: "YYYY-MM-DD"}
 */
function usulanKuasaSipp(rows, opsi) {
  const tanggalDaftar = String((opsi && opsi.tanggalDaftar) || "");
  const kuasaSipp = (Array.isArray(rows) ? rows : []).map((r) => ({
    pihakKe: Number(r.pihak_ke) || 0,
    urutan: Number(r.urutan) || 0,
    nama: bersihkanKuasa(r.nama),
    alamat: bersihkanKuasa(r.alamat),
    alamatKantor: bersihkanKuasa(r.alamat_kantor),
    nomorKuasa: bersihkanKuasa(r.nomor_kuasa),
    tanggalKuasa: /^\d{4}-\d{2}-\d{2}$/.test(String(r.tanggal_kuasa || "")) && !String(r.tanggal_kuasa).startsWith("0000")
      ? String(r.tanggal_kuasa)
      : "",
  }));
  const p = kuasaSipp.filter((x) => x.pihakKe === 1);
  const sumber = p.map((x) => ({
    saksi: 0,
    kalimat: `${x.nama}${x.nomorKuasa ? ` - register ${x.nomorKuasa}` : ""}${x.tanggalKuasa ? ` tanggal ${isoKeTampil(x.tanggalKuasa)}` : ""}`,
  }));
  const tanpa = "Penggugat/Pemohon tidak punya kuasa hukum aktif di SIPP.";

  // Nomor register: baris pertama yang bernomor.
  const bernomor = p.find((x) => x.nomorKuasa) || null;
  const nomor = {
    kode: "8539",
    nama: "No. Register Kuasa Khusus Penggugat",
    nilai: bernomor ? bernomor.nomorKuasa : "",
    keyakinan: bernomor ? (bulanNomorRegister(bernomor.nomorKuasa) ? "pasti" : "ragu") : "kosong",
    bentrok: "",
    sumber,
    catatan: !p.length
      ? tanpa
      : !bernomor
      ? "Nomor register kuasa khusus belum dicatat di SIPP (Data Pihak > Kuasa)."
      : bulanNomorRegister(bernomor.nomorKuasa)
      ? ""
      : `Nomor "${bernomor.nomorKuasa}" tidak berbentuk nomor register kepaniteraan (urut/SK/bulan romawi/tahun) - periksa.`,
  };

  // Tanggal register: dari baris yang sama dengan nomornya bila ada.
  const dasar = (bernomor && bernomor.tanggalKuasa ? bernomor : null) || p.find((x) => x.tanggalKuasa) || null;
  let tgl = { nilai: "", keyakinan: p.length ? "kosong" : "kosong", catatan: p.length ? "Tanggal register kuasa khusus belum dicatat di SIPP." : tanpa };
  if (dasar) {
    const reg = bulanNomorRegister(dasar.nomorKuasa);
    const bulanCocok = reg ? reg.bulan === Number(dasar.tanggalKuasa.slice(5, 7)) && reg.tahun === Number(dasar.tanggalKuasa.slice(0, 4)) : null;
    const sesudahDaftar = tanggalDaftar ? dasar.tanggalKuasa >= tanggalDaftar : null;
    const tampil = isoKeTampil(dasar.tanggalKuasa);
    if (bulanCocok === true) {
      // Bulan = bulan romawi nomor register: tanggal register, termasuk kuasa
      // e-Court yang didaftarkan sebelum perkaranya teregister (531/2026).
      tgl = { nilai: tampil, keyakinan: "pasti", catatan: "" };
    } else if (bulanCocok === false && sesudahDaftar === false) {
      tgl = {
        nilai: "",
        keyakinan: "ragu",
        catatan: `SIPP mencatat ${tampil} - sebelum tanggal pendaftaran dan bulannya berbeda dari register ${dasar.nomorKuasa}; itu kemungkinan tanggal SURAT KUASA, bukan tanggal register. Isi dari buku register kuasa khusus.`,
      };
    } else if (bulanCocok === false || sesudahDaftar === false) {
      tgl = {
        nilai: tampil,
        keyakinan: "ragu",
        catatan:
          sesudahDaftar === false
            ? `Tanggal ${tampil} sebelum tanggal pendaftaran perkara - pastikan ini tanggal register, bukan tanggal surat kuasa.`
            : `Bulan tanggal ${tampil} berbeda dari bulan nomor register ${dasar.nomorKuasa} - periksa.`,
      };
    } else {
      // Nomor tanpa bulan romawi, tanggal sesudah pendaftaran.
      tgl = { nilai: tampil, keyakinan: "ragu", catatan: "Nomor register tidak berpola urut/SK/bulan/tahun - pastikan tanggal ini tanggal register." };
    }
  }
  const tanggal = {
    kode: "0132",
    nama: "Tgl. Register Kuasa Khusus Penggugat",
    nilai: tgl.nilai,
    keyakinan: tgl.keyakinan,
    bentrok: "",
    sumber,
    catatan: tgl.catatan,
  };
  const kantor = {
    kode: "0156",
    nama: "Kantor Kuasa Penggugat",
    nilai: "",
    keyakinan: "kosong",
    bentrok: "",
    sumber: [],
    catatan: p.length
      ? "Nama kantor kuasa tidak disimpan SIPP - dibaca dari surat gugatan e-Court (bagian kuasa)."
      : tanpa,
  };
  return { kuasaSipp, usulan: [tanggal, kantor, nomor] };
}

/* ==========================================================================
 * ITSBAT NIKAH - DIISI DARI POSITA PERMOHONAN
 * ==========================================================================
 *
 * Blangko "Putusan_IN_kabul_wali" (Isbat) menuntut belasan fakta pernikahan
 * yang seluruhnya sudah tertulis di POSITA permohonan: tanggal dan tempat
 * menikah, wali, yang menikahkan, saksi nikah, mahar, status kedua pemohon,
 * umur mereka saat menikah, dan anak. Petugas selama ini menyalinnya satu per
 * satu dari posita ke belasan jendela sembul.
 *
 * Yang dibaca kalimat posita itu sendiri, dan tiap usulan membawa kalimat
 * asalnya. Yang TIDAK dilakukan: menebak. Fakta yang tidak ditemukan pada
 * posita dipulangkan kosong beserta sebabnya, bukan diisi nilai lazim -
 * nilai lazim pada putusan itsbat berarti wali yang salah nama.
 *
 * Variabel sasaran diambil dari blangkonya di server (berkas RTF-nya dibaca,
 * kodenya dicatat): seluruhnya bertipe data_teks, sehingga dapat disimpan
 * lewat rute edit_data ABT. Yang bertipe data_sql tidak ikut - ia dihitung
 * ABT sendiri.
 */
const VARIABEL_ITSBAT = [
  { kode: "5197", nama: "Tanggal nikah" },
  { kode: "5105", nama: "Alamat tempat menikah" },
  { kode: "5178", nama: "KUA kecamatan" },
  { kode: "1217", nama: "Nama wali nikah" },
  { kode: "1046", nama: "Status wali nikah" },
  { kode: "8087", nama: "Yang menikahkan" },
  { kode: "0650", nama: "Saksi nikah 1" },
  { kode: "0651", nama: "Saksi nikah 2" },
  { kode: "1001", nama: "Mas kawin" },
  { kode: "1002", nama: "Status Pemohon I sebelum nikah" },
  { kode: "1003", nama: "Status Pemohon II sebelum nikah" },
  { kode: "7211", nama: "Umur Pemohon I saat menikah" },
  { kode: "7212", nama: "Umur Pemohon II saat menikah" },
  { kode: "0007", nama: "Telah dikaruniai anak" },
];

/** Membuang tanda HTML dan entitasnya; posita SIPP disimpan sebagai <ol><li>. */
function polosPosita(html) {
  return String(html || "")
    .replace(/<\/(li|p|ol|ul|div|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/[ �]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

/** Kalimat-kalimat posita, dipecah pada titik koma dan baris. */
function kalimatPosita(html) {
  return polosPosita(html)
    .split(/\n|;\s+/)
    .map((k) => k.replace(/^\s*(?:\d+[.)]\s*)?(?:bahwa\s+)?/i, "").trim())
    .filter((k) => k.length > 8);
}

/**
 * Posita yang disalin dari PDF terpotong di tengah kalimat ("...kebutuhan rumah" / "tangga hanya dibantu oleh
 * Penggugat, Tergugat" / "sering mengungkit ..."). Baris berikut dirangkai ke baris sebelumnya bila jelas masih satu
 * kalimat: baris sebelumnya tidak berakhir . ; : ! ? dan (berakhir koma, atau baris ini diawali huruf kecil, atau baris
 * sebelumnya diakhiri kata sambung/depan). Penanda daftar (1. / a) / -) dan "Bahwa" selalu awal butir baru.
 */
const POLA_PENANDA_BARIS = /^(?:\(?\d{1,2}[.)]|\(?[a-z][.)]|[-–•*])\s|^\d{1,2}\s+[A-Z]|^bahwa\b/i;
const KATA_SAMBUNG_AKHIR =
  /\b(?:dan|atau|yang|serta|sehingga|karena|dengan|di|ke|dari|untuk|kepada|pada|oleh|bahwa|hingga|sampai|namun|tetapi|dalam|akibat|sebab)\s*$/i;
function barisLanjutan(sebelum, baris) {
  if (!sebelum || /[.;:!?]\s*$/.test(sebelum)) return false;
  if (POLA_PENANDA_BARIS.test(baris)) return false;
  if (/,\s*$/.test(sebelum)) return true;
  if (/^[a-z]/.test(baris)) return true;
  return KATA_SAMBUNG_AKHIR.test(sebelum);
}

/** Seperti kalimatPosita, tetapi baris yang terpotong di tengah kalimat dirangkai dahulu (khusus pembacaan penyebab). */
function kalimatPositaSambung(html) {
  const baris = [];
  for (const b of polosPosita(html).split("\n")) {
    const t = b.trim();
    if (!t) continue;
    if (baris.length && barisLanjutan(baris[baris.length - 1], t)) baris[baris.length - 1] = `${baris[baris.length - 1]} ${t}`;
    else baris.push(t);
  }
  return baris
    .join("\n")
    .split(/\n|;\s+/)
    .map((k) => k.replace(/^\s*(?:\d+[.)]\s*)?(?:bahwa\s+)?/i, "").trim())
    .filter((k) => k.length > 8);
}

/**
 * ============================================================================
 * NAMA SESUDAH PEMICU - KAPITAL MAUPUN HURUF BESAR-KECIL
 * ============================================================================
 *
 * Bentuk lamanya menuntut nama ditulis KAPITAL SELURUHNYA. Terukur: 392 dari
 * 395 posita itsbat menulis nama huruf besar-kecil ("Talub", "Ludin"),
 * sehingga yang terambil hanya huruf pertamanya - "T", "L" - dan 0 dari 352
 * nama wali, 0 dari 368 yang menikahkan, dan 0 dari 368 saksi nikah sama
 * dengan isian petugas.
 *
 * Sekarang tiap kata yang diawali huruf besar dihitung bagian nama, dan
 * namanya BERHENTI pada:
 *   - kata sambung huruf kecil: dan, dengan, yang, sebagai, selaku, ...;
 *   - tanda baca: koma, titik koma, titik dua, kurung;
 *   - kata huruf besar yang bukan nama: Ayah, Kakak, Imam, Pemohon, Desa, ...
 *     ("wali nikah yaitu Ludin Ayah Kandung Pemohon II" tanpa kurung).
 * "bin"/"binti" tetap bagian nama bila diapit nama. Singkatan bertitik
 * ("Moh.", "M.", "A.") tetap utuh; gelar sesudah koma ("Makin, S.Pd.I")
 * ikut, sebab petugas menuliskannya begitu.
 */
const KATA_BUKAN_NAMA = new Set([
  "ayah", "ibu", "kakak", "adik", "saudara", "paman", "kakek", "nenek", "sepupu", "om", "tante",
  "imam", "pemohon", "termohon", "penggugat", "tergugat", "kepala", "desa", "kelurahan", "kecamatan",
  "kabupaten", "kota", "provinsi", "masjid", "mesjid", "kua", "p3n", "pegawai", "penghulu", "wali",
  "selaku", "sebagai", "yang", "dan", "dengan", "serta", "adalah", "yaitu", "bernama",
  "pada", "di", "dari", "ke", "kandung", "almarhum", "almarhumah", "alm", "almh", "umur", "usia",
  "berstatus", "berupa", "mas", "mahar", "saksi", "nikah", "orang", "tokoh", "agama", "masyarakat",
  "ketua", "rt", "rw", "dusun", "bapak", "pak", "sdr", "saudari",
]);

/** Nama orang di AWAL teks, menurut aturan di atas; "" bila tidak ada. */
function namaDiAwal(teks) {
  // "Alm." / "(Alm)" / "Almarhum" di depan nama dibuang: isian manusia
  // menulis namanya saja ("Alm. Burhan" -> "Burhan"). Dituntut titik, kurung,
  // atau spasi sesudahnya - "Almira" tetap nama.
  const bersih = String(teks || "").replace(/^\s*(?:\(\s*alm\.?\s*\)\s*|alm(?:arhum(?:ah)?)?(?:\.\s*|\s+))/i, "");
  const hasil = [];
  const pola = /\S+/g;
  let cocok;
  while ((cocok = pola.exec(bersih)) !== null) {
    const token = cocok[0];
    if (/^[([{"“'‘]/.test(token)) break;
    const ekor = token.match(/[,;:)\]]+$/);
    const inti = ekor ? token.slice(0, -ekor[0].length) : token;
    if (!inti) break;
    const polos = inti.toLowerCase().replace(/[.'’]/g, "");
    const kataNama = /^[A-Z][A-Za-z'’.-]*$/.test(inti) && !KATA_BUKAN_NAMA.has(polos);
    const penyambung = /^(bin|binti|alias)$/i.test(inti) && hasil.length > 0;
    if (!kataNama && !penyambung) break;
    hasil.push(inti);
    if (ekor) {
      // Gelar sesudah koma: "Makin, S.Pd.I" - disalin seperti petugas.
      const sisa = bersih.slice(pola.lastIndex);
      const gelar = ekor[0].startsWith(",") && sisa.match(/^\s+([A-Z][a-z]{0,3}\.(?:[A-Za-z]{1,4}\.?)+)(?=[\s,;:)]|$)/);
      if (gelar) hasil[hasil.length - 1] += `, ${gelar[1]}`;
      break;
    }
  }
  while (hasil.length && /^(bin|binti|alias)$/i.test(hasil[hasil.length - 1])) hasil.pop();
  // Titik penutup kalimat dibuang ("Jahoni."); titik singkatan dan gelar
  // ("M.", "S.Pd.I") dibiarkan.
  const akhir = hasil[hasil.length - 1] || "";
  if (/^[^.\s]{4,}\.$/.test(akhir)) hasil[hasil.length - 1] = akhir.slice(0, -1);
  return hasil.join(" ");
}

/**
 * Nama orang sesudah suatu pemicu ("bernama", "yaitu").
 *
 * Pemicunya dicari tanpa membedakan huruf besar-kecil; namanya tidak - huruf
 * besar itulah batas nama.
 */
function namaSesudah(kalimat, pemicu) {
  const cocok = new RegExp(`${pemicu}\\s*:?\\s+`, "i").exec(String(kalimat || ""));
  if (!cocok) return "";
  return namaDiAwal(String(kalimat).slice(cocok.index + cocok[0].length));
}

/**
 * ============================================================================
 * TANGGAL NIKAH UNTUK PERKARA CERAI (19 Okt 2026, isian 2) - variabel 5197 "Tgl Nikah"
 * ============================================================================
 *
 * Isian ini kosong ("ketik di sini") padahal tanggalnya ada di tiga tempat:
 *   1. data pernikahan perkara di SIPP (perkara_data_pernikahan.tgl_nikah)        -> pasti;
 *   2. posita/gugatan: "pada tanggal 04 Juli 2011, Penggugat dan Tergugat telah melangsungkan pernikahan"  -> cukup;
 *   3. bukti P akta nikah (tanggal pada bukti) - tanggal AKTA tidak selalu tanggal nikah, jadi hanya saran (di ekstensi).
 * Bentuk tulisnya mengikuti isian ABT: dua angka hari + nama bulan + tahun ("04 Juli 2011").
 *
 * Posita dibaca ketat: kalimat harus menyebut pernikahan (melangsungkan pernikahan, menikah secara sah, akad nikah), tanggalnya
 * harus lengkap dengan hari, dan tanggal yang didahului "tertanggal"/"diterbitkan"/"dikeluarkan"/"lahir" (tanggal akta, kutipan,
 * kelahiran anak) dilewati. Kalimat riwayat ("setelah menikah ... tinggal", "dikaruniai anak") tidak dipakai.
 */
const POLA_TANGGAL_PANJANG = new RegExp(
  "\\b(\\d{1,2})\\s+(Januari|Februari|Pebruari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Nopember|Desember)\\s*,?\\s+((?:19|20)\\d{2})\\b",
  "gi"
);
const POLA_KALIMAT_NIKAH = /(melangsungkan\s+(?:akad\s+)?(?:pernikahan|perkawinan|nikah)|menikah\s+(?:secara\s+)?(?:sah|di\s)|akad\s+nikah|pernikahan\s+(?:yang\s+)?(?:sah|dilangsungkan)|perkawinan\s+(?:yang\s+)?(?:sah|dilangsungkan))/i;
const POLA_BUKAN_KALIMAT_NIKAH = /dikaruniai|setelah\s+(?:menikah|pernikahan|perkawinan)|tinggal\s+bersama|pisah\s+rumah|perselisihan|pertengkaran/i;
const POLA_DEPAN_TANGGAL_LAIN = /(?:tertanggal|diterbitkan|dikeluarkan|diterbitkan\s+pada|terbit|lahir|dilahirkan|kelahiran|tanggal\s+kutipan|kutipan\s+akta[^,;]{0,40})\W*(?:pada\s+)?(?:tanggal\s+|tgl\.?\s+)?$/i;

/** "04 Juli 2011" - hari dua angka, nama bulan baku. */
function tampilTanggalNikah(hari, namaBulan, tahun) {
  const kecil = String(namaBulan || "").toLowerCase();
  const baku = kecil === "pebruari" ? "Februari" : kecil === "nopember" ? "November" : BULAN.find((b) => b.toLowerCase() === kecil);
  if (!baku) return "";
  const h = Number(hari);
  if (!(h >= 1 && h <= 31)) return "";
  return `${String(h).padStart(2, "0")} ${baku} ${tahun}`;
}

/** "2011-07-04" (atau "2011-07-04 00:00:00") -> "04 Juli 2011"; "" bila bukan tanggal sah. */
function tanggalNikahDariIso(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  if (!m || m[1] === "0000" || m[2] === "00" || m[3] === "00") return "";
  const bulan = Number(m[2]);
  if (bulan < 1 || bulan > 12 || Number(m[1]) < 1900) return "";
  return tampilTanggalNikah(Number(m[3]), BULAN[bulan - 1], m[1]);
}

/**
 * Tanggal nikah dari butir posita (hasil kalimatPosita). -> { nilai: "04 Juli 2011", kalimat } atau { nilai: "", kalimat: "" }.
 * Lebih baik kosong daripada salah: kalimat tanpa hari, atau yang hanya memuat tanggal akta/kelahiran, tidak menghasilkan apa-apa.
 */
function tanggalNikahDariPosita(butir) {
  for (const b of Array.isArray(butir) ? butir : []) {
    const k = String(b || "");
    if (!POLA_KALIMAT_NIKAH.test(k) || (POLA_BUKAN_KALIMAT_NIKAH.test(k) && !/melangsungkan|akad\s+nikah/i.test(k))) continue;
    for (const m of k.matchAll(POLA_TANGGAL_PANJANG)) {
      if (POLA_DEPAN_TANGGAL_LAIN.test(k.slice(Math.max(0, m.index - 60), m.index))) continue;
      const nilai = tampilTanggalNikah(m[1], m[2], m[3]);
      if (nilai) return { nilai, kalimat: k };
    }
  }
  return { nilai: "", kalimat: "" };
}

/**
 * KUA tempat menikah dari kalimat pernikahan posita cerai, dalam bentuk nama wilayah ("Kecamatan Sindue Tobata, Kabupaten Donggala,
 * Provinsi Sulawesi Tengah"): potongan dari sebutan KUA sampai sebelum "sebagaimana/Kutipan/Nomor/tertanggal" - TIDAK pernah ikut
 * kalimat akta. Hanya SARAN (keyakinan ragu): bentuk tulis isian "KUA Kec." di blangko cerai belum pernah dipastikan petugas.
 */
function kuaDariPosita(butir) {
  const wilayah = require("./deteksi/wilayah");
  for (const b of Array.isArray(butir) ? butir : []) {
    const k = String(b || "");
    const m = /\b(?:Kantor\s+Urusan\s+Agama|KUA)\b/i.exec(k);
    if (!m || !/pernikahan|perkawinan|menikah|dicatat|dicatatkan/i.test(k)) continue;
    const seg = k.slice(m.index).split(/\b(?:sebagaimana|sesuai|dengan\s+kutipan|kutipan|nomor|tertanggal|yang\s+menikahkan)\b|;/i)[0];
    const komp = wilayah.komponenWilayah(seg);
    if (!komp.kecamatan) continue;
    const nilai = [`Kecamatan ${komp.kecamatan}`, komp.kabupaten, komp.provinsi].filter(Boolean).join(", ");
    return { nilai, kalimat: k };
  }
  return { nilai: "", kalimat: "" };
}

/**
 * Usulan dari data pernikahan perkara dan posita (5197 tanggal nikah, 5178 KUA) untuk perkara cerai.
 * 5197: data pernikahan SIPP (pasti) lebih dulu, lalu kalimat pernikahan pada posita (cukup). 5178: dari posita, hanya saran.
 * Hanya MEMBACA; kegagalan satu kueri (tabel tak ada) tidak menggagalkan yang lain. -> daftar usulan (boleh kosong).
 */
async function usulanTanggalNikahSipp(perkaraId) {
  const hasil = [];
  let nikah = [];
  try {
    nikah = await runQuery("SELECT DATE_FORMAT(tgl_nikah, '%Y-%m-%d') AS tglNikah FROM perkara_data_pernikahan WHERE perkara_id = ? LIMIT 1", [perkaraId]);
  } catch {
    nikah = [];
  }
  const dariData = tanggalNikahDariIso(Array.isArray(nikah) && nikah[0] ? nikah[0].tglNikah : "");
  let posita = [];
  try {
    posita = await runQuery("SELECT posita FROM perkara WHERE perkara_id = ? LIMIT 1", [perkaraId]);
  } catch {
    posita = [];
  }
  const butir = kalimatPosita(Array.isArray(posita) && posita[0] ? posita[0].posita : "");
  if (dariData) {
    hasil.push({
      kode: "5197",
      nama: "Tgl Nikah",
      nilai: dariData,
      keyakinan: "pasti",
      bentrok: "",
      catatan: "Dari data pernikahan perkara di SIPP (Tanggal Menikah).",
      dihitung: false,
      sumber: [{ asal: "data-nikah", keterangan: `Data pernikahan perkara di SIPP: ${dariData}` }],
    });
  } else {
    const h = tanggalNikahDariPosita(butir);
    if (h.nilai) {
      hasil.push({
        kode: "5197",
        nama: "Tgl Nikah",
        nilai: h.nilai,
        keyakinan: "cukup",
        bentrok: "",
        catatan: "Dari kalimat pernikahan pada posita perkara; data pernikahan di SIPP belum diisi.",
        dihitung: false,
        sumber: [{ asal: "posita-gugatan", kalimat: h.kalimat }],
      });
    }
  }
  const kua = kuaDariPosita(butir);
  if (kua.nilai) {
    hasil.push({
      kode: "5178",
      nama: "KUA Kec.",
      nilai: kua.nilai,
      keyakinan: "ragu",
      bentrok: "",
      catatan: "Nama wilayah KUA tempat menikah dari posita (tanpa kalimat akta nikah); periksa bentuk tulisnya.",
      dihitung: false,
      sumber: [{ asal: "posita-gugatan", kalimat: kua.kalimat }],
    });
  }
  return hasil;
}

function hasilItsbat(nilai, kalimat, catatan) {
  if (!nilai) {
    return { nilai: "", keyakinan: "kosong", bentrok: "", catatan: catatan || "tidak ditemukan pada posita" };
  }
  return { nilai, keyakinan: "cukup", bentrok: "", catatan: catatan || "" };
}

/**
 * Menurunkan variabel blangko itsbat nikah dari posita permohonan.
 *
 * @param {string} posita   posita apa adanya dari SIPP (boleh HTML)
 * @param {{pemohon?: string, pemohon2?: string}} pihak sebutan kedua pemohon
 */
function dariPositaItsbat(posita, pihak) {
  const kalimat = kalimatPosita(posita);
  const sumber = (k) => (k ? [{ saksi: 0, asal: "posita", kalimat: k }] : []);
  const cari = (wajib, terlarang) => cariButir(kalimat, wajib, terlarang);
  // Bawaan sebutan dua pemohon dari satu sumber (sebutanPihakService, D5): "Pemohon I" / "Pemohon II".
  const [bawaan1, bawaan2] = require("./sebutanPihakService").daftarSebutanBerurut("Pemohon", 2);
  const sebut1 = (pihak && pihak.pemohon) || bawaan1;
  const sebut2 = (pihak && pihak.pemohon2) || bawaan2;
  const lolos = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Tanggal nikah - "pada tanggal 07 Mei 2017 telah terjadi pernikahan".
  const kNikah = cari(["pernikahan"], ["dikaruniai", "wali"]) || cari(["menikah"], ["dikaruniai"]);
  const tgl = String(kNikah || "").match(/\b(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\b/);
  const tanggalNikah = tgl && bulanKeAngka(tgl[2]) !== null ? `${tgl[1]} ${tgl[2]} ${tgl[3]}` : "";

  // Tempat menikah - "dilangsungkan di wilayah Kecamatan X" / "di Desa Y".
  const tempat = String(kNikah || "").match(
    /\bdi\s+(?:wilayah\s+)?((?:Desa|Kelurahan|Kecamatan|Kec\.|Kabupaten|rumah|Masjid|KUA|Kantor)\b.{2,90}?)(?=\s+(?:dan|serta|yang|pada|oleh|dengan|sampai|hingga|sejak)\b|[;,.]|$)/i
  );
  const alamatNikah = tempat ? tempat[1].replace(/\s+/g, " ").trim() : "";
  // 5178 (KUA) kini hanya dari deteksi/itsbat.js: bentuk lama ("Palolo" saja) 0 dari 249 sama dengan isian petugas.

  // Wali nikah - "dengan wali nikah saudara kandung Pemohon II bernama X",
  // atau bentuk satker "wali nikah yaitu Ludin (Ayah Kandung Pemohon II)".
  //
  // Posita itsbat satker menulis wali, yang menikahkan, saksi, dan mahar
  // dalam SATU kalimat panjang. Pencarian "wali ... bernama" karena itu
  // dibatasi sebelum kata "menikahkan", "saksi", dan "mahar/mas kawin" -
  // tanpa batas itu, nama saksi nikah terbaca sebagai nama wali.
  const kWali = cari(["wali nikah"]) || cari(["wali", "bernama"]);
  const AWAL_WALI = "wali(?: nikah)?(?:nya)?(?:(?!menikahkan|saksi|mahar|mas kawin)[^;])*?\\b";
  const namaWali =
    namaSesudah(kWali, `${AWAL_WALI}bernama`) ||
    namaSesudah(kWali, `${AWAL_WALI}(?:yaitu|adalah|ialah)`) ||
    // "wali nikah sekaligus yang menikahkan yaitu Elyas (...)"
    namaSesudah(kWali, "wali(?: nikah)?\\s+sekaligus\\s+(?:yang\\s+)?menikahkan(?:nya)?\\s+(?:yaitu|adalah|ialah|bernama)") ||
    // "wali nikah Ashar (Ayah kandung Pemohon I)" - nama langsung sesudahnya.
    // Kata bukan-nama ("wali nikah Ayah kandung ...") menghentikannya.
    namaSesudah(kWali, "wali nikah(?:nya)?");
  // Status wali (1046) kini di deteksi/itsbat.js (statusWali) - pola lama di sini menangkap "yang"/"nikah".

  // ==========================================================================
  // YANG MENIKAHKAN - DUA BENTUK POSITA, SATU BENTUK ISIAN
  // ==========================================================================
  //
  //   posita "yang menikahkan adalah Imam Masjid bernama Kaswari"
  //   posita "yang menikahkan adalah Hamsih (Imam Desa Kaleke)"
  //   isian  "Imam Desa Kaleke bernama Hamsih"  - bentuk 310 dari 368 isian
  //          8087 manusia ("<jabatan> bernama <nama>")
  //
  // Bentuk kedua dahulu tidak terbaca sama sekali: pencariannya menuntut
  // kata "bernama", lalu meloncat ke "bernama" milik SAKSI nikah di kalimat
  // yang sama. Kini pencariannya berhenti di kalimat yang menikahkan, dan
  // jabatan dalam kurung diletakkan di depan seperti isian petugas.
  const kMenikahkan = cari(["menikahkan"]);
  const sesudahMenikahkan =
    (String(kMenikahkan || "").match(/menikahkan\s+(?:adalah\s+|yaitu\s+|ialah\s+)?([^;]*)/i) || [])[1] || "";
  const bentukBernama = sesudahMenikahkan.match(/^((?:[A-Za-z0-9.'’-]+\s+){1,8}?)(yang\s+)?bernama\s+/i);
  let yangMenikahkan = "";
  if (bentukBernama) {
    const nama = namaDiAwal(sesudahMenikahkan.slice(bentukBernama[0].length));
    if (nama) yangMenikahkan = `${bentukBernama[1].trim()} ${bentukBernama[2] ? "yang " : ""}bernama ${nama}`;
  } else {
    const nama = namaDiAwal(sesudahMenikahkan);
    const kurung = nama ? sesudahMenikahkan.slice(sesudahMenikahkan.indexOf(nama) + nama.length).match(/^\s*\(([^()]{2,80})\)/) : null;
    if (nama) yangMenikahkan = kurung ? `${kurung[1].replace(/\s+/g, " ").trim()} bernama ${nama}` : nama;
  }

  // Saksi nikah - "dihadiri 2 (dua) orang saksi masing-masing bernama MILLO dan MALIWAN".
  const kSaksi = cari(["saksi", "bernama"]);
  const sesudahSaksi = String(kSaksi || "").replace(/^[\s\S]*?\bsaksi\b/, "");
  const saksi1 = namaSesudah(sesudahSaksi, "bernama");
  const saksi2 = saksi1 ? namaSesudah(sesudahSaksi, `${lolos(saksi1)}\\s+dan`) : "";

  // ==========================================================================
  // MAHAR - TIDAK BERHENTI PADA TITIK DI DALAM "Rp.11.000"
  // ==========================================================================
  //
  // Bentuk lamanya berhenti pada titik PERTAMA, sehingga "uang sebesar
  // Rp.11.000 (sebelas ribu rupiah)" menjadi "uang sebesar Rp" - terukur
  // 167 dari 395 posita. Kini berhentinya di titik koma, atau di titik yang
  // benar-benar menutup kalimat (diikuti huruf besar, atau akhir teks).
  // "dibayar tunai" ikut, sebab 353 dari 368 isian 1001 manusia memuatnya;
  // apa pun sesudahnya tidak.
  const kMahar = cari(["mahar"]) || cari(["mas kawin"]);
  let mahar = "";
  const awalMahar = String(kMahar || "").match(/(?:mahar|mas kawin)\s+(?:berupa\s+)?([\s\S]+)$/i);
  if (awalMahar) {
    let isi = awalMahar[1];
    const akhir = isi.search(/;|\.\s+(?=[A-Z])|\.\s*$/);
    if (akhir >= 0) isi = isi.slice(0, akhir);
    const sampaiTunai = isi.match(/^([\s\S]*?\b(?:dibayar|dibayarkan)\s+(?:secara\s+)?(?:tunai|kontan|hutang|terhutang)\b)/i);
    if (sampaiTunai) isi = sampaiTunai[1];
    // Anak kalimat sesudah maharnya bukan bagian mahar: "... seperangkat alat
    // sholat yang diberikan secara tunai oleh Pemohon I kepada Pemohon II"
    // (2/Pdt.P/2024/PA.Buk; verify-abt-usulan-itsbat-sdg.js). Penghenti ini
    // ada pada bentuk lama dan sempat ikut hilang bersamanya. "dibayar tunai"
    // di atas tetap ikut - lookbehind menjaga "dibayar secara tunai".
    const anakKalimat = isi.search(
      /\s+(?:yang\s+)?(?:diberikan|diserahkan)\b|\s+yang\s+dibayar(?:kan)?\b|(?<!dibayar|dibayarkan)\s+secara\s+tunai\b/i
    );
    if (anakKalimat >= 0) isi = isi.slice(0, anakKalimat);
    mahar = isi.replace(/\s+/g, " ").replace(/[\s,]+$/, "").trim();
  }

  // Status dan umur - "Pemohon I berstatus Jejaka dalam usia 19 (sembilan belas) tahun".
  const kStatus = cari(["berstatus"], ["suami istri", "suami isteri"]);
  const polaStatus = (sebut) =>
    new RegExp(`${lolos(sebut)}\\s+berstatus\\s+([A-Za-z]+(?:\\s+(?:mati|hidup))?)(?:\\s+dalam\\s+usia\\s+(\\d{1,2}))?`, "i");
  const cobaStatus = (daftarSebut) => {
    for (const sebut of daftarSebut) {
      if (!sebut) continue;
      if (sebut === "Pemohon" && /Pemohon\s+II?\b/.test(kStatus || "")) continue;
      const cocok = String(kStatus || "").match(polaStatus(sebut));
      if (cocok) return cocok;
    }
    return null;
  };
  const status1 = cobaStatus([sebut1, "Pemohon I", "Pemohon"]);
  const status2 = cobaStatus([sebut2, "Pemohon II"]);

  // Anak - "telah dikaruniai 2 (dua) orang anak" / "belum dikaruniai anak".
  const kAnak = cari(["dikaruniai"]);
  const belumAnak = /belum\s+dikaruniai/i.test(kAnak || "");
  const jumlahAnak = String(kAnak || "").match(/dikaruniai\s+(\d+)\s*(?:\([^)]*\)\s*)?orang\s+anak/i);
  const anak = belumAnak
    ? "belum dikaruniai anak"
    : jumlahAnak
    ? `telah dikaruniai ${jumlahAnak[1]} orang anak`
    : /dikaruniai\s+(?:seorang|satu)\s+(?:orang\s+)?anak/i.test(kAnak || "")
    ? "telah dikaruniai 1 orang anak"
    : "";

  // 13 Okt 2026 (butir 14, 228/Pdt.P/2026): tempat menikah lengkap, KUA domisili, status wali (juga dalam
  // kurung sesudah nama), status tanpa "berstatus", dan bunyi anak - aturan di deteksi/itsbat.js.
  const d = require("./deteksi/itsbat").deteksi(posita, { kalimat, pemohon: sebut1, pemohon2: sebut2 });
  const dari = (kode, lama, kLama) => (d[kode] ? { nilai: d[kode].nilai, k: d[kode].kalimat } : { nilai: lama, k: kLama });
  const t5105 = dari("5105", alamatNikah, kNikah);
  const t5178 = d["5178"] ? { nilai: d["5178"].nilai, k: d["5178"].kalimat } : { nilai: "", k: "" };
  // 1046: hanya aturan baru - pola lama menangkap "yang", "nikah", "orang tua dari" (ukur 13 Okt).
  const t1046 = dari("1046", "", kWali);
  const t0007 = dari("0007", anak, kAnak);
  // 1002/1003: #1002# = status pihak #0046#, #1003# = status pihak lawan / Pemohon II (keputusan 14 Okt 2026,
  // sama dengan bawaan ABT 10106/10107 paket abt-variabel-k6); kata status dibaca menurut jenis kelamin pihaknya.
  const t1002 = dari("1002", "", "");
  const t1003 = dari("1003", "", "");
  // 7211 = umur LAKI-LAKI, 7212 = PEREMPUAN (nama variabelnya) - bukan menurut sebutan pihak.
  const sebutIstri = /^penggugat\b/i.test(sebut1);
  const t7211 = dari("7211", !sebutIstri && status1 && status1[2] ? `${status1[2]} tahun` : "", kStatus);
  const t7212 = dari("7212", !sebutIstri && status2 && status2[2] ? `${status2[2]} tahun` : "", kStatus);

  const usulanSemua = [
    usulan("5197", "Tanggal nikah", hasilItsbat(tanggalNikah, kNikah), sumber(kNikah)),
    usulan("5105", "Alamat tempat menikah", hasilItsbat(t5105.nilai, t5105.k), sumber(t5105.k)),
    usulan("5178", "KUA kecamatan", hasilItsbat(t5178.nilai, t5178.k, t5178.nilai ? "" : "posita tidak menyebut KUA/kecamatan"), sumber(t5178.k)),
    usulan("1217", "Nama wali nikah", hasilItsbat(namaWali, kWali), sumber(kWali)),
    usulan("1046", "Status wali nikah", hasilItsbat(t1046.nilai, t1046.k), sumber(t1046.k)),
    usulan("8087", "Yang menikahkan", hasilItsbat(yangMenikahkan, kMenikahkan), sumber(kMenikahkan)),
    usulan("0650", "Saksi nikah 1", hasilItsbat(saksi1, kSaksi), sumber(kSaksi)),
    usulan("0651", "Saksi nikah 2", hasilItsbat(saksi2, kSaksi), sumber(kSaksi)),
    usulan("1001", "Mas kawin", hasilItsbat(mahar, kMahar), sumber(kMahar)),
    usulan("1002", `Status ${sebut1} sebelum nikah`, hasilItsbat(t1002.nilai, t1002.k), sumber(t1002.k)),
    usulan("1003", `Status ${sebut2} sebelum nikah`, hasilItsbat(t1003.nilai, t1003.k), sumber(t1003.k)),
    usulan("7211", `Umur ${sebutIstri ? "suami" : sebut1} saat menikah`, hasilItsbat(t7211.nilai, t7211.k), sumber(t7211.k)),
    usulan("7212", `Umur ${sebutIstri ? sebut1 : sebut2} saat menikah`, hasilItsbat(t7212.nilai, t7212.k), sumber(t7212.k)),
    usulan("0007", "Telah dikaruniai anak", hasilItsbat(t0007.nilai, t0007.k), sumber(t0007.k)),
  ];

  const ditemukan = usulanSemua.filter((u) => u.nilai).length;
  return {
    ok: true,
    jumlahKalimat: kalimat.length,
    ditemukan,
    usulan: usulanSemua,
    catatan:
      ditemukan === 0
        ? "Tidak satu pun fakta pernikahan terbaca dari posita. Posita ini mungkin bukan permohonan itsbat nikah, atau kalimatnya tidak berpola."
        : `${ditemukan} dari ${usulanSemua.length} variabel terbaca dari posita; sisanya dikosongkan, bukan ditebak.`,
  };
}

/* ==========================================================================
 * KETERANGAN SAKSI "SAMA DENGAN GUGATAN" - DUA SAKSI, SATU SUBSTANSI, DUA CARA
 * ==========================================================================
 *
 * Saksi dalam perkara perceraian dan itsbat pada umumnya menerangkan hal yang
 * sama - itulah sebabnya ia disebut SDG. Yang tidak boleh terjadi: dua
 * keterangan yang kata demi kata identik. Berita acara yang dua saksinya
 * berbunyi persis sama terbaca sebagai disalin, dan hakim banding membacanya
 * begitu pula.
 *
 * Karena itu tiap jawaban disusun dari templat pertanyaan yang SAMA (milik
 * ABT, diambil ekstensi lewat halaman penyunting ABT sendiri), lalu diberi
 * bentuk kalimat yang berbeda untuk saksi 1 dan saksi 2: pembuka yang berbeda,
 * kata kerja yang berbeda, dan penutup yang berbeda - substansinya tetap satu,
 * sebab substansi itulah yang dibuktikan.
 *
 * Yang TIDAK dilakukan di sini: mengarang fakta. Jawaban templat yang memuat
 * titik-titik ("...........") atau pilihan ("melihat/mendengar") ditandai
 * PERLU DIISI, bukan diisi sembarang. Petugas yang membaca akan melihat persis
 * bagian mana yang masih menunggu keterangan saksinya yang sesungguhnya.
 */

/* ==========================================================================
 * BANK RAGAM - BAWAAN ATAU DAFTAR DARI PORTAL (K6)
 * ==========================================================================
 *
 * Datanya tinggal di ragamBasBawaan.js. Portal boleh menumpangkan daftar
 * efektif lewat opsi.tipeKeluaran.daftar['bas.saksi.*']; daftar yang tidak
 * dikirim memakai bawaan, daftar yang dikirim KOSONG berarti semua entrinya
 * dimatikan dan itu dihormati.
 *
 * Masukan itu datang lewat peramban, jadi disaring seperti K6: daftar
 * dikenal saja, <= 200 entri, nilai <= 400 huruf, tanpa '${', '<', atau
 * ganti baris, dan penanda yang sah per daftar. Yang ditolak dipulangkan
 * beserta sebabnya, tidak dibuang diam-diam.
 */
const DAFTAR_BAS = Object.freeze({
  pembuka: "bas.saksi.pembuka",
  ragamKata: "bas.saksi.ragam-kata",
  jawabanModus: "bas.saksi.jawaban-modus",
  bentuk: "bas.saksi.bentuk",
  profil: "bas.saksi.profil",
});
const KUNCI_JAWABAN_MODUS = Object.freeze(Object.keys(ragamBawaan.JAWABAN_MODUS));
/**
 * Batas entri per daftar (K6). Umumnya 200; jawaban-modus 400 sejak butir 9
 * (13 Okt 2026): bawaannya sendiri 280 kalimat (20 bank x 14), dan cermin
 * portal mengirim seluruhnya - batas 200 akan memotong bank belakangan.
 * Cerminnya: rute bot BATAS_ENTRI_KHUSUS_ABT, portal BATAS_DAFTAR.
 */
const BATAS_ENTRI_BAS = 200;
const BATAS_ENTRI_KHUSUS = Object.freeze({ "bas.saksi.jawaban-modus": 400 });
function batasEntriBas(kunciDaftar) {
  return BATAS_ENTRI_KHUSUS[kunciDaftar] || BATAS_ENTRI_BAS;
}
const POLA_KATA_POLOS_BAS = /^[a-z]+( [a-z]+)*$/;
const POLA_KUNCI_TANYA_BAS = /^[a-z0-9#]+( [a-z0-9#]+)*$/;

/** Pola \b<kata>\b dibangun dari kata polos - data tidak pernah memuat regex. */
function polaKata(kata, abaikanBesarKecil) {
  const aman = String(kata).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${aman}\\b`, abaikanBesarKecil ? "gi" : "g");
}

/**
 * Pembuka yang dirusak ABT di putusan. replace_ket_saksi membuang 'ya, '
 * tanpa peka huruf DI MANA PUN: 'Iya, ' menjadi 'i', 'Hanya, ' menjadi
 * 'Han'. Hanya 'Ya, ' utuh dan kata berakhiran 'saya' yang selamat.
 */
function pembukaRusakDiPutusan(pembuka) {
  const kata = String(pembuka).trim().replace(/,$/, "").split(/\s+/).pop().toLowerCase();
  return /ya$/.test(kata) && kata !== "ya" && kata !== "saya";
}

function bacaBankBas(opsi) {
  const tipe = opsi && typeof opsi === "object" && opsi.tipeKeluaran && typeof opsi.tipeKeluaran === "object"
    ? opsi.tipeKeluaran
    : null;
  const daftar = tipe && tipe.daftar && typeof tipe.daftar === "object" ? tipe.daftar : null;
  const ditolak = [];
  const asal = {};

  const ambil = (kunciDaftar, bawaan, normalkan) => {
    if (!daftar || !Object.prototype.hasOwnProperty.call(daftar, kunciDaftar)) {
      asal[kunciDaftar] = "tertanam";
      return bawaan;
    }
    const mentah = daftar[kunciDaftar];
    if (!Array.isArray(mentah)) {
      ditolak.push({ daftar: kunciDaftar, kunci: "", alasan: "daftar_bukan_larik" });
      asal[kunciDaftar] = "tertanam";
      return bawaan;
    }
    asal[kunciDaftar] = "portal";
    const hasil = [];
    mentah.forEach((e, indeks) => {
      const kunciMentah = e && typeof e === "object" ? String(e.kunci || "").slice(0, 80) : "";
      const batas = batasEntriBas(kunciDaftar);
      if (indeks >= batas) {
        ditolak.push({ daftar: kunciDaftar, kunci: kunciMentah, alasan: `lebih_dari_${batas}_entri` });
        return;
      }
      if (!e || typeof e !== "object") {
        ditolak.push({ daftar: kunciDaftar, kunci: "", alasan: "bukan_objek" });
        return;
      }
      const data = e.data && typeof e.data === "object" ? e.data : {};
      const nilai = String(e.nilai === undefined || e.nilai === null ? "" : e.nilai);
      const kunci = String(e.kunci === undefined || e.kunci === null ? "" : e.kunci).trim();
      const r = normalkan({ kunci, nilai, data });
      if (r.alasan) ditolak.push({ daftar: kunciDaftar, kunci: kunciMentah, alasan: r.alasan });
      else hasil.push(r.entri);
    });
    return hasil;
  };
  const periksa = (teks, penanda) => kalimatBaku.periksaTeksTipe(teks, penanda);

  const pembuka = ambil(DAFTAR_BAS.pembuka, ragamBawaan.PEMBUKA, ({ nilai, data }) => {
    const salah = periksa(nilai, []);
    if (salah) return { alasan: `nilai_${salah}` };
    if (nilai.length < 3 || nilai.length > 40 || !nilai.endsWith(", ")) return { alasan: "pembuka_harus_3_40_huruf_diakhiri_koma" };
    if (pembukaRusakDiPutusan(nilai)) return { alasan: "pembuka_dirusak_replace_ket_saksi" };
    const bobot = data.bobot === undefined ? 1 : Number(data.bobot);
    if (!(bobot > 0 && bobot <= 100)) return { alasan: "bobot_bukan_0_100" };
    return { entri: { nilai, bobot } };
  });

  const ragamKata = ambil(DAFTAR_BAS.ragamKata, ragamBawaan.RAGAM_KATA, ({ nilai, data }) => {
    const ganti = String(data.ganti || "");
    if (!POLA_KATA_POLOS_BAS.test(nilai) || nilai.length > 30) return { alasan: "kata_bukan_kata_polos" };
    if (!POLA_KATA_POLOS_BAS.test(ganti) || ganti.length > 30 || ganti === nilai) return { alasan: "ganti_bukan_kata_polos" };
    return { entri: { kata: nilai, ganti, abaikanBesarKecil: data.abaikanBesarKecil === true } };
  });

  const modusMentah = ambil(
    DAFTAR_BAS.jawabanModus,
    Object.entries(ragamBawaan.JAWABAN_MODUS).flatMap(([kunci, isi]) => isi.map((nilai) => ({ kunci, nilai }))),
    ({ kunci, nilai }) => {
      if (!KUNCI_JAWABAN_MODUS.includes(kunci)) return { alasan: "kunci_tanpa_cabang_kode" };
      const salah = periksa(nilai, ["{sumber}", "{daftar}", "{isi}", "{jawab}"]);
      if (salah) return { alasan: `nilai_${salah}` };
      if (nilai.length < 20 || nilai.length > 240) return { alasan: "nilai_bukan_20_240_huruf" };
      return { entri: { kunci, nilai } };
    }
  );
  const jawabanModus = {};
  for (const e of modusMentah) (jawabanModus[e.kunci] = jawabanModus[e.kunci] || []).push(e.nilai);

  const bentukMentah = ambil(DAFTAR_BAS.bentuk, ragamBawaan.BENTUK, ({ kunci, nilai, data }) => {
    if (!POLA_KUNCI_TANYA_BAS.test(kunci) || kunci.length > 200) return { alasan: "kunci_bukan_kunci_tanya" };
    const salah = periksa(nilai, ["{slot}"]);
    if (salah) return { alasan: `nilai_${salah}` };
    const asing = (nilai.match(/#\d{4}#/g) || []).filter((p) => p !== "#0046#" && p !== "#0047#");
    if (asing.length) return { alasan: `penanda_tidak_sah:${asing[0]}` };
    if (nilai.length < 3 || nilai.length > 400) return { alasan: "nilai_bukan_3_400_huruf" };
    const syarat = data.syarat && typeof data.syarat === "object" ? data.syarat : null;
    return { entri: { kunci, nilai, syarat } };
  });
  const bentuk = new Map();
  for (const e of bentukMentah) {
    if (!bentuk.has(e.kunci)) bentuk.set(e.kunci, []);
    const kelompok = bentuk.get(e.kunci);
    // Semua bentuk sekunci membawa slot yang sama banyaknya dengan bentuk
    // pertamanya - slot dipindah menurut urutan, jadi yang berbeda banyaknya
    // akan menaruh isi di tempat yang salah.
    const slot = (t) => t.split("{slot}").length - 1;
    if (kelompok.length && slot(e.nilai) !== slot(kelompok[0].nilai)) {
      ditolak.push({ daftar: DAFTAR_BAS.bentuk, kunci: e.kunci, alasan: "banyak_slot_berbeda" });
      continue;
    }
    kelompok.push({ nilai: e.nilai, syarat: e.syarat });
  }

  const profilMentah = ambil(
    DAFTAR_BAS.profil,
    ragamBawaan.PROFIL.map((p) => ({ kunci: p.kunci, peluangRagam: p.data.peluangRagam, rumusan: p.data.rumusan === true })),
    ({ kunci, data }) => {
      if (!POLA_KUNCI_TANYA_BAS.test(kunci) || kunci.length > 200) return { alasan: "kunci_bukan_kunci_tanya" };
      const p = Number(data.peluangRagam);
      if (typeof data.peluangRagam !== "number" || !(p >= 0 && p <= 1)) return { alasan: "peluang_bukan_0_1" };
      return { entri: { kunci, peluangRagam: p, rumusan: data.rumusan === true } };
    }
  );
  const profil = new Map(profilMentah.map((p) => [p.kunci, p]));

  const dariPortal = Object.values(asal).includes("portal");
  return {
    pembuka,
    ragamKata: ragamKata.map((r) => ({ pola: polaKata(r.kata, r.abaikanBesarKecil), ganti: r.ganti })),
    jawabanModus,
    bentuk,
    profil,
    asal: dariPortal ? "portal" : "tertanam",
    asalPerDaftar: asal,
    versi: dariPortal && tipe && typeof tipe.versi === "string" ? tipe.versi.slice(0, 40) : "",
    ditolak,
  };
}

/**
 * Kalimat yang SUDAH menyatakan sejauh mana saksi mengetahuinya.
 *
 * Pembuka tidak boleh ditambahkan di depannya. Tanpa pemeriksaan ini terbit
 * "Yang saya ketahui, sepanjang yang saya ketahui, mereka bertengkar karena
 * ..." - dua kali menyatakan hal yang sama dalam satu kalimat, dan itu terbaca
 * sebagai naskah yang disusun mesin, persis kesan yang dihindari seluruh
 * bagian ragam ini.
 */
const POLA_SUDAH_BERPEMBUKA =
  /^(ya|benar|betul|iya|setahu|sepengetahuan|sepanjang|sejauh|seingat|menurut|yang saya|sebatas)\b/i;

/** "Penggugat/Tergugat" - templat menyerahkan pilihan pihaknya kepada petugas. */
const POLA_PILIHAN_SEBUTAN_TEKS =
  /\b(?:penggugat|tergugat|pemohon|termohon)\s*\/\s*(?:penggugat|tergugat|pemohon|termohon)\b/i;

/** Penanda jawaban templat yang masih menunggu isian manusia. */
const POLA_BELUM_TERISI = /\.{3,}|_{3,}|\bmelihat\/mendengar\b|\bdilihat\/didengar\b|\bXX+\b/i;

/* ==========================================================================
 * PEMBANTU KALIMAT
 * ========================================================================== */

function rapikanTeks(teks) {
  return String(teks || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tanda baca akhir dibuang - tetapi titik-titik ("...") BUKAN tanda baca akhir:
 * ia tempat isian yang harus tetap terlihat dan tetap ditandai perlu diisi.
 */
function tanpaAkhiran(teks) {
  let t = rapikanTeks(teks);
  for (;;) {
    const s = t.replace(/[\s;,]+$/, "").replace(/([^.])\.$/, "$1");
    if (s === t) return t;
    t = s;
  }
}

/**
 * 19 Okt 2026 - satu jawaban saksi = SATU paragraf. Baris baru di tengah kalimat (posita yang disalin dari PDF memotong
 * kalimat di mana saja) dilebur menjadi spasi: SIPP/ABT membuang <br>, jadi "rumah[baris baru]tangga" tercetak "rumahtangga".
 * Spasi sebelum koma/titik koma dibuang, koma tanpa spasi dilengkapi, dan tanda ganda dirapatkan. Titik-titik isian
 * ("........") tidak disentuh. Idempoten.
 */
function rapikanKalimatSaksi(teks) {
  return String(teks || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+([,;:])/g, "$1")
    .replace(/([A-Za-z)])(,)(?=[A-Za-z(])/g, "$1$2 ")
    .replace(/,(\s*,)+/g, ",")
    .replace(/,\s*;/g, ";")
    .replace(/;(\s*;)+/g, ";");
}

function akhiriJawaban(teks) {
  const t = tanpaAkhiran(rapikanKalimatSaksi(teks));
  return t ? `${t};` : "";
}

function besarkanAwal(teks) {
  const t = String(teks || "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Koma sesudah kata berakhiran 'ya' dibuang - "semasa hidupnya, X" menjadi
 * "semasa hidupnya X". ABT membuang 'ya, ' di mana pun saat menyalin ke
 * putusan, sehingga yang pertama tercetak "semasa hidupnX". 'saya, ' aman
 * (ABT mengganti 'saya' lebih dahulu), dan 'Ya, ' pembuka memang dibuang.
 */
function amankanKomaYa(teks) {
  return String(teks || "").replace(/([A-Za-z]+)(ya), /gi, (utuh, akar, ya) =>
    `${akar}${ya}`.toLowerCase() === "saya" ? utuh : `${akar}${ya} `
  );
}

/**
 * Tiruan replace_ket_saksi ABT (Abt_model.php:855): jawaban saksi di putusan
 * = "Bahwa " + str_ireplace([...], [...], lcfirst(jawaban)). str_ireplace
 * berlarik menjalankan tiap pasangan berurutan atas hasil sebelumnya.
 */
const REPLACE_KET_SAKSI = [
  [/saya/gi, "saksi"],
  [/ya, /gi, ""],
  [/penggugat/gi, "Penggugat"],
  [/pemohon/gi, "Pemohon"],
  [/tergugat/gi, "Tergugat"],
  [/termohon/gi, "Termohon"],
];
function tiruanReplaceKetSaksi(jawaban) {
  let t = String(jawaban || "");
  t = t.charAt(0).toLowerCase() + t.slice(1);
  for (const [cari, ganti] of REPLACE_KET_SAKSI) t = t.replace(cari, ganti);
  return `Bahwa ${t}`;
}

const POLA_SEBUTAN_SEMUA = /\b(penggugat|tergugat|pemohon|termohon)\b/gi;
const POLA_MODAL_NEGASI = /\b(tidak|tak|belum|bukan|tanpa|pernah|sering|selalu|kadang|jarang|mungkin|harus|wajib)\b/gi;
const POLA_PEMBUKA_BUANG = /^(ya|iya|benar|betul|setahu saya|sepengetahuan saya|yang saya ketahui)\s*,\s*/i;

function sidikKata(teks, pola) {
  return (String(teks).toLowerCase().match(pola) || []).sort().join(",");
}

function hitungKembar(teks) {
  const t = String(teks);
  return (t.match(/\b([A-Za-z]{3,}) dan \1\b/gi) || []).length + (t.match(/\b([A-Za-z]{3,}) \1\b/gi) || []).length;
}

/**
 * ============================================================================
 * PEMERIKSA MAKNA - RAGAM BOLEH MENGUBAH CARA MENGATAKAN, BUKAN YANG DIKATAKAN
 * ============================================================================
 *
 * @param dasar  jawaban sebelum diragamkan (templat/modus sesudah diisi)
 * @param hasil  jawaban sesudah diragamkan dan diberi pembuka
 * @param opsi   {slot?: string[], tetap?: boolean}
 * @returns {{ok: boolean, pelanggaran: string[]}}
 *
 * Yang diperiksa:
 *   - sebutan pihak, variabel #dddd#, angka, titik-titik, dan isi slot TETAP;
 *   - kata modal dan negasi TETAP (sering/pernah/tidak/belum ...);
 *   - tidak ada 'Iya,' maupun '<kata>ya, ' (dirusak ABT di putusan);
 *   - sebutan tidak berawal huruf kecil;
 *   - tidak ada kata kembar yang tidak ada di dasarnya;
 *   - jawaban 'tetap' (sumpah, identitas) tidak disentuh;
 *   - bunyi di putusan (tiruan replace_ket_saksi) tidak rusak.
 */
function periksaInvarian(dasar, hasil, opsi) {
  const o = opsi || {};
  const d = tanpaAkhiran(dasar).replace(POLA_PEMBUKA_BUANG, "");
  const hPenuh = tanpaAkhiran(hasil);
  const h = hPenuh.replace(POLA_PEMBUKA_BUANG, "");
  const pelanggaran = [];
  if (sidikKata(d, POLA_SEBUTAN_SEMUA) !== sidikKata(h, POLA_SEBUTAN_SEMUA)) pelanggaran.push("sebutan_berubah");
  if (sidikKata(d, /#\d{4}#/g) !== sidikKata(h, /#\d{4}#/g)) pelanggaran.push("penanda_berubah");
  if (sidikKata(d, /\d+/g) !== sidikKata(h, /\d+/g)) pelanggaran.push("angka_berubah");
  if ((d.match(/\.{3,}|_+/g) || []).length !== (h.match(/\.{3,}|_+/g) || []).length) pelanggaran.push("titik_titik_berubah");
  for (const isi of o.slot || []) if (isi && !h.includes(isi)) pelanggaran.push("slot_hilang");
  if (sidikKata(d, POLA_MODAL_NEGASI) !== sidikKata(h, POLA_MODAL_NEGASI)) pelanggaran.push("modal_negasi_berubah");
  if (/^iya\b/i.test(hPenuh)) pelanggaran.push("iya");
  for (const m of hPenuh.matchAll(/([A-Za-z]+), /g)) {
    const kata = m[1].toLowerCase();
    if (kata.endsWith("ya") && kata !== "ya" && kata !== "saya") {
      pelanggaran.push("kata_ya_koma");
      break;
    }
  }
  if (/(^|[.;,!?]\s*)(penggugat|tergugat|pemohon|termohon)\b/.test(hPenuh)) pelanggaran.push("sebutan_huruf_kecil");
  if (hitungKembar(h) > hitungKembar(d)) pelanggaran.push("kata_kembar");
  if (o.tetap && h.toLowerCase() !== d.toLowerCase()) pelanggaran.push("jawaban_tetap_disentuh");
  const diPutusan = tiruanReplaceKetSaksi(akhiriJawaban(hPenuh));
  if (/^Bahwa\s*[,;]|\s{2,}/.test(diPutusan)) pelanggaran.push("putusan_rusak");
  return { ok: pelanggaran.length === 0, pelanggaran };
}

/**
 * Pilihan berlawanan di jawaban templat - dipisah ';' atau <br>.
 *
 * "Saya pernah melihat ...;Saya tidak pernah melihat ..." bukan satu
 * jawaban melainkan dua kemungkinan yang harus dipilih petugas. Menyalin
 * keduanya ke berita acara membuat saksi seolah menyatakan dua hal yang
 * berlawanan sekaligus (27 jawaban lolos tanpa tanda pada ukuran 25 September
 * 2026). Bagian yang diawali '-' adalah butir daftar, bukan kemungkinan:
 * kalimatnya tetap satu, tetapi butirnya tetap ditawarkan sebagai pilihan.
 *
 * @returns {{jawab: string, pilihan: string[]}} pilihan kosong = bukan berpilihan
 */
function pecahPilihan(jawab) {
  const mentah = String(jawab || "").replace(/&nbsp;/gi, " ");
  const bagian = mentah
    .split(/\s*;\s*(?:<br\s*\/?>\s*)?|\s*<br\s*\/?>\s*/i)
    .map((x) => rapikanTeks(x))
    .filter(Boolean);
  if (bagian.length < 2) return { jawab: rapikanTeks(mentah), pilihan: [] };
  if (bagian.slice(1).every((b) => /^-/.test(b))) {
    return { jawab: bagian.join(" "), pilihan: bagian.slice(1).map((b) => b.replace(/^-\s*/, "")) };
  }
  return { jawab: bagian[0], pilihan: bagian };
}

/**
 * Sebutan pihak diganti penandanya, untuk dicocokkan dengan BENTUK.
 * Kata yang dipakai teksnya diingat, supaya "Pemohon" kembali "Pemohon".
 */
function kePenanda(teks, pihak) {
  const dipakai = { "#0046#": pihak.lawan || "Penggugat", "#0047#": pihak.pelaku || "Tergugat" };
  let t = String(teks);
  const ganti = (kata, penanda) => {
    if (!kata) return;
    const pola = new RegExp(`\\b${kata.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
    if (pola.test(t)) {
      dipakai[penanda] = kata;
      t = t.replace(pola, penanda);
    }
  };
  ganti(pihak.lawan, "#0046#");
  ganti(pihak.pelaku, "#0047#");
  for (const k of ["Penggugat", "Pemohon"]) ganti(k, "#0046#");
  for (const k of ["Tergugat", "Termohon"]) ganti(k, "#0047#");
  return { teks: t, dipakai };
}

function dariPenanda(teks, dipakai) {
  return String(teks).split("#0046#").join(dipakai["#0046#"]).split("#0047#").join(dipakai["#0047#"]);
}

/** Pola per bunyi bentuk, disinggahkan: bunyinya teks polos yang sama di tiap panggilan. */
const SINGGAHAN_POLA_BENTUK = new Map();
function polaBentuk(nilai) {
  const kunci = String(nilai);
  if (SINGGAHAN_POLA_BENTUK.has(kunci)) return SINGGAHAN_POLA_BENTUK.get(kunci);
  const bagianNilai = kunci.split("{slot}").map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pola = new RegExp(`^${bagianNilai.join("([^;]{1,200}?)")}$`, "i");
  if (SINGGAHAN_POLA_BENTUK.size < 2000) SINGGAHAN_POLA_BENTUK.set(kunci, pola);
  return pola;
}
const VERSI_BANK_TERTANAM = `tertanam-${require("./pemilihRagam").fnv1a32(JSON.stringify(ragamBawaan)).toString(16)}`;

function syaratCocok(syarat, perkara) {
  if (!syarat) return true;
  if (syarat.jenisPerkaraId !== undefined && String(syarat.jenisPerkaraId) !== String(perkara.jenisPerkara || "")) return false;
  if (syarat.alur !== undefined && String(syarat.alur) !== String(perkara.alur || "")) return false;
  return true;
}

/**
 * Kelompok BENTUK yang cocok dengan jawaban ini, beserta isi slotnya.
 * Yang dipilih bentuk PALING KHUSUS (literal terpanjang) - aturan yang sama
 * dengan penambang buktinya.
 */
function cocokBentuk(jawab, bank, pihak, perkara) {
  const { teks, dipakai } = kePenanda(tanpaAkhiran(jawab).replace(POLA_PEMBUKA_BUANG, ""), pihak);
  const normal = teks.charAt(0).toLowerCase() + teks.slice(1);
  let terbaik = null;
  for (const [kunci, kelompok] of bank.bentuk) {
    const layak = kelompok.filter((v) => syaratCocok(v.syarat, perkara));
    if (layak.length < 2) continue;
    for (const v of layak) {
      const m = normal.match(polaBentuk(v.nilai));
      if (!m) continue;
      const panjang = v.nilai.replace(/\{slot\}/g, "").length;
      if (!terbaik || panjang > terbaik.panjang) terbaik = { kunci, layak, slot: m.slice(1), panjang, dipakai };
    }
  }
  if (!terbaik) return null;
  const isiSlot = terbaik.slot;
  const varian = terbaik.layak.map((v) => {
    let i = 0;
    const isi = v.nilai.split("{slot}").reduce((acc, potong, k) => (k === 0 ? potong : acc + isiSlot[i++] + potong));
    return dariPenanda(isi, terbaik.dipakai);
  });
  return { kunci: terbaik.kunci, varian, slot: isiSlot.map((x) => dariPenanda(x, terbaik.dipakai)) };
}

/** Cadangan tanpa BENTUK: bentuk-bentuk dari RAGAM_KATA yang berlaku pada jawaban. */
function varianRagamKata(teks, bank) {
  const berlaku = bank.ragamKata.filter((r) => teks.search(r.pola) >= 0);
  const hasil = [teks];
  for (const r of berlaku) hasil.push(teks.replace(r.pola, r.ganti));
  if (berlaku.length > 1) hasil.push(berlaku.reduce((t, r) => t.replace(r.pola, r.ganti), teks));
  return [...new Set(hasil)];
}

/**
 * Pembuka menurut profil manusia, berbenih. Tidak pada pertanyaan rumusan
 * atau tetap, tidak di depan negasi, tidak di depan kalimat yang sudah
 * menyatakan sejauh mana saksi tahu, dan tidak di depan kata yang tidak boleh
 * dikecilkan (nama, sebutan).
 */
const AWAL_BOLEH_DIKECILKAN = new Set(ragamBawaan.AWAL_BOLEH_DIKECILKAN);
const POLA_SEBUTAN_AWAL = /^(Penggugat|Tergugat|Pemohon|Termohon)$/;
function pilihPembuka(teks, jenis, benih, bank) {
  if (jenis === "rumusan" || jenis === "tetap") return "";
  const kata = (String(teks).match(/^[A-Za-z]+/) || [""])[0];
  // Sebutan pihak boleh didahului pembuka ("Ya, Penggugat dan Tergugat ...")
  // - hurufnya TIDAK dikecilkan. Nama dan kata lain yang tak dikenal tidak.
  if (!AWAL_BOLEH_DIKECILKAN.has(kata.toLowerCase()) && !POLA_SEBUTAN_AWAL.test(kata)) return "";
  if (POLA_SUDAH_BERPEMBUKA.test(teks) || /^(sudah|cukup|tidak ada)\b/i.test(teks)) return "";
  // Butir 27: "Ya, saya tidak menyaksikannya sendiri" dan "Sepengetahuan
  // saya, saya tidak tahu ..." - pembuka tidak dipasang di depan jawaban yang
  // dibuka penyangkal (jawaban modus tidak-melihat/tahu-pisah).
  // Cerminnya di portal: ragam-jawaban.ts POLA_AWAL_MENYANGKAL.
  if (/^(?:\S+\s+){0,2}(?:tidak|belum|bukan|tak)\b/i.test(String(teks))) return "";
  if (String(teks).split(" ").length < 3) return "";
  const u = pemilih.angka01(`${benih}|pembuka`) * 100;
  let kumulatif = 0;
  for (const p of bank.pembuka) {
    kumulatif += p.bobot;
    if (u < kumulatif) return p.nilai;
  }
  return "";
}

/**
 * Alasan yang diucapkan saksi - bukan label kuncinya.
 *
 * "pihak lain (wanita/pria idaman lain)" adalah KUNCI pilihan, bukan kalimat
 * saksi. Kini tiap ciri diucapkan dengan frasanya (bersama.alasan.frasa) atau
 * salah satu bunyi setaranya, bersubjek pelaku (0047): "Tergugat tidak
 * memberikan nafkah dan suka mabuk". Ciri akibat (perselisihan) tidak ikut -
 * ia akibat, bukan penyebab perselisihan. Ciri tanpa frasa diucapkan dengan
 * labelnya, tanpa kurung dan garis miring.
 */
/**
 * Ucapan ciri lama ditambah sebab kamus sebab-cerai (W49 22 Okt):
 *   "Tergugat melalaikan kewajiban nafkah lahir, selain itu Tergugat kurang
 *    memberikan perhatian dan kasih sayang kepada Penggugat".
 * Sebab yang bunyinya sudah ada di ucapan ciri tidak diulang. Cerai talak:
 * sebab bersubjek Termohon tentang nafkah lahir memang tidak ada di kamus.
 */
function gabungUcapanSebab(daftarCiri, butir, pihak) {
  const awal = String(daftarCiri || "").trim();
  const kecil = awal.toLowerCase();
  const sisa = (butir || [])
    .filter((b) => b && b.frasa && !kecil.includes(String(b.frasa).toLowerCase()))
    .slice()
    .sort((a, b) => (a.urutan || 0) - (b.urutan || 0));
  if (!sisa.length) return awal;
  const tambah = sebabCerai.susun(sisa);
  if (!tambah) return awal;
  return awal ? `${awal}, selain itu ${tambah}` : tambah;
}

function daftarUcapan(alasan, pihak, peta, pilih) {
  const pelaku = pihak.pelaku || "Tergugat";
  const lawan = pihak.lawan || "Penggugat";
  const perbuatan = [];
  const lepas = [];
  for (const kunci of alasan) {
    const aturan = Object.prototype.hasOwnProperty.call(peta, kunci) ? peta[kunci] : null;
    if (aturan && aturan.akibat) continue;
    if (aturan) {
      const semua = [aturan.frasa, ...(Array.isArray(aturan.setara) ? aturan.setara : [])];
      const bersih = semua.filter((f) => !/[()/]/.test(f));
      const f = pilih(bersih.length ? bersih : [aturan.frasa], kunci);
      perbuatan.push({ urutan: aturan.urutan, teks: String(f).split("{pelaku}").join(pelaku).split("{lawan}").join(lawan) });
    } else {
      const label = String(kunci).replace(/\s*\([^)]*\)/g, "").replace(/\s*\/\s*/g, " atau ").trim();
      if (label && !lepas.includes(label)) lepas.push(label);
    }
  }
  perbuatan.sort((a, b) => a.urutan - b.urutan);
  const gabung = (xs) => (xs.length <= 1 ? xs[0] || "" : `${xs.slice(0, -1).join(", ")} dan ${xs[xs.length - 1]}`);
  // Perbuatan berpelaku dan alasan tanpa pelaku ("masalah ekonomi") dirangkai
  // dengan "serta" - bukan "dan" kedua, yang membuat "... dan telah menikah
  // lagi dan masalah ekonomi" terbaca sebagai satu daftar perbuatan.
  if (perbuatan.length && lepas.length) {
    return `${pelaku} ${gabung(perbuatan.map((p) => p.teks))}, serta ${gabung(lepas)}`;
  }
  const bagianDaftar = [];
  if (perbuatan.length) bagianDaftar.push(`${pelaku} ${gabung(perbuatan.map((p) => p.teks))}`);
  bagianDaftar.push(...lepas);
  return gabung(bagianDaftar);
}

/**
 * Alasan yang didalilkan gugatan, dibaca dari positanya dengan
 * CIRI_ALASAN_SDG - baris deteksi yang belum diukur terhadap BAS petugas
 * tidak ikut (lihat catatannya di bawah CIRI_ALASAN).
 *
 * Dipakai saat petugas memilih "sama dengan gugatan": jawaban saksi tentang
 * penyebab hanya boleh memuat alasan yang memang didalilkan.
 */
function alasanDariPosita(posita) {
  segarkanCiriAlasan(); // P1-P3-S6 10 Okt
  return ciriDariKalimat(kalimatPosita(posita), CIRI_ALASAN_SDG);
}

/**
 * Menyusun keterangan saksi 1 dan 2 dari templat pertanyaan ABT.
 *
 * @param {{templat: Array<{no,tanya,jawab}>, alasan?: string[], posita?: string}} opsi
 *   templat  baris pertanyaan-jawaban hasil load_template ABT, variabelnya
 *            SUDAH terganti oleh ABT
 *   alasan   ciri alasan yang didalilkan (kunci CIRI_ALASAN); bila kosong dan
 *            posita ada, diturunkan dari posita ("sama dengan gugatan")
 */
/**
 * ============================================================================
 * MODUS KETERANGAN TIAP SAKSI - SEBAB DUA SAKSI JARANG TAHU HAL YANG SAMA
 * ============================================================================
 *
 * Bentuk lamanya mengandaikan kedua saksi mengetahui SELURUH alasan yang
 * didalilkan dan melihatnya sendiri. Di persidangan yang sungguhan tidak
 * begitu: tetangga melihat pertengkarannya tetapi tidak tahu sebabnya; orang
 * tua tahu sebabnya dari cerita anaknya tetapi tidak pernah menyaksikan;
 * saudara hanya tahu keduanya sudah pisah rumah. Keterangan yang menyamakan
 * semuanya bukan hanya tidak wajar - ia dapat dipatahkan lawan dengan satu
 * pertanyaan.
 *
 * Maka tiap saksi punya MODUSNYA sendiri, dan tiap modus menjawab tiga
 * kelompok pertanyaan dengan caranya:
 *
 *   sama          tahu seluruh alasan yang didalilkan, melihat sendiri
 *   sebagian      hanya sebagian alasan yang ia ketahui - disebut mana saja
 *   tidak-tahu    tahu mereka berselisih dan berpisah, tidak tahu sebabnya
 *   tidak-melihat tidak pernah menyaksikan pertengkaran; tahu pisahnya saja
 *   dari-cerita   tahu sebabnya dari CERITA salah satu pihak, bukan melihat
 *
 * Tiga kelompok pertanyaannya dikenali dari kata kuncinya:
 *
 *   penyebab      "penyebab", "sebab", "alasan"
 *   menyaksikan   "melihat", "mendengar", "berapa kali", "menyaksikan"
 *   cara tahu     "bagaimana ... mengetahui", "dari mana ... tahu"
 *
 * Pertanyaan lain (kenal, hubungan, tempat tinggal, pisah, rukun) dibiarkan
 * memakai jawaban templat - modus tidak mengubah FAKTA yang sama bagi kedua
 * saksi, hanya apa yang masing-masing saksi ketahui dan bagaimana ia tahu.
 */
/**
 * "tahu-pisah" ditambahkan 16 September 2026 atas permintaan pengguna.
 *
 * Bedanya dengan "tidak-tahu" halus tetapi menentukan di persidangan:
 *
 *   tidak-tahu   saksi TAHU mereka berselisih dan berpisah, hanya tidak tahu
 *                apa sebabnya;
 *   tahu-pisah   saksi tidak pernah tahu ada pertengkaran sama sekali - yang
 *                ia ketahui hanya bahwa keduanya sudah tidak serumah.
 *
 * Saksi yang kedua itu nyata dan sering: saudara atau tetangga yang baru
 * pindah, yang hanya menyaksikan salah satunya pulang ke rumah orang tuanya.
 * Menyusun keterangannya seolah ia tahu pertengkaran membuatnya patah oleh
 * satu pertanyaan silang.
 */
/* === SAKSI-N 12 Okt === */
/** Saksi yang dilayani penyusun per pihak (cermin BATAS_SAKSI_SDG di ekstensi-sipp/abt.js dan PENANDA_SAKSI di portal). */
const BATAS_SAKSI_SDG = Object.freeze({ P: 5, T: 4 });
/* === AKHIR SAKSI-N === */
const MODUS_SAKSI = new Set([
  "sama",
  "sebagian",
  "tidak-tahu",
  "tidak-melihat",
  "dari-cerita",
  "tahu-pisah",
  // 20 Okt 2026 (U1): mendengar sendiri pertengkaran tanpa melihat, dan ragu/kurang ingat.
  "mendengar",
  "ragu",
]);

/**
 * Nama pihak yang bercerita.
 *
 * ============================================================================
 * NAMA YANG DIKIRIM MENANG ATAS KODENYA
 * ============================================================================
 *
 * Kode "pelaku"/"lawan" pernah berarti dua hal yang berlawanan: di panel SDG
 * ia menyebut Penggugat dan Tergugat, di bot ia menyebut ruas muatan yang
 * artinya justru terbalik. Selama artinya bergantung versi ekstensi yang
 * sedang terpasang, tidak ada jawaban yang benar untuk semua orang.
 *
 * Karena itu ekstensi kini mengirim sebutannya apa adanya, dan jalur kode di
 * bawah tinggal cadangan bagi ekstensi lama - yang muatannya memang tertukar,
 * sehingga pemetaan lamanya tetap benar BAGINYA. Jangan "dibetulkan":
 * membetulkannya justru mematahkan ekstensi lama.
 */
function sebutanSumberCerita(m, pelaku, lawan) {
  const nama = String((m && m.sumberNama) || "").trim();
  if (nama) return nama;

  const k = String((m && m.sumber) || "").toLowerCase();
  if (k === "keluarga") return "keluarga mereka";
  if (k === "lawan") return lawan || "Tergugat";
  return pelaku || "Penggugat";
}

/** Jawaban modus untuk tiga kelompok pertanyaan. Pola bervariasi per saksi. */
/**
 * ============================================================================
 * SATU MODUS, BEBERAPA BENTUK KALIMAT
 * ============================================================================
 *
 * Tiap keadaan dahulu punya TEPAT DUA bunyi - satu untuk saksi pertama, satu
 * untuk saksi kedua. Di dalam satu berita acara itu cukup; di seluruh register
 * tidak. Perkara kedua puluh memakai kalimat yang sama persis dengan perkara
 * pertama, dan berita acara yang berbunyi sama kata demi kata pada dua puluh
 * perkara berbeda tidak lagi terbaca sebagai keterangan saksi.
 *
 * Yang dipilih ditentukan nomor saksi DAN urutan pertanyaannya - bukan diacak.
 * Acak berarti menyusun ulang berkas yang sama menghasilkan berita acara yang
 * berbeda, dan petugas yang mencetak dua kali akan memegang dua naskah yang
 * tidak sama tanpa tahu mana yang dipakai.
 *
 * Bentuk-bentuk dalam satu bank harus SETARA maknanya. Yang berbeda cara
 * mengatakannya, bukan apa yang dikatakan - keterangan saksi bukan tempat
 * mengarang isi.
 */
function ragamModus(bentuk, nomorSaksi, urutan) {
  if (!Array.isArray(bentuk) || bentuk.length === 0) return null;
  const geser = (nomorSaksi === 2 ? 1 : 0) + (Number(urutan) || 0);
  return bentuk[geser % bentuk.length];
}

/**
 * Jawaban templat (sudah diisi dari gugatan) untuk dipasang di {jawab} bank
 * modus: tanpa tanda baca akhir, tanpa pembuka "Ya, ", huruf pertama
 * dikecilkan bila kata pertamanya boleh dikecilkan (bukan sebutan/nama).
 * Kosong menjadi "..." - faktanya ditunggu, kalimat modusnya tetap utuh.
 */
function jawabDalamBingkai(jawab) {
  let t = tanpaAkhiran(String(jawab || "")).replace(/^(ya|iya|benar|betul)\b\s*,?\s*/i, "");
  if (!t || jawabanKosong(t)) return "...";
  const kata = (t.match(/^[A-Za-z]+/) || [""])[0].toLowerCase();
  if (ragamBawaan.AWAL_BOLEH_DIKECILKAN.includes(kata)) t = t.charAt(0).toLowerCase() + t.slice(1);
  return t;
}

/**
 * @param a.jawab       (pilihan) jawaban templat yang sudah diisi dari gugatan -
 *                      isi penanda {jawab} pada bank waktu|... dan kehidupan|...
 * @param a.daftar      (pilihan) alasan yang sudah diucapkan (daftarUcapan);
 *                      tanpa ini alasan digabung apa adanya - bentuk lama
 * @param a.bank        (pilihan) bank jawaban-modus efektif; bawaan bila tidak ada
 * @param a.pilihBentuk (pilihan) (bentuk[], kunciBank) -> kalimat; bila tidak
 *                      ada, ragamModus lama (nomor saksi + urutan)
 */
function jawabMenurutModus({ tanya, modus, alasan, sumber, nomorSaksi, urutan, daftar: daftarUcap, bank, pilihBentuk, jawab }) {
  const daftar = typeof daftarUcap === "string" ? daftarUcap : (alasan || []).join(nomorSaksi === 2 ? " serta " : " dan ");
  const isi = daftar || "perselisihan yang terus-menerus";
  const sumber_ = String(sumber || "");
  const isiJawab = jawabDalamBingkai(jawab);
  const bankEfektif = bank || ragamBawaan.JAWABAN_MODUS;
  // Bank kalimat per 'kelompok|modus'; penanda diisi. Bank yang kosong
  // (dimatikan di pengaturan) berarti modus tidak menjawab - templat bicara.
  const pilih = (kunci) => {
    const bentuk = (bankEfektif[kunci] || []).map((t) =>
      t
        .split("{sumber}")
        .join(sumber_)
        .split("{daftar}")
        .join(daftar)
        .split("{isi}")
        .join(isi)
        .split("{jawab}")
        .join(isiJawab)
    );
    if (!bentuk.length) return null;
    return pilihBentuk ? pilihBentuk(bentuk, kunci) : ragamModus(bentuk, nomorSaksi, urutan);
  };

  // Modus hanya bicara tentang PERSELISIHAN rumah tangga. "Apakah saudara
  // mengetahui alasan Pemohon mau berpoligami?", "apa sebab ia meninggal",
  // dan "pernahkah saudara mendengar ada pihak lain yang keberatan atas
  // pernikahan ..." memuat kata pemicu yang sama, dan sampai 25 September
  // 2026 dijawab "mereka berselisih karena ..." atau "saya tidak pernah
  // menyaksikan pertengkaran mereka" - keterangan tentang hal yang tidak
  // ditanyakan. Tanpa kata perselisihan di pertanyaannya, templat yang bicara.
  // "penyebab" ikut: "Bagaimana saudara mengetahui penyebab itu?" merujuk
  // pertanyaan perselisihan sebelumnya.
  if (!/selisih|tengkar|cekcok|ribut|masalah|rumah tangga|pisah|cerai|rukun|damai|sanggup|penyebab/i.test(tanya)) return null;

  // CARA TAHU diperiksa PALING DULU. "Bagaimana saudara mengetahui penyebab
  // perselisihan itu?" memuat kata "penyebab" juga - tetapi ia bertanya
  // BAGAIMANA saksi tahu, bukan APA sebabnya. Diperiksa belakangan, ia akan
  // dijawab sebagai pertanyaan penyebab, dan saksi yang "tidak pernah
  // menyaksikan" mendadak mengaku "melihat sendiri".
  // 30 Okt (G2a): kata utuh. "Bagaimana sikap Tergugat ... menurut yang Saudara ketahui?" memuat "ketahui" (berisi
  // "tahu") tetapi bertanya SIKAP pihak, bukan cara saksi tahu; dulu dijawab "saya melihat langsung dengan mata kepala
  // saya sendiri" dan ditandai terisi dari data.
  if (/bagaimana .*\b(mengetahui|tahu)\b|dari mana .*\b(tahu|mengetahui)\b/i.test(tanya)) {
    if (modus === "dari-cerita") return pilih("cara-tahu|dari-cerita");
    if (modus === "tidak-melihat") return pilih("cara-tahu|tidak-melihat");
    // Butir 27: dahulu tidak-tahu jatuh ke templat ("saya mengetahui karena
    // ... melihat") dan tahu-pisah ke "saya melihat sendiri" - keduanya
    // mengaku tahu penyebab yang menurut modusnya tidak diketahui.
    if (modus === "tidak-tahu") return pilih("cara-tahu|tidak-tahu");
    if (modus === "tahu-pisah") return pilih("cara-tahu|tahu-pisah");
    if (modus === "mendengar") return pilih("cara-tahu|mendengar");
    if (modus === "ragu") return pilih("cara-tahu|ragu");
    return pilih("cara-tahu|sama");
  }

  // Butir 27 - "kapan mulai terjadi perselisihan", "puncak perselisihan", dan
  // "bagaimana kehidupan rumah tangga". Templatnya ditulis untuk saksi yang
  // melihat sendiri; saksi yang tidak melihat menyampaikannya dari cerita,
  // dan saksi yang hanya tahu pisahnya tidak mengetahuinya sama sekali.
  const tanyaWaktu =
    /kapan .*(selisih|tengkar)|(selisih|tengkar).*kapan|puncak/i.test(tanya) && !/melihat|mendengar|menyaksikan/i.test(tanya);
  const tanyaKehidupan =
    /(keadaan|kehidupan|kondisi) rumah tangga|bagaimana rumah tangga/i.test(tanya) && !/setelah menikah/i.test(tanya);
  if (tanyaWaktu || tanyaKehidupan) {
    const kelompok = tanyaWaktu ? "waktu" : "kehidupan";
    if (modus === "tidak-melihat" || modus === "dari-cerita" || modus === "tahu-pisah" || modus === "ragu") return pilih(`${kelompok}|${modus}`);
    return null; // sama / mendengar / sebagian / tidak-tahu: saksi mengalaminya, templat tepat
  }

  // Saksi yang hanya tahu pisahnya: tidak satu pun pertanyaan tentang
  // pertengkaran boleh dijawab seolah ia menyaksikannya.
  if (modus === "tahu-pisah") {
    if (/penyebab|sebab|alasan/i.test(tanya)) return pilih("penyebab|tahu-pisah");
    if (/melihat|mendengar|menyaksikan|berapa kali/i.test(tanya)) return pilih("menyaksikan|tahu-pisah");
    // "Apakah saudara tahu jika ... biasa bertengkar?", "Apakah Tergugat pernah
    // memukul ... dan suka marah-marah biasa bertengkar?" (templat A2) - dahulu
    // dijawab "saya tahu kalau ... biasa bertengkar" (butir 27).
    if (/tengkar|selisih|cekcok|ribut|memukul|kekerasan/i.test(tanya) && !/sanggup|rukun|damai/i.test(tanya)) {
      return pilih("menyaksikan|tahu-pisah");
    }
    // "Apakah ... pernah diupayakan untuk rukun kembali?" bukan pertanyaan
    // SANGGUP - dahulu dijawab "saya tidak sanggup mendamaikan" (butir 27).
    // Upaya rukun dijawab dari datanya (variabel 1268, posita, mediasi).
    if (/sanggup/i.test(tanya) || (/rukun|damai|mendamaikan/i.test(tanya) && !POLA_TANYA_UPAYA_RUKUN.test(tanya))) {
      return pilih("rukun|tahu-pisah");
    }
    // Pertanyaan tentang pisah rumah TIDAK dijawab di sini - itu justru yang
    // diketahui saksi ini, dan templatnya sudah tepat.
  }

  if (/penyebab|sebab|alasan/i.test(tanya)) {
    if (modus === "tidak-tahu" || modus === "tidak-melihat") return pilih("penyebab|tidak-tahu");
    if (modus === "dari-cerita") return pilih("penyebab|dari-cerita");
    if (modus === "ragu") return pilih("penyebab|ragu");
    // Tanpa satu pun alasan yang dapat diucapkan (mis. hanya "perselisihan",
    // yang akibat, bukan penyebab) kalimat "penyebabnya adalah " tidak boleh
    // terbit kosong - templat yang bicara, dan titik-titiknya tetap terlihat.
    if (!daftar) return null;
    if (modus === "mendengar") return pilih("penyebab|mendengar");
    if (modus === "sebagian") return pilih("penyebab|sebagian");
    return pilih("penyebab|sama");
  }

  if (/melihat|mendengar|menyaksikan|berapa kali/i.test(tanya)) {
    if (modus === "tidak-melihat" || modus === "dari-cerita") return pilih("menyaksikan|tidak-melihat");
    if (modus === "tidak-tahu") return pilih("menyaksikan|tidak-tahu");
    if (modus === "mendengar") return pilih("menyaksikan|mendengar");
    if (modus === "ragu") return pilih("menyaksikan|ragu");
    return null; // sama / sebagian: jawaban templat sudah tepat
  }

  return null;
}

/**
 * ============================================================================
 * FAKTA POSITA DIBACA PER PERISTIWA, BUKAN PER KATA PERTAMA (butir 24)
 * ============================================================================
 *
 * Sampai 5 Oktober 2026 tiap fakta diambil dari kalimat PERTAMA yang memuat
 * satu kata - "selisih", "pisah", "meninggalkan" - lalu tanggal atau angka
 * apa pun di kalimat itu dipakai. Pada posita satker kalimat pertama yang
 * memuat "pisah" hampir selalu riwayat tempat tinggal: "tinggal di rumah
 * orang tua Penggugat selama 2 tahun, setelah itu ... hingga pisah rumah".
 * Akibatnya "2 tahun" - lama MENUMPANG, bukan lama berpisah - masuk ke
 * berita acara (13 dari 30 sampel salah), dan tanggal pisah rumah kosong pada
 * enam dari sepuluh perkara karena kalimat itu tidak bertanggal.
 *
 * Kini tiap fakta dibaca dari PERISTIWANYA:
 *   awal konflik  kata konflik (juga keretakan, tidak harmonis, goyah,
 *                 cekcok) + waktu, di bagian kalimat SEBELUM puncak/sehingga/
 *                 penyebab - tanggal puncak dan tanggal di dalam penyebab
 *                 bukan awal perselisihan;
 *   pisah sejak   waktu yang menempel pada peristiwa pisah/pergi (tanpa kata
 *                 konflik dan tanpa riwayat tinggal/nikah di antaranya);
 *   lama pisah    angka SESUDAH kata pisahnya yang didahului "selama/kurang
 *                 lebih/sudah", atau sebelum kata pisahnya tanpa kata
 *                 "tinggal" di sekitarnya; bila hanya ada tanggalnya, dihitung
 *                 sampai tanggal sidang (lamaPisahDihitung);
 *   siapa pergi   subjek kata kerjanya (pergi, meninggalkan rumah, pulang ke
 *                 rumah orang tua, keluar dari rumah) atau objek pengusiran
 *                 ("mengusir Penggugat", "Penggugat diusir"); bila dua sisi
 *                 sama-sama tersebut, kosong;
 *   penyebab      teks sesudah "disebabkan/karena" pada kalimat perselisihan,
 *                 atau butir-butir daftar sesudah "disebabkan karena :".
 *
 * Yang ragu tetap kosong. Angka ukurnya atas 4.572 posita cerai PA Donggala
 * tertulis di pesan commit butir 24.
 */
const POLA_NAMA_BULAN = `(?:${BULAN.join("|")}|Pebruari|Nopember)`;

function namaBulanBaku(nama) {
  const k = String(nama || "").toLowerCase();
  if (k === "pebruari") return "Februari";
  if (k === "nopember") return "November";
  return BULAN.find((b) => b.toLowerCase() === k) || String(nama || "");
}

// Tanggal nikah, akta, dan kelahiran bukan tanggal peristiwa rumah tangga.
const POLA_KONTEKS_TANGGAL_LAIN =
  /(?:nikah|menikah|pernikahan|perkawinan|kawin|akad|tertanggal|lahir|dilahirkan|kelahiran)\W+(?:(?:pada|sejak)\s+)?(?:(?:hari\s+\w+\s*,?\s*)?(?:tanggal|tgl\.?)\s+)?(?:\d{1,2}\s+)?$/i;
const POLA_AWAL_NIKAH = /\bawal\s+(?:pernikahan|perkawinan|menikah|berumah\s+tangga)\W+$/i;

/**
 * Seluruh penyebutan waktu di sepotong kalimat, dengan letaknya.
 * @returns {Array<{indeks:number, ujung:number, nilai:string, presisi:string}>}
 *   presisi "bulan" hanya untuk bulan+tahun utuh - satu-satunya yang boleh
 *   dihitung lamanya.
 */
function waktuPosita(teks) {
  const t = String(teks || "");
  const hasil = [];
  const tahunSah = (y) => Number(y) >= 1950 && Number(y) <= 2100;
  const tambah = (indeks, ujung, nilai, presisi) => {
    if (hasil.some((w) => indeks < w.ujung && ujung > w.indeks)) return;
    const depan = t.slice(Math.max(0, indeks - 45), indeks);
    // "sejak awal pernikahan tahun 2015" - waktu itu awal perselisihannya.
    if (POLA_KONTEKS_TANGGAL_LAIN.test(depan) && !POLA_AWAL_NIKAH.test(depan)) return;
    // "Nomor 9 Tahun 1975", "Nomor 1 Tahun 2022" - tahun peraturan.
    if (/\b(?:nomor|no\.?)\s*:?\s*[\w./-]+\s*$/i.test(depan)) return;
    hasil.push({ indeks, ujung, nilai, presisi });
  };
  for (const m of t.matchAll(new RegExp(`\\b(awal|akhir|pertengahan)\\s+(?:bulan\\s+)?(${POLA_NAMA_BULAN})\\s*,?\\s+(?:tahun\\s+)?(\\d{4})\\b`, "gi"))) {
    if (tahunSah(m[3])) tambah(m.index, m.index + m[0].length, `${m[1].toLowerCase()} bulan ${namaBulanBaku(m[2])} ${m[3]}`, "bagian-bulan");
  }
  for (const m of t.matchAll(new RegExp(`\\b(?:(?:tanggal|tgl\\.?)\\s+)?(?:\\d{1,2}\\s+)?(?:bulan\\s+)?(${POLA_NAMA_BULAN})\\s*,?\\s+(?:tahun\\s+)?(\\d{4})\\b`, "gi"))) {
    if (tahunSah(m[2])) tambah(m.index, m.index + m[0].length, `bulan ${namaBulanBaku(m[1])} ${m[2]}`, "bulan");
  }
  for (const m of t.matchAll(/\b(awal|akhir|pertengahan)\s+(?:tahun\s+)?(\d{4})\b/gi)) {
    if (tahunSah(m[2])) tambah(m.index, m.index + m[0].length, `${m[1].toLowerCase()} tahun ${m[2]}`, "bagian-tahun");
  }
  for (const m of t.matchAll(/\b(?:tahun|taun|sejak|pada|mulai|semenjak|sekitar|sekitaran)\s+(\d{4})\b/gi)) {
    if (tahunSah(m[1])) tambah(m.index, m.index + m[0].length, `tahun ${m[1]}`, "tahun");
  }
  return hasil.sort((a, b) => a.indeks - b.indeks);
}

// Kata konflik di posita. "masalah" hanya dalam bentuk peristiwa ("mulai ada
// masalah", "bermasalah") - "masalah ekonomi" saja bukan awal perselisihan.
const POLA_KONFLIK_POSITA =
  /(selisih|tengkar|cekcok|percekcokan|keretakan|keributan|ribut|tidak\s+(?:lagi\s+)?harmonis|ketidak\s*harmonisan|tidak\s+(?:lagi\s+)?rukun|tidak\s+(?:lagi\s+)?(?:tenteram|tentram)|goyah|bermasalah|(?:mulai|terjadi|timbul|muncul|ada)\s+(?:(?:banyak|sebuah|suatu)\s+)?(?:masalah|permasalahan|konflik))/i;
// "kembali terjadi perselisihan" - pengulangan, bukan awalnya.
const POLA_KONFLIK_ULANG = /\b(?:kembali|lagi)\s+(?:terjadi\s+)?(?:perselisihan|pertengkaran|bertengkar|berselisih|cekcok|ribut)/i;
// Awal konflik dibaca SEBELUM puncaknya, akibatnya, dan penyebabnya.
const POLA_BATAS_AWAL_KONFLIK =
  /\b(?:puncak\w*|memuncak|sehingga|mengakibatkan|akibat\w*|disebabkan|dikarenakan|karena|penyebab\w*)\b/i;

function awalKonflikPosita(butir) {
  for (const tuntutMulai of [true, false]) {
    for (const b of butir) {
      const depan = b.split(POLA_BATAS_AWAL_KONFLIK)[0];
      const k = depan.search(POLA_KONFLIK_POSITA);
      if (k < 0 || POLA_KONFLIK_ULANG.test(depan)) continue;
      if (tuntutMulai && !/\b(?:sejak|mulai|semenjak)\b/i.test(depan)) continue;
      // "pernah terjadi perselisihan namun pada tahun 2015, Tergugat pergi
      // meninggalkan Penggugat" - waktu yang langsung diikuti kepergian
      // adalah tanggal pisahnya, bukan awal perselisihan.
      const pergi = peristiwaPisah(depan);
      const waktu = waktuPosita(depan).filter((w) => !pergi.some((ev) => ev.indeks >= w.ujung && ev.indeks - w.ujung <= 60));
      if (!waktu.length) continue;
      const terdekat = waktu.reduce((a, w) => (Math.abs(w.indeks - k) < Math.abs(a.indeks - k) ? w : a));
      return { nilai: terdekat.nilai, kalimat: b };
    }
  }
  return { nilai: "", kalimat: "" };
}

/** "tergugat" -> "Tergugat"; huruf pertama dikecilkan kecuali sebutan/singkatan. */
function rapikanPenyebab(teks) {
  let t = String(teks || "")
    .replace(/^\s*(?:[a-z]|\d{1,2})[.)]\s+/i, "")
    // "1 Tergugat berselingkuh ..." - nomor daftar tanpa titik (butir 14).
    .replace(/^\s*\d{1,2}\s+(?=[A-Z])/, "")
    .replace(/^[\s\-–•:,]+/, "")
    .replace(/[\s.;,:]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  t = t.replace(/\b(penggugat|tergugat|pemohon|termohon)\b/gi, (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase());
  const kata = (t.match(/^\S+/) || [""])[0];
  if (kata && !/^(Penggugat|Tergugat|Pemohon|Termohon)$/.test(kata) && kata !== kata.toUpperCase()) {
    t = t.charAt(0).toLowerCase() + t.slice(1);
  }
  return t;
}

const POLA_TANDA_SEBAB = /\b(?:di\s*sebabkan|dikarenakan|penyebab(?:nya)?|oleh\s+karena|karena|akibat)\b/gi;
const POLA_PEMBUKA_DAFTAR_SEBAB =
  /^(?:\s|:|,|-|karena|oleh|adalah|yaitu|antara\s+lain|hal[- ]hal|beberapa\s+hal|sebagai\s+berikut|berikut(?:\s+ini)?|faktor[- ]faktor|di\s*antaranya)+/i;
// Butir sesudah daftar penyebab yang bukan lagi penyebab.
const POLA_BUKAN_BUTIR_SEBAB =
  /^(?:puncak|atas\s|berdasarkan|sejak|pada\s|setelah|akibat|bahwa|keluarga|ikatan|dengan\s+(?:demikian|keadaan)|oleh\s+karena\s+itu|penggugat\s+(?:dan|dengan)\s+tergugat|pemohon\s+(?:dan|dengan)\s+termohon|perselisihan|pertengkaran|kehidupan|rumah\s+tangga|demikian|mengabulkan|primair|subsidair)/i;

// "sebab-sebab terjadinya perselisihan ... yakni:", "adapun penyebabnya adalah
// sebagai berikut:" - butir pendek yang hanya membuka daftar.
const POLA_KEPALA_DAFTAR_SEBAB =
  /^(?:adapun\s+)?(?:sebab|penyebab|alasan|faktor)[\w-]*\b[^:]{0,100}?(?:yakni|yaitu|adalah|antara\s+lain|sebagai\s+berikut|di\s*antaranya)?\s*:\s*$/i;

/** Butir daftar penyebab sesudah butir ke-i: sampai 4 butir, kira-kira 300 huruf. */
function butirDaftarSebab(butir, i) {
  const daftar = [];
  for (let j = i + 1; j < butir.length && daftar.length < 5; j++) {
    // Butir 14: baris lanjutan (huruf kecil, tanpa nomor) milik butir di atasnya -
    // posita yang disalin dari PDF memotong tiap butir daftar di tengah kalimat.
    // Butir berawalan "Bahwa" juga tampak huruf kecil (kalimatPosita membuang
    // "Bahwa"); baris lanjutan dibedakan: butir sebelumnya tidak berakhir
    // titik, dan baris ini tidak bertanggal (cerita baru, bukan lanjutan).
    if (
      daftar.length &&
      /^[a-z]/.test(butir[j]) &&
      !/^[a-z][.)]\s/.test(butir[j]) &&
      !/[.;]\s*$/.test(butir[j - 1]) &&
      !waktuPosita(butir[j]).length
    ) {
      const sambung = `${daftar[daftar.length - 1]} ${rapikanPenyebab(butir[j])}`;
      if (sambung.length > 220 || POLA_BUKAN_BUTIR_SEBAB.test(butir[j])) break;
      daftar[daftar.length - 1] = sambung;
      continue;
    }
    if (daftar.length >= 4) break;
    const item = rapikanPenyebab(butir[j]);
    if (!item || POLA_BUKAN_BUTIR_SEBAB.test(item) || item.length > 220 || waktuPosita(item).length) break;
    // Jawaban saksi, bukan salinan posita: sampai kira-kira 300 huruf.
    if (daftar.length && daftar.join(", ").length + item.length > 300) break;
    daftar.push(item);
  }
  return daftar;
}

/**
 * Merangkai butir penyebab. Butir pendek tanpa koma ("berjudi", "mabuk") tetap "A, B dan C". Butir berupa klausa utuh
 * (panjang, bersubjek, memuat koma) dirangkai dengan penyambung wajar supaya terbaca sebagai satu kalimat:
 * "A, selain itu B, dan C" (19 Okt 2026) - dahulu hanya ditempel koma sehingga klausa saling menempel.
 */
function gabungPenyebab(daftar) {
  const xs = (daftar || [])
    .flatMap((x) => String(x || "").split(/,\s+(?=(?:Penggugat|Tergugat|Pemohon|Termohon)\b)/))
    .map((x) => x.trim())
    .filter(Boolean);
  if (xs.length <= 1) return xs[0] || "";
  const klausa = xs.some((x) => x.length > 60 || /,/.test(x) || /\s(?:sehingga|karena|yang|hingga|sedangkan)\s/i.test(x));
  if (!klausa) return `${xs.slice(0, -1).join(", ")} dan ${xs[xs.length - 1]}`;
  // Dua butir tanpa koma sendiri cukup "A dan B"; koma di dalam salah satunya membuat "dan" tidak jelas batasnya.
  if (xs.length === 2) return xs.some((x) => /,/.test(x)) ?`${xs[0]}, selain itu ${xs[1]}` : `${xs[0]} dan ${xs[1]}`;
  return `${xs[0]}, selain itu ${xs.slice(1, -1).join(", ")}, dan ${xs[xs.length - 1]}`;
}

/** "A, Tergugat B, Tergugat C" (klausa yang masing-masing bersubjek) -> "A, selain itu Tergugat B, dan Tergugat C". */
function hubungkanKlausa(teks) {
  const bagian = String(teks || "")
    .split(/,\s+(?=(?:Penggugat|Tergugat|Pemohon|Termohon)\b)/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (bagian.length < 2) return String(teks || "");
  // Dua klausa yang salah satunya sudah memuat "dan": "A dan B dan C" kabur batasnya - dirangkai dengan "selain itu".
  if (bagian.length === 2 && bagian.some((x) => /\sdan\s/.test(x))) return `${bagian[0]}, selain itu ${bagian[1]}`;
  return gabungPenyebab(bagian);
}

/**
 * Penyebab perselisihan menurut posita: sisa kalimat sesudah "disebabkan/
 * karena" pada kalimat perselisihan, atau butir daftar sesudahnya. Tanpa
 * kalimat perselisihan yang menyebut sebabnya, kosong - penyebab tidak
 * disimpulkan dari kalimat lain.
 */
function penyebabPosita(butir) {
  for (let i = 0; i < butir.length; i++) {
    const b = butir[i];
    // Butir 14: kepala daftar "sebab-sebab terjadinya perselisihan Penggugat
    // dan Tergugat yakni:" - kata sebabnya mendahului kata perselisihannya,
    // jadi pencarian "konflik lalu tanda sebab" di bawah tidak menemukannya.
    if (POLA_KEPALA_DAFTAR_SEBAB.test(b)) {
      const daftar = butirDaftarSebab(butir, i);
      if (daftar.length) {
        const nilai = gabungPenyebab(daftar);
        return { nilai, kalimat: [b, ...butir.slice(i + 1, i + 1 + daftar.length)].join(" | ") };
      }
    }
    const k = b.search(POLA_KONFLIK_POSITA);
    if (k < 0 || /^\s*puncak/i.test(b)) continue;
    POLA_TANDA_SEBAB.lastIndex = 0;
    const tanda = [...b.matchAll(POLA_TANDA_SEBAB)].find((m) => m.index > k);
    if (!tanda) continue;
    let sisa = b.slice(tanda.index + tanda[0].length).replace(POLA_PEMBUKA_DAFTAR_SEBAB, "");
    sisa = sisa.split(/\b(?:sehingga|puncak\w*|yang\s+mengakibatkan|mengakibatkan|akibatnya)\b|\.\s/i)[0];
    if (rapikanPenyebab(sisa).length >= 10) {
      let t = rapikanPenyebab(sisa);
      // Butir 14: sebab yang panjang dipotong pada batas ceritanya ("hingga",
      // ", akibat ...", ", namun") - dahulu seluruhnya dibuang, dan perkara
      // itu tidak punya penyebab sama sekali.
      if (t.length > 220) {
        t = rapikanPenyebab(t.split(/\s+(?:hingga|sampai|namun|tetapi|akan\s+tetapi)\s+|,\s*(?:akibat|sehingga|namun|lalu|kemudian|dan\s+kemudian|hingga)\b/i)[0]);
      }
      if (t.length >= 10 && t.length <= 220) return { nilai: hubungkanKlausa(t), kalimat: b };
    }
    // "disebabkan karena :" - daftar di butir-butir berikutnya.
    const daftar = butirDaftarSebab(butir, i);
    if (!daftar.length) continue;
    const nilai = gabungPenyebab(daftar);
    return { nilai, kalimat: [b, ...butir.slice(i + 1, i + 1 + daftar.length)].join(" | ") };
  }
  return { nilai: "", kalimat: "" };
}

// Peristiwa pisah: kata pisah, atau pergi/meninggalkan rumah.
const POLA_PISAH_POSITA =
  /(?:(?:telah|sudah)\s+)?(?:pisah\s+(?:rumah|ranjang|tempat\s+tinggal|tempat\s+kediaman)|berpisah(?:\s+(?:rumah|ranjang|tempat\s+tinggal))?)|(?:telah|sudah)\s+pisah(?!\s+(?:kamar|tempat\s+tidur|tidur))|tidak\s+(?:lagi\s+)?(?:tinggal\s+bersama|hidup\s+bersama|serumah|satu\s+rumah|tinggal\s+serumah)/gi;
const POLA_TINGGALKAN_RUMAH =
  /(?:(?:pergi\s+)?meninggalkan\s+(?:rumah|tempat\s+(?:tinggal|kediaman)|kediaman|penggugat|tergugat|pemohon|termohon)|pergi\s+meninggalkan|pergi\s+ke\s+[^.;,]{3,40}?\s+(?:dan\s+)?(?:tidak|tak)\s+(?:pernah\s+)?(?:lagi\s+)?(?:kembali|pulang)|pergi\s+dari\s+rumah|keluar\s+dari\s+rumah|(?:pulang|kembali)\s+(?:lagi\s+)?ke\s*(?:rumah\s+)?(?:orang\s*tua|orangtua|keluarga|saudara|mertua)|di\s*usir|mengusir|memulangkan|dipulangkan|diantar(?:kan)?\s+pulang)/gi;
// Butir yang menceritakan kepergian yang BUKAN perpisahan: sudah rujuk
// kembali, atau pergi bekerja dengan pamit dan hubungan masih baik.
const POLA_RUJUK = /(rujuk|kembali\s+(?:lagi\s+)?menjalin|kembali\s+(?:hidup\s+|tinggal\s+)?(?:bersama|rukun|serumah)|berhasil\s+(?:untuk\s+)?(?:di)?(?:rukun|damai))/i;
// Pergi dengan baik-baik - hanya menolak butir yang TIDAK menyebut pisahnya.
const POLA_PERGI_BAIK =
  /(masih\s+(?:terjalin|berjalan|baik|harmonis|rukun|berkomunikasi)|datang\s+(?:untuk\s+)?mengunjungi|(?:izin|pamit|berpamitan)\b[^.;]{0,40}\b(?:bekerja|merantau|mengurus))/i;
// "masih tinggal bersama namun tidak lagi seranjang" - belum pisah tempat tinggal.
const POLA_MASIH_SERUMAH = /masih\s+(?:tinggal\s+)?(?:bersama|serumah|satu\s+rumah)|dalam\s+satu\s+rumah|walaupun\s+(?:masih\s+)?(?:serumah|satu\s+rumah)/i;
function bukanPerpisahan(b) {
  if (POLA_RUJUK.test(b) || POLA_MASIH_SERUMAH.test(b)) return true;
  POLA_PISAH_POSITA.lastIndex = 0;
  return POLA_PERGI_BAIK.test(b) && !POLA_PISAH_POSITA.test(b);
}
// Butir yang memang bercerita tentang perpisahannya - didahulukan atas butir
// yang hanya menyebut sekali pergi.
const POLA_KONTEKS_PISAH =
  /(pisah|puncak|sampai\s+(?:sekarang|saat\s+ini|kini)|hingga\s+(?:sekarang|saat\s+ini|kini)|sejak\s+saat\s+itu|tidak\s+(?:pernah\s+)?(?:lagi\s+)?(?:kembali|pulang)|tidak\s+(?:lagi\s+)?tinggal\s+bersama)/i;
// Yang tidak boleh berada di antara waktu dan peristiwa pisahnya.
const POLA_SELA_PISAH = /(nikah|kawin|tinggal\s+(?:bersama|di)|dikaruniai|karuniai|lahir)/i;

function peristiwaPisah(teks) {
  const hasil = [];
  for (const pola of [POLA_PISAH_POSITA, POLA_TINGGALKAN_RUMAH]) {
    pola.lastIndex = 0;
    for (const m of teks.matchAll(pola)) hasil.push({ indeks: m.index, ujung: m.index + m[0].length });
  }
  return hasil.sort((a, b) => a.indeks - b.indeks);
}

/** Butir pisah: yang berkonteks perpisahan lebih dulu, lalu sisanya. */
// Riwayat tempat tinggal ("setelah menikah ... tinggal di ... hingga pisah
// rumah") menyebut pisah tetapi tidak menceritakannya - dibaca paling akhir.
const POLA_RIWAYAT_TINGGAL = /(?:hingga|sampai)\s+(?:pisah|berpisah)|^(?:setelah|sesudah|selama)\s+(?:menikah|pernikahan|melangsungkan)/i;

/**
 * Butir pisah menurut urutan kepercayaan: kalimat puncak, lalu yang berkonteks
 * perpisahan, lalu sisanya, dan riwayat tempat tinggal paling akhir.
 */
function butirPisah(butir) {
  const ada = butir.filter((b) => peristiwaPisah(b).length && !bukanPerpisahan(b));
  const peringkat = (b) =>
    POLA_RIWAYAT_TINGGAL.test(b) ? 3 : /puncak/i.test(b) ? 0 : POLA_KONTEKS_PISAH.test(b) ? 1 : 2;
  return ada.map((b, i) => ({ b, i, p: peringkat(b) })).sort((x, y) => x.p - y.p || x.i - y.i).map((x) => x.b);
}

function pisahSejakPosita(butir) {
  for (const b of butirPisah(butir)) {
    for (const kal of b.split(/(?<=\.)\s+(?=[A-Z])/)) {
      const waktu = waktuPosita(kal);
      if (!waktu.length) continue;
      const peristiwa = peristiwaPisah(kal);
      // "puncak ... terjadi pada tanggal 08 Maret 2019, Tergugat memukul ...
      // dan sampai saat ini ... telah pisah rumah" - pada templat satker
      // tanggal puncak adalah hari perpisahannya, walau ceritanya panjang,
      // dan menang atas tanggal lain di tengah ceritanya.
      const puncak = kal.match(/puncak\w*[^.;]{0,140}?\bterjadi\b/i);
      if (puncak) {
        const ujungPuncak = puncak.index + puncak[0].length;
        const w = waktu.find((x) => x.indeks >= ujungPuncak && x.indeks - ujungPuncak <= 30);
        if (w && peristiwa.some((ev) => ev.indeks > w.ujung && !POLA_SELA_PISAH.test(kal.slice(w.ujung, ev.indeks)))) {
          return { nilai: w.nilai, presisi: w.presisi, kalimat: b };
        }
      }
      for (const ev of peristiwa) {
        // "pisah rumah sejak bulan Juni 2023", "pergi ... pada tanggal ..."
        const sesudah = waktu.find((w) => {
          if (w.indeks < ev.ujung || w.indeks - ev.ujung > 40) return false;
          const sela = kal.slice(ev.ujung, w.indeks);
          return !POLA_KONFLIK_POSITA.test(sela) && !POLA_SELA_PISAH.test(sela) && !/selama/i.test(sela);
        });
        if (sesudah) return { nilai: sesudah.nilai, presisi: sesudah.presisi, kalimat: b };
        // "pada bulan Agustus 2018 Tergugat pergi meninggalkan Penggugat"
        const sebelum = waktu.filter((w) => w.ujung <= ev.indeks).pop();
        if (sebelum) {
          const sela = kal.slice(sebelum.ujung, ev.indeks);
          if (sela.length <= 90 && !POLA_KONFLIK_POSITA.test(sela) && !POLA_SELA_PISAH.test(sela)) {
            return { nilai: sebelum.nilai, presisi: sebelum.presisi, kalimat: b };
          }
        }
      }
    }
  }
  return { nilai: "", presisi: "", kalimat: "" };
}

const SATUAN_LAMA = ["tahun", "bulan", "minggu", "hari"];
const POLA_SATU_LAMA = new RegExp(
  `(?:(\\d{1,2})\\s*(?:\\([^)]{1,30}\\)\\s*)?|\\b(${POLA_KATA_ANGKA})\\s*(?:\\((\\d{1,2})\\)\\s*)?|\\bse(?=(?:tahun|bulan|minggu|hari)\\b))(tahun|bulan|minggu|hari)\\b`,
  "gi"
);

/**
 * Rangkaian lama ("2 tahun 11 bulan", "empat (4) bulan", "setahun") pertama
 * di teks, atau null. Hari dan minggu hanya dipakai bila tidak ada tahun/bulan.
 */
function lamaDalam(teks) {
  const t = String(teks || "");
  POLA_SATU_LAMA.lastIndex = 0;
  const semua = [...t.matchAll(POLA_SATU_LAMA)].filter((m) => !/\d$/.test(t.slice(0, m.index)));
  if (!semua.length) return null;
  const rangkai = [semua[0]];
  for (let i = 1; i < semua.length; i++) {
    const sela = t.slice(rangkai[rangkai.length - 1].index + rangkai[rangkai.length - 1][0].length, semua[i].index);
    if (!/^\s*(?:dan\s+|lebih\s+)?$/i.test(sela)) break;
    rangkai.push(semua[i]);
  }
  const nilai = {};
  for (const m of rangkai) {
    const n = m[1] ? Number(m[1]) : m[3] ? Number(m[3]) : m[2] ? ANGKA_KATA[m[2].toLowerCase()] : 1;
    const satuan = m[4].toLowerCase();
    if (nilai[satuan] === undefined && n > 0) nilai[satuan] = n;
  }
  const pakai = nilai.tahun !== undefined || nilai.bulan !== undefined ? ["tahun", "bulan"] : ["minggu", "hari"];
  const teksLama = SATUAN_LAMA.filter((s) => pakai.includes(s) && nilai[s] !== undefined).map((s) => `${nilai[s]} ${s}`).join(" ");
  if (!teksLama) return null;
  const akhir = rangkai[rangkai.length - 1];
  return { nilai: teksLama, indeks: rangkai[0].index, ujung: akhir.index + akhir[0].length };
}

const POLA_PENANDA_LAMA = /(selama|kurang\s+lebih|lebih\s+kurang|lebih\s+dari|sekitar|kira-kira|hampir|±|\+\/-|sudah|telah|sampai\s+(?:sekarang|saat\s+ini)|hingga\s+(?:sekarang|saat\s+ini|kini))/i;
const POLA_BUKAN_LAMA_PISAH = /(tinggal|nikah|kawin|usia|umur|anak|lahir|kost|kontrak|bekerja|merantau|penjara|dihukum)/i;

function lamaPisahPosita(butir) {
  for (const b of butirPisah(butir)) {
    // "Hingga sekarang Penggugat tidak pernah kembali kurang lebih 3 tahun 6
    // bulan lamanya" - lama sesudah "tidak pernah kembali" juga lama pisah.
    const tidakKembali = [...b.matchAll(/tidak\s+(?:pernah\s+)?(?:lagi\s+)?(?:kembali|pulang)(?:\s+lagi)?/gi)].map((m) => ({
      indeks: m.index,
      ujung: m.index + m[0].length,
    }));
    for (const ev of [...peristiwaPisah(b), ...tidakKembali]) {
      // Sesudah kata pisahnya: "pisah rumah selama kurang lebih 2 tahun".
      const jendela = b.slice(ev.ujung, ev.ujung + 90).split(/[.;](?:\s|$)|\b(?:usia|umur|dikaruniai|karuniai)\b/i)[0];
      const sesudah = lamaDalam(jendela);
      if (sesudah) {
        const depan = jendela.slice(0, sesudah.indeks);
        if (depan.length <= 60 && (POLA_PENANDA_LAMA.test(depan) || depan.trim().length <= 3) && !POLA_BUKAN_LAMA_PISAH.test(depan)) {
          return { nilai: sesudah.nilai, kalimat: b };
        }
      }
      // Sebelumnya: "kurang lebih 1 tahun 5 bulan antara Penggugat dan
      // Tergugat telah pisah rumah". Riwayat tempat tinggal ("tinggal ...
      // selama 2 tahun, setelah itu ... hingga pisah rumah") ditolak.
      const mulai = Math.max(0, ev.indeks - 90);
      const kiri = b.slice(mulai, ev.indeks);
      let calon = null;
      for (let p = 0; p < kiri.length; ) {
        const l = lamaDalam(kiri.slice(p));
        if (!l) break;
        calon = { ...l, indeks: l.indeks + p, ujung: l.ujung + p };
        p = calon.ujung;
      }
      if (calon) {
        const sela = kiri.slice(calon.ujung);
        const depanAngka = b.slice(Math.max(0, mulai + calon.indeks - 50), mulai + calon.indeks);
        if (
          POLA_PENANDA_LAMA.test(depanAngka.slice(-25)) &&
          !/[.;]\s/.test(sela) &&
          !POLA_BUKAN_LAMA_PISAH.test(sela) &&
          !POLA_BUKAN_LAMA_PISAH.test(depanAngka)
        ) {
          return { nilai: calon.nilai, kalimat: b };
        }
      }
    }
  }
  return { nilai: "", kalimat: "" };
}

const POLA_SEBUTAN_PIHAK = "(penggugat|tergugat|pemohon|termohon)";
const POLA_PERGI_SUBJEK = new RegExp(
  `${POLA_SEBUTAN_PIHAK}\\s+(?:(?:yang|telah|sudah|lah|pun|kemudian|lalu|akhirnya|langsung|memilih|memutuskan|untuk|terpaksa|segera|kembali|pernah)\\s+){0,3}` +
    `(?:pergi\\b(?!\\s+(?!meninggalkan)(?:me|mem|men|meng|ber|untuk|bekerja|mencari|mengurus)\\w*)|meninggalkan\\s+(?:rumah|tempat|kediaman|${POLA_SEBUTAN_PIHAK.slice(1, -1)})|keluar\\s+dari\\s+rumah|kabur|minggat|` +
    `(?:pulang|kembali)\\s+(?:lagi\\s+)?ke\\s*(?:rumah\\s+)?(?:orang\\s*tua|orangtua|keluarga|saudara|mertua))`,
  "g"
);
const POLA_DIUSIR = new RegExp(
  `${POLA_SEBUTAN_PIHAK}\\s+(?:(?:telah|sudah|pernah|lalu|kemudian|akhirnya)\\s+)?(?:di\\s*usir|dipulangkan|diantar(?:kan)?\\s+(?:pulang|kembali))`,
  "g"
);
const POLA_MENGUSIR = new RegExp(`(?:mengusir|memulangkan|menyuruh|mengantar(?:kan)?)\\s+${POLA_SEBUTAN_PIHAK}`, "g");
const POLA_DITINGGAL = new RegExp(
  `${POLA_SEBUTAN_PIHAK}\\s+(?:telah\\s+|sudah\\s+)?ditinggal(?:kan)?\\s+(?:pergi\\s+)?(?:oleh\\s+)?${POLA_SEBUTAN_PIHAK}`,
  "g"
);

const POLA_TIDAK_KEMBALI_SUBJEK = new RegExp(
  `${POLA_SEBUTAN_PIHAK}\\s+(?:(?:sudah|telah|juga|pun|akhirnya)\\s+)?(?:tidak|tak)\\s+(?:pernah\\s+)?(?:lagi\\s+)?(?:kembali|pulang)(?:\\s+lagi)?\\s+(?:ke\\s+(?:rumah|kediaman|tempat)|kepada\\s+${POLA_SEBUTAN_PIHAK.slice(1, -1)})`,
  "g"
);
const POLA_IZIN_PULANG_SUBJEK = new RegExp(
  // Di antara izin dan pulangnya hanya boleh "kepada <pihak lain>" - "Tergugat
  // meminta izin ... untuk bekerja dan Penggugat kembali ke rumah orangtua"
  // yang pulang Penggugat, bukan Tergugat.
  `${POLA_SEBUTAN_PIHAK}\\s+(?:(?:telah|sudah|lalu|kemudian)\\s+)?(?:izin|ijin|pamit|berpamitan|meminta\\s+izin|minta\\s+izin)\\b(?:\\s+kepada\\s+${POLA_SEBUTAN_PIHAK.slice(1, -1)})?(?:(?!penggugat|tergugat|pemohon|termohon)[^.;]){0,60}?\\b(?:pulang|kembali)\\s+ke\\s*(?:rumah\\s+)?(?:orang\\s*tua|orangtua|keluarga|kampung)`,
  "g"
);

/**
 * Sisi yang pergi menurut satu butir posita, atau "" bila tidak tersebut atau
 * kedua sisi sama-sama tersebut.
 * @returns {""|"pelaku"|"lawan"|"ragu"} pelaku = 0047 = Tergugat/Termohon
 */
function sisiPergiButir(butirKecil) {
  const k = butirKecil;
  const sisi = (kata) => (/tergugat|termohon/.test(kata) ? "pelaku" : "lawan");
  const tegas = k.match(/(?:meninggalkan|pergi)[^.;]*?adalah\s*(penggugat|tergugat|pemohon|termohon)/);
  if (tegas) return sisi(tegas[1]);
  const temu = [];
  for (const m of k.matchAll(POLA_DIUSIR)) temu.push({ sisi: sisi(m[1]), indeks: m.index });
  for (const m of k.matchAll(POLA_MENGUSIR)) temu.push({ sisi: sisi(m[1]), indeks: m.index });
  for (const m of k.matchAll(POLA_DITINGGAL)) temu.push({ sisi: sisi(m[2]), indeks: m.index });
  // Butir 14: "Termohon tidak lagi kembali ke kediaman bersama", "Termohon izin
  // ... untuk kembali ke rumah orang tua Termohon" - yang tidak kembali dan
  // yang pamit pulang itulah yang meninggalkan kediaman bersama.
  for (const pola of [POLA_TIDAK_KEMBALI_SUBJEK, POLA_IZIN_PULANG_SUBJEK]) {
    for (const m of k.matchAll(pola)) {
      if (/(?:\b(?:dengan|kepada|terhadap|oleh|bersama|antara)\s+|\b(?:penggugat|tergugat|pemohon|termohon)\s+(?:dan|dengan)\s+)$/.test(k.slice(0, m.index))) continue;
      temu.push({ sisi: sisi(m[1]), indeks: m.index });
    }
  }
  for (const m of k.matchAll(POLA_PERGI_SUBJEK)) {
    // "Penggugat dan Tergugat pergi" (bersama), "marah kepada Penggugat lalu
    // pergi" (objek) - sebutan itu bukan subjek perginya.
    if (/(?:\b(?:dengan|kepada|terhadap|oleh|bersama|antara|bagi|untuk)\s+|\b(?:penggugat|tergugat|pemohon|termohon)\s+(?:dan|dengan)\s+|\/\s*)$/.test(k.slice(0, m.index))) continue;
    temu.push({ sisi: sisi(m[1]), indeks: m.index });
  }
  const ditemukan = new Set(temu.map((t) => t.sisi));
  if (ditemukan.size === 1) return [...ditemukan][0];
  if (ditemukan.size <= 1) return "";
  // Kalimat puncak: "terjadi pada ..., Tergugat pergi meninggalkan ... Dan
  // setelah itu Penggugat kembali ke rumah orang tuanya" - yang PERTAMA pergi
  // itulah yang meninggalkan kediaman bersama. Di butir lain: ragu.
  if (/puncak/.test(k)) return temu.sort((a, b) => a.indeks - b.indeks)[0].sisi;
  return "ragu";
}

function siapaPergiPosita(butir) {
  const temuan = [];
  for (const b of butirPisah(butir)) {
    const k = b.toLowerCase();
    if (POLA_PILIHAN_SEBUTAN.test(k)) continue;
    // "Tergugat sering mengusir Penggugat" di daftar penyebab adalah
    // kebiasaan, bukan hari perpisahannya.
    if (!POLA_KONTEKS_PISAH.test(k) && /\b(?:sering|selalu|kerap|suka|kadang|setiap\s+kali)\b/.test(k)) continue;
    const s = sisiPergiButir(k);
    if (s === "ragu") return { sisi: "", kalimat: b, ragu: true };
    if (s) temuan.push({ sisi: s, kalimat: b, peringkat: /puncak/i.test(b) ? 0 : 1 });
  }
  if (!temuan.length) return { sisi: "", kalimat: "" };
  // Butir SEPERINGKAT yang menyebut pihak berbeda pergi (kepergian lain,
  // salah ketik di posita): tidak ditebak mana yang benar. Kalimat puncak
  // menang atas cerita di butir lain.
  const setara = temuan.filter((t) => t.peringkat === temuan[0].peringkat);
  if (new Set(setara.map((t) => t.sisi)).size > 1) return { sisi: "", kalimat: temuan[0].kalimat, ragu: true };
  return { sisi: temuan[0].sisi, kalimat: temuan[0].kalimat };
}

/* Upaya damai di POSITA. Dibedakan dari upayaDamaiDari (keterangan saksi)
 * karena posita punya dua bentuk yang terbaca sebagai upaya padahal bukan:
 *   "perselisihan ... yang sulit untuk dirukunkan lagi" - keadaan, bukan upaya
 *     (8 dari 30 sampel ukur lama);
 *   "ketika Penggugat menasehati, Tergugat marah" - nasihat suami-isteri,
 *     bukan upaya merukunkan oleh keluarga (2 dari 30). */
const POLA_UPAYA_DAMAI_POSITA = new RegExp(
  `${POLA_UPAYA_DAMAI.source}|(?:diatur|diselesaikan|dimusyawarahkan|diurus|mengurus|dimediasi)\\s+secara\\s+kekeluargaan|musyawarah\\s+keluarga|upaya\\s+kekeluargaan|dimediasi\\s+oleh`,
  "i"
);
const POLA_BUKAN_UPAYA =
  /(?:sulit|susah|sukar|tidak\s+(?:dapat|bisa|mungkin|mau|ingin|bersedia)|tak\s+(?:dapat|bisa|mungkin|mau)|enggan)\s+(?:lagi\s+)?(?:untuk\s+)?(?:di)?(?:rukunkan|damaikan|rukun(?:\s+kembali)?|damai|dipertahankan|bersatu|diselesaikan\s+secara\s+kekeluargaan)(?:\s+(?:lagi|kembali))?/gi;
const POLA_NASIHAT = /\b(?:menasihati|menasehati|dinasihati|dinasehati|memberi(?:kan)?\s+nasi?e?hat)\w*/gi;
// "keluarga Tergugat tidak pernah memusyawarahkan ..." - bentuk posita yang
// tidak dikenal POLA_BELUM_ADA_UPAYA (yang menuntut "mencoba memusyawarahkan").
const POLA_BELUM_ADA_UPAYA_POSITA =
  /\b(?:belum|tidak)\s+(?:pernah\s+)?(?:ada\s+)?(?:memusyawarahkan|bermusyawarah|berusaha\s+(?:untuk\s+)?(?:merukunkan|mendamaikan)|berupaya\s+(?:untuk\s+)?(?:merukunkan|mendamaikan))/i;

/** Nasihat hanya upaya merukunkan bila PERUKUN-nya (keluarga, orang tua,
 *  tokoh) disebut di kalimat yang sama sebelum kata nasihatnya. */
function tanpaNasihatAntarPihak(teks) {
  return teks.replace(POLA_NASIHAT, (kata, letak) => {
    const awalKalimat = Math.max(teks.lastIndexOf(". ", letak), teks.lastIndexOf("; ", letak)) + 1;
    return POLA_PERUKUN.test(teks.slice(awalKalimat, letak)) ? kata : " ";
  });
}

/** "tidak ada harapan untuk hidup rukun kembali" - "rukun kembali" hanya
 *  upaya bila didahului perbuatan merukunkan. */
function tanpaRukunKembaliLepas(teks) {
  return teks.replace(/(?:hidup\s+)?rukun\s+kembali/gi, (frasa, letak) =>
    /(diupayakan|diusahakan|berupaya|berusaha|mencoba|mendamaikan|merukunkan|dimediasi|menasi?e?hati|didamaikan|dirukunkan)[^.;]{0,40}$/i.test(
      teks.slice(Math.max(0, letak - 60), letak)
    )
      ? frasa
      : " "
  );
}

function upayaDamaiPosita(butir) {
  const belum = butir.find((b) => POLA_BELUM_ADA_UPAYA.test(b) || POLA_BELUM_ADA_UPAYA_POSITA.test(b));
  if (belum) return { keadaan: "belum-ada", kalimat: belum };
  const kalimat =
    butir.find((b) =>
      POLA_UPAYA_DAMAI_POSITA.test(tanpaRukunKembaliLepas(tanpaNasihatAntarPihak(b.replace(POLA_BUKAN_UPAYA, " "))))
    ) || "";
  if (!kalimat) return { keadaan: "", kalimat: "" };
  const berhasil = POLA_BERHASIL_RUKUN.test(kalimat) && !POLA_TIDAK_BERHASIL.test(kalimat) && !POLA_RETAK_LAGI.test(kalimat);
  return { keadaan: berhasil ? "berhasil" : "gagal", kalimat, perukun: upayaDamaiPerukun.perukunDari(kalimat, POLA_UPAYA_DAMAI_POSITA) };
}

/**
 * ============================================================================
 * BUTIR 14 (6 OKTOBER 2026) - FAKTA TAMBAHAN DAN LAMA PISAH YANG DIHITUNG
 * ============================================================================
 *
 * Permintaan pengguna: "lengkapkan susun keterangan saksi ... jangan sampai
 * kosong atau tidak dapat dibaca sebisa mungkin (diutamakan ambil dari posita
 * dan pakai logika kalau tidak ada datanya)". Diukur atas 1.257 posita cerai
 * 2025-2026 sipp_donggala: jumlah anak tidak terbaca pada 569 perkara
 * ("di karuniai seorang anak", "1 ( satu) orang anak", "tidak dikaruniai
 * keturunan"), tempat tinggal pada 943 ("tinggal bersama di rumah orang tua
 * Penggugat di Desa ... selama 3 tahun, setelah itu ..."), dan lama pisah tidak
 * pernah dihitung dari "sejak tahun 2024" yang tanpa bulan.
 *
 * Yang ditambahkan tetap fakta yang TERTULIS atau yang dapat diturunkan dengan
 * hitungan; tidak satu pun dikarang.
 */

/** Bulan acuan "awal/pertengahan/akhir tahun" (0 = Januari). */
const BULAN_BAGIAN_TAHUN = { awal: 0, pertengahan: 5, akhir: 10 };

/** Hari ini sebagai "DD/MM/YYYY" - acuan bila tanggal sidang tidak ada. */
function hariIniTeks(hariIni) {
  const d = hariIni instanceof Date ? hariIni : hariIni ? new Date(String(hariIni)) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  const dua = (n) => String(n).padStart(2, "0");
  return `${dua(d.getDate())}/${dua(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * Lama pisah dari "sejak" posita sampai tanggal acuan (sidang, atau hari ini).
 *
 *   "bulan September 2025"  -> 1 tahun 1 bulan  (acuan Oktober 2026)
 *   "akhir tahun 2023"      -> 2 tahun 11 bulan (akhir tahun = November)
 *   "tahun 2024"            -> 2 tahun, taksiran (bulannya tidak diketahui)
 *
 * Hitungan bulan memakai selisih tahun x 12 + selisih bulan, jadi batas tahun
 * (Desember -> Januari) tetap satu bulan. null bila tidak terbaca, bila acuan
 * lebih dahulu dari sejaknya, atau bila hasilnya kurang dari satu satuan -
 * "sejak tahun 2026" pada tahun 2026 tidak menghasilkan angka apa pun.
 *
 * @returns {{teks:string, totalBulan:number, taksiran:boolean}|null}
 */
function lamaSejakAcuan(nilaiSejak, tanggalAcuan) {
  // 31 Okt (butir 16): 0246 boleh "tanggal 23 Juli 2024" - hitungan tetap per bulan; bulan yang belum genap dibuang.
  const mTgl = String(nilaiSejak || "").replace(/\s+/g, " ").trim().match(/^tanggal\s+(\d{1,2})\s+(.+)$/i);
  const hariSejak = mTgl ? Number(mTgl[1]) : 0;
  const t = mTgl ? `bulan ${mTgl[2]}` : String(nilaiSejak || "").replace(/\s+/g, " ").trim();
  const acuan = uraikanTanggal(tanggalKeTeks(tanggalAcuan));
  if (!t || !acuan || Number.isNaN(acuan.getTime())) return null;
  let tahun;
  let bulan;
  let taksiran = false;
  let m = t.match(/^(?:(awal|akhir|pertengahan)\s+)?(?:bulan\s+)?([A-Za-z]+)\s+(\d{4})$/i);
  if (m && bulanKeAngka(namaBulanBaku(m[2])) !== null) {
    tahun = Number(m[3]);
    bulan = bulanKeAngka(namaBulanBaku(m[2]));
  } else if ((m = t.match(/^(awal|akhir|pertengahan)\s+tahun\s+(\d{4})$/i))) {
    tahun = Number(m[2]);
    bulan = BULAN_BAGIAN_TAHUN[m[1].toLowerCase()];
    taksiran = true;
  } else if ((m = t.match(/^tahun\s+(\d{4})$/i))) {
    const n = acuan.getFullYear() - Number(m[1]);
    if (n < 1) return null;
    return { teks: `${n} tahun`, totalBulan: n * 12, taksiran: true };
  } else {
    return null;
  }
  const total = (acuan.getFullYear() - tahun) * 12 + (acuan.getMonth() - bulan) - (hariSejak && acuan.getDate() < hariSejak ? 1 : 0);
  if (total < 1) return null;
  const th = Math.floor(total / 12);
  const bl = total % 12;
  const potong = [];
  if (th > 0) potong.push(`${th} tahun`);
  if (bl > 0) potong.push(`${bl} bulan`);
  return { teks: potong.join(" "), totalBulan: total, taksiran };
}

/** "seorang", "dua", "1 ( satu)", "2 dua)" -> angka; null bila bukan bilangan. */
function angkaAnak(teks) {
  const t = String(teks || "").toLowerCase().trim();
  if (/^\d+$/.test(t)) return Number(t);
  if (t === "seorang" || t === "satu") return 1;
  return Object.prototype.hasOwnProperty.call(ANGKA_KATA, t) ? ANGKA_KATA[t] : null;
}

const POLA_BELUM_ANAK =
  /\b(?:belum|tidak)\s+(?:pernah\s+)?(?:juga\s+)?(?:di\s*)?karuniai\s+(?:seorang\s+)?(?:anak|keturunan|buah\s+hati)|\b(?:belum|tidak)\s+(?:mempunyai|memiliki|ada|punya)\s+(?:seorang\s+)?(?:anak|keturunan)/i;
const POLA_JUMLAH_ANAK = new RegExp(
  `(?:di\\s*karuniai|karuniai|mempunyai|memiliki|lahir(?:lah)?)\\s+(?:sebanyak\\s+)?(\\d{1,2}|seorang|${POLA_KATA_ANGKA})\\s*(?:\\(?\\s*[a-z]+\\s*\\)\\s*)?(?:orang\\s+)?(?:anak|putra|putri|puteri)`,
  "i"
);

/** Jumlah anak dari kalimat karunia: "2 orang anak", "belum mempunyai anak", atau "". */
function jumlahAnakPosita(butir) {
  const calon = butir.filter((b) => /karunia|keturunan|(?:mempunyai|memiliki)\s+(?:\S+\s+){0,3}anak/i.test(b));
  for (const b of calon) {
    if (POLA_BELUM_ANAK.test(b)) return { nilai: "belum mempunyai anak", kalimat: b };
    const m = b.match(POLA_JUMLAH_ANAK);
    const n = m ? angkaAnak(m[1]) : null;
    if (n && n > 0 && n < 20) return { nilai: `${n} orang anak`, kalimat: b };
  }
  return { nilai: "", kalimat: "" };
}

/**
 * Pada siapa anak itu sekarang: "saat ini tinggal bersama Penggugat", "berada
 * dalam pengasuhan Penggugat", "anak-anak tinggal bersama denganPenggugat".
 * @returns {""|"pelaku"|"lawan"}
 */
function anakIkutPosita(butir) {
  const pola =
    /\banak[^.;]{0,160}?\b(?:tinggal|berada|ikut|diasuh|dirawat|dipelihara|dalam\s+(?:asuhan|pengasuhan|pemeliharaan|perawatan))\s+(?:(?:bersama|dalam\s+(?:asuhan|pengasuhan|pemeliharaan|perawatan))\s+)?(?:dengan\s*|oleh\s+)?(penggugat|tergugat|pemohon|termohon)\b/gi;
  // 19 Okt 2026 - bentuk lain yang sama jelasnya: "Penggugat yang mengasuh/merawat anak", "hak asuh anak ... berada pada
  // Penggugat", "anak ... berada di bawah asuhan Penggugat". Hanya bila tepat SATU pihak yang disebut.
  const polaPengasuh =
    /\b(penggugat|tergugat|pemohon|termohon)\b\s+(?:yang\s+)?(?:selama\s+ini\s+|kini\s+|sekarang\s+)?(?:telah\s+|sudah\s+)?(?:mengasuh|merawat|memelihara|membesarkan|membawa)\s+(?:kedua\s+|ketiga\s+|semua\s+)?(?:anak|anak-anak)\b/gi;
  const polaHakAsuh =
    /\b(?:hak\s+)?(?:asuh|hadhanah|hadlanah|pengasuhan|pemeliharaan)\s+(?:atas\s+|terhadap\s+)?(?:kedua\s+|ketiga\s+|semua\s+)?anak(?:-anak)?[^.;]{0,80}?\b(?:kepada|pada|oleh|berada\s+(?:pada|di\s+tangan)|jatuh\s+(?:kepada|pada))\s+(penggugat|tergugat|pemohon|termohon)\b/gi;
  const sisi = new Set();
  for (const b of butir) {
    for (const m of b.matchAll(pola)) sisi.add(/tergugat|termohon/i.test(m[1]) ? "pelaku" : "lawan");
    for (const m of b.matchAll(polaPengasuh)) sisi.add(/tergugat|termohon/i.test(m[1]) ? "pelaku" : "lawan");
    for (const m of b.matchAll(polaHakAsuh)) sisi.add(/tergugat|termohon/i.test(m[1]) ? "pelaku" : "lawan");
  }
  return sisi.size === 1 ? [...sisi][0] : "";
}

/**
 * Tempat tinggal SEKARANG tiap pihak (sesudah berpisah), dari kalimat posita yang jelas menyebutnya:
 * "Tergugat pergi dan tinggal di rumah orang tuanya di Desa X", "Penggugat pulang ke rumah orang tua di Kota Y".
 * Hanya bila tepat SATU tempat untuk pihak itu; "orang tuanya" dituliskan "orang tua <pihak>". Tidak ada yang dikarang.
 * @returns {{lawan: string, pelaku: string}} lawan = 0046 (Penggugat/Pemohon), pelaku = 0047 (Tergugat/Termohon)
 */
function tempatKiniPosita(butir, pelaku, lawan) {
  const hasil = { lawan: new Set(), pelaku: new Set() };
  const pola =
    /\b(penggugat|tergugat|pemohon|termohon)\b((?:(?!\b(?:penggugat|tergugat|pemohon|termohon)\b)[^.;]){0,100}?)\b(?:tinggal|bertempat\s+tinggal|berdomisili|menetap|pulang|kembali|pindah|mengungsi|menumpang|pergi|meninggalkan\s+(?:rumah|tempat\s+tinggal|kediaman)[^,.;:()]{0,50}?)(?:\s+(?:bersama|lagi|kembali|sendiri))*\s+(?:di|ke)\s+([^,.;:()]{3,120}?)(?=\s+(?:selama|hingga|sampai|kemudian|lalu|setelah|sesudah|namun|tetapi|sedangkan|sementara|karena|sehingga|sejak|dan\s+(?:sejak|hingga|sampai|tidak|telah|sudah|belum))\b|\s*[,.;:(]|$)/gi;
  for (const b of butir) {
    const teks = String(b || "").replace(/\b(di|ke)(rumah)\b/gi, "$1 $2");
    for (const m of teks.matchAll(pola)) {
      const antara = `${m[2]} ${teks.slice(m.index + m[0].length - m[3].length - 12, m.index + m[0].length - m[3].length)}`;
      // Hanya tempat SESUDAH berpisah: ada penanda "kini/sekarang/pulang/kembali/pindah" atau kalimat membicarakan pisahnya.
      const adaPenanda = /\b(?:kini|sekarang|saat\s+ini|pulang|kembali|pindah|mengungsi|menumpang)\b/i.test(antara);
      const riwayat = /\b(?:setelah|sesudah)\s+(?:menikah|pernikahan|perkawinan)\b/i.test(teks);
      if (!adaPenanda && (riwayat || !/\b(?:berpisah|pisah|meninggalkan|pergi)\b/i.test(teks))) continue;
      // Subjek tidak jelas: "Pemohon ... izin kepada Termohon untuk kembali ke ...", "Penggugat dan Tergugat pindah ke ...".
      if (/\b(?:penggugat|tergugat|pemohon|termohon|kepada|izin|dengan|oleh)\b/i.test(m[2])) continue;
      if (/\b(?:penggugat|tergugat|pemohon|termohon)\s+(?:dan|dengan|serta)\s*$/i.test(teks.slice(Math.max(0, m.index - 24), m.index))) continue;
      let tempat = m[3].replace(/\s+/g, " ").trim().replace(/\s+(?:untuk|guna|agar|supaya)\b.*$/i, "");
      // Tempat milik pihak lawan (kunjungan, ambil barang) bukan tempat tinggalnya.
      const lawanSisi = /tergugat|termohon/i.test(m[1]) ? /\b(?:penggugat|pemohon)\b/i : /\b(?:tergugat|termohon)\b/i;
      if (lawanSisi.test(tempat)) continue;
      if (!POLA_KATA_TEMPAT.test(tempat) && !/\b(?:orang\s*tua|mertua|saudara|kakak|adik|keluarga|kerabat|nenek|kakek|paman|bibi|kos|kost)\b/i.test(tempat)) continue;
      const sisi = /tergugat|termohon/i.test(m[1]) ? "pelaku" : "lawan";
      const sebut = sisi === "pelaku" ? String(pelaku || "").trim() || "Tergugat" : String(lawan || "").trim() || "Penggugat";
      tempat = tempat.replace(/\b(orang\s*tua|mertua|kakak|adik|saudara|keluarga|kerabat|nenek|kakek|paman|bibi)nya\b/gi, `$1 ${sebut}`);
      hasil[sisi].add(tempat);
    }
  }
  const satu = (s) => (s.size === 1 ? [...s][0] : "");
  return { lawan: satu(hasil.lawan), pelaku: satu(hasil.pelaku) };
}

// Tempat tinggal sesudah menikah: "tinggal (bersama) di <tempat> (selama N)",
// "pindah ke rumah ...". Tempat berakhir pada kata penyambung riwayat.
const POLA_TEMPAT_TINGGAL =
  /\b(?:bertempat\s+tinggal|tinggal|menetap|berdiam|pindah|membina\s+rumah\s+tangga)(?:\s+(?:bersama|lagi|kembali|sendiri|serumah))*\s+(?:di|ke)\s+([^,.;:()]{3,120}?)(?=\s+(?:selama|hingga|sampai|kemudian|lalu|setelah|sesudah|selanjutnya|terakhir|namun|tetapi|akan\s+tetapi|untuk|sejak|sekitar|kurang|dan\s+(?:terakhir|sempat|kemudian|selanjutnya|setelah|terkadang|saat|sejak|tetap|telah|sudah|pernah|juga|tidak))\b|\s*[,.;:(]|$)/gi;
const POLA_KATA_TEMPAT =
  /\b(?:rumah|desa|kelurahan|kel\.|kota|kecamatan|kec\.|kabupaten|kab\.|dusun|jalan|jl\.?|kampung|lorong|btn|perumahan|kost?|kontrakan|asrama|mess|lingkungan|wilayah|provinsi|kompleks)\b/i;

/**
 * Riwayat tempat tinggal bersama sesudah menikah - dari butir "setelah
 * menikah ... tinggal ...". Berhenti pada "saat ini" (tempat tinggal SESUDAH
 * berpisah bukan kediaman bersama).
 * @returns {{tempat: Array<{tempat:string, lama:string}>, tidakPernahSerumah:boolean, kalimat:string}}
 */
function riwayatTinggalPosita(butir) {
  const kosong = { tempat: [], tidakPernahSerumah: false, kalimat: "" };
  const b = butir.find(
    (x) =>
      /(?:setelah|sesudah|selama|pasca)\s+(?:menikah|pernikahan|perkawinan|akad|melangsungkan)/i.test(x) &&
      /tinggal|menetap|pindah|membina\s+rumah\s+tangga/i.test(x)
  );
  if (!b) return kosong;
  const teks = b
    .split(/\.\s+(?=[A-Z])|\b(?:dan\s+)?(?:saat\s+ini|sekarang\s+ini)\b/)[0]
    .replace(/\b(di|ke)(rumah)\b/gi, "$1 $2");
  if (/(?:menikah|pernikahan|perkawinan)[^.;]{0,60}\btidak\s+(?:pernah\s+)?(?:tinggal\s+bersama|serumah|satu\s+rumah)/i.test(teks)) {
    return { tempat: [], tidakPernahSerumah: true, kalimat: b };
  }
  const tempat = [];
  POLA_TEMPAT_TINGGAL.lastIndex = 0;
  for (const m of teks.matchAll(POLA_TEMPAT_TINGGAL)) {
    const t = m[1].replace(/\s+/g, " ").trim();
    if (!POLA_KATA_TEMPAT.test(t) || t.length > 100) continue;
    const sesudah = teks.slice(m.index + m[0].length, m.index + m[0].length + 60);
    const lm = sesudah.match(/^\s*,?\s*selama\s+((?:kurang\s+lebih|lebih\s+kurang|sekitar|kira-kira|±)\s+)?/i);
    const lama = lm ? lamaDalam(sesudah.slice(lm[0].length, lm[0].length + 40)) : null;
    const isi = { tempat: t, lama: lama && lama.indeks <= 2 ? `${lm[1] ? "kurang lebih " : ""}${lama.nilai}` : "" };
    if (!tempat.some((x) => x.tempat.toLowerCase() === t.toLowerCase())) tempat.push(isi);
    if (tempat.length >= 4) break;
  }
  return { tempat, tidakPernahSerumah: false, kalimat: tempat.length ? b : "" };
}

/**
 * Awal perselisihan yang tidak bertanggal tetapi tertulis peristiwanya:
 * "perselisihan ... mulai terjadi sejak awal pernikahan".
 */
function awalKonflikTanpaTanggal(butir) {
  for (const b of butir) {
    const depan = b.split(POLA_BATAS_AWAL_KONFLIK)[0];
    if (depan.search(POLA_KONFLIK_POSITA) < 0 || POLA_KONFLIK_ULANG.test(depan)) continue;
    const m = depan.match(/\b(?:sejak|mulai|semenjak)\s+(awal\s+(?:pernikahan|perkawinan|menikah|berumah\s+tangga))\b/i);
    if (m) return { nilai: m[1].toLowerCase().replace(/\s+/g, " "), kalimat: b };
  }
  return { nilai: "", kalimat: "" };
}

/**
 * ============================================================================
 * JAWABAN TEMPLAT YANG MASIH KOSONG - DIISI, BUKAN SEKADAR DILAPORKAN
 * ============================================================================
 *
 * Templat keterangan saksi ABT memuat titik-titik yang harus diisi petugas:
 * "perselisihan terjadi sejak ...", "berpisah kurang lebih ...", "yang
 * meninggalkan kediaman bersama adalah ...", "_ kali". Sampai 2.19.8 ALETA
 * hanya MENGHITUNGNYA dan berkata "3 jawaban masih memuat titik-titik" -
 * lalu petugas mengetiknya satu per satu, enam belas pertanyaan dikali dua
 * saksi.
 *
 * Padahal jawabannya sudah tertulis di gugatan yang sedang dikerjakan.
 * Fungsi ini membaca fakta itu dari posita - kapan perselisihan mulai, sejak
 * kapan dan berapa lama berpisah, siapa yang pergi - lalu memasangnya pada
 * pertanyaan yang meminta. Yang TIDAK terbaca dibiarkan bertitik-titik dan
 * tetap dihitung pada perluDiisi: mengarang tanggal pisah rumah ke dalam
 * berita acara sidang jauh lebih berbahaya daripada titik-titik yang terlihat.
 */
function faktaDariPosita(posita, pelaku, lawan, opsi) {
  const o = opsi && typeof opsi === "object" ? opsi : {};
  const butir = kalimatPosita(posita);
  const cari = (...kata) =>
    butir.find((k) => {
      const kecil = k.toLowerCase();
      return kata.every((w) => kecil.includes(w));
    }) || "";

  // Butir 24 - tiap fakta dari peristiwanya (lihat FAKTA POSITA DIBACA PER
  // PERISTIWA di atas), bukan dari kalimat pertama yang memuat satu kata.
  // Butir 14: awal perselisihan tanpa tanggal ("sejak awal pernikahan") dipakai
  // bila tidak ada yang bertanggal.
  const awalBertanggal = awalKonflikPosita(butir);
  const awal = awalBertanggal.nilai ? awalBertanggal : awalKonflikTanpaTanggal(butir);
  // 19 Okt: baris posita yang terpotong di tengah kalimat dirangkai dahulu - hanya untuk pembacaan penyebab.
  const sebab = penyebabPosita(kalimatPositaSambung(posita));
  const sejak = pisahSejakPosita(butir);
  const lama = lamaPisahPosita(butir);
  const pergi = siapaPergiPosita(butir);

  // Hanya tanggalnya yang tertulis: lamanya dihitung sampai tanggal sidang -
  // atau sampai HARI INI bila tanggal sidang tidak ada (butir 14). Sejak
  // bulan+tahun dihitung tepat per bulan ("September 2025" -> "1 tahun 1
  // bulan" pada Oktober 2026); "awal/pertengahan/akhir tahun" dan "tahun 2024"
  // ditandai taksiran ("kurang lebih"). Yang hanya tertulis lamanya TIDAK
  // dihitung mundur menjadi tanggal: "kurang lebih 2 tahun" dari tanggal yang
  // tidak diketahui bukan bulan yang pasti.
  let lamaPisah = lama.nilai;
  let lamaPisahDihitung = false;
  const acuanLama = o.tanggalSidang ? tanggalKeTeks(o.tanggalSidang) : hariIniTeks(o.hariIni);
  // Lama tertulis yang hanya hari/minggu ("sempat kembali selama 2 hari")
  // padahal sejaknya bertahun-tahun lalu bukan lama pisahnya - yang dihitung
  // dari sejaknya yang dipakai (logika: lama pisah tidak mungkin lebih pendek
  // dari jarak sejak pisah sampai sidang).
  const hanyaHari = Boolean(lamaPisah) && !/tahun|bulan/i.test(lamaPisah);
  if ((!lamaPisah || hanyaHari) && sejak.nilai && acuanLama) {
    const hitung = lamaSejakAcuan(sejak.nilai, acuanLama);
    if (hitung && hitung.totalBulan >= 1) {
      lamaPisah = hitung.teks;
      lamaPisahDihitung = true;
    }
  }

  // ==========================================================================
  // SIAPA YANG PERGI - DAN KEDUA SEBUTANNYA PERNAH TERTUKAR DI SINI
  // ==========================================================================
  //
  // Nama ruasnya menjebak, dan jebakannya sudah memakan korban:
  //
  //   pelaku = variabel ABT 0047 = "Tergugat" / "Termohon"
  //   lawan  = variabel ABT 0046 = "Penggugat" / "Pemohon"
  //
  // Kebalikan dari yang disangka namanya. Sampai 2.32.0 baris di bawah ini
  // memulangkan `lawan` ketika kalimatnya menyebut Tergugat, dan `pelaku`
  // ketika menyebut Penggugat - tertukar keduanya.
  //
  // Cadangan harfiahnya ("Tergugat", "Penggugat") justru BENAR, jadi cacatnya
  // hanya muncul ketika 0046/0047 sungguh terbaca - yaitu pada pemakaian
  // normal. Itulah sebabnya ia bertahan: pada uji yang variabelnya kosong,
  // jawabannya selalu benar.
  //
  // Yang salah di sini bukan tampilan. Jawaban "siapa yang meninggalkan
  // kediaman bersama" masuk ke berita acara sidang yang ditandatangani, dan
  // menyebut pihak yang keliru di sana lebih mahal daripada mengosongkannya.
  //
  // Sampai 25 September 2026 yang dibaca hanya ADA-TIDAKNYA sebutan di
  // kalimatnya: kalimat yang menyebut Penggugat di mana pun dijawab
  // "Penggugat" - padahal hampir tiap kalimat pisah menyebut keduanya
  // ("Tergugat pergi meninggalkan rumah kediaman bersama sehingga Penggugat
  // dan Tergugat telah pisah rumah"). Terukur: 910 dari 1.551 jawaban berbeda
  // dari subjek kalimatnya.
  //
  // Kini (butir 24) yang dibaca SUBJEK peristiwa perginya - siapaPergiPosita:
  // "X pergi/meninggalkan rumah/pulang ke rumah orang tua", "X diusir",
  // "mengusir X", "yang meninggalkan ... adalah X" - di butir yang bercerita
  // tentang perpisahan lebih dulu. Dua sisi tersebut sekaligus = kosong; bila
  // tidak ada, jawabannya kosong dan titik-titiknya tetap terlihat.
  let siapaPergi = "";
  const sisiPergi = pergi.sisi;
  if (sisiPergi === "pelaku") siapaPergi = pelaku || "Tergugat";
  else if (sisiPergi === "lawan") siapaPergi = lawan || "Penggugat";

  // ambilBulanTahun memulangkan { nilai, jenis } - yang dipakai di sini
  // kalimatnya saja. Tanpa memetiknya, nama berkas dan jawaban saksi berisi
  // "[object Object]" - dan itu tersimpan ke berita acara tanpa satu pun galat.
  // --------------------------------------------------------------------
  // TIGA FAKTA YANG SELALU DITANYAKAN DI PERSIDANGAN
  // --------------------------------------------------------------------
  //
  // Kapan menikah, berapa anaknya, dan di mana mereka tinggal ditanyakan
  // kepada hampir tiap saksi, dan ketiganya sudah tertulis di posita yang
  // sedang dikerjakan. Selama ini ketiganya dibiarkan bertitik-titik dan
  // diketik petugas satu per satu, dikali dua saksi.
  //
  // Yang diambil HANYA yang tertulis. Tidak ada yang disimpulkan: posita yang
  // tidak menyebut jumlah anak memulangkan kosong, dan jawaban templatnya
  // tetap bertitik-titik beserta tandanya di perluDiisi. Mengarang jumlah anak
  // ke dalam berita acara adalah keterangan palsu, dan tidak ada yang
  // memeriksanya kembali setelah ditandatangani.

  const kalimatNikah = cari("menikah") || cari("perkawinan") || cari("akad nikah");
  const kalimatAnak = cari("anak");
  const kalimatKediaman =
    cari("bertempat tinggal") || cari("kediaman bersama") || cari("tinggal bersama");

  // Tanggal lengkap bila ada; kalau tidak, bulan dan tahunnya saja.
  const tanggalNikah = (() => {
    const teks = String(kalimatNikah || "");
    const lengkap = teks.match(
      new RegExp(`\\b(\\d{1,2})\\s+(${BULAN.join("|")})\\s+(\\d{4})\\b`, "i")
    );
    if (lengkap) {
      const namaBulan = BULAN.find((b) => b.toLowerCase() === lengkap[2].toLowerCase());
      return `${lengkap[1]} ${namaBulan} ${lengkap[3]}`;
    }
    return ambilBulanTahun(kalimatNikah).nilai || "";
  })();

  // 19 Okt 2026: tempat menikah (wilayah KUA) dari posita cerai - untuk jawaban "menikah pada ... di ...".
  // Gagal membaca = kosong; tidak pernah menggagalkan fakta lain.
  const tempatNikah = (() => {
    try {
      return require("./deteksi/cerai").tempatNikahCerai(butir).nilai || "";
    } catch (_galat) {
      return "";
    }
  })();

  // "dikaruniai 2 orang anak", "dikaruniai dua orang anak", "mempunyai 3 anak".
  // Butir 14: kalimat KARUNIA lebih dahulu ("di karuniai seorang anak",
  // "1 ( satu) orang anak", "tidak dikaruniai keturunan"); kalimat pertama
  // yang memuat "anak" tinggal cadangan.
  const anakKarunia = jumlahAnakPosita(butir);
  const jumlahAnak = anakKarunia.nilai || (() => {
    const teks = String(kalimatAnak || "").toLowerCase();
    if (/belum (?:di)?karuniai|belum mempunyai anak|tidak mempunyai anak|belum ada anak/.test(teks)) {
      return "belum mempunyai anak";
    }
    const cocok = teks.match(
      /(?:dikaruniai|karuniai|mempunyai|memiliki|lahir)\s+(?:sebanyak\s+)?(\d+|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan)\s*(?:\(\s*[a-z]+\s*\)\s*)?(?:orang\s+)?anak/
    );
    return cocok ? `${cocok[1]} orang anak` : "";
  })();

  // Nama tempat sesudah "bertempat tinggal di ...". Dipotong pada tanda baca:
  // posita menyambung kalimatnya panjang, dan menyalin seluruh sisa kalimat ke
  // jawaban saksi menghasilkan kalimat yang tidak dapat dibaca.
  // Butir 14: riwayat tinggal sesudah menikah lebih dahulu (tempat pertama =
  // kediaman bersama); bentuk lama tinggal cadangan.
  const riwayat = riwayatTinggalPosita(butir);
  const kediaman = (riwayat.tempat[0] && riwayat.tempat[0].tempat) || (() => {
    const cocok = String(kalimatKediaman || "").match(
      /(?:bertempat tinggal|kediaman bersama|tinggal bersama)\s+(?:di|pada)\s+([^;,.]{3,80})/i
    );
    return cocok ? cocok[1].trim() : "";
  })();
  const sisiAnak = anakIkutPosita(butir);
  const anakIkut = sisiAnak === "pelaku" ? pelaku || "Tergugat" : sisiAnak === "lawan" ? lawan || "Penggugat" : "";
  // 19 Okt 2026: tempat tinggal sekarang tiap pihak - dari posita; bila posita tidak menyebut, alamat pihak di SIPP
  // (o.alamatPihak, dibaca rute dengan batas waktu). Posita menang atas SIPP.
  const tempatKiniPosisi = tempatKiniPosita(butir, pelaku, lawan);
  const alamatSipp = o.alamatPihak && typeof o.alamatPihak === "object" ? o.alamatPihak : {};
  // 26 Okt 2026: ekor wilayah ganda dari SIPP/e-Court dibuang lebih dulu (alamatPihakRapi, kembaran perapi portal).
  const bersihAlamat = (a) =>
    String(rapikanAlamatPihak(a).alamat || "")
      .replace(/\s+/g, " ")
      .replace(/[\s,;.]+$/, "")
      .trim();
  const tempatKini = {
    lawan: tempatKiniPosisi.lawan || bersihAlamat(alamatSipp.lawan),
    pelaku: tempatKiniPosisi.pelaku || bersihAlamat(alamatSipp.pelaku),
    asalLawan: tempatKiniPosisi.lawan ? "posita" : bersihAlamat(alamatSipp.lawan) ? "sipp" : "",
    asalPelaku: tempatKiniPosisi.pelaku ? "posita" : bersihAlamat(alamatSipp.pelaku) ? "sipp" : "",
  };

  // Butir 27 - "puncak ... terjadi (pada) <waktu>": hanya waktu yang langsung
  // menyusul kata 'terjadi' di kalimat puncak itu sendiri.
  const puncak = (() => {
    for (const b of butir) {
      const m = b.match(/puncak\w*[^.;]{0,140}?\bterjadi\b/i);
      if (!m) continue;
      const ujung = m.index + m[0].length;
      const w = waktuPosita(b).find((x) => x.indeks >= ujung && x.indeks - ujung <= 30);
      if (w) return { nilai: w.nilai, kalimat: b };
    }
    return { nilai: "", kalimat: "" };
  })();

  return {
    awalKonflik: awal.nilai,
    puncak: puncak.nilai,
    penyebab: sebab.nilai,
    pisahSejak: sejak.nilai,
    lamaPisah,
    // true = dihitung dari pisahSejak sampai tanggal sidang, bukan tertulis.
    lamaPisahDihitung,
    siapaPergi,
    tanggalNikah,
    tempatNikah,
    jumlahAnak,
    kediaman,
    // Butir 14 - fakta tambahan untuk melengkapi jawaban yang dahulu tertinggal.
    // tempatTinggal: riwayat [{tempat, lama}] sesudah menikah (pertama = kediaman).
    tempatTinggal: riwayat.tempat,
    tidakPernahSerumah: riwayat.tidakPernahSerumah,
    // Pada siapa anak tinggal sekarang (sebutan), atau "".
    anakIkut,
    tempatKini,
    // Posita memang menceritakan perpisahan tempat tinggal - dasar kalimat
    // "sejak sebelum perkara ini diajukan" bila tanggal dan lamanya tidak ada.
    adaPisah: butirPisah(butir).length > 0,
    // Kalimat posita asal tiap fakta - untuk diperiksa petugas, bukan dicetak.
    sumber: {
      awalKonflik: awal.kalimat,
      puncak: puncak.kalimat,
      penyebab: sebab.kalimat,
      pisahSejak: sejak.kalimat,
      lamaPisah: lamaPisahDihitung ? sejak.kalimat : lama.kalimat,
      siapaPergi: pergi.kalimat,
    },
  };
}

/** "2026-10-05" (SIPP) -> "05/10/2026" (uraikanTanggal); bentuk lain apa adanya. */
function tanggalKeTeks(tanggal) {
  const t = String(tanggal || "").trim();
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : t;
}

/**
 * Mengisi satu jawaban templat dari fakta gugatan. Pulang jawaban yang sama
 * bila tidak ada yang dapat diisi - pemanggil yang memutuskan apakah ia masih
 * perlu dilaporkan.
 */
function lengkapiJawabanTemplat({ tanya, jawab, fakta }) {
  let hasil = String(jawab || "");
  // Lebih longgar daripada POLA_BELUM_TERISI, yang menuntut tiga titik atau
  // tiga garis bawah. Templat ABT juga memakai satu garis bawah - "_ kali",
  // "sejak _" - dan itu sama kosongnya bagi yang membacanya.
  if (!/\.{3,}|_+|melihat\/mendengar|dilihat\/didengar|\bXX+\b/i.test(hasil) && !POLA_PILIHAN_SEBUTAN_TEKS.test(hasil)) {
    return hasil;
  }

  // Titik-titik atau garis bawah, di mana pun letaknya dalam kalimat.
  const ganti = (nilai) => {
    if (!nilai) return false;
    const semula = hasil;
    hasil = hasil.replace(/\.{3,}|_+/, String(nilai));
    return hasil !== semula;
  };

  // Urutannya bukan selera. Yang lebih khusus diperiksa lebih dahulu, sebab
  // "sejak kapan mereka pisah rumah" memuat kata "pisah" DAN kata "kapan" -
  // dan pola yang lebih longgar akan menelannya bila didahulukan.
  // Lama pisah yang DIHITUNG (bukan tertulis) selalu bertaksiran: "kurang
  // lebih" ditambahkan bila templatnya belum menyebutnya.
  const lamaUntuk = (sebelumKosong) => {
    if (!fakta.lamaPisah) return "";
    if (fakta.lamaPisahDihitung && !/(kurang\s+lebih|sekitar|kira-kira|±)\s*$/i.test(sebelumKosong)) {
      return `kurang lebih ${fakta.lamaPisah}`;
    }
    return fakta.lamaPisah;
  };
  const depanKosong = () => hasil.slice(0, Math.max(0, hasil.search(/\.{3,}|_+/)));

  // 19 Okt 2026: "suami isteri yang sah, menikah pada ... di ..." (pertanyaan hubungan pihak) - tanggal dan tempat menikah dari
  // posita. Pertanyaan "kapan menikah" tetap lewat cabang khususnya di bawah (titik-titik pertamanya = tanggal).
  if (!/kapan.*(menikah|nikah|kawin)|(menikah|perkawinan).*kapan|tanggal.*nikah/i.test(tanya)) {
    if (fakta.tanggalNikah) hasil = hasil.replace(/(\b(?:menikah|nikah|kawin)\s+pada\s+(?:tanggal\s+)?)(?:\.{3,}|_+)/i, (_m, depan) => `${depan}${fakta.tanggalNikah}`);
    if (fakta.awalKonflik) hasil = hasil.replace(/(\bsejak\s+)(?:\.{3,}|_+)(?=[^;]{0,40}\btidak\s+rukun\b)/i, (_m, depan) => `${depan}${fakta.awalKonflik}`);
    if (fakta.tempatNikah) hasil = hasil.replace(/(\b(?:menikah|nikah|kawin)\s+pada\s+(?:tanggal\s+)?[^;.]{0,40}?\s+di\s+)(?:\.{3,}|_+)/i, (_m, depan) => `${depan}${fakta.tempatNikah}`);
  }

  // 19 Okt 2026: "sekarang P tinggal di ... dan T tinggal di ..." - tempat tinggal sekarang dari posita (atau alamat pihak di SIPP).
  // Pihak yang tempatnya tidak terbaca tetap bertitik-titik.
  if (fakta.tempatKini && /masing-masing\s+tinggal|tinggal\s+di\s+mana/i.test(tanya)) {
    hasil = hasil.replace(/\b(penggugat|pemohon|tergugat|termohon)(\s+(?:kini\s+|sekarang\s+)?tinggal\s+di\s+)(?:\.{3,}|_+)/gi, (m, pihak, tengah) => {
      const tempat = /tergugat|termohon/i.test(pihak) ? fakta.tempatKini.pelaku : fakta.tempatKini.lawan;
      return tempat ? `${pihak}${tengah}${tempat}` : m;
    });
  }

  // Butir 27: "puncak perselisihan ... terjadi pada ..." (templat A1/A3) dan
  // "sering terjadi perselisihan ..., dan kapan mulai terjadi?" - bentuk
  // yang dahulu tidak dikenali sehingga titik-titiknya selalu tertinggal.
  if (/puncak/i.test(tanya)) ganti(fakta.puncak);
  else if (/kapan.*(selisih|tengkar)|(selisih|tengkar).*(sejak|kapan)/i.test(tanya)) ganti(fakta.awalKonflik);
  else if (/penyebab|\bsebab\b|apa\s+alasan/i.test(tanya) && !/bagaimana|dari\s+mana/i.test(tanya)) {
    // Butir 24 - "yang saya tahu yaitu ..." diisi penyebab yang didalilkan
    // posita (penyebabPosita); tanpa itu tetap titik-titik.
    ganti(fakta.penyebab);
  } else if (/berapa lama.*pisah|lama.*berpisah/i.test(tanya)) ganti(lamaUntuk(depanKosong()));
  else if (/pisah|serumah|satu rumah|masih tinggal bersama/i.test(tanya)) {
    if (fakta.pisahSejak) {
      ganti(fakta.pisahSejak);
      // "... sejak ....., kira-kira sampai sekarang sudah sekitar ........
      // tahun/bulan" (A1/A3) - satuan pilihan diganti lama pisahnya.
      if (fakta.lamaPisah) hasil = hasil.replace(/(?:\.{3,}|_+)\s*(?:tahun\s*\/\s*bulan|bulan\s*\/\s*tahun)/i, fakta.lamaPisah);
    } else if (fakta.lamaPisah && /(?:\.{3,}|_+)\s*(?:tahun\s*\/\s*bulan|bulan\s*\/\s*tahun)/i.test(hasil)) {
      // Templat punya tempat lamanya sendiri: "sejak ....." tetap menunggu.
      hasil = hasil.replace(/(?:\.{3,}|_+)\s*(?:tahun\s*\/\s*bulan|bulan\s*\/\s*tahun)/i, fakta.lamaPisah);
    } else if (fakta.lamaPisah && /\bsejak\s*(?:\.{3,}|_+)/i.test(hasil)) {
      // Hanya lamanya yang diketahui: "sejak 2 tahun" bukan kalimat -
      // "sejak ..." menjadi "selama kurang lebih 2 tahun".
      const isi = /^kurang\s+lebih\b/i.test(lamaUntuk("")) ? lamaUntuk("") : `kurang lebih ${fakta.lamaPisah}`;
      hasil = hasil.replace(/\bsejak\s*(?:\.{3,}|_+)/i, `selama ${isi}`);
    } else ganti(lamaUntuk(depanKosong()));
  } else if (/siapa.*(meninggalkan|pergi)/i.test(tanya)) {
    // "adalah Penggugat/Tergugat" - templat menyerahkan pilihannya. Diisi
    // hanya bila gugatan menyebut siapa yang pergi; selain itu tetap pilihan
    // dan ditandai perlu diisi, bukan ditebak.
    if (fakta.siapaPergi && POLA_PILIHAN_SEBUTAN_TEKS.test(hasil)) {
      hasil = hasil.replace(POLA_PILIHAN_SEBUTAN_TEKS, fakta.siapaPergi);
    } else ganti(fakta.siapaPergi);
  }
  // Tiga fakta yang selalu ditanyakan dan selama ini diketik sendiri.
  else if (/kapan.*(menikah|nikah|kawin)|(menikah|perkawinan).*kapan|tanggal.*nikah/i.test(tanya)) {
    ganti(fakta.tanggalNikah);
  } else if (/berapa.*anak|anak.*berapa|dikarunia|keturunan/i.test(tanya)) {
    // Butir 14: "dikarunia" - templat A1/A3 menulis "sudah dikarunia anak?"
    // (tanpa i), sehingga pertanyaannya dahulu tidak pernah dikenali.
    // Templat kerap SUDAH menyebut "anak" sesudah titik-titiknya - "dikaruniai
    // ........... anak". Menyisipkan "2 orang anak" ke situ menerbitkan
    // "dikaruniai 2 orang anak anak".
    const templatSudahMenyebut = /(?:\.{3,}|_+)\s*(?:orang\s+)?anak/i.test(hasil);
    // "#0046# dan #0047# #8535#" (templat 04) - titik-titiknya langsung sesudah
    // sebutan, tanpa kata kerja: "Penggugat dan Tergugat 3 orang anak" tidak
    // terbaca. Kata kerjanya ikut dipasang.
    const tanpaKataKerja = /\b(?:penggugat|tergugat|pemohon|termohon)\s*$/i.test(depanKosong());
    if (tanpaKataKerja && fakta.jumlahAnak) {
      ganti(fakta.jumlahAnak === "belum mempunyai anak" ? "belum dikaruniai anak" : `telah dikaruniai ${fakta.jumlahAnak}`);
    } else if (!templatSudahMenyebut) ganti(fakta.jumlahAnak);
    else if (/^\d+\s+orang\s+anak$/.test(fakta.jumlahAnak)) {
      // "dikaruniai ... orang anak" - hanya angkanya; "dikaruniai ... anak" -
      // angka dan "orang". Dahulu selalu "N orang": "2 orang orang anak".
      const sudahOrang = /(?:\.{3,}|_+)\s*orang\s+anak/i.test(hasil);
      ganti(fakta.jumlahAnak.replace(sudahOrang ? /\s+orang\s+anak$/ : /\s+anak$/, ""));
    }
    // "belum mempunyai anak" sengaja TIDAK dipasang pada templat berpola itu:
    // hasilnya "dikaruniai belum mempunyai anak anak". Dibiarkan bertitik-titik
    // dan tetap ditandai perlu diisi - kalimat yang kacau di berita acara lebih
    // buruk daripada satu titik-titik yang jelas menunggu petugas.
  } else if (/di ?mana.*(tinggal|kediaman|berdiam)|tempat tinggal|alamat.*tinggal|tinggal bersama di tempat lain/i.test(tanya)) {
    // Butir 14: riwayat tempat tinggal sesudah menikah - "tinggal bersama di
    // ...... pernah juga tinggal bersama di ....... dan terakhir tinggal
    // bersama di ......" (A1/A3) diisi berurutan dari posita; bagian yang
    // tempatnya tidak tertulis dibuang di rapikanSisaIsian, bukan dikarang.
    hasil = isiRiwayatTinggal(hasil, tanya, fakta);
  }

  // Butir 14: "sebanyak .... kali" di pertanyaan melihat/mendengar (A1/A3) -
  // bukan hanya pada pertanyaan "berapa kali".
  if (/melihat|mendengar|menyaksikan/i.test(tanya)) {
    hasil = hasil.replace(/\s*,?\s*sebanyak\s+(?:_+|\.{3,}|…)\s*kali/i, " beberapa kali");
  }

  // "_ kali" - berapa kali saksi menyaksikan. Tidak ada di gugatan mana pun,
  // dan angka karangan pada berita acara adalah keterangan palsu. Yang
  // dipakai sebutan yang jujur.
  if (/berapa kali/i.test(tanya)) {
    // "kurang lebih _ kali" ikut dibuang: "kurang lebih beberapa kali" menaksir
    // sesuatu yang sudah taksiran (4 kali pada ukuran 25 September 2026).
    hasil = hasil.replace(/(?:kurang lebih\s+|sekitar\s+)?(?:_+|\.{3,})\s*kali/i, "beberapa kali");
  }

  // "melihat/mendengar" - templat menyerahkan pilihannya kepada petugas.
  //
  // Digabung menjadi "melihat dan mendengar" supaya kalimatnya utuh dibaca,
  // TETAPI barisnya tetap ditandai menunggu keterangan saksi yang sesungguhnya
  // - lihat PILIHAN_TEMPLAT di bawah. Saksi yang hanya MENDENGAR pertengkaran
  // dari balik dinding tidak melihatnya, dan berita acara yang menuliskan
  // keduanya menaikkan nilai kesaksiannya tanpa saksi itu mengatakannya. Itu
  // persis jenis karangan yang dihindari fungsi ini pada tanggal dan nama.
  hasil = hasil
    .replace(/\bmelihat\/mendengar\b/gi, "melihat dan mendengar")
    .replace(/\bdilihat\/didengar\b/gi, "dilihat dan didengar");

  return hasil;
}

/** Titik-titik/garis bawah templat sebagai sumber pola (butir 14). */
const SLOT = String.raw`(?:\.{3,}|_+|\u2026)`;
const POLA_SLOT = new RegExp(SLOT);

/**
 * Riwayat tempat tinggal ke dalam templat (butir 14). Slot "di ......" diisi
 * berurutan dari fakta.tempatTinggal; "selama ...." sesudahnya diisi lama
 * tinggal di tempat itu bila tertulis. Bagian yang tempatnya tidak ada
 * dibiarkan bertitik-titik - rapikanSisaIsian yang membuangnya.
 */
function isiRiwayatTinggal(teks, tanya, fakta) {
  let hasil = String(teks || "");
  const tempat = Array.isArray(fakta.tempatTinggal) && fakta.tempatTinggal.length
    ? fakta.tempatTinggal
    : fakta.kediaman
      ? [{ tempat: fakta.kediaman, lama: "" }]
      : [];
  if (!tempat.length) return hasil;
  const ruasDi = new RegExp(`\\bdi\\s+${SLOT}(\\s*,?\\s*selama\\s+${SLOT})?`, "gi");
  const banyak = (hasil.match(ruasDi) || []).length;
  if (!banyak) {
    // "#8491#" kosong tanpa kata "di" di depannya - tempat pertama saja.
    return hasil.replace(new RegExp(SLOT), tempat[0].tempat);
  }
  // A3#14 "pernah juga tinggal bersama di ... dan terakhir ... di ..." -
  // pertanyaannya tentang tempat LAIN: tempat pertama sudah dijawab A3#13.
  const tempatLain = /tempat lain/i.test(tanya) || /^\s*\S+\s+dan\s+\S+\s+(?:juga\s+)?pernah\s+juga/i.test(hasil);
  let daftar = tempatLain ? tempat.slice(1) : tempat.slice();
  if (!daftar.length) return hasil;
  // Banyak tempat, sedikit slot: tempat tengah digabung ke slot tengah, yang
  // terakhir tetap di slot "terakhir".
  if (daftar.length > banyak && banyak >= 2) {
    const tengah = daftar.slice(banyak - 2, daftar.length - 1);
    daftar = [
      ...daftar.slice(0, banyak - 2),
      { tempat: tengah.map((x) => x.tempat).join(", "), lama: tengah.length === 1 ? tengah[0].lama : "" },
      daftar[daftar.length - 1],
    ];
  }
  // Dua tempat pada tiga slot (pertama, "pernah juga", "terakhir"): yang
  // kedua ke slot terakhir; slot tengah tetap kosong lalu dibuang.
  const urutanSlot =
    banyak >= 3 && daftar.length === 2 ? [daftar[0], null, daftar[1]] : daftar.slice(0, banyak);
  let ke = 0;
  hasil = hasil.replace(ruasDi, (ruas, selama) => {
    const x = urutanSlot[ke++];
    if (!x) return ruas;
    const lamaBagian = selama ? (x.lama ? `, selama ${x.lama}` : selama) : "";
    return `di ${x.tempat}${lamaBagian}`;
  });
  return hasil;
}

/** Pola rapikanSisaIsian disinggahkan: sumbernya sama pada tiap jawaban (butir 14). */
const SINGGAHAN_POLA_SISA = new Map();
function rxSisa(sumber, bendera) {
  const kunci = `${bendera || ""}|${sumber}`;
  let pola = SINGGAHAN_POLA_SISA.get(kunci);
  if (!pola) {
    pola = new RegExp(sumber, bendera);
    if (SINGGAHAN_POLA_SISA.size < 500) SINGGAHAN_POLA_SISA.set(kunci, pola);
  }
  pola.lastIndex = 0;
  return pola;
}

/**
 * ============================================================================
 * SISA TITIK-TITIK - DITURUNKAN DENGAN LOGIKA, ATAU DIRAPIKAN TANPA MENGARANG
 * ============================================================================
 *
 * Butir 14 (6 Oktober 2026). Sesudah diisi dari posita, sebagian jawaban
 * templat masih memuat titik-titik yang memang tidak tertulis di gugatan:
 * hubungan saksi, di mana ia melihat pertengkaran, oleh siapa didamaikan.
 * Dahulu titik-titik itu dicetak apa adanya - "Saya kenal dengan Pemohon karena
 * saya adalah ...;" - dan berita acara yang tersimpan berbunyi begitu.
 *
 * Tiga jalan, berurutan:
 *   1. DITURUNKAN dari fakta posita dengan logika yang dapat diperiksa:
 *      awal perselisihan yang tidak bertanggal menjadi "beberapa waktu sebelum
 *      mereka berpisah tempat tinggal pada <tanggal pisah>"; puncak yang tidak
 *      bertanggal menjadi peristiwa perpisahannya; lama pisah tanpa tanggal
 *      menjadi "sejak sebelum perkara ini diajukan" (posita yang menyebut
 *      pisah ditulis SEBELUM perkara didaftarkan).
 *   2. DIJADIKAN PILIHAN bila jawabannya salah satu dari dua dan datanya tidak
 *      ada (siapa yang pergi, sudah/belum ada anak, ada/tidaknya upaya
 *      damai): petugas wajib memilih sebelum menyimpan - panel menahannya.
 *   3. DIRAPIKAN - bagian yang hanya diketahui saksi dibuang dari kalimatnya
 *      ("karena saya adalah ...", ", di ........", "oleh ....") sehingga
 *      kalimatnya tetap utuh dan benar; barisnya tetap ditandai perluDiisi
 *      supaya petugas menambahkannya dari keterangan saksi yang sesungguhnya.
 *
 * Tidak ada yang dikarang: tidak ada hubungan saksi, tempat, jumlah, atau
 * nama yang tidak tertulis di posita.
 *
 * @returns {{jawab:string, pilihan:string[]|null, diturunkan:boolean, dibuang:boolean}}
 */
function rapikanSisaIsian({ tanya, jawab, fakta, pelaku, lawan, daftar }) {
  const f = fakta || {};
  const P1 = String(lawan || "").trim() || "Penggugat";
  const P2 = String(pelaku || "").trim() || "Tergugat";
  const keluar = { jawab: String(jawab || ""), pilihan: null, diturunkan: false, dibuang: false };
  let t = keluar.jawab;
  const q = String(tanya || "");
  const ubah = (pola, isi, jenis) => {
    const semula = t;
    t = t.replace(pola, isi);
    if (t !== semula) keluar[jenis === "turun" ? "diturunkan" : "dibuang"] = true;
    return t !== semula;
  };
  const sebutan = String.raw`(?:penggugat|tergugat|pemohon|termohon|${P1.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}|${P2.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`;

  // --- Anak ---------------------------------------------------------------
  // ", anak tersebut saat ini tinggal dengan Pemohon / Termohon" - pilihan pihak.
  const polaAnakIkut = /(\s*,?\s*(?:dan\s+)?anak(?:-anak)?\s+(?:tersebut\s+)?(?:saat\s+ini\s+|sekarang\s+)?(?:tinggal|ikut|berada)\s+(?:bersama\s+)?(?:dengan\s+)?)([^,;]*?\/[^,;]*?)(?=\s*[;.,]|$)/i;
  if (polaAnakIkut.test(t)) {
    if (f.anakIkut) ubah(polaAnakIkut, `$1${f.anakIkut}`, "turun");
    else ubah(polaAnakIkut, "", "buang");
  }
  // 19 Okt 2026: "anak tersebut tinggal bersama ..." - diisi hanya bila posita jelas menyebut pada siapa anak tinggal/diasuh.
  const polaAnakTitik = rxSisa(`(\\banak(?:-anak)?\\s+(?:tersebut\\s+)?(?:saat\\s+ini\\s+|sekarang\\s+)?(?:tinggal|ikut|berada)\\s+(?:bersama\\s+)?(?:dengan\\s+)?)${SLOT}`, "i");
  if (f.jumlahAnak === "belum mempunyai anak") {
    // Belum punya anak: tidak ada "anak tersebut tinggal bersama ..." yang perlu diisi.
    ubah(rxSisa(`\\s*,?\\s*(?:dan\\s+)?(?:sekarang\\s+|saat\\s+ini\\s+)?anak(?:-anak)?\\s+tersebut\\s+[^;.]*${SLOT}`, "i"), "", "buang");
  } else if (f.anakIkut && polaAnakTitik.test(t)) ubah(polaAnakTitik, `$1${f.anakIkut}`, "turun");
  // "bahkan telah dikaruniai ..... orang anak" (A2#3).
  const polaBahkanAnak = rxSisa(`\\s*,?\\s*bahkan\\s+(?:telah|sudah)\\s+dikaruniai\\s+${SLOT}\\s*(?:orang\\s+)?anak`, "i");
  if (polaBahkanAnak.test(t)) {
    if (f.jumlahAnak === "belum mempunyai anak") ubah(polaBahkanAnak, ", namun belum dikaruniai anak", "turun");
    else ubah(polaBahkanAnak, "", "buang");
  }
  // "sudah dikaruniai ... orang anak" tanpa jumlah tertulis. Posita yang
  // menyebut BELUM punya anak membalik kalimatnya; tanpa keterangan apa pun
  // kalimatnya menjadi pilihan sudah/belum (pada jawaban berpilihan, pilihan
  // "belum" templat sendiri yang dipakai - pilihan buatan ini diabaikan).
  const polaAnakSlot = rxSisa(`(?:(?:sudah|telah)\\s+)?(dikaruniai)\\s+${SLOT}\\s*(?:orang\\s+)?anak`, "i");
  if (polaAnakSlot.test(t)) {
    if (f.jumlahAnak === "belum mempunyai anak") ubah(polaAnakSlot, "belum dikaruniai anak", "turun");
    else {
      const sudah = t.replace(polaAnakSlot, (m) => m.replace(rxSisa(`\\s+${SLOT}\\s*(?:orang\\s+)?anak`, "i"), " anak"));
      const belum = t
        .replace(polaAnakSlot, "belum dikaruniai anak")
        .replace(/\s*,?\s*(?:dan\s+)?anak(?:-anak)?\s+tersebut\b[^;.]*/i, "");
      keluar.pilihan = [sudah, belum];
      t = sudah;
      keluar.dibuang = true;
    }
  }
  // "#0046# dan #0047# #8535#" kosong (04): sudah atau belum - dipilih petugas.
  const anakTanpaKerja = rxSisa(`^(.*\\b${sebutan}\\s+(?:dan|dengan)\\s+${sebutan})\\s*${SLOT}\\s*[;.]?$`, "i");
  if (/dikarunia|anak|keturunan/i.test(q) && anakTanpaKerja.test(t)) {
    const dasar = t.match(anakTanpaKerja)[1];
    keluar.pilihan = [`${dasar} sudah dikaruniai anak`, `${dasar} belum dikaruniai anak`];
    t = keluar.pilihan[0];
    keluar.dibuang = true;
  }

  // --- Hubungan saksi (hanya diketahui saksi) ------------------------------
  ubah(rxSisa(`\\s*,?\\s*(?:karena\\s+)?saya\\s+(?:adalah\\s+)?${SLOT}(?=\\s*[;.]?\\s*$)`, "i"), "", "buang");
  const hubunganDua = rxSisa(`^((?:ya|iya)\\s*,\\s*)?(${sebutan})\\s+adalah\\s+${SLOT}\\s+dan\\s+(${sebutan})\\s+adalah\\s+${SLOT}\\s*[;.]?\\s*$`, "i");
  if (hubunganDua.test(t)) {
    const m = t.match(hubunganDua);
    t = `${m[1] || ""}saya mempunyai hubungan keluarga dengan ${m[2]} dan ${m[3]}`;
    keluar.dibuang = true;
  }

  // --- Tempat tinggal -------------------------------------------------------
  if (/tinggal|kediaman|berdiam|alamat/i.test(q) && !/pisah|serumah|satu rumah|masih tinggal/i.test(q) && !/siapa.*(meninggalkan|pergi)/i.test(q)) {
    ubah(rxSisa(`\\s*,?\\s*(?:juga\\s+)?pernah\\s+juga\\s+tinggal\\s+bersama\\s+di\\s+${SLOT}(?:\\s*,?\\s*selama\\s+${SLOT})?`, "i"), "", "buang");
    ubah(rxSisa(`\\s*,?\\s*dan\\s+terakhir\\s+(?:mereka\\s+)?tinggal\\s+bersama\\s+di\\s+${SLOT}(?:\\s*,?\\s*selama\\s+${SLOT})?`, "i"), "", "buang");
    ubah(rxSisa(`\\s*,?\\s*selama\\s+${SLOT}`, "gi"), "", "buang");
    ubah(rxSisa(`\\s+(?:di|pada)\\s+${SLOT}`, "gi"), "", "buang");
    // "P dan T juga pernah tinggal bersama di ... dan terakhir ..." tanpa satu
    // pun tempat tersisa - tinggal subjeknya.
    if (/^\s*\S+\s+dan\s+\S+\s*$/i.test(t.replace(/[;.]\s*$/, ""))) {
      t = `${t.replace(/[;.]\s*$/, "")} pernah tinggal bersama di tempat lain`;
    }
  }

  // --- Menyaksikan ----------------------------------------------------------
  if (/melihat|mendengar|menyaksikan/i.test(q)) {
    ubah(rxSisa(`\\s*,?\\s*sebanyak\\s+${SLOT}\\s*kali`, "i"), " beberapa kali", "buang");
    const polaTerjadi = rxSisa(`\\s*,?\\s*terjadinya\\s+kira-kira\\s+${SLOT}`, "i");
    if (polaTerjadi.test(t)) {
      if (f.awalKonflik) ubah(polaTerjadi, `, terjadinya kira-kira sejak ${f.awalKonflik}`, "turun");
      else ubah(polaTerjadi, "", "buang");
    }
    ubah(rxSisa(`\\s*,?\\s*di\\s+${SLOT}`, "i"), "", "buang");
    ubah(rxSisa(`\\s+saya\\s+tahu\\s+karena\\s+${SLOT}`, "i"), " saya mengetahuinya", "buang");
  }

  // --- Upaya rukun ----------------------------------------------------------
  if (POLA_TANYA_UPAYA_RUKUN.test(q) || /rukun|damai/i.test(q)) {
    ubah(rxSisa(`\\s+oleh\\s+${SLOT}\\s*,?`, "gi"), ",", "buang");
    ubah(rxSisa(`\\s+karena\\s+${SLOT}`, "gi"), "", "buang");
    if (POLA_TANYA_UPAYA_RUKUN.test(q) && jawabanKosong(t)) {
      keluar.pilihan = [
        `${P1} dan ${P2} sudah pernah diupayakan untuk rukun kembali, namun tidak berhasil`,
        `Belum pernah ada upaya untuk merukunkan ${P1} dan ${P2}`,
      ];
      t = keluar.pilihan[0];
      keluar.dibuang = true;
    }
  }

  // --- Siapa yang pergi -----------------------------------------------------
  if (/siapa.*(meninggalkan|pergi)/i.test(q)) {
    // 19 Okt 2026: hanya slot pelakunya ("adalah ..." / "adalah P/T"); slot lain pada kalimat yang sama (mis. "P tinggal di ...")
    // bukan pilihan pihak, jadi tidak lagi diisi nama pihak ("tinggal di Penggugat"). Templat lama tanpa kata "adalah" dan
    // dengan satu slot saja tetap memakai bentuk lama.
    const polaAdalah = rxSisa(`(\\badalah\\s+)(?:\\b${sebutan}\\s*\\/\\s*${sebutan}\\b|${SLOT})`, "i");
    const polaLamaPihak = new RegExp(`\\b${sebutan}\\s*\\/\\s*${sebutan}\\b|${SLOT}`, "i");
    const banyakSlot = (t.match(new RegExp(SLOT, "g")) || []).length;
    const polaPilihanPihak = polaAdalah.test(t) ? polaAdalah : banyakSlot <= 1 && polaLamaPihak.test(t) ? polaLamaPihak : null;
    if (polaPilihanPihak) {
      const isi = (nama) => t.replace(polaPilihanPihak, (_m, depan) => `${depan || ""}${nama}`);
      keluar.pilihan = [isi(P1), isi(P2)];
      t = keluar.pilihan[0];
      keluar.dibuang = true;
    }
  }

  // --- Pisah: sejak kapan dan berapa lama -----------------------------------
  if (/pisah|serumah|satu rumah|masih tinggal|berapa lama/i.test(q)) {
    // Lama tidak tertulis: ", kira-kira sampai sekarang sudah sekitar ........
    // tahun/bulan" dibuang lebih dahulu. Lalu "sejak ....., kira-kira sampai
    // sekarang sudah sekitar 1 tahun" - lama tertulis, sejaknya tidak:
    // "sejak ....." dibuang.
    ubah(rxSisa(`\\s*,?\\s*kira-kira\\s+sampai\\s+sekarang\\s+sudah\\s+sekitar\\s+${SLOT}\\s*(?:tahun\\s*\\/\\s*bulan|bulan\\s*\\/\\s*tahun)?`, "i"), "", "buang");
    ubah(rxSisa(`\\s*sejak\\s+${SLOT}\\s*(,\\s*kira-kira)`, "i"), "$1", "buang");
    const sejakSebelum = f.adaPisah ? " sejak sebelum perkara ini diajukan" : "";
    if (ubah(rxSisa(`\\s*sejak\\s+${SLOT}`, "i"), sejakSebelum, sejakSebelum ? "turun" : "buang") && sejakSebelum) keluar.dibuang = true;
    const polaLama = rxSisa(`\\s*(?:sudah\\s+)?(?:selama\\s+)?(?:kurang\\s+lebih|lebih\\s+kurang|sekitar|kira-kira)?\\s*${SLOT}\\s*(?:tahun\\s*\\/\\s*bulan|bulan\\s*\\/\\s*tahun)?(?:\\s*lamanya)?`, "i");
    if (polaLama.test(t)) {
      // 19 Okt 2026: "sejak sebelum perkara ini diajukan" cukup sekali (slot sejak dan slot lama bersama-sama bertitik-titik
      // dahulu menghasilkan kalimat ganda).
      const sudahSejak = /sejak\s+sebelum\s+perkara\s+ini\s+diajukan/i.test(t);
      const gantiLama = sudahSejak ? "" : sejakSebelum;
      if (ubah(polaLama, gantiLama, gantiLama ? "turun" : "buang") && gantiLama) keluar.dibuang = true;
    }
  }

  // --- Awal perselisihan dan puncaknya --------------------------------------
  const sebelumPisah = f.pisahSejak
    ? `beberapa waktu sebelum mereka berpisah tempat tinggal pada ${f.pisahSejak}`
    : f.adaPisah
      ? "beberapa waktu sebelum mereka berpisah tempat tinggal"
      : "";
  if (/puncak/i.test(q)) {
    const polaPuncak = rxSisa(`(terjadi)\\s+(?:pada\\s+)?${SLOT}`, "i");
    // 19 Okt 2026: templat "terjadi pada ... ketika ..." - slot "ketika" ikut diisi/dibuang bersama slot waktunya (dahulu
    // tertinggal "..., ketika Tergugat pergi ... ketika ...").
    const polaPuncakKetika = rxSisa(`(terjadi)\\s+(?:pada\\s+)?${SLOT}\\s*,?\\s*ketika\\s+${SLOT}`, "i");
    if (polaPuncakKetika.test(t) && (f.pisahSejak || f.adaPisah)) {
      if (f.pisahSejak) {
        const siapa = f.siapaPergi ? `, ketika ${f.siapaPergi} pergi meninggalkan tempat tinggal bersama` : ", hingga mereka berpisah tempat tinggal";
        ubah(polaPuncakKetika, `$1 pada ${f.pisahSejak}${siapa}`, "turun");
      } else ubah(polaPuncakKetika, "$1 ketika mereka akhirnya berpisah tempat tinggal", "turun");
    }
    if (polaPuncak.test(t)) {
      if (f.pisahSejak) {
        const siapa = f.siapaPergi ? `, ketika ${f.siapaPergi} pergi meninggalkan tempat tinggal bersama` : ", hingga mereka berpisah tempat tinggal";
        ubah(polaPuncak, `$1 pada ${f.pisahSejak}${siapa}`, "turun");
      } else if (f.adaPisah) {
        ubah(polaPuncak, "$1 ketika mereka akhirnya berpisah tempat tinggal", "turun");
      } else ubah(polaPuncak, "$1 sebelum perkara ini diajukan", "buang");
    }
  } else if (/kapan|sejak|mulai/i.test(q) && /selisih|tengkar|cekcok/i.test(q)) {
    const polaSejak = rxSisa(`\\bsejak\\s+${SLOT}`, "i");
    if (polaSejak.test(t)) {
      if (f.puncak) ubah(polaSejak, `sejak beberapa waktu sebelum puncaknya pada ${f.puncak}`, "turun");
      else if (sebelumPisah) ubah(polaSejak, `sejak ${sebelumPisah}`, "turun");
      // Tanpa fakta apa pun: yang pasti hanya bahwa perselisihan itu terjadi
      // sebelum perkara diajukan - ditandai perlu diisi.
      else ubah(polaSejak, "sebelum perkara ini diajukan", "buang");
    }
  }

  // --- Penyebab -------------------------------------------------------------
  if (/penyebab|\bsebab\b|apa\s+alasan/i.test(q) && !/bagaimana|dari\s+mana/i.test(q)) {
    const polaSebab = rxSisa(`((?:adalah|yaitu|yakni)\\s+)(?:karena\\s+|sebab\\s+)?${SLOT}`, "i");
    if (polaSebab.test(t)) {
      if (daftar) ubah(polaSebab, `$1${daftar}`, "turun");
      // Posita tanpa satu pun sebab yang tertulis: tidak ada perbuatan yang
      // boleh dituduhkan. Yang dapat dikatakan hanya bahwa sumbernya
      // permasalahan rumah tangga mereka - tetap ditandai perlu diisi.
      else ubah(polaSebab, "$1permasalahan dalam rumah tangga mereka", "buang");
    }
  }

  // 19 Okt 2026: sisa penanda satuan yang tidak ikut diisi ("bulan/tahun", "tahun/bulan", "tanggal/bulan/tahun") dibuang;
  // kalimat tidak pernah memuat penanda mentah. Kata yang menempel tanpa spasi dipisahkan lagi.
  t = t
    .replace(/(^|\s)(?:bulan\s*\/\s*tahun|tahun\s*\/\s*bulan|tanggal\s*\/\s*bulan(?:\s*\/\s*tahun)?|hari\s*\/\s*bulan)(?=[\s;.,]|$)/gi, "$1")
    .replace(/\b(diajukan)(?=bulan|tahun|tanggal)/gi, "$1 ");
  // Tanda baca yang tertinggal sesudah bagian dibuang.
  t = t
    .replace(/\s+([,;])/g, "$1")
    .replace(/\s+\.(?!\.)/g, ".")
    .replace(/,\s*,/g, ",")
    .replace(/,\s*([;.])/g, "$1")
    .replace(/,\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  keluar.jawab = t;
  if (keluar.pilihan) keluar.pilihan = keluar.pilihan.map((p) => p.replace(/\s{2,}/g, " ").trim());
  return keluar;
}

/**
 * Pilihan templat yang dapat DIPUTUSKAN oleh fakta posita (butir 14): "sudah
 * dikaruniai ... anak" / "belum dikaruniai anak" bila jumlah anaknya
 * tertulis; "pernah juga tinggal di tempat lain" / "tidak pernah" menurut
 * riwayat tinggalnya. -1 bila datanya tidak memutuskan apa-apa.
 */
function pilihMenurutFakta({ tanya, pilihan, fakta }) {
  if (!Array.isArray(pilihan) || pilihan.length < 2) return -1;
  const f = fakta || {};
  const cari = (pola, bukan) => pilihan.findIndex((p) => pola.test(p) && !(bukan && bukan.test(p)));
  const q = String(tanya || "");
  if (/dikarunia|keturunan|\banak\b/i.test(q)) {
    if (f.jumlahAnak === "belum mempunyai anak") return cari(/belum\s+(?:di)?karunia/i);
    if (/^\d+\s+orang\s+anak$/.test(String(f.jumlahAnak || ""))) return cari(/(?:sudah|telah)\s+dikarunia/i, /belum/i);
    return -1;
  }
  if (/tinggal/i.test(q) && !/pisah|serumah|satu rumah|masih tinggal/i.test(q)) {
    const n = Array.isArray(f.tempatTinggal) ? f.tempatTinggal.length : 0;
    if (/tempat lain/i.test(q)) {
      if (n >= 2) return cari(/pernah\s+juga/i, /tidak\s+pernah/i);
      if (n === 1) return cari(/tidak\s+pernah\s+tinggal/i);
      return -1;
    }
    if (f.tidakPernahSerumah) return cari(/tidak\s+pernah\s+tinggal/i);
    if (n >= 1) return cari(/tinggal\s+bersama\s+di|membina|bertempat/i, /tidak\s+pernah/i);
  }
  return -1;
}

/**
 * Pilihan templat yang SUDAH digabung tetapi belum dipilih orang.
 *
 * Dicocokkan pada jawaban SESUDAH pengisian: bentuk miringnya sudah hilang,
 * jadi POLA_BELUM_TERISI tidak lagi mengenalinya dan barisnya lenyap dari
 * daftar yang harus diperiksa. Yang lenyap dari daftar tidak pernah diperiksa
 * lagi - dan inilah satu-satunya butir yang menyangkut cara saksi mengetahui
 * peristiwanya, yaitu hal yang paling ditanyakan kembali di persidangan.
 */
const PILIHAN_TEMPLAT = /\b(melihat dan mendengar|dilihat dan didengar)\b/i;

/**
 * "saya adalah #1241# / #1242#" - satu templat untuk DUA saksi: hubungan
 * saksi pertama dan saksi kedua. Menyalin keduanya ke tiap saksi membuat
 * masing-masing mengaku ibu kandung SEKALIGUS tetangga (4 kali pada ukuran
 * 25 September 2026). Dipecah hanya bila templat mentahnya memang berpola
 * itu (baris.jawabMentah, bila ekstensi mengirimnya); tanpa templat mentah,
 * hanya garis miring berspasi di belakang "saya adalah" / "karena saya" -
 * bentuk "isteri/suami" tanpa spasi adalah pilihan kata, bukan dua saksi.
 */
const POLA_HUBUNGAN_DUA_MENTAH = /#\d{4}#\s*\/\s*#?\d{4}#?/;
const POLA_HUBUNGAN_DUA = /^(.*\b(?:saya adalah|karena saya|sebagai))\s+(.+?)\s+\/\s+(.+?)$/i;

function pecahHubungan(jawab, mentah) {
  if (mentah !== undefined && mentah !== null && String(mentah) !== "") {
    if (!POLA_HUBUNGAN_DUA_MENTAH.test(String(mentah))) return null;
  }
  const m = tanpaAkhiran(jawab).match(POLA_HUBUNGAN_DUA);
  if (!m) return null;
  return [`${m[1]} ${m[2]}`, `${m[1]} ${m[3]}`];
}

/**
 * Menyusun keterangan saksi dari templat pertanyaan ABT.
 *
 * @param {object} opsi
 *   templat      baris {no, tanya, jawab, jawabMentah?} hasil load_template ABT,
 *                variabelnya SUDAH terganti oleh ABT
 *   alasan       ciri alasan yang didalilkan (kunci CIRI_ALASAN); bila kosong
 *                dan posita ada, diturunkan dari posita ("sama dengan gugatan")
 *   posita, pelaku (0047), lawan (0046)
 *   nomorPerkara, kodeKumpulan   benih pemilih ragam (K7b); tanpa keduanya
 *                susunannya tetap tertentu, hanya tidak berbeda antar perkara
 *   modus        {saksi1, saksi2, ...saksi6} - bentuk lama
 *   saksi        [{ke, pihak:'P'|'T', modus, sumber, sumberNama, alasan}] -
 *                sampai 4 saksi P dan 2 saksi T; menang atas `modus`
 *   jenisPerkara, alur  syarat bentuk bergender (data.syarat)
 *   tipeKeluaran {versi, daftar:{bas.saksi.*, bersama.alasan.frasa}} (K6)
 *
 * @returns {ok, versiBank, benih, saksi1, saksi2, saksi:[{ke, pihak, modus,
 *   jawaban:[{no, tanya, jawab, perluDiisi, pilihan?, varian:{indeks,n,habis}}]}],
 *   perluDiisi, terisiDariPosita, identik, alasan, asalAlasan, modus, catatan}
 *
 * ============================================================================
 * SATU TEMPLAT, BEBERAPA SAKSI - BENTUK KALIMAT DARI KORPUS BAS PETUGAS
 * ============================================================================
 *
 * Di data PA Donggala dua saksi manusia menjawab identik pada 61,7% pasangan
 * jawaban, dan pertanyaan rumusan (maksud menghadap, nafkah, komunikasi,
 * penutup) identik 88-100%. Yang TIDAK wajar justru yang dahulu dilakukan
 * ALETA: 88,8% jawaban berpembuka (manusia sekitar 10%), separuhnya pembuka
 * yang tidak pernah dipakai manusia, dan kerangka kalimat yang sama persis
 * antar perkara (364 dari 366).
 *
 * Maka tiap jawaban kini:
 *   1. diambil dari modus saksinya, atau dari templat (pilihan berlawanan
 *      dipecah, hubungan dua saksi dipecah), lalu diisi dari gugatan;
 *   2. pertanyaan POKOK diberi bentuk berbeda per saksi dari bank BENTUK
 *      yang ditambang dari korpus (cadangannya RAGAM_KATA); pertanyaan
 *      rumusan dan lainnya mengikuti peluang manusia (PROFIL);
 *   3. diberi pembuka menurut profil manusia (sekitar 10%, tidak pada
 *      pertanyaan rumusan);
 *   4. diperiksa periksaInvarian - bentuk yang menggeser makna tidak dipakai.
 *
 * Pilihan bentuk ditentukan pemilihRagam (nomor perkara, kode kumpulan,
 * kunci pertanyaan, urutan saksi) - bukan acak. Mencetak ulang perkara yang
 * sama menghasilkan naskah yang sama persis.
 *
 * Panitera tetap memilih dan memeriksa sebelum menyimpan: yang disusun di
 * sini USULAN naskah, bukan keterangan saksi.
 */
/**
 * ============================================================================
 * JAWABAN YANG BELUM TERISI - TIDAK PERNAH DIPULANGKAN SEBAGAI "..." (butir 28)
 * ============================================================================
 *
 * Perbaikan 30 September 2026. 459/Pdt.G/2026/PA.Dgl pertanyaan 14 "Apakah
 * sejak ada masalah, Penggugat dan Tergugat pernah diupayakan untuk rukun
 * kembali?" terjawab "...;" - templat 04 ABT berbunyi "Ya, #1268#;" dan
 * variabel 1268 (Upaya Damai Keluarga) perkara itu KOSONG di ABT. Jawaban
 * titik-titik itu lolos sebagai jawaban dan tidak terbaca sebagai kosong.
 *
 * Dua aturan:
 *   1. Pertanyaan UPAYA RUKUN diisi dari data yang ada, berurutan:
 *        a. variabel 1268 (dikirim ekstensi sebagai `upayaDamai`),
 *        b. posita - kalimat upaya damai keluarga (upayaDamaiDari),
 *        c. mediasi perkara di SIPP yang tidak berhasil.
 *      Tidak ada yang dikarang: sumbernya disebut di `terisiDariData`.
 *   2. Jawaban yang SELURUHNYA kosong, "...", "…", "_", atau variabel
 *      templat yang tak terisi (#1268#) diganti TANDA_BELUM_TERISI - kalimat
 *      yang jelas bagi panel dan manusia - dan ditandai perluDiisi +
 *      belumTerisi. Titik-titik DI TENGAH kalimat ("sejak ....") tetap
 *      seperti semula (sudah ditandai perluDiisi).
 */
const TANDA_BELUM_TERISI = "[BELUM TERISI - isi dari keterangan saksi]";

const POLA_TANYA_UPAYA_RUKUN =
  /(upaya|diupayakan|diusahakan|dirukunkan|merukunkan|didamaikan|mendamaikan|dinasihati|dinasehati).{0,60}(rukun|damai)|rukun\s+kembali|upaya\s+(untuk\s+)?(merukunkan|mendamaikan|perdamaian)/i;

/** Jawaban yang isinya hanya pembuka dan tanda pengganti - tidak ada keterangan apa pun. */
function jawabanKosong(teks) {
  const inti = String(teks || "")
    // Hanya pembuka BERKOMA ("Ya, ;") - "Ya;" atau "Sudah;" sendiri adalah
    // jawaban yang sah dan tidak boleh terbaca kosong.
    .replace(/^\s*(ya|iya|benar|betul)\s*,/i, "")
    .replace(/#\d{4}#/g, "")
    .replace(/[\s.,;:_\u2026-]+/g, "");
  return inti === "";
}

/** Variabel templat yang belum terganti, mis. "#1268#". */
const POLA_VARIABEL_TERSISA = /#\d{4}#/;

/** "keluarga Tergugat", "keluarga kedua belah pihak", "orang tua Penggugat" - siapa yang merukunkan. */
const POLA_PERUKUN =
  /\b((?:pihak\s+)?keluarga(?:\s+besar)?(?:\s+(?:kedua\s+belah\s+pihak|penggugat|tergugat|pemohon|termohon|masing-masing|dari\s+kedua\s+belah\s+pihak))?(?:\s+(?:dan|dengan)\s+keluarga\s+(?:penggugat|tergugat|pemohon|termohon))?|orang\s*tua(?:\s+(?:penggugat|tergugat|pemohon|termohon|kedua\s+belah\s+pihak))?|tokoh\s+(?:masyarakat|agama)|aparat\s+desa|kepala\s+desa|pemerintah\s+desa|BP4)\b/i;

function perukunDari(kalimat) {
  const cocok = String(kalimat || "").match(POLA_PERUKUN);
  return cocok ? cocok[1].replace(/\s+/g, " ").trim() : "";
}

/**
 * Sumber jawaban upaya rukun untuk satu perkara.
 * @returns {{sumber: ""|"1268"|"posita"|"mediasi", kalimat: string, perukun: string}}
 */
function sumberUpayaDamai({ nilai1268, posita, mediasi, pelaku, lawan }) {
  const p1 = String(lawan || "").trim() || "Penggugat";
  const p2 = String(pelaku || "").trim() || "Tergugat";
  const sebut = (t) => String(t || "").replace(/#0046#/g, p1).replace(/#0047#/g, p2);

  // a. Variabel 1268 - nilai ABT perkara itu sendiri. Nilai bawaan ABT membawa
  //    "#8498#" di ekornya; variabel tersisa dibuang, sisanya dipakai bila
  //    masih berisi keterangan.
  const v = sebut(nilai1268)
    .replace(/DATA_TIDAK_ADA/gi, " ")
    .replace(/#\d{4}#/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[;.,\s]+$/, "");
  if (v && !jawabanKosong(v) && v.length >= 8) {
    return { sumber: "1268", kalimat: v, perukun: perukunDari(v) };
  }

  // b. Posita - kalimat upaya damai keluarga. upayaDamaiPosita, bukan
  //    upayaDamaiDari: "sulit untuk dirukunkan lagi" dan nasihat suami-isteri
  //    bukan upaya merukunkan (butir 24).
  const butir = kalimatPosita(posita);
  const u = upayaDamaiPosita(butir);
  if (u.keadaan === "belum-ada") {
    return { sumber: "posita", kalimat: `Belum pernah ada upaya untuk merukunkan ${p1} dan ${p2}`, perukun: "" };
  }
  if (u.keadaan === "gagal") {
    const perukun = perukunDari(u.kalimat);
    return {
      sumber: "posita",
      kalimat: perukun
        ? `${p1} dan ${p2} sudah pernah diupayakan untuk dirukunkan oleh ${perukun}, namun tidak berhasil`
        : `${p1} dan ${p2} sudah pernah diupayakan untuk rukun kembali, namun tidak berhasil`,
      perukun,
    };
  }

  // c. Mediasi di pengadilan yang tidak berhasil (perkara_mediasi).
  //    "Tidak Dapat Dilaksanakan" (hasil_mediasi D) bukan upaya yang gagal:
  //    mediasinya tidak pernah terjadi (butir 24).
  const m = mediasi && typeof mediasi === "object" ? mediasi : null;
  if (m && m.selesai && !m.berhasil && m.dilaksanakan !== false) {
    return {
      sumber: "mediasi",
      kalimat: `${p1} dan ${p2} sudah diupayakan untuk rukun kembali melalui mediasi, namun tidak berhasil`,
      perukun: "",
    };
  }
  return { sumber: "", kalimat: "", perukun: "" };
}

/**
 * Mengisi jawaban pertanyaan upaya rukun yang masih kosong/bertanda.
 * Pulang null bila pertanyaannya bukan upaya rukun, jawabannya sudah berisi,
 * atau tidak ada sumber.
 */
function isiUpayaRukun({ tanya, jawab, upaya }) {
  if (!POLA_TANYA_UPAYA_RUKUN.test(String(tanya || ""))) return null;
  const teks = String(jawab || "");
  const kosong = jawabanKosong(teks);
  const bertanda = POLA_VARIABEL_TERSISA.test(teks) || /\.{3,}|_+|\u2026/.test(teks);
  if (!kosong && !bertanda) return null;
  if (!upaya || !upaya.kalimat) return null;
  const kecil = upaya.kalimat.charAt(0).toLowerCase() + upaya.kalimat.slice(1);
  // "Ya, #1268#;" - variabelnya diganti kalimat sumbernya.
  if (/#1268#/.test(teks)) return teks.replace(/#1268#/, kecil);
  // "... dirukunkan oleh ...., namun tidak berhasil" - hanya slot perukunnya.
  if (!kosong && upaya.perukun && /oleh\s*(?:\.{3,}|_+|\u2026)/i.test(teks) && !/belum pernah/i.test(teks)) {
    return teks.replace(/(?:\.{3,}|_+|\u2026)/, upaya.perukun);
  }
  return upaya.kalimat;
}

function susunKeteranganSaksiSdg(opsi) {
  const o = opsi && typeof opsi === "object" ? opsi : {};
  const templat = Array.isArray(o.templat) ? o.templat : [];
  // Kunci yang HANYA dideteksi (seluruh barisnya hanyaDeteksi - "keluar
  // malam", "tidak menghargai", "campur tangan keluarga") tidak punya bunyi
  // korpus yang dapat diucapkan saksi: kiriman eksplisitnya dahulu tercetak
  // sebagai label tanpa subjek ("... yaitu tidak menghargai dan keluar
  // malam;"). Kini ditolak dan disebut di alasanDitolak - tidak dikarang
  // bunyinya, tidak ditelan diam-diam.
  const alasanDitolak = [];
  // R2 14 Okt: cerai talak - saksi tidak pernah diusulkan berkata "Termohon
  // melalaikan kewajiban nafkah lahir"; kewajiban nafkah ada pada suami.
  const ceraiTalakSdg = sebabCerai.jenisCerai({ pelaku: o.pelaku, lawan: o.lawan }) === "CT";
  const saringSdg = (daftar) =>
    daftar.filter((kunci) => {
      if (ceraiTalakSdg && kalimatBaku.CIRI_KEWAJIBAN_SUAMI.includes(kunci)) {
        if (!alasanDitolak.some((x) => x.kunci === kunci)) alasanDitolak.push({ kunci, sebab: "kewajiban_suami" });
        return false;
      }
      if (!KUNCI_HANYA_DETEKSI.has(kunci)) return true;
      if (!alasanDitolak.some((x) => x.kunci === kunci)) alasanDitolak.push({ kunci, sebab: "hanya_deteksi" });
      return false;
    });
  const alasanMasuk = Array.isArray(o.alasan) ? o.alasan.map(String).filter(Boolean) : [];
  let alasan = saringSdg(alasanMasuk);
  let asalAlasan = alasan.length ? "dipilih" : "";
  // Posita hanya menggantikan pilihan yang memang KOSONG - pilihan yang
  // seluruhnya ditolak tidak diam-diam berubah menjadi "sama dengan gugatan".
  if (!alasanMasuk.length && o.posita) {
    alasan = saringSdg(alasanDariPosita(o.posita));
    asalAlasan = alasan.length ? "posita" : "";
  }
  if (templat.length === 0) {
    return { ok: false, alasan: "templat_kosong", saksi1: [], saksi2: [], saksi: [], perluDiisi: [] };
  }

  const bank = bacaBankBas(o);
  const frasa = kalimatBaku.frasaCiriEfektif(o);
  // Sebab kamus sebab-cerai yang didalilkan posita (W49 22 Okt) - lihat susun().
  let sebabPositaSdg = [];
  let tertutupPositaSdg = new Set();
  if (asalAlasan === "posita" && o.posita) {
    try {
      const det = sebabCerai.deteksi({
        b1: [],
        b2: [],
        butirPosita: kalimatPositaSambung(o.posita),
        pihak: { pelaku: String(o.pelaku || "").trim() || "Tergugat", lawan: String(o.lawan || "").trim() || "Penggugat" },
      });
      sebabPositaSdg = det.butir.filter((b) => b.frasa);
      tertutupPositaSdg = new Set(sebabPositaSdg.flatMap((b) => b.menutupiCiri || []));
    } catch (_) {
      sebabPositaSdg = [];
    }
  }
  const pihak = { pelaku: String(o.pelaku || "").trim(), lawan: String(o.lawan || "").trim() };
  const nomorPerkara = String(o.nomorPerkara || "").trim();
  const kodeKumpulan = String(o.kodeKumpulan || "").trim();
  const perkara = { jenisPerkara: o.jenisPerkara, alur: o.alur };

  // ---- daftar saksi --------------------------------------------------------
  const masukSaksi = Array.isArray(o.saksi) ? o.saksi.filter((x) => x && typeof x === "object") : [];
  const modusMasuk = o.modus && typeof o.modus === "object" ? o.modus : {};
  const daftarSaksi = [];
  let banyakP = 0;
  let banyakT = 0;
  const tambahSaksi = (m, pihakSaksi) => {
    /* === SAKSI-N 12 Okt === */
    // Dahulu 4 saksi P dan 2 saksi T. Kini sampai BATAS_SAKSI_SDG.P (5) dan .T (4): variabel ABT 8920-8943
    // (paket abt-saksi-pertanyaan) melengkapi saksi P ke-5 dan T ke-3/ke-4; saksi 1-2 P tidak berubah.
    if (pihakSaksi === "T" ? banyakT >= BATAS_SAKSI_SDG.T : banyakP >= BATAS_SAKSI_SDG.P) return;
    /* === AKHIR SAKSI-N === */
    if (pihakSaksi === "T") banyakT++;
    else banyakP++;
    daftarSaksi.push({ m: m || {}, pihak: pihakSaksi, urutPihak: pihakSaksi === "T" ? banyakT : banyakP });
  };
  if (masukSaksi.length) {
    for (const s of masukSaksi) tambahSaksi(s, String(s.pihak || "P").toUpperCase() === "T" ? "T" : "P");
  } else {
    for (let n = 1; n <= 6; n++) {
      const m = modusMasuk[`saksi${n}`];
      if (n <= 2 || (m && typeof m === "object")) {
        tambahSaksi(m, m && String(m.pihak || "").toUpperCase() === "T" ? "T" : "P");
      }
    }
  }
  const jumlahSaksi = daftarSaksi.length;

  // Modus tiap saksi. Yang tidak disebut berarti "sama" - bentuk lama, dan
  // masih bentuk yang paling sering benar untuk saksi pertama.
  const modusUntuk = (m) => {
    const nama = MODUS_SAKSI.has(String(m.modus)) ? String(m.modus) : "sama";
    const alasanSaksi =
      nama === "sebagian" && Array.isArray(m.alasan) && m.alasan.length ? saringSdg(m.alasan.map(String).filter(Boolean)) : alasan;
    return { modus: nama, alasan: alasanSaksi, sumber: sebutanSumberCerita(m, o.pelaku, o.lawan) };
  };

  // Fakta gugatan - dipakai mengisi titik-titik templat. Dibaca sekali.
  // tanggalSidang (butir 24): acuan lama pisah bila posita hanya menyebut
  // sejak kapan - dari ekstensi bila dikirim, selain itu jadwal SIPP.
  const fakta = faktaDariPosita(o.posita, o.pelaku, o.lawan, { tanggalSidang: o.tanggalSidang, alamatPihak: o.alamatPihak });
  // Upaya rukun (butir 28): variabel 1268 -> posita -> mediasi.
  const upaya = sumberUpayaDamai({
    nilai1268: o.upayaDamai,
    posita: o.posita,
    mediasi: o.mediasi,
    pelaku: o.pelaku,
    lawan: o.lawan,
  });
  const terisiDariData = [];
  const belumTerisi = [];

  let pelanggaranInvarian = 0;
  const contohPelanggaran = [];
  const perluDiisi = [];
  const terisiDariPosita = [];
  // T2 (25 Okt, keputusan pengguna): sebab perselisihan yang dibaca dari POSITA (bukan dipilih petugas) = saran,
  // belum dikuatkan saksi. Hanya jawaban "penyebab" yang memang menerangkan sebab (bukan tidak tahu / ragu / tahu pisah).
  const saranSebab = [];
  const MODUS_TANPA_SEBAB = new Set(["tidak-tahu", "tidak-melihat", "tahu-pisah", "ragu"]);

  const susun = (saksi, ke) => {
    const m = modusUntuk(saksi.m);
    const benihSaksi = (kunci) => `${nomorPerkara}|${kodeKumpulan}|${kunci}|${ke}`;
    const indeksUntuk = (kunci, n) => pemilih.indeksVarian({ nomorPerkara, kodeKumpulan, kunciTanya: kunci, n, ke });
    // W49 22 Okt: alasan yang dibaca dari POSITA (bukan pilihan petugas) juga
    // memuat sebab kamus sebab-cerai yang didalilkan (keluarga ikut campur, kurang
    // perhatian, marah bila dinasihati, keuangan tertutup, ...) - dahulu hanya ciri
    // lama, sehingga saksi "sama dengan gugatan" menerangkan sebab yang lebih
    // sempit dari dalilnya. Ciri lama yang diwakili sebab itu (menutupiCiri) tidak
    // diulang. Alasan yang dipilih petugas tidak ditambah.
    const pakaiSebabPosita = asalAlasan === "posita" && m.alasan === alasan && sebabPositaSdg.length > 0;
    const alasanUcap = pakaiSebabPosita ? m.alasan.filter((k) => !tertutupPositaSdg.has(k)) : m.alasan;
    const daftarCiri = daftarUcapan(alasanUcap, pihak, frasa.peta, (pool, kunciCiri) => pool[indeksUntuk(`alasan ${kunciCiri}`, pool.length)]);
    // Tanpa ucapan ciri lama, jawaban penyebab tetap klausa sebab posita apa
    // adanya (lengkapiJawabanTemplat) - ia lebih rinci dari daftar kamus (diukur:
    // "tidak pernah pamit keluar rumah, pelit dengan keluarga Pemohon, ..." akan
    // menyempit menjadi satu sebab).
    const daftar = pakaiSebabPosita && daftarCiri ? gabungUcapanSebab(daftarCiri, sebabPositaSdg, pihak) : daftarCiri;

    const jawaban = templat.map((baris, i) => {
      const no = String((baris && (baris.no || baris.urutan_pertanyaan)) || i + 1);
      const tanya = rapikanTeks((baris && (baris.tanya || baris.pertanyaan)) || "");
      const kel = pemilih.kelompokTanya(tanya);
      const kT = kel.kunci;
      const mentah = baris && (baris.jawabMentah !== undefined ? baris.jawabMentah : baris.jawabanMentah);

      // 1. Jawaban dasar: pilihan berlawanan dipecah, hubungan dua saksi dipecah.
      const pecah = pecahPilihan((baris && (baris.jawab || baris.jawaban)) || "");
      let jawab = pecah.jawab;
      let pilihan = pecah.pilihan.slice();
      let hubunganTerbuka = false;
      if (kel.kelompok === "kenal") {
        const dua = pecahHubungan(jawab, mentah);
        if (dua) {
          if (saksi.pihak === "P" && saksi.urutPihak <= 2) jawab = dua[saksi.urutPihak - 1];
          else {
            jawab = dua[0];
            hubunganTerbuka = true;
            pilihan = dua;
          }
        }
      }

      // Butir 14: pilihan templat yang diputuskan fakta posita (anak sudah/
      // belum, tinggal di tempat lain atau tidak) tidak lagi menunggu petugas.
      let dipilihFakta = false;
      const kePilih = o.rapikanSisa === false ? -1 : pilihMenurutFakta({ tanya, pilihan, fakta });
      if (kePilih >= 0) {
        jawab = pilihan[kePilih];
        pilihan = [];
        dipilihFakta = true;
      }
      // rapikanSisa:false hanya untuk membandingkan langkah ragam dengan
      // cermin contoh portal (ragamkanJawabanContoh), yang tidak punya perkara.
      const rapikan = (teks) =>
        o.rapikanSisa === false
          ? { jawab: teks, pilihan: null, diturunkan: false, dibuang: false }
          : rapikanSisaIsian({ tanya, jawab: teks, fakta, pelaku: pihak.pelaku, lawan: pihak.lawan, daftar });

      // Modus menjawab lebih dulu; bila ia tidak punya jawaban untuk
      // pertanyaan ini, templat yang bicara - seperti semula.
      let varian = { indeks: 0, n: 1, habis: false };
      const dariModus = jawabMenurutModus({
        tanya,
        modus: m.modus,
        alasan: m.alasan,
        sumber: m.sumber,
        nomorSaksi: ke,
        urutan: i,
        daftar,
        bank: bank.jawabanModus,
        // Butir 27: bank waktu|... dan kehidupan|... membingkai jawaban
        // templat yang SUDAH diisi dari gugatan - faktanya tetap dari posita.
        // Butir 14: yang dibingkai jawaban yang SUDAH dirapikan - bukan "...".
        jawab: rapikan(lengkapiJawabanTemplat({ tanya, jawab, fakta })).jawab,
        pilihBentuk: (bentuk, kunciBank) => {
          const indeks = indeksUntuk(`${kT}|${kunciBank}`, bentuk.length);
          varian = { indeks, n: bentuk.length, habis: bentuk.length < jumlahSaksi };
          return bentuk[indeks];
        },
      });
      if (dariModus) {
        jawab = dariModus;
        pilihan = [];
        hubunganTerbuka = false;
      }

      // 2. Yang masih bertitik-titik diisi dari gugatan.
      const sebelumIsi = jawab;
      // Upaya rukun lebih dulu: ia menimbang SELURUH jawaban (termasuk
      // pilihan templat), bukan hanya titik-titiknya.
      const dariUpaya = dariModus ? null : isiUpayaRukun({ tanya, jawab, upaya });
      if (dariUpaya) {
        jawab = dariUpaya;
        pilihan = [];
        if (ke === 1) terisiDariData.push({ no, tanya, sumber: upaya.sumber });
      }
      jawab = lengkapiJawabanTemplat({ tanya, jawab, fakta });
      const terisiTemplat = jawab !== sebelumIsi;
      // Butir 14: sisa titik-titik diturunkan dengan logika, dijadikan pilihan,
      // atau dirapikan (lihat rapikanSisaIsian).
      const rapi = dariModus ? null : rapikan(jawab);
      if (rapi) {
        jawab = rapi.jawab;
        if (rapi.pilihan && !pilihan.length) pilihan = rapi.pilihan;
      }
      if (ke === 1 && !dariUpaya && (terisiTemplat || dipilihFakta || (rapi && rapi.diturunkan))) terisiDariPosita.push({ no, tanya });
      if (pilihan.length) {
        pilihan = pilihan.map((p) => akhiriJawaban(besarkanAwal(rapikan(lengkapiJawabanTemplat({ tanya, jawab: p, fakta })).jawab)));
      }
      // "Ya, " templat dilepas (pembukanya dipilih ulang menurut profil manusia),
      // kecuali pada jawaban tetap yang tidak boleh disentuh.
      jawab = tanpaAkhiran(jawab);
      if (kel.jenis !== "tetap") jawab = jawab.replace(/^(ya|benar|betul|iya)\b\s*,?\s*/i, "");
      jawab = amankanKomaYa(jawab);
      const dasar = jawab;

      // 3. Ragam: pertanyaan pokok selalu, lainnya menurut peluang manusia.
      if (kel.jenis !== "tetap" && !dariModus && dasar) {
        const profil = bank.profil.get(kel.kelompok) || bank.profil.get("lain") || { peluangRagam: 0 };
        if (pemilih.diragamkan({ nomorPerkara, kunciTanya: kT, peluang: profil.peluangRagam })) {
          const cocok = cocokBentuk(dasar, bank, pihak, perkara);
          let calon = cocok ? cocok.varian : varianRagamKata(dasar, bank);
          // Kelompok BENTUK yang sempit (2-3 bentuk) diperluas dengan RAGAM_KATA
          // atas tiap bentuknya - bentuk korpus tetap didahulukan.
          if (cocok && calon.length < 4) calon = [...new Set([...calon, ...calon.flatMap((v) => varianRagamKata(v, bank).slice(1))])];
          // Bentuk yang menggeser makna tidak pernah ditawarkan.
          const sah = calon.filter((v) => periksaInvarian(dasar, v, { slot: cocok ? cocok.slot : [] }).ok);
          const pool = sah.length ? sah : [dasar];
          const indeks = indeksUntuk(kT, pool.length);
          jawab = pool[indeks];
          varian = { indeks, n: pool.length, habis: pool.length < jumlahSaksi };
        }
      }

      // 4. Pembuka menurut profil manusia, lalu huruf pertama.
      const pembuka = kel.jenis === "tetap" ? "" : pilihPembuka(jawab, kel.jenis === "rumusan" || (bank.profil.get(kel.kelompok) || {}).rumusan ? "rumusan" : kel.jenis, benihSaksi(kT), bank);
      const kecilkan = pembuka && !POLA_SEBUTAN_AWAL.test((jawab.match(/^[A-Za-z]+/) || [""])[0]);
      let akhir = pembuka
        ? pembuka + (kecilkan ? jawab.charAt(0).toLowerCase() : jawab.charAt(0)) + jawab.slice(1)
        : besarkanAwal(jawab);
      akhir = akhiriJawaban(akhir);

      const cek = periksaInvarian(dasar, akhir, { tetap: kel.jenis === "tetap" });
      if (!cek.ok) {
        // Pembuka atau bentuk yang melanggar dilepas - jawaban dasarnya yang dipakai.
        const cadangan = akhiriJawaban(besarkanAwal(dasar));
        const cekCadangan = periksaInvarian(dasar, cadangan, { tetap: kel.jenis === "tetap" });
        pelanggaranInvarian++;
        if (contohPelanggaran.length < 5) contohPelanggaran.push({ no, ke, pelanggaran: cek.pelanggaran });
        akhir = cadangan;
        varian = { indeks: 0, n: 1, habis: jumlahSaksi > 1, dilepas: cek.pelanggaran };
        if (!cekCadangan.ok) varian.dasarMelanggar = cekCadangan.pelanggaran;
      }

      // Diperiksa pada jawaban DAN dasarnya: bentuk "saya menyaksikan dan
      // mendengar" tidak lagi memuat pola pilihannya, padahal pilihan melihat/
      // mendengar itu tetap milik saksi yang sesungguhnya.
      // Jawaban yang SELURUHNYA kosong / titik-titik / "_" / variabel templat
      // tak terisi tidak pernah dipulangkan apa adanya (butir 28).
      const kosongSeluruhnya = jawabanKosong(akhir) || (POLA_VARIABEL_TERSISA.test(akhir) && jawabanKosong(akhir.replace(/#\d{4}#/g, "")));
      if (kosongSeluruhnya) {
        akhir = TANDA_BELUM_TERISI;
        pilihan = [];
        if (ke === 1) belumTerisi.push({ no, tanya });
      }
      const perlu =
        kosongSeluruhnya ||
        [akhir, dasar].some(
          (t) => POLA_BELUM_TERISI.test(t) || PILIHAN_TEMPLAT.test(t) || POLA_PILIHAN_SEBUTAN_TEKS.test(t)
        ) ||
        pilihan.length > 1 ||
        hubunganTerbuka ||
        // Butir 14: keterangan yang hanya diketahui saksi dibuang dari kalimat -
        // kalimatnya utuh, tetapi petugas tetap diminta melengkapinya.
        Boolean(rapi && rapi.dibuang);
      if (ke === 1 && perlu) perluDiisi.push({ no, tanya });
      const butir = { no, tanya, jawab: akhir, perluDiisi: perlu, varian };
      if (kosongSeluruhnya) butir.belumTerisi = true;
      if (asalAlasan === "posita" && m.alasan === alasan && kel.kelompok === "penyebab" && !kosongSeluruhnya && !MODUS_TANPA_SEBAB.has(m.modus)) {
        butir.saran = true;
        if (!saranSebab.some((x) => x.no === no)) saranSebab.push({ no, tanya, alasan: alasan.slice() });
      }
      if (pilihan.length) butir.pilihan = pilihan;
      return butir;
    });
    return { ke, pihak: saksi.pihak, modus: m.modus, jawaban };
  };

  const saksi = daftarSaksi.map((s, i) => susun(s, i + 1));
  const polos = (x) => (x ? x.jawaban.map(({ no, tanya, jawab }) => ({ no, tanya, jawab })) : []);
  const saksi1 = polos(saksi[0]);
  const saksi2 = polos(saksi[1]);
  const modusDipakai = {};
  saksi.forEach((s) => {
    modusDipakai[`saksi${s.ke}`] = s.modus;
  });

  // Dua saksi tidak boleh identik kata demi kata di luar penutup.
  const identik = saksi1.filter(
    (b, i) => saksi2[i] && b.jawab === saksi2[i].jawab && !/^(sudah|cukup|tidak ada)/i.test(b.jawab)
  ).length;

  const ditolak = [...bank.ditolak, ...frasa.ditolak];
  const hasil = {
    ok: true,
    versiBank: bank.versi || VERSI_BANK_TERTANAM,
    asalBank: bank.asal,
    benih: { nomorPerkara, kodeKumpulan },
    saksi1,
    saksi2,
    saksi,
    perluDiisi,
    // Yang BERHASIL diisi dari gugatan - disebut supaya yang membacanya tahu
    // kalimat itu bukan ketikan petugas, dan memeriksanya lebih dahulu.
    terisiDariPosita,
    // Upaya rukun yang diisi dari data (1268 / posita / mediasi) - butir 28.
    terisiDariData,
    // Jawaban yang tidak punya sumber sama sekali: berbunyi TANDA_BELUM_TERISI.
    belumTerisi,
    // Nomor jawaban yang sebabnya hanya dari posita - panel menandainya "saran, belum dikuatkan saksi".
    saranSebab,
    tandaBelumTerisi: TANDA_BELUM_TERISI,
    identik,
    alasan,
    asalAlasan,
    // Modus yang SUNGGUH dipakai - bukan yang diminta. Yang diminta dapat
    // salah eja dan jatuh ke "sama", dan panel harus memperlihatkan itu.
    modus: modusDipakai,
    catatan:
      (terisiDariPosita.length ? `${terisiDariPosita.length} jawaban diisi dari gugatan - periksa dahulu. ` : "") +
      (terisiDariData.length
        ? `Upaya rukun diisi dari ${terisiDariData.map((x) => (x.sumber === "1268" ? "variabel 1268" : x.sumber)).join(", ")} - periksa dahulu. `
        : "") +
      (belumTerisi.length ? `${belumTerisi.length} jawaban belum terisi dan bertanda "${TANDA_BELUM_TERISI}". ` : "") +
      (saranSebab.length ? "Sebab perselisihan diambil dari posita - saran, belum dikuatkan saksi; sesuaikan dengan keterangan saksi. " : "") +
      (perluDiisi.length
        ? `${perluDiisi.length} jawaban masih memuat titik-titik atau pilihan templat dan menunggu keterangan saksi yang sesungguhnya.`
        : "Seluruh jawaban tersusun; baca kembali sebelum disimpan ke ABT."),
  };
  if (pelanggaranInvarian) hasil.invarian = { dilepas: pelanggaranInvarian, contoh: contohPelanggaran };
  if (ditolak.length) hasil.tipeKeluaranDitolak = ditolak;
  if (alasanDitolak.length) hasil.alasanDitolak = alasanDitolak;
  return hasil;
}

/**
 * Mediasi terakhir satu perkara di SIPP (hanya SELECT) - sumber ketiga
 * jawaban upaya rukun (butir 28). null bila tidak ada / tidak terbaca.
 * Dibatasi 2,5 detik: keterangan saksi tidak boleh tertahan karena SIPP lambat.
 */
async function mediasiPerkara(nomorPerkara) {
  const nomor = String(nomorPerkara || "").trim();
  if (!nomor) return null;
  const kueri = runQuery(
    `SELECT m.hasil_mediasi AS hasil, m.keputusan_mediasi AS putus, m.mediasi_berhasil AS berhasil
       FROM perkara_mediasi m JOIN perkara p ON p.perkara_id = m.perkara_id
      WHERE p.nomor_perkara = ? ORDER BY m.mediasi_id DESC LIMIT 1`,
    [nomor]
  ).catch(() => null);
  const batas = new Promise((selesai) => setTimeout(() => selesai(null), 2500));
  const baris = await Promise.race([kueri, batas]);
  const m = Array.isArray(baris) && baris[0];
  if (!m) return null;
  // hasil_mediasi SIPP: Y1/Y2 berhasil, S berhasil sebagian, T tidak
  // berhasil, D tidak dapat dilaksanakan. mediasi_berhasil adalah TANGGAL.
  const berhasil = /^Y/i.test(String(m.hasil || "")) || Boolean(m.berhasil);
  return {
    selesai: Boolean(m.putus) || Boolean(m.hasil),
    berhasil,
    dilaksanakan: String(m.hasil || "").toUpperCase() !== "D",
    hasil: String(m.hasil || ""),
  };
}

/**
 * Posita dan tanggal sidang satu perkara di SIPP (hanya SELECT) - butir 24.
 *
 * Ekstensi mengirim posita hanya dari variabel 5125 halaman ABT, dan hanya
 * bila "sama dengan gugatan" dicentang. Variabel itu dapat kosong, dan tanpa
 * posita SELURUH fakta (awal perselisihan, pisah sejak, berapa lama, siapa
 * yang pergi, upaya rukun) jatuh menjadi titik-titik - 584/Pdt.G/2026/PA.Dgl.
 * Posita SIPP perkara yang sama adalah gugatan yang sama.
 *
 * Tanggal sidang: jadwal sidang perkara itu yang paling dekat dengan hari ini
 * - acuan menghitung lama pisah bila posita hanya menyebut sejak kapan.
 * Dibatasi 2,5 detik; null bila tidak ada / tidak terbaca.
 */
/**
 * Alamat pihak pertama (Penggugat/Pemohon = lawan) dan kedua (Tergugat/Termohon = pelaku) di SIPP - hanya SELECT,
 * 2,5 detik. Dipakai sebagai cadangan tempat tinggal sekarang bila posita tidak menyebutnya (19 Okt 2026).
 * @returns {Promise<{lawan: string, pelaku: string}|null>}
 */
async function alamatPihakPerkara(nomorPerkara) {
  const nomor = String(nomorPerkara || "").trim();
  if (!nomor) return null;
  const satu = (tabel) =>
    runQuery(
      `SELECT pp.alamat AS alamat FROM ${tabel} pp JOIN perkara p ON p.perkara_id = pp.perkara_id
        WHERE p.nomor_perkara = ? ORDER BY pp.urutan ASC LIMIT 1`,
      [nomor]
    ).catch(() => null);
  const batas = new Promise((selesai) => setTimeout(() => selesai(null), 2500));
  const [a, b] = await Promise.race([Promise.all([satu("perkara_pihak1"), satu("perkara_pihak2")]), batas.then(() => [null, null])]);
  const ambil = (x) => (Array.isArray(x) && x[0] && x[0].alamat ? String(x[0].alamat).trim() : "");
  const hasil = { lawan: ambil(a), pelaku: ambil(b) };
  return hasil.lawan || hasil.pelaku ? hasil : null;
}

async function konteksPerkaraSaksi(nomorPerkara) {
  const nomor = String(nomorPerkara || "").trim();
  if (!nomor) return null;
  const kueri = runQuery(
    `SELECT p.posita AS posita, p.petitum AS petitum, p.jenis_perkara_id AS jenis_perkara_id,
            (SELECT DATE_FORMAT(j.tanggal_sidang, '%Y-%m-%d') FROM perkara_jadwal_sidang j
              WHERE j.perkara_id = p.perkara_id
              ORDER BY ABS(DATEDIFF(j.tanggal_sidang, CURDATE())) ASC, j.tanggal_sidang DESC LIMIT 1) AS tanggal_sidang,
            (SELECT GROUP_CONCAT(CONCAT(s5.urutan, ':', s5.saksi_pihak_ke) ORDER BY s5.urutan SEPARATOR ',')
               FROM perkara_pihak5 s5 WHERE s5.perkara_id = p.perkara_id AND s5.urutan IN (1, 2)) AS saksi_sisi
       FROM perkara p WHERE p.nomor_perkara = ? LIMIT 1`,
    [nomor]
  ).catch(() => null);
  const batas = new Promise((selesai) => setTimeout(() => selesai(null), 2500));
  const baris = await Promise.race([kueri, batas]);
  const r = Array.isArray(baris) && baris[0];
  if (!r) return null;
  // 13 Okt: jenis perkara ikut - deteksi/cerai.js hanya ditambahkan untuk cerai gugat/talak (346/347).
  // 27 Okt: pihak saksi 1 dan 2 (1 = Penggugat/Pemohon, 2 = Tergugat/Termohon) - dari kueri yang SAMA, bukan kueri baru.
  const sisi = { saksi1: "", saksi2: "" };
  for (const bagian of String(r.saksi_sisi || "").split(",")) {
    const [urutan, ke] = bagian.split(":");
    if (urutan === "1" || urutan === "2") sisi[`saksi${urutan}`] = ke === "1" ? "penggugat" : ke === "2" ? "tergugat" : "";
  }
  return { posita: String(r.posita || ""), petitum: String(r.petitum || ""), tanggalSidang: String(r.tanggal_sidang || ""), jenisPerkaraId: Number(r.jenis_perkara_id) || null, saksiSisi: sisi };
}

module.exports = {
  butirKeterangan,
  faktaDariPosita,
  lengkapiJawabanTemplat,
  ambilBulanTahun,
  waktuSetara,
  ambilLamaPisah,
  usulkanHuruf,
  hitungLamaPisah,
  uraikanTanggal,
  dariKeteranganSaksi,
  dariSipp,
  // Kuasa hukum dari SIPP (9 Okt 2026) - diuji langsung.
  usulanKuasaSipp,
  padankanSurelEcourt,
  bulanNomorRegister,
  dariPositaItsbat,
  susunKeteranganSaksiSdg,
  BATAS_SAKSI_SDG,
  // Butir 28 (30 Sep 2026) - diuji langsung.
  sumberUpayaDamai,
  isiUpayaRukun,
  jawabanKosong,
  mediasiPerkara,
  // Butir 24 (5 Okt 2026) - fakta posita per peristiwa, diuji langsung.
  konteksPerkaraSaksi,
  alamatPihakPerkara,
  tempatKiniPosita,
  waktuPosita,
  awalKonflikPosita,
  penyebabPosita,
  kalimatPositaSambung,
  gabungPenyebab,
  rapikanKalimatSaksi,
  pisahSejakPosita,
  lamaPisahPosita,
  siapaPergiPosita,
  upayaDamaiPosita,
  // Butir 14 (6 Okt 2026) - kelengkapan keterangan saksi, diuji langsung.
  lamaSejakAcuan,
  jumlahAnakPosita,
  anakIkutPosita,
  riwayatTinggalPosita,
  rapikanSisaIsian,
  pilihMenurutFakta,
  TANDA_BELUM_TERISI,
  POLA_TANYA_UPAYA_RUKUN,
  alasanDariPosita,
  // 19 Okt (isian 2): tanggal nikah perkara cerai - diuji langsung.
  tanggalNikahDariPosita,
  kuaDariPosita,
  tanggalNikahDariIso,
  tampilTanggalNikah,
  usulanTanggalNikahSipp,
  // Ragam keterangan saksi (t2-ragam-bas-bot) - diuji langsung.
  periksaInvarian,
  tiruanReplaceKetSaksi,
  bacaBankBas,
  jawabMenurutModus,
  pecahPilihan,
  VARIABEL_ITSBAT,
  CIRI_ALASAN,
  /* === P1-P3-S6 10 Okt === */
  barisBerlaku,
  pelakuSatuKata,
  segarkanCiriAlasan,
  /* === AKHIR P1-P3-S6 === */
  // Bagian deteksi (25 September 2026) - diuji langsung dan dipakai cermin.
  ciriDariKalimat,
  daftarCiriEfektif,
  cerminAlasan,
  siapaPergiDari,
  upayaDamaiDari,
  lamaDiucapkan,
  totalBulan,
  namaSesudah,
  namaDiAwal,
  kalimatPosita,
  polosPosita,
};
