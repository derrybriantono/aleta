# Buku Panduan Portal ALETA

**Panduan lengkap untuk Dashboard SSO, Pengaturan Portal, Manajemen Surat, Fitur AI, dan Admin**  
Versi: v1.2 - Oktober 2026  
Tanggal: 18 Oktober 2026  
Instansi: Pengadilan Agama Donggala

Panduan ini dibuat tanpa screenshot. Visual panduan memakai tabel, card informasi, callout, checklist, dan diagram alur teks.

## Daftar Isi

1. Kata Pengantar
2. Cara Menggunakan Buku Panduan
3. Gambaran Umum Portal ALETA
4. Konsep Akun, Role, Permission, dan Hak Akses
5. Login, Logout, dan Keamanan Session
6. Dashboard SSO dan Navigasi Portal
7. Pengaturan Portal untuk Pengguna
8. Manajemen Surat: Konsep dan Fungsi Utama
9. Manajemen Surat: Tambah, Detail, Edit, dan Status
10. Manajemen Surat: Disposisi, Lampiran, Pencarian, dan Arsip
11. Fitur AI: Cara Pakai, Batasan, Etika, dan Contoh
12. Panduan Admin: User, Role, Permission, Jabatan
13. Panduan Admin: Module Visibility, Pengaturan Surat, dan AI
14. Aplikasi Pengembangan Selanjutnya
15. Troubleshooting Lengkap
16. FAQ
17. Glosarium
18. Lampiran Checklist Operasional
19. Lampiran Fitur Terbaru per Peran (7 sampai 18 Oktober 2026)

## Ringkasan Fokus

- Dashboard SSO dan Portal Utama.
- Pengaturan Portal ALETA.
- Manajemen Surat.
- Fitur AI.
- Admin dan Pengaturan Admin.

## Ringkasan Alur Portal

```text
User membuka ALETA -> Login -> Dashboard SSO -> Pilih aplikasi -> Gunakan fitur -> Logout
```

## Hak Akses Umum

| Role | Akses Umum | Catatan |
| --- | --- | --- |
| Super Admin | Akses tertinggi untuk konfigurasi sistem, user, role, dan modul. | Gunakan terbatas untuk kebutuhan pengelolaan inti. |
| Admin | Mengelola user, pengaturan modul, dan operasional tertentu. | Akses perlu disesuaikan kebijakan satuan kerja. |
| Operator Surat | Menginput, mengedit, mencari, mengarsipkan, dan memproses surat. | Role utama untuk administrasi persuratan. |
| Hakim | Melihat surat atau disposisi yang berhubungan dengan tugasnya. | Akses mengikuti penugasan dan disposisi. |
| Panitera | Memantau atau memberi arahan pada alur surat/disposisi tertentu. | Dapat memiliki akses lebih luas sesuai jabatan. |
| Jurusita | Melihat tugas atau disposisi pelaksanaan yang relevan. | Tidak otomatis melihat semua data surat. |
| User biasa | Akses terbatas pada fitur yang memang diberikan. | Tidak boleh membuka admin tanpa permission. |

## Data Penting Manajemen Surat

| Data Surat | Fungsi | Catatan Pengisian |
| --- | --- | --- |
| Nomor surat | Identitas utama surat. | Pastikan format sesuai kebijakan kantor. |
| Tanggal surat | Tanggal dokumen diterbitkan. | Bedakan dengan tanggal terima atau tanggal kirim. |
| Tanggal terima/kirim | Tanggal surat diterima atau dikirim. | Dipakai untuk pelacakan timeline. |
| Asal surat | Instansi atau pihak pengirim. | Wajib rapi agar pencarian mudah. |
| Tujuan surat | Unit, pejabat, atau pihak tujuan. | Sesuaikan dengan alur kerja. |
| Perihal | Ringkasan isi surat. | Buat singkat tetapi jelas. |
| Kategori/klasifikasi | Pengelompokan arsip atau jenis surat. | Membantu filter dan laporan. |
| Status | Tahap pemrosesan surat. | Perbarui saat ada tindak lanjut. |
| Lampiran | File pendukung digital. | Upload hanya file valid. |

## Contoh Penggunaan AI

| Kebutuhan | Contoh Instruksi | Catatan |
| --- | --- | --- |
| Ringkasan surat | Buat ringkasan 5 poin dari isi surat berikut. | Cocok untuk memahami cepat isi dokumen. |
| Draft narasi | Susun narasi formal berdasarkan poin berikut. | Hasil perlu disesuaikan gaya bahasa instansi. |
| Analisis tindak lanjut | Buat rekomendasi tindak lanjut administratif. | Tidak menggantikan keputusan pejabat. |
| Pemeriksaan konsistensi | Periksa konsistensi tanggal, nama, dan nomor surat. | Tetap lakukan cek manual. |
| Perbaikan bahasa | Rapikan bahasa agar lebih formal dan jelas. | Pastikan makna tidak berubah. |
| Daftar poin penting | Ambil poin utama, batas waktu, dan pihak terkait. | Membantu sebelum disposisi. |

## Troubleshooting

| Masalah | Kemungkinan Penyebab | Solusi | Ditangani Oleh |
| --- | --- | --- | --- |
| Tidak bisa login | Username/password salah, akun nonaktif, atau session bermasalah. | Periksa kembali identitas, coba login ulang, dan hubungi admin jika tetap gagal. | User/Admin |
| Password salah | Password tidak sesuai atau lupa password. | Ikuti prosedur reset password yang ditetapkan satuan kerja. | User/Admin |
| User tidak aktif | Akun dinonaktifkan karena mutasi, perubahan tugas, atau kebijakan admin. | Admin memverifikasi kewenangan lalu mengaktifkan kembali jika layak. | Admin |
| Dashboard kosong | Role belum diberi module visibility atau permission. | Admin memeriksa role, permission, dan visibility aplikasi. | Admin |
| Menu tidak muncul | Modul belum aktif untuk role pengguna. | Jangan memaksa URL langsung. Hubungi admin untuk evaluasi akses. | User/Admin |
| Akses ditolak | Pengguna membuka fitur tanpa permission. | Gunakan fitur yang tersedia atau minta admin meninjau kebutuhan akses. | User/Admin |
| Data surat tidak tampil | Filter aktif, data kosong, atau akses terbatas. | Reset filter, cek kata kunci, dan pastikan memiliki hak melihat data. | User/Operator |
| Gagal tambah surat | Field wajib belum diisi atau format input tidak valid. | Lengkapi data wajib dan perbaiki format input. | Operator |
| Gagal edit surat | User tidak punya permission atau status surat tidak boleh diedit. | Cek hak akses dan status surat. | Operator/Admin |
| Gagal disposisi | Penerima tidak valid, instruksi kosong, atau role tidak berwenang. | Pilih penerima dari daftar valid dan isi instruksi dengan jelas. | Pejabat/Operator |
| Lampiran gagal upload | Format/ukuran file tidak sesuai atau koneksi terganggu. | Gunakan file valid dan ulangi upload dengan koneksi stabil. | Operator |
| Lampiran gagal download | File tidak ditemukan atau user tidak berwenang. | Pastikan surat benar dan user punya akses. Laporkan bila file hilang. | User/Admin |
| AI tidak merespons | Fitur AI belum aktif, konfigurasi belum lengkap, atau layanan sedang bermasalah. | Admin memeriksa pengaturan AI dan status layanan. | Admin |
| Hasil AI tidak sesuai | Instruksi terlalu umum atau konteks kurang. | Perjelas prompt, tambah konteks, dan periksa hasil manual. | User |
| Halaman loading terus | Koneksi lambat, session kedaluwarsa, atau API bermasalah. | Refresh, login ulang, lalu laporkan waktu kejadian jika berulang. | User/Admin |
| Error server/API | Gangguan backend, database, atau konfigurasi. | Catat waktu kejadian, halaman, dan aksi terakhir sebelum error. | Admin/Teknis |

## FAQ

### Apa itu Portal ALETA?

Portal ALETA adalah pusat akses aplikasi internal yang menyatukan login, dashboard, dan modul kerja dalam satu tempat.

### Apakah ALETA satu aplikasi atau kumpulan aplikasi?

ALETA adalah portal terpadu. Di dalamnya dapat tersedia beberapa aplikasi sesuai kebutuhan dan hak akses.

### Apa itu SSO?

SSO atau Single Sign On berarti pengguna cukup login satu kali untuk masuk ke portal dan membuka aplikasi yang diizinkan.

### Kenapa menu saya berbeda dengan rekan kerja?

Menu dipengaruhi role, permission, jabatan, dan module visibility. Perbedaan menu adalah hal normal bila tugas berbeda.

### Siapa yang boleh mengatur user?

Super Admin dan Admin yang memiliki izin pengelolaan user.

### Siapa yang bisa memakai Manajemen Surat?

Pengguna yang diberi akses, misalnya operator surat, pejabat terkait, atau role lain sesuai kebijakan kantor.

### Apakah semua user bisa melihat semua surat?

Tidak. Akses surat mengikuti role, permission, disposisi, dan kebijakan akses data.

### Apakah AI menggantikan pengguna?

Tidak. AI hanya membantu menyusun, meringkas, atau memberi rekomendasi awal. Keputusan tetap milik manusia.

### Apakah hasil AI harus diperiksa?

Ya. Semua hasil AI wajib diverifikasi sebelum dipakai.

### Apa yang dilakukan jika modul tidak muncul?

Hubungi admin untuk memeriksa role, permission, dan module visibility.

### Apakah Portal ALETA akan bertambah modul?

Ya. Portal ini dirancang sebagai ekosistem yang dapat dikembangkan dengan aplikasi baru.

## Glosarium

| Istilah | Penjelasan |
| --- | --- |
| Portal | Pusat akses aplikasi internal. |
| SSO | Single Sign On, login satu kali untuk membuka aplikasi yang diizinkan. |
| Dashboard | Halaman utama setelah login. |
| Role | Peran pengguna, seperti admin, operator, hakim, panitera, atau user biasa. |
| Permission | Izin spesifik untuk melihat data atau melakukan tindakan. |
| Module Visibility | Pengaturan modul apa yang tampil untuk role tertentu. |
| Admin | Pengguna yang mengelola akun, akses, dan konfigurasi aplikasi. |
| User | Pengguna Portal ALETA. |
| Manajemen Surat | Modul untuk mencatat, memproses, mendisposisi, dan mencari surat. |
| Disposisi | Arahan atau tindak lanjut atas surat kepada penerima tertentu. |
| Lampiran | File pendukung surat. |
| AI | Alat bantu berbasis kecerdasan buatan. |
| Prompt | Instruksi atau pertanyaan kepada AI. |
| Session | Status login pengguna pada browser. |
| Upload | Mengunggah file ke aplikasi. |
| Download | Mengunduh file dari aplikasi. |
| Access Denied | Kondisi ketika user tidak punya izin membuka halaman atau fitur. |

## Lampiran Fitur Terbaru per Peran (7 sampai 18 Oktober 2026)

### Fitur terbaru untuk semua pegawai (rilis 7 sampai 18 Oktober 2026)

Hal yang berubah bagi semua pegawai: tutorial per fitur, masuk otomatis dari SIPP, tampilan semua layar, unduhan tanpa diblokir, dan peringatan sisa blangko.

**Langkah**

1. Tekan tombol bulat bertanda ? di kepala halaman mana pun untuk membuka tutorial fitur halaman itu. Menu Panduan memuat semuanya, lengkap dengan kotak cari dan tanda Baru.
2. Bila Anda sudah masuk SIPP dengan akun sendiri, ALETA mengenali Anda dari sesi SIPP itu lewat tautan akun, NIP, atau nama tanpa gelar. Anda tidak perlu login ulang di ALETA.
3. Buka ALETA dari HP, tablet, laptop, atau TV. Susunan halaman menyesuaikan lebar layar, jadi tidak perlu memperbesar atau menggulir ke samping.
4. Unduhan putusan, BAS, relaas, dan blangko dari SIPP, ABT, dan ALETA tidak lagi diblokir peramban, dan selalu bernama nomor perkara diikuti nama blangko.
5. Sebelum mengunggah atau mengunduh putusan, BAS, atau relaas, ekstensi memeriksa sisa blangko: kurung siku, isian mentah, titik-titik, dan tulisan merah. Anda boleh melanjutkan, atau mengunduh daftar masalahnya lebih dulu.
6. Widget di kiri bawah menampilkan lampu sambungan, kehadiran, kesiapan draf H-7, dan kabar versi ekstensi baru. Tekan Perbarui bila ada versi baru.
7. Di daftar perkara SIPP, penanda warna menunjukkan perkara yang perlu perhatian, misalnya sita, potensi verstek, umur perkara, dan sisa waktu ikrar.
8. Tampilan panel ekstensi menyesuaikan layar. Pada layar 900 piksel ke atas, panel SIPP tampilan UI Baru menempel di sisi kanan sehingga halaman SIPP tidak tertutup. Lebar panel dan ukuran huruf ikut layar sampai TV dan 4K, dan jendela ikon ekstensi tetap nyaman pada zoom 125 sampai 150 persen.

**Catatan**

- Tidak ada tanda ALETA yang masuk ke data SIPP. Yang tertulis ke SIPP memakai akun SIPP Anda sendiri.
- Menu dan tombol yang tampil mengikuti peran Anda. Tidak tampil berarti memang bukan hak peran Anda.
- Pengaturan widget tersimpan per akun dan per peran.

**Jika bermasalah**

- Panel ALETA tidak muncul di SIPP atau ABT: periksa bahwa ekstensi terpasang dan versinya terbaru lewat ikon ekstensi (Perbarui sekarang).
- Menu yang Anda perlukan tidak ada: minta Admin memeriksa peran dan tautan akun Anda.

### Fitur terbaru untuk Super Admin (rilis 7 sampai 18 Oktober 2026)

Pengaturan dan pemantauan yang kini ada di tangan Super Admin: Fitur Satker, Sinkron kembaran, Blangko Saya, identitas satker, Lihat sebagai, dan sesi e-Court lewat WhatsApp.

**Langkah**

1. Fitur Satker (menu Admin): atur tiap fitur menjadi Stabil, Uji coba, atau Mati, dan pilih saluran pembaruan. Fitur yang sudah berjalan sekarang berstatus Stabil.
2. Sinkron kembaran (menu Admin): bila server mati dan ALETA dijalankan di laptop, tulisan ke SIPP dan ABT ditahan di antrean. Sesudah server hidup, tekan Uji sambungan, Periksa bentrok, setujui baris yang aman, lalu Kirim.
3. Blangko Saya: pada tahap awal hanya untuk Super Admin. Setelah dicoba, nyalakan untuk semua peran lewat saklar di Fitur Satker. Pengajuan blangko ke ABT disetujui atau ditolak oleh Super Admin.
4. Pengaturan SIPP & ABT: tab Identitas satker (logo kop, telepon, alamat, laman, surel, kode surat, zona waktu) diterapkan ke blangko ABT dengan cadangan dan tombol Kembalikan.
5. Lihat sebagai: di halaman Panduan dan di ekstensi, tirukan tampilan peran lain untuk memeriksa laporan menu atau tombol yang tidak muncul.
6. Integrasi e-Court: isi nomor dan tanggal SK majelis, baca Kamus variabel ABT, kelola Kamus deteksi dan kalimat, dan baca riwayat login WhatsApp pada kartu Sesi e-Court saya.
7. Sumber Daya Server memantau CPU, memori, dan cakram per server, per ALETA, dan per aplikasi. Widget di SIPP juga menampilkan RAM, CPU, disk, dan GPU khusus untuk Super Admin.

**Catatan**

- Perintah chat e-Court hanya dijawab untuk nomor Super Admin: ecourt status, ecourt tarik, ecourt masuk, ecourt batal, dan ecourt ringkas.
- Bila e-Court meminta captcha, gambarnya dikirim ke WhatsApp Super Admin. Captcha tetap dijawab manusia dan sandi tidak pernah lewat WhatsApp.
- Selama mode kembaran, halaman SIPP dan ABT di laptop hanya dapat dibaca. Hak penuh kembali sendiri saat kembaran dimatikan.

**Jika bermasalah**

- Sesi e-Court sering putus: baca riwayat login pada kartu Sesi e-Court saya, lalu kirim ecourt masuk dari WhatsApp bila perlu masuk ulang.
- Sebuah fitur hilang di satker: periksa statusnya di Fitur Satker. Fitur Uji coba hanya menyala bila satker berada di saluran Uji coba.
- Antrean kembaran bentrok: jangan menarik data baru dari server sebelum antrean selesai dikirim.

### Fitur terbaru untuk Admin (rilis 7 sampai 18 Oktober 2026)

Hal yang perlu diperiksa Admin: tautan akun SIPP, akses menu, penghubung e-Court, hak menu ABT, dan riwayat login WhatsApp.

**Langkah**

1. Manajemen Akun: tinjau tautan akun SIPP yang dibuat ALETA sendiri (dikenali dari sesi SIPP, NIP, atau nama tanpa gelar). Tolak yang keliru. Atur juga peran tambahan seperti kasir atau mediator.
2. Akses Menu: buka atau tutup aplikasi per peran. Aplikasi yang belum matang hanya terlihat Super Admin sampai Anda membukanya untuk peran tertentu.
3. Integrasi e-Court: masuk ke e-Court lebih dulu, isi nomor dan tanggal SK majelis, lalu baca keadaan penghubung. Tarik data menampilkan persen sesuai tahap yang berjalan.
4. Pada Integrasi e-Court, buka Kamus variabel ABT untuk melihat arti dan sumber tiap variabel, serta Kamus deteksi dan kalimat untuk menambah, menguji, atau menonaktifkan pola tanpa menunggu rilis.
5. Pengaturan SIPP & ABT: ubah cara sebuah isian diisi dan atur hak menu ABT per peran. Folder blangko berpasangan: Jenis - Putusan milik hakim, Jenis - BAS milik panitera.
6. Pada kartu Sesi e-Court saya, baca riwayat login e-Court lewat WhatsApp: siapa meminta masuk, kapan, dan hasilnya.
7. Widget ekstensi: atur profil saklar untuk tiap peran. Pengaturan pegawai tersimpan per akun dan per peran.

**Catatan**

- Perubahan hak dan pengaturan berlaku untuk seluruh satuan kerja dan tercatat di Audit Trail.
- Unggah putusan ke SIPP dan e-Court hanya untuk Hakim, Admin, dan Super Admin.
- Rute Integrasi e-Court hanya untuk Admin dan Super Admin.

**Jika bermasalah**

- Pegawai melapor tidak bisa masuk otomatis dari SIPP: periksa tautan akun SIPP-nya di Manajemen Akun.
- Penarikan e-Court berhenti: masuk ulang di bagian paling atas Integrasi e-Court, atau minta Super Admin mengirim ecourt masuk dari WhatsApp.

### Fitur terbaru untuk Ketua dan Wakil Ketua (rilis 7 sampai 18 Oktober 2026)

Penetapan awal perkara dari panel SIPP, SKP Pimpinan, serta peta dan beban kerja sebagai bahan pengambilan keputusan.

**Langkah**

1. Penetapan: di perkara SIPP dengan ekstensi, buka tab Penetapan. Kerjakan Penetapan Majelis Hakim, Penunjukan Panitera Pengganti, Penunjukan Juru Sita, dan Penetapan Hari Sidang. Pilih Pejabat yang menetapkan, dan penetapan tercatat atas akun pejabat itu.
2. Bila keliru menetapkan, pakai Batalkan penetapan terakhir pada menu Perkara ini. Untuk banyak perkara, pakai penetapan massal dari daftar perkara.
3. SKP: pilih SKP Hakim atau SKP Pimpinan, lalu periode bulan, triwulan, atau tahun. Angka dihitung dari SIPP.
4. Peta Perkara menunjukkan sebaran asal perkara dan faktor perceraian di atas peta. Beban Kinerja Konseptor menunjukkan jumlah putusan yang sedang digarap tiap konseptor, sebagai bahan membagi perkara baru.
5. Jadwal Sidang menampilkan kesiapan draf putusan H-7 dan penanda perkara. Hasil sidang dicatat oleh Panitera Pengganti perkara itu, dan pimpinan mengawasi.
6. Verifikasi dokumen e-Litigasi di e-Court dapat dilakukan dari ALETA setelah isinya Anda periksa.

**Catatan**

- Panduan fitur terbaru untuk Hakim juga berlaku bagi Ketua dan Wakil, termasuk Putusan Advance, unggah putusan, dan Blangko Derry.
- Draf dan saran ALETA hanya bahan. Isi putusan tetap tanggung jawab majelis.

**Jika bermasalah**

- Penetapan ditolak karena akun: pilih pejabat yang akun SIPP-nya tertaut ke hakim atau panitera. Akun admin atau meja tidak dapat dipakai.
- Tab Penetapan tidak tampil: tab itu untuk pimpinan, Admin, dan Super Admin.

### Fitur terbaru untuk Hakim (rilis 7 sampai 18 Oktober 2026)

Draf putusan otomatis, Putusan Advance, Blangko Derry di ABT, kartu bacaan, unggah putusan anonim, dan eviden SKP.

**Langkah**

1. Draf H-7: tiap pagi ALETA menyiapkan draf putusan untuk sidang tujuh hari ke depan, baik dikabulkan maupun ditolak. Kesiapannya tampil di Jadwal Sidang, checklist konseptor, ABT, dan widget.
2. Checklist konseptor menuntun delapan langkah, termasuk eksepsi, rekonvensi, dan putusan sela bila ada. Dikoreksi majelis hanya tampil untuk majelis.
3. Putusan Advance: setelah draf di Blangko Derry terisi, jalankan pemeriksaan. Perbaiki yang ditandai, ulangi sampai bersih, lalu tekan Susun draf utuh dan Unduh draf (Word). Bagian merah wajib dilengkapi atau dihapus.
4. Blangko Derry: pilih Isi dari SIPP & input ke ABT, periksa isian yang bertanda ragu, lalu Input semua yang pasti. Sebelum Cetak, ekstensi mengingatkan perbedaan nama, tanggal, majelis, atau kuasa dengan SIPP.
5. Kartu bacaan di panel ABT merangkum alasan, pekerjaan pihak, tanggal KTP, dan tuntutan tambahan beserta kutipan sumbernya. Semuanya usulan yang Anda putuskan.
6. Putusan cerai ditawarkan sesuai status putusan di SIPP. Pada Penguasaan Anak, penyerahan anak punya tiga pilihan: diminta, tidak diminta, atau tidak diminta tetapi ditetapkan Hakim karena jabatannya.
7. Unggah putusan: ALETA membuat putusan anonim sendiri dengan pratinjau, memeriksa sisa blangko, lalu mengisi form Putusan Akhir. Unggah massal tersedia dari daftar perkara.
8. SKP Hakim: tombol Unduh eviden SKP di Rekap Hakim menyiapkan bukti dukung dalam PDF, Excel, Word, atau ZIP.
9. Susun saksi: di panel ALETA pada ABT tekan Susun saksi menurut keadaan perkara. ALETA mengenali jenis perkara dari SIPP (22 kumpulan pertanyaan). Pilih keadaan perkara, jumlah saksi, dan jenis keterangan tiap saksi, lalu Susun pertanyaan dan jawaban. Baris kuning berarti ragu, sebagian, atau berbeda. Baca dan sunting sebelum Simpan ke ABT.
10. Pada harta bersama dan kewarisan, tandai Bantahan Tergugat lalu pilih Diajukan oleh Tergugat untuk saksi dari pihak itu, sehingga keterangannya memuat versi Tergugat. Pada dispensasi kawin, tab Keterangan anak, calon, dan orang tua menyusun tanya-jawab bagi pihak yang didengar. Butir kehamilan dan hubungan badan tercentang sendiri bila posita menyebutnya (tertulis menurut posita); centang Anda menang.
11. Jawab-menjawab e-Court: jawaban, replik, duplik, dan kesimpulan yang diunggah ke e-Court dikenali otomatis. Di Isi dari SIPP & input ke ABT, pokoknya diusulkan ke isian blangko putusan beserta kutipan asalnya dari berkas e-Court. Usulan ini bertanda ragu dan tidak tercentang sendiri; isian yang sudah Anda tulis tidak ditimpa.
12. Panduan pertanyaan saksi: di rincian baris Jadwal Sidang dan di Status Perkara (bawah bagian Saksi) ada Panduan pertanyaan saksi menurut jenis perkara dan keadaannya. Pokok Wajib ditandai lengkap dengan dasar hukum, centang disimpan di peramban ini saja, dan tombol Layar sidang menampilkan satu pertanyaan berhuruf besar untuk laptop atau TV ruang sidang.

**Catatan**

- Unggah putusan ke SIPP dan e-Court hanya untuk Hakim (termasuk Ketua dan Wakil), Admin, dan Super Admin.
- Unggahan ke SIPP tidak pernah diulang otomatis. Bila gagal, periksa dulu di SIPP.
- Hakim yang menjadi mediator melihat tombol Buat hasil mediasi (.rtf) pada Jadwal Mediasi.

**Jika bermasalah**

- Anonimisasi hanya menyamarkan sebagian nama: pakai Tetap unggah bila pratinjau sudah memadai, atau perbaiki sumbernya dahulu.
- Draf H-7 belum ada: kesiapan baru tampil setelah agen pagi berjalan, dan hanya untuk sidang tujuh hari ke depan.

### Fitur terbaru untuk Panitera, Panitera Muda, dan Panitera Pengganti (rilis 7 sampai 18 Oktober 2026)

Kehadiran per orang, skors, tunda dan putus (termasuk ikrar talak), BAS massal, Susun keterangan saksi, Kasir, dan penarikan dokumen e-Court.

**Langkah**

1. Jadwal Sidang: catat kehadiran per orang (pihak, kuasa, saksi), klik nama saksi untuk memanggilnya, dan catat skors dengan alasan serta perkiraan jam lanjut. Semuanya terbawa ke antrian, usulan Dihadiri oleh, dan BAS.
2. Tunda atau putus sidang dari tombol pada baris. Untuk ikrar talak ada dua tombol tunda (Pemohon hadir tetapi belum siap, atau tidak hadir) dan tombol Catat ikrar dilaksanakan yang sekaligus mengisi form Penetapan Ikrar Talak di SIPP.
3. Penetapan ikrar talak disusun dari blangko Derry lalu diunggah sebagai e-Doc atas akun ketua majelis. Biaya ikrar diambil dari biaya perkara yang tercatat pada data satker.
4. BAS massal: pilih perkara, periksa blangko yang diusulkan menurut keadaan, lalu unggah ke e-Doc SIPP. Pakai Ganti e-Doc BAS untuk memperbaiki. Berkas lama dipindahkan ke folder terhapus.
5. Susun keterangan saksi di ABT: identitas saksi terbaca otomatis, pilih set pertanyaan baku, lalu salin paragraf keterangan gaya Ringkas atau Lengkap.
6. Penanda belum upload di Jadwal Sidang dapat ditekan untuk menarik ulang dokumen e-Court khusus perkara itu.
7. Kasir (panitera dan panitera muda): periksa usulan jurnal per kejadian, lalu simpan ke SIPP. Saklar Kasir otomatis di daftar perkara SIPP bawaannya mati.
8. TTE salinan putusan di e-Court dilakukan panitera atau panitera muda. Hakim dan pimpinan memverifikasi dokumen e-Litigasi.
9. Susun saksi menurut keadaan perkara: di panel ALETA pada ABT, pilih keadaan perkara, jumlah saksi, dan jenis keterangan tiap saksi (melihat sendiri, mendengar sendiri, cerita orang lain, sebagian, tidak tahu, atau ragu), lalu Susun pertanyaan dan jawaban. Untuk saksi Tergugat pilih Diajukan oleh Tergugat. Periksa baris kuning, lalu Simpan ke ABT.
10. Pada dispensasi kawin, tab Keterangan anak, calon, dan orang tua menyusun tanya-jawab pihak yang didengar, lalu Salin semua tanya-jawab ke BAS. Butir kehamilan dan hubungan badan tercentang sendiri bila posita menyebutnya (menurut posita); bila Anda mencabut centangnya, butir itu tidak ikut disusun.
11. Jawab-menjawab e-Court: jawaban, replik, duplik, dan kesimpulan di e-Court kini dikenali otomatis dan diusulkan ke isian blangko di Isi dari SIPP & input ke ABT, lengkap dengan kutipan asalnya. Semuanya usulan ragu: periksa dulu sebelum mencentang. Isian yang sudah Anda tulis tidak ditimpa.
12. Panduan pertanyaan saksi: di rincian baris Jadwal Sidang dan di Status Perkara, centang pertanyaan yang sudah ditanyakan kepada tiap saksi. Peringatan kuning muncul bila pokok wajib belum lengkap pada dua saksi. Tombol Cetak lembar panduan mencetak daftarnya di kertas A4, dan tidak ada yang ditulis ke SIPP.

**Catatan**

- BAS ditulis Panitera Pengganti. Panitera, panitera muda, dan pimpinan hanya mengawasi.
- Skors hanya diusulkan masuk BAS bila terjadi sebelum putusan diucapkan.
- Keterangan saksi harus sama dengan yang diucapkan di sidang. Set pertanyaan hanya bahan bantu.

**Jika bermasalah**

- BAS massal tidak mengusulkan blangko: periksa kehadiran sudah tercatat di Jadwal Sidang. Lewat pukul 14.00 tanpa kehadiran, usulannya gugur atau tunda.
- Sidang ikrar ditunda melewati enam bulan: periksa tanggalnya, peringatan muncul sebelum menyimpan.

### Fitur terbaru untuk Juru Sita (rilis 7 sampai 18 Oktober 2026)

Relaas dengan pihak tidak hadir yang sudah tercentang, pengumuman itsbat, tugas pemberitahuan putusan verstek, dan cetak yang lebih cepat.

**Langkah**

1. Buka perkara di ABT dengan ekstensi, lalu buka bagian Juru Sita di panel ALETA.
2. Pihak yang tidak hadir sudah tercentang untuk panggilan dan pemberitahuan putusan. Hilangkan centang bila pihak itu ternyata hadir.
3. Pada sidang pertama itsbat voluntair, daftar bertambah Pengumuman Permohonan Itsbat Nikah.
4. Tugas pemberitahuan putusan verstek tampil di kotak penyatu halaman perkara SIPP sebagai tugas juru sita.
5. Cetak relaas dan pemberitahuan putusan kira-kira dua kali lebih cepat, baik dari Jadwal Sidang, panel SIPP, maupun panel ABT. Periksa hasilnya sebelum ke lapangan.

**Catatan**

- Blangko relaas baru dikenali, misalnya relaas pencegahan perkawinan.
- Relaas hanya untuk juru sita dan juru sita pengganti, serta admin.

**Jika bermasalah**

- Relaas yang diusulkan tidak cocok: pilih blangko yang sesuai jenis perkara secara manual.
- Tombol relaas tidak tampil: tombol itu mengikuti peran. Minta Admin memeriksa peran Anda.

### Fitur terbaru untuk Kasir (rilis 7 sampai 18 Oktober 2026)

Usulan jurnal per kejadian, Kasir otomatis bersaklar, Kasir massal satu hari, rekap sampai tahunan, dan pengingat.

**Langkah**

1. Di Jadwal Sidang, tekan Kasir lalu pilih perkara. Usulan baris jurnal disusun per kejadian: panggilan pertama, sidang ditunda, putusan, ikrar talak, dan tambahan panjar. Tiap kejadian bertanda sudah atau belum.
2. Periksa tiap baris, sunting bila perlu, tekan Pratinjau, lalu Simpan ke SIPP dua kali sebagai konfirmasi. Tambahan panjar ditawarkan tanpa centang, jadi Anda yang memutuskan.
3. Kasir harian: lihat perkara yang bergerak pada satu tanggal, centang yang benar, lalu simpan berurutan. Satu perkara gagal tidak menghentikan yang lain.
4. Di daftar perkara SIPP ada saklar Kasir otomatis (bawaan mati). Bila menyala, ia mengisi redaksi, meterai, PNBP cabut, PNBP dan biaya pemberitahuan putusan, serta sisa panjar untuk perkara yang putus hari itu.
5. Rekap harian sampai tahunan (dengan PDF) dan pengingat sisa panjar atau setor PNBP ada di halaman daftar Jurnal Keuangan Perkara.
6. SKP Kasir dihitung dari SIPP per bulan, triwulan, dan tahun.

**Catatan**

- Perkara yang perlu diperiksa tangan (resi kosong, tarif belum diketahui, keyakinan sedang) tidak dicentang otomatis.
- Baris yang tersimpan memakai akun SIPP Anda sendiri dan tercatat.

**Jika bermasalah**

- Usulan tidak sesuai kejadian: buka dengan tombol Sunting dan periksa daftar keadaan tiap butir sebelum menyimpan.
- Kasir otomatis tidak mengisi apa-apa: pastikan saklarnya menyala dan perkaranya putus pada hari itu.

### Fitur terbaru untuk PTSP dan Operator (rilis 7 sampai 18 Oktober 2026)

Usulan kontak dan pekerjaan di blangko pihak, penarikan berkas e-Court, folder ABT untuk PTSP, dan data umum dari gugatan.

**Langkah**

1. Saat menambah atau mengubah pihak di SIPP dengan ekstensi, email dan nomor HP dari e-Court diusulkan di blangko pihak. Usulan sudah tercentang, dan Anda yang menyimpan.
2. Bila pekerjaan dipilih Lain-Lain padahal uraiannya PNS, TNI, POLRI, BUMN, atau BUMD, ekstensi mengusulkan pilihan yang sesuai. PPPK dihitung terpisah dari PNS.
3. Kendali Berkas: periksa kelengkapan berkas e-Court sebuah perkara, dan tarik yang kurang bila Anda meja PTSP.
4. Penanda dokumen e-Court belum diverifikasi di daftar perkara SIPP menunjukkan perkara yang perlu ditindaklanjuti.
5. Folder blangko PTSP di ABT mengikuti hak menu ABT yang diatur Admin.
6. SKP Petugas Meja dan Operator dihitung dari SIPP per bulan, triwulan, dan tahun.

**Catatan**

- Hanya yang Anda simpan yang tertulis ke SIPP. Periksa NIK, email, dan nomor HP sebelum menyimpan.
- Data pribadi pihak hanya dibuka untuk petugas yang melayani perkara.

**Jika bermasalah**

- Berkas e-Court belum lengkap: tekan tombol tarik berkas pada perkara itu di Kendali Berkas.
- Folder ABT tidak sesuai tugas: minta Admin memeriksa hak menu ABT di Pengaturan SIPP & ABT.

> File HTML/PDF berisi versi lengkap dengan uraian bab, checklist, callout, dan diagram alur teks.
