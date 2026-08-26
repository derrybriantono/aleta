# Buku Panduan Portal ALETA

**Panduan lengkap untuk Dashboard SSO, Pengaturan Portal, Manajemen Surat, Fitur AI, dan Admin**  
Versi: v1.1 - Juli 2026  
Tanggal: 2 Juli 2026  
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

> File HTML/PDF berisi versi lengkap dengan uraian bab, checklist, callout, dan diagram alur teks.
