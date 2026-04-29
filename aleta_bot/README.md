# Aleta (whatsappbot-nodejs)

Aplikasi Notifikasi WhatsApp ini berfungsi untuk mengirim notifikasi kepada Pegawai Pengadilan, Para Pihak Berperkara, dan Masyarakat serta Peneliti. Aplikasi ini juga mengirim laporan ke KUA dan CAPIL mengenai data perceraian serta dilengkapi fitur AI yang dapat menjawab pertanyaan hukum seperti layanan Posbakum. Whatsapp bot ini dibuat dengan platform [whatsapp-web-js](https://github.com/pedroslopez/whatsapp-web.js/), dan dibuat menggunakan bahasa javascript dengan runtime environment node-js.

Prerequisit :

* Server (untuk centos7 yang belum mendukung Node v20 ke atas maka menggunakan docker compose)
* Smartphone yang telah terinstall aplikasi whatsapp (sebaiknya WA Business)
* Node JS (minimal versi 20)

Langkah-langkah penggunaan :

1. Silahkan download terlebih dahulu [node-js](https://nodejs.org/en/download/), kemudian install di komputer yang akan dijadikan server untuk whatsapp bot.
2. Jalankan terminal dan arahkan ke folder tempat aplikasi ini.
3. Ganti nama dan nomor WA di **whatsapp.js** (apabila user maka ...@c.us apabila grup maka ...@g.us)
4. Download dependencies melalui terminal (atau lebih mudah dengan cukup menggunakan command **npm install** untuk menginstall semua dependencies) :

   * Whatsapp web js

     > $ npm i whatsapp-web.js

   * moment.js :

     > $ npm i moment

   * qrcode-terminal :

     > $ npm i qrcode-terminal

   * mysql :

     > $ npm i mysql

   * Gemini :

     > $ npm i @google/generative-ai

5. Selanjutnya jalankan perintah

   > $ node app

   pada terminal, kemudian scan barcode Whatsapp dengan Smartphone yang akan digunakan pada chromium atau terminal, dan Whatsapp bot siap digunakan, untuk Centos7 yang belum ada GUI maka bisa di install melalui SSH

### Kustomisasi Pesan dan Database

 Untuk mengkostumisasi pesan respon, silahkan ubah di file **query.js**, untuk menambah fitur query sql dapat dibuat di **notifikasi.js** dan untuk merubah koneksi ke database silahkan ubah pada file **db_config.js**

### Notifikasi ke Group Whatsapp

Aplikasi Notifikasi WhatsApp ini berfungsi untuk mengirim notifikasi kepada Pegawai Pengadilan, Para Pihak Berperkara, dan Masyarakat serta Peneliti. Aplikasi ini juga mengirim laporan ke KUA dan CAPIL mengenai data perceraian serta dilengkapi fitur AI yang dapat menjawab pertanyaan hukum seperti layanan Posbakum. Berikut fitur-fitur yang tersedia:

**FITUR UNTUK PEGAWAI**

- Penilaian SIPP dan Triwulan sesuai petunjuk Badilag.
- Pengingat untuk absen masuk dan pulang.
- Pengingat Apel Pagi dan Apel Sore.
- Pengingat PPNPN untuk mempersiapkan dan membersihkan area kantor.
- Pengingat Penjaga Sidang untuk mempersiapkan ruang sidan serta pihak berperkara.
- Pelaporan absen secara rinci (laporan dikirim ke grup notif bot).
- Pelaporan surat masuk dan surat keluar serta disposisi.
- Pengumuman Mahkamah Agung RI, Badilag dan PTA setempat.
- Fitur query untuk semua informasi perkara sesuai kebutuhan.
- Mengirim pesan harian sesuai dengan usernya ke Hakim, Panitera Sidang, dan Jurusita sesuai dengan perkara yang mereka tangani.
- Mengirim laporan terkait perkara kepada user sesuai tanggung jawab masing-masing, seperti:
- Ketua, Wakil, Panitera: Laporan perkara yang belum selesai tepat waktu, Nilai SIPP, dan perkara bermasalah, serta beban perkara tiap Hakim/Panitera/Jurusita sebagai bahan pertimbangan penetapan majelis.
- Hakim: Beban perkara dan mediasi selama setahun beserta persentasenya (termasuk tingkat keberhasilan), pengingat untuk lupa upload, anonymisasi, serta pelaksanaan sidang 1 hari sebelum dan saat hari sidang.
- Panmud: Laporan perkara bermasalah yang bisa segera ditangani (termasuk jumlah laporan LIPA untuk Panmud Hukum).
- Panitera Sidang: Pengingat untuk tunda mediasi, tunda sidang, dan minutasi yang belum selesai.
- Jurusita: Pengingat panggilan sidang, delegasi masuk, dan eksekusi yang belum dilaksanakan.
- Delegasi: Pengingat delegasi masuk dan keluar yang belum dilaksanakan.
- Arsip: Pengingat arsip yang belum dilaksanakan.
- Kasir: Pengingat biaya tingkat pertama hingga PK, serta sisa panjar yang belum dikeluarkan.
- PTSP: Pengingat petitum, data umum, dan data pihak yang belum diinput.
- Penjaga Sidang: Pengingat pelaksanaan sidang 1 hari sebelum dan saat hari sidang.
- Petugas Produk: Pengingat BHT dan Akta Cerai yang dapat diterbitkan.

Selain itu, terdapat banyak fungsi lainnya yang spesifik untuk setiap user yang tidak disebutkan satu per satu.

**FITUR UNTUK PARA PIHAK**

- Pengingat kepada Pihak Penggugat dan Tergugat bahwa perkara telah didaftarkan (disertai pengiriman gugatan dalam bentuk file) sebagai pendukung panggilan secara elektronik E-Court.
- Pengingat sidang 3 hari sebelum dan saat hari sidang.
- Pengingat bahwa Putusan telah diucapkan oleh Majelis Hakim sebagai bentuk upaya hukum.
- Pengingat bahwa Akta Cerai telah terbit.
- Pengingat biaya perkara yang kurang atau telah habis, tetapi perkara masih berjalan.
- Pengingat sisa panjar yang belum diambil setelah perkara diputus.
- Fitur query untuk mengetahui status perkara (biaya, jadwal sidang, status perkara, dll).
- Fitur cek Akta Cerai.
- E-Posbakum, fitur AI yang dapat menjawab pertanyaan hukum.
- Fitur Menghitung Panjar Biaya Perkara (Masih dalam pengerjaan).
- Fitur Antrian Sidang Online (Masih dalam pengerjaan).
  Serta fitur-fitur lainnya yang tidak dapat disebutkan satu persatu

**FITUR UNTUK MASYARAKAT DAN PENELITI**

- Fitur query mengenai cara pendaftaran hingga penerimaan produk pengadilan.
- Fitur query untuk mengetahui informasi pengadilan, biaya penerimaan informasi, eksekusi, sita, kewenangan peradilan agama, dan lainnya.
- Fitur query statistik perkara tiap tahun berdasarkan jenis perkara.
- Fitur pesan akta untuk pengiriman Akta Cerai ke rumah pihak (fitur ini sudah ada, namun belum ada MoU).
- E-Posbakum, fitur AI untuk menjawab masalah hukum.
- Fitur Menghitung Panjar Biaya Perkara (Masih dalam pengerjaan).
- Fitur pelaporan KUA dan CAPIL berupa file excel untuk perkara cerai yang kabul (Masih menunggu MoU).
