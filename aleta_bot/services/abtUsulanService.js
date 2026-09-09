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
  { kunci: "mabuk/judi/obat terlarang", kata: ["sabu"] },
  { kunci: "mabuk/judi/obat terlarang", kata: ["judi"] },
  { kunci: "mabuk/judi/obat terlarang", kata: ["mabuk"] },
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
function dariKeteranganSaksi(teksSaksi1, teksSaksi2, tanggalSidang, pihak) {
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
  const ciri = ciriSaksi1.filter((x) => ciriSaksi2.includes(x));
  const ciriSepihak = [
    ...ciriSaksi1.filter((x) => !ciriSaksi2.includes(x)).map((nama) => ({ nama, saksi: 1 })),
    ...ciriSaksi2.filter((x) => !ciriSaksi1.includes(x)).map((nama) => ({ nama, saksi: 2 })),
  ];
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
    butir: { saksi1: b1.length, saksi2: b2.length },
    ciriSepihak,
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
        semua
          .filter((x) => CIRI_ALASAN.some((c) => c.kata.every((k) => x.toLowerCase().includes(k))))
          .slice(0, 4)
          .map((kalimat) => ({ saksi: b1.includes(kalimat) ? 1 : 2, kalimat }))
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

module.exports = {
  butirKeterangan,
  ambilBulanTahun,
  ambilLamaPisah,
  usulkanHuruf,
  hitungLamaPisah,
  uraikanTanggal,
  dariKeteranganSaksi,
  dariSipp,
};
