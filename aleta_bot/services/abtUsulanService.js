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
const CIRI_ALASAN = [
  { kunci: "perselisihan terus-menerus", kata: ["perselisihan", "pertengkaran"] },
  // "meninggalkan" saja SENGAJA tidak dipakai sebagai ciri.
  //
  // Hampir tiap keterangan saksi memuatnya - "meninggalkan tempat kediaman
  // bersama" - dan itu peristiwa pisah rumah, yang sudah punya variabelnya
  // sendiri (0246 dan 7035). Alasan perceraian berupa MENINGGALKAN PIHAK LAIN
  // menuntut jangka waktu tertentu, dan jangka itu tidak dapat disimpulkan
  // dari kata kerjanya. Menyalakannya di sini membuat tiap perkara tampak
  // punya satu alasan lebih banyak daripada yang sebenarnya didalilkan.
  { kunci: "kekerasan dalam rumah tangga", kata: ["kdrt"] },
  { kunci: "kekerasan dalam rumah tangga", kata: ["memukul"] },
  { kunci: "kekerasan dalam rumah tangga", kata: ["kekerasan"] },
  { kunci: "tidak memberi nafkah", kata: ["nafkah"] },
  { kunci: "pihak lain (wanita/pria idaman lain)", kata: ["idaman lain"] },
  { kunci: "cemburu", kata: ["cemburu"] },
  // Ketiganya dipisah - dulu satu kunci untuk tiganya, sehingga saksi yang
  // hanya menerangkan judi menghasilkan kalimat yang menuduh mabuk dan obat
  // terlarang sekaligus. Lihat catatan di frasaCiri.
  { kunci: "obat terlarang", kata: ["sabu"] },
  { kunci: "obat terlarang", kata: ["narkoba"] },
  { kunci: "obat terlarang", kata: ["pemadat"] },
  { kunci: "judi", kata: ["judi"] },
  { kunci: "mabuk", kata: ["mabuk"] },
  { kunci: "mabuk", kata: ["minuman keras"] },
  { kunci: "murtad/pindah agama", kata: ["murtad"] },
];

function usulkanHuruf(butirGabungan) {
  const semua = butirGabungan.join(" ").toLowerCase();
  const ciri = [];
  for (const baris of CIRI_ALASAN) {
    if (!baris.kata.every((kata) => semua.includes(kata))) continue;
    if (!ciri.includes(baris.kunci)) ciri.push(baris.kunci);
  }
  return ciri;
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
  return {
    kode,
    nama,
    nilai: hasil.nilai,
    keyakinan: hasil.keyakinan,
    bentrok: hasil.bentrok,
    catatan: hasil.catatan || "",
    dihitung: hasil.dihitung === true,
    sumber: sumber || [],
  };
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
function kalimatPemicu(butir, ciri) {
  const aturan = CIRI_ALASAN.filter((c) => c.kunci === ciri);
  for (const baris of butir) {
    const kecil = baris.toLowerCase();
    if (aturan.some((c) => c.kata.every((k) => kecil.includes(k)))) return baris;
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
function sumberBerpasangan(ciri, b1, b2) {
  const hasil = [];
  for (const nama of ciri) {
    const k1 = kalimatPemicu(b1, nama);
    const k2 = kalimatPemicu(b2, nama);
    if (k1) hasil.push({ saksi: 1, kalimat: k1 });
    if (k2) hasil.push({ saksi: 2, kalimat: k2 });
    if (hasil.length >= 12) break;
  }
  return hasil;
}
function dariKeteranganSaksi(teksSaksi1, teksSaksi2, tanggalSidang, pihak, posita) {
  const b1 = butirKeterangan(teksSaksi1);
  const b2 = butirKeterangan(teksSaksi2);
  const semua = [...b1, ...b2];

  const sumberDari = (kalimat, nomor) => (kalimat ? [{ saksi: nomor, kalimat }] : []);

  // 0222 - awal konflik. Kalimatnya hampir selalu memuat "perselisihan" dan
  // "sejak"; yang dicari tahunnya, bukan tanggal pastinya.
  const konflik1 = cariButir(b1, ["perselisihan", "sejak"]);
  const konflik2 = cariButir(b2, ["perselisihan", "sejak"]);
  const awal = gabungkan(ambilBulanTahun(konflik1).nilai, ambilBulanTahun(konflik2).nilai);

  // 0246 - pisah rumah. Dibedakan dari 0222 dengan kata "pisah".
  const pisah1 = cariButir(b1, ["pisah", "sejak"]) || cariButir(b1, ["pisah tempat tinggal"]);
  const pisah2 = cariButir(b2, ["pisah", "sejak"]) || cariButir(b2, ["pisah tempat tinggal"]);
  const pisah = gabungkan(ambilBulanTahun(pisah1).nilai, ambilBulanTahun(pisah2).nilai);

  // 9944 - lama pisah. Sering ada di kalimat yang sama dengan 0246.
  const lama1 = ambilLamaPisah(cariButir(b1, ["pisah", "bulan"]) || pisah1);
  const lama2 = ambilLamaPisah(cariButir(b2, ["pisah", "bulan"]) || pisah2);
  const lama = gabungkan(lama1, lama2);

  // Dihitung ulang dari 0246 sampai tanggal sidang. Yang dihitung MENGALAHKAN
  // yang diucapkan - kalimat saksi benar pada hari ia diperiksa, dan mulai
  // keliru pada sidang berikutnya. Yang diucapkan tetap ditampilkan sebagai
  // pembanding, bukan dibuang.
  const dihitung = hitungLamaPisah(pisah.nilai, tanggalSidang);
  if (dihitung) {
    const diucapkan = lama.nilai;
    lama.nilai = dihitung.teks;
    lama.dihitung = true;
    if (diucapkan && diucapkan !== dihitung.teks) {
      lama.catatan =
        `Saksi menyebut "${diucapkan}"; dihitung dari ${pisah.nilai} sampai sidang ${tanggalSidang} ` +
        `hasilnya ${dihitung.teks}. Angka yang diucapkan benar pada hari saksi diperiksa.`;
    } else if (!diucapkan) {
      lama.catatan = `Dihitung dari ${pisah.nilai} sampai tanggal sidang ${tanggalSidang}.`;
      lama.keyakinan = "cukup";
    }
    if (lama.keyakinan === "kosong") lama.keyakinan = "cukup";
  }

  // 7035 - siapa yang meninggalkan kediaman bersama. Jawabannya satu kata,
  // dan blangkonya memang menuntut satu kata.
  const siapa = (butir) => {
    // Kalimat yang MENJAWAB dicari lebih dulu: "yang meninggalkan tempat
    // tinggal bersama ADALAH Tergugat". Tanpa mendahulukannya, yang terkutip
    // adalah kalimat puncak perselisihan yang kebetulan juga memuat kata
    // "meninggalkan" - jawabannya tetap benar, tetapi sumbernya jadi kalimat
    // yang lebih lemah, dan sumber itulah yang dibaca orang untuk memeriksa.
    const kalimat =
      cariButir(butir, ["meninggalkan tempat", "adalah"]) ||
      cariButir(butir, ["meninggalkan kediaman", "adalah"]) ||
      cariButir(butir, ["meninggalkan tempat"]) ||
      cariButir(butir, ["meninggalkan kediaman"]);
    if (!kalimat) return { nilai: "", kalimat: "" };
    const kecil = kalimat.toLowerCase();
    const posT = kecil.lastIndexOf("tergugat");
    const posP = kecil.lastIndexOf("penggugat");
    // "Penggugat" memuat "tergugat" sebagai bagian kata? tidak - tetapi
    // "Tergugat" tidak memuat "Penggugat", jadi yang disebut PALING AKHIR
    // pada kalimat "yang meninggalkan ... adalah X" itulah jawabannya.
    if (posT < 0 && posP < 0) return { nilai: "", kalimat };
    return { nilai: posT > posP ? "Tergugat" : "Penggugat", kalimat };
  };
  const siapa1 = siapa(b1);
  const siapa2 = siapa(b2);
  const pergi = gabungkan(siapa1.nilai, siapa2.nilai);

  // 1268 - upaya damai keluarga. Yang dicari BERHASIL atau TIDAK, bukan
  // kalimatnya - kalimat bakunya disusun di sini supaya seragam antar majelis.
  const damai = (butir) => {
    const kalimat =
      cariButir(butir, ["dirukunkan"]) || cariButir(butir, ["didamaikan"]) || cariButir(butir, ["rukunkan"]);
    if (!kalimat) return { nilai: "", kalimat: "" };
    const gagal = /tidak berhasil|namun gagal|tidak membuahkan/i.test(kalimat);
    // Kalimatnya dari pustaka, bukan disusun di sini - lihat abtKalimatBaku.js.
    return { nilai: kalimatBaku.kalimatUpayaDamai(gagal), kalimat };
  };
  const damai1 = damai(b1);
  const damai2 = damai(b2);
  const upaya = gabungkan(damai1.nilai, damai2.nilai);

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
  const ciriSaksi1 = usulkanHuruf(b1);
  const ciriSaksi2 = usulkanHuruf(b2);
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
  const butirPosita = butirKeterangan(posita);
  const ciriPosita = butirPosita.length ? usulkanHuruf(butirPosita) : null;

  const ciri = ciriPosita ? berdua.filter((x) => ciriPosita.includes(x)) : berdua;

  const ciriSepihak = [
    ...ciriSaksi1.filter((x) => !ciriSaksi2.includes(x)).map((nama) => ({ nama, saksi: 1 })),
    ...ciriSaksi2.filter((x) => !ciriSaksi1.includes(x)).map((nama) => ({ nama, saksi: 2 })),
  ];

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
  const kalimatAlasan = kalimatBaku.susunAlasan(ciri, pihak);

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
  bandingkan("Lama pisah", lama1, lama2);
  bandingkan("Yang meninggalkan", siapa1.nilai, siapa2.nilai);

  const kali = (butir) => {
    const kalimat = cariButir(butir, ["sebanyak"]);
    const angka = kalimat.match(/sebanyak\s+(\d+)\s*kali/i);
    return angka ? `${angka[1]} kali` : "";
  };
  bandingkan("Berapa kali saksi melihat pertengkaran", kali(b1), kali(b2));

  return {
    butir: { saksi1: b1.length, saksi2: b2.length, posita: butirPosita.length },
    ciriSepihak,
    ciriDiluarGugatan,
    ciriBelumTerbukti,
    // Benar bila gugatannya benar-benar terbaca dan ikut menyaring. Layar
    // memakainya untuk membedakan "tidak ada yang di luar gugatan" dari
    // "gugatannya tidak terbaca sehingga tidak diperiksa".
    gugatanTerbaca: Boolean(ciriPosita),
    ciri,
    selisih,
    // Nomor 6: huruf alasan diusulkan beserta bunyi resminya, tanpa satu pun
    // ditandai terpilih - lihat abtAturanAlasan.js.
    huruf: aturanAlasan.usulkan(semua.join(" ")),
    hurufBelumSiap: aturanAlasan.belumSiap(),
    usulan: [
      usulan(
        "0222",
        "Awal Konflik",
        awal,
        [...sumberDari(konflik1, 1), ...sumberDari(konflik2, 2)]
      ),
      usulan(
        "5227",
        "Alasan-Alasan Cerai",
        { nilai: kalimatAlasan, keyakinan: ciri.length ? "pasti" : "kosong", bentrok: "" },
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
        sumberBerpasangan(ciri, b1, b2)
      ),
      usulan("0246", "Pisah Rumah", pisah, [...sumberDari(pisah1, 1), ...sumberDari(pisah2, 2)]),
      usulan("9944", "Lama Pisah", lama, [...sumberDari(pisah1, 1), ...sumberDari(pisah2, 2)]),
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

  const baris = await runQuery(
    "SELECT perkara_id, prodeo FROM perkara WHERE nomor_perkara = ? LIMIT 1",
    [nomor]
  );
  if (!Array.isArray(baris) || !baris[0]) {
    return { ok: false, alasan: "perkara_tidak_ditemukan", usulan: [] };
  }
  const perkaraId = baris[0].perkara_id;
  const prodeo = Number(baris[0].prodeo) === 1;

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

  return { ok: true, perkaraId, prodeo, jumlahKuasa: daftarKuasa.length, usulan: hasil };
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
 * Nama orang yang ditulis KAPITAL sesudah suatu pemicu ("bernama").
 *
 * Nama pada posita ditulis kapital seluruhnya; itulah batasnya. Begitu huruf
 * kecil muncul - "dan", "dengan", "yang" - namanya selesai.
 */
function namaSesudah(kalimat, pemicu) {
  const pola = new RegExp(`${pemicu}\\s+((?:[A-Z][A-Z'.-]*|bin|binti)(?:\\s+(?:[A-Z][A-Z'.-]*|bin|binti))*)`);
  const cocok = String(kalimat || "").match(pola);
  if (!cocok) return "";
  return cocok[1].replace(/\s+/g, " ").replace(/[.,]+$/, "").trim();
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

  // Wali nikah - "dengan wali nikah saudara kandung Pemohon II bernama X".
  const kWali = cari(["wali nikah"]) || cari(["wali", "bernama"]);
  const namaWali = namaSesudah(kWali, "wali(?: nikah)?[^;]*?bernama");
  const statusWali = String(kWali || "").match(
    new RegExp(`wali(?: nikah)?(?:nya)?\\s+(?:adalah\\s+|yaitu\\s+)?([a-z][a-z ]{2,40}?)\\s+(?:${lolos(sebut2)}|${lolos(sebut1)}|Pemohon|bernama)`, "i")
  );

  // Yang menikahkan - "yang menikahkan adalah Imam Masjid bernama KASWARI".
  const kMenikahkan = cari(["menikahkan"]);
  const jabatanMenikahkan = String(kMenikahkan || "").match(
    /menikahkan\s+(?:adalah\s+|yaitu\s+)?((?:[A-Z][A-Za-z.]*\s?){1,5}?)\s*bernama/
  );
  const namaMenikahkan = namaSesudah(kMenikahkan, "menikahkan[^;]*?bernama");
  const yangMenikahkan = namaMenikahkan
    ? `${jabatanMenikahkan ? jabatanMenikahkan[1].trim() + " bernama " : ""}${namaMenikahkan}`
    : "";

  // Saksi nikah - "dihadiri 2 (dua) orang saksi masing-masing bernama MILLO dan MALIWAN".
  const kSaksi = cari(["saksi", "bernama"]);
  const sesudahSaksi = String(kSaksi || "").replace(/^[\s\S]*?\bsaksi\b/, "");
  const saksi1 = namaSesudah(sesudahSaksi, "bernama");
  const saksi2 = saksi1 ? namaSesudah(sesudahSaksi, `${lolos(saksi1)}\\s+dan`) : "";

  // Mahar - "dengan mahar berupa uang sejumlah Rp166.000 ... dibayar tunai".
  const kMahar = cari(["mahar"]) || cari(["mas kawin"]);
  const mahar = String(kMahar || "").match(
    /(?:mahar|mas kawin)\s+(?:berupa\s+)?(.+?)(?:\s+yang\s+(?:diberikan|dibayar|diserahkan)|\s+dibayar|\s+secara\s+tunai|\s*[;.]|$)/i
  );

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
    usulan("1001", "Mas kawin", hasilItsbat(mahar ? mahar[1].replace(/\s+/g, " ").trim() : "", kMahar), sumber(kMahar)),
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

/** Dua bank pembuka kalimat, satu untuk tiap saksi. Substansi tidak berubah. */
const RAGAM_PEMBUKA = [
  ["Ya, ", "Benar, ", "Betul, ", "Setahu saya, ", "Sepengetahuan saya, "],
  ["Benar, ", "Iya, ", "Ya, ", "Yang saya ketahui, ", "Seingat saya, "],
];

/** Pasangan kata yang boleh saling mengganti tanpa mengubah makna hukumnya. */
const RAGAM_KATA = [
  [/\bkarena\b/g, "sebab"],
  [/\bsudah\b/g, "telah"],
  [/\bsering\b/g, "kerap"],
  [/\btidak pernah\b/g, "tak pernah"],
  [/\bkurang lebih\b/g, "sekitar"],
  [/\bsaya mengetahui\b/gi, "saya tahu"],
  [/\bsaya melihat\b/gi, "saya menyaksikan"],
  [/\bbertempat tinggal\b/g, "berdiam"],
  [/\bsaat ini\b/g, "sekarang ini"],
  [/\bsampai sekarang\b/g, "hingga kini"],
];

/** Penanda jawaban templat yang masih menunggu isian manusia. */
const POLA_BELUM_TERISI = /\.{3,}|_{3,}|\bmelihat\/mendengar\b|\bdilihat\/didengar\b|\bXX+\b/i;

/**
 * Menyusun kalimat jawaban saksi ke-N dari jawaban templat.
 *
 * Saksi 1 mendapat bentuk yang paling dekat dengan templatnya; saksi 2
 * mendapat pembuka berbeda dan pergantian kata berselang-seling. Pergantian
 * TIDAK menyentuh nama orang yang ditulis kapital - polanya peka huruf besar
 * kecuali yang memang berawal "saya".
 */
function ragamkanJawaban(jawaban, nomorSaksi, urutan) {
  let teks = String(jawaban || "").replace(/<br\s*\/?>/gi, " ").replace(/\s+/g, " ").trim();
  if (!teks) return "";
  const bank = RAGAM_PEMBUKA[nomorSaksi === 2 ? 1 : 0];
  teks = teks.replace(/^(ya|benar|betul|iya)\s*,?\s*/i, "");
  if (nomorSaksi === 2) {
    RAGAM_KATA.forEach(([pola, ganti], i) => {
      // Berselang-seling menurut urutan pertanyaan supaya dua jawaban yang
      // berdekatan tidak berubah dengan pola yang sama persis.
      if ((i + urutan) % 2 === 0) teks = teks.replace(pola, ganti);
    });
  }
  // Kalimat penutup "Sudah cukup" dan jawaban satu-dua kata tidak diberi pembuka.
  if (/^(sudah|cukup|tidak ada)/i.test(teks) || teks.split(" ").length < 3) return teks.replace(/[;.]?$/, ";");
  const pembuka = bank[(urutan + (nomorSaksi === 2 ? 2 : 0)) % bank.length];
  teks = pembuka + teks.charAt(0).toLowerCase() + teks.slice(1);
  return teks.replace(/[;.]?$/, ";");
}

/**
 * Alasan yang didalilkan gugatan, dibaca dari positanya dengan CIRI_ALASAN.
 *
 * Dipakai saat petugas memilih "sama dengan gugatan": jawaban saksi tentang
 * penyebab hanya boleh memuat alasan yang memang didalilkan.
 */
function alasanDariPosita(posita) {
  const butir = kalimatPosita(posita);
  const kecil = butir.map((k) => k.toLowerCase());
  const hasil = [];
  for (const c of CIRI_ALASAN) {
    if (hasil.includes(c.kunci)) continue;
    if (kecil.some((k) => c.kata.every((kata) => k.includes(kata)))) hasil.push(c.kunci);
  }
  return hasil;
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
function susunKeteranganSaksiSdg(opsi) {
  const templat = Array.isArray(opsi && opsi.templat) ? opsi.templat : [];
  let alasan = Array.isArray(opsi && opsi.alasan) ? opsi.alasan.filter(Boolean) : [];
  let asalAlasan = alasan.length ? "dipilih" : "";
  if (!alasan.length && opsi && opsi.posita) {
    alasan = alasanDariPosita(opsi.posita);
    asalAlasan = alasan.length ? "posita" : "";
  }
  if (templat.length === 0) {
    return { ok: false, alasan: "templat_kosong", saksi1: [], saksi2: [], perluDiisi: [] };
  }

  const perluDiisi = [];
  const susun = (nomorSaksi) =>
    templat.map((baris, i) => {
      const no = String((baris && (baris.no || baris.urutan_pertanyaan)) || i + 1);
      const tanya = String((baris && (baris.tanya || baris.pertanyaan)) || "").replace(/\s+/g, " ").trim();
      let jawab = String((baris && (baris.jawab || baris.jawaban)) || "");

      // Pertanyaan tentang PENYEBAB: jawabannya disusun dari alasan yang
      // didalilkan, bukan dari templat yang menyebut semua kemungkinan.
      if (alasan.length && /penyebab|sebab|alasan/i.test(tanya)) {
        const daftar = alasan.join(nomorSaksi === 2 ? " serta " : " dan ");
        jawab =
          nomorSaksi === 2
            ? `penyebabnya sepengetahuan saya adalah ${daftar}`
            : `penyebab perselisihan dan pertengkaran mereka yang saya ketahui yaitu ${daftar}`;
      }

      if (nomorSaksi === 1 && POLA_BELUM_TERISI.test(jawab)) perluDiisi.push({ no, tanya });
      return { no, tanya, jawab: ragamkanJawaban(jawab, nomorSaksi, i) };
    });

  const saksi1 = susun(1);
  const saksi2 = susun(2);

  // Dua saksi tidak boleh identik kata demi kata. Diperiksa, bukan diandaikan.
  const identik = saksi1.filter(
    (b, i) => saksi2[i] && b.jawab === saksi2[i].jawab && !/^(sudah|cukup|tidak ada)/i.test(b.jawab)
  ).length;

  return {
    ok: true,
    saksi1,
    saksi2,
    perluDiisi,
    identik,
    alasan,
    asalAlasan,
    catatan: perluDiisi.length
      ? `${perluDiisi.length} jawaban masih memuat titik-titik templat dan menunggu keterangan saksi yang sesungguhnya.`
      : "Seluruh jawaban tersusun; baca kembali sebelum disimpan ke ABT.",
  };
}

module.exports = {
  butirKeterangan,
  ambilBulanTahun,
  ambilLamaPisah,
  usulkanHuruf,
  hitungLamaPisah,
  uraikanTanggal,
  dariKeteranganSaksi,
  dariSipp,
  dariPositaItsbat,
  susunKeteranganSaksiSdg,
  alasanDariPosita,
  VARIABEL_ITSBAT,
  CIRI_ALASAN,
};
