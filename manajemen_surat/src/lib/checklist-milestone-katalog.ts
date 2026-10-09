/**
 * ============================================================================
 * KATALOG CHECKLIST MILESTONE - SATU SUMBER
 * ============================================================================
 *
 * Tiap peran punya daftar pekerjaan penting (paling banyak sepuluh jenis),
 * dan tiap jenis punya empat jawaban yang ditulis DI SINI, bukan di tempat
 * lain:
 *
 *   masuk          kapan suatu perkara menjadi butir checklist
 *   tenggat        kapan pekerjaan itu jatuh tempo (WITA)
 *   selesai        kapan butirnya hilang sendiri - tanpa centang tangan
 *   selesaiHariIni kapan butir yang hilang itu dihitung "selesai hari ini"
 *                  untuk bilah kemajuan, atau null bila tidak dapat dibuktikan
 *
 * Widget ekstensi TIDAK menulis judulnya sendiri: judul ikut dalam jawaban
 * API. Ekstensi berjalan dalam beberapa versi sekaligus di peramban orang;
 * judul yang tinggal di sana tidak dapat diperbaiki dari satu tempat.
 *
 * ============================================================================
 * JENIS YANG TIDAK TERSEDIA DITULIS JUGA, BESERTA SEBABNYA
 * ============================================================================
 *
 * Jenis yang datanya belum ada atau belum terbukti TIDAK dikarang. Ia tetap
 * tercantum - dengan tersedia:false dan sebabnya - supaya ketiadaan butir
 * tidak dibaca sebagai "pekerjaannya beres".
 *
 * ============================================================================
 * KELOMPOK
 * ============================================================================
 *
 *   lewat      tenggatnya sudah lewat
 *   hari-ini   tenggatnya jatuh hari ini (WITA) dan belum lewat
 *   minggu-ini tenggatnya 1-7 hari ke depan; juga butir penugasan tanpa
 *              tenggat (selaluTampil) - pekerjaan terbuka yang harus tetap
 *              terlihat walau tanggalnya belum ditentukan
 *
 * Butir pemantauan yang tenggatnya lebih dari 7 hari ke depan tidak
 * ditampilkan; butir penugasan (selaluTampil) tetap ditampilkan sebagai
 * minggu-ini dengan tanggal tenggat yang sebenarnya.
 */

export const KUNCI_PERAN = [
  "hakim",
  "panitera-pengganti",
  "jurusita",
  "panitera",
  "ketua",
  "ptsp",
  "operator",
] as const;

export type KunciPeran = (typeof KUNCI_PERAN)[number];

export const LABEL_PERAN: Record<KunciPeran, string> = {
  hakim: "Hakim",
  "panitera-pengganti": "Panitera Pengganti",
  jurusita: "Juru Sita",
  panitera: "Panitera",
  ketua: "Ketua / Wakil Ketua",
  ptsp: "PTSP",
  operator: "Operator",
};

export type HalamanAbt = "blangko-putusan" | "blangko-penetapan" | "blangko-bas" | "blangko-relaas" | "blangko-akta";

/**
 * Halaman SIPP = tab di halaman perkara SIPP tempat pekerjaannya dikerjakan.
 * Ekstensi memetakannya ke nomor tab SIPP (NOMOR_TAB_SIPP di
 * ekstensi-sipp/checklist.js) dan membuka perkara_detil_agama/<enc>/<nomor>:
 * perkara Data Umum, penetapan 2 (PMH/PPP/PJS/PHS), jadwal-sidang 4,
 * relaas 4 (Cetak Relas & pelaksanaan relaas ada di tab Jadwal Sidang),
 * mediasi 6, putusan 10, keuangan 11, saksi 23, ikrar 24, akta-cerai 25.
 * Pilih halaman menurut PEKERJAANNYA, bukan menurut sumber datanya.
 *
 * Dua pekerjaan TIDAK dikerjakan di halaman perkara, jadi kuncinya menu SIPP
 * (uji rilis 9 Okt 2026; tautan menu dari sys_menus SIPP satker):
 *   pendaftaran-online  e-Court > Tingkat Pertama (pendaftaran_online) -
 *                       register e-Court belum punya perkara sama sekali;
 *   arsip-perkara       Arsip Perkara > Daftar Arsip Perkara (list_arsip) -
 *                       halaman detail perkara tidak memuat arsip.
 */
export type HalamanSipp =
  | "perkara"
  | "penetapan"
  | "jadwal-sidang"
  | "putusan"
  | "relaas"
  | "akta-cerai"
  | "keuangan"
  | "saksi"
  | "mediasi"
  | "ikrar"
  | "pendaftaran-online"
  | "arsip-perkara";

/**
 * Ke mana butir mengarah. URL ABT dan SIPP dibangun EKSTENSI dari kunci
 * halamannya (ekstensi tahu alamat SIPP/ABT satker dan nomor perkaranya);
 * portal hanya menyebut halaman mana. Untuk ALETA, alamatnya jalur portal
 * yang sungguh ada, lengkap dengan basePath /aleta.
 */
export type Kerjakan =
  | { tujuan: "abt"; halaman: HalamanAbt }
  | { tujuan: "sipp"; halaman: HalamanSipp }
  | { tujuan: "aleta"; alamat: string }
  | { tujuan: "ecourt"; alamat?: string };

export type JenisTersedia = {
  kunci: string;
  peran: KunciPeran;
  judul: string;
  tersedia: true;
  masuk: string;
  tenggat: string;
  selesai: string;
  selesaiHariIni: string | null;
  kerjakan: Kerjakan;
  /** Dasar hukum atau dasar praktik, dan tabelnya. */
  sumber: string;
  /**
   * Koleksi fakta bot yang dipakai. Bila salah satunya gagal dibaca, jenis
   * ini dilaporkan tidak tersedia pada jawaban itu - bukan "tidak ada butir".
   */
  koleksi: string[];
  /** Butuh id pejabat SIPP pengguna (perkara miliknya). */
  butuhPejabat: boolean;
  /** Butir penugasan: tetap tampil walau tenggatnya lebih dari 7 hari atau tidak ada. */
  selaluTampil: boolean;
};

export type JenisTidakTersedia = {
  kunci: string;
  peran: KunciPeran;
  judul: string;
  tersedia: false;
  sebab: string;
};

export type JenisKatalog = JenisTersedia | JenisTidakTersedia;

/** Alamat portal yang dirujuk katalog - dijaga ujinya: harus berpadanan dengan halaman yang ada. */
export const ALAMAT_ALETA = {
  verifikasiDokumen: "/aleta/verifikasi-dokumen",
  adminEcourt: "/aleta/admin/aleta-ecourt",
} as const;

const SIPP_HAKIM = ["hakim"];

export const KATALOG_CHECKLIST: JenisKatalog[] = [
  // ==========================================================================
  // HAKIM
  // ==========================================================================
  {
    kunci: "hakim.konsep-putusan",
    peran: "hakim",
    judul: "Kerjakan konsep putusan yang ditugaskan",
    tersedia: true,
    masuk:
      "Perkara belum putus yang konseptornya ditunjuk kepada Anda lewat Konseptor Sementara ALETA (dicocokkan dengan username SIPP Anda; bila username kosong, dengan nama yang dibakukan seperti di bandingkanKonseptor). SIPP sendiri baru menyebut konseptor sesudah tahapan putusan (proses 210) dicatat - diukur 0 perkara belum putus yang punya baris itu.",
    tenggat:
      "Tanggal sidang mendatang pertama yang agendanya musyawarah/pembacaan putusan; bila tidak ada, sidang mendatang pertama; bila tidak ada jadwal, tanpa tenggat.",
    selesai: "Tanggal putusan perkara itu terisi di SIPP.",
    selesaiHariIni: "Tanggal putusannya hari ini.",
    kerjakan: { tujuan: "abt", halaman: "blangko-putusan" },
    sumber: "aleta_konseptor_sementara; SIPP perkara_putusan, perkara_jadwal_sidang",
    koleksi: ["perkaraTertentu"],
    butuhPejabat: false,
    selaluTampil: true,
  },
  {
    kunci: "hakim.putusan-belum-unggah",
    peran: "hakim",
    judul: "Unggah naskah putusan yang dibacakan",
    tersedia: true,
    masuk:
      "Putusan yang dibacakan dalam 7 hari terakhir (termasuk hari ini) pada perkara yang Anda pimpin (ketua majelis atau hakim tunggal) dan dokumen putusannya (amar_putusan_dok) belum ada di SIPP - putusan Jumat tanpa naskah tetap tertagih pada hari Senin.",
    tenggat: "Hari putusan dibacakan (akhir hari, WITA); sesudahnya masuk kelompok lewat tenggat.",
    selesai: "amar_putusan_dok terisi.",
    selesaiHariIni: "Putusan dibacakan hari ini dan dokumennya sudah ada.",
    kerjakan: { tujuan: "sipp", halaman: "putusan" },
    sumber: "SK 048/2024 unsur eDokAmarPutusan dan waktuPublikasi; SIPP perkara_putusan",
    koleksi: ["putusan"],
    butuhPejabat: true,
    selaluTampil: false,
  },
  {
    kunci: "hakim.penetapan-tunggal",
    peran: "hakim",
    judul: "Siapkan penetapan untuk sidang permohonan",
    tersedia: true,
    masuk:
      "Perkara permohonan (alur 16) Dispensasi Kawin, Istbat Nikah, Perwalian, atau Asal Usul Anak yang belum putus, Anda hakim tunggal atau ketua majelisnya, dan ada sidang dalam 7 hari. Diukur 2026: 143 dari 176 Istbat Nikah putus pada sidang pertama, jadi tiap sidangnya calon hari penetapan.",
    tenggat: "Tanggal sidang mendatang pertama.",
    selesai: "Tanggal putusan (penetapan) terisi di SIPP.",
    selesaiHariIni: "Penetapan diucapkan hari ini.",
    kerjakan: { tujuan: "abt", halaman: "blangko-penetapan" },
    sumber: "SIPP perkara, perkara_hakim_pn (jabatan 1/3), perkara_jadwal_sidang, perkara_putusan",
    koleksi: ["sidang"],
    butuhPejabat: true,
    selaluTampil: false,
  },
  {
    kunci: "hakim.phs-menunggu",
    peran: "hakim",
    judul: "Tekan PHS yang menunggu di antrean penetapan",
    tersedia: true,
    masuk:
      "Titipan PHS berkeadaan 'menunggu' (belum kedaluwarsa 14 hari) di antrean penetapan ALETA pada perkara yang Anda pimpin sebagai ketua majelis atau hakim tunggal menurut SIPP.",
    tenggat: "Hari titipan itu disiapkan (ditekan pada hari yang sama).",
    selesai: "Titipan berkeadaan 'dikerjakan' (atau dibatalkan/kedaluwarsa - keduanya bukan lagi pekerjaan Anda).",
    selesaiHariIni: "Titipan dikerjakan hari ini.",
    kerjakan: { tujuan: "sipp", halaman: "penetapan" },
    sumber: "aleta_sipp_penunjukan_antrean (penunjukan-antrean.ts); SIPP perkara_hakim_pn; KT05",
    koleksi: ["perkaraTertentu"],
    butuhPejabat: true,
    selaluTampil: true,
  },
  {
    kunci: "hakim.ecourt-verifikasi",
    peran: "hakim",
    judul: "Verifikasi dokumen e-Court",
    tersedia: true,
    masuk:
      "Dokumen e-Court berstatus verifikasi 'belum' tanpa keputusan tersimpan (definisi listPendingForJudge) pada perkara berjalan yang Anda anggotai. Hanya bila tarikan e-Court berhasil dalam 24 jam terakhir; bila tidak, jenis ini dilaporkan tidak tersedia.",
    tenggat: "Tanggal sidang agenda dokumen itu; bila kosong, hari dokumen diunggah.",
    selesai: "Status verifikasinya bukan 'belum' lagi pada tarikan berikutnya, atau keputusannya tersimpan di ALETA.",
    selesaiHariIni: null,
    kerjakan: { tujuan: "ecourt" },
    sumber: "aleta_bot_ecourt_documents, aleta_bot_ecourt_verifications, aleta_bot_ecourt_sync_runs",
    koleksi: ["berjalan", "ecourtDokumen"],
    butuhPejabat: true,
    selaluTampil: false,
  },
  {
    kunci: "hakim.hasil-sidang-belum-dicatat",
    peran: "hakim",
    judul: "Catat hasil sidang sebelum pukul 15.00",
    tersedia: true,
    masuk:
      "Sidang 30 hari terakhir sampai hari ini pada perkara yang Anda pimpin yang hasilnya belum dicatat menurut hasilSidangBelumDicatat (lib/keadaan-sidang.ts): tidak ditunda, tidak diputus, ikrar tidak tercatat, tidak punya sidang lanjutan, dan alasan tundanya kosong. Diam bila peta putusan, ikrar, atau sidang lanjutan gagal dibaca.",
    tenggat: "Pukul 15.00 WITA pada hari sidang (JAM_BATAS_HASIL_SIDANG).",
    selesai: "Hasil sidangnya tercatat (ditunda dengan alasan, diputus, atau sidang lanjutan terbentuk).",
    selesaiHariIni: "Sidang hari ini yang hasilnya sudah tercatat.",
    kerjakan: { tujuan: "sipp", halaman: "jadwal-sidang" },
    sumber: "SK 048/2024 III.1 agendaSidangTerakhir; SIPP perkara_jadwal_sidang",
    koleksi: ["sidang"],
    butuhPejabat: true,
    selaluTampil: false,
  },
  {
    kunci: "hakim.lima-bulan",
    peran: "hakim",
    judul: "Perkara mendekati atau melewati 5 bulan",
    tersedia: true,
    masuk:
      "Perkara belum putus yang Anda pimpin, yang hari ke-150-nya (dihitung seperti Antrian Sidang: hari pendaftaran ikut dihitung, hari mediasi dikeluarkan) jatuh dalam 7 hari atau sudah lewat.",
    tenggat: "Hari ke-150 = tanggal daftar + 149 hari + hari mediasi.",
    selesai: "Perkara putus.",
    selesaiHariIni: null,
    kerjakan: { tujuan: "sipp", halaman: "jadwal-sidang" },
    sumber: "SEMA 2/2014; PERMA 1/2016 Pasal 24; durasiBanyakPerkara",
    koleksi: ["berjalan"],
    butuhPejabat: true,
    selaluTampil: false,
  },
  {
    kunci: "hakim.mediasi-30-hari",
    peran: "hakim",
    judul: "Mediasi mendekati atau melewati 30 hari",
    tersedia: true,
    masuk:
      "Mediasi yang Anda pegang sebagai mediator (perkara_mediasi.mediator_id -> mediator.hakim_id, bukan hakim_id langsung) tanpa laporan mediator, yang tenggat PERMA-nya jatuh dalam 7 hari atau sudah lewat.",
    tenggat: "Penetapan mediator + 30 hari (rumus daftarJadwalMediasi). Perpanjangan 30 hari tidak tercatat di SIPP.",
    selesai: "tgl_laporan_mediator terisi.",
    selesaiHariIni: "Laporan mediator bertanggal hari ini.",
    kerjakan: { tujuan: "sipp", halaman: "mediasi" },
    sumber: "PERMA 1/2016 Pasal 24; SIPP perkara_mediasi, mediator",
    koleksi: ["mediasi"],
    butuhPejabat: true,
    selaluTampil: false,
  },
  {
    kunci: "hakim.ikrar-talak",
    peran: "hakim",
    judul: "Ikrar talak: tetapkan dan laksanakan sidang ikrar",
    tersedia: true,
    masuk:
      "Cerai talak dikabulkan (status 62), sudah BHT, ikrar belum diucapkan, Anda ketua majelis/hakim tunggal. (a) Hari sidang ikrar belum ditetapkan - selalu tampil. (b) Sudah ditetapkan tetapi batas 180 hari sejak BHT jatuh dalam 7 hari atau sudah lewat.",
    tenggat:
      "(a) Hari BHT - Pasal 70 ayat (3) UU 7/1989: sesudah BHT pengadilan menentukan hari sidang ikrar (diukur rata-rata 2,4 hari). (b) BHT + 180 hari (KT16, batas ALETA yang lebih hati-hati daripada hitungan sejak penetapan sidang ikrar).",
    selesai: "(a) tanggal_penetapan_sidang_ikrar terisi. (b) tgl_ikrar_talak terisi.",
    selesaiHariIni: "Penetapan sidang ikrar atau ikrarnya bertanggal hari ini.",
    kerjakan: { tujuan: "sipp", halaman: "ikrar" },
    sumber: "Pasal 70 UU 7/1989; SIPP perkara_ikrar_talak, perkara_putusan",
    koleksi: ["ikrar"],
    butuhPejabat: true,
    selaluTampil: false,
  },

  // ==========================================================================
  // PANITERA PENGGANTI
  // ==========================================================================
  {
    kunci: "panitera-pengganti.bas-belum",
    peran: "panitera-pengganti",
    judul: "Unggah BAS sidang hari ini dan kemarin",
    tersedia: true,
    masuk: "Sidang hari ini atau kemarin pada perkara Anda yang edoc_bas-nya belum ada.",
    tenggat: "Hari sidang (SK 048/2024 II.3: diunggah hari sidang bernilai 5).",
    selesai: "edoc_bas terisi.",
    selesaiHariIni: "Sidang hari ini yang BAS-nya sudah terunggah.",
    kerjakan: { tujuan: "abt", halaman: "blangko-bas" },
    sumber: "SK 048/2024 II.3 eDokBas; SIPP perkara_jadwal_sidang.edoc_bas",
    koleksi: ["sidang"],
    butuhPejabat: true,
    selaluTampil: false,
  },
  {
    kunci: "panitera-pengganti.hasil-sidang-belum-dicatat",
    peran: "panitera-pengganti",
    judul: "Catat hasil sidang sebelum pukul 15.00",
    tersedia: true,
    masuk:
      "Sidang 60 hari terakhir sampai hari ini pada perkara Anda yang hasilnya belum dicatat (hasilSidangBelumDicatat, sama dengan butir hakim).",
    tenggat: "Pukul 15.00 WITA pada hari sidang.",
    selesai: "Hasil sidangnya tercatat.",
    selesaiHariIni: "Sidang hari ini yang hasilnya sudah tercatat.",
    kerjakan: { tujuan: "sipp", halaman: "jadwal-sidang" },
    sumber: "SK 048/2024 III.1; SIPP perkara_jadwal_sidang",
    koleksi: ["sidang"],
    butuhPejabat: true,
    selaluTampil: false,
  },
  {
    kunci: "panitera-pengganti.putusan-akhir-belum-diisi",
    peran: "panitera-pengganti",
    judul: "Isi blangko Putusan Akhir di SIPP",
    tersedia: true,
    masuk:
      "Sidang 60 hari terakhir pada perkara Anda yang hasilnya tertulis putus (hasilSidangPutusan: tidak ditunda, alasan memuat 'putus') tetapi perkara_putusan belum bertanggal putusan.",
    tenggat: "Hari sidang itu.",
    selesai: "Tanggal putusan terisi.",
    selesaiHariIni: "Baris putusannya diinput hari ini.",
    kerjakan: { tujuan: "sipp", halaman: "putusan" },
    sumber: "SIPP perkara_jadwal_sidang, perkara_putusan; lib/hasil-sidang.ts",
    koleksi: ["putusTanpaPutusan"],
    butuhPejabat: true,
    selaluTampil: false,
  },
  {
    kunci: "panitera-pengganti.putusan-belum-unggah",
    peran: "panitera-pengganti",
    judul: "Unggah naskah putusan dan anonimisasi (H+2)",
    tersedia: true,
    masuk: "Putusan 60 hari terakhir pada perkara Anda yang dokumen putusan atau dokumen anonimisasinya belum ada.",
    tenggat: "Tanggal putusan + 2 hari (SK 048/2024 Tabel 1 huruf c: hari ke-2 bernilai 5).",
    selesai: "amar_putusan_dok dan amar_putusan_anonimisasi_dok keduanya terisi.",
    selesaiHariIni: "Putusan hari ini yang kedua dokumennya sudah ada.",
    kerjakan: { tujuan: "sipp", halaman: "putusan" },
    sumber: "SIPP perkara_putusan",
    koleksi: ["putusan"],
    butuhPejabat: true,
    selaluTampil: false,
  },
  {
    kunci: "panitera-pengganti.pbt-belum-diserahkan",
    peran: "panitera-pengganti",
    judul: "Serahkan daftar PBT kepada juru sita",
    tersedia: false,
    sebab:
      "Penyerahan daftar PBT dari panitera pengganti kepada juru sita tidak tercatat di SIPP maupun ALETA. Yang tercatat hanya PELAKSANAAN PBT oleh juru sita (perkara_putusan_pemberitahuan_putusan) - dan itu sudah ditagih di jurusita.pbt-tidak-hadir.",
  },
  {
    kunci: "panitera-pengganti.tanggal-tunda-terlalu-dekat",
    peran: "panitera-pengganti",
    judul: "Tanggal tunda memberi tenggang patut untuk panggilan ulang",
    tersedia: false,
    sebab:
      "Aturan tenggang per jalur ada (ecourtPanggilanService), tetapi jalur yang wajib bagi tiap pihak bergantung pada persetujuan e-Litigasi yang hanya terbaca dari tarikan e-Court, dan hitungan hari kerjanya belum memakai daftar libur nasional. Menuduh tanggal tunda 'terlalu dekat' atas dasar itu belum terbukti benar.",
  },
  {
    kunci: "panitera-pengganti.saksi-belum-lengkap",
    peran: "panitera-pengganti",
    judul: "Lengkapi identitas saksi di SIPP",
    tersedia: true,
    masuk:
      "Saksi yang diinput 14 hari terakhir pada perkara Anda yang belum lengkap tiga isiannya: jenis identitas, nomor identitas, telepon.",
    tenggat: "Hari saksi itu diinput (SK 048/2024 Tabel 2 I.12 menilai isian saat itu).",
    selesai: "Ketiga isian terisi.",
    selesaiHariIni: "Saksi yang lengkap dan diinput atau diperbarui hari ini.",
    kerjakan: { tujuan: "sipp", halaman: "saksi" },
    sumber: "SK 048/2024 I.12 dataSaksi; SIPP perkara_pihak5, pihak",
    koleksi: ["saksi"],
    butuhPejabat: true,
    selaluTampil: false,
  },
  {
    kunci: "panitera-pengganti.tunggakan-bas",
    peran: "panitera-pengganti",
    judul: "Tunggakan BAS sidang yang sudah lewat",
    tersedia: true,
    masuk: "Sidang 2-60 hari yang lalu pada perkara Anda yang edoc_bas-nya belum ada.",
    tenggat: "Hari sidang itu.",
    selesai: "edoc_bas terisi.",
    selesaiHariIni: null,
    kerjakan: { tujuan: "abt", halaman: "blangko-bas" },
    sumber: "SK 048/2024 II.3; SIPP perkara_jadwal_sidang.edoc_bas",
    koleksi: ["sidang"],
    butuhPejabat: true,
    selaluTampil: false,
  },

  // ==========================================================================
  // JURU SITA
  // ==========================================================================
  {
    kunci: "jurusita.panggilan-sidang-pertama",
    peran: "jurusita",
    judul: "Panggil para pihak untuk sidang pertama",
    tersedia: true,
    masuk:
      "Sidang pertama (urutan 1) perkara yang ditunjuk kepada Anda (PJS aktif), belum putus, dengan pihak wajib dipanggil yang belum punya relaas (keadaanPanggilanSidang).",
    tenggat: "Tanggal sidang - 3 hari (SK 048/2024 I.10: relaas diinput 3 hari atau lebih sebelum sidang bernilai 5).",
    selesai: "Setiap sisi yang wajib dipanggil sudah punya relaas.",
    selesaiHariIni: null,
    kerjakan: { tujuan: "abt", halaman: "blangko-relaas" },
    sumber: "Pasal 26 PP 9/1975; SIPP perkara_jadwal_sidang, perkara_pelaksanaan_relaas, perkara_jurusita",
    koleksi: ["sidang"],
    butuhPejabat: true,
    selaluTampil: false,
  },
  {
    kunci: "jurusita.perintah-panggil-tunda",
    peran: "jurusita",
    judul: "Jalankan perintah panggil dari sidang yang ditunda",
    tersedia: true,
    masuk:
      "Sidang 7 hari terakhir pada perkara Anda yang ditunda dengan alasan memuat 'panggil', dan sidang lanjutannya (belum lewat) masih punya pihak wajib dipanggil tanpa relaas.",
    tenggat: "Tanggal sidang lanjutan - 3 hari.",
    selesai: "Pihak yang wajib dipanggil untuk sidang lanjutan sudah punya relaas.",
    selesaiHariIni: null,
    kerjakan: { tujuan: "abt", halaman: "blangko-relaas" },
    sumber: "Pasal 126 HIR; SIPP perkara_jadwal_sidang.alasan_ditunda, perkara_pelaksanaan_relaas",
    koleksi: ["sidang"],
    butuhPejabat: true,
    selaluTampil: true,
  },
  {
    kunci: "jurusita.belum-dipanggil-7-hari",
    peran: "jurusita",
    judul: "Pihak belum dipanggil untuk sidang 7 hari ke depan",
    tersedia: true,
    masuk:
      "Sidang lanjutan 4-7 hari ke depan pada perkara Anda, belum putus, dengan pihak wajib dipanggil tanpa relaas - kecuali yang sudah ditagih sebagai perintah panggil dari sidang yang ditunda.",
    tenggat: "Tanggal sidang - 3 hari.",
    selesai: "Pihak yang wajib dipanggil sudah punya relaas.",
    selesaiHariIni: null,
    kerjakan: { tujuan: "abt", halaman: "blangko-relaas" },
    sumber: "keadaanPanggilanSidang; SIPP perkara_pelaksanaan_relaas",
    koleksi: ["sidang"],
    butuhPejabat: true,
    selaluTampil: false,
  },
  {
    kunci: "jurusita.pbt-tidak-hadir",
    peran: "jurusita",
    judul: "Beritahukan putusan kepada pihak yang tidak hadir",
    tersedia: true,
    masuk:
      "Putusan 12 bulan terakhir pada perkara Anda yang dibacakan tanpa kehadiran satu sisi (dihadiri_oleh 2/3/4 pada sidang putusnya), BHT-nya belum terisi, dan sisi itu belum punya tanggal pemberitahuan putusan - kecuali putusan verstek yang lebih tua dari 14 hari (ditagih sebagai tunggakan). Putusan yang BHT-nya sudah terisi tidak ditagih: PBT-nya kemungkinan dilaksanakan tetapi tidak dicatat, dan itu urusan mutu data, bukan pekerjaan yang menahan BHT.",
    tenggat: "Tanggal putusan + 3 hari (SK 048/2024 I.13: 3 hari atau kurang bernilai 5).",
    selesai: "Tanggal pemberitahuan putusan untuk sisi yang tidak hadir terisi.",
    selesaiHariIni: "Pemberitahuan bertanggal hari ini.",
    kerjakan: { tujuan: "abt", halaman: "blangko-relaas" },
    sumber: "SK 048/2024 I.13; SIPP perkara_putusan_pemberitahuan_putusan",
    koleksi: ["putusan"],
    butuhPejabat: true,
    selaluTampil: false,
  },
  {
    kunci: "jurusita.relaas-belum-diinput",
    peran: "jurusita",
    judul: "Relaas sidang 3 hari ke depan belum ada di SIPP",
    tersedia: true,
    masuk:
      "Sidang lanjutan hari ini sampai 3 hari ke depan pada perkara Anda dengan pihak wajib dipanggil yang relaasnya belum ada di SIPP (batas H-3 sudah lewat). SIPP tidak membedakan relaas yang belum dilaksanakan dari yang belum diinput.",
    tenggat: "Tanggal sidang - 3 hari.",
    selesai: "Relaasnya ada di SIPP.",
    selesaiHariIni: null,
    kerjakan: { tujuan: "sipp", halaman: "relaas" },
    sumber: "SK 048/2024 I.10 dataRelaas; SIPP perkara_pelaksanaan_relaas",
    koleksi: ["sidang"],
    butuhPejabat: true,
    selaluTampil: false,
  },
  {
    kunci: "jurusita.retur-gagal",
    peran: "jurusita",
    judul: "Tindak lanjuti panggilan yang retur",
    tersedia: true,
    masuk:
      "Relaas berstatus retur (status_pos 2) untuk sidang 30 hari terakhir atau mendatang pada perkara Anda yang belum putus, tanpa relaas susulan untuk pihak yang sama. Bila sidang lanjutan perkara itu sudah ditagih sebagai butir panggilan, returnya dicatat di butir itu dan tidak ditagih dua kali.",
    tenggat: "Sidang mendatang berikutnya; bila tidak ada, sidang yang dituju relaas itu.",
    selesai: "Ada relaas susulan (bukan retur) untuk pihak yang sama.",
    selesaiHariIni: "Relaas susulannya diinput hari ini.",
    kerjakan: { tujuan: "abt", halaman: "blangko-relaas" },
    sumber: "SIPP perkara_pelaksanaan_relaas.status_pos",
    koleksi: ["retur"],
    butuhPejabat: true,
    selaluTampil: true,
  },
  {
    kunci: "jurusita.tunggakan-pbt-verstek",
    peran: "jurusita",
    judul: "Tunggakan PBT putusan verstek",
    tersedia: true,
    masuk:
      "Putusan verstek 12 bulan terakhir yang lebih tua dari 14 hari pada perkara Anda, BHT-nya belum terisi, dan sisi yang tidak hadir belum punya tanggal pemberitahuan putusan.",
    tenggat: "Tanggal putusan + 3 hari (sudah lewat).",
    selesai: "Tanggal pemberitahuan putusan untuk sisi itu terisi.",
    selesaiHariIni: "Pemberitahuan bertanggal hari ini.",
    kerjakan: { tujuan: "abt", halaman: "blangko-relaas" },
    sumber: "Pasal 129 HIR; SIPP perkara_putusan_pemberitahuan_putusan",
    koleksi: ["putusan"],
    butuhPejabat: true,
    selaluTampil: false,
  },

  // ==========================================================================
  // PANITERA
  // ==========================================================================
  {
    kunci: "panitera.ppp-pjs-menunggu",
    peran: "panitera",
    judul: "Tekan PPP/PJS yang menunggu di antrean penetapan",
    tersedia: true,
    masuk: "Titipan PPP atau PJS berkeadaan 'menunggu' (belum kedaluwarsa) di antrean penetapan ALETA.",
    tenggat: "Hari titipan itu disiapkan.",
    selesai: "Titipan tidak lagi 'menunggu'.",
    selesaiHariIni: "Titipan dikerjakan hari ini.",
    kerjakan: { tujuan: "sipp", halaman: "penetapan" },
    sumber: "aleta_sipp_penunjukan_antrean; KT03/KT04",
    koleksi: [],
    butuhPejabat: false,
    selaluTampil: true,
  },
  {
    kunci: "panitera.direktori-putusan",
    peran: "panitera",
    judul: "Putusan ke Direktori: gagal kirim, anonimisasi, naskah",
    tersedia: true,
    masuk:
      "(a) Antrean Direktori Putusan berstatus gagal (pembaca penjaga tenggat dirput-gagal). (b) Putusan tanpa anonimisasi lebih dari 14 hari (anonimisasi-hilang). (c) Putusan 12 bulan terakhir yang naskahnya belum diunggah melewati H+2.",
    tenggat: "(a) tanggal gagal; (b) putusan + 14 hari; (c) putusan + 2 hari.",
    selesai: "Antrean terkirim; berkas anonimisasi/naskah ada.",
    selesaiHariIni: null,
    kerjakan: { tujuan: "sipp", halaman: "putusan" },
    sumber: "SIPP dirput_antrian, perkara_putusan; ATURAN_TENGGAT",
    koleksi: ["putusan", "penjaga:dirput-gagal", "penjaga:anonimisasi-hilang"],
    butuhPejabat: false,
    selaluTampil: false,
  },
  {
    kunci: "panitera.bht-belum-diisi",
    peran: "panitera",
    judul: "Isi tanggal BHT",
    tersedia: true,
    masuk:
      "Putusan 12 bulan terakhir tanpa tanggal BHT dan tanpa permohonan banding, yang hari BHT-nya sudah dapat dihitung: bila semua pihak hadir saat putusan, putusan + 15 hari; bila ada yang tidak hadir, pemberitahuan terakhir kepada sisi itu + 15 hari (diukur 2026: BHT paling cepat hari ke-15). Yang PBT-nya belum ada tidak ditagih di sini - itu pekerjaan juru sita.",
    tenggat: "Hari BHT yang dihitung itu.",
    selesai: "tanggal_bht terisi.",
    selesaiHariIni: "Tanggal BHT yang terisi adalah hari ini.",
    kerjakan: { tujuan: "sipp", halaman: "putusan" },
    sumber: "SK 048/2024 pengisianBht; KT14; SIPP perkara_putusan, perkara_putusan_pemberitahuan_putusan, perkara_banding",
    koleksi: ["putusan"],
    butuhPejabat: false,
    selaluTampil: false,
  },
  {
    kunci: "panitera.akta-cerai-belum-terbit",
    peran: "panitera",
    judul: "Terbitkan akta cerai",
    tersedia: true,
    masuk:
      "Cerai gugat dikabulkan yang sudah BHT, atau cerai talak yang ikrarnya sudah diucapkan, tanpa akta cerai (pembaca penjaga tenggat akta-cerai-gugat/akta-cerai-talak).",
    tenggat: "BHT (cerai gugat) atau ikrar (cerai talak) + 14 hari (ATURAN_TENGGAT).",
    selesai: "Baris perkara_akta_cerai ada.",
    selesaiHariIni: "Akta bertanggal hari ini.",
    kerjakan: { tujuan: "sipp", halaman: "akta-cerai" },
    sumber: "SK 048/2024 II.4; SIPP perkara_akta_cerai",
    koleksi: ["penjaga:akta-cerai-gugat", "penjaga:akta-cerai-talak", "aktaHariIni"],
    butuhPejabat: false,
    selaluTampil: false,
  },
  {
    kunci: "panitera.arsip-bht",
    peran: "panitera",
    judul: "Input arsip perkara yang sudah BHT",
    tersedia: true,
    masuk:
      "Perkara ber-BHT 12 bulan terakhir yang belum punya baris arsip (ditautkan lewat nomor perkara tanpa titik di ujung).",
    tenggat: "BHT + 5 hari (SK 048/2024 Tabel 2 I.16: 5 hari atau kurang bernilai 5).",
    selesai: "Baris arsip ada.",
    selesaiHariIni: "Arsip diinput hari ini.",
    kerjakan: { tujuan: "sipp", halaman: "arsip-perkara" },
    sumber: "SK 048/2024 I.16 dataArsip; SIPP arsip, perkara_putusan",
    koleksi: ["arsip"],
    butuhPejabat: false,
    selaluTampil: false,
  },
  {
    kunci: "panitera.salinan-tte",
    peran: "panitera",
    judul: "Salinan putusan e-Court menunggu TTE panitera",
    tersedia: false,
    sebab:
      "Datanya (aleta_bot_ecourt_putusan: panitera_tte, dokumen_ada) hanya terisi oleh penarikan putusan e-Court, yang berhenti setiap kali sesi e-Court mati karena captcha; di basis data setempat tabelnya 0 baris sehingga aturannya belum pernah dapat diukur. Angka basi akan tampak seperti nol tunggakan.",
  },
  {
    kunci: "panitera.panggilan-belum-patut",
    peran: "panitera",
    judul: "Sidang 3 hari ke depan yang pihaknya belum dipanggil",
    tersedia: true,
    masuk:
      "Sidang hari ini sampai 3 hari ke depan (seluruh satker), belum putus, dengan pihak wajib dipanggil yang belum punya relaas (keadaanPanggilanSidang). Kepatutan tenggang per jalur BELUM dinilai - lihat panitera-pengganti.tanggal-tunda-terlalu-dekat.",
    tenggat: "Tanggal sidang - 3 hari.",
    selesai: "Relaas untuk sisi itu ada.",
    selesaiHariIni: null,
    kerjakan: { tujuan: "sipp", halaman: "relaas" },
    sumber: "keadaanPanggilanSidang; SIPP perkara_pelaksanaan_relaas",
    koleksi: ["sidangPanggilan"],
    butuhPejabat: false,
    selaluTampil: false,
  },

  // ==========================================================================
  // KETUA / WAKIL KETUA
  // ==========================================================================
  {
    kunci: "ketua.pmh-hari-ini",
    peran: "ketua",
    judul: "Tetapkan majelis (PMH) perkara yang baru masuk",
    tersedia: true,
    masuk: "Perkara terdaftar 30 hari terakhir yang belum punya baris perkara_hakim_pn sama sekali.",
    tenggat: "Hari pendaftaran (SK 048/2024 Tabel 2 I.2: hari yang sama bernilai 5).",
    selesai: "PMH tercatat.",
    selesaiHariIni: "PMH diinput hari ini.",
    kerjakan: { tujuan: "sipp", halaman: "penetapan" },
    sumber: "SK 048/2024 I.2 penetapanMajelis; SIPP perkara, perkara_hakim_pn; aleta_sipp_penunjukan_antrean",
    koleksi: ["pmh"],
    butuhPejabat: false,
    selaluTampil: false,
  },
  {
    kunci: "ketua.majelis-berhalangan",
    peran: "ketua",
    judul: "Majelis yang berhalangan pada sidang hari ini",
    tersedia: false,
    sebab:
      "Satu-satunya sumber halangan hakim adalah cuti di e-Kepegawaian ALETA (hr_leave_requests), dan belum terbukti seluruh hakim mengajukan cutinya di sana. Tanpa itu, ketiadaan butir akan terbaca 'majelis lengkap' padahal hanya 'tidak tercatat'.",
  },
  {
    kunci: "ketua.lima-bulan-per-majelis",
    peran: "ketua",
    judul: "Perkara mendekati atau melewati 5 bulan",
    tersedia: true,
    masuk: "Perkara belum putus seluruh satker yang hari ke-150-nya jatuh dalam 7 hari atau sudah lewat; majelisnya disebut.",
    tenggat: "Tanggal daftar + 149 hari + hari mediasi.",
    selesai: "Perkara putus.",
    selesaiHariIni: null,
    kerjakan: { tujuan: "sipp", halaman: "jadwal-sidang" },
    sumber: "SEMA 2/2014; durasiBanyakPerkara",
    koleksi: ["berjalan"],
    butuhPejabat: false,
    selaluTampil: false,
  },
  {
    kunci: "ketua.hasil-sidang-belum-dicatat",
    peran: "ketua",
    judul: "Sidang yang hasilnya belum dicatat",
    tersedia: true,
    masuk: "Sidang 14 hari terakhir sampai hari ini (seluruh satker) yang hasilnya belum dicatat; majelisnya disebut.",
    tenggat: "Pukul 15.00 WITA pada hari sidang.",
    selesai: "Hasil sidangnya tercatat.",
    selesaiHariIni: "Sidang hari ini yang hasilnya sudah tercatat.",
    kerjakan: { tujuan: "sipp", halaman: "jadwal-sidang" },
    sumber: "SK 048/2024 III.1; lib/keadaan-sidang.ts",
    koleksi: ["sidang"],
    butuhPejabat: false,
    selaluTampil: false,
  },
  {
    kunci: "ketua.ikrar-akta",
    peran: "ketua",
    judul: "Ikrar talak dan akta cerai yang tertahan",
    tersedia: true,
    masuk:
      "Seluruh satker: aturan hakim.ikrar-talak (a) dan (b), ditambah akta cerai yang belum terbit (aturan panitera.akta-cerai-belum-terbit).",
    tenggat: "Sama dengan kedua aturan itu.",
    selesai: "Sama dengan kedua aturan itu.",
    selesaiHariIni: "Penetapan sidang ikrar, ikrar, atau akta bertanggal hari ini.",
    kerjakan: { tujuan: "sipp", halaman: "akta-cerai" },
    sumber: "Pasal 70 UU 7/1989; SK 048/2024 II.4",
    koleksi: ["ikrar", "penjaga:akta-cerai-gugat", "penjaga:akta-cerai-talak", "aktaHariIni"],
    butuhPejabat: false,
    selaluTampil: false,
  },
  {
    kunci: "ketua.sidang-terancam-panggilan",
    peran: "ketua",
    judul: "Sidang 3 hari ke depan terancam gagal karena panggilan",
    tersedia: true,
    masuk:
      "Sidang hari ini sampai 3 hari ke depan (seluruh satker), belum putus, dengan pihak wajib dipanggil tanpa relaas; juru sitanya disebut.",
    tenggat: "Tanggal sidang - 3 hari.",
    selesai: "Relaas untuk sisi itu ada.",
    selesaiHariIni: null,
    kerjakan: { tujuan: "sipp", halaman: "relaas" },
    sumber: "keadaanPanggilanSidang",
    koleksi: ["sidangPanggilan"],
    butuhPejabat: false,
    selaluTampil: false,
  },

  // ==========================================================================
  // PTSP
  // ==========================================================================
  {
    kunci: "ptsp.ecourt-belum-register",
    peran: "ptsp",
    judul: "Register pendaftaran e-Court yang sudah dibayar",
    tersedia: true,
    masuk: "Pendaftaran e-Court yang dibayar 30 hari terakhir dan belum bernomor perkara.",
    tenggat: "Hari pembayaran (SK 048/2024 Tabel 2 I.1: hari yang sama bernilai 5).",
    selesai: "Nomor perkara terisi.",
    selesaiHariIni: "Didaftarkan hari ini.",
    kerjakan: { tujuan: "sipp", halaman: "pendaftaran-online" },
    sumber: "SIPP perkara_efiling",
    koleksi: ["efiling"],
    butuhPejabat: false,
    selaluTampil: false,
  },
  {
    kunci: "ptsp.panjar-habis",
    peran: "ptsp",
    judul: "Panjar habis atau menipis sebelum sidang",
    tersedia: true,
    masuk:
      "Perkara belum putus (bukan prodeo) yang bersidang dalam 7 hari dan saldo panjarnya di bawah Rp100.000 (AMBANG_PANJAR_TIPIS, rumus penandaSippService).",
    tenggat: "Tanggal sidang itu.",
    selesai: "Saldo panjar kembali mencapai ambang.",
    selesaiHariIni: null,
    kerjakan: { tujuan: "sipp", halaman: "keuangan" },
    sumber: "SIPP perkara_biaya",
    koleksi: ["panjar"],
    butuhPejabat: false,
    selaluTampil: false,
  },
  {
    kunci: "ptsp.data-umum-belum-lengkap",
    peran: "ptsp",
    judul: "Lengkapi nomor telepon pihak pertama",
    tersedia: true,
    masuk:
      "Perkara terdaftar 14 hari terakhir yang pihak pertamanya belum bertelepon - nomor itulah jalur WA hari sidang dan e-Summons. Isian Data Umum lainnya belum dibakukan mana yang wajib, jadi tidak ditagih.",
    tenggat: "Hari pendaftaran.",
    selesai: "Telepon seluruh pihak pertama terisi.",
    selesaiHariIni: "Perkara terdaftar hari ini dengan telepon lengkap.",
    kerjakan: { tujuan: "sipp", halaman: "perkara" },
    sumber: "SK 048/2024 III validasi data; SIPP perkara_pihak1, pihak",
    koleksi: ["telepon"],
    butuhPejabat: false,
    selaluTampil: false,
  },
  {
    kunci: "ptsp.sisa-panjar",
    peran: "ptsp",
    judul: "Kembalikan atau catat sisa panjar perkara putus",
    tersedia: true,
    masuk: "Perkara yang putus 12 bulan terakhir dan saldo panjarnya masih lebih dari Rp1.000 (AMBANG_SISA_RUPIAH).",
    tenggat: "Tanggal putusan (sisa panjar dikembalikan sesudah perkara diputus).",
    selesai: "Saldo panjar tidak lagi lebih dari Rp1.000.",
    selesaiHariIni: "Transaksi keluar yang menutup saldonya diinput hari ini.",
    kerjakan: { tujuan: "sipp", halaman: "keuangan" },
    sumber: "SK 048/2024 I.15 sisaPanjar; KU04; SIPP perkara_biaya",
    koleksi: ["sisaPanjar"],
    butuhPejabat: false,
    selaluTampil: false,
  },
  {
    kunci: "ptsp.akta-belum-unggah",
    peran: "ptsp",
    judul: "Unggah dokumen akta cerai",
    tersedia: true,
    masuk: "Akta cerai yang terbit 60 hari terakhir tanpa dokumen akta (akta_cerai_dok).",
    tenggat: "Tanggal akta + 1 hari (SK 048/2024 II.4).",
    selesai: "akta_cerai_dok terisi.",
    selesaiHariIni: "Akta bertanggal hari ini yang dokumennya sudah ada.",
    kerjakan: { tujuan: "sipp", halaman: "akta-cerai" },
    sumber: "SIPP perkara_akta_cerai",
    koleksi: ["akta"],
    butuhPejabat: false,
    selaluTampil: false,
  },
  {
    kunci: "ptsp.penyerahan-akta",
    peran: "ptsp",
    judul: "Penyerahan akta cerai dicatat untuk kedua pihak",
    tersedia: false,
    sebab:
      "Tanggal penyerahan kosong pada 318 dari 386 akta untuk pihak pertama dan 377 untuk pihak kedua (2026). Tidak dapat dibedakan antara akta yang memang belum diambil dan penyerahan yang tidak dicatat, dan pengambilan akta tidak punya tenggat yang dapat ditagih.",
  },
  {
    kunci: "ptsp.kehadiran-belum-dicatat",
    peran: "ptsp",
    judul: "Kehadiran pihak tercatat sebelum sidang dibuka",
    tersedia: false,
    sebab:
      "Ketiadaan catatan kehadiran di antrian (aleta_bot_antrian_kehadiran) tidak dapat dibedakan dari pihak yang memang tidak datang. Butir yang menagihnya akan menagih orang yang tidak hadir.",
  },

  // ==========================================================================
  // OPERATOR
  // ==========================================================================
  {
    kunci: "operator.sesi-ecourt",
    peran: "operator",
    judul: "Tarikan e-Court berhenti: buka ulang sesi",
    tersedia: true,
    masuk:
      "Penjadwal tarikan e-Court mati, atau tarikan berhasil terakhir (status 'selesai') lebih tua dari dua kali jarak jamnya, pada jam kerja penjadwal.",
    tenggat: "Tarikan berhasil terakhir + 2 x jarak jam.",
    selesai: "Ada tarikan berhasil yang lebih baru.",
    selesaiHariIni: null,
    kerjakan: { tujuan: "aleta", alamat: ALAMAT_ALETA.adminEcourt },
    sumber: "aleta_bot_ecourt_sync_runs; ecourtSchedulerService.getSettings",
    koleksi: ["ecourt"],
    butuhPejabat: false,
    selaluTampil: false,
  },
  {
    kunci: "operator.wa-pagi",
    peran: "operator",
    judul: "Gerbang WhatsApp dan pengingat pagi terkirim",
    tersedia: false,
    sebab:
      "Belum dipastikan cron pengingat lama benar-benar berbunyi di server (dapat dilewati diam-diam oleh registry takeover atau production guard), sehingga 'tidak ada pesan terkirim' belum dapat dibedakan dari 'memang tidak dijadwalkan'.",
  },
  {
    kunci: "operator.penetapan-gagal",
    peran: "operator",
    judul: "Penetapan ALETA yang gagal ditulis ke SIPP",
    tersedia: true,
    masuk:
      "Jejak penetapan 3 hari terakhir yang gagal (berhasil 0, bukan kering) dan belum disusul tulisan berhasil untuk perkara dan jenis yang sama.",
    tenggat: "Hari kegagalan itu.",
    selesai: "Ada tulisan berhasil sesudahnya.",
    selesaiHariIni: "Tulisan berhasil susulannya terjadi hari ini.",
    kerjakan: { tujuan: "sipp", halaman: "penetapan" },
    sumber: "aleta_bot_jejak_penetapan",
    koleksi: ["penetapanGagal"],
    butuhPejabat: false,
    selaluTampil: false,
  },
  {
    kunci: "operator.direktori-gagal",
    peran: "operator",
    judul: "Antrean Direktori Putusan yang gagal",
    tersedia: true,
    masuk: "Antrean dirput_antrian berstatus gagal (pembaca penjaga tenggat dirput-gagal).",
    tenggat: "Tanggal percobaan terakhir (ATURAN_TENGGAT dirput-gagal, batas 0 hari).",
    selesai: "Antrean terkirim.",
    selesaiHariIni: null,
    kerjakan: { tujuan: "sipp", halaman: "putusan" },
    sumber: "SIPP dirput_antrian",
    koleksi: ["penjaga:dirput-gagal"],
    butuhPejabat: false,
    selaluTampil: false,
  },
  {
    kunci: "operator.cadangan",
    peran: "operator",
    judul: "Cadangan SIPP, portal, dan basis data bot",
    tersedia: false,
    sebab:
      "sys_backup hanya mencatat cadangan lewat menu SIPP (empat kali sepanjang 2026), bukan cadangan lain; basis data bot tidak punya skrip cadangan sama sekali; skrip cadangan portal mencetak 'selesai' walau pg_dump gagal. Tidak ada sumber yang membuktikan cadangan berhasil.",
  },
  {
    kunci: "operator.versi-peladen",
    peran: "operator",
    judul: "Versi server dan ekstensi mutakhir",
    tersedia: false,
    sebab:
      "Server tidak tahu versi repo terbaru, dan versi ekstensi yang terpasang di tiap peramban tidak pernah dilaporkan ke server. Tidak ada pembanding yang dapat dibaca.",
  },
];

export const PETA_KATALOG: ReadonlyMap<string, JenisKatalog> = new Map(
  KATALOG_CHECKLIST.map((j) => [j.kunci, j])
);

export function katalogPeran(peran: KunciPeran): JenisKatalog[] {
  return KATALOG_CHECKLIST.filter((j) => j.peran === peran);
}

/** Kunci jenis tanpa awalan peran: "hakim.konsep-putusan" -> "konsep-putusan". */
export function jenisPendek(kunci: string): string {
  const i = kunci.indexOf(".");
  return i >= 0 ? kunci.slice(i + 1) : kunci;
}

export function peranSah(nilai: unknown): nilai is KunciPeran {
  return typeof nilai === "string" && (KUNCI_PERAN as readonly string[]).includes(nilai);
}

// Dipakai katalog hakim - dibiarkan sebagai konstanta supaya ujinya dapat
// menegaskan jenis mana yang menuntut pemetaan jabatan.
export const JABATAN_SIPP_PERAN: Record<KunciPeran, string[]> = {
  hakim: SIPP_HAKIM,
  "panitera-pengganti": ["panitera"],
  jurusita: ["jurusita"],
  panitera: [],
  ketua: [],
  ptsp: [],
  operator: [],
};
