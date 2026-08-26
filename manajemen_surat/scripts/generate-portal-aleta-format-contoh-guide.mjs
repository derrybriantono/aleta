import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const docsDir = path.join(rootDir, "docs");

const output = {
  markdown: path.join(docsDir, "panduan-portal-aleta-format-contoh.md"),
  html: path.join(docsDir, "panduan-portal-aleta-format-contoh.html"),
  pdf: path.join(docsDir, "panduan-portal-aleta-format-contoh.pdf"),
  report: path.join(docsDir, "panduan-portal-aleta-format-contoh-report.json"),
};

const generatedAt = new Date();
const generatedDate = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "long",
  timeZone: "Asia/Makassar",
}).format(generatedAt);

const version = process.env.PORTAL_ALETA_DOC_VERSION ?? "v1.2 - Juli 2026";
const institution = process.env.PORTAL_ALETA_DOC_INSTITUTION ?? "Pengadilan Agama Donggala";

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function table(headers, rows) {
  return `<table><thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

function mdTable(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell).replaceAll("\n", "<br>")).join(" | ")} |`),
  ].join("\n");
}

function callout(title, body, type = "info") {
  return `<div class="callout ${type}"><strong>${esc(title)}</strong><p>${body}</p></div>`;
}

function section(id, title, children) {
  return `<section class="section"><h1>${id}. ${esc(title)}</h1>${children}</section>`;
}

function subsection(id, title, children) {
  return `<h2>${id} ${esc(title)}</h2>${children}`;
}

function list(items) {
  return `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

function ordered(items) {
  return `<ol>${items.map((item) => `<li>${item}</li>`).join("")}</ol>`;
}

function flow(items) {
  return `<div class="flow">${items.map((item, index) => `<div class="flow-box"><span>${index + 1}</span><b>${esc(item)}</b></div>`).join("")}</div>`;
}

const dashboardRows = [
  ["Kartu Aplikasi", "Menampilkan aplikasi yang dapat dibuka pengguna.", "Klik kartu sesuai kebutuhan kerja."],
  ["Sidebar/Menu", "Navigasi cepat ke halaman dalam portal atau modul.", "Menu mengikuti role dan permission."],
  ["Profil Akun", "Menampilkan identitas akun dan akses logout.", "Pastikan akun yang tampil adalah akun sendiri."],
  ["Informasi Sistem", "Menampilkan ringkasan, status, atau notifikasi bila tersedia.", "Baca sebelum memulai pekerjaan."],
  ["Hak Akses", "Menyaring menu dan fitur yang boleh digunakan.", "Dikelola melalui role, permission, dan module visibility."],
];

const roleRows = [
  ["Super Admin", "Mengatur seluruh sistem, user, role, modul, dan konfigurasi penting.", "Hanya untuk pengelola inti."],
  ["Admin", "Mengelola user, role, permission, jabatan, dan pengaturan operasional.", "Perlu uji akses setelah perubahan."],
  ["Operator Surat", "Membuat, mengedit, mencari, mengunggah lampiran, dan memproses surat.", "Role utama Manajemen Surat."],
  ["Hakim", "Melihat surat/disposisi yang terkait dengan tugasnya.", "Akses mengikuti disposisi dan kebijakan."],
  ["Panitera", "Memantau atau menindaklanjuti surat sesuai kewenangan.", "Dapat berbeda sesuai jabatan."],
  ["Jurusita", "Melihat tugas atau disposisi pelaksanaan yang relevan.", "Tidak otomatis melihat semua surat."],
  ["User Biasa", "Mengakses fitur yang diberikan secara terbatas.", "Tidak dapat membuka admin tanpa permission."],
];

const letterFields = [
  ["Nomor Surat", "Identitas utama surat.", "Wajib teliti agar tidak menyulitkan arsip."],
  ["Tanggal Surat", "Tanggal dokumen diterbitkan.", "Bedakan dengan tanggal terima/kirim."],
  ["Asal/Tujuan", "Sumber atau penerima surat.", "Gunakan nama yang jelas dan konsisten."],
  ["Perihal", "Ringkasan isi surat.", "Singkat, jelas, dan mudah dicari."],
  ["Kategori/Klasifikasi", "Pengelompokan administrasi.", "Membantu filter dan laporan."],
  ["Status", "Tahap pemrosesan surat.", "Perbarui sesuai perkembangan."],
  ["Lampiran", "File pendukung digital.", "Upload file valid dan sesuai hak akses."],
  ["Disposisi", "Arahan/tugas kepada penerima.", "Pilih penerima yang benar."],
];

const aiExamples = [
  ["Ringkasan Surat", "Buat ringkasan 5 poin dari isi surat berikut.", "Gunakan untuk memahami dokumen lebih cepat."],
  ["Draft Narasi", "Susun narasi formal berdasarkan poin-poin berikut.", "Edit kembali agar sesuai gaya bahasa kantor."],
  ["Poin Tindak Lanjut", "Ambil poin penting, batas waktu, dan pihak terkait.", "Berguna sebelum disposisi."],
  ["Cek Konsistensi", "Periksa tanggal, nomor, nama, dan istilah yang tidak konsisten.", "Tetap perlu cek manual."],
  ["Rapi Bahasa", "Rapikan bahasa agar lebih formal tanpa mengubah makna.", "Pastikan substansi tetap sama."],
];

const troubleshootRows = [
  ["Tidak bisa login", "Identitas/password salah, akun nonaktif, atau session bermasalah.", "Periksa identitas, coba login ulang, hubungi admin bila tetap gagal.", "User/Admin"],
  ["User tidak aktif", "Akun dinonaktifkan karena kebijakan atau perubahan tugas.", "Admin memverifikasi lalu mengaktifkan bila masih berwenang.", "Admin"],
  ["Menu tidak muncul", "Role, permission, atau module visibility belum diberikan.", "Admin memeriksa pengaturan akses.", "Admin"],
  ["Akses ditolak", "User membuka halaman tanpa hak akses.", "Gunakan menu yang tersedia atau ajukan kebutuhan akses.", "User/Admin"],
  ["Data surat tidak tampil", "Filter aktif, data kosong, atau akses terbatas.", "Reset filter, cek kata kunci, dan pastikan hak akses.", "User/Operator"],
  ["Gagal tambah surat", "Field wajib kosong atau format input salah.", "Lengkapi data dan perbaiki format.", "Operator"],
  ["Gagal disposisi", "Penerima tidak valid atau instruksi belum jelas.", "Pilih penerima valid dan isi instruksi.", "Operator/Pejabat"],
  ["Gagal upload lampiran", "Format/ukuran file tidak sesuai atau koneksi terganggu.", "Gunakan file valid dan ulangi upload.", "Operator"],
  ["AI tidak merespons", "Fitur AI belum aktif atau konfigurasi belum lengkap.", "Admin memeriksa pengaturan AI.", "Admin"],
  ["Hasil AI kurang tepat", "Prompt terlalu umum atau konteks kurang.", "Perjelas instruksi dan verifikasi manual.", "User"],
  ["Halaman loading terus", "Koneksi lambat, session kedaluwarsa, atau API bermasalah.", "Refresh, login ulang, lalu laporkan bila berulang.", "User/Admin"],
  ["Error server/API", "Gangguan backend, database, atau konfigurasi.", "Catat waktu, halaman, aksi terakhir, dan pesan error.", "Admin/Teknis"],
];

const faqRows = [
  ["Apa itu Portal ALETA?", "Portal ALETA adalah pusat akses aplikasi internal yang menyatukan login, dashboard, dan modul kerja."],
  ["Apa itu SSO?", "SSO adalah Single Sign On, yaitu konsep login satu kali untuk membuka aplikasi yang diizinkan."],
  ["Kenapa menu saya berbeda?", "Menu mengikuti role, permission, jabatan, dan module visibility."],
  ["Siapa yang mengatur user?", "Super Admin dan Admin yang memiliki izin pengelolaan user."],
  ["Siapa yang bisa memakai Manajemen Surat?", "Pengguna yang diberi akses, seperti operator surat, pejabat terkait, atau role lain sesuai kebijakan."],
  ["Apakah semua user bisa melihat semua surat?", "Tidak. Akses surat dibatasi oleh role, permission, disposisi, dan kebijakan data."],
  ["Apakah AI menggantikan pengguna?", "Tidak. AI hanya alat bantu. Keputusan dan tanggung jawab tetap pada manusia."],
  ["Apakah hasil AI harus diperiksa?", "Ya. Semua hasil AI wajib diverifikasi sebelum digunakan."],
  ["Apa yang dilakukan jika modul tidak muncul?", "Hubungi admin untuk memeriksa role, permission, dan module visibility."],
  ["Apakah ALETA akan ditambah aplikasi baru?", "Ya. Portal ALETA dirancang sebagai ekosistem yang bisa terus dikembangkan."],
];

const glossaryRows = [
  ["Portal", "Pusat akses aplikasi internal."],
  ["SSO", "Single Sign On, login satu kali untuk aplikasi yang diizinkan."],
  ["Dashboard", "Halaman utama setelah login."],
  ["Role", "Peran pengguna, misalnya admin, operator, hakim, atau user biasa."],
  ["Permission", "Izin spesifik untuk melihat data atau melakukan aksi."],
  ["Module Visibility", "Pengaturan modul yang tampil untuk role tertentu."],
  ["Manajemen Surat", "Modul pencatatan, disposisi, lampiran, pencarian, dan arsip surat."],
  ["Disposisi", "Arahan atau tindak lanjut surat kepada penerima tertentu."],
  ["Lampiran", "File pendukung digital."],
  ["AI", "Alat bantu berbasis kecerdasan buatan."],
  ["Prompt", "Instruksi yang diberikan kepada AI."],
  ["Session", "Status login pengguna di browser."],
  ["Access Denied", "Kondisi ketika user tidak punya izin mengakses fitur."],
];

const htmlBody = `
  <section class="cover">
    <div class="cover-kicker">PORTAL ALETA</div>
    <h1>Buku Panduan Portal ALETA</h1>
    <p>Panduan Dashboard SSO, Pengaturan Portal, Manajemen Surat, Fitur AI, dan Admin</p>
    <div class="meta-table">
      <div><b>Versi</b><span>${esc(version)}</span></div>
      <div><b>Tanggal</b><span>${esc(generatedDate)}</span></div>
      <div><b>Instansi</b><span>${esc(institution)}</span></div>
      <div><b>Format</b><span>Tanpa screenshot, mengikuti gaya dokumen contoh</span></div>
    </div>
    <div class="cover-note">Dokumen ini menggunakan gaya sederhana: heading biru, tabel formal, bullet ringkas, diagram alur teks, dan footer halaman.</div>
  </section>

  <section class="section toc">
    <h1>Daftar Isi</h1>
    ${table(["No.", "Bab", "Ringkasan"], [
      ["1", "Kata Pengantar", "Tujuan, sasaran pembaca, dan batasan dokumen."],
      ["2", "Gambaran Umum Portal ALETA", "Konsep SSO, dashboard, dan ekosistem aplikasi."],
      ["3", "Dashboard SSO dan Navigasi", "Kartu aplikasi, sidebar, menu, dan akses."],
      ["4", "Pengaturan Portal ALETA", "Profil, role, permission, dan module visibility."],
      ["5", "Login, Logout, dan Session", "Cara masuk, keluar, dan menjaga keamanan akun."],
      ["6", "Manajemen Surat", "Pencatatan, detail, edit, disposisi, lampiran, pencarian."],
      ["7", "Fitur AI", "Cara pakai, contoh, batasan, dan etika penggunaan."],
      ["8", "Panduan Admin", "User, role, permission, jabatan, modul, dan pengaturan."],
      ["9", "Pengembangan Selanjutnya", "Modul lain yang dapat ditambahkan ke ekosistem."],
      ["10", "Troubleshooting, FAQ, Glosarium", "Solusi masalah umum dan istilah penting."],
      ["11", "Checklist Operasional", "Checklist harian user, operator, admin, dan AI."],
    ])}
  </section>

  ${section("1", "Kata Pengantar", `
    <p>Portal ALETA disiapkan sebagai pusat akses layanan elektronik internal. Panduan ini ditujukan untuk membantu pengguna dan admin memahami cara menggunakan portal dengan benar, aman, dan konsisten.</p>
    <p>Dokumen ini dibuat tanpa screenshot agar lebih rapi, ringan, dan mudah diperbarui saat tampilan aplikasi berubah. Visualisasi alur disajikan menggunakan tabel, daftar langkah, callout, dan diagram teks.</p>
    ${callout("Fokus Dokumen", "Panduan ini membahas Dashboard SSO, Pengaturan Portal, Manajemen Surat, Fitur AI, dan Admin. Modul lain hanya disebut singkat sebagai pengembangan ekosistem.", "info")}
    ${table(["Pembaca", "Kebutuhan Utama", "Bagian yang Disarankan"], [
      ["User baru", "Memahami login, dashboard, dan menu dasar.", "Bab 2, 3, 5."],
      ["Operator Surat", "Mengelola surat, lampiran, disposisi, dan pencarian.", "Bab 6 dan checklist operator."],
      ["Admin", "Mengelola user, role, permission, modul, dan pengaturan.", "Bab 4 dan 8."],
      ["Pimpinan/Pejabat", "Memahami disposisi, hak akses, dan penggunaan AI secara aman.", "Bab 6 dan 7."],
    ])}
  `)}

  ${section("2", "Gambaran Umum Portal ALETA", `
    <p>Portal ALETA adalah dashboard SSO atau Single Sign On untuk aplikasi internal. Pengguna cukup login satu kali, kemudian sistem menampilkan aplikasi yang sesuai dengan role dan hak akses pengguna tersebut.</p>
    ${flow(["User", "Login ALETA", "Dashboard SSO", "Pilih Aplikasi", "Gunakan Fitur", "Logout"])}
    ${subsection("2.1", "Manfaat Portal ALETA", list([
      "Akses aplikasi internal menjadi lebih terpusat.",
      "Pengelolaan user, role, dan permission lebih tertib.",
      "Menu pengguna dapat disesuaikan dengan tugas dan jabatan.",
      "Aplikasi baru dapat ditambahkan ke portal secara bertahap.",
      "Keamanan akses lebih baik karena fitur tidak dibuka sama untuk semua user.",
    ]))}
    ${subsection("2.2", "Konsep Ekosistem", `<p>Portal ALETA tidak hanya berfungsi sebagai halaman login. Portal ini menjadi fondasi ekosistem aplikasi internal yang dapat dikembangkan dengan modul baru sesuai kebutuhan satuan kerja.</p>`)}
  `)}

  ${section("3", "Dashboard SSO dan Navigasi", `
    <p>Dashboard SSO adalah halaman utama setelah pengguna berhasil login. Halaman ini menjadi pusat navigasi untuk membuka aplikasi, melihat menu, dan kembali ke portal utama.</p>
    ${subsection("3.1", "Fungsi Dashboard SSO", list([
      "Menjadi halaman awal setelah login.",
      "Menampilkan aplikasi yang dapat diakses pengguna.",
      "Menampilkan menu sesuai role dan permission.",
      "Memberikan akses cepat ke Manajemen Surat, Admin, dan fitur AI jika diaktifkan.",
      "Menjadi tempat pengembangan aplikasi internal selanjutnya.",
    ]))}
    ${subsection("3.2", "Komponen Dashboard", table(["Komponen", "Fungsi", "Catatan"], dashboardRows))}
    ${subsection("3.3", "Alur Penggunaan Dashboard", table(["Langkah", "Tindakan", "Hasil yang Diharapkan"], [
      ["1", "Buka halaman Portal ALETA.", "Halaman login tampil."],
      ["2", "Masukkan identitas akun dan password.", "Sistem memvalidasi akun."],
      ["3", "Login berhasil.", "Pengguna diarahkan ke dashboard."],
      ["4", "Pilih aplikasi atau menu.", "Aplikasi terbuka sesuai hak akses."],
      ["5", "Kembali ke portal bila perlu.", "User dapat memilih modul lain."],
    ]))}
    ${callout("Catatan", "Menu setiap user dapat berbeda karena sistem membaca role, permission, jabatan, dan module visibility.", "note")}
  `)}

  ${section("4", "Pengaturan Portal ALETA", `
    <p>Pengaturan Portal ALETA menentukan bagaimana user, role, permission, jabatan, dan module visibility bekerja. Pengaturan ini menjaga agar pengguna hanya melihat dan memakai fitur sesuai tugasnya.</p>
    ${subsection("4.1", "Konsep Hak Akses", table(["Istilah", "Penjelasan", "Contoh"], [
      ["Akun", "Identitas pengguna untuk login.", "Username, email, NIP, nomor HP."],
      ["Role", "Kelompok peran utama pengguna.", "Admin, Operator Surat, Hakim."],
      ["Permission", "Izin detail untuk fitur atau tindakan.", "Membuat surat, edit, disposisi."],
      ["Jabatan", "Posisi organisasi pengguna.", "Panitera, Jurusita, staf."],
      ["Module Visibility", "Pengaturan modul yang tampil untuk role.", "Manajemen Surat aktif untuk operator."],
    ]))}
    ${subsection("4.2", "Prinsip Pemberian Akses", list([
      "Berikan akses sesuai kebutuhan kerja.",
      "Hindari memberi akses admin hanya untuk membuka satu menu.",
      "User nonaktif tidak boleh tetap dapat login.",
      "Perubahan role dan permission perlu diuji setelah disimpan.",
      "Gunakan prinsip akses minimal agar data tidak terbuka berlebihan.",
    ]))}
    ${subsection("4.3", "Ringkasan Role", table(["Role", "Akses Umum", "Catatan"], roleRows))}
  `)}

  ${section("5", "Login, Logout, dan Session", `
    ${subsection("5.1", "Cara Login", ordered([
      "Buka alamat Portal ALETA melalui browser.",
      "Isi username, email, NIP, atau nomor HP sesuai akun.",
      "Isi password dengan benar.",
      "Klik tombol login.",
      "Jika berhasil, pengguna masuk ke Dashboard SSO.",
    ]))}
    ${subsection("5.2", "Cara Logout", ordered([
      "Buka menu profil atau akun.",
      "Pilih logout.",
      "Pastikan browser kembali ke halaman login.",
      "Tutup browser jika memakai perangkat bersama.",
    ]))}
    ${callout("Keamanan Perangkat Bersama", "Selalu logout setelah selesai. Jangan meninggalkan browser dalam keadaan login, terutama pada komputer bersama.", "warn")}
    ${subsection("5.3", "Login Gagal", table(["Kondisi", "Kemungkinan Penyebab", "Tindakan"], [
      ["Password salah", "Password tidak sesuai.", "Coba ulang atau ikuti prosedur reset."],
      ["Akun tidak ditemukan", "Identitas salah atau akun belum dibuat.", "Hubungi admin."],
      ["User nonaktif", "Akun dinonaktifkan.", "Minta admin melakukan verifikasi."],
      ["Akses ditolak", "Role belum punya permission.", "Minta evaluasi akses bila diperlukan."],
    ]))}
  `)}

  ${section("6", "Manajemen Surat", `
    <p>Manajemen Surat adalah modul untuk mencatat, mengelola, mencari, mendisposisikan, dan mengarsipkan surat secara digital. Modul ini membantu operator dan pejabat terkait bekerja lebih tertib.</p>
    ${subsection("6.1", "Alur Kerja Manajemen Surat", `${flow(["Surat Diterima/Dibuat", "Input Data", "Upload Lampiran", "Simpan", "Disposisi", "Tindak Lanjut", "Arsip"])}`
    )}
    ${subsection("6.2", "Data Penting Surat", table(["Data", "Fungsi", "Catatan"], letterFields))}
    ${subsection("6.3", "Tambah Surat", ordered([
      "Buka menu Manajemen Surat.",
      "Pilih tambah surat sesuai jenis surat.",
      "Isi nomor, tanggal, asal/tujuan, perihal, kategori, dan status.",
      "Upload lampiran jika tersedia.",
      "Periksa ulang data.",
      "Simpan dan pastikan data muncul di daftar surat.",
    ]))}
    ${subsection("6.4", "Detail dan Edit Surat", `<p>Halaman detail dipakai untuk melihat metadata, status, lampiran, dan riwayat disposisi. Edit hanya dilakukan oleh user yang memiliki permission dan hanya bila data perlu diperbaiki.</p>`)}
    ${subsection("6.5", "Disposisi Surat", ordered([
      "Buka detail surat.",
      "Pilih menu disposisi.",
      "Pilih penerima yang valid.",
      "Tulis instruksi secara jelas.",
      "Simpan disposisi.",
      "Pastikan penerima dapat melihat tugas sesuai hak akses.",
    ]))}
    ${subsection("6.6", "Lampiran, Pencarian, dan Arsip", list([
      "Upload hanya file valid dan sesuai kebutuhan.",
      "Download hanya boleh dilakukan oleh user yang berhak.",
      "Gunakan kata kunci, status, kategori, atau tanggal untuk mencari surat.",
      "Kosongkan filter bila data tidak muncul.",
      "Pastikan status surat diperbarui sesuai tahap proses.",
    ]))}
    ${callout("Best Practice", "Sebelum menyimpan surat, periksa nomor, tanggal, asal/tujuan, perihal, dan lampiran. Kesalahan metadata dapat menyulitkan pencarian arsip.", "note")}
  `)}

  ${section("7", "Fitur AI", `
    <p>Fitur AI membantu pengguna menyusun draft, meringkas informasi, membuat daftar poin penting, memberi rekomendasi awal, dan merapikan bahasa. AI adalah alat bantu, bukan pengganti kewenangan manusia.</p>
    ${subsection("7.1", "Cara Menggunakan AI", ordered([
      "Buka fitur AI pada modul yang tersedia.",
      "Tulis instruksi dengan jelas dan spesifik.",
      "Berikan konteks secukupnya.",
      "Baca hasil dengan teliti.",
      "Edit hasil sesuai kebutuhan.",
      "Verifikasi manual sebelum digunakan.",
    ]))}
    ${subsection("7.2", "Contoh Penggunaan", table(["Kebutuhan", "Contoh Instruksi", "Catatan"], aiExamples))}
    ${subsection("7.3", "Batasan dan Etika", list([
      "AI dapat keliru memahami konteks.",
      "Hasil AI wajib diverifikasi.",
      "AI tidak menggantikan keputusan pejabat/pengguna.",
      "Jangan memasukkan data sensitif yang tidak diperlukan.",
      "Gunakan AI sesuai kebijakan satuan kerja.",
    ]))}
    ${callout("Perhatian", "Jangan memasukkan password, token, secret, data pribadi berlebihan, atau dokumen yang tidak perlu diproses AI.", "warn")}
  `)}

  ${section("8", "Panduan Admin", `
    <p>Admin bertanggung jawab menjaga struktur akses dan pengaturan aplikasi. Kesalahan pengaturan admin dapat berdampak langsung pada menu, akses data, dan keamanan operasional.</p>
    ${subsection("8.1", "Fungsi Admin", list([
      "Mengelola user.",
      "Mengelola role dan permission.",
      "Mengatur jabatan/posisi.",
      "Mengatur module visibility.",
      "Mengelola pengaturan Manajemen Surat.",
      "Mengelola pengaturan AI bila tersedia.",
      "Memastikan aplikasi siap digunakan.",
    ]))}
    ${subsection("8.2", "Manajemen User", ordered([
      "Tambah user hanya untuk pihak yang berwenang.",
      "Isi identitas akun dengan benar.",
      "Tentukan role sesuai tugas.",
      "Hubungkan user dengan jabatan bila tersedia.",
      "Aktifkan user setelah data benar.",
      "Nonaktifkan user yang tidak lagi berwenang.",
    ]))}
    ${subsection("8.3", "Role, Permission, dan Jabatan", `<p>Role memudahkan pengelompokan akses. Permission mengatur tindakan detail. Jabatan dapat memengaruhi alur disposisi dan struktur kerja. Setelah mengubah salah satu pengaturan ini, admin perlu menguji akses dengan akun terkait.</p>`)}
    ${subsection("8.4", "Module Visibility", table(["Langkah", "Tindakan", "Tujuan"], [
      ["1", "Pilih role yang akan diatur.", "Menentukan kelompok pengguna."],
      ["2", "Aktif/nonaktifkan modul.", "Mengatur menu yang tampil."],
      ["3", "Simpan perubahan.", "Menerapkan konfigurasi."],
      ["4", "Uji login sebagai role terkait.", "Memastikan akses sesuai."],
    ]))}
    ${subsection("8.5", "Checklist Admin", list([
      "User aktif sesuai kebutuhan.",
      "Role dan jabatan sudah tepat.",
      "Permission tidak berlebihan.",
      "Module visibility sudah diuji.",
      "Manajemen Surat dapat dipakai operator.",
      "AI dikonfigurasi sesuai kebijakan.",
      "Masalah berulang dicatat untuk tindak lanjut teknis.",
    ]))}
  `)}

  ${section("9", "Aplikasi Pengembangan Selanjutnya", `
    <p>Portal ALETA dapat terus dikembangkan sebagai ekosistem aplikasi internal. Selain Dashboard SSO, Manajemen Surat, Fitur AI, dan Admin, modul baru dapat ditambahkan sesuai kebutuhan satuan kerja.</p>
    ${table(["Jenis Pengembangan", "Contoh", "Prinsip"], [
      ["Monitoring", "Pemantauan data atau indikator kerja.", "Tetap mengikuti SSO dan role."],
      ["Integrasi Data", "Koneksi ke sistem lain.", "Akses aman dan sesuai izin."],
      ["Dokumen", "Penyusunan atau arsip dokumen.", "Data terstruktur dan mudah dicari."],
      ["Notifikasi", "Pengingat atau informasi tugas.", "Dikirim sesuai hak akses."],
    ])}
    ${callout("Batasan Panduan", "ALETA x SIPP, JLF, Query Registry, Variable Registry, dan WhatsApp Gateway tidak dibahas detail pada dokumen ini. Modul tersebut dapat memiliki panduan teknis tersendiri.", "info")}
  `)}

  ${section("10", "Troubleshooting", table(["Masalah", "Kemungkinan Penyebab", "Solusi", "Ditangani Oleh"], troubleshootRows))}

  ${section("11", "FAQ", table(["Pertanyaan", "Jawaban"], faqRows))}

  ${section("12", "Glosarium", table(["Istilah", "Penjelasan"], glossaryRows))}

  ${section("13", "Checklist Operasional", `
    ${subsection("13.1", "Checklist Harian User", list([
      "Login memakai akun pribadi.",
      "Pastikan nama akun benar.",
      "Buka modul sesuai tugas.",
      "Periksa data sebelum menyimpan.",
      "Logout setelah selesai.",
    ]))}
    ${subsection("13.2", "Checklist Operator Surat", list([
      "Nomor dan tanggal surat benar.",
      "Asal/tujuan jelas.",
      "Perihal singkat dan informatif.",
      "Lampiran valid.",
      "Disposisi dikirim ke penerima yang benar.",
    ]))}
    ${subsection("13.3", "Checklist Penggunaan AI Aman", list([
      "Prompt jelas dan spesifik.",
      "Tidak memasukkan data sensitif yang tidak perlu.",
      "Hasil AI diverifikasi manual.",
      "Keputusan tetap oleh manusia berwenang.",
    ]))}
  `)}
`;

const html = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Buku Panduan Portal ALETA</title>
  <style>
    @page { size: A4; margin: 16mm 16mm 22mm 16mm; }
    :root {
      --blue: #1e4dd8;
      --navy: #0b1f3a;
      --text: #1f2937;
      --muted: #4b5563;
      --line: #d1d5db;
      --zebra: #f8fafc;
      --soft-blue: #eef4ff;
      --soft-yellow: #fff7df;
    }
    body {
      margin: 0;
      color: var(--text);
      font-family: "DejaVu Sans", "Segoe UI", Arial, sans-serif;
      font-size: 10.2pt;
      line-height: 1.48;
      background: #fff;
    }
    .cover {
      min-height: 235mm;
      display: flex;
      flex-direction: column;
      justify-content: center;
      border-top: 12px solid var(--navy);
      border-bottom: 3px solid var(--blue);
      page-break-after: always;
    }
    .cover-kicker {
      color: var(--blue);
      font-size: 11pt;
      font-weight: 700;
      letter-spacing: 1.6px;
      text-transform: uppercase;
      margin-bottom: 18px;
    }
    .cover h1 {
      color: var(--navy);
      font-size: 31pt;
      line-height: 1.12;
      margin: 0 0 12px;
    }
    .cover p {
      color: var(--muted);
      font-size: 13pt;
      max-width: 440px;
      margin: 0 0 28px;
    }
    .meta-table {
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
      max-width: 470px;
      margin-top: 14px;
    }
    .meta-table div {
      display: grid;
      grid-template-columns: 110px 1fr;
      border-bottom: 1px solid var(--line);
      min-height: 34px;
    }
    .meta-table div:last-child { border-bottom: 0; }
    .meta-table b {
      background: var(--navy);
      color: #fff;
      padding: 8px 10px;
      font-size: 9pt;
    }
    .meta-table span {
      padding: 8px 10px;
      color: var(--text);
      font-size: 9pt;
    }
    .cover-note {
      margin-top: 22px;
      padding: 12px 14px;
      max-width: 470px;
      background: var(--soft-blue);
      color: var(--muted);
      border-left: 4px solid var(--blue);
      border-radius: 6px;
    }
    .section {
      page-break-before: always;
    }
    .section.toc {
      page-break-before: auto;
    }
    h1 {
      color: var(--navy);
      font-size: 19pt;
      margin: 0 0 14px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--line);
    }
    h2 {
      color: var(--blue);
      font-size: 12.5pt;
      margin: 16px 0 8px;
    }
    p {
      margin: 0 0 10px;
    }
    ul, ol {
      margin: 7px 0 12px 18px;
      padding: 0;
    }
    li {
      margin: 4px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0 16px;
      font-size: 8.8pt;
      page-break-inside: avoid;
    }
    th {
      background: var(--navy);
      color: #fff;
      text-align: left;
      padding: 7px 8px;
      border: 1px solid var(--navy);
      font-weight: 700;
    }
    td {
      border: 1px solid var(--line);
      padding: 7px 8px;
      vertical-align: top;
    }
    tr:nth-child(even) td {
      background: var(--zebra);
    }
    .callout {
      margin: 12px 0;
      padding: 10px 12px;
      border-radius: 6px;
      border-left: 4px solid var(--blue);
      background: var(--soft-blue);
      page-break-inside: avoid;
    }
    .callout.warn {
      background: var(--soft-yellow);
      border-left-color: #d97706;
    }
    .callout strong {
      display: block;
      margin-bottom: 3px;
      color: var(--navy);
    }
    .callout p {
      margin: 0;
      color: var(--muted);
    }
    .flow {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin: 10px 0 16px;
      page-break-inside: avoid;
    }
    .flow-box {
      border: 1px solid var(--line);
      border-left: 4px solid var(--blue);
      border-radius: 6px;
      background: #fff;
      padding: 9px;
      min-height: 42px;
    }
    .flow-box span {
      display: inline-block;
      color: var(--blue);
      font-weight: 700;
      margin-right: 5px;
    }
    .flow-box b {
      font-size: 9pt;
      color: var(--text);
    }
  </style>
</head>
<body>
${htmlBody}
</body>
</html>`;

const markdown = `# Buku Panduan Portal ALETA

Panduan Dashboard SSO, Pengaturan Portal, Manajemen Surat, Fitur AI, dan Admin.

Versi: ${version}  
Tanggal: ${generatedDate}  
Instansi: ${institution}

## Ringkasan Format

Dokumen ini mengikuti gaya PDF contoh: A4, heading biru, teks sederhana, tabel formal, daftar langkah, dan footer halaman.

## Ringkasan Fokus

- Dashboard SSO dan Portal Utama.
- Pengaturan Portal ALETA.
- Manajemen Surat.
- Fitur AI.
- Admin.

## Role Umum

${mdTable(["Role", "Akses Umum", "Catatan"], roleRows)}

## Data Surat

${mdTable(["Data", "Fungsi", "Catatan"], letterFields)}

## Troubleshooting

${mdTable(["Masalah", "Kemungkinan Penyebab", "Solusi", "Ditangani Oleh"], troubleshootRows)}
`;

async function renderPdf() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1240, height: 1754 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });
  await page.pdf({
    path: output.pdf,
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: "<div></div>",
    footerTemplate: `
      <div style="width:100%;font-family:DejaVu Sans,Segoe UI,Arial,sans-serif;font-size:8px;color:#4b5563;margin:0 16mm;">
        <div style="border-top:0.4px solid #d1d5db;padding-top:5px;display:flex;justify-content:space-between;">
          <span>Buku Panduan Portal ALETA - tanpa screenshot</span>
          <span>Halaman <span class="pageNumber"></span></span>
        </div>
      </div>
    `,
    margin: { top: "16mm", right: "16mm", bottom: "22mm", left: "16mm" },
  });
  await browser.close();
}

async function main() {
  fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(output.markdown, markdown, "utf8");
  fs.writeFileSync(output.html, html, "utf8");
  await renderPdf();

  const pdf = await PDFDocument.load(fs.readFileSync(output.pdf));
  const imageTagCount = (html.match(/<img\b/gi) ?? []).length;
  const imagePathCount = (html.match(/\.(png|jpe?g|webp|gif|svg)/gi) ?? []).length;
  const screenshotPathCount = (html.match(/screenshots?[\\/]/gi) ?? []).length;
  const sensitivePatternCount = (html.match(/password\s*[:=]|token\s*[:=]|secret\s*[:=]|api[_-]?key\s*[:=]/gi) ?? []).length;

  const report = {
    generatedAt: generatedAt.toISOString(),
    generatedDate,
    version,
    institution,
    sourceExample: "C:\\Users\\Delota13\\Downloads\\Panduan_Portal_ALETA_Tanpa_Screenshot.pdf",
    exampleFormatObserved: {
      engine: "ReportLab-style PDF",
      pageSize: "A4",
      pageCount: 11,
      style: "white pages, blue headings, dark table headers, zebra rows, simple footer",
    },
    files: output,
    pdfPageCount: pdf.getPageCount(),
    method: "Node.js membuat Markdown dan HTML dengan gaya seperti PDF contoh. Playwright hanya merender HTML menjadi PDF tanpa screenshot.",
    verification: {
      usesScreenshots: false,
      imageTagCount,
      imagePathCount,
      screenshotPathCount,
      hasPlaceholderScreenshot: false,
      hasLoadingImage: false,
      sensitivePatternCount,
    },
  };

  fs.writeFileSync(output.report, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
