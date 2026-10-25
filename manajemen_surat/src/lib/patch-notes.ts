export const APP_VERSION = "2.41.0";
export const APP_VERSION_LABEL =
  "ALETA Judicia v2.41.0 - Oktober 2026";

export type PatchNote = {
  version: string;
  title: string;
  date: string;
  status: string;
  summary: string;
  added: string[];
  changed: string[];
  fixed: string[];
  security: string[];
  operationalNotes: string[];
  knownLimitations: string[];
  details?: Array<{
    title: string;
    items: string[];
  }>;
};

export const PATCH_NOTES: PatchNote[] = [
  {
    version: "2.41.0",
    title: "ALETA Judicia v2.41.0 - Oktober 2026",
    date: "2026-10-18",
    status: "Belum terpasang",
    summary:
      "Rangkuman pembaruan portal sejak v2.40.1 (28 September 2026) sampai rilis ekstensi 1.205.39 (25 Oktober 2026). Selama Oktober versi portal tidak dinaikkan sehingga kartu ini tertinggal; rinciannya per rilis ada di Catatan Ekstensi SIPP di bawah. Pokoknya: masuk ALETA dengan akun SIPP, Blangko ABT by Derry Briantono lengkap untuk semua jenis perkara yang ada, Putusan Advance dan draf putusan H-7, ikrar talak dari penetapan sampai e-Doc, sesi e-Court yang pulih sendiri lewat WhatsApp, Kasir otomatis, SKP semua jabatan, susun keterangan saksi dan panduan pertanyaan saksi untuk semua jenis perkara, hari libur yang tidak bisa dipilih, penetapan satu klik, antrean jam kerja, Status Perkara Seamless, serta tampilan yang menyesuaikan HP sampai TV.",
    added: [
      "Masuk ALETA dengan akun SIPP: nama dan sandi SIPP dicocokkan langsung ke SIPP tanpa menyimpan sandi; SIPP dan ABT terbuka otomatis sesudah masuk.",
      "Blangko ABT by Derry Briantono: putusan dan BAS berpasangan per jenis perkara (menu 'Jenis - Putusan' / 'Jenis - BAS'), isian, bukti, tanya jawab, pratinjau dan cetak; identitas satker terisi otomatis sehingga blangko berlaku untuk satker mana pun.",
      "Blangko Saya: Super Admin dapat menyimpan dan mengelola blangko sendiri di ALETA.",
      "Putusan Advance untuk semua jenis perkara dan agen draf putusan H-7: draf putusan utuh disiapkan sebelum sidang putus, dengan varian kabul dan tolak.",
      "Ikrar talak lengkap: tunda (+14 hari, batas 6 bulan sejak BHT) dan putus dari Jadwal Sidang, form Penetapan Ikrar Talak di SIPP terisi saat perkara dibuka, penetapan disusun dari blangko lalu diunggah sebagai e-Doc atas akun ketua majelis, biaya ikrar diambil dari biaya perkara.",
      "Sesi e-Court pulih sendiri saat server menyala; captcha dijawab petugas lewat WhatsApp, perintah e-Court dari chat, dan riwayat login WhatsApp untuk Super Admin dan Admin.",
      "Isian e-Litigasi terisi otomatis dari data e-Court (Tergugat terdaftar = e-litigasi, tanpa email = hybrid), isian manual tetap menang.",
      "Kasir otomatis bersaklar dengan rekap, usulan per kejadian, dan jurnal; tambahan panjar dipilih kasir.",
      "SKP semua jabatan dan eviden SKP hakim dari data SIPP; Fitur Satker untuk mengatur fitur per satker.",
      "Jawab-menjawab dari e-Court (jawaban, replik, duplik, kesimpulan) dikenali otomatis: isian lisan atau tertulis terisi sendiri, rekonvensi, kesimpulan, dan pokok jawaban diusulkan ke blangko beserta kutipan asalnya.",
      "Susun keterangan saksi menurut keadaan perkara untuk 22 kumpulan jenis perkara (cerai beserta kumulasi, itsbat, dispensasi kawin, PAW, perwalian, harta bersama, kewarisan, wali adhal, wasiat, poligami, pembatalan dan pencegahan perkawinan, asal usul anak, hak asuh, Penguasaan Anak, nafkah anak, ekonomi syariah, pengangkatan anak, permohonan umum) dengan tujuh jenis keterangan termasuk ragu, dan kalimat saksi yang tidak pernah sama; termasuk keterangan anak, calon, dan orang tua pada dispensasi kawin serta saksi yang diajukan Tergugat pada harta bersama dan kewarisan.",
      "Kembaran laptop hanya-baca untuk bekerja saat server mati, dan tutorial per fitur lewat tombol '?' di tiap halaman.",
      "Peringatan sisa blangko saat mengunggah putusan, BAS, atau relaas ([ ], titik-titik, placeholder, teks merah) beserta unduhan daftarnya.",
    ],
    changed: [
      "Tampilan semua halaman menyesuaikan HP, tablet, laptop kecil dan besar, sampai TV 40-65 inci; panel ekstensi SIPP menempel di kanan mulai layar 900 px dan ukurannya ikut layar.",
      "Panel ekstensi menyebut isian dengan namanya, bukan kode angka; kode hanya tampil saat kursor diarahkan.",
      "Menu dan hak per peran: tiap peran melihat menu, widget, dan tombol yang menjadi tugasnya; peran utama ditautkan pengguna, alat hanya sub-peran.",
      "Penetapan PMH/PPP/PJS/PHS tercatat atas akun SIPP pejabat yang dipilih; tunda dan putusan Jadwal Sidang atas PP perkara.",
      "Unduhan tidak lagi diblokir dan bernama baku; salinan putusan memuat tanda SALINAN di kiri atas.",
      "Deteksi isi dari SIPP dan input ke ABT diperluas ke semua jenis perkara, termasuk kumulasi, KTP, pekerjaan pihak, kuasa, saksi, dan huruf alasan cerai.",
    ],
    fixed: [
      "Isian e-Litigasi yang tertulis 'ISI DULU' tidak lagi muncul pada perkara e-Court yang datanya tersedia.",
      "Perkara non-cerai tidak lagi dikenali sebagai cerai saat menyusun keterangan saksi.",
      "Tidak ada lagi kata atau penanda ALETA yang terbawa ke SIPP, e-Doc, maupun berkas ABT.",
      "Puluhan perbaikan dari uji nyata 9 Oktober dan audit menyeluruh 17 Oktober (rincian per rilis di Catatan Ekstensi SIPP).",
    ],
    security: [
      "Sandi SIPP tidak pernah disimpan maupun ditampilkan; pencocokan dilakukan ke SIPP saat masuk.",
      "NIK dan nama pihak disamarkan pada unggahan anonim; jejak tindakan otomatis tercatat jujur di tabel ALETA.",
      "Captcha e-Court selalu dijawab manusia; ALETA tidak memecahkan captcha.",
    ],
    operationalNotes: [
      "Paket server: aleta-update-2.41.0-ekst1.205.7.tar.gz. Migrasi basis data baru (0073 Blangko Saya, 0074 riwayat login WhatsApp) berjalan hanya dengan ALETA_RUN_DB_MIGRATIONS=1.",
      "Paket blangko ABT i7-i28 dipasang terpisah menurut urutan pemasangan; sapu penanda dan penetral basis data ABT dipasang paling akhir.",
      "Ekstensi Chrome dimuat dari folder unduhan dan disalin tiap rilis.",
    ],
    knownLimitations: [
      "Tampilan panel ekstensi baru diukur di replika; perlu dicoba di Chrome kantor (1366 px, zoom 100/125/150%).",
      "Jenis perkara yang belum punya blangko Derry (13 jenis SIPP serta zakat, eksekusi, verzet) masih memakai blangko ABT bawaan.",
      "Rujukan Buku II, HIR/RBg, dan KHES yang belum dapat dicocokkan ke naskah resmi tidak dicetak di keterangan saksi.",
    ],
  },
  {
    version: "2.40.1",
    title: "ALETA Judicia v2.40.1 - Tata Letak Jadwal dan Antrian Sidang",
    date: "2026-09-28",
    status: "Belum terpasang",
    summary:
      "Permintaan pengguna 28 September 2026: layar Jadwal/Antrian Sidang selebar kepala dan kaki halaman, tanpa gulir ke samping, dan seluruh baris sidang memanjang ke bawah halaman - bukan tersembunyi di kotak bergulir.",
    added: [],
    changed: [
      "Legenda 'Tiga angka waktu...' dihapus; arti tiap angka ada di keterangan saat kursor diarahkan.",
      "Tunggu / Dari sebelumnya / Lama sidang menjadi pil kecil berlabel ('Tunggu 1j 19m', 'Dari sblm pertama', 'Lama 7m'); kolom Antrian menyempit dari 209 px menjadi 130-159 px. Detak hidup, warna ambang 40/60 menit, dan pembandingnya tetap.",
      "Kartu jadwal sejajar tepi kepala dan kaki halaman; isi sel melipat sehingga tabel pas selebar kartu pada 1366, 1440, dan 1920 px (dahulu tabel 1.590 px menggulir ke samping).",
      "Tombol konseptor sementara tidak lagi terpotong: nama lengkap tampil dan melipat di dalam selnya.",
    ],
    fixed: [
      "Baris sidang 'terlewat di bawah footer': tabel dibatasi 70% tinggi layar dan menggulir sendiri. Kini tabel setinggi isinya, halaman yang menggulung, dan kepala kolom tetap menempel di puncak layar.",
      "Pilihan Ringkas/Lengkap kini diingat peramban - dahulu nilai bawaan Lengkap tertulis sebelum pilihan lama sempat dibaca, sehingga selalu kembali ke Lengkap.",
    ],
    security: [],
    operationalNotes: ["Hanya portal yang dibangun ulang; tanpa migrasi, tanpa perubahan bot dan ekstensi."],
    knownLimitations: [
      "Pada 1280 px dengan kedua sidebar terbuka tabel masih menggulir ke samping di dalam kartu (menciutkan sidebar membuatnya muat).",
    ],
  },
  {
    version: "2.40.0",
    title: "ALETA Judicia v2.40.0 - Eviden SKP Hakim, Majelis Ikrar, Riwayat Pihak, dan Peta Perkara",
    date: "2026-09-27",
    status: "Belum terpasang",
    summary:
      "Permintaan pengguna 27 September 2026. Bukti dukung SKP hakim (eKinerja) kini diunduh dari Rekap Hakim dalam PDF, Excel, dan Word langsung dari data SIPP - lengkap dengan kop dan tanda tangan (kiri hakim, kanan Ketua). Status Perkara memisahkan majelis pemeriksa dari majelis ikrar talak dan memberi penanda riwayat pada nama para pihak. Peta Perkara tidak lagi kosong saat layar penuh, bulatannya sebanding jumlah perkara, dapat dipilih per golongan, dan bergaris batas kecamatan.",
    added: [
      "Unduh eviden SKP hakim - tombol 'Unduh eviden SKP' di Rekap Hakim membuka pop up: periode (Triwulan I-IV atau Tahunan), tahun, tanggal tanda tangan, lalu tiap dokumen dengan tombol PDF / Excel / Word dan 'Unduh semua (ZIP)'. Dokumennya: lembar Status Perkara 25 kolom (bentuk spreadsheet SKP) dan 13 rekap bukti dukung sesuai kolom Realisasi eKinerja - Perkara, Minutasi, Musyawarah Majelis, Mediasi, Sidang Keliling, E-Court, Isbat Terpadu, Pelaksanaan Ikrar Talak, Salinan Putusan terunggah, Prodeo, Direktori Putusan MA, Selesai Prosedur dan Minutasi, Upaya Hukum. Tiap dokumen memuat kop, identitas hakim, RHK dengan realisasi Kuantitas/Kualitas/Waktu beserta dasar hitungnya, tabel perkara, dan tanda tangan kiri hakim - kanan 'Mengetahui, Ketua Pengadilan Agama Donggala'. Posbakum, SIPINTAR/Bimtek, dan Hawasbid bukan data SIPP dan tampil nonaktif.",
      "Status Perkara, Para pihak - penanda 'cerai N×' bila orang itu bercerai lebih dari sekali (hanya perkara yang akta cerainya sudah terbit) dan 'N perkara terkait' (mis. cerai lalu harta bersama); menekan angkanya membuka daftar nomor perkara beserta dasar pencocokannya. Orang yang sama dikenali lewat pihak_id, NIK sah berpenguat, nama + tanggal lahir, atau pasangan nama - nama saja tidak pernah dipakai. Dimuat hanya saat bagian Para pihak dibuka.",
      "Peta Perkara - pilihan tampilan bulatan: Semua perkara, Cerai, Dispensasi kawin, Itsbat nikah, Lainnya; lapisan kecamatan dengan garis batas, nama, dan jumlah perkara saat peta diperbesar (garis resmi OpenStreetMap bila ada, selebihnya batas perkiraan dari titik desa yang diberi label).",
    ],
    changed: [
      "Kolom Majelis di Status Perkara kini majelis PEMERIKSA - yang menjabat pada hari putusan - dan majelis ikrar talak (hakim, panitera, juru sita ikrar) tampil sebagai blok tersendiri. SIPP menonaktifkan majelis pemeriksa begitu majelis ikrar ditetapkan, sehingga dahulu cerai talak yang sudah ikrar menampilkan majelis ikrar sebagai majelis perkara (susunan berubah pada 245 perkara). Aturan yang sama dipakai Rekap Petugas dan eviden SKP.",
      "Bulatan Peta Perkara sebanding jumlah perkara (luas mengikuti jumlah, 4-36 px) dengan keterangan ukuran berangka.",
    ],
    fixed: [
      "Peta Perkara kosong saat layar penuh: React menulis ulang kelas wadah yang juga dipakai Leaflet, sehingga ubin peta mengerut menjadi lebar 0.",
      "Tanda </br> mentah di isian majelis bagian Ikrar talak Status Perkara.",
      "Perkara yang majelisnya tidak terbaca tidak lagi diperingatkan 'Majelis belum ditetapkan' (11 perkara).",
    ],
    security: [
      "Rute baru (eviden SKP, unduhan, riwayat pihak) memeriksa kewenangan sebelum data; NIK dan tanggal lahir tidak pernah dikirim ke peramban; pembacaan riwayat pihak dicatat di jejak audit.",
    ],
    operationalNotes: [
      "Citra bot DAN portal wajib dibangun ulang (rute /sipp/eviden-skp, /sipp/riwayat-pihak, majelisPemeriksaService, golongan peta). Tidak ada migrasi baru (nomor bebas berikutnya 0052).",
      "Kop eviden dibaca dari Identitas Instansi ALETA - isi alamat dan telepon kantor supaya lengkap. NIP Ketua di sys_config SIPP (KetuaPNNIP) hanya 17 angka; ALETA melengkapinya dari data hakim, sebaiknya dibetulkan di SIPP.",
    ],
    knownLimitations: [
      "OpenStreetMap tidak punya batas kecamatan Donggala dan Sigi - wilayah sendiri memakai batas perkiraan dari titik desa.",
      "SIPP hanya mencatat musyawarah majelis lewat agenda sidang (71 dari 683 putusan 2026); rekap musyawarah mengikuti yang tercatat.",
      "Menunggu keputusan pengguna: rumus Kualitas tiap rekap, bunyi RHK/indikator, baris kop Ditjen/PTA, tanggal tanda tangan bawaan, dan beberapa lainnya (papan keputusan).",
      "Belum diuji di peramban dan SIPP server sungguhan; berkas Word/Excel belum dibuka di Office.",
    ],
  },
  {
    version: "2.39.0",
    title: "ALETA Judicia v2.39.0 - Tiga Jarak Waktu Sidang, Halaman Perkara SIPP, dan Rekap Petugas",
    date: "2026-09-27",
    status: "Belum terpasang",
    summary:
      "Sepuluh permintaan pengguna 27 September 2026. Jadwal Sidang kini menghitung tiga jarak waktu yang berdetak dan ALETA menyimpan sendiri waktu antrean yang tidak disimpan aplikasi antrean. Status Perkara mencetak dengan terbaca, membuka dan menyalin tautan HALAMAN PERKARA di SIPP, menyalin ringkasan lengkap, dan nama majelis, panitera, juru sita, serta mediator membuka rekap orangnya. Jadwal Mediasi menyebut Mediator Hakim/Non Hakim dengan benar dan menyusun para pihak utuh. Bersama ekstensi 1.171.0: tombol unduh berkas e-Court terlihat di mode terang, dan panel ALETA tidak lagi tampil di layar publik portal.",
    added: [
      "Jadwal Sidang - tiga jarak waktu berlabel menggantikan lencana '+X'/'→Y' yang membingungkan: TUNGGU (dari mengambil nomor antrean sampai dipanggil bersidang), DARI SEBELUMNYA (sejak perkara sebelumnya di ruang yang sama dipanggil; perkara pertama di ruangnya tertulis 'pertama', bukan nol), dan LAMA SIDANG (sampai perkara berikutnya di ruang yang sama dipanggil; yang sedang berlangsung 'berjalan', hari lampau tanpa perkara berikutnya 'tidak diketahui'). Angka yang berjalan berdetak tiap detik tanpa melukis ulang tabel, dan 'sekarang' diambil dari jam basis data antrean, bukan jam PC. Dihitung atas SELURUH perkara hari itu di ruang yang sama - bukan baris yang kebetulan tampil - dan tetangga pembandingnya disebut saat kursor diarahkan ke angka.",
      "Buku waktu antrean milik ALETA. Aplikasi antrean hanya menyimpan hari berjalan dan menimpa jam sidang saat perkara dipanggil, sehingga waktu antrean hilang. Pencatat di bot (tiap 30 detik, Senin-Jumat 07.00-18.00 WITA) menyimpan waktu ambil nomor tiap pihak, jam jadwal asli, panggilan pertama dan terakhir, serta jumlah panggil ke tabel aleta_bot_antrian_waktu; rekaman antrean portal mendapat delapan kolom berdetik (migrasi 0051). Ketiga jarak kini tetap ada untuk hari yang sudah lewat.",
      "Status Perkara - 'Buka SIPP' dan 'Salin tautan' menuju HALAMAN PERKARA di SIPP (pintu masuk perkara_detil_agama yang sama dengan daftar perkara SIPP), bukan beranda ALETA/SIPP. Alamatnya dibangkitkan bot persis seperti SIPP menyandikan nomor perkaranya; diuji silang dengan PHP 5.6 dan pustaka SIPP sendiri (600/600 cocok) dan atas 39 perkara nyata. Bila alamatnya tidak tersedia, sebabnya disebut dan tombolnya jujur berganti menjadi 'Buka SIPP (beranda)' dan 'Salin tautan ALETA'.",
      "Status Perkara - 'Salin ringkasan' kini lengkap dan tetap enak ditempel ke WhatsApp: identitas perkara, para pihak beserta kuasa per kedudukan (sebutannya menurut nomor alur DAN jenis perkara), majelis, panitera pengganti, juru sita, keadaan, lama perkara, sidang, mediasi, putusan, BHT/akta cerai, biaya, nilai kelengkapan, perlu tindakan, dan alamat halaman SIPP.",
      "Rekap petugas - nama hakim, panitera pengganti, juru sita, dan mediator (hakim maupun non hakim) di Status Perkara membuka TAB BARU berisi rekap orang itu: jumlah perkara per peran, tahun, dan jenis; keadaan proses/putus/BHT; hasil putusan; lama perkara (batas lima bulan, dikurangi mediasi) dan persentase selesai ≤150 hari; verstek; e-Court; untuk mediator hasil mediasi, lama mediasi, dan yang melewati 30 hari (PERMA 1/2016 Pasal 24); beserta daftar perkaranya. Tiap persentase menyebut pembilang dan penyebutnya; orangnya dikenali lewat peran dan ID SIPP, bukan nama. Pemeriksa perkara yang sudah putus adalah yang MENJABAT PADA HARI PUTUSAN - SIPP menonaktifkan majelis pemeriksa begitu majelis ikrar ditetapkan, dan kadang mencatat pengganti sesudah putusan - sedangkan majelis, panitera, dan juru sita ikrar talak dicatat sebagai kedudukan tersendiri.",
    ],
    changed: [
      "Jadwal Mediasi - status mediator 'H' ditulis 'Mediator Hakim', selainnya 'Mediator Non Hakim', dan status yang tidak diisi 'Status mediator belum tercatat' - di sel, rincian, chip saringan, hitungan, dan pencarian. Nama mediator ganda dipecah (dulu '<br/>' tertulis mentah).",
      "Jadwal Mediasi - di bawah nomor perkara para pihak disebut utuh dan bersusun: pihak pertama lalu pihak kedua (turut tergugat di baris sendiri), dengan sebutan menurut alur dan jenis perkara - 268 perkara cerai talak dan izin poligami yang bernomor Pdt.G bersebutan Pemohon/Termohon.",
      "Cetak Status Perkara terbaca di tema terang MAUPUN gelap: median kontras teks pada layar bertema gelap naik dari 1,44 menjadi 8,28 (tidak satu teks aktif pun di bawah 4,5:1); lencana tetap berwarna; menu, kepala portal, dan bilah alat tidak ikut tercetak; bagian yang terciut ditandai '(terciut)'. Lembar cetak lain tidak berubah.",
      "Identitas perkara dari bot membawa jenis_perkara_id, supaya ringkasan salin menyebut para pihak dengan pasti.",
    ],
    fixed: [
      "Chip saringan Jadwal Mediasi menghitung mediator hakim sebagai 'non-hakim': aturan lama mencari KATA 'hakim' pada SANDI 'H' yang disimpan SIPP.",
      "Tautan dari 'Salin tautan' (/aleta-ecourt?perkara=...) selalu mendarat di Dasbor karena ?perkara= tidak pernah dibaca; kini perkaranya langsung terbuka di Status Perkara.",
      "Membuka Jadwal Sidang hari lampau menimpa rekaman antrean hari itu dengan nomor kosong.",
      "Tombol salin di server satker (http, bukan konteks aman) kini memakai jalan cadangan; bila tetap gagal, teksnya ditampilkan terpilih untuk Ctrl+C.",
      "Tombol unduh berkas e-Court di Jadwal Sidang SIPP tidak terlihat di mode terang (ekstensi 1.171.0).",
      "Panel ALETA tampil di layar publik portal - TV ruang tunggu, layar ambil antrean, papan pintu ruang sidang, antrean tanpa login (ekstensi 1.171.0).",
    ],
    security: [
      "Kunci enkripsi SIPP dibaca bot dari config SIPP lewat mount hanya-baca yang sudah ada dan TIDAK pernah dikirim ke peramban maupun dicatat; tautan hanya membuka perkara bagi yang sudah masuk SIPP. Sebelum tautan pertama, penyandi menguji dirinya sendiri - bila gagal, tidak ada tautan sama sekali, bukan tautan ke perkara lain.",
      "Di layar publik portal, panel ALETA dan widget checklist tidak lahir dan tidak mengajukan pertanyaan 'siapa saya' yang membawa sesi petugas.",
      "Rekap petugas memakai kewenangan yang sama dengan Status Perkara (panel) dan diperiksa sebelum alamatnya; semua kuerinya SELECT berparameter.",
    ],
    operationalNotes: [
      "Migrasi 0051 (0051_rekam_antrian_detik): pasang dengan ALETA_RUN_DB_MIGRATIONS=1 lalu periksa SELECT menunggu_detik, lama_sidang_detik FROM aleta_rekam_antrian LIMIT 1.",
      "Citra bot DAN portal wajib dibangun ulang: pencatat waktu antrean, rute /sipp/tautan-perkara, /sipp/rekap-petugas, dan identitas perkara. Periksa pencatat lewat /internal/aleta-bot/antrian/waktu/status.",
      "Tautan halaman perkara SIPP tidak butuh env baru selama mount /usr/src/app/SIPP ada. Jangan taruh ALETA_SIPP_ENCRYPTION_KEY di .env bersama. Sesudah pasang, klik satu 'Buka SIPP'; bila SIPP satker menuntut index.php, setel ALETA_SIPP_BASE_URL=http://192.168.10.10/SIPP/index.php di portal.",
      "Pencatat antrean dapat diatur lewat env: ALETA_ANTRIAN_WAKTU_AKTIF=0 mematikannya; ALETA_ANTRIAN_WAKTU_JEDA_MS, ALETA_ANTRIAN_WAKTU_JAM_MULAI/_SELESAI.",
      "Ekstensi 1.171.0: tekan Reload di chrome://extensions pada tiap PC.",
    ],
    knownLimitations: [
      "Pencatat antrean mengamati tiap 30 detik: dua panggilan dalam 30 detik tercatat sekali, dan hari Sabtu tidak tercatat.",
      "Kecepatan rekap petugas baru diukur pada salinan data lokal (0,2-1,3 detik per orang), belum di server.",
      "Menunggu keputusan pengguna: siapa yang boleh membuka rekap petugas, rekaman ganda orang yang sama di SIPP, dasar lama perkara, status mediator kosong pada rekap WhatsApp, dan beberapa lainnya (papan keputusan).",
      "Belum diuji di peramban dan SIPP server sungguhan - halaman-halamannya menuntut login.",
    ],
  },
  {
    version: "2.38.0",
    title: "ALETA Judicia v2.38.0 - Checklist Milestone per Peran di Ekstensi",
    date: "2026-09-27",
    status: "Belum terpasang",
    summary:
      "Permintaan pengguna 26 September 2026: checklist pekerjaan penting tiap peran - hakim, panitera pengganti, juru sita, panitera, ketua, PTSP, dan operator - yang mengarah ke tempat mengerjakannya (contoh: hakim yang ditunjuk konseptor, termasuk konseptor sementara, diarahkan ke ABT agar putusan segera dikerjakan). Tampil sebagai widget tersendiri di ekstensi 1.170.0 dengan saklar di popup, bawaan mati. 41 jenis butir dihitung dari SIPP dan ALETA dan selesai otomatis dari data; 9 jenis yang datanya belum sahih disebut 'tidak tersedia' beserta sebabnya, bukan dikarang.",
    added: [
      "Rute portal /api/aleta-ecourt/checklist (dan rute bot /sipp/checklist-milestone): butir untuk pengguna yang masuk, menurut peran akun ALETA dan pemetaan akun SIPP ke hakim, panitera pengganti, dan juru sita. Pengguna berperan ganda (ketua yang juga hakim) dapat berganti peran di widget. Judul tiap jenis datang dari satu katalog; tiap butir membawa tujuan Kerjakan (ABT, SIPP, ALETA, e-Court), tenggat WITA, dan kelompok lewat/hari ini/minggu ini.",
      "Hakim: konsep putusan yang ditugaskan (termasuk konseptor sementara), putusan yang dibacakan tetapi belum diunggah (sampai 7 hari), penetapan hakim tunggal yang dijadwalkan putus, PHS yang menunggu ditekan, dokumen e-Court menunggu verifikasi, hasil sidang belum dicatat lewat 15.00, perkara mendekati 5 bulan, mediasi mendekati 30 hari, dan sidang ikrar talak.",
      "Panitera pengganti: BAS, hasil sidang, blangko Putusan Akhir, unggah putusan, identitas saksi, dan tunggakan BAS. Juru sita: panggilan sidang pertama, perintah panggil dari sidang yang ditunda, pihak yang belum dipanggil untuk 7 hari ke depan, PBT pihak tidak hadir, relaas belum diinput, retur, dan tunggakan PBT verstek. Panitera, ketua, PTSP, dan operator: penetapan PPP/PJS/PMH, Direktori Putusan, BHT, akta cerai, arsip, 5 bulan per majelis, ikrar, panjar, pendaftaran e-Court, dan sesi e-Court.",
      "Ukuran atas salinan data satker (sampai 10 Sep 2026): seorang hakim ketua majelis 9 butir, panitera pengganti 13, juru sita 31, panitera 213 (188 di antaranya arsip BHT), ketua 15, PTSP 33. Pada hari sidang sibuk, bilah 'selesai hari ini' terisi (panitera pengganti 32, ketua 30).",
    ],
    changed: [
      "Sidang ikrar talak ditagih ke juru sita untuk memanggil suami DAN istri (Pasal 70 ayat (3) UU 7/1989), walau perkaranya sudah putus dan kedua pihak hadir pada sidang putusan. Sebelumnya 12 dari 64 sidang ikrar 2026 tanpa relaas tidak pernah ditagih.",
      "Layanan jadwal sidang bot menerima penanda pilihan (catatGagal, wajibSemuaSisi) yang hanya dikirim checklist; bagi pemakai lain perilakunya tidak berubah.",
    ],
    fixed: [
      "Kegagalan membaca SIPP tidak lagi menjadi daftar kosong yang tampak seperti 'tidak ada pekerjaan': jenis yang datanya gagal dibaca disebut di 'tidak tersedia' dan errornya dilaporkan. Tanpa ini, satu juru sita melihat 0 butir padahal pekerjaannya 18.",
      "Kredensial SIPP yang nonaktif, belum teruji, atau dipakai dua akun tidak lagi menautkan peran; username ganda dilaporkan kepada keduanya, bukan yang terakhir menang.",
      "Kueri 'hakim_id IN ()' saat hakim belum tertaut (ditolak MariaDB) tidak lagi menghilangkan tunjukan konseptor dan titipan PHS tanpa jejak.",
      "Bila baris melampaui batas, yang dibuang yang TERTUA - bukan PBT/BHT terbaru yang justru paling mendesak - dan pemotongannya disebut.",
      "'Selesai hari ini' dihitung menurut hari WITA; titipan yang dikerjakan pukul 00.00-08.00 WITA kini terhitung.",
    ],
    security: [
      "Butir hanya perkara yang ditugaskan kepada pengguna itu, singgahan jawaban berkunci pengguna dan peran, keterangan tidak memuat nama pihak, dan rute bot dilindungi token internal. Permintaan serentak yang sama dihitung sekali tanpa membagi jawaban antarpengguna.",
    ],
    operationalNotes: [
      "Citra bot WAJIB dibangun ulang (rute /sipp/checklist-milestone), begitu pula portal. Tidak ada migrasi baru (nomor bebas berikutnya 0051).",
      "Ekstensi 1.170.0: tekan Reload di chrome://extensions. Widget bawaannya mati - tiap petugas menyalakan 'Tampilkan checklist milestone' di popup.",
      "Peran terbaca dari kredensial SIPP yang tersimpan di ALETA dan sudah teruji. Petugas yang kredensialnya belum diisi atau nonaktif mendapat kabar 'belum tertaut'.",
    ],
    knownLimitations: [
      "Sembilan jenis belum dihitung karena datanya belum sahih: penyerahan PBT ke juru sita, tanggal tunda terlalu dekat, salinan TTE e-Court, majelis berhalangan, penyerahan akta, kehadiran pihak, pengingat WhatsApp pagi, cadangan, dan versi server.",
      "Blangko ABT tidak dapat dibuka langsung (alamatnya disandikan ABT) dan tab SIPP yang dituju hanya disebut di petunjuk; keduanya menunggu keputusan pengguna.",
      "Hakim anggota belum ditagih (hanya ketua majelis/hakim tunggal) - menunggu keputusan pengguna.",
      "Panel ALETA yang lama masih tampil di layar publik portal - diajukan sebagai tugas terpisah.",
      "Belum diuji di peramban dan SIPP server sungguhan.",
    ],
  },
  {
    version: "2.37.1",
    title: "ALETA Judicia v2.37.1 - Faktor Sekunder Ekonomi Menurut Praktik Satker",
    date: "2026-09-26",
    status: "Belum terpasang",
    summary:
      "Keputusan pengguna 26 September 2026 atas dua pertanyaan terbuka 2.37.0: perkara yang pertimbangannya menyebut masalah ekonomi berpokok Perselisihan dengan Ekonomi sebagai faktor SEKUNDER (praktik satker sejak 556/Pdt.G/2025), dan bunyi nafkah kedua saksi SDG tetap satu.",
    added: [],
    changed: [
      "Blangko Putusan Akhir: bila kalimat fakta pertimbangan menyebut masalah/faktor/persoalan ekonomi dan pokoknya Perselisihan, faktor sekunder diusulkan Ekonomi. Sebelumnya Ekonomi kalah hitungan oleh 'pisah rumah' (Meninggalkan) yang disebut di hampir tiap putusan cerai - hanya 7 dari 31 putusan bermasalah ekonomi bersekunder Ekonomi. Diukur atas 960 putusan cerai dikabulkan: pokok tetap 582 benar; sekunder 116 → 117 benar (78/Pdt.G/2026 dan 21/Pdt.G/2026 kini sesuai petugas; 259/Pdt.G/2026 yang petugasnya memilih Meninggalkan kini berbeda). Keempat putusan 2026 yang petugasnya memilih Ekonomi sekunder kini diusulkan benar.",
      "Pokok yang bukan Perselisihan (misalnya huruf (b) dengan kepergian dua tahun) tidak berubah: sekundernya tetap Perselisihan. Masalah ekonomi yang hanya ada di kutipan pasal tidak dihitung.",
      "Bunyi nafkah dua saksi SDG tetap 'melalaikan kewajiban nafkah lahir' untuk keduanya (keputusan pengguna), supaya derajat faktanya sama.",
    ],
    fixed: [],
    security: [],
    operationalNotes: ["Hanya portal yang berubah; ekstensi tetap 1.169.0 dan tidak ada migrasi baru (nomor bebas berikutnya 0051)."],
    knownLimitations: [],
  },
  {
    version: "2.37.0",
    title: "ALETA Judicia v2.37.0 - Putusan Massal yang Tersimpan, Alasan Cerai yang Lebih Lengkap, dan Sumber Isian ABT yang Terukur",
    date: "2026-09-26",
    status: "Belum terpasang",
    summary:
      "Penguatan otomatisasi putusan atas permintaan pengguna 26 September 2026: penyebab perceraian dari keterangan saksi ABT, keadaan istri dan nusyuz yang tetap bawaan kecuali disebut tegas di pertimbangan hukum, mode massal yang berfungsi, perkara lain menurut deteksi posita blangko ABT, alasan baru di kalimat BAS, dan dua saksi yang berbeda bunyi tetapi sama faktanya. Temuan terbesarnya: putusan massal SIPP TIDAK PERNAH dapat menyimpan satu perkara pun - pilihan wajib blangko tidak pernah diisi - dan blangko Putusan Akhir SIPP yang baru dibuka sudah memilih 'Qobla Dukhul' sendiri. Pemeriksa mandiri juga menangkap, sebelum rilis, aturan keadaan istri yang akan menjawab 'pasti Hamil' dari kehamilan yang sudah lewat.",
    added: [
      "ALASAN CERAI DARI KETERANGAN SAKSI ABT, diukur atas 1.498 perkara cerai berputusan 2024-2026 yang keterangan saksinya ada di ABT, dan tiap bentuk dibaca atas kalimat BAS petugas (benar sedikitnya 9 dari 10): temperamen kini juga 'suka/cepat/gampang marah' dan 'mudah emosi' (333 → 338 perkara), malas bekerja juga 'tidak mau bekerja' (131 → 150), kekerasan juga bentuk pasif - dipukul, ditampar, dicekik, ditendang, dijambak (456 → 460). Kata yang terlalu sering salah ditolak: 'marah' telanjang (5/10), 'pukul' (jam), 'wil' (tertangkap di 'wilayah'), 'curiga', 'menjalin hubungan' (termasuk 'hubungan suami istri').",
      "Alasan baru yang diucapkan saksi SDG: menikah lagi, masalah ekonomi (129 perkara), dan tidak memiliki pekerjaan tetap (14). Tiga lagi hanya dideteksi, belum diucapkan: campur tangan keluarga (44), tidak menghargai (44), keluar malam (41). 'Menikah lagi dengan wanita lain' tidak lagi dibaca sebagai selingkuh.",
      "Tujuh alasan dapat dipilih petugas di panel SDG ABT (dulu sembilan, kini enam belas): temperamental, berkata kasar, bersikap kasar, malas bekerja, tidak memiliki pekerjaan tetap, masalah ekonomi, menikah lagi - masing-masing berbunyi kalimat dari BAS petugas, dan penjaga uji menjalankan bot untuk tiap pilihan sehingga label mentah tidak dapat tercetak.",
      "PUTUSAN MASSAL SIPP BERFUNGSI (ekstensi 1.169.0): pilihan wajib blangko diisi dari usulan ALETA dengan urutan pintu panel satu perkara; yang tidak dapat dipastikan menahan perkara dengan sebabnya; praperiksa memeriksa nilai yang benar-benar akan disimpan; tiap pilihan yang diisikan dicatat per perkara, dan yang dari bawaan ditandai 'diisi bawaan - periksa'.",
      "DISPENSASI KAWIN mengusulkan KUA yang menolak (5178): ALETA 17 benar dari 18 atas isian petugas, sedangkan bawaan ABT #10103# 0 dari 7 pada perkara yang sama - bawaannya membawa sisa kalimat posita ('…, namun ditolak dengan alasan …') ke kalimat blangko yang sudah menyebut penolakannya. Variabel 3333 tidak lagi diusulkan: ia tidak ada di satu pun dari 908 berkas blangko, dan maknanya terbukti sama dengan 5178.",
      "Keputusan sumber isian per variabel, bukan 'jangan usulkan yang ditangani ABT': bawaan ABT dari kueri Anda (#101xx#) hanyalah isian awal kotak popup yang tersimpan bila kotaknya dibuka dan disimpan, dan mutunya berbeda per variabel. Yang lebih tepat pada perkara yang sama yang dipakai; yang diserahkan ke ABT disebut di panel sebagai 'ABT menawarkan isian bawaan … periksa sebelum menyimpan'.",
    ],
    changed: [
      "ITSBAT NIKAH memilih sumber yang lebih tepat per variabel (n ≥ 10, ketepatan ALETA ≥ 0,5, dan tidak kalah dari bawaan ABT lebih dari 0,02 pada perkara yang sama): 5178 (ABT 0,939, ALETA 0), 5105 (0,412 lawan 0,038), 1046, 1002 (0,750 lawan 0,276), dan 0007 diserahkan ke bawaan ABT; 1001, 1003, 1217, 5197 (ALETA 0,785 lawan 0,158), 7211, 7212, 8087, 0650, dan 0651 tetap diusulkan ALETA. Gerbang 0,9 perkara lain sengaja tidak dipakai di sini: ia akan menghentikan ke-14 variabel, termasuk yang ALETA jauh lebih tepat. Asal usul dan perwalian (n 0-2) meminjam keputusan itsbat nikah karena pengurainya sama, dan alasannya menyebut peminjaman itu.",
      "KEADAAN ISTRI DAN NUSYUZ tetap bawaan, kecuali pertimbangan hukum menyebutnya tegas ('tidak nusyuz', suci, haid, hamil saat ini). Aturan tegas hanya membaca PERTIMBANGAN HUKUM, bukan duduk perkara. Isi kutipan pasal atau hadits sesudah titik dua (Pasal 121/122 KHI, kaidah talak bid'i) tidak dibaca sebagai fakta perkara, dan 'tidak nusyuz' tidak dipastikan dari pengakuan pihak atau dari kaidah umum. Faktor pokok benar tetap 582/960 dan sekunder 116/252 tanpa regresi.",
      "DUA SAKSI SDG menyebut alasan dengan derajat yang sama: bunyi yang berbeda derajat dilepas dari pasangan setara ('melalaikan kewajiban nafkah lahir' tidak lagi berpasangan dengan 'tidak menafkahi', demikian pula 'bermain judi' dan 'tidak mau bekerja'). Bentuk kalimat dua saksi dibuat lebih beragam - jawaban identik antar saksi turun dari 62,1% menjadi 51,8% pada ukuran pembangun, sebelum tiga bunyi itu dilepas.",
      "Panel ABT perkara lain: tombolnya hanya muncul bila blangko memuat variabel siap milik jenis perkaranya, dan kabarnya hanya menyebut variabel yang ada di blangko yang dibuka.",
    ],
    fixed: [
      "PUTUSAN MASSAL SIPP TIDAK PERNAH MENYIMPAN. Antrean hanya mengisi naskah lalu menekan Simpan, dan SIPP selalu menolak dengan 'Sumber Hukum Belum Dipilih'. Lima cacat lain ikut terbukti dan dibetulkan: satu perkara dapat disimpan dua kali, perkara yang terputus di tengah dikerjakan ulang sendiri, satu error membuat antrean macet, 'Akhiri antrean' tidak menghentikan (perkara berikutnya tetap disimpan), dan antrean dari berkas mengaku 'draf' sementara menekan Simpan sendiri.",
      "BLANGKO PUTUSAN AKHIR SIPP MEMILIH 'QOBLA DUKHUL' SENDIRI: kolomnya diisi dari akta cerai yang belum ada sebelum putusan, dan di PHP NULL == 0. Nilai itu (dan Verstek 'Tidak') tidak lagi dianggap pilihan petugas di antrean maupun di panel satu perkara, sehingga usulan ALETA tidak lagi membeonya.",
      "Keadaan istri 'pasti Hamil' yang akan lahir dari kehamilan lampau ('meninggalkan Penggugat dalam keadaan hamil' tahun 2018), kehamilan orang lain, 'tidak dalam keadaan hamil', dan 'petitum masih mengandung kekaburan' - ditangkap pemeriksa sebelum rilis. Usulan pasti baru yang salah atas pertimbangan, posita, dan BAS: 0 (sebelumnya 11 perkara, 9 salah).",
      "'Menikah lagi' hanya bila Tergugat/Termohon sungguh sudah menikah lagi: niat, izin, ancaman, suruhan, 'tidak jadi', dan perkawinan Penggugat/Pemohon ditolak (31 kalimat dari 896). Sebelumnya posita cerai talak 'Pemohon sudah menikah lagi' menjadi keterangan saksi 'Termohon telah menikah lagi'.",
      "'Emosional' dan 'tersulut emosi' di gugatan ('kedekatan emosional', 'hubungan emosional memudar') tidak lagi dijadikan watak temperamental di keterangan saksi SDG; keduanya tetap dibaca untuk deteksi keterangan saksi BAS.",
      "Alasan yang hanya dideteksi, bila dikirim eksplisit, ditolak dengan keterangan - tidak lagi tercetak tanpa subjek ('… yaitu tidak menghargai dan keluar malam').",
      "Blangko relaas ikrar talak dicari di menu ABT 25 (Relaas Ikrar Talak, rentang proses 290-600), bukan di menu relaas biasa (80-220) yang menolak ikrar.",
    ],
    security: [],
    operationalNotes: [
      "Tidak ada migrasi baru (0050 dari 2.36.0; nomor bebas berikutnya 0051). Citra bot WAJIB dibangun ulang - layanan usulan ABT dan rute /abt/usulan berubah - begitu pula portal.",
      "Ekstensi SIPP naik ke 1.169.0. Ekstensi unpacked tidak memperbarui dirinya - tekan Reload pada chrome://extensions sesudah berkasnya disalin.",
      "PENGATURAN ABT DI SATKER (dikerjakan pengguna sendiri): hak akses menu 900 'Blangko Derry' menjadi 1|10|20|600|650; blangko relaas ikrar dipindah ke folder '_ikrar_talak/2 Relaas Ikrar Talak' (menu 25); kueri #10106#/#10107# tertukar (cerai hidup ↔ cerai mati); bawaan #10103# membawa sisa kalimat posita.",
      "Penjaga dua tab memakai Web Locks bila peramban menyediakannya - hanya di HTTPS atau localhost. Di SIPP satker lewat http://192.168.10.10 yang menjaga adalah penanda pemegang dan pemeriksaan tepat sebelum Simpan.",
      "Uji manual wajib sebelum dipakai: satu antrean massal otomatis dan satu manual atas perkara cerai di SIPP sungguhan (periksa isian qobla, nusyuz, dan keadaan istri yang tersimpan), tombol itsbat pada blangko itsbat, dan panel SDG dengan alasan baru.",
    ],
    knownLimitations: [
      "Faktor pokok untuk 'masalah ekonomi' tidak diubah: petugas memilih Ekonomi sebagai pokok sampai perkara 477/2025, lalu Perselisihan dengan Ekonomi sekunder sejak 556/2025. Aturan mana pun yang dicoba merusak 4-12 perkara yang sekarang benar - menunggu keputusan pengguna.",
      "Kedua saksi SDG kini selalu menulis 'melalaikan kewajiban nafkah lahir'; mengikuti derajat posita ('tidak memberi' atau 'kurang memberikan') butuh ukur baru.",
      "Penyaring 'menikah lagi' mungkin menolak sekitar 4 kalimat yang benar (salah ketik atau susunan tak lazim).",
      "Keterangan 'alasan ditolak' dari bot belum ditampilkan panel.",
      "Mode massal dan panel yang berubah baru teruji di SIPP/ABT tiruan yang disetarakan dengan aturan validasi SIPP asli, belum di peramban sungguhan.",
    ],
  },
  {
    version: "2.36.0",
    title: "ALETA Judicia v2.36.0 - Cetak Relaas dari Antrian Sidang, Status Perkara Lengkap, dan Tipe Keluaran Ekstensi",
    date: "2026-09-25",
    status: "Belum terpasang",
    summary:
      "Tujuh permintaan pengguna: bentuk tanggal 07-10-2026 beserta nama harinya di seluruh layar e-Court, potongan 120 hari perkara ghaib yang dikembalikan, sinkronisasi e-Court yang diperiksa ke lima layar sekaligus, pengurutan Kendali Berkas, penarikan yang hanya mengambil yang belum ada, unduhan seluruh data SIPP beserta berkasnya, dan menu Tag berisi 53 pertanyaan pengawasan yang masing-masing membawa jumlahnya sendiri. Yang terbesar bukan salah satunya: penjaga uji yang hanya menyisir teks sumber ternyata HIJAU atas kode yang melempar error - tiga kali dalam satu batch, termasuk satu kolom pengurutan yang MENGOSONGKAN tabel Kendali Berkas sementara 18 ujinya lulus.",
    added: [
      "TOMBOL \"CETAK RELAAS\" DI ANTRIAN SIDANG (tab Jadwal Sidang) untuk juru sita, admin, dan super admin - tanpa tab baru. Daftar kerja HARI ITU disusun dari SIPP: panggilan sidang pertama untuk perkara yang baru didaftarkan (1.753 dari 1.759 perkara sejak 2025 ditetapkan hari sidangnya pada hari pendaftaran), panggilan sidang berikutnya untuk sidang yang ditunda, dan pemberitahuan untuk putusan yang dibacakan. Blangkonya diambil dari ABT folder derry_briantono, lalu ekstensi mengunduh RTF dan PDF per juru sita. Tidak ada yang diunggah ke SIPP.",
      "ARTI SANDI KEHADIRAN SIDANG dibaca dari blangko SIPP sendiri (jadwal_sidang_p_edit.php): 1 = Semua Pihak hadir (tidak dipanggil), 2/3 = pihak pertama/kedua saja, 4 = tidak ada yang hadir. Sebelumnya sandi 1 dijawab 'tidak diketahui' - 7.486 sidang disodorkan sebagai pertanyaan. Sandi 1 yang alasan tundanya berbunyi 'Panggil ...' tetap dijadikan panggilan (88/Pdt.G/2026), karena 'Semua Pihak' adalah pilihan pertama blangko tanpa pilihan kosong.",
      "STATUS PERKARA: hasil pencarian kini punya empat tampilan - Detail (tabel), Daftar, Kotak, Kelompok - dengan kepala kolom yang dapat diklik untuk mengurutkan, tabel yang bergulir di dalam kotaknya sendiri (terukur pas di 320/375/768/1280 px), tombol Cetak A4 mendatar yang mengikuti urutan dan saringan, serta panel Tag dan Saringan lain yang mengecil sendiri sesudah hasilnya datang.",
      "Pencarian Status Perkara diperluas ke kuasa hukum, NIK/telepon pihak, akta cerai, nomor banding/kasasi/PK, akta nikah, dan agenda sidang - tiap hasil menyebut di bagian mana katanya cocok. Setiap baris membawa 19 keterangan (pihak dan sebutannya, majelis, tahapan, sidang terakhir/berikut, umur perkara, akta cerai, e-Court). Cari nomor '419' dari 3,5 detik menjadi 0,2 detik; memuat 500 perkara dari 8-16 detik menjadi 0,9 detik.",
      "Status putusan di blangko Putusan Akhir kini dibaca dari kata kerja AMAR, bukan dari pertimbangan. Sebabnya, pertimbangan seperti 'pencabutan … dapat dikabulkan' dulu menjadi 'Dikabulkan'. Ketepatan atas 1.633 putusan 2025-2026 PA Donggala naik dari 1.382 (84,6%) menjadi 1.598 (97,9%) dengan 0 regresi. Gugur vs Digugurkan kini ditanyakan (71 perkara).",
      "Verstek naik dari 1.513 menjadi 1.537/1.633 (regresi 4 = 0,24%). Usulan qobla yang 'pasti' tetapi salah turun dari 4 menjadi 0 (benar 949/950).",
      "Faktor penyebab perceraian: bawaannya kini 'Perselisihan dan Pertengkaran' seperti di halaman SIPP, kecuali pertimbangan tegas menyebut dasar lain. Pokok benar naik dari 310 menjadi 582/960 dan sekunder dari 51 menjadi 115/252. Karena bawaan ini, 79 perkara yang dulu benar kini salah (8,23%) dan 30 pada sekunder (11,9%). Sebagian besar kini berkeyakinan 'bentrok' dan dipilih petugas; yang tercentang sendiri dengan nilai salah tinggal 140 (dulu 160) dan 59 pada sekunder (dulu 182).",
      "Alasan dispensasi kawin kini mengikuti nilai yang sudah terpilih di halaman: 22/22 (dulu 0/22). Alasan isbat di Data Umum 396/403 (dulu 2/403). Keadaan istri dan nusyuz tidak pernah lagi 'pasti' tanpa frasa tegas.",
      "Amar anonim tidak lagi membocorkan 'bin/binti <nama ayah>': 0/105 (dulu 6/105). Isi kurung sesudah sebutan ditulis '( xxx )', bentuk terbanyak di satker (324/621). Satu perkara (278/Pdt.G/2026) turun dari mirip ke beda karena petugasnya menulis '( Tergugat )'.",
      "Deteksi keterangan saksi ke ABT atas 347 perkara PA Donggala, dari keadaan sebelum ke sesudah: 0222 awal konflik 72,5% → 87,7%; 0246 pisah rumah 82,9% → 89,2%; 7035 yang meninggalkan 269 → 285/335; 9944 lama pisah 38,6% → 67,1% (ucapan saksi didahulukan, hitungan sampai tanggal sidang hanya pembanding); 1268 upaya damai 72% → 92,2%.",
      "Kalimat 'berhasil/telah berusaha mendamaikan' tidak lagi dibuat untuk saksi yang berkata 'belum pernah ada upaya' (15 → 0). Isian itu kini 'ragu' dengan dua bunyi pilihan dan tidak tercentang sendiri.",
      "5227: 'shabu', 'wanita/pria lain', temperamen, kasar, dan malas bekerja kini dikenali (shabu 15/15, dulu 1/15). Presisi/recall dengan penggaris adil 0,899/0,754 (dulu 0,899/0,667). Ciri yang hanya disebut satu saksi tampil bertanda, tidak dicentang dan tidak hilang diam-diam. Kalimat BAS saksi (SDG) sengaja TIDAK berubah (0/1.119), karena baris deteksi baru belum diukur terhadap BAS petugas.",
      "8503 huruf alasan: sama persis dengan pilihan manusia naik dari 27 menjadi 171/318. C, D, E, dan G tidak pernah diusulkan untuk blangko [01], dan tidak ada yang dicentang otomatis (dulu 407).",
      "Itsbat: nama wali tidak lagi terpotong 1-2 huruf (392 → 0; tersisa 'Sa', nama asli). Mahar tidak lagi terpotong di 'Rp.11.000' (167 → 0/395). Saksi nikah dan yang menikahkan kini terisi (sama persis 304-319 dari sekitar 365, dulu 0).",
      "Perkara lain: dispensasi kawin kini punya 5 variabel yang diusulkan dari posita (lolos gerbang presisi ≥0,9, n ≥10), lewat tombol 'Isi dari posita permohonan' di 6 blangko DK. Perwalian belum (data manusia ≤7 per variabel).",
      "Unggah putusan: pemotong naskah RTF kini mencari penutup sesudah amar. Amar cocok atas 39 e-Doc diterima SIPP naik dari 15 menjadi 36 (+3 mirip, kosong 18 → 0) dan pertimbangan dari 16 menjadi 30. Naskah ABT 0 berubah, dan e-Doc PA Bungku 0 turun kelas (53 naik).",
      "Unggah putusan menolak dengan jelas: nomor di isi berbeda dari nomor permintaan (197/197 sama pada naskah sungguhan), slot anonimisasi yang masih memuat nama pihak (putusan asli di slot anonim tertangkap 39/39; anonim sungguhan lolos 13/15), serta BAS/PHS/relaas yang diunggah sebagai putusan.",
      "Jejak audit unggahan kini jujur: formname 'ALETA - Unggah Dokumen Putusan', judul menyebut 'lewat ALETA', pelaku petugas, dan IP peramban sungguhan (dulu kosong pada 100%). Cap waktu diambil per tulisan. ALETA tidak meniru blangko SIPP.",
      "Konversi RTF (soffice): hasil periksa mesin disinggahkan 5 menit dan dua konversi berjalan sejajar. Dua RTF kini 2 proses (dulu 4), atau 3 saat singgahan dingin. Batas bot 110 dtk < gerbang 120 dtk < ekstensi 150 dtk.",
      "Ekstensi: nomor perkara dibaca dari nama berkas dalam 4 bentuk nyata. Atas 8.614 nama, 6.450 terbaca (dulu 0) dan 0 salah nomor. Berkas anonim, BAS, dan PDF/DOC tidak lagi ikut kiriman massal (0/909, 0/1.092, 0/1.451).",
      "Ekstensi: bukti simpan kini membaca jawaban SIPP sendiri. Bila SIPP menolak, pesannya tampil dalam 300 ms (dulu 10 dtk jajak dengan pesan umum). Bila berhasil, jajak basis data mulai seketika. Tombol yang disembunyikan SIPP (.hide) tidak pernah ditekan.",
      "Ekstensi: antrean putusan massal tidak lagi menekan Simpan bila ada medan yang gagal terisi. Ringkasan memisahkan 'ditahan praperiksa' dari 'tertahan karena medan gagal terisi'.",
      "Putusan massal ABT: tanpa unggah, per perkara kini 2 permintaan (dulu 5; PDF dan anonim tidak lagi dibuat lalu dibuang). Dengan unggah, 4 permintaan (dulu 6) dan yang dikirim RTF, bukan PDF (87,7% e-Doc satker RTF). Tidak ada jeda sesudah perkara terakhir. Ringkasan tidak lagi mengaku 'PDF ok · anonim ok'.",
      "Putusan massal ABT: bila rute menolak karena anonimisasi masih memuat nama, sebabnya kini tampil (dulu hanya 'ALETA menjawab 409'), putusan dikirim ulang tanpa anonimisasi, dan perkara tetap ditandai gagal supaya anonimnya diunggah sendiri.",
      "Tombol 'Input ke ABT' hanya muncul pada blangko cerai (17 dari 81 blangko; itsbat 0/10, DK 0/6). Keterangan saksi dibaca mentah sebelum replace_ket_saksi: nilai usulan sama pada 1.119/1.119, dan 13 blangko tanpa 2021/2022 kini terbaca.",
      "Keterangan saksi (BAS SDG) di bot: jawaban berpembuka turun dari 88,8% menjadi 10,7%, dan pembuka yang tidak pernah dipakai petugas ('Iya,' dll.) dari 51,4% menjadi 0. Sebutan berhuruf kecil 454 → 0. Pilihan berlawanan kini wajib dipilih petugas (27 → 0 tersalin). Jawaban 'siapa yang meninggalkan' mengikuti subjek kalimat posita (910 → 0 salah dari 1.551).",
      "Keterangan saksi: dua saksi dengan pilihan sama kini memakai bentuk berbeda untuk pertanyaan pokok (templat 04, A1, A1a, IN1: 0% identik). Seluruh 43 bentuk diambil dari BAS petugas Donggala (≥3 kemunculan di ≥3 perkara) dan makna diperiksa otomatis (0 pelanggaran dari 194.940 jawaban). Pertanyaan yang di korpus hanya punya satu bentuk tetap sama dan diberi tanda 'varian habis' (4,9% keseluruhan).",
      "Keterangan saksi: pilihan pencerita 'penggugat' kini menghasilkan 'Penggugat bercerita' (dulu 'Tergugat'): 12/12 baris. Itsbat kini berlabel 'Status Pemohon sebelum nikah' (dulu 'Status Termohon').",
      "Saksi ketiga/keempat dan saksi Tergugat didukung: sampai 4 saksi Penggugat dan 2 saksi Tergugat. Variabel ABT diverifikasi 7/7 dari abt_variabel, dan penanda di lembar BAS portal terisi 2.473/2.473 (dulu 2.224). Saksi disimpan berurutan tanpa jeda buatan.",
      "Lembar BAS portal 'Pakai contoh': saksi 1 dan saksi 2 tidak lagi identik pada pertanyaan pokok (100% → 8,9%). Hasilnya stabil pada cetak ulang (5.400/5.400) dan sama dengan bot untuk bentuk bersyarat.",
      "Pengaturan baru 'Tipe keluaran ekstensi' (Admin ALETA, di bawah Pengaturan ekstensi, tab Berita Acara Sidang dan Putusan). Admin mengusulkan tambahan kalimat/medan; Super Admin mengesahkan dengan 'atas perintah' ketua/wakil/hakim. Bawaan terkunci dan hanya dapat dimatikan/diganti, dan tidak ada tombol hapus. Daftar deteksi hanya dapat disahkan sesudah lulus ukur atas data SIPP satker. Pratinjau BAS menampilkan hasil 2-4 saksi sebelum disahkan.",
      "Tabel tipe keluaran yang kosong atau tak terbaca menghasilkan perilaku sama persis dengan sebelumnya: blangko 1.633/1.633, Data Umum 436/436, deteksi saksi 1.119/1.119, BAS 162/162, dan medan ekstensi 12/12. Medan tambahan satker diusulkan, tetapi Simpan diserahkan ke petugas.",
      "Peta blangko putusan kini dapat ditambah dari portal (misalnya Perwalian): cakupan 4 → 5 jenis (95,8% → 97,1% perkara sejak 2025), tanpa menyunting tiap peramban.",
      "Basis data: migrasi 0050_aleta_tipe_keluaran (2 tabel). Sesudah pasang, periksa SELECT count(*) FROM aleta_tipe_keluaran. Benih (250 baris) ditanam pada baca pertama. Nomor migrasi bebas berikutnya 0051.",
      "Halaman /admin/blangko-mandiri kini terbuka untuk Super Admin dan Admin (dulu tertutup bagi keduanya).",
      "Menu \"Tag & rentang waktu\" di samping Saringan lain pada layar Status Perkara: 88 tag dalam 12 kelompok, masing-masing membawa jumlahnya sendiri sehingga \"Putus, belum BHT 240\" sudah menjawab sebelum ditekan. Sekali tekan, nomor perkaranya keluar. Beberapa tag digabung dengan DAN - \"belum putus DAN ghaib\" memulangkan 3 perkara dari 10.120. Rentang waktunya sembilan pilihan (hari ini, kemarin, mingguan, bulanan, triwulan, semester, tahunan, antara dua tanggal, seluruhnya) atas TUJUH dasar tanggal yang berbeda - didaftarkan, diputus, BHT, bersidang, akta cerai terbit, relaas dilaksanakan, ikrar talak dilaksanakan - dan tanggal acuannya dapat disunting sehingga \"triwulan LALU\" dapat ditanyakan, bukan hanya yang sedang berjalan.",
      "Tag yang menjawab pertanyaan pengawasan yang selama ini tidak dapat ditanyakan sama sekali: tunggakan lewat tiga bulan dan lewat lima bulan SEMA 2/2014, perkara mandek (belum putus dan tidak ada sidang berikutnya) 101, sudah putus tetapi belum masuk arsip 5.716, cerai sudah BHT tetapi akta belum terbit 753, akta cerai belum diterima pihak kedua 3.370, cerai talak BHT tetapi ikrar belum dilaksanakan 219, ditunjuk lewat Smart Majelis 915, dan sisa panjar belum nol 135 yang 21 di antaranya perkaranya sudah diputus - yaitu uang yang harus dikembalikan kepada pihak.",
      "Sepuluh keranjang tahapan terakhir dan tujuh belas jenis perkara, masing-masing berjumlah TEPAT 10.120 - sama dengan seluruh register. Dua invarian itu dapat diperiksa siapa pun, dan itulah gunanya: katalog lama hanya memuat lima dari sepuluh keranjang tahapan dan MELEWATKAN \"Putusan\" yang memuat 54% register, sementara tidak ada satu pun cara memeriksanya. Kelompok jenis perkara juga menyelesaikan satu cacat data: jenis_perkara_id 360 memuat dua ejaan pada nama perkaranya - \"Pengesahan Perkawinan/Istbat Nikah\" 3.964 baris dan \"Istbat Nikah\" 89 baris - sehingga mengetiknya di kotak saringan mustahil benar, sedangkan satu tag menjaring keduanya.",
      "Unduhan satu perkara seutuhnya dari layar Status Perkara: perkara.json beserta 26 tabel CSV, ditambah berkas PDF/Word/RTF dari SIPP maupun e-Court dalam satu ZIP. Riwayat penundaan sidang termasuk di dalamnya - pertanyaan yang selalu datang ketika berkas dikirim ke banding, dan jawabannya sebelum ini hanya ada di dalam JSON yang tidak dibaca panitera mana pun. Bagian yang tidak dapat dibaca DISEBUTKAN di KETERANGAN.txt beserta sebabnya, tidak lagi keluar sebagai CSV berkepala tanpa baris yang tak terbedakan dari data yang memang kosong.",
      "Pengurutan tujuh kolom pada Kendali Berkas e-Court, dikerjakan SERVER bukan peramban: \"belum ada terbanyak\" menunjuk yang terbanyak di seluruh arsip, bukan yang terbanyak di antara 500 baris yang kebetulan terbawa. Nomor perkara diurut sebagai ANGKA dengan tahun lebih dahulu, dan tanggal diurut sebagai tanggal - sehingga pergantian bentuk tanggal menjadi DD-MM-YYYY tidak dapat merusak urutannya.",
      "Penarikan e-Court yang MEMFOKUSKAN pada yang belum ada: perkara yang berkasnya sudah utuh tidak dibuka sama sekali, dua puluh contoh perkara sasaran digambar beserta sebabnya, dan taksiran waktunya berupa rentang yang sudah memuat istirahat 1-3 menit tiap 40 perkara. Jatah satu penekanan datang dari bot, bukan dari angka yang ditulis keras di layar - jadi menaikkan ALETA_BOT_ECOURT_MAKS_BELUM_ADA di server sekarang benar-benar berpengaruh.",
      "Layar Admin Integrasi e-Court akhirnya menjawab \"apakah sinkronisasinya lengkap?\": cakupan penarikan beserta penyebutnya (2.527 perkara e-Court SIPP), riwayat sepuluh putaran jembatan terakhir, ringkasan berkas dan byte arsip dengan byte aktif dipisah dari yang sudah dibuang masa simpan, jumlah panggilan elektronik dan persetujuan pihak, serta kartu Keadaan Pendaftaran e-Court yang memakai tiga medan yang selama ini dibaca lalu dibuang.",
      "Perkara yang nomornya BERSELISIH antara SIPP dan e-Court dipampangkan merah di layar Admin Integrasi. Terukur 2 dari 2.529, dan keduanya BERTUKAR: perkara 61/Pdt.G/2020 tercatat 63/Pdt.G/2020 di e-Court dan sebaliknya. Menarik dokumen dengan nomor yang salah membuat berkas perkara 61 mendarat di perkara 63.",
    ],
    changed: [
      "Seluruh tanggal pada layar e-Court berbentuk 07-10-2026 dengan nama harinya di sampingnya - \"Rab, 07-10-2026\" pada tabel dan lencana, \"Rabu, 07-10-2026\" pada panel rincian. Sebelum ini satu layar yang sama memuat lima bentuk sekaligus: \"2026-10-07\", \"7 Oktober 2026\", \"Rab, 9 September 2026\", \"7 Okt\", dan \"07 Okt 2026\". Nama harinya bukan hiasan: dari 8.477 tundaan sidang di satker ini tidak SATU pun jatuh pada akhir pekan, jadi \"Sab, 07-10-2026\" adalah satu-satunya tanda yang menampakkan salah ketik sebelum hari H. Bentuk berhuruf tetap dipakai pada lembar cetak dan naskah, sebab naskah ditandatangani dan angkanya tidak boleh dapat diubah sesudah dicetak.",
      "Potongan kelonggaran 120 hari perkara ghaib DIKEMBALIKAN pada angka umur perkara di Antrian Sidang, atas permintaan pengguna. Yang dijaga supaya tidak hilang lagi: batas lima bulan SEMA 2/2014 dihitung TANPA potongan itu, baris perkara ghaib membawa angka kedua \"· dari N\", dan yang melewati lima bulan tetap berlencana merah \"lewat 5 bulan\". Keterangan saklar Umur perkara ditulis ulang supaya menyebut ketiganya beserta dasar hukumnya - sebelum ini ia hanya menyebut potongan mediasi, padahal 13 dari 127 perkara berjalan dipotong 120 hari dan ke-13-nya tidak bermediasi sama sekali.",
      "Grafik \"Umur perkara pada tiap sidang\" menerangkan sendiri mengapa angkanya dapat berbeda 120 hari dari lencana di Antrian Sidang: garis itu hari kalender di luar mediasi dengan cara SEMA 2/2014 dan TIDAK dipotong, sedangkan kelonggaran SK Dirjen Badilag 048/2024 hanya memotong penilaian kinerja. Terukur: 322/Pdt.G/2026 terbaca \"1 hari\" di satu layar dan 115 hari di layar lain, pada hari yang sama.",
      "Dokumen e-Court tanpa tombol unduh sekarang dibedakan menjadi TIGA kalimat, sebab tindakannya berbeda: belum pernah diunggah pihak (tagih pihaknya), tercatat ada tetapi berkasnya lenyap dari arsip (tarik ulang, jangan tagih siapa pun), dan catatannya tidak terbaca (periksa sambungannya). Ketiganya sebelum ini berbunyi \"belum tersimpan\".",
    ],
    fixed: [
      "KOLOM PENGURUTAN YANG MENGOSONGKAN TABELNYA. Menekan kepala kolom \"Register e-Court\" pada Kendali Berkas membuat kuerinya melempar ERROR 1247 dan tabelnya kosong beserta error MySQL mentah; petugas harus menekan kolom lain dua kali untuk memulihkannya. Sebabnya alias agregat dipakai di dalam ekspresi ORDER BY - MariaDB mengizinkannya sebagai seluruh ruas, tetapi menolaknya di dalam ekspresi. Satu dari tujuh kolom yang baru dibuat justru mematikan panelnya, dan 18 uji penjaganya LULUS sepanjang cacat itu hidup.",
      "GALAT KUERI YANG DITELAN LALU MENJADI ANGKA YANG SALAH. Enam tempat memakai .catch(() => []) sehingga satu kolom yang berganti nama berubah menjadi jawaban yang tampak meyakinkan: hitungan perkara lewat e-Court SELALU nol pada Kendali Berkas (kolom perkara_efiling.perkara_id tidak pernah ada), seluruh tombol unduh lenyap dari tiga layar sekaligus, dan panel tag menampilkan \"Belum ada relaas 10.120\" - yaitu SELURUH register - alih-alih 5.034. Kini galatnya dicatat, dan \"tidak terbaca\" dibedakan dari \"tidak ada\".",
      "SARINGAN JENIS PUTUSAN SALAH PADA KEENAM PILIHANNYA. Ia membaca kolom status_putusan_nama yang kosong pada 94,8% baris, sedangkan chip tag di panel sebelahnya membaca namanya lewat JOIN - jadi panitera membaca \"Dikabulkan 8.910\", mengetik kata yang sama ke kotak di sebelahnya, dan mendapat 447. Terukur sebelum dan sesudah: Dikabulkan 447 menjadi 8.910, Dicabut 46 menjadi 535, Digugurkan 6 menjadi 255, Ditolak 4 menjadi 53, Tidak Dapat Diterima 1 menjadi 75, Dicoret 15 menjadi 34 - jumlahnya 519 menjadi 9.862. Kuerinya justru 4 sampai 11 kali lebih murah daripada sebelumnya.",
      "SANDI RELAAS \"S\" DIARTIKAN GAGAL PADA EMPAT TEMPAT, padahal komentar kolom SIPP sendiri menyebut S = surat tercatat. Akibatnya 1.431 perkara yang dipanggil lewat surat tercatat dilaporkan sebagai 1.431 PEMANGGILAN GAGAL - angka tunggakan yang dikarang, dan 829 di antaranya justru bertanda berhasil. Saringannya kini bernama \"Dipanggil lewat surat tercatat\", dan \"gagal panggil\" diarahkan ke kegagalan yang sungguhan: 180 perkara. Empat arti sandi lain ikut dibetulkan dari komentar kolomnya, bukan dari tebakan.",
      "SELURUH 2.527 TANGGAL PENDAFTARAN e-COURT RUSAK dari jembatan SIPP. Kolomnya bertipe DATE dan penggerak mysql memulangkannya sebagai objek Date, lalu dipotong pada aksara ke-10 sehingga berbunyi \"Tue Sep 08\" - TANPA TAHUN, dan bukan tanggal yang dapat diurai siapa pun. Lebih berbahaya daripada kosong: petugas membaca \"Sep 08\" sebagai tahun ini, padahal tahunnya dapat 2020.",
      "BERKAS YANG SENGAJA DIHAPUS MASA SIMPAN DIHITUNG \"BELUM ADA\", sehingga perkaranya menjadi sasaran penarikan selamanya: bytenya diunduh ulang dari server Mahkamah Agung, lalu dibuang sebab kodenya sendiri menolak menuliskannya. Tepat kebalikan dari yang dinyatakan komentar fungsinya sendiri, dan tepat keluhan \"jangan ambil yang sudah ada\" dalam bentuk baru.",
      "DUA DEFINISI \"DOKUMEN INI KEKURANGAN BERKAS\" YANG BERSELISIH. Tombol Tarik muncul, ditekan, lalu jembatan menilai perkaranya lengkap dan melewatinya diam-diam - tidak ada yang berubah di layar. Pada arah sebaliknya, layar berkata \"Lengkap\" sementara jembatan membuka dokumen yang sama tiap putaran selamanya. Kini satu sumber dan satu ekspresi dipakai kedua kueri, dan angkanya terbukti sama pada keempat bentuk baris yang diuji.",
      "GILIRAN PENARIKAN YANG TIDAK DAPAT BERPUTAR. Perkara yang halamannya dibuka tetapi tidak berdokumen tidak meninggalkan jejak apa pun, sehingga ia berpangkat prioritas tertinggi selamanya: penekanan kedua dan ketiga membuka 120 perkara yang PERSIS SAMA. Terukur: tanpa catatan kunjungan tumpang tindihnya 120 dari 120; dengan catatan kunjungan 0, dan tiga penekanan menyentuh 300 perkara berbeda.",
      "TAKSIRAN WAKTU PENARIKAN TERLALU RENDAH 16 SAMPAI 36 PERSEN, sebab istirahat 1-3 menit tiap 40 perkara tidak dihitung sama sekali - padahal komentar penjadwalnya menyatakan sudah termasuk. Perkara yang justru seluruh berkasnya harus diunduh pun diberi nol detik berkas. Karena penarikan mengunci seluruh jalur penarikan lain, angka itulah yang dipakai memutuskan boleh-tidaknya menahan pekerjaan orang lain.",
      "BATAS WAKTU UNDUHAN TIDAK BERLAKU PADA SISI e-COURT, sehingga satu berkas yang menggantung menggantungkan seluruh permintaan melewati batas 120 detik - unduhan gagal tanpa sebab, persis keadaan yang batas itu ditulis untuk menghapus. Ekstensi berkasnya pun ditebak .docx alih-alih dibaca dari nama aslinya, sehingga dokumen RTF dan ODT masuk ZIP dengan nama yang membuat Word menolak membukanya.",
      "FOLDER \"00 Data SIPP\" DITULIS PALING AKHIR, jadi ia yang pertama dibuang ketika batas 150 berkas tercapai - padahal itulah yang diminta pengguna dengan kalimatnya sendiri. Terukur pada perkara dengan berkas terbanyak: 90 berkas perkara ditambah 27 entri data menyisakan 32 slot, dan satu dokumen e-Court dapat memakan dua. Sekarang data ditulis lebih dahulu.",
      "PENYARING KUNCI TAG BERLUBANG PADA LIMA NAMA BAWAAN Object: ?tag=toString memulangkan 500 alih-alih hasil tanpa tag. Bukan lubang keamanan - tidak ada satu potongan SQL yang lolos dari peramban - tetapi penyaring katalog yang seharusnya tertutup ternyata tidak.",
      "PANEL TAG DIAM 24 SAMPAI 29 DETIK sebelum satu angka muncul, dan justru pilihan yang paling menyempitkan yang paling lambat - \"diputus triwulan ini\" atas 198 perkara memakan 35 detik. Sebabnya penghitungnya memakai JOIN dari tabel perkara, kebalikan dari yang dijanjikan komentarnya sendiri, dan lingkup waktunya dihitung ulang di dalam kesembilan belas kuerinya. Sekarang 6,6 detik untuk 88 tag (dari 53), triwulan 2,4 detik, dan lingkup yang kosong 0,07 detik dengan satu kueri. Angka tiap tag dibuktikan TIDAK berubah: seluruh katalog dijalankan dengan kedua bentuk berdampingan atas delapan lingkup, dan 50 dari 53 tag lama sama persis - tiga sisanya memang tag yang syaratnya dibetulkan.",
      "ANGKA \"PERKARA COCOK\" SALAH 27% KETIKA DUA TAG PADAT DIGABUNG. Irisannya dihitung dari daftar id yang dipagari 3.000, jadi dua daftar yang terpotong menghasilkan irisan yang terpotong dua kali: verstek dan sudah-diarsipkan memulangkan 1.680 padahal sesungguhnya 2.302 - 622 perkara hilang, dan angka itulah yang digambar layar. Pagunya diukur ulang dan alasan lamanya ternyata salah: daftar 9.993 id justru TERMURAH (88 ms) dibandingkan 3.000 id (847 ms). Sesudah pagunya dinaikkan, irisan yang sama memulangkan 2.302 - sama persis dengan COUNT langsung di SQL.",
      "DUA TAG AKTA CERAI BERJANJI \"akta sudah terbit\" TETAPI TIDAK PERNAH MEMERIKSA TANGGALNYA, sehingga 80 baris akta yang belum pernah diterbitkan dilaporkan sebagai akta yang sudah terbit dan belum diambil - yang mengejarnya akan mencari berkas yang tidak ada. Keduanya berkurang tepat 80, dan ke-80 itu tidak hilang: diberi tagnya sendiri di kelompok Mutu data. Sekalian, tag \"Sandi relaas tak dikenal\" ternyata MEMAAFKAN sandi N yang justru tidak ada di komentar kolom SIPP - sandi yang seharusnya ia temukan; 12 menjadi 22.",
      "PERMINTAAN PENGHITUNGAN TAG YANG TIDAK PERNAH DIBATALKAN. Mengganti dua pemilih pada panel - dua klik biasa - menjalankan 38 kueri berat serentak di SIPP, sementara kolam sambungan bot hanya 10; sisanya mengantre, termasuk kueri petugas lain. Sekarang permintaan yang ditinggalkan benar-benar dibatalkan, dan jawaban yang lambat tidak lagi menimpa hasil yang baru.",
      "TANGGAL MURNI DICETAK DENGAN JAM KARANGAN pada Kendali Berkas: \"7 Okt 2026, 00.00\" bila dilukis server dan \"7 Okt 2026, 08.00\" bila dilukis peramban - dan karena kedua lukisan berbeda teksnya, React membatalkan lukisan server sehingga layar berkedip. Jam 00.00 itu karangan bentuk penyimpanan, bukan data SIPP.",
    ],
    security: [
      "Tidak ada satu potongan SQL pun yang datang dari peramban pada menu tag yang baru: katalognya TERTUTUP di bot, kunci yang tidak ada di dalamnya dibuang dengan Object.hasOwn, jumlah tag sekali kirim dipagari delapan, dan tanggalnya selalu diikat sebagai parameter - dasar tanggal yang tidak dikenal jatuh ke tanggal pendaftaran, bukan menjadi teks SQL.",
      "Error kueri pada penghitung tag tidak lagi ditelan, dan pesannya menyebut nama tabel, kode error SQL, serta DAFTAR TAG yang ikut hilang. Sebelumnya satu kolom yang berganti nama membuat \"Belum ada relaas\" menampilkan 10.120 - seluruh register - dengan tampilan yang sama meyakinkannya seperti angka yang benar.",
    ],
    operationalNotes: [
      "MIGRASI 0050_aleta_tipe_keluaran (dua tabel). aleta-update.sh melewati migrasi tanpa ALETA_RUN_DB_MIGRATIONS=1 tetapi ensureAletaSchema membuat tabelnya saat boot; sesudah pasang periksa SELECT count(*) FROM aleta_tipe_keluaran. Nomor migrasi bebas berikutnya 0051.",
      "PENGATURAN ABT DI SATKER (keputusan pengguna): menu blangko 'Blangko Derry' (abt_menu 900) hanya mengizinkan grup 1|10|20 - juru sita (600) dan koordinator delegasi (650) ditolak ABT untuk SELURUH blangko relaas. Blangko ikrar [JS] 4 berada di menu relaas yang hanya menerima proses 80-220, sehingga ikrar ditolak; naikkan rentangnya atau pindahkan blangko ke menu 25.",
      "Cetak relaas memerlukan citra bot yang dibangun ulang (rute /sipp/relaas-cetak) dan ekstensi 1.168.0. Uji manual wajib: masuk ABT sebagai juru sita lalu cetak dua dokumen dari Antrian Sidang.",
      "SEJAK VERSI INI ALETA TIDAK MENAMBAH POLA YANG MENIRU KERJA MANUSIA di SIPP, ABT, atau e-Court: jeda tiruan manusia dibuang, jeda yang tersisa punya guna sendiri (beban server), dan baris audit unggahan menyebut ALETA beserta pengguna dan IP yang sebenarnya.",
      "Tabel baru aleta_bot_ecourt_kunjungan dibuat SENDIRI saat pertama kali dipakai - tidak ada migrasi yang perlu dijalankan tangan, sama seperti aleta_bot_ecourt_putusan. Ia mencatat perkara e-Court yang halamannya sudah dibuka beserta jumlah dokumen yang terlihat, dan itulah yang membuat giliran penarikan dapat berputar.",
      "Layar Admin Integrasi e-Court menambah kira-kira 2,7 detik pada pemuatannya, sebab pertanyaan \"apakah lengkap\" tidak dapat dijawab tanpa penyebutnya dan penyebutnya harus dibaca dari SIPP. Sengaja TIDAK disinggahkan: angka basi yang tampil sebagai angka sekarang justru cacat yang sedang dibetulkan. Seluruhnya dibungkus penahan error, jadi SIPP yang lambat atau mati tidak mengosongkan angka di sebelahnya.",
      "Ekstensi SIPP naik ke 1.168.0 pada rilis yang sama (1.167.0 tidak pernah dirilis sendiri). Ekstensi unpacked tidak memperbarui dirinya - tekan Reload pada chrome://extensions sesudah berkasnya disalin.",
    ],
    knownLimitations: [
      "Umur perkara pada Antrian Sidang dan \"Lama perkara\" pada Status Perkara dapat berbeda sampai 120 hari untuk perkara ghaib yang sama, dan itu DISENGAJA: yang pertama memotong kelonggaran SK Dirjen Badilag 048/2024 sebab ia mengukur kinerja waktu putus, yang kedua tidak memotongnya sebab batas lima bulan SEMA 2/2014 tidak mengenal kelonggaran. Grafik umur perkara menerangkannya di layar; sebelum rilis ini tidak ada satu kalimat pun yang menyebutkannya.",
      "Ambang lima bulan SEMA masih dihitung dua cara: Antrian Sidang memakai hari di luar mediasi ditambah hari pendaftaran, sedangkan peringatan SEMA di Status Perkara memakai hari berjalan mentah. Terukur berselisih pada 1 dari 127 perkara berjalan - 273/Pdt.G/2026 bertanda \"melewati lima bulan\" di satu layar dan bersisa 40 hari di layar lain, pada hari yang sama.",
      "Rata-rata dokumen per perkara pada taksiran waktu penarikan belum pernah dapat DIUKUR di satker ini - angka cadangan 6 dokumen per perkara yang dipakai, dan layar menyatakannya terang-terangan. Ia akan terukur sendiri begitu ada satu baris dokumen tercatat.",
      "Delapan pendaftaran e-Court yang bermasalah dan belum pernah menjadi perkara (2 menunggu, 3 ditolak, 3 tidak dapat dilanjutkan) belum dapat ditampilkan: jembatan mengikat pendaftaran ke perkara dengan INNER JOIN, jadi pendaftaran tanpa perkara mustahil ikut. Keempat yang sudah menjadi perkara ditampilkan, dan keempatnya sudah selesai bertahun lalu - jadi ini selisih catatan, bukan perkara yang terancam disidangkan.",
      "Relaas berbentuk pindaian gambar tidak masuk ZIP unduhan - terukur 2.172 berkas pada 933 perkara. Daftar ekstensi yang boleh dialirkan bot sengaja tertutup pada pdf/doc/docx/rtf/odt; melebarkannya melebarkan pula apa yang dapat diambil dari akar SIPP, dan itu keputusan yang harus diambil sadar.",
      "eslint tidak menyisir satu pun berkas di aleta_bot - setelannya hanya berlaku di dalam manajemen_surat. Jadi seluruh layanan bot tidak punya liputan lint sama sekali; yang menjaganya node --check, skrip verify-*, dan uji penjaga.",
    ],
    details: [
      {
        title: "Panel tag: mengapa ia berdiri lebih dahulu tanpa angkanya",
        items: [
          "Menghitung 88 tag memakan 6,6 detik pada lingkup \"Seluruhnya\" - sembilan belas kueri yang harus menyisir tabel anaknya. Itu sudah 3,8 kali lebih murah daripada sebelumnya untuk 66% lebih banyak tag, tetapi tetap enam setengah detik.",
          "Katalognya sendiri - nama tag, kelompok, nada, penjelasan - adalah tetapan yang dibekukan di bot dan tidak menyentuh basis data sama sekali. Karena itu ia diminta TERPISAH dan panel berdiri seketika dengan seluruh chipnya, bertanda \"…\" pada tempat angkanya, lalu angkanya menyusul.",
          "Chip yang belum berangka TETAP dapat ditekan, dan itu disengaja: pencariannya tidak menunggu angkanya. Mematikan chip selama menghitung berarti panel yang berdiri seketika tetap tidak dapat dipakai selama enam setengah detik pertama - yaitu cacat yang sama dengan wujud yang berbeda.",
          "\"Belum dihitung\" dibedakan dari \"nol\": yang belum dihitung digambar \"…\" dan dapat ditekan, yang sudah dihitung dan bernilai nol dimatikan tetapi TETAP TAMPAK - membuangnya membuat daftarnya berubah bentuk tiap rentang waktu diganti, dan petugas kehilangan jejak tag yang kemarin ada.",
          "Dengan 88 tag dalam 12 kelompok, memindainya dengan mata lebih lambat daripada mengetik tiga huruf - jadi ada kotak \"Saring nama tag\", yang mencocokkan LABEL maupun PENJELASANNYA (kata yang dicari orang - \"BHT\", \"panjar\", \"ikrar\" - belum tentu ada di labelnya). Tag yang menyala tetap berlaku walau tersaring keluar dari pandangan, dan itu dikatakan di layar.",
        ],
      },
      {
        title: "Mengapa penjaga uji batch ini tidak menahan apa pun",
        items: [
          "Tiga kali dalam satu batch, penjaga yang HIJAU berdiri di atas kode yang melempar error atau memakan puluhan detik. Sebabnya satu: penjaga itu menyisir TEKS SUMBER dan tidak pernah menjalankan yang diujinya. Selama nama fungsinya masih tertulis, ia hijau.",
          "Kolom pengurutan \"Register e-Court\" melempar ERROR 1247 dan mengosongkan tabel Kendali Berkas, sementara 18 ujinya lulus - yang diperiksa hanya bahwa kunci \"register\" tercantum di daftar kolom.",
          "Penghitung tag memakan 14,7 detik panas dan 44,1 detik dingin, sementara 44 ujinya lulus - ongkos tidak menghasilkan error apa pun untuk disisir.",
          "Uji unduhan ZIP lulus 13 dari 13 tanpa pernah membuka satu byte ZIP; ia akan tetap lulus seandainya seluruh 26 CSV keluar berisi baris kepala saja.",
          "Karena itu penjaganya diganti caranya, bukan ditambah jumlahnya: kueri pengurutan dijalankan sungguhan untuk ketujuh kolom pada kedua arah, rute ZIP dipanggil lalu ZIP-nya dibuka entri per entri, kueri dibuat MELEMPAR untuk membuktikan errornya dicatat dan bukan ditelan, dan tiap penjaga baru dibuktikan MENGGIGIT dengan memasang kembali cacatnya satu per satu lalu melihatnya merah.",
          "Satu penjaga yang menyisir teks tetap ditulis - penyisir ISO telanjang pada layar - sebab yang dijaganya memang bentuk penulisan, bukan perilaku. Penyisirnya sendiri diuji atas baris yang sengaja salah: penjaga yang tidak pernah dapat menangkap apa pun akan selalu hijau, dan hijau semacam itu lebih berbahaya daripada tidak ada penjaga.",
        ],
      },
      {
        title: "Bentuk tanggal: mengapa nama harinya dihitung tanpa zona waktu",
        items: [
          "Halaman pertama dilukis SERVER di dalam Docker dengan zona UTC, lalu dilukis ulang PERAMBAN dengan zona WITA. new Date(\"2026-10-07\") dibaca sebagai tengah malam UTC, dan nama harinya menurut zona mesin - jadi kedua lukisan dapat menyebut nama hari yang berbeda untuk tanggal yang sama, dan React membuang lukisan servernya.",
          "Karena itu pustaka tanggalnya tidak menyentuh zona sama sekali: angkanya diambil dari teksnya, harinya dihitung dengan Date.UTC dan getUTCDay - jawaban yang sama di mesin mana pun. Pertanyaan yang MEMANG butuh zona (\"sekarang tanggal berapa di Donggala\") tetap dijawab pustaka waktu pengadilan.",
          "SIPP menyimpan tanggal kosong sebagai 0000-00-00 - terukur 1 dari 20.109 baris jadwal sidang. Tanggal itu DITOLAK, bukan diterjemahkan menjadi \"30 November -1\" yang terbaca seolah data sungguhan.",
          "Sebelas ruas yang tertinggal ISO dibungkus pada putaran kedua, dan empat di antaranya berdampingan dengan ruas yang sudah dibungkus - panel Mediasi membaca \"Laporan mediator: 2026-09-08\" tepat di atas \"Kesepakatan perdamaian: Sel, 08-09-2026\" pada 210 perkara. Itu lebih buruk daripada sebelum butir ini dikerjakan, dan penyisir ISO sekarang menahannya.",
        ],
      },
    ],
  },
  {
    version: "2.35.0",
    title: "ALETA Judicia v2.35.0 - Empat Belas Permintaan, dan Relaas Sidang Lain yang Dinilai untuk Sidang Ini",
    date: "2026-09-24",
    status: "Terpasang",
    summary:
      "Empat belas permintaan pengguna pada layar Antrian Sidang dan Status Perkara - papan kuning dihapus, aturan pukul 15:00, agenda e-Litigasi merah, warna umur perkara menurut SK Dirjen Badilag 048/2024, panel Rincian yang lebih ringkas, saklar Tampilan untuk yang baru, tombol Rincian berwarna, nomor sidang, dan grafik perjalanan sidang yang dapat dibaca. Yang terbesar ditemukan saat menelusuri butir 9: panel Rincian menilai relaas SIDANG LAIN untuk sidang yang dibuka - 115 sidang e-Court yang tergugatnya belum dipanggil tampil \"terkirim, patut\" karena relaas sidang sebelumnya.",
    added: [
      "Sesudah pukul 15:00:00 WITA, sidang yang hasilnya belum dicatat - belum ditunda, belum diputus, kolom hasilnya di SIPP masih kosong - masuk kotak Perlu diperiksa dan barisnya diberi tanda merah \"Belum ditunda\". Jamnya menurut zona pengadilan (Asia/Makassar), bukan zona komputer yang membuka layar, dan menyala tepat pada detiknya tanpa menunggu muat ulang. Sidang tanggal lampau yang belum dicatat ikut, sidang tanggal depan tidak pernah.",
      "Tulisan agenda merah pada sidang e-Litigasi - aturannya sama dengan kotak e-Litigasi, sehingga kotak yang berbunyi 4 menunjuk empat baris yang merah. Bukan seluruh perkara e-Court: 1.913 dari 1.923 sidang 2026 perkaranya e-Court, dan warna yang ada di tiap baris tidak membedakan apa pun.",
      "Warna umur perkara menurut tangga unsur Waktu Putus Perkara SK Dirjen Badilag 048/DJA/SK.KP3.4.3/IV/2024 - paling lama 3 bulan hijau, 4 bulan kuning, 5 bulan oranye, lebih dari 5 bulan merah - atas hari perkara berjalan di luar mediasi, sebagaimana didefinisikan pengguna. Tangganya ditulis sekali di bot dan dipakai juga penilaian SK di Status Perkara; dua aturan untuk satu pertanyaan pasti suatu hari berselisih.",
      "Tombol \"Sembunyikan semua\" di menu Tampilan, dan sebelas saklar baru untuk yang belum punya: agenda e-Litigasi merah, umur perkara, menunggu lama, sidang ke-N, tundaan dan hasil sidang, jam ambil antrian, tombol tunda|putus, tombol mediator, tombol Antrian, serta tombol kosong tunjuk konseptor dan keterangan (yang sudah berisi tetap tampil).",
      "Nomor sidang di tepi kiri Perjalanan sidang dan daftar berita acara di Status Perkara, diurutkan menurut nomor sidang SIPP; Court Calendar bernomor rencana 1..N beserta sidang ke berapa yang melaksanakannya.",
      "Grafik \"Umur perkara pada tiap sidang\" menggantikan grafik lama yang datar: angka pada sumbu, pita hijau/kuning/oranye/merah, jarak antar sidang (+N hari) di bawah tiap ruas, rentang mediasi diarsir, sidang yang belum berlangsung berongga, dan rincian tiap titik saat ditunjuk atau diketuk.",
    ],
    changed: [
      "Papan kuning \"Perlu ditindaklanjuti\" dihapus - fungsinya sudah ada di kotak Perlu diperiksa. Dua sifatnya dipindahkan supaya tidak hilang diam-diam: Perlu diperiksa kini tetap digambar walau nol, dan tetap terlihat saat kendali diciutkan.",
      "Lencana umur perkara hanya menyebut hari yang dihitung; keterangan \"(mediasi N hari dipotong)\" pindah ke panel Rincian. Angkanya kini menghitung hari pendaftaran sebagai hari ke-1 - cara SK dan layar Status Perkara - sehingga naik satu hari.",
      "Panel Rincian: \"Rincian waktu perkara\" dipindah ke paling bawah, dan seluruh bagian di bawah \"Seluruh jadwal sidang perkara ini\" terciut sebagai bawaan. Kuncinya diganti supaya bawaan baru berlaku juga bagi yang pernah membukanya; kepala bagian yang terciut menyebut ringkasan isinya.",
      "Tombol Rincian berwarna primer selama rinciannya terbuka dan kembali ke rupa semula saat ditutup - di Antrian Sidang dan di Mediasi.",
      "Sidang pertama tidak lagi dihitung e-Litigasi: persetujuan bersidang elektronik baru diketahui PADA sidang pertama. 58 dari 311 sidang yang dahulu tertandai sepanjang 2026 adalah permohonan sidang-sehari yang agendanya menyebut \"Kesimpulan\".",
      "Kotak kuning Belum tunda tidak lagi menagih sidang ikrar talak yang sudah dicatat \"telah ikrar talak\", maupun yang ikrarnya tercatat di tabel ikrar talak pada tanggal sidangnya.",
    ],
    fixed: [
      "\"DIPANGGIL LEWAT ELEKTRONIK (e-SUMMONS)\" pada tergugat yang dipanggil surat tercatat. Sandi relaas 'E' di SIPP dibaca sebagai bukti e-Summons terkirim, padahal tergugatnya tidak punya email di e-Court dan e-Court tidak pernah mengirim apa pun kepadanya. Tuduhan salah saluran kini menuntut e-Summons yang TERCATAT di e-Court; tanpanya salurannya tidak ditebak, dan catatan abu-abu menyarankan sandi relaasnya dibetulkan.",
      "PANEL RINCIAN MENILAI RELAAS SIDANG LAIN. Relaas seluruh perkara dipetakan per nama dan yang terakhir menang, sehingga sidang yang belum ada relaasnya tampil \"terkirim, patut\" berkat relaas sidang sebelumnya - 115 sidang e-Court sejak 2025 - dan sidang lama dinilai dengan relaas sesudahnya. Kini hanya relaas untuk sidang itu yang dinilai, sama seperti daftar jadwal sejak awal.",
      "Pencocokan tanggal e-Summons tidak pernah cocok: tanggalnya tiba sebagai Date, dan String(Date) berbunyi \"Wed Sep 23\", bukan \"2026-09-23\". Yang terpakai selalu e-Summons PERTAMA pihak itu.",
      "Relaas bersandi kosong tidak lagi ditebak \"panggilan biasa\" lalu dituduh salah saluran pada penggugat e-Court.",
      "Nomor \"Sidang ke-N\" pada Relaas panggilan di Status Perkara dihitung dari urutan kelompok relaas, bukan nomor sidangnya - relaas sidang ketujuh tertulis \"Sidang ke-2\". Salah pada 510 dari 5.086 perkara berelaas.",
      "Status Perkara menilai panggilan dengan relaas seluruh perkara terhadap tanggal sidang terakhir; kini terhadap sidang terakhir yang punya relaas, beserta sisi yang wajib dipanggil.",
      "Tenggang mepet - kotak merah sejak 2.34.0 - kini terdaftar sebagai saklar wajib di menu Tampilan; selama satu rilis panel itu diam tentangnya.",
      "Tinjauan sebelum pasang menemukan sebelas cacat pada rancangan rilis ini sendiri, seluruhnya diperbaiki sebelum dipasang. Yang terberat: menilai relaas per sidang membuat pihak yang hadir pada sidang sebelumnya dihitung \"tidak patut\" dan bertanda merah \"belum dapat dinilai\" - kini tidak dinilai, dan rubrik Status Perkara hanya membagi dengan pihak yang wajib dipanggil; memotong pengecualian ghaib dari umur perkara menyembunyikan perkara yang sudah lewat lima bulan SEMA - kini tidak dipotong; dan tanda merah 15:00 akan menuduh sidang yang sudah diputus bila peta putusan gagal dibaca - kini bot melaporkan keterbacaannya dan tanda merah diam bila tidak terbukti.",
    ],
    security: [],
    operationalNotes: [
      "Bot dan portal sama-sama berubah; tidak ada migrasi. Warna SK, catatan saluran, dan ikrar tercatat baru muncul sesudah citra bot dibangun ulang - portal baru dengan bot lama menampilkan lencana umur tanpa warna, tanpa error.",
      "Keadaan ciut panel Rincian memakai kunci baru (-v2): bagian yang pernah dibuka akan terciut sekali, lalu pilihan tiap orang diingat lagi.",
    ],
    knownLimitations: [
      "Aturan 15:00 berlaku juga bagi sidang yang dijadwalkan pukul 15:00 atau sesudahnya - diukur 96 jadwal sejak 2025, kebanyakan pertukaran e-Litigasi. Batasnya dipasang persis seperti diminta.",
      "Warna umur perkara di Antrian Sidang tidak memotong pengecualian perkara khusus SK (ghaib 120 hari, mafqud, izin atasan), sebab angkanya didefinisikan \"perkara berjalan di luar hari mediasi\" dan batas lima bulan SEMA tidak mengenal pengecualian itu. Penilaian SK di Status Perkara memotongnya, sehingga perkara ghaib dapat bernilai lebih baik di sana.",
      "Hari mediasi di Antrian Sidang dibaca dari catatan mediasi SIPP (dibatasi 60 hari), sedangkan Status Perkara membaca angka SIPP yang menghitung mediasi tanpa laporan mediator sampai hari ini - pada perkara lama yang laporan mediatornya kosong kedua angka berbeda, dan grafiknya menyebutkannya.",
    ],
  },
  {
    version: "2.34.0",
    title: "ALETA Judicia v2.34.0 - Sebelas Permintaan, dan Sebelas Penurun Sebutan yang Berselisih",
    date: "2026-09-23",
    status: "Terpasang",
    summary:
      "Sebelas permintaan pengguna dikerjakan sekaligus - papan hari ini, tanda menunggu lama, arsip ZIP dua sumber, tanggal sidang tiap dokumen e-Court, hitung mundur tenggang panggilan, sebaran relaas per juru sita, sebutan para pihak, layar antrian tanpa login, unggah putusan yang berhenti sebelum mulai, durasi perkara tanpa hari mediasi, dan saklar cetak ABT yang tidak menuruti keadaannya. Yang terbesar bukan salah satunya: sebelas tempat menurunkan sebutan para pihak dengan tujuh aturan berbeda, dan lima di antaranya salah pada 21% sampai 55% perkara satker.",
    added: [
      "Papan \"hari ini beres atau belum\" di atas daftar sidang - satu baris, tiap angka dapat ditekan, dan tetap tampil walau nol. Angkanya diambil dari hitungan yang sudah ada; hitungan kedua akan berbeda dari yang pertama suatu hari, dan tidak ada pada layarnya yang memberi tahu mana yang benar.",
      "Tanda \"sudah menunggu N menit\" pada kolom antrian, dihitung basis data mesin antrian sendiri - bukan Node, bukan jam PC petugas. Ambangnya 40 menit atas permintaan pengguna (catatan ini semula menulis 30 - angka rancangan awal yang diganti sebelum dipasang).",
      "Arsip ZIP satu tekan kini memuat DUA sumber - gugatan, relaas beserta resi pos, berita acara sidang, putusan, lampiran, dan berkas e-Court - berkelompok menurut jenisnya beserta daftar isi. Sebelumnya hanya e-Court, sehingga perkara yang tidak pernah lewat e-Court dijawab 404 walau 41 relaas dan 8 berita acaranya tersimpan rapi.",
      "Kotak keadaan \"Tenggang mepet\" pada layar Jadwal Sidang, beserta hitung mundur H-3 di barisnya. Aturannya dipinjam dari mesin kepatutan yang sudah ada - elektronik 3 hari kalender, surat tercatat 6 hari kalender dan wajib terbukti diterima, biasa 3 hari kerja. Diukur atas 20 sidang empat belas hari ke depan: 6 menyala.",
      "Sebaran relaas per juru sita di halaman Peta Perkara - siapa mengerjakan berapa, di berapa desa, dan berapa yang kembali. Terukur pada 2026: tiga juru sita membagi 2.337 relaas hampir rata (793, 788, 756) tetapi returnya 5,7%, 0,3%, dan 5,3%.",
      "Layar antrian sidang yang dapat dibuka TANPA LOGIN, beserta pengaturan di admin tentang ruas mana yang boleh tampil. Bawaannya seluruhnya tampil sebagaimana diminta; empat ruas yang menyangkut identitas ditandai \"peka\" tiap kali pengaturannya dibuka.",
      "Durasi perkara berjalan di bawah agenda, dan rinciannya lengkap di panel Rincian - dengan hari mediasi TIDAK dihitung, sebagaimana PERMA 1/2016 Pasal 24.",
      "Nomor sidang di kiri daftar relaas, berita acara, dan dokumen e-Court.",
    ],
    changed: [
      "Urutan bawaan daftar sidang mengikuti nomor antrian; yang belum bernomor turun ke bawah tanpa diacak.",
      "Pemeriksa keutuhan berkas kini mengenali PDF yang terpotong - berkas yang awalannya benar tetapi tanpa penutup %%EOF selama ini dinyatakan sah dan baru ketahuan ketika hakim membukanya. PDF hasil pindai ditandai \"diduga\", dan dugaan itu tidak pernah menolak berkasnya.",
      "Batas ukuran berkas dipisah per bentuk - PDF 5 kB, dokumen Word 3 kB. Satu angka untuk keduanya terlalu longgar bagi docx: wadah ZIP yang sah pun sudah lebih dari 3 kB sebelum satu huruf ditulis di dalamnya.",
    ],
    fixed: [
      "SEBELAS PENURUN SEBUTAN PARA PIHAK disatukan menjadi satu sumber. Diukur atas seluruh 10.120 perkara satker, dibandingkan dengan kueri ABT sendiri: kelengkapanDataService salah pada 5.254 (51,9%), caseDirectoryService 5.581 (55,1%), penyusunPertimbangan 4.415 (43,6%), isian-putusan-sipp 3.999 (39,5%), jlf-variable-resolver 1.178 (11,6%). Aturan baru: 0 dari 10.120. Sebab utamanya sepele dan tidak pernah tertangkap uji - SIPP menulis \"Istbat Nikah\" sedangkan seluruh pola ALETA menulis \"itsbat\", dan 3.972 perkara luput karena satu huruf.",
      "UNGGAH PUTUSAN YANG BERHENTI PADA \"akar_sipp_belum_disetel\". Diukur di server dan ditemukan DUA halangan: pengaturan folder SIPP bernilai null, dan folder itu terpasang hanya-baca sehingga menyetelnya saja hanya memindahkan errornya satu langkah. Kini folder SIPP punya cadangan dari mount yang memang sudah ada, keadaan hanya-baca dibedakan dari belum-disetel, dan dua folder putusan dibuka untuk ditulis di docker-compose.",
      "TANGGAL SIDANG TIAP DOKUMEN e-COURT tidak pernah terisi, dan agenda seluruh dokumen satu perkara berisi agenda TERAKHIR perkara itu. Halaman e-Court sebenarnya menuliskan tanggalnya dengan jelas per blok agenda; yang hilang penyambungnya. Sinkronisasi juga berhenti MENGOSONGKAN kembali tanggal yang sudah benar.",
      "PENETAPAN IKRAR TALAK tidak pernah dapat diunduh: kuerinya mencari kolom \"id\" pada perkara_ikrar_talak, dan tabel itu tidak punya kolom bernama begitu - kunci utamanya perkara_id. Kegagalannya ditelan .catch(), jadi tombolnya hanya tidak pernah muncul.",
      "Nama juru sita pada peta relaas salah pada 61,6% baris yang bernama, dan dua juru sita tersibuk tidak pernah muncul sama sekali.",
    ],
    security: [
      "Layar antrian tanpa login: pengaturan yang TIDAK terbaca jatuh ke bentuk paling sempit, bukan ke bawaan \"semua tampil\". Ruas peka yang tampil karena kegagalan pembacaan adalah ruas yang tidak pernah diputuskan siapa pun.",
      "Hanya Admin atau Super Admin yang dapat mengubah ruas mana yang tampil tanpa login, dan tiap perubahan tercatat beserta nama penulisnya.",
      "Rute antrian per ruang yang lama TIDAK ikut berubah - televisi ruang tunggu yang sudah berjalan tetap menjawab empat hal saja.",
      "Dua folder SIPP dibuka untuk ditulis, dan hanya dua: resources/file/doc dan resources/file/anonimisasi. Pohon SIPP selebihnya tetap hanya-baca.",
    ],
    operationalNotes: [
      "Migrasi 0049_antrian_publik menambahkan tabel pengaturan layar antrian tanpa login, dengan satu baris bawaan yang seluruh ruasnya menyala.",
      "docker-compose.yml berubah dan TIDAK dikirim skrip pemasangan - dua mount baru harus dipasang di server secara terpisah, lalu container bot dijalankan ulang.",
      "Berkas e-Court lama belum bertanggal sidang. Jalankan scripts/isi-tanggal-sidang-dokumen.js untuk mengisinya dari SIPP; tanpa --tulis ia hanya melapor, dan --periksa membuktikan anggapannya.",
    ],
    knownLimitations: [
      "Bawaan layar antrian tanpa login adalah SELURUH ruas tampil, termasuk nomor perkara dan nama para pihak - diminta dengan tegas. Dengan bawaan itu keduanya dapat dibaca siapa pun yang dapat membuka alamatnya, tanpa jejak siapa yang membacanya. Matikan yang tidak diperlukan televisi ruang tunggu.",
      "Papan \"hari ini\" berlingkup sidang hari yang dibuka, bukan tunggakan seluruh perkara. Diukur: \"belum minutasi\" bernilai nol pada tiap hari sidang yang diperiksa, sehingga angka besar pada contoh permintaan hanya mungkin bila lingkupnya se-satker - dan lingkup itu belum ada sumbernya.",
      "Dugaan \"hasil pindai\" dihitung dari byte mentah PDF tanpa menguraikannya. Jawaban yang jujur menuntut pustaka PDF di bot, yang belum ada.",
    ],
  },
  {
    version: "2.33.0",
    title: "ALETA Judicia v2.33.0 - Tiga Aturan yang Saya Karang Sendiri, dan Semuanya Salah",
    date: "2026-09-22",
    status: "Belum terpasang",
    summary:
      "Delapan permintaan pengguna, dan tiga di antaranya mencabut aturan yang ALETA karang " +
      "sendiri tanpa memeriksa datanya: putusan harus PDF, saluran panggilan ditebak dari resi " +
      "pos, dan keterangan saksi hanya mengenal Penggugat/Tergugat. Ketiganya diukur ulang " +
      "terhadap basis data satker, dan ketiganya meleset jauh - yang pertama menolak 96,8% " +
      "naskah yang sah, yang kedua salah pada 69% baris, yang ketiga membutakan 331 perkara.",
    added: [
      "TOMBOL TINDAKAN DAPAT DICIUTKAN SENDIRI lewat ikon, terpisah dari tombol Ciutkan yang menyembunyikan seluruh kendali. Yang diciutkan barisnya benar-benar hilang, sehingga deretan kotak penanda naik menempati tempatnya - persis yang diminta. Ikon pembentangnya pindah ke deretan itu: tombol yang menyembunyikan dirinya tanpa jalan kembali mengubah penciutan menjadi penghapusan.",
      "RTF, DOC, DAN DOCX DITERIMA pada unggah putusan. PDF untuk Direktori Putusan dibuat ALETA sendiri lewat pengubah yang sudah lama ada - dengan folder sekali pakai, batas 20 MB, batas 90 detik, dan hasil yang diperiksa harus diawali %PDF sebelum satu berkas pun ditulis.",
      "SALURAN PANGGILAN \"Pengumuman\" ditambahkan sebagai jalur tersendiri - radio, media massa, papan pengumuman pengadilan, dan papan pengumuman Pemda. Keempatnya dulu jatuh ke salah satu dari tiga nama yang ada, paling sering ke \"Elektronik (e-Summons)\".",
    ],
    changed: [
      "KOTAK PENCARIAN TIDAK LAGI SELEBAR LAYAR, dan Pencarian lanjutan duduk di sebelahnya bersama angka \"x dari y\" serta tombol Reset. Kotak selebar layar menjanjikan isian sepanjang itu, padahal yang diketik orang nomor perkara atau satu nama - dan barisnya menjadi baris yang isinya satu benda saja.",
      "PERKARA SAYA, TAMPILAN, RINGKAS/LENGKAP, DAN CIUTKAN pindah ke kanan baris judul. Sebelumnya baris nama pengguna memaksa pembungkusan, dan kelompok tombol terdorong ke baris ketiga tempat rata-kanan tidak berpengaruh apa pun. Satu baris lebih hemat.",
      "TOMBOL LAYAR RUANG TUNGGU berganti nama dari \"Tampilan\" menjadi \"Layar antrian\". Dua tombol sewarna dan sebentuk dengan satu nama pada layar yang sama, mengerjakan hal yang sama sekali berbeda: yang satu menyetel kepadatan daftar, yang lain membuka layar untuk televisi ruang tunggu.",
    ],
    fixed: [
      "PUTUSAN RTF DITOLAK PADAHAL ITULAH YANG LAZIM. ALETA menolak apa pun yang bukan PDF, dengan alasan yang saya tulis sendiri: \"yang terbit di Direktori Putusan harus PDF, dan ALETA tidak menjalankan pengubah itu\". Kedua bagian alasan itu salah. Diukur pada perkara_putusan.amar_putusan_dok satker, 9.903 nilai terisi: .rtf 8.686 (87,7%), .docx 458, .doc 442, .pdf hanya 315 (3,2%). PDF justru yang paling jarang. Dan pengubahnya SUDAH ADA sejak lama, dipakai dokumen penetapan.",
      "SATU NASKAH MENGHASILKAN DUA BERKAS, dan dulu keduanya diisi jalur yang SAMA. SIPP menyimpan berkas asli sebagai e-Doc dan PDF hasil konversinya untuk Direktori Putusan - diperiksa pada perkara September 2026 satker: satu perkara memegang ..._putusan_akhir.RTF pada kolom e-Doc dan ..._putusan_akhir.PDF pada dirput_dokumen. Mengisi keduanya dengan satu jalur membuat Direktori Putusan menunjuk berkas yang tidak dapat dibacanya - dan 26 baris .rtf yang ada di dirput_dokumen satker adalah bekas kegagalan itu, salah satunya sudah terbit.",
      "SALURAN PANGGILAN DITEBAK DARI RESI POS, bukan dibaca dari sandinya. Aturannya: ada resi berarti surat tercatat, tidak ada resi berarti - pada perkara e-Court - panggilan elektronik. Terukur salah pada 7.839 dari 11.371 baris (69%) yang mungkin kena label \"Elektronik (e-Summons)\" - termasuk 5.084 relaas yang jurusitanya BERTEMU LANGSUNG dengan orangnya. Sekarang sandi ket_temu yang menentukan.",
      "2.681 PANGGILAN YANG GAGAL DIHITUNG SAMPAI. Sandi T (tidak bertemu, 2.667 baris) dan N (tidak dapat dilaksanakan, 14) TETAP punya tanggal relaas - jurusita mencatat pelaksanaannya walau tidak bertemu siapa pun - dan aturan lama membaca tanggal itu sebagai bukti penerimaan. Di atas angka itulah kepatutan panggilan dinilai. Sidang yang berjalan atas dasar panggilan yang tidak pernah sampai adalah kerugian pada perkara orang.",
      "DUA SANDI RELAAS SAYA ARTIKAN KELIRU pada 2.32.0. Sandi S saya baca \"Diterima orang serumah\" - itu teks bebas yang kebetulan sering menyertainya - padahal artinya SURAT TERCATAT (POS). Sandi M saya baca \"Radiogram RRI\" padahal \"media massa cetak/elektronik\". Keduanya kini diambil dari komentar kolom ket_temu pada skema SIPP, satu-satunya definisi resmi yang ada. Sandi E memang benar berarti elektronik - dikuatkan 3.532 baris yang seluruhnya tanpa resi pos.",
      "KETERANGAN SAKSI TIDAK TERBACA PADA PERMOHONAN DAN CERAI TALAK. Mesinnya hanya mencari untai \"tergugat\" dan \"penggugat\"; kalimat \"Yang meninggalkan tempat tinggal bersama adalah Termohon\" DITEMUKAN - kutipannya tetap tampil - tetapi nilainya kosong dan lencananya berbunyi \"tidak ditemukan\". Terukur pada 66.506 jawaban saksi ABT: dari 4.337 yang memuat kata \"meninggalkan\", 846 (19,5%) hanya menyebut Pemohon/Termohon, menyentuh 331 perkara.",
      "BENTUK \"MENINGGALKAN RUMAH\" TIDAK PERNAH DICARI. Untai yang dicari hanya \"meninggalkan tempat\" dan \"meninggalkan kediaman\", sementara 442 jawaban berbunyi \"pergi meninggalkan rumah kediaman bersama\" - tidak cocok, sebab ada kata \"rumah\" di tengahnya.",
      "PIHAK YANG PERGI TERTUKAR pada penyusun fakta dari posita. Nama ruasnya menjebak: pelaku berisi variabel 0047 (Tergugat/Termohon) dan lawan berisi 0046 (Penggugat/Pemohon) - kebalikan dari yang disangka. Cadangan harfiahnya justru benar, jadi cacatnya hanya muncul ketika variabelnya sungguh terbaca, yaitu pada pemakaian normal. Jawaban \"siapa yang meninggalkan kediaman bersama\" masuk ke berita acara sidang yang ditandatangani.",
      "KALIMAT UPAYA DAMAI MEMATOK \"Penggugat dan Tergugat\" pada perkara yang pihaknya Pemohon dan Termohon - menyebut pihak yang tidak ada di perkaranya, pada kalimat yang masuk berita acara.",
    ],
    security: [],
    operationalNotes: [
      "TIDAK ADA MIGRASI BASIS DATA. Nomor Drizzle bebas berikutnya tetap 0049.",
      "MENCABUT CATATAN 2.32.0 yang berbunyi \"berkas putusan yang diunggah harus PDF, .rtf dan .docx ditolak\". Aturan itu keliru dan sudah dihapus; RTF, DOC, dan DOCX kini diterima.",
      "soffice (LibreOffice) HARUS ADA di dalam container bot supaya PDF Direktori Putusan dapat dibuat. Bila tidak ada, e-Doc TETAP tersimpan dan baris Direktori Putusan ditunda beserta sebabnya - bukan seluruh unggahan ditolak. Periksa dengan `docker exec aleta-bot soffice --version` sesudah pemasangan.",
      "PEMBACAAN SALURAN PANGGILAN YANG BARU MENGUBAH APA YANG TAMPIL pada relaas lama - tidak ada data yang diubah, hanya cara membacanya. Panggilan yang kemarin berbunyi \"Elektronik (e-Summons)\" dapat berubah menjadi \"Jurusita (panggilan biasa)\" atau \"Surat tercatat\"; itu pembetulan.",
      "EKSTENSI PERLU DI-RELOAD di chrome://extensions sesudah rilis ini.",
    ],
    knownLimitations: [
      "TOMBOL \"DAFTARKAN KE ANTRIAN\" TIDAK DIHAPUS, dan sengaja. Diminta pengguna memeriksa apakah ia berguna; jawabannya tidak dapat diukur dari sini - basis data aplikasi antrian (sipp_turunan_antrian) hanya hidup di jaringan satker dan tidak ada di salinan lokal. Yang diketahui: tombol itu satu-satunya jalur ALETA menulis ke aplikasi antrian, rancangannya berpihak pada tidak menulis (uji kering sebagai bawaan, hanya menambah, tidak menyentuh kolom milik mesin antrian), dan layar sendiri menunjukkan 24 dari 27 perkara sudah mengambil nomor. Yang belum diketahui: siapa yang mendaftarkan ke-24 itu. Bila aplikasi antrian menariknya sendiri dari SIPP, tombol ini memang tidak berguna - dan itu satu pertanyaan yang menjawab seluruhnya.",
      "PEMISAHAN e-DOC DAN DIREKTORI PUTUSAN BELUM DICOBA DI SIPP SUNGGUHAN - server sedang tidak tersambung saat perbaikan ini ditulis. Sesudah terpasang, unggah satu putusan RTF dan periksa di SIPP: kolom e-Doc harus menunjuk berkas .rtf, dan Direktori Putusan menunjuk .pdf dengan nama pokok yang sama.",
      "PENGHAPUS e-DOC MILIK SIPP hanya menghapus satu berkas. Sejak satu naskah menghasilkan dua berkas dengan nama pokok yang sama, menghapus e-Doc dari SIPP akan meninggalkan PDF-nya di cakram. Tidak berbahaya - barisnya ikut terhapus - tetapi patut diketahui.",
      "TATA LETAK BARU BELUM DILIHAT DI PERAMBAN. Layar ini menuntut sesi yang sah, dan kata sandi bukan sesuatu yang boleh saya pegang; yang diperiksa hanya tsc, eslint, dan penjaga tata letaknya. Perhatikan pada pemakaian pertama: rata-kanan kelompok tombol kepala pada layar sempit, dan naiknya deretan penanda saat baris tindakan diciutkan.",
    ],
  },
  {
    version: "2.32.0",
    title:
      "ALETA Judicia v2.32.0 - Dua Puluh Satu Permintaan, dan Tiga Cacat yang Gagal dalam Diam",
    date: "2026-09-22",
    status: "Terpasang",
    summary:
      "Dua puluh satu permintaan pengguna, dikerjakan dalam dua putaran. Di antaranya TIGA cacat " +
      "yang sama-sama gagal dalam DIAM - tanpa satu pun error di layar, dan justru itu yang " +
      "membuat ketiganya bertahan: separuh relaas satker salah dilabeli dan dapat membuat sidang " +
      "ditunda tanpa sebab; daftar hakim pada tunjukan konseptor tidak pernah terisi sejak " +
      "fiturnya lahir; dan unggah putusan dari halaman perkara agama SELALU ditolak, setiap kali, " +
      "tanpa kecuali.",
    added: [
      "KETERANGAN PERKARA - catatan bebas di bawah tunjuk konseptor, dapat diisi siapa pun pegawai pengadilan. Tombolnya abu-abu ketika kosong dan MERAH ketika ada isinya; warnanya satu-satunya cara mengetahui ada catatan tanpa membuka apa pun, dan pada daftar dua puluh tujuh baris membuka satu per satu bukan pilihan. Isinya TIDAK tampil sampai ditekan - memajangnya di tiap baris mengubah daftar sidang menjadi daftar catatan.",
      "TIAP SUNTINGAN MENJADI PERUBAHAN BERNOMOR, bukan menimpa yang lama. Yang tampil perubahan terakhir beserta nama penulis, jabatannya, tanggal dan jamnya; keterangan sebelumnya tersembunyi sampai diminta, tersusun menurut nomornya. Sebabnya bukan kerapian: catatan semacam ini dibaca orang untuk mengambil keputusan - menunda sidang, menunggu berkas - dan ketika keputusan itu kelak dipertanyakan, yang ditanyakan justru apa tulisannya waktu itu. Menimpa baris lama menghapus jawabannya. Karena itu tabelnya tidak punya UPDATE maupun DELETE sama sekali.",
      "NAMA DAN JABATAN PENULIS DIAMBIL DARI SESI, tidak dapat diketik sendiri oleh pengirim - catatan ini dibaca sebagai keterangan resmi tentang perkara orang. Jabatannya DISALIN saat menulis, bukan dibaca ulang saat ditampilkan: jabatan orang berubah, dan membacanya ulang membuat catatan tiga bulan lalu tampak ditulis oleh jabatan yang baru dijabat pekan ini.",
      "REKAMAN ANTRIAN SIDANG - ALETA kini menyimpan sendiri urutan antrian, waktu pengambilannya, nama petugas yang melayani, dan jarak tiap perkara terhadap perkara sebelum maupun sesudahnya. Sebabnya: tabel antrian milik aplikasi ruang tunggu adalah tabel KERJA yang dipakai ulang tiap hari sidang, sehingga keadaan sebuah hari hilang begitu harinya lewat - dan pertanyaan yang paling sering ditanyakan tentang pelayanan (\"berapa lama para pihak menunggu bulan lalu\", \"hari mana yang ruangnya paling berdesakan\") tidak dapat dijawab sama sekali.",
      "JARAK KE PERKARA BERIKUTNYA, di samping jarak dari perkara sebelumnya yang sudah ada. Keduanya dibaca orang yang berbeda: yang menjaga ruang sidang melihat ke belakang - sudah berapa lama sejak perkara sebelumnya dipanggil; yang menyusun jadwal melihat ke depan - sesudah perkara ini berapa lama sampai yang berikutnya duduk, dan di sanalah penumpukan terlihat sebelum terjadi. Keduanya dihitung dari urutan yang SAMA, per ruang dan per hari.",
      "NAMA PETUGAS YANG MELAYANI PENGAMBILAN NOMOR kini digambar. Namanya sudah ikut terkirim dari aplikasi antrian sejak lama - tersimpan di dalam tipe, tidak pernah ditampilkan sekali pun.",
      "SATU KOTAK PENCARIAN menggantikan dua. Dulu ada \"Cari nomor perkara\" yang dikirim ke SIPP dan \"Saring di dalam hasil\" yang menyaring baris yang sudah termuat - dua kotak berbentuk sama, di layar yang sama, tanpa apa pun pada bentuknya yang memberi tahu mana yang mana. Sekarang: mengetik menyaring seketika, menekan Enter melebarkan pencarian ke SIPP. Kata kunci yang sedang berlaku di sisi SIPP disebutkan di bawah kotaknya beserta tombol melepasnya - tanpa itu, daftar yang menyusut karenanya akan disangka jadwal yang memang sepi.",
      "SAKLAR TAMPILAN BARU, dan dua di antaranya MATI sejak awal: Kolom Siap dan Catatan cara menghitung. Keduanya boleh mati sejak awal karena yang hilang bukan fakta tentang perkara, melainkan kalimat yang menerangkan cara ALETA menghitung - dan kolom Siap memang kosong sampai tombol Hitung skor ditekan. Keduanya tidak ikut dihitung pada angka \"berapa yang dimatikan\": lencana yang selalu menyala berhenti dibaca.",
      "UNGGAH PUTUSAN UNTUK STATUS SELAIN DIKABULKAN - cabut, gugur, tidak dapat diterima, digugurkan, ditolak. SIPP menyusun halaman Putusan Akhir BERBEDA menurut statusnya; panel kini menanyakan lebih dulu bagian mana yang benar-benar ada di blangko, hanya menggambar yang ada, dan menyebutkan ketiadaan yang lain beserta sebabnya.",
      "WARNA LENCANA STATUS PUTUSAN DIBEDAKAN. \"Gugur\" dan \"digugurkan\" adalah dua hal berbeda dan kini berwarna berbeda; dicabut dan dicoret punya warnanya sendiri. Satu warna untuk semua yang bukan dikabulkan membuat mata berhenti membedakannya.",
      "NOMOR SIDANG KEBERAPA pada riwayat panggilan dan seluruh jadwal sidang perkara - angka saja, di sisi kiri. Diturunkan dari jadwal perkaranya, bukan dari penomoran ulang daftar relaas: satu sidang dapat punya beberapa relaas, dan menomori relaasnya menghasilkan angka yang tidak pernah cocok dengan berkas perkara.",
      "JADWAL PERKARA YANG BERSIDANG beserta jabatan dan nama penggunanya, di kepala rincian.",
      "TOMBOL MEDIATOR di samping Tunda dan Putus, muncul hanya pada sidang yang berurusan dengan mediasi. Ambangnya DIUKUR, bukan dikira: pada 20.109 baris jadwal sidang satker, 841 menyebut mediasi di alasan tunda dan 619 di agendanya - 1.407 pada salah satunya. Karena itu keduanya dibaca; membaca alasan tundanya saja melewatkan 566 baris. Bendera ditunda TIDAK disyaratkan - 49 baris beragenda mediasi justru berbendera tidak-ditunda. Polanya akar kata, sebab tulisannya bebas dan banyak salah ketik: \"peroses mediasi\", \"Peoses Mediasi\", \"Proses Mediasin\" semuanya benar-benar ada di data.",
      "SAKLAR PANEL RINGKAS pada ekstensi, di samping deretan pintasan Alt. Menyembunyikan keterangan panjang yang dibaca sekali seumur hidup; tombol, isian, dan pesan error TETAP tampil.",
      "SEBAB MINUTASI MENYEBUT SIDANG KEBERAPA DAN AGENDANYA. Sebelumnya hanya \"Berita acara sidang belum ada sama sekali (1 sidang)\" - angka tanpa alamat. Sekarang tiap butir membawa sub-daftar yang menyebut sidangnya satu per satu. Angkanya tetap di kalimat induknya: \"2 dari 5\" dibaca sekilas, dan membenamkan lima nama sidang ke dalamnya justru menghapus angka itu dari pandangan.",
      "RELAAS IKUT MENJADI BUTIR MINUTASI - sebagai pelengkap, bukan penghalang. Berkas ini dulu menolak menghitung relaas dengan alasan kelengkapannya \"tidak terbaca\"; alasan itu sudah tidak benar, dan angka yang sama sudah lama dipajang panel sebagai \"Relaas berdokumen 4 dari 4\". Tetap pelengkap sebab yang terbaca ada tidaknya PINDAIAN relaas, bukan sah tidaknya panggilannya - menahan minutasi atas dasar itu berarti menahannya atas hal yang tidak diukur.",
      "DOKUMEN E-COURT DIPISAH menjadi \"Berkas jawab-menjawab\" dan \"Berkas pendaftaran\", yang dicari hakim lebih dulu. Pemisahnya tanda yang SIPP dan e-Court sendiri pakai, bukan tebakan dari judulnya.",
    ],
    changed: [
      "BENTUK DAFTAR PEGAWAI PENUNJUKAN DISEBUTKAN di klien gerbang, menggantikan Record<string, unknown>. Tipe yang longgar tampak aman - tidak ada yang dijanjikan - tetapi akibatnya sebaliknya: pemanggilnya harus menebak bentuknya, dan tebakan yang ditulis sebagai cast MEMBUNGKAM pemeriksa tipe. Itulah yang terjadi pada rute hakim. Bentuk peta antrian pada gerbang jadwal sidang ikut disebutkan atas sebab yang sama.",
      "TOMBOL PENANDA MENJADI IKON SAJA - dua anak panah yang merapat berarti ciutkan, yang merenggang berarti bentangkan. Namanya tidak ikut hilang: aria-label tetap menyebutkannya, sebab tombol tanpa nama sama sekali tidak dapat disebut oleh siapa pun yang tidak melihatnya.",
      "TOMBOL PENCARIAN LANJUTAN DAN RESET pindah sejejer dengan Hitung skor, Cetak, dan Daftarkan ke antrian. Sebelumnya keduanya menempati baris tersendiri yang hanya berisi mereka berdua - satu baris penuh terpakai oleh dua tombol, dan jumlah sidang yang terlihat berkurang sebanyak itu.",
      "KOLOM \"PERAN ANDA BERHAK MELIHAT SELURUH PERKARA SATKER\" dihapus dari rincian - keterangan yang sama pada tiap baris, dibaca sekali seumur hidup.",
      "TOMBOL TUNDA DAN PUTUS pindah ke samping kanan jenis perkara.",
      "BERKAS BUKAN PDF DITOLAK DI PANEL EKSTENSI, bukan sesudah bolak-balik ke server. Bot menolak apa pun yang empat bita pertamanya bukan %PDF - dikenali dari bitanya, bukan dari nama berkasnya. Atribut accept pada pemilih berkas hanya SARAN; yang memilih \"All files\" tetap dapat memilih .rtf.",
      "SAKLAR \"Sisipkan berkas ke Jadwal Sidang\" DISEBUTKAN di panel. Kemampuan menempelkan berkas ke baris Jadwal Sidang - di samping tombol Unggah BAS, dicocokkan menurut agendanya - sudah ada sejak lama, tetapi saklarnya mati sejak awal dan tidak ada satu pun tempat yang menyebutkannya. Fitur yang tidak diketahui sama dengan fitur yang tidak ada.",
    ],
    fixed: [
      "SEPARUH RELAAS SALAH DILABELI. ALETA membaca ket_temu milik SIPP sebagai benar/salah - ketTemu === \"Y\" - padahal kolom itu menyimpan CARA penyampaiannya, dan SIPP memakai sembilan sandi. Terukur pada 14.495 baris relaas satker: 6.725 baris (46,4%) jatuh menjadi \"tidak bertemu\" padahal bukan. Yang terbesar E = Panggilan Elektronik (3.532) dan S = Diterima orang serumah (3.104).",
      "YANG PALING MERUGIKAN BUKAN PANGGILAN ELEKTRONIK, MELAINKAN \"DITERIMA ORANG SERUMAH\". Penyampaian itu SAH menurut HIR - relaasnya patut dan sidangnya boleh berjalan. Menampilkannya sebagai \"tidak bertemu\" membuat yang membacanya menyimpulkan panggilannya tidak patut, lalu menunda sidang yang sebenarnya sudah boleh jalan. Itu kerugian pada perkara orang, bukan kerugian tampilan.",
      "ARTI SANDINYA DIBEDAKAN MENURUT ASALNYA. Y, T, E, dan N dibaca dari daftar pilihan SIPP sendiri. S, R, W, P, dan M tidak ada di sana - artinya dibaca dari isi keterangan relaasnya, dan karena itu ditandai sebagai dugaan yang beralasan, bukan kepastian; keterangannya disebut pada title. Sandi yang sama sekali tidak dikenali tidak ditebak ke salah satu sisi.",
      "WARNA LENCANANYA mengikuti SAMPAI atau tidaknya, bukan mengikuti pertemuan langsung - panggilan elektronik dan relaas yang diterima orang serumah sama-sama sampai tanpa pertemuan langsung. Kedua layar yang menampilkan relaas diperbaiki bersamaan; memperbaiki satu saja membuat keduanya berselisih untuk perkara yang sama.",
      "DAFTAR HAKIM PADA TUNJUKAN KONSEPTOR TIDAK PERNAH TERISI sejak fiturnya lahir di 2.29.0. Rutenya membaca pegawai.hakim lewat cast, padahal gerbang memulangkan pembungkus { ok, data } - nilainya SELALU undefined. Gagalnya sempurna dalam diam: kotak isiannya memang dirancang tetap dapat dipakai tanpa daftar, jadi tidak ada satu pun tanda bahwa ada yang rusak.",
      "HALAMAN TERTARIK KE SAMPING KETIKA RINCIAN DIBUKA. Baris rincian membentang selebar isinya, bukan selebar layar, sehingga seluruh tabel ikut melar dan kolomnya tidak lagi sejajar. Lebarnya kini dikunci pada lebar yang sungguh tampak, dan isinya yang lebih lebar menggulir di dalam wadahnya sendiri.",
      "UNGGAH PUTUSAN MASSAL BERHENTI PADA PERKARA CABUT DAN GUGUR. Panel mencoba mengisi Pertimbangan Hukum dan Amar Anonim yang memang TIDAK ADA di blangko status itu; jembatan menjawab \"medan tidak ketemu\", panel menghitungnya sebagai gagal, dan pagar \"selama masih ada yang gagal Simpan tidak ditekan\" menghentikan seluruh pengisian - tepat pada jenis perkara yang paling sederhana dan paling banyak jumlahnya. Yang terbaca petugas hanya \"2 gagal\", tanpa satu pun keterangan bahwa bagiannya memang tidak ada.",
      "DRAF YANG BERISI UNTUK BAGIAN YANG TIDAK ADA DI BLANGKO kini DITAHAN, bukan dilewati. Isi itu tidak akan pernah sampai ke SIPP; tanpa penahanan ini panel akan berkata \"tersimpan\" atas putusan yang kehilangan pertimbangannya, dan hilangnya baru ketahuan ketika salinannya dibaca orang.",
      "STATUS \"TIDAK DITERIMA\" - tanpa kata \"dapat\" - tidak dikenali agen praperiksa, sehingga pemeriksaan padanan amarnya DILEWATI diam-diam tepat pada putusan yang amarnya paling mudah tertukar.",
      "UNGGAH PUTUSAN DARI HALAMAN PERKARA AGAMA SELALU DITOLAK dengan \"perkara_id belum disebut.\" - setiap kali, tanpa kecuali. Sebabnya bukan berkas yang salah pilih: ekstensi membaca perkara_id dari medan tersembunyi di dalam blangko putusan, dan medan itu TIDAK PERNAH ADA di sana. SIPP mengenali perkara pada blangko Putusan Akhir lewat `enc`, nomor perkara tersandi; perkara_id hanya dipakai pada blangko grasi dan peninjauan kembali. Rute saudaranya sudah lama menanyakannya sendiri ke SIPP bila kosong - hanya rute ini yang tidak pernah diberi jalan mundur yang sama.",
      "BOT YANG MATI DIBEDAKAN DARI PERKARA YANG TIDAK ADA pada pesan gagalnya. Menyamakan keduanya mengirim petugas memeriksa nomor perkaranya - yang sudah benar - sementara yang perlu diperiksa sambungan botnya.",
      "STATUS PUTUSAN YANG SUDAH DIPILIH PETUGAS DITIMPA DIAM-DIAM oleh panel ekstensi. Yang sudah memilih \"Dicabut\" mendapati pilihannya berganti sendiri menjadi usulan ALETA - yang pada sebagian besar perkara berbunyi \"Dikabulkan\" - lalu blangkonya menggambar ulang dan medan yang seharusnya tersembunyi ikut muncul. Akibatnya bukan tampilan: status putusan yang keliru tersimpan ke perkara orang, lalu mengalir ke laporan dan ke Direktori Putusan. Lebih buruk lagi, praperiksa sudah dijalankan SEBELUMNYA atas status yang lama.",
      "BERKAS JAWAB-MENJAWAB E-COURT TIDAK PERNAH TERLIHAT - jawaban, replik, duplik, duplik rekonvensi, kesimpulan, fotokopi alat bukti. Semuanya sudah lama ditarik ALETA; yang membuatnya tampak tidak ada adalah tombol unduhnya yang disembunyikan. Ada tidaknya berkas dibaca dari kolom cermin yang basi - terisi pada 23 dan 8 dari 394 dokumen - sementara tabel berkasnya mencatat seluruh 400. Tidak ada satu error pun yang berbunyi.",
      "BERKAS YANG TERCATAT ADA TETAPI HILANG DARI ARSIP kini disebut apa adanya, bukan disamakan dengan yang tidak pernah ada. Tindakannya berbeda: yang satu menyuruh memeriksa arsipnya, yang lain menyuruh pihak mengunggah. Arsip e-Court pernah lenyap seluruhnya di sini karena volume Docker belum di-mount.",
      "AGENDA REKONVENSI TERTUKAR DENGAN KONVENSINYA pada pencocokan berkas ke baris Jadwal Sidang - \"Duplik Rekonvensi\" juga cocok dengan pola duplik biasa. Tertukarnya tidak berbunyi apa pun: kotaknya tetap terisi, isinya saja milik tahapan lain.",
    ],
    security: [],
    operationalNotes: [
      "MIGRASI 0047 DAN 0048 - tabel aleta_keterangan_perkara dan aleta_rekam_antrian. Nomor Drizzle bebas berikutnya kini 0049; beri tahu sesi PC. Keduanya juga ada di jalur idempoten schema.ts, sebab basis data dalam memori dan pemasangan yang melewati migrasi mengandalkan jalur itu.",
      "PEMASANGAN WAJIB MEMBAWA ALETA_RUN_DB_MIGRATIONS=1. Tanpa itu skrip pembaruan MELEWATI migrasi dan tetap melaporkan berhasil - dan rekaman antrian akan diam-diam tidak pernah tertulis sampai ada yang memeriksanya berbulan-bulan kemudian.",
      "REKAMAN ANTRIAN DITULIS DARI SERVER tiap kali jadwal sidang dimuat, bukan dari peramban. Gagalnya tidak menjatuhkan jadwalnya - jumlah yang tertulis beserta sebab gagalnya ikut dipulangkan rute jadwal sidang.",
      "PEMBACAAN RELAAS YANG BARU MENGUBAH APA YANG TAMPIL pada relaas yang sudah lama tersimpan - tidak ada data yang diubah, hanya cara membacanya. Relaas yang kemarin berbunyi \"tidak bertemu\" dapat berubah menjadi \"Panggilan elektronik\" atau \"Diterima orang serumah\"; itu pembetulan, bukan perubahan data.",
      "EKSTENSI PERLU DI-RELOAD di chrome://extensions sesudah rilis ini - ekstensi unpacked tidak memperbarui dirinya.",
      "BERKAS PUTUSAN YANG DIUNGGAH HARUS PDF. Yang terbit di Direktori Putusan harus PDF, dan ALETA sengaja tidak menjalankan pengubah soffice seperti SIPP - pengubahan yang gagal separuh menghasilkan berkas rusak yang sudah terlanjur publik. Simpan naskahnya sebagai PDF lebih dulu; .rtf dan .docx ditolak.",
    ],
    knownLimitations: [
      "ARTI LIMA SANDI RELAAS (S, R, W, P, M) DIBACA DARI ISI KETERANGAN RELAASNYA, bukan dari daftar resmi SIPP - sandi itu tidak ada di dropdown mana pun yang terbaca. Keduanya sudah ditandai berbeda di layar, tetapi bila satker tahu arti resminya, sebutkan supaya dapat dipastikan.",
      "PERBAIKAN RUTE HAKIM BELUM DICOBA DI SIPP SUNGGUHAN - hanya dari pembacaan kode. Sesudah terpasang, ketik kode hakim seperti C3 pada tunjukan konseptor untuk memastikan daftarnya muncul.",
      "BAGIAN NASKAH YANG ADA PADA TIAP STATUS PUTUSAN BELUM DIUKUR DARI SIPP SUNGGUHAN - yang diperbaiki adalah cara panel menyikapi ketiadaannya, bukan daftar bagian per status. Sesudah terpasang, buka satu perkara cabut dan satu perkara gugur untuk memastikan yang digambar memang yang ada.",
      "REKAMAN ANTRIAN BELUM PUNYA LAYARNYA SENDIRI. Rute bacanya sudah ada (/api/aleta-ecourt/rekam-antrian, per rentang tanggal atau per perkara) beserta ringkasan jarak terapat, terenggang, dan reratanya; layar yang menampilkannya belum dibuat.",
      "TOMBOL MEDIATOR BELUM DAPAT MENUNJUK MEDIATOR. Diperiksa di seluruh repositori: tidak ada satu pun jalur yang menulis penetapan mediator ke SIPP. Tombolnya membuka keterangan mediasi yang memang sudah dibaca ALETA, dan mengatakan apa adanya bahwa penunjukannya masih dikerjakan di SIPP - menjanjikan yang belum ada lebih merugikan daripada tidak menawarkan apa pun.",
      "TANGGAL SIDANG TIAP DOKUMEN E-COURT MASIH KOSONG pada seluruh 394 dokumen - jembatan tidak pernah menuliskannya, dan kolom agendanya diisi agenda TERAKHIR seluruh perkara. Akibatnya pencocokan berkas ke baris Jadwal Sidang hanya dapat mengandalkan agendanya. Itu sudah bekerja, tetapi berkas yang agendanya tidak dikenali tidak tertempel di mana pun. Perbaikannya di jembatan e-Court, belum dikerjakan.",
      "KATA MINIMAL YANG DITANDAI REMEH BARU SEMBILAN TEMPAT. Penandaan otomatis dicoba dua kali dan gagal dua kali ke arah yang sama - menandai terlalu banyak, termasuk kotak kabar dan kalimat yang melaporkan keadaan. Sisanya ditandai dengan tangan dan sengaja sedikit: panel yang ringkas tetapi diam ketika sesuatu gagal lebih buruk daripada panel yang penuh.",
    ],
  },
  {
    version: "2.31.1",
    title: "ALETA Judicia v2.31.1 - Error yang Menumpuk Diam-diam di Halaman ABT",
    date: "2026-09-22",
    status: "Terpasang",
    summary:
      "Satu error yang berulang tiap halaman ABT dibuka, tanpa satu pun gejala di layar - dan " +
      "justru itu yang membuatnya berbahaya. Nomor portal ikut naik sebab ekstensi yang tertanam " +
      "di dalamnya berubah; isinya berbeda, maka nomornya harus berbeda.",
    added: [],
    changed: [],
    fixed: [
      "ReferenceError TDZ pada pemasangan panel massal ABT: \"Cannot access 'sudahDipasangMassalAbt' before initialization\". Sebabnya urutan, bukan logika - fungsinya dipanggil di tingkat atas berkas sementara let yang dibacanya baru dideklarasikan ratusan baris di bawah. Deklarasi function terangkat ke atas sehingga pemanggilannya sah; deklarasi let tidak.",
      "PANELNYA TETAP MUNCUL selama ini, dan itulah yang membuatnya tidak pernah terlihat - gelung ulangan memanggilnya lagi, dan pada panggilan kedua barisnya sudah lewat. Yang tersisa hanya satu error di daftar Chrome tiap halaman ABT dibuka. Bahayanya justru di situ: lencana merah yang selalu menyala membuat error SUNGGUHAN berikutnya tenggelam, sebab tidak ada yang membuka daftar yang memang selalu merah.",
      "Ada sejak commit putusan massal, bukan dari perubahan kemarin - diperiksa pada tiga commit terakhir dan ketiganya sama.",
    ],
    security: [],
    operationalNotes: [
      "Tidak ada migrasi basis data. Nomor Drizzle bebas berikutnya tetap 0047.",
      "NOMOR PORTAL NAIK WALAU YANG BERUBAH HANYA EKSTENSI. Ekstensi tertanam di dalam build portal; memasang isi yang berbeda di bawah nomor yang sama membuat layar melaporkan versi yang tidak sesuai dengan apa yang sungguh disajikannya.",
    ],
    knownLimitations: [
      "PENJAGA TDZ HANYA MEMERIKSA PEMANGGILAN TINGKAT ATAS - yang tanpa lekukan. Pemanggilan di dalam fungsi lain berjalan belakangan dan tidak pernah kena TDZ; memasukkannya hanya menghasilkan merah palsu, dan itu terjadi pada percobaan pertama penyisirnya lalu dibetulkan.",
    ],
  },
  {
    version: "2.31.0",
    title: "ALETA Judicia v2.31.0 - Unggah Putusan: Cepat, Tidak Menyerah, dan Dari Mana Saja",
    date: "2026-09-22",
    status: "Terpasang",
    summary:
      "Empat permintaan atas unggah putusan, dan dua di antaranya berakar pada satu angka yang " +
      "salah urutan: ekstensi menyerah lebih dahulu daripada gerbangnya, sehingga unggahan yang " +
      "hampir selesai dibatalkan di layar sementara botnya terus bekerja. Ditambah pemeriksaan " +
      "draf yang tidak lagi antre satu per satu, unggah dari halaman ABT, dan antrean massal yang " +
      "boleh bermula dari berkas.",
    added: [
      "UNGGAH PUTUSAN DARI HALAMAN ABT untuk perkara yang sedang dibuka. Seluruh rangkaiannya sudah ada sejak lama - RTF dari blangko, draf ke ALETA, PDF, anonim, unggah ke SIPP - tetapi hanya dapat dipanggil dari dalam gelung antrean massal, dan antrean itu selalu bermula dari TANGGAL SIDANG. Petugas yang membuka satu perkara di ABT harus menyusun antrean sehari penuh lebih dahulu lalu mencentang satu baris. Panelnya tidak menyalin satu baris pun logika unggah.",
      "PUTUSAN MASSAL DARI BERKAS. Pilih beberapa naskah sekaligus; nomor perkaranya dipetik dari NAMA berkas, seluruh pasangan diperlihatkan untuk diperiksa, baru dikirim. Sebelum ini tidak satu pun pemilih berkas di ekstensi menerima lebih dari satu berkas - ketiganya membaca files[0] tanpa multiple - dan berkas tidak pernah dicocokkan dengan perkaranya.",
    ],
    changed: [
      "TOMBOL TUNDA DAN PUTUS PINDAH KE SAMPING JENIS PERKARA, dari depan nomor perkara. Di tempat lamanya keduanya berdiri persis di titik yang paling dahulu dibaca mata, sehingga yang pertama terbaca pada tiap baris bukan perkaranya melainkan dua tombol yang bentuknya sama persis pada dua puluh tujuh baris - dan nomor perkara, satu-satunya hal yang membedakan baris, terdorong ke kanan sejauh panjang penandanya sehingga tidak lagi berbaris lurus ke bawah. Ditaruh di samping jenis perkara, bukan di ujung barisnya sendiri: jenis perkara menentukan apa yang akan dicatat - Cerai Talak yang ditunda berbeda akibatnya dari Cerai Gugat yang ditunda, sebab yang pertama masih menunggu ikrar.",
      "PEMERIKSAAN DRAF BERBARENGAN, ENAM SEKALIGUS. Dahulu berurutan; pada dua puluh perkara itu sepuluh detik menunggu sebelum satu baris pun dapat dicentang. Terbatas enam, bukan seluruhnya: dua puluh permintaan serentak ke SIPP lewat satu gerbang menukar menunggu dengan menumpuk, dan yang menumpuk menahan permintaan lain di layar yang sama.",
      "DRAF TIDAK LAGI DITARIK DUA KALI - pemeriksaan menariknya utuh lalu membuangnya, dan pengisian blangko menariknya lagi.",
    ],
    fixed: [
      "UNGGAH ANONIMISASI YANG \"ERROR DAN TIDAK MAU TERUPLOAD\". Batas waktu ekstensi 45 detik LEBIH PENDEK daripada batas gerbang 60 detik. Unggahan yang memakan 45 sampai 60 detik karena itu dibatalkan di layar - petugas melihat error - sementara botnya terus bekerja dan mungkin menyelesaikannya. Komentar pada gerbang itu sendiri sudah menyebut akibatnya: meninggalkan berkas yang sudah tertulis tanpa barisnya. Anonimisasi paling sering kena karena kedua berkas dikirim dalam satu permintaan, jadi bitanya dua kali lipat.",
      "BATAS WAKTU ABT yang dahulu PERSIS SAMA dengan gerbangnya - 60000 lawan 60000, tanpa selisih sama sekali - sehingga keduanya menyerah pada saat yang sama. Urutannya kini menaik dari dalam ke luar: bot, gerbang, lalu ekstensi.",
    ],
    security: [],
    operationalNotes: [
      "Tidak ada migrasi basis data. Nomor Drizzle bebas berikutnya tetap 0047.",
      "\"Satu kesatuan\" antara unggah putusan dan anonimisasi SUDAH ADA sejak lama - rute bot, rute portal, dan panel ekstensi ketiganya mengirim keduanya sekaligus. Yang rusak hanya batas waktunya.",
    ],
    knownLimitations: [
      "PERBAIKAN BATAS WAKTU BELUM DIBUKTIKAN SEBAGAI SEBABNYA. Kedua angkanya terukur dan urutannya memang salah, tetapi bunyi error yang dilihat petugas belum pernah dibaca. Bila unggah anonimisasi masih gagal sesudah versi ini, kirimkan tangkapan Console-nya.",
      "POSITA YANG TIDAK RAPI BUKAN CACAT KODE. Perapinya sudah ada di rapikanTeksPosita dan sudah menangani <div>; diuji atas posita sungguhan perkara 505 ia mengubah 0 pemisah paragraf menjadi 27, dengan nol angka butir tertelan. Yang terjadi: ia tidak pernah DIJALANKAN atas perkara itu - ia tindakan yang harus ditekan orang. Menjadikannya berjalan sendiri sebagai bagian alur putusan belum dikerjakan.",
      "SELURUH PERUBAHAN INI BELUM DICOBA DI SIPP SUNGGUHAN - hanya dari pembacaan kode dan pengukuran basis data setempat. Coba pada satu perkara lebih dahulu.",
    ],
  },
  {
    version: "2.30.0",
    title: "ALETA Judicia v2.30.0 - Rantai Penetapan Melintasi Hari, dan Pratinjau yang Jujur",
    date: "2026-09-22",
    status: "Terpasang",
    summary:
      "Dua permintaan atas penetapan otomatis, dan keduanya tentang hal yang sama: yang menekan " +
      "tombol harus tahu persis apa yang akan terjadi. Rantai PMH-PPP-PJS-PHS kini tidak lagi " +
      "ditolak mentah hanya karena tanggalnya berbeda, dan pratinjaunya menyebut seluruh yang " +
      "dipilih tangan - tanggal, ruang sidang, dan pejabat penetapnya - beserta tanda mana yang " +
      "pilihan orang dan mana yang usulan mesin.",
    added: [
      "PRATINJAU MENYEBUT TANGGAL PENETAPAN, RUANG SIDANG, DAN PEJABAT PENETAP tiap langkah. Sebelumnya tiga dari empat hal yang dapat dipilih tangan tidak pernah terbaca sebelum ditekan. Ruang sidang yang paling merugikan: ia sudah dikirim ke mesin tulis sejak lama tanpa pernah dipajang, sehingga sidang keliling yang salah ruangannya baru ketahuan berbulan kemudian oleh penyusun laporan - penetapannya berhasil, berkasnya tercetak, sidangnya digelar, dan laporannya menghitung nol.",
      "PENANDA \"pilihan Anda\" pada baris yang datang dari tangan. Tanpa itu, petugas yang baru saja memilih pejabat atau ruangan lain tidak punya cara memastikan pilihannya sampai - dan pilihan yang tidak sampai tidak berbunyi apa pun.",
      "TANGGALNYA DIULANG SESUDAH EKSEKUSI pada tiap langkah yang berhasil. Yang sudah tertulis ke SIPP tidak dapat dilihat lagi dari panel tanpa membuka SIPP.",
    ],
    changed: [
      "PENOLAKAN TANGGAL DIPERSEMPIT dari \"berbeda\" menjadi \"mendahului\". Penjaga lama menolak mentah tiap langkah yang tanggalnya berbeda dari langkah lain yang sudah ada. Terukur pada SIPP satker, penetapan 2026: dari 800 perkara ber-PMH, 637 PPP setanggal (80%) dan 161 BERBEDA (20%); PHS 679 setanggal (85%) dan 119 berbeda (15%). Selisih yang paling sering +1 hari, lalu +3, +2, +4. Penjaga lama karena itu menolak satu dari lima perkara yang sah. Yang ditolak sekarang hanya yang mustahil - langkah yang ditanggali lebih awal daripada langkah yang sudah ada, sebab PPP tidak dapat ditetapkan sebelum PMH-nya ada.",
      "BEDA TANGGAL DIBAWA SEBAGAI CATATAN ke pratinjau, bukan ditelan diam-diam. Ditelan diam-diam berarti yang menekan tombol tidak tahu penetapannya bertanggal lain daripada PMH-nya, dan baru menyadarinya ketika laporan per hari tidak cocok.",
    ],
    fixed: [],
    security: [],
    operationalNotes: [
      "Tidak ada migrasi basis data. Nomor Drizzle bebas berikutnya tetap 0047.",
      "TANGGAL LANJUTAN TETAP MENGIKUTI PMH - diputuskan pengguna 22 September 2026, sebab 80% praktik satker memang setanggal. Yang berubah hanya KEMUNGKINANNYA: tanggal lain tidak lagi ditolak mentah. Bawaannya tidak berubah sedikit pun, dan ada penjaga yang menahannya supaya tidak berubah diam-diam.",
      "Jam tiap langkah tetap disebar seperti tangan manusia lewat waktuLangkah, dan tidak pernah mencatat jam yang belum terjadi. Rantai yang kini boleh melintasi hari melewati jalur yang sama.",
    ],
    knownLimitations: [
      "RANTAINYA SENDIRI SUDAH BERJALAN SEBELUM VERSI INI - langkah yang sudah ada dicatat lalu dilewati, dan langkah berikutnya tetap dikerjakan. Yang ditambahkan versi ini bukan kemampuan merantainya, melainkan kemungkinan melanjutkannya pada tanggal yang berbeda, dan keterbacaan apa yang akan ditulis.",
      "Perubahan ini BELUM diuji di SIPP sungguhan - hanya diukur atas basis data setempat dan dijaga uji. Penetapan yang salah tidak dapat dibatalkan dengan menekan ulang; coba pada satu perkara lebih dahulu.",
    ],
  },
  {
    version: "2.29.0",
    title: "ALETA Judicia v2.29.0 - Layar Antrian Sidang Dapat Disetel Sendiri",
    date: "2026-09-21",
    status: "Terpasang",
    summary:
      "Layar Antrian Sidang dipakai empat macam orang yang pekerjaannya berbeda, dan tiap penanda " +
      "berguna bagi salah satunya sekaligus menjadi kebisingan bagi tiga sisanya. Mulai versi ini tiap " +
      "penanda, keterangan, dan tombol punya saklarnya sendiri - kecuali empat yang mendesak, yang " +
      "sengaja tidak dapat dimatikan siapa pun. Tunggakan minutasi kini punya kotak saringnya sendiri " +
      "dan rinciannya menyebutkan berkas apa yang masih kurang. Termasuk pula perbaikan peta sebaran " +
      "perkara yang belum sempat dipasang pada 2.28.1.",
    added: [
      "SAKLAR TAMPILAN. Tombol Tampilan di sudut kanan atas membuka panel berisi tiap penanda, keterangan, dan tombol di layar ini beserta saklarnya, dikelompokkan bertiga. Pilihannya tersimpan di peramban dan tidak mengubah data apa pun. Angka pada tombolnya menyebut berapa yang sedang dimatikan: tanpa itu, layar yang penandanya sudah dipadamkan berbulan lalu terbaca sebagai layar yang memang tidak punya penanda, dan yang membacanya akan menyimpulkan perkaranya bersih.",
      "EMPAT PENANDA SENGAJA TIDAK DAPAT DIMATIKAN - retur, belum dipanggil, belum minutasi, dan belum unggah putusan. Saklar yang dimatikan hari ini tersimpan di peramban dan tidak dinyalakan lagi besok; untuk keterangan yang sekadar menolong itu tidak merugikan, untuk keempat hal ini akibatnya sidang yang batal atau berkas yang tidak pernah dijahit. Saklarnya tetap digambar - menyala dan tidak dapat ditekan - beserta sebabnya, supaya tidak ada yang mengira penandanya sudah hilang lalu mencarinya.",
      "KOTAK SARING BELUM MINUTASI, membaca DUA sumber. Terukur pada SIPP setempat: dari 9.993 baris perkara_putusan, NOL yang tanggal minutasinya kosong - kotak yang hanya membaca tabel itu tidak akan pernah menyala satu kali pun dan terbaca sebagai tidak ada tunggakan. Tunggakannya justru pada perkara yang baris putusannya belum pernah dibuat: 12 perkara yang hasil sidangnya berbunyi putus tanpa satu baris putusan pun.",
      "KOTAK SARING BELUM UNGGAH PUTUSAN, dipisahkan dari minutasi karena orangnya berbeda - naskah disusun hakim, minutasi dijahit panitera pengganti. Terukur: 90 dari 9.993 perkara yang sudah putus belum punya naskahnya di SIPP.",
      "HAKIM DIKENALI PADA TUNJUKAN KONSEPTOR SEMENTARA. Mengetik sebagian nama atau kode hakim - A, B, C1, C2, C3 - memunculkan daftar tawaran, dan yang dipilih mengisi namanya lengkap dengan gelar seperti tertulis di SIPP. Nama yang sudah persis diberi lencana hijau \"Hakim terdeteksi\" beserta kodenya. Kotaknya TETAP kotak isian biasa, bukan kotak pilihan: konseptor tidak selalu hakim - panitera pengganti pun menyusun naskah - jadi nama di luar daftar cukup diketik lalu disimpan, tanpa memilih apa pun, dan tidak diberi tanda peringatan apa pun sebab ia memang sah.",
      "PENCARIANNYA DIJENJANG, bukan sekadar mengandung. Kode dicocokkan PERSIS - mencocokkannya sebagai potongan akan membuat huruf a mana pun memanggil hakim berkode A, yaitu hampir tiap ketikan. Huruf gelar tidak dihitung sebagai kata: nama dibakukan menjadi \"derry briantono s h\", dan tanpa pembuangan kata sehuruf mengetik s menawarkan kelima-limanya karena semuanya bergelar S.H. atau S.H.I. Potongan yang mengandung di tengah kata baru ditawarkan sejak tiga huruf.",
      "SEBAB MINUTASI TERTAHAN DI RINCIAN PERKARA. Panel Rincian kini mendaftar apa yang masih kurang - berapa dari berapa sidang yang belum ada berita acaranya, naskah putusan, naskah anonim - dihitung dari data yang sudah ada di panel itu, tanpa satu pun pembacaan tambahan ke SIPP. Yang menahan dibedakan dari yang sekadar tertunggak: naskah anonim tidak menahan minutasi, sebab SIPP sendiri menghitungnya dari perkara yang SUDAH diminutasi.",
    ],
    changed: [
      "TOMBOL PERKARA SAYA PINDAH KE SUDUT KANAN ATAS. Sebelumnya ia berdiri sendirian pada satu baris selebar layar tepat di atas tabel, sehingga yang didapat sebuah baris kosong yang mendorong seluruh daftar sidang turun. Di kepala ia tidak memakai baris sama sekali. Peringatan bahwa nama pemakainya tidak ketemu pada satu baris pun TIDAK ikut pindah menjadi title - title tidak terlihat tanpa disentuh, dan yang membaca daftar penuh akan menyangka seluruh perkara itu miliknya.",
      "MINUTASI TIDAK LAGI DIBACA DARI STRING KOSONG SAJA. SIPP menulis tanggal nol pada sebagian barisnya, dan pemeriksaan yang hanya menanyakan kosong atau tidak akan menyimpulkan perkaranya sudah diminutasi - lalu memadamkan lencana justru pada baris yang paling perlu menyalakannya.",
    ],
    fixed: [
      "TITIK PERKARA MUNCUL KEMBALI. globals.css memberi seluruh img, svg, video, dan canvas max-width 100% - benar bagi hampir semuanya, dan menghancurkan peta. Kanvas Leaflet duduk di dalam panel berposisi mutlak yang anak satu-satunya juga berposisi mutlak, sehingga lebar panelnya NOL; max-width 100% terhadap nol berarti nol, dan max-width mengalahkan width sebaris yang dipasang Leaflet. Terukur di peramban satker: kanvas bersimpanan 2180x1190 dengan 40.729 piksel sungguh tergambar, ditampilkan 0x595. Tingginya benar - hanya lebarnya nol, dan justru itu yang membuatnya sulit dikenali.",
      "UBINAN SELAMAT SEJAK AWAL karena leaflet.css melindunginya dengan max-width none !important - tetapi daftar itu memuat img, TIDAK memuat canvas. Karena itu petanya tampak sehat sementara seluruh lapisan vektornya hilang.",
      "PERBAIKAN PETA DI BAWAH INI SEMULA BERNOMOR 2.28.1 dan tidak jadi dipasang karena server satker sedang tidak dapat dihubungi. Nomornya dilebur ke sini supaya sesi PC cukup menyelaraskan satu nomor.",
      "LAYAR PENUH PETA TIDAK LAGI KOSONG. Kotaknya berkelas relative, dan gaya penulis mengalahkan gaya bawaan :fullscreen - sehingga posisinya kembali relative sementara height 100%-nya dihitung terhadap induk setinggi auto, yaitu mengerut. Terukur di peramban: dengan position relative, height 100% meninggalkan kotaknya pada 708 piksel sedangkan 100vh memberinya 770.",
    ],
    security: [],
    operationalNotes: [
      "Tidak ada migrasi basis data pada versi ini. Nomor migrasi Drizzle bebas berikutnya tetap 0047.",
      "SAKLAR TAMPILAN TERSIMPAN PER PERAMBAN, bukan per akun. Petugas yang berpindah komputer memulai dengan seluruh penanda menyala - itu keadaan bawaan, dan bawaan yang mematikan sesuatu akan menghilangkan penanda dari layar orang yang tidak pernah meminta apa pun.",
    ],
    knownLimitations: [
      "DAFTAR TAWARAN KONSEPTOR HANYA MEMUAT HAKIM AKTIF, bukan panitera pengganti - padahal panitera pengganti pun menyusun naskah. Namanya tetap dapat diketik apa adanya dan tersimpan dengan benar; yang belum ada hanya tawarannya. Menambahkan panitera menuntut keputusan tersendiri, sebab kode panitera di SIPP bertabrakan - empat orang berbagi kode D.",
      "SIPP SENDIRI TIDAK MENOLAK tanggal minutasi karena berkas kurang - diperiksa pada sumbernya, dan yang ada hanya satu pemeriksaan bahwa tanggal BHT tidak boleh mendahului minutasi. Daftar sebab di panel Rincian karena itu daftar berkas yang harus ada di dalam bundel, BUKAN syarat aplikasi; menyebutnya syarat akan membuat orang mencari tombol yang tidak pernah ada.",
      "SEBAB MINUTASI DI BARIS DAFTAR hanya menyebut naskah putusannya. Kelengkapan BAS menuntut jadwal SELURUH perkara, dan baris daftar hanya tahu BAS sidangnya sendiri - daftar lengkapnya karena itu ada di panel Rincian, dan lencananya menunjuk ke sana.",
      "PENANDA KONSEPTOR BERBEDA hanya ada di panel Rincian, bukan pada baris daftar. Nama konseptor sungguhan menuntut pembacaan jejak tahapan per perkara, dan menariknya untuk tiap baris daftar berarti puluhan pembacaan tambahan tiap kali tanggalnya diganti.",
    ],
  },
  {
    version: "2.28.0",
    title: "ALETA Judicia v2.28.0 - Dua Belas Permintaan Layar Antrian Sidang",
    date: "2026-09-21",
    status: "Terpasang",
    summary:
      "Dua belas permintaan atas layar Antrian Sidang, dikerjakan seluruhnya lalu DIPERIKSA ULANG oleh " +
      "delapan agen yang membaca kodenya dan mencoba menjatuhkan tiap klaim 'sudah selesai'. Pemeriksaan " +
      "itu menemukan tiga butir yang belum utuh dan tiga butir yang benar tetapi tidak dijaga satu uji " +
      "pun - keenamnya ikut dibereskan. Di sebelahnya: unduhan massal lewat panel akhirnya bernama benar, " +
      "dan layar penuh peta perkara tidak lagi kosong.",
    added: [
      "TUNDA DAN PUTUS LANGSUNG DARI BARIS ANTRIAN, di kiri nomor perkara. Mesinnya SATU dengan layar Hasil Sidang - alamat, bentuk muatan, dan seluruh nilai bawaannya sama - sehingga tidak ada dua jalan menulis ke SIPP yang dapat menyimpang diam-diam. 'Instan' berarti tanpa berpindah layar, BUKAN tanpa diperiksa: rencananya tetap ditarik lewat jalan kering lebih dahulu.",
      "KONSEPTOR SEMENTARA - tunjukan tangan siapa yang menyusun putusan, berlaku sampai SIPP punya namanya sendiri. SIPP baru dapat menyebut konseptor SESUDAH naskahnya disentuh, dan justru pada rentang sebelum itulah pertanyaannya paling sering diajukan. Diberi penanda bila tunjukannya BERBEDA dari yang sungguh mengerjakan - tetapi hanya ketika keduanya ada.",
      "TIAP AKUN MELIHAT PERKARANYA SENDIRI, berdasarkan peran dan namanya, dengan tombol 'tampilkan semua perkara'. Penyaringnya GAGAL-TERBUKA: nama yang tidak cocok satu baris pun tetap melihat seluruh daftar beserta keterangannya, sebab layar kosong pada daftar sidang terbaca sebagai 'hari ini tidak ada sidang'.",
      "JARAK WAKTU ANTAR PERKARA di bawah tombol antrian, berwarna menurut rentangnya. Ambang 5/15/30/60 menit diukur atas 10.989 jarak dari 1.753 kelompok (hari x ruang) pada jadwal sidang satker.",
      "PENANDA 'DITERIMA PIHAK LAWAN?' pada keterangan relaas - panggilan untuk tergugat yang diterima orang bernama sama dengan penggugat. Diukur atas SELURUH 14.495 relaas satker sebelum dipasang: menyala 10 kali dari 11.150 baris yang dapat dinilai.",
      "TIAP KELOMPOK PENANDA dapat diciutkan sendiri-sendiri - Panggilan, Jalannya sidang, Putusan, Antrian - dengan tombol induk yang mengatur keempatnya sekaligus.",
      "SEMBILAN BAGIAN PANEL RINCIAN dapat diciutkan, memakai komponen yang SAMA dengan layar Status Perkara alih-alih salinannya.",
    ],
    changed: [
      "SELURUH JADWAL SIDANG dipindahkan ke bawah Riwayat panggilan sebelumnya.",
      "PENANDA SIDANG SELESAI menandai SELURUH BARIS, bukan angka antriannya saja: garis kiri 4 piksel terbaca tanpa bergantung pada warna.",
      "JARAK KEPALA HALAMAN ke judul jadwal dirapatkan di kedua tempat yang menyusunnya.",
    ],
    fixed: [
      "KOTAK 'SUDAH PUTUS' TIDAK LAGI KURANG HITUNG. SIPP menyimpan 'sudah diputus' di DUA tempat yang tidak saling tahu, dan tidak ada satu pun yang lengkap sendirian. Terukur pada data satker: 2026-09-08 kotak menghitung 1 sementara hasil sidang menyebut 6; 2026-09-07 menghitung 6 lawan 8; 2026-09-01 menghitung 9 lawan 10. Perpecahannya SELALU jatuh pada hari yang sedang berjalan - hari yang justru sedang dilihat orang.",
      "KOLOM PUTUSAN BERHENTI BERBANTAH dengan kotak hijau hasil sidang di baris yang sama. Ia kini mendahulukan 'putus (hasil sidang)' lalu 'belum tercatat di SIPP'; keterangan tunggakan pencatatannya tidak dihapus, sebab ia menagih pekerjaan yang memang belum dikerjakan.",
      "PENYARING 'PERKARA SAYA' TIDAK LAGI MENCAMPUR DUA ORANG. Terukur pada data satker: 'M. Tang' dan 'Sudarmin H.I.M. Tang' adalah dua orang berbeda dengan NIP berbeda, dan aturan pertama membawa perkara Sudarmin ke daftar M. Tang. Sesudah nama gabungan dipecah lebih dahulu: 63 dari 63 orang mencocoki tulisan namanya sendiri, tabrakan antar-orang nol.",
      "OPERATOR DAN PENJAGA SIDANG MELIHAT SEMUANYA. Operator SELALU peran tambahan, bukan peran utama - penyaring yang hanya membaca peran utama justru menyaring orang yang diminta melihat semua perkara, dan kegagalannya hanya tampak sebagai daftar yang lebih pendek.",
      "LAYAR PENUH PETA PERKARA TIDAK LAGI KOSONG. Kotaknya berkelas relative, dan gaya penulis mengalahkan gaya bawaan :fullscreen - sehingga posisinya kembali relative sementara height 100%-nya dihitung terhadap induk setinggi auto, yaitu mengerut. Terukur di peramban: dengan position relative, height 100% meninggalkan kotaknya pada 708 piksel sedangkan 100vh memberinya 770.",
    ],
    security: [],
    operationalNotes: [
      "MIGRASI 0046 - tabel aleta_konseptor_sementara. Pemasangannya WAJIB memakai ALETA_RUN_DB_MIGRATIONS=1; tanpa itu migrasinya dilewati diam-diam tetapi pemasangannya tetap dilaporkan berhasil.",
      "EKSTENSI 1.158.1 ikut tertanam. Sesudah pemasangan, petugas harus menekan Reload di chrome://extensions - ekstensi unpacked tidak memperbarui dirinya.",
    ],
    knownLimitations: [
      "TITIK PERKARA PADA PETA belum diperbaiki. Mesin penggambarnya terbukti sehat - replika susunannya menggambar 150 lingkaran dengan 6.729 piksel - dan berkas koordinat, Leaflet, serta kebergantungan hooknya seluruhnya bersih. Sebabnya karena itu ada pada keadaan halaman yang sedang berjalan, dan belum dapat dilihat tanpa bacaan dari peramban satker.",
      "PENANDA KONSEPTOR BERBEDA hanya ada di panel Rincian, bukan pada baris daftar. Nama konseptor sungguhan menuntut pembacaan jejak tahapan per perkara, dan menariknya untuk tiap baris daftar berarti puluhan pembacaan tambahan tiap kali tanggalnya diganti.",
    ],
  },
  {
    version: "2.27.0",
    title: "ALETA Judicia v2.27.0 - Delapan Huruf Alasan Perceraian",
    date: "2026-09-21",
    status: "Terpasang",
    summary:
      "Selama ini ALETA hanya mengenal EMPAT dari delapan huruf alasan perceraian - A, B, F, dan H. " +
      "Huruf C, D, E, dan G tidak pernah dapat diusulkan sama sekali, berapa pun cirinya cocok, sebab " +
      "bunyinya memang tidak ada di dalamnya. Kedelapannya kini bertuliskan bunyi PP maupun KHI-nya, " +
      "beserta keraguan yang ikut tertulis apa adanya. Di sebelahnya: beban konseptor akhirnya dihitung " +
      "atas konseptornya, dan keterangan saksi tidak lagi berbunyi sama kata demi kata pada dua puluh " +
      "perkara yang berbeda.",
    added: [
      "HURUF C, D, DAN E ALASAN PERCERAIAN, diambil dari naskah yang SAMA dengan huruf yang sudah ada - Pasal 19 PP Nomor 9 Tahun 1975, diekstrak ulang dengan pdfjs. Ekstraksinya memeriksa dirinya sendiri: huruf a, b, dan f yang sudah lebih dulu tercatat terbukti sama kata demi kata dengan yang baru diekstrak, sehingga c, d, dan e dari ekstraksi yang sama berdiri di atas dasar yang sudah terbukti.",
      "BUNYI KHI UNTUK KEDELAPAN HURUF. Naskah KHI yang diberikan satker diekstrak dan TERBUKTI salinan yang sama - bukan diandaikan demikian: huruf a dan f yang sudah tercatat cocok kata demi kata, sedangkan b dan h berbeda justru pada salah baca yang memang sudah dikoreksi. Huruf C, D, dan E karena itu kini berdiri di atas dua dasar, seperti A, B, dan F.",
      "HURUF G DICATAT, justru karena belum dapat diisi. Pelanggaran taklik talak hanya ada di KHI - Pasal 19 PP berhenti di huruf f - sehingga tidak ada naskah kedua sebagai pembanding. Ia tercatat dengan siap:false alih-alih tidak ada sama sekali: huruf yang tidak tercatat tampak seperti huruf yang tidak pernah dipikirkan, sedangkan huruf yang tercatat belum siap muncul beserta sebabnya.",
      "SYARAT TIAP HURUF ikut ditulis, sebab tidak satu pun dapat disimpulkan dari kata pemicunya: huruf C menuntut 5 tahun DAN sesudah perkawinan, huruf D menuntut derajat BERAT padahal cirinya menyala pada kekerasan tingkat apa pun, huruf E menuntut AKIBAT tidak dapat menjalankan kewajiban.",
      "EMPAT ALASAN YANG DAHULU TIDAK PUNYA CIRI SAMA SEKALI kini punya: zina, pidana penjara, cacat badan atau penyakit, dan pelanggaran taklik talak. Sebelumnya keempatnya tidak pernah dapat terbaca dari posita - tidak ada satu pun barisnya.",
      "TIGA FAKTA GUGATAN MENGISI SENDIRI TEMPLATNYA: kapan menikah, berapa anaknya, dan di mana bertempat tinggal. Ketiganya ditanyakan kepada hampir tiap saksi dan sudah tertulis di posita, tetapi selama ini diketik petugas satu per satu, dikali dua saksi.",
      "RAGAM KALIMAT KETERANGAN SAKSI. Tiap keadaan dahulu punya TEPAT DUA bunyi; kini tiga sampai empat bentuk yang setara maknanya. Yang dipilih ditentukan nomor saksi DAN urutan pertanyaannya - bukan diacak, sebab acak berarti mencetak dua kali menghasilkan dua naskah yang berbeda.",
      "DASAR \"KONSEPTOR\" pada Beban Kinerja Konseptor, dan ia menjadi bawaannya.",
    ],
    changed: [
      "BEBAN KONSEPTOR DIHITUNG ATAS KONSEPTORNYA, BUKAN KETUA MAJELIS. Ketua majelis yang bertanggung jawab atas konsepnya, bukan yang mengerjakannya - konsep dikerjakan anggota majelis bergantian. Terukur atas 683 putusan 2026: konseptor menyebut 8 orang dan seluruh 683 putusan bertuan, sedangkan ketua majelis menyebut 13 orang yang enam di antaranya nama sama tertulis dua cara.",
      "Sumber nama konseptor dibuat SAMA PERSIS dengan Status Perkara - perkara_proses pada tahapan putusan, pencatat paling awal, nama lengkap dari sys_users. Dua layar yang menyebut nama berbeda untuk satu perkara yang sama tidak dibaca sebagai dua ukuran, melainkan sebagai satu yang keliru.",
      "Pencocokan ciri alasan dipindahkan ke PER KALIMAT. Bentuk lamanya menyambung seluruh butir lebih dahulu, sehingga \"dihukum\" di butir 2 dan \"penjara\" di butir 9 terbaca sebagai pernyataan bahwa seseorang dihukum penjara.",
      "Server pengembangan memakai Turbopack dan cachenya tidak lagi dibuang tiap start. Terukur: satu proses next dev memegang 2.040 MB dan 177 detik CPU, sebab --webpack dipaksa sementara cache Turbopack justru dihapus - dua baris yang saling meniadakan.",
    ],
    fixed: [
      "PILIHAN TEMPLAT YANG HILANG DARI DAFTAR PERIKSA. Baris \"(melihat/mendengar)\" digabung menjadi satu kalimat SESUDAH pemeriksa isian berjalan, sehingga ia lenyap dari daftar yang perlu diisi - padahal inilah butir yang menyangkut CARA saksi mengetahui peristiwanya, dan saksi yang hanya mendengar dari balik dinding tidak melihatnya. Skrip pemeriksanya kini 38 lulus 0 gagal, dari sebelumnya 37 lulus 1 gagal.",
      "PEMBUKA YANG DITUMPUK pada keterangan saksi: sebagian bentuk baru sudah menyatakan sendiri sejauh mana saksi mengetahuinya, sehingga pembuka yang tetap ditambahkan menerbitkan \"Yang saya ketahui, sepanjang yang saya ketahui, mereka bertengkar karena...\" - dua kali hal yang sama dalam satu kalimat.",
      "Templat yang sudah menyebut \"anak\" sesudah titik-titiknya tidak lagi menerbitkan \"anak anak\" ketika diisi otomatis.",
      "Warna peta yang hilang di tingkat kecamatan, dan layar penuh yang tidak punya jalan keluar.",
      "Tiga error tsc pada uji abt-usulan: anotasi tipenya tidak mengenal medan syarat yang sungguh ada pada kedelapan huruf.",
    ],
    security: [
      "Yang tidak tertulis di posita tidak dikarang. Posita yang tidak menyebut jumlah anak memulangkan kosong, jawabannya tetap bertitik-titik, dan barisnya tetap ditandai perlu diisi - keterangan palsu di berita acara tidak pernah diperiksa lagi setelah ditandatangani.",
      "Singkatan WIL dan PIL sengaja DITOLAK meski menggoda: pencocokannya potongan teks tanpa batas kata, sehingga keduanya akan menyala pada \"wilayah\" dan \"dipilih\". \"sakit\" ditolak sebab ia muncul pada \"sakit hati\".",
    ],
    operationalNotes: [
      "Tidak ada migrasi basis data. Versi ekstensi tidak berubah - tetap 1.157.1, yang sudah terpasang sejak 2.23.0.",
      "ENAM BARIS VARIABEL ABT harus dipasang di MariaDB satker (aps_badilag.abt_variabel no_var 4020, 8503, 8521, 8522, 8528, 8530). Berkasnya latin1 ber-CRLF dan memuat tanda kutip melengkung cp1252 - salin sebagai biner, dan muat dengan --default-character-set=latin1. Membukanya di editor lalu menyimpannya sebagai UTF-8 merusak naskah putusan tanpa memberi tanda apa pun.",
      "Tiga salah baca naskah KHI dikoreksi dan koreksinya DISEBUT pada catatan masing-masing: \"sakah satu pihak\" dan \"cacat badab\" pada huruf e, \"menlanggar\" pada huruf g. Satu selisih NYATA tidak dikoreksi melainkan dicatat berdampingan: huruf d KHI menulis \"membahayakan pihak lain\", PP menulis \"membahayakan pihak yang lain\".",
      "Huruf baru melewati SATU salinan KHI, dan itu ikut tertulis pada catatannya. Berkas aturannya menuntut dua salinan yang disepakati; untuk c, d, dan e naskah PP dipakai sebagai pembanding silang.",
    ],
    knownLimitations: [
      "BLANGKO [01] BELUM PUNYA CABANG UNTUK C, D, E, DAN G. Diperiksa langsung pada aps_badilag.abt_variabel: kueri 4020, 8521, 8522, 8528, dan 8530 seluruhnya CASE atas #8503#, dan yang dikenali hanya A, B, F, H beserta gabungan AB, AF, BF, dan ABF. Mencentang C, D, atau E membuat kelima kueri jatuh ke cabang ELSE yang berbunyi \"TIDAK BENAR QUERY NYA / BELUM ISI ALASAN DI KOLOM ABT\" - dan kalimat itu ikut TERCETAK ke dalam putusan. Keadaan ini disebut pada syarat tiap huruf, ditampilkan di sebelah kotak centangnya SEBELUM dicentang; ekstensi sudah menahannya, tetapi sesudah 8503 ditulis, dan peringatan yang datang sesudah orang memilih bukan peringatan yang menolong.",
      "HURUF G BELUM DIUSULKAN - masih siap:false, dengan dua sebab: salinan KHI-nya baru satu tanpa pembanding, DAN blangko [01] belum punya cabangnya. Keduanya tertulis pada syaratnya supaya yang membacanya tidak mengubah siap menjadi true hanya karena bunyinya sudah terisi.",
      "GABUNGAN ALASAN \"AB\" DAN \"FA\" masih jatuh ke cabang ELSE pada sebagian variabel. Cacat lama, belum diperbaiki.",
      "Variabel #5227# (Alasan-Alasan Cerai) WAJIB diisi untuk huruf C, D, E, dan G. Kalau kosong, kalimat pertimbangan berlubang di tengah.",
      "\"belum mempunyai anak\" sengaja TIDAK dipasang pada templat berpola \"dikaruniai ... anak\" dan dibiarkan bertitik-titik: kalimat kacau di berita acara lebih buruk daripada satu titik-titik yang jelas menunggu petugas.",
    ],
  },
  {
    version: "2.26.0",
    title: "ALETA Judicia v2.26.0 - Tirai Pembanding, dan Warna yang Kembali",
    date: "2026-09-19",
    status: "Belum terpasang",
    summary:
      "Butir terpentingnya bukan yang baru, melainkan yang diperbaiki: delapan lapisan peta yang " +
      "dirilis pada 2.25.0 ternyata mewarnai SELURUH desa kelabu pada pemilihan pertama, dan " +
      "berpindah lapisan lalu kembali membuatnya benar - sehingga cacat itu menyamar sebagai data " +
      "yang belum lengkap. Di sebelahnya: tirai pembanding pada Peta Perkara, perbandingan sampai " +
      "empat perkara sekaligus, dan Status Perkara yang akhirnya punya hierarki ukuran huruf.",
    added: [
      "TIRAI PEMBANDING pada Peta Perkara - dua lapisan pada satu peta, dipisah garis yang digeser. Bukan dua peta berdampingan, dan itu pilihan: dua peta menuntut zum dan geseran keduanya disamakan terus-menerus, dan sekali saja tidak sama, yang dibandingkan orang adalah dua tempat yang berbeda. Satu peta bertirai tidak menuntut apa pun disamakan, dan mata tidak berpindah sejauh lebar layar tiap kali satu desa diperiksa.",
      "Tangga warna kedua sisi tirai disusun dari jangkauan lapisannya MASING-MASING. Yang dibandingkan karena itu letak sebuah desa pada tangga sisinya sendiri - bukan warnanya dengan warna sebelah, yang memang tidak sebanding.",
      "MEMBANDINGKAN SAMPAI EMPAT PERKARA sekaligus pada Status Perkara, bukan lagi satu lawan satu. Satu pembanding menjawab kenapa yang ini lebih lama dari yang itu; yang ditanyakan berikutnya justru kenapa TIGA perkara majelis ini lebih lama. Selisihnya tetap dihitung dari perkara yang sedang dibuka ke tiap pembanding - bukan berantai dari kolom sebelahnya.",
      "JALAN DARI KARTU IDENTITAS PIHAK ke analisis Riwayat pihak. Analisisnya sudah menghitung perkara lain orang itu sejak lama - lewat NIK, nama, dan tanggal lahir; yang tidak ada adalah JALANNYA. Yang sedang menatap nama seseorang harus menutup kartunya, menggulung ke Analisis lanjutan, membukanya, lalu mencari satu tombol di antara empat puluh satu.",
    ],
    changed: [
      "HIERARKI UKURAN HURUF pada Status Perkara. Disisir sebelum disentuh: text-sm 249 pemakaian, text-xs 13, text-lg 2 - hampir seluruhnya satu ukuran. Yang membuat layar terasa padat bukan banyaknya isi (dua puluh tujuh bagian memang banyak) melainkan tidak adanya apa pun yang memberi tahu mata mana yang label dan mana yang nilai.",
      "Yang dikecilkan hanya yang perannya sekunder dan perannya dikenali dari bentuknya: 27 nama medan, 17 penjelas di samping nilainya, dan 2 kepala tabel. Dua ratus sisanya - yang memuat NILAINYA - tidak disentuh sama sekali: layar yang seluruhnya kecil sama tidak berhierarkinya dengan layar yang seluruhnya sedang.",
      "Aturan warna peta disusun ulang menjadi PABRIK yang menerima datanya lewat parameter. Bentuk lamanya memeluk data lapisan langsung dari ruang lingkupnya, dan itulah yang melahirkan cacat kelabu di bawah - sekaligus membuatnya tidak dapat dipakai sisi kedua tirai.",
    ],
    fixed: [
      "DELAPAN LAPISAN PETA 2.25.0 YANG SELURUH DESANYA KELABU. warnaTitik memeluk petaLapis, satuan, jangkauLapis, dan urutKategori tanpa menyebut keempatnya sebagai kebergantungan. Urutannya: lapisan dipilih, aturan warnanya dibuat sewaktu datanya MASIH KOSONG; datanya tiba, penggambar berjalan lagi - tetapi aturan warnanya tidak dibuat ulang, dan tetap memeluk data kosong. Seluruh desa karena itu berwarna kelabu tidak cukup pada pemilihan PERTAMA tiap lapisan; berpindah lapisan lalu kembali membuatnya benar. Tidak ada error apa pun, dan hasilnya terbaca sebagai datanya memang belum diisi. Lapisan panggilan tidak bertemu tidak terkena - kebetulan datanya ada di daftar kebergantungan.",
      "Penjaga tautan Beban Kinerja Konseptor sebelumnya mengunci UKURAN HURUF kolom Konseptor, sehingga penataan huruf mematahkan penjaga yang sama sekali bukan urusannya. Kini ia menjaga tautannya saja.",
    ],
    security: [
      "Sisi kanan tirai digambar tanpa ketukan dan tanpa keterangan melayang. Bukan penghematan: kanvasnya menutupi SELURUH peta - bukan hanya separuh kanan - sehingga membiarkannya menerima ketukan akan merampas ketukan milik sisi kiri di bagian layar tempat ia bahkan tidak terlihat.",
    ],
    operationalNotes: [
      "Tidak ada migrasi basis data. Versi ekstensi tidak berubah.",
      "Kedua lapisan tirai dibaca SATU PER SATU, bukan berbarengan: dua kueri berat yang berjalan bersamaan pada SIPP satker membuat keduanya lambat, bukan salah satunya cepat.",
      "Guntingan tirai hanya mengubah satu sifat gaya pada dua elemen - bukan menyusun ulang sembilan ratus lingkaran - sehingga tirainya dapat digeser terus-menerus tanpa peta tersendat.",
      "Tirai diuji pada halaman mandiri berisi Leaflet dan 400 titik desa sungguhan, bukan di dalam portal yang berjalan: peta portal menuntut masuk akun, dan itu tidak dikerjakan. Yang terukur di sana tepi guntingannya, pada lima gabungan zum-geseran-tirai - dan kelima-limanya jatuh tepat pada pikselnya.",
    ],
    knownLimitations: [
      "Sisi kanan tirai tidak dapat diketuk dan tidak memunculkan keterangan melayang - keduanya tetap milik sisi kiri. Angka sisi kanan terbaca dengan menggeser tirai melewati desanya, atau dengan menukar kedua lapisan.",
      "Selama gerak zum berlangsung, garis tirai dapat sesaat tidak sejajar dengan tepi warnanya; keduanya bertemu kembali begitu geraknya selesai.",
      "Perbandingan dibatasi empat pembanding. Dengan kolom label, kolom perkara yang sedang dibuka, dan kolom selisih, empat sudah membuat tabelnya berkolom tujuh - dan tabel yang harus digulung ke samping bukan perbandingan lagi: yang dibandingkan justru dua kolom yang tidak dapat dilihat bersamaan.",
      "Cacat warna kelabu di atas ditemukan dengan MEMBACA kode, lalu dipastikan oleh eslint yang menyebutkan tepat kelima nama kebergantungan yang hilang - bukan dengan melihat petanya di portal yang berjalan. Pemasangan di server tetap perlu diperiksa mata.",
    ],
  },
  {
    version: "2.25.0",
    title: "ALETA Judicia v2.25.0 - Peta yang Mengusulkan",
    date: "2026-09-19",
    status: "Belum terpasang",
    summary:
      "Peta Perkara berubah dari alat MELIHAT menjadi alat MEMUTUSKAN. Delapan lapisan baru, " +
      "cincin jarak dari kantor, dan usulan sidang keliling yang dihitung - bukan dikira. " +
      "Pembukanya satu angka: hanya 11% perkara datang dari radius sepuluh kilometer, sementara " +
      "dua desa berjarak 163 km menyumbang 145 perkara tanpa pernah disidangi keliling.",
    added: [
      "CINCIN JARAK 10/25/50/100 KM dari kantor pengadilan, beserta penanda kantornya. Terukur: 11% perkara dari radius 10 km, 29% dari 25 km, 60% dari 50 km, 92% dari 100 km. Tanpa cincin, angka itu tidak terlihat sama sekali - peta hanya memperlihatkan titik yang tersebar.",
      "USULAN SIDANG KELILING YANG DIHITUNG: banyaknya perkara x jarak x angka panggilan gagal, dan yang kecamatannya SUDAH terlayani dikeluarkan. Tanpa pengecualian itu, usulannya akan terus menyebut Sigi Biromaru yang justru sudah 126 kali disidangi keliling. Teratas pada data satker: Ogoamas I dan II di Sojol Utara - 145 perkara, 163 km, belum pernah terlayani.",
      "LAPISAN BIAYA PANGGILAN. Terukur dan selisihnya besar: Alitupu rata Rp 409.800 per panggilan, Sibayu Rp 166.208 - dua setengah kali lipat. Berguna menakar panjar dan menilai kewajaran radius.",
      "LAPISAN PIHAK TIDAK HADIR - berbeda dari panggilan tidak bertemu, dan perbedaannya penting: yang ini SUDAH dipanggil dan panggilannya sampai, ia tetap tidak datang. Yang satu masalah jurusita, yang ini kepatuhan pihak.",
      "LAPISAN PIHAK BERULANG - orang yang berperkara lebih dari sekali, dicocokkan lewat NIK bukan nama. 295 orang di seluruh basis data, dan mereka mengelompok: satu desa di Sigi Biromaru memuat 12 orang dengan 24 perkara.",
      "LAPISAN PERUBAHAN ANTAR TAHUN. Desa yang MELONJAK lebih menarik daripada desa yang memang selalu banyak: Labuan Toposo 8 perkara menjadi 46, dan satu desa Sigi Biromaru dari nol menjadi 33.",
      "LAPISAN FAKTOR PERCERAIAN DOMINAN per desa - terisi pada 4.603 dari 4.607 akta. Desa mana yang faktornya ekonomi dan mana yang perselisihan belum pernah bisa dijawab, dan itu bahan penyuluhan.",
      "LAPISAN JURUSITA YANG MELAYANI - siapa mengantar relaas ke desa mana. Disandingkan dengan lapisan panggilan tidak bertemu, ia menjawab pembagian tugas.",
      "PENANDA SIDANG KELILING YANG SUDAH ADA - Sigi Biromaru 126 sidang, Rio Pakava 40, Terpadu Sindue 39. Tanpa ini, usulan sidang keliling tidak dapat dinilai siapa pun: yang terlihat hanya desa jauh, bukan desa jauh YANG BELUM TERLAYANI.",
      "DAFTAR DESA TANPA PERKARA per kabupaten. Terukur di Donggala dan hasilnya sendiri sebuah jawaban: hanya 13 desa yang tidak pernah muncul - hampir tiap desa di wilayah hukum ini pernah berperkara.",
      "UNDUH CSV isi lapisan yang sedang tampil, lengkap dengan tanda urutan bita supaya Excel tidak merusak huruf nama desanya.",
    ],
    changed: [
      "Tangga warna tiap lapisan disusun dari data yang SEDANG TAMPIL, bukan dari batas tetap. Batas yang cocok untuk biaya panggilan (ratusan ribu rupiah) tidak cocok untuk persentase, dan yang cocok untuk keduanya tidak cocok untuk selisih yang dapat negatif.",
      "Selisih antar tahun diwarnai DUA rona yang bertemu di tengah, bukan satu rona yang menua: nol pada selisih berarti tidak berubah - ia tengah, bukan ujung.",
      "Faktor perceraian dan nama jurusita memakai palet KATEGORI berjumlah delapan, dan yang melewatinya jatuh ke kelabu alih-alih diputar. Warna yang berputar membuat kategori kesembilan berwarna sama dengan yang pertama, dan pembacanya menyangka keduanya hal yang sama.",
      "Titik kantor pengadilan dapat diganti lewat NEXT_PUBLIC_PETA_KANTOR, supaya satker lain memakai layar yang sama tanpa menyentuh kode.",
    ],
    fixed: [
      "DUA KOLOM BERNAMA jurusita_id YANG BUKAN HAL YANG SAMA. Susunan pertama menyambung perkara_pelaksanaan_relaas.jurusita_id ke perkara_jurusita.jurusita_id - namanya sama, isinya bukan: dari 14.495 relaas, NOL yang menemukan namanya. Tidak ada error; hanya kolom nama yang kosong seluruhnya, dan peta yang seluruh desanya bertulis tidak tercatat. Yang benar tabel induk jurusita lewat id - 7.101 dari 14.495 (49%).",
    ],
    security: [
      "Daftar lapisan dibaca dengan hasOwnProperty atas objek tanpa induk: nama fungsi tidak pernah datang dari peramban. constructor dan toString pernah menembus daftar yang tampak tertutup pada layanan analisis - lihat catatan 2.19.x.",
      "Nama pihak pada daftar perkara per desa tetap berupa INISIAL. Peta dibuka di layar yang kerap terlihat orang lain.",
    ],
    operationalNotes: [
      "Tidak ada migrasi basis data. Versi ekstensi tidak berubah.",
      "SATU ORANG, LIMA EJAAN. Tabel jurusita memuat MOH.SYUKRI S.H 2.727 relaas, Mohammad Syukri SH 1.041, Moh.Syukri 478, dan MOH SYUKRI 431 - satu orang yang sama. Ejaannya SENGAJA tidak disatukan: menebak kemiripan nama adalah cara tercepat menggabungkan dua orang yang berbeda. Yang dikerjakan menyebutkan keadaan itu di layar.",
      "Tiap lapisan dibaca HANYA ketika dipilih, dan disimpan sesudahnya. Lapisan biaya sendiri menyisir seluruh transaksi pada rentangnya - terukur 938 milidetik untuk delapan tahun - dan tidak ada gunanya dibayar oleh yang hanya melihat jumlah perkara.",
      "Waktu tiap lapisan pada data satker: perubahan 64 ms, jurusita 147 ms, berulang 226 ms, faktor 506 ms, kehadiran 845 ms, biaya 938 ms, desa tanpa perkara 2.497 ms.",
    ],
    knownLimitations: [
      "PETANYA TIDAK DAPAT DIUNDUH SEBAGAI GAMBAR, dan itu bukan kelalaian: ubinan peta datang dari server lain tanpa izin lintas-asal, sehingga kanvas yang memuatnya menjadi ternoda dan peramban menolak mengubahnya menjadi berkas. Yang diberikan angkanya - CSV - dan untuk laporan, angka justru lebih berguna daripada gambar.",
      "Angka panggilan gagal pada usulan sidang keliling hanya terisi bila lapisan panggilan tidak bertemu sudah dibuka sekali; ia dibaca terpisah dan tidak dibayar oleh yang tidak membukanya.",
      "Nama jurusita hanya terbaca pada 49% relaas, dan NIK hanya terisi pada 35% pihak - lapisan pihak berulang karena itu BATAS BAWAH, bukan hitungan penuh.",
      "Belum ada dua peta berdampingan untuk membandingkan dua rentang. Lapisan perubahan antar tahun menjawab pertanyaan yang sama dengan satu peta, dan itu yang dikerjakan lebih dahulu.",
      "Kepadatan per penduduk tetap tidak dapat dihitung - tidak ada data penduduk di SIPP. Itu ukuran yang paling benar (desa besar wajar banyak perkara) dan menuntut data dari luar.",
    ],
  },
  {
    version: "2.24.0",
    title: "ALETA Judicia v2.24.0 - Peta yang Menjawab, Layar yang Menyapa, dan Sepuluh Pertanyaan Baru",
    date: "2026-09-18",
    status: "Belum terpasang",
    summary:
      "Dua pekerjaan. Peta Perkara kini punya peta sungguhan - satu lingkaran per desa di atas peta " +
      "jalan, luasnya sebanding dengan jumlah perkara, koordinatnya dari OpenStreetMap sebab " +
      "satu-satunya tabel SIPP yang punya lintang/bujur memuat sembilan titik untuk seluruh Sulawesi " +
      "Tengah. Dan Status Perkara: nama pihak yang diketuk membuka identitasnya, perkara dapat " +
      "dijajarkan dengan perkara lain beserta selisihnya, serta dua puluh enam tempat yang warnanya " +
      "tidak terbaca pada tema gelap - tema bawaan portal ini - diperbaiki.",
    added: [
      "PETA TITIK PER DESA di halaman Peta Perkara, sebagai tab pertama. Satu lingkaran per desa di atas peta jalan sungguhan; arahkan penunjuk untuk melihat nama desa, kecamatan, jumlah perkara, pembagian laki-laki/perempuan, dan jenis perkara terbanyak di desa itu.",
      "Warna lingkaran mengikuti jenis perkara terbanyak di desa itu - cerai gugat merah, cerai talak biru, sama dengan lencana di daftar. Warnanya diturunkan dari penanda yang sudah ditetapkan satker, bukan dipilih ulang di layar peta.",
      "Keterangan ukuran memakai ANGKA SUNGGUHAN dari data yang sedang tampil - tiga lingkaran contoh beserta jumlah perkaranya - bukan sekadar kalimat \"besar berarti banyak\".",
      "Pilihan ubinan peta lewat NEXT_PUBLIC_PETA_UBIN, supaya satker dapat menunjuk server ubin di jaringan dalam bila kelak ada.",
      "JALAN KE BEBAN KINERJA KONSEPTOR dari Status Perkara - tepat di sebelah kolom Konseptor, dan sekali lagi di kepala Analisis lanjutan. Nama konseptornya selama ini sudah ada di layar itu, tetapi penilaian bebannya ada di layar lain yang TIDAK muncul di beranda - hanya di menu samping, dan hanya untuk pimpinan serta kepaniteraan. Petugas yang membaca namanya karena itu wajar menyimpulkan penilaiannya tidak ada; itu memang yang dilaporkan satker.",
      "SEPULUH ANALISIS BARU di Status Perkara - dari 31 menjadi 41: jeda antar tahapan (di mana perkara ini berhenti lama), hari sidang dibanding pengadilan, kecepatan relaas beserta Pasal 122 HIR, kehadiran pihak tiap sidang, perkara lain dari desa yang sama, beban majelis pada bulan pendaftaran, jeda putus ke minutasi ke BHT ke akta cerai, jam sidang, ruang sidang, dan rombongan sepekan - perkara yang masuk pada pekan yang sama, pembanding yang paling adil sebab majelisnya sama-sama sibuk dan panggilan jurusitanya berebut hari yang sama.",
      "SEPULUH ALAT BARU di kepala Status Perkara: salin ringkasan (sebagai kalimat, bukan tabel - yang ditempel ke WhatsApp kehilangan seluruh kolomnya), salin tautan perkara, cetak, buka semua bagian, tutup semua bagian, cari bagian di antara dua puluh tujuh, loncat ke bagian itu, riwayat perkara yang baru dibuka, sematkan perkara yang sedang dikerjakan, dan buka SIPP. Seluruhnya di peramban; tidak satu pun menyentuh server.",
      "LAPISAN PANGGILAN TIDAK BERTEMU pada peta - desa mana yang relaasnya paling sering gagal. Pertanyaan jurusita yang tidak dapat dijawab peta jumlah perkara, dan yang menentukan berapa kali ia harus kembali serta desa mana yang layak diusulkan jadi tempat sidang keliling. Terukur pada data satker: Kapirowe 10 dari 10 relaas tidak bertemu, Kalora 9 dari 10, Langaleso 8 dari 11 - sementara rata-ratanya 38%.",
      "LINGKARAN PETA YANG DIKETUK MEMBUKA DAFTAR PERKARA desa itu - nomor, jenis, dan tanggal putusnya. Peta yang hanya dapat dilihat berhenti pada \"oh, banyak\"; yang dapat diketuk meneruskan ke pekerjaan. Nama pihaknya berupa INISIAL, bukan nama utuh.",
      "DIPERKECIL, PETANYA MENGELOMPOK PER KECAMATAN - bukan per petak layar. Pengelompokan menurut piksel menghasilkan satuan yang tidak berarti apa pun (\"delapan titik yang kebetulan berdekatan pada zum sembilan\"); kecamatan adalah satuan wilayah sungguhan yang langsung terbaca petugas. Titiknya pusat rata-rata desa anggotanya, bukan titik kecamatan yang dikarang.",
      "KARTU RINGKAS di kepala Status Perkara - keadaan perkara, lama prosesnya, sidang berikutnya, majelis dan panitera sidangnya. Dua puluh enam bagian di bawahnya, dan yang membuka layar ini hampir selalu datang dengan tiga pertanyaan yang sama; ketiganya sebelumnya menuntut menggulung melewati bagian yang terciut.",
      "DAFTAR PERLU TINDAKAN di bawah kartu itu - majelis belum ditetapkan, lewat lima bulan (SEMA 2/2014), mediasi lewat tiga puluh hari (PERMA 1/2016), belum ada sidang berikutnya, minutasi atau BHT belum tercatat, akta cerai belum diserahkan. Peringatannya DIKUMPULKAN dari yang sudah tampil di bagian-bagian di bawah, bukan dilahirkan di sini: kalau ia melahirkan sendiri, akan ada dua sumber kebenaran yang menyimpang diam-diam.",
      "NAMA PIHAK YANG DIKETUK MEMBUKA IDENTITASNYA - kedudukan, jenis kelamin, tempat dan tanggal lahir beserta umurnya, pekerjaan, pendidikan, agama, status kawin, kewarganegaraan, wilayah berjenjang, alamat, RT/RW, NIK dan telepon yang disamarkan. Selama ini keempat yang pertama menuntut petugas membuka SIPP di jendela lain, padahal justru itu yang ditanyakan ketika menyusun penetapan dan memeriksa relaas.",
      "BANDINGKAN DENGAN PERKARA LAIN - isi satu nomor perkara, dan kedua perkara dijajarkan pada dua belas butir beserta SELISIHNYA: jenis, tanggal daftar, tanggal putusan, status putusan, lama proses, jeda minutasi, jumlah sidang, penundaan, jumlah pihak, majelis, panitera sidang, dan mediasi. Selisihnya dihitung, bukan dibiarkan dihitung mata - itulah pekerjaan yang sedang dihindari orang yang membuka layar ini.",
      "Jalan ke Peta Perkara ditambahkan di kepala Analisis lanjutan juga. Ketiga puluh satu analisis di sana menjawab pertanyaan tentang PERKARA atau tentang PENGADILAN; dua pertanyaan yang kerap ditanyakan dari sana justru tentang ORANG dan tentang TEMPAT, dan daftar tiga puluh satu tombol adalah tempat yang buruk untuk menyembunyikan dua jawaban yang tidak ada di dalamnya.",
    ],
    changed: [
      "Keputusan \"tidak ada peta\" pada 2.22.0 DIBALIK, dan pembalikannya diukur. Yang tidak boleh ternyata bukan \"peta\", melainkan \"koordinat dari kode_pos\". Seluruh SIPP disisir lewat information_schema: kode_pos adalah satu-satunya tabel yang punya kolom lintang/bujur, dan 2.023 barisnya untuk Sulawesi Tengah hanya memuat SEMBILAN titik unik - satu per kabupaten, disalin ke tiap desa di bawahnya. Digambar apa adanya, 1.917 desa menumpuk menjadi 9 titik.",
      "Layanan peta perkara kini mengirim satu baris per desa yang dikunci KODE wilayah, bukan nama. Daftar yang ditelusuri turun tetap dikunci nama - di dalam satu kecamatan tidak ada dua desa senama - tetapi peta memajang seluruh desa sekaligus, dan di tingkat itu nama berulang: \"Labuan\" ada enam kali di Sulawesi Tengah, tersebar 1,9 derajat. Dikunci nama, keenamnya menyatu jadi satu titik yang jumlahnya benar untuk enam desa sekaligus dan salah untuk masing-masing.",
      "Hitungan titiknya disusun dari baris yang SAMA dengan sebaran berjenjang - bukan kueri ketiga ke SIPP. Barisnya sudah di tangan; mengelompokkannya sekali lagi berlangsung dalam hitungan milidetik.",
    ],
    fixed: [
      "MODE GELAP PETA TIDAK PERNAH MENYALA. Petanya membaca tema dari atribut data-theme lalu jatuh ke pengaturan peramban - dua hal yang tidak dipakai portal ini sama sekali. Portal ALETA menyalakan temanya lewat kelas dark pada <html>, dan bawaannya GELAP. Akibatnya peta jalan yang menyilaukan di atas halaman gelap, tanpa satu pun error berbunyi. Kini dibaca dari kelas itu; ubinan petanya dibalik, lingkarannya TETAP warnanya.",
      "DUA PULUH ENAM TEMPAT DI STATUS PERKARA TIDAK TERBACA PADA TEMA GELAP. Warna Tailwind berangka besar - 700, 800, 900 - dibuat untuk latar terang; di layar petugas yang bawaannya gelap itu tulisan cokelat tua di atas latar hampir hitam, dan kotak bg-amber-50 menjadi kotak nyaris putih di tengah halaman gelap. Terukur: 19 atribut kelas amber tanpa satu pun pasangan dark:, ditambah tujuh pada lencana rubrik, rose, dan sky. Kini dijaga penjaga yang menyisir tiap atribut kelas di berkas itu.",
    ],
    security: [
      "Pustaka petanya (Leaflet 1.9.4) dimuat dari server sendiri di public/vendor, bukan dari CDN. Pengadilan ini bekerja di jaringan yang tidak selalu punya jalan keluar, dan pustaka yang dipanggil dari luar membuat halaman ini gagal total di hari jaringan luar mati - gagalnya berupa layar kosong tanpa sebab yang tertulis. Cara yang sama sudah dipakai pdf.js sejak lama.",
      "Ia juga TIDAK ditambahkan sebagai kebergantungan npm: hanya satu halaman yang memakainya, dan menambahkannya ke package.json berarti ia ikut ditimbang pada tiap build dan ikut menjadi urusan tiap `npm ci` di server.",
      "Penyebutan sumber ubinan tidak dapat dimatikan dari layar - data OpenStreetMap berlisensi ODbL dan syaratnya menyebut sumber.",
      "NIK dan nomor telepon pihak disamarkan DI SERVER, bukan di layar - bentuknya cukup untuk mencocokkan dengan berkas di tangan, tidak cukup untuk disalin. Yang disamarkan di layar tetap melintasi jaringan dalam bentuk utuhnya dan tetap terbaca siapa pun yang membuka alat pengembang.",
      "Tautan Beban Kinerja Konseptor hanya digambar bagi peran yang memang dapat membukanya, dan haknya ditanyakan ke sumber yang SAMA dengan yang menyusun menu samping - bukan dengan menyalin daftar perannya ke layar Status Perkara. Daftar peran yang disalin menyimpang diam-diam begitu satker mengubah Akses Menu, dan yang menyimpang justru tautan yang berujung penolakan.",
    ],
    operationalNotes: [
      "Tidak ada migrasi basis data. Versi ekstensi tidak berubah.",
      "KUERI ANALISIS BARU DIPERCEPAT SEBELUM DIPASANG, dan sebabnya satu: syarat yang MEMBUNGKUS kolom tanggal. DATE_FORMAT(tgl,'%Y-%m') = ? dan YEARWEEK(tgl,1) = ? memaksa MySQL menghitung fungsinya untuk setiap baris lebih dahulu, sehingga indeksnya tidak terpakai. Terukur: beban majelis 17.952 ms menjadi 94 ms, rombongan sepekan 4.345 ms menjadi 46 ms, perkara sedesa 6.657 ms menjadi 1.168 ms. Ketiganya menjawab BENAR sebelum diperbaiki - tidak ada yang akan menangkapnya selain pengukuran.",
      "Kesepuluh analisis baru hidup di berkasnya sendiri (analisaTambahanService) dan MENERIMA alatnya dari penyalur - runQuery, cleanText, median, selisihHari yang sama. Menyalinnya akan melahirkan dua median yang membulatkan berbeda, dan bedanya baru terlihat pada angka yang sudah tercetak di laporan.",
      "Riwayat perkara dan sematan disimpan di PERAMBAN, bukan di server. Keduanya menyebutkan perkara mana yang dibuka seseorang; disimpan di server, ia menjadi catatan siapa memeriksa perkara siapa - keterangan yang tidak diminta siapa pun dan yang keberadaannya sendiri menimbulkan pertanyaan.",
      "SANDI ket_temu BERGANTI ARTI, dan lapisan panggilan dibatasi karenanya. Sampai 2024 kolom itu berisi Y (bertemu) dan T (tidak bertemu); sejak 2025 hampir seluruhnya S dan E - sandi yang menandai SALURAN pengiriman, bukan hasil pertemuan. Terukur: 'T' tinggal 2 baris setahun pada 2025 dan 2026. Dihitung apa adanya, dua tahun terakhir memulangkan 0% tidak bertemu, dan angka itu terbaca sebagai pelayanan sempurna. Yang dihitung karena itu HANYA baris bersandi Y/T - 7.751 dari 14.495 - dan pembatasannya disebut di layar. Ia menyesuaikan diri sendiri: begitu satker kembali memakai Y/T, barisnya ikut terhitung tanpa kode disentuh.",
      "Desa dengan kurang dari sepuluh relaas dibiarkan KELABU di peta, tidak dipersenkan. Tiga relaas yang dua di antaranya gagal bukan \"67% gagal\" - itu kebetulan, dan mewarnainya seperti desa lain membuat kebetulan terbaca sebagai temuan.",
      "Daftar perlu tindakan sengaja dapat KOSONG. Daftar yang selalu berisi sesuatu akan diabaikan orang dalam sepekan, dan yang diabaikan sama saja dengan tidak ada.",
      "Identitas pihak punya ALAMATNYA SENDIRI dan dibaca hanya ketika satu nama diketuk - tidak ditempelkan ke muatan status. Ini data pribadi, dan layar Status Perkara dibuka di meja yang kerap terlihat orang lain; ditempelkan ke muatan status, ia ikut terkirim pada setiap perkara yang dibuka siapa pun - termasuk yang hanya ingin melihat jadwal sidang - lalu ikut tersimpan di singgahan peramban.",
      "Arti angka status kawin TIDAK ditebak. Kolomnya berisi 1/2/3/4 tanpa tabel rujukan di basis data; artinya dibaca dari kode SIPP sendiri: 1 Kawin, 2 Belum Kawin, 3 Duda, 4 Janda. Sebarannya cocok - 26.115 baris berstatus kawin dari 36.451 pihak. Angka di luar keempatnya tidak diterjemahkan dan tidak ditampilkan.",
      "Kolom nama_ayah dan nama_ibu tidak dibaca sama sekali: NOL dari 36.451 baris terisi, dan kolom yang selalu kosong hanya menambah baris bertanda hubung pada layar.",
      "CAKUPANNYA DIUKUR, DAN DISEBUT DI LAYAR: 521 dari 704 desa yang pernah muncul di perkara punya titik - 74,0% desa, tetapi 85,7% BARIS PIHAK, sebab desa yang tidak berjodoh rata-rata kecil. Angka itu ditampilkan di bawah peta, bukan disembunyikan.",
      "Desa yang tidak berjodoh TIDAK digambar di pusat kecamatannya. Itu akan membuat petanya terlihat lengkap sambil memindahkan perkara ke desa yang bukan asalnya, dan tidak ada yang akan memeriksanya.",
      "Penjodohan dikerjakan SEKALI di luar portal (kerja/jodohkan-desa.py) dan hasilnya disimpan berkunci kode BPS - portal hanya mencari kunci. Penjodohan nama adalah tebakan terdidik; menjalankannya tiap kali halaman dibuka berarti jawabannya dapat berubah antara pagi dan sore tanpa ada yang menyentuh apa pun.",
      "Ubinan petanya tetap datang dari luar. Bila jaringan satker terputus, peta jalannya kosong tetapi lingkarannya tetap tergambar, dan sebaran berjenjang di tab sebelahnya tidak terpengaruh sama sekali.",
    ],
    knownLimitations: [
      "136 desa (13,2% baris pihak) belum punya titik karena memang belum ada di OpenStreetMap - antara lain Tinggede dan Kotapulu di Sigi, Maleni dan Kavaya di Donggala, Besusu Barat di Palu. Daftarnya tersimpan di kerja/desa-belum-berkoordinat.tsv; menambahkannya berarti memetakannya di OSM atau menyediakan berkas koordinat satker sendiri.",
      "47 desa masih punya beberapa calon titik yang berjauhan dan sengaja TIDAK dipilihkan salah satunya - seluruhnya hanya 125 baris pihak (1,1%). Menebak akan benar kira-kira separuh waktu, dan separuh yang salah tidak akan terlihat oleh siapa pun.",
      "Identitas pihak hanya selengkap isian SIPP-nya. Terukur pada 36.451 baris: alamat dan jenis kelamin 100%, pekerjaan 99%, tanggal lahir 96%, tempat lahir 67% - tetapi NIK hanya 35%, telepon 18%, agama 16%, dan pendidikan 13%. Baris yang kosong tidak digambar sama sekali, bukan diisi tanda hubung.",
      "Perbandingan perkara membaca SIPP untuk perkara kedua, jadi ia menuntut satu pembacaan lagi. Yang dibandingkan dua belas butir yang sudah ada pada muatan status - bukan seluruh isinya.",
      "Analisis 'jeda sesudah putus' memberi peringatan pada jeda minutasinya sendiri: tanggal_minutasi terisi sendiri sama dengan tanggal putusan pada seluruh 683 putusan 2026. Nol hari di sana berarti kolomnya mati, bukan minutasi seketika. Jeda BHT dan akta cerai terukur sungguhan - rata 20 dan 3 hari.",
      "Analisis 'ruang sidang' menemukan satu ruangan dengan DUA EJAAN: \"Ruang Sidang 1 Dalam Gedung\" 1.353 baris dan \"Ruang Sidang Dalam Gedung 1\" 211 baris. Laporan apa pun yang mengelompokkan menurut nama ruangan menghitungnya sebagai dua ruangan - itu keadaan data SIPP, bukan sesuatu yang dapat diperbaiki dari sini.",
      "Lapisan panggilan tidak bertemu praktis hanya bercerita tentang 2019-2024. Menambah tahun berjalan menuntut satker kembali mengisi ket_temu dengan Y/T, atau arti sandi S dan E dipastikan lebih dahulu - keduanya keputusan satker, bukan keputusan alat yang menumpang membaca.",
      "Daftar perlu tindakan memakai muatan yang sudah ada di layar. Ia karena itu tidak dapat memperingatkan hal yang tidak dikirim server - misalnya relaas yang kurang satu pihak, yang perlu pembacaan tersendiri.",
      "Peta menggambar SELURUH rentang yang dipilih, bukan hasil penelusuran turun. Menelusuri ke satu kecamatan mengubah daftar dan grafiknya, bukan petanya.",
      "Belum ada batas wilayah yang diwarnai (choropleth) - hanya titik. Batas desa se-Sulawesi Tengah belum terpetakan lengkap di OSM, dan mewarnai batas yang setengah ada menghasilkan peta berlubang yang terbaca sebagai \"tidak ada perkara\".",
    ],
  },
  {
    version: "2.23.0",
    title: "ALETA Judicia v2.23.0 - Hasil Sidang: Ditunda atau Diputus, Satu Layar Satu Pilihan",
    date: "2026-09-18",
    status: "Terpasang",
    summary:
      "Sepuluh perbaikan pada layar hasil sidang, seluruhnya diminta satker sesudah memakainya. " +
      "Alurnya kini ditiru dari aplikasi antrian sidang satker sendiri - dibaca dari sumbernya di " +
      "server, bukan dikira-kira - sementara tampilannya tidak ditiru. Yang paling menentukan: akun " +
      "SIPP tidak lagi ditanyakan, dan memutus tidak lagi menuntut amar putusan.",
    added: [
      "SATU LAYAR, SATU PILIHAN: Ditunda atau Diputus. Sidang tidak dapat ditunda DAN diputus sekaligus, dan dua blangko yang berdiri berdampingan adalah undangan mengisi keduanya. Blangkonya baru muncul sesudah salah satunya dipilih.",
      "TOMBOL STATUS di bawah Rincian pada Jadwal Perkara yang Bersidang. Kotak nomor perkara kini membuka hasil sidang, dan jalan ke Status Perkara ikut hilang bersamanya - hilang tanpa berbunyi apa pun, sebab tombolnya masih ada, hanya membuka tempat yang berbeda. Keduanya kini berdiri sendiri-sendiri.",
      "ALASAN PENUNDAAN DITAWARKAN - sembilan yang paling lazim, dan tetap boleh diketik sendiri. Daftar tertutup akan memaksa panitera sidang memilih alasan yang bukan alasannya, dan alasan keliru pada berkas perkara lebih buruk daripada alasan yang diketik panjang.",
      "TANGGAL DAN JAM SIDANG BERIKUTNYA TERISI SENDIRI: dua pekan sesudah sidang ini, pukul 09:00 - kecuali agenda jawab-menjawab dan kesimpulan yang disidangkan pukul 15:00. Keduanya usulan: hari liburnya tetap diperiksa server, dan jam yang sudah disetel tangan tidak ditimpa ketika agendanya diketik ulang.",
      "TANGGAL PUTUSAN BAWAANNYA HARI INI dan jenis putusannya Dikabulkan - keduanya masih dapat diganti. Blangko yang dibuka pada hari putusnya menanyakan tanggal yang sudah diketahuinya sendiri.",
    ],
    changed: [
      "AKUN SIPP TIDAK LAGI DITANYAKAN - pada penundaan maupun putusan. Penundaan ditulis atas nama PANITERA SIDANG perkara itu dan putusannya atas nama HAKIM-nya; keduanya sudah melekat pada perkaranya sejak penetapan, dan aplikasi antrian sidang satker membacanya dari perkara_panitera_pn dan perkara_hakim_pn - tidak pernah menanyakannya. Isian itu dibuang, bukan sekadar diisi otomatis: isian yang terisi sendiri masih dapat disunting, dan yang dapat disunting akan disunting.",
      "MEMUTUS TIDAK LAGI MENUNTUT AMAR, PERTIMBANGAN HUKUM, SUMBER HUKUM, ATAU CATATAN. Panitera sidang mencatat FAKTA bahwa hari ini perkaranya diputus; naskahnya ditulis hakim beberapa hari kemudian lewat SIPP. Aplikasi antrian satker sendiri mengisi amar dengan harfiah \"BELUM DIINPUT\" dan sumber hukumnya tetap '8,11'. Blangko yang menuntut amar menahan pencatatan sampai naskahnya jadi - padahal papan antrian, laporan harian, dan akta cerai membutuhkan faktanya hari ini.",
      "Putus menandai sidangnya SELESAI, bukan ditunda: ditunda = 'T', dan alasan_ditunda memuat \"putus DIKABULKAN (verstek)\". Itulah yang dibaca papan hasil sidang, dan itu pula bentuk yang ditulis aplikasi antrian.",
      "Kehadiran pihak memakai angka SIPP yang sebenarnya - 1 semua hadir, 2 pihak pertama saja, 3 pihak kedua saja, 4 tidak hadir - dibaca dari menu.sidang.php di server. Pihak pertama dan kedua hanya ditawarkan pada perkara gugatan; permohonan tidak punya pihak kedua.",
    ],
    fixed: [
      "RINCIAN SIDANG YANG TERPOTONG, dua sebab sekaligus. Pertama lebarnya: baris rincian adalah satu sel di dalam tabel selebar 980px yang duduk dalam kotak bergulir mendatar, sehingga isinya melebar mengikuti TABELNYA, bukan mengikuti yang terlihat - separuhnya berada di luar layar. Kini ia dipaku pada tepi kiri yang terlihat, selebar yang terlihat. Kedua tingginya: pembatasan 70vh melahirkan gulir bersarang begitu rincian dibuka, dan pembatasan itu kini dilepas selama ada rincian terbuka.",
      "Cadangan kehadiran pihak dahulu 1 - \"semua hadir\" - pada sidang yang kolomnya kosong. Kosong pada 1.373 dari 20.171 baris, dan menuliskan \"semua hadir\" di sana adalah pernyataan yang terbaca sebagai fakta persidangan. Cadangannya kini 4, sama dengan pilihan pertama aplikasi antrian.",
      "Sidang yang BELUM dicatat dahulu terbaca sebagai sudah diputus. Keduanya berbendera ditunda = 'T' - itu nilai bawaan kolomnya - dan yang memisahkannya hanya isi alasan_ditunda. Aturan pemisahnya yang sudah diukur atas 20.063 baris kini dipakai ulang, bukan ditulis lagi.",
      "JAM YANG TERCATAT DELAPAN JAM TERLALU AWAL. Penulis hasil sidang dan penulis putusan menanyakan jam kepada container, bukan kepada basis data - dan Node di dalam container jatuh ke UTC bila env TZ tidak diset. Terukur di server: basis data menjawab 13:16 WITA sementara Node menjawab 05:16. Seluruh baris sys_audittrail yang ditulis ALETA karena itu tercatat delapan jam sebelum kejadiannya, berselisih dengan baris SIPP di tabel yang sama yang jamnya benar. Penulis penetapan sudah memakai jam basis data sejak lama; kedua penulis ini tertinggal, dan tertinggalnya tidak berbunyi apa pun.",
      "Kolom sampai_jam dahulu diisi tulisan kosong pada penundaan dan cap waktu utuh pada putusan. Kolomnya TIME: yang kosong masuk sebagai 00:00:00 tanpa error, dan cap waktu utuh dibaca sebagai bentuk 'D HH:MM:SS' yang bukan jam yang dimaksud. Keduanya kini jam saja, dari cap waktu yang sama.",
      "Tanggal sidang dikirim ke portal sebagai obyek Date, dan JSON menuliskannya dalam UTC - sidang 18 September pukul 00:00 WITA terkirim sebagai \"2026-09-17T16:00\". Layar membaca sidangnya SEHARI LEBIH AWAL, lalu menghitung usulan sidang berikutnya dari tanggal yang salah itu. Diubah menjadi tulisan di satu tempat, bukan di tiap pembacanya.",
      "ANTRIAN SIDANG TIDAK PERNAH TERGERAKKAN PADA PENUNDAAN - sebab yang sama. Tanggal yang diserahkan kepada penggerak antrian adalah obyek Date itu juga, dan pemeriksa bentuknya menolak setiap kali: layar berkata \"Antrian tidak tergerakkan: tanggal_tidak_sah\" pada penundaan yang sebenarnya berhasil. Terukur sesudah perbaikan: antriannya kini benar-benar ditandai selesai.",
    ],
    security: [
      "Kering sebagai bawaan tetap berlaku pada ketiga lapis, dan kini juga pada jalur putus panitera sidang: tombol tulis terkunci sampai rencananya dibaca, dan rencana itu menyebutkan tiap baris yang akan ditulis termasuk barisnya di sys_audittrail.",
      "Menghapus isian akun SIPP menutup satu pintu yang tidak ada penjaganya: audit trail SIPP hanya mencatat nama yang diberikan kepadanya, jadi nama yang salah ketik - atau nama orang lain - akan tercatat sebagaimana adanya tanpa satu pun pemeriksaan menangkapnya.",
      "Angka kehadiran di luar 1..4 tidak menyentuh kolomnya sama sekali. Menuliskan angka yang tidak punya arti lebih buruk daripada membiarkan yang sudah ada.",
    ],
    operationalNotes: [
      "Tidak ada migrasi basis data. Versi ekstensi tidak berubah.",
      "Alamat halamannya tetap /sidang-tunda meski isinya kini tunda DAN putus. Alamat itu sudah tertanam pada layar antrian dan pada tautan yang mungkin sudah dibuka orang; menggantinya demi kerapian nama menukar satu ketidaknyamanan dengan tautan yang mati.",
      "Cetak birunya dibaca langsung dari /var/www/html/antrian/php/_fungsi.php dan menu.sidang.php di server - termasuk urutan langkah, nilai tetap sumber hukum, dan angka kehadiran pihak. Yang ditiru alurnya; tampilannya sengaja tidak.",
      "Berkas sidang-tunda.tsx dan sidang-putus.tsx dihapus, digantikan hasil-sidang.tsx. Penjaga yang dahulu menunjuk keduanya kini menunjuk berkas baru itu, dan tuntutan tentang akun SIPP dibalik dengan sengaja - bukan dilonggarkan.",
    ],
    knownLimitations: [
      "Jalur HAKIM - menulis amar dan pertimbangan hukum lengkap - masih ada di server dan tetap berfungsi, tetapi belum punya layarnya sendiri di portal. Yang ada sekarang hanya jalur panitera sidang.",
      "Jarak dua pekan adalah kebiasaan satker, bukan aturan. Ia usulan yang selalu dapat diganti, dan hari liburnya memang diperiksa - tetapi hari sidang majelisnya hanya diperingatkan, tidak ditolak.",
      "Putusan yang sudah tercatat tidak dapat disunting dari layar ini. SIPP sendiri menghapus lalu menyisipkan ulang ketika putusannya disunting - 8.220 baris DELETE pada basis data ini - dan meniru penyuntingan adalah pekerjaan yang berbeda dari mencatat putusan baru.",
    ],
  },
  {
    version: "2.22.0",
    title: "ALETA Judicia v2.22.0 - Tanda Tangan yang Bertuan, Majelis yang Berakun, dan Peta Perkara",
    date: "2026-09-18",
    status: "Terpasang",
    summary:
      "Lima pekerjaan. Tanda tangan kini dapat ditambahkan sendiri dan ditautkan ke akun portal; " +
      "susunan majelis pada SK dapat diikat ke akun - hanya di dalam majelis, tidak satu per satu; " +
      "tab Berkas dan Perkara di ekstensi tidak lagi memajang keadaan sebelum ALETA menulis; identitas " +
      "para pihak muncul ringkas pada Status Perkara; dan layar baru Peta Perkara menjawab dari mana " +
      "perkara datang beserta faktor perceraiannya.",
    added: [
      "TOMBOL TAMBAH TANDA TANGAN. Sampai 2.21.0 gambar hanya dapat masuk lewat skrip pengimpor yang membaca berkas .doc satuan kerja di server - pejabat yang tanda tangannya tidak ada di dokumen itu tidak punya jalan sama sekali. Yang diunggah TETAP menunggu pengesahan orang kedua, dan jenis gambarnya dibaca dari bitanya sendiri: berkas bernama .png yang isinya bukan PNG akan gagal digambar pada penetapan, dan gagalnya baru terlihat di kertas.",
      "TANDA TANGAN TERTAUT KE AKUN PORTAL beserta peran, jabatan, dan peran tambahannya - pada gambar baru maupun yang sudah ada. Ketiganya DISALIN saat penautan, bukan dibaca ulang kelak: yang harus terbaca pada penetapan lama adalah jabatan orang itu ketika ia menandatangani, bukan jabatannya hari ini.",
      "SUSUNAN MAJELIS PADA SK DAPAT DIIKAT KE AKUN PORTAL - hakim maupun panitera sidang, dalam satu daftar. Hanya dapat ditautkan di dalam majelis, dan itu dijamin bukan oleh larangan di layar melainkan oleh tidak adanya tempat menyimpannya: satu kolom pada baris majelis, satu-satunya alamat yang menerimanya adalah alamat simpan majelis, dan menghapus majelisnya menghapus tautannya.",
      "LAYAR PETA PERKARA: sebaran perkara dari provinsi sampai desa yang dapat ditelusuri turun, faktor perceraian dari akta cerai, dan siapa yang mengajukan - laki-laki atau perempuan. Perceraian digabung satu halaman dengan cerai gugat bertanda merah dan cerai talak biru; jenis perkara lain punya halamannya masing-masing.",
      "IDENTITAS PARA PIHAK pada Status Perkara - ringkas, terciut sebagai bawaan, dengan nomor telepon yang tetap samar. Nama pihak adalah data pribadi dan layar ini dibuka di meja yang kerap terlihat orang lain, jadi yang membukanya melakukannya dengan sengaja.",
    ],
    changed: [
      "Peta perkara dihitung dengan SATU kueri, bukan tiga. Ketiganya dahulu menyusun ulang tabel turunan yang sama persis - dan itu saja 2,4 detik tiap kali. Terukur: kecamatan 9,6 menjadi 4,8 detik untuk seluruh basis data, dan 0,5 detik untuk rentang setahun.",
      "Kode wilayah BPS diterjemahkan menjadi nama tempat. Kolom kecamatan pada SIPP berisi \"72.10.01\", bukan \"Sigi Biromaru\" - sebaran yang dibangun langsung darinya akan menuliskan kodenya sebagai nama tempat.",
      "Dua era pengisian data disatukan: 11.213 baris berkode angka dan 583 baris bertulis nama (\"Kab. Sigi\"). Dibiarkan apa adanya, Kabupaten Donggala muncul dua kali pada daftar yang sama - 1.047 dari baris berkode dan 122 lagi sebagai \"(kode Kab. Donggala)\".",
    ],
    fixed: [
      "TAB BERKAS DAN PERKARA TIDAK LAGI BERSELISIH. Keduanya memang membaca satu simpanan yang sama, dan simpanan itu dibatalkan hanya ketika pengambilannya GAGAL - tidak ketika penetapan atau Data Umum BERHASIL ditulis, padahal justru saat itulah ia menjadi salah. Menu yang sudah terbuka kini ikut digambar ulang; membuang simpanan saja hanya menolong menu yang belum dibuka.",
    ],
    security: [
      "Daftar pengguna untuk penautan dikirim oleh rute tanda tangan dan rute SK majelis sendiri, bukan dengan menyuruh layar memanggil manajemen pengguna: kewenangannya berbeda, dan pemilih yang kosong akan terbaca sebagai \"tidak ada pegawai\" alih-alih \"Anda tidak berhak melihatnya\". Yang dikirim seperlunya saja - nama, peran, jabatan - tanpa surel, NIP, atau nomor WhatsApp.",
      "Alamat unggah tanda tangan diberi batas badan tersendiri 12 MB. Batas umum 1 MB akan menolak gambar 8 MB dengan kalimat yang tidak menyebut gambar mana pun dan tidak menyebut batasnya.",
    ],
    operationalNotes: [
      "Migrasi 0045 - satu kolom akun_id pada aleta_sipp_hari_sidang, berbawaan kosong. Ekstensi 1.157.1 - reload di chrome://extensions.",
      "Kolom tautan pada tabel tanda tangan ditambahkan lewat ALTER, bukan hanya pada CREATE TABLE: di peladen tabelnya sudah berisi lima puluh gambar, dan CREATE TABLE IF NOT EXISTS tidak menyentuh tabel yang sudah ada.",
      "TIDAK ADA PETA GEOGRAFIS, dan itu keputusan yang diukur. Koordinat kode_pos tertukar kolomnya - longitude memuat lintang - dan sesudah ditukar pun tiap kabupaten hanya punya SATU titik yang sebagian menunjuk pulau lain: Morowali Utara jatuh di Papua, Banggai di Laut Sawu, Marawola di Sigi mendarat dekat Manado. Donggala sendiri benar, dan justru itu yang membuatnya berbahaya - petanya tampak masuk akal bagi yang melihat Donggala lalu diam-diam salah untuk kabupaten lain.",
      "Alamat pihak hanya tercatat pada 30% perkara yang diputus sepanjang riwayat - pada perceraian 43%. Angka itu ditampilkan DI ATAS sebarannya, bukan di catatan kaki. Tahun-tahun terakhir jauh lebih lengkap: 2026 mencapai 100%.",
    ],
    knownLimitations: [
      "Peta perkara belum menggambar batas wilayah. Kalau kelak satker punya berkas batas yang benar, peta geografisnya dapat ditambahkan di atas data yang sama - yang tidak boleh adalah menggambarnya dari koordinat kode_pos.",
      "Tanda tangan yang ditautkan ke akun tidak otomatis ikut berubah ketika jabatan orangnya berganti. Itu disengaja, tetapi berarti tautan lama harus disunting sendiri bila yang diinginkan jabatan terkininya.",
      "Faktor perceraian hanya ada pada perkara yang sudah berakta cerai. Perkara yang diputus tetapi aktanya belum terbit tidak muncul pada sebaran faktor - dan jumlahnya karena itu lebih kecil daripada jumlah putusan perceraian.",
    ],
  },
  {
    version: "2.21.0",
    title: "ALETA Judicia v2.21.0 - Beban yang Diukur, dan Hasil Sidang yang Ditulis Sendiri",
    date: "2026-09-18",
    status: "Terpasang",
    summary:
      "Dua pekerjaan besar. Pertama, penilaian beban kinerja konseptor putusan - dihitung dari berat " +
      "perkaranya, bukan dari jumlahnya, dan tiap komponennya diukur di data satker sebelum boleh masuk " +
      "rumus. Kedua, panitera sidang kini dapat menuliskan hasil sidang - penundaan maupun putusan akhir - " +
      "langsung ke SIPP dari kotak nomor perkara pada Antrian Sidang.",
    added: [
      "Beban kinerja konseptor: tiap putusan diberi bobot dari verstek atau contradictoir, status putusannya, rekonvensi, putusan sela, jumlah saksi, jumlah pihak, jumlah sidang, panjang naskah pertimbangan, mediasi, dan ragam perkaranya. Dapat dipilih per minggu, bulan, triwulan, semester, tahun, seluruhnya, atau rentang tanggal sendiri.",
      "Tiga sumbu, bukan satu angka: beban yang dipikul, kelengkapan berkas, dan bagian perkara yang lebih berat daripada median satker. Satu angka menyembunyikan pertukarannya.",
      "Beban per BULAN AKTIF di samping totalnya. Terukur: satu konseptor 702 skor atas 7,6 bulan dan yang lain 354 atas 4,0 bulan - 92,5 lawan 87,7 per bulan. Nyaris sama beratnya, sementara totalnya berselisih dua kali lipat.",
      "Usul bobot yang DITURUNKAN dari riwayat satker sendiri, dengan jumlah sidang dan panjang naskah sebagai berat teramati. Ditampilkan berdampingan dengan bobot yang berlaku, tidak pernah menggantikannya.",
      "Panitera sidang menuliskan penundaan sidang ke SIPP beserta audit trail-nya, lalu menandai antrian sidangnya selesai. Pintunya kotak nomor perkara pada Jadwal Perkara yang Bersidang.",
      "Panitera sidang menuliskan putusan akhir dan pertimbangan hukumnya ke SIPP - dua baris pada detik yang sama, sebagaimana SIPP sendiri menuliskannya.",
      "Delapan bentuk grafik statistik menggantikan tiga, tanpa satu pun pustaka grafik ditambahkan.",
    ],
    changed: [
      "Penilaian lanjutan status perkara 71% lebih cepat: 31 analisis dari 139.958 menjadi 40.998 milidetik, dan analisis pihak dari 59.844 menjadi 1.511. Gerbang menyerah pada 8 detik, jadi enam puluh detik tidak terbaca sebagai lambat melainkan sebagai TIDAK BERHASIL.",
      "Rekonvensi dibaca dari naskah pertimbangannya, bukan hanya dari tabelnya. Tabel mencatat 10 perkara, naskah berkepala Dalam Rekonvensi atau Dalam Konvensi mencatat 22, gabungannya 31 - tabelnya sendirian melewatkan dua pertiga.",
      "Palet grafik kategori diganti: yang lama gagal pengukuran chroma (#0f766e terbaca abu-abu) dan DIPUTAR, sehingga kategori ketujuh berwarna sama dengan yang pertama. Palet baru delapan slot, diperiksa pada tema terang dan gelap; yang melewati delapan dilipat menjadi Lainnya dengan jumlahnya disebut.",
    ],
    fixed: [
      "Layar beban konseptor membaca ok langsung dari bungkus jawaban portal - selalu bernilai benar, sehingga cabang gagalnya tidak akan pernah menyala meski server sudah menyiapkan alasannya.",
      "Rencana penundaan menampilkan Tue Mar 09 2027 00:00:00 GMT+0800 pada layar berbahasa Indonesia: kolom DATE dipulangkan penggerak MySQL sebagai obyek Date.",
      "Rentang bulan aktif tiap konseptor terbaca NOL untuk semua orang - sebab yang sama, dan tanpa satu pun error berbunyi.",
    ],
    security: [
      "Menulis ke SIPP KERING sebagai bawaan pada ketiga lapis - gerbang, rute portal, dan layar. Tombol tulis terkunci sampai rencananya dibaca, dan akun SIPP yang namanya tercatat di audit trail disebut pemanggil: ALETA tidak pernah menulis atas nama dirinya sendiri.",
      "Percobaan yang DITOLAK ikut tercatat di jejak ALETA. Di sys_audittrail percobaan yang gagal tidak meninggalkan jejak sama sekali - padahal justru itu yang dicari ketika petugas bertanya kenapa penundaannya tidak jadi.",
      "Bentuk tulisan putusan diukur dari sesi memutus sungguhan: judul auditnya berbeda dari seluruh modul SIPP lain, dan kolom diinput_tanggal modul putusan berjam dua belas - 5,0% barisnya berjam di atas 13, sementara perkara_penetapan 42,0%.",
    ],
    operationalNotes: [
      "Tidak ada migrasi basis data. Versi ekstensi tidak berubah - tetap 1.157.0.",
      "Ketepatan minutasi TIDAK dinilai: tanggal_minutasi sama dengan tanggal_putusan pada 683 dari 683 putusan. Jeda nol di sana bukan minutasi seketika, melainkan kolom yang terisi sendiri.",
      "Eksepsi belum dapat dinilai: tidak ada tabelnya, dan kepala Dalam Eksepsi nol dari 2.228 naskah pertimbangan. Majelis di satker ini menulis kepala eksepsi dengan kalimat lain, dan kalimat itu belum diketahui.",
      "Kuasa hukum tetap berbobot tetapi padam sendiri: pihak_pengacara hanya menyentuh 4 dari 9.993 perkara. Ia akan menyala sendiri begitu satker mulai mengisinya, tanpa kode disentuh lagi.",
      "Ketepatan waktu sengaja tidak dibuat: rata daftar sampai putus 37 hari, dan hanya 1 dari 683 melewati 150 hari. Komponen yang hampir selalu bernilai sama tidak membedakan siapa pun.",
      "Banding dan kasasi ditampilkan sebagai keterangan, tidak pernah masuk skor - putusan yang dibanding bukan putusan yang salah.",
      "Layar Beban Kinerja Konseptor hanya terbuka untuk super-admin, ketua, wakil ketua, panitera, dan sekretaris: ia menyebut nama orang beserta peringkatnya.",
    ],
    knownLimitations: [
      "Bobot bawaan adalah karangan yang masuk akal, bukan kebenaran. Komponen panjang naskah menyumbang sekitar 40-45% skor pada perkara Dikabulkan rata-rata - konseptor yang menulis panjang menang atas yang menulis padat, dan panjang bukan mutu. Inilah bobot yang paling perlu disesuaikan satker.",
      "Pada rentang yang panjang perbandingannya tidak adil: 52 dari 76 konseptor pada seluruh basis data tidak punya satu pun naskah pertimbangan tersimpan, sebab kolomnya baru dipakai belakangan. Layarnya menyebut ini, tetapi angkanya tetap timpang.",
      "Nama yang tertulis beberapa cara di SIPP terhitung sebagai orang yang berbeda dan TIDAK digabungkan otomatis - 21 nama semacam itu pada seluruh basis data. Penggabungan nama adalah tebakan, dan tebakan pada layar yang menilai orang berakhir sebagai tuduhan.",
      "Rentang seluruh basis data 7,9 detik pada mesin yang tidak dibebani. Batas waktunya dinaikkan ke enam puluh detik untuk panggilan ini, tetapi rentang selebar itu memang berat bagi MySQL satker.",
    ],
  },
  {
    version: "2.20.4",
    title: "ALETA Judicia v2.20.4 - Nama Berkas yang Menyebut Perkaranya, dan Lencana yang Terbuka Seketika",
    date: "2026-09-17",
    status: "Terpasang",
    summary:
      "Dua keluhan petugas yang keduanya terukur: berkas unduhan ABT bernama bawaan peramban alih-alih " +
      "menyebut perkaranya, dan panel yang diciutkan menjadi lencana tertahan hampir setengah detik ketika " +
      "dibentangkan kembali.",
    added: [],
    changed: [
      "Nama berkas unduhan menjadi nomor perkara - jenis perkara - status putusan, pada kedua jalur unduhan: yang diterbitkan panel ALETA sendiri dan yang diterbitkan ABT lalu dinamai pekerja latar. Dua jalur dengan dua bentuk nama membuat satu perkara punya dua pola di folder yang sama.",
      "Jenis perkara dan status putusan ditumpangkan pada permintaan usulan yang memang sudah berjalan di halaman satu perkara, bukan pada permintaan baru - panel ABT punya anggaran waktu yang ketat, dan satu perjalanan tambahan tiap membuka halaman adalah harga yang tidak perlu dibayar untuk sekadar menamai berkas.",
      "Daftar panjang pada panel - kartu blangko ABT dan butir papan massal - hanya ditata sejauh yang terlihat, sisanya menunggu sampai tergulir.",
    ],
    fixed: [
      "Nama berkas memuat potongan kepala halaman blangko di tempat jenis perkara. Itu bukan jenis perkara, berubah bunyinya tiap halaman, dan hilang sama sekali ketika kepala halamannya tidak terbaca - dan ketika hilang, yang tersisa nama bawaan peramban seperti download (9).rtf.",
      "Papan massal sudah menerima jenis perkara bersama daftar sidang tetapi membuangnya; halaman satu perkara tidak punya sumbernya sama sekali.",
      "Berkas anonimisasi bernama persis sama dengan putusannya sehingga yang kedua menimpa yang pertama. Kini ia berpenanda anonim di ujungnya; putusan utamanya tidak.",
      "Membentangkan panel dari lencana menata ulang SELURUH isinya sekaligus. Diukur atas replika panel, 25 putaran tiap ukuran, tiap putaran dipaksa menghitung tata letak: 200 simpul 7,90 menjadi 1,20 milidetik; 800 simpul 34,10 menjadi 4,80; 2.000 simpul 87,60 menjadi 15,10; 5.000 simpul 265,90 menjadi 35,90 - dan yang terburuk 565,80 menjadi 82,70.",
    ],
    security: [
      "Unduhan tetap dijawab SEKETIKA. Jawaban yang menyusul pernah dicoba pada 2.19.7 dan hasilnya Insecure download blocked di peramban petugas - unduhan yang tertahan menghentikan pekerjaan, sedangkan berkas bernama download hanya merepotkan.",
      "Aturan tata letak hanya dikenakan pada DAFTAR yang panjang, bukan seluruh panel: elemen yang belum ditata tidak dapat diukur, dan sebagian panel memang mengukur dirinya sendiri.",
    ],
    operationalNotes: [
      "Tidak ada migrasi. Ekstensi 1.157.0 - reload di chrome://extensions. Nomor 1.156.0 tidak pernah ada: ia sempat ditanam lalu dikoreksi sebelum sempat dirilis.",
      "Nama berkas hanya selengkap yang diketahui SIPP. Perkara yang belum putus tidak punya status putusan, dan namanya berhenti pada jenis perkara - itu disengaja; nama yang mengarang status lebih berbahaya daripada nama yang pendek.",
    ],
    knownLimitations: [
      "Cetak relaas panggilan/pemberitahuan dan berita acara sidang - per perkara maupun massal - BELUM dikerjakan. Blangkonya sudah ditemukan di ABT (enam berkas relaas dan empat folder BAS, seluruhnya RTF), tetapi korpusnya belum dipelajari di server.",
      "Cap waktu baris audit yang ditulis ALETA masih dapat lebih awal daripada baris bernomor id di dekatnya. Keputusannya belum diambil.",
    ],
  },
  {
    version: "2.20.3",
    title: "ALETA Judicia v2.20.3 - Penetapan yang Tidak Lagi Mendahului Pendaftaran Perkaranya",
    date: "2026-09-17",
    status: "Terpasang",
    summary:
      "Jam yang dicatat ALETA pada keempat penetapan tidak lagi dapat jatuh sebelum kasir menyelesaikan " +
      "Pendaftaran Perkara. Titik mulainya kini mengikuti jam pendaftaran perkara itu sendiri, bukan jam " +
      "kerja yang dipatok 08.00.",
    added: [],
    changed: [
      "Titik mulai rangkaian jam penetapan menjadi LANTAI: yang lebih akhir di antara pukul 08.00 dan sepuluh menit sesudah kasir menyelesaikan Pendaftaran Perkara. Jam pendaftarannya dibaca dari perkara_proses tahapan 10 - satker ini hanya memuat satu proses di situ, diperiksa atas 10.146 baris.",
      "Perkara yang didaftarkan sesudah pukul 14.00 memakai jendela selebar sekurangnya 30 menit yang dibuka dari lantai barunya. Jendela yang menyempit menjadi nol membuat seluruh perkara sore itu jatuh pada menit yang sama - pola mesin yang justru dihindari sejak awal.",
      "Perkara yang baru saja didaftarkan: keempat langkahnya dirapatkan merata ke sela yang benar-benar ada, bukan dimundurkan. Memundurkan berarti mendahului pendaftaran, memaksakan lebarnya berarti mencatat jam yang belum terjadi. Yang rapat pun wajar - diperiksa pada perkara 600, petugas menyelesaikan keempat langkahnya dalam 1 menit 43 detik.",
    ],
    fixed: [
      "Penetapan dapat tercatat SEBELUM perkaranya didaftarkan. Diukur pada sepuluh perkara uji: satu melanggar - perkara 571 didaftarkan pukul 09.34 dan penetapannya tercatat pukul 08.27.40, satu jam enam menit sebelum perkaranya ada. Sesudah perbaikan, PMH perkara itu jatuh pukul 10.11.30 dan nol dari sepuluh yang melanggar.",
      "Cacat itu tidak tersembunyi di dalam basis data: tab Riwayat Perkara SIPP mengurut menurut tanggal, sehingga baris Penetapan duduk DI ATAS baris Pendaftaran Perkara dan terbaca siapa pun yang membuka perkaranya. Risikonya tidak kecil - 350 dari 799 perkara 2026 didaftarkan pukul 10.00 ke atas.",
      "Batas bawah geseran rangkaian kini lantainya, bukan tengah malam. Batas lama itulah yang membiarkan rangkaian yang digeser mendarat sebelum pendaftarannya.",
    ],
    security: [
      "Tidak ada perubahan pada APA yang ditulis ke SIPP - hanya JAM yang dicatat. Aturannya diambil dari pekerjaan pegawai sendiri: diukur pada 825 perkara 2026 di server, PMH selalu sesudah kasir, nol yang mendahului.",
    ],
    operationalNotes: [
      "Tidak ada migrasi. Ekstensi tetap 1.155.0.",
      "Penetapan yang sudah terlanjur tertulis dengan jam yang keliru tidak diperbaiki surut; yang tercatat di server hanya satu perkara dan jamnya masih sesudah pendaftarannya.",
      "Bukti luring verify-waktu-penetapan.js naik dari 25 ke 37 pemeriksaan - jalankan dengan docker exec aleta-bot node scripts/verify-waktu-penetapan.js.",
    ],
    knownLimitations: [
      "Nama berkas unduhan ABT dan lambatnya panel yang dibentangkan kembali dari lencana BELUM dikerjakan - keduanya menunggu reproduksi di peramban, bukan tebakan atas kode.",
      "Cap waktu baris audit yang ditulis ALETA masih dapat lebih awal daripada baris bernomor id di dekatnya, walau lantai baru ini mempersempitnya. Keputusannya belum diambil.",
    ],
  },
  {
    version: "2.20.2",
    title:
      "ALETA Judicia v2.20.2 - Jejak yang Menyebut Nomor Perkaranya, dan Pihak yang Tidak Lagi Ditunggu",
    date: "2026-09-17",
    status: "Terpasang",
    summary:
      "Tiga perbaikan yang ditemukan dari membaca data server kantor, bukan dari membaca kode: riwayat " +
      "perbuatan ALETA kembali menyebut nomor perkaranya, keterangan bongkar kembali berbahasa Indonesia, " +
      "dan daftar pihak perkara dibaca dari tabelnya langsung sehingga panel ekstensi tidak lagi kehabisan " +
      "waktu sebelum sempat digambar.",
    added: [],
    changed: [
      "Daftar pihak perkara dibaca dari perkara_pihak1..5 langsung, bukan lewat tampilan v_pihak_perkara. Terukur di basis data server atas satu perkara: 828 milidetik menjadi 5 milidetik, dengan hasil yang sama persis. Di salinan setempat yang lebih berat angkanya 7,48 detik menjadi 0,12 detik, dan konteks perkara seluruhnya 10,08 detik menjadi 0,88 detik.",
    ],
    fixed: [
      "Riwayat perbuatan ALETA menyimpan nomor perkara sebagai [object Object] - keenam puluh empat barisnya, sejak tabel itu dipakai. Pemanggilnya meneruskan bungkus rencana yang berisi perkaraId dan nomorPerkara, dan String() atas obyek tidak pernah melempar error, sehingga cacatnya diam: kolom perkara_id benar, nomornya hilang. Tabel yang justru dibuat supaya perbuatan ALETA dapat ditelusuri per perkara karena itu tidak dapat ditelusuri per perkara.",
      "Keterangan bongkar penetapan memuat tanggal berbahasa Inggris - membongkar juru sita tanggal Tue Sep 15 2026 00:00:00 GMT+0000 - sebab kolom DATE ditempel apa adanya ke dalam kalimat. Hanya catatan ALETA sendiri; tidak satu pun baris SIPP terpengaruh.",
      "Panel ekstensi jatuh ke keterangan simpanan dan bagian penetapannya tidak pernah digambar, karena satu kueri pihak memakan lebih lama daripada batas 8 detik gerbang portal dan 9 detik ekstensi. Gejalanya terbaca sebagai ekstensi tidak jalan; sebabnya satu kueri.",
    ],
    security: [
      "Tidak ada perubahan pada apa yang ditulis ALETA ke SIPP. Kedua perbaikan pertama menyentuh catatan milik ALETA sendiri, yang ketiga hanya MEMBACA.",
      "Penjagaan nomor perkara diletakkan di layanan jejaknya juga, bukan hanya di pemanggilnya - riwayat tidak boleh kehilangan nomor perkara karena satu pemanggil baru lupa membongkar bungkusnya.",
    ],
    operationalNotes: [
      "Tidak ada migrasi. Ekstensi tetap 1.155.0 - tidak perlu reload bila 2.20.1 sudah dipasang.",
      "Enam puluh empat baris riwayat yang terlanjur tersimpan tanpa nomor perkara tidak diperbaiki surut; kolom perkara_id-nya benar, jadi penelusurannya tetap dapat dikerjakan lewat kolom itu.",
    ],
    knownLimitations: [
      "Cap waktu baris audit yang ditulis ALETA masih disebar ke jam pagi, sehingga jamnya dapat lebih awal daripada baris bernomor id di dekatnya. Diukur atas 20.000 id audit terakhir di server: hanya tiga kali jam mundur, dua di antaranya milik ALETA. Hanya terlihat oleh yang membandingkan nomor baris dengan jam langsung di basis data; layar Audit Trail SIPP mengurut menurut jam. Menukarnya dengan jam sekarang menghilangkan selisih ini tetapi menimbulkan selisih lain, sebab pada pekerjaan pegawai jam perkara_proses dan jam audit selalu sama - keputusannya belum diambil.",
      "Keterangan Smart Majelis yang ditulis ALETA berupa satu kalimat tetap, sedangkan petugas memakai frasa pendek yang berbeda-beda. Bila ALETA dipakai rutin, kalimat tetap itu akan menumpuk.",
    ],
  },
  {
    version: "2.20.1",
    title: "ALETA Judicia v2.20.1 - Satu Tema, dan Jalan Pulang untuk Panel yang Disingkirkan",
    date: "2026-09-16",
    status: "Terpasang",
    summary:
      "Lima perbaikan pada panel ekstensi: tingkap sembul SIPP ikut gelap, Escape dan klik ganda kembali " +
      "menciutkan panel di SIPP dan ABT, panel yang ditutup atau terciut dapat dibuka lagi tanpa memuat ulang, " +
      "tema popup dan tema panel menjadi satu di ketiga halaman, dan tanggal yang dipilih dari kalender tampak " +
      "di daftar hari sidang.",
    added: [
      "Tema ALETA menjadi satu untuk jendela popup ekstensi, panel SIPP, panel ABT, dan panel di portal ALETA. Menekan tombol tema di mana pun menggerakkan keempatnya - termasuk tema portal itu sendiri, yang diminta berganti lewat satu peristiwa DOM dan bukan lewat localStorage yang baru terbaca pada pemuatan berikutnya.",
      "Tombol tema panel di halaman portal ALETA kembali. Dahulu ia dibuang supaya tidak ada dua saklar yang berselisih; sejak keduanya menjadi satu saklar, ia justru saklar kedua di ujung lorong yang sama.",
      "Tombol Kembalikan posisi panel di popup menjangkau keempat panel - SIPP, ABT, putusan massal ABT, dan portal - dan membentangkan yang terciut, bukan hanya memindahkannya.",
    ],
    changed: [
      "Tema jendela popup: pilihan ikut sistem menjadi ikut ALETA. Panel bawaannya gelap sementara Windows di meja petugas hampir selalu terang, sehingga jendela itu lahir putih menyilaukan di atas SIPP yang gelap.",
      "Tombol × di panel ABT dan panel portal kini mematikan saklar induk ALETA, sama seperti di SIPP - sehingga kotak centang di popup ekstensi menjadi jalan pulangnya, dan judul tombolnya menyebutkan itu.",
      "Daftar Hari sidang pada papan penetapan menampilkan tanggal yang dipilih dari kalender sebagai baris tambahan paling atas, bertanda asalnya.",
    ],
    fixed: [
      "Daftar pilihan select2 di dalam tingkap sembul SIPP - blangko Data Umum di antaranya - tampil putih menyilaukan pada tema gelap, dengan kotak carinya putih di atas putih. Diukur pada replika markup SIPP: badan tingkapnya sudah gelap sejak dulu, tetapi kotak dan daftar select2 terukur rgb(255,255,255) sebab select2 menyatakan putihnya lewat nama kelas, bukan lewat gaya sebaris yang selama ini diburu.",
      "Jendela popup ekstensi tampil putih di atas panel yang gelap, sebab bawaannya mengikuti setelan Windows sementara panel bawaannya gelap. Lihat perubahan tema di atas.",
      "Escape dan klik ganda di luar panel tidak menciutkan panel di SIPP maupun ABT. Di SIPP keduanya memang tidak pernah terpasang - panel itu menyusun kepalanya sendiri dan tidak melewati pintu yang memasangnya. Di kedua halaman, syarat lama juga hampir selalu menahan Escape: satu klik pada kolom blangko mana pun membuat fokus tinggal di isian halaman.",
      "Panel yang ditutup di ABT dan di portal ALETA tidak dapat dipanggil kembali tanpa memuat ulang halaman - dan memuat ulang halaman ABT membuang isian blangko yang belum tersimpan.",
      "Tombol segarkan di kaki panel ABT menghapus panelnya untuk selamanya: ia membuang panel lalu memanggil pemasangnya, yang keluar pada baris pertama karena penanda terpasang masih menyala.",
      "Alt+A di halaman ABT menyimpan keadaan lencananya ke kunci yang tidak pernah dibaca siapa pun, sehingga panel yang diciutkan dengan pintasan itu tidak pernah pulih dan tidak terjangkau tombol Kembalikan posisi panel.",
    ],
    security: [
      "Peristiwa tema dari ekstensi hanya membawa satu kata, gelap atau terang. Portal mengabaikan yang lain, dan tidak mengerjakan apa pun atas suruhan siapa pun selain mengganti warna.",
      "Peta select2 mengecualikan halaman ABT dengan tegas - SIPP dan ABT berbagi satu penanda tema, dan ABT memakai select2 miliknya sendiri dengan warna halamannya sendiri.",
      "Escape tidak direbut dari tingkap halaman yang sedang terbuka: menutup tingkap itu tetap milik halamannya.",
    ],
    operationalNotes: [
      "Tidak ada migrasi. Ekstensi 1.155.0 - reload di chrome://extensions.",
      "Pengisian otomatis Data Umum (butir 1 dari permintaan) BELUM dikerjakan: blangkonya baru ada di dokumen sesudah tombol Data Umum ditekan, dan itu pekerjaan tersendiri.",
    ],
    knownLimitations: [
      "Tema portal hanya ikut berganti pada portal 2.20.1 ke atas. Ekstensi yang menghadap portal lama tidak rusak - permintaannya sekadar tidak ditangkap siapa pun, dan panel tetap mengikuti tema portal seperti sebelumnya.",
      "Peta gelap select2 disusun dari blangko Data Umum. Pustaka pihak ketiga lain yang menyatakan putihnya lewat nama kelas - dan bukan lewat gaya sebaris - masih akan tampil terang sampai namanya disebut juga.",
    ],
  },
  {
    version: "2.20.0",
    title: "ALETA Judicia v2.20.0 - Keterangan Saksi yang Terisi dan Dapat Dipindahkan",
    date: "2026-09-16",
    status: "Terpasang",
    summary:
      "Lima perbaikan pada panel keterangan saksi dan alasan perceraian di ABT: titik-titik templat kini diisi dari " +
      "gugatan, ada modus saksi yang hanya mengetahui pisahnya, dan tiap baris keterangan dapat digeser, disalin, " +
      "ditambah, atau dihapus - termasuk dipindahkan ke saksi seberang.",
    added: [
      "Titik-titik dan garis bawah pada jawaban templat ABT diisi dari gugatan: kapan perselisihan mulai, sejak kapan dan berapa lama berpisah, siapa yang meninggalkan kediaman bersama. Yang tidak terbaca dari gugatan dibiarkan bertitik-titik dan tetap dilaporkan.",
      "Modus saksi baru: tidak mengetahui pertengkarannya, hanya mengetahui keduanya sudah pisah. Bedanya dengan modus tidak tahu sebabnya halus tetapi menentukan di persidangan - saksi yang kedua ini tidak pernah tahu ada pertengkaran sama sekali.",
      "Tiap baris keterangan dapat diseret ke atas, ke bawah, atau ke kolom saksi seberang; disalin ke saksi seberang; ditambah; dan dihapus. Pertanyaannya sendiri dapat disunting.",
    ],
    changed: [
      "Tombol Susun posita dari keterangan saksi menjadi Input ke ABT.",
      "Kartu alasan perceraian disusun sebagai empat blok berkepala nama dan jumlah, butirnya berjajar sebagai lencana - bukan satu tumpukan baris yang sama beratnya.",
      "Tombol Tuliskan huruf alasan berdiri pada baris tindakan bersama Terapkan yang dicentang. Keduanya berarti tuliskan ke ABT, dan sebelumnya terpisah oleh seluruh daftar usulan.",
    ],
    fixed: [],
    security: [
      "Angka yang tidak ada di gugatan tidak pernah dikarang: berapa kali saksi menyaksikan pertengkaran diisi beberapa kali, bukan bilangan. Angka karangan pada berita acara sidang adalah keterangan palsu.",
      "Jawaban yang diisi ALETA dari gugatan ditandai tersendiri, berbeda dari yang masih kosong - supaya dibaca dahulu sebelum disimpan.",
      "Yang dipindahkan ke saksi seberang DISISIPKAN sebagai baris tambahan, tidak pernah menimpa keterangan yang sudah ada di sana.",
    ],
    operationalNotes: [
      "Tidak ada migrasi. Ekstensi 1.154.0 - reload di chrome://extensions.",
      "Nomor tanya-jawab dihitung ulang menurut posisinya saat disimpan ke ABT, jadi memindahkan dan menghapus baris tidak meninggalkan nomor yang bolong.",
    ],
    knownLimitations: [
      "Pengisian dari gugatan hanya sejauh gugatannya menyebutkan: bulan perselisihan, bulan dan lama pisah, serta siapa yang pergi. Selebihnya tetap menunggu keterangan saksi yang sesungguhnya.",
    ],
  },
  {
    version: "2.19.8",
    title: "ALETA Judicia v2.19.8 - Unduhan yang Tertahan, dan Status Putusan pada Namanya",
    date: "2026-09-16",
    status: "Terpasang",
    summary:
      "Perbaikan 2.19.7 menimbulkan cacat yang lebih berat daripada yang diperbaikinya: unduhan ABT ditahan Chrome " +
      "dengan pesan Insecure download blocked. Sebabnya pendengar nama berkas menjawab menyusul. Jawabannya kembali " +
      "seketika. Sekalian dipenuhi permintaan yang tertinggal sejak 15 September: status putusan dan verstek ikut " +
      "tertulis pada nama berkas.",
    added: [
      "Status putusan dan penanda verstek ikut pada nama berkas yang diunduh dari panel: nomor perkara, keterangan blangko, status putusan, lalu jenis berkasnya. Dibaca dari SIPP lewat jadwal sidang yang memang sudah dimuat panel - tanpa permintaan tambahan.",
    ],
    changed: [
      "Pendengar nama unduhan menjawab seketika dari salinan di ingatan. Penyimpanan sesi tetap dipakai, tetapi hanya untuk MEMULIHKAN ingatan itu saat pekerja latar bangun - tidak lagi dibaca pada saat unduhannya datang.",
    ],
    fixed: [
      "Unduhan dari ABT ditahan Chrome sejak 2.19.7 dengan pesan Insecure download blocked. Chrome memang menahan unduhan yang berasal dari halaman http, dan itulah sebabnya unduhan panel diterbitkan lewat ekstensi sejak semula; pendengar yang menjawab menyusul membuat unduhan ABT ikut jatuh ke penahanan itu.",
      "Status putusan tidak pernah tertulis pada nama berkas, sehingga dua putusan dari perkara yang sama - satu verstek, satu contradictoir - hanya dapat dibedakan dengan membukanya.",
    ],
    security: [],
    operationalNotes: [
      "Tidak ada migrasi. Ekstensi 1.153.0 - reload di chrome://extensions.",
      "Yang membuat namanya tetap benar adalah penyegaran konteks pada tiap sentuhan halaman ABT (2.19.7): ia terjadi beberapa milidetik sebelum tombol cetak menerbitkan unduhannya.",
    ],
    knownLimitations: [
      "Bila pekerja latar baru saja dibangunkan dan konteksnya belum sempat pulih dari penyimpanan, berkasnya memakai nama bawaan ABT. Itu kekurangan yang terlihat dan dapat diperbaiki orang; unduhan yang tertahan tidak.",
      "Status putusan hanya tertulis bila SIPP sudah mencatatnya - putusan yang baru dibacakan hari itu kerap belum.",
    ],
  },
  {
    version: "2.19.7",
    title: "ALETA Judicia v2.19.7 - Nama Unduhan ABT yang Hilang Bersama Pekerja Latarnya",
    date: "2026-09-16",
    status: "Terpasang",
    summary:
      "Berkas yang diunduh dari tombol cetak milik ABT kembali bernama download.rtf dan download (2).pdf. " +
      "Sebabnya bukan aturan penamaannya - itu benar sejak 2.18.0 - melainkan tempat keterangannya disimpan: " +
      "satu variabel di pekerja latar Manifest V3, yang dimatikan Chrome sesudah kira-kira tiga puluh detik menganggur.",
    added: [],
    changed: [
      "Keterangan perkara untuk penamaan unduhan disimpan di chrome.storage.session, yang hidup di luar pekerja latar dan ikut terhapus ketika peramban ditutup. Peramban yang belum mengenalnya jatuh ke storage.local dengan umur yang sama.",
      "Halaman ABT menyegarkan keterangan itu tiap kali petugas menyentuhnya (paling sering sekali per sepuluh detik) dan tiap kali tabnya dibuka kembali. Umur lima menit kini berarti lima menit sejak terakhir disentuh, bukan sejak halaman dibuka - yang kedua hampir selalu sudah lewat ketika tombol cetak ditekan.",
    ],
    fixed: [
      "Unduhan dari tombol cetak ABT tersimpan dengan nama bawaan (download.rtf, download (2).pdf) tanpa satu pun pesan error. Terlihat pada 16 September 2026: enam berkas bernama download pada hari yang sama ketika unduhan lewat panel ALETA - yang menyebut namanya sendiri kepada peramban - bernama benar.",
    ],
    security: [
      "Unduhan yang jelas bukan berasal dari ABT ditolak seketika, tanpa menunggu pembacaan penyimpanan - menahan jawaban pada tiap unduhan biasa akan menahan seluruh unduhan peramban.",
      "Pada jalur mana pun, termasuk yang gagal membaca, saran nama dipanggil tepat sekali: listener yang menjanjikan nama lalu diam membuat unduhannya menggantung.",
    ],
    operationalNotes: [
      "Tidak ada migrasi. Ekstensi 1.152.0 - reload di chrome://extensions.",
      "Berkas yang sudah terlanjur bernama download tidak berubah namanya sendiri; yang berlaku unduhan berikutnya.",
    ],
    knownLimitations: [
      "Penamaan ini hanya menyentuh berkas yang namanya benar-benar umum (download, download (2), dan seterusnya). Nama lain yang dipilih ABT atau orang tidak pernah ditimpa.",
    ],
  },
  {
    version: "2.19.6",
    title: "ALETA Judicia v2.19.6 - Putusan Massal ABT: Tombol yang Menyebut Langkah Berikutnya, dan Rencana yang Kedaluwarsa",
    date: "2026-09-16",
    status: "Terpasang",
    summary:
      "Dilaporkan dari layar ABT sebagai \"putusan massal tidak bisa dipakai\". Panelnya berjalan; yang membuat berhenti " +
      "adalah kalimat di layar - sesudah Periksa ditekan, tombolnya tetap berbunyi \"belum dijalankan\" dan hasilnya " +
      "\"belum ada yang dikerjakan\", tanpa satu pun kata tentang langkah berikutnya. Sekaligus diperbaiki cacat kedua " +
      "yang menyentuh berkas perkara: rencana yang sudah tergambar tidak pernah kedaluwarsa.",
    added: [],
    changed: [
      "Sesudah diperiksa, tombolnya berbunyi \"Jalankan N perkara sekarang\", tombol pertama menjadi \"Periksa ulang\", dan di bawah daftar rencana tertulis kalimat yang menyebut tombol mana yang harus ditekan beserta jumlahnya.",
      "Perkara yang dilewati karena blangkonya belum dipetakan ikut disebut pada kalimat itu, bukan hanya terlihat dari warna barisnya.",
    ],
    fixed: [
      "Mencentang perkara lain, mengganti blangko satu perkara, atau mematikan pilihan pekerjaan (draf, PDF, anonimisasi, unggah) SESUDAH diperiksa tidak membatalkan rencananya - Jalankan tetap menyala dan perkara yang rencananya tidak pernah diperlihatkan ikut dikerjakan. Kini rencananya kedaluwarsa, tombolnya mati, dan sebabnya dikatakan.",
      "Jalankan menolak berjalan tanpa pemeriksaan yang masih berlaku - penjagaan kedua, sebab jalur ini menulis ke berkas perkara.",
      "Menekan Jalankan dua kali mengulang perkara yang sama dan menimpa draf serta dokumen yang baru saja dibuat. Sesudah antreannya selesai, rencananya habis terpakai.",
    ],
    security: [
      "Pembatalan rencana TIDAK mengosongkan neraca selagi antreannya berjalan - neraca itu satu-satunya keterangan tentang apa yang sudah terjadi pada berkas perkara.",
    ],
    operationalNotes: [
      "Tidak ada migrasi. Ekstensi 1.151.0 - reload di chrome://extensions.",
      "Mencari, menyaring, dan mengurutkan tidak membatalkan pemeriksaan: ketiganya mengubah yang terlihat, bukan yang terpilih.",
    ],
    knownLimitations: [],
  },
  {
    version: "2.19.5",
    title: "ALETA Judicia v2.19.5 - Jam Penetapan Sampai Detik, Smart Majelis di Audit, dan Pratinjau Massal yang Bergilir",
    date: "2026-09-16",
    status: "Terpasang",
    summary:
      "Tiga hal yang diukur atas SIPP satker lalu disamakan: jam tiap langkah penetapan kini dihitung sampai detik " +
      "(selisih nyata 60-659 detik, tidak pernah mendahului jam server, dan penetapan massal pagi hari tidak lagi " +
      "menumpuk pada satu menit); jejak Smart Majelis di Audit Trail ditulis persis seperti tangan petugas; dan pratinjau " +
      "penetapan massal memperlihatkan majelis, panitera, juru sita, dan hari sidang tiap perkara - dihitung berurutan " +
      "sehingga yang tertulis sama dengan yang tertera.",
    added: [
      "Rincian di bawah tiap perkara pada Penetapan massal sesudah Periksa: majelis, panitera pengganti, juru sita, hari sidang, ganjalan (akhir pekan, kurang dari 7 hari, nilai sengketa kosong, pejabat berhalangan), dan andaian bot - rapor yang sama dengan papan satu perkara.",
      "Andaian antrean: usulan perkara ke-n pada pratinjau massal dihitung seolah perkara 1..n-1 sudah tertulis (bobot menurut jenis perkara, sama dengan kueri beban), sehingga giliran majelis, panitera pengganti, dan juru sita pada pratinjau sama dengan penulisannya.",
    ],
    changed: [
      "Jam tiap langkah penetapan dihitung dalam detik: jeda PMH->PPP->PJS->PHS selalu 60-659 detik nyata (sebelumnya hanya angka menitnya yang dijaga; diukur 20-34 detik pada 3 dari 10 perkara), detiknya ikut menaik, dan tidak pernah melampaui jam server sampai ke detiknya (sebelumnya sampai 59 detik di masa depan pada pagi hari).",
      "Rangkaian yang digeser mundur (pagi hari) disebar per perkara di antara 08:00 dan jam server - penetapan massal 25 perkara tidak lagi menaruh seluruh PHS pada menit yang sama.",
      "Audit PMH: ketiga baris perkara_hakim_pn berjudul 'dari halaman Smart Majelis TAMBAH PENETAPAN HAKIM/MAJELIS HAKIM' persis tulisan SIPP saat petugas memakai tombol Smart Majelis (782 dari 1.112 perkara 2026); formname dan dua baris lainnya tidak berubah.",
      "Baris perkara_smartmajelis berstatus 1 (sesuai rekomendasi) dengan majelis_id menurut ref_majelis_tetap dan kompetensi jenis perkaranya bila susunan yang ditetapkan adalah majelis SK; selain itu status 2 beserta sebabnya seperti sebelumnya. Laporan Smart Majelis SIPP tidak lagi menghitung tiap perkara ALETA sebagai penyimpangan.",
    ],
    fixed: [
      "Pratinjau penetapan massal menampilkan majelis yang sama untuk seluruh perkara padahal penulisannya bergilir - kini dihitung dengan andaian berurutan.",
      "Dua bukti luring yang usang: bukti audit menuntut 7 baris (bentuk SIPP 5 sejak 2.19.2) dan bukti PPP mencocokkan kode panitera yang tabrakan (SK menunjuk orang lewat id sejak 2.18.0).",
    ],
    security: [
      "Andaian dari peramban disaring dua kali (rute portal dan gerbang bot): bilangan bulat positif, tanggal ISO, paling banyak 25 butir.",
      "Bukti baru: tidak ada dua baris audit yang tabel, aksi, judul, dan isinya sama dalam satu rantai penetapan (16 baris: PMH 5, PPP 3, PJS 3, PHS 5 - persis SIPP).",
    ],
    operationalNotes: [
      "Tidak ada migrasi. Ekstensi 1.150.0 - reload di chrome://extensions.",
      "Penetapan yang sudah tertulis tidak disentuh; bentuk baru berlaku pada penetapan berikutnya.",
      "Sidang keliling pada penetapan massal masih hanya menyamakan tempat; hari sidang tiap perkara mengikuti hari majelisnya - menunggu keputusan.",
    ],
    knownLimitations: [
      "majelis_id dipilih menurut peta kompetensi yang diukur dari kebiasaan satker (Pdt.G -> Perdata Agama, Pdt.P -> Permohonan, Kewarisan -> Waris, Ekonomi Syariah, Dispensasi Kawin); susunan yang tidak ada di ref_majelis_tetap tetap ditulis sebagai status 2.",
    ],
  },
  {
    version: "2.19.4",
    title: "ALETA Judicia v2.19.4 - Potensi Verstek dari Sidang Sebelumnya, dan Kotak Keadaan yang Berkelompok",
    date: "2026-09-15",
    status: "Terpasang",
    summary:
      "Jadwal Sidang: potensi verstek tidak lagi menyala pada sidang pertama yang hanya dihadiri penggugat, melainkan pada " +
      "sidang sesudahnya; ia menjadi kotak keadaan kuning yang dapat menyaring; dan lima belas kotak keadaan yang berjajar " +
      "menurut urutan penambahannya kini berkelompok menurut maksudnya: Panggilan, Jalannya sidang, Putusan, Antrian.",
    added: [
      "Kotak keadaan Potensi verstek (kuning) di kelompok Jalannya sidang - dapat ditekan untuk menyaring, dihitung dengan aturan yang sama dengan penanda pada barisnya.",
      "Judul kecil di atas tiap kelompok kotak keadaan. Kelompok yang seluruh kotaknya nol tidak digambar sama sekali.",
    ],
    changed: [
      "Aturan potensi verstek: pada sidang SEBELUMNYA hanya penggugat/pemohon yang hadir, tergugat/termohon belum pernah hadir pada sidang mana pun, dan pada sidang ini tergugat tidak (atau belum) hadir. Sidang pertama tidak pernah masuk.",
      "Urutan kotak keadaan: Panggilan (Retur, Belum dipanggil, Tidak perlu dipanggil), Jalannya sidang (Potensi verstek, Ditunda, Belum ada BAS, Sidang pertama, e-Litigasi), Putusan (Hari Putusan, Ikrar Talak, Sudah putus, Belum putus), Antrian (Belum ambil antrian, Sudah ambil antrian, Antrian online). Di dalam kelompok yang merah lebih dulu.",
      "Penanda potensi verstek pada baris kuning, bukan merah: ia gejala yang perlu disiapkan, bukan pekerjaan yang membatalkan sidang - karena itu ia tidak ikut kotak gabungan Perlu diperiksa.",
      "Bot mengirim ladang baru tergugatPernahHadir pada keadaan panggilan tiap sidang, dihitung dari seluruh riwayat sidang perkaranya.",
    ],
    fixed: [
      "Sidang pertama yang hanya dihadiri penggugat/pemohon disebut potensi verstek. Tergugat yang tidak datang pada sidang pertama baru dipanggil sekali lagi; yang berpotensi verstek sidang berikutnya.",
    ],
    security: [],
    operationalNotes: [
      "Tidak ada migrasi. Ekstensi tetap 1.149.0.",
      "Sampai bot 2.19.4 terpasang, ladang tergugatPernahHadir tidak terbaca dan yang dinilai hanya kehadiran sidang sebelumnya.",
    ],
    knownLimitations: [
      "Kehadiran dibaca dari isian jurusita/panitera di SIPP. Sidang sebelumnya yang kehadirannya tidak dicatat membuat potensi verstek tidak terbaca - gagal-tertutup, sama seperti jalur penilaian lain.",
    ],
  },
  {
    version: "2.19.3",
    title: "ALETA Judicia v2.19.3 - Kepala Majelis Kembali, dan Garis yang Memotong Kelompoknya Sendiri",
    date: "2026-09-15",
    status: "Terpasang",
    summary:
      "Dari layar perkara 585: kepala Penetapan Majelis Hakim hilang di mode manual, dan garis bawah tiap kepala " +
      "memotong kepala dari dropdown-nya sendiri - seluruh susunan terbaca bergeser satu kolom.",
    added: [],
    changed: [
      "Kepala Penetapan Majelis Hakim kembali di mode manual, dengan kode SK di depan namanya. Ia pernah disembunyikan karena menampilkan usulan mesin yang berbeda dari pilihan; sejak mengganti majelis memuat ulang usulannya, yang tertulis adalah majelis yang dipilih itu sendiri.",
      "Garis pemisah pindah dari bawah kepala ke bawah kelompok: kepala yang diikuti dropdown, saklar, peringatan, atau hitungan melepas garis bawahnya, dan garis dipasang di atas kepala berikutnya. Kepala yang berdiri sendiri tetap bergaris.",
    ],
    fixed: [],
    security: [],
    operationalNotes: ["Tidak ada migrasi baru. Ekstensi 1.149.0 - reload di chrome://extensions."],
    knownLimitations: [],
  },
  {
    version: "2.19.2",
    title: "ALETA Judicia v2.19.2 - Dua Temuan Pemeriksaan Rantai Penetapan",
    date: "2026-09-15",
    status: "Terpasang",
    summary:
      "Pemeriksaan rantai PMH/PPP/PJS/PHS atas data sungguhan sesudah 2.19.x terpasang: jalur tulis kini persis bentuk SIPP " +
      "(kunci [id], dua UPDATE perkara pada PHS, jam berjeda 1-10 menit). Dua yang tersisa diperbaiki di sini.",
    added: [],
    changed: [
      "Mengganti majelis melepas tanggal sidang yang dipilih untuk majelis lama. Hari sidang A (Rabu) dan B (Selasa) berbeda; tanggal majelis B yang bertahan jatuh ke jalur tanggal bebas dengan peringatan - tidak diam, tetapi ia sisa, bukan pilihan. Tanggal bebas yang sengaja dibuka lewat saklarnya tetap dipertahankan.",
    ],
    fixed: [
      "Jalur bongkar tidak lagi mengaudit DELETE perkara_smartmajelis - tabel yang tidak pernah sekali pun dicatat SIPP. Jalur tulis sudah dicabut sejak 2.17.x; jalur bongkar tertinggal, dan terlihat pada bongkar 567 pukul 15:19:43. Barisnya sendiri tetap dihapus.",
    ],
    security: [],
    operationalNotes: ["Tidak ada migrasi baru."],
    knownLimitations: [
      "Uji kering rantai TULIS atas perkara hidup belum dapat dijalankan: tidak ada perkara 2026 yang penetapannya belum lengkap. Rencananya dibuktikan luring; pendaftaran berikutnya menjadi bahannya.",
    ],
  },
  {
    version: "2.19.1",
    title: "ALETA Judicia v2.19.1 - Smart Majelis di Luar SK Tidak Lagi Memutus Rantainya",
    date: "2026-09-15",
    status: "Terpasang",
    summary:
      "Pembuktian 2.19.0 di server: rantai manual terbukti utuh (pilih A -> Rabu, pilih B -> Selasa), tetapi jalur otomatis " +
      "kini dikendalikan Smart Majelis SIPP yang mengusulkan trio di luar SK - kode jujur kosong, dan hari sidangnya ikut hilang.",
    added: [],
    changed: [
      "Smart Majelis SIPP yang mengusulkan susunan di luar SK ditimpa giliran majelis SK - dan HANYA dalam keadaan itu. Usulan SIPP yang majelis SK tetap dihormati. Yang ditimpa disebut apa adanya: sebabnya menyebut usulan SIPP, dan dropdown tetap dapat mengembalikannya.",
      "Susunan di luar SK tetap mendapat hari sidang - dipinjam dari kode ketuanya, dan sebabnya menyebut itu. Kodenya tetap kosong; kode palsu lebih buruk daripada tanpa kode, tetapi tanpa tanggal lebih buruk lagi.",
    ],
    fixed: [],
    security: [],
    operationalNotes: ["Tidak ada migrasi baru. Ekstensi tetap 1.147.0."],
    knownLimitations: [
      "Bila SK belum diisi sama sekali, Smart Majelis tetap satu-satunya sumber - tidak ada majelis SK untuk menggantikannya.",
    ],
  },
  {
    version: "2.19.0",
    title: "ALETA Judicia v2.19.0 - Mengganti Majelis Menghitung Ulang Seluruh Rantainya",
    date: "2026-09-15",
    status: "Terpasang",
    summary:
      "Empat keluhan dari satu layar - otomatis selalu Sudarmin, panitera tidak ikut majelis, PHS tetap Sudarmin walau Fahri dipilih, " +
      "hari sidang Selasa untuk majelis Rabu - ternyata satu akar: giliran memilih trio dadakan berperkara 5 lalu melabelinya dengan " +
      "kode ketuanya, dan pilihan manual tidak pernah menghitung ulang apa pun.",
    added: [
      "Dropdown majelis pada mode OTOMATIS. Mengganti majelis di sana mengganti hakimnya, panitera sidangnya, juru sitanya, dan hari sidangnya - dihitung ulang server, bukan ditiru di peramban.",
      "PHS ikut ditawarkan pada Pejabat yang menetapkan. Calonnya anggota majelis perkara itu saja, ketua di depan sebagai pilihan otomatis - ketua majelis yang cuti pada hari penetapannya tidak lagi memaksa petugas kembali ke blangko SIPP.",
    ],
    changed: [
      "Giliran berjalan di antara majelis SK saja. Terukur pada perkara 567: trio dadakan B,C1,C3 yang pernah dipakai 5 kali selalu menang atas ketiga majelis SK (259, 125, 60 perkara) - itulah sebab majelis Ketua tidak pernah dapat perkara dari usulan.",
      "Kode majelis diambil dari SK, dan dikosongkan bila susunannya di luar SK. Kode ketua melabeli trio dadakan sebagai Majelis B, lalu panitera, hari sidang, dan penanda tangan PHS mengikuti majelis yang tidak sedang bersidang.",
      "Mengganti majelis - di mode mana pun - memuat ulang usulan untuk majelis itu. Sebelumnya usulan disusun sekali saat papan dibuka, dan dropdown hanya mengubah pilihan di peramban.",
      "Bongkar seluruh penetapan berjeda 1-10 menit per pejabat, seperti jalur tulis. Sebelumnya empat belas baris audit berdetik sama atas nama tiga akun - tanda pekerjaan mesin yang langsung terbaca. PHS paling awal, PMH paling akhir (= sekarang), sehingga di Audit Trail terbaca PMH, PPP, PJS, lalu PHS, dan tidak satu pun baris bertanggal masa depan.",
    ],
    fixed: [],
    security: [
      "Id hakim pilihan disaring di portal dan di gerbang bot - bilangan bulat positif, paling banyak lima - lalu diperiksa bot ke daftar hakim aktifnya sendiri. Hakim yang sudah tidak aktif menggagalkan pilihan, bukan mengurangi majelis.",
    ],
    operationalNotes: ["Tidak ada migrasi baru."],
    knownLimitations: [
      "Juru sita tidak ditetapkan per majelis oleh SK; ia tetap giliran beban dan dihitung ulang bersama yang lain supaya tampilannya segar, bukan karena majelis mengubahnya.",
    ],
  },
  {
    version: "2.18.1",
    title: "ALETA Judicia v2.18.1 - Tiga tabel yang dijawab tidak ada tanpa error",
    date: "2026-09-15",
    status: "Terpasang",
    summary:
      "Verifikasi 2.18.0 di server menemukan kolom KUA kosong pada SELURUH ruangan sidang keliling - " +
      "tanpa satu pun error. Sebabnya bukan pencocokan nama: tabelnya tidak terdaftar di layanan skema, " +
      "sehingga tabelAda() menjawab tidak ada. Penjaga yang dibuat untuk menutup kelas cacat itu menangkap dua lagi.",
    added: [
      "Penjaga tabel-sipp-terdaftar: menyisir tiap tabelAda(\"...\") di seluruh layanan bot lalu mengadunya dengan daftar TABEL. Pesan gagalnya menyebut nama tabel DAN berkasnya.",
    ],
    changed: [],
    fixed: [
      "ref_kua didaftarkan - KUA wilayah ruangan sidang keliling kini terbaca. KUA SIGI BIROMARU, SIRENJA, LABUAN, dan RIO PAKAVA memang ada di sana, 5.936 baris seluruhnya.",
      "perkara_putusan_pemberitahuan_putusan didaftarkan - 17.415 baris yang selama ini tidak pernah terbaca pembaca tahapan. Tahapannya tetap tergambar, hanya tanpa bagian itu, tanpa tanda apa pun.",
      "arsip_pinjam didaftarkan - masih nol baris, jadi belum merugikan; didaftarkan supaya tidak menjadi cacat diam berikutnya.",
    ],
    security: [],
    operationalNotes: [
      "Tidak ada migrasi baru. 0044 sudah terpasang bersama 2.18.0.",
    ],
    knownLimitations: [
      "Penjaganya hanya menangkap nama tabel yang ditulis TEGAS di dalam tabelAda(\"...\"). Nama yang disusun dari variabel tidak terjangkau.",
    ],
  },
  {
    version: "2.18.0",
    title: "ALETA Judicia v2.18.0 - SK Susunan Majelis, dan Nomor Butir yang Ditelan RTF",
    date: "2026-09-15",
    status: "Terpasang",
    summary:
      "SK Ketua tentang susunan majelis hakim dan panitera sidangnya kini tersimpan dan dapat disunting, " +
      "sesudah diketahui bahwa jalur lama yang mencocokkan KODE panitera tidak pernah dapat benar. " +
      "Bersamanya: delapan perbaikan papan penunjukan, dan satu cacat pencetakan yang sudah lama diam - " +
      "nomor butir posita yang ditelan RTF.",
    added: [
      "Layar SK susunan majelis hakim dan panitera sidang di Admin ALETA e-Court - majelis, kode hakim, panitera sidang beserta kodenya, hari sidang, nomor dan tanggal SK. Satu-satunya tempat susunan majelis dapat diubah tanpa menyentuh kode.",
      "Saklar sidang keliling pada mode OTOMATIS dan pada penetapan massal - sebelumnya tempat sidang hanya dapat dipilih di mode manual, sehingga satu hari keliling yang menghasilkan belasan perkara seluruhnya tertulis di ruang dalam gedung.",
      "Tempat sidang keliling diurut menurut pemakaian sungguhan, beserta KUA wilayahnya dari ref_kua.",
    ],
    changed: [
      "Panitera sidang menurut SK ditunjuk lewat id orangnya, bukan lewat kode. Kodenya tetap tampil di sebelah namanya.",
      "Susunan majelis yang ada di SK didahulukan dan diberi kodenya; yang di luar SK tetap dapat dipilih, di bawahnya, tanpa kode.",
      "Kalender hari sidang tidak lagi mengunci tanggal sebelum usulan - batasnya hari ini, dan jeda minimal menurut SK menjadi peringatan yang dibaca.",
      "Usulan PMH tidak digambar di mode manual, dan kotak ringkasan Akan tercatat di SIPP atas nama dicabut - ia membaca pilihan bawaan mesin sementara pilihan pejabatnya dapat diganti.",
      "Angka beban tidak lagi disebut perkara dan tidak lagi berdesimal - ia bobot, dan bobotnya diterangkan.",
      "Nama berkas unduhan ABT memuat nomor perkara, keterangan blangko, dan jenis berkasnya.",
    ],
    fixed: [
      "NOMOR BUTIR POSITA YANG DITELAN RTF. cleanHtmlTagSpecial mengubah </p> menjadi \\par tanpa spasi, lalu filter_var menyapu <p> - sehingga </p><p>2. Bahwa menjadi \\par2. Bahwa, yang di RTF adalah kata kendali berparameter 2. Angkanya lenyap. Paragraf berawalan huruf lebih parah: \\parKedua dibaca sebagai kata kendali bernama parKedua, dan seluruh katanya hilang.",
      "Panitera sidang menurut SK: pencocokan kode memulangkan EMPAT orang untuk Majelis A - keempatnya berkode D di SIPP, dua di antaranya panitera majelis lain - dan NOL untuk Majelis B dan C1.",
      "Status perkara sesudah PHS berbunyi Sidang pertama, bukan nama penetapannya; SIPP menulis DUA baris riwayat pada PHS, ALETA hanya satu.",
      "Tahapan sesudah penetapan dibongkar berbunyi Pendaftaran, bukan Pendaftaran Perkara.",
      "Baris audit tidak lagi menyebut perkara_proses dan perkara_smartmajelis - dua tabel yang tidak pernah sekali pun dicatat SIPP sejak 2016.",
      "Alamat pada baris audit memakai alamat peramban petugas, bukan alamat peti Docker yang tidak pernah muncul di sepuluh tahun riwayat SIPP.",
      "Bahwa sudah tidak sanggup lagi ikut dibuang dari penutup keterangan saksi - bentuk berkata sudah di tengahnya lolos dari keempat pola lama.",
      "Penanda butir bertingkat 1.1 dan berkurung a) dikenali perapian posita, dan ditulis kembali apa adanya.",
    ],
    security: [
      "Kode hakim dan pasangan panitera dari SK disaring di gerbang bot sebelum dipakai - bentuknya dibatasi, id yang tidak masuk akal dibuang.",
      "Alamat peramban diambil dari entri TERAKHIR X-Forwarded-For: Apache menambahkan alamatnya ke ujung, jadi entri pertama dapat dikarang peramban.",
    ],
    operationalNotes: [
      "Migrasi 0044 menambah kolom pada aleta_sipp_hari_sidang - jalankan pemasangan dengan ALETA_RUN_DB_MIGRATIONS=1.",
      "Sesudah terpasang: buka Admin - ALETA e-Court, ikat tiap kode panitera SK ke orangnya. Sampai itu dikerjakan, panel memakai giliran beban dan layarnya menyebutnya apa adanya.",
    ],
    knownLimitations: [
      "Halaman 1, 2, 4, dan 5 SK tidak berlapisan teks - hanya Lampiran I yang terbaca mesin. Bila ada lampiran lain, isinya harus diketik di layar pengaturan.",
      "Pemisah paragraf memperbaiki posita yang DIRAPIKAN ALETA. Posita yang belum pernah dirapikan tetap kehilangan nomor butirnya saat dicetak.",
    ],
    details: [
      {
        title: "Kode panitera yang tidak dapat menunjuk siapa pun",
        items: [
          "Sri Susilowati, Munifa, Qadariyah, dan Andini Puspita Sari berbagi satu kode SIPP: D.",
          "Sitti Nurhidayah berkode D8 di SIPP, D6 menurut SK.",
          "Unun Fidiyasari P. dan Fikrianto tidak berkode sama sekali di SIPP.",
          "SK menulis Munifah, SIPP menulis Munifa - pencocokan nama pun meleset.",
        ],
      },
      {
        title: "Tempat sidang keliling, terukur sejak 2025",
        items: [
          "Sidang Keliling Sigi Biromaru 128 sidang, terakhir 1 Oktober 2026.",
          "Sidang Keliling Rio Pakava 40 sidang; Sirenja 14; Labuan belum pernah.",
          "Urutan abjad menaruh Labuan di atas Sigi Biromaru.",
        ],
      },
    ],
  },
  {
    version: "2.17.0",
    title: "ALETA Judicia v2.17.0 - Penjaga Tenggat, Penyusun Pertimbangan, dan Arsip yang Bertindak",
    date: "2026-09-15",
    status: "Terpasang",
    summary:
      "Tiga agen baru - Tahap 3, 4, dan 5 - beserta jadwal sidang yang 50 kali lebih cepat. " +
      "Yang paling berharga dari ketiganya bukan yang mereka kerjakan, melainkan yang mereka TOLAK kerjakan: " +
      "aturan tenggat versi pertama menghasilkan 99 tuduhan palsu dari 101, dan seluruhnya tertangkap sebelum satu pesan pun terkirim.",
    added: [
      "AGEN PENJAGA TENGGAT (Tahap 3) - laporan harian WhatsApp atas tujuh tenggat: perkara lewat 5 bulan (SEMA 2/2014), ikrar talak yang gugur bila lewat 6 bulan (Pasal 70 ayat 6 UU 7/1989), akta cerai gugat sejak BHT, akta cerai talak sejak IKRAR, relaas sidang pertama, antrean Direktori Putusan yang gagal, dan putusan tanpa anonimisasi. Tiap ambangnya diukur atas data sungguhan, bukan ditebak.",
      "AGEN PENYUSUN PERTIMBANGAN (Tahap 4) - draf daftar alat bukti surat (variabel ABT 1214, pekerjaan tangan terbanyak: 2.025 pengisian). Menyusun P.1 (KTP) dan P.2 (Kutipan Akta Nikah) dari data SIPP. TIDAK PERNAH MENYIMPAN SENDIRI.",
      "AGEN ARSIP e-COURT BERTINDAK (Tahap 5) - mencocokkan catatan arsip dengan cakram, lalu menyusun rencana penarikan ulang berkas yang hilang. Diukur di server: 400 tercatat, 0 ada, 400 hilang.",
    ],
    changed: [
      "Jadwal sidang 11-14 detik menjadi 138-260 ms. Sebabnya satu view: v_pihak_perkara adalah UNION berpembeda yang memaksa basis data membentuk SELURUH isinya sebelum saringan berlaku. Untuk 20 perkara: 8.563 ms lewat view, 413 ms langsung ke tabelnya - baris identik.",
      "Urutan pihak menjadi TETAP. View lama dijalankan dua kali atas data yang sama memulangkan urutan yang berbeda - terukur 22 kali pada 210 daftar pihak. Yang dipakai sekarang urutan milik SIPP sendiri: Tergugat I, II, III.",
      "Pemetaan blangko putusan keluar dari popup ekstensi dan pindah ke panel PUTUSAN MASSAL; baris yang selesai disembunyikan.",
    ],
    fixed: [
      "Cerai talak mengambil blangko dari menu Cerai Talak, bukan Cerai Gugat. Berkas bernama sama berdiri di dua menu ABT dan identik sampai bita terakhir, jadi tidak ada satu pun error yang berbunyi - tetapi menu Cerai Gugat tidak memuat satu pun berkas khas talak.",
      "Nama jenis perkara SIPP dipadankan - 431 perkara yang selama ini dilewati putusan massal dengan alasan \"blangko belum dipetakan\", padahal blangkonya sudah dipetakan di bawah nama lain.",
      "Alamat portal dicatat dari SIPP, ABT, dan halaman ALETA - bukan dari SIPP saja. Petugas yang seharian di ABT tidak pernah membuka SIPP, jadi popupnya memakai alamat lama dan menuduh portal tidak terjangkau.",
    ],
    security: [],
    operationalNotes: [
      "Penjaga Tenggat MENYUSUN laporannya dan memulangkannya; pengirimannya terpisah. Laporan yang dapat dibaca lebih dahulu adalah laporan yang dapat diperbaiki sebelum seratus orang menerimanya.",
      "Penyusun Pertimbangan tidak punya satu pun fungsi yang menulis, dan layanannya tidak punya satu pun pernyataan tulis - ada penjaga yang menuntut keduanya tetap begitu.",
      "Arsip Bertindak memeriksa ketahanan direktori tujuannya SEBELUM menarik apa pun. Menarik ulang ke direktori yang musnah tiap peti dibangun ulang adalah pekerjaan yang menghapus dirinya sendiri - dan itu sudah pernah terjadi pada 400 berkas ini.",
    ],
    knownLimitations: [
      "Tenggat akta cerai dan ikrar talak hanya berlaku pada perceraian yang DIKABULKAN. Tanpa saringan itu, 99 dari 101 perkara yang tertangkap adalah perkara dicabut, digugurkan, ditolak, atau gugur - yang akta cerainya memang tidak akan pernah terbit.",
      "Tanggal terbit KTP tidak ada kolomnya di SIPP, jadi draf alat bukti SELALU menyisakan satu lubang yang harus diisi orang. Tanggal yang salah pada daftar alat bukti lebih buruk daripada lubang yang jelas.",
      "Penarikan ulang arsip e-Court belum dijalankan - rencananya sudah dapat dibaca, tindakannya menunggu keputusan.",
      "Antrean sinkron penetapan ke e-Court (majelis, panitera, jurusita, jadwal) berhenti diisi sejak pertengahan 2024 pada DUA pengadilan yang diperiksa. Perlu dipastikan dari portal e-Court apakah sinkronnya pindah jalur.",
    ],
  },
  {
    version: "2.16.2",
    title: "ALETA Judicia v2.16.2 - Token yang Terbuang, Warna yang Tertinggal, dan Daftar yang Dapat Dicari",
    date: "2026-09-14",
    status: "Operasional",
    summary:
      "Tujuh perbaikan yang seluruhnya datang dari layar sungguhan di server, bukan dari membaca kode. Dua di antaranya cacat yang tidak pernah berbunyi: token blangko ABT dibuang oleh penjaganya sendiri, dan warna palet tidak pernah sampai ke SIPP. Sisanya bahasa yang dipakai orang, dan daftar putusan massal yang akhirnya dapat dicari.",
    added: [
      "CARI, SARING, DAN URUT pada daftar putusan massal ABT. Cari nomor, jenis, atau agenda; saring semua / belum putus / sudah putus / blangko siap / blangko belum / yang dicentang saja; urutkan menurut agenda putusan, nomor, jenis, atau keadaan. Dua puluh perkara sehari sudah melewati satu layar panel, dan yang dicari hampir selalu sebagian kecilnya.",
      "URUTAN BAWAAN: AGENDA PUTUSAN DAHULU. Pada tanggal sidang mana pun hanya sebagian yang hendak diputus - sisanya mediasi, jawaban, pembuktian - dan agenda SIPP satu-satunya petunjuk sebelum berkasnya dibuka. Ia URUTAN, bukan saringan: perkara diputus pada agenda yang tertulis \"pembuktian\" bukan hal aneh, jadi yang lain tetap tergambar di bawah.",
      "WARNA SATU HALAMAN DAPAT DILEPAS DARI POPUP - tombol baru di sebelah tombol kembalikan-bawaan pada kepala panel. SIPP, ABT, dan halaman ALETA kerap terbuka berdampingan di satu layar, dan yang bekerja di antaranya perlu tahu sekilas sedang menatap yang mana. Yang dilepas menyimpan warnanya atas nama panelnya sendiri dan tidak lagi tersentuh popup; keadaannya disebut pada judul tombol.",
    ],
    changed: [
      "Lencana lingkungan \"SERVER\" menjadi \"SERVER\".",
      "\"Susun rencana (kering)\" menjadi \"Periksa dulu - belum dijalankan\", dan di panel SIPP \"Periksa dulu (kering)\" menjadi \"Periksa dulu - belum ditulis\". \"Kering\" istilah pemrogram; yang menekannya panitera, dan yang perlu dijawab tombol itu hanya satu - apakah menekannya mengubah sesuatu atau tidak.",
      "Bawaan blangko dispensasi kawin menjadi \"[01] [Kabul] DK - (Anak P Cewek) Hamil\" - nama yang benar-benar ada di server. Bawaan sebelumnya nama dari ABT setempat yang sejak hari pertama ditandai \"periksa namanya di server\"; diperiksa, dan ternyata tidak ada di sana sama sekali.",
      "Yang tercentang pada putusan massal tidak hilang ketika daftarnya disaring, dan berapa yang tercentang tetapi tidak terlihat disebut di atas daftar.",
    ],
    fixed: [
      "TOKEN BLANGKO ABT TIDAK LAGI DIBUANG PENJAGANYA SENDIRI. Gejalanya angka kembar - \"7 token terisi, 7 berkas tidak ditemukan\" - dan itu memang satu peristiwa: ketujuh berkasnya KETEMU, lalu tokennya dihapus sebelum sempat disimpan. Penjaga lamanya menuntut token hanya berisi [A-Za-z0-9+/=_%.-], padahal token ABT hasil enkripsi CodeIgniter kerap memuat tilde. Diukur atas empat tautan blangko sungguhan di server: TIGA memuat tilde, jadi tiga dari empat dibuang diam-diam - dan yang membacanya menyimpulkan blangkonya tidak ada di ABT.",
      "SIPP IKUT WARNA DARI POPUP, seperti ABT. Tema gelap/terang sudah diikuti sejak lama, tetapi WARNA paletnya tidak: panel ABT mendapatkannya lewat alatPasangPanel yang memasang pendengar palet, sedangkan panel SIPP dibangun sendiri dan tidak pernah memanggilnya. Yang terbaca dari situ bukan \"belum tersambung\" melainkan \"popupnya tidak berlaku untuk SIPP\".",
    ],
    security: [],
    operationalNotes: [
      "Tidak ada migrasi basis data pada rilis ini.",
      "Ekstensi naik dua tingkat sekaligus: 1.135.0 (bawaan blangko dispensasi) dan 1.136.0 (enam sisanya). Tekan Reload di chrome://extensions sesudah portal terpasang.",
      "Pemetaan blangko yang sudah tersimpan TIDAK dihapus. Tokennya diambil ulang sendiri ketika panel dibuka di halaman beranda blangko ABT - atau dengan menekan \"Ambil token dari ABT\".",
    ],
    knownLimitations: [
      "Penjaga token yang baru menerima hampir semua bentuk; yang menjaga isinya tetap ABT sendiri - token yang salah tetap dijawab halaman error, dan ALETA menyebutnya apa adanya.",
      "Pelepasan warna disimpan per panel, bukan per tab. Dua tab SIPP berbagi satu warna.",
    ],
  },
  {
    version: "2.16.1",
    title: "ALETA Judicia v2.16.1 - Relaas, Kalender Perkara, dan Court Calendar",
    date: "2026-09-14",
    status: "Operasional",
    summary:
      "Tiga pertanyaan yang dibawa petugas ke layar Status Perkara dan tidak pernah punya jawaban di sana: sudahkah para pihak dipanggil untuk sidang ini dan patutkah panggilannya; bulan ini perkara ini ada apa saja; rencana sidang yang disusun majelis, mana yang tidak jadi. Ketiganya dijawab dari keterangan yang SUDAH ada - dua di antaranya bahkan sudah dikirim bot selama ini dan berhenti di layar tanpa satu error pun.",
    added: [
      "RELAAS PANGGILAN jadi bagian sendiri, runut per sidang. Dulu ia satu blok di dalam Berkas berupa deretan nama dan tombol unduh; tempatnya keliru - relaas bukan lampiran, melainkan perbuatan yang menentukan sidang boleh dilanjutkan atau harus ditunda. Tiap sidang menjadi satu kelompok berurut: siapa yang dipanggil, oleh jurusita siapa, bertemu orangnya atau tidak, keterangan hasilnya, jejak pos beserta resi dan returnya, berapa hari sebelum sidang - dan relaas yang dilaksanakan SESUDAH hari sidangnya berbunyi \"2 hari SESUDAH sidang\", bukan angka negatif yang terbaca seperti panggilan patut.",
      "KEPATUTAN PANGGILAN PER PIHAK tergambar untuk pertama kalinya: jalur yang seharusnya dipakai, tanggal kirim, bukti penerimaan, tenggang beserta ambang dan dasar hukumnya. Penilaian ini sudah dihitung bot sejak lama dan tidak pernah sampai ke layar Status Perkara.",
      "KALENDER PERKARA - pendaftaran, penetapan, relaas, mediasi, sidang, putusan, minutasi, BHT, akta cerai, dan ikrar talak pada satu bulan yang dapat ditelusuri. Bulan yang dibuka bukan bulan ini melainkan bulan peristiwa terdekat: perkara yang putus setahun lalu tidak punya apa pun pada bulan berjalan, dan kalender yang terbuka kosong terbaca seperti kalender yang rusak.",
      "COURT CALENDAR SIPP - rencana sidang yang disusun majelis (tabel perkara_court_calendar) diadu dengan pelaksanaannya. SIPP menampilkan rencana dan jadwal di dua layar berbeda, sehingga \"rencana mana yang tidak jadi\" hanya dapat dijawab dengan membandingkan tanggal dengan mata. Empat keadaan: terlaksana, sudah dijadwalkan, lewat tanpa sidang, menunggu dijadwalkan.",
    ],
    changed: [
      "Bagian Berkas menyisakan hitungan relaas beserta penunjuk ke bagian barunya - daftarnya tidak digambar dua kali. Dua daftar untuk satu data akan berselisih pada suntingan berikutnya, dan tidak ada yang tahu mana yang usang.",
      "Delapan ruas relaas yang sudah dikirim bot sejak lama - jurusita, ketemu, keterangan hasil, tanggal kirim pos, status pos, retur, nomor resi, kedudukan pihak - kini dideklarasikan tipenya di layar dan benar-benar tampil.",
    ],
    fixed: [],
    security: [],
    operationalNotes: [
      "Tidak ada migrasi basis data pada rilis ini. Bot tetap harus nyala ulang: pembaca Court Calendar adalah layanan baru.",
      "Court Calendar hanya terisi pada sebagian perkara - diukur 418 dari 791 perkara 2026. Layar menyebut kekosongan itu lazim, bukan cacat.",
      "Terlaksana dinilai dari ADANYA sidang pada tanggal yang direncanakan, bukan dari kecocokan agendanya: agenda ditulis bebas dan ejaannya tidak ajek di SIPP.",
    ],
    knownLimitations: [
      "Kepatutan panggilan dinilai untuk SIDANG TERAKHIR yang tercatat, bukan untuk tiap sidang - itulah yang dihitung bot. Rincian per sidang lama harus dibaca dari daftar relaasnya.",
      "Angka pengukuran Court Calendar diambil dari SIPP PA Donggala 14 September 2026; satuan kerja lain dapat sangat berbeda.",
    ],
  },
  {
    version: "2.16.0",
    title: "ALETA Judicia v2.16.0 - Agen yang Membaca Sebelum Menulis",
    date: "2026-09-14",
    status: "Operasional",
    summary:
      "Empat hari sejak 2.15.0, 69 commit, ekstensi 1.91.0 -> 1.134.0. Yang berubah bukan satu fitur melainkan arah: ALETA kini menulis putusan dan penetapan ke SIPP atas nama pejabatnya, dan karena itu ada yang MEMBACA lebih dulu sebelum menulis - praperiksa putusan yang berhenti bila bertentangan, penyamaran isi perkara yang diukur atas posita sungguhan sebelum satu kata pun keluar ke penyedia AI, dan mode kering yang membuktikan tidak ada yang tertulis. Tidak ada yang diperbaiki sendiri oleh mesin; orang yang memutuskan.",
    added: [
      "PRAPERIKSA PUTUSAN (ekstensi 1.134.0, Tahap 2 rencana agen). Tepat sebelum blangko Putusan Akhir diisi dari draf ALETA, agen membaca fakta SIPP dan mengadunya dengan draf serta isian blangko: tanggal putusan harus hari sidang perkara itu (1.643 dari 1.643 putusan 2025-2026 begitu), kata kerja amar harus berpadanan dengan Status Putusan (1.642 dari 1.643 - yang satu memang keliru), nama di amar harus pihak atau anak perkara ini, majelis yang disebut naskah harus majelis yang ditetapkan, perkaranya belum putus. Yang bertentangan MENAHAN. Diukur atas 200 putusan sungguhan: satu hentikan - dan itu kesalahan data nyata di SIPP.",
      "DUA JALUR AI DAN PENYAMARAN ISI PERKARA (Tahap 1). Jalur UMUM untuk pekerjaan tanpa isi perkara, jalur ISI PERKARA yang penyedianya dipilih terpisah dan MENOLAK mewarisi sambungan global. Posita, amar, dan petitum disamarkan dengan kamus pihak dan anak yang DIKETAHUI SIPP - bukan ditebak - sebelum berangkat; muatan tanpa bukti penyamaran ditolak gerbang. Diukur atas 150 posita sungguhan: 147 bersih. Keduanya diisi dari layar Pengaturan AI sebagai dua modul.",
      "PUTUSAN OTOMATIS LENGKAP. Naskah putusan RTF dari ABT diterima ALETA; pertimbangan, amar, amar anonim, dan kedelapan medan pilihan (status, verstek, faktor perceraian, qobla, nusyuz, keadaan istri, sumber hukum, dispensasi) diisi dari draf - medan tersembunyi dibuka sendiri; Simpan ditekan sendiri dan tersimpannya DIBUKTIKAN dari SIPP; putusan dan anonimisasinya diunggah ke SIPP.",
      "PUTUSAN MASSAL dari jadwal sidang: di beranda blangko ABT pilih tanggal, ALETA menyusun rencana kering per perkara (RTF, draf, PDF, anonim), lalu antrean diserahkan ke SIPP - otomatis atau berhenti tiap perkara. Pemetaan blangko menurut NAMA yang dapat disunting, bawaan cerai/itsbat/dispensasi, dan dapat diisi dari pohon blangko portal.",
      "PENETAPAN: tanda tangan pejabat masuk basis data dan penetapan terbit ke SIPP sebagai dokumen; penetapan massal untuk halaman yang campur; pembatalan satu atau seluruh penetapan; jam penetapan berjarak wajar; Smart Majelis tercatat.",
      "PANEL SUPER ADMIN: enam palet gelap yang berlaku menyeluruh di SIPP, ABT, dan ALETA tanpa kelebat; pemilih warna di kepala panel; perkakas (lencana lingkungan, kotak hitam, MODE KERING yang menahan Simpan, Pulihkan satu medan, papan kesehatan, salin laporan); bilah gulir yang dapat ditekan; ukuran huruf dapat diatur; pita identitas di kepala dan kaki.",
      "RIWAYAT ALETA pindah ke basis data sendiri: percobaan yang ditolak ikut tercatat beserta sebabnya; sys_audittrail SIPP tidak lagi memuat satu kata pun tentang ALETA.",
      "PORTAL: kewenangan ekstensi per pegawai dan peran Operator (migrasi 0039); kartu dasbor dapat digeser dan susunan bawaan dari Super Admin (0040, 0042); masa berlaku sesi login (0041); saklar tiap jenis pesan bot dan kirim saat data lengkap (0043); riwayat pengiriman dengan lembar cetak; Update Manager mengunduh seluruh aplikasi, paket pembaruan, dan basis data; catatan pembaruan ekstensi di tiga layar.",
      "E-AUDIT: Bab 2, 3, 4, 7, 8, 9, dan 12 katalog tersambung - rapor aparatur, keuangan perkara, statistik, metode analisis - dengan pustaka statistiknya sendiri.",
      "Pengembang: dua skill (rilis-ekstensi, periksa-uji) dan skrip yang membedakan uji habis-waktu dari salah-hasil, sehingga 'merah' tidak lagi diulang membabi buta.",
    ],
    changed: [
      "Ekstensi SIPP naik ke 1.134.0.",
      "Alasan perkara, data pernikahan, dan Obyek Sengketa diusulkan dari posita dan kebiasaan satker; usulan ditimbang per kalimat dan yang berselisih berhenti mengaku yakin.",
      "Hubungan ekstensi ke portal dibuat tahan lambat; panel tetap berguna saat ALETA mati (luring).",
      "Selisih arsip e-Court diperiksa sendiri tiap malam, dan arsip yang hilang menyeluruh dibunyikan.",
    ],
    fixed: [
      "Penetapan berhenti di tengah jalan lalu tidak dapat dilanjutkan; kini dilanjutkan dari langkah yang tersisa, dan Riwayat Perkara yang tidak pernah ditulis kini ditulis.",
      "Nomor perkara di halaman daftar membawa angka urutnya; radio nusyuz tidak tercentang; medan blangko putusan ditunjuk lewat id yang berubah - kini lewat nama.",
      "Posita tercetak tanpa baris; SIPP membuang <br> saat mencetak, kini pemisahnya <p>.",
      "Aksara kendali liar pada tiga berkas membuat satu penjaga uji selalu lulus.",
      "Lima layanan penilaian mendaftar tanpa penjaga sehingga permintaan kedua selalu gagal; RG14/MP13/MP16 menautkan arsip lewat perkara_id yang nol.",
      "\"Failed to fetch\" di halaman masuk diganti kalimat yang dapat dibaca petugas.",
    ],
    security: [
      "Isi perkara tidak pernah keluar ke penyedia AI tanpa penyamaran yang berbukti; jalur perkara yang belum disetel berarti tidak dikirim ke mana pun.",
      "Kunci API tidak digandakan per jalur - tetap satu, lewat env server.",
    ],
    operationalNotes: [
      "Migrasi 0039-0043 WAJIB dijalankan (ALETA_RUN_DB_MIGRATIONS=1); seluruhnya CREATE/ADD IF NOT EXISTS, aman diulang. Sesudah pasang, cocokkan jumlah drizzle.__drizzle_migrations = 44.",
      "Bot dinyalakan ulang oleh pembaruan - wajib, sebab rute praperiksa dan layanan penyamaran baru.",
      "Ekstensi: petugas menekan Reload di chrome://extensions atau memasang dari panel (pembaruan sekali klik).",
      "Pengaturan AI: isi modul 'jalur UMUM' dan 'jalur ISI PERKARA', lalu Sinkronkan AI. Jalur perkara yang dibiarkan kosong berarti praperiksa berjalan tanpa pendapat AI - dan menyebutnya.",
      "Sahkan tanda tangan pejabat di ALETA e-Court - Tanda Tangan sebelum menerbitkan penetapan; pasangan nama-gambar tidak pernah ditebak mesin.",
    ],
    knownLimitations: [
      "Seluruh rilis 1.92-1.134 dibangun ketika server mati dan hanya teruji setempat (replika statis, node:vm, basis data SIPP salinan). Jalankan `node scripts/ukur-penyamaran.js 150` di server sebelum mempercayai angka 147/150, dan ukur ulang praperiksa atas putusan server.",
      "Putusan massal, unggah ke SIPP, dan pendapat AI belum pernah dijalankan atas perkara sungguhan di server - jalankan KERING dahulu pada satu perkara.",
    ],
  },
  {
    version: "2.15.0",
    title: "ALETA Judicia v2.15.0 - Penetapan Tanpa Berpindah Akun",
    date: "2026-09-10",
    status: "Operasional",
    summary:
      "Tombol Kerjakan pada papan penunjukan praktis tidak pernah dapat ditekan di halaman detail perkara - halaman yang paling sering dibuka - sebab ia hanya bisa mengisi BLANGKO SIPP, dan blangko itu memang tidak ada di sana. Mesin yang menulis penetapan langsung sudah lengkap sejak lama; yang tidak pernah ada adalah jalannya ke sana.",
    added: [
      "Tetapkan lewat ALETA - PMH, PPP, PJS, dan PHS dituliskan langsung ke SIPP secara berurutan, tanpa membuka empat halaman blangko dan tanpa berganti empat akun. Yang ditulis dan ke tabel mana persis sama dengan yang dituliskan SIPP ketika petugas menekan Simpan, baris sys_audittrail-nya ikut.",
      "Tekanan pertama KERING: rencana keempat langkah digambarkan lebih dulu - pernyataan apa, ke tabel mana, atas nama siapa - tanpa satu pun dijalankan. Menulis menuntut tekanan kedua atas rencana yang sudah terbaca.",
      "Pilihan pejabat yang menetapkan, dengan pilihan ALETA sudah tersorot dan ditandai. Yang ditawarkan hanya calon yang sah untuk langkah itu; ketua majelis sengaja tidak punya pilihan, sebab PHS ditandatangani ketua majelis perkara itu sendiri.",
    ],
    changed: [
      "Usulan PMH untuk perkara bermajelis tidak lagi menunggu Smart Majelis SIPP. Bila tabelnya belum diisi, ALETA mengusulkan dari susunan majelis yang benar-benar dipakai tahun ini dan memilih yang paling sedikit menerima perkara - asas yang sama dengan giliran panitera pengganti dan juru sita. Bila Smart Majelis sudah jalan, keputusan SIPP tetap yang berlaku.",
      "Ekstensi SIPP naik ke 1.91.0.",
    ],
    fixed: [
      "PHS berbunyi \"menunggu majelisnya ditentukan lebih dulu\" pada perkara yang majelisnya memang belum diusulkan Smart Majelis. Satu tabel SIPP yang belum diisi mematikan DUA penetapan sekaligus; keduanya kini terbuka dari satu perbaikan.",
      "Tombol Tulis ke SIPP pada Data Umum selalu ditolak jenis_tidak_didukung. Putus di dua tempat: rute portal tidak mendaftarkan jenisnya - dan mengecilkan hurufnya sehingga dataUmum menjadi dataumum yang tidak dikenali bot - sementara kedua rute tidak meneruskan muatannya sama sekali, sehingga seandainya lolos pun yang tertulis rencana kosong yang tetap dilaporkan berhasil.",
      "Uji dari ujung ke ujung tidak pernah dapat berjalan: medan login berganti nama tanpa specnya ikut, alamat ujinya berbeda asal dari alamat otentikasi, basis datanya memakai Postgres pengembangan yang kebetulan menyala, dan cetakan dalam memori yang dipulihkan berumur empat bulan. Kini memakai basis data terasing yang selalu bersih.",
    ],
    security: [],
    operationalNotes: [
      "Penetapan yang dituliskan ALETA tercatat atas nama PEJABAT, sementara nama operator yang menekan tombolnya tersimpan pada baris sys_audittrail. Itu satu-satunya yang membedakan jalur ini dari menandatangani atas nama orang lain - operatornya diambil dari sesi ALETA, tidak pernah dari peramban.",
      "Menulis berhenti pada kegagalan pertama, dan yang tidak dilanjutkan disebutkan. Urutan PMH, PPP, PJS, PHS tidak dapat dibalik: SIPP menolak PPP dan PJS selama majelisnya belum ada.",
      "Majelis yang hanya terbaca dua kursi DITOLAK, bukan ditulis sebagian - majelis cacat harus dibongkar dengan tangan dari beberapa tabel dan jejaknya tetap tinggal.",
    ],
    knownLimitations: [
      "Jalur tulis langsung belum pernah dijalankan atas perkara sungguhan. Jalankan sekali pada satu perkara, baca rencana keringnya sampai habis, lalu periksa hasilnya di SIPP sebelum memakainya untuk perkara lain.",
      "Usulan majelis dari ALETA memakai giliran, bukan rasio yang tersimpan pada ref_majelis_tetap. Kompetensi majelis juga belum menyaring - susunan yang diusulkan diambil dari yang benar-benar dipakai tahun ini, dan pada pengadilan yang majelisnya berkompetensi khusus itu belum tentu tepat.",
      "Penetapan yang sudah tertulis tidak dapat dibatalkan dari panel. Membetulkannya menuntut tangan, dari beberapa tabel sekaligus.",
    ],
  },
  {
    version: "2.14.0",
    title: "ALETA Judicia v2.14.0 - Lima Layar yang Rusak Diam-diam",
    date: "2026-09-10",
    status: "Operasional",
    summary:
      "Lima layar membaca BUNGKUS jawaban rutenya, bukan isinya - sehingga masing-masing gagal setiap kali, pada setiap perkara, tanpa satu pun error muncul. Dua di antaranya punya uji yang hijau: pemalsu fetch-nya memalsukan bentuk yang tidak pernah dikeluarkan server, sehingga uji dan kode sepakat atas dunia yang tidak ada.",
    added: [
      "Acc hakim atas Berita Acara Sidang - langkah yang ada di kenyataan tetapi tidak pernah ada di ALETA. Empat keadaan, dan acc BATAL sendiri begitu isinya diubah, supaya persetujuan hakim tidak melekat pada naskah yang tidak pernah dilihatnya.",
      "Rubrik penilaian perkara dapat disunting dari ALETA SIPP - bobot tiap butir, skala waktu, dan ambang predikat. Rutenya sudah lama ada di bot, tetapi tidak ada satu pun jalan dari portal menuju ke sana.",
      "Kosakata pemeriksa isi pesan dapat DITAMBAH dari ALETA Bot. Daftar bawaan tidak dapat dihapus - ia memuat frasa seperti kode otp dan segera transfer.",
      "Ketepatan waktu penginputan menjadi unsur penilaian: PMH, PPP, PJS, PHS, dan putusan. Yang dinilai penetapan PERTAMA; perubahan dan penetapan pengganti tidak ikut.",
      "Kotak Perlu diperiksa pada Jadwal Sidang - gabungan penanda merah saja, menjawab pertanyaan pertama tiap pagi dengan satu tekan.",
      "Titipan penetapan kedaluwarsa sendiri sesudah empat belas hari, ditandai dan bukan dihapus.",
      "Jejak perubahan ABT kini tersimpan di server, bukan hanya di peramban. Salinan peramban tetap yang menggerakkan Urungkan - ia lengkap, dan tetap bekerja ketika jaringan putus.",
      "Bab 1 katalog e-Audit selesai enam dari enam; keseluruhan naik dari delapan menjadi empat belas butir tersambung penuh.",
    ],
    changed: [
      "Kegagalan menghubungi ALETA dari ekstensi kini satu kalimat yang menyebut sebabnya DAN apa yang tetap jalan tanpa server - tema, panel, penjaga CETAK, sunting variabel ABT, pembersih keterangan saksi, dan CETAK rtf beserta anonimnya.",
      "Halaman Ekstensi SIPP menyebutkan apa yang dikerjakan ekstensi di halaman blangko ABT. Sebelumnya seluruh keterangannya hanya berbicara tentang SIPP.",
      "Ekstensi SIPP naik ke 1.90.0.",
    ],
    fixed: [
      "Status Perkara, Ruang Perkara, Isian Kelas B, Rujukan Pasal, dan Blangko Mandiri membaca bungkus jawaban rutenya. Tombol susun perintah putusan MENJATUHKAN seluruh layar Status Perkara; pencarian Ruang Perkara selalu tidak ketemu; Isian Kelas B selalu berbunyi tidak terbaca; tiap rujukan pasal tidak ditemukan padahal pustakanya menjawab benar; statistik dan daftar blangko Blangko Mandiri seluruhnya kosong.",
      "Alamat berkas e-Court digali dengan benar - pola lamanya terbukti TIDAK menemukan alamat yang jelas ada di dalam jawaban, karena garis miringnya tersandi. Inilah sebab berkas terdeteksi tetapi tidak terunduh.",
      "Papan ruang tunggu tidak lagi menuliskan jawaban ruang lama sesudah ruangnya berganti, dan satu sendatan jaringan tidak lagi mengosongkan papannya.",
      "Perlawanan kedua atas satu perkara tidak lagi terbaca acak - seluruh barisnya dibaca, terbaru dahulu, dan penandanya menyebut VERZET ke-2.",
      "Bunyi error ABT tidak lagi lolos sebagai keterangan dan ikut tercetak sebagai pertimbangan hukum.",
    ],
    security: [],
    operationalNotes: [
      "Dipasang sesudah server mati semalaman. Dua puluh dua commit sekaligus - bila ada yang berulah, bandingkan dengan daftar di atas sebelum menyimpulkan.",
      "Versi sebelumnya yang terpasang 2.13.1. APP_VERSION di sumber selama ini tertinggal di 2.6.1 sementara nomor paket sudah sampai 2.13.1 - keduanya disamakan mulai rilis ini, supaya yang tertulis di layar sama dengan yang benar-benar terpasang.",
      "Migrasi Drizzle TIDAK bertambah. Tabel jejak ABT dan kolom acc BAS ditambahkan lewat jalur idempoten di schema.ts, yang tidak mengklaim nomor migrasi apa pun.",
      "Ambang ketepatan penginputan ditandai KEBIJAKAN, bukan peraturan: dasar peraturannya belum diperiksa terhadap naskah resmi, dan angkanya ditetapkan tanpa melihat sebaran data nyata. Wajib ditinjau ulang sesudah pengukuran pertama.",
    ],
    knownLimitations: [
      "Tidak satu pun dari perbaikan ini teruji di layar sungguhan - server mati sepanjang malam pengerjaannya. Kelima layar yang diperbaiki perlu dibuka satu per satu.",
      "Perubahan rubrik penilaian berlaku SURUT: seluruh perkara dinilai memakai angka yang baru. Ubah sedikit dahulu, lihat akibatnya di Status Perkara, baru tetapkan.",
      "Acc BAS belum pernah dijalankan oleh hakim sungguhan. Yang paling perlu diuji: sunting satu jawaban sesudah di-acc, lalu pastikan accnya batal sendiri.",
      "Sembilan pasang fungsi panel masih kembar antara konten.js dan panel-alat.js. Keduanya benar tetapi berbeda cara, dan penyatuannya dikerjakan tersendiri supaya dapat dinilai sendiri.",
    ],
  },
  {
    version: "2.6.1",
    title: "ALETA Judicia v2.6.1 - Kegagalan Skema Tidak Lagi Bersembunyi",
    date: "2026-09-08",
    status: "Operasional",
    summary:
      "Penanda kuasa pada halaman daftar tidak pernah menyala - tabel yang ditanyakan tidak ada, dan gagalnya tertelan. Ini kegagalan KETIGA dengan bentuk yang persis sama dalam satu hari, jadi yang diperbaiki bukan hanya kuerinya melainkan cara kegagalannya dilaporkan.",
    added: [
      "Kegagalan skema pada pembacaan identitas kini dicatat dan ikut dipulangkan pada identitasGagal. Kosong berarti seluruh pembacaannya berhasil; berisi berarti ada tabel atau kolom yang tidak dikenali - dan penandanya diam BUKAN karena perkaranya bersih.",
    ],
    changed: [],
    fixed: [
      "perkara_kuasa tidak ada di SIPP ini - satu-satunya tabel kuasa adalah perkara_pengacara. Kuerinya gagal dan tertelan pembungkus aman(), sehingga penanda kuasa tidak pernah muncul.",
    ],
    security: [],
    operationalNotes: [
      "Tiga kegagalan dengan bentuk sama dalam satu hari: identitas.perkaraId (medan tidak ada), v_pihak_perkara.pekerjaan (kolom tidak ada), perkara_kuasa (tabel tidak ada). Ketiganya lolos karena pembungkus aman() menelan error skema, sehingga salah nama tidak dapat dibedakan dari tidak ada datanya. Ketiganya hanya ketahuan karena dibandingkan dengan sumber lain, bukan karena ada yang berbunyi.",
      "Pembungkusnya tetap gagal-terbuka - penanda yang keliru di halaman SIPP lebih merugikan daripada penanda yang absen. Yang berubah hanya: errornya sekarang terlihat.",
      "Diuji sesudah diperbaiki: gagal skema kosong, dan empat perkara uji menyala benar sementara empat perkara baru memang bersih.",
    ],
    knownLimitations: [],
  },
  {
    version: "2.6.0",
    title: "ALETA Judicia v2.6.0 - Identitas di Halaman Daftar dan Rasio Smart Majelis",
    date: "2026-09-08",
    status: "Operasional",
    summary:
      "Halaman DAFTAR PERKARA kini menandai prodeo, ghaib, kuasa, izin atasan, dan verzet - lima keadaan yang tidak ada di kolom mana pun. Pembagian beban hakim mengikuti rasio Smart Majelis milik SIPP sendiri, dan panitera pengganti mengikuti rasio yang ditetapkan pengadilan.",
    added: [
      "Penanda identitas pada halaman daftar: GHAIB, izin atasan, verzet, prodeo, dan kuasa. Dibaca sekali untuk seluruh lima puluh baris - lima kueri, bukan lima puluh.",
    ],
    changed: [
      "Rasio hakim dibaca dari ref_majelis_tetap.rasio - kolom yang dipakai Smart Majelis SIPP. Terbaca: dua hakim berasio 50, dua berasio 75, tiga berasio 100. Yang berasio 50 bagian perkaranya separuh.",
      "Rasio panitera pengganti diatur pengadilan: Sri Susilowati 50, yang lain 100 - perbandingan 1 : 2. SIPP tidak punya tempat menyimpannya, jadi tinggal di aturan penunjukan ALETA.",
      "Rasio masuk ke hitungan bagian semestinya, bukan ditempel sesudahnya. Orang berasio 50 menghitung sebagai setengah kepala, sehingga bagian yang lain otomatis naik tanpa angka kedua yang perlu disetel.",
    ],
    fixed: [
      "Penanda belum ditarik ALETA dibuang dari halaman daftar. Ia menempel pada hampir setiap baris dan mengabarkan keadaan ALETA, bukan keadaan perkaranya - petugas tidak dapat berbuat apa pun dengannya.",
      "PNS/TNI/Polri pada halaman daftar tidak pernah menyala: kuerinya membaca kolom pekerjaan dari v_pihak_perkara, dan kolom itu TIDAK ADA di sana. Gagalnya tertelan pembungkus aman(). Ketahuan karena dibandingkan dengan halaman detail - dua jalur yang membaca hal yang sama tidak boleh berselisih.",
    ],
    security: [],
    operationalNotes: [
      "Seluruh 106 baris ref_majelis_tetap ber-aktif = 0. Rasionya tetap dibaca - itu satu-satunya angka porsi yang pernah ditetapkan pengadilan ini, dan mengabaikannya berarti kembali menganggap seluruh hakim berporsi sama, yang justru diketahui tidak benar. Susunan majelisnya tetap tidak dipakai; hanya angka rasionya.",
      "Peta kolom formulir TETAP dipakai - 35 baris pada lima formulir termasuk data-umum. Ia yang mengenali formulir SIPP mana yang sedang terbuka dan kolom mana yang diisi. Baru dapat dihapus bila jalur tulis langsung sepenuhnya menggantikan pengisian blangko.",
    ],
    knownLimitations: [
      "Rasio hakim dibaca dari baris yang tidak aktif. Bila pengadilan menyetel ulang Smart Majelis dan mengaktifkan barisnya, angka yang terbaca berubah mengikuti - dan itu memang yang dikehendaki.",
      "Rasio panitera dicocokkan menurut nama dengan awalan, sebab tabelnya menuliskan gelar. Nama yang berubah ejaannya harus diperbarui di aturan.",
    ],
  },
  {
    version: "2.5.1",
    title: "ALETA Judicia v2.5.1 - Penanda Benar-benar Sampai ke Halaman SIPP",
    date: "2026-09-08",
    status: "Operasional",
    summary:
      "Seluruh penanda baru v2.5.0 tidak pernah sampai ke halaman SIPP - penjaganya membaca medan yang tidak ada, sehingga keduanya selalu dilewati tanpa satu pun error. Tertangkap saat diperiksa di server sesudah dipasang.",
    added: [],
    changed: [],
    fixed: [
      "perkara_id dicari sendiri dari nomor perkara. Sebelumnya diambil dari identitas.perkaraId - medan yang TIDAK ADA: identitasPerkara memulangkan nomor perkara, jenis, kumulasi, dan kuasa, tanpa id-nya. Akibatnya penjaganya selalu salah, penanda ghaib dan kesembilan penanda baru selalu dilewati, dan panel tampak baik-baik saja dengan seluruh penanda mati.",
    ],
    security: [],
    operationalNotes: [
      "Persis jenis kegagalan yang penanda ini ada untuk mencegahnya - benar tetapi diam - dan ia hampir lolos. Tertangkap karena diperiksa di server sesudah dipasang, bukan karena ada yang berbunyi.",
      "Terbukti menyala sesudah diperbaiki: 399/Pdt.G/2026 izin atasan, 232/Pdt.G/2026 panjar menipis Rp42.000, 715/Pdt.G/2025 verzet, 0321/Pdt.G/2015 prodeo.",
    ],
    knownLimitations: [],
  },
  {
    version: "2.5.0",
    title: "ALETA Judicia v2.5.0 - Sembilan Penanda SIPP, Bobot Perkara, dan Data Umum",
    date: "2026-09-08",
    status: "Operasional",
    summary:
      "Ekstensi SIPP dirombak: Kerjakan naik ke paling atas, panel dapat digulung dan diciutkan jadi logo, penanda halaman diganti dari hitungan yang mengulang panel menjadi sembilan keadaan yang benar-benar mengubah pekerjaan. Pembagian perkara kini berbobot menurut jenisnya. Data Umum dari berkas gugatan dapat diisikan langsung ke SIPP.",
    added: [
      "Sembilan penanda baru di halaman SIPP: panjar habis atau menipis, akta cerai belum terbit padahal sudah BHT, verzet, perkara berjalan lebih dari lima bulan, mediasi belum dimulai, prodeo, delegasi masuk belum dikirim balik, rekonvensi, dan berkas upaya hukum belum dikirim.",
      "Penanda pihak ghaib, izin atasan PNS/TNI/Polri, dan dugaan mafqud - ketiganya disimpan SIPP tetapi tidak pernah ditampilkan di halaman detail.",
      "Data Umum dari berkas gugatan dapat dituliskan ke SIPP: tanggal dan nomor surat, tanggal menikah, kutipan akta nikah, dan KUA tempat menikah. Kering lebih dahulu, selalu.",
      "Panel ekstensi: layar penuh, ciut menjadi logo melayang, akun SIPP yang sedang masuk di kepala, dan tombol kembalikan posisi dari popup ikon Chrome.",
      "PHS: beban hari sidang per tanggal dan pemilih tanggal bebas yang tetap berpagar aturan.",
    ],
    changed: [
      "Pembagian perkara berbobot menurut jenisnya: 1,0 perceraian dan itsbat, 1,5 selain keduanya, 2,0 kebendaan. Dikunci pada jenis_perkara_id, bukan nama - id 360 muncul dengan dua nama di basis data ini.",
      "Perkara ekonomi syariah hanya diusulkan kepada hakim bersertifikat. Sejauh ini satu orang, kode C1.",
      "Kelompok Kerjakan naik ke paling atas dan menjadi satu-satunya yang terbuka.",
      "Tema terang mengembalikan halaman SIPP apa adanya; lapisan tema hanya dipasang pada tema gelap. Warna terang panel diturunkan dari putih murni ke #f4f6f4.",
    ],
    fixed: [
      "Panel yang baru muncul tidak dapat digulung. Tingginya dijepit terhadap seluruh tinggi jendela sedangkan posisinya dipasang menyusul, sehingga panel berujung di bawah tepi layar - dan yang meluap adalah panelnya, bukan isinya.",
      "Petugas yang akun SIPP-nya diblokir tetap diusulkan. Empat dari sebelas panitera aktif berkeadaan begitu.",
      "Bagian Penetapan yang dapat Anda tetapkan dibuang - dasarnya gugur sejak ALETA menuliskan penetapan atas nama pejabatnya.",
    ],
    security: [],
    operationalNotes: [
      "TEMUAN: kolom perkara_biaya.sisa tidak pernah diisi SIPP - 32% NULL, 68% nol. Membacanya begitu saja menghasilkan penanda panjar habis pada SETIAP perkara. Saldonya dijumlahkan sendiri dari transaksinya; sesudah dibetulkan, dari 104 perkara belum putus hanya 19 yang menyala.",
      "TEMUAN: SIPP tidak pernah mengaudit perkara_data_pernikahan - nol baris sepanjang masa. ALETA tetap menuliskan baris auditnya, dan itu penyimpangan yang disengaja: seluruh dasar jalur tulis ini adalah dapat ditelusuri.",
      "Data Umum tidak menimpa yang sudah terisi. Tiap ruas hanya diisi bila di SIPP masih kosong, dan yang dilewati disebutkan - sehingga jelas bedanya tidak diisikan dari gagal diisikan.",
      "Penanda nomor pihak dimatikan atas permintaan pengadilan. Alur verifikasinya masih hidup dan masih dipakai bot memutuskan pengiriman WhatsApp.",
    ],
    knownLimitations: [
      "Objek sengketa berupa tanah TIDAK dapat ditandai - SIPP tidak menyimpannya di mana pun. Ditelusuri pada seluruh information_schema; yang ada hanya kolom sita eksekusi dan juru sita delegasi.",
      "kode_kua tidak ikut diisikan. Ia pengenal acuan yang tidak dapat diturunkan dari nama KUA pada berkas gugatan.",
      "Pembobotan perkara belum mengubah urutan beban siapa pun hari ini - perkara berat memang jarang, 6% dari seluruhnya. Yang diperbaiki asasnya.",
      "Nama pihak, alamat, pekerjaan, dan obyek sengketa tidak ikut diisikan ke SIPP. Para pihak punya tabelnya sendiri beserta aturan kumulasi dan kuasa hukumnya.",
    ],
  },
  {
    version: "2.4.0",
    title: "ALETA Judicia v2.4.0 - Ruang Sidang Dikenali Layanan Skema",
    date: "2026-09-08",
    status: "Operasional",
    summary:
      "Cacat kedua yang ditemukan hasil kering: penetapan hari sidang ditolak dengan alasan ruang sidangnya tidak ketemu, padahal tabelnya ada dan berisi tiga belas ruang aktif. Sebabnya tabel itu tidak pernah didaftarkan pada layanan skema.",
    added: [],
    changed: [],
    fixed: [
      "ruangan_sidang tidak tercantum pada daftar tabel yang dikenali sippSkemaService. Daftar itu satu-satunya sumber jawaban tabelAda(), dan tabel yang tidak tercantum SELALU dijawab tidak ada - tanpa error, tanpa peringatan. Akibatnya seluruh penetapan hari sidang lewat ALETA akan ditolak, dan pesannya menyesatkan: ia menyalahkan ruangnya, bukan daftarnya.",
    ],
    security: [],
    operationalNotes: [
      "Cacat ini pun tertangkap hasil kering pada perkara sungguhan, bukan pada uji satuan - uji satuannya memalsukan layanan skema, jadi memang tidak mungkin menangkapnya. Dua cacat dari dua kali menjalankan kering, dan keduanya tidak menimbulkan error apa pun.",
      "Penjaga baru: tiap tabel pada daftar putih jalur tulis WAJIB tercantum pada daftar layanan skema. Menambah tabel ke jalur tulis tanpa mendaftarkannya kini tertangkap uji, bukan di hadapan petugas yang sedang menetapkan perkara.",
      "59 pemeriksaan jalur tulis lulus.",
    ],
    knownLimitations: [
      "Tombol Kerjakan pada ekstensi masih BELUM disambungkan ke jalur tulis.",
    ],
  },
  {
    version: "2.3.0",
    title: "ALETA Judicia v2.3.0 - Jam Penetapan Diambil dari Basis Data",
    date: "2026-09-08",
    status: "Operasional",
    summary:
      "Hasil kering pertama atas perkara sungguhan langsung menemukan cacatnya: pernyataan bertanggal 04:54 sedangkan jam dinding pengadilan 12:54 - selisih delapan jam, persis jarak WITA ke UTC. Jam penetapan kini ditanyakan kepada basis data, jam yang sama yang dipakai SIPP sendiri.",
    added: [],
    changed: [],
    fixed: [
      "Seluruh diinput_tanggal dan seluruh baris sys_audittrail akan tercatat delapan jam sebelum kejadiannya. Container bot MEMANG memuat /etc/localtime dan `date` di dalamnya menjawab WITA dengan benar - tetapi Node tidak membaca berkas itu bila env TZ tidak diset, dan jatuh ke UTC tanpa satu pun error. Jamnya kini diambil lewat NOW() pada basis datanya.",
    ],
    security: [],
    operationalNotes: [
      "Inilah gunanya jalur tulis dijalankan KERING lebih dahulu. Cacat ini tidak menimbulkan error apa pun; ia hanya akan menuliskan jam yang salah ke berkas perkara, berselisih dengan baris SIPP di tabel yang sama, dan tidak ada yang menyadarinya sampai seseorang membandingkan dua baris berdampingan.",
      "Menyetel env TZ pada container juga membetulkannya, tetapi hanya sampai seseorang menyalin compose-nya ke mesin lain dan lupa membawanya. Menanyakan jam kepada basis data tidak dapat tertinggal.",
      "47 pemeriksaan jalur tulis lulus, termasuk penjaga baru yang memastikan jamnya memang ditanyakan lewat NOW().",
    ],
    knownLimitations: [
      "Tombol Kerjakan pada ekstensi masih BELUM disambungkan ke jalur tulis. Yang terpasang mesinnya beserta rutenya, dan hasil keringnya sudah diperiksa pada perkara sungguhan.",
    ],
  },
  {
    version: "2.2.0",
    title: "ALETA Judicia v2.2.0 - Penetapan Ditulis ke SIPP atas Nama Pejabatnya",
    date: "2026-09-08",
    status: "Operasional",
    summary:
      "ALETA kini dapat menuliskan penetapan PMH, PPP, PJS, dan PHS langsung ke SIPP, tercatat atas nama pejabatnya sedangkan operator yang menekan tombolnya - keputusan pimpinan pengadilan. Jalurnya KERING sebagai bawaan: tidak menulis apa pun kecuali diminta tegas.",
    added: [
      "Layanan penetapanTulisService - satu-satunya berkas di ALETA yang menulis ke SIPP. Bentuk tulisannya ditiru dari tulisan SIPP sendiri, dibaca dari basis datanya: majelis_hakim_id dipisah koma, kode dipisah garis tegak, nama dan text dipisah </br>, jabatan_hakim_id 1 untuk ketua dan 2 untuk anggota.",
      "PHS ikut ditulis - empat tabel sekaligus, dan satu di antaranya menunggu id baris jadwal sidang yang baru disisipkan. Langkah yang menunggu id itu BERHENTI bila id-nya tidak ada, bukan menulis kosong.",
      "Rute POST /api/aleta-bot/penunjukan/tulis pada portal dan /internal/aleta-bot/penetapan/tulis pada bot.",
      "Kotak 'Akan tercatat di SIPP atas nama' tepat di atas tombol Kerjakan, memuat nama dan akun untuk keempat penetapan.",
    ],
    changed: [],
    fixed: [],
    security: [
      "Nama operator DIAMBIL DARI SESI ALETA, bukan dari badan permintaan. Satu-satunya catatan yang menyimpan siapa sebenarnya menekan tombolnya adalah judul baris sys_audittrail; kalau nama itu boleh dikirim peramban, jalur ini kehilangan satu-satunya hal yang membedakannya dari memalsukan tanda tangan.",
      "Nama, NIP, kode petugas, dan sifat ruang sidang dibaca ulang dari SIPP di dalam layanan. Peramban hanya mengirim PILIHAN - nomor baris - sehingga tidak ada cara menuliskan NIP siapa pun ke berkas perkara.",
      "Daftar putih tabel, diperiksa dua kali: saat rencana disusun dan saat dijalankan.",
      "Akun pejabat harus benar-benar ada di sys_users. Nama yang salah ketik akan tercatat atas nama yang tidak ada - lebih buruk daripada tercatat atas nama operator, sebab tidak ada yang dapat dimintai keterangan.",
    ],
    operationalNotes: [
      "KERING SEBAGAI BAWAAN, di ketiga lapisnya - layanan, rute bot, dan rute portal. Menulis menuntut kering: false yang tegas. Hasil kering memulangkan pernyataan lengkap beserta nilainya untuk dibaca manusia lebih dulu.",
      "Tiap baris audit yang ditulis ALETA berawalan [ALETA] dan menyebut nama operatornya. Dengan begitu tulisan ALETA selalu dapat dibedakan dari tulisan SIPP, selalu dapat dihitung, dan selalu dapat ditelusuri balik bila kelak dipersoalkan.",
      "Penetapan yang sudah ada tidak ditimpa diam-diam - keempat jenisnya menolak bila tanggalnya sudah terisi. PHS juga menolak selama PMH belum ada, sebab hari sidang ditetapkan ketua majelis.",
      "46 pemeriksaan jalur tulis lulus, seluruhnya tanpa menyentuh SIPP - db_config digantikan tiruan yang merekam pernyataan tanpa menjalankannya.",
    ],
    knownLimitations: [
      "Sambungan bot ke SIPP memakai akun root dengan ALL PRIVILEGES. Tidak ada satu pun penjagaan di lapisan basis data; yang menahan hanya kode. Sebaiknya dibuatkan akun MySQL tersendiri yang hanya boleh menyentuh keenam tabel pada daftar putih.",
      "Tidak ada transaksi. Kolam koneksi mysql memberi sambungan berbeda tiap pernyataan, sehingga BEGIN di satu sambungan tidak melindungi pernyataan di sambungan lain. Yang dilakukan sebagai gantinya berhenti pada kegagalan pertama, lalu melaporkan persis berapa langkah yang telanjur berhasil.",
      "SIPP adalah aplikasi pihak ketiga. Bentuk tulisan ini ditiru dari basis datanya, bukan dari kodenya - pembaruan SIPP dapat mengubahnya tanpa memberi tahu siapa pun.",
      "Tombol Kerjakan pada ekstensi BELUM disambungkan ke rute ini. Yang terpasang baru mesinnya beserta rutenya, supaya hasil keringnya dapat diperiksa pada perkara sungguhan lebih dahulu.",
    ],
  },
  {
    version: "2.1.0",
    title: "ALETA Judicia v2.1.0 - Antrian Sidang: Hasil, Suara, dan Kolom yang Disatukan",
    date: "2026-09-08",
    status: "Operasional",
    summary:
      "Jadwal sidang hari ini kini memuat ulang dirinya sendiri, hasil sidang tampil hijau di sebelah tundaan, tiga kolom disatukan menjadi satu, dan papan panggil mendapat panggilan petugas beserta suara bahasa Indonesia yang dapat dipilih.",
    added: [
      "Kotak HASIL SIDANG berwarna hijau, sebidang dengan kotak tundaan yang kuning. Keduanya membaca kolom SIPP yang sama - alasan_ditunda - dan yang memisahkannya bendera ditunda milik SIPP sendiri, bukan tebakan atas isi tulisannya.",
      "Panggilan pengeras suara untuk majelis/PP, juru sita, rohaniwan, petugas mediasi, petugas persidangan, saksi menurut namanya, dan pengulangan nomor yang sedang dipanggil - meniru aplikasi antrian SIPP.",
      "Pemilih suara bahasa Indonesia pada papan panggil DAN pada layar ruang tunggu, beserta tombol coba suara. Pilihannya diingat per peramban.",
    ],
    changed: [
      "Jadwal sidang HARI INI memuat ulang sendiri tiap 45 detik - hanya hari ini, hanya saat tabnya terlihat, dan dilewati bila permintaan sebelumnya belum selesai.",
      "Kolom Majelis, Petugas Sidang, dan Ruang disatukan menjadi satu kolom Majelis & Petugas. Ketiganya menjawab pertanyaan yang sama - siapa yang menyidangkan, dan di mana - dan memisahkannya justru memakan tempat: nama panitera membungkus menjadi empat baris, dan seluruh baris tabel ikut meninggi.",
      "Kolom Putusan menyebut PUTUSAN BELUM TERCATAT bila hasil sidang menyatakan perkara sudah diputus sedangkan data putusannya belum diisi di SIPP.",
      "Panggilan suara di layar ruang tunggu memakai modul yang sama dengan papan panggil. Dua layar yang memanggil dengan suara berbeda terdengar seperti dua sistem.",
    ],
    fixed: [
      "Tundaan yang diketik panitera di tengah hari tidak pernah sampai ke layar yang sudah terbuka. Terbukti 8 September 2026: perkara 530/Pdt.G/2026 ditandai ditunda di SIPP pukul 11:00:28, sedangkan layar ALETA yang terbuka sejak pagi masih menampilkannya belum ditunda - dan layar yang basi tampak persis seperti layar yang benar.",
    ],
    security: [],
    operationalNotes: [
      "Panggilan petugas HANYA bersuara. Nomor antriannya tidak bergerak dan tidak ada yang tercatat sebagai sudah dipanggil - sama seperti aplikasi antrian SIPP. Kalau panggilan petugas ikut menandai antrian, satu panggilan kepada rohaniwan akan menggeser nomor yang sedang menunggu, dan pihak yang belum dipanggil terlewat tanpa jejak.",
      "Suara nomor antrian hanya berbunyi bila panggilannya BERHASIL tercatat. Suara atas panggilan yang gagal membuat petugas mengira nomornya sudah bergerak lalu meneruskan ke nomor berikutnya.",
      "Yang memisahkan hasil sidang dari agenda tundaan diukur pada 20.063 baris jadwal sidang: ditunda=T 3.909 menyebut putus dan 7.395 lainnya (6.207 di antaranya berisi angka 0 belaka); ditunda=Y 124 menyebut putus, termasuk 58 Pembacaan Putusan dan 21 Musyawarah Majelis dan Pembacaan Putusan - yang seluruhnya AGENDA, bukan hasil.",
      "Putusan yang belum tercatat bukan keadaan langka: pada 8 September 2026, dari enam perkara yang hasil sidangnya menyebut putus, EMPAT belum punya baris putusan di SIPP.",
    ],
    knownLimitations: [
      "Suara memakai pengucap bawaan peramban. Perangkat yang belum punya paket suara bahasa Indonesia akan mengucapkan angka dengan janggal - layarnya menyebutkan hal itu apa adanya, dan paketnya harus dipasang di sistem operasinya.",
      "Panggilan petugas tidak tercatat di mana pun, sehingga tidak dapat dijawab berapa kali rohaniwan dipanggil hari itu. Mencatatnya menuntut tabel tersendiri - bukan kolom antrian, yang sudah punya artinya sendiri.",
      "Hasil sidang dikenali dari kata putus. Panitera yang menuliskan hasil tanpa kata itu tidak akan tampil hijau - menebak lebih jauh akan salah pada 7.395 baris yang berisi agenda.",
      "Layar barunya belum dilihat langsung di peramban - tidak ada server uji yang berjalan.",
    ],
  },
  {
    version: "2.0.0",
    title: "ALETA Judicia v2.0.0 - Arsip Dapat Diunduh, Empat Tombol Mati Dihidupkan",
    date: "2026-09-08",
    status: "Operasional",
    summary:
      "Berkas pindaian arsip perkara kini dapat diunduh dari layar Status Perkara - 4.128 berkas sebesar 32 GB yang selama ini ada tetapi tidak pernah terjangkau. Sekaligus menghidupkan empat tombol unduh yang selama ini menghasilkan penolakan tanpa ada yang menyadarinya: penetapan, petitum, arsip, dan ikrar talak.",
    added: [
      "Layanan arsipBerkasService - menyusun jalur berkas pindaian dari letak fisiknya, lalu bila tidak ketemu di sana menelusuri nama berkasnya di seluruh folder arsip. Indeks namanya disimpan sepuluh menit, sebab petugas arsip memindai berkas baru setiap hari dan indeks yang basi akan menyatakan berkas yang baru diunggah belum ada.",
      "Tombol unduh arsip beserta besar berkas dan tanggalnya pada layar Status Perkara. Besarnya disebutkan sebab arsip perkara berkisar 2 MB sampai 28 MB - selisih yang menentukan apakah seseorang mengunduhnya sekarang atau menunggu.",
    ],
    changed: [
      "Ada atau tidaknya berkas pindaian kini dijawab berkas sistem, bukan basis data. Sebelumnya dibaca dari kolom arsip yang TIDAK ADA pada SIPP, sehingga jawabannya selalu 'tidak ada' untuk seluruh perkara.",
      "Daftar jenis berkas yang boleh diunduh kini SATU, dipakai bersama gerbang bot dan layanannya. Sebelumnya ada tiga daftar terpisah dan hanya dua yang diperbarui.",
    ],
    fixed: [
      "Empat tombol unduh mati diam-diam. Diuji pada server sebelum diperbaiki: jenis penetapan, arsip, dan petitum sama-sama memulangkan 400 jenis_tidak_dikenali, padahal kodenya sudah lama ada dan tombolnya sudah lama terpasang. Kegagalan macam ini tidak berbunyi di mana pun - tombolnya tampil, diklik, dan yang terunduh justru berkas JSON berisi penolakan.",
      "Keterangan pada layar arsip yang menyatakan 'arsip SIPP bukan tempat berkas digital, sehingga tidak ada yang dapat diunduh dari bagian ini'. Kesimpulan itu diambil dari benarnya satu hal - tabel arsip memang tidak punya kolom dokumen - tetapi salah pada hal berikutnya: berkasnya ada, hanya catatannya yang tidak.",
    ],
    security: [],
    operationalNotes: [
      "Jalur berkas tetap TIDAK PERNAH datang dari peramban. Yang dikirim hanya nomor baris arsipnya; jalurnya disusun di bot dari isi basis data, lalu dilewatkan penyaring ekstensi dan akar folder yang sudah ada. Keping letak yang membawa pemisah jalur atau titik-titik ditolak sebelum jalurnya tersusun.",
      "Berkas yang ketemu di luar letak yang tercatat tetap dapat diunduh, TETAPI disebutkan letak sebenarnya. Menemukannya diam-diam berarti membiarkan letak arsipnya selamanya keliru; 307 berkas berkeadaan begitu, umumnya karena lemarinya dinomori ulang sesudah berkasnya dipindai.",
      "Akses ke SIPP tetap baca-saja. Container aleta-bot sudah lama memuat /var/www/html/SIPP secara read-only, jadi tidak ada mount baru maupun perubahan hak akses.",
    ],
    knownLimitations: [
      "Ada atau tidaknya berkas pindaian TIDAK memengaruhi nilai SK Tabel 2 I.16. Yang dinilai SK di sana jeda penginputan datanya, bukan pindaiannya. Menjadikannya pengurang nilai berarti menilai pengadilan dengan aturan yang tidak ada dalam SK - bila kelak dikehendaki, yang diperlukan lebih dahulu dasar hukumnya, bukan kodenya.",
      "1.041 baris arsip dari 4.863 memang belum ada berkas pindaiannya, dan 991 di antaranya perkara 2018 sampai 2021. Layarnya menyebutkannya apa adanya, bukan menyembunyikannya.",
      "Jenis ikrar-talak ikut dihidupkan pada daftar, tetapi berkasnya bergantung kolom yang belum tentu ada pada SIPP versi ini - bila tidak ada, hasilnya 404 berkas tidak tercatat, bukan lagi 400 jenis tidak dikenali.",
      "Layar arsip yang baru belum dilihat langsung di peramban - tidak ada server uji yang berjalan.",
    ],
  },
  {
    version: "1.99.0",
    title: "ALETA Judicia v1.99.0 - Sembilan Penjaga Urutan",
    date: "2026-09-08",
    status: "Operasional",
    summary:
      "Penjaga urutan terbalik kini dipasang di SEMBILAN unsur SK 048/2024, tidak lagi sebagian - jeda penginputan diperlakukan sama dengan tanggal peristiwanya. Selain itu berkas arsip SIPP ditelusuri sampai ketemu: 4.128 PDF sebesar 32 GB, dan jalurnya ternyata TIDAK tersimpan di basis data melainkan disusun dari letak fisiknya.",
    added: [],
    changed: [
      "Lima unsur jeda penginputan (I.1, I.3, I.5, I.7, I.9) kini memakai penjaga yang sama dengan tanggal peristiwanya: dokumen yang tercatat diinput SEBELUM peristiwanya tidak dinilai, bukan bernilai sempurna. Sebelumnya hanya lima unsur tanggal peristiwa yang berpenjaga, sehingga selisih negatif yang sama diperlakukan berbeda di layar yang sama.",
    ],
    fixed: [],
    security: [],
    operationalNotes: [
      "Yang terkena sedikit, dan itu memang tujuannya. Diukur pada 9.834 perkara dengan tanggal peristiwa yang sudah dibetulkan v1.98.0: input pendaftaran 21 perkara negatif, input PHS 1 perkara, input PMH dan penunjukan PP serta juru sita nol. Sebelum tanggal PMH dibetulkan jumlahnya jauh lebih besar - perbaikan itulah yang menghabiskan sebagian besarnya.",
      "TEMUAN ARSIP - berkas PDF arsip ada di /var/www/html/SIPP/dokumen_arsip, disusun ruang/lemari/rak/berkas, 4.128 berkas sebesar 32 GB. Nama berkasnya Arsip_<nomor perkara dengan titik dan garis miring diganti garis bawah>.pdf. Container aleta-bot SUDAH memuatnya baca-saja di /usr/src/app/SIPP, jadi ALETA dapat menyajikannya tanpa mount baru.",
      "TEMUAN ARSIP - tabel arsip SIPP TIDAK menyimpan nama berkas sama sekali. Jalurnya disusun dari empat kolom letak fisik ditambah nomor perkara. Akibatnya: menyunting letak arsip di SIPP membuat berkas lamanya terlantar di jalur lama, dan pencarian yang hanya mengandalkan jalur susunan akan menyatakannya hilang padahal ada.",
      "TEMUAN ARSIP - cakupannya: 4.863 baris arsip, 3.822 di antaranya berkasnya ada (78,6%), 1.041 tidak ada, dan 307 berkas ada di disk tanpa baris yang menunjuknya. Yang tidak ada hampir seluruhnya perkara lama - 2018 sampai 2021 sebanyak 991 dari 1.041; tahun 2024 hanya 5, 2025 hanya 10, dan 2026 hanya 1.",
    ],
    knownLimitations: [
      "Penilaian arsip (SK Tabel 2 I.16) masih mengukur JEDA PENGINPUTAN DATA saja, belum keberadaan berkas pindaiannya. Perkara yang datanya diinput tepat waktu tetapi berkasnya tidak pernah diunggah tetap bernilai sempurna.",
      "ALETA belum menyajikan unduhan arsip. Berkasnya terbaca oleh container bot, tetapi belum ada jalur maupun layarnya.",
      "Baris yang berkasnya terlantar karena letaknya disunting - 307 berkas - baru dapat ditemukan bila pencarian berkas juga menelusuri nama berkasnya, bukan hanya jalur susunannya. Contoh terbukti: 1/Pdt.G/2022 tersimpan di lemari 1 pada disk sedangkan basis data kini menyebut lemari X.",
      "Satu baris arsip nomor perkaranya tertulis PA.dgl, bukan PA.Dgl. Pada berkas sistem yang membedakan huruf besar-kecil, perbedaan itu sendiri sudah cukup membuat berkasnya tidak ketemu.",
    ],
  },
  {
    version: "1.98.0",
    title: "ALETA Judicia v1.98.0 - PMH Pertama yang Dinilai, Riwayat Dihitung Ulang",
    date: "2026-09-08",
    status: "Operasional",
    summary:
      "Penetapan majelis hakim kini juga dinilai dari PENETAPAN PERTAMA, bukan penetapan kembali - 996 perkara terkena. Ini yang terbesar akibatnya sebab PMH adalah acuan bagi penunjukan PP, juru sita, dan PHS: satu tanggal PMH yang keliru menjatuhkan empat unsur sekaligus. Riwayat dihitung ulang atas seluruh 9.834 perkara. Sidebar ALETA e-Court kini menempel saat halaman digulung.",
    added: [
      "Skrip hitung ulang aleta_bot/scripts/hitung-ulang-penunjukan.js - membaca tanggal dari SIPP tanpa menulis apa pun, lalu menjalankan mesin nilai yang sama dengan yang dipakai layar atas tanggal lama dan tanggal baru, dan melaporkan selisihnya per tahun. Dapat dijalankan lagi kapan pun aturannya berubah.",
    ],
    changed: [
      "Tanggal penetapan majelis hakim dibaca dari perkara_hakim_pn - tabel yang menyimpan satu baris per hakim beserta tanggal penetapannya sendiri - dan yang dipakai tanggal TERAWAL. Sebelumnya dari perkara_penetapan, yang hanya punya satu baris per perkara sehingga penetapan kembali menimpanya.",
      "Sidebar ALETA e-Court menempel di 16px dari tepi atas dan bertahan di sana selama halaman digulung, serta menggulung di dalam dirinya sendiri bila lebih tinggi dari layar. Hanya pada layar lebar - di layar sempit sidebar berada di atas isinya, dan menempelkannya akan menutupi yang sedang dibaca.",
    ],
    fixed: [
      "Mutasi hakim menetapkan kembali seluruh majelis sekaligus, dan tanggal penetapan kembali itu menimpa tanggal PMH yang asli. Contoh perkara 399/Pdt.G/2026/PA.Dgl: daftar 7 Juli 2026, majelis pertama 7 Juli 2026, majelis pengganti 4 Agustus 2026 - dan yang tersimpan 4 Agustus. Akibatnya penetapan majelisnya bernilai 0 dari 5, sedangkan penunjukan PP, juru sita, dan PHS - yang sungguh dikerjakan pada hari pendaftaran - tampak dikerjakan 28 hari SEBELUM acuannya.",
      "PMH yang mendahului pendaftaran dan PHS yang mendahului PMH kini tidak dinilai, bukan bernilai sempurna. Tangga penilaian memulangkan poin tertinggi untuk selisih negatif, sehingga 'PHS -28 hari setelah PMH' selama ini bernilai 5 dari 5. Penjaganya kini sama di keempat unsur.",
    ],
    security: [],
    operationalNotes: [
      "HASIL HITUNG ULANG atas 9.834 perkara - penetapan majelis: 995 perkara nilainya berubah, SELURUHNYA naik, tidak satu pun turun; poin 37.510 menjadi 42.109. Penunjukan PP: 1.277 berubah, 911 di antaranya dari tidak-dinilai menjadi dinilai; 40.416 menjadi 46.411. Juru sita: 1.035 berubah, 988 pulih dari tidak-dinilai; 41.506 menjadi 46.405. PHS: 994 berubah, 992 pulih; 39.595 menjadi 43.892. Empat unsur bersama: 159.027 menjadi 178.817.",
      "Urutan yang tidak mungkin runtuh begitu tanggalnya dibetulkan. PHS mendahului PMH: 999 perkara menjadi 7. PP mendahului PMH: 918 menjadi 8. Juru sita mendahului PMH: 996 menjadi 8. Sisa yang belasan itu kekeliruan data yang sesungguhnya, dan memang tidak dinilai sampai dibetulkan.",
      "Perubahannya menyebar di seluruh tahun pendaftaran 2015 sampai 2026, terbanyak 2020 (209 perkara) dan 2026 (115) - jadi ini bukan sekadar warisan data lama, melainkan keadaan yang masih berjalan sampai sekarang.",
      "Tidak ada migrasi basis data yang diperlukan. Diperiksa di server: tabel aleta_bot_nilai_riwayat - satu-satunya tempat nilai periode disimpan - belum ada, sebab penulisannya belum pernah dipanggil dari mana pun kecuali skrip ujinya. Seluruh nilai yang tampil dihitung saat layar dibuka, sehingga perbaikan ini langsung berlaku atas seluruh riwayat.",
    ],
    knownLimitations: [
      "Satu perkara dari 9.834 penetapan pertamanya mendahului pendaftarannya, dan satu perkara tidak punya satu pun baris di perkara_hakim_pn. Yang pertama tidak dinilai, yang kedua tetap memakai tanggal lama dari perkara_penetapan.",
      "Jeda penginputan (unsur I.3, I.5, I.7, I.9) belum diberi penjaga urutan terbalik. Diinput sebelum peristiwanya pun masih bernilai sempurna. Setelah tanggal PMH dibetulkan keadaan itu hampir hilang dengan sendirinya, tetapi penjaganya belum dipasang - dan itu keputusan tersendiri yang belum diambil.",
      "Keterangan pada v1.97.0 yang menyebut nilai tersimpan tidak dihitung ulang TIDAK berlaku - sesudah diperiksa, tidak ada nilai tersimpan sama sekali. Catatan versi lama sengaja tidak diubah agar riwayatnya tetap utuh.",
      "MS03 Riwayat Nilai Tersimpan masih berupa mesin yang belum tersambung. Selama belum tersambung, nilai laporan bulan lalu ikut berubah bila data lampaunya disunting - dan perubahan itu tidak meninggalkan jejak.",
      "Tata letak sidebar yang menempel belum dilihat langsung di peramban - tidak ada server uji yang berjalan. Yang dijaga baru kelasnya, melalui uji sumber.",
    ],
  },
  {
    version: "1.97.0",
    title: "ALETA Judicia v1.97.0 - Penunjukan Pertama yang Dinilai",
    date: "2026-09-08",
    status: "Operasional",
    summary:
      "Penilaian SK Dirjen 048/2024 untuk penunjukan panitera pengganti dan juru sita selama ini mengukur jarak ke PENGGANTIANNYA, bukan ke penunjukan pertama - sebab tabel penetapan SIPP hanya punya satu baris per perkara dan penggantian menimpa tanggalnya. Terkena 440 perkara panitera pengganti dan 52 juru sita.",
    added: [],
    changed: [
      "Tanggal penunjukan panitera pengganti dan juru sita dibaca dari tabel petugasnya - perkara_panitera_pn dan perkara_jurusita - yang menyimpan satu baris per orang beserta tanggal penetapannya sendiri. Yang dipakai tanggal terawal.",
      "Tiap tahapan kini menyebut dari mana tanggalnya diambil, sehingga nilainya dapat diperiksa sendiri oleh yang membacanya.",
    ],
    fixed: [
      "Penilaian penunjukan menghitung jarak dari PMH ke penggantian yang terjadi berbulan-bulan kemudian, lalu memberi nilai nol atas pekerjaan yang sebenarnya dikerjakan pada hari yang sama. Contoh perkara 376: penunjukan pertama 3 Desember 2015, yang tersimpan 23 Agustus 2016.",
      "Selisih negatif bernilai SEMPURNA. Tangga penilaian memulangkan poin tertinggi untuk syarat kurang dari atau sama dengan nol, sehingga penunjukan yang tercatat mendahului penetapan majelisnya mendapat nilai lima - sama dengan yang dikerjakan pada hari yang sama.",
    ],
    security: [],
    operationalNotes: [
      "Urutan yang terbalik tidak dinilai sama sekali, dan tidak pula dihitung nol. Nol menuduh pengadilan atas keadaan yang belum tentu kesalahannya - dapat saja tanggal PMH yang keliru, bukan penunjukannya. Unsur yang tidak dinilai keluar dari penyebut, dan layar menyebut berapa unsur yang tidak ikut dihitung.",
      "Penetapan majelis hakim sengaja TIDAK ikut diperlakukan begini. PMH menetapkan satu majelis - bukan satu orang - dan tanggal penetapan tiap anggotanya tidak selalu sama dengan tanggal penetapan majelisnya.",
    ],
    knownLimitations: [
      "Perkara yang tabel petugasnya kosong tetap memakai tanggal lama dari tabel penetapan. Tidak ada yang lebih benar untuk dipakai, dan mengosongkannya akan menghapus tanggal yang selama ini terbaca.",
      "Nilai yang sudah tersimpan pada periode sebelumnya tidak dihitung ulang. Yang berubah baru penilaian yang dijalankan sesudah pembaruan ini.",
    ],
  },
  {
    version: "1.96.0",
    title: "ALETA Judicia v1.96.0 - Kedudukan Pihak dan Warna Putusan",
    date: "2026-09-08",
    status: "Operasional",
    summary:
      "Para pihak pada layar Status Perkara dipisah menurut kedudukannya - penggugat beserta kuasanya, tergugat beserta kuasanya, lalu saksi tiap sisi. Status putusan diberi warna menurut artinya, memakai aturan yang sama dengan layar jadwal sidang - satu berkas, bukan dua salinan.",
    added: [
      "Saksi dipisah menurut sisi yang mengajukannya - saksi penggugat dan saksi tergugat - dibaca dari SIPP, bukan ditebak. Saksi yang sisinya tidak tercatat disebut apa adanya, tidak dipaksa ke salah satu sisi.",
    ],
    changed: [
      "Para pihak tidak lagi satu daftar berurutan. Empat kelompok dengan kuasa hukum menempel pada pihak yang diwakilinya - kuasa tidak berdiri sendiri di persidangan, ia hadir untuk seseorang.",
      "Tanggal putusan dan status putusan dipisah menjadi dua penanda. Tanggal netral karena ia keterangan, bukan penilaian.",
      "Aturan warna status putusan diangkat ke satu berkas bersama dan dipakai kedua layar.",
    ],
    fixed: [
      "Saksi tertulis sebagai pihak pada daftar para pihak. Saksi bukan pihak: ia tidak dipanggil sebagai pihak, tidak menanggung biaya, dan tidak terikat putusan.",
      "Lencana putusan selalu HIJAU, apa pun hasilnya - hijaunya melekat pada kata Putus, bukan pada hasilnya. Perkara yang ditolak pun tergambar hijau, dan yang melihat sekilas membaca kabar baik atas putusan yang justru menolak permohonan pihaknya.",
    ],
    security: [],
    operationalNotes: [
      "Tidak Dapat Diterima sengaja kuning, bukan merah. Ia bukan kekalahan - syarat formalnya belum terpenuhi dan perkaranya boleh diajukan kembali, sedangkan ditolak berarti pokoknya sudah diperiksa dan mengajukannya lagi menabrak nebis in idem.",
      "Dicabut dan Dicoret dari Register kelabu: keduanya bukan penilaian atas perkaranya, dan tidak ada yang perlu ditindaklanjuti siapa pun.",
      "Perdamaian sederajat dengan dikabulkan - PERMA 1/2016 menempatkannya sebagai hasil yang paling dikehendaki.",
    ],
    knownLimitations: [
      "Sisi saksi dicocokkan menurut nama antara daftar pihak dan daftar saksi. Nama yang tertulis berbeda di kedua tempat jatuh ke kelompok sisi belum tercatat - terlihat, bukan hilang.",
      "Belum dilihat langsung di peramban; yang diperiksa baru tipe, aturan, dan ujinya.",
    ],
  },
  {
    version: "1.95.0",
    title: "ALETA Judicia v1.95.0 - Status Perkara Berkesinambungan",
    date: "2026-09-07",
    status: "Operasional",
    summary:
      "Dua puluh satu bagian pada layar Status Perkara disusun ulang mengikuti jalan perkara - siapa, jalannya, hasilnya, sesudahnya, lalu kesimpulannya. Empat grafik ditambahkan, masing-masing di dalam bagian yang datanya berada. Palet irisan pai diukur ulang lewat pemeriksa palet dan diperbaiki - warna irisan pertama selama ini gagal dua pemeriksaan sekaligus.",
    added: [
      "Diagram batang jeda penginputan tiap tahapan: menjawab tahapan mana yang paling lambat diinput tanpa membandingkan sepuluh angka yang berjauhan di dalam tabel.",
      "Diagram garis hari sejak pendaftaran pada tiap sidang, dengan garis sasaran 150 hari beserta dasar hukumnya - SEMA 2/2014.",
      "Diagram pai komposisi pengeluaran perkara. Hanya pengeluaran; mencampurnya dengan penerimaan berarti menjumlahkan uang masuk dengan uang keluar seolah keduanya bagian dari satu keseluruhan.",
      "Diagram batang poin yang diperoleh tiap aspek SK Dirjen 048/2024 - keempat aspeknya berbobot berbeda dan selama ini tidak pernah dibandingkan.",
    ],
    changed: [
      "Susunan bagian mengikuti jalan perkara. Para pihak dan majelis naik ke atas - sebelumnya di urutan dua belas dan tiga belas, padahal seluruh bagian sebelumnya sudah menyebut nama tanpa memperkenalkannya. Dua bagian penilaian turun ke bawah: kesimpulan datang sesudah buktinya, bukan menyela.",
      "Keterangan putusan dan Putusan dan tindak lanjutnya kini berdampingan. Sebelumnya berjarak sepuluh bagian untuk satu subjek yang sama.",
      "Jumlah irisan pai dibatasi enam, sebanyak warna yang lulus pemeriksaan. Sebelumnya delapan, dan warna ketujuh mulai berputar memakai warna irisan pertama.",
    ],
    fixed: [
      "Warna irisan pertama diagram pai memakai warna utama aplikasi, dan gagal dua pemeriksaan sekaligus: pita terang - berada di L 0,421, di luar pita 0,43 sampai 0,77 sehingga tampak hitam di antara irisan lain - dan lantai kroma, 0,083 di bawah lantai 0,1 sehingga terbaca ABU-ABU. Abu-abu di dalam pai terbaca sebagai Lainnya.",
      "Warna utama aplikasi memang bukan warna kategorikal: ia warna tindakan, dipilih untuk kontras terhadap tulisan - bukan untuk dibedakan dari lima warna lain di dalam satu lingkaran. Diganti palet yang seluruh warnanya lulus pemeriksaan pada mode terang maupun gelap.",
    ],
    security: [],
    operationalNotes: [
      "Grafiknya memakai penggambar yang sudah dibangun untuk e-Audit, bukan penggambar kedua. Keempat aturannya ikut terbawa: sumbu bermula dari nol, kecenderungan menolak digambar dari titik yang terlalu sedikit, yang dipotong disebutkan, dan garis ambang membawa dasar hukumnya.",
      "Uraian biaya adalah teks bebas di SIPP. Dua tulisan yang maksudnya sama dengan ejaan berbeda tergambar sebagai dua irisan, dan itu disebutkan di bawah gambarnya.",
    ],
    knownLimitations: [
      "Pada pemeriksaan SELURUH pasangan warna - bukan hanya yang bersentuhan - batas warna yang benar-benar dapat dibedakan adalah tiga. Enam warna lulus karena yang diperiksa pasangan yang bersentuhan, dan identitas tiap irisan ditopang keterangan bertulisan di sampingnya - tidak pernah bersandar pada warna saja.",
      "Grafik belum dilihat langsung di peramban; yang diperiksa baru tipe, aturan penggambar, dan paletnya.",
    ],
  },
  {
    version: "1.94.0",
    title: "ALETA Judicia v1.94.0 - Ekstensi SIPP Tahap 2",
    date: "2026-09-07",
    status: "Operasional",
    summary:
      "Ekstensi SIPP versi 1.67.0. Tiga hal yang selama ini dipetik atau dihitung tetapi tidak pernah digambar: enam ruas Data Umum dari berkas gugatan, dua sinyal pada penanda halaman daftar, dan berkas e-Court yang kini menempel pada agenda yang menunggunya - bukan sekadar pada tanggal yang sama.",
    added: [
      "Berkas e-Court menempel pada baris agenda yang menunggunya: jawaban pada agenda Jawaban, replik pada Replik, dan seterusnya. Tanggal tetap dipakai sebagai cadangan, dan kotaknya menyebut sebab pencocokannya.",
      "Penanda halaman daftar menggambar dua sinyal yang tidak ada di layar SIPP mana pun: nomor pihak yang belum terverifikasi, dan selisih antara catatan ALETA dengan keadaan di e-Court.",
      "Tiap penanda menerangkan artinya saat disentuh tetikus - penanda yang tidak dapat ditindaklanjuti pada akhirnya diabaikan.",
    ],
    changed: [
      "Menu Baca kolom formulir ini berganti nama menjadi Peta kolom formulir (sekali pasang), dan menyebutkan bahwa yang tercantum adalah PENUNJUK kolom - bukan isinya. Sebelumnya daftarnya terbaca sebagai fitur yang gagal mengambil data.",
    ],
    fixed: [
      "Enam ruas Data Umum yang dipetik dari berkas gugatan tidak pernah digambar: tanggal menikah, nomor dan tanggal kutipan akta nikah, KUA tempat menikah, obyek sengketa, dan posita - beserta tanggal dan nomor suratnya. Pemetik mengembalikan enam belas ruas, daftar di ekstensi hanya menyebut sepuluh, dan sisanya lenyap tanpa error. Itulah sebab papan itu terbaca seolah hanya bisa memetik data pihak.",
      "Baris agenda Jawaban dulu menerima seluruh berkas yang kebetulan bertanggal sama - replik, duplik, kesimpulan - dan yang mencari jawabannya harus memilah sendiri.",
      "Penanda hijau pada halaman daftar dulu menyala meski nomor pihaknya bermasalah atau ada selisih dengan e-Court, sebab hanya empat dari enam sinyal yang diperiksa. Kabar baik yang keliru lebih merugikan daripada tidak ada kabar.",
    ],
    security: [],
    operationalNotes: [
      "Uji baru membandingkan daftar ruas petikan di ekstensi dengan tipe DataUmum di server, sehingga ruas yang ditambahkan pemetik tidak dapat lagi hilang diam-diam di layar.",
    ],
    knownLimitations: [
      "Saklar Hakim tunggal masih penanda keadaan. Mengubahnya menyentuh aturan pembagian beban perkara, bukan hanya tampilan, dan itu keputusan pimpinan - bukan keputusan yang menulis kodenya.",
      "Pencocokan berkas ke agenda memakai kata pada judul berkas. Berkas yang judulnya tidak menyebut tahapannya jatuh kembali ke pencocokan tanggal, dan itu disebutkan pada kotaknya.",
    ],
  },
  {
    version: "1.93.0",
    title: "ALETA Judicia v1.93.0 - Ekstensi SIPP Tahap 1",
    date: "2026-09-07",
    status: "Operasional",
    summary:
      "Ekstensi SIPP versi 1.66.0. Saklar Manual pada papan penunjukan akhirnya benar-benar dapat ditekan - selama ini ia hanya penanda. Menu yang tersimpan dalam keadaan terbuka kini terisi sendiri, tombol ciutkan benar-benar menciutkan, panel pulang ke sudut kanan atas, dan tema terang tersedia.",
    added: [
      "Cara Manual pada papan penunjukan: daftar calon hakim, panitera pengganti, dan juru sita dapat dipilih sendiri. Daftarnya sudah lama dikirim layanan penunjukan - yang tergambar selama ini hanya juaranya.",
      "Tema terang untuk panel ekstensi, dan tema untuk halaman SIPP yang dinyalakan terpisah dengan menahan Shift. Tema SIPP bawaannya mati.",
      "Bagian Penetapan yang dapat Anda tetapkan: keempat penetapan perkara yang sedang dibuka, ditandai mana yang urusan pembaca menurut rencana kerja - bukan tebakan dari nama jabatan.",
    ],
    changed: [
      "Bagian Menunggu penetapan Anda dulu hanya membaca antrean penerusan, sehingga selalu kosong sebelum ada yang menekan teruskan. Antrean itu tidak dibuang - ia turun ke bawah, sesudah pertanyaan tentang perkara yang sedang dibuka terjawab.",
      "Panel kembali ke sudut kanan atas ketika tombol kembalikan-bawaan ditekan. Sebelumnya 90px di bawah sudut, yang terbaca sebagai panel yang gagal pulang.",
    ],
    fixed: [
      "Menu yang tersimpan dalam keadaan TERBUKA tergambar terbentang tetapi kosong, dan baru terisi sesudah ditekan dua kali - sekali menutup, sekali membuka. Terkena empat bagian sekaligus: keadaan perkara, baca kolom formulir, papan penunjukan, dan penetapan.",
      "Tombol ciutkan menyembunyikan isi panel tetapi meninggalkan kotak kosong sebesar semula, karena tinggi panel terpatok sesudah pernah diubah ukurannya. Tingginya kini ikut dilepas dan dikembalikan lagi saat dibentangkan.",
      "Saklar Cara dan Hakim tunggal berbentuk tombol tetapi tidak menanggapi tekanan sama sekali - keduanya span tanpa penangan. Saklar yang belum dapat diubah kini tampil mati dan menyebutkan dirinya, bukan diam.",
    ],
    security: [],
    operationalNotes: [
      "Tema halaman SIPP dikerjakan sebagai lapisan tipis yang hanya menyentuh latar, tulisan, dan garis tabel - tidak satu pun ukuran atau tata letaknya. Filter invert pada seluruh halaman sengaja tidak dipakai: ia membalik warna foto dan tanda tangan pindaian juga.",
      "Pilihan manual tidak disimpan antar-perkara. Penunjukan menyangkut satu perkara pada satu saat, dan pilihan yang tertinggal dari perkara sebelumnya adalah cara paling halus menetapkan orang yang salah.",
    ],
    knownLimitations: [
      "Empat permintaan lain pada ekstensi belum dikerjakan: deteksi Data Umum dari berkas gugatan, keterangan menu Baca kolom formulir, perombakan penandaan halaman SIPP, dan pengisian berkas e-Court pada jadwal sidang.",
      "Saklar Hakim tunggal masih penanda keadaan - mengubahnya menyentuh aturan pembagian beban, bukan hanya tampilan.",
    ],
  },
  {
    version: "1.92.0",
    title: "ALETA Judicia v1.92.0 - Antrian Milik Satu Hari",
    date: "2026-09-07",
    status: "Operasional",
    summary:
      "Nomor antrian dan jam kehadiran hari ini ikut tergambar pada jadwal tanggal lain, seolah para pihak sudah hadir untuk sidang yang belum terjadi. Sekalian: menu turun kini menutup ketika ditekan di luar, dan agenda musyawarah majelis serta pembacaan putusan ditandai merah.",
    added: [
      "Kotak saringan Musyawarah Majelis bernada merah untuk agenda musyawarah majelis, pembacaan putusan, pembacaan penetapan, dan putusan sela - hari yang menuntut majelis lengkap dan naskah siap.",
    ],
    changed: [
      "Menu Tampilan dan menu Antrian menutup ketika ditekan di luar dirinya, dan ketika tombol Escape ditekan. Sebelumnya satu-satunya cara menutupnya adalah menekan tombolnya sekali lagi.",
      "Kotak Agenda putusan yang dulu bernada sejuk digantikan kotak Musyawarah Majelis bernada merah - bukan ditambahi kotak kedua yang menyaring hal hampir sama.",
    ],
    fixed: [
      "Nomor antrian dan jam kehadiran suatu perkara ikut tampil pada jadwal tanggal LAIN. Peta antrian dikunci menurut nomor perkara saja, sementara jadwal dapat dibuka pada tanggal mana pun - dan perkara yang sama kerap bersidang lagi beberapa hari kemudian. Perkara 216/Pdt.P/2026 memperlihatkannya: barisnya bertanggal 7 September dengan penggugat, tergugat, dan saksi hadir pukul 08:43, dan angka itu tergambar pada jadwal 8 September.",
      "Akibat lanjutannya ikut diperbaiki: perkara semacam itu tidak lagi terhitung pada kotak Sudah ambil antrian, sehingga petugas yang menyiapkan sidang esok tidak lagi menyangka para pihaknya sudah datang.",
    ],
    security: [],
    operationalNotes: [
      "Tanggal antrian yang tidak terbaca dianggap tidak cocok - antrian adalah keterangan tambahan, dan menampilkannya saat ragu lebih merugikan daripada tidak menampilkannya.",
    ],
    knownLimitations: [
      "Sidang ikrar talak sengaja tidak ikut ditandai merah. Ia hari yang menentukan, tetapi bukan musyawarah dan bukan pembacaan putusan - putusannya sudah dijatuhkan jauh sebelumnya, dan memasukkannya menambah 57 sidang merah pada 2026 saja.",
    ],
  },
  {
    version: "1.91.0",
    title: "ALETA Judicia v1.91.0 - Reset Kehadiran dan Kedudukan Pihak",
    date: "2026-09-07",
    status: "Operasional",
    summary:
      "Kehadiran antrian yang salah input kini dapat dibatalkan per sisi, dan urutan antrian dihitung ulang sendiri. Sekalian ketahuan satu cacat lama: saksi dan turut tergugat selama ini terhitung sebagai penggugat - termasuk pada jadwal sidang yang dicetak dan papan pintu ruang yang dibaca para pihak.",
    added: [
      "Reset kehadiran pada menu Antrian tiap perkara, terpisah untuk penggugat, tergugat, dan saksi. Hanya sisi yang waktunya benar-benar terisi yang ditawarkan.",
      "Jejak pembatalan kehadiran: siapa yang membatalkan, kapan, dan atas alasan apa. Baris kehadiran aslinya tidak dihapus - yang dicatat pembatalannya.",
    ],
    changed: [
      "Penanda jumlah pihak berbentuk plus dua di samping nama penggugat dihapus. Ia menimbulkan pertanyaan alih-alih menjawabnya, dan angkanya pun keliru. Seluruh nama kini disebut dan dipisah koma.",
    ],
    fixed: [
      "Saksi terhitung sebagai penggugat. Aturan lama berbunyi pihak_ke 2 masuk tergugat dan seluruh sisanya masuk penggugat, sehingga 16.480 baris saksi jatuh ke sisi penggugat - lebih banyak daripada penggugatnya sendiri, dan hampir setiap perkara tampak berpenggugat tiga orang.",
      "Turut tergugat terhitung sebagai penggugat - sisi yang berlawanan dengan kedudukannya. Terkena 27 baris.",
      "Kedua cacat di atas ikut terbawa ke cetak jadwal sidang, layar antrian ruang tunggu, dan papan pintu ruang sidang - naskah dan layar yang dibaca para pihak sendiri.",
      "Kehadiran yang sudah dibatalkan tidak lagi ikut dibaca daftar kehadiran, sehingga layar tidak menyebut orangnya hadir sementara waktunya sudah kosong di aplikasi antrian.",
    ],
    security: [],
    operationalNotes: [
      "Nomor antrian adalah urutan baris pada daftar yang diurutkan menurut waktu ambil, bukan angka yang disimpan. Karena itu membatalkan kehadiran satu perkara dapat menggeser nomor perkara lain - sama seperti setiap pencatatan kehadiran baru. Itu perilaku yang sudah berlaku sejak semula, bukan yang ditambahkan rilis ini.",
      "Pencarian nama pada layar pengambilan antrian tetap menemukan saksi meski saksi tidak lagi tercampur ke daftar penggugat - saksi termasuk yang boleh mengambil nomor.",
    ],
    knownLimitations: [
      "Satu sisi hanya punya satu kolom waktu di aplikasi antrian. Membatalkan sisi penggugat karena itu membatalkan seluruh kehadiran pada sisi itu, termasuk penggugat kedua bila ada.",
      "Waktu ambil saksi tidak ikut menentukan urutan antrian - hanya kolom penggugat dan tergugat yang dihitung. Perkara yang hanya saksinya mengambil nomor karena itu tetap terbaca belum ambil. Keadaan ini sudah berlaku sejak sebelum rilis ini.",
    ],
  },
  {
    version: "1.90.0",
    title: "ALETA Judicia v1.90.0 - Saksi Bernama dan Antrian per Sisi",
    date: "2026-09-07",
    status: "Operasional",
    summary:
      "Daftar jadwal sidang kini menyebut nama saksi tiap pihak, memisahkan penggugat dari tergugat pada baris para pihak, dan menandai sisi mana yang sudah mengambil nomor antrian beserta jamnya. Ketiga keterangan itu sudah lama terbaca ALETA tetapi tidak pernah digambar di layar.",
    added: [
      "Nama saksi tiap pihak pada daftar sidang - Saksi P dan Saksi T beserta jumlahnya, tampil di kedua mode tampilan.",
      "Penanda sisi yang sudah mengambil antrian pada kolom Antrian/Jam: penggugat, tergugat, dan saksi disebut sendiri-sendiri beserta jam pengambilannya.",
    ],
    changed: [
      "Nama para pihak pada daftar dipisah menjadi dua baris berlabel P dan T. Sebelumnya satu baris berbunyi A lawan B yang terpotong pada nama panjang - dan yang terpotong justru nama tergugat.",
      "Nomor perkara dan jenis perkara ditebalkan lagi, pada daftar maupun kepala rincian.",
      "Tombol Reset pindah dari deretan kotak keadaan ke baris kendali saringan. Di tempat lama ia hampir selalu jatuh sendirian ke baris berikutnya, memakan satu baris penuh dan mengurangi jumlah sidang yang terlihat.",
      "Penanda antrian online dibuat lebih terbaca. Yang offline tetap tidak ditandai - mengambil nomor di mesin ruang tunggu adalah keadaan biasa, dan label yang ada di mana-mana berhenti menjadi keterangan.",
    ],
    fixed: [
      "Tombol Bersihkan pada baris saringan hanya melepas sebagian - keadaan, kotak saring, dan pencarian lanjutan - sedangkan alur perkara dan keempat penyaring kartu tetap menyala. Pada keadaan hasil kosong, menekannya dapat tetap menghasilkan daftar kosong. Digabung menjadi satu tombol Reset yang melepas seluruhnya.",
      "Nama saksi dipisah dengan tanda pipa, bukan koma: 573 nama saksi di PA Donggala memuat koma pada gelarnya, dan koma sebagai pemisah memecah satu saksi menjadi dua sekaligus menyalahkan jumlahnya.",
    ],
    security: [],
    operationalNotes: [
      "Waktu pengambilan antrian tiap sisi sudah lama tersimpan pada tabel antrian sidang - ruas pihak_1, pihak_2, dan saksi - dan sudah sampai ke layar ini sejak lama. Yang berubah hanya penggambarannya.",
    ],
    knownLimitations: [
      "Penanda antrian online belum akan muncul: kolom online pada tabel antrian sidang masih kosong pada seluruh baris, sehingga belum satu pun pengambilan tercatat sebagai online. Yang kurang datanya, bukan penandanya.",
    ],
  },
  {
    version: "1.89.1",
    title: "ALETA Judicia v1.89.1 - Tombol Reset Saringan",
    date: "2026-09-07",
    status: "Operasional",
    summary:
      "Tombol yang melepas seluruh saringan pada Jadwal Sidang dulu bertuliskan angka beserta kata Seluruh sidang, sehingga terbaca sebagai keterangan jumlah - bukan sebagai tombol yang dapat ditekan. Sekarang ia menyebut apa yang dikerjakannya dan ke berapa perkara ia mengembalikan.",
    added: [],
    changed: [
      "Tombol Seluruh sidang menjadi tombol Reset yang menyebut jumlah perkara yang akan muncul kembali - berbunyi Reset kembali ke 21 perkara. Saat tidak ada saringan yang menyala ia kembali menjadi keterangan jumlah dan tidak dapat ditekan, supaya tidak mengundang tekanan yang tidak menghasilkan apa-apa.",
    ],
    fixed: [
      "Keadaan mati dan tampilan tombol itu dulu dihitung dari dua daftar yang berbeda - yang mematikannya memeriksa empat hal, yang mewarnainya hanya dua. Akibatnya tombol yang masih dapat ditekan tampil seperti tombol mati. Keduanya kini berasal dari satu sumber yang sama.",
      "Keempat penyaring pada kartu rincian - jenis, tahap, majelis, ruang - kini ikut menyalakan tombol Reset. Merekalah yang paling mudah tertinggal menyala tanpa disadari, karena letaknya di dalam panel yang dapat ditutup.",
    ],
    security: [],
    operationalNotes: [
      "Rentang tanggal dan kotak Cari di atas sengaja tidak ikut dilepas. Keduanya menentukan apa yang diambil dari SIPP, bukan apa yang disembunyikan dari yang sudah diambil - melepasnya berarti memuat ulang tanpa diminta.",
    ],
    knownLimitations: [],
  },
  {
    version: "1.89.0",
    title: "ALETA Judicia v1.89.0 - Jadwal Sidang, Mediasi, dan Tiga Bug yang Diam",
    date: "2026-09-07",
    status: "Operasional",
    summary:
      "Delapan belas perbaikan pada layar Jadwal Sidang dan Mediasi. Sambil mengerjakannya, tiga cacat lama ketahuan - ketiganya tidak pernah menimbulkan error apa pun: saringan e-Litigasi yang tidak pernah sekali pun menyala, kolom jenis putusan yang kosong pada hampir seluruh perkara, dan dua menu yang tampil tembus pandang. Kehadiran mediasi kini dicatat menurut empat kedudukan terpisah, karena satu angka tidak dapat membedakan pihak yang hadir sendiri dari kuasanya yang hadir.",
    added: [
      "Pencatatan kehadiran mediasi menurut empat kedudukan terpisah: penggugat, tergugat, kuasa penggugat, dan kuasa tergugat - beserta nama yang benar-benar hadir dan alasan bagi yang tidak.",
      "Tombol Rincian pada tiap pertemuan mediasi, memuat seluruh keterangannya: jadwal, mediator, nomor SK, tanggal penetapan, batas 30 hari, laporan mediator, dan hasilnya.",
      "Penanda verzet berwarna merah di samping nomor perkara, pada daftar maupun rincian.",
      "Penanda jumlah saksi yang diajukan tiap pihak - Saksi P dan Saksi T - pada daftar dan rincian sidang.",
      "Penanda verstek pada daftar sidang, sebelumnya hanya terlihat sesudah membuka rincian.",
    ],
    changed: [
      "Penanda e-Litigasi kini menuntut DUA syarat: perkaranya terdaftar lewat e-Court, dan agendanya tahapan yang dipertukarkan elektronik. Daftar agendanya diperluas dengan musyawarah majelis, pembacaan putusan, pembacaan penetapan, dan putusan sela.",
      "Jenis putusan ditampilkan sebagai penanda berwarna menurut statusnya - hijau untuk dikabulkan dan perdamaian, merah untuk ditolak, kuning untuk gugur. Tidak Dapat Diterima sengaja kuning, bukan merah: syarat formalnya belum terpenuhi dan perkaranya boleh diajukan kembali.",
      "Penanda belum minutasi menjadi merah bila naskah putusannya sudah diunggah - keadaan yang menagih panitera pengganti, bukan lagi menunggu hakim.",
      "Baris jadwal sidang dan mediasi tidak lagi dapat ditekan di sembarang tempat. Hanya tombol Rincian di ujung kanan yang membukanya.",
      "Tanggal mulai dan tanggal akhir disatukan dalam satu alat rentang; kotak pencarian pindah ke baris tombol tindakan.",
      "Tombol Seluruh sidang melepas SEMUA yang menyempitkan tampilan - alur, keadaan, kotak saring, dan pencarian lanjutan - bukan hanya sebagian.",
      "Identitas pihak pada rincian dipisah menjadi penggugat, tergugat, dan saksi, dengan kuasa hukum menempel pada pihak yang diwakilinya.",
      "Berkekuatan hukum tetap dan akta cerai dikeluarkan dari menu putusan pada jadwal sidang - keduanya keadaan sesudah perkara selesai, dan tetap ada di layar Status Perkara.",
      "Jenis perkara ditebalkan, dan judul Jadwal Perkara Yang Bersidang dikapitalkan.",
    ],
    fixed: [
      "Saringan e-Litigasi tidak pernah sekali pun menyala sejak ditulis. Polanya memuat aksara kendali backspace alih-alih penanda batas kata, sehingga tidak pernah cocok dengan teks apa pun. Tidak ada error, dan ujinya tetap hijau karena menguji salinan aturan yang ejaannya benar.",
      "Kolom jenis putusan berbunyi belum tercatat pada hampir seluruh perkara. SIPP menyimpan nama status sebagai salinan yang hanya kadang diisi - 9.480 dari 9.998 baris putusan kosong di sana - padahal nomor statusnya terisi. Nama kini selalu diambil dari tabel rujukan.",
      "Satu baris putusan menyimpan nama status yang bertentangan dengan nomornya: berstatus Digugurkan tetapi tersimpan sebagai Dikabulkan. Terbawa perbaikan di atas.",
      "Menu Tampilan dan Antrian tampil tembus pandang sehingga tulisannya bertumpuk dengan tabel di bawahnya. Keduanya memakai warna latar yang tidak pernah didefinisikan.",
      "Kehadiran saksi tertulis belum ada pada perkara yang sudah mengajukan saksi. Yang dihitung adalah saksi yang sudah diperiksa, bukan yang diajukan - dua pertanyaan yang berbeda, dan yang ditanyakan sebelum sidang adalah yang kedua.",
      "Tulisan Kembali ke Portal meluber keluar bagan sidebar dan menimpa tombol ciutkan.",
      "Penanda Putusan e-Court dimatikan sementara: ia menuduh perkara yang sebenarnya hanya belum pernah ditarik dari e-Court.",
    ],
    security: [],
    operationalNotes: [
      "Tabel kehadiran mediasi milik ALETA sepenuhnya. Sambungan ke SIPP tetap hanya baca, dan catatan kehadiran tidak pernah ditulis balik ke sana.",
      "Nama pencatat kehadiran diambil dari sesi yang sedang berjalan dan tidak dapat diketik.",
      "Migrasi 0038 menambah satu tabel. Seluruhnya CREATE TABLE IF NOT EXISTS - tidak ada tabel atau kolom yang dihapus maupun diubah.",
    ],
    knownLimitations: [
      "Yang dicatat hanya fakta kehadiran mediasi. Penilaian iktikad baik menurut PERMA 1/2016 Pasal 6 tidak dihitung - itu kewenangan mediator dan majelis, dan syaratnya berlapis serta sebagiannya tidak terekam di sistem mana pun.",
      "Penanda Putusan e-Court belum dapat dinyalakan kembali sebelum pemeriksaannya membedakan perkara yang belum pernah ditarik dari yang sudah ditarik dan memang belum terbit.",
      "Panggilan elektronik tetap tidak dapat dikenali sebagai jenis relaas - tidak ada kolom yang menyimpannya pada perkara_pelaksanaan_relaas.",
      "Korpus blangko masih belum dipelajari di server, sehingga layar Blangko Mandiri tetap kosong.",
    ],
  },
  {
    version: "1.88.0",
    title: "ALETA Judicia v1.88.0 - e-Audit, Blangko Mandiri, dan Jadwal Sidang",
    date: "2026-09-07",
    status: "Operasional",
    summary:
      "Tiga pekerjaan besar yang dikerjakan berdampingan. e-Audit berdiri sebagai aplikasi tersendiri dengan katalog 185 butir penilaian dan tiga bentuk penilaian yang berbeda. Blangko ALETA menjadi mandiri - 807 blangko diurai menjadi kerangka dan blok kalimat yang dapat disusun ulang kata demi kata, tanpa lagi menyentuh berkas ABT. Layar jadwal sidang menampilkan relaas yang datanya sudah ada sejak lama tetapi tidak pernah terlihat, dan dua cacat data SIPP yang menyembunyikan nama petugas diperbaiki.",
    added: [
      "Aplikasi e-Audit: katalog 185 butir penilaian, beserta hitungan sisa pekerjaan yang diturunkan dari selisih katalog dan penilaian yang benar-benar tersambung - bukan dari penanda yang ditulis tangan.",
      "Tiga bentuk penilaian di e-Audit. Pertama lulus-gagal (24 butir), kedua sebaran yang sengaja TIDAK punya jalan menuju nilai nol sampai seratus (4 butir), ketiga rapor per orang yang menolak memberi satu angka gabungan (4 butir).",
      "Sepuluh bentuk sajian e-Audit - angka pokok, tabel, kesimpulan, batang, garis, area, sebar, pai, peta kendali, dan bentuk resmi - ditulis sekali dan dipakai seluruh butir. Sumbu nilai selalu bermula dari nol, dan data terlalu sedikit ditolak digambar sebagai kecenderungan.",
      "Dua puluh alat penilaian yang menempel pada tiap layar penilaian, dengan keadaan dihitung dari berkas yang benar-benar ada di sisi mesin dan sisi layar.",
      "Blangko mandiri ALETA: 807 blangko diurai menjadi 8.448 blok kalimat unik - pemadatan 3,85 kali - dan seluruh 807 dapat disusun ulang kata demi kata dari bloknya.",
      "Kamus variabel ALETA beserta penggolongan Kelas A, B, dan C: yang dapat diisi mesin, yang menuntut jawaban orang, dan yang belum punya sumber sama sekali.",
      "Penyelesai variabel dengan urutan topologis, sehingga variabel yang bergantung pada variabel lain diselesaikan sesudah yang dirujuknya. Termasuk penanggalan Hijriah, yang dicocokkan terhadap penetapan sungguhan 206/Pdt.P/2026/PA.Dgl.",
      "Cetak DOCX dan PDF dari blangko ALETA sendiri, tanpa pustaka luar - DOCX disusun langsung sebagai OOXML di atas zlib.",
      "Layar Blangko Mandiri untuk admin: Kamus, Korpus, Pustaka, dan Pembersihan; serta layar isian Kelas B untuk melengkapi data yang tidak dapat diambil dari SIPP.",
      "Tombol ambil antrian sidang di samping tiap perkara pada jadwal sidang, untuk penggugat, tergugat, kuasa, dan saksi - tercatat atas nama petugas yang menekannya, bukan atas nama mesin antrian.",
      "Keterangan relaas lengkap pada jadwal sidang: jenis relaas, tanggal kirim ke pos, nomor resi surat tercatat, dan status lacak kirimannya.",
      "Saringan perkara e-Litigasi pada jadwal sidang, dikenali dari agenda pertukaran berkas - jawaban, replik, duplik, duplik rekonvensi, dan kesimpulan.",
      "Menu tambahan pada jadwal sidang yang mengarah ke tampilan pihak dan tampilan operator ALETA e-Court.",
    ],
    changed: [
      "Blangko ALETA tidak lagi bergantung pada berkas ABT. ABT dipelajari sekali saat membangun korpus, lalu ditinggalkan - karena ABT tidak memuat seluruh blangko yang dipakai pengadilan.",
      "Jenis putusan menggantikan kolom upaya hukum pada jadwal sidang, disertai nama konseptor bila naskahnya sudah diunggah, dan keterangan tersendiri untuk perkara verzet.",
      "Susunan tampilan rinci jadwal sidang mengikuti alur membacanya: majelis dan identitas pihak, lalu relaas terbaru, lalu riwayat relaas, baru selebihnya. Seluruh bagiannya dapat diciutkan.",
      "Relaas yang ditampilkan tidak lagi dipotong. Seluruh baris dikembalikan, dipisah menjadi relaas sidang berjalan dan riwayatnya.",
      "Keterangan pada cetak jadwal sidang dipersempit menjadi yang bertanda merah saja - retur, tidak dipanggil, dan sejenisnya.",
      "Tombol yang semula berlabel Antrian diganti menjadi Daftarkan ke antrian. Kerjanya memang mendaftarkan perkara ke aplikasi antrian; hanya namanya yang tidak menerangkan apa pun.",
      "Hari libur nasional 2024 dan 2025 kini disahkan terhadap SKB masing-masing tahun, menyusul 2026 yang sudah disahkan pada v1.87.0.",
    ],
    fixed: [
      "Nama juru sita dan panitera pengganti tampak berlipat pada jadwal sidang. SIPP menyimpan dua baris aktif dengan ejaan gelar berbeda - Mohammad Syukri dan Mohammad Syukri, S.H. terbaca sebagai dua orang. Kini disatukan, dan ejaan terlengkap yang dipakai.",
      "Kolom Majelis berbunyi tanda hubung pada SELURUH perkara ikrar talak. Baris hakim yang aktif justru berkode NULL sedangkan kodenya tersimpan pada baris yang sudah tidak aktif; kueri yang menyaring aktif saja karena itu selalu memungut baris tanpa kode.",
      "Tujuh salah pasang variabel pada penyusun berita acara. Yang terbesar #0046# - terpakai 12.935 kali - diisi NAMA pihak padahal maksudnya SEBUTAN pihak; naskah acuan membuktikannya: blangko berbunyi sebagai #0046# dan keluarannya sebagai Pemohon I. Mesin JLF sejak awal benar, jalur berita acara yang keliru, dan keduanya tidak pernah dibandingkan.",
      "Judul BERITA ACARA SIDANG terbuang dari korpus karena penyaring panjang 25 aksara. Penyaringan berdasar panjang diganti pengenalan pola sampah.",
      "Pemenggal awalan angka pada penamaan blangko ikut memakan huruf B pada BAS, dan akhiran .PA.Mj yang menempel pada huruf pihak mengubah tunda-panggil-pihak2 menjadi tunda-tanggal.",
      "Tanggal tidak lagi ikut ditampilkan pada penanda putus hijau di tampilan lengkap; status putusannya saja yang ditampilkan. Pada tampilan ringkas, status putus kini muncul di bawah agenda.",
      "Penanda pemakaian kuasa hukum kini tampil pada semua tampilan jadwal sidang.",
      "Penetapan yang bertanggal SEBELUM perkara didaftarkan terhitung memenuhi pada penilaian tenggang. Rentang tanggal terbalik memulangkan nol, bukan angka negatif, sehingga selalu lolos ambang.",
      "Ruas SIPP berisi spasi, tanda hubung, titik, atau angka nol tunggal kini terhitung KOSONG pada penilaian kelengkapan data. Ada 6.210 entri alasan penundaan yang isinya hanya angka nol.",
    ],
    security: [],
    operationalNotes: [
      "Aplikasi e-Audit belum dibuka untuk peran mana pun selain super admin, dan ujinya mengunci keadaan itu - membukanya kelak harus menjadi keputusan sadar, bukan efek samping.",
      "Korpus blangko BELUM dipelajari di server. Layar Blangko Mandiri akan menampilkan kamus dan pustaka yang kosong sampai pembelajaran korpus dijalankan di sana.",
      "Folder APS Badilag tetap hanya dibaca. ALETA tidak pernah menulis apa pun ke dalamnya.",
      "Pemeriksaan hasil alih rupa mati secara bawaan, sesuai keputusan - dengan sakelar untuk menyalakannya bila hakim hendak memeriksa berita acara sebelum dipakai.",
    ],
    knownLimitations: [
      "Tujuh blangko relaas belum diturunkan dari korpus. Cetak relaas mandiri karena itu belum dapat dipakai.",
      "Panggilan elektronik tidak dapat dikenali sebagai jenis relaas. Tidak ada kolom yang menyimpannya pada perkara_pelaksanaan_relaas, dan menebaknya berarti menuliskan cara pemanggilan yang mungkin tidak pernah terjadi pada berkas yang menentukan sah tidaknya panggilan.",
      "Aturan pemeriksaan Kelompok G dan tarif per model AI belum diisi.",
      "Dari 185 butir katalog e-Audit, 8 tersambung penuh dan 21 sebagian. Sisanya belum, dan tiap butir menyebut sendiri apa yang menghalanginya.",
      "Tidak satu pun penilaian e-Audit boleh dipakai membina sebelum angkanya disandingkan dengan angka dari luar ALETA.",
    ],
  },
  {
    version: "1.87.0",
    title: "ALETA Judicia v1.87.0 - Penilaian Berjenjang dan Hari Libur Resmi",
    date: "2026-09-07",
    status: "Operasional",
    summary:
      "Delapan penilaian yang selama ini hanya lulus uji sekarang dapat dilihat: satu layar dengan bukti, cara hitung, dan ambangnya. Daftar hari libur nasional 2026 disahkan terhadap SKB tiga menteri - dan pengesahan itu menyingkap delapan tanggal yang sebelumnya hilang, termasuk 23 dan 24 Maret yang jatuh Senin dan Selasa.",
    added: [
      "Layar Penilaian Berjenjang di halaman ALETA x SIPP: memilih penilaian, jendela periode, dan tanggal acuan, lalu menghitungnya saat diminta - bukan menghitung seluruhnya di muka.",
      "Daftar bukti tiap satuan periode. Angka pembilang dan penyebutnya DITURUNKAN dari daftar itu, sehingga angka dan bukti tidak mungkin berbeda; siapa pun yang tidak percaya dapat mengambil satu nomor perkara lalu memeriksanya sendiri di SIPP.",
      "Panel cara hitung dan ambang yang datang dari mesin yang benar-benar menghitung, bukan disalin ke layar - sehingga panelnya tidak dapat menerangkan rumus yang berbeda dari yang dipakai.",
      "Pencatatan laporan perkara: 22 laporan LIPA x 12 bulan, beserta tanggal kirim dan angkanya. Tanggal kirim tidak ada di SIPP; sebelum ini satu-satunya cara memasukkannya adalah menulis langsung ke basis data.",
      "Daftar hari libur nasional dan cuti bersama 2024-2026 sebagai dasar hitungan hari kerja.",
    ],
    changed: [
      "Hitungan hari kerja tidak lagi hanya mengecualikan Sabtu dan Minggu. Penilaian ketaatan tenggang pemanggilan karena itu berubah untuk periode yang memuat hari libur - relaas yang dulu lolos karena cuti bersama terhitung hari kerja sekarang dinilai apa adanya.",
      "Daftar hari libur 2026 disahkan terhadap SKB Menteri Agama, Menteri Ketenagakerjaan, dan Menteri PANRB Nomor 1497, 2, dan 5 Tahun 2025 (ditetapkan 19 September 2025): 25 tanggal, tiap harinya diperiksa terhadap kalender.",
      "Nama pencatat laporan diambil dari sesi yang sedang berjalan dan tidak dapat diketik. Ruas yang dapat diisi sendiri membuat catatannya tidak dapat ditelusuri.",
    ],
    fixed: [
      "Delapan tanggal libur 2026 yang sebelumnya hilang kini masuk - 16 Februari, 18, 20, 23, dan 24 Maret, 15 dan 28 Mei, serta 24 Desember. Tanpa kedelapannya, hari yang sebenarnya libur terhitung sebagai hari kerja: relaas Kamis 19 Maret untuk sidang Rabu 25 Maret dulu terhitung empat hari kerja dan lolos, padahal sebenarnya hanya satu.",
      "Penjaga penarikan e-Court tidak lagi menuduh kode yang benar saat mesin sedang sibuk. Lima penantian berbasis jam diganti penantian berbasis syarat.",
    ],
    security: [],
    operationalNotes: [
      "Halaman ALETA x SIPP belum dibuka untuk pegawai umum, sehingga layar penilaian ini untuk sekarang hanya terlihat oleh super admin. Itu memang pantas selama angkanya belum disandingkan dengan angka dari luar ALETA.",
      "Tidak satu pun penilaian boleh dipakai membina sebelum angkanya disandingkan. Layarnya menyatakan itu pada tiap hasil, bukan menyembunyikannya di catatan kaki.",
      "Daftar hari libur 2024 dan 2025 masih berpenanda belum disahkan. Penilaian yang menghitung hari kerja pada kedua tahun itu membawa keterangannya sampai ke layar.",
    ],
    knownLimitations: [
      "Aspek kesesuaian angka laporan dengan SIPP belum tersambung untuk laporan mana pun, sehingga nilai laporan perkara null - bukan enam puluh. Yang sudah dinilai baru ketepatan waktunya.",
      "Hari libur belum diperhitungkan pada BATAS KIRIM laporan; keputusan tentang batas yang jatuh pada hari libur belum diambil.",
      "Penilaian dijalankan saat diminta, belum berjadwal. Uji berulang tiap malam di server belum dipasang.",
    ],
  },
  {
    version: "1.86.0",
    title: "ALETA Judicia v1.86.0 - Kamus Variabel dan Antrian Ruang",
    date: "2026-09-06",
    status: "Operasional",
    summary:
      "Tahap awal kemandirian blangko: ALETA kini menyimpan kamus variabelnya sendiri, disalin dari APS Badilag dan tidak lagi menjadi sambungan. Pemeriksaan 87 pemetaan yang selama ini ditulis tangan menemukan tujuh yang keliru - dua di antaranya mengenai 31 persen dari seluruh pustaka blangko.",
    added: [
      "Kamus variabel ALETA: salinan 1.253 definisi APS Badilag beserta jenis, kueri, dan penggolongan Kelas A (mekanis), B (butuh manusia), dan C (mati).",
      "Setiap penyalinan tercatat - kapan, oleh siapa, dari skema mana, berapa baris masuk - supaya pertanyaan \"definisi ini dari kapan\" selalu terjawab.",
      "Rute kamus: arti sebuah penanda dapat dibaca siapa pun yang memakai blangko; menyalin ulang menuntut admin.",
      "Antrian ruang sidang dan tampilan layar antrian.",
    ],
    changed: [
      "Membaca kamus tidak menyentuh APS Badilag sama sekali. Ini titik awal kemandirian: sesudah disalin, mencabut folder ABT tidak menggagalkan pembacaan definisi.",
    ],
    fixed: [
      "#0046# dan #0047# kini terisi SEBUTAN (\"Penggugat\", \"Pemohon\", \"Tergugat\", \"Termohon\"), bukan nama pihak. Namanya tetap dibawa #0098# dan #0102#. Kedua penanda ini muncul 18.072 kali di pustaka blangko - 31 persen dari seluruhnya - sehingga kalimat seperti \"memeriksa identitas #0046#\" sebelumnya tercetak dengan nama lengkap di tempat yang seharusnya berbunyi \"Penggugat\".",
      "#0690# kini berbunyi \"Majelis Hakim\" atau \"Hakim\", bukan daftar nama hakim yang digabung koma.",
      "#4004# dan #0668# kini sebutan pemimpin sidang (\"Ketua Majelis\" atau \"Hakim\"); namanya dipindahkan ke #0012# sebagaimana dinyatakan APS Badilag.",
      "#6034# kini jabatan panitera, bukan namanya - sebelumnya \"#6033# sebagai #6034#\" tercetak dengan nama yang sama dua kali.",
      "#6032# kini jabatan jurusita, bukan namanya.",
      "#0306# kini berbunyi \"tersebut\" bila tanggal daftar sama dengan tanggal surat, supaya kalimat tidak mengulang tanggal yang sama.",
    ],
    security: [],
    operationalNotes: [
      "Kamus perlu disalin sekali lewat rute kamus sebelum dipakai. Sebelum disalin, kamus menyatakan dirinya belum siap - bukan menjawab dengan kekosongan.",
      "Penyalinan hanya MEMBACA APS Badilag. ALETA tidak pernah menulis ke sana.",
      "Tarif tiap model AI masih belum disetel; selama kosong, biaya terhitung nol dan pagu tidak pernah memperingatkan.",
      "Aturan pemeriksaan Kelompok G masih belum dimasukkan dan disetujui; selama kosong, panel Pemeriksaan memang sengaja kosong.",
    ],
    knownLimitations: [
      "Ke-87 pemetaan lama belum seluruhnya dipindahkan menjadi baris data - itu menunggu penyelesai bertingkat pada tahap berikutnya. Pada tahap ini kamus baru menjadi otoritas atas ARTI, dan justru itulah yang menyingkap ketujuh cacat di atas.",
      "Jenis variabel yang belum dikenali digolongkan Kelas C, bukan diangkat menjadi mekanis - menunggu diperiksa manusia.",
    ],
  },
  {
    version: "1.85.0",
    title: "ALETA Judicia v1.85.0 - Lapisan AI, Mutu, dan Audit",
    date: "2026-09-06",
    status: "Operasional",
    summary:
      "Lapisan AI dengan aturan yang tidak dapat dilewati: pustaka dijawab lebih dulu dan model tidak tersentuh bila pustaka menjawab; pagu biaya mengembalikan ALETA ke pustaka saja alih-alih menghentikannya; dan audit menyeluruh menemukan delapan hal yang dibangun tetapi tidak pernah tersambung.",
    added: [
      "Lapisan AI: menarik fakta dari naskah tak berpola, menyusun pertimbangan baru hanya bila pustaka kosong, percakapan yang tahu perkaranya, dan usulan butir yang hakim mengesahkan.",
      "Saklar mati AI per pengadilan, per peran, atau per perkara - satu \"mati\" di lapisan mana pun mematikan seluruhnya.",
      "Pintu berpikir bebas di luar berkas: tautan biasa tanpa membawa apa pun dari perkara.",
      "Pagu biaya AI beserta rincian per pekerjaan dan per model, tarif per model, dan ukuran keberhasilan pustaka.",
      "Pemeriksaan keajekan berkala dan jalur pendaftaran sumber aplikasi baru.",
    ],
    changed: [
      "Kewenangan baca seluruh rute Judicia disamakan menjadi \"panel\", sama dengan BAS dan berkas perkara.",
      "Pagu habis mengembalikan ALETA ke pustaka saja: draf tetap dirakit dan pemeriksaan tetap berjalan.",
    ],
    fixed: [
      "Pagu dan pemilihan tingkat model kini benar-benar dikonsultasikan sebelum memanggil penyedia; sebelumnya keduanya dibangun tetapi tidak pernah dipanggil.",
      "Aturan batas data yang dicatat pengadilan kini berlaku di seluruh jalur, bukan hanya penarikan fakta.",
      "Pendaftaran sumber aplikasi baru kini benar-benar berpengaruh pada penyaring data.",
      "Amar dari templat SIPP kini terpakai saat petugas belum menyusun amarnya.",
      "Penyusunan pertimbangan baru kini punya jalurnya sendiri.",
    ],
    security: [
      "Nama penanda tangan putusan diambil dari akun, bukan diketik: sebelumnya siapa pun yang dapat mencapai rutenya dapat menandatangani atas nama hakim mana pun.",
      "Menandatangani putusan menuntut peran hakim, ketua, atau wakil ketua - ditolak di server, bukan di layar.",
      "Naskah berkas utuh terlarang keluar sebagai bawaan; pengadilan yang hendak memakai penarikan fakta harus memutuskannya sendiri, dan keputusan itu tercatat.",
    ],
    operationalNotes: [
      "Migrasi 0030 sampai 0032 menambah tabel lapisan AI, saklar, pemakaian, pagu, tarif, sumber aplikasi, dan pemeriksaan keajekan.",
      "Biaya AI memakai PERKIRAAN token dari panjang naskah, bukan hitungan penyedia. Bandingkan dengan tagihan sebelum dijadikan pegangan.",
      "Tarif tiap model wajib disetel; tanpa itu biaya terhitung nol dan pagu tidak memperingatkan apa pun.",
    ],
    knownLimitations: [
      "Belum diuji di ruang sidang yang sesungguhnya.",
      "Rute /api/admin/* belum punya penjaga peran eksplisit - di luar lingkup Judicia, dan perlu diputuskan tersendiri.",
      "Pemeriksaan kesegaran data sumber baru belum punya pemanggil; ia kontrak yang menunggu sumber pertama disambungkan.",
    ],
  },
  {
    version: "1.84.0",
    title: "ALETA Judicia v1.84.0 - Perakit Putusan dan Ruang Kerja",
    date: "2026-09-05",
    status: "Operasional",
    summary:
      "Draf putusan kini dirakit dari pustaka pertimbangan tanpa satu pun panggilan model, lalu ditelaah hakim alinea demi alinea sebelum dapat ditandatangani. Bersamanya: ruang kerja satu layar, pemeriksaan perkara yang aturannya bertaut ke pasal, dan antrian sidang untuk ruang tunggu.",
    added: [
      "Perakit putusan: susunan baku enam bagian, duduk perkara dirangkai dari sidang dan kehadiran, butir pustaka dipilih menurut syaratnya, amar diadu dengan petitum, biaya dihitung berikut terbilangnya, dan tiap draf menyimpan riwayat versinya.",
      "Ruang kerja perkara di /perkara: berkas, riwayat, statistik, pemeriksaan, draf, dan jejak dalam satu layar. Susunan panelnya mengikuti peran.",
      "Telaah draf per alinea: hakim menerima atau menolak tiap pertimbangan, dan draf yang belum ditelaah tidak dapat ditandatangani.",
      "Rujukan pasal terbuka di tempat - bunyinya diambil dari pustaka saat rujukannya ditekan.",
      "Pemeriksaan perkara: kompetensi, syarat formil, tenggang panggilan, kelayakan verstek, peta dalil-bukti-petitum, dan pencarian perkara berpola fakta sama.",
      "Antrian sidang: layar sentuh ruang tunggu, layar televisi, dan pencarian mandiri tanpa login.",
      "Sebelas analisis lanjutan satu perkara, dimuat hanya saat tombolnya ditekan.",
      "Saklar kirim terpisah untuk pegawai dan para pihak.",
    ],
    changed: [
      "Menandatangani draf kini menuntut TIGA hal: seluruh bagian wajib terisi tanpa halangan, seluruh alinea sudah ditelaah, dan nama hakimnya. Tidak ada parameter untuk melewati satu pun.",
      "Berkas perkara menarik sumber kesebelas: dokumen e-Court beserta berkas terunduhnya.",
    ],
    fixed: [
      "Pemadan amar-petitum tidak lagi melaporkan petitum pertama sebagai terlewat pada hampir setiap perkara.",
      "Kata berhuruf kapital di awal kalimat tidak lagi tertelan ke dalam nama orang, sehingga pemeriksaan kurang pihak berhenti menuduh tiap petitum dan penyamaran berhenti mengganti nama pengadilan.",
    ],
    security: [
      "Kutipan wajib terbukti: draf yang merujuk pasal yang tidak ada di pustaka - atau peraturan yang sudah dicabut - tidak dapat dinyatakan siap.",
      "Batas data: ruas yang belum punya aturan diperlakukan terlarang, bukan diloloskan.",
      "Penyamaran bergaram per berkas, sehingga dua berkas tersamar tidak dapat disatukan kembali menjadi satu jati diri.",
      "Antrian publik tidak menjawab apa pun tanpa kata cari sekurangnya tiga huruf, dan rentangnya terkunci pada hari berjalan.",
    ],
    operationalNotes: [
      "Migrasi 0027 sampai 0029 menambah tabel draf putusan, aturan pemeriksaan, dan kolom telaah.",
      "Pustaka pertimbangan dan aturan pemeriksaan masih kosong sampai diserap dan disahkan; sebelum itu perakit tidak menghasilkan pertimbangan apa pun.",
    ],
    knownLimitations: [
      "Belum diuji di ruang sidang yang sesungguhnya.",
      "Aturan pemeriksaan perlu dimasukkan beserta jangkar pasalnya, lalu disahkan Super Admin, sebelum kolom Pemeriksaan menampilkan kesimpulan apa pun.",
    ],
  },
  {
    version: "1.83.0",
    title: "ALETA Judicia v1.83.0 - Pustaka Pertimbangan",
    date: "2026-09-05",
    status: "Operasional",
    summary:
      "Inilah yang menggantikan AI untuk sebagian besar perkara. Pertimbangan hukum yang sudah ditulis hakim pengadilan ini - 2.224 naskah, 18 juta huruf - kini dapat dipecah menjadi butir yang dipakai ulang, dan rujukan pasalnya tersambung ke pustaka hukum. Bersamanya, penarik e-Court akhirnya jadi.",
    added: [
      "Pustaka pertimbangan: alinea \"Menimbang, bahwa …\" menjadi butir yang dapat dicari, disahkan, dan dipakai ulang. Satuannya alinea, bukan putusan utuh - itulah yang benar-benar dipakai ulang hakim.",
      "Rujukan pasal DIBACA dari bunyi alineanya sendiri dan ditautkan ke jangkar pustaka hukum. Diuji terhadap putusan sungguhan: 16 dari 19 rujukan tersambung.",
      "Pemeriksaan rujukan terhadap pustaka hukum - butir yang menyebut pasal yang tidak ada di pustaka dapat ditahan SEBELUM masuk, bukan ditemukan belakangan di dalam putusan yang sudah ditandatangani.",
      "Penarik e-Court (B2): 394 dokumen dan 400 berkas terunduh kini terbaca pada halaman perkara, dibaca dari basis data bot - bukan dengan mengetuk e-Court lagi.",
      "Penggantian butir berversi: versi baru menggantikan, yang lama ditandai diganti dan menunjuk penggantinya.",
    ],
    changed: [
      "Butir dikunci pada SIDIK alineanya, sesudah nama, tanggal, dan nomor perkara dibuang. Perkara kedua yang memuat alinea yang sama tidak membuat butir baru - ia menambah hitungan pemakaian. Hitungan itu membedakan alinea baku yang dipakai dua ratus kali dari alinea khusus yang dipakai sekali.",
      "B1 dinyatakan selesai: SIPP TIDAK menyimpan BAS sama sekali - template_perkara_bas nol baris. Pengadilan ini menulis BAS di ABT. Membuat pembaca untuk tabel yang tak pernah diisi hanya menambah kode yang tampak seperti fitur.",
    ],
    fixed: [
      "Rujukan berantai \"Pasal 65 dan Pasal 82 ayat (1) … Undang-Undang Nomor 7 tahun 1989\" hanya menautkan pasal terakhir. Undang-undang itu menaungi KEDUA pasalnya; bagi yang membaca itu jelas, bagi pencocok yang hanya melihat kata berikutnya, Pasal 65 tampak tanpa peraturan. Tersambung naik dari 12 menjadi 16 dari 19.",
      "Rujukan \"ayat (1) dan ayat (4)\" hanya membaca ayat pertama, dan \"Ayat 2 Huruf b\" tidak membaca hurufnya sama sekali.",
      "Sidik butir hanya membuang separuh nama - menyisakan nama depan, sehingga alinea yang sama pada dua putusan tetap bersidik berbeda dan pustaka menjadi salinan putusan.",
      "Pengenal nama orang menuntut \"bin\" atau \"binti\" di tengahnya, sehingga nama biasa seperti \"Reka Febrianti\" tidak terdeteksi sebagai tempat kosong.",
    ],
    security: [
      "Butir masuk sebagai USULAN, tidak pernah langsung dipakai. Risiko terbesar proyek ini berpindah dari AI ke pustaka: satu butir yang keliru tidak salah sekali, melainkan salah di SETIAP putusan yang memakainya, dengan rapi dan tanpa ada yang memeriksanya lagi karena \"sudah ada di pustaka\".",
      "Pengesahan mencatat DUA hal: siapa yang menekan dan ATAS PERINTAH SIAPA - dan perintahnya wajib diisi. Tanpa yang kedua, jejaknya hanya menunjuk operator; pertanyaan yang sesungguhnya saat butir dipersoalkan bukan \"siapa yang mengetik\" melainkan \"atas dasar apa ia masuk\".",
      "Penolakan wajib beralasan. Tanpa alasan, butir yang sama diusulkan lagi pada penyerapan berikutnya dan yang menolaknya lain kali tidak tahu mengapa ia pernah ditolak.",
      "Peraturan yang tidak dikenali TIDAK ditebak jangkarnya. Rujukan yang mengarah ke peraturan keliru lebih berbahaya daripada rujukan yang belum tersambung: yang kedua terlihat, yang pertama tidak.",
      "Hanya ayat PERTAMA yang masuk jangkar. Rujukan \"ayat (1) dan ayat (4)\" menunjuk dua tempat, dan satu alamat tidak dapat mewakili keduanya.",
      "Hanya alinea \"Menimbang\" yang menjadi butir. Kepala putusan, amar, dan penutup bukan pertimbangan - memasukkannya berarti perakit kelak menyisipkan amar di tengah pertimbangan.",
      "Versi lama TIDAK dihapus saat diganti. Putusan yang sudah dijatuhkan merujuk butir yang berlaku saat itu.",
    ],
    operationalNotes: [
      "Tiga tabel baru: aleta_pertimbangan_butir, _rujukan, dan _asal, dengan kunci tunggal pada sidik alinea.",
      "Diuji terhadap putusan cerai gugat sungguhan: 29 alinea, 22 di antaranya Menimbang, 19 rujukan pasal terbaca.",
      "Penarik e-Court diuji terhadap dua perkara nyata - tiga dokumen dan tiga berkas terunduh pada masing-masing.",
      "Dua puluh uji baru untuk pemecah pertimbangan; empat cacat ditemukan olehnya sebelum sempat dipakai.",
    ],
    knownLimitations: [
      "Penyerapan masih satu perkara per panggilan; menyerap seluruh 2.224 memerlukan penjadwal.",
      "Syarat berlaku butir (D2) disimpan tetapi belum ada perakit yang memakainya - itu Tahap 5.",
      "Belum ada layar untuk mengesahkan butir; jalurnya lewat rute.",
      "Rujukan yang tidak menyebut nama peraturannya - \"Pasal 116\" pada KHI - tetap tidak tersambung, dan memang tidak boleh ditebak.",
    ],
  },
  {
    version: "1.82.0",
    title: "ALETA Judicia v1.82.0 - Pustaka Hukum",
    date: "2026-09-05",
    status: "Operasional",
    summary:
      "Naskah peraturan kini masuk pustaka dari berkas resminya, terpecah sampai pasal dan ayat, beralamat tetap, dan dapat ditanya \"apa yang berlaku pada tanggal itu\". Enam naskah dari peraturan.go.id sudah diuraikan sebagai pembuktian - dan tiga cacat naskah resmi yang tidak terduga ditemukan serta diperbaiki karenanya.",
    added: [
      "Penyerapan naskah peraturan dari PDF resmi menjadi bab, bagian, pasal, ayat, dan huruf - lengkap dengan halaman asalnya.",
      "Jangkar kutipan: tiap pasal beralamat tetap seperti uu-1-1974/pasal-39/ayat-2, dan alamat itu SAMA setiap kali naskah yang sama diurai ulang.",
      "Sebutan siap salin ke pertimbangan: \"Pasal 39 ayat (2) huruf f\", bukan alamat mesinnya.",
      "Keberlakuan pada tanggal perbuatan: peraturan yang belum berlaku atau sudah dicabut pada tanggal itu tidak dikembalikan.",
      "Pencabutan yang menyebut penggantinya - peraturan yang dicabut TIDAK dihapus, karena putusan lama merujuknya.",
      "Penautan peraturan ke 15 topik Peradilan Agama yang sudah ada di sistem.",
      "Laporan penyerapan menyebut jumlah pasal, nomor pasal yang melompat, alamat ganda, dan halaman yang terurai tanpa huruf.",
    ],
    changed: [
      "Naskah peraturan disimpan di folder milik ALETA sendiri, bukan di folder APS Badilag - folder itu tetap hanya dibaca, dan menulis ke dalamnya berarti mengubah alat kerja aplikasi lain.",
      "Mengubah pustaka menuntut kewenangan Super Admin atau Admin; membacanya cukup dengan kapabilitas panel.",
    ],
    fixed: [
      "KATA TANGKAP di kaki halaman dibaca sebagai pasal. Naskah resmi mencetak judul halaman berikutnya di kaki halaman ini - \"Pasal 2 …\" - dan ALETA membacanya sebagai pasal kembar berisi kosong. Karena alamatnya sama dengan pasal yang sesungguhnya, rujukan putusan dapat membuka yang kosong. Pada UU 1/1974 saja ia menambah dua belas pasal yang tidak ada.",
      "Kepala halaman \"PRESIDEN REPUBLIK INDONESIA\" masuk ke bunyi pasal yang melintasi halaman. Dikenali dari perulangannya sendiri, bukan dari daftar nama yang ditulis tangan - daftar tulisan tangan hanya menangkap penerbit yang sudah dikenal.",
      "Rujukan silang di tengah kalimat - \"Pasal 3 ayat (2) Undang-undang ini…\" ketika Pasal 8 sudah lewat - dibaca sebagai pasal baru. Peraturan menomori pasalnya menaik; nomor yang mundur bukan pasal baru.",
    ],
    security: [
      "SATU-SATUNYA jalan masuk naskah ke pustaka adalah berkas PDF resmi. Tidak ada jalan mengetik bunyi pasal langsung - pustaka yang memuat satu pasal yang diketik dari ingatan tidak salah sekali, melainkan salah di SETIAP putusan yang merujuknya, dengan rapi dan tanpa ada yang memeriksanya lagi karena \"sudah ada di pustaka\".",
      "Peraturan masuk sebagai DRAF. Pencarian untuk menyusun putusan hanya membaca yang sudah disahkan manusia terhadap berkas aslinya - pemecahan naskah dapat meleset, dan pasal yang terpotong di tempat yang salah terbaca wajar.",
      "PENJELASAN berdiri di ruang alamatnya sendiri. Penjelasan mengulang seluruh nomor pasal; tanpa pemisahan, Pasal 39 dan penjelasannya beralamat sama - dan kutipan yang ternyata dari penjelasannya adalah kekeliruan yang tidak terlihat pada naskah putusan.",
      "Alamat ganda DILAPORKAN, bukan disembunyikan. Naskah resmi memang menghasilkannya, dan yang membaca laporan penyerapan berhak tahu sebelum mengesahkan.",
      "Jangkar disusun dari jati diri pasal, bukan posisinya, dan nama pendek peraturan dari jenis-nomor-tahun, bukan judulnya. Judul sering ditulis berbeda antar penerbit, dan jangkar yang berubah membuat rujukan putusan lama menunjuk ke tempat yang tidak ada.",
      "Bab dan bagian sengaja tidak masuk jangkar: penataan ulang naskah sering menggeser pasal ke bab lain tanpa mengubah nomor maupun bunyinya.",
    ],
    operationalNotes: [
      "Diuji terhadap enam naskah resmi dari peraturan.go.id: UU 1/1974, UU 16/2019, UU 7/1989, UU 3/2006, UU 50/2009, dan PP 9/1975. PP 9/1975 terurai 49 pasal tanpa satu pun nomor yang melompat.",
      "Angka \"pasal hilang\" pada undang-undang PERUBAHAN memang tinggi dan itu wajar: undang-undang perubahan menyebut nomor pasal yang diubahnya, bukan menomori ulang naskahnya sendiri.",
      "Lima puluh uji baru: 28 untuk pemecah naskah, 22 untuk pustaka.",
    ],
    knownLimitations: [
      "Naskah peraturan baru enam. KHI (Inpres 1/1991), PERMA, dan SEMA menyusul - berkasnya tidak tersedia pada jalur unduhan yang sama.",
      "Belum ada layar untuk menyerap dan mengesahkan; jalurnya lewat rute.",
      "Pemecahan menyisakan sekitar satu dari lima belas pasal yang perlu dibetulkan manusia - itulah sebabnya pengesahan tidak dilewati.",
    ],
  },
  {
    version: "1.81.0",
    title: "ALETA Judicia v1.81.0 - Berkas yang Punya Riwayat",
    date: "2026-09-05",
    status: "Operasional",
    summary:
      "Berkas perkara kini menyimpan keadaannya pada tiap tanggal, bukan hanya hari ini - sehingga BAS yang menyebut dua saksi dapat dibuktikan benar pada saat ditandatangani meski SIPP kini memuat empat. Pembandingan antar sumber bertambah dari dua menjadi tujuh aturan, dan penariknya disusun menjadi satu daftar.",
    added: [
      "Riwayat berkas perkara: satu baris per PERUBAHAN, bukan per pembukaan. Tiap baris menyebut apa yang berubah - \"saksi tercatat 0 menjadi 2\" - bukan sekadar tanggal yang harus dibandingkan sendiri.",
      "Rute penyegaran yang dapat dipanggil penjadwal untuk merakit ulang satu perkara dan mencatat keadaannya bila berbeda.",
      "Lima aturan pembanding baru: nama pihak yang tidak muncul pada ringkasan perkara, majelis tanpa Hakim Ketua, panitera pengganti yang belum ditunjuk, nomor sidang yang melompat, dan keterangan saksi yang tidak menyebut satu pun pihak perkara ini.",
    ],
    changed: [
      "Sumber berkas perkara kini berdiri pada satu daftar penarik, bukan sepuluh pemanggilan yang tersebar di dalam perakit. Menambah sumber berarti menambah satu baris - dan yang dulu lupa disunting bukan pemanggilannya melainkan hal-hal di sekitarnya: nama sistemnya, tabel asalnya, bentuk kosongnya, dan penyebutan halangannya.",
      "Tiap penarik menyatakan sendiri apakah kegagalannya perlu disebut kepada petugas. Jurusita yang belum ditunjuk adalah keadaan biasa, bukan halangan - dan daftar halangan yang selalu berisi berhenti dibaca.",
    ],
    fixed: [],
    security: [
      "Waktu pengambilan TIDAK ikut disidik. Bila ikut, tiap perakitan menghasilkan sidik baru dan penjagaan \"hanya perubahan yang disimpan\" menjadi tidak berarti sama sekali - riwayatnya penuh salinan yang sama dan tidak dapat dibaca.",
      "Berkas yang gagal dirakit TIDAK dicatat. Mencatatnya berarti riwayat memuat keadaan \"semua kosong\" yang tidak pernah benar - ia hanya menandakan sumbernya sedang mati.",
      "Yang disimpan RINGKASAN, bukan salinan. Isi lengkap berkas mencapai puluhan ribu huruf karena memuat naskah pertimbangan; menyimpannya utuh tiap perubahan menjadikan tabel ini lebih besar daripada seluruh data ALETA lainnya.",
      "Kegagalan pencatatan riwayat tidak dilempar. Riwayat catatan pendamping, dan halaman perkara tidak boleh mati karena catatannya gagal ditulis.",
      "Keterangan saksi yang menyebut sebutan peran - \"Penggugat\", \"Tergugat\" - TIDAK dicurigai tersalin. Melaporkannya membuat peringatan itu muncul pada hampir seluruh perkara, lalu berhenti dibaca.",
    ],
    operationalNotes: [
      "Tabel baru aleta_berkas_riwayat, berindeks perkara dan tanggal perakitan.",
      "Dua puluh tiga uji baru: enam belas untuk riwayat dan bentuk baku penarik, tujuh untuk aturan pembanding.",
      "Nama sistem ditetapkan ALETA Judicia. Menu ALETA Judicia (Legal Form) akan diganti nama supaya tidak ada dua yang bernama sama.",
    ],
    knownLimitations: [
      "Penarik e-Court (B2) tertunda: dokumen e-Court tersimpan di basis data bot, dan membacanya menuntut perubahan pada berkas yang sedang dikerjakan pengerjaan lain.",
      "Penyegaran berkala belum dijadwalkan - rutenya sudah ada, penjadwalnya menyusul bersama B2.",
      "Riwayat belum tampil di layar; ia terbaca lewat rute.",
      "Peraturan perundang-undangan belum diserap; itu Tahap 3 (C1).",
    ],
  },
  {
    version: "1.80.0",
    title: "ALETA Judicia v1.80.0 - Pedoman Badilag Terbaca",
    date: "2026-09-05",
    status: "Operasional",
    summary:
      "Pedoman Penyusunan BAS & Putusan Badilag - 434 halaman - kini terbaca ALETA: dapat dicari, dikutip, dan disebut halamannya. Pemeriksaan sebelum cetak menampilkan bagian pedoman yang menyinggung dokumen yang sedang disusun. Yang ditampilkan KUTIPAN, bukan penilaian.",
    added: [
      "Pembacaan berkas PDF menjadi teks per halaman, dengan pencarian yang mengembalikan kutipan beserta nomor halamannya. Pedoman dirujuk di ruang sidang dengan menyebut halamannya; kutipan tanpa halaman memaksa membuka berkas aslinya lagi.",
      "Pustaka pedoman: Pedoman Penyusunan BAS & Putusan (2017), Form Kepaniteraan PA (2018), dan Contoh BAS e-Court - ketiganya dibaca langsung dari folder APS Badilag, bukan salinan.",
      "Rute pustaka: mencari di seluruh pedoman, di satu pedoman, atau membuka satu halaman utuh.",
      "Kartu Pemeriksaan Sebelum Cetak kini memuat kutipan pedoman yang menyinggung blangko yang dipilih, lengkap dengan halamannya.",
      "Nama sistem ditetapkan: ALETA Judicia - menamai sistemnya, bukan salah satu pemakainya. Panitera separuh pemakainya dan akan selalu begitu.",
    ],
    changed: [
      "Portal kini ikut memasang folder APS Badilag secara BACA-SAJA, sama seperti bot. Sebelumnya hanya bot yang dapat membacanya, sehingga tiap pembacaan pedoman harus melewati jembatan tanpa alasan.",
      "Hasil penguraian pedoman disinggahkan selama proses hidup - 434 halaman diurai sekali, bukan pada tiap pencarian. Yang disinggahkan JANJINYA, sehingga dua permintaan yang datang bersamaan berbagi satu penguraian.",
    ],
    fixed: [],
    security: [
      "Pustaka TIDAK menafsirkan pedoman dan tidak menyatakan naskah sesuai atau tidak sesuai. Menyatakan \"sesuai pedoman\" menuntut pemahaman atas maksudnya, dan pernyataan semacam itu yang keliru membuat yang membacanya berhenti memeriksa sendiri.",
      "Kutipan dicocokkan lewat kata kunci dari nama blangko, dan layar menyebutkan sendiri bahwa pencocokan itu belum tentu tepat. Pedoman dan blangko ditulis orang yang berbeda pada tahun yang berbeda.",
      "Halaman yang terurai tanpa satu pun huruf DILAPORKAN sebagai halaman tanpa teks - petunjuk berkas pindaian - bukan dibiarkan terbaca sebagai dokumen yang isinya memang kosong.",
      "Penguraian yang gagal tidak disinggahkan. Berkas yang belum terpasang saat wadah menyala akan terbaca pada permintaan berikutnya, bukan dianggap tidak ada sampai wadahnya dimulai ulang.",
      "Folder pedoman dipasang BACA-SAJA pada portal maupun bot.",
    ],
    operationalNotes: [
      "Diuji terhadap berkas sungguhan: Pedoman Penyusunan BAS & Putusan terbaca 434 halaman, daftar isinya utuh, dan pencarian \"Putus Verstek\" mengembalikan halaman 175 sebagaimana tertulis di daftar isinya.",
      "PDF-nya berlapis teks, bukan pindaian - 393 rujukan huruf berbanding 12 gambar - sehingga pembacaannya tidak memerlukan pengenalan tulisan.",
      "Empat belas uji baru untuk pembacaan PDF dan kata kunci pedoman.",
    ],
    knownLimitations: [
      "Pencocokan kutipan pedoman masih lewat kata kunci nama blangko, belum menurut isi naskahnya.",
      "Peraturan perundang-undangan - UU Perkawinan, KHI, PP, PERMA, SEMA - belum diserap; itu Tahap 3 (C1).",
      "Katalog pertanyaan tanya-jawab masih dipatok pada jenis Cerai Gugat.",
      "Penanda hitungan ABT - amar, biaya perkara, sumpah saksi, seluruh keterangan kuasa hukum - masih diisi panitera di Word.",
    ],
  },
  {
    version: "1.79.0",
    title: "ALETA v1.79.0 - Yang Sudah Diperiksa Tidak Diketik Ulang",
    date: "2026-09-05",
    status: "Operasional",
    summary:
      "Keterangan saksi yang sudah terekam di APS Badilag kini terbaca di lembar dan masuk ke naskah. Untuk perkara yang pemeriksaannya sudah berlangsung, keterangan itu SUDAH ADA - menuntut panitera mengetiknya ulang adalah persis pekerjaan yang modul ini dibuat untuk menghapus.",
    added: [
      "Rekaman ABT tampil berdampingan dengan lembar tanya-jawab: pertanyaan dan jawaban yang sudah tercatat pada pemeriksaan sebelumnya, per saksi.",
      "Tiap baris rekaman dapat disalin ke pertanyaan yang dipilih panitera - satu tindakan sadar, bukan pemindahan otomatis.",
      "Saksi yang keterangannya sudah terekam ABT tetapi belum punya lembar ALETA kini mengisi penanda #5058#/#5059# pada naskah, sehingga BAS perkara lama dapat langsung tersusun.",
      "Pemeriksaan sebelum cetak menghitung saksi ABT sebagai saksi yang sudah diperiksa - tidak lagi menuntut pengetikan ulang atas keterangan yang sudah tercatat.",
    ],
    changed: [
      "Jembatan bot MENYATAKAN nomor urut saksi (saksiKe), tidak menitipkannya pada urutan larik. saksi_id di ABT bernomor global - 17346, 17347 - bukan \"saksi ke-1\" dan \"ke-2\"; membiarkan pembaca menyimpulkannya dari posisi berarti satu perubahan urutan memindahkan keterangan saksi pertama ke tempat saksi kedua tanpa satu pun tanda di layar.",
    ],
    fixed: [],
    security: [
      "LEMBAR ALETA SELALU MENANG. Saksi yang lembarnya sudah diisi panitera dilewati sepenuhnya oleh rekaman ABT. Menimpanya berarti keterangan yang baru saja diketik lenyap dari naskah tanpa ia mengetahuinya, dan yang tercetak adalah keadaan sebelum ALETA disentuh.",
      "Rekaman ABT dipakai sebagai PASANGAN UTUH - pertanyaan dan jawabannya bersama-sama - bukan dicocokkan per jawaban ke pertanyaan katalog. Urutan di ABT tidak dijamin sama, dan jawaban yang mendarat di bawah pertanyaan yang keliru terbaca masuk akal justru saat ia paling salah.",
      "Rekaman TIDAK dituangkan sendiri ke kotak jawaban di layar. Yang memindahkannya harus panitera, yang dapat membaca keduanya sekaligus.",
      "Jati diri saksi TIDAK diambil dari ABT - ABT hanya menyimpan tanya-jawabnya. Pemeriksaan tetap menyebut jati diri itu perlu dilengkapi, bukan menganggapnya sudah ada.",
      "Asal penanda menyebut APS Badilag, bukan ALETA. Yang membaca naskah berhak tahu keterangan itu berasal dari rekaman lama, bukan dari yang diketik hari ini.",
    ],
    operationalNotes: [
      "Sumbernya 65.526 tanya-jawab dari 4.529 saksi yang sudah terekam ABT - bukan ringkasan melainkan transkrip pemeriksaan.",
      "Dua belas uji baru, memakai salinan dari abt_keterangan_saksi perkara 521/Pdt.G/2026 di server, termasuk saksi_id bernomor global.",
    ],
    knownLimitations: [
      "Pemeriksaan terhadap isi Pedoman Penyusunan BAS & Putusan Badilag belum ada; naskahnya masih PDF dan pembacaannya adalah pekerjaan Tahap 3.",
      "Katalog pertanyaan tanya-jawab masih dipatok pada jenis Cerai Gugat.",
      "Penanda hitungan ABT - amar, biaya perkara, sumpah saksi menurut agamanya, identitas otomatis, dan seluruh keterangan kuasa hukum - masih diisi panitera di Word.",
    ],
  },
  {
    version: "1.78.0",
    title: "ALETA v1.78.0 - Siapa yang Hadir Hari Ini",
    date: "2026-09-05",
    status: "Operasional",
    summary:
      "Kehadiran para pihak dapat dicatat, dan itu menutup satu-satunya isian BAS yang tidak dapat dibaca dari mana pun: SIPP mencatat \"dihadiri oleh 2\" sebagai angka, tanpa menyebut Penggugat sendiri, kuasanya, atau keduanya. Bersamanya, sembilan penanda lain kini terisi sendiri karena SIPP ternyata sudah menyimpannya.",
    added: [
      "Kartu Sidang Hari Ini: agenda, tanggal, ruangan, dan penundaan ditampilkan apa adanya dari SIPP - tidak ditanyakan lagi. Yang ditanyakan hanya kehadiran.",
      "Bunyi kehadiran yang lazim dapat dipilih tanpa mengetik, tetapi kotaknya tetap bebas diketik. Daftar tertutup memaksa panitera memilih yang paling mendekati lalu menuliskan yang tidak terjadi.",
      "Penanda kehadiran #1072# dan #1073# terisi dari catatan itu.",
      "Ketua majelis #4004# terisi dari jabatannya di SIPP, ruang sidang #1261#, hari dan tanggal penundaan #0133#/#0134#, nama panitera pengganti #0015#, serta zona waktu #0150#.",
      "Pemeriksaan sebelum cetak kini menyebut kehadiran yang belum dicatat sebagai halangan - tetapi hanya pada blangko yang memang menanyakannya.",
    ],
    changed: [
      "Jembatan bot meneruskan JABATAN yang sesungguhnya tercatat SIPP, bukan sebutan seragam. perkara_hakim_pn membedakan \"Hakim Ketua\" dari \"Hakim Anggota\", dan menyeragamkannya menjadi \"Hakim\" membuang satu-satunya keterangan yang membedakannya.",
      "Zona waktu dan nama satker dibaca dari lingkungan (ALETA_ZONA_WAKTU, ALETA_NAMA_SATKER), supaya satker di zona lain tinggal mengubahnya.",
    ],
    fixed: [],
    security: [
      "Kehadiran disimpan SATU BARIS PER SIDANG, bukan per perkara. Kehadiran berubah dari satu sidang ke sidang berikutnya - itulah sebabnya ia ada. Yang terbawa antarsidang menghasilkan BAS yang menyatakan seseorang hadir di persidangan yang tidak pernah ia datangi.",
      "Kehadiran yang kosong TIDAK diisi tebakan. Penanda yang dibiarkan masih terlihat; kalimat yang ditebak terbaca wajar dan tidak ada yang memeriksanya lagi.",
      "Ketua majelis dibaca dari jabatannya, dan bila tidak ada satu pun yang berjabatan ketua penandanya DIBIARKAN - bukan diambil hakim pertama. Menebaknya berarti menetapkan siapa yang memimpin persidangan menurut naskah resmi, atas dasar urutan baris yang tidak menjanjikan apa pun.",
      "Hari dan tanggal penundaan hanya diisi bila SIPP benar-benar mencatat penundaannya. Menebaknya berarti BAS memerintahkan para pihak hadir pada tanggal yang tidak pernah ditetapkan.",
      "Catatan hasil sidang di ALETA tidak pernah menimpa SIPP; ia hanya mengisi ketika SIPP masih kosong.",
    ],
    operationalNotes: [
      "Tabel baru aleta_bas_kehadiran, dengan kunci tunggal per perkara dan nomor sidang.",
      "Tiga belas uji baru: sepuluh untuk pencatatan kehadiran, tiga untuk ketua majelis dan pengaturan satker.",
    ],
    knownLimitations: [
      "Pemeriksaan terhadap isi Pedoman Penyusunan BAS & Putusan Badilag belum ada; naskahnya masih PDF dan pembacaannya adalah pekerjaan Tahap 3.",
      "Katalog pertanyaan tanya-jawab masih dipatok pada jenis Cerai Gugat.",
      "Keterangan saksi lama di ABT terbaca sebagai jumlah, tetapi belum dapat dibuka sebagai rujukan saat mengisi lembar.",
      "Penanda hitungan ABT - amar, biaya perkara, sumpah saksi menurut agamanya, identitas otomatis - masih diisi panitera di Word.",
    ],
  },
  {
    version: "1.77.0",
    title: "ALETA v1.77.0 - Diperiksa Sebelum Dicetak",
    date: "2026-09-05",
    status: "Operasional",
    summary:
      "Naskah dapat diperiksa kesiapannya sebelum diunduh: saksi yang kurang, jati diri yang belum lengkap, sumpah yang belum dapat ditentukan, sidang yang belum tercatat, dan bagian mana yang masih akan bertanda. Yang diperiksa hanya yang benar-benar dapat dipastikan - pedoman Badilag masih berupa PDF dan ALETA tidak berpura-pura sudah membacanya.",
    added: [
      "Tombol Periksa pada tiap blangko, dan kartu Pemeriksaan Sebelum Cetak yang menyebut temuannya beserta apa yang harus dikerjakan.",
      "Tiga tingkat temuan: perlu dibereskan, periksa, dan catatan - halangan selalu berdiri paling depan.",
      "Jumlah saksi yang dituntut blangko dibaca dari dua sumber: nama berkasnya yang menyebut \"(3 Saksi)\", dan tempat tanya-jawab di dalamnya. Yang terbesar yang dipakai.",
      "Peringatan tersendiri bila blangko memuat sumpah saksi sementara agama saksinya belum diisi - lafal sumpah mengikuti agama.",
      "Bagian yang tersisa disebut DENGAN NAMANYA, bukan nomor penandanya: \"amar putusan dan amar biaya perkara\", bukan \"4001 dan 8505\". Nomor variabel yang harus dihafal persis yang membuat JLF terasa memusingkan.",
    ],
    changed: [
      "Pemeriksaan memakai peta penanda yang PERSIS SAMA dengan yang dipakai rute naskah. Pemeriksaan yang menghitungnya sendiri pasti berselisih dengan naskahnya cepat atau lambat - lalu menyatakan lengkap atas naskah yang ternyata masih bertanda.",
    ],
    fixed: [],
    security: [
      "Pemeriksaan TIDAK menghalangi unduhan. Panitera kadang memang perlu mencetak naskah yang belum lengkap untuk dibawa ke ruang sidang dan diisi tangan. Alat yang melarang pada saat yang salah akan ditinggalkan, dan yang ditinggalkan tidak memeriksa apa pun.",
      "Jumlah saksi yang dituntut diambil yang TERBESAR dari dua sumber, bukan yang terkecil. Mengambil yang terkecil berarti kekurangan saksi lolos tanpa disebut.",
      "Lembar yang ada tetapi belum satu pun terjawab TIDAK dihitung sebagai saksi yang sudah terisi. Menghitungnya berarti pemeriksaan menyatakan cukup atas saksi yang keterangannya belum ada sama sekali.",
      "Kartu pemeriksaan menyebutkan sendiri bahwa pedoman Badilag belum terbaca. Pemeriksaan yang mengaku menegakkan pedoman padahal hanya memeriksa kekosongan lebih berbahaya daripada tidak ada pemeriksaan: yang membacanya berhenti memeriksa sendiri.",
    ],
    operationalNotes: [
      "Operasi baru pada jembatan bot: abt.namaVariabel, membaca nama dan jenis variabel ABT untuk sekumpulan penanda. Dibatasi 300 nomor sekali baca.",
      "Dua puluh uji baru, dengan penekanan pada temuan yang TERLEWAT - bukan pada temuan yang muncul.",
    ],
    knownLimitations: [
      "Pemeriksaan terhadap isi Pedoman Penyusunan BAS & Putusan Badilag belum ada; naskahnya masih PDF dan pembacaannya adalah pekerjaan Tahap 3.",
      "Katalog pertanyaan tanya-jawab masih dipatok pada jenis Cerai Gugat.",
      "Nama tabel masih tampil pada daftar berkas perkara - melanggar prinsip rencana sendiri.",
      "Penanda hitungan ABT - amar, biaya perkara, sumpah saksi menurut agamanya - masih diisi panitera di Word.",
    ],
  },
  {
    version: "1.76.0",
    title: "ALETA v1.76.0 - Sidang yang Menyambung",
    date: "2026-09-05",
    status: "Operasional",
    summary:
      "BAS berikutnya kini tahu apa yang terjadi pada sidang sebelumnya - dan itu ternyata tidak menuntut ALETA mengarang atau menyalin apa pun. perkara_jadwal_sidang di SIPP sudah menyimpan sambungannya: sidang ke berapa, agendanya, apakah ditunda dan mengapa, serta tanggal dan agenda sidang sebelumnya.",
    added: [
      "Hari, tanggal, dan sebutan sidang terisi sendiri pada naskah - penanda #0032#, #0033#, dan #9003#. Ketiganya bertipe multi_sidang di ABT: memang berubah dari satu BAS ke BAS berikutnya, dan itulah sebabnya bagian ini perlu ada.",
      "Keterangan sidang sebelumnya tampil di layar saat blangkonya dipilih - tanggal, agenda, dan alasan penundaannya. Panitera tidak perlu membuka SIPP di tab lain untuk mengingatnya.",
      "Peringatan bila sidang yang blangkonya dipilih belum tercatat di SIPP, sehingga terlihat SEBELUM naskahnya diunduh, bukan sesudah dibuka di Word.",
    ],
    changed: [
      "Nomor sidang diambil dari blangko yang dipilih - blangko \"BAS 2\" memang untuk sidang ke-2. Pertanyaan yang tidak perlu diajukan adalah pertanyaan yang tidak dapat dijawab keliru.",
    ],
    fixed: [],
    security: [
      "Rangkaian diurutkan menurut NOMOR SIDANG, bukan urutan baris dari basis data. SIPP mengembalikan sidang ke-2 lebih dulu pada perkara yang diuji, dan BAS yang menyebut sidang ke-2 sebagai sidang pertama tidak dapat ditarik setelah ditandatangani.",
      "Sidang yang belum tercatat mengembalikan kosong, BUKAN sidang terdekat. Mengambil yang terdekat berarti BAS sidang ke-3 memuat tanggal sidang ke-2 - dan tanggal itu terbaca wajar sehingga tidak ada yang memeriksanya.",
      "Hari dan tanggal dibaca dengan aturan zona yang sama. Bila berbeda, BAS dapat menyebut \"Senin, 2 September 2026\" untuk tanggal yang jatuh pada Selasa - keduanya tertulis pada naskah yang sama.",
      "Sebutan \"Pertama\" hanya untuk sidang ke-1; sidang tanpa nomor tidak diisi sama sekali. Menebaknya berarti BAS lanjutan menyebut dirinya sidang pertama, atau sebaliknya.",
    ],
    operationalNotes: [
      "Lima belas uji baru, memakai salinan apa adanya dari perkara_jadwal_sidang perkara 521/Pdt.G/2026/PA.Dgl di server - termasuk kebiasaan SIPP menyimpan angka sebagai teks dan menandai penundaan dengan \"Y\"/\"T\".",
    ],
    knownLimitations: [
      "Pemeriksaan kelengkapan terhadap pedoman Badilag belum ada.",
      "Katalog pertanyaan tanya-jawab masih dipatok pada jenis Cerai Gugat.",
      "Nama tabel masih tampil pada daftar berkas perkara - melanggar prinsip rencana sendiri, dan akan diganti bahasa panitera.",
      "Penanda hitungan ABT - amar, biaya perkara, sumpah saksi menurut agamanya - masih diisi panitera.",
    ],
  },
  {
    version: "1.75.0",
    title: "ALETA v1.75.0 - Memilih Seperti di Ruang Sidang",
    date: "2026-09-05",
    status: "Operasional",
    summary:
      "Blangko dipilih berjenjang, dengan urutan yang sama dengan urutan panitera berpikir: perkara apa ini, sidang ke berapa, apa yang terjadi hari ini. Jenjangnya dibaca dari nama berkas APS Badilag sendiri - bukan dari daftar yang ditulis tangan dan harus dijaga tetap cocok.",
    added: [
      "Pemilihan berjenjang: kumpulan blangko, lalu sidang ke berapa (untuk BAS) atau bagaimana perkara berakhir (untuk putusan), lalu blangkonya.",
      "Kumpulan yang sesuai jenis perkara berdiri paling depan dan bertanda \"sesuai perkara ini\" - jenis perkaranya sudah dijawab SIPP, jadi tidak ditanyakan lagi.",
      "Sebelas kumpulan blangko kini terjangkau, dari empat sebelumnya: BAS Verstek, BAS Contra, BAS Itsbat Nikah, BAS Asal Usul Anak, serta putusan CG, CT, kumulasi itsbat, itsbat nikah, dispensasi kawin, kebendaan, dan perwalian.",
      "Nomor sidang, keadaan kehadiran, dan tindakan diuraikan dari nama berkas - sehingga \"BAS 2 P Hadir & T Tidak Hadir - Putusan Verstek\" menjadi tiga tingkat yang dapat dipilih, bukan satu baris panjang yang harus dibaca utuh.",
    ],
    changed: [
      "Nama blangko di dalam daftar tidak lagi mengulang nomor sidang - itu sudah menjadi nama tingkatnya. Yang tersisa justru yang membedakan satu blangko dari tetangganya: siapa yang hadir, dan apa yang terjadi.",
      "Tingkat yang hanya punya satu pilihan terbuka sendiri. Menuntut satu ketukan untuk pilihan yang tidak punya alternatif hanya menambah pekerjaan.",
      "Daftar blangko tidak lagi diambil bersama berkas perkara; ia dimuat saat kumpulannya dipilih, sehingga membuka perkara terasa lebih ringan.",
    ],
    fixed: [
      "Kumpulan blangko yang tidak sesuai jenis perkara dulu sama-sama berdiri sejajar, sehingga panitera cerai gugat tetap harus menyaring blangko dispensasi kawin. Sekarang ia turun, tetapi TIDAK hilang - perkara kadang menuntut blangko yang tidak lazim, dan yang disembunyikan akan dicari di luar ALETA lalu tidak kembali.",
    ],
    security: [
      "Jenjangnya dibaca dari nama berkas, bukan dari daftar tulisan tangan. Daftar tulisan tangan harus dijaga tetap cocok dengan folder yang isinya berubah tanpa sepengetahuan ALETA - dan begitu keduanya berselisih, yang muncul di layar adalah blangko yang tidak ada, atau blangko yang ada tetapi tidak terlihat.",
      "Blangko yang namanya tidak mengikuti pola TIDAK dibuang; ia masuk tingkat \"Lainnya\" yang berdiri di akhir. Blangko yang lenyap dari jenjang akan dicari panitera di luar ALETA.",
      "Keadaan dipisah dari tindakan pada tanda hubung PERTAMA, bukan terakhir. Pemisahan pada yang terakhir memotong \"Putusan Verstek - (3 Saksi)\" di tempat yang salah, dan keadaan sidang berpindah menjadi bagian dari tindakan.",
    ],
    operationalNotes: [
      "Diuji terhadap folder sungguhan di server: BAS Verstek menjadi 2 tingkat berisi 7 blangko, BAS Contra menjadi 9 tingkat sidang berisi 13 blangko, dan Putusan Cerai Gugat menjadi 6 skenario akhir berisi 12 blangko.",
      "Dua belas uji baru khusus penjenjangan, memakai nama berkas sungguhan - termasuk penjagaan agar tidak ada blangko yang hilang saat dijenjangkan.",
    ],
    knownLimitations: [
      "Pemeriksaan kelengkapan terhadap pedoman Badilag belum ada.",
      "BAS berikutnya belum tahu apa yang terjadi pada sidang sebelumnya.",
      "Katalog pertanyaan tanya-jawab masih dipatok pada jenis Cerai Gugat.",
      "Nama tabel masih tampil pada daftar berkas perkara - melanggar prinsip rencana sendiri, dan akan diganti bahasa panitera.",
    ],
  },
  {
    version: "1.74.0",
    title: "ALETA v1.74.0 - BAS yang Dapat Ditulis",
    date: "2026-09-05",
    status: "Operasional",
    summary:
      "Sampai rilis lalu alat bantu tulis BAS hanya dapat MEMBACA - pertanyaan terbaca, penanda terisi, blangko terunduh, tetapi tidak ada satu pun tempat menyimpan apa yang dikatakan saksi hari ini. Rilis ini menutup jarak itu: lembar dapat diisi, disimpan, dibuka kembali, dan jawabannya masuk ke naskah BAS.",
    added: [
      "Lembar tanya-jawab yang dapat diisi. Tiap pertanyaan punya kotak jawabannya sendiri, tersimpan ke ALETA, dan terbaca kembali saat lembarnya dibuka lagi.",
      "Jati diri saksi - nama, umur, agama, pendidikan, pekerjaan, alamat - dicatat pada lembar dan masuk ke penanda #1197# sampai #1202# untuk saksi pertama, #1203# sampai #1208# untuk saksi kedua.",
      "Tanya-jawab masuk ke naskah pada penanda #5058# dan #5059#, tersusun sebagai tanya lalu jawab seperti bentuk ABT.",
      "Tombol \"Pakai contoh\" menyalin jawaban contoh ABT ke kotak isian - sekali tekan, atas kehendak panitera.",
      "Pemilih saksi ke berapa, sehingga satu perkara dapat memuat beberapa lembar yang masing-masing berdiri sendiri.",
      "Penanda \"tersimpan pukul sekian\" dan peringatan bila ada perubahan yang belum disimpan.",
    ],
    changed: [
      "Layar lembar tanya-jawab yang dulu hanya menampilkan pertanyaan kini menjadi tempat bekerja. Menampilkan tanpa dapat mengisi berarti panitera tetap mengetik di Word - dan seluruh pekerjaan ALETA berhenti tepat sebelum bagian yang paling memakan waktu.",
      "Naskah BAS kini dirakit dari DUA sumber: berkas perkara lalu lembar BAS di atasnya. Keterangan yang diketik panitera di persidangan berhak menimpa apa pun yang terbaca dari sistem lain untuk penanda yang sama - ia yang benar-benar terjadi hari itu.",
    ],
    fixed: [
      "Layar mengaku merakit berkas dari e-Court padahal tidak ada satu pun bagian yang menariknya - sepuluh sumbernya SIPP semua kecuali satu dari APS Badilag. Keterangan itu dicabut. Penariknya menyusul; yang tidak boleh adalah layar menyatakan sesuatu yang belum ada.",
      "Daftar lembar dibaca dengan subkueri berkorelasi yang tidak dikenali basis data dalam memori - halaman ini akan mati justru pada keadaan darurat yang membuat cadangan itu ada. Diganti dua pembacaan biasa yang digabung di aplikasi.",
    ],
    security: [
      "Jawaban contoh ABT TIDAK pernah masuk dengan sendirinya. Ia tampil sebagai bayangan di kotak isian dan hanya tersimpan bila panitera menekan \"Pakai contoh\". Jawaban contoh yang diam-diam menjadi jawaban tersimpan berarti BAS memuat keterangan yang tidak pernah dikatakan siapa pun - dan bunyinya begitu wajar sehingga tidak ada yang memeriksanya lagi.",
      "Bunyi pertanyaan IKUT disimpan, bukan hanya nomornya. Kalau bunyinya diambil ulang dari ABT tiap kali dibaca, setiap perubahan katalog ABT akan mengubah bunyi BAS yang SUDAH ditandatangani. Naskah resmi tidak boleh bergeser di bawah tanda tangan yang sudah membubuhinya.",
      "Menyimpan sebagian TIDAK menghapus jawaban yang sudah ada. Sidang berjalan sementara lembarnya diisi, jadi penyimpanan terjadi berkali-kali dalam keadaan setengah jadi; penyimpanan yang berhasil sambil diam-diam menghapus bagian sebelumnya jauh lebih berbahaya daripada penyimpanan yang gagal, karena keterangan saksi tidak dapat diulang - saksinya sudah pulang.",
      "Lembar saksi ketiga dan seterusnya TIDAK menumpang tempat milik saksi lain pada blangko. Blangko hanya menyediakan dua tempat; menaruh saksi ketiga di salah satunya menghasilkan BAS yang menyebut keterangan orang yang keliru.",
      "Keterangan saksi lama dari ABT sengaja TIDAK dicocokkan ke pertanyaan menurut urutan. Urutan di sana tidak dijamin sama, dan jawaban yang mendarat di bawah pertanyaan yang keliru akan terbaca masuk akal justru saat ia paling salah.",
      "APS Badilag tetap HANYA DIBACA. Jawaban ALETA disimpan di tabelnya sendiri, tidak pernah ditulis ke abt_keterangan_saksi.",
    ],
    operationalNotes: [
      "Dua tabel baru: aleta_bas_lembar dan aleta_bas_jawaban, dengan kunci tunggal per perkara, kumpulan, dan urutan saksi.",
      "Tiga belas uji baru khusus penyimpanan lembar, termasuk penjagaan agar penyimpanan sebagian tidak menghapus sisanya.",
    ],
    knownLimitations: [
      "Pemilihan blangko masih datar - jenis perkara, skenario akhir, dan sidang ke berapa belum berjenjang seperti ABT.",
      "Pemeriksaan kelengkapan terhadap pedoman Badilag belum ada.",
      "BAS berikutnya belum tahu apa yang terjadi pada sidang sebelumnya.",
      "Nama tabel masih tampil pada daftar berkas perkara - itu melanggar prinsip rencana sendiri dan akan diganti bahasa panitera.",
    ],
  },
  {
    version: "1.73.0",
    title: "ALETA v1.73.0 - Perkara yang Benar, Blangko yang Benar",
    date: "2026-09-05",
    status: "Operasional",
    summary:
      "Uji pemakaian pertama menemukan empat hal yang salah, dan dua di antaranya berbahaya: mengetik \"324\" membuka perkara tahun 2015 tanpa ada apa pun di layar yang memberitahu, dan halaman alat bantu tulis BAS justru menampilkan blangko putusan. Keduanya diperbaiki di rilis ini, bersama pengisian penanda yang jauh lebih lengkap.",
    added: [
      "Kartu Alat Bantu Tulis BAS di dasbor. Sebelumnya halamannya hanya dapat dicapai bila alamatnya diingat - dan alat sehari-hari yang harus diingat alamatnya akan berhenti dipakai.",
      "Pemilih kumpulan blangko: BAS Verstek Perceraian, BAS Contra Perceraian, BAS Itsbat Nikah, BAS Asal Usul Anak, dan Putusan Perceraian CG - masing-masing dengan namanya sendiri.",
      "Tanggal surat gugatan terbaca dari SIPP (perkara.tanggal_surat). Berbeda dengan tanggal pendaftaran, dan blangko menyebut keduanya di kalimat yang berbeda.",
      "Daftar pilihan ketika nomor yang diketik mengenai lebih dari satu perkara, lengkap dengan jenis dan tanggal daftarnya.",
    ],
    changed: [
      "Peta penanda tumbuh dari 3 menjadi 17, seluruhnya menurut pernyataan ABT sendiri di tabel abt_variabel - nomor variabelnya tidak ditebak. Termasuk jenis perkara, tanggal surat, tanggal daftar, majelis hakim, panitera pengganti, jurusita, dan nama satker.",
      "Sebutan yang mengikuti jenis perkara kini terisi sendiri: \"gugatan\" atau \"permohonan\", \"putusan\" atau \"penetapan\". Cerai Talak tetap disebut permohonan meski terdaftar sebagai Pdt.G - kode register saja tidak cukup untuk menentukannya.",
      "Nama satker diambil dari lingkungan (ALETA_NAMA_SATKER), bukan ditulis di dalam kode, supaya satker lain tinggal mengubahnya.",
    ],
    fixed: [
      "MENGETIK NOMOR SEPOTONG MEMBUKA PERKARA YANG SALAH. Angka bulat seperti \"324\" ditafsirkan sebagai id basis data, sehingga yang terbuka perkara 0302/Pdt.G/2015/PA.Dgl - perkara lain dari tahun yang sama sekali berbeda, tanpa satu pun tanda di layar bahwa penafsiran itu terjadi. Sekarang yang diketik SELALU diperlakukan sebagai nomor perkara.",
      "Pencarian yang mengenai banyak perkara langsung membuka yang pertama. Sekarang daftarnya yang ditampilkan dan yang memilih adalah petugas - karena hanya petugas yang tahu perkara mana yang dimaksudnya.",
      "Halaman Alat Bantu Tulis BAS menampilkan blangko PUTUSAN, bukan BAS. Blangko BAS berada di folder yang berbeda di APS Badilag, dan yang tampil sebelumnya sama sekali bukan yang dicari panitera.",
      "Kartu Alat Bantu Tulis BAS tidak pernah muncul di dasbor: entrinya terdaftar sebagai modul, sedangkan dasbor membaca daftar aplikasi portal. Sekarang terdaftar di keduanya, dan termasuk daftar bawaan sehingga panitera - yang paling membutuhkannya - ikut melihatnya.",
    ],
    security: [
      "Penanda yang di ABT dihitung dengan aturannya sendiri - amar, penanda otomatis, sumpah menurut agama saksi, isian per sidang - TETAP tidak diisi. Menyalin bentuknya berdasarkan tebakan berarti menaruh kalimat yang tampak benar ke dalam dokumen yang ditandatangani, dan kalimat yang tampak benar jauh lebih sulit ketahuan keliru daripada penanda yang masih terlihat.",
      "Tanggal dibaca sebagai UTC, bukan waktu setempat. SIPP mengirim tengah malam UTC; menafsirkannya sebagai waktu setempat menggeser tanggalnya satu hari pada mesin di sebelah barat - dan tanggal yang meleset sehari pada BAS adalah tanggal sidang yang salah.",
      "Nilai kosong tidak dimasukkan ke peta. Penanda yang diganti teks kosong lenyap menjadi ruang kosong pada naskah resmi; penanda yang dibiarkan masih terlihat.",
    ],
    operationalNotes: [
      "Temuan ini berasal dari uji pemakaian sungguhan, bukan dari uji otomatis - keduanya lolos. Uji otomatis menjaga yang sudah diketahui; yang belum diketahui hanya muncul saat alatnya dipakai orang yang tahu pekerjaannya.",
      "Uji peta penanda bertambah sembilan, termasuk penjagaan agar penanda hitungan ABT TIDAK ikut terisi.",
    ],
    knownLimitations: [
      "Jawaban saksi pada lembar tanya-jawab belum dapat disimpan kembali dari ALETA - lembarnya terisi dan terbaca, penulisannya masih di ABT.",
      "Katalog pertanyaan masih dipatok pada jenis Cerai Gugat. Perkara jenis lain membuka blangkonya, tetapi daftar pemeriksaannya belum menyesuaikan.",
      "Penanda hitungan ABT - amar, biaya perkara, sumpah saksi, isian per sidang - masih diisi panitera. Menyusulkannya memerlukan aturan ABT dibaca satu per satu, bukan ditebak.",
    ],
  },
  {
    version: "1.72.0",
    title: "ALETA v1.72.0 - Blangko Terbaca dan Terisi",
    date: "2026-09-05",
    status: "Operasional",
    summary:
      "Blangko BAS dan putusan APS Badilag selama ini hanya dapat dibuka dari ABT. Rilis ini membuat ALETA membacanya langsung dari folder yang sama - bukan salinan - lalu mengisi bagian yang sudah pasti dari berkas perkara dan menyerahkannya kembali dalam bentuk aslinya. Yang belum pasti tetap bertanda, dan disebutkan.",
    added: [
      "Layar Alat Bantu Tulis BAS untuk panitera. Susunannya mengikuti urutan kerja di ruang sidang - buka perkaranya, lihat berkasnya, pilih pemeriksaan hari ini - bukan susunan tabel basis data. Tidak ada satu pun nama variabel atau nama kolom yang muncul di layar.",
      "Blangko APS Badilag terbaca dari ALETA. Foldernya dipasang APA ADANYA dan HANYA-BACA ke dalam bot, sehingga yang muncul di ALETA sama persis dengan yang dipegang panitera di ABT - bukan salinan yang perlahan berbeda karena tidak ada yang ingat menyalinnya lagi.",
      "Pratinjau isi blangko: teks kalimatnya diambil dari RTF supaya panitera tahu blangko mana yang dibukanya sebelum mengunduh, beserta jumlah bagian yang harus terisi.",
      "Unduh blangko yang sudah terisi. Nomor perkara serta nama Penggugat dan Tergugat diisi dari SIPP, lalu berkasnya diserahkan sebagai RTF yang langsung dibuka di Word.",
    ],
    changed: [
      "Peta penanda kini SATU untuk lembar tanya-jawab maupun naskah blangko. Dua peta terpisah pasti berselisih, dan wujud selisihnya adalah BAS dan putusan yang menyebut nama berbeda untuk perkara yang sama.",
      "Rute blangko melayani dua permintaan: daftar blangko satu folder, dan isi satu blangko. Keduanya menjawab pertanyaan yang sama dari sudut berbeda - blangko mana yang hendak dipakai hari ini.",
    ],
    fixed: [
      "Pembaca RTF sempat menampilkan tabel huruf, tabel penomoran, dan perintah medan Word sebagai teks. Bagian-bagian itu kini dilewati, sehingga pratinjau memperlihatkan kalimat yang sesungguhnya dibaca hakim.",
    ],
    security: [
      "Folder blangko dipasang HANYA-BACA. ABT adalah alat kerja panitera yang dipakai setiap hari; blangkonya boleh dibaca ALETA, tidak boleh diubah dari luar tanpa sepengetahuan yang memakainya.",
      "Jalur berkas dijaga di sisi bot, tempat akar folder itu benar-benar berada, dan hanya di situ. Permintaan yang keluar dari akar - termasuk yang memakai ../ - ditolak sebelum berkas dibuka.",
      "Nilai yang dimasukkan ke dalam RTF dilepaskan lebih dulu, sehingga nama yang memuat tanda kurung kurawal atau garis miring terbalik tidak dapat merusak - atau menyisipkan - perintah pada naskah resmi.",
      "Penanda yang tidak dapat dipastikan dari berkas DIBIARKAN utuh, tidak ditebak, dan jumlahnya dilaporkan pada kepala jawaban unduhan. Penanda yang lenyap menjadi ruang kosong baru ketahuan setelah ditandatangani.",
    ],
    operationalNotes: [
      "Diuji terhadap blangko [01] [Kabul Verstek] Cerai (Format Lengkap).rtf - 143.721 bita, 75 penanda, 138 kemunculan - memakai data nyata perkara 551/Pdt.G/2026/PA.Dgl. Hasilnya 3 penanda terisi, 72 dibiarkan, berkas keluaran 144.910 bita dan tetap RTF yang sah.",
      "Blangko diserahkan dalam BENTUK ASLINYA, bukan naskah yang disusun ulang ALETA. Tata letak, huruf, penomoran, dan tabelnya persis seperti bentuk baku Badilag karena yang diganti hanya penandanya.",
    ],
    knownLimitations: [
      "Peta penanda masih memuat tiga: nomor perkara, Penggugat, dan Tergugat. Yang berikutnya sudah terbaca arahnya dari APS Badilag - tanggal daftar, tanggal surat gugatan, majelis hakim, dan rincian biaya perkara - tetapi ditambahkan setelah bentuk yang diharapkan tiap penanda dipastikan, bukan ditebak lalu salah pada perkara yang tidak terduga.",
      "Baru satu set blangko yang dipakai: Perceraian CG milik derry_briantono. Folder induk memuat 74 set warisan APS Badilag, dan daftar yang terlalu panjang berhenti dibaca.",
      "Jawaban saksi pada lembar tanya-jawab belum dapat disimpan kembali dari ALETA - lembarnya terisi dan terbaca, penulisannya masih di ABT.",
    ],
  },
  {
    version: "1.71.0",
    title: "ALETA v1.71.0 - Satu Berkas Perkara",
    date: "2026-09-05",
    status: "Operasional",
    summary:
      "SIPP, e-Court, dan APS Badilag menyimpan potongan perkara yang sama di tiga tempat, dan selama tiap fitur menariknya sendiri-sendiri ketiganya berselisih diam-diam. Rilis ini merakitnya sekali menjadi satu berkas perkara yang membawa asal-usul tiap butirnya - lalu memakainya untuk mengisi lembar tanya-jawab BAS, sehingga yang sudah ada di SIPP tidak diketik ulang.",
    added: [
      "Berkas Perkara Terpadu: identitas, para pihak, majelis, panitera, juru sita, riwayat sidang, saksi, putusan, dan pertimbangan hukum dirakit dalam satu jawaban. Sepuluh sumber diambil BERSAMAAN, bukan berurutan - sepuluh pembacaan berantai menjadikan halaman perkara terasa berat tanpa alasan, dan halaman yang terasa berat adalah halaman yang ditinggalkan.",
      "Pemeriksaan saksi dari APS Badilag terbaca langsung. Bukan ringkasan melainkan transkrip: siapa yang bertanya, saksi ke berapa, urutan, pertanyaannya, jawabannya. Sumbernya 65.526 tanya-jawab dari 4.529 saksi yang sudah terekam ABT.",
      "Pertimbangan hukum perkara terbaca dari SIPP - 2.224 naskah tulisan hakim pengadilan ini sendiri, rata-rata delapan ribu huruf. Dikembalikan apa adanya, tanpa dipotong dan tanpa dirapikan: yang membaca berhak melihat naskah yang sesungguhnya ditandatangani.",
      "Lembar tanya-jawab BAS yang mengisi dirinya. Kumpulan pertanyaan ABT yang sudah terpakai bertahun - A1a untuk saksi Penggugat cerai gugat, A2a untuk saksi Tergugat - kini terisi nama para pihak dari SIPP. Panitera hanya menjawab yang memang baru: apa yang dikatakan saksi hari ini.",
      "Selisih antar sumber ditampilkan, bukan dilebur. Pada uji perkara nyata langsung terbaca: SIPP mencatat nol saksi sementara ABT memuat pemeriksaan lima orang. Melebur diam-diam menghilangkan temuan justru saat ia paling perlu dilihat.",
    ],
    changed: [
      "APS Badilag dibaca lewat JOIN lintas basis data, bukan disalin berkala. Keduanya berada di satu server MariaDB dan kuncinya identik - dari 2.223 perkara di ABT, seluruhnya ditemukan di SIPP dengan perkara_id yang sama. Penyalinan berkala akan menambah jendela waktu tempat keduanya berselisih, tanpa memberi keuntungan apa pun.",
      "Nama basis data APS Badilag DICARI, tidak dipatok. Pemasangan lain dapat memakai nama berbeda, dan aplikasi yang mati karena nama basis data berbeda adalah kegagalan yang sepele sekaligus membingungkan. Salinan cadangan sengaja dilewati - yang dibaca harus yang hidup.",
    ],
    fixed: [
      "Nama basis data APS Badilag yang dipatok akan mematikan seluruh pembacaan ABT pada pemasangan yang menamainya lain - dicegah sebelum sempat terjadi dengan mencarinya lewat information_schema.",
    ],
    security: [
      "APS Badilag HANYA DIBACA, tidak pernah ditulisi. ABT adalah aplikasi resmi yang dipakai panitera setiap hari; menulis ke dalamnya dari luar berarti mengubah alat kerja orang lain tanpa sepengetahuannya.",
      "Tiap butir berkas membawa asal-usulnya - sistem mana, tabel mana, kapan diambil - sebagai bagian dari bentuk datanya, bukan catatan terpisah yang mudah terlupa. Yang menyusun BAS harus dapat menjawab \"dari mana angka ini\" tanpa membuka tiga aplikasi.",
      "Penanda yang tidak dapat dipastikan dari berkas DIBIARKAN utuh dan disebutkan, tidak ditebak. BAS adalah dokumen resmi yang ditandatangani, dan nama keliru di dalamnya tidak dapat ditarik kembali.",
    ],
    operationalNotes: [
      "Satu sumber yang mati tidak menjatuhkan sisanya. Petugas yang membuka perkara saat ABT mati tetap melihat data SIPP-nya, dengan keterangan bagian mana yang tidak terbaca - disebut dengan nama sistem dan tabelnya, bukan \"terjadi kesalahan\".",
      "Diuji terhadap perkara 324/Pdt.G/2026/PA.Dgl: berkas terakit dari SIPP dan ABT, 5 saksi dengan 121 tanya-jawab terbaca, dan 16 pertanyaan A1a terisi nama kedua pihak tanpa satu pun perlu diketik panitera.",
    ],
    knownLimitations: [
      "Blangko BAS berupa berkas RTF di APS Badilag belum dibaca ALETA. Yang sudah berjalan adalah lembar tanya-jawabnya; perakitan naskah BAS utuh dari blangko menyusul.",
      "Belum ada tampilan. Berkas perkara dan lembar tanya-jawab sudah tersedia lewat rute, tetapi halaman yang dipakai panitera dan hakim belum dibuat.",
      "Peta penanda baru memuat nomor perkara serta nama Penggugat dan Tergugat. Penanda lain masih diisi panitera - dan daftarnya sengaja ditumbuhkan dari kebutuhan nyata, bukan ditebak di awal lalu salah pada perkara yang tidak terduga.",
    ],
  },
  {
    version: "1.70.0",
    title: "ALETA v1.70.0 - Memanggil dari ALETA",
    date: "2026-09-04",
    status: "Operasional",
    summary:
      "Sampai versi ini ALETA hanya membaca antrian: layar dan suaranya menampilkan apa yang sudah diputuskan aplikasi antrian, sehingga petugas tetap harus berpindah aplikasi untuk mengerjakan satu-satunya hal yang benar-benar memindahkan giliran - memanggil. Sekarang memanggil dapat dilakukan dari ALETA, dan yang ditulis PERSIS yang ditulis mesin antrian: ALETA menjadi pintu kedua ke pekerjaan yang sama, bukan sistem tandingan.",
    added: [
      "PAPAN PANGGIL per ruang. Satu ruang, satu layar, satu tombol besar - petugas yang memanggil sedang berdiri di depan pintu ruang sidang dengan berkas di tangan, bukan sedang membaca tabel, dan tidak akan menekan tombol sebesar korek api. Yang berikutnya ditampilkan bernomor besar beserta siapa saja yang sudah hadir; yang sudah dipanggil berderet di bawahnya lengkap dengan tombol panggil ulang.",
      "RIWAYAT PANGGILAN - berapa kali, jam berapa saja, dan oleh siapa. Tabel aplikasi antrian hanya menyimpan SATU jam panggil dan karena itu tidak dapat menjawab \"sudah dipanggil berapa kali\" - padahal aturan itu sudah dijanjikan ALETA sendiri kepada para pihak lewat WhatsApp: dipanggil tiga kali dan tidak hadir, perkaranya ditunda. Selama ini hitungannya dijaga ingatan petugas yang kebetulan berjaga sejak pagi; kini terbaca oleh siapa pun yang membuka layar, termasuk petugas pengganti yang baru masuk sesudah istirahat. Panggilan ketiga ditandai merah beserta kalimat yang menyebut penundaan.",
      "PIHAK DAPAT MENGECEK SENDIRI lewat WhatsApp: *cek antrian*, *posisi antrian*, atau *antrian saya*. Yang paling sering ditanya di ruang tunggu bukan \"berapa nomor saya\" - itu sudah dipegangnya - melainkan \"masih berapa lagi\", dan selama ini jawabannya hanya ada pada petugas yang harus berhenti mengerjakan yang lain tiap kali ditanya. Jawabannya menyebut nomor, ruang, dan sisa antrian di ruang itu; yang sudah dipanggil disebutkan jam panggilnya.",
      "25 pemeriksaan tetap atas pemanggilan, termasuk yang menjaga urutan pengerjaannya.",
    ],
    changed: [
      "Papan panggil MENAMPILKAN peringatan yang selama ini hanya dihitung diam-diam: bila antrian memuat lebih dari satu tanggal, nomornya patut diragukan - sebab rumus penomoran tidak menyaring tanggal, sementara ada catatan di kode bahwa tabel antrian tidak selalu dibersihkan saat berganti hari. Bot sudah melaporkan keadaan itu sejak lama, dan tidak ada satu pun layar yang pernah menampilkannya. Bila peringatan itu muncul, aplikasi antriannya yang perlu diperiksa.",
    ],
    fixed: [],
    security: [
      "Aplikasi antrian ditulis LEBIH DULU, riwayatnya menyusul. Bila penulisannya gagal, panggilannya memang tidak terjadi - layar ruang tunggu tidak berubah dan tidak ada yang mendengar apa pun. Mencatat riwayat lebih dulu akan menghasilkan hitungan \"sudah dipanggil dua kali\" atas panggilan yang tidak pernah terdengar siapa pun, dan hitungan itulah yang dipakai memutuskan penundaan perkara.",
      "Hanya penanda \"dipanggil\" yang ditulis. Nilai lain pada kolom itu artinya tidak diketahui, dan menebak arti sebuah kode di aplikasi orang lain adalah cara tercepat merusaknya. Kolom milik pengambilan - pihak_1, pihak_2, saksi - tidak tersentuh saat memanggil.",
      "Perintah *cek antrian* hanya mengenali NOMOR PENGIRIM, tidak menerima nomor perkara. Menerimanya berarti siapa pun yang menebak nomor perkara dapat mengetahui apakah pihak lawannya sudah hadir dan menunggu di ruangan mana - keterangan yang tidak berbahaya di ruang tunggu tempat orangnya memang saling melihat, tetapi menjadi lain ketika dapat ditanyakan dari jauh oleh siapa saja. Perintah itu juga tidak menulis apa pun.",
      "Memanggil menuntut kemampuan \"permintaan\", bukan \"panel\" yang hanya membaca. Mengambil antrian menambah orang ke deret; memanggil MEMINDAHKAN gilirannya.",
    ],
    operationalNotes: [
      "Papan panggil dibuka di /aleta-antrian/panggil pada portal, dan dapat disaring per ruang.",
      "Selama pemanggilan masih dikerjakan bergantian dari ALETA dan dari mesin antrian, aturan tiga kali belum utuh - lihat keterbatasan di bawah. Bila aturan itu ingin ditegakkan, pemanggilan sebaiknya dikerjakan dari satu pintu saja.",
    ],
    knownLimitations: [
      "Hitungan panggilan disimpan ALETA, bukan di aplikasi antrian. Panggilan yang dilakukan DARI MESIN antrian karena itu tidak ikut terhitung: angka \"2/3 panggilan\" berarti dua kali dari ALETA, bukan dua kali seluruhnya.",
      "Bila aplikasi antrian memakai nilai lain pada kolom penanda untuk keadaan lain - selesai, dilewati - keadaan itu tidak dapat disetel dari ALETA.",
      "Memanggil dari ALETA belum pernah dijalankan terhadap aplikasi antrian yang sungguhan. Yang membuktikannya baru basis data tiruan.",
    ],
  },
  {
    version: "1.69.0",
    title: "ALETA v1.69.0 - Kehadiran, Pemberitahuan, dan Halaman Tanpa Login",
    date: "2026-09-04",
    status: "Operasional",
    summary:
      "Tabel aplikasi antrian hanya punya tiga kolom waktu - satu untuk sisi penggugat, satu tergugat, satu saksi - sehingga ia tidak dapat membedakan Penggugat I dari Penggugat II, tidak mengenal turut tergugat maupun intervenien, dan tidak tahu apakah yang datang pihaknya sendiri atau kuasanya. Rinciannya kini disimpan di basis data ALETA sendiri, sementara aplikasi antrian tetap menerima yang dipahaminya. Pembagian kerjanya jelas: aplikasi antrian memegang NOMOR, ALETA memegang KETERANGAN.",
    added: [
      "SIAPA YANG LEBIH DULU HADIR, dan pihak yang mana. Penggugat I, Kuasa Tergugat II, Turut Tergugat, Intervenien, Saksi - beserta urutan kedatangannya. Sebutannya disusun sekali lalu dipakai sama persis di layar, di daftar petugas, dan di pesan WhatsApp; sebutan berbeda untuk orang yang sama membuat petugas mengira ada dua orang.",
      "HALAMAN AMBIL ANTRIAN dengan DUA TAMPILAN yang benar-benar berbeda bentuknya. Tampilan PIHAK: satu pertanyaan pada satu waktu, huruf besar, pilih perkara dulu baru peran, nomornya ditampilkan sebesar mungkin di akhir. Tampilan PETUGAS: seluruh sidang hari ini dalam satu daftar rapat, siapa yang sudah hadir terbaca sekilas, pencatatan beberapa tekanan tanpa berpindah halaman. Keduanya menulis ke tempat yang sama - yang berbeda hanya bentuk pertanyaannya, dan itu bukan hiasan: orang yang ditanya \"peran\" sambil menatap tabel berisi dua puluh perkara akan menjawab dengan menebak.",
      "PEMBERITAHUAN WHATSAPP \"TINGGAL SATU ATAU DUA ANTRIAN LAGI\". Yang paling berguna bagi yang menunggu bukan nomornya - itu sudah dipegangnya sejak mengambil - melainkan tahu kapan harus bersiap; ruang tunggu tidak selalu terdengar sampai kantin dan halaman parkir. Yang dihitung berapa banyak yang MASIH MENUNGGU di depannya, bukan selisih nomor: nomor yang sudah dipanggil tidak lagi menghalangi siapa pun. Satu pesan per nomor kontak per hari.",
      "HALAMAN CEPAT PETUGAS SIDANG TANPA LOGIN di /antrian-ruang, dapat disaring per ruang. Petugas perlu melihat nomor yang sedang dipanggil sambil berdiri, dari ponsel, sepuluh detik sebelum sidang dibuka - menuntut login untuk melihat satu angka akan membuat mereka berhenti memakainya dan kembali bertanya lewat pengeras suara.",
      "46 pemeriksaan tetap atas pencatatan kehadiran dan penyusunan pemberitahuan.",
    ],
    changed: [],
    fixed: [
      "TAMPILAN PIHAK TIDAK PERNAH MEMPERLIHATKAN NOMORNYA. Dua sebab sekaligus, dan keduanya diam. Pertama, penyegaran sesudah pencatatan menampilkan \"Memuat…\" - dan itu MELEPAS tampilan pihak dari layar, sehingga layar akhir yang seharusnya memuat nomor besar tidak pernah sempat digambar. Kedua, nomornya dibaca dari keadaan yang tersimpan SEBELUM pencatatan, yang pada pengambilan pertama memang masih kosong. Akibatnya orang menekan \"Ambil nomor antrian\", layarnya berkedip, lalu kembali ke daftar perkara seolah tidak terjadi apa-apa.",
      "JARAK GILIRAN DIHITUNG ATAS SELURUH PENGADILAN, PADAHAL RUANGAN MEMANGGIL BERSAMAAN. Orang yang sebenarnya berikutnya dipanggil di ruangannya tampak masih enam antrian lagi, dan pemberitahuannya baru terkirim sesudah ia dipanggil. Terlambat memberitahu lebih merugikan daripada tidak memberitahu sama sekali: yang tidak diberitahu setidaknya tetap menunggu di dekat ruangan. Jaraknya kini dihitung per ruang.",
      "KEHADIRAN RINCI DIBUANG DI TENGAH JALAN. Bot mengirimkannya, layar antrian menantikannya, dan rute portal diam-diam tidak meneruskannya - sehingga keterangan \"Penggugat I lebih dulu\" tidak pernah muncul, tanpa satu pun error yang menandainya.",
      "WAKTU AMBIL ANTRIAN DITIMPA PADA PERMINTAAN KEDUA. Jalur WhatsApp menulis waktu pengambilan tanpa penjaga, sehingga orang yang mengirim pesan dua kali - karena ragu, karena pesannya tidak terkirim, karena tidak sabar - justru MUNDUR ke belakang antrian, dan nomor yang sudah diberitahukan kepadanya berubah tanpa ada yang menjelaskan kenapa. Waktu ambil kini hanya ditulis sekali; permintaan kedua dijawab dengan nomor yang sama.",
      "Kunci baris kehadiran disusun dari waktu saja, sehingga dua tekanan pada milidetik yang sama ditolak sebagai baris kembar. Tombol pencatatan pada tampilan pihak juga tidak terkunci selama menyimpan - dan tombol sebesar itu memang ditekan dua kali oleh orang yang ragu.",
      "Kunci anti-kembar pemberitahuan memakai tanggal dari daftar antrian, yang kosong ketika belum ada yang mengambil. Tanpa tanggal, orang yang sama tidak akan pernah dapat diberitahu lagi pada hari-hari berikutnya.",
    ],
    security: [
      "Halaman cepat tanpa login terbuka bagi SIAPA PUN yang berada di jaringan pengadilan, dan karena itu yang dijawabnya sengaja dibatasi sebanyak yang sudah tampil di televisi ruang tunggu: nomor antrian, nomor ruang, keadaan, dan jam panggil. Nomor perkara, nama para pihak, keterangan siapa yang hadir, dan nama petugas TIDAK pernah keluar dari sana - penyaringannya dengan menyusun objek baru, bukan menghapus medan, supaya medan yang suatu saat ditambahkan di hulu tidak ikut bocor. Halaman itu memang sengaja tidak cukup untuk bekerja; ia cukup untuk melihat giliran.",
      "Pencatatan kehadiran menuntut login beserta kemampuan panel. Membukanya tanpa login berarti siapa pun di jaringan pengadilan dapat menyatakan dirinya Penggugat pada perkara mana pun - dan yang lahir dari situ bukan sekadar data keliru, melainkan nomor antrian yang menggeser giliran orang lain.",
    ],
    operationalNotes: [
      "Kedatangan KEDUA pada sisi yang sama - Penggugat II menyusul Penggugat I - tetap dicatat, tetapi TIDAK mengubah nomor antriannya. Nomor lahir dari kehadiran yang pertama, dan menggesernya berarti memundurkan perkara itu hanya karena ada orang kedua yang datang.",
      "Halaman ambil antrian dibuka di /aleta-antrian/ambil. Tampilan pihak adalah layar yang DIPUTAR menghadap orang yang datang, bukan halaman yang dibuka sendiri oleh pihak berperkara - yang dari rumah tetap memakai WhatsApp, jalur yang identitasnya terbukti dari nomor pengirimnya.",
    ],
    knownLimitations: [
      "Pemberitahuan \"tinggal satu lagi\" belum dijadwalkan berjalan sendiri - untuk sekarang ia dipicu lewat gerbang. Tanpa penjadwal, pesannya tidak akan terkirim tanpa ada yang menekan.",
      "Nomor kontak untuk pemberitahuan hanya dimiliki yang mengambil lewat WhatsApp. Yang mengambil di mesin ruang tunggu maupun yang dicatatkan petugas tidak meninggalkan nomor, dan ALETA tidak menebaknya dari data perkara - mengirim pesan kepada orang yang tidak pernah memintanya adalah kekeliruan yang berbeda jenis, dan lebih buruk, daripada tidak mengirim.",
      "Sebutan pihak - Penggugat I, Tergugat II - dipilih petugas, tidak dicocokkan dengan daftar pihak di SIPP. Petugas yang salah memilih urutan akan tercatat keliru tanpa ada yang menahan.",
    ],
  },
  {
    version: "1.68.0",
    title: "ALETA v1.68.0 - Antrian Sidang Menyatu dengan Jadwal",
    date: "2026-09-04",
    status: "Operasional",
    summary:
      "Nomor antrian sudah lama tampil di jadwal, tetapi hanya satu arah: ALETA membaca apa yang sudah ada di aplikasi antrian. Sekarang dua arah - jadwal sidang dapat DIDAFTARKAN ke aplikasi antrian dengan satu tekanan, layar antrian untuk televisi ruang tunggu tersedia beserta panggilan suaranya, dan jadwal sidang punya dua kedalaman: ringkas untuk menelusuri, lengkap untuk memeriksa.",
    added: [
      "LAYAR ANTRIAN SIDANG untuk televisi ruang tunggu, pada halamannya sendiri. Nomor yang sedang dipanggil ditulis sebesar mungkin di tengah beserta ruangannya; di bawahnya dua kolom - yang sudah dipanggil dan yang menunggu. Halaman tersendiri, bukan tab: layar ini dibuka sekali lalu dibiarkan menyala sepanjang hari pada perangkat yang tidak disentuh siapa pun, dan sebagai tab ia akan berpindah karena satu salah klik tanpa ada yang menyadarinya.",
      "PANGGILAN SUARA memakai pengucap bawaan peramban - tidak ada berkas suara yang diunduh, tidak ada layanan luar yang dihubungi, dan tidak perlu internet sama sekali. Penting, sebab televisi ruang tunggu berada di jaringan lokal. Suara hanya berbunyi karena PERPINDAHAN keadaan - nomor yang baru berpindah menjadi dipanggil - dan hanya sesudah petugas menyalakannya sekali; nomor yang sudah dipanggil sejak pagi tidak diucapkan ulang tiap penyegaran.",
      "MENDAFTARKAN JADWAL KE APLIKASI ANTRIAN dari layar jadwal sidang, dua tekanan. Yang pertama hanya memperlihatkan apa yang akan didaftarkan; yang kedua benar-benar menulis. Jadwalnya diambil bot langsung dari SIPP, bukan dikirim layar - yang berwenang menyatakan \"hari ini sidangnya perkara apa saja\" hanyalah SIPP, dan layar dapat keliru, tertinggal, atau disusun sendiri oleh siapa pun yang memegang token.",
      "JADWAL SIDANG PUNYA DUA KEDALAMAN. Ringkas menampilkan jam, perkara, agenda, dan ruang - yang dibaca saat menelusuri atau saat layarnya ditampilkan ke orang banyak. Lengkap menambahkan kesiapan, majelis, petugas sidang, dan keadaan putusan. Bawaannya tetap LENGKAP, tampilan yang sudah ada, supaya tidak ada yang kehilangan kolom yang biasa dipakainya tanpa memintanya. Pilihannya diingat per peramban.",
      "38 pemeriksaan tetap atas pendaftaran antrian, seluruhnya dengan basis data tiruan.",
    ],
    changed: [
      "Asal pengambilan antrian ditandai di layar - lencana \"WhatsApp\" atau \"Mesin\". Itu KETERANGAN, bukan urutan: keduanya masuk satu deret yang sama, diurut menurut waktu pengambilan. Petugas perlu tahu apakah orangnya sudah ada di ruangan atau baru mengambil dari rumah, tetapi yang mengambil lebih dulu tetap bernomor lebih kecil dari mana pun ia mengambilnya.",
    ],
    fixed: [],
    security: [
      "Menulis ke basis data aplikasi antrian - tabel milik aplikasi yang dipakai mesin di ruang tunggu - dan seluruh rancangannya berpihak pada tidak menulis. Uji kering adalah perilaku bawaan. Hanya MENAMBAH: tidak ada UPDATE, tidak ada DELETE; baris yang sudah ada adalah milik aplikasi antrian, termasuk baris yang menurut SIPP sudah tidak ada jadwalnya, sebab menghapusnya berarti menghilangkan antrian orang yang mungkin sudah memegang nomornya. Kolom milik mesin antrian - pihak_1, pihak_2, saksi, disidang - tidak pernah disentuh. Dan struktur tabelnya DIBACA lebih dulu: bila ada kolom wajib yang ALETA tidak tahu cara mengisinya, sinkronisasi ditolak dengan menyebutkan nama kolomnya, bukan dicoba lalu gagal separuh jalan dan meninggalkan baris setengah jadi di aplikasi yang sedang dipakai orang menunggu.",
      "Tiap penulisan ke aplikasi antrian dicatat sebagai peristiwa keamanan beserta siapa yang menjalankannya, berhasil maupun tidak.",
    ],
    operationalNotes: [
      "ANTRIAN DIAMBIL ONLINE MAUPUN OFFLINE, DAN KEDUANYA SATU DERET. Yang mengambil lewat WhatsApp sebelum berangkat dan yang mengambil di mesin ruang tunggu setelah tiba masuk deret yang sama, diurut menurut waktu pengambilan. Dua deret terpisah akan membuat dua orang sama-sama memegang nomor 3, dan yang dipanggil lebih dulu jadi soal siapa yang berdiri lebih dekat. Nomornya dihitung dengan rumus yang sama persis dengan yang dipakai menjawab WhatsApp, sehingga nomor di layar ruang tunggu tidak pernah berselisih dengan nomor di ponsel para pihak.",
      "Perkara yang baru didaftarkan ALETA masuk sebagai BELUM DIAMBIL dan tidak bernomor. Itu benar: nomor lahir dari pengambilan, bukan dari pendaftaran. ALETA mendaftarkan perkaranya supaya ada di mesin antrian; nomornya terbit saat para pihak benar-benar mengambil.",
      "Layar antrian dibuka di alamat /aleta-antrian pada portal, lalu dibiarkan menyala. Suaranya dinyalakan sekali dengan tombol di kanan atas - peramban memang menuntut sentuhan orang sebelum boleh bersuara, dan itu kebetulan aturan yang bagus: layar yang tiba-tiba berbicara sendiri sesudah dimuat ulang akan mengagetkan seisi ruangan.",
    ],
    knownLimitations: [
      "Nomor ruang diambil dari angka yang ada di dalam teks ruangan SIPP - \"Ruang Sidang 2\" menjadi 2. Yang tidak memuat angka dibiarkan kosong dan diisi aplikasi antrian atau petugas; menebak pemetaannya berarti memanggil orang ke ruangan yang salah. Kolom ruangan_id aplikasi antrian tidak diisi sama sekali karena pemetaannya belum diketahui.",
      "Layar antrian menyegarkan diri tiap lima belas detik, bukan seketika. Nomor yang dipanggil karena itu dapat terlambat terdengar sampai lima belas detik dari saat petugas menekannya.",
      "Panggilan suara memakai pengucap bawaan peramban. Mutu dan logat suaranya bergantung pada peramban dan sistem operasi perangkatnya; pada sebagian perangkat suara Indonesia belum terpasang dan kalimatnya akan terdengar dengan logat asing.",
      "Seluruh penulisan ke aplikasi antrian baru diuji terhadap basis data tiruan. Menulis ke aplikasi antrian yang sungguhan belum pernah dijalankan.",
    ],
  },
  {
    version: "1.67.0",
    title: "ALETA v1.67.0 - Analisa Perkara, dan Penilaian yang Adil",
    date: "2026-09-04",
    status: "Operasional",
    summary:
      "Kaki layar Status Perkara kini menjawab pertanyaan yang tidak terjawab oleh deretan angka - kenapa perkara ini selama ini, apa yang ditunggu, apa yang terlambat - lewat garis waktu, jeda antar sidang, ketepatan input, dan ringkasan yang dapat dibaca dalam sepuluh detik. Bersamaan dengan itu, penilaian kelengkapan yang selama ini menghukum perkara atas hal yang belum mungkin ada dibetulkan.\n\nPenilaian kelengkapan pada Status Perkara menghukum perkara atas hal yang belum mungkin ada. Perkara yang baru ditetapkan majelisnya - panitera lengkap, pihak bernomor, tidak satu pun dikerjakan keliru - bernilai 45 dari 100 dan berpredikat \"kurang\", sebab 55 poin hangus untuk Berita Acara Sidang yang sidangnya belum berlangsung, naskah putusan yang perkaranya belum diputus, dan minutasi yang tenggangnya belum mulai berjalan.",
    added: [
      "UMUR ANTREAN PENERUSAN, bukan jumlahnya saja. Panel e-Court sudah lama menyebut berapa keputusan hakim menunggu diteruskan, tetapi angka \"3\" tidak membedakan tiga keputusan yang masuk pagi ini dari tiga keputusan yang mengendap sejak tiga minggu lalu - padahal yang kedua itulah keputusan hukum yang sudah diambil tetapi belum sampai ke sistem resmi. Keputusan tertua kini disebut beserta umurnya dan nomor perkaranya, dan berubah menjadi penanda GENTING begitu melewati tujuh hari.",
      "DOKUMEN YANG BERULANG GAGAL DIAMBIL DIISTIRAHATKAN. Sebagian dokumen memang tidak akan pernah dapat diunduh - tautannya berbentuk yang belum dikenali, atau berkasnya sudah hilang di sisi e-Court. Mencobanya lagi tiap putaran memakan jatah penarikan, membebani server Mahkamah Agung dengan permintaan yang sudah pasti gagal, dan menenggelamkan kegagalan BARU di antara kegagalan yang sama berulang-ulang. Sesudah tiga kali gagal beruntun, dokumen itu diistirahatkan sehari lalu dicoba lagi sekali - sebab e-Court dapat memperbaiki berkasnya kapan saja tanpa memberi tahu siapa pun. Satu keberhasilan, bentuk apa pun, mengembalikan hitungannya ke nol. Yang diistirahatkan TETAP dilaporkan beserta sebab dan jumlah gagalnya: yang diistirahatkan diam-diam sama saja dengan yang hilang diam-diam.",
      "ANALISA PERKARA di kaki layar Status Perkara - empat bagian yang menjawab pertanyaan yang selama ini tidak terjawab oleh deretan angka: kenapa perkara ini selama ini, apa yang sedang ditunggu, dan apa yang terlambat. Seluruhnya dirakit dari data yang SUDAH ada di layar itu; tidak ada satu pun pembacaan tambahan ke SIPP, sebab analisa yang menambah beban pada sistem induk akan dimatikan orang pada hari pertama layar terasa lambat.",
      "Ringkasan tiga sampai lima kalimat, diletakkan paling atas di antara keempatnya. Untuk petugas yang punya sepuluh detik, kalimatlah yang terbaca; gambarnya dibuka kalau kalimatnya bikin penasaran. Kalimat hanya muncul bila ada isinya - perkara yang bersih dijawab pendek, sebab ringkasan yang memaksakan lima kalimat pada perkara tanpa masalah berhenti dibaca sama seperti peringatan yang selalu menyala.",
      "Garis waktu perkara: satu batang dari pendaftaran sampai putusan - atau sampai hari ini - dengan PMH, PPP, PJS, PHS, tiap sidang, putusan, minutasi, dan BHT duduk pada jaraknya yang sebenarnya, ditambah garis ambang lima bulan. Peristiwa yang tanggalnya tidak terbaca TIDAK digambar: titik yang ditebak membuat gambar berbohong dengan meyakinkan, dan gambar yang keliru jauh lebih sulit dibantah daripada angka yang keliru.",
      "Jeda antar sidang, lengkap dengan alasan tundaan sidang SEBELUMNYA - sebab itulah yang menyebabkan jeda tersebut. Perkara jarang menjadi lama karena satu sebab besar; ia menjadi lama karena tundaan beruntun yang masing-masing tampak wajar, dan deretan ini yang memperlihatkannya. Perkara yang belum putus juga menampilkan jarak sidang terakhir sampai hari ini - itulah yang menemukan perkara menggantung tanpa jadwal baru.",
      "Ketepatan input ke SIPP per tahapan, dengan tangga poin SK apa adanya: hari yang sama 5, ke-1 nilai 3, ke-2 nilai 2, ke-3 nilai 1, ke-4 atau lebih nilai 0. Angka ini sudah dipakai menilai perkara tetapi selama ini terkubur di dalam daftar unsur - padahal ia satu-satunya bagian nilai yang kebiasaannya masih dapat diperbaiki untuk perkara berikutnya.",
      "66 pemeriksaan tetap atas analisa ini. Seluruh perhitungannya fungsi murni tanpa basis data dan tanpa jam sistem - hari ini pun dikirim pemanggilnya - supaya tiap kesimpulan diuji dengan tanggal yang pasti, bukan tanggal yang berubah tiap kali uji dijalankan.",
      "Keadaan ketiga pada rubrik: BELUM WAKTUNYA. Sebelumnya hanya ada dua - dinilai, atau bernilai nol - dan apa pun yang tidak dapat dinilai jatuh ke nol lalu tetap ikut membagi. Sekarang butir yang belum menjadi kewajiban perkara dikeluarkan dari pembilang DAN pembagi, sementara butir yang datanya seharusnya ada tetapi kosong tetap bernilai nol dan tetap membagi. Membedakan keduanya itulah yang membuat angkanya dapat dipercaya.",
      "49 pemeriksaan tetap atas rubrik ini, yang sebelumnya tidak diuji sama sekali. Yang dijaga paling keras: keadaan \"belum waktunya\" TIDAK BOLEH menelan kelalaian sungguhan - BAS yang tertinggal sesudah sidang berlalu, naskah putusan yang belum diunggah sesudah perkara diputus, dan panggilan yang tidak terbaca padahal sidangnya sudah lewat semuanya tetap menurunkan nilai.",
    ],
    changed: [
      "Papan penilaian menandai butir yang belum waktunya dengan kata \"belum waktunya\", bukan dengan batang merah penuh dan angka 0 dari 20. Batang merah untuk perkara yang belum diputus dibaca sebagai kelalaian atas pekerjaan yang belum jatuh tempo - dan papan yang selalu merah berhenti dibaca orang.",
      "Pembagi nilai kini disebutkan apa adanya beserta bobot yang belum waktunya, sehingga terlihat bahwa tidak ada bobot yang hilang diam-diam.",
      "Keterangan umur menyebut SEBAB berakhirnya - \"sampai dicabut\", \"sampai gugur\" - bukan selalu \"sampai putus\". Ketiganya memang sama-sama berakhir dengan tanggal putusan di SIPP, tetapi bagi yang membaca layar itu bukan peristiwa yang sama.",
    ],
    fixed: [
      "UMUR YANG DILIHAT PETUGAS BUKAN UMUR YANG DINILAI. Layar menampilkan hari BERSIH sebagai angka besar beserta warnanya - hari pendaftaran ikut dihitung, lama mediasi dipotong, persis cara SK menghitung - sementara rubrik menilai hari MENTAH. Perkara bermediasi 40 hari yang selesai pada hari ke-120 karena itu tampil HIJAU di layar (bersihnya 81 hari) tetapi kehilangan separuh bobot lama penyelesaian. Yang paling dirugikan justru perkara bermediasi, padahal potongan mediasi memang disediakan untuk melindunginya. Umur dalam bulan juga ikut dibetulkan: dulu dihitung dari hari mentah sementara angka di sebelahnya hari bersih, sehingga satu layar memuat dua umur untuk perkara yang sama.",
      "TENGGANG MINUTASI YANG MASIH BERJALAN DINILAI SEBAGAI KELALAIAN. Berkas yang belum diminutasi SEHARI setelah putusan bernilai nol persis seperti berkas yang terlambat dua bulan - padahal ambangnya 14 hari dan belum ada yang dilanggar. Akibatnya tiap perkara turun nilainya seketika begitu diputus, tanpa satu pun kelalaian. Sekarang selama tenggangnya masih berjalan butir ini belum waktunya dinilai, dan catatannya menyebut hari keberapa dari ambangnya; sesudah ambang terlewat, barulah bernilai nol dengan umur keterlambatannya disebutkan.",
      "Umur perkara bertambah satu hari sendiri selepas tengah hari. Selisihnya dihitung antara tengah malam tanggal pendaftaran dan JAM BERJALAN hari ini, lalu dibulatkan - sehingga perkara yang didaftarkan pagi ini tercatat \"1 hari\" pada sore yang sama. Hari ini kini dipotong ke tengah malam lebih dulu.",
      "PERKARA YANG DIKERJAKAN DENGAN BENAR DINILAI \"KURANG\". Butir yang belum mungkin ada dinilai nol tetapi TETAP dihitung sebagai pembagi, sehingga perkara yang baru berjalan selalu kehilangan 55 dari 100 poin - berapa pun rapinya pekerjaan yang sudah dilakukan. Papan Status Perkara karena itu menyatakan hampir seluruh perkara berjalan sebagai \"kurang\", dan peringatan yang menyala pada semua perkara tidak menunjuk apa pun. Perkara baru yang seluruhnya beres kini bernilai 100 atas 45 poin yang memang sudah menjadi kewajibannya; begitu sidang berlalu, BAS dan panggilan ikut membagi; begitu diputus, naskah putusan dan minutasi ikut membagi.",
    ],
    security: [],
    operationalNotes: [
      "Angka penilaian pada Status Perkara akan NAIK untuk hampir seluruh perkara yang masih berjalan, dan predikat \"kurang\" akan jauh berkurang. Itu koreksi cara menghitung, bukan pelonggaran ukuran: perkara yang benar-benar tertinggal tetap turun nilainya, dan kini lebih menonjol karena tidak lagi tenggelam di antara perkara yang hanya \"belum waktunya\".",
      "Nilai menurut SK Dirjen Badilag 048/2024 TIDAK berubah sama sekali. Pemeriksaan menunjukkan penilaian SK sudah menangani hal ini dengan benar sejak awal - unsur yang tidak terbaca dikeluarkan dari pembilang dan penyebut. Yang keliru hanya rubrik ALETA, dan kini keduanya sepakat caranya.",
      "Kesiapan sidang juga diperiksa dan tidak diubah: perkara tanpa dokumen yang menunggu verifikasi sudah diberi nilai penuh, dan saksi memang sengaja tidak ikut menentukan skor kecuali agendanya pembuktian.",
      "Dua pemeriksaan tetap yang ternyata sudah gagal sebelum pekerjaan ini ikut dibetulkan - keduanya menjaga bentuk kode, bukan sifatnya. Salah satunya melarang penyisipan simpul di mana pun, lalu gagal begitu pemberitahuan versi disisipkan ke kepala panel ALETA sendiri; larangan yang terlalu lebar berakhir dimatikan orang alih-alih dipatuhi, jadi yang dijaga sekarang penerimanya - elemen SIPP tetap tidak boleh disentuh.",
    ],
    knownLimitations: [
      "Majelis dan panitera dinilai sejak hari pendaftaran, tanpa tenggang. Perkara yang didaftarkan hari ini dan penetapannya dikerjakan besok pagi akan tampak kehilangan poin selama beberapa jam. Tenggangnya belum dapat diatur dari layar.",
      "Ambang predikat - baik 85, perhatian 60 - masih tertanam di kode, sementara bobot tiap butirnya sudah dapat diubah dari menu Integrasi e-Court.",
    ],
  },
  {
    version: "1.66.0",
    title: "ALETA v1.66.0 - Berkas yang Benar-benar Mendarat",
    date: "2026-09-04",
    status: "Operasional",
    summary:
      "Dua keluhan petugas yang selama ini dianggap gangguan kecil ternyata satu cacat yang sama: berkas pihak tercatat \"sudah terunduh\" padahal tidak pernah tertulis di server, dan kekeliruan itu MENGUNCI DIRINYA SENDIRI - penarikan berikutnya melihat catatannya sudah ada lalu melewatinya, selamanya. Pemeriksaan lanjutan atas seluruh jalur e-Court - penarikan berkas, verifikasi hakim, unggah putusan oleh hakim, dan TTE Panitera - menemukan delapan kekeliruan lain yang semuanya diam.",
    added: [
      "Berkas yang HILANG dari disk memaksa penarikan ulang seketika, tidak menunggu jeda pemeriksaan yang enam jam - atau tujuh hari bagi dokumen yang sudah diverifikasi. Yang dihapus masa simpan tetap dibedakan: ia memang sengaja tidak ada, dan tidak ditarik kembali.",
      "Uji tetap untuk tiap kekeliruan, supaya tidak satu pun dapat kembali tanpa ketahuan - termasuk urutan tulis-lalu-catat, yang dijaga dari susunan kodenya sendiri.",
    ],
    changed: [
      "WORD DIUNDUH LEBIH DULU, baru PDF - keduanya tetap diambil. Bila satu dokumen tersedia dalam dua bentuk dan hanya satu yang berhasil, yang tersimpan adalah Word, sesuai kehendak pengadilan. Urutan ini juga yang lebih mungkin berhasil: Word membawa alamatnya sendiri, sementara PDF baru berupa penanda yang harus ditukar dulu lewat ViewDoc - satu langkah tambahan dengan sebab kegagalannya sendiri. Putaran yang terputus di tengah karena itu meninggalkan berkas yang dapat dibuka, bukan tidak meninggalkan apa-apa.",
      "GILIRAN PEMERIKSAAN BERPUTAR, tidak lagi mengikuti urutan pendaftaran. Perkara diurutkan menurut kapan terakhir DIBUKA, yang paling lama menunggu didahulukan, dan yang belum pernah dibuka sama sekali didahulukan di atas semuanya. Tanpa ini, perkara yang berkasnya tidak pernah dapat dilengkapi - dokumen yang tautannya tidak dikenali, berkas yang selalu gagal - akan menempati barisan depan selamanya dan menghabiskan jatah tiap putaran, sementara dari luar penarikan tampak bekerja normal.",
      "Keputusan verifikasi yang BELUM diteruskan tetap boleh diubah - hakim berhak berubah pikiran selama e-Court belum menerima apa pun - tetapi perubahannya kini tercatat di jejak keamanan beserta keputusan lama, keputusan baru, dan nama kedua hakimnya.",
      "Ringkasan penarikan membedakan berkas yang baru diunduh, berkas yang DIISI ULANG karena hilang dari disk, dan berkas yang sengaja dikosongkan masa simpan. Ketiganya dulu terhitung sama, sehingga arsip yang sedang menambal dirinya sendiri tidak dapat dibedakan dari arsip yang tidak berubah.",
      "Penolakan yang disengaja pada jalur portal dijawab dengan sebabnya, bukan dilepas menjadi error 500. Petugas yang menerima \"terjadi kesalahan\" akan mencoba lagi; yang menerima \"sudah diteruskan ke e-Court\" tahu bahwa yang tersisa adalah pekerjaan di e-Court.",
    ],
    fixed: [
      "BERKAS TERCATAT TERUNDUH PADAHAL TIDAK PERNAH TERTULIS. Catatannya disimpan LEBIH DULU - lengkap dengan jalur berkas pada catatan dokumen, yang membuat panel menyatakan berkasnya ada - lalu penulisannya gagal: cakram penuh, izin folder, nama terlalu panjang. Lebih buruk, kekeliruannya mengunci dirinya sendiri: penarikan berikutnya mengunduh isi yang sama, sidik jarinya sama, barisnya sudah ada, maka penulisannya dilewati lagi. Tidak ada penarikan keberapa pun yang membetulkannya. Sekarang berkasnya ditulis lebih dulu dan dicatat sesudah berhasil, dan penulisannya dikerjakan setiap kali berkasnya tidak ada di disk - bukan hanya ketika catatannya baru - sehingga berkas yang hilang terisi kembali dengan sendirinya.",
      "PERKARA DI URUTAN BAWAH TIDAK PERNAH TERSENTUH PENJADWAL. Penjadwal memeriksa 25 perkara tiap putaran - batas yang benar, sebab bebannya ada di server Mahkamah Agung. Tetapi pembatasannya dikerjakan pada daftar MENTAH: dua puluh lima perkara PERTAMA menurut urutan pendaftaran, apa pun keadaannya. Perkara yang berkasnya sudah lengkap tetap memakan jatah - dilewati murah, tetapi jatahnya terpakai. Begitu 25 perkara teratas lengkap, tiap putaran menghabiskan seluruh jatahnya untuk melewati perkara yang sudah beres, dan perkara ke-26 dan seterusnya tidak pernah dibuka. Perkara lama yang baru menerima Jawaban duduk jauh di bawah daftar itu - dan justru itu yang tenggatnya sedang berjalan. Penyaringan kini dikerjakan lebih dulu, sehingga jatah 25 seluruhnya diberikan kepada perkara yang memang perlu diperiksa dan sapuannya maju dari putaran ke putaran.",
      "DUA DOKUMEN BERBEDA YANG BERBAGI SATU KUNCI, YANG KEDUA HILANG. Kunci dokumen disusun dari nomor perkara, judul, email pengunggah, dan waktu unggah sampai satuan menit - dan dua dokumen e-Court yang berbeda dapat menghasilkan kunci yang sama persis: berkas pendaftaran berjudul sama (\"bukti surat\" dua lembar, lazim ketika satu pihak mengunggah beberapa bukti sekaligus - berkas pendaftaran tidak membawa email maupun waktu unggah, jadi yang tersisa hanya judulnya), atau dokumen persidangan dari pihak yang sama berjudul sama dalam menit yang sama. Yang pertama diunduh; yang kedua ditolak pemeriksa ulang - \"baru saja diperiksa\" - lalu dilewati seluruhnya, dan berkasnya tidak pernah sampai ke server. Berulang begitu tiap putaran. Sekarang dokumen kedua yang berbagi kunci tetap diunduh, dan berkasnya duduk berdampingan di arsip karena penyimpanannya per sidik jari.",
      "DOKUMEN TERLIHAT TETAPI TIDAK PERNAH DIUNDUH, TANPA SUARA. Barisnya terbaca dari halaman, judul dan pengunggahnya terbaca, lalu tercatat sebagai dokumen tanpa satu berkas pun - tanpa baris log, tanpa hitungan error, dan ringkasan penarikan tetap tampak bersih. Dua jalur diam ditutup: dokumen yang tidak punya satu tautan pun, dan tautan yang alamat berkasnya gagal ditanyakan. Keduanya kini dihitung error dan disebut judul dokumennya, sehingga penarikan yang meninggalkan puluhan dokumen tanpa berkas tidak lagi berakhir dengan nol error.",
      "TTE PANITERA DIBACA DARI TEMPAT YANG SALAH. Kalimat \"Telah diperiksa tanggal ...\" dicari di SELURUH tab Putusan, sehingga kalimat milik bagian lain ikut terhitung sebagai tanda tangan Panitera - perkara yang salinannya belum ditandatangani dilaporkan \"Sudah di-TTE\", lengkap dengan tanggal milik orang lain, lalu hilang dari daftar yang perlu ditindaklanjuti. Sekarang pembacaannya DIJANGKARKAN pada baris berlabel Panitera - baris itu sendiri beserta satu baris sesudahnya. Pada halaman yang berjalan, tanda tangannya memang menempel di baris Panitera pada sisi kanan sel yang sama, dan baris itu BUKAN baris terakhir: di bawahnya masih ada keterangan bahwa salinan putusan hanya dapat dilihat dengan akun Panitera. Menghitung dari ujung tab akan memberi jawaban yang sama hari ini, tetapi hanya karena tab Putusan kebetulan tab terakhir - satu baris keterangan tambahan sudah cukup menggesernya.",
      "SALINAN YANG SUDAH DIUNGGAH DILAPORKAN BELUM DIUNGGAH. \"Sudah diunggah\" hanya dijawab oleh ada-tidaknya tautan unduh, padahal baris \"Diupload Oleh\" dan \"Tanggal Upload\" - yang diisi HAKIM yang mengunggah, tepat di atas bagian Panitera - sudah membuktikan salinannya ada. Pada halaman yang tautannya baru muncul sesudah ditandatangani, perkara yang menunggu TTE Panitera karena itu ditagih unggahannya, bukan tanda tangannya.",
      "Kolom bertanda hubung dibaca sebagai nilai. e-Court menulis \"-\" pada kolom yang belum terisi; pada Tanggal BHT itu sudah ditangani, pada Tanggal Putusan tidak. Akibatnya baris putusan yang belum terbentuk tampak sudah ada, dan perkaranya digolongkan \"salinan belum diunggah\" - padahal yang benar \"Menu Putusan E-Court Error\", keluhan yang justru paling sering disampaikan petugas.",
      "Keputusan verifikasi yang SUDAH diteruskan ke e-Court masih dapat ditimpa dari portal maupun WhatsApp. Barisnya berkunci unik per dokumen dan penyimpanannya menimpa, sementara penerusan hanya mengambil baris yang belum diteruskan - sehingga keputusan baru tidak akan pernah dikirim. Yang tertinggal: ALETA menyebut satu keputusan, e-Court memuat keputusan yang lain, dan tidak ada yang melihat selisihnya. Sekarang ditolak dengan sebabnya, dan percobaannya masuk jejak keamanan.",
      "Daftar keadaan putusan dipotong diam-diam pada 500 perkara. Perkara ke-501 dan seterusnya dijawab \"belum ditarik dari e-Court\" - jawaban yang tampak sah dan tidak menyalakan peringatan apa pun, padahal artinya putusan yang belum ditandatangani ikut tersembunyi. Satu halaman daftar sidang setahun penuh melewati 500 tanpa kesulitan. Sekarang dipecah menjadi beberapa kueri, bukan dipotong.",
    ],
    security: [
      "Keputusan verifikasi adalah keputusan hukum, dan sesudah sampai ke sistem resmi ia tidak boleh diubah diam-diam dari ALETA. Pembatalannya pekerjaan manusia di e-Court.",
    ],
    operationalNotes: [
      "Angka pada papan Kendali Berkas akan BERUBAH sesudah pembaruan ini, dan perubahannya wajar dua arah: sebagian perkara yang tampak \"sudah TTE\" kini muncul sebagai belum TTE, sementara sebagian yang tampak \"belum diunggah\" pindah menjadi menunggu TTE. Yang berubah bacaannya, bukan keadaan perkaranya.",
      "Penarikan berikutnya akan MENAMBAL sendiri berkas yang catatannya ada tetapi berkasnya hilang - ditandai \"Diisi ulang\" pada catatan penarikan. Bila jumlahnya banyak, putaran pertama sesudah pembaruan akan lebih lama dari biasanya. Menarik ulang seluruh arsip dari nol tidak diperlukan untuk itu.",
      "Perkara yang selama ini tidak pernah tersentuh karena duduk di bawah batas 25 kini akan terambil sendiri, tetapi menyusulnya butuh banyak putaran. Menjalankan penarikan menyeluruh dari portal SEKALI sesudah pembaruan akan mengejar ketertinggalan itu dalam satu jalan - sesudahnya penjadwal cukup mempertahankannya.",
      "Penarikan berkas e-Court sudah berjalan terjadwal sendiri. Yang TIDAK terjadwal adalah penerusan keputusan hakim ke e-Court - lihat keterbatasan di bawah.",
      "Ekstensi tetap 1.65.0; pembaruan ini seluruhnya di bot dan portal.",
    ],
    knownLimitations: [
      "Perkara yang berkasnya tidak pernah dapat dilengkapi kini tidak lagi memblokir giliran, tetapi tetap diperiksa ulang tiap kali gilirannya tiba - dan tiap kali gagal dengan sebab yang sama. Kejadiannya terbaca dari hitungan error beserta catatan \"tautan berkas tidak ditemukan\"; belum ada yang menghentikan percobaan berulang atas dokumen yang jelas-jelas tidak dapat diambil.",
      "Dua dokumen berbeda yang berbagi satu kunci kini sama-sama terunduh, tetapi catatan dokumennya tetap satu - daftar arsip menampilkan satu judul, sementara kedua berkasnya ada. Memisahkannya menuntut kunci dokumen memuat id e-Court, dan itu akan mengubah kunci seluruh dokumen yang sudah tersimpan - termasuk kunci yang dirujuk keputusan verifikasi hakim.",
      "Meneruskan keputusan hakim ke e-Court (Tahap 6) masih dijalankan manual dengan perintah tersendiri, dan disengaja demikian - alat itu menulis ke sistem Mahkamah Agung, login-nya bercaptcha, dan tiap keputusan dikonfirmasi petugas di layar. Jumlah yang mengantre sudah lama tampil pada panel e-Court; umur antreannya ditambahkan di v1.67.0.",
      "Penunjuk elemen pada kotak dialog verifikasi e-Court disusun dari tangkapan layar, belum pernah diadu dengan halaman yang sesungguhnya.",
    ],
  },
  {
    version: "1.65.0",
    title: "ALETA v1.65.0 - PHS Berhenti Menebak Ketua Majelis",
    date: "2026-09-04",
    status: "Operasional",
    summary:
      "Penetapan Hari Sidang dikerjakan ketua majelis perkara itu, dengan akun SIPP-nya sendiri. Sampai PMH tersimpan, ketuanya BELUM ADA - yang ada baru usulan, dan usulan boleh berubah: majelisnya diganti sebelum ditetapkan, hakimnya berhalangan, isbat terpadu memakai susunan lain. Sejak v1.62 papan menandainya \"tentatif\" dan menyuruh membacanya ulang, tetapi tidak ada satu pun yang memaksakannya. Sekarang dipaksakan: begitu perkara_hakim_pn terisi, dari sanalah pelaksana PHS dibaca.",
    added: [
      "Usulan penunjukan membawa MAJELIS YANG TERCATAT terpisah dari majelis yang diusulkan. Ketuanya dikenali dari jabatan_hakim_id = 1 - bukan dari baris pertama, sebab urutan baris tidak menjanjikan apa pun. Perkara hakim tunggal dan pemasangan yang tidak mengisi jabatan_hakim_id jatuh ke urutan pertama, dan itu disebutkan di kodenya.",
      "Selisih antara majelis yang ditetapkan dan yang diusulkan DIBACAKAN di papan. Penetapan yang menyimpang dari smart majelis memang terjadi dan sah - isbat terpadu, sidang keliling, hakim berhalangan - tetapi PHS-nya lalu dikerjakan orang yang berbeda dari yang tertulis di papan sebelumnya, dan selisih itu tidak boleh lewat tanpa terbaca.",
    ],
    changed: [
      "Tanda \"tentatif\" pada akun PHS kini GUGUR SENDIRI begitu majelisnya tercatat, bukan menyala selamanya. Tanda yang tidak pernah padam berhenti dibaca, dan yang hilang bersamanya justru peringatan yang benar-benar berlaku.",
      "Tombol PHS di panel berbunyi \"Menunggu PMH\" selama majelisnya belum tercatat, lengkap dengan sebabnya. Sebelumnya ia menawarkan pergantian akun ke hakim yang belum tentu ketua majelisnya.",
    ],
    fixed: [
      "Jalur \"Masuk sebagai pejabat\" untuk PHS memakai ketua majelis dari USULAN, dan itu membuka sesi SIPP atas nama hakim yang belum tentu ditetapkan - pada perkara yang majelisnya berubah, PHS tercatat atas nama yang keliru. Sekarang jalur itu memakai yang tercatat, dan MENOLAK selama belum ada yang tercatat. Menolak lebih baik daripada menebak: yang dibuka di sana sesi atas nama orang lain.",
      "Skrip pemeriksaan penunjukan menuntut kalimat \"belum diatur\" pada sebab PPP - peninggalan dari masa ketika panitera pengganti ditautkan per majelis. Penautan itu dilepas di v1.62 karena tidak berlaku di PA Donggala; pemeriksaannya ikut dibetulkan supaya menguji yang benar-benar dipakai memilih.",
    ],
    security: [
      "Akun yang dibukakan sesi tetap ditentukan oleh apa yang TERCATAT di SIPP, bukan oleh apa yang ALETA usulkan. Usulan adalah pendapat; perkara_hakim_pn adalah keputusan pengadilan, dan hanya keputusan yang boleh menentukan atas nama siapa sebuah penetapan tercatat.",
    ],
    operationalNotes: [
      "Urutan kerjanya tidak berubah: PMH lebih dulu, PHS sesudahnya. Yang berubah hanya panel tidak lagi menawarkan PHS sebelum waktunya, dan tidak lagi menyebut nama yang belum pasti.",
      "Sesudah PMH disimpan, muat ulang halaman perkaranya bila panel masih menulis \"Menunggu PMH\" - papan membaca rencana sekali saat halaman dibuka.",
      "Ekstensi naik ke 1.65.0.",
    ],
    knownLimitations: [
      "Rangkaian lima langkah berurutan dengan jeda dan pemeriksaan hasil tiap langkah masih belum berjalan sendiri: satu langkah, satu tombol, satu kali tekan Simpan oleh petugas.",
      "Jalur PLH Panitera belum pernah diadu dengan SK yang berjalan.",
      "Ukuran panel disimpan satu untuk seluruh halaman SIPP, bukan per halaman.",
    ],
  },
  {
    version: "1.64.0",
    title: "ALETA v1.64.0 - Panitera Berhalangan, dan Batas yang Tidak Dilompati",
    date: "2026-09-04",
    status: "Operasional",
    summary:
      "PPP dan PJS selalu menyebut Panitera definitif, termasuk pada hari ia sedang cuti. Rantai penetap yang sudah benar untuk PMH belum menjangkau kepaniteraan - dan justru di sanalah aturannya berbeda: Panitera TIDAK punya wakil yang jabatannya sejajar, sehingga ketika ia berhalangan yang berlaku hanya SK Plh. Karena itu yang dikerjakan versi ini dua-duanya: menyambungkan rantainya, dan menahannya supaya tidak melompat ke pegawai kepaniteraan yang tidak pernah ditunjuk.",
    added: [
      "Penetap PPP dan PJS mengikuti rantai PANITERA - PLH pada TANGGAL PENETAPAN. Penunjukannya dibaca dari SK-nya sendiri, dengan jabatan target Panitera, TERPISAH dari penunjukan Ketua - satu SK tidak memindahkan dua tanda tangan sekaligus. Cuti yang dihitung tetap hanya yang berstatus disetujui, sama seperti pada pimpinan.",
      "Sebutan penetapnya dikirim dari server dan ditulis papan apa adanya: \"Ditetapkan PLH Panitera - <nama> (akun <username>)\". Tidak ada yang perlu disimpulkan ekstensi.",
      "Catatan tentang penetap kini DIGAMBAR di papan, pada baris yang menyebut namanya. Sebelumnya catatan itu dirakit, dikirim sampai ke peramban, lalu tidak pernah ditampilkan sama sekali - termasuk dua keadaan yang paling perlu dibaca: SK Plh yang tercatat tetapi tidak dipakai, dan pejabat yang berhalangan tanpa Plh sama sekali.",
    ],
    changed: [
      "Rantai kepaniteraan sengaja lebih pendek daripada rantai pimpinan, dan pendeknya bukan kelalaian. Panitera Muda dan Panitera Pengganti bukan \"wakil panitera\" - mereka jabatan lain dengan tugas lain, dan tidak satu pun dengan sendirinya berwenang menandatangani PPP ketika Panitera berhalangan. Grup SIPP \"Panitera/Wakil Panitera\" tidak dapat dipakai membedakan sebab seluruh pengguna kepaniteraan berbagi grup itu; yang membedakan adalah peran akun ALETA pemiliknya.",
      "Tombol \"Masuk sebagai pejabat\" untuk PPP/PJS memakai rantai yang sama persis dengan papan. Membacanya di satu tempat berarti papan tidak mungkin menyebut satu nama sementara tombolnya memasukkan petugas sebagai nama lain.",
      "Jabatan pelaksana diteruskan apa adanya ke jalur masuk-sebagai-pejabat, tidak disimpulkan ulang dari jenis penetapannya.",
    ],
    fixed: [
      "Akun Panitera yang diblokir karena mutasi diam-diam digantikan akun kepaniteraan PERTAMA yang kebetulan terdaftar - Panitera Muda, Panitera Pengganti, siapa pun. Papan tetap menulis \"Ditetapkan Panitera\", tombolnya tetap menyala, dan penetapan tercatat di SIPP atas nama orang yang tidak pernah ditunjuk. Sekarang: bila penautan kredensial ADA tetapi tak satu pun berperan Panitera, papan mengatakan akun Panitera tidak ditemukan dan PPP/PJS tidak ditawarkan. Pemasangan yang kredensialnya memang belum ditautkan sama sekali tetap berjalan seperti dulu - di sana tidak ada peran untuk dibaca, dan penjagaan yang tidak dapat ditegakkan lebih baik tidak berpura-pura ada.",
      "Berganti akun ke Plh yang jabatannya berbeda GAGAL dengan 404. Pelaksananya sudah dipilih dengan benar, tetapi jalur di bawahnya mencarinya sekali lagi di tabel yang lazim bagi jenis penetapan itu - Plh Ketua yang seorang Panitera dicari di user_hakim, dan tidak akan pernah ketemu. Kegagalannya justru muncul pada keadaan yang paling memerlukan pergantian akun.",
    ],
    security: [
      "Yang menggeser tanda tangan tetap SK, bukan kemiripan jabatan. Panitera yang cuti tanpa Plh yang ditunjuk TIDAK dengan sendirinya menjadikan Panitera Muda berwenang - menebaknya dari daftar pegawai kepaniteraan berarti ALETA mengarang kewenangan, dan penetapan yang lahir dari karangan itu tetap tercatat di SIPP.",
    ],
    operationalNotes: [
      "Selama Panitera bertugas penuh, tidak ada perubahan perilaku sama sekali - papan dan tombolnya menyebut nama yang sama seperti kemarin.",
      "PLH/PLT Panitera dicatat di menu Penugasan dengan jabatan target Panitera beserta rentang tanggalnya. Cutinya sendiri dicatat di e-Kepegawaian dan harus berstatus disetujui sebelum berpengaruh.",
      "Ekstensi naik ke 1.64.0. Nomor seri di kaki panel harus ikut berubah; bila masih tertulis 1.63.0 sesudah Chrome dibuka ulang, yang mendarat baru sebagian dan penyegarnya perlu dijalankan lagi.",
    ],
    knownLimitations: [
      "Jalur PLH Panitera belum pernah diadu dengan SK yang berjalan - yang terbukti di data hidup baru jalur Panitera hadir. Perilakunya saat berhalangan diuji dari perakit rencananya, bukan dari penugasan sungguhan.",
      "Akun pelaksana PHS masih dugaan dari usulan majelis sampai PMH tersimpan, dan pembacaan ulangnya belum dipaksakan.",
      "Ukuran panel disimpan satu untuk seluruh halaman SIPP, bukan per halaman. Halaman daftar dan halaman perkara memerlukan lebar yang berbeda, dan yang dipakai keduanya adalah yang terakhir diatur.",
    ],
  },
  {
    version: "1.63.0",
    title: "ALETA v1.63.0 - Penetap yang Benar, Panel yang Menurut",
    date: "2026-09-04",
    status: "Operasional",
    summary:
      "Papan penetapan selalu menyebut Ketua definitif sebagai yang menandatangani PMH - padahal Ketua cuti lalu Wakil atau seorang Hakim menandatangani sebagai Plh adalah keadaan yang benar-benar terjadi. Nama yang salah justru di baris yang menentukan akun mana yang dipakai, dan penetapan yang terlanjur tercatat atas nama orang yang sedang berhalangan tidak dapat dibetulkan dari ALETA.",
    added: [
      "Penetap PMH mengikuti rantai KETUA - WAKIL - PLH pada TANGGAL PENETAPAN, bukan pada hari ini, sehingga rencana bertanggal mundur menyebut siapa yang berwenang pada tanggal itu. Wakil Ketua TIDAK perlu diangkat PLH: jabatannya sejajar, dan ketika Ketua tidak hadir ia menandatangani sebagai Wakil Ketua. PLH baru dipakai bila Ketua DAN Wakil sama-sama tidak ada - yang ditunjuk biasanya Hakim, dan bila hakim pun tidak ada barulah Panitera atau Sekretaris.",
      "Ketidakhadiran dan penunjukan dibaca dari dua tempat yang berbeda, dan itu disengaja. Cuti berstatus disetujui menjawab \"apakah Ketua ada hari ini\"; penugasan PLH/PLT menjawab \"siapa yang ditunjuk bila keduanya tidak ada\". Keduanya tidak dapat saling menggantikan - cuti tidak memberi kewenangan kepada siapa pun, dan penunjukan tidak membuktikan siapa pun sedang pergi. Pengajuan cuti yang belum disetujui tidak dihitung: bila dihitung, Ketua kehilangan wewenangnya begitu mengajukan cuti.",
      "Sebutan penetap dikirim dari server, tidak lagi disimpulkan ekstensi. Papan menulis \"Ditetapkan PLH Ketua Pengadilan\" atau \"Ditetapkan Wakil Ketua Pengadilan\" apa adanya, sesuai siapa yang benar-benar akan menandatangani.",
      "Panel ekstensi dapat diubah ukurannya dengan menarik sudut kanan-bawah, dan ukurannya diingat seperti posisinya. Tombol kembali ke bawaan di kepala panel memulihkan ukuran sekaligus posisi - panel yang tertarik ke luar layar atau dikecilkan sampai tidak terbaca tetap punya jalan pulang.",
      "Nomor seri ekstensi tercetak di kaki panel. Laporan \"panelnya keliru\" tanpa nomor seri membuat pemeriksaan dimulai dari menebak versi mana yang sedang dipakai - dan tebakan itu hampir selalu meleset di kantor yang komputernya disegarkan sendiri.",
    ],
    changed: [
      "Panel dijangkarkan pada kiri-atas begitu terpasang, bukan pada kanan-atas. Pada jangkar lama, menarik sudut untuk melebarkan justru menumbuhkan panel ke KIRI sementara sudut yang ditarik diam di tempat. Koordinatnya persis sama sehingga tampilannya tidak bergeser, dan panel dijepit kembali ke dalam layar bila jendela diperkecil.",
      "Jalur \"Masuk sebagai pejabat\" memakai rantai yang sama persis dengan papan penetapan. Membacanya hanya di satu tempat berarti papan menyebut satu nama sementara tombolnya memasukkan petugas sebagai nama lain - selisih yang justru muncul di jalur yang paling sulit dibetulkan.",
    ],
    fixed: [
      "Panel yang menampilkan \"Masuk ke ALETA\" tidak pernah menyambung sendiri sesudah petugas masuk. Nomor perkaranya dikunci, dan penjaga pengulangan memotong setiap pemeriksaan berikutnya - satu-satunya jalan keluar memuat ulang halaman SIPP. Sekarang panel itu menunggu: memeriksa berkala, dan SEKETIKA saat perhatian kembali ke tab SIPP, karena itulah saat yang paling mungkin sesudah orang selesai masuk di tab lain.",
      "Dua keadaan yang dulu diam kini BERSUARA di catatan langkah: SK PLH yang ada tetapi tidak dipakai karena pimpinan definitif masih dapat menandatangani, dan keadaan Ketua serta Wakil sama-sama tidak ada tanpa PLH tercatat - yang terakhir menyuruh menerbitkan PLH lebih dulu, bukan diam-diam memakai pimpinan yang sedang cuti.",
      "Penyegar ekstensi memperbarui SEBAGIAN berkas tanpa satu pun tanda. Penyalinnya memutuskan sendiri berkas mana yang \"sudah sama\" dari ukuran dan cap waktunya - dan manifest.json selalu lolos saringan itu: cap waktunya tetap karena berasal dari paket yang dibangun secara pasti, dan \"1.62.0\" menjadi \"1.63.0\" tidak mengubah jumlah hurufnya. Akibatnya kode versi baru berjalan di atas manifest versi lama. Penyalinannya kini menimpa tanpa syarat, dan versi yang benar-benar mendarat dibaca ulang dari disk sebelum apa pun dilaporkan berhasil.",
    ],
    security: [
      "Yang menentukan penetap tetap penunjukan resmi, bukan simpulan ALETA. Ketua yang cuti tanpa Plh yang ditunjuk TIDAK dengan sendirinya menjadikan Wakil berwenang - menebaknya dari daftar cuti berarti ALETA mengarang kewenangan, dan penetapan yang lahir dari karangan itu tetap tercatat di SIPP.",
    ],
    operationalNotes: [
      "Selama belum ada penugasan PLH/PLT yang tercatat aktif, penetap PMH tetap Ketua definitif seperti sebelumnya - tidak ada perubahan perilaku bagi pengadilan yang Ketuanya sedang bertugas penuh.",
      "Cuti pimpinan dicatat di modul e-Kepegawaian dan harus berstatus disetujui sebelum berpengaruh. Penugasan PLH/PLT dicatat di menu Penugasan dengan jabatan target Ketua Pengadilan beserta rentang tanggalnya - dan hanya perlu dibuat bila Ketua dan Wakil sama-sama tidak ada.",
    ],
    knownLimitations: [
      "PPP dan PJS belum mengenal penugasan: bila Panitera berhalangan dan digantikan Wakil Panitera, papan masih menyebut Panitera definitif. Jalurnya sudah tersedia dan tinggal disambungkan, tetapi belum diuji terhadap data yang berjalan.",
      "Ukuran panel disimpan satu untuk seluruh halaman SIPP, bukan per halaman. Halaman daftar dan halaman perkara memerlukan lebar yang berbeda, dan yang dipakai keduanya adalah yang terakhir diatur.",
    ],
  },
  {
    version: "1.62.0",
    title: "ALETA v1.62.0 - Penetapan Tanpa Buka-Tutup Akun",
    date: "2026-09-03",
    status: "Operasional",
    summary:
      "PMH, PPP, PJS, dan PHS dikerjakan pejabat yang berbeda, sehingga operator harus masuk-keluar empat akun SIPP untuk satu perkara. Sekarang cukup satu tombol: ALETA menutup sesi yang terbuka, masuk sebagai pejabatnya, dan MEMBUKTIKAN pendaratannya sebelum melepas petugas ke SIPP. Penyimpanan otomatis tetap MATI - ALETA mengisi kolom, tombol Simpan tetap ditekan orang.",
    added: [
      "Tombol \"Masuk sebagai [pejabat]\" pada formulir penetapan yang bukan urusan akun yang sedang dipakai. Sesi lama ditutup lebih dulu, kredensial pejabatnya dipasang, lalu nama yang muncul di kepala halaman SIPP dicocokkan dengan nama pejabat yang dimaksud. Tombol \"Teruskan\" yang lama tetap tersedia sebagai pilihan kedua bagi yang menghendaki alur titipan.",
      "Uji sandi SIPP saat kredensial disimpan di Manajemen Akun - TANPA memasukinya. Sidik sandinya dihitung lalu dibandingkan dengan sys_users.password; tidak ada sesi yang dibuat, sys_user_online tidak tersentuh, dan sys_users.last_login tidak berubah. Tiap sebab kegagalan disebut dengan namanya sendiri: sandi tidak cocok, username tidak terdaftar, akun diblokir, atau belum dapat diuji.",
      "Penautan akun SIPP dengan jabatannya, dibaca dari user_hakim, user_panitera, dan user_jurusita - tabel yang dipakai SIPP sendiri saat orang masuk. Panel kesiapan menyebutkan siapa sudah siap dan siapa belum, beserta sebabnya.",
      "Peta kolom lima formulir SIPP - Data Umum, PMH, PPP, PJS, PHS - 35 kolom, seluruhnya dibaca langsung dari berkas view SIPP yang berjalan di server. Selama peta ini kosong, tombol Kerjakan memang sengaja mati.",
      "Perakit rencana kerja penetapan: daftar langkah berurutan untuk satu perkara, lengkap dengan akun pelaksana tiap langkah, nilai beserta asal-usulnya, dan bukti apa yang harus terbaca sesudahnya.",
      "Giliran panitera pengganti - kembaran giliran juru sita. Mengusulkan yang paling sedikit bebannya tahun ini, dan menandai yang sudah lama tidak kebagian sebagai dugaan berhalangan.",
      "Hari sidang tiap majelis terisi: Majelis A Rabu, Majelis B Selasa, Majelis C1 Senin. Diturunkan dari riwayat sidang pertama 2026 lalu dikonfirmasi Ketua Pengadilan.",
      "Pembaruan ekstensi tanpa dikerjakan orang. Portal menyajikan paket .crx bertanda tangan beserta naskah updates.xml, keduanya sengaja dapat diambil TANPA sesi portal - Chrome memeriksa pembaruan dari peramban, bukan dari halaman yang sedang dibuka, sehingga permintaannya tidak membawa kuki siapa pun. Di komputer WORKGROUP, penyegarnya berupa skrip yang berjalan saat masuk Windows: folder ekstensi disamakan dengan paket di portal, dan Chrome memakai isi yang baru saat dibuka lagi. Berkasnya di deploy/chrome.",
      "Manifest ekstensi membawa kunci publiknya sendiri, disisipkan dari kunci penanda tangan saat diminta. Akibatnya ID ekstensi TIDAK berubah meskipun foldernya berpindah - tanpa itu Chrome mengarang ID dari letak folder, sehingga tiap penyegaran akan tampak seperti ekstensi yang lain dan setelan petugas hilang.",
    ],
    changed: [
      "Panitera pengganti TIDAK lagi ditautkan per majelis. Riwayat menunjukkan penautan itu memang tidak ada di PA Donggala - nama yang sama dipakai lintas majelis, dan yang teratas pun hanya seperempat. Menetapkannya per majelis berarti memaksakan aturan yang tidak berlaku, dan salah untuk tiga perempat perkara. Yang berlaku rotasi, dan itu yang dipakai. Jalur SK per-majelis tetap dipertahankan bagi pengadilan yang memang memilikinya.",
      "Aturan kewenangan penetapan dipindah ke berkasnya sendiri, lepas dari modul antrean. Sebelumnya jalur masuk-sebagai-pejabat ikut menarik seluruh modul antrean beserta tabelnya - dan pemasangan yang belum memiliki tabel itu GAGAL DIBANGUN, padahal yang dipakai hanya dua fungsi yang tidak pernah menyentuh basis data.",
      "Jalur masuk-sebagai-pejabat mengirim sandi lewat fetch, bukan dengan memindahkan halaman. Bedanya: jawabannya masih dapat DIBACA sebelum petugas dilepas ke SIPP, sehingga sesi yang mendarat sebagai orang lain dapat dihentikan - bukan diteruskan lalu baru ketahuan sesudah penetapan tercatat keliru.",
      "Jalur cadangan DILUMPUHKAN saat masuk sebagai pejabat lain. Cadangan mengirim membabi buta tanpa tahu sesinya terbentuk atau milik siapa; untuk \"buka SIPP sebagai diri sendiri\" itu tidak apa-apa, untuk penetapan atas nama orang lain taruhannya bukan itu.",
    ],
    fixed: [
      "Masuk otomatis ke SIPP tidak pernah berhasil, dan gagalnya BISU - yang tampak hanya halaman masuk terbuka kosong. Dua sebab berantai. Pertama, mode sandi tersimpan \"md5\" padahal SIPP mengacak sendiri di sisi server dengan arr2md5(kode_aktivasi, sandi) atas sandi POLOS; mengirim md5 berarti teracak dua kali dan tidak akan pernah cocok, betapa pun benar sandinya.",
      "Sebab kedua: SIPP membuka <form> LANGSUNG di dalam <tbody>, dengan <tr> di dalamnya. Aturan penataan HTML memindahkan tag form itu keluar dari tabel sementara kotak isiannya tetap tinggal di dalam sel - sehingga pemilih \"form input[type=password]\" tidak menemukan apa pun dan formulirnya dianggap tidak ada. Jembatan lalu jatuh ke jalur cadangan, yang mengirim ke alamat halaman login; alamat itu kena pengalihan 302 pada .htaccess SIPP, dan pengalihan 302 atas sebuah POST MEMBUANG isian formulirnya. Sandi tidak pernah sampai.",
      "Nilai kredensial yang tidak terbaca melempar error, bukan mengembalikan kosong. Akibatnya keterangan \"password tidak dapat dibaca, kunci enkripsi berubah\" yang sudah ditulis TIDAK PERNAH terjangkau, dan yang dilihat petugas hanyalah layar error. Terjadi secara wajar: kunci diganti, atau basis data dipulihkan dari cadangan lama.",
      "Mode kewenangan \"ketat\" tidak dibaca sama sekali pada jalur masuk-sebagai-pejabat. Pengadilan yang memilih ketat tetap dijaga saat menutup antrean, tetapi TIDAK dijaga pada jalur yang justru memakai kredensial orang lain.",
      "Halaman jembatan berkata \"mengirim kredensial milik [operator]\" padahal yang dikirim kredensial pejabat lain - keterangan yang menyesatkan justru di layar yang harus paling jelas. Sekarang menyebut keduanya: atas nama siapa, dan dikerjakan siapa.",
      "Tombol \"Masuk manual\" pada halaman jembatan menyimpan sandi pejabat lain di dalam halaman, dengan tombol yang mengirimkannya tanpa menutup sesi lama dan tanpa membuktikan pendaratan - memotong seluruh pengaman. Pada jalur masuk-sebagai-pejabat tombol itu kini tidak dibuat sama sekali.",
      "Peta kolom Posita dan Petitum menunjuk ke posita_text dan petitum_text, padahal keduanya hanya <td> pembungkus - instance CKEditor-nya bernama posita dan petitum. Penunjuk yang salah tidak gagal, ia hanya diam-diam tidak mengisi apa pun.",
    ],
    security: [
      "Masuk sebagai pejabat lain adalah PINTU YANG BERBEDA dari \"buka SIPP sebagai diri sendiri\", dengan gerbang izin, pemeriksaan kesiapan, dan jejaknya sendiri. Yang pertama hanya memakai kredensial sendiri; yang kedua memakai kredensial orang lain, dan segala yang dikerjakan sesudahnya tercatat atas nama orang itu.",
      "Akun yang sandinya belum teruji DITOLAK sebelum berangkat, bukan dibiarkan gagal di tengah rangkaian - kegagalan di tengah meninggalkan perkara setengah jadi, dan itu jauh lebih sulit dibereskan daripada penolakan di awal.",
      "Akun yang diblokir tidak pernah terpilih. Pada data yang berjalan, satu hakim memiliki tiga akun SIPP dan ketiganya diblokir karena mutasi; jawaban yang benar adalah \"tidak ada akun aktif\", bukan memaksa memakai salah satunya.",
      "Jejak masuk-sebagai-pejabat ditulis SEBELUM jembatan dibuka, bukan sesudah. Yang dicatat adalah niat, dan niat sudah cukup untuk dipertanggungjawabkan - mencatat sesudahnya berarti percobaan yang putus di tengah tidak meninggalkan jejak sama sekali, padahal justru itu yang paling perlu terbaca.",
      "Uji sandi membandingkan di sisi bot, bukan di portal. Yang keluar hanya \"cocok\" atau \"tidak\"; sidik sandi tersimpan dan kode aktivasinya tidak pernah meninggalkan sisi SIPP - sepasang sidik beserta garamnya adalah bahan pembongkaran sandi secara luring.",
      "Penyimpanan otomatis tetap MATI sebagai bawaan. ALETA sanggup mengisi kolom; yang menjadikannya penetapan tetap jari petugas di tombol Simpan.",
    ],
    operationalNotes: [
      "Penautan akun-jabatan dibaca dari tabel SIPP, bukan disimpulkan dari kebiasaan pemakaian. Kesimpulan dari 770 penetapan sempat menunjuk akun Waka062024 sebagai Majelis B pada 96% penetapan - padahal itu Akbar Ali yang sudah mutasi dan akunnya diblokir. Kebiasaan pemakaian menjawab siapa yang DULU memegang majelis, bukan siapa sekarang.",
      "Kelima akun majelis sudah terverifikasi sandinya: fahri (A), sudarmin (B), Himawan (C1), Idris (C2), derry briantono (C3), ditambah Sri Susilowati sebagai Panitera. Idris dan Derry tidak memiliki hari sidang sendiri - pada data 2026 keduanya selalu duduk sebagai anggota, tak pernah memimpin majelis.",
      "Peta kolom dan hari sidang diterapkan sebagai DATA, bukan kode - portal membacanya saat berjalan, tidak perlu membangun ulang wadah. Keduanya sengaja tidak disemai ulang tiap kali portal menyala, supaya suntingan admin lewat \"baca formulir\" tidak tertimpa.",
      "Rencana kerja hanya dirakit bila peran yang membuka memang berwenang atas penunjukan otomatis. Merakit rencana tidak menulis apa pun ke SIPP - yang menulis tetap ekstensi di peramban petugas.",
      "Kunci penanda tangan ekstensi HARUS dicadangkan di luar server. ID ekstensi diturunkan dari kunci itu; kehilangannya tidak dapat dipulihkan, hanya dapat diganti - dan penggantian berarti kebijakan di TIAP komputer petugas disetel ulang satu per satu. Kuncinya tidak pernah disimpan di dalam kode, hanya dibaca dari lingkungan server.",
      "Sebelum memasang salinan baru, salinan lama yang dimuat \"Load unpacked\" harus dihapus dari chrome://extensions. ZIP dan .crx kini berjati diri sama, tetapi dua salinan yang terlanjur terpasang tetap menempel ke halaman SIPP yang sama dan panelnya muncul dobel.",
      "Jalur kebijakan Chrome (ExtensionInstallForcelist) hanya bekerja di komputer yang terdeteksi terkelola perusahaan - anggota domain, Azure AD, atau MDM. Di komputer WORKGROUP, termasuk semua Windows 10 Home, Chrome menandai nilainya [BLOCKED] dan hanya mengizinkan ekstensi dari Chrome Web Store. Terbukti di komputer uji: kebijakan terpasang benar, server terjangkau, dan Chrome tidak pernah sekali pun meminta updates.xml. Karena itu penyegar folder yang dipakai, bukan kebijakan.",
    ],
    knownLimitations: [
      "Akun pelaksana PHS masih DUGAAN dari usulan majelis. Ketua majelis baru pasti sesudah PMH tersimpan, dan pembacaan ulangnya setelah PMH mendarat belum dipasang - untuk sekarang rencana menandainya \"tentatif\" dan menyuruh membacanya ulang, tetapi belum ada yang memaksakannya.",
      "Rangkaian lima langkah berurutan dengan jeda 15-60 detik dan pemeriksaan hasil tiap langkah belum berjalan sendiri. Yang ada sekarang: satu langkah, satu tombol, satu kali tekan Simpan oleh petugas.",
      "Tabel antrean penetapan belum ada di pemasangan ini, sehingga alur \"Teruskan\" menyimpan titipannya tetapi papan penerimanya belum lengkap.",
      "Uji tulis sungguhan ke SIPP belum pernah dijalankan. Pengisian dan pergantian akun sudah terbukti; yang belum adalah menekan Simpan pada perkara nyata - dan itu memang menunggu perkara baru mendaftar.",
      "Nomor SK penetapan dibiarkan kosong, mengikuti kebiasaan yang berjalan di PA Donggala - pada seluruh baris perkara 545 nomor itu memang tidak diisi.",
    ],
  },
  {
    version: "1.61.0",
    title: "ALETA v1.61.0 - Data Umum Terisi Lengkap",
    date: "2026-09-01",
    status: "Operasional",
    summary:
      "Pembacaan berkas gugatan sebelumnya hanya memetik identitas penggugat dan petitum - tidak cukup untuk mengisi formulir Data Umum, sehingga petugas tetap mengetik sendiri tanggal menikah, nomor kutipan akta nikah, KUA, dan posita. Justru bagian itulah yang paling panjang dan paling sering salah ketik. Sekarang keempatnya ikut terpetik, beserta obyek sengketa dan tanggal surat.",
    added: [
      "Data pernikahan dipetik dari kalimat pertama posita: tanggal menikah, nomor kutipan akta nikah, tanggal kutipannya, dan KUA tempat menikah. Keempatnya tersimpan di perkara_data_pernikahan pada SIPP.",
      "Posita dipetik utuh - seluruh dalil bernomor, berhenti tepat sebelum petitum. Keduanya isian yang berbeda di SIPP, dan tanpa batas itu petitum ikut terserap dan tercatat dua kali.",
      "Obyek sengketa gugatan disimpulkan dari jenis dalilnya, dan tanggal surat dari kepala gugatan.",
      "Tanggal Indonesia diubah ke bentuk hari/bulan/tahun yang dipakai SIPP, termasuk ejaan lama Nopember dan Pebruari yang masih lazim di berkas pengadilan.",
      "PMH yang sudah terisi diadu dengan perkara_smartmajelis. Yang menyimpang disebutkan beserta kedua susunannya, dan penyimpangan yang berketerangan - isbat terpadu, sidang keliling, hakim berhalangan - dibedakan dari yang tanpa keterangan.",
      "Setelan penetapanBerjabatan: longgar berarti operator dapat mengerjakan keempat penetapan; ketat mengunci tiap penetapan pada jabatannya.",
    ],
    changed: [
      "Istilah diseragamkan ke bahasa Indonesia baku: borang menjadi formulir, medan menjadi kolom, titipan menjadi penerusan. Yang diubah hanya tulisan yang dibaca orang - nama kolom basis data tetap, sebab menggantinya pada migrasi yang memakai CREATE TABLE IF NOT EXISTS tidak akan mengganti namanya pada basis data yang sudah berdiri.",
      "Aturan jabatan penetapan bawaannya LONGGAR - operator dapat mengerjakan keempatnya, mengikuti cara kerja yang berjalan atas arahan Ketua Pengadilan demi kelancaran proses. Sebelumnya penetapan yang bukan jabatannya ditolak.",
      "Ketua majelis tidak lagi diberi tahu ada penetapan menunggu; PHS dikerjakan langsung oleh operator seperti ketiga penetapan lainnya.",
    ],
    fixed: [
      "Penyeragaman istilah sempat ikut mengganti nama kolom basis data pada migrasi 0020 - borang menjadi formulir, medan menjadi kolom. Migrasi itu sudah terkirim di paket 1.56.0 dan memakai CREATE TABLE IF NOT EXISTS, sehingga tabelnya tidak akan pernah disusun ulang: kueri akan mencari kolom yang tidak ada pada basis data yang sudah berdiri. Seluruh nama pengenal dikembalikan, dan uji kontraknya menjaganya.",
      "Tanggal menikah tidak lagi terisi tanggal surat gugatan. Tanggal surat muncul lebih dulu di dokumen, dan pemetikan yang mengambil tanggal pertama akan mengisi tanggal menikah dengan tanggal gugatannya sendiri - sekarang yang dicari tanggal yang mendahului kata melangsungkan pernikahan.",
    ],
    security: [
      "Berapa pun setelan jabatannya, catatan pengisian TETAP menyebutkan siapa yang benar-benar mengerjakannya dan jabatan mana yang seharusnya. Yang dilonggarkan penjagaannya, bukan kejujuran catatannya - pertanyaan siapa yang mengerjakan penetapan ini tetap dapat dijawab apa adanya.",
      "Obyek sengketa yang tidak dikenali dibiarkan kosong. Menebaknya pada perkara ekonomi syariah atau harta bersama berarti mengisi kolom yang menentukan dengan tebakan.",
      "KUA dipetik berhenti pada nama provinsi, tidak menyeret sisa kalimat - isian KUA di SIPP daftar tertutup yang tidak menerima kalimat.",
    ],
    operationalNotes: [
      "v_perkara adalah VIEW, bukan tabel - ia ikut sendiri begitu perkara terisi, dan tidak ada yang perlu ditulis ke sana.",
      "perkara_hakim_pn, perkara_panitera_pn, perkara_jurusita, perkara_smartmajelis, dan perkara seluruhnya bertrigger ke sync_antrian. Mengisi lewat formulir SIPP membuat trigger itu berjalan sendiri, beserta sys_audittrail dan perkara_proses - sama persis dengan petugas yang mengetik sendiri.",
      "Data pernikahan tersimpan di perkara_data_pernikahan, bukan di perkara. Perkara isbat memakai perkara_data_itsbat yang bentuknya berbeda.",
    ],
    knownLimitations: [
      "Pemetikan mengenali bentuk kalimat gugatan cerai yang baku. Gugatan yang susunannya jauh berbeda akan meninggalkan sebagian isian kosong - dan itu disebutkan apa adanya, bukan ditebak.",
      "Kode KUA belum dipetakan ke ref_kua; yang dipetik namanya, dan pemilihannya di formulir masih dikerjakan petugas.",
      "Keanggotaan majelis untuk PHS belum diperiksa terhadap perkara ini.",
    ],
  },
  {
    version: "1.60.0",
    title: "ALETA v1.60.0 - Menitipkan Pekerjaan, Bukan Akun",
    date: "2026-09-01",
    status: "Operasional",
    summary:
      "Keempat penetapan dikerjakan pejabat yang berbeda, dan selama ini satu operator mengerjakan keempatnya dengan masuk-keluar empat akun SIPP. Sekarang usulannya dititipkan, lalu muncul di panel pejabatnya begitu ia membuka SIPP dengan akunnya sendiri - tinggal diperiksa dan ditekan sekali. Empat kali berganti akun berubah jadi empat orang menekan sekali.",
    added: [
      "Antrean penetapan: usulan yang sudah disiapkan dititipkan untuk dikerjakan pejabat yang berwenang. Tidak ada kata sandi yang disimpan, tidak ada yang masuk atas nama siapa pun.",
      "Tombol pada papan penunjukan berubah menurut jabatan: Kerjakan bila memang urusan jabatan yang sedang masuk, Titipkan ke Panitera atau Titipkan ke Ketua Pengadilan bila bukan.",
      "Menu Menunggu penetapan Anda di panel - pejabatnya tahu ada pekerjaan tanpa ada yang perlu meneleponnya, lengkap dengan tautan ke perkaranya.",
      "Titipan ditutup sendiri begitu penetapannya benar-benar dikerjakan, sehingga tidak terus muncul sebagai pekerjaan yang menunggu.",
    ],
    changed: [
      "Usulan yang dititipkan disimpan BEKU, bukan dihitung ulang saat pejabatnya membukanya. Giliran juru sita bergeser tiap ada penetapan baru, dan usulan yang berubah diam-diam antara dititipkan dan dikerjakan adalah usulan yang tidak pernah diperiksa siapa pun dalam bentuk yang akhirnya tercatat.",
      "Titipan kedua atas perkara dan jenis yang sama menggantikan yang pertama, bukan menumpuk - pejabatnya tidak boleh disuruh memilih di antara dua usulan tanpa tahu mana yang terbaru.",
    ],
    fixed: [
      "Kewenangan mengisi blangko tidak lagi berarti kewenangan atas keempat penetapan. Sebelumnya kode hanya tahu \"boleh mengisi blangko atau tidak\" - sehingga Panitera yang diberi kewenangan itu dapat mengisi blangko PMH, yang merupakan perbuatan Ketua Pengadilan. Sekarang jabatannya diperiksa per penetapan, dan diperiksa di server saat pengisiannya dicatat.",
    ],
    security: [
      "ALETA TIDAK menyimpan kredensial pejabat mana pun, dan tidak masuk SIPP atas nama siapa pun. Menyimpan kata sandi agar satu orang dapat bertindak sebagai empat pejabat akan menghapus satu-satunya hal yang membuat penetapan dapat dipertanggungjawabkan - dan itu sengaja tidak dibangun.",
      "Menitipkan boleh dilakukan siapa pun yang boleh membuka papan penunjukan; MENUTUPNYA sebagai dikerjakan hanya oleh jabatan yang berwenang. Tanpa pembedaan itu, siapa pun yang tahu id titipannya dapat menyatakan penetapan sudah dikerjakan padahal belum ada yang menyentuhnya.",
      "Membatalkan titipan boleh dilakukan siapa pun - operator yang salah menitipkan harus dapat menariknya kembali tanpa memanggil Ketua.",
      "PMH milik Ketua dan Wakil Ketua; PPP dan PJS milik Panitera; PHS milik ketua majelis perkara itu. Super Admin dan Admin tetap berwenang atas keempatnya.",
    ],
    operationalNotes: [
      "Alur yang dimaksudkan: operator membuka perkara, menyiapkan keempat usulan, dan menitipkan yang bukan urusannya. Tiap pejabat lalu membuka SIPP seperti biasa, melihat Menunggu penetapan Anda, dan menekan sekali per perkara.",
      "Urutan SIPP tetap berlaku - PMH harus ada sebelum PPP dan PJS dapat diisi. Titipan boleh disiapkan lebih dulu, tetapi pengisiannya tetap menunggu gilirannya.",
      "Wakil Ketua ikut berwenang atas PMH karena Ketua berhalangan adalah keadaan yang benar-benar terjadi, dan menuntut penetapan berhenti sampai Ketua kembali berarti perkara ikut berhenti.",
    ],
    knownLimitations: [
      "Keanggotaan majelis untuk PHS belum diperiksa - untuk sekarang seluruh hakim berwenang atas PHS, bukan hanya ketua majelis perkara itu.",
      "Belum ada pemberitahuan WhatsApp saat ada titipan baru; pejabatnya baru tahu ketika membuka panel.",
      "Titipan tidak kedaluwarsa sendiri - keadaan kedaluwarsa sudah disediakan tabelnya, tetapi belum ada yang menandainya.",
    ],
  },
  {
    version: "1.59.0",
    title: "ALETA v1.59.0 - Panel Ekstensi Berhenti Menyesakkan",
    date: "2026-09-01",
    status: "Operasional",
    summary:
      "Dua belas menu datar di panel SIPP menjadi empat kelompok, dan tiap menu kini menyebutkan isinya sebelum dibuka. Tidak satu keterangan pun dihilangkan - yang hilang hanya kewajiban membuka dua belas menu untuk tahu bahwa sebelas di antaranya kosong.",
    added: [
      "Lencana pada tiap menu: 7/8, belum putus, 2 belum dikonfirmasi, lengkap. Merah menuntut tindakan, kuning perlu diperhatikan, hijau sudah beres, abu memang tidak ada apa-apa.",
      "Empat kelompok menggantikan dua belas baris datar: Berkas, Perkara, Putusan, dan Kerjakan. Kepala kelompok yang tertutup menyebutkan keadaan paling genting di dalamnya.",
      "Nomor perkara dapat disalin dengan menekannya di kepala panel - menggantikan nomor register sebagai yang utama, sebab nomor perkara yang dipakai sehari-hari. Registernya tetap ada di baris kedua, juga dapat disalin.",
    ],
    changed: [
      "Kepala panel dari enam baris menjadi dua: baris pertama tentang perkaranya, baris kedua tentang siapa yang membaca dan sejauh mana datanya. Penanda data basi TIDAK ikut dipadatkan - ia satu-satunya keterangan di kepala yang dapat membatalkan seluruh isi panel.",
      "Menu yang perannya tidak berwenang tidak lagi digambar. Sebelumnya Penunjukan, Data Umum, dan Baca Medan Blangko tetap muncul untuk semua orang dan baru menolak sesudah ditekan - tiga baris yang tidak pernah dapat dibuka juru sita maupun panitera muda. Super Admin dan Admin tetap penuh.",
      "Baca Medan Blangko dibatasi ke Super Admin dan Admin. Ia alat memetakan blangko, jawabannya sama pada perkara mana pun - bukan keterangan perkara. Rencana semula memindahkannya ke popup ikon, tetapi itu menuntut izin tabs yang sengaja dihindari ekstensi ini sejak awal.",
      "Urutan menu mengikuti perjalanan perkara - berkas masuk, perkara berjalan, perkara putus, lalu yang dikerjakan. Sebelumnya urutannya mengikuti kapan menunya dibuat.",
    ],
    fixed: [
      "Penanda \"nomor belum dikonfirmasi\" di halaman SIPP muncul pada SETIAP pihak, termasuk yang nomornya justru sudah diverifikasi. Sebabnya: keadaannya dibandingkan dengan nilai \"terkonfirmasi\" yang tidak pernah dihasilkan server sama sekali - yang sah hanya terverifikasi, menunggu, ditolak, dan belum_pernah_ditanya. Perbandingannya karena itu selalu benar. Salahnya tidak pernah terlihat karena pihak yang sudah terverifikasi memang masih sedikit: penandanya tampak benar hampir sepanjang waktu, dan baru keliru pada perkara yang justru sudah beres.",
    ],
    security: [
      "Kewenangan peran ikut dikirim rute konteks supaya menu yang mustahil dipakai tidak digambar. Ini KENYAMANAN, bukan penjagaan - tiap rute tetap memeriksa ulang kewenangannya sendiri sebelum menjawab, sebab ekstensi berjalan di peramban pengguna dan dapat diubah siapa saja yang memasangnya.",
      "Kewenangan yang belum terbaca berarti menu TETAP digambar. Menyembunyikannya saat ragu akan membuat pemasangan baru tampak kehilangan separuh fiturnya, dan yang disalahkan biasanya ekstensinya - bukan jawaban yang belum sampai.",
      "Kelompok Kerjakan dipisah dari yang dibaca bukan demi kerapian: mencampur menu yang menampilkan keterangan dengan menu yang mengisi blangko SIPP membuat tombol yang menulis duduk di antara tombol yang tidak, dan pada layar sesak itu cara termudah salah tekan.",
    ],
    operationalNotes: [
      "Lencana untuk lima menu diambil dari SATU panggilan yang memang sudah dipakai kelimanya, dan hasilnya sudah disimpan per nomor perkara - tidak ada kueri tambahan. Yang dikerjakan hanya memajukan panggilan itu.",
      "Panggilan itu DITUNDA sekitar satu detik dan berjalan di latar, bukan sebelum panel digambar. Panelnya tetap muncul seketika seperti sebelumnya; lencananya menyusul. Berpindah perkara sebelum satu detik membatalkan panggilannya.",
      "Lencana yang gagal terisi tidak menampilkan error apa pun - menunya tetap dapat dibuka seperti biasa, dan menyebutkan sebabnya sendiri di situ.",
    ],
    knownLimitations: [
      "Papan Penunjukan belum berlencana - keadaannya butuh panggilan tersendiri yang jauh lebih berat, dan memajukannya akan menembakkan hitungan giliran juru sita setahun penuh untuk tiap perkara yang dibuka.",
      "Kelompok Perlu Diperiksa yang disusun sendiri dari seluruh lencana merah dan kuning belum ada; untuk sekarang kegentingan terbaca dari lencana masing-masing.",
    ],
  },
  {
    version: "1.58.0",
    title: "ALETA v1.58.0 - Nomor Antrian Menyatu dengan Jadwal Sidang",
    date: "2026-09-01",
    status: "Operasional",
    summary:
      "Jadwal Sidang kini menampilkan nomor antrian - besar di atas jam sidang yang mengecil. Antrian online lewat WhatsApp dan antrian di mesin masuk SATU deret, diurut menurut waktu ambil. Nomornya dihitung dengan rumus yang sama persis dengan yang menjawab WhatsApp, sehingga tidak pernah berselisih dengan nomor yang sudah diterima para pihak.",
    added: [
      "Nomor antrian pada kolom Jam - nomornya besar dan berwarna, jam sidang mengecil di bawahnya. Pada hari sidang yang ditanyakan orang memang \"sekarang nomor berapa\", bukan \"jam berapa dijadwalkan\".",
      "Penanda online pada antrian yang diambil lewat WhatsApp - menyebut ASAL pengambilannya, bukan urutannya.",
      "Waktu ambil dan waktu dipanggil masuk ikut disebut di bawah nomornya.",
      "Tiga kotak saringan baru: Sudah ambil antrian, Antrian online, dan Belum ambil antrian.",
      "Kolom Antrian / Jam dapat diurutkan menurut nomor antrian, dan pencarian lanjutan menerima rentang nomor antrian.",
      "Rute /internal/aleta-bot/antrian/sidang pada bot, untuk membaca seluruh deret antrian beserta nomornya.",
    ],
    changed: [
      "Antrian dibaca bot dari sipp_turunan_antrian lewat sambungan antrian_sidang - sambungan yang sama dengan yang dipakai menjawab WhatsApp, sehingga penyuntingannya dari menu Koneksi SQL berlaku untuk keduanya sekaligus.",
      "Antrian ikut dalam satu permintaan bersama jadwal, bukan permintaan terpisah dari peramban - dua permintaan terpisah menghasilkan dua jawaban yang dapat berbeda umur.",
    ],
    fixed: [
      "Jadwal yang gagal dimuat kini ikut mengosongkan antriannya. Tanpa itu, nomor antrian hari sebelumnya tertinggal di layar bersama pesan error - dan nomor lama yang masih terpampang lebih menyesatkan daripada kolom yang kosong.",
    ],
    security: [
      "Nomor antrian TIDAK PERNAH dihitung ulang di peramban. Menghitungnya dari baris yang kebetulan sedang tampil akan menghasilkan angka yang berubah begitu jadwalnya disaring - dan layar yang menyebut nomor lain dari yang diterima orang lebih buruk daripada layar yang tidak menyebut nomor sama sekali.",
      "Rumus urutannya disalin persis dari layanan yang menjawab WhatsApp, dan uji verify-antrian-sidang.js membacanya langsung dari berkas keduanya - kalau salah satunya diubah tanpa yang lain, ujinya gagal.",
      "Yang terdaftar tetapi belum mengambil TIDAK diberi nomor. Memberi nomor kepada yang belum datang berarti menggeser nomor orang lain.",
      "Kegagalan membaca antrian tidak menjatuhkan layar jadwal - jadwalnya tetap tampil, dan sebabnya disebutkan beserta sambungan mana yang perlu diperiksa.",
      "Seluruh kueri antrian berupa SELECT, dan memakai sambungan antrian_sidang - bukan sambungan SIPP.",
    ],
    operationalNotes: [
      "Online dan offline satu deret, diurut menurut waktu ambil terawal di antara kedua pihak. Membuat dua deret terpisah berarti dua orang memegang nomor 3, dan yang dipanggil lebih dulu jadi soal siapa yang berdiri lebih dekat.",
      "Perkara yang tidak terdaftar di mesin antrian sama sekali menampilkan jam sidangnya seperti semula - kebanyakan perkara memang tidak memakai antrian.",
      "Bila tabel antrian memuat lebih dari satu tanggal, layar menyebutkannya. Pada keadaan itu nomornya patut diragukan, sebab rumus yang menjawab WhatsApp pun tidak menyaring tanggal - keduanya harus dibetulkan bersamaan.",
    ],
    knownLimitations: [
      "Nomor antrian belum ikut tercetak pada Cetak Jadwal.",
      "Layar tidak memuat ulang sendiri saat ada antrian baru diambil - tekan Tampilkan untuk menyegarkan.",
      "Jadwal Mediasi belum menampilkan antrian; mesin antrian memang tidak mencatat pertemuan mediasi.",
    ],
  },
  {
    version: "1.57.0",
    title: "ALETA v1.57.0 - Jadwal yang Dapat Diurut, Disaring, dan Dicari",
    date: "2026-09-01",
    status: "Operasional",
    summary:
      "Jadwal Sidang dan Jadwal Mediasi kini dapat diurutkan lewat kepala kolomnya, disaring lewat kotak berwarna, dan dicari - termasuk pencarian lanjutan per medan. Ketiganya bekerja atas baris yang sudah termuat, tanpa satu pun kueri baru ke SIPP.",
    added: [
      "Kepala kolom dapat ditekan untuk mengurutkan: jam, perkara, agenda, majelis, petugas, ruang, putusan, dan skor kesiapan pada Jadwal Sidang; waktu, perkara, mediator, tempat, tenggang, dan hasil pada Jadwal Mediasi.",
      "Sepuluh kotak saringan berwarna pada Jadwal Sidang: retur, belum dipanggil, putusan e-Court, ditunda, belum ada BAS, sidang pertama, agenda putusan, sudah putus, belum putus, dan tidak perlu dipanggil.",
      "Sepuluh kotak saringan pada Jadwal Mediasi: lewat tenggang, tinggal tujuh hari atau kurang, ditunda, belum ada hasil, berhasil, tidak berhasil, laporan sudah masuk, hakim mediator, mediator non-hakim, dan mediator belum ada.",
      "Kotak pencarian yang menyaring seketika di dalam hasil, menyapu seluruh kolom sekaligus - terpisah dari kotak Cari yang dikirim ke SIPP.",
      "Pencarian lanjutan per medan: delapan medan pada Jadwal Sidang, dan pada Jadwal Mediasi ditambah rentang sisa hari tenggang untuk menanyakan \"yang tinggal berapa hari\".",
    ],
    changed: [
      "Angka pada kotak saringan dihitung dari SELURUH baris yang termuat, bukan dari yang sudah tersaring. Kalau ikut menyusut, menyalakan satu saringan membuat saringan lain tampak nol dan mustahil dilepas kembali.",
      "Menekan kepala kolom berputar tiga langkah - menaik, menurun, lalu kembali ke urutan asal. Tanpa langkah ketiga, satu tekanan yang tidak disengaja mengunci tabelnya sampai halamannya dimuat ulang.",
      "Daftar kosong karena tersaring habis dibedakan dari tanggal yang memang tidak ada sidangnya. Yang satu menyuruh melonggarkan saringan, yang lain menyuruh pindah tanggal - menyamakan keduanya membuat orang mencari di tanggal lain padahal perkaranya ada di depan mata.",
    ],
    fixed: [
      "Nilai kosong sempat ikut terbalik arahnya saat pengurutan dibalik, sehingga mengurut menurun menaikkan baris tanpa ruang sidang ke puncak. Sebabnya: kekosongan disimpulkan dari angka hasil pembandingnya, padahal localeCompare juga mengembalikan 1 dan -1 untuk teks biasa - separuh perbandingan biasa terbaca sebagai kekosongan, dan urutan menurun berhenti bekerja tanpa satu pun error.",
      "Keadaan pengurutan sempat bernama sama dengan indeks baris pada .map((baris, urutan) => ...), sehingga di dalam tabel nama itu berarti nomor urut, bukan keadaan pengurutan. Belum sempat menimbulkan salah tampil, tetapi menunggu kesalahan berikutnya.",
    ],
    security: [
      "Seluruh pengurutan, penyaringan, dan pencarian berjalan atas baris yang SUDAH termuat - tidak ada kueri baru ke SIPP, dan tidak ada data tambahan yang diambil. Mengetik di kotak pencarian tidak menambah satu pun perkara yang terbaca.",
      "Kotak saringan yang jumlahnya nol tetap dapat ditekan bila sedang aktif. Kalau tidak, saringan yang menyisakan nol baris mengunci dirinya sendiri dan tidak dapat dimatikan lagi.",
    ],
    operationalNotes: [
      "Kotak Cari yang lama tetap ada dan tetap dikirim ke SIPP - ia memperluas apa yang diambil. Kotak pencarian yang baru mempersempit apa yang dilihat. Keduanya berguna, dan sengaja tidak digabung.",
      "Saringan digabung dengan \"atau\": menyalakan retur dan ditunda sekaligus berarti \"tunjukkan yang bermasalah\". Medan pencarian lanjutan digabung dengan \"dan\", sebab \"majelis B dan ruang 1\" memang pertanyaan yang ditanya.",
      "Nilai kosong selalu jatuh ke bawah, berapa pun arah urutannya. Mengurut menurut ruang sidang pada jadwal yang separuh ruangnya belum ditentukan tidak lagi menaruh belasan baris kosong di puncak.",
    ],
    knownLimitations: [
      "Pengurutan dan penyaringan tidak ikut tercetak - tombol Cetak masih memakai urutan aslinya.",
      "Pilihan urutan dan saringan tidak tersimpan; berpindah tanggal mengembalikannya ke urutan asal.",
    ],
  },
  {
    version: "1.56.0",
    title: "ALETA v1.56.0 - ALETA Mulai Mengisi Blangko SIPP",
    date: "2026-09-01",
    status: "Operasional",
    summary:
      "Tombol Kerjakan dinyalakan: ALETA mengisikan usulan penunjukan ke blangko SIPP, dan memetik isian Data Umum dari berkas gugatan yang diunggah. Penunjuk medannya disimpan sebagai data yang disunting dari kenyataan, bukan ditebak. Yang menekan Simpan tetap petugas - saklar penyimpanan otomatis ada, dan bawaannya mati.",
    added: [
      "Pembacaan berkas gugatan .docx, .doc, .rtf, .pdf teks, dan .txt, lalu pemetikan isian Data Umum darinya: kedua pihak, umur, agama, pekerjaan, pendidikan, kedua alamat, nilai sengketa, dan petitum.",
      "Tiap petikan menyebutkan potongan kalimat ASALNYA. Gugatan ditulis manusia dan tidak ada dua yang bentuknya sama - petikan tanpa asal-usul hanya bisa dipercaya atau tidak, sedangkan yang menyebutkan barisnya bisa dicocokkan dalam dua detik.",
      "Jembatan ke dunia halaman SIPP, sehingga select2 dan CKEditor dapat diisi benar. Menyetel value pada elemen aslinya membuat tampilannya berubah tanpa nilainya ikut - dan yang tersimpan kemudian bukan yang terlihat.",
      "Peta medan blangko yang disunting dari pengaturan, dengan mode Baca Blangko di ekstensi yang menyebutkan medan apa saja yang benar-benar ada di halaman beserta labelnya.",
      "Tombol Kerjakan pada papan penunjukan. Ia mengenali blangko mana yang sedang terbuka dari MEDANNYA, bukan dari alamat halaman - nama halaman SIPP berbeda antar jenis perkara dan antar versi.",
      "Pemeriksaan balik sesudah Simpan: bot membaca ulang perkara_penetapan dan mencatat apakah yang diisikan benar-benar tercatat. Yang mendarat sebagian tetap tercatat sebagian, bukan dibulatkan jadi berhasil atau gagal.",
      "Catatan pengisian mencatat ASAL tiap nilai - usulan otomatis atau pilihan manual - sehingga pertanyaan seberapa sering usulannya diubah orang dapat dijawab dengan angka.",
      "Saklar penyimpanan otomatis di pengaturan. Bawaannya mati, dan hanya nilai persis \"nyala\" yang menyalakannya.",
    ],
    changed: [
      "Urutan pengisian penunjukan menjadi PMH, PPP, PJS, lalu PHS. Rencana semula mendahulukan PPP dan PJS dengan alasan keduanya paling mudah dibetulkan - itu tidak dapat dijalankan: SIPP menolak penetapan panitera pengganti dan juru sita selama majelisnya belum ditetapkan. Bukan urutan yang lebih aman, melainkan urutan yang diterima sama sekali.",
      "Kalimat \"Tidak mengubah SIPP sama sekali\" dicabut dari keterangan ekstensi dan panduan pemasangan. ALETA kini memang mengisi blangkonya - yang tetap adalah bahwa Simpan ditekan petugas.",
      "Contoh tanggal sidang pada uji tidak lagi memakai perkara verzet. Verzet upaya hukum, dan memakainya sebagai contoh perkara biasa menyesatkan. Acuannya sekarang perkara 468/Pdt.G/2026 - gugatan biasa - ditambah uji sifat menyeluruh untuk seluruh gabungan hari dan tanggal daftar.",
    ],
    fixed: [
      "Pembacaan RTF membuang tabel fon dengan pola yang menuntut dua backslash padahal hanya ada satu, sehingga tabelnya tidak pernah terbuang. Akibatnya nama seluruh fon terbaca sebagai isi dokumen, dan \"Times New Roman\" ikut terpetik sebagai nama pihak berperkara. Diganti pemindai kedalaman kurung, yang juga menangani kelompok bersarang.",
      "Kolom hasil pemeriksaan pada catatan pengisian sempat tersisip ke tabel log tanya-jawab publik alih-alih ke tabel penunjukan - dua tabel yang kebetulan berakhir dengan baris yang sama. Ketahuan karena ujinya menjalankan kuerinya sungguhan, bukan membaca tulisannya.",
    ],
    security: [
      "Penunjuk medan disimpan sebagai data, bukan ditanam di kode. Nama kolom yang salah membuat kueri GAGAL dengan pesan yang menyebut kolomnya; penunjuk medan yang salah membuat pengisian mengenai medan LAIN - dan itu tidak gagal sama sekali, ia hanya salah. Selama petanya kosong, tombol Kerjakan tetap mati.",
      "Blangko yang petanya setengah jadi TIDAK dinyatakan siap. Mengisi separuh blangko lalu menyerahkan sisanya ke petugas menghasilkan blangko yang tidak jelas siapa yang mengisinya - lebih sulit diperiksa daripada blangko yang seluruhnya diketik orang.",
      "Pengisian berhenti pada kegagalan PERTAMA, dan menyebutkan medan mana. Meneruskan sesudah satu medan gagal menghasilkan campuran antara yang diisi ALETA dan yang tertinggal dari isian sebelumnya.",
      "Kewenangan diperiksa lagi di server saat pengisiannya dicatat, bukan hanya sebelum tombolnya digambar. Ekstensi berjalan di peramban pengguna dan dapat diubah siapa saja yang memasangnya.",
      "Jembatan dunia utama hanya menerima pesan dari halaman itu sendiri, dan tidak memutuskan apa pun - ia hanya menyebutkan medan, mengisi satu medan, dan menekan satu tombol. Seluruh keputusan dibuat di sisi yang sudah lewat pemeriksaan kewenangan.",
      "Berkas gugatan TIDAK disimpan di mana pun. Ia dibaca di memori, dipetik, lalu dilepas - salinan ketiga di luar SIPP dan e-Court adalah kewajiban penyimpanan baru yang tidak diminta siapa pun. Ukurannya pun diperiksa sebelum dibaca ke memori, bukan sesudah.",
      "Bot tidak terjangkau saat pemeriksaan balik TIDAK ditandai gagal. Menandainya gagal mencatat kebohongan yang lebih buruk daripada mengakui belum tahu; catatannya dibiarkan belum diperiksa.",
    ],
    operationalNotes: [
      "Sebelum dipakai, peta medan tiap blangko harus diisi lewat Pengaturan. Cara termudah: buka blangkonya di SIPP, buka menu Baca medan blangko ini pada panel ALETA, lalu salin penunjuknya.",
      "Nama medan menurut ALETA - hakim_ketua, panitera, jurusita, tanggal_penetapan, tanggal_sidang, dan simpan - bukan nama medan di SIPP. Peta medanlah yang menghubungkan keduanya, dan itu sebabnya daftar ini tetap sama walau blangko SIPP berganti bentuk.",
      "Keempat penetapan ada di halaman berbeda, sehingga tombol Kerjakan hanya mengisi blangko yang sedang terbuka. Papan menyebutkan urutannya bila halaman yang terbuka bukan salah satunya.",
      "PDF hasil pindaian tidak memuat teks sama sekali. Itu disebutkan apa adanya, bukan dilaporkan sebagai kegagalan membaca.",
      "Berkas .doc lama hanya dapat dibaca kasar, dan hasilnya ditandai begitu di papan. Menyimpan ulang sebagai .docx menghasilkan pembacaan yang bersih.",
    ],
    knownLimitations: [
      "Pilihan manual pada papan penunjukan belum ada - yang diisikan selalu usulan otomatisnya. Catatan pengisian sudah menyediakan tempat untuk membedakan keduanya.",
      "Pengisian Data Umum masih berhenti pada penampilan petikan. Peta medan blangko data-umum sudah disiapkan, tetapi pengisiannya menunggu medan blangko itu dipetakan.",
      "Hakim tunggal untuk isbat terpadu masih satu per satu. Pengerjaan satu blok sekaligus menyusul.",
      "Nomor SK penetapan dikosongkan sampai pengadilan menetapkan polanya.",
    ],
  },
  {
    version: "1.55.0",
    title: "ALETA v1.55.0 - Papan Penunjukan yang Mengusulkan, Belum Menetapkan",
    date: "2026-09-01",
    status: "Operasional",
    summary:
      "Papan baru di halaman SIPP mengusulkan PMH, PPP, PJS, dan PHS sekaligus - siapa majelisnya, panitera penggantinya, juru sita siapa gilirannya, dan sidang pertamanya kapan. Tombol Kerjakan sengaja masih mati: usulannya perlu diadu dengan penunjukan sungguhan lebih dulu. Belum ada satu pun tulisan ke SIPP.",
    added: [
      "Papan Penunjukan pada panel ALETA di halaman SIPP. Keempat baris terisi sejak papan dibuka - PHS tidak menunggu siapa pun, sebab begitu majelisnya diketahui, ketua majelisnya pasti dan harinya sudah ditentukan SK.",
      "Tanggal sidang pertama dihitung: hari sidang majelisnya menurut SK, sekurangnya sepuluh hari sesudah pendaftaran. Diadu dengan perkara 468/Pdt.G/2026 yang sungguhan di SIPP - didaftarkan 28 Juli, Majelis B yang bersidang Selasa, dan sidang pertamanya memang 11 Agustus.",
      "Giliran juru sita dihitung per tahun berjalan: yang paling sedikit menerima didahulukan, dan bila jumlahnya sama, yang paling lama tidak kebagian. Hitungannya ditampilkan terbuka, sehingga usulannya dapat diperiksa, bukan sekadar dipercaya.",
      "Penanda dugaan berhalangan: juru sita yang sudah tertinggal dua putaran penuh ditandai, supaya cuti yang tidak diketahui ALETA tetap tertangkap sebelum gilirannya menumpuk.",
      "Hakim tunggal diusulkan dari yang paling sedikit menerima perkara hakim tunggal tahun ini - hanya perkara berhakim tunggal yang dihitung, bukan perkara majelis.",
      "Ekonomi syariah punya jalannya sendiri: nilai sengketa menentukan tunggal atau majelis, dan hakimnya harus duduk pada majelis berkompetensi ekonomi syariah. Ambang nilainya dapat disunting; daftar kompetensinya dibaca langsung dari SIPP.",
      "Dua kemampuan baru pada pengaturan akses ekstensi: Papan penunjukan dan Tombol otomatis penunjukan, dapat dinyalakan sendiri-sendiri per peran.",
      "Menu pengaturan hari sidang tiap majelis beserta kode panitera penggantinya, dan aturan hitungan - jeda minimal, ambang nilai sengketa, klasifikasi hakim tunggal. Semuanya isian, sehingga SK berikutnya cukup disunting.",
    ],
    changed: [
      "Nomor pihak pada panel ekstensi dipindah ke paling bawah dan terlipat sebagai bawaan - bukan yang dicari orang saat membuka panel, dan daftar nomor yang selalu terbuka memajang data pribadi lebih lama daripada perlu.",
      "Nama dan jabatan pengguna ALETA ditampilkan di kepala panel. Panel melayang di atas halaman SIPP yang punya akun sendiri, dan keduanya belum tentu orang yang sama.",
      "Sebelas tabel SIPP ditambahkan ke pengenalan skema: hakim_pn, user_hakim, jabatan_hakim, panitera_pn, user_panitera, jurusita, user_jurusita, perkara_smartmajelis, ref_majelis_tetap, ref_sk_majelis_tetap, dan ref_kompetensi_majelis.",
    ],
    fixed: [
      "perkara_penetapan dibaca dengan keliru sebagai banyak baris per perkara, dan yang dipakai barisnya yang pertama. Kunci utamanya perkara_id - SATU baris per perkara, dan keempat penetapan menempati kolom berbeda pada baris yang sama. Riwayat penggantiannya ada di perkara_hakim_pn, bukan di sana.",
      "Jawaban kemampuan bagi Super Admin dan Admin sebelumnya mengetik ketiga kuncinya satu per satu. Kemampuan keempat yang lupa diketik akan terbaca undefined - yaitu tidak boleh - justru bagi peran yang seharusnya tidak pernah dibatasi. Sekarang disusun dari daftar kemampuannya.",
    ],
    security: [
      "Seluruh kueri penunjukan berupa SELECT, dan ada uji yang menjaganya tetap begitu. Nomor perkara selalu masuk sebagai parameter - ada uji yang menembakkan nomor berisi DROP TABLE dan memeriksa ia tidak pernah sampai ke teks kueri.",
      "Papan ini TIDAK menulis apa pun ke SIPP. Tombol Kerjakan mati, dan itu bukan pekerjaan yang tertinggal: usulannya memang perlu diadu dengan penunjukan sungguhan sebelum diberi izin menyentuh blangko.",
      "Aturan hitungan datang dari portal bersama permintaannya, dan tiap nilai diperiksa ulang di gerbang bot sebelum dipakai. Gerbangnya memang bertoken internal, tetapi angka yang salah bentuk tetap melahirkan tanggal sidang yang salah - dan tanggal sidang yang salah menyeret panggilan para pihak.",
      "Kemampuan papan dan kemampuan tombol otomatis diperiksa terpisah di server. Jawaban yang dikirim ke ekstensi kenyamanan, bukan penjagaan - ekstensi berjalan di peramban pengguna dan dapat diubah siapa saja yang memasangnya.",
      "Nilai sengketa yang belum pernah diisi TIDAK disimpulkan nol. Membacanya nol akan menyimpulkan hakim tunggal padahal belum ada yang menyatakannya - yang keluar permintaan agar nilainya diisi dulu, bukan usulan.",
    ],
    operationalNotes: [
      "Susunan majelis TIDAK disalin ke basis data ALETA. SIPP sudah menyimpannya pada ref_sk_majelis_tetap dan ref_majelis_tetap, termasuk kompetensi tiap majelis - menyalinnya hanya melahirkan dua kebenaran yang lambat laun berselisih.",
      "Yang disimpan di ALETA hanya yang tidak punya tempat di SIPP: hari sidang tiap majelis dan kode panitera penggantinya, ditambah aturan hitungannya.",
      "Papan dimuat hanya ketika menunya dibuka. Hitungan gilirannya menyapu seluruh penunjukan juru sita tahun berjalan, dan itu tidak pantas dijalankan pada tiap perkara yang kebetulan dibuka.",
      "Penunjukan tingkat pertama disaring dengan tahapan 10. Tanpa saringan itu, penunjukan banding dan kasasi ikut terhitung sebagai giliran baru.",
    ],
    knownLimitations: [
      "Tombol Kerjakan belum menyala. Pengisian blangko SIPP menyusul setelah usulannya terbukti tenang.",
      "Urutan penunjukan juru sita yang lalu tidak dapat dipulihkan - enam rumus sudah diuji dan tidak satu pun menerka lebih baik daripada tebakan acak. Yang ditegakkan giliran ke depan, dan jumlahnya akan sama dengan sendirinya dalam setahun.",
      "Hakim tunggal untuk isbat terpadu masih diusulkan satu per satu. Pengerjaan satu blok sekaligus menyusul bersama tombol Kerjakan.",
      "Nomor SK penetapan dikosongkan sampai pengadilan menetapkan polanya.",
    ],
  },
  {
    version: "1.54.1",
    title: "ALETA v1.54.1 - Kepala Jadwal Sidang dan Status Perkara Dirapatkan",
    date: "2026-09-01",
    status: "Operasional",
    summary:
      "Bagian atas Jadwal Sidang dan Status Perkara memakan hampir separuh layar sebelum tabelnya terlihat. Dirapatkan 96 piksel - seluruh kendali, angka, dan keterangannya tetap ada, hanya ruangnya yang dipadatkan.",
    added: [],
    fixed: [],
    security: [
      "Tidak ada satu pun kendali, angka, atau keterangan yang dihilangkan. Jumlah tombol, kotak isian, label, dan lencana dihitung sebelum dan sesudah - sama persis. Merapatkan tampilan dengan cara membuang isinya akan menyembunyikan pekerjaan, bukan memadatkannya.",
    ],
    changed: [
      "Kepala kartu Jadwal Sidang dan Status Perkara dirapatkan: jarak dalamnya dikurangi, judulnya satu tingkat lebih kecil, keterangannya diperkecil - tetapi TIDAK dipotong.",
      "Lima angka ringkas pada Jadwal Sidang - Gugatan, Permohonan, Gugatan Sederhana, Jinayah, Seluruh sidang - dari kartu setinggi dua baris menjadi lencana satu baris. Kelimanya tetap ada dan tetap dapat diklik untuk menyaring.",
      "Dua baris kendali dirapatkan jaraknya, dan kotak isian memakai tinggi yang sama dengan tombol di sebelahnya.",
    ],
    operationalNotes: [
      "Diukur pada CSS hasil build: jarak dari tepi atas kartu sampai baris pertama tabel turun dari 368 menjadi 272 piksel - sekitar dua setengah baris tabel yang kembali terlihat tanpa menggulung.",
      "Jumlah tombol, kotak isian, label, dan lencana dihitung sebelum dan sesudah: sama persis. Yang berubah hanya ruangnya.",
    ],
    knownLimitations: [
      "Judul halaman di atas kartu - PENGHUBUNG E-COURT dan ALETA e-Court - tidak diubah. Ia dipakai bersama sekitar sepuluh panel portal lain, dan mengecilkannya di sini akan mengubah seluruhnya.",
    ],
  },
  {
    version: "1.54.0",
    title: "ALETA v1.54.0 - Jadwal Mediasi Punya Layarnya Sendiri, dan Ditunda Tidak Lagi Terbalik",
    date: "2026-09-01",
    status: "Operasional",
    summary:
      "Pertemuan mediasi tersimpan di tabel SIPP sendiri dan tidak pernah muncul di jadwal sidang, sehingga tidak terlihat sama sekali. Sekarang punya layarnya sendiri, lengkap dengan tenggang 30 hari PERMA 1/2016 yang tidak ada di mana pun pada SIPP. Ditambah satu kekeliruan yang membuat SETIAP pertemuan mediasi tertandai ditunda.",
    added: [
      "Menu Jadwal Mediasi pada ALETA e-Court, tepat setelah Jadwal Sidang. Terpisah karena yang ditanyakan memang berbeda: sidang menanyakan majelis dan relaas, mediasi menanyakan mediator dan sisa tenggang.",
      "Tiap pertemuan menampilkan jam mulai dan selesai, tempat, siapa yang hadir, mediator beserta status dan nomor SK penetapannya, tanggal penetapan mediator, tanggal laporan mediator, hasil mediasi, dan para pihak.",
      "Tenggang PERMA 1/2016 Pasal 24 dihitung dan ditampilkan: 30 hari sejak PENETAPAN MEDIATOR - bukan sejak pertemuan pertama, yang kerap jauh sesudahnya. Sisa harinya disebut, dan yang lewat ditandai merah.",
      "Tiga angka ringkas di kepala layar: jumlah pertemuan, berapa yang lewat tenggang, dan berapa yang ditunda.",
      "Nomor perkara pada jadwal mediasi dapat diklik untuk membuka Status Perkara-nya.",
    ],
    changed: [
      "Mediasi yang laporan mediatornya SUDAH masuk tidak lagi dihitung tenggangnya, berapa pun lamanya - menandainya merah hanya menyalakan peringatan atas pekerjaan yang sudah beres.",
      "Para pihak pada jadwal mediasi dibaca berkelompok - satu kueri untuk seluruh daftar, bukan satu per baris.",
    ],
    fixed: [
      "SETIAP pertemuan mediasi tertandai ditunda. Kolom ditunda dibaca dengan T berarti ditunda - terbalik. Di seluruh SIPP, dan di seluruh berkas ini, T singkatan dari TIDAK: aktif = T, ditunda = T, ket_temu = T. Akibatnya pertemuan yang berjalan normal tertandai ditunda, dan yang benar-benar ditunda terbaca biasa saja - dua kekeliruan sekaligus, keduanya persis terbalik dari kenyataan.",
      "Uji yang ada justru MENGUNCI kekeliruan itu: ia memeriksa bahwa pertemuan bertanda T ditandai ditunda. Ujinya ikut dibetulkan, bukan hanya kodenya.",
    ],
    security: [
      "Tanggal dan kata pencarian pada jadwal mediasi SELALU lewat parameter; hanya nama kolom yang disisipkan ke teks kueri, dan seluruhnya dari daftar tertutup pada sippSkemaService. Ada uji yang memastikan kata pencarian tidak pernah masuk teks kueri.",
      "Jadwal mediasi disambung lewat mediasi_id, bukan perkara_id. Salah kunci di sini pernah membuat seluruh bagian mediasi kosong - ada uji yang memeriksa bentuk sambungannya langsung, bukan hanya hasilnya.",
      "Kapabilitas jadwal mediasi SAMA dengan jadwal sidang. Keduanya keterangan perkara yang sedang berjalan, dan tidak ada alasan membedakan siapa yang boleh melihatnya - tidak ada pintu baru yang terbuka.",
      "Seluruh kueri jadwal mediasi berupa SELECT, dan ada uji yang menjaganya tetap begitu.",
    ],
    operationalNotes: [
      "Tenggang dihitung dari penetapan mediator. Perkara yang penetapannya belum terisi di SIPP menampilkan tenggat belum terbaca, bukan angka tebakan.",
      "Layar ini membaca SIPP langsung - tidak menunggu penarikan e-Court, dan tidak menyentuh e-Court sama sekali.",
    ],
    knownLimitations: [
      "Lama mediasi diambil dari view v_durasi_mediasi, yang pada sebagian perkara menghasilkan angka di luar akal. Yang dipakai menghitung tenggang adalah tanggal penetapan mediator, bukan angka itu.",
      "Daftar dibatasi 500 pertemuan sekali muat.",
    ],
  },
  {
    version: "1.53.0",
    title: "ALETA v1.53.0 - Pemeriksaan Putusan e-Court, Upaya Hukum Bernama Benar, dan Konseptor yang Ketemu",
    date: "2026-09-01",
    status: "Operasional",
    summary:
      "Putusan yang sudah dijatuhkan belum tentu terbit di e-Court, dan tiga hal dapat gagal berturut-turut tanpa satu pun peringatan. ALETA kini memeriksanya dan menyebutkannya di jadwal sidang, status perkara, kendali berkas, dan ekstensi SIPP. Nama kolom upaya hukum diperbaiki dari skema SIPP yang sebenarnya, verzet ditambahkan, dan konseptor akhirnya ketemu.",
    added: [
      "Pemeriksaan putusan e-Court. Perkara yang sudah diputus di SIPP tetapi tab Putusan e-Courtnya tidak memuat satu baris pun ditandai Menu Putusan E-Court Error - keadaan yang selama ini tidak memberi tanda apa pun dan baru ketahuan saat para pihak menanyakan salinannya.",
      "Kelengkapan salinan putusan diperiksa berjenjang: dokumen salinan sudah diunggah atau belum, siapa yang mengunggahnya, kapan, dan apakah Panitera sudah menandatanganinya secara elektronik - Sudah di-TTE oleh Panitera atau Belum TTE oleh Panitera, beserta tanggal pemeriksaannya.",
      "Bagian Putusan di e-Court pada Status Perkara, memuat seluruh keterangan itu.",
      "Penanda di kolom Putusan pada Jadwal Sidang - merah untuk baris yang tidak terbentuk, kuning untuk salinan yang belum lengkap.",
      "Daftar kerja Putusan yang belum terbit di e-Court pada Kendali Berkas, menyebutkan apa yang harus dikerjakan pada tiap perkara.",
      "Menu Putusan di e-Court pada ekstensi SIPP, terlipat seperti menu lainnya.",
      "Verzet (perlawanan) kini dibaca sebagai tingkat upaya hukum tersendiri, mendahului banding. Sebelumnya tidak dibaca sama sekali.",
      "Upaya hukum menampilkan status putusan, keadaan berkas, majelis hakim, dan panitera pengganti tiap tingkat.",
    ],
    changed: [
      "Nama kolom upaya hukum diambil dari skema SIPP, bukan ditebak dari pola. Tiap tingkat kini membawa daftar kolomnya sendiri.",
      "Tahap yang memang TIDAK DIKENAL pada satu tingkat tidak lagi ditampilkan sama sekali - verzet tidak mengenal memori maupun inzage, dan deretan tidak tersedia hanya menutupi tahap yang benar-benar kurang.",
      "Keadaan putusan e-Court dihitung sekali berkelompok untuk seluruh jadwal, dan hanya untuk perkara yang SIPP-nya sudah putus.",
    ],
    fixed: [
      "Konseptor putusan selalu kosong. Kolom penanda tahapan pada perkara_proses bernama proses_id, bukan tahapan_id - penyaringnya karena itu tidak pernah cocok, dan layarnya menerangkan bahwa tahapan putusan tidak tercatat padahal tercatat, hanya dicari di kolom yang keliru.",
      "Hampir seluruh tahap upaya hukum tertulis tidak tersedia pada perkara yang datanya justru lengkap. Nama kolom ditebak dari pola yang rapi - memori_banding, kontra_memori_kasasi, tanggal_kirim_berkas - sedangkan SIPP menamainya penerimaan_memori_banding, penerimaan_kontra_kasasi, pengiriman_berkas_kasasi.",
      "Nama pemohon upaya hukum tampil berisi tanda br dari SIPP - Kuasa dari Tergugat: <br>SRI ASTUTI<br> - karena teks bertanda HTML ditampilkan apa adanya.",
    ],
    security: [
      "ALETA TIDAK mengunggah maupun menandatangani putusan sendiri. Tanda tangan elektronik Panitera perbuatan hukum yang melekat pada orang dan sertifikatnya - ia harus dilakukan Panitera sendiri, dengan akunnya sendiri, di e-Court. Yang dikerjakan ALETA menjadikan pekerjaan itu terlihat dan tidak terlewat.",
      "Kekurangan dilaporkan BERJENJANG: yang lebih awal menutupi yang sesudahnya. Dokumen yang belum ada tidak pernah dilaporkan sebagai belum TTE - yang ditagih akan menjadi orang yang salah.",
      "Perkara yang belum pernah ditarik dari e-Court tidak dinyatakan lengkap MAUPUN error. Yang pertama menyembunyikan pekerjaan, yang kedua menuduh e-Court atas sesuatu yang belum pernah dilihat.",
      "Yang disimpan hasil BACAAN, bukan kesimpulan. Kesimpulan dibentuk saat ditanya dengan keadaan SIPP terbaru - menyimpannya berarti perkara yang salinannya sudah diunggah kemarin tetap tertandai bermasalah hari ini.",
      "Tab Putusan dipotong lebih dulu sebelum diurai. Kata Putusan muncul di banyak tempat pada halaman e-Court, dan mencarinya di seluruh halaman akan membaca nilai dari tab yang salah - ada ujinya.",
    ],
    operationalNotes: [
      "Keadaan putusan e-Court dibaca saat penarikan e-Court berjalan. Perkara yang belum pernah ditarik disebut belum ditarik, bukan bermasalah.",
      "Tabel aleta_bot_ecourt_putusan dibuat sendiri saat pertama kali dipakai. Tidak ada migrasi yang perlu dijalankan tangan.",
      "Ekstensi SIPP harus dimuat ulang di komputer petugas supaya menu barunya muncul: chrome://extensions, tekan muat ulang pada kartu ALETA E-Court.",
    ],
    knownLimitations: [
      "Penanda putusan hanya seakurat penarikan e-Court terakhir. Yang dikerjakan sesudahnya baru terbaca setelah penarikan berikutnya.",
      "Kolom tanggal kirim salinan putusan pada kasasi dan PK berada di tabel detil per pihak, belum dibaca - tahap itu tidak ditampilkan pada kedua tingkat tersebut.",
      "Verzet dibaca satu baris per perkara. Perlawanan berulang pada perkara yang sama belum diuji.",
    ],
  },
  {
    version: "1.52.0",
    title: "ALETA v1.52.0 - Ekstensi SIPP: Logo, Empat Menu Baru, dan Panel yang Tidak Lagi Menyeret",
    date: "2026-09-01",
    status: "Operasional",
    summary:
      "Ekstensi Chrome untuk SIPP diperiksa menyeluruh. Manifestnya tidak pernah punya ikon sama sekali, dua aturan gaya saling menimpa sehingga lencana dan judul bagian tampil keliru, dan pengamat halaman terpicu oleh sisipannya sendiri sehingga setiap halaman menjalankan beberapa putaran penyegaran yang tidak perlu. Ditambah empat menu baru yang membaca keadaan perkara selengkapnya.",
    added: [
      "Logo lembaga di ikon ekstensi (16, 32, 48, dan 128 piksel), di kepala popup, dan di kepala panel. Sebelumnya Chrome menampilkan ikon potongan teka-teki bawaan - ekstensi tanpa wajah, yang sukar dibedakan dari ekstensi lain di bilah peramban.",
      "Menu Tahapan dan ketepatan input: PMH, penunjukan PP, penunjukan juru sita, dan PHS beserta berapa hari jaraknya sampai diinput ke SIPP - angka yang selama ini menuntut membandingkan dua tanggal di dua halaman berbeda.",
      "Menu Kelengkapan berkas SIPP: gugatan/permohonan, relaas berdokumen, berita acara sidang, dan arsip.",
      "Menu Putusan dan upaya hukum: tanggal, status, sumber hukum, minutasi, BHT, serta banding/kasasi/PK beserta kemajuan tahapannya.",
      "Menu Penilaian SK 048/2024: unsur yang belum bernilai penuh untuk perkara yang sedang dibuka.",
      "Popup ekstensi mengikuti tema peramban. Popup yang selalu putih menyilaukan pada Chrome bertema gelap, dan itu terasa setiap kali saklarnya dibuka.",
    ],
    changed: [
      "Keempat menu baru TERLIPAT dan tidak berongkos sampai dibuka. Isinya baru diminta saat menunya ditekan pertama kali, lalu dipakai bersama keempatnya - satu permintaan untuk semuanya.",
      "Panel dilebarkan menjadi 340 piksel dengan sudut membulat, bilah gulir tipis, dan jarak antarbaris yang lebih lapang.",
      "Ketiga saklar dibaca sekali lalu disimpan di memori, bukan dibaca ulang dari penyimpanan ekstensi pada setiap penyegaran.",
      "Judul bagian dapat difokuskan papan ketik dengan garis fokus yang terlihat.",
    ],
    fixed: [
      "Manifest tidak memuat ikon sama sekali, sehingga Chrome memakai ikon bawaan.",
      "Kelas .aleta-tanda ditulis DUA KALI di berkas gaya yang sama. Aturan untuk penanda berlatar terang di dalam halaman SIPP menimpa aturan untuk lencana berlatar gelap di dalam panel, sehingga lencana sisa hari - lewat 4 hari, hari ini - kehilangan latar dan warnanya dan tampil sebagai teks polos yang nyaris tidak terbaca.",
      "Kelas .aleta-bagian-judul juga ditulis dua kali, dan aturan kedua memakai font: inherit - singkatan yang menyetel ulang ukuran huruf sekaligus. Typografi kecil yang dimaksud terhapus, hanya HURUF BESAR yang selamat, sehingga judul tampil pada 13 piksel dan patah dua baris dengan panah menggantung di tengah.",
      "Pengamat perubahan halaman ikut terpicu oleh sisipan ALETA sendiri: panel, penanda baris, dan sisipan jadwal semuanya ditulis ke halaman yang sama, sehingga tiap penggambaran menjadwalkan penyegaran berikutnya. Putarannya berhenti sendiri, tetapi tidak sebelum beberapa putaran penuh berjalan pada tiap halaman - lengkap dengan pembacaan penyimpanan dan penyapuan seluruh baris tabel.",
      "Wadah salinan sementara tidak punya gaya sama sekali, sehingga nomor register benar-benar terlukis sesaat di kaki halaman SIPP saat papan klip peramban tidak tersedia - dan itu menggeser tata letak halaman yang dijanjikan tidak diubah.",
      "Aturan .aleta-tanda-hijau ditulis dua kali dengan isi yang persis sama.",
      "Popup gagal seluruhnya bila dibuka di luar konteks ekstensi, karena chrome.storage disentuh tanpa penjagaan.",
      "Ekstensi yang diunduh DARI PORTAL akan gagal dipasang sama sekali. Portal menyajikan salinan tersendiri yang ditanam ke dalam kodenya, dan penyusunnya hanya menangani berkas teks - sedangkan manifest baru menunjuk ikon/*.png. Chrome menolak memasang ekstensi yang berkas rujukannya tidak ada, dan gagalnya baru ketahuan di komputer petugas. Ikon kini ikut ditanam sebagai base64 dan dikembalikan menjadi bita saat ZIP disusun.",
    ],
    security: [
      "Menu baru memakai kapabilitas yang SAMA dengan panel utama (panel). Tidak ada satu pun pintu baru yang terbuka bagi peran mana pun - yang tidak boleh melihat panel juga tidak dapat membuka menu ini.",
      "Tidak ada izin peramban baru. Ekstensi tetap hanya meminta storage dan satu host, dan tetap tidak pernah meminta izin tabs.",
      "Penggambaran dikerjakan dengan pengamat DILEPAS, bukan sekadar disaring. Penyaring bersandar pada pengenalan tiap simpul, dan simpul yang terlewat mengenali dirinya akan memulai putaran gambar-amati-gambar lagi.",
      "Kegagalan menu tidak disimpan: menu yang gagal sekali karena jaringan dapat dicoba lagi hanya dengan menutup dan membukanya.",
      "Uji baru menolak manifest yang menunjuk berkas apa pun - ikon, skrip, gaya - yang tidak ikut dikemas, dan memastikan ikon tertanam masih berupa PNG utuh, bukan bita yang rusak melewati utf8.",
    ],
    operationalNotes: [
      "Ekstensi harus dipasang ulang di komputer petugas: buka chrome://extensions, tekan tombol muat ulang pada kartu ALETA E-Court. Ikon barunya muncul setelah itu.",
      "Ikon dibuat dari logo lembaga pada portal, dipersegikan lalu diperkecil dengan perataan kotak supaya garis tipisnya tetap terbaca pada 16 piksel.",
      "Menu baru membaca keadaan perkara selengkapnya - puluhan kueri ke SIPP untuk satu perkara. Itulah sebabnya ia tidak pernah diambil otomatis.",
    ],
    knownLimitations: [
      "Pemilih .aleta-kepala masih ditulis dua kali, tetapi keduanya menambah hal yang berbeda - yang kedua hanya mengatur kursor geser - dan tidak ada satu pun sifat yang bertabrakan.",
      "Ikon 16 piksel memuat lambang lembaga yang rinci, sehingga pada ukuran itu ia terbaca sebagai bentuk emas, bukan lambang yang jelas. Pada 32 piksel ke atas lambangnya utuh.",
      "Menu baru belum tersedia pada halaman daftar perkara - hanya pada halaman detail perkara, karena hanya di sana ada satu nomor perkara yang pasti.",
    ],
  },
  {
    version: "1.51.0",
    title: "ALETA v1.51.0 - Panggilan yang Tidak Menuduh, Berkas yang Ketemu, dan Angka yang Jujur",
    date: "2026-08-31",
    status: "Operasional",
    summary:
      "Penanda belum dipanggil menyala pada perkara yang panggilannya justru sudah ada - permohonan berpihak tunggal, dan panggilan elektronik yang tidak menyebut kedudukan pihak. Kolom jurusita pada rincian relaas juga bergaris padahal namanya terbaca di tabel utama. Kartu rincian kelompok kini dapat diklik dan diurut. Upaya hukum disusun utuh per tingkat menurut urutan acaranya, dan konseptor putusan tidak lagi menghilang saat tidak terbaca.",
    added: [
      "Kartu Jenis perkara, Tahap sidang, Majelis, dan Ruang sidang dapat diklik: daftar perkara di bawahnya menyusut ke isi angka yang ditekan.",
      "Keempat kartu dapat diurut menurut jumlah (9-1) atau menurut nama (A-Z) lewat tombol kecil di sudutnya.",
      "Keempat penyaring berlaku bersamaan - majelis C di ruang 1 dapat ditanyakan sekaligus - dan yang sedang berlaku disebutkan di atas daftarnya beserta tombol melepasnya satu per satu.",
      "Nama jurusita pada rincian relaas yang berasal dari penugasan perkara ditandai (penugasan), bukan disamarkan sebagai pelaksana relaas.",
      "Upaya hukum disusun terpisah per tingkat - Banding, Kasasi, Peninjauan Kembali - masing-masing dengan seluruh tahapannya menurut urutan acara: permohonan, pemberitahuan permohonan, memori, pemberitahuan memori, kontra memori, pemberitahuan kontra memori, inzage, pemberitahuan inzage, pengiriman berkas, penerimaan berkas, putusan, penerimaan salinan, pemberitahuan putusan, dan pencabutan.",
      "Tiap tingkat upaya hukum juga menampilkan nomor perkara tingkat atas, siapa yang mengajukan, biaya, keterangan, dan amar putusannya dalam menu yang dapat dibuka.",
      "Tahap yang belum terjadi tetap disebut dan ditandai belum - itulah yang dicari saat berkas diperiksa, dan daftar yang hanya memuat yang sudah terisi tidak dapat menjawabnya.",
      "Konseptor putusan punya sumber cadangan: bila tahapan putusan tidak pernah dicatat pada perkara_proses, yang disebut pencatat pertama baris putusan menurut jejak audit - ditandai (pencatat).",
      "Bagian Berkas pada Status Perkara disusun seperti pada layar jadwal sidang: Gugatan/permohonan, Relaas panggilan, Berita Acara Sidang, Putusan, dan Lampiran lain - masing-masing dengan tombol unduhnya.",
      "Tiap relaas menyebut untuk sidang tanggal berapa ia dibuat, karena daftarnya kini memuat seluruh sidang perkara.",
      "Daftar Kendali Berkas dapat diurut menurut nomor perkara, jenis, banyaknya kekurangan, atau kapan disandingkan - dan barisnya dapat dibuka dengan papan ketik, tidak hanya tetikus.",
      "Lencana belum dipanggil menyebut SISI MANA yang belum dipanggil - penggugat atau tergugat - bukan hanya bahwa ada masalah.",
      "Pada perkara yang sudah putus, ketiadaan upaya hukum disebutkan apa adanya alih-alih bagiannya dihilangkan.",
    ],
    changed: [
      "Kewajiban memanggil kini disaring menurut pihak yang benar-benar ada pada perkaranya, bukan diandaikan selalu dua sisi.",
      "Relaas yang kedudukan pihaknya tidak terbaca tetap dihitung menutup satu sisi yang tersisa.",
      "Kolom jurusita pada rincian relaas jatuh ke penugasan jurusita perkara bila baris relaasnya sendiri tidak menyebut pelaksananya.",
      "Bagian Konseptor pada Keterangan putusan SELALU muncul, walau kosong - dan menerangkan sendiri mengapa kosong.",
      "Pada rincian panggilan, pihak yang hadir sidang sebelumnya ditulis tidak perlu dipanggil - bukan lagi belum dikirim bertanda merah.",
      "Amar putusan dan amar upaya hukum memakai rantai perapian yang sama dengan amar ikrar talak dan isi kesepakatan mediasi: butir daftar jadi penanda titik, tag blok jadi ganti baris, spasi berlebih dirapatkan.",
      "Tahapan upaya hukum diurut menurut urutan acara, bukan menurut tanggalnya: tanggal kosong akan melompat ke ujung, dan dua peristiwa bertanggal sama bertukar tempat tiap kali dibaca.",
    ],
    fixed: [
      "Perkara permohonan tertandai belum dipanggil padahal pemohonnya sudah dipanggil. Sebabnya sidang pertama selalu menuntut panggilan untuk dua sisi, sedangkan permohonan kerap hanya punya pemohon - termohon yang dituntut panggilannya memang tidak ada.",
      "Panggilan elektronik tidak terhitung sebagai panggilan. Kedudukan pihak dibaca lewat sambungan ke v_pihak_perkara, dan pada panggilan elektronik sambungan itu kerap kosong, sehingga relaas yang tanggalnya jelas terisi tidak menutup sisi mana pun. Contoh yang dilaporkan: 215/Pdt.P/2026/PA.Dgl.",
      "Kolom Jurusita pada rincian relaas bergaris walau namanya tampak di tabel utama. Ketiga sumber namanya bersandar pada jurusita_id di baris relaas, yang kosong pada panggilan elektronik.",
      "Bagian Konseptor tidak dapat ditemukan di Keterangan putusan. Sebabnya bagian itu disembunyikan saat datanya kosong, sehingga yang mencarinya menyimpulkan fiturnya tidak ada.",
      "Skor kesiapan sidang memakai jalur penilaian yang TERPISAH dari lencana panggilan, dan jalur itu sama sekali tidak mengenal aturan kehadiran. Akibatnya hampir setiap sidang lanjutan menyalakan penghambat berat belum dipanggil - padahal pihak yang hadir sidang sebelumnya memang tidak dipanggil lagi. Perbaikan lencana saja tidak menjangkaunya.",
      "Amar putusan tidak pernah dirapikan. Langkah perapian spasinya salah tulis - dua garis miring terbalik alih-alih satu - sehingga ia mencari garis miring terbalik diikuti huruf s, bukan spasi. Sisa spasi bekas tag HTML dibiarkan menumpuk dan penanda daftar hilang.",
      "Penjaga uji yang seharusnya menolak sisipan tak terduga pada kueri kendali berkas lulus HAMPA karena salah tulis yang sama: polanya mencari untaian yang tidak pernah ada, selalu menemukan nol, dan selalu lulus. Penjaganya kini benar-benar berjalan, tahan sisipan bersarang, dan jumlah temuannya ikut diperiksa supaya tidak dapat lulus hampa lagi.",
      "Relaas pada layar Status Perkara SELALU kosong. Layar itu membaca satu perkara utuh dan memanggil rincian tanpa nomor sidang, dan keadaan itu dijawab dengan daftar kosong - sehingga perkara yang relaasnya lengkap terbaca seolah belum pernah dipanggil sama sekali. Nomor sidang 0 kini berarti seluruh sidang perkara.",
      "Bagian Berkas pada Status Perkara mengalami masalah yang sama dengan layar jadwal sidang: hanya menghitung jumlah dokumen lalu menampilkan lampiran, sedangkan gugatan, relaas, dan BAS - tiga berkas yang paling dicari - tidak ada di sana.",
      "Judul daftar Kendali Berkas menyebut panjang daftar yang SUDAH dipotong seratus baris. Tiga ratus perkara yang perlu ditindaklanjuti terbaca sebagai seratus, dan pekerjaan yang tidak terlihat tidak pernah dikerjakan.",
      "Bagian Keterangan putusan hilang seluruhnya saat isinya tidak terbaca, sehingga perkara yang belum putus dan perkara yang sudah putus tetapi tidak terbaca tampak persis sama. Konseptor pun tinggal di dalam bagian itu, jadi perbaikan konseptor kemarin masih tertutup olehnya.",
      "Upaya hukum hanya menampilkan empat hal - jenis, nomor, tanggal permohonan, tanggal putusan - padahal berkas banding dinilai dari seluruh acaranya: memori, kontra memori, inzage, dan pengiriman berkas sama sekali tidak terbaca.",
    ],
    security: [
      "Pelonggaran di atas TIDAK membungkam perkara yang memang belum dipanggil: perkara dua pihak tanpa relaas tetap ditandai dua sisi belum dipanggil, dan bila daftar pihaknya sendiri tidak terbaca yang dipakai daftar menurut kehadiran apa adanya - lebih baik memperingatkan tanpa perlu daripada diam saat panggilan memang belum ada.",
      "Nama jurusita dari penugasan perkara selalu ditandai asalnya. Yang ditugaskan pada perkara belum tentu yang melaksanakan relaas ini, dan menyamarkan perbedaannya berarti menaruh nama orang pada pekerjaan yang mungkin bukan miliknya.",
      "Penyaring yang sedang berlaku disebutkan terang-terangan beserta jumlah yang tersaring. Daftar yang menyusut tanpa keterangan terbaca sebagai data yang hilang.",
      "Konseptor dari jejak audit selalu ditandai (pencatat). Yang menginput belum tentu yang mengonsep, dan menyamarkan perbedaannya berarti mencatatkan pekerjaan atas nama orang yang mungkin tidak mengerjakannya.",
      "Pembebasan dari kewajiban dipanggil hanya berlaku bila TIGA-TIGANYA terpenuhi: daftar sisi wajibnya diketahui, kedudukan pihaknya terbaca, dan sisinya memang tidak termasuk. Kedudukan yang tidak terbaca tidak pernah dibebaskan - menebak kedudukan lalu membebaskannya dari panggilan adalah cara paling sunyi membuat pihak benar-benar tidak terpanggil.",
      "Kueri kendali berkas kini benar-benar dipindai. Pemindainya membaca kata pertama tiap sisipan, sehingga sisipan bersarang pun terbaca, dan daftar yang dipakai daftar yang BOLEH - sisipan baru yang belum dipikirkan menggagalkan uji alih-alih lolos diam-diam.",
      "Angka pada Kendali Berkas diambil dari ringkasan, bukan dari panjang daftar yang dipotong, dan bila daftarnya memang terpotong hal itu dikatakan. Angka yang mengecilkan beban kerja lebih berbahaya daripada tidak ada angka.",
      "Bagian yang isinya tidak terbaca kini menerangkan sebabnya, tidak menghilang. Bagian yang hilang tidak dapat membedakan tidak ada dari tidak terbaca, dan keduanya menuntut tindakan yang berbeda.",
      "Pada upaya hukum, tahap yang KOLOMNYA tidak ada pada SIPP versi ini ditulis tidak tersedia - bukan belum. Menyamakan keduanya membuat petugas ditagih pekerjaan yang sebenarnya sudah selesai, hanya tidak terbaca.",
      "Baris upaya hukum yang tidak punya satu pun tanggal tidak ditampilkan: perkara yang tidak pernah dibanding tidak boleh terbaca seolah pernah.",
    ],
    operationalNotes: [
      "Kewajiban memanggil dibaca dari kehadiran sidang SEBELUMNYA: semua hadir berarti tidak ada yang wajib dipanggil, penggugat saja berarti tergugat dipanggil, tergugat saja berarti penggugat dipanggil, tidak ada yang hadir atau sidang pertama berarti keduanya. Daftar itu lalu disaring menurut pihak yang ada pada perkaranya.",
      "Angka pada kartu rincian dihitung dari seluruh kelompok, bukan dari yang sudah tersaring - supaya menyaring ke satu majelis tidak membuat majelis lain lenyap dari kartunya dan penyaringnya mustahil dilepas.",
      "Penanda panggilan alat bantu, bukan penetapan sah tidaknya panggilan. Keputusan itu tetap milik majelis.",
      "Nama kolom upaya hukum tidak dipatok mati - tiap versi SIPP menamainya sedikit berbeda. Yang tidak dikenali dilaporkan berikut daftar kolom yang benar-benar ada pada tabelnya, sehingga dapat dilengkapi tanpa membuka basis datanya.",
      "Konseptor dibaca dari tahapan_id 210 pada perkara_proses. Bila tahapan itu tidak dicatat, cadangannya pencatat pertama perkara_putusan menurut sys_audittrail.",
      "Keadaan panggilan seluruh sidang dihitung SEKALI per pemuatan - tiga kueri berkelompok untuk lima puluh sidang, bukan tiga kueri per sidang. Tanpa itu menyalakan skor akan menambah seratus lima puluh kueri sekali klik.",
    ],
    knownLimitations: [
      "Relaas tanpa kedudukan pihak dihitung satu relaas menutup satu sisi. Itu perkiraan, bukan pembacaan pasti: dua relaas elektronik untuk pihak yang sama akan terbaca menutup dua sisi.",
      "Nama jurusita dari penugasan perkara menyebut SELURUH jurusita yang ditugaskan bila lebih dari satu, karena baris relaasnya tidak menunjuk siapa di antaranya.",
      "Penyaring kartu dilepas otomatis saat kelompok alur berganti atau ditutup, sehingga tidak terbawa ke kelompok berikutnya.",
      "Tahap upaya hukum yang bertulis tidak tersedia menandakan kolomnya belum dikenali pada SIPP versi ini. Nama kolom yang sebenarnya tercantum pada menu Sebagian tahap tidak tersedia di bawah daftarnya - kirimkan agar dapat dilengkapi.",
      "Konseptor yang berasal dari jejak audit menyebut PENCATAT pertama baris putusan. Pada satker yang penginputannya dipusatkan, nama itu petugas input - bukan pengonsep putusannya.",
      "Kedudukan pihak pada penilaian kesiapan dibaca dari katanya - penggugat/pemohon lawan tergugat/termohon. Sebutan di luar kedua kelompok itu tidak dikenali, dan yang tidak dikenali selalu dianggap wajib dipanggil.",
      "Daftar relaas satu perkara dibatasi dua ratus baris. Perkara dengan sidang sangat banyak akan terpotong, dan yang ditampilkan sidang paling awal lebih dulu.",
      "Pengurutan daftar Kendali Berkas berlaku pada baris yang SUDAH diambil dari bot - seratus teratas menurut banyaknya kekurangan. Mengurut menurut nomor perkara tidak menarik perkara di luar seratus itu.",
    ],
  },
  {
    version: "1.50.0",
    title: "ALETA v1.50.0 - Tombol Skor yang Bekerja, Tundaan Bertanggal, dan Berkas SIPP yang Benar",
    date: "2026-08-30",
    status: "Operasional",
    summary:
      "Tombol Hitung skor sebelumnya hanya membalik tulisannya tanpa pernah meminta skornya - kolom Siap karena itu selalu bergaris. Ditambah tanggal dan alasan tundaan di tabel utama, kolom panitera dan juru sita digabung, susunan kolom ditata ulang, dan bagian Berkas SIPP kini memuat gugatan, relaas, dan BAS.",
    added: [
      "Tanggal sidang berikutnya dan alasan tundaan ditampilkan langsung di tabel utama - yang ditanya orang berikutnya selalu ditunda sampai kapan dan karena apa.",
      "Bagian Berkas SIPP dikelompokkan: Gugatan/permohonan, Relaas panggilan beserta resinya, Berita Acara Sidang per sidang, dan Lampiran lain.",
      "Tombol unduh surat gugatan/permohonan.",
      "Relaas dan BAS yang belum diunggah disebutkan apa adanya, bukan dihilangkan dari daftar.",
    ],
    changed: [
      "Kolom Panitera Sidang dan Jurusita digabung menjadi Petugas Sidang - keduanya jarang dibaca terpisah, dan lebarnya lebih berguna untuk nomor perkara.",
      "Jenis perkara pindah ke bawah nomor perkara; keduanya menjawab pertanyaan yang sama, dan memisahkannya jadi dua kolom memaksa mata bolak-balik.",
      "Susunan kolom mengikuti urutan baca: No, Siap, Jam, Perkara dan Para Pihak, Agenda, Majelis, Petugas Sidang, Ruang, Putusan.",
      "Ukuran huruf mengikuti kepentingan: jam dan nomor perkara paling besar, keterangan pendukung lebih kecil.",
    ],
    fixed: [
      "Kolom Siap selalu bergaris walau tombolnya sudah bertulis Skor: nyala. Sebabnya tombol itu hanya membalik penanda tanpa memuat ulang, sehingga skornya tidak pernah diminta ke bot. Sekarang menyalakannya langsung menghitung, dan tombolnya bertulis Menghitung selama berjalan.",
      "Bagian Berkas SIPP hanya menampilkan lampiran dari perkara_dokumen. Gugatan, relaas, dan BAS justru tidak ada di sana - gugatan pada kolom petitum perkara, relaas pada tabel relaas, BAS pada jadwal sidang.",
    ],
    security: [
      "Kolom Siap yang bergaris kini membedakan dua sebab pada keterangan tombolnya: skor belum diminta, atau sidang itu memang tidak dapat dinilai. Menyamakan keduanya membuat orang mengira fiturnya rusak - atau lebih buruk, mengira sidangnya bermasalah.",
      "Tombol skor dinonaktifkan selama pemuatan berjalan, supaya penekanan berulang tidak menembakkan penilaian berlapis ke SIPP.",
    ],
    operationalNotes: [
      "Kolom Siap adalah SKOR KESIAPAN SIDANG 0-100 beserta jumlah penghambatnya, dihitung dari SIPP dan arsip e-Court: relaas para pihak, kelengkapan berkas, identitas dan nomor kontak pihak, serta keterangan saksi. Warnanya hijau bila siap, kuning bila perlu perhatian, merah bila belum siap. Rincian penghambatnya muncul saat penunjuk diarahkan ke lencananya.",
      "Skor dimulai MATI supaya jadwalnya muncul seketika - penilaian menembakkan beberapa kueri per sidang.",
      "Skor ini alat bantu, bukan penetapan sah tidaknya panggilan. Keputusan itu tetap milik majelis.",
    ],
    knownLimitations: [
      "Tanggal tundaan diambil dari sidang berikutnya pada perkara yang sama. Perkara yang ditunda tetapi jadwal berikutnya belum ditetapkan hanya menampilkan alasannya.",
      "Penilaian kesiapan dibatasi 50 sidang sekali muat; yang melewati batas tidak dinilai dan kolom Siap-nya bergaris.",
    ],
  },
  {
    version: "1.49.0",
    title: "ALETA v1.49.0 - Unduh Arsip, Konseptor Putusan, dan Nama Penetapan yang Lebih Longgar",
    date: "2026-08-30",
    status: "Operasional",
    summary:
      "Berkas arsip dapat diunduh, konseptor putusan ditampilkan dengan nama orangnya, dan berkas penetapan tetap ketemu walau namanya ditulis panjang alih-alih disingkat.",
    added: [
      "Tombol unduh berkas arsip pada bagian Arsip berkas.",
      "Konseptor pada bagian Keterangan putusan - dibaca dari perkara_proses tahapan 210, lalu nama penggunanya diterjemahkan menjadi nama orangnya lewat sys_users.",
      "284 pemeriksaan pada uji tahapan - bertambah 36 untuk nama penetapan, arsip, dan konseptor.",
    ],
    changed: [
      "Nama dokumen penetapan dicocokkan lebih longgar: PMH maupun Penetapan Majelis Hakim, PPP maupun Penunjukan Panitera Pengganti, dan seterusnya. Sebelumnya hanya singkatannya yang ketemu, sehingga berkas yang namanya ditulis panjang tidak pernah muncul tombol unduhnya.",
    ],
    fixed: [],
    security: [
      "Nama dokumen yang tidak dikenali TIDAK dipaksakan masuk salah satu jenis - dikembalikan kosong. Menebaknya berarti menawarkan berkas yang keliru untuk diunduh.",
      "Bila kolom berkas arsip memang tidak ada pada SIPP versi ini, layar menyebutkannya - supaya jelas bahwa tidak adanya tombol unduh bukan karena berkasnya hilang.",
      "Nama pengguna yang tidak ditemukan di sys_users tetap ditampilkan apa adanya, bukan dikosongkan. Tahu bahwa konsepnya dikerjakan panmud4 lebih berguna daripada tidak tahu siapa pun.",
      "Jalur berkas arsip tidak pernah datang dari peramban: pemanggil menyebut nomor barisnya, dan jalurnya dicari di basis data.",
    ],
    operationalNotes: [
      "Konseptor dibaca dari tahapan_id 210 pada perkara_proses - tahapan putusan. Pengguna yang sama pada beberapa baris hanya disebut sekali.",
      "Nama pengguna disebutkan pada keterangan tombolnya, supaya dapat ditelusuri bila nama lengkapnya keliru di sys_users.",
    ],
    knownLimitations: [
      "Nama kolom berkas arsip masih dicari dari daftar calon - dokumen, file_arsip, arsip_dok, berkas, file, lampiran, scan. Bila tidak satu pun ada, tombol unduhnya tidak muncul dan sebabnya disebutkan.",
    ],
  },
  {
    version: "1.48.0",
    title: "ALETA v1.48.0 - Ikrar Talak, Status Putusan dan Sumber Hukum Diterjemahkan",
    date: "2026-08-30",
    status: "Operasional",
    summary:
      "Bagian Ikrar talak baru untuk perkara cerai talak - penetapan majelis, panitera pengganti, juru sita, sidang ikrar, tanggal ikrar, amar, status, dan penetapannya dapat diunduh. Status putusan dan sumber hukum kini diterjemahkan dari nomornya menjadi nama.",
    added: [
      "Bagian Ikrar talak: tanggal penetapan majelis hakim, panitera pengganti, dan juru sita beserta namanya; tanggal penetapan sidang ikrar talak; tanggal ikrar talak; nomor penetapan; amar penetapan yang dapat dibuka; dan tombol unduh berkas penetapannya.",
      "Status ikrar diterjemahkan: 1 Terlaksana, 2 Tidak Mempunyai Kekuatan Hukum, 3 Rujuk/Damai. Yang terlaksana hijau, yang kehilangan kekuatan hukum kuning.",
      "Penanda ikrar belum diucapkan - pada cerai talak, perceraiannya baru terjadi saat ikrar diucapkan.",
      "Sumber hukum pada bagian Keterangan putusan.",
      "248 pemeriksaan pada uji tahapan - bertambah 29 untuk putusan dan ikrar talak.",
    ],
    changed: [
      "Status putusan dibaca dari status_putusan_id lalu diterjemahkan lewat tabel status_putusan; teks pada perkara_putusan hanya dipakai bila tabel rujukannya tidak terbaca.",
      "Sumber hukum dibaca dari sumber_hukum_id lewat tabel sumber_hukum. Satu kolom dapat memuat beberapa nomor sekaligus - SIPP menyimpannya sebagai daftar centang - dan seluruhnya diterjemahkan.",
    ],
    fixed: [
      "Status putusan tertulis strip padahal datanya ada. Yang tersimpan nomornya, bukan namanya, dan tabel rujukannya belum dibaca.",
      "Keterangan (v_durasi_mediasi) pada baris Lama di bagian Mediasi dihapus - nama tabel bukan keterangan yang berguna bagi pembacanya.",
    ],
    security: [
      "Nomor status ikrar yang tidak dikenali TIDAK ditebak - dikembalikan kosong. Menebak status sebuah ikrar talak berarti menebak apakah perceraiannya sudah terjadi.",
      "Amar penetapan ikrar talak ditampilkan sebagai TEKS setelah tanda HTML-nya dibuang - isi dari basis data tidak boleh menjadi markup di halaman ini.",
      "Jalur berkas penetapan ikrar tidak pernah datang dari peramban: pemanggil menyebut nomor barisnya, dan jalurnya dicari di basis data.",
      "Tombol unduh hanya muncul bila berkasnya memang ada.",
    ],
    operationalNotes: [
      "Bagian Ikrar talak hanya muncul pada perkara yang memang punya barisnya - perkara selain cerai talak tidak menampilkannya.",
      "Sidang ikrar talak punya penetapan majelis, panitera pengganti, dan juru sitanya sendiri, terpisah dari penetapan perkara pokoknya.",
    ],
    knownLimitations: [
      "Nama kolom pada perkara_ikrar_talak masih dicari dari daftar calon. Bila belum ketemu, bagiannya menyebutkan kolom yang sebenarnya ada supaya dapat ditambahkan.",
      "Tenggang enam bulan untuk mengucapkan ikrar belum dihitung otomatis - yang ditampilkan baru status yang tercatat di SIPP.",
    ],
  },
  {
    version: "1.47.0",
    title: "ALETA v1.47.0 - Mediasi Bertanggal Benar, Hasilnya Diterjemahkan, Lama Perkara Bersih",
    date: "2026-08-30",
    status: "Operasional",
    summary:
      "Mediasi kini bermula pada tanggal penetapan mediator dan berakhir pada tanggal laporan mediator, lamanya dari v_durasi_mediasi, dan hasilnya diterjemahkan dari kode SIPP. Lama perkara yang ditampilkan besar kini yang BERSIH - sudah dipotong mediasi - dengan selisih mentahnya dalam kurung.",
    added: [
      "Arti kode hasil mediasi: Y1 Berhasil Kesepakatan Damai, Y2 Berhasil Dengan Pencabutan, S Berhasil Sebagian, D Tidak Dapat Dilaksanakan, selain itu Tidak Berhasil. Yang berhasil diberi warna hijau, yang tidak kuning.",
      "Isi kesepakatan perdamaian sebagai menu kecil yang diciutkan secara bawaan - dibuka hanya saat berkas perdamaian diperiksa.",
      "Catatan mediasi ditampilkan bila ada.",
      "219 pemeriksaan pada uji tahapan - bertambah 30 untuk hasil mediasi dan penjepit durasi.",
    ],
    changed: [
      "Mediasi MULAI pada tanggal penetapan penunjukan mediator dan SELESAI pada tanggal laporan mediator. Sebelum mediator ditetapkan belum ada mediasi; sesudah laporannya masuk mediasi itu sudah berakhir.",
      "Lama mediasi diambil dari view v_durasi_mediasi; selisih tanggal hanya dipakai bila view itu tidak ada.",
      "Kartu Lama perkara menampilkan lama BERSIH sebagai angka besar - hari pendaftaran ikut dihitung, lalu mediasi dipotong. Selisih mentah dari pendaftaran ke putusan disebutkan kecil dalam kurung, supaya masih dapat dicocokkan dengan tanggal pada berkas.",
    ],
    fixed: [
      "Tanggal mulai, selesai, laporan, dan lama mediasi selalu kosong. Nama kolomnya bukan yang ditebak: penetapan_penunjukan_mediator, tgl_laporan_mediator, dan isi_kesepakatan_perdamaian.",
      "Hasil mediasi ditampilkan sebagai kode mentah, bukan artinya.",
    ],
    security: [
      "Potongan lama mediasi DIJEPIT: tidak boleh melebihi lama perkaranya sendiri, dan sisanya tidak boleh kurang dari satu hari. View v_durasi_mediasi pada SIPP setempat kadang menghasilkan angka ribuan hari - tampaknya untuk perkara lama yang mediasinya tidak pernah ditutup, sehingga terhitung sampai hari ini. Memotongnya apa adanya membuat perkara yang berjalan setahun terbaca selesai dalam waktu negatif, dan bernilai 5 tanpa berhak.",
      "Bila potongannya dijepit, catatan penilaian menyebutkan angka aslinya - supaya ketahuan bahwa datanya yang perlu diperiksa, bukan hitungannya.",
      "Kode hasil mediasi yang tidak dikenali dibaca Tidak Berhasil. Menyebutnya berhasil padahal tidak akan membuat laporan mediasi tampak lebih baik daripada kenyataannya.",
      "Isi kesepakatan perdamaian ditampilkan sebagai TEKS setelah tanda HTML-nya dibuang - isi dari basis data tidak boleh menjadi markup di halaman ini.",
    ],
    operationalNotes: [
      "Angka besar pada kartu Lama perkara adalah yang menentukan nilai; angka dalam kurung yang dapat dicocokkan dengan tanggal pada berkas.",
      "Lama mediasi yang berasal dari view ditandai (v_durasi_mediasi) di layar, supaya bedanya dengan hitungan selisih tanggal terlihat.",
    ],
    knownLimitations: [
      "Perkara yang belum putus dihitung sampai hari ini, mengikuti cara notifikasi SIPP setempat.",
      "Nilai durasi_mediasi yang menyimpang tetap ditampilkan apa adanya pada bagian Mediasi - yang dijepit hanya potongannya pada penilaian. Bila angkanya janggal, datanya di SIPP yang perlu diperiksa.",
    ],
  },
  {
    version: "1.46.0",
    title: "ALETA v1.46.0 - Mediasi Lewat mediasi_id, Saksi Diajukan Siapa, Tabayun Sesuai SK",
    date: "2026-08-30",
    status: "Operasional",
    summary:
      "Jadwal mediasi terhubung lewat mediasi_id, bukan perkara_id - itulah sebabnya bagian mediasi selalu kosong. Saksi kini menyebutkan pihak yang menghadirkannya, dan tabayun dinilai persis SK III.3 dari delegasi_keluar.",
    added: [
      "Mediator sebagai catatan tersendiri dari perkara_mediator: nama, tanggal penetapan, nomor SK, status, dan apakah masih aktif.",
      "Jadwal pertemuan mediasi lengkap: tanggal, jam mulai sampai jam selesai, tempat, dan penanda bila pertemuannya ditunda.",
      "Nomor SK penetapan mediator ditampilkan pada bagian Mediasi.",
      "Nilai tabayun per delegasi ditampilkan di layar, beserta pelaksanaannya - kapan relaasnya dan oleh jurusita mana.",
      "189 pemeriksaan pada uji tahapan - bertambah 40 untuk mediasi dan tabayun.",
    ],
    changed: [
      "Hanya delegasi PANGGILAN (id_jenis_delegasi = 1) yang masuk penilaian SK III.3. Delegasi pemberitahuan ditandai di layar sebagai tidak dinilai - yang dinilai SK adalah kepatutan waktu pemanggilan.",
      "Tanggal sidang untuk tabayun diambil dari kolom tgl_sidang pada delegasi_keluar itu sendiri, bukan dicocokkan dengan jadwal sidang. Pasangannya memang sudah tercatat di sana.",
    ],
    fixed: [
      "Bagian Mediasi hanya menampilkan nama mediator; tanggal penetapan, jadwal, laporan, dan hasilnya kosong. Sebabnya salah kunci: jadwal pertemuan dicari dengan perkara_id, padahal perkara_jadwal_mediasi tidak punya kolom itu - ia menunjuk ke mediasi_id.",
      "Kolom Diajukan pada daftar saksi selalu berisi strip. Pihak yang menghadirkan saksi tersimpan pada perkara_pihak5, dan kolom itu belum dibaca.",
      "Nilai tabayun dihitung dari sidang terdekat sesudah permohonan - perkiraan yang dapat meleset. Sekarang dari tgl_sidang yang tercatat pada barisnya sendiri.",
    ],
    security: [
      "Nilai tabayun mengikuti SK III.3 apa adanya: 6 hari atau lebih sebelum sidang bernilai 0, lalu -1, -2, -3, dan -5 untuk 2 hari atau kurang. Sama persis dengan kueri notifikasi SIPP pengadilan ini.",
      "Pihak yang menghadirkan saksi dibaca dari tulisannya lebih dulu; angka jenis_pihak_id hanya dipakai bila tulisannya tidak ada. Tulisan lebih jelas daripada angka yang harus ditafsirkan.",
      "Uji memeriksa KUERINYA, bukan hanya hasilnya - salah kunci pada jadwal mediasi akan menggagalkan uji, bukan diam-diam menghasilkan daftar kosong.",
    ],
    operationalNotes: [
      "Mediasi tersebar di tiga tabel: perkara_mediasi (memberi mediasi_id), perkara_mediator (riwayat mediatornya), dan perkara_jadwal_mediasi (pertemuannya, lewat mediasi_id).",
      "Nama kolom pada delegasi_keluar berawalan tgl_, bukan tanggal_ - berbeda dari tabel perkara.",
      "Pertemuan mediasi bertanda ditunda = T berarti tidak jadi dilaksanakan.",
    ],
    knownLimitations: [
      "Tanggal mulai, selesai, dan laporan mediasi masih dicari dari daftar calon nama kolom; bila belum ketemu, bagiannya menyebutkan kolom yang sebenarnya ada.",
      "Delegasi masuk masih memakai daftar calon untuk nama kolomnya - kueri acuannya hanya tersedia untuk delegasi keluar.",
    ],
  },
  {
    version: "1.45.0",
    title: "ALETA v1.45.0 - Saksi dari perkara_pihak5, Delegasi Terpisah, Putusan dan Mediasi Lengkap",
    date: "2026-08-30",
    status: "Operasional",
    summary:
      "Saksi kini dibaca dari perkara_pihak5 - itulah sebabnya kolomnya selalu berbunyi tidak dikenali. Delegasi masuk dan tabayun dibaca dari tabelnya masing-masing, BAS dapat diunduh langsung, dan keterangan putusan, mediasi, arsip, serta biaya perkara ditampilkan lengkap.",
    added: [
      "Bagian Keterangan putusan: tanggal, status, verstek atau contradictoir, sumber hukum, faktor penyebab perceraian primer dan sekunder, qobla atau bada dukhul, status nusyuz, dan amar putusan yang dapat dibuka.",
      "Bagian Delegasi: delegasi masuk dari delegasi_masuk beserta lama penerimaannya, dan tabayun dari delegasi_keluar beserta jarak permohonan ke hari sidangnya.",
      "Bagian Arsip berkas: nomor box, tanggal input, petugas, dan keterangannya dari tabel arsip.",
      "Rincian biaya perkara - tiap transaksi beserta uraian dan tanggalnya, bukan hanya jumlah terpakai.",
      "Mediasi lengkap: jenis penetapan mediator, tanggal penetapan, jadwal pertemuan, tanggal laporan mediator, isi kesepakatan, dan tanggal kesepakatan perdamaian.",
      "Saksi menyebutkan isian mana yang belum diisi - jenis identitas, nomor identitas, atau nomor telepon.",
      "149 pemeriksaan pada uji tahapan - bertambah 32 untuk saksi, BAS, dan delegasi.",
    ],
    changed: [
      "Penilaian delegasi masuk memakai penerimaan paling LAMBAT - satu delegasi yang tertinggal tidak boleh tertutup oleh yang cepat.",
      "Penilaian tabayun memakai permohonan yang paling MEPET ke hari sidang, dibandingkan sidang terdekat sesudah permohonan itu.",
      "Ketentuan Jumat pada SK I.17 diterapkan: delegasi yang diunggah Jumat dihitung mulai Senin.",
    ],
    fixed: [
      "Bagian Saksi selalu berbunyi kolom tidak dikenali. Sebabnya salah tabel: SIPP menyimpan saksi sebagai pihak kelima di perkara_pihak5 yang menunjuk ke tabel pihak, bukan di perkara_keterangan_saksi. Ejaannya pun harus diikuti apa adanya - SIPP menulis indentitas, bukan identitas.",
      "Penanda BAS pada Perjalanan sidang tidak dapat ditekan. Sekarang tombol unduh yang benar-benar bekerja.",
      "Nilai BAS tidak dapat dihitung bila kolom waktu unggahnya tidak ada. Sekarang ada tidaknya BAS SELALU dinilai dari edoc_bas; kapan diunggahnya dicari dari kolomnya, lalu dari jejak audit.",
      "Kartu Biaya perkara hanya menyebut jumlah terpakai tanpa untuk apa.",
    ],
    security: [
      "Perkara cabut, gugur, dan digugurkan (status putusan 65, 67, 93) dikecualikan dari penilaian saksi. Perkara yang berakhir tanpa pembuktian memang tidak punya saksi, dan menghitungnya nol berarti menghukum pengadilan atas perkara yang dicabut pihaknya sendiri.",
      "Amar putusan ditampilkan sebagai TEKS, bukan dirender. SIPP menyimpannya bertanda HTML, dan isi dari basis data tidak boleh menjadi markup di halaman ini.",
      "Delegasi yang diterima lebih cepat dari hari mulai perhitungan bernilai nol hari, bukan negatif - menerima lebih cepat bukan pelanggaran.",
      "Isi kesepakatan mediasi dan amar putusan dibawa utuh; memotongnya menghilangkan bagian yang mungkin justru sedang dicari.",
    ],
    operationalNotes: [
      "Tiga isian saksi yang dihitung mengikuti cara pengadilan ini menilainya sendiri: jenis identitas, nomor identitas, dan nomor telepon. 3 dari 3 bernilai 5, 2 dari 3 bernilai 3, 1 dari 3 bernilai 2, 0 dari 3 bernilai 1, tanpa saksi bernilai 0.",
      "Bila suatu kolom belum dikenali, layar menyebutkan daftar kolom yang sebenarnya ada pada tabel itu - nama yang benar langsung terlihat tanpa membuka Navicat.",
      "Tabayun yang dimohonkan kurang dari 6 hari sebelum sidang ditandai di layar; SK III.3 menguranginya.",
    ],
    knownLimitations: [
      "Nama kolom pada delegasi_masuk, delegasi_keluar, arsip, dan perkara_mediasi masih dicari dari daftar calon. Bila belum ketemu, layar menyebutkan kolom yang ada supaya dapat ditambahkan.",
      "Sidang yang dipasangkan dengan permohonan tabayun adalah sidang terdekat SESUDAH permohonan - bila jadwalnya berubah setelah permohonan, pasangannya dapat meleset.",
      "Amar putusan ditampilkan setelah tanda HTML-nya dibuang, sehingga penomoran dan barisnya dapat berbeda dari tampilan SIPP.",
    ],
  },
  {
    version: "1.44.0",
    title: "ALETA v1.44.0 - Nilai Relaas dari SIPP, Jejak Audit sebagai Jalan Terakhir",
    date: "2026-08-30",
    status: "Operasional",
    summary:
      "Nilai relaas kini dicari melalui empat sumber berurutan - tabel penilaian relaas SIPP, tanggal inputnya, kolom pada relaas itu sendiri, lalu jejak audit sys_audittrail. Mediasi dinilai dari perkara_mediasi dan v_durasi_mediasi. Tiap nilai menyebutkan dari mana ia berasal.",
    added: [
      "Layanan pembaca sys_audittrail, dipakai sebagai jalan terakhir mencari kapan sesuatu diinput bila kolom resminya memang tidak ada.",
      "Nilai relaas dari tabel perkara_penilaian_relaas dipakai apa adanya bila SIPP sudah menghitungnya - ia catatan pengadilan, bukan tafsiran ALETA.",
      "Keterangan sumber pada kartu penilaian SK: dari mana nilai relaas berasal, berapa hari mediasi yang dipotong, dan apakah ada penetapan kembali.",
      "Mediasi dinilai terisi bila hasilnya sudah dicatat pada perkara_mediasi, atau bila v_durasi_mediasi menghasilkan lama mediasi.",
      "117 pemeriksaan pada uji tahapan - bertambah 22 untuk nilai relaas dan jejak audit.",
    ],
    changed: [
      "Unsur relaas tidak lagi bergantung pada satu kolom. Bentuk tabel penilaian relaas dikenali sendiri saat berjalan, dan jalan terbaik yang tersedia yang dipakai.",
    ],
    fixed: [],
    security: [
      "Nilai yang datang dari catatan pengadilan dan nilai yang ditelusuri dari jejak audit TIDAK boleh tampak sama. Yang dari jejak audit diberi keterangan tersendiri di layar.",
      "Nilai dari SIPP dijepit ke rentang yang sah (-5 sampai 5), supaya angka menyimpang pada satu baris tidak merusak nilai unsurnya.",
      "Jejak audit ditolak dibaca tanpa satu pun penyaring - kuerinya akan menyapu jutaan baris, dan jawabannya pun tidak berarti apa-apa.",
      "Jejak audit dipakai HANYA bila kolom resminya tidak ada. Tabelnya besar, isinya dapat dipangkas pengelola, dan satu baris dapat disentuh berkali-kali.",
      "Yang dianggap penginputan catatan PERTAMA pada jejak audit. Perubahan sesudahnya koreksi, dan koreksi bukan penginputan.",
    ],
    operationalNotes: [
      "Urutan sumber nilai relaas: kolom nilai pada perkara_penilaian_relaas, tanggal input pada tabel itu, tanggal input pada perkara_pelaksanaan_relaas, lalu jejak audit.",
      "Perkara yang benar-benar tidak punya relaas tetap dinilai -5 sesuai SK - itu terbaca, bukan tidak diketahui.",
      "Rapor mediasi dianggap terisi bila HASILNYA dicatat. Baris yang terbentuk saat mediator ditetapkan belum berarti rapornya diisi.",
    ],
    knownLimitations: [
      "Bila tabel penilaian relaas tidak menyebut sidang mana yang dinilai, relaas ke-n dipasangkan dengan sidang ke-n secara berurutan. Itu perkiraan.",
      "Pembacaan lewat jejak audit dilakukan satu kueri per relaas, sehingga lebih lambat daripada membaca kolom. Ia memang jalan terakhir.",
      "View v_mediasi, v_mediator, dan v_mediator_n belum dipakai.",
      "Kelonggaran izin atasan PNS/TNI/POLRI tetap tidak diterapkan otomatis.",
    ],
  },
  {
    version: "1.43.0",
    title: "ALETA v1.43.0 - Penetapan Pertama yang Dinilai, Mediasi Dipotong, Sumber Data Diluruskan",
    date: "2026-08-30",
    status: "Operasional",
    summary:
      "Penetapan yang dinilai kini penetapan PERTAMA, bukan penetapan kembali - itulah yang membuat PMH terbaca terlambat 98 hari dengan jeda input negatif. Lama mediasi dipotong dari waktu putus, dan sumber data publikasi, arsip, ghaib, petitum, serta relaas diluruskan ke tabel yang benar.",
    added: [
      "Keterangan penetapan kembali di bawah tabel tahapan: petugas mana yang diganti, kapan, dan oleh siapa - dibaca dari aktif, tanggal_tidak_aktif, dan diperbaharui_tanggal pada tabel petugas.",
      "Lama mediasi dari view v_durasi_mediasi, dipotong dari waktu penyelesaian perkara.",
      "Kelengkapan dokumen relaas dan resi pos dihitung tersendiri dari doc_relaas dan doc_resi.",
      "E-Dokumen petitum dinilai dari kolom petitum_dok pada tabel perkara.",
      "95 pemeriksaan pada uji tahapan - bertambah 21 untuk penetapan pertama dan perhitungan waktu putus.",
    ],
    changed: [
      "Waktu putus kini menghitung hari pendaftaran: perkara yang didaftar dan diputus pada hari yang sama berjalan SATU hari, bukan nol. Ini mengikuti cara notifikasi SIPP pengadilan ini menghitung sejak lama, sehingga kedua angkanya dapat disandingkan.",
      "Publikasi putusan dibaca dari dirput_dokumen (link_dirput dan updated_date), bukan dari perkara_putusan. Tanpa link_dirput, putusannya belum tayang.",
      "Penginputan arsip dibaca dari tabel arsip, bukan perkara_arsip.",
      "Perkara ghaib dikenali dari perkara_pihak2.ghaib lebih dulu - yang ghaib adalah pihaknya, dan di situlah SIPP menandainya.",
    ],
    fixed: [
      "PMH terbaca terlambat 98 hari dan jeda inputnya negatif 65 hari. Sebabnya yang dibaca baris penetapan TERAKHIR, padahal itu penetapan kembali karena majelis berganti. PMH aslinya terbit pada hari pendaftaran. Sekarang yang dibaca baris pertama, dan penetapan kembali dilaporkan tersendiri tanpa mengurangi nilai - hakim mutasi bukan kesalahan siapa-siapa.",
      "Penunjukan PP, juru sita, dan PHS ikut terbaca minus 98 hari karena acuannya PMH yang keliru itu. Ikut lurus dengan sendirinya.",
      "Selisih pada baris Pendaftaran perkara tertulis strip. Pendaftaran adalah titik nol, jadi selisihnya 0 hari - bukan tidak diketahui.",
    ],
    security: [
      "Penetapan kembali TIDAK mengurangi nilai apa pun. Ia hanya menjelaskan mengapa ada lebih dari satu penetapan, dan mengapa yang dinilai yang pertama.",
      "Lama mediasi dipotong karena selama mediasi perkaranya memang berhenti - bukan karena majelis lambat, melainkan karena PERMA 1/2016 memerintahkan begitu. Menghitungnya sebagai keterlambatan berarti menghukum majelis atas kepatuhan.",
      "Tanpa link_dirput, tanggal apa pun pada baris dirput_dokumen tidak dianggap sebagai bukti putusan sudah tayang.",
    ],
    operationalNotes: [
      "Perbandingan dengan notifikasi SIPP setempat: angkanya sama pada hampir seluruh unsur, dengan dua selisih yang disengaja. SK menyebut minutasi hari 1-2 bernilai 5 dan publikasi hari ke-2 bernilai 5; notifikasi lama hanya memberi 5 pada hari ke-1. Yang diikuti SK, sebab di situ SK menyebut angkanya dengan tegas.",
      "Akibatnya perkara yang diminutasi atau diunggah pada hari kedua bernilai 5 di ALETA dan 3 pada notifikasi. Selisih itu disengaja, bukan salah hitung.",
      "Ambang waktu putus sama persis dengan notifikasi: 90 hari nilai 5, 120 hari nilai 3, 150 hari nilai 1.",
      "Bila suatu keterangan tidak ditemukan pada tabel yang biasa, sys_audittrail dapat dipakai menelusuri kapan dan oleh siapa data itu diubah.",
    ],
    knownLimitations: [
      "Jumlah relaas yang seharusnya dihitung dari baris relaas yang tercatat, bukan dari biaya panggilan yang dikeluarkan - menghitungnya dari biaya menuntut penafsiran tarif yang berbeda tiap radius.",
      "Tabel perkara_penilaian_relaas belum dipakai sebagai sumber nilai; yang dinilai masih kelengkapan dokumennya.",
      "View v_mediasi, v_mediator, dan v_mediator_n belum dipakai - yang dibaca perkara_mediasi dan v_durasi_mediasi.",
      "Kelonggaran izin atasan PNS/TNI/POLRI tetap tidak diterapkan otomatis: lama menunggu izin tidak tercatat di SIPP.",
    ],
  },
  {
    version: "1.42.0",
    title: "ALETA v1.42.0 - Mafqud Dikenali dari Tundaan Sidang, Mediasi Menyebutkan Kolomnya",
    date: "2026-08-30",
    status: "Operasional",
    summary:
      "Perkara mafqud kini dikenali sendiri dari tundaan sidangnya - SIPP memang tidak punya kolom mafqud, dan SK pun menyebut pencirinya, bukan kolomnya. Bagian Mediasi yang kolomnya belum dikenali kini menyebutkan nama kolom yang sebenarnya ada, langsung di layar.",
    added: [
      "Penanda mafqud (terindikasi) pada deretan penanda perkara, dihitung dari tundaan sidang 3 kali 90 hari sesuai SK 048/2024 Tabel 2 nomor 1 angka 3.",
      "Perkara mafqud otomatis mendapat kelonggaran 270 hari pada penilaian waktu putus. Kelonggaran ini mengalahkan ghaib (120 hari) bila keduanya terindikasi.",
      "Jumlah pertemuan mediasi ditampilkan bila SIPP mencatatnya.",
      "Tabel perkara_data_dukung_mediasi ikut dikenali skrip pemeriksa kolom.",
      "74 pemeriksaan pada uji tahapan - bertambah 20 untuk mafqud dan mediasi.",
    ],
    changed: [
      "Daftar calon nama kolom mediasi diperluas mengikuti kebiasaan penamaan SIPP yang terlihat pada tabel lain: satu keterangan kerap punya _id, _kode atau _nama, dan _text sekaligus. Yang dicari yang _text atau _nama - itulah yang dapat dibaca tanpa tabel induknya.",
    ],
    fixed: [
      "Bagian Mediasi hanya berbunyi kolom tidak dikenali tanpa memberi jalan keluar. Sekarang ia menyebutkan nama kolom yang SEBENARNYA ada pada perkara_mediasi, langsung di layar - nama yang benar terlihat tanpa perlu membuka Navicat atau menjalankan skrip apa pun.",
      "Perkara mafqud sebelumnya tidak pernah dikenali, sehingga perkara yang berhak atas kelonggaran 270 hari dinilai seolah lambat.",
    ],
    security: [
      "Penandanya berbunyi terindikasi, bukan dipastikan - mengikuti kata yang dipakai SK sendiri. Tundaan panjang berulang memang ciri mafqud, tetapi bisa juga sebab lain: menunggu putusan perkara lain, pihak sakit berkepanjangan, berkas dari luar negeri.",
      "Karena itu jarak tiap tundaannya ikut dibawa dan ditampilkan. Yang memutuskan tetap panitera yang membaca berkasnya, bukan program yang menghitung jarak tanggal.",
      "Ambang 90 hari dan jumlah 3 kali ditulis sebagai tetapan bernama, bukan angka yang ditanam di dalam kode, supaya dapat ditelusuri kembali ke SK-nya.",
    ],
    operationalNotes: [
      "Tundaan tepat 90 hari ikut terhitung - SK menulis 3 x 90 hari, bukan lebih dari 90 hari.",
      "Sidang berkala yang jaraknya sebulan tidak tertandai mafqud, walau sidangnya banyak.",
      "Bila bagian Mediasi masih menyebut kolom belum dikenali, salin nama yang sesuai dari daftar yang ditampilkannya ke services/sippSkemaService.js lalu nyalakan ulang bot.",
    ],
    knownLimitations: [
      "Mafqud dikenali dari pencirinya, bukan dari catatan resmi. Perkara yang sidangnya tertunda panjang karena sebab lain akan ikut tertandai - karena itu penandanya berbunyi terindikasi dan tundaannya dirinci.",
      "Kelonggaran izin atasan PNS/TNI/POLRI tetap tidak diterapkan otomatis: lama menunggu izin tidak tercatat di SIPP, dan menebaknya berarti memberi keringanan yang mungkin tidak berhak. Yang muncul hanya penandanya.",
      "Perkara ghaib yang diumumkan lewat media massa (kelonggaran 180 hari) belum dibedakan dari ghaib biasa (120 hari).",
    ],
  },
  {
    version: "1.41.0",
    title: "ALETA v1.41.0 - Tahapan dari perkara_penetapan, Penanda Perkara, dan Layar yang Dapat Diciutkan",
    date: "2026-08-30",
    status: "Operasional",
    summary:
      "Tanggal PMH, penunjukan panitera pengganti, penunjukan juru sita, dan PHS kini dibaca dari tabel yang benar - perkara_penetapan - beserta tanggal penginputan dan berkas pindaiannya dari perkara_dokumen_penetapan. Ditambah penanda perkara ghaib dan pihak PNS/TNI/POLRI, keterangan mediasi lengkap, daftar saksi beserta hubungannya, dan tiap bagian layar dapat diciutkan.",
    added: [
      "Penanda perkara ghaib, dikenali dari tiga arah: penanda pada v_perkara, jarak PHS ke sidang pertama 120 hari atau lebih (penciri yang dipakai SK sendiri), dan kata ghaib pada keterangan pihak. Sumbernya disebutkan pada keterangan penandanya.",
      "Penanda pihak berstatus PNS/ASN, TNI, POLRI, BUMN/BUMD, dan aparat peradilan - dibaca dari pekerjaan pihak pada perkara_pihak1 sampai perkara_pihak5.",
      "Bagian Mediasi: mediator, tanggal mulai dan selesai, hasil, lama berlangsung, dan penanda bila lewat 30 hari menurut PERMA 1/2016 Pasal 24.",
      "Bagian Saksi: nama, pihak yang mengajukan, hubungan atau keterangan, dan kelengkapan identitasnya.",
      "Tombol unduh berkas pindaian tiap penetapan - PMH, PPP, PJS, PHS - pada tabel tahapan.",
      "Tiap bagian layar dapat diciutkan lewat tombol panah pada judulnya. Keadaan ciut diingat per peramban.",
      "Penilaian kelengkapan dan penilaian SK diciutkan secara bawaan - keduanya panjang dan tidak dibaca tiap kali.",
    ],
    changed: [
      "Perkara ghaib kini otomatis mendapat kelonggaran 120 hari pada penilaian waktu putus, sesuai SK 048/2024 Tabel 2 nomor 1.",
      "Deretan penanda di kepala layar dipersingkat: e-Court, keadaan putusan, ghaib, instansi, kumulasi, dan kuasa - masing-masing satu penanda kecil, bukan kartu selebar seperempat layar.",
    ],
    fixed: [
      "Tahapan PMH, penunjukan PP, penunjukan juru sita, dan PHS selalu berbunyi kolom tidak ada. Sebabnya keliru tabel: keempatnya ada di perkara_penetapan, bukan di perkara. Sekarang dibaca dari tabel yang benar, dan yang dipakai baris penetapan TERAKHIR - perkara yang majelisnya berganti punya lebih dari satu baris.",
      "Tanggal penginputan tiap penetapan juga tidak terbaca. Yang mencatatnya bukan tabel penetapan melainkan perkara_dokumen_penetapan, dibedakan lewat nama_dokumen (PMH, PPP, PJS, PHS). Yang dipakai unggahan PERTAMA tiap jenis - unggahan susulan bertahun kemudian tidak boleh menghapus fakta bahwa aslinya sudah diinput tepat waktu.",
      "Tabel tahapan dan upaya hukum tampil sebagai kartu melar di kepala layar. Sebabnya keduanya tersisip DI DALAM baris penanda yang memakai flex-wrap. Sekarang berada di tempatnya sendiri.",
    ],
    security: [
      "Hubungan saksi dengan para pihak ditampilkan UTUH dari keterangannya, tidak diurai jadi kategori. Menguraikannya berarti menebak, dan menebak hubungan keluarga pada berkas perkara tidak termaafkan.",
      "Waktu menunggu izin atasan PNS/TNI/POLRI tidak ditebak. Yang dapat dipastikan hanya bahwa izin itu DIPERLUKAN; memberikan kelonggaran atas lama yang tidak tercatat berarti memberi keringanan yang mungkin tidak berhak.",
      "Penanda ghaib menyebutkan dari mana ia dikenali, supaya panitera dapat menilai sendiri apakah penandanya masuk akal - bukan menerimanya begitu saja.",
      "Jalur berkas penetapan tidak pernah datang dari peramban: pemanggil menyebut nomor barisnya, dan jalurnya dicari di basis data.",
      "Tombol unduh hanya muncul untuk penetapan yang berkasnya memang ada.",
    ],
    operationalNotes: [
      "Nama kolom pada bagian ini bukan tebakan - dibaca langsung dari struktur SIPP PA Donggala.",
      "Keadaan ciut disimpan di peramban masing-masing, sehingga tiap orang mendapatkan susunan yang ia tinggalkan.",
      "Penanda instansi dicari dari TULISAN pekerjaan pihak, bukan dari kode pekerjaan - kodenya berbeda antar satker, tulisannya seragam.",
      "51 skrip verifikasi, seluruhnya lulus.",
    ],
    knownLimitations: [
      "Perkara mafqud belum dikenali otomatis - pencirinya menurut SK adalah tundaan sidang 3 kali 90 hari, dan itu belum dihitung.",
      "Kelonggaran izin atasan tidak diterapkan otomatis pada penilaian; yang muncul hanya penandanya.",
      "Kolom hasil mediasi, mediator, dan tanggalnya masih dicari dari daftar calon nama - bila tidak ketemu, bagian Mediasi menyebutkan sebabnya. Jalankan scripts/sipp-periksa-kolom.js untuk melihat nama sebenarnya.",
      "Penanda ghaib dari jarak PHS ke sidang pertama mengikuti penciri SK; perkara yang sidang pertamanya jauh karena sebab lain akan ikut tertandai.",
    ],
  },
  {
    version: "1.40.0",
    title: "ALETA v1.40.0 - Nama Akun e-Court, Isi Otomatis, dan Keadaan Sesi yang Jujur",
    date: "2026-08-30",
    status: "Operasional",
    summary:
      "Layar pengaturan kini menyebutkan nama akun e-Court yang sedang tersambung, membedakan sesi yang sudah diperiksa dari yang belum, dan dapat menyimpan surel serta sandi tersandi supaya login cukup mengisi captcha. Tombol Jalankan Sekarang tidak lagi membekukan layar.",
    added: [
      "Nama pengguna e-Court yang sedang tersambung ditampilkan pada kartu Login e-Court dan pada tiap baris akun.",
      "Simpanan surel dan sandi per akun, tersandi AES-256-GCM. Setelah tersimpan, formulir login terisi sendiri dan yang tersisa hanya captcha.",
      "Tombol Simpan sandi, Ubah sandi, dan Lupakan sandi pada tiap baris akun.",
      "Tombol Periksa semua sesi: memeriksa seluruh akun sekaligus, berurutan di dalam bot.",
      "Penanda isi otomatis pada akun yang sandinya tersimpan.",
      "51 skrip verifikasi - yang baru menguji 58 perilaku simpanan sandi dan pembacaan keadaan sesi.",
    ],
    changed: [
      "Keadaan sesi kini bernilai LIMA, bukan dua: berlaku, kedaluwarsa, menunggu penegasan, belum diperiksa, dan belum pernah login.",
      "Hasil pemeriksaan sesi disimpan selama tiga menit beserta umurnya, sehingga membuka layar pengaturan tidak lagi menyalakan Chrome tiap kali.",
    ],
    fixed: [
      "Layar menulis Sesi tersimpan padahal sesinya sudah keluar atau kedaluwarsa. Sebabnya: yang diperiksa hanya ADA TIDAKNYA folder profil, dan folder itu tetap ada lama setelah sesinya mati. Sekarang folder yang ada tanpa pemeriksaan ditulis belum diperiksa, bukan tersimpan.",
      "Pemeriksaan sesi terasa membeku beberapa puluh detik. Sebabnya menunggu jaringan sepi (networkidle2) padahal yang ditanya hanya alamat pendaratannya. Diganti domcontentloaded dengan batas 20 detik.",
      "Tombol Jalankan Sekarang pada Penarikan Berkala membekukan layar sampai putaran selesai - hitungan menit - lalu sambungannya diputus perantara. Sekarang permintaannya dijawab seketika dan kemajuannya disegarkan sendiri.",
      "Menekan Periksa Sesi dua kali menyalakan dua Chrome pada folder profil yang sama; Chrome menolak profil yang sedang dipakai, dan kegagalan itu terbaca sebagai sesi mati padahal sesinya hidup. Sekarang permintaan kedua menunggu hasil yang sama.",
      "Menyimpan sandi dengan slot kosong atau salah ketik diam-diam jatuh ke slot bawaan - sandi satu akun tersimpan ke akun lain. Menulis kini menuntut slot yang tegas.",
    ],
    security: [
      "Sandi TIDAK PERNAH keluar dari server. Ia dibuka hanya di dalam proses bot, tepat sebelum diketikkan ke formulir e-Court. Tidak ada rute yang mengembalikannya - bahkan dalam bentuk tersandi - dan uji verifikasi memeriksa bahwa tidak ada rute yang memanggil pembukanya.",
      "Berkas simpanan dan kuncinya diletakkan di luar folder aplikasi, izin 0600. Paket installer dan pencadangan kode mengambil isi folder aplikasi; sandi pengadilan tidak boleh ikut terbawa.",
      "AES-256-GCM, bukan CBC: ia sekaligus memeriksa keutuhan. Berkas yang disunting DITOLAK saat dibuka, bukan menghasilkan sandi keliru yang dikirim ke e-Court berkali-kali sampai akunnya terkunci.",
      "Captcha tetap diisi manusia. Itu tidak berubah, dan memang tidak boleh berubah.",
      "Yang dicatat pada log keamanan hanyalah bahwa sandi satu slot diperbarui dan oleh siapa - tidak pernah isinya.",
      "Formulir yang sudah terisi sendiri tidak diisi ulang saat captcha dikirim: mengetik di atas isian yang ada menghasilkan sandi sambungan yang pasti ditolak, dan percobaan berulang mengunci akun.",
      "Menyimpan atau menghapus sandi hanya untuk Super Admin dan Admin.",
    ],
    operationalNotes: [
      "Nama akun dibaca dari halaman e-Court saat login berhasil atau saat Periksa Sesi dijalankan. Sebelum pernah diperiksa, namanya belum tampil.",
      "Menyimpan ulang dengan kotak sandi dibiarkan kosong hanya mengubah surelnya - sandi lama tetap dipakai.",
      "Pemeriksaan seluruh akun dijalankan berurutan, bukan serentak: beberapa Chrome sekaligus pada server pengadilan menghabiskan memori dan justru membuat semuanya gagal.",
      "Berkas simpanan ada di folder profil sesi e-Court, sejajar dengan folder akunnya.",
    ],
    knownLimitations: [
      "Kunci penyandian ada di mesin yang sama dengan berkasnya - memang harus, sebab bot membukanya tanpa manusia. Yang dilindungi adalah salinan yang terbawa keluar: cadangan, paket installer, folder yang tersalin. Yang TIDAK dilindungi adalah orang yang sudah menguasai server itu sendiri.",
      "Izin berkas 0600 tidak berlaku di Windows. Keadaan simpanan menyebutkan hal itu supaya tidak disangka terlindungi padahal tidak.",
      "Nama pengguna dibaca dari tampilan halaman e-Court. Bila tampilan itu berubah, namanya dapat gagal terbaca - dan yang dikembalikan kosong, bukan tebakan.",
      "Hasil pemeriksaan yang disimpan berumur tiga menit. Sesi yang mati dalam rentang itu masih tampil berlaku sampai pemeriksaan berikutnya.",
    ],
  },
  {
    version: "1.39.0",
    title: "ALETA v1.39.0 - Tahapan Perkara, Unsur Penginputan, dan Pencarian Luas",
    date: "2026-08-30",
    status: "Operasional",
    summary:
      "Status Perkara kini menyusuri perkara dari pendaftaran sampai berkekuatan hukum tetap: PMH, penunjukan panitera pengganti dan juru sita, PHS, beserta kapan masing-masing diinput ke SIPP. Unsur SK yang menilai ketepatan waktu penginputan karenanya dapat dinilai. Pencarian menerima nama pihak, jenis perkara, keadaan perkara, tahun, alur, dan nama petugas.",
    added: [
      "Tabel Tahapan perkara: pendaftaran, PMH, penunjukan PP, penunjukan juru sita, dan PHS - lengkap dengan tanggal, selisih hari dari acuannya, tanggal penginputan, dan jeda inputnya.",
      "Bagian Upaya hukum: banding, kasasi, dan peninjauan kembali beserta nomor perkara tingkat atas, tanggal permohonan, dan tanggal putusannya.",
      "Unsur SK yang menilai ketepatan waktu penginputan kini dinilai bila kolomnya ada: pendaftaran, PMH, PP, juru sita, PHS, relaas, sisa panjar, arsip, unggah putusan, unggah BAS, pemberitahuan putusan, mediasi, dan kelengkapan identitas saksi.",
      "Tombol unduh naskah putusan, naskah anonim, dan tiap dokumen SIPP pada layar Status Perkara.",
      "Pencarian dengan nama pihak, jenis perkara, keadaan perkara (berjalan, putus, belum minutasi, sudah minutasi, belum BHT, sudah BHT, cabut, gugur), tahun pendaftaran, alur perkara, dan nama petugas - hakim, panitera, atau juru sita.",
      "Saringan dapat dipakai TANPA nomor perkara, sehingga pertanyaan seperti cerai gugat 2025 yang belum putus dapat dijawab langsung.",
      "Skrip scripts/sipp-periksa-kolom.js untuk melihat kolom SIPP mana yang dikenali dan mana yang belum.",
      "50 skrip verifikasi - yang baru menguji 50 perilaku pengenalan kolom dan penyusunan tahapan.",
    ],
    changed: [
      "Kotak pencarian menerima nama pihak, tidak hanya nomor perkara. Angka saja tetap dicocokkan persis pada nomor urut.",
    ],
    fixed: [
      "Akhiran baris pada routes/internalGatewayRoutes.js diseragamkan kembali ke CRLF - penyuntingan sebelumnya menyisipkan 69 baris ber-LF ke berkas yang seluruhnya CRLF.",
    ],
    security: [
      "Nama kolom SIPP TIDAK ditebak. Kolomnya dicari lebih dulu dari information_schema, dan hanya nama yang cocok dengan daftar calon di dalam kode yang dipakai. Nama kolom tidak pernah datang dari peramban.",
      "Kolom yang tidak ada tidak ikut masuk SELECT. Menyebutnya membuat seluruh kuerinya gagal, dan tahapan yang sebenarnya terbaca ikut hilang.",
      "Kolom yang TIDAK ADA dibedakan tegas dari data yang KOSONG. Yang pertama dilaporkan sebagai belum tersambung; yang kedua dinilai nol sesuai SK. Menyamarkan keduanya akan menuduh pengadilan lalai atas pekerjaan yang sudah selesai.",
      "Nilai pencarian - nama pihak, jenis perkara, tahun - selalu masuk sebagai parameter. Kunci keadaan perkara dicocokkan dengan daftar tertutup, tidak disambung apa adanya ke teks kueri.",
      "Pencarian tanpa satu pun syarat mengembalikan kosong, bukan seluruh register. Daftar acak sebanyak batas akan disangka hasil pencarian.",
      "Nama pihak dan nama petugas dicari lewat EXISTS, bukan JOIN - perkara dengan lima tergugat tidak muncul lima kali.",
      "Tombol unduh hanya muncul untuk berkas yang memang ada.",
    ],
    operationalNotes: [
      "Jalankan docker exec aleta-bot node scripts/sipp-periksa-kolom.js untuk melihat kolom mana yang dikenali. Tambahkan --semua untuk melihat seluruh nama kolom tiap tabel.",
      "Bila ada kolom yang belum dikenali, nama sebenarnya ditambahkan ke daftar calon pada services/sippSkemaService.js lalu bot dinyalakan ulang.",
      "Skema SIPP dibaca sekali lalu disimpan dalam memori - skema tidak berubah saat aplikasi berjalan.",
      "Selisih hari pada tabel tahapan mengikuti acuan SK: PMH dihitung dari pendaftaran; PP, juru sita, dan PHS dihitung dari PMH.",
    ],
    knownLimitations: [
      "Unsur yang kolomnya tidak ditemukan pada SIPP setempat tetap dilaporkan belum tersambung. Daftar calon nama kolom sudah panjang, tetapi tidak dapat memuat nama yang belum pernah dilihat - itulah gunanya skrip pemeriksa kolom.",
      "Tabel pemberitahuan putusan, mediasi, arsip, dan delegasi hanya dibaca bila tabelnya memang ada pada SIPP setempat.",
      "Pencarian nama pihak memakai LIKE dengan tanda persen di kedua sisi, sehingga tidak memakai indeks. Pada register yang sangat besar pencarian nama akan terasa lebih lambat daripada pencarian nomor.",
      "Sinkronisasi tidak dinilai pada layar perkara - SK menilainya atas satuan kerja dalam sepekan, bukan atas satu perkara.",
    ],
  },
  {
    version: "1.38.0",
    title: "ALETA v1.38.0 - Penyandingan SIPP dengan Arsip e-Court",
    date: "2026-08-30",
    status: "Operasional",
    summary:
      "SIPP dibaca untuk mengetahui berkas apa yang seharusnya ada pada tiap perkara, lalu disandingkan dengan arsip e-Court ALETA. Hasilnya daftar perkara yang perlu ditindaklanjuti. Dapat dijalankan dari portal maupun dari PuTTY, dan tetap berjalan setelah PuTTY ditutup.",
    added: [
      "Panel Penyandingan dengan SIPP pada menu Kendali Berkas: jumlah perkara lengkap, kurang, dan belum diperiksa.",
      "Daftar perkara yang perlu ditindaklanjuti, dapat dibuka rinciannya dan dilanjutkan ke Status Perkara.",
      "Tombol menjalankan penyandingan dari portal, dengan saringan rentang tanggal daftar, batas jumlah perkara, dan hanya perkara e-Court.",
      "Batang kemajuan yang berdetak selama penyandingan berjalan, termasuk yang dimulai dari PuTTY.",
      "Skrip aleta-kendali-berkas.sh untuk menjalankannya dari server - memakai setsid dan nohup sehingga tidak ikut mati saat PuTTY ditutup.",
      "Riwayat lima penyandingan terakhir beserta sumber, jumlah perkara, dan kekurangannya.",
      "49 skrip verifikasi - yang baru menguji 41 perilaku penyandingan.",
    ],
    changed: [],
    fixed: [],
    security: [
      "Perkara yang SIPP-nya gagal dibaca TIDAK dinyatakan lengkap, melainkan ditandai belum diperiksa dan tetap muncul di daftar kerja. Menyatakannya lengkap akan menghapusnya dari daftar, dan berkas yang benar-benar hilang tidak akan pernah ditarik.",
      "Seluruh kueri SIPP adalah SELECT. Nomor perkara dan tanggal selalu masuk sebagai parameter; yang disisipkan ke teks kueri hanya deretan tanda tanya dan angka batas yang sudah dibulatkan dan dijepit - dan uji verifikasinya menyebut daftar sisipan yang BOLEH, sehingga sisipan baru menggagalkan uji alih-alih lolos diam-diam.",
      "Memulai penyandingan hanya untuk Super Admin dan Admin - satu jalan menyapu ribuan perkara dan menolak jalan lain selama berlangsung. Melihat hasilnya tetap terbuka bagi petugas perkara.",
      "Dua penyandingan sekaligus ditolak, diperiksa dari waktu DETAKNYA. Jalan yang mati mendadak ditandai terputus setelah 10 menit tanpa detak, sehingga tidak memblokir selamanya.",
      "Ditekan Ctrl+C atau container disetop: kelompok yang sedang berjalan diselesaikan dulu lalu berhenti rapi, dan barisnya ditandai dibatalkan alih-alih ditinggalkan menggantung.",
      "Permintaan memulai dijawab seketika, tidak menahan sambungan HTTP selama berjam-jam. Sambungan sepanjang itu pasti diputus perantara di tengah jalan, dan pemakainya tidak akan pernah tahu pekerjaannya selesai atau mati.",
    ],
    operationalNotes: [
      "Penyandingan ini TIDAK membuka satu pun halaman e-Court, jadi tidak memerlukan sesi login dan tidak dapat kehabisan sesi. Penarikan berkasnya sendiri tetap lewat menu Penarikan.",
      "Urutan yang lazim: jalankan penyandingan dulu untuk tahu apa yang kurang, baru tarik berkasnya.",
      "Dari server: bash aleta-kendali-berkas.sh, dengan pilihan --sejak, --sampai, --maks, dan --hanya-ecourt.",
      "Kemajuan penyandingan dari PuTTY tetap terlihat di portal, dan sebaliknya - keduanya menulis ke tabel jalan yang sama.",
      "Perkara dibaca berkelompok 200 sekali kueri, bukan satu kueri per perkara.",
      "Batas atas sekali jalan 5000 perkara.",
    ],
    knownLimitations: [
      "Yang dihitung kurang mencakup dua hal berbeda: berkas e-Court yang belum ditarik ALETA, dan dokumen yang SIPP sendiri belum punya - BAS, relaas, naskah putusan. Keduanya dibedakan penandanya, tetapi ikut dalam satu angka jumlah kurang.",
      "Jumlah relaas yang seharusnya dibaca dari baris relaas SIPP, bukan dari biaya panggilan yang dikeluarkan.",
      "Belum ada penjadwalan otomatis - penyandingan dijalankan saat diminta.",
    ],
  },
  {
    version: "1.37.0",
    title: "ALETA v1.37.0 - Penilaian SIPP Sesuai SK Dirjen Badilag 048/2024",
    date: "2026-08-30",
    status: "Operasional",
    summary:
      "Kriteria SK Dirjen Badilag Nomor 048/DJA/SK.KP3.4.3/IV/2024 kini terpasang apa adanya - 29 unsur, bobot, skala poin, rumus, predikat, dan kode warnanya. Rubrik ALETA yang lama tetap ada sebagai pelengkap, dipisah dan diberi nama supaya tidak tertukar dengan nilai resmi.",
    added: [
      "Penilaian SIPP menurut SK 048/2024 pada layar Status Perkara, dikelompokkan per aspek: kinerja 50%, input data 40%, kelengkapan dokumen 10%, dan kesesuaian sebagai pengurang 10%.",
      "Seluruh skala poin SK: waktu putus, minutasi, publikasi putusan, 17 unsur input data, 5 unsur kelengkapan dokumen, dan 5 unsur kesesuaian.",
      "Pengecualian perkara khusus pada waktu putus - ghaib 120 hari, ghaib dengan pengumuman 180 hari, mafqud 270 hari, dan izin atasan PNS/POLRI/TNI paling banyak 6 bulan.",
      "Rumus nilai satuan kerja, predikat bintang satu sampai lima, kode warna hijau/kuning/merah, dan kategori satker I sampai V.",
      "Daftar unsur yang belum dapat dinilai beserta sebabnya, dapat dibuka di layar.",
      "48 skrip verifikasi - yang baru menguji 179 angka SK satu per satu.",
    ],
    changed: [
      "Rubrik ALETA lama diberi nama tegas sebagai pelengkap dan tetap dipakai untuk hal yang tidak diatur SK: kepatutan panggilan menurut SK KMA 363/2022, kelengkapan nomor kontak pihak, dan kesiapan berkas sidang.",
    ],
    fixed: [],
    security: [
      "Nilai SK dan rubrik ALETA sengaja TIDAK dijumlahkan. Satu angka gabungan tidak dapat dipertanggungjawabkan kepada siapa pun - bukan nilai Badilag, bukan pula ukuran ALETA.",
      "Unsur yang sumber datanya belum dibaca ALETA tidak dinilai nol, melainkan disebutkan sebagai belum tersambung. Menilainya nol akan menuduh pengadilan lalai atas pekerjaan yang mungkin sudah dikerjakan tepat waktu.",
      "Data yang memang kosong di SIPP tetap dinilai nol sesuai SK - yang tidak terbaca berbeda dari yang tidak diisi.",
      "Layar tidak menampilkan persentase maupun predikat untuk satu perkara, sebab nilai akhir SK dihitung atas seluruh perkara putus satu satuan kerja.",
    ],
    operationalNotes: [
      "Tiap unsur mencantumkan dasarnya sampai nomor tabel SK, dapat dilihat dengan mengarahkan penunjuk ke nama unsurnya.",
      "Poin yang tampil poin satu perkara menurut Tabel 2 SK, yaitu 5, 3, 2, 1, atau 0; pada unsur pengurang 0 sampai -5.",
      "Nilai satuan kerja tersedia pada mesin penilaian dan siap dipakai bila laporan seluruh perkara putus nanti dibuat.",
    ],
    knownLimitations: [
      "Unsur yang menilai KETEPATAN WAKTU penginputan - tanggal input pendaftaran, PMH, PP, juru sita, PHS, relaas, sisa panjar, arsip, unggah putusan, unggah BAS - belum dapat dinilai karena kolom tanggal inputnya belum dibaca ALETA. Ketiadaan datanya sudah terbaca dan tetap dinilai.",
      "Data mediasi, pemberitahuan putusan, dan delegasi belum tersambung ke SIPP.",
      "Sinkronisasi dinilai atas satuan kerja dalam sepekan, bukan atas satu perkara, sehingga tidak muncul pada layar perkara.",
      "SK menulis Kategori I 5000 ke atas sekaligus Kategori II 2501-5000 - keduanya memuat angka 5000. Yang dipakai penyebutan yang tegas, yaitu 5000 masuk Kategori I.",
      "Satu bulan pada waktu putus dihitung 30 hari.",
    ],
  },
  {
    version: "1.36.0",
    title: "ALETA v1.36.0 - Penanda Panggilan dan Ringkasan Jadwal per Kelompok",
    date: "2026-08-30",
    status: "Operasional",
    summary:
      "Perkara yang belum dipanggil dan surat panggilan yang retur kini ditandai di samping nomor perkara. Rincian kelompok pada Jadwal Sidang bertambah empat ringkasan - jenis perkara, tahap sidang, majelis, dan ruang sidang - dan tiap perkaranya dapat diklik untuk membuka Status Perkara.",
    added: [
      "Penanda BELUM DIPANGGIL (merah gelap) dan RETUR (merah terang) di samping nomor perkara pada tabel utama dan pada rincian kelompok.",
      "Penanda retur pada tabel relaas panggilan di rincian sidang.",
      "Ringkasan jenis perkara pada rincian kelompok - hanya jenis yang ada yang disebutkan.",
      "Ringkasan tahap sidang: berapa sidang pertama, berapa lanjutan, dan berapa yang beragenda putusan.",
      "Ringkasan jumlah perkara tiap majelis dan tiap ruang sidang.",
      "Kartu perkara pada rincian kelompok dapat diklik untuk membuka Status Perkara nomor itu.",
    ],
    changed: [],
    fixed: [],
    security: [
      "Kewajiban memanggil dibaca dari KEHADIRAN pada sidang sebelumnya, bukan dari ada tidaknya relaas. Pihak yang hadir sudah diberitahu hari sidang berikutnya di ruang sidang dan tidak perlu dipanggil lagi - menandainya belum dipanggil akan menyalakan peringatan pada hampir seluruh jadwal, dan peringatan yang selalu menyala berhenti dibaca.",
      "Belum dipanggil dan retur dibedakan warnanya. Tindak lanjutnya berbeda: yang satu menagih jurusita, yang lain menelusuri alamat.",
      "Penanda tidak muncul sama sekali bila panggilannya aman.",
    ],
    operationalNotes: [
      "Kewajiban memanggil: sebelumnya semua hadir berarti tidak ada yang wajib dipanggil; penggugat saja berarti tergugat wajib; tergugat saja berarti penggugat wajib; tidak ada yang hadir atau sidang pertama berarti keduanya wajib.",
      "Retur dibaca dari status pos SIPP - 1 berhasil, 2 dikembalikan.",
      "Penanda hanya terisi bila kehadiran dan relaasnya sudah diisi di SIPP.",
      "Ringkasan kelompok menghitung sidang pada rentang tanggal yang sedang ditampilkan.",
    ],
    knownLimitations: [
      "Agenda putusan dikenali dari kata putus pada teks agendanya. Agenda yang ditulis dengan istilah lain tidak ikut terhitung.",
      "Kewajiban memanggil dihitung per sisi - penggugat atau tergugat - bukan per orang. Perkara dengan beberapa tergugat yang sebagian sudah dipanggil terbaca sudah dipanggil.",
    ],
  },
  {
    version: "1.35.0",
    title: "ALETA v1.35.0 - Status Perkara, Sidebar Penuh, dan Jadwal Lebih Cepat",
    date: "2026-08-30",
    status: "Operasional",
    summary:
      "Menu baru Status Perkara: masukkan nomor perkara - cukup angkanya - dan seluruh keadaan perkara ditampilkan dari pendaftaran sampai akta cerai, lengkap dengan lama perkara berjalan dan nilai kelengkapannya. Sidebar ALETA e-Court kini sama penuh dengan sidebar utama, dan pemuatan jadwal sidang dipercepat.",
    added: [
      "Menu Status Perkara pada sidebar ALETA e-Court.",
      "Pencarian perkara menerima angka saja - 419 mencari nomor urut 419 pada seluruh jenis dan tahun, lalu menampilkan daftarnya untuk dipilih.",
      "Lama perkara berjalan dalam hari dan bulan. Perkara yang sudah diputus dihitung sampai putusannya; yang masih berjalan sampai hari ini.",
      "Nilai kelengkapan perkara: tujuh butir dengan bobot yang dapat diatur - lama penyelesaian, majelis dan panitera, identitas pihak, kepatutan panggilan, BAS, naskah putusan, dan ketepatan minutasi.",
      "Biaya perkara: panjar masuk, terpakai, dan sisanya, dengan peringatan bila pengeluaran melebihi panjar.",
      "Riwayat penundaan sidang beserta alasannya.",
      "Perjalanan sidang dari awal sampai terakhir, dengan penanda sidang berikutnya.",
      "Sidebar e-Court: tombol kembali ke Portal, pengalih ciutkan sidebar, dan kotak pencarian menu - sama dengan sidebar utama ALETA.",
    ],
    changed: [
      "Pemuatan jadwal sidang dipercepat: delapan subkueri berkorelasi per baris diganti tiga kueri berkelompok. Untuk jadwal 127 perkara, itu berarti lebih dari seribu kali eksekusi subkueri menjadi tiga kueri.",
      "Penilaian kesiapan pada Jadwal Sidang dimulai MATI. Penilaian itu membaca SIPP dan arsip e-Court untuk tiap sidang; petugas yang hanya ingin melihat jam sidang tidak perlu menunggunya.",
    ],
    fixed: [],
    security: [
      "Pencarian dengan angka saja mencocokkan NOMOR URUT, bukan potongan teks. Tanpa itu, 419 ikut mencocoki perkara 1419 dan 4190.",
      "Pencarian mengembalikan daftar untuk dipilih, tidak langsung membuka yang pertama. Nomor urut yang sama dapat dipakai beberapa perkara, dan membuka salah satunya berarti menampilkan perkara keliru tanpa ada yang menyadarinya.",
      "Butir penilaian yang datanya belum ada bernilai NOL, bukan dilewati. Perkara tanpa data bernilai rendah - dan memang itulah keadaannya.",
      "Status Perkara memakai kemampuan panel yang sudah diatur per peran.",
    ],
    operationalNotes: [
      "Nilai kelengkapan adalah rubrik ALETA, BUKAN nilai resmi SK Penilaian SIPP. Berkas SK yang tersedia berupa hasil pindaian - halaman kriterianya gambar, bukan teks - sehingga bobot dan ambangnya tidak dapat dibaca dan tidak disalin ke aplikasi.",
      "Satu-satunya angka yang terbaca dari SK itu adalah skala lama penyelesaian: tiga bulan atau kurang bernilai penuh, lima bulan atau lebih bernilai nol. Itulah bawaan butir lama penyelesaian.",
      "Seluruh bobot dan ambang dapat diubah, sehingga dapat disesuaikan dengan SK yang berlaku.",
      "Tombol Hitung skor pada Jadwal Sidang menyalakan penilaian kesiapan bila diperlukan.",
    ],
    knownLimitations: [
      "Nilai kelengkapan belum sama dengan penilaian resmi SIPP sampai bobot dan ambangnya diisi menurut SK yang berlaku.",
      "Pencarian menampilkan paling banyak 25 perkara.",
      "Biaya perkara dibaca dari catatan biaya SIPP; perkara yang biayanya belum dicatat menampilkan nol.",
    ],
  },
  {
    version: "1.34.0",
    title: "ALETA v1.34.0 - Retensi Arsip Berdasarkan Selesainya Perkara",
    date: "2026-08-30",
    status: "Operasional",
    summary:
      "Masa simpan arsip kini dihitung sejak perkaranya berkekuatan hukum tetap, bukan sejak berkasnya diunduh. Sebelumnya perkara yang masih berjalan bertahun-tahun akan kehilangan berkas awalnya - justru berkas yang dibaca majelis saat memutus. Bila SIPP tidak terbaca, tidak ada yang dihapus.",
    added: [
      "Penanda berkas yang dihapus karena masa simpan, terpisah dari berkas yang hilang. Keduanya menuntut tindakan berbeda: yang hilang ditarik ulang, yang ini justru tidak boleh ditarik ulang.",
      "Lencana dihapus (masa simpan) pada Kendali Berkas.",
      "Pemeriksaan otomatis untuk logika retensi - tujuh belas pemeriksaan yang menjalankan penyaringannya sungguhan.",
    ],
    changed: [
      "Masa simpan dihitung dari tanggal berkekuatan hukum tetap; bila BHT belum terisi, dari tanggal minutasi.",
      "Keterangan pada layar pengaturan menyebutkan dasar hitungannya dan apa yang terjadi bila SIPP tidak terbaca.",
      "Pemeriksaan keutuhan arsip melewati berkas yang sengaja dihapus karena masa simpan.",
    ],
    fixed: [
      "Masa simpan dihitung dari tanggal unduh berkas. Perkara yang masih berjalan tiga tahun akan kehilangan berkas awalnya, padahal justru berkas itulah yang dibaca majelis saat memutus.",
      "Berkas yang dihapus karena masa simpan terbaca sebagai berkas hilang oleh pemeriksaan keutuhan. Bila dibuang catatannya, perkaranya menjadi tidak lengkap lalu ditarik ulang dari e-Court - persis kebalikan dari yang dimaksud retensi.",
      "Kendali Berkas tetap melaporkan berkas ada untuk berkas yang sudah dihapus, sehingga tombol Unduh gagal tanpa keterangan. Jalur pada catatan dokumen kini ikut dikosongkan.",
    ],
    security: [
      "GAGAL-TERTUTUP: keadaan akhir perkara dibaca dari SIPP, dan bila SIPP tidak terbaca TIDAK ADA yang dihapus. Penghapusan berkas perkara tidak dapat ditarik kembali, dan menariknya ulang dari e-Court belum tentu masih mungkin.",
      "Pembersihan yang tidak menghapus apa pun menyebutkan sebabnya, tidak dilaporkan sebagai berhasil.",
      "Syarat lama tetap berlaku seluruhnya: hanya dokumen yang sudah diverifikasi majelis dan sudah diberitahukan ke pihak yang dihapus berkasnya.",
      "Catatan dokumen tidak pernah dihapus - dokumen apa pernah ada, kapan diunggah, siapa yang memverifikasi, dan kapan diberitahukan tetap tersimpan.",
    ],
    operationalNotes: [
      "Masa simpan bawaan tetap 0, yang berarti tidak menghapus apa pun. Angkanya ditetapkan pimpinan di menu Integrasi e-Court.",
      "Melihat lebih dulu adalah perilaku bawaan: layar menampilkan berapa berkas dan berapa megabita yang akan dihapus sebelum ada yang dihapus.",
      "Perkara yang belum diputus, atau yang putusannya belum berkekuatan hukum tetap dan belum diminutasi, tidak pernah masuk daftar hapus.",
      "Arsip resmi tetap ada di e-Court dan pada berkas fisik pengadilan.",
    ],
    knownLimitations: [
      "Perkara yang catatan putusannya belum diisi di SIPP tidak akan pernah masuk daftar hapus, walau perkaranya sudah lama selesai.",
      "Pembersihan dijalankan dari layar Integrasi e-Court, belum berjalan otomatis terjadwal.",
      "Keadaan akhir dibaca paling banyak untuk 500 perkara sekali putaran.",
    ],
  },
  {
    version: "1.33.1",
    title: "ALETA v1.33.1 - Penataan Tampilan Jadwal Sidang",
    date: "2026-08-30",
    status: "Operasional",
    summary:
      "Layar Jadwal Sidang ditata ulang: navigasi hari berdiri sendiri sebagai satu alat, tanggal terbacanya diletakkan besar, kepala tabel menempel saat digulung, dan rincian sidang disusun sebagai kartu-kartu yang terpisah rapi.",
    added: [
      "Jumlah sidang ditampilkan di samping tanggal, sehingga terbaca tanpa menghitung baris.",
      "Para pihak diringkas di bawah nomor perkara pada tabel utama - nama lengkapnya muncul saat disentuh.",
      "Keadaan kosong menawarkan langkah berikutnya, bukan sekadar memberitahu tidak ada sidang.",
    ],
    changed: [
      "Panah hari, pemilih tanggal, dan tombolnya disatukan menjadi satu alat navigasi. Sebelumnya tujuh tombol berjajar tanpa pengelompokan, dan yang dipakai tiap hari tenggelam di antara yang jarang dipakai.",
      "Tombol Skor kesiapan dan Cetak dipindah ke ujung kanan baris kedua, terpisah dari navigasi tanggal.",
      "Kepala tabel menempel saat daftar digulung - jadwal sehari dapat puluhan baris, dan tanpa itu nama kolomnya hilang di tengah.",
      "Baris berselang warna, baris yang sedang dibuka disorot, dan rincian diberi garis kiri supaya jelas milik baris yang mana.",
      "Kode majelis ditampilkan sebagai penanda, nama hakimnya dipendekkan dengan keterangan penuh saat disentuh.",
      "Tiap bagian rincian - majelis, pihak, kesiapan, putusan, relaas, berkas - dibingkai sebagai kartu dengan kepala yang seragam.",
      "Nomor perkara diulang di kepala rincian, supaya pembaca yang sudah menggulung tidak kehilangan jejak barisnya.",
    ],
    fixed: [],
    security: [],
    operationalNotes: [
      "Hanya tampilan yang berubah. Perhitungan kesiapan, kepatutan panggilan, dan pembacaan data tidak disentuh sama sekali.",
    ],
    knownLimitations: [
      "Tabel memerlukan lebar layar sekitar 1040 piksel. Pada layar sempit, tabelnya digulung mendatar.",
    ],
  },
  {
    version: "1.33.0",
    title: "ALETA v1.33.0 - Ringkasan Alur, Cetak Jadwal, dan Unduhan BAS",
    date: "2026-08-30",
    status: "Operasional",
    summary:
      "Layar Jadwal Sidang bertambah ringkasan jumlah perkara per alur yang dapat dibuka rinciannya, kolom ruang sidang, unduhan Berita Acara Sidang dan naskah putusan, serta lembar cetak jadwal lengkap dengan nama para pihak.",
    added: [
      "Ringkasan di atas tabel: jumlah sidang gugatan, permohonan, gugatan sederhana, jinayah, dan lainnya. Ditekan untuk membuka rinciannya.",
      "Rincian per kelompok memuat agenda, sidang keberapa, potensi verstek atau contradictoir, jenis perkara, majelis, panitera, jurusita, dan ruang sidang.",
      "Kolom Ruang pada tabel utama, terpisah dari agenda.",
      "Tombol unduh Berita Acara Sidang pada tiap baris Seluruh jadwal sidang perkara ini.",
      "Tombol unduh naskah putusan dan naskah putusan anonim.",
      "Penanda kehadiran pada tiap sidang: semua pihak, penggugat saja, tergugat saja, atau tidak ada yang hadir.",
      "Cetak jadwal sidang: tabel A4 melintang berisi nomor perkara, jenis perkara, PARA PIHAK, majelis, panitera sidang, jurusita, agenda, dan ruang sidang.",
    ],
    changed: [
      "Nama para pihak ikut dibaca pada daftar jadwal - satu kueri untuk seluruh daftar, bukan satu per perkara.",
      "Sidang keberapa ditampilkan di bawah agenda pada tabel utama.",
    ],
    fixed: [],
    security: [
      "Naskah putusan asli dan naskah anonim disebutkan terpisah dan diberi label berbeda. Yang anonim boleh dipublikasikan; yang asli memuat identitas para pihak, dan keduanya tidak boleh tertukar.",
      "Lembar cetak menyembunyikan SELURUH bagian aplikasi lain, bukan menyembunyikan satu per satu. Menyembunyikan per bagian akan gagal begitu ada bagian baru, dan yang tercetak menjadi sidebar dan tombol.",
      "Nama pengadilan pada lembar cetak dibaca dari identitas lembaga, tidak dipatok mati.",
    ],
    operationalNotes: [
      "Potensi verstek dibaca dari kehadiran: hanya penggugat/pemohon yang hadir. Itu gejalanya, bukan kesimpulan - penetapan verstek tetap milik majelis.",
      "Ringkasan alur menampilkan seluruh sidang pada rentang yang sedang dibuka. Menekan satu kelompok membuka rinciannya tanpa menyaring tabel utama, supaya angkanya tetap cocok dengan isi tabel.",
      "BAS yang belum diunggah ditandai BAS belum diunggah, bukan disembunyikan.",
      "Lembar cetak memakai data yang sudah dimuat di layar - tidak memuat ulang dari server.",
    ],
    knownLimitations: [
      "Nama pihak pada daftar dibaca paling banyak untuk 500 perkara sekali muat.",
      "Kehadiran dan potensi verstek hanya terisi bila jurusita atau panitera sudah mengisinya di SIPP.",
      "Lembar cetak mengikuti rentang tanggal yang sedang ditampilkan. Untuk mencetak hari lain, pindah tanggalnya lebih dulu.",
    ],
  },
  {
    version: "1.32.0",
    title: "ALETA v1.32.0 - Keadaan Putusan dan Perbaikan Pembacaan Relaas",
    date: "2026-08-30",
    status: "Operasional",
    summary:
      "Pemohon yang sudah benar dipanggil elektronik ditandai salah saluran, karena kedudukan pihak tidak pernah dibaca dari SIPP. Jurusita juga kerap kosong pada keadaan relaas walau namanya jelas tercatat. Keduanya diperbaiki, catatan SIPP kini didahulukan atas e-Court, dan layar jadwal bertambah keadaan putusan sampai akta cerai.",
    added: [
      "Nomor urut pada layar Jadwal Sidang, sehingga jumlah sidang hari itu terbaca sekilas.",
      "Kolom Putusan pada tabel utama: status dan tanggal putusan, beserta penanda belum minutasi atau belum BHT.",
      "Bagian Putusan dan tindak lanjutnya pada rincian: tanggal putusan, status, verstek, dicabut, gugur, minutasi, berkekuatan hukum tetap, akta cerai, dan upaya hukum.",
      "Penyerahan akta cerai dicatat per pihak - sering satu pihak sudah mengambil dan satunya belum, dan itulah yang ditanyakan di meja pelayanan.",
      "Amar putusan ringkas, dapat dibuka bila diperlukan.",
    ],
    changed: [
      "Urutan jadwal sidang mengikuti alur perkara - gugatan, permohonan, gugatan sederhana, jinayah, lalu sisanya - dan di dalam tiap jenis, yang mendaftar lebih dulu tampil lebih dulu.",
      "Nomor perkara diurut sebagai angka. Sebagai teks, 1000 jatuh sebelum 186 dan perkara yang mendaftar belakangan tampil di atas.",
      "Catatan relaas SIPP kini DIDAHULUKAN atas catatan e-Court. e-Court hanya dipakai bila SIPP belum mencatat apa pun.",
      "Daftar pihak digabung dari kedua sumber: kedudukan dari SIPP, persetujuan saluran dari e-Court.",
      "Sidebar ALETA e-Court memakai gaya sidebar utama aplikasi.",
    ],
    fixed: [
      "Pemohon dan penggugat ditandai SALAH SALURAN bertingkat berat padahal panggilan elektroniknya sudah benar. Kedudukan pihak tidak pernah dibaca dari SIPP, sehingga perkara yang belum ditarik dari e-Court membuat setiap pihak terbaca tanpa kedudukan - lalu dinilai harus dipanggil lewat surat tercatat.",
      "Jurusita kosong pada keadaan relaas walau namanya tercatat. Namanya hanya dicari pada penugasan jurusita untuk perkara itu; kini dicari juga pada daftar induk jurusita.",
      "Tanggal dari e-Court menimpa tanggal relaas SIPP yang sudah benar.",
      "ER_TOO_LONG_KEY pada dua tabel baru - kolom nama pihak VARCHAR(255) melewati batas 767 byte MySQL.",
    ],
    security: [
      "Kedudukan pihak dibaca dari SIPP, bukan ditebak dari isian yang kosong. Menebak kedudukan berarti menebak jalur panggilan yang sah.",
      "Amar putusan dibersihkan dari tag HTML sebelum ditampilkan - SIPP menyimpannya sebagai keluaran penyunting kaya.",
    ],
    operationalNotes: [
      "Keterangan putusan dibaca langsung dari SIPP, tidak menunggu penarikan e-Court.",
      "Perkara yang belum diputus menampilkan belum putus, bukan dikosongkan.",
      "Penanda belum minutasi dan belum BHT hanya muncul pada perkara yang sudah diputus.",
    ],
    knownLimitations: [
      "Upaya hukum dibaca dari tanggal permohonan banding, kasasi, dan peninjauan kembali. Perkembangan di tingkat atasnya tidak ikut ditampilkan.",
      "Akta cerai hanya ada pada perkara perceraian. Perkara lain menampilkan belum terbit.",
      "Urutan alur perkara memakai nomor alur SIPP: 15 gugatan, 16 permohonan, 17 gugatan sederhana, 122 jinayah. Alur lain masuk kelompok terakhir.",
    ],
  },
  {
    version: "1.31.2",
    title: "ALETA v1.31.2 - Perbaikan Tabel Gagal Dibuat dan Sidebar e-Court",
    date: "2026-08-30",
    status: "Operasional",
    summary:
      "Dua tabel baru pada v1.31.0 gagal dibuat karena kolom nama pihak melewati batas 767 byte MySQL, dan kegagalan itu membuat layar Kendali Berkas maupun Jadwal Sidang menampilkan ER_TOO_LONG_KEY alih-alih datanya. Kunci alaminya kini diringkas menjadi sidik jari. Sidebar ALETA e-Court juga disamakan dengan sidebar utama aplikasi.",
    added: [
      "Pemeriksaan otomatis lebar kolom yang diindeks pada seluruh tabel ALETA Bot, supaya kegagalan serupa tertangkap sebelum sampai ke server.",
    ],
    changed: [
      "Sidebar ALETA e-Court kini memakai gaya yang sama dengan sidebar utama aplikasi: latar gelap bergradasi, sudut membulat, ikon per menu, dan penanda menu aktif yang sama.",
      "Tabel persetujuan pihak dan panggilan e-Summons memakai sidik jari kunci alaminya sebagai id - pola yang sama dengan document_key pada tabel dokumen.",
    ],
    fixed: [
      "ER_TOO_LONG_KEY: Specified key was too long; max key length is 767 bytes. Kolom nama pihak VARCHAR(255) pada utf8mb4 memakan 1020 byte, dan MySQL menolak kolom seluas itu di dalam indeks. Kedua tabel baru gagal dibuat, dan karena penyiapan skema berhenti di situ, Kendali Berkas dan Jadwal Sidang ikut gagal seluruhnya.",
    ],
    security: [],
    operationalNotes: [
      "Tidak ada data yang hilang: kedua tabel memang belum pernah berhasil dibuat. Setelah pembaruan ini, tabelnya terbentuk sendiri pada penarikan berikutnya.",
      "Persetujuan pihak dan catatan e-Summons baru terisi setelah perkaranya ditarik dari e-Court.",
      "Batas 767 byte berlaku PER KOLOM, bukan per indeks. Itu sebabnya seluruh tabel ALETA memakai VARCHAR(191) untuk kolom yang diindeks - 191 kali empat byte pas di bawah batas.",
    ],
    knownLimitations: [],
  },
  {
    version: "1.31.1",
    title: "ALETA v1.31.1 - Kepatutan Panggilan Sesuai SK KMA 363/2022",
    date: "2026-08-30",
    status: "Operasional",
    summary:
      "Ambang kepatutan panggilan disesuaikan dengan bunyi SK KMA 363/KMA/SK/XII/2022: elektronik 3 Hari, surat tercatat 6 Hari, keduanya hari KALENDER - sebelumnya keduanya 3 hari kerja. Ditambah syarat kedua yang sebelumnya terlewat: surat tercatat harus terbukti diterima berdasarkan lacak kiriman. Perkara non-e-Court kini dinilai terpisah dengan Pasal 122 HIR.",
    added: [
      "Tiga jalur panggilan dengan ambang dan dasar hukum masing-masing: elektronik (SK KMA 363/2022 angka 7 huruf d), surat tercatat (angka 8 huruf c), dan panggilan biasa (Pasal 122 HIR).",
      "Kolom Pengiriman dan Penerimaan terpisah pada rincian sidang - sudah dikirim atau belum, dan sudah terbukti diterima atau belum, keduanya selalu dicantumkan.",
      "Pembacaan tanggal kirim ke pos dan status lacak kiriman dari data relaas SIPP.",
      "Deteksi perkara terdaftar e-Court, untuk menentukan aturan mana yang berlaku.",
      "Dasar hukum tiap penilaian ditampilkan di bawah lencananya, sehingga angkanya dapat ditelusuri.",
    ],
    changed: [
      "Penggugat/Pemohon pada perkara e-Court selalu dinilai dengan jalur elektronik - tidak ada pilihan surat tercatat baginya.",
      "Tergugat dinilai elektronik bila menyetujui saluran elektronik; bila menolak atau belum menjawab, surat tercatat.",
      "Perkara non-e-Court dinilai dengan Pasal 122 HIR untuk seluruh pihak, memakai hari kerja.",
      "Pengaturan tenggang kini tiga angka terpisah. Cara hitung - kalender atau kerja - melekat pada dasar hukumnya dan tidak lagi dapat diubah dari layar.",
      "Untuk surat tercatat, tenggang dihitung dari tanggal kirim ke pos, bukan tanggal pelaksanaan relaas - yang terakhir justru tanggal diterimanya.",
    ],
    fixed: [
      "Ambang surat tercatat masih 3 hari kerja, padahal SK KMA 363/2022 angka 8 huruf c menuntut 6 Hari. Panggilan pos yang dikirim empat hari sebelum sidang ditandai PATUT padahal belum memenuhi.",
      "Ambang elektronik dihitung hari kerja, padahal Hari pada SK KMA adalah hari kalender. Panggilan yang dikirim Jumat untuk sidang Senin terhitung satu hari kerja padahal tiga hari kalender.",
      "Syarat diterima di alamat tergugat berdasarkan lacak kiriman tidak diperiksa sama sekali. Surat yang dikirim sepuluh hari sebelum sidang tetapi belum sampai ditandai patut.",
      "Perkara non-e-Court dinilai dengan aturan e-Court, padahal jalur elektronik tidak pernah dibuka untuknya.",
    ],
    security: [
      "Panggilan dinilai menurut jalur yang SEHARUSNYA, bukan jalur yang terlanjur dipakai. Panggilan lewat jalur keliru tidak menjadi patut hanya karena jalur kelirunya berambang lebih longgar.",
      "Terkirim tepat waktu tetapi penerimaan belum terbukti ditandai KUNING, bukan hijau dan bukan merah. Tindak lanjutnya menelusuri kiriman, bukan memanggil ulang - dan menyamakannya dengan panggilan terlambat mengaburkan itu.",
      "Perkara yang tidak dapat dipastikan terdaftar e-Court dianggap perkara biasa. Menganggapnya e-Court saat ragu berarti menilai dengan jalur yang mungkin tidak pernah dibuka.",
      "Cara hitung hari tidak dapat diubah dari layar. Membiarkannya diubah berarti membiarkan aturan diputarbalikkan dengan satu klik.",
    ],
    operationalNotes: [
      "Ambang bawaan: elektronik 3 Hari kalender, surat tercatat 6 Hari kalender, panggilan biasa 3 hari kerja. Angkanya masih dapat disesuaikan bila aturannya berubah.",
      "Bukti penerimaan surat tercatat dibaca dari dua tempat: status lacak kiriman pada SIPP, atau tanggal pelaksanaan relaas yang diisi jurusita. Salah satunya cukup.",
      "Perkara biasa yang tidak punya catatan e-Court tetap dinilai - pihaknya dibaca dari data relaas SIPP.",
      "Persetujuan pihak baru terbaca setelah perkaranya ditarik dari e-Court.",
    ],
    knownLimitations: [
      "Penilaian ini alat bantu petugas, BUKAN penetapan sah tidaknya panggilan. Keputusan itu tetap milik majelis.",
      "Hitungan hari kerja pada jalur Pasal 122 HIR hanya mengecualikan Sabtu dan Minggu - libur nasional dan cuti bersama tidak diperhitungkan. Jalur e-Court memakai hari kalender sehingga tidak terpengaruh.",
      "Konfirmasi jadwal sidang oleh jurusita sebelum mengirim panggilan (angka 7 huruf b) berjalan otomatis dari SIPP dan e-Court, sehingga tidak diperiksa terpisah.",
      "Pencocokan pihak antara e-Court dan SIPP memakai nama. Beda ejaan yang jauh membuat satu pihak terbaca belum dipanggil padahal sudah.",
    ],
  },
  {
    version: "1.31.0",
    title: "ALETA v1.31.0 - Skor Kesiapan Sidang dan Kepatutan Panggilan",
    date: "2026-08-30",
    status: "Operasional",
    summary:
      "Persetujuan saluran elektronik di e-Court menentukan cara memanggil: yang menyetujui dipanggil lewat e-Summons, yang menolak atau belum menjawab harus dipanggil jurusita lewat surat tercatat. ALETA kini membaca persetujuan itu, membandingkannya dengan relaas SIPP dan panggilan e-Summons, lalu menandai saluran yang tidak sesuai dan tenggang waktu yang kurang. Ditambah skor kesiapan per sidang.",
    added: [
      "Skor kesiapan sidang pada layar Jadwal Sidang: satu angka per sidang beserta daftar penghambatnya - panggilan, majelis, panitera, berkas, verifikasi, dan nomor pihak.",
      "Pembacaan persetujuan saluran elektronik para pihak dari halaman e-Court, dengan tiga keadaan: setuju, tidak setuju, dan belum menjawab.",
      "Pembacaan tabel Panggilan (e-Summons) beserta tanggal pengirimannya.",
      "Penandaan saluran yang tidak sesuai persetujuan - misalnya penggugat yang menyetujui saluran elektronik tetapi dipanggil lewat surat tercatat.",
      "Penilaian tenggang waktu panggilan: patut, tidak patut, atau dipanggil setelah hari sidang.",
      "Pengaturan tenggang waktu kepatutan di menu Integrasi e-Court, terpisah untuk panggilan jurusita dan panggilan elektronik.",
      "Tabel panggilan per pihak pada rincian sidang: persetujuan, saluran yang seharusnya, saluran yang terlaksana, tanggal, nomor resi pos, dan tenggangnya.",
    ],
    changed: [
      "Penarikan e-Court kini ikut menyimpan persetujuan pihak dan catatan e-Summons. Keduanya dibaca dari halaman yang SUDAH diunduh untuk dokumen - tidak ada permintaan tambahan ke Mahkamah Agung.",
      "Layar Jadwal Sidang menampilkan kolom Siap, dan penilaiannya dapat dimatikan bagi yang hanya ingin melihat jam sidang.",
    ],
    fixed: [
      "Tanggal panggilan dan tanggal sidang bergeser MUNDUR SEHARI saat dikirim ke peramban. Nilai bertipe tanggal berubah menjadi waktu UTC ketika diserialkan, dan di Makassar tengah malam tanggal 26 menjadi pukul 16.00 tanggal 25. Tanggal kini dibakukan sebagai teks waktu setempat.",
    ],
    security: [
      "Angka tenggang waktu TIDAK dipatok mati di kode. Penetapan berapa hari sebuah panggilan disebut patut adalah kewenangan pengadilan, bukan keputusan aplikasi - dan angka yang tidak dapat dipastikan akan menandai panggilan sah sebagai cacat, atau meloloskan yang cacat.",
      "Hanya persetujuan tegas yang menghasilkan saluran elektronik. Belum menjawab BUKAN persetujuan: memanggilnya lewat e-Summons berarti mengirim ke alamat yang belum pernah disetujui sebagai domisili elektronik.",
      "Keterangan yang belum terbaca tidak dihitung sebagai memenuhi syarat. Sidang tanpa data bernilai nol, bukan seratus - sidang yang tampak siap padahal datanya kosong adalah keyakinan yang dibangun dari ketiadaan.",
      "Penghambat bertingkat berat membuat sidang tidak pernah disebut siap, berapa pun skornya. Berkas lengkap tidak menolong bila pihaknya belum dipanggil.",
      "Mengubah tenggang waktu hanya untuk Super Admin dan Admin; membacanya terbuka bagi yang boleh melihat panel, supaya lencana tidak patut tidak muncul tanpa keterangan dari mana angkanya.",
    ],
    operationalNotes: [
      "Bawaan tenggang tiga hari kerja, mengikuti Pasal 122 HIR. Pasal 26 ayat (4) PP 9/1975 menyebut tiga hari untuk perkara perkawinan. Keabsahan panggilan elektronik diatur PERMA 7/2022 dan SK KMA 363/KMA/SK/XII/2022. Silakan sesuaikan angkanya di menu Integrasi e-Court.",
      "Persetujuan pihak baru terbaca setelah perkaranya ditarik ulang dari e-Court. Perkara yang belum ditarik akan menampilkan Persetujuan saluran belum terbaca.",
      "Hitungan hari kerja hanya mengecualikan Sabtu dan Minggu - libur nasional dan cuti bersama TIDAK diperhitungkan, dan itu disebutkan di layar.",
      "Skor menilai paling banyak 50 sidang sekali muat. Sidang selebihnya tidak dinilai, bukan dianggap siap.",
    ],
    knownLimitations: [
      "Penilaian ini alat bantu petugas, BUKAN penetapan sah tidaknya panggilan. Keputusan itu tetap milik majelis, dan tiap penghambat disebutkan beserta sumbernya supaya dapat diperiksa ulang.",
      "Pencocokan pihak antara e-Court dan SIPP memakai nama. Beda ejaan yang cukup jauh antara kedua sistem membuat satu pihak terbaca belum dipanggil padahal sudah.",
      "Saluran yang terlaksana dibaca dari ada tidaknya nomor resi pos pada relaas SIPP. Relaas pos yang diisi tanpa nomor resi akan terbaca sebagai panggilan elektronik.",
      "Bobot skor ditetapkan aplikasi dan belum dapat diubah pengadilan.",
    ],
  },
  {
    version: "1.30.0",
    title: "ALETA v1.30.0 - Ketahanan Sesi, Keutuhan Berkas, dan Akun Bergiliran",
    date: "2026-08-30",
    status: "Operasional",
    summary:
      "Dua cacat yang sudah terbukti diperbaiki: sesi e-Court hilang setiap pembaruan karena profilnya berada di dalam container, dan isi berkas tidak pernah diperiksa sehingga halaman error tersimpan sebagai PDF yang dianggap lengkap. Ditambah pemantau sesi dengan peringatan WhatsApp, akun bergiliran, pemeriksaan keutuhan arsip, dan unduh satu perkara sebagai ZIP.",
    added: [
      "Pemantau sesi e-Court: mengunjungi e-Court berkala agar sesinya tidak mati karena menganggur, dan mengirim WhatsApp ke admin begitu sesinya habis.",
      "Beberapa akun e-Court dipakai bergiliran. Sesi yang habis pada satu akun menggeser penarikan ke akun berikutnya, bukan menghentikannya.",
      "Pemeriksaan keutuhan arsip: mencocokkan catatan dengan berkas di disk - masih ada, ukuran sama, sidik jari cocok, dan isinya benar-benar PDF atau Word. Berjalan bergilir.",
      "Tombol buang berkas rusak, sehingga perkaranya ditarik ulang pada penarikan berikutnya.",
      "Unduh seluruh berkas satu perkara sebagai satu ZIP, lengkap dengan KETERANGAN.txt yang menyebutkan berkas apa saja yang tidak ikut dan mengapa.",
    ],
    changed: [
      "Profil sesi e-Court pindah ke volume /var/www/html/aleta-data/ecourt-session, di luar container.",
      "Tiap akun memakai folder profil sendiri. Profil peramban hanya dapat dipakai satu proses - berbagi folder berarti akun saling mengeluarkan, bukan bergiliran.",
    ],
    fixed: [
      "Sesi e-Court hilang setiap pembaruan. Profilnya berada di dalam container, dan setiap install.sh membuat ulang containernya - sehingga petugas harus login ulang dengan captcha tiap kali dipasang versi baru.",
      "Jawaban yang bukan berkas tersimpan sebagai berkas. Tipe text/html memang sudah ditolak, tetapi jawaban ber-tipe benar dengan tubuh halaman error, jawaban terpotong, dan jawaban kosong semuanya lolos - lalu perkaranya tercatat LENGKAP dan dilewati penarikan berikutnya.",
    ],
    security: [
      "Folder sesi dibuat dengan izin 0700. Isinya kredensial: siapa pun yang dapat membacanya dapat masuk sebagai petugas ke sistem Mahkamah Agung.",
      "Nama slot akun dibersihkan sebelum menjadi jalur folder. Nama seperti ../../etc akan membuat profil ditulis di luar folder sesi, dan penghapusan sesi menghapus folder di luar sana.",
      "ALETA tetap TIDAK menyimpan sandi e-Court dan TIDAK mengisi captcha. Menambah akun berarti mendaftarkan slotnya, lalu petugas login sekali secara manual.",
      "Detak pemantau dilewati ketika penarikan sedang berjalan. Membuka peramban kedua di atas profil yang sedang dipakai dapat merusak profilnya - sesi hilang justru oleh mekanisme yang menjaganya.",
      "Peringatan sesi habis dikirim saat keadaannya berubah, lalu diulang paling cepat beberapa jam kemudian. Peringatan tiap detak berarti puluhan pesan semalam untuk satu keadaan yang sama.",
      "Membuang berkas rusak harus diminta terpisah dan dikonfirmasi. Pemeriksaan yang sekaligus menghapus membuat tombol Periksa menjadi tombol yang menghapus.",
    ],
    operationalNotes: [
      "Setelah pembaruan ini, login e-Court sekali lagi - profil lama berada di dalam container dan tidak terbawa. Ini login terakhir yang hilang karena pembaruan.",
      "Pemantau sesi dan penjadwal keduanya dimulai dalam keadaan MATI. Nyalakan dari menu Integrasi e-Court.",
      "Peringatan WhatsApp memerlukan nomor admin di pengaturan ALETA Bot. Bila kosong, layar akan mengatakannya.",
      "Berkas yang ditolak pemeriksaan isi tidak tersimpan sama sekali, sehingga perkaranya tetap terhitung belum lengkap dan akan dicoba lagi.",
    ],
    knownLimitations: [
      "Pemeriksaan keutuhan memeriksa sejumlah berkas tiap putaran, bukan seluruh arsip sekaligus. Seluruh arsip terperiksa dalam beberapa putaran.",
      "Berkas di atas 64 MB hanya diperiksa keberadaan, ukuran, dan penanda awalnya - sidik jarinya tidak dihitung ulang.",
      "Bergiliran bukan bersamaan: tetap satu akun pada satu waktu. Menarik dengan dua akun sekaligus menggandakan beban ke Mahkamah Agung tanpa mempercepat apa pun.",
      "ZIP dibatasi 60 berkas dan 200 MB. Yang tidak masuk disebutkan di dalam KETERANGAN.txt, bukan dihilangkan diam-diam.",
    ],
  },
  {
    version: "1.29.1",
    title: "ALETA v1.29.1 - Pemilih Hari dan Kalender Sidang",
    date: "2026-08-30",
    status: "Operasional",
    summary:
      "Memilih hari pada Jadwal Sidang sebelumnya menuntut mengetik dua tanggal lalu menekan Tampilkan. Sekarang cukup panah kiri-kanan, atau memilih tanggal dari kalender sidang yang menunjukkan hari mana saja yang ada sidangnya beserta jumlahnya.",
    added: [
      "Pemilih hari dengan panah hari sebelumnya dan berikutnya. Tanggal langsung dimuat begitu dipilih, tanpa menekan Tampilkan.",
      "Nama hari dan tanggal lengkap ditampilkan di sebelah pemilih - Senin, 30 Agustus 2026, bukan hanya 2026-08-30.",
      "Kalender sidang sebagai pop up: satu bulan penuh, dengan jumlah sidang pada tiap tanggal dan berapa yang ditunda. Memilih tanggal langsung membuka jadwalnya.",
      "Perpindahan bulan pada kalender, sehingga jadwal bulan depan maupun bulan lalu dapat dilihat tanpa mengetik tanggal.",
      "Seluruh jadwal sidang perkara pada rincian: riwayat sidang dari awal sampai terakhir, lengkap dengan agenda dan alasan penundaan.",
    ],
    changed: [
      "Bilah penyaring Jadwal Sidang disusun ulang: pemilih hari di depan, rentang tanggal dan pencarian di baris kedua. Melihat satu hari adalah yang dikerjakan tiap pagi; melihat sepekan sekaligus jarang.",
      "Hari bawaan tetap hari ini, seperti sebelumnya.",
    ],
    fixed: [
      "Menekan panah hari berikutnya memuat hari yang keliru - tertinggal satu langkah - karena pemuatan membaca tanggal dari keadaan yang belum berubah pada putaran itu. Tanggalnya kini dikirim langsung.",
    ],
    security: [
      "Bulan yang tidak berpola YYYY-MM ditolak dan tidak menyentuh SIPP sama sekali - termasuk 2026-13, 2026-8, dan tanggal lengkap yang keliru dikirim sebagai bulan.",
      "Kalender hanya mengirim HITUNGAN per hari, bukan daftar perkaranya. Menggambar angka di kotak tanggal tidak memerlukan nomor perkara sebulan penuh, dan mengirimnya berarti memajang perkara sebulan dalam satu jawaban.",
    ],
    operationalNotes: [
      "Rentang tanggal tetap tersedia untuk melihat beberapa hari sekaligus - isi kotak Sampai tanggal lalu tekan Tampilkan.",
      "Angka pada kotak tanggal di kalender adalah jumlah sidang; angka kedua adalah jumlah yang ditunda.",
      "Kalender dapat ditutup dengan tombol Tutup, menekan Escape, atau mengklik di luar kotaknya.",
    ],
    knownLimitations: [
      "Kalender menampilkan satu bulan sekali muat. Bulan lain dibuka dengan panah di kepala kalender.",
      "Jumlah pada kalender menghitung seluruh sidang pengadilan pada hari itu, tidak disaring menurut kata pencarian yang sedang aktif.",
    ],
  },
  {
    version: "1.29.0",
    title: "ALETA v1.29.0 - Jadwal Perkara yang Bersidang",
    date: "2026-08-30",
    status: "Operasional",
    summary:
      "Menyiapkan satu sidang sebelumnya menuntut membuka tiga aplikasi: SIPP untuk majelis dan agenda, e-Court untuk berkas para pihak, dan ALETA untuk keadaan verifikasi. Menu Jadwal Sidang menyatukan ketiganya - satu baris per sidang, seluruh keterangannya terbuka saat sidang itu dipilih.",
    added: [
      "Menu Jadwal Sidang pada sidebar ALETA e-Court: nomor perkara, jenis perkara, kode majelis, panitera sidang, jurusita, agenda, jam, dan ruangan.",
      "Penyaringan rentang tanggal dengan tombol Hari ini, serta pencarian nomor perkara, jenis perkara, atau agenda.",
      "Rincian per sidang: susunan majelis lengkap dengan kedudukannya, panitera, jurusita, identitas para pihak beserta kuasa hukumnya, dan keadaan nomor WhatsApp tiap pihak.",
      "Penanda jenis perkara, kumulasi, dan kuasa hukum - sisi mana yang berkuasa hukum, bukan sekadar pakai atau tidak.",
      "Keadaan keterangan saksi: berapa saksi dan berapa keterangan yang sudah tercatat di SIPP.",
      "Keadaan relaas panggilan per pihak: tanggal, apakah jurusita bertemu langsung, nomor resi pos, dan jurusita yang melaksanakan - dengan tombol unduh relaas dan resinya.",
      "Seluruh berkas dalam satu tempat: dokumen e-Court beserta keadaan verifikasi majelis, dan dokumen yang tersimpan di SIPP - keduanya dapat diunduh langsung dari sini.",
    ],
    changed: [
      "Sidebar ALETA e-Court kini berisi empat menu: Dasbor, Jadwal Sidang, Kendali Berkas, dan Ekstensi SIPP. Jadwal Sidang diletakkan sebelum Kendali Berkas karena itulah yang ditanya petugas tiap pagi.",
    ],
    fixed: [],
    security: [
      "Jalur berkas SIPP TIDAK PERNAH datang dari peramban. Peramban hanya menyebut jenis dan nomor barisnya; jalurnya dibaca dari SIPP oleh bot, lalu dilewatkan penyaring ekstensi dan akar folder yang sudah ada.",
      "Tanggal yang tidak berpola YYYY-MM-DD ditolak dan diganti hari ini, bukan diteruskan ke kueri.",
      "SIPP hanya DIBACA. Seluruh kueri pada layar ini SELECT, dan nomor perkara selalu masuk sebagai parameter - tidak pernah disambung ke teks kueri.",
      "Melihat jadwal memakai kemampuan panel, mengunduh berkas memakai kemampuan berkas - keduanya diatur per peran sejak v1.27.1.",
      "Tabel utama tidak memuat identitas para pihak. Memajang identitas puluhan perkara di satu layar tidak diperlukan siapa pun untuk melihat jadwal.",
    ],
    operationalNotes: [
      "Nama majelis, panitera, dan jurusita dibaca dari baris penugasan perkara - sehingga sidang lama tetap menunjukkan siapa yang bertugas saat itu, walau orangnya sudah pindah.",
      "Berkas e-Court yang belum tersimpan ditandai belum tersimpan. Menariknya dari menu Kendali Berkas atau tombol Unduh semua di Integrasi e-Court.",
      "Bagian yang gagal dibaca gagal sendiri-sendiri: e-Court yang sedang tidak terbaca tidak menghilangkan majelis dan agenda yang sudah ada di SIPP.",
    ],
    knownLimitations: [
      "Keadaan saksi dihitung dari keterangan saksi yang tercatat di SIPP, bukan dari daftar saksi yang diajukan. Saksi yang sudah diajukan tetapi belum diperiksa belum terhitung.",
      "Relaas ditampilkan untuk sidang yang dipilih saja. Relaas sidang sebelumnya dibaca dengan membuka sidang tersebut.",
      "Tombol verifikasi hakim tidak ada di layar ini - verifikasi tetap dilakukan dari panel ekstensi di halaman SIPP, tempat keanggotaan majelis diperiksa. Yang ditampilkan di sini keadaannya.",
      "Daftar menampilkan paling banyak 200 sidang sekali muat.",
    ],
  },
  {
    version: "1.28.0",
    title: "ALETA v1.28.0 - Penarikan dan Pemantauan Berkas e-Court dari Portal",
    date: "2026-08-30",
    status: "Operasional",
    summary:
      "Menarik berkas e-Court sebelumnya hanya dapat dimulai lewat SSH, dan kemajuannya hanya dapat dilihat dengan tail -f. Sekarang ketiganya ada di halaman Integrasi e-Court: tombol unduh semua, tombol tarik per perkara pada baris yang berkasnya belum lengkap, dan layar pemantauan yang mengikuti log secara langsung.",
    added: [
      "Tombol Unduh semua berkas belum lengkap di halaman Integrasi e-Court. Menjalankan jembatan yang sama dengan aleta-ecourt-unduh-latar.sh tanpa batas jumlah perkara.",
      "Tombol Tarik berkas pada tiap baris perkara di Kendali Berkas yang berkasnya belum lengkap - menarik perkara itu saja, seketika, tanpa menunggu detak penjadwal.",
      "Layar pemantauan log: riwayat penarikan, dan isi log yang mengalir sendiri seperti tail -f. Halaman boleh ditutup - penarikan tetap berjalan di server.",
      "Tombol Hentikan penarikan untuk penarikan yang dimulai dari portal.",
    ],
    changed: [
      "Penarikan dari portal maupun dari SSH menulis ke folder log yang sama dengan pola nama yang sama, sehingga keduanya muncul di layar pemantauan yang sama.",
      "Penjadwal e-Court kini mencatat keluaran jembatan ke berkas log, bukan hanya menahan cuplikannya di memori.",
    ],
    fixed: [
      "Penarikan yang dimulai dari SSH tidak terlihat dari portal, dan sebaliknya. Petugas dapat memulai penarikan kedua di atas yang pertama - dua peramban membuka e-Court sekaligus dan menarik perkara yang sama dua kali.",
    ],
    security: [
      "Menarik seluruh arsip dan menghentikan penarikan hanya untuk Super Admin dan Admin: keduanya berjam-jam membebani server Mahkamah Agung, dan penghentian memutus pekerjaan yang mungkin sedang ditunggu orang lain.",
      "Menarik satu perkara memakai kemampuan permintaan yang sudah diatur per peran sejak v1.27.1.",
      "Nama berkas log yang dikirim peramban dicocokkan ke pola ketat DAN jalur hasilnya diperiksa ulang harus berada di dalam folder log. Tanpa itu, nama seperti ../../etc/passwd akan membaca berkas mana pun yang dapat dijangkau portal.",
      "Berkas kunci berdetak mencegah penarikan ganda lintas jalur. Nomor proses tidak dapat dipakai lintas container, sehingga yang diperiksa waktu detaknya - kunci yang tertinggal karena bot berhenti mendadak tidak memblokir penarikan selamanya.",
      "Setiap penarikan dan penghentian tercatat di jejak audit, lengkap dengan siapa yang memulai.",
    ],
    operationalNotes: [
      "Perkara yang berkasnya sudah lengkap DILEWATI, tidak diunduh ulang - --paksa-ulang tidak pernah dikirim dari tombol mana pun.",
      "Penarikan menyeluruh dapat berjam-jam. Halaman boleh ditutup; kemajuannya dibaca lagi kapan saja lewat riwayat penarikan.",
      "Skrip aleta-ecourt-unduh-latar.sh dan aleta-ecourt-tarik-ulang.sh tetap ada dan tetap dapat dipakai. Keduanya kini menolak berjalan bila ada penarikan dari portal yang masih hidup.",
      "Layar pemantauan menahan sekitar 400 ribu huruf terakhir di peramban. Log penuhnya tetap utuh di /var/www/html/aleta-data/reports.",
    ],
    knownLimitations: [
      "Tombol Hentikan hanya dapat menghentikan penarikan yang dimulai dari portal. Penarikan dari SSH berjalan sebagai proses lain di luar jangkauan bot, dan tetap perlu dihentikan dari sana.",
      "Penarikan tetap berhenti bila sesi e-Court habis. Sesi baru harus dibuat dengan login dari menu Integrasi e-Court - captcha menuntut manusia.",
      "Layar pemantauan menampilkan log, bukan hitungan perkara. Berapa perkara yang sudah selesai dibaca dari tabel Kendali Berkas.",
    ],
  },
  {
    version: "1.27.1",
    title: "ALETA v1.27.1 - Akses Ekstensi per Peran dan Penanda Perkara",
    date: "2026-08-29",
    status: "Operasional",
    summary:
      "Sebelum ini satu sesi portal berarti kemampuan penuh atas ekstensi: siapa pun yang dapat masuk ALETA dapat membuka konteks perkara mana pun di SIPP dan mengunduh berkas e-Courtnya. Sekarang kemampuannya dipisah tiga dan dapat dinyalakan per peran dari halaman Integrasi e-Court. Ditambah penanda kuasa hukum, jenis perkara, dan kumulasi pada panel ekstensi, serta perbaikan unduhan yang selama ini tersimpan sebagai berkas.json.",
    added: [
      "Akses ekstensi per peran di halaman Integrasi e-Court: panel di halaman SIPP, unduh berkas e-Court, dan titip permintaan penarikan - masing-masing dapat dinyalakan dan dimatikan untuk tiap peran.",
      "Penanda jenis perkara pada panel ekstensi, dibaca dari SIPP.",
      "Penanda kumulasi perkara beserta daftar jenis perkara yang dikumulasikan.",
      "Penanda kuasa hukum: memakai kuasa atau tidak, dan pada sisi mana - penggugat/pemohon, tergugat/termohon, atau keduanya. Nama kuasanya muncul saat penanda disentuh.",
      "Pengurutan pada Kendali Berkas: terakhir dibaca dua arah, berkas belum ada terbanyak, menunggu majelis terbanyak, dokumen terbanyak, dan nomor perkara A-Z.",
      "Skrip aleta-ecourt-tarik-ulang.sh untuk menarik seluruh arsip dari nol di latar belakang.",
    ],
    changed: [
      "Ekstensi peramban berganti nama menjadi ALETA E-Court.",
      "Peran yang tidak memegang perkara tetap melihat panel ALETA, tetapi tidak lagi dapat mengunduh berkas maupun menitip permintaan. Administrator dapat mengubahnya per peran.",
      "Penolakan karena peran kini ditampilkan sebagai penolakan, bukan sebagai ajakan masuk.",
    ],
    fixed: [
      "Unduhan dari halaman Kendali Berkas tersimpan sebagai berkas.json alih-alih berkas perkaranya. Jawaban error berbentuk JSON ikut tersimpan sebagai berkas, sehingga kegagalannya tidak pernah terlihat siapa pun - yang terunduh memang bukan berkasnya.",
      "Berkas yang diunduh dari ekstensi kadang hilang di tengah jalan. Alamat obyek dilepas pada baris yang sama dengan kliknya, dan peramban masih membacanya setelah itu - sebagian unduhan dibatalkan tanpa pesan apa pun.",
      "Tautan Buka ALETA pada popup ekstensi menunjuk ke dalam ekstensi sendiri (chrome-extension://.../aleta) dan berakhir dengan ERR_FILE_NOT_FOUND. Alamat portal kini dicatat saat halaman SIPP dibuka.",
      "Tombol unduh yang gagal hanya bertuliskan gagal, tanpa sebab. Sebabnya kini muncul saat tombolnya disentuh.",
    ],
    security: [
      "Kemampuan diperiksa di server pada tiap rute - konteks perkara, konteks massal, unduh berkas, dan antrean permintaan - bukan hanya disembunyikan di ekstensi. Ekstensi berjalan di peramban pengguna dan dapat diubah siapa saja yang memasangnya.",
      "Super Admin dan Admin selalu berkemampuan penuh, dan itu ditegakkan di dalam kode, bukan dibaca dari database. Satu baris yang keliru tidak dapat mengunci administrasi keluar dari halaman pengaturannya sendiri.",
      "Pengalihan bagi Super Admin dan Admin sengaja tidak digambar, sehingga tidak ada tombol yang tampak berpengaruh padahal selalu ditolak.",
      "Daftar lengkap peran beserta kewenangannya hanya dijawab kepada Super Admin dan Admin. Peran lain hanya diberi tahu kemampuannya sendiri - daftar penuh adalah peta cara menembus penjagaan ini.",
      "Tiap perubahan akses tercatat di jejak audit, lengkap dengan siapa yang mengubah.",
      "Penanda perkara gagal-terbuka: bila SIPP tidak terbaca, penandanya tidak muncul sama sekali - tidak berubah menjadi tanpa kuasa hukum, yang akan membuat pemberitahuan dialamatkan langsung ke pihak yang sebenarnya berkuasa hukum.",
    ],
    operationalNotes: [
      "Ekstensi harus diunduh ulang dan dimuat ulang di chrome://extensions setelah pembaruan ini.",
      "Bawaannya: seluruh peran tetap melihat panel seperti sebelumnya; mengunduh berkas dan menitip permintaan dinyalakan untuk Ketua, Wakil Ketua, Hakim, Panitera, Panitera Muda, Panitera Pengganti, Jurusita, dan Analis Perkara.",
      "Pengguna yang sedang membuka halaman SIPP perlu memuat ulang halamannya agar panel mengikuti pengaturan baru.",
      "Penarikan ulang seluruh arsip dijalankan dengan aleta-ecourt-tarik-ulang.sh. Keputusan verifikasi hakim, konfirmasi nomor pihak, dan riwayat WhatsApp tidak ikut terhapus.",
    ],
    knownLimitations: [
      "Penanda kuasa, jenis perkara, dan kumulasi dibaca dari SIPP secara langsung. Perkara yang belum tercatat di SIPP tidak menampilkan penanda apa pun.",
      "Pembatasan berlaku pada peran, bukan pada perkara tertentu. Hakim yang diberi akses dapat membuka perkara mana pun, bukan hanya perkara majelisnya - kecuali verifikasi, yang tetap menuntut keanggotaan majelis.",
      "Penandaan tidak_perlu masih hanya berlaku pada dokumen yang ditarik setelah v1.27.0.",
    ],
  },
  {
    version: "1.27.0",
    title: "ALETA v1.27.0 - Kendali Berkas e-Court dan Pemisahan Berkas Pendaftaran",
    date: "2026-08-29",
    status: "Operasional",
    summary:
      "Berkas pendaftaran ternyata tidak mengenal verifikasi majelis di e-Court, tetapi ALETA memperlakukannya seperti dokumen persidangan - sehingga tombol verifikasi hakim muncul untuk dokumen yang tidak dapat diverifikasi. Ditambah halaman Kendali Berkas dengan sidebar: satu baris per perkara, rincian dokumen dibuka saat dipilih.",
    added: [
      "Menu ALETA e-Court kini bersidebar: Dasbor, Kendali Berkas, dan Ekstensi SIPP.",
      "Tabel Kendali Berkas: satu baris per perkara dengan jumlah dokumen, berkas yang sudah ada, dan yang belum. Rincian dokumen muncul saat satu baris dibuka.",
      "Pencarian nomor perkara maupun nomor register, penyaringan hanya yang berkasnya belum lengkap, dan tombol Perbarui Data.",
      "Unduhan berkas langsung dari tabel, memakai jalur yang sama dengan ekstensi SIPP.",
      "Status verifikasi tidak_perlu untuk dokumen yang memang tidak mengenal verifikasi.",
    ],
    changed: [
      "Dokumen persidangan kini membedakan sudah diverifikasi, dinyatakan tidak valid, dan menunggu majelis - sebelumnya hanya dua keadaan.",
      "Bot mengirim tanggal sidang dan nomor register pada konteks perkara.",
    ],
    fixed: [
      "Berkas pendaftaran - dokumen bukti, dokumen gugatan, surat gugatan, surat kuasa - ditampilkan menunggu majelis, padahal e-Court tidak mengenal verifikasi untuk berkas itu sama sekali. Angka menunggu majelis membesar oleh dokumen yang tidak pernah menunggu apa pun.",
      "Tombol verifikasi hakim muncul untuk berkas pendaftaran. Seorang hakim dapat menekan Valid pada surat kuasa, dan ALETA mencatat keputusan hukum atas dokumen yang tidak punya padanan keputusan di sistem resmi.",
      "Kunci React diletakkan pada baris tabel di dalam fragmen, bukan pada fragmennya. React kehilangan jejak baris saat daftar disaring atau diurutkan ulang.",
      "Tiga skrip verifikasi menguji bentuk tulisan, bukan sifat yang dijaga - gagal setiap kali ada baris disisipkan walau sifatnya tidak berubah.",
    ],
    security: [
      "Bot MENOLAK verifikasi berkas pendaftaran di titik penyimpanan, sebelum menyentuh database. Menyembunyikan tombol di ekstensi bukan penjagaan: permintaan yang disusun sendiri tetap sampai ke bot, persis seperti pemeriksaan keanggotaan majelis yang sudah ada.",
      "Tabel Kendali Berkas menuntut sesi portal seperti halaman lain. Tanpa login, tidak ada satu pun berkas yang dapat diunduh.",
      "Berkas dialirkan dari server, tidak pernah diambil peramban langsung dari e-Court - sehingga sesi e-Court pengadilan tidak pernah keluar dari server.",
      "Tabel utama tidak memuat daftar dokumen. Arsip berisi ribuan dokumen, dan menampilkan seluruhnya sekaligus bukan hanya tidak terbaca, tetapi juga memajang judul dokumen perkara puluhan orang di satu layar.",
    ],
    operationalNotes: [
      "Perkara yang berkasnya belum lengkap akan terisi sendiri pada penarikan berikutnya - yang sudah lengkap tidak diminta ulang ke e-Court.",
      "Kolom Belum ada berarti dokumennya tercatat tetapi berkas PDF/Word-nya belum tersimpan di server. Umumnya sisa dari penarikan sebelum v1.25.2, ketika seluruh unduhan masih gagal.",
      "Ekstensi harus diunduh ulang dan dimuat ulang di chrome://extensions setelah pembaruan ini.",
    ],
    knownLimitations: [
      "Penandaan tidak_perlu berlaku pada dokumen yang ditarik SETELAH pembaruan ini. Berkas pendaftaran yang sudah tercatat sebelumnya masih berstatus belum sampai perkaranya ditarik ulang.",
      "Tabel menampilkan paling banyak seratus perkara sekali muat. Perkara lain dicari lewat kotak pencarian.",
    ],
  },
  {
    version: "1.26.0",
    title: "ALETA v1.26.0 - Berkas e-Court Menyelip di Baris Sidang SIPP",
    date: "2026-08-29",
    status: "Operasional",
    summary:
      "Ekstensi SIPP mendapat enam kemampuan baru: penanda per baris di halaman daftar, kepala panel dengan umur data dan nomor register, panel yang dapat digeser dan dilipat per bagian, tombol menitipkan penarikan, dan berkas e-Court yang menyelip langsung di baris Jadwal Sidang. Panel melayang tetap ada - keduanya berjalan bersamaan.",
    added: [
      "Berkas e-Court menyelip di baris Jadwal Sidang, pada sel yang sama dengan Unduh Dokumen BAS. Saklar tersendiri, bawaannya mati.",
      "Penanda per baris pada halaman Daftar Perkara: mana yang tenggatnya lewat, mendesak, atau menunggu majelis.",
      "Kepala panel: umur data ALETA, nomor register e-Court beserta tombol salin, dan ringkasan keadaan perkara.",
      "Bagian panel dapat dilipat sendiri-sendiri, keadaannya diingat per bagian.",
      "Panel dapat digeser dan posisinya diingat.",
      "Tombol Tarik dari e-Court untuk perkara yang datanya belum ada, dengan antrean di sisi bot.",
      "Tanda silang di kepala panel untuk mematikan ALETA seketika.",
      "Waktu pemberitahuan pihak, bukan sekadar sudah atau belum.",
      "Operasi ringkasan massal di bot: satu permintaan untuk seluruh baris halaman daftar.",
    ],
    changed: [
      "Nomor perkara dikumpulkan lebih dulu, bukan diambil yang pertama ditemukan. Halaman yang memuat lebih dari satu nomor perkara dikenali sebagai daftar.",
      "Bot mengirim nomor register e-Court dan tanggal sidang pada konteks perkara.",
      "Saklar induk dinamai Nyalakan ALETA di SIPP, bukan Tampilkan panel - ia mematikan panel maupun sisipan.",
      "Penjadwal mendahulukan permintaan titipan daripada penarikan menyeluruh.",
    ],
    fixed: [
      "Panel memuat perkara baris teratas ketika petugas membuka halaman Daftar Perkara, seolah perkara itu sedang dibuka - lengkap dengan keadaan verifikasi dan tombol verifikasi hakim untuk perkara yang keliru.",
      "Aturan pemeriksaan ekstensi menguji bentuk tulisan, bukan sifat yang dijaga. Dua di antaranya gagal hanya karena ada baris disisipkan, padahal sifatnya tidak berubah.",
    ],
    security: [
      "Ekstensi TIDAK BERJALAN sama sekali di halaman cetak dan templat SIPP. Cetak Relas membuka halaman yang alamatnya tetap di bawah /SIPP/, memuat tepat satu nomor perkara, sehingga panel akan muncul lalu ikut tercetak di relas panggilan - dokumen resmi yang disampaikan jurusita kepada pihak berperkara. Diperiksa paling awal, sebelum saklar mana pun dibaca.",
      "Lapisan kedua: aturan cetak menyembunyikan seluruh elemen ALETA bila petugas menekan Ctrl+P pada halaman SIPP biasa. Dua lapisan karena kegagalannya tidak setara - panel yang tidak muncul hanya merepotkan, sedangkan keterangan yang tercetak di dokumen pengadilan beredar ke luar dan tidak dapat ditarik kembali.",
      "Sisipan dicocokkan HANYA dengan tanggal sidang, tidak pernah menebak dari nama agenda. Agenda adalah teks bebas, dan berkas yang muncul di baris agenda yang keliru berarti hakim membuka berkas perkara yang salah - dengan letak yang tampak masuk akal, sehingga tidak ada yang menyadarinya.",
      "Sisipan selalu ditambahkan di AKHIR sel, tidak pernah di depan maupun di antara kontrol SIPP. Sel itu memuat tombol Unggah BAS yang mengunggah dokumen resmi.",
      "Sisipan bertanda ALETA secara terlihat. Tanpa penanda, berkas ALETA terbaca sebagai berkas SIPP dengan kedudukan yang sama seperti Dokumen BAS di sel yang sama.",
      "Ringkasan massal tidak memuat nomor telepon maupun nama pihak. Halaman daftar memuat puluhan perkara sekaligus, dan menandainya dengan data pribadi berarti memajang data puluhan orang di layar yang terlihat siapa saja yang lewat.",
      "Antrean permintaan dijaga tiga lapis: satu permintaan tertunda per perkara, jeda tiga puluh menit setelah selesai, dan batas panjang antrean. Tombol yang dapat ditekan siapa saja sesering apa pun mengarah ke bot yang menghantam sistem Mahkamah Agung berulang kali.",
      "Aturan pemeriksaan ekstensi dipertegas, bukan dilonggarkan: setiap kelas yang ditambahkan harus berawalan aleta-, atribut terbatas pada penanda ALETA dan aria-, dan setiap elemen yang disentuh harus DIBUKTIKAN dibuat ekstensi sendiri - bukan sekadar tercantum di daftar nama.",
      "Menyalin nomor register tidak lagi memakai textarea yang diisi lewat .value. Mengisi .value adalah satu-satunya cara ekstensi dapat menulis ke kolom formulir, dan kemampuan itu tidak dimilikinya sama sekali.",
    ],
    operationalNotes: [
      "Tiga saklar di popup ekstensi: Nyalakan ALETA di SIPP (menyala), Tandai halaman SIPP (mati), Sisipkan berkas ke Jadwal Sidang (mati).",
      "Panel melayang dan sisipan berjalan BERSAMAAN. Menyalakan sisipan tidak menghilangkan panel.",
      "Ekstensi harus diunduh ulang dari menu ALETA e-Court dan dimuat ulang di chrome://extensions setelah pembaruan ini.",
      "Sisipan hanya muncul pada baris sidang yang tanggalnya cocok dengan tanggal dokumen e-Court. Baris tanpa dokumen dibiarkan apa adanya.",
    ],
    knownLimitations: [
      "Riwayat lengkap pesan WhatsApp per perkara tidak dapat ditampilkan: tabel log pesan tidak punya kolom nomor perkara, dan kaitannya hanya lewat metadata berbentuk bebas. Yang ditampilkan adalah waktu pemberitahuan per dokumen e-Court, yang memang terkait secara struktur.",
      "Dokumen e-Court tanpa tanggal sidang tidak dapat disisipkan ke baris mana pun, dan hanya tampil di panel.",
      "Daftar halaman cetak yang dikecualikan disusun dari nama templat yang diketahui. Bila SIPP menambah templat cetak dengan nama lain, halaman itu belum ikut dikecualikan - tetapi aturan cetak pada lapisan kedua tetap menahan elemennya agar tidak tercetak.",
    ],
  },
  {
    version: "1.25.3",
    title: "ALETA v1.25.3 - Penarikan Menyeluruh yang Tahu Kapan Berhenti",
    date: "2026-08-29",
    status: "Operasional",
    summary:
      "Sesi e-Court yang habis di tengah putaran membuat jembatan terus meminta ratusan halaman yang semuanya berakhir di halaman login. Ditambah pelewatan perkara yang berkasnya sudah lengkap, penarikan tertarget satu perkara, dan skrip penarikan latar belakang yang tetap jalan setelah PuTTY ditutup.",
    added: [
      "Skrip aleta-ecourt-unduh-latar.sh: menarik seluruh berkas di latar belakang, tetap berjalan setelah sesi SSH ditutup, menolak berjalan dua kali bersamaan.",
      "Opsi --perkara untuk menarik satu perkara tertentu, menerima nomor perkara maupun nomor register.",
      "Opsi --paksa-ulang untuk memeriksa ulang walau berkasnya sudah lengkap.",
      "Perhitungan perkara yang dilewati karena berkasnya sudah lengkap.",
    ],
    changed: [
      "Perkara yang seluruh dokumennya sudah punya berkas dilewati TANPA halamannya dibuka. Untuk penarikan menyeluruh, ini membedakan ratusan permintaan ke server Mahkamah Agung dari beberapa menit memeriksa database sendiri.",
      "Batas waktu peramban dinaikkan ke lima menit, dapat diatur lewat ALETA_ECOURT_PROTOCOL_TIMEOUT_MS. Berkas satu sampai dua megabita pada jaringan pengadilan kerap melewati batas bawaan Puppeteer.",
      "Perkara yang alamatnya ketemu di sapuan tidak lagi dihitung sebagai tidak ditemukan hanya karena belum giliran diperiksa.",
    ],
    fixed: [
      "Sesi e-Court yang habis di tengah putaran tidak terdeteksi. Setiap halaman berikutnya menjadi halaman login tanpa nomor perkara, dan jembatan melaporkannya sebagai nomor perkara tidak ditemukan - lalu meneruskan ke perkara berikutnya. Pada penjalanan di server, 130 perkara diminta selama sembilan menit setelah sesi mati, semuanya tanpa hasil.",
      "Angka tidak ditemukan di e-Court mencampurkan perkara yang benar-benar hilang dengan perkara yang sekadar belum giliran diperiksa karena batas maks-perkara. Dari 171 yang dilaporkan, hanya 3 yang benar-benar tidak ada.",
      "Unduhan berkas besar gagal dengan pesan Runtime.callFunctionOn timed out, yang tidak menjelaskan berkas mana maupun mengapa.",
    ],
    security: [
      "Penarikan BERHENTI begitu sesi habis, tidak diteruskan. Meminta ratusan halaman ke sistem Mahkamah Agung dalam keadaan tidak terautentikasi adalah persis perilaku yang membuat akun ditandai - dan tidak menghasilkan apa pun.",
      "Perkara yang masih punya dokumen belum diverifikasi majelis TIDAK dilewati walau berkasnya sudah ada. Pihak dapat mengunggah perbaikan berjudul sama, dan melewatinya berarti melewatkan perbaikan itu.",
      "Perkara yang belum pernah tercatat tidak pernah dilewati. Tidak adanya catatan bukan bukti tidak adanya dokumen.",
      "Skrip latar menolak berjalan dua kali bersamaan. Dua proses yang menarik perkara sama hanya menggandakan beban di server Mahkamah Agung tanpa mempercepat apa pun.",
    ],
    operationalNotes: [
      "Untuk mengisi arsip dari nol: bash /var/www/html/aleta/scripts/aleta-ecourt-unduh-latar.sh - lalu PuTTY boleh ditutup.",
      "Aman dijalankan berulang. Perkara yang sudah lengkap tidak diminta lagi ke e-Court.",
      "Bila berhenti dengan kode 2, sesinya habis. Login sekali dari menu Integrasi e-Court, lalu jalankan lagi - yang sudah terunduh tidak diulang.",
      "Setelah arsip terisi, nyalakan penarikan berkala agar perkara baru terambil sendiri.",
    ],
    knownLimitations: [
      "Menarik satu perkara tetap memerlukan penyapuan daftar lebih dulu, karena alamat e-Court berupa blob terenkripsi yang tidak dapat disusun. Penarikan tertarget karena itu tetap memakan satu sampai tiga menit.",
      "Belum ada penarikan atas permintaan dari halaman SIPP. Perkara yang dibuka petugas tetapi datanya belum ada harus menunggu putaran berikutnya.",
    ],
  },
  {
    version: "1.25.2",
    title: "ALETA v1.25.2 - Berkas Pendaftaran Ikut Diperbaiki",
    date: "2026-08-29",
    status: "Operasional",
    summary:
      "Berkas pendaftaran tetap gagal diunduh setelah v1.25.1 karena bagian itu memakai pengurai tersendiri yang belum ikut diperbaiki. Sapuan daftar dan penghubungan dokumen ke perkara SIPP sudah terbukti bekerja di server.",
    added: [],
    changed: [
      "Berkas pendaftaran memakai mekanisme penanda yang sama dengan dokumen persidangan.",
      "Format berkas pendaftaran ditentukan dari judulnya - SURAT GUGATAN (Docx/Rtf) dikenali sebagai Word - bukan dari nomor jenis dokumen milik e-Court yang dapat berubah tanpa pemberitahuan.",
    ],
    fixed: [
      "Seluruh berkas pendaftaran gagal diunduh dengan jawaban HTML. Bagian ini punya pengurai sendiri yang terpisah dari dokumen persidangan, sehingga perbaikan v1.25.1 tidak menyentuhnya sama sekali: href pagar masih disusun menjadi alamat beranda e-Court, dan yang terambil adalah halaman, bukan berkas.",
      "Dua contoh HTML pada skrip verifikasi memakai bentuk karangan yang tidak pernah ada di e-Court, sehingga lolos sambil menguji sesuatu yang tidak nyata.",
    ],
    security: [
      "Halaman detail tetap tidak pernah diklik. Berkas pendaftaran diambil lewat jalur yang sama dengan dokumen persidangan, seluruhnya dengan fetch.",
      "Hanya pemanggilan view_doc yang diakui sebagai tautan berkas. Tombol Batal Verifikasi dan Hapus Tundaan Sidang memakai bentuk href pagar yang sama persis, dan tidak dapat tertangkap sebagai dokumen.",
    ],
    operationalNotes: [
      "Sapuan daftar dan penghubungan ke perkara SIPP sudah terbukti di server: 1051 perkara terbaca dari e-Court, 197 cocok dengan SIPP, dan seluruh dokumen tersimpan dengan perkara_id resmi.",
      "Jalur dokumen persidangan - jawaban, replik, duplik, kesimpulan - BELUM pernah teruji, karena perkara yang tercoba semuanya perkara baru yang belum bersidang. Jalankan dengan maks-perkara lebih besar agar perkara lama ikut terjaring.",
    ],
    knownLimitations: [
      "Penanda dokumen dibaca dari pemanggilan view_doc pada halaman. Bila e-Court mengganti nama fungsi itu, dokumen tidak akan terbaca - tetapi kegagalannya jelas, bukan diam-diam.",
    ],
  },
  {
    version: "1.25.1",
    title: "ALETA v1.25.1 - Berkas e-Court Akhirnya Terunduh",
    date: "2026-08-29",
    status: "Operasional",
    summary:
      "Unduhan berkas e-Court gagal seluruhnya karena tautan PDF ber-href pagar dan dijalankan JavaScript, bukan alamat berkas. Sapuan daftar juga tidak pernah berpindah halaman karena menunggu dengan waktu tetap. Keduanya ketahuan dari penjalanan sungguhan di server dan sudah diperbaiki.",
    added: [
      "Penukar penanda dokumen menjadi alamat berkas lewat ViewDoc, tanpa mengklik apa pun.",
      "Skrip verifikasi unduhan e-Court dengan 25 pemeriksaan.",
    ],
    changed: [
      "Sapuan daftar menunggu tabel benar-benar berganti isi, bukan menunggu sekian detik. Penanda Processing DataTables dihormati, dengan batas 20 detik yang dapat diatur lewat ALETA_ECOURT_TUNGGU_TABEL_MS.",
      "Halaman yang tidak menyumbang satu pun baris baru menghentikan sapuan, alih-alih memutar sampai 40 halaman tanpa hasil.",
      "Jumlah baris baru dilaporkan per halaman, sehingga sapuan yang tidak berpindah langsung terlihat.",
      "Bidang url lama pada dokumen diisi alamat yang memang ada, bukan alamat kosong milik PDF.",
    ],
    fixed: [
      "Seluruh unduhan berkas gagal dengan pesan sesi habis, padahal sesinya sehat. Tautan PDF di e-Court berbentuk href pagar dengan onclick view_doc(tipe,id); yang dijalankan sebenarnya POST ViewDoc/index yang menjawab dengan alamat berkas di storage. Pengurai lama hanya mencari href biasa, sehingga PDF tidak pernah terunduh sama sekali - dan href pagar yang diresolusi peramban menjadi alamat halaman sempat terambil sebagai alamat berkas, menghasilkan HTML.",
      "Berkas Word tidak dikenali. Alamatnya sudah langsung tersedia di href ViewDoc/tampil_word, tetapi digolongkan keliru oleh pengurai lama.",
      "Sapuan daftar tidak pernah berpindah halaman. Jeda tetap 1,2 detik membuat pembacaan terjadi sebelum tabel selesai menggambar ulang, sehingga isi halaman pertama terbaca berulang. Empat puluh halaman terbaca, totalnya tetap sepuluh - dan tidak terlihat sebagai error sama sekali.",
      "Daftar Permohonan menghasilkan nol baris karena tabelnya belum tergambar saat dibaca.",
      "Uji arsip memakai contoh HTML karangan yang bentuknya tidak pernah ada di e-Court, sehingga lolos sambil menguji sesuatu yang tidak nyata.",
    ],
    security: [
      "Halaman detail tetap TIDAK PERNAH diklik. Seluruh unduhan berjalan lewat fetch, termasuk langkah penukaran penanda. Tombol Batal Verifikasi dan Hapus Tundaan Sidang tidak tersentuh.",
      "Permintaan penukaran memang bernama POST, tetapi tanpa badan permintaan sama sekali. Ia hanya menanyakan lokasi berkas, tidak mengubah apa pun di sistem resmi.",
      "Alamat berkas yang dijawab e-Court harus tetap berada di dalam ecourt.mahkamahagung.go.id. Jawaban yang mengarah ke tempat lain tidak diikuti, karena mengikutinya berarti membawa sesi login pengadilan keluar.",
      "Tautan Hapus Tundaan Sidang dan Batal Verifikasi tidak dapat tertangkap sebagai dokumen. Keduanya memakai bentuk href pagar yang sama, dan hanya pemanggilan view_doc yang diakui.",
    ],
    operationalNotes: [
      "Uji dengan perkara yang dokumennya lengkap, misalnya 620/Pdt.G/2025/PA.Dgl yang memuat gugatan, jawaban, replik, duplik, dan kesimpulan.",
      "Yang harus berubah dari penjalanan sebelumnya: halaman sapuan benar-benar berpindah, berkas benar-benar terunduh, dan jumlah perkara yang tidak ditemukan turun jauh.",
      "Bila masih ada yang gagal, pesannya kini menyebutkan apa yang benar-benar diterima - tipe isi dan cuplikan jawabannya - bukan menebak sebabnya.",
    ],
    knownLimitations: [
      "Penanda dokumen dibaca dari pemanggilan view_doc pada halaman. Bila e-Court mengganti nama fungsi itu, dokumen tidak akan terbaca - tetapi kegagalannya jelas, bukan diam-diam.",
      "Jenis dokumen pada penanda tidak ditafsirkan, hanya diteruskan apa adanya ke e-Court.",
    ],
  },
  {
    version: "1.25.0",
    title: "ALETA v1.25.0 - SIPP Menjadi Acuan Penarikan e-Court",
    date: "2026-08-29",
    status: "Operasional",
    summary:
      "Jembatan e-Court tidak lagi menarik perkara dari tautan yang kebetulan ada di halaman. SIPP kini menentukan perkara mana yang harus ditarik lewat nomor register, dokumen tersimpan dengan perkara_id resmi, dan perkara yang terlewat dilaporkan alih-alih hilang diam-diam. Ditambah Kamus Database SIPP yang terisi sendiri dari SIPP yang sedang berjalan.",
    added: [
      "Operasi ecourt.caseList: daftar perkara e-Court menurut SIPP, menempuh perkara ke perkara_efiling_id ke perkara_efiling.nomor_register.",
      "Tombol Selaraskan dari SIPP pada Pengaturan ALETA x SIPP: mengisi Kamus Database SIPP langsung dari information_schema, tanpa berkas apa pun.",
      "Modul navigasi e-Court: membaca menu Daftar Perkara dari halaman, menyapu daftar tiap kategori, dan mencari satu perkara lewat kotak pencarian.",
      "Kolom perkara_id dan nomor_register pada tabel dokumen e-Court.",
      "Laporan selisih SIPP dan e-Court pada tiap putaran penarikan, ikut tersimpan di catatan putaran.",
      "Batas waktu putaran penarikan, dapat diatur lewat ALETA_BOT_ECOURT_BATAS_PUTARAN_MS.",
      "Tiga skrip verifikasi baru: penjadwal tidak macet, introspeksi SIPP, dan navigasi e-Court.",
    ],
    changed: [
      "Alur perkara diambil sebagai data dari SIPP - Pdt.G ke Gugatan, Pdt.P ke Permohonan, Pdt.G.S ke Gugatan Sederhana, JN ke Jinayat - bukan diurai dari teks nomor perkara.",
      "Perkara dengan lebih dari satu pendaftaran e-Court memakai pendaftaran TERBARU, sesuai ketetapan pimpinan. Pendaftaran lama tidak dibuang diam-diam, jumlahnya dilaporkan.",
      "Jumlah entri per halaman daftar dinaikkan ke nilai terbesar yang ditawarkan halaman, sehingga 867 perkara selesai dalam sekitar sembilan kali muat alih-alih 87.",
      "Hanya kategori yang benar-benar dibutuhkan yang dibuka. Menu yang tidak dipakai pengadilan tidak disentuh.",
    ],
    fixed: [
      "Penjadwal e-Court dapat macet PERMANEN. Bila halaman pendaratan tidak memuat tautan perkara, jembatan menunggu tombol Enter - padahal penjadwal menjalankannya dengan stdin ditutup, sehingga Enter tidak akan pernah datang. Prosesnya menggantung selamanya dan seluruh putaran berikutnya dilewati dengan alasan putaran sebelumnya belum selesai, tanpa pesan error apa pun.",
      "Kamus Database SIPP hanya dapat diisi dari berkas dump SQL yang jalurnya tertanam ke folder Windows pengembang, sehingga fiturnya praktis mati di server.",
      "Dokumen e-Court hanya dikaitkan ke perkara lewat nomor perkara sebagai teks, rapuh terhadap beda spasi, titik, dan huruf besar-kecil.",
      "Perkara yang tidak muncul di halaman e-Court terlewat tanpa jejak - tidak ada satu pun angka yang berubah dan tidak ada pesan apa pun.",
      "Tiruan botDb pada tiga skrip verifikasi lama tertinggal dari modul aslinya.",
    ],
    security: [
      "Klik HANYA diizinkan di halaman daftar, tidak pernah di halaman detail perkara. Halaman detail memuat tombol Batal Verifikasi dan Hapus Tundaan Sidang yang mengubah keadaan resmi perkara, dan satu klik yang salah akan tercatat sebagai perbuatan hakim pemilik akun. Berkas tetap diambil dengan fetch ke alamatnya, bukan dengan mengklik.",
      "Pencarian hanya menerima kecocokan PERSIS pada nomor register. Pencarian DataTables mencocokkan sebagian, dan mengambil baris pertama begitu saja berarti menarik dokumen perkara yang salah lalu mengirimkannya ke pihak yang salah.",
      "Gugatan Sederhana tidak dapat tertukar dengan Gugatan. Pencocokan menu dibuat simetris, bukan sekadar mengandung kata - kalau tidak, perkara ditarik dari daftar yang keliru begitu urutan menu berubah.",
      "Introspeksi SIPP hanya membaca information_schema: nama tabel, kolom, tipe, dan komentar. Tidak ada satu pun baris data perkara yang dibaca - tidak ada nama, alamat, maupun NIK.",
      "Nama skema tidak boleh datang dari luar. Bot memakai DATABASE() milik koneksinya sendiri, agar tidak ada jalan membaca struktur database lain di server MySQL yang sama.",
      "Penyelarasan kamus TIDAK menimpa tulisan manusia. Nama manusiawi dan penjelasan yang sudah diisi petugas dipertahankan; hanya fakta struktural yang disegarkan. Tabel yang hilang dari SIPP ditandai tidak aktif, tidak dihapus.",
      "Acuan SIPP gagal-terbuka. Bila SIPP atau menu tidak terbaca, penarikan tetap berjalan seperti sebelumnya - menolak menarik dokumen hanya karena SIPP sedang tidak terjangkau berarti dokumen yang tenggatnya besok tidak sampai ke pihak.",
    ],
    operationalNotes: [
      "Urutan pembuktian setelah pemasangan: login e-Court, lalu Selaraskan dari SIPP, lalu jalankan jembatan sekali sambil mengawasi keluarannya.",
      "Baris Menyapu daftar pada keluaran jembatan adalah buktinya. Bila yang muncul justru Menu Daftar Perkara tidak terbaca, berarti submenu e-Court bukan tautan biasa dan navigasinya perlu disesuaikan - penarikan tetap berjalan dengan cara lama.",
      "Penyelarasan kamus yang berhasil menampilkan sekitar 470 tabel dan 125 view untuk SIPP peradilan agama.",
      "Nyalakan penarikan berkala hanya setelah satu putaran manual terbukti benar. Mulai dari jarak 4 jam dan 25 perkara per putaran.",
    ],
    knownLimitations: [
      "Navigasi menu dibangun dengan asumsi submenu Daftar Perkara berupa tautan biasa yang alamatnya terbaca dari halaman. Asumsi ini belum diuji pada e-Court sungguhan.",
      "Alamat halaman e-Court berupa blob terenkripsi, sehingga ALETA tidak dapat menyusun alamat satu perkara dan harus selalu menemukannya lewat halaman daftar.",
      "Penarikan berjalan atas nama akun e-Court yang dipakai login. Bila itu akun hakim, seluruh aktivitas tercatat atas namanya, dan penegasan gerbang akan memutus sesinya di perangkat lain.",
    ],
  },
  {
    version: "1.24.4",
    title: "ALETA v1.24.4 - Halaman Gerbang e-Court Dilewati",
    date: "2026-08-29",
    status: "Operasional",
    summary:
      "Login e-Court dengan sandi dan captcha yang benar tetap ditolak, karena e-Court menyelipkan halaman penegasan /GateLogin yang tidak pernah dilewati. Ditambah pesan error yang menyebutkan sebabnya, bukan sekadar HTTP 400.",
    added: [
      "Penanganan halaman gerbang /GateLogin: bot menekan tombol Lanjut, lalu menunggu halaman berikutnya.",
      "Skrip verifikasi baru untuk penentuan keberhasilan login, 19 pemeriksaan tanpa menyentuh jaringan.",
    ],
    changed: [
      "Keberhasilan login ditentukan tiga tanda: halaman gerbang dilewati lebih dulu, lalu alamat halaman seperti sebelumnya, lalu tidak adanya lagi kolom sandi di halaman.",
      "Periksa Sesi membedakan gerbang dari sesi kedaluwarsa. Mendarat di gerbang berarti sesinya masih ada dan hanya menuntut penegasan - bukan alasan untuk menyuruh petugas mengulang login.",
      "Kegagalan login menyertakan jalur halaman tempat peramban mendarat, tanpa query - query dapat memuat token sesi.",
    ],
    fixed: [
      "Login e-Court gagal dengan HTTP 400 walau email, sandi, dan captcha benar. e-Court kerap menyelipkan halaman /GateLogin - pemberitahuan bahwa akun sedang dipakai di perangkat lain, dengan tombol Batal dan Lanjut. Sesi baru terbentuk setelah Lanjut ditekan, dan halaman itu tidak pernah dilewati. Mengulang dengan sandi yang benar pun gagal lagi dengan cara yang sama.",
      "Periksa Sesi melaporkan sesi kedaluwarsa padahal sesinya masih ada, karena halaman gerbang dibaca sebagai bukan-halaman-masuk.",
      "Pesan kegagalan dari ALETA Bot dibuang di tengah jalan. Bot menjawab dengan alasan yang jelas, tetapi portal hanya membaca kolom error dan message - bukan alasan - sehingga yang sampai ke petugas hanyalah HTTP 400.",
      "Kode alasan berawalan seperti gagal_membuka dan folder_sesi_gagal tidak tercocokkan ke kalimat yang dapat dipahami, dan tampil apa adanya.",
    ],
    security: [
      "Jalur pendaratan dicatat TANPA query. Query pada halaman setelah login dapat memuat token sesi, dan token itu tidak boleh masuk ke log maupun ke layar.",
      "Di halaman gerbang, HANYA tombol bertuliskan tepat Lanjut yang ditekan. Batal tidak pernah disentuh, dan tidak ada tombol lain di halaman itu yang ditekan. Bila tombol Lanjut tidak ditemukan, bot menyerah dan melapor - tidak menebak dengan menekan tombol lain.",
      "Periksa Sesi TIDAK menekan tombol apa pun di gerbang. Memeriksa keadaan tidak boleh memutus sesi orang di perangkat lain; penegasan hanya dilakukan saat petugas benar-benar meminta login dari portal.",
      "Halaman gerbang tidak pernah dianggap sudah masuk. Ia tidak memuat kolom sandi, sehingga tanpa penjagaan ini aturan tanda kedua akan menyimpulkan berhasil padahal sesinya masih kosong - dan kegagalannya baru ketahuan saat jembatan dijalankan.",
      "Badan permintaan login tetap tidak dicatat sama sekali - bukan ke log akses, bukan ke pesan error, bukan ke jejak keamanan.",
    ],
    operationalNotes: [
      "Menekan Lanjut MEMUTUS sesi e-Court di perangkat lain. Itu memang yang diminta halaman itu, dan petugas yang membuka login dari portal sedang meminta sesi di server ini - tetapi perlu diketahui bila ada petugas lain yang sedang memakai akun yang sama.",
      "e-Court juga memperingatkan bila kata sandi sudah lama tidak diganti. Peringatan itu tidak menghalangi login dan tidak ditangani ALETA; penggantian sandi dilakukan sendiri lewat halaman Edit Profil di e-Court.",
      "Bila login masih gagal setelah pembaruan ini, pesannya kini menyebutkan jalur halaman tempat peramban mendarat. Kirimkan jalur itu - dari situ dapat dipastikan apakah e-Court benar menolak, atau ada halaman antara yang belum dikenali.",
      "Log bot dapat dibaca dengan: docker logs --tail 50 aleta-bot",
    ],
    knownLimitations: [
      "Yang ditangani baru halaman gerbang /GateLogin. Bila e-Court menambahkan halaman antara lain yang juga menuntut penegasan dan tidak memuat kolom sandi, halaman itu akan dianggap sudah masuk - dan kegagalannya baru ketahuan saat jembatan dijalankan, bukan saat login.",
      "Tombol Lanjut dicari dari tulisannya. Bila e-Court mengganti tulisan tombol itu, gerbang tidak akan terlewati - tetapi kegagalannya jelas dan disebutkan namanya, bukan gagal diam-diam.",
    ],
  },
  {
    version: "1.24.3",
    title: "ALETA v1.24.3 - Login e-Court Berhasil dan SIPP Dapat Ditandai",
    date: "2026-08-28",
    status: "Operasional",
    summary:
      "Login e-Court tidak pernah dapat berhasil karena portal menyerah di detik ke-8 sementara bot masih meluncurkan peramban. Ditambah menu Integrasi e-Court di sidebar admin, petunjuk pemasangan ekstensi yang benar, dan saklar untuk menandai halaman SIPP.",
    added: [
      "Menu Integrasi e-Court di sidebar Pengaturan Admin, pada kelompok Layanan & Integrasi.",
      "Tombol Buka Integrasi e-Court di halaman ALETA e-Court, hanya bagi Super Admin dan Admin.",
      "Saklar Tandai halaman SIPP pada ekstensi: menempelkan sisa hari tenggat unggah e-Court dan keadaan nomor pihak langsung di dalam halaman SIPP. Bawaannya mati.",
    ],
    changed: [
      "Batas waktu pemanggilan ke ALETA Bot kini per-jenis: 8 detik untuk pembacaan biasa, 90 detik untuk yang meluncurkan peramban, 120 detik untuk yang menyentuh banyak berkas.",
      "Nginx diberi proxy_read_timeout 120 detik, karena batas bawaannya 60 detik memutus login e-Court dari sisi peramban.",
      "Apache diberi timeout=120 pada ProxyPass /aleta, dengan sebab yang sama. Batasnya sengaja ditaruh pada ProxyPass dan bukan sebagai ProxyTimeout global, karena server yang sama juga melayani SIPP.",
      "Petunjuk pemasangan ekstensi menyebutkan bahwa berkas ZIP harus diekstrak lebih dulu, dan bahwa klik dua kali pada ZIP di Windows tidak mengekstrak apa pun.",
    ],
    fixed: [
      "Login e-Court selalu gagal dengan pesan aleta bot tidak merespons dalam 8000ms. Bot sebenarnya sehat dan sedang bekerja: ia meluncurkan Puppeteer, membuka halaman Mahkamah Agung, lalu memotret captchanya - dan batas navigasinya sendiri 60 detik. Portal menyerah jauh sebelum itu, sehingga login tidak akan pernah berhasil berapa kali pun dicoba.",
      "Periksa Sesi mode penuh dan pembersihan arsip gagal dengan sebab yang sama.",
      "Halaman pengaturan e-Court tidak tertaut dari sidebar admin mana pun, sehingga hanya dapat dicapai dengan mengetik alamatnya sendiri.",
      "Akhir baris berkas ekstensi tercampur CRLF dan LF dalam satu berkas.",
    ],
    security: [
      "Penandaan halaman SIPP HANYA MENAMBAH. Tidak ada teks, nilai, atribut, atau susunan milik SIPP yang diubah; tidak ada tombol yang ditekan; tidak ada apa pun yang dikirim. Yang tercatat di sistem resmi harus selalu hasil perbuatan manusia.",
      "Seluruh sisipan bertanda data-aleta-tanda sehingga dapat dicabut seutuhnya. Mematikan saklarnya mengembalikan halaman seperti semula tanpa memuat ulang.",
      "Bawaannya MATI. Menyisipkan tanda ke halaman kerja orang tanpa mereka minta bukan keputusan yang pantas diambil sendiri oleh sebuah pembaruan.",
      "Login e-Court tetap hanya di halaman admin. Halaman ALETA e-Court terbuka untuk seluruh pegawai, dan sandi akun e-Court pengadilan tidak pantas berada di layar yang semua orang buka - yang ditambahkan di sana hanya tautan bagi yang berhak.",
      "Aturan pemeriksaan ekstensi dilonggarkan hanya pada MEMBACA halaman SIPP, yang memang dibutuhkan untuk menempelkan tanda. Batas penulisannya justru dipertegas dengan tujuh pemeriksaan baru.",
    ],
    operationalNotes: [
      "Reverse proxy di host TIDAK disentuh installer, dan memang tidak boleh - berkas yang sama kerap melayani SIPP. Perbaikan batas waktu di deploy/nginx dan deploy/apache hanya berlaku untuk pemasangan baru.",
      "Server yang memakai Apache: tambahkan timeout=120 di ujung baris ProxyPass /aleta pada berkas conf.d yang mengatur ALETA, lalu httpd -t dan systemctl reload httpd.",
      "Server yang memakai Nginx: tambahkan proxy_read_timeout 120s dan proxy_send_timeout 120s pada blok location /aleta/ dan location = /aleta.",
      "Tanpa langkah itu, login e-Court masih akan terputus di detik ke-60 dari sisi peramban sekalipun portal sudah sabar 90 detik.",
      "Saklar Tandai halaman SIPP ada di popup ekstensi, bukan di portal. Setiap petugas mengaturnya sendiri di komputernya.",
      "Bagian Dokumen e-Court pada panel ekstensi akan tetap kosong sampai jembatan dijalankan sekali. Panel bukan sedang rusak - memang belum ada dokumen yang ditarik.",
    ],
    knownLimitations: [
      "Jalankan Sekarang pada penjadwal masih menunggu seluruh putaran selesai dalam satu permintaan HTTP. Untuk jumlah perkara besar, itu dapat melewati batas waktu proxy sekalipun penarikannya sendiri tetap berjalan sampai selesai di server.",
      "Penandaan mencocokkan nama pihak pada teks sel tabel SIPP. Nama yang tertulis berbeda antara SIPP dan e-Court tidak akan tertandai - dibiarkan tanpa tanda, bukan ditandai pada baris yang salah.",
    ],
  },
  {
    version: "1.24.2",
    title: "ALETA v1.24.2 - Penghubung e-Court Tersambung dan Disk Terjaga",
    date: "2026-08-28",
    status: "Operasional",
    summary:
      "Seluruh panggilan portal ke ALETA Bot untuk e-Court salah alamat sehingga selalu dijawab halaman 404 - tidak satu pun fitur e-Court pernah berfungsi. Ditambah penjagaan ruang disk dan pembersihan cache build otomatis di installer.",
    added: [
      "Pemeriksaan ruang disk di awal installer, pada folder data Docker dan folder aplikasi sekaligus.",
      "Petunjuk pelapangan ruang yang langsung dapat disalin bila pemeriksaan gagal.",
      "Batas minimum dapat diturunkan lewat ALETA_MIN_GB_DOCKER bila operator memang sudah yakin.",
      "Pembersihan cache build Docker otomatis setelah container terbukti jalan, dengan jalan keluar ALETA_SKIP_PRUNE=1.",
    ],
    changed: [],
    fixed: [
      "Seluruh 25 alamat yang dipakai portal untuk memanggil ALETA Bot - status penghubung, verifikasi hakim, login e-Court, penjadwal, arsip, pengaturan, konteks SIPP, dan unduhan berkas - kehilangan segmen /aleta-bot sehingga dijawab halaman 404 HTML, bukan data. Halaman ALETA e-Court menampilkan error alih-alih keadaan penghubung.",
      "Unduhan berkas dari SIPP juga salah alamat, dengan sebab yang sama.",
      "Installer berhenti di tengah rebuild dengan pesan no space left on device, setelah kode baru terlanjur tersalin sehingga aplikasi tertinggal setengah jalan: kode baru dengan container lama.",
      "Cache build Docker tidak pernah dibuang dan menumpuk sampai 119 GB dari tujuh kali pembaruan, memenuhi partisi 200 GB tempat database ALETA ikut tersimpan.",
    ],
    security: [
      "Pemeriksaan ini gagal-tertutup: bila ruang disk tidak terbaca, angkanya dianggap nol dan installer menolak berjalan. Yang tidak dapat dipastikan tidak boleh diteruskan ke rebuild.",
      "Installer tidak menghapus apa pun sendiri. Perintah pembersihan hanya ditampilkan untuk dijalankan operator, karena yang boleh dibuang dari server pengadilan bukan keputusan yang pantas diambil oleh skrip.",
    ],
    operationalNotes: [
      "Bila installer menolak jalan, aplikasi yang sedang berjalan sama sekali tidak tersentuh - tidak ada berkas yang diubah dan tidak ada container yang dihentikan.",
      "Batas bawaannya 8 GB pada folder data Docker dan 2 GB pada folder aplikasi. Build portal membongkar node_modules Next.js yang besar, jadi ruang kosong yang tampak cukup sering ternyata tidak.",
    ],
    knownLimitations: [
      "Pemeriksaan hanya dilakukan di awal. Bila ada proses lain yang menghabiskan disk selama rebuild berlangsung, build tetap dapat gagal.",
      "Pembersihan cache build tidak terbagi per proyek: pada server yang juga menjalankan aplikasi Docker lain, cache build aplikasi itu ikut terbuang. Tidak ada data yang hilang, hanya build berikutnya jadi lebih lambat sekali.",
    ],
  },
  {
    version: "1.24.1",
    title: "ALETA v1.24.1 - Menu ALETA e-Court Akhirnya Muncul",
    date: "2026-08-28",
    status: "Operasional",
    summary:
      "Menu ALETA e-Court sudah dibuat sejak v1.22.0, tetapi tidak pernah terlihat oleh siapa pun - termasuk Super Admin - karena kekeliruan pendaftaran. Rilis ini memunculkannya.",
    added: [
      "Pintu masuk Integrasi e-Court pada halaman Menu Admin.",
    ],
    changed: [
      "Halaman pengaturan e-Court kini dijaga berdasarkan peran, sama seperti halaman admin ALETA Bot.",
    ],
    fixed: [
      "Kartu ALETA e-Court tidak muncul di beranda portal. Aplikasinya terdaftar di daftar modul, bukan di daftar aplikasi portal yang dibaca beranda, sehingga tidak pernah ditampilkan kepada peran mana pun sejak v1.22.0.",
      "Halaman pengaturan e-Court selalu menolak semua orang, termasuk Super Admin, karena memeriksa id aplikasi yang tidak pernah ada di daftar aplikasi portal.",
      "Seluruh 18 peran kini diberi akses ALETA e-Court, mengikuti peran yang sama dengan ALETA Bot.",
      "Saklar Integrasi e-Court di pengaturan modul dibuang karena tidak mengendalikan apa pun.",
    ],
    security: [
      "Tidak ada kelonggaran akses baru. Halaman pengaturan tetap hanya untuk Super Admin dan Admin; halaman pengguna hanya berisi unduhan ekstensi dan tampilan keadaan, tanpa pengaturan apa pun.",
    ],
    operationalNotes: [
      "Tidak ada langkah tambahan setelah pemasangan. Menu ALETA e-Court langsung muncul di beranda portal bagi seluruh pegawai, dan Integrasi e-Court muncul di Menu Admin.",
      "Bila menu masih belum terlihat setelah pemasangan, muat ulang halaman dengan Ctrl+F5 - beranda portal disimpan sementara di peramban.",
    ],
    knownLimitations: [
      "Rilis ini hanya memunculkan menunya. Fitur di dalamnya tidak berubah sama sekali dari v1.24.0.",
    ],
  },
  {
    version: "1.24.0",
    title: "ALETA v1.24.0 - Verifikasi dari SIPP dan Masa Simpan Arsip",
    date: "2026-08-26",
    status: "Operasional",
    summary:
      "Hakim kini dapat memverifikasi dokumen langsung dari halaman perkara di SIPP, tanpa berpindah aplikasi. Ditambah penjagaan ruang disk dan tempat menetapkan berapa lama salinan berkas pihak disimpan.",
    added: [
      "Tombol Valid dan Tidak Valid pada panel SIPP, hanya untuk hakim yang duduk pada majelis perkara tersebut.",
      "Penjagaan ruang disk: penarikan berhenti sendiri sebelum ruang habis, dengan kode keluar tersendiri.",
      "Pengaturan masa simpan arsip beserta angka yang dibutuhkan untuk menetapkannya: besar arsip sekarang dan berapa yang akan terhapus.",
      "Pembersihan berkas kedaluwarsa dengan konfirmasi dua langkah.",
    ],
    changed: [
      "Kartu Ruang dan Masa Simpan diletakkan setelah penjadwal, karena penarikan berhenti sendiri bila ruangnya menipis.",
    ],
    fixed: [],
    security: [
      "Verifikasi dari SIPP TIDAK mendapat kelonggaran apa pun. Nama hakim selalu dari akun yang login, keanggotaan majelis diperiksa ulang di bot tepat sebelum menyimpan, dan konfirmasi kedua tetap dituntut. Tombol yang dipaksa muncul di halaman SIPP pun tidak menghasilkan apa-apa bila hakimnya bukan majelis perkara itu.",
      "Izin verifikasi ditentukan server, bukan ditebak ekstensi. Ekstensi hanya menampilkan tombol berdasarkan jawaban itu.",
      "Tombol pertama tidak menyentuh jaringan sama sekali - ia hanya membuka pertanyaan. Ini keputusan hukum, dan satu jempol yang salah pencet di layar sempit tidak boleh menghasilkan keputusan seperti itu.",
      "Masa simpan bawaannya NOL - tidak menghapus apa pun. Berapa lama pengadilan menyimpan salinan berkas pihak di luar sistem resmi bukan keputusan yang pantas diambil oleh kode.",
      "Yang dihapus hanya BERKASNYA, bukan catatannya. Riwayat tetap utuh: dokumen apa pernah ada, kapan diunggah, siapa yang memverifikasi, kapan diberitahukan.",
      "Hanya berkas yang sudah diverifikasi majelis DAN sudah diberitahukan ke pihak yang dihapus. Yang belum masih dibutuhkan, dan menariknya ulang mungkin sudah terlambat karena tenggatnya lewat.",
      "Jalur berkas diperiksa berada di dalam folder arsip sebelum dihapus, sehingga baris database yang keliru tidak berujung menghapus berkas lain di server.",
      "Ruang disk yang tidak terbaca diperlakukan sebagai TIDAK BOLEH, bukan sebagai cukup. Disk penuh di server pengadilan tidak hanya menghentikan ALETA - ia menghentikan MySQL, dan itu menghentikan SIPP.",
    ],
    operationalNotes: [
      "Hakim membuka perkara di SIPP, membaca dokumennya lewat tombol unduh, lalu menekan Valid atau Tidak Valid pada panel ALETA di sisi kanan.",
      "Menetapkan masa simpan: Integrasi e-Court → Ruang dan Masa Simpan → isi jumlah bulan → Simpan. Nol berarti tidak menghapus apa pun.",
      "Setelah masa simpan ditetapkan, angka berkas yang melewatinya muncul beserta besarnya, sebelum apa pun dihapus.",
      "Petugas perlu mengunduh ulang ekstensi setelah pembaruan ini, karena tombol verifikasinya baru.",
    ],
    knownLimitations: [
      "Pembersihan arsip dijalankan manual dari portal, belum terjadwal. Ini disengaja untuk sementara: penghapusan berkas perkara sebaiknya diawasi manusia dulu sampai ketetapan masa simpannya terbukti tepat.",
      "Masa simpan dihitung dari kapan berkas diunduh, bukan dari kapan perkara berkekuatan hukum tetap. Data itu ada di SIPP dan belum dipakai.",
      "Batas ukuran berkas baru tersimpan sebagai pengaturan; jembatan belum memakainya untuk melewati berkas besar.",
    ],
  },
  {
    version: "1.23.0",
    title: "ALETA v1.23.0 - Unduh Berkas dari SIPP dan Penarikan Berkala",
    date: "2026-08-26",
    status: "Operasional",
    summary:
      "Dokumen e-Court kini dapat diunduh langsung dari panel di halaman SIPP, tanpa membuka e-Court di tab lain. Penarikan berkas juga dapat berjalan berkala sendiri - selama sesi e-Court masih berlaku, dan berhenti sopan ketika habis.",
    added: [
      "Tombol unduh PDF dan Word pada tiap dokumen di panel SIPP. Panitera tidak perlu lagi membuka e-Court dan mencocokkan sendiri dokumen mana milik perkara mana.",
      "Penarikan berkala e-Court: jarak antar putaran, jam kerja, dan jumlah perkara per putaran dapat diatur dari menu Integrasi e-Court.",
      "Tombol Jalankan Sekarang untuk satu putaran di luar jadwal.",
      "Mode terjadwal pada jembatan e-Court: tanpa jendela peramban, dan tidak menunggu login manusia.",
    ],
    changed: [
      "Panel SIPP menampilkan tombol unduh menggantikan keterangan berkas tersimpan.",
      "Kartu penjadwal diletakkan tepat setelah kartu login e-Court, karena keduanya bergantung pada sesi yang sama.",
    ],
    fixed: [],
    security: [
      "Jalur berkas TIDAK PERNAH dipercaya apa adanya. Jalur yang tersimpan di database dipakai membaca berkas dari disk, sehingga baris database yang keliru dapat menyerahkan berkas apa pun di server. Jalurnya selalu diperiksa berada di dalam folder arsip, tepat sebelum berkasnya dibaca.",
      "Penjadwal BERHENTI ketika sesi e-Court habis, tidak mencoba terus. Mencoba berulang dengan sesi mati ke sistem Mahkamah Agung persis perilaku yang membuat akun ditandai, dan tidak akan pernah berhasil.",
      "Sesi habis memakai kode keluar tersendiri (2), dibedakan dari gagal biasa (1). Keduanya menuntut tindakan berbeda: yang satu perlu login manusia, yang lain perlu diperiksa sebabnya.",
      "Penarikan berkala dimulai dalam keadaan MATI. Menarik dari sistem Mahkamah Agung tanpa diminta bukan perilaku yang pantas dinyalakan sendiri oleh pembaruan.",
      "Akhir pekan selalu dilewati, tidak dapat dimatikan dari pengaturan. Pihak dan kuasa hukum mengunggah pada hari kerja; menarik di akhir pekan hanya membebani server pengadilan tanpa menemukan apa pun.",
      "Penjadwal memanggil jembatan sebagai proses terpisah, bukan menyalin ulang alurnya. Menyalin alur berarti punya dua jalur yang dapat berbeda perilaku - dan yang dijalankan terjadwal justru yang paling jarang diperhatikan orang.",
      "Ekstensi hanya menyentuh elemen buatannya sendiri. Pengujian memeriksa setiap pemilih yang dipakai ekstensi menunjuk elemennya sendiri, bukan elemen milik SIPP.",
    ],
    operationalNotes: [
      "Menyalakan penarikan berkala: Integrasi e-Court → Penarikan Berkala → atur jarak dan jam kerja → centang Nyalakan → Simpan.",
      "Saran jarak dua jam pada jam kerja. Dokumen e-Litigasi tidak masuk tiap menit, dan lebih rapat hanya menambah beban tanpa menambah manfaat.",
      "Bila penjadwal berhenti dengan tanda Sesi habis, itu bukan kerusakan. Login sekali lewat kartu Login e-Court, dan penarikan berjalan lagi dengan sendirinya.",
      "Ekstensi perlu diunduh ulang oleh petugas setelah pembaruan ini, karena tombol unduhnya baru.",
    ],
    knownLimitations: [
      "Penjadwal berjalan di dalam proses bot. Bila bot dinyalakan ulang, hitungan putaran dimulai dari nol - pengaturannya sendiri tetap tersimpan.",
      "Verifikasi hakim langsung dari SIPP belum tersedia; masih lewat WhatsApp atau halaman portal.",
      "Batas ruang disk dan masa simpan arsip belum ditetapkan. Berkas akan menumpuk tanpa batas sampai keduanya diputuskan.",
    ],
  },
  {
    version: "1.22.0",
    title: "ALETA v1.22.0 - Aplikasi ALETA e-Court",
    date: "2026-08-26",
    status: "Operasional",
    summary:
      "Penghubung e-Court kini punya aplikasinya sendiri di portal: satu menu untuk seluruh pegawai yang menyediakan unduhan ekstensi peramban, dan satu menu admin yang menyatukan pengaturan e-Court, SIPP, dan pemberitahuan WhatsApp ALETA Bot.",
    added: [
      "Menu ALETA e-Court untuk seluruh pegawai: penjelasan penghubung, unduhan ekstensi peramban, langkah pemasangan, dan keadaan penghubung.",
      "Menu Integrasi e-Court untuk admin: login e-Court, keadaan penghubung, kaitannya dengan pemberitahuan WhatsApp, peta apa yang disentuh tiap sistem, dan seluruh pengaturannya.",
      "Unduhan ekstensi sebagai satu berkas ZIP langsung dari portal, tanpa perlu menyalin folder secara manual ke tiap komputer.",
      "Peta alur data yang menyatakan tegas sistem mana dibaca dan sistem mana ditulis.",
    ],
    changed: [
      "Folder ekstensi-sipp kini ikut dipaketkan installer, sehingga berkasnya sampai ke server bersama rilis.",
    ],
    fixed: [],
    security: [
      "Unduhan ekstensi menuntut sesi portal. Ekstensi ini hanya berguna bagi petugas pengadilan, dan tidak ada alasan membiarkannya dapat diambil siapa pun yang menebak alamatnya.",
      "Daftar berkas yang boleh ikut diunduh bersifat TETAP, bukan hasil pemindaian folder. Memindai folder berarti apa pun yang kebetulan tersimpan di sana - catatan pengembangan, berkas cadangan, berkas yang tidak sengaja tersalin - ikut terbagikan ke komputer petugas.",
      "Penyusun ZIP menolak jalur menaik. Arsip yang memuat ../ dapat menulis di luar folder tujuan ketika dibuka, dan arsip yang dibagikan ke komputer petugas tidak boleh punya kemampuan itu.",
      "Penyusun ZIP ditulis sendiri tanpa pustaka pihak ketiga, sehingga aplikasi pengadilan tidak menambah dependensi baru yang harus ditinjau keamanannya selamanya - dan bentuk arsipnya diuji sungguhan dengan membukanya, bukan dipercaya begitu saja.",
      "Halaman pegawai hanya menampilkan, tidak memuat satu pun pengaturan. Seluruh pengaturan ada di menu admin yang terbatas hak aksesnya.",
    ],
    operationalNotes: [
      "Pegawai membuka menu ALETA e-Court di beranda portal, menekan Unduh Ekstensi, lalu memasangnya lewat chrome://extensions.",
      "Admin membuka Integrasi e-Court dari bilah sisi untuk login e-Court dan mengatur aturan pemberitahuan.",
      "Panel pengaturan yang sudah ada dipakai ulang apa adanya, sehingga aturan pemberitahuan dan ambang hari tidak punya dua tempat penyuntingan yang dapat berbeda isinya.",
    ],
    knownLimitations: [
      "Ekstensi tetap dipasang manual di tiap komputer lewat Developer mode. Pemasangan terpusat lewat kebijakan Chrome belum disiapkan.",
      "Halaman pegawai belum menampilkan apakah sesi e-Court masih berlaku - keterangan itu baru ada di menu admin.",
    ],
  },
  {
    version: "1.21.0",
    title: "ALETA v1.21.0 - Arsip Berkas dan Panel SIPP",
    date: "2026-08-26",
    status: "Operasional",
    summary:
      "Dokumen persidangan e-Court akhirnya benar-benar terunduh - selama ini tidak pernah, sehingga pemberitahuan terkirim tanpa lampiran. Ditambah ekstensi peramban yang menempelkan batas waktu e-Court, status pemberitahuan, dan selisih data ke halaman SIPP tanpa mengubah SIPP sama sekali.",
    added: [
      "Berkas Word ikut diunduh dan disimpan, bukan hanya PDF. Panitera menyusun BAS jauh lebih mudah dari berkas Word daripada dari PDF.",
      "Sidik jari isi berkas (SHA-256), sehingga dokumen yang diunggah ulang setelah diperbaiki terdeteksi sebagai versi baru - dan versi lama tetap tersimpan, tidak tertimpa.",
      "Pemeriksaan ulang bertingkat: dokumen yang belum diverifikasi diperiksa tiap 6 jam, yang sudah diverifikasi tiap 168 jam.",
      "Ekstensi peramban ALETA untuk SIPP: batas waktu unggah e-Court, status pemberitahuan tiap dokumen, keadaan nomor pihak, dan selisih dengan e-Court - ditempelkan ke halaman perkara SIPP.",
    ],
    changed: [
      "Nama berkas arsip kini memuat delapan huruf sidik jarinya, sehingga versi pengganti tidak menimpa versi lama dan isi yang sama tidak tersimpan dua kali.",
    ],
    fixed: [
      "DOKUMEN PERSIDANGAN TIDAK PERNAH TERUNDUH SEJAK v1.16.0. Pembaca halaman memisahkan dokumen dari teks yang sudah dibuang tagnya, sehingga seluruh tautan unduh ikut terhapus - hanya berkas pendaftaran yang punya alamat. Akibatnya Jawaban, Replik, dan Duplik tidak pernah dilampirkan ke pemberitahuan, dan pesannya tetap terkirim dengan alasan \"berkas belum tersedia\" seolah itu keadaan normal.",
      "Waktu yang disimpan dalam UTC dibaca kembali sebagai waktu lokal, sehingga setiap perhitungan \"sudah berapa lama sejak\" meleset tujuh jam di server WIB. Akibatnya tenggang tanya ulang konfirmasi nomor berakhir tujuh jam lebih cepat daripada yang tertulis di pengaturan.",
      "Jembatan e-Court berjalan sendiri ketika berkasnya sekadar di-require - membuka peramban dan menyentuh server e-Court. Dua alat lain di folder yang sama sudah dijaga; berkas ini terlewat.",
    ],
    security: [
      "Ekstensi TIDAK PERNAH menulis ke SIPP. Tidak mengisi formulir, tidak menekan tombol, tidak menimpa isi halaman. Begitu ekstensi mulai menulis lewat formulir SIPP, seluruh keunggulan rancangan ini hilang - dan kesalahannya akan tampak seperti kesalahan petugas.",
      "Ekstensi menyerah diam-diam ketika tidak yakin. Nomor perkara tidak dikenali, ALETA tidak terjangkau, atau tampilan SIPP berubah - semuanya berakhir dengan tidak menampilkan apa pun. Keterangan yang salah di layar SIPP lebih berbahaya daripada tidak ada keterangan.",
      "Nomor pihak ditampilkan tersamar. Layar SIPP dapat terlihat orang lain, dan nomor pihak berperkara bukan keterangan yang perlu dipajang.",
      "Izin ekstensi hanya storage dan satu host. Izin tabs sengaja dihindari karena memberi kemampuan membaca alamat seluruh tab peramban - jauh lebih luas daripada yang dibutuhkan saklar tampil/sembunyi.",
      "Ekstensi tidak menyimpan kredensial apa pun. SIPP dan portal berada di origin yang sama, sehingga cookie sesi portal ikut dengan sendirinya. Tanpa login ALETA, tidak ada data yang ditampilkan.",
      "Isi dari server ditulis dengan textContent, tidak pernah innerHTML, sehingga tidak pernah ditafsirkan sebagai HTML di halaman aplikasi resmi.",
    ],
    operationalNotes: [
      "Setelah pembaruan, jalankan jembatan e-Court sekali untuk menarik berkas yang selama ini terlewat: node tools/ecourt-bridge/run.js",
      "Ekstensi ada di folder ekstensi-sipp. Pasang lewat chrome://extensions → Developer mode → Load unpacked. Panduan lengkapnya di ekstensi-sipp/PASANG.md",
      "Ekstensi tidak dipasang otomatis oleh installer - petugas memuatnya sendiri di komputer masing-masing.",
      "Dua petugas dapat melihat isi berbeda pada perkara yang sama, tergantung ekstensinya terpasang atau tidak. Ini wajar untuk lapisan bantu, tetapi perlu disepakati.",
    ],
    knownLimitations: [
      "Panel ekstensi baru menampilkan keterangan. Mengunduh berkas dan memverifikasi dokumen langsung dari SIPP belum tersedia - keduanya menunggu tahap berikutnya.",
      "Nomor perkara dibaca dari teks yang tampil di halaman, karena alamat SIPP hanya memuat id terenkripsi. Bila tampilan SIPP berubah banyak, panel tidak akan muncul.",
      "Penarikan berkala belum ada. Jembatan e-Court masih dijalankan manual, dan sesinya tetap menuntut login yang captchanya diisi manusia.",
      "Batas ruang disk dan masa simpan arsip belum ditetapkan. Berkas perkara akan menumpuk tanpa batas sampai keduanya diputuskan.",
    ],
  },
  {
    version: "1.20.1",
    title: "ALETA v1.20.1 - Pemisahan Database Ditegakkan",
    date: "2026-08-26",
    status: "Operasional",
    summary:
      "Penjagaan yang mencegah ALETA menulis ke dalam database SIPP kini berlaku di lingkungan mana pun, tidak lagi hanya saat NODE_ENV bernilai production. Ditambah alat untuk memeriksa dan membersihkan tabel ALETA yang tertinggal di SIPP dari versi lama.",
    added: [
      "Alat audit tabel ALETA di database SIPP: melihat isinya, mencadangkan, dan menghapus - dengan penjagaan berlapis di tiap langkah.",
      "27 pemeriksaan otomatis untuk pemisahan database ALETA dan SIPP.",
    ],
    changed: [
      "Pemeriksaan konfigurasi database saat bot menyala kini melempar error tanpa bergantung NODE_ENV.",
    ],
    fixed: [
      "Konfigurasi database yang berbahaya hanya menghentikan bot bila NODE_ENV bernilai production. Di luar itu cukup peringatan konsol dan bot tetap menyala - sementara server yang lupa menyetel NODE_ENV adalah hal yang lumrah pada pemasangan cepat. Inilah celah yang dulu membuat tabel ALETA terbentuk di dalam database perkara.",
    ],
    security: [
      "SIPP adalah sistem induk Mahkamah Agung yang dipakai seluruh pengadilan. ALETA hanya menumpang membaca. Versi lama pernah menulis tabelnya sendiri ke sana karena ALETA_BOT_DB_NAME mengarah ke SIPP - kesalahan yang tidak menghasilkan pesan error apa pun: bot berjalan normal, hanya menyimpan datanya di tempat yang salah.",
      "Kedua lapis penjagaan kini sama kuatnya. Sebelumnya bot_db_config melempar error tanpa syarat, tetapi configValidationService hanya memperingatkan di luar produksi.",
      "Pemeriksaan otomatis memindai setiap layanan: sambungan SIPP hanya boleh menjalankan SELECT dan SHOW, dan tidak boleh ada tulisan langsung lewat sambungan itu.",
      "Alat pembersih SIPP hanya menyentuh tabel berawalan aleta_bot_, menolak menghapus tanpa berkas cadangan yang benar-benar ada dan berisi, dan menuntut konfirmasi berupa kalimat penuh. Kesalahan di database SIPP tidak punya tombol batal.",
    ],
    operationalNotes: [
      "PERHATIAN: server yang selama ini berjalan dengan konfigurasi database berbahaya dan hanya menerima peringatan kini AKAN MENOLAK MENYALA. Periksa ALETA_BOT_DB_NAME=aleta_bot dan ALETA_BOT_DB_SIPP_NAME=SIPP di .env.production sebelum memperbarui.",
      "Melihat sisa tabel di SIPP: node scripts/audit-sipp-tabel-aleta.js",
      "Mencadangkan lebih dulu: node scripts/audit-sipp-tabel-aleta.js --cadangkan cadangan-sipp-aleta.sql",
      "Menghapus setelah dicadangkan: node scripts/audit-sipp-tabel-aleta.js --hapus --cadangan cadangan-sipp-aleta.sql",
      "Penghapusan kemungkinan menuntut akun MySQL yang berhak menghapus tabel. Akun SIPP hanya-baca akan ditolak, dan alatnya menyatakan hal itu terus terang.",
    ],
    knownLimitations: [
      "Pintu darurat ALETA_BOT_ALLOW_SIPP_SCHEMA_WRITE masih ada dan tetap mematikan kedua lapis penjagaan. Variabel ini tidak terdokumentasi di .env.example maupun di mana pun, dan sebaiknya tetap begitu.",
      "Tabel yang sudah terlanjur ada di SIPP tidak dihapus otomatis oleh pembaruan ini. Penghapusannya keputusan pengadilan, dijalankan manual dengan alat audit.",
    ],
  },
  {
    version: "1.20.0",
    title: "ALETA v1.20.0 - Login e-Court dari Portal",
    date: "2026-08-26",
    status: "Operasional",
    summary:
      "Login e-Court tidak lagi menuntut petugas berada di depan server. Gambar captcha diambil dari halaman e-Court lalu ditampilkan di portal, petugas mengisi formulirnya di sana, dan bot yang meneruskannya.",
    added: [
      "Kartu Login e-Court di tab e-Court: keadaan sesi, tombol mulai login, gambar captcha, dan formulir email serta sandi.",
      "Tombol Periksa Sesi untuk memastikan sesi tersimpan masih berlaku, dan Hapus Sesi untuk keluar.",
    ],
    changed: [
      "Kartu Login diletakkan paling atas pada tab e-Court, karena tanpa sesi yang berlaku seluruh angka di bawahnya tidak akan pernah bertambah.",
    ],
    fixed: [],
    security: [
      "Sandi e-Court dipakai sekali lalu dibuang. Tidak disimpan ke database maupun berkas, tidak dicatat ke log mana pun termasuk jejak keamanan, dan tidak bertahan di memori lebih lama daripada satu percobaan login.",
      "Jejak keamanan mencatat PERISTIWANYA saja - bahwa sebuah sesi e-Court dibuka dari portal dan kapan. Email pun tidak disertakan.",
      "Pesan error dari puppeteer tidak diteruskan apa adanya, karena dapat memuat potongan isi halaman dan halaman login memuat kolom sandi.",
      "Kolom sandi di portal memakai autoComplete=off dan dikosongkan apa pun hasilnya, supaya tidak tertinggal di layar komputer yang ditinggalkan terbuka.",
      "Captcha tetap dijawab manusia. Gambarnya hanya diteruskan ke layar petugas; tidak ada pemecah captcha, pengenalan gambar, maupun layanan pihak ketiga.",
      "Gambar captcha dipotret dari elemennya, bukan diunduh ulang lewat alamatnya. Mengunduh ulang akan meminta captcha BARU dari e-Court, sehingga yang tampil berbeda dengan yang menunggu jawaban.",
      "Hanya satu peramban login yang boleh hidup pada satu waktu, dan formulirnya hangus sendiri setelah lima menit.",
    ],
    operationalNotes: [
      "Portal → ALETA Bot → tab e-Court → Mulai Login. Isi email, sandi, dan kode captcha, lalu Masuk.",
      "Setelah berhasil, jembatan e-Court dapat dijalankan tanpa login lagi selama sesinya berlaku.",
      "Login lewat terminal server tetap tersedia dan tidak berubah.",
    ],
    knownLimitations: [
      "Memindahkan login ke portal berarti sandi menempuh jalur peramban petugas, portal, lalu bot. Sebelumnya sandi tidak pernah meninggalkan peramban di server. Ini pertukaran yang disengaja demi kemudahan, bukan sesuatu yang luput - pastikan portal diakses lewat jaringan yang tepercaya.",
      "Kolom formulir login dicari dari sifatnya (kolom bertipe password, gambar beralamat captcha), bukan dari nama yang dibaca dari kode halaman e-Court. Bila tampilan e-Court berubah banyak, deteksinya dapat gagal dan portal akan menyatakan halaman login tidak dikenali.",
      "Sesi e-Court tetap punya masa berlaku dan akan habis sendiri. Bila itu terjadi, login diulang dari portal.",
    ],
  },
  {
    version: "1.19.4",
    title: "ALETA v1.19.4 - Penamaan Kesiapan Pilot",
    date: "2026-08-26",
    status: "Operasional",
    summary:
      "Penanda Kesiapan Arsip pada checklist Kesiapan Pilot diganti namanya menjadi Migrasi Jalur Lama, dengan keterangan yang menjelaskan maksudnya.",
    added: [],
    changed: [
      "Penanda \"Kesiapan Arsip\" pada Kesiapan Pilot kini bernama \"Migrasi Jalur Lama\", sama dengan nama tab tempat menindaklanjutinya.",
      "Keterangannya tidak lagi berupa angka telanjang saat bernilai nol, melainkan menjelaskan bahwa belum ada jalur lama yang dimatikan dan menunjuk ke tab yang tepat.",
    ],
    fixed: [],
    security: [],
    operationalNotes: [
      "Penanda ini menghitung jalur notifikasi lama yang sudah dimatikan dan siap diarsipkan - sisa dari sistem lama yang sedang digantikan jalur registry. Bukan urusan arsip surat maupun berkas perkara.",
    ],
    knownLimitations: [
      "Statusnya masih \"Perhatian\" ketika bernilai nol, padahal belum memensiunkan jalur lama adalah keadaan normal selama migrasi berjalan. Akibatnya checklist Kesiapan Pilot tidak pernah dapat hijau seluruhnya.",
    ],
  },
  {
    version: "1.19.3",
    title: "ALETA v1.19.3 - Sesi e-Court dan Persiapan Sidang",
    date: "2026-08-26",
    status: "Operasional",
    summary:
      "Login e-Court kini bertahan antar penjalanan, sehingga petugas tidak perlu mengetik email, sandi, dan captcha setiap kali. Panitera juga akhirnya dapat menyunting daftar persiapan sidang dari portal — janji yang tertulis sejak v1.13.0 tetapi tempat menyuntingnya belum pernah ada.",
    added: [
      "Sesi peramban e-Court yang bertahan. Selama sesinya belum kedaluwarsa, penjalanan berikutnya langsung masuk tanpa login ulang.",
      "Tanda --lupakan-sesi pada jembatan e-Court untuk menghapus sesi tersimpan, dipakai bila berganti akun atau komputer diserahkan ke orang lain.",
      "Penyuntingan daftar persiapan sidang per agenda dari tab e-Court. Kalimat seperti \"bawa dua orang saksi dewasa beserta KTP mereka\" kini disusun panitera, bukan pembuat aplikasi.",
    ],
    changed: [
      "Kartu Aturan Pemberitahuan dan Persiapan Sidang kini berada di satu tempat pada tab e-Court, sehingga seluruh padanan yang menentukan isi pesan dapat ditinjau sekaligus.",
    ],
    fixed: [
      "Tab e-Court menampilkan pesan mentah \"Unexpected token '<'\" ketika ALETA Bot menjawab dengan halaman HTML alih-alih data — misalnya karena containernya belum dibangun ulang setelah pembaruan. Pesan itu tidak menjelaskan apa pun tentang apa yang sebenarnya salah. Kini disebutkan rute mana yang tidak ditemukan dan apa yang perlu dilakukan.",
    ],
    security: [
      "Captcha tetap diisi manusia. Yang disimpan adalah HASIL login yang sudah dilakukan petugas sendiri — bukan cara melewati captcha, dan bukan sandi yang disimpan lalu diketikkan ulang oleh program.",
      "Folder sesi dibuat dengan izin 0700 dan diletakkan di luar folder aplikasi, sehingga tidak ikut terpaket installer maupun tercadangkan bersama kode. Isinya setara dengan sedang login ke sistem Mahkamah Agung.",
      "Kegagalan menyiapkan folder sesi tidak menghentikan jembatan: peramban dibuka bersih dan petugas login manual seperti sebelumnya.",
      "Kapan diingatkan (H-3 dan H-1) tidak dapat diubah untuk agenda bawaan. Mematikan pengingat H-3 pada agenda yang menuntut persiapan berhari-hari membuat pihak datang tanpa saksi, dan tidak ada pesan error yang menandakannya.",
      "Daftar persiapan yang seluruhnya kosong ditolak. Agenda tanpa persiapan lebih buruk daripada agenda yang belum dikenali, karena yang belum dikenali masih menerima nasihat dasar.",
    ],
    operationalNotes: [
      "Login pertama tetap manual: jalankan jembatan, isi email, sandi, dan captcha di jendela peramban. Penjalanan berikutnya tidak akan meminta login lagi selama sesinya masih berlaku.",
      "Letak folder sesi dapat diatur lewat ALETA_ECOURT_SESSION_DIR. Bawaannya .aleta-ecourt-session di folder rumah pengguna.",
      "Untuk keluar: node tools/ecourt-bridge/run.js --lupakan-sesi",
      "Penyuntingan persiapan sidang ada di tab e-Court, bagian Persiapan Sidang per Agenda.",
    ],
    knownLimitations: [
      "Sesi e-Court tetap punya masa berlaku dan akan habis sendiri. Bila itu terjadi, jembatan meminta login manual sekali lagi. Tidak ada upaya memperpanjang sesi secara paksa.",
      "Folder sesi terikat pada komputer tempat jembatan dijalankan. Menjalankannya dari komputer lain berarti login dari awal.",
      "Kapan diingatkan hanya dapat ditentukan untuk agenda tambahan buatan panitera, tidak untuk agenda bawaan.",
    ],
  },
  {
    version: "1.19.2",
    title: "ALETA v1.19.2 - Pengaturan e-Court dari Portal",
    date: "2026-08-25",
    status: "Operasional",
    summary:
      "Panitera kini dapat menambah pola judul dokumen sendiri ketika e-Court memakai istilah yang belum dikenali, melepas nomor yang salah tercatat agar ditanya ulang, dan menyesuaikan ambang hari - semuanya dari portal, tanpa menyalakan ulang bot.",
    added: [
      "Penyuntingan aturan pemberitahuan e-Court dari tab e-Court. Pola judul dapat ditambah, diubah, dan dikembalikan ke bawaan.",
      "Tombol Tanya Ulang pada daftar nomor salah alamat di Ringkasan Panitera.",
      "Pengaturan ambang tenggat mendesak dan tenggang tanya ulang konfirmasi nomor, berlaku seketika tanpa menyalakan ulang bot.",
    ],
    changed: [
      "Tabel aturan pemberitahuan pada tab e-Court yang semula hanya dapat dibaca kini dapat disunting.",
    ],
    fixed: [
      "Nomor yang pemiliknya menjawab BUKAN terkunci selamanya. Tidak ada satu pun cara memulihkannya - tidak di portal, tidak di kode - sehingga petugas yang sudah memperbaiki data di SIPP tetap tidak bisa mengirim ke nomor itu, dan satu-satunya jalan keluar adalah membuka database. Halaman panitera sudah menampilkan daftarnya, jadi petugas melihat masalahnya tanpa bisa berbuat apa-apa.",
    ],
    security: [
      "Melepas nomor TIDAK langsung mengizinkan pengiriman. Statusnya kembali ke menunggu dan pemiliknya ditanya sekali lagi - petugas hanya membuka kesempatan bertanya, bukan memutuskan atas nama pemilik nomor.",
      "Hanya nomor berstatus ditolak yang dapat dilepas. Melepas nomor yang sudah terverifikasi justru membuang kepercayaan yang sudah didapat.",
      "Jenis dokumen bawaan tidak dapat dimatikan atau dialihkan tujuannya dari portal. Mematikan jenis Jawaban akan membuat seluruh Jawaban berhenti diberitahukan tanpa satu pun pesan error - hanya kesunyian yang terlihat normal.",
      "Jenis bawaan juga tidak dapat dihapus. Yang terhapus hanya timpaannya, sehingga jenisnya kembali ke bentuk bawaan, bukan hilang.",
      "Pola tambahan tidak dapat menembus jenis yang melarang. Judul yang juga cocok dengan berkas pendaftaran tetap tidak diberitahukan, sehingga penambahan pola tidak dapat membuat ALETA mengirimi orang dokumennya sendiri.",
      "Ambang di luar akal ditolak, bukan dipaksa masuk. Tanya ulang yang terlalu cepat membuat pihak yang belum sempat membaca ditanya berkali-kali - persis perilaku yang membuat nomor diblokir WhatsApp.",
      "Nama pelaku pada jejak perubahan selalu diambil dari akun yang sedang login, tidak pernah dari badan permintaan.",
    ],
    operationalNotes: [
      "Bila ada dokumen e-Court yang tidak diberitahukan padahal seharusnya, periksa tab e-Court bagian Aturan Pemberitahuan dan tambahkan pola judulnya di sana.",
      "Setelah nomor di SIPP diperbaiki, tekan Tanya Ulang di Ringkasan Panitera. Pemiliknya akan dikonfirmasi sekali lagi pada putaran pekerja berikutnya.",
      "Perubahan ambang berlaku seketika; bot tidak perlu dinyalakan ulang.",
    ],
    knownLimitations: [
      "Siapa yang diberitahu hanya dapat ditentukan untuk jenis dokumen tambahan buatan panitera, tidak untuk jenis bawaan.",
      "Kalimat ringkasan dan tindakan pada tiap jenis belum dapat disunting dari portal, baru pola judulnya.",
      "Padanan agenda sidang (sidangAgendaGuide) dari v1.13.0 masih belum punya tempat penyuntingan di portal.",
    ],
  },
  {
    version: "1.19.1",
    title: "ALETA v1.19.1 - Tab e-Court dan Antrian Ikut Hari",
    date: "2026-08-25",
    status: "Operasional",
    summary:
      "Seluruh pengelolaan e-Court kini ada dalam satu tab di halaman ALETA Bot, lengkap dengan saklar menyalakan atau mematikan pemberitahuan. Panel Antrian Online juga diperbaiki agar berganti sendiri saat hari berganti.",
    added: [
      "Tab e-Court di halaman ALETA Bot: keadaan jembatan, dokumen menunggu majelis, keputusan hakim yang belum diteruskan, konfirmasi nomor pihak, kecocokan dengan e-Court, dan daftar aturan pemberitahuan.",
      "Saklar menyalakan atau mematikan pemberitahuan e-Court langsung dari portal.",
    ],
    changed: [
      "Kartu Perkara Bersidang di Antrian Online kini bernama Perkara Bersidang Hari Ini, dengan keterangan bahwa angkanya mengikuti tanggal server.",
    ],
    fixed: [
      "Panel Antrian Online menampilkan sisa antrian hari sebelumnya. Kuerinya tidak punya penyaring tanggal sama sekali, sehingga pada hari tanpa sidang pun tetap menampilkan baris kemarin - dan judul Perkara Bersidang membuatnya terbaca sebagai jumlah sidang hari ini. Kini disaring dengan tanggal server database, jam yang sama dengan aplikasi antrian SIPP, sehingga keduanya berganti hari bersamaan.",
    ],
    security: [
      "Saklar e-Court benar-benar menghentikan pekerja, bukan sekadar mengubah tampilan. Saklar yang hanya tampak mati tetapi pesannya tetap berangkat lebih berbahaya daripada tidak ada saklar sama sekali.",
      "Mematikan pemberitahuan TIDAK membuang antrean: dokumen yang menunggu tetap menunggu dan dikirim begitu dinyalakan kembali. Menandainya dilewati akan membuat seluruh antrean hangus hanya karena saklar sempat dimatikan sebentar.",
      "Saklar hanya menerima nilai true yang tegas, dan setiap perubahannya dicatat sebagai peristiwa keamanan.",
      "Tab e-Court hanya membaca. Menarik dokumen baru dan meneruskan keputusan tetap dijalankan dari terminal server, karena login e-Court menuntut captcha yang sengaja tidak diotomatiskan.",
    ],
    operationalNotes: [
      "Tab e-Court muncul di sebelah Antrian Online, dan tampil juga pada Mode Sederhana karena menyangkut pekerjaan harian.",
      "Angka pada tab ini terisi setelah jembatan dijalankan minimal sekali: node tools/ecourt-bridge/run.js",
      "Halaman Ringkasan Panitera dan Verifikasi Dokumen tetap berdiri sendiri di /panitera dan /verifikasi-dokumen.",
    ],
    knownLimitations: [
      "Aturan pemberitahuan baru dapat dilihat, belum dapat diubah dari tab ini. Perubahannya masih lewat pengaturan ecourtDocumentGuide.",
      "Penyaringan antrian bersandar pada tabel jadwal sidang SIPP. Perkara yang antriannya tercatat tetapi jadwalnya belum terisi tidak akan tampil.",
    ],
  },
  {
    version: "1.19.0",
    title: "ALETA v1.19.0 - Verifikasi Portal dan Rekonsiliasi",
    date: "2026-08-25",
    status: "Operasional",
    summary:
      "Hakim kini dapat memverifikasi dokumen lewat portal, melihat semua yang menunggu sekaligus. ALETA juga membandingkan catatannya sendiri dengan status sesungguhnya di e-Court dan melaporkan selisihnya, serta memperlakukan bukti surat berbeda dari dokumen jawab-menjawab.",
    added: [
      "Halaman Verifikasi Dokumen e-Litigasi di portal. Seluruh dokumen menunggu terlihat sekaligus, dengan tautan langsung ke halaman e-Court-nya.",
      "Rekonsiliasi ALETA dengan e-Court: mendeteksi keputusan yang bertentangan, penerusan yang gagal diam-diam, dokumen yang diverifikasi langsung di e-Court, dan keputusan yang belum diteruskan.",
      "Selisih genting ikut tampil di Ringkasan Panitera, supaya terlihat saat memeriksa pekerjaan pagi.",
    ],
    changed: [
      "Verifikasi kini punya dua jalur setara: WhatsApp untuk yang mendesak, portal untuk yang banyak. Penjagaannya sama persis.",
    ],
    fixed: [
      "Batas waktu unggah yang ditambahkan pada v1.18.0 ikut menempel pada pemberitahuan bukti surat. Tenggat itu adalah batas mengunggah berkas untuk agenda berikutnya, sedangkan tanggapan atas bukti disampaikan lisan di persidangan - pihak yang membacanya bisa mengira harus mengunggah sesuatu sebelum tanggal itu, atau lebih buruk, mengira haknya hangus padahal tidak. Bukti surat kini tidak lagi menampilkan tenggat, dan memuat catatan bahwa aslinya tetap harus diperlihatkan di persidangan.",
    ],
    security: [
      "Jalur portal TIDAK lebih longgar dari jalur WhatsApp. Hakim di luar majelis tetap ditolak, keanggotaan majelis tetap diperiksa tepat sebelum keputusan disimpan, dan konfirmasi kedua tetap dituntut.",
      "Nama hakim yang diteruskan ke bot SELALU diambil dari akun yang sedang login, tidak pernah dari badan permintaan. Bila nama boleh dikirim pemanggil, siapa pun yang punya akun portal dapat mengaku sebagai hakim mana pun.",
      "Konfirmasi portal hanya diterima bila bernilai tegas true. Nilai yang mirip-benar seperti string \"true\", angka 1, atau objek kosong ditolak.",
      "Rekonsiliasi MELAPORKAN, tidak pernah menimpa. Memperbaiki selisih secara otomatis berarti menebak mana yang benar, dan tebakan yang salah pada keputusan hukum jauh lebih merugikan daripada selisih yang ditangani manusia.",
      "Status resmi selalu yang tercatat di e-Court. ALETA hanya membuat selisihnya terlihat.",
    ],
    operationalNotes: [
      "Halaman verifikasi hakim ada di /verifikasi-dokumen. Halaman akan menolak sendiri bila penggunanya bukan hakim terdaftar.",
      "Nama di Manajemen Akun harus cocok dengan nama hakim di SIPP setelah gelar dibuang. Bila tidak cocok, daftar akan kosong meski ada dokumen menunggu.",
      "Selisih berkegentingan tinggi - bertentangan dan penerusan gagal - perlu diperiksa manual dan diselesaikan di e-Court.",
    ],
    knownLimitations: [
      "Halaman portal belum menampilkan pratinjau PDF berdampingan; berkasnya dibuka lewat tautan ke e-Court. Hakim tetap harus membaca dokumennya sebelum memutuskan.",
      "Rekonsiliasi hanya seakurat sinkronisasi terakhir. Status e-Court yang berubah setelah jembatan dijalankan belum terlihat sampai jembatan dijalankan lagi.",
      "Pemisahan aturan bukti bersandar pada judul dokumen. Bukti yang diberi judul tidak lazim masih akan diperlakukan sebagai dokumen biasa - periksa lewat uji kering.",
    ],
  },
  {
    version: "1.18.0",
    title: "ALETA v1.18.0 - Nomor Terverifikasi dan Batas Waktu",
    date: "2026-08-25",
    status: "Operasional",
    summary:
      "Berkas perkara tidak lagi dikirim ke nomor yang belum dipastikan pemiliknya. Batas waktu unggah dari e-Court kini ikut diberitahukan, setiap pesan menyatakan dirinya bukan panggilan resmi, dan panitera pengganti mendapat halaman ringkasan kerjanya sendiri.",
    added: [
      "Konfirmasi kepemilikan nomor sebelum berkas dikirim. ALETA bertanya lebih dulu tanpa lampiran; berkas baru menyusul setelah pemiliknya membenarkan.",
      "Batas waktu unggah dari e-Court kini terbaca, tersimpan, dan disebutkan di pesan - lengkap dengan pengingat sisa hari bila tinggal tiga hari atau kurang.",
      "Halaman Ringkasan Panitera di portal: dokumen menunggu verifikasi, tenggat mendesak dan yang sudah lewat, nomor salah alamat, dan nomor yang belum menjawab konfirmasi.",
    ],
    changed: [
      "Setiap pemberitahuan e-Court kini menyatakan dirinya bukan pengganti panggilan resmi pengadilan, dan menyebut jurusita sebagai penyampai pemberitahuan yang sah.",
      "Pekerja e-Court membedakan menunggu verifikasi dari gagal. Menunggu bukan kegagalan, melainkan tanda penjagaannya bekerja.",
    ],
    fixed: [
      "Batas waktu unggah sebelumnya terbaca lalu dibuang oleh pembaca halaman e-Court, sehingga pemberitahuan hanya menyampaikan setengah kabar: ada dokumen masuk, tanpa tenggatnya kapan.",
    ],
    security: [
      "Nomor yang belum dikonfirmasi pemiliknya TIDAK menerima berkas apa pun. Nomor pihak diketik petugas dari formulir tulisan tangan; satu digit salah berarti dokumen perceraian seseorang terkirim ke orang asing, dan itu tidak bisa ditarik kembali setelah terbaca.",
      "Pertanyaan konfirmasi sengaja tidak menyebut nomor perkara, jenis dokumen, bahkan kata perkara. Bila nomornya ternyata milik orang lain, yang terbuka hanya sebuah nama - bukan bahwa orang itu sedang berperkara, apalagi perkara apa.",
      "Nomor yang dijawab BUKAN tidak pernah dikirimi apa pun lagi, dan muncul di halaman panitera sebagai data SIPP yang perlu diperbaiki.",
      "Kepercayaan diikat pada pasangan nomor DAN nama. Nomor yang sudah terbukti milik seseorang tidak otomatis dipercaya ketika dipakai untuk pihak bernama lain.",
      "Dokumen tidak ditandai selesai selagi masih ada penerima yang ditunggu jawabannya. Tanpa penjagaan ini, pertanyaannya dijawab tetapi berkasnya tidak pernah menyusul.",
      "Halaman panitera hanya membaca: tidak ada INSERT, UPDATE, maupun DELETE, dan keputusan verifikasi tetap hanya lewat majelis hakim.",
    ],
    operationalNotes: [
      "Pihak yang sudah pernah menerima pesan ALETA tetap akan ditanya sekali saat berkas e-Court pertama hendak dikirim kepadanya.",
      "Pertanyaan konfirmasi diulang paling cepat tiga hari sekali bila belum dijawab, bukan setiap kali pekerja berjalan.",
      "Halaman Ringkasan Panitera ada di /panitera, memakai izin yang sama dengan halaman ALETA Bot.",
    ],
    knownLimitations: [
      "Konfirmasi lewat WhatsApp memastikan nomor itu dipegang orang yang mengaku bernama demikian - bukan identitas hukum. Ini menutup kesalahan ketik, bukan pemalsuan identitas.",
      "Pihak yang tidak pernah membalas konfirmasi tidak akan menerima berkas sama sekali. Panitera perlu memantau daftar nomor belum menjawab dan menempuh cara lain bila perlu.",
      "Batas waktu diambil dari agenda paling belakang di halaman e-Court. Bila halamannya menampilkan urutan yang tidak lazim, tenggat yang tampil bisa keliru - periksa lewat uji kering sebelum menyalakan pengiriman.",
      "Pemberitahuan WhatsApp tetap bukan relaas panggilan. Pemberitahuan yang sah secara hukum tetap yang disampaikan jurusita.",
    ],
  },
  {
    version: "1.17.0",
    title: "ALETA v1.17.0 - Verifikasi Dokumen oleh Hakim",
    date: "2026-08-24",
    status: "Operasional",
    summary:
      "Hakim kini dapat memverifikasi dokumen e-Litigasi lewat WhatsApp: membaca berkasnya, lalu memutuskan Valid atau Tidak Valid. Keputusan tersimpan di ALETA lebih dulu, dan diteruskan ke e-Court oleh petugas lewat alat terpisah yang selalu diawasi manusia.",
    added: [
      "Menu verifikasi hakim di WhatsApp. Ketik \"verifikasi\" untuk melihat dokumen yang menunggu pada perkara yang beliau tangani, membaca berkasnya, lalu memutuskan.",
      "Uji kering pemberitahuan: memperlihatkan pesan apa yang AKAN dikirim untuk tiap dokumen tersimpan, tanpa mengirim apa pun dan tanpa mengubah data.",
      "Alat penerus keputusan ke e-Court, dengan uji kering sebagai perilaku bawaan.",
      "Tabel keputusan verifikasi di database ALETA, lengkap dengan siapa memutuskan, kapan, dan apakah sudah diteruskan.",
    ],
    changed: [
      "Balasan chat kini dapat membawa lampiran lewat pintu keluar yang sama. Sebelumnya lampiran akan menempuh jalur kedua yang melewatkan sanitasi dan pencatatan statistik.",
    ],
    fixed: [
      "Dua alat baris perintah e-Court sempat berjalan sendiri saat modulnya sekadar dimuat. Untuk alat penerus keputusan, ini berarti sekadar memuatnya dari skrip pemeriksaan dapat MENJALANKAN penerusan sungguhan ke sistem resmi.",
    ],
    security: [
      "SELURUH penjagaan verifikasi bersifat GAGAL-TERTUTUP - kebalikan dari seluruh layanan ALETA lain. Di bagian lain, gangguan berarti pesan tetap dikirim; di sini, apa pun yang tidak dapat dipastikan berakhir dengan MENOLAK. Verifikasi adalah keputusan hukum, bukan pemberitahuan.",
      "Hanya hakim yang tercatat sebagai majelis pada perkara itu yang dapat memverifikasi. Keanggotaan majelis diperiksa TIGA KALI: saat daftar disusun, saat dokumen dipilih, dan sekali lagi tepat sebelum keputusan disimpan - karena susunan majelis dapat berubah di tengah percakapan.",
      "Pencocokan nama hakim dilakukan pada nama UTUH tanpa gelar, bukan potongan nama. Mencocokkan sebagian nama berisiko meloloskan hakim lain yang namanya beririsan.",
      "SIPP tidak terbaca berarti keanggotaan majelis tidak dapat dipastikan, dan permintaan DITOLAK.",
      "Keputusan hanya tersimpan bila hakim membalas kalimat lengkap yang persis. Balasan pendek seperti \"ya\", \"1\", atau \"valid\" sengaja ditolak, supaya jempol yang salah pencet tidak pernah menghasilkan keputusan hukum.",
      "Penerus ke e-Court membaca isi kotak dialog dan mencocokkannya dengan dokumen yang dimaksud SEBELUM satu pilihan pun disentuh. Bila tidak cocok, dialog ditinggalkan tanpa disentuh sama sekali.",
      "Penerusan tidak pernah berjalan tanpa pengawasan: uji kering adalah perilaku bawaan, login e-Court manual, dan tiap keputusan dikonfirmasi petugas di layar.",
      "Setiap keputusan dan setiap penolakan dicatat sebagai peristiwa keamanan: siapa, kapan, perkara apa, dokumen apa.",
    ],
    operationalNotes: [
      "Nomor WhatsApp hakim harus terdaftar di Manajemen Akun portal dengan peran hakim. Tanpa itu, menu verifikasi menolak membuka.",
      "Alur bagi hakim: ketik \"verifikasi\", balas nomor dokumen, baca berkas yang dikirim, lalu balas SAYA SETUJU VALID atau SAYA SETUJU TIDAK VALID.",
      "Sebelum menyalakan pemberitahuan sungguhan, jalankan: node tools/ecourt-bridge/uji-kering.js untuk melihat tebakan pengklasifikasi.",
      "Meneruskan keputusan ke e-Court: node tools/ecourt-bridge/kirim-verifikasi.js (uji kering), tambahkan --kirim bila daftarnya sudah benar.",
    ],
    knownLimitations: [
      "Penunjuk elemen pada kotak dialog e-Court disusun dari tangkapan layar, BUKAN dari membaca kode halamannya. Kemungkinan besar perlu disesuaikan saat pertama kali dicoba - jalankan uji kering lebih dulu untuk memastikan dialognya ditemukan dan isinya terbaca benar.",
      "Status dokumen di e-Court tidak berubah sampai petugas menjalankan alat penerus. Balasan ke hakim menyatakan hal ini secara jujur.",
      "Verifikasi lewat WhatsApp tidak menggantikan kehati-hatian hakim. Bot mempercepat langkahnya; keputusan Valid atau Tidak Valid tetap sepenuhnya keputusan hakim yang membaca dokumennya.",
      "Bila berkas belum sempat terunduh jembatan, hakim diminta membuka dokumennya lewat e-Court sebelum memutuskan - menu tetap berjalan, tetapi tanpa lampiran.",
    ],
  },
  {
    version: "1.16.0",
    title: "ALETA v1.16.0 - Jembatan e-Court",
    date: "2026-08-24",
    status: "Operasional",
    summary:
      "Dokumen yang diunggah para pihak lewat e-Court - Jawaban, Replik, Duplik, bukti surat - kini dapat diunduh, dicatat, dan dipakai memicu pemberitahuan WhatsApp yang tepat konteks. Dokumen ini sama sekali tidak punya jejak di SIPP, sehingga ALETA harus mencatatnya sendiri.",
    added: [
      "Jembatan e-Court: alat terpisah yang membuka peramban, menunggu petugas login sendiri, lalu mengunduh seluruh dokumen dari tiap perkara ke folder lokal per nomor perkara.",
      "Dua tabel baru di database ALETA: catatan dokumen e-Court dan jejak tiap kali sinkronisasi dijalankan.",
      "Pengklasifikasi dokumen yang menentukan siapa perlu diberi tahu dan apa langkah berikutnya - Jawaban memberi tahu penggugat untuk menyiapkan Replik, Replik memberi tahu tergugat untuk menyiapkan Duplik.",
      "Pekerja notifikasi yang berjalan tiap 15 menit, mencari nomor WhatsApp pihak tujuan dari SIPP, lalu menyerahkan pesannya ke antrean yang sudah ada.",
      "Perbaikan otomatis teks e-Court yang rusak penyandiannya. Contoh nyata dari halaman perkara: alasan tunda tertulis \"MedÃ¬asi\" - teks berantakan seperti ini tidak boleh sampai ke pihak berperkara.",
      "Status layanan bot menampilkan jumlah dokumen e-Court dan hasil sinkronisasi terakhir.",
    ],
    changed: [
      "Jalur lampiran WhatsApp kini memilah asal berkas: berkas e-Court dan berkas SIPP ditangani terpisah karena letaknya diatur pihak yang berbeda.",
    ],
    fixed: [],
    security: [
      "LOGIN e-COURT TETAP MANUAL. Jembatan tidak membaca, mengisi, maupun mencoba melewati CAPTCHA - fungsi captcha memang memastikan seorang manusia yang masuk. Peramban dibuka dalam keadaan terlihat, dan skrip menunggu petugas menyelesaikan loginnya sendiri.",
      "Hanya dokumen yang SUDAH DIVERIFIKASI majelis yang memicu pemberitahuan. Verifikasi di e-Court dapat dibatalkan, sehingga memberitahu pihak sebelum majelis memutuskan berarti menyampaikan sesuatu yang mungkin dicabut.",
      "Peran pengunggah yang tidak dikenali menghasilkan TIDAK MENGIRIM, bukan mengirim ke semua pihak. \"Turut Tergugat\" secara khusus dikecualikan meski memuat kata \"tergugat\", karena siapa lawannya tidak punya jawaban tunggal.",
      "Berkas pendaftaran (Surat Kuasa, Gugatan, bukti surat milik pengunggah sendiri) tidak diberitahukan. Memberi tahu orang tentang berkas yang baru ia unggah sendiri tidak menambah apa pun.",
      "Dokumen putusan yang muncul di e-Court sengaja dilewati, karena jalur pengiriman berkas putusan dari SIPP sudah ada beserta pengaman anti-kembarnya.",
      "Isi pesan tidak pernah menyebut nama hakim yang memverifikasi maupun email pengunggah - hanya STATUS bahwa dokumen sudah diverifikasi majelis.",
      "Judul dokumen yang belum pernah dikenali TIDAK memicu pesan apa pun. Dokumen tetap tercatat agar kelasnya bisa ditambahkan setelah bentuk nyatanya terlihat; menebak kalimat pemberitahuan pengadilan lebih berbahaya daripada diam.",
      "Berkas lampiran tidak dapat keluar dari folder unduhan e-Court, sekalipun namanya mengandung jalan pintas \"..\".",
      "SIPP tetap murni dibaca. Seluruh catatan baru ditulis ke database ALETA sendiri.",
    ],
    operationalNotes: [
      "Jalankan jembatan dengan: node tools/ecourt-bridge/run.js. Tambahkan --maks-perkara 5 untuk mencoba pada sedikit perkara lebih dulu, atau --tanpa-unduh untuk mencatat tanpa mengunduh berkas.",
      "Login harus diulang setiap kali sesi e-Court habis. Ini tidak bisa dihindari dan memang disengaja.",
      "Berkas yang sudah pernah diunduh tidak diunduh ulang, sehingga sinkronisasi kedua dan seterusnya jauh lebih cepat.",
      "Folder unduhan dapat dipindahkan lewat pengaturan ALETA_BOT_ECOURT_DOCUMENT_ROOT, berguna bila jembatan dijalankan di komputer lain lalu hasilnya disalin ke server.",
    ],
    knownLimitations: [
      "Pengklasifikasi membaca judul dokumen sebagai teks, bukan maknanya. Jenis perkara lain kemungkinan memakai istilah berbeda dan perlu ditambahkan ke kamus setelah bentuk nyatanya terlihat.",
      "e-Court adalah situs pemerintah yang dapat berubah tanpa pemberitahuan. Bila tampilannya diperbarui, bagian pembaca halaman perlu disesuaikan - skrip pemeriksaan akan langsung menunjukkan bagian mana yang tidak lagi cocok.",
      "Verifikasi dokumen oleh hakim lewat WhatsApp BELUM dibangun. Itu Tahap 5 dan 6 yang direncanakan terpisah, karena menulis keputusan ke sistem resmi jauh lebih berat daripada sekadar memberi tahu.",
      "Jembatan belum berjalan otomatis terjadwal - masih dijalankan petugas saat dibutuhkan, karena langkah loginnya memang menunggu manusia.",
    ],
  },
  {
    version: "1.15.0",
    title: "ALETA v1.15.0 - Pemeriksa Keamanan Isi Pesan",
    date: "2026-08-23",
    status: "Operasional",
    summary:
      "Menu Edit Isi Pesan kini memeriksa tulisan admin dan memberi peringatan bila memuat hal yang biasanya memicu pemblokiran WhatsApp: kosakata iklan, kalimat menyerupai penipuan, tautan pemendek, huruf kapital semua, emoji bertumpuk, dan pesan terlalu panjang. Peringatan saja - isi pesan tetap dapat disimpan.",
    added: [
      "Pemeriksa keamanan isi pesan pada menu Edit Isi Pesan, menampilkan tiap temuan beserta alasan mengapa berisiko dan saran perbaikannya.",
      "Penanda ringkas pada daftar isi pesan, sehingga isi pesan bermasalah terlihat tanpa harus dibuka satu per satu.",
      "Pemeriksaan kalimat menyerupai penipuan (rekening, transfer, kode OTP, kata sandi). Selain berisiko diblokir, pesan pengadilan yang berbunyi seperti penipuan mengajari warga mempercayai penipu yang meniru pengadilan.",
    ],
    changed: [
      "Isi pesan Sidang Ditunda tidak lagi memakai HURUF KAPITAL untuk penekanan, diganti huruf tebal WhatsApp. Ditemukan oleh pemeriksa ini pada isi pesan bawaan sendiri.",
    ],
    fixed: [],
    security: [
      "Pemeriksa hanya MEMBERI TAHU, tidak pernah menolak penyimpanan. Yang menulis isi pesan adalah pegawai yang tahu apa yang perlu disampaikan; pemeriksa hanya menebak dari bentuk kalimat, dan pemeriksa yang keliru tidak boleh menghalangi pemberitahuan yang sah.",
      "Pencocokan dilakukan per KATA UTUH, bukan potongan kata. Pencocokan potongan akan memperingatkan kata sah seperti \"menangani\" (memuat \"menang\") dan \"Perseroan Terbatas\" (memuat \"terbatas\"), dan pemeriksa yang berteriak pada kalimat yang benar akan diabaikan orang.",
      "Kata umum yang lazim dipakai bahasa pengadilan sengaja tidak didaftarkan. \"segera\" misalnya dipakai isi pesan pegawai yang sah; yang didaftarkan adalah frasa \"segera transfer\".",
      "Daftar tautan pemendek di portal dijaga tetap sama persis dengan daftar di bot oleh pengujian, agar tidak ada tautan yang diperingatkan portal tetapi lolos di bot atau sebaliknya.",
    ],
    operationalNotes: [
      "Buka Edit Isi Pesan pada tiap isi pesan yang pernah Anda sunting sendiri untuk melihat hasil pemeriksaannya. Isi pesan bawaan sudah dipastikan bersih oleh pengujian.",
      "Peringatan muncul seketika saat mengetik, tidak perlu menyimpan lebih dulu.",
    ],
    knownLimitations: [
      "Pemeriksa membaca bentuk kalimat, bukan maknanya. Kalimat bermasalah yang ditulis dengan kata lain tetap lolos, dan sebaliknya kalimat sah yang kebetulan memakai kata terdaftar akan diperingatkan meskipun benar.",
      "Daftar kosakata belum dapat disunting dari portal. Penambahan kata baru masih lewat pembaruan aplikasi.",
      "Pemeriksaan hanya berjalan di menu Edit Isi Pesan. Isi pesan yang diubah langsung di database tidak diperiksa.",
    ],
  },
  {
    version: "1.14.0",
    title: "ALETA v1.14.0 - Anti-Blokir Tahap 2",
    date: "2026-08-23",
    status: "Operasional",
    summary:
      "Delapan pengaman yang mengubah CARA pesan dikirim, tanpa menghapus satu pun pemberitahuan. Irama kirim tidak lagi seragam melainkan campuran seperti percakapan manusia, bot menampilkan tanda sedang mengetik dan membuka pesan yang masuk, mengikuti ritme kantor termasuk Jumatan dan akhir pekan, serta berhenti total begitu WhatsApp menandai akun.",
    added: [
      "Irama kirim campuran: jarak antar pesan tidak lagi diambil dari satu rentang, melainkan dari beberapa kelompok berbobot - banyak jarak pendek 20-45 detik, sesekali jeda panjang sampai 15 menit. Rata-rata 112 detik, kapasitas 257 pesan per hari pada Mode Minimal.",
      "Tanda \"sedang mengetik...\" sebelum pesan terkirim, dengan lama yang sebanding panjang pesan. Memakai jeda kirim yang memang sudah ada, sehingga tidak menambah waktu tunggu untuk pemberitahuan.",
      "Pesan masuk ditandai sudah dibaca, seperti yang dilakukan orang. Akun yang mengirim banyak tetapi tidak pernah membuka pesan masuk berperilaku sebagai corong satu arah.",
      "Ritme kantor: istirahat siang 12:00-13:00, Jumat 11:30-13:30, dan libur Sabtu-Minggu. Daftar hari libur nasional dapat diisi admin.",
      "Pemanasan nomor bertahap: batas harian mulai 30 pesan, naik dua kali lipat tiap tiga hari sampai penuh dalam dua minggu. Dipakai saat nomor baru pulih dari suspend.",
      "Penerima yang pesannya benar-benar dibaca didahulukan satu tingkat dalam antrean, karena percakapan dua arah adalah perlindungan terkuat terhadap pemblokiran.",
      "Penghentian otomatis saat WhatsApp menandai akun. Alasan terputus dipilah: TOS_BLOCK, UNPAIRED, dan LOGOUT menghentikan bot seketika, sedangkan gangguan jaringan tetap menyambung ulang seperti biasa.",
      "Variasi kalimat pembuka: salam dan kalimat perkenalan dipilih acak dari beberapa bentuk baku yang setara.",
      "Status layanan bot menampilkan keadaan tanda blokir dan tahap pemanasan nomor.",
    ],
    changed: [
      "Batas Mode Minimal diturunkan dari 150 pesan/jam dan 600 pesan/hari menjadi 40/jam dan 300/hari. Angka lama jauh di atas apa yang mungkin dihasilkan iramanya sendiri, sehingga tidak pernah berfungsi sebagai rem dan hanya menenangkan nama modenya.",
      "Mode Maksimal sengaja TIDAK diberi irama campuran. Pada tingkat itu kecepatan memang didahulukan di atas penyamaran.",
      "Rentang jarak cadangan (sendingGapMinMs/MaxMs) diselaraskan dengan rata-rata irama campuran pada setiap tingkat. Rentang ini hanya dipakai bila irama campuran tidak termuat, misalnya saat server masih memakai runtime config lama sesaat setelah pembaruan; bila cadangannya jauh lebih cepat, laju kirim akan menembus rem darurat dan pemberitahuan mulai DIBUANG, bukan sekadar tertunda.",
    ],
    fixed: [
      "app.js menyambung ulang pada SETIAP peristiwa terputus, termasuk ketika WhatsApp memutus dengan alasan pelanggaran ketentuan layanan. Menyambung ulang berkali-kali setelah akun ditandai adalah hal terburuk yang bisa dilakukan: setiap percobaan tercatat, dan suspend sementara berubah menjadi blokir permanen.",
      "auth_failure hanya dicatat tanpa pernah menghentikan apa pun, sehingga bot dapat mencoba masuk tanpa batas dengan sesi yang sudah ditolak.",
    ],
    security: [
      "Penghentian karena tanda blokir memblokir SELURUH kategori pesan, termasuk manual dan sistem. Ini satu-satunya penjaga yang tidak boleh ditembus kategori apa pun.",
      "Penghentian tidak batal ketika bot berhasil tersambung kembali. Hanya admin yang boleh melepaskannya, karena keputusan menyalakan nomor yang sedang ditandai harus diambil manusia yang tahu keadaannya.",
      "Seluruh pengaman lain bersifat GAGAL-TERBUKA: indikator mengetik, pemanasan nomor, dan pengutamaan penerima tidak pernah mendiamkan pemberitahuan pengadilan ketika WhatsApp atau database bermasalah.",
      "Pemanasan nomor tidak pernah membatasi balasan chat, pesan manual, maupun pesan sistem. Membatasi balasan akan merugikan dua kali: layanannya memburuk, dan akunnya justru makin terlihat satu arah.",
      "Keterlibatan penerima diukur dari tanda terima yang sudah dicatat (ack), bukan dengan mencatat nomor pengirim pesan masuk, agar tidak menambah data baru tentang warga.",
    ],
    operationalNotes: [
      "Kapasitas Mode Minimal sekarang 257 pesan per hari pada jendela 08:00-16:00. Kebutuhan PA Donggala 100-200 pesan per hari berada di bawahnya, sehingga tidak ada pemberitahuan yang tertinggal.",
      "Pemanasan nomor dikirim dalam keadaan MATI. Nyalakan dari portal beserta tanggal mulainya saat nomor baru pulih dari suspend atau saat memakai nomor baru.",
      "Bila bot berhenti sendiri karena tanda blokir, ajukan banding dari aplikasi WhatsApp lebih dulu. Jangan lepaskan penghentian sebelum peninjauan selesai.",
      "Daftar hari libur nasional masih kosong. Isi dari pengaturan sendingRhythm.holidays dengan format YYYY-MM-DD.",
    ],
    knownLimitations: [
      "Pengingat H-1 untuk sidang hari SENIN berjalan pada hari Minggu, sehingga ritme akhir pekan menggesernya ke Senin pukul 08:00 - satu jam sebelum sidang, terlalu mepet untuk dipakai bersiap. Agenda yang menuntut persiapan tetap tertolong karena sudah menerima H-3 pada hari Jumat, tetapi agenda jawab-menjawab tidak. Bila ini mengganggu, matikan skipWeekend atau majukan pengingat Senin ke hari Jumat.",
      "Variasi kalimat pembuka bernilai SEDANG saja, bukan besar. Isi pesan ALETA sebenarnya sudah berbeda antar penerima karena memuat nama, nomor perkara, dan tanggal masing-masing; yang tersisa hanya kesamaan kerangka.",
      "Seluruh pengaman di sini menurunkan peluang suspend, tidak menghilangkannya. whatsapp-web.js tetap otomatisasi tidak resmi. Jalur yang benar-benar bebas risiko tetap WhatsApp Business Cloud API.",
      "Ritme kantor dan pemanasan nomor hanya berlaku pada jalur notifikasi registry. Bila useRegistryNotifications dimatikan sehingga pengiriman kembali ke penjadwal lama di app.js, keduanya tidak ikut berjalan.",
    ],
  },
  {
    version: "1.13.0",
    title: "ALETA v1.13.0 - Persiapan Sidang dan Pengingat H-1",
    date: "2026-08-23",
    status: "Operasional",
    summary:
      "Agenda sidang dari SIPP kini diterjemahkan menjadi daftar persiapan yang dapat dipahami orang awam, dan dipakai untuk menentukan kapan pihak perlu diingatkan. Agenda yang menuntut persiapan diingatkan pada H-3 dan H-1; agenda jawab-menjawab cukup pada H-1 saja, sehingga penambahan pengingat tidak melipatgandakan jumlah pesan.",
    added: [
      "Variabel isi pesan {{persiapan_sidang}} yang menerjemahkan agenda sidang menjadi daftar hal yang harus dibawa pihak. Agenda \"Pemeriksaan Saksi\" menjadi perintah jelas seperti membawa dua orang saksi dewasa beserta KTP mereka.",
      "Pengingat Sidang H-1 dengan isi pesan tersendiri yang jauh lebih pendek daripada H-3, dikirim pukul 15:30.",
      "Penyaringan agenda pada pengingat sidang: setiap agenda hanya diingatkan pada jarak hari yang memang dibutuhkan.",
      "Perintah chat \"jadwal#nomor perkara\" ikut menampilkan persiapan untuk sidang yang belum berlangsung.",
      "Padanan agenda dapat disunting panitera lewat pengaturan sidangAgendaGuide tanpa mengubah aplikasi, karena kalimatnya adalah pernyataan hukum acara, bukan pernyataan teknis.",
    ],
    changed: [
      "Isi pesan Notifikasi Jadwal Sidang kini memuat {{persiapan_sidang}}. Isi pesan yang sudah disunting admin tidak ikut diubah.",
      "Pengingat H-3 tidak lagi dikirim untuk agenda jawaban, replik, duplik, dan kesimpulan. Agenda itu tidak menuntut persiapan berhari-hari, sehingga untuk kelompok ini jumlah pesan justru berkurang dari dua menjadi satu.",
      "Pengingat H-1 tidak membawa lampiran dokumen petitum, agar pengingat menjelang sidang tetap ringan.",
    ],
    fixed: [
      "Pengingat H-1 semula dijadwalkan pukul 16:30, di luar jendela kirim mode Minimal yang berakhir pukul 16:00. Akibatnya pesan tergeser ke pembukaan jendela berikutnya, yaitu pagi hari sidang itu sendiri, saat pihak mungkin sudah berangkat. Dipindahkan ke pukul 15:30.",
      "Penandaan tahap agenda ikut disisipkan ke instalasi yang sudah berjalan. Tanpa itu penyaringan agenda hanya bekerja pada pemasangan baru, sedangkan server produksi yang sudah pernah di-seed tidak akan pernah menerimanya.",
    ],
    security: [
      "Nama hakim, panitera pengganti, dan jurusita TIDAK ditampilkan kepada pihak, sesuai keputusan pimpinan demi keamanan pegawai. Usulan layanan yang akan menampilkannya dibatalkan, dan penjagaan otomatis ditambahkan agar variabel atau kolom nama pegawai tidak masuk kembali lewat pembaruan berikutnya tanpa disadari.",
      "Kolom alasan_ditunda tidak dipakai sama sekali. Kolom itu teks bebas yang ditulis panitera untuk keperluan internal dan isinya tidak layak dibaca pihak.",
      "Penyaringan agenda bersifat GAGAL-TERBUKA: tahap yang tidak dikenali tetap mengirim, dan agenda yang belum dikenali tetap menerima pengingat H-3 seperti sebelumnya.",
    ],
    operationalNotes: [
      "Pengingat H-1 dikirim dalam keadaan mati (tidak aktif) seperti seluruh notifikasi bawaan lainnya. Admin menyalakannya dari portal setelah isi pesannya ditinjau.",
      "Daftar padanan agenda perlu disahkan panitera sebelum pengingat dinyalakan, karena kalimat seperti \"bawa dua orang saksi dewasa\" adalah pernyataan pengadilan tentang hukum acara.",
      "Penyaringan agenda hanya berlaku pada jalur notifikasi registry. Bila useRegistryNotifications dimatikan sehingga pengiriman kembali ke penjadwal lama di app.js, penyaringan dan daftar persiapan tidak ikut berjalan.",
    ],
    knownLimitations: [
      "Pengenalan agenda memakai pencocokan potongan kata pada teks bebas dari SIPP. Agenda yang ditulis dengan istilah tidak lazim akan jatuh ke kelas cadangan: tetap menerima H-3 dan tetap mendapat nasihat dasar, tetapi tanpa persiapan khusus.",
      "SIPP tidak menyimpan kelengkapan berkas milik pihak, sehingga daftar persiapan diturunkan dari agenda sidang, bukan dari kekurangan berkas yang sebenarnya.",
      "Peringatan jam kirim di portal masih membandingkan pada tingkat jam, bukan menit, sehingga jadwal seperti 16:30 terhadap jendela yang berakhir 16:00 belum diberi peringatan.",
    ],
  },
  {
    version: "1.12.1",
    title: "ALETA v1.12.1 - Pengaman Anti-Blokir Tahap 1 Lengkap",
    date: "2026-08-22",
    status: "Operasional",
    summary:
      "Menutup tiga pemicu pemblokiran WhatsApp yang masih terbuka: mengirim ke nomor yang tidak terdaftar WhatsApp, terus mengirim ke nomor yang pesannya tidak pernah sampai, dan memakai tautan pemendek. Bersama kata BERHENTI yang sudah ada sejak v1.8.0, seluruh pekerjaan Tahap 1 rencana anti-blokir kini selesai.",
    added: [
      "Pemeriksaan nomor terdaftar WhatsApp sebelum mengirim pemberitahuan. Hasilnya disimpan tujuh hari untuk nomor terdaftar dan sehari untuk yang tidak, sehingga WhatsApp tidak ditanya berulang.",
      "Penghentian otomatis nomor yang pesannya tidak pernah sampai ke ponsel penerima. Dinilai sekali sehari dari catatan tanda terima yang sudah ada, dan hanya untuk nomor yang belum pernah sekali pun berhasil menerima.",
      "Deteksi tautan pemendek pada isi pemberitahuan. Tautannya tidak diubah, tetapi keberadaannya dicatat sebagai peringatan karena pemendek adalah pemicu pemblokiran yang sering luput.",
      "Jumlah nomor yang dihentikan ditampilkan pada status layanan bot, sebagai penanda bahwa data telepon di SIPP perlu dibersihkan.",
    ],
    changed: [
      "Isi pesan Notifikasi Perkara Baru tidak lagi memakai tautan pemendek s.id untuk survei, diganti tautan pada domain resmi pengadilan.",
    ],
    fixed: [],
    security: [
      "Kedua pengaman baru bersifat GAGAL-TERBUKA. Bila WhatsApp belum siap, jaringan bermasalah, atau database tidak terjangkau, pengiriman TETAP dilanjutkan. Pemberitahuan pengadilan tidak boleh berhenti gara-gara alat bantu anti-blokir tidak dapat dijalankan.",
      "Penilaian nomor tidak sampai menunggu lebih dari sehari sebelum menyimpulkan, karena tanda terima datang menyusul dan menilai terlalu cepat akan menghentikan nomor yang sebenarnya sehat.",
      "Nomor yang pernah sekali pun berhasil menerima dikecualikan dari penghentian: satu keberhasilan cukup membuktikan nomornya sehat, dan kegagalan setelahnya lebih mungkin karena ponsel mati daripada karena diblokir.",
      "Penilaian memakai tanda terima PONSEL penerima, bukan tanda terima server. Pesan yang hanya sampai server tetapi tidak pernah sampai ponsel itulah tanda nomor bermasalah.",
      "Daftar nomor yang dihentikan ditampilkan dalam bentuk tersamar, tidak pernah utuh.",
    ],
    knownLimitations: [
      "Penggantian tautan survei hanya berlaku untuk pemasangan baru. Instalasi yang sudah berjalan tetap memakai isi pesannya sendiri dan perlu diubah manual lewat Edit Isi Pesan.",
      "Nomor yang dihentikan tidak aktif kembali dengan sendirinya. Setelah nomor diperbaiki di SIPP, admin perlu mengaktifkannya kembali.",
      "Pemeriksaan nomor terdaftar hanya berlaku pada jalur pemberitahuan. Balasan atas pertanyaan yang dikirim sendiri tidak diperiksa, karena nomornya sudah terbukti aktif dengan mengirim pesan.",
    ],
    operationalNotes: [
      "Untuk instalasi yang sudah berjalan: buka Edit Isi Pesan pada Notifikasi Perkara Baru dan ganti tautan survei s.id dengan tautan domain resmi pengadilan.",
      "Pantau jumlah nomor yang dihentikan pada status layanan bot. Angka yang terus naik berarti data telepon pihak di SIPP perlu dibersihkan lewat PTSP.",
      "Bila ada nomor sah yang terlanjur dihentikan, aktifkan kembali setelah nomornya diperbaiki di SIPP.",
    ],
  },
  {
    version: "1.12.0",
    title: "ALETA v1.12.0 - Lima Layanan Baru untuk Pihak Berperkara",
    date: "2026-08-22",
    status: "Operasional",
    summary:
      "Lima usulan layanan untuk pihak berperkara yang paling sering ditanyakan ke PTSP: status panggilan sidang, pemberitahuan sidang ditunda, peringatan panjar menipis, sisa waktu mengajukan banding, dan pengiriman berkas putusan langsung ke WhatsApp. Seluruh datanya sudah tersedia di SIPP; yang belum ada hanyalah jalan bagi pihak untuk melihatnya sendiri.",
    added: [
      "Pilihan menu Status Panggilan Sidang: menampilkan pihak mana saja yang sudah tercatat menerima panggilan beserta tanggalnya, pihak mana yang belum, dan kesimpulan apakah sidang dapat berlanjut sesuai jadwal.",
      "Isi pesan baru Pihak - Sidang Ditunda, khusus untuk memberi tahu bahwa sidang tidak jadi dilaksanakan, lengkap dengan penegasan agar pihak tidak perlu datang.",
      "Sisa waktu mengajukan banding pada Perjalanan Perkara: tanggal batas dan jumlah hari tersisa, dihitung 14 hari sejak putusan dibacakan bagi pihak yang hadir, atau sejak putusan diberitahukan bagi yang tidak hadir - mengikuti cara pengadilan sendiri mencatatnya.",
      "Pilihan menu Kirim berkas putusan (PDF): berkas putusan yang sudah diunggah dikirim sebagai lampiran ke WhatsApp pihak, melalui antrean sehingga tetap mengikuti aturan jarak kirim.",
    ],
    changed: [
      "Notifikasi Sidang Ditunda sebelumnya bernama Notifikasi Tunda/Cuti dan berjadwal 24 November saja - sisa pengumuman cuti lama. Kini berjadwal dua kali sehari pada 09:00 dan 14:00, agar penundaan yang dicatat pagi masih sempat diberitahukan hari itu juga.",
      "Notifikasi Sisa Panjar dipindah dari 19:00 ke 10:00. Jadwal lama berada di luar jam kirim Mode Minimal sehingga pesannya tertahan sampai pagi berikutnya.",
    ],
    fixed: [],
    security: [
      "Status panggilan menyebut nama pihak lawan beserta keadaan panggilannya, karena itulah yang dibutuhkan penanya. Tetapi nomor telepon, alamat, nomor resi, dokumen relaas, dan keterangan bebas hasil penyampaian TIDAK diambil sama sekali dari database - bukan hanya tidak ditampilkan.",
      "Kolom yang tidak pernah dibaca tidak akan pernah bocor lewat log, potret perkara, maupun perubahan tampilan di kemudian hari. Pengujian memeriksa langsung isi kueri untuk memastikannya.",
      "Status panggilan, tenggang banding, dan pengiriman berkas seluruhnya melewati pemeriksaan hak akses yang sama dengan perintah perkara lain.",
      "Tenggang banding memilih tafsir yang lebih aman ketika catatan kehadiran belum diisi: dihitung sejak putusan dibacakan sehingga tenggangnya lebih pendek. Bila ternyata keliru, akibatnya pihak datang lebih awal - bukan kehilangan hak.",
      "Setiap tampilan tenggang banding menyatakan bahwa angkanya perkiraan dan yang berlaku tetap catatan resmi pengadilan.",
      "Berkas putusan selalu disertai keterangan bahwa itu salinan TIDAK RESMI sesuai SK KMA 1-144/KMA/SK/I/2011, dan salinan resmi harus diminta di PTSP.",
      "Berkas dikirim dengan kategori manual karena diminta sendiri oleh pihaknya, sehingga permintaan berhenti berlangganan tidak menghalanginya - yang dihentikan adalah pemberitahuan otomatis, bukan jawaban atas permintaan sendiri.",
    ],
    knownLimitations: [
      "Perbaikan jadwal dan isi pesan pada dua notifikasi hanya berlaku untuk pemasangan baru. Instalasi yang sudah berjalan mempertahankan pengaturannya sendiri, sehingga jadwal 24 November dan 19:00 perlu diperbaiki manual lewat portal.",
      "Kedua notifikasi tetap dalam keadaan nonaktif dan harus melewati simulasi, pratinjau penerima, serta persetujuan sebelum dapat diaktifkan.",
      "Status panggilan mengikuti catatan relaas di SIPP. Panggilan yang sudah disampaikan Jurusita tetapi belum diinput akan tampil sebagai belum tercatat.",
      "Tenggang banding tidak ditampilkan sama sekali bila pihak tidak hadir dan pemberitahuan putusannya belum tercatat, karena hitungannya memang belum mulai.",
      "Pengiriman berkas putusan memerlukan berkas SIPP yang dapat dijangkau layanan bot. Bila belum terpasang, bot menjelaskan sebabnya dan mengarahkan ke PTSP, bukan gagal diam.",
    ],
    operationalNotes: [
      "Untuk instalasi yang sudah berjalan: buka tab Notifikasi, ubah jadwal Notifikasi Tunda/Cuti menjadi 00 09 * * *; 00 14 * * * dan isi pesannya menjadi Pihak - Sidang Ditunda, lalu ubah jadwal Notifikasi Sisa Panjar menjadi 00 10 * * *.",
      "Kedua notifikasi menambah volume kirim harian. Periksa angka pemakaian nyata sebelum mengaktifkan keduanya sekaligus, terutama pada Mode Risiko Minimal.",
    ],
  },
  {
    version: "1.11.1",
    title: "ALETA v1.11.1 - Semua Jalur Chat Diperlakukan Sama",
    date: "2026-08-22",
    status: "Operasional",
    summary:
      "Perbaikan mutu jawaban yang dibangun bertahap ternyata hanya menempel pada jalur menu baru. Warga yang mengetik perintah lama seperti akta#123.G.2026 masih menerima jawaban yang belum dibersihkan dan tanpa penjelasan istilah, padahal bertanya hal yang sama ke bot yang sama. Seluruh balasan chat kini melewati satu pintu keluar, sehingga perlakuannya seragam.",
    added: [
      "Satu pintu keluar untuk seluruh balasan chat: membersihkan sisa jejak kode, lalu menjelaskan istilah hukum, lalu mencatat corong layanan. Perintah chat baru apa pun yang ditambahkan nanti otomatis ikut mendapat seluruh perlakuan ini.",
      "Pemberitahuan otomatis ke pihak berperkara kini juga menjelaskan istilah hukum di dalamnya. Justru di sini kebutuhannya paling besar: warga menerima pemberitahuan tanpa pernah meminta dan tidak ada petugas di sebelahnya untuk ditanyai artinya.",
    ],
    changed: [
      "Seluruh titik balasan pada penanganan pesan masuk dialirkan lewat pembantu tunggal: menu baru, perintah detail, perintah ai dan bot, pendaftaran antrian sidang, penolakan hak akses, perintah lama, dan jawaban atas pertanyaan bebas.",
      "Corong layanan kini mencatat seluruh jalur chat, bukan hanya menu. Sebelumnya angkanya menyesatkan karena hanya menghitung pengguna menu.",
      "Kamus istilah aman dipanggil berkali-kali. Teks yang sudah dijelaskan tidak akan ditempeli penjelasan untuk kedua kalinya.",
    ],
    fixed: [
      "Jawaban dari perintah lama dan dari pertanyaan bebas tidak melewati pembersihan jejak kode maupun kamus istilah, sehingga mutunya berbeda dari jawaban lewat menu.",
      "Pemberitahuan ke pegawai sempat berpeluang ikut ditempeli kamus istilah; kini dikecualikan karena mereka memang memahami istilahnya dan penjelasan tambahan hanya memanjangkan pesan kerja.",
    ],
    security: [
      "Balasan penolakan hak akses tetap dibersihkan tetapi sengaja tidak diberi kamus istilah, agar pesan penolakan tetap singkat dan tidak menambah keterangan yang tidak perlu.",
      "Balasan yang sudah sangat panjang dilewati kamus istilah supaya tetap terbaca di layar ponsel.",
    ],
    knownLimitations: [
      "Jawaban dari perintah lama belum ikut disimpan dalam potret perkara. Penurunan beban SIPP masih hanya berlaku pada jalur menu.",
      "Pemberitahuan yang disusun langsung oleh portal, seperti pengingat disposisi, tidak melewati pintu keluar ini karena tidak melalui layanan bot.",
    ],
    operationalNotes: [
      "Tidak ada langkah tambahan setelah update. Perubahan ini bersifat menyeragamkan, bukan menambah pengaturan baru.",
      "Bila menambah perintah chat baru di kemudian hari, cukup pastikan balasannya memakai pembantu balasChat agar seluruh perlakuan ikut berlaku.",
    ],
  },
  {
    version: "1.11.0",
    title: "ALETA v1.11.0 - Corong Layanan dan Laporan Pelayanan",
    date: "2026-08-22",
    status: "Operasional",
    summary:
      "Tahap 5 sekaligus penutup Rancangan Query. Menu pilihan yang dibangun sejak v1.8.0 belum pernah diuji ke masyarakat: apakah warga benar-benar sampai ke jawabannya atau berhenti di tengah sama sekali tidak terpantau. Sekarang perjalanan itu dicatat tahap demi tahap, dan angkanya disusun menjadi laporan pelayanan yang siap dipakai untuk pelaporan PTSP.",
    added: [
      "Corong layanan: menghitung berapa sesi membuka menu, memilih perkara, memilih informasi, dan benar-benar menerima jawaban. Titik terbanyak orang berhenti ikut dihitung dan ditandai.",
      "Laporan pelayanan publik: jumlah pertanyaan dilayani otomatis, jumlah pemohon unik, waktu tanggap rata-rata dan terlama, sebaran jenis informasi yang diminta, sebaran per jam, dan jam tersibuk.",
      "Sebaran sumber jawaban: berapa yang dilayani dari potret perkara dan berapa yang mengambil ke SIPP, sebagai ukuran nyata keberhasilan Tahap 3.",
      "Endpoint layanan bot /internal/service-report untuk membaca corong dan laporan pada rentang hari ini, 7 hari, 30 hari, atau 90 hari.",
    ],
    changed: [
      "Hasil penanganan menu kini menyertakan jenis informasi yang diminta dan sumber datanya, agar dapat dihitung tanpa menebak dari isi pesan.",
    ],
    fixed: [],
    security: [
      "Statistik TIDAK menyimpan nomor WhatsApp, nomor perkara, nama, maupun isi pertanyaan. Yang tersimpan hanya sidik sesi, tahap yang dicapai, jenis informasi yang diminta, dan lama waktu menjawab.",
      "Sidik sesi berganti setiap hari dan memakai garam acak per proses. Orang yang sama pada dua hari berbeda menghasilkan sidik yang tidak berhubungan, sehingga statistik tidak dapat dirangkai menjadi riwayat perorangan.",
      "Corong menghitung sesi unik, bukan jumlah pesan, sehingga satu orang yang menekan beberapa pilihan tidak terhitung sebagai beberapa pengguna.",
      "Pencatatan dijalankan setelah balasan dikirim dan tanpa ditunggu. Statistik tidak menambah waktu tunggu warga, dan kegagalan mencatat tidak pernah menggagalkan pelayanan.",
    ],
    knownLimitations: [
      "Laporan kosong sampai menu benar-benar dipakai masyarakat. Angka baru bermakna setelah beberapa hari pemakaian nyata.",
      "Corong hanya mengikuti alur menu. Pertanyaan bebas dan perintah lama seperti akta#nomor tidak masuk hitungan corong, meskipun tetap tercatat pada log tanya jawab publik yang sudah ada.",
      "Karena sidik sesi berganti harian, jumlah pemohon unik pada rentang beberapa hari adalah penjumlahan per hari, bukan jumlah orang berbeda sepanjang rentang itu. Ini konsekuensi yang disengaja dari pilihan menjaga privasi.",
    ],
    operationalNotes: [
      "Biarkan berjalan sekitar dua minggu sebelum menyimpulkan. Setelah itu periksa titik bocor terbesar pada corong - di situlah rancangan menu perlu diperbaiki.",
      "Angka pertanyaan dilayani otomatis dan waktu tanggap rata-rata dapat langsung dipakai untuk laporan pelayanan publik dan penilaian PTSP.",
      "Antrean pertanyaan tak terjawab sudah tersedia sejak sebelumnya pada tab Tinjauan Pertanyaan di portal; jadikan itu antrean kerja mingguan.",
    ],
  },
  {
    version: "1.10.0",
    title: "ALETA v1.10.0 - Perjalanan Perkara dan Kamus Istilah",
    date: "2026-08-22",
    status: "Operasional",
    summary:
      "Tahap 4 dari Rancangan Query. Menu lama menjawab pertanyaan data - kapan sidang, berapa biaya. Yang paling sering ada di kepala pihak justru pertanyaan keadaan: sudah sampai mana perkara saya, dan apa yang harus saya lakukan. Pilihan baru Perjalanan Perkara menjawab keduanya dalam satu tampilan, ditutup satu baris tindakan yang diturunkan dari keadaan perkaranya sendiri.",
    added: [
      "Pilihan menu Perjalanan Perkara sebagai pilihan pertama: tahapan perkara dari pendaftaran, sidang demi sidang, putusan, berkekuatan hukum tetap, sampai akta cerai. Tahap yang sudah lewat, yang sedang berjalan, dan yang akan datang ditandai berbeda.",
      "Baris Yang Perlu Anda Lakukan pada setiap perjalanan perkara, diturunkan dari keadaan perkara: hadir sidang berikutnya, menunggu masa berkekuatan hukum tetap, atau mengurus akta. Bila memang tidak ada yang perlu dilakukan, itu dikatakan dengan jelas.",
      "Saran persiapan sidang sesuai agendanya: mediasi tidak dapat diwakilkan, pembuktian membawa bukti asli beserta fotokopi, pemeriksaan saksi membawa saksi, ikrar talak mewajibkan kehadiran suami.",
      "Kamus istilah otomatis: istilah seperti verstek, gugur, berkekuatan hukum tetap, eksepsi, replik, dan duplik dijelaskan dalam bahasa sehari-hari di bawah pesan. Daftarnya dapat ditambah dari portal lewat runtime config.",
      "Jawaban kosong kini menjelaskan sebabnya. Akta belum ada karena putusan belum berkekuatan hukum tetap, jadwal belum ada karena hari sidang belum ditetapkan, dan seterusnya.",
    ],
    changed: [
      "Nomor pilihan pada menu informasi bergeser satu karena Perjalanan Perkara menempati urutan pertama. Sesi menu yang sedang berjalan tetap konsisten karena daftar pilihannya disimpan per sesi.",
    ],
    fixed: [],
    security: [
      "Perjalanan perkara tetap melewati pemeriksaan hak akses yang sama dengan seluruh perintah perkara lain. Tampilan ini memang hanya dapat dibuka dari menu, tetapi keamanan tidak boleh bersandar pada dari mana sebuah permintaan datang.",
      "Istilah hukum resminya tetap ditulis utuh; penjelasan ditempel di bawah, tidak menggantikan. Istilah resmi itulah yang tertulis pada dokumen pengadilan yang dipegang pihak, dan menggantinya justru membuat pihak bingung saat mencocokkan.",
      "Jumlah istilah yang dijelaskan dibatasi agar pesan tidak membengkak, dan pencocokannya memakai batas kata sehingga tidak salah sorot di tengah kata lain.",
    ],
    knownLimitations: [
      "Perjalanan perkara disusun dari tanggal pendaftaran, jadwal sidang, tanggal putusan, dan tanggal berkekuatan hukum tetap. Tahapan administratif yang tidak tercatat pada keempat sumber itu belum tampil.",
      "Perkiraan masa berkekuatan hukum tetap memakai ketentuan umum 14 hari sejak putusan diberitahukan. Bila ada banding, tanggalnya akan berbeda dan yang berlaku tetap catatan resmi pengadilan.",
      "Kamus istilah bekerja pada teks jawaban. Istilah yang ditulis dengan singkatan tidak baku di data SIPP belum tentu dikenali; tambahkan lewat portal bila ditemukan.",
    ],
    operationalNotes: [
      "Perjalanan perkara memakai tabel yang sama dengan pilihan Rincian Perkara, sehingga tidak menambah beban pada pilihan yang sudah ada, dan hasilnya ikut disimpan dalam potret perkara selama 5 menit.",
      "Bila petugas PTSP menemukan istilah yang sering ditanyakan masyarakat, tambahkan ke kamus lewat runtime config. Yang paling tahu istilah mana yang membingungkan adalah petugas yang setiap hari ditanyai.",
    ],
  },
  {
    version: "1.9.0",
    title: "ALETA v1.9.0 - Potret Perkara dan Pemutus Arus SIPP",
    date: "2026-08-22",
    status: "Operasional",
    summary:
      "Tahap 3 dari Rancangan Query, dan inilah tahap yang benar-benar menurunkan beban. Jawaban per perkara kini disimpan sebentar, sehingga memeriksa jadwal lalu biaya lalu status untuk satu perkara yang sama tidak lagi berarti tiga query terpisah ke SIPP. Ditambah pemutus arus yang menghentikan pengambilan data saat SIPP sedang bermasalah, agar bot tidak ikut memperberat sistem induk.",
    added: [
      "Potret perkara: jawaban disimpan sementara per nomor perkara dan per jenis informasi. Masa berlakunya dibedakan menurut sifat datanya - biaya 2 menit, jadwal dan status 5 menit, akta dan putusan 10 menit, daftar pihak 10 menit, identitas perkara 30 menit.",
      "Penyajian data lama saat sumber datanya mati: bila SIPP gagal dijawab, pertanyaan tetap terjawab dari potret terakhir, disertai keterangan jujur tentang umur datanya.",
      "Pemutus arus SIPP: setelah beberapa gangguan beruntun, pengambilan data dihentikan sementara dan permintaan baru ditolak cepat tanpa menyentuh database. Setelah masa tenang, satu permintaan percobaan menentukan apakah layanan sudah pulih.",
      "Rasio potret terpakai, jumlah data lama tersaji, dan keadaan pemutus arus ditampilkan pada status layanan bot.",
    ],
    changed: [
      "Daftar pihak dan kuasa sebuah perkara ikut disimpan dalam potret. Data ini dipanggil pada setiap permintaan yang menyangkut perkara, sehingga paling sering berulang.",
    ],
    fixed: [
      "Menu pilihan selalu mendaftarkan antrian sidang online sebagai pihak kedua, sehingga penggugat yang mendaftar lewat menu tercatat di slot pihak lawan. Perintah pendaftaran kini mengikuti peran pengirim pada perkara tersebut.",
    ],
    security: [
      "Potret TIDAK pernah menyimpan keputusan hak akses. Yang disimpan hanya isi jawaban dan daftar penerima per nomor perkara; pencocokan nomor pengirim dihitung ulang pada setiap permintaan, sehingga potret tidak pernah bisa meloloskan orang yang tidak berhak.",
      "Pendaftaran antrian sidang dikecualikan dari potret karena bersifat menulis. Jawaban tersimpan akan membuat orang mengira sudah terdaftar padahal pendaftarannya tidak pernah dijalankan.",
      "Data dari potret lama selalu menyebutkan umurnya. Data perkara yang disajikan seolah-olah terkini padahal bukan jauh lebih berbahaya daripada data yang diakui lawas.",
      "Pemutus arus hanya menghitung gangguan sistemik (batas waktu, sambungan putus, sambungan penuh). Error SQL biasa seperti tabel tidak ada atau sintaks keliru tidak dihitung, agar satu query admin yang salah tulis tidak menghentikan layanan bagi semua orang.",
    ],
    knownLimitations: [
      "Potret disimpan di memori dan hilang setiap bot direstart. Setelah restart, permintaan pertama untuk tiap perkara kembali menyentuh SIPP.",
      "Perubahan data di SIPP baru terlihat setelah masa berlaku potret lewat. Untuk data biaya jedanya paling pendek, tetapi tetap ada.",
      "Penurunan beban hanya berlaku pada perkara yang ditanya berulang dalam rentang masa berlaku. Perkara yang ditanya sekali lalu ditinggalkan tidak terbantu.",
    ],
    operationalNotes: [
      "Pantau rasio potret terpakai pada status layanan bot. Sasarannya di atas 70 persen; bila jauh di bawah itu, masa berlakunya terlalu pendek untuk pola pemakaian nyata.",
      "Bila ada keluhan data terasa tertinggal, periksa dulu jenis informasinya sebelum memperpendek masa berlaku - biaya sudah paling singkat, dan memperpendek semuanya akan mengembalikan beban ke SIPP.",
    ],
  },
  {
    version: "1.8.1",
    title: "ALETA v1.8.1 - Batas Waktu Query dan Pengukuran Beban SIPP",
    date: "2026-08-22",
    status: "Operasional",
    summary:
      "Tahap 1-2 dari Rancangan Query. Setiap query ke database perkara kini punya batas waktu dan durasinya dicatat. Sebelumnya query lambat digantung tanpa batas sampai kolam sambungan habis dan bot berhenti menjawab siapa pun, sementara tidak ada satu pun angka yang bisa dipakai mencari penyebabnya.",
    added: [
      "Pengukuran durasi setiap query ke database perkara: jumlah pemanggilan, rata-rata, persentil ke-95, durasi tertinggi, jumlah baris, error, dan batas waktu terlampaui. Query dikelompokkan menurut sidiknya, sehingga query yang sama dengan nomor perkara berbeda terhitung menyatu.",
      "Kinerja query ditampilkan pada status layanan bot, diurutkan menurut TOTAL waktu - supaya query ringan yang dipanggil ribuan kali ikut terlihat, bukan hanya query berat yang jarang dijalankan.",
      "Query yang berjalan melewati ambang lambat dicatat tersendiri ke log sistem, dengan pembatasan frekuensi agar log tetap terbaca saat SIPP sedang berat.",
      "Batas waktu eksekusi query dua lapis: batas sisi server (MAX_EXECUTION_TIME) yang benar-benar menghentikan query di dalam MySQL, dan batas sisi klien sebagai cadangan bila server tidak mengenali lapis pertama.",
      "Pengaturan queryGuard pada runtime config: batas waktu, batas sambungan, dan sakelar untuk mematikan masing-masing lapis.",
    ],
    changed: [
      "Batas sambungan kolam database ditulis eksplisit. Sebelumnya mengandalkan bawaan driver tanpa pernah disebut, sehingga tidak ada yang dapat menghitung berapa query serentak yang sanggup ditanggung SIPP dari bot.",
      "Kolam SIPP utama kini juga memakai batas waktu koneksi, menyamai kolam yang dikelola registry.",
      "Query yang melewati batas waktu dikembalikan dengan pesan berbahasa manusia, bukan kode driver - pesan ini bisa berakhir di layar admin maupun pesan WhatsApp seseorang.",
    ],
    fixed: [
      "Query lambat ke SIPP dapat menghabiskan seluruh kolam sambungan sehingga bot berhenti menjawab siapa pun, termasuk notifikasi terjadwal, tanpa satu pun pesan kesalahan yang jelas.",
    ],
    security: [
      "Batas waktu sisi server melindungi SIPP itu sendiri, bukan hanya bot: query dihentikan di dalam MySQL, tidak sekadar ditinggalkan oleh klien.",
      "Petunjuk batas waktu hanya dipasang pada SELECT tunggal. UPDATE, INSERT, dan pernyataan majemuk dilewati, dan query yang sudah menuliskan batasnya sendiri tidak diganggu.",
      "Pencatatan durasi tidak pernah menggagalkan query yang sudah berhasil: kegagalan mencatat sengaja diabaikan.",
      "Nilai literal dibuang dari sidik query, sehingga nomor perkara dan data pihak tidak ikut tersimpan di statistik.",
    ],
    knownLimitations: [
      "Batas waktu sisi server hanya berlaku pada MySQL 5.7.8 ke atas. Pada versi lama maupun MariaDB, petunjuknya diabaikan sebagai komentar biasa - aman, tetapi perlindungan bersandar pada batas sisi klien saja.",
      "Statistik kinerja query disimpan di memori dan kembali kosong setiap bot direstart. Untuk riwayat jangka panjang diperlukan penyimpanan tersendiri.",
      "Angka yang terkumpul belum menurunkan beban dengan sendirinya. Penurunan beban baru terjadi pada Tahap 3 (potret perkara).",
    ],
    operationalNotes: [
      "Setelah update, biarkan berjalan beberapa hari lalu buka status layanan bot dan periksa daftar query menurut total waktu. Query di urutan teratas itulah sasaran Tahap 3.",
      "Bila ada query sah yang memang perlu berjalan lama, naikkan ALETA_BOT_QUERY_TIMEOUT_MS. Bawaannya 15 detik.",
    ],
  },
  {
    version: "1.8.0",
    title: "ALETA v1.8.0 - Menu Pilihan Perkara dan Tombol Berhenti",
    date: "2026-08-22",
    status: "Operasional",
    summary:
      "Pihak berperkara tidak perlu lagi menghafal perintah seperti 'akta#123.G.2026'. Cukup menyapa bot, lalu memilih dengan membalas angka: perkara mana, lalu informasi apa. Daftar perkaranya diambil dari nomor WhatsApp pengirim, jadi setiap orang hanya melihat perkaranya sendiri. Ditambahkan pula kata BERHENTI untuk menghentikan pemberitahuan otomatis - pengaman anti-blokir yang paling berdampak.",
    added: [
      "Menu pilihan bernomor: bot menampilkan daftar perkara milik nomor WhatsApp pengirim, lalu daftar informasi yang tersedia (jadwal sidang, rincian perkara, biaya dan sisa panjar, akta cerai, salinan putusan, antrian sidang online). Pengguna cukup membalas angka.",
      "Pencarian perkara berdasarkan nomor WhatsApp: nomor pengirim dicocokkan dengan data pihak dan kuasa hukum di SIPP, memakai aturan akses yang sama dengan verifikasi lama.",
      "Kata BERHENTI untuk menghentikan pemberitahuan otomatis, dan LANJUT untuk mengaktifkannya kembali. Baris ajakan otomatis ditempelkan di setiap pemberitahuan ke pihak.",
      "Jumlah penerima yang berhenti berlangganan ditampilkan pada status layanan bot, sebagai peringatan dini bila isi atau frekuensi pesan mulai mengganggu.",
    ],
    changed: [
      "Sapaan pembuka (halo, assalamualaikum, dan sejenisnya) kini dijawab dengan menu perkara bila nomor pengirim memang tercatat pada suatu perkara. Bila tidak tercatat, sambutan lama tetap yang menjawab.",
      "Pemberitahuan ke pihak berperkara otomatis memuat baris cara berhenti. Ditempelkan saat pengiriman, sehingga isi pesan yang sudah disesuaikan admin pun ikut mendapatkannya.",
    ],
    fixed: [],
    security: [
      "Menu TIDAK menambah kewenangan apa pun. Daftar perkara berasal dari pencocokan nomor WhatsApp dengan data pihak/kuasa, dan setiap jawaban tetap melewati pemeriksaan hak akses yang sudah ada. Menu hanya membuat yang memang sudah boleh diakses menjadi mudah ditemukan.",
      "Nomor yang tidak tercatat pada perkara mana pun tidak mendapat menu, melainkan penjelasan dan arahan ke PTSP.",
      "Pilihan angka di luar daftar ditolak dan tidak menjalankan perintah apa pun.",
      "Permintaan BERHENTI selalu didahulukan, termasuk ketika pengguna sedang berada di tengah menu.",
      "Berhenti berlangganan hanya menghentikan pemberitahuan otomatis. Pertanyaan yang dikirim sendiri oleh pengguna tetap dijawab, dan panggilan resmi tetap disampaikan Jurusita atau Petugas Pos seperti biasa.",
    ],
    knownLimitations: [
      "Menu memakai balasan angka, bukan tombol. WhatsApp sudah menghentikan dukungan tombol dan daftar interaktif untuk klien tidak resmi - pesan bertombol tidak lagi tampil di ponsel penerima. Balasan angka bekerja di semua versi WhatsApp tanpa kecuali.",
      "Perkara hanya muncul di menu bila nomor WhatsApp pihak sudah tercatat benar di SIPP. Nomor yang belum diperbarui perlu dilengkapi lewat PTSP.",
      "Sesi menu berakhir mengikuti batas waktu sesi tanya jawab publik (bawaan 20 menit). Setelah itu pengguna cukup mengetik MENU lagi.",
    ],
    operationalNotes: [
      "Perintah lama seperti 'akta#123.G.2026' tetap berfungsi seperti sebelumnya. Menu adalah jalur tambahan, bukan pengganti.",
      "Pantau jumlah opt-out pada status layanan bot. Kenaikan tajam berarti isi atau frekuensi pesan perlu ditinjau sebelum akun bermasalah.",
    ],
  },
  {
    version: "1.7.2",
    title: "ALETA v1.7.2 - Nama Pegawai Ditulis Polos di Pesan",
    date: "2026-08-22",
    status: "Operasional",
    summary:
      "Penyesuaian tampilan pesan internal: nama pegawai tidak lagi ditebalkan. Baris sapaan kini ditulis polos, misalnya 'Ahmad Fauzi, S.H. — Hakim'.",
    added: [],
    changed: [
      "Penanda tebal di sekitar nama pegawai dihapus dari seluruh isi pesan internal pegawai, termasuk pengingat deadline disposisi yang disusun langsung oleh portal.",
    ],
    fixed: [],
    security: [
      "Isi pesan v1.7.1 didaftarkan sebagai bawaan lama, sehingga instalasi yang sudah memakainya ikut diperbarui otomatis. Isi pesan yang sudah disunting sendiri oleh admin tetap tidak ditimpa.",
    ],
    knownLimitations: [],
    operationalNotes: [
      "Tidak ada langkah tambahan. Bila Anda pernah menyunting sendiri isi pesan pegawai, hapus tanda bintang di sekitar nama secara manual lewat Edit Isi Pesan.",
    ],
  },
  {
    version: "1.7.1",
    title: "ALETA v1.7.1 - Pesan Berjarak, Bahasa Manusia, dan Penjelasan Variabel",
    date: "2026-08-22",
    status: "Operasional",
    summary:
      "Melengkapi 1.7.0. Notifikasi sejenis tidak lagi berangkat serentak: setiap pesan kini dijadwalkan pada waktunya sendiri dengan jarak acak, satu nomor tidak diberondong, dan notifikasi malam dipindah rapi ke jam kirim berikutnya. Isi pesan juga dibersihkan dari nama variabel/kode, pesan untuk pegawai langsung menyebut nama dan jabatan tanpa perkenalan bot, serta editor isi pesan kini menjelaskan arti tiap variabel beserta sumber datanya.",
    added: [
      "Penjadwalan berjarak antar pesan (sendingPace): tiap pesan notifikasi mendapat jadwal kirim sendiri yang bergeser maju dari pesan sebelumnya dengan jarak acak. Berlaku juga untuk kirim ulang massal dari daftar pesan gagal.",
      "Jeda per nomor penerima: satu nomor tidak menerima dua pesan berdekatan; pesan berikutnya digeser sampai jedanya terlewati.",
      "Pemindahan otomatis pesan di luar jam kirim ke pembukaan jam berikutnya, tetap menyebar berjarak sehingga antrean semalam tidak meledak serentak saat jam buka.",
      "Panel 'Pilihan Variabel & Artinya' di editor isi pesan: tiap variabel punya label, keterangan singkat, dan saat diklik terbuka penjelasan lengkap, asal data, sumber data yang memasoknya, serta contoh hasil di layar penerima. Kolom bebas dari sumber data ikut dijelaskan.",
      "Variabel {{jabatan}} untuk pesan internal pegawai, selalu terisi (memakai 'Pegawai' bila jabatan tidak diketahui).",
      "Slider Risiko menampilkan knob baru: jarak antar pesan, jeda per nomor sama, dan keterangan singkat tiap knob.",
    ],
    changed: [
      "Pesan untuk pegawai tidak lagi memperkenalkan diri sebagai bot ('Hai, saya Aleta'). Pesan langsung menyebut nama dan jabatan penerima di baris pertama lalu masuk ke pokok informasinya.",
      "Ringkasan otomatis tidak lagi mengulang nama dan nomor perkara yang sudah dicetak di bagian atas pesan; tanggal ditulis dalam bentuk wajar ('8 September 2026', bukan 2026-09-08).",
      "Laju kirim kini dikendalikan oleh jarak antar pesan, sedangkan batas per menit/jam/hari diposisikan di atasnya sebagai rem darurat — supaya batas tidak lagi memicu antrean gagal dan pengiriman ulang menumpuk.",
      "Perkiraan waktu tunggu antrean ikut memperhitungkan jarak antar pesan.",
    ],
    fixed: [
      "Notifikasi dengan tipe sama terkirim dalam waktu yang sama persis walau Mode Risiko sudah Minimal, karena seluruh pesan satu kali jalan dimasukkan ke antrean dengan jadwal kirim yang identik.",
      "Pesan ke pihak berperkara menampilkan nama variabel mentah seperti 'nomor_perkara: 531/Pdt.G/2026/PA.Dgl' dan 'tanggal_sidang: 08-09-2026', terbaca seperti kebocoran kode program.",
      "Nomor telepon dan id internal ikut terbawa ke dalam ringkasan otomatis pesan penerima.",
      "Interval pemroses antrean terkunci sejak bot dinyalakan, sehingga perubahan Mode Risiko baru berlaku setelah bot direstart. Kini setiap tik membaca ulang konfigurasi.",
      "Balasan perintah chat juga memakai nama kolom mentah pada jawabannya.",
    ],
    security: [
      "Pengaman terakhir sebelum kirim: sisa placeholder yang tidak terisi dan format kolom mentah dibersihkan dari isi pesan, termasuk pada isi pesan lama yang sudah tersimpan di database.",
      "Isi pesan yang sudah disunting sendiri oleh admin tidak pernah ditimpa saat update; hanya isi pesan yang masih persis bawaan versi lama yang diperbarui.",
      "Pesan interaktif (balasan chat, kirim manual, pesan sistem) sengaja dikecualikan dari penjadwalan berjarak agar tetap dijawab cepat.",
    ],
    knownLimitations: [
      "whatsapp-web.js tetap otomatisasi tidak resmi; seluruh perbaikan ini menurunkan peluang suspend/banned, tidak menghilangkannya. Jalur bebas banned yang sesungguhnya tetap WhatsApp Business Cloud API resmi.",
      "Pada Mode Minimal, notifikasi bervolume besar akan tersebar lebih lama (sekitar 120 pesan per jam) dan yang jatuh setelah pukul 16:00 baru berangkat pukul 08:00 keesokan harinya.",
    ],
    operationalNotes: [
      "Setelah update, buka Edit Isi Pesan untuk memastikan isi pesan pegawai sudah memakai nama dan jabatan. Isi pesan yang pernah Anda sunting sendiri tetap utuh dan perlu disesuaikan manual bila masih memuat sapaan bot lama.",
      "Bila notifikasi terasa lebih lambat sampai, itu memang perilaku yang diinginkan pada Mode Minimal. Naikkan satu tingkat ke Rendah bila perlu lebih cepat dan akun sudah stabil.",
    ],
  },
  {
    version: "1.7.0",
    title: "ALETA v1.7.0 - Slider Risiko Anti Suspend/Banned WhatsApp",
    date: "2026-08-21",
    status: "Operasional",
    summary:
      "Menambahkan Slider Risiko 5 tingkat di dashboard ALETA Bot untuk memitigasi risiko suspend/banned akun WhatsApp. Geser ke Minimal (default) agar seluruh sistem kirim paling aman, atau ke Maksimal untuk kecepatan penuh. Satu geseran langsung menyetel jeda antar pesan, batas per menit/jam/hari, batch antrean, dan jam kirim sekaligus. Bot juga kini memakai jitter (jeda acak) agar polanya tidak seperti bot.",
    added: [
      "Slider Risiko Suspend/Banned di dashboard ALETA Bot: 5 tingkat (Minimal, Rendah, Sedang, Tinggi, Maksimal) dengan label risiko dan rincian batas kirim tiap tingkat.",
      "Jitter jeda antar pesan pada bot: jeda diacak dalam rentang min-maks tiap tingkat agar tidak mudah dikenali sebagai bot oleh WhatsApp.",
    ],
    changed: [
      "Portal kini menurunkan seluruh knob anti-ban (jeda, rate limit per menit/jam/hari, batch antrean, jendela jam kirim) dari tingkat slider yang dipilih, lalu mendorongnya ke runtime bot. Nilai preset OVERRIDE jeda manual lama.",
      "Default sistem baru = Minimal (paling aman dari suspend/banned): jeda 12-20 dtk, batas 3/menit, broadcast wajib disetujui, jam kirim 08:00-16:00.",
    ],
    fixed: [
      "Interval kirim yang persis sama tiap pesan (jeda tetap) adalah ciri bot yang paling mudah dideteksi WhatsApp; kini jeda diacak dalam rentang.",
    ],
    security: [
      "Struktur knob yang sudah ada dipakai apa adanya (rateLimit, queueWorker, sendingWindow); tidak ada perubahan struktur runtime, hanya nilai yang diisi portal.",
      "Konfigurasi lama tetap aman: bila rentang maks jeda tidak diisi, bot memakai jeda tetap seperti sebelumnya.",
    ],
    knownLimitations: [
      "whatsapp-web.js tetap otomasi tidak resmi; Slider Risiko hanya MENURUNKAN peluang suspend/banned, tidak menghilangkannya. Jalur bebas-banned yang sesungguhnya adalah WhatsApp Business Cloud API resmi.",
      "Perubahan tingkat butuh layanan bot aktif untuk langsung dipakai; bila bot offline, preset diterapkan setelah sinkronisasi berikutnya.",
    ],
    operationalNotes: [
      "Setelah update, buka dashboard ALETA Bot -> geser Slider Risiko. Untuk akun yang sedang/pernah ditinjau, pilih Minimal dan biarkan beberapa hari sebelum menaikkan.",
      "Naikkan tingkat secara bertahap hanya bila memang butuh kecepatan kirim lebih tinggi dan akun sudah stabil.",
    ],
  },
  {
    version: "1.6.9",
    title: "ALETA v1.6.9 - Bot Menerima API Key yang Diteruskan Portal",
    date: "2026-08-05",
    status: "Operasional",
    summary:
      "Melengkapi 1.6.8: ALETA Bot kini MENERIMA konfigurasi AI saat API key diteruskan langsung dari portal, tidak lagi menolaknya dengan HTTP 400. AI bot langsung sinkron tanpa perlu mengisi env atau flag apa pun.",
    added: [],
    changed: [
      "Guard produksi AI bot menolak HANYA bila benar-benar tidak ada key. Key yang diteruskan portal (jalur internal bertoken) kini dianggap tersedia dan diterima.",
    ],
    fixed: [
      "Sinkronkan AI ke ALETA Bot gagal dengan 'Runtime ALETA Bot merespons HTTP 400' walau portal sudah meneruskan API key: guard bot dulu hanya memeriksa ENV key sehingga menolak key yang diteruskan dari UI portal.",
    ],
    security: [
      "Key tetap tidak pernah ditulis ke disk bot (hanya di memori); metadata konfigurasi tersimpan tanpa secret.",
      "Bila tidak ada key sama sekali, konfigurasi tetap ditolak dengan pesan langkah perbaikan yang jelas.",
    ],
    knownLimitations: [
      "Key yang diteruskan disimpan di memori bot; setelah bot restart, portal mendorong ulang otomatis saat konfigurasi AI berikutnya disimpan. Untuk persisten, isi GEMINI_API_KEY di .env.production.",
    ],
    operationalNotes: [
      "Setelah update, tekan 'Sinkronkan AI ke ALETA Bot' sekali. Kartu Jembatan AI akan berubah Aktif dan Uji Layanan AI berhasil.",
    ],
  },
  {
    version: "1.6.8",
    title: "ALETA v1.6.8 - AI Portal Otomatis Tersinkron ke ALETA Bot",
    date: "2026-08-04",
    status: "Operasional",
    summary:
      "API key AI yang diisi di Pengaturan AI portal kini otomatis diteruskan ke ALETA Bot bila tidak ada env key khusus, sehingga AI bot (jawaban WhatsApp, klasifikasi) langsung ikut aktif.",
    added: [],
    changed: [
      "Pemilihan sumber API key AI bot kini berdasarkan APAKAH env key benar-benar terisi, bukan sekadar mode production. Bila env key kosong, key dari UI portal diteruskan ke bot lewat jalur internal bertoken.",
    ],
    fixed: [
      "AI portal berhasil terhubung tetapi AI di ALETA Bot 'tidak sinkron': portal mengosongkan key di production dan mengharap bot membaca GEMINI_API_KEY dari env, padahal admin hanya mengisi key di UI portal sehingga bot berjalan tanpa key.",
    ],
    security: [
      "Bila operator mengisi env key (mis. GEMINI_API_KEY di .env.production), jalur env-secret tetap dipakai dan key TIDAK dikirim lewat jembatan — persis seperti sebelumnya.",
      "Key hanya diteruskan lewat jalur internal antar container yang bertoken, bukan jaringan publik.",
    ],
    knownLimitations: [
      "Key yang diteruskan (bukan dari env) disimpan di memori bot, jadi setelah bot restart perlu sinkron ulang otomatis — terjadi sendiri saat konfigurasi AI berikutnya disimpan.",
    ],
    operationalNotes: [
      "Setelah update, buka Pengaturan AI lalu simpan/Uji koneksi sekali agar portal mendorong ulang konfigurasi ke bot; status ALETA Bot / WhatsApp AI akan ikut aktif.",
      "Untuk key yang persisten lintas restart tanpa sinkron ulang, isi GEMINI_API_KEY di .env.production.",
    ],
  },
  {
    version: "1.6.7",
    title: "ALETA v1.6.7 - Preview Penerima Menampilkan Data Nyata Per Penerima",
    date: "2026-08-04",
    status: "Operasional",
    summary:
      "Tombol Preview Penerima kini menampilkan data SIPP yang sebenarnya (nomor perkara, agenda, jam, ruang) untuk tiap penerima, difilter per hakim/pihak dan tidak tercampur.",
    added: [],
    changed: [
      "Preview Penerima mengambil data nyata dari runtime bot dan merender pesan PER PENERIMA (sama persis dengan yang akan dikirim), bukan lagi contoh generik.",
    ],
    fixed: [
      "Preview Penerima menampilkan format pesan benar tetapi tanpa data (nomor perkara, agenda, jam, ruang) karena portal tidak mengakses SIPP dan hanya memakai contoh aman.",
    ],
    security: [
      "Nomor WhatsApp tetap disamarkan di preview; per-hakim tetap terpisah sehingga data perkara tidak tercampur antar penerima.",
    ],
    knownLimitations: [
      "Bila runtime bot tidak terjangkau (mis. mode portal-only), preview jatuh ke contoh aman tanpa data nyata dan tidak error.",
    ],
    operationalNotes: [
      "Preview memanggil query SIPP per penerima sehingga sedikit lebih lama; ini normal untuk sumber data pegawai.",
    ],
  },
  {
    version: "1.6.6",
    title: "ALETA v1.6.6 - Notifikasi Pihak Bawaan Aktif Tanpa Ritual + Jam Antrian",
    date: "2026-08-04",
    status: "Operasional",
    summary:
      "Notifikasi pihak bawaan standar kini bisa langsung diaktifkan tanpa perlu simulasi/preview/approval/migrasi, alur migrasi jalur lama tidak lagi buntu, dan jam pendaftaran antrian online tidak bergeser zona waktu.",
    added: [],
    changed: [
      "Notifikasi PIHAK bawaan (pengingat sidang, akta cerai, perkara baru, dll) diperlakukan sudah-disetujui secara bawaan: admin cukup mengaktifkan dan mengisi jadwal. Notifikasi pihak BUATAN admin tetap dijaga (wajib simulasi, preview, approval).",
    ],
    fixed: [
      "Notifikasi pihak bawaan mustahil diaktifkan: badge Approval selalu Belum karena entityId approval migrasi (party-*) tidak pernah sama dengan id notifikasi (pihak-*).",
      "Aktivasi registry di Migrasi Jalur Lama melempar Duplicate path guard karena bug melingkar (aktivasi butuh legacy disabled, tetapi disable-legacy butuh registry aktif). Guard melingkar dihapus; urutan aktifkan-registry lalu disable-legacy kini berjalan.",
      "Jam pendaftaran Antrian Sidang Online meleset +8 jam karena waktu jam dinding WITA ditafsirkan sebagai UTC. Kini diformat langsung oleh MySQL sebagai teks jam dinding.",
    ],
    security: [
      "Penjagaan notifikasi pihak buatan admin tidak diubah: yang dibebaskan hanya notifikasi bawaan standar yang dikirim developer.",
    ],
    knownLimitations: [
      "Pengiriman ganda antara cron legacy dan registry dicegah oleh mode registry-takeover yang menonaktifkan cron legacy secara bawaan.",
    ],
    operationalNotes: [
      "Setelah update, aktifkan notifikasi pihak yang diinginkan di tab Notifikasi lalu isi jadwalnya; badge Approval sudah otomatis hijau untuk notifikasi bawaan.",
      "Perbaikan jam antrian dan notifikasi ada di layanan bot; installer membangun ulang portal dan bot.",
    ],
  },
  {
    version: "1.6.5",
    title: "ALETA v1.6.5 - Default DNS Warisi Host",
    date: "2026-08-03",
    status: "Operasional",
    summary:
      "Memperbaiki default DNS yang diperkenalkan 1.6.4: container portal kini mewarisi DNS host secara default, bukan dipaksa ke 8.8.8.8. Menutup risiko update yang mematahkan satker yang AI-nya sudah jalan.",
    added: [],
    changed: [
      "docker-compose.yml: DNS portal default kosong sehingga Compose menghapus kunci dns dan container mewarisi DNS host (perilaku Docker bawaan). Override tetap tersedia lewat ALETA_DNS_PRIMARY / ALETA_DNS_SECONDARY.",
      ".env.production.example memperjelas langkah bila DNS host tidak cukup.",
    ],
    fixed: [
      "Default DNS 8.8.8.8 dari 1.6.4 dapat mematahkan koneksi AI di jaringan yang memblokir DNS publik tetapi punya DNS internal. Default baru mewarisi DNS host, jadi tidak mengubah perilaku satker yang sudah berfungsi.",
    ],
    security: [
      "Perubahan hanya menyangkut penerus DNS eksternal; resolusi antar-container tetap ditangani DNS internal Docker.",
    ],
    knownLimitations: [
      "Bila DNS host memakai stub lokal (127.0.0.53) yang tidak dapat dijangkau container, isi ALETA_DNS_PRIMARY dengan DNS internal yang routable, bukan 127.0.0.x.",
    ],
    operationalNotes: [
      "Satker yang koneksi AI-nya gagal EAI_AGAIN: isi ALETA_DNS_PRIMARY di berkas .env (di samping docker-compose.yml) dengan DNS internal dari /etc/resolv.conf host, lalu docker compose up -d portal.",
      "Nilai DNS yang benar dapat dicari dengan: docker compose exec portal node scripts/diagnose-ai-dns.js.",
    ],
  },
  {
    version: "1.6.4",
    title: "ALETA v1.6.4 - Perbaikan DNS Koneksi AI",
    date: "2026-08-02",
    status: "Operasional",
    summary:
      "Container portal kini punya DNS resolver eksplisit, menutup kegagalan koneksi AI 'getaddrinfo EAI_AGAIN' yang muncul walau server sudah terhubung internet.",
    added: [
      "Skrip diagnosa DNS scripts/diagnose-ai-dns.js yang menguji resolver mana yang bisa menerjemahkan nama penyedia AI dari dalam container portal.",
    ],
    changed: [
      "docker-compose.yml: layanan portal diberi DNS resolver eksplisit (default 8.8.8.8 dan 1.1.1.1), dapat diganti lewat ALETA_DNS_PRIMARY / ALETA_DNS_SECONDARY untuk DNS internal kantor.",
      ".env.production.example mendokumentasikan langkah bila koneksi AI gagal karena DNS atau proxy.",
    ],
    fixed: [
      "Koneksi AI gagal dengan 'getaddrinfo EAI_AGAIN generativelanguage.googleapis.com' karena container portal bergantung pada penerus DNS bawaan Docker yang tidak berfungsi. Resolver eksplisit menutup masalah ini.",
    ],
    security: [
      "DNS eksplisit hanya menerus nama eksternal; resolusi nama antar-container tetap ditangani DNS internal Docker, jadi tidak membuka jalur baru.",
    ],
    knownLimitations: [
      "Bila jaringan kantor memblokir DNS/port 53 dan port 443 keluar sepenuhnya, DNS eksplisit tidak cukup; arahkan ALETA keluar lewat proxy kantor (HTTPS_PROXY).",
      "Resolusi antar-service (portal ke postgres) tetap ditangani DNS internal Docker dan tidak terpengaruh perubahan ini.",
    ],
    operationalNotes: [
      "Setelah update, bangun ulang container portal agar DNS baru terpakai: cd /var/www/html/aleta && docker compose up -d portal.",
      "Bila masih gagal, jalankan: docker compose exec portal node scripts/diagnose-ai-dns.js — hasilnya menunjukkan resolver mana yang harus dipakai.",
    ],
  },
  {
    version: "1.6.3",
    title: "ALETA v1.6.3 - Blokir Akun, Antrian Online, Aturan Jawaban, dan Update Antar-Satker",
    date: "2026-08-02",
    status: "Operasional",
    summary:
      "Blokir akun kini memutus akses ke seluruh ALETA termasuk pengiriman WhatsApp, ALETA Bot berhenti membalas status, ada tab pemantauan antrian sidang online, aturan jawaban publik lebih fleksibel dengan blangko yang bisa diedit, serta pemberitahuan dan unduh update antar-satker.",
    added: [
      "Tab Antrian Sidang Online di halaman ALETA Bot: daftar antrian, ringkasan, dan log pendaftaran, plus penanda jelas saat basis data antrian tidak terjangkau.",
      "Blangko Jawaban dan Kata Kunci Pengenal yang bisa diedit pada Aturan Jawaban publik.",
      "Pemberitahuan update antar-satker: bila ada versi baru dan server terhubung internet, halaman Pembaruan Sistem menampilkan tombol Unduh Paket Update.",
      "Skrip publikasi rilis scripts/aleta-make-update-manifest.sh dan pemulihan darurat super-admin scripts/aleta-reset-super-admin.sh.",
    ],
    changed: [
      "Pencocokan pertanyaan publik tidak lagi kaku: ragam tulisan (akte/akta, brp/berapa), salah ketik satu-dua huruf, dan kata kunci buatan admin ikut dikenali.",
      "Aturan jawaban publik tidak lagi mengenal tahap draft; setiap aturan yang disimpan langsung berlaku.",
      "Manajemen Surat dan pemilih pengguna hanya menampilkan akun aktif; akun diblokir tetap terlihat oleh admin di Manajemen Akun agar blokirnya bisa dibuka.",
      "Pengecekan dan pengunduhan update menghormati HTTPS_PROXY, sehingga satker di balik proxy tetap terlayani.",
    ],
    fixed: [
      "Akun yang diblokir masih menerima WhatsApp saat namanya muncul dari data SIPP. ALETA Bot kini menahan pengiriman ke akun terblokir berdasarkan nomor maupun nama.",
      "ALETA Bot bisa membalas status WhatsApp orang. Kini status dan saluran siaran diabaikan; bot hanya membalas chat langsung dan mengirim notifikasi terjadwal.",
      "Aturan akta cerai, biaya, dan jadwal sidang tidak bisa disimpan karena menunjuk sumber data yang tidak ada; rujukan mati itu dibersihkan.",
      "Blangko jawaban tersimpan tetapi tidak terbaca karena kolom baru tidak ikut diambil query; diperbaiki.",
    ],
    security: [
      "Skrip pemulihan super-admin bukan backdoor: tidak ada jalur web, hanya bisa dijalankan dari host (SSH/root + Docker), dan dicatat di Audit Trail sebagai SUPER_ADMIN_EMERGENCY_RESET.",
      "Unduhan update menolak paket tanpa checksum SHA256 di manifest, memeriksa isi (gzip), dan membatasi ukuran. Penerapan tetap di host, portal tidak diberi akses folder aplikasi maupun Docker.",
      "Pemblokiran berbasis nama sengaja konservatif: bila dua orang bernama sama dan salah satunya diblokir, keduanya tertahan, dan alasannya dicatat di log.",
    ],
    knownLimitations: [
      "Penerapan update tetap dijalankan di host lewat skrip terverifikasi; portal hanya menampung paket.",
      "Pembacaan form login SSO hanya bekerja bila aplikasi tujuan satu origin dengan ALETA; bila beda origin, jembatan jatuh ke pengaturan panel.",
    ],
    operationalNotes: [
      "Isi username SIPP tiap pegawai di Manajemen Akun agar login memakai akun SIPP dan masuk otomatis ke SIPP/APS berfungsi.",
      "Untuk pemberitahuan update, set ALETA_UPDATE_MANIFEST_URL di .env.production ke alamat manifest rilis; kosongkan bila tidak dipakai.",
      "Pemulihan darurat: jalankan bash scripts/aleta-reset-super-admin.sh di host, lalu segera ganti password dari halaman Akun dan tinjau Audit Trail.",
      "Isi Blangko Jawaban untuk aturan akta cerai dan biaya setelah update, karena fiturnya siap tetapi teksnya harus disusun admin.",
    ],
  },
  {
    version: "1.6.2",
    title: "ALETA v1.6.2 - Jalur Keluar AI Sadar Proxy",
    date: "2026-08-02",
    status: "Operasional",
    summary:
      "Panggilan ke penyedia AI kini mengenali proxy jaringan kantor, punya batas waktu, dan melaporkan lapisan mana yang putus alih-alih hanya menulis 'fetch failed'.",
    added: [
      "Dukungan proxy keluar lewat HTTPS_PROXY/HTTP_PROXY/NO_PROXY, termasuk proxy yang meminta login. Sebelumnya variabel ini diabaikan total oleh fetch bawaan Node.",
      "Skrip diagnosa scripts/diagnose-ai-network.js yang menguji berurutan proxy, DNS, TCP, TLS, lalu HTTPS dan menunjuk titik putusnya.",
      "Deteksi penyadapan TLS: bila sertifikat penyedia diganti perangkat kantor, saran mengarah ke NODE_EXTRA_CA_CERTS, bukan ke firewall.",
    ],
    changed: [
      "Setiap panggilan AI keluar dibatasi 30 detik, sehingga paket yang ditahan firewall gagal cepat dengan keterangan, bukan menggantung.",
      "Saran penanganan dipisah per sebab: DNS, waktu habis, koneksi ditolak, sertifikat disadap, dan proxy bermasalah masing-masing punya langkah sendiri.",
      "Variabel proxy dan NODE_EXTRA_CA_CERTS didokumentasikan di .env.example.",
    ],
    fixed: [
      "Uji Koneksi AI hanya menampilkan 'fetch failed' tanpa sebab. Rantai penyebab yang disimpan undici di properti cause kini ikut digali dan ditampilkan.",
      "Di jaringan yang mewajibkan proxy, seluruh panggilan AI selalu gagal dan tidak ada cara memperbaikinya lewat konfigurasi.",
    ],
    security: [
      "API key tetap disensor pada seluruh pesan diagnosa, termasuk pesan berlapis hasil penggalian rantai penyebab.",
      "Kredensial proxy hanya dipakai untuk header Proxy-Authorization dan disamarkan saat dicetak skrip diagnosa.",
    ],
    knownLimitations: [
      "ALETA tidak dapat membuka akses keluar sendiri. Bila firewall kantor menutup port 443, perbaikannya tetap di sisi jaringan - ALETA hanya menunjukkan letak masalahnya.",
      "Proxy SOCKS belum didukung; baru proxy HTTP/HTTPS.",
    ],
    operationalNotes: [
      "Isi HTTPS_PROXY di .env.production hanya bila jaringan kantor mewajibkan proxy. Dikosongkan berarti ALETA menghubungi penyedia secara langsung.",
      "NO_PROXY wajib memuat layanan internal (localhost, aleta_bot, postgres, 192.168.10.10) agar lalu lintas dalam server tidak ikut dibelokkan ke proxy.",
      "Jalankan docker compose exec portal node scripts/diagnose-ai-network.js untuk memastikan letak putusnya sebelum menghubungi admin jaringan.",
    ],
  },
  {
    version: "1.6.1",
    title: "ALETA v1.6.1 - Login Akun SIPP/APS dan Jembatan SSO",
    date: "2026-07-31",
    status: "Operasional",
    summary:
      "Pegawai kini dapat masuk ALETA memakai username SIPP/APS yang sudah mereka hafal, dan kartu SIPP/APS di grid Portal benar-benar membuka aplikasi tujuan dalam keadaan sudah login.",
    added: [
      "Username aplikasi eksternal (SIPP/APS Badilag) diterima sebagai identitas login ALETA.",
      "Jembatan SSO membaca form login aplikasi tujuan lebih dulu, lalu mengikuti nama field, URL proses, dan token CSRF milik aplikasi itu sendiri.",
    ],
    changed: [
      "NIP dibandingkan sebagai angka saja, sehingga NIP yang disalin dengan spasi atau titik pemisah tetap dikenali.",
      "Placeholder kolom identitas pada halaman login menyebutkan username SIPP.",
      "Jembatan SSO menampilkan status proses dan menyediakan tombol masuk manual bila pengiriman otomatis tidak memungkinkan.",
    ],
    fixed: [
      "Login ALETA memakai akun SIPP/APS ditolak dengan pesan 'Akun backend tidak ditemukan atau sudah nonaktif' walaupun akunnya aktif, karena pencarian hanya melihat identitas milik ALETA.",
      "Klik kartu SIPP dan APS Badilag tidak masuk otomatis. Kredensial dikirim buta tanpa token CSRF dan dengan nama field tebakan, sehingga aplikasi tujuan memantulkan pengguna kembali ke halaman login tanpa keterangan.",
      "Pengiriman form jembatan bisa gagal diam bila aplikasi tujuan punya input bernama submit. Pengiriman kini lewat HTMLFormElement.prototype.",
    ],
    security: [
      "Username SIPP hanya dipakai untuk MENEMUKAN akun. Password tetap diverifikasi memakai password ALETA lewat jalur autentikasi biasa, jadi tidak ada pelemahan autentikasi.",
      "Bila satu username SIPP menunjuk lebih dari satu akun ALETA, login ditolak - lebih baik gagal daripada mengarahkan pegawai ke akun rekannya.",
      "Konfigurasi pada halaman jembatan menyamarkan karakter '<', sehingga username yang memuat markup tidak dapat menutup tag script lebih awal.",
      "Jembatan berhenti dan memberi tahu bila aplikasi tujuan memakai captcha, alih-alih mengirim password berulang tanpa hasil.",
    ],
    operationalNotes: [
      "Tidak ada perubahan skema database pada rilis ini.",
      "Perbaikan berada di portal saja, tetapi paket ini masih memuat perbaikan bot dari 1.6.0, jadi bangun ulang keduanya.",
      "Agar login memakai akun SIPP berfungsi, username SIPP pegawai harus terisi di Manajemen Akun ALETA.",
      "Uji setelah update: npx vitest run src/test/aleta-sso-login.test.ts",
    ],
    knownLimitations: [
      "Pembacaan form login hanya berjalan bila aplikasi tujuan satu origin dengan ALETA. Bila berbeda origin, browser memblokir pembacaan dan jembatan otomatis kembali ke pengiriman sesuai pengaturan panel.",
      "Aplikasi tujuan yang memakai captcha tidak dapat dimasuki otomatis. Jembatan akan menyatakannya, bukan gagal diam.",
      "Mode password (plain atau MD5) tetap diambil dari Pengaturan Panel karena tidak dapat disimpulkan dari halaman login.",
    ],
  },
  {
    version: "1.6.0",
    title: "ALETA v1.6.0 - Tanggal Jalur Lama, Diagnosis AI, dan Update via Web",
    date: "2026-07-30",
    status: "Operasional",
    summary:
      "Tanggal acuan kini berlaku untuk SELURUH sumber data termasuk jalur lama, uji koneksi AI menampilkan sebab sesungguhnya, versi pada halaman Pembaruan Sistem disamakan dengan kode yang berjalan, dan paket pembaruan dapat diunggah langsung dari halaman web.",
    added: [
      "Unggah paket pembaruan .tar.gz langsung dari halaman Pembaruan Sistem, tanpa menyalin berkas lewat SSH.",
      "Skrip penerap paket unggahan di host: scripts/aleta-apply-uploaded-update.sh, lengkap dengan mode --watch untuk penerapan otomatis.",
      "Saran penanganan pada kegagalan uji koneksi AI: masalah jaringan, API key ditolak, model tidak dikenal, API belum diaktifkan, atau kuota habis.",
      "Modul konteks tanggal jalur lama: aleta_bot/services/legacyDateContext.js.",
    ],
    changed: [
      "Sumber data jalur lama kini ikut mendukung tanggal acuan. CURDATE() digantikan saat eksekusi lewat satu pintu db_config.js, sehingga tidak ada satu pun SQL lama yang perlu ditulis ulang dan fungsinya tidak berubah.",
      "Versi terpasang pada Update Manager diambil dari kode yang benar-benar berjalan, bukan dari berkas state yang bisa tertinggal.",
    ],
    fixed: [
      "Uji koneksi AI selalu menampilkan kalimat umum sehingga sebabnya tidak dapat diketahui. Pesan asli penyedia kini ditampilkan dengan secret tetap disensor.",
      "Halaman Pembaruan Sistem menampilkan versi 1.1.3 berdampingan dengan label versi terbaru karena berkas state didahulukan atas versi kode.",
    ],
    security: [
      "Unggahan paket dibatasi Super Admin, diperiksa tanda pengenal gzip, ukuran, dan checksum. Nama berkas yang memuat pemisah folder ditolak terang-terangan, bukan dipangkas diam-diam.",
      "Portal tetap tidak diberi akses ke folder aplikasi maupun socket Docker. Penerapan paket dikerjakan skrip host yang memeriksa ulang checksum dan menolak arsip berisi path absolut atau ../.",
      "Pesan diagnosis AI menyensor API key Google dan OpenAI walau muncul tanpa label.",
    ],
    operationalNotes: [
      "Tidak ada perubahan skema database pada rilis ini.",
      "Perbaikan berada di portal DAN ALETA Bot, jadi keduanya wajib dibangun ulang saat update.",
      "Agar unggahan diterapkan otomatis, jalankan sekali di host: nohup bash scripts/aleta-apply-uploaded-update.sh --watch &",
      "Uji setelah update: docker compose exec aleta_bot node scripts/verify-legacy-reference-date.js",
    ],
    knownLimitations: [
      "Penerapan paket tetap dikerjakan di host. Memberi container akses Docker akan menjadikan portal jalur pengambilalihan server bila suatu saat jebol.",
      "Pseudo-query portal: dan runtime: tidak mendukung tanggal acuan karena dieksekusi layanan khusus, bukan SQL.",
    ],
  },
  {
    version: "1.5.13",
    title: "ALETA v1.5.13 - Perbaikan Sinkronisasi AI ke ALETA Bot",
    date: "2026-07-30",
    status: "Operasional",
    summary:
      "Tombol Sinkronkan AI ke ALETA Bot gagal karena API key AI tidak tersedia bagi container bot, sedangkan jalur alternatif yang sudah disediakan ternyata tidak pernah berfungsi. Kedua jalur kini benar dan pesan kesalahannya menyebutkan langkah konkret.",
    added: [
      "Dokumentasi kedua cara memasok API key AI pada .env.production.example, beserta konsekuensi masing-masing.",
    ],
    changed: [
      "Pesan kegagalan sinkronisasi AI kini menyebutkan nama variabel yang dicari, berkas yang harus disunting, dan perintah yang perlu dijalankan.",
    ],
    fixed: [
      "ALETA_BOT_ALLOW_VOLATILE_AI_SECRET tidak pernah berfungsi: variabel itu hanya dibaca sisi ALETA Bot, sementara portal tetap mengosongkan API key pada mode production. Akibatnya pemeriksaan lolos tetapi bot berjalan tanpa API key sama sekali. Portal kini benar-benar mengirim key bila opsi tersebut diaktifkan.",
    ],
    security: [
      "Perilaku bawaan tidak berubah: pada production API key tetap diambil dari variabel lingkungan container dan portal tidak mengirim secret. Pengiriman key lewat jalur internal bertoken hanya terjadi bila operator mengaktifkannya secara eksplisit.",
    ],
    operationalNotes: [
      "Tidak ada perubahan skema database pada rilis ini.",
      "Cara 1: tambahkan GEMINI_API_KEY pada .env.production lalu jalankan docker compose up -d aleta_bot.",
      "Cara 2: tambahkan ALETA_BOT_ALLOW_VOLATILE_AI_SECRET=true pada .env.production lalu jalankan docker compose up -d portal aleta_bot.",
      "Bila fitur AI memang tidak dipakai, biarkan AI nonaktif di Pengaturan AI portal dan sinkronisasi tidak perlu dijalankan.",
    ],
    knownLimitations: [
      "Pada Cara 2, API key hanya tersimpan di memori ALETA Bot sehingga sinkronisasi wajib diulang setiap container aleta_bot direstart.",
    ],
  },
  {
    version: "1.5.12",
    title: "ALETA v1.5.12 - Tanggal Acuan untuk Semua Sumber Data",
    date: "2026-07-30",
    status: "Operasional",
    summary:
      "Pemilih tanggal kini berlaku untuk seluruh sumber data SQL, bukan hanya yang punya parameter tanggal. Memilih tanggal berarti menjalankan sumber data seolah hari ini adalah tanggal tersebut, sehingga query relatif seperti H-1 dan H-3 ikut bergeser mengikutinya.",
    added: [
      "Kartu Tanggal acuan pada tab Kirim Manual dengan pilihan cepat Hari ini, Besok, dan +3 hari.",
      "Keterangan tegas bila sumber data tidak dapat diubah tanggalnya, yaitu sumber data jalur lama yang tanggalnya dipatok di dalam kode.",
    ],
    changed: [
      "CURDATE() dan CURRENT_DATE di dalam SQL sumber data digantikan tanggal acuan sebagai nilai terikat, sehingga satu pemilih tanggal berlaku pada semua skenario.",
      "Tampilan tanggal dirapikan menjadi satu kartu ringkas: ikon kalender, kolom tanggal, pilihan cepat berbentuk chip, dan keterangan tanggal aktif dalam bahasa Indonesia.",
      "Parameter tanggal tidak lagi ditampilkan dua kali; pengisiannya disatukan pada kartu Tanggal acuan.",
      "Tanggal acuan dikembalikan ke hari ini setiap kali sumber data diganti, agar tidak terbawa diam-diam ke sumber data yang maknanya berbeda.",
    ],
    fixed: [
      "Tanggal yang baru dipilih tidak terbawa saat pratinjau dijalankan karena tidak masuk daftar kebergantungan, sehingga hasilnya masih memakai tanggal sebelumnya.",
    ],
    security: [
      "Tanggal acuan tetap dikirim sebagai prepared statement, termasuk saat satu SQL memuat beberapa penanda tanggal sekaligus. Urutan nilai terikat diverifikasi tetap sejajar dengan urutan tanda tanya walau bercampur dengan parameter lain.",
    ],
    operationalNotes: [
      "Tidak ada perubahan skema database pada rilis ini.",
      "Perbaikan berada di portal DAN ALETA Bot, jadi keduanya wajib dibangun ulang saat update.",
      "Uji setelah update: docker compose exec aleta_bot node scripts/verify-party-coverage.js",
    ],
    knownLimitations: [
      "Sumber data jalur lama memakai tanggal bawaan dari SIPP dan tidak dapat diubah tanggalnya, karena tanggalnya ditulis di dalam notifikasi.js dan bukan di SQL.",
    ],
  },
  {
    version: "1.5.11",
    title: "ALETA v1.5.11 - Pratinjau Pegawai Tidak Lagi Kehabisan Waktu",
    date: "2026-07-28",
    status: "Operasional",
    summary:
      "Setelah v1.5.10 membuat sumber data pegawai benar-benar dijalankan per pegawai, pratinjau untuk puluhan pegawai melampaui batas waktu 10 detik. Query kini dijalankan paralel dan batas waktunya disesuaikan.",
    added: [
      "Pengujian paralelisasi permanen pada scripts/verify-employee-manual-send.js: memastikan cepat, tetapi urutan pegawai dan pasangan nomor WhatsApp tidak tertukar.",
    ],
    changed: [
      "Query sumber data pegawai dijalankan paralel dengan batas serentak (bawaan 6, dapat diatur lewat ALETA_BOT_EMPLOYEE_QUERY_CONCURRENCY) agar SIPP tidak terbebani.",
      "Batas waktu panggilan pratinjau ke ALETA Bot dinaikkan dari 10 detik menjadi 120 detik, khusus untuk operasi berat ini.",
    ],
    fixed: [
      "Pratinjau sumber data pegawai gagal dengan pesan This operation was aborted ketika jumlah pegawai banyak, karena query dijalankan berurutan dan melampaui batas waktu.",
      "Pesan kehabisan waktu tidak lagi disamakan dengan bot mati. Keduanya kini dibedakan agar operator tidak salah menduga container ALETA Bot tidak berjalan.",
    ],
    security: [],
    operationalNotes: [
      "Tidak ada perubahan skema database pada rilis ini.",
      "Perbaikan berada di portal DAN ALETA Bot, jadi keduanya wajib dibangun ulang saat update.",
      "Uji setelah update: docker compose exec aleta_bot node scripts/verify-employee-manual-send.js",
    ],
    knownLimitations: [
      "Semakin banyak pegawai yang ditargetkan, semakin lama pratinjau selesai. Persempit target pada notifikasi bila dirasa lambat.",
    ],
  },
  {
    version: "1.5.10",
    title: "ALETA v1.5.10 - Perbaikan Sumber Data Pegawai Selalu Kosong",
    date: "2026-07-28",
    status: "Operasional",
    summary:
      "Memperbaiki akar masalah sumber data pegawai yang selalu mengembalikan 0 baris: endpoint preview pada ALETA Bot tidak meneruskan daftar pegawai yang dikirim portal, sehingga sumber data dijalankan tanpa nama pegawai.",
    added: [
      "Verifikasi tingkat ROUTE HTTP: aleta_bot/scripts/verify-manual-send-route.js. Menembak endpoint sungguhan, bukan memanggil service secara langsung.",
    ],
    changed: [],
    fixed: [
      "Endpoint /manual-send/preview tidak mengambil field employeeRecipients dan notificationName dari badan permintaan, sehingga keduanya dibuang diam-diam. Akibatnya sumber data pegawai dijalankan tanpa nama penerima dan selalu menghasilkan 0 baris beserta placeholder nama_pegawai, judul_notifikasi, dan ringkasan yang kosong.",
      "Cacat ini lolos dari seluruh pengujian sebelumnya karena skrip verifikasi memanggil layanan preview secara langsung tanpa melewati endpoint HTTP. Pengujian tingkat route kini ditambahkan agar kesenjangan serupa tidak terulang.",
    ],
    security: [],
    operationalNotes: [
      "Tidak ada perubahan skema database pada rilis ini.",
      "Perbaikan berada di sisi ALETA Bot, jadi container aleta_bot WAJIB ikut dibangun ulang saat update.",
      "Uji setelah update: docker compose exec aleta_bot node scripts/verify-manual-send-route.js",
    ],
    knownLimitations: [
      "Query bawaan SIPP menyaring memakai jadwal sidang TERAKHIR tiap perkara. Perkara yang tanggal sidang berikutnya sudah diinput petugas tidak terhitung sebagai sidang hari ini.",
    ],
  },
  {
    version: "1.5.9",
    title: "ALETA v1.5.9 - Diagnosis Sumber Data dan Penyuntingan Pesan",
    date: "2026-07-22",
    status: "Operasional",
    summary:
      "Menambahkan alat diagnosis untuk memastikan penyebab sumber data pegawai kosong (versi kode, tanggal SIPP, atau ketidakcocokan nama), tombol hapus semua nomor tujuan, dan penyuntingan isi pesan langsung di kotak pratinjau sebelum dikirim.",
    added: [
      "Alat diagnosis sumber data pegawai: aleta_bot/scripts/diagnose-employee-query.js. Membandingkan nama pegawai di Manajemen Akun dengan nama yang benar-benar tersimpan di SIPP untuk sidang hari ini.",
      "Tombol Hapus semua dan Centang semua pada daftar Nomor Tujuan, dengan konfirmasi sebelum daftar dikosongkan.",
      "Isi pesan pada kotak pratinjau dapat disunting langsung lalu dikirim, dilengkapi tombol Kembalikan ke pesan asli.",
    ],
    changed: [
      "Saat pesan disunting manual pada mode Sumber Data, penyesuaian per-penerima dilepas dan hal itu dinyatakan terang-terangan: teks yang sama dikirim ke seluruh penerima terpilih.",
      "Suntingan pesan otomatis dibuang saat sumber data diganti, agar teks lama tidak ikut terkirim untuk sumber data yang berbeda.",
    ],
    fixed: [],
    security: [
      "Pesan hasil suntingan tetap melewati pemeriksaan placeholder di server, sehingga penanda {{...}} yang belum terisi tidak dapat terkirim ke penerima.",
    ],
    operationalNotes: [
      "Tidak ada perubahan skema database pada rilis ini.",
      "Bila sumber data pegawai mengembalikan 0 baris, jalankan: docker compose exec aleta_bot node scripts/diagnose-employee-query.js",
      "Keluaran skrip diagnosis menampilkan daftar nama pegawai persis seperti tersimpan di SIPP, untuk diselaraskan dengan Manajemen Akun.",
    ],
    knownLimitations: [
      "Query bawaan SIPP menyaring memakai jadwal sidang TERAKHIR tiap perkara. Perkara yang tanggal sidang berikutnya sudah diinput petugas tidak terhitung sebagai sidang hari ini.",
      "Pencocokan nama tetap berbasis kemiripan teks; nama yang berbeda ejaan antara SIPP dan Manajemen Akun perlu diselaraskan manual.",
    ],
  },
  {
    version: "1.5.8",
    title: "ALETA v1.5.8 - Pemilih Tanggal Kirim Manual",
    date: "2026-07-22",
    status: "Operasional",
    summary:
      "Kirim Manual kini punya pemilih tanggal yang bersifat opsional: dikosongkan berarti sidang hari ini, diisi berarti mengikuti tanggal yang dipilih operator.",
    added: [
      "Keterangan langsung di bawah kolom tanggal: menyebut tanggal yang sedang dipakai dalam bahasa Indonesia lengkap dengan nama harinya.",
      "Tombol pintas Hari ini untuk mengosongkan kembali tanggal yang terlanjur dipilih.",
    ],
    changed: [
      "Parameter tanggal pada sumber data menjadi opsional; kolom kosong otomatis diisi tanggal hari ini sehingga operator cukup menekan Jalankan Sumber Data.",
      "Tanggal hari ini dihitung memakai zona waktu pengadilan (Asia/Makassar), bukan zona waktu peramban maupun host, agar hasil di layar sama dengan yang dipakai query.",
    ],
    fixed: [
      "Sebelumnya tanggal yang dikosongkan dianggap parameter hilang sehingga sumber data menolak berjalan dan menampilkan peringatan parameter wajib.",
    ],
    security: [
      "Tanggal tetap dikirim sebagai prepared statement, termasuk saat satu query memakai parameter yang sama lebih dari sekali.",
    ],
    operationalNotes: [
      "Tidak ada perubahan skema database pada rilis ini.",
      "Uji tanpa mengirim pesan: docker compose exec aleta_bot node scripts/verify-party-coverage.js",
      "Pemilih tanggal muncul pada sumber data yang mendukungnya, ditandai keterangan pada nama sumber data di dropdown.",
    ],
    knownLimitations: [
      "Sumber data jalur lama memakai tanggal bawaan dari SIPP (hari ini atau H-3) dan tidak dapat diubah tanggalnya; gunakan sumber data Sidang pada Tanggal Tertentu untuk memilih tanggal bebas.",
    ],
  },
  {
    version: "1.5.7",
    title: "ALETA v1.5.7 - Diagnosis Sumber Data Kosong yang Jelas",
    date: "2026-07-22",
    status: "Operasional",
    summary:
      "Saat sumber data pegawai tidak mengembalikan baris, Kirim Manual dulu menampilkan peringatan placeholder yang menyesatkan seolah konfigurasi salah. Kini sebab sesungguhnya dijelaskan langsung.",
    added: [],
    changed: [
      "Sumber data pegawai yang tidak menghasilkan data menampilkan sebab spesifik: tidak ada jadwal/tugas hari itu, atau penulisan nama di Manajemen Akun berbeda dengan nama di SIPP.",
      "Kotak isian fallback placeholder disembunyikan saat sumber data sama sekali tidak mengembalikan baris, karena mengisinya hanya menghasilkan pesan tanpa data perkara.",
    ],
    fixed: [],
    security: [],
    operationalNotes: [
      "Tidak ada perubahan skema database pada rilis ini.",
      "Versi aplikasi dapat dilihat pada halaman login (PATCH NOTES). Pastikan server sudah memakai versi terbaru sebelum melaporkan gejala lama.",
    ],
    knownLimitations: [
      "Pencocokan nama pegawai ke SIPP tetap berbasis kemiripan teks; nama yang berbeda ejaan perlu diselaraskan manual.",
    ],
  },
  {
    version: "1.5.6",
    title: "ALETA v1.5.6 - Notifikasi Menjangkau Seluruh Pihak Berperkara",
    date: "2026-07-22",
    status: "Operasional",
    summary:
      "Sumber data pihak berbasis SQL sebelumnya hanya menjangkau Penggugat dan Tergugat, sehingga Turut Tergugat, pihak Intervensi, dan Kuasa Hukum tidak pernah menerima pesan. Kini keenam kelompok pihak tercakup, setara dengan sumber data jalur lama.",
    added: [
      "Kolom Peran pada Daftar Penerima Kirim Manual: Penggugat/Pemohon, Tergugat/Termohon, Turut Tergugat, Intervensi, dan Kuasa Hukum.",
      "Skrip verifikasi cakupan pihak tanpa database: aleta_bot/scripts/verify-party-coverage.js",
    ],
    changed: [
      "Sumber data pihak berbasis SQL kini memakai UNION untuk menggabungkan pihak langsung (v_pihak_perkara) dengan kuasa hukum (perkara_pengacara, nomor diambil dari pihak.pengacara_id).",
    ],
    fixed: [
      "Sumber data 'Pengingat Sidang H-1' dan 'Sidang pada Tanggal Tertentu' hanya menyaring pihak_ke IN (1, 2), sehingga Turut Tergugat (pihak_ke 4), Intervensi (pihak_ke 3), dan seluruh Kuasa Hukum terlewat. Kini menjadi pihak_ke IN (1, 2, 3, 4) ditambah kuasa hukum.",
    ],
    security: [
      "Parameter tanggal yang kini muncul dua kali karena UNION tetap di-bind sebagai prepared statement terpisah; jumlah tanda tanya dan nilai diverifikasi sama.",
    ],
    operationalNotes: [
      "Tidak ada perubahan skema database pada rilis ini.",
      "Uji tanpa mengirim pesan: docker compose exec aleta_bot node scripts/verify-party-coverage.js",
      "Sumber data jalur lama (Perkara Baru, Pengingat Hari Sidang, H-3, Tunda Cuti) sejak awal sudah mencakup keenam kelompok pihak dan tidak berubah.",
    ],
    knownLimitations: [
      "Beberapa pihak dalam satu perkara kerap memakai satu nomor WhatsApp yang sama; nomor kembar sengaja dikirimi sekali saja agar tidak menerima pesan ganda.",
      "Pihak tanpa nomor telepon valid di SIPP tetap tidak dapat dikirimi pesan.",
    ],
  },
  {
    version: "1.5.5",
    title: "ALETA v1.5.5 - Ketua dan Wakil Ketua Terdeteksi Sebagai Hakim",
    date: "2026-07-22",
    status: "Operasional",
    summary:
      "Ketua dan Wakil Ketua Pengadilan adalah hakim yang juga memegang perkara dan bersidang, namun sebelumnya tidak pernah menerima notifikasi jadwal sidang karena role utamanya bukan hakim. Kini keduanya ikut terdeteksi sebagai hakim, tanpa kehilangan notifikasi khusus kepemimpinan.",
    added: [
      "Konsep role melekat (IMPLICIT_ROLE_IDS): ketua dan wakil-ketua otomatis dianggap juga hakim untuk penargetan notifikasi.",
      "Skrip verifikasi pencocokan role tanpa database: aleta_bot/scripts/verify-role-mapping.js",
    ],
    changed: [
      "roleHints pada penargetan notifikasi kini juga memeriksa role tambahan (additionalRoleIds), tidak hanya role utama.",
    ],
    fixed: [
      "Ketua dan Wakil Ketua tidak menerima notifikasi jadwal sidang hakim. Penargetan roleHints hanya mencocokkan role utama, sehingga akun ber-role ketua/wakil-ketua tidak pernah cocok dengan roleHints hakim. Pada data PA Donggala, penerima notifikasi hakim bertambah dari 3 menjadi 5 orang.",
      "Perbaikan diterapkan konsisten di portal (preview penerima dan Kirim Manual) maupun di scheduler bot (pengiriman nyata).",
    ],
    security: [
      "Arah sebaliknya dijaga: hakim biasa tetap TIDAK menerima notifikasi khusus ketua, dan pimpinan tidak ikut menerima notifikasi panitera maupun jurusita.",
    ],
    operationalNotes: [
      "Tidak ada perubahan skema database pada rilis ini.",
      "Uji tanpa mengirim pesan: docker compose exec aleta_bot node scripts/verify-role-mapping.js",
      "Periksa jumlah penerima lewat Simulasi pada notifikasi hakim sebelum mengaktifkannya.",
    ],
    knownLimitations: [
      "Pimpinan hanya menerima pesan bila memang memegang perkara: query SIPP menyaring per nama, jadi yang tidak bersidang otomatis dilewati.",
      "Role melekat lain (mis. Panitera struktural yang juga bersidang sebagai panitera pengganti) belum ditambahkan dan perlu keputusan operasional.",
    ],
  },
  {
    version: "1.5.4",
    title: "ALETA v1.5.4 - Pengingat Panitera dan Jurusita Selaras Aplikasi Lama",
    date: "2026-07-22",
    status: "Operasional",
    summary:
      "Menyelaraskan pengingat Panitera dan Jurusita dengan aplikasi lama (sendPengingatPaniteraSidang dan sendStatusSidangJurusita), serta melengkapi pengingat sidang besok untuk Panitera yang sebelumnya belum ada.",
    added: [
      "Sumber data dan notifikasi 'Panitera - Sidang Besok' (getDataJadwalBesokPaniteraNew + getDataTundaMediasiPanitera), setara pengingat malam pada aplikasi lama.",
      "Verifikasi normalisasi nama diperluas mencakup contoh nama Hakim, Panitera, dan Jurusita.",
    ],
    changed: [
      "Deskripsi notifikasi Panitera diperjelas: penerima difilter per nomor perkara yang dipegang, sehingga panitera struktural/kepaniteraan yang tidak bersidang otomatis tidak menerima pesan.",
    ],
    fixed: [
      "Perbaikan pencocokan nama v1.5.3 dipastikan berlaku untuk Panitera (c.panitera_nama) dan Jurusita (m.jurusita_nama), bukan hanya Hakim, karena normalisasi dipasang di titik pembuatan parameter query legacy yang dipakai bersama.",
    ],
    security: [],
    operationalNotes: [
      "Tidak ada perubahan skema database pada rilis ini.",
      "Uji tanpa mengirim pesan: docker compose exec aleta_bot node scripts/verify-employee-manual-send.js",
      "Notifikasi baru masuk otomatis saat portal menyala dalam keadaan nonaktif; aktifkan setelah diuji.",
    ],
    knownLimitations: [
      "Pencocokan tetap berbasis LIKE substring nama; nama yang berbeda ejaan antara SIPP dan Manajemen Akun tidak akan cocok.",
    ],
  },
  {
    version: "1.5.3",
    title: "ALETA v1.5.3 - Pencocokan Nama Pegawai ke SIPP",
    date: "2026-07-22",
    status: "Operasional",
    summary:
      "Memperbaiki penyebab notifikasi dan Kirim Manual pegawai selalu menghasilkan 0 baris: nama pegawai bergelar dari Manajemen Akun tidak cocok dengan filter LIKE pada kolom nama SIPP. Ditemukan dengan membandingkan aplikasi lama (sendPengingatHakim) yang memakai nama pendek tanpa gelar.",
    added: [
      "Modul utilitas nama pegawai tanpa dependensi: aleta_bot/services/employeeNameUtil.js",
    ],
    changed: [
      "Nama pegawai dipangkas dari gelar sebelum dipakai sebagai parameter query legacy, sehingga filter LIKE kembali mencocokkan nama saja.",
      "Batas penerima pada teks antarmuka Kirim Manual kini mengikuti batas server, tidak lagi ditulis 20 secara permanen.",
    ],
    fixed: [
      "Query pegawai (getDataJadwalSidangPerdataHakim, getDataJadwalMediasiHakim, dan sejenisnya) memakai filter LIKE '%nama%' terhadap kolom SIPP. Nama seperti 'DERRY BRIANTONO, S.H.' menuntut SIPP memuat gelar itu juga, sehingga hasilnya selalu 0 baris. Kini dipangkas menjadi 'DERRY BRIANTONO'.",
      "Gelar depan bertumpuk ikut dibuang, mis. 'Dr. H. Abdul Salam, S.H., M.H.' menjadi 'Abdul Salam'.",
      "Perbaikan ini berlaku untuk notifikasi terjadwal maupun Kirim Manual karena diterapkan di titik pembuatan parameter query legacy.",
    ],
    security: [],
    operationalNotes: [
      "Tidak ada perubahan skema database pada rilis ini.",
      "Uji tanpa mengirim pesan: docker compose exec aleta_bot node scripts/verify-employee-manual-send.js",
      "Bila nama di SIPP sangat berbeda dari Manajemen Akun (bukan sekadar gelar), samakan nama depan-belakangnya agar pencocokan berhasil.",
    ],
    knownLimitations: [
      "Pencocokan tetap berbasis LIKE substring nama; nama yang benar-benar berbeda antara SIPP dan Manajemen Akun tidak akan cocok.",
      "Pratinjau tetap membutuhkan container aleta_bot menyala karena bot yang memegang koneksi SIPP.",
    ],
  },
  {
    version: "1.5.2",
    title: "ALETA v1.5.2 - Kirim Manual Pegawai Sesuai Notifikasi",
    date: "2026-07-22",
    status: "Operasional",
    summary:
      "Memperbaiki Kirim Manual untuk sumber data pegawai. Memilih 'Hakim - Daftar Sidang Hari Ini' sebelumnya selalu menghasilkan 0 baris dan placeholder nama_pegawai/judul_notifikasi/ringkasan kosong, padahal notifikasi dengan sumber data yang sama berjalan normal.",
    added: [
      "Skrip verifikasi Kirim Manual pegawai tanpa database: aleta_bot/scripts/verify-employee-manual-send.js",
    ],
    changed: [
      "Sumber data pegawai di Kirim Manual kini dijalankan sekali per pegawai dengan namanya sebagai filter, sama seperti scheduler notifikasi.",
      "Daftar pegawai penerima dihitung memakai pemetaan penerima milik notifikasi terkait, sehingga hasil Kirim Manual identik dengan pengiriman terjadwal.",
      "Pegawai yang tidak punya data (mis. hakim tanpa sidang hari ini) otomatis dilewati agar tidak menerima pesan kosong.",
    ],
    fixed: [
      "Query pegawai berarity 1 (getDataJadwalSidangPerdataHakim dan sejenisnya) dulu dijalankan tanpa nama penerima sehingga filternya menjadi 'Pegawai' dan hasilnya selalu 0 baris.",
      "Placeholder nama_pegawai dan judul_notifikasi kini disuntikkan runtime seperti pada notifikasi, tidak lagi dilaporkan kosong.",
    ],
    security: [
      "Isolasi antar penerima dipertahankan: tiap pegawai hanya menerima daftar perkara miliknya sendiri.",
    ],
    operationalNotes: [
      "Tidak ada perubahan skema database pada rilis ini.",
      "Uji tanpa mengirim pesan: docker compose exec aleta_bot node scripts/verify-employee-manual-send.js",
      "Pilih Relasi notifikasi terlebih dahulu agar target pegawai mengikuti pemetaan notifikasi tersebut.",
    ],
    knownLimitations: [
      "Pratinjau tetap membutuhkan container aleta_bot menyala karena bot yang memegang koneksi SIPP.",
    ],
  },
  {
    version: "1.5.1",
    title: "ALETA v1.5.1 - Perbaikan Kirim Manual: Pesan Per-Penerima dan Penerima Pegawai",
    date: "2026-07-22",
    status: "Operasional",
    summary:
      "Rilis perbaikan untuk tab Kirim Manual. Memperbaiki cacat serius yang membuat seluruh penerima menerima pesan berisi nama dan nomor perkara milik satu orang yang sama, membereskan peringatan placeholder yang mengunci pengiriman, serta menambahkan pemilihan penerima pegawai berdasarkan role/jabatan.",
    added: [
      "Kirim Manual dapat menambahkan penerima pegawai (hakim, panitera, jurusita, dsb.) berdasarkan role/jabatan langsung dari Manajemen Akun.",
      "Daftar Penerima kini punya kolom centang per baris dan tombol Centang semua untuk memilih siapa saja yang dikirimi.",
      "Sumber data yang membutuhkan parameter diberi penanda di dropdown, sehingga sumber data berparameter tanggal mudah ditemukan.",
      "Skrip verifikasi rendering Kirim Manual: aleta_bot/scripts/verify-manual-send-render.js",
    ],
    changed: [
      "Batas penerima Kirim Manual dinaikkan dari 20 menjadi 1000, termasuk batas baris pratinjau pada bot yang sebelumnya hanya 50.",
      "Tabel baris mentah (perkara_id, pihak_id) di Kirim Manual dihapus karena kolomnya tidak bermakna dan pemilihannya tumpang tindih dengan Daftar Penerima.",
      "Overlay 'Sedang memproses...' dimatikan pada panel Kirim Manual karena menutupi tabel penerima yang sedang diperiksa operator.",
    ],
    fixed: [
      "KRITIS: Kirim Manual sebelumnya merender satu pesan dari satu baris lalu mengirimkannya ke semua penerima, sehingga setiap pihak menerima nama dan nomor perkara milik orang lain. Kini setiap penerima dirender dari baris datanya sendiri.",
      "Peringatan 'Placeholder belum terisi: nama_pihak' yang mengunci pengiriman: alias kolom SIPP (nama, no_perkara, jenis_perkara_nama) kini dinormalkan sama seperti pada scheduler notifikasi.",
      "Tombol kirim tidak lagi terkunci oleh satu baris pratinjau yang kebetulan tidak lengkap; kesiapan dinilai dari pesan masing-masing penerima terpilih.",
    ],
    security: [
      "Kebocoran data antar pihak dihentikan: pesan tidak lagi memuat identitas dan nomor perkara penerima lain.",
      "Setiap pesan per-penerima tetap melewati pemeriksaan placeholder, sehingga tidak ada {{...}} mentah yang lolos terkirim.",
    ],
    operationalNotes: [
      "Tidak ada perubahan skema database pada rilis ini; cukup update kode lalu rebuild.",
      "Uji rendering tanpa mengirim pesan: docker compose exec aleta_bot node scripts/verify-manual-send-render.js",
      "Untuk kirim berdasarkan tanggal, pilih sumber data 'Pihak Perkara - Sidang pada Tanggal Tertentu - isi tanggal sidang'.",
    ],
    knownLimitations: [
      "Pratinjau dan pengiriman tetap membutuhkan container aleta_bot menyala karena bot yang memegang koneksi SIPP.",
      "Jumlah baris sumber data dibatasi 1000 per pengiriman untuk menjaga beban query dan antrean.",
    ],
  },
  {
    version: "1.5.0",
    title: "ALETA v1.5.0 - Notifikasi Sidang, Antrian Online, dan Dokumen Gugatan",
    date: "2026-07-22",
    status: "Operasional",
    summary:
      "Rilis v1.5.0 merapikan paket notifikasi pegawai dan pihak (sidang hari ini per hakim/panitera, pengingat H-3 dan H-1), memfungsikan antrian sidang online yang sebelumnya tidak tersambung, menambah toggle kirim dokumen gugatan/permohonan pada notifikasi maupun Kirim Manual, serta memperbaiki sejumlah kekeliruan pada tab Kirim Manual.",
    added: [
      "Sumber data per-pegawai: daftar perkara yang disidangkan hari ini (nomor perkara, jam, ruang) khusus untuk tiap Hakim dan Panitera Pengganti.",
      "Notifikasi pengingat sidang H-1 untuk pihak, melengkapi H-3 yang sudah ada.",
      "Sumber data 'Sidang pada Tanggal Tertentu' berparameter tanggal untuk Kirim Manual, memakai pemilih tanggal.",
      "Notifikasi Jurusita untuk tundaan sidang dan pemberitahuan putusan, difilter per jurusita.",
      "Antrian sidang online kini benar-benar berjalan lewat perintah WhatsApp: 'daftar antrian#...', 'antrian online#...', dan 'ambil antrian'.",
      "Toggle kirim dokumen gugatan/permohonan (PDF/Word) pada editor notifikasi dan pada tab Kirim Manual.",
      "Panel rekomendasi sumber data di editor Isi Pesan, lengkap dengan penyisipan placeholder sekali klik.",
      "Tabel Daftar Penerima di Kirim Manual: nomor perkara, nama pihak, jenis perkara, dan nomor WhatsApp.",
      "Skrip diagnosis dokumen SIPP: scripts/check-sipp-document.js.",
    ],
    changed: [
      "Notifikasi Hakim dan Panitera lama diganti nama menjadi monitoring minutasi/BAS agar tidak tertukar dengan daftar sidang hari ini.",
      "Notifikasi pihak sebelum sidang diperjelas sebagai pengingat H-3.",
      "Kode satker pada antrian online tidak lagi dipatok ke PA Donggala; diatur lewat ALETA_BOT_COURT_CODE.",
      "Container aleta_bot kini memount folder dokumen SIPP secara read-only agar berkas gugatan dapat dilampirkan.",
    ],
    fixed: [
      "Kirim Manual: memilih sumber data langsung kini ikut memuat isi pesan dari notifikasi pasangannya, tidak lagi menampilkan 'Belum ada isi pesan'.",
      "Kirim Manual: kolom parameter (mis. tanggal sidang) kini dibaca portal dari SQL, sehingga tetap muncul walau aleta_bot sedang mati.",
      "Kirim Manual: daftar penerima beserta nomor WhatsApp kini ditampilkan; sebelumnya data tersebut dikembalikan server tetapi tidak pernah dirender.",
      "Pesan kegagalan koneksi aleta_bot tidak lagi salah dilaporkan sebagai gangguan layanan AI.",
    ],
    security: [
      "Perintah antrian online kini wajib melewati verifikasi nomor WhatsApp terhadap perkara, karena perintah tersebut menulis ke database antrian.",
      "Akses folder dokumen SIPP dipasang read-only pada container bot.",
    ],
    operationalNotes: [
      "Mode UPDATE tidak menimpa docker-compose.yml: tambahkan sendiri mount '/var/www/html/SIPP:/usr/src/app/SIPP:ro' pada service aleta_bot.",
      "Kolom baru attach_document ditambahkan otomatis saat portal menyala, dengan nilai default aktif sehingga notifikasi lama tidak berubah perilaku.",
      "Notifikasi dan sumber data baru masuk otomatis saat portal menyala, namun semuanya nonaktif sampai diuji dan diaktifkan operator.",
      "Uji lampiran dokumen dengan: docker compose exec aleta_bot node scripts/check-sipp-document.js",
    ],
    knownLimitations: [
      "Penomoran antrian online belum difilter tanggal sidang; pastikan tabel antrian_sidang hanya memuat sidang hari berjalan.",
      "Nama schema SIPP dan sipp_turunan_antrian pada layanan antrian online masih dipatok di SQL.",
      "Isi data SIPP hanya dapat diverifikasi di server; pengujian lokal terbatas pada struktur query.",
    ],
  },
  {
    version: "1.4.15",
    title: "ALETA v1.4.15 - Kesiapan Staging-Public, Preflight, dan Registry Database",
    date: "2026-06-19",
    status: "Staging-Public Readiness",
    summary:
      "Rilis v1.4.15 merangkum pemantapan besar setelah v1.4.5: preflight publik diperketat, fallback database dev dicegah pada target staging-public/production, Query Registry ALETA x SIPP dan JLF divalidasi dari database, serta smoke runtime login, logout, protected route, dan modul utama dipakai sebagai bukti kesiapan UAT kuat.",
    added: [
      "Preflight kini menampilkan mode runtime database aktif, kebijakan fallback database, dan status target publik/staging-public.",
      "Preflight menambahkan pemeriksaan Query Registry ALETA x SIPP dan JLF yang aktif, read-only, dan berasal dari database.",
      "Preflight menambahkan guard untuk memastikan tidak ada query registry unsafe/rejected yang masih aktif sebelum aplikasi dipakai publik.",
    ],
    changed: [
      "Target staging-public/production tidak lagi boleh diam-diam memakai fallback database in-memory/persistent-dev saat PostgreSQL bermasalah.",
      "BETTER_AUTH_SECRET sekarang menjadi syarat eksplisit untuk staging-public/production; secret lokal hanya boleh untuk development.",
      "Status kesiapan aplikasi diarahkan ke UAT kuat/operasional terbatas stabil sampai WhatsApp live dan SIPP live divalidasi di environment khusus.",
    ],
    fixed: [
      "Preflight lama yang belum memeriksa mode database aktif diperbaiki agar risiko memakai database fallback terlihat sejak awal.",
      "Test preflight diperkuat dengan data registry query read-only minimal sehingga standar database-driven tidak diturunkan.",
    ],
    security: [
      "Database fallback dev otomatis dinonaktifkan untuk target publik/staging-public kecuali admin secara eksplisit mengizinkannya.",
      "Query registry aktif dengan status REJECTED_WRITE_QUERY atau UNSAFE_RAW_SQL diperlakukan sebagai error kesiapan.",
      "Staging-public wajib memakai secret auth environment agar sesi tidak bergantung pada file lokal development.",
    ],
    operationalNotes: [
      "Sebelum deploy staging-public, set BETTER_AUTH_SECRET, pastikan DATABASE_URL mengarah ke PostgreSQL permanen, dan jalankan npm run preflight.",
      "Warning template surat aktif kosong perlu diselesaikan dari admin dengan template nyata, bukan data dummy.",
      "WhatsApp live tetap tidak diuji dari preflight; gunakan dry-run sampai gateway staging disiapkan.",
    ],
    knownLimitations: [
      "WhatsApp live dan datasource SIPP live masih harus divalidasi pada environment staging/produksi yang aman.",
      "Preflight lokal tetap boleh warning untuk secret dev dan template surat kosong agar development tidak tertahan.",
    ],
    details: [
      {
        title: "Checklist v1.4.15",
        items: [
          "Jalankan npm run preflight pada mode lokal dan staging-public.",
          "Pastikan staging-public preflight tidak error setelah BETTER_AUTH_SECRET diset.",
          "Pastikan query ALETA x SIPP/JLF yang aktif berstatus SAFE_READ_ONLY.",
        ],
      },
      {
        title: "Masukan Prioritas v1.4.15",
        items: [
          "Laporkan jika preflight gagal tanpa pesan yang jelas.",
          "Laporkan jika halaman modul tampil tetapi data berasal dari fallback atau tidak konsisten setelah refresh.",
        ],
      },
    ],
  },
  {
    version: "1.4.14",
    title: "ALETA v1.4.14 - Smoke Runtime Login, Logout, dan Modul Utama",
    date: "2026-06-18",
    status: "Runtime Smoke Update",
    summary:
      "Rilis v1.4.14 memperkuat pembuktian runtime: login Super Admin, akses modul utama, global loading, logout, protected route, dan console browser dicek sebagai bagian dari kesiapan aplikasi dipakai user nyata.",
    added: [
      "Smoke visual login Super Admin dari halaman login sampai Portal ALETA.",
      "Smoke akses modul Manajemen Surat, ALETA Bot, ALETA x SIPP, dan JLF setelah login.",
      "Smoke logout memakai tombol stabil data-testid logout-button.",
    ],
    changed: [
      "Status global loading dibedakan antara komponen yang masih ada di DOM dan overlay yang benar-benar terlihat.",
      "Kesiapan runtime tidak lagi hanya bergantung pada build/test, tetapi juga bukti halaman final muncul di browser.",
    ],
    fixed: [
      "Alur logout diverifikasi kembali agar setelah keluar, akses /portal kembali diarahkan ke /login.",
      "Protected route/API tanpa session diverifikasi menghasilkan redirect login atau 401 sesuai pola aplikasi.",
    ],
    security: [
      "Protected API admin, surat, ALETA Bot, ALETA x SIPP, dan JLF tetap menolak akses tanpa session.",
      "Logout memastikan session user tidak dapat dipakai lagi untuk membuka route protected.",
    ],
    operationalNotes: [
      "Saat dev server baru compile route pertama kali, tunggu halaman final sebelum menilai loading stuck.",
      "Gunakan browser smoke untuk memastikan halaman utama tidak blank setelah deploy.",
    ],
    knownLimitations: [
      "Smoke visual tidak menggantikan UAT manual seluruh role dan seluruh form bisnis.",
      "Compile awal dev server dapat membuat halaman terlihat loading beberapa detik lebih lama dari production build.",
    ],
  },
  {
    version: "1.4.13",
    title: "ALETA v1.4.13 - Security, Upload/Download, dan API Protection",
    date: "2026-06-17",
    status: "Security Hardening",
    summary:
      "Rilis v1.4.13 memfokuskan penguatan keamanan publik: proteksi route/API, sanitasi audit, validasi upload/download, dan pembatasan query read-only dicek ulang agar aplikasi tidak membuka data kepada user tanpa hak.",
    added: [
      "Checklist security publik untuk auth, RBAC, upload/download, query guard, dan secret environment.",
      "Penekanan audit sanitizer untuk mencegah secret masuk ke log operasional.",
      "Validasi bahwa download dokumen JLF dan surat tetap mengikuti permission.",
    ],
    changed: [
      "Hasil verifikasi keamanan dipakai sebagai syarat sebelum aplikasi dinyatakan siap staging-public.",
      "Route dan API protected diperlakukan sebagai satu kesatuan: menu boleh tersembunyi, tetapi API tetap wajib menolak akses tanpa hak.",
    ],
    fixed: [
      "Risiko route protected yang hanya diuji dari UI dikurangi dengan smoke API langsung tanpa session.",
      "Catatan upload/download diperjelas agar path traversal, file invalid, dan missing file tetap harus punya error yang aman.",
    ],
    security: [
      "API protected tanpa login wajib 401 atau 403.",
      "Query SIPP/JLF tetap SELECT-only dan tidak boleh menerima raw SQL bebas dari client.",
      "Secret, token, QR raw, password, dan session WhatsApp tidak boleh tampil di UI atau patch notes.",
    ],
    operationalNotes: [
      "Jalankan test permission dan smoke unauth API setelah perubahan auth/RBAC.",
      "Gunakan file kecil dan aman saat menguji upload/download di UAT.",
    ],
    knownLimitations: [
      "Rate limit dan proteksi perimeter tetap bergantung pada konfigurasi server/reverse proxy.",
      "Uji file storage produksi perlu dilakukan di lokasi storage deployment sebenarnya.",
    ],
  },
  {
    version: "1.4.12",
    title: "ALETA v1.4.12 - Test Permanen, Cleanup, dan Preflight UAT",
    date: "2026-06-16",
    status: "Test & UAT Update",
    summary:
      "Rilis v1.4.12 menyelaraskan test permanen, cleanup data UAT, dan preflight agar audit berikutnya tidak hanya menjadi smoke sementara, tetapi menjadi mekanisme regresi yang bisa diulang.",
    added: [
      "Preflight diarahkan sebagai pemeriksaan rutin sebelum UAT dan deploy.",
      "Test lintas area mencakup login, AccessDenied, loading, Manajemen Surat, ALETA Bot, JLF, Query Registry, dan upload/download.",
      "Catatan cleanup data test UAT memakai prefix aman agar tidak menghapus data operasional.",
    ],
    changed: [
      "Akun/data test dipisahkan dari data operasional nyata.",
      "Test tidak boleh menggunakan fallback mock untuk menutupi database kosong.",
    ],
    fixed: [
      "Risiko test hanya membuktikan build lulus dikurangi dengan test service dan runtime smoke.",
      "Preflight test diperkuat agar mengecek registry query database.",
    ],
    security: [
      "Cleanup data test wajib dibatasi development/test/staging, bukan production.",
      "Password user operasional nyata tidak boleh direset untuk simulasi role.",
    ],
    operationalNotes: [
      "Gunakan prefix test_ atau codexuat_ saat membuat data simulasi.",
      "Jalankan cleanup setelah UAT otomatis jika environment memang development/test.",
    ],
    knownLimitations: [
      "Cleanup harus tetap direview jika ada perubahan prefix atau struktur data baru.",
      "Test suite masih berat dan dapat memakan waktu lama di mesin lokal.",
    ],
  },
  {
    version: "1.4.11",
    title: "ALETA v1.4.11 - JLF Query Registry dan Variable Registry",
    date: "2026-06-15",
    status: "JLF Registry Update",
    summary:
      "Rilis v1.4.11 memantapkan ALETA Justicia Legal Form agar query data_sql, data_sipp, multi_sidang, jadwal sidang, nomor perkara, dan mapping variabel legacy ABT diarahkan melalui database registry.",
    added: [
      "Validasi registry JLF pada preflight dengan source type JLF_CANONICAL, JLF_PREVIEW_CATALOG, JLF_VARIABLE_PREVIEW, dan JLF_VARIABLE_DATA_SQL.",
      "Dokumentasi bahwa query ABT legacy diperlakukan sebagai bahan review dan tidak dieksekusi bebas.",
      "Catatan mapping placeholder modern dan legacy seperti #perkara_id# dan kode ABT lama.",
    ],
    changed: [
      "Runtime JLF diarahkan membaca query aktif dari database registry dan memberi error konfigurasi bila query tidak tersedia.",
      "Mapping variabel JLF lebih tegas membedakan computed, manual, SIPP read-only, dan data_sql legacy.",
    ],
    fixed: [
      "Risiko query JLF hardcoded aktif tanpa audit dikurangi dengan registry database dan guard read-only.",
      "Preview sumber data JLF dibuat lebih jelas saat datasource SIPP belum tersedia.",
    ],
    security: [
      "Parameter perkara_id harus diperlakukan sebagai parameter aman, bukan interpolasi string bebas.",
      "Query JLF yang unsafe atau rejected tidak boleh aktif.",
    ],
    operationalNotes: [
      "Admin perlu meninjau query JLF yang masih needs_review sebelum dipakai untuk dokumen operasional.",
      "Uji template legal form nyata dengan perkara staging sebelum dipakai user banyak.",
    ],
    knownLimitations: [
      "Validasi hasil query tetap membutuhkan datasource SIPP staging/live.",
      "Beberapa variabel ABT legacy dapat tetap membutuhkan mapping manual.",
    ],
  },
  {
    version: "1.4.10",
    title: "ALETA v1.4.10 - ALETA x SIPP Query Registry Read-Only",
    date: "2026-06-14",
    status: "SIPP Registry Update",
    summary:
      "Rilis v1.4.10 memperkuat ALETA x SIPP dengan registry query read-only, validasi keamanan SQL, dan pengecekan query aktif dari database agar monitoring, SK SIPP, assessment, dictionary, export, dan variable registry tidak bergantung pada query runtime yang sulit diaudit.",
    added: [
      "Pemeriksaan jumlah query ALETA x SIPP aktif SAFE_READ_ONLY di preflight.",
      "Catatan status unsafe/rejected query yang harus nol sebelum publik.",
      "Arah query registry sebagai pusat audit source file, parameter, tabel, kolom, dan status review.",
    ],
    changed: [
      "Runtime ALETA x SIPP diarahkan membaca query dari registry database atau memberi error konfigurasi yang jelas.",
      "Query monitoring, assessment, dictionary, dan export diperlakukan sebagai aset yang harus bisa diaudit.",
    ],
    fixed: [
      "Risiko fallback diam-diam ke query hardcoded ditekan melalui preflight dan registry service.",
      "Query yang tidak SELECT-only tidak boleh dianggap siap operasional.",
    ],
    security: [
      "SIPP tetap read-only: INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, dan REPLACE harus ditolak.",
      "Multiple statement berbahaya dan raw interpolation dari input user harus ditolak.",
    ],
    operationalNotes: [
      "Jalankan sync query registry sebelum UAT ALETA x SIPP.",
      "Review query needs_review dari panel admin sebelum dipakai untuk monitoring resmi.",
    ],
    knownLimitations: [
      "Registry membuktikan query tersimpan dan read-only; akurasi hasil tetap perlu dibandingkan dengan SIPP live/staging.",
      "Query berat tetap perlu profiling pada data besar.",
    ],
  },
  {
    version: "1.4.9",
    title: "ALETA v1.4.9 - ALETA Bot Runtime, Template DB, dan Dry-Run",
    date: "2026-06-13",
    status: "Bot Runtime Update",
    summary:
      "Rilis v1.4.9 memastikan ALETA Bot memakai runtime alur baru, template pesan dari database, konfigurasi recipient dari database, queue/log dry-run, dan health check tanpa mengirim WhatsApp live saat test.",
    added: [
      "Health check ALETA Bot menampilkan status setting, dry-run, gateway, template, recipient, dan log terakhir.",
      "Dry-run menjadi jalur verifikasi payload agar tidak mengirim pesan live ke nomor nyata.",
      "Catatan bahwa template WhatsApp Manajemen Surat dan notifikasi wajib berasal dari database.",
    ],
    changed: [
      "Runtime legacy portal dipisahkan dari runtime efektif ALETA Bot.",
      "Jika template/recipient tidak tersedia, sistem harus memberi error konfigurasi, bukan memakai fallback hardcoded diam-diam.",
    ],
    fixed: [
      "Risiko pesan terkirim memakai format lama dari legacy app.js dikurangi dengan runtime guard dan template database.",
      "Risiko duplikasi recipient dikurangi melalui resolver dan log dry-run.",
    ],
    security: [
      "WhatsApp live tidak boleh dipaksa saat test tanpa environment staging gateway.",
      "Nomor WhatsApp penerima harus berasal dari data user/pegawai/settings yang benar, bukan hardcoded runtime.",
    ],
    operationalNotes: [
      "Biarkan dry-run aktif sampai gateway staging tervalidasi.",
      "Gunakan halaman ALETA Bot untuk melihat queue, log, recipient preview, dan warning konfigurasi.",
    ],
    knownLimitations: [
      "Live send belum dianggap tervalidasi sampai diuji di gateway staging yang disetujui.",
      "Session QR/gateway bergantung pada layanan WhatsApp yang tersedia di server.",
    ],
  },
  {
    version: "1.4.8",
    title: "ALETA v1.4.8 - Manajemen Surat Database-Driven dan RBAC",
    date: "2026-06-12",
    status: "Mail Runtime Update",
    summary:
      "Rilis v1.4.8 memantapkan Manajemen Surat agar dashboard, daftar surat, detail, edit, disposisi, filter, search, pagination, upload/download, dan permission aksi berjalan dari database dan mengikuti role user.",
    added: [
      "Smoke Manajemen Surat untuk dashboard, tambah/detail/edit surat, disposisi, filter, search, pagination, dan lampiran.",
      "Catatan empty state yang benar ketika database kosong atau data tidak tersedia untuk role user.",
      "Validasi bahwa service surat dapat query database dari preflight.",
    ],
    changed: [
      "Fitur surat diarahkan ke data database, bukan dummy runtime.",
      "Permission aksi dipertegas agar role lihat saja tidak bisa create/edit/delete/disposisi.",
    ],
    fixed: [
      "Risiko tombol tampil tetapi tidak berfungsi dikurangi dengan test dan RBAC aksi.",
      "Download lampiran harus tetap terlindungi oleh session dan hak akses.",
    ],
    security: [
      "User tanpa hak tidak boleh melihat disposisi atau lampiran milik user/role lain.",
      "Upload file harus memvalidasi tipe, ukuran, metadata, dan lokasi penyimpanan.",
    ],
    operationalNotes: [
      "Lengkapi template surat aktif dari admin agar fitur template siap dipakai.",
      "Uji surat masuk/keluar dengan data UAT yang diberi prefix jelas.",
    ],
    knownLimitations: [
      "Template surat aktif masih perlu dikonfigurasi sesuai kebutuhan pengadilan.",
      "Validasi upload produksi perlu menyesuaikan batas ukuran dan lokasi storage server.",
    ],
  },
  {
    version: "1.4.7",
    title: "ALETA v1.4.7 - Admin Setting, Role, dan Database-Driven Runtime",
    date: "2026-06-11",
    status: "Admin Runtime Update",
    summary:
      "Rilis v1.4.7 memusatkan audit admin setting, role, permission, jabatan, module visibility, dan pengaturan modul agar perubahan admin tersimpan ke database dan berdampak nyata ke UI/API/runtime.",
    added: [
      "Audit sumber data untuk user, role, permission, jabatan, module visibility, setting modul, dan portal apps.",
      "Smoke module visibility agar menu hilang/aktif sesuai role dan API tetap terlindungi.",
      "Catatan first admin/bootstrap dan akun test role yang aman untuk simulasi.",
    ],
    changed: [
      "Admin setting diperlakukan sebagai sumber runtime yang harus persist setelah refresh dan restart server.",
      "Role catalog teknis dibedakan dari data operasional yang harus database-driven.",
    ],
    fixed: [
      "Risiko perubahan admin hanya tersimpan di state frontend dikurangi dengan verifikasi database.",
      "Risiko menu disembunyikan tetapi API tetap terbuka ditekan melalui test permission service.",
    ],
    security: [
      "User non-admin tidak boleh membuka admin route/API.",
      "User nonaktif tidak boleh login bila status aktif/nonaktif tersedia.",
    ],
    operationalNotes: [
      "Setelah mengubah role/permission, minta user logout-login ulang untuk memastikan session dan akses terbaru terbaca.",
      "Gunakan akun test khusus untuk simulasi, jangan ubah password user operasional nyata.",
    ],
    knownLimitations: [
      "Perubahan role yang sangat besar tetap perlu UAT lintas user nyata.",
      "Role catalog teknis masih boleh ada sebagai enum, selama bukan data operasional aktif.",
    ],
  },
  {
    version: "1.4.6",
    title: "ALETA v1.4.6 - Login, Logout, AccessDenied, dan Global Loading",
    date: "2026-06-10",
    status: "Auth UX Update",
    summary:
      "Rilis v1.4.6 memperkuat alur login/logout, halaman AccessDenied, protected route, protected API, dan global loading agar user tidak terjebak di halaman kosong atau loading tanpa akhir.",
    added: [
      "Test dan smoke untuk login berhasil/gagal, logout, protected route setelah logout, dan route tanpa permission.",
      "Selector stabil untuk logout sehingga browser/e2e dapat membuktikan session benar-benar selesai.",
      "Pesan AccessDenied diarahkan lebih jelas untuk user tanpa permission atau modul yang tidak tersedia.",
    ],
    changed: [
      "Loading profile/session harus punya akhir yang jelas: konten, redirect, AccessDenied, atau error state.",
      "User yang sudah logout diarahkan kembali ke /login dan tidak tetap berada di halaman portal.",
    ],
    fixed: [
      "Risiko global loading stuck saat HMR/dev compile dikurangi dengan state final yang bisa diuji.",
      "Risiko logout visual tidak terbukti dikurangi dengan data-testid dan smoke browser.",
    ],
    security: [
      "Protected route harus menolak akses langsung dari URL jika user belum login.",
      "Protected API harus tetap menolak request tanpa session meskipun menu disembunyikan di UI.",
    ],
    operationalNotes: [
      "Jika halaman terlihat memproses saat dev compile, tunggu sampai heading final muncul sebelum menyimpulkan stuck.",
      "Laporkan route yang blank atau loading lebih lama dari proses compile normal.",
    ],
    knownLimitations: [
      "Dev mode tetap dapat lebih lambat dari build production karena compile route pertama kali.",
      "AccessDenied visual lintas seluruh role tetap perlu UAT tambahan dengan akun operasional nyata.",
    ],
  },
  {
    version: "1.4.5",
    title: "ALETA v1.4.5 - Integrasi Portal, Audit, dan Dokumentasi Rilis",
    date: "2026-05-29",
    status: "Maintenance Update",
    summary:
      "Rilis v1.4.5 merapikan dokumentasi, patch notes, panduan, masukan pengguna, alur logout, dan integrasi proses aplikasi baru ke Portal ALETA agar JLF, E-Status, E-Kepegawaian, SIPP, APS Badilag, audit trail, ringkasan kerja, tugas, dan notifikasi berada dalam satu ekosistem yang lebih mudah diawasi.",
    added: [
      "Patch notes disusun ulang sampai v1.4.5 dengan riwayat rilis kecil dan besar yang lebih mudah dibaca.",
      "Panduan baru ditambahkan untuk JLF/Legal Form, E-Status, integrasi SIPP/APS Badilag, kategori masukan, dan rekomendasi lanjutan.",
      "Kategori masukan diperluas untuk JLF, E-Status, SIPP, APS Badilag, audit trail, notifikasi, dan aplikasi eksternal.",
    ],
    changed: [
      "Blangko Cepat JLF diarahkan memakai pilihan perkara seperti Pdt.G, Pdt.P, Pdt.GS, dan jenis lain tanpa kolom alur perkara tambahan yang membingungkan.",
      "Logout diarahkan kembali ke halaman login agar user tidak berhenti di halaman portal gagal muat setelah sesi dihapus.",
      "Panduan update server diarahkan ke baseline v1.4.5 agar admin memakai paket rilis terbaru.",
    ],
    fixed: [
      "Tampilan dan dokumentasi JLF diperjelas agar user memahami urutan pilih blangko, pilih perkara, pilih sidang, review/edit variabel, lalu generate.",
      "Catatan operasional integrasi dibuat lebih jelas untuk membedakan data SIPP read-only, direct link aplikasi, dan proses audit internal.",
    ],
    security: [
      "Panduan menegaskan bahwa integrasi SIPP tetap read-only dan kredensial aplikasi eksternal tidak boleh ditampilkan polos.",
      "Notifikasi WhatsApp dan ringkasan portal tetap diarahkan tidak memuat data pribadi lengkap seperti NIK penuh atau password.",
    ],
    operationalNotes: [
      "Setelah update, cek /aleta/login, /aleta/portal, /aleta/judicia/legal-form, /aleta/e-status, /aleta/admin/audit-trail, /aleta/admin/visibility-role, dan /aleta/admin/mapping-user-jabatan.",
      "Gunakan Pusat Masukan untuk mencatat kendala JLF, E-Status, SIPP, APS Badilag, audit trail, atau notifikasi dengan kategori yang sesuai.",
    ],
    knownLimitations: [
      "Direct login ke SIPP/APS Badilag tetap bergantung pada kemampuan aplikasi tujuan menerima sesi atau mekanisme jembatan login yang disepakati.",
      "Patch notes ini merapikan riwayat rilis aplikasi; validasi produksi tetap perlu dilakukan sesuai server dan database masing-masing pengadilan.",
    ],
    details: [
      {
        title: "Panduan Singkat v1.4.5",
        items: [
          "Mulai dari Portal, pastikan kartu aplikasi, ringkasan kerja, tugas, dan notifikasi atas sudah menampilkan proses dari modul baru.",
          "Buka Patch Notes, Panduan, dan Pusat Masukan untuk membaca riwayat rilis, cara kerja, dan tempat melaporkan kendala.",
        ],
      },
      {
        title: "Masukan Prioritas v1.4.5",
        items: [
          "Laporkan jika logout tidak kembali ke login, kartu aplikasi salah arah, atau audit trail tidak mencatat proses penting.",
          "Laporkan jika JLF, E-Status, SIPP, atau APS Badilag belum muncul pada role yang seharusnya memiliki akses.",
        ],
      },
    ],
  },
  {
    version: "1.4.4",
    title: "ALETA v1.4.4 - Akses Menu, Audit Trail, dan Notifikasi Global",
    date: "2026-05-28",
    status: "Maintenance Update",
    summary:
      "Rilis v1.4.4 menyambungkan aplikasi baru dan pengaturan admin baru ke pengendalian akses, audit trail, ringkasan kerja, tugas, pemberitahuan, serta pusat notifikasi agar aktivitas operasional tidak tersebar tanpa pemantauan.",
    added: [
      "Visibility role diperluas untuk aplikasi dan menu baru seperti E-Status, JLF, SIPP, APS Badilag, dan akses publik.",
      "Audit trail diarahkan sebagai tujuan resmi dari kartu Audit Trail di grid portal/admin.",
      "Ringkasan kerja dan Pusat Tugas mulai menampung proses dari modul baru yang relevan.",
    ],
    changed: [
      "Kartu aplikasi portal disesuaikan agar aplikasi internal dan tautan eksternal punya arah yang jelas.",
      "Notifikasi global dipakai sebagai jalur ringkas untuk approval, tindak lanjut, dan peringatan integrasi.",
    ],
    fixed: [
      "Menu yang sebelumnya belum muncul di pengaturan akses role ditambahkan agar admin dapat mengatur tampilannya.",
      "Arah kartu Audit Trail diperbaiki ke halaman /aleta/admin/audit-trail.",
    ],
    security: [
      "Menu sensitif tetap mengikuti role dan permission ALETA.",
      "Audit akses data sensitif, export, approval, dan integrasi diarahkan ke pencatatan terpusat.",
    ],
    operationalNotes: [
      "Cek Admin > Akses Menu per Tampilan Aplikasi setelah menambah modul baru.",
      "Pastikan role biasa tidak melihat pengaturan teknis SIPP, APS Badilag, atau E-Status.",
    ],
    knownLimitations: [
      "Sebagian notifikasi bergantung pada sumber data masing-masing modul.",
      "Audit trail teknis tetap perlu dibaca bersama log server untuk insiden integrasi tingkat rendah.",
    ],
  },
  {
    version: "1.4.3",
    title: "ALETA v1.4.3 - SIPP dan APS Badilag di Grid Aplikasi",
    date: "2026-05-27",
    status: "Maintenance Update",
    summary:
      "Rilis v1.4.3 menambahkan SIPP dan APS Badilag sebagai kartu aplikasi terarah dari Portal ALETA, sekaligus menyediakan pengaturan direct link dan sinkronisasi akun berbasis data SIPP.",
    added: [
      "Kartu SIPP dan APS Badilag disiapkan pada grid aplikasi Portal ALETA.",
      "Pengaturan admin untuk direct link aplikasi eksternal ditambahkan agar alamat tujuan tidak hard-code.",
      "APS Badilag diperlakukan memakai akun SIPP karena sumber user dan password berasal dari database SIPP yang sama.",
    ],
    changed: [
      "Akun aplikasi eksternal disatukan dalam pola manajemen akun agar admin tidak mengisi kredensial di banyak tempat.",
      "SIPP dan APS Badilag diposisikan sebagai aplikasi terintegrasi/eksternal, bukan modul internal yang mengubah database ALETA.",
    ],
    fixed: [
      "Arah klik kartu aplikasi eksternal dibuat lebih konsisten dengan pengaturan admin.",
      "Terminologi APS Badilag diperjelas agar tidak dianggap memiliki database user terpisah dari SIPP.",
    ],
    security: [
      "Password SIPP/APS diperlakukan sebagai rahasia dan tidak ditampilkan kembali secara polos setelah disimpan.",
      "Integrasi login eksternal tetap dibatasi oleh role ALETA dan pengaturan akses aplikasi.",
    ],
    operationalNotes: [
      "Isi direct link SIPP dan APS Badilag dari pengaturan admin sebelum kartu dipakai user.",
      "Gunakan akun uji untuk memastikan jembatan login tidak membuka akses di luar user yang sedang login.",
    ],
    knownLimitations: [
      "Auto-login eksternal membutuhkan dukungan endpoint atau pola sesi dari aplikasi tujuan.",
      "Jika aplikasi tujuan menolak direct session, ALETA hanya dapat mengantar ke halaman login tujuan.",
    ],
  },
  {
    version: "1.4.2",
    title: "ALETA v1.4.2 - Akun SIPP/APS dan Manajemen ASN",
    date: "2026-05-26",
    status: "Maintenance Update",
    summary:
      "Rilis v1.4.2 memperluas Manajemen Akun untuk kebutuhan kredensial SIPP/APS Badilag dan menyelaraskan data jabatan dengan kategori ASN, PPPK, Pejabat Negara, serta ketentuan khusus hakim.",
    added: [
      "Kolom pengaturan akun SIPP disiapkan pada manajemen akun sebagai dasar integrasi SIPP dan APS Badilag.",
      "Role ASN diperluas dengan PPPK dan Pejabat Negara agar struktur pegawai lebih sesuai aturan terbaru.",
      "Cuti Sakit Khusus hakim berdasarkan PERMA Nomor 7 Tahun 2016 dimasukkan ke konteks E-Kepegawaian.",
    ],
    changed: [
      "Ketua, Wakil Ketua, dan Hakim diklasifikasikan sebagai Pejabat Negara pada E-Kepegawaian.",
      "PPPK ditempatkan pada jabatan/unit tambahan yang sesuai, bukan otomatis mengisi jabatan struktural.",
      "Urutan jabatan disesuaikan: Ketua, Wakil, Hakim, Panitera, Sekretaris, lalu jabatan berikutnya.",
    ],
    fixed: [
      "Label peran efektif dan jabatan dirapikan agar PPPK tidak terlihat sebagai Ketua/Pimpinan bila hanya mengisi data role ASN.",
      "Dropdown jabatan disusun ulang agar jabatan utama lebih mudah ditemukan.",
    ],
    security: [
      "Kredensial SIPP/APS tidak boleh dibaca oleh user selain admin yang berwenang.",
      "Data jabatan dan status ASN tetap mengikuti audit perubahan akun.",
    ],
    operationalNotes: [
      "Cek kembali seluruh user hakim, pimpinan, PNS, dan PPPK setelah update.",
      "Gunakan jabatan/unit tambahan untuk PPPK sesuai kebutuhan kantor.",
    ],
    knownLimitations: [
      "Aturan ASN dapat berubah; admin kepegawaian perlu meninjau konfigurasi bila ada regulasi baru.",
      "Cuti khusus hakim tetap perlu verifikasi manual oleh pejabat berwenang.",
    ],
  },
  {
    version: "1.4.1",
    title: "ALETA v1.4.1 - E-Status Tracking, SLA, dan Template Instansi",
    date: "2026-05-25",
    status: "Maintenance Update",
    summary:
      "Rilis v1.4.1 memperkuat E-Status setelah masuk ke ALETA dengan tracking agency feedback, SLA, payload preview, watermark/hash export, QR verifikasi terbatas, MoU/PKS tracker, dan dashboard penolakan.",
    added: [
      "Tracking tindak lanjut E-Status untuk status diterima, diproses, selesai, ditolak, alasan penolakan, revisi, dan kirim ulang.",
      "SLA monitoring dari tanggal BHT atau penetapan final sampai data dikirim.",
      "Template surat dan ekspor per instansi mitra seperti Dukcapil, KUA, dan Kemenag.",
    ],
    changed: [
      "Preview payload dibuat sebelum approval agar pejabat melihat data minimal yang akan dikirim.",
      "QR verifikasi dibatasi pada nomor batch, status dokumen, tanggal terbit, dan hash tanpa membuka data pribadi.",
    ],
    fixed: [
      "Alur revisi E-Status diperjelas agar data final tidak diedit langsung tanpa alasan resmi.",
      "Dashboard penolakan ditambahkan untuk melihat pola reject dari instansi mitra.",
    ],
    security: [
      "Export diberi watermark pengunduh, waktu download, nomor batch, dan hash file.",
      "Data pribadi pada QR, notifikasi, dan laporan ringkas diminimalkan.",
    ],
    operationalNotes: [
      "Cek format data yang disepakati dengan setiap instansi mitra sebelum mengaktifkan template.",
      "Gunakan tracking untuk mencatat tanda terima, alasan penolakan, dan bukti tindak lanjut.",
    ],
    knownLimitations: [
      "Integrasi API/SFTP instansi mitra masih memerlukan kerja sama teknis resmi.",
      "SLA bergantung pada tanggal hukum yang berhasil terbaca dari SIPP dan hasil validasi manual.",
    ],
  },
  {
    version: "1.4.0",
    title: "ALETA v1.4.0 - E-Status Masuk ke ALETA",
    date: "2026-05-24",
    status: "Major Update",
    summary:
      "Rilis v1.4.0 memasukkan E-Status sebagai modul resmi ALETA untuk validasi, review, approval, batch, ekspor, pengiriman, dan pelacakan data perubahan status perkawinan ke Dukcapil, KUA, dan Kemenag dengan prinsip SIPP read-only dan audit kuat.",
    added: [
      "Modul E-Status ditambahkan ke daftar aplikasi ALETA sebagai aplikasi internal yang memakai login, role, audit, identitas instansi, dan notifikasi ALETA.",
      "Rule engine validasi hukum disiapkan untuk perkara cerai BHT, cerai talak dengan perhatian ikrar/akta cerai, dan itsbat nikah dikabulkan.",
      "SIPP Mapping Center ditambahkan untuk deteksi struktur, versi mapping, preview query, dry run, validasi SELECT-only, dan deteksi perubahan struktur.",
      "Data readiness score, duplicate detection, batch locking, revision workflow, dan snapshot data saat batch dikunci disiapkan.",
    ],
    changed: [
      "E-Status tidak diposisikan sebagai alat ambil data lalu kirim, tetapi sebagai validasi administratif-hukum dan pengiriman data pribadi yang dapat diaudit.",
      "AI Global ALETA hanya menjadi alat bantu mapping, ringkasan, draft surat, dan klasifikasi error, bukan pengambil keputusan hukum.",
    ],
    fixed: [
      "Alur batch E-Status dibuat berjenjang: operator menyiapkan, validator memeriksa, pejabat menyetujui, batch dikunci, lalu dikirim atau diekspor.",
      "Data manual pelengkap disimpan di database internal E-Status tanpa mengubah data SIPP.",
    ],
    security: [
      "Koneksi SIPP wajib read-only dan query modifikasi seperti INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, dan CREATE diblokir.",
      "NIK, password koneksi, API key, export, download, dan preview payload diperlakukan sebagai aktivitas sensitif yang diaudit.",
    ],
    operationalNotes: [
      "Gunakan file struktur SIPP contoh hanya untuk mapping awal; koneksi produksi harus memakai konfigurasi database SIPP aktif.",
      "Sebelum pengiriman resmi, pastikan ada MoU/PKS atau dasar kerja sama dengan instansi mitra.",
    ],
    knownLimitations: [
      "Data yang belum BHT, belum final, ditolak, dicabut, tidak diterima, atau masih upaya hukum tidak boleh dikirim.",
      "Format data setiap instansi mitra dapat berbeda dan harus dikonfigurasi per instansi.",
    ],
  },
  {
    version: "1.3.3",
    title: "ALETA v1.3.3 - Legal Form Stabilization",
    date: "2026-05-20",
    status: "Maintenance Update",
    summary:
      "Rilis v1.3.3 menstabilkan Blangko Cepat JLF, memperbaiki edit manual variabel, menambah dukungan Pdt.GS, merapikan pilihan perkara, dan memastikan hasil RTF lebih konsisten mengganti placeholder.",
    added: [
      "Dukungan Pdt.GS/Gugatan Sederhana ditambahkan ke pilihan nomor perkara JLF.",
      "Nomor variabel ABT ditampilkan pada daftar variabel agar user tidak bingung membaca placeholder legacy.",
    ],
    changed: [
      "Alur Blangko Cepat diringkas menjadi pilih blangko, pilih perkara, pilih sidang, review/edit variabel, dan generate.",
      "Kolom pencarian template/blangko dirapikan agar tidak terasa duplikatif dengan dropdown template.",
    ],
    fixed: [
      "Tombol edit manual variabel dibuat dapat dipakai untuk nilai otomatis maupun nilai kosong.",
      "Hasil generate RTF diperbaiki agar override manual tidak berubah menjadi blank.",
    ],
    security: [
      "Edit manual tetap dicatat sebagai override dan tidak mengubah sumber data SIPP.",
      "Preview variabel dibatasi pada perkara yang sedang diproses user.",
    ],
    operationalNotes: [
      "Uji dokumen dengan contoh RTF ABT dan perkara SIPP sementara sebelum dipakai untuk blangko resmi.",
      "Gunakan filter kosong untuk melengkapi variabel yang belum terisi sebelum generate final.",
    ],
    knownLimitations: [
      "Placeholder lama yang tidak terdaftar di kamus ABT tetap perlu mapping manual.",
      "Format RTF yang sangat kompleks dapat membutuhkan penyesuaian template.",
    ],
  },
  {
    version: "1.3.2",
    title: "ALETA v1.3.2 - Multi Sidang dan BAS Modern",
    date: "2026-05-19",
    status: "Maintenance Update",
    summary:
      "Rilis v1.3.2 membangun pola Multi Sidang dan Tanya Jawab/BAS modern berdasarkan perilaku ABT, dengan urutan sidang, preview output, dan edit manual tetap menjadi kontrol utama user.",
    added: [
      "Multi Sidang menampilkan sidang sebelumnya, sidang terpilih, dan sidang berikutnya berdasarkan tanggal dan agenda.",
      "Editor Tanya Jawab/BAS disiapkan untuk saksi, pihak, ahli, dan format tanya jawab lain yang masuk ke blangko.",
      "Output multi data dapat masuk ke RTF/blangko sebagai teks terformat.",
    ],
    changed: [
      "Agenda sidang diurutkan berdasarkan data SIPP agar pilihan sidang otomatis lebih masuk akal.",
      "Nilai hasil Multi Sidang dan BAS tetap dapat diubah manual sebelum generate.",
    ],
    fixed: [
      "Pilihan sidang otomatis/tidak dipilih dibuat lebih jelas untuk user biasa.",
      "Nilai multiline diperbaiki agar tidak hilang saat masuk ke RTF.",
    ],
    security: [
      "Data sidang dibaca dari SIPP melalui adapter read-only.",
      "Perubahan manual tidak menulis balik ke SIPP.",
    ],
    operationalNotes: [
      "Periksa urutan sidang untuk perkara dengan agenda banyak sebelum generate.",
      "Gunakan preview BAS untuk memastikan tanya jawab masuk dalam susunan yang benar.",
    ],
    knownLimitations: [
      "Agenda sidang yang kosong di SIPP tetap perlu dilengkapi manual.",
      "Format BAS lokal tiap satuan kerja bisa memerlukan template berbeda.",
    ],
  },
  {
    version: "1.3.1",
    title: "ALETA v1.3.1 - Source Data Preview dan Mapping ABT",
    date: "2026-05-18",
    status: "Maintenance Update",
    summary:
      "Rilis v1.3.1 menambahkan lapisan kompatibilitas ABT ke JLF dengan mapping tipe variabel ke field mode modern, preview sumber data, dan validasi query SELECT-only.",
    added: [
      "Mapping tipe ABT ke mode JLF ditambahkan untuk data_sql, data_sipp, data_teks, data_tanggal, tanggal_hari, tanggal_hijriah, terbilang, multi_sidang, dan tanya_jawab.",
      "Preview query SELECT-only disiapkan untuk admin sebelum mapping sumber data digunakan user.",
      "Toggle AI per template/field ditambahkan dengan default OFF.",
    ],
    changed: [
      "Data SQL dan Data SIPP disederhanakan menjadi konsep Mode Sumber Data berbasis query atau binding.",
      "User biasa memakai hasil final dan edit manual, sedangkan admin mengatur mapping dan query.",
    ],
    fixed: [
      "Status manual override, source, tipe ABT, dan nomor variabel ditampilkan lebih jelas di review variabel.",
      "Nilai otomatis yang kosong tidak langsung dianggap final dan diarahkan ke review manual.",
    ],
    security: [
      "Query sumber data dibatasi SELECT-only dan tidak boleh memuat perintah modifikasi.",
      "AI bersifat opsional dan tidak menjadi syarat sistem bekerja.",
    ],
    operationalNotes: [
      "Admin perlu menguji preview query sebelum memberi akses template ke user.",
      "Jika AI dimatikan, seluruh input tetap bisa diselesaikan manual.",
    ],
    knownLimitations: [
      "Mapping otomatis dari ABT tetap perlu verifikasi manual karena struktur template lama bisa berbeda.",
      "Excel ABT menjadi kamus perilaku, bukan sumber yang ditiru mentah-mentah.",
    ],
  },
  {
    version: "1.3.0",
    title: "ALETA v1.3.0 - ALETA Judicia Legal Form Berbasis ABT",
    date: "2026-05-17",
    status: "Major Update",
    summary:
      "Rilis v1.3.0 menjadikan ALETA Judicia / Legal Form sebagai modul pembuatan blangko modern berbasis pola ABT, tetapi dengan UI lebih ringkas, SIPP read-only, preview variabel, edit manual, validasi, audit, dan AI Assist yang bisa dinyalakan atau dimatikan.",
    added: [
      "Blangko Cepat JLF disusun dengan alur ABT-style: pilih template, pilih perkara, pilih sidang, review variabel, lalu generate.",
      "Kamus variabel ABT dari abt_variabel.xls dan abt_variabel_tipe.xls dipakai sebagai acuan mapping perilaku.",
      "Mode modern disiapkan: Sumber Data, Input Manual, Tanggal, Angka/Terbilang, Multi Data/Multi Sidang, Tanya Jawab, dan AI Assist.",
      "JLF membaca data SIPP sementara/read-only untuk uji perkara, pihak, sidang, putusan, dan variabel blangko.",
    ],
    changed: [
      "ABT dijadikan kamus perilaku dan variabel, bukan disalin mentah-mentah ke ALETA.",
      "Semua hasil otomatis wajib bisa diedit manual sebelum dokumen final dibuat.",
    ],
    fixed: [
      "Tampilan JLF awal diringkas agar tidak terlalu crowded untuk user biasa.",
      "Placeholder legacy seperti #0001# tetap didukung sambil memperkenalkan semantic key modern.",
    ],
    security: [
      "JLF memakai login ALETA dan adapter SIPP read-only.",
      "AI tidak boleh menyimpulkan status hukum atau mengganti kontrol user pada dokumen.",
    ],
    operationalNotes: [
      "Gunakan template RTF uji dan perkara SIPP sementara untuk validasi awal.",
      "Admin mengatur mapping, user melakukan review/edit sebelum generate.",
    ],
    knownLimitations: [
      "Template lama dengan kode variabel tidak standar perlu mapping tambahan.",
      "Hasil dokumen resmi tetap perlu pemeriksaan manusia sebelum digunakan.",
    ],
  },
  {
    version: "1.2.4",
    title: "ALETA v1.2.4 - Statistik E-Kepegawaian dan WhatsApp Cuti",
    date: "2026-05-16",
    status: "Maintenance Update",
    summary:
      "Rilis v1.2.4 menambahkan statistik cuti, simulasi persentase pegawai cuti pada hari tertentu, mode WhatsApp permohonan cuti, autoform publik yang lebih halus, dan dukungan kalender tanggal merah/cuti bersama.",
    added: [
      "Statistik permintaan cuti ditambahkan di E-Kepegawaian dan ALETA Bot.",
      "Simulasi menghitung persentase pegawai yang cuti pada tanggal tertentu.",
      "Mode WhatsApp permohonan cuti disiapkan untuk kirim chat dengan format tertentu.",
    ],
    changed: [
      "Autoform publik mengisi data pegawai tanpa loading screen besar.",
      "Jika sebagian data sudah diisi, sistem menampilkan dropdown pilihan pegawai yang cocok.",
    ],
    fixed: [
      "Perhitungan hari cuti mengabaikan akhir pekan, tanggal merah, dan cuti bersama yang sudah terdaftar.",
      "Saldo N, N-1, dan N-2 ditampilkan lebih jelas pada form cuti publik.",
    ],
    security: [
      "Autoform publik tetap membatasi data yang ditampilkan dan tidak membuka seluruh profil pegawai.",
      "WhatsApp tidak mengirim data sensitif penuh.",
    ],
    operationalNotes: [
      "Admin perlu mengimpor kalender libur/cuti bersama agar perhitungan cuti akurat.",
      "Uji lookup pegawai memakai NIK, nama, dan nomor HP sebelum dipakai publik.",
    ],
    knownLimitations: [
      "Hari libur yang belum masuk kalender admin tidak otomatis dihitung.",
      "Persentase cuti bergantung pada data pegawai aktif yang tersinkron.",
    ],
  },
  {
    version: "1.2.3",
    title: "ALETA v1.2.3 - Akses Publik E-Kepegawaian",
    date: "2026-05-15",
    status: "Maintenance Update",
    summary:
      "Rilis v1.2.3 membuat layanan publik E-Kepegawaian tanpa login lebih menyatu dengan halaman login ALETA melalui tab, URL langsung, dan jalur WhatsApp.",
    added: [
      "Tab E-Kepegawaian ditambahkan pada halaman login untuk layanan tanpa login.",
      "URL langsung disediakan untuk cuti, PCK, SKP, WFA, lambat datang, pulang cepat, dan agenda rapat.",
      "Metode akses WhatsApp disiapkan sebagai kanal layanan publik internal.",
    ],
    changed: [
      "Card login, lupa password, dan E-Kepegawaian dibuat lebih slim.",
      "Istilah Layanan Tanpa Login diganti menjadi E-Kepegawaian agar lebih jelas.",
    ],
    fixed: [
      "Layout tab login dirapikan agar tidak terasa terpisah dari ALETA.",
      "Spasi/enter berlebih pada card login, lupa password, dan E-Kepegawaian dikurangi.",
    ],
    security: [
      "Layanan tanpa login hanya membuka form permohonan, bukan area admin atau data sensitif.",
      "Input publik tetap masuk jalur validasi dan audit aplikasi.",
    ],
    operationalNotes: [
      "Cek seluruh URL publik E-Kepegawaian dari halaman login dan direct link.",
      "Pastikan kanal WhatsApp hanya menerima format yang sudah ditentukan.",
    ],
    knownLimitations: [
      "Form publik tetap perlu pencocokan data pegawai agar tidak salah identitas.",
      "Agenda rapat publik bergantung pada pengaturan yang diaktifkan admin.",
    ],
  },
  {
    version: "1.2.2",
    title: "ALETA v1.2.2 - Penguatan ASN, PPPK, dan Cuti Khusus Hakim",
    date: "2026-05-14",
    status: "Maintenance Update",
    summary:
      "Rilis v1.2.2 menyesuaikan E-Kepegawaian dan Manajemen Akun dengan kategori ASN terbaru, PPPK, Pejabat Negara, dan kebutuhan cuti khusus hakim.",
    added: [
      "Role ASN PPPK dan Pejabat Negara ditambahkan sebagai pilihan klasifikasi akun.",
      "Cuti Sakit Khusus hakim berdasarkan PERMA Nomor 7 Tahun 2016 ditambahkan pada konteks cuti.",
      "Jabatan PPPK disediakan di daftar jabatan/unit tambahan sesuai kebutuhan administrasi.",
    ],
    changed: [
      "Ketua, Wakil Ketua, dan Hakim tidak lagi diperlakukan sebagai PNS dalam E-Kepegawaian.",
      "PPPK tidak otomatis mengisi jabatan struktural dan diarahkan ke jabatan/unit tambahan.",
    ],
    fixed: [
      "Urutan jabatan diperbaiki agar pimpinan dan hakim muncul sebelum panitera, sekretaris, dan jabatan lain.",
      "Label peran ASN dirapikan agar tidak tertukar dengan jabatan efektif.",
    ],
    security: [
      "Perubahan role ASN tetap dibatasi pada admin yang berwenang mengelola akun.",
      "Data cuti khusus tetap membutuhkan approval manusia.",
    ],
    operationalNotes: [
      "Admin perlu meninjau ulang semua akun PPPK, hakim, ketua, dan wakil setelah update.",
      "Gunakan catatan perubahan saat mengubah klasifikasi ASN pegawai.",
    ],
    knownLimitations: [
      "Penyesuaian aturan ASN tetap perlu mengikuti kebijakan terbaru yang berlaku di instansi.",
      "Cuti khusus hakim memerlukan verifikasi dokumen dan kewenangan pejabat terkait.",
    ],
  },
  {
    version: "1.2.1",
    title: "ALETA v1.2.1 - E-Kepegawaian, Cuti, dan Integrasi WhatsApp",
    date: "2026-05-13",
    status: "Feature Update",
    summary:
      "Rilis v1.2.1 menjadikan E-Kepegawaian sebagai modul native ALETA. Fokusnya adalah layanan mandiri pegawai, pengajuan cuti dengan saldo N/N-1/N-2, approval berjenjang, pengaturan admin E-Kepegawaian, import data pegawai, dokumen PCK/SKP/WFA, PDF formulir cuti, notifikasi WhatsApp melalui ALETA Bot, serta sinkronisasi ke Ringkasan Kerja, Pusat Tugas, dan Pusat Masukan.",
    added: [
      "Modul E-Kepegawaian ditambahkan sebagai aplikasi native di dalam portal ALETA tanpa login baru dan tanpa aplikasi terpisah.",
      "Sidebar E-Kepegawaian dibuat mengikuti pola Manajemen Surat dengan menu layanan pegawai seperti Dashboard Saya, Pengajuan Cuti, Upload PCK, Upload SKP, Upload WFA, Izin Kehadiran, dan Dokumen Saya.",
      "Tampilan E-Kepegawaian dibedakan berdasarkan role: pegawai fokus pada pengajuan dan dokumen, pejabat berwenang fokus pada approval dan monitoring, sedangkan admin fokus pada konfigurasi.",
      "Pengaturan Admin E-Kepegawaian masuk ke area Admin ALETA di /aleta/admin/e-kepegawaian sebagai pusat konfigurasi cuti, saldo, workflow, upload, template, import, data pegawai, dan export.",
      "Pengajuan cuti internal tersedia dengan pilihan jenis cuti, tanggal mulai, tanggal selesai, alasan, alamat selama cuti, kontak, saldo tersedia, dan alur persetujuan.",
      "Saldo cuti tahunan N, N-1, dan N-2 ditampilkan pada alur cuti dan dapat dikelola dari pengaturan admin.",
      "Riwayat cuti menampilkan status, nomor permohonan, hari cuti, pihak persetujuan, tombol preview, dan tombol unduh formulir PDF.",
      "Preview dan download formulir cuti PDF ditambahkan agar user dapat melihat hasil formulir sebelum atau sesudah proses approval.",
      "Manajemen tanda tangan pegawai dan pejabat disiapkan untuk mendukung formulir cuti dan dokumen E-Kepegawaian.",
      "Import data pegawai dari Excel/CSV ditambahkan untuk sinkron awal unit kerja, pangkat/golongan, atasan langsung, pejabat approval, kontak, dan email.",
      "Kalender cuti visual, kalender libur, SLA approval, reminder dokumen tahunan, workflow approval builder, dan export laporan E-Kepegawaian disiapkan di panel admin.",
      "E-Kepegawaian terhubung dengan ALETA Bot/WhatsApp menggunakan sumber aplikasi e_kepegawaian agar notifikasi HR bisa dipisahkan dari Manajemen Surat.",
      "Pusat Masukan kini memiliki area dan kategori khusus untuk E-Kepegawaian, cuti, PDF formulir, approval, import pegawai, dan WhatsApp HR.",
    ],
    changed: [
      "E-Kepegawaian tidak lagi diperlakukan sebagai placeholder portal; modul sekarang memiliki route, API, service, panel, dan data pendukung sendiri.",
      "Pengaturan E-Kepegawaian dipindahkan ke pola Admin ALETA agar konfigurasi aplikasi tidak bercampur dengan tampilan operasional pegawai.",
      "Panel admin E-Kepegawaian memakai tab atas seperti pola ALETA Bot untuk menggantikan sidebar konfigurasi yang terlalu panjang.",
      "Tabel Import Pegawai dan Data Pegawai diberi ruang baca dan scrollbar horizontal agar kolom panjang tidak terpotong.",
      "Card pengajuan cuti dan riwayat cuti disusun ulang dengan porsi 40/60 agar form pengajuan tetap terbaca dan riwayat tetap cukup lebar.",
      "Bahasa tampilan E-Kepegawaian dirapikan agar lebih mudah dipahami pegawai, sementara istilah wajib seperti PDF, upload, export, dan watermark tetap dipertahankan bila memang diperlukan.",
      "Formulir cuti PDF dirapikan agar posisi tabel, tanda tangan, QR verifikasi, dan keterangan dokumen lebih mendekati format resmi yang dipakai kantor.",
      "Ringkasan Kerja, Pusat Tugas & Notifikasi, dan Tugas & Pemberitahuan disiapkan untuk membaca tugas terkait E-Kepegawaian.",
      "Panduan update server diarahkan ke versi 1.2.1 agar tidak bercampur dengan baseline v1.1.3.",
    ],
    fixed: [
      "Error relation hr_settings does not exist dan hr_notification_templates does not exist diperbaiki dengan menyiapkan struktur database E-Kepegawaian yang dibutuhkan modul.",
      "Error pengajuan cuti could not determine data type of parameter diperbaiki pada query submit cuti agar parameter tanggal dan nilai kosong dibaca eksplisit oleh PostgreSQL.",
      "Tombol preview formulir cuti pada riwayat cuti diperbaiki agar membuka PDF hasil cuti, bukan hanya tombol unduh.",
      "Nama atasan langsung dan pejabat berwenang ditampilkan pada alur pengajuan cuti agar pegawai tahu siapa yang memproses persetujuan.",
      "Card pengaturan admin yang sebelumnya menyisakan ruang kosong saat scroll dirapikan dengan layout tab dan card yang lebih stabil.",
      "Scrollbar horizontal pada tabel E-Kepegawaian dibuat konsisten dengan warna slider biru seperti area admin lainnya.",
      "Teks tabel pada Import Pegawai dan Data Pegawai diberi padding agar tidak terlalu mepet dengan garis tabel.",
      "Login yang sempat stuck pada status Menyiapkan login ditelusuri dari sisi endpoint session dan hydration agar tombol login kembali turun ke state siap digunakan.",
      "PDF formulir cuti diperbaiki agar tanda tangan pimpinan tidak keluar dari area halaman dan garis tabel lebih rapi.",
    ],
    security: [
      "E-Kepegawaian memakai auth, user, dan role ALETA yang sudah ada; tidak ada login, register, atau sistem role baru yang terpisah.",
      "Menu dan aksi E-Kepegawaian mengikuti role-based access: pegawai tidak melihat konfigurasi admin, pejabat hanya memproses approval yang terkait, dan admin mengelola konfigurasi sesuai kewenangan.",
      "Endpoint E-Kepegawaian disiapkan dengan guard session dan kontrol akses agar data cuti, dokumen, dan profil pegawai tidak terbuka lintas user.",
      "Download dan preview lampiran HR diarahkan melalui route aplikasi agar path file internal tidak langsung dibuka dari browser.",
      "Import pegawai hanya memperbarui profil yang terhubung dengan user ALETA agar tidak membuat data pegawai yatim tanpa akun.",
      "Notifikasi WhatsApp E-Kepegawaian memakai jalur ALETA Bot/queue sehingga pengiriman dapat diaudit bersama laporan WhatsApp.",
      "Paket update tetap tidak membawa env, config server, database, upload, PDF, node_modules, build cache, atau session WhatsApp.",
    ],
    operationalNotes: [
      "Setelah update, validasi /aleta/login, /aleta/portal, /aleta/e-kepegawaian, /aleta/admin/e-kepegawaian, /aleta/admin/aleta-bot, /aleta/tugas, /aleta/patch-notes, /aleta/panduan, dan /aleta/masukan.",
      "Login sebagai pegawai biasa untuk menguji Pengajuan Cuti, Riwayat Cuti, preview PDF, upload PCK/SKP/WFA, dan Dokumen Saya.",
      "Login sebagai pejabat berwenang untuk menguji daftar approval, detail permohonan, setujui, tolak, revisi, dan monitoring SLA.",
      "Login sebagai Admin atau Super Admin untuk menguji Pengaturan Admin E-Kepegawaian, saldo N/N-1/N-2, jenis cuti, workflow approval, tanda tangan, template WhatsApp, import pegawai, export, dan kalender libur.",
      "Uji ALETA Bot/WhatsApp setelah membuat data uji E-Kepegawaian agar notifikasi HR tercatat dengan sourceApp e_kepegawaian.",
      "Untuk paket rilis berikutnya, gunakan scripts/aleta-make-update.sh 1.2.1 dan pasang dengan scripts/aleta-update.sh setelah backup.",
      "Jika update dilakukan manual lewat SSH, backup aplikasi server dulu lalu rebuild portal sampai build sukses sebelum menjalankan container baru.",
    ],
    knownLimitations: [
      "Import data pegawai membutuhkan header yang sesuai agar mapping NIP, unit, pangkat, atasan, pejabat approval, WhatsApp, dan email terbaca benar.",
      "Formulir PDF cuti sudah dirapikan, tetapi instansi tetap perlu mengecek kembali bila ada format resmi baru atau perbedaan kop/tata letak lokal.",
      "Scheduler reminder dokumen tahunan tetap perlu dijalankan sesuai jadwal server atau cron internal yang disepakati admin teknis.",
      "Workflow approval dapat disusun dari admin, tetapi perubahan workflow sebaiknya diuji memakai data uji sebelum dipakai untuk pengajuan nyata.",
      "Notifikasi WhatsApp tetap bergantung pada status koneksi WhatsApp Gateway dan antrean ALETA Bot.",
      "Data saldo cuti awal tetap perlu diverifikasi admin kepegawaian sebelum pegawai memakai modul cuti untuk pengajuan resmi.",
    ],
    details: [
      {
        title: "Panduan Singkat Setelah Update v1.2.1",
        items: [
          "Buka /aleta/login dan pastikan nomor Patch Notes v1.2.1 tampil.",
          "Buka /aleta/admin/e-kepegawaian sebagai Super Admin, lalu cek Status Modul, Hak Cuti Tahunan, Saldo Awal N/N-1/N-2, Cara Hitung Cuti, Upload, SLA, dan Format Nomor Permohonan.",
          "Buka tab Saldo Cuti untuk koreksi saldo pegawai dengan alasan yang jelas.",
          "Buka tab Kalender Cuti untuk melihat cuti/libur dan SLA approval.",
          "Buka tab Tanda Tangan untuk memastikan foto tanda tangan pegawai atau pejabat sudah tersedia.",
          "Buka tab Import Pegawai dan Data Pegawai untuk memastikan profil pegawai terhubung ke user ALETA.",
          "Buka /aleta/e-kepegawaian sebagai pegawai, ajukan cuti uji, lalu cek riwayat, nama persetujuan, preview PDF, dan unduh PDF.",
          "Buka ALETA Bot dan laporan WhatsApp untuk memastikan notifikasi E-Kepegawaian tercatat terpisah dari Manajemen Surat.",
          "Buka Patch Notes, Panduan, dan Pusat Masukan untuk memastikan dokumentasi sudah mengikuti v1.2.1.",
        ],
      },
      {
        title: "Masukan Prioritas Setelah v1.2.1",
        items: [
          "Laporkan jika saldo N/N-1/N-2 tidak sesuai data kepegawaian kantor.",
          "Laporkan jika preview atau unduh PDF cuti tidak sesuai format resmi.",
          "Laporkan jika nama atasan langsung atau pejabat berwenang pada pengajuan cuti tidak tepat.",
          "Laporkan jika approval, tolak, revisi, atau status cuti tidak berubah sesuai alur.",
          "Laporkan jika import Excel/CSV pegawai gagal membaca kolom atau membuat data tidak sinkron.",
          "Laporkan jika reminder PCK/SKP/WFA tidak masuk antrean WhatsApp atau laporan ALETA Bot.",
          "Laporkan jika card atau tabel E-Kepegawaian masih terpotong di layar laptop, tablet, atau HP.",
          "Laporkan jika Pusat Tugas tidak menampilkan tugas E-Kepegawaian yang seharusnya muncul.",
        ],
      },
    ],
  },
  {
    version: "1.1.3",
    title: "ALETA v1.1.3 - Akses Publik, Asisten Hakim Wrapped, dan Sinkronisasi Portal",
    date: "2026-05-22",
    status: "Maintenance Update",
    summary:
      "Rilis v1.1.3 merapikan dokumentasi dan beberapa alur penting setelah v1.1.2. Fokusnya adalah menambahkan menu Akses Publik, memperjelas login sebagai SSO portal aplikasi pengadilan, memperbaiki ringkasan AI surat, menyempurnakan viewer PDF, membuka Asisten Hakim dalam tampilan wrapped/embedded ALETA, menyiapkan instalasi pertama yang lebih lengkap, serta menyinkronkan Ringkasan Kerja, Tugas Penting, Pusat Tugas, dan menu admin dengan perubahan terbaru.",
    added: [
      "Menu Admin > Akses Publik ditambahkan sebagai tempat mencatat URL publik aplikasi, metode akses, status, dan catatan teknis.",
      "Akses Publik juga masuk ke sidebar Admin agar admin teknis mudah membuka pengaturan alamat aplikasi.",
      "Asisten Hakim kini dapat membuka AI terdaftar dalam halaman ALETA melalui mode wrapped/embedded, sehingga pengalaman user tetap terasa berada di dalam aplikasi.",
      "Super Admin dapat mengaktifkan atau menonaktifkan mode wrapped/embedded untuk setiap AI Asisten Hakim secara terpisah.",
      "Halaman instalasi pertama menyiapkan pengisian konfigurasi awal secara manual, termasuk koneksi database utama dan database tambahan dinamis.",
      "Pusat Tugas masuk ke sidebar utama dan menjadi rujukan bersama untuk tugas dari Manajemen Surat, ALETA Bot, Pusat Masukan, dan persetujuan admin.",
      "Halaman login kini menampilkan nomor versi Patch Notes di bawah prinsip Sederhana, Cepat, dan Biaya Ringan.",
      "Copyright kecil ditambahkan pada halaman login dan footer, serta dapat diklik menuju kanal pemilik aplikasi.",
      "Panduan v1.1.3 ditambahkan untuk alur Akses Publik, login SSO, ringkasan AI surat, viewer PDF, dan paket update terbaru.",
      "Pusat Masukan kini memiliki kategori khusus untuk Akses Publik, ringkasan AI surat, login SSO, dan viewer PDF.",
    ],
    changed: [
      "Kalimat login disesuaikan menjadi SSO Single Sign On (Portal Aplikasi Nama Pengadilan) dengan nama pengadilan dari Identitas Instansi.",
      "Jika Identitas Instansi belum diisi, login tetap memakai fallback Pengadilan Digital agar tampilan tidak kosong.",
      "Ringkasan AI untuk input surat diarahkan mengambil maksud dan tujuan surat, bukan menyalin kop, nomor surat, tanggal, NIP, atau metadata dokumen.",
      "Viewer dokumen surat dirapikan: istilah tanda air diganti menjadi watermark, pas lebar diganti menjadi Fit to Width, dan tombol Unduh/Cetak dibuat lebih mudah terlihat.",
      "Ringkasan Kerja, Tugas Penting, dan Pusat Tugas kini memakai sumber tugas yang sama agar angka dan daftar tidak saling berbeda.",
      "Kartu Ringkasan Kerja memisahkan Masukan Pengguna dan Persetujuan Admin agar link tujuan sesuai dengan isi tugas.",
      "Menu Notifikasi WA dipisah dari Pusat Tugas pada konfigurasi internal supaya hak akses menu tidak saling menimpa.",
      "Admin Hub, sidebar Admin, dan halaman admin dicek ulang agar Super Admin dan Admin melihat menu sesuai kewenangannya.",
      "Panduan server dan paket update diarahkan ke versi 1.1.3 agar tidak bercampur dengan baseline v1.1.2.",
      "Dokumentasi deploy kembali menegaskan bahwa update manual cukup copy source aplikasi, bukan config dan runtime server.",
    ],
    fixed: [
      "Ringkasan Isi Inti Surat dari deteksi AI tidak lagi terlalu mudah mengambil data formal seperti nomor surat, tanggal surat, nama jabatan, atau data identitas yang bukan inti maksud surat.",
      "Login menampilkan versi aplikasi yang sama dengan Patch Notes aktif.",
      "Pengaturan Akses Publik tersimpan melalui Pengaturan Panel tanpa membuka konfigurasi server ke frontend.",
      "Viewer PDF lebih presisi antara metadata surat dan area dokumen sehingga halaman detail surat tidak menyisakan ruang kosong yang membingungkan.",
      "Link Disposisi Terlambat dari Dashboard Manajemen Surat kini membuka filter tugas mendesak dengan parameter yang dipahami Pusat Tugas.",
      "Akses Publik masuk ke visibility Admin sehingga menu yang tersedia di Admin Hub juga konsisten di sidebar.",
      "Paket update v1.1.3 kini membawa manifest aleta-update.json di dalam arsip agar script update server lama tidak menolak paket karena manifest hilang.",
      "Daftar Sumber Data ALETA Bot tidak lagi melebar keluar card; scrollbar kiri-kanan dibuat lebih jelas, sinkron, dan dibantu tombol geser.",
      "Bahasa Manajemen Surat dirapikan agar istilah umum lebih mudah dipahami user, sementara istilah teknis tetap dipakai pada area admin yang membutuhkan.",
    ],
    security: [
      "Akses Publik hanya menyimpan alamat dan catatan publik; fitur ini tidak otomatis membuka database, session WhatsApp, file env, atau akses server.",
      "Pengaturan Akses Publik tetap berada di area Admin/Super Admin dan mengikuti hak akses panel.",
      "Asisten Hakim wrapped/embedded tetap mengikuti hak akses role dan user yang diatur Super Admin.",
      "Mode wrapped membantu user tidak melihat URL asli pada tampilan aplikasi; jika situs AI menolak iframe, Super Admin dapat menonaktifkan wrapped untuk AI tersebut.",
      "Pusat Tugas tetap memakai data sesuai user login, sehingga tugas surat, bot, masukan, dan persetujuan admin tidak dibuka untuk role yang tidak berhak.",
      "Ringkasan AI surat diarahkan untuk tidak membawa metadata sensitif yang tidak perlu ke ringkasan utama.",
      "Viewer PDF tetap memakai kontrol akses aplikasi; tombol Unduh dan Cetak hanya menjadi aksi dokumen untuk user yang sudah berhak membuka surat.",
      "Panduan update tetap melarang copy file config dan runtime seperti .env, next.config.ts, Dockerfile, node_modules, data, uploads, PDF, dan session WhatsApp.",
    ],
    operationalNotes: [
      "Menu Akses Publik tidak mengganti tugas DNS, HTTPS, reverse proxy, Cloudflare Tunnel, VPN, atau pengaturan jaringan server; admin tetap harus menyiapkannya di luar aplikasi.",
      "Setelah update, validasi /aleta/login, /aleta/admin/akses-publik, /aleta/surat, detail surat dengan PDF, /aleta/patch-notes, /aleta/panduan, dan /aleta/masukan.",
      "Validasi juga /aleta/portal, /aleta/tugas?filter=urgent, /aleta/admin, /aleta/asisten-hakim, dan /aleta/admin/asisten-hakim.",
      "Uji input surat baru dengan deteksi AI dan pastikan Ringkasan Isi Inti Surat berisi maksud surat, bukan daftar metadata dokumen.",
      "Uji Asisten Hakim dalam mode wrapped dan mode direct untuk memastikan setiap AI sesuai kebijakan kantor.",
      "Uji Ringkasan Kerja dan Tugas Penting dari Portal, lalu buka Pusat Tugas untuk memastikan angka dan daftar berasal dari sumber yang sama.",
      "Untuk paket rilis berikutnya, gunakan scripts/aleta-make-update.sh 1.1.3 dan pasang dengan scripts/aleta-update.sh setelah backup.",
      "Jika update dilakukan manual lewat SSH, backup aplikasi server dulu lalu rebuild portal sampai build sukses sebelum menjalankan container baru.",
    ],
    knownLimitations: [
      "Aplikasi tidak membuat domain publik otomatis; URL publik baru bisa dibuka dari internet setelah DNS/proxy/tunnel/VPN benar-benar disiapkan.",
      "Akses dari jaringan luar harus diuji memakai perangkat atau jaringan yang berbeda dari server lokal.",
      "Beberapa website AI dapat menolak embedded iframe karena kebijakan keamanan situs mereka; gunakan toggle wrapped off bila itu terjadi.",
      "Aplikasi rencana seperti E-Kepegawaian, E-Keuangan, Manajemen Aset, Perpustakaan, dan Gateway Notifikasi masih placeholder dan belum dihitung sebagai aplikasi operasional penuh.",
      "Ringkasan AI tetap perlu pemeriksaan operator untuk dokumen dengan format tidak biasa atau hasil OCR yang kurang bersih.",
      "Viewer PDF tidak mengganti aplikasi PDF penuh; fokusnya tetap preview, unduh, cetak, dan telaah cepat di alur surat.",
      "Paket update source tetap tidak membawa file runtime server seperti PDF, upload logo, database, atau session WhatsApp.",
    ],
    details: [
      {
        title: "Panduan Singkat Setelah Update v1.1.3",
        items: [
          "Buka login dan pastikan teks SSO Single Sign On serta nomor Patch Notes v1.1.3 tampil.",
          "Buka Admin > Akses Publik, isi URL publik sesuai rencana server, lalu simpan.",
          "Buka Manajemen Surat, input surat uji dengan deteksi AI, dan cek Ringkasan Isi Inti Surat.",
          "Buka detail surat yang memiliki PDF, lalu cek Smart Preview, PDF Asli, Fit to Width, Unduh, dan Cetak.",
          "Buka Portal, cek Ringkasan Kerja dan Tugas Penting, lalu buka Pusat Tugas untuk membandingkan angka dan daftar.",
          "Buka Asisten Hakim, klik AI yang tersedia, lalu pastikan mode wrapped/embedded mengikuti pengaturan Super Admin.",
          "Buka Patch Notes, Panduan, dan Pusat Masukan untuk memastikan isi dokumentasi mengikuti v1.1.3.",
        ],
      },
      {
        title: "Masukan Prioritas Setelah v1.1.3",
        items: [
          "Laporkan jika URL publik yang dicatat di Admin tidak sesuai dengan alamat yang dipakai user.",
          "Laporkan jika ringkasan AI surat masih mengambil nomor, tanggal, atau metadata sebagai isi utama.",
          "Laporkan jika viewer PDF menyisakan ruang kosong besar, tombol tidak jelas, atau Fit to Width tidak nyaman dipakai.",
          "Laporkan jika angka Ringkasan Kerja, Tugas Penting, dan Pusat Tugas berbeda padahal sumber tugas sama.",
          "Laporkan jika Asisten Hakim wrapped tidak tampil, situs AI menolak iframe, atau toggle per AI tidak sesuai.",
          "Laporkan jika paket update ditolak server karena checksum atau manifest.",
          "Laporkan jika login tidak menampilkan nama pengadilan, teks SSO, versi Patch Notes, atau copyright dengan benar.",
          "Laporkan error build server lengkap dengan baris TypeScript atau route conflict agar patch berikutnya tepat sasaran.",
        ],
      },
    ],
  },
  {
    version: "1.1.2",
    title: "ALETA v1.1.2 - Akses Publik, Ringkasan AI, dan Viewer PDF",
    date: "2026-05-21",
    status: "Maintenance Update",
    summary:
      "Rilis v1.1.2 menjadi baseline sebelum pembaruan v1.1.3. Fokusnya adalah memperkenalkan menu Akses Publik, memperjelas login sebagai portal SSO aplikasi pengadilan, merapikan ringkasan AI surat, dan memperbaiki kenyamanan viewer PDF.",
    added: [
      "Menu Admin > Akses Publik ditambahkan untuk mencatat alamat publik, metode akses, status, dan catatan teknis aplikasi.",
      "Halaman login menampilkan nomor Patch Notes aktif agar operator mudah memastikan versi aplikasi.",
      "Panduan dan Pusat Masukan mulai diarahkan ke topik Akses Publik, login SSO, ringkasan AI surat, viewer PDF, dan paket update.",
    ],
    changed: [
      "Kalimat login disesuaikan menjadi SSO Single Sign On dengan nama pengadilan dari Identitas Instansi.",
      "Ringkasan AI surat diarahkan mengambil maksud dan tujuan surat, bukan metadata dokumen.",
      "Viewer PDF dirapikan dengan istilah yang lebih mudah dipahami dan tombol Unduh/Cetak yang lebih jelas.",
    ],
    fixed: [
      "Login, Patch Notes, dan Panduan memakai sumber versi aplikasi yang sama.",
      "Akses Publik disimpan melalui Pengaturan Panel tanpa membuka konfigurasi server ke frontend.",
      "Viewer PDF lebih stabil untuk preview, unduh, cetak, dan telaah cepat surat.",
    ],
    security: [
      "Akses Publik hanya menyimpan alamat dan catatan publik, bukan env, token, database, upload, PDF, atau session WhatsApp.",
      "Viewer PDF tetap mengikuti kontrol akses surat yang sudah berlaku.",
      "Panduan update tetap mengingatkan agar config dan runtime server tidak ikut dicopy dari lokal.",
    ],
    operationalNotes: [
      "v1.1.2 dipertahankan sebagai riwayat karena sebagian server sempat memakai label ini sebelum paket v1.1.3 dibuat.",
      "Untuk update terbaru setelah baseline ini, gunakan paket v1.1.3.",
    ],
    knownLimitations: [
      "Akses publik tetap membutuhkan pengaturan DNS, HTTPS, reverse proxy, tunnel, VPN, atau firewall di luar aplikasi.",
      "Beberapa situs eksternal tetap dapat menolak mode embedded karena kebijakan keamanan situs tersebut.",
    ],
  },
  {
    version: "1.1.1",
    title: "ALETA v1.1.1 - Perbaikan Surat, Logo Instansi, dan Paket Rilis",
    date: "2026-05-18",
    status: "Maintenance Update",
    summary:
      "Rilis v1.1.1 merangkum perbaikan dari sesi pemantapan setelah v1.1.0. Fokus utamanya adalah memastikan build server CentOS 7 lebih aman, hapus permanen surat benar-benar membersihkan data terkait, upload logo instansi langsung dipakai di seluruh aplikasi, daftar Manajemen Surat menampilkan tanggal upload secara jelas, serta Patch Notes, Panduan, dan Pusat Masukan selaras dengan perubahan terbaru.",
    added: [
      "Daftar Manajemen Surat kini memiliki filter Tanggal Upload Surat dengan tanggal mulai, tanggal sampai, reset, dan badge filter aktif.",
      "Tabel Manajemen Surat kini menampilkan kolom Tanggal Upload tersendiri sehingga operator dapat membedakan tanggal surat dengan tanggal data diunggah.",
      "Opsi urut baru ditambahkan untuk Tanggal upload terbaru dan Tanggal upload terlama.",
      "Logo instansi yang diunggah dari Identitas Instansi kini disajikan lewat route internal /api/public/institution/logo/[fileName].",
      "Panduan v1.1.1 ditambahkan untuk alur cek setelah update, file yang perlu dicopy, dan validasi halaman penting.",
      "Pusat Masukan diarahkan ke fokus laporan v1.1.1: hapus surat, logo instansi, tanggal upload, build server, paket rilis, dan deploy CentOS 7.",
    ],
    changed: [
      "Upload logo instansi sekarang langsung menyimpan Identitas Instansi dan memperbarui state aplikasi tanpa menunggu klik simpan kedua.",
      "Komponen logo ALETA memiliki fallback bila file logo gagal dimuat agar tampilan aplikasi tidak rusak.",
      "Form Identitas Instansi menampilkan proses unggah/simpan dengan loading ALETA, status proses, dan pesan selesai atau gagal.",
      "Daftar surat tetap memakai filter jenis surat yang sama untuk Semua Surat, Surat Masuk, dan Surat Keluar, tetapi tanggal upload sekarang dikirim ke API sebagai uploadedFrom dan uploadedTo.",
      "Script paket rilis diperketat agar source lama di src dan drizzle tidak tertinggal setelah update atau rollback.",
      "Panduan server diperjelas untuk CentOS 7 dan service Docker Compose portal, bukan CentOS 8.",
    ],
    fixed: [
      "Hapus permanen surat oleh Super Admin kini benar-benar menghapus surat beserta disposisi, status baca notifikasi, pengiriman WhatsApp, attachment, tag, dan relasi anak lain.",
      "File PDF internal ikut dicoba dihapus saat hard delete sehingga data surat tidak meninggalkan file yatim bila path masih berada di storage upload resmi.",
      "Gagal hapus surat kini menampilkan pesan error di frontend sehingga operator tidak mengira proses berhasil padahal ditolak server.",
      "Detail surat tidak lagi memblokir hard delete Super Admin hanya karena masih ada disposisi aktif.",
      "API pencarian surat /api/surat/search diperbaiki agar memakai actorUser dari session dan memanggil searchLettersArchiveInDb(db, actorUser, filters).",
      "Mismatch source server yang menyebabkan build TypeScript pada searchLettersArchiveInDb terdokumentasi sebagai patch wajib server.",
      "Paket update tidak lagi membawa folder data, file PDF, build cache, dan runtime upload yang tidak boleh ditimpa dari lokal.",
      "Rollback dan update paket membersihkan src dan drizzle sebelum restore/extract agar route lama tidak tertinggal dan memicu konflik build.",
    ],
    security: [
      "Pencarian surat kembali melewati actor user sehingga hasil tetap mengikuti hak akses pengguna yang sedang login.",
      "Hard delete surat tetap dibatasi untuk Super Admin dan dicatat ke Audit Trail dengan payload ringkas tanpa membuka isi file PDF.",
      "Logo instansi disimpan di storage upload internal dan disajikan lewat route publik terbatas untuk file logo, bukan membuka folder runtime secara bebas.",
      "Panduan deploy menegaskan file config dan runtime tidak boleh dicopy dari lokal ke server, termasuk .env, next.config.ts, Dockerfile, data, uploads, PDF, node_modules, dan session WhatsApp.",
      "Build server harus berhasil terlebih dahulu sebelum docker-compose up -d portal dijalankan agar image lama tidak dianggap update sukses.",
    ],
    operationalNotes: [
      "Untuk server CentOS 7, pasang patch di /var/www/html/aleta/manajemen_surat lalu jalankan cd /var/www/html/aleta && docker-compose build portal.",
      "Jika build sukses, lanjutkan docker-compose up -d portal dan docker-compose logs --tail=120 portal.",
      "Setelah update, validasi /aleta/login, /aleta/portal, /aleta/admin, /aleta/admin/aleta-bot, /aleta/admin/database, /aleta/admin/backup, /aleta/manajemen-surat, /aleta/surat, /aleta/patch-notes, /aleta/panduan, dan /aleta/masukan.",
      "Jika build gagal, jangan menjalankan up -d sebagai tanda update sukses karena Docker Compose akan tetap memakai image lama.",
      "Warning version is obsolete, git was not found, npm update notice, dan pesan mail root bukan penyebab utama build gagal.",
      "Untuk paket rilis berikutnya, gunakan scripts/aleta-make-update.sh 1.1.1 dan pasang dengan scripts/aleta-update.sh setelah backup.",
    ],
    knownLimitations: [
      "Admin Database tetap bukan pengganti pgAdmin penuh; edit massal dan perubahan skema masih harus dilakukan lewat prosedur database yang terkontrol.",
      "Audit Trail masih perlu diperluas bertahap untuk seluruh aksi lama di luar perubahan yang sudah diperbaiki pada rilis ini.",
      "Staging server tetap direkomendasikan sebelum update besar berikutnya, terutama jika menyentuh database, dependency, atau runtime ALETA Bot.",
      "Jika server memiliki file source lama hasil copy manual, gunakan paket update atau purge source terkontrol agar route lama tidak tertinggal.",
      "Folder upload logo dan PDF tetap harus dibackup dari server; paket source tidak membawa file runtime tersebut.",
    ],
    details: [
      {
        title: "Panduan Singkat Setelah Update v1.1.1",
        items: [
          "Buka Manajemen Surat dan pastikan tabel menampilkan kolom Tanggal Upload.",
          "Uji filter Tanggal Upload untuk Semua Surat, Surat Masuk, dan Surat Keluar.",
          "Upload logo baru di Identitas Instansi, tunggu status selesai, lalu cek logo pada sidebar, login, dan footer.",
          "Sebagai Super Admin, uji hapus permanen pada data uji dan pastikan data hilang dari daftar aktif.",
          "Buka Patch Notes, Panduan, dan Pusat Masukan untuk memastikan versi terbaca sebagai v1.1.1.",
        ],
      },
      {
        title: "Masukan Prioritas Setelah v1.1.1",
        items: [
          "Laporkan jika tanggal upload berbeda dari waktu data dibuat di server.",
          "Laporkan jika logo baru sudah tersimpan tetapi belum berubah di sidebar, login, atau footer.",
          "Laporkan jika hapus permanen surat masih menyisakan data, disposisi, attachment, atau file PDF.",
          "Laporkan error build server lengkap dengan baris error TypeScript atau route conflict.",
          "Laporkan jika paket update membawa file runtime yang seharusnya tidak ikut dicopy.",
        ],
      },
    ],
  },
  {
    version: "1.1.0",
    title: "ALETA v1.1.0 - Penyempurnaan UI/UX, Admin, dan Branding Instansi",
    date: "2026-05-18",
    status: "Stable Update",
    summary:
      "Rilis ini menyempurnakan pengalaman harian ALETA setelah v1.0.0 Stable. Fokus utamanya adalah merapikan tampilan portal, login, header, sidebar, footer, admin database, backup sistem, loading proses, pengaturan panel, serta dokumentasi update agar aplikasi lebih nyaman dipakai di layar besar, tablet, dan handphone.",
    added: [
      "Halaman login kini menampilkan nama pengadilan dari Identitas Instansi; jika belum ada data, fallback tetap Pengadilan Digital.",
      "Endpoint publik aman untuk branding login ditambahkan, hanya membuka nama pengadilan, nama pendek, dan logo instansi.",
      "Background login diganti ke nuansa gedung peradilan/Mahkamah Agung dengan warna gelap biru yang selaras dengan tema ALETA.",
      "Tiga nilai layanan pada login disesuaikan dengan asas peradilan: Sederhana, Cepat, dan Biaya Ringan.",
      "Mode loading global ditambahkan untuk submit, perubahan data, dan perpindahan halaman agar user tahu proses sedang berjalan.",
      "Menu Pengaturan Panel ditambahkan di Admin sebagai tempat pengaturan tampilan panel, termasuk mode footer dan visibilitas card Portal.",
      "Admin kini memiliki menu Backup Sistem untuk backup database dan backup source aplikasi.",
      "Admin Database PostgreSQL ditambahkan untuk melihat tabel database asli, menjalankan SELECT terbatas, membuka data tabel, pagination, scroll horizontal, dan edit baris berbasis primary key.",
      "Footer kini memakai kontak dan kanal digital dari Identitas Instansi, termasuk alamat Maps, WhatsApp chat, email compose, website, Instagram, Facebook, dan YouTube.",
      "Identitas Instansi kini memiliki isian lokasi Google Maps untuk menjadi acuan alamat footer ketika diklik.",
    ],
    changed: [
      "Header global dibuat lebih ringkas dengan menghapus pengulangan breadcrumb/judul yang membuat halaman terasa ramai.",
      "Portal utama memakai judul Menu Kerja dan copy yang lebih pendek agar tidak terlalu sering mengulang ALETA.",
      "Intro halaman dibuat lebih compact sehingga halaman seperti Manajemen Surat, Patch Notes, Panduan, dan Masukan terasa lebih ringan.",
      "Sidebar admin dibuat lebih konsisten, compact, mudah dicari, dan gaya aktifnya disamakan di seluruh halaman yang memakai sidebar.",
      "Footer disusun ulang agar Kontak Utama lebih lebar dari Kanal Digital dan link digital bisa diklik sesuai tujuan.",
      "Login light mode diperbaiki agar tetap modern, tidak silau, dan berbeda jelas dari dark mode.",
      "Default tema aplikasi diarahkan ke dark mode agar nyaman dipakai lama di layar kantor.",
      "Card status dan card admin diberi jarak atas lebih aman agar ikon/judul tidak menempel ke garis border.",
      "Pusat Masukan, Panduan, dan Patch Notes diarahkan ke rilis v1.1.0 agar user dan admin membaca dokumen yang sesuai versi berjalan.",
    ],
    fixed: [
      "Tampilan card database admin dirapikan agar daftar tabel dapat discroll vertikal, tabel data tidak melebar keluar layout, dan pagination jelas.",
      "Edit database tidak lagi memakai textarea JSON mentah; field ditampilkan seperti form edit SQL sederhana agar lebih mudah dipahami.",
      "Data database untuk Super Admin tidak lagi dianonimkan di tampilan Admin Database, tetapi kolom sensitif tetap perlu diawasi saat digunakan.",
      "Menu Backup Sistem dipastikan muncul di sidebar admin.",
      "Logo dan judul pada card Admin Hub dirapikan agar tidak menempel ke border atas.",
      "Status Data di Admin Hub diberi padding atas agar nama pengadilan tidak menempel ke garis card.",
      "Ikon media sosial footer diperbaiki agar Instagram, Facebook, YouTube, dan Website memakai ikon yang sesuai.",
      "Login tetap menyimpan hanya identitas akun ketika Ingat akun saya dicentang, bukan password.",
      "Header dan copy halaman yang terlalu ramai diringkas tanpa menghilangkan fungsi search, notifikasi, profil, dan aksi utama.",
    ],
    security: [
      "Endpoint branding login hanya mengembalikan data publik instansi, bukan konfigurasi penuh, token, akun, atau data sensitif.",
      "Admin Database hanya tersedia untuk Super Admin dan edit baris tetap dikontrol lewat primary key serta dicatat melalui Audit Trail.",
      "Query bebas Admin Database tetap dibatasi untuk SELECT/WITH agar tidak menjadi jalur perubahan data massal.",
      "Kolom rahasia seperti password, token, API key, session, OTP, atau hash tetap perlu diperlakukan sebagai data sensitif saat membuka Admin Database.",
      "Backup Sistem ditujukan untuk admin teknis; file hasil backup tetap harus disimpan di lokasi aman dan tidak dibagikan bebas.",
      "Pengaturan panel hanya mengubah tampilan, bukan membuka hak akses fitur yang tidak diberikan role.",
    ],
    operationalNotes: [
      "Setelah copy patch ini ke server, rebuild dan restart aplikasi agar perubahan UI, route API publik, dan panel admin aktif.",
      "Jika server tidak bisa mengambil background eksternal login, simpan gambar gedung pengadilan sebagai asset lokal di public lalu arahkan login ke file lokal tersebut.",
      "Menu Admin Database membaca database asli PostgreSQL; gunakan hati-hati dan hindari edit langsung bila belum yakin dampaknya.",
      "Backup database dan aplikasi tetap sebaiknya dilakukan sebelum update besar atau sebelum edit langsung dari Admin Database.",
      "Untuk update manual ke server, copy file source yang berubah saja dan jangan copy config lokal, build cache, node_modules, database, PDF, upload, atau session WhatsApp.",
      "Untuk rilis paket, gunakan versi 1.1.0 sebagai nama paket agar riwayat update server tidak bercampur dengan baseline v1.0.0.",
    ],
    knownLimitations: [
      "Background login masih memakai URL eksternal; agar sepenuhnya mandiri di jaringan kantor, gambar perlu disimpan sebagai asset lokal internal.",
      "Admin Database bukan pengganti pgAdmin/SQLyog penuh; fitur sengaja dibatasi untuk inspeksi dan edit baris tertentu.",
      "Backup Sistem dari UI tetap perlu dipadukan dengan prosedur backup server agar database, PDF, upload, dan session WhatsApp aman.",
      "Staging server tetap direkomendasikan sebelum rilis berikutnya, terutama jika menyentuh database atau runtime ALETA Bot.",
      "Sebagian audit menyeluruh masih perlu diperluas bertahap untuk seluruh endpoint operasional lama.",
    ],
    details: [
      {
        title: "Panduan Singkat Setelah Update v1.1.0",
        items: [
          "Buka /aleta/login dan pastikan nama pengadilan tampil sesuai Identitas Instansi.",
          "Login sebagai Super Admin dan cek Portal, Manajemen Surat, Admin, Backup Sistem, Database PostgreSQL, Patch Notes, Panduan, dan Pusat Masukan.",
          "Buka Identitas Instansi dan pastikan logo, alamat, Maps, WhatsApp, email, website, dan media sosial sudah benar.",
          "Buka Pengaturan Panel bila ingin menyembunyikan card tertentu di Portal.",
          "Buka Admin Database hanya untuk inspeksi atau edit terbatas yang benar-benar diperlukan.",
        ],
      },
      {
        title: "Masukan Prioritas Setelah v1.1.0",
        items: [
          "Simpan background login sebagai file publik internal agar aplikasi tidak bergantung pada internet eksternal.",
          "Siapkan staging server sebelum perubahan database atau ALETA Bot berikutnya.",
          "Buat SOP backup harian database, PDF, upload logo, dan session WhatsApp.",
          "Perluas Audit Trail untuk endpoint lama yang belum dicatat penuh.",
          "Lanjutkan hardening dependency ALETA Bot setelah staging siap.",
        ],
      },
    ],
  },
  {
    version: "1.0.0",
    title: "ALETA v1.0.0 Stable - Rilis Stabil Portal dan ALETA Bot",
    date: "2026-05-16",
    status: "Stable",
    summary:
      "Rilis stabil pertama ALETA setelah rangkaian beta internal. Fokus rilis ini adalah membuat Portal, Manajemen Surat, ALETA Bot, laporan WhatsApp, identitas instansi, dan alur lupa password cukup jelas untuk dipakai harian, sambil tetap menjaga batas aman pengiriman WhatsApp dan deployment server.",
    added: [
      "ALETA Bot kini memakai istilah yang lebih mudah dipahami: Sumber Data, Isi Pesan, Aturan Jawaban, Simulasi, Mesin Bot, dan Pengaturan.",
      "Alur notifikasi WhatsApp dibuat lebih sederhana: pilih tujuan, pilih jadwal atau pemicu, pilih isi pesan, preview penerima, simulasi, lalu aktifkan.",
      "Aturan jawaban WhatsApp dapat disusun dari contoh pertanyaan, jawaban yang diinginkan, uji coba, lalu disimpan sebagai draft atau diaktifkan.",
      "Sumber Data SQL dapat dipakai bersama untuk notifikasi terjadwal dan jawaban query WhatsApp.",
      "Antrian online dibuat lebih dinamis dengan bantuan AI dan deteksi nomor WhatsApp pihak berdasarkan data telepon, termasuk dukungan role pihak seperti penggugat, tergugat, kuasa, dan intervensi bila datanya tersedia.",
      "Laporan WhatsApp ALETA Bot tersedia dengan filter rentang data, status, aplikasi, fitur, statistik, Data Terbaru, sort, filter tabel, dan export Excel rapi dengan filter Excel.",
      "Pengiriman pesan Manajemen Surat masuk ke ekosistem ALETA Bot, termasuk template pesan yang bisa diedit dan pemisahan laporan antara Notifikasi Perkara, Manajemen Surat, dan aplikasi lain ke depan.",
      "Identitas Instansi kini dapat mengatur logo instansi dari menu admin; logo ini dipakai di login, sidebar, footer, dan preview identitas.",
      "Upload logo instansi kini disimpan sebagai file publik internal di /uploads/institution-logo/ sehingga database hanya menyimpan alamat gambar.",
      "Logo lama Mahkamah Agung tetap dipakai sebagai ikon tab browser agar tab aplikasi mudah dikenali.",
      "Alur lupa password melalui OTP WhatsApp dan Bantuan Admin sudah diperiksa dan didokumentasikan.",
      "Monitoring antrean WhatsApp ditambahkan dari sisi database portal agar admin tetap melihat pending, diproses, terkirim, gagal, dead letter, dan pesan tertahan walau runtime bot sedang mati.",
    ],
    changed: [
      "Bahasa aplikasi disederhanakan agar lebih mudah dipahami user umum; istilah teknis tetap dipertahankan hanya untuk area Admin dan Super Admin yang memang membutuhkannya.",
      "Tampilan ALETA Bot dibuat lebih nyaman pada layar besar, tablet, dan handphone dengan card penting tetap terlihat dan card pendukung lebih hemat ruang.",
      "Card laporan ALETA Bot dibuat bisa diklik untuk membantu admin langsung memfilter data berdasarkan status atau kelompok yang dipilih.",
      "Data Terbaru pada laporan WhatsApp kini punya pencarian, filter, sort, dan tombol Cetak Excel Data Terbaru.",
      "Patch Notes dan Panduan berpindah dari fase beta ke rilis stabil 1.0.0.",
      "Update Manager tetap dipertahankan sebagai jalur deployment yang lebih rapi dibanding copy banyak file satu per satu.",
    ],
    fixed: [
      "Jarak judul card ALETA Bot pada mode layar penuh dirapikan agar teks seperti Aturan Aktif, AI Pengenal, Pengiriman Bot, Notifikasi, dan Admin tidak menempel ke garis border.",
      "Tombol-tombol laporan ALETA Bot diperiksa ulang agar aksi muat data, filter, sort, klik card, dan export Excel berjalan sesuai tujuan.",
      "Excel laporan WhatsApp dibuat membawa sheet ringkasan, pesan WhatsApp, statistik per status, per aplikasi, per fitur, error, tren harian, dan log sistem.",
      "Excel Data Terbaru dibuat terpisah agar admin bisa mengambil cuplikan data yang sedang terlihat di tabel tanpa harus export seluruh laporan.",
      "Jika WhatsApp gateway belum siap, permintaan OTP lupa password tidak membuat kode OTP di database sehingga tidak ada OTP yang tersimpan tanpa bisa dikirim.",
      "OTP lupa password baru kini disimpan sebagai hash, bukan angka OTP asli.",
      "Saat OTP berhasil dipakai untuk reset password, data OTP dihapus dari tabel verifications.",
      "Endpoint upload, extract, dan baca PDF diperkuat dengan login wajib, validasi PDF asli, pembatasan ukuran, blokir URL PDF eksternal, dan cek hak akses surat.",
      "Search arsip dan statistik SLA/KPI kini mengikuti hak akses user agar data global tidak terbuka ke user yang tidak berwenang.",
    ],
    security: [
      "OTP lupa password berlaku 10 menit, dibuat memakai generator crypto, disimpan sebagai hash, dibersihkan jika pengiriman WhatsApp gagal, dan dihapus setelah reset berhasil.",
      "Endpoint lupa password tidak mengirim OTP jika WhatsApp belum siap; user diarahkan memakai jalur Bantuan Admin.",
      "PDF surat hanya dibaca dari penyimpanan internal ALETA dan dicek terhadap daftar surat yang dapat diakses user login.",
      "Search arsip dan statistik surat dibatasi berdasarkan hak akses, bukan selalu membaca seluruh data kantor.",
      "Pengiriman WhatsApp berisiko tetap memakai persetujuan, simulasi, dan pemeriksaan penerima sebelum aktif.",
      "Laporan WhatsApp memisahkan data per aplikasi agar admin lebih mudah memeriksa sumber pengiriman tanpa mencampur semua fungsi.",
      "Paket update dan arahan copy server tetap tidak membawa secret, database, file PDF, session WhatsApp, node_modules, build cache .next, atau file konfigurasi lokal.",
    ],
    operationalNotes: [
      "Setelah patch ini dicopy ke server, rebuild dan restart aplikasi agar perubahan frontend, API, dan migration database aktif.",
      "Migration database menambahkan kolom institution_identity.logo_url untuk logo instansi.",
      "Untuk logo instansi, upload file PNG, JPG, WebP, atau GIF maksimal 2 MB; database hanya menyimpan URL publik internal.",
      "Untuk OTP lupa password di server, pastikan WhatsApp gateway ALETA Bot berstatus terhubung sebelum meminta OTP.",
      "Untuk laporan WhatsApp, data Excel akan kosong bila memang belum ada log WhatsApp pada rentang filter yang dipilih.",
      "Karena server produksi sedang mati dan masih 0.1.0-beta.9, siapkan paket lokal v1.0.0 terlebih dahulu lalu pasang saat server hidup atau setelah staging siap.",
      "Script paket rilis tersedia di scripts/aleta-make-update.sh, scripts/aleta-update.sh, dan scripts/aleta-rollback.sh; default paket tidak membawa config lokal/server.",
      "Untuk copy manual ke server, copy hanya file source yang berubah dan jangan copy file config lokal.",
    ],
    knownLimitations: [
      "Export Excel laporan bergantung pada log yang sudah tercatat; data lama yang belum pernah masuk log tidak bisa muncul otomatis.",
      "Update Manager belum mengeksekusi patch langsung dari browser karena eksekusi file server tetap harus lewat SSH demi keamanan.",
      "Staging server masih perlu disiapkan sebagai mesin terpisah sebelum rilis besar berikutnya.",
      "Dependency ALETA Bot belum di-upgrade otomatis pada patch ini agar session WhatsApp dan package server tidak berubah tanpa uji staging.",
      "Lint global masih membawa beberapa peringatan lama dari file yang tidak terkait rilis ini; file yang disentuh pada perubahan stabil sudah dicek terpisah.",
    ],
    details: [
      {
        title: "Panduan Singkat Notifikasi WhatsApp",
        items: [
          "Buat atau pilih Sumber Data SQL.",
          "Pilih tujuan penerima: pegawai, role, nama tertentu, atau pihak perkara sesuai data yang tersedia.",
          "Pilih jadwal atau pemicu pengiriman.",
          "Pilih Isi Pesan yang akan dikirim.",
          "Preview penerima agar tidak salah kirim.",
          "Jalankan Simulasi sebelum aktif.",
          "Aktifkan setelah hasil simulasi benar.",
        ],
      },
      {
        title: "Panduan Singkat Query atau Pertanyaan WhatsApp",
        items: [
          "Buat Sumber Data SQL dan beri nama yang mudah dipahami.",
          "Masukkan contoh pertanyaan user, misalnya tentang biaya perkara, relaas, atau antrian online.",
          "Tentukan jawaban natural yang boleh dikirim oleh bot.",
          "Uji coba jawaban dari panel ALETA Bot.",
          "Simpan sebagai draft bila belum siap atau aktifkan bila sudah disetujui.",
          "Pertanyaan yang menyentuh data internal pegawai tetap dibatasi untuk nomor WhatsApp pegawai terdaftar.",
        ],
      },
      {
        title: "Panduan Singkat Laporan WhatsApp",
        items: [
          "Buka tab Laporan di Admin ALETA Bot.",
          "Pilih rentang data, status, aplikasi, dan fitur.",
          "Klik card statistik untuk memfilter data lebih cepat.",
          "Gunakan sort dan filter tabel Data Terbaru untuk melihat data yang dibutuhkan.",
          "Klik Cetak Excel untuk laporan lengkap atau Cetak Excel Data Terbaru untuk data tabel yang sedang difilter.",
        ],
      },
      {
        title: "Masukan Prioritas Setelah v1.0.0 Stable",
        items: [
          "Siapkan server staging agar patch besar dapat diuji sebelum masuk server utama.",
          "Buat paket update resmi untuk setiap rilis berikutnya, bukan copy manual banyak file.",
          "Tambahkan alarm otomatis untuk antrean WhatsApp bila gagal meningkat, antrean tertahan, atau WhatsApp terputus.",
          "Lanjutkan audit dependency ALETA Bot di staging sebelum update library WhatsApp/scheduler/database.",
          "Rencanakan migrasi password user dari SHA-256 biasa ke Argon2id atau bcrypt dengan mode kompatibel.",
        ],
      },
    ],
  },
  {
    version: "0.1.0-beta.9",
    title: "ALETA 0.1.0-beta.9 - Update Manager dan Rollback Server",
    date: "2026-05-15",
    status: "Patch Operasional Update",
    summary:
      "Rilis ini menambahkan jalur update resmi untuk server Docker: paket update tunggal, manifest notifikasi versi baru, halaman Admin Pembaruan Sistem, backup otomatis sebelum update, serta rollback/downgrade ke versi sebelumnya. Tujuannya agar update berikutnya tidak perlu lagi copy file satu per satu lewat FileZilla.",
    added: [
      "Halaman Admin baru Pembaruan Sistem di /admin/pembaruan-sistem untuk melihat versi aktif, manifest update, perintah server, dan riwayat update.",
      "API status update /api/system/update-status yang hanya dapat dibaca Admin atau Super Admin.",
      "Indikator update tersedia di header admin ketika manifest versi baru terdeteksi.",
      "Script scripts/aleta-make-update.sh untuk membuat paket update tunggal aleta-update-<versi>.tar.gz.",
      "Script scripts/aleta-update.sh untuk menerapkan paket update, membuat backup otomatis, rebuild container, dan mencatat riwayat.",
      "Script scripts/aleta-rollback.sh untuk rollback/downgrade dari backup terakhir atau backup tertentu.",
      "Dokumentasi docs/ALETA_UPDATE_SYSTEM.md untuk metode update, manifest, rollback, dan downgrade.",
      "Panduan penggunaan baru untuk Update Manager, paket update, rollback, dan rekomendasi lanjutan setelah rilis stabilitas PDF/ALETA Bot.",
    ],
    changed: [
      "Metode update diarahkan dari copy banyak file manual menjadi satu paket update terkontrol.",
      "Admin dashboard kini menampilkan card Pembaruan Sistem agar status versi dan update mudah ditemukan.",
      "Footer, Patch Notes, dan Panduan sekarang menunjuk ke versi 0.1.0-beta.9.",
      "Navigasi admin mendapat menu Pembaruan Sistem untuk Admin dan Super Admin.",
      "Manifest update dapat dibaca dari file lokal /app/reports/aleta-update-latest.json atau dari URL manifest internal jika disiapkan.",
    ],
    fixed: [
      "Risiko lupa copy salah satu file patch dikurangi dengan paket update tunggal.",
      "Rollback tidak lagi bergantung pada ingatan manual file mana saja yang berubah karena backup kode dibuat otomatis sebelum update.",
      "Riwayat update dicatat di reports/updates/history.jsonl agar admin dapat melihat versi yang pernah diterapkan.",
      "State versi server dicatat di reports/aleta-update-state.json agar status tidak hilang saat container dibuild ulang.",
    ],
    security: [
      "Update tidak dieksekusi langsung dari browser; aplikasi hanya menampilkan status dan perintah agar portal web tidak memiliki hak menimpa file server.",
      "Paket update tidak membawa .env.production, database PostgreSQL, file PDF surat, session WhatsApp, node_modules, atau build cache .next.",
      "Endpoint status update dibatasi untuk Admin dan Super Admin.",
      "Checksum SHA256 dibuat untuk paket update agar integritas file dapat diverifikasi sebelum diterapkan.",
      "Rekomendasi keamanan lanjutan dicatat: amankan endpoint upload/extract PDF, batasi remote fetch PDF, kuatkan password hashing, dan audit dependency aleta_bot.",
    ],
    operationalNotes: [
      "Untuk pertama kali, file fitur Update Manager tetap perlu dicopy ke server dan portal dibuild ulang.",
      "Setelah Update Manager aktif, update berikutnya dapat dikemas menjadi satu file .tar.gz lalu diterapkan lewat SSH.",
      "Gunakan bash scripts/aleta-make-update.sh <versi> untuk membuat paket update dari folder aplikasi yang sudah lengkap.",
      "Gunakan bash scripts/aleta-update.sh /path/aleta-update-<versi>.tar.gz untuk menerapkan update di server.",
      "Gunakan bash scripts/aleta-rollback.sh hanya saat perlu kembali ke backup terakhir.",
      "Jalankan update dari SSH di /var/www/html/aleta, bukan dari browser.",
    ],
    knownLimitations: [
      "Update Manager belum menjalankan patch langsung dari UI karena itu sengaja dibatasi demi keamanan server.",
      "Migrasi database otomatis hanya dijalankan jika ALETA_RUN_DB_MIGRATIONS=1 saat script update dieksekusi.",
      "Script Bash perlu diuji langsung di server Linux/CentOS karena laptop pengembangan Windows tidak memiliki distro WSL untuk bash -n.",
      "Hardening keamanan endpoint dan dependency audit belum dimasukkan sebagai perbaikan final di rilis ini; masuk prioritas rilis berikutnya.",
    ],
    details: [
      {
        title: "Alur Update Baru",
        items: [
          "Developer atau admin teknis membuat paket update dengan scripts/aleta-make-update.sh.",
          "Paket update dan file .sha256 diupload ke server.",
          "Admin menjalankan scripts/aleta-update.sh lewat SSH.",
          "Script membuat backup otomatis sebelum file aplikasi ditimpa.",
          "Portal dan aleta_bot dibuild ulang dan dijalankan kembali.",
          "Status versi dan riwayat update muncul di halaman Pembaruan Sistem.",
        ],
      },
      {
        title: "Rollback dan Downgrade",
        items: [
          "Rollback cepat memakai backup terakhir dari folder aleta-backups.",
          "Rollback tertentu dapat memilih file backup secara eksplisit.",
          "Downgrade juga dapat dilakukan dengan menerapkan paket versi lama.",
          "State rollback dicatat agar admin melihat riwayat versi yang dipulihkan.",
        ],
      },
      {
        title: "Masukan Lanjutan Setelah beta.9",
        items: [
          "Lakukan hardening keamanan sebelum membuka akses aplikasi lebih luas dari jaringan internal.",
          "Prioritaskan auth guard pada upload/extract PDF dan API statistik/search.",
          "Batasi endpoint PDF agar tidak mengambil URL eksternal bebas.",
          "Migrasikan password dari SHA-256 biasa ke Argon2id atau bcrypt dengan mode kompatibel.",
          "Upgrade dependency aleta_bot yang masih memiliki vulnerability tinggi/kritis.",
          "Setiap rilis berikutnya sebaiknya selalu dibuat sebagai paket update dan punya rollback plan.",
        ],
      },
    ],
  },
  {
    version: "0.1.0-beta.8",
    title: "ALETA 0.1.0-beta.8 - Stabilitas PDF, Session, dan ALETA Bot",
    date: "2026-05-14",
    status: "Patch Stabilitas Server",
    summary:
      "Rilis ini memusatkan perbaikan pada fitur utama yang dipakai harian: preview dan download PDF surat, penyimpanan lampiran di Docker, refresh daftar setelah input surat, URL /aleta yang konsisten, session login 1 jam, serta pengaturan ALETA Bot yang langsung tersimpan dan terlihat berubah.",
    added: [
      "Catatan operasional baru untuk server Docker CentOS 7 dengan pemisahan database di folder aleta dan file PDF di folder aleta-pdf.",
      "Panduan penggunaan baru untuk upload, preview, download, dan pengecekan lampiran PDF pada Surat Masuk dan Surat Keluar.",
      "Panduan ALETA Bot untuk mode sederhana, aktivasi bot, nomor WhatsApp administrator, dan deteksi nomor WhatsApp pegawai.",
      "Pemberitahuan berbentuk card setelah pengaturan berhasil disimpan, disesuaikan dengan konteks perubahan.",
    ],
    changed: [
      "Akses aplikasi dipusatkan di /aleta: user belum login diarahkan ke /aleta/login, sedangkan user yang sudah login diarahkan ke /aleta/portal.",
      "Session login diperpanjang menjadi 1 jam agar user tidak mudah keluar sendiri saat bekerja.",
      "Pengaturan ALETA Bot dibuat lebih seamless: setelah simpan, data runtime dan snapshot dimuat ulang supaya UI langsung menampilkan status terbaru.",
      "Mode sederhana ALETA Bot kini tetap menyediakan kontrol penting, termasuk aktif bot dan nomor WhatsApp administrator.",
      "Card status di pengaturan ALETA Bot sekarang membuka bagian pengaturan yang sesuai, bukan hanya menjadi informasi pasif.",
    ],
    fixed: [
      "Preview PDF di Manajemen Surat diperbaiki agar file yang tersimpan di folder aleta-pdf tetap terbaca oleh PDF viewer dan Smart View.",
      "Tombol Unduh PDF diperbaiki agar mengambil file dari resolver server yang sama dengan preview.",
      "Input Surat Masuk dan Surat Keluar diperbaiki agar daftar surat refresh setelah submit dan file baru langsung muncul di daftar terkait.",
      "Upload PDF tidak bergantung pada path frontend mentah; metadata disimpan di database dan file fisik tetap berada di folder PDF Docker.",
      "Aktivasi aktif bot di ALETA Bot diperbaiki agar toggle tersimpan ke database dan status tidak kembali menjadi tidak aktif.",
      "Nomor WhatsApp administrator diperbaiki agar input tersimpan di tabel pengaturan ALETA Bot dan dapat dikosongkan bila diperlukan.",
      "Deteksi nomor WhatsApp pegawai diperbaiki agar menu tidak lagi 404 dan status berubah hijau saat seluruh pegawai aktif sudah memiliki nomor valid.",
      "Tombol kosong, anchor kosong, dan tombol native tanpa tipe eksplisit diperiksa agar tidak hanya menjadi pajangan atau memicu submit form yang tidak diinginkan.",
    ],
    security: [
      "Session tetap dibatasi 1 jam, bukan dibuat permanen, agar lebih nyaman tanpa mengorbankan keamanan dasar.",
      "Broadcast, notifikasi pihak luar, kirim ulang massal, dan pengiriman berisiko tetap wajib persetujuan.",
      "Nomor WhatsApp dan data sensitif tetap tidak perlu ditampilkan penuh di area monitoring umum.",
      "Resolver PDF hanya membaca file dari lokasi upload yang diizinkan agar path Docker tetap terkendali.",
    ],
    operationalNotes: [
      "Untuk Docker, database tetap berada di folder aleta, sedangkan file PDF berada di folder aleta-pdf dan dimount ke /app/uploads/pdf.",
      "Pastikan env ALETA_PDF_UPLOAD_DIR mengarah ke /app/uploads/pdf pada container aplikasi.",
      "Setelah copy patch ke server, rebuild aplikasi dan restart container manajemen_surat agar route, session, dan static/basePath terbaru aktif.",
      "Jika preview PDF masih kosong setelah deploy, cek isi folder aleta-pdf, permission file, dan nilai path PDF yang tersimpan di database.",
      "Setelah mengubah pengaturan ALETA Bot, gunakan card pemberitahuan sukses sebagai indikator awal lalu cek ulang status di dashboard runtime.",
    ],
    knownLimitations: [
      "Patch ini tidak mengubah aturan wajib persetujuan untuk broadcast dan pengiriman WhatsApp berisiko.",
      "File PDF lama yang path database-nya salah total mungkin perlu dikoreksi datanya agar dapat ditemukan ulang oleh resolver.",
      "CentOS 7 tetap memerlukan versi Docker/Compose yang kompatibel dengan image Node dan Chromium yang dipakai aplikasi.",
    ],
    details: [
      {
        title: "Manajemen Surat dan PDF",
        items: [
          "Surat Masuk dan Surat Keluar memakai alur upload yang menyimpan metadata file di database.",
          "File PDF fisik tetap berada di folder aleta-pdf pada server dan dibaca ulang lewat route upload PDF aplikasi.",
          "Preview, Smart View, dan Download memakai resolver path yang sama agar alamat database dan folder Docker tidak berbeda arah.",
          "Setelah submit surat, daftar dimuat ulang supaya surat dan lampiran baru langsung terlihat.",
        ],
      },
      {
        title: "Login dan URL",
        items: [
          "Alamat publik utama tetap /aleta.",
          "Belum login diarahkan ke /aleta/login.",
          "Sudah login diarahkan ke /aleta/portal.",
          "Session login dibuat 1 jam agar kerja input surat dan pengaturan tidak mudah terputus.",
        ],
      },
      {
        title: "ALETA Bot",
        items: [
          "Toggle Bot aktif tersimpan ke database.",
          "Mode sederhana punya kontrol aktif bot.",
          "Nomor WhatsApp administrator dapat diinput dan disimpan.",
          "Setiap simpan pengaturan menampilkan card berhasil dan memuat ulang data terbaru.",
          "Card status membuka pengaturan yang sesuai.",
        ],
      },
      {
        title: "Nomor WhatsApp Pegawai",
        items: [
          "Menu deteksi nomor pegawai membuka Mapping User/Jabatan tanpa 404.",
          "Status kesiapan nomor menjadi hijau jika semua pegawai aktif memiliki nomor WhatsApp valid.",
          "Status kuning hanya dipakai bila masih ada pegawai aktif yang belum lengkap atau perlu koreksi.",
        ],
      },
      {
        title: "Validasi Lokal",
        items: [
          "Typecheck, build, dan test suite sudah pernah dijalankan pada patch fungsi utama sebelum dokumentasi ini dibuat.",
          "Test tambahan mencakup resolver PDF, session auth, root redirect, tombol UI, pengaturan ALETA Bot, dan deteksi nomor WhatsApp pegawai.",
        ],
      },
    ],
  },
  {
    version: "0.1.0-beta.7",
    title: "ALETA 0.1.0-beta.7 - Pengiriman WhatsApp Otomatis Aktif dengan Pengamanan",
    date: "2026-05-03",
    status: "Aktif dengan Pengamanan",
    summary:
      "Rilis ini menetapkan status operasional terbaru: pengiriman WhatsApp otomatis sudah aktif dengan pengamanan. Uji terbatas berhasil, pemeriksaan keamanan lulus, dan operator tetap wajib memantau Antrean Pesan, Pesan Gagal, Persetujuan, serta Jam Aman Pengiriman.",
    added: [
      "Status resmi baru: Pengiriman WhatsApp Otomatis Aktif dengan Pengamanan.",
      "Catatan operator yang menjelaskan bahwa uji terbatas sudah berhasil dan pengiriman otomatis dapat berjalan sesuai aturan keamanan.",
      "Panduan monitoring hari pertama dengan bahasa yang lebih mudah dipahami admin.",
      "Penjelasan mode aman bila terjadi gangguan pada WhatsApp, Antrean Pesan, atau Pesan Gagal.",
    ],
    changed: [
      "Narasi status WhatsApp diperbarui dari tahap kesiapan menjadi aktif operasional dengan pengamanan.",
      "Panduan pengguna menjelaskan bahwa user tidak perlu scan QR atau menghubungkan WhatsApp sendiri.",
      "Panduan admin menekankan pemantauan WhatsApp Gateway, Pemroses Pesan, Antrean Pesan, Pesan Gagal, Persetujuan, Jam Aman Pengiriman, dan batas pengiriman.",
      "Runbook operator diselaraskan dengan kondisi production aktif, bukan lagi tahap kesiapan awal.",
    ],
    fixed: [
      "Narasi lama dari tahap kesiapan awal sudah diperbaiki agar sesuai runtime aktual.",
      "Status operasional kini konsisten: WhatsApp terhubung, Pemroses Pesan aktif, Antrean Pesan sehat, Pesan Gagal aktif 0, dan Persetujuan tertunda 0.",
      "Istilah teknis di area pengguna diganti dengan padanan yang lebih mudah dipahami, seperti Pengiriman WhatsApp otomatis, Pengamanan pengiriman, Batas pengiriman, dan Wajib persetujuan.",
    ],
    security: [
      "Pengiriman otomatis aktif dengan pengamanan untuk mencegah salah kirim, kirim ganda, dan pengiriman massal tanpa persetujuan.",
      "Broadcast tetap wajib persetujuan.",
      "Notifikasi pihak luar tetap wajib persetujuan.",
      "Kirim ulang massal tetap wajib persetujuan.",
      "Batas pengiriman aktif: maksimal 5 penerima per alur biasa, 10 pesan per batch, 5 pesan per menit, 20 pesan per jam, dan 50 pesan per hari.",
      "Jika ada Pesan Gagal atau antrean bermasalah, operator harus menahan pengiriman dan memeriksa penyebabnya sebelum tindakan lanjut.",
    ],
    operationalNotes: [
      "Uji terbatas pengiriman WhatsApp sudah berhasil.",
      "Data pegawai 42/42 siap menerima notifikasi WhatsApp sesuai alur kerja dan hak akses.",
      "Pemeriksaan keamanan berhasil dan simulasi tanpa kirim berhasil.",
      "Penjadwal dan pengingat berjalan sesuai aturan keamanan, Jam Aman Pengiriman, dan kebijakan backlog.",
      "Full production bukan broadcast bebas; pengiriman berisiko tetap harus disetujui terlebih dahulu.",
    ],
    knownLimitations: [
      "Monitoring hari pertama tetap wajib, terutama untuk WhatsApp terhubung, Pemroses Pesan, Antrean Pesan, Pesan Gagal, Persetujuan, dan batas pengiriman.",
      "Jika ditemukan salah penerima, kirim ganda, antrean gagal, atau Pesan Gagal aktif, segera kembali ke mode aman dan jangan kirim ulang otomatis.",
      "Broadcast, pengiriman ke pihak luar, kirim ulang massal, pengiriman tidak wajar, dan backlog penjadwal tetap tidak boleh berjalan bebas.",
    ],
    details: [
      {
        title: "Status Operasional Terbaru",
        items: [
          "Pengiriman WhatsApp otomatis sudah aktif dengan pengamanan.",
          "Uji terbatas sudah berhasil.",
          "WhatsApp Gateway terhubung.",
          "Pemroses Pesan aktif.",
          "Antrean Pesan sehat.",
          "Pesan Gagal aktif 0.",
          "Persetujuan tertunda 0.",
          "Data pegawai 42/42 siap menerima notifikasi.",
          "Jam Aman Pengiriman aktif.",
          "Batas pengiriman aktif.",
          "Pencegahan kirim ganda aktif.",
          "Mode aman tersedia bila terjadi gangguan.",
        ],
      },
      {
        title: "Pengamanan Pengiriman",
        items: [
          "Sistem membatasi jumlah pesan agar tidak terjadi pengiriman massal yang keliru.",
          "Sistem mencegah pesan yang sama terkirim berulang kepada penerima yang sama.",
          "Pengiriman berisiko tetap harus disetujui terlebih dahulu.",
          "Semua pengiriman penting dicatat untuk audit.",
          "Jika ada anomali, operator dapat kembali ke mode aman.",
        ],
      },
      {
        title: "Tetap Wajib Persetujuan",
        items: [
          "Broadcast.",
          "Notifikasi pihak luar.",
          "Kirim ulang massal.",
          "Pengiriman tidak wajar.",
          "Backlog dari penjadwal.",
        ],
      },
      {
        title: "Yang Harus Dipantau Operator",
        items: [
          "WhatsApp Gateway tetap terhubung.",
          "Pemroses Pesan tetap aktif.",
          "Antrean Pesan tidak menumpuk.",
          "Pesan Gagal aktif tetap 0.",
          "Persetujuan tertunda dipantau.",
          "Batas pengiriman tidak terlampaui.",
          "Penjadwal dan pengingat berjalan dalam Jam Aman Pengiriman.",
          "Masukan pengguna dan tinjauan Pertanyaan Publik dipantau.",
        ],
      },
    ],
  },
  {
    version: "0.1.0-beta.6",
    title: "ALETA 0.1.0-beta.6 - Launch Internal & Pengaman WhatsApp",
    date: "2026-05-03",
    status: "Full Internal Operational Launch Ready",
    summary:
      "Rilis ini menstabilkan ALETA untuk penggunaan operasional internal kantor, memperbaiki WhatsApp Gateway, menambahkan pemeriksaan otomatis, memperbaiki login 1 klik, mempercepat render portal, menyiapkan server kantor, serta menambahkan pengaman WhatsApp untuk mencegah salah kirim, kirim ganda, dan pengiriman massal keliru.",
    added: [
      "Kesiapan Launch Operasional Internal untuk Portal ALETA, Manajemen Surat, Pusat Tugas, Patch Notes, Panduan, Pusat Masukan, dan Admin Monitoring.",
      "Pemeriksaan otomatis untuk portal, ALETA Bot, Layanan WhatsApp, Pemroses Pesan, Antrean Pesan, Pesan Gagal, Persetujuan, nomor WhatsApp pegawai, Jam Aman Pengiriman, Jembatan AI, Penjadwal/Pengingat, dan tinjauan Pertanyaan Publik.",
      "Kesiapan server kantor, runbook deployment, checklist launch, rencana rollback, monitoring hari pertama, dan SOP operasional.",
      "Pengaman WhatsApp dengan pencegahan kirim ganda, batas pengiriman, persetujuan wajib, audit log, simulasi tanpa kirim, pemeriksaan risiko, audit jalur kirim lama, dan kontrol rollback.",
      "Kualitas data WhatsApp: 42/42 pegawai aktif eligible, nomor dummy 0, duplikasi 0, format invalid 0, excluded 0.",
    ],
    changed: [
      "WhatsApp Gateway distabilkan dengan pengaman satu koneksi, tombol hubungkan yang aman diulang, pencegahan koneksi ganda, status sesi WhatsApp yang lebih jelas, dan endpoint diagnostik.",
      "Login kini lebih stabil dalam 1 klik: field/tombol menunggu halaman siap, klik ganda diabaikan, sesi diperbarui setelah login, dan pengguna diarahkan stabil ke /portal.",
      "Portal lebih cepat karena data utama dimuat terlebih dahulu dan data berat dimuat bertahap di belakang layar.",
      "Riwayat beta.6: Pengiriman Bot saat itu masih dikelola sebagai tahap kesiapan dan hanya dinyalakan sementara untuk uji terbatas.",
      "Riwayat beta.6: Penjadwal/Pengingat saat itu dicatat dalam mode kesiapan sebelum status aktif operasional terbaru ditetapkan di beta.7.",
    ],
    fixed: [
      "Pesan gagal dari validasi Phase 4 tidak lagi menjadi penghambat: masuk riwayat sudah ditangani tanpa kirim ulang, tanpa antrean baru, dan tanpa hapus permanen.",
      "Persetujuan Phase 4 sudah ditolak/dibatalkan sebagai artefak validasi dan tidak memicu pengiriman.",
      "Antrean Pesan tetap sehat setelah pilot WhatsApp internal: menunggu 0, diproses 0, gagal 0, Pesan Gagal aktif 0, Persetujuan menunggu 0.",
      "Status Layanan WhatsApp tidak mengekspos QR mentah dan kendala sesi browser ditampilkan lebih manusiawi.",
      "Shutdown/cleanup WhatsApp menggunakan client.destroy() secara aman, bukan logout, tanpa menghapus .wwebjs_auth dan tanpa mengganti session name.",
    ],
    security: [
      "Riwayat beta.6: saat catatan ini pertama dibuat, pengiriman otomatis masih tahap kesiapan. Status terbaru ada di 0.1.0-beta.7.",
      "Broadcast, notifikasi pihak luar, kirim ulang massal, pengiriman tidak wajar, dan backlog penjadwal tetap membutuhkan persetujuan.",
      "Pengaman aktif operasional mencegah salah kirim, kirim ganda, pengiriman massal keliru, jalur kirim langsung tanpa pengaman, penjadwal liar, kirim ulang massal, broadcast tanpa persetujuan, dan notifikasi pihak luar tanpa persetujuan.",
      "Cap awal konservatif: maxRecipientsPerEvent 5, maxMessagesPerBatch 10, maxMessagesPerMinute 5, maxMessagesPerHour 20, maxMessagesPerDay 50.",
      "Mode aman Pertanyaan Publik hanya memakai aturan/template/kueri resmi; pertanyaan yang belum dikenali masuk tinjauan admin dan tidak dijawab bebas.",
    ],
    operationalNotes: [
      "Office Server Launch berstatus GO untuk penggunaan internal: portal dapat diakses, Manajemen Surat siap, ALETA Bot dapat diakses, WhatsApp terhubung, Pemroses Pesan aktif, Antrean Pesan sehat, dan Jembatan AI tersinkron.",
      "Pilot WhatsApp 1 pesan internal ke DERRY BRIANTONO (Hakim), 628****6962 berhasil terkirim dengan Pengiriman Bot dinyalakan sementara lalu dikembalikan nonaktif.",
      "Pilot WhatsApp kecil 3 penerima internal berhasil: DERRY BRIANTONO, S.H. (Hakim) 628****6962; ABDUL SALAM, S.HI. MH. (Ketua) 628****3055; AKBAR ALI, S.H.I. (Wakil Ketua) 628****1382.",
      "Pilot kecil menghasilkan 3 pesan masuk antrean, 3 terkirim, 0 gagal, 0 dilewati, Pesan Gagal aktif 0, Persetujuan menunggu 0.",
      "Jika ada pesan gagal atau Pesan Gagal aktif, tahan pengiriman otomatis, matikan Pengiriman Bot, jangan kirim ulang otomatis, dan tinjau item satu per satu.",
    ],
    knownLimitations: [
      "Riwayat beta.6: pengiriman otomatis saat itu masih dicatat sebagai tahap kesiapan. Status terbaru setelah uji terbatas berhasil ada di 0.1.0-beta.7.",
      "Riwayat beta.6: Jam Aman Pengiriman tetap menjadi syarat penting. Status terbaru menyatakan uji terbatas sudah berhasil.",
      "Perubahan berikut belum dimasukkan sebagai selesai di patch notes ini karena belum ada laporan hasil eksekusi final: optimasi /api/surat pagination 5/10/25/50/100/Semua, grid Dashboard Manajemen Surat, Admin Asisten Hakim, dan perbaikan PLH/PLT Hakim untuk Ketua/Wakil Ketua.",
      "Aktif operasional bukan broadcast bebas; broadcast, notifikasi pihak luar, kirim ulang massal, pengiriman tidak wajar, dan backlog penjadwal tetap perlu persetujuan.",
      "Monitoring hari pertama tetap wajib untuk WhatsApp terhubung, Pemroses Pesan aktif, Antrean Pesan menunggu/diproses/gagal, Pesan Gagal aktif, Persetujuan menunggu, batas pengiriman, dan Penjadwal/Pengingat.",
    ],
    details: [
      {
        title: "Highlights",
        items: [
          "ALETA siap untuk Full Internal Operational Launch.",
          "Portal, Manajemen Surat, Pusat Tugas, Patch Notes, Panduan, Pusat Masukan, dan Admin Monitoring siap digunakan internal.",
          "WhatsApp Gateway distabilkan.",
          "Preflight dan smoke dry-run otomatis tersedia.",
          "Pilot WhatsApp internal berhasil.",
          "Login 1 klik diperbaiki.",
          "Portal lebih cepat karena data berat tidak lagi memblokir shell awal.",
          "Office Server readiness dan runbook dibuat.",
          "WhatsApp Production Guard ditambahkan.",
          "Data nomor WhatsApp pegawai sudah 42/42 eligible.",
          "Riwayat beta.6: pengiriman otomatis masih tahap kesiapan. Status terbaru ada di 0.1.0-beta.7.",
        ],
      },
      {
        title: "WhatsApp Gateway Stabilization",
        items: [
          "Singleton guard untuk WhatsApp client.",
          "Connect endpoint idempotent.",
          "Pencegahan initialize dobel.",
          "Status browser_locked.",
          "Error browser/session lock ditampilkan manusiawi.",
          "Cleanup shutdown aman dengan client.destroy(), bukan logout.",
          "Tidak hapus .wwebjs_auth.",
          "Tidak ganti session name.",
          "Diagnostics endpoint: GET /internal/aleta-bot/whatsapp/diagnostics.",
          "Status runtime tidak mengekspos QR raw.",
        ],
      },
      {
        title: "Queue, Dead-letter, dan Approval Cleanup",
        items: [
          "Phase 4 Validation dead-letter sudah tidak aktif.",
          "Dead-letter aktif 0.",
          "Phase 4 masuk resolved history.",
          "Approval Phase 4 sudah ditolak/cancel.",
          "Tidak ada resend.",
          "Tidak ada enqueue real.",
          "Tidak ada hard-delete.",
          "Queue tetap sehat.",
        ],
      },
      {
        title: "Automated Preflight & Smoke Test",
        items: [
          "Script: scripts/aleta-preflight.mjs.",
          "Script: scripts/aleta-smoke-dry-run.mjs.",
          "Script: scripts/aleta-whatsapp-limited-test.mjs.",
          "Script: scripts/aleta-whatsapp-bot-enabled-test.mjs.",
          "Script: scripts/aleta-whatsapp-small-pilot.mjs.",
          "Laporan: reports/aleta-preflight-latest.md/json.",
          "Laporan: reports/aleta-smoke-dry-run-latest.md/json.",
          "Laporan: reports/aleta-whatsapp-limited-test-latest.md/json.",
          "Laporan: reports/aleta-whatsapp-bot-enabled-test-latest.md/json.",
          "Laporan: reports/aleta-whatsapp-small-pilot-latest.md/json.",
          "Preflight/smoke mengecek portal, ALETA Bot, WhatsApp runtime, worker, queue, dead-letter, approval pending, nomor WhatsApp pegawai, safe sending window, AI Bridge, scheduler/reminder, dan Public Q&A review.",
        ],
      },
      {
        title: "Pilot WhatsApp Internal",
        items: [
          "Uji 1 pesan internal ke DERRY BRIANTONO (Hakim), 628****6962 berhasil.",
          "botEnabled hanya dinyalakan sementara.",
          "Pesan sent.",
          "Tidak broadcast.",
          "Tidak resend.",
          "Tidak scheduler production.",
          "botEnabled dikembalikan false.",
          "Pilot kecil 3 penerima: DERRY BRIANTONO, S.H. - Hakim - 628****6962.",
          "Pilot kecil 3 penerima: ABDUL SALAM, S.HI. MH. - Ketua - 628****3055.",
          "Pilot kecil 3 penerima: AKBAR ALI, S.H.I. - Wakil Ketua - 628****1382.",
          "Hasil pilot kecil: enqueued 3, sent 3, failed 0, skipped 0, dead-letter aktif 0, approval pending 0.",
        ],
      },
      {
        title: "Office Server Launch Readiness",
        items: [
          "Office Server Launch: GO.",
          "Portal reachable.",
          "Manajemen Surat siap dipakai internal.",
          "ALETA Bot runtime reachable.",
          "WhatsApp connected.",
          "Worker aktif.",
          "Queue sehat.",
          "Dead-letter aktif 0.",
          "Approval pending 0.",
          "AI Bridge synced.",
          "Riwayat beta.6: Pengiriman Bot dan Penjadwal/Pengingat masih berada di tahap kesiapan.",
          "Script: scripts/start-aleta-office.ps1.",
          "Script: scripts/stop-aleta-office.ps1.",
          "Script: scripts/status-aleta-office.ps1.",
          "Script: scripts/restart-aleta-office-safe.ps1.",
          "Script: scripts/aleta-office-server-readiness.mjs.",
          "Runbook/SOP: reports/aleta-office-server-deployment-runbook.md.",
          "Runbook/SOP: reports/aleta-office-server-launch-checklist.md.",
          "Runbook/SOP: reports/aleta-office-server-rollback-plan.md.",
          "Runbook/SOP: reports/aleta-office-server-day-one-monitoring.md.",
          "Runbook/SOP: reports/aleta-sop-whatsapp-disconnected.md.",
          "Runbook/SOP: reports/aleta-sop-dead-letter.md.",
          "Runbook/SOP: reports/aleta-sop-queue-failed.md.",
          "Runbook/SOP: reports/aleta-sop-rollback-safe-mode.md.",
        ],
      },
      {
        title: "WhatsApp Production Guard",
        items: [
          "Production guard untuk mencegah salah kirim, kirim ganda, mass-send keliru, direct-send bypass, scheduler liar, resend massal, broadcast tanpa approval, dan external notification tanpa approval.",
          "Service: aleta_bot/services/productionGuardService.js.",
          "Service: aleta_bot/services/idempotencyService.js.",
          "Service: aleta_bot/services/messageService.js.",
          "Config: aleta_bot/config/aleta-runtime.json.",
          "Validator: scripts/aleta-whatsapp-production-risk-check.mjs.",
          "Validator: scripts/aleta-whatsapp-production-shadow-run.mjs.",
          "Validator: scripts/aleta-whatsapp-production-canary.mjs.",
          "Validator: scripts/aleta-whatsapp-production-launch.mjs.",
          "Validator: scripts/aleta-whatsapp-number-quality.mjs.",
          "Validator: scripts/aleta-idempotency-production-proof.mjs.",
          "Validator: scripts/aleta-legacy-send-path-audit.mjs.",
          "Validator: scripts/aleta-production-gate-rerun.mjs.",
          "Validator: scripts/aleta-production-config-prepare.mjs.",
        ],
      },
      {
        title: "Data Hygiene Nomor WhatsApp",
        items: [
          "Sebelumnya ditemukan 2 nomor dummy.",
          "Sebelumnya ditemukan 2 duplicate groups.",
          "Sebelumnya ditemukan 6 excluded recipients.",
          "Setelah koreksi: pegawai aktif 42.",
          "Eligible WhatsApp production 42/42.",
          "Missing WA 0.",
          "Priority missing 0.",
          "Dummy number 0.",
          "Duplicate groups 0.",
          "Invalid format 0.",
          "Excluded recipients 0.",
          "All 42 active employees are eligible for WhatsApp production.",
        ],
      },
      {
        title: "Production Risk Gate & Shadow-run",
        items: [
          "Risk gate PASS untuk runtime.",
          "Risk gate PASS untuk queue.",
          "Risk gate PASS untuk data.",
          "Risk gate PASS untuk recipient resolver.",
          "Risk gate PASS untuk template.",
          "Risk gate PASS untuk idempotency.",
          "Risk gate PASS untuk duplicate prevention.",
          "Risk gate PASS untuk cap/outlier.",
          "Risk gate PASS untuk scheduler/reminder readiness.",
          "Risk gate PASS untuk approval.",
          "Risk gate PASS untuk Public Q&A safe mode.",
          "Risk gate PASS untuk rollback.",
          "Shadow-run PASS untuk Internal disposition notification.",
          "Shadow-run PASS untuk Internal incoming letter notification.",
          "Shadow-run PASS untuk Deadline H-1 reminder.",
          "Shadow-run PASS untuk Public Q&A safe mode.",
          "Shadow-run PASS untuk Broadcast capability gate.",
          "Shadow-run PASS untuk External notification gate.",
          "Shadow-run PASS untuk Mass resend capability gate.",
          "Shadow-run tidak mengirim WhatsApp real.",
        ],
      },
      {
        title: "Cap, Rate Limit, dan Approval Gate",
        items: [
          "maxRecipientsPerEvent: 5.",
          "maxMessagesPerBatch: 10.",
          "maxMessagesPerMinute: 5.",
          "maxMessagesPerHour: 20.",
          "maxMessagesPerDay: 50.",
          "broadcastRequiresApproval: true.",
          "externalNotificationRequiresApproval: true.",
          "massResendRequiresApproval: true.",
          "outlierRequiresApproval: true.",
          "Full production bukan broadcast bebas.",
          "Broadcast/external/mass resend tetap approval-gated.",
        ],
      },
      {
        title: "Public Q&A Safe Mode",
        items: [
          "Hanya intent/template/query resmi.",
          "Unknown/fallback masuk human review.",
          "Tidak menjawab bebas.",
          "Tidak membocorkan data internal.",
          "Tidak memakai query DB liar.",
          "Intent tidak eligible tidak masuk production.",
        ],
      },
      {
        title: "Login dan Navigasi Portal",
        items: [
          "Login 1 klik diperbaiki.",
          "Root cause: field/tombol bisa aktif sebelum hydration selesai.",
          "Root cause: klik/input pertama bisa hilang atau terbaca kosong.",
          "Root cause: race antara router.replace('/portal') dan router.refresh().",
          "Perbaikan: field/tombol disabled sampai client siap.",
          "Perbaikan: submit terkontrol.",
          "Perbaikan: duplicate submit diabaikan.",
          "Perbaikan: session refetch setelah sign-in.",
          "Perbaikan: redirect stabil ke /portal.",
          "Perbaikan: router.refresh() dihapus dari success path.",
          "PortalProvider tidak lagi memblokir shell sampai data berat selesai.",
          "Data critical dimuat dulu.",
          "Data berat dimuat background.",
          "Portal shell tampil lebih cepat.",
        ],
      },
      {
        title: "Validasi",
        items: [
          "node --check app.js.",
          "node --check whatsapp.js.",
          "node --check services/whatsappStatusService.js.",
          "node --check routes/internalGatewayRoutes.js.",
          "node --check services/productionGuardService.js.",
          "node --check services/messageService.js.",
          "node --check services/idempotencyService.js.",
          "npx tsc --noEmit --pretty false.",
          "npm run lint.",
          "npm run build.",
          "npm test.",
          "Validasi terakhir PASS.",
        ],
      },
      {
        title: "Status Akhir Rilis",
        items: [
          "Boleh dipakai: Portal ALETA.",
          "Boleh dipakai: Manajemen Surat.",
          "Boleh dipakai: Pusat Tugas.",
          "Boleh dipakai: Patch Notes.",
          "Boleh dipakai: Panduan.",
          "Boleh dipakai: Pusat Masukan.",
          "Boleh dipakai: Admin monitoring.",
          "Boleh dipakai: ALETA Bot runtime.",
          "Boleh dipakai: WhatsApp connected.",
          "Boleh dipakai: Preflight.",
          "Boleh dipakai: Smoke dry-run.",
          "Boleh dipakai: Office server internal launch.",
          "Riwayat beta.6: WhatsApp otomatis, Penjadwal/Pengingat, dan mode aman Pertanyaan Publik masih dicatat sebagai siap gate.",
          "Tetap approval-gated: Broadcast.",
          "Tetap approval-gated: External notification.",
          "Tetap approval-gated: Mass resend.",
          "Tetap approval-gated: Outlier send.",
          "Tetap approval-gated: Scheduler backlog.",
        ],
      },
      {
        title: "Risiko Tersisa dan Langkah Lanjutan",
        items: [
          "Riwayat beta.6: uji terbatas dijadwalkan dalam Jam Aman Pengiriman 07:30-21:00.",
          "Status terbaru: uji terbatas sudah berhasil dan pengiriman otomatis aktif dengan pengamanan.",
          "Pantau hari pertama: WhatsApp connected.",
          "Pantau hari pertama: worker aktif.",
          "Pantau hari pertama: queue pending/processing/failed.",
          "Pantau hari pertama: dead-letter aktif.",
          "Pantau hari pertama: approval pending.",
          "Pantau hari pertama: cap/rate-limit.",
          "Pantau hari pertama: scheduler/reminder.",
          "Jika queue failed atau dead-letter muncul: pause automation.",
          "Jika queue failed atau dead-letter muncul: set botEnabled=false.",
          "Jika queue failed atau dead-letter muncul: jangan resend otomatis.",
          "Jika queue failed atau dead-letter muncul: review item satu per satu.",
        ],
      },
      {
        title: "Not Yet Included / Pending Execution",
        items: [
          "Optimasi /api/surat dengan pagination 5/10/25/50/100/Semua.",
          "Perbaikan grid Dashboard Manajemen Surat.",
          "Admin fitur Asisten Hakim untuk edit URL AI dan role/user toggle.",
          "Perbaikan PLH/PLT agar Hakim bisa menjadi kandidat Ketua/Wakil Ketua.",
        ],
      },
    ],
  },
  {
    version: "0.1.0-beta.5",
    title: "Final Pilot Verification dan Data Readiness",
    date: "2026-05-01",
    status: "Beta",
    summary:
      "Rilis beta internal untuk memperketat verifikasi pilot terbatas, readiness report, smoke test final, runbook pilot, dan data readiness nomor WhatsApp sebelum operasional terbatas.",
    added: [
      "Runbook Pilot Terbatas ALETA di Panduan Penggunaan.",
      "Smoke test final dengan pemeriksaan auth guard, queue, safe sending window, pilot readiness, dan no-secret response.",
      "Readiness report yang memuat safe sending window, AI Bridge, legacy fallback terbaru, smoke test availability, dan prioritas nomor WhatsApp kosong.",
    ],
    changed: [
      "Kesiapan Pilot di Admin ALETA Bot dibuat lebih jelas dengan timestamp, tombol Jalankan Smoke Test, dan Export Readiness.",
      "Blocker readiness diperketat agar status Siap tidak muncul saat ada blocker kritis seperti safe sending window nonaktif, kill switch aktif, legacy fallback baru, atau AI Public Q&A needs_sync.",
      "Run history reminder menampilkan ringkasan aman dari hasil run tanpa nomor penuh, isi pesan penuh, atau secret.",
    ],
    fixed: [
      "Operational smoke test kini membaca pilot readiness dan queue state tanpa melakukan enqueue atau pengiriman WhatsApp.",
      "Readiness CSV mencantumkan status safe sending window, AI Bridge, legacy fallback, dan smoke test availability.",
    ],
    security: [
      "Smoke test tetap baca-saja: tidak scan QR, tidak enqueue, dan tidak mengirim WhatsApp.",
      "Readiness report tidak mengekspor token, QR raw, session, password, API key, atau nomor WhatsApp penuh.",
      "Reminder production tetap terkunci oleh approval, Super Admin, idempotency, dan konfirmasi eksplisit.",
    ],
    operationalNotes: [
      "Gunakan Kesiapan Pilot dan Export Readiness sebelum memulai pilot harian.",
      "Jalankan Smoke Test dari Admin ALETA Bot untuk memeriksa koneksi dan guard tanpa aksi berisiko.",
      "Lengkapi nomor WhatsApp pegawai prioritas sebelum melepas pilot lebih luas.",
    ],
    knownLimitations: [
      "Scheduler production tetap belum dilepas otomatis.",
      "Smoke test tidak menggantikan uji pilot manual dengan skenario operasional nyata.",
      "Status Siap tetap bergantung pada data runtime terbaru dan kelengkapan nomor WhatsApp pegawai.",
    ],
  },
  {
    version: "0.1.0-beta.4",
    title: "Finalisasi Pilot Readiness, KPI Pimpinan, dan Smoke Test Operasional",
    date: "2026-05-01",
    status: "Beta",
    summary:
      "Rilis beta internal untuk menyelesaikan finishing pilot: KPI pimpinan, scheduler dry-run reminder H-1, run history, export readiness, smoke test operasional, dan logging saran AI yang lebih aman.",
    added: [
      "Dashboard KPI Pimpinan di halaman Statistik.",
      "Scheduler dry-run reminder deadline disposisi H-1 yang bisa diuji dari admin.",
      "Run history reminder deadline disposisi.",
      "Export CSV Pilot Readiness.",
      "Operational Smoke Test baca-saja tanpa scan QR, tanpa enqueue, dan tanpa kirim WhatsApp.",
      "Logging penggunaan saran AI klasifikasi dan ringkasan surat.",
    ],
    changed: [
      "Panel Reminder Deadline Disposisi menampilkan status scheduler, kill switch, dan riwayat run lebih jelas.",
      "Fallback saran AI kini membedakan AI disabled, perlu sinkronisasi, dan kondisi error/provider belum siap.",
      "Pilot readiness dapat diekspor untuk bahan koordinasi internal.",
    ],
    fixed: [
      "Insight run reminder tidak hanya terlihat pada preview sesaat, tetapi tersimpan sebagai run history.",
      "Smoke test operasional tidak memicu aksi berisiko pada WhatsApp Gateway.",
    ],
    security: [
      "Scheduler otomatis tetap dibatasi pada dry-run; production tetap membutuhkan Super Admin, approval, dan konfirmasi eksplisit.",
      "AI suggestion log tidak menyimpan prompt penuh, API key, token, atau data sensitif mentah.",
      "Export readiness tidak menyertakan secret, QR raw, session WhatsApp, atau nomor penuh.",
    ],
    operationalNotes: [
      "Jalankan Operational Smoke Test sebelum pilot harian.",
      "Gunakan Export Readiness untuk melaporkan blocker pilot kepada tim internal.",
      "Gunakan Run History Reminder untuk memastikan dry-run scheduler berjalan tanpa pengiriman real.",
    ],
    knownLimitations: [
      "Reminder production belum dilepas otomatis dan tetap harus diaktifkan melalui gate Super Admin.",
      "AI klasifikasi/ringkasan tetap berupa saran manual, bukan keputusan otomatis.",
      "Smoke test membaca status runtime, tetapi tidak menggantikan uji pilot operasional terjadwal.",
    ],
  },
  {
    version: "0.1.0-beta.3",
    title: "Pilot Control, SLA, Analytics, dan Saran AI Administrasi",
    date: "2026-05-01",
    status: "Beta",
    summary:
      "Rilis beta internal untuk memperkuat kontrol pilot reminder, laporan policy skip, SLA disposisi, analitik ALETA Bot/Public Q&A, dan saran AI manual untuk klasifikasi serta ringkasan surat.",
    added: [
      "Pilot whitelist untuk reminder deadline disposisi H-1.",
      "Scheduler reminder H-1 dengan default disabled/dry-run dan kill switch khusus reminder.",
      "Report dan export CSV Policy Skip.",
      "Filter pegawai tanpa nomor WhatsApp di Mapping User/Jabatan.",
      "Dashboard SLA Disposisi.",
      "Analitik Pengiriman ALETA Bot.",
      "Analitik Public Q&A.",
      "Endpoint saran AI klasifikasi surat dan ringkasan surat.",
    ],
    changed: [
      "Pilot readiness dibuat lebih actionable dengan tombol menuju area perbaikan.",
      "Reminder H-1 tetap aman: production membutuhkan approval, konfirmasi, idempotency, dan blocker clear.",
      "Admin ALETA Bot menampilkan kontrol whitelist, scheduler, dan emergency stop reminder.",
    ],
    fixed: [
      "Insight policy skip tidak hanya bergantung pada runtime memory.",
      "Link missingWhatsapp=true kini memfilter daftar akun yang belum memiliki nomor WhatsApp.",
      "SLA disposisi lebih mudah dipantau dari halaman statistik.",
    ],
    security: [
      "Reminder tetap default dry-run dan tidak aktif production tanpa Super Admin.",
      "Nomor WhatsApp tetap dimasking di area analitik dan preview.",
      "Saran AI tidak auto-apply dan tidak menyimpan perubahan tanpa konfirmasi manusia.",
      "Kill switch reminder hanya memengaruhi reminder deadline, bukan fitur lain.",
    ],
    operationalNotes: [
      "Gunakan mode dry-run untuk menguji reminder deadline sebelum pilot terbatas.",
      "Lengkapi nomor WhatsApp pegawai dari Mapping User/Jabatan agar fallback legacy bisa dikurangi.",
      "Pantau Policy Skip dan SLA Disposisi sebelum menyatakan pilot siap.",
    ],
    knownLimitations: [
      "Reminder production belum dijalankan otomatis pada validasi.",
      "AI klasifikasi/ringkasan masih berupa saran manual dan bukan keputusan final.",
      "Legacy mapping WhatsApp tetap ada sebagai fallback sampai data nomor pegawai lengkap.",
    ],
  },
  {
    version: "0.1.0-beta.2",
    title: "UX, Navigasi Aplikasi, Feedback, dan Penguatan ALETA Bot",
    date: "2026-05-01",
    status: "Beta",
    summary:
      "Rilis beta internal yang memperhalus navigasi aplikasi, memperkuat pengalaman ALETA Bot, menambahkan pusat masukan, dan merapikan dokumentasi/operator UX sebelum pilot terbatas.",
    added: [
      "Dashboard ALETA Bot untuk semua user.",
      "Riwayat Pengiriman Pesan ALETA Bot.",
      "Sidebar berbeda per aplikasi.",
      "Asisten Hakim di Grid Aplikasi.",
      "Pusat Masukan ALETA.",
      "Panduan Penggunaan ALETA.",
      "Jadwal/Cron dengan tampilan manusiawi.",
      "Koneksi Database tersedia di Mode Sederhana.",
      "Pengaturan password koneksi database dengan hidden/toggle mata.",
    ],
    changed: [
      "Footer dibuat lebih universal.",
      "Header /patch-notes, /panduan, dan /masukan disesuaikan konteks.",
      "Mode Sederhana/Lanjutan ALETA Bot diperhalus.",
      "Tab Notifikasi dan Kueri Terdaftar dibuat fit tanpa horizontal scroll.",
      "ALETA Bot umum dipisahkan dari Admin ALETA Bot.",
      "Istilah teknis disederhanakan.",
    ],
    fixed: [
      "Double footer pada tab Status WhatsApp Gateway.",
      "Konsistensi pairing WhatsApp Gateway dan ALETA Bot.",
      "Konsistensi session name WhatsApp.",
      "Judul Patch Notes/Panduan tidak lagi Manajemen Surat.",
      "Horizontal scroll pada Notifikasi dan Kueri Terdaftar.",
      "Fallback AI key .env diperjelas.",
    ],
    security: [
      "Role-aware masking untuk riwayat pesan.",
      "Admin settings tetap dibatasi.",
      "Asisten Hakim dibatasi role.",
      "Pusat Masukan role-aware.",
      "Manajemen akun diperkuat.",
      "Password koneksi database tidak diekspos.",
      "Session WhatsApp/token/API key tidak diekspos.",
    ],
    operationalNotes: [
      "Gunakan Pusat Masukan untuk melaporkan bug, saran fitur, atau usulan aplikasi baru dari footer aplikasi.",
      "Gunakan Mode Sederhana untuk pekerjaan harian operator dan Mode Lanjutan untuk konfigurasi teknis.",
      "Pastikan perubahan koneksi database diuji dari modal sebelum dipakai untuk query atau notifikasi.",
      "Gunakan Patch Notes dan Panduan Penggunaan sebagai rujukan internal saat pilot.",
    ],
    knownLimitations: [
      "Masih internal pilot.",
      "Notifikasi pihak tetap perlu dry-run sebelum aktif massal.",
      "Legacy app.js/notifikasi.js/query.js masih fallback bertahap.",
      "Archive legacy penuh belum selesai.",
      "Asisten Hakim memakai layanan AI eksternal.",
    ],
  },
  {
    version: "0.1.0-beta.1",
    title: "Internal Pilot Build",
    date: "2026-04-30",
    status: "Beta",
    summary:
      "Rilis awal internal ALETA yang menggabungkan portal Manajemen Surat, ALETA Bot, WhatsApp Gateway tunggal, AI Config Bridge, antrean pesan, Public Q&A, migrasi legacy bertahap, dan perapian UX untuk operator.",
    added: [
      "Portal utama manajemen_surat sebagai pusat aplikasi internal ALETA.",
      "Modul ALETA Bot Admin Panel.",
      "Single WhatsApp Gateway dengan aleta_bot sebagai runtime utama WhatsApp dan manajemen_surat sebagai control panel.",
      "Connect WhatsApp Gateway dari portal dengan QR WhatsApp dari runtime aleta_bot.",
      "Queue/antrean pesan, worker pemroses antrean, dead-letter, dan resend pesan gagal dengan konfirmasi.",
      "AI Config Bridge agar provider, model, dan API key dikontrol dari menu AI portal, sementara aleta_bot menjadi runtime executor.",
      "Public Q&A / Pertanyaan dan Jawaban Publik dengan safety guard AI untuk mencegah jawaban bebas atau berisiko.",
      "Legacy Migration Tracker, Duplicate Path Guard, Rollback State Machine, dan Archive Readiness.",
      "Release Readiness, smoke test tanpa pengiriman WhatsApp sungguhan, export config non-secret, dan runbook operasional.",
      "Mode Sederhana / Mode Lanjutan untuk membedakan tampilan operator dan admin teknis.",
      "Jadwal/Cron dengan tampilan manusiawi: jam, tanggal, hari, bulan, dan opsi Setiap.",
    ],
    changed: [
      "Portal tidak lagi membuat WhatsApp client produksi sendiri dalam mode aleta_bot.",
      "Tombol Connect WhatsApp sekarang memanggil runtime connect di aleta_bot dan UI melakukan polling status/QR setelah Connect.",
      "Status teknis diterjemahkan ke bahasa operasional dan fitur teknis disembunyikan di Mode Sederhana.",
      "Notifikasi Pegawai/Pihak dikelompokkan dalam satu menu Notifikasi tanpa menggabungkan tabel internalnya.",
      "Migration row tidak lagi menampilkan semua tombol dengan bobot setara.",
      "Log aktivitas diberi filter awal dan dibatasi agar tidak terlalu padat.",
      "API key AI di aleta_bot tidak lagi menjadi syarat utama production.",
      "OPENAI_API_KEY, GEMINI_API_KEY, dan ANTHROPIC_API_KEY hanya fallback development.",
      "Password SQL connection tidak ditampilkan kembali saat edit.",
      "Cron mentah tidak menjadi tampilan utama user/admin.",
    ],
    fixed: [
      "QR WhatsApp tidak muncul saat Connect.",
      "Portal /api/whatsapp/init sekarang benar-benar memanggil connect runtime di aleta_bot.",
      "Token guard internal endpoint: tanpa token 401, token salah 403.",
      "Queue response dimasking agar tidak membocorkan nomor penuh atau pesan mentah.",
      "AI disabled fallback tidak throw error.",
      "RBAC visibility untuk portal apps sudah diperbaiki.",
      "Lint/test lama dibersihkan.",
      "Rollback modal menampilkan transisi lebih jelas.",
      "Purge logs memakai konfirmasi teks.",
      "Dead-letter resend menampilkan nomor masked dan preview pesan.",
    ],
    security: [
      "Internal API dilindungi token.",
      "Admin route sensitif membutuhkan login.",
      "High-risk action tetap memakai modal/konfirmasi.",
      "API key AI tidak ditampilkan di UI, API response, atau log.",
      "DB password tidak ditampilkan ulang di edit modal.",
      "Export config tidak membawa API key, DB password, internal token, WhatsApp session, atau QR raw.",
      "Nomor penerima dimasking di UI sensitif.",
      "Query SQL tetap divalidasi read-only.",
      "Public Q&A tetap dibatasi oleh intent, template, dan query resmi.",
    ],
    operationalNotes: [
      "Untuk menggunakan WhatsApp: jalankan aleta_bot, jalankan manajemen_surat, login sebagai Super Admin, buka ALETA Bot, klik Connect WhatsApp Gateway, tunggu QR muncul, lalu scan QR dengan WhatsApp kantor.",
      "Jika AI Bridge berstatus needs_sync, klik Sync AI ke ALETA Bot.",
      "Setelah restart aleta_bot, AI secret runtime bisa perlu sync ulang.",
      "Notifikasi pihak sebaiknya tetap dry-run sampai pilot selesai.",
      "Gunakan Mode Lanjutan hanya untuk konfigurasi teknis.",
      "Jalankan smoke test sebelum pilot.",
    ],
    knownLimitations: [
      "WhatsApp harus discan manual oleh admin.",
      "Status disconnected masih normal sebelum WhatsApp dihubungkan.",
      "AI Bridge bisa needs_sync setelah restart.",
      "Notifikasi pihak belum disarankan aktif massal.",
      "Legacy app.js, notifikasi.js, dan query.js masih ada sebagai fallback bertahap.",
      "Archive legacy penuh belum dilakukan.",
      "Visual operator pilot masih perlu diuji langsung di kantor.",
    ],
  },
];
