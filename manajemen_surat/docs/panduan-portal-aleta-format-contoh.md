# Buku Panduan Portal ALETA

Panduan Dashboard SSO, Pengaturan Portal, Manajemen Surat, Fitur AI, dan Admin.

Versi: v1.2 - Juli 2026  
Tanggal: 2 Juli 2026  
Instansi: Pengadilan Agama Donggala

## Ringkasan Format

Dokumen ini mengikuti gaya PDF contoh: A4, heading biru, teks sederhana, tabel formal, daftar langkah, dan footer halaman.

## Ringkasan Fokus

- Dashboard SSO dan Portal Utama.
- Pengaturan Portal ALETA.
- Manajemen Surat.
- Fitur AI.
- Admin.

## Role Umum

| Role | Akses Umum | Catatan |
| --- | --- | --- |
| Super Admin | Mengatur seluruh sistem, user, role, modul, dan konfigurasi penting. | Hanya untuk pengelola inti. |
| Admin | Mengelola user, role, permission, jabatan, dan pengaturan operasional. | Perlu uji akses setelah perubahan. |
| Operator Surat | Membuat, mengedit, mencari, mengunggah lampiran, dan memproses surat. | Role utama Manajemen Surat. |
| Hakim | Melihat surat/disposisi yang terkait dengan tugasnya. | Akses mengikuti disposisi dan kebijakan. |
| Panitera | Memantau atau menindaklanjuti surat sesuai kewenangan. | Dapat berbeda sesuai jabatan. |
| Jurusita | Melihat tugas atau disposisi pelaksanaan yang relevan. | Tidak otomatis melihat semua surat. |
| User Biasa | Mengakses fitur yang diberikan secara terbatas. | Tidak dapat membuka admin tanpa permission. |

## Data Surat

| Data | Fungsi | Catatan |
| --- | --- | --- |
| Nomor Surat | Identitas utama surat. | Wajib teliti agar tidak menyulitkan arsip. |
| Tanggal Surat | Tanggal dokumen diterbitkan. | Bedakan dengan tanggal terima/kirim. |
| Asal/Tujuan | Sumber atau penerima surat. | Gunakan nama yang jelas dan konsisten. |
| Perihal | Ringkasan isi surat. | Singkat, jelas, dan mudah dicari. |
| Kategori/Klasifikasi | Pengelompokan administrasi. | Membantu filter dan laporan. |
| Status | Tahap pemrosesan surat. | Perbarui sesuai perkembangan. |
| Lampiran | File pendukung digital. | Upload file valid dan sesuai hak akses. |
| Disposisi | Arahan/tugas kepada penerima. | Pilih penerima yang benar. |

## Troubleshooting

| Masalah | Kemungkinan Penyebab | Solusi | Ditangani Oleh |
| --- | --- | --- | --- |
| Tidak bisa login | Identitas/password salah, akun nonaktif, atau session bermasalah. | Periksa identitas, coba login ulang, hubungi admin bila tetap gagal. | User/Admin |
| User tidak aktif | Akun dinonaktifkan karena kebijakan atau perubahan tugas. | Admin memverifikasi lalu mengaktifkan bila masih berwenang. | Admin |
| Menu tidak muncul | Role, permission, atau module visibility belum diberikan. | Admin memeriksa pengaturan akses. | Admin |
| Akses ditolak | User membuka halaman tanpa hak akses. | Gunakan menu yang tersedia atau ajukan kebutuhan akses. | User/Admin |
| Data surat tidak tampil | Filter aktif, data kosong, atau akses terbatas. | Reset filter, cek kata kunci, dan pastikan hak akses. | User/Operator |
| Gagal tambah surat | Field wajib kosong atau format input salah. | Lengkapi data dan perbaiki format. | Operator |
| Gagal disposisi | Penerima tidak valid atau instruksi belum jelas. | Pilih penerima valid dan isi instruksi. | Operator/Pejabat |
| Gagal upload lampiran | Format/ukuran file tidak sesuai atau koneksi terganggu. | Gunakan file valid dan ulangi upload. | Operator |
| AI tidak merespons | Fitur AI belum aktif atau konfigurasi belum lengkap. | Admin memeriksa pengaturan AI. | Admin |
| Hasil AI kurang tepat | Prompt terlalu umum atau konteks kurang. | Perjelas instruksi dan verifikasi manual. | User |
| Halaman loading terus | Koneksi lambat, session kedaluwarsa, atau API bermasalah. | Refresh, login ulang, lalu laporkan bila berulang. | User/Admin |
| Error server/API | Gangguan backend, database, atau konfigurasi. | Catat waktu, halaman, aksi terakhir, dan pesan error. | Admin/Teknis |
