#!/usr/bin/env node
"use strict";

/**
 * Meneruskan keputusan hakim ke e-Court — Tahap 6.
 *
 *   node tools/ecourt-bridge/kirim-verifikasi.js            (uji kering)
 *   node tools/ecourt-bridge/kirim-verifikasi.js --kirim    (benar-benar mengirim)
 *
 * ============================================================================
 * ALAT INI MENULIS KE SISTEM RESMI MAHKAMAH AGUNG
 * ============================================================================
 *
 * Berbeda dengan seluruh bagian ALETA lainnya, alat ini mengubah data di
 * sistem di luar kendali pengadilan sendiri. Keputusan Valid/Tidak Valid yang
 * tersimpan di e-Court menentukan apakah sebuah dokumen resmi masuk berkas
 * perkara - dan tidak ada tombol batal yang otomatis.
 *
 * Karena itu seluruh rancangannya berpihak pada TIDAK MENGIRIM:
 *
 *   1. UJI KERING adalah perilaku bawaan. Tanpa tanda --kirim, alat ini hanya
 *      memperlihatkan apa yang akan dilakukan.
 *
 *   2. TIDAK PERNAH TANPA PENGAWASAN. Login e-Court manual (captcha), dan tiap
 *      keputusan harus dikonfirmasi petugas di layar.
 *
 *   3. TIDAK PERNAH MENEBAK DOKUMEN. Sebelum satu pilihan pun disentuh, isi
 *      kotak dialog dibaca dan dicocokkan dengan dokumen yang dimaksud. Bila
 *      tidak cocok, dialog ditutup tanpa menyentuh apa pun.
 *
 *   4. HANYA MENERUSKAN, TIDAK MEMUTUSKAN. Keputusannya berasal dari hakim
 *      lewat menu verifikasi WhatsApp (Tahap 5), lengkap dengan pemeriksaan
 *      keanggotaan majelis. Alat ini hanya kurir.
 *
 * --- Catatan jujur tentang penunjuk elemen ---
 *
 * Penunjuk elemen di bawah disusun dari tangkapan layar, BUKAN dari membaca
 * kode halaman e-Court. Kemungkinan besar perlu disesuaikan saat pertama kali
 * dicoba. Itulah alasan lain mengapa uji kering menjadi perilaku bawaan:
 * jalankan tanpa --kirim lebih dulu untuk melihat apakah dialognya benar-benar
 * ditemukan dan isinya terbaca dengan benar.
 */

const readline = require("readline");

const scraper = require("./scraper");
const sesiEcourt = require("./sesi");
const verifikasi = require("../../services/ecourtVerificationService");
const { cleanText } = require("../../services/ecourtTextService");

const LOGIN_TIMEOUT_MS = Number(process.env.ALETA_ECOURT_LOGIN_TIMEOUT_MS || 10 * 60 * 1000);

/**
 * Penunjuk elemen pada kotak dialog "Verifikasi Dokumen e-Litigation".
 *
 * Dapat ditimpa lewat pengaturan tanpa mengubah kode, karena situs pemerintah
 * dapat berubah sewaktu-waktu.
 */
const SELECTORS = {
  tombolVerifikasi: process.env.ALETA_ECOURT_SEL_TOMBOL || 'a,button',
  dialog: process.env.ALETA_ECOURT_SEL_DIALOG || '.modal.show, .modal[style*="display: block"]',
  radioValid: process.env.ALETA_ECOURT_SEL_VALID || 'input[type="radio"][value="1"], input[type="radio"][value="valid"]',
  radioTidakValid: process.env.ALETA_ECOURT_SEL_TIDAK_VALID || 'input[type="radio"][value="0"], input[type="radio"][value="tidak_valid"]',
  keterangan: process.env.ALETA_ECOURT_SEL_KETERANGAN || 'textarea',
  simpan: process.env.ALETA_ECOURT_SEL_SIMPAN || 'button[type="submit"], .btn-warning, .btn-primary',
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(pesan) {
  console.log(`[${new Date().toLocaleTimeString("id-ID")}] ${pesan}`);
}

function parseArgs(argv) {
  return {
    kirim: argv.includes("--kirim"),
    batas: (() => {
      const i = argv.indexOf("--batas");
      return i >= 0 ? Number(argv[i + 1]) || 20 : 20;
    })(),
  };
}

/** Bertanya ke petugas di layar. Jawaban selain "ya" berarti tidak. */
function tanya(pertanyaan) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(pertanyaan, (jawaban) => {
      rl.close();
      resolve(cleanText(jawaban).toLowerCase() === "ya");
    });
  });
}

async function waitForManualLogin(page) {
  log("Silakan login di jendela peramban (email, sandi, dan kode captcha).");
  const batas = Date.now() + LOGIN_TIMEOUT_MS;
  while (Date.now() < batas) {
    if (scraper.isLoggedInUrl(page.url())) {
      log("Login terdeteksi.");
      return true;
    }
    await sleep(2000);
  }
  return false;
}

/**
 * Membaca isi kotak dialog verifikasi yang sedang terbuka.
 *
 * Mengembalikan null bila dialognya tidak ditemukan - dan null harus
 * diperlakukan sebagai "jangan lakukan apa pun", bukan sebagai "coba saja".
 */
async function readDialog(page) {
  return page.evaluate((sel) => {
    const dialog = document.querySelector(sel.dialog);
    if (!dialog) return null;
    const teks = dialog.innerText || "";
    const ambil = (label) => {
      const cocok = teks.match(new RegExp(`${label}\\s*\\n\\s*([^\\n]+)`, "i"));
      return cocok ? cocok[1].trim() : "";
    };
    return {
      teksPenuh: teks,
      namaDokumen: ambil("Nama Dokumen"),
      pemilikDokumen: ambil("Pemilik Dokumen"),
      tanggalUpload: ambil("Tanggal Upload"),
      adaRadioValid: Boolean(dialog.querySelector(sel.radioValid)),
      adaTombolSimpan: Boolean(dialog.querySelector(sel.simpan)),
    };
  }, SELECTORS);
}

/**
 * Apakah dialog yang terbuka benar-benar dokumen yang kita maksud?
 *
 * Penjagaan terpenting di berkas ini. Tanpa pemeriksaan ini, satu kesalahan
 * urutan atau satu perubahan tampilan e-Court dapat membuat keputusan hakim
 * tersimpan pada DOKUMEN YANG SALAH - kesalahan yang tidak akan terlihat
 * sampai ada yang mempersoalkannya di persidangan.
 */
function dialogMatchesDocument(dialog, keputusan) {
  if (!dialog) return { cocok: false, alasan: "dialog_tidak_ditemukan" };

  const judulDiharapkan = cleanText(keputusan.judul_dokumen).toLowerCase();
  const judulDiDialog = cleanText(dialog.namaDokumen).toLowerCase();

  if (!judulDiharapkan) return { cocok: false, alasan: "judul_dokumen_tidak_diketahui" };
  if (!judulDiDialog) return { cocok: false, alasan: "nama_dokumen_tidak_terbaca_di_dialog" };
  if (judulDiDialog !== judulDiharapkan) {
    return { cocok: false, alasan: `judul_berbeda: dialog="${dialog.namaDokumen}" diharapkan="${keputusan.judul_dokumen}"` };
  }
  if (!dialog.adaRadioValid) return { cocok: false, alasan: "pilihan_valid_tidak_ditemukan" };
  if (!dialog.adaTombolSimpan) return { cocok: false, alasan: "tombol_simpan_tidak_ditemukan" };

  return { cocok: true, alasan: "" };
}

async function utama() {
  const args = parseArgs(process.argv.slice(2));

  const antrean = await verifikasi.listPendingForward({ limit: args.batas });
  if (antrean.length === 0) {
    console.log("Tidak ada keputusan hakim yang menunggu diteruskan ke e-Court.");
    process.exit(0);
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log(`${antrean.length} keputusan menunggu diteruskan ke e-Court`);
  console.log(`Mode: ${args.kirim ? "*** MENGIRIM SUNGGUHAN ***" : "uji kering (tidak mengirim)"}`);
  console.log(`${"=".repeat(70)}\n`);

  for (const item of antrean) {
    console.log(`  ${cleanText(item.nomor_perkara)} — ${cleanText(item.judul_dokumen)}`);
    console.log(`    keputusan : ${item.keputusan === "valid" ? "VALID" : "TIDAK VALID"}`);
    console.log(`    oleh      : ${cleanText(item.nama_hakim)}`);
    console.log(`    pada      : ${item.diputuskan_pada ? new Date(item.diputuskan_pada).toLocaleString("id-ID") : "-"}\n`);
  }

  if (!args.kirim) {
    console.log("Uji kering selesai. Tidak ada yang dikirim ke e-Court.");
    console.log("Jalankan ulang dengan --kirim bila daftar di atas sudah benar.\n");
    process.exit(0);
  }

  const lanjut = await tanya(
    `Meneruskan ${antrean.length} keputusan ke e-Court akan MENGUBAH DATA RESMI.\n` +
    `Ketik "ya" untuk melanjutkan, apa pun selain itu untuk membatalkan: `
  );
  if (!lanjut) {
    console.log("Dibatalkan. Tidak ada yang dikirim.");
    process.exit(0);
  }

  const puppeteer = require("puppeteer");
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

  const hasil = { berhasil: 0, gagal: 0, dilewati: 0 };

  try {
    const page = (await browser.pages())[0] || (await browser.newPage());
    await page.goto(`${scraper.BASE_URL}/Login`, { waitUntil: "networkidle2", timeout: 60000 });

    if (!(await waitForManualLogin(page))) {
      console.log("Login tidak selesai. Dibatalkan.");
      return;
    }

    for (const item of antrean) {
      const judul = cleanText(item.judul_dokumen);
      log(`Memproses: ${cleanText(item.nomor_perkara)} — ${judul}`);

      if (!item.sumber_url) {
        log("  Dilewati: alamat halaman perkara tidak tersimpan.");
        hasil.dilewati += 1;
        continue;
      }

      try {
        await page.goto(item.sumber_url, { waitUntil: "networkidle2", timeout: 60000 });
        await sleep(1500);

        log("  Buka kotak dialog verifikasi untuk dokumen ini di peramban,");
        const siap = await tanya('  lalu ketik "ya" di sini bila dialognya sudah terbuka: ');
        if (!siap) {
          hasil.dilewati += 1;
          continue;
        }

        const dialog = await readDialog(page);
        const cocok = dialogMatchesDocument(dialog, item);
        if (!cocok.cocok) {
          log(`  DIBATALKAN: ${cocok.alasan}`);
          log("  Tidak ada yang disentuh pada dialog ini.");
          hasil.gagal += 1;
          continue;
        }

        log(`  Dialog cocok: "${dialog.namaDokumen}"`);
        const yakin = await tanya(
          `  Simpan keputusan ${item.keputusan === "valid" ? "VALID" : "TIDAK VALID"}? Ketik "ya": `
        );
        if (!yakin) {
          hasil.dilewati += 1;
          continue;
        }

        await page.evaluate(
          (sel, keputusan) => {
            const dialog = document.querySelector(sel.dialog);
            if (!dialog) return;
            const radio = dialog.querySelector(keputusan === "valid" ? sel.radioValid : sel.radioTidakValid);
            if (radio) {
              radio.click();
              radio.dispatchEvent(new Event("change", { bubbles: true }));
            }
          },
          SELECTORS,
          item.keputusan
        );
        await sleep(500);

        // Tombol Simpan sengaja ditekan lewat klik biasa, bukan pengiriman
        // formulir langsung, supaya validasi bawaan halaman e-Court tetap
        // berjalan sebagaimana ketika petugas menekannya sendiri.
        await page.evaluate((sel) => {
          const dialog = document.querySelector(sel.dialog);
          const tombol = dialog && dialog.querySelector(sel.simpan);
          if (tombol) tombol.click();
        }, SELECTORS);
        await sleep(2500);

        await verifikasi.markForwarded(item.document_key, `diteruskan ${item.keputusan}`);
        hasil.berhasil += 1;
        log("  Tersimpan di e-Court dan ditandai sudah diteruskan.");
      } catch (error) {
        log(`  Gagal: ${error.message}`);
        hasil.gagal += 1;
      }
    }
  } finally {
    await browser.close();
    console.log("\n=== Ringkasan penerusan ===");
    console.log(`  Berhasil : ${hasil.berhasil}`);
    console.log(`  Gagal    : ${hasil.gagal}`);
    console.log(`  Dilewati : ${hasil.dilewati}`);
    process.exit(hasil.gagal > 0 ? 1 : 0);
  }
}

// Hanya berjalan bila dipanggil langsung dari baris perintah. Tanpa penjagaan
// ini, sekadar me-require berkas ini dari skrip pemeriksaan akan MENJALANKAN
// penerusan sungguhan - persis kesalahan yang paling mahal di alat ini.
if (require.main === module) {
  utama().catch((error) => {
    console.error("Penerusan verifikasi gagal:", error);
    process.exit(1);
  });
}

module.exports = { SELECTORS, dialogMatchesDocument, parseArgs, readDialog };
