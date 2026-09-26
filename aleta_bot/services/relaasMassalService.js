"use strict";

/**
 * ============================================================================
 * CETAK MASSAL RELAAS - SIAPA MENGERJAKAN APA PADA SATU TANGGAL
 * ============================================================================
 *
 * Satu pertanyaan, dua jenis dokumen, dikelompokkan per juru sita:
 *
 *   relaas panggilan sidang    perkara_pelaksanaan_relaas
 *   pemberitahuan putusan      perkara_putusan_pemberitahuan_putusan
 *
 * Diminta pengguna 25 September 2026: juru sita perlu selembar daftar berisi
 * SELURUH yang harus dikerjakannya pada hari itu - bukan membuka perkara satu
 * per satu di SIPP - dan atasannya perlu melihat daftar yang sama.
 *
 * Bentuk jawabannya dipatok bersama layarnya, jadi jangan diubah sepihak.
 *
 * ============================================================================
 * DUA TABEL YANG TIDAK BERBAGI KOLOM JURU SITA
 * ============================================================================
 *
 * Diukur pada sipp_donggala 25 September 2026:
 *
 *   perkara_pelaksanaan_relaas              14.342 baris bertanggal
 *   perkara_putusan_pemberitahuan_putusan    4.786 baris bertanggal
 *
 * Yang pertama menyimpan `jurusita_id` pada barisnya sendiri. Yang kedua TIDAK
 * punya kolom juru sita sama sekali - dicari, tidak ada. Karena itu kedua sisi
 * menempuh jalan yang berbeda, dan tiap baris menyebutkan jalan mana yang
 * dipakainya lewat `sumberJurusita`. Angka yang asalnya berbeda tidak boleh
 * tampak sama asal.
 *
 * ============================================================================
 * jurusita_id PADA RELAAS ADALAH sys_users.userid, BUKAN jurusita.id
 * ============================================================================
 *
 * Sambungan ini sudah dibetulkan pada 2.33.0 dan sebabnya tercatat panjang di
 * lapisanPetaService.sebaranJurusita. Cara yang sama dipakai di sini, bukan
 * ditemukan ulang:
 *
 *   LEFT JOIN sys_users u ON u.userid = r.jurusita_id  ->  u.fullname
 *
 * Bukti bahwa sambungan lewat tabel `jurusita` mustahil benar: dari 14.495
 * baris berjuru sita, 7.394 id-nya TIDAK ADA di tabel jurusita dan 7.101 ada
 * tetapi tidak aktif - NOL yang menunjuk juru sita aktif.
 *
 * Terukur lewat cara yang benar, seluruh tahun: Tanty Restianty 3.279,
 * Mohammad Syukri S.H. 2.727, Mustini 2.429, Nurhadi 2.016, Aguslin 1.041,
 * Fachrudin 845, Lukman Hakim S.E. 808.
 *
 * ============================================================================
 * JURU SITA PEMBERITAHUAN PUTUSAN - ATURAN PENGGUNA, DAN IA TERUKUR
 * ============================================================================
 *
 * Pengguna menyatakan 25 September 2026: "jurusita yang melakukan
 * pemberitahuan putusan yaitu jurusita yang melakukan panggilan perkara itu
 * yang masih aktif dalam penunjukkan pada perkara tersebut".
 *
 * Sumbernya `perkara_jurusita` - penunjukan juru sita PADA PERKARA. Terukur:
 * 10.168 baris untuk 10.096 perkara; aktif='Y' 10.115 baris, aktif='T' 53;
 * 10.025 perkara berpenunjukan satu, 70 berdua, 1 bertiga; dan TIDAK ADA
 * perkara yang punya lebih dari satu juru sita AKTIF - jadi aturannya
 * memulangkan satu nama, bukan pilihan.
 *
 * Liputannya: dari 4.786 baris pemberitahuan bertanggal, 4.780 perkaranya
 * punya juru sita aktif - hanya 6 yang tidak.
 *
 * Diuji atas 4.407 perkara ber-pemberitahuan: 4.401 punya penunjukan aktif;
 * 1.278 tidak punya relaas panggilan sama sekali sehingga tidak ada yang dapat
 * disilangkan; dari 3.123 yang dapat dinilai, 3.082 COCOK (98,7%) dan 41
 * berselisih (1,3%).
 *
 * Yang 1,3% itu TIDAK didiamkan: barisnya ditandai `berselisih` dan nama yang
 * memanggil disebutkan pada `namaPanggilan`. Aturan yang benar 98,7% tetap
 * aturan yang salah 41 kali, dan yang membaca lembar cetaknya berhak tahu
 * baris mana.
 *
 * ============================================================================
 * "AKTIF" PUNYA DUA ARTI, DAN MENUKARNYA MEMBUANG PEKERJAAN ORANG
 * ============================================================================
 *
 *   perkara_jurusita.aktif = 'Y'   penunjukan pada PERKARA ITU masih berlaku,
 *                                  belum diganti. 10.096 perkara.
 *   jurusita.aktif = 'Y'           ORANGNYA masih bertugas. Hanya TIGA orang:
 *                                  Mohammad Syukri, Tanty Restianty, Mustini.
 *
 * Aturan pengguna memaksudkan yang PERTAMA. Memakai yang kedua akan membuang
 * seluruh penunjukan Nurhadi, Aguslin, dan Muh. Sam'an yang masih berlaku pada
 * perkaranya - lembar cetaknya akan kosong untuk perkara yang justru sedang
 * dikerjakan.
 *
 * ============================================================================
 * NAMA ADALAH SATU-SATUNYA JEMBATAN, DAN IA DITULIS BERBEDA
 * ============================================================================
 *
 * Kedua sisi tidak berbagi id: relaas memegang sys_users.userid, penunjukan
 * memegang jurusita.id. Menyilangkannya hanya lewat NAMA, dan namanya memang
 * ditulis berlainan - terukur pada satker:
 *
 *   penunjukan                relaas
 *   "Mohammad Syukri"         "Mohammad Syukri, S.H."
 *   "NURHADI"                 "Nurhadi"
 *   "AGUSLIN"                 "Aguslin"
 *   "Lukman Hakim"            "Lukman Hakim, S.E."
 *
 * Yang DIBUANG saat menormalkan hanya tiga hal: gelar sesudah koma, titik
 * (menjadi spasi), dan beda huruf besar-kecil. Urutan kata TIDAK PERNAH
 * disusun ulang dan singkatan TIDAK PERNAH dibentangkan: "Muh. Sam'an" dan
 * "Sam'an Muh" dua nama berbeda sampai terbukti sebaliknya, dan "MOH.SUKRI"
 * tidak diam-diam dijadikan "Mohammad Syukri" - menebaknya berarti menuduh
 * orang yang salah dengan angka yang tampak pasti.
 *
 * Yang tidak tersatukan karena itu muncul sebagai dua entri, dan sebabnya
 * disebutkan pada `catatan`. Dua entri yang jujur lebih baik daripada satu
 * entri yang ditebak.
 *
 * ============================================================================
 * NAMA PIHAK MEMANG DIKIRIM - INI KEPUTUSAN SADAR
 * ============================================================================
 *
 * Nama pihak adalah DATA PRIBADI, dan beberapa layar ALETA menyamarkannya
 * dengan sengaja. Di sini ia dikirim utuh, dan sebabnya tunggal: juru sita
 * MENDATANGI orangnya. Relaas tanpa nama dan alamat tidak dapat dilaksanakan -
 * lembar cetak yang menyamarkan nama pihak bukan lembar yang lebih aman,
 * melainkan lembar yang tidak berguna.
 *
 * Rute ini tetap di balik token internal seperti seluruh rute /internal, dan
 * layarnya hanya terbuka bagi superadmin serta admin.
 *
 * ============================================================================
 * SEBUTAN PIHAK TIDAK DITEBAK DARI KATA
 * ============================================================================
 *
 * Tergugat lawan Termohon ditentukan alur/jenis_perkara_id, bukan kata pada
 * nama jenis perkara. Penurunnya sudah ada dan dijaga uji yang membandingkannya
 * dengan kembaran TypeScript-nya - sebutanPihakService.sebutanSatuPihak -
 * jadi ia yang dipakai, bukan aturan baru.
 *
 * Sisi mana pihak itu berada dibaca dari perkara_pihak1..5, bukan dari kata:
 *
 *   perkara_pelaksanaan_relaas.pihak_id       -> pihak.id
 *                                                (dicari di perkara_pihakN
 *                                                 lewat kolom pihak_id)
 *   perkara_putusan_pemberitahuan_putusan     -> perkara_pihakN.id, dengan N
 *   .pihak_id + .pihak                           pada kolom `pihak`
 *
 * Keduanya sudah diperiksa atas baris sungguhan, sebab kolom bernama sama di
 * dua tabel belum tentu menunjuk hal yang sama - itu sudah pernah menjebak.
 *
 * Sisi 3, 4, dan 5 tidak punya pasangan sebutan pada penurun itu. Artinya
 * diambil dari komentar TABEL SIPP apa adanya, bukan dikarang:
 *
 *   perkara_pihak3  "Data Pihak Ketiga(Intervensi)"
 *   perkara_pihak4  "Data Pihak Keempat(Terut Tergugat)"   (salah ketik asli)
 *   perkara_pihak5  tidak ada komentar  ->  sebutannya dikosongkan
 *
 * Terukur: sisi 1 6.382 relaas, sisi 2 7.629, sisi 4 49, sisi 5 1.
 *
 * ============================================================================
 * SANDI CARA PANGGIL - ARTINYA DARI KOMENTAR KOLOM, BUKAN DARI TEKS BEBASNYA
 * ============================================================================
 *
 * Komentar kolom ket_temu / ket_ketemu apa adanya:
 *
 *   'Y / T, E=Elektonik, S=surat tercatat, W=Web/Papan Pengumuman Pengadilan,
 *    P=papan pengumuman pemda, M=media massa cetak/elektornik, R=radio'
 *
 * (Salah ketik "Elektonik" dan "elektornik" ada pada aslinya.)
 *
 * 'S' berarti SURAT TERCATAT, bukan "gagal" dan bukan "diterima orang
 * serumah" - keliru itu baru dibetulkan dan sebab lengkapnya tercatat di
 * sippJadwalSidangService. 1.431 perkara bersandi S dan 829 di antaranya
 * justru berhasil.
 *
 * Sebaran terukur: Y 5.084, E 3.532, S 3.104, T 2.667, R 45, W 21, NULL 19,
 * N 14, P 6, M 3. Sandi 'N' TIDAK ADA pada komentar kolom - ia disebut "sandi
 * tidak dikenal" beserta hurufnya, tidak dikarang artinya.
 *
 * Petanya sengaja DISALIN ke berkas ini, tidak di-require: SANDI_CARA_RELAAS
 * pada sippJadwalSidangService tidak diekspor, dan menyunting berkas itu bukan
 * bagian pekerjaan ini. Bila salah satunya berubah, ubah keduanya.
 *
 * ============================================================================
 * VOLUMENYA KECIL, DAN ITU MENENTUKAN BENTUKNYA
 * ============================================================================
 *
 * Hari tersibuk 2026: relaas 29 Apr 58 baris / 39 perkara / 3 juru sita;
 * 23 Feb 47/31/3; 25 Feb 45/30/3. Pemberitahuan putusan: 18 Agu 15; 2 Jun 14;
 * 15 Jul 13. Jadi satu hari paling banyak sekitar 60-70 baris.
 *
 * Karena itu seluruhnya dipulangkan sekali jalan tanpa halaman. BATAS_BARIS
 * ada hanya sebagai pagar terhadap tanggal yang tidak terduga, dan bila ia
 * sampai berlaku, yang dipotong DISEBUTKAN pada `catatan` - bukan hilang
 * diam-diam.
 */

/**
 * ============================================================================
 * TAMBAHAN 25 SEPTEMBER 2026 - GOLONGANNYA, DAN YANG RELAASNYA BELUM ADA
 * ============================================================================
 *
 * Permintaan pengguna: "di sipp dan abt deteksi apa saja panggilan untuk
 * sidang pertama, sidang yang ditunda dan pemberitahuan putusan, blangkonya
 * ambil dari abt".
 *
 * Satu kalimat itu menyebut DUA hal yang berbeda, dan keduanya dipulangkan:
 *
 *   sudahAdaRelaas = true    relaas atau pemberitahuan yang TERCATAT pada
 *                            tanggal itu - rekap, untuk dicetak ulang;
 *   sudahAdaRelaas = false   sidang atau putusan yang jatuh pada tanggal itu
 *                            tetapi relaasnya BELUM ada - inilah pekerjaannya.
 *
 * Memulangkan hanya yang pertama akan menjawab "tidak ada panggilan hari ini"
 * pada hari yang justru penuh pekerjaan: diukur pada sipp_donggala, 4 September
 * 2026 punya 6 relaas tercatat sementara 19 sidang hari itu TIDAK punya relaas
 * sama sekali dan 18 putusannya belum ada satu pun pemberitahuannya.
 *
 * ============================================================================
 * LIMA GOLONGAN, DAN YANG KELIMA ADA SUPAYA EMPAT LAINNYA TIDAK BERBOHONG
 * ============================================================================
 *
 * Pengguna menyebut TIGA. Yang dipulangkan LIMA, sebab data memuat dua keadaan
 * lain yang kalau dipaksa masuk ke salah satu dari tiga itu akan salah:
 *
 *   sidang-pertama          nomor sidangnya 1
 *   sidang-ditunda          nomor sidangnya > 1 dan sidang itu ditunda
 *   pemberitahuan-putusan   baris pemberitahuan isi putusan
 *   ikrar-talak             jadwalnya berpenanda ikrar_talak = 'Y'; blangkonya
 *                           memang ada tersendiri di ABT
 *   sidang-lanjutan         nomor sidangnya > 1 dan TIDAK ditunda - bukan salah
 *                           satu dari tiga yang diminta, dan karena itu disebut
 *                           apa adanya alih-alih dijejalkan
 *
 * Terukur atas seluruh 20.109 baris jadwal sidang dengan urutan keutamaan
 * ikrar -> pertama -> ditunda -> lanjutan: sidang-pertama 10.116,
 * sidang-lanjutan 5.603, sidang-ditunda 3.366, ikrar-talak 1.024. Jumlahnya
 * 20.109 - tidak ada baris yang jatuh ke luar.
 *
 * Keutamaan ikrar di atas "pertama" tidak pernah berlaku, dan itu terbukti
 * bukan diasumsikan: dari 1.024 baris berpenanda ikrar_talak = 'Y', NOL yang
 * nomor sidangnya 1.
 *
 * ============================================================================
 * UKURAN YANG MEMBANTAH PERINGATAN YANG DIBAWA KE PEKERJAAN INI
 * ============================================================================
 *
 * Pekerjaan ini dibuka dengan peringatan: "perkara_jadwal_sidang.urutan BUKAN
 * nomor sidang - komentar kolomnya berbunyi 'Urutan Jadwal Sidang Dalam Satu
 * Hari yang sama: (by system)'. Memakainya sebagai nomor sidang salah."
 *
 * Komentar kolomnya memang berbunyi begitu (aslinya "Salam Satu Hari"). DATANYA
 * TIDAK. Diukur pada sipp_donggala 25 September 2026 atas seluruh 20.109 baris:
 *
 *   pasangan (perkara_id, urutan) yang berulang          0 dari 20.109
 *   urutan = 1 padahal ada sidang LEBIH AWAL             0
 *   urutan > 1 padahal TIDAK ADA sidang lebih awal       0
 *   perkara yang punya dua sidang pada tanggal yang sama 46 - dan pada
 *     semuanya urutannya tetap 1 dan 2, bukan 1 dan 1
 *
 * Artinya `urutan` menomori sidang SATU PERKARA dari awal sampai akhir, persis
 * seperti yang dibutuhkan, dan ia identik dengan urutan kronologisnya pada
 * 20.109 dari 20.109 baris. Komentar kolomnya yang tidak menggambarkan datanya.
 *
 * Sebab itu tidak ada cara ketiga yang diturunkan di sini: nomor yang dipakai
 * TETAP ruas yang sama dengan yang sudah dikirim sippJadwalSidangService dan
 * digambar panel Status Perkara. Yang ditambahkan hanya PEMERIKSAANNYA - ruas
 * `sidangLebihAwal` pada kedua kueri menghitung sidang yang benar-benar lebih
 * awal pada perkara itu, dan tiap baris yang "nomor 1" tetapi berpendahulu -
 * atau sebaliknya - DIHITUNG lalu disebut pada catatan. Jadi bila suatu hari
 * `urutan` benar-benar berubah arti, yang muncul selisih yang terbaca, bukan
 * golongan yang salah tanpa suara.
 *
 * ============================================================================
 * PIHAK MANA YANG DIPANGGIL - SIDANG SEBELUMNYA, BUKAN SIDANG ITU SENDIRI
 * ============================================================================
 *
 * Sidang yang ditunda tidak memanggil semua orang lagi: yang dipanggil yang
 * TIDAK hadir. Sandinya sudah diterjemahkan sejak lama di notifikasi.js:
 *
 *   4 = tidak ada yang hadir  -> panggil KEDUANYA
 *   3 = Pihak Kedua saja      -> panggil PIHAK PERTAMA
 *   2 = Pihak Pertama saja    -> panggil PIHAK KEDUA
 *
 * Pertanyaan yang TIDAK terjawab oleh peta itu: dihadiri_oleh sidang yang mana?
 * Panggilan untuk sidang ke-4 ditentukan kehadiran pada sidang ke-3, bukan pada
 * sidang ke-4 - yang justru belum terjadi ketika relaasnya dibuat.
 *
 * Itu diukur, bukan ditebak. Atas 4.628 baris relaas pada sidang bernomor > 1
 * yang sisi pihaknya terbaca, sisi yang sungguh dipanggil cocok dengan:
 *
 *   dihadiri_oleh sidang SEBELUMNYA   4.011 baris  (86,7%)
 *   dihadiri_oleh sidang ITU SENDIRI  3.634 baris  (78,5%)
 *
 * Jadi yang dipakai sidang sebelumnya. 86,7% bukan 100%, dan sisanya tidak
 * didiamkan - ruas `dihadiriOleh` memulangkan sandi MENTAH yang dipakai, supaya
 * siapa pun dapat membantahnya, dan `pihakDipanggil` tidak pernah lebih yakin
 * daripada sandinya.
 *
 * ============================================================================
 * KOSONG BUKAN "SEMUA HADIR" - 1.354 BARIS BERGANTUNG PADA BEDA INI
 * ============================================================================
 *
 * Sebaran dihadiri_oleh terukur atas 20.109 baris: 2 -> 10.041, 1 -> 7.486,
 * KOSONG -> 1.354, 4 -> 1.055, 3 -> 169, 10 -> 4.
 *
 * Kolomnya TIDAK punya komentar di tabel SIPP, tetapi artinya ADA di BORANG
 * SIPP sendiri - application/views/perkara_tab/jadwal_sidang_p_edit.php,
 * <select name="dihadiri_oleh">:
 *
 *   1  "Semua Pihak"             -> TIDAK dipanggil ("tidak-perlu"): yang hadir
 *                                   diperintahkan datang lagi DI MUKA SIDANG
 *   2  "<Pihak Pertama> Saja"    -> panggil PIHAK KEDUA
 *   3  "<Pihak Kedua> Saja"      -> panggil PIHAK PERTAMA
 *   4  "Para Pihak Tidak Hadir"  -> panggil KEDUANYA
 *   5, 7-9, 13-15                kombinasi intervensi/turut tergugat
 *   10, 11                       sebagian penggugat/tergugat
 *
 * Sampai 25 September 2026 berkas ini menjawab sandi 1 "tidak-diketahui" -
 * 7.486 sidang yang jawabannya sudah tercatat di SIPP disodorkan kepada juru
 * sita sebagai pertanyaan. Itu dibetulkan; sandi 1 kini "tidak-perlu", dan
 * sidang atau putusan yang dihadiri semua pihak TIDAK menjadi baris pekerjaan.
 *
 * KOSONG tetap bukan "semua hadir". notifikasi.js menjatuhkan kosong ke
 * "semua" - untuk MEMBERI TAHU itu tidak merugikan, untuk MEMANGGIL ia
 * merugikan: 1.354 baris yang kehadirannya tidak tercatat akan terbaca "semua
 * sudah hadir" lalu tidak dipanggil sama sekali, dan sidangnya batal karena
 * pihaknya tidak tahu. Karena itu kosong, 10, dan sandi kombinasi dijawab
 * "tidak-diketahui" - ditanyakan kepada juru sitanya, tidak diputuskan sendiri.
 *
 * Petanya kembaran pihakDipanggil() pada manajemen_surat/src/lib/pohon-blangko.ts,
 * dan uji relaas-massal-golongan.test.ts membandingkan keduanya sandi per sandi
 * supaya tidak ada yang bergeser sendiri.
 *
 * Dua golongan TIDAK bergantung sandi kehadiran sama sekali, dan itu keputusan:
 * sidang-pertama dan ikrar-talak selalu "keduanya", sebab blangko ABT-nya
 * memang satu berkas untuk dua pihak ("Relaas Panggilan Sidang P dan T",
 * "Relaas Panggilan Ikrar Talak P dan T") dan pada sidang pertama belum ada
 * seorang pun yang pernah hadir. Pada kedua golongan itu `dihadiriOleh`
 * dikosongkan - bukan diisi sandi yang tidak menentukan apa pun.
 *
 * Catatan atas data: "sidang pertama memanggil dua pihak" TIDAK selalu terjadi.
 * Diukur pada 4.995 sidang pertama yang berelaas: 3.348 memanggil dua sisi,
 * 1.617 hanya satu sisi, 30 sisinya tidak terbaca. Karena itu yang belum ada
 * relaasnya diperiksa PER PIHAK, bukan per sidang - satu pihak yang terlewat
 * tetap muncul meski pihak lawannya sudah dipanggil.
 *
 * ============================================================================
 * sidang_id RELAAS TIDAK SELALU MILIK PERKARANYA SENDIRI
 * ============================================================================
 *
 * Sambungan lama `LEFT JOIN perkara_jadwal_sidang s ON s.id = r.sidang_id`
 * terbukti tidak cukup. Diukur atas 14.495 baris relaas: 0 baris yang
 * sidang_id-nya tidak ada sama sekali, tetapi 103 baris (0,7%) sidang_id-nya
 * menunjuk jadwal sidang PERKARA LAIN - contohnya relaas 14077 milik perkara
 * 9889 menunjuk sidang 19703 milik perkara 9929.
 *
 * Sebelum ini baris-baris itu meminjam tanggal sidang dan agenda perkara orang
 * lain tanpa satu pun galat. Untuk golongan akibatnya lebih jauh: ia akan
 * meminjam NOMOR SIDANG dan penanda ditunda perkara lain, lalu menggolongkan
 * panggilan dengan yakin dan salah.
 *
 * Karena itu syarat perkaranya ditambahkan pada sambungannya, dan baris yang
 * sidang_id-nya milik perkara lain digolongkan "" - tidak terbaca - lalu
 * DIHITUNG pada catatan. Golongan karangan lebih buruk daripada golongan kosong.
 */

const db = require("../db_config");
const sebutanPihakService = require("./sebutanPihakService");
const { tanggalHariIni } = require("./periodePenilaianService");

/** Zona pengadilan. Tanggal kosong berarti hari ini di sini, bukan di UTC. */
const ZONA_PENGADILAN = "Asia/Makassar";

/**
 * Pagar terhadap tanggal yang tidak terduga, bukan halaman.
 *
 * Hari tersibuk terukur 58 relaas + belasan pemberitahuan. Angka ini 25 kali
 * lebih besar; bila sampai berlaku, yang dipotong disebutkan.
 */
const BATAS_BARIS = 2000;

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

/** Nama yang berarti "tidak ada nama", bukan nama seseorang. */
const NAMA_TIDAK_TERCATAT = "tidak tercatat";

/**
 * Arti sandi cara panggil. Sumbernya komentar kolom SIPP - lihat kepala berkas.
 * Salinan dari SANDI_CARA_RELAAS di sippJadwalSidangService yang tidak
 * diekspor; kalau satu berubah, ubah keduanya.
 */
const SANDI_CARA = {
  Y: "Bertemu langsung",
  T: "Tidak bertemu",
  E: "Panggilan elektronik",
  S: "Surat tercatat (POS)",
  W: "Pengumuman web/papan pengumuman pengadilan",
  P: "Pengumuman papan pengumuman Pemda",
  M: "Media massa cetak/elektronik",
  R: "Radio (radiogram)",
};

/**
 * Sebutan pihak untuk sisi yang tidak punya pasangan pada penurun sebutan.
 * Diambil dari komentar tabel SIPP apa adanya. Sisi 5 tidak berkomentar, jadi
 * dikosongkan - bukan ditebak "Turut Tergugat" hanya karena nomornya besar.
 */
const SEBUTAN_SISI_LAIN = { 3: "Pihak Intervensi", 4: "Turut", 5: "" };

/**
 * Lima golongan yang dipulangkan, beserta satu kunci keenam untuk yang tidak
 * terbaca. Urutannya urutan tampil, dan hitungannya SELALU lengkap keenam-
 * enamnya - golongan yang nol tetap disebut nol, sebab ruas yang hilang di layar
 * tidak dapat dibedakan dari nol.
 */
const GOLONGAN = [
  "sidang-pertama",
  "sidang-ditunda",
  "sidang-lanjutan",
  "ikrar-talak",
  "pemberitahuan-putusan",
  // Baris yang sidangnya tidak terbaca - 103 relaas se-riwayat sidang_id-nya
  // milik perkara lain. Lihat kepala berkas.
  "tidak-terbaca",
];

/**
 * Sandi kehadiran SIPP -> pihak yang harus dipanggil pada sidang berikutnya.
 *
 * Kembaran pihakDipanggil() pada manajemen_surat/src/lib/pohon-blangko.ts, dan
 * disalin BUKAN di-require sebab berkas itu TypeScript di paket lain. Uji
 * relaas-massal-golongan.test.ts membandingkan keduanya; bila satu diubah,
 * ubah keduanya.
 *
 * 1 ("Semua Pihak" pada borang SIPP) dijawab "tidak-perlu" - jawaban SIPP,
 * bukan ketiadaan jawaban. Yang TIDAK ada di sini dengan sengaja: kosong, 10,
 * dan sandi kombinasi - semuanya jatuh ke "tidak-diketahui". Sebabnya panjang
 * di kepala berkas, dan ringkasnya: 1.354 baris berkehadiran kosong tidak
 * boleh terbaca "tidak perlu dipanggil".
 */
const PIHAK_DARI_KEHADIRAN = { 1: "tidak-perlu", 4: "keduanya", 3: "pertama", 2: "kedua" };

/**
 * Pihak yang dipanggil menurut sandi kehadiran, apa adanya.
 *
 * Nilai yang tidak ada pada petanya - termasuk null, kosong, 10, dan sandi
 * kombinasi - dijawab "tidak-diketahui". Itu bukan kegagalan yang
 * disembunyikan: ruas `dihadiriOleh` tetap memulangkan sandi mentahnya supaya
 * yang membaca dapat memeriksa sendiri. Sandi 1 dijawab "tidak-perlu".
 */
function pihakDipanggilDariSandi(nilai) {
  if (nilai === null || nilai === undefined || bersih(nilai) === "") return "tidak-diketahui";
  const n = Number(nilai);
  if (!Number.isFinite(n)) return "tidak-diketahui";
  return PIHAK_DARI_KEHADIRAN[n] || "tidak-diketahui";
}

/**
 * Golongan satu panggilan sidang.
 *
 * Keutamaannya: ikrar talak, lalu sidang pertama, lalu ditunda, lalu lanjutan.
 * Ikrar lebih dahulu sebab blangkonya berdiri sendiri di ABT; bahwa ia tidak
 * pernah bertabrakan dengan sidang pertama sudah diukur - 0 dari 1.024 baris
 * berpenanda ikrar yang nomornya 1.
 *
 * `nomorSidang` 0 berarti sidangnya TIDAK TERBACA, dan jawabannya "" - bukan
 * "sidang-pertama". Menjatuhkan yang tidak terbaca ke sidang pertama akan
 * mencetak blangko dua pihak untuk panggilan satu pihak, dan tidak ada yang
 * akan tahu sebabnya.
 */
function golonganSidang({ nomorSidang, ditunda, ikrarTalak }) {
  const nomor = bilangan(nomorSidang);
  if (bersih(ikrarTalak).toUpperCase() === "Y") return "ikrar-talak";
  if (nomor <= 0) return "";
  if (nomor === 1) return "sidang-pertama";
  return bersih(ditunda).toUpperCase() === "Y" ? "sidang-ditunda" : "sidang-lanjutan";
}

/**
 * Pihak yang dipanggil untuk satu golongan.
 *
 * sidang-pertama dan ikrar-talak TIDAK menanyakan kehadiran: blangko ABT-nya
 * satu berkas untuk dua pihak, dan pada sidang pertama belum ada yang pernah
 * hadir. Keduanya karena itu "keduanya" tanpa melihat sandi apa pun, dan
 * pemanggilnya mengosongkan `dihadiriOleh` supaya tidak ada yang menyangka
 * sandi itulah yang memutuskan.
 */
function pihakUntukGolongan(golongan, sandiKehadiran) {
  if (golongan === "sidang-pertama" || golongan === "ikrar-talak") return "keduanya";
  if (golongan === "sidang-ditunda" || golongan === "sidang-lanjutan") {
    return pihakDipanggilDariSandi(sandiKehadiran);
  }
  return "tidak-diketahui";
}

/**
 * Sandi kehadiran APA ADANYA untuk dikirim ke layar - angka bila ia angka,
 * teksnya bila bukan, null bila kosong.
 *
 * Tidak diterjemahkan di sini dengan sengaja: layar berhak menurunkannya
 * sendiri dan membantah jawaban bot. Sandi yang tidak dapat dipetakan ke satu
 * blangko (10, terukur 4 baris, dan sandi kombinasi) karena itu tetap terbaca
 * di layar walau pihakDipanggil-nya "tidak-diketahui".
 */
function sandiKehadiran(nilai) {
  if (nilai === null || nilai === undefined) return null;
  const teks = bersih(nilai);
  if (teks === "") return null;
  const n = Number(teks);
  return Number.isFinite(n) ? n : teks;
}

/**
 * Sisi pihak yang perlu dipanggil untuk satu nilai pihakDipanggil.
 * "tidak-perlu" dan "tidak-diketahui" sama-sama tidak memilih sisi - tetapi
 * pemanggilnya WAJIB membedakan keduanya: yang pertama bukan pekerjaan, yang
 * kedua pekerjaan yang harus ditanyakan.
 */
function sisiUntukPihak(pihak) {
  if (pihak === "keduanya") return [1, 2];
  if (pihak === "pertama") return [1];
  if (pihak === "kedua") return [2];
  return [];
}

function kueri(sql, params = []) {
  return new Promise((selesai, gagal) => {
    db.query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil)));
  });
}

function bersih(nilai) {
  return String(nilai === null || nilai === undefined ? "" : nilai)
    .replace(/\s+/g, " ")
    .trim();
}

function bilangan(nilai) {
  const n = Number(nilai);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Tanggal yang dipulangkan driver MySQL bisa berupa objek Date (kolom `date`)
 * ataupun teks. Keduanya dijadikan ISO tanpa lewat UTC: `toISOString()` pada
 * kolom tanggal telanjang menggeser harinya satu hari untuk zona timur, dan
 * pergeseran itu tidak menimbulkan galat - hanya tanggal yang salah.
 */
function tanggalIso(nilai) {
  if (!nilai) return "";
  if (nilai instanceof Date) {
    if (Number.isNaN(nilai.getTime())) return "";
    const bulan = String(nilai.getMonth() + 1).padStart(2, "0");
    const hari = String(nilai.getDate()).padStart(2, "0");
    return `${nilai.getFullYear()}-${bulan}-${hari}`;
  }
  const teks = bersih(nilai);
  const cocok = teks.match(/^(\d{4}-\d{2}-\d{2})/);
  return cocok ? cocok[1] : "";
}

/**
 * Membuang gelar yang ditulis sesudah koma.
 *
 * Hanya dibuang bila ekornya memang BERBENTUK gelar - huruf, titik, dan spasi
 * saja, dan pendek. "Mohammad Syukri, S.H." kehilangan gelarnya; nama yang
 * komanya bukan gelar dibiarkan utuh, sebab membuang bagian nama orang lebih
 * merugikan daripada gagal menyatukan dua ejaan.
 */
function tanpaGelar(nama) {
  const teks = bersih(nama);
  const koma = teks.indexOf(",");
  if (koma < 0) return teks;
  const ekor = teks.slice(koma + 1).trim();
  const inti = ekor.replace(/[.\s]/g, "");
  if (inti.length > 0 && inti.length <= 8 && /^[A-Za-z]+$/.test(inti)) {
    return teks.slice(0, koma).trim();
  }
  return teks;
}

/**
 * Kunci penyatuan dua ejaan nama yang sama. Tiga hal saja yang diabaikan:
 * gelar sesudah koma, titik (dijadikan spasi), dan huruf besar-kecil.
 *
 * Titik menjadi SPASI, bukan hilang: "MUH.SAM'AN" dan "Muh. Sam'an" bertemu di
 * "muh sam'an", sedangkan menghapusnya akan memisahkan keduanya lagi.
 */
function normalNama(nama) {
  return tanpaGelar(nama)
    .replace(/\./g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Nama yang bukan nama: kosong, atau "0" bawaan kolom diinput_oleh. */
function namaTerbaca(nama) {
  const teks = bersih(nama);
  return teks && teks !== "0" ? teks : "";
}

/** Arti sandi cara panggil. Sandi asing disebut asing, tidak dikarang. */
function caraPanggil(sandiMentah) {
  const sandi = bersih(sandiMentah).toUpperCase();
  if (!sandi) return { sandi: "", label: "", terbaca: false };
  if (Object.prototype.hasOwnProperty.call(SANDI_CARA, sandi)) {
    return { sandi, label: SANDI_CARA[sandi], terbaca: true };
  }
  return { sandi, label: `Sandi SIPP "${sandi}" tidak dikenal`, terbaca: false };
}

/** status_pos SIPP: 1 berhasil, 2 tidak berhasil (kembali ke satker). */
function statusPos(nilai) {
  const n = Number(nilai);
  if (n === 1) return "terkirim";
  if (n === 2) return "kembali";
  return "belum";
}

/**
 * Sebutan satu pihak menurut sisinya. Sisi 1 dan 2 lewat penurun resmi yang
 * membaca alur/jenis_perkara_id; sisi lain lewat komentar tabel SIPP.
 */
function sebutanPihakBaris(pihakKe, perkara = {}) {
  const sisi = Number(pihakKe);
  const bahan = {
    alurPerkaraId: perkara.alurPerkaraId,
    jenisPerkaraId: perkara.jenisPerkaraId,
    jenisPerkaraNama: perkara.jenisPerkara,
    nomorPerkara: perkara.nomorPerkara,
  };
  if (sisi === 1 || sisi === 2) {
    return sebutanPihakService.sebutanSatuPihak(String(sisi), bahan, "");
  }
  const lain = SEBUTAN_SISI_LAIN[sisi];
  if (lain === undefined) return "";
  if (sisi === 4) {
    // Komentar tabelnya berbunyi "Turut Tergugat". Bagian "Tergugat"-nya tetap
    // mengikuti alur perkaranya, sebab pada permohonan sebutannya Termohon.
    const pasangan = sebutanPihakService.sebutanPihakPerkara(bahan);
    return `Turut ${pasangan.dua}`;
  }
  return lain;
}

/** Lima tabel pihak SIPP. perkara_pihak1..5, dan tidak ada yang keenam. */
const TABEL_PIHAK = [1, 2, 3, 4, 5];

/**
 * Pengganti v_pihak_perkara: saringan perkara_id disisipkan ke DALAM tiap
 * cabang UNION ALL, sebab di situlah indeks perkara_id terpakai. View-nya
 * terukur 8.563 ms lawan 413 ms untuk 20 perkara - sebabnya tercatat panjang
 * di sippJadwalSidangService, dan kesimpulannya dipakai di sini.
 */
function sqlSisiPihak() {
  return TABEL_PIHAK.map(
    (n) =>
      `SELECT perkara_id AS perkaraId, id AS barisId, pihak_id AS pihakId, ` +
      `nama, ${n} AS pihakKe FROM perkara_pihak${n} WHERE perkara_id IN (?)`
  ).join(" UNION ALL ");
}

/**
 * ============================================================================
 * SATU TANGGAL, DUA JENIS DOKUMEN, DIKELOMPOKKAN PER JURU SITA
 * ============================================================================
 *
 * Tanggal kosong berarti hari ini menurut zona pengadilan. Tanggal berbentuk
 * lain DITOLAK, tidak diperbaiki diam-diam: tanggal yang salah tafsir
 * memulangkan daftar hari lain dengan tampilan yang sama meyakinkan.
 */
async function relaasMassal(tanggalDiminta = "") {
  const diminta = bersih(tanggalDiminta);
  if (diminta && !POLA_TANGGAL.test(diminta)) {
    return { ok: false, alasan: "tanggal_tidak_berbentuk_yyyy_mm_dd", tanggal: diminta };
  }
  const tanggal = diminta || tanggalHariIni(ZONA_PENGADILAN);
  const catatan = [];

  // ==========================================================================
  // 1. RELAAS PANGGILAN SIDANG
  // ==========================================================================
  //
  // Juru sitanya ada pada barisnya sendiri. diinput_oleh dipakai hanya bila
  // sys_users tidak mengenali userid-nya - itu nama pengguna yang menekan
  // simpan, bukan tentu juru sitanya, jadi asalnya disebut apa adanya.
  //
  // Sambungan ke jadwal sidang MENYEBUT perkaranya. Tanpa syarat itu, 103 baris
  // se-riwayat meminjam jadwal perkara lain - lihat kepala berkas. `sidangMilik`
  // dipulangkan supaya bedanya "sidang_id tidak ada" dan "sidang_id milik
  // perkara lain" dapat disebut pada catatan, bukan sama-sama menjadi kosong.
  //
  // `dihadiriSebelum` adalah kehadiran pada sidang SEBELUMNYA - itulah yang
  // menentukan siapa yang dipanggil untuk sidang ini, dan ia cocok 86,7% lawan
  // 78,5% bagi kehadiran sidang ini sendiri (diukur atas 4.628 baris).
  const barisRelaas = await kueri(
    `SELECT r.id AS barisId, r.perkara_id AS perkaraId, r.pihak_id AS pihakId,
            r.no_resi_pos AS resi, r.ket_temu AS sandiCara, r.status_pos AS statusPos,
            r.doc_relaas AS docRelaas, r.sidang_id AS sidangId,
            COALESCE(NULLIF(u.fullname, ''), NULLIF(r.diinput_oleh, '')) AS jurusita,
            s.tanggal_sidang AS tanggalSidang, s.agenda AS agenda,
            s.urutan AS urutanSidang, s.ditunda AS ditunda, s.ikrar_talak AS ikrarTalak,
            pv.dihadiri_oleh AS dihadiriSebelum, pv.id AS sidangSebelumId,
            sx.perkara_id AS sidangMilik,
            (SELECT COUNT(*) FROM perkara_jadwal_sidang q
              WHERE q.perkara_id = s.perkara_id
                AND (q.tanggal_sidang < s.tanggal_sidang
                     OR (q.tanggal_sidang = s.tanggal_sidang AND q.id < s.id))
            ) AS sidangLebihAwal,
            pk.nomor_perkara AS nomorPerkara, pk.jenis_perkara_nama AS jenisPerkara,
            pk.alur_perkara_id AS alurPerkaraId, pk.jenis_perkara_id AS jenisPerkaraId
       FROM perkara_pelaksanaan_relaas r
       LEFT JOIN sys_users u ON u.userid = r.jurusita_id
       LEFT JOIN perkara_jadwal_sidang s
              ON s.id = r.sidang_id AND s.perkara_id = r.perkara_id
       LEFT JOIN perkara_jadwal_sidang sx ON sx.id = r.sidang_id
       LEFT JOIN perkara_jadwal_sidang pv
              ON pv.perkara_id = s.perkara_id AND pv.urutan = s.urutan - 1
       LEFT JOIN perkara pk ON pk.perkara_id = r.perkara_id
      WHERE r.tanggal_relaas = ?
      ORDER BY r.id
      LIMIT ?`,
    [tanggal, BATAS_BARIS + 1]
  );
  if (barisRelaas.length > BATAS_BARIS) {
    catatan.push(
      `Relaas panggilan pada tanggal ini lebih dari ${BATAS_BARIS} baris; ` +
        `yang ditampilkan ${BATAS_BARIS} pertama menurut nomor barisnya.`
    );
    barisRelaas.length = BATAS_BARIS;
  }

  // ==========================================================================
  // 2. PEMBERITAHUAN PUTUSAN
  // ==========================================================================
  //
  // perkara_putusan hanya punya satu baris per perkara - diperiksa: NOL perkara
  // yang punya lebih dari satu - jadi JOIN biasa tidak melipatgandakan baris.
  const barisPbt = await kueri(
    `SELECT b.id AS barisId, b.perkara_id AS perkaraId, b.pihak AS pihakKe,
            b.pihak_id AS pihakBarisId, b.no_resi_pos AS resi,
            b.ket_ketemu AS sandiCara, b.status_pos AS statusPos,
            b.edoc_pbt AS docPbt, b.putusan_akhir AS putusanAkhir,
            pk.nomor_perkara AS nomorPerkara, pk.jenis_perkara_nama AS jenisPerkara,
            pk.alur_perkara_id AS alurPerkaraId, pk.jenis_perkara_id AS jenisPerkaraId,
            pu.tanggal_putusan AS tanggalPutusan
       FROM perkara_putusan_pemberitahuan_putusan b
       LEFT JOIN perkara pk ON pk.perkara_id = b.perkara_id
       LEFT JOIN perkara_putusan pu ON pu.perkara_id = b.perkara_id
      WHERE b.tanggal_pemberitahuan_putusan = ?
      ORDER BY b.id
      LIMIT ?`,
    [tanggal, BATAS_BARIS + 1]
  );
  if (barisPbt.length > BATAS_BARIS) {
    catatan.push(
      `Pemberitahuan putusan pada tanggal ini lebih dari ${BATAS_BARIS} baris; ` +
        `yang ditampilkan ${BATAS_BARIS} pertama menurut nomor barisnya.`
    );
    barisPbt.length = BATAS_BARIS;
  }

  // ==========================================================================
  // 2b. SIDANG PADA TANGGAL ITU - PEKERJAAN, BUKAN REKAP
  // ==========================================================================
  //
  // Dua kueri di atas menjawab "apa yang SUDAH tercatat hari itu". Yang di
  // bawah menjawab "apa yang sidangnya hari itu tetapi relaasnya belum ada" -
  // dan itu pertanyaan yang justru menentukan sidang jadi atau batal.
  //
  // Terukur atas seluruh sidang 2026 yang sama sekali tidak punya relaas:
  // sidang pertama 40 dari 796, ditunda 301 dari 481, lanjutan 162 dari 578,
  // ikrar 16 dari 68. Jadi ini bukan keadaan langka.
  const barisSidang = await kueri(
    `SELECT j.id AS sidangId, j.perkara_id AS perkaraId, j.urutan AS urutanSidang,
            j.ditunda AS ditunda, j.ikrar_talak AS ikrarTalak, j.agenda AS agenda,
            j.tanggal_sidang AS tanggalSidang,
            pv.dihadiri_oleh AS dihadiriSebelum, pv.id AS sidangSebelumId,
            (SELECT COUNT(*) FROM perkara_jadwal_sidang q
              WHERE q.perkara_id = j.perkara_id
                AND (q.tanggal_sidang < j.tanggal_sidang
                     OR (q.tanggal_sidang = j.tanggal_sidang AND q.id < j.id))
            ) AS sidangLebihAwal,
            pk.nomor_perkara AS nomorPerkara, pk.jenis_perkara_nama AS jenisPerkara,
            pk.alur_perkara_id AS alurPerkaraId, pk.jenis_perkara_id AS jenisPerkaraId
       FROM perkara_jadwal_sidang j
       LEFT JOIN perkara_jadwal_sidang pv
              ON pv.perkara_id = j.perkara_id AND pv.urutan = j.urutan - 1
       LEFT JOIN perkara pk ON pk.perkara_id = j.perkara_id
      WHERE j.tanggal_sidang = ?
      ORDER BY j.perkara_id, j.urutan
      LIMIT ?`,
    [tanggal, BATAS_BARIS + 1]
  );
  if (barisSidang.length > BATAS_BARIS) {
    catatan.push(
      `Sidang pada tanggal ini lebih dari ${BATAS_BARIS} baris; yang diperiksa ` +
        `${BATAS_BARIS} pertama menurut perkara dan nomor sidangnya.`
    );
    barisSidang.length = BATAS_BARIS;
  }

  // ==========================================================================
  // 2c. PUTUSAN PADA TANGGAL ITU - PEMBERITAHUAN YANG BELUM ADA
  // ==========================================================================
  //
  // Kehadiran pada sidang pembacaan putusan yang menentukan siapa yang harus
  // diberi tahu: yang hadir sudah mendengarnya sendiri. Diukur atas 683 putusan
  // 2026, SELURUHNYA punya sidang pada tanggal putusannya - jadi sandi
  // kehadirannya memang ada untuk dibaca.
  //
  // Sub-kueri, bukan JOIN: 46 perkara punya dua sidang pada satu tanggal, dan
  // JOIN akan melipatgandakan barisnya. Yang diambil sidang bernomor terbesar -
  // pembacaan putusan sidang terakhir hari itu.
  //
  // Hanya putusan bertanggal TEPAT tanggal ini. Tunggakan hari-hari sebelumnya
  // TIDAK ikut - itu daftar lain, dan mencampurnya membuat lembar sehari
  // berisi pekerjaan sebulan tanpa disebut.
  const barisPutusan = await kueri(
    `SELECT pu.perkara_id AS perkaraId, pu.tanggal_putusan AS tanggalPutusan,
            (SELECT j.dihadiri_oleh
               FROM perkara_jadwal_sidang j
              WHERE j.perkara_id = pu.perkara_id
                AND j.tanggal_sidang = pu.tanggal_putusan
              ORDER BY j.urutan DESC
              LIMIT 1) AS dihadiriPutusan,
            pk.nomor_perkara AS nomorPerkara, pk.jenis_perkara_nama AS jenisPerkara,
            pk.alur_perkara_id AS alurPerkaraId, pk.jenis_perkara_id AS jenisPerkaraId
       FROM perkara_putusan pu
       LEFT JOIN perkara pk ON pk.perkara_id = pu.perkara_id
      WHERE pu.tanggal_putusan = ?
      ORDER BY pu.perkara_id
      LIMIT ?`,
    [tanggal, BATAS_BARIS + 1]
  );
  if (barisPutusan.length > BATAS_BARIS) {
    catatan.push(
      `Putusan pada tanggal ini lebih dari ${BATAS_BARIS} baris; yang diperiksa ` +
        `${BATAS_BARIS} pertama menurut nomor perkaranya.`
    );
    barisPutusan.length = BATAS_BARIS;
  }

  const perkaraIds = [
    ...new Set(
      [...barisRelaas, ...barisPbt, ...barisSidang, ...barisPutusan]
        .map((b) => bilangan(b.perkaraId))
        .filter((n) => n > 0)
    ),
  ];

  // Tanggal tanpa satu pun baris bukan kegagalan - itu jawaban yang sah, dan
  // hari tanpa panggilan memang ada. Kueri lanjutan dilewati supaya "IN ()"
  // yang kosong tidak pernah terbentuk.
  if (perkaraIds.length === 0) {
    return {
      ok: true,
      tanggal,
      diperiksaPada: new Date().toISOString(),
      ringkas: {
        relaas: 0,
        pemberitahuan: 0,
        perkara: 0,
        jurusita: 0,
        tanpaJurusita: 0,
        berselisih: 0,
        belumAdaRelaas: 0,
        tidakPerlu: 0,
        // Keenam kunci tetap disebut walau nol - lihat GOLONGAN.
        golongan: Object.fromEntries(GOLONGAN.map((g) => [g, 0])),
      },
      jurusita: [],
      catatan: catatan.concat(
        "Tidak ada relaas panggilan, pemberitahuan putusan, sidang, maupun putusan " +
          "yang bertanggal ini."
      ),
    };
  }

  // ==========================================================================
  // 3. SISI PIHAK, PENUNJUKAN, DAN SIAPA YANG PERNAH MEMANGGIL
  // ==========================================================================
  const isianPihak = TABEL_PIHAK.map(() => perkaraIds);
  const sisiPihak = await kueri(sqlSisiPihak(), isianPihak);

  // aktif='Y' berarti penunjukan pada PERKARA ITU masih berlaku - bukan
  // orangnya masih bertugas. Lihat kepala berkas; menukar keduanya membuang
  // pekerjaan juru sita yang sudah pindah tetapi penunjukannya belum diganti.
  const penunjukan = await kueri(
    `SELECT perkara_id AS perkaraId, jurusita_nama AS nama, jurusita_nip AS nip,
            urutan, tanggal_penetapan AS tanggalPenetapan
       FROM perkara_jurusita
      WHERE aktif = 'Y' AND perkara_id IN (?)
      ORDER BY perkara_id, urutan, id`,
    [perkaraIds]
  );

  // Seluruh relaas perkara itu, tanpa batas tanggal: yang ditanya "siapa yang
  // memanggil perkara ini", dan panggilannya jelas terjadi sebelum putusannya.
  const pemanggil = await kueri(
    `SELECT DISTINCT r.perkara_id AS perkaraId,
            COALESCE(NULLIF(u.fullname, ''), NULLIF(r.diinput_oleh, '')) AS nama
       FROM perkara_pelaksanaan_relaas r
       LEFT JOIN sys_users u ON u.userid = r.jurusita_id
      WHERE r.perkara_id IN (?)`,
    [perkaraIds]
  );

  // NIP tidak ada di sys_users - dicari, tidak ada. Satu-satunya tempatnya
  // perkara_jurusita, jadi diambil dari seluruh tabel (hanya belasan baris
  // sesudah dikelompokkan) supaya juru sita yang hari ini hanya memanggil pun
  // tetap ber-NIP.
  const nipPerNama = await kueri(
    `SELECT jurusita_nama AS nama, jurusita_nip AS nip, COUNT(*) AS n
       FROM perkara_jurusita
      WHERE jurusita_nip IS NOT NULL AND jurusita_nip <> ''
      GROUP BY jurusita_nama, jurusita_nip`
  );

  // ==========================================================================
  // 3b. SUDAH ADA RELAASNYA ATAU BELUM - DIPERIKSA PER PIHAK, BUKAN PER SIDANG
  // ==========================================================================
  //
  // Satu sidang dapat punya relaas untuk satu pihak dan belum untuk lawannya.
  // Diukur pada 4.995 sidang pertama yang berelaas: 1.617 hanya satu sisi yang
  // dipanggil. Memeriksa per SIDANG akan menyatakan "sudah ada" lalu melewatkan
  // pihak yang justru belum dipanggil.
  //
  // Syarat perkaranya disebut juga di sini, sebab sidang_id yang sama dipakai
  // 103 baris relaas milik perkara lain.
  const sidangIds = [...new Set(barisSidang.map((b) => bilangan(b.sidangId)).filter((n) => n > 0))];
  const relaasSidang =
    sidangIds.length === 0
      ? []
      : await kueri(
          `SELECT sidang_id AS sidangId, perkara_id AS perkaraId, pihak_id AS pihakId
             FROM perkara_pelaksanaan_relaas
            WHERE sidang_id IN (?) AND perkara_id IN (?)`,
          [sidangIds, perkaraIds]
        );

  // Pemberitahuan putusan yang SUDAH ada untuk perkara yang putus hari ini -
  // tanpa batas tanggal, sebab pemberitahuan lazim dibuat beberapa hari sesudah
  // putusannya. Yang ditanya "sudah ada atau belum", bukan "dibuat hari itu".
  const perkaraPutusanIds = [
    ...new Set(barisPutusan.map((b) => bilangan(b.perkaraId)).filter((n) => n > 0)),
  ];
  const pbtAda =
    perkaraPutusanIds.length === 0
      ? []
      : await kueri(
          `SELECT perkara_id AS perkaraId, pihak AS pihakKe, pihak_id AS pihakBarisId
             FROM perkara_putusan_pemberitahuan_putusan
            WHERE perkara_id IN (?)`,
          [perkaraPutusanIds]
        );

  // ==========================================================================
  // 4. PETA BANTU
  // ==========================================================================
  const sisiLewatPihakId = new Map(); // "perkaraId:pihakId" -> { pihakKe, nama }
  const sisiLewatBarisId = new Map(); // "perkaraId:pihakKe:barisId" -> nama
  // "perkaraId:pihakKe" -> daftar pihak pada sisi itu. Dipakai yang BELUM ada
  // relaasnya: satu baris pekerjaan per ORANG, sebab satu relaas satu orang.
  const pihakPerSisi = new Map();
  for (const s of sisiPihak) {
    const perkaraId = bilangan(s.perkaraId);
    const pihakKe = bilangan(s.pihakKe);
    const nama = bersih(s.nama);
    const pihakId = bilangan(s.pihakId);
    const barisId = bilangan(s.barisId);
    sisiLewatPihakId.set(`${perkaraId}:${pihakId}`, { pihakKe, nama });
    sisiLewatBarisId.set(`${perkaraId}:${pihakKe}:${barisId}`, nama);
    const kunciSisi = `${perkaraId}:${pihakKe}`;
    if (!pihakPerSisi.has(kunciSisi)) pihakPerSisi.set(kunciSisi, []);
    pihakPerSisi.get(kunciSisi).push({ pihakId, barisId, nama });
  }

  // Relaas yang sudah ada untuk sidang hari ini, dikunci sidang + pihak.
  // `relaasAdaSidang` dipakai HANYA bila sisi pihaknya tidak diketahui - di situ
  // pertanyaannya turun menjadi "ada relaas apa pun untuk sidang ini".
  const relaasAdaKunci = new Set();
  const relaasAdaSidang = new Set();
  for (const r of relaasSidang) {
    relaasAdaKunci.add(`${bilangan(r.sidangId)}:${bilangan(r.pihakId)}`);
    relaasAdaSidang.add(bilangan(r.sidangId));
  }
  // Pemberitahuan yang sudah ada, dikunci perkara + sisi + baris pihak.
  // pihak_id pada tabel pemberitahuan menunjuk perkara_pihakN.id (baris), BUKAN
  // pihak_id seperti pada tabel relaas - komentar kolomnya "id pihak dari
  // masing2 tabel pihak". Kolom senama, arti berbeda; itu sudah pernah menjebak.
  const pbtAdaKunci = new Set();
  const pbtAdaPerkara = new Set();
  for (const b of pbtAda) {
    const perkaraId = bilangan(b.perkaraId);
    const pihakKe = bilangan(b.pihakKe);
    pbtAdaKunci.add(`${perkaraId}:${pihakKe}:${bilangan(b.pihakBarisId)}`);
    pbtAdaPerkara.add(perkaraId);
  }

  // ==========================================================================
  // SATU PERKARA BISA PUNYA DUA BARIS PENUNJUKAN AKTIF - DAN ITU DUA HAL
  // ==========================================================================
  //
  // Diukur sendiri pada sipp_donggala 25 September 2026, dan hasilnya MEMBANTAH
  // separuh dugaan yang dibawa ke pekerjaan ini ("tidak ada perkara dengan
  // lebih dari satu juru sita aktif"):
  //
  //   18 perkara punya lebih dari satu BARIS aktif=Y (perkara 6255 tiga baris);
  //   13 di antaranya barisnya menyebut nama yang sama persis - baris kembar,
  //      biasanya satu ber-NIP dan satu tidak (contoh perkara 9850: Mustini
  //      dua kali, 11 Jun ber-NIP dan 18 Agu tanpa NIP);
  //    5 sisanya "Mohammad Syukri" lawan "Mohammad Syukri, S.H." - satu orang
  //      dengan dua ejaan.
  //
  // Jadi pada tingkat ORANG dugaannya benar: NOL perkara punya dua juru sita
  // aktif yang berbeda. Pada tingkat BARIS ia salah. Dua-duanya perlu
  // dibedakan, sebab yang satu cuma baris kembar dan yang lain akan berarti
  // dua orang mengerjakan satu perkara - dan hanya yang kedua yang gawat.
  const penunjukanPerkara = new Map();
  const kunciPerPerkara = new Map();
  for (const p of penunjukan) {
    const perkaraId = bilangan(p.perkaraId);
    const nama = namaTerbaca(p.nama);
    if (nama) {
      if (!kunciPerPerkara.has(perkaraId)) kunciPerPerkara.set(perkaraId, new Set());
      kunciPerPerkara.get(perkaraId).add(normalNama(nama));
    }
    const lama = penunjukanPerkara.get(perkaraId);
    if (!lama) {
      penunjukanPerkara.set(perkaraId, { nama, nip: bersih(p.nip), barisKembar: 0 });
      continue;
    }
    lama.barisKembar += 1;
    // NIP yang terisi mengalahkan yang kosong. Baris kembar sering hanya
    // berbeda di situ, dan lembar cetak tanpa NIP menyulitkan yang
    // menandatanganinya.
    if (!lama.nip && bersih(p.nip)) lama.nip = bersih(p.nip);
    if (!lama.nama && nama) lama.nama = nama;
  }

  const perkaraDuaOrang = [...kunciPerPerkara.entries()]
    .filter(([, kumpulan]) => kumpulan.size > 1)
    .map(([perkaraId]) => perkaraId);
  if (perkaraDuaOrang.length > 0) {
    catatan.push(
      `${perkaraDuaOrang.length} perkara punya DUA NAMA juru sita berbeda yang penunjukannya ` +
        `sama-sama masih berlaku (perkara ${perkaraDuaOrang.slice(0, 5).join(", ")}); ` +
        `yang dipakai urutan terkecil. Ini membantah ukuran yang menyatakan nol - periksa SIPP.`
    );
  }
  const perkaraBarisKembar = [...penunjukanPerkara.entries()]
    .filter(([perkaraId, v]) => v.barisKembar > 0 && !perkaraDuaOrang.includes(perkaraId))
    .map(([perkaraId]) => perkaraId);
  if (perkaraBarisKembar.length > 0) {
    catatan.push(
      `${perkaraBarisKembar.length} perkara punya lebih dari satu baris penunjukan aktif yang ` +
        `menyebut ORANG YANG SAMA (perkara ${perkaraBarisKembar.slice(0, 5).join(", ")}); ` +
        `baris kembar pada SIPP, tidak mengubah siapa juru sitanya.`
    );
  }

  const pemanggilPerkara = new Map();
  for (const p of pemanggil) {
    const perkaraId = bilangan(p.perkaraId);
    const nama = namaTerbaca(p.nama);
    if (!nama) continue;
    if (!pemanggilPerkara.has(perkaraId)) pemanggilPerkara.set(perkaraId, []);
    pemanggilPerkara.get(perkaraId).push(nama);
  }

  // ==========================================================================
  // NIP DIPILIH MENURUT BENTUKNYA LEBIH DAHULU, BUKAN MENURUT YANG TERSERING
  // ==========================================================================
  //
  // NIP resmi 18 angka. Terukur pada satker: "Mustini" tercatat dengan DUA
  // NIP - 197707032005022 (15 angka, 479 baris) dan 197707032005022002
  // (18 angka, 364 baris). Yang tersering justru yang terpotong, jadi memilih
  // menurut jumlah baris akan mencetak NIP cacat pada lembar resmi.
  //
  // Karena itu urutannya: yang 18 angka lebih dahulu, baru yang tersering. Bila
  // satu nama punya lebih dari satu NIP, itu disebutkan - bukan didiamkan.
  const nipVarian = new Map(); // kunci nama -> [{ nip, n }]
  const namaPerNip = new Map(); // nip -> Set nama mentah
  for (const baris of nipPerNama) {
    const kunci = normalNama(baris.nama);
    const nip = bersih(baris.nip);
    if (!kunci || !nip) continue;
    if (!nipVarian.has(kunci)) nipVarian.set(kunci, []);
    nipVarian.get(kunci).push({ nip, n: bilangan(baris.n) });
    if (!namaPerNip.has(nip)) namaPerNip.set(nip, new Set());
    namaPerNip.get(nip).add(bersih(baris.nama));
  }
  const nipKunci = new Map(); // kunci nama -> { nip, varian }
  for (const [kunci, daftarNip] of nipVarian.entries()) {
    const unik = new Map();
    for (const v of daftarNip) unik.set(v.nip, (unik.get(v.nip) || 0) + v.n);
    const terurut = [...unik.entries()]
      .map(([nip, n]) => ({ nip, n, resmi: /^\d{18}$/.test(nip) }))
      .sort((a, b) => Number(b.resmi) - Number(a.resmi) || b.n - a.n || a.nip.localeCompare(b.nip));
    nipKunci.set(kunci, { nip: terurut[0].nip, varian: terurut });
  }

  // ==========================================================================
  // 5. MENYUSUN BARIS
  // ==========================================================================
  const kelompok = new Map(); // kunci nama -> { ejaan:Map, baris:[] }
  let tanpaJurusita = 0;
  let berselisihTotal = 0;
  let tanpaNamaPihak = 0;
  let tanpaSisiPihak = 0;
  let sandiAsing = 0;
  let pbtTanpaPenunjukan = 0;
  let pbtTidakDapatDisilangkan = 0;
  let relaasTanpaSidang = 0;
  let relaasSidangPerkaraLain = 0;
  let nomorSidangBerselisih = 0;
  let pihakTidakDiketahui = 0;
  let sisiTanpaPihak = 0;
  let belumAdaRelaasTotal = 0;
  // Sidang/putusan yang dihadiri SEMUA pihak (sandi 1) - bukan pekerjaan, dan
  // karena itu tidak menjadi baris; jumlahnya tetap disebut supaya "tidak ada
  // baris" dapat dibedakan dari "tidak terbaca".
  let tidakPerluSidang = 0;
  let tidakPerluPutusan = 0;
  const hitungGolongan = Object.fromEntries(GOLONGAN.map((g) => [g, 0]));

  /**
   * Menghitung golongan tiap baris pada satu tempat.
   *
   * Golongan "" (sidangnya tidak terbaca) dihitung sebagai "tidak-terbaca",
   * bukan dibuang: jumlah seluruh golongan WAJIB sama dengan jumlah seluruh
   * baris, dan itu yang dijaga uji. Hitungan yang tidak berjumlah membuat layar
   * menggambar sebagian dan tampak lengkap.
   */
  function catatGolongan(golongan) {
    const kunci = golongan || "tidak-terbaca";
    if (Object.prototype.hasOwnProperty.call(hitungGolongan, kunci)) {
      hitungGolongan[kunci] += 1;
      return;
    }
    hitungGolongan["tidak-terbaca"] += 1;
  }

  function tambah(namaMentah, baris) {
    const nama = namaMentah || NAMA_TIDAK_TERCATAT;
    const kunci = nama === NAMA_TIDAK_TERCATAT ? NAMA_TIDAK_TERCATAT : normalNama(nama);
    if (!kelompok.has(kunci)) kelompok.set(kunci, { kunci, ejaan: new Map(), baris: [] });
    const isi = kelompok.get(kunci);
    isi.ejaan.set(nama, (isi.ejaan.get(nama) || 0) + 1);
    isi.baris.push(baris);
  }

  for (const b of barisRelaas) {
    const perkaraId = bilangan(b.perkaraId);
    const perkara = {
      nomorPerkara: bersih(b.nomorPerkara),
      jenisPerkara: bersih(b.jenisPerkara),
      alurPerkaraId: b.alurPerkaraId,
      jenisPerkaraId: b.jenisPerkaraId,
    };
    const sisi = sisiLewatPihakId.get(`${perkaraId}:${bilangan(b.pihakId)}`);
    if (!sisi) tanpaSisiPihak += 1;
    const namaPihak = sisi ? sisi.nama : "";
    if (!namaPihak) tanpaNamaPihak += 1;
    const cara = caraPanggil(b.sandiCara);
    if (!cara.terbaca && cara.sandi) sandiAsing += 1;
    const tglSidang = tanggalIso(b.tanggalSidang);
    if (!tglSidang) relaasTanpaSidang += 1;
    const nama = namaTerbaca(b.jurusita);
    if (!nama) tanpaJurusita += 1;

    // Sidang yang sidang_id-nya milik perkara lain: jadwalnya TIDAK dipakai,
    // dan kejadiannya dihitung. 103 baris se-riwayat, 0,7% - kecil, dan tetap
    // salah bila didiamkan.
    const sidangMilik = bilangan(b.sidangMilik);
    if (sidangMilik > 0 && sidangMilik !== perkaraId) relaasSidangPerkaraLain += 1;

    const nomorSidang = bilangan(b.urutanSidang);
    // Pemeriksaan atas arti kolom `urutan` - lihat kepala berkas. Yang bernomor
    // 1 wajib tidak berpendahulu, dan yang bernomor > 1 wajib berpendahulu.
    if (nomorSidang > 0 && (nomorSidang === 1) !== (bilangan(b.sidangLebihAwal) === 0)) {
      nomorSidangBerselisih += 1;
    }
    const golongan = golonganSidang({
      nomorSidang,
      ditunda: b.ditunda,
      ikrarTalak: b.ikrarTalak,
    });
    // Hanya dua golongan yang pihaknya ditentukan sandi kehadiran; sidang
    // pertama dan ikrar talak blangkonya memuat dua pihak sekaligus.
    const bergantungKehadiran = golongan === "sidang-ditunda" || golongan === "sidang-lanjutan";
    const sandiHadir = bergantungKehadiran ? sandiKehadiran(b.dihadiriSebelum) : null;
    const pihakPanggil = pihakUntukGolongan(golongan, sandiHadir);
    if (bergantungKehadiran && pihakPanggil === "tidak-diketahui") pihakTidakDiketahui += 1;
    catatGolongan(golongan);

    tambah(nama, {
      jenis: "panggilan",
      perkaraId,
      nomorPerkara: perkara.nomorPerkara,
      jenisPerkara: perkara.jenisPerkara,
      pihak: namaPihak,
      sebutanPihak: sisi ? sebutanPihakBaris(sisi.pihakKe, perkara) : "",
      tanggalSidang: tglSidang,
      tanggalPutusan: "",
      agenda: bersih(b.agenda),
      caraSandi: cara.sandi,
      caraLabel: cara.label,
      resi: bersih(b.resi),
      statusPos: statusPos(b.statusPos),
      adaBerkas: bersih(b.docRelaas) !== "",
      sumberJurusita: nama ? "panggilan" : "tidak tercatat",
      berselisih: false,
      namaPanggilan: "",
      golongan,
      urutanSidang: nomorSidang,
      dihadiriOleh: sandiHadir,
      pihakDipanggil: pihakPanggil,
      // Baris ini ADALAH relaasnya - ia tercatat pada tanggal yang diminta.
      sudahAdaRelaas: true,
    });
  }

  for (const b of barisPbt) {
    const perkaraId = bilangan(b.perkaraId);
    const perkara = {
      nomorPerkara: bersih(b.nomorPerkara),
      jenisPerkara: bersih(b.jenisPerkara),
      alurPerkaraId: b.alurPerkaraId,
      jenisPerkaraId: b.jenisPerkaraId,
    };
    const pihakKe = bilangan(b.pihakKe);
    const namaPihak = bersih(
      sisiLewatBarisId.get(`${perkaraId}:${pihakKe}:${bilangan(b.pihakBarisId)}`) || ""
    );
    if (!namaPihak) {
      tanpaNamaPihak += 1;
      tanpaSisiPihak += 1;
    }
    const cara = caraPanggil(b.sandiCara);
    if (!cara.terbaca && cara.sandi) sandiAsing += 1;

    // Aturan pengguna: yang memberitahukan putusan adalah juru sita yang
    // penunjukannya pada perkara itu masih berlaku.
    const tunjuk = penunjukanPerkara.get(perkaraId);
    const nama = tunjuk ? tunjuk.nama : "";
    if (!nama) {
      tanpaJurusita += 1;
      pbtTanpaPenunjukan += 1;
    }

    // Selisih diperiksa terhadap SELURUH nama yang pernah memanggil perkara
    // ini. Perkara tanpa relaas sama sekali tidak dapat dinilai - itu bukan
    // "cocok", dan bukan "berselisih"; jumlahnya disebutkan pada catatan.
    const daftarPemanggil = pemanggilPerkara.get(perkaraId) || [];
    let berselisih = false;
    let namaPanggilan = "";
    if (nama) {
      if (daftarPemanggil.length === 0) {
        pbtTidakDapatDisilangkan += 1;
      } else {
        const kunciTunjuk = normalNama(nama);
        const cocok = daftarPemanggil.some((x) => normalNama(x) === kunciTunjuk);
        if (!cocok) {
          berselisih = true;
          berselisihTotal += 1;
          namaPanggilan = [...new Set(daftarPemanggil)].join(", ");
        }
      }
    }

    catatGolongan("pemberitahuan-putusan");

    tambah(nama, {
      jenis: "pemberitahuan",
      perkaraId,
      nomorPerkara: perkara.nomorPerkara,
      jenisPerkara: perkara.jenisPerkara,
      pihak: namaPihak,
      sebutanPihak: pihakKe > 0 ? sebutanPihakBaris(pihakKe, perkara) : "",
      tanggalSidang: "",
      tanggalPutusan: tanggalIso(b.tanggalPutusan),
      agenda: "",
      caraSandi: cara.sandi,
      caraLabel: cara.label,
      resi: bersih(b.resi),
      statusPos: statusPos(b.statusPos),
      adaBerkas: bersih(b.docPbt) !== "",
      sumberJurusita: nama ? "penunjukan" : "tidak tercatat",
      berselisih,
      namaPanggilan,
      golongan: "pemberitahuan-putusan",
      // Pemberitahuan putusan tidak punya nomor sidang - ia bukan panggilan
      // sidang. 0 berarti "tidak berlaku", dan layar menggambarnya begitu.
      urutanSidang: 0,
      // Pihaknya disebut barisnya sendiri (kolom `pihak`), jadi tidak ada sandi
      // kehadiran yang menentukannya - dan karena itu dikosongkan alih-alih
      // diisi angka yang tidak dipakai.
      dihadiriOleh: null,
      pihakDipanggil: pihakKe === 1 ? "pertama" : pihakKe === 2 ? "kedua" : "tidak-diketahui",
      sudahAdaRelaas: true,
    });
  }

  // ==========================================================================
  // 5b. YANG RELAASNYA BELUM ADA - INILAH PEKERJAANNYA
  // ==========================================================================
  //
  // Satu baris per PIHAK, bukan per sidang: satu relaas satu orang, dan satu
  // sidang lazim berisi dua pihak yang tidak selalu dipanggil bersamaan.
  //
  // Yang relaasnya SUDAH ada dilewati di sini dengan sengaja - ia sudah muncul
  // pada lembar tanggal relaasnya sendiri. Bila ia diikutkan juga, lembar sehari
  // akan memuat pekerjaan yang sudah beres berbaur dengan yang belum, dan yang
  // membacanya harus memilah sendiri.
  //
  // Juru sitanya dari PENUNJUKAN yang masih berlaku - aturan yang sama dengan
  // pemberitahuan putusan, sebab pertanyaannya sama: belum ada relaas, jadi
  // belum ada siapa pun yang memanggil untuk ditanya.
  for (const b of barisSidang) {
    const perkaraId = bilangan(b.perkaraId);
    const sidangId = bilangan(b.sidangId);
    const perkara = {
      nomorPerkara: bersih(b.nomorPerkara),
      jenisPerkara: bersih(b.jenisPerkara),
      alurPerkaraId: b.alurPerkaraId,
      jenisPerkaraId: b.jenisPerkaraId,
    };
    const nomorSidang = bilangan(b.urutanSidang);
    if (nomorSidang > 0 && (nomorSidang === 1) !== (bilangan(b.sidangLebihAwal) === 0)) {
      nomorSidangBerselisih += 1;
    }
    const golongan = golonganSidang({
      nomorSidang,
      ditunda: b.ditunda,
      ikrarTalak: b.ikrarTalak,
    });
    const bergantungKehadiran = golongan === "sidang-ditunda" || golongan === "sidang-lanjutan";
    const sandiHadir = bergantungKehadiran ? sandiKehadiran(b.dihadiriSebelum) : null;
    const pihakPanggil = pihakUntukGolongan(golongan, sandiHadir);
    // Semua pihak hadir pada sidang sebelumnya: mereka diperintahkan datang lagi
    // di muka sidang, jadi tidak ada relaas yang perlu dibuat. Ini BUKAN
    // "tidak-diketahui" - SIPP sudah menjawabnya lewat borangnya.
    if (pihakPanggil === "tidak-perlu") {
      tidakPerluSidang += 1;
      continue;
    }
    const tunjuk = penunjukanPerkara.get(perkaraId);
    const nama = tunjuk ? tunjuk.nama : "";

    // Sisi yang tidak diketahui tetap dimunculkan SATU baris tanpa nama pihak.
    // Menghilangkannya berarti juru sita tidak pernah tahu ada sidang yang
    // pihaknya perlu ditanyakan - dan 1.354 baris kehadiran kosong membuat itu
    // bukan keadaan langka.
    const sasaran = [];
    for (const sisi of sisiUntukPihak(pihakPanggil)) {
      const daftarPihak = pihakPerSisi.get(`${perkaraId}:${sisi}`) || [];
      if (daftarPihak.length === 0) {
        sasaran.push({ sisi, pihak: null });
        continue;
      }
      for (const p of daftarPihak) sasaran.push({ sisi, pihak: p });
    }
    if (sasaran.length === 0) sasaran.push({ sisi: 0, pihak: null });

    for (const s of sasaran) {
      const sudah = s.pihak
        ? relaasAdaKunci.has(`${sidangId}:${s.pihak.pihakId}`)
        : relaasAdaSidang.has(sidangId);
      if (sudah) continue;
      if (bergantungKehadiran && pihakPanggil === "tidak-diketahui") pihakTidakDiketahui += 1;
      if (!s.pihak) sisiTanpaPihak += 1;
      if (!nama) tanpaJurusita += 1;
      belumAdaRelaasTotal += 1;
      catatGolongan(golongan);
      tambah(nama, {
        jenis: "panggilan",
        perkaraId,
        nomorPerkara: perkara.nomorPerkara,
        jenisPerkara: perkara.jenisPerkara,
        pihak: s.pihak ? s.pihak.nama : "",
        sebutanPihak: s.sisi > 0 ? sebutanPihakBaris(s.sisi, perkara) : "",
        tanggalSidang: tanggalIso(b.tanggalSidang),
        tanggalPutusan: "",
        agenda: bersih(b.agenda),
        // Belum ada relaas, jadi belum ada cara panggil, resi, maupun berkasnya.
        // Dikosongkan, bukan diisi "belum bertemu" - itu dua hal berbeda.
        caraSandi: "",
        caraLabel: "",
        resi: "",
        statusPos: statusPos(null),
        adaBerkas: false,
        sumberJurusita: nama ? "penunjukan" : "tidak tercatat",
        berselisih: false,
        namaPanggilan: "",
        golongan,
        urutanSidang: nomorSidang,
        dihadiriOleh: sandiHadir,
        pihakDipanggil: pihakPanggil,
        sudahAdaRelaas: false,
      });
    }
  }

  // ==========================================================================
  // 5c. PUTUSAN HARI INI YANG BELUM ADA PEMBERITAHUANNYA
  // ==========================================================================
  //
  // Yang hadir saat putusan dibacakan sudah mendengarnya; yang TIDAK hadir
  // berhak diberi tahu. Karena itu sandi kehadiran di sini dibaca dari sidang
  // pada tanggal putusannya - bukan dari sidang sebelumnya seperti pada
  // panggilan, sebab yang ditanya kehadiran pada pembacaan itu sendiri.
  for (const b of barisPutusan) {
    const perkaraId = bilangan(b.perkaraId);
    const perkara = {
      nomorPerkara: bersih(b.nomorPerkara),
      jenisPerkara: bersih(b.jenisPerkara),
      alurPerkaraId: b.alurPerkaraId,
      jenisPerkaraId: b.jenisPerkaraId,
    };
    const sandiHadir = sandiKehadiran(b.dihadiriPutusan);
    const pihakPanggil = pihakDipanggilDariSandi(sandiHadir);
    // Semua pihak hadir saat putusan dibacakan: tidak ada yang perlu diberi tahu.
    if (pihakPanggil === "tidak-perlu") {
      tidakPerluPutusan += 1;
      continue;
    }
    const tunjuk = penunjukanPerkara.get(perkaraId);
    const nama = tunjuk ? tunjuk.nama : "";

    // Aturan penunjukan disilangkan dengan yang pernah memanggil, sama seperti
    // baris pemberitahuan yang sudah tercatat - aturannya satu, jadi
    // pemeriksaannya juga satu.
    const daftarPemanggil = pemanggilPerkara.get(perkaraId) || [];
    let berselisih = false;
    let namaPanggilan = "";
    if (nama && daftarPemanggil.length > 0) {
      const kunciTunjuk = normalNama(nama);
      if (!daftarPemanggil.some((x) => normalNama(x) === kunciTunjuk)) {
        berselisih = true;
        namaPanggilan = [...new Set(daftarPemanggil)].join(", ");
      }
    }

    const sasaran = [];
    for (const sisi of sisiUntukPihak(pihakPanggil)) {
      const daftarPihak = pihakPerSisi.get(`${perkaraId}:${sisi}`) || [];
      if (daftarPihak.length === 0) {
        sasaran.push({ sisi, pihak: null });
        continue;
      }
      for (const p of daftarPihak) sasaran.push({ sisi, pihak: p });
    }
    if (sasaran.length === 0) sasaran.push({ sisi: 0, pihak: null });

    for (const s of sasaran) {
      const sudah = s.pihak
        ? pbtAdaKunci.has(`${perkaraId}:${s.sisi}:${s.pihak.barisId}`)
        : pbtAdaPerkara.has(perkaraId);
      if (sudah) continue;
      if (pihakPanggil === "tidak-diketahui") pihakTidakDiketahui += 1;
      if (!s.pihak) sisiTanpaPihak += 1;
      if (!nama) {
        tanpaJurusita += 1;
        pbtTanpaPenunjukan += 1;
      } else if (daftarPemanggil.length === 0) {
        pbtTidakDapatDisilangkan += 1;
      }
      if (berselisih) berselisihTotal += 1;
      belumAdaRelaasTotal += 1;
      catatGolongan("pemberitahuan-putusan");
      tambah(nama, {
        jenis: "pemberitahuan",
        perkaraId,
        nomorPerkara: perkara.nomorPerkara,
        jenisPerkara: perkara.jenisPerkara,
        pihak: s.pihak ? s.pihak.nama : "",
        sebutanPihak: s.sisi > 0 ? sebutanPihakBaris(s.sisi, perkara) : "",
        tanggalSidang: "",
        tanggalPutusan: tanggalIso(b.tanggalPutusan),
        agenda: "",
        caraSandi: "",
        caraLabel: "",
        resi: "",
        statusPos: statusPos(null),
        adaBerkas: false,
        sumberJurusita: nama ? "penunjukan" : "tidak tercatat",
        berselisih,
        namaPanggilan,
        golongan: "pemberitahuan-putusan",
        urutanSidang: 0,
        dihadiriOleh: sandiHadir,
        pihakDipanggil: pihakPanggil,
        sudahAdaRelaas: false,
      });
    }
  }

  // ==========================================================================
  // 6. MEMILIH EJAAN YANG DIPAKAI, DAN MENYEBUT YANG LAIN
  // ==========================================================================
  //
  // Satu orang dapat muncul dengan dua ejaan pada satu hari - "Mohammad
  // Syukri" dari penunjukan dan "Mohammad Syukri, S.H." dari relaas. Keduanya
  // satu kunci, jadi satu entri; yang ditulis ejaan yang paling sering muncul
  // hari itu, dan bila seri yang lebih panjang - ia yang lebih lengkap.
  const daftar = [...kelompok.values()].map((isi) => {
    const ejaan = [...isi.ejaan.entries()].sort(
      (a, b) => b[1] - a[1] || b[0].length - a[0].length || a[0].localeCompare(b[0])
    );
    const nama = ejaan[0][0];
    const catatanNip = isi.kunci === NAMA_TIDAK_TERCATAT ? null : nipKunci.get(isi.kunci) || null;
    const nip = catatanNip ? catatanNip.nip : "";
    if (catatanNip && catatanNip.varian.length > 1) {
      catatan.push(
        `"${nama}" tercatat dengan ${catatanNip.varian.length} NIP berbeda pada perkara_jurusita ` +
          `(${catatanNip.varian.map((v) => `${v.nip} pada ${v.n} baris`).join("; ")}); ` +
          `yang dicetak ${nip} sebab bentuk 18 angka yang resmi.`
      );
    }
    if (ejaan.length > 1) {
      catatan.push(
        `Nama "${nama}" ditulis ${ejaan.length} cara berbeda pada tanggal ini ` +
          `(${ejaan.map((e) => `"${e[0]}"`).join(", ")}); disatukan sebab hanya ` +
          `gelar sesudah koma dan titik yang berbeda.`
      );
    }
    // relaas dan pemberitahuan menghitung yang SUDAH tercatat pada tanggal itu -
    // artinya tidak berubah dari sebelum golongan ada, supaya angka pada lembar
    // cetak lama tetap berarti hal yang sama. Yang belum ada relaasnya dihitung
    // tersendiri, sehingga relaas + pemberitahuan + belumAdaRelaas = jumlah
    // barisnya, dan itu dijaga uji.
    return {
      nama,
      nip,
      relaas: isi.baris.filter((x) => x.jenis === "panggilan" && x.sudahAdaRelaas).length,
      pemberitahuan: isi.baris.filter((x) => x.jenis === "pemberitahuan" && x.sudahAdaRelaas)
        .length,
      belumAdaRelaas: isi.baris.filter((x) => !x.sudahAdaRelaas).length,
      baris: isi.baris,
    };
  });

  // "tidak tercatat" diletakkan terakhir, tetapi TIDAK dibuang. Nol baris tanpa
  // nama akan terbaca "seluruhnya bernama", dan justru ketidaklengkapannya yang
  // perlu diketahui.
  daftar.sort((a, b) => {
    if (a.nama === NAMA_TIDAK_TERCATAT) return 1;
    if (b.nama === NAMA_TIDAK_TERCATAT) return -1;
    // Beban = SELURUH barisnya, termasuk yang relaasnya belum ada. Menghitung
    // hanya yang tercatat akan menaruh juru sita yang seluruh pekerjaannya
    // belum dikerjakan di dasar daftar - justru yang paling perlu dilihat.
    const bebanA = a.baris.length;
    const bebanB = b.baris.length;
    return bebanB - bebanA || a.nama.localeCompare(b.nama);
  });

  // ==========================================================================
  // 7. CATATAN - YANG TIDAK TERBACA DISEBUT TIDAK TERBACA
  // ==========================================================================
  if (tanpaSisiPihak > 0) {
    catatan.push(
      `${tanpaSisiPihak} baris pihaknya tidak ditemukan di perkara_pihak1..5 untuk ` +
        `perkaranya, sehingga nama dan sebutan pihaknya dikosongkan - bukan ditebak.`
    );
  }
  if (tanpaNamaPihak > 0 && tanpaNamaPihak !== tanpaSisiPihak) {
    catatan.push(`${tanpaNamaPihak} baris nama pihaknya kosong pada SIPP.`);
  }
  if (sandiAsing > 0) {
    catatan.push(
      `${sandiAsing} baris bersandi cara panggil yang tidak ada pada komentar kolom SIPP; ` +
        `hurufnya ditampilkan apa adanya, artinya tidak dikarang.`
    );
  }
  if (relaasTanpaSidang > 0) {
    catatan.push(
      `${relaasTanpaSidang} relaas panggilan sidang_id-nya tidak bertemu ` +
        `perkara_jadwal_sidang perkaranya sendiri, jadi tanggal sidang, agenda, ` +
        `dan golongannya kosong - bukan ditebak.`
    );
  }
  if (relaasSidangPerkaraLain > 0) {
    catatan.push(
      `${relaasSidangPerkaraLain} relaas panggilan sidang_id-nya menunjuk jadwal sidang ` +
        `PERKARA LAIN, jadi jadwal itu tidak dipakai. Se-riwayat terukur 103 dari 14.495 ` +
        `baris (0,7%) - cacat data SIPP, bukan cacat pembacaan.`
    );
  }
  if (nomorSidangBerselisih > 0) {
    catatan.push(
      `${nomorSidangBerselisih} baris nomor sidangnya (kolom urutan) berselisih dengan ` +
        `urutan kronologis sidang perkaranya. Diukur 25 September 2026 selisih itu NOL pada ` +
        `seluruh 20.109 baris; bila ia muncul, arti kolomnya berubah dan golongan ` +
        `"sidang-pertama" perlu diperiksa ulang.`
    );
  }
  if (pihakTidakDiketahui > 0) {
    catatan.push(
      `${pihakTidakDiketahui} baris pihak yang harus dipanggil TIDAK dapat ditentukan: sandi ` +
        `kehadirannya kosong atau tidak dapat dipetakan ke satu blangko (terukur 1.354 baris ` +
        `kosong dan 4 bersandi 10 dari 20.109). Tanyakan kepada juru sitanya - jangan ` +
        `dianggap "semua sudah hadir".`
    );
  }
  if (tidakPerluSidang > 0 || tidakPerluPutusan > 0) {
    catatan.push(
      `${tidakPerluSidang} sidang dan ${tidakPerluPutusan} putusan pada tanggal ini dihadiri ` +
        `SEMUA pihak (sandi 1 "Semua Pihak" pada borang SIPP), jadi tidak ada relaas maupun ` +
        `pemberitahuan yang perlu dibuat untuknya dan tidak ditampilkan sebagai pekerjaan.`
    );
  }
  if (sisiTanpaPihak > 0) {
    catatan.push(
      `${sisiTanpaPihak} baris pekerjaan sisi pihaknya tidak punya baris di perkara_pihak1..5, ` +
        `jadi nama pihaknya kosong. Barisnya tetap ditampilkan supaya sidangnya tidak hilang.`
    );
  }
  if (pbtTanpaPenunjukan > 0) {
    catatan.push(
      `${pbtTanpaPenunjukan} baris pemberitahuan putusan perkaranya tidak punya penunjukan ` +
        `juru sita yang masih berlaku, jadi juru sitanya tidak dapat ditentukan.`
    );
  }
  if (pbtTidakDapatDisilangkan > 0) {
    catatan.push(
      `${pbtTidakDapatDisilangkan} baris pemberitahuan putusan perkaranya belum punya relaas ` +
        `panggilan sama sekali, jadi penunjukannya tidak dapat disilangkan - ini bukan "cocok".`
    );
  }
  // NIP yang sama dipakai dua nama berbeda menandakan salah satunya nama
  // login, bukan nama orang - "jsp5" memakai NIP Aguslin pada tiga perkara.
  // Keduanya TIDAK disatukan: menyatukannya berarti menebak.
  const namaHariIni = new Set(daftar.map((x) => normalNama(x.nama)));
  for (const [nip, kumpulan] of namaPerNip.entries()) {
    if (kumpulan.size < 2) continue;
    const kunciKumpulan = [...new Set([...kumpulan].map((x) => normalNama(x)))];
    if (kunciKumpulan.length < 2) continue;
    if (!kunciKumpulan.some((k) => namaHariIni.has(k))) continue;
    catatan.push(
      `NIP ${nip} tercatat atas ${kunciKumpulan.length} nama berbeda ` +
        `(${[...kumpulan].map((x) => `"${x}"`).join(", ")}); ` +
        `kemungkinan salah satunya nama login, bukan nama orang. Tidak disatukan.`
    );
  }

  const perkaraTersentuh = new Set();
  for (const isi of daftar) {
    for (const baris of isi.baris) perkaraTersentuh.add(baris.perkaraId);
  }

  return {
    ok: true,
    tanggal,
    diperiksaPada: new Date().toISOString(),
    ringkas: {
      relaas: barisRelaas.length,
      pemberitahuan: barisPbt.length,
      // Perkara yang tersentuh KEDUA belahan - yang relaasnya sudah tercatat dan
      // yang belum. Angkanya karena itu memang naik dibanding sebelum belahan
      // kedua ada: 18 Agustus 2026 terukur 34 menjadi 43, sebab 9 baris
      // pekerjaan jatuh pada perkara yang hari itu belum berelaas sama sekali.
      perkara: perkaraTersentuh.size,
      // "tidak tercatat" bukan juru sita, jadi tidak ikut dihitung sebagai orang.
      jurusita: daftar.filter((x) => x.nama !== NAMA_TIDAK_TERCATAT).length,
      tanpaJurusita,
      berselisih: berselisihTotal,
      // Pekerjaan yang sesungguhnya: sidang atau putusan pada tanggal ini yang
      // relaasnya belum ada. relaas + pemberitahuan + belumAdaRelaas = jumlah
      // seluruh baris; itu dijaga uji supaya tidak ada baris yang hilang dari
      // hitungan sambil tetap tampil di layar.
      belumAdaRelaas: belumAdaRelaasTotal,
      // Sidang dan putusan yang dihadiri semua pihak - tidak menjadi baris,
      // sebab tidak ada yang perlu dipanggil atau diberi tahu. Ruas tambahan;
      // ruas lain tidak berubah arti.
      tidakPerlu: tidakPerluSidang + tidakPerluPutusan,
      // Hitungan per golongan, keenam kunci selalu ada. Jumlahnya WAJIB sama
      // dengan jumlah seluruh baris - dijaga uji.
      golongan: hitungGolongan,
    },
    jurusita: daftar,
    catatan,
  };
}

/**
 * ============================================================================
 * ANTRIAN CETAK HARIAN - "HARI ITU" ADALAH HARI MENCETAK, BUKAN HARI SIDANG
 * ============================================================================
 *
 * Keputusan pengguna 25 September 2026: tombol cetak relaas di antrian ALETA
 * Sidang, "otomatis juga mengambil hari itu yang baru daftar". relaasMassal()
 * di atas menjawab pertanyaan lain - REKAP relaas yang tercatat pada suatu
 * tanggal dan sidang yang JATUH pada tanggal itu. Yang ini menjawab: dokumen
 * apa yang LAHIR pada hari juru sita mencetak.
 *
 * Empat jalan masuk, dan masing-masing diukur di sipp_donggala 25 Sep 2026:
 *
 *   (a) didaftarkan  perkara dengan tanggal_pendaftaran = T ATAU
 *                    perkara_penetapan.penetapan_hari_sidang = T -> panggilan
 *                    sidang ke-1 (d = 1), dua pihak. 1.753 dari 1.759 perkara
 *                    sejak 2025 PHS-nya setanggal pendaftarannya, dan jadwal
 *                    ke-1 diinput pada hari pendaftaran 1.743/1.759 - jadi yang
 *                    baru daftar hari itu memang sudah dapat dicetak hari itu.
 *                    Tanpa jadwal ke-1 -> tertunda "jadwal-pertama-belum-ada".
 *
 *   (b) ditunda      sidang j bertanggal T yang PUNYA sidang berikutnya n
 *                    (n.urutan = j.urutan + 1) -> panggilan untuk n, d = n.urutan
 *                    (sidang TUJUAN, bukan sidang asal). Pihaknya dari
 *                    j.dihadiri_oleh; sandi 1 -> tidakPerlu. Bila n berpenanda
 *                    ikrar_talak, golongannya ikrar-talak dan pihaknya keduanya.
 *                    "Ada sidang berikutnya" dipakai, bukan kolom ditunda:
 *                    ditunda='Y' 2.241 lawan 'T' 160 di antara sidang yang
 *                    punya sidang berikutnya.
 *
 *   (c) jadwal-baru  JARING: jadwal n yang diinput pada T dan belum tercakup
 *                    (a)/(b). Diukur atas SELURUH 1.907 jadwal yang diinput
 *                    2026: (a) mencakup 794, (b) 989, sisanya 124 - dan dari
 *                    124 itu 3 sidangnya sudah lewat dan 33 jatuh pada hari
 *                    input itu sendiri (contoh 4 Sep 2026: empat Pdt.P diinput
 *                    "admin" pukul 22.44-22.49 untuk sidang pagi itu, yang
 *                    putusannya pun hari itu). Itu PENCATATAN SUSULAN, bukan
 *                    panggilan, jadi jaring dipersempit ke sidang yang
 *                    tanggalnya SESUDAH T. Yang tersisa 88: 52 penetapan hari
 *                    sidang ikrar talak - persis yang jaring ini dimaksudkan -
 *                    dan 36 sidang lanjutan yang jadwalnya diinput 1-43 hari
 *                    sesudah sidang sebelumnya.
 *
 *   (d) diputus      perkara_putusan.tanggal_putusan = T -> pemberitahuan
 *                    putusan, SATU dokumen per perkara (ABT tidak punya
 *                    parameter pihak). Kehadiran dibaca dari sidang bertanggal
 *                    T yang urutannya terbesar: 1 -> tidakPerlu, 2 -> pihak
 *                    kedua, 3 -> pihak pertama, 4 -> keduanya, lainnya
 *                    tidak-diketahui.
 *
 * Sidang bertanggal T tanpa sidang berikutnya dan tanpa putusan hari itu
 * dipilah lagi, sebab diukur atas 2026 (sampai 16 Sep) ia 107 sidang yang
 * bukan satu keadaan: 55 sidang IKRAR TALAK yang ikrarnya tercatat
 * (perkara_ikrar_talak.tgl_ikrar_talak terisi pada 50, kosong pada 5), 2
 * sidang sesudah putusan yang tidak berpenanda ikrar, dan 50 yang memang
 * belum diputus. Ikrar yang tercatat = perkara selesai, TIDAK ada yang
 * dipanggil - menyebutnya "hasil sidang belum dicatat" akan menyuruh orang
 * mencari sesuatu yang tidak ada. Sisanya menjadi `tertunda` dengan sebabnya.
 *
 * Juru sita tiap dokumen = perkara_jurusita aktif='Y' (penunjukan yang masih
 * berlaku pada perkaranya; cocok 98,7% dengan yang memanggil - lihat kepala
 * berkas). Ejaan namanya DISERAGAMKAN dalam satu jawaban, sebab ia menjadi
 * nama folder unduhan: "Mohammad Syukri" dan "Mohammad Syukri, S.H." satu orang
 * dan harus satu folder.
 *
 * sudahAdaRelaas dinilai PER PIHAK pada sidang tujuan (relaas.sidang_id adalah
 * sidang yang DIPANGGIL - 2.325 dari 2.325 relaas 2026 bertanggal pada atau
 * sebelum sidangnya), dan untuk pemberitahuan per baris pihak. Sebagian pihak
 * saja -> false (masih ada pekerjaan). Pihak tidak diketahui dan hanya
 * sebagian yang berelaas -> null: tidak dapat dinilai, bukan "sudah".
 *
 * Sesudah telaah 25 September 2026 (masing-masing dijaga relaas-cetak-
 * harian.test.ts atas data sungguhan):
 *   - (a) memanggil sidang yang DITETAPKAN (PHS ulang), dan jadwal yang baru
 *     diinput sesudah T tertunda - lihat jalan (a).
 *   - sandi 1 yang alasan/agendanya menyebut panggilan, dan sidang sesudah
 *     putusan tanpa penanda, tidak lagi "tidak perlu" - lihat sifatSidangTujuan.
 *   - pemberitahuan tanpa tanggal DAN tanpa berkas PBT dihitung BELUM.
 *   - ruas tambahan per dokumen (keterangan, proses, status putusan, jumlah
 *     dan sebutan pihak) supaya layar dapat MENGATAKAN dokumen yang akan
 *     ditolak ABT atau yang tidak memuat seluruh pihaknya.
 */

const GOLONGAN_CETAK = ["sidang-pertama", "sidang-ditunda", "ikrar-talak", "pemberitahuan-putusan"];
const SEBAB_MASUK = ["didaftarkan", "ditunda", "jadwal-baru", "diputus"];

// proses_terakhir_* ikut dibaca sebab ABT memeriksanya SAAT MENCETAK
// (controllers/Abt.php html_cari_perkara: proses_id_min <= proses_terakhir_id
// <= proses_id_max menu blangkonya) - layar perlu menyebut dokumen yang pasti
// ditolak ABT sebelum dicentang, bukan sesudah putaran gagal.
const KOLOM_PERKARA = `pk.nomor_perkara AS nomorPerkara, pk.jenis_perkara_nama AS jenisPerkara,
            pk.alur_perkara_id AS alurPerkaraId, pk.jenis_perkara_id AS jenisPerkaraId,
            pk.proses_terakhir_id AS prosesTerakhirId, pk.proses_terakhir_text AS prosesTerakhirNama`;

/** Teks isian SIPP yang berisi - kosong dan "0" (bawaan kolom alasan_ditunda) bukan isi. */
function teksIsian(nilai) {
  const t = bersih(nilai);
  return t && t !== "0" ? t : "";
}

/**
 * Kata "panggil" di alasan penundaan sidang asal atau agenda sidang tujuan.
 *
 * Sandi kehadiran 1 ("Semua Pihak") juga nilai BAWAAN borang SIPP:
 * jadwal_sidang_p_edit.php baris 51-53 berisi <select name="dihadiri_oleh">
 * TANPA opsi kosong dengan "Semua Pihak" di urutan pertama, jadi borang yang
 * disimpan tanpa menyentuh isiannya menyimpan 1. Diukur 25 September 2026 atas
 * sidang bersandi 1 yang punya sidang berikutnya: 2026 - 5 dari 397 memuat
 * kata ini dan kelimanya SUNGGUH dipanggil (relaas tercatat untuk sidang
 * berikutnya); 2025 - 6, empat berelaas. Kata ini karena itu membatalkan
 * "tidak perlu dipanggil" dan pihaknya DITANYAKAN, tidak ditebak.
 */
const POLA_PANGGIL = /anggil/i;
const POLA_IKRAR = /ikrar/i;

/**
 * Golongan dan pihak untuk SIDANG TUJUAN - satu aturan untuk jalan (b) dan (c).
 *
 *   ikrar_talak='Y'                         -> ikrar-talak, keduanya
 *   sesudah putusan, bukan verzet, agenda
 *     menyebut ikrar                        -> ikrar-talak, keduanya (penandanya
 *                                              'T' - terukur 1 kali pada 2026:
 *                                              578/Pdt.G/2025 sidang 19 Jan 2026)
 *   sesudah putusan, bukan verzet, lainnya  -> pihak DITANYAKAN: kehadiran
 *                                              sidang sebelum putusan tidak
 *                                              berlaku untuk sidang sesudahnya
 *   jadwal baru bernomor 1                  -> sidang-pertama, keduanya
 *   selain itu                              -> sidang-ditunda, pihak dari sandi
 *                                              sidang asal; sandi 1 yang teks
 *                                              isiannya menyebut panggilan
 *                                              DITANYAKAN (lihat POLA_PANGGIL)
 *
 * Verzet (perlawanan atas putusan verstek) dikecualikan dari "sesudah
 * putusan": ia persidangan biasa yang kehadirannya tercatat seperti biasa
 * (2 jadwal verzet sesudah putusan pada 2026).
 */
function sifatSidangTujuan(b, { sandi, urutan, jaring }) {
  const keterangan = [];
  const tglTujuan = tanggalIso(b.tanggalSidang);
  const agenda = teksIsian(b.agendaTujuan);
  const alasan = teksIsian(b.alasanAsal);
  const tglPutus = tanggalIso(b.tanggalPutusan);
  const ikrarY = bersih(b.ikrarTujuan).toUpperCase() === "Y";
  const verzetY = bersih(b.verzetTujuan).toUpperCase() === "Y";
  if (ikrarY) return { golongan: "ikrar-talak", pihak: "keduanya", keterangan, tanda: "ikrar" };
  if (tglPutus && tglTujuan && tglTujuan > tglPutus && !verzetY) {
    if (POLA_IKRAR.test(agenda)) {
      keterangan.push(
        `Sidang ke-${urutan} (${tglTujuan}) jatuh sesudah putusan ${tglPutus} dan agendanya "${agenda}", ` +
          `walau penanda ikrar talak di SIPP 'T' - diperlakukan sebagai panggilan ikrar talak kedua pihak.`
      );
      return { golongan: "ikrar-talak", pihak: "keduanya", keterangan, tanda: "sesudah-putusan" };
    }
    keterangan.push(
      `Sidang ke-${urutan} (${tglTujuan}) jatuh sesudah putusan ${tglPutus} tanpa penanda ikrar talak ` +
        `maupun verzet${agenda ? ` (agenda "${agenda}")` : ""} - kehadiran sidang sebelum putusan tidak ` +
        `berlaku untuknya. Pilih pihak yang dipanggil.`
    );
    return { golongan: "sidang-ditunda", pihak: "tidak-diketahui", keterangan, tanda: "sesudah-putusan" };
  }
  if (jaring && urutan === 1) return { golongan: "sidang-pertama", pihak: "keduanya", keterangan, tanda: "" };
  let pihak = pihakDipanggilDariSandi(sandi);
  let tanda = "";
  if (pihak === "tidak-perlu") {
    const bukti = POLA_PANGGIL.test(alasan)
      ? `alasan penundaan sidang sebelumnya berbunyi "${alasan}"`
      : POLA_PANGGIL.test(agenda)
        ? `agenda sidang ke-${urutan} berbunyi "${agenda}"`
        : "";
    if (bukti) {
      pihak = "tidak-diketahui";
      tanda = "sandi-1-panggil";
      keterangan.push(
        `SIPP mencatat semua pihak hadir (sandi 1 - juga nilai bawaan borang SIPP bila isian kehadiran ` +
          `tidak disentuh), tetapi ${bukti}. Pilih pihak yang dipanggil.`
      );
    }
  }
  return { golongan: "sidang-ditunda", pihak, keterangan, tanda };
}

/**
 * Tanggal yang BERBENTUK dan ADA di kalender. "2026-02-30" berbentuk benar,
 * tetapi MySQL membandingkannya tanpa galat dan memulangkan nol baris - hari
 * yang tampak lengang padahal tanggalnya yang salah.
 */
function tanggalSah(teks) {
  if (!POLA_TANGGAL.test(teks)) return false;
  const [y, m, d] = teks.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** Hari sesudah `tanggal` - kalender saja, jadi dihitung atas UTC murni. */
function tanggalBerikut(tanggal) {
  const [y, m, d] = tanggal.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** Tanggal `hari` hari sebelum `tanggal` (YYYY-MM-DD), melewati batas bulan dan tahun. */
function tanggalMundur(tanggal, hari) {
  const [y, m, d] = tanggal.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - hari)).toISOString().slice(0, 10);
}

/** "HH.MM" dari DATETIME - Date dari driver atau teks mysql - atau "" bila tidak terbaca. */
function jamIso(nilai) {
  if (!nilai) return "";
  if (nilai instanceof Date) {
    if (Number.isNaN(nilai.getTime())) return "";
    return `${String(nilai.getHours()).padStart(2, "0")}.${String(nilai.getMinutes()).padStart(2, "0")}`;
  }
  const cocok = bersih(nilai).match(/^\d{4}-\d{2}-\d{2}[ T](\d{2}):(\d{2})/);
  return cocok ? `${cocok[1]}.${cocok[2]}` : "";
}

/**
 * Pihak per sisi yang identitasnya DIMUAT blangko relaas ABT - #7108#/#7109#
 * (abt_variabel ABT setempat, 25 Sep 2026): gugatan (alur 15) pihak pertama
 * tiap sisi, permohonan (alur 16) Pemohon I dan II. Sama dengan
 * cakupanBlangko di nilai-cetak.ts portal, yang juga membedakan blangko "T
 * saja"; di sini cukup sisi yang dipanggil.
 */
function pihakDimuatBlangko(alurPerkaraId) {
  return Number(alurPerkaraId) === 16 ? { 1: 2, 2: 0 } : { 1: 1, 2: 1 };
}

/** Pemberitahuan per pihak: 1/2 bila satu sisi, null bila keduanya/tak diketahui. */
function pihakKeUntuk(pihak) {
  if (pihak === "pertama") return 1;
  if (pihak === "kedua") return 2;
  return null;
}

function idAtauNull(nilai) {
  const n = bilangan(nilai);
  return n > 0 ? n : null;
}

/**
 * Nilai sudah-ada-relaas untuk satu sasaran.
 *
 *   daftarPihak(sisi)  -> pihak pada sisi itu
 *   ada(sisi, pihak)   -> relaas/pemberitahuan untuk pihak itu sudah tercatat
 *
 * Pihak yang diketahui: seluruh pihak sasarannya tercatat -> true; belum
 * seluruhnya -> false. Tidak diketahui: kedua sisi seluruhnya tercatat -> true,
 * tidak satu pun -> false, sebagian -> null. Tanpa satu pun baris pihak -> null.
 */
function nilaiSudahAda(pihakDipanggil, daftarPihak, ada) {
  const tidakTahu = pihakDipanggil === "tidak-diketahui";
  const sisiDituju = tidakTahu ? [1, 2] : sisiUntukPihak(pihakDipanggil);
  const sasaran = [];
  for (const sisi of sisiDituju) {
    for (const p of daftarPihak(sisi)) sasaran.push({ sisi, p });
  }
  if (sasaran.length === 0) return null;
  const tercatat = sasaran.filter((x) => ada(x.sisi, x.p)).length;
  if (tercatat === sasaran.length) return true;
  if (tidakTahu) return tercatat === 0 ? false : null;
  return false;
}

async function relaasCetakHarian(tanggalDiminta = "") {
  const diminta = bersih(tanggalDiminta);
  if (diminta && !tanggalSah(diminta)) {
    return { ok: false, alasan: "tanggal_tidak_berbentuk_yyyy_mm_dd", tanggal: diminta };
  }
  const tanggal = diminta || tanggalHariIni(ZONA_PENGADILAN);
  const besok = tanggalBerikut(tanggal);
  const catatan = [];

  /** BATAS_BARIS dilampaui -> dipotong DAN disebut, tidak hilang diam-diam. */
  function pagar(baris, apa) {
    if (baris.length <= BATAS_BARIS) return;
    catatan.push(
      `${apa} pada tanggal ini lebih dari ${BATAS_BARIS} baris; yang diperiksa ${BATAS_BARIS} ` +
        `pertama menurut nomor perkaranya - SISANYA TIDAK MASUK ANTRIAN.`
    );
    baris.length = BATAS_BARIS;
  }

  // (a) Perkara yang didaftarkan ATAU ditetapkan hari sidangnya pada T. UNION
  // (bukan OR lintas tabel) supaya kedua indeks tanggal terpakai dan perkara
  // yang memenuhi keduanya tetap satu baris. `jp` = jadwal bernomor lebih dari
  // satu yang tanggalnya perkara_penetapan.sidang_pertama - penetapan hari
  // sidang ULANG (lihat jalan (a) di bawah); jadwal kembar setanggal dapat
  // melipatgandakan barisnya, jadi yang dipakai baris pertama per perkara.
  const barisDaftar = await kueri(
    `SELECT x.perkara_id AS perkaraId, pk.tanggal_pendaftaran AS tanggalPendaftaran,
            pp.penetapan_hari_sidang AS tanggalPhs, pp.sidang_pertama AS sidangPertamaPhs,
            j.id AS sidangId, j.urutan AS urutan, j.tanggal_sidang AS tanggalSidang,
            j.diinput_tanggal AS diinputPada,
            jp.id AS sidangPhsId, jp.urutan AS urutanPhs, jp.tanggal_sidang AS tanggalSidangPhs,
            jp.diinput_tanggal AS diinputPhsPada,
            ${KOLOM_PERKARA}
       FROM (SELECT perkara_id FROM perkara WHERE tanggal_pendaftaran = ?
             UNION
             SELECT perkara_id FROM perkara_penetapan WHERE penetapan_hari_sidang = ?) x
       LEFT JOIN perkara pk ON pk.perkara_id = x.perkara_id
       LEFT JOIN perkara_penetapan pp ON pp.perkara_id = x.perkara_id
       LEFT JOIN perkara_jadwal_sidang j ON j.perkara_id = x.perkara_id AND j.urutan = 1
       LEFT JOIN perkara_jadwal_sidang jp ON jp.perkara_id = x.perkara_id AND jp.urutan > 1
             AND jp.tanggal_sidang = pp.sidang_pertama
      ORDER BY x.perkara_id, jp.urutan
      LIMIT ?`,
    [tanggal, tanggal, BATAS_BARIS + 1]
  );
  pagar(barisDaftar, "Perkara yang didaftarkan atau ditetapkan hari sidangnya");

  // (b) Sidang pada T beserta sidang BERIKUTNYA. Tiga sub-kueri skalar
  // memilah yang tanpa sidang berikutnya: diputus hari itu (masuk (d)), sidang
  // ikrar yang ikrarnya tercatat (selesai), atau diputus lebih awal.
  const barisSidang = await kueri(
    `SELECT j.id AS sidangAsalId, j.perkara_id AS perkaraId, j.urutan AS urutanAsal,
            j.dihadiri_oleh AS dihadiriOleh, j.ikrar_talak AS ikrarAsal, j.alasan_ditunda AS alasanAsal,
            n.id AS sidangId, n.urutan AS urutan, n.tanggal_sidang AS tanggalSidang,
            n.ikrar_talak AS ikrarTujuan, n.verzet AS verzetTujuan, n.agenda AS agendaTujuan,
            (SELECT COUNT(*) FROM perkara_putusan pu
              WHERE pu.perkara_id = j.perkara_id AND pu.tanggal_putusan = j.tanggal_sidang) AS putusHariItu,
            (SELECT MAX(pu.tanggal_putusan) FROM perkara_putusan pu
              WHERE pu.perkara_id = j.perkara_id) AS tanggalPutusan,
            (SELECT MAX(it.tgl_ikrar_talak) FROM perkara_ikrar_talak it
              WHERE it.perkara_id = j.perkara_id) AS tanggalIkrar,
            ${KOLOM_PERKARA}
       FROM perkara_jadwal_sidang j
       LEFT JOIN perkara_jadwal_sidang n ON n.perkara_id = j.perkara_id AND n.urutan = j.urutan + 1
       LEFT JOIN perkara pk ON pk.perkara_id = j.perkara_id
      WHERE j.tanggal_sidang = ?
      ORDER BY j.perkara_id, j.urutan
      LIMIT ?`,
    [tanggal, BATAS_BARIS + 1]
  );
  pagar(barisSidang, "Sidang");

  // (c) Jadwal yang DIINPUT pada T - rentang setengah terbuka [T, T+1) supaya
  // indeks tidak dimatikan DATE() dan jam 23.59 tetap ikut.
  const barisJadwalBaru = await kueri(
    `SELECT n.id AS sidangId, n.perkara_id AS perkaraId, n.urutan AS urutan,
            n.tanggal_sidang AS tanggalSidang, n.ikrar_talak AS ikrarTujuan,
            n.verzet AS verzetTujuan, n.agenda AS agendaTujuan,
            pv.id AS sidangAsalId, pv.dihadiri_oleh AS dihadiriOleh, pv.alasan_ditunda AS alasanAsal,
            (SELECT MAX(pu.tanggal_putusan) FROM perkara_putusan pu
              WHERE pu.perkara_id = n.perkara_id) AS tanggalPutusan,
            ${KOLOM_PERKARA}
       FROM perkara_jadwal_sidang n
       LEFT JOIN perkara_jadwal_sidang pv ON pv.perkara_id = n.perkara_id AND pv.urutan = n.urutan - 1
       LEFT JOIN perkara pk ON pk.perkara_id = n.perkara_id
      WHERE n.diinput_tanggal >= ? AND n.diinput_tanggal < ?
      ORDER BY n.perkara_id, n.urutan
      LIMIT ?`,
    [tanggal, besok, BATAS_BARIS + 1]
  );
  pagar(barisJadwalBaru, "Jadwal sidang yang diinput");

  // (d) Putusan pada T. Sidang pembacaannya lewat sub-kueri, bukan JOIN: 46
  // perkara punya dua sidang sehari, dan JOIN akan melipatgandakan barisnya.
  // Status putusan lewat JOIN status_putusan: kolom status_putusan_nama milik
  // perkara_putusan kosong di SIPP ini, namanya hanya ada di tabel rujukan.
  const barisPutusan = await kueri(
    `SELECT pu.perkara_id AS perkaraId, pu.status_putusan_id AS statusPutusanId,
            sp.nama AS statusPutusanNama,
            (SELECT j.id FROM perkara_jadwal_sidang j
              WHERE j.perkara_id = pu.perkara_id AND j.tanggal_sidang = pu.tanggal_putusan
              ORDER BY j.urutan DESC LIMIT 1) AS sidangAsalId,
            (SELECT j.dihadiri_oleh FROM perkara_jadwal_sidang j
              WHERE j.perkara_id = pu.perkara_id AND j.tanggal_sidang = pu.tanggal_putusan
              ORDER BY j.urutan DESC LIMIT 1) AS dihadiriOleh,
            ${KOLOM_PERKARA}
       FROM perkara_putusan pu
       LEFT JOIN perkara pk ON pk.perkara_id = pu.perkara_id
       LEFT JOIN status_putusan sp ON sp.id = pu.status_putusan_id
      WHERE pu.tanggal_putusan = ?
      ORDER BY pu.perkara_id
      LIMIT ?`,
    [tanggal, BATAS_BARIS + 1]
  );
  pagar(barisPutusan, "Putusan");

  // (e) Sidang HARI KERJA SEBELUMNYA yang punya sidang berikutnya - jalan (b)
  // tanggal itu, dipulangkan terpisah (lihat bagian (e) di bawah). "Hari
  // kerja sebelumnya" = tanggal sidang terakhir sebelum T dalam tujuh hari:
  // akhir pekan dan hari libur terlewati sendiri karena tidak ada sidang.
  // Jadwal yang diinput pada T atau sesudahnya tidak diambil - yang diinput
  // pada T sudah ditangkap jaring (c), yang sesudahnya belum ada pada hari T.
  const barisKemarin = await kueri(
    `SELECT j.id AS sidangAsalId, j.perkara_id AS perkaraId, j.urutan AS urutanAsal,
            j.tanggal_sidang AS tanggalAsal, j.dihadiri_oleh AS dihadiriOleh,
            j.alasan_ditunda AS alasanAsal,
            n.id AS sidangId, n.urutan AS urutan, n.tanggal_sidang AS tanggalSidang,
            n.ikrar_talak AS ikrarTujuan, n.verzet AS verzetTujuan, n.agenda AS agendaTujuan,
            n.diinput_tanggal AS diinputTujuan,
            (SELECT MAX(pu.tanggal_putusan) FROM perkara_putusan pu
              WHERE pu.perkara_id = j.perkara_id) AS tanggalPutusan,
            ${KOLOM_PERKARA}
       FROM perkara_jadwal_sidang j
       JOIN perkara_jadwal_sidang n ON n.perkara_id = j.perkara_id AND n.urutan = j.urutan + 1
       LEFT JOIN perkara pk ON pk.perkara_id = j.perkara_id
      WHERE j.tanggal_sidang = (SELECT MAX(x.tanggal_sidang) FROM perkara_jadwal_sidang x
                                 WHERE x.tanggal_sidang < ? AND x.tanggal_sidang >= ?)
        AND n.diinput_tanggal < ?
      ORDER BY j.perkara_id, j.urutan
      LIMIT ?`,
    [tanggal, tanggalMundur(tanggal, 7), tanggal, BATAS_BARIS + 1]
  );
  pagar(barisKemarin, "Sidang hari kerja sebelumnya");

  const dokumen = new Map();
  const tidakPerlu = [];
  const tertunda = [];
  // Sidang tujuan yang sudah menjadi dokumen atau tidakPerlu - jaring (c) tidak
  // boleh menghitungnya dua kali.
  const sidangTercakup = new Set();
  let kunciGanda = 0;
  let ikrarSelesai = 0;
  let jadwalSusulan = 0;
  let putusanTanpaSidang = 0;
  let phsUlang = 0;
  let sandiSatuDitanyakan = 0;
  let sesudahPutusan = 0;

  function perkaraDari(b) {
    return {
      perkaraId: bilangan(b.perkaraId),
      nomorPerkara: bersih(b.nomorPerkara),
      jenisPerkara: bersih(b.jenisPerkara),
      alurPerkaraId: idAtauNull(b.alurPerkaraId),
      jenisPerkaraId: idAtauNull(b.jenisPerkaraId),
      prosesTerakhirId: idAtauNull(b.prosesTerakhirId),
      prosesTerakhirNama: bersih(b.prosesTerakhirNama),
    };
  }

  /**
   * Ruas TAMBAHAN di luar kontrak K1 (kontraknya tidak berubah):
   *   keterangan          kalimat untuk keadaan khusus (PHS ulang, sandi 1
   *                       yang menyebut panggilan, sidang sesudah putusan)
   *   prosesTerakhirId/Nama  proses perkara SAAT INI - yang diperiksa ABT
   *   statusPutusanId/Nama   pemberitahuan saja: dicabut/gugur perlu konfirmasi
   *   jumlahPihak, sebutanPihak  jumlah baris pihak per sisi dan sebutannya -
   *                       blangko ABT hanya memuat pihak pertama tiap sisi
   *   jumlahPihakSasaran  baris pihak pada sisi yang DIPANGGIL (null bila
   *                       pihaknya belum diketahui)
   * `peta` = dokumen hari ini, atau dokumenKemarin untuk kelompok (e).
   */
  function tambahDokumen(p, isi, peta = dokumen) {
    const pihakKe = isi.pihakKe === undefined ? null : isi.pihakKe;
    const kunci = `${isi.golongan}:${p.perkaraId}:${isi.d === null ? 0 : isi.d}:${pihakKe === null ? 0 : pihakKe}`;
    if (peta.has(kunci)) {
      kunciGanda += 1;
      return;
    }
    peta.set(kunci, {
      kunci,
      perkaraId: p.perkaraId,
      nomorPerkara: p.nomorPerkara,
      jenisPerkara: p.jenisPerkara,
      alurPerkaraId: p.alurPerkaraId,
      jenisPerkaraId: p.jenisPerkaraId,
      golongan: isi.golongan,
      sebabMasuk: isi.sebabMasuk,
      d: isi.d,
      sidangId: isi.sidangId,
      tanggalSidangTujuan: isi.tanggalSidangTujuan,
      sidangAsalId: isi.sidangAsalId,
      dihadiriOleh: isi.dihadiriOleh,
      pihakDipanggil: isi.pihakDipanggil,
      pihakKe,
      // Diisi sesudah penunjukan dan relaas dibaca.
      jurusita: null,
      sudahAdaRelaas: null,
      keterangan: Array.isArray(isi.keterangan) ? isi.keterangan : [],
      prosesTerakhirId: p.prosesTerakhirId,
      prosesTerakhirNama: p.prosesTerakhirNama,
      statusPutusanId: isi.statusPutusanId === undefined ? null : isi.statusPutusanId,
      statusPutusanNama: isi.statusPutusanNama || "",
      jumlahPihak: null,
      jumlahPihakSasaran: null,
      sebutanPihak: null,
    });
  }

  /** `keterangan` tambahan di luar kontrak: alasan penundaan/agenda yang tercatat, bila ada. */
  function tambahTidakPerlu(p, golongan, sidangAsalId, sebab, keterangan = "") {
    tidakPerlu.push({
      perkaraId: p.perkaraId,
      nomorPerkara: p.nomorPerkara,
      golongan,
      sidangAsalId,
      sebab,
      keterangan,
    });
  }

  /** Alasan penundaan dan agenda sidang tujuan untuk baris tidakPerlu - supaya dapat diperiksa orang. */
  function isianTercatat(b) {
    const alasan = teksIsian(b.alasanAsal);
    const agenda = teksIsian(b.agendaTujuan);
    return [alasan ? `alasan penundaan "${alasan}"` : "", agenda ? `agenda sidang berikutnya "${agenda}"` : ""]
      .filter(Boolean)
      .join("; ");
  }

  // ---- (a) didaftarkan -----------------------------------------------------
  //
  // Sidang yang dipanggil biasanya sidang ke-1. Dua pengecualian, keduanya
  // TERUKUR (25 Sep 2026, perkara sejak 2024/2025):
  //
  //   PHS ULANG  penetapan hari sidang pada T menetapkan sidang yang BUKAN
  //              sidang ke-1 (perkara_penetapan.sidang_pertama = tanggal jadwal
  //              bernomor lebih besar), sedangkan sidang ke-1 sudah lewat.
  //              273/Pdt.G/2026: sidang ke-1 13 Mei, PHS ulang 16 Jul untuk
  //              sidang ke-3 29 Jul. Tanpa aturan ini yang dicetak panggilan
  //              sidang ke-1 yang sudah dua bulan lewat, dan sidang ke-3 jatuh
  //              ke jaring (c) yang menilainya dari kehadiran sidang lama.
  //              Penetapan hari sidang memanggil KEDUA pihak.
  //   DIINPUT    jadwalnya baru diinput SESUDAH T (12 dari 1.755 perkara 2025-
  //   SESUDAH T  2026 terhadap tanggal pendaftarannya). Pada hari T itu
  //              jadwalnya belum ada - jadi tertunda, dan ia masuk antrian pada
  //              hari inputnya (lewat (a) bila itu hari PHS-nya, atau jaring
  //              (c)). Tanpa ini satu panggilan muncul dua kali di dua tanggal
  //              (560/Pdt.G/2026: didaftarkan 10 Sep, jadwal dan PHS 12 Sep).
  //
  // Sidang yang dipanggil tidak sesudah T -> tertunda "sidang-pertama-sudah-
  // lewat": panggilan untuk sidang yang sudah lewat bukan panggilan.
  const perkaraDaftar = new Set();
  for (const b of barisDaftar) {
    const p = perkaraDari(b);
    if (perkaraDaftar.has(p.perkaraId)) continue; // baris kembar dari jadwal setanggal
    perkaraDaftar.add(p.perkaraId);
    const tglDaftar = tanggalIso(b.tanggalPendaftaran);
    const tglPhs = tanggalIso(b.tanggalPhs);
    const sidangSatu =
      bilangan(b.sidangId) > 0
        ? {
            id: bilangan(b.sidangId),
            urutan: bilangan(b.urutan),
            tanggal: tanggalIso(b.tanggalSidang),
            diinput: tanggalIso(b.diinputPada),
          }
        : null;
    const sidangPhs =
      bilangan(b.sidangPhsId) > 0
        ? {
            id: bilangan(b.sidangPhsId),
            urutan: bilangan(b.urutanPhs),
            tanggal: tanggalIso(b.tanggalSidangPhs),
            diinput: tanggalIso(b.diinputPhsPada),
          }
        : null;
    const pokok =
      `Didaftarkan ${tglDaftar || "(tanggal tidak tercatat)"}, penetapan hari sidang ` +
      `${tglPhs || "belum ada"}`;
    const keterangan = [];
    let tujuan = sidangSatu;
    let golongan = "sidang-pertama";
    if (
      tglPhs === tanggal &&
      sidangPhs &&
      sidangPhs.tanggal > tanggal &&
      (!sidangSatu || !sidangSatu.tanggal || sidangSatu.tanggal <= tanggal)
    ) {
      tujuan = sidangPhs;
      golongan = "sidang-ditunda";
      phsUlang += 1;
      keterangan.push(
        `Penetapan hari sidang ULANG pada ${tanggal} untuk sidang ke-${sidangPhs.urutan} ` +
          `(${sidangPhs.tanggal})` +
          (sidangSatu && sidangSatu.tanggal ? `; sidang ke-1 sudah berlangsung ${sidangSatu.tanggal}` : "") +
          `. Penetapan hari sidang memanggil kedua pihak.`
      );
    }
    if (!tujuan) {
      tertunda.push({
        perkaraId: p.perkaraId,
        nomorPerkara: p.nomorPerkara,
        sebab: "jadwal-pertama-belum-ada",
        keterangan: `${pokok}; jadwal sidang ke-1 belum diinput di SIPP, jadi belum ada sidang yang dapat dipanggil.`,
      });
      continue;
    }
    if (tujuan.diinput && tujuan.diinput > tanggal) {
      tertunda.push({
        perkaraId: p.perkaraId,
        nomorPerkara: p.nomorPerkara,
        sebab: "jadwal-pertama-belum-ada",
        keterangan:
          `${pokok}; jadwal sidang ke-${tujuan.urutan} baru diinput ${tujuan.diinput}, sesudah tanggal ` +
          `ini - panggilannya masuk antrian pada tanggal input itu, bukan di sini.`,
      });
      continue;
    }
    if (!tujuan.tanggal || tujuan.tanggal <= tanggal) {
      tertunda.push({
        perkaraId: p.perkaraId,
        nomorPerkara: p.nomorPerkara,
        sebab: "sidang-pertama-sudah-lewat",
        keterangan:
          `${pokok}; sidang ke-${tujuan.urutan} yang tercatat bertanggal ${tujuan.tanggal || "(kosong)"}, ` +
          `tidak sesudah tanggal ini - tidak ada panggilan yang dapat sampai. Periksa jadwalnya di ` +
          `SIPP (penetapan hari sidang ulang yang jadwalnya belum diinput?).`,
      });
      continue;
    }
    sidangTercakup.add(tujuan.id);
    tambahDokumen(p, {
      golongan,
      sebabMasuk: "didaftarkan",
      d: tujuan.urutan || null,
      sidangId: tujuan.id,
      tanggalSidangTujuan: tujuan.tanggal,
      sidangAsalId: null,
      dihadiriOleh: null,
      pihakDipanggil: "keduanya",
      pihakKe: null,
      keterangan,
    });
  }

  // ---- (b) ditunda ---------------------------------------------------------
  for (const b of barisSidang) {
    const p = perkaraDari(b);
    const asalId = bilangan(b.sidangAsalId);
    const sandi = sandiKehadiran(b.dihadiriOleh);
    const tujuanId = bilangan(b.sidangId);
    if (tujuanId > 0) {
      sidangTercakup.add(tujuanId);
      const tglTujuan = tanggalIso(b.tanggalSidang);
      const sifat = sifatSidangTujuan(b, { sandi, urutan: bilangan(b.urutan), jaring: false });
      // Sidang berikutnya pada hari yang SAMA (dua sidang sehari - 48 kali
      // se-riwayat, 0 pada 2026): pihaknya ada di ruang sidang, tidak ada
      // relaas yang dapat sampai sebelum sidangnya.
      if (tglTujuan && tglTujuan <= tanggal) {
        tambahTidakPerlu(p, sifat.golongan, asalId, "sidang-tujuan-tidak-sesudah-hari-cetak", isianTercatat(b));
        continue;
      }
      if (sifat.pihak === "tidak-perlu") {
        tambahTidakPerlu(p, sifat.golongan, asalId, "semua-pihak-hadir", isianTercatat(b));
        continue;
      }
      if (sifat.tanda === "sandi-1-panggil") sandiSatuDitanyakan += 1;
      if (sifat.tanda === "sesudah-putusan") sesudahPutusan += 1;
      tambahDokumen(p, {
        golongan: sifat.golongan,
        sebabMasuk: "ditunda",
        // Nomor sidang TUJUAN - yang dipanggil - bukan sidang asal hari ini.
        d: bilangan(b.urutan) || null,
        sidangId: tujuanId,
        tanggalSidangTujuan: tglTujuan,
        sidangAsalId: asalId,
        dihadiriOleh: sandi,
        pihakDipanggil: sifat.pihak,
        pihakKe: null,
        keterangan: sifat.keterangan,
      });
      continue;
    }
    // Tanpa sidang berikutnya.
    if (bilangan(b.putusHariItu) > 0) continue; // pemberitahuannya lewat (d)
    if (bersih(b.ikrarAsal).toUpperCase() === "Y" && tanggalIso(b.tanggalIkrar)) {
      ikrarSelesai += 1;
      continue;
    }
    const tglPutus = tanggalIso(b.tanggalPutusan);
    if (tglPutus && tglPutus < tanggal) {
      tertunda.push({
        perkaraId: p.perkaraId,
        nomorPerkara: p.nomorPerkara,
        sebab: "sidang-sesudah-putusan",
        keterangan:
          `Sidang ke-${bilangan(b.urutanAsal)} pada ${tanggal} tanpa sidang berikutnya, padahal ` +
          `perkaranya diputus ${tglPutus} dan sidang ini tidak berpenanda ikrar talak yang ` +
          `tercatat. Periksa di SIPP apakah masih ada pihak yang harus dipanggil.`,
      });
      continue;
    }
    tertunda.push({
      perkaraId: p.perkaraId,
      nomorPerkara: p.nomorPerkara,
      sebab: "hasil-sidang-belum-dicatat",
      keterangan:
        `Sidang ke-${bilangan(b.urutanAsal)} pada ${tanggal} belum punya sidang berikutnya ` +
        `maupun putusan di SIPP; panggilannya menunggu penundaan dicatat.`,
    });
  }

  // ---- (c) jaring: jadwal yang diinput hari ini ----------------------------
  for (const b of barisJadwalBaru) {
    const tujuanId = bilangan(b.sidangId);
    if (tujuanId <= 0 || sidangTercakup.has(tujuanId)) continue;
    const tglTujuan = tanggalIso(b.tanggalSidang);
    if (!tglTujuan || tglTujuan <= tanggal) {
      jadwalSusulan += 1;
      continue;
    }
    sidangTercakup.add(tujuanId);
    const p = perkaraDari(b);
    const urutan = bilangan(b.urutan);
    const asalId = idAtauNull(b.sidangAsalId);
    const sandi = asalId ? sandiKehadiran(b.dihadiriOleh) : null;
    const sifat = sifatSidangTujuan(b, { sandi, urutan, jaring: true });
    if (sifat.pihak === "tidak-perlu") {
      tambahTidakPerlu(p, sifat.golongan, asalId, "semua-pihak-hadir", isianTercatat(b));
      continue;
    }
    if (sifat.tanda === "sandi-1-panggil") sandiSatuDitanyakan += 1;
    if (sifat.tanda === "sesudah-putusan") sesudahPutusan += 1;
    tambahDokumen(p, {
      golongan: sifat.golongan,
      sebabMasuk: "jadwal-baru",
      d: urutan > 0 ? urutan : null,
      sidangId: tujuanId,
      tanggalSidangTujuan: tglTujuan,
      sidangAsalId: asalId,
      dihadiriOleh: sandi,
      pihakDipanggil: sifat.pihak,
      pihakKe: null,
      keterangan: sifat.keterangan,
    });
  }

  // ---- (d) diputus ---------------------------------------------------------
  for (const b of barisPutusan) {
    const p = perkaraDari(b);
    const asalId = idAtauNull(b.sidangAsalId);
    if (!asalId) putusanTanpaSidang += 1;
    const sandi = asalId ? sandiKehadiran(b.dihadiriOleh) : null;
    const pihak = pihakDipanggilDariSandi(sandi);
    const statusNama = bersih(b.statusPutusanNama);
    if (pihak === "tidak-perlu") {
      tambahTidakPerlu(
        p,
        "pemberitahuan-putusan",
        asalId,
        "semua-pihak-hadir",
        statusNama ? `status putusan "${statusNama}"` : ""
      );
      continue;
    }
    tambahDokumen(p, {
      golongan: "pemberitahuan-putusan",
      sebabMasuk: "diputus",
      d: null,
      sidangId: null,
      tanggalSidangTujuan: "",
      sidangAsalId: asalId,
      dihadiriOleh: sandi,
      pihakDipanggil: pihak,
      pihakKe: pihakKeUntuk(pihak),
      statusPutusanId: idAtauNull(b.statusPutusanId),
      statusPutusanNama: statusNama,
    });
  }

  // ---- (e) dari hari kerja SEBELUMNYA --------------------------------------
  //
  // "Hari itu" adalah hari MENCETAK, jadi panggilan dari sidang kemarin milik
  // daftar kemarin. Tetapi jadwal berikutnya sering baru dicatat sore hari -
  // 2026: 138 dari 989 jadwal tunda yang diinput pada hari sidangnya tercatat
  // pukul 15.00 atau sesudahnya, 67 di antaranya memanggil pihak - SESUDAH
  // juru sita mencetak daftar hari itu. Esoknya jalan (b) hanya membaca sidang
  // bertanggal esok dan jaring (c) hanya jadwal yang diinput esok, sehingga
  // panggilan itu tidak muncul di mana pun. Karena itu jalan (b) hari kerja
  // sebelumnya ikut dipulangkan sebagai KELOMPOK TERSENDIRI
  // (hariKerjaSebelumnya): tidak masuk `dokumen` maupun ringkas, beserta jam
  // input jadwalnya dan sudahAdaRelaas - layar tidak mengikutkannya ke "Pilih
  // semua", sebab sebagian besar sudah tercetak kemarin.
  const dokumenKemarin = new Map();
  let tanggalKemarin = "";
  let kemarinSudahLewat = 0;
  let kemarinTidakPerlu = 0;
  let kemarinSudahDiSini = 0;
  for (const b of barisKemarin) {
    const p = perkaraDari(b);
    if (!tanggalKemarin) tanggalKemarin = tanggalIso(b.tanggalAsal);
    const tujuanId = bilangan(b.sidangId);
    if (tujuanId <= 0) continue;
    if (sidangTercakup.has(tujuanId)) {
      kemarinSudahDiSini += 1;
      continue;
    }
    const tglTujuan = tanggalIso(b.tanggalSidang);
    if (!tglTujuan || tglTujuan <= tanggal) {
      kemarinSudahLewat += 1;
      continue;
    }
    const sandi = sandiKehadiran(b.dihadiriOleh);
    const sifat = sifatSidangTujuan(b, { sandi, urutan: bilangan(b.urutan), jaring: false });
    if (sifat.pihak === "tidak-perlu") {
      kemarinTidakPerlu += 1;
      continue;
    }
    const jam = jamIso(b.diinputTujuan);
    tambahDokumen(
      p,
      {
        golongan: sifat.golongan,
        sebabMasuk: "ditunda",
        d: bilangan(b.urutan) || null,
        sidangId: tujuanId,
        tanggalSidangTujuan: tglTujuan,
        sidangAsalId: bilangan(b.sidangAsalId) || null,
        dihadiriOleh: sandi,
        pihakDipanggil: sifat.pihak,
        pihakKe: null,
        keterangan: [
          `Dari sidang ke-${bilangan(b.urutanAsal)} tanggal ${tanggalIso(b.tanggalAsal)}; jadwal sidang ` +
            `ke-${bilangan(b.urutan)} dicatat ${tanggalIso(b.diinputTujuan)}${jam ? ` pukul ${jam}` : ""}. ` +
            `Bila daftar tanggal itu dicetak sebelum jadwal ini dicatat, panggilannya belum ikut tercetak.`,
          ...sifat.keterangan,
        ],
      },
      dokumenKemarin
    );
  }

  const daftar = [...dokumen.values()];
  const daftarKemarin = [...dokumenKemarin.values()];
  const dariKemarin = new Set(daftarKemarin);
  // Juru sita, pihak, dan relaas tercatat dibaca SEKALI untuk kedua kelompok.
  const semua = daftar.concat(daftarKemarin);
  const perkaraIds = [...new Set(semua.map((x) => x.perkaraId).filter((n) => n > 0))];

  // ==========================================================================
  // JURU SITA, PIHAK, DAN YANG SUDAH TERCATAT - hanya bila ada dokumen
  // ==========================================================================
  let penunjukan = [];
  let nipPerNama = [];
  let sisiPihak = [];
  let relaasAda = [];
  let pbtAda = [];
  if (perkaraIds.length > 0) {
    penunjukan = await kueri(
      `SELECT perkara_id AS perkaraId, jurusita_nama AS nama, jurusita_nip AS nip
         FROM perkara_jurusita
        WHERE aktif = 'Y' AND perkara_id IN (?)
        ORDER BY perkara_id, urutan, id`,
      [perkaraIds]
    );
    nipPerNama = await kueri(
      `SELECT jurusita_nama AS nama, jurusita_nip AS nip, COUNT(*) AS n
         FROM perkara_jurusita
        WHERE jurusita_nip IS NOT NULL AND jurusita_nip <> ''
        GROUP BY jurusita_nama, jurusita_nip`
    );
    sisiPihak = await kueri(
      sqlSisiPihak(),
      TABEL_PIHAK.map(() => perkaraIds)
    );
    const sidangTujuanIds = [...new Set(semua.map((x) => bilangan(x.sidangId)).filter((n) => n > 0))];
    if (sidangTujuanIds.length > 0) {
      // Syarat perkara disebut: 103 relaas se-riwayat sidang_id-nya milik
      // perkara lain - lihat kepala berkas.
      relaasAda = await kueri(
        `SELECT sidang_id AS sidangId, perkara_id AS perkaraId, pihak_id AS pihakId
           FROM perkara_pelaksanaan_relaas
          WHERE sidang_id IN (?) AND perkara_id IN (?)`,
        [sidangTujuanIds, perkaraIds]
      );
    }
    const perkaraPutusIds = [
      ...new Set(daftar.filter((x) => x.golongan === "pemberitahuan-putusan").map((x) => x.perkaraId)),
    ];
    if (perkaraPutusIds.length > 0) {
      // Yang dihitung SUDAH diberitahukan hanya baris yang bertanggal sejak
      // putusan ini, atau yang belum bertanggal tetapi berkas PBT-nya sudah
      // diunggah. Baris tanpa tanggal DAN tanpa edoc_pbt adalah baris yang
      // disiapkan SIPP saat putusan diinput - BELUM diberitahukan (246/Pdt.G/
      // 2026: kedua baris kosong, dan dulu terbaca "sudah"; 60 dokumen
      // pemberitahuan 2026 begitu, 50 di antaranya seluruh barisnya kosong).
      // Pemberitahuan bertanggal lebih lama milik putusan lain.
      pbtAda = await kueri(
        `SELECT perkara_id AS perkaraId, pihak AS pihakKe, pihak_id AS pihakBarisId
           FROM perkara_putusan_pemberitahuan_putusan
          WHERE perkara_id IN (?)
            AND (tanggal_pemberitahuan_putusan >= ?
                 OR (tanggal_pemberitahuan_putusan IS NULL
                     AND edoc_pbt IS NOT NULL AND TRIM(edoc_pbt) <> ''))`,
        [perkaraPutusIds, tanggal]
      );
    }
  }

  // ---- penunjukan juru sita ------------------------------------------------
  const tunjukPerkara = new Map(); // perkaraId -> { nama, nip, kunci:Set }
  for (const t of penunjukan) {
    const perkaraId = bilangan(t.perkaraId);
    const nama = namaTerbaca(t.nama);
    if (!tunjukPerkara.has(perkaraId)) tunjukPerkara.set(perkaraId, { nama: "", nip: "", kunci: new Set() });
    const isi = tunjukPerkara.get(perkaraId);
    if (nama) isi.kunci.add(normalNama(nama));
    // Urutan terkecil yang bernama menang; NIP diisi dari baris ORANG YANG SAMA.
    if (!isi.nama && nama) isi.nama = nama;
    if (!isi.nip && nama && isi.nama && normalNama(nama) === normalNama(isi.nama) && bersih(t.nip)) {
      isi.nip = bersih(t.nip);
    }
  }
  const perkaraDuaOrang = [...tunjukPerkara.entries()].filter(([, v]) => v.kunci.size > 1).map(([id]) => id);
  if (perkaraDuaOrang.length > 0) {
    catatan.push(
      `${perkaraDuaOrang.length} perkara punya DUA NAMA juru sita berbeda yang penunjukannya ` +
        `sama-sama masih berlaku (perkara ${perkaraDuaOrang.slice(0, 5).join(", ")}); yang dipakai ` +
        `urutan terkecil. Periksa SIPP.`
    );
  }

  // NIP resmi 18 angka lebih dahulu, baru yang tersering - "Mustini" tercatat
  // dengan NIP terpotong 15 angka pada baris yang justru lebih banyak.
  const nipVarian = new Map();
  for (const baris of nipPerNama) {
    const kunci = normalNama(baris.nama);
    const nip = bersih(baris.nip);
    if (!kunci || !nip) continue;
    if (!nipVarian.has(kunci)) nipVarian.set(kunci, new Map());
    const peta = nipVarian.get(kunci);
    peta.set(nip, (peta.get(nip) || 0) + bilangan(baris.n));
  }
  function nipResmi(kunci) {
    const peta = nipVarian.get(kunci);
    if (!peta) return { nip: "", varian: 0 };
    const terurut = [...peta.entries()]
      .map(([nip, n]) => ({ nip, n, resmi: /^\d{18}$/.test(nip) }))
      .sort((a, b) => Number(b.resmi) - Number(a.resmi) || b.n - a.n || a.nip.localeCompare(b.nip));
    return { nip: terurut[0].nip, varian: terurut.length };
  }

  // Ejaan seragam per orang dalam SATU jawaban - ia menjadi nama folder unduhan.
  const ejaanPerKunci = new Map();
  for (const x of semua) {
    const t = tunjukPerkara.get(x.perkaraId);
    if (!t || !t.nama) continue;
    const kunci = normalNama(t.nama);
    if (!ejaanPerKunci.has(kunci)) ejaanPerKunci.set(kunci, new Map());
    const peta = ejaanPerKunci.get(kunci);
    peta.set(t.nama, (peta.get(t.nama) || 0) + 1);
  }
  const namaSeragam = new Map();
  for (const [kunci, peta] of ejaanPerKunci.entries()) {
    const ejaan = [...peta.entries()].sort(
      (a, b) => b[1] - a[1] || b[0].length - a[0].length || a[0].localeCompare(b[0])
    );
    namaSeragam.set(kunci, ejaan[0][0]);
    if (ejaan.length > 1) {
      catatan.push(
        `Nama juru sita "${ejaan[0][0]}" ditulis ${ejaan.length} cara pada penunjukan ` +
          `(${ejaan.map((e) => `"${e[0]}"`).join(", ")}); diseragamkan sebab hanya gelar sesudah ` +
          `koma, titik, dan huruf besar-kecil yang berbeda.`
      );
    }
    const nip = nipResmi(kunci);
    if (nip.varian > 1) {
      catatan.push(
        `"${ejaan[0][0]}" tercatat dengan ${nip.varian} NIP berbeda pada perkara_jurusita; ` +
          `yang dipakai ${nip.nip} (bentuk 18 angka yang resmi lebih dahulu).`
      );
    }
  }

  // ---- pihak dan yang sudah tercatat ---------------------------------------
  const pihakPerSisi = new Map(); // "perkaraId:sisi" -> [{ pihakId, barisId }]
  for (const s of sisiPihak) {
    const kunci = `${bilangan(s.perkaraId)}:${bilangan(s.pihakKe)}`;
    if (!pihakPerSisi.has(kunci)) pihakPerSisi.set(kunci, []);
    pihakPerSisi.get(kunci).push({ pihakId: bilangan(s.pihakId), barisId: bilangan(s.barisId) });
  }
  const relaasKunci = new Set(relaasAda.map((r) => `${bilangan(r.sidangId)}:${bilangan(r.pihakId)}`));
  // pihak_id pemberitahuan menunjuk perkara_pihakN.id (BARIS), bukan pihak.id.
  const pbtKunci = new Set(
    pbtAda.map((b) => `${bilangan(b.perkaraId)}:${bilangan(b.pihakKe)}:${bilangan(b.pihakBarisId)}`)
  );

  let tanpaPenunjukan = 0;
  let sudahTakTernilai = 0;
  let pihakTakDiketahui = 0;
  let keduanyaTanpaPihakKedua = 0;
  let dokumenLebihPihak = 0;
  let pihakTakTermuat = 0;
  // Sebutan per perkara dihitung sekali - penurunnya membaca alur/jenis.
  const sebutanPerPerkara = new Map();
  for (const x of semua) {
    // Jumlah baris pihak per sisi. Blangko relaas ABT memuat identitas pihak
    // lewat #7108#/#7109# (abt_variabel) - untuk gugatan hanya pihak pertama
    // tiap sisi, untuk permohonan Pemohon I dan II - jadi layar perlu tahu
    // berapa yang TIDAK termuat. "lain" = perkara_pihak3 (intervensi) dan
    // perkara_pihak4 (turut tergugat), yang tidak dimuat blangko relaas mana
    // pun. perkara_pihak5 TIDAK dihitung: tabelnya tanpa komentar dan terisi
    // pada 8.110 perkara (cerai gugat 88/Pdt.G/2026 pun punya dua baris) -
    // bukan pihak yang dipanggil, dan menghitungnya akan menyalakan peringatan
    // di hampir setiap dokumen.
    const baris = (sisi) => (pihakPerSisi.get(`${x.perkaraId}:${sisi}`) || []).length;
    x.jumlahPihak = { pertama: baris(1), kedua: baris(2), lain: baris(3) + baris(4) };
    // Sisi yang DIPANGGIL, dan berapa di antaranya yang tidak dimuat blangko:
    // satu dokumen per perkara, jadi Tergugat II dst. (atau Pemohon III dst.)
    // perlu relaas sendiri - 18/Pdt.G/2026 punya enam Tergugat.
    const sasaran = sisiUntukPihak(x.pihakDipanggil);
    x.jumlahPihakSasaran = sasaran.length ? sasaran.reduce((n, sisi) => n + baris(sisi), 0) : null;
    const dimuat = pihakDimuatBlangko(x.alurPerkaraId);
    const lebih = sasaran.reduce((n, sisi) => n + Math.max(0, baris(sisi) - dimuat[sisi]), 0);
    if (lebih > 0 && !dariKemarin.has(x)) {
      dokumenLebihPihak += 1;
      pihakTakTermuat += lebih;
    }
    if (!sebutanPerPerkara.has(x.perkaraId)) {
      sebutanPerPerkara.set(x.perkaraId, {
        pertama: sebutanPihakBaris(1, x),
        kedua: sebutanPihakBaris(2, x),
      });
    }
    x.sebutanPihak = sebutanPerPerkara.get(x.perkaraId);
  }
  for (const x of semua) {
    // Hitungan catatan hanya untuk dokumen hari ini - kelompok (e) punya
    // catatannya sendiri.
    const hariIni = !dariKemarin.has(x);
    const t = tunjukPerkara.get(x.perkaraId);
    if (t && t.nama) {
      const kunci = normalNama(t.nama);
      const nip = nipResmi(kunci).nip || t.nip;
      x.jurusita = { nama: namaSeragam.get(kunci) || t.nama, nip, dariPenunjukan: true };
    } else {
      if (hariIni) tanpaPenunjukan += 1;
      x.jurusita = { nama: NAMA_TIDAK_TERCATAT, nip: "", dariPenunjukan: false };
    }
    const daftarPihak = (sisi) => pihakPerSisi.get(`${x.perkaraId}:${sisi}`) || [];
    if (x.golongan === "pemberitahuan-putusan") {
      x.sudahAdaRelaas = nilaiSudahAda(x.pihakDipanggil, daftarPihak, (sisi, p) =>
        pbtKunci.has(`${x.perkaraId}:${sisi}:${p.barisId}`)
      );
    } else {
      x.sudahAdaRelaas = nilaiSudahAda(x.pihakDipanggil, daftarPihak, (sisi, p) =>
        relaasKunci.has(`${x.sidangId}:${p.pihakId}`)
      );
    }
    if (!hariIni) continue;
    if (x.sudahAdaRelaas === null) sudahTakTernilai += 1;
    if (x.pihakDipanggil === "tidak-diketahui") pihakTakDiketahui += 1;
    if (x.pihakDipanggil === "keduanya" && daftarPihak(2).length === 0) keduanyaTanpaPihakKedua += 1;
  }

  // Urutan cetak: per juru sita ("tidak tercatat" terakhir), lalu golongan,
  // lalu perkara dan nomor sidangnya.
  const urutanCetak = (a, b) => {
    const ta = a.jurusita.nama === NAMA_TIDAK_TERCATAT;
    const tb = b.jurusita.nama === NAMA_TIDAK_TERCATAT;
    if (ta !== tb) return ta ? 1 : -1;
    return (
      a.jurusita.nama.localeCompare(b.jurusita.nama) ||
      GOLONGAN_CETAK.indexOf(a.golongan) - GOLONGAN_CETAK.indexOf(b.golongan) ||
      a.perkaraId - b.perkaraId ||
      (a.d || 0) - (b.d || 0)
    );
  };
  daftar.sort(urutanCetak);
  daftarKemarin.sort(urutanCetak);

  // ---- catatan -------------------------------------------------------------
  if (kunciGanda > 0) {
    catatan.push(
      `${kunciGanda} dokumen berkunci sama muncul lebih dari sekali (jadwal kembar di SIPP); ` +
        `yang pertama dipakai.`
    );
  }
  if (ikrarSelesai > 0) {
    catatan.push(
      `${ikrarSelesai} sidang ikrar talak pada tanggal ini tanpa sidang berikutnya dan ikrarnya ` +
        `sudah tercatat - perkaranya selesai, tidak ada yang dipanggil.`
    );
  }
  if (phsUlang > 0) {
    catatan.push(
      `${phsUlang} penetapan hari sidang ULANG pada tanggal ini: yang dipanggil sidang yang ` +
        `ditetapkannya (perkara_penetapan.sidang_pertama), bukan sidang ke-1 yang sudah lewat.`
    );
  }
  if (sandiSatuDitanyakan > 0) {
    catatan.push(
      `${sandiSatuDitanyakan} sidang bersandi kehadiran 1 ("Semua Pihak") yang alasan penundaan atau ` +
        `agenda berikutnya menyebut panggilan - pihaknya DITANYAKAN, bukan dianggap tidak perlu. Sandi 1 ` +
        `juga nilai bawaan borang SIPP.`
    );
  }
  if (sesudahPutusan > 0) {
    catatan.push(
      `${sesudahPutusan} panggilan untuk sidang yang jatuh sesudah putusan perkaranya tanpa penanda ` +
        `verzet - dibaca dari agendanya (ikrar talak) atau pihaknya ditanyakan.`
    );
  }
  if (jadwalSusulan > 0) {
    catatan.push(
      `${jadwalSusulan} jadwal sidang diinput pada tanggal ini untuk sidang yang tanggalnya sudah ` +
        `lewat atau hari itu juga - pencatatan susulan, bukan panggilan, jadi tidak dimasukkan.`
    );
  }
  if (putusanTanpaSidang > 0) {
    catatan.push(
      `${putusanTanpaSidang} putusan pada tanggal ini tidak punya sidang bertanggal sama, jadi ` +
        `kehadiran pembacaannya tidak terbaca dan pihaknya harus dipilih orang.`
    );
  }
  if (pihakTakDiketahui > 0) {
    catatan.push(
      `${pihakTakDiketahui} dokumen pihaknya TIDAK dapat ditentukan dari sandi kehadiran (kosong ` +
        `atau sandi kombinasi) - harus dipilih orang sebelum dicetak, bukan dianggap keduanya.`
    );
  }
  if (tanpaPenunjukan > 0) {
    catatan.push(
      `${tanpaPenunjukan} dokumen perkaranya tidak punya penunjukan juru sita yang masih berlaku ` +
        `(perkara_jurusita aktif='Y'), jadi dikumpulkan di bawah "${NAMA_TIDAK_TERCATAT}".`
    );
  }
  if (keduanyaTanpaPihakKedua > 0) {
    catatan.push(
      `${keduanyaTanpaPihakKedua} dokumen "keduanya" perkaranya tidak punya pihak kedua ` +
        `(permohonan voluntair) - yang sesungguhnya dipanggil hanya pihak pertama.`
    );
  }
  if (dokumenLebihPihak > 0) {
    catatan.push(
      `${dokumenLebihPihak} dokumen memanggil lebih banyak pihak daripada yang dimuat blangko ABT - ` +
        `blangko hanya memuat pihak pertama tiap sisi (Penggugat I dan Tergugat I, atau Pemohon I-II); ` +
        `${pihakTakTermuat} pihak lain perlu relaas sendiri.`
    );
  }
  if (daftarKemarin.length > 0) {
    const sudah = daftarKemarin.filter((x) => x.sudahAdaRelaas === true).length;
    catatan.push(
      `${daftarKemarin.length} panggilan dari sidang hari kerja sebelumnya (${tanggalKemarin}) dipulangkan ` +
        `TERPISAH di hariKerjaSebelumnya - milik daftar tanggal itu, ${sudah} di antaranya sudah berelaas ` +
        `di SIPP. Yang jadwalnya dicatat sesudah daftar itu dicetak belum ikut tercetak.`
    );
  }
  if (kemarinSudahLewat + kemarinTidakPerlu + kemarinSudahDiSini > 0) {
    catatan.push(
      `Dari sidang hari kerja sebelumnya tidak diikutkan: ${kemarinSudahLewat} yang sidang berikutnya ` +
        `tidak sesudah tanggal ini, ${kemarinTidakPerlu} yang semua pihaknya hadir, ${kemarinSudahDiSini} ` +
        `yang sudah ada di daftar tanggal ini.`
    );
  }
  if (sudahTakTernilai > 0) {
    catatan.push(
      `${sudahTakTernilai} dokumen tidak dapat dinilai sudah-belumnya relaas tercatat (pihak ` +
        `tidak diketahui dan hanya sebagian yang berelaas, atau perkaranya tanpa baris pihak).`
    );
  }
  if (
    barisDaftar.length === 0 &&
    barisSidang.length === 0 &&
    barisJadwalBaru.length === 0 &&
    barisPutusan.length === 0
  ) {
    catatan.push(
      "Tidak ada perkara didaftarkan, penetapan hari sidang, sidang, jadwal baru, maupun " +
        "putusan pada tanggal ini."
    );
  }

  const perGolongan = Object.fromEntries(GOLONGAN_CETAK.map((g) => [g, 0]));
  const perSebabMasuk = Object.fromEntries(SEBAB_MASUK.map((s) => [s, 0]));
  const perJurusita = {};
  for (const x of daftar) {
    perGolongan[x.golongan] += 1;
    perSebabMasuk[x.sebabMasuk] += 1;
    perJurusita[x.jurusita.nama] = (perJurusita[x.jurusita.nama] || 0) + 1;
  }

  return {
    ok: true,
    tanggal,
    diperiksaPada: new Date().toISOString(),
    dokumen: daftar,
    tidakPerlu,
    tertunda,
    // Tambahan di luar kontrak K1: jalan (b) tanggal sidang terakhir sebelum
    // T - kelompok tersendiri, tidak dihitung di ringkas.
    hariKerjaSebelumnya: { tanggal: tanggalKemarin, dokumen: daftarKemarin },
    ringkas: {
      dokumen: daftar.length,
      perGolongan,
      // Ruas tambahan di luar kontrak - sumbangan tiap jalan masuk, termasuk
      // jaring (c) pada "jadwal-baru".
      perSebabMasuk,
      perJurusita,
      tidakPerlu: tidakPerlu.length,
      tertunda: tertunda.length,
      sudahAdaRelaas: daftar.filter((x) => x.sudahAdaRelaas === true).length,
      hariKerjaSebelumnya: daftarKemarin.length,
    },
    catatan,
  };
}

module.exports = {
  relaasMassal,
  relaasCetakHarian,
  GOLONGAN_CETAK,
  SEBAB_MASUK,
  tanggalSah,
  tanggalBerikut,
  tanggalMundur,
  jamIso,
  pihakDimuatBlangko,
  nilaiSudahAda,
  ZONA_PENGADILAN,
  BATAS_BARIS,
  SANDI_CARA,
  NAMA_TIDAK_TERCATAT,
  GOLONGAN,
  PIHAK_DARI_KEHADIRAN,
  // Diekspor untuk diuji satuan tanpa basis data.
  golonganSidang,
  pihakDipanggilDariSandi,
  pihakUntukGolongan,
  sisiUntukPihak,
  sandiKehadiran,
  tanpaGelar,
  normalNama,
  namaTerbaca,
  caraPanggil,
  statusPos,
  sebutanPihakBaris,
  tanggalIso,
};
