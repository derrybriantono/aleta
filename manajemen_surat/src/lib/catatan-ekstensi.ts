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
