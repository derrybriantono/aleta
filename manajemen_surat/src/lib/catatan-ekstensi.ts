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
    versi: "1.128.0",
    dirilis: "2026-09-13T16:00:00+08:00",
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
    dirilis: "2026-09-13T14:00:00+08:00",
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
    dirilis: "2026-09-13T02:30:00+08:00",
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
    dirilis: "2026-09-12T23:30:00+08:00",
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
