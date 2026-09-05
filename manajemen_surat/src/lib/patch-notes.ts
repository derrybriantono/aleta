export const APP_VERSION = "1.83.0";
export const APP_VERSION_LABEL = "ALETA Judicia v1.83.0 - Pustaka Pertimbangan";

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
      "KEHADIRAN RINCI DIBUANG DI TENGAH JALAN. Bot mengirimkannya, layar antrian menantikannya, dan rute portal diam-diam tidak meneruskannya - sehingga keterangan \"Penggugat I lebih dulu\" tidak pernah muncul, tanpa satu pun galat yang menandainya.",
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
      "Penolakan yang disengaja pada jalur portal dijawab dengan sebabnya, bukan dilepas menjadi galat 500. Petugas yang menerima \"terjadi kesalahan\" akan mencoba lagi; yang menerima \"sudah diteruskan ke e-Court\" tahu bahwa yang tersisa adalah pekerjaan di e-Court.",
    ],
    fixed: [
      "BERKAS TERCATAT TERUNDUH PADAHAL TIDAK PERNAH TERTULIS. Catatannya disimpan LEBIH DULU - lengkap dengan jalur berkas pada catatan dokumen, yang membuat panel menyatakan berkasnya ada - lalu penulisannya gagal: cakram penuh, izin folder, nama terlalu panjang. Lebih buruk, kekeliruannya mengunci dirinya sendiri: penarikan berikutnya mengunduh isi yang sama, sidik jarinya sama, barisnya sudah ada, maka penulisannya dilewati lagi. Tidak ada penarikan keberapa pun yang membetulkannya. Sekarang berkasnya ditulis lebih dulu dan dicatat sesudah berhasil, dan penulisannya dikerjakan setiap kali berkasnya tidak ada di disk - bukan hanya ketika catatannya baru - sehingga berkas yang hilang terisi kembali dengan sendirinya.",
      "PERKARA DI URUTAN BAWAH TIDAK PERNAH TERSENTUH PENJADWAL. Penjadwal memeriksa 25 perkara tiap putaran - batas yang benar, sebab bebannya ada di server Mahkamah Agung. Tetapi pembatasannya dikerjakan pada daftar MENTAH: dua puluh lima perkara PERTAMA menurut urutan pendaftaran, apa pun keadaannya. Perkara yang berkasnya sudah lengkap tetap memakan jatah - dilewati murah, tetapi jatahnya terpakai. Begitu 25 perkara teratas lengkap, tiap putaran menghabiskan seluruh jatahnya untuk melewati perkara yang sudah beres, dan perkara ke-26 dan seterusnya tidak pernah dibuka. Perkara lama yang baru menerima Jawaban duduk jauh di bawah daftar itu - dan justru itu yang tenggatnya sedang berjalan. Penyaringan kini dikerjakan lebih dulu, sehingga jatah 25 seluruhnya diberikan kepada perkara yang memang perlu diperiksa dan sapuannya maju dari putaran ke putaran.",
      "DUA DOKUMEN BERBEDA YANG BERBAGI SATU KUNCI, YANG KEDUA HILANG. Kunci dokumen disusun dari nomor perkara, judul, email pengunggah, dan waktu unggah sampai satuan menit - dan dua dokumen e-Court yang berbeda dapat menghasilkan kunci yang sama persis: berkas pendaftaran berjudul sama (\"bukti surat\" dua lembar, lazim ketika satu pihak mengunggah beberapa bukti sekaligus - berkas pendaftaran tidak membawa email maupun waktu unggah, jadi yang tersisa hanya judulnya), atau dokumen persidangan dari pihak yang sama berjudul sama dalam menit yang sama. Yang pertama diunduh; yang kedua ditolak pemeriksa ulang - \"baru saja diperiksa\" - lalu dilewati seluruhnya, dan berkasnya tidak pernah sampai ke server. Berulang begitu tiap putaran. Sekarang dokumen kedua yang berbagi kunci tetap diunduh, dan berkasnya duduk berdampingan di arsip karena penyimpanannya per sidik jari.",
      "DOKUMEN TERLIHAT TETAPI TIDAK PERNAH DIUNDUH, TANPA SUARA. Barisnya terbaca dari halaman, judul dan pengunggahnya terbaca, lalu tercatat sebagai dokumen tanpa satu berkas pun - tanpa baris log, tanpa hitungan galat, dan ringkasan penarikan tetap tampak bersih. Dua jalur diam ditutup: dokumen yang tidak punya satu tautan pun, dan tautan yang alamat berkasnya gagal ditanyakan. Keduanya kini dihitung galat dan disebut judul dokumennya, sehingga penarikan yang meninggalkan puluhan dokumen tanpa berkas tidak lagi berakhir dengan nol galat.",
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
      "Perkara yang berkasnya tidak pernah dapat dilengkapi kini tidak lagi memblokir giliran, tetapi tetap diperiksa ulang tiap kali gilirannya tiba - dan tiap kali gagal dengan sebab yang sama. Kejadiannya terbaca dari hitungan galat beserta catatan \"tautan berkas tidak ditemukan\"; belum ada yang menghentikan percobaan berulang atas dokumen yang jelas-jelas tidak dapat diambil.",
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
      "Nilai kredensial yang tidak terbaca melempar galat, bukan mengembalikan kosong. Akibatnya keterangan \"password tidak dapat dibaca, kunci enkripsi berubah\" yang sudah ditulis TIDAK PERNAH terjangkau, dan yang dilihat petugas hanyalah layar galat. Terjadi secara wajar: kunci diganti, atau basis data dipulihkan dari cadangan lama.",
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
      "Kewenangan mengisi borang tidak lagi berarti kewenangan atas keempat penetapan. Sebelumnya kode hanya tahu \"boleh mengisi borang atau tidak\" - sehingga Panitera yang diberi kewenangan itu dapat mengisi borang PMH, yang merupakan perbuatan Ketua Pengadilan. Sekarang jabatannya diperiksa per penetapan, dan diperiksa di server saat pengisiannya dicatat.",
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
      "Menu yang perannya tidak berwenang tidak lagi digambar. Sebelumnya Penunjukan, Data Umum, dan Baca Medan Borang tetap muncul untuk semua orang dan baru menolak sesudah ditekan - tiga baris yang tidak pernah dapat dibuka juru sita maupun panitera muda. Super Admin dan Admin tetap penuh.",
      "Baca Medan Borang dibatasi ke Super Admin dan Admin. Ia alat memetakan borang, jawabannya sama pada perkara mana pun - bukan keterangan perkara. Rencana semula memindahkannya ke popup ikon, tetapi itu menuntut izin tabs yang sengaja dihindari ekstensi ini sejak awal.",
      "Urutan menu mengikuti perjalanan perkara - berkas masuk, perkara berjalan, perkara putus, lalu yang dikerjakan. Sebelumnya urutannya mengikuti kapan menunya dibuat.",
    ],
    fixed: [
      "Penanda \"nomor belum dikonfirmasi\" di halaman SIPP muncul pada SETIAP pihak, termasuk yang nomornya justru sudah diverifikasi. Sebabnya: keadaannya dibandingkan dengan nilai \"terkonfirmasi\" yang tidak pernah dihasilkan server sama sekali - yang sah hanya terverifikasi, menunggu, ditolak, dan belum_pernah_ditanya. Perbandingannya karena itu selalu benar. Salahnya tidak pernah terlihat karena pihak yang sudah terverifikasi memang masih sedikit: penandanya tampak benar hampir sepanjang waktu, dan baru keliru pada perkara yang justru sudah beres.",
    ],
    security: [
      "Kewenangan peran ikut dikirim rute konteks supaya menu yang mustahil dipakai tidak digambar. Ini KENYAMANAN, bukan penjagaan - tiap rute tetap memeriksa ulang kewenangannya sendiri sebelum menjawab, sebab ekstensi berjalan di peramban pengguna dan dapat diubah siapa saja yang memasangnya.",
      "Kewenangan yang belum terbaca berarti menu TETAP digambar. Menyembunyikannya saat ragu akan membuat pemasangan baru tampak kehilangan separuh fiturnya, dan yang disalahkan biasanya ekstensinya - bukan jawaban yang belum sampai.",
      "Kelompok Kerjakan dipisah dari yang dibaca bukan demi kerapian: mencampur menu yang menampilkan keterangan dengan menu yang mengisi borang SIPP membuat tombol yang menulis duduk di antara tombol yang tidak, dan pada layar sesak itu cara termudah salah tekan.",
    ],
    operationalNotes: [
      "Lencana untuk lima menu diambil dari SATU panggilan yang memang sudah dipakai kelimanya, dan hasilnya sudah disimpan per nomor perkara - tidak ada kueri tambahan. Yang dikerjakan hanya memajukan panggilan itu.",
      "Panggilan itu DITUNDA sekitar satu detik dan berjalan di latar, bukan sebelum panel digambar. Panelnya tetap muncul seketika seperti sebelumnya; lencananya menyusul. Berpindah perkara sebelum satu detik membatalkan panggilannya.",
      "Lencana yang gagal terisi tidak menampilkan galat apa pun - menunya tetap dapat dibuka seperti biasa, dan menyebutkan sebabnya sendiri di situ.",
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
      "Jadwal yang gagal dimuat kini ikut mengosongkan antriannya. Tanpa itu, nomor antrian hari sebelumnya tertinggal di layar bersama pesan galat - dan nomor lama yang masih terpampang lebih menyesatkan daripada kolom yang kosong.",
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
      "Nilai kosong sempat ikut terbalik arahnya saat pengurutan dibalik, sehingga mengurut menurun menaikkan baris tanpa ruang sidang ke puncak. Sebabnya: kekosongan disimpulkan dari angka hasil pembandingnya, padahal localeCompare juga mengembalikan 1 dan -1 untuk teks biasa - separuh perbandingan biasa terbaca sebagai kekosongan, dan urutan menurun berhenti bekerja tanpa satu pun galat.",
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
    title: "ALETA v1.56.0 - ALETA Mulai Mengisi Borang SIPP",
    date: "2026-09-01",
    status: "Operasional",
    summary:
      "Tombol Kerjakan dinyalakan: ALETA mengisikan usulan penunjukan ke borang SIPP, dan memetik isian Data Umum dari berkas gugatan yang diunggah. Penunjuk medannya disimpan sebagai data yang disunting dari kenyataan, bukan ditebak. Yang menekan Simpan tetap petugas - saklar penyimpanan otomatis ada, dan bawaannya mati.",
    added: [
      "Pembacaan berkas gugatan .docx, .doc, .rtf, .pdf teks, dan .txt, lalu pemetikan isian Data Umum darinya: kedua pihak, umur, agama, pekerjaan, pendidikan, kedua alamat, nilai sengketa, dan petitum.",
      "Tiap petikan menyebutkan potongan kalimat ASALNYA. Gugatan ditulis manusia dan tidak ada dua yang bentuknya sama - petikan tanpa asal-usul hanya bisa dipercaya atau tidak, sedangkan yang menyebutkan barisnya bisa dicocokkan dalam dua detik.",
      "Jembatan ke dunia halaman SIPP, sehingga select2 dan CKEditor dapat diisi benar. Menyetel value pada elemen aslinya membuat tampilannya berubah tanpa nilainya ikut - dan yang tersimpan kemudian bukan yang terlihat.",
      "Peta medan borang yang disunting dari pengaturan, dengan mode Baca Borang di ekstensi yang menyebutkan medan apa saja yang benar-benar ada di halaman beserta labelnya.",
      "Tombol Kerjakan pada papan penunjukan. Ia mengenali borang mana yang sedang terbuka dari MEDANNYA, bukan dari alamat halaman - nama halaman SIPP berbeda antar jenis perkara dan antar versi.",
      "Pemeriksaan balik sesudah Simpan: bot membaca ulang perkara_penetapan dan mencatat apakah yang diisikan benar-benar tercatat. Yang mendarat sebagian tetap tercatat sebagian, bukan dibulatkan jadi berhasil atau gagal.",
      "Catatan pengisian mencatat ASAL tiap nilai - usulan otomatis atau pilihan manual - sehingga pertanyaan seberapa sering usulannya diubah orang dapat dijawab dengan angka.",
      "Saklar penyimpanan otomatis di pengaturan. Bawaannya mati, dan hanya nilai persis \"nyala\" yang menyalakannya.",
    ],
    changed: [
      "Urutan pengisian penunjukan menjadi PMH, PPP, PJS, lalu PHS. Rencana semula mendahulukan PPP dan PJS dengan alasan keduanya paling mudah dibetulkan - itu tidak dapat dijalankan: SIPP menolak penetapan panitera pengganti dan juru sita selama majelisnya belum ditetapkan. Bukan urutan yang lebih aman, melainkan urutan yang diterima sama sekali.",
      "Kalimat \"Tidak mengubah SIPP sama sekali\" dicabut dari keterangan ekstensi dan panduan pemasangan. ALETA kini memang mengisi borangnya - yang tetap adalah bahwa Simpan ditekan petugas.",
      "Contoh tanggal sidang pada uji tidak lagi memakai perkara verzet. Verzet upaya hukum, dan memakainya sebagai contoh perkara biasa menyesatkan. Acuannya sekarang perkara 468/Pdt.G/2026 - gugatan biasa - ditambah uji sifat menyeluruh untuk seluruh gabungan hari dan tanggal daftar.",
    ],
    fixed: [
      "Pembacaan RTF membuang tabel fon dengan pola yang menuntut dua backslash padahal hanya ada satu, sehingga tabelnya tidak pernah terbuang. Akibatnya nama seluruh fon terbaca sebagai isi dokumen, dan \"Times New Roman\" ikut terpetik sebagai nama pihak berperkara. Diganti pemindai kedalaman kurung, yang juga menangani kelompok bersarang.",
      "Kolom hasil pemeriksaan pada catatan pengisian sempat tersisip ke tabel log tanya-jawab publik alih-alih ke tabel penunjukan - dua tabel yang kebetulan berakhir dengan baris yang sama. Ketahuan karena ujinya menjalankan kuerinya sungguhan, bukan membaca tulisannya.",
    ],
    security: [
      "Penunjuk medan disimpan sebagai data, bukan ditanam di kode. Nama kolom yang salah membuat kueri GAGAL dengan pesan yang menyebut kolomnya; penunjuk medan yang salah membuat pengisian mengenai medan LAIN - dan itu tidak gagal sama sekali, ia hanya salah. Selama petanya kosong, tombol Kerjakan tetap mati.",
      "Borang yang petanya setengah jadi TIDAK dinyatakan siap. Mengisi separuh borang lalu menyerahkan sisanya ke petugas menghasilkan borang yang tidak jelas siapa yang mengisinya - lebih sulit diperiksa daripada borang yang seluruhnya diketik orang.",
      "Pengisian berhenti pada kegagalan PERTAMA, dan menyebutkan medan mana. Meneruskan sesudah satu medan gagal menghasilkan campuran antara yang diisi ALETA dan yang tertinggal dari isian sebelumnya.",
      "Kewenangan diperiksa lagi di server saat pengisiannya dicatat, bukan hanya sebelum tombolnya digambar. Ekstensi berjalan di peramban pengguna dan dapat diubah siapa saja yang memasangnya.",
      "Jembatan dunia utama hanya menerima pesan dari halaman itu sendiri, dan tidak memutuskan apa pun - ia hanya menyebutkan medan, mengisi satu medan, dan menekan satu tombol. Seluruh keputusan dibuat di sisi yang sudah lewat pemeriksaan kewenangan.",
      "Berkas gugatan TIDAK disimpan di mana pun. Ia dibaca di memori, dipetik, lalu dilepas - salinan ketiga di luar SIPP dan e-Court adalah kewajiban penyimpanan baru yang tidak diminta siapa pun. Ukurannya pun diperiksa sebelum dibaca ke memori, bukan sesudah.",
      "Bot tidak terjangkau saat pemeriksaan balik TIDAK ditandai gagal. Menandainya gagal mencatat kebohongan yang lebih buruk daripada mengakui belum tahu; catatannya dibiarkan belum diperiksa.",
    ],
    operationalNotes: [
      "Sebelum dipakai, peta medan tiap borang harus diisi lewat Pengaturan. Cara termudah: buka borangnya di SIPP, buka menu Baca medan borang ini pada panel ALETA, lalu salin penunjuknya.",
      "Nama medan menurut ALETA - hakim_ketua, panitera, jurusita, tanggal_penetapan, tanggal_sidang, dan simpan - bukan nama medan di SIPP. Peta medanlah yang menghubungkan keduanya, dan itu sebabnya daftar ini tetap sama walau borang SIPP berganti bentuk.",
      "Keempat penetapan ada di halaman berbeda, sehingga tombol Kerjakan hanya mengisi borang yang sedang terbuka. Papan menyebutkan urutannya bila halaman yang terbuka bukan salah satunya.",
      "PDF hasil pindaian tidak memuat teks sama sekali. Itu disebutkan apa adanya, bukan dilaporkan sebagai kegagalan membaca.",
      "Berkas .doc lama hanya dapat dibaca kasar, dan hasilnya ditandai begitu di papan. Menyimpan ulang sebagai .docx menghasilkan pembacaan yang bersih.",
    ],
    knownLimitations: [
      "Pilihan manual pada papan penunjukan belum ada - yang diisikan selalu usulan otomatisnya. Catatan pengisian sudah menyediakan tempat untuk membedakan keduanya.",
      "Pengisian Data Umum masih berhenti pada penampilan petikan. Peta medan borang data-umum sudah disiapkan, tetapi pengisiannya menunggu medan borang itu dipetakan.",
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
      "Papan ini TIDAK menulis apa pun ke SIPP. Tombol Kerjakan mati, dan itu bukan pekerjaan yang tertinggal: usulannya memang perlu diadu dengan penunjukan sungguhan sebelum diberi izin menyentuh borang.",
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
      "Tombol Kerjakan belum menyala. Pengisian borang SIPP menyusul setelah usulannya terbukti tenang.",
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
      "Dua cacat yang sudah terbukti diperbaiki: sesi e-Court hilang setiap pembaruan karena profilnya berada di dalam container, dan isi berkas tidak pernah diperiksa sehingga halaman galat tersimpan sebagai PDF yang dianggap lengkap. Ditambah pemantau sesi dengan peringatan WhatsApp, akun bergiliran, pemeriksaan keutuhan arsip, dan unduh satu perkara sebagai ZIP.",
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
      "Jawaban yang bukan berkas tersimpan sebagai berkas. Tipe text/html memang sudah ditolak, tetapi jawaban ber-tipe benar dengan tubuh halaman galat, jawaban terpotong, dan jawaban kosong semuanya lolos - lalu perkaranya tercatat LENGKAP dan dilewati penarikan berikutnya.",
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
      "Unduhan dari halaman Kendali Berkas tersimpan sebagai berkas.json alih-alih berkas perkaranya. Jawaban galat berbentuk JSON ikut tersimpan sebagai berkas, sehingga kegagalannya tidak pernah terlihat siapa pun - yang terunduh memang bukan berkasnya.",
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
      "Sapuan daftar tidak pernah berpindah halaman. Jeda tetap 1,2 detik membuat pembacaan terjadi sebelum tabel selesai menggambar ulang, sehingga isi halaman pertama terbaca berulang. Empat puluh halaman terbaca, totalnya tetap sepuluh - dan tidak terlihat sebagai galat sama sekali.",
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
      "Penjadwal e-Court dapat macet PERMANEN. Bila halaman pendaratan tidak memuat tautan perkara, jembatan menunggu tombol Enter - padahal penjadwal menjalankannya dengan stdin ditutup, sehingga Enter tidak akan pernah datang. Prosesnya menggantung selamanya dan seluruh putaran berikutnya dilewati dengan alasan putaran sebelumnya belum selesai, tanpa pesan galat apa pun.",
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
      "Login e-Court dengan sandi dan captcha yang benar tetap ditolak, karena e-Court menyelipkan halaman penegasan /GateLogin yang tidak pernah dilewati. Ditambah pesan galat yang menyebutkan sebabnya, bukan sekadar HTTP 400.",
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
      "Badan permintaan login tetap tidak dicatat sama sekali - bukan ke log akses, bukan ke pesan galat, bukan ke jejak keamanan.",
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
      "Seluruh 25 alamat yang dipakai portal untuk memanggil ALETA Bot - status penghubung, verifikasi hakim, login e-Court, penjadwal, arsip, pengaturan, konteks SIPP, dan unduhan berkas - kehilangan segmen /aleta-bot sehingga dijawab halaman 404 HTML, bukan data. Halaman ALETA e-Court menampilkan galat alih-alih keadaan penghubung.",
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
      "Pemeriksaan konfigurasi database saat bot menyala kini melempar galat tanpa bergantung NODE_ENV.",
    ],
    fixed: [
      "Konfigurasi database yang berbahaya hanya menghentikan bot bila NODE_ENV bernilai production. Di luar itu cukup peringatan konsol dan bot tetap menyala - sementara server yang lupa menyetel NODE_ENV adalah hal yang lumrah pada pemasangan cepat. Inilah celah yang dulu membuat tabel ALETA terbentuk di dalam database perkara.",
    ],
    security: [
      "SIPP adalah sistem induk Mahkamah Agung yang dipakai seluruh pengadilan. ALETA hanya menumpang membaca. Versi lama pernah menulis tabelnya sendiri ke sana karena ALETA_BOT_DB_NAME mengarah ke SIPP - kesalahan yang tidak menghasilkan pesan galat apa pun: bot berjalan normal, hanya menyimpan datanya di tempat yang salah.",
      "Kedua lapis penjagaan kini sama kuatnya. Sebelumnya bot_db_config melempar galat tanpa syarat, tetapi configValidationService hanya memperingatkan di luar produksi.",
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
      "Pesan galat dari puppeteer tidak diteruskan apa adanya, karena dapat memuat potongan isi halaman dan halaman login memuat kolom sandi.",
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
