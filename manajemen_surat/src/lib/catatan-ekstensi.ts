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
