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

export type GuideModule = "general" | "mail" | "bot" | "ai" | "admin" | "troubleshooting";

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
  general: "Mulai",
  mail: "Manajemen Surat",
  bot: "ALETA Bot",
  ai: "AI di ALETA",
  admin: "Admin & Pengaturan",
  troubleshooting: "Masalah Umum",
};

export const USER_GUIDES: UserGuide[] = [
  {
    id: "getting-started",
    title: "Mulai Menggunakan ALETA",
    module: "general",
    audiences: ["all"],
    summary: "ALETA adalah portal internal untuk membantu pengelolaan surat, disposisi, arsip, notifikasi, dan layanan pendukung kantor.",
    steps: [
      "Buka alamat aplikasi ALETA dari perangkat kantor atau jaringan yang diizinkan.",
      "Login dengan akun yang diberikan oleh admin.",
      "Lihat dashboard untuk mengetahui surat, disposisi, tugas, dan informasi penting yang relevan dengan peran Anda.",
      "Buka menu yang tersedia. Menu yang tidak sesuai hak akses tidak akan ditampilkan.",
    ],
    notes: [
      "Jangan membagikan akun kepada orang lain.",
      "Jika lupa password atau tidak bisa login, hubungi admin.",
      "Gunakan Mode Sederhana untuk pekerjaan harian. Mode Lanjutan hanya untuk admin teknis.",
    ],
    troubleshooting: ["Jika menu tidak muncul, kemungkinan hak akses belum diberikan atau role aktif Anda berbeda."],
  },
  {
    id: "dashboard",
    title: "Mengenal Dashboard",
    module: "general",
    audiences: ["all"],
    summary: "Dashboard menampilkan ringkasan kerja harian seperti surat baru, disposisi, tugas aktif, dan status layanan yang perlu diperhatikan.",
    steps: [
      "Buka halaman Portal atau Dashboard.",
      "Periksa kartu ringkasan untuk melihat pekerjaan yang perlu ditindaklanjuti.",
      "Klik kartu atau tombol pintasan untuk masuk ke daftar surat, disposisi, atau pencarian.",
    ],
    notes: [
      "Isi dashboard dapat berbeda untuk setiap role.",
      "Pimpinan biasanya melihat ringkasan dan disposisi penting, sedangkan operator melihat pekerjaan input atau tindak lanjut.",
    ],
    troubleshooting: ["Jika angka dashboard terasa tidak sesuai, coba refresh halaman dan cek filter tanggal atau status."],
  },
  {
    id: "surat-masuk",
    title: "Mengelola Surat Masuk",
    module: "mail",
    audiences: ["super_admin", "admin", "pimpinan", "panitera", "ptsp", "pegawai"],
    summary: "Surat masuk digunakan untuk mencatat, menelaah, meneruskan, dan mengarsipkan surat yang diterima kantor.",
    steps: [
      "Buka menu Surat Masuk.",
      "Jika memiliki akses input, klik tambah/input surat.",
      "Isi asal surat, nomor surat, tanggal, perihal, ringkasan, dan unggah file jika ada.",
      "Simpan data surat.",
      "Teruskan atau disposisikan surat sesuai alur kerja kantor.",
    ],
    notes: [
      "Pastikan nomor surat, tanggal, dan perihal tidak salah ketik.",
      "Jangan menghapus arsip kecuali memiliki kewenangan.",
    ],
    troubleshooting: ["Jika file tidak bisa dibuka, pastikan format file didukung dan ukuran file tidak terlalu besar."],
  },
  {
    id: "surat-keluar",
    title: "Mengelola Surat Keluar",
    module: "mail",
    audiences: ["super_admin", "admin", "panitera", "ptsp", "pegawai"],
    summary: "Surat keluar digunakan untuk mencatat surat yang dibuat atau dikirim oleh kantor.",
    steps: [
      "Buka menu Surat Keluar.",
      "Klik tambah surat keluar jika memiliki akses.",
      "Isi tujuan, nomor surat, tanggal, perihal, dan ringkasan isi.",
      "Simpan atau arsipkan sesuai alur yang berlaku.",
    ],
    notes: ["Pastikan surat keluar sudah sesuai prosedur sebelum diarsipkan."],
    troubleshooting: ["Jika tidak bisa menambah surat keluar, minta admin memeriksa hak akses akun Anda."],
  },
  {
    id: "disposisi",
    title: "Mengirim dan Menindaklanjuti Disposisi",
    module: "mail",
    audiences: ["super_admin", "admin", "pimpinan", "hakim", "panitera", "pegawai"],
    summary: "Disposisi membantu meneruskan surat kepada pejabat atau pegawai yang perlu menindaklanjuti.",
    steps: [
      "Buka surat yang perlu diteruskan.",
      "Pilih tujuan disposisi.",
      "Isi instruksi dengan jelas dan singkat.",
      "Kirim disposisi.",
      "Penerima akan melihat tugas/disposisi pada dashboard atau menu terkait.",
    ],
    notes: [
      "Gunakan instruksi yang jelas agar penerima memahami tindakan yang diminta.",
      "Pimpinan dan pejabat terkait dapat memantau status disposisi sesuai hak akses.",
    ],
    troubleshooting: ["Jika tujuan disposisi tidak tersedia, kemungkinan struktur jabatan atau hak akses perlu diperiksa admin."],
  },
  {
    id: "arsip-pencarian-statistik",
    title: "Arsip, Pencarian, dan Statistik",
    module: "mail",
    audiences: ["all"],
    summary: "Gunakan arsip dan pencarian untuk menemukan surat lama. Statistik membantu melihat ringkasan pekerjaan.",
    steps: [
      "Buka Arsip atau Pencarian.",
      "Masukkan kata kunci singkat seperti nomor surat, asal surat, atau perihal.",
      "Gunakan filter tanggal atau status jika hasil terlalu banyak.",
      "Buka Statistik untuk melihat ringkasan surat dan pekerjaan.",
    ],
    notes: ["Jangan menghapus arsip jika masih diperlukan untuk audit atau pelaporan."],
    troubleshooting: ["Jika data tidak muncul, cek ejaan kata kunci dan filter tanggal."],
  },
  {
    id: "aleta-bot-overview",
    title: "Memahami ALETA Bot",
    module: "bot",
    audiences: ["all"],
    summary: "ALETA Bot adalah layanan WhatsApp internal yang membantu mengirim notifikasi dan menjawab pertanyaan tertentu secara otomatis.",
    steps: [
      "Gunakan ALETA Bot untuk memantau status WhatsApp, antrean pesan, dan notifikasi sesuai hak akses.",
      "Pesan tidak selalu dikirim langsung; pesan masuk antrean terlebih dahulu.",
      "Status terkirim, gagal, atau simulasi dapat dilihat dari log dan antrean.",
    ],
    notes: [
      "ALETA Bot tidak menggantikan petugas.",
      "Untuk pertanyaan sensitif, bot akan mengarahkan pengguna ke petugas/PTSP.",
    ],
    troubleshooting: ["Jika pesan tidak terkirim, cek status WhatsApp, antrean pesan, dan pesan gagal."],
  },
  {
    id: "whatsapp-gateway",
    title: "Menghubungkan WhatsApp Gateway",
    module: "bot",
    audiences: ["super_admin", "admin"],
    summary: "WhatsApp produksi dijalankan dari ALETA Bot Gateway. Portal hanya menjadi control panel.",
    steps: [
      "Buka menu ALETA Bot.",
      "Masuk bagian WhatsApp Gateway.",
      "Klik Connect WhatsApp Gateway.",
      "Tunggu QR muncul.",
      "Buka WhatsApp kantor di HP, pilih Perangkat Tertaut, lalu scan QR.",
      "Pastikan status berubah menjadi Terhubung.",
    ],
    notes: [
      "Jangan scan QR dari menu legacy.",
      "Jangan menjalankan dua WhatsApp Gateway produksi sekaligus.",
      "Jangan reset session kecuali benar-benar diperlukan.",
    ],
    troubleshooting: [
      "Jika QR tidak muncul, pastikan aleta_bot dan manajemen_surat berjalan.",
      "Jika status sudah Terhubung, QR memang tidak diperlukan.",
      "Klik Refresh QR sebelum meminta bantuan admin teknis.",
    ],
  },
  {
    id: "queue-dead-letter",
    title: "Antrean Pesan dan Pesan Gagal",
    module: "bot",
    audiences: ["super_admin", "admin"],
    summary: "Pesan WhatsApp masuk antrean agar pengiriman lebih aman. Pesan gagal dapat diperiksa dan dikirim ulang dengan konfirmasi.",
    steps: [
      "Buka ALETA Bot.",
      "Periksa Antrean Pesan untuk melihat pesan menunggu atau diproses.",
      "Buka Pesan Gagal jika ada pengiriman yang gagal.",
      "Baca alasan gagal, periksa nomor tujuan, lalu kirim ulang hanya jika yakin.",
    ],
    notes: [
      "Jangan mengirim ulang berkali-kali tanpa membaca log.",
      "Gunakan dry-run untuk uji coba jika ragu.",
    ],
    troubleshooting: ["Jika banyak pesan gagal, cek status WhatsApp Gateway dan koneksi server."],
  },
  {
    id: "notifikasi",
    title: "Notifikasi Pegawai dan Pihak",
    module: "bot",
    audiences: ["super_admin", "admin", "panitera", "jurusita"],
    summary: "Notifikasi pegawai dipakai untuk internal. Notifikasi pihak harus lebih hati-hati dan sebaiknya tetap simulasi sampai pilot selesai.",
    steps: [
      "Buka tab Notifikasi.",
      "Gunakan filter Pegawai atau Pihak.",
      "Periksa template, query, dan jadwal sebelum mengaktifkan notifikasi.",
      "Untuk notifikasi pihak, jalankan simulasi/dry-run terlebih dahulu.",
    ],
    notes: [
      "Notifikasi pihak tidak disarankan aktif massal tanpa persetujuan.",
      "Pastikan nomor penerima valid dan isi pesan tidak menyesatkan.",
    ],
    troubleshooting: ["Jika notifikasi tidak berjalan, cek worker, jadwal, status aktif, dan log notifikasi."],
  },
  {
    id: "public-qa",
    title: "Pertanyaan dan Jawaban Publik",
    module: "bot",
    audiences: ["super_admin", "admin", "ptsp"],
    summary: "Public Q&A membantu menjawab pertanyaan umum para pihak melalui intent/template/query resmi.",
    steps: [
      "Buka tab Pertanyaan Publik.",
      "Periksa intent aktif dan contoh pertanyaan.",
      "Uji jawaban tanpa mengirim WhatsApp sungguhan.",
      "Tambahkan contoh pertanyaan jika banyak pertanyaan tidak dikenali.",
    ],
    notes: [
      "Bot tidak boleh memberi nasihat hukum bebas.",
      "Pertanyaan sensitif harus diarahkan ke petugas.",
    ],
    troubleshooting: ["Jika jawaban tidak sesuai, nonaktifkan intent atau kembalikan ke fallback sampai diperbaiki."],
  },
  {
    id: "ai",
    title: "AI di ALETA",
    module: "ai",
    audiences: ["all"],
    summary: "AI membantu klasifikasi, saran, dan Public Q&A yang aman. AI tidak menggantikan petugas, hakim, atau prosedur resmi.",
    steps: [
      "Gunakan saran AI sebagai bantuan awal.",
      "Periksa kembali hasil AI sebelum dipakai.",
      "Jangan menjadikan AI sebagai dasar tunggal keputusan.",
    ],
    notes: [
      "AI tidak boleh memberi prediksi menang/kalah.",
      "AI tidak boleh membuka data pihak lain.",
      "AI harus mengikuti intent, template, dan query resmi.",
    ],
    troubleshooting: ["Jika AI Perlu Sinkronisasi, admin teknis perlu melakukan Sync AI ke ALETA Bot."],
  },
  {
    id: "ai-admin",
    title: "Sync AI ke ALETA Bot",
    module: "ai",
    audiences: ["super_admin"],
    summary: "Pengaturan AI dilakukan dari portal, lalu disinkronkan ke runtime ALETA Bot.",
    steps: [
      "Buka menu Pengaturan AI.",
      "Pilih provider dan model yang aktif.",
      "Simpan pengaturan.",
      "Buka ALETA Bot dan klik Sync AI ke ALETA Bot.",
      "Klik Test AI Runtime.",
    ],
    notes: [
      "Status needs_sync normal terjadi setelah aleta_bot restart.",
      "API key tidak boleh dibagikan atau ditampilkan di chat/log.",
    ],
    troubleshooting: ["Jika sync gagal, cek konfigurasi provider di menu AI dan pastikan aleta_bot dapat dihubungi."],
  },
  {
    id: "admin-settings",
    title: "Admin dan Pengaturan Dasar",
    module: "admin",
    audiences: ["super_admin", "admin"],
    summary: "Pengaturan digunakan untuk mengelola identitas instansi, akun, role, dan visibilitas menu.",
    steps: [
      "Buka Portal Pengaturan.",
      "Kelola identitas instansi dari menu Identitas Instansi.",
      "Kelola akun dan mapping jabatan sesuai kewenangan.",
      "Pastikan hanya menu yang diperlukan yang terlihat untuk setiap role.",
    ],
    notes: [
      "Mode Sederhana cocok untuk operator harian.",
      "Mode Lanjutan hanya untuk pengaturan teknis.",
    ],
    troubleshooting: ["Jika user tidak melihat menu yang seharusnya, periksa role, jabatan, dan visibility role."],
  },
  {
    id: "pilot-terbatas-aleta",
    title: "Pilot Terbatas ALETA",
    module: "admin",
    audiences: ["super_admin", "admin", "pimpinan"],
    summary: "Runbook singkat untuk memastikan pilot terbatas berjalan aman, tetap dry-run untuk fitur berisiko, dan tidak melepas pengiriman massal tanpa kesiapan.",
    steps: [
      "Sebelum pilot: cek WhatsApp Gateway, safe sending window, worker, dead-letter, nomor WhatsApp pegawai, Public Q&A pending review, lalu jalankan Operational Smoke Test.",
      "Export readiness dari Admin ALETA Bot dan pastikan status tidak Terblokir sebelum pilot harian.",
      "Saat pilot: gunakan dry-run untuk reminder deadline, pantau policy skip, run history reminder, dead-letter, dan pertanyaan publik yang perlu ditinjau.",
      "Setelah pilot: cek log, feedback, pengiriman gagal, notifikasi yang di-skip, dan lengkapi nomor WhatsApp pegawai yang masih kosong.",
    ],
    notes: [
      "Jangan aktifkan notifikasi pihak massal saat pilot terbatas.",
      "Production reminder hanya boleh dibuka setelah approval eksplisit, readiness clear, dan konfirmasi Super Admin.",
      "Smoke test tidak melakukan scan QR, tidak enqueue pesan, dan tidak mengirim WhatsApp.",
    ],
    troubleshooting: [
      "Jika status readiness Terblokir, ikuti tombol aksi pada kartu Kesiapan Pilot.",
      "Jika banyak policy skip, buka Policy Skip Report dan selesaikan alasan seperti belum dry-run, belum preview, belum approval, atau nomor invalid.",
      "Jika nomor WhatsApp belum lengkap, buka Manajemen Akun dengan filter Belum punya nomor WhatsApp.",
    ],
  },
  {
    id: "technical-admin",
    title: "Pengaturan Teknis ALETA Bot",
    module: "admin",
    audiences: ["super_admin"],
    summary: "Bagian teknis mencakup koneksi database, kueri terdaftar, template pesan, migrasi legacy, approval, dan cleanup log.",
    steps: [
      "Gunakan Mode Lanjutan hanya jika memahami dampaknya.",
      "Uji koneksi database sebelum menyimpan perubahan.",
      "Pastikan query bersifat read-only.",
      "Periksa placeholder sebelum mengaktifkan template pesan.",
      "Ikuti alur Migrasi Legacy: Pratinjau, Draft, Simulasi, Persetujuan, Aktifkan, lalu Nonaktifkan sistem lama.",
    ],
    notes: [
      "Password database tidak ditampilkan kembali setelah disimpan.",
      "Jika field password dikosongkan saat edit, password lama tetap dipakai.",
      "Jangan approve perubahan berisiko tanpa melihat simulasi.",
    ],
    troubleshooting: [
      "Jika koneksi database gagal, cek host, port, username, password, dan nama database.",
      "Jika query gagal, periksa koneksi SQL dan validator query.",
    ],
  },
  {
    id: "troubleshooting",
    title: "Masalah Umum",
    module: "troubleshooting",
    audiences: ["all"],
    summary: "Gunakan daftar ini saat mengalami kendala umum sebelum menghubungi admin teknis.",
    steps: [
      "Tidak bisa login: periksa username/password dan hubungi admin jika akun dinonaktifkan.",
      "Menu tidak muncul: hak akses mungkin belum diberikan atau menu hanya ada di Mode Lanjutan.",
      "QR WhatsApp tidak muncul: klik Connect WhatsApp Gateway, tunggu, lalu Refresh QR.",
      "WhatsApp tidak terhubung: cek status WhatsApp, koneksi server, dan jangan scan QR legacy.",
      "Pesan tidak terkirim: cek antrean, pesan gagal, nomor tujuan, dan status WhatsApp.",
      "AI perlu sinkronisasi: minta admin teknis melakukan Sync AI ke ALETA Bot.",
      "Data tidak muncul: cek filter tanggal, koneksi database, dan query terkait.",
    ],
    notes: [
      "Jika ragu, jangan klik tombol berisiko.",
      "Tombol seperti Nonaktifkan, Kembalikan, Hapus Log Lama, Kirim Ulang Pesan Gagal, dan Aktifkan Notifikasi perlu kehati-hatian.",
    ],
    troubleshooting: ["Jika masalah berulang, catat waktu kejadian dan kirimkan ke Super Admin tanpa menyertakan password atau token."],
  },
];
