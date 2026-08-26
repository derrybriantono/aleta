#!/usr/bin/env node
"use strict";

/**
 * Jembatan e-Court — Tahap 1.
 *
 *   node tools/ecourt-bridge/run.js
 *   node tools/ecourt-bridge/run.js --maks-perkara 5 --tanpa-unduh
 *
 * --- LOGIN TETAP MANUAL, DAN ITU DISENGAJA ---
 *
 * Halaman masuk e-Court memakai CAPTCHA. Skrip ini TIDAK membaca, mengisi,
 * maupun mencoba melewati captcha itu - fungsi captcha memang untuk memastikan
 * seorang manusia yang masuk, dan menyiasatinya berarti membatalkan pengaman
 * yang sengaja dipasang Mahkamah Agung.
 *
 * Karena itu peramban dibuka dalam keadaan TERLIHAT, lalu skrip menunggu
 * sampai petugas menyelesaikan login sendiri. Setelah masuk, barulah skrip
 * mengambil alih pekerjaan yang membosankan: membuka tiap perkara dan
 * mengunduh berkasnya satu per satu.
 *
 * --- Terpisah dari app.js ---
 *
 * Bot WhatsApp harus hidup 24 jam. Jembatan ini butuh peramban penuh dan
 * kehadiran manusia setiap kali sesinya habis. Menyatukan keduanya membuat
 * proses yang wajib selalu hidup ikut bergantung pada langkah yang menunggu
 * orang - kalau jembatan macet, bot ikut macet. Dipisah, jembatan boleh gagal
 * atau menunggu tanpa mengganggu satu pesan pun yang sedang berjalan.
 */

const fs = require("fs");
const path = require("path");

const scraper = require("./scraper");
const sesiEcourt = require("./sesi");
const ecourtStoreService = require("../../services/ecourtStoreService");
const ecourtDocumentService = require("../../services/ecourtDocumentService");
const { caseNumberToFolder, cleanText, safeFileName } = require("../../services/ecourtTextService");

/** Berapa lama menunggu petugas menyelesaikan login manual. */
const LOGIN_TIMEOUT_MS = Number(process.env.ALETA_ECOURT_LOGIN_TIMEOUT_MS || 10 * 60 * 1000);
/**
 * Jeda antar halaman.
 *
 * Bukan demi anti-blokir WhatsApp, melainkan sopan santun terhadap server
 * pengadilan: membuka puluhan halaman secepat mungkin membebani situs yang
 * dipakai bersama seluruh Indonesia.
 */
const PAGE_DELAY_MS = Number(process.env.ALETA_ECOURT_PAGE_DELAY_MS || 1500);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv) {
  const args = { maksPerkara: 0, tanpaUnduh: false, headless: false, lupakanSesi: false };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--maks-perkara") args.maksPerkara = Number(argv[++i]) || 0;
    else if (item === "--tanpa-unduh") args.tanpaUnduh = true;
    else if (item === "--lupakan-sesi") args.lupakanSesi = true;
  }
  return args;
}

function log(pesan) {
  const waktu = new Date().toLocaleTimeString("id-ID");
  console.log(`[${waktu}] ${pesan}`);
}

/**
 * Menunggu petugas menyelesaikan login.
 *
 * Tidak menyentuh kolom apa pun di halaman itu - tidak email, tidak sandi,
 * tidak captcha. Hanya memeriksa alamat halaman secara berkala sampai
 * menunjukkan pengguna sudah berada di dalam.
 */
async function waitForManualLogin(page) {
  log("Silakan login di jendela peramban yang terbuka (isi email, sandi, dan kode captcha).");
  log(`Skrip menunggu sampai ${Math.round(LOGIN_TIMEOUT_MS / 60000)} menit.`);

  const batas = Date.now() + LOGIN_TIMEOUT_MS;
  while (Date.now() < batas) {
    if (scraper.isLoggedInUrl(page.url())) {
      log("Login terdeteksi. Skrip mengambil alih.");
      return true;
    }
    await sleep(2000);
  }
  return false;
}

/**
 * Mengunduh satu berkas memakai sesi peramban yang sedang aktif.
 *
 * Pengunduhan dilakukan DARI DALAM halaman, bukan lewat permintaan HTTP
 * terpisah, supaya cookie sesi login ikut terbawa. Permintaan dari luar
 * peramban akan ditolak e-Court karena dianggap belum masuk.
 */
async function downloadFile(page, url, targetPath) {
  const hasil = await page.evaluate(async (alamat) => {
    try {
      const respons = await fetch(alamat, { credentials: "include" });
      if (!respons.ok) return { ok: false, reason: `HTTP ${respons.status}` };

      const tipe = respons.headers.get("content-type") || "";
      // Sesi yang sudah habis membuat e-Court mengembalikan halaman login
      // berstatus 200 - terlihat berhasil padahal isinya HTML, bukan berkas.
      if (/text\/html/i.test(tipe)) {
        return { ok: false, reason: "sesi_habis_atau_bukan_berkas" };
      }

      const buffer = await respons.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let biner = "";
      for (let i = 0; i < bytes.length; i += 1) biner += String.fromCharCode(bytes[i]);
      return { ok: true, base64: btoa(biner), contentType: tipe, size: bytes.length };
    } catch (error) {
      return { ok: false, reason: String(error && error.message ? error.message : error) };
    }
  }, url);

  if (!hasil.ok) return hasil;

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, Buffer.from(hasil.base64, "base64"));
  return { ok: true, size: hasil.size, contentType: hasil.contentType };
}

/** Menebak ekstensi berkas dari alamat atau tipe isinya. */
function guessExtension(url, contentType = "") {
  const dariUrl = path.extname(String(url || "").split("?")[0]).toLowerCase();
  if (ecourtDocumentService.ALLOWED_EXTENSIONS.has(dariUrl)) return dariUrl;
  const tipe = String(contentType || "").toLowerCase();
  if (tipe.includes("pdf")) return ".pdf";
  if (tipe.includes("wordprocessingml")) return ".docx";
  if (tipe.includes("msword")) return ".doc";
  if (tipe.includes("rtf")) return ".rtf";
  return ".pdf";
}

/** Memproses satu halaman detail perkara. */
async function processCase(page, url, ringkasan, args) {
  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(PAGE_DELAY_MS);

  const html = await page.content();
  const detail = scraper.parseCaseDetail(html);

  if (!detail.nomorPerkara) {
    log("  Nomor perkara tidak ditemukan di halaman ini, dilewati.");
    ringkasan.jumlahGalat += 1;
    return;
  }

  log(`  Perkara ${detail.nomorPerkara} (${detail.dokumenPersidangan.length} dokumen persidangan, ${detail.dokumenPendaftaran.length} berkas pendaftaran)`);
  const folder = ecourtDocumentService.caseFolder(caseNumberToFolder(detail.nomorPerkara));
  const agendaTerakhir = detail.agenda.length > 0 ? detail.agenda[detail.agenda.length - 1] : "";

  // Batas waktu unggah yang PALING BELAKANG adalah yang masih berlaku. Halaman
  // e-Court memuat seluruh riwayat agenda, termasuk tenggat yang sudah lewat;
  // memakai yang pertama akan memberitahukan tenggat kedaluwarsa kepada pihak.
  const batasList = Array.isArray(detail.batasUnggah) ? detail.batasUnggah : [];
  const batasTerakhir = batasList.length > 0 ? batasList[batasList.length - 1] : null;

  // Dokumen persidangan lebih dulu: inilah yang berpotensi memicu
  // pemberitahuan. Berkas pendaftaran tetap dicatat untuk kelengkapan arsip.
  const semua = [
    ...detail.dokumenPersidangan.map((item) => ({ ...item, sumber: "persidangan" })),
    ...detail.dokumenPendaftaran.map((item) => ({
      judul: item.judul,
      jenis: "",
      peranPengunggah: "",
      emailPengunggah: "",
      diunggahPada: null,
      statusMentah: "",
      unduhUrl: item.url,
      sumber: "pendaftaran",
    })),
  ];

  for (const dokumen of semua) {
    ringkasan.dokumenTerlihat += 1;

    const documentKey = ecourtStoreService.buildDocumentKey({
      nomorPerkara: detail.nomorPerkara,
      judulDokumen: dokumen.judul,
      emailPengunggah: dokumen.emailPengunggah,
      diunggahPada: dokumen.diunggahPada,
    });

    let berkasPdf = null;
    let sudahAda = false;
    try {
      sudahAda = await ecourtStoreService.hasDocument(documentKey);
    } catch {
      sudahAda = false;
    }

    // Berkas yang sudah pernah diunduh tidak diunduh ulang. Ini yang membuat
    // sinkronisasi kedua dan seterusnya jauh lebih cepat dan jauh lebih sopan
    // terhadap server pengadilan.
    if (!sudahAda && !args.tanpaUnduh && dokumen.unduhUrl) {
      const namaSementara = safeFileName(dokumen.judul || "dokumen", guessExtension(dokumen.unduhUrl));
      const target = path.join(folder, namaSementara);
      try {
        const unduh = await downloadFile(page, dokumen.unduhUrl, target);
        if (unduh.ok) {
          berkasPdf = target;
          ringkasan.berkasTerunduh += 1;
          log(`    Terunduh: ${namaSementara} (${Math.round(unduh.size / 1024)} KB)`);
        } else {
          log(`    Gagal unduh "${dokumen.judul}": ${unduh.reason}`);
          ringkasan.jumlahGalat += 1;
          ringkasan.galatTerakhir = `${dokumen.judul}: ${unduh.reason}`;
        }
      } catch (error) {
        log(`    Gagal unduh "${dokumen.judul}": ${error.message}`);
        ringkasan.jumlahGalat += 1;
        ringkasan.galatTerakhir = error.message;
      }
      await sleep(PAGE_DELAY_MS);
    }

    try {
      const hasil = await ecourtStoreService.recordDocument({
        documentKey,
        nomorPerkara: detail.nomorPerkara,
        registrasiEcourt: detail.registrasiEcourt,
        judulDokumen: dokumen.judul,
        jenisDokumen: dokumen.jenis,
        peranPengunggah: dokumen.peranPengunggah,
        emailPengunggah: dokumen.emailPengunggah,
        diunggahPada: dokumen.diunggahPada,
        statusVerifikasi: ecourtStoreService.normalizeStatus(dokumen.statusMentah),
        agenda: agendaTerakhir,
        batasUnggah: batasTerakhir ? batasTerakhir.batasWaktu : null,
        batasUnggahTeks: batasTerakhir ? batasTerakhir.batasWaktuTeks : "",
        berkasPdf,
        sumberUrl: url,
      });
      if (hasil.baru) ringkasan.dokumenBaru += 1;
    } catch (error) {
      log(`    Gagal mencatat "${dokumen.judul}": ${error.message}`);
      ringkasan.jumlahGalat += 1;
      ringkasan.galatTerakhir = error.message;
    }
  }
}

async function utama() {
  const args = parseArgs(process.argv.slice(2));

  // puppeteer sudah menjadi dependensi whatsapp-web.js, jadi tidak ada paket
  // baru yang perlu dipasang.
  const puppeteer = require("puppeteer");

  // --lupakan-sesi menghapus profil tersimpan. Inilah satu-satunya cara
  // "logout" yang benar: menghapus jejaknya, bukan sekadar menutup peramban.
  // Dipakai bila petugas berganti akun, atau komputernya akan diserahkan ke
  // orang lain.
  if (args.lupakanSesi) {
    const hasil = sesiEcourt.clearSession();
    log(hasil.ok ? "Sesi tersimpan dihapus. Login berikutnya dari awal." : `Gagal menghapus sesi: ${hasil.alasan}`);
  }

  log("Membuka peramban e-Court...");
  // Profil peramban yang bertahan: selama sesi e-Court belum kedaluwarsa,
  // penjalanan berikutnya langsung masuk tanpa login ulang. Captcha tetap
  // diisi manusia - yang disimpan adalah hasil login petugas sendiri.
  const { opsi, sesi } = sesiEcourt.launchOptions({ headless: false });
  if (!sesi.ok) {
    log(`Profil sesi tidak dapat dipakai (${sesi.alasan}). Peramban dibuka bersih, login manual seperti biasa.`);
  } else if (sesiEcourt.sessionExists()) {
    log("Memakai sesi tersimpan. Bila masih berlaku, tidak perlu login lagi.");
  }
  const browser = await puppeteer.launch(opsi);

  const ringkasan = {
    perkaraDiperiksa: 0,
    dokumenTerlihat: 0,
    dokumenBaru: 0,
    berkasTerunduh: 0,
    jumlahGalat: 0,
    galatTerakhir: "",
    status: "selesai",
  };

  let runId = null;
  try {
    runId = await ecourtStoreService.startSyncRun({ catatan: "jembatan e-court manual" });
  } catch (error) {
    log(`Peringatan: catatan sinkronisasi tidak dapat dibuat (${error.message}). Sinkronisasi tetap dilanjutkan.`);
  }

  try {
    const page = (await browser.pages())[0] || (await browser.newPage());
    await page.goto(`${scraper.BASE_URL}/Login`, { waitUntil: "networkidle2", timeout: 60000 });

    const masuk = await waitForManualLogin(page);
    if (!masuk) {
      ringkasan.status = "gagal";
      ringkasan.galatTerakhir = "login manual tidak selesai sebelum batas waktu";
      log("Login tidak selesai sebelum batas waktu. Sinkronisasi dibatalkan.");
      return;
    }

    log("Membuka daftar perkara...");
    const html = await page.content();
    let tautan = scraper.extractCaseLinks(html);

    if (tautan.length === 0) {
      log("Tidak ada tautan perkara di halaman ini.");
      log("Buka menu Daftar Perkara / E-Filing di peramban, lalu tekan Enter di sini.");
      await new Promise((resolve) => process.stdin.once("data", resolve));
      tautan = scraper.extractCaseLinks(await page.content());
    }

    if (args.maksPerkara > 0) tautan = tautan.slice(0, args.maksPerkara);
    log(`Ditemukan ${tautan.length} perkara untuk diperiksa.`);

    for (const url of tautan) {
      ringkasan.perkaraDiperiksa += 1;
      log(`[${ringkasan.perkaraDiperiksa}/${tautan.length}] ${url.slice(0, 80)}...`);
      try {
        await processCase(page, url, ringkasan, args);
      } catch (error) {
        log(`  Gagal memproses perkara: ${error.message}`);
        ringkasan.jumlahGalat += 1;
        ringkasan.galatTerakhir = error.message;
      }
    }
  } catch (error) {
    ringkasan.status = "gagal";
    ringkasan.galatTerakhir = error.message;
    log(`Sinkronisasi berhenti: ${error.message}`);
  } finally {
    if (runId) {
      try {
        await ecourtStoreService.finishSyncRun(runId, ringkasan);
      } catch {
        /* catatan gagal ditutup tidak boleh menutupi hasil di layar */
      }
    }
    await browser.close();

    console.log("\n=== Ringkasan sinkronisasi ===");
    console.log(`  Perkara diperiksa : ${ringkasan.perkaraDiperiksa}`);
    console.log(`  Dokumen terlihat  : ${ringkasan.dokumenTerlihat}`);
    console.log(`  Dokumen baru      : ${ringkasan.dokumenBaru}`);
    console.log(`  Berkas terunduh   : ${ringkasan.berkasTerunduh}`);
    console.log(`  Galat             : ${ringkasan.jumlahGalat}`);
    console.log(`  Berkas disimpan di: ${ecourtDocumentService.resolveRoot()}`);
    if (ringkasan.galatTerakhir) console.log(`  Galat terakhir    : ${ringkasan.galatTerakhir}`);
    process.exit(ringkasan.status === "gagal" ? 1 : 0);
  }
}

utama().catch((error) => {
  console.error("Jembatan e-Court gagal dijalankan:", error);
  process.exit(1);
});
