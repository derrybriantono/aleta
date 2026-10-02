"use strict";

/**
 * Peramban untuk aksi e-Court atas nama SATU PENGGUNA (perbaikan 1 Okt 2026,
 * butir E9, E10, 16b).
 *
 * ============================================================================
 * BEDANYA DENGAN JEMBATAN PENARIKAN
 * ============================================================================
 *
 * Jembatan penarikan (tools/ecourt-bridge/run.js) memakai akun penarik data
 * milik pengadilan dan profil peramban yang menetap di disk. Berkas ini tidak:
 *
 *   - Tiap aksi membuka peramban BARU dengan folder sementara, memasang cookie
 *     sesi pengguna itu (dibuka dari simpanan tersandi), mengerjakan satu
 *     aksi, membaca cookie yang mungkin diperbarui e-Court, lalu menutup
 *     peramban dan MENGHAPUS folder sementaranya. Tidak ada profil pengguna
 *     yang tertinggal tak tersandi di disk.
 *   - JEDA SEPERTI MANUSIA sebelum tiap aksi tulis - menekan tombol aksi,
 *     mengetik passphrase, memilih berkas, mengirim dialog (keputusan
 *     pengguna 2 Okt 2026, butir 14, membalik keputusan 26 Sep). Rentangnya
 *     di jedaManusiaService, sama dengan alatJedaManusia ekstensi. Mode
 *     kering tidak menunggu. Jejak jujur tetap di tabel aleta_* (siapa,
 *     waktu, IP, "lewat ALETA"), tidak pernah di halaman e-Court. Penanda
 *     elemen sementara di halaman pun bernama netral (data-pk-*), bukan
 *     nama ALETA.
 *
 * ============================================================================
 * PENUNJUK ELEMEN BELUM DIUJI ATAS e-COURT SUNGGUHAN
 * ============================================================================
 *
 * Halaman e-Court tidak pernah kami baca kodenya. Tombol verifikasi, tombol
 * TTE salinan, dan tombol "Upload Dokumen Salinan Putusan" dicari dari
 * TULISANNYA, di dalam bagian yang benar, dan HARUS tepat satu. Nol atau lebih
 * dari satu = berhenti tanpa menyentuh apa pun (tidak menebak). Semuanya dapat
 * ditimpa lewat variabel lingkungan ALETA_ECOURT_AKSI_* tanpa mengubah kode.
 * Sesudah menekan simpan, hasilnya DIBUKTIKAN dengan membaca ulang halaman -
 * bukan dianggap berhasil karena tombolnya sudah ditekan.
 *
 * ============================================================================
 * PASSPHRASE DAN SANDI
 * ============================================================================
 *
 * Passphrase TTE dan sandi e-Court hanya diketikkan ke kolom halaman e-Court.
 * Tidak dikembalikan, tidak disimpan, tidak masuk pesan galat: setiap pesan
 * yang keluar dari berkas ini disaring sapuRahasia() lebih dulu.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const scraper = require("../tools/ecourt-bridge/scraper");
const sesiEcourt = require("../tools/ecourt-bridge/sesi");
const kirimVerifikasi = require("../tools/ecourt-bridge/kirim-verifikasi");
const jedaManusia = require("./jedaManusiaService");

/** Penunjuk yang dapat ditimpa lewat lingkungan - lihat catatan kepala berkas. */
const POLA = {
  tombolVerifikasi: new RegExp(process.env.ALETA_ECOURT_AKSI_POLA_VERIFIKASI || "verifikasi", "i"),
  tombolTte: new RegExp(
    process.env.ALETA_ECOURT_AKSI_POLA_TTE || "(\\bTTE\\b|tanda\\s*tangan|tandatangan)",
    "i"
  ),
  tombolUnggah: new RegExp(
    process.env.ALETA_ECOURT_AKSI_POLA_UNGGAH || "upload\\s+dokumen\\s+salinan\\s+putusan",
    "i"
  ),
  tombolKirimDialog: new RegExp(
    process.env.ALETA_ECOURT_AKSI_POLA_KIRIM || "^(simpan|proses|kirim|upload|unggah|tandatangani|ttd|tte|submit|ok)\\b",
    "i"
  ),
};

const PENUNJUK_DIALOG =
  process.env.ALETA_ECOURT_AKSI_SEL_DIALOG || kirimVerifikasi.SELECTORS.dialog;

const BATAS_HALAMAN_MS = Number(process.env.ALETA_ECOURT_AKSI_BATAS_HALAMAN_MS || 60000);
const LOGIN_TTL_MS = Number(process.env.ALETA_ECOURT_AKSI_LOGIN_TTL_MS || 5 * 60 * 1000);

/**
 * Menghapus setiap kemunculan rahasia dari teks yang akan keluar.
 *
 * Dipakai pada SEMUA pesan galat dan cuplikan halaman yang dikembalikan
 * berkas ini. Pesan e-Court pun dapat memantulkan isian (mis. "passphrase
 * 'xxx' salah"), dan pantulan itu tidak boleh sampai ke log maupun layar.
 */
function sapuRahasia(teks, rahasia = []) {
  let hasil = String(teks || "");
  for (const r of rahasia) {
    const nilai = String(r || "");
    if (nilai.length >= 1) hasil = hasil.split(nilai).join("***");
  }
  return hasil.slice(0, 300);
}

function folderSementara() {
  const akar = path.join(sesiEcourt.sessionRoot(), "pengguna-tmp");
  const dir = path.join(akar, crypto.randomBytes(8).toString("hex"));
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

function hapusFolder(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* sudah tidak ada */
  }
}

async function luncurkan() {
  const puppeteer = require("puppeteer");
  const dir = folderSementara();
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: null,
    args: ["--no-sandbox"],
    userDataDir: dir,
    protocolTimeout: Number(process.env.ALETA_ECOURT_PROTOCOL_TIMEOUT_MS || 300000),
  });
  const page = (await browser.pages())[0] || (await browser.newPage());
  return { browser, page, dir };
}

async function tutup({ browser, dir }) {
  if (browser) await browser.close().catch(() => {});
  if (dir) hapusFolder(dir);
}

/** Seluruh cookie peramban, termasuk yang ber-httpOnly. */
async function ambilCookies(page) {
  try {
    const klien = await page.target().createCDPSession();
    const { cookies } = await klien.send("Network.getAllCookies");
    return (Array.isArray(cookies) ? cookies : []).filter((c) =>
      String(c.domain || "").replace(/^\./, "").toLowerCase().endsWith(new URL(scraper.BASE_URL).hostname)
    );
  } catch {
    return [];
  }
}

async function pasangCookies(page, cookies) {
  const daftar = (Array.isArray(cookies) ? cookies : [])
    .filter((c) => c && c.name)
    .map((c) => ({
      name: String(c.name),
      value: String(c.value || ""),
      domain: c.domain,
      path: c.path || "/",
      httpOnly: Boolean(c.httpOnly),
      secure: Boolean(c.secure),
      ...(c.expires && c.expires > 0 ? { expires: c.expires } : {}),
      ...(c.sameSite ? { sameSite: c.sameSite } : {}),
    }));
  if (daftar.length) await page.setCookie(...daftar);
}

/**
 * Membuka satu halaman perkara dengan sesi pengguna, menjalankan kerja(), lalu
 * menutup semuanya. Sesi yang ternyata habis dijawab { ok:false, alasan:
 * "sesi_habis" } dan kerja() tidak pernah dijalankan.
 */
async function denganHalamanPerkara({ cookies, alamatPerkara, rahasia = [] }, kerja) {
  if (!scraper.diDalamEcourt(alamatPerkara)) {
    return { ok: false, alasan: "alamat_perkara_di_luar_ecourt", cookies };
  }
  let alat = null;
  try {
    alat = await luncurkan();
    const { page } = alat;
    await pasangCookies(page, cookies);
    await page.goto(alamatPerkara, { waitUntil: "networkidle2", timeout: BATAS_HALAMAN_MS });
    const alamat = page.url();
    if (scraper.LOGIN_PATH_PATTERN.test(alamat) || scraper.isGateUrl(alamat)) {
      return { ok: false, alasan: "sesi_habis", cookies: [] };
    }
    const hasil = await kerja(page);
    const baru = await ambilCookies(page);
    return { ...hasil, cookies: baru.length ? baru : cookies };
  } catch (galat) {
    return {
      ok: false,
      alasan: `peramban_gagal: ${sapuRahasia(galat && galat.message, rahasia)}`,
      cookies,
    };
  } finally {
    if (alat) await tutup(alat);
  }
}

async function htmlHalaman(page) {
  return page.content();
}

/**
 * Menandai SATU elemen yang tulisannya cocok di dalam wadah yang dipilih, lalu
 * mengembalikan berapa yang cocok. Penandaan hanya terjadi bila tepat satu.
 */
async function tandaiTombol(page, { wadahSelector, wadahTeks, polaSumber, polaFlag, tanda }) {
  return page.evaluate(
    (opsi) => {
      const pola = new RegExp(opsi.polaSumber, opsi.polaFlag);
      let wadah = [];
      if (opsi.wadahSelector) {
        wadah = Array.from(document.querySelectorAll(opsi.wadahSelector));
      } else {
        wadah = [document.body];
      }
      if (opsi.wadahTeks) {
        // Elemen TERKECIL yang memuat teks itu - bukan seluruh halaman.
        const calon = Array.from(document.querySelectorAll("div, li, tr, td, section, article, table"))
          .filter((el) => (el.innerText || "").includes(opsi.wadahTeks))
          .filter((el) => el.querySelector("a, button, input[type=button], input[type=submit]"));
        calon.sort((a, b) => (a.innerText || "").length - (b.innerText || "").length);
        wadah = calon.slice(0, 1);
      }
      const temuan = [];
      for (const w of wadah) {
        for (const el of Array.from(w.querySelectorAll("a, button, input[type=button], input[type=submit]"))) {
          const teks = String(el.innerText || el.value || el.title || "").replace(/\s+/g, " ").trim();
          if (pola.test(teks) && !temuan.includes(el)) temuan.push(el);
        }
      }
      if (temuan.length === 1) temuan[0].setAttribute("data-pk-aksi", opsi.tanda);
      return temuan.length;
    },
    { wadahSelector, wadahTeks, polaSumber: polaSumber, polaFlag: polaFlag, tanda }
  );
}

async function tungguDialog(page) {
  try {
    await page.waitForSelector(PENUNJUK_DIALOG, { visible: true, timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

async function tutupDialog(page) {
  await page.keyboard.press("Escape").catch(() => {});
}

async function tekanKirimDialog(page) {
  const jumlah = await page.evaluate(
    (sel, sumber, flag) => {
      const dialog = document.querySelector(sel);
      if (!dialog) return 0;
      const pola = new RegExp(sumber, flag);
      const tombol = Array.from(dialog.querySelectorAll("button, input[type=submit], a.btn")).filter((el) =>
        pola.test(String(el.innerText || el.value || "").replace(/\s+/g, " ").trim())
      );
      if (tombol.length === 1) tombol[0].setAttribute("data-pk-aksi", "kirim-dialog");
      return tombol.length;
    },
    PENUNJUK_DIALOG,
    POLA.tombolKirimDialog.source,
    POLA.tombolKirimDialog.flags
  );
  if (jumlah !== 1) return { ok: false, alasan: jumlah === 0 ? "tombol_kirim_tidak_ditemukan" : "tombol_kirim_ganda" };
  // Jeda seperti manusia sebelum mengirim simpanan (butir 14, K4).
  await jedaManusia.jeda("simpan");
  await Promise.all([
    page.click('[data-pk-aksi="kirim-dialog"]'),
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: BATAS_HALAMAN_MS }).catch(() => null),
  ]);
  return { ok: true };
}

/** Pesan yang tampil sesudah kirim (alert/toast), sudah disapu rahasianya. */
async function pesanHalaman(page, rahasia) {
  const teks = await page
    .evaluate(() => {
      const el = document.querySelector(".alert, .toast, .swal2-html-container, .swal-text, .modal.show .modal-body");
      return el ? String(el.innerText || "") : "";
    })
    .catch(() => "");
  return sapuRahasia(teks.replace(/\s+/g, " ").trim(), rahasia);
}

// ===========================================================================
// LOGIN PRIBADI
// ===========================================================================

/** token -> { browser, page, dir, timer } */
const loginMenunggu = new Map();

function buangLogin(token) {
  const sesi = loginMenunggu.get(token);
  if (!sesi) return;
  loginMenunggu.delete(token);
  if (sesi.timer) clearTimeout(sesi.timer);
  void tutup(sesi);
}

async function mulaiLogin() {
  const ecourtLoginService = require("./ecourtLoginService");
  let alat = null;
  try {
    alat = await luncurkan();
    const { page } = alat;
    await page.goto(`${scraper.BASE_URL}/Login`, { waitUntil: "networkidle2", timeout: BATAS_HALAMAN_MS });
    const formulir = await page.evaluate(ecourtLoginService.bacaFormulirLogin);
    if (!formulir.adaSandi || !formulir.adaTombol) {
      await tutup(alat);
      return { ok: false, alasan: "formulir_login_tidak_dikenali", token: "", captcha: "" };
    }
    let captcha = "";
    const elemen = await page.$("img[src*='captcha' i], img[id*='captcha' i], img[class*='captcha' i]");
    if (elemen) {
      const potongan = await elemen.screenshot({ encoding: "base64" }).catch(() => "");
      if (potongan) captcha = `data:image/png;base64,${potongan}`;
    }
    const token = crypto.randomBytes(16).toString("hex");
    const timer = setTimeout(() => buangLogin(token), LOGIN_TTL_MS);
    if (typeof timer.unref === "function") timer.unref();
    loginMenunggu.set(token, { ...alat, timer });
    return { ok: true, alasan: "", token, captcha, adaCaptcha: formulir.adaCaptcha };
  } catch (galat) {
    if (alat) await tutup(alat);
    return { ok: false, alasan: `gagal_membuka: ${sapuRahasia(galat && galat.message)}`, token: "", captcha: "" };
  }
}

/**
 * Mengirim surel, sandi, dan captcha. Sandi hanya diketik ke kolom e-Court,
 * lalu seluruh peramban ditutup - menang atau kalah.
 */
async function kirimLogin(token, { email, sandi, captcha } = {}) {
  const ecourtLoginService = require("./ecourtLoginService");
  const sesi = loginMenunggu.get(String(token || ""));
  if (!sesi) return { ok: false, alasan: "sesi_login_kedaluwarsa" };
  const rahasia = [sandi];
  const { page } = sesi;
  try {
    await page.type('[data-pk="email"]', String(email || ""));
    await page.type('[data-pk="sandi"]', String(sandi || ""));
    if (captcha) await page.type('[data-pk="captcha"]', String(captcha)).catch(() => {});
    await Promise.all([
      page.click('[data-pk="tombol"]'),
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: BATAS_HALAMAN_MS }).catch(() => null),
    ]);
    await ecourtLoginService.lewatiGerbang(page);
    const alamat = page.url();
    let berhasil = scraper.isLoggedInUrl(alamat);
    if (!berhasil) {
      const masihDiLogin =
        scraper.LOGIN_PATH_PATTERN.test(alamat) || Boolean(await page.$('input[type="password"]').catch(() => null));
      berhasil = !masihDiLogin && !scraper.isGateUrl(alamat) && alamat.startsWith(scraper.BASE_URL);
    }
    if (!berhasil) return { ok: false, alasan: "login_ditolak_ecourt" };
    const namaAkun = await page.evaluate(ecourtLoginService.bacaNamaPengguna).catch(() => "");
    const cookies = await ambilCookies(page);
    if (!cookies.length) return { ok: false, alasan: "cookie_sesi_tidak_terbaca" };
    return { ok: true, alasan: "", namaAkun: sapuRahasia(namaAkun, rahasia), cookies };
  } catch {
    // Pesan puppeteer sengaja dibuang: halaman ini memuat kolom sandi.
    return { ok: false, alasan: "gagal_mengirim_formulir" };
  } finally {
    buangLogin(String(token || ""));
  }
}

/** Apakah cookie ini masih membuka e-Court? */
async function periksaSesi({ cookies }) {
  const ecourtLoginService = require("./ecourtLoginService");
  let alat = null;
  try {
    alat = await luncurkan();
    const { page } = alat;
    await pasangCookies(page, cookies);
    await page.goto(`${scraper.BASE_URL}/Login`, { waitUntil: "domcontentloaded", timeout: 20000 });
    const berlaku = scraper.isLoggedInUrl(page.url());
    const namaAkun = berlaku ? await page.evaluate(ecourtLoginService.bacaNamaPengguna).catch(() => "") : "";
    const baru = berlaku ? await ambilCookies(page) : [];
    return { ok: true, berlaku, namaAkun, cookies: baru.length ? baru : cookies };
  } catch (galat) {
    return { ok: false, alasan: `gagal_memeriksa: ${sapuRahasia(galat && galat.message)}`, berlaku: null, cookies };
  } finally {
    if (alat) await tutup(alat);
  }
}

// ===========================================================================
// MEMBACA, MENGUNDUH
// ===========================================================================

async function bacaPerkara({ cookies, alamatPerkara }) {
  return denganHalamanPerkara({ cookies, alamatPerkara }, async (page) => {
    const html = await htmlHalaman(page);
    return {
      ok: true,
      alasan: "",
      dokumenPersidangan: scraper.extractHearingDocuments(html),
      putusanEcourt: scraper.extractPutusanEcourt(html),
    };
  });
}

async function unduhDokumen({ cookies, alamatPerkara, judulDokumen, format = "pdf" }) {
  return denganHalamanPerkara({ cookies, alamatPerkara }, async (page) => {
    const html = await htmlHalaman(page);
    const dokumen = scraper
      .extractHearingDocuments(html)
      .filter((d) => String(d.judul || "").trim().toLowerCase() === String(judulDokumen || "").trim().toLowerCase());
    if (dokumen.length !== 1) {
      return { ok: false, alasan: dokumen.length === 0 ? "dokumen_tidak_ada_di_halaman" : "judul_dokumen_ganda" };
    }
    const tautan = dokumen[0].tautan.find((t) => t.format === format) || dokumen[0].tautan[0];
    if (!tautan) return { ok: false, alasan: "tautan_berkas_tidak_ada" };

    let alamat = tautan.url;
    if (!alamat && tautan.penanda) {
      const jawaban = await page.evaluate(
        async (t, i) => {
          try {
            const r = await fetch(`/ViewDoc/index/${t}/${i}`, {
              method: "POST",
              credentials: "include",
              headers: { "X-Requested-With": "XMLHttpRequest" },
            });
            if (!r.ok) return { ok: false, teks: "" };
            return { ok: true, teks: (await r.text()).slice(0, 200000) };
          } catch {
            return { ok: false, teks: "" };
          }
        },
        String(tautan.penanda.tipe),
        String(tautan.penanda.id)
      );
      const gali = scraper.alamatBerkasDariJawabanViewDoc(jawaban.teks);
      if (!gali.ok) return { ok: false, alasan: gali.alasan };
      alamat = gali.alamat;
    }
    if (!scraper.diDalamEcourt(alamat)) return { ok: false, alasan: "alamat_berkas_di_luar_ecourt" };

    const hasil = await page.evaluate(async (url) => {
      try {
        const r = await fetch(url, { credentials: "include" });
        if (!r.ok) return { ok: false, alasan: `HTTP ${r.status}` };
        const tipe = r.headers.get("content-type") || "";
        if (/text\/html/i.test(tipe)) return { ok: false, alasan: "bukan_berkas" };
        const bytes = new Uint8Array(await r.arrayBuffer());
        let biner = "";
        for (let i = 0; i < bytes.length; i += 8192) {
          biner += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
        }
        return { ok: true, base64: btoa(biner), tipe };
      } catch (e) {
        return { ok: false, alasan: "unduh_gagal" };
      }
    }, alamat);
    if (!hasil.ok) return { ok: false, alasan: hasil.alasan };
    return { ok: true, alasan: "", isi: Buffer.from(hasil.base64, "base64"), contentType: hasil.tipe };
  });
}

// ===========================================================================
// MENULIS - verifikasi, TTE salinan, unggah salinan
// ===========================================================================

async function verifikasi({ cookies, alamatPerkara, judulDokumen, keputusan, keterangan = "", kering = false }) {
  return denganHalamanPerkara({ cookies, alamatPerkara }, async (page) => {
    const jumlah = await tandaiTombol(page, {
      wadahTeks: String(judulDokumen || ""),
      polaSumber: POLA.tombolVerifikasi.source,
      polaFlag: POLA.tombolVerifikasi.flags,
      tanda: "verifikasi",
    });
    if (jumlah !== 1) {
      return { ok: false, alasan: jumlah === 0 ? "tombol_verifikasi_tidak_ditemukan" : "tombol_verifikasi_ganda" };
    }
    await jedaManusia.jeda("klik", { kering });
    await page.click('[data-pk-aksi="verifikasi"]');
    if (!(await tungguDialog(page))) return { ok: false, alasan: "dialog_verifikasi_tidak_muncul" };

    const dialog = await kirimVerifikasi.readDialog(page);
    const cocok = kirimVerifikasi.dialogMatchesDocument(dialog, { judul_dokumen: judulDokumen });
    if (!cocok.cocok) {
      await tutupDialog(page);
      return { ok: false, alasan: `dialog_tidak_cocok: ${cocok.alasan}` };
    }
    if (kering) {
      await tutupDialog(page);
      return { ok: true, alasan: "", kering: true, dialog: { namaDokumen: dialog.namaDokumen, pemilikDokumen: dialog.pemilikDokumen } };
    }

    await jedaManusia.jeda("isi");
    await page.evaluate(
      (sel, kep, ket) => {
        const d = document.querySelector(sel.dialog);
        if (!d) return;
        const radio = d.querySelector(kep === "valid" ? sel.radioValid : sel.radioTidakValid);
        if (radio) {
          radio.click();
          radio.dispatchEvent(new Event("change", { bubbles: true }));
        }
        const kotak = ket ? d.querySelector(sel.keterangan) : null;
        if (kotak) {
          kotak.value = ket;
          kotak.dispatchEvent(new Event("input", { bubbles: true }));
        }
      },
      kirimVerifikasi.SELECTORS,
      keputusan,
      String(keterangan || "").slice(0, 500)
    );
    const kirim = await tekanKirimDialog(page);
    if (!kirim.ok) {
      await tutupDialog(page);
      return kirim;
    }

    // Bukti: status dokumen di halaman yang dibaca ULANG.
    await page.reload({ waitUntil: "networkidle2", timeout: BATAS_HALAMAN_MS }).catch(() => null);
    const sesudah = scraper
      .extractHearingDocuments(await htmlHalaman(page))
      .find((d) => String(d.judul || "").trim().toLowerCase() === String(judulDokumen || "").trim().toLowerCase());
    const status = sesudah ? String(sesudah.statusMentah || "") : "";
    const terbukti = /tidak\s*valid|valid|terverifikasi|diverifikasi/i.test(status) && !/belum/i.test(status);
    return terbukti
      ? { ok: true, alasan: "", statusSesudah: status }
      : { ok: false, alasan: "verifikasi_belum_terbukti", statusSesudah: status, pesan: await pesanHalaman(page, []) };
  });
}

async function tteSalinan({ cookies, alamatPerkara, passphrase }) {
  const rahasia = [passphrase];
  return denganHalamanPerkara({ cookies, alamatPerkara, rahasia }, async (page) => {
    const jumlah = await tandaiTombol(page, {
      wadahSelector: "#detil_putusan",
      polaSumber: POLA.tombolTte.source,
      polaFlag: POLA.tombolTte.flags,
      tanda: "tte",
    });
    if (jumlah !== 1) return { ok: false, alasan: jumlah === 0 ? "tombol_tte_tidak_ditemukan" : "tombol_tte_ganda" };
    await jedaManusia.jeda("klik");
    await page.click('[data-pk-aksi="tte"]');
    if (!(await tungguDialog(page))) return { ok: false, alasan: "dialog_tte_tidak_muncul" };

    const kolom = await page.$$(`${PENUNJUK_DIALOG} input[type="password"]`);
    if (kolom.length !== 1) {
      await tutupDialog(page);
      return { ok: false, alasan: kolom.length === 0 ? "kolom_passphrase_tidak_ditemukan" : "kolom_passphrase_ganda" };
    }
    await jedaManusia.jeda("isi");
    await kolom[0].type(String(passphrase || ""));
    const kirim = await tekanKirimDialog(page);
    if (!kirim.ok) {
      await tutupDialog(page);
      return kirim;
    }
    const pesan = await pesanHalaman(page, rahasia);
    await page.reload({ waitUntil: "networkidle2", timeout: BATAS_HALAMAN_MS }).catch(() => null);
    const putusan = scraper.extractPutusanEcourt(await htmlHalaman(page));
    return putusan.panitera && putusan.panitera.sudahTte
      ? { ok: true, alasan: "", putusanEcourt: putusan }
      : { ok: false, alasan: "tte_belum_terbukti", pesan, putusanEcourt: putusan };
  });
}

async function unggahSalinan({ cookies, alamatPerkara, jalurBerkas }) {
  return denganHalamanPerkara({ cookies, alamatPerkara }, async (page) => {
    const jumlah = await tandaiTombol(page, {
      wadahSelector: "#detil_putusan",
      polaSumber: POLA.tombolUnggah.source,
      polaFlag: POLA.tombolUnggah.flags,
      tanda: "unggah",
    });
    if (jumlah !== 1) return { ok: false, alasan: jumlah === 0 ? "tombol_unggah_tidak_ditemukan" : "tombol_unggah_ganda" };
    await jedaManusia.jeda("klik");
    await page.click('[data-pk-aksi="unggah"]');
    if (!(await tungguDialog(page))) return { ok: false, alasan: "dialog_unggah_tidak_muncul" };
    const kolom = await page.$$(`${PENUNJUK_DIALOG} input[type="file"]`);
    if (kolom.length !== 1) {
      await tutupDialog(page);
      return { ok: false, alasan: kolom.length === 0 ? "kolom_berkas_tidak_ditemukan" : "kolom_berkas_ganda" };
    }
    await jedaManusia.jeda("unggah");
    await kolom[0].uploadFile(jalurBerkas);
    const kirim = await tekanKirimDialog(page);
    if (!kirim.ok) {
      await tutupDialog(page);
      return kirim;
    }
    const pesan = await pesanHalaman(page, []);
    await page.reload({ waitUntil: "networkidle2", timeout: BATAS_HALAMAN_MS }).catch(() => null);
    const putusan = scraper.extractPutusanEcourt(await htmlHalaman(page));
    return putusan.dokumenSalinan && putusan.dokumenSalinan.ada
      ? { ok: true, alasan: "", putusanEcourt: putusan }
      : { ok: false, alasan: "unggah_belum_terbukti", pesan, putusanEcourt: putusan };
  });
}

module.exports = {
  POLA,
  bacaPerkara,
  kirimLogin,
  mulaiLogin,
  periksaSesi,
  sapuRahasia,
  tteSalinan,
  unduhDokumen,
  unggahSalinan,
  verifikasi,
  batalLogin: buangLogin,
};
