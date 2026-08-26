export const APP_VERSION = "1.19.4";
export const APP_VERSION_LABEL = "ALETA v1.19.4 - Penamaan Kesiapan Pilot";

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
      "Kapan diingatkan (H-3 dan H-1) tidak dapat diubah untuk agenda bawaan. Mematikan pengingat H-3 pada agenda yang menuntut persiapan berhari-hari membuat pihak datang tanpa saksi, dan tidak ada pesan galat yang menandakannya.",
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
      "Jenis dokumen bawaan tidak dapat dimatikan atau dialihkan tujuannya dari portal. Mematikan jenis Jawaban akan membuat seluruh Jawaban berhenti diberitahukan tanpa satu pun pesan galat - hanya kesunyian yang terlihat normal.",
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
      "Pemutus arus hanya menghitung gangguan sistemik (batas waktu, sambungan putus, sambungan penuh). Galat SQL biasa seperti tabel tidak ada atau sintaks keliru tidak dihitung, agar satu query admin yang salah tulis tidak menghentikan layanan bagi semua orang.",
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
      "Pengukuran durasi setiap query ke database perkara: jumlah pemanggilan, rata-rata, persentil ke-95, durasi tertinggi, jumlah baris, galat, dan batas waktu terlampaui. Query dikelompokkan menurut sidiknya, sehingga query yang sama dengan nomor perkara berbeda terhitung menyatu.",
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
