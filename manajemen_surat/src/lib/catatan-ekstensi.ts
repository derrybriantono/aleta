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
    versi: "1.205.29",
    dirilis: "2026-10-22T06:59:00+08:00",
    judul: "Jadwal Sidang: tunda otomatis, sidang keliling, hakim per perkara",
    butir: [
      "Jadwal Sidang: menu tunda dan putus ringkas - pilih lalu Simpan, tertutup sendiri, tanpa keterangan teknis; usulan tanggal dengan kalimat singkat.",
      "Saklar Tunda otomatis (Super Admin, bawaan mati, ada mode kering): pukul 16.30 perkara yang belum diberi hasil ditunda menurut kebiasaan; gugur dan tidak dapat diterima hanya menjadi usulan untuk majelis.",
      "Saklar Sidang keliling per tanggal (tawaran otomatis bila sebagian besar sidang di luar gedung); tunda otomatis hari itu pukul 14.00.",
      "Pilih satu hakim per perkara atau per panitera sidang (konseptor sementara ikut terisi), nama hakim tampil di jadwal, dan cetak terpisah per hakim.",
      "Per panitera sidang: tunda massal dan keterangan putus massal dengan laporan per perkara.",
    ],
  },
  {
    versi: "1.205.28",
    dirilis: "2026-10-21T23:57:00+08:00",
    judul: "Tombol Muat ulang dan pihak lengkap di blangko",
    butir: [
      "Tombol Muat ulang di kepala SIPP halaman perkara (samping Tarik data): memuat ulang tetap di perkara dan tab yang sama sehingga berkas yang baru diunggah langsung tampil; bila ada isian yang belum disimpan, ditanya dulu.",
      "Blangko Derry: semua pihak (Pemohon/Penggugat, Termohon/Tergugat, Turut Tergugat) tercetak lengkap sampai pihak terakhir; tiga Pemohon dengan kuasa dan koma kalimat kuasa empat pihak dibetulkan.",
      "Rekonvensi cerai talak: tuntutan harta bersama dalam rekonvensi kini tercetak; kutipan petitum tampil untuk semua tuntutan.",
      "Perbaikan kecil isi blangko: total biaya, ejaan, sebutan Pemohon pada izin poligami, tanggal relaas pertama lebih cepat.",
    ],
  },
  {
    versi: "1.205.27",
    dirilis: "2026-10-21T18:13:00+08:00",
    judul: "Arsip hasil mediasi dan peta relaas elektronik",
    butir: [
      "Tab Mediasi SIPP: tombol Unggah hasil mediasi (PDF, RTF, DOC, DOCX) di bawah Edit Hasil Mediasi; berkas disimpan di arsip per perkara dengan daftar, pratinjau, ganti dan hapus berjejak; bila mediasi berhasil dengan akta perdamaian, dapat dikirim juga sebagai e-Doc akta di SIPP dengan konfirmasi.",
      "Peta relaas: panggilan elektronik dihitung bertemu.",
    ],
  },
  {
    versi: "1.205.26",
    dirilis: "2026-10-21T16:59:00+08:00",
    judul: "Putusan Otomatis, tarik data satu perkara, tuntutan semua blangko",
    butir: [
      "Putusan Otomatis di SIPP: berkas putusan yang diseret ke panel kini dipakai mengisi Putusan Akhir lalu diunggah sebagai e-Doc putusan dan anonimisasi; tanpa draf maupun berkas, panel memberi petunjuk dan tidak membuka formulir kosong.",
      "Semua panel ALETA terlipat pada setiap kunjungan, kecuali Blangko ABT by Derry.",
      "Tombol Tarik data di kepala SIPP (kiri Selamat Datang) menarik data e-Court satu perkara di sela penarikan utama, tanpa memberatkannya.",
      "Jadwal Sidang dan Jadwal Mediasi tanpa layar memuat (pesan hanya bila gagal, dengan Coba lagi); panggilan elektronik dihitung bertemu.",
      "Tuntutan dalam petitum kini juga untuk hak bekas istri, varian cerai (mut'ah iddah, hak asuh, nafkah anak), kebendaan dan anak; nama pihak tidak lagi terbaca sebagai tuntutan.",
      "Kode pos di amplop relaas dari tabel kode pos SIPP (hanya bila pasti).",
      "Kalimat penutup keterangan saksi (mis. Bahwa sudah cukup) tidak lagi tercetak di putusan dan BAS, baik lewat panel maupun ABT langsung.",
    ],
  },
  {
    versi: "1.205.25",
    dirilis: "2026-10-21T15:12:00+08:00",
    judul: "Tuntutan, penetapan dan pratinjau dokumen lebih tepat",
    butir: [
      "Blangko ABT by Derry: tuntutan yang tidak diminta tidak lagi tampil sebagai ditetapkan karena jabatan; keputusan atas tuntutan dipilih dari satu pilihan (dengan alasan bila ditolak atau tidak dapat diterima); karena jabatan hanya lewat saklar hakim.",
      "Blangko ABT by Derry dibuka di Sidang hari ini; Pilih tanggal cukup diisi satu tanggal.",
      "Penetapan Otomatis di SIPP terlipat bawaan; tombolnya tidak tampil bila PMH, PPP, PJS dan PHS sudah tercatat dan e-Doc-nya lengkap.",
      "Pratinjau dokumen sebelum unduh untuk semua dokumen SIPP: BAS, relaas, putusan dan anonimisasi, gugatan/permohonan, penetapan PMH/PPP/PJS/PHS, e-Doc e-Court, arsip dan cetakan RTF; berkas diambil lewat jalur latar ekstensi sehingga pengelola unduhan tidak merebutnya.",
    ],
  },
  {
    versi: "1.205.24",
    dirilis: "2026-10-21T12:48:00+08:00",
    judul: "Isian dan putusan mengikuti tuntutan dalam petitum",
    butir: [
      "Blangko ABT by Derry: kartu isian kini persis sama dengan tabel variabel ABT untuk blangko yang dibuka (urutan dan isinya); isian yang hanya dibaca bagian otomatis dipindah ke bagian tertutup.",
      "Tuntutan dalam posita dan petitum: status tiap tuntutan (diminta, tidak diminta, ragu) beserta kutipan petitumnya; isian mut'ah, nafkah iddah, madliyah, hak asuh dan nafkah anak hanya tampil bila diminta, sudah diisi, atau ditetapkan karena jabatan oleh hakim.",
      "Putusan cerai: pembaca petitum tidak lagi salah menyala karena nama pihak, sehingga tanda periksa nafkah iddah/mut'ah/madliyah tidak muncul pada perkara yang tidak menuntutnya; nomor amar tetap urut.",
      "Kartu Alasan perceraian menjelaskan bahwa pertimbangan alasan baru terisi sesudah alasan dipilih dan disimpan.",
    ],
  },
  {
    versi: "1.205.23",
    dirilis: "2026-10-21T11:29:00+08:00",
    judul: "Penetapan, putusan dan jadwal putusan di SIPP lebih rapi",
    butir: [
      "Penetapan Otomatis di SIPP: tombol Centang semua e-Doc dan Tetapkan & unggah e-Doc langsung di bawah daftar PMH-PHS; ringkasan beban usulan dan jumlah perkara diterima 30 hari di samping judul; rincian beban terlipat (buka dengan Rincian).",
      "Beban penetapan: hitungan Tahun ini untuk majelis kini mencakup seluruh perkara tahun berjalan (sebelumnya hanya sejak SK berlaku); panitera pengganti dan juru sita yang tidak aktif tidak lagi diusulkan; nama majelis tampil dipisah koma.",
      "Tombol Penetapan Otomatis, Putusan Otomatis dan Jadwalkan Putusan tetap di tempatnya dengan warna seragam; Putusan Otomatis dan Jadwalkan Putusan mengikuti tema gelap/terang dan terlipat bawaan.",
      "Putusan Otomatis: tempat seret/pilih berkas putusan (RTF, DOCX, DOC, PDF) untuk e-Doc putusan dan anonimisasi.",
      "Jadwalkan Putusan banyak perkara sekaligus kini di Dashboard SIPP dan Daftar Perkara Perdata (samping tombol Cetak); di detil perkara hanya untuk perkara itu.",
      "Hak: Putusan Otomatis dan Jadwalkan Putusan untuk Ketua, Wakil Ketua dan Hakim; Penetapan Otomatis untuk PTSP, Ketua dan Wakil Ketua.",
    ],
  },
  {
    versi: "1.205.22",
    dirilis: "2026-10-21T08:10:00+08:00",
    judul: "Akun nonaktif tersembunyi di Admin",
    butir: [
      "Admin - Akun: akun nonaktif tidak lagi memenuhi daftar; centang \"Tampilkan akun nonaktif\" untuk memperlihatkannya kembali (pilihan diingat di peramban). Akun nonaktif bertanda \"Nonaktif\".",
    ],
  },
  {
    versi: "1.205.21",
    dirilis: "2026-10-21T02:38:00+08:00",
    judul: "Kerangka universal gelombang 2 dan 3: semua jenis perkara",
    butir: [
      "Gelombang 2: tanya jawab saksi, isi otomatis, dan blangko putusan diperluas untuk harta bersama, kewarisan, wasiat, hibah, wakaf, ekonomi syariah, izin poligami, pencegahan dan pembatalan perkawinan, hak asuh, penguasaan anak, nafkah anak, pengangkatan anak, mafqud, dan permohonan umum.",
      "Gelombang 3: blangko Derry baru (putusan/penetapan dan BAS) untuk penolakan perkawinan, perkawinan campuran, izin kawin, pengesahan anak, kelalaian kewajiban suami istri, hak bekas istri, pencabutan kekuasaan orang tua dan wali, penunjukan wali, ganti rugi terhadap wali, nafkah anak oleh ibu, eksekusi, dan verzet; Blangko Derry menyarankannya otomatis menurut jenis perkara.",
      "Isian baru yang belum terukur ketepatannya tampil sebagai saran bertanda ragu; keputusan majelis tetap pilihan hakim.",
    ],
  },
  {
    versi: "1.205.20",
    dirilis: "2026-10-21T01:06:00+08:00",
    judul: "Putusan Otomatis dengan e-Doc sekaligus, Jadwalkan Putusan, SK Majelis dan beban penetapan, pratinjau BAS/relaas",
    butir: [
      "Putusan Otomatis kini langsung mengunggah e-Doc putusan dan e-Doc anonimisasi sesudah Putusan Akhir tersimpan, dan tersedia sebagai tombol \"Putusan Otomatis\" di halaman perkara SIPP.",
      "Jadwalkan Putusan: pilih perkara atau tanggal, seret banyak berkas putusan sekaligus, lalu tentukan jam unggah dengan jeda wajar; e-Doc diunggah server pada waktunya, form Putusan Akhir diisi saat SIPP terbuka.",
      "Penetapan: halaman SK Majelis di Admin dapat diatur sendiri (nomor, tanggal, berlaku mulai, susunan majelis dan panitera pendamping, peringatan pegawai mutasi), dan papan penetapan menampilkan beban tiap hakim, panitera pengganti, dan juru sita (30 hari, kebendaan 6 bulan) dengan urutan rekomendasi yang paling ringan lebih dulu.",
      "Tombol unduh BAS dan relaas di SIPP menampilkan pratinjau dokumen lebih dulu; dari sana dapat diunduh atau dicetak (dapat dimatikan di Alat saya).",
      "Widget ALETA di bilah ekstensi ditata ulang: setiap saklar berada di bagian yang sesuai fungsinya, label di kiri dan saklar di kanan, dan bagian dapat dilipat.",
    ],
  },
  {
    versi: "1.205.19",
    dirilis: "2026-10-20T22:01:00+08:00",
    judul: "Penetapan Otomatis di halaman SIPP, penetapan tanpa ganda, dan muat ulang otomatis",
    butir: [
      "Tombol \"Penetapan Otomatis\" di halaman perkara SIPP: panel terbentang berisi PMH, PPP, PJS, dan PHS dengan centang unggah e-Doc; satu klik menetapkan yang belum ada lalu mengunggah e-Doc yang dicentang.",
      "Penetapan tidak lagi dapat tertulis ganda: keadaan penetapan dibaca dari satu sumber dan dikunci per perkara, formulir SIPP yang diisi ekstensi memeriksa ulang sebelum Simpan, dan pembongkaran hanya terjadi atas perintah petugas.",
      "Sesudah menulis ke SIPP (penetapan, bongkar, Data Umum, Court Calendar, e-Doc penetapan, penetapan massal, kasir), halaman dimuat ulang otomatis dan tetap di perkara yang sama, dengan ringkasan hasil per langkah; bila ada yang gagal halaman tidak dimuat ulang sendiri.",
      "e-Doc penetapan: PMH memakai cap kantor menindih tanda tangan, logo pada kotak tanda tangan elektronik PPP dan PJS berada di dalam kotak, dan kata tidak lagi terpotong di tengah.",
      "Tanya jawab saksi dan isi otomatis gelombang 1 diperluas: cerai, itsbat, asal usul anak, dispensasi kawin, wali adhal, perwalian, dan ahli waris memakai satu sumber fakta perkara; isian hanya terisi sendiri bila ketepatannya sudah terukur, selebihnya saran bertanda ragu.",
    ],
  },
  {
    versi: "1.205.18",
    dirilis: "2026-10-20T16:05:00+08:00",
    judul: "Tanya jawab saksi semua jenis perkara dan isi otomatis seluruh isian ABT",
    butir: [
      "Tanya jawab saksi di Blangko ABT by Derry Briantono mengikuti jenis perkara: pilihan \"Yang diketahui saksi\", peran saksi (mis. wali atau saksi nikah pada itsbat), dan susunan pertanyaan diambil dari katalog jenis perkaranya; perkara permohonan menyebut \"Saksi 1 Pemohon\".",
      "Jawaban saksi terisi otomatis dari isian blangko, data SIPP, dan posita gugatan/permohonan untuk semua jenis perkara termasuk cerai (titik-titik turun dari sekitar 34% menjadi sekitar 8%); jawaban yang sumbernya bertentangan diberi tanda ragu dengan penjelasan di ikon ⓘ, dan saksi kedua memakai kalimat yang berbeda.",
      "Kotak jawaban saksi berwarna menurut keadaannya (kuning perlu dilengkapi, oranye ragu, hijau terisi dari data) dengan ringkasan yang dapat diklik untuk melompat ke kotaknya; tombol Tambah baris pindah ke bawah tabel.",
      "Tombol \"Susun ulang jawaban\" menjadi \"Isi ulang dari data perkara\" dan selalu meminta persetujuan dengan jumlah jawaban yang akan berubah; jawaban yang sudah diketik tidak ditimpa tanpa centang khusus.",
      "Isi otomatis isian ABT diperluas ke semua jenis perkara dan semua jenis blangko (putusan/penetapan, BAS, relaas, PTSP, ikrar); isian yang tidak pasti diberi tanda ragu, isian yang memang keputusan majelis diberi tanda \"diisi manual\" beserta alasannya.",
      "Petunjuk perbaikan permohonan (#9134) dipindah ke bagian \"Isian tambahan (bila ada)\" dan tidak lagi dihitung di Perlu diisi; kartu alasan perceraian tidak lagi muncul di BAS.",
      "Kepala panel Blangko Derry yang menempel saat digulir kini berlatar padat dan ramping; peringatan daftar saksi kosong tidak lagi muncul ganda.",
    ],
  },
  {
    versi: "1.205.17",
    dirilis: "2026-10-20T11:15:00+08:00",
    judul: "Lihat sebagai tanpa nama kembar, peran tidak bertabrakan, saran blangko semua jenis perkara",
    butir: [
      "Blangko ABT by Derry Briantono: pemilih Lihat sebagai tidak lagi berisi nama kembar (nama tanpa gelar dan bergelar disatukan menjadi satu orang) dan pegawai yang sudah mutasi tidak ditampilkan.",
      "Pilihan blangko dikunci menurut peran: hakim mendapat putusan atau penetapan, panitera pengganti mendapat berita acara sidang; berganti Lihat sebagai atau perkara tidak lagi membawa pilihan berita acara ke hakim.",
      "Saran blangko kini muncul untuk semua jenis perkara (itsbat nikah, dispensasi kawin, perwalian, wali adhal, asal usul anak, ahli waris, dan lainnya) di putusan atau penetapan, berita acara sidang, relaas, dan PTSP.",
      "Keterangan teknis di kartu isian dipindah ke ikon ⓘ: tampil saat kursor di atasnya dan terbuka saat diklik.",
      "Portal tidak lagi terus gagal bila migrasi basis data bertabrakan saat dinyalakan ulang.",
    ],
  },
  {
    versi: "1.205.16",
    dirilis: "2026-10-20T10:28:00+08:00",
    judul: "Cetak massal per peran, cetak relaas sinkron peta, eviden SKP semua peran, Jadwal Sidang lewat tautan, dan ALETA Ai tahap 1",
    butir: [
      "Cetak massal di Blangko ABT by Derry Briantono menurut peran: hakim mencetak putusan, panitera dan panitera pengganti mencetak BAS, juru sita mencetak relaas, petugas PTSP mencetak penetapan; blangko dipilih dan diisi otomatis per perkara, ada daftar periksa siap/perlu dicek sebelum dicetak.",
      "Cetak relaas di Jadwal Sidang memakai aturan pihak yang sama dengan peta perkara relaas: perkara permohonan (Pdt.P) tidak lagi dipanggil dengan format gugatan seolah ada Termohon.",
      "Unduh eviden SKP kini tersedia untuk peran selain hakim (panitera, panitera pengganti, panitera muda, juru sita, mediator, PTSP, kasir, sekretariat) dari kegiatan nyata di SIPP, e-Court, dan aplikasi.",
      "Tanda tangan pejabat yang lebih besar dan ditindis cap berukuran tetap juga dipakai di ekstensi dan salinan putusan, dengan pengaturan ukuran di halaman Tanda tangan pejabat.",
      "Jadwal Sidang dapat dibuka lewat tautan rahasia tanpa akun dari jaringan kantor: hanya tombol tunda, putus, Court Calendar, mediator, dan tombol sisi kanan; semua tanda tetap tampil; tunda dan putus tercatat atas panitera pengganti perkara. Tautan dibuat dan dicabut oleh Admin.",
      "ALETA Ai (tahap 1, untuk sementara hanya Super Admin): asisten percakapan berisi Proyek ALETA AI PA V4.5 dengan mode Cepat/Teliti/Mendalam yang dipilih otomatis, biaya per jawaban dalam rupiah mengikuti kurs harian, dan saldo; aktif setelah kunci layanan dipasang di server.",
    ],
  },
  {
    versi: "1.205.15",
    dirilis: "2026-10-19T18:45:00+08:00",
    judul: "Tanda tangan pejabat lebih besar dan ditindis cap berukuran tetap",
    butir: [
      "Tanda tangan pejabat di e-Doc penetapan (PMH, PPP, PJS, PHS) dibuat sekitar 1,6 kali lebih besar dan bagian bawahnya menimpa sedikit nama penanda tangan, lalu ditindis cap di sisi kirinya dengan diameter cap yang selalu sama (36 mm) berapa pun ukuran gambar capnya, sehingga tampak seperti tanda tangan dan cap basah; tanda tangan pada Tambah tanda tangan ke PDF dan salinan putusan juga diperbesar.",
    ],
  },
  {
    versi: "1.205.14",
    dirilis: "2026-10-19T17:15:00+08:00",
    judul: "Blangko ABT by Derry: isian otomatis lebih tepat, tanya jawab saksi rapi, perkiraan sidang di pemilih, cetak bersih dan bertanda tangan",
    butir: [
      "Isian Blangko ABT by Derry lebih tepat: satu tombol \"Isi otomatis\" menggantikan Isi dari SIPP, Isi dari gugatan, dan Ambil tanggal KTP; Tanggal Nikah terisi dari data pernikahan SIPP atau gugatan; Awal perselisihan, Pisah rumah, Lama pisah, Yang meninggalkan rumah, dan Upaya damai dijaga bentuknya sehingga kalimat yang salah tempat (mis. kalimat ghaib) tidak lagi masuk; Beracara secara elektronik disarankan dari data e-Court; nomor di depan nama alat bukti dibuang; rincian alasan cerai selebar penuh dan kartu isian lebih rapi.",
      "Tanya jawab saksi: jawaban menjadi satu paragraf utuh tanpa baris baru di tengah kalimat dan dengan kalimat penyambung sehingga tidak menempel saat dicetak; Simpan ke ABT pindah ke bawah tabel, Selesai dihapus, tombol yang membingungkan dipindah ke menu Lainnya dengan nama yang jelas; tiap jawaban dapat ditukar ke saksi lain dan dipindah naik/turun; pilihan 'hanya sebagian alasan' hanya menampilkan alasan yang ada di posita; di blangko putusan dan untuk hakim keterangan saksi hanya dapat dibaca, dan kalimat penutup serta posita dirapikan otomatis.",
      "Pemilih blangko menampilkan perkiraan cocok untuk sidang ke-berapa di kiri nama blangko; teks penanda kecil di kepala halaman blangko dibuang saat dicetak; pilihan cetak bawaan hanya RTF; dan Tambah tanda tangan ke PDF kini memakai tanda tangan pejabat yang disahkan dan tertaut, tercentang otomatis.",
    ],
  },
  {
    versi: "1.205.13",
    dirilis: "2026-10-19T16:30:00+08:00",
    judul: "Draf putusan H-7 bertahap dalam satu jendela, kelompok Ikrar Talak di Blangko ABT by Derry, dan ikrar talak di Peta perkara",
    butir: [
      "Draf putusan H-7 di Jadwal Sidang kini satu tombol ringkas (mis. \"Draf putusan - 3 dari 11 siap\") yang membuka jendela besar dengan lima tahap yang dapat diklik: ringkasan dalam satu kalimat, isian otomatis beserta lencana yakin/ragu dan asal datanya, isian yang perlu diisi hakim dengan tombol Isi di Blangko, bahan perkara yang terlipat rapi, dan tombol Buka draf di Blangko ABT; isiannya memakai mesin yang sama dengan isi otomatis Blangko ABT by Derry, dan kotak draf di widget diringkas menjadi satu baris.",
      "Blangko ABT by Derry mendapat kelompok \"Ikrar Talak\" yang mengumpulkan BAS sidang ikrar, penetapan ikrar talak dan penetapan gugur, serta relaas panggilan ikrar dari folder aslinya, dengan saran menurut kehadiran Pemohon dan Termohon dan isi otomatis dari SIPP.",
      "Peta perkara memuat pilihan \"Ikrar talak\": sebaran cerai talak yang dikabulkan menurut keadaan ikrar per wilayah (sudah ikrar, menunggu, tenggat dekat, gugur, belum ada sidang ikrar, tidak jadi diikrarkan), dengan daftar perkara yang tenggatnya dekat atau sudah gugur; tenggat enam bulan dihitung sejak penetapan hari sidang ikrar.",
    ],
  },
  {
    versi: "1.205.12",
    dirilis: "2026-10-19T15:30:00+08:00",
    judul: "Panel penetapan lebih mudah, isi otomatis dan tanya jawab saksi di Blangko ABT by Derry, nama menu lengkap, Jadwal Sidang lebih ringkas, kepatutan pos, dan halaman lebih ringan",
    butir: [
      "Panel Penetapan lebih mudah: pejabat dipilih langsung di baris \"Ditetapkan\", tombol Ubah di tiap baris (majelis menurut SK beserta beban, PP ikut majelis, PHS bawaan pukul 09.00 Ruang Sidang 1), tombol e-Doc di tiap baris dan bagian e-Doc penetapan manual; \"Pilihan lain\", \"Lihat rincian pemeriksaan\", kotak Pejabat yang menetapkan, dan isian passphrase dihapus dari panel; pilihan pejabat petugas tidak lagi tertimpa kembali ke usulan saat panel digambar ulang.",
      "Formulir penetapan SIPP (Majelis Hakim, Panitera Pengganti, Juru Sita, Hari Sidang) mendapat tombol \"Isi otomatis\" dengan saran yang sama dengan panel; PP dan JS mengikuti majelis, semua dapat diganti, hari libur tidak dapat dipilih, dan tombol hanya mengisi kolom tanpa menekan Simpan. Lencana umur perkara di daftar SIPP pindah ke kolom Lama Proses.",
      "Tanda tangan pejabat yang bernama ditautkan ke akunnya, dan halaman Tanda tangan pejabat memuat pengaturan TTE BSrE (passphrase tidak pernah disimpan).",
      "Blangko ABT by Derry: pencarian perkara per nomor, jenis, alur, pihak, agenda, prioritas, dokumen, tanggal sidang, dan majelis/PP/JS; nama menu ditulis lengkap tanpa singkatan (\"CG - BAS\" menjadi \"Cerai Gugat - BAS\", \"CT\" menjadi \"Cerai Talak\", \"Diska/DK\" menjadi \"Dispensasi Kawin\", dan seterusnya, 32 nama) dengan nama lama tetap dikenali.",
      "Tanya jawab saksi Blangko Derry terisi otomatis memakai penyusun yang sama dengan Susun saksi, dengan pilihan pengetahuan tiap saksi (tahu seluruh alasan, sebagian, tidak tahu sebabnya, tidak menyaksikan, dari cerita, hanya tahu sudah pisah); jawaban yang diketik petugas tidak ditimpa; kartu isian dan alat bukti dirapikan agar tidak berdempetan dan tidak terpotong.",
      "Isi dari SIPP & input ke ABT kini ada di Blangko ABT by Derry untuk semua jenis perkara dan blangko: saklar \"Isi otomatis dari SIPP\" di Alat saya (bawaan menyala) mengisi isian kosong langsung dan tidak menimpa isian yang sudah ada, tombol \"Isi dari SIPP\" untuk mengisi ulang, mutu deteksi sama dengan panel ABT (termasuk penghitung lama pisah), periode ditulis \"bulan Januari 2023\" atau \"tahun 2023\", tag HTML dibuang kecuali variabel yang memang berisi HTML seperti tanda tangan majelis, dan tiap isian menampilkan lencana yakin/ragu, asal data, sumber, sekarang vs usulan, serta pilih bunyi alasan cerai.",
      "Saran blangko mengikuti jenis yang dipilih (putusan, penetapan, BAS), peran pengguna, dan kejadian di perkara, tanpa istilah teknis; kotak blangko dapat diklik dua kali untuk memilih blangko; catatan teknis isian yang disembunyikan dan penanda di luar katalog tidak tampil lagi.",
      "Menu kiri ABT dapat digulir sampai menu terakhir saat ekstensi menyala, dan posisi gulirnya diingat saat pindah halaman.",
      "Jadwal Sidang: pencarian mengenali kata seperti konseptor, ghaib, verstek, belum BAS, nama saksi dan mediator; tombol Tampilan di kanan; ruang sidang menjadi satu pita ringkas; nama saksi dapat dilipat; tulisan memuat dihapus; PP dan JS di baris sendiri; tombol Blangko membuka Blangko ABT by Derry dengan perkara dan jenis blangko yang sesuai. Status Perkara mendapat tautan BAS tiap sidang, blangko putusan, dan blangko ikrar.",
      "Kepatutan panggilan surat tercatat dihitung dari tanggal diterima, bukan tanggal dikirim, dan panggilan yang tidak patut menyebut jalurnya: tidak patut (pos), tidak patut (jurusita), atau tidak patut (elektronik).",
      "Dokumen e-Court berstatus \"Belum diverifikasi Majelis/Hakim\" tidak lagi terbaca sudah diverifikasi di Jadwal Sidang, dan daftar Kendali Berkas \"Putusan yang belum terbit di e-Court\" hanya memuat perkara yang sudah diputus di SIPP (126 perkara yang belum diputus sebelumnya keliru tertulis Menu Putusan E-Court Error).",
      "Halaman ALETA lebih ringan: pemeriksaan berkala ekstensi digabung dan berhenti saat tab tidak dilihat, hasil yang baru dimuat disimpan sebentar di server, muatan susulan ditunda, dan ALETA siap dibuka di port 8008 dengan ekstensi kembali sendiri ke alamat lama bila port itu belum hidup.",
    ],
  },
  {
    versi: "1.205.11",
    dirilis: "2026-10-19T11:00:00+08:00",
    judul: "OCR lampiran e-Court untuk isian ABT dan rujukan PERMA di blangko dispensasi ditolak",
    butir: [
      "Lampiran e-Court hasil pindai dibaca di latar dengan OCR (satu berkas per putaran, hasil disimpan sehingga tidak dibaca ulang): kartu keluarga, akta kelahiran, kematian, nikah, dan cerai, surat keterangan desa dan KUA, surat kuasa khusus dan insidentil, serta slip gaji; jenisnya dikenali dari isi halaman dan dokumen dicocokkan ke pihak perkara, sedangkan NIK hanya dipakai untuk mencocokkan dan tidak pernah disimpan atau ditampilkan.",
      "Hasilnya diusulkan (bercentang, tidak menimpa isian petugas) ke isian ABT: tanggal surat kuasa dan kantor advokat Tergugat, penerima kuasa insidentil, penghasilan, nomor/tanggal surat penolakan KUA, duplikat akta nikah, tempat dan tanggal lahir anak, serta kalimat salin alat bukti untuk daftar bukti; isian baru naik menjadi otomatis hanya bila terukur cocok sedikitnya 95% atas isian petugas.",
      "Blangko dispensasi kawin ditolak kini merujuk Pasal 12 ayat (2) huruf a dan b PERMA 5/2019 untuk keberlanjutan pendidikan anak (paket blangko susulan sudah terpasang di server).",
    ],
  },
  {
    versi: "1.205.10",
    dirilis: "2026-10-19T06:20:00+08:00",
    judul: "Rujukan PERMA 5/2019 dan KHES dicocokkan ke naskah resmi, alamat lengkap di prompt putusan",
    butir: [
      "Rujukan PERMA 5/2019 di pertanyaan saksi dan keterangan anak, calon, dan orang tua dispensasi kawin kini dicocokkan dengan naskah resmi: Pasal 12 ayat (4) serta butir pendamping dan rekomendasi psikolog atau tenaga kesehatan (Pasal 15 huruf c dan d) yang sebelumnya ditahan kini tercetak.",
      "Rujukan KHES (PERMA 2/2008) di pertanyaan saksi ekonomi syariah dicocokkan dengan naskah resmi: ingkar janji (Pasal 36-38), asas dan mengikatnya akad (Pasal 21 dan 44), rukun akad (Pasal 22-24), ganti rugi (Pasal 39), dan keadaan memaksa (Pasal 40-41).",
      "Prompt AI untuk membuat putusan kini memuat alamat pihak secara lengkap (nama asli dan alamat lengkap; NIK dan telepon tetap ditutup), sedangkan tujuan lain tetap disamarkan.",
    ],
  },
  {
    versi: "1.205.9",
    dirilis: "2026-10-19T05:00:00+08:00",
    judul: "Pertanyaan saksi lewat pop-up, hari libur tidak bisa dipilih, penetapan satu klik, antrean jam kerja, Status Perkara Seamless, prompt AI lengkap, dan audit SIPP",
    butir: [
      "Tombol kecil \"Pertanyaan saksi\" di Jadwal Sidang membuka panduan pertanyaan saksi sebagai jendela pop-up, dan hanya muncul bila perkara sedang atau sudah diperiksa (antrian disidang atau ditandai berjalan/diskors/selesai), supaya panduan tidak memenuhi layar saat perkara masih menunggu.",
      "Checklist tampilan Jadwal Sidang (74 baris) dan Jadwal Mediasi (9 baris) kini memuat semua tombol dan fitur baru, dan keterangan teknis di tunda, putusan, Court Calendar, Kasir, serta Penetapan kembali diganti kalimat biasa.",
      "Hari libur nasional, cuti bersama (SKB 3 Menteri 2026-2027), Sabtu, Minggu, dan libur tambahan di Pengaturan > Hari libur tidak dapat dipilih sebagai tanggal sidang, mediasi, putusan, Court Calendar, maupun PHS; usulan tanggal otomatis yang jatuh di hari libur digeser dengan pemberitahuan.",
      "Penetapan di panel SIPP cukup satu tombol \"Tetapkan semua\": PMH, PPP, PJS, dan PHS diperiksa lalu dituliskan berurutan dengan alur yang sama seperti sebelumnya, dan penetapan dapat dijalankan Ketua, Wakil, Super Admin, Admin, serta petugas bersub-peran Operator, Petugas Meja, dan PTSP, tetap tercatat atas akun pejabat pilihan.",
      "Tulisan otomatis ke SIPP di luar jam kerja (Senin-Kamis 07.30-16.00, Jumat sampai 16.30 WITA) dan di hari libur diantrekan lalu dikerjakan sendiri pada jam kerja berikutnya, dan tombol tulis manual di luar jam kerja memberi pilihan Antrekan atau Tulis sekarang, supaya jam input sama dengan kebiasaan petugas; tanggal peristiwa tidak berubah.",
      "Jam dan jeda penetapan, tunda/putus, e-Doc, dan Kasir disamakan dengan pola petugas menurut audit data SIPP Donggala, dan tenggat ikrar talak 6 bulan dihitung sejak penetapan hari sidang ikrar (Pasal 70 ayat (6) UU 7/1989), bukan sejak BHT.",
      "Penjagaan tanpa tanda ALETA diperluas ke unggahan salinan putusan ke e-Court, isian editor dan alamat/saksi di SIPP, header dan parameter permintaan, RTF yang dikirim ke ABT, serta Eviden SKP.",
      "Status Perkara tampil Seamless sebagai bawaan (toggle Kompleks tetap ada): linimasa perkara, kotak Perlu tindakan dengan titik per kelompok, lima kelompok yang bisa dilipat, dan pencarian di dalam perkara, tanpa fitur yang hilang.",
      "Prompt AI di Status Perkara lebih lengkap dengan 20 pilihan tujuan, centang \"Project ALETA AI PA CLAUDE ULTRA\" (tanpa role, mengikuti pola dan pemicu Project), nama asli untuk tujuan membuat putusan (NIK dan telepon tetap ditutup), saklar \"Ikuti format putusan tertentu\", dan saklar \"Sertakan putusan yang masih berbentuk blangko\" yang menandai bagian kosong di berkas .rtf hasil ABT.",
      "Panel PTSP di ABT hanya menampilkan \"Isi dari SIPP & input ke ABT\", dan Pengaturan memuat halaman Hak akses per peran.",
      "Ekstensi tidak lagi menumpuk kesalahan saat ABT tidak terjangkau, tombol \"Simpan nama\" tidak membeku, dan kalimat kesalahan tidak lagi berulang seperti \"X: X ...\".",
    ],
  },
  {
    versi: "1.205.8",
    dirilis: "2026-10-19T00:30:00+08:00",
    judul: "Jawab-menjawab e-Court tertulis di tanya-jawab ABT, bukti dari e-Court, panduan saksi di Jadwal Sidang, dan blangko hibah, wakaf, mafqud",
    butir: [
      "Jawaban, replik, dan duplik yang diunggah di e-Court langsung tertulis di tanya-jawab ABT bila berkasnya rapi dan baris sidangnya masih kosong; baris yang sudah ada tidak pernah ditimpa, berkas yang formatnya kacau tetap dapat disalin petugas, dan saklar \"Tanya-jawab jawab-menjawab otomatis\" di popup/Widget (bawaan menyala) dapat mematikannya.",
      "Daftar bukti surat P.1/T.1 dan bukti elektronik, tanggapan atas sita, rekonvensi harta bersama, dan nomor/tanggal surat keterangan KUA pada itsbat diusulkan dari berkas e-Court (posita, daftar bukti, atau pembacaan berkas bukti), supaya petugas tidak mengetik ulang; semuanya usulan yang dicentang sampai terukur atas berkas asli.",
      "Panduan pertanyaan saksi tersedia di rincian Jadwal Sidang dan di Status Perkara: pertanyaan menurut jenis dan keadaan perkara, pokok wajib ditandai, centang per saksi, mode layar sidang berhuruf besar, dan cetak A4 - tanpa contoh jawaban supaya tidak mengarahkan saksi.",
      "Blangko baru dikenali: penetapan ahli waris dengan cucu pengganti, kakek, nenek, saudara seibu, 'aul dan radd; dispensasi kawin ditolak; itsbat ditolak beserta cerai tidak dapat diterima; BAS verstek Izin Poligami yang lengkap; serta putusan, penetapan, dan BAS hibah, wakaf, dan mafqud beserta pertanyaan saksinya.",
      "Dasar hukum di pertanyaan saksi dicocokkan ulang dengan naskah HIR, RBg, KUHPerdata, dan Buku II, dan kini ditulis menurut RBg saja (tanpa HIR); rujukan yang belum pasti tidak dicetak.",
    ],
  },
  {
    versi: "1.205.7",
    dirilis: "2026-10-18T20:00:00+08:00",
    judul: "Isian disebut dengan nama, jawab-menjawab e-Court terbaca, keterangan anak/calon/orang tua dispensasi, dan saksi Tergugat",
    butir: [
      "Panel \"Isi dari SIPP & input ke ABT\", pita peringatan, dialog Cetak, urungkan/ulangi, dan kabar gagal simpan kini menyebut isian dengan namanya (mis. \"Sunting (Alasan Perceraian, Tanggal Pisah Rumah)\"), bukan kode angka; kodenya hanya tampil saat kursor diarahkan, supaya petugas tidak perlu menghafal nomor variabel.",
      "Jawab-menjawab yang diunggah di e-Court (jawaban, replik, duplik, kesimpulan) dibaca otomatis: \"lisan atau tertulis\" terisi \"tertulis\" bila berkasnya ada, sedangkan rekonvensi, kesimpulan, dan pokok jawaban/eksepsi diusulkan beserta kutipan asalnya; jawaban, replik, dan duplik dapat disalin ke BAS. Usulan tidak menimpa isian petugas dan akan dinaikkan menjadi otomatis sesudah diukur atas berkas e-Court di server.",
      "Pembacaan e-Court kini juga berjalan pada blangko \"Tolak - Tergugat Tidak Hadir Setelah Mediasi\" (cerai gugat dan cerai talak) dan \"Ekonomi Syariah Gugatan Sederhana - Sidang Kedua\".",
      "Susun saksi pada dispensasi kawin punya tab kedua \"Keterangan anak, calon, dan orang tua\" (PERMA 5/2019): 69 pertanyaan, ayah dan ibu diperiksa terpisah, wali memakai rumusan \"anak yang saya asuh\", dan butir kehamilan tercentang sendiri bila posita menyebutnya - tertulis \"(menurut posita)\" dan centang petugas selalu menang; hasilnya disalin ke BAS dengan satu tombol.",
      "Saksi yang diajukan Tergugat pada harta bersama dan kewarisan kini menerangkan versi Tergugat (harta sudah dibagi, dihibahkan, utang bersama, pisah harta, ahli waris lain, utang pewaris) lewat pilihan \"Diajukan oleh Penggugat/Tergugat\" per saksi.",
      "Kalimat saksi dispensasi kawin, itsbat, dan asal usul anak tidak lagi menulis \"tahun tahun\" sesudah umur.",
      "BAS cabut sesudah jawaban (Tergugat setuju/menolak) untuk Ekonomi Syariah acara biasa dipilih otomatis; isian bukti persetujuan istri pada BAS verstek Izin Poligami dan isian surat keterangan KUA pada itsbat mendapat nama yang jelas.",
      "Tutorial \"Susun saksi\" dan \"Tampilan panel menyesuaikan layar\" kini tampil, dan panduan per peran memuat susun saksi, tampilan panel, dan jawab-menjawab e-Court.",
    ],
  },
  {
    versi: "1.205.6",
    dirilis: "2026-10-18T16:00:00+08:00",
    judul: "Susun saksi menurut keadaan perkara untuk semua jenis perkara, dan panel ekstensi yang menyesuaikan layar laptop sampai TV",
    butir: [
      "Tombol \"Susun saksi menurut keadaan perkara\" di tanya jawab ABT kini tersedia untuk 22 kumpulan jenis perkara: cerai gugat dan cerai talak beserta kumulasinya (hak asuh, nafkah, harta bersama, itsbat), itsbat nikah, dispensasi kawin, penetapan ahli waris, perwalian, harta bersama, kewarisan, wali adhal, wasiat, izin poligami, pembatalan dan pencegahan perkawinan, asal usul anak, hak asuh, Penguasaan Anak, nafkah anak, ekonomi syariah, pengangkatan anak, dan permohonan umum, supaya pertanyaan dan keterangan saksi tidak lagi hanya untuk perkara cerai.",
      "Jenis perkara dikenali dari data perkara SIPP, bukan dari isian cerai di blangko, sehingga perkara bukan cerai tidak lagi mendapat pertanyaan cerai; jenis yang belum punya kumpulan pertanyaan tidak menampilkan tombol itu.",
      "Keadaan perkara (verstek atau dihadiri, kumulasi, kehadiran pihak) dan tujuh jenis keterangan dapat dipilih per saksi: melihat langsung, mendengar, de auditu, tahu sebagian, tidak tahu, ragu, dan berbeda; dua sampai lima saksi, dan dua saksi tidak pernah mendapat kalimat yang sama pada satu pertanyaan, supaya maksud keterangan sama tetapi kata-katanya berbeda.",
      "Keterangan ragu, sebagian, atau berbeda bertanda kuning dan tidak mengisi isian turunan di ABT; bila semua saksi ragu pada pokok yang wajib, muncul peringatan, supaya pembuktian tidak tampak lebih kuat dari keterangan sebenarnya.",
      "Isian yang tidak terbaca dari data perkara disebut dengan namanya dan dibiarkan titik-titik untuk dilengkapi petugas, tidak pernah ditebak; rujukan hukum yang belum dicocokkan ke naskah resmi tidak dicetak.",
      "Tombol cerai yang lama (Input ke ABT dan Susun keterangan saksi 1 & 2) tetap ada dan bekerja seperti sebelumnya.",
      "Panel ekstensi menyesuaikan layar: panel SIPP menempel di kanan mulai lebar 900 px (laptop 1366 dengan zoom 125% tidak lagi tertutup), lebar panel dan ukuran huruf ikut layar sampai TV dan 4K, panel ABT paling lebar 36% layar sehingga tombolnya tidak terpotong, serta widget, draf H-7, dan popup ikut menyesuaikan; tidak ada tombol atau fitur yang dihilangkan.",
      "Bilah tab panel SIPP digulir ke samping pada layar sempit, lampu SIPP/ALETA/e-Court turun ke baris kedua bila ruang kurang, dan judul panel di layar HP tidak lagi tertimpa tombol.",
    ],
  },
  {
    versi: "1.205.5",
    dirilis: "2026-10-18T14:30:00+08:00",
    judul: "Penetapan ikrar talak dan e-Doc, form ikrar terisi saat perkara dibuka, riwayat login WhatsApp, dan blangko baru dikenali",
    butir: [
      "Penetapan ikrar talak kini disusun dari blangko Derry lalu diunggah sebagai e-Doc di SIPP atas akun ketua majelis, supaya penetapan tersimpan di perkara seperti unggahan lewat SIPP dan panitera tidak menyusunnya ulang.",
      "Form Penetapan Ikrar Talak di SIPP terisi sendiri saat halaman perkara dibuka bila sidang ikrar sudah terlaksana dan form masih kosong, dan menyimpannya mengikuti saklar Penunjukan otomatis (bawaan mati), supaya tidak ada perkara ikrar yang terlewat tanpa form.",
      "Biaya ikrar di amar penetapan diambil dari biaya perkara yang tercatat pada data satker, bukan lagi dikosongkan, supaya angkanya sama dengan yang diketik petugas dan amar tidak tercetak tanpa nominal.",
      "Riwayat login e-Court lewat WhatsApp tampil di Sesi e-Court saya khusus bagi Super Admin dan Admin, supaya sesi yang tiba-tiba putus mudah ditelusuri tanpa membuka catatan server.",
      "ALETA mengenali blangko baru: eksepsi kewenangan, cabut ditolak, itsbat nikah ditolak (NO), PAW dinamis, itsbat pencairan dana, AUA, nafkah istri dan nafkah anak, Penguasaan Anak revisi, BAS verstek, tunda dan NO, serta cabut sesudah jawaban, supaya blangko yang disarankan dan isiannya tepat untuk jenis perkara itu.",
      "Saklar penyerahan anak pada Penguasaan Anak kini punya tiga pilihan: diminta dalam gugatan, tidak diminta, atau tidak diminta tetapi ditetapkan Hakim karena jabatannya (Buku II 2026); bawaannya tetap mengikuti petitum, supaya amar tidak melampaui tuntutan dan tetap dapat memuat penyerahan yang ditetapkan Hakim.",
    ],
  },
  {
    versi: "1.205.4",
    dirilis: "2026-10-18T10:00:00+08:00",
    judul: "Isi dari SIPP dan Input ke ABT lebih lengkap, tunda dan putus ikrar talak, dan kembaran hanya-baca",
    butir: [
      "Isi dari SIPP dan Input ke ABT diperluas: daftar cek kini memuat isian popup semua blangko Derry beserta sumbernya, dan isian baru (kesepakatan perdamaian, alasan cabut, batas ikrar, pengumuman itsbat, kuasa Tergugat, penyerahan anak) terisi otomatis dari SIPP dan gugatan, supaya petugas tidak mengetik ulang dan tidak ada isian yang tertinggal tanpa diketahui.",
      "Ikrar talak di Jadwal Sidang: ada dua tombol tunda (Pemohon hadir tetapi belum siap, atau tidak hadir) dengan tanggal berikutnya terisi sendiri dan peringatan bila melewati batas enam bulan, serta tombol untuk mencatat ikrar dilaksanakan yang sekaligus mengisi form Penetapan Ikrar Talak di SIPP, supaya panitera tidak membuka SIPP satu per satu.",
      "Berkas putusan, BAS, dan penetapan yang diunggah ke SIPP kini dibersihkan dari grup tersembunyi penanda asal isian sebelum terkirim, supaya tidak ada sisa penanda internal yang ikut tersimpan di SIPP.",
      "Isian e-Litigasi #7139# bernilai 1 hanya untuk perkara e-Court, supaya perkara yang tidak didaftarkan lewat e-Court tidak keliru ditandai e-Litigasi penuh.",
      "Blangko Saya pada tahap awal hanya untuk Super Admin, dan dapat dibuka untuk semua peran lewat saklar di Fitur Satker, supaya dicoba dulu sebelum dipakai seluruh pegawai.",
      "Mode kembaran: SIPP dan ABT di laptop hanya dapat dibaca selama kembaran menyala, supaya tidak ada tulisan yang masuk langsung ke salinan laptop tanpa lewat antrean dan tidak pernah sampai ke server.",
    ],
  },
  {
    versi: "1.205.3",
    dirilis: "2026-10-18T08:00:00+08:00",
    judul: "Draf putusan utuh, tutorial per fitur, Blangko Saya, Fitur Satker, tampilan semua layar, dan blangko baru",
    butir: [
      "Putusan Advance kini bisa menyusun draf putusan utuh sesudah pemeriksaan selesai, supaya hakim dan konseptor tidak mulai dari halaman kosong; bagian yang belum pasti ditandai merah dan draf hanya diunduh ke komputer sendiri, tidak dikirim ke ABT atau SIPP.",
      "Panduan menjadi tutorial per fitur dengan tombol tanda tanya di tiap halaman, dan setiap menu atau hak baru wajib punya tutorialnya, supaya petunjuk tidak tertinggal dari fitur yang berjalan.",
      "Blangko Saya: hakim, panitera, dan konseptor dapat menulis atau mengunggah blangko sendiri, memetakan isiannya, lalu memakainya untuk putusan mandiri atau mengajukannya ke Super Admin untuk ABT, sehingga tidak perlu menunggu blangko baru dibuatkan.",
      "Fitur Satker (khusus Super Admin): status stabil, uji coba, atau mati per fitur dan saluran pembaruan, sebagai persiapan dipakai banyak satker tanpa fitur Donggala yang sudah berjalan ikut berkurang.",
      "Mode kembaran di laptop saat server mati: SIPP, ABT, dan ALETA tetap dapat dipakai dari salinan di laptop, tulisan ke SIPP dan ABT ditahan di antrean, lalu dikirim sesudah server hidup lewat Admin > Sinkron kembaran dengan pemeriksaan bentrok dan persetujuan Super Admin, supaya pekerjaan tidak berhenti dan tidak ada tulisan yang menimpa data server tanpa diperiksa.",
      "Tampilan menyesuaikan layar dari HP, tablet, laptop, sampai TV, supaya petugas tidak perlu memperbesar atau menggulir ke samping.",
      "Blangko baru dikenali: relaas pencegahan perkawinan, Penguasaan Anak, 106 putusan baru, dan 38 BAS baru, dengan keadaan perkara yang lebih rinci agar blangko yang disarankan lebih tepat.",
    ],
  },
  {
    versi: "1.205.2",
    dirilis: "2026-10-18T02:00:00+08:00",
    judul: "Sesi e-Court pulih sendiri, captcha lewat WhatsApp, perintah e-Court dari chat, dan isian e-Litigasi #7139# otomatis",
    butir: [
      "Sesi e-Court pulih otomatis saat server menyala dan perkara yang tertinggal selama mati ditarik susulan, sehingga petugas tidak perlu masuk ulang dan tidak ada perkara yang terlewat.",
      "Bila e-Court meminta captcha, gambarnya dikirim ke WhatsApp admin dan dibalas dengan kode; captcha tetap dijawab manusia, dan sandi tidak pernah lewat WhatsApp.",
      "Perintah e-Court lewat chat ALETA bot (status, tarik, masuk, batal, ringkas) agar sesi dapat dikendalikan dari ponsel tanpa membuka portal.",
      "Isian e-Litigasi #7139# di Blangko Derry terisi otomatis dari data e-Court (1 = penuh bila Tergugat atau kuasanya ber-email, 2 = hybrid bila diunggah Panitera Sidang); isian yang sudah diubah manual tidak ditimpa.",
      "Pilihan popup e-Litigasi kini berbunyi jelas: penuh atau hybrid, supaya tidak keliru memilih.",
    ],
  },
  {
    versi: "1.205.1",
    dirilis: "2026-10-17T23:20:00+08:00",
    judul: "Audit menyeluruh, SKP semua jabatan, unduhan tanpa diblokir, deteksi sisa blangko, dan blangko-blangko baru",
    butir: [
      "Deteksi sisa blangko sebelum unggah/unduh putusan, BAS, dan relaas (kurung siku, variabel mentah, titik-titik, tulisan merah); tetap bisa dilanjutkan, dengan pilihan unduh daftar masalah. Titik-titik dalam kutipan ayat atau fiqh tidak dihitung.",
      "SKP untuk Ketua/Wakil (pilihan SKP Hakim atau SKP Pimpinan), Panitera, Panmud, Panitera Pengganti, Jurusita, Petugas Meja, Operator, dan Kasir, dihitung dari SIPP per bulan, triwulan, dan tahun.",
      "Unduhan dari SIPP, ABT (Blangko Derry), dan ALETA tidak lagi diblokir peramban; unggahan ke SIPP tidak pernah diulang otomatis.",
      "Nomor dan tanggal SK majelis menjadi isian di Integrasi e-Court; SK per majelis tetap bisa dipakai sebagai pengecualian.",
      "Blangko baru dikenali: HB rekonvensi dikabulkan, hak asuh ditolak, cerai ditolak kontradiktoir, PPP/PJS berkas tunggal, pilihan sita di PHS, pencegahan perkawinan, wasiat, dan ekonomi syariah acara biasa.",
      "Tulisan SALINAN di kiri atas halaman pertama putusan PDF; penetapan tanpa salinan.",
      "Tidak satu kata ALETA pun masuk ke SIPP; jadwal pesan WhatsApp mengikuti WITA; penyaring kueri dan unggah putusan di luar majelis diperketat; berkas e-Doc tidak lagi mengganggu unggahan SIPP.",
    ],
  },
  {
    versi: "1.205.0",
    dirilis: "2026-10-17T11:30:00+08:00",
    judul: "Tindak lanjut keputusan 17 Okt: identitas satker, checklist lengkap, varian draf ditolak, Putusan Advance semua jenis",
    butir: [
      "Pengaturan SIPP & ABT: tab Identitas satker (logo kop, telepon, alamat, laman, surel, kode surat, zona waktu) yang diterapkan ke blangko ABT dengan cadangan dan Kembalikan.",
      "Checklist konseptor menampilkan eksepsi, rekonvensi, dan putusan sela bila ada; Dikoreksi majelis hanya untuk majelis; tampil juga untuk konseptor yang tercatat di SIPP.",
      "Agen H-7 menyiapkan draf dikabulkan dan ditolak; widget kehadiran dan draf H-7 menyala terlipat di kiri bawah.",
      "Putusan Advance untuk hakim dan konseptor, memeriksa juga itsbat, dispensasi, ahli waris, perwalian, dan jenis lain; set pertanyaan saksi mengikuti keputusan hukum terbaru.",
      "Unggah massal: Ganti e-Doc BAS (berkas lama dipindah ke folder terhapus); skors hanya diusulkan ke BAS sebelum pengucapan putusan; panel massal ABT bergembok.",
      "Tidak ada lagi tanda ALETA yang masuk ke SIPP: alamat komputer petugas yang dicatat, dan properti berkas putusan/BAS dibersihkan.",
    ],
  },
  {
    versi: "1.204.1",
    dirilis: "2026-10-17T07:00:00+08:00",
    judul: "Agen draf putusan H-7, Putusan Advance, blangko jenis baru, dan perbaikan sinkron SIPP-ABT-ALETA",
    butir: [
      "Agen H-7 menyiapkan draf putusan tiap pagi untuk sidang 7 hari ke depan; kesiapannya tampil di Jadwal Sidang, checklist konseptor, ABT, dan widget.",
      "Putusan Advance memeriksa draf putusan di Blangko Derry: unsur alasan cerai, dasar hukum, kecocokan pertimbangan dan amar, serta contoh alinea dari putusan serupa.",
      "Blangko Hak Asuh Anak, Pembatalan Perkawinan, dan Ekonomi Syariah dikenali di Blangko Derry, saran blangko, dan BAS massal.",
      "Kotak penyatu SIPP: sidang pertama dari riwayat, selisih saksi ABT dengan daftar saksi SIPP, dan tugas pemberitahuan putusan verstek untuk juru sita.",
      "Folder PTSP mengikuti hak menu ABT; data putusan e-Court yang baru putus dibaca ulang lebih dulu; isian kosong tidak lagi tampil terisi.",
    ],
  },
  {
    versi: "1.204.0",
    dirilis: "2026-10-17T05:00:00+08:00",
    judul: "Anonim ALETA, unggah massal, checklist konseptor, kehadiran rinci, skors, Gembok dan Cetak di ABT",
    butir: [
      "Putusan anonim dibuat ALETA sendiri sesuai pedoman pengaburan (nama pihak, saksi, anak, NIK, alamat), dengan pratinjau sebelum unggah; anonimisasi ABT menjadi cadangan.",
      "Unggah massal ke e-Doc SIPP: hakim untuk putusan dan anonim, PP/panitera untuk BAS, dengan pemeriksaan dobel dan riwayat.",
      "Checklist konseptor 8 langkah tersambung dengan isian Blangko Derry dan Jadwal Sidang (Draf siap dibacakan).",
      "Kehadiran rinci per orang (pihak, kuasa, saksi) di Jadwal Sidang, antrian, usulan Dihadiri oleh dan BAS, serta di widget ALETA.",
      "Skors sidang dengan alasan, perkiraan jam lanjut, hitung mundur, layar antrian, dan usulan kalimat BAS.",
      "Panel ABT biasa: gembok ringkas otomatis dan tombol Cetak di samping Input semua yang pasti; isian tidak wajib yang kosong tidak menahan cetak.",
    ],
  },
  {
    versi: "1.203.0",
    dirilis: "2026-10-17T02:30:00+08:00",
    judul: "SIPP dengan Ide ALETA, tampilan Blangko Derry sesuai rancangan, hak akses per peran",
    butir: [
      "SIPP: tombol Buka di ABT dan Buka di ALETA di tiap perkara, Isi dengan ALETA beserta penghitung kolom kosong, dan Putusan Akhir dari berkas putusan (isi semua kolom, simpan, unggah e-Doc).",
      "SIPP: 11 penanda perkara (sita, izin cerai, penetapan awal, belum ditunda, potensi verstek, umur perkara, tanpa sidang berikutnya, sisa waktu ikrar, akta cerai dan BHT verstek, lewat 5 bulan, dokumen e-Court belum diverifikasi).",
      "SIPP: usulan isian di jendela Tunda/Edit Jadwal, Relaas, Putusan Sela, Rekonvensi, Saksi, Tambah Biaya, dan Arsip; kotak penyatu SIPP-ABT-ALETA di halaman perkara; lencana ALETA seragam dan tetap berwarna di tema gelap.",
      "Blangko ABT by Derry Briantono: tampilan mengikuti rancangan, isian hanya muncul bila berlaku (kuasa, ghaib, prodeo, e-Court), alat bukti fleksibel dengan Tulis manual, dan peringatan isian kosong saat Cetak.",
      "Hak akses: Lihat sebagai akun meniru peran akun itu; putusan untuk hakim, BAS untuk panitera/PP, relaas khusus jurusita.",
      "Set pertanyaan saksi per jenis perkara dan huruf alasan; deteksi isian untuk itsbat, dispensasi, ahli waris, perwalian, wali adhal, harta bersama, dan kewarisan.",
    ],
  },
  {
    versi: "1.202.0",
    dirilis: "2026-10-16T22:30:00+08:00",
    judul: "Blangko ABT by Derry Briantono lengkap: isian, bukti, tanya jawab, pratinjau dan cetak",
    butir: [
      "Jendela pilih blangko dua kolom: saran dari keterangan dan agenda sidang serta keadaan perkara, lalu kelompok blangko urut yang paling sering dipakai.",
      "Perlu diisi: isian yang bergantung pada kuasa, prodeo, dan alasan C/H muncul otomatis; saran samar bisa dipakai dengan Tab; ikon i menunjukkan sumber datanya; tiap isian tersimpan langsung ke ABT.",
      "Alat bukti surat dengan kode P otomatis, pilihan meterai dan pencocokan; tanya jawab saksi tunggal atau berdampingan dengan Susun Keterangan Saksi.",
      "Pratinjau bisa dilipat dan disunting; cetak RTF, PDF, PDF SALINAN, PDF anonim (putusan), unggah e-Doc putusan, tambah tanda tangan per akun, dan pengingat isian kosong sebelum cetak.",
      "BAS massal dan putusan memilih blangko menurut keadaan perkara (verstek, mediasi, cabut, NO, gugur); relaas e-Court terpetakan; blangko baru Wali Adhal, ikrar talak, dan mediasi dikenali.",
      "Super Admin: alat rekam susunan halaman SIPP (tanpa data pribadi) dan tautan Edit variabel ini ke menu portal Pengaturan SIPP & ABT.",
    ],
  },
  {
    versi: "1.201.0",
    dirilis: "2026-10-16T19:30:00+08:00",
    judul: "Blangko ABT by Derry Briantono (kerangka) dan perbaikan saksi, e-Doc anonim, petitum",
    butir: [
      "Blangko ABT by Derry Briantono: tampilan baru di ABT dengan daftar perkara milik akun (per peran, prioritas, empat cara tampil); bisa dijadikan tampilan bawaan atau ditawarkan lewat kartu kecil.",
      "Unggah e-Doc putusan: salinan anonimisasi yang tersamar sebagian kini ikut terunggah; sisa nama pihak dan NIK disamarkan otomatis. Putusan asli tidak diubah.",
      "Susun Keterangan Saksi dan Isi dari SIPP tidak lagi saling menimpa, sehingga tab Isi dari SIPP tidak macet.",
      "Kalimat penutup keterangan saksi (\"sudah cukup\", \"tidak ada lagi\", dan bentuk lainnya) dikenali dalam bentuk apa pun.",
      "Petitum cerai: tuntutan nafkah anak \"biaya kebutuhan, perkembangan dan pendidikan\" ikut terbaca.",
    ],
  },
  {
    versi: "1.200.2",
    dirilis: "2026-10-15T20:30:00+08:00",
    judul: "Blangko Derry berpasangan: menu Putusan dan BAS per jenis perkara",
    butir: [
      "BAS massal dan tombol Buka di ABT mengikuti menu baru \"<Jenis> - BAS\" (CG/CT tidak tertukar); panel alat menemukan blangko putusan dengan nama menu lama maupun baru.",
      "Peta tugas: folder \"- BAS\" milik panitera, folder putusan milik hakim.",
    ],
  },
  {
    versi: "1.200.1",
    dirilis: "2026-10-15T16:30:00+08:00",
    judul: "Putusan dan BAS satu folder per jenis perkara, BAS massal mengenali BAS baru (PAW, permohonan, HB, kewarisan, poligami, kumulasi)",
    butir: [
      "Blangko Derry: BAS kini juga ada di folder jenis perkaranya bersama putusan; tombol Buka di ABT pada BAS massal memilih salinan yang sesuai jenis perkara (CG/CT tidak tertukar).",
      "BAS massal mengusulkan BAS baru: Penetapan Ahli Waris, perwalian, wali adhal, pengangkatan anak, itsbat 2 sidang atau lebih, permohonan tidak hadir/gugur/NO/cabut, HB & kewarisan (sita, putusan sela, pemeriksaan setempat, damai), poligami, itsbat kontensius, cerai kumulasi itsbat dan kumulasi hak asuh kontradiktoir.",
      "Panel alat: putusan Gugur 3b kuasa insidentil tidak sah ditambahkan; nama blangko NO 4b disesuaikan.",
      "Peta tugas: BAS di folder jenis tercatat sebagai blangko panitera, tidak tampil di pohon putusan hakim.",
    ],
  },
  {
    versi: "1.200.0",
    dirilis: "2026-10-14T13:30:00+08:00",
    judul: "Unduhan tidak diblokir & bernama baku, Salinan putusan ber-TTD Panitera, Set pertanyaan sekali klik, panel ringkas mulus, juru sita mencentang yang tidak hadir, pengumuman itsbat",
    butir: [
      "Semua unduhan dari panel diterbitkan ekstensi sendiri - tidak lagi diblokir Chrome di SIPP/ABT http - dan selalu bernama \"nomor perkara - nama blangko\" (cetak tiga berkas tetap).",
      "Putusan otomatis: edoc putusan tetap diunggah ke SIPP walau anonimisasi gagal/dibatalkan; anonim menyusul.",
      "PDF SALINAN langsung terbuka: tulisan SALINAN di kanan atas, ttd di tiap pejabat, tanda tangan Panitera di blok Untuk Salinan.",
      "Set pertanyaan ALETA terbuka dengan satu klik dan berukuran satu baris; panel yang meringkas sendiri kini menunggu sejenak dan bertoleransi bila kursor sedikit di luar panel.",
      "Juru sita: pihak yang tidak hadir tercentang bawaan (panggilan & PBT); sidang pertama itsbat voluntair menambah Pengumuman Permohonan Itsbat Nikah.",
      "Panel ALETA di portal tertutup bawaan untuk semua profil.",
      "Naskah ALETA (BAS massal, putusan, relaas, penetapan) mengisi SEMUA variabel blangko Derry seperti ABT; tanya-jawab saksi berbentuk tabel ABT; tombol Isi dari posita juga untuk harta bersama 5032.",
    ],
  },
  {
    versi: "1.199.0",
    dirilis: "2026-10-13T14:00:00+08:00",
    judul: "Gembok kepala panel, ABT bisa digulir, Kasir otomatis bersaklar, deteksi posita semua jenis perkara, penetapan atas akun pejabat",
    butir: [
      "Panel SIPP meringkas ke kepalanya saat menutupi tabel (seperti panel ALETA); tombol gembok di bawah kepala mengunci panel agar selalu penuh, diingat per situs. Hanya di tampilan Baru & UI Baru.",
      "Halaman ABT kembali bisa digulir dengan roda tetikus di atas panel yang isinya pendek.",
      "Kasir: saklar Kasir otomatis (bawaan mati) mengisi Redaksi, Meterai, PNBP cabut, PNBP & biaya pemberitahuan putusan (verstek & cerai talak) dan sisa panjar untuk perkara putus hari itu, dengan daftar keadaan tiap butir; tampilan Kasir berkartu bulat.",
      "Tombol \"belum upload\" kini benar-benar membuka perkaranya di e-Court; dokumen jawab-menjawab dicocokkan menurut jenisnya dengan agenda sidang.",
      "Penetapan PMH/PPP/PJS/PHS dan pembatalannya tercatat di SIPP atas akun pejabat yang dipilih (bukan akun yang masuk), dengan jam seperti petugas bekerja.",
      "Isi dari SIPP & input ke ABT membaca posita lebih lengkap: itsbat (status, wali, tempat menikah, KUA), dispensasi kawin, cerai, izin poligami, kewarisan & penetapan ahli waris, harta bersama, perwalian, asal usul, wali adhol, pengangkatan anak, hadhanah; tanggal KTP juga dibaca dari Dokumen Bukti e-Court.",
      "Pemilihan blangko putusan, BAS massal, dan set pertanyaan saksi ikut membaca kumulasi; 10 varian kalimat jawaban saksi tambahan per keadaan pengetahuan saksi.",
    ],
  },
  {
    versi: "1.198.0",
    dirilis: "2026-10-12T14:50:00+08:00",
    judul: "Tanggal KTP pasti menimpa, KTP Elektronik dari Berlaku Hingga, saklar Sita & Eksekusi terpisah, CPU di widget",
    butir: [
      "Tanggal KTP e-Court berkeyakinan pasti yang berbeda dari isian petugas kini langsung menimpa isian ABT (kartu menyebut isian lama yang ditimpa); cukup tetap hanya mengisi yang kosong.",
      "Variabel ABT 11114 (KTP Elektronik) dibaca dari baris Berlaku Hingga berkas KTP e-Court: seumur hidup = KTP-el (butuh paket ABT abt-tanggal-ktp-2).",
      "Saklar Sita dan Eksekusi di panel Tampilan Jadwal Sidang dipisah.",
      "Strip sumber daya widget (Super Admin) menampilkan CPU: RAM, CPU, Disk, GPU.",
      "Saklar fitur ide yang fiturnya belum dibangun diberi keterangan \"belum ada\".",
    ],
  },
  {
    versi: "1.197.0",
    dirilis: "2026-10-12T13:30:00+08:00",
    judul: "Jadwal Sidang: kumulasi, penanda pihak & perkara, panggil saksi, ruang, Sita; tanggal KTP otomatis; anonimisasi beralias",
    butir: [
      "ALETA e-Court langsung membuka Jadwal Sidang.",
      "Jadwal Sidang, Jadwal Mediasi, dan Status Perkara menulis jenis perkara beserta kumulasinya (mis. Cerai Gugat Kumulasi Hak Asuh Anak); bila tidak diisi di SIPP, dibaca dari petitum dan ditandai \"dari petitum\".",
      "Penanda Ghaib, Prodeo, dan Non e-Court di samping nomor perkara; lencana PNS, PPPK, TNI, POLRI, BUMN, BUMD di samping nama pihak; nama pihak yang sudah hadir hari ini hijau dengan tanda (hadir).",
      "Klik nama saksi untuk memanggil saksi ke ruang sidang (pilih satu, beberapa, atau semua saksi satu pihak).",
      "Kartu ruang sidang berwarna di bawah Hitung skor (bawaan diciutkan), nama mediator di bawah juru sita, penanda pernah diskors (ikon berputar di bawah tombol Selesai), dan tujuh saklar baru di panel Tampilan.",
      "Lencana Eksepsi dan Rekonvensi berhuruf awal kapital; lencana Sita (Jaminan, Revindikasi, Marital, Eksekusi) dari petitum di kolom Agenda; bagian Eksepsi, Rekonvensi, Sita, dan Eksekusi di rincian dan Status Perkara.",
      "Tanggal KTP pihak di Status Perkara, pengaturan & histori penarikan tanggal KTP di Integrasi e-Court; tanggal KTP terisi otomatis di variabel tanggal dan kalimat alat bukti ABT (1214, 9958, dll.) saat Isi dari SIPP & input ke ABT (paket ABT abt-tanggal-ktp-2 menambah #2223#).",
      "Panel ABT: kartu huruf alasan 8503 diciutkan dengan penanda kuning; saklar Sunting langsung yang mati kini benar-benar mematikan sunting, dan bila menyala sunting dibuka dengan klik dua kali (klik di luar = batal).",
      "Widget: saklar Tarik data e-Court berwarna (Super Admin & Admin), blok tampilan uji diciutkan, saklar Tandai halaman SIPP diperbaiki.",
      "Anonimisasi putusan menyamarkan nama pihak beralias dan NIK; bila masih tersisa sebagian, tersedia tombol Tetap unggah (tetap ditolak bila tidak ada yang tersamar).",
      "Sumber daya server: CPU per server, ALETA, dan aplikasi; menu Sumber Daya Server di kelompok Sistem.",
    ],
  },
  {
    versi: "1.196.0",
    dirilis: "2026-10-12T09:33:00+08:00",
    judul: "Blangko putusan cerai per status, set pertanyaan & saksi lebih dari dua, alur sidang di BAS massal",
    butir: [
      "Putusan cerai: blangko yang ditawarkan kini mengikuti status putusan SIPP (kabul verstek/kontradiktoir, tolak, NO, gugur, cabut, coret), tidak lagi selalu kabul verstek; butuh paket ABT abt-cerai-lengkap yang juga membetulkan beberapa kesalahan blangko.",
      "Susun keterangan saksi: pilih set pertanyaan saksi baku (dari praktik BAS satker, per jenis perkara & huruf alasan) dan dukungan saksi ke-3 sampai ke-5 Penggugat serta ke-4 Tergugat (butuh paket ABT abt-saksi-pertanyaan).",
      "BAS massal menampilkan alur sidang perkara (mis. verstek 2 sidang, kontradiktoir) sebagai petunjuk; folder BAS per alur tersedia di blangko Derry (butuh paket ABT abt-bas-alur-sidang).",
    ],
  },
  {
    versi: "1.195.0",
    dirilis: "2026-10-12T01:12:00+08:00",
    judul: "Tampilan & hak per peran, widget per akun, checklist & panel, ZIP Status Perkara lengkap, tanggal KTP dari e-Court",
    butir: [
      "Tampilan & hak per peran: tiap peran hanya melihat menu, tab, dan tombol yang menjadi tugasnya (portal, e-Court, ekstensi); aplikasi yang belum siap hanya untuk Super Admin.",
      "Widget ekstensi: setelan tersimpan per akun & peran, profil saklar per peran, status sambungan ringkas, keterangan teknis hanya Super Admin, pemberitahuan versi baru dengan tautan Perbaharui; selain Super Admin selalu UI Baru.",
      "Checklist milestone tertutup secara bawaan dan tombol kepalanya tidak lagi hilang klik; panel ALETA muncul di kanan atas dengan ukuran lebih besar; pengingat kasir untuk panitera hanya dibaca.",
      "Status Perkara: unduh seluruh berkas dalam satu ZIP kini lengkap (dengan daftar isi & sebab bila ada yang gagal) dan bisa dipilih per kategori; email, WhatsApp, dan kesediaan e-Litigasi para pihak.",
      "Tanggal KTP pihak dibaca dari berkas KTP e-Court di latar dan diusulkan di panel ABT (butuh paket ABT abt-tanggal-ktp).",
    ],
  },
  {
    versi: "1.194.0",
    dirilis: "2026-10-11T22:00:00+08:00",
    judul: "Pekerjaan pihak terbaca dinamis: PNS, PPPK, TNI, POLRI, BUMN/BUMD dari isian Lain-Lain",
    butir: [
      "Panel ABT menampilkan kartu \"Pekerjaan terbaca\" tiap pihak: kategori dibaca dari pilihan SIPP atau, bila Lain-Lain, dari uraian pekerjaannya (PPPK dihitung terpisah dari PNS; honorer, CPNS, PPPK paruh waktu, dan pensiunan tidak dihitung pegawai).",
      "Blangko pihak SIPP mengusulkan pilihan pekerjaan yang sesuai bila petugas mengisi Lain-Lain padahal uraiannya PNS/TNI/POLRI/BUMN/BUMD - dicentang dulu, petugas yang menyimpan.",
      "Butuh paket ABT abt-pekerjaan-dinamis: kalimat izin atasan (PNS / Aparatur Sipil Negara (PPPK) / TNI / POLRI / BUMN / BUMD / aparat desa) ikut terbaca dari uraian Lain-Lain, dan pertimbangan kewajiban pemberitahuan bagi Tergugat/Termohon PNS, PPPK, TNI, POLRI.",
    ],
  },
  {
    versi: "1.193.0",
    dirilis: "2026-10-11T21:00:00+08:00",
    judul: "Kasir per kejadian & tampilan per peran, masuk otomatis dari SIPP, deteksi semua jenis perkara, kontak e-Court",
    butir: [
      "Kasir: usulan jurnal per kejadian (panggilan pertama, sidang ditunda, putusan, ikrar talak, tambahan panjar) dengan tanda sudah/belum; tambahan panjar ditawarkan tanpa centang; ikrar talak satu panggilan untuk sidang ikrar yang ditunda.",
      "Halaman jurnal per perkara hanya menampilkan Kasir, tab Kasir berlencana (usulan/lengkap); Kasir massal, pengingat & rekap pindah ke halaman daftar Jurnal Keuangan Perkara; menu Kasir dan PTSP sesuai perannya.",
      "Masuk otomatis dari SIPP ke ALETA: akun dikenali dari sesi SIPP yang terbukti, dicocokkan lewat tautan, NIP, atau nama (tanpa gelar); tautan buatan ALETA ditinjau Admin di Manajemen Akun.",
      "Deteksi panel ABT & susun keterangan saksi untuk semua jenis perkara (itsbat, dispensasi kawin, waris, perwalian, asal usul anak, wali adhol, harta bersama, poligami, dll.); pola alasan, waktu, hubungan saksi, dan tempat tinggal bersama diperluas.",
      "Kontak dari e-Court: email & nomor HP pihak/kuasa diusulkan pada blangko pihak SIPP (petugas yang menyimpan); data e-Court tersedia bagi blangko ABT; blangko bawaan untuk Harta Bersama, Kewarisan, dan Izin Poligami.",
    ],
  },
  {
    versi: "1.192.0",
    dirilis: "2026-10-10T21:00:00+08:00",
    judul: "Deteksi lengkap: saksi, huruf alasan, tuntutan & nominal dari gugatan e-Court, kamus deteksi yang bisa ditambah Admin",
    butir: [
      "Susun keterangan saksi: identitas saksi terbaca otomatis, paragraf keterangan gaya Ringkas atau Lengkap (mengikuti blangko putusan) dengan tombol Salin, dan peringatan ringan (mis. saksi bukan keluarga pada perkara syiqaq) yang tidak menahan simpan.",
      "Kartu huruf alasan: tanda kesesuaian saksi - kedua saksi sama, hanya satu saksi, atau pelaku/sebab berbeda antar saksi; deteksi sebab bertambah (murtad, dipenjara, meninggalkan, dll.). Huruf alasan tetap usulan yang dicentang hakim.",
      "Dari berkas e-Court: tuntutan tambahan (mut'ah, iddah, madliyah, nafkah anak, hadhanah, harta bersama, mahar) beserta nominalnya, data anak, dan jawab-menjawab tampil sebagai usulan berkutipan halaman; pilihan bunyi kalimat 5227 dan kalimat pertimbangan hakim siap disalin.",
      "Admin > Integrasi e-Court > Kamus deteksi & kalimat: lihat, tambah, uji, dan nonaktifkan pola deteksi serta templat kalimat tanpa menunggu rilis; koreksi petugas atas usulan tercatat dan menjadi calon pola baru untuk ditinjau.",
    ],
  },
  {
    versi: "1.191.0",
    dirilis: "2026-10-10T20:00:00+08:00",
    judul: "Sinkron SIPP-ABT: fakta saksi ke kartu hakim, Input semua yang pasti, pengingat beda SIPP sebelum CETAK, kamus variabel ABT",
    butir: [
      "Panel ABT hakim: kartu awal konflik, pisah rumah, lama pisah, dan alasan kini terisi dari keterangan saksi + posita gugatan, lengkap dengan kutipan sumbernya; yang tidak cukup yakin tetap ditandai ragu.",
      "Tombol Input semua yang pasti: pratinjau isi lama -> baru sebelum menulis ke ABT, lalu dibaca ulang; kartu ragu tetap dicentang manual.",
      "Sebelum CETAK: pengingat bila nama, tanggal, majelis, atau kuasa di ABT berbeda dengan SIPP - CETAK tetap bisa diklik.",
      "Kamus variabel ABT di portal (Admin): arti, sumber, dan keadaan tiap variabel, termasuk yang masih diisi manual dan yang rawan tanda petik.",
      "Butuh paket ABT terpisah (dipasang di server ABT): kebal tanda petik, majelis pemeriksa dari SIPP, kuasa seragam di semua blangko, riwayat sidang & kehadiran di BAS lanjutan.",
    ],
  },
  {
    versi: "1.190.0",
    dirilis: "2026-10-10T18:00:00+08:00",
    judul: "Kasir otomatis & rekap, saksi lebih cepat diisi, putusan & e-Doc tidak tertimpa diam-diam, persen tarik e-Court, alamat putusan + Domisili Elektronik",
    butir: [
      "Kasir: usulan jurnal otomatis menurut keadaan perkara (verstek, baru daftar, cabut, gugur, ikrar, dll.), Kasir massal satu hari, tab Kasir di panel SIPP, rekap harian sampai tahunan + PDF, dan pengingat tugas kasir.",
      "Saksi: pilihan hubungan dengan pihak yang lengkap (mis. Ibu Kandung Pemohon), isian yang bisa ditebak terisi otomatis, dan peringatan bila data saksi sudah ada.",
      "Putusan otomatis disembunyikan bila putusan sudah terisi di SIPP (muncul lagi dengan peringatan saat blangko dibuka ulang); e-Doc penetapan yang sudah terunggah meminta konfirmasi sebelum ditimpa.",
      "Tarik dari e-Court menampilkan persen dan garis proses menurut tahap nyata.",
      "Alamat para pihak di putusan dirapikan + Domisili Elektronik (alamat SIPP tidak diubah; perlu paket ABT alamat putusan).",
    ],
  },
  {
    versi: "1.189.0",
    dirilis: "2026-10-09T20:00:00+08:00",
    judul: "Uji rilis 9 Okt: kuasa hukum lengkap di ABT + puluhan perbaikan dari uji nyata seluruh fitur",
    butir: [
      "ABT: kantor kuasa (0156) dan tanggal surat kuasa dibaca dari gugatan e-Court, tanggal & nomor register kuasa khusus dari SIPP; kalimat kuasa lengkap di identitas pihak (7047/7048) dan blangko [01] Kabul Verstek Cerai.",
      "Panel ABT: isian berpetik tidak lagi mematikan blangko dan CETAK; CETAK menolak halaman yang bukan RTF; sesi ABT habis disebut jelas.",
      "Penetapan PMH-PPP-PJS-PHS, Penetapan kembali, Kasir, dan tombol mediator ditulis dalam satu transaksi - tidak pernah tertinggal setengah jadi.",
      "Masuk akun SIPP: isi otomatis halaman masuk SIPP kini bekerja; titipan sandi petugas sebelumnya dihapus.",
      "Hasil mediasi .rtf: kuasa, urutan pihak, turut tergugat, dan penomoran pihak diperbaiki; rute admin Integrasi e-Court hanya untuk Admin.",
      "Penetapan & putusan massal, BAS & relaas massal, popup, checklist, Status Perkara, Kendali Berkas, TTD: sebab kegagalan terbaca dan tidak membeku.",
      "Unggah putusan ke SIPP dan e-Court hanya untuk Hakim, Admin, dan Super Admin; tombol Perbarui ekstensi ditahan selama antrean massal berjalan.",
      "BAS massal: usulan blangko walau kehadiran belum tercatat (bertanda); lewat pukul 14.00 tanpa kehadiran diusulkan putus gugur atau ditunda panggil para pihak.",
    ],
  },
  {
    versi: "1.188.0",
    dirilis: "2026-10-07T18:00:00+08:00",
    judul: "7 Okt sore: tunda/putusan utuh atas nama PP, tarik e-Court dari \"belum upload\", hasil mediasi .rtf, penetapan tahap sisa, cetak relaas 2x lebih cepat",
    butir: [
      "Jadwal Sidang: tunda dan putusan ditulis utuh dalam satu transaksi (tidak lagi tertinggal setengah jadi), memakai jam masuk ruang dan kehadiran dari antrian sidang, dan tercatat di SIPP atas nama panitera sidang perkara itu.",
      "Jadwal Sidang: penanda \"belum upload\" dapat ditekan untuk menarik ulang e-Court khusus perkara itu dan memperbarui penandanya.",
      "Jadwal Mediasi: tombol \"Buat hasil mediasi (.rtf)\" khusus mediator - pilih hasil dan butir kesepakatan (mut'ah, nafkah iddah, nafkah anak, hak asuh, harta bersama, dll.), unduh laporan + kesepakatan perdamaian dalam Word.",
      "Penetapan per perkara dan massal: tahap yang sudah dikerjakan manual dilewati, ALETA mengerjakan sisanya berurutan PMH-PPP-PJS-PHS; satu perkara gagal tidak menghentikan yang lain.",
      "Cetak relaas & PBT kira-kira dua kali lebih cepat (Jadwal Sidang, panel SIPP, panel ABT) dengan hasil yang sama.",
    ],
  },
  {
    versi: "1.187.1",
    dirilis: "2026-10-07T14:00:00+08:00",
    judul: "7 Okt siang: 8503 satu kesatuan di ABT, milestone ke halaman SIPP yang tepat, putusan otomatis tidak macet, anonimisasi menyamarkan nama",
    butir: [
      "Panel ABT (UI Baru): 8503 dan turunannya (4020, 8524, 8531, 8532, 8529, 8528, 8521, 8522, 8530) satu kesatuan - selama 8503 kosong cukup satu butir \"Isi huruf alasan perceraian (8503)\"; begitu disimpan, seluruh turunan terisi tanpa memuat ulang halaman.",
      "Checklist milestone: tombol \"Kerjakan di SIPP\" membuka halaman perkara di SIPP pada tab pekerjaannya (mis. Jadwal Sidang), walau perkara belum pernah dibuka di peramban ini.",
      "Putusan otomatis: pemeriksaan anonimisasi tampil tepat di bawah Isikan dan tidak lagi ditunggu tanpa batas - ada batas waktu dengan pilihan tunggu, ulangi, atau unggah e-Doc putusan saja.",
      "Anonimisasi otomatis menyamarkan nama pihak (semua bentuk), nama saksi, dan alamat yang ditinggalkan ABT pada salinan anonimisasi; nama majelis dan panitera tetap utuh. Bila sudah bersih, kedua e-Doc langsung diunggah.",
    ],
  },
  {
    versi: "1.187.0",
    dirilis: "2026-10-07T10:00:00+08:00",
    judul: "Masuk ALETA dengan akun SIPP, SIPP & ABT terbuka otomatis",
    butir: [
      "Masuk ALETA cukup dengan nama pengguna dan sandi SIPP (akun yang tertaut di Manajemen Akun). Sandi dicocokkan langsung ke SIPP dan TIDAK disimpan di ALETA; akun SIPP yang diblokir atau kedaluwarsa ditolak. Akun tanpa SIPP tetap masuk seperti biasa.",
      "Pilihan \"Buka SIPP & ABT otomatis\" di layar masuk: bila sesi SIPP atau ABT habis, ekstensi mengisi halaman masuknya sendiri. Sandi hanya disimpan sementara di ekstensi dan hilang saat Chrome ditutup atau keluar dari ALETA.",
    ],
  },
  {
    versi: "1.186.1",
    dirilis: "2026-10-06T22:00:00+08:00",
    judul: "Relaas ikrar talak memakai blangko derry dari menu Relaas Ikrar Talak",
    butir: [
      "Relaas & PBT massal: blangko \"[JS] 4. Relaas Panggilan Ikrar Talak P dan T\" diambil dari kelompok ABT \"Relaas Ikrar Talak\" (menu yang menerima perkara tahap ikrar), bukan dari folder Blangko Derry yang ditolak ABT untuk perkara ikrar. Token lama yang tersimpan dari folder derry dipanen ulang sekali.",
    ],
  },
  {
    versi: "1.186.0",
    dirilis: "2026-10-06T21:00:00+08:00",
    judul: "6 Okt sore: Penetapan kembali, Kasir jurnal, pemantau RAM/disk/GPU, rekonvensi/eksepsi, Court Calendar & sedang berjalan, menu per perkara + e-Doc putusan massal",
    butir: [
      "Jadwal Sidang: penanda Court Calendar tidak sinkron hanya untuk perkara yang kedua pihaknya pernah hadir dan sesudah laporan hasil mediasi; \"sedang berjalan\" terdeteksi dalam beberapa detik dari antrian; deretan tombol tindakan bawaannya terciut; penanda \"eksepsi\"/\"rekonvensi\" dari jawaban & duplik Tergugat di e-Court.",
      "Jadwal Sidang: tombol \"Penetapan kembali\" (PMH/PPP/PJS/PHS, satu atau massal, alasan sama/per perkara, penetap per jenis; bentuk persis blangko penetapan kembali SIPP) dan tombol \"Kasir\" (usulan jurnal keuangan perkara dari keadaan perkara, sunting, simpan ke SIPP).",
      "Widget: titik RAM/Disk/GPU berwarna (ALETA <-> seluruh server); rincian per aplikasi di Admin -> Sumber daya server.",
      "Panel SIPP: halaman satu perkara tidak lagi dikira daftar perkara (menu per perkara lengkap, menu massal hanya di daftar/dashboard); putusan massal ikut mengunggah e-Doc putusan dan e-Doc anonimisasi.",
    ],
  },
  {
    versi: "1.185.0",
    dirilis: "2026-10-06T20:00:00+08:00",
    judul: "Perbaikan 6 Okt (butir 1-26): Jadwal Sidang (verifikasi, Court Calendar, mediasi, pembebanan, Turut T/Int, suara pihak), ABT (saksi, alasan C/D/E/H), penetapan ber-ttd+cap, unduh seluruh berkas",
    butir: [
      "Jadwal Sidang: penanda verifikasi majelis hanya pada sidang e-Litigasi, dengan keadaan keempat \"belum upload\" (pihak belum mengunggah dokumennya sehingga belum dapat diverifikasi hakim); penanda merah \"court calendar tidak sinkron\" (hanya bila tidak sinkron); kolom Majelis & Petugas tidak lagi melebar; kode majelis tidak diulang di kolom Antrian / Jam; tombol ruang sidang di ujung kanan deretan alat.",
      "Jadwal Sidang: Court Calendar per perkara di dasar kolom Agenda (rekomendasi ALETA / manual / sunting baris lama, simpan ke SIPP); pembebanan saat ikrar talak di kolom Putusan + Rincian; tombol Mediator hanya saat kedua pihak hadir pertama kali; penanda \"Mediasi\" dan hasil mediasi pada agenda laporan mediasi; Turut T dan Int di bawah P/T (juga Jadwal Mediasi dan Status Perkara); para pihak dapat dipanggil WhatsApp dan pengeras suara (saklar \"Panggil pihak (audio speaker)\").",
      "Panel Tampilan: saklar untuk semua penanda baru, ikon \"i\" berisi contoh tampil/disembunyikan, saklar \"Tampilkan contoh semua fitur\"; Super Admin dapat mengatur bawaan Tampilan untuk semua/per pengguna di Integrasi e-Court.",
      "ABT: susun keterangan saksi - pada \"Hanya sebagian alasan\" centang yang sesuai posita tampil lebih dulu dan lainnya di bawah; urutan modus dirapikan; isian tidak lagi kosong (lama pisah dihitung dari \"sejak ...\", anak, kediaman, siapa yang pergi dari posita). Huruf alasan C/D/E/H (dan gabungannya) diusulkan untuk blangko [01] sesudah paket ABT satker terpasang.",
      "SIPP: dokumen penetapan PMH/PHS otomatis disusun dari blangko ABT \"@ 1 - PMH\" / \"@ 2 - PHS\", dibubuhi tanda tangan penanda tangan (PMH ditambah cap kantor di atas tanda tangan), lalu diunggah ke e-Doc; peta & pengaturan penetapan di Integrasi e-Court.",
      "Status Perkara: \"Unduh seluruh berkas\" (satu ZIP) dialirkan sebagai unduhan biasa peramban - tidak lagi \"Failed to fetch\"; overlay hanya untuk kegagalan.",
    ],
  },
  {
    versi: "1.184.0",
    dirilis: "2026-10-05T18:00:00+08:00",
    judul: "Perbaikan 5 Okt: ABT lebih cepat & hanya isian sah, tab PTSP + KTP/PDF, putusan otomatis tanpa sembul, Court Calendar otomatis, pembaruan sendiri",
    butir: [
      "ABT: \"Isi dari SIPP & input ke ABT\" (hakim dan BAS) hanya mengusulkan variabel data_teks/data_tanggal - Tgl Sidang, Majelis, dan sejenisnya dihitung ABT sendiri dan tidak lagi tercentang. Tanggal dikirim d/m/Y (bentuk yang diterima ABT). Input ke ABT tanpa jeda (keputusan pengguna), bacaan berjalan bersamaan - jauh lebih cepat. 0222-8503 yang tidak terdeteksi tetap punya kartu Sunting. #2222#/#0364# Tanggal KTP diusulkan dari berkas KTP e-Court (dibaca mesin, tidak dicentang sendiri). \"Susun keterangan saksi\" juga dari blangko BAS (5058).",
      "SIPP: tab baru PTSP berisi Data Umum dari berkas gugatan (dipindah dari Penetapan; di Penetapan ada tautannya), isi para pihak ke SIPP dari gugatan, isi dari foto/PDF KTP (zona seret-lepas besar, tema UI Baru, alamat & wilayah lebih andal, rantai provinsi-kelurahan sejauh cocok, alur saksi Cari-Tambah), dan rapikan alamat pihak yang dobel/berkurung. Jendela sembul SIPP digeser agar tidak tertutup panel.",
      "SIPP: Putusan otomatis membuka blangko lewat \"Tambah Putusan Akhir\" sendiri (putusan massal jalan), tidak macet, dan tidak lagi tertahan 5 detik per kolom. Court Calendar otomatis untuk panitera sidang: disusun dari pola perkara sejenis, dapat disunting, diinput sekaligus.",
      "Penanda halaman daftar SIPP: \"izin atasan\" hanya perkara cerai dan poligami; \"menunggu majelis\" hanya dokumen persidangan perkara gugatan (bukan berkas pendaftaran, bukan permohonan) - satu definisi dengan ALETA e-Court dan Status Perkara.",
      "Ekstensi memperbarui dan memuat ulang dirinya sendiri saat halaman baru dimuat (sekali per versi), lalu menulis \"ALETA diperbarui ke x\" di atas widget.",
      "PERBAIKAN penetapan: tanggal sidang yang dipilih sendiri dari kalender (\"manual\") kini yang ditulis ke SIPP - sebelumnya diganti diam-diam oleh saran ALETA. Tanggal yang ditolak SIPP (Sabtu/Minggu, sebelum tanggal penetapan) ditolak dengan pesan, tidak diganti.",
      "PERBAIKAN Audit Trail SIPP: PMH, Smart Majelis, PPP, PJS, PHS, sidang pertama, dan pembatalannya tercatat atas akun SIPP petugas yang sedang masuk (bukan akun pejabat), dari alamat peramban petugas, pada jam sungguhan dengan jeda antarlangkah - urutan, judul, dan isi barisnya persis seperti bila diisi lewat blangko SIPP. Pejabat penetap dan jejak lengkapnya dicatat di ALETA saja.",
    ],
  },
  {
    versi: "1.183.0",
    dirilis: "2026-10-04T14:50:00+08:00",
    judul: "Panel ABT: bagian Unggah putusan dan tombol kaki \"Kerjakan perkara ini\" hanya di blangko putusan",
    butir: [
      "PERBAIKAN lanjutan 1.182.0. Diukur atas 812 blangko ABT: 1.182.0 hanya menolak BAS, relaas, dan pemberitahuan, sehingga PMH/PHS, Penunjukan PP/Jurusita, Penetapan Mediator, Penetapan Hari Sidang, Sampul, Daftar Isi, Akta Cerai, formulir, dan laporan mediasi masih mendapat bagian Unggah - dan di UI Baru panel memilih sendiri \"Blangko halaman ini\", jadi satu klik di kaki mengunggah blangko itu sebagai putusan. Kini semuanya dikenali dan bagian Unggah tidak digambar di sana.",
      "Jenis blangko juga dikenali dari SUBMENU tempat berkasnya diklik di halaman daftar ABT (\"Putusan CG\", \"BAS Cerai Verstek\", \"Relaas dan PBT\", \"Gugatan & Permohonan\"), sebab banyak blangko putusan bernama tanpa kata putusan (\"CG Verstek\", \"PAW\", \"Wali Adhal\"). Catatannya hanya di sessionStorage tab itu - tidak ada yang ditulis ke ABT.",
      "UI Baru: blangko yang tetap tidak dikenali (mis. \"PAW\" dibuka tanpa lewat daftar, atau penetapan ikrar talak) tidak lagi dipilih sendiri. Bagian Unggah dan tombol kaki DIKUNCI dengan satu kalimat dan tombol \"Ini blangko putusan - buka\"; kunci terbuka sendiri bila pemetaan blangko putusan mengenali token atau nama berkasnya.",
      "Yang TIDAK berubah: blangko putusan yang dikenali tetap seperti biasa; tampilan Lama dan Baru tidak dikunci (keduanya tidak pernah memilih blangko halaman ini); \"Isi dari SIPP & input ke ABT (BAS)\" di blangko BAS tetap ada.",
    ],
  },
  {
    versi: "1.182.0",
    dirilis: "2026-10-04T11:10:00+08:00",
    judul: "Panel ABT: bagian Unggah putusan tidak lagi tampil di blangko BAS, relaas, dan pemberitahuan",
    butir: [
      "PERBAIKAN. Di blangko BAS (juga relaas panggilan dan pemberitahuan putusan) bagian \"Unggah putusan perkara ini ke SIPP\" dan tombol kaki \"Kerjakan perkara ini\" tidak lagi digambar. Sebelumnya keduanya tampil di semua halaman blangko ABT, dan bila token blangko halaman tidak cocok dengan pemetaan putusan, panel memilih sendiri \"Blangko halaman ini (dari tautan CETAK)\" - satu klik mengunggah RTF BAS atau relaas ke SIPP sebagai putusan perkara.",
      "Dikenali dari nama blangko (BAS, berita acara, relaas, panggilan, pemberitahuan, PBT) dan dari tautan validasi BAS. Ada penjaga kedua di tombolnya bila halaman ABT berganti isi tanpa muat ulang, dan langkah \"Kerjakan\" tanpa bagian Unggah tidak lagi melempar error.",
      "Yang TIDAK berubah: blangko putusan tetap punya bagian Unggah dan tombol kaki seperti biasa; \"Isi dari SIPP & input ke ABT (BAS)\" untuk panitera dan PP di blangko BAS tetap ada.",
    ],
  },
  {
    versi: "1.181.0",
    dirilis: "2026-10-02T21:45:00+08:00",
    judul: "Jadwal Sidang: kolom Antrian / Jam tidak lagi melebar dan menyempitkan Perkara & Para Pihak",
    butir: [
      "RILIS INI HANYA PORTAL; isi ekstensi tidak berubah (versinya ikut naik).",
      "Kolom Antrian / Jam yang sudah terisi (nomor hijau, jam P/T, dan lencana Tunggu / Dari sebelumnya / Lama) kini dibatasi lebarnya, sehingga kolom Perkara & Para Pihak - kolom utama - tidak lagi tersempitkan. Kolom yang belum mengambil nomor tetap sesempit isinya. Lencana di dalamnya membungkus ke baris berikutnya, tidak ada yang dihapus.",
    ],
  },
  {
    versi: "1.180.0",
    dirilis: "2026-10-02T21:30:00+08:00",
    judul: "Jadwal Sidang dan Hasil Sidang: tanggal dan jam sidang berikutnya otomatis, tanda sedang berjalan manual, skors di Papan panggil",
    butir: [
      "RILIS INI HANYA PORTAL DAN BOT; isi ekstensi tidak berubah (versinya ikut naik).",
      "TANGGAL SIDANG BERIKUTNYA (Jadwal Sidang dan Hasil Sidang, satu aturan yang sama): bawaannya mengikuti urutan (1) ketidakhadiran - penggugat tidak hadir 1 minggu; sudah pernah hadir semua tetapi salah satu tidak hadir 1 minggu bila tergugat punya email; tergugat tidak hadir 1 minggu bila punya email dan setuju saluran elektronik e-Court, selain itu 2 minggu; (2) tundaan karena mediasi 3 minggu; (3) rekomendasi Court Calendar; (4) dua minggu seperti sebelumnya. Sumber aturan ditulis di layar dan tanggal dapat diganti manual.",
      "JAM SIDANG BERIKUTNYA: jawaban, replik, duplik, dan kesimpulan 15:00; pembuktian, musyawarah majelis, putusan, dan mediasi 09:00.",
      "EMAIL DAN PERSETUJUAN E-COURT: email tergugat dan status persetujuan saluran elektroniknya dibaca dari data e-Court yang sudah ditarik, dan email penggugat dari SIPP. Rincian Jadwal Sidang menampilkan 'Panggilan elektronik' (ada/tidak dan setuju/tidak setuju/belum); alamat email tidak dikirim ke peramban. Bila datanya tidak terbaca, bawaan memakai aturan tanpa email dan sebabnya disebut.",
      "SEDANG BERJALAN: tombol manual 'Tandai berjalan' dan 'Batalkan tanda' untuk perkara yang tidak terdeteksi dari antrian; ringkasan ruang sidang menyebut sumber tandanya. Sinkron ke mesin antrian ruang tunggu baru menyala setelah admin mengisi pengaturannya sesudah nilai status di server dipastikan.",
      "SKORS: ringkasan ruang sidang menyebut tiap perkara yang diskors dan dapat ditekan; Papan panggil memuat Skors, Lanjutkan, dan Batalkan tanda. Perkara diskors tidak dianggap selesai.",
      "JADWAL SIDANG: tombol Selesai kini di bawah Status, setelah Rincian dan Status.",
    ],
  },
  {
    versi: "1.179.0",
    dirilis: "2026-10-02T11:20:00+08:00",
    judul: "Pemetaan blangko tersambung ke ekstensi dan Cetak relaas, putusan per status putusan, peta dan isian BAS untuk panitera, tanda antrian online, label peran di kiri",
    butir: [
      "PEMETAAN BLANGKO (Integrasi e-Court) kini menjadi sumber pertama di mana pun blangko dipilih: tab Juru Sita (per perkara dan massal), putusan massal SIPP dan ABT, unggah putusan, dan tombol Cetak relaas di Jadwal Sidang. Perubahan admin berlaku di ekstensi paling lama 1 menit, tanpa Reload. Bila server tidak terjangkau, dipakai simpanan terakhir lalu bawaan.",
      "RELAAS DAN PEMBERITAHUAN PUTUSAN: setiap kunci yang diatur admin dipakai pada keadaannya - sidang pertama atau lanjutan, Penggugat/Tergugat atau Pemohon/Termohon, ikrar, dan PBT. Kunci yang lebih khusus menang (mis. relaas-panggilan-sidang-pertama-pemohon di atas panggilan-sidang-pertama). Kunci yang tidak dikenali tidak dibuang. Layar admin menampilkan kolom 'Dipakai saat' untuk tiap baris.",
      "PUTUSAN PER STATUS PUTUSAN: tiap jenis perkara dapat dibuka per status (Dikabulkan, Dicabut, Digugurkan, Gugur, Tidak Dapat Diterima, Ditolak, Dicoret dari Register, Perdamaian, Dismissal; Dikabulkan juga dapat dibedakan verstek). Baris status yang kosong memakai blangko jenisnya seperti sebelumnya.",
      "BERITA ACARA SIDANG UNTUK PANITERA: tab baru 'Berita acara sidang (BAS)' di Pemetaan blangko (per jenis perkara, sidang ke- atau agenda, dan kehadiran). Di panel ABT, blangko BAS yang terbuka mendapat 'Isi dari SIPP & input ke ABT (BAS)' untuk panitera dan panitera pengganti - data sidang, centang, satu tombol Input. BAS massal memakai peta ini.",
      "JADWAL SIDANG: ikon ponsel 'online' bila nomor antrian diambil lewat antrian online (pendaftaran WhatsApp), dengan pihak dan jamnya bila pasti; dapat dimatikan di menu Tampilan.",
      "LABEL PERAN pada kepala bagian lipat kini selalu di kiri judul, di panel SIPP, ABT, ALETA, dan widget.",
    ],
  },
  {
    versi: "1.178.0",
    dirilis: "2026-10-02T07:40:00+08:00",
    judul: "Panel lebih tertata per peran, relaas massal per juru sita, blangko pengecualian di putusan massal, isi data pihak dari foto KTP, edoc penetapan dengan cap, skors sidang",
    butir: [
      "TAMPILAN UI BARU: kepala dan kaki panel ALETA kini sama dengan panel SIPP dan ABT. Tiap bagian lipat diberi label peran (mis. Susun keterangan saksi = Panitera). Hanya bagian utama peran itu yang terbuka sebagai bawaan; bagian lain terlipat supaya tidak ramai. Klik dua kali di sudut panel memindahkan panel ke sudut itu (berlaku untuk ALETA, SIPP, ABT, dan widget checklist). Di popup, atur panel mana yang terbuka saat halaman dibuka: bawaannya ALETA tersembunyi, SIPP dan ABT terbuka.",
      "WIDGET CHECKLIST: bawaannya hanya checklist milestone yang tampil; Catatan cepat, Lama sidang, dan Kalender tenggat dinyalakan dari tombol ☰ di kepala checklist.",
      "PANEL ABT: bagian lipat yang tidak mau menutup sudah diperbaiki. Susun keterangan saksi hanya untuk panitera, panitera pengganti, dan Admin. Jawaban saksi yang belum terdeteksi dihitung dan bisa dilompati satu per satu. Perapian posita dan keterangan saksi dikerjakan di belakang tanpa kartu tambahan (tetap ikut tersimpan saat Input ke ABT).",
      "MASSAL: relaas dan pemberitahuan putusan massal dikelompokkan per juru sita untuk Admin. Putusan massal punya blangko utama di atas, dan tiap perkara yang berbeda bisa memakai tombol 'Blangko berbeda…'; pilihan dari panel SIPP ikut dipakai di ABT.",
      "PANEL SIPP: 'Perkara berikutnya' mengikuti peran (hakim: putusan, panitera pengganti: BAS, juru sita: relaas dan PBT); antrean Direktori Putusan tetap hanya untuk Super Admin dan Admin. Tab Penetapan punya 'Upload edoc penetapan' (PMH/PPP/PJS/PHS, boleh sebagian) yang diambil dari blangko PTSP di ABT, ditandatangani sesuai pejabatnya dan dibubuhi cap pengadilan, plus bagian upload manual. Cap diunggah sendiri di ALETA e-Court > Berkas tanda tangan > Cap pengadilan.",
      "ISI DATA PIHAK DARI FOTO KTP (baru, untuk petugas selain hakim, panitera, dan juru sita): di blangko 'Tambah Referensi Data Pihak', foto atau teks KTP dibaca, hasilnya diperiksa petugas, lalu diisikan ke blangko. Provinsi sampai kelurahan/desa dipilih bertingkat dari data wilayah SIPP; yang tidak cocok tepat hanya ditawarkan, tidak dipilih sendiri. Foto tidak disimpan, dan Simpan SIPP tetap ditekan petugas.",
      "TEMA GELAP SIPP: blangko di tingkap SIPP (mis. Tambah Referensi Data Pihak) kini ikut gelap dan terbaca.",
      "JADWAL SIDANG (portal): perkara yang sedang disidangkan disorot per ruang. Tombol Skors, Lompat ke sini, dan Lanjutkan untuk berpindah perkara sementara tanpa menghapus tanda Selesai yang sah; tersedia juga di halaman Hasil Sidang. Lebar halaman ALETA e-Court dibatasi agar nyaman dibaca, dengan pilihan 'Lebar penuh' di layar besar.",
    ],
  },
  {
    versi: "1.177.0",
    dirilis: "2026-10-01T21:15:00+08:00",
    judul: "UI Baru: lipatan seragam, Putusan otomatis satu alur tanpa membuka blangko, upload putusan ke e-Court, panel ABT rapi otomatis, massal per user; Jadwal Sidang: mediator, Selesai, layar penuh, aksi e-Court",
    butir: [
      "SEMUA PERUBAHAN EKSTENSI KALI INI HANYA DI UI BARU. Tampilan Lama dan Baru tetap seperti 1.176.0.",
      "LIPATAN SERAGAM: semua bagian di panel SIPP, panel ABT, panel massal, BAS massal, widget, dan panel portal memakai satu bentuk lipat yang sama, dan buka/tutupnya diingat. Bagian yang dulu tidak bisa dilipat kini bisa.",
      "PANEL SIPP - TAB PUTUSAN: Putusan otomatis bisa dijalankan tanpa membuka blangko Putusan Akhir lebih dulu (ALETA membukanya sendiri), lalu satu alur: isi, simpan terbukti, unggah edoc putusan dan anonimisasi (dibuat bila tidak dipilih). Lebih cepat sekitar sepertiga tanpa membuang pembuktian simpan. Tombol 'Ambil usulan dari ALETA' disembunyikan karena usulan kini dibaca sendiri. 'Langkah berikutnya' menyarankan 'Buat putusan' bila sidang sudah putus tetapi putusan belum diinput. 'Perkara berikutnya' hanya untuk Super Admin dan Admin.",
      "UPLOAD PUTUSAN KE E-COURT (baru): bagian di bawah unggah edoc ke SIPP; sebelum mengunggah selalu disebut atas nama akun e-Court siapa. Memakai sesi e-Court akun pengguna sendiri yang disambungkan di Integrasi e-Court > Sesi e-Court saya.",
      "PANEL ABT: posita dan keterangan saksi yang dirapikan sudah masuk daftar 'Input ke ABT' tanpa klik Rapikan/Terapkan (tetap tidak ada yang ditulis sebelum Input). Huruf alasan menampilkan kesimpulan dari keterangan saksi dan posita; aturan/pasal dan alasan pemilihan di balik ⓘ. Variabel 4020, 8521, 8522, 8528, 8529, 8530 yang diisi ABT sendiri tidak lagi diperingatkan sebelum Input. 'Unggah putusan perkara ini ke SIPP' memakai blangko halaman ini dan tetap jalan walau nomor perkara tidak terbaca dari kepala halaman. Susun saksi: label sama/beda/varian diganti ⓘ, dengan tombol ganti keterangan serta urungkan/ulangi.",
      "PUTUSAN MASSAL & BAS MASSAL: putusan massal hanya menawarkan perkara yang hari itu putus atau ditunda untuk putusan/musyawarah majelis (diukur atas 16.076 jadwal: 99% tepat). Super Admin dan Admin melihat daftar per hakim (putusan) atau per PP (BAS) dengan centang per kelompok.",
      "WIDGET CHECKLIST: tiap bagian bisa disembunyikan, diubah tingginya, dipindah urutannya, dan dipisah menjadi jendela melayang; susunannya tersimpan per akun di server dan ikut ke PC mana pun.",
      "JADWAL SIDANG (portal): pilih mediator langsung (juga di Hasil Sidang), tombol Selesai yang sejalan dengan antrian sidang, halaman lebih lebar di layar besar, layar penuh berjendela, Mode lengkap/Mode minimalis di puncak menu Tampilan, Majelis dan Identitas pihak terlipat sebagai bawaan, proses mediasi di rincian, tombol unduh di riwayat panggilan. Aksi e-Court di Jadwal Sidang dan Status Perkara: unduh dokumen e-litigasi dan verifikasi oleh majelis, TTE salinan putusan oleh panitera (passphrase diketik tiap kali dan tidak pernah disimpan), lencana putusan yang belum diunggah atau belum di-TTE.",
    ],
  },
  {
    versi: "1.176.0",
    dirilis: "2026-09-30T17:20:00+08:00",
    judul: "Menu panel SIPP dan ABT mengikuti peran, BAS massal, relaas & pemberitahuan massal di daftar perkara, panel ABT lebih sederhana",
    butir: [
      "MENU PER PERAN (tampilan Baru & UI Baru). Di dalam perkara SIPP: Ketua/Wakil - Penetapan (hanya bila PMH/PPP/PJS/PHS belum lengkap), Putusan, Berkas, Perkara; Hakim - Putusan, Berkas, Perkara; Panitera/PP - Berkas, Perkara; Jurusita - Juru Sita, Perkara, Berkas; Super Admin & Admin - seluruhnya, termasuk tab Juru Sita. Yang bukan majelis/PP/JS perkara itu hanya membaca (Perkara dan Berkas). Menu pertama terbuka sebagai bawaan. Peran lain (operator, analis perkara, staf) tetap dengan susunan lama. Menu yang tidak berlaku bagi peran itu disembunyikan, tidak dihapus.",
      "DAFTAR PERKARA SIPP & BERANDA ABT: menu massal per peran - Penetapan massal (Ketua/Wakil), Putusan massal (Hakim, Ketua/Wakil), Berita Acara Sidang massal (Panitera/PP), Relaas & pemberitahuan putusan massal (Jurusita); Super Admin & Admin melihat semuanya. Juru sita tidak lagi melihat Putusan massal.",
      "RELAAS & PBT MASSAL kini ada di halaman daftar perkara SIPP dan beranda ABT: pilih tanggal, 'Milik saya' atau semua juru sita, centang panggilan dan PBT per pihak, cetak sekaligus. Panggilan sidang tundaan ikut, termasuk kelompok hari kerja sebelumnya. Pada sidang tundaan yang memanggil kedua pihak kini tercetak satu dokumen P dan T (bukan dua). Pesan 'Sesi ALETA habis' hanya muncul bila sesi memang habis.",
      "BAS MASSAL (baru, panitera sidang/PP): daftar perkara bersidang pada tanggal itu (bawaan: yang PP-nya Anda), status BAS tiap perkara, usulan blangko BAS menurut jenis perkara dan kehadiran, pratinjau isian, lalu unduh RTF beruntun untuk yang dicentang. Tidak ada yang ditulis ke SIPP maupun ABT; susun keterangan saksi tetap di panel ABT per perkara lewat 'Buka di ABT'.",
      "PANEL ABT LEBIH SEDERHANA: Ketua/Wakil & Hakim langsung melihat 'Isi dari SIPP & input ke ABT' dan 'Unggah putusan'; Panitera/PP 'Susun keterangan saksi'; Jurusita bagian Juru Sita. Isi dari SIPP (dan susun saksi untuk PP) berjalan sendiri sampai pratinjau; satu-satunya tombol yang menulis ke ABT adalah 'Input ke ABT', dan hanya data yang terdeteksi ada yang muncul sebagai centang. Alasan perceraian diringkas di tiap huruf ('dikuatkan 2 saksi & ada di gugatan', 'baru 1 saksi', 'tidak ada di gugatan'); huruf alasan ikut tertulis bersama 'Terapkan yang dicentang'. Cari variabel, jumlah variabel siap, dan komentar hakim yang kosong pindah ke menu ⋯ (komentar yang berisi tetap tampil).",
      "PENJELASAN TEKNIS DISEMBUNYIKAN (bawaan nyala): saklar 'Sembunyikan penjelasan teknis' di widget dan popup; kalimat teknis seperti daftar nomor variabel yang tidak berlaku disembunyikan. Error, peringatan, dan konfirmasi tetap tampil. Dapat diatur per peran lewat Profil saklar.",
    ],
  },
  {
    versi: "1.175.0",
    dirilis: "2026-09-30T13:45:00+08:00",
    judul: "32 perbaikan sesudah uji 1.174.1 di SIPP/ABT sungguhan: panel lebih tenang, tab Juru Sita, putusan dari DOCX/DOC/PDF, anonimisasi otomatis, bawaan tunda, sinkron cadangan",
    butir: [
      "GERBANG SAMA seperti 1.174.x: perubahan panel hanya hidup di tampilan Baru dan UI Baru; tampilan Lama tetap persis. Pengecualian yang berlaku di semua tampilan: istilah 'error' kini dipakai seragam di seluruh tulisan tampilan, perbaikan tema gelap SIPP (kotak pesan dan konfirmasi SIPP ikut gelap; 'Dokumen Belum Ada' merah dan 'sudah ada' biru tetap terbaca), dan perbaikan di portal.",
      "PANEL TIDAK RAMAI: penjelasan panjang dilipat di balik tombol ⓘ yang dapat dibuka-tutup (teksnya tetap ada, tidak ada fitur yang hilang); pesan error, peringatan, dan dialog konfirmasi tidak pernah dilipat. Klik 2x kepala panel SIPP, ABT, dan portal = layar penuh; klik 2x lagi = kembali. Tombol ☀ – ⛶ ↺ tetap di kepala panel SIPP di UI Baru, sama dengan panel lain.",
      "PANEL SIPP: Putusan otomatis dan Putusan massal dari berkas kini menerima DOCX, DOC, dan PDF (diubah dulu ke RTF di server; PDF diberi peringatan tata letak). Bila hanya edoc putusan yang dipilih, ALETA membuat anonimisasinya dalam bentuk yang sama lewat ABT, memeriksa sisa NIK/nama/alamat (berkonfirmasi), lalu mengunggah keduanya sekaligus - juga dapat dikerjakan sekali jalan bersama Putusan otomatis. Simpan putusan lebih cepat: konfirmasi 'Apakah Anda Yakin Akan Menyimpan Data' di-OK-kan hanya selama tekanan Simpan oleh ALETA sendiri, dan pembuktian simpan (jawaban SIPP + selisih database) tidak diubah.",
      "PANEL ABT: 'Susun saksi' hanya untuk panitera sidang/PP (hakim tidak melihatnya); langkah yang sudah hijau disembunyikan; 'Isi dari SIPP' digabung dengan 'Input ke ABT' dengan Rapikan otomatis sebagai pratinjau (disimpan lewat Terapkan); variabel huruf G yang error hanya karena 8503 belum diisi tidak lagi ditampilkan sebagai error; susun saksi lebih lega dengan huruf lebih besar, kotak menyesuaikan tinggi isinya, dan nomor pertanyaan saksi 1 dan saksi 2 sejajar di mode berdampingan.",
      "KETERANGAN SAKSI TIDAK LAGI KOSONG: jawaban '...', '…', '_' atau variabel yang belum terisi tidak dipulangkan lagi. Pertanyaan upaya rukun diisi dari variabel 1268 (dikirim panel ABT), lalu posita, lalu mediasi SIPP; bila tidak ada sumber, jawabannya bertanda '[BELUM TERISI - isi dari keterangan saksi]' dan dihitung belum siap.",
      "TAB JURU SITA di panel SIPP dan ABT (peran juru sita dan yang berwenang): cetak relaas panggilan sidang Penggugat/Tergugat dan pemberitahuan putusan, per perkara dan massal, memakai 'Pemetaan blangko' yang kini dapat diatur Super Admin di Integrasi e-Court (putusan, relaas, PBT).",
      "PROFIL SAKLAR PER PERAN: Super Admin dan Admin mengatur fitur yang tampil untuk tiap peran di Integrasi e-Court > Profil saklar; panel dan widget pegawai mengikuti peran login-nya. Pita 'Pembaruan tersedia' di atas widget/panel (Baru & UI Baru): klik = perbarui lalu muat ulang ekstensi.",
      "JADWAL SIDANG (portal): tombol putus hanya menulis jadwal sidang (tidak lagi putusan, audit putusan, dan tahapan perkara); tunda/putus langsung dijalankan tanpa 'Lihat rencana' (layar Hasil Sidang penuh tetap punya rencananya); isian tunda (alasan, agenda, tanggal, kehadiran) terisi otomatis dari riwayat sidang dan mediasi, tetap dapat diganti; perkara yang sudah ikrar talak terbaca 'Selesai · telah ikrar talak'; nomor antrian hari yang sudah lewat tetap tampil dari rekaman ALETA.",
      "UNDUH BERKAS: pesan 'Berkasnya kosong di server.' hanya muncul bila server sungguh mengirim 0 bita atau error - bukan lagi saat pengelola unduhan peramban (IDM dan sejenisnya) mengambil alih unduhan yang sebenarnya berhasil.",
      "SINKRON CADANGAN (server, menu admin 'Sinkron cadangan'): cadangan otomatis basis data ALETA, SIPP, ABT, dan antrian sidang dari server ke laptop dan Google Drive, serta berkas seluruh perkara ke Google Drive sebagai folder dan subfolder (susunannya sama dengan 'unduh seluruh perkara' di Status Perkara). Semua pengaturan di admin; akun Google Drive dan penjadwal laptop dipasang oleh admin sendiri.",
    ],
  },
  {
    versi: "1.174.1",
    dirilis: "2026-09-30T06:25:00+08:00",
    judul: "Edoc putusan dan edoc anonimisasi punya tempat unggah masing-masing, dikirim sekaligus (tampilan Baru & UI Baru)",
    butir: [
      "Di panel SIPP bagian Putusan > Unggah putusan ke SIPP, tampilan Baru dan UI Baru kini menyediakan DUA tempat: 'Edoc putusan' dan 'Edoc anonimisasi', masing-masing dengan pemilih berkasnya sendiri. Satu tombol 'Unggah edoc ke SIPP' mengirim keduanya SEKALIGUS dalam satu kiriman; boleh salah satu saja.",
      "Sebabnya: cara sebelumnya memakai satu pemilih dan menebak mana anonimisasi dari NAMA berkasnya - berkas anonimisasi yang namanya tidak memuat 'anonim' terbaca sebagai putusan kedua, dan slot anonimisasinya kosong. Kini petugas yang menentukan slotnya; nama berkas hanya dipakai untuk peringatan.",
      "Penjagaan tetap sama: bentuk selain RTF/DOC/DOCX/PDF, berkas perkara lain, dan berkas BAS/penetapan/relaas tidak dikirim; berkas yang sama di kedua tempat ditolak. Bila sebagian gagal, sebabnya disebut per berkas dan halaman tidak dimuat ulang.",
      "Tampilan Lama tidak berubah (satu pemilih seperti sebelumnya), dan cara lama tetap dapat dipilih di Baru/UI Baru lewat 'Pakai cara lama: satu pemilih untuk keduanya'. Panel ABT memang sudah mengirim putusan dan anonimisasinya dalam satu kiriman.",
    ],
  },
  {
    versi: "1.174.0",
    dirilis: "2026-09-30T02:30:00+08:00",
    judul: "Panel ABT dan panel SIPP versi baru (tahap 6-7), mode latihan, dan komentar hakim atas BAS",
    butir: [
      "SEMUANYA BERGERBANG, seperti 1.173.x: dalam tampilan Lama panel ABT dan panel SIPP tetap persis seperti sebelumnya (dibuktikan uji perbandingan dengan versi sebelumnya - termasuk urutan pesan ke SIPP). Perbaikan desain hanya di UI Baru; ide fitur di Baru dan UI Baru bila saklarnya menyala. Tidak ada jalur tulis SIPP baru.",
      "MODE LATIHAN (Super Admin & Admin menyalakannya dari popup). Semua tombol berjalan seperti biasa, tetapi TIDAK ADA yang ditulis ke SIPP maupun ALETA: tombol Simpan SIPP tidak ditekan, isian blangko SIPP tidak diisikan, dan semua kiriman ke portal ditahan. Yang akan ditulis ditampilkan di kotak 'LATIHAN: yang akan ditulis', dengan pita LATIHAN di panel. Berlaku di semua tampilan, bawaannya mati.",
      "PANEL SIPP (tahap 7). UI Baru: panel berlabuh di kanan (SIPP menyempit, tidak tertutup) dengan lebar yang dapat diatur, kepala satu baris dengan menu ⋯ (tombol lama dipindah utuh ke sana), tab Penetapan/Berkas/Perkara/Putusan berlencana, kartu 'Langkah berikutnya', ringkasan keputusan penetapan dengan 'Tinjau & ubah pilihan', bilah bawah yang menekan tombol Tetapkan asli, 'Batalkan SELURUH penetapan' pindah ke Zona berbahaya dan menuntut nomor perkara diketik, penyunting teks kaya dengan 'Lihat kode', kartu praperiksa bertingkat, Penilaian SK ringkas, cari (Ctrl+K), dan daftar pintasan. Peta kolom blangko pindah ke menu Super Admin. Ide yang dapat dinyalakan antara lain pengingat tenggat (batas hari sama dengan Penilaian SK), antrean 'perkara berikutnya', templat pertimbangan per status (hanya yang disahkan), komentar hakim (baca saja), dan laporkan masalah ke Masukan portal.",
      "PANEL ABT (tahap 6). UI Baru: panel lebih lebar, langkah 1-5, bilah 'x dari y variabel siap', segmen keyakinan Semua/Ragu/Bentrok/Cukup/Pasti, baris variabel berbentuk tabel, penyunting keterangan saksi layar penuh, dan tombol utama di kaki yang lengket. Ide yang dapat dinyalakan antara lain: kalimat status ramah (rincian teknis tetap ada), pita huruf G dengan CETAK berkonfirmasi, pemeriksa anonimisasi sebelum unggah (berkonfirmasi), daftar variabel wajib sebelum CETAK (peringatan), pratinjau naskah, pemeriksa konsistensi, sorot beda antar saksi, riwayat per variabel dengan pulihkan, urungkan/ulangi, mode sidang, draf keterangan saksi tersimpan otomatis, saran pasal per huruf alasan (hanya yang disahkan dapat disisipkan), dan komentar hakim di baris pertanyaan saksi.",
      "KOMENTAR HAKIM ATAS BAS (server, migrasi 0053). Tanpa acc: hakim membaca alur BAS dan keterangan saksi perkara di portal (/aleta/bas/komentar, dari Status Perkara dan Alat Bantu Tulis BAS) dan mengomentari bagian yang salah; panitera pengganti melihatnya di panel ABT dan menandainya selesai. Komentar tidak pernah menahan pekerjaan.",
      "TEMPLAT & DASAR HUKUM, VARIABEL WAJIB (server, migrasi 0053). Templat pertimbangan (gugur, dicabut, verstek, tidak diterima) dan pasal per huruf alasan dibuat sebagai DRAF - belum disahkan - sampai Super Admin mengesahkannya di Integrasi e-Court. Variabel wajib ABT diukur dari putusan yang sudah diterima (tombol Ukur ulang) dan dapat diubah Super Admin.",
      "Ditunda: salin keterangan saksi dari perkara serupa dan kirim keterangan saksi ke BAS SIPP (belum ada sumber data / jalur tulis yang aman), sisa panjar & tarif radius (menunggu SK), beban hakim dan giliran juru sita berbentuk bilah (datanya belum terstruktur).",
    ],
  },
  {
    versi: "1.173.1",
    dirilis: "2026-09-29T23:00:00+08:00",
    judul: "Popup, widget, dan panel portal versi baru (tahap 2-4), tampilan dapat diterapkan admin ke pegawai lain (tahap 5), dan istilah server/blangko",
    butir: [
      "SEMUANYA BERGERBANG. Dalam tampilan Lama (bawaan) popup, widget, dan panel tetap persis seperti 1.172.0. Perbaikan desain hanya hidup di UI Baru; ide fitur hidup di Baru dan UI Baru, masing-masing hanya bila saklarnya dinyalakan. Satu-satunya tambahan dalam Lama: satu bacaan GET ke portal paling sering lima menit sekali untuk mengetahui apakah admin menerapkan tampilan.",
      "ISTILAH. Semua tulisan yang tampil kini memakai 'server' dan 'blangko', menggantikan dua istilah lama yang kurang dikenal - di ekstensi, portal, catatan pembaruan, dan pesan dari bot. Nama kode, kolom basis data, dan alamat API tidak diubah. Dijaga uji supaya tidak muncul lagi.",
      "TOMBOL ×. Dalam UI Baru × hanya menutup panel (menciut menjadi lencana, selalu dapat dibentangkan lagi) dan ALETA tetap aktif; 'Matikan ALETA' tetap di popup sebagai saklar utama. Lama dan Baru tetap seperti sebelumnya.",
      "POPUP (tahap 2). UI Baru: saklar dikelompokkan Tampilan/SIPP/ABT/Portal, keterangan satu baris dengan ⓘ (uraian lengkap tetap ada), kartu status sambungan dengan 'Perbaiki', saklar utama besar, ukuran huruf A− A A+, tema Otomatis/Gelap/Terang, pintasan Portal/SIPP/ABT di kaki. Ide yang dapat dinyalakan: lampu SIPP/ABT/portal/server, penggeser ukuran huruf, profil saklar per peran (Hakim/PP/Juru Sita/Kustom), Senyapkan 1 jam, kembalikan posisi panel dan widget, ekspor/impor pengaturan (tanpa akun maupun data perkara), cari saklar, tanda BARU, batas situs, daftar pintasan.",
      "WIDGET (tahap 3). UI Baru: kartu tugas bertenggat, satu dok di kiri bawah bersama lencana logo berangka dan bercincin warna sambungan, dan 'Atur widget' (pilih dan urutkan). Ide yang dapat dinyalakan: angka tugas di ikon ekstensi, Tandai selesai & Tunda 1 hari (hanya menyembunyikan dari daftar Anda, SIPP tidak diubah), menempel ke sudut, catatan cepat, penghitung lama sidang, kalender tenggat dua minggu. Jadwal sidang saya, antrean PP, WhatsApp, dan jendela terpisah tampil sebagai 'menyusul'.",
      "PANEL DI PORTAL (tahap 4). UI Baru: tab Beranda/Perkara/Pintasan/Akun, kepala dengan cari dan menu berlabel; tombol lama tetap ada. Ide yang dapat dinyalakan antara lain: panel di SAMPING sehingga tabel portal tidak tertutup (bawaan; mengambang dan mengecil-sendiri tetap dapat dipilih), mode layar publik (tombol atau Alt+L, nama pihak disamarkan), sematan dan cari perkara, buka SIPP/ABT langsung ke perkara, salin tautan, pintasan yang dapat diurutkan per orang, kewenangan dikelompokkan, lampu sambungan, tugas dan sidang saya hari ini, catatan tempel, tur singkat, dan daftar pintasan keyboard.",
      "TERAPKAN KE PEGAWAI LAIN (tahap 5, butuh server baru dengan migrasi 0052). Super Admin menerapkan Lama/Baru/UI Baru beserta saklar fiturnya ke semua, per peran, atau per orang dari Admin > Pengaturan ekstensi > Tampilan ekstensi. Tampilan yang diterapkan admin berlaku TANPA mode coba - pegawai tetap dapat menyimpan; uji pribadi Super Admin di PC-nya tetap menang dan tetap bermode coba. Tanda Selesai/Tunda ikut tersinkron ke server sehingga ikut ke PC lain. Selama server belum dipasang, ekstensi diam dan tetap memakai tampilan lokal.",
    ],
  },
  {
    versi: "1.172.0",
    dirilis: "2026-09-29T16:10:00+08:00",
    judul: "Fondasi tampilan baru: pengalih Lama / Baru / UI Baru untuk Super Admin, kulit Modern, 120 saklar fitur, dan mode coba",
    butir: [
      "PENGALIH TAMPILAN (khusus Super Admin, di popup). Tiga pilihan yang dapat diganti seketika: Lama (persis ekstensi sebelumnya), Baru (kulit Klasik ditambah fitur ide yang saklarnya dinyalakan), dan UI Baru (kulit Modern ditambah fitur ide yang saklarnya dinyalakan). Selama masa coba pilihannya tersimpan di PC ini saja; menerapkannya ke pegawai lain menyusul lewat portal. Pegawai selain Super Admin tidak melihat pengalihnya.",
      "BAWAANNYA LAMA, DAN LAMA TIDAK MENGUBAH APA PUN. Tanpa sentuhan pada pengalih, tidak ada atribut baru di halaman, tidak ada permintaan yang ditahan, dan tidak ada fitur yang tampil - tampilan dan perilaku sama persis dengan 1.171.0. Syarat ini dijaga uji.",
      "KULIT MODERN. Warna panel di SIPP, ABT, portal, widget checklist, dan popup diganti lewat token yang sama (aksen biru laut, hijau beres, kuning perlu perhatian, merah terlambat; gelap maupun terang), sudut lebih bulat, dan huruf Plus Jakarta Sans bila terpasang di komputer lalu Segoe UI - tidak ada huruf yang diunduh dari luar. Yang diganti hanya warnanya: tidak satu fungsi pun berubah. Kulit Modern mengalahkan enam palet Super Admin selama UI Baru dipilih; palet pilihan tetap tersimpan dan kembali saat beralih ke Lama atau Baru. Sebagian kecil panel yang warnanya masih tertulis tetap (belum lewat token) dirapikan pada tahap berikutnya.",
      "120 SAKLAR FITUR IDE. Satu saklar untuk tiap ide ekstensi (30 panel SIPP, 30 panel ABT, 30 panel portal, 30 popup dan widget), dengan nomor yang sama dengan berkas ide dan sandingan. Semuanya MATI sebagai bawaan, dan dalam tampilan Lama semuanya dianggap mati apa pun isinya. Saklar belum mengubah apa pun sampai idenya dibangun pada tahapnya; ide yang masih menunggu keputusan ditandai 'perlu keputusan'. Empat yang sudah diputuskan boleh ikut: ganti peran cepat, mode layar publik, profil saklar per peran, dan widget WhatsApp.",
      "MODE COBA. Selama tampilan Baru atau UI Baru dicoba, tindakan yang berdampak ke luar DITAHAN: tulisan ke portal ALETA (termasuk yang berujung kiriman WhatsApp), unggahan ke SIPP, simpan ke ABT, dan tombol Simpan SIPP lewat jembatan. Permintaan yang ditahan dijawab 423 'mode coba' dan tercatat DITAHAN di kotak hitam, bukan berpura-pura berhasil. Yang tetap lolos hanya bacaan dan daftar kecil yang sudah diperiksa hanya menghitung (konversi PDF, usulan blangko ABT, praperiksa putusan, ringkasan massal, bacaan tanya-jawab ABT). Panel bergaris putus-putus biru laut dan label 'Mode coba ALETA - kirim & simpan ditahan' tampil di pojok kiri bawah. Kotak 'Izinkan tindakan nyata' di popup melepas penahanan tanpa harus kembali ke Lama.",
      "Bila tampilan uji tertinggal menyala di PC yang dipakai pegawai lain, popup mereka menyebutnya dan menyediakan tombol 'kembali ke tampilan Lama' - kembali ke Lama selalu aman karena itu keadaan bawaan.",
    ],
  },
  {
    versi: "1.171.0",
    dirilis: "2026-09-27T10:30:00+08:00",
    judul: "Panel ALETA tidak lagi tampil di layar publik portal, dan tombol unduh berkas e-Court terlihat di mode terang",
    butir: [
      "PANEL ALETA DI LAYAR PUBLIK PORTAL. Layar ambil antrean, televisi ruang tunggu, tautan antrean tanpa login, antrean per ruang, papan pintu ruang sidang, halaman publik, dan verifikasi formulir sering dibuka dari peramban petugas yang memasang ekstensi. Panel ALETA dahulu hanya menahan diri di halaman masuk dan verifikasi dokumen, sehingga nama petugas, pintasan jabatannya, dan jalan kembali ke perkara yang baru dibukanya di SIPP ikut tampil di layar ruang tunggu. Kini panel tidak lahir di sana, dan pertanyaan 'siapa saya' ke portal - yang membawa sesi petugas - pun tidak diajukan. Portal yang berpindah ke layar publik tanpa memuat ulang melepas panel yang sudah ada.",
      "Daftar layar publik kini SATU, di panel-alat.js, dan dipakai panel ALETA maupun widget checklist milestone - rute publik baru cukup ditambahkan sekali. Halaman petugas yang namanya mirip (Antrian ALETA di /aleta/aleta-antrian) tetap menampilkan keduanya.",
      "TOMBOL UNDUH BERKAS E-COURT DI JADWAL SIDANG SIPP (mode terang). Warnanya diambil dari token yang hanya berlaku di dalam panel ALETA, sedangkan kotak berkas berada di tabel SIPP: tombolnya tanpa latar dan garis tepi, dan tulisannya ikut warna sel SIPP - abu, lalu memutih saat barisnya disorot. Kini hijau pekat ALETA bertulisan putih (kontras 6,16:1; saat disorot 8,44:1), dengan garis tepi dan cincin fokus yang terlihat. Mode gelap tidak berubah sama sekali.",
    ],
  },
  {
    versi: "1.170.0",
    dirilis: "2026-09-27T07:00:00+08:00",
    judul: "Checklist milestone: pekerjaan penting peran Anda dalam widget tersendiri",
    butir: [
      "CHECKLIST MILESTONE (baru, bawaan MATI). Saklar 'Tampilkan checklist milestone' di popup ekstensi memunculkan widget TERSENDIRI di kiri bawah halaman SIPP, ABT, dan portal ALETA - terpisah dari panel ALETA di kanan. Isinya pekerjaan penting peran Anda (hakim, panitera pengganti, juru sita, panitera, ketua, PTSP, operator), dikelompokkan Lewat tenggat, Hari ini, dan Minggu ini, dengan bilah 'Hari ini N dari M selesai'. Butir hilang sendiri saat datanya lengkap di SIPP - tidak ada centang tangan.",
      "Tiap butir punya tombol Kerjakan: portal ALETA, e-Court (hanya https *.mahkamahagung.go.id), ABT (beranda dengan perkara sudah terpilih; blangko yang dituju disebut di petunjuk karena alamat blangko ABT disandikan), atau SIPP (halaman perkara bila pernah terlihat di peramban ini; bila belum, beranda SIPP dibuka dan nomornya disalin untuk dicari).",
      "Widget dapat digeser (posisinya diingat per aplikasi), dikecilkan menjadi pil 'Checklist · 2 lewat · 3 hari ini', dan ditutup - menutup berarti mematikan saklarnya. Mengikuti tema panel, TIDAK ikut tercetak (Ctrl+P maupun lembar cetak portal), dan TIDAK muncul di layar publik portal: layar antrian, TV ruang tunggu, papan pintu ruang sidang, dan tautan antrian tanpa login.",
      "Disegarkan saat muncul, tiap 5 menit, dan saat jendela kembali difokus. Kabarnya jujur: belum masuk portal, portal tidak menjawab, dan jenis yang belum dapat dihitung disebut di kaki - bukan daftar kosong yang menyesatkan. Teks dari portal selalu digambar sebagai teks, dan alamat Kerjakan yang keluar dari tujuannya ditolak.",
      "Mematikan saklar menghapus tautan perkara SIPP yang pernah disimpan widget (paling banyak 300 pasangan nomor-alamat, tanpa nama pihak). 'Kembalikan posisi panel' di popup kini juga mengembalikan posisi widget.",
    ],
  },
  {
    versi: "1.169.0",
    dirilis: "2026-09-26T17:45:00+08:00",
    judul: "Putusan massal yang sungguh tersimpan di SIPP, tujuh alasan cerai baru untuk keterangan saksi, dan sumber isian ABT yang terukur",
    butir: [
      "PUTUSAN MASSAL SIPP TIDAK PERNAH DAPAT MENYIMPAN. Antrean hanya mengisi naskah (pertimbangan, amar, amar anonim) lalu menekan Simpan, sedangkan pilihan wajib - Status Putusan, Sumber Hukum, Faktor Perceraian, Nusyuz, Qobla/Ba'da, Keadaan Istri - tidak pernah diisi, sehingga SIPP selalu menolak dengan 'Sumber Hukum Belum Dipilih'. Kini pilihan itu diisi dari usulan ALETA dengan urutan pintu yang sama seperti panel satu perkara; pilihan wajib yang tidak dapat dipastikan menahan perkara beserta sebabnya, bukan dikirim untuk ditolak SIPP. Praperiksa kini memeriksa Status dan Verstek yang BENAR-BENAR akan disimpan - sebelumnya ia berjalan sebelum antrean memilihnya.",
      "BLANGKO SIPP MEMILIH 'QOBLA DUKHUL' SENDIRI. Blangko Putusan Akhir yang baru dibuka mencetak 'Qobla Dukhul' terpilih (kolomnya belum ada sebelum akta cerai, dan di PHP NULL == 0) serta Verstek 'Tidak'. Kedua nilai itu tidak lagi dianggap pilihan petugas - di antrean maupun di panel satu perkara - sehingga usulan ALETA tidak lagi membeonya dan perkara ba'da dukhul tidak lagi tersimpan sebagai qobla dukhul tanpa dipilih siapa pun.",
      "Pilihan yang sudah dibuat petugas tidak ditimpa: faktor atau Status yang berbeda dari usulan menahan antrean dengan kedua nilainya disebut, dan di panel satu perkara kartu Status yang berbeda tidak lagi tercentang sendiri. Setiap pilihan yang diisikan ALETA dicatat per perkara (medan, nilai, asal), dan yang berasal dari bawaan ditandai 'diisi bawaan - periksa'.",
      "Antrean bersama yang tidak lagi saling menimpa: tiap tulis antrean kini mengubah satu perkara sesudah memastikan antreannya masih yang sama, sehingga 'Akhiri antrean' benar-benar menghentikan, perkara yang tersimpan di tab lain tidak kembali 'menunggu', dan dua tab tidak menyimpan perkara yang sama dua kali. Menyusun antrean baru kini bertanya dulu bila antrean lama masih punya perkara yang belum dikerjakan. Tiap perkara yang tertahan menyebut sebabnya sendiri, bukan selalu 'ditahan praperiksa'.",
      "Antrean dari berkas tidak lagi mengaku 'draf' sementara menekan Simpan sendiri: modusnya dipilih (otomatis atau manual) dan layar menyebut terang 'ALETA MENEKAN SIMPAN SIPP SENDIRI'. Tombol 'Lanjutkan ke SIPP' dari ABT kini membuka alamat SIPP tempat panel ALETA muncul.",
      "KETERANGAN SAKSI (SDG): tujuh alasan baru dapat dipilih - temperamental, berkata kasar, bersikap kasar, malas bekerja, tidak memiliki pekerjaan tetap, masalah ekonomi, menikah lagi - masing-masing berbunyi kalimat dari BAS petugas PA Donggala. Penjaga uji menjalankan bot untuk tiap pilihan: yang tidak berbunyi, yang hanya untuk deteksi, dan label berkurung membuatnya merah.",
      "ITSBAT NIKAH: 'Isi dari posita permohonan' tidak lagi mengusulkan 5178, 5105, 1046, 1002, dan 0007 - isian bawaan ABT dari kueri Anda terukur lebih tepat pada perkara yang sama (5178: ABT 0,939, ALETA 0). Kabar panel menyebut kelimanya sebagai tawaran ABT beserta nomor kuerinya, supaya kotaknya dibuka dan diperiksa. Sembilan variabel lainnya tetap diusulkan ALETA. Dispensasi kawin kini mengusulkan KUA yang menolak (5178, 17 benar dari 18), dan tombol perkara lain hanya muncul bila blangko memuat variabel yang siap.",
    ],
  },
  {
    versi: "1.168.0",
    dirilis: "2026-09-26T13:30:00+08:00",
    judul: "Cetak relaas dari Antrian Sidang, unggah putusan yang membaca jawaban SIPP, dan daftar keluaran dari portal",
    butir: [
      "CETAK RELAAS MASSAL. Tombol Cetak relaas di Antrian Sidang ALETA menyerahkan daftar dokumennya ke ekstensi lewat jembatan halaman yang hanya menerima pesan dari portal itu sendiri. Ekstensi memanen tautan blangko dari ABT (token folder dan berkasnya terenkripsi sehingga tidak dapat disusun sendiri), mengambil RTF, meminta PDF dari ALETA, lalu mengunduhnya ke folder 'ALETA relaas <tanggal>/<juru sita>'. Kemajuannya disimpan di chrome.storage.session sehingga pekerja latar yang mati di tengah putaran tidak mencetak ganda. Jarak antardokumen 2-5 detik untuk beban server ABT.",
      "Bila ABT menolak hak akses untuk seluruh blangko, putaran berhenti di dokumen pertama dan menyebut apa yang harus diatur di ABT - bukan menjalani 33 dokumen yang semuanya ditolak. Tombol Perbarui dan Muat ulang ekstensi memperingatkan dulu bila putaran sedang berjalan.",
      "UNGGAH PUTUSAN: nomor perkara dibaca dari nama berkas dalam empat bentuk nyata (6.450 dari 8.614 nama, dulu 0); berkas anonim, BAS, dan PDF/DOC tidak ikut kiriman massal; bukti tersimpan dibaca dari jawaban SIPP sendiri sehingga penolakan tampil dalam 300 ms, bukan sesudah 10 detik jajak; tombol yang disembunyikan SIPP tidak pernah ditekan. Putusan dan anonimisasi dikirim berurutan tanpa jeda tiruan.",
      "ANTREAN PUTUSAN MASSAL TIDAK LAGI MENEKAN SIMPAN bila ada medan yang gagal terisi - janji yang sejak 1.162.0 hanya tertulis di komentar. Medan tambahan satker dari portal juga menahan Simpan otomatis: diisikan, lalu Simpan diserahkan ke petugas.",
      "KARTU MEDAN PILIHAN PUTUSAN OTOMATIS muncul lagi pada blangko yang baru dibuka. Sejak 2.32.0 kurung tutup yang salah letak membuat kartu seperti faktor cerai hanya tergambar bila petugas sudah memilih status yang berbeda dari usulan ALETA - sehingga medan-medan itu tidak pernah terisi.",
      "DAFTAR KELUARAN DARI PORTAL: medan blangko putusan, peta blangko, padanan jenis perkara, dan pilihan alasan saksi kini dibaca dari pengaturan Tipe keluaran di portal dan disinggahkan menurut versinya. Bila portal tidak terjangkau, ekstensi memakai daftar tertanam yang sama persis dengan sebelumnya.",
      "PANEL ABT: tombol 'Input ke ABT' hanya pada blangko cerai; usulan berkeyakinan 'ragu' tidak tercentang sendiri; bunyi upaya damai yang ragu ditampilkan sebagai pilihan wajib; saksi ketiga/keempat dan saksi Tergugat didukung; putusan massal ABT 2 permintaan per perkara (dulu 5) dan mengirim RTF; penolakan 409 disebut sebabnya.",
      "\"BERKAS BELUM TERSIMPAN\" DIPAKAI UNTUK DUA KEADAAN YANG BERBEDA, dan satu di antaranya menyuruh panitera menagih pihak atas berkas yang mungkin sudah lama ada. Kueri catatan berkas di bot dahulu menelan errornya sendiri, sehingga kegagalan membaca catatan jatuh menjadi \"tidak ada berkas\" - keadaan yang tidak dapat dibedakan panitera dari arsip yang memang kosong, dan tidak ada satu baris log yang menyebut sebabnya. Sejak versi ini bot menandainya tersendiri dan panel ALETA di dalam SIPP menuliskannya apa adanya: \"catatan berkasnya tidak terbaca - bukan berarti tidak ada\". Yang tidak diketahui disebut tidak diketahui.",
      "TIGA KEADAAN, TIGA KALIMAT. Dokumen tanpa tombol unduh sekarang dibedakan: belum pernah diunggah pihak (tagih pihaknya), tercatat ada tetapi berkasnya lenyap dari arsip (tarik ulang dari e-Court, jangan tagih siapa pun), dan catatannya tidak terbaca (periksa sambungannya). Ketiganya menuntut perbuatan yang berbeda, dan sebelum ini ketiganya berbunyi sama.",
    ],
  },
  {
    versi: "1.166.0",
    dirilis: "2026-09-23T15:40:00+08:00",
    judul: "Saklar centang yang tercentang tetapi tidak menyala",
    butir: [
      "SAKLAR TERCENTANG TETAPI FITURNYA TIDAK MUNCUL, dan baru muncul sesudah dimatikan lalu dinyalakan lagi. Dilaporkan pada \"Sisipkan berkas ke Jadwal Sidang\", dan sebabnya ternyata mengenai SELURUH saklar penanda halaman. Halaman perkara SIPP memuat isinya bertahap - baris Jadwal Sidang, Data Relaas, dan Data Persidangan datang lewat AJAX beberapa saat sesudah panel ALETA selesai digambar. Ketika baris-baris itu muncul, ALETA memeriksa apakah perlu menggambar ulang, mendapati nomor perkaranya belum berganti, lalu pulang - sehingga penanda dan sisipan hanya pernah terpasang pada isi yang SUDAH ada saat penggambaran pertama. Mematikan lalu menyalakan saklarnya menempuh jalur lain yang memasang penandanya langsung, dan itulah sebabnya ia seolah baru bekerja sesudah diutak-atik.",
      "SELURUH LIMA SAKLAR DIPERIKSA, bukan hanya yang dilaporkan. Keadaan saklar disalin ke memori dan diperbarui pendengar penyimpanan; salinan itu dapat basi tanpa satu pun tanda - tab yang dibekukan peramban tidak menerima pemberitahuan perubahan, dan ekstensi yang dimuat ulang meninggalkan tab lama tanpa pendengar sama sekali. Sekarang salinannya disegarkan sekali tiap putaran penggambaran, dan dua saklar yang menentukan PERBUATAN - cetak tiga berkas dan sunting langsung ABT - dibaca ulang tepat sebelum dipakai. Gagal membaca dianggap MATI, bukan menyala.",
      "JEDA ANTAR-PERKARA PADA ANTRIAN SIDANG kini menyebut nomor antrian tetangganya. Angkanya sudah benar sejak awal, tetapi tidak dapat diperiksa siapa pun: antrian 1 bertulis \"H-35\" sedangkan antrian 2 tepat di bawahnya bertulis \"+4\" - padahal jamnya berjarak 39 menit. Keduanya benar, sebab ada perkara yang dipanggil di antaranya dan tidak ikut tergambar karena daftarnya sedang disaring. Yang tidak tampil pun sekarang dikatakan, bukan didiamkan.",
    ],
  },
  {
    versi: "1.165.0",
    dirilis: "2026-09-23T12:10:00+08:00",
    judul: "Saklar cetak tiga berkas yang tidak menuruti keadaannya, dan unggah putusan yang berhenti sebelum mulai",
    butir: [
      "CETAK TIGA BERKAS TETAP BERJALAN WALAU SAKLARNYA DIMATIKAN. Keadaan saklar disalin ke memori saat panel dibangun, lalu diikuti lewat chrome.storage.onChanged - dan salinan itu dapat basi tanpa satu pun tanda: tab yang dibekukan peramban tidak menerima onChanged, panel yang ditutup lalu dibuka melewati pembacaannya, dan ekstensi yang dimuat ulang meninggalkan tab lama tanpa pendengar sama sekali. Sekarang saklarnya DIBACA ULANG sesudah klik ditahan, sebelum satu berkas pun diterbitkan; bila ternyata mati, tautan CETAK milik ABT dijalankan apa adanya sehingga yang turun satu blangko saja - sebagaimana yang diminta.",
      "UNDUHAN YANG DIBLOKIR PERAMBAN tidak lagi dikira berhasil. Chrome memulangkan id unduhan lalu memblokirnya kemudian sebagai berkas tidak terverifikasi; panel yang hanya membaca id mengira berhasil, dan cara cadangannya tidak pernah dipakai. Keberhasilannya kini dibuktikan sebentar, dan yang terputus turun lewat tautan halaman.",
      "KODE ERROR UNGGAH PUTUSAN diterjemahkan ke kalimat yang dapat dikerjakan. \"akar_sipp_belum_disetel\" yang tampil merah di layar benar sebagai kode dan tidak berguna sama sekali bagi panitera pengganti yang membacanya; sekarang ia berbunyi apa yang tidak dapat dikerjakan ALETA dan siapa yang dapat mengerjakannya.",
      "BERKAS e-COURT DICOCOKKAN LEWAT TANGGAL SIDANG, kata sebagai cadangan. Tiap dokumen kini membawa tanggal sidang bloknya sendiri dari halaman e-Court, sedangkan pencocokan dari kata gagal memisahkan pada 15,6% pasangan (perkara, kata-tahapan) - 304 dari 1.947 punya lebih dari satu baris sidang berkata sama, dan berkas yang sama menempel di semuanya.",
      "CHIP JENIS PERKARA pada kepala panel ABT membaca variabel 0048 (\"Cerai Gugat\", \"Dispensasi Kawin\"), bukan alur dari nomor perkara. Seluruh perkara Pdt.P dulu berbunyi \"Permohonan\" - benar, dan tidak menerangkan apa pun.",
      "PELAKU DAN LAWAN TIDAK LAGI TERTUKAR pada panel saksi SDG. Kesepakatannya pelaku = 0047 (Tergugat/Termohon), dan jalur ini satu-satunya yang mengirimnya terbalik - sehingga jawaban \"siapa yang meninggalkan kediaman bersama\" menyebut pihak yang keliru, dan jawaban itu masuk ke berita acara sidang yang ditandatangani.",
      "TOMBOL CIUTKAN PANEL yang \"tidak bekerja\" ternyata bekerja: panel menciut, lalu klik yang sama menggelembung ke panel dan langsung membentangkannya kembali dalam satu peristiwa. Klik yang berasal dari sebuah tombol kini tidak lagi membentangkan.",
    ],
  },
  {
    versi: "1.164.0",
    dirilis: "2026-09-22T21:10:00+08:00",
    judul: "Putusan RTF diterima, dan tata letak layar Antrian Sidang dirapikan",
    butir: [
      "PUTUSAN RTF TIDAK LAGI DITOLAK. Penolakan \"bukan PDF\" yang saya tambahkan kemarin dicabut - aturannya saya karang sendiri tanpa memeriksa datanya. Diukur pada perkara_putusan.amar_putusan_dok satker, 9.903 nilai terisi: .rtf 8.686 (87,7%), .docx 458, .doc 442, .pdf hanya 315 (3,2%). PDF justru yang paling jarang, dan menyaring ke PDF saja menolak 96,8% naskah yang sah.",
      "Yang diterima sekarang RTF, DOC, DOCX, dan PDF. PDF untuk Direktori Putusan dibuat bot sendiri; naskah aslinya tetap tersimpan sebagai e-Doc - persis cara SIPP. Saringan di panel hanya tinggal menolak bentuk yang memang tidak dapat dipakai sama sekali.",
      "KOTAK PENCARIAN TIDAK LAGI SELEBAR LAYAR, dan tombol Pencarian lanjutan duduk di sebelahnya bersama angka \"x dari y\" serta Reset. Kotak selebar layar menjanjikan isian sepanjang itu, padahal yang diketik orang nomor perkara atau satu nama.",
      "PERKARA SAYA, TAMPILAN, RINGKAS/LENGKAP, DAN CIUTKAN pindah ke kanan baris judul - satu baris lebih hemat di atas daftar sidang.",
      "BARIS TOMBOL TINDAKAN DAPAT DICIUTKAN SENDIRI lewat ikon, terpisah dari tombol Ciutkan yang menyembunyikan seluruh kendali. Yang diciutkan barisnya benar-benar hilang, sehingga deretan kotak penanda naik menempati tempatnya. Ikon pembentangnya pindah ke deretan itu supaya jalan kembalinya tidak ikut hilang.",
      "TOMBOL LAYAR RUANG TUNGGU berganti nama dari \"Tampilan\" menjadi \"Layar antrian\". Dua tombol sewarna dan sebentuk dengan satu nama pada layar yang sama, mengerjakan hal yang berbeda sama sekali.",
      "SALURAN PANGGILAN \"Pengumuman\" ditambahkan - radio, media massa, papan pengumuman pengadilan, papan pengumuman Pemda. Keempatnya dulu jatuh ke salah satu dari tiga nama yang ada, paling sering ke \"Elektronik (e-Summons)\".",
    ],
  },
  {
    versi: "1.163.1",
    dirilis: "2026-09-22T14:20:00+08:00",
    judul: "Unggah putusan yang selalu ditolak, dan status putusan yang ditimpa diam-diam",
    butir: [
      "UNGGAH PUTUSAN SELALU DITOLAK \"perkara_id belum disebut.\" dari halaman perkara agama - setiap kali, tanpa kecuali. Sebabnya bukan berkas yang salah pilih: perkaraIdDariHalaman() membaca input[name=\"perkara_id\"] di dalam #frm_putusan, dan medan itu TIDAK PERNAH ADA di sana. SIPP mengenali perkara pada blangko Putusan Akhir lewat `enc` - nomor perkara tersandi - dan perkara_id hanya dipakai pada blangko grasi dan peninjauan kembali. Rute saudaranya (unggah naskah) sudah lama menanyakannya sendiri ke SIPP bila kosong; rute unggah berkas tidak pernah diberi jalan mundur yang sama. Itu sebabnya yang satu bekerja dan yang lain selalu gagal dari halaman yang sama.",
      "BERKAS BUKAN PDF DITOLAK DI PANEL, bukan sesudah bolak-balik ke server. Bot menolak apa pun yang empat bita pertamanya bukan %PDF - dikenali dari bitanya, bukan dari nama berkasnya - sebab yang terbit di Direktori Putusan harus PDF dan ALETA sengaja tidak menjalankan pengubah soffice seperti SIPP: pengubahan yang gagal separuh menghasilkan berkas rusak yang sudah terlanjur publik. Atribut accept pada pemilih berkas hanya SARAN; yang memilih \"All files\" tetap dapat memilih .rtf, dan itulah yang terjadi.",
      "STATUS PUTUSAN YANG SUDAH ANDA PILIH TIDAK LAGI DITIMPA. Sampai 1.162.0 panel menuliskan Status Putusan usulan ALETA ke blangko tanpa melihat apa yang sudah ada di sana. Petugas yang sudah memilih \"Dicabut\" mendapati pilihannya berganti sendiri menjadi usulan ALETA - yang pada sebagian besar perkara berbunyi \"Dikabulkan\". Akibatnya bukan tampilan: status putusan yang keliru tersimpan ke perkara orang, lalu mengalir ke laporan dan ke Direktori Putusan. Lebih buruk lagi, praperiksa sudah dijalankan SEBELUMNYA atas status yang lama, jadi status baru itu tidak pernah diadu dengan amar drafnya oleh siapa pun.",
      "Sekarang pintunya hanya diisi bila memang BELUM dipilih. Yang sudah berisi dibiarkan apa adanya, dan bila usulan ALETA berbeda, selisih itu DISEBUTKAN merah beserta keterangan bahwa praperiksa berpegang pada pilihan yang sekarang ada di blangko.",
      "PENYELIDIKAN KEBERADAAN MEDAN NASKAH DICABUT - premisnya salah. 1.162.0 mengira blangko putusan tidak punya Pertimbangan Hukum dan Amar Anonim pada status selain Dikabulkan. Koreksi pengguna dan sumber SIPP-nya sendiri sama-sama membantahnya: keenam medan itu selalu ada; yang disembunyikan justru medan PILIHAN (verstek, qobla, faktor perceraian, nusyuz, keadaan istri), dan disembunyikannya dengan jQuery .hide() sehingga elemennya TETAP di DOM. Penyelidikan itu karena itu tidak pernah dapat bekerja - ia hanya memberi kalimat yang terdengar pasti atas sesuatu yang tidak diperiksa. Penyaring yang benar sudah lama ada dan memang memeriksa yang seharusnya.",
      "SAKLAR PANEL RINGKAS di samping deretan pintasan Alt. Menyembunyikan keterangan panjang yang dibaca sekali seumur hidup; tombol, isian, dan pesan error TETAP tampil. Yang disembunyikan hanya kalimat yang sudah ditandai satu per satu dengan tangan - bukan seluruh kelas keterangannya, sebab separuh pemakaian kelas itu kotak kabar yang lahir kosong lalu diisi pesan error, dan menyembunyikannya membuat panel diam ketika sesuatu gagal.",
      "Dua peubah warna yang TIDAK PERNAH ADA sempat dipakai tombol saklarnya - --aleta-latar-lembut dan --aleta-aksen. Akibatnya tombol itu tidak berbunyi apa pun: tidak berubah saat disentuh, dan tidak berubah saat menyala, sebab peubah yang tidak terdefinisi jatuh ke transparan dan ke warisan induknya. Tidak ada satu error pun yang muncul; yang menemukannya penjaga peubah warna panel.",
      "BERKAS JAWAB-MENJAWAB AKHIRNYA TERLIHAT. Jawaban, replik, duplik, duplik rekonvensi, kesimpulan, dan fotokopi alat bukti sudah lama ditarik ALETA dari e-Court - yang membuatnya tampak tidak ada adalah tombol unduhnya yang disembunyikan: ada tidaknya berkas dibaca dari kolom cermin yang basi (terisi pada 23 dan 8 dari 394 dokumen) sementara tabel berkasnya mencatat seluruh 400. Sekarang dibaca dari tabel berkasnya, dan keberadaan berkasnya di cakram ikut dibuktikan - yang tercatat ada tetapi hilang dari arsip disebut apa adanya, bukan disamakan dengan yang tidak pernah ada.",
      "DOKUMEN E-COURT DIPISAH menjadi \"Berkas jawab-menjawab\" dan \"Berkas pendaftaran\", yang dicari hakim lebih dulu. Pemisahnya tanda yang SIPP dan e-Court sendiri pakai, bukan tebakan dari judulnya.",
      "AGENDA REKONVENSI didahulukan atas agenda konvensinya pada pencocokan berkas ke baris Jadwal Sidang. \"Duplik Rekonvensi\" juga cocok dengan pola duplik biasa, dan tertukarnya tidak berbunyi apa pun: kotaknya tetap terisi, isinya saja milik tahapan lain.",
      "SAKLAR \"Sisipkan berkas ke Jadwal Sidang\" DISEBUTKAN di panel. Kemampuan menempelkan berkas ke baris Jadwal Sidang - di samping tombol Unggah BAS, dicocokkan menurut agendanya - sudah ada sejak lama, tetapi saklarnya mati sejak awal dan tidak ada satu pun tempat yang menyebutkannya. Fitur yang tidak diketahui sama dengan fitur yang tidak ada.",
    ],
  },
  {
    versi: "1.162.0",
    dirilis: "2026-09-22T13:10:00+08:00",
    judul: "Putusan cabut dan gugur: blangkonya memang tidak punya semua bagian",
    butir: [
      "SIPP MENYUSUN HALAMAN PUTUSAN AKHIR BERBEDA MENURUT STATUSNYA. Perkara yang dicabut, gugur, tidak dapat diterima, digugurkan, atau ditolak tidak selalu punya Pertimbangan Hukum maupun Amar Anonim di halamannya - dan itu memang benar, bukan halaman yang rusak.",
      "SAMPAI VERSI SEBELUMNYA PANEL MENGGAMBAR KETIGANYA APA PUN STATUSNYA, lalu mencoba mengisi bagian yang tidak ada. Jembatan menjawab \"medan tidak ketemu\", panel menghitungnya sebagai GAGAL, dan pagar \"selama masih ada yang gagal Simpan tidak ditekan\" menghentikan seluruh pengisian - tepat pada jenis perkara yang paling sederhana dan paling banyak jumlahnya. Yang terbaca petugas hanya \"2 gagal\", tanpa satu pun keterangan bahwa bagiannya memang tidak ada.",
      "SEKARANG BLANGKONYA DITANYA LEBIH DULU. Yang tidak ada tidak digambar, dan ketiadaannya disebutkan beserta status putusan yang sedang terpilih - supaya yang membacanya tahu sebabnya, bukan menyangka alatnya rusak.",
      "YANG TIDAK BOLEH DILEWATI DIAM-DIAM: draf yang BERISI sesuatu untuk bagian yang tidak ada di blangko. Isi itu tidak akan pernah sampai ke SIPP. Pada panel satu perkara ia menjadi peringatan merah; pada antrean massal perkaranya DITAHAN, tidak dilewati - draf yang memuat pertimbangan sementara blangkonya tidak punya tempatnya berarti salah satu di antara keduanya keliru, kemungkinan besar statusnya.",
      "PERKARA YANG TERSIMPAN MENYEBUT BAGIAN YANG TIDAK ADA DI BLANGKONYA. Tanpa itu, \"tersimpan\" pada perkara cabut terbaca seolah ketiga bagian naskahnya tertulis - padahal blangkonya hanya punya satu.",
      "PAGARNYA TIDAK DILONGGARKAN. Yang dihapus kegagalan PALSU, bukan pagarnya: blangko yang sungguh gagal terisi tetap tidak disimpan.",
    ],
  },
  {
    versi: "1.161.1",
    dirilis: "2026-09-22T10:35:00+08:00",
    judul: "Error yang menumpuk diam-diam tiap halaman ABT dibuka",
    butir: [
      "ReferenceError TDZ pada pemasangan panel massal ABT. Bunyinya di chrome://extensions, berulang tiap halaman ABT dibuka: \"Cannot access 'sudahDipasangMassalAbt' before initialization\". Sebabnya urutan, bukan logika - fungsinya dipanggil di tingkat atas berkas, sementara let yang dibacanya baru dideklarasikan ratusan baris di bawah. Deklarasi function terangkat ke atas sehingga pemanggilannya sah; deklarasi let tidak - ia ada tetapi belum boleh disentuh sampai barisnya sendiri dijalankan.",
      "PANELNYA TETAP MUNCUL, dan itulah yang membuatnya tidak pernah terlihat. Ada gelung ulangan yang memanggilnya lagi, dan pada panggilan kedua barisnya sudah lewat. Tidak ada satu pun gejala di layar - yang tersisa hanya satu error di daftar Chrome tiap halaman ABT dibuka. Justru itu bahayanya: lencana merah yang selalu menyala membuat error SUNGGUHAN berikutnya tenggelam, sebab tidak ada yang membuka daftar yang memang selalu merah.",
      "ADA SEJAK commit putusan massal - bukan dari perubahan hari ini; diperiksa pada tiga commit terakhir dan ketiganya sama. Baru ketahuan ketika daftar error itu kebetulan dibuka.",
      "Deklarasinya dipindah ke ATAS pemanggilnya, bukan diubah menjadi var. var memang terangkat, tetapi ia mengangkat pula kebiasaan lama yang sudah ditinggalkan berkas ini.",
      "PENJAGA BARU menyisir kedelapan berkas ekstensi untuk pola yang sama - fungsi tingkat atas yang membaca let/const yang belum lahir - dan ia sendiri diuji atas contoh buatan, supaya penjaga yang regexnya patah tidak diam-diam selalu hijau.",
    ],
  },
  {
    versi: "1.161.0",
    dirilis: "2026-09-22T08:05:00+08:00",
    judul: "Unggah putusan: tidak lagi menyerah di tengah, tidak lagi antre satu per satu",
    butir: [
      "BATAS WAKTU YANG MENYEBABKAN \"ERROR DAN TIDAK MAU TERUPLOAD\". Ekstensi menyerah pada detik ke-45 sementara gerbangnya memberi bot 60 detik - jadi unggahan yang memakan 45 sampai 60 detik dibatalkan di layar, petugas melihat error, dan botnya TERUS BEKERJA. Komentar pada gerbang itu sendiri sudah menyebut akibatnya: meninggalkan berkas yang sudah tertulis tanpa barisnya. Anonimisasi paling sering kena, dan sebabnya aritmetika - putusan dan anonimisasi dikirim dalam SATU permintaan, jadi bitanya dua kali lipat, dan yang dua kali lipat itulah yang menyeberangi garis 45 detik. Batasnya kini 90 detik dan terpisah dari batas unggah naskah.",
      "BATAS ABT IKUT DIBETULKAN. Ia dahulu 60000 - PERSIS SAMA dengan gerbangnya, tanpa selisih sama sekali, sehingga keduanya menyerah pada saat yang sama. Urutan batas waktu harus menaik dari dalam ke luar: bot, gerbang, lalu ekstensi.",
      "PEMERIKSAAN DRAF BERBARENGAN, ENAM SEKALIGUS. Dahulu berurutan - satu perkara harus selesai sebelum berikutnya dimulai - dengan komentar yang menyebutnya \"satu permintaan ringan per perkara\". Ringan ia tidak: rutenya memulangkan SELURUH draf. Pada dua puluh perkara itu sepuluh detik menunggu sebelum satu baris pun dapat dicentang. Enam sekaligus, bukan seluruhnya: dua puluh permintaan serentak lewat satu gerbang menukar menunggu dengan menumpuk.",
      "DRAF TIDAK LAGI DITARIK DUA KALI. Pemeriksaan menarik seluruh draf lalu membuangnya, menyimpan hanya ada/tidak - lalu pengisian blangko menariknya LAGI utuh. Sekarang jawabannya disimpan apa adanya.",
      "UNGGAH PUTUSAN DARI HALAMAN ABT, untuk perkara yang sedang dibuka. Seluruh rangkaiannya sudah ada - RTF dari blangko, draf, PDF, anonim, unggah - tetapi hanya dapat dipanggil dari dalam antrean massal, dan antrean itu selalu bermula dari tanggal sidang. Petugas yang membuka satu perkara harus menyusun antrean sehari penuh lalu mencentang satu baris. Panel baru ini pintunya, dan ia TIDAK menyalin satu baris pun logika unggah - dua salinan akan lambat laun berbeda, dan yang berbeda diam-diam adalah yang menulis ke SIPP.",
      "BLANGKONYA DIPILIH, BUKAN DITEBAK. Halaman ABT tidak menyebut jenis perkaranya dalam bentuk yang dapat dibaca pasti; blangko yang salah menghasilkan putusan yang salah bentuknya, dan itu baru ketahuan sesudah tercetak. Daftarnya hanya memuat blangko yang memang sudah dipetakan.",
      "PUTUSAN MASSAL DARI BERKAS. Pilih beberapa naskah sekaligus; nomor perkaranya dibaca dari NAMA berkas, seluruh pasangan diperlihatkan untuk diperiksa, baru ditekan. Sebelum ini tidak satu pun pemilih berkas di ekstensi menerima lebih dari satu berkas, dan berkas tidak pernah dicocokkan dengan perkaranya - nomornya selalu datang dari halaman yang sedang terbuka.",
      "YANG TIDAK TERBACA TIDAK DITEBAK. Berkas yang nomor perkaranya tidak terbaca dari namanya ditandai dan dilewati - bukan dipasangkan ke perkara terdekat. Memasangkan naskah putusan ke perkara yang salah berarti putusan orang lain masuk ke berkas orang ini, dan itu tidak dapat dibatalkan dengan menekan ulang.",
    ],
  },
  {
    versi: "1.160.0",
    dirilis: "2026-09-22T05:45:00+08:00",
    judul: "Pratinjau penetapan menyebut tanggal, ruang sidang, dan pejabat penetapnya",
    butir: [
      "TIGA DARI EMPAT hal yang dapat dipilih tangan tidak pernah terbaca sebelum ditekan. Diperiksa satu per satu: pejabat penetap hanya muncul bila BERMASALAH, tanggal penetapan tidak pernah dipajang sama sekali, ruang sidang pun tidak - padahal ruang sidang sudah DIKIRIM ke mesin tulis sejak lama. Ketiganya kini menjadi baris tersendiri di pratinjau.",
      "RUANG SIDANG yang paling merugikan selama ini: gagalnya diam. Penetapannya berhasil, berkasnya tercetak, sidangnya digelar - dan laporan sidang keliling menghitung nol, ketahuan berbulan kemudian oleh penyusun laporan. Namanya yang dipajang, bukan nomornya: \"3\" tidak memberi tahu siapa pun ruangan mana yang dimaksud. Daftar ruangan yang belum terbaca dikatakan apa adanya, bukan disamarkan menjadi nomor yang tampak pasti.",
      "PEJABAT PENETAP tiap langkah disebut dengan NAMA beserta AKUN SIPP-nya, misalnya \"Fahri Saifuddin, S.H.I., M.H. (ketua)\". Akunnya ikut disebut sebab itulah yang mendarat di kolom pengguna dan di sys_audittrail - kalau pemetaan jabatan ALETA keliru, ketahuannya di sini, sebelum tertulis.",
      "YANG DIPILIH TANGAN DITANDAI \"pilihan Anda\"; yang dari mesin tidak. Tanpa tanda itu, petugas yang baru saja memilih pejabat lain tidak punya cara memastikan pilihannya sampai - dan pilihan yang tidak sampai tidak berbunyi apa pun.",
      "SESUDAH EKSEKUSI tanggalnya diulang pada tiap langkah yang berhasil. Yang sudah tertulis ke SIPP tidak dapat dilihat lagi dari panel tanpa membuka SIPP, sehingga yang ingin memastikan apa yang barusan terjadi harus berpindah aplikasi.",
      "Hari sidang yang dipajang tetap diambil lewat idUntukTulis - sumber yang SAMA dengan yang ditulis. Dua perhitungan terpisah berarti pratinjau yang benar sendiri dan tulisan yang benar sendiri, dan bedanya hanya ketahuan sesudah tertulis.",
    ],
  },
  {
    versi: "1.159.1",
    dirilis: "2026-09-21T20:55:00+08:00",
    judul: "Tombol tata letak saksi mengikuti lantai keterbacaan panel",
    butir: [
      "TOMBOL TUKAR TATA LETAK SAKSI dinaikkan dari 11px ke 11,5px - lantai keterbacaan panel ini, yang dijaga ekstensi-pita-identitas.test.ts. Lantainya bukan selera melainkan hasil penyisiran ketika seluruh huruf panel dibesarkan, dan tombol baru yang diam-diam lebih kecil daripada tetangganya adalah cara paling mudah memulangkan panel ini ke keadaan yang dahulu sudah diperbaiki.",
      "Nomornya dinaikkan, bukan ditanam ulang di bawah 1.159.0: salinan 1.159.0 sudah sempat sampai ke folder yang dimuat Chrome sebelum ujinya merah. Chrome membandingkan NOMOR VERSI, bukan isinya - menanam isi berbeda di bawah nomor yang sama membuat salinan lama tidak akan pernah diperbarui, dan diamnya tidak berbunyi apa pun di layar.",
    ],
  },
  {
    versi: "1.159.0",
    dirilis: "2026-09-21T20:30:00+08:00",
    judul: "Keterangan dua saksi: berdampingan atau atas-bawah, dipilih sendiri",
    butir: [
      "BERDAMPINGAN MENJADI TAMPILAN AWAL pada penyunting keterangan dua saksi. Sebelumnya bawaannya atas-bawah, dan berdampingan hanya terjadi bila panelnya dilebarkan lebih dulu - padahal yang menyunting keterangan saksi sedang membandingkan jawaban saksi 1 dengan saksi 2 baris demi baris, dan perbandingan itulah pekerjaannya. Atas-bawah memaksanya menggulung bolak-balik di antara dua daftar yang isinya sengaja mirip.",
      "TOMBOL TUKAR TATA LETAK di ujung kanan kepala bagian itu. Tulisannya menyebut yang AKAN terjadi bila ditekan - \"Jadikan atas-bawah\" - bukan keadaan sekarang: tombol yang menyebut keadaan dibaca separuh orang sebagai keadaan dan separuh lagi sebagai tindakan, lalu ditekan dua kali.",
      "PILIHANNYA DIINGAT per peramban lewat chrome.storage.local, bukan per perkara: ia tentang cara orang itu bekerja, bukan tentang perkaranya. Gagal membacanya jatuh ke berdampingan, bukan ke error - tata letak yang salah tidak pantas menghentikan penyuntingan.",
      "TOMBOLNYA DI LUAR wadah kolom, dan itu bukan kebetulan: wadah itu dikosongkan tiap kali baris keterangan digeser, disalin, atau dihapus, sehingga tombol yang duduk di dalamnya akan lenyap pada penggeseran pertama.",
      "KOLOMNYA MEMAKAI minmax(0, 1fr), bukan 1fr. Kolom grid berlebar auto tidak mau mengecil di bawah lebar isinya, dan satu jawaban panjang tanpa spasi akan melebarkan kolomnya melewati panel - membawa gulir mendatar ke seluruh panel, bukan hanya ke kolom itu.",
      "Kelas panel penuh/lebar tidak lagi ikut menentukan tata letaknya: ia mengubah LEBAR, bukan pilihan orangnya.",
    ],
  },
  {
    versi: "1.158.1",
    dirilis: "2026-09-21T16:05:00+08:00",
    judul: "Panel yang diciutkan dapat dibuka lagi, dan unduhan tidak lagi bernama download",
    butir: [
      "PANEL TERCIUT DAPAT DIBUKA KEMBALI di halaman ALETA dan ABT. Sebelumnya lencananya diklik dan tidak terjadi apa-apa - satu-satunya jalan mengembalikannya adalah memuat ulang halaman. Sebabnya bukan panel yang hilang melainkan kliknya yang mati: perkakas geser menangkap penunjuk pada panel di setiap tekanan, dan selama tangkapan itu berlaku peramban membelokkan click serta dblclick ke elemen PENANGKAP. Pendengar yang membentangkan panel terpasang pada anaknya, dan peristiwa yang mendarat di induk tidak pernah turun ke anak. Tidak ada satu pun error yang tercatat - itu sebabnya ia bertahan lama.",
      "HALAMAN SIPP TIDAK PERNAH TERKENA, dan itu bukan kebetulan: panel SIPP digeser dengan mousedown dan tidak pernah menangkap penunjuk. Yang terkena hanya ALETA dan ABT, yang berbagi satu berkas perkakas - persis seperti yang dilaporkan.",
      "TANGKAPAN PENUNJUKNYA TIDAK DIBUANG. Menundanya sampai ambang empat piksel terlewati sudah dicoba dan DITOLAK sesudah diukur di peramban sungguhan: kliknya memang sembuh, tetapi tarikan JAUH mati sama sekali - tanpa tangkapan, gerakan hanya sampai ke panel selama penunjuk masih di atasnya, dan lencana hanya 54 piksel. Terukur: tarikan pendek di dalam lencana berpindah, tarikan ke seberang layar tidak bergerak satu piksel pun. Yang dipindahkan karena itu pendengarnya, ke elemen yang memang menerima kliknya.",
      "MENGGESER LENCANA TIDAK LAGI MENGHAPUS KEADAANNYA. Penyimpanan posisi mengganti seluruh catatannya alih-alih menggabungkan, dan bentuk lamanya tidak menyertakan penanda lencana - sehingga sekali lencana digeser, penanda itu lenyap dan lebarnya terisi 52, yaitu ukuran lencana. Panel yang ditinggalkan terciut lalu terbentang sendiri pada pemuatan berikutnya, seukuran lencana.",
      "PENDAFTARAN GESER GANDA DIBUANG. Perkakasnya dipasang dua kali pada panel yang sama, sebab argumen keduanya hanya dipakai sebagai pagar - bukan sebagai tempat pendengar. Akibatnya tiap tarikan menjalankan dua salinan logika yang sama dan menulis posisinya ke penyimpanan dua kali.",
      "UNDUHAN LEWAT PANEL BERNAMA BENAR, tidak lagi \"download (11).rtf\". Namanya sudah disusun dan sudah diserahkan kepada peramban, tetapi hilang sesudahnya: unduhan ekstensi beralamat data: dan TANPA rujukan halaman, sehingga penamaan ulang milik ekstensi sendiri - yang mengenali unduhan ABT dari alamatnya - mundur dan membiarkan nama bawaan peramban dipakai. Terbaca dari riwayat unduhan: sembilan dari sembilan unduhan beratribut ekstensi bernama download, sedangkan berkas yang SAMA yang turun lewat tautan halaman bernama benar.",
      "UNDUHAN MASSAL IKUT BERNAMA BENAR, bukan hanya berkas pertamanya. Nama yang menunggu disimpan pada SATU slot yang dihapus begitu dipakai, dan unduhan massal melanggar dua andaian di baliknya sekaligus: beberapa unduhan dapat lahir sebelum yang pertama sempat dinamai sehingga slotnya tertimpa, dan pekerja latar MV3 mati kira-kira tiap tiga puluh detik sedangkan unduhan massal berjalan bermenit-menit - variabel modulnya hilang di tengah jalan tanpa satu pun error. Gantinya antrean yang disimpan di penyimpanan sesi: ia selamat dari pekerja yang mati dan memuat lebih dari satu nama. Yang kedaluwarsa lima menit dibuang, sebab unduhan yang batal tidak pernah mengambil namanya - dan nama yang tertinggal akan dipakai berkas BERIKUTNYA, yang lalu salah nama diam-diam.",
      "NAMA PANJANG DIPOTONG PADA BATANGNYA, bukan dari belakang. Pemotongan 180 huruf yang lama memakan akhiran .rtf maupun .pdf-nya, dan berkas tanpa akhiran tidak dapat dibuka dengan dua ketukan. Belum menggigit selama namanya pendek - tetapi ia menunggu di jalur yang sama begitu jenis perkara dan status putusan sungguh ikut pada namanya.",
    ],
  },
  {
    versi: "1.157.1",
    dirilis: "2026-09-18T11:20:00+08:00",
    judul: "Tab Berkas dan Perkara tidak lagi memajang keadaan sebelum ALETA menulis",
    butir: [
      "SIMPANAN KEADAAN PERKARA DIBATALKAN SESUDAH MENULIS. Seluruh menu panel - Berkas, Perkara, Putusan - membaca satu simpanan yang sama, dan itulah yang membuat mereka sepakat. Simpanan itu dahulu hanya dibuang ketika pengambilannya GAGAL, tidak ketika penetapan atau Data Umum BERHASIL ditulis - padahal justru saat itulah ia menjadi salah. Yang terlihat petugas: tab Berkas dan tab Perkara menyebutkan hal yang berbeda tentang perkara yang sama, dan tidak satu pun cocok dengan yang baru saja ia kerjakan. Tidak ada error yang berbunyi; datanya memang terbaca, hanya terbaca dari sebelum pekerjaan itu terjadi.",
      "MENU YANG SUDAH TERBUKA IKUT DIGAMBAR ULANG. Membuang simpanan saja hanya menolong menu yang belum dibuka - yang sudah terbentang sudah selesai menggambar dan tidak akan mengambil apa pun lagi. Padahal menu terbentang itulah yang paling dilihat orang sesudah menulis. Yang tertutup cukup ditandai belum dimuat: menggambar ulang menu tertutup berarti memanggil ALETA untuk sesuatu yang tidak sedang dilihat siapa pun.",
      "UJI KERING TIDAK MEMBATALKAN APA PUN, dan nomor perkaranya dicocokkan - menulis pada perkara A tidak membuang simpanan perkara B yang sedang dibaca di tab sebelah. Satu-satunya jalan memperbaikinya dahulu adalah menutup lalu membuka halaman SIPP, dan tidak ada apa pun di layar yang menyarankan itu.",
    ],
  },
  {
    versi: "1.157.0",
    dirilis: "2026-09-17T15:10:00+08:00",
    judul: "Nama berkas yang menyebut perkaranya, dan lencana yang terbuka seketika",
    butir: [
      "NAMA BERKAS UNDUHAN: nomor perkara - jenis perkara - status putusan, pada KEDUA jalur unduhan. Sebelumnya di tempat jenis perkara berdiri potongan kepala halaman blangko - yang bukan jenis perkara, berubah tiap halaman, dan hilang sama sekali ketika kepalanya tidak terbaca. Berkas anonimisasi tetap berpenanda \"anonim\" di ujungnya: tanpa itu ia bernama persis sama dengan putusannya dan menimpanya.",
      "JENIS PERKARA DAN STATUS PUTUSAN KINI ADA DI HALAMAN SATU PERKARA. Papan massal sudah lama menerima keduanya bersama daftar sidang, tetapi membuang jenis perkaranya; halaman satu perkara tidak punya sumbernya sama sekali - tidak ada satu pun permintaan yang memulangkannya. Keduanya kini ditumpangkan pada permintaan usulan yang memang sudah berjalan, bukan pada perjalanan baru: panel ABT punya anggaran waktu yang ketat.",
      "LENCANA YANG DIBENTANGKAN KEMBALI TIDAK LAGI TERTAHAN. Panel yang diciutkan menyembunyikan seluruh anaknya, sehingga membukanya kembali menata ulang SEMUA isinya sekaligus. Diukur atas replika panel, 25 putaran tiap ukuran: 200 simpul 7,90 menjadi 1,20 milidetik; 2.000 simpul 87,60 menjadi 15,10; 5.000 simpul 265,90 menjadi 35,90 - dan yang terburuk 565,80 menjadi 82,70. Daftar blangko ABT sendiri memuat ratusan kartu, dan di sanalah tertahannya paling terasa.",
    ],
  },
  {
    versi: "1.155.0",
    dirilis: "2026-09-16T16:00:00+08:00",
    judul: "Satu tema, dan jalan pulang untuk panel yang disingkirkan",
    butir: [
      "SATU TEMA UNTUK SEMUANYA: jendela popup, panel SIPP, panel ABT, dan panel di portal ALETA. Tombol tema yang mana pun menggerakkan keempatnya - beserta tema portal itu sendiri. Pilihan \"ikut sistem\" pada popup menjadi \"ikut ALETA\": panel bawaannya gelap sementara Windows di meja hampir selalu terang, dan itulah jendela putih menyilaukan yang muncul di atas SIPP yang gelap.",
      "DAFTAR PILIHAN SELECT2 DI TINGKAP SIPP IKUT GELAP. Diukur pada replika markup blangko Data Umum dengan berkas gaya yang sekarang terpasang: badan tingkapnya sudah gelap, tetapi kotak dan daftar select2 masih rgb(255,255,255) - dan kotak carinya putih di atas putih. Sebabnya select2 menyatakan putihnya lewat NAMA KELAS, sedangkan pemburuan putih selama ini menyasar gaya sebaris. Baris yang sedang disorot dibuat hijau tua, supaya tombol panah tetap dapat dipakai.",
      "ESCAPE DAN KLIK DUA KALI KEMBALI MENCIUTKAN di SIPP dan ABT. Di SIPP keduanya memang tidak pernah terpasang. Di kedua halaman, syarat lamanya juga hampir selalu menahan: satu klik pada kolom blangko mana pun membuat fokus tinggal di isian halaman, dan isian yang berfokus membungkam Escape. Sekarang hanya isian DI DALAM panel yang membungkamnya - dan tingkap halaman yang sedang terbuka tetap memegang Escape-nya sendiri.",
      "PANEL YANG DITUTUP DAPAT DIBUKA LAGI. × di ABT dan di portal ALETA kini mematikan saklar induk, sama seperti di SIPP, sehingga kotak centang di popup menjadi jalan pulangnya - seketika, tanpa memuat ulang halaman yang sedang dikerjakan. Tombol Kembalikan posisi panel menjangkau keempat panel dan membentangkan yang terciut. Dua cacat lama ikut tertutup: tombol segarkan di kaki panel ABT yang menghapus panelnya untuk selamanya, dan Alt+A di ABT yang menyimpan keadaan lencananya ke kunci yang tidak pernah dibaca siapa pun.",
      "TANGGAL DARI KALENDER TAMPAK DI DAFTAR HARI SIDANG, sebagai baris tambahan paling atas dan bertanda asalnya. Sebelumnya daftar itu hanya memuat empat hari sidang majelis, sehingga tanggal pilihan sendiri tidak terlihat di sana - dan yang membacanya menyangka pilihannya tidak terpakai.",
    ],
  },
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
      "Di sisi server (2.19.5): jam tiap langkah penetapan dihitung sampai detik dan disebar pada pagi hari, dan jejak Smart Majelis di Audit Trail ditulis persis seperti tangan petugas.",
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
      "KALENDER HARI SIDANG TIDAK LAGI TERKUNCI. Batas lamanya tanggal usulan, sehingga seluruh tanggal sebelumnya - termasuk hari ini - kelabu dan tidak dapat ditekan. Kini batasnya hari ini, dan jeda minimal menurut SK menjadi peringatan yang dibaca. Kunci yang memaksa petugas kembali mengetik di blangko SIPP bukan penjagaan.",
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
      "Berkasnya tidak melintasi jaringan lagi - ia sudah ada di memori peramban, diambil lewat permintaan yang sama yang dipakai panel untuk membacanya. Yang berpindah hanya siapa yang menuliskannya ke cakram. Bila jalur itu gagal, ia jatuh ke cara lama: unduhan yang tertahan peringatan masih jauh lebih baik daripada unduhan yang tidak terjadi. Perbaikan yang sesungguhnya tetap HTTPS di server.",
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
      "Akibatnya menimpa orang yang paling sering memakainya: petugas yang seharian di ABT tidak pernah membuka SIPP, jadi popupnya memakai alamat yang tercatat entah kapan. Sesudah pindah server, alamat itu menunjuk mesin yang sudah mati - dan yang terbaca di layar adalah tuduhan kepada portal, bukan keterangan tentang alamat yang basi.",
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
      "CERAI TALAK SELAMA INI MENGAMBIL BLANGKO DARI MENU CERAI GUGAT, dan tidak ada satu pun error yang berbunyi. Sebabnya: pencarian token bekerja atas NAMA BERKAS, dan \"[01] [Kabul Verstek] Cerai (Format Lengkap).rtf\" ADA DI KEDUA folder - \"1 Perceraian CG\" dan \"1a Perceraian CT\". Diukur pada blangko server: keduanya identik sampai bita terakhir (143.721 bita, md5 sama). Di ABT menu Cerai Gugat berdiri lebih dahulu, jadi talak selalu mendarat di sana.",
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
      "BAHASA: lencana \"SERVER\" menjadi \"SERVER\", dan \"Susun rencana (kering)\" menjadi \"Periksa dulu - belum dijalankan\". \"Kering\" istilah pemrogram; yang menekannya panitera, dan yang perlu dijawab tombol itu satu - apakah menekannya mengubah sesuatu atau tidak.",
    ],
  },
  {
    versi: "1.135.0",
    dirilis: "2026-09-14T12:15:00+08:00",
    judul: "Bawaan blangko dispensasi kawin diperbaiki menurut server",
    butir: [
      "DISPENSASI KAWIN -> \"[01] [Kabul] DK - (Anak P Cewek) Hamil\". Bawaan sebelumnya \"DK (Full) Perempuan Hamil V.2\" adalah nama dari ABT setempat (salinan PA Bungku) dan sejak hari pertama ditandai \"periksa namanya di server\". Diperiksa langsung di folder blangko server 14 September 2026: nama itu tidak ada di sana sama sekali, jadi putusan massal dispensasi akan berhenti pada \"berkas tidak ditemukan\" tanpa ada yang tahu sebabnya. Kini namanya yang sungguh ada di server.",
      "ADA DUA VARIAN KABUL yang berdampingan di server: anak perempuan yang hamil, dan anak laki-laki yang calon istrinya hamil. Keduanya jenis perkara yang SAMA di SIPP, jadi bawaan hanya dapat menyebut satu - yang lain dipilih per perkara lewat pilihan blangko pada daftar putusan massal. Catatan pemetaan menyebutkan nama varian satunya supaya tidak perlu dicari sendiri di ABT.",
      "Bawaan cerai dan itsbat diperiksa pada folder yang sama dan keduanya sudah tepat - tidak diubah.",
    ],
  },
  {
    versi: "1.134.0",
    dirilis: "2026-09-14T09:07:25+08:00",
    judul: "Praperiksa putusan: agen yang membaca SIPP dan berhenti bila bertentangan",
    butir: [
      "PRAPERIKSA SEBELUM MENGISI. Tepat sebelum blangko Putusan Akhir diisi dari draf ALETA - di panel maupun di putusan massal - agen membaca fakta SIPP dan mengadunya: tanggal putusan yang diketik harus hari sidang perkara itu (1.643 dari 1.643 putusan 2025-2026 begitu); kata kerja amar harus berpadanan dengan Status Putusan yang dipilih (1.642 dari 1.643 - yang satu memang keliru); nama bin/binti di amar harus pihak atau anak perkara ini; majelis yang disebut naskah harus majelis yang ditetapkan; perkaranya belum putus. Yang bertentangan MENAHAN: tombol Isikan mati, putusan massal menandai perkara itu 'ditahan praperiksa' dan tidak mengisinya. Tidak ada yang diperbaiki sendiri - agen ini membaca, orang yang memutuskan.",
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
      "ISI DARI POHON BLANGKO. Portal sudah tahu set blangko mana untuk jenis perkara apa (SET_BLANGKO), dan bot sudah dapat membaca isi foldernya di server. Rute baru /aleta-ecourt/blangko/pohon menyatukan keduanya: untuk tiap jenis, ia menjenjangkan berkas set putusannya menurut skenario akhir dan mengusulkan satu bawaan - berkas skenario KABUL, yang kode terpendek (\"[01]\" mendahului \"[01b]\"). Satu tombol di popup super admin dan di panel ABT menuangkannya ke tabel pemetaan, jadi jenis lain tidak perlu diketik satu per satu.",
      "YANG DIKETIK TANGAN TIDAK DISENTUH. Hanya baris kosong, bawaan, atau yang sebelumnya bersumber pohon yang diisi; baris yang pernah Anda sunting menang, kecuali diminta menimpa. Berkas dari pohon adalah nama yang sama persis dengan yang dirender ABT, jadi tokennya langsung dicari di halaman ABT sesudah nama terisi - satu tekanan, dua pekerjaan.",
      "Kotak ketik nama di popup maupun panel ABT kini menyodorkan nama-nama dari pohon sebagai pilihan (datalist), lengkap dengan set dan kategorinya. Usulan hanya bawaan: tiap perkara di daftar massal tetap dapat memilih blangkonya sendiri.",
    ],
  },
  {
    versi: "1.132.0",
    dirilis: "2026-09-13T18:32:49+08:00",
    judul: "Bawaan pemetaan blangko: itsbat nikah dan dispensasi kawin menyusul cerai",
    butir: [
      "ITSBAT NIKAH -> \"[01] [Kabul] IN\" - seri server yang sama dengan blangko cerai, dikenal kode sejak korpus blangko dipelajari. Bernama saja; tokennya diambil panel ABT di server, seperti cerai.",
      "DISPENSASI KAWIN -> \"DK (Full) Perempuan Hamil V.2\" - nama seri servernya belum dikenal kode ini, jadi diisi nama ABT setempat yang paling lazim dan DITANDAI catatannya di popup maupun panel: periksa namanya di server. Bila tidak ketemu di sana, panel menyebutnya apa adanya dan namanya tinggal disunting - tidak ada yang ditebak diam-diam.",
      "Otomatisasi itsbat dan dispensasi yang lama - empat belas variabel dari posita, alasan dispensasi, unggah naskah penetapan - tidak disentuh; ini hanya melengkapi tabel putusan massal.",
    ],
  },
  {
    versi: "1.131.0",
    dirilis: "2026-09-13T17:45:29+08:00",
    judul: "Putusan massal: dari jadwal sidang ke ABT, ke SIPP, dan pemetaan blangko yang dapat disunting",
    butir: [
      "PUTUSAN MASSAL DI ABT. Di halaman beranda blangko ABT ada panel baru: pilih tanggal sidang (hari ini bawaannya), ALETA menyodorkan seluruh perkara yang bersidang pada tanggal itu beserta jenis, agenda, dan sudah-belumnya putus. Tidak ada yang tercentang sendiri - agenda sidang tidak dapat dipercaya sebagai penentu, jadi yang memutuskan orang. Tekanan pertama menyusun RENCANA (kering); menjalankan menuntut tekanan kedua. Tiap perkara berdiri sendiri: RTF dari ABT, draf ke ALETA, PDF, anonimisasi, PDF anonim, dan bila diminta secara sadar, unggah dokumen ke SIPP. Satu yang gagal dicatat sebabnya, sisanya jalan terus.",
      "LANJUTAN KE SIPP - OTOMATIS ATAU MANUAL. Sesudah tahap ABT, antrean diserahkan ke SIPP lewat penyimpanan ekstensi (tab ABT dan tab SIPP beda asal). Di SIPP, bagian Putusan massal memandu perkara demi perkara: otomatis mengisi dan menyimpan begitu blangko putusannya terbuka; manual berhenti di tiap perkara supaya diperiksa dahulu. Tersimpannya dibuktikan dari SIPP, bukan dari tombol yang berhasil ditekan; yang sudah putus tidak pernah diisi ulang.",
      "ANTREAN SIPP LANGSUNG DARI TANGGAL SIDANG. Bagi perkara yang drafnya sudah ada di ALETA, panel daftar perkara SIPP dapat menyusun antreannya sendiri dari tanggal sidang tanpa lewat ABT. Draf tiap perkara diperiksa lebih dulu; yang belum punya draf disebut apa adanya dan tidak dapat dicentang - bukan dijanjikan lalu gagal di tengah.",
      "PEMETAAN BLANGKO MENURUT NAMA, DAPAT DISUNTING. Jenis perkara → nama berkas blangko ABT. Token a/b (hasil enkripsi ABT) hanya dapat dibaca dari halaman ABT yang terbuka, jadi pemetaan cukup menyebut NAMA-nya; panel ABT mengambil tokennya sendiri dengan menyusuri kelompok blangko, lalu menyimpannya. Nama juga lebih tahan lama daripada token: kunci ABT yang berganti mematikan seluruh token diam-diam, nama berkasnya tidak. Disunting di popup ekstensi (super admin) maupun di panel ABT - ketik nama, pilih dari halaman, atau Ambil token dari ABT. Bawaan cerai dahulu: Cerai Gugat dan Cerai Talak → [01] [Kabul Verstek] Cerai (Format Lengkap); jenis lain menyusul sesudah tersambung ke server.",
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
      "LENCANA LINGKUNGAN. SIPP di komputer sendiri dan SIPP di server tampilannya sama persis - basis datanya memang salinan - dan satu-satunya pembeda ada di bilah alamat, bagian layar yang paling jarang dibaca saat bekerja. Sekarang lencana LOKAL atau alamat asing berdiri paling kiri di kepala panel. Di server, petugas biasa TIDAK melihat apa-apa: di sanalah tempat yang benar, dan tulisan yang selalu ada berhenti dibaca. Super admin melihat keduanya, sebab ia yang berpindah-pindah.",
      "MODE KERING. Satu saklar: coba semuanya, jangan simpan apa pun. Batasnya dipilih dengan sengaja - MEDAN TETAP DIISI, sebab justru isian itulah yang ingin diperiksa, dan mengisi medan tidak mengubah apa pun di basis data SIPP. Yang ditahan hanya dua hal yang benar-benar mengubah data: penekanan tombol Simpan milik SIPP, dan pengiriman tulis ke ALETA. Panel bergaris putus-putus kuning selama mode ini menyala, sebab mode kering yang terlupa membuat tiap tombol tampak rusak.",
      "PAPAN KESEHATAN. Sepuluh pertanyaan yang biasanya dijawab dengan membuka SSH dan membaca log: portal menjawab tidak, berapa lama, versi yang berjalan sama dengan yang disajikan portal, mode kering menyala tidak, berapa permintaan gagal berturut-turut, penunjuk halaman masih ketemu semua. Dijawab dari apa yang memang sudah diketahui panel, dengan satu bacaan ringan.",
      "KOTAK HITAM. Lima puluh kejadian terakhir - tiap permintaan beserta status dan lamanya, tiap perintah ke halaman SIPP, tiap error - disimpan apa adanya, BUKAN sesudah diterjemahkan untuk petugas. \"Server ALETA tidak terjangkau\" pernah berarti error basis data karena satu bita kosong di dalam berkas RTF; terjemahan yang benar untuk petugas itu menyesatkan yang memperbaiki. Selamat dari muat ulang halaman, dan satu tombol menyalin semuanya untuk ditempel.",
      "RIWAYAT TINDAKAN DAN JALAN PULANGNYA. Sebelum satu medan diisi, nilai lamanya dibaca lebih dulu - satu perjalanan tambahan ke jembatan, dan dari situlah tombol Pulihkan menjadi mungkin. Yang TIDAK dapat dipulihkan disebut apa adanya: penekanan Simpan, unggahan, penetapan yang sudah terbit. Menawarkan pulihkan untuk sesuatu yang tidak dapat dipulihkan lebih buruk daripada tidak menawarkan apa-apa.",
      "PERIKSA PENUNJUK. Ketika SIPP diperbarui dan nama medannya berubah, penunjuk yang tidak ketemu tidak menimbulkan error - querySelector hanya menjawab null dan ekstensi diam saja tidak mengisi apa-apa. Rusaknya tidak bersuara; yang bersuara petugas, berhari-hari kemudian. Sekarang penunjuk yang menentukan diperiksa terhadap halaman yang sedang terbuka dan yang hilang disebut namanya.",
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
      "Kawat e-Court diaudit statis ujung ke ujung: 61 rute portal, 70 panggilan gerbang, 139 jalur bot - tidak satu pun putus. Yang belum dapat dibuktikan setempat hanya sambungan ke situs e-Court sendiri, yang menuntut sesi di server.",
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
      "EKSTENSI KINI SUNGGUH BERJALAN DI ABT SERVER. Polanya '/aps_badilag/abt/*' tidak pernah cocok satu halaman pun di sana: alamat ABT yang sungguhan memuat index.php di tengahnya. Tema dan panelnya karena itu tidak pernah muncul di server, sementara di mesin setempat keduanya tampak biasa saja - dan perbedaan itu yang membuatnya lama tidak tertangkap.",
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
      "ISIKAN YANG DICENTANG KINI MENYIMPAN SENDIRI. Sesudah SELURUH yang dicentang terisi, Simpan ditekan dan halaman perkara dibuka kembali. Satu isian gagal berarti Simpan tidak ditekan sama sekali - blangko yang belum utuh tidak boleh tersimpan sebagai putusan.",
      "TERSIMPANNYA DIBUKTIKAN, BUKAN DIAKUI. Blangko putusan SIPP mengirim lewat AJAX, jadi tombolnya 'berhasil ditekan' walau simpanannya ditolak server. Karena itu keadaan putusan dibaca dari SIPP sebelum dan sesudah menekan; hanya selisih itu yang dianggap bukti. Sepuluh detik tanpa perubahan dilaporkan apa adanya, dan halamannya TIDAK dimuat ulang supaya isian yang belum diterima tidak hilang.",
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
      "Pegangan panel ABT memakai pointerdown seperti panel lainnya, dan dua layar portal (riwayat penetapan, tanda tangan) membaca jawabannya dari dalam bungkus { ok, data } - sebelumnya daftarnya selalu kosong tanpa satu pun error.",
      "Mencakup 1.112.0 sampai 1.122.0: putusan otomatis dari draf ALETA dan dari naskah RTF, unggah putusan dan anonimisasi ke SIPP beserta antrean Direktori Putusan, medan putusan terdeteksi otomatis untuk tiap jenis perkara dan status putusan, pita identitas dengan chip berwarna per perkara dan per peran, kaki panel satu baris, alamat pihak dibersihkan, domisili elektronik dari gugatan, dan warna gelap CKEditor tanpa kedipan putih.",
    ],
  },
  {
    versi: "1.111.0",
    dirilis: "2026-09-12T21:20:00+08:00",
    judul: "Hubungan ke portal dibuat tahan lambat - panel tidak lagi menggantung ketika ALETA berat",
    butir: [
      "BATAS WAKTU pada tiap permintaan panel. Sebelumnya tidak ada satu pun: fetch yang menggantung menunggu sampai peramban menyerah sendiri - pada Chrome itu bermenit-menit - dan selama itu bagian panel tetap bertulis 'memuat...' tanpa satu pun keterangan. Yang membacanya menyimpulkan ekstensinya rusak. Sembilan detik untuk permintaan panel, dua belas detik untuk panggilan konteks yang memang paling berat. Batas waktu yang lewat kini punya kalimatnya sendiri, bukan lagi jatuh sebagai error yang tidak dikenali.",
      "PANEL TIDAK MENUNGGU portal yang berat. Panggilan konteks menahan SELURUH panel - sampai ia menjawab, tidak ada apa pun yang tergambar, dan pada halaman perkara SIPP itu berarti beberapa detik tanpa panel sama sekali. Sekarang bila ia belum menjawab dalam 400 milidetik dan perkara itu pernah terbaca sebelumnya, panelnya digambar dari simpanan dengan pita yang menyebutkan ia sedang disegarkan; begitu jawaban yang segar tiba, panel digambar ulang. Portal yang cepat tidak pernah melihat pendahulu ini sama sekali - jawabannya menang balapan, dan tidak ada satu kedipan pun.",
      "Pitanya dibedakan nadanya dari pita luring. Yang satu berkata ALETA mati, yang lain ALETA sedang menjawab - menyamakan keduanya membuat portal yang hanya berat terbaca sebagai portal yang mati, dan yang membacanya berhenti menunggu padahal jawabannya sedang datang.",
      "PERMINTAAN YANG SAMA DISATUKAN. Halaman SIPP mengubah DOM-nya terus-menerus, dan beberapa bagian panel meminta alamat yang sama dalam hitungan milidetik. Yang sedang terbang kini dipakai bersama, bukan diulang - jawabannya disalin untuk tiap peminta.",
      "SATU PERCOBAAN KEDUA untuk bacaan yang gagal jaringan atau dijawab 5xx: portal yang sedang dibangun ulang menjawab 502 sekejap, lalu hidup lagi, dan satu kedipan tidak lagi berakhir sebagai pesan error.",
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
      "TANDA TANGAN PEJABAT disimpan di basis data ALETA. Gambarnya diukir dari berkas .doc satuan kerja - 42 gambar terukir dari berkas yang ada sekarang - dan seluruhnya masuk dalam keadaan BELUM DISAHKAN. Pengukirannya kasar dan diakui kasar: ia menyapu bita mencari tanda berkas PNG dan JPEG, dan urutan gambar di dalam wadah .doc tidak harus sama dengan urutan nama di dalam teksnya. Tanda tangan yang terpasang pada nama yang keliru adalah tanda tangan palsu pada penetapan pengadilan, dan tidak ada satu error pun yang akan berbunyi.",
      "Karena itu ada layar Tanda Tangan di portal - ALETA e-Court, hanya bagi yang berwenang menyunting blangko ABT. Tiap gambar ditampilkan besar di atas latar putih, dinamai, lalu disahkan; namanya tercatat sebagai yang mengesahkan. Tiga penjaga menahannya: yang belum disahkan tidak pernah dipulangkan untuk dipakai, yang belum dinamai tidak dapat disahkan, dan mengganti nama yang sudah disahkan MEMBATALKAN pengesahannya - tanda tangan A yang namanya diganti menjadi B adalah tanda tangan A pada penetapan B.",
      "PENETAPAN dapat diterbitkan bertanda tangan dan dicatatkan ke SIPP. Blangkonya diambil dari ABT - form PTSP pada blangko satker, dengan penanda @PMH, @PPP, @PJS, dan @PHS - tanda tangannya dibubuhkan tepat di atas nama penandatangan, PDF-nya diterbitkan dengan mesin yang sama yang sudah dipakai mencetak putusan ABT, dan barisnya dicatat di perkara_dokumen_penetapan. Bentuk barisnya dibaca dari 3.336 baris yang sudah ada di basis data satker: jenis 1 PMH, 2 PPP, 3 PJS, 4 PHS, dan perkara_penetapan_id menunjuk tabel petugas yang berbeda tiap jenis.",
      "Alamat blangko ABT DAPAT DISUNTING dari portal, satu alamat tiap jenis penetapan, dengan {nomor} dan {nomorBersih} yang diganti nomor perkaranya. ABT hanya ada di server dan alamatnya berbeda antar pemasangan; alamat tebakan yang salah akan memulangkan halaman error ABT, dan halaman error yang tersimpan sebagai penetapan jauh lebih buruk daripada penetapan yang tidak terbit. Karena itu bawaannya KOSONG dan mati sampai disetel, dan jawaban ABT yang bukan RTF ditolak.",
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
      "Sembilan garis panel mendapatkan warnanya kembali pada tema gelap. Sejak 1.73.0 peubah paletnya tertulis menunjuk dirinya sendiri - sah menurut penjaga yang ada waktu itu, tidak sah menurut CSS - sehingga tepi tombol kepala, kedua pegangan gulir, tepi kiri baris, garis putus kaki, dan tepi kotak kehilangan warnanya tanpa satu pun error. Tema terang tidak pernah terkena, dan itu sebabnya tiga puluh dua rilis berlalu tanpa ada yang menyadarinya. Kotak isian di panel juga tidak lagi transparan.",
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
      "Tab \"Kerjakan\" menjadi \"Penetapan\", tombolnya menjadi \"Tetapkan\", dan hasil tiap langkah berbunyi \"ditetapkan\". Kata \"blangko\" diganti \"formulir\" di seluruh teks yang dilihat petugas.",
      "Popup ekstensi ditata ulang: saklar perilaku dikelompokkan lebih dulu, lalu ukuran huruf, lalu pembaruan. Keterangan kedua kartu terakhir dipendekkan menjadi satu baris.",
    ],
  },
  {
    versi: "1.103.0",
    dirilis: "2026-09-12T11:40:00+08:00",
    judul: "Pembaruan dipasang sekali klik dari panel, tanpa membuka chrome://extensions",
    butir: [
      "Kotak Ekstensi pada panel ALETA kini punya tombol \"Perbarui sekarang\". Sebelumnya kotak itu hanya berkata \"unduh lalu muat ulang dari chrome://extensions\" - tiga langkah, dua di antaranya di halaman yang hampir tidak pernah dibuka petugas, dan akibatnya beberapa rilis berturut-turut tidak pernah benar-benar terpasang di peramban siapa pun. Tombol yang sama ada di popup ikon peramban.",
      "Pada pemasangan yang dikelola server (CRX lewat kebijakan Chrome), tombol itu meminta Chrome memeriksa updates.xml di portal seketika. Bila ada versi yang lebih baru, Chrome mengunduh dan memasangnya sendiri, ekstensi dimuat ulang, dan halaman ikut disegarkan supaya panelnya digambar kode yang baru. Itulah pemasangan sekali klik yang sesungguhnya.",
      "Pada pemasangan folder (Load unpacked), Chrome mengabaikan pembaruan otomatis - dan itu dikatakan apa adanya, bukan disamarkan menjadi \"tidak ada pembaruan\" yang menyesatkan. Tombol kedua muncul di situ: memuat ulang ekstensi dari berkasnya di disk, menggantikan perjalanan ke chrome://extensions.",
      "Ekstensi TIDAK dapat menulis ke foldernya sendiri, dan itu batas yang dipasang Chrome dengan sengaja: ekstensi yang dapat menimpa kodenya sendiri dari halaman web adalah ekstensi yang dapat dibajak halaman web. Pada pemasangan folder, berkasnya tetap harus sampai ke folder lebih dahulu oleh skrip rilis.",
      "Ekstensi tidak pernah dimuat ulang ketika Chrome tidak memasang apa pun. Panel yang lenyap di tengah pengisian blangko penetapan membuang pekerjaan petugas, dan itu dijaga uji tersendiri.",
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
      "Karena itu tiap petikan dapat disunting di panel sebelum diisikan, dan yang masuk blangko adalah isi kotak saat Terapkan ditekan - bukan petikan semula. Kalimat posita yang menjadi asalnya diperlihatkan di bawah tiap petikan.",
      "Tanggal diisikan lewat jalur datepicker, bukan sebagai teks biasa: menyetel nilainya saja membuat kotaknya berubah sementara tanggal yang dipegang datepicker tetap yang lama.",
      "Medan KUA sengaja TIDAK diisikan - daftarnya dicari SIPP ke server ketika petugas mengetik, dan mengisinya menuntut menebak kode yang tidak ada di halaman. Nama KUA menurut posita tetap disebutkan, supaya yang harus diketik sudah terbaca.",
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
    judul: "Medan blangko putusan ditunjuk lewat nama, dan radio nusyuz benar-benar tercentang",
    butir: [
      "Pada blangko Putusan Akhir SIPP, select \"status_reskom\" memakai id yang SAMA dengan select faktor perceraian. Menunjuknya lewat id membuat yang terisi bergantung pada urutan elemen di halaman - dan pada hari urutannya berubah, faktor perceraian akan terisi hasil reskom tanpa satu pun tanda. Sekarang seluruh medan ditunjuk lewat namanya, yang tidak kembar.",
      "Status nusyuz berupa radio, bukan select. Radio tidak terisi dengan menyetel nilainya - itu hanya mengubah nilai yang dikirimkan kotaknya, sehingga medannya tampak terisi sementara yang tersimpan tetap kosong. Jembatan kini mencentang anggota kelompok yang nilainya cocok.",
      "Ditambahkan pula ke daftar yang ditawarkan: status nusyuz, hasil reskom, dan jenis pengakhiran.",
    ],
  },
  {
    versi: "1.98.0",
    dirilis: "2026-09-12T07:55:00+08:00",
    judul: "Medan pilihan blangko putusan ikut diusulkan - faktor perceraian, alasan dispensasi, dan seterusnya",
    butir: [
      "Blangko Putusan Akhir tidak hanya berisi teks panjang. Ia menuntut pilihan yang berbeda-beda menurut jenis perkara dan status putusannya: faktor penyebab perceraian, faktor sekunder, nusyuz, qobla/ba'da dukhul, dan keadaan istri pada perkara cerai yang dikabulkan; alasan pengajuan pada dispensasi kawin; daftarnya sendiri pada izin poligami, itsbat nikah, dan pembatalan perkawinan.",
      "Angka-angka itulah yang kelak menjadi Laporan Faktor Penyebab Perceraian dan statistik Dispensasi Kawin. Salah pilih tidak terlihat di putusannya sama sekali - ia baru muncul setahun kemudian sebagai angka yang tidak masuk akal pada laporan satuan kerja.",
      "Panel kini menanyakan kepada HALAMAN medan mana yang sedang tampak beserta daftar pilihannya, lalu ALETA memilih satu berdasarkan bunyi pertimbangan dan duduk perkara, disertai kalimat yang menjadi dasarnya. Tidak ada satu pun nomor pilihan SIPP yang dihafal: SIPP boleh menambah, menghapus, atau menomori ulang daftarnya tanpa ekstensi ikut diubah.",
      "Yang tidak ditemukan naskahnya dibiarkan KOSONG beserta sebabnya - bukan diisi pilihan pertama, bukan \"Lain-Lain\". Yang naskahnya menyebut lebih dari satu ditandai berselisih dan tidak dicentang sendiri.",
      "Medan pilihan diisikan lebih dulu daripada teks panjang, sebab sebagian di antaranya mengubah tampilan blangko - memilih qobla menentukan muncul-tidaknya keadaan istri.",
    ],
  },
  {
    versi: "1.97.0",
    dirilis: "2026-09-12T06:20:00+08:00",
    judul: "Usulan blangko dapat disunting sebelum masuk ABT, dan blangko putusan SIPP diisi dari draf ALETA",
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
      "Pola pencocokan ekstensi selama ini hanya menyebut alamat server, sehingga di mesin pengembang ekstensinya tidak pernah menyala sama sekali - dan seluruh alur blangko hanya dapat dicoba di server, yaitu tempat yang paling tidak pantas dipakai mencoba. Sekarang alamat setempat ikut dikenali.",
      "Tiga aplikasi disajikan dari satu alamat setempat (127.0.0.1:8056): SIPP di /index.php, ABT di /aps_badilag, dan portal ALETA diteruskan di /aleta. Satu origin berarti jalur API /aleta/api dan kuki sesi berperilaku sama seperti di pengadilan.",
      "Tidak ada satu pun berkas yang tersuntik dua kali: pola SIPP, ABT, dan portal dijaga tidak saling beririsan, sebab skrip yang tersuntik dua kali melempar error deklarasi ulang dan mematikan panelnya diam-diam.",
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
      "Yang tidak berwenang tetap melihat papan usulan lengkap, beserta keterangan bahwa usulannya dapat disalin ke blangko SIPP.",
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
      "PMH, PPP, PJS, dan PHS dituliskan langsung dari panel secara berurutan, tanpa membuka empat blangko dan tanpa berganti empat akun. Baris audit SIPP ikut ditulis.",
      "Usulan majelis tidak lagi menunggu tabel Smart Majelis SIPP terisi; hari sidang dicari walau majelisnya belum tercatat di SIPP.",
    ],
  },
  {
    versi: "1.90.0",
    dirilis: "2026-09-10T10:54:12+08:00",
    judul: "Jejak perubahan ABT tersimpan di server",
    butir: [
      "Riwayat perubahan blangko ABT dikirim ke server, sehingga dapat dibaca orang lain sebagai jejak pengawasan dan tidak hilang saat data peramban dibersihkan.",
      "Salinan di peramban tetap ada dan tetap menggerakkan tombol Urungkan, termasuk saat jaringan terputus.",
    ],
  },
  {
    versi: "1.89.0",
    dirilis: "2026-09-09T22:22:47+08:00",
    judul: "Perlawanan kedua atas satu perkara tidak lagi terbaca acak",
    butir: [
      "Penanda VERZET membaca perlawanan yang terbaru secara pasti. Sebelumnya, pada perkara yang dilawan dua kali, tanggal yang tampil bisa berpindah antar-pembacaan tanpa error apa pun.",
    ],
  },
  {
    versi: "1.88.0",
    dirilis: "2026-09-09T20:52:25+08:00",
    judul: "Bunyi error ABT tertangkap, kegagalan menyebut sebabnya",
    butir: [
      "Kalimat error ABT seperti 'TIDAK BENAR QUERY NYA' tidak lagi dianggap variabel terisi, sehingga tidak pernah tercetak sebagai pertimbangan hukum.",
      "Keadaan tiap variabel kini tiga: kosong, error, terisi - dan pemeriksaan sebelum CETAK menyapu seluruhnya.",
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
      "Tombol CETAK ditahan bila masih ada variabel kerangka yang kosong atau variabel otomatis yang berbunyi error - lalu bertanya, bukan melarang.",
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
