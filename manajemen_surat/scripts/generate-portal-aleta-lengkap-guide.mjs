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
  markdown: path.join(docsDir, "panduan-portal-aleta-lengkap.md"),
  html: path.join(docsDir, "panduan-portal-aleta-lengkap.html"),
  pdf: path.join(docsDir, "panduan-portal-aleta-lengkap.pdf"),
  report: path.join(docsDir, "panduan-portal-aleta-lengkap-report.json"),
};

const generatedAt = new Date();
const generatedDate = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "long",
  timeZone: "Asia/Makassar",
}).format(generatedAt);

const version = process.env.PORTAL_ALETA_DOC_VERSION ?? "v1.1 - Juli 2026";
const institution = process.env.PORTAL_ALETA_DOC_INSTITUTION ?? "Pengadilan Agama Donggala";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function table(headers, rows) {
  return `<table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows
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

function card(title, body, tag = "") {
  return `<div class="card">${tag ? `<span class="tag">${escapeHtml(tag)}</span>` : ""}<h3>${escapeHtml(title)}</h3><p>${body}</p></div>`;
}

function callout(kind, title, body) {
  return `<div class="callout ${kind}"><strong>${escapeHtml(title)}</strong><p>${body}</p></div>`;
}

function checklist(items) {
  return `<ul class="checklist">${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

function flow(items) {
  return `<div class="flow">${items.map((item, index) => `<div class="flow-step"><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(item)}</strong></div>`).join("")}</div>`;
}

function steps(items) {
  return `<ol class="steps">${items.map((item) => `<li>${item}</li>`).join("")}</ol>`;
}

function chapter(index, title, lead, content) {
  return `<section class="chapter" id="chapter-${index}">
    <div class="chapter-head">
      <span>${String(index).padStart(2, "0")}</span>
      <div>
        <h2>${escapeHtml(title)}</h2>
        <p>${lead}</p>
      </div>
    </div>
    ${content}
  </section>`;
}

const chapters = [
  "Kata Pengantar",
  "Cara Menggunakan Buku Panduan",
  "Gambaran Umum Portal ALETA",
  "Konsep Akun, Role, Permission, dan Hak Akses",
  "Login, Logout, dan Keamanan Session",
  "Dashboard SSO dan Navigasi Portal",
  "Pengaturan Portal untuk Pengguna",
  "Manajemen Surat: Konsep dan Fungsi Utama",
  "Manajemen Surat: Tambah, Detail, Edit, dan Status",
  "Manajemen Surat: Disposisi, Lampiran, Pencarian, dan Arsip",
  "Fitur AI: Cara Pakai, Batasan, Etika, dan Contoh",
  "Panduan Admin: User, Role, Permission, Jabatan",
  "Panduan Admin: Module Visibility, Pengaturan Surat, dan AI",
  "Aplikasi Pengembangan Selanjutnya",
  "Troubleshooting Lengkap",
  "FAQ",
  "Glosarium",
  "Lampiran Checklist Operasional",
];

const dashboardRows = [
  ["Kartu aplikasi", "Menampilkan aplikasi yang boleh dibuka pengguna.", "Klik kartu untuk masuk ke modul terkait."],
  ["Sidebar/menu", "Navigasi cepat ke fitur dalam konteks portal atau modul.", "Menu dapat berbeda untuk setiap role."],
  ["Profil akun", "Melihat identitas akun, status login, dan tombol logout.", "Dipakai untuk memastikan akun aktif benar."],
  ["Area informasi", "Menampilkan ringkasan, status, tugas, atau informasi sistem jika tersedia.", "Baca sebelum mulai bekerja."],
  ["Access control", "Menyaring menu dan akses berdasarkan role, permission, dan module visibility.", "Berjalan otomatis di belakang layar."],
  ["Tombol kembali ke portal", "Mengembalikan pengguna ke Dashboard SSO dari modul kerja.", "Dipakai saat ingin pindah aplikasi."],
];

const roleRows = [
  ["Super Admin", "Akses tertinggi untuk konfigurasi sistem, user, role, dan modul.", "Gunakan terbatas untuk kebutuhan pengelolaan inti."],
  ["Admin", "Mengelola user, pengaturan modul, dan operasional tertentu.", "Akses perlu disesuaikan kebijakan satuan kerja."],
  ["Operator Surat", "Menginput, mengedit, mencari, mengarsipkan, dan memproses surat.", "Role utama untuk administrasi persuratan."],
  ["Hakim", "Melihat surat atau disposisi yang berhubungan dengan tugasnya.", "Akses mengikuti penugasan dan disposisi."],
  ["Panitera", "Memantau atau memberi arahan pada alur surat/disposisi tertentu.", "Dapat memiliki akses lebih luas sesuai jabatan."],
  ["Jurusita", "Melihat tugas atau disposisi pelaksanaan yang relevan.", "Tidak otomatis melihat semua data surat."],
  ["User biasa", "Akses terbatas pada fitur yang memang diberikan.", "Tidak boleh membuka admin tanpa permission."],
];

const suratFieldRows = [
  ["Nomor surat", "Identitas utama surat.", "Pastikan format sesuai kebijakan kantor."],
  ["Tanggal surat", "Tanggal dokumen diterbitkan.", "Bedakan dengan tanggal terima atau tanggal kirim."],
  ["Tanggal terima/kirim", "Tanggal surat diterima atau dikirim.", "Dipakai untuk pelacakan timeline."],
  ["Asal surat", "Instansi atau pihak pengirim.", "Wajib rapi agar pencarian mudah."],
  ["Tujuan surat", "Unit, pejabat, atau pihak tujuan.", "Sesuaikan dengan alur kerja."],
  ["Perihal", "Ringkasan isi surat.", "Buat singkat tetapi jelas."],
  ["Kategori/klasifikasi", "Pengelompokan arsip atau jenis surat.", "Membantu filter dan laporan."],
  ["Status", "Tahap pemrosesan surat.", "Perbarui saat ada tindak lanjut."],
  ["Lampiran", "File pendukung digital.", "Upload hanya file valid."],
];

const aiUseRows = [
  ["Ringkasan surat", "Buat ringkasan 5 poin dari isi surat berikut.", "Cocok untuk memahami cepat isi dokumen."],
  ["Draft narasi", "Susun narasi formal berdasarkan poin berikut.", "Hasil perlu disesuaikan gaya bahasa instansi."],
  ["Analisis tindak lanjut", "Buat rekomendasi tindak lanjut administratif.", "Tidak menggantikan keputusan pejabat."],
  ["Pemeriksaan konsistensi", "Periksa konsistensi tanggal, nama, dan nomor surat.", "Tetap lakukan cek manual."],
  ["Perbaikan bahasa", "Rapikan bahasa agar lebih formal dan jelas.", "Pastikan makna tidak berubah."],
  ["Daftar poin penting", "Ambil poin utama, batas waktu, dan pihak terkait.", "Membantu sebelum disposisi."],
];

const troubleshootingRows = [
  ["Tidak bisa login", "Username/password salah, akun nonaktif, atau session bermasalah.", "Periksa kembali identitas, coba login ulang, dan hubungi admin jika tetap gagal.", "User/Admin"],
  ["Password salah", "Password tidak sesuai atau lupa password.", "Ikuti prosedur reset password yang ditetapkan satuan kerja.", "User/Admin"],
  ["User tidak aktif", "Akun dinonaktifkan karena mutasi, perubahan tugas, atau kebijakan admin.", "Admin memverifikasi kewenangan lalu mengaktifkan kembali jika layak.", "Admin"],
  ["Dashboard kosong", "Role belum diberi module visibility atau permission.", "Admin memeriksa role, permission, dan visibility aplikasi.", "Admin"],
  ["Menu tidak muncul", "Modul belum aktif untuk role pengguna.", "Jangan memaksa URL langsung. Hubungi admin untuk evaluasi akses.", "User/Admin"],
  ["Akses ditolak", "Pengguna membuka fitur tanpa permission.", "Gunakan fitur yang tersedia atau minta admin meninjau kebutuhan akses.", "User/Admin"],
  ["Data surat tidak tampil", "Filter aktif, data kosong, atau akses terbatas.", "Reset filter, cek kata kunci, dan pastikan memiliki hak melihat data.", "User/Operator"],
  ["Gagal tambah surat", "Field wajib belum diisi atau format input tidak valid.", "Lengkapi data wajib dan perbaiki format input.", "Operator"],
  ["Gagal edit surat", "User tidak punya permission atau status surat tidak boleh diedit.", "Cek hak akses dan status surat.", "Operator/Admin"],
  ["Gagal disposisi", "Penerima tidak valid, instruksi kosong, atau role tidak berwenang.", "Pilih penerima dari daftar valid dan isi instruksi dengan jelas.", "Pejabat/Operator"],
  ["Lampiran gagal upload", "Format/ukuran file tidak sesuai atau koneksi terganggu.", "Gunakan file valid dan ulangi upload dengan koneksi stabil.", "Operator"],
  ["Lampiran gagal download", "File tidak ditemukan atau user tidak berwenang.", "Pastikan surat benar dan user punya akses. Laporkan bila file hilang.", "User/Admin"],
  ["AI tidak merespons", "Fitur AI belum aktif, konfigurasi belum lengkap, atau layanan sedang bermasalah.", "Admin memeriksa pengaturan AI dan status layanan.", "Admin"],
  ["Hasil AI tidak sesuai", "Instruksi terlalu umum atau konteks kurang.", "Perjelas prompt, tambah konteks, dan periksa hasil manual.", "User"],
  ["Halaman loading terus", "Koneksi lambat, session kedaluwarsa, atau API bermasalah.", "Refresh, login ulang, lalu laporkan waktu kejadian jika berulang.", "User/Admin"],
  ["Error server/API", "Gangguan backend, database, atau konfigurasi.", "Catat waktu kejadian, halaman, dan aksi terakhir sebelum error.", "Admin/Teknis"],
];

const faqRows = [
  ["Apa itu Portal ALETA?", "Portal ALETA adalah pusat akses aplikasi internal yang menyatukan login, dashboard, dan modul kerja dalam satu tempat."],
  ["Apakah ALETA satu aplikasi atau kumpulan aplikasi?", "ALETA adalah portal terpadu. Di dalamnya dapat tersedia beberapa aplikasi sesuai kebutuhan dan hak akses."],
  ["Apa itu SSO?", "SSO atau Single Sign On berarti pengguna cukup login satu kali untuk masuk ke portal dan membuka aplikasi yang diizinkan."],
  ["Kenapa menu saya berbeda dengan rekan kerja?", "Menu dipengaruhi role, permission, jabatan, dan module visibility. Perbedaan menu adalah hal normal bila tugas berbeda."],
  ["Siapa yang boleh mengatur user?", "Super Admin dan Admin yang memiliki izin pengelolaan user."],
  ["Siapa yang bisa memakai Manajemen Surat?", "Pengguna yang diberi akses, misalnya operator surat, pejabat terkait, atau role lain sesuai kebijakan kantor."],
  ["Apakah semua user bisa melihat semua surat?", "Tidak. Akses surat mengikuti role, permission, disposisi, dan kebijakan akses data."],
  ["Apakah AI menggantikan pengguna?", "Tidak. AI hanya membantu menyusun, meringkas, atau memberi rekomendasi awal. Keputusan tetap milik manusia."],
  ["Apakah hasil AI harus diperiksa?", "Ya. Semua hasil AI wajib diverifikasi sebelum dipakai."],
  ["Apa yang dilakukan jika modul tidak muncul?", "Hubungi admin untuk memeriksa role, permission, dan module visibility."],
  ["Apakah Portal ALETA akan bertambah modul?", "Ya. Portal ini dirancang sebagai ekosistem yang dapat dikembangkan dengan aplikasi baru."],
];

const glossaryRows = [
  ["Portal", "Pusat akses aplikasi internal."],
  ["SSO", "Single Sign On, login satu kali untuk membuka aplikasi yang diizinkan."],
  ["Dashboard", "Halaman utama setelah login."],
  ["Role", "Peran pengguna, seperti admin, operator, hakim, panitera, atau user biasa."],
  ["Permission", "Izin spesifik untuk melihat data atau melakukan tindakan."],
  ["Module Visibility", "Pengaturan modul apa yang tampil untuk role tertentu."],
  ["Admin", "Pengguna yang mengelola akun, akses, dan konfigurasi aplikasi."],
  ["User", "Pengguna Portal ALETA."],
  ["Manajemen Surat", "Modul untuk mencatat, memproses, mendisposisi, dan mencari surat."],
  ["Disposisi", "Arahan atau tindak lanjut atas surat kepada penerima tertentu."],
  ["Lampiran", "File pendukung surat."],
  ["AI", "Alat bantu berbasis kecerdasan buatan."],
  ["Prompt", "Instruksi atau pertanyaan kepada AI."],
  ["Session", "Status login pengguna pada browser."],
  ["Upload", "Mengunggah file ke aplikasi."],
  ["Download", "Mengunduh file dari aplikasi."],
  ["Access Denied", "Kondisi ketika user tidak punya izin membuka halaman atau fitur."],
];

const htmlContent = [
  chapter(1, "Kata Pengantar", "Panduan ini disusun untuk membantu pengguna dan admin memahami Portal ALETA secara lebih utuh, tetapi tetap mudah dibaca.", `
    <p>Portal ALETA dikembangkan sebagai pusat akses layanan elektronik internal. Tujuan utamanya adalah menyatukan login, dashboard aplikasi, pengaturan akses, dan modul kerja agar pegawai dapat bekerja dengan lebih tertib.</p>
    <p>Versi panduan ini dibuat lebih lengkap daripada versi ringkas. Isi panduan tetap dibatasi pada area yang paling sering dipakai: Dashboard SSO, Pengaturan Portal, Manajemen Surat, Fitur AI, dan Admin. Modul lain hanya disebut sebagai bagian pengembangan ekosistem ke depan.</p>
    ${callout("note", "Tanpa screenshot", "Panduan ini sengaja tidak memakai screenshot agar lebih rapi, ringan, dan mudah diperbarui. Seluruh penjelasan menggunakan tabel, alur teks, card informasi, dan checklist.")}
    <div class="grid-2">
      ${card("Untuk pengguna", "Membantu memahami cara login, membuka dashboard, mengelola surat, menggunakan AI secara aman, dan menyelesaikan masalah umum.", "User")}
      ${card("Untuk admin", "Membantu mengelola user, role, permission, jabatan, module visibility, pengaturan Manajemen Surat, dan kontrol AI.", "Admin")}
    </div>
  `),
  chapter(2, "Cara Menggunakan Buku Panduan", "Buku ini dapat dibaca dari awal, tetapi juga bisa dipakai sebagai referensi cepat sesuai kebutuhan.", `
    <div class="grid-3">
      ${card("Pegawai baru", "Mulai dari bab Gambaran Umum, Login, Dashboard, lalu Manajemen Surat.", "Mulai")}
      ${card("Operator surat", "Fokus pada bab Manajemen Surat, Disposisi, Lampiran, Pencarian, dan Troubleshooting.", "Operasional")}
      ${card("Admin", "Fokus pada bab Admin, Pengaturan Portal, Module Visibility, dan Checklist.", "Pengelola")}
    </div>
    <h3>Konvensi istilah</h3>
    <p>Istilah <strong>user</strong> berarti pengguna aplikasi. Istilah <strong>admin</strong> berarti pengguna yang berwenang mengelola akses dan pengaturan. Istilah <strong>role</strong> dan <strong>permission</strong> berkaitan dengan hak akses.</p>
    ${callout("good", "Saran penggunaan", "Saat melakukan pelatihan internal, gunakan bab Dashboard, Manajemen Surat, dan AI sebagai materi untuk user. Gunakan bab Admin dan Checklist sebagai materi untuk pengelola aplikasi.")}
  `),
  chapter(3, "Gambaran Umum Portal ALETA", "Portal ALETA adalah pusat login dan dashboard aplikasi internal yang menampilkan modul sesuai hak akses pengguna.", `
    <p>Portal ALETA bekerja sebagai pintu masuk utama. Setelah login, pengguna masuk ke Dashboard SSO. Dari dashboard, pengguna dapat memilih aplikasi yang tersedia. Aplikasi yang muncul tidak selalu sama antara satu user dan user lain karena sistem membaca role, permission, jabatan, dan module visibility.</p>
    ${flow(["User membuka ALETA", "Login", "Dashboard SSO", "Pilih aplikasi", "Gunakan fitur", "Logout"])}
    <h3>Manfaat utama</h3>
    <div class="grid-3">
      ${card("Lebih terpusat", "Aplikasi internal dapat dibuka dari satu portal sehingga pengguna tidak perlu mengingat banyak alamat aplikasi.")}
      ${card("Lebih tertib", "User, role, permission, dan visibility dapat dikelola lebih rapi oleh admin.")}
      ${card("Lebih aman", "Akses dibatasi sesuai kebutuhan tugas, bukan dibuka sama untuk semua pengguna.")}
      ${card("Lebih cepat", "Pengguna dapat langsung membuka modul kerja dari dashboard setelah login.")}
      ${card("Lebih mudah dikembangkan", "Modul baru dapat ditambahkan ke ekosistem portal dengan konsep akses yang sama.")}
      ${card("Lebih mudah diaudit", "Pengaturan akses yang rapi membantu admin menelusuri siapa dapat membuka fitur apa.")}
    </div>
    ${callout("note", "Konsep ekosistem", "Portal ALETA bukan hanya satu halaman login. ALETA adalah fondasi ekosistem aplikasi internal yang dapat terus dikembangkan sesuai kebutuhan satuan kerja.")}
  `),
  chapter(4, "Konsep Akun, Role, Permission, dan Hak Akses", "Hak akses adalah bagian penting agar setiap user hanya melihat dan memakai fitur sesuai tugasnya.", `
    <p>Akun pengguna menyimpan identitas dasar seperti nama, username, kontak, role, dan jabatan. Role menunjukkan kelompok peran, sedangkan permission mengatur izin yang lebih spesifik.</p>
    ${table(["Istilah", "Fungsi", "Contoh"], [
      ["Akun", "Identitas pengguna untuk login.", "Nama, username, email, NIP, nomor HP."],
      ["Role", "Kelompok peran utama pengguna.", "Admin, Operator Surat, Hakim, Panitera."],
      ["Permission", "Izin detail untuk membuka fitur atau melakukan aksi.", "Melihat surat, membuat surat, mengedit, disposisi."],
      ["Jabatan/posisi", "Posisi organisasi pengguna.", "Ketua, Panitera, Jurusita, staf."],
      ["Module Visibility", "Pengaturan modul yang tampil untuk role tertentu.", "Manajemen Surat aktif untuk operator."],
    ])}
    <h3>Prinsip akses minimal</h3>
    ${checklist([
      "Berikan akses sesuai kebutuhan kerja, bukan karena kebiasaan.",
      "User biasa tidak perlu melihat halaman admin.",
      "Operator surat hanya diberi aksi yang relevan dengan tugasnya.",
      "Pejabat penerima disposisi cukup melihat data yang menjadi kewenangannya.",
      "Akses tinggi seperti Super Admin harus dibatasi pada sedikit orang.",
    ])}
    ${table(["Role", "Akses Umum", "Catatan"], roleRows)}
  `),
  chapter(5, "Login, Logout, dan Keamanan Session", "Login memastikan hanya pengguna terdaftar yang dapat masuk. Logout memastikan session tidak tertinggal di perangkat.", `
    <div class="grid-2">
      <div class="panel">
        <h3>Langkah login</h3>
        ${steps([
          "Buka alamat Portal ALETA dari browser.",
          "Isi identitas akun, misalnya username, email, NIP, atau nomor HP sesuai konfigurasi.",
          "Isi password dengan benar.",
          "Klik tombol login.",
          "Jika berhasil, sistem mengarahkan pengguna ke Dashboard SSO.",
        ])}
      </div>
      <div class="panel">
        <h3>Langkah logout</h3>
        ${steps([
          "Buka menu profil atau akun di portal.",
          "Pilih logout.",
          "Pastikan browser kembali ke halaman login.",
          "Tutup browser bila memakai perangkat bersama.",
          "Jangan meninggalkan perangkat dalam keadaan masih login.",
        ])}
      </div>
    </div>
    ${callout("warn", "Perangkat bersama", "Jika menggunakan komputer bersama, jangan mengaktifkan penyimpanan akun tanpa kebutuhan. Selalu logout setelah selesai agar session tidak dipakai orang lain.")}
    <h3>Login gagal dan penyebab umum</h3>
    ${table(["Kondisi", "Kemungkinan Penyebab", "Tindakan"], [
      ["Password salah", "Password tidak sesuai.", "Coba ulang dengan hati-hati atau ikuti prosedur reset."],
      ["User tidak ditemukan", "Identitas akun salah atau belum dibuat.", "Hubungi admin."],
      ["User nonaktif", "Akun dinonaktifkan.", "Minta admin memverifikasi status akun."],
      ["Redirect kembali ke login", "Session tidak valid atau kedaluwarsa.", "Login ulang."],
      ["Akses ditolak setelah login", "Role belum punya permission.", "Hubungi admin bila memang membutuhkan akses."],
    ])}
  `),
  chapter(6, "Dashboard SSO dan Navigasi Portal", "Dashboard adalah ruang kerja awal setelah login. Dari sini user memilih aplikasi dan melihat menu sesuai hak akses.", `
    <p>Dashboard SSO menampilkan kartu aplikasi dan navigasi utama. Pengguna cukup membuka aplikasi yang tersedia. Jika aplikasi tidak muncul, kemungkinan role pengguna belum diberi akses atau modul memang tidak aktif untuk role tersebut.</p>
    ${table(["Komponen Dashboard", "Fungsi", "Cara Menggunakan"], dashboardRows)}
    <h3>Alur membuka aplikasi</h3>
    ${flow(["Login", "Lihat dashboard", "Pilih kartu aplikasi", "Masuk modul", "Gunakan fitur", "Kembali ke portal"])}
    <h3>Perbedaan tampilan antar user</h3>
    <p>Tampilan dashboard dapat berbeda antara admin, operator, pejabat, dan user biasa. Perbedaan ini bukan kesalahan tampilan, melainkan mekanisme keamanan agar setiap pengguna hanya melihat aplikasi yang sesuai.</p>
    ${callout("note", "Jika menu berbeda", "Bandingkan kebutuhan tugas, bukan tampilan antar akun. Jika role berbeda, menu juga wajar berbeda.")}
  `),
  chapter(7, "Pengaturan Portal untuk Pengguna", "Pengaturan portal membantu user menjaga identitas akun dan memahami akses yang dimiliki.", `
    <p>Beberapa pengaturan dapat tersedia untuk user, misalnya profil akun, informasi jabatan, dan preferensi tertentu. Pengaturan teknis yang berdampak ke seluruh sistem biasanya hanya tersedia untuk admin.</p>
    <div class="grid-2">
      ${card("Profil akun", "Gunakan untuk memastikan nama, kontak, dan identitas pengguna benar. Jika ada kesalahan data, laporkan ke admin.")}
      ${card("Akses aplikasi", "User dapat melihat modul yang tersedia dari dashboard. Modul yang tidak muncul berarti belum diberikan atau tidak relevan dengan tugas.")}
      ${card("Notifikasi dan informasi", "Jika sistem menyediakan informasi tugas, baca sebelum memulai pekerjaan harian.")}
      ${card("Logout", "Gunakan logout setiap selesai bekerja, terutama di perangkat bersama.")}
    </div>
    ${callout("warn", "Data akun", "Jangan mengubah atau meminta perubahan data akun tanpa dasar tugas yang jelas. Identitas akun digunakan untuk akses, audit, disposisi, dan pencatatan aktivitas.")}
  `),
  chapter(8, "Manajemen Surat: Konsep dan Fungsi Utama", "Manajemen Surat membantu mencatat, memproses, mencari, dan menindaklanjuti surat secara digital.", `
    <p>Modul Manajemen Surat adalah salah satu fokus utama Portal ALETA. Modul ini membantu operator dan pejabat terkait mengelola surat masuk, surat keluar, lampiran, disposisi, status, dan pencarian arsip.</p>
    <h3>Alur kerja utama</h3>
    ${flow(["Surat diterima/dibuat", "Input data", "Upload lampiran", "Validasi", "Simpan", "Disposisi", "Tindak lanjut", "Arsip"])}
    <h3>Fungsi utama</h3>
    <div class="grid-3">
      ${card("Pencatatan", "Mencatat metadata surat agar mudah ditemukan kembali.")}
      ${card("Surat masuk", "Mengelola surat yang diterima dari pihak atau instansi lain.")}
      ${card("Surat keluar", "Mengelola surat yang dikirim keluar bila fitur tersedia.")}
      ${card("Lampiran", "Menyimpan file pendukung dalam bentuk digital.")}
      ${card("Disposisi", "Meneruskan surat kepada penerima untuk ditindaklanjuti.")}
      ${card("Arsip dan pencarian", "Memudahkan pencarian berdasarkan kata kunci, status, kategori, atau tanggal.")}
    </div>
    ${table(["Data Surat", "Fungsi", "Catatan Pengisian"], suratFieldRows)}
  `),
  chapter(9, "Manajemen Surat: Tambah, Detail, Edit, dan Status", "Bagian ini menjelaskan cara kerja operasional ketika user membuat atau memperbarui data surat.", `
    <h3>Tambah surat</h3>
    ${steps([
      "Buka menu Manajemen Surat atau daftar surat.",
      "Pilih tambah surat sesuai jenis surat yang akan dicatat.",
      "Isi seluruh field wajib dengan data yang benar.",
      "Periksa nomor surat, tanggal, asal/tujuan, dan perihal.",
      "Tambahkan lampiran jika tersedia.",
      "Simpan data surat.",
      "Pastikan surat muncul pada daftar setelah berhasil disimpan.",
    ])}
    <h3>Detail surat</h3>
    <p>Halaman detail dipakai untuk melihat informasi lengkap surat, status, lampiran, riwayat, dan disposisi. User harus membiasakan memeriksa detail sebelum melakukan tindak lanjut.</p>
    <h3>Edit surat</h3>
    <p>Edit hanya dilakukan bila ada data yang salah atau perlu dilengkapi. Tidak semua role boleh mengedit. Bila tombol edit tidak tersedia, kemungkinan user tidak memiliki permission atau status surat tidak boleh diubah.</p>
    <h3>Status surat</h3>
    ${table(["Status Umum", "Makna Operasional", "Tindakan yang Disarankan"], [
      ["Konsep/draft", "Data masih dalam penyusunan.", "Lengkapi dan periksa sebelum diajukan."],
      ["Tercatat", "Surat sudah masuk daftar.", "Lanjutkan proses sesuai kebutuhan."],
      ["Didisposisikan", "Surat sudah diteruskan ke penerima.", "Pantau tindak lanjut."],
      ["Diproses", "Sedang ditindaklanjuti.", "Perbarui informasi jika ada perkembangan."],
      ["Selesai/arsip", "Tindak lanjut dianggap selesai.", "Pastikan arsip dan lampiran lengkap."],
    ])}
    ${callout("good", "Best Practice", "Sebelum menyimpan atau mengedit, baca ulang nomor surat, tanggal, asal/tujuan, dan perihal. Kesalahan kecil pada metadata dapat menyulitkan pencarian arsip.")}
  `),
  chapter(10, "Manajemen Surat: Disposisi, Lampiran, Pencarian, dan Arsip", "Fitur lanjutan ini membantu surat tidak hanya tersimpan, tetapi juga ditindaklanjuti secara tertib.", `
    <h3>Disposisi surat</h3>
    <p>Disposisi adalah arahan atau penugasan atas surat kepada penerima tertentu. Penerima dapat berupa pejabat, jabatan, atau user yang sesuai dengan alur kerja.</p>
    ${steps([
      "Buka detail surat yang akan didisposisikan.",
      "Pilih menu atau tombol disposisi.",
      "Pilih penerima yang valid dari daftar.",
      "Tulis instruksi secara jelas dan singkat.",
      "Simpan disposisi.",
      "Pastikan penerima dapat melihat tugas/disposisi sesuai hak akses.",
    ])}
    <h3>Lampiran</h3>
    <p>Lampiran membantu menyimpan dokumen pendukung. File yang diunggah harus valid, tidak terlalu besar, dan tidak mengandung data yang tidak diperlukan. Download lampiran hanya boleh dilakukan oleh user yang berhak.</p>
    ${table(["Aktivitas", "Yang Harus Diperhatikan", "Risiko Jika Diabaikan"], [
      ["Upload", "Gunakan file valid dan ukuran sesuai kebijakan.", "File gagal tersimpan atau membebani server."],
      ["Download", "Pastikan user berhak mengakses surat.", "Potensi kebocoran data."],
      ["Ganti lampiran", "Pastikan versi lama dan baru jelas.", "Dokumen salah dipakai."],
      ["File hilang", "Laporkan ke admin atau teknis.", "Arsip digital tidak lengkap."],
    ])}
    <h3>Pencarian dan filter</h3>
    <p>Gunakan kata kunci, status, kategori, tanggal, dan pagination. Jika data tidak tampil, kosongkan filter terlebih dahulu sebelum menyimpulkan data hilang.</p>
    ${callout("note", "Pencarian efektif", "Gunakan kata kunci yang paling khas, misalnya nomor surat, nama pengirim, atau potongan perihal. Hindari kata terlalu umum seperti surat, undangan, atau permohonan bila datanya banyak.")}
  `),
  chapter(11, "Fitur AI: Cara Pakai, Batasan, Etika, dan Contoh", "AI adalah alat bantu untuk mempercepat pekerjaan, bukan pengganti tanggung jawab pengguna.", `
    <p>Fitur AI pada Portal ALETA dapat membantu pekerjaan seperti merangkum informasi, menyusun draft, membuat daftar poin penting, memberi rekomendasi awal, dan merapikan bahasa. Namun, hasil AI harus selalu diperiksa manusia.</p>
    <h3>Cara menggunakan AI</h3>
    ${steps([
      "Buka fitur AI pada modul yang tersedia.",
      "Tulis instruksi dengan jelas.",
      "Berikan konteks secukupnya, bukan data sensitif yang tidak perlu.",
      "Baca hasil AI dengan teliti.",
      "Edit hasil sesuai kebutuhan dan bahasa resmi kantor.",
      "Gunakan hasil sebagai bahan bantu, bukan keputusan final.",
    ])}
    ${table(["Kebutuhan", "Contoh Instruksi", "Catatan"], aiUseRows)}
    <h3>Batasan AI</h3>
    ${checklist([
      "AI dapat keliru memahami konteks.",
      "AI dapat menghasilkan redaksi yang tampak benar tetapi belum tentu sesuai fakta.",
      "AI tidak menggantikan pejabat berwenang.",
      "AI tidak boleh menjadi satu-satunya dasar keputusan.",
      "AI harus digunakan sesuai kebijakan kerahasiaan data.",
    ])}
    ${callout("warn", "Data sensitif", "Jangan memasukkan password, token, rahasia jabatan, data pribadi berlebihan, atau dokumen yang tidak perlu diproses AI. Jika ragu, ringkas konteks secara manual terlebih dahulu.")}
    <h3>Prompt yang baik</h3>
    ${table(["Kurang baik", "Lebih baik", "Alasan"], [
      ["Ringkas ini.", "Ringkas isi surat ini dalam 5 poin, gunakan bahasa formal, dan pisahkan tindak lanjut.", "Instruksi lebih jelas."],
      ["Buat disposisi.", "Buat konsep instruksi disposisi singkat untuk surat tentang jadwal rapat.", "Memberi konteks."],
      ["Perbaiki.", "Rapikan bahasa tanpa mengubah makna dan tandai bagian yang perlu dicek manual.", "Ada batasan tugas."],
    ])}
  `),
  chapter(12, "Panduan Admin: User, Role, Permission, Jabatan", "Admin memastikan struktur pengguna dan akses tetap aman, tertib, dan sesuai tugas.", `
    <h3>Manajemen user</h3>
    ${steps([
      "Buat user hanya untuk pegawai atau pihak yang berwenang.",
      "Isi identitas dengan benar.",
      "Tentukan role sesuai tugas.",
      "Hubungkan user dengan jabatan/posisi bila tersedia.",
      "Aktifkan user setelah data benar.",
      "Nonaktifkan user yang tidak lagi berwenang.",
    ])}
    <h3>Manajemen role dan permission</h3>
    <p>Role memudahkan pengelompokan akses. Permission mengatur aksi detail. Admin harus menghindari pemberian akses berlebih karena dapat membuat data terbuka kepada pihak yang tidak berkepentingan.</p>
    ${table(["Objek", "Dikelola Oleh", "Dampak Perubahan", "Perlu Diuji?"], [
      ["User", "Admin/Super Admin", "User bisa atau tidak bisa login dan memakai fitur.", "Ya"],
      ["Role", "Admin/Super Admin", "Mengubah kelompok akses pengguna.", "Ya"],
      ["Permission", "Admin/Super Admin", "Mengizinkan atau menolak aksi tertentu.", "Ya"],
      ["Jabatan", "Admin/Super Admin", "Mempengaruhi disposisi dan struktur kerja.", "Ya"],
      ["User nonaktif", "Admin/Super Admin", "User tidak dapat memakai aplikasi.", "Ya"],
    ])}
    ${callout("warn", "Hati-hati akses admin", "Jangan memberikan role admin hanya agar user dapat membuka menu tertentu. Lebih aman memperbaiki permission/module visibility yang dibutuhkan daripada menaikkan akses terlalu tinggi.")}
  `),
  chapter(13, "Panduan Admin: Module Visibility, Pengaturan Surat, dan AI", "Pengaturan admin menentukan pengalaman pengguna dan keamanan operasional aplikasi.", `
    <h3>Module Visibility</h3>
    <p>Module visibility menentukan modul yang tampil untuk role tertentu. Jika modul dimatikan untuk sebuah role, menu dapat hilang dan akses langsung ke route seharusnya ditolak.</p>
    ${flow(["Pilih role", "Atur modul aktif/nonaktif", "Simpan", "Login sebagai role terkait", "Uji menu dan akses"])}
    <h3>Pengaturan Manajemen Surat</h3>
    <p>Admin perlu memastikan operator surat memiliki akses yang tepat, kategori/status yang digunakan jelas, alur disposisi dipahami, dan aturan lampiran tidak membuka risiko keamanan.</p>
    <h3>Pengaturan AI</h3>
    <p>Fitur AI dapat diaktifkan atau dibatasi sesuai kebijakan. Jika ada pengaturan provider, API key, atau konfigurasi teknis, jangan tampilkan kepada user biasa. Pastikan admin memahami bahwa AI berhubungan dengan kebijakan data.</p>
    <h3>Checklist admin berkala</h3>
    ${checklist([
      "Periksa user baru, mutasi, dan user yang perlu dinonaktifkan.",
      "Pastikan role sesuai tugas aktual.",
      "Pastikan module visibility tidak membuka modul yang tidak diperlukan.",
      "Uji akses menggunakan akun non-admin setelah perubahan besar.",
      "Periksa apakah Manajemen Surat dapat dipakai operator.",
      "Periksa apakah fitur AI sesuai kebijakan internal.",
      "Catat masalah berulang untuk ditindaklanjuti teknis.",
    ])}
  `),
  chapter(14, "Aplikasi Pengembangan Selanjutnya", "Portal ALETA dapat terus dikembangkan sebagai ekosistem aplikasi internal.", `
    <p>Panduan ini tidak membahas detail modul lain karena fokusnya adalah Dashboard SSO, Pengaturan Portal, Manajemen Surat, Fitur AI, dan Admin. Namun, Portal ALETA dirancang agar aplikasi tambahan dapat diintegrasikan secara bertahap.</p>
    <div class="grid-2">
      ${card("Aplikasi monitoring", "Untuk memantau data atau indikator kerja internal.")}
      ${card("Aplikasi integrasi data", "Untuk membaca atau menyatukan data dari sistem lain secara aman.")}
      ${card("Aplikasi dokumen", "Untuk membantu penyusunan, pengelolaan, atau arsip dokumen.")}
      ${card("Aplikasi notifikasi", "Untuk pengingat, informasi tugas, atau pemberitahuan sesuai kebijakan.")}
    </div>
    ${callout("note", "Modul teknis", "ALETA x SIPP, ALETA Justicia Legal Form, Query Registry, Variable Registry, dan WhatsApp Gateway dapat didokumentasikan pada buku terpisah jika sudah menjadi materi pelatihan khusus.")}
  `),
  chapter(15, "Troubleshooting Lengkap", "Gunakan tabel ini sebagai langkah awal sebelum melaporkan masalah ke admin atau teknis.", `
    ${table(["Masalah", "Kemungkinan Penyebab", "Solusi", "Ditangani Oleh"], troubleshootingRows)}
    ${callout("good", "Cara melapor yang baik", "Saat melapor, sertakan nama user, waktu kejadian, halaman yang dibuka, aksi terakhir, dan pesan error bila ada. Jangan mengirim password atau data rahasia.")}
  `),
  chapter(16, "FAQ", "Pertanyaan umum untuk pengguna baru dan admin.", `
    ${faqRows.map(([question, answer]) => `<div class="faq"><h3>${escapeHtml(question)}</h3><p>${escapeHtml(answer)}</p></div>`).join("")}
  `),
  chapter(17, "Glosarium", "Daftar istilah penting agar komunikasi user, admin, dan teknis lebih konsisten.", `
    ${table(["Istilah", "Penjelasan"], glossaryRows)}
  `),
  chapter(18, "Lampiran Checklist Operasional", "Checklist ini dapat dipakai untuk pelatihan, UAT, dan penggunaan harian.", `
    <div class="grid-2">
      <div class="panel">
        <h3>Checklist harian user</h3>
        ${checklist([
          "Login memakai akun pribadi.",
          "Pastikan nama akun yang tampil benar.",
          "Buka modul sesuai tugas.",
          "Periksa data sebelum menyimpan.",
          "Gunakan pencarian/filter sebelum membuat data duplikat.",
          "Logout setelah selesai.",
        ])}
      </div>
      <div class="panel">
        <h3>Checklist operator surat</h3>
        ${checklist([
          "Nomor dan tanggal surat sudah benar.",
          "Asal/tujuan surat sudah jelas.",
          "Perihal singkat tetapi informatif.",
          "Lampiran valid dan dapat dibuka.",
          "Status surat sesuai tahap proses.",
          "Disposisi dikirim ke penerima yang benar.",
        ])}
      </div>
      <div class="panel">
        <h3>Checklist admin</h3>
        ${checklist([
          "User aktif sesuai kebutuhan.",
          "Role dan jabatan sudah tepat.",
          "Permission tidak berlebihan.",
          "Module visibility sudah diuji.",
          "AI dikonfigurasi sesuai kebijakan.",
          "Masalah berulang dicatat untuk tindak lanjut.",
        ])}
      </div>
      <div class="panel">
        <h3>Checklist penggunaan AI aman</h3>
        ${checklist([
          "Prompt jelas dan spesifik.",
          "Tidak memasukkan data sensitif yang tidak perlu.",
          "Hasil AI diverifikasi manual.",
          "Redaksi akhir disesuaikan gaya instansi.",
          "Keputusan tetap oleh manusia berwenang.",
        ])}
      </div>
    </div>
    <h3>Ringkasan alur Manajemen Surat</h3>
    ${flow(["Input surat", "Validasi data", "Upload lampiran", "Simpan", "Disposisi", "Tindak lanjut", "Arsip"])}
    <p class="closing">Dokumen ini dibuat otomatis tanpa screenshot, tanpa gambar halaman aplikasi, tanpa placeholder loading, dan tanpa data sensitif.</p>
  `),
].join("\n");

const html = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Buku Panduan Portal ALETA</title>
  <style>
    @page { size: A4; margin: 17mm 15mm 18mm; }
    :root {
      --ink: #102a3a;
      --muted: #5f7483;
      --brand: #0b4762;
      --brand-2: #0d7192;
      --cyan: #62c7e8;
      --gold: #f2c85d;
      --soft: #edf8fc;
      --line: #d6e8ef;
      --paper: #ffffff;
      --warn: #fff4d8;
      --good: #eaf8f0;
      --note: #eaf6fb;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--ink);
      background: #f6fbfd;
      font-family: "Segoe UI", "Trebuchet MS", Arial, sans-serif;
      line-height: 1.55;
      font-size: 13px;
    }
    h1, h2, h3 { margin: 0; line-height: 1.16; page-break-after: avoid; }
    p { margin: 0 0 10px; }
    .cover {
      min-height: 263mm;
      padding: 28mm 22mm;
      color: #fff;
      position: relative;
      overflow: hidden;
      page-break-after: always;
      background:
        radial-gradient(circle at 16% 18%, rgba(242,200,93,0.35), transparent 28%),
        radial-gradient(circle at 88% 22%, rgba(98,199,232,0.32), transparent 30%),
        linear-gradient(140deg, #071927 0%, #0b4762 52%, #0d7192 100%);
    }
    .cover:before {
      content: "";
      position: absolute;
      right: -35mm;
      bottom: -45mm;
      width: 170mm;
      height: 105mm;
      border-radius: 999px 0 0 999px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.16);
      transform: rotate(-8deg);
    }
    .cover-brand { display: flex; align-items: center; gap: 14px; position: relative; z-index: 2; }
    .logo-mark {
      width: 60px; height: 60px; border-radius: 20px;
      display: grid; place-items: center;
      background: linear-gradient(145deg, #ffe08a, #bf8d24);
      color: #102a3a; font-weight: 900; font-size: 27px;
      box-shadow: 0 20px 45px rgba(0,0,0,0.22);
    }
    .cover-brand strong { display: block; font-size: 24px; letter-spacing: 2px; }
    .cover-brand span { display: block; color: rgba(255,255,255,0.74); font-size: 12px; margin-top: 4px; letter-spacing: .5px; }
    .cover h1 {
      color: #fff;
      font-size: 55px;
      letter-spacing: -1.4px;
      max-width: 620px;
      margin-top: 38mm;
      position: relative;
      z-index: 2;
    }
    .cover .subtitle { max-width: 560px; margin-top: 16px; font-size: 19px; color: rgba(255,255,255,0.84); position: relative; z-index: 2; }
    .cover-meta {
      margin-top: 34mm;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      position: relative;
      z-index: 2;
    }
    .meta {
      border: 1px solid rgba(255,255,255,0.17);
      background: rgba(255,255,255,0.10);
      border-radius: 18px;
      padding: 15px;
    }
    .meta span { display: block; color: rgba(255,255,255,0.68); font-size: 10px; text-transform: uppercase; letter-spacing: 1.2px; }
    .meta strong { display: block; margin-top: 6px; color: #fff; font-size: 13px; }
    .toc { page-break-after: always; }
    .toc h2 { font-size: 32px; margin-bottom: 8px; }
    .toc p { color: var(--muted); margin-bottom: 18px; }
    .toc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .toc-item {
      display: flex; gap: 12px; align-items: center;
      border: 1px solid var(--line); border-radius: 16px;
      background: linear-gradient(180deg, #fff, #f3fbfe);
      padding: 12px;
    }
    .toc-item span {
      width: 34px; height: 34px; border-radius: 12px;
      display: grid; place-items: center;
      background: var(--brand); color: #fff; font-size: 12px; font-weight: 900;
      flex: none;
    }
    .toc-item strong { font-size: 12.5px; }
    .chapter { page-break-before: always; }
    .chapter-head {
      display: flex; gap: 16px; align-items: flex-start;
      border-bottom: 2px solid var(--line);
      padding-bottom: 14px; margin-bottom: 18px;
    }
    .chapter-head > span {
      width: 55px; height: 55px; border-radius: 18px;
      display: grid; place-items: center;
      color: #fff; background: linear-gradient(145deg, var(--brand), var(--brand-2));
      font-weight: 900; letter-spacing: 1px;
      box-shadow: 0 12px 25px rgba(11,71,98,0.22);
      flex: none;
    }
    .chapter-head h2 { font-size: 29px; }
    .chapter-head p { color: var(--muted); margin-top: 5px; max-width: 660px; }
    h3 { font-size: 18px; margin: 18px 0 8px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 13px; margin: 14px 0; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 11px; margin: 14px 0; }
    .card, .panel, .faq {
      border: 1px solid var(--line);
      background: linear-gradient(180deg, #fff, #f6fbfe);
      border-radius: 18px;
      padding: 15px;
      page-break-inside: avoid;
    }
    .card h3, .panel h3, .faq h3 { margin-top: 7px; font-size: 16px; }
    .card p, .panel p, .faq p { color: var(--muted); }
    .tag {
      display: inline-block;
      padding: 5px 10px;
      border-radius: 999px;
      background: #dff4fb;
      color: var(--brand);
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .7px;
    }
    .callout {
      margin: 15px 0;
      padding: 15px;
      border-radius: 18px;
      border: 1px solid var(--line);
      page-break-inside: avoid;
    }
    .callout.note { background: var(--note); border-color: #bfe2ef; }
    .callout.warn { background: var(--warn); border-color: #efd28d; }
    .callout.good { background: var(--good); border-color: #bee4cd; }
    .callout strong { display: block; margin-bottom: 5px; }
    .callout p { color: var(--muted); margin: 0; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0 20px;
      font-size: 11.6px;
      page-break-inside: avoid;
    }
    th {
      background: var(--brand);
      color: #fff;
      text-align: left;
      padding: 9px;
      border: 1px solid var(--brand);
    }
    td {
      padding: 9px;
      border: 1px solid var(--line);
      vertical-align: top;
    }
    tr:nth-child(even) td { background: #f7fcfe; }
    .flow {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 16px 0;
      page-break-inside: avoid;
    }
    .flow-step {
      flex: 1 1 110px;
      min-height: 72px;
      border: 1px solid #c5e5f0;
      background: #edf8fc;
      border-radius: 16px;
      padding: 11px;
    }
    .flow-step span {
      display: grid;
      place-items: center;
      width: 27px;
      height: 24px;
      border-radius: 9px;
      background: var(--gold);
      color: #3b2a09;
      font-size: 10px;
      font-weight: 900;
      margin-bottom: 8px;
    }
    .flow-step strong { display: block; font-size: 11.5px; }
    .steps { padding-left: 22px; }
    .steps li, li { margin-bottom: 7px; }
    .checklist {
      list-style: none;
      padding-left: 0;
      margin: 10px 0;
    }
    .checklist li {
      position: relative;
      margin: 7px 0;
      padding: 9px 10px 9px 35px;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: #fff;
      page-break-inside: avoid;
    }
    .checklist li:before {
      content: "OK";
      position: absolute;
      left: 9px;
      top: 10px;
      font-size: 9px;
      font-weight: 900;
      color: #1f7a54;
    }
    .closing {
      margin-top: 18px;
      padding-top: 12px;
      border-top: 1px solid var(--line);
      color: var(--muted);
      font-size: 11px;
    }
  </style>
</head>
<body>
  <main class="cover">
    <div class="cover-brand">
      <div class="logo-mark">A</div>
      <div>
        <strong>PORTAL ALETA</strong>
        <span>Akses Layanan Elektronik Terpadu Aksesibel</span>
      </div>
    </div>
    <h1>Buku Panduan Portal ALETA</h1>
    <p class="subtitle">Panduan lengkap untuk Dashboard SSO, Pengaturan Portal, Manajemen Surat, Fitur AI, dan Admin.</p>
    <div class="cover-meta">
      <div class="meta"><span>Versi</span><strong>${escapeHtml(version)}</strong></div>
      <div class="meta"><span>Tanggal</span><strong>${escapeHtml(generatedDate)}</strong></div>
      <div class="meta"><span>Instansi</span><strong>${escapeHtml(institution)}</strong></div>
    </div>
  </main>
  <section class="toc">
    <h2>Daftar Isi</h2>
    <p>Dokumen ini dibuat tanpa screenshot. Visual panduan menggunakan layout, tabel, card, callout, checklist, dan diagram alur teks.</p>
    <div class="toc-grid">
      ${chapters.map((title, index) => `<div class="toc-item"><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(title)}</strong></div>`).join("")}
    </div>
  </section>
  ${htmlContent}
</body>
</html>`;

const markdown = `# Buku Panduan Portal ALETA

**Panduan lengkap untuk Dashboard SSO, Pengaturan Portal, Manajemen Surat, Fitur AI, dan Admin**  
Versi: ${version}  
Tanggal: ${generatedDate}  
Instansi: ${institution}

Panduan ini dibuat tanpa screenshot. Visual panduan memakai tabel, card informasi, callout, checklist, dan diagram alur teks.

## Daftar Isi

${chapters.map((title, index) => `${index + 1}. ${title}`).join("\n")}

## Ringkasan Fokus

- Dashboard SSO dan Portal Utama.
- Pengaturan Portal ALETA.
- Manajemen Surat.
- Fitur AI.
- Admin dan Pengaturan Admin.

## Ringkasan Alur Portal

\`\`\`text
User membuka ALETA -> Login -> Dashboard SSO -> Pilih aplikasi -> Gunakan fitur -> Logout
\`\`\`

## Hak Akses Umum

${mdTable(["Role", "Akses Umum", "Catatan"], roleRows)}

## Data Penting Manajemen Surat

${mdTable(["Data Surat", "Fungsi", "Catatan Pengisian"], suratFieldRows)}

## Contoh Penggunaan AI

${mdTable(["Kebutuhan", "Contoh Instruksi", "Catatan"], aiUseRows)}

## Troubleshooting

${mdTable(["Masalah", "Kemungkinan Penyebab", "Solusi", "Ditangani Oleh"], troubleshootingRows)}

## FAQ

${faqRows.map(([question, answer]) => `### ${question}\n\n${answer}`).join("\n\n")}

## Glosarium

${mdTable(["Istilah", "Penjelasan"], glossaryRows)}

> File HTML/PDF berisi versi lengkap dengan uraian bab, checklist, callout, dan diagram alur teks.
`;

async function renderPdf() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1240, height: 1754 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });
  await page.pdf({
    path: output.pdf,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
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
    files: output,
    pdfPageCount: pdf.getPageCount(),
    method: "Node.js membuat Markdown dan HTML konseptual tanpa screenshot. Playwright hanya merender HTML menjadi PDF.",
    focus: [
      "ALETA Dashboard SSO / Portal Utama",
      "Pengaturan Portal ALETA",
      "Manajemen Surat",
      "Fitur AI",
      "Admin / Pengaturan Admin",
    ],
    intentionallyBrief: [
      "ALETA x SIPP",
      "ALETA Justicia Legal Form / JLF",
      "Query Registry",
      "Variable Registry",
      "WhatsApp Gateway detail",
      "Modul lain di luar fokus panduan",
    ],
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
