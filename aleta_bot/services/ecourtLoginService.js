"use strict";

/**
 * Login e-Court dari portal, bukan dari terminal server.
 *
 * ============================================================================
 * MASALAH YANG DISELESAIKAN
 * ============================================================================
 *
 * Sebelum ini, login e-Court hanya bisa dilakukan di depan server: jembatan
 * membuka jendela peramban, dan petugas mengetik email, sandi, serta captcha
 * di sana. Lewat SSH itu merepotkan, dan bagi petugas yang tidak biasa dengan
 * terminal praktis tidak mungkin.
 *
 * Layanan ini memindahkan langkahnya ke portal: gambar captcha diambil dari
 * halaman e-Court lalu ditampilkan di portal, petugas mengisi formulir di sana,
 * dan bot yang meneruskannya ke e-Court.
 *
 * ============================================================================
 * SANDI DIPAKAI SEKALI LALU DIBUANG
 * ============================================================================
 *
 * Sandi e-Court TIDAK PERNAH:
 *   - disimpan ke database maupun berkas
 *   - dicatat ke log, termasuk log galat dan jejak keamanan
 *   - disimpan di memori lebih lama daripada satu percobaan login
 *
 * Yang bertahan setelah login hanyalah cookie sesi di folder profil peramban,
 * persis seperti ketika petugas login langsung di server. Cookie itu memang
 * setara "sedang login", dan folder profilnya sudah dijaga izin 0700 di luar
 * folder aplikasi.
 *
 * Perlu disadari: memindahkan login ke portal berarti sandi menempuh jalur
 * portal -> gerbang internal -> bot. Sebelumnya sandi tidak pernah meninggalkan
 * peramban di server. Ini pertukaran yang disengaja demi kemudahan, bukan
 * sesuatu yang luput.
 *
 * ============================================================================
 * CAPTCHA TETAP DIJAWAB MANUSIA
 * ============================================================================
 *
 * Layanan ini hanya MENERUSKAN gambar captcha ke layar petugas dan mengirimkan
 * jawaban petugas kembali. Tidak ada pemecah captcha, tidak ada pengenalan
 * gambar, tidak ada layanan pihak ketiga. Manusia tetap ada di setiap login,
 * hanya tidak perlu berada di depan server.
 */

const puppeteer = require("puppeteer");

const logService = require("./logService");
const ecourtKredensialService = require("./ecourtKredensialService");
const { readRuntimeConfig, writeRuntimeConfig } = require("../config/runtime-config");
const sesiEcourt = require("../tools/ecourt-bridge/sesi");
const scraper = require("../tools/ecourt-bridge/scraper");

/** Berapa lama formulir login dibiarkan terbuka sebelum ditutup sendiri. */
const LOGIN_TTL_MS = Number(process.env.ALETA_ECOURT_LOGIN_TTL_MS || 5 * 60 * 1000);

/**
 * Peramban yang sedang menunggu jawaban captcha.
 *
 * Hanya SATU yang boleh hidup pada satu waktu. Membiarkan banyak jendela
 * peramban menganggur di server akan menghabiskan memori tanpa ada yang
 * menyadarinya.
 */
let sesiAktif = null;

function bersihkanSesiAktif() {
  if (!sesiAktif) return;
  const { browser, timer } = sesiAktif;
  sesiAktif = null;
  if (timer) clearTimeout(timer);
  if (browser) {
    browser.close().catch(() => {
      /* peramban mungkin sudah tertutup sendiri */
    });
  }
}

/**
 * Menemukan kolom formulir tanpa bergantung pada nama yang ditebak.
 *
 * Penunjuk elemen e-Court tidak pernah kami baca dari kodenya - situs
 * pemerintah dapat berubah sewaktu-waktu. Karena itu kolomnya dicari dari
 * SIFATNYA: kolom bertipe password adalah kolom sandi, gambar yang alamatnya
 * memuat kata captcha adalah gambar captcha. Cara ini bertahan terhadap
 * perubahan nama kelas maupun id.
 */
function bacaFormulirLogin() {
  const cari = (kondisi) => Array.from(document.querySelectorAll("input")).find(kondisi) || null;

  const sandi = cari((el) => el.type === "password");
  const email =
    cari((el) => el.type === "email") ||
    cari((el) => /email|user|nama/i.test(`${el.name} ${el.id} ${el.placeholder}`) && el.type !== "password") ||
    cari((el) => el.type === "text");

  const gambarCaptcha = Array.from(document.querySelectorAll("img")).find((img) =>
    /captcha|kode|secure|verif/i.test(`${img.src} ${img.id} ${img.className} ${img.alt}`)
  );

  const isianCaptcha = cari(
    (el) =>
      el !== email &&
      el !== sandi &&
      el.type !== "hidden" &&
      /captcha|kode|code|verif/i.test(`${el.name} ${el.id} ${el.placeholder}`)
  );

  const tombol =
    document.querySelector('button[type="submit"], input[type="submit"]') ||
    Array.from(document.querySelectorAll("button")).find((b) => /login|masuk/i.test(b.innerText || ""));

  const tandai = (el, nama) => {
    if (el) el.setAttribute("data-aleta", nama);
    return Boolean(el);
  };

  return {
    adaEmail: tandai(email, "email"),
    adaSandi: tandai(sandi, "sandi"),
    adaCaptcha: tandai(isianCaptcha, "captcha"),
    adaTombol: tandai(tombol, "tombol"),
    alamatCaptcha: gambarCaptcha ? gambarCaptcha.src : "",
    // Dipakai portal untuk menjelaskan bila deteksi gagal.
    jumlahIsian: document.querySelectorAll("input").length,
  };
}

/**
 * Membaca nama pengguna yang sedang masuk dari halaman e-Court.
 *
 * ============================================================================
 * DIJALANKAN DI DALAM HALAMAN
 * ============================================================================
 *
 * Halaman e-Court menaruh nama penggunanya di tempat yang berbeda-beda antar
 * versi: pada bilah atas, pada menu profil, atau pada sapaan di dasbor. Karena
 * itu dicoba beberapa tempat berurutan, dan yang pertama masuk akal dipakai.
 *
 * Bila tidak satu pun ketemu, yang dikembalikan kosong - BUKAN tebakan. Nama
 * akun yang salah pada layar pengaturan lebih menyesatkan daripada tidak ada
 * nama sama sekali, sebab petugas memakainya untuk memutuskan akun mana yang
 * perlu dilogin ulang.
 */
function bacaNamaPengguna() {
  const bersih = (teks) =>
    String(teks || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);

  // Yang jelas bukan nama orang - jangan sampai "Logout" jadi nama akun.
  const bukanNama = (teks) =>
    !teks ||
    teks.length < 3 ||
    /^(logout|keluar|beranda|dashboard|home|menu|profil|profile)$/i.test(teks);

  const kandidat = [];

  // 1. Elemen yang memang menamai dirinya sebagai nama pengguna.
  for (const pemilih of [
    "[class*='user-name' i]",
    "[class*='username' i]",
    "[id*='user-name' i]",
    "[id*='username' i]",
    ".user-panel .info p",
    ".navbar .user a",
  ]) {
    const el = document.querySelector(pemilih);
    if (el) kandidat.push(bersih(el.innerText || el.textContent));
  }

  // 2. Sapaan pada dasbor.
  const badan = bersih(document.body ? document.body.innerText : "");
  const sapaan = badan.match(/(?:Selamat datang|Halo|Hai)[,:]?\s+([A-Za-z0-9@._\- ]{3,60})/i);
  if (sapaan) kandidat.push(bersih(sapaan[1]));

  // 3. Surel yang tertulis di halaman - kerap itulah identitas akunnya.
  const surel = badan.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  if (surel) kandidat.push(bersih(surel[0]));

  for (const nama of kandidat) {
    if (!bukanNama(nama)) return nama;
  }
  return "";
}
/**
 * Membuka halaman login dan mengambil gambar captchanya.
 *
 * @returns {Promise<{ ok: boolean, alasan: string, captcha: string, formulir: object }>}
 */
async function mulaiLogin({ slot = "" } = {}) {
  bersihkanSesiAktif();

  // Slot menentukan folder profil mana yang akan menerima sesinya. Salah slot
  // berarti petugas login ke akun yang keliru - dan sesi akun yang dimaksud
  // tetap mati. Slot diingat sampai captcha dijawab, lihat sesiAktif.
  const { opsi, sesi } = sesiEcourt.launchOptions({ headless: true, slot });
  if (!sesi.ok) {
    return { ok: false, alasan: `folder_sesi_gagal: ${sesi.alasan}`, captcha: "", formulir: null };
  }

  let browser;
  try {
    browser = await puppeteer.launch(opsi);
    const page = (await browser.pages())[0] || (await browser.newPage());
    await page.goto(`${scraper.BASE_URL}/Login`, { waitUntil: "networkidle2", timeout: 60000 });

    // Sesi lama mungkin masih berlaku: bila e-Court langsung mengalihkan ke
    // halaman setelah masuk, tidak perlu login sama sekali.
    if (scraper.isLoggedInUrl(page.url())) {
      await browser.close().catch(() => {});
      return { ok: true, alasan: "sudah_masuk", captcha: "", formulir: null };
    }

    const formulir = await page.evaluate(bacaFormulirLogin);
    if (!formulir.adaSandi || !formulir.adaTombol) {
      await browser.close().catch(() => {});
      return {
        ok: false,
        alasan: "formulir_login_tidak_dikenali",
        captcha: "",
        formulir,
      };
    }

    // Gambar captcha diambil sebagai potongan layar elemennya, bukan diunduh
    // ulang lewat alamatnya. Mengunduh ulang akan meminta captcha BARU dari
    // e-Court, sehingga yang tampil di portal berbeda dengan yang menunggu
    // jawaban di sesi ini - dan loginnya akan selalu gagal.
    let captcha = "";
    if (formulir.alamatCaptcha) {
      const elemen = await page.$("img[src*='captcha' i], img[id*='captcha' i], img[class*='captcha' i]");
      if (elemen) {
        const potongan = await elemen.screenshot({ encoding: "base64" }).catch(() => "");
        if (potongan) captcha = `data:image/png;base64,${potongan}`;
      }
    }

    const timer = setTimeout(() => {
      bersihkanSesiAktif();
    }, LOGIN_TTL_MS);
    if (typeof timer.unref === "function") timer.unref();

    // ======================================================================
    // MENGISI SUREL DAN SANDI SENDIRI, BILA TERSIMPAN
    // ======================================================================
    //
    // Diisi DI SINI, di dalam proses bot, bukan dikirim ke portal lalu
    // dikembalikan. Sandi tidak pernah melintasi jaringan ke peramban
    // petugas, dan tidak pernah muncul pada jawaban API mana pun.
    //
    // Yang tersisa untuk manusia hanyalah captcha - dan memang hanya itu yang
    // seharusnya tersisa.
    let terisiOtomatis = false;
    const tersimpan = ecourtKredensialService.ambil(slot);
    if (tersimpan) {
      try {
        await page.type('[data-aleta="email"]', tersimpan.email, { delay: 10 });
        await page.type('[data-aleta="sandi"]', tersimpan.sandi, { delay: 10 });
        terisiOtomatis = true;
      } catch {
        // Gagal mengetik bukan alasan membatalkan login: petugas tetap dapat
        // mengisinya sendiri. Sebabnya sengaja tidak dicatat - pesan galat
        // puppeteer dapat memuat potongan isi halaman.
        terisiOtomatis = false;
      }
    }

    sesiAktif = { browser, page, timer, dibukaPada: Date.now(), slotDipakai: slot, terisiOtomatis };

    return {
      ok: true,
      alasan: "",
      captcha,
      formulir,
      // Portal memakainya untuk menyembunyikan kotak surel dan sandi, dan
      // meminta captcha saja.
      terisiOtomatis,
      // Surel BOLEH dilihat - ia bukan rahasia, dan justru menolong petugas
      // memastikan akun yang benar yang sedang dilogin-kan. Sandi tidak.
      emailTerisi: terisiOtomatis && tersimpan ? tersimpan.email : "",
    };
  } catch (error) {
    if (browser) await browser.close().catch(() => {});
    return { ok: false, alasan: `gagal_membuka: ${error.message}`, captcha: "", formulir: null };
  }
}


/**
 * Melewati halaman gerbang /GateLogin.
 *
 * e-Court kadang menyelipkan halaman ini setelah email, sandi, dan captcha
 * diterima: "Anda sedang login di perangkat lain, Lanjut atau Batal?". Sesi
 * baru terbentuk setelah Lanjut ditekan. Selama halaman ini tidak dilewati,
 * login yang sebenarnya SUDAH benar akan selalu berakhir gagal.
 *
 * Yang ditekan HANYA tombol bertuliskan tepat "Lanjut". Batal tidak pernah
 * disentuh, dan tidak ada tombol lain di halaman ini yang ditekan. Bila tombol
 * itu tidak ditemukan, fungsi menyerah dan membiarkan pemeriksaan berikutnya
 * yang memutuskan - tidak menebak-nebak dengan menekan tombol lain.
 *
 * CATATAN OPERASIONAL: menekan Lanjut memutus sesi e-Court di perangkat lain.
 * Itu memang yang diminta halaman ini, dan petugas yang membuka login dari
 * portal sedang meminta sesi di server ini.
 */
async function lewatiGerbang(page) {
  if (!scraper.isGateUrl(page.url())) return false;

  const ditekan = await page
    .evaluate(() => {
      const kandidat = Array.from(
        document.querySelectorAll('button, a, input[type="submit"], input[type="button"]')
      );
      const tombol = kandidat.find((el) => {
        const teks = String(el.innerText || el.value || "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
        return teks === "lanjut";
      });
      if (!tombol) return false;
      tombol.click();
      return true;
    })
    .catch(() => false);

  if (!ditekan) return false;

  await page
    .waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 })
    .catch(() => null);

  return true;
}

/**
 * Mengirimkan email, sandi, dan jawaban captcha ke e-Court.
 *
 * Sandi TIDAK pernah keluar dari fungsi ini: tidak dikembalikan, tidak dicatat,
 * dan tidak disimpan di mana pun. Setelah page.type selesai, satu-satunya
 * tempat sandi itu berada adalah kolom formulir di halaman e-Court.
 *
 * @returns {Promise<{ ok: boolean, alasan: string }>}
 */
async function kirimLogin({ email, sandi, captcha } = {}) {
  if (!sesiAktif) {
    return { ok: false, alasan: "sesi_login_kedaluwarsa" };
  }
  const { page } = sesiAktif;

  // Formulir yang sudah terisi sendiri saat dibuka tidak perlu - dan tidak
  // boleh - diisi ulang: mengetik di atas isian yang ada menghasilkan sandi
  // sambungan yang pasti ditolak, dan percobaan berulang mengunci akun.
  const sudahTerisi = Boolean(sesiAktif.terisiOtomatis);
  if (!sudahTerisi && (!email || !sandi)) {
    return { ok: false, alasan: "email_atau_sandi_kosong" };
  }

  try {
    if (!sudahTerisi) {
      await page.type('[data-aleta="email"]', String(email), { delay: 20 });
      await page.type('[data-aleta="sandi"]', String(sandi), { delay: 20 });
    }
    if (captcha) {
      await page.type('[data-aleta="captcha"]', String(captcha), { delay: 20 }).catch(() => {
        /* sebagian halaman login tidak memakai captcha */
      });
    }

    await Promise.all([
      page.click('[data-aleta="tombol"]'),
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 }).catch(() => null),
    ]);

    // Menentukan berhasil atau tidak memakai DUA tanda, bukan satu.
    //
    // Sebelumnya hanya alamat halaman yang diperiksa, terhadap daftar tetap
    // (pendaftaran, dashboard, home). Bila e-Court mendaratkan petugas di
    // alamat di luar daftar itu, login yang SUDAH BERHASIL dibaca sebagai
    // gagal - dan tidak ada jalan keluarnya: mengulang dengan sandi yang benar
    // pun akan gagal lagi dengan cara yang sama.
    //
    // Tanda kedua lebih tahan terhadap perubahan tampilan e-Court: selama
    // kolom sandi masih ada di halaman, kita masih di halaman login, berarti
    // memang belum masuk. Kalau kolom itu sudah tidak ada dan alamatnya masih
    // di dalam e-Court serta bukan halaman login, itu sudah masuk.
    // Halaman gerbang dilewati LEBIH DULU, sebelum apa pun dinilai.
    // /GateLogin tidak memuat kolom sandi, jadi tanpa langkah ini tanda
    // kedua di bawah akan menyimpulkan sudah masuk - padahal sesinya belum
    // terbentuk, dan kegagalannya baru ketahuan saat jembatan dijalankan.
    const lewatGerbang = await lewatiGerbang(page);

    const alamat = page.url();
    let berhasil = scraper.isLoggedInUrl(alamat);

    if (!berhasil) {
      const masihDiLogin =
        scraper.LOGIN_PATH_PATTERN.test(alamat) ||
        Boolean(await page.$('input[type="password"]').catch(() => null));
      berhasil = !masihDiLogin && !scraper.isGateUrl(alamat) && alamat.startsWith(scraper.BASE_URL);
    }

    // Alamat pendaratan dicatat TANPA query, karena query dapat memuat token
    // sesi. Yang dibutuhkan untuk menelusuri hanyalah jalurnya.
    let jalurMendarat = "";
    try {
      jalurMendarat = new URL(alamat).pathname;
    } catch {
      jalurMendarat = "";
    }

    // Jejak keamanan mencatat PERISTIWANYA, bukan siapa yang login dengan
    // sandi apa. Email pun tidak disertakan: yang perlu diketahui adalah
    // bahwa sebuah sesi e-Court dibuka dari portal, dan kapan.
    void logService.logSecurityEvent({
      eventType: berhasil ? "ecourt_login_berhasil" : "ecourt_login_gagal",
      severity: "warning",
      message: berhasil
        ? "Sesi e-Court dibuka lewat portal."
        : "Percobaan login e-Court lewat portal gagal.",
      metadata: { jalur: "portal", berhasil, jalurMendarat, lewatGerbang },
    });

    if (berhasil) {
      // Nama pengguna dibaca SELAGI halamannya masih terbuka. Sesudah
      // peramban ditutup, membacanya menuntut membuka peramban lagi - dan
      // itulah pemeriksaan lambat yang justru sedang dihindari.
      const namaPengguna = await page.evaluate(bacaNamaPengguna).catch(() => "");
      if (namaPengguna) catatNamaPengguna(sesiAktif.slotDipakai || "", namaPengguna);

      // Peramban ditutup agar cookie tersimpan ke folder profil. Sesi yang
      // tersimpan itulah yang dipakai jembatan pada penjalanan berikutnya.
      bersihkanSesiAktif();
      return { ok: true, alasan: "", namaPengguna };
    }

    // Gagal: captcha biasanya sudah hangus, jadi sesinya ditutup dan petugas
    // memulai dari awal dengan captcha baru. Membiarkannya terbuka hanya
    // menghasilkan percobaan kedua yang pasti gagal.
    bersihkanSesiAktif();
    // Jalurnya disertakan supaya kegagalan dapat ditelusuri tanpa menebak.
    // Tanpa ini yang sampai ke petugas hanyalah "login ditolak" - padahal
    // sebabnya bisa jadi bukan sandinya, melainkan halaman yang tidak dikenali.
    return {
      ok: false,
      alasan: scraper.isGateUrl(alamat)
        ? "gerbang_ecourt_tidak_terlewati"
        : jalurMendarat
          ? `login_ditolak_ecourt: ${jalurMendarat}`
          : "login_ditolak_ecourt",
    };
  } catch (error) {
    bersihkanSesiAktif();
    // Pesan galat sengaja tidak diteruskan apa adanya: pesan dari puppeteer
    // dapat memuat potongan isi halaman, dan halaman login memuat kolom sandi.
    return { ok: false, alasan: "gagal_mengirim_formulir" };
  }
}

/**
 * Nama pengguna yang terakhir terbaca pada tiap slot.
 *
 * Disimpan pada runtime config supaya bertahan antar penyalaan ulang bot -
 * dan supaya pemeriksaan mode cepat, yang tidak membuka peramban sama sekali,
 * tetap dapat menyebutkan akun mana yang tersimpan.
 *
 * Yang disimpan hanya NAMA. Bukan surel yang dipakai login, bukan sandi.
 */
function catatNamaPengguna(slot, nama) {
  const kunci = sesiEcourt.bersihkanSlot(slot);
  const bersih = String(nama || "").trim().slice(0, 120);
  if (!kunci || !bersih) return;

  try {
    const sekarang = readRuntimeConfig() || {};
    const peta = { ...(sekarang.ecourtNamaAkun || {}) };
    if (peta[kunci] === bersih) return;
    peta[kunci] = bersih;
    writeRuntimeConfig({ ...sekarang, ecourtNamaAkun: peta });
  } catch {
    // Gagal mencatat nama bukan alasan menggagalkan pemeriksaan sesi.
  }
}

/** Nama yang pernah tercatat untuk satu slot, atau kosong. */
function namaTersimpan(slot) {
  const kunci = sesiEcourt.bersihkanSlot(slot);
  if (!kunci) return "";
  try {
    const peta = (readRuntimeConfig() || {}).ecourtNamaAkun || {};
    return String(peta[kunci] || "");
  } catch {
    return "";
  }
}
/** Apakah ada sesi e-Court tersimpan, dan apakah masih berlaku? */
async function periksaSesi({ cepat = true, slot = "" } = {}) {
  const ada = sesiEcourt.sessionExists(slot);
  if (!ada) {
    return { tersimpan: false, berlaku: false, alasan: "belum_pernah_login", namaPengguna: "", diperiksaPada: "" };
  }
  if (cepat) {
    return {
      tersimpan: true,
      berlaku: null,
      alasan: "belum_diperiksa",
      namaPengguna: namaTersimpan(slot),
      diperiksaPada: "",
    };
  }

  const { opsi, sesi } = sesiEcourt.launchOptions({ headless: true, slot });
  if (!sesi.ok) return { tersimpan: true, berlaku: null, alasan: "folder_sesi_gagal" };

  let browser;
  try {
    browser = await puppeteer.launch(opsi);
    const page = (await browser.pages())[0] || (await browser.newPage());

    // ======================================================================
    // MENUNGGU DOM, BUKAN MENUNGGU JARINGAN SEPI
    // ======================================================================
    //
    // Yang ditanya pemeriksaan ini cuma satu: e-Court mengalihkan kita ke
    // halaman login atau tidak. Jawabannya sudah pasti begitu alamat akhirnya
    // diketahui - jauh sebelum seluruh gambar dan skrip halaman selesai.
    //
    // networkidle2 menunggu jaringan sepi dua detik. Pada halaman e-Court yang
    // ramai itu kerap 15-30 detik, dan selama itu layar pengaturan tampak
    // membeku. domcontentloaded menjawab pertanyaan yang sama dalam hitungan
    // detik.
    await page.goto(`${scraper.BASE_URL}/Login`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    const alamatSesi = page.url();
    const berlaku = scraper.isLoggedInUrl(alamatSesi);

    // Nama pengguna hanya dibaca bila memang sudah masuk. Membacanya di
    // halaman login hanya akan memungut tulisan lain di halaman itu.
    let namaPengguna = "";
    if (berlaku) {
      namaPengguna = await page.evaluate(bacaNamaPengguna).catch(() => "");
    }

    // Mendarat di gerbang BUKAN berarti sesi kedaluwarsa: sesinya ada,
    // e-Court hanya menuntut penegasan karena akun dipakai di perangkat
    // lain. Menyebutnya kedaluwarsa mengirim petugas mengulang login yang
    // sebenarnya tidak perlu.
    //
    // Tombol Lanjut sengaja TIDAK ditekan di sini. Ini pemeriksaan keadaan,
    // dan memeriksa keadaan tidak boleh memutus sesi orang di perangkat
    // lain. Penegasan itu hanya dilakukan saat petugas benar-benar meminta
    // login dari portal.
    const diGerbang = scraper.isGateUrl(alamatSesi);
    await browser.close().catch(() => {});

    // Nama yang terbaca disimpan supaya layar pengaturan tetap dapat
    // menyebutkan akun mana yang tersimpan, walau pemeriksaan berikutnya
    // dijalankan dalam mode cepat.
    if (berlaku && namaPengguna) catatNamaPengguna(slot, namaPengguna);

    return {
      tersimpan: true,
      berlaku: diGerbang ? null : berlaku,
      alasan: berlaku ? "" : diGerbang ? "gerbang_menunggu_penegasan" : "sesi_kedaluwarsa",
      namaPengguna: namaPengguna || namaTersimpan(slot),
      diperiksaPada: new Date().toISOString(),
    };
  } catch (error) {
    if (browser) await browser.close().catch(() => {});
    return {
      tersimpan: true,
      berlaku: null,
      alasan: `gagal_memeriksa: ${error.message}`,
      namaPengguna: namaTersimpan(slot),
      diperiksaPada: "",
    };
  }
}

/** Menghapus sesi tersimpan. Inilah "logout" yang sesungguhnya. */
function keluar({ slot = "" } = {}) {
  bersihkanSesiAktif();
  const hasil = sesiEcourt.clearSession(slot);

  void logService.logSecurityEvent({
    eventType: "ecourt_sesi_dihapus",
    severity: "warning",
    message: "Sesi e-Court tersimpan dihapus dari portal.",
    metadata: { jalur: "portal", berhasil: hasil.ok },
  });

  return hasil;
}

/** Apakah sedang ada formulir login yang menunggu jawaban? */
function sedangMenunggu() {
  return Boolean(sesiAktif);
}

module.exports = {
  LOGIN_TTL_MS,
  catatNamaPengguna,
  namaTersimpan,
  bersihkanSesiAktif,
  keluar,
  kirimLogin,
  mulaiLogin,
  periksaSesi,
  sedangMenunggu,
};
