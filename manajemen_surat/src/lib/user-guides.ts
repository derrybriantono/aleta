export type GuideAudience =
  | "all"
  | "super_admin"
  | "admin"
  | "pimpinan"
  | "hakim"
  | "panitera"
  | "jurusita"
  | "ptsp"
  | "pegawai";

export type GuideModule =
  | "general"
  | "mail"
  | "tasks"
  | "bot"
  | "ai"
  | "admin"
  | "patch_feedback"
  | "safe_mode"
  | "production_status";

export type UserGuide = {
  id: string;
  title: string;
  module: GuideModule;
  audiences: GuideAudience[];
  summary: string;
  steps: string[];
  notes: string[];
  troubleshooting: string[];
};

export const GUIDE_MODULE_LABELS: Record<GuideModule, string> = {
  general: "Mulai Menggunakan ALETA",
  mail: "Manajemen Surat",
  tasks: "Pusat Tugas",
  bot: "ALETA Bot & WhatsApp",
  ai: "Asisten Hakim",
  admin: "Admin Monitoring",
  patch_feedback: "Patch Notes & Masukan",
  safe_mode: "Safe Mode / Rollback",
  production_status: "Status Produksi",
};

export const USER_GUIDES: UserGuide[] = [
  {
    id: "getting-started",
    title: "Mulai Menggunakan ALETA",
    module: "general",
    audiences: ["all"],
    summary: "ALETA adalah portal internal untuk membantu pengelolaan surat, disposisi, arsip, tugas, masukan, dan monitoring layanan kantor.",
    steps: [
      "Buka alamat aplikasi ALETA dari perangkat kantor atau jaringan yang diizinkan.",
      "Login dengan akun yang diberikan oleh admin.",
      "Setelah masuk, gunakan Portal ALETA untuk memilih modul yang tersedia sesuai hak akses Anda.",
      "Buka menu yang dibutuhkan, seperti Manajemen Surat, Pusat Tugas, Patch Notes, Panduan, atau Pusat Masukan.",
    ],
    notes: [
      "Jangan membagikan akun kepada orang lain.",
      "Menu yang tampil dapat berbeda untuk setiap role atau jabatan.",
      "Jika menu yang Anda butuhkan tidak muncul, hubungi admin atau Super Admin.",
    ],
    troubleshooting: ["Jika halaman belum lengkap saat pertama dibuka, tunggu beberapa saat karena sebagian data dimuat bertahap."],
  },
  {
    id: "login",
    title: "Login ke ALETA",
    module: "general",
    audiences: ["all"],
    summary: "Login ALETA sudah dibuat lebih stabil agar user cukup masuk satu kali dan langsung diarahkan ke portal.",
    steps: [
      "Buka halaman login ALETA.",
      "Masukkan identitas akun dan password.",
      "Klik tombol Login satu kali.",
      "Tunggu sampai proses selesai. Jika berhasil, Anda akan diarahkan ke /portal.",
    ],
    notes: [
      "Jika tombol login sedang loading, jangan klik berulang.",
      "Jika login gagal, baca pesan error yang tampil di layar.",
      "Jika akun diblokir atau tidak aktif, hubungi Super Admin.",
    ],
    troubleshooting: [
      "Jika kembali ke halaman login, pastikan Anda memakai alamat aplikasi yang sama, misalnya tetap memakai localhost atau tetap memakai alamat server kantor.",
      "Jika lupa password, gunakan bantuan admin sesuai prosedur yang tersedia di halaman login.",
    ],
  },
  {
    id: "portal-aleta",
    title: "Portal ALETA",
    module: "general",
    audiences: ["all"],
    summary: "Portal ALETA menampilkan aplikasi dan modul yang boleh Anda gunakan berdasarkan hak akses aktif.",
    steps: [
      "Setelah login, buka atau tunggu arahan ke /portal.",
      "Pilih kartu aplikasi yang tampil, misalnya Manajemen Surat, ALETA Bot, Asisten Hakim, Panduan, Patch Notes, atau Pusat Masukan.",
      "Gunakan sidebar atau tombol kembali ke Portal Utama untuk berpindah antar modul.",
    ],
    notes: [
      "Beberapa data berat dimuat bertahap di background agar halaman utama lebih cepat tampil.",
      "Jika ada kartu atau status yang masih loading, Anda tetap bisa mulai menggunakan menu yang sudah tampil.",
      "Gunakan refresh hanya jika halaman terasa belum lengkap setelah menunggu beberapa saat.",
    ],
    troubleshooting: ["Jika sebuah modul tidak muncul, kemungkinan modul tersebut belum diberikan untuk role atau user Anda."],
  },
  {
    id: "manajemen-surat-dashboard",
    title: "Dashboard Manajemen Surat",
    module: "mail",
    audiences: ["all"],
    summary: "Dashboard Manajemen Surat menampilkan ringkasan surat masuk, surat keluar, inbox tugas, disposisi terlambat, dan aktivitas terbaru.",
    steps: [
      "Buka Portal ALETA.",
      "Pilih Manajemen Surat atau buka menu Dashboard Manajemen Surat.",
      "Periksa kartu Surat Masuk, Surat Keluar, Inbox Tugas, dan Disposisi Terlambat.",
      "Klik kartu ringkasan untuk masuk ke daftar atau pekerjaan terkait.",
    ],
    notes: [
      "Data dashboard mengikuti hak akses Anda.",
      "Angka dan daftar dapat berbeda antara pimpinan, operator, dan pegawai biasa.",
    ],
    troubleshooting: ["Jika angka terasa tidak sesuai, cek filter status/tanggal pada halaman terkait atau refresh bila perlu."],
  },
  {
    id: "surat-masuk",
    title: "Surat Masuk",
    module: "mail",
    audiences: ["super_admin", "admin", "pimpinan", "panitera", "ptsp", "pegawai"],
    summary: "Surat Masuk digunakan untuk mencatat, menelaah, meneruskan, dan mengarsipkan surat yang diterima kantor.",
    steps: [
      "Buka menu Surat Masuk.",
      "Gunakan filter atau pencarian jika daftar surat terlalu banyak.",
      "Klik salah satu surat untuk membuka detail.",
      "Jika memiliki akses input, gunakan tombol tambah/input surat masuk.",
      "Isi asal surat, nomor surat, tanggal, perihal, ringkasan, dan unggah file jika ada.",
      "Simpan data surat, lalu teruskan atau disposisikan sesuai alur kerja kantor.",
    ],
    notes: [
      "Pastikan nomor surat, tanggal, asal surat, dan perihal tidak salah ketik.",
      "Jangan menghapus arsip kecuali memiliki kewenangan.",
      "Detail surat dibuka dari halaman detail, bukan dari daftar ringkas.",
    ],
    troubleshooting: ["Jika file tidak bisa dibuka, pastikan format file didukung dan ukuran file tidak terlalu besar."],
  },
  {
    id: "surat-keluar",
    title: "Surat Keluar",
    module: "mail",
    audiences: ["super_admin", "admin", "panitera", "ptsp", "pegawai"],
    summary: "Surat Keluar digunakan untuk mencatat surat yang dibuat atau dikirim oleh kantor.",
    steps: [
      "Buka menu Surat Keluar.",
      "Gunakan filter atau pencarian jika diperlukan.",
      "Klik surat untuk melihat detail.",
      "Jika memiliki akses, klik tambah surat keluar.",
      "Isi tujuan, nomor surat, tanggal, perihal, dan ringkasan isi.",
      "Simpan, ajukan, setujui, tolak, atau arsipkan sesuai alur yang tersedia untuk role Anda.",
    ],
    notes: [
      "Pastikan surat keluar sudah sesuai prosedur sebelum dikirim atau diarsipkan.",
      "Export laporan tetap digunakan melalui fitur export jika tersedia, bukan dengan mengambil seluruh data dari tabel.",
    ],
    troubleshooting: ["Jika tidak bisa menambah surat keluar, minta admin memeriksa hak akses akun Anda."],
  },
  {
    id: "detail-disposisi-surat",
    title: "Detail Surat dan Disposisi",
    module: "mail",
    audiences: ["super_admin", "admin", "pimpinan", "hakim", "panitera", "pegawai"],
    summary: "Detail surat menampilkan informasi lengkap surat dan alur disposisi yang dapat ditindaklanjuti sesuai kewenangan.",
    steps: [
      "Buka Surat Masuk atau Surat Keluar.",
      "Klik salah satu surat untuk melihat detail.",
      "Baca informasi surat, lampiran, status, dan riwayat tindak lanjut.",
      "Jika berwenang, buat disposisi dengan memilih tujuan dan menulis instruksi.",
      "Penerima disposisi dapat membaca tugas dari dashboard, detail surat, atau Pusat Tugas.",
    ],
    notes: [
      "Instruksi disposisi sebaiknya singkat, jelas, dan menyebut tindakan yang diminta.",
      "Status read/seen membantu mengetahui apakah tugas sudah dibaca.",
      "Hak disposisi mengikuti role, jabatan, dan penugasan aktif.",
    ],
    troubleshooting: ["Jika tujuan disposisi tidak tersedia, minta admin memeriksa struktur jabatan, role, atau penugasan aktif."],
  },
  {
    id: "filter-search-export",
    title: "Filter, Pencarian, dan Export",
    module: "mail",
    audiences: ["all"],
    summary: "Gunakan filter, pencarian, dan export untuk menemukan surat atau membuat laporan sesuai kebutuhan kerja.",
    steps: [
      "Masuk ke daftar surat atau arsip.",
      "Masukkan kata kunci seperti nomor surat, asal/tujuan, atau perihal.",
      "Gunakan filter status, jenis surat, tanggal, atau kategori jika tersedia.",
      "Buka detail surat dari hasil pencarian yang relevan.",
      "Gunakan Export CSV atau export laporan jika fitur tersedia untuk role Anda.",
    ],
    notes: [
      "Jangan menganggap semua data harus ditampilkan sekaligus di layar. Untuk data banyak, gunakan filter atau export.",
      "Export tetap mengikuti hak akses Anda.",
    ],
    troubleshooting: ["Jika hasil pencarian terlalu banyak, gunakan kata kunci yang lebih spesifik atau filter tanggal."],
  },
  {
    id: "pusat-tugas",
    title: "Pusat Tugas",
    module: "tasks",
    audiences: ["all"],
    summary: "Pusat Tugas menampilkan pekerjaan dan tindak lanjut yang relevan dengan akun Anda.",
    steps: [
      "Buka menu Pusat Tugas atau klik kartu Inbox Tugas dari dashboard.",
      "Periksa daftar tugas yang muncul.",
      "Prioritaskan tugas dengan badge urgent, terlambat, atau mendesak.",
      "Buka detail tugas untuk melihat sumber tugas dan tindakan yang perlu dilakukan.",
      "Tindak lanjuti tugas sesuai instruksi dan kewenangan.",
    ],
    notes: [
      "Tugas dapat berasal dari Manajemen Surat, disposisi, approval, feedback, atau ALETA Bot sesuai role.",
      "Tugas yang sudah dibaca atau dikerjakan dapat berubah status sesuai alur masing-masing fitur.",
    ],
    troubleshooting: [
      "Jika tugas sudah dikerjakan tetapi masih muncul, refresh halaman atau cek status read/seen.",
      "Jika tugas tidak seharusnya muncul, laporkan ke admin agar sumber tugas dapat diperiksa.",
    ],
  },
  {
    id: "patch-notes",
    title: "Patch Notes",
    module: "patch_feedback",
    audiences: ["all"],
    summary: "Patch Notes berisi riwayat perubahan aplikasi ALETA dari versi ke versi.",
    steps: [
      "Buka halaman Patch Notes dari portal atau link di halaman Panduan.",
      "Lihat versi terbaru pada bagian atas halaman.",
      "Baca fitur baru, perubahan, perbaikan, keamanan, catatan operasional, dan batasan yang masih ada.",
    ],
    notes: [
      "Versi terbaru adalah 0.1.0-beta.6.",
      "Patch Notes menjelaskan fitur baru, perbaikan, dan risiko tersisa.",
      "Jika ada fitur yang ditulis pending, jangan anggap fitur tersebut sudah aktif final.",
    ],
    troubleshooting: ["Jika informasi pada Patch Notes terasa berbeda dengan UI, pastikan aplikasi sudah memakai build terbaru."],
  },
  {
    id: "pusat-masukan",
    title: "Pusat Masukan",
    module: "patch_feedback",
    audiences: ["all"],
    summary: "Pusat Masukan dipakai untuk mengirim laporan bug, saran fitur, atau usulan aplikasi baru kepada admin.",
    steps: [
      "Buka Pusat Masukan dari portal atau footer.",
      "Pilih jenis masukan: laporan bug, saran fitur, atau usulan aplikasi baru.",
      "Tulis ringkasan masalah atau ide dengan jelas.",
      "Kirim masukan agar dapat dibaca dan ditindaklanjuti admin.",
    ],
    notes: [
      "Masukan akan dibaca admin.",
      "Jangan memasukkan data rahasia atau sensitif berlebihan kecuali benar-benar diperlukan.",
      "Sertakan waktu kejadian dan langkah yang dilakukan jika melaporkan bug.",
    ],
    troubleshooting: ["Jika masukan tidak terkirim, coba lagi setelah beberapa saat atau laporkan langsung ke admin."],
  },
  {
    id: "aleta-bot-overview",
    title: "ALETA Bot dan WhatsApp",
    module: "bot",
    audiences: ["all"],
    summary: "ALETA Bot membantu admin memantau Layanan WhatsApp, Antrean Pesan, dan notifikasi internal sesuai hak akses.",
    steps: [
      "User biasa tidak perlu scan QR atau menghubungkan WhatsApp.",
      "Notifikasi WhatsApp hanya diterima jika fitur sudah diaktifkan oleh admin.",
      "Admin dapat membuka ALETA Bot untuk memantau status WhatsApp, Pemroses Pesan, Antrean Pesan, Pesan Gagal, dan Persetujuan.",
    ],
    notes: [
      "WhatsApp Gateway saat ini sudah terhubung dan dapat dipantau admin.",
      "Pengiriman WhatsApp internal terbatas sudah berhasil diuji.",
      "Pengiriman WhatsApp aktif operasional belum final sampai Uji Terbatas lulus di dalam Jam Aman Pengiriman.",
    ],
    troubleshooting: ["Jika tidak menerima notifikasi, jangan langsung meminta resend. Minta admin memeriksa antrean pesan dan status fitur."],
  },
  {
    id: "whatsapp-gateway-admin",
    title: "Monitoring WhatsApp Gateway untuk Admin",
    module: "bot",
    audiences: ["super_admin", "admin"],
    summary: "Admin memantau kesehatan WhatsApp Gateway tanpa melakukan tindakan berisiko seperti kirim ulang massal atau broadcast tanpa persetujuan.",
    steps: [
      "Buka halaman ALETA Bot atau Admin Monitoring.",
      "Pantau status WhatsApp: terhubung atau tidak terhubung.",
      "Pantau Pemroses Pesan aktif atau tidak.",
      "Pantau Antrean Pesan: menunggu, diproses, dan gagal.",
      "Pantau Pesan Gagal yang perlu ditinjau.",
      "Pantau Persetujuan yang masih menunggu.",
    ],
    notes: [
      "Jangan kirim ulang Pesan Gagal tanpa tinjauan.",
      "Jangan broadcast tanpa persetujuan.",
      "Jangan aktifkan pengiriman otomatis sebelum semua syarat aman terpenuhi.",
      "Jangan scan QR jika status WhatsApp sudah terhubung.",
    ],
    troubleshooting: [
      "Jika WhatsApp tidak terhubung, gunakan SOP WhatsApp disconnected.",
      "Jika ada Pesan Gagal, baca penyebabnya sebelum mengambil tindakan.",
    ],
  },
  {
    id: "safe-sending-window",
    title: "Jam Aman Pengiriman",
    module: "bot",
    audiences: ["all"],
    summary: "Jam Aman Pengiriman adalah waktu yang disetujui untuk mengirim WhatsApp agar notifikasi tidak berjalan di luar jam kerja.",
    steps: [
      "Jam aman pengiriman WhatsApp adalah 07:30-21:00.",
      "Di luar jam tersebut, sistem dapat menahan pengiriman.",
      "Uji Terbatas atau pengiriman aktif operasional harus dilakukan di dalam Jam Aman Pengiriman.",
    ],
    notes: [
      "Jangan memaksa override jam aman.",
      "Jika uji WhatsApp tertunda karena di luar jam aman, jalankan ulang saat sudah masuk Jam Aman Pengiriman.",
    ],
    troubleshooting: ["Jika status jam aman belum mengizinkan, jangan aktifkan pengiriman WhatsApp operasional dan jangan mengirim pesan uji."],
  },
  {
    id: "public-qa-safe-mode",
    title: "Mode Aman Pertanyaan Publik",
    module: "bot",
    audiences: ["super_admin", "admin", "ptsp"],
    summary: "Pertanyaan Publik membantu menjawab pertanyaan umum dengan aturan, template, dan kueri resmi.",
    steps: [
      "Gunakan hanya aturan yang sudah disetujui.",
      "Periksa template dan contoh pertanyaan.",
      "Pertanyaan yang belum dikenali harus masuk tinjauan admin.",
      "Jangan memakai jawaban bebas untuk informasi sensitif.",
    ],
    notes: [
      "Pertanyaan Publik tidak boleh membocorkan data internal.",
      "Pertanyaan Publik tidak boleh memakai kueri database di luar daftar resmi.",
    ],
    troubleshooting: ["Jika jawaban tidak sesuai, nonaktifkan aturan atau kembalikan ke mode tinjauan sampai diperbaiki."],
  },
  {
    id: "asisten-hakim",
    title: "Asisten Hakim",
    module: "ai",
    audiences: ["super_admin", "admin", "pimpinan", "hakim"],
    summary: "Asisten Hakim berisi link ke AI pendukung seperti ChatGPT, Gemini, Claude, atau AI lain yang dikonfigurasi admin.",
    steps: [
      "Buka Asisten Hakim dari Portal ALETA jika menu tersedia untuk akun Anda.",
      "Pilih AI yang tersedia.",
      "Gunakan hasil AI sebagai bahan bantu, bukan keputusan final.",
      "Verifikasi kembali hasil AI sebelum digunakan dalam pekerjaan resmi.",
    ],
    notes: [
      "Akses Asisten Hakim bergantung pada peran atau pengguna tertentu.",
      "Super Admin dapat mengatur link AI dan akses tampilan menu Asisten Hakim.",
      "Jangan masukkan data rahasia berlebihan ke layanan AI eksternal.",
    ],
    troubleshooting: ["Jika menu Asisten Hakim tidak muncul, minta Super Admin memeriksa akses tampilan peran atau akses pengguna Anda."],
  },
  {
    id: "plh-plt",
    title: "Panduan Umum PLH/PLT",
    module: "mail",
    audiences: ["super_admin", "admin", "pimpinan"],
    summary: "PLH/PLT adalah penugasan sementara dan bukan perubahan jabatan definitif.",
    steps: [
      "Buka menu penugasan jika Anda memiliki kewenangan.",
      "Pilih pejabat definitif atau posisi yang sedang digantikan.",
      "Pilih pengguna pengganti sesuai aturan internal dan periode yang berlaku.",
      "Simpan penugasan dengan alasan yang jelas.",
    ],
    notes: [
      "Hak akses PLH/PLT berlaku sesuai periode aktif.",
      "Penugasan harus dibuat oleh pejabat atau admin berwenang.",
      "PLH/PLT tidak otomatis memberi kewenangan strategis seperti pengaturan hak akses atau pengiriman WhatsApp aktif operasional.",
      "PLH/PLT tidak mengubah jabatan definitif, status kepegawaian, atau tunjangan jabatan.",
    ],
    troubleshooting: ["Jika kandidat tidak muncul, periksa status aktif pengguna, jabatan, unit kerja, dan konflik penugasan."],
  },
  {
    id: "admin-monitoring",
    title: "Monitoring Admin Harian",
    module: "admin",
    audiences: ["super_admin", "admin"],
    summary: "Admin dan Super Admin perlu memantau status layanan penting agar operasional internal tetap aman.",
    steps: [
      "Pantau WhatsApp terhubung atau tidak.",
      "Pantau Pemroses Pesan aktif atau tidak.",
      "Pantau Antrean Pesan: menunggu, diproses, dan gagal.",
      "Pantau Pesan Gagal aktif.",
      "Pantau Persetujuan yang masih menunggu.",
      "Pantau Jembatan AI tersinkron.",
      "Pantau mode Penjadwal/Pengingat.",
      "Pantau Pengiriman Bot.",
      "Pantau Jam Aman Pengiriman.",
      "Pantau batas pengiriman agar tidak ada pengiriman tidak wajar.",
      "Pastikan pengiriman berisiko tetap menunggu persetujuan.",
    ],
    notes: [
      "Antrean Pesan adalah daftar pesan yang menunggu diproses.",
      "Pesan Gagal adalah pesan yang perlu ditinjau admin.",
      "Pengiriman Bot saat ini aktif dengan pengamanan.",
      "Broadcast, notifikasi pihak luar, dan kirim ulang massal tetap wajib persetujuan.",
    ],
    troubleshooting: [
      "Jika ada status berisiko, kembali ke mode aman dan ikuti SOP.",
      "Jangan kirim ulang otomatis sebelum penyebab masalah jelas.",
    ],
  },
  {
    id: "safe-mode-rollback",
    title: "Rollback dan Mode Aman Singkat",
    module: "safe_mode",
    audiences: ["super_admin", "admin"],
    summary: "Mode aman dipakai untuk menahan pengiriman WhatsApp dan mencegah dampak lanjutan saat ada masalah.",
    steps: [
      "Jika ada masalah WhatsApp, matikan pengiriman otomatis sementara.",
      "Tahan Penjadwal/Pengingat jika antrean atau Pesan Gagal bermasalah.",
      "Jangan kirim ulang otomatis.",
      "Cek Pesan Gagal.",
      "Cek pesan yang gagal di Antrean Pesan.",
      "Tinjau item bermasalah satu per satu.",
    ],
    notes: [
      "Gunakan SOP: aleta-sop-whatsapp-disconnected.md.",
      "Gunakan SOP: aleta-sop-dead-letter.md.",
      "Gunakan SOP: aleta-sop-queue-failed.md.",
      "Gunakan SOP: aleta-sop-rollback-safe-mode.md.",
    ],
    troubleshooting: ["Jika ragu, tahan pengiriman otomatis lebih dulu dan minta tinjauan Super Admin sebelum mengirim ulang pesan."],
  },
  {
    id: "status-produksi",
    title: "Status Produksi Saat Ini",
    module: "production_status",
    audiences: ["all"],
    summary: "Status ini menjelaskan fitur yang sudah aktif dan pengamanan yang tetap wajib dipatuhi.",
    steps: [
      "Aplikasi ALETA internal boleh digunakan.",
      "Office Server Launch berstatus GO.",
      "WhatsApp Gateway terhubung.",
      "Pengiriman WhatsApp otomatis sudah aktif dengan pengamanan.",
      "Uji terbatas sudah berhasil.",
      "Pengiriman berjalan mengikuti Jam Aman Pengiriman.",
      "Data pegawai 42/42 siap menerima notifikasi sesuai alur kerja dan hak akses.",
      "Broadcast, notifikasi pihak luar, dan kirim ulang massal tetap membutuhkan persetujuan.",
    ],
    notes: [
      "Full production bukan berarti bebas broadcast.",
      "User biasa tidak perlu scan QR dan tidak perlu menghubungkan WhatsApp sendiri.",
      "Notifikasi WhatsApp diterima jika sistem mengirim sesuai alur kerja dan hak akses.",
      "Admin perlu memantau WhatsApp Gateway, Pemroses Pesan, Antrean Pesan, Pesan Gagal, Persetujuan, Jam Aman Pengiriman, Penjadwal/Pengingat, dan batas pengiriman.",
      "User biasa cukup memakai fitur yang sudah tampil sesuai hak akses.",
    ],
    troubleshooting: [
      "Jika ada Pesan Gagal atau antrean bermasalah, jangan langsung kirim ulang.",
      "Kembali ke mode aman sesuai SOP bila ada salah penerima, kirim ganda, atau pengiriman tidak wajar.",
      "Jika ada informasi status yang belum jelas, lihat Patch Notes terbaru atau tanyakan ke Super Admin.",
    ],
  },
];
