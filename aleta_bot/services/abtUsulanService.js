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
const kalimatBaku = require("./abtKalimatBaku");
const ragamBawaan = require("./ragamBasBawaan");
const pemilih = require("./pemilihRagam");

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

/** Bulan dan tahun dari sepotong kalimat, dalam bentuk yang dipakai blangko. */
function ambilBulanTahun(kalimat) {
  const teks = String(kalimat || "");
  const polaBulan = new RegExp(`\\b(${BULAN.join("|")})\\s+(\\d{4})\\b`, "i");
  const cocokBulan = teks.match(polaBulan);
  if (cocokBulan) {
    const namaBulan = BULAN.find((b) => b.toLowerCase() === cocokBulan[1].toLowerCase());
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
const POLA_BULAN_TAHUN = /^(?:bulan\s+)?([A-Za-z]+)?\s*(\d{4})$/;

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
  const bulanMulai = cocok[1] ? bulanKeAngka(cocok[1]) : 0;
  if (bulanMulai === null) return null;
  const sidang = uraikanTanggal(tanggalSidang);
  if (!sidang || Number.isNaN(sidang.getTime())) return null;

  const mulai = new Date(Number(cocok[2]), bulanMulai, 1);
  if (sidang < mulai) return null;

  let bulan = (sidang.getFullYear() - mulai.getFullYear()) * 12 + (sidang.getMonth() - mulai.getMonth());
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
const CIRI_ALASAN = [
  // --- huruf f: perselisihan dan pertengkaran terus-menerus -----------------
  //
  // Dahulu satu baris yang menuntut "perselisihan" DAN "pertengkaran" sekaligus.
  // Posita yang menulis salah satunya saja - dan itu lazim - tidak terdeteksi
  // sama sekali. Dipecah supaya masing-masing berdiri sendiri.
  { kunci: "perselisihan terus-menerus", kata: ["perselisihan"] },
  { kunci: "perselisihan terus-menerus", kata: ["pertengkaran"] },
  { kunci: "perselisihan terus-menerus", kata: ["percekcokan"] },
  { kunci: "perselisihan terus-menerus", kata: ["cekcok"] },
  { kunci: "perselisihan terus-menerus", kata: ["bertengkar"] },
  { kunci: "perselisihan terus-menerus", kata: ["berselisih"] },
  { kunci: "perselisihan terus-menerus", kata: ["tidak harmonis"] },
  { kunci: "perselisihan terus-menerus", kata: ["tidak rukun"] },
  { kunci: "perselisihan terus-menerus", kata: ["tidak ada kecocokan"] },
  { kunci: "perselisihan terus-menerus", kata: ["syiqaq"] },
  // "meninggalkan" saja SENGAJA tidak dipakai sebagai ciri.
  //
  // Hampir tiap keterangan saksi memuatnya - "meninggalkan tempat kediaman
  // bersama" - dan itu peristiwa pisah rumah, yang sudah punya variabelnya
  // sendiri (0246 dan 7035). Alasan perceraian berupa MENINGGALKAN PIHAK LAIN
  // menuntut jangka waktu tertentu, dan jangka itu tidak dapat disimpulkan
  // dari kata kerjanya. Menyalakannya di sini membuat tiap perkara tampak
  // punya satu alasan lebih banyak daripada yang sebenarnya didalilkan.
  // --- huruf d: kekejaman atau penganiayaan berat ---------------------------
  { kunci: "kekerasan dalam rumah tangga", kata: ["kdrt"] },
  { kunci: "kekerasan dalam rumah tangga", kata: ["memukul"] },
  { kunci: "kekerasan dalam rumah tangga", kata: ["kekerasan"] },
  { kunci: "kekerasan dalam rumah tangga", kata: ["menganiaya"] },
  { kunci: "kekerasan dalam rumah tangga", kata: ["penganiayaan"] },
  { kunci: "kekerasan dalam rumah tangga", kata: ["menampar"] },
  { kunci: "kekerasan dalam rumah tangga", kata: ["menendang"] },
  { kunci: "kekerasan dalam rumah tangga", kata: ["mencekik"] },
  { kunci: "kekerasan dalam rumah tangga", kata: ["kekejaman"] },
  { kunci: "kekerasan dalam rumah tangga", kata: ["main tangan"] },
  // "mengancam" saja terlalu luas - ancaman cerai ada di hampir tiap posita.
  // Yang dijadikan ciri hanya ancaman terhadap NYAWA atau dengan senjata.
  { kunci: "kekerasan dalam rumah tangga", kata: ["mengancam", "bunuh"] },
  { kunci: "kekerasan dalam rumah tangga", kata: ["ancaman", "senjata"] },
  // Bentuk yang dipakai saksi sungguhan dan dahulu lolos: "melakukan
  // pemukulan", "dipukul oleh Tergugat", "menyakiti fisik", "mengancam dengan
  // benda tajam" (terukur pada 25 September 2026).
  //
  // Dibuka untuk SDG 26 September 2026: "pemukulan" 9/10, "dipukul" 10/10,
  // "mengancam + tajam" 10/10 kalimat saksi sungguhan benar-benar menyatakan
  // kekerasan (dibaca satu per satu; folder kerja penguatan-putusan/
  // alasan-cerai, label-presisi.json). "menyakiti + fisik" hanya 4 kemunculan
  // - tidak cukup untuk diukur, tetap hanyaDeteksi.
  { kunci: "kekerasan dalam rumah tangga", kata: ["pemukulan"] },
  { kunci: "kekerasan dalam rumah tangga", kata: ["dipukul"] },
  { kunci: "kekerasan dalam rumah tangga", kata: ["menyakiti", "fisik"], hanyaDeteksi: true },
  { kunci: "kekerasan dalam rumah tangga", kata: ["mengancam", "tajam"] },
  // Bentuk pasif dan sehari-hari yang ditulis petugas di BAS: "Penggugat
  // pernah dicekik", "ditampar", "ringan tangan". "pukul" telanjang SENGAJA
  // tidak dipakai - "pukul 10.00" adalah keterangan waktu.
  { kunci: "kekerasan dalam rumah tangga", kata: ["dicekik"] },
  { kunci: "kekerasan dalam rumah tangga", kata: ["ditampar"] },
  { kunci: "kekerasan dalam rumah tangga", kata: ["ditendang"] },
  { kunci: "kekerasan dalam rumah tangga", kata: ["menjambak"] },
  { kunci: "kekerasan dalam rumah tangga", kata: ["ringan tangan"] },

  // --- nafkah -------------------------------------------------------------
  //
  // "nafkah" saja dibiarkan seperti semula, sebab posita cerai menyebutnya
  // sebagai alasan jauh lebih sering daripada sebagai tuntutan. Yang
  // ditambahkan bunyi yang menunjuk alasannya tanpa memakai kata itu sama
  // sekali - dan itu justru yang selama ini lolos.
  { kunci: "tidak memberi nafkah", kata: ["nafkah"] },
  { kunci: "tidak memberi nafkah", kata: ["menelantarkan"] },
  { kunci: "tidak memberi nafkah", kata: ["terlantar"] },
  { kunci: "tidak memberi nafkah", kata: ["tidak menafkahi"] },
  { kunci: "tidak memberi nafkah", kata: ["tidak bertanggung jawab"] },
  { kunci: "tidak memberi nafkah", kata: ["lalai", "kewajiban"] },

  // --- pihak ketiga --------------------------------------------------------
  { kunci: "pihak lain (wanita/pria idaman lain)", kata: ["idaman lain"] },
  { kunci: "pihak lain (wanita/pria idaman lain)", kata: ["selingkuh"] },
  { kunci: "pihak lain (wanita/pria idaman lain)", kata: ["perselingkuhan"] },
  { kunci: "pihak lain (wanita/pria idaman lain)", kata: ["pihak ketiga"] },
  // Bentuk yang ditulis petugas sendiri di isian 5227 manusia: "menjalin
  // hubungan dengan wanita lain" dan "memiliki hubungan asmara dengan wanita
  // lain" masing-masing 3 perkara - dahulu tidak terbaca karena tidak memuat
  // "idaman lain" maupun "selingkuh".
  //
  // 26 September 2026, dibaca satu per satu atas BAS petugas: "wanita lain"
  // 10/10 dan "perempuan lain" 9/10 memang menyatakan hubungan dengan pihak
  // lain - dibuka untuk SDG. "laki-laki lain" dan "pria lain" hanya 5 dari 10:
  // separuhnya TUDUHAN suami yang cemburu ("Tergugat menuduh Penggugat ada
  // hubungan dengan laki-laki lain"), yaitu ciri cemburu, bukan pihak lain.
  // Keduanya (dan "lelaki lain" yang terlalu jarang untuk diukur) tetap
  // hanyaDeteksi. "hubungan asmara" 8/10 dan "pria idaman" 7/10 karena sebab
  // yang sama tidak ditambahkan.
  { kunci: "pihak lain (wanita/pria idaman lain)", kata: ["wanita lain"] },
  { kunci: "pihak lain (wanita/pria idaman lain)", kata: ["perempuan lain"] },
  { kunci: "pihak lain (wanita/pria idaman lain)", kata: ["laki-laki lain"], hanyaDeteksi: true },
  { kunci: "pihak lain (wanita/pria idaman lain)", kata: ["lelaki lain"], hanyaDeteksi: true },
  { kunci: "pihak lain (wanita/pria idaman lain)", kata: ["pria lain"], hanyaDeteksi: true },
  // "menjalin hubungan" SENGAJA tidak dipakai: ia hanya menambah 2 perkara
  // di atas baris lain, dan satu di antaranya "tidak mau lagi menjalin
  // hubungan suami istri" - bukan pihak lain.
  // ============================================================================
  // MENIKAH LAGI - KUNCI SENDIRI, BUKAN "PIHAK LAIN"
  // ============================================================================
  //
  // "Tergugat telah menikah lagi dengan wanita lain" bukan perselingkuhan:
  // menyamakannya membuat keterangan saksi SDG berbunyi "Tergugat
  // berselingkuh" untuk perkawinan yang diakui. SIPP pun memisahkannya
  // (faktor Poligami). "menikah lagi" 9/10 (satu pengandaian: "harus menikah
  // lagi"), "menikah dengan wanita ..." 10/10, "menikah dengan laki-laki ..."
  // 10/10.
  { kunci: "menikah lagi", kata: ["menikah lagi"] },
  { kunci: "menikah lagi", kata: ["kawin lagi"] },
  { kunci: "menikah lagi", kata: ["menikah dengan wanita"] },
  { kunci: "menikah lagi", kata: ["menikah dengan perempuan"] },
  { kunci: "menikah lagi", kata: ["menikah dengan laki"] },
  { kunci: "menikah lagi", kata: ["menikah dengan pria"] },
  { kunci: "menikah lagi", kata: ["menikah siri"] },
  // Singkatan WIL dan PIL SENGAJA tidak dipakai. Pencocokannya potongan teks
  // tanpa batas kata - imbuhan bahasa Indonesia membuat batas kata mustahil
  // dipakai, sebab "berjudi" harus tetap cocok pada "judi" - sehingga "wil"
  // akan menyala pada "wilayah" dan "pil" pada "dipilih". Bentuk panjangnya
  // sudah tertangkap "idaman lain" di atas.
  { kunci: "cemburu", kata: ["cemburu"] },
  // "curiga" SENGAJA tidak dipakai: dari 7 perkara yang baru terbaca
  // karenanya, 3 bukan kecemburuan ("Penggugat mencurigai Tergugat telah
  // mengambil uang", "mencurigai barang tersebut milik Tergugat").
  // Ketiganya dipisah - dulu satu kunci untuk tiganya, sehingga saksi yang
  // hanya menerangkan judi menghasilkan kalimat yang menuduh mabuk dan obat
  // terlarang sekaligus. Lihat catatan di frasaCiri.
  { kunci: "obat terlarang", kata: ["sabu"] },
  // "shabu" TIDAK memuat "sabu" (s-h-a-b-u), jadi ejaan ini dulu lolos -
  // padahal ia bentuk yang dipakai petugas sendiri ("obat-obatan terlarang
  // jenis Shabu").
  // Dibuka untuk SDG 26 September 2026 - 10/10 (lihat catatan kekerasan).
  { kunci: "obat terlarang", kata: ["shabu"] },
  // "obat-obatan terlarang" tidak memuat "obat terlarang" - ada "-obatan" di
  // tengahnya. Kedua kata dituntut dalam SATU kalimat. 10/10.
  { kunci: "obat terlarang", kata: ["obat", "terlarang"] },
  { kunci: "obat terlarang", kata: ["narkoba"] },
  { kunci: "obat terlarang", kata: ["narkotika"] },
  { kunci: "obat terlarang", kata: ["pemadat"] },
  { kunci: "obat terlarang", kata: ["madat"] },
  { kunci: "obat terlarang", kata: ["ganja"] },
  { kunci: "judi", kata: ["judi"] },
  { kunci: "judi", kata: ["togel"] },
  // "bermain judi sabung ayam", "judi slot online" - 10/10.
  { kunci: "judi", kata: ["sabung ayam"] },
  { kunci: "judi", kata: ["slot"] },
  { kunci: "mabuk", kata: ["mabuk"] },
  { kunci: "mabuk", kata: ["minuman keras"] },
  { kunci: "mabuk", kata: ["miras"] },
  { kunci: "mabuk", kata: ["pemabuk"] },
  { kunci: "mabuk", kata: ["pemabok"] },

  // --- perilaku: ciri baru 25 September 2026 -------------------------------
  //
  // 142 dari 287 isian 5227 manusia memuat alasan di luar daftar ini; yang
  // terbanyak temperamen/tempramen (65), kasar (33), dan malas bekerja (31).
  // Frasanya diambil dari bentuk terbanyak isian itu - lihat frasaCiri di
  // abtKalimatBaku.js beserta hitungannya.
  //
  // "kasar" dipecah dua menurut isian manusia sendiri: ucapan (22 perkara)
  // dan sikap (5 perkara). "kasar" TELANJANG tidak dipakai - ia menyala pada
  // kedua bentuk sekaligus dan menerbitkan dua perbuatan dari satu kalimat.
  //
  // Keempat kunci ini hanyaDeteksi sampai 26 September 2026. Sejak itu
  // dibuka untuk SDG, sesudah tiap bunyinya dibaca atas BAS petugas
  // sungguhan (1.498 perkara cerai 2024-2026, sepuluh kalimat tersebar per
  // bunyi; folder kerja penguatan-putusan/alasan-cerai, label-presisi.json):
  //   temperamental  temperam/tempram/sering marah/marah-marah/mudah marah/
  //                  suka marah 10/10 masing-masing, emosional 9/9,
  //                  tersulut emosi 9/9 (keduanya kembali hanyaDeteksi:
  //                  di POSITA 3/6 dan 0/2 - lihat barisnya)
  //   malas bekerja  malas bekerja 10/10, malas + kerja 10/10,
  //                  tidak mau bekerja 10/10
  //   berkata kasar  kata kasar 10/10
  //   bersikap kasar sikap kasar 9/10 (satu penyangkalan: "tidak pernah
  //                  bersikap kasar")
  // "marah" telanjang TIDAK dipakai - 5 dari 10 kemunculannya kemarahan
  // sesaat ("Tergugat marah terhadap Penggugat"), bukan watak. "kasar"
  // telanjang juga tidak (lihat di atas), begitu pula "memaki" 9/10 dan
  // "mencaci" 8/10 yang dua kali berbunyi "tidak pernah mendengar".
  { kunci: "malas bekerja", kata: ["malas bekerja"] },
  { kunci: "malas bekerja", kata: ["malas dalam bekerja"] },
  { kunci: "malas bekerja", kata: ["malasbekerja"] },
  { kunci: "malas bekerja", kata: ["malas mencari pekerjaan"] },
  { kunci: "malas bekerja", kata: ["malas cari pekerjaan"] },
  { kunci: "malas bekerja", kata: ["malas mencari kerja"] },
  // "malas kerja", "malas untuk bekerja", "malas dan tidak mau berusaha
  // mencari pekerjaan" - satu kalimat memuat keduanya.
  { kunci: "malas bekerja", kata: ["malas", "kerja"] },
  { kunci: "malas bekerja", kata: ["tidak mau bekerja"] },
  // "temperam" dan "tempram", bukan "temperamen": ejaan saksi beragam
  // ("temperamantal", "tempramental"), dan potongan ini tidak muncul di kata
  // lain. "marah-marah" ikut di sini sebab petugas sendiri menuliskannya
  // begitu - saksi berkata "sering marah-marah", isian 5227 manusianya
  // "bersikap temperamental" (perkara 412/Pdt.G/2025, 493/Pdt.G/2025).
  { kunci: "temperamental", kata: ["temperam"] },
  { kunci: "temperamental", kata: ["tempram"] },
  { kunci: "temperamental", kata: ["teperamen"] },
  { kunci: "temperamental", kata: ["temparamen"] },
  { kunci: "temperamental", kata: ["sering marah"] },
  { kunci: "temperamental", kata: ["marah-marah"] },
  { kunci: "temperamental", kata: ["marah marah"] },
  { kunci: "temperamental", kata: ["mudah marah"] },
  { kunci: "temperamental", kata: ["pemarah"] },
  { kunci: "temperamental", kata: ["suka marah"] },
  { kunci: "temperamental", kata: ["cepat marah"] },
  { kunci: "temperamental", kata: ["gampang marah"] },
  // "emosional" dan "tersulut emosi" 9/9 di BAS petugas, tetapi SDG membaca
  // POSITA - dan di sana (diukur pemeriksa 26 September 2026 atas posita
  // perkara cerai sipp_donggala) "emosional" benar 3 dari 6 kalimat
  // ("kedekatan emosional", "hubungan emosional pun memudar") dan "tersulut
  // emosi" 0 dari 2 (pengandaian tentang Penggugat sendiri). Keduanya tetap
  // dideteksi untuk 5227, tidak diucapkan saksi SDG.
  { kunci: "temperamental", kata: ["emosional"], hanyaDeteksi: true },
  { kunci: "temperamental", kata: ["tersulut emosi"], hanyaDeteksi: true },
  { kunci: "temperamental", kata: ["mudah emosi"] },
  { kunci: "berkata kasar", kata: ["kata kasar"] },
  { kunci: "berkata kasar", kata: ["kata-kata kasar"] },
  { kunci: "berkata kasar", kata: ["bicara kasar"] },
  { kunci: "berkata kasar", kata: ["ucapan kasar"] },
  { kunci: "berkata kasar", kata: ["berucap kasar"] },
  { kunci: "berkata kasar", kata: ["perkataan kasar"] },
  { kunci: "bersikap kasar", kata: ["sikap kasar"] },
  { kunci: "bersikap kasar", kata: ["berlaku kasar"] },
  { kunci: "bersikap kasar", kata: ["perlakuan kasar"] },
  { kunci: "bersikap kasar", kata: ["berbuat kasar"] },
  { kunci: "bersikap kasar", kata: ["bertindak kasar"] },

  // --- ekonomi dan pekerjaan: kunci baru 26 September 2026 -----------------
  //
  // "tidak memiliki pekerjaan tetap" BUKAN "malas bekerja": yang pertama
  // keadaan, yang kedua watak. Hanya bentuk yang menyebut "tetap" (atau
  // "penghasilan tetap") yang dipakai - "tidak bekerja" telanjang dapat
  // berarti menganggur, sakit, atau baru diberhentikan, dan mengucapkannya
  // sebagai salah satunya mengubah keterangan. 9/9 kalimat saksi.
  { kunci: "tidak memiliki pekerjaan tetap", kata: ["tidak memiliki pekerjaan tetap"] },
  { kunci: "tidak memiliki pekerjaan tetap", kata: ["tidak mempunyai pekerjaan tetap"] },
  { kunci: "tidak memiliki pekerjaan tetap", kata: ["tidak punya pekerjaan tetap"] },
  { kunci: "tidak memiliki pekerjaan tetap", kata: ["belum memiliki pekerjaan tetap"] },
  { kunci: "tidak memiliki pekerjaan tetap", kata: ["belum mempunyai pekerjaan tetap"] },
  { kunci: "tidak memiliki pekerjaan tetap", kata: ["tidak memiliki pekerjaan yang tetap"] },
  { kunci: "tidak memiliki pekerjaan tetap", kata: ["tidak memiliki penghasilan tetap"] },
  { kunci: "tidak memiliki pekerjaan tetap", kata: ["tidak mempunyai penghasilan tetap"] },
  // "karena masalah ekonomi" - 117 perkara di BAS petugas, 10/10. Kuncinya
  // sekaligus bunyinya: tidak ada pelaku, jadi SDG mengucapkannya di luar
  // daftar perbuatan ("... dan masalah ekonomi"), dan kalimat 5227 yang
  // berpelaku melaporkannya sebagai tanpaFrasa.
  { kunci: "masalah ekonomi", kata: ["masalah ekonomi"] },
  { kunci: "masalah ekonomi", kata: ["faktor ekonomi"] },
  { kunci: "masalah ekonomi", kata: ["persoalan ekonomi"] },
  { kunci: "masalah ekonomi", kata: ["permasalahan ekonomi"] },
  { kunci: "masalah ekonomi", kata: ["alasan ekonomi"] },

  // --- ciri baru 26 September 2026 yang hanya dideteksi --------------------
  //
  // Terbaca tepat di BAS petugas ("ikut campur" 10/10, "tidak menghargai"
  // 10/10, "keluar malam" 10/10, "pulang larut" 10/10), tetapi TIDAK ada
  // bunyi korpus yang dapat diucapkan saksi SDG tanpa mengubahnya: campur
  // tangan dilakukan KELUARGA, bukan pelaku; "tidak menghargai" sasarannya
  // beragam (pihak lawan, orang tua, saksi); dan bunyi terbanyak keluar
  // malam memuat "sering" - kata frekuensi yang tidak boleh ditambahkan.
  // Kalimat 5227 melaporkannya sebagai tanpaFrasa; SDG tidak memakainya.
  { kunci: "campur tangan keluarga", kata: ["ikut campur"], hanyaDeteksi: true },
  { kunci: "campur tangan keluarga", kata: ["turut campur"], hanyaDeteksi: true },
  { kunci: "campur tangan keluarga", kata: ["campur tangan"], hanyaDeteksi: true },
  { kunci: "campur tangan keluarga", kata: ["mencampuri"], hanyaDeteksi: true },
  { kunci: "tidak menghargai", kata: ["tidak menghargai"], hanyaDeteksi: true },
  { kunci: "tidak menghargai", kata: ["tidak menghormati"], hanyaDeteksi: true },
  { kunci: "keluar malam", kata: ["keluar malam"], hanyaDeteksi: true },
  { kunci: "keluar malam", kata: ["pulang larut"], hanyaDeteksi: true },
  { kunci: "keluar malam", kata: ["pulang pagi"], hanyaDeteksi: true },

  // --- huruf a: zina -------------------------------------------------------
  //
  // Terpisah dari "pihak lain". Berhubungan dengan perempuan/laki-laki lain
  // dan berbuat zina bukan dalil yang sama: yang kedua menuntut pembuktian
  // yang jauh lebih berat, dan menyamakan keduanya berarti menaikkan dalil
  // orang tanpa ia memintanya.
  { kunci: "zina", kata: ["zina"] },
  { kunci: "zina", kata: ["berzina"] },

  // --- huruf c: dihukum pidana penjara -------------------------------------
  //
  // "penjara" saja tidak dipakai - posita kerap menyebutnya sebagai peristiwa
  // yang sudah lewat atau sebagai keterangan tempat. Yang dijadikan ciri
  // hanya bunyi yang menyatakan salah satu pihak MENJALANI pidananya.
  { kunci: "salah satu pihak menjalani pidana penjara", kata: ["dipenjara"] },
  { kunci: "salah satu pihak menjalani pidana penjara", kata: ["dihukum", "penjara"] },
  { kunci: "salah satu pihak menjalani pidana penjara", kata: ["menjalani", "pidana"] },
  { kunci: "salah satu pihak menjalani pidana penjara", kata: ["lembaga pemasyarakatan"] },

  // --- huruf e: cacat badan atau penyakit ----------------------------------
  //
  // "sakit" saja ditolak - ia muncul pada "sakit hati" di hampir tiap posita
  // perselisihan. Yang dipakai bunyi yang menunjuk keadaan badan yang membuat
  // kewajiban tidak dapat dijalankan.
  { kunci: "cacat badan atau penyakit", kata: ["cacat badan"] },
  { kunci: "cacat badan atau penyakit", kata: ["cacat tetap"] },
  { kunci: "cacat badan atau penyakit", kata: ["penyakit", "tidak dapat menjalankan"] },
  { kunci: "cacat badan atau penyakit", kata: ["impoten"] },
  { kunci: "cacat badan atau penyakit", kata: ["gangguan jiwa"] },

  // --- huruf g: melanggar taklik talak -------------------------------------
  { kunci: "pelanggaran taklik talak", kata: ["taklik talak"] },
  { kunci: "pelanggaran taklik talak", kata: ["taklik"] },
  { kunci: "pelanggaran taklik talak", kata: ["ta'lik"] },

  // --- huruf h: murtad -----------------------------------------------------
  { kunci: "murtad/pindah agama", kata: ["murtad"] },
  { kunci: "murtad/pindah agama", kata: ["pindah agama"] },
  { kunci: "murtad/pindah agama", kata: ["keluar dari agama islam"] },
];

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
  return kalimatBerciri(kalimatKecil, baris) && !objekMenikahLagi(kalimatKecil, baris, daftar) && menikahLagiTerjadi(kalimatKecil, baris);
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
const POLA_NIAT_NIKAH =
  /\b(?:ingin|mau|hendak|akan|berniat|niat|niatnya|berencana|rencana|bermaksud|izin|ijin|mengizinkan|mengijinkan|restu|merestui|menyuruh|suruh|disuruh|menyarankan|mengancam|ancam|diancam|mengajak|memaksa|dipaksa|harus|boleh|silakan|silahkan|untuk|agar|supaya|tidak|belum|batal)\s+(?:\S+\s+)?$/;
/** Sebutan pihak di depan kata nikah yang BUKAN subjeknya: objek, milik, atau sasaran. */
const POLA_BUKAN_SUBJEK =
  /\b(?:kepada|terhadap|dengan|pada|ke|dari|oleh|untuk|bagi|bersama|antara|meninggalkan|ditinggalkan|menceraikan|memukul|menyuruh|mengajak|mengizinkan|mengijinkan|melarang|menafkahi|menelantarkan|restu|izin|ijin|suami|isteri|istri|tua|orangtua|keluarga|anak|ibu|ayah|bapak|mertua|saudara|adik|kakak|sepengetahuan|persetujuan)\s+$/;
/** Sebutan pihak yang mengajukan perkara (0046) - bukan pelaku. */
const SEBUTAN_LAWAN = new Set(["penggugat", "pemohon"]);

function menikahLagiTerjadi(kalimatKecil, baris) {
  if (baris.kunci !== "menikah lagi") return true;
  const kata = baris.kata[0];
  for (let i = kalimatKecil.indexOf(kata); i >= 0; i = kalimatKecil.indexOf(kata, i + 1)) {
    const depan = kalimatKecil.slice(0, i);
    if (POLA_NIAT_NIKAH.test(depan.slice(-40))) continue;
    let subjek = "";
    for (const m of depan.matchAll(/\b(penggugat|tergugat|pemohon|termohon)\b/g)) {
      if (POLA_BUKAN_SUBJEK.test(depan.slice(Math.max(0, m.index - 20), m.index))) continue;
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
const POLA_KONFLIK = /(perselisihan|pertengkaran|berselisih|bertengkar|cekcok|percekcokan|tidak harmonis|tidak lagi harmonis|tidak rukun|tidak lagi rukun)/i;
const POLA_MULAI = /\b(sejak|mulai|semenjak)\b/i;
const POLA_ADA_TAHUN = /\b(19|20)\d{2}\b/;
// 0246 - bentuk pisah rumah. "puncak ... pada bulan X, ... pergi meninggalkan
// rumah" adalah bentuk 16 dari 33 yang terlewat: tidak memuat kata "pisah".
const POLA_PISAH_RUMAH = /(pisah|tidak (lagi )?tinggal bersama|tidak serumah|pergi meninggalkan|meninggalkan (tempat|rumah|kediaman))/i;

/**
 * Kalimat awal konflik: kata konflik + "sejak/mulai" + tahun, dalam satu butir.
 *
 * Cadangannya kalimat konflik yang "terjadi (pada) <waktu>" - "perselisihan
 * dan pertengkaran Penggugat dan Tergugat terjadi bulan Agustus 2023" - asal
 * BUKAN puncak atau pertengkaran terakhir: keduanya titik akhir, bukan awal.
 */
function kalimatAwalKonflik(butir) {
  return (
    butir.find((b) => POLA_KONFLIK.test(b) && POLA_MULAI.test(b) && POLA_ADA_TAHUN.test(b)) ||
    butir.find(
      (b) => POLA_KONFLIK.test(b) && /\bterjadi\b/i.test(b) && !/puncak|terakhir/i.test(b) && POLA_ADA_TAHUN.test(b)
    ) ||
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
  return (
    butir.find((b) => /pisah/i.test(b) && POLA_MULAI.test(b) && POLA_ADA_TAHUN.test(b)) ||
    butir.find((b) => POLA_PISAH_RUMAH.test(b) && POLA_ADA_TAHUN.test(b)) ||
    // Cadangan terakhir: kalimat PUNCAK bertanggal. Pada templat satker,
    // puncak perselisihan adalah hari salah satu pihak pergi; terukur naik
    // 276 -> 282 dari 316 tanpa satu pun jawaban benar yang berubah salah.
    butir.find((b) => /puncak/i.test(b) && POLA_ADA_TAHUN.test(b)) ||
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
  for (const b of butir) {
    const i = b.search(/pisah|berpisah|tidak (lagi )?tinggal bersama|tidak serumah|meninggalkan/i);
    if (i < 0) continue;
    const sisa = b.slice(i);
    const tahun = banyakSatuan(sisa, "tahun");
    const bulan = banyakSatuan(sisa, "bulan");
    if (tahun === null && bulan === null) continue;
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

function siapaPergiDari(butir) {
  const sisi = (kata) => (/tergugat|termohon/i.test(kata) ? "pelaku" : "lawan");
  for (const b of butir) {
    const k = b.toLowerCase();
    if (!/meninggalkan|pergi dari rumah|keluar dari rumah/.test(k)) continue;
    if (POLA_PILIHAN_SEBUTAN.test(k)) continue;
    const m1 = k.match(/meninggalkan[^.;]*?adalah\s*(penggugat|tergugat|pemohon|termohon)/);
    if (m1) return { sisi: sisi(m1[1]), kalimat: b };
    const m2 = k.match(/(penggugat|tergugat|pemohon|termohon)(?:\s+yang)?\s+(?:telah\s+|sudah\s+|lah\s+)?(?:pergi\s+)?meninggalkan/);
    if (m2) return { sisi: sisi(m2[1]), kalimat: b };
    const m3 = k.match(/(penggugat|tergugat|pemohon|termohon)\s+(?:pergi|pulang|kembali|keluar)\b/);
    if (m3) return { sisi: sisi(m3[1]), kalimat: b };
  }
  return { sisi: "", kalimat: "" };
}

/**
 * Sisi yang PERGI menurut satu kalimat posita (faktaDariPosita).
 *
 * Sebutan TERDEKAT SEBELUM kata 'pergi'/'meninggalkan' pertama, di dalam
 * kalimat (dipotong pada titik, titik koma, dan 'bahwa') yang memuatnya -
 * itulah subjek perbuatannya. Tanpa sebutan di depannya dibaca dengan pola
 * siapaPergiDari ("yang meninggalkan ... adalah X"); selain itu "".
 *
 * @returns {""|"pelaku"|"lawan"} pelaku = 0047 = Tergugat/Termohon
 */
function sisiYangPergi(kalimat) {
  // 'meninggalkan' didahulukan: "Tergugat pergi mengusir Penggugat untuk
  // meninggalkan kediaman" - 'pergi' pertama milik yang mengusir, bukan yang
  // meninggalkan. 'pergi' saja hanya bila tidak ada 'meninggalkan'.
  const potongan = String(kalimat || "").split(/(?<=[.;])\s+|\bbahwa\b/i);
  const kataKerja = potongan.some((k) => /meninggalkan/i.test(k)) ? /\bmeninggalkan\b/i : /\bpergi\b/i;
  const kalimatSubjek = potongan.find((k) => kataKerja.test(k)) || "";
  const letakPergi = kalimatSubjek.search(kataKerja);
  if (letakPergi < 0) return "";
  // "..., yang meninggalkan tempat kediaman adalah Penggugat" - anak kalimat
  // 'yang' menunjuk subjeknya SESUDAH kata kerjanya. Sebutan di depannya
  // ("antara penggugat dengan tergugat telah pisah rumah, yang meninggalkan
  // ...") bukan pelakunya - ditemukan pada pemeriksaan tangan 20 contoh.
  if (/\byang\s*$/i.test(kalimatSubjek.slice(0, letakPergi))) {
    const anakKalimat = kalimatSubjek.slice(letakPergi).match(/^[^.;]*?\badalah\s*(penggugat|tergugat|pemohon|termohon)/i);
    if (anakKalimat) return /tergugat|termohon/i.test(anakKalimat[1]) ? "pelaku" : "lawan";
  }
  const sebutanDepan = [...kalimatSubjek.slice(0, letakPergi).matchAll(/\b(penggugat|tergugat|pemohon|termohon)\b/gi)];
  if (sebutanDepan.length) {
    return /tergugat|termohon/i.test(sebutanDepan[sebutanDepan.length - 1][1]) ? "pelaku" : "lawan";
  }
  return siapaPergiDari([kalimatSubjek]).sisi;
}

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
  return { keadaan: berhasil ? "berhasil" : "gagal", kalimat };
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
  const awal = gabungkan(ambilBulanTahun(konflik1).nilai, ambilBulanTahun(konflik2).nilai);
  const konflikPosita = kalimatAwalKonflik(butirPosita);
  const awalPosita = ambilBulanTahun(konflikPosita).nilai;
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
  const pisah = gabungkan(ambilBulanTahun(pisah1).nilai, ambilBulanTahun(pisah2).nilai);

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
  const dihitung = hitungLamaPisah(pisah.nilai, tanggalSidang);
  if (dihitung) {
    lama.pembanding = { teks: dihitung.teks, totalBulan: dihitung.totalBulan, dari: pisah.nilai, sampai: tanggalSidang };
    if (!lama.nilai) {
      lama.nilai = dihitung.teks;
      lama.dihitung = true;
      lama.keyakinan = "cukup";
      lama.catatan =
        `Saksi tidak menyebut lamanya; dihitung dari ${pisah.nilai} sampai tanggal sidang ${tanggalSidang}.`;
    } else if (totalBulan(lama.nilai) !== dihitung.totalBulan) {
      lama.catatan =
        `Saksi menyebut "${lama.nilai}"; dihitung dari ${pisah.nilai} sampai sidang ${tanggalSidang} ` +
        `hasilnya ${dihitung.teks}. Yang diusulkan ucapan saksi, supaya sama dengan berita acara.`;
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
    const kalimatDari = (d) => (d.keadaan ? kalimatBaku.kalimatUpayaDamai(d.keadaan, pihak, opsi) : "");
    upaya = gabungkan(kalimatDari(damai1), kalimatDari(damai2));
    // Keadaannya terbaca tetapi bunyinya tidak tersedia (dimatikan lewat
    // pengaturan): disebut, bukan menjadi "tidak ditemukan" yang menyesatkan.
    const tanpaBunyi = [damai1, damai2].filter((d) => d.keadaan && !kalimatDari(d)).map((d) => d.keadaan);
    if (tanpaBunyi.length) {
      upaya.catatan = `Keadaan "${tanpaBunyi[0]}" terbaca, tetapi bunyinya tidak tersedia di daftar putusan.upaya-damai.bunyi.`;
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

  const ciri = ciriPosita ? berdua.filter((x) => ciriPosita.includes(x)) : berdua;

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
    if (kiri && kanan && kiri.toLowerCase() !== kanan.toLowerCase()) {
      selisih.push({ hal: judul, saksi1: kiri, saksi2: kanan });
    }
  };
  bandingkan("Awal konflik", ambilBulanTahun(konflik1).nilai, ambilBulanTahun(konflik2).nilai);
  bandingkan("Pisah rumah", ambilBulanTahun(pisah1).nilai, ambilBulanTahun(pisah2).nilai);
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
        sumberBerpasangan(ciri, b1, b2, daftarCiri.daftar)
      ),
      usulan("0246", "Pisah Rumah", pisah, [...sumberDari(pisah1, 1), ...sumberDari(pisah2, 2)]),
      // Sumbernya kalimat yang MENYEBUT lamanya bila ada; bila tidak, kalimat
      // pisah rumah yang menjadi titik awal hitungan.
      usulan("9944", "Lama Pisah", lama, [
        ...sumberDari(ucap1.kalimat || pisah1, 1),
        ...sumberDari(ucap2.kalimat || pisah2, 2),
      ]),
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
        [...sumberDari(damai1.kalimat, 1), ...sumberDari(damai2.kalimat, 2)]
      ),
    ],
  };
  if (tipeKeluaranDitolak.length) hasil.tipeKeluaranDitolak = tipeKeluaranDitolak;
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
            pp.putusan_verstek AS verstek
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

  const kuasa = await runQuery(
    `SELECT nama, alamat, nomor_kuasa,
            DATE_FORMAT(tanggal_kuasa, '%d/%m/%Y') AS tanggal
       FROM perkara_pengacara
      WHERE perkara_id = ? AND aktif = 'Y'
      ORDER BY urutan, id`,
    [perkaraId]
  );

  const daftarKuasa = Array.isArray(kuasa) ? kuasa : [];
  const pertama = daftarKuasa[0] || null;
  const sumberKuasa = daftarKuasa.map((k) => ({
    saksi: 0,
    kalimat: `${k.nama}${k.nomor_kuasa ? ` — kuasa ${k.nomor_kuasa}` : ""}${k.tanggal ? ` tanggal ${k.tanggal}` : ""}`,
  }));

  const hasil = [
    {
      kode: "0132",
      nama: "Tgl. Kuasa Penggugat",
      nilai: pertama && pertama.tanggal ? pertama.tanggal : "",
      keyakinan: pertama && pertama.tanggal ? "pasti" : "kosong",
      bentrok: "",
      sumber: sumberKuasa,
      catatan: daftarKuasa.length === 0 ? "Perkara ini tidak punya kuasa hukum aktif di SIPP." : "",
    },
    {
      kode: "0156",
      nama: "Kantor Kuasa Penggugat",
      nilai: pertama && pertama.alamat ? pertama.alamat : "",
      keyakinan: pertama && pertama.alamat ? "pasti" : "kosong",
      bentrok: "",
      sumber: sumberKuasa,
      catatan:
        daftarKuasa.length > 1
          ? `Ada ${daftarKuasa.length} kuasa aktif. Yang diusulkan alamat kuasa pertama - periksa bila kantornya berbeda.`
          : "",
    },
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

  return {
    ok: true,
    perkaraId,
    prodeo,
    jumlahKuasa: daftarKuasa.length,
    // Dipakai panel untuk menamai berkas - lihat namaBerkas di abt.js.
    keteranganPerkara,
    usulan: hasil,
  };
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
  const sebut1 = (pihak && pihak.pemohon) || "Pemohon I";
  const sebut2 = (pihak && pihak.pemohon2) || "Pemohon II";
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
  const kec = String(kNikah || "").match(/\bKec(?:amatan|\.)\s+([A-Z][A-Za-z' -]{2,40}?)(?=\s+(?:dan|Kabupaten|Kab\.|serta|,)|[,;.]|$)/);
  const kua = kec ? kec[1].trim() : "";

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
  const statusWali = String(kWali || "").match(
    new RegExp(`wali(?: nikah)?(?:nya)?\\s+(?:adalah\\s+|yaitu\\s+)?([a-z][a-z ]{2,40}?)\\s+(?:${lolos(sebut2)}|${lolos(sebut1)}|Pemohon|bernama)`, "i")
  );

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

  const usulanSemua = [
    usulan("5197", "Tanggal nikah", hasilItsbat(tanggalNikah, kNikah), sumber(kNikah)),
    usulan("5105", "Alamat tempat menikah", hasilItsbat(alamatNikah, kNikah), sumber(kNikah)),
    usulan("5178", "KUA kecamatan", hasilItsbat(kua, kNikah, kua ? "" : "posita tidak menyebut kecamatan"), sumber(kNikah)),
    usulan("1217", "Nama wali nikah", hasilItsbat(namaWali, kWali), sumber(kWali)),
    usulan("1046", "Status wali nikah", hasilItsbat(statusWali ? statusWali[1].trim() : "", kWali), sumber(kWali)),
    usulan("8087", "Yang menikahkan", hasilItsbat(yangMenikahkan, kMenikahkan), sumber(kMenikahkan)),
    usulan("0650", "Saksi nikah 1", hasilItsbat(saksi1, kSaksi), sumber(kSaksi)),
    usulan("0651", "Saksi nikah 2", hasilItsbat(saksi2, kSaksi), sumber(kSaksi)),
    usulan("1001", "Mas kawin", hasilItsbat(mahar, kMahar), sumber(kMahar)),
    usulan("1002", `Status ${sebut1} sebelum nikah`, hasilItsbat(status1 ? status1[1] : "", kStatus), sumber(kStatus)),
    usulan("1003", `Status ${sebut2} sebelum nikah`, hasilItsbat(status2 ? status2[1] : "", kStatus), sumber(kStatus)),
    usulan("7211", `Umur ${sebut1} saat menikah`, hasilItsbat(status1 && status1[2] ? `${status1[2]} tahun` : "", kStatus), sumber(kStatus)),
    usulan("7212", `Umur ${sebut2} saat menikah`, hasilItsbat(status2 && status2[2] ? `${status2[2]} tahun` : "", kStatus), sumber(kStatus)),
    usulan("0007", "Telah dikaruniai anak", hasilItsbat(anak, kAnak), sumber(kAnak)),
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
      if (indeks >= 200) {
        ditolak.push({ daftar: kunciDaftar, kunci: kunciMentah, alasan: "lebih_dari_200_entri" });
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
      const salah = periksa(nilai, ["{sumber}", "{daftar}", "{isi}"]);
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

function akhiriJawaban(teks) {
  const t = tanpaAkhiran(teks);
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
const MODUS_SAKSI = new Set([
  "sama",
  "sebagian",
  "tidak-tahu",
  "tidak-melihat",
  "dari-cerita",
  "tahu-pisah",
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
 * @param a.daftar      (pilihan) alasan yang sudah diucapkan (daftarUcapan);
 *                      tanpa ini alasan digabung apa adanya - bentuk lama
 * @param a.bank        (pilihan) bank jawaban-modus efektif; bawaan bila tidak ada
 * @param a.pilihBentuk (pilihan) (bentuk[], kunciBank) -> kalimat; bila tidak
 *                      ada, ragamModus lama (nomor saksi + urutan)
 */
function jawabMenurutModus({ tanya, modus, alasan, sumber, nomorSaksi, urutan, daftar: daftarUcap, bank, pilihBentuk }) {
  const daftar = typeof daftarUcap === "string" ? daftarUcap : (alasan || []).join(nomorSaksi === 2 ? " serta " : " dan ");
  const isi = daftar || "perselisihan yang terus-menerus";
  const sumber_ = String(sumber || "");
  const bankEfektif = bank || ragamBawaan.JAWABAN_MODUS;
  // Bank kalimat per 'kelompok|modus'; penanda diisi. Bank yang kosong
  // (dimatikan di pengaturan) berarti modus tidak menjawab - templat bicara.
  const pilih = (kunci) => {
    const bentuk = (bankEfektif[kunci] || []).map((t) =>
      t.split("{sumber}").join(sumber_).split("{daftar}").join(daftar).split("{isi}").join(isi)
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
  if (/bagaimana .*(mengetahui|tahu)|dari mana .*(tahu|mengetahui)/i.test(tanya)) {
    if (modus === "dari-cerita") return pilih("cara-tahu|dari-cerita");
    if (modus === "tidak-melihat") return pilih("cara-tahu|tidak-melihat");
    if (modus === "tidak-tahu") return null;
    return pilih("cara-tahu|sama");
  }

  // Saksi yang hanya tahu pisahnya: tidak satu pun pertanyaan tentang
  // pertengkaran boleh dijawab seolah ia menyaksikannya.
  if (modus === "tahu-pisah") {
    if (/penyebab|sebab|alasan/i.test(tanya)) return pilih("penyebab|tahu-pisah");
    if (/melihat|mendengar|menyaksikan|berapa kali/i.test(tanya)) return pilih("menyaksikan|tahu-pisah");
    if (/rukun|damai|mendamaikan|sanggup/i.test(tanya)) return pilih("rukun|tahu-pisah");
    // Pertanyaan tentang pisah rumah TIDAK dijawab di sini - itu justru yang
    // diketahui saksi ini, dan templatnya sudah tepat.
  }

  if (/penyebab|sebab|alasan/i.test(tanya)) {
    if (modus === "tidak-tahu" || modus === "tidak-melihat") return pilih("penyebab|tidak-tahu");
    if (modus === "dari-cerita") return pilih("penyebab|dari-cerita");
    // Tanpa satu pun alasan yang dapat diucapkan (mis. hanya "perselisihan",
    // yang akibat, bukan penyebab) kalimat "penyebabnya adalah " tidak boleh
    // terbit kosong - templat yang bicara, dan titik-titiknya tetap terlihat.
    if (!daftar) return null;
    if (modus === "sebagian") return pilih("penyebab|sebagian");
    return pilih("penyebab|sama");
  }

  if (/melihat|mendengar|menyaksikan|berapa kali/i.test(tanya)) {
    if (modus === "tidak-melihat" || modus === "dari-cerita") return pilih("menyaksikan|tidak-melihat");
    if (modus === "tidak-tahu") return pilih("menyaksikan|tidak-tahu");
    return null; // sama / sebagian: jawaban templat sudah tepat
  }

  return null;
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
function faktaDariPosita(posita, pelaku, lawan) {
  const butir = kalimatPosita(posita);
  const cari = (...kata) =>
    butir.find((k) => {
      const kecil = k.toLowerCase();
      return kata.every((w) => kecil.includes(w));
    }) || "";

  const kalimatKonflik = cari("selisih") || cari("tengkar");
  const kalimatPisah = cari("pisah");
  const kalimatPergi = cari("meninggalkan") || kalimatPisah;

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
  // Kini yang dipakai sebutan TERDEKAT SEBELUM kata 'pergi'/'meninggalkan'
  // pertama, di dalam kalimat (dipotong pada titik, titik koma, dan 'bahwa')
  // yang memuatnya - itulah subjek perbuatannya. Kalimat tanpa sebutan di
  // depannya dibaca dengan pola "yang meninggalkan ... adalah X"; bila itu pun
  // tidak ada, jawabannya kosong dan titik-titiknya tetap terlihat.
  let siapaPergi = "";
  const sisiPergi = sisiYangPergi(kalimatPergi);
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

  // "dikaruniai 2 orang anak", "dikaruniai dua orang anak", "mempunyai 3 anak".
  const jumlahAnak = (() => {
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
  const kediaman = (() => {
    const cocok = String(kalimatKediaman || "").match(
      /(?:bertempat tinggal|kediaman bersama|tinggal bersama)\s+(?:di|pada)\s+([^;,.]{3,80})/i
    );
    return cocok ? cocok[1].trim() : "";
  })();

  return {
    awalKonflik: ambilBulanTahun(kalimatKonflik).nilai || "",
    pisahSejak: ambilBulanTahun(kalimatPisah).nilai || "",
    lamaPisah: ambilLamaPisah(kalimatPisah),
    siapaPergi,
    tanggalNikah,
    jumlahAnak,
    kediaman,
  };
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
  if (/kapan.*(selisih|tengkar)|(selisih|tengkar).*sejak/i.test(tanya)) ganti(fakta.awalKonflik);
  else if (/berapa lama.*pisah|lama.*berpisah/i.test(tanya)) ganti(fakta.lamaPisah);
  else if (/pisah|serumah/i.test(tanya)) ganti(fakta.pisahSejak || fakta.lamaPisah);
  else if (/siapa.*(meninggalkan|pergi)/i.test(tanya)) {
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
  } else if (/berapa.*anak|anak.*berapa|dikaruniai|keturunan/i.test(tanya)) {
    // Templat kerap SUDAH menyebut "anak" sesudah titik-titiknya - "dikaruniai
    // ........... anak". Menyisipkan "2 orang anak" ke situ menerbitkan
    // "dikaruniai 2 orang anak anak".
    const templatSudahMenyebut = /(?:\.{3,}|_+)\s*(?:orang\s+)?anak/i.test(hasil);
    if (!templatSudahMenyebut) ganti(fakta.jumlahAnak);
    else if (/^\d+\s+orang\s+anak$/.test(fakta.jumlahAnak)) {
      ganti(fakta.jumlahAnak.replace(/\s+anak$/, ""));
    }
    // "belum mempunyai anak" sengaja TIDAK dipasang pada templat berpola itu:
    // hasilnya "dikaruniai belum mempunyai anak anak". Dibiarkan bertitik-titik
    // dan tetap ditandai perlu diisi - kalimat yang kacau di berita acara lebih
    // buruk daripada satu titik-titik yang jelas menunggu petugas.
  } else if (/di mana.*(tinggal|kediaman|berdiam)|tempat tinggal|alamat.*tinggal/i.test(tanya)) {
    ganti(fakta.kediaman);
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

  // b. Posita - kalimat upaya damai keluarga.
  const butir = kalimatPosita(posita);
  const u = upayaDamaiDari(butir);
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
  const m = mediasi && typeof mediasi === "object" ? mediasi : null;
  if (m && m.selesai && !m.berhasil) {
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
  const saringSdg = (daftar) =>
    daftar.filter((kunci) => {
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
    alasan = alasanDariPosita(o.posita);
    asalAlasan = alasan.length ? "posita" : "";
  }
  if (templat.length === 0) {
    return { ok: false, alasan: "templat_kosong", saksi1: [], saksi2: [], saksi: [], perluDiisi: [] };
  }

  const bank = bacaBankBas(o);
  const frasa = kalimatBaku.frasaCiriEfektif(o);
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
    if (pihakSaksi === "T" ? banyakT >= 2 : banyakP >= 4) return;
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
  const fakta = faktaDariPosita(o.posita, o.pelaku, o.lawan);
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

  const susun = (saksi, ke) => {
    const m = modusUntuk(saksi.m);
    const benihSaksi = (kunci) => `${nomorPerkara}|${kodeKumpulan}|${kunci}|${ke}`;
    const indeksUntuk = (kunci, n) => pemilih.indeksVarian({ nomorPerkara, kodeKumpulan, kunciTanya: kunci, n, ke });
    const daftar = daftarUcapan(m.alasan, pihak, frasa.peta, (pool, kunciCiri) => pool[indeksUntuk(`alasan ${kunciCiri}`, pool.length)]);

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
      if (ke === 1 && jawab !== sebelumIsi && !dariUpaya) terisiDariPosita.push({ no, tanya });
      if (pilihan.length) pilihan = pilihan.map((p) => akhiriJawaban(besarkanAwal(lengkapiJawabanTemplat({ tanya, jawab: p, fakta }))));
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
        hubunganTerbuka;
      if (ke === 1 && perlu) perluDiisi.push({ no, tanya });
      const butir = { no, tanya, jawab: akhir, perluDiisi: perlu, varian };
      if (kosongSeluruhnya) butir.belumTerisi = true;
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
  const berhasil = /^Y/i.test(String(m.hasil || "")) || Boolean(m.berhasil);
  return { selesai: Boolean(m.putus) || Boolean(m.hasil), berhasil, hasil: String(m.hasil || "") };
}

module.exports = {
  butirKeterangan,
  faktaDariPosita,
  lengkapiJawabanTemplat,
  ambilBulanTahun,
  ambilLamaPisah,
  usulkanHuruf,
  hitungLamaPisah,
  uraikanTanggal,
  dariKeteranganSaksi,
  dariSipp,
  dariPositaItsbat,
  susunKeteranganSaksiSdg,
  // Butir 28 (30 Sep 2026) - diuji langsung.
  sumberUpayaDamai,
  isiUpayaRukun,
  jawabanKosong,
  mediasiPerkara,
  TANDA_BELUM_TERISI,
  POLA_TANYA_UPAYA_RUKUN,
  alasanDariPosita,
  // Ragam keterangan saksi (t2-ragam-bas-bot) - diuji langsung.
  periksaInvarian,
  tiruanReplaceKetSaksi,
  bacaBankBas,
  jawabMenurutModus,
  pecahPilihan,
  VARIABEL_ITSBAT,
  CIRI_ALASAN,
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
