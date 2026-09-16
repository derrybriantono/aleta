/**
 * Catatan pembaruan ekstensi SIPP - satu daftar, dipakai di tiga tempat.
 *
 * ============================================================================
 * KENAPA DAFTARNYA TERPISAH DARI PATCH NOTES PORTAL
 * ============================================================================
 *
 * Ekstensi dan portal punya nomor versi masing-masing dan dirilis pada saat
 * yang berbeda: satu commit dapat menaikkan ekstensi tanpa menyentuh portal,
 * dan sebaliknya. Menumpangkan catatannya pada PATCH_NOTES portal akan membuat
 * pembaruan ekstensi tampak "milik" versi portal yang kebetulan berjalan saat
 * itu - dan yang memasang ekstensi tidak pernah bertanya versi portal berapa.
 *
 * ============================================================================
 * SATU SUMBER UNTUK TIGA LAYAR
 * ============================================================================
 *
 * Halaman Patch Notes (dari kaki halaman), halaman Integrasi e-Court bagian
 * Ekstensi, dan Update Manager di admin membaca daftar INI. Tidak ada salinan.
 * Ada uji yang menuntut entri teratasnya sama dengan versi manifest yang
 * tertanam - catatan yang tertinggal dari ekstensinya adalah catatan yang
 * berbohong tentang apa yang sedang berjalan di peramban orang.
 *
 * ============================================================================
 * WAKTUNYA WAKTU COMMIT, ZONA WITA
 * ============================================================================
 *
 * dirilis diambil dari waktu commit yang menaikkan nomor versi manifest,
 * dalam zona waktu satuan kerja (+08:00). Ditulis lengkap dengan zona supaya
 * tampilannya sama di komputer mana pun ia dibuka.
 *
 * Sampai 1.135.0 aturan itu tidak dipatuhi: tiga belas entri terakhir berisi
 * jam bulat yang ditulis tangan, dan sebagian bertanggal hari BERIKUTNYA
 * daripada commitnya. Ketahuannya bukan dari membaca melainkan dari penjaga
 * urutan - satu entri tertulis pukul 16:00 pada hari yang paginya baru
 * berjalan, sehingga versi sesudahnya tidak dapat disisipkan sama sekali.
 * Seluruhnya sudah diluruskan ke git log masing-masing.
 *
 * EMPAT yang tetap perkiraan, dan disebut begitu: 1.125.0, 1.126.0, 1.127.0,
 * dan 1.129.0 tidak pernah punya commit sendiri - nomornya dinaikkan lalu
 * ikut terbawa commit versi berikutnya, jadi waktu commitnya memang tidak
 * ada. Keempatnya diletakkan di antara tetangganya yang terverifikasi, dan
 * jamnya dibuat BULAT sebagai penandanya: angka yang tampak pasti untuk
 * waktu yang tidak diketahui lebih buruk daripada angka yang jujur
 * kira-kira.
 *
 * Yang TIDAK ada: 1.83.0. Nomor itu dilewati - dua perbaikan digabung menjadi
 * 1.84.0 - dan tidak pernah terpasang di peramban siapa pun.
 */
export type CatatanEkstensi = {
  versi: string;
  /** ISO 8601 lengkap dengan zona, mis. 2026-09-11T14:08:51+08:00. */
  dirilis: string;
  judul: string;
  butir: string[];
};

export const CATATAN_EKSTENSI: CatatanEkstensi[] = [
  {
    versi: "1.154.0",
    dirilis: "2026-09-16T13:00:00+08:00",
    judul: "Keterangan saksi yang terisi, dan yang dapat dipindahkan",
    butir: [
      "TITIK-TITIK TEMPLAT DIISI DARI GUGATAN: kapan perselisihan mulai, sejak kapan dan berapa lama berpisah, siapa yang meninggalkan kediaman bersama. Yang tidak terbaca dibiarkan bertitik-titik - mengarang tanggal pisah rumah ke dalam berita acara jauh lebih berbahaya daripada titik-titik yang terlihat. Berapa kali saksi menyaksikan diisi \"beberapa kali\", bukan bilangan karangan.",
      "MODUS SAKSI BARU: tidak tahu pertengkarannya, hanya tahu sudah pisah. Saudara atau tetangga yang hanya menyaksikan salah satunya pulang ke rumah orang tuanya - menyusun keterangannya seolah ia tahu pertengkaran membuatnya patah oleh satu pertanyaan silang.",
      "TIAP BARIS DAPAT DIGESER, DISALIN, DITAMBAH, DIHAPUS. Seret pegangannya ke atas, ke bawah, atau ke kolom saksi seberang - di sana ia disisipkan sebagai baris tambahan, tidak pernah menimpa. Pertanyaannya sendiri boleh disunting; nomornya dihitung ulang saat disimpan.",
      "Tombol \"Susun posita dari keterangan saksi\" menjadi \"Input ke ABT\"; kartu alasan perceraian menjadi empat blok berkepala jumlah; dan \"Tuliskan huruf alasan\" berdiri bersama \"Terapkan yang dicentang\".",
    ],
  },
  {
    versi: "1.153.0",
    dirilis: "2026-09-16T12:00:00+08:00",
    judul: "Unduhan yang tertahan Chrome, dan status putusan pada nama berkas",
    butir: [
      "UNDUHAN ABT TIDAK LAGI DITAHAN. Versi sebelumnya menjawab nama berkas MENYUSUL, dan Chrome menahan unduhannya - \"Insecure download blocked\". Jawabannya kembali seketika dari salinan di ingatan; penyimpanan sesi tetap dipakai, hanya untuk memulihkan ingatan itu saat pekerja latar bangun.",
      "STATUS PUTUSAN DAN VERSTEK IKUT PADA NAMANYA: nomor perkara, keterangan blangko, status putusan, lalu jenis berkasnya. Dibaca dari jadwal sidang yang memang sudah dimuat panel.",
      "Bila konteksnya belum sempat pulih, berkasnya memakai nama bawaan ABT - kekurangan yang terlihat dan dapat diperbaiki orang, tidak seperti unduhan yang tertahan.",
    ],
  },
  {
    versi: "1.152.0",
    dirilis: "2026-09-16T11:00:00+08:00",
    judul: "Nama unduhan ABT tidak lagi hilang bersama pekerja latarnya",
    butir: [
      "BERKAS DARI TOMBOL CETAK ABT KEMBALI BERNAMA PERKARANYA. Aturan penamaannya benar sejak 1.146.0; yang keliru tempat keterangannya disimpan - satu variabel di pekerja latar Manifest V3, yang dimatikan Chrome sesudah ±30 detik menganggur. Halaman mengabarkannya sekali saat dibuka, dan ketika CETAK ditekan beberapa menit kemudian pekerjanya sudah dibangunkan ulang dengan keterangan kosong. Kini disimpan di chrome.storage.session.",
      "KETERANGANNYA DISEGARKAN OLEH KEHADIRAN ANDA: tiap sentuhan pada halaman ABT (paling sering sekali per sepuluh detik) dan tiap kali tabnya dibuka kembali. Umur lima menitnya kini dihitung sejak terakhir Anda menyentuh halaman itu.",
      "Unduhan lewat panel ALETA sendiri tidak pernah terkena - ia menyebut namanya langsung kepada peramban; itu sebabnya sebagian berkas bernama benar dan sebagian bernama download pada hari yang sama.",
    ],
  },
  {
    versi: "1.151.0",
    dirilis: "2026-09-16T10:30:00+08:00",
    judul: "Putusan massal ABT menyebut langkah berikutnya, dan rencananya kedaluwarsa bila pilihannya berubah",
    butir: [
      "SESUDAH DIPERIKSA, TOMBOLNYA BERBUNYI \"Jalankan N perkara sekarang\" dan di bawah daftar rencana tertulis kalimat yang menyuruh menekannya. Sebelumnya seluruh yang terlihat berbunyi \"belum\" - tombolnya \"Periksa dulu - belum dijalankan\", hasilnya \"belum ada yang dikerjakan\" - sehingga panelnya terbaca seperti buntu, dan dilaporkan sebagai tidak bisa dipakai.",
      "RENCANA YANG BASI TIDAK DAPAT DIJALANKAN. Mencentang perkara lain, mengganti blangko, atau mematikan pilihan pekerjaan sesudah diperiksa membatalkan rencananya: tombol Jalankan mati, namanya pulih, dan sebabnya dikatakan. Sebelumnya ketujuh perkara dikerjakan padahal yang diperlihatkan hanya empat.",
      "Menekan Jalankan dua kali tidak lagi mengulang perkara yang sama. Mencari, menyaring, dan mengurutkan tetap tidak membatalkan apa pun.",
    ],
  },
  {
    versi: "1.150.0",
    dirilis: "2026-09-16T09:30:00+08:00",
    judul: "Penetapan massal memperlihatkan siapa dan kapan, dan menghitungnya berurutan",
    butir: [
      "RINCIAN DI BAWAH TIAP PERKARA sesudah Periksa: majelis (kode SK dan nama), panitera pengganti, juru sita, hari sidang, ganjalan (akhir pekan, kurang dari tujuh hari, nilai sengketa kosong, pejabat berhalangan), dan andaian bot. Rapor yang sama dengan papan satu perkara - selama ini penetapan massal menulis belasan penetapan tanpa pernah memperlihatkannya.",
      "DIHITUNG BERURUTAN: usulan perkara ke-n memperhitungkan perkara 1 sampai n-1 di antrean seolah sudah tertulis, sehingga giliran majelis, panitera pengganti, dan juru sita pada pratinjau sama dengan yang tertulis nanti. Sebelumnya seluruh perkara mengusulkan yang berbeban terendah yang sama.",
      "Di sisi peladen (2.19.5): jam tiap langkah penetapan dihitung sampai detik dan disebar pada pagi hari, dan jejak Smart Majelis di Audit Trail ditulis persis seperti tangan petugas.",
    ],
  },
  {
    versi: "1.149.0",
    dirilis: "2026-09-15T18:20:00+08:00",
    judul: "Kepala Penetapan Majelis Hakim kembali, dan tiap dropdown menempel pada kepalanya sendiri",
    butir: [
      "KEPALA PENETAPAN MAJELIS HAKIM ADA DI KEDUA MODE, dengan kode SK di depan namanya. Ia pernah disembunyikan di mode manual - waktu itu ia menampilkan usulan mesin yang BERBEDA dari majelis yang dipilih. Sejak mengganti majelis memuat ulang usulannya, yang tertulis adalah majelis yang dipilih itu sendiri; dan tanpa kepala ini dropdown Majelis berdiri tanpa penjelasan sementara tiap dropdown lain punya.",
      "GARIS PEMISAH DI BAWAH KELOMPOK, bukan di bawah kepala. Kepala bergaris bawah sedangkan dropdown-nya tidak, sehingga garis itu memotong kepala dari dropdown-nya sendiri: Penunjukan Juru Sita tampak menutup blok, dan dropdown Juru sita terbaca milik Penetapan Hari Sidang. Seluruh susunan tampak bergeser satu kolom.",
    ],
  },
  {
    versi: "1.148.0",
    dirilis: "2026-09-15T17:40:00+08:00",
    judul: "Mengganti majelis melepas tanggal sidang majelis lama",
    butir: [
      "Hari sidang tiap majelis berbeda - A Rabu, B Selasa. Tanggal yang dipilih dari daftar hari sidang majelis B tidak ada di daftar majelis A, dan sebelumnya ia jatuh ke jalur tanggal bebas: tetap terpakai, dengan peringatan di luar hari sidang majelis. Peringatannya benar, tetapi tanggal itu bukan pilihan orang - ia sisa.",
      "Yang dipertahankan: tanggal bebas yang sengaja dibuka lewat saklarnya, ruangan sidang, dan juru sita - ketiganya bukan milik majelis.",
    ],
  },
  {
    versi: "1.147.0",
    dirilis: "2026-09-15T16:10:00+08:00",
    judul: "Mengganti majelis menghitung ulang panitera sidang, hari sidang, dan penanda tangan PHS - di mode otomatis juga",
    butir: [
      "DROPDOWN MAJELIS DI MODE OTOMATIS. Yang berubah di sana hanya satu keputusan - majelisnya - dan seluruh turunannya tetap dihitung mesin. Memaksa petugas pindah ke manual untuk itu berarti memaksanya memilih ulang panitera, juru sita, dan hari sidang yang tidak hendak diubahnya.",
      "MENGGANTI MAJELIS MEMUAT ULANG USULAN. Sebelumnya usulan disusun sekali saat papan dibuka; dropdown hanya mengubah pilihan di peramban, sementara panitera sidang, hari sidang, dan penanda tangan PHS tetap milik usulan lama. Pilih Majelis A, keluar Selasa, ditandatangani ketua Majelis B - itulah yang terlihat, dan itulah sebabnya.",
      "Perhitungannya diserahkan ke server, bukan ditiru di peramban: server yang memegang SK, hari sidang tiap majelis, dan beban tiap orang. Meniru sebagian di peramban berarti dua salinan aturan yang perlahan menyimpang.",
      "Pejabat penetap disusun ulang untuk majelis baru - pilihan lama menunjuk ketua majelis yang sudah tidak berlaku. Pilihan manual yang lain - juru sita, tanggal bebas, ruangan - dipertahankan.",
      "Berpindah ke otomatis melepas majelis pilihan dan memuat ulang dari giliran. Saklar yang menyimpan pilihan diam-diam berbohong tentang apa yang akan terjadi.",
      "PHS IKUT DITAWARKAN pada Pejabat yang menetapkan. Dahulu ia satu-satunya langkah tanpa pilihan - ketua majelis dianggap satu-satunya yang sah. Kolamnya sempit dengan sengaja: anggota majelis perkara itu saja, ketua di depan sebagai pilihan otomatis. Membuka seluruh hakim membuat PHS dapat tercatat atas nama hakim yang tidak duduk di majelisnya.",
    ],
  },
  {
    versi: "1.146.0",
    dirilis: "2026-09-15T14:05:00+08:00",
    judul: "Papan penetapan: kode majelis dari SK, sidang keliling di mode otomatis, dan nama berkas yang dapat dibedakan",
    butir: [
      "KODE MAJELIS DARI SK. Susunan yang ditetapkan SK Ketua muncul lebih dahulu beserta kodenya - A, B, C1. Susunan di luar SK tetap dapat dipilih, di bawahnya, TANPA kode dan bertanda \"di luar SK\": kode majelis milik SK, dan menempelkannya pada susunan yang tidak ditetapkan siapa pun membuat laporan per majelis menghitungnya sebagai majelis itu.",
      "PANITERA SIDANG MENURUT SK, beserta kodenya. Sebelum ini pencocokan memakai kode panitera SIPP - dan kode itu tabrakan: empat panitera PA Donggala berbagi kode \"D\" sementara SK membedakannya D, D1, D3, D4, sehingga Majelis A memulangkan empat orang (dua di antaranya panitera majelis lain) dan Majelis B serta C1 memulangkan nol. Kini yang ditunjuk orangnya; kodenya tinggal label yang terbaca.",
      "SIDANG KELILING DI MODE OTOMATIS dan di PENETAPAN MASSAL. Sebelumnya hari dan tempat sidang hanya dapat dipilih di mode manual, sehingga menetapkan sidang keliling menuntut pindah ke manual dan memilih ulang majelis, panitera, dan juru sita - padahal yang hendak diubah cuma tempatnya. Pada penetapan massal hanya TEMPATNYA yang disamakan: tiap majelis punya hari sidangnya sendiri.",
      "Tempat sidang keliling diurut menurut pemakaian sungguhan - Sigi Biromaru 128 sidang sejak 2025, Rio Pakava 40, Sirenja 14, Labuan belum pernah - dan KUA wilayahnya ikut tampil. Urutan abjad menaruh Labuan di atas Sigi Biromaru.",
      "KALENDER HARI SIDANG TIDAK LAGI TERKUNCI. Batas lamanya tanggal usulan, sehingga seluruh tanggal sebelumnya - termasuk hari ini - kelabu dan tidak dapat ditekan. Kini batasnya hari ini, dan jeda minimal menurut SK menjadi peringatan yang dibaca. Kunci yang memaksa petugas kembali mengetik di borang SIPP bukan penjagaan.",
      "Usulan majelis tidak digambar di mode manual, dan kotak merah \"Akan tercatat di SIPP atas nama\" dicabut - ia membaca pilihan bawaan mesin sementara pejabatnya dapat diganti tepat di bawahnya, sehingga ringkasannya dapat menyebut nama yang BUKAN yang akan ditulis. Keterangan penetap kini ikut berubah saat pejabatnya diganti.",
      "ANGKA BEBAN BERHENTI BERDESIMAL - dan berhenti disebut \"perkara\". \"278.5 perkara\" tidak dapat dipahami siapa pun sebab tidak ada setengah perkara; angkanya memang beban berbobot (cerai 1, harta bersama/waris/eksyar 2, lainnya 1,5). Membulatkan saja hanya menyembunyikan desimalnya - yang menyesatkan kata di belakangnya.",
      "NAMA BERKAS UNDUHAN DAPAT DIBEDAKAN. Tiga berkas kini bernomor perkara, berketerangan blangko, dan berjenis - putusan, putusan pdf, anonimisasi. Unduhan dari tombol CETAK milik ABT sendiri, yang selama ini bernama \"download.rtf\", ikut dinamai pekerja latar; hanya nama yang benar-benar umum yang diubah.",
      "\"Bahwa sudah tidak sanggup lagi\" ikut dibuang dari penutup keterangan saksi - bentuk berkata \"sudah\" di tengahnya lolos dari keempat pola lama, dan kalimatnya tetap berdiri di dalam putusan seolah fakta yang dibuktikan.",
    ],
  },
  {
    versi: "1.145.0",
    dirilis: "2026-09-15T10:05:00+08:00",
    judul: "Panel menyingkir dengan Escape, reset kembali ke kanan, dan unduhan tidak lagi diblokir",
    butir: [
      "PANEL MENYINGKIR TANPA MENCARI TOMBOLNYA: tekan Escape, atau klik DUA KALI di luar panel. Tombol ciutnya ada di kepala panel - yang berarti untuk menyingkirkan panel, orang harus lebih dahulu menemukan panelnya. Dua kali, bukan sekali: panel ini dipakai berdampingan dengan halaman di bawahnya, dan menciutkannya pada sentuhan pertama membuatnya hilang berkali-kali dalam satu menit.",
      "Escape TIDAK merebut pembatalan suntingan - kotak isian memakainya untuk membatalkan, dan merebutnya berarti menutup panel sekaligus membuang ketikan orang. Klik ganda DI DALAM panel juga tidak menciutkan; itu memilih kata.",
      "RESET MENGEMBALIKAN PANEL KE KANAN, bukan melompat ke kiri. Bawaannya memang kanan, dan membersihkan gaya sebaris seharusnya cukup - nyatanya tidak: panel yang pernah digeser sudah dijangkarkan ulang ke kiri, dan pada halaman yang aturan CSS-nya bertumpuk jangkar kanan tidak selalu menang kembali. Kini posisinya dituliskan sendiri, sama hasilnya di SIPP, ABT, dan halaman ALETA.",
      "SUNTING SEKALI KLIK DI ABT DAPAT DIMATIKAN - dan bawaannya MATI. Satu klik salah sasaran pada baris yang sedang dibaca membuka kotak isian di atas nilai yang benar, dan halaman ABT adalah tempat naskah putusan disusun. Saat mati, nilainya tetap dapat disunting lewat tombol Sunting pada barisnya: satu tekanan lebih panjang, dan tekanan itulah yang menyatakan kehendak.",
      "UNDUHAN TIDAK LAGI DIBLOKIR CHROME. \"Chrome blocked this download because the site isn't using a secure connection\" - SIPP dan ABT berjalan di http, jadi seluruh putusan, anonimisasi, dan PDF jatuh ke sana: tercoret di riwayat unduhan, dan tiap berkas harus dipaksa satu per satu. Alamat blob tidak menolong sebab ia mewarisi asal halamannya; kini unduhannya diterbitkan ekstensi, yang asalnya tepercaya.",
      "Berkasnya tidak melintasi jaringan lagi - ia sudah ada di memori peramban, diambil lewat permintaan yang sama yang dipakai panel untuk membacanya. Yang berpindah hanya siapa yang menuliskannya ke cakram. Bila jalur itu gagal, ia jatuh ke cara lama: unduhan yang tertahan peringatan masih jauh lebih baik daripada unduhan yang tidak terjadi. Perbaikan yang sesungguhnya tetap HTTPS di peladen.",
    ],
  },
  {
    versi: "1.144.0",
    dirilis: "2026-09-15T09:22:00+08:00",
    judul: "Ruang sidang dapat dipilih pada Penetapan Hari Sidang - termasuk sidang keliling",
    butir: [
      "PENETAPAN HARI SIDANG SELALU MENULIS \"RUANG SIDANG 1 DALAM GEDUNG\", apa pun perkaranya. Ruangannya dipatok pada mesin tulis, dan tidak ada satu pun layar yang menawarkan pilihan. Akibatnya penetapan untuk sidang keliling menulis ruangan yang keliru DAN kolom sidang_keliling nol - sedangkan penetapannya berhasil, berkasnya tercetak, dan sidangnya digelar.",
      "Gagal yang paling mahal adalah yang tidak berbunyi: yang menyadarinya baru penyusun laporan tahunan, ketika sidang keliling terhitung nol. Diukur di PA Donggala untuk sidang 2025-2026: 459 sidang digelar di luar gedung - 180 sidang keliling dan 279 pelayanan terpadu.",
      "Kini ruangannya dipilih di papan penunjukan, berdampingan dengan hari sidang. Tiap barisnya menyebut sifatnya sendiri - Dalam gedung, Sidang keliling, atau Sidang terpadu - sebab yang memilih membaca satu baris, bukan judul kelompok tiga baris di atasnya.",
      "SIDANG TERPADU DIPISAH DARI SIDANG KELILING, dan SIPP sendiri yang memisahkannya: keempat ruangan Terpadu berbendera sidang_keliling = 0. Aturan nama semata akan menyatukan keduanya - 115 sidang setahun - dan membuat laporan sidang keliling melebih-lebihkan dirinya.",
      "Bendera SIPP saja tidak cukup: 2.140 sidang memakai ruangan yang TIDAK terdaftar di ruangan_sidang sama sekali, termasuk \"Ruang Sidang 1\" yang paling banyak dipakai. Sifatnya karena itu ditentukan dari bendera DAN namanya, dengan bendera yang menang bila keduanya ada.",
      "Tanpa memilih, perilakunya persis seperti semula - mesin tulis memakai bawaannya sendiri.",
    ],
  },
  {
    versi: "1.143.0",
    dirilis: "2026-09-15T08:58:00+08:00",
    judul: "Ukuran huruf lipatan pasal memenuhi dasar terkecil panel",
    butir: [
      "Bunyi pasal yang dilipat pada 1.141.0 ditulis 11px - setengah piksel di bawah dasar terkecil panel (11,5px). Di layar kantor selisih itu terbaca sebagai tulisan yang samar, dan ia satu-satunya ukuran di seluruh panel yang di bawah ambang.",
      "Ketahuannya bukan dari melihat melainkan dari penjaga yang menyisir SELURUH ukuran huruf panel sekaligus - satu yang tertinggal tidak pernah disadari yang memeriksanya, sebab yang dilihatnya panel yang sebagian besar sudah benar.",
    ],
  },
  {
    versi: "1.142.0",
    dirilis: "2026-09-15T08:08:00+08:00",
    judul: "Kepala panel ABT disamakan dengan SIPP dan ALETA",
    butir: [
      "LOGO DI KEPALA PANEL ABT, seperti panel SIPP dan halaman ALETA. Diukur pada berkasnya: konten.js memakai penanda logo dua kali, aleta.js sekali, abt.js NOL - dan itulah satu-satunya beda yang nyata di antara ketiga kepala panel. Panel ini melayang di atas halaman milik aplikasi lain dan tampilannya menyerupai bagian aplikasi itu sendiri; logo membuat asalnya terbaca sekilas tanpa perlu membaca tulisan apa pun.",
      "Dipasang pada KEDUA panel ABT - panel perkara dan panel putusan massal - sebab keduanya dibuka berdampingan dan kepala yang berbeda-beda membuat satu ekstensi terasa tiga aplikasi.",
      "Bila berkas ikonnya tidak terbaca, logonya melepas diri dan kepalanya tetap utuh. Kepala tanpa logo masih kepala; kepala yang gagal dibangun tidak.",
    ],
  },
  {
    versi: "1.141.0",
    dirilis: "2026-09-14T21:31:54+08:00",
    judul: "Jadwal sidang 50x lebih cepat, dan panel ABT yang dirapikan",
    butir: [
      "\"aleta_bot tidak merespons dalam 8000ms\" BUKAN BOT YANG MATI - BOT YANG LAMBAT. Diukur: tiap permintaan jadwal sidang memakan 11-14 detik, sedangkan panel menyerah pada 8 detik, jadi daftarnya tidak pernah sekali pun terisi. Datanya selalu ada di sana.",
      "SEBABNYA SATU VIEW. Pencarian pihak lewat v_pihak_perkara - UNION berpembeda dari perkara_pihak1..5 dengan subkueri berkorelasi - memaksa basis data membentuk SELURUH view sebelum saringan \"perkara_id IN (...)\" dapat berlaku. Untuk 20 perkara: 8.563 ms lewat view, 413 ms langsung ke tabelnya. Kueri mentah jadwalnya sendiri hanya 0,45 detik; yang lambat bukan datanya, melainkan saringan yang tidak pernah sampai ke tabel.",
      "Sekarang 138-260 ms. Yang diganti HANYA jalur jadwal sidang; notifikasi dan laporan lain memakai view yang sama di puluhan tempat dengan kolom yang jauh lebih banyak, dan menyentuhnya sekaligus menukar satu kelambatan yang terukur dengan risiko yang tidak terukur.",
      "URUTAN PIHAK JADI TETAP, DAN ITU TEMUAN TERSENDIRI. View lama dijalankan dua kali atas data yang sama memulangkan urutan yang BERBEDA - terukur 22 kali pada 210 daftar pihak. Yang dipakai sekarang urutan milik SIPP sendiri: Tergugat I, II, III, bukan abjad yang kebetulan. Diperiksa atas 70 sidang: tidak satu pun nama hilang atau bertambah.",
      "PEMETAAN BLANGKO KELUAR DARI POPUP. Popup dibuka dari bilah ekstensi dan selebar kartu nama; tabel belasan baris di dalamnya mendorong saklar harian - nyalakan ALETA, tandai halaman SIPP, cetak tiga berkas - jauh ke bawah gulungan. Lagi pula tokennya hanya dapat dipanen dari halaman ABT, jadi yang disunting di popup selalu setengah pekerjaan. Seluruhnya pindah ke panel PUTUSAN MASSAL; pemetaan yang sudah ada tetap terbaca apa adanya.",
      "BARIS PEMETAAN YANG SUDAH SELESAI DISEMBUNYIKAN, dan bila seluruhnya selesai bagiannya menyingkir menyisakan tombol \"Pemetaan ulang\". Pemetaan adalah pekerjaan sekali jadi - ia tidak perlu dipandangi setiap hari sambil mendorong pekerjaan harian ke bawah layar. Angkanya selalu disebut: bagian yang hilang tanpa keterangan terbaca sebagai kerusakan.",
      "KAKI PANEL PUTUSAN MASSAL disamakan dengan panel SIPP, ALETA, dan perkara ABT - baris pintasan (Alt+A, Alt+P, Alt+R, Alt+Enter), ikon segarkan, dan nomor seri. Nomor seri di sini bukan hiasan: ketika ada yang melapor, pertanyaan pertama selalu seri berapa yang terpasang.",
      "TOMBOL MENYEBUT PEKERJAANNYA BESERTA OBJEKNYA: \"Susun dari keterangan saksi\" tidak pernah menyebut apa yang disusun, dan \"Riwayat perubahan\" adalah kata benda yang tidak mengaku sebagai tombol. Kini \"Isi blangko dari SIPP\", \"Susun posita dari keterangan saksi\", \"Susun keterangan saksi 1 & 2\", \"Lihat riwayat perubahan\", \"Rapikan posita & keterangan saksi\".",
      "\"Alasan yang TIDAK masuk 5227\" MENYEBUT NOMOR VARIABEL, bukan pekerjaan - dan hanya memuat yang gagal, sehingga pembacanya tidak pernah tahu apa yang sudah siap. Kartunya kini bernama \"Alasan perceraian - yang siap dipakai dan yang belum\", membuka dengan alasan yang SUDAH terbukti dua saksi dan didalilkan, lalu ditutup satu kalimat saran. Sarannya membedakan dua hal yang menuntut tindakan berlawanan: yang di luar gugatan JANGAN dipakai, yang belum terbukti justru harus tetap diadili.",
      "BUNYI PASAL DILIPAT. Tiap huruf alasan membawa dua kutipan penuh beserta catatan selisih naskahnya; untuk tiga huruf itu enam paragraf yang sudah dihafal siapa pun yang mengerjakannya, dan ia mendorong tombol \"Tuliskan huruf alasan\" keluar dari layar. Nama pasalnya tetap terbaca pada ringkasan - yang dilipat hanya bunyinya.",
    ],
  },
  {
    versi: "1.140.0",
    dirilis: "2026-09-14T20:51:27+08:00",
    judul: "Alamat portal dicatat dari setiap halaman, bukan hanya SIPP",
    butir: [
      "POPUP MENULIS \"portal tidak terjangkau\" PADAHAL PORTALNYA SEHAT. Popup berjalan di origin chrome-extension:// dan tidak punya cara sendiri mengetahui alamat portal - ia memakai alamat yang dicatatkan skrip konten. Yang mencatat hanya skrip halaman SIPP, dengan alasan \"ia yang berjalan di halaman SIPP\" - padahal ABT dan halaman ALETA berdiri di origin YANG SAMA dan sama-sama tahu.",
      "Akibatnya menimpa orang yang paling sering memakainya: petugas yang seharian di ABT tidak pernah membuka SIPP, jadi popupnya memakai alamat yang tercatat entah kapan. Sesudah pindah peladen, alamat itu menunjuk mesin yang sudah mati - dan yang terbaca di layar adalah tuduhan kepada portal, bukan keterangan tentang alamat yang basi.",
      "Pencatatnya pindah ke perkakas bersama dan kini dipanggil dari KETIGA halaman: SIPP, ABT, dan halaman ALETA sendiri. Tetap tanpa izin \"tabs\" - izin itu memberi ekstensi kemampuan membaca alamat SELURUH tab peramban, jauh lebih luas daripada yang dibutuhkan untuk satu alamat yang halamannya sendiri sudah tahu.",
    ],
  },
  {
    versi: "1.139.0",
    dirilis: "2026-09-14T20:31:46+08:00",
    judul: "Menu cerai talak benar-benar berlaku - 1.138.0 belum memperbaikinya",
    butir: [
      "1.138.0 MENYEBUT MENUNYA TETAPI TIDAK PERNAH MEMAKAINYA. Pencarian token memeriksa satu kelompok pada satu waktu, dan pencocoknya memulangkan \"berkas senama\" bila menu yang diminta tidak ada DI KELOMPOK ITU. Karena Cerai Gugat dipindai lebih dahulu, jawabannya keluar di sana dan Cerai Talak tidak pernah tersentuh - persis kelakuan sebelum 1.138.0, dengan kode yang tampak sudah diperbaiki.",
      "Cadangan itu kini dipegang yang MEMINDAI SELURUH KELOMPOK, bukan yang melihat satu. Menu yang diminta menang di mana pun ia berada; berkas senama di menu lain hanya dipakai sesudah seluruh ABT dilihat dan menu itu memang tidak ada.",
      "SATU MENU, DUA NAMA - dan sebelumnya hanya satu yang dikenali. ABT menulis \"Putusan Cerai Talak\" pada judul halaman kelompok (dari sanalah token dipanen dan nama itulah yang tersimpan) tetapi \"Putusan CT\" pada bilah kiri (dari sanalah urutan pencarian disusun). Keduanya kini didaftar; menyebut satu saja membuat separuh kodenya diam-diam tidak pernah cocok.",
      "HALAMAN YANG KEBETULAN TERBUKA BUKAN JAWABAN. Bila menunya disebut, blangko yang tergambar di halaman ABT yang sedang Anda buka hanya dipakai kalau halaman itu memang menu tersebut - kalau tidak, pencarian tetap berjalan.",
      "PEMULIHAN BARIS BERHENTI SESUDAH SEKALI. Baris yang SAH mendarat di menu lain - karena ABT di hadapan Anda memang tidak punya menu itu - kini diingat menu apa yang DIMINTA, bukan hanya menu tempat tokennya ditemukan. Tanpa itu ia dianggap keliru pada setiap pemuatan: token dilepas, seluruh ABT dipindai ulang, hasilnya sama, dilepas lagi - panel yang selalu sibuk tanpa satu pun sebab yang terlihat.",
    ],
  },
  {
    versi: "1.138.0",
    dirilis: "2026-09-14T20:12:30+08:00",
    judul: "Cerai talak diambil dari menu cerai talak - nama berkas tidak membedakannya",
    butir: [
      "CERAI TALAK SELAMA INI MENGAMBIL BLANGKO DARI MENU CERAI GUGAT, dan tidak ada satu pun galat yang berbunyi. Sebabnya: pencarian token bekerja atas NAMA BERKAS, dan \"[01] [Kabul Verstek] Cerai (Format Lengkap).rtf\" ADA DI KEDUA folder - \"1 Perceraian CG\" dan \"1a Perceraian CT\". Diukur pada blangko peladen: keduanya identik sampai bita terakhir (143.721 bita, md5 sama). Di ABT menu Cerai Gugat berdiri lebih dahulu, jadi talak selalu mendarat di sana.",
      "Isinya kebetulan sama, jadi yang keluar bukan putusan yang salah - tetapi menu Cerai Gugat TIDAK MEMUAT SATU PUN berkas khas talak. Selama barisnya tertambat ke sana, \"[01a] [Kabul Verstek] CT - F (Ex Offiicio mutah iddah dan nafkah anak)\", \"[02] [Kabul] CT - F\", \"[02] [Kabul] [Rekonvensi] CT - F\", dan \"[02a] [Kabul] CT - T Tidak Hadir Setelah Mediasi - F\" tidak dapat dipilih sama sekali untuk perkara cerai talak.",
      "Kini baris pemetaan dapat MENYEBUT MENUNYA, dan pencarian token menghormati sebutan itu: menu yang diminta dicari lebih dahulu, dan di antara berkas yang senama yang berada di menu itulah yang dipakai. Bawaan cerai gugat menunjuk \"Putusan Cerai Gugat\", cerai talak menunjuk \"Putusan Cerai Talak\".",
      "BARIS BAWAAN YANG TERLANJUR TERTAMBAT KE MENU KELIRU DILEPAS TOKENNYA dan diambil ulang dari menu yang benar - tanpa mengubah nama berkasnya, sebab yang keliru menunya, bukan berkasnya. Hanya baris bawaan: yang pernah Anda sunting sendiri tidak dibatalkan diam-diam, sebab menautkan talak ke menu gugat bisa saja memang kehendak Anda.",
      "Bila menu yang diminta tidak ada di ABT tempat Anda bekerja, barisnya tetap terisi dari menu lain - dan catatannya menyebutkan kedua nama itu, bukan mendiamkannya.",
    ],
  },
  {
    versi: "1.137.0",
    dirilis: "2026-09-14T19:44:51+08:00",
    judul: "Nama jenis perkara SIPP dipadankan - 431 perkara yang selama ini dilewati",
    butir: [
      "SIPP MENAMAI JENIS PERKARA DENGAN KATA YANG LAIN, dan pemetaan blangko berkunci nama itu apa adanya. Diukur atas SIPP PA Donggala untuk perkara sejak 2025: \"Pengesahan Perkawinan/Istbat Nikah\" 403 perkara (kunci kita \"itsbat nikah\"), \"P3HP/Penetapan Ahli Waris\" 26, \"Izin Poligami\" 1, dan \"Wali Adhol\" 1 - yang terakhir bukan singkatan melainkan EJAAN dari \"Wali Adhal\". Empat ratus tiga puluh satu perkara, dan yang pertama adalah jenis KEDUA TERBANYAK di pengadilan ini.",
      "Seluruhnya dilewati putusan massal dengan alasan \"blangko belum dipetakan\" - kalimat yang benar menurut kodenya dan menyesatkan menurut kenyataannya: blangkonya sudah dipetakan, hanya di bawah nama lain. Kini keempatnya menunjuk kunci yang sama.",
      "PEMETAAN LAMA YANG BERKUNCI NAMA LAIN DIGABUNG, BUKAN DITINGGALKAN. Baris yang pernah Anda sunting dengan kunci lama akan tetap terpakai; yang menang saat keduanya ada adalah yang pernah disunting, lalu yang sudah punya token. Baris yang hilang diam-diam adalah kehilangan pekerjaan orang, bukan pembersihan.",
      "Nama lain yang menunjuk satu baris disebut pada judul barisnya, supaya yang mencari \"Pengesahan Perkawinan/Istbat Nikah\" menemukannya dan tidak menyimpulkan jenisnya belum didukung.",
      "Daftar padanannya ditulis satu per satu dan tiap tambahan harus datang dari nama yang BENAR-BENAR ada di SIPP - aturan umum yang menyatukan ejaan akan ikut menyatukan jenis yang memang berbeda.",
    ],
  },
  {
    versi: "1.136.0",
    dirilis: "2026-09-14T15:10:00+08:00",
    judul: "Token blangko yang terbuang, warna SIPP yang tertinggal, dan daftar putusan massal yang dapat dicari",
    butir: [
      "TOKEN BLANGKO TIDAK LAGI DIBUANG PENJAGANYA SENDIRI. \"7 token terisi, 7 berkas tidak ditemukan\" - angka yang sama dua kali, dan itu memang satu peristiwa: ketujuh berkasnya KETEMU, lalu tokennya dihapus sebelum disimpan. Penjaga lamanya menuntut token hanya berisi [A-Za-z0-9+/=_%.-], padahal token ABT hasil enkripsi CodeIgniter kerap memuat \"~\". Diukur atas empat tautan blangko sungguhan di server: TIGA memuat \"~\", jadi tiga dari empat dibuang diam-diam. Sekarang yang ditolak hanya yang memang tidak mungkin token - kosong, terlalu pendek, berspasi, atau memuat huruf yang mematahkan tautan.",
      "SIPP IKUT WARNA DARI POPUP, seperti ABT. Tema gelap/terang sudah diikuti sejak lama, tetapi WARNA paletnya tidak: panel ABT mendapatkannya lewat alatPasangPanel, sedangkan panel SIPP dibangun sendiri dan tidak pernah memanggilnya. Yang terbaca dari situ bukan \"belum tersambung\" melainkan \"popupnya tidak berlaku untuk SIPP\".",
      "WARNA SATU HALAMAN DAPAT DILEPAS DARI POPUP - tombol baru di sebelah ⟲ pada kepala panel. SIPP, ABT, dan halaman ALETA kerap terbuka berdampingan, dan yang bekerja di antaranya perlu tahu sekilas sedang menatap yang mana. Yang dilepas menyimpan warnanya atas nama panelnya sendiri dan tidak lagi tersentuh popup; keadaannya disebut pada judul tombol, bukan didiamkan.",
      "PUTUSAN MASSAL DAPAT DICARI, DISARING, DAN DIURUTKAN. Cari nomor/jenis/agenda; saring semua, belum putus, sudah putus, blangko siap, blangko belum, atau yang dicentang saja; urutkan menurut agenda putusan, nomor, jenis, atau keadaan. Bawaannya AGENDA PUTUSAN DAHULU - pada tanggal sidang mana pun hanya sebagian yang hendak diputus, dan agendanya satu-satunya petunjuk sebelum berkas dibuka. Ia urutan, bukan saringan: agenda tidak dapat dipercaya sebagai penentu, jadi yang lain tetap tergambar di bawah.",
      "YANG TERCENTANG TIDAK HILANG KARENA DISARING. Saringan mengubah yang terlihat, bukan yang terpilih - dan berapa yang tercentang tetapi tidak terlihat DISEBUT di atas daftar, sebab menekan Jalankan sesudah menyaring tanpa keterangan itu akan mengerjakan perkara yang tidak ada di layar.",
      "BAHASA: lencana \"PELADEN\" menjadi \"SERVER\", dan \"Susun rencana (kering)\" menjadi \"Periksa dulu - belum dijalankan\". \"Kering\" istilah pemrogram; yang menekannya panitera, dan yang perlu dijawab tombol itu satu - apakah menekannya mengubah sesuatu atau tidak.",
    ],
  },
  {
    versi: "1.135.0",
    dirilis: "2026-09-14T12:15:00+08:00",
    judul: "Bawaan blangko dispensasi kawin diperbaiki menurut peladen",
    butir: [
      "DISPENSASI KAWIN -> \"[01] [Kabul] DK - (Anak P Cewek) Hamil\". Bawaan sebelumnya \"DK (Full) Perempuan Hamil V.2\" adalah nama dari ABT setempat (salinan PA Bungku) dan sejak hari pertama ditandai \"periksa namanya di peladen\". Diperiksa langsung di folder blangko peladen 14 September 2026: nama itu tidak ada di sana sama sekali, jadi putusan massal dispensasi akan berhenti pada \"berkas tidak ditemukan\" tanpa ada yang tahu sebabnya. Kini namanya yang sungguh ada di peladen.",
      "ADA DUA VARIAN KABUL yang berdampingan di peladen: anak perempuan yang hamil, dan anak laki-laki yang calon istrinya hamil. Keduanya jenis perkara yang SAMA di SIPP, jadi bawaan hanya dapat menyebut satu - yang lain dipilih per perkara lewat pilihan blangko pada daftar putusan massal. Catatan pemetaan menyebutkan nama varian satunya supaya tidak perlu dicari sendiri di ABT.",
      "Bawaan cerai dan itsbat diperiksa pada folder yang sama dan keduanya sudah tepat - tidak diubah.",
    ],
  },
  {
    versi: "1.134.0",
    dirilis: "2026-09-14T09:07:25+08:00",
    judul: "Praperiksa putusan: agen yang membaca SIPP dan berhenti bila bertentangan",
    butir: [
      "PRAPERIKSA SEBELUM MENGISI. Tepat sebelum borang Putusan Akhir diisi dari draf ALETA - di panel maupun di putusan massal - agen membaca fakta SIPP dan mengadunya: tanggal putusan yang diketik harus hari sidang perkara itu (1.643 dari 1.643 putusan 2025-2026 begitu); kata kerja amar harus berpadanan dengan Status Putusan yang dipilih (1.642 dari 1.643 - yang satu memang keliru); nama bin/binti di amar harus pihak atau anak perkara ini; majelis yang disebut naskah harus majelis yang ditetapkan; perkaranya belum putus. Yang bertentangan MENAHAN: tombol Isikan mati, putusan massal menandai perkara itu 'ditahan praperiksa' dan tidak mengisinya. Tidak ada yang diperbaiki sendiri - agen ini membaca, orang yang memutuskan.",
      "PERHATIAN DAN CATATAN. Yang tidak dapat dipastikan mesin - petitum yang tampak belum terjawab, verstek yang tidak disebut amar, pihak e-Court yang ejaannya berbeda, akhir pekan dan hari libur - hanya perhatian. Yang tidak dapat diperiksa disebut sebagai catatan: rapor yang diam tentang yang dilewatinya akan dibaca sebagai lolos. Bot yang mati pun disebut: 'praperiksa TIDAK dijalankan' - bukan rapor kosong.",
      "PENDAPAT AI, DISAMARKAN, TIDAK PERNAH MENAHAN. Bila pemeriksaan pasti lolos dan jalur AI 'isi perkara' sudah disetel di Pengaturan AI, amar dan petitum disamarkan dahulu dengan kamus pihak SIPP lalu diminta pendapatnya; hasilnya perhatian. Bila jalurnya belum disetel, rapor menulis 'pendapat AI dilewati' beserta sebabnya.",
      "Tetap mengisi meski ditahan tetap dapat dipilih di panel - lewat kotak centang yang bunyinya jelas - dan Simpan TIDAK ditekan sendiri: keputusan itu milik petugas, termasuk menekan Simpan. Di antrean massal tidak ada jalan pintas itu: yang ditahan dibiarkan untuk dibuka orang.",
    ],
  },
  {
    versi: "1.133.0",
    dirilis: "2026-09-13T19:43:08+08:00",
    judul: "Pemetaan blangko diisi sendiri dari pohon blangko portal",
    butir: [
      "ISI DARI POHON BLANGKO. Portal sudah tahu set blangko mana untuk jenis perkara apa (SET_BLANGKO), dan bot sudah dapat membaca isi foldernya di peladen. Rute baru /aleta-ecourt/blangko/pohon menyatukan keduanya: untuk tiap jenis, ia menjenjangkan berkas set putusannya menurut skenario akhir dan mengusulkan satu bawaan - berkas skenario KABUL, yang kode terpendek (\"[01]\" mendahului \"[01b]\"). Satu tombol di popup super admin dan di panel ABT menuangkannya ke tabel pemetaan, jadi jenis lain tidak perlu diketik satu per satu.",
      "YANG DIKETIK TANGAN TIDAK DISENTUH. Hanya baris kosong, bawaan, atau yang sebelumnya bersumber pohon yang diisi; baris yang pernah Anda sunting menang, kecuali diminta menimpa. Berkas dari pohon adalah nama yang sama persis dengan yang dirender ABT, jadi tokennya langsung dicari di halaman ABT sesudah nama terisi - satu tekanan, dua pekerjaan.",
      "Kotak ketik nama di popup maupun panel ABT kini menyodorkan nama-nama dari pohon sebagai pilihan (datalist), lengkap dengan set dan kategorinya. Usulan hanya bawaan: tiap perkara di daftar massal tetap dapat memilih blangkonya sendiri.",
    ],
  },
  {
    versi: "1.132.0",
    dirilis: "2026-09-13T18:32:49+08:00",
    judul: "Bawaan pemetaan blangko: itsbat nikah dan dispensasi kawin menyusul cerai",
    butir: [
      "ITSBAT NIKAH -> \"[01] [Kabul] IN\" - seri peladen yang sama dengan blangko cerai, dikenal kode sejak korpus blangko dipelajari. Bernama saja; tokennya diambil panel ABT di peladen, seperti cerai.",
      "DISPENSASI KAWIN -> \"DK (Full) Perempuan Hamil V.2\" - nama seri peladennya belum dikenal kode ini, jadi diisi nama ABT setempat yang paling lazim dan DITANDAI catatannya di popup maupun panel: periksa namanya di peladen. Bila tidak ketemu di sana, panel menyebutnya apa adanya dan namanya tinggal disunting - tidak ada yang ditebak diam-diam.",
      "Otomatisasi itsbat dan dispensasi yang lama - empat belas variabel dari posita, alasan dispensasi, unggah naskah penetapan - tidak disentuh; ini hanya melengkapi tabel putusan massal.",
    ],
  },
  {
    versi: "1.131.0",
    dirilis: "2026-09-13T17:45:29+08:00",
    judul: "Putusan massal: dari jadwal sidang ke ABT, ke SIPP, dan pemetaan blangko yang dapat disunting",
    butir: [
      "PUTUSAN MASSAL DI ABT. Di halaman beranda blangko ABT ada panel baru: pilih tanggal sidang (hari ini bawaannya), ALETA menyodorkan seluruh perkara yang bersidang pada tanggal itu beserta jenis, agenda, dan sudah-belumnya putus. Tidak ada yang tercentang sendiri - agenda sidang tidak dapat dipercaya sebagai penentu, jadi yang memutuskan orang. Tekanan pertama menyusun RENCANA (kering); menjalankan menuntut tekanan kedua. Tiap perkara berdiri sendiri: RTF dari ABT, draf ke ALETA, PDF, anonimisasi, PDF anonim, dan bila diminta secara sadar, unggah dokumen ke SIPP. Satu yang gagal dicatat sebabnya, sisanya jalan terus.",
      "LANJUTAN KE SIPP - OTOMATIS ATAU MANUAL. Sesudah tahap ABT, antrean diserahkan ke SIPP lewat penyimpanan ekstensi (tab ABT dan tab SIPP beda asal). Di SIPP, bagian Putusan massal memandu perkara demi perkara: otomatis mengisi dan menyimpan begitu borang putusannya terbuka; manual berhenti di tiap perkara supaya diperiksa dahulu. Tersimpannya dibuktikan dari SIPP, bukan dari tombol yang berhasil ditekan; yang sudah putus tidak pernah diisi ulang.",
      "ANTREAN SIPP LANGSUNG DARI TANGGAL SIDANG. Bagi perkara yang drafnya sudah ada di ALETA, panel daftar perkara SIPP dapat menyusun antreannya sendiri dari tanggal sidang tanpa lewat ABT. Draf tiap perkara diperiksa lebih dulu; yang belum punya draf disebut apa adanya dan tidak dapat dicentang - bukan dijanjikan lalu gagal di tengah.",
      "PEMETAAN BLANGKO MENURUT NAMA, DAPAT DISUNTING. Jenis perkara → nama berkas blangko ABT. Token a/b (hasil enkripsi ABT) hanya dapat dibaca dari halaman ABT yang terbuka, jadi pemetaan cukup menyebut NAMA-nya; panel ABT mengambil tokennya sendiri dengan menyusuri kelompok blangko, lalu menyimpannya. Nama juga lebih tahan lama daripada token: kunci ABT yang berganti mematikan seluruh token diam-diam, nama berkasnya tidak. Disunting di popup ekstensi (super admin) maupun di panel ABT - ketik nama, pilih dari halaman, atau Ambil token dari ABT. Bawaan cerai dahulu: Cerai Gugat dan Cerai Talak → [01] [Kabul Verstek] Cerai (Format Lengkap); jenis lain menyusul sesudah tersambung ke peladen.",
      "BLANGKO KHUSUS PER PERKARA. Verstek dan contra adalah dua berkas berbeda untuk satu jenis perkara yang sama, jadi tiap baris perkara di daftar massal punya pilihan blangkonya sendiri yang menang atas pemetaan jenisnya.",
      "Catatan di SIPP tetap seperti SIPP menulisnya - rancangan sejak 1.106.0; riwayat lengkap tiap langkah, termasuk yang gagal, ada di kotak hitam dan Riwayat ALETA.",
    ],
  },
  {
    versi: "1.130.0",
    dirilis: "2026-09-13T14:58:03+08:00",
    judul: "Tema gelap yang benar-benar berganti dan tidak tersendat, halaman login ikut palet, dan tulisan dasbor yang tidak terbaca",
    butir: [
      "TEMA IKUT SEKETIKA DI SELURUH TAB. Sebelumnya tombol tema hanya mengubah tab tempat ia ditekan. Petugas lazim membuka SIPP di tiga tab - daftar perkara, detail, jadwal sidang - lalu mengganti tema di salah satunya dan melihat dua tab lain tetap seperti semula sampai dimuat ulang. Yang terbaca dari situ bukan \"berlaku per tab\", melainkan \"saklarnya tidak berfungsi\". chrome.storage.onChanged sampai ke semua tab tanpa izin tambahan, dan kini tema maupun palet berlaku di semuanya seketika.",
      "PERGANTIAN TEMA TIDAK LAGI TERSENDAT. Yang lambat bukan penghitungan gayanya - itu beberapa milidetik - melainkan TRANSISI: SIPP, AdminLTE, dan Bootstrap memasang transition pada ratusan elemen, sehingga satu tekanan tombol menyalakan ratusan animasi warna serentak. Selama pergantian seluruh transisi dimatikan selama dua bingkai gambar, lalu dikembalikan. Tombolnya pun tidak lagi menunggu penyimpanan: penanda dipasang lebih dahulu, chrome.storage menyusul - menunggu panggilan lintas proses membuat tekanan terasa tidak menghasilkan apa-apa, dan yang menekannya menekan sekali lagi, yang justru mengembalikannya.",
      "PANEL TIDAK LAGI MEMAKSA HITUNG ULANG TATA LETAK TIAP GERAKAN KURSOR. Bilah gulir 1.129.0 membaca letak tepi panel di dalam pointermove - getBoundingClientRect memaksa peramban menghitung ulang tata letak saat itu juga, puluhan kali per detik. Di atas halaman SIPP yang tabelnya ribuan sel, itu cukup membuat seluruh halaman terasa berat. Sekarang paling banyak sekali per bingkai gambar.",
      "HALAMAN LOGIN IKUT PALET. Kartu loginnya sudah diberi warna palet sejak lama dan tetap hijau di layar: login.css menimpanya dengan GRADASI, dan gradasi adalah gambar latar yang dicat di atas warna latar. Yang harus dibuang gambarnya. Tombol Login yang kuning cerah - satu-satunya bidang paling terang di seluruh halaman gelap, tepat pada tombol yang ditekan setiap pagi - dan medan isian bertulisan kuning ikut diperbaiki.",
      "CAP AIR NOMOR VERSI BUKAN KAKI HALAMAN. .version_shading dulu disamakan dengan #footer dan diberi warna paling gelap. Ia duduk DI DALAM bilah atas dan isinya hanya satu label berhuruf 190 piksel beralfa 0,1 - sebuah cap air. Diberi latar sendiri, ia menjadi kotak hitam selebar 300 piksel yang menganga di tengah bilah berwarna, dengan angka versi separuh terpotong.",
      "TULISAN DASBOR YANG TIDAK TERBACA. Diukur pada replika dasbor, bukan ditaksir dari tangkapan layar: daftar RASIO BEBAN PERKARA memakai .text-black milik AdminLTE - hitam di atas latar hampir hitam, 1,15 : 1, bukan sulit dibaca melainkan TIDAK terbaca, sehingga daftarnya tampak kosong padahal isinya lengkap. Angka dasbor <font color=red> 1,12 : 1 dan <font color=blue> 1,92 : 1. Ketiganya kini 7,9 : 1 ke atas di ketujuh palet, dengan merah tetap merah dan biru tetap biru - keduanya membedakan kolom, jadi artinya tidak diratakan. Judul kotaknya sendiri ternyata sudah 11,79 : 1 dan memang tidak perlu disentuh, walau di tangkapan layar sama-sama tampak suram.",
    ],
  },
  {
    versi: "1.129.0",
    dirilis: "2026-09-13T13:30:00+08:00",
    judul: "Tujuh perkakas super admin, dan bilah gulir yang benar-benar dapat ditekan",
    butir: [
      "LENCANA LINGKUNGAN. SIPP di komputer sendiri dan SIPP di peladen tampilannya sama persis - basis datanya memang salinan - dan satu-satunya pembeda ada di bilah alamat, bagian layar yang paling jarang dibaca saat bekerja. Sekarang lencana LOKAL atau alamat asing berdiri paling kiri di kepala panel. Di peladen, petugas biasa TIDAK melihat apa-apa: di sanalah tempat yang benar, dan tulisan yang selalu ada berhenti dibaca. Super admin melihat keduanya, sebab ia yang berpindah-pindah.",
      "MODE KERING. Satu saklar: coba semuanya, jangan simpan apa pun. Batasnya dipilih dengan sengaja - MEDAN TETAP DIISI, sebab justru isian itulah yang ingin diperiksa, dan mengisi medan tidak mengubah apa pun di basis data SIPP. Yang ditahan hanya dua hal yang benar-benar mengubah data: penekanan tombol Simpan milik SIPP, dan pengiriman tulis ke ALETA. Panel bergaris putus-putus kuning selama mode ini menyala, sebab mode kering yang terlupa membuat tiap tombol tampak rusak.",
      "PAPAN KESEHATAN. Sepuluh pertanyaan yang biasanya dijawab dengan membuka SSH dan membaca log: portal menjawab tidak, berapa lama, versi yang berjalan sama dengan yang disajikan portal, mode kering menyala tidak, berapa permintaan gagal berturut-turut, penunjuk halaman masih ketemu semua. Dijawab dari apa yang memang sudah diketahui panel, dengan satu bacaan ringan.",
      "KOTAK HITAM. Lima puluh kejadian terakhir - tiap permintaan beserta status dan lamanya, tiap perintah ke halaman SIPP, tiap galat - disimpan apa adanya, BUKAN sesudah diterjemahkan untuk petugas. \"Server ALETA tidak terjangkau\" pernah berarti galat basis data karena satu bita kosong di dalam berkas RTF; terjemahan yang benar untuk petugas itu menyesatkan yang memperbaiki. Selamat dari muat ulang halaman, dan satu tombol menyalin semuanya untuk ditempel.",
      "RIWAYAT TINDAKAN DAN JALAN PULANGNYA. Sebelum satu medan diisi, nilai lamanya dibaca lebih dulu - satu perjalanan tambahan ke jembatan, dan dari situlah tombol Pulihkan menjadi mungkin. Yang TIDAK dapat dipulihkan disebut apa adanya: penekanan Simpan, unggahan, penetapan yang sudah terbit. Menawarkan pulihkan untuk sesuatu yang tidak dapat dipulihkan lebih buruk daripada tidak menawarkan apa-apa.",
      "PERIKSA PENUNJUK. Ketika SIPP diperbarui dan nama medannya berubah, penunjuk yang tidak ketemu tidak menimbulkan galat - querySelector hanya menjawab null dan ekstensi diam saja tidak mengisi apa-apa. Rusaknya tidak bersuara; yang bersuara petugas, berhari-hari kemudian. Sekarang penunjuk yang menentukan diperiksa terhadap halaman yang sedang terbuka dan yang hilang disebut namanya.",
      "BILAH GULIR MUDAH DILIHAT DAN MUDAH DITEKAN. Sembilan piksel adalah sasaran yang lebih sering meleset daripada kena - dan meleset di tepi kanan berarti MENYERET PANELNYA, bukan menggulir isinya. Sekarang jalurnya 12 piksel dengan bingkai tembus pandang, jadi yang dilihat mata tetap ramping sementara yang ditangkap kursor dua kali lebih lebar. Pegangannya tembus pandang selama tidak dipakai, dan muncul pada tiga keadaan yang semuanya berarti orang sedang berurusan dengan gulir: kursor masuk jalur kanan, isinya sedang digulir, atau fokus papan tik berpindah ke dalam panel. Lebarnya tidak ikut berubah - bilah yang melebar saat disentuh menggeser isi panel tepat ketika orang membidiknya.",
    ],
  },
  {
    versi: "1.128.0",
    dirilis: "2026-09-13T12:28:24+08:00",
    judul: "Kepala panel satu baris, pemilih warna yang sungguh berfungsi, dan hijau terakhir yang menyelip",
    butir: [
      "PEMILIH WARNA SUPER ADMIN DIPERBAIKI. Dari tujuh titik warna di kepala hanya SATU yang pernah terlihat: aturan tombol kepala menghapus latar setiap tombol, dan pada titik warna latar itulah satu-satunya isinya. Yang tampak cuma lingkaran garis titik yang sedang aktif - ditekan berapa kali pun tidak berbuat apa-apa, sebab ia memang sudah aktif. Kini di kepala hanya ada satu bulatan sewarna palet yang aktif; menekannya membuka baris tujuh titik tepat di bawah kepala, memilih satu menutupnya lagi.",
      "KEPALA PANEL KEMBALI SATU BARIS. Tujuh tombol yang melebar oleh padding tombol kepala itulah yang mematahkan chip peran dan tombol ciut, layar, segarkan, tutup ke baris kedua, sehingga kepalanya dua kali lebih tinggi. Dengan satu titik deretnya muat, dan chip peran yang panjang dipangkas elipsis, bukan didorong turun.",
      "HIJAU TERAKHIR YANG MENYELIP DI ABT DAN SIPP. Dicari bukan dari tangkapan layar, melainkan dengan menyalin markup kedua halaman ke halaman statis, memasang panel.css di atasnya, dan MENGUKUR warna terhitung tiap elemen pada ketujuh palet. Yang tetap hijau di palet ungu: kepala blangko ABT saat kursor di atas kartunya (#006640 milik ABT sendiri - persis kepala hijau di tangkapan layar), kaki halaman ABT, peringatan DATA ISIAN, label-success, bilah tab detail perkara SIPP (#usual2), dan gambar bilah atas SIPP yang memang hijau - pada palet selain dasar gambarnya dilepas.",
      "KEPALA BLANGKO ABT IKUT PALET. Sembilan warna kelompok blangko tidak lagi menjadi bidang kepala yang melawan paletnya: kepalanya memakai warna tua palet, dan warna kelompoknya tinggal sebagai garis tebal di tepi kiri - cara membedakan kelompok sekilas tetap ada.",
      "PANEL SENDIRI IKUT PALET. Chip jenis perkara, tombol unduh dan verifikasi, saklar, tombol permintaan, dan chip kelabu menulis hijaunya sebagai angka sejak sebelum ada palet, jadi di palet jingga pun tetap hijau. Tiga puluh empat angka diganti lima token turunan merek (latar, garis, tombol, sorot, tulisan) yang dihitung dari warna merek paletnya dengan color-mix, dan kontrasnya diukur pada ketujuh palet.",
      "PALET PASTEL: sorot tombol digelapkan. Tulisan di atasnya hanya 4,15 : 1, di bawah batas AA; kini 5,35. Ditemukan begitu keenam palet mulai DIUKUR oleh penjaga kontras - yang sebelumnya berhenti mengukur begitu warnanya menjadi token, dan itu bukan lulus.",
    ],
  },
  {
    versi: "1.127.0",
    dirilis: "2026-09-13T12:00:00+08:00",
    judul: "Palet berlaku ke seluruh halaman, pintasan sampai ke ABT dan portal, dan templat tanya-jawab terbaca",
    butir: [
      "WARNA PALET KINI BERLAKU MENYELURUH. Enam palet 1.126.0 hanya mengubah token, sedangkan belasan tempat di peta gelap menulis hijaunya sebagai ANGKA - kepala tabel, tombol, bilah menu, kolom yang dimatikan, tulisan bayangan. Selama hanya ada satu palet itu tidak kelihatan; begitu palet lain dipilih, semuanya tetap hijau sementara sekitarnya berubah. Dua puluh tiga angka diganti menjadi lima token baru (tulisan-atas, sorot-kuat, mati, tulisan-samar, garis-dalam), keenam palet mendeklarasikannya, dan penjaga menolak angka warna baru di aturan tema gelap mana pun. Warna yang BERARTI sesuatu - merah hapus, kuning penanda, sembilan warna kelompok blangko - sengaja tidak ikut.",
      "KOTAK SUNTING DI HALAMAN ABT ikut gelap. Ia disisipkan ke dalam tabel milik ABT dan warnanya ditulis terang sejak sebelum halaman ABT digelapkan, sehingga menjadi kilatan putih paling terang di layar - tepat di tempat orang sedang mengetik.",
      "PINTASAN PAPAN TIK SAMPAI KE ABT DAN HALAMAN ALETA. Alt+A, Alt+P, Alt+R, dan Alt+Enter kini ada di ketiga panel, masing-masing dengan sasaran yang sungguh ada di panel itu - bukan tulisan yang tidak berbuat apa-apa. Barisan pintasan itu pula yang mendorong ikon segarkan dan nomor seri ke KANAN; tanpa barisnya keduanya berdiri di kiri, dan itulah bentuk kedua panel selama ini.",
      "TEMPLAT TANYA-JAWAB TERBACA. \"templat tanya-jawab tidak terbaca dari halaman ABT\" sebabnya satu baris di model ABT: replace_array_template berakhir \"return (object)$data;\", jadi templat datang sebagai OBJEK sementara keterangan yang sudah tersimpan datang sebagai larik. Pembacanya menuntut kurung siku, sehingga membaca keterangan selalu berhasil dan memuat templat selalu gagal - satu fungsi, dua jalur, hanya satu yang pernah dicoba. Keduanya kini diterima, dan objek berkunci angka diurutkan menurut nomornya.",
    ],
  },
  {
    versi: "1.126.0",
    dirilis: "2026-09-13T11:30:00+08:00",
    judul: "Enam warna gelap untuk super admin, keterangan saksi bermodus, dan grafik yang tidak lagi dibalik",
    butir: [
      "ENAM WARNA GELAP - hanya bagi super admin, dipilih lewat titik-titik kecil di kepala panel dan di jendela ekstensi. Sumbernya enam palet dari artikel dark-mode vev.design (Monochromatic, Neon, Warm, Muted Pastels, Deep Jewel, Contrasting Vibrancy), tiap palet DIADAPTASI untuk panel yang dibaca berjam-jam: tulisan putih-gading bukan #FFFFFF, aksen neon diturunkan pekatnya, permukaan bertingkat, dan warna peringatan (kuning, merah) tidak diganti di palet mana pun. Satu pilihan berlaku sekaligus di SIPP, ABT, dan halaman ALETA - dipasang pada gambar pertama seperti temanya, tanpa kelebat.",
      "KETERANGAN SAKSI BERMODUS. Dua saksi jarang tahu hal yang sama: tetangga melihat pertengkaran tetapi tidak tahu sebabnya, orang tua tahu sebabnya dari cerita anaknya tetapi tidak pernah menyaksikan. Tiap saksi kini punya modusnya sendiri - tahu seluruh alasan; hanya sebagian (dipilih mana saja); tahu berselisih & berpisah tetapi tidak tahu sebabnya; tidak pernah menyaksikan; tahu dari cerita Penggugat/Pemohon, Tergugat/Termohon, atau keluarga. Modus menjawab tiga kelompok pertanyaan (penyebab, menyaksikan, cara mengetahui); pertanyaan lain tetap dari templat. Jawabannya dapat disunting di panel sebelum disimpan, dan di halaman tanya-jawab halaman dimuat ulang begitu tersimpan.",
      "GRAFIK SMART MAJELIS TIDAK DIBALIK. Pembalikan warna kanvas yang dipasang 1.125.0 dicabut: kanvas di SIPP juga memuat pindaian dokumen dan pratinjau tanda tangan, dan dokumen pengadilan yang warnanya berubah adalah harga yang terlalu mahal. Yang disentuh hanya kanvas grafik Smart Majelis, latarnya nada tengah supaya sumbu kelabu Chart.js tetap terbaca.",
      "Kawat e-Court diaudit statis ujung ke ujung: 61 rute portal, 70 panggilan gerbang, 139 jalur bot - tidak satu pun putus. Yang belum dapat dibuktikan setempat hanya sambungan ke situs e-Court sendiri, yang menuntut sesi di peladen.",
    ],
  },
  {
    versi: "1.125.0",
    dirilis: "2026-09-13T09:30:00+08:00",
    judul: "Lapisan gelap sampai ke halaman yang selama ini terlewat, dan keterangan saksi disusun di tempat ia dikerjakan",
    butir: [
      "HALAMAN MASUK SIPP ikut gelap. Ia halaman pertama yang dilihat tiap hari, dan satu-satunya yang dilihat SEBELUM ada yang tahu temanya gelap. Kotak hijaunya diturunkan terangnya, bukan dihapus - hijau itu identitas SIPP.",
      "HALAMAN BER-AdminLTE ikut gelap: Antrian Direktori Putusan, Smart Majelis, verifikasi prodeo, pendaftaran perjanjian bersama. Kotaknya sudah dipetakan sejak awal; yang menyala justru ISINYA - box-header, box-body, info-box, todo-list, small-box. Tabel bootstrap dan tabel laporan yang dicetak ke Excel ikut, termasuk laporan mediasi bulanan yang dibaca berlama-lama.",
      "HALAMAN MASUK DAN MENU IKON APS BADILAG ikut gelap. Keduanya templat admin Bootstrap 4 dengan latar foto - kerangka yang sama sekali berbeda dari halaman blangko, dan tidak satu pun pernah terpetakan. Fotonya dibiarkan, hanya diredupkan supaya kartu di atasnya terbaca.",
      "DAFTAR BLANGKO ABT: krem #fff3b594 yang menjadi bidang paling terang di seluruh ABT kini ikut gelap. Sembilan warna kepala kelompoknya TIDAK diseragamkan - itulah cara petugas membedakan kelompok blangko sekilas; yang diturunkan hanya terangnya.",
      "EKSTENSI KINI SUNGGUH BERJALAN DI ABT PELADEN. Polanya '/aps_badilag/abt/*' tidak pernah cocok satu halaman pun di sana: alamat ABT yang sungguhan memuat index.php di tengahnya. Tema dan panelnya karena itu tidak pernah muncul di peladen, sementara di mesin setempat keduanya tampak biasa saja - dan perbedaan itu yang membuatnya lama tidak tertangkap.",
      "KETERANGAN SAKSI DAPAT DISUSUN DI HALAMAN TEMPAT IA DIKERJAKAN. Penyusun keterangan dua saksi sudah ada sejak lama, tetapi hanya di halaman daftar variabel blangko - sedangkan yang mengisi keterangan saksi duduk di penyunting tanya-jawab, dan di sana ALETA tidak muncul sama sekali. Kemampuan yang tidak berada di tempat orang mengerjakannya sama saja dengan kemampuan yang tidak ada. Di halaman itu hanya penyusun saksi yang tampak; tombol yang tidak punya sasaran di sana disembunyikan.",
      "Jendela ekstensi bernama ALETA E-COURT, anak judulnya dihapus, dan pilihan temanya berbunyi \"ikut sistem\" - bukan \"ikut peramban\".",
      "Rel peran di tepi panel ikut tema: kilau super admin diredupkan pada tema gelap supaya ia berhenti menjadi bidang paling terang di layar, dan peran lain mengambil warnanya dari token tema alih-alih angka yang ditulis sekali lalu tidak pernah ikut berubah.",
    ],
  },
  {
    versi: "1.124.0",
    dirilis: "2026-09-13T07:05:06+08:00",
    judul: "Putusan disimpan sendiri dan dibuktikan, halaman perkara dibuka kembali, dan arsip e-Court diperiksa tanpa diminta",
    butir: [
      "TULISAN TIDAK LAGI BERTINDIHAN. Label 'sekarang' dan 'usulan' berlebar 54 piksel MATI sementara hurufnya dihitung dari skala huruf panel; begitu hurufnya dibesarkan, labelnya tidak muat, tumpah keluar kotak yang flex: none, lalu bertindihan dengan nilainya. Lebarnya kini dalam em dengan min-width - tidak dapat lebih sempit daripada tulisannya pada ukuran huruf mana pun. Dua tempat: kartu usulan putusan dan daftar praperiksa.",
      "ISIKAN YANG DICENTANG KINI MENYIMPAN SENDIRI. Sesudah SELURUH yang dicentang terisi, Simpan ditekan dan halaman perkara dibuka kembali. Satu isian gagal berarti Simpan tidak ditekan sama sekali - borang yang belum utuh tidak boleh tersimpan sebagai putusan.",
      "TERSIMPANNYA DIBUKTIKAN, BUKAN DIAKUI. Borang putusan SIPP mengirim lewat AJAX, jadi tombolnya 'berhasil ditekan' walau simpanannya ditolak peladen. Karena itu keadaan putusan dibaca dari SIPP sebelum dan sesudah menekan; hanya selisih itu yang dianggap bukti. Sepuluh detik tanpa perubahan dilaporkan apa adanya, dan halamannya TIDAK dimuat ulang supaya isian yang belum diterima tidak hilang.",
      "UNGGAH PUTUSAN MEMBUKA KEMBALI HALAMAN PERKARANYA - lewat alamat perkara, bukan location.reload yang mendaratkan petugas di dasbor. Hanya bila ada berkas yang sungguh masuk; bila tidak, pesan yang menerangkan kegagalannya justru akan terhapus.",
      "Unggah putusan diuji ujung ke ujung terhadap SIPP setempat: dua berkas tertulis ke cakram, kolom dokumen pada perkara_putusan terisi, dua baris dirput_dokumen (putusan published=0, anonimisasi published=1), satu baris dirput_antrian, dan lima baris sys_audittrail - tidak satu pun menyebut ALETA.",
      "ARSIP e-COURT DIPERIKSA SENDIRI. Pemeriksa keutuhannya sudah lengkap sejak lama - ada, ukuran, sidik jari SHA-256, penanda bentuk - tetapi tidak satu pun pemanggilnya berjalan sendiri: satu-satunya jalan masuk adalah layar portal yang harus dibuka orang. Berkas yang hilang atau terpotong karena itu baru ketahuan ketika ada yang membukanya. Kini dijalankan penjadwal, sesudah tiap penarikan, paling sering enam jam sekali, dan catatan yang rusak dibuang supaya berkasnya ditarik ulang.",
      "PANEL SUPER ADMIN TERLIHAT BERBEDA di SIPP, ABT, dan halaman ALETA sekaligus: satu rel dua piksel bergradasi berkilau di tepi atas panel, sepalet dengan chip perannya. Peran lain mendapat rel yang sama dalam warna diam - bukan hilang, supaya tepi panel tidak berpindah tempat antar peran. Latar panel TIDAK diberi gradasi: isinya nomor perkara, nama pihak, dan kutipan putusan yang harus dibaca.",
    ],
  },
  {
    versi: "1.123.0",
    dirilis: "2026-09-12T23:37:20+08:00",
    judul: "Penetapan dilanjutkan dari tengah, posita tercetak berbaris, dan naskah penetapan itsbat/dispensasi dapat diunggah",
    butir: [
      "PENETAPAN MASSAL tidak lagi berhenti di perkara pertama. Tiga sebab yang bertumpuk: rute portal meneruskan pembungkus gerbangnya sehingga tiap penolakan berbunyi satu kata 'ditolak'; panel membaca keadaan penetapan dari tabel berkas PDF (perkara_dokumen_penetapan) sedangkan rantainya membaca perkara_penetapan, dan keduanya berselisih tepat pada perkara yang PMH-nya ada tetapi PDF-nya belum dicetak; dan 'pmh_sudah_ada' memutus rantai sehingga PPP, PJS, PHS tidak pernah dikerjakan.",
      "RANTAI DILANJUTKAN DARI TENGAH. Langkah yang sudah ada dilewati dan rantai berjalan terus - PMH ada: PPP, PJS, PHS dikerjakan; PMH+PPP ada: PJS dan PHS; PMH+PPP+PJS ada: PHS. Diuji pada perkara sungguhan di kelima keadaan. Yang benar-benar gagal tetap memutus.",
      "KODE PENOLAKAN MENJADI KALIMAT. 'akun_pejabat_tidak_ketemu' kini menyebut akun mana yang dicari dan mengarahkan ke pemetaan jabatan ALETA - yang disimpan di sana harus nama akun SIPP, bukan nama orangnya.",
      "POSITA TERCETAK BERBARIS DI PUTUSAN SIPP. Dibaca dari sumber SIPP: cleanHtmlTagSpecial menerjemahkan </p> menjadi \\par dan TIDAK menerjemahkan <br> - ia hanya disapu. Posita yang dirapikan dengan <br> karena itu tercetak menggumpal. Pemisahnya kini <p> per butir, dan butir pertama persis '<p>1.' menyalakan lekukan blok (\\li630) milik SIPP sendiri - itulah sebabnya 6.269 posita yang memakai <p> tercetak rapi selama ini.",
      "BARIS HAMPA sesudah keterangan saksi dibuang: baris yang isinya hanya &nbsp; atau spasi tak-putus tidak lagi menjadi paragraf kosong di dokumen cetak.",
      "NASKAH PENETAPAN ITSBAT NIKAH DAN DISPENSASI KAWIN DAPAT DIUNGGAH. Word menulis definisi daftarnya dengan bita \\'00, dan pembaca RTF menuliskannya sebagai aksara - puluhan kali per berkas. Postgres menolak U+0000, rute menjawab 500, dan panel menyimpulkan 'server ALETA tidak terjangkau' padahal portalnya hidup. Bita kendali kini tidak pernah ditulis, dan jalur unggah menjaganya sekali lagi.",
      "TOMBOL SEGARKAN di kaki panel bersanding dengan nomor versinya di ujung kanan - bukan lagi di tengah. Sebabnya satu baris CSS yang menimpa dirinya sendiri.",
      "Pegangan panel ABT memakai pointerdown seperti panel lainnya, dan dua layar portal (riwayat penetapan, tanda tangan) membaca jawabannya dari dalam bungkus { ok, data } - sebelumnya daftarnya selalu kosong tanpa satu pun galat.",
      "Mencakup 1.112.0 sampai 1.122.0: putusan otomatis dari draf ALETA dan dari naskah RTF, unggah putusan dan anonimisasi ke SIPP beserta antrean Direktori Putusan, medan putusan terdeteksi otomatis untuk tiap jenis perkara dan status putusan, pita identitas dengan chip berwarna per perkara dan per peran, kaki panel satu baris, alamat pihak dibersihkan, domisili elektronik dari gugatan, dan warna gelap CKEditor tanpa kedipan putih.",
    ],
  },
  {
    versi: "1.111.0",
    dirilis: "2026-09-12T21:20:00+08:00",
    judul: "Hubungan ke portal dibuat tahan lambat - panel tidak lagi menggantung ketika ALETA berat",
    butir: [
      "BATAS WAKTU pada tiap permintaan panel. Sebelumnya tidak ada satu pun: fetch yang menggantung menunggu sampai peramban menyerah sendiri - pada Chrome itu bermenit-menit - dan selama itu bagian panel tetap bertulis 'memuat...' tanpa satu pun keterangan. Yang membacanya menyimpulkan ekstensinya rusak. Sembilan detik untuk permintaan panel, dua belas detik untuk panggilan konteks yang memang paling berat. Batas waktu yang lewat kini punya kalimatnya sendiri, bukan lagi jatuh sebagai galat yang tidak dikenali.",
      "PANEL TIDAK MENUNGGU portal yang berat. Panggilan konteks menahan SELURUH panel - sampai ia menjawab, tidak ada apa pun yang tergambar, dan pada halaman perkara SIPP itu berarti beberapa detik tanpa panel sama sekali. Sekarang bila ia belum menjawab dalam 400 milidetik dan perkara itu pernah terbaca sebelumnya, panelnya digambar dari simpanan dengan pita yang menyebutkan ia sedang disegarkan; begitu jawaban yang segar tiba, panel digambar ulang. Portal yang cepat tidak pernah melihat pendahulu ini sama sekali - jawabannya menang balapan, dan tidak ada satu kedipan pun.",
      "Pitanya dibedakan nadanya dari pita luring. Yang satu berkata ALETA mati, yang lain ALETA sedang menjawab - menyamakan keduanya membuat portal yang hanya berat terbaca sebagai portal yang mati, dan yang membacanya berhenti menunggu padahal jawabannya sedang datang.",
      "PERMINTAAN YANG SAMA DISATUKAN. Halaman SIPP mengubah DOM-nya terus-menerus, dan beberapa bagian panel meminta alamat yang sama dalam hitungan milidetik. Yang sedang terbang kini dipakai bersama, bukan diulang - jawabannya disalin untuk tiap peminta.",
      "SATU PERCOBAAN KEDUA untuk bacaan yang gagal jaringan atau dijawab 5xx: portal yang sedang dibangun ulang menjawab 502 sekejap, lalu hidup lagi, dan satu kedipan tidak lagi berakhir sebagai pesan galat.",
      "Penyatuan dan percobaan kedua HANYA untuk bacaan, dan itu pagar yang tidak boleh bocor: dua penetapan yang kebetulan beralamat sama bukan satu penetapan, dan permintaan tulis yang diulang sesudah jawabannya hilang di jalan akan menuliskannya DUA KALI ke dalam berkas perkara yang sungguhan. Dijaga uji yang menjalankan lapisannya atas fetch palsu dan menghitung panggilan yang benar-benar terjadi.",
      "TAB YANG TIDAK DILIHAT tidak memanggil portal. Petugas membuka SIPP di beberapa tab sekaligus, dan tiap tab memasang pengamatnya sendiri; pada portal yang berat, tab yang tidak dipandang siapa pun ikut menambah antrean - dan yang menanggung lambatnya justru tab yang sedang dipakai. Ditunda, bukan dibatalkan: kembalinya perhatian ke tab itu mengerjakannya seketika.",
      "Penunggu 'Masuk ke ALETA' mundur jaraknya sendiri, lima detik sampai setengah menit. Pada layar yang ditinggal semalam, jarak tetap lima detik berarti tujuh ribu panggilan untuk satu pertanyaan yang jawabannya tidak berubah.",
      "Seluruhnya berlaku di ketiga panel - SIPP, ABT, dan halaman ALETA - sebab ketiganya memakai lapisan permintaan yang sama. Tidak ada satu pun kemampuan yang dikurangi.",
    ],
  },
  {
    versi: "1.110.0",
    dirilis: "2026-09-12T20:15:00+08:00",
    judul: "Nomor perkara di halaman daftar tidak lagi membawa angka urutnya",
    butir: [
      "Penetapan massal menyebut nomor perkara yang tidak pernah ada: 1564/Pdt.G/2026/PA.Dgl untuk perkara 564 pada baris ke-1, 10555/Pdt.G/2026/PA.Dgl untuk perkara 555 pada baris ke-10. Angka di depannya nomor urut barisnya.",
      "Sebabnya satu sifat DOM yang mudah terlewat: textContent sebuah baris tabel menyambung isi tiap selnya TANPA pemisah apa pun - berbeda dari innerText, yang menyisipkannya. Sel kolom No berisi '1', sel berikutnya '564/Pdt.G/2026/PA.Dgl', dan keduanya terbaca sebagai satu untai. Lalu bagian angka di depan polanya menelan nomor urut itu sebagai bagian nomor perkaranya.",
      "Cacat ini SUDAH LAMA ADA dan akibatnya diam - itu sebabnya ia bertahan. Penanda baris tidak menemukan sel bernomor itu sehingga tidak pernah tertempel, dan ringkasan massalnya menanyakan perkara yang tidak ada sehingga menjawab kosong: halaman penuh perkara terbaca sebagai 'tidak ada perkara yang berkeadaan khusus'. Jawaban yang masuk akal, dan karena itu tidak ada yang curiga. Penetapan massal hanya membuatnya terlihat, sebab ia menuliskan nomornya di layar.",
      "Sekarang nomornya dicocokkan per SEL, bukan atas seluruh barisnya. innerText memang memisahkannya, tetapi ia menuntut peramban menghitung tata letak tiap baris - pada tabel berisi lima puluh baris itu terasa; menyapu selnya sendiri lebih murah dan lebih tepat. Dijaga uji yang menjalankan fungsinya atas tabel sebentuk halaman Daftar Perkara SIPP.",
      "Ketemu di jalan yang sama: klasifikasi perkara berdua titik tidak pernah cocok dengan polanya. 12/Pdt.G.S/2026/PA.Dgl - gugatan sederhana - tidak pernah ditandai di halaman daftar dan nomornya tidak terbaca dari judul halaman perkaranya, sebab polanya hanya mengizinkan satu ruas bertitik. Diperluas menjadi paling banyak dua.",
      "Penetapan massal menyebut jumlahnya apa adanya: '50 perkara di halaman ini, 25 pertama ditawarkan'. Sebelumnya ia berkata '25 perkara terbaca di halaman ini', dan yang membacanya akan menyangka setengah halamannya tidak terbaca ALETA.",
    ],
  },
  {
    versi: "1.109.0",
    dirilis: "2026-09-12T19:30:00+08:00",
    judul: "Lencana akhirnya benar-benar hanya logo, dan penetapan dapat diterbitkan bertanda tangan ke SIPP",
    butir: [
      "LENCANA yang diciutkan kini benar-benar hanya logo. Sebelumnya di bawah logonya masih tersisa lonjong berbingkai hijau setinggi seratus piksel. Sebabnya satu baris yang tertinggal: .aleta-panel punya min-height 150px supaya panel yang terbentang tidak menyusut sampai tidak terbaca, dan pada lencana min-height itu MENANG atas tinggi 52 piksel. Mode logo lama punya penawarnya; ketika panel SIPP dipindahkan ke lencana bersama, baris itulah yang tertinggal - dan karena panel ABT serta panel halaman ALETA memakai lembar gaya yang sama, ketiganya lonjong sejak awal tanpa pernah ada yang menyebutnya. Latar, tepi, sudut, dan bayangan panelnya kini dilepas seluruhnya; yang tergambar hanya lencananya.",
      "TANDA TANGAN PEJABAT disimpan di basis data ALETA. Gambarnya diukir dari berkas .doc satuan kerja - 42 gambar terukir dari berkas yang ada sekarang - dan seluruhnya masuk dalam keadaan BELUM DISAHKAN. Pengukirannya kasar dan diakui kasar: ia menyapu bita mencari tanda berkas PNG dan JPEG, dan urutan gambar di dalam wadah .doc tidak harus sama dengan urutan nama di dalam teksnya. Tanda tangan yang terpasang pada nama yang keliru adalah tanda tangan palsu pada penetapan pengadilan, dan tidak ada satu galat pun yang akan berbunyi.",
      "Karena itu ada layar Tanda Tangan di portal - ALETA e-Court, hanya bagi yang berwenang menyunting blangko ABT. Tiap gambar ditampilkan besar di atas latar putih, dinamai, lalu disahkan; namanya tercatat sebagai yang mengesahkan. Tiga penjaga menahannya: yang belum disahkan tidak pernah dipulangkan untuk dipakai, yang belum dinamai tidak dapat disahkan, dan mengganti nama yang sudah disahkan MEMBATALKAN pengesahannya - tanda tangan A yang namanya diganti menjadi B adalah tanda tangan A pada penetapan B.",
      "PENETAPAN dapat diterbitkan bertanda tangan dan dicatatkan ke SIPP. Blangkonya diambil dari ABT - form PTSP pada blangko satker, dengan penanda @PMH, @PPP, @PJS, dan @PHS - tanda tangannya dibubuhkan tepat di atas nama penandatangan, PDF-nya diterbitkan dengan mesin yang sama yang sudah dipakai mencetak putusan ABT, dan barisnya dicatat di perkara_dokumen_penetapan. Bentuk barisnya dibaca dari 3.336 baris yang sudah ada di basis data satker: jenis 1 PMH, 2 PPP, 3 PJS, 4 PHS, dan perkara_penetapan_id menunjuk tabel petugas yang berbeda tiap jenis.",
      "Alamat blangko ABT DAPAT DISUNTING dari portal, satu alamat tiap jenis penetapan, dengan {nomor} dan {nomorBersih} yang diganti nomor perkaranya. ABT hanya ada di peladen dan alamatnya berbeda antar pemasangan; alamat tebakan yang salah akan memulangkan halaman galat ABT, dan halaman galat yang tersimpan sebagai penetapan jauh lebih buruk daripada penetapan yang tidak terbit. Karena itu bawaannya KOSONG dan mati sampai disetel, dan jawaban ABT yang bukan RTF ditolak.",
      "Nama penandatangan dicari di dalam blangko sesudah dibakukan huruf dan angkanya - blangko ABT, SIPP, dan berkas .doc menuliskan gelar dengan tiga cara yang berbeda, dan nama di dalam RTF kerap terpotong kendali gaya di tengah kata. Bila namanya tidak ketemu, tanda tangannya TIDAK dibubuhkan dan sebabnya disebut: penetapan yang tanda tangannya melayang entah di mana lebih buruk daripada penetapan tanpa tanda tangan yang masih dapat ditandatangani dengan tangan.",
    ],
  },
  {
    versi: "1.108.0",
    dirilis: "2026-09-12T18:05:00+08:00",
    judul: "Selisih e-Court diperiksa sendiri tiap malam, dan Data Umum dibaca dari berkas yang sudah ada di arsip",
    butir: [
      "SELISIH e-COURT DAN SIPP kini diperiksa sendiri tiap malam pukul 20.00, lalu ringkasannya dikirim ke panitera dan panitera muda lewat WhatsApp. Hitungannya sama persis dengan yang sudah dipakai panel - tidak ada aturan baru yang ditulis ulang, sebab dua tempat yang menghitung hal yang sama akan menyimpang diam-diam. Bedanya satu: panel hanya memeriksa perkara yang KEBETULAN sedang dibuka seseorang, sedangkan perkara yang tidak dibuka siapa pun tidak pernah diperiksa - dan justru perkara semacam itulah yang selisihnya paling lama tidak ketahuan.",
      "Pesannya DIAM ketika tidak ada selisih. Pesan 'tidak ada selisih' yang datang tiap malam mengajari orang mengabaikannya, dan pada malam ia berbunyi sungguhan tidak ada yang membacanya. Diamnya tidak berarti tidak diperiksa: tiap putaran tetap dicatat, sehingga pertanyaan 'apakah tadi malam diperiksa?' tetap ada jawabannya.",
      "Sekali semalam walau bot dinyalakan ulang lima kali - kunci idempotensinya bertanggal dan antrean mengenalinya. Yang disebut satu per satu dibatasi dua belas perkara, sisanya dihitung: pesan WhatsApp sepanjang lima puluh baris tidak dibaca sampai habis oleh siapa pun. Tidak ada satu pun nama pihak di dalamnya - layar ponsel dapat terlihat orang lain.",
      "DATA UMUM kini dapat dibaca dari berkas gugatan yang SUDAH ADA di arsip ALETA, dengan satu tekanan. Sebelumnya berkas itu harus dicari dan dipilih petugas dari cakramnya sendiri - padahal berkas yang sama sudah ditarik ALETA dari e-Court sejak hari perkara itu didaftarkan, dan daftarnya tergambar di panel yang sama beberapa baris di bawah. Yang dikerjakan petugas selama ini: membuka e-Court, mengunduh gugatannya sekali lagi, menyimpannya entah di mana, lalu memilihnya di panel. Tiga langkah untuk berkas yang sudah ada di tangan ALETA.",
      "Pemilih berkas manualnya TIDAK dibuang. Perkara lama banyak yang berkasnya belum pernah ditarik, dan bagi mereka jalan itu satu-satunya. Yang ditambahkan hanya jalan yang lebih pendek bila memang ada. Berkas arsipnya dibaca di memori lalu dilepas - tidak ada salinan baru yang disimpan di mana pun.",
      "POSITA YANG KOSONG DI SIPP tidak lagi menjadi jalan buntu. Perkara e-Court yang baru didaftarkan kerap punya kolom posita yang masih kosong - isinya memang masih di berkas gugatannya, dan mengetiknya ke SIPP justru salah satu pekerjaan yang hendak ditolong menu ini. Sampai sekarang menu Isi formulir Data Umum menyerah di situ. Sekarang ia membaca berkas gugatan dari arsip sebagai cadangan, dan ASALNYA SELALU DISEBUTKAN - usulan yang disusun dari berkas, lalu dibaca seolah-olah disusun dari layar, membuat orang mencari kalimat yang memang tidak ada di layarnya.",
    ],
  },
  {
    versi: "1.107.0",
    dirilis: "2026-09-12T16:40:00+08:00",
    judul: "Penetapan massal, praperiksa yang berbicara manusia, pintasan papan tik, dan panel yang tetap berguna saat ALETA mati",
    butir: [
      "PENETAPAN MASSAL dari halaman Daftar Perkara. Panel sudah lama membaca seluruh nomor perkara di halaman itu; sekarang tiap barisnya dapat dicentang dan keempat penetapannya dikerjakan berurutan. Tiga pagar menjaganya tidak menjadi alat perusak massal: tidak ada yang tercentang sendiri, tetap dua tekanan (yang pertama menjalankan uji kering atas TIAP perkara terpilih dan memperlihatkan hasilnya baris demi baris), dan berhenti pada kegagalan pertama - kegagalan pada penetapan massal hampir selalu menyeluruh, dan meneruskannya berarti mengulang kesalahan yang sama belasan kali sebelum ada yang sempat membacanya. Perkara yang sudah ditetapkan dilewati tanpa berbunyi.",
      "PRAPERIKSA yang berbicara manusia. Uji kering dulu menjawab '7 pernyataan disiapkan' per langkah - benar, dan tidak menolong siapa pun. Sekarang ia menyebut siapa yang akan ditunjuk beserta alasannya, kapan sidangnya, apa yang sudah ada di SIPP, dan apa yang mengganjal: hari sidang yang jatuh pada Sabtu atau Minggu, sidang yang kurang dari tujuh hari sejak pendaftaran, pejabat yang berhalangan tanpa Plh. Ketiganya keadaan yang diterima SIPP tanpa mengeluh tetapi keliru menurut hukum acara atau menurut kalender - dan yang menemukannya sesudah penetapan tertulis harus membongkar empat langkah untuk memperbaiki satu tanggal. Rincian pernyataannya tetap ada di bawah.",
      "MEMBATALKAN SELURUH PENETAPAN satu perkara sekali tekan. Sebelumnya menuntut empat kali dua tekanan, berurutan dari PHS mundur ke PMH, dan urutan itu tidak boleh keliru - delapan tekanan yang urutannya harus diingat adalah delapan kesempatan berhenti di tengah. Rantainya kini diurus di satu tempat, tetap dua tekanan, dan yang berhenti di tengah menyebutkan sampai mana perkaranya terbongkar.",
      "PANEL TETAP BERGUNA ketika ALETA tidak terjangkau. Sebelumnya portal yang mati berarti panel yang tidak digambar sama sekali, dan kesimpulan yang selalu sama: ekstensinya rusak. Sekarang keterangan perkara yang terakhir terbaca disimpan (dua belas perkara terakhir, dibuang sesudah dua belas jam) dan digambar dengan pita yang menyebutkan umurnya. Yang DIBACA boleh tua; yang DITULIS tidak pernah - seluruh kewenangan menulis dimatikan selama panel luring, sebab usulan majelis dihitung dari giliran dan beban perkara yang berubah tiap hari.",
      "PINTASAN PAPAN TIK: Alt+A menciutkan dan membentangkan panel, Alt+P membuka Penetapan, Alt+R membuka Riwayat ALETA, Alt+Enter menekan tombol Tetapkan - tetap dengan pengesahan tekanan keduanya. Diabaikan selagi kursor berada di kolom isian, dan tombol yang tidak dikenali diteruskan apa adanya ke SIPP. Keempatnya disebutkan di kaki panel: pintasan yang tidak diketahui siapa pun sama saja dengan pintasan yang tidak ada.",
      "PETA KOLOM FORMULIR kini mengusulkan dirinya sendiri. Kolom di halaman yang isinya berpadanan dengan nilai yang memang diusulkan ALETA - nama juru sita, nama panitera pengganti, tanggal sidang - ditunjukkan beserta penunjuknya, siap disalin ke Pengaturan. Dugaan dari ISI kolomnya dapat diperiksa; dugaan dari nama kolomnya tidak. ALETA tidak pernah memasangnya sendiri: peta yang keliru mengisi kolom yang salah pada formulir yang sungguhan.",
      "Layar RIWAYAT ALETA lintas perkara di portal, pada menu ALETA e-Court. Tab di panel menjawab 'apa yang pernah dikerjakan pada perkara INI'; layar ini menjawab 'apa saja yang dikerjakan hari ini, oleh siapa, dan ada berapa yang gagal'. Dapat disaring dan diunduh sebagai CSV - bahan bukti e-Audit yang selama ini dikumpulkan dengan tangan.",
    ],
  },
  {
    versi: "1.106.0",
    dirilis: "2026-09-12T15:05:00+08:00",
    judul: "Basis data SIPP bersih dari nama ALETA, riwayatnya pindah ke ALETA sendiri, dan panel menciut jadi lencana di mana pun",
    butir: [
      "Basis data SIPP tidak lagi memuat satu kata pun tentang ALETA. Tiap baris sys_audittrail yang ditulis ALETA dulu diakhiri '[ALETA] diisikan operator <nama>'. Niatnya penelusuran, tempatnya keliru: sys_audittrail catatan milik SIPP, dibaca petugas SIPP di layar Audit Trail SIPP, dan tidak ada satu pun baris SIPP yang menyebut alat yang dipakai mengetiknya - sehingga baris ALETA menonjol sebagai sesuatu yang disisipkan. Keterangan Smart Majelis pun ikut dibersihkan: sebabnya kini berbunyi giliran majelis dan pemerataan beban perkara, yang memang sebab yang sesungguhnya.",
      "Penelusurannya tidak hilang - ia pindah ke basis data ALETA, dan justru menjadi lebih lengkap di sana. Panel punya tab Riwayat ALETA baru yang menyebut tiap perbuatan beserta jenisnya, tanggalnya, nama pejabat dan akun SIPP yang dipakai, operator ALETA yang menekan tombolnya, jumlah langkah, dan tabel apa saja yang disentuh. Percobaan yang DITOLAK ikut tercatat beserta sebabnya - itu yang tidak pernah dapat dilakukan sys_audittrail, dan justru yang dicari ketika petugas bertanya kenapa penetapannya tidak jadi.",
      "Menciutkan panel kini menghasilkan lencana bulat berlogo di SIPP, ABT, dan halaman ALETA - satu bentuk yang sama, dan keadaannya DISIMPAN. Sebelumnya panel SIPP punya mode logonya sendiri yang keadaannya tidak pernah disimpan; halaman SIPP mengubah DOM-nya terus-menerus, panelnya digambar ulang, dan panel yang baru lahir terbentang lagi. Bukan kadang-kadang gagal menciut - menciutnya berhasil, lalu dibatalkan oleh halamannya sendiri.",
      "Ukuran bawaan panel menjadi sepertiga tinggi jendela, dan tidak pernah lebih dari separuh. Batas sebelumnya tiga per lima, dan pada layar 1080 itu berarti panel setinggi hampir 600 piksel yang menutupi sisi kanan SIPP lalu terpotong di tepi bawah begitu isinya lebih panjang daripada jatahnya.",
      "Sembilan garis panel mendapatkan warnanya kembali pada tema gelap. Sejak 1.73.0 peubah paletnya tertulis menunjuk dirinya sendiri - sah menurut penjaga yang ada waktu itu, tidak sah menurut CSS - sehingga tepi tombol kepala, kedua pegangan gulir, tepi kiri baris, garis putus kaki, dan tepi kotak kehilangan warnanya tanpa satu pun galat. Tema terang tidak pernah terkena, dan itu sebabnya tiga puluh dua rilis berlalu tanpa ada yang menyadarinya. Kotak isian di panel juga tidak lagi transparan.",
      "Jendela yang dipendekkan kini menjepit tinggi panel walau panelnya belum pernah digeser. Penjaganya dulu keluar lebih awal pada panel yang belum berjangkar, dan panel di halaman semacam itu tertinggal terpotong di tepi bawah tanpa guliran.",
    ],
  },
  {
    versi: "1.105.0",
    dirilis: "2026-09-12T14:10:00+08:00",
    judul: "Sesudah penetapan, halaman kembali ke perkaranya - bukan ke dasbor",
    butir: [
      "Memuat ulang halaman detail perkara SIPP selalu berakhir di dasbor, dan itu bukan kebetulan: nomor perkaranya tidak pernah ada di alamat, melainkan diambil dari sesi kilat yang HABIS begitu dibaca. Pemuatan kedua membaca sesi kosong lalu dialihkan. Petugas membacanya sebagai penetapan yang gagal - padahal keempatnya tersimpan, dan halamannya saja yang pindah. Panel kini memakai pintu masuk yang sah, yang alamatnya sudah tercetak di halaman itu sendiri.",
      "Riwayat perkara di popup menyimpan alamat yang sama cacatnya, dan ikut diperbaiki - ditekan, ia juga mendarat di dasbor.",
      "Jam keempat penetapan tidak lagi berakhiran detik yang sama. Sebelumnya menitnya berbeda tetapi detiknya persis sama pada PMH, PPP, PJS, dan PHS - empat keputusan yang ditulis manusia tidak mungkin begitu. Diuji atas 3.000 perkara: tidak ada satu pun yang keempat detiknya sama, dan tidak ada satu pun yang jam mulainya kembar.",
      "Kartu 'Ukuran huruf panel' di popup tidak pernah ditutup, sehingga kartu Pembaruan, tombol posisi panel, dan kaki popup semuanya tersarang di dalamnya. Peraga ukuran huruf dipindahkan ke barisnya sendiri - sebaris dengan tombolnya, di popup selebar 300 piksel ia tersisa 'Co...' saja.",
    ],
  },
  {
    versi: "1.104.0",
    dirilis: "2026-09-12T13:20:00+08:00",
    judul: "Penetapan dapat dibatalkan, Smart Majelis ikut tercatat, dan tab Kerjakan menjadi Penetapan",
    butir: [
      "Penetapan yang salah kini dapat DIBATALKAN dari panel. Sebelumnya tidak ada jalan kembali sama sekali: menekan ulang ditolak tabelnya, dan membongkarnya menuntut tangan dari beberapa tabel sekaligus. Yang dibatalkan selalu langkah terakhir yang masih ada - urutannya tidak dapat dibalik - dan dua tekanan, sama seperti menetapkan: yang pertama memperlihatkan rencananya, yang kedua membongkar.",
      "Yang dihapus hanya baris milik penetapan itu, dipagari id petugas dan tanggal penetapannya. Jadwal sidang dipagari lebih rapat lagi, ditunjuk langsung oleh baris penetapan hari sidang. Pagar ini bukan kehati-hatian yang berlebihan: rancangan pertamanya menghapus seluruh baris milik satu perkara, dan pada uji atas sepuluh perkara tahun 2015 ia ikut membuang riwayat juru sita dan jadwal sidang yang sudah ada sejak perkaranya disidangkan.",
      "Smart Majelis ikut dicatat pada tiap penetapan majelis. Perkara yang majelisnya ditetapkan ALETA sama sekali tidak muncul di laporan Smart Majelis sebelum ini, sebab barisnya memang tidak pernah ditulis.",
      "Diuji atas sepuluh penetapan penuh berturut-turut pada perkara sungguhan: keempat puluh langkahnya berhasil, tidak ada id kembar, dan sesudah seluruhnya dibatalkan cacah baris kedelapan tabel kembali persis seperti sebelum diuji.",
      "Halaman perkara dimuat ulang sendiri sesudah penetapan tersimpan. Tanpa itu tab Penetapan tetap kosong dan Riwayat Perkara tetap hanya menyebut pendaftaran, sehingga petugas menyimpulkan penetapannya gagal lalu menekannya sekali lagi.",
      "Tab \"Kerjakan\" menjadi \"Penetapan\", tombolnya menjadi \"Tetapkan\", dan hasil tiap langkah berbunyi \"ditetapkan\". Kata \"borang\" diganti \"formulir\" di seluruh teks yang dilihat petugas.",
      "Popup ekstensi ditata ulang: saklar perilaku dikelompokkan lebih dulu, lalu ukuran huruf, lalu pembaruan. Keterangan kedua kartu terakhir dipendekkan menjadi satu baris.",
    ],
  },
  {
    versi: "1.103.0",
    dirilis: "2026-09-12T11:40:00+08:00",
    judul: "Pembaruan dipasang sekali klik dari panel, tanpa membuka chrome://extensions",
    butir: [
      "Kotak Ekstensi pada panel ALETA kini punya tombol \"Perbarui sekarang\". Sebelumnya kotak itu hanya berkata \"unduh lalu muat ulang dari chrome://extensions\" - tiga langkah, dua di antaranya di halaman yang hampir tidak pernah dibuka petugas, dan akibatnya beberapa rilis berturut-turut tidak pernah benar-benar terpasang di peramban siapa pun. Tombol yang sama ada di popup ikon peramban.",
      "Pada pemasangan yang dikelola peladen (CRX lewat kebijakan Chrome), tombol itu meminta Chrome memeriksa updates.xml di portal seketika. Bila ada versi yang lebih baru, Chrome mengunduh dan memasangnya sendiri, ekstensi dimuat ulang, dan halaman ikut disegarkan supaya panelnya digambar kode yang baru. Itulah pemasangan sekali klik yang sesungguhnya.",
      "Pada pemasangan folder (Load unpacked), Chrome mengabaikan pembaruan otomatis - dan itu dikatakan apa adanya, bukan disamarkan menjadi \"tidak ada pembaruan\" yang menyesatkan. Tombol kedua muncul di situ: memuat ulang ekstensi dari berkasnya di disk, menggantikan perjalanan ke chrome://extensions.",
      "Ekstensi TIDAK dapat menulis ke foldernya sendiri, dan itu batas yang dipasang Chrome dengan sengaja: ekstensi yang dapat menimpa kodenya sendiri dari halaman web adalah ekstensi yang dapat dibajak halaman web. Pada pemasangan folder, berkasnya tetap harus sampai ke folder lebih dahulu oleh skrip rilis.",
      "Ekstensi tidak pernah dimuat ulang ketika Chrome tidak memasang apa pun. Panel yang lenyap di tengah pengisian borang penetapan membuang pekerjaan petugas, dan itu dijaga uji tersendiri.",
      "Pesan dari halaman yang bukan panel ALETA diabaikan pekerja latar. Tanpa itu, halaman web mana pun yang mengetahui id ekstensi dapat menyuruhnya memuat ulang.",
    ],
  },
  {
    versi: "1.102.0",
    dirilis: "2026-09-12T11:20:00+08:00",
    judul: "Penetapan tidak lagi tertahan di PHS, dan ukuran huruf panel dapat diatur sendiri",
    butir: [
      "Tombol \"Tetapkan dan tuliskan ke SIPP\" tidak pernah sampai menulis pada perkara yang baru didaftarkan. Sebabnya satu dan halus: uji kering dijalankan SEBELUM satu baris pun ditulis, sedangkan PHS menuntut PMH sudah tersimpan. Pada perkara baru PMH memang belum ada - dan tidak akan pernah ada selama uji keringnya sendiri yang menghalangi. PMH, PPP, dan PJS lulus, PHS ditolak \"pmh_belum_ada\", panel menyimpulkan rencananya belum siap, dan tombol kedua tidak pernah menyala.",
      "Sekarang ekstensi menyebutkan langkah mana yang sudah lulus mendahului, dan uji kering menilai PHS atas keadaan yang AKAN ada sesudah PMH ditulis. Andaian itu dikatakan apa adanya di bawah barisnya, bukan didiamkan.",
      "Pagarnya tetap utuh pada penulisan sungguhan: bila PMH benar-benar belum ada di SIPP, PHS tetap ditolak. Dibuktikan atas perkara sungguhan 562/Pdt.G/2026/PA.Dgl - uji kering lulus dengan delapan langkah, penulisan sungguhan tetap menolak. Urutan berhenti-pada-kegagalan juga tidak berubah: bila PMH gagal, PHS tidak dijalankan sama sekali.",
      "Ukuran huruf panel kini dapat diatur dari popup ikon peramban, 80% sampai 160% dengan langkah 10%. Yang membesar hanya HURUF di panel ALETA - lebar dan letak panelnya tidak bergeser, dan halaman SIPP tidak ikut berubah sama sekali, tidak seperti Ctrl+Plus yang merusak tabel perkaranya.",
      "Setelannya tersimpan di profil peramban masing-masing, jadi ia menjadi bawaan orang itu sendiri: berlaku lagi setiap kali panel terbuka, bertahan sesudah peramban ditutup dan sesudah ekstensi diperbarui. Perubahannya berlaku seketika di seluruh tab yang sedang terbuka, tanpa memuat ulang halaman.",
    ],
  },
  {
    versi: "1.101.0",
    dirilis: "2026-09-12T10:30:00+08:00",
    judul: "Obyek Sengketa diusulkan dari kebiasaan satker, dan ekstensi benar-benar hidup di pemasangan setempat",
    butir: [
      "Kotak Obyek Sengketa pada layar Data Umum tidak diisi dari posita - tidak satu pun kalimat di sana menyebut \"Pernikahan/Perceraian\". Yang menentukan isinya adalah kebiasaan satker untuk jenis perkara itu: pada 1.345 cerai gugat PA Donggala, satu maksud itu ditulis dengan empat ejaan. Panel kini menghitung kebiasaan itu lewat gerbang bot, menggabungkan ejaan yang semakna, dan mengusulkan ejaan yang paling sering dipakai beserta jumlahnya.",
      "Dicentang sendiri HANYA bila kebiasaannya nyaris bulat dan riwayatnya panjang - cerai gugat memenuhi keduanya. Itsbat nikah tidak: \"Isbat Nikah\" dan \"Pernikahan\" sama-sama dipakai, dan memilihkan salah satunya adalah keputusan petugas. Penetapan ahli waris pun tidak: yang ditulis di sana adalah keadaan perkaranya sendiri - tanah, dana BPJS - dan kebiasaan tidak berhak menimpanya. Kebiasaan lain disebutkan di bawah kotaknya.",
      "Kebiasaannya baru dihitung bila layarnya memang menampilkan kotak Obyek Sengketa, dan gagal menghitungnya tidak menggagalkan petikan data nikah maupun usulan alasan.",
      "Pemasangan setempat: Chrome ternyata memuat ekstensi dari folder hasil unduhan (D:\\Download File\\ekstensi-sipp) yang masih versi 1.95.0 - sebelum pola alamat 127.0.0.1 ada - sehingga di SIPP, ABT, dan ALETA setempat tidak ada satu pun skrip yang tersuntik. Folder itu kini disamakan dengan repo pada tiap rilis; yang tersisa hanya menekan Reload pada kartu ALETA di chrome://extensions.",
    ],
  },
  {
    versi: "1.100.0",
    dirilis: "2026-09-12T09:40:00+08:00",
    judul: "Data pernikahan pada layar Data Umum dipetik dari posita",
    butir: [
      "Perkara cerai - sebagian besar perkara pengadilan agama - menuntut empat isian bertanda bintang pada layar Info Perkara Agama: tanggal menikah, tanggal dan nomor kutipan akta nikah, serta KUA tempat menikah. Keempatnya tertulis apa adanya pada alinea pertama posita, beberapa sentimeter di bawahnya pada layar yang sama, dan menyalinnya adalah ketelitian yang paling cepat luntur pada perkara kesepuluh di hari yang sama.",
      "Panel kini memetik ketiganya dan mengisikannya. Permohonan itsbat nikah ikut dilayani: tanggal dan tempat pernikahannya dipetik dari kalimat yang bentuknya berbeda - harinya disebut lebih dahulu dan kata \"tanggal\" tidak ada sama sekali.",
      "Diukur atas berkas sungguhan yang datanya sudah tersimpan petugas. Dari 1.200 gugatan cerai: tanggal menikah 1.139 sama dan 13 berbeda; tanggal kutipan akta 1.088 sama dan 16 berbeda; nomor kutipan akta 1.025 sama persis, 54 berbeda hanya pada kata \"Duplikat\" yang ditambahkan petugas, dan 46 memang memakai nomor kutipan pengganti yang tidak disebut positanya. Dari 115 permohonan itsbat: tanggal menikah 108 sama dan NOL berbeda.",
      "Karena itu tiap petikan dapat disunting di panel sebelum diisikan, dan yang masuk borang adalah isi kotak saat Terapkan ditekan - bukan petikan semula. Kalimat posita yang menjadi asalnya diperlihatkan di bawah tiap petikan.",
      "Tanggal diisikan lewat jalur datepicker, bukan sebagai teks biasa: menyetel nilainya saja membuat kotaknya berubah sementara tanggal yang dipegang datepicker tetap yang lama.",
      "Medan KUA sengaja TIDAK diisikan - daftarnya dicari SIPP ke peladen ketika petugas mengetik, dan mengisinya menuntut menebak kode yang tidak ada di halaman. Nama KUA menurut posita tetap disebutkan, supaya yang harus diketik sudah terbaca.",
      "Tanggal yang tidak ada di kalender ditolak, bukan digeser: \"31 April\" lolos pemeriksaan bentuk tetapi bukan tanggal, dan yang tersimpan darinya akan menjadi 1 Mei tanpa seorang pun melihatnya.",
    ],
  },
  {
    versi: "1.99.0",
    dirilis: "2026-09-12T08:45:00+08:00",
    judul: "Alasan perkara di layar Info Perkara Agama diusulkan dari posita",
    butir: [
      "Layar Info Perkara Agama (Data Umum) menuntut satu medan alasan yang berbeda untuk tiap jenis perkara, dan hanya satu di antaranya yang tampak pada satu perkara: alasan pengajuan poligami, alasan pembatalan kawin, alasan penguasaan anak, alasan pengesahan anak, alasan asal usul anak, alasan itsbat nikah, alasan dispensasi kawin, ditambah bidang ekonomi syariah dan jenis akad pada perkara ekonomi syariah.",
      "Seluruhnya tersimpan ke satu tabel dengan penanda yang berbeda, dan angka itulah yang kelak menjadi laporan statistik perkara agama - termasuk statistik Dispensasi Kawin yang tiap tahun ditanyakan. Salah memilih tidak terlihat pada berkas perkaranya sama sekali.",
      "Panel kini menanyakan kepada HALAMAN medan mana yang sedang tampak beserta daftar pilihannya, lalu ALETA memilih satu berdasarkan bunyi POSITA dan petitum, disertai kalimat yang menjadi dasarnya. Pada layar ini belum ada draf putusan - perkaranya baru didaftarkan - sehingga buktinya memang posita, bukan pertimbangan hukum.",
      "Posita dibaca dari CKEditor di layar itu juga, bukan dari basis data. Bedanya terasa tepat ketika bacaan ini dipakai: petugas yang baru menempelkan positanya dan belum menekan Simpan akan tetap mendapat usulan yang benar.",
      "Yang tidak disebut posita dibiarkan KOSONG beserta sebabnya - bukan diisi pilihan pertama. Yang positanya menyebut lebih dari satu alasan ditandai berselisih dan tidak dicentang sendiri.",
      "Medan berisi banyak pilihan sekaligus - objek wakaf dan akad syariah tambahan - sengaja tidak ditawarkan: keduanya digambar alat pilihan ganda yang menyimpan pilihannya terpisah dari medan aslinya, sehingga mengisinya akan membuat petugas melihat satu hal sementara yang tersimpan hal lain. Tombol Simpan tetap ditekan petugas.",
      "Cara mesin menimbang pilihan diperbaiki, dan perbaikannya diukur atas berkas sungguhan. Kata kini dihitung di dalam SATU KALIMAT, bukan tersebar di seluruh naskah - sebelumnya \"hubungan\" di satu alinea dan \"mencintai\" di alinea lain tampak hadir bersama dan mengalahkan satu kata \"hamil\" yang justru menentukan permohonannya.",
      "Dan satu pilihan yang menang telak tetap ditandai berselisih bila saingannya juga disebut penuh oleh naskah. Diukur atas 184 permohonan dispensasi kawin PA Donggala yang alasannya sudah dipilih petugas: yang tercentang sendiri turun dari 132 menjadi 107, tetapi yang tercentang sendiri lalu keliru turun dari 29 menjadi 4. Sisanya diperlihatkan beserta saingannya untuk diputuskan petugas.",
      "Kutipan yang ditampilkan kini kalimat yang benar-benar menghasilkan usulannya, bukan kalimat lain yang kebetulan memuat kata yang sama.",
    ],
  },
  {
    versi: "1.98.1",
    dirilis: "2026-09-12T08:05:00+08:00",
    judul: "Medan borang putusan ditunjuk lewat nama, dan radio nusyuz benar-benar tercentang",
    butir: [
      "Pada borang Putusan Akhir SIPP, select \"status_reskom\" memakai id yang SAMA dengan select faktor perceraian. Menunjuknya lewat id membuat yang terisi bergantung pada urutan elemen di halaman - dan pada hari urutannya berubah, faktor perceraian akan terisi hasil reskom tanpa satu pun tanda. Sekarang seluruh medan ditunjuk lewat namanya, yang tidak kembar.",
      "Status nusyuz berupa radio, bukan select. Radio tidak terisi dengan menyetel nilainya - itu hanya mengubah nilai yang dikirimkan kotaknya, sehingga medannya tampak terisi sementara yang tersimpan tetap kosong. Jembatan kini mencentang anggota kelompok yang nilainya cocok.",
      "Ditambahkan pula ke daftar yang ditawarkan: status nusyuz, hasil reskom, dan jenis pengakhiran.",
    ],
  },
  {
    versi: "1.98.0",
    dirilis: "2026-09-12T07:55:00+08:00",
    judul: "Medan pilihan borang putusan ikut diusulkan - faktor perceraian, alasan dispensasi, dan seterusnya",
    butir: [
      "Borang Putusan Akhir tidak hanya berisi teks panjang. Ia menuntut pilihan yang berbeda-beda menurut jenis perkara dan status putusannya: faktor penyebab perceraian, faktor sekunder, nusyuz, qobla/ba'da dukhul, dan keadaan istri pada perkara cerai yang dikabulkan; alasan pengajuan pada dispensasi kawin; daftarnya sendiri pada izin poligami, itsbat nikah, dan pembatalan perkawinan.",
      "Angka-angka itulah yang kelak menjadi Laporan Faktor Penyebab Perceraian dan statistik Dispensasi Kawin. Salah pilih tidak terlihat di putusannya sama sekali - ia baru muncul setahun kemudian sebagai angka yang tidak masuk akal pada laporan satuan kerja.",
      "Panel kini menanyakan kepada HALAMAN medan mana yang sedang tampak beserta daftar pilihannya, lalu ALETA memilih satu berdasarkan bunyi pertimbangan dan duduk perkara, disertai kalimat yang menjadi dasarnya. Tidak ada satu pun nomor pilihan SIPP yang dihafal: SIPP boleh menambah, menghapus, atau menomori ulang daftarnya tanpa ekstensi ikut diubah.",
      "Yang tidak ditemukan naskahnya dibiarkan KOSONG beserta sebabnya - bukan diisi pilihan pertama, bukan \"Lain-Lain\". Yang naskahnya menyebut lebih dari satu ditandai berselisih dan tidak dicentang sendiri.",
      "Medan pilihan diisikan lebih dulu daripada teks panjang, sebab sebagian di antaranya mengubah tampilan borang - memilih qobla menentukan muncul-tidaknya keadaan istri.",
    ],
  },
  {
    versi: "1.97.0",
    dirilis: "2026-09-12T06:20:00+08:00",
    judul: "Usulan blangko dapat disunting sebelum masuk ABT, dan borang putusan SIPP diisi dari draf ALETA",
    butir: [
      "Usulan pada panel ABT kini dapat disunting di tempat: sekali klik, teksnya menjadi kotak isian. Yang tersimpan ke blangko adalah yang terbaca saat Terapkan ditekan - bukan usulan semula. Sebelumnya satu kata yang kurang tepat berarti seluruh usulannya tidak dapat dipakai.",
      "Usulan yang KOSONG pun dapat diisi begitu, dan centangnya menyala sendiri begitu ada isinya - petugas yang tahu jawabannya tidak perlu meninggalkan panel hanya untuk mengetik satu baris.",
      "Riwayat membedakan yang disunting petugas dari usulan mesin, sehingga yang membacanya kelak tahu mana yang sudah lewat mata manusia.",
      "Di halaman Putusan Akhir SIPP, panel mengisikan Pertimbangan Hukum, Amar, dan Amar Anonim dari draf putusan ALETA yang terbaru. Ketiganya CKEditor, dan diisi lewat jembatan dunia halaman supaya nilainya benar-benar berubah, bukan hanya tampilannya.",
      "Amar Anonim disusun dengan mengganti nama pihak menjadi sebutan acaranya - Penggugat/Tergugat untuk gugatan, Pemohon/Termohon untuk permohonan termasuk cerai talak. Nama saksi, anak, alamat, dan nomor identitas TIDAK ikut tersamar, dan panel mengatakannya.",
      "Status putusan, verstek, dan sumber hukum sengaja TIDAK disentuh: pilihannya sudah disaring SIPP menurut jenis dan alur perkara, dan salah pilih di situ mengubah jenis putusannya. Tombol Simpan tetap ditekan petugas.",
    ],
  },
  {
    versi: "1.96.0",
    dirilis: "2026-09-12T00:45:00+08:00",
    judul: "Ekstensi hidup di pemasangan setempat - SIPP, ABT, dan ALETA di satu alamat",
    butir: [
      "Pola pencocokan ekstensi selama ini hanya menyebut alamat peladen, sehingga di mesin pengembang ekstensinya tidak pernah menyala sama sekali - dan seluruh alur blangko hanya dapat dicoba di peladen, yaitu tempat yang paling tidak pantas dipakai mencoba. Sekarang alamat setempat ikut dikenali.",
      "Tiga aplikasi disajikan dari satu alamat setempat (127.0.0.1:8056): SIPP di /index.php, ABT di /aps_badilag, dan portal ALETA diteruskan di /aleta. Satu origin berarti jalur API /aleta/api dan kuki sesi berperilaku sama seperti di pengadilan.",
      "Tidak ada satu pun berkas yang tersuntik dua kali: pola SIPP, ABT, dan portal dijaga tidak saling beririsan, sebab skrip yang tersuntik dua kali melempar galat deklarasi ulang dan mematikan panelnya diam-diam.",
    ],
  },
  {
    versi: "1.95.0",
    dirilis: "2026-09-11T15:24:22+08:00",
    judul: "Panel di halaman ALETA sendiri - versi, kewenangan, pintasan jabatan, jalan kembali ke SIPP",
    butir: [
      "Ekstensi kini juga hidup di halaman portal ALETA: menunjukkan versi terpasang lawan versi tersedia (dan menyebut bila tertinggal), kewenangan orang itu di SIPP, dan pintasan yang berbeda menurut jabatan.",
      "Tema dan warnanya mengikuti ALETA - gelap-terang dibaca dari halaman, paletnya diambil dari token warna ALETA - sehingga panel dan halaman satu palet. Saklar tema milik panel disingkirkan di sana.",
      "Perkara yang dibuka di SIPP dicatat (delapan terakhir) dan ditawarkan kembali dari halaman ALETA dengan satu klik; tautan Buka SIPP dan Buka ABT selalu ada.",
      "Pintasan jabatan disusun portal, bukan ekstensi, dan disaring terhadap keterlihatan modul perannya - Super Admin mendapat seluruhnya termasuk pengaturan.",
    ],
  },
  {
    versi: "1.94.0",
    dirilis: "2026-09-11T14:08:51+08:00",
    judul: "Peran Operator, dan tombol Kerjakan punya kewenangannya sendiri",
    butir: [
      "Kerjakan dipisah dari papan penunjukan: papan hanya membaca dan mengusulkan, Kerjakan menulis ke SIPP. Bawaannya tertutup bagi seluruh jabatan; yang membukanya Super Admin, Admin, dan peran tambahan Operator.",
      "Yang tidak berwenang tetap melihat papan usulan lengkap, beserta keterangan bahwa usulannya dapat disalin ke borang SIPP.",
      "Data Umum dari berkas gugatan menjadi kemampuan tersendiri, tidak lagi menumpang pada kewenangan penunjukan.",
      "Operator - peran tambahan untuk penjaga sidang - hanya membawa panel, Data Umum, dan Kerjakan. Dilekatkan di samping jabatan, tidak menggantikannya.",
      "Mengubah kewenangan ekstensi kini hanya Super Admin; Admin tetap dapat membacanya.",
    ],
  },
  {
    versi: "1.93.0",
    dirilis: "2026-09-11T11:48:08+08:00",
    judul: "Kewenangan blangko ABT, dan pengecualian per pegawai",
    butir: [
      "Panel blangko ABT punya kemampuannya sendiri. Yang tidak berwenang melihat panelnya tanpa tombol yang akan ditolak.",
      "Pengecualian akses untuk satu orang: memberi atau mencabut satu kemampuan bagi satu pegawai, dengan alasan tertulis dan masa berlaku.",
      "Dua kolom penunjukan yang sejak lama menjaga rutenya tetapi tidak pernah tampil di layar pengaturan kini tampil - kolomnya diturunkan dari server, tidak lagi diketik di layar.",
    ],
  },
  {
    versi: "1.92.0",
    dirilis: "2026-09-11T10:33:42+08:00",
    judul: "Pita identitas, itsbat dari posita, dan keterangan dua saksi",
    butir: [
      "Pita identitas yang sama di kepala dan kaki setiap panel: nama yang masuk ALETA, akun SIPP, nomor dan jenis perkara, seri ekstensi.",
      "Huruf dibesarkan satu tingkat dan panel dilebarkan menjadi 380 piksel.",
      "Tombol berbahasa hukum resmi: Penetapan Majelis Hakim, Penunjukan Panitera Pengganti, dan seterusnya - tidak ada lagi singkatan SIPP maupun kode variabel.",
      "Itsbat nikah: empat belas variabel blangko dibaca dari posita permohonan, tiap usulan membawa kalimat asalnya, yang tidak ditemukan dikosongkan - bukan ditebak.",
      "Keterangan dua saksi disusun dari satu templat ABT dengan substansi sama dan kalimat berbeda; alasan dibaca dari gugatan bila dipilih 'sama dengan gugatan'.",
    ],
  },
  {
    versi: "1.91.0",
    dirilis: "2026-09-10T16:41:53+08:00",
    judul: "Penetapan dituliskan ALETA tanpa berpindah akun SIPP",
    butir: [
      "PMH, PPP, PJS, dan PHS dituliskan langsung dari panel secara berurutan, tanpa membuka empat borang dan tanpa berganti empat akun. Baris audit SIPP ikut ditulis.",
      "Usulan majelis tidak lagi menunggu tabel Smart Majelis SIPP terisi; hari sidang dicari walau majelisnya belum tercatat di SIPP.",
    ],
  },
  {
    versi: "1.90.0",
    dirilis: "2026-09-10T10:54:12+08:00",
    judul: "Jejak perubahan ABT tersimpan di peladen",
    butir: [
      "Riwayat perubahan blangko ABT dikirim ke peladen, sehingga dapat dibaca orang lain sebagai jejak pengawasan dan tidak hilang saat data peramban dibersihkan.",
      "Salinan di peramban tetap ada dan tetap menggerakkan tombol Urungkan, termasuk saat jaringan terputus.",
    ],
  },
  {
    versi: "1.89.0",
    dirilis: "2026-09-09T22:22:47+08:00",
    judul: "Perlawanan kedua atas satu perkara tidak lagi terbaca acak",
    butir: [
      "Penanda VERZET membaca perlawanan yang terbaru secara pasti. Sebelumnya, pada perkara yang dilawan dua kali, tanggal yang tampil bisa berpindah antar-pembacaan tanpa galat apa pun.",
    ],
  },
  {
    versi: "1.88.0",
    dirilis: "2026-09-09T20:52:25+08:00",
    judul: "Bunyi galat ABT tertangkap, kegagalan menyebut sebabnya",
    butir: [
      "Kalimat galat ABT seperti 'TIDAK BENAR QUERY NYA' tidak lagi dianggap variabel terisi, sehingga tidak pernah tercetak sebagai pertimbangan hukum.",
      "Keadaan tiap variabel kini tiga: kosong, galat, terisi - dan pemeriksaan sebelum CETAK menyapu seluruhnya.",
      "Kegagalan permintaan ke ALETA menyebut sebabnya, bukan sekadar 'gagal'.",
    ],
  },
  {
    versi: "1.87.0",
    dirilis: "2026-09-09T19:40:45+08:00",
    judul: "Pecahan posita yang meragukan ditanyakan",
    butir: [
      "Pecahan kata berhuruf a-f - yang tampak persis seperti penanda butir - ditampilkan beserta sambungannya, dan satu klik menyambungkannya.",
    ],
  },
  {
    versi: "1.86.0",
    dirilis: "2026-09-09T17:06:43+08:00",
    judul: "Posita ber-<div> tercetak rapi",
    butir: [
      "Tag <div> pada posita, yang dibuang ABT tanpa meninggalkan pemisah, diubah menjadi ganti baris sebelum dicetak.",
      "Kata yang terpecah pada huruf g-z disambung otomatis.",
    ],
  },
  {
    versi: "1.85.0",
    dirilis: "2026-09-09T16:48:33+08:00",
    judul: "Posita rapi di Word, sidang saksi dicari, tema SIPP lengkap",
    butir: [
      "Ganti baris posita benar-benar sampai ke dokumen Word - sebelumnya ganti baris mentah hanya menjadi spasi di RTF.",
      "Sidang yang memuat keterangan saksi dicari dari urutan 1 sampai 12, bukan ditebak dari alamat halaman.",
      "Tema gelap dan perkakas panel di halaman SIPP dilengkapi.",
    ],
  },
  {
    versi: "1.84.0",
    dirilis: "2026-09-09T15:50:13+08:00",
    judul: "Ubah ukuran di ABT, keterangan saksi benar-benar tersimpan",
    butir: [
      "Panel ABT memakai delapan pegangan ubah ukuran seperti panel SIPP; sebelumnya hanya satu yang tembus pandang di sudut kiri bawah.",
      "Keterangan saksi disimpan ke sidang yang sama dengan yang dibaca, bukan ke sidang pertama.",
      "Alasan perceraian (5227) disaring: hanya yang didalilkan gugatan dan dibuktikan saksi.",
    ],
  },
  {
    versi: "1.82.0",
    dirilis: "2026-09-09T15:17:03+08:00",
    judul: "Halaman ABT terbaca, tiga variabel dapat disunting",
    butir: [
      "Peta warna tema disusun untuk elemen ABT sendiri - sebelumnya seluruhnya ditulis untuk DOM SIPP sehingga halaman ABT menjadi hitam dengan tulisan hijau tua.",
      "Sepuluh perbaikan lain, seluruhnya dari membaca kode ABT di server alih-alih menebak.",
    ],
  },
  {
    versi: "1.81.0",
    dirilis: "2026-09-09T13:26:08+08:00",
    judul: "Satu tekanan CETAK menerbitkan tiga berkas; 5227 berbahasa putusan",
    butir: [
      "Alasan cerai disusun sebagai satu kalimat berpelaku tunggal dengan penyambung 'serta', persis bentuk yang dipakai putusan.",
      "Menekan CETAK sekali menerbitkan ketiga berkas yang diperlukan.",
    ],
  },
  {
    versi: "1.80.0",
    dirilis: "2026-09-09T12:33:58+08:00",
    judul: "Panel ABT dapat digeser, diubah ukuran, diciutkan, dan dilayarpenuhkan",
    butir: [
      "Tujuh perkakas panel yang sejak lama ada di halaman SIPP kini ada di panel ABT: geser, ubah ukuran, ciut, layar penuh, kembalikan posisi, tema, tutup.",
    ],
  },
  {
    versi: "1.79.0",
    dirilis: "2026-09-09T12:26:28+08:00",
    judul: "Tema popup, mode gelap tanpa kelebat, centangan huruf alasan",
    butir: [
      "Penanda tema dipasang pada document_start, sehingga halaman tidak lagi berkelebat putih sebelum menjadi gelap.",
      "Huruf alasan perceraian dipilih lewat centangan; posita dirapikan sebelum dipakai.",
    ],
  },
  {
    versi: "1.78.0",
    dirilis: "2026-09-09T10:55:53+08:00",
    judul: "Huruf a, b, dan f membawa dua dasar hukum",
    butir: [
      "Pasal 19 PP 9/1975 dan Pasal 116 KHI disimpan berdampingan apa adanya dan tidak pernah dicampur menjadi satu kalimat - selisih bunyinya ikut tercetak ke putusan.",
    ],
  },
  {
    versi: "1.77.0",
    dirilis: "2026-09-09T10:40:58+08:00",
    judul: "Penanda perubahan naskah huruf alasan",
    butir: ["Nomor versi dinaikkan untuk menandai perubahan naskah huruf alasan pada rilis sebelumnya."],
  },
  {
    versi: "1.76.0",
    dirilis: "2026-09-09T10:03:39+08:00",
    judul: "Penjaga sebelum CETAK, huruf alasan dari naskah resmi, riwayat perubahan",
    butir: [
      "Tombol CETAK ditahan bila masih ada variabel kerangka yang kosong atau variabel otomatis yang berbunyi galat - lalu bertanya, bukan melarang.",
      "Huruf alasan perceraian diambil dari naskah resmi, bukan diketik dari ingatan.",
      "Riwayat perubahan blangko dapat dibaca dan diurungkan.",
    ],
  },
  {
    versi: "1.75.0",
    dirilis: "2026-09-09T09:36:49+08:00",
    judul: "ALETA masuk ke halaman blangko ABT",
    butir: [
      "Variabel blangko disunting langsung di barisnya - Ctrl+Enter menyimpan, Esc membatalkan - bukan lewat jendela sembul satu per satu.",
      "Dua tombol usulan: dari SIPP dan dari keterangan saksi. Disimpan lewat rute simpan ABT sendiri; folder APS Badilag tidak pernah disentuh.",
    ],
  },
  {
    versi: "1.74.0",
    dirilis: "2026-09-09T07:34:09+08:00",
    judul: "Panel muncul di daftar perkara, penandaan jadi bawaan",
    butir: [
      "Saklar 'Tandai halaman SIPP' menyala sejak awal; sebelumnya mati dan tersembunyi di popup, sehingga penanda ghaib tidak pernah terlihat siapa pun.",
      "Tema terang memakai warna batu hangat.",
    ],
  },
  {
    versi: "1.73.0",
    dirilis: "2026-09-08T23:23:08+08:00",
    judul: "Tema gelap SIPP dibuat lengkap, palet panel disatukan",
    butir: [
      "Aturan tema gelap ditulis untuk tiap tempat SIPP menaruh warnanya - baris tabel ganjil-genap, detail perkara, isi tab - dibaca dari berkas gaya SIPP di server.",
    ],
  },
  {
    versi: "1.72.0",
    dirilis: "2026-09-08T22:18:56+08:00",
    judul: "Penanda di bawah nomor perkara, gelap jadi bawaan",
    butir: [
      "Penanda keadaan perkara dipindah ke kolom nomor perkara pada daftar; sebelumnya menempel di kolom nomor urut selebar dua angka.",
      "Identitas perkara diteruskan ke rute massal, sehingga penanda di daftar benar-benar muncul.",
    ],
  },
  {
    versi: "1.71.0",
    dirilis: "2026-09-08T18:54:13+08:00",
    judul: "Identitas di halaman daftar, rasio Smart Majelis dan panitera",
    butir: [
      "Lima identitas yang tidak ada di kolom mana pun halaman daftar - ghaib, izin atasan, verzet, prodeo, kuasa - dibaca sekali untuk seluruh baris.",
    ],
  },
  {
    versi: "1.70.0",
    dirilis: "2026-09-08T17:44:19+08:00",
    judul: "Data Umum diisikan ke SIPP",
    butir: [
      "Tanggal dan nomor surat, tanggal nikah, kutipan akta nikah, dan KUA tempat menikah dituliskan langsung ke SIPP. Yang sudah terisi tidak ditimpa, dan baris auditnya ditulis.",
    ],
  },
  {
    versi: "1.69.0",
    dirilis: "2026-09-08T16:07:59+08:00",
    judul: "Kerjakan di atas, panel dapat digulung, logo dan layar penuh",
    butir: [
      "Panel yang baru muncul dapat digulung - sebelumnya panel setinggi layar dapat berujung di bawah tepi layar tanpa tampak rusak.",
      "Mode logo, layar penuh, dan kelompok Kerjakan di bagian atas.",
    ],
  },
  {
    versi: "1.68.0",
    dirilis: "2026-09-08T12:27:08+08:00",
    judul: "Pilihan hakim per majelis dan per orang, hari sidang dapat dipilih",
    butir: [
      "Dropdown penunjukan yang sebelumnya tidak pernah muncul - empat sebab sekaligus, dibuktikan dengan memanggil layanannya - kini tampil dengan daftar calon lengkap.",
    ],
  },
  {
    versi: "1.67.0",
    dirilis: "2026-09-07T22:00:14+08:00",
    judul: "Enam ruas Data Umum, dua sinyal, berkas per agenda",
    butir: [
      "Enam ruas Data Umum yang dipetik server tetapi tidak pernah digambar - tanggal menikah, akta nikah, KUA, obyek sengketa, posita - kini tampil.",
    ],
  },
  {
    versi: "1.66.0",
    dirilis: "2026-09-07T21:44:51+08:00",
    judul: "Saklar manual, tema, dan empat menu yang tidak pernah termuat",
    butir: [
      "Empat bagian yang tersimpan sebagai terbuka lahir kosong dan baru terisi sesudah ditekan dua kali; pemuatnya kini dipanggil saat lahir.",
      "Saklar manual dan tema panel.",
    ],
  },
  {
    versi: "1.65.0",
    dirilis: "2026-09-05T15:27:03+08:00",
    judul: "Rilis pertama bersama ALETA Judicia",
    butir: [
      "Panel ALETA di halaman perkara SIPP: batas waktu e-Court, tahapan perkara, kesiapan sidang, kelengkapan berkas, dan penandaan baris daftar.",
    ],
  },
];

/** Versi ekstensi yang catatannya paling baru - harus sama dengan manifest. */
export const VERSI_EKSTENSI_TERBARU = CATATAN_EKSTENSI[0].versi;

/** Waktu rilis versi terbaru, ISO dengan zona. */
export const DIRILIS_EKSTENSI_TERBARU = CATATAN_EKSTENSI[0].dirilis;

/**
 * Menulis waktu rilis dalam bahasa Indonesia, selalu dalam zona WITA.
 *
 * Zona dipatok, bukan mengikuti komputer pembacanya: pegawai yang membuka dari
 * luar zona satuan kerja tetap membaca jam yang sama dengan rekannya.
 */
export function tulisWaktuRilis(iso: string) {
  const tanggal = new Date(iso);
  if (Number.isNaN(tanggal.getTime())) return iso;
  const bagian = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Makassar",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(tanggal);
  return `${bagian} WITA`;
}
