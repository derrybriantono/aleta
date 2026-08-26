import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const root = process.cwd();
const docsDir = path.join(root, "docs");
const screenshotsDir = path.join(docsDir, "screenshots");
const mdPath = path.join(docsDir, "panduan-portal-aleta.md");
const htmlPath = path.join(docsDir, "panduan-portal-aleta.html");
const pdfPath = path.join(docsDir, "panduan-portal-aleta.pdf");
const reportPath = path.join(docsDir, "panduan-portal-aleta-report.json");
const baseUrl = process.env.PORTAL_ALETA_BASE_URL || "http://127.0.0.1:3000";
const loginUser = process.env.PORTAL_ALETA_DOC_USER || "";
const loginPassword = process.env.PORTAL_ALETA_DOC_PASSWORD || "";
const version = process.env.PORTAL_ALETA_DOC_VERSION || "v1.0 - Juli 2026";
const institution = process.env.PORTAL_ALETA_DOC_INSTITUTION || "Pengadilan Agama Donggala";
const createdDate = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Makassar" }).format(new Date());

const targets = [
  ["login", "Halaman Login Portal ALETA", "/login", true, "Halaman login SSO Portal ALETA."],
  ["login-gagal", "Contoh Login Gagal", "/login", true, "Contoh pesan login gagal.", "loginFail"],
  ["portal", "Dashboard Portal", "/portal", false, "Dashboard utama setelah login."],
  ["sidebar-menu", "Sidebar dan Menu Utama", "/portal", false, "Menu utama mengikuti role dan permission."],
  ["account", "Profil Pengguna", "/account", false, "Halaman akun/profil pengguna."],
  ["admin", "Dashboard Admin", "/admin", false, "Halaman administrasi sistem."],
  ["admin-users", "Manajemen User", "/admin", false, "Area manajemen user dan akses."],
  ["positions", "Jabatan dan Mapping User", "/admin/mapping-user-jabatan", false, "Pengaturan jabatan dan mapping user."],
  ["module-visibility", "Module Visibility", "/admin/visibility-role", false, "Pengaturan visibility modul per role."],
  ["ai-settings", "Pengaturan AI", "/admin/pengaturan-ai", false, "Pengaturan fitur AI."],
  ["surat-dashboard", "Dashboard Manajemen Surat", "/manajemen-surat", false, "Dashboard modul Manajemen Surat."],
  ["surat-list", "Daftar Surat", "/surat", false, "Daftar surat, filter, dan pencarian."],
  ["surat-masuk", "Surat Masuk", "/surat/masuk", false, "Halaman surat masuk."],
  ["surat-keluar", "Surat Keluar", "/surat/keluar", false, "Halaman surat keluar."],
  ["disposisi", "Disposisi", "/disposisi", false, "Daftar disposisi dan tindak lanjut."],
  ["aleta-bot", "ALETA Bot", "/aleta-bot", false, "Dashboard ALETA Bot."],
  ["admin-aleta-bot", "Admin ALETA Bot", "/admin/aleta-bot", false, "Pengaturan ALETA Bot, template, dan queue."],
  ["whatsapp-status", "Status WhatsApp Gateway", "/admin/status-whatsapp", false, "Status WhatsApp Gateway dan session."],
  ["aleta-sipp", "ALETA x SIPP", "/aleta-sipp", false, "Dashboard ALETA x SIPP."],
  ["query-registry", "Query Registry", "/aleta-sipp?section=query", false, "Query Registry read-only."],
  ["variable-registry", "Variable Registry", "/aleta-sipp?section=variabel", false, "Variable Registry SIPP/JLF."],
  ["monitoring-sipp", "Monitoring dan SK SIPP", "/aleta-sipp?section=pendukung2018", false, "Monitoring pendukung2018 dan SK SIPP."],
  ["jlf", "ALETA Justicia Legal Form", "/judicia/legal-form", false, "Dashboard JLF."],
  ["jlf-templates", "Template JLF", "/judicia/legal-form/templates", false, "Daftar template legal form."],
  ["jlf-variables", "Variable JLF", "/judicia/legal-form/variables", false, "Daftar variable JLF."],
  ["asisten-hakim", "Asisten Hakim / AI", "/asisten-hakim", false, "Fitur bantuan AI."],
  ["e-kepegawaian", "E-Kepegawaian", "/e-kepegawaian", false, "Modul layanan kepegawaian."],
  ["e-status", "E-Status", "/e-status", false, "Modul monitoring/status layanan."],
  ["panduan", "Halaman Panduan", "/panduan", false, "Panduan bawaan aplikasi."],
  ["masukan", "Saran dan Masukan", "/masukan", false, "Halaman saran dan masukan."],
  ["access-denied", "Contoh Akses Ditolak", "/admin/database", false, "Contoh route yang dibatasi akses."],
].map(([key, title, url, isPublic, caption, action]) => ({ key, title, url, public: isPublic, caption, action }));

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slug(value) {
  return String(value).replace(/[^a-z0-9-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

async function appReady() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const response = await fetch(`${baseUrl}/login`, { signal: AbortSignal.timeout(3000) });
      if (response.ok) return true;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  return false;
}

async function maskSensitive(page) {
  await page.addStyleTag({
    content: `
      input[type='password'], input[name*='password' i], [data-secret], [data-token],
      .secret, .token, .api-key, .cookie, .session { filter: blur(8px) !important; }
    `,
  }).catch(() => {});
}

async function waitForLoginForm(page) {
  const identifier = page.locator("[data-testid='login-identifier'], #identifier, input").first();
  await identifier.waitFor({ state: "visible", timeout: 20000 });
  await page.waitForFunction(() => {
    const input = document.querySelector("[data-testid='login-identifier'], #identifier, input");
    return input && !input.disabled;
  }, { timeout: 25000 }).catch(() => {});
}

async function placeholder(page, target, reason) {
  const file = path.join(screenshotsDir, `${slug(target.key)}.png`);
  await page.goto("about:blank", { waitUntil: "domcontentloaded", timeout: 10000 }).catch(() => {});
  await page.setContent(`
    <html><head><style>
    body{margin:0;height:820px;display:grid;place-items:center;background:linear-gradient(135deg,#0c3348,#0a1726);font-family:Segoe UI,Arial;color:#edf8fd}
    .card{width:980px;border:1px solid rgba(255,255,255,.25);border-radius:28px;padding:46px;background:rgba(255,255,255,.07)}
    .tag{display:inline-block;background:#f0cf61;color:#14202b;border-radius:999px;padding:7px 13px;font-weight:800;margin-bottom:18px}
    h1{font-size:34px;margin:0 0 14px}p{font-size:18px;line-height:1.55;color:#cfe0e9}
    </style></head><body><section class="card"><span class="tag">Placeholder Screenshot</span><h1>${esc(target.title)}</h1><p>Screenshot otomatis belum dapat diambil.</p><p>${esc(reason)}</p><p>Target: ${esc(target.url)}</p></section></body></html>
  `);
  await page.screenshot({ path: file, fullPage: true });
  return { ...target, file, status: "placeholder", reason };
}

async function captureScreenshots() {
  await fs.mkdir(screenshotsDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const results = [];
  const ready = await appReady();

  if (!ready) {
    for (const target of targets) results.push(await placeholder(page, target, `Dev server tidak merespons di ${baseUrl}.`));
    await browser.close();
    return results;
  }

  for (const target of targets.filter((item) => item.public)) {
    try {
      await page.goto(`${baseUrl}${target.url}`, { waitUntil: "domcontentloaded", timeout: 25000 });
      await page.waitForTimeout(1000);
      if (target.action === "loginFail") {
        await waitForLoginForm(page);
        const identifier = page.locator("[data-testid='login-identifier'], #identifier, input").first();
        await identifier.fill("user_tidak_ada");
        const pass = page.locator("[data-testid='login-password'], input[type='password']").first();
        if (await pass.count()) await pass.fill("password-salah");
        const button = page.locator("form button[type='submit']").first();
        await button.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
        if (await button.count()) await button.click().catch(() => page.locator("form").press("Enter").catch(() => {}));
        await page.waitForTimeout(1200);
      }
      await maskSensitive(page);
      const file = path.join(screenshotsDir, `${slug(target.key)}.png`);
      await page.screenshot({ path: file, fullPage: true });
      results.push({ ...target, file, status: "captured" });
    } catch (error) {
      results.push(await placeholder(page, target, error instanceof Error ? error.message : "Gagal mengambil screenshot."));
    }
  }

  let loggedIn = false;
  if (loginUser && loginPassword) {
    try {
      await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 25000 });
      await waitForLoginForm(page);
      const identifier = page.locator("[data-testid='login-identifier'], #identifier, input").first();
      await identifier.fill(loginUser);
      const pass = page.locator("[data-testid='login-password'], input[type='password']").first();
      if (await pass.count()) await pass.fill(loginPassword);
      const button = page.locator("form button[type='submit']").first();
      await button.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
      if (await button.count()) await button.click().catch(() => page.locator("form").press("Enter"));
      await page.waitForURL((url) => !/\/login(?:\?|$)/.test(url.pathname + url.search), { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(2500);
      loggedIn = !/\/login(?:\?|$)/.test(page.url());
    } catch {
      loggedIn = false;
    }
  }

  for (const target of targets.filter((item) => !item.public)) {
    if (!loggedIn) {
      results.push(await placeholder(page, target, "Login otomatis tidak tersedia. Jalankan ulang dengan PORTAL_ALETA_DOC_USER dan PORTAL_ALETA_DOC_PASSWORD untuk screenshot halaman protected."));
      continue;
    }
    try {
      await page.goto(`${baseUrl}${target.url}`, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForTimeout(2200);
      await maskSensitive(page);
      const file = path.join(screenshotsDir, `${slug(target.key)}.png`);
      await page.screenshot({ path: file, fullPage: true });
      results.push({ ...target, file, status: "captured" });
    } catch (error) {
      results.push(await placeholder(page, target, error instanceof Error ? error.message : "Gagal mengambil screenshot protected."));
    }
  }

  await browser.close();
  return results;
}

function relImage(results, key) {
  const item = results.find((entry) => entry.key === key);
  if (!item) return "";
  const rel = path.relative(docsDir, item.file).replace(/\\/g, "/");
  return `![${item.title}](${rel})\n\n_Gambar: ${item.caption}${item.status === "placeholder" ? " (placeholder otomatis)." : "."}_\n`;
}

function imgHtml(results, key) {
  const item = results.find((entry) => entry.key === key);
  if (!item) return "";
  return `<figure><img src="${pathToFileURL(item.file).href}" alt="${esc(item.title)}"><figcaption>${esc(item.caption)}${item.status === "placeholder" ? " (placeholder otomatis)." : "."}</figcaption></figure>`;
}

const chapters = [
  ["Gambaran Umum Portal ALETA", [
    "Portal ALETA adalah SSO dan portal utama untuk masuk ke kumpulan aplikasi internal. User login satu kali, lalu sistem menampilkan aplikasi yang boleh dipakai berdasarkan role, permission, dan module visibility.",
    "Portal ini menyatukan Manajemen Surat, Disposisi, ALETA Bot, WhatsApp Gateway, ALETA x SIPP, Query Registry, Variable Registry, ALETA Justicia Legal Form / JLF, Asisten Hakim, E-Kepegawaian, E-Status, Panduan, Patch Notes, Saran/Masukan, serta pengaturan admin.",
    "Manfaat utamanya adalah akses terpusat, navigasi lebih sederhana, data operasional dari database, dukungan AI, dan komunikasi otomatis melalui WhatsApp Gateway.",
  ], ["portal", "sidebar-menu"]],
  ["Konsep SSO dan Portal Aplikasi", [
    "SSO atau Single Sign On berarti pengguna cukup login sekali untuk masuk ke portal. Setelah login, ALETA membaca session, status user, role, permission, jabatan, dan visibility modul.",
    "Menu tiap user bisa berbeda. Jika modul tidak muncul, penyebab paling umum adalah role belum diberi akses, permission belum lengkap, atau module visibility belum aktif untuk role tersebut.",
    "Portal bukan hanya halaman menu. Setiap route dan API tetap perlu perlindungan hak akses agar user tidak dapat membuka data hanya dengan mengetik URL.",
  ], ["login"]],
  ["Persona Pengguna", [
    "User biasa membuka modul yang tersedia, membaca informasi, mengunduh dokumen yang diizinkan, dan menindaklanjuti tugas atau disposisi.",
    "Operator surat menginput surat masuk/keluar, mengunggah lampiran, mencari data, dan membantu distribusi disposisi.",
    "Hakim, Panitera, Panitera Pengganti, Jurusita, dan role operasional lain memakai modul sesuai kewenangan dan dapat menerima notifikasi jika ALETA Bot dikonfigurasi.",
    "Admin mengelola user, role, jabatan, modul, template pesan, AI, dan pengaturan aplikasi. Admin teknis menangani database, upload folder, datasource SIPP, preflight, query registry, WhatsApp session, dan konfigurasi server.",
  ], []],
  ["Login, Logout, dan Session", [
    "Buka halaman login, isi username/email/NIP/nomor HP dan password, lalu klik Login. Jika opsi ingat akun tersedia, gunakan hanya pada perangkat pribadi.",
    "Login gagal dapat terjadi karena identitas salah, password salah, user nonaktif, atau session bermasalah. Gunakan fitur lupa password bila tersedia atau hubungi admin.",
    "Logout harus dilakukan setelah selesai bekerja, terutama pada komputer bersama. Setelah logout, halaman protected seperti Admin, Surat, ALETA Bot, dan ALETA x SIPP tidak boleh terbuka tanpa login ulang.",
  ], ["login", "login-gagal"]],
  ["Dashboard, Sidebar, dan Profil", [
    "Dashboard Portal menampilkan aplikasi yang tersedia, pintasan modul, informasi ringkas, dan navigasi. Sidebar adalah jalur utama berpindah antar aplikasi.",
    "Halaman profil atau account menampilkan informasi akun. Jika role atau permission berubah, user biasanya perlu login ulang agar hak akses terbaru terbaca.",
  ], ["portal", "account"]],
  ["Panduan User Biasa", [
    "Alur harian user: login, cek dashboard, buka modul kerja, input atau baca data, gunakan AI bila tersedia, cek notifikasi, verifikasi hasil, lalu logout.",
    "User tidak boleh membagikan akun, mengunggah file tidak relevan, mengirim WhatsApp live tanpa izin, mengakses data di luar kewenangan, atau memasukkan data sensitif ke AI tanpa kebutuhan kerja yang jelas.",
  ], ["surat-list", "disposisi"]],
  ["Panduan Admin", [
    "Admin bertugas mengelola user, role, permission, jabatan, module visibility, pengaturan sistem, template bot, AI, dan WhatsApp Gateway.",
    "Perubahan role, permission, dan module visibility harus diuji dengan login user terkait. Menu yang hilang harus diikuti proteksi route dan API.",
  ], ["admin", "admin-users", "positions", "module-visibility"]],
  ["Panduan Admin Teknis", [
    "Admin teknis memastikan database terkoneksi, schema/migration sesuai, upload folder writable, SIPP datasource read-only tersedia, query registry sinkron, WhatsApp Gateway jelas statusnya, AI provider dikonfigurasi, dan preflight lulus.",
    "Jangan memasukkan .env, token, API key, cookie, session WhatsApp, password, atau secret apa pun ke PDF, screenshot, maupun dokumen publik.",
  ], ["ai-settings", "whatsapp-status"]],
  ["Manajemen Surat", [
    "Manajemen Surat mengelola surat masuk, surat keluar, lampiran, disposisi, status, pencarian, filter, pagination, dan workflow administrasi.",
    "Untuk menambah surat, isi metadata wajib, unggah lampiran bila ada, simpan, lalu pastikan surat muncul di daftar. Untuk disposisi, pilih penerima yang benar berdasarkan jabatan/user dan pastikan catatan tindak lanjut jelas.",
    "Jika AI tersedia untuk surat, gunakan sebagai bantuan ringkasan, klasifikasi, atau saran disposisi. Hasil AI tetap wajib diperiksa operator/pejabat berwenang.",
  ], ["surat-dashboard", "surat-list", "surat-masuk", "surat-keluar", "disposisi"]],
  ["ALETA Bot dan WhatsApp Gateway", [
    "ALETA Bot mengelola notifikasi, template pesan, role penerima, preview penerima, dry-run, queue, log pengiriman, health check, worker, dan laporan WhatsApp.",
    "WhatsApp Gateway adalah penghubung aplikasi dengan WhatsApp. Gateway dapat memiliki status online/offline, QR/session, antrean, dan log pengiriman.",
    "Dry-run adalah simulasi tanpa mengirim pesan nyata. Live send adalah pengiriman sungguhan. Jangan menjalankan live send sebelum template, penerima, dan mode pengiriman diverifikasi.",
  ], ["aleta-bot", "admin-aleta-bot", "whatsapp-status"]],
  ["Fitur AI", [
    "AI di Portal ALETA membantu pekerjaan tertentu seperti ekstraksi surat, ringkasan, saran klasifikasi, saran disposisi, Asisten Hakim, draft/analisis JLF, konsistensi dokumen, anonymizer, dan template assistant.",
    "AI tidak menggantikan kewenangan manusia. User wajib memeriksa hasil AI sebelum dipakai untuk tindakan administratif atau dokumen resmi.",
    "Jangan memasukkan data sensitif ke AI jika tidak diperlukan. Admin harus memastikan provider, policy, dan permission sesuai kebijakan kantor.",
  ], ["asisten-hakim", "ai-settings"]],
  ["ALETA x SIPP", [
    "ALETA x SIPP menghubungkan Portal ALETA dengan data SIPP secara read-only. Modul ini menyediakan dictionary database, datasource status, Query Registry, Variable Registry, monitoring pendukung2018, penilaian SK SIPP, export, filter, dan pencarian.",
    "Prinsip utama: ALETA x SIPP membaca data SIPP, bukan menulis ke database SIPP. Query yang belum aman harus tetap needs_review dan tidak boleh dieksekusi live.",
  ], ["aleta-sipp", "query-registry", "variable-registry", "monitoring-sipp"]],
  ["ALETA Justicia Legal Form / JLF", [
    "JLF membantu membuat dokumen/form hukum berbasis template, nomor perkara, variable otomatis, data SQL, data SIPP, multi sidang, jadwal sidang, preview, generate, dan download dokumen.",
    "Jika variable belum lengkap, user/admin perlu melengkapi mapping atau input manual. Bantuan AI di JLF dapat dipakai untuk draft, analisis, konsistensi, dan template bila dikonfigurasi.",
  ], ["jlf", "jlf-templates", "jlf-variables"]],
  ["Query Registry dan Variable Registry", [
    "Query Registry menyimpan query yang dikatalogkan, direview, dan diberi status. Query SIPP wajib SELECT-only, memakai parameter aman, dan tidak boleh memuat INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, atau REPLACE.",
    "Variable Registry menyimpan mapping variable legacy/modern untuk JLF, data SIPP, dan template. Registry membuat query dan variable bisa diaudit, dicari, dan dipakai ulang.",
  ], ["query-registry", "variable-registry"]],
  ["Upload dan Download File", [
    "Upload digunakan untuk lampiran surat, dokumen JLF, logo, PDF, dan file pendukung lain sesuai modul. Upload hanya file relevan dan aman.",
    "Download hanya boleh dilakukan oleh user yang berhak. Jika file gagal dibuka, hubungi admin untuk memeriksa metadata, hak akses, dan file fisik.",
  ], ["surat-list"]],
  ["Role, Permission, dan Module Visibility", [
    "Role adalah kelompok akses seperti Super Admin, Admin, Hakim, Panitera, Panitera Pengganti, Jurusita, Operator, dan User biasa. Permission adalah izin spesifik untuk melihat, membuat, mengubah, menghapus, menjalankan, atau mengelola fitur.",
    "Module visibility menentukan apakah modul tampil di menu role tertentu. Jika akses ditolak, ajukan akses melalui admin sesuai SOP.",
  ], ["module-visibility", "access-denied"]],
  ["Pengaturan Sistem", [
    "Pengaturan sistem meliputi identitas instansi, panel, akses publik, AI, WhatsApp, module visibility, template, backup, database, dan preflight.",
    "Admin boleh mengubah pengaturan operasional. Admin teknis menangani konfigurasi server, env, database, SIPP datasource, WhatsApp session, backup, dan restore.",
  ], ["admin", "ai-settings", "whatsapp-status"]],
  ["Operasional Harian dan Checklist", [
    "Checklist user: login, cek dashboard, buka modul, input data, upload file valid, gunakan AI bila perlu, verifikasi hasil, logout.",
    "Checklist admin: cek user aktif, role, jabatan, module visibility, log bot, status WhatsApp, template pesan, konfigurasi AI, query needs_review, dan preflight.",
    "Checklist staging/public: admin tersedia, role sesuai, modul aktif, upload folder siap, database terkoneksi, template bot tersedia, dry-run/live jelas, AI siap, datasource SIPP siap, dan WhatsApp live diuji di staging.",
  ], []],
  ["Troubleshooting", [
    "Tidak bisa login: cek identitas, password, status user, session, atau hubungi admin.",
    "Menu tidak muncul: cek role, permission, dan module visibility.",
    "Data tidak tampil: cek filter, koneksi database, atau status API.",
    "Upload/download gagal: cek jenis file, ukuran, hak akses, upload folder, dan metadata file.",
    "WhatsApp Gateway offline: cek session, QR, runtime bot, dan log.",
    "Pesan tidak terkirim: cek dry-run, template, penerima, queue, gateway, dan delivery log.",
    "AI tidak merespons: cek provider, quota, koneksi, permission, dan konfigurasi admin.",
    "Datasource SIPP belum tersedia: admin teknis perlu memeriksa koneksi read-only.",
    "Query belum aktif: query masih needs_review, deprecated, atau invalid.",
    "Halaman loading terus: refresh, login ulang, cek API/server log.",
  ], []],
  ["FAQ", [
    "Apakah ALETA satu aplikasi? ALETA adalah portal/SSO kumpulan aplikasi internal.",
    "Apa itu SSO? Login satu kali untuk mengakses modul yang diizinkan.",
    "Kenapa menu saya berbeda? Karena role, permission, dan module visibility berbeda.",
    "Apakah data SIPP bisa diubah dari ALETA? Untuk ALETA x SIPP, prinsipnya read-only.",
    "Apakah ALETA memakai AI? Ya, pada modul tertentu dan sesuai konfigurasi.",
    "Apakah hasil AI pasti benar? Tidak, hasil AI wajib diverifikasi.",
    "Apa bedanya dry-run dan live send? Dry-run simulasi, live send mengirim pesan nyata.",
    "Siapa yang bisa membuat user? Admin atau Super Admin sesuai permission.",
    "Apa yang dilakukan jika lupa password? Gunakan lupa password atau hubungi admin.",
  ], []],
  ["Glosarium", [
    "Portal: pusat akses beberapa aplikasi. SSO: login tunggal. AI: kecerdasan buatan. Prompt: instruksi untuk AI. Role: kelompok hak akses. Permission: izin spesifik. Module visibility: pengaturan modul yang tampil. Disposisi: penerusan surat/tugas. Query Registry: daftar query terkontrol. Variable Registry: daftar variable dan mapping. Dry-run: simulasi. Live send: pengiriman nyata. Gateway: penghubung layanan. Queue: antrean pekerjaan. Delivery log: catatan pengiriman. SIPP: Sistem Informasi Penelusuran Perkara. JLF: Justicia Legal Form. Attachment: lampiran file. Admin teknis: pengelola konfigurasi teknis.",
  ], []],
];

function buildMarkdown(results) {
  const lines = [
    "# Buku Panduan Penggunaan Portal ALETA",
    "",
    "**Panduan User, Admin, dan Admin Teknis**",
    "",
    `**Versi Dokumen:** ${version}`,
    `**Tanggal:** ${createdDate}`,
    `**Instansi:** ${institution}`,
    "",
    "> **Ringkasan:** ALETA adalah SSO dan portal utama untuk masuk ke kumpulan aplikasi internal. User login satu kali, lalu sistem menampilkan aplikasi sesuai role, permission, dan module visibility.",
    "",
    "## Kata Pengantar",
    "",
    "Buku panduan ini disusun untuk membantu pegawai, operator, admin, dan admin teknis memahami Portal ALETA secara aman dan konsisten. Dokumen ini menekankan bahwa ALETA adalah pusat akses berbagai aplikasi internal, dilengkapi dukungan AI dan WhatsApp Gateway.",
    "",
    "## Daftar Isi",
    "",
    ...chapters.map((chapter, index) => `${index + 1}. ${chapter[0]}`),
    "",
  ];
  for (const [title, paragraphs, imageKeys] of chapters) {
    lines.push(`# ${title}`, "");
    for (const paragraph of paragraphs) lines.push(paragraph, "");
    for (const key of imageKeys) lines.push(relImage(results, key), "");
  }
  lines.push("# Lampiran Screenshot", "");
  lines.push("| No | Screenshot | URL | Status | Catatan |");
  lines.push("|---|---|---|---|---|");
  results.forEach((item, index) => lines.push(`| ${index + 1} | ${item.title.replace(/\|/g, "\\|")} | ${item.url} | ${item.status} | ${(item.reason || "-").replace(/\|/g, "\\|")} |`));
  lines.push("", `Jumlah screenshot: ${results.length}.`, `Berhasil diambil: ${results.filter((item) => item.status === "captured").length}.`, `Placeholder: ${results.filter((item) => item.status === "placeholder").length}.`);
  return lines.join("\n");
}

function buildHtml(results) {
  const chapterHtml = chapters.map(([title, paragraphs, imageKeys]) => `
    <section class="chapter">
      <h1>${esc(title)}</h1>
      ${paragraphs.map((paragraph) => `<p>${esc(paragraph)}</p>`).join("")}
      ${imageKeys.map((key) => imgHtml(results, key)).join("")}
    </section>
  `).join("");
  const screenshotRows = results.map((item, index) => `
    <tr><td>${index + 1}</td><td>${esc(item.title)}</td><td>${esc(item.url)}</td><td>${esc(item.status)}</td><td>${esc(item.reason || "-")}</td></tr>
  `).join("");
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Buku Panduan Penggunaan Portal ALETA</title><style>
    @page{size:A4;margin:18mm 14mm 20mm}
    body{font-family:"Segoe UI",Arial,sans-serif;color:#10212f;line-height:1.58;font-size:11.2pt}
    .cover{height:780px;display:flex;flex-direction:column;justify-content:center;text-align:center;background:linear-gradient(135deg,#0b3449,#102033);color:white;border-radius:22px;padding:40px;margin-bottom:30px}
    .cover h1{font-size:38pt;border:0;color:white;margin:0 0 16px}
    .cover p{font-size:15pt;color:#d6e8ef}
    h1{break-before:page;color:#0b3954;font-size:24pt;border-bottom:3px solid #f0c95a;padding-bottom:7px;margin:0 0 12px}
    h2{color:#0e4969;font-size:16pt} p{margin:8px 0}
    .intro{background:#eef8fc;border-left:5px solid #33a4ce;padding:12px 14px;border-radius:8px;margin:16px 0}
    figure{break-inside:avoid;margin:14px 0 8px} img{max-width:100%;border:1px solid #cbd8e0;border-radius:10px;box-shadow:0 6px 18px rgba(0,0,0,.08)}
    figcaption{text-align:center;color:#526575;font-size:9.5pt;margin-top:5px}
    table{width:100%;border-collapse:collapse;margin:12px 0;font-size:9pt} th{background:#0b3954;color:white;text-align:left}
    th,td{border:1px solid #cdd9e1;padding:6px;vertical-align:top} tr:nth-child(even) td{background:#f6f9fb}
    ol{margin-left:22px}.toc{columns:2}.toc li{margin-bottom:5px}
  </style></head><body>
    <section class="cover">
      <h1>Buku Panduan Penggunaan Portal ALETA</h1>
      <p>Panduan User, Admin, dan Admin Teknis</p>
      <p>Portal ALETA</p>
      <p>${esc(version)} | ${esc(createdDate)}</p>
      <p>${esc(institution)}</p>
    </section>
    <section>
      <h1>Kata Pengantar</h1>
      <p>Buku panduan ini disusun untuk membantu pegawai, operator, admin, dan admin teknis memahami Portal ALETA secara aman dan konsisten.</p>
      <div class="intro"><strong>Portal ALETA</strong> adalah SSO dan portal utama untuk masuk ke kumpulan aplikasi internal. Portal ini dilengkapi dukungan AI dan WhatsApp Gateway sesuai modul yang tersedia.</div>
      <h2>Daftar Isi</h2>
      <ol class="toc">${chapters.map(([title]) => `<li>${esc(title)}</li>`).join("")}</ol>
    </section>
    ${chapterHtml}
    <section class="chapter"><h1>Lampiran Screenshot</h1><table><thead><tr><th>No</th><th>Screenshot</th><th>URL</th><th>Status</th><th>Catatan</th></tr></thead><tbody>${screenshotRows}</tbody></table></section>
  </body></html>`;
}

const results = await captureScreenshots();
await fs.mkdir(docsDir, { recursive: true });
await fs.writeFile(mdPath, buildMarkdown(results), "utf8");
await fs.writeFile(htmlPath, buildHtml(results), "utf8");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
await page.pdf({
  path: pdfPath,
  format: "A4",
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<div style="font-size:8px;color:#6b7b88;width:100%;padding:0 14mm;">Buku Panduan Portal ALETA</div>',
  footerTemplate: '<div style="font-size:8px;color:#6b7b88;width:100%;padding:0 14mm;text-align:right;">Halaman <span class="pageNumber"></span> dari <span class="totalPages"></span></div>',
  margin: { top: "18mm", right: "14mm", bottom: "18mm", left: "14mm" },
});
await browser.close();

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  version,
  institution,
  files: { markdown: mdPath, html: htmlPath, pdf: pdfPath, screenshotsDir },
  screenshotCount: results.length,
  capturedCount: results.filter((item) => item.status === "captured").length,
  placeholderCount: results.filter((item) => item.status === "placeholder").length,
  screenshots: results.map((item) => ({ key: item.key, title: item.title, url: item.url, status: item.status, file: item.file, reason: item.reason || null })),
};
await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify({ pdfPath, mdPath, htmlPath, screenshotsDir, screenshotCount: report.screenshotCount, capturedCount: report.capturedCount, placeholderCount: report.placeholderCount }, null, 2));
