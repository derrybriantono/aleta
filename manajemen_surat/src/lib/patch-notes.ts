export const APP_VERSION = "0.1.0-beta.5";
export const APP_VERSION_LABEL = "ALETA 0.1.0 Beta - Internal Pilot";

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
};

export const PATCH_NOTES: PatchNote[] = [
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
