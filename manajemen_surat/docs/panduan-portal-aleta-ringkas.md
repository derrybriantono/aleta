# Buku Panduan Portal ALETA

**Panduan Dashboard SSO, Manajemen Surat, Fitur AI, dan Admin**  
Versi dokumen: v1.0 - Juli 2026  
Tanggal pembuatan: 2 Juli 2026  
Instansi: Pengadilan Agama Donggala

> Panduan ini dibuat tanpa screenshot agar lebih bersih, ringan, dan mudah diperbarui.

## Daftar Isi

1. Kata Pengantar
2. Gambaran Umum Portal ALETA
3. Konsep Dashboard SSO ALETA
4. Pengaturan Portal ALETA
5. Panduan Login dan Logout
6. Panduan Manajemen Surat
7. Panduan Fitur AI
8. Panduan Admin
9. Aplikasi Pengembangan Selanjutnya
10. Troubleshooting
11. FAQ
12. Glosarium
13. Lampiran

## 1. Kata Pengantar

Portal ALETA adalah pusat akses aplikasi internal yang dirancang untuk memudahkan pengguna membuka layanan kerja dari satu dashboard. Panduan ini disusun untuk dua kelompok utama: pengguna harian dan admin pengelola sistem.

Panduan ini tidak memakai screenshot. Sebagai gantinya, buku panduan menggunakan penjelasan langkah, tabel ringkas, callout, dan diagram alur agar tetap rapi serta mudah diperbarui saat tampilan aplikasi berubah.

## 2. Gambaran Umum Portal ALETA

Portal ALETA berfungsi sebagai SSO dan portal kumpulan aplikasi internal. Pengguna cukup login satu kali, lalu aplikasi yang tampil akan mengikuti role, permission, dan module visibility yang diberikan oleh admin.

Manfaat utama:

- Akses aplikasi lebih terpusat.
- Administrasi lebih tertib.
- Pekerjaan lebih cepat.
- Keamanan akses lebih baik.
- Siap dikembangkan untuk modul baru.

Alur umum:

```text
User -> Login ALETA -> Dashboard SSO -> Pilih Aplikasi -> Gunakan Fitur Sesuai Hak Akses
```

## 3. Konsep Dashboard SSO ALETA

Dashboard SSO adalah halaman utama setelah login. Pengguna dapat melihat kartu aplikasi, membuka modul, melihat menu, dan kembali ke portal utama kapan saja.

| Komponen Dashboard | Fungsi | Siapa yang Menggunakan |
| --- | --- | --- |
| Kartu aplikasi | Menampilkan aplikasi yang dapat dibuka pengguna. | Semua pengguna sesuai role. |
| Sidebar/menu | Navigasi cepat ke dashboard, aplikasi, tugas, dan pengaturan yang diizinkan. | Semua pengguna. |
| Profil akun | Menampilkan identitas akun aktif dan akses logout. | Semua pengguna. |
| Access control | Menyaring menu berdasarkan role, permission, dan module visibility. | Sistem dan admin. |
| Informasi sistem | Memberi status, notifikasi, atau pengumuman jika tersedia. | User dan admin. |

Catatan penting: menu yang tampil pada setiap pengguna dapat berbeda karena sistem membaca role, permission, dan module visibility.

## 4. Pengaturan Portal ALETA

Pengaturan Portal ALETA mencakup profil pengguna, akses aplikasi, pengaturan modul aktif/nonaktif, role, permission, dan konfigurasi yang memengaruhi menu pengguna.

Prinsip penting:

1. Setiap pengguna harus memakai akun pribadi.
2. Role harus diberikan sesuai tugas.
3. Permission diberikan secukupnya.
4. Module visibility menentukan aplikasi yang tampil.
5. Perubahan akses perlu diuji setelah disimpan.

## 5. Panduan Login dan Logout

Langkah login:

1. Buka halaman login Portal ALETA.
2. Isi username, email, NIP, atau nomor HP sesuai akun.
3. Isi password.
4. Klik tombol login.
5. Jika berhasil, pengguna masuk ke Dashboard SSO.

Langkah logout:

1. Buka menu profil akun.
2. Pilih logout.
3. Pastikan kembali ke halaman login.
4. Tutup browser bila memakai perangkat bersama.

| Masalah | Penyebab | Solusi |
| --- | --- | --- |
| Tidak bisa login | Username atau password salah. | Periksa kembali identitas dan password, lalu coba lagi. |
| Akun tidak aktif | Akun dinonaktifkan oleh admin. | Hubungi admin untuk aktivasi. |
| Menu tidak muncul | Role atau module visibility belum diberikan. | Hubungi admin agar akses diperiksa. |
| Sesi berakhir | Session sudah kedaluwarsa atau browser dibersihkan. | Login ulang melalui halaman login ALETA. |

## 6. Panduan Manajemen Surat

Manajemen Surat adalah aplikasi untuk mencatat surat, mengelola surat masuk dan keluar, mengunggah lampiran, mencari arsip, melihat detail, mengedit data, dan melakukan disposisi.

Alur kerja:

```text
Surat Diterima -> Input Data Surat -> Upload Lampiran -> Simpan -> Disposisi -> Tindak Lanjut -> Arsip/Pencarian
```

### A. Fungsi Manajemen Surat

- Mencatat surat.
- Mengelola surat masuk.
- Mengelola surat keluar bila tersedia.
- Mengunggah lampiran.
- Mencari dan memfilter surat.
- Melihat detail.
- Mengedit data.
- Melakukan disposisi.
- Mengatur status surat.

### B. Tambah Surat

1. Buka menu Manajemen Surat.
2. Pilih tambah surat.
3. Isi nomor, tanggal, asal/tujuan, perihal, kategori, dan data lain yang wajib.
4. Upload lampiran bila ada.
5. Simpan.
6. Pastikan data masuk ke daftar surat.

### C. Detail dan Edit Surat

Pada halaman detail, pengguna dapat memeriksa metadata surat, lampiran, status, dan riwayat disposisi. Edit hanya boleh dilakukan oleh role yang berwenang.

### D. Disposisi Surat

Disposisi digunakan untuk memberi instruksi atau tindak lanjut kepada penerima tertentu. Penerima hanya melihat disposisi sesuai hak aksesnya.

### E. Pencarian dan Filter

Gunakan pencarian kata kunci, filter status, filter kategori/tanggal bila tersedia, dan pagination untuk menelusuri data lebih cepat.

### F. Upload dan Download Lampiran

Lampiran harus memakai format yang diizinkan, ukuran wajar, dan hanya dapat diakses oleh pengguna yang berhak.

| Role | Akses yang Umum Diberikan | Catatan |
| --- | --- | --- |
| Super Admin | Semua akses, pengaturan, audit, dan pemulihan data. | Gunakan hanya untuk pengaturan tingkat sistem. |
| Admin | Mengelola user, modul, dan konfigurasi operasional. | Akses dapat dibatasi sesuai kebijakan satker. |
| Operator Surat | Input, edit, arsip, upload lampiran, dan pemantauan surat. | Role utama untuk administrasi surat. |
| Hakim | Melihat surat atau disposisi yang menjadi kewenangannya. | Akses mengikuti tugas/disposisi. |
| Panitera | Melihat, memberi arahan, atau memantau disposisi sesuai kewenangan. | Akses menyesuaikan struktur jabatan. |
| Jurusita | Melihat tugas atau disposisi terkait pelaksanaan tugas. | Tidak semua data surat harus terbuka. |
| User biasa | Akses terbatas sesuai permission. | Tidak dapat membuka fitur admin. |

## 7. Panduan Fitur AI

AI di Portal ALETA membantu pekerjaan administratif dan analisis awal, seperti menyusun draft, meringkas informasi, memberi rekomendasi, merapikan bahasa, dan mengecek konsistensi dokumen.

Cara menggunakan AI:

1. Buka fitur AI pada modul yang tersedia.
2. Masukkan instruksi dengan jelas.
3. Periksa hasil yang diberikan.
4. Edit atau sesuaikan hasil.
5. Jangan langsung memakai hasil AI tanpa pemeriksaan manusia.

Batasan AI:

- AI hanya alat bantu.
- Hasil AI wajib diverifikasi.
- AI tidak menggantikan kewenangan pejabat/pengguna.
- Jangan memasukkan data sensitif yang tidak diperlukan.
- Pengguna tetap bertanggung jawab atas hasil akhir.

Contoh penggunaan:

- Membuat ringkasan surat.
- Menyusun draft narasi.
- Membuat daftar poin penting.
- Mengecek konsistensi dokumen.
- Merapikan bahasa.

## 8. Panduan Admin

Admin mengelola user, role, permission, jabatan, akses modul, pengaturan aplikasi, serta kesiapan Portal ALETA.

Manajemen User:

1. Tambah user.
2. Edit data user.
3. Nonaktifkan user yang tidak lagi berwenang.
4. Aktifkan kembali user bila diperlukan.
5. Mapping user ke role.
6. Mapping user ke jabatan.

Role dan Permission:

- Role adalah peran umum.
- Permission adalah izin spesifik.
- Admin harus berhati-hati memberi akses.
- Akses berlebih dapat menimbulkan risiko kebocoran data.

Module Visibility:

- Mengaktifkan modul untuk role tertentu.
- Menonaktifkan modul yang tidak relevan.
- Perubahan berdampak pada menu dan akses.
- Setelah mengubah akses, admin perlu menguji dengan akun terkait.

Checklist Admin:

- User sudah dibuat dan statusnya aktif.
- Role pengguna sudah sesuai tugas.
- Jabatan/posisi pengguna sudah benar.
- Module visibility sudah diatur untuk setiap role.
- Akses Manajemen Surat sudah diuji dari akun non-admin.
- Fitur AI sudah dikonfigurasi sesuai kebijakan.
- Tidak ada user yang memiliki akses lebih besar dari kebutuhan tugas.
- Admin memeriksa error dan laporan penggunaan secara berkala.

## 9. Aplikasi Pengembangan Selanjutnya

Portal ALETA dapat dikembangkan dengan aplikasi tambahan seperti aplikasi monitoring, integrasi data, dokumen, notifikasi, dan layanan internal lain.

Modul seperti ALETA x SIPP, ALETA Justicia Legal Form, Query Registry, Variable Registry, dan WhatsApp Gateway dapat menjadi bagian dari ekosistem pengembangan selanjutnya. Detail teknis modul tersebut tidak dibahas dalam panduan ringkas ini.

## 10. Troubleshooting

| Masalah | Kemungkinan Penyebab | Solusi | Ditangani Oleh |
| --- | --- | --- | --- |
| Tidak bisa login | Username/password salah, akun nonaktif, atau session bermasalah. | Coba ulang, pastikan identitas benar, hubungi admin bila akun nonaktif. | User dan Admin |
| Password salah | Password tidak sesuai data akun. | Gunakan password yang benar atau minta reset sesuai prosedur. | User dan Admin |
| User tidak aktif | Akun dinonaktifkan. | Admin mengaktifkan kembali bila pengguna masih berwenang. | Admin |
| Menu tidak muncul | Role, permission, atau module visibility belum sesuai. | Admin memeriksa pengaturan akses. | Admin |
| Tidak punya akses | URL dibuka langsung tanpa permission. | Gunakan menu yang tersedia atau minta evaluasi akses. | User dan Admin |
| Data surat tidak tampil | Filter terlalu sempit, akses terbatas, atau data belum tersedia. | Reset filter, cek hak akses, dan cek data sumber. | User dan Operator |
| Gagal tambah surat | Field wajib belum lengkap atau format salah. | Lengkapi data wajib dan perbaiki format input. | Operator |
| Gagal upload lampiran | File terlalu besar, format tidak didukung, atau koneksi bermasalah. | Gunakan file valid dan ulangi upload. | Operator |
| Gagal download lampiran | Akses tidak sesuai, file hilang, atau server bermasalah. | Cek hak akses dan hubungi admin bila file tidak tersedia. | User dan Admin |
| Fitur AI tidak merespons | AI belum aktif, konfigurasi belum lengkap, atau layanan sedang bermasalah. | Admin memeriksa pengaturan AI dan status layanan. | Admin |
| Hasil AI kurang sesuai | Instruksi terlalu umum atau data konteks kurang lengkap. | Perbaiki prompt, beri konteks jelas, dan validasi manual. | User |
| Halaman loading terus | Koneksi lambat, session bermasalah, atau API belum merespons. | Refresh halaman, login ulang, lalu laporkan ke admin bila berulang. | User dan Admin |
| Error server/API | Layanan backend, database, atau konfigurasi bermasalah. | Catat waktu kejadian dan laporkan ke tim teknis. | Admin dan Teknis |

## 11. FAQ

**Apa itu Portal ALETA?**

Portal ALETA adalah pusat akses aplikasi internal yang menyatukan login, dashboard, dan modul kerja dalam satu portal.

**Apakah ALETA satu aplikasi atau kumpulan aplikasi?**

ALETA adalah portal terpadu yang dapat berisi banyak aplikasi internal sesuai kebutuhan satker.

**Apa itu SSO?**

SSO atau Single Sign On berarti pengguna cukup login satu kali untuk membuka aplikasi yang diizinkan.

**Kenapa menu saya berbeda dengan user lain?**

Menu mengikuti role, permission, jabatan, dan module visibility yang diatur admin.

**Siapa yang bisa mengatur user?**

Super Admin dan Admin yang memiliki izin pengelolaan user.

**Siapa yang bisa mengakses Manajemen Surat?**

Pengguna yang diberi akses oleh admin, misalnya operator surat, pejabat terkait, atau role lain sesuai kebijakan.

**Apakah AI menggantikan pekerjaan pengguna?**

Tidak. AI hanya alat bantu, keputusan dan tanggung jawab tetap pada pengguna/pejabat berwenang.

**Apakah hasil AI harus diperiksa?**

Ya. Semua hasil AI wajib diverifikasi sebelum digunakan.

**Apa yang harus dilakukan jika tidak bisa login?**

Periksa identitas dan password, lalu hubungi admin jika akun terkunci atau tidak aktif.

**Apa yang harus dilakukan jika modul tidak muncul?**

Hubungi admin untuk memeriksa role, permission, dan module visibility.

**Apakah akan ada aplikasi tambahan di ALETA?**

Ya. Portal ALETA dirancang agar modul baru dapat ditambahkan ke dashboard secara bertahap.

## 12. Glosarium

| Istilah | Penjelasan |
| --- | --- |
| Portal | Pusat akses aplikasi internal. |
| SSO | Single Sign On, mekanisme login satu kali untuk banyak aplikasi. |
| Dashboard | Halaman utama setelah login. |
| Role | Peran pengguna, misalnya admin, operator, hakim, panitera, atau user biasa. |
| Permission | Izin spesifik untuk melihat atau melakukan aksi tertentu. |
| Module Visibility | Pengaturan modul mana yang tampil dan dapat dibuka oleh role tertentu. |
| Admin | Pengguna yang mengelola akun, akses, dan pengaturan aplikasi. |
| User | Pengguna aplikasi Portal ALETA. |
| Manajemen Surat | Modul pengelolaan surat digital. |
| Disposisi | Proses pemberian arahan/tugas atas surat kepada penerima tertentu. |
| Lampiran | File pendukung surat, seperti dokumen PDF atau berkas lain yang valid. |
| AI | Alat bantu berbasis kecerdasan buatan untuk meringkas, menyusun, atau memberi rekomendasi awal. |
| Prompt | Instruksi atau pertanyaan yang diberikan pengguna kepada AI. |
| Session | Status login pengguna selama menggunakan aplikasi. |
| Upload | Mengunggah file dari perangkat ke aplikasi. |
| Download | Mengunduh file dari aplikasi ke perangkat. |
| Access Denied | Kondisi ketika pengguna tidak memiliki izin untuk membuka halaman atau fitur. |

## 13. Lampiran

Checklist penggunaan harian user:

- Login memakai akun pribadi.
- Buka hanya menu yang diperlukan.
- Periksa data sebelum menyimpan.
- Logout setelah selesai.

Checklist kesiapan awal aplikasi:

- User aktif tersedia.
- Role dan permission sesuai.
- Module visibility sudah diatur.
- Manajemen Surat bisa dibuka.
- Pengaturan AI sudah sesuai kebijakan bila digunakan.

Ringkasan penggunaan AI aman:

- Beri instruksi jelas.
- Jangan memasukkan data sensitif yang tidak perlu.
- Verifikasi hasil.
- Gunakan hasil AI sebagai bahan bantu, bukan keputusan final.
