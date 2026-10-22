"use strict";

const { relaasRetur, sqlRetur } = require("./returRelaas");

/**
 * ============================================================================
 * TAG PERKARA - SARINGAN TERSIMPAN PADA LAYAR AWAL STATUS PERKARA
 * ============================================================================
 *
 * Diminta pengguna 25 September 2026: menu di samping "Saringan lain" yang
 * berisi tag - sekali tekan, keluar nomor perkara yang dimaksud - beserta
 * saringan rentang waktu (hari ini, antara dua tanggal, tahunan, semester,
 * triwulan, mingguan, harian).
 *
 * Bedanya dengan "Saringan lain" yang sudah ada: saringan menuntut orang tahu
 * APA yang harus diketik. Tag menyebutkan pertanyaannya sendiri beserta
 * jumlahnya - "Putus, belum BHT 240" dapat dibaca sebelum ditekan.
 *
 * ============================================================================
 * DIHITUNG DARI TABEL ANAK, BUKAN DARI TABEL PERKARA KE TABEL ANAK
 * ============================================================================
 *
 * Bentuk pertama berkas ini menghitung dengan `FROM perkara p JOIN anak a`.
 * Itu KEBALIKAN dari yang dijanjikan bagian ini, dan ongkosnya terukur atas
 * salinan satker (10.120 perkara, MariaDB 10.4, lewat mysql.exe):
 *
 *   perkara_pelaksanaan_relaas, 4 tag   FROM perkara p JOIN a   2.150 ms
 *                                       FROM a sendirian           282 ms
 *   perkara_putusan, 3 tag              FROM perkara p JOIN a   3.061 ms
 *                                       FROM a sendirian           516 ms
 *   perkara_putusan JOIN status, 2 tag  FROM perkara p JOIN a   1.214 ms
 *                                       FROM a sendirian           104 ms
 *
 * dan ANGKANYA SAMA PERSIS pada ketiga pasangan itu. Sebabnya
 * perkara_pelaksanaan_relaas (14.495 baris) tidak punya indeks pada
 * perkara_id - hanya PRIMARY(id) - sehingga rencana "perkara sebagai tabel
 * luar" memindai seluruh tabel anak sekali untuk tiap baris perkara.
 *
 * Karena itu tiap tag di sini menyebut TABEL ANAKNYA dan syaratnya, lalu satu
 * kueri per tabel menghitung seluruh tag yang bersumber di sana sekaligus,
 * TANPA menyentuh tabel perkara.
 *
 * Yang membuat itu SAH - bukan kebetulan: baris anak yang perkara_id-nya tidak
 * ada di tabel perkara akan ikut terhitung pada bentuk "anak sendirian" dan
 * tidak ikut pada bentuk lama. Diukur atas ketujuh belas tabel anak yang
 * dipakai berkas ini: 0 baris yatim pada SEMUANYA (perkara_putusan 9.993
 * perkara, 0 yatim; perkara_pelaksanaan_relaas 5.086, 0; perkara_jadwal_sidang
 * 10.116, 0; dan seterusnya). Satu-satunya tabel yang MEMANG punya baris yatim
 * adalah perkara_biaya - 10.122 perkara_id sedangkan register memuat 10.120 -
 * dan tabel itu dipakai lewat sambungan dari perkara, bukan sendirian.
 *
 * ============================================================================
 * TABEL PERKARA DIPINDAI TEPAT SEKALI
 * ============================================================================
 *
 * perkara memuat 60,6 MB untuk 10.120 baris - enam kilobita per baris. Karena
 * itu memindainya memakan 1.333 ms terukur, sedangkan COUNT(*) yang cukup
 * dijawab indeks hanya 96 ms. prodeo dan pengacara_pihak1/2 TIDAK berindeks,
 * jadi sekurangnya satu pemindaian tidak dapat dihindari selama kedua tag itu
 * ada.
 *
 * Maka pemindaian itu dibayar SEKALI dan dipakai untuk sebanyak mungkin tag:
 * seluruh tag tahapan, jenis perkara, prodeo, kuasa, tunggakan, dan seluruh
 * tag gabungan - 47 tag dalam satu kueri, terukur 3.669 ms lengkap dengan enam
 * tabel turunan yang disambungkan padanya.
 *
 * Tabel turunan itu (pu, jdp, ak, ik, ar, bi) dipakai HANYA oleh tag yang
 * memang menyebut aliasnya. Tiap satunya menambah 200-430 ms terukur, jadi tag
 * keberadaan yang tabelnya kecil (banding, kasasi, pk, eksekusi, delegasi,
 * smartmajelis, anak) justru LEBIH MURAH ditanyakan sebagai kueri tabel anak
 * sendiri - 53-60 ms - daripada disambungkan ke pemindaian ini.
 *
 * ============================================================================
 * LINGKUP WAKTU DISELESAIKAN SEKALI, LALU DIDORONG MASUK KE TURUNAN
 * ============================================================================
 *
 * Bentuk pertama menempelkan subkueri berkorelasi
 * `(SELECT MAX(z.tanggal_putusan) ... WHERE z.perkara_id = p.perkara_id)` ke
 * dalam WHERE tiap kueri, sehingga subkueri itu dibayar sembilan belas kali.
 * Akibatnya pilihan yang paling menyempitkan justru yang paling lambat:
 * hitungSemua({dasar:'putus',periode:'triwulan'}) memakan 35.182 ms padahal
 * yang di dalam lingkup hanya 198 perkara.
 *
 * Sekarang daftar perkara_id yang masuk lingkup dijemput SATU KALI dengan
 * kueri tanpa korelasi (144 ms terukur untuk triwulan putus, 96 ms untuk
 * pendaftaran setahun), lalu dipakai sebagai daftar IN pada seluruh kueri.
 * Daftar IN itu MURAH walau panjang: terukur 100 ms untuk 10.120 id pada
 * perkara_pelaksanaan_relaas, sama saja dengan tanpa saringan (97 ms) -
 * sedangkan bentuk `IN (subkueri)` memakan 1.209 ms sebab ia memindai perkara
 * sekali lagi di dalam tiap kueri.
 *
 * Yang menentukan: lingkupnya juga DIDORONG MASUK ke dalam tiap tabel turunan.
 * Tanpa itu turunan tetap disusun utuh - terukur 1.267 ms untuk lingkup 198
 * perkara; dengan itu 77 ms. Sesudah perbaikan ini, lingkup yang menyempit
 * menjadi yang TERCEPAT, sebagaimana semestinya.
 *
 * ============================================================================
 * SYARATNYA TIDAK PERNAH DATANG DARI PERAMBAN
 * ============================================================================
 *
 * Katalog TAG di bawah TERTUTUP. Yang dikirim peramban hanya KUNCInya, dan
 * kunci yang tidak ada di katalog dibuang. Tidak ada satu pun potongan SQL
 * yang berasal dari luar berkas ini.
 *
 * Daftar perkara_id lingkup dirangkai ke teks SQL tanpa tanda tanya. Itu aman
 * dan disengaja: angkanya bukan dari peramban melainkan dari basis data ini
 * sendiri, dan tiap satunya disaring Number.isInteger lebih dahulu - lihat
 * idLingkup(). Tanggal dari peramban tetap lewat tanda tanya, selalu.
 *
 * ============================================================================
 * GALAT TIDAK DITELAN
 * ============================================================================
 *
 * Bentuk pertama menutup tiap kueri dengan `.catch(() => [])`. Dibuktikan
 * dengan menjalankan hitungSemua sungguhan sambil membuat satu kueri gagal
 * (ER_BAD_FIELD_ERROR pada kueri yang menyentuh perkara_pelaksanaan_relaas):
 * "Belum ada relaas" menampilkan 10.120 - yaitu SELURUH REGISTER, sebab
 * angkanya perkaraLingkup dikurangi nol - dan lima tag panggilan menampilkan 0,
 * tanpa satu pun galat sampai ke rute.
 *
 * Sekarang kueri yang gagal MELEMPAR, dan pesannya menyebut tabelnya, kode
 * galat SQL-nya, dan kunci tag yang terpengaruh. Rute membalasnya sebagai 500
 * dan panel menggambar pesan galat.
 *
 * Kenapa melempar, bukan menandai tag itu "tidak terbaca": panel membaca
 * jumlahnya dengan `Number(jumlah[x.kunci] ?? 0)`, sehingga null pun menjadi 0
 * di layar - tidak dapat dibedakan dari nol yang benar. Membedakannya menuntut
 * perubahan pada aleta-ecourt-status-perkara.tsx, yang bukan milik berkas ini.
 *
 * ============================================================================
 * NAMA STATUS PUTUSAN DIBACA LEWAT ID, BUKAN LEWAT KOLOM NAMANYA
 * ============================================================================
 *
 * perkara_putusan.status_putusan_nama KOSONG pada 9.474 dari 9.993 baris
 * (94,8%) - terukur. Yang selalu terisi status_putusan_id, dan namanya ada di
 * tabel status_putusan. Tag "Dicabut" yang membaca tanggal_cabut memulangkan
 * 47 perkara padahal registernya memuat 535; 488 di antaranya hilang tanpa
 * satu pun galat.
 */

const db = require("../db_config");
const petaPerkaraService = require("./petaPerkaraService");

function kueri(sql, params = []) {
  return new Promise((selesai, gagal) => {
    db.query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil || [])));
  });
}

/**
 * Kueri yang kegagalannya DISEBUTKAN, bukan ditelan.
 *
 * Pesannya menyebut apa yang sedang dihitung, kode galat SQL-nya, dan kunci
 * tag yang ikut hilang - tanpa ketiganya, satu kolom yang berganti nama di
 * SIPP versi lain hanya terbaca sebagai angka yang salah di layar.
 */
async function kueriTag(sql, params, keterangan, kunciTerpengaruh = []) {
  try {
    return await kueri(sql, params);
  } catch (galat) {
    const pesan = String(galat.sqlMessage || galat.message || galat).slice(0, 220);
    const kode = galat.code ? ` [${galat.code}]` : "";
    const daftar = kunciTerpengaruh.length ? ` Tag yang ikut hilang: ${kunciTerpengaruh.join(", ")}.` : "";
    const naik = new Error(`Tag perkara gagal dihitung pada ${keterangan}${kode}: ${pesan}.${daftar}`);
    naik.tagTerpengaruh = kunciTerpengaruh;
    naik.kodeSql = galat.code || "";
    throw naik;
  }
}

/** Kelompok tag, urut sebagaimana digambar layar. */
const KELOMPOK_TAG = Object.freeze([
  { kunci: "keadaan", label: "Keadaan perkara" },
  { kunci: "tunggakan", label: "Tunggakan dan umur perkara" },
  { kunci: "waktu", label: "Tahapan dan waktu" },
  { kunci: "jenis", label: "Jenis perkara" },
  { kunci: "mediasi", label: "Mediasi" },
  { kunci: "panggilan", label: "Panggilan dan relaas" },
  { kunci: "berkas", label: "Berkas dan produk" },
  { kunci: "ecourt", label: "e-Court" },
  { kunci: "keuangan", label: "Keuangan" },
  { kunci: "pihak", label: "Para pihak" },
  { kunci: "aparat", label: "Majelis dan petugas" },
  { kunci: "mutu", label: "Mutu data" },
]);

/** Tabel putusan beserta JOIN nama statusnya - dipakai delapan tag. */
const PUTUSAN_BERNAMA =
  "perkara_putusan a JOIN status_putusan s ON s.id = a.status_putusan_id";

/** Tabel perkara sendiri. Tag yang menyebut ini dihitung pada kueri register. */
const REGISTER = "perkara a";

/**
 * ============================================================================
 * TABEL TURUNAN YANG DISAMBUNGKAN KE PEMINDAIAN REGISTER
 * ============================================================================
 *
 * Tiap satunya menjawab SATU pertanyaan tentang perkara dan memulangkan
 * PALING BANYAK SATU BARIS per perkara - itulah yang membuat SUM(...) pada
 * kueri register menghitung perkara, bukan baris. Turunan yang memulangkan
 * lebih dari satu baris per perkara akan melipatgandakan seluruh angka.
 *
 * Tag menyebut turunan yang dibutuhkannya lewat ALIASNYA di dalam syaratnya
 * (mis. `pu.tglBht IS NOT NULL`), dan sambungannya dipasang hanya bila memang
 * disebut. Alias yang salah tulis tidak jadi nol diam-diam: kuerinya gagal
 * dengan ERROR 1054 dan kueriTag melemparkannya.
 *
 * Ongkos tiap sambungan pada lingkup seluruh register, terukur berurutan di
 * atas pemindaian dasar 1.333 ms: pu +433, jdp +292, ak/ik +424 berdua,
 * ar +390, bi +409.
 */
const SAMBUNGAN = Object.freeze({
  // Tanggal putusan dan tanggal BHT TERAKHIR tiap perkara. Satu turunan untuk
  // keduanya, bukan dua: memisahkannya berarti dua kali memindai
  // perkara_putusan untuk pertanyaan yang sama.
  pu: {
    pilih: "perkara_id, MAX(tanggal_putusan) AS tglPutus, MAX(tanggal_bht) AS tglBht",
    dari: "perkara_putusan",
    syarat: "",
    kelompok: "GROUP BY perkara_id",
    pada: "pu.perkara_id = p.perkara_id",
  },
  // Perkara yang masih punya jadwal sidang hari ini atau sesudahnya. MAX sudah
  // cukup: bila yang terakhir belum lewat, ada sidang berikutnya.
  jdp: {
    pilih: "DISTINCT perkara_id",
    dari: "perkara_jadwal_sidang",
    syarat: "tanggal_sidang >= CURDATE()",
    kelompok: "",
    pada: "jdp.perkara_id = p.perkara_id",
  },
  // Akta cerai yang SUNGGUH sudah terbit - tgl_akta_cerai terisi. 80 dari
  // 4.607 baris perkara_akta_cerai tanggalnya NULL, dan ke-80 itu justru yang
  // membuat dua tag akta lama berbohong; lihat catatan pada akta-belum-diambil.
  ak: {
    pilih: "DISTINCT perkara_id",
    dari: "perkara_akta_cerai",
    syarat: "tgl_akta_cerai IS NOT NULL",
    kelompok: "",
    pada: "ak.perkara_id = p.perkara_id",
  },
  // Ikrar talak yang sudah DILAKSANAKAN, bukan yang barisnya sudah ada.
  ik: {
    pilih: "DISTINCT perkara_id",
    dari: "perkara_ikrar_talak",
    syarat: "tgl_ikrar_talak IS NOT NULL",
    kelompok: "",
    pada: "ik.perkara_id = p.perkara_id",
  },
  // Arsip tertaut lewat NOMOR, bukan lewat perkara_id: kolom perkara_id pada
  // tabel arsip bernilai 0 seluruhnya, dan nomornya berekor titik - lihat
  // catatan "arsip tertaut lewat nomor" pada kendaliBerkasService. Turunan ini
  // tidak dapat dilingkupi perkara_id sebab ia tidak punya kolom itu; yang
  // melingkupinya WHERE pada perkara di luar.
  ar: {
    pilih: "DISTINCT TRIM(TRAILING '.' FROM a.nomor_perkara) AS nomor",
    dari: "arsip a",
    syarat: "",
    kelompok: "",
    pada: "ar.nomor = p.nomor_perkara",
    tanpaLingkup: true,
  },
  // Sisa panjar tiap perkara. jenis_transaksi bernilai -1 dan 1 pada basis
  // data ini, BUKAN 1 dan 2: terukur 89.515 baris bernilai -1 dan 10.768
  // bernilai 1. Dan 1 itu penerimaan - baris "Panjar" - sedangkan -1
  // pengeluaran ("Biaya Pendaftaran", "Panggilan Pemohon", "Pengembalian Sisa
  // Panjar"), jadi SUM(jenis_transaksi * jumlah) adalah sisa yang belum
  // dikeluarkan.
  bi: {
    pilih: "perkara_id, SUM(jenis_transaksi * jumlah) AS sisa",
    dari: "perkara_biaya",
    syarat: "",
    kelompok: "GROUP BY perkara_id",
    pada: "bi.perkara_id = p.perkara_id",
  },
});

const ALIAS_SAMBUNGAN = Object.freeze(Object.keys(SAMBUNGAN));

/**
 * Sumber tiap tag: satu tabel, satu syarat.
 *
 *   tabel   tabel anaknya dengan alias `a`, atau REGISTER untuk tag yang
 *           bersumber pada kolom tabel perkara sendiri
 *   syarat  syarat SQL atas alias itu - TIDAK PERNAH dari peramban. Tag
 *           register boleh menyebut alias tabel turunan di atas.
 *   balik   true berarti tag menanyakan KETIADAAN - perkara dalam lingkup
 *           yang TIDAK punya baris yang cocok
 *   lewatNomor  menandai tag yang sumbernya tertaut lewat nomor perkara, bukan
 *           lewat perkara_id - hanya tabel arsip
 *
 * TIDAK ADA medan `tanggal` lagi. Bentuk pertama membawanya pada sebelas tag
 * dan tidak satu baris kode pun pernah membacanya. Ia dibuang, bukan
 * ditepati, dan sebabnya: lingkup panel ini SATU untuk seluruh panel -
 * "Dihitung atas 1 Jul s.d. 30 Sep, diputus" tertulis di layar, dan
 * perkaraLingkup yang menjadi penyebut seluruh tag ketiadaan juga satu angka.
 * Kalau tag relaas diam-diam dilingkupi tanggal_relaas sedangkan judul
 * panelnya menyebut tanggal putus, satu panel menjawab dua pertanyaan berbeda
 * di bawah satu judul - persis cacat "satu nama dua arti" yang sudah dijaga
 * uji berkas ini. Yang ditepati justru MAKSUDNYA: dasar tanggal relaas dan
 * ikrar ditambahkan ke DASAR_TANGGAL sebagai pilihan yang DISEBUTKAN layar,
 * sehingga "relaas yang dilaksanakan triwulan ini" dapat ditanyakan dengan
 * sadar, bukan diam-diam.
 */
const TAG = Object.freeze({
  // --- keadaan perkara -----------------------------------------------------
  "belum-putus": {
    kelompok: "keadaan",
    label: "Belum putus",
    nada: "awas",
    judul: "Belum ada baris putusan bertanggal pada perkara ini. Terukur 127 dari 10.120.",
    tabel: "perkara_putusan a",
    syarat: "a.tanggal_putusan IS NOT NULL",
    balik: true,
  },
  "sudah-putus": {
    kelompok: "keadaan",
    label: "Sudah putus",
    nada: "aman",
    judul: "Sudah ada tanggal putusan.",
    tabel: "perkara_putusan a",
    syarat: "a.tanggal_putusan IS NOT NULL",
  },
  "putus-belum-bht": {
    kelompok: "keadaan",
    label: "Putus, belum BHT",
    nada: "awas",
    judul: "Sudah diputus tetapi tanggal berkekuatan hukum tetap belum tercatat.",
    tabel: "perkara_putusan a",
    syarat: "a.tanggal_putusan IS NOT NULL AND a.tanggal_bht IS NULL",
  },
  "sudah-bht": {
    kelompok: "keadaan",
    label: "Sudah BHT",
    nada: "aman",
    judul: "Tanggal berkekuatan hukum tetap sudah tercatat.",
    tabel: "perkara_putusan a",
    syarat: "a.tanggal_bht IS NOT NULL",
  },
  dikabulkan: {
    kelompok: "keadaan",
    label: "Dikabulkan",
    nada: "netral",
    judul: "Status putusan Dikabulkan menurut tabel status_putusan.",
    tabel: PUTUSAN_BERNAMA,
    syarat: "s.nama = 'Dikabulkan'",
  },
  ditolak: {
    kelompok: "keadaan",
    label: "Ditolak",
    nada: "netral",
    judul: "Status putusan Ditolak.",
    tabel: PUTUSAN_BERNAMA,
    syarat: "s.nama = 'Ditolak'",
  },
  "tidak-diterima": {
    kelompok: "keadaan",
    label: "Tidak dapat diterima",
    nada: "netral",
    judul: "Status putusan Tidak Dapat Diterima (N.O.).",
    tabel: PUTUSAN_BERNAMA,
    syarat: "s.nama = 'Tidak Dapat Diterima'",
  },
  dicabut: {
    kelompok: "keadaan",
    label: "Dicabut",
    nada: "netral",
    judul:
      "Status putusan Dicabut. Dibaca dari status_putusan_id: kolom tanggal_cabut hanya terisi pada 47 dari 535 perkara yang dicabut.",
    tabel: PUTUSAN_BERNAMA,
    syarat: "s.nama = 'Dicabut'",
  },
  gugur: {
    kelompok: "keadaan",
    label: "Gugur",
    nada: "netral",
    judul: "Status putusan Digugurkan atau Gugur - dua id berbeda dengan arti yang sama.",
    tabel: PUTUSAN_BERNAMA,
    syarat: "s.nama IN ('Digugurkan', 'Gugur')",
  },
  dicoret: {
    kelompok: "keadaan",
    label: "Dicoret dari register",
    nada: "netral",
    judul: "Status putusan Dicoret dari Register.",
    tabel: PUTUSAN_BERNAMA,
    syarat: "s.nama = 'Dicoret dari Register'",
  },
  perdamaian: {
    kelompok: "keadaan",
    label: "Perdamaian",
    nada: "aman",
    judul: "Status putusan Perdamaian - berakhir dengan akta perdamaian.",
    tabel: PUTUSAN_BERNAMA,
    syarat: "s.nama = 'Perdamaian'",
  },
  verstek: {
    kelompok: "keadaan",
    label: "Verstek",
    nada: "netral",
    judul: "Diputus tanpa hadirnya tergugat atau termohon.",
    tabel: "perkara_putusan a",
    syarat: "a.putusan_verstek = 'Y'",
  },
  contradictoir: {
    kelompok: "keadaan",
    label: "Contradictoir",
    nada: "netral",
    judul: "Diputus dengan hadirnya kedua pihak.",
    tabel: "perkara_putusan a",
    syarat: "a.putusan_verstek = 'T'",
  },
  banding: {
    kelompok: "keadaan",
    label: "Banding",
    nada: "sejuk",
    judul: "Ada baris banding.",
    tabel: "perkara_banding a",
    syarat: "1 = 1",
  },
  kasasi: {
    kelompok: "keadaan",
    label: "Kasasi",
    nada: "sejuk",
    judul: "Ada baris kasasi.",
    tabel: "perkara_kasasi a",
    syarat: "1 = 1",
  },
  pk: {
    kelompok: "keadaan",
    label: "Peninjauan kembali",
    nada: "sejuk",
    judul: "Ada baris peninjauan kembali.",
    tabel: "perkara_pk a",
    syarat: "1 = 1",
  },
  eksekusi: {
    kelompok: "keadaan",
    label: "Dieksekusi",
    nada: "sejuk",
    judul: "Ada baris eksekusi.",
    tabel: "perkara_eksekusi a",
    syarat: "1 = 1",
  },

  // --- tunggakan dan umur perkara ------------------------------------------
  //
  // Inilah pertanyaan pengawasan yang ditanyakan tiap bulan, dan sebelumnya
  // tidak ada satu pun tag yang menjawabnya.
  //
  // ==========================================================================
  // KELONGGARAN GHAIB TIDAK DIPOTONG DI SINI - DAN ITU DISENGAJA
  // ==========================================================================
  //
  // penilaianSippService.kelonggaranWaktuPutus memotong 120 hari untuk perkara
  // ghaib, 180 untuk ghaib yang diumumkan, 270 untuk mafqud. Potongan itu
  // milik PENILAIAN SK 048/2024, bukan milik SEMA 2/2014, dan ALETA sudah
  // memisahkan keduanya di dua tempat:
  //
  //   sippStatusPerkaraService.UMUR_SYARAT ("lewat 3 bulan"/"lewat 5 bulan"
  //   pada Saringan lain) membandingkan tanggal_pendaftaran dengan CURDATE
  //   apa adanya, tanpa potongan apa pun;
  //
  //   sippJadwalSidangService menghitung hariSema = kotor - mediasi TANPA
  //   kelonggaran SK, dan menyebut itu "satu-satunya penjaga agar potongan
  //   ghaib tidak pernah menyembunyikan kewajiban lapor SEMA 2/2014".
  //
  // Kalau tag ini memotong kelonggaran, ia akan menyebut angka yang BERBEDA
  // dari saringan umur pada layar yang sama - dua kendali bersebelahan
  // menjawab pertanyaan yang sama dengan dua angka. Karena itu syaratnya
  // ditulis sama dengan UMUR_SYARAT: terukur keduanya 7 dan 1 pada 25
  // September 2026.
  //
  // Diukur pula seberapa besar bedanya kalau kelonggaran ghaib DIPOTONG, pada
  // penciri ghaib paling tegas (perkara_pihak2.ghaib = 1): dari 87 perkara
  // yang diputus lewat 150 hari, 86 tetap lewat. Satu perkara.
  "tunggakan-3bulan": {
    kelompok: "tunggakan",
    label: "Belum putus, lewat 3 bulan",
    nada: "awas",
    judul:
      "Belum ada putusan dan sudah lewat tiga bulan sejak didaftarkan. Syaratnya sama dengan saringan umur pada Saringan lain - tanpa potongan kelonggaran, supaya kedua kendali menyebut angka yang sama. Terukur 7 pada 25 September 2026.",
    tabel: REGISTER,
    syarat: "pu.tglPutus IS NULL AND a.tanggal_pendaftaran < DATE_SUB(CURDATE(), INTERVAL 3 MONTH)",
  },
  "tunggakan-5bulan": {
    kelompok: "tunggakan",
    label: "Belum putus, lewat 5 bulan (SEMA 2/2014)",
    nada: "bahaya",
    judul:
      "Belum ada putusan dan sudah lewat lima bulan sejak didaftarkan - ambang SEMA 2/2014, dan satu-satunya tag yang berakibat pada penilaian satker. Terukur 1 pada 25 September 2026.",
    tabel: REGISTER,
    syarat: "pu.tglPutus IS NULL AND a.tanggal_pendaftaran < DATE_SUB(CURDATE(), INTERVAL 5 MONTH)",
  },
  "putus-lewat-5bulan": {
    kelompok: "tunggakan",
    label: "Diputus lewat 5 bulan",
    nada: "awas",
    judul:
      "Sudah diputus, tetapi putusannya jatuh lebih dari lima bulan kalender sesudah perkara didaftarkan. Angka kalender apa adanya - mediasi dan kelonggaran SK TIDAK dipotong, jadi ini bukan nilai unsur waktu putus pada penilaian. Terukur 77.",
    tabel: REGISTER,
    syarat: "pu.tglPutus > DATE_ADD(a.tanggal_pendaftaran, INTERVAL 5 MONTH)",
  },
  "perkara-mandek": {
    kelompok: "tunggakan",
    label: "Belum putus, tanpa sidang berikutnya",
    nada: "bahaya",
    judul:
      "Belum diputus dan tidak ada satu pun jadwal sidang hari ini atau sesudahnya - perkara yang berhenti tanpa agenda. Terukur 101 dari 127 yang belum putus, sedangkan tag Belum dijadwalkan hanya menemukan 4 yang tidak punya jadwal sama sekali.",
    tabel: REGISTER,
    syarat: "pu.tglPutus IS NULL AND jdp.perkara_id IS NULL",
  },

  // --- tahapan dan waktu ---------------------------------------------------
  //
  // Kesepuluh keranjang tahapan_terakhir_text ADA di sini, bukan lima seperti
  // bentuk pertama: yang terlewat dulu justru Putusan (5.433) dan Akta Cerai
  // (4.493) - 98% register - sehingga kelompok ini tampak menghitung 180
  // perkara dari 10.120. Terukur: Putusan 5.433, Akta Cerai 4.493,
  // Persidangan 77, Penetapan 49, Ikrar Talak 42, Pendaftaran Perkara 12,
  // Banding 9, Eksekusi 3, Kasasi 1, Peninjauan Kembali 1, dan 0 baris
  // bernilai NULL. Jumlah kesepuluhnya 10.120, dapat diperiksa.
  //
  // Dibaca lewat TEKSnya, bukan lewat tahapan_terakhir_id, walaupun idnya
  // berindeks dan teksnya tidak - jadi daftar id tag ini memakan 1,9 detik
  // sedangkan lewat id hanya 51 ms. Sebabnya tidak ada tabel rujukan `tahapan`
  // pada kedua salinan SIPP yang ada di sini, sehingga tidak ada cara
  // membuktikan bahwa id 10 berarti "Pendaftaran Perkara" juga di satker lain.
  // Angka yang salah diam-diam lebih mahal daripada 1,9 detik.
  "tahap-pendaftaran": {
    kelompok: "waktu",
    label: "Berhenti di pendaftaran",
    nada: "bahaya",
    judul: "tahapan_terakhir_text masih Pendaftaran Perkara.",
    tabel: REGISTER,
    syarat: "a.tahapan_terakhir_text = 'Pendaftaran Perkara'",
  },
  "tahap-persidangan": {
    kelompok: "waktu",
    label: "Sedang bersidang",
    nada: "netral",
    judul: "tahapan_terakhir_text Persidangan.",
    tabel: REGISTER,
    syarat: "a.tahapan_terakhir_text = 'Persidangan'",
  },
  "tahap-penetapan": {
    kelompok: "waktu",
    label: "Tahap penetapan",
    nada: "netral",
    judul: "tahapan_terakhir_text Penetapan.",
    tabel: REGISTER,
    syarat: "a.tahapan_terakhir_text = 'Penetapan'",
  },
  "tahap-ikrar": {
    kelompok: "waktu",
    label: "Tahap ikrar talak",
    nada: "netral",
    judul: "tahapan_terakhir_text Ikrar Talak.",
    tabel: REGISTER,
    syarat: "a.tahapan_terakhir_text = 'Ikrar Talak'",
  },
  "tahap-putusan": {
    kelompok: "waktu",
    label: "Berhenti di putusan",
    nada: "netral",
    judul:
      "tahapan_terakhir_text Putusan - keranjang terbesar register (5.433), dan yang terlewat dari kelompok ini sebelum 25 September 2026.",
    tabel: REGISTER,
    syarat: "a.tahapan_terakhir_text = 'Putusan'",
  },
  "tahap-akta-cerai": {
    kelompok: "waktu",
    label: "Sampai akta cerai",
    nada: "aman",
    judul: "tahapan_terakhir_text Akta Cerai - tahapan terjauh yang tercatat SIPP.",
    tabel: REGISTER,
    syarat: "a.tahapan_terakhir_text = 'Akta Cerai'",
  },
  "tahap-banding": {
    kelompok: "waktu",
    label: "Tahap banding",
    nada: "sejuk",
    judul: "tahapan_terakhir_text Banding - tahapan terakhirnya, bukan sekadar ada baris banding.",
    tabel: REGISTER,
    syarat: "a.tahapan_terakhir_text = 'Banding'",
  },
  "tahap-kasasi": {
    kelompok: "waktu",
    label: "Tahap kasasi",
    nada: "sejuk",
    judul: "tahapan_terakhir_text Kasasi - tahapan terakhirnya, bukan sekadar ada baris kasasi.",
    tabel: REGISTER,
    syarat: "a.tahapan_terakhir_text = 'Kasasi'",
  },
  "tahap-pk": {
    kelompok: "waktu",
    label: "Tahap peninjauan kembali",
    nada: "sejuk",
    judul: "tahapan_terakhir_text Peninjauan Kembali - tahapan terakhirnya, bukan sekadar ada barisnya.",
    tabel: REGISTER,
    syarat: "a.tahapan_terakhir_text = 'Peninjauan Kembali'",
  },
  "tahap-eksekusi": {
    kelompok: "waktu",
    label: "Tahap eksekusi",
    nada: "sejuk",
    judul: "tahapan_terakhir_text Eksekusi - tahapan terakhirnya, bukan sekadar ada baris eksekusi.",
    tabel: REGISTER,
    syarat: "a.tahapan_terakhir_text = 'Eksekusi'",
  },
  "pernah-ditunda": {
    kelompok: "waktu",
    label: "Pernah ditunda",
    nada: "netral",
    judul: "Ada sidang bertanda ditunda.",
    tabel: "perkara_jadwal_sidang a",
    syarat: "a.ditunda = 'Y'",
  },
  "punya-sidang-depan": {
    kelompok: "waktu",
    label: "Ada sidang berikutnya",
    nada: "aman",
    judul: "Ada jadwal sidang bertanggal hari ini atau sesudahnya.",
    tabel: "perkara_jadwal_sidang a",
    syarat: "a.tanggal_sidang >= CURDATE()",
  },
  "belum-dijadwalkan": {
    kelompok: "waktu",
    label: "Belum dijadwalkan",
    nada: "bahaya",
    judul: "Belum ada satu pun jadwal sidang. Terukur 4 - bandingkan dengan Belum putus tanpa sidang berikutnya (101).",
    tabel: "perkara_jadwal_sidang a",
    syarat: "1 = 1",
    balik: true,
  },
  "ikrar-menunggu": {
    kelompok: "waktu",
    label: "Ikrar ditetapkan, belum dilaksanakan",
    nada: "awas",
    judul:
      "Sudah ada baris ikrar talak tetapi tgl_ikrar_talak masih kosong. Terukur 117 - hanya yang barisnya SUDAH ada; 219 perkara cerai talak yang sudah BHT tanpa baris ikrar sama sekali dihitung tag Cerai talak BHT, ikrar belum.",
    tabel: "perkara_ikrar_talak a",
    syarat: "a.tgl_ikrar_talak IS NULL",
  },

  // --- jenis perkara -------------------------------------------------------
  //
  // ==========================================================================
  // DIBACA LEWAT jenis_perkara_id, BUKAN LEWAT NAMANYA - DAN INI TERUKUR
  // ==========================================================================
  //
  // Isian teks "Jenis perkara" pada Saringan lain menuntut orang mengetik
  // ejaan yang benar, dan untuk satu jenis itu MUSTAHIL: id 360 muncul dengan
  // DUA ejaan pada kolom jenis_perkara_nama - "Pengesahan
  // Perkawinan/Istbat Nikah" 3.964 baris dan "Istbat Nikah" 89 baris. Yang
  // mengetik salah satu kehilangan yang lain.
  //
  // Dibuktikan bahwa idnya yang benar: tabel rujukan jenis_perkara menyebut id
  // 360 bernama "Pengesahan Perkawinan/Istbat Nikah", jadi 89 baris itu salinan
  // basi pada kolom nama - bukan jenis yang lain. Menghitung lewat id
  // memulangkan 4.053, yaitu 3.964 + 89 tepat.
  //
  // Idnya pun bukan milik satker ini sendiri: id 346/347/360/362/371 bernama
  // sama pada basis data satker kedua yang ada di sini (sipp, PA Bungku).
  //
  // Jumlah ketujuh belas tag di bawah = 10.120, seluruh register, dapat
  // diperiksa. Terukur seluruhnya dalam pemindaian register yang sama.
  "jenis-cerai-gugat": {
    kelompok: "jenis",
    label: "Cerai Gugat",
    nada: "netral",
    judul: "jenis_perkara_id 347. Terukur 4.411 - jenis terbanyak di register ini.",
    tabel: REGISTER,
    syarat: "a.jenis_perkara_id = 347",
  },
  "jenis-cerai-talak": {
    kelompok: "jenis",
    label: "Cerai Talak",
    nada: "netral",
    judul: "jenis_perkara_id 346. Terukur 1.166. Inilah jenis yang menuntut ikrar talak.",
    tabel: REGISTER,
    syarat: "a.jenis_perkara_id = 346",
  },
  "jenis-istbat-nikah": {
    kelompok: "jenis",
    label: "Pengesahan Perkawinan/Istbat Nikah",
    nada: "netral",
    judul:
      "jenis_perkara_id 360. Terukur 4.053 - menangkap KEDUA ejaan yang ada di kolom namanya (3.964 + 89), yang tidak dapat dilakukan dengan mengetik nama.",
    tabel: REGISTER,
    syarat: "a.jenis_perkara_id = 360",
  },
  "jenis-dispensasi-kawin": {
    kelompok: "jenis",
    label: "Dispensasi Kawin",
    nada: "netral",
    judul: "jenis_perkara_id 362. Terukur 198.",
    tabel: REGISTER,
    syarat: "a.jenis_perkara_id = 362",
  },
  "jenis-p3hp": {
    kelompok: "jenis",
    label: "P3HP/Penetapan Ahli Waris",
    nada: "netral",
    judul: "jenis_perkara_id 371. Terukur 102.",
    tabel: REGISTER,
    syarat: "a.jenis_perkara_id = 371",
  },
  "jenis-perwalian": {
    kelompok: "jenis",
    label: "Perwalian",
    nada: "netral",
    judul: "jenis_perkara_id 354. Terukur 91.",
    tabel: REGISTER,
    syarat: "a.jenis_perkara_id = 354",
  },
  "jenis-kewarisan": {
    kelompok: "jenis",
    label: "Kewarisan",
    nada: "netral",
    judul: "jenis_perkara_id 364. Terukur 22.",
    tabel: REGISTER,
    syarat: "a.jenis_perkara_id = 364",
  },
  "jenis-harta-bersama": {
    kelompok: "jenis",
    label: "Harta Bersama",
    nada: "netral",
    judul: "jenis_perkara_id 348. Terukur 13.",
    tabel: REGISTER,
    syarat: "a.jenis_perkara_id = 348",
  },
  "jenis-wali-adhol": {
    kelompok: "jenis",
    label: "Wali Adhol",
    nada: "netral",
    judul: "jenis_perkara_id 363. Terukur 13.",
    tabel: REGISTER,
    syarat: "a.jenis_perkara_id = 363",
  },
  "jenis-asal-usul-anak": {
    kelompok: "jenis",
    label: "Asal Usul Anak",
    nada: "netral",
    judul: "jenis_perkara_id 358. Terukur 13.",
    tabel: REGISTER,
    syarat: "a.jenis_perkara_id = 358",
  },
  "jenis-izin-poligami": {
    kelompok: "jenis",
    label: "Izin Poligami",
    nada: "netral",
    judul: "jenis_perkara_id 341. Terukur 12.",
    tabel: REGISTER,
    syarat: "a.jenis_perkara_id = 341",
  },
  "jenis-ekonomi-syariah": {
    kelompok: "jenis",
    label: "Ekonomi Syariah",
    nada: "netral",
    judul:
      "jenis_perkara_id 370. Terukur 2. Jenis yang menuntut hakim bersertifikat ekonomi syariah - lihat aturan penunjukan majelis.",
    tabel: REGISTER,
    syarat: "a.jenis_perkara_id = 370",
  },
  "jenis-pencegahan-perkawinan": {
    kelompok: "jenis",
    label: "Pencegahan Perkawinan",
    nada: "netral",
    judul: "jenis_perkara_id 342. Terukur 2.",
    tabel: REGISTER,
    syarat: "a.jenis_perkara_id = 342",
  },
  "jenis-penolakan-perkawinan": {
    kelompok: "jenis",
    label: "Penolakan Perkawinan",
    nada: "netral",
    judul: "jenis_perkara_id 343. Terukur 1.",
    tabel: REGISTER,
    syarat: "a.jenis_perkara_id = 343",
  },
  "jenis-pembatalan-perkawinan": {
    kelompok: "jenis",
    label: "Pembatalan Perkawinan",
    nada: "netral",
    judul: "jenis_perkara_id 344. Terukur 1.",
    tabel: REGISTER,
    syarat: "a.jenis_perkara_id = 344",
  },
  "jenis-wasiat": {
    kelompok: "jenis",
    label: "Wasiat",
    nada: "netral",
    judul: "jenis_perkara_id 365. Terukur 1.",
    tabel: REGISTER,
    syarat: "a.jenis_perkara_id = 365",
  },
  "jenis-lain-lain": {
    kelompok: "jenis",
    label: "Lain-Lain",
    nada: "netral",
    judul: "jenis_perkara_id 369. Terukur 19.",
    tabel: REGISTER,
    syarat: "a.jenis_perkara_id = 369",
  },

  // --- mediasi -------------------------------------------------------------
  // Kode hasil_mediasi, artinya dari sippTahapanService. Kolom
  // mediasi_berhasil dan mediasi_gagal NULL pada 754 dari 754 baris - keduanya
  // mati dan tidak dipakai di sini.
  "mediasi-berhasil": {
    kelompok: "mediasi",
    label: "Mediasi berhasil",
    nada: "aman",
    judul: "hasil_mediasi Y1 (kesepakatan damai), Y2 (pencabutan), atau S (berhasil sebagian).",
    tabel: "perkara_mediasi a",
    syarat: "a.hasil_mediasi IN ('Y1', 'Y2', 'S')",
  },
  "mediasi-gagal": {
    kelompok: "mediasi",
    label: "Mediasi tidak berhasil",
    nada: "netral",
    judul: "hasil_mediasi T.",
    tabel: "perkara_mediasi a",
    syarat: "a.hasil_mediasi = 'T'",
  },
  "mediasi-tak-terlaksana": {
    kelompok: "mediasi",
    label: "Mediasi tak dapat dilaksanakan",
    nada: "awas",
    judul: "hasil_mediasi D.",
    tabel: "perkara_mediasi a",
    syarat: "a.hasil_mediasi = 'D'",
  },
  "mediasi-tanpa-hasil": {
    kelompok: "mediasi",
    label: "Hasil mediasi belum dicatat",
    nada: "bahaya",
    judul: "Ada baris mediasi tetapi hasil_mediasi masih kosong.",
    tabel: "perkara_mediasi a",
    syarat: "a.hasil_mediasi IS NULL OR a.hasil_mediasi = ''",
  },

  // --- panggilan dan relaas ------------------------------------------------
  retur: {
    kelompok: "panggilan",
    label: "Relaas retur",
    nada: "bahaya",
    judul: "Relaas kembali tidak terlaksana - panggilan harus diulang.",
    tabel: "perkara_pelaksanaan_relaas a",
    syarat: sqlRetur("a"),
  },
  "panggil-surat-tercatat": {
    kelompok: "panggilan",
    label: "Surat tercatat (POS)",
    nada: "netral",
    judul: "ket_temu S - panggilan lewat surat tercatat kantor pos.",
    tabel: "perkara_pelaksanaan_relaas a",
    syarat: "a.ket_temu = 'S'",
  },
  ghaib: {
    kelompok: "panggilan",
    label: "Dipanggil sebagai ghaib",
    nada: "awas",
    judul:
      "ket_temu R (radio), M (media massa), W (papan pengumuman pengadilan), atau P (papan pengumuman Pemda) - keempatnya cara memanggil pihak yang tidak diketahui keberadaannya.",
    tabel: "perkara_pelaksanaan_relaas a",
    syarat: "a.ket_temu IN ('R', 'M', 'W', 'P')",
  },
  "panggil-elektronik": {
    kelompok: "panggilan",
    label: "Dipanggil elektronik",
    nada: "netral",
    judul: "ket_temu E - panggilan elektronik (e-Summons).",
    tabel: "perkara_pelaksanaan_relaas a",
    syarat: "a.ket_temu = 'E'",
  },
  "panggil-tidak-bertemu": {
    kelompok: "panggilan",
    label: "Tidak bertemu",
    nada: "awas",
    judul: "ket_temu T - jurusita tidak bertemu pihaknya.",
    tabel: "perkara_pelaksanaan_relaas a",
    syarat: "a.ket_temu = 'T'",
  },
  "panggil-bertemu": {
    kelompok: "panggilan",
    label: "Bertemu langsung",
    nada: "aman",
    judul:
      "Juru sita bertemu langsung dengan yang dipanggil - relaas diserahkan kepada orangnya sendiri, bukan lewat kepala desa atau lurah.",
    tabel: "perkara_pelaksanaan_relaas a",
    syarat: "a.ket_temu = 'Y'",
  },
  "tanpa-relaas": {
    kelompok: "panggilan",
    label: "Belum ada relaas",
    nada: "bahaya",
    judul: "Belum ada satu pun baris relaas - berbeda dari relaas yang gagal. Terukur 5.034.",
    tabel: "perkara_pelaksanaan_relaas a",
    syarat: "1 = 1",
    balik: true,
  },
  "delegasi-keluar": {
    kelompok: "panggilan",
    label: "Delegasi keluar",
    nada: "netral",
    judul:
      "Ada permintaan bantuan panggilan ke pengadilan lain. HANYA delegasi_keluar: perkara_id pada delegasi_masuk milik pengadilan PENGIRIM, bukan milik satker ini.",
    tabel: "delegasi_keluar a",
    syarat: "1 = 1",
  },

  // --- berkas dan produk ---------------------------------------------------
  "putusan-tanpa-berkas": {
    kelompok: "berkas",
    label: "Naskah putusan belum ada",
    nada: "bahaya",
    judul: "Sudah diputus tetapi amar_putusan_dok kosong.",
    tabel: "perkara_putusan a",
    syarat:
      "a.tanggal_putusan IS NOT NULL AND (a.amar_putusan_dok IS NULL OR a.amar_putusan_dok = '')",
  },
  "anonimisasi-belum": {
    kelompok: "berkas",
    label: "Anonimisasi belum ada",
    nada: "awas",
    judul: "Sudah diputus tetapi amar_putusan_anonimisasi_dok kosong.",
    tabel: "perkara_putusan a",
    syarat:
      "a.tanggal_putusan IS NOT NULL AND (a.amar_putusan_anonimisasi_dok IS NULL OR a.amar_putusan_anonimisasi_dok = '')",
  },
  // ==========================================================================
  // DUA TAG AKTA CERAI: JUDULNYA MENJANJIKAN "SUDAH TERBIT", SYARATNYA TIDAK
  // ==========================================================================
  //
  // Sampai 25 September 2026 keduanya hanya memeriksa kolom penyerahan dan
  // TIDAK PERNAH memeriksa tgl_akta_cerai. Terukur: perkara_akta_cerai memuat
  // 4.607 baris, 80 di antaranya tgl_akta_cerai-nya NULL - aktanya belum
  // pernah diterbitkan - dan ke-80 itu ikut terhitung pada KEDUA tag.
  //
  // Sesudah tgl_akta_cerai IS NOT NULL ditambahkan: 1.530 menjadi 1.450 dan
  // 115 menjadi 35, keduanya berkurang tepat 80. Yang 80 itu kini punya tagnya
  // sendiri di kelompok Mutu data, jadi tidak hilang - hanya berhenti
  // dilaporkan sebagai akta yang sudah terbit tetapi belum diambil.
  "akta-belum-diambil": {
    kelompok: "berkas",
    label: "Akta cerai belum diambil pihak I",
    nada: "awas",
    judul:
      "Akta cerai SUDAH terbit (tgl_akta_cerai terisi) tetapi tgl_penyerahan_akta_cerai masih kosong. Terukur 1.450; tanpa syarat 'sudah terbit' angkanya 1.530, dan 80 selisihnya adalah akta yang belum pernah diterbitkan.",
    tabel: "perkara_akta_cerai a",
    syarat: "a.tgl_akta_cerai IS NOT NULL AND a.tgl_penyerahan_akta_cerai IS NULL",
  },
  "akta-belum-diambil-pihak2": {
    kelompok: "berkas",
    label: "Akta cerai belum diterima pihak II",
    nada: "awas",
    judul:
      "Akta cerai sudah terbit tetapi tgl_penyerahan_akta_cerai_pihak2 masih kosong. Terukur 3.370 - dua kali lipat lebih banyak daripada pihak pertama (1.450), dan kolom ini sebelumnya tidak dibaca tag mana pun sehingga dua pertiga pekerjaan penyerahan akta tidak terlihat sama sekali.",
    tabel: "perkara_akta_cerai a",
    syarat: "a.tgl_akta_cerai IS NOT NULL AND a.tgl_penyerahan_akta_cerai_pihak2 IS NULL",
  },
  "akta-tanpa-berkas": {
    kelompok: "berkas",
    label: "Akta cerai tanpa berkas",
    nada: "netral",
    judul:
      "Akta cerai sudah terbit tetapi akta_cerai_dok kosong. Terukur 35; tanpa syarat 'sudah terbit' angkanya 115, dan 80 selisihnya belum punya akta untuk diunggah.",
    tabel: "perkara_akta_cerai a",
    syarat: "a.tgl_akta_cerai IS NOT NULL AND (a.akta_cerai_dok IS NULL OR a.akta_cerai_dok = '')",
  },
  "bht-tanpa-akta": {
    kelompok: "berkas",
    label: "Cerai sudah BHT, akta belum terbit",
    nada: "bahaya",
    judul:
      "Perkara cerai gugat atau cerai talak yang putusannya sudah berkekuatan hukum tetap, tetapi belum ada akta cerai bertanggal. Terukur 753 - tunggakan produk pengadilan terbesar yang dapat diukur di salinan ini, dan dua tag akta lainnya justru hanya melihat yang aktanya SUDAH terbit.",
    tabel: REGISTER,
    syarat: "pu.tglBht IS NOT NULL AND a.jenis_perkara_id IN (346, 347) AND ak.perkara_id IS NULL",
  },
  "bht-tanpa-ikrar": {
    kelompok: "berkas",
    label: "Cerai talak BHT, ikrar belum",
    nada: "bahaya",
    judul:
      "Cerai talak yang sudah berkekuatan hukum tetap tetapi ikrar talaknya belum dilaksanakan - dan inilah yang menahan akta cerai. Terukur 219, sedangkan tag Ikrar ditetapkan belum dilaksanakan hanya menemukan 117 yang barisnya sudah ada.",
    tabel: REGISTER,
    syarat: "pu.tglBht IS NOT NULL AND a.jenis_perkara_id = 346 AND ik.perkara_id IS NULL",
  },
  "sudah-diarsipkan": {
    kelompok: "berkas",
    label: "Sudah masuk arsip",
    nada: "aman",
    judul: "Ada baris arsip untuk nomor perkara ini. Terukur 4.277 dari 4.876 baris arsip.",
    tabel: REGISTER,
    syarat: "ar.nomor IS NOT NULL",
    lewatNomor: true,
  },
  "putus-tanpa-arsip": {
    kelompok: "berkas",
    label: "Sudah putus, belum masuk arsip",
    nada: "awas",
    judul:
      "Sudah ada tanggal putusan tetapi belum ada baris arsip untuk nomornya. Terukur 5.716 - lebih dari separuh register, dan tidak ada satu pun tag yang menanyakannya sebelum 25 September 2026.",
    tabel: REGISTER,
    syarat: "pu.tglPutus IS NOT NULL AND ar.nomor IS NULL",
    lewatNomor: true,
  },

  // --- e-Court -------------------------------------------------------------
  ecourt: {
    kelompok: "ecourt",
    label: "Masuk lewat e-Court",
    nada: "netral",
    judul: "Ada baris perkara_efiling_id.",
    tabel: "perkara_efiling_id a",
    syarat: "1 = 1",
  },
  "bukan-ecourt": {
    kelompok: "ecourt",
    label: "Didaftarkan di meja",
    nada: "netral",
    judul: "Tidak ada baris perkara_efiling_id.",
    tabel: "perkara_efiling_id a",
    syarat: "1 = 1",
    balik: true,
  },

  // --- keuangan ------------------------------------------------------------
  prodeo: {
    kelompok: "keuangan",
    label: "Prodeo",
    nada: "netral",
    judul:
      "Kolom prodeo bernilai '1'. Bukan 'Y': terukur 118 perkara bernilai '1' dan 10.002 bernilai '0'.",
    tabel: REGISTER,
    syarat: "a.prodeo = '1'",
  },
  "sisa-panjar": {
    kelompok: "keuangan",
    label: "Sisa panjar belum nol",
    nada: "awas",
    judul:
      "Penerimaan panjar masih lebih besar daripada pengeluarannya. Terukur 135 perkara. jenis_transaksi bernilai -1 dan 1 pada basis data ini (89.515 baris -1, 10.768 baris 1), bukan 1 dan 2; yang 1 adalah baris Panjar dan yang -1 pengeluaran, jadi sisanya SUM(jenis_transaksi * jumlah).",
    tabel: REGISTER,
    syarat: "bi.sisa > 0",
  },
  "sisa-panjar-putus": {
    kelompok: "keuangan",
    label: "Sisa panjar, perkara sudah putus",
    nada: "bahaya",
    judul:
      "Sisa panjar masih tertahan padahal perkaranya sudah diputus - uang yang seharusnya dikembalikan kepada pihak. Terukur 21 dari 135.",
    tabel: REGISTER,
    syarat: "bi.sisa > 0 AND pu.tglPutus IS NOT NULL",
  },

  // --- para pihak ----------------------------------------------------------
  "ada-anak": {
    kelompok: "pihak",
    label: "Ada anak",
    nada: "netral",
    judul: "Ada baris perkara_anak_pihak.",
    tabel: "perkara_anak_pihak a",
    syarat: "1 = 1",
  },
  "ada-kuasa": {
    kelompok: "pihak",
    label: "Ada kuasa hukum",
    nada: "netral",
    judul: "Kolom pengacara_pihak1 atau pengacara_pihak2 terisi. Terukur 464.",
    tabel: REGISTER,
    syarat:
      "(a.pengacara_pihak1 IS NOT NULL AND a.pengacara_pihak1 <> '') OR (a.pengacara_pihak2 IS NOT NULL AND a.pengacara_pihak2 <> '')",
  },

  // --- majelis dan petugas -------------------------------------------------
  "tanpa-hakim": {
    kelompok: "aparat",
    label: "Majelis belum ditetapkan",
    nada: "bahaya",
    judul: "Belum ada baris perkara_hakim_pn. Terukur 268.",
    tabel: "perkara_hakim_pn a",
    syarat: "1 = 1",
    balik: true,
  },
  "tanpa-pp": {
    kelompok: "aparat",
    label: "PP belum ditunjuk",
    nada: "bahaya",
    judul: "Belum ada baris perkara_panitera_pn. Terukur 271.",
    tabel: "perkara_panitera_pn a",
    syarat: "1 = 1",
    balik: true,
  },
  "tanpa-js": {
    kelompok: "aparat",
    label: "Juru sita belum ditunjuk",
    nada: "awas",
    judul: "Belum ada baris perkara_jurusita. Terukur 24.",
    tabel: "perkara_jurusita a",
    syarat: "1 = 1",
    balik: true,
  },
  "smart-majelis": {
    kelompok: "aparat",
    label: "Ditunjuk lewat Smart Majelis",
    nada: "netral",
    judul:
      "Ada baris perkara_smartmajelis - majelisnya ditunjuk mesin, bukan diketik. Terukur 915 perkara dari 915 baris.",
    tabel: "perkara_smartmajelis a",
    syarat: "1 = 1",
  },

  // --- mutu data -----------------------------------------------------------
  "sandi-relaas-asing": {
    kelompok: "mutu",
    label: "Sandi relaas tak dikenal",
    nada: "awas",
    judul:
      "ket_temu kosong atau berisi huruf yang TIDAK ADA pada komentar kolom SIPP. Komentar itu berbunyi 'Y / T, E=Elektonik, S=surat tercatat, W=Web/Papan Pengumuman Pengadilan, P=papan pengumuman pemda, M=media massa cetak/elektornik, R=radio' - tidak ada N di dalamnya. Terukur 22: 12 perkara sandinya NULL dan 10 perkara bersandi N (14 baris), dan N itulah yang dulu dimaafkan sehingga tag ini hanya menemukan 12.",
    tabel: "perkara_pelaksanaan_relaas a",
    syarat: "a.ket_temu IS NULL OR a.ket_temu NOT IN ('Y','T','S','E','R','M','W','P')",
  },
  "cabut-tanpa-tanggal": {
    kelompok: "mutu",
    label: "Dicabut tanpa tanggal cabut",
    nada: "awas",
    judul:
      "Status putusan Dicabut tetapi tanggal_cabut kosong - 488 dari 535 perkara terukur.",
    tabel: PUTUSAN_BERNAMA,
    syarat: "s.nama = 'Dicabut' AND a.tanggal_cabut IS NULL",
  },
  "akta-belum-terbit": {
    kelompok: "mutu",
    label: "Baris akta cerai tanpa tanggal",
    nada: "awas",
    judul:
      "Sudah ada baris perkara_akta_cerai tetapi tgl_akta_cerai masih kosong - aktanya belum pernah diterbitkan. Terukur 80 dari 4.607 baris. Inilah 80 perkara yang sampai 25 September 2026 dilaporkan sebagai akta yang sudah terbit tetapi belum diambil.",
    tabel: "perkara_akta_cerai a",
    syarat: "a.tgl_akta_cerai IS NULL",
  },
  "mutu-jenis-berselisih": {
    kelompok: "mutu",
    label: "Nama jenis perkara berselisih",
    nada: "awas",
    judul:
      "jenis_perkara_nama pada baris perkara berbeda dari nama jenis itu pada tabel rujukan jenis_perkara - salinan nama yang basi. Terukur 89, seluruhnya id 360 yang tertulis 'Istbat Nikah' padahal rujukannya 'Pengesahan Perkawinan/Istbat Nikah'. Inilah sebab saringan jenis perkara berupa teks tidak pernah dapat menemukan semuanya.",
    tabel: REGISTER,
    syarat:
      "a.jenis_perkara_nama <> (SELECT j.nama FROM jenis_perkara j WHERE j.id = a.jenis_perkara_id)",
  },
});

/**
 * Kolom tanggal pada tabel perkara untuk tiap dasar lingkup.
 *
 * TERTUTUP: yang dikirim peramban hanya kuncinya, dan kunci asing jatuh ke
 * "daftar". Tidak ada nama kolom yang datang dari luar.
 *
 *   kolom     bentuk BERKORELASI, dipakai cariPerkara lewat syaratLingkup()
 *             sebagai potongan WHERE atas alias p. Jangan diubah bentuknya:
 *             rute meneruskannya ke layar Status Perkara.
 *   himpunan  bentuk TANPA KORELASI, dipakai HANYA di berkas ini untuk
 *             menjemput daftar perkara_id lingkup sekali. null berarti
 *             tanggalnya ada di tabel perkara sendiri dan berindeks.
 *
 * relaas dan ikrar baru: keduanya menggantikan medan `tanggal` per tag yang
 * dibuang. Dengan begini "relaas yang dilaksanakan triwulan ini" menjadi
 * pilihan yang TERTULIS di layar, bukan perilaku diam-diam yang berbeda dari
 * judul panelnya sendiri.
 */
const DASAR_TANGGAL = Object.freeze({
  daftar: { label: "Didaftarkan", kolom: "p.tanggal_pendaftaran", himpunan: null },
  putus: {
    label: "Diputus",
    kolom: "(SELECT MAX(z.tanggal_putusan) FROM perkara_putusan z WHERE z.perkara_id = p.perkara_id)",
    himpunan: { dari: "perkara_putusan z", kolom: "MAX(z.tanggal_putusan)" },
  },
  bht: {
    label: "Berkekuatan hukum tetap",
    kolom: "(SELECT MAX(z.tanggal_bht) FROM perkara_putusan z WHERE z.perkara_id = p.perkara_id)",
    himpunan: { dari: "perkara_putusan z", kolom: "MAX(z.tanggal_bht)" },
  },
  sidang: {
    label: "Bersidang",
    kolom:
      "(SELECT MAX(z.tanggal_sidang) FROM perkara_jadwal_sidang z WHERE z.perkara_id = p.perkara_id)",
    himpunan: { dari: "perkara_jadwal_sidang z", kolom: "MAX(z.tanggal_sidang)" },
  },
  akta: {
    label: "Akta cerai terbit",
    kolom:
      "(SELECT MAX(z.tgl_akta_cerai) FROM perkara_akta_cerai z WHERE z.perkara_id = p.perkara_id)",
    himpunan: { dari: "perkara_akta_cerai z", kolom: "MAX(z.tgl_akta_cerai)" },
  },
  relaas: {
    label: "Relaas dilaksanakan",
    kolom:
      "(SELECT MAX(z.tanggal_relaas) FROM perkara_pelaksanaan_relaas z WHERE z.perkara_id = p.perkara_id)",
    himpunan: { dari: "perkara_pelaksanaan_relaas z", kolom: "MAX(z.tanggal_relaas)" },
  },
  ikrar: {
    label: "Ikrar talak dilaksanakan",
    kolom:
      "(SELECT MAX(z.tgl_ikrar_talak) FROM perkara_ikrar_talak z WHERE z.perkara_id = p.perkara_id)",
    himpunan: { dari: "perkara_ikrar_talak z", kolom: "MAX(z.tgl_ikrar_talak)" },
  },
});

/**
 * Rentang tanggal lingkup.
 *
 * "hari" dan "kemarin" tidak ada pada rentangPeriode milik peta perkara -
 * ditambahkan di sini supaya berkas itu tidak perlu ikut berubah.
 */
function rentang(periode, acuan, dari, sampai) {
  const p = String(periode || "total");
  // "Seluruhnya" TIDAK memakai rentang sentinel 1900-2999 seperti peta
  // perkara: rentang apa pun memaksa daftar perkara_id lingkup dijemput, dan
  // lima dari tujuh dasar tanggal harus mengagregasi tabel anak untuk itu.
  // Kosong berarti tidak ada saringan sama sekali.
  if (p === "total") return { dari: "", sampai: "" };
  if (p === "hari" || p === "kemarin") {
    const acuanSah = /^\d{4}-\d{2}-\d{2}$/.test(String(acuan || ""));
    const d = acuanSah ? new Date(`${acuan}T00:00:00`) : new Date();
    if (p === "kemarin") d.setDate(d.getDate() - 1);
    const dua = (n) => String(n).padStart(2, "0");
    const iso = `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())}`;
    return { dari: iso, sampai: iso };
  }
  return petaPerkaraService.rentangPeriode(p, acuan, dari, sampai);
}

/** Pilihan dasar tanggal yang sah, atau pendaftaran bila kuncinya asing. */
function pilihDasar(dasar) {
  return DASAR_TANGGAL[String(dasar || "")] || DASAR_TANGGAL.daftar;
}

/** Kolom lingkup yang sah, atau kolom pendaftaran bila kuncinya asing. */
function kolomDasar(dasar) {
  return pilihDasar(dasar).kolom;
}

/**
 * Potongan WHERE lingkup atas tabel perkara beralias p.
 *
 * Bentuk BERKORELASI, dan itu disengaja: yang memakainya cariPerkara, yang
 * memang menyaring baris perkara satu per satu. Yang TIDAK memakainya lagi
 * hitungSemua dan idPerkaraTag di bawah - keduanya memakai idLingkup().
 */
function syaratLingkup(dasar, dari, sampai) {
  if (!dari && !sampai) return { sql: "", nilai: [] };
  const kolom = kolomDasar(dasar);
  const bagian = [];
  const nilai = [];
  if (dari) {
    bagian.push(`${kolom} >= ?`);
    nilai.push(dari);
  }
  if (sampai) {
    bagian.push(`${kolom} <= ?`);
    nilai.push(sampai);
  }
  return { sql: bagian.join(" AND "), nilai };
}

/**
 * ============================================================================
 * DAFTAR perkara_id YANG MASUK LINGKUP - DIJEMPUT SEKALI
 * ============================================================================
 *
 * null berarti "seluruh register, tanpa saringan" - tidak ada satu pun
 * potongan WHERE yang dipasang, dan itu bentuk yang paling murah.
 * Array kosong berarti "lingkupnya memang kosong", yang berbeda artinya:
 * seluruh tag bernilai nol tanpa satu kueri pun dijalankan.
 *
 * Selalu lewat JOIN ke tabel perkara, bukan langsung dari tabel anaknya.
 * Sebabnya penyebut: perkaraLingkup menjadi penyebut seluruh tag ketiadaan,
 * dan id yang tidak ada di register akan menggelembungkannya. perkara_biaya
 * membuktikan itu bukan kekhawatiran kosong - 10.122 perkara_id di sana,
 * 10.120 di register.
 *
 * Terukur: pendaftaran setahun 96 ms, putus triwulan 144 ms. Bentuk lama yang
 * berkorelasi memakan 1.143 ms untuk pertanyaan yang sama - dan dibayar
 * sembilan belas kali, sekali di dalam tiap kueri tag.
 */
async function idLingkup(dasar, dari, sampai) {
  if (!dari && !sampai) return null;
  const pilih = pilihDasar(dasar);
  const nilai = [];
  let sql;
  if (pilih.himpunan) {
    const bagian = [];
    if (dari) {
      bagian.push(`${pilih.himpunan.kolom} >= ?`);
      nilai.push(dari);
    }
    if (sampai) {
      bagian.push(`${pilih.himpunan.kolom} <= ?`);
      nilai.push(sampai);
    }
    sql = `SELECT p.perkara_id AS id
             FROM perkara p
             JOIN (SELECT z.perkara_id
                     FROM ${pilih.himpunan.dari}
                    GROUP BY z.perkara_id
                   HAVING ${bagian.join(" AND ")}) w ON w.perkara_id = p.perkara_id`;
  } else {
    const bagian = [];
    if (dari) {
      bagian.push("p.tanggal_pendaftaran >= ?");
      nilai.push(dari);
    }
    if (sampai) {
      bagian.push("p.tanggal_pendaftaran <= ?");
      nilai.push(sampai);
    }
    sql = `SELECT p.perkara_id AS id FROM perkara p WHERE ${bagian.join(" AND ")}`;
  }
  const baris = await kueriTag(sql, nilai, `lingkup tanggal "${pilih.label}"`);
  return baris.map((x) => Number(x.id)).filter((x) => Number.isInteger(x) && x > 0);
}

/**
 * Daftar id sebagai teks untuk IN (...).
 *
 * Tiap angka sudah lewat Number.isInteger di idLingkup, jadi merangkainya ke
 * teks SQL tidak dapat menyelundupkan apa pun. Dan ia MURAH walau panjang:
 * terukur 100 ms untuk 10.120 id, sama dengan tanpa saringan.
 */
function isianId(daftar) {
  return daftar.join(",");
}

/** Sambungan turunan yang disebut satu syarat, urut sebagaimana didaftarkan. */
function sambunganDipakai(daftarSyarat) {
  const teks = daftarSyarat.join(" ");
  return ALIAS_SAMBUNGAN.filter((nama) => new RegExp(`\\b${nama}\\.`).test(teks));
}

/** Satu baris LEFT JOIN turunan, lingkupnya ikut didorong masuk. */
function sambunganSql(nama, batasId) {
  const s = SAMBUNGAN[nama];
  const bagian = [];
  if (s.syarat) bagian.push(s.syarat);
  if (batasId && !s.tanpaLingkup) bagian.push(`perkara_id IN (${batasId})`);
  const where = bagian.length ? ` WHERE ${bagian.join(" AND ")}` : "";
  const kelompok = s.kelompok ? ` ${s.kelompok}` : "";
  return `LEFT JOIN (SELECT ${s.pilih} FROM ${s.dari}${where}${kelompok}) ${nama} ON ${s.pada}`;
}

/**
 * Jumlah tiap tag dalam satu lingkup.
 *
 * Satu kueri untuk seluruh tag yang bersumber pada tabel perkara (pemindaian
 * register), lalu satu kueri per TABEL ANAK. Terukur atas seluruh register:
 * register 3.669 ms untuk 47 tag, lalu delapan belas kueri tabel anak 1.801 ms
 * untuk 41 tag - jumlahnya 5,5 detik untuk sembilan belas kueri, lawan 24,9
 * detik dingin dan 29,2 detik panas pada bentuk sebelumnya.
 *
 * Angkanya dihitung atas LINGKUP RENTANG WAKTU saja, tidak pernah atas hasil
 * yang sudah tersaring tag lain. Aturan yang sama sudah berlaku pada kotak
 * keadaan Jadwal Sidang: kalau angkanya ikut menyusut, menyalakan satu tag
 * membuat tag lain tampak nol dan mustahil dilepas kembali.
 */
async function hitungSemua({ dasar = "daftar", periode = "total", acuan = "", dari = "", sampai = "" } = {}) {
  const lingkup = rentang(periode, acuan, dari, sampai);
  const batas = await idLingkup(dasar, lingkup.dari, lingkup.sampai);

  // Lingkup yang memang kosong: seluruh tag nol, tanpa satu kueri pun. Nol di
  // sini BERARTI nol - bukan kueri yang gagal lalu ditelan.
  if (batas && batas.length === 0) {
    const nol = {};
    for (const kunci of Object.keys(TAG)) nol[kunci] = 0;
    return {
      jumlah: nol,
      lingkup: { dari: lingkup.dari || "", sampai: lingkup.sampai || "", perkara: 0 },
    };
  }

  const batasId = batas ? isianId(batas) : "";
  const jumlah = {};

  // ------------------------------------------------------------------------
  // 1. PEMINDAIAN REGISTER - seluruh tag yang bersumber pada tabel perkara
  // ------------------------------------------------------------------------
  //
  // Tag yang bersumber dari tabel perkara SENDIRI tidak di-JOIN; aliasnya
  // karena itu p, bukan a. Tanpa penggantian ini seluruh tag tahapan, jenis,
  // prodeo, dan kuasa gagal dengan ERROR 1054 - dan pada bentuk sebelumnya
  // .catch() menelannya menjadi nol diam-diam.
  const tagRegister = Object.entries(TAG).filter(([, tag]) => tag.tabel === REGISTER);
  const syaratRegister = tagRegister.map(([, tag]) => tag.syarat.replace(/\ba\./g, "p."));
  const sambungRegister = sambunganDipakai(syaratRegister)
    .map((nama) => sambunganSql(nama, batasId))
    .join("\n         ");
  const pilihRegister = syaratRegister
    .map((syarat, i) => `SUM(${syarat}) AS t${i}`)
    .join(",\n           ");
  const [isiRegister = {}] = await kueriTag(
    `SELECT COUNT(*) AS lingkup${pilihRegister ? `,\n           ${pilihRegister}` : ""}
       FROM perkara p
         ${sambungRegister}
      ${batasId ? `WHERE p.perkara_id IN (${batasId})` : ""}`,
    [],
    "pemindaian register (tabel perkara)",
    tagRegister.map(([kunci]) => kunci)
  );
  // Penyebut seluruh tag ketiadaan datang dari kueri yang sama, bukan dari
  // COUNT(*) tersendiri: satu kueri lebih sedikit, dan angkanya mustahil
  // berselisih dengan angka tag di sebelahnya.
  const perkaraLingkup = Number(isiRegister.lingkup) || 0;
  tagRegister.forEach(([kunci], i) => {
    jumlah[kunci] = Number(isiRegister[`t${i}`]) || 0;
  });

  // ------------------------------------------------------------------------
  // 2. SATU KUERI PER TABEL ANAK, dihitung DARI tabel anaknya
  // ------------------------------------------------------------------------
  const perTabel = new Map();
  for (const [kunci, tag] of Object.entries(TAG)) {
    if (tag.tabel === REGISTER) continue;
    const daftar = perTabel.get(tag.tabel) || [];
    daftar.push([kunci, tag]);
    perTabel.set(tag.tabel, daftar);
  }

  for (const [tabel, daftar] of perTabel) {
    const pilih = daftar
      .map(([, tag], i) => `COUNT(DISTINCT CASE WHEN ${tag.syarat} THEN a.perkara_id END) AS t${i}`)
      .join(",\n           ");
    const [isi = {}] = await kueriTag(
      `SELECT ${pilih}
         FROM ${tabel}
        ${batasId ? `WHERE a.perkara_id IN (${batasId})` : ""}`,
      [],
      `tabel ${tabel.split(" ")[0]}`,
      daftar.map(([kunci]) => kunci)
    );
    daftar.forEach(([kunci, tag], i) => {
      const cocok = Number(isi[`t${i}`]) || 0;
      jumlah[kunci] = tag.balik ? Math.max(0, perkaraLingkup - cocok) : cocok;
    });
  }

  return {
    jumlah,
    lingkup: { dari: lingkup.dari || "", sampai: lingkup.sampai || "", perkara: perkaraLingkup },
  };
}

/**
 * ============================================================================
 * DAFTAR perkara_id YANG MEMENUHI SATU TAG
 * ============================================================================
 *
 * Dijemput TERPISAH, lalu dikirim ke cariPerkara sebagai daftar id. Terukur
 * atas tag ghaib (67 perkara): syaratnya ditempel sebagai EXISTS ke dalam
 * kueri cariPerkara 2,98 detik; daftar idnya dijemput dulu lalu dipakai
 * sebagai IN (67 id) 0,44 detik.
 *
 * Bentuk EXISTS BERKORELASI yang dipakai sampai 25 September 2026 adalah
 * bentuk yang komentar kepala berkas ini sendiri sebut tidak dapat dipakai.
 * Terukur satu per satu, lama lawan baru:
 *
 *   sudah-diarsipkan   5.987 ms  ->     71 ms   digerakkan dari tabel arsip
 *   ghaib              2.304 ms  ->     89 ms   id diambil dari tabel anak
 *   verstek            1.600 ms  ->     61 ms   id diambil dari tabel anak
 *   tanpa-relaas       2.008 ms  ->  2.588 ms   tetap harus memindai perkara
 *
 * Tiga bentuk, satu definisi tag - syarat yang sama yang dipakai hitungSemua:
 *
 *   tag tabel anak    id-nya ADA di tabel anak itu, jadi tabel perkara tidak
 *                     perlu disentuh sama sekali
 *   tag ketiadaan     harus memindai perkara, sebab yang dicari justru yang
 *                     TIDAK ada di tabel anak. Turunan dipakai sebagai
 *                     sambungan kiri, bukan NOT EXISTS berkorelasi
 *   tag register      memindai perkara dengan sambungan turunan yang HANYA
 *                     disebut syarat tag itu - 58 ms untuk tag jenis perkara
 *                     yang kolomnya berindeks, 1,9-2,5 detik untuk kolom yang
 *                     tidak (tahapan_terakhir_text, prodeo)
 *
 * ============================================================================
 * BATAS_ID: PAGAR PENGAMAN, BUKAN PENGHEMAT
 * ============================================================================
 *
 * Nilainya 3.000 sampai 25 September 2026, dengan alasan yang tertulis di sini
 * bahwa "IN sepanjang itu lebih lambat daripada memindai". Alasan itu DIUKUR
 * dan ternyata SALAH - dan sementara ia berlaku, pagunya merusak jawaban:
 *
 *   cariPerkara dengan   500 id  ->  131 ms
 *   cariPerkara dengan 3.000 id  ->  847 ms
 *   cariPerkara dengan 5.000 id  ->  180 ms
 *   cariPerkara dengan 9.993 id  ->   88 ms   <- TERMURAH dari semuanya
 *
 * Daftar yang hampir sepanjang register justru paling murah: perencana kueri
 * berhenti mencari satu per satu dan memindai sekali. Yang mahal justru
 * pertengahannya.
 *
 * Dan inilah kerusakannya. Irisan DUA tag dihitung dari daftar idnya, jadi
 * kedua daftar yang terpotong menghasilkan irisan yang terpotong DUA KALI:
 *
 *   verstek 3.000 (dari 4.113) x sudah-diarsipkan 3.000 (dari 4.277)
 *      -> irisan 1.680, sedangkan jumlah sesungguhnya 2.302
 *      -> 622 perkara hilang, 27%, dan angka itulah yang digambar layar
 *         sebagai "1.680 perkara cocok dengan tag ini"
 *
 * Sesudah pagunya dinaikkan, irisan yang sama memulangkan 2.302 - sama persis
 * dengan COUNT(*) yang dihitung langsung di SQL.
 *
 * Pagunya TIDAK dihapus, sebab ia tetap menahan larik dan teks SQL yang tidak
 * berbatas bila kelak dipakai satker yang registernya ratusan ribu perkara.
 * 20.000 dipilih supaya register satker ini (10.120 perkara) tidak mungkin
 * terpotong walau seluruh perkaranya cocok - dan bila kelak ia benar-benar
 * mentok, rute MENYEBUTKANNYA ke layar alih-alih memotong dalam diam.
 */
const BATAS_ID = 20000;

async function idPerkaraTag(kunci, { dasar = "daftar", periode = "total", acuan = "", dari = "", sampai = "" } = {}) {
  const tag = TAG[String(kunci || "")];
  if (!tag) return [];

  const lingkup = rentang(periode, acuan, dari, sampai);
  const batas = await idLingkup(dasar, lingkup.dari, lingkup.sampai);
  if (batas && batas.length === 0) return [];
  const batasId = batas ? isianId(batas) : "";

  let sql;
  if (tag.tabel === REGISTER) {
    const syarat = tag.syarat.replace(/\ba\./g, "p.");
    const sambung = sambunganDipakai([syarat])
      .map((nama) => sambunganSql(nama, batasId))
      .join("\n         ");
    sql = `SELECT p.perkara_id AS id
             FROM perkara p
               ${sambung}
            WHERE (${syarat})${batasId ? ` AND p.perkara_id IN (${batasId})` : ""}
            ORDER BY p.perkara_id DESC
            LIMIT ${BATAS_ID}`;
  } else if (tag.balik) {
    sql = `SELECT p.perkara_id AS id
             FROM perkara p
             LEFT JOIN (SELECT DISTINCT a.perkara_id
                          FROM ${tag.tabel}
                         WHERE ${tag.syarat}) x ON x.perkara_id = p.perkara_id
            WHERE x.perkara_id IS NULL${batasId ? ` AND p.perkara_id IN (${batasId})` : ""}
            ORDER BY p.perkara_id DESC
            LIMIT ${BATAS_ID}`;
  } else {
    sql = `SELECT DISTINCT a.perkara_id AS id
             FROM ${tag.tabel}
            WHERE (${tag.syarat})${batasId ? ` AND a.perkara_id IN (${batasId})` : ""}
            ORDER BY a.perkara_id DESC
            LIMIT ${BATAS_ID}`;
  }

  // TIDAK ada .catch di sini. Daftar kosong berarti "tidak ada yang cocok",
  // dan rute memperlakukannya sebagai hasil nol baris; kalau kegagalan kueri
  // ikut memulangkan kosong, layar akan menyatakan tidak ada perkara yang
  // cocok padahal yang terjadi kolomnya tidak terbaca.
  const baris = await kueriTag(sql, [], `daftar perkara untuk tag "${kunci}"`, [String(kunci)]);
  return baris.map((x) => Number(x.id)).filter(Boolean);
}

module.exports = {
  KELOMPOK_TAG,
  TAG,
  DASAR_TANGGAL,
  SAMBUNGAN,
  BATAS_ID,
  hitungSemua,
  idPerkaraTag,
  idLingkup,
  rentang,
  syaratLingkup,
};
