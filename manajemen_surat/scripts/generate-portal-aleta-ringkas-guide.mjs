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
  markdown: path.join(docsDir, "panduan-portal-aleta-ringkas.md"),
  html: path.join(docsDir, "panduan-portal-aleta-ringkas.html"),
  pdf: path.join(docsDir, "panduan-portal-aleta-ringkas.pdf"),
  report: path.join(docsDir, "panduan-portal-aleta-ringkas-report.json"),
};

const now = new Date();
const generatedDate = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "long",
  timeZone: "Asia/Makassar",
}).format(now);

const version = process.env.PORTAL_ALETA_DOC_VERSION ?? "v1.0 - Juli 2026";
const institution = process.env.PORTAL_ALETA_DOC_INSTITUTION ?? "Pengadilan Agama Donggala";

const chapters = [
  {
    id: "kata-pengantar",
    title: "Kata Pengantar",
    lead: "Panduan ini membantu pengguna dan admin memahami Portal ALETA secara praktis, tanpa bergantung pada tampilan screenshot halaman.",
  },
  {
    id: "gambaran-umum",
    title: "Gambaran Umum Portal ALETA",
    lead: "Portal ALETA adalah pintu masuk terpadu untuk aplikasi internal. Pengguna cukup login satu kali, lalu membuka aplikasi yang tersedia sesuai role dan hak akses.",
  },
  {
    id: "dashboard-sso",
    title: "Konsep Dashboard SSO ALETA",
    lead: "Dashboard SSO menjadi halaman awal setelah login. Di sinilah pengguna melihat aplikasi yang bisa dibuka, informasi penting, dan navigasi utama.",
  },
  {
    id: "pengaturan-portal",
    title: "Pengaturan Portal ALETA",
    lead: "Pengaturan portal menentukan siapa yang dapat melihat menu, membuka modul, dan menggunakan fitur tertentu.",
  },
  {
    id: "login-logout",
    title: "Panduan Login dan Logout",
    lead: "Login dan logout adalah gerbang keamanan dasar. Gunakan akun pribadi, jangan berbagi password, dan logout setelah selesai bekerja.",
  },
  {
    id: "manajemen-surat",
    title: "Panduan Manajemen Surat",
    lead: "Manajemen Surat membantu pencatatan, pemantauan, disposisi, lampiran, dan pencarian arsip surat secara digital.",
  },
  {
    id: "fitur-ai",
    title: "Panduan Fitur AI",
    lead: "AI di Portal ALETA berperan sebagai alat bantu kerja, bukan pengganti keputusan manusia.",
  },
  {
    id: "admin",
    title: "Panduan Admin",
    lead: "Admin bertugas menjaga struktur akun, role, permission, jabatan, modul, serta pengaturan aplikasi tetap rapi dan aman.",
  },
  {
    id: "pengembangan",
    title: "Aplikasi Pengembangan Selanjutnya",
    lead: "Portal ALETA dirancang sebagai ekosistem aplikasi internal yang dapat terus ditambah modul baru sesuai kebutuhan satuan kerja.",
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    lead: "Gunakan tabel ini untuk menemukan penyebab umum masalah dan langkah awal penyelesaiannya.",
  },
  {
    id: "faq",
    title: "FAQ",
    lead: "Pertanyaan umum yang sering muncul saat pertama kali menggunakan Portal ALETA.",
  },
  {
    id: "glosarium",
    title: "Glosarium",
    lead: "Daftar istilah penting agar pengguna baru lebih mudah memahami Portal ALETA.",
  },
  {
    id: "lampiran",
    title: "Lampiran",
    lead: "Checklist ringkas untuk penggunaan harian, administrasi, kesiapan awal, hak akses, dan penggunaan AI secara aman.",
  },
];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function mdTable(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell).replaceAll("\n", "<br>")).join(" | ")} |`),
  ].join("\n");
}

function htmlTable(headers, rows) {
  return `<table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

function callout(type, title, body) {
  return `<div class="callout ${type}"><strong>${escapeHtml(title)}</strong><p>${body}</p></div>`;
}

function checklist(items) {
  return `<ul class="checklist">${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

function flow(items) {
  return `<div class="flow">${items.map((item, index) => `<div class="flow-item"><span>${index + 1}</span><strong>${item}</strong></div>`).join("")}</div>`;
}

function sectionTitle(number, title, lead) {
  return `
    <section class="chapter" id="${number}">
      <div class="chapter-heading">
        <span class="chapter-number">${String(number).padStart(2, "0")}</span>
        <div>
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(lead)}</p>
        </div>
      </div>
  `;
}

const dashboardComponents = [
  ["Kartu aplikasi", "Menampilkan aplikasi yang dapat dibuka pengguna.", "Semua pengguna sesuai role."],
  ["Sidebar/menu", "Navigasi cepat ke dashboard, aplikasi, tugas, dan pengaturan yang diizinkan.", "Semua pengguna."],
  ["Profil akun", "Menampilkan identitas akun aktif dan akses logout.", "Semua pengguna."],
  ["Access control", "Menyaring menu berdasarkan role, permission, dan module visibility.", "Sistem dan admin."],
  ["Informasi sistem", "Memberi status, notifikasi, atau pengumuman jika tersedia.", "User dan admin."],
];

const loginTroubleshooting = [
  ["Tidak bisa login", "Username atau password salah.", "Periksa kembali identitas dan password, lalu coba lagi."],
  ["Akun tidak aktif", "Akun dinonaktifkan oleh admin.", "Hubungi admin untuk aktivasi."],
  ["Menu tidak muncul", "Role atau module visibility belum diberikan.", "Hubungi admin agar akses diperiksa."],
  ["Sesi berakhir", "Session sudah kedaluwarsa atau browser dibersihkan.", "Login ulang melalui halaman login ALETA."],
];

const suratAccess = [
  ["Super Admin", "Semua akses, pengaturan, audit, dan pemulihan data.", "Gunakan hanya untuk pengaturan tingkat sistem."],
  ["Admin", "Mengelola user, modul, dan konfigurasi operasional.", "Akses dapat dibatasi sesuai kebijakan satker."],
  ["Operator Surat", "Input, edit, arsip, upload lampiran, dan pemantauan surat.", "Role utama untuk administrasi surat."],
  ["Hakim", "Melihat surat atau disposisi yang menjadi kewenangannya.", "Akses mengikuti tugas/disposisi."],
  ["Panitera", "Melihat, memberi arahan, atau memantau disposisi sesuai kewenangan.", "Akses menyesuaikan struktur jabatan."],
  ["Jurusita", "Melihat tugas atau disposisi terkait pelaksanaan tugas.", "Tidak semua data surat harus terbuka."],
  ["User biasa", "Akses terbatas sesuai permission.", "Tidak dapat membuka fitur admin."],
];

const adminChecklist = [
  "User sudah dibuat dan statusnya aktif.",
  "Role pengguna sudah sesuai tugas.",
  "Jabatan/posisi pengguna sudah benar.",
  "Module visibility sudah diatur untuk setiap role.",
  "Akses Manajemen Surat sudah diuji dari akun non-admin.",
  "Fitur AI sudah dikonfigurasi sesuai kebijakan.",
  "Tidak ada user yang memiliki akses lebih besar dari kebutuhan tugas.",
  "Admin memeriksa error dan laporan penggunaan secara berkala.",
];

const troubleshootingRows = [
  ["Tidak bisa login", "Username/password salah, akun nonaktif, atau session bermasalah.", "Coba ulang, pastikan identitas benar, hubungi admin bila akun nonaktif.", "User dan Admin"],
  ["Password salah", "Password tidak sesuai data akun.", "Gunakan password yang benar atau minta reset sesuai prosedur.", "User dan Admin"],
  ["User tidak aktif", "Akun dinonaktifkan.", "Admin mengaktifkan kembali bila pengguna masih berwenang.", "Admin"],
  ["Menu tidak muncul", "Role, permission, atau module visibility belum sesuai.", "Admin memeriksa pengaturan akses.", "Admin"],
  ["Tidak punya akses", "URL dibuka langsung tanpa permission.", "Gunakan menu yang tersedia atau minta evaluasi akses.", "User dan Admin"],
  ["Data surat tidak tampil", "Filter terlalu sempit, akses terbatas, atau data belum tersedia.", "Reset filter, cek hak akses, dan cek data sumber.", "User dan Operator"],
  ["Gagal tambah surat", "Field wajib belum lengkap atau format salah.", "Lengkapi data wajib dan perbaiki format input.", "Operator"],
  ["Gagal upload lampiran", "File terlalu besar, format tidak didukung, atau koneksi bermasalah.", "Gunakan file valid dan ulangi upload.", "Operator"],
  ["Gagal download lampiran", "Akses tidak sesuai, file hilang, atau server bermasalah.", "Cek hak akses dan hubungi admin bila file tidak tersedia.", "User dan Admin"],
  ["Fitur AI tidak merespons", "AI belum aktif, konfigurasi belum lengkap, atau layanan sedang bermasalah.", "Admin memeriksa pengaturan AI dan status layanan.", "Admin"],
  ["Hasil AI kurang sesuai", "Instruksi terlalu umum atau data konteks kurang lengkap.", "Perbaiki prompt, beri konteks jelas, dan validasi manual.", "User"],
  ["Halaman loading terus", "Koneksi lambat, session bermasalah, atau API belum merespons.", "Refresh halaman, login ulang, lalu laporkan ke admin bila berulang.", "User dan Admin"],
  ["Error server/API", "Layanan backend, database, atau konfigurasi bermasalah.", "Catat waktu kejadian dan laporkan ke tim teknis.", "Admin dan Teknis"],
];

const faqRows = [
  ["Apa itu Portal ALETA?", "Portal ALETA adalah pusat akses aplikasi internal yang menyatukan login, dashboard, dan modul kerja dalam satu portal."],
  ["Apakah ALETA satu aplikasi atau kumpulan aplikasi?", "ALETA adalah portal terpadu yang dapat berisi banyak aplikasi internal sesuai kebutuhan satker."],
  ["Apa itu SSO?", "SSO atau Single Sign On berarti pengguna cukup login satu kali untuk membuka aplikasi yang diizinkan."],
  ["Kenapa menu saya berbeda dengan user lain?", "Menu mengikuti role, permission, jabatan, dan module visibility yang diatur admin."],
  ["Siapa yang bisa mengatur user?", "Super Admin dan Admin yang memiliki izin pengelolaan user."],
  ["Siapa yang bisa mengakses Manajemen Surat?", "Pengguna yang diberi akses oleh admin, misalnya operator surat, pejabat terkait, atau role lain sesuai kebijakan."],
  ["Apakah AI menggantikan pekerjaan pengguna?", "Tidak. AI hanya alat bantu, keputusan dan tanggung jawab tetap pada pengguna/pejabat berwenang."],
  ["Apakah hasil AI harus diperiksa?", "Ya. Semua hasil AI wajib diverifikasi sebelum digunakan."],
  ["Apa yang harus dilakukan jika tidak bisa login?", "Periksa identitas dan password, lalu hubungi admin jika akun terkunci atau tidak aktif."],
  ["Apa yang harus dilakukan jika modul tidak muncul?", "Hubungi admin untuk memeriksa role, permission, dan module visibility."],
  ["Apakah akan ada aplikasi tambahan di ALETA?", "Ya. Portal ALETA dirancang agar modul baru dapat ditambahkan ke dashboard secara bertahap."],
];

const glossaryRows = [
  ["Portal", "Pusat akses aplikasi internal."],
  ["SSO", "Single Sign On, mekanisme login satu kali untuk banyak aplikasi."],
  ["Dashboard", "Halaman utama setelah login."],
  ["Role", "Peran pengguna, misalnya admin, operator, hakim, panitera, atau user biasa."],
  ["Permission", "Izin spesifik untuk melihat atau melakukan aksi tertentu."],
  ["Module Visibility", "Pengaturan modul mana yang tampil dan dapat dibuka oleh role tertentu."],
  ["Admin", "Pengguna yang mengelola akun, akses, dan pengaturan aplikasi."],
  ["User", "Pengguna aplikasi Portal ALETA."],
  ["Manajemen Surat", "Modul pengelolaan surat digital."],
  ["Disposisi", "Proses pemberian arahan/tugas atas surat kepada penerima tertentu."],
  ["Lampiran", "File pendukung surat, seperti dokumen PDF atau berkas lain yang valid."],
  ["AI", "Alat bantu berbasis kecerdasan buatan untuk meringkas, menyusun, atau memberi rekomendasi awal."],
  ["Prompt", "Instruksi atau pertanyaan yang diberikan pengguna kepada AI."],
  ["Session", "Status login pengguna selama menggunakan aplikasi."],
  ["Upload", "Mengunggah file dari perangkat ke aplikasi."],
  ["Download", "Mengunduh file dari aplikasi ke perangkat."],
  ["Access Denied", "Kondisi ketika pengguna tidak memiliki izin untuk membuka halaman atau fitur."],
];

const markdown = `# Buku Panduan Portal ALETA

**Panduan Dashboard SSO, Manajemen Surat, Fitur AI, dan Admin**  
Versi dokumen: ${version}  
Tanggal pembuatan: ${generatedDate}  
Instansi: ${institution}

> Panduan ini dibuat tanpa screenshot agar lebih bersih, ringan, dan mudah diperbarui.

## Daftar Isi

${chapters.map((chapter, index) => `${index + 1}. ${chapter.title}`).join("\n")}

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

\`\`\`text
User -> Login ALETA -> Dashboard SSO -> Pilih Aplikasi -> Gunakan Fitur Sesuai Hak Akses
\`\`\`

## 3. Konsep Dashboard SSO ALETA

Dashboard SSO adalah halaman utama setelah login. Pengguna dapat melihat kartu aplikasi, membuka modul, melihat menu, dan kembali ke portal utama kapan saja.

${mdTable(["Komponen Dashboard", "Fungsi", "Siapa yang Menggunakan"], dashboardComponents)}

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

${mdTable(["Masalah", "Penyebab", "Solusi"], loginTroubleshooting)}

## 6. Panduan Manajemen Surat

Manajemen Surat adalah aplikasi untuk mencatat surat, mengelola surat masuk dan keluar, mengunggah lampiran, mencari arsip, melihat detail, mengedit data, dan melakukan disposisi.

Alur kerja:

\`\`\`text
Surat Diterima -> Input Data Surat -> Upload Lampiran -> Simpan -> Disposisi -> Tindak Lanjut -> Arsip/Pencarian
\`\`\`

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

${mdTable(["Role", "Akses yang Umum Diberikan", "Catatan"], suratAccess)}

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

${adminChecklist.map((item) => `- ${item}`).join("\n")}

## 9. Aplikasi Pengembangan Selanjutnya

Portal ALETA dapat dikembangkan dengan aplikasi tambahan seperti aplikasi monitoring, integrasi data, dokumen, notifikasi, dan layanan internal lain.

Modul seperti ALETA x SIPP, ALETA Justicia Legal Form, Query Registry, Variable Registry, dan WhatsApp Gateway dapat menjadi bagian dari ekosistem pengembangan selanjutnya. Detail teknis modul tersebut tidak dibahas dalam panduan ringkas ini.

## 10. Troubleshooting

${mdTable(["Masalah", "Kemungkinan Penyebab", "Solusi", "Ditangani Oleh"], troubleshootingRows)}

## 11. FAQ

${faqRows.map(([question, answer]) => `**${question}**\n\n${answer}`).join("\n\n")}

## 12. Glosarium

${mdTable(["Istilah", "Penjelasan"], glossaryRows)}

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
`;

function buildHtml() {
  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Buku Panduan Portal ALETA</title>
  <style>
    @page {
      size: A4;
      margin: 18mm 16mm 18mm 16mm;
    }
    :root {
      --ink: #0e2635;
      --muted: #5d7080;
      --line: #d8e6ef;
      --brand: #0c4762;
      --brand-2: #0f6a8f;
      --accent: #f4c95d;
      --soft: #eef7fb;
      --card: #ffffff;
      --danger: #9f2e2e;
      --ok: #1f7a54;
      --warn: #96670f;
    }
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      color: var(--ink);
      background: #f7fbfd;
      font-family: "Segoe UI", "Trebuchet MS", Arial, sans-serif;
      line-height: 1.55;
    }
    h1, h2, h3 {
      margin: 0;
      line-height: 1.15;
      color: var(--ink);
      page-break-after: avoid;
    }
    p {
      margin: 0 0 10px;
    }
    .cover {
      min-height: 262mm;
      padding: 28mm 22mm;
      color: #fff;
      background:
        radial-gradient(circle at 15% 20%, rgba(244, 201, 93, 0.28), transparent 28%),
        radial-gradient(circle at 85% 25%, rgba(99, 191, 228, 0.28), transparent 30%),
        linear-gradient(145deg, #081828 0%, #0c4762 54%, #0e6f91 100%);
      position: relative;
      overflow: hidden;
      page-break-after: always;
    }
    .cover::after {
      content: "";
      position: absolute;
      inset: auto -20mm -35mm 40mm;
      height: 95mm;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 999px 0 0 999px;
      transform: rotate(-8deg);
    }
    .brand-row {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 38mm;
      position: relative;
      z-index: 1;
    }
    .seal {
      width: 58px;
      height: 58px;
      border-radius: 18px;
      display: grid;
      place-items: center;
      background: linear-gradient(145deg, #f8d777, #bb8a1e);
      color: #092235;
      font-weight: 900;
      letter-spacing: 1px;
      box-shadow: 0 18px 45px rgba(0,0,0,0.24);
    }
    .brand-title strong {
      display: block;
      font-size: 22px;
      letter-spacing: 2px;
    }
    .brand-title span {
      display: block;
      color: rgba(255,255,255,0.75);
      font-size: 12px;
      letter-spacing: 0.5px;
      margin-top: 4px;
    }
    .cover h1 {
      color: #fff;
      font-size: 54px;
      max-width: 560px;
      letter-spacing: -1.5px;
      position: relative;
      z-index: 1;
    }
    .cover .subtitle {
      margin-top: 16px;
      max-width: 520px;
      color: rgba(255,255,255,0.84);
      font-size: 19px;
      position: relative;
      z-index: 1;
    }
    .cover-meta {
      margin-top: 34mm;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      position: relative;
      z-index: 1;
    }
    .meta-card {
      padding: 15px;
      border: 1px solid rgba(255,255,255,0.18);
      background: rgba(255,255,255,0.1);
      border-radius: 18px;
      backdrop-filter: blur(10px);
    }
    .meta-card span {
      display: block;
      color: rgba(255,255,255,0.65);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1.3px;
      margin-bottom: 5px;
    }
    .meta-card strong {
      display: block;
      color: #fff;
      font-size: 13px;
    }
    .page {
      background: #fff;
      padding: 0;
    }
    .toc {
      page-break-after: always;
    }
    .toc h2 {
      font-size: 30px;
      margin-bottom: 18px;
    }
    .toc-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .toc-item {
      padding: 13px 14px;
      border-radius: 16px;
      border: 1px solid var(--line);
      background: linear-gradient(180deg, #ffffff, #f4fbff);
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .toc-item span {
      width: 34px;
      height: 34px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      background: var(--brand);
      color: #fff;
      font-weight: 800;
      font-size: 12px;
      flex: none;
    }
    .toc-item strong {
      font-size: 13px;
    }
    .chapter {
      page-break-before: always;
    }
    .chapter:first-of-type {
      page-break-before: auto;
    }
    .chapter-heading {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      padding-bottom: 16px;
      border-bottom: 2px solid var(--line);
      margin-bottom: 18px;
    }
    .chapter-number {
      width: 54px;
      height: 54px;
      border-radius: 17px;
      display: grid;
      place-items: center;
      background: linear-gradient(145deg, var(--brand), var(--brand-2));
      color: #fff;
      font-weight: 900;
      letter-spacing: 1px;
      flex: none;
      box-shadow: 0 12px 25px rgba(12,71,98,0.22);
    }
    .chapter-heading h2 {
      font-size: 30px;
      margin-bottom: 5px;
    }
    .chapter-heading p {
      color: var(--muted);
      max-width: 660px;
      margin: 0;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin: 16px 0;
    }
    .grid-3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin: 16px 0;
    }
    .card {
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 16px;
      background: linear-gradient(180deg, #ffffff, #f6fbfe);
      page-break-inside: avoid;
    }
    .card h3 {
      font-size: 17px;
      margin-bottom: 8px;
    }
    .mini {
      font-size: 12px;
      color: var(--muted);
    }
    .badge {
      display: inline-block;
      padding: 5px 10px;
      border-radius: 999px;
      background: #e2f4fb;
      color: var(--brand);
      font-weight: 700;
      font-size: 11px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .callout {
      border-radius: 18px;
      padding: 15px 16px;
      margin: 16px 0;
      border: 1px solid var(--line);
      page-break-inside: avoid;
    }
    .callout strong {
      display: block;
      margin-bottom: 5px;
    }
    .callout p {
      margin: 0;
      color: var(--muted);
    }
    .callout.note {
      background: #eef8fc;
      border-color: #bfe3f1;
    }
    .callout.warn {
      background: #fff7e6;
      border-color: #f1d38b;
    }
    .callout.good {
      background: #effaf4;
      border-color: #bfe6cf;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0 22px;
      font-size: 12px;
      page-break-inside: avoid;
    }
    th {
      text-align: left;
      background: var(--brand);
      color: #fff;
      padding: 10px;
      border: 1px solid var(--brand);
    }
    td {
      padding: 10px;
      border: 1px solid var(--line);
      vertical-align: top;
    }
    tr:nth-child(even) td {
      background: #f7fbfd;
    }
    .flow {
      display: flex;
      flex-wrap: wrap;
      gap: 9px;
      margin: 18px 0;
      page-break-inside: avoid;
    }
    .flow-item {
      flex: 1 1 130px;
      min-height: 72px;
      padding: 12px;
      border-radius: 16px;
      background: #eef7fb;
      border: 1px solid #c8e5f0;
      position: relative;
    }
    .flow-item span {
      width: 24px;
      height: 24px;
      border-radius: 8px;
      display: grid;
      place-items: center;
      background: var(--accent);
      color: #382909;
      font-size: 11px;
      font-weight: 900;
      margin-bottom: 8px;
    }
    .flow-item strong {
      font-size: 12px;
      display: block;
    }
    ol, ul {
      padding-left: 20px;
    }
    li {
      margin-bottom: 7px;
    }
    .checklist {
      list-style: none;
      padding-left: 0;
    }
    .checklist li {
      padding: 9px 10px 9px 34px;
      margin: 7px 0;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: #fff;
      position: relative;
    }
    .checklist li::before {
      content: "OK";
      position: absolute;
      left: 9px;
      top: 10px;
      font-size: 9px;
      font-weight: 900;
      color: var(--ok);
    }
    .quote {
      margin: 18px 0;
      padding: 18px;
      border-left: 5px solid var(--accent);
      background: #fffbef;
      border-radius: 0 18px 18px 0;
      page-break-inside: avoid;
    }
    .muted {
      color: var(--muted);
    }
    .small-title {
      font-size: 20px;
      margin: 18px 0 8px;
    }
    .footer-note {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid var(--line);
      color: var(--muted);
      font-size: 11px;
    }
    .no-break {
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
  <main class="cover">
    <div class="brand-row">
      <div class="seal">A</div>
      <div class="brand-title">
        <strong>PORTAL ALETA</strong>
        <span>Akses Layanan Elektronik Terpadu Aksesibel</span>
      </div>
    </div>
    <h1>Buku Panduan Portal ALETA</h1>
    <p class="subtitle">Panduan Dashboard SSO, Manajemen Surat, Fitur AI, dan Admin.</p>
    <div class="cover-meta">
      <div class="meta-card"><span>Versi Dokumen</span><strong>${escapeHtml(version)}</strong></div>
      <div class="meta-card"><span>Tanggal</span><strong>${escapeHtml(generatedDate)}</strong></div>
      <div class="meta-card"><span>Instansi</span><strong>${escapeHtml(institution)}</strong></div>
    </div>
  </main>

  <section class="toc">
    <h2>Daftar Isi</h2>
    <p class="muted">Panduan ini disusun sebagai buku operasional ringkas untuk pengguna dan admin. Tidak ada screenshot, placeholder, atau gambar halaman aplikasi yang digunakan.</p>
    <div class="toc-grid">
      ${chapters.map((chapter, index) => `<div class="toc-item"><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(chapter.title)}</strong></div>`).join("")}
    </div>
  </section>

  ${sectionTitle(1, "Kata Pengantar", chapters[0].lead)}
    <p>Portal ALETA adalah pusat akses aplikasi internal yang dirancang untuk membantu pekerjaan menjadi lebih terpusat, tertib, dan mudah diawasi. Panduan ini dibuat untuk dua kelompok utama: pengguna harian dan admin pengelola sistem.</p>
    <p>Buku panduan ini dibuat tanpa screenshot agar tampil lebih bersih, ringan, dan mudah diperbarui. Jika tampilan aplikasi berubah, panduan tetap relevan karena berfokus pada konsep, alur kerja, hak akses, dan langkah operasional.</p>
    ${callout("note", "Tujuan panduan", "Membantu pegawai baru memahami cara login, membuka dashboard, mengelola surat, memakai AI dengan aman, dan memahami tugas admin tanpa harus membaca dokumentasi teknis.")}
  </section>

  ${sectionTitle(2, "Gambaran Umum Portal ALETA", chapters[1].lead)}
    <div class="grid-3">
      <div class="card"><span class="badge">Terpusat</span><h3>Satu pintu akses</h3><p>Pengguna masuk melalui Portal ALETA, lalu memilih aplikasi yang tersedia sesuai hak akses.</p></div>
      <div class="card"><span class="badge">Aman</span><h3>Role-based access</h3><p>Menu dan fitur tidak sama untuk semua pengguna. Sistem menyesuaikan role, permission, dan module visibility.</p></div>
      <div class="card"><span class="badge">Berkembang</span><h3>Siap tambah modul</h3><p>Portal dapat dikembangkan untuk aplikasi internal baru tanpa mengubah konsep SSO utama.</p></div>
    </div>
    <h3 class="small-title">Alur umum pengguna</h3>
    ${flow(["User", "Login ALETA", "Dashboard SSO", "Pilih Aplikasi", "Gunakan Fitur Sesuai Hak Akses"])}
    <h3 class="small-title">Manfaat utama</h3>
    ${checklist([
      "Akses aplikasi lebih terpusat.",
      "Administrasi pengguna dan role lebih tertib.",
      "Pekerjaan operasional lebih cepat.",
      "Keamanan akses lebih baik.",
      "Portal siap dikembangkan untuk modul baru.",
    ])}
  </section>

  ${sectionTitle(3, "Konsep Dashboard SSO ALETA", chapters[2].lead)}
    <p>Dashboard SSO adalah halaman utama setelah login. Pengguna dapat membuka kartu aplikasi, memakai menu/sidebar, melihat informasi akun, dan kembali ke portal utama kapan saja.</p>
    ${htmlTable(["Komponen Dashboard", "Fungsi", "Siapa yang Menggunakan"], dashboardComponents)}
    ${callout("note", "Catatan Penting", "Menu yang tampil pada setiap pengguna dapat berbeda karena sistem membaca role, permission, dan module visibility. Jika menu tidak muncul, belum tentu aplikasi rusak. Bisa jadi akses belum diberikan.")}
    <h3 class="small-title">Cara membuka aplikasi dari dashboard</h3>
    <ol>
      <li>Login ke Portal ALETA.</li>
      <li>Periksa kartu aplikasi yang tersedia.</li>
      <li>Pilih aplikasi yang ingin digunakan.</li>
      <li>Gunakan fitur sesuai hak akses.</li>
      <li>Gunakan tombol kembali ke portal bila ingin membuka modul lain.</li>
    </ol>
  </section>

  ${sectionTitle(4, "Pengaturan Portal ALETA", chapters[3].lead)}
    <div class="grid-2">
      <div class="card"><h3>Profil pengguna</h3><p>Berisi identitas akun, informasi jabatan/role, dan akses dasar yang melekat pada pengguna.</p></div>
      <div class="card"><h3>Akses aplikasi</h3><p>Menentukan aplikasi apa saja yang tampil pada dashboard dan menu pengguna.</p></div>
      <div class="card"><h3>Role dan permission</h3><p>Role mengelompokkan pengguna, permission mengatur izin tindakan yang lebih spesifik.</p></div>
      <div class="card"><h3>Module visibility</h3><p>Mengatur modul yang aktif atau nonaktif untuk role tertentu.</p></div>
    </div>
    ${callout("warn", "Perhatian Admin", "Perubahan role, permission, dan module visibility dapat langsung memengaruhi menu dan akses pengguna. Setelah mengubah akses, lakukan pengujian memakai akun yang sesuai.")}
    <h3 class="small-title">Prinsip pengaturan yang baik</h3>
    ${checklist([
      "Setiap pengguna memakai akun pribadi.",
      "Role diberikan sesuai tugas.",
      "Permission diberikan secukupnya.",
      "Modul yang tidak diperlukan sebaiknya tidak ditampilkan.",
      "Perubahan akses diuji setelah disimpan.",
    ])}
  </section>

  ${sectionTitle(5, "Panduan Login dan Logout", chapters[4].lead)}
    <div class="grid-2">
      <div class="card no-break">
        <h3>Langkah login</h3>
        <ol>
          <li>Buka halaman login Portal ALETA.</li>
          <li>Isi username, email, NIP, atau nomor HP sesuai akun.</li>
          <li>Isi password.</li>
          <li>Klik tombol login.</li>
          <li>Jika berhasil, pengguna masuk ke Dashboard SSO.</li>
        </ol>
      </div>
      <div class="card no-break">
        <h3>Langkah logout</h3>
        <ol>
          <li>Buka menu profil akun.</li>
          <li>Pilih logout.</li>
          <li>Pastikan kembali ke halaman login.</li>
          <li>Tutup browser bila memakai perangkat bersama.</li>
        </ol>
      </div>
    </div>
    ${callout("good", "Best Practice", "Jangan membagikan akun dan password kepada orang lain. Jika memakai komputer bersama, selalu logout setelah selesai bekerja.")}
    ${htmlTable(["Masalah", "Penyebab", "Solusi"], loginTroubleshooting)}
  </section>

  ${sectionTitle(6, "Panduan Manajemen Surat", chapters[5].lead)}
    <p>Manajemen Surat adalah aplikasi pengelolaan surat digital. Modul ini membantu pencatatan surat, pengelolaan surat masuk dan keluar, unggah lampiran, pencarian arsip, detail surat, edit data, disposisi, dan pemantauan status.</p>
    <h3 class="small-title">Alur kerja Manajemen Surat</h3>
    ${flow(["Surat Diterima", "Input Data Surat", "Upload Lampiran", "Simpan", "Disposisi", "Tindak Lanjut", "Arsip/Pencarian"])}
    <h3 class="small-title">Fungsi utama</h3>
    <div class="grid-3">
      <div class="card"><h3>Catat surat</h3><p>Input nomor, tanggal, asal/tujuan, perihal, kategori, dan status.</p></div>
      <div class="card"><h3>Kelola lampiran</h3><p>Unggah dan unduh file lampiran sesuai hak akses.</p></div>
      <div class="card"><h3>Disposisi</h3><p>Pilih penerima, tulis instruksi, dan pantau tindak lanjut.</p></div>
      <div class="card"><h3>Pencarian</h3><p>Cari surat berdasarkan kata kunci, filter status, kategori, atau tanggal bila tersedia.</p></div>
      <div class="card"><h3>Detail dan edit</h3><p>Periksa metadata surat dan perbaiki data bila memiliki izin.</p></div>
      <div class="card"><h3>Status</h3><p>Pantau perkembangan surat agar alur kerja tetap tertib.</p></div>
    </div>
    <h3 class="small-title">Tambah surat</h3>
    <ol>
      <li>Buka menu Manajemen Surat.</li>
      <li>Pilih tambah surat.</li>
      <li>Isi seluruh field wajib, seperti nomor, tanggal, asal/tujuan, perihal, dan kategori.</li>
      <li>Upload lampiran jika ada.</li>
      <li>Simpan data.</li>
      <li>Pastikan surat masuk ke daftar surat.</li>
    </ol>
    <h3 class="small-title">Detail dan edit surat</h3>
    <p>Halaman detail menampilkan metadata surat, lampiran, status, dan riwayat disposisi. Edit hanya dilakukan oleh pengguna yang memiliki izin. Setelah mengedit, pastikan perubahan tersimpan dan data tetap konsisten.</p>
    <h3 class="small-title">Disposisi surat</h3>
    <p>Disposisi dipakai untuk memberi arahan atau tugas kepada penerima tertentu. Penerima dapat melihat tugas/disposisi sesuai role, jabatan, dan hak aksesnya.</p>
    <h3 class="small-title">Pencarian dan filter</h3>
    <p>Gunakan kata kunci, status, kategori, tanggal, dan pagination untuk menemukan surat dengan cepat. Bila hasil tidak muncul, periksa kembali filter yang sedang aktif.</p>
    <h3 class="small-title">Upload dan download lampiran</h3>
    <p>Lampiran harus memakai format yang valid, ukuran wajar, dan hanya dapat diakses oleh pengguna yang berhak. File yang tidak valid harus ditolak agar data tetap aman.</p>
    ${htmlTable(["Role", "Akses yang Umum Diberikan", "Catatan"], suratAccess)}
  </section>

  ${sectionTitle(7, "Panduan Fitur AI", chapters[6].lead)}
    <div class="quote">AI membantu mempercepat pekerjaan, tetapi hasil akhir tetap harus diperiksa dan disahkan oleh manusia yang berwenang.</div>
    <h3 class="small-title">Fungsi AI</h3>
    <div class="grid-2">
      <div class="card"><h3>Draft dan narasi</h3><p>Membantu menyusun konsep awal, redaksi, atau narasi administratif.</p></div>
      <div class="card"><h3>Ringkasan</h3><p>Membantu merangkum informasi agar lebih cepat dipahami.</p></div>
      <div class="card"><h3>Analisis awal</h3><p>Membantu membuat daftar poin, risiko, atau rekomendasi awal.</p></div>
      <div class="card"><h3>Pemeriksaan dokumen</h3><p>Membantu mengecek konsistensi, bahasa, dan kelengkapan umum.</p></div>
    </div>
    <h3 class="small-title">Cara menggunakan AI</h3>
    <ol>
      <li>Buka fitur AI pada modul yang tersedia.</li>
      <li>Masukkan instruksi atau pertanyaan dengan jelas.</li>
      <li>Periksa hasil yang diberikan.</li>
      <li>Edit atau sesuaikan hasil jika diperlukan.</li>
      <li>Jangan langsung memakai hasil AI tanpa pemeriksaan manusia.</li>
    </ol>
    <h3 class="small-title">Batasan AI</h3>
    ${checklist([
      "AI hanya alat bantu.",
      "Hasil AI wajib diverifikasi.",
      "AI tidak menggantikan kewenangan pejabat/pengguna.",
      "Jangan memasukkan data sensitif yang tidak diperlukan.",
      "Pengguna tetap bertanggung jawab atas hasil akhir.",
    ])}
    <h3 class="small-title">Contoh penggunaan AI</h3>
    ${htmlTable(["Kebutuhan", "Contoh Instruksi", "Catatan"], [
      ["Ringkasan surat", "Buat ringkasan 5 poin dari isi surat ini.", "Periksa kembali isi ringkasan."],
      ["Draft narasi", "Susun narasi singkat dan formal berdasarkan poin berikut.", "Sesuaikan dengan gaya bahasa instansi."],
      ["Daftar poin penting", "Ambil poin penting dan potensi tindak lanjut.", "Gunakan sebagai bahan awal."],
      ["Cek konsistensi", "Periksa apakah tanggal, nama, dan nomor dokumen konsisten.", "Tetap lakukan verifikasi manual."],
    ])}
    ${callout("warn", "Etika dan Keamanan AI", "Gunakan AI secara bertanggung jawab. Jaga kerahasiaan data, jangan memasukkan informasi yang tidak perlu, dan jangan memakai hasil AI sebagai keputusan akhir tanpa validasi.")}
  </section>

  ${sectionTitle(8, "Panduan Admin", chapters[7].lead)}
    <h3 class="small-title">Fungsi admin</h3>
    <div class="grid-2">
      <div class="card"><h3>Manajemen user</h3><p>Tambah, edit, aktifkan, nonaktifkan, dan mapping user ke role serta jabatan.</p></div>
      <div class="card"><h3>Role dan permission</h3><p>Mengatur peran dan izin agar akses sesuai kebutuhan kerja.</p></div>
      <div class="card"><h3>Module visibility</h3><p>Menentukan modul yang terlihat dan dapat dibuka oleh role tertentu.</p></div>
      <div class="card"><h3>Pengaturan aplikasi</h3><p>Mengelola pengaturan Manajemen Surat, AI, dan konfigurasi portal yang tersedia.</p></div>
    </div>
    <h3 class="small-title">Manajemen user</h3>
    <ol>
      <li>Tambah user baru sesuai identitas resmi.</li>
      <li>Edit user bila ada perubahan data.</li>
      <li>Nonaktifkan user yang tidak lagi berwenang.</li>
      <li>Aktifkan kembali user bila diperlukan.</li>
      <li>Mapping user ke role dan jabatan yang benar.</li>
    </ol>
    <h3 class="small-title">Role dan permission</h3>
    <p>Role adalah peran umum pengguna, sedangkan permission adalah izin spesifik. Admin harus memberi akses secukupnya agar pengguna dapat bekerja tanpa membuka data yang tidak relevan.</p>
    <h3 class="small-title">Module visibility</h3>
    <p>Module visibility menentukan modul yang tampil untuk role tertentu. Bila modul dinonaktifkan untuk role tertentu, menu dapat hilang dan route tidak dapat dipakai oleh pengguna tersebut.</p>
    <h3 class="small-title">Pengaturan Manajemen Surat</h3>
    <p>Admin dapat menyesuaikan pengaturan operasional seperti kategori/status bila tersedia, akses operator, disposisi, dan kebijakan lampiran.</p>
    <h3 class="small-title">Pengaturan AI</h3>
    <p>Fitur AI dapat diaktifkan atau dibatasi sesuai konfigurasi dan kebijakan. Jika ada pengaturan provider, API key, atau kredensial teknis, informasi tersebut hanya boleh dilihat oleh admin yang berwenang.</p>
    <h3 class="small-title">Checklist admin</h3>
    ${checklist(adminChecklist)}
  </section>

  ${sectionTitle(9, "Aplikasi Pengembangan Selanjutnya", chapters[8].lead)}
    <p>Selain Dashboard SSO, Manajemen Surat, Fitur AI, dan Admin, Portal ALETA disiapkan sebagai ekosistem aplikasi internal yang dapat terus berkembang.</p>
    <div class="grid-2">
      <div class="card"><h3>Aplikasi monitoring</h3><p>Untuk pemantauan data atau indikator kerja internal.</p></div>
      <div class="card"><h3>Aplikasi integrasi data</h3><p>Untuk menghubungkan data dari sistem lain secara aman.</p></div>
      <div class="card"><h3>Aplikasi dokumen</h3><p>Untuk penyusunan, penyimpanan, atau pengelolaan dokumen kerja.</p></div>
      <div class="card"><h3>Aplikasi notifikasi</h3><p>Untuk memberi pengingat atau informasi kepada pengguna sesuai hak akses.</p></div>
    </div>
    ${callout("note", "Batasan panduan ini", "Modul seperti ALETA x SIPP, ALETA Justicia Legal Form, Query Registry, Variable Registry, dan WhatsApp Gateway tidak dijelaskan detail dalam versi ringkas ini. Modul tersebut diposisikan sebagai bagian ekosistem yang dapat dikembangkan atau didokumentasikan terpisah.")}
  </section>

  ${sectionTitle(10, "Troubleshooting", chapters[9].lead)}
    ${htmlTable(["Masalah", "Kemungkinan Penyebab", "Solusi", "Ditangani Oleh"], troubleshootingRows)}
  </section>

  ${sectionTitle(11, "FAQ", chapters[10].lead)}
    ${faqRows.map(([question, answer]) => `<div class="card no-break"><h3>${escapeHtml(question)}</h3><p>${escapeHtml(answer)}</p></div>`).join("")}
  </section>

  ${sectionTitle(12, "Glosarium", chapters[11].lead)}
    ${htmlTable(["Istilah", "Penjelasan"], glossaryRows)}
  </section>

  ${sectionTitle(13, "Lampiran", chapters[12].lead)}
    <div class="grid-2">
      <div class="card">
        <h3>Checklist penggunaan harian user</h3>
        ${checklist(["Login memakai akun pribadi.", "Buka hanya menu yang diperlukan.", "Periksa data sebelum menyimpan.", "Logout setelah selesai."])}
      </div>
      <div class="card">
        <h3>Checklist kesiapan awal aplikasi</h3>
        ${checklist(["User aktif tersedia.", "Role dan permission sesuai.", "Module visibility sudah diatur.", "Manajemen Surat bisa dibuka.", "Pengaturan AI sesuai kebijakan."])}
      </div>
      <div class="card">
        <h3>Ringkasan hak akses</h3>
        <p>Super Admin dan Admin mengelola sistem. Operator Surat mengelola data surat. Hakim, Panitera, Jurusita, dan user lain memakai fitur sesuai tugas dan disposisi.</p>
      </div>
      <div class="card">
        <h3>Ringkasan penggunaan AI aman</h3>
        ${checklist(["Beri instruksi jelas.", "Jangan memasukkan data sensitif yang tidak perlu.", "Verifikasi hasil.", "Gunakan sebagai bahan bantu, bukan keputusan final."])}
      </div>
    </div>
    <h3 class="small-title">Ringkasan alur Manajemen Surat</h3>
    ${flow(["Input", "Lampiran", "Validasi", "Simpan", "Disposisi", "Tindak Lanjut", "Arsip"])}
    <p class="footer-note">Dokumen ini dibuat otomatis dari generator dokumentasi Portal ALETA. Tidak ada screenshot aplikasi, placeholder screenshot, gambar loading, password, token, secret, cookie, atau API key yang disisipkan.</p>
  </section>
</body>
</html>`;
}

async function renderPdf(html) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1240, height: 1754 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });
  await page.pdf({
    path: output.pdf,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: false,
  });
  await browser.close();
}

async function main() {
  fs.mkdirSync(docsDir, { recursive: true });
  const html = buildHtml();

  fs.writeFileSync(output.markdown, markdown, "utf8");
  fs.writeFileSync(output.html, html, "utf8");
  await renderPdf(html);

  const pdf = await PDFDocument.load(fs.readFileSync(output.pdf));
  const imageTagCount = (html.match(/<img\b/gi) ?? []).length;
  const imagePathCount = (html.match(/\.(png|jpe?g|webp|gif|svg)/gi) ?? []).length;
  const screenshotPathCount = (html.match(/screenshots?[\\/]/gi) ?? []).length;

  const report = {
    generatedAt: now.toISOString(),
    generatedDate,
    version,
    institution,
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
      "Modul pengembangan lain",
    ],
    files: output,
    pdfPageCount: pdf.getPageCount(),
    method: "Markdown dan HTML statis dibuat oleh Node.js, lalu HTML dirender menjadi PDF menggunakan Playwright tanpa membuka halaman aplikasi untuk screenshot.",
    screenshotPolicy: {
      usesScreenshots: false,
      imageTagCount,
      imagePathCount,
      screenshotPathCount,
      hasPlaceholderScreenshot: false,
      hasLoadingImage: false,
    },
  };

  fs.writeFileSync(output.report, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
