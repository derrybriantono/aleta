# Buku Panduan Penggunaan Portal ALETA

**Panduan User, Admin, dan Admin Teknis**

**Versi Dokumen:** v1.0 - Juli 2026
**Tanggal:** 2 Juli 2026
**Instansi:** Pengadilan Agama Donggala

> **Ringkasan:** ALETA adalah SSO dan portal utama untuk masuk ke kumpulan aplikasi internal. User login satu kali, lalu sistem menampilkan aplikasi sesuai role, permission, dan module visibility.

## Kata Pengantar

Buku panduan ini disusun untuk membantu pegawai, operator, admin, dan admin teknis memahami Portal ALETA secara aman dan konsisten. Dokumen ini menekankan bahwa ALETA adalah pusat akses berbagai aplikasi internal, dilengkapi dukungan AI dan WhatsApp Gateway.

## Daftar Isi

1. Gambaran Umum Portal ALETA
2. Konsep SSO dan Portal Aplikasi
3. Persona Pengguna
4. Login, Logout, dan Session
5. Dashboard, Sidebar, dan Profil
6. Panduan User Biasa
7. Panduan Admin
8. Panduan Admin Teknis
9. Manajemen Surat
10. ALETA Bot dan WhatsApp Gateway
11. Fitur AI
12. ALETA x SIPP
13. ALETA Justicia Legal Form / JLF
14. Query Registry dan Variable Registry
15. Upload dan Download File
16. Role, Permission, dan Module Visibility
17. Pengaturan Sistem
18. Operasional Harian dan Checklist
19. Troubleshooting
20. FAQ
21. Glosarium

# Gambaran Umum Portal ALETA

Portal ALETA adalah SSO dan portal utama untuk masuk ke kumpulan aplikasi internal. User login satu kali, lalu sistem menampilkan aplikasi yang boleh dipakai berdasarkan role, permission, dan module visibility.

Portal ini menyatukan Manajemen Surat, Disposisi, ALETA Bot, WhatsApp Gateway, ALETA x SIPP, Query Registry, Variable Registry, ALETA Justicia Legal Form / JLF, Asisten Hakim, E-Kepegawaian, E-Status, Panduan, Patch Notes, Saran/Masukan, serta pengaturan admin.

Manfaat utamanya adalah akses terpusat, navigasi lebih sederhana, data operasional dari database, dukungan AI, dan komunikasi otomatis melalui WhatsApp Gateway.

![Dashboard Portal](screenshots/portal.png)

_Gambar: Dashboard utama setelah login.._


![Sidebar dan Menu Utama](screenshots/sidebar-menu.png)

_Gambar: Menu utama mengikuti role dan permission.._


# Konsep SSO dan Portal Aplikasi

SSO atau Single Sign On berarti pengguna cukup login sekali untuk masuk ke portal. Setelah login, ALETA membaca session, status user, role, permission, jabatan, dan visibility modul.

Menu tiap user bisa berbeda. Jika modul tidak muncul, penyebab paling umum adalah role belum diberi akses, permission belum lengkap, atau module visibility belum aktif untuk role tersebut.

Portal bukan hanya halaman menu. Setiap route dan API tetap perlu perlindungan hak akses agar user tidak dapat membuka data hanya dengan mengetik URL.

![Halaman Login Portal ALETA](screenshots/login.png)

_Gambar: Halaman login SSO Portal ALETA.._


# Persona Pengguna

User biasa membuka modul yang tersedia, membaca informasi, mengunduh dokumen yang diizinkan, dan menindaklanjuti tugas atau disposisi.

Operator surat menginput surat masuk/keluar, mengunggah lampiran, mencari data, dan membantu distribusi disposisi.

Hakim, Panitera, Panitera Pengganti, Jurusita, dan role operasional lain memakai modul sesuai kewenangan dan dapat menerima notifikasi jika ALETA Bot dikonfigurasi.

Admin mengelola user, role, jabatan, modul, template pesan, AI, dan pengaturan aplikasi. Admin teknis menangani database, upload folder, datasource SIPP, preflight, query registry, WhatsApp session, dan konfigurasi server.

# Login, Logout, dan Session

Buka halaman login, isi username/email/NIP/nomor HP dan password, lalu klik Login. Jika opsi ingat akun tersedia, gunakan hanya pada perangkat pribadi.

Login gagal dapat terjadi karena identitas salah, password salah, user nonaktif, atau session bermasalah. Gunakan fitur lupa password bila tersedia atau hubungi admin.

Logout harus dilakukan setelah selesai bekerja, terutama pada komputer bersama. Setelah logout, halaman protected seperti Admin, Surat, ALETA Bot, dan ALETA x SIPP tidak boleh terbuka tanpa login ulang.

![Halaman Login Portal ALETA](screenshots/login.png)

_Gambar: Halaman login SSO Portal ALETA.._


![Contoh Login Gagal](screenshots/login-gagal.png)

_Gambar: Contoh pesan login gagal.._


# Dashboard, Sidebar, dan Profil

Dashboard Portal menampilkan aplikasi yang tersedia, pintasan modul, informasi ringkas, dan navigasi. Sidebar adalah jalur utama berpindah antar aplikasi.

Halaman profil atau account menampilkan informasi akun. Jika role atau permission berubah, user biasanya perlu login ulang agar hak akses terbaru terbaca.

![Dashboard Portal](screenshots/portal.png)

_Gambar: Dashboard utama setelah login.._


![Profil Pengguna](screenshots/account.png)

_Gambar: Halaman akun/profil pengguna.._


# Panduan User Biasa

Alur harian user: login, cek dashboard, buka modul kerja, input atau baca data, gunakan AI bila tersedia, cek notifikasi, verifikasi hasil, lalu logout.

User tidak boleh membagikan akun, mengunggah file tidak relevan, mengirim WhatsApp live tanpa izin, mengakses data di luar kewenangan, atau memasukkan data sensitif ke AI tanpa kebutuhan kerja yang jelas.

![Daftar Surat](screenshots/surat-list.png)

_Gambar: Daftar surat, filter, dan pencarian.._


![Disposisi](screenshots/disposisi.png)

_Gambar: Daftar disposisi dan tindak lanjut.._


# Panduan Admin

Admin bertugas mengelola user, role, permission, jabatan, module visibility, pengaturan sistem, template bot, AI, dan WhatsApp Gateway.

Perubahan role, permission, dan module visibility harus diuji dengan login user terkait. Menu yang hilang harus diikuti proteksi route dan API.

![Dashboard Admin](screenshots/admin.png)

_Gambar: Halaman administrasi sistem.._


![Manajemen User](screenshots/admin-users.png)

_Gambar: Area manajemen user dan akses.._


![Jabatan dan Mapping User](screenshots/positions.png)

_Gambar: Pengaturan jabatan dan mapping user. (placeholder otomatis)._


![Module Visibility](screenshots/module-visibility.png)

_Gambar: Pengaturan visibility modul per role.._


# Panduan Admin Teknis

Admin teknis memastikan database terkoneksi, schema/migration sesuai, upload folder writable, SIPP datasource read-only tersedia, query registry sinkron, WhatsApp Gateway jelas statusnya, AI provider dikonfigurasi, dan preflight lulus.

Jangan memasukkan .env, token, API key, cookie, session WhatsApp, password, atau secret apa pun ke PDF, screenshot, maupun dokumen publik.

![Pengaturan AI](screenshots/ai-settings.png)

_Gambar: Pengaturan fitur AI.._


![Status WhatsApp Gateway](screenshots/whatsapp-status.png)

_Gambar: Status WhatsApp Gateway dan session.._


# Manajemen Surat

Manajemen Surat mengelola surat masuk, surat keluar, lampiran, disposisi, status, pencarian, filter, pagination, dan workflow administrasi.

Untuk menambah surat, isi metadata wajib, unggah lampiran bila ada, simpan, lalu pastikan surat muncul di daftar. Untuk disposisi, pilih penerima yang benar berdasarkan jabatan/user dan pastikan catatan tindak lanjut jelas.

Jika AI tersedia untuk surat, gunakan sebagai bantuan ringkasan, klasifikasi, atau saran disposisi. Hasil AI tetap wajib diperiksa operator/pejabat berwenang.

![Dashboard Manajemen Surat](screenshots/surat-dashboard.png)

_Gambar: Dashboard modul Manajemen Surat.._


![Daftar Surat](screenshots/surat-list.png)

_Gambar: Daftar surat, filter, dan pencarian.._


![Surat Masuk](screenshots/surat-masuk.png)

_Gambar: Halaman surat masuk.._


![Surat Keluar](screenshots/surat-keluar.png)

_Gambar: Halaman surat keluar.._


![Disposisi](screenshots/disposisi.png)

_Gambar: Daftar disposisi dan tindak lanjut.._


# ALETA Bot dan WhatsApp Gateway

ALETA Bot mengelola notifikasi, template pesan, role penerima, preview penerima, dry-run, queue, log pengiriman, health check, worker, dan laporan WhatsApp.

WhatsApp Gateway adalah penghubung aplikasi dengan WhatsApp. Gateway dapat memiliki status online/offline, QR/session, antrean, dan log pengiriman.

Dry-run adalah simulasi tanpa mengirim pesan nyata. Live send adalah pengiriman sungguhan. Jangan menjalankan live send sebelum template, penerima, dan mode pengiriman diverifikasi.

![ALETA Bot](screenshots/aleta-bot.png)

_Gambar: Dashboard ALETA Bot.._


![Admin ALETA Bot](screenshots/admin-aleta-bot.png)

_Gambar: Pengaturan ALETA Bot, template, dan queue.._


![Status WhatsApp Gateway](screenshots/whatsapp-status.png)

_Gambar: Status WhatsApp Gateway dan session.._


# Fitur AI

AI di Portal ALETA membantu pekerjaan tertentu seperti ekstraksi surat, ringkasan, saran klasifikasi, saran disposisi, Asisten Hakim, draft/analisis JLF, konsistensi dokumen, anonymizer, dan template assistant.

AI tidak menggantikan kewenangan manusia. User wajib memeriksa hasil AI sebelum dipakai untuk tindakan administratif atau dokumen resmi.

Jangan memasukkan data sensitif ke AI jika tidak diperlukan. Admin harus memastikan provider, policy, dan permission sesuai kebijakan kantor.

![Asisten Hakim / AI](screenshots/asisten-hakim.png)

_Gambar: Fitur bantuan AI.._


![Pengaturan AI](screenshots/ai-settings.png)

_Gambar: Pengaturan fitur AI.._


# ALETA x SIPP

ALETA x SIPP menghubungkan Portal ALETA dengan data SIPP secara read-only. Modul ini menyediakan dictionary database, datasource status, Query Registry, Variable Registry, monitoring pendukung2018, penilaian SK SIPP, export, filter, dan pencarian.

Prinsip utama: ALETA x SIPP membaca data SIPP, bukan menulis ke database SIPP. Query yang belum aman harus tetap needs_review dan tidak boleh dieksekusi live.

![ALETA x SIPP](screenshots/aleta-sipp.png)

_Gambar: Dashboard ALETA x SIPP.._


![Query Registry](screenshots/query-registry.png)

_Gambar: Query Registry read-only.._


![Variable Registry](screenshots/variable-registry.png)

_Gambar: Variable Registry SIPP/JLF.._


![Monitoring dan SK SIPP](screenshots/monitoring-sipp.png)

_Gambar: Monitoring pendukung2018 dan SK SIPP.._


# ALETA Justicia Legal Form / JLF

JLF membantu membuat dokumen/form hukum berbasis template, nomor perkara, variable otomatis, data SQL, data SIPP, multi sidang, jadwal sidang, preview, generate, dan download dokumen.

Jika variable belum lengkap, user/admin perlu melengkapi mapping atau input manual. Bantuan AI di JLF dapat dipakai untuk draft, analisis, konsistensi, dan template bila dikonfigurasi.

![ALETA Justicia Legal Form](screenshots/jlf.png)

_Gambar: Dashboard JLF.._


![Template JLF](screenshots/jlf-templates.png)

_Gambar: Daftar template legal form.._


![Variable JLF](screenshots/jlf-variables.png)

_Gambar: Daftar variable JLF.._


# Query Registry dan Variable Registry

Query Registry menyimpan query yang dikatalogkan, direview, dan diberi status. Query SIPP wajib SELECT-only, memakai parameter aman, dan tidak boleh memuat INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, atau REPLACE.

Variable Registry menyimpan mapping variable legacy/modern untuk JLF, data SIPP, dan template. Registry membuat query dan variable bisa diaudit, dicari, dan dipakai ulang.

![Query Registry](screenshots/query-registry.png)

_Gambar: Query Registry read-only.._


![Variable Registry](screenshots/variable-registry.png)

_Gambar: Variable Registry SIPP/JLF.._


# Upload dan Download File

Upload digunakan untuk lampiran surat, dokumen JLF, logo, PDF, dan file pendukung lain sesuai modul. Upload hanya file relevan dan aman.

Download hanya boleh dilakukan oleh user yang berhak. Jika file gagal dibuka, hubungi admin untuk memeriksa metadata, hak akses, dan file fisik.

![Daftar Surat](screenshots/surat-list.png)

_Gambar: Daftar surat, filter, dan pencarian.._


# Role, Permission, dan Module Visibility

Role adalah kelompok akses seperti Super Admin, Admin, Hakim, Panitera, Panitera Pengganti, Jurusita, Operator, dan User biasa. Permission adalah izin spesifik untuk melihat, membuat, mengubah, menghapus, menjalankan, atau mengelola fitur.

Module visibility menentukan apakah modul tampil di menu role tertentu. Jika akses ditolak, ajukan akses melalui admin sesuai SOP.

![Module Visibility](screenshots/module-visibility.png)

_Gambar: Pengaturan visibility modul per role.._


![Contoh Akses Ditolak](screenshots/access-denied.png)

_Gambar: Contoh route yang dibatasi akses.._


# Pengaturan Sistem

Pengaturan sistem meliputi identitas instansi, panel, akses publik, AI, WhatsApp, module visibility, template, backup, database, dan preflight.

Admin boleh mengubah pengaturan operasional. Admin teknis menangani konfigurasi server, env, database, SIPP datasource, WhatsApp session, backup, dan restore.

![Dashboard Admin](screenshots/admin.png)

_Gambar: Halaman administrasi sistem.._


![Pengaturan AI](screenshots/ai-settings.png)

_Gambar: Pengaturan fitur AI.._


![Status WhatsApp Gateway](screenshots/whatsapp-status.png)

_Gambar: Status WhatsApp Gateway dan session.._


# Operasional Harian dan Checklist

Checklist user: login, cek dashboard, buka modul, input data, upload file valid, gunakan AI bila perlu, verifikasi hasil, logout.

Checklist admin: cek user aktif, role, jabatan, module visibility, log bot, status WhatsApp, template pesan, konfigurasi AI, query needs_review, dan preflight.

Checklist staging/public: admin tersedia, role sesuai, modul aktif, upload folder siap, database terkoneksi, template bot tersedia, dry-run/live jelas, AI siap, datasource SIPP siap, dan WhatsApp live diuji di staging.

# Troubleshooting

Tidak bisa login: cek identitas, password, status user, session, atau hubungi admin.

Menu tidak muncul: cek role, permission, dan module visibility.

Data tidak tampil: cek filter, koneksi database, atau status API.

Upload/download gagal: cek jenis file, ukuran, hak akses, upload folder, dan metadata file.

WhatsApp Gateway offline: cek session, QR, runtime bot, dan log.

Pesan tidak terkirim: cek dry-run, template, penerima, queue, gateway, dan delivery log.

AI tidak merespons: cek provider, quota, koneksi, permission, dan konfigurasi admin.

Datasource SIPP belum tersedia: admin teknis perlu memeriksa koneksi read-only.

Query belum aktif: query masih needs_review, deprecated, atau invalid.

Halaman loading terus: refresh, login ulang, cek API/server log.

# FAQ

Apakah ALETA satu aplikasi? ALETA adalah portal/SSO kumpulan aplikasi internal.

Apa itu SSO? Login satu kali untuk mengakses modul yang diizinkan.

Kenapa menu saya berbeda? Karena role, permission, dan module visibility berbeda.

Apakah data SIPP bisa diubah dari ALETA? Untuk ALETA x SIPP, prinsipnya read-only.

Apakah ALETA memakai AI? Ya, pada modul tertentu dan sesuai konfigurasi.

Apakah hasil AI pasti benar? Tidak, hasil AI wajib diverifikasi.

Apa bedanya dry-run dan live send? Dry-run simulasi, live send mengirim pesan nyata.

Siapa yang bisa membuat user? Admin atau Super Admin sesuai permission.

Apa yang dilakukan jika lupa password? Gunakan lupa password atau hubungi admin.

# Glosarium

Portal: pusat akses beberapa aplikasi. SSO: login tunggal. AI: kecerdasan buatan. Prompt: instruksi untuk AI. Role: kelompok hak akses. Permission: izin spesifik. Module visibility: pengaturan modul yang tampil. Disposisi: penerusan surat/tugas. Query Registry: daftar query terkontrol. Variable Registry: daftar variable dan mapping. Dry-run: simulasi. Live send: pengiriman nyata. Gateway: penghubung layanan. Queue: antrean pekerjaan. Delivery log: catatan pengiriman. SIPP: Sistem Informasi Penelusuran Perkara. JLF: Justicia Legal Form. Attachment: lampiran file. Admin teknis: pengelola konfigurasi teknis.

# Lampiran Screenshot

| No | Screenshot | URL | Status | Catatan |
|---|---|---|---|---|
| 1 | Halaman Login Portal ALETA | /login | captured | - |
| 2 | Contoh Login Gagal | /login | captured | - |
| 3 | Dashboard Portal | /portal | captured | - |
| 4 | Sidebar dan Menu Utama | /portal | captured | - |
| 5 | Profil Pengguna | /account | captured | - |
| 6 | Dashboard Admin | /admin | captured | - |
| 7 | Manajemen User | /admin | captured | - |
| 8 | Jabatan dan Mapping User | /admin/mapping-user-jabatan | placeholder | page.goto: Timeout 90000ms exceeded.
Call log:
[2m  - navigating to "http://127.0.0.1:3000/admin/mapping-user-jabatan", waiting until "domcontentloaded"[22m
 |
| 9 | Module Visibility | /admin/visibility-role | captured | - |
| 10 | Pengaturan AI | /admin/pengaturan-ai | captured | - |
| 11 | Dashboard Manajemen Surat | /manajemen-surat | captured | - |
| 12 | Daftar Surat | /surat | captured | - |
| 13 | Surat Masuk | /surat/masuk | captured | - |
| 14 | Surat Keluar | /surat/keluar | captured | - |
| 15 | Disposisi | /disposisi | captured | - |
| 16 | ALETA Bot | /aleta-bot | captured | - |
| 17 | Admin ALETA Bot | /admin/aleta-bot | captured | - |
| 18 | Status WhatsApp Gateway | /admin/status-whatsapp | captured | - |
| 19 | ALETA x SIPP | /aleta-sipp | captured | - |
| 20 | Query Registry | /aleta-sipp?section=query | captured | - |
| 21 | Variable Registry | /aleta-sipp?section=variabel | captured | - |
| 22 | Monitoring dan SK SIPP | /aleta-sipp?section=pendukung2018 | captured | - |
| 23 | ALETA Justicia Legal Form | /judicia/legal-form | captured | - |
| 24 | Template JLF | /judicia/legal-form/templates | captured | - |
| 25 | Variable JLF | /judicia/legal-form/variables | captured | - |
| 26 | Asisten Hakim / AI | /asisten-hakim | captured | - |
| 27 | E-Kepegawaian | /e-kepegawaian | captured | - |
| 28 | E-Status | /e-status | captured | - |
| 29 | Halaman Panduan | /panduan | captured | - |
| 30 | Saran dan Masukan | /masukan | captured | - |
| 31 | Contoh Akses Ditolak | /admin/database | captured | - |

Jumlah screenshot: 31.
Berhasil diambil: 30.
Placeholder: 1.