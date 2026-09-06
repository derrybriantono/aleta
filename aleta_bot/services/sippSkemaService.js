"use strict";

/**
 * Mengenali kolom yang benar-benar ADA pada SIPP setempat.
 *
 * ============================================================================
 * NAMA KOLOM SIPP TIDAK SAMA DI SEMUA SATKER
 * ============================================================================
 *
 * SIPP berganti versi, dan tiap versi menambah atau mengganti nama kolom.
 * Menulis satu nama kolom pasti ke dalam kode berarti kuerinya akan gagal di
 * pengadilan yang versinya berbeda - dan gagalnya baru ketahuan di server,
 * setelah dipasang.
 *
 * Karena itu kolom TIDAK ditebak. Layanan ini membaca information_schema satu
 * kali, lalu memilih nama yang memang ada dari daftar calon. Yang tidak ketemu
 * dilaporkan apa adanya sebagai "belum tersambung" - bukan disamarkan menjadi
 * nilai nol yang akan menuduh pengadilan lalai.
 *
 * ============================================================================
 * DIBACA SEKALI, DISIMPAN DALAM MEMORI
 * ============================================================================
 *
 * Skema tidak berubah saat aplikasi berjalan. Membacanya ulang tiap kueri
 * hanya menambah beban tanpa menambah kebenaran. Bila SIPP diperbarui,
 * bot dinyalakan ulang - dan itu memang yang selalu dilakukan.
 *
 * ============================================================================
 * NAMA KOLOM TIDAK PERNAH DATANG DARI LUAR
 * ============================================================================
 *
 * Nama kolom yang dikembalikan layanan ini nanti disambung ke dalam teks
 * kueri - tidak ada cara lain menulis SELECT. Yang membuatnya aman: calonnya
 * ditulis di dalam kode, dan yang dikembalikan HANYA nama yang cocok persis
 * dengan isi information_schema. Tidak ada satu pun jalan bagi nama dari
 * peramban untuk sampai ke sini.
 */

const db = require("../db_config");

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(Array.isArray(rows) ? rows : []);
    });
  });
}

/** Tabel SIPP yang kolomnya perlu dikenali. */
const TABEL = [
  "perkara",
  "v_perkara",
  "perkara_penetapan",
  "perkara_dokumen_penetapan",
  "perkara_pihak1",
  "perkara_pihak2",
  "perkara_pihak3",
  "perkara_pihak4",
  "perkara_pihak5",
  "pihak",
  "perkara_hakim_pn",
  "perkara_panitera_pn",
  "perkara_jurusita",
  "perkara_jadwal_sidang",
  "perkara_pelaksanaan_relaas",
  "perkara_putusan",
  "perkara_dokumen",
  "perkara_biaya",
  "perkara_akta_cerai",
  "perkara_banding",
  "perkara_kasasi",
  "perkara_pk",
  // Verzet - perlawanan terhadap putusan verstek. Tingkat pertama upaya
  // hukum, dan selama ini tidak dibaca sama sekali.
  "perkara_verzet",
  "perkara_pemberitahuan",
  "perkara_mediasi",
  "perkara_data_dukung_mediasi",
  "arsip",
  "perkara_arsip",
  "perkara_penilaian_relaas",
  "perkara_jadwal_mediasi",
  "v_mediasi",
  "v_durasi_mediasi",
  "v_mediator",
  "dirput_dokumen",
  "perkara_efiling_id",
  "sys_audittrail",
  "sys_users",
  "perkara_proses",
  "delegasi_masuk",
  "delegasi_keluar",
  "delegasi_proses_keluar",
  "delegasi_file_keluar",
  "perkara_mediator",
  "perkara_ikrar_talak",
  "status_putusan",
  "sumber_hukum",
  "perkara_delegasi",
  "perkara_keterangan_saksi",

  // ==========================================================================
  // PENUNJUKAN: PMH, PPP, PJS, PHS
  // ==========================================================================
  //
  // Sebelas tabel di bawah dipakai menyusun USULAN penunjukan - siapa
  // majelisnya, siapa panitera penggantinya, juru sita siapa gilirannya, dan
  // hari sidang pertamanya kapan.
  //
  // ref_sk_majelis_tetap dan ref_majelis_tetap adalah SK susunan majelis yang
  // SUDAH TERSIMPAN DI SIPP. Sempat direncanakan menyalinnya ke tabel ALETA
  // sendiri, sampai ketahuan SIPP memang menyimpannya - dan menyalin data yang
  // sudah ada hanya melahirkan dua kebenaran yang lambat laun berselisih.
  "hakim_pn",
  "user_hakim",
  "jabatan_hakim",
  "panitera_pn",
  "user_panitera",
  "jurusita",
  "user_jurusita",
  "perkara_smartmajelis",
  "ref_majelis_tetap",
  "ref_sk_majelis_tetap",
  "ref_kompetensi_majelis",
  "perkara_penetapan_hari_sidang",
];

/** Peta tabel -> Set nama kolom. Kosong sampai muat() dijalankan. */
let peta = null;
let sedangMuat = null;

async function muat() {
  if (peta) return peta;
  if (sedangMuat) return sedangMuat;

  sedangMuat = (async () => {
    const isian = TABEL.map(() => "?").join(", ");
    const rows = await runQuery(
      `SELECT TABLE_NAME AS tabel, COLUMN_NAME AS kolom
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME IN (${isian})`,
      TABEL
    );

    const hasil = {};
    for (const nama of TABEL) hasil[nama] = new Set();
    for (const row of rows) {
      const tabel = String(row.tabel || "");
      const kolom = String(row.kolom || "");
      if (!hasil[tabel]) hasil[tabel] = new Set();
      hasil[tabel].add(kolom);
    }

    peta = hasil;
    sedangMuat = null;
    return peta;
  })();

  return sedangMuat;
}

/** Membuang ingatan skema - dipakai uji, dan bila SIPP diperbarui saat jalan. */
function lupakan() {
  peta = null;
  sedangMuat = null;
}

async function tabelAda(tabel) {
  const skema = await muat();
  return Boolean(skema[tabel] && skema[tabel].size > 0);
}

async function kolomAda(tabel, kolom) {
  const skema = await muat();
  return Boolean(skema[tabel] && skema[tabel].has(kolom));
}

/**
 * Nama kolom pertama dari daftar calon yang benar-benar ada.
 *
 * @returns {Promise<string>} nama kolomnya, atau "" bila tidak satu pun ada
 */
async function pilihKolom(tabel, calon = []) {
  const skema = await muat();
  const punya = skema[tabel];
  if (!punya || punya.size === 0) return "";
  for (const nama of calon) {
    if (punya.has(nama)) return nama;
  }
  return "";
}

/**
 * Seluruh nama kolom satu tabel.
 *
 * Dipakai untuk MENJELASKAN kegagalan, bukan untuk menebak. Bila calon nama
 * tidak satu pun cocok, yang ditampilkan bukan sekadar "kolom tidak dikenali"
 * melainkan daftar kolom yang benar-benar ada di sana - sehingga nama
 * sebenarnya langsung terlihat tanpa perlu membuka Navicat atau menjalankan
 * skrip apa pun.
 */
async function kolomTabel(tabel) {
  const skema = await muat();
  const punya = skema[tabel];
  return punya ? [...punya] : [];
}
/**
 * ============================================================================
 * CALON NAMA KOLOM
 * ============================================================================
 *
 * Tiap keterangan yang diperlukan SK Penilaian SIPP disebutkan di sini beserta
 * calon nama kolomnya, diurutkan dari yang paling lazim. Yang cocok dipakai;
 * yang tidak satu pun cocok dilaporkan belum tersambung.
 *
 * Daftar ini SENGAJA panjang. Menambah calon tidak berbiaya - pemeriksaannya
 * hanya melihat Set di memori - sedangkan kurang satu calon berarti satu unsur
 * SK tidak dapat dinilai di pengadilan yang memakai nama itu.
 */
const CALON = {
  /** Tanggal perkara diinput ke SIPP, dibandingkan tanggal pendaftaran. */
  inputPendaftaran: {
    tabel: "perkara",
    calon: ["tanggal_input", "input_tanggal", "diinput_tanggal", "created_date", "created_at", "tgl_input"],
  },

  /**
   * ==========================================================================
   * TAHAPAN ADA DI perkara_penetapan, BUKAN DI perkara
   * ==========================================================================
   *
   * Nama-nama di bawah ini BUKAN tebakan: keempatnya dibaca langsung dari
   * struktur SIPP PA Donggala. Satu perkara dapat punya lebih dari satu baris
   * penetapan - penetapan kembali karena majelis berganti, misalnya - sehingga
   * yang dipakai baris TERAKHIR.
   */
  tanggalPmh: { tabel: "perkara_penetapan", calon: ["penetapan_majelis_hakim"] },
  tanggalPpp: { tabel: "perkara_penetapan", calon: ["penetapan_panitera_pengganti"] },
  tanggalPjs: { tabel: "perkara_penetapan", calon: ["penetapan_jurusita"] },
  tanggalPhs: { tabel: "perkara_penetapan", calon: ["penetapan_hari_sidang"] },
  sidangPertama: { tabel: "perkara_penetapan", calon: ["sidang_pertama"] },
  catatanPenetapan: { tabel: "perkara_penetapan", calon: ["catatan_penetapan"] },

  /**
   * ==========================================================================
   * TANGGAL PENGINPUTAN ADA DI DOKUMEN PENETAPANNYA
   * ==========================================================================
   *
   * SK menilai "tanggal input/cetak penetapan dibandingkan tanggal
   * penetapannya". Yang mencatat kapan penetapan itu diinput bukan tabel
   * penetapan, melainkan tabel dokumennya: tiap penetapan yang sudah dicetak
   * dan diunggah punya satu baris di sana, lengkap dengan diinput_tanggal.
   *
   * nama_dokumen membedakan keempatnya: PMH, PPP, PJS, PHS.
   */
  dokumenPenetapanNama: { tabel: "perkara_dokumen_penetapan", calon: ["nama_dokumen"] },
  dokumenPenetapanTanggal: { tabel: "perkara_dokumen_penetapan", calon: ["diinput_tanggal"] },
  dokumenPenetapanBerkas: { tabel: "perkara_dokumen_penetapan", calon: ["dokumen"] },
  dokumenPenetapanOleh: { tabel: "perkara_dokumen_penetapan", calon: ["diinput_oleh"] },
  /**
   * Penanda penetapan KEMBALI - '1' penetapan awal, '2' penggantinya.
   *
   * SK menilai penetapan yang PERTAMA; penggantian panitera pengganti atau
   * juru sita di tengah jalan bukan keterlambatan.
   */
  dokumenPenetapanKembali: {
    tabel: "perkara_dokumen_penetapan",
    calon: ["is_penetapan_kembali"],
  },

  /** Tanggal relaas diinput ke SIPP, dibandingkan tanggal sidangnya. */
  inputRelaas: {
    tabel: "perkara_pelaksanaan_relaas",
    calon: ["tanggal_input", "diinput_tanggal", "input_tanggal", "created_date", "tgl_input"],
  },

  /** Tanggal e-doc BAS terakhir diperbarui pada SIPP. */
  unggahBas: {
    tabel: "perkara_jadwal_sidang",
    calon: [
      "edoc_bas_last_update",
      "edoc_bas_tanggal",
      "tanggal_upload_bas",
      "bas_last_update",
      "last_update",
    ],
  },

  /**
   * ==========================================================================
   * PUBLIKASI PUTUSAN ADA DI dirput_dokumen
   * ==========================================================================
   *
   * Bukan pada perkara_putusan. Yang mencatat kapan putusan naik ke Direktori
   * Putusan adalah tabel penghubungnya sendiri: link_dirput menandai bahwa ia
   * sudah tayang, updated_date menandai kapan.
   */
  unggahPutusan: { tabel: "dirput_dokumen", calon: ["updated_date", "tanggal_upload", "created_date"] },
  linkDirput: { tabel: "dirput_dokumen", calon: ["link_dirput"] },

  /** E-Dokumen petitum - tersimpan pada tabel perkara itu sendiri. */
  petitumDok: { tabel: "perkara", calon: ["petitum_dok"] },

  /** Lama mediasi, dipotong dari waktu putus - lihat catatan pada penilaian. */
  durasiMediasi: { tabel: "v_durasi_mediasi", calon: ["durasi_mediasi"] },

  /** Tanggal pengembalian sisa panjar dan tanggal ia diinput. */
  tanggalSisaPanjar: {
    tabel: "perkara_biaya",
    calon: ["tanggal_pengembalian", "tanggal_transaksi", "tanggal", "tgl_transaksi"],
  },
  inputSisaPanjar: {
    tabel: "perkara_biaya",
    calon: ["tanggal_input", "diinput_tanggal", "input_tanggal", "created_date"],
  },

  /**
   * Tanggal data arsip diinput. Tabelnya bernama `arsip`, bukan
   * `perkara_arsip` - itulah yang dipakai notifikasi SIPP setempat.
   */
  inputArsip: {
    tabel: "arsip",
    calon: ["diinput_tanggal", "tanggal_input", "input_tanggal", "tanggal_arsip", "created_date"],
  },

  /** Pemberitahuan putusan: tanggal pelaksanaan dan tanggal inputnya. */
  tanggalPbt: {
    tabel: "perkara_pemberitahuan",
    calon: ["tanggal_pemberitahuan", "tanggal_pbt", "tanggal_pelaksanaan", "tgl_pemberitahuan"],
  },
  inputPbt: {
    tabel: "perkara_pemberitahuan",
    calon: ["tanggal_input", "diinput_tanggal", "input_tanggal", "created_date"],
  },

  /**
   * ==========================================================================
   * MEDIASI
   * ==========================================================================
   *
   * Calonnya disusun mengikuti kebiasaan penamaan SIPP yang terlihat pada
   * tabel lain: satu keterangan kerap punya tiga kolom sekaligus - _id untuk
   * kuncinya, _kode atau _nama untuk ringkasnya, dan _text untuk tulisan
   * lengkap yang ditampilkan. Yang dicari di sini yang _text atau _nama,
   * sebab itulah yang dapat dibaca manusia tanpa tabel induknya.
   */
  /**
   * ==========================================================================
   * MEDIASI TERSEBAR DI TIGA TABEL, DIHUBUNGKAN DUA KUNCI
   * ==========================================================================
   *
   *   perkara_mediasi        - satu baris per perkara; kuncinya mediasi_id
   *   perkara_mediator       - siapa mediatornya, kapan ditetapkan, nomor SK
   *   perkara_jadwal_mediasi - pertemuannya, DIHUBUNGKAN LEWAT mediasi_id
   *
   * Kunci itulah yang membuat bagian mediasi kosong sebelumnya: jadwal
   * pertemuan dicari dengan perkara_id, padahal tabelnya tidak punya kolom
   * itu - ia menunjuk ke mediasi_id.
   */
  mediasiId: { tabel: "perkara_mediasi", calon: ["mediasi_id"] },
  mediasiMediator: { tabel: "perkara_mediasi", calon: ["mediator_text", "mediator_nama"] },
  mediasiMediatorId: { tabel: "perkara_mediasi", calon: ["mediator_id"] },
  mediasiStatusMediator: { tabel: "perkara_mediasi", calon: ["status_mediator"] },
  mediasiJenis: { tabel: "perkara_mediasi", calon: ["jenis_mediasi"] },
  mediasiAda: { tabel: "perkara_mediasi", calon: ["is_mediasi"] },
  mediasiPenetapan: {
    tabel: "perkara_mediasi",
    calon: ["penetapan_penunjukan_mediator", "penetapan_penunjukan_med", "tanggal_penetapan"],
  },
  mediasiNomorSk: {
    tabel: "perkara_mediasi",
    calon: ["nomor_sk_penetapan_mediator", "nomor_sk_penetapan_med", "nomor_sk_penetapan"],
  },
  mediasiSkDok: {
    tabel: "perkara_mediasi",
    calon: ["sk_penetapan_mediator_dok", "sk_penetapan_mediator_dokumen"],
  },
  /**
   * ==========================================================================
   * MULAI DAN SELESAI PUNYA MAKNA KHUSUS
   * ==========================================================================
   *
   * Mediasi dianggap MULAI pada tanggal penetapan penunjukan mediator, dan
   * SELESAI pada tanggal laporan mediator. Itulah cara pengadilan ini
   * membacanya - dan memang masuk akal: sebelum mediator ditetapkan belum ada
   * mediasi, dan sesudah laporannya masuk mediasi itu sudah berakhir.
   *
   * dimulai_mediasi dan keputusan_mediasi tetap dibaca sebagai keterangan,
   * tetapi bukan itu yang dipakai menghitung.
   */
  mediasiHasil: { tabel: "perkara_mediasi", calon: ["hasil_mediasi"] },
  mediasiBerhasil: { tabel: "perkara_mediasi", calon: ["mediasi_berhasil"] },
  mediasiDimulai: { tabel: "perkara_mediasi", calon: ["dimulai_mediasi"] },
  mediasiKeputusan: { tabel: "perkara_mediasi", calon: ["keputusan_mediasi"] },
  mediasiLaporan: { tabel: "perkara_mediasi", calon: ["tgl_laporan_mediator"] },
  mediasiKesepakatan: { tabel: "perkara_mediasi", calon: ["isi_kesepakatan_perdamaian"] },
  mediasiTanggalKesepakatan: { tabel: "perkara_mediasi", calon: ["tgl_kesepakatan_perdamaian"] },
  mediasiCatatan: { tabel: "perkara_mediasi", calon: ["catatan_mediasi"] },
  mediasiHasilKesepakatan: { tabel: "perkara_mediasi", calon: ["hasil_kesepakatan"] },
  mediasiAktaPerdamaian: { tabel: "perkara_mediasi", calon: ["akta_perdamaian"] },
  mediasiIsiAkta: { tabel: "perkara_mediasi", calon: ["isi_akta_perdamaian"] },
  /** Mediator sebagai catatan tersendiri - lengkap dengan nomor SK-nya. */
  mediatorNama: { tabel: "perkara_mediator", calon: ["nama_mediator", "mediator_text"] },
  mediatorPenetapan: { tabel: "perkara_mediator", calon: ["tanggal_penetapan"] },
  mediatorNomorSk: { tabel: "perkara_mediator", calon: ["nomor_sk_penetapan"] },
  mediatorStatus: { tabel: "perkara_mediator", calon: ["status_mediator"] },
  mediatorAktif: { tabel: "perkara_mediator", calon: ["aktif"] },
  mediatorKeterangan: { tabel: "perkara_mediator", calon: ["keterangan"] },

  /** Jadwal pertemuan mediasi - dihubungkan lewat mediasi_id. */
  jadwalMediasiKunci: { tabel: "perkara_jadwal_mediasi", calon: ["mediasi_id"] },
  jadwalMediasiTanggal: { tabel: "perkara_jadwal_mediasi", calon: ["tanggal_mediasi", "tanggal"] },
  jadwalMediasiJam: { tabel: "perkara_jadwal_mediasi", calon: ["jam_mediasi", "jam"] },
  jadwalMediasiSampai: { tabel: "perkara_jadwal_mediasi", calon: ["sampai_jam"] },
  jadwalMediasiTempat: { tabel: "perkara_jadwal_mediasi", calon: ["tempat"] },
  jadwalMediasiHadir: { tabel: "perkara_jadwal_mediasi", calon: ["dihadiri_oleh"] },
  jadwalMediasiDitunda: { tabel: "perkara_jadwal_mediasi", calon: ["ditunda"] },
  /** Berapa kali pertemuan mediasi dilaksanakan, bila dicatat. */
  mediasiPertemuan: {
    tabel: "perkara_mediasi",
    calon: ["jumlah_pertemuan", "pertemuan", "jumlah_sidang_mediasi"],
  },

  /** Delegasi: tanggal unggah pengaju dan tanggal diterima. */
  delegasiDiunggah: {
    tabel: "perkara_delegasi",
    calon: ["tanggal_upload", "tanggal_kirim", "tanggal_permohonan", "tgl_kirim"],
  },
  delegasiDiterima: {
    tabel: "perkara_delegasi",
    calon: ["tanggal_terima", "tanggal_diterima", "tanggal_penerimaan", "tgl_terima"],
  },

  /**
   * ==========================================================================
   * SAKSI ADA DI perkara_pihak5, BUKAN perkara_keterangan_saksi
   * ==========================================================================
   *
   * SIPP menyimpan saksi sebagai PIHAK kelima - perkara_pihak5 menghubungkan
   * perkara dengan barisnya di tabel pihak, dan identitasnya ada di sana.
   *
   * Perhatikan ejaannya: SIPP menulis "indentitas", bukan "identitas". Itu
   * salah eja pada skema SIPP sendiri, dan harus diikuti apa adanya - kolom
   * yang dieja benar tidak akan ketemu.
   *
   * SK menghitung tiga isian. Yang dipakai pengadilan ini: jenis identitas,
   * nomor identitas, dan nomor telepon.
   */
  saksiJenisIdentitas: {
    tabel: "pihak",
    calon: ["jenis_indentitas", "jenis_identitas", "jenis_indentitas_nama"],
  },
  saksiNomorIdentitas: {
    tabel: "pihak",
    calon: ["nomor_indentitas", "nomor_identitas", "no_indentitas", "nik"],
  },
  saksiTelepon: { tabel: "pihak", calon: ["telepon", "no_telepon", "hp"] },
  /**
   * Pihak yang menghadirkan saksi - penggugat/pemohon atau tergugat/termohon.
   * SIPP menampilkannya pada kolom "Pihak Yang Menghadirkan".
   */
  saksiDiajukan: {
    tabel: "perkara_pihak5",
    calon: [
      "jenis_pihak_nama",
      "pihak_yang_menghadirkan",
      "menghadirkan",
      "diajukan_oleh",
      "jenis_pihak_text",
      "kedudukan",
    ],
  },
  saksiJenisPihakId: { tabel: "perkara_pihak5", calon: ["jenis_pihak_id", "jenis_pihak"] },
  saksiAlamat: { tabel: "pihak", calon: ["alamat", "alamat_lengkap", "tempat_tinggal"] },
  /** Hubungan saksi dengan para pihak - lazimnya ditulis pada keterangan. */
  saksiKeterangan: {
    tabel: "pihak",
    calon: ["keterangan", "hubungan", "hubungan_saksi", "catatan"],
  },

  /**
   * Status putusan yang DIKECUALIKAN dari penilaian saksi: cabut, gugur, dan
   * digugurkan. Nomornya 65, 67, dan 93 pada SIPP setempat - perkara yang
   * berakhir tanpa pembuktian memang tidak punya saksi, dan menghitungnya nol
   * berarti menghukum pengadilan atas perkara yang dicabut pihaknya sendiri.
   */
  statusPutusanId: { tabel: "perkara_putusan", calon: ["status_putusan_id"] },

  /**
   * ==========================================================================
   * KETERANGAN PUTUSAN YANG LENGKAP
   * ==========================================================================
   */
  amarPutusan: { tabel: "perkara_putusan", calon: ["amar_putusan"] },

  /**
   * ==========================================================================
   * STATUS PUTUSAN DAN SUMBER HUKUM DISIMPAN SEBAGAI NOMOR
   * ==========================================================================
   *
   * perkara_putusan hanya menyimpan status_putusan_id dan sumber_hukum_id -
   * angka. Namanya ada di tabel rujukannya sendiri: status_putusan dan
   * sumber_hukum, dicari lewat kolom id, namanya pada kolom nama.
   *
   * Tanpa penerjemahan itu yang tampil di layar hanyalah angka - dan angka
   * tidak memberi tahu siapa pun apakah perkaranya dikabulkan atau ditolak.
   */
  rujukanStatusPutusanId: { tabel: "status_putusan", calon: ["id"] },
  rujukanStatusPutusanNama: { tabel: "status_putusan", calon: ["nama"] },
  sumberHukumId: { tabel: "perkara_putusan", calon: ["sumber_hukum_id"] },
  rujukanSumberHukumId: { tabel: "sumber_hukum", calon: ["id"] },
  rujukanSumberHukumNama: { tabel: "sumber_hukum", calon: ["nama"] },

  /**
   * ==========================================================================
   * IKRAR TALAK
   * ==========================================================================
   *
   * Hanya ada pada perkara cerai talak. Bentuknya mengikuti perkara_penetapan:
   * tiap petugas punya tanggal penetapan dan teks namanya.
   */
  ikrarPenetapanMajelis: {
    tabel: "perkara_ikrar_talak",
    calon: ["penetapan_majelis_hakim", "tanggal_penetapan_majelis_hakim"],
  },
  ikrarMajelisText: { tabel: "perkara_ikrar_talak", calon: ["majelis_hakim_text", "majelis_hakim_nama"] },
  ikrarPenetapanPp: {
    tabel: "perkara_ikrar_talak",
    calon: ["penetapan_panitera_pengganti", "tanggal_penetapan_panitera_pengganti"],
  },
  ikrarPpText: {
    tabel: "perkara_ikrar_talak",
    calon: ["panitera_pengganti_text", "panitera_pengganti_nama", "panitera_text"],
  },
  ikrarPenetapanJs: {
    tabel: "perkara_ikrar_talak",
    calon: ["penetapan_jurusita", "tanggal_penetapan_jurusita"],
  },
  ikrarJsText: { tabel: "perkara_ikrar_talak", calon: ["jurusita_text", "jurusita_nama"] },
  ikrarPenetapanSidang: {
    tabel: "perkara_ikrar_talak",
    calon: [
      "penetapan_sidang_ikrar_talak",
      "tanggal_penetapan_sidang_ikrar_talak",
      "penetapan_hari_sidang",
    ],
  },
  ikrarTanggal: {
    tabel: "perkara_ikrar_talak",
    calon: ["tanggal_ikrar_talak", "tgl_ikrar_talak", "tanggal_ikrar"],
  },
  ikrarAmar: {
    tabel: "perkara_ikrar_talak",
    calon: ["amar_ikrar_talak", "amar_penetapan_ikrar_talak", "amar"],
  },
  ikrarDokumen: {
    tabel: "perkara_ikrar_talak",
    calon: ["ikrar_talak_dok", "penetapan_ikrar_talak_dok", "dokumen", "amar_ikrar_talak_dok"],
  },
  ikrarStatusId: {
    tabel: "perkara_ikrar_talak",
    calon: ["status_penetapan_ikrar_talak_id", "status_ikrar_talak_id", "status_id"],
  },
  ikrarNomorSk: {
    tabel: "perkara_ikrar_talak",
    calon: ["nomor_sk_penetapan_majelis_hakim", "nomor_sk_penetapan", "nomor_penetapan"],
  },
  ikrarSidangPertama: {
    tabel: "perkara_ikrar_talak",
    calon: ["sidang_pertama", "tanggal_sidang"],
  },
  amarAnonimisasi: { tabel: "perkara_putusan", calon: ["amar_putusan_anonimisasi"] },
  sumberHukum: { tabel: "perkara_putusan", calon: ["sumber_hukum_text", "sumber_hukum"] },
  faktorPerceraianPrimer: {
    tabel: "perkara_putusan",
    calon: ["faktor_penyebab_text", "faktor_penyebab_primer_text", "faktor_penyebab_nama", "faktor_penyebab_primer"],
  },
  faktorPerceraianSekunder: {
    tabel: "perkara_putusan",
    calon: ["faktor_penyebab_sekunder_text", "faktor_penyebab_sekunder_nama", "faktor_penyebab_sekunder"],
  },
  qoblaBada: { tabel: "perkara_putusan", calon: ["qobla_bada_text", "qobla_bada_nama", "qobla_bada"] },
  statusNusyuz: { tabel: "perkara_putusan", calon: ["status_nusyuz_text", "status_nusyuz_nama", "status_nusyuz"] },
  pertimbanganHukum: { tabel: "perkara_putusan", calon: ["pertimbangan_hukum"] },

  /** Keterangan arsip - SK I.16 menilai waktunya, ini melengkapi isinya. */
  arsipKeterangan: { tabel: "arsip", calon: ["keterangan", "catatan", "lokasi", "box"] },
  arsipNomor: { tabel: "arsip", calon: ["nomor_box", "no_box", "nomor_arsip", "kode"] },
  arsipOleh: { tabel: "arsip", calon: ["diinput_oleh", "user", "petugas"] },

  /**
   * Letak berkas FISIK. Inilah isi sebenarnya tabel arsip SIPP - bukan
   * berkas digital - dan pertanyaan yang dijawabnya sederhana: berkas
   * perkara ini disimpan di mana. Seluruh 4.863 baris arsip di pengadilan
   * ini punya keterangan itu, dan sebelumnya tidak satu pun ditampilkan.
   */
  arsipRuang: { tabel: "arsip", calon: ["no_ruang", "ruang", "nomor_ruang"] },
  arsipLemari: { tabel: "arsip", calon: ["no_lemari", "lemari", "nomor_lemari"] },
  arsipRak: { tabel: "arsip", calon: ["no_rak", "rak", "nomor_rak"] },
  arsipBox: { tabel: "arsip", calon: ["no_berkas", "no_box", "nomor_box", "box"] },
  arsipMasuk: { tabel: "arsip", calon: ["tanggal_masuk_arsip", "tanggal_masuk"] },
  arsipLengkap: { tabel: "arsip", calon: ["lengkap"] },
  arsipPenerima: { tabel: "arsip", calon: ["nama_penerima", "penerima"] },
  /**
   * Berkas pindaian arsip. Namanya tidak seragam antar versi SIPP, jadi
   * dicoba beberapa - dan bila tidak satu pun ada, tombol unduhnya memang
   * tidak muncul, bukan muncul lalu gagal.
   */
  arsipBerkas: {
    tabel: "arsip",
    calon: ["dokumen", "file_arsip", "arsip_dok", "berkas", "file", "lampiran", "scan"],
  },

  /**
   * ==========================================================================
   * KONSEPTOR PUTUSAN
   * ==========================================================================
   *
   * Siapa yang membuat konsep putusan tidak punya kolomnya sendiri. Yang ada
   * jejak prosesnya: perkara_proses dengan tahapan_id 210 adalah tahapan
   * putusan, dan diinput_oleh pada baris itu adalah orang yang mengerjakannya.
   *
   * Yang tersimpan USERNAME, bukan nama orangnya. Nama aslinya ada di
   * sys_users.fullname - tanpa itu yang tampil di layar hanya "panmud4".
   */
  /**
   * Penanda tahapan pada perkara_proses.
   *
   * Namanya proses_id, BUKAN tahapan_id. Tebakan sebelumnya membuat
   * penyaringnya tidak pernah cocok, konseptor selalu kosong, dan layarnya
   * menerangkan bahwa tahapan putusan "tidak tercatat" - padahal tercatat,
   * hanya dicari di kolom yang keliru.
   */
  prosesTahapanId: { tabel: "perkara_proses", calon: ["proses_id", "tahapan_id"] },
  prosesDiinputOleh: { tabel: "perkara_proses", calon: ["diinput_oleh"] },
  prosesTanggal: { tabel: "perkara_proses", calon: ["diinput_tanggal", "tanggal_proses", "tanggal"] },
  penggunaUsername: { tabel: "sys_users", calon: ["username", "user_name", "nama_pengguna"] },

  /**
   * ==========================================================================
   * PENUNJUKAN: SATU BARIS PENETAPAN PER PERKARA
   * ==========================================================================
   *
   * perkara_penetapan berkunci utama perkara_id - SATU baris per perkara, dan
   * keempat penetapan menempati kolom yang berbeda pada baris yang sama. Bukan
   * satu baris per penetapan seperti yang sempat saya kira.
   *
   * Akibatnya penting: keempat tanggal itu saling menimpa bila diisi ulang,
   * dan tidak ada riwayat di sana. Riwayat penggantian ada di perkara_hakim_pn
   * lewat aktif dan tanggal_tidak_aktif.
   *
   * Baris itu juga sudah memuat ringkasan siapa yang ditunjuk - majelis_hakim_*
   * dan kawan-kawannya - sehingga menampilkan penunjukan yang berlaku tidak
   * selalu perlu menggabung tiga tabel petugas.
   */
  penetapanJenisAcara: { tabel: "perkara_penetapan", calon: ["jenis_acara"] },
  penetapanMajelisId: { tabel: "perkara_penetapan", calon: ["majelis_hakim_id"] },
  penetapanMajelisKode: { tabel: "perkara_penetapan", calon: ["majelis_hakim_kode"] },
  penetapanMajelisNama: { tabel: "perkara_penetapan", calon: ["majelis_hakim_nama"] },
  penetapanPpId: { tabel: "perkara_penetapan", calon: ["panitera_pengganti_id"] },
  penetapanPpText: { tabel: "perkara_penetapan", calon: ["panitera_pengganti_text"] },
  penetapanJsId: { tabel: "perkara_penetapan", calon: ["jurusita_id"] },
  penetapanJsText: { tabel: "perkara_penetapan", calon: ["jurusita_text"] },
  penetapanNomorPmh: { tabel: "perkara_penetapan", calon: ["nomor_sk_penetapan_majelis_hakim"] },
  penetapanNomorPpp: { tabel: "perkara_penetapan", calon: ["nomor_sk_penetapan_panitera_pengganti"] },
  penetapanNomorPjs: { tabel: "perkara_penetapan", calon: ["nomor_sk_penetapan_jurusita"] },

  /**
   * Nilai sengketa - penentu hakim tunggal atau majelis pada ekonomi syariah.
   *
   * Kolomnya memang ada tersendiri, jadi tidak perlu menafsir posita maupun
   * petitum lebih dulu. Tetapi ia boleh kosong, dan kosong TIDAK sama dengan
   * nol - perkara yang nilainya tidak pernah diisi akan terbaca nol lalu
   * disimpulkan hakim tunggal, padahal belum ada yang menyatakannya. Karena itu
   * pembacanya membedakan "kosong" dari "nol", dan yang kosong ditanyakan.
   */
  nilaiSengketa: { tabel: "perkara", calon: ["nilai_sengketa"] },
  posita: { tabel: "perkara", calon: ["posita"] },
  petitum: { tabel: "perkara", calon: ["petitum"] },

  /**
   * ==========================================================================
   * SK SUSUNAN MAJELIS - SUDAH ADA DI SIPP
   * ==========================================================================
   *
   * ref_sk_majelis_tetap menyimpan nomor dan tanggal SK-nya; ref_majelis_tetap
   * menyimpan isinya - majelis mana, hakim siapa, urutan keberapa, kompetensi
   * apa. Itu persis yang sempat hendak dibuatkan tabel sendiri di ALETA.
   *
   * kompetensi_id itulah yang membedakan majelis yang boleh memeriksa ekonomi
   * syariah dari yang tidak - sehingga daftar sertifikat pun tidak perlu
   * diketik ulang, cukup dibaca.
   *
   * Yang TIDAK ada di sini hanya hari sidangnya. Itu satu-satunya isi SK yang
   * benar-benar perlu disimpan di sisi ALETA.
   */
  majelisTetapId: { tabel: "ref_majelis_tetap", calon: ["majelis_id"] },
  majelisTetapSkId: { tabel: "ref_majelis_tetap", calon: ["sk_majelis_tetap_id"] },
  majelisTetapKompetensi: { tabel: "ref_majelis_tetap", calon: ["kompetensi_id"] },
  majelisTetapHakimId: { tabel: "ref_majelis_tetap", calon: ["hakim_id"] },
  majelisTetapHakimNama: { tabel: "ref_majelis_tetap", calon: ["hakim_nama"] },
  majelisTetapUrutan: { tabel: "ref_majelis_tetap", calon: ["urutan"] },
  majelisTetapAktif: { tabel: "ref_majelis_tetap", calon: ["aktif"] },
  majelisTetapRasio: { tabel: "ref_majelis_tetap", calon: ["rasio"] },
  majelisTetapKeliling: { tabel: "ref_majelis_tetap", calon: ["sidang_keliling"] },
  skMajelisNomor: { tabel: "ref_sk_majelis_tetap", calon: ["nomor_sk"] },
  skMajelisTanggal: { tabel: "ref_sk_majelis_tetap", calon: ["tanggal_sk"] },
  skMajelisAktif: { tabel: "ref_sk_majelis_tetap", calon: ["aktif"] },
  kompetensiNama: { tabel: "ref_kompetensi_majelis", calon: ["nama_kompetensi_majelis"] },
  kompetensiAktif: { tabel: "ref_kompetensi_majelis", calon: ["aktif"] },

  /**
   * Usulan smart majelis. hakim_id dan hakim_id2 keduanya varchar berisi id
   * yang dipisah koma - satu id tanpa koma berarti hakim tunggal. Yang BERLAKU
   * hakim_id2 bila terisi, sebab itulah penggantinya.
   */
  smartMajelisId: { tabel: "perkara_smartmajelis", calon: ["majelis_id"] },
  smartHakimId: { tabel: "perkara_smartmajelis", calon: ["hakim_id"] },
  smartHakimId2: { tabel: "perkara_smartmajelis", calon: ["hakim_id2"] },
  smartStatus: { tabel: "perkara_smartmajelis", calon: ["status"] },
  smartTanggal: { tabel: "perkara_smartmajelis", calon: ["tanggal"] },
  smartKeterangan: { tabel: "perkara_smartmajelis", calon: ["keterangan"] },

  /**
   * Daftar induk hakim, panitera, dan juru sita.
   *
   * hakim_pn.kode memuat kode majelis - A, B, C1, C2, C3 - jadi kode SK tidak
   * perlu dicocokkan dengan nama, cukup dibaca.
   */
  hakimKode: { tabel: "hakim_pn", calon: ["kode"] },
  hakimNama: { tabel: "hakim_pn", calon: ["nama"] },
  hakimNamaGelar: { tabel: "hakim_pn", calon: ["nama_gelar"] },
  hakimJabatan: { tabel: "hakim_pn", calon: ["jabatan"] },
  hakimAktif: { tabel: "hakim_pn", calon: ["aktif"] },
  paniteraKode: { tabel: "panitera_pn", calon: ["kode"] },
  paniteraNama: { tabel: "panitera_pn", calon: ["nama"] },
  paniteraAktif: { tabel: "panitera_pn", calon: ["aktif"] },
  jurusitaKode: { tabel: "jurusita", calon: ["kode"] },
  jurusitaNama: { tabel: "jurusita", calon: ["nama"] },
  jurusitaJabatan: { tabel: "jurusita", calon: ["jabatan"] },
  jurusitaAktif: { tabel: "jurusita", calon: ["aktif"] },

  /**
   * Tahapan pada ketiga tabel petugas. Penunjukan tingkat pertama bertahapan
   * 10; 18, 20, 30, dan 40 dipakai upaya hukum. Menghitung giliran tanpa
   * menyaringnya akan menghitung penunjukan banding sebagai giliran baru.
   */
  petugasTahapanId: { tabel: "perkara_jurusita", calon: ["tahapan_id"] },
  petugasTanggalPenetapan: { tabel: "perkara_jurusita", calon: ["tanggal_penetapan"] },
  petugasNomorSk: { tabel: "perkara_jurusita", calon: ["nomor_sk_penetapan"] },
  petugasUrutan: { tabel: "perkara_jurusita", calon: ["urutan"] },
  penggunaNamaLengkap: { tabel: "sys_users", calon: ["fullname", "nama_lengkap", "nama"] },

  /**
   * ==========================================================================
   * DELEGASI: MASUK DAN KELUAR TERPISAH
   * ==========================================================================
   *
   * delegasi_masuk  - permintaan dari pengadilan lain yang KITA laksanakan;
   *                   SK I.17 menilai seberapa cepat kita menerimanya
   * delegasi_keluar - permintaan KITA ke pengadilan lain (tabayun); SK III.3
   *                   menilai seberapa jauh sebelum sidang kita memintanya
   */
  /**
   * ==========================================================================
   * DELEGASI: NAMA KOLOMNYA BERAWALAN tgl_
   * ==========================================================================
   *
   * Berbeda dari tabel perkara yang memakai tanggal_. Nama-nama di bawah ini
   * disalin dari kueri notifikasi SIPP pengadilan ini, jadi bukan tebakan.
   *
   * id_jenis_delegasi = 1 berarti panggilan - itulah yang dinilai SK III.3.
   * Delegasi pemberitahuan tidak ikut, sebab yang dinilai kepatutan waktu
   * PEMANGGILAN.
   */
  delegasiMasukUnggah: {
    tabel: "delegasi_masuk",
    calon: ["tgl_delegasi", "tgl_upload", "tanggal_upload", "tgl_kirim"],
  },
  delegasiMasukTerima: {
    tabel: "delegasi_masuk",
    calon: ["tgl_terima", "tgl_diterima", "tanggal_terima", "tgl_resi"],
  },
  delegasiMasukAsal: {
    tabel: "delegasi_masuk",
    calon: ["pengadilan_pengaju", "nama_pengadilan", "pengadilan_asal", "satker_pengaju"],
  },
  delegasiMasukJenis: { tabel: "delegasi_masuk", calon: ["id_jenis_delegasi", "jenis_delegasi"] },
  delegasiMasukSidang: { tabel: "delegasi_masuk", calon: ["tgl_sidang", "tanggal_sidang"] },

  delegasiKeluarPermohonan: {
    tabel: "delegasi_keluar",
    calon: ["tgl_delegasi", "tanggal_delegasi", "tgl_kirim", "tanggal_permohonan"],
  },
  delegasiKeluarSidang: { tabel: "delegasi_keluar", calon: ["tgl_sidang", "tanggal_sidang"] },
  delegasiKeluarResi: { tabel: "delegasi_keluar", calon: ["tgl_resi", "tanggal_resi"] },
  delegasiKeluarTujuan: {
    tabel: "delegasi_keluar",
    calon: ["pengadilan_tujuan", "nama_pengadilan", "satker_tujuan"],
  },
  delegasiKeluarJenis: { tabel: "delegasi_keluar", calon: ["id_jenis_delegasi", "jenis_delegasi"] },
  delegasiKeluarNomor: { tabel: "delegasi_keluar", calon: ["nomor_perkara"] },
  delegasiKeluarSelesai: {
    tabel: "delegasi_keluar",
    calon: ["tgl_selesai", "tanggal_selesai", "tgl_hasil"],
  },

  /** Pelaksanaan delegasi keluar - kapan relaasnya, oleh jurusita mana. */
  delegasiProsesRelaas: { tabel: "delegasi_proses_keluar", calon: ["tgl_relaas", "tanggal_relaas"] },
  delegasiProsesJurusita: {
    tabel: "delegasi_proses_keluar",
    calon: ["jurusita_nama", "nama_jurusita"],
  },
  delegasiProsesKunci: { tabel: "delegasi_proses_keluar", calon: ["delegasi_id"] },
  /**
   * ==========================================================================
   * GHAIB DITANDAI PADA PIHAK, BUKAN PADA PERKARA
   * ==========================================================================
   *
   * Yang ghaib adalah PIHAKNYA - tergugat atau termohon yang tidak diketahui
   * keberadaannya - dan SIPP menandainya pada perkara_pihak2.ghaib. Itulah
   * penanda yang dipakai notifikasi SIPP setempat, dan itu memang yang paling
   * masuk akal: satu perkara dapat punya tergugat yang ghaib dan yang tidak.
   */
  pihakGhaib: { tabel: "perkara_pihak2", calon: ["ghaib"] },
  vGhaib: { tabel: "v_perkara", calon: ["is_ghaib", "ghaib", "perkara_ghaib"] },
  /**
   * ==========================================================================
   * PENETAPAN KEMBALI
   * ==========================================================================
   *
   * perkara_hakim_pn, perkara_panitera_pn, dan perkara_jurusita menyimpan
   * riwayatnya: baris yang tidak lagi berlaku ditandai aktif = T beserta
   * tanggal_tidak_aktif dan diganti_oleh_id, dan barisnya membawa
   * diperbaharui_oleh serta diperbaharui_tanggal.
   *
   * Ini yang membedakan penetapan PERTAMA dari penetapan KEMBALI - dan hanya
   * yang pertama yang dinilai.
   */
  petugasAktif: { tabel: "perkara_hakim_pn", calon: ["aktif"] },
  petugasDiinputTanggal: { tabel: "perkara_hakim_pn", calon: ["diinput_tanggal"] },
  petugasDiperbaharuiTanggal: { tabel: "perkara_hakim_pn", calon: ["diperbaharui_tanggal"] },
  petugasDiperbaharuiOleh: { tabel: "perkara_hakim_pn", calon: ["diperbaharui_oleh"] },
  petugasTidakAktif: { tabel: "perkara_hakim_pn", calon: ["tanggal_tidak_aktif"] },

  /** Penilaian relaas - tabelnya tersendiri pada SIPP setempat. */
  penilaianRelaasTanggal: {
    tabel: "perkara_penilaian_relaas",
    calon: ["diinput_tanggal", "tanggal_input", "tanggal_penilaian", "created_date"],
  },
  penilaianRelaasNilai: {
    tabel: "perkara_penilaian_relaas",
    calon: ["nilai", "nilai_relaas", "poin"],
  },
  /** Jenis pekerjaan atau instansi pihak - dipakai menandai PNS/TNI/POLRI. */
  pihakPekerjaan: { tabel: "pihak", calon: ["pekerjaan", "pekerjaan_nama", "jenis_pekerjaan"] },
  pihakNama: { tabel: "pihak", calon: ["nama"] },
};
/**
 * Kolom yang terpilih untuk tiap keterangan.
 *
 * @returns {Promise<Record<string, string>>} nama keterangan -> nama kolom, "" bila tidak ada
 */
async function kolomTerpilih() {
  await muat();
  const hasil = {};
  for (const [nama, acuan] of Object.entries(CALON)) {
    hasil[nama] = await pilihKolom(acuan.tabel, acuan.calon);
  }
  return hasil;
}

/**
 * Laporan untuk layar dan untuk skrip pemeriksa: apa yang ketemu, apa yang
 * tidak, dan pada tabel mana harus dicari.
 */
async function laporan() {
  const skema = await muat();
  const terpilih = await kolomTerpilih();

  const baris = Object.entries(CALON).map(([nama, acuan]) => ({
    keterangan: nama,
    tabel: acuan.tabel,
    tabelAda: Boolean(skema[acuan.tabel] && skema[acuan.tabel].size > 0),
    kolom: terpilih[nama],
    ketemu: Boolean(terpilih[nama]),
    calon: acuan.calon,
  }));

  return {
    tabel: Object.fromEntries(
      Object.entries(skema).map(([nama, kolom]) => [nama, kolom.size])
    ),
    keterangan: baris,
    ketemu: baris.filter((x) => x.ketemu).length,
    belumKetemu: baris.filter((x) => !x.ketemu).length,
  };
}

module.exports = {
  CALON,
  kolomTabel,
  TABEL,
  kolomAda,
  kolomTerpilih,
  laporan,
  lupakan,
  muat,
  pilihKolom,
  tabelAda,
};
