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

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const scraper = require("./scraper");
const sesiEcourt = require("./sesi");
const navigasi = require("./navigasi");
const arsipService = require("../../services/ecourtArsipService");
const ecourtStoreService = require("../../services/ecourtStoreService");
const putusanEcourtService = require("../../services/putusanEcourtService");
const ecourtDocumentService = require("../../services/ecourtDocumentService");
const berkasIntegritasService = require("../../services/berkasIntegritasService");
const sippReadOnlyBridgeService = require("../../services/sippReadOnlyBridgeService");
const {
  caseNumberToFolder,
  cleanText,
  normalizeCaseNumber,
  safeFileName,
} = require("../../services/ecourtTextService");

/** Berapa lama menunggu petugas menyelesaikan login manual. */
/**
 * Kode keluar proses.
 *
 * 0 = selesai, 1 = gagal, 2 = sesi e-Court habis, 3 = ruang disk menipis.
 *
 * Kode 2 dibedakan supaya penjadwal tahu bahwa yang dibutuhkan adalah login
 * manusia, bukan mencoba lagi. Mencoba lagi dengan sesi mati tidak akan
 * pernah berhasil, dan setiap percobaan tercatat di sisi e-Court.
 */
let KODE_KELUAR = 0;

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
  const args = {
    maksPerkara: 0,
    tanpaUnduh: false,
    headless: false,
    lupakanSesi: false,
    terjadwal: false,
    // Menarik satu perkara tertentu, apa pun urutannya di SIPP.
    perkara: "",
    // Memaksa memeriksa ulang walau berkasnya sudah lengkap.
    paksaUlang: false,
    // Kosong berarti slot bawaan - lihat sesi.js.
    akun: "",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--maks-perkara") args.maksPerkara = Number(argv[++i]) || 0;
    // Nomor perkara ATAU nomor register - keduanya diterima, karena
    // petugas menghafal nomor perkara sedangkan e-Court memakai nomor
    // register, dan memaksa satu di antaranya hanya menyusahkan.
    else if (item === "--perkara") args.perkara = String(argv[++i] || "").trim();
    else if (item === "--paksa-ulang") args.paksaUlang = true;
    // Slot akun e-Court. Tiap akun punya folder profil sendiri; tanpa ini,
    // seluruh akun berbagi satu profil dan saling menimpa sesinya.
    else if (item === "--akun") args.akun = String(argv[++i] || "").trim();
    else if (item === "--tanpa-unduh") args.tanpaUnduh = true;
    else if (item === "--lupakan-sesi") args.lupakanSesi = true;
    // Mode terjadwal: tanpa jendela peramban, dan TIDAK menunggu login manual.
    else if (item === "--terjadwal") {
      args.terjadwal = true;
      args.headless = true;
    }
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
 * Menukar penanda dokumen menjadi alamat berkas sungguhan.
 *
 * ============================================================================
 * UNDUHAN E-COURT BERJALAN DUA LANGKAH
 * ============================================================================
 *
 * Tautan "Lihat Dokumen" pada halaman detail ber-href "#". Yang menjalankannya
 * adalah JavaScript, dan yang terjadi sebenarnya:
 *
 *   1. POST /ViewDoc/index/<tipe>/<id>   dengan X-Requested-With: XMLHttpRequest
 *      -> jawabannya memuat alamat berkas di /storage/...
 *   2. GET alamat itu -> barulah berkasnya
 *
 * Selama ini jembatan hanya mengerjakan langkah kedua, dengan alamat yang
 * diambil dari href - yaitu "#", yang oleh peramban diresolusi menjadi alamat
 * halaman yang sedang dibuka. Maka yang "terunduh" adalah halaman detail dalam
 * bentuk HTML, dan itu dilaporkan sebagai "sesi habis" - padahal sesinya sehat.
 *
 * PERMINTAAN INI TIDAK MENGUBAH APA PUN
 *
 * Namanya POST, tetapi tanpa badan permintaan sama sekali (Content-Length: 0).
 * Ia hanya menanyakan di mana berkas disimpan. Tidak ada verifikasi yang
 * dibatalkan, tidak ada sidang yang dihapus, tidak ada tombol yang ditekan -
 * dan halaman detail tetap tidak pernah disentuh dengan klik.
 */
async function alamatBerkasDariViewDoc(page, tipe, id) {
  const jawaban = await page.evaluate(
    async (t, i) => {
      try {
        const respons = await fetch(`/ViewDoc/index/${t}/${i}`, {
          method: "POST",
          credentials: "include",
          headers: { "X-Requested-With": "XMLHttpRequest" },
        });
        if (!respons.ok) return { ok: false, reason: `HTTP ${respons.status}` };
        return { ok: true, teks: (await respons.text()).slice(0, 4000) };
      } catch (error) {
        return { ok: false, reason: String(error && error.message ? error.message : error) };
      }
    },
    String(tipe),
    String(id)
  );

  if (!jawaban.ok) return { ok: false, reason: jawaban.reason };

  // Alamat diambil dari jawaban apa adanya. Jawabannya kadang berupa alamat
  // telanjang, kadang terbungkus HTML - keduanya tertangkap oleh pola ini.
  const cocok = String(jawaban.teks).match(/https?:\/\/[^\s"'<>\\]+\/storage\/[^\s"'<>\\]+/i);
  if (!cocok) {
    const cuplikan = String(jawaban.teks).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
    return { ok: false, reason: `alamat_berkas_tidak_ditemukan: ${cuplikan}` };
  }

  const alamat = cocok[0];

  // Alamat HARUS tetap di dalam e-Court. Jawaban yang mengarahkan ke tempat
  // lain tidak diikuti: ia akan membawa sesi login pengadilan ke luar.
  if (!alamat.startsWith(scraper.BASE_URL)) {
    return { ok: false, reason: "alamat_berkas_di_luar_ecourt" };
  }

  return { ok: true, alamat };
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
      if (/text\/html/i.test(tipe)) {
        // Jawaban HTML punya LEBIH DARI SATU sebab, dan menyebut hanya satu
        // di antaranya menyesatkan. Sesi habis memang salah satunya, tetapi
        // alamat yang ternyata halaman pembuka dokumen - bukan berkasnya
        // langsung - menghasilkan gejala yang sama persis. Karena itu yang
        // dilaporkan adalah APA YANG DITERIMA, bukan tebakan sebabnya.
        const cuplikan = (await respons.text().catch(() => ""))
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 120);
        const halamanLogin = /login|masuk|sign in/i.test(cuplikan);
        return {
          ok: false,
          reason: halamanLogin
            ? `sesi_habis (${tipe})`
            : `bukan_berkas (${tipe}): ${cuplikan}`,
        };
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

  // Berkas TIDAK langsung ditulis ke tujuannya. Isinya dihitung sidik jarinya
  // lebih dulu, karena nama berkasnya memuat sidik jari itu - dan karena
  // berkas yang isinya sudah pernah tersimpan tidak perlu ditulis dua kali.
  const isi = Buffer.from(hasil.base64, "base64");
  const sidikJari = crypto.createHash("sha256").update(isi).digest("hex");
  return { ok: true, isi, sidikJari, size: isi.length, contentType: hasil.contentType };
}

/**
 * Menyimpan satu berkas dan mencatatnya.
 *
 * Nama berkas memuat delapan huruf pertama sidik jarinya. Dua manfaat
 * sekaligus: dokumen pengganti menghasilkan nama berbeda sehingga versi lama
 * tidak tertimpa, dan berkas yang isinya sama persis tidak tersimpan dua kali.
 */
async function simpanBerkas({ folder, judul, format, unduh, documentKey, nomorPerkara, sumberUrl }) {
  const ekstensi = guessExtension(sumberUrl, unduh.contentType);
  const nama = safeFileName(`${judul || "dokumen"}__${unduh.sidikJari.slice(0, 8)}`, ekstensi);
  const target = path.join(folder, nama);

  // ==========================================================================
  // BERKASNYA DITULIS LEBIH DULU, CATATANNYA MENYUSUL
  // ==========================================================================
  //
  // Urutannya dulu terbalik, dan itulah sebab keluhan "statusnya terunduh
  // tetapi berkasnya tidak ada". Catatan disimpan lebih dulu - lengkap dengan
  // jalur berkas pada catatan dokumen, yang membuat panel menyatakan berkasnya
  // ada - lalu penulisannya gagal: cakram penuh, izin folder, nama terlalu
  // panjang. Yang tersisa adalah catatan tentang berkas yang tidak pernah ada.
  //
  // Lebih buruk lagi, kekeliruan itu MENGUNCI DIRINYA SENDIRI. Penarikan
  // berikutnya mengunduh isi yang sama, sidik jarinya sama, barisnya sudah ada
  // - maka recordFile menjawab "bukan baru" dan penulisannya dilewati lagi.
  // Tidak ada penarikan keberapa pun yang akan membetulkannya.
  //
  // Karena itu sekarang: tulis dulu, catat sesudah berhasil. Dan penulisannya
  // dikerjakan setiap kali berkasnya TIDAK ADA di disk - bukan hanya ketika
  // catatannya baru - sehingga berkas yang hilang terisi kembali dengan
  // sendirinya pada penarikan berikutnya.
  // Kecuali satu hal: isi yang dihapus masa simpan tidak boleh ditulis kembali.
  // Halaman e-Court tidak tahu apa-apa tentang masa simpan kita dan tetap
  // menyajikan berkasnya; tanpa pemeriksaan ini, penarikan berikutnya akan
  // mengisi ulang persis apa yang baru saja sengaja dikosongkan.
  if (await ecourtStoreService.dihapusKarenaRetensi(documentKey, unduh.sidikJari)) {
    return { baru: false, sudahAda: true, dihapusRetensi: true, nama, target, ditulis: false };
  }

  let ditulis = false;
  if (!fs.existsSync(target)) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, unduh.isi);
    ditulis = true;
  }

  const catatan = await ecourtStoreService.recordFile({
    documentKey,
    nomorPerkara,
    format,
    jalurBerkas: target,
    sidikJari: unduh.sidikJari,
    ukuranByte: unduh.size,
    tipeIsi: unduh.contentType,
    sumberUrl,
  });

  return { ...catatan, nama, target, ditulis };
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


/**
 * Acuan perkara e-Court menurut SIPP.
 *
 * ============================================================================
 * SIPP MENENTUKAN APA YANG SEHARUSNYA ADA
 * ============================================================================
 *
 * Jembatan mengambil perkara dari tautan yang kebetulan ada di halaman
 * e-Court. Itu berarti tidak ada yang tahu apa yang SEHARUSNYA ditemukan -
 * kalau satu perkara tidak muncul di halaman itu, ia terlewat diam-diam dan
 * tidak ada satu pun angka yang berubah.
 *
 * Acuan ini membalik arahnya. SIPP - sistem resmi pengadilan - yang menyatakan
 * perkara mana saja terdaftar lewat e-Court, lengkap dengan nomor registernya.
 * Hasil kikisan lalu dicocokkan ke daftar itu, dan yang tidak ketemu dilaporkan
 * sebagai selisih, bukan dibiarkan hilang.
 *
 * GAGAL-TERBUKA, BUKAN GAGAL-TERTUTUP
 *
 * Bila SIPP tidak terbaca, jembatan TETAP berjalan seperti sebelumnya. Acuan
 * ini memperkaya, bukan menjadi syarat: menolak menarik dokumen hanya karena
 * SIPP sedang tidak terjangkau berarti dokumen yang tenggatnya besok tidak
 * sampai ke pihak - kerugian yang jauh lebih besar daripada kehilangan
 * pelaporan selisih untuk satu putaran.
 */

let acuanSipp = null;

/** Menyamakan penulisan nomor perkara agar dapat dipadankan. */
function kunciPerkara(nomor) {
  return String(nomor || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9./-]/g, "");
}

async function muatAcuanSipp(maksPerkara) {
  const kosong = {
    aktif: false,
    alasan: "",
    perkara: new Map(),
    belumTerlihat: new Set(),
    pendaftaranGanda: 0,
    // Diisi sapuan daftar. Tetap ada walau sapuan tidak jadi berjalan,
    // supaya pemakainya tidak perlu memeriksa keberadaannya.
    petaAlamat: new Map(),
  };

  try {
    const hasil = await sippReadOnlyBridgeService.safeHandleBridgeOperation("ecourt.caseList", {
      limit: Math.max(Number(maksPerkara) || 0, 200),
    });

    if (!hasil.ok || !hasil.data) {
      log(`  Acuan SIPP tidak terbaca (${hasil.error || "jawaban kosong"}). Jembatan tetap berjalan.`);
      return { ...kosong, alasan: String(hasil.error || "jawaban_kosong") };
    }

    const peta = new Map();
    for (const perkara of hasil.data.perkara || []) {
      const kunci = kunciPerkara(perkara.nomorPerkara);
      if (kunci) peta.set(kunci, perkara);
    }

    log(
      `Acuan SIPP: ${peta.size} perkara e-Court` +
        (hasil.data.pendaftaranGanda > 0
          ? ` (${hasil.data.pendaftaranGanda} pendaftaran lama diabaikan, dipakai yang terbaru)`
          : "")
    );

    return {
      aktif: true,
      alasan: "",
      perkara: peta,
      belumTerlihat: new Set(peta.keys()),
      pendaftaranGanda: hasil.data.pendaftaranGanda || 0,
      petaAlamat: new Map(),
    };
  } catch (error) {
    log(`  Acuan SIPP gagal dimuat (${error.message}). Jembatan tetap berjalan.`);
    return { ...kosong, alasan: String(error.message || error) };
  }
}

/**
 * Memadankan satu perkara hasil kikisan ke catatan SIPP.
 *
 * Mengembalikan identitas SIPP bila ketemu, dan mencatat selisih bila nomor
 * register hasil kikisan berbeda dari yang tercatat SIPP - itu berarti salah
 * satu dari keduanya keliru, dan keduanya dipakai untuk mengirim dokumen ke
 * pihak berperkara.
 */
function padankan(acuan, nomorPerkara, registrasiEcourt, ringkasan) {
  if (!acuan.aktif) return { perkaraId: null, nomorRegister: "" };

  const kunci = kunciPerkara(nomorPerkara);
  const catatan = acuan.perkara.get(kunci);

  if (!catatan) {
    ringkasan.tidakAdaDiSipp.push(nomorPerkara);
    return { perkaraId: null, nomorRegister: "" };
  }

  acuan.belumTerlihat.delete(kunci);

  const dariHalaman = String(registrasiEcourt || "").trim().toUpperCase();
  const dariSipp = String(catatan.nomorRegister || "").trim().toUpperCase();
  if (dariHalaman && dariSipp && dariHalaman !== dariSipp) {
    ringkasan.registerBerbeda.push({
      nomorPerkara,
      dariHalaman,
      dariSipp,
    });
  }

  return { perkaraId: catatan.perkaraId, nomorRegister: catatan.nomorRegister };
}


/**
 * Mengumpulkan alamat detail perkara yang perlu diperiksa.
 *
 * ============================================================================
 * SIPP MENENTUKAN APA, E-COURT MENENTUKAN DI MANA
 * ============================================================================
 *
 * SIPP tahu perkara mana saja yang terdaftar e-Court beserta nomor
 * registernya, tetapi tidak tahu alamat halamannya - alamat e-Court berupa
 * blob terenkripsi yang tidak dapat disusun. Halaman daftar e-Court tahu
 * alamatnya, tetapi tidak tahu mana yang penting.
 *
 * Jadi keduanya dipertemukan: daftar disapu sekali per kategori untuk
 * mendapatkan peta nomor_register -> alamat, lalu SIPP yang memilih mana yang
 * dibuka.
 *
 * GAGAL-TERBUKA
 *
 * Bila menu tidak terbaca, atau acuan SIPP tidak tersedia, fungsi ini
 * mengembalikan senarai kosong dan pemanggil kembali ke perilaku lama:
 * mengambil tautan apa pun yang ada di halaman saat itu. Penarikan yang
 * kurang lengkap jauh lebih baik daripada tidak menarik apa pun - dokumen
 * yang tenggatnya besok tetap harus sampai ke pihak.
 */
async function kumpulkanTautan(page, acuan, ringkasan) {
  if (!acuan.aktif || acuan.perkara.size === 0) return [];

  const menu = await navigasi.bacaMenuDaftarPerkara(page);
  if (menu.size === 0) {
    log("  Menu Daftar Perkara tidak terbaca. Kembali ke cara lama.");
    return [];
  }

  // Kategori yang benar-benar dibutuhkan saja. Membuka menu Jinayat pada
  // pengadilan yang tidak punya perkara jinayat hanya membebani server MA.
  const kategori = new Map();
  for (const perkara of acuan.perkara.values()) {
    const kunci = navigasi.menuUntukAlur(perkara.alurKode, perkara.alurNama);
    if (!kunci) continue;
    if (!kategori.has(kunci)) kategori.set(kunci, 0);
    kategori.set(kunci, kategori.get(kunci) + 1);
  }

  if (kategori.size === 0) {
    log("  Tidak ada kategori yang dapat ditentukan dari SIPP. Kembali ke cara lama.");
    return [];
  }

  const petaRegister = new Map();
  for (const [kunci, jumlah] of kategori.entries()) {
    const alamat = navigasi.pilihTautanMenu(menu, kunci);
    if (!alamat) {
      log(`  Menu "${kunci}" tidak ada di e-Court, dilewati (${jumlah} perkara SIPP).`);
      continue;
    }

    log(`  Menyapu daftar "${kunci}" (${jumlah} perkara menurut SIPP)...`);
    try {
      await page.goto(alamat, { waitUntil: "networkidle2", timeout: 60000 });
      await sleep(PAGE_DELAY_MS);
      const peta = await navigasi.sapuDaftar(page, (pesan) => log(pesan));
      for (const [register, url] of peta.entries()) {
        const kunciRegister = String(register || "").toUpperCase();
        if (kunciRegister && !petaRegister.has(kunciRegister)) petaRegister.set(kunciRegister, url);
      }
    } catch (error) {
      log(`  Gagal menyapu daftar "${kunci}": ${error.message}`);
      ringkasan.jumlahGalat += 1;
    }
  }

  // Disimpan pada acuan supaya penarikan tertarget dapat memakainya tanpa
  // menyapu ulang daftar e-Court untuk kedua kalinya.
  acuan.petaAlamat = petaRegister;

  if (petaRegister.size === 0) {
    log("  Sapuan daftar tidak menghasilkan apa pun. Kembali ke cara lama.");
    return [];
  }

  // SIPP yang memilih, dan urutannya mengikuti urutan SIPP - perkara terbaru
  // lebih dulu, karena itu yang paling mungkin punya dokumen baru.
  const tautan = [];
  // Alamat e-Court buram, jadi nomor perkaranya hanya diketahui dari acuan
  // SIPP. Dipetakan di sini supaya perkara yang sudah lengkap dapat dilewati
  // TANPA membuka halamannya lebih dulu.
  const petaNomor = new Map();
  for (const perkara of acuan.perkara.values()) {
    const register = String(perkara.nomorRegister || "").toUpperCase();
    if (!register) continue;
    const url = petaRegister.get(register);

    // Perkara yang alamatnya ketemu di sapuan berarti MEMANG ADA di e-Court,
    // walau belum tentu sempat diperiksa pada putaran ini. Membiarkannya
    // tercatat sebagai "tidak ditemukan" mencampuradukkan dua hal yang sangat
    // berbeda: perkara yang benar-benar hilang dari e-Court, dan perkara yang
    // sekadar belum giliran. Yang pertama perlu ditindaklanjuti; yang kedua
    // akan terambil sendiri pada putaran berikutnya.
    if (url) acuan.belumTerlihat.delete(kunciPerkara(perkara.nomorPerkara));
    if (url) {
      tautan.push(url);
      petaNomor.set(url, perkara.nomorPerkara);
    }
  }

  // Ditetapkan SETELAH petanya terisi. Menetapkannya lebih awal membuat
  // rujukan ke variabel yang belum ada, dan itu melempar saat dijalankan.
  acuan.petaNomor = petaNomor;

  log(
    `  Sapuan selesai: ${petaRegister.size} perkara di e-Court, ` +
      `${tautan.length} cocok dengan acuan SIPP.`
  );
  return tautan;
}

/** Memproses satu halaman detail perkara. */
async function processCase(page, url, ringkasan, args, acuan) {
  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(PAGE_DELAY_MS);

  const html = await page.content();
  const detail = scraper.parseCaseDetail(html);

  if (!detail.nomorPerkara) {
    // Sesi yang habis di tengah putaran membuat SETIAP halaman berikutnya
    // menjadi halaman login - dan tanpa nomor perkara di dalamnya. Tanpa
    // pemeriksaan ini, jembatan melaporkan "nomor perkara tidak ditemukan"
    // ratusan kali berturut-turut sambil terus menghantam server Mahkamah
    // Agung tanpa hasil apa pun. Itu persis perilaku yang membuat akun
    // ditandai, dan sudah terjadi: 130 perkara diminta setelah sesi mati.
    if (scraper.LOGIN_PATH_PATTERN.test(page.url()) || /id="captchaimage"|Login Page/i.test(html)) {
      throw Object.assign(new Error("sesi_ecourt_habis_di_tengah_putaran"), { sesiHabis: true });
    }

    log("  Nomor perkara tidak ditemukan di halaman ini, dilewati.");
    ringkasan.jumlahGalat += 1;
    return;
  }

  log(`  Perkara ${detail.nomorPerkara} (${detail.dokumenPersidangan.length} dokumen persidangan, ${detail.dokumenPendaftaran.length} berkas pendaftaran)`);
  // Identitas resmi dari SIPP, bukan tebakan dari teks halaman.
  const identitas = padankan(acuan, detail.nomorPerkara, detail.registrasiEcourt, ringkasan);

  // ==================================================================
  // PERSETUJUAN SALURAN DAN PANGGILAN e-SUMMONS
  // ==================================================================
  //
  // Keduanya berada di halaman yang SAMA yang sudah diunduh untuk dokumen -
  // tidak ada satu pun permintaan tambahan ke Mahkamah Agung untuk ini.
  //
  // Gagal-terbuka: keduanya keterangan pelengkap. Kegagalan menyimpannya
  // tidak boleh menggagalkan penarikan dokumen, yang justru pekerjaan
  // utamanya.
  if (Array.isArray(detail.persetujuanPihak) && detail.persetujuanPihak.length > 0) {
    await ecourtStoreService
      .recordPersetujuanPihak(detail.nomorPerkara, detail.persetujuanPihak)
      .catch((galat) => log(`  Persetujuan pihak gagal disimpan: ${galat.message}`));
  }

  if (Array.isArray(detail.panggilanElektronik) && detail.panggilanElektronik.length > 0) {
    await ecourtStoreService
      .recordPanggilanElektronik(detail.nomorPerkara, detail.panggilanElektronik)
      .catch((galat) => log(`  Panggilan e-Summons gagal disimpan: ${galat.message}`));
  }

  // Keadaan tab Putusan SELALU disimpan - termasuk saat tabnya kosong atau
  // tidak ada sama sekali. Justru keadaan itulah yang perlu diketahui:
  // perkara yang sudah diputus di SIPP tetapi tidak punya baris putusan di
  // e-Court tidak memberi tanda apa pun kepada siapa pun.
  //
  // Karena itu penjagaannya bukan "bila ada isinya", melainkan "bila halaman
  // detailnya memang terbaca".
  if (detail.putusanEcourt) {
    await putusanEcourtService
      .simpan(detail.nomorPerkara, detail.putusanEcourt)
      .catch((galat) => log(`  Keadaan putusan e-Court gagal disimpan: ${galat.message}`));
  }

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
    ...detail.dokumenPersidangan.map((item) => ({ ...item, sumber: "persidangan", perluVerifikasi: true })),
    ...detail.dokumenPendaftaran.map((item) => ({
      judul: item.judul,
      jenis: "",
      peranPengunggah: "",
      emailPengunggah: "",
      diunggahPada: null,
      statusMentah: "",
      // Berkas pendaftaran TIDAK mengenal verifikasi majelis di e-Court:
      // tidak ada tombolnya di halaman, dan tidak ada majelis yang
      // menunggunya. Tanpa penanda ini, seluruhnya tercatat "belum" dan
      // ikut terhitung sebagai pekerjaan majelis yang tidak pernah ada.
      perluVerifikasi: false,
      unduhUrl: item.url,
      // Berkas pendaftaran memakai penanda yang sama dengan dokumen
      // persidangan, dan formatnya sudah ditentukan dari judulnya.
      unduhPenanda: item.penanda || null,
      unduhFormat: item.format || "pdf",
      sumber: "pendaftaran",
    })),
  ];

  // ==========================================================================
  // DUA DOKUMEN YANG BERBAGI SATU KUNCI
  // ==========================================================================
  //
  // Kunci dokumen disusun dari nomor perkara, judul, email pengunggah, dan
  // waktu unggah sampai satuan MENIT. Dua dokumen e-Court yang berbeda dapat
  // menghasilkan kunci yang sama persis:
  //
  //   - berkas pendaftaran berjudul sama - "bukti surat" dua lembar, lazim
  //     ketika satu pihak mengunggah beberapa bukti sekaligus. Berkas
  //     pendaftaran tidak punya email maupun waktu unggah, jadi yang tersisa
  //     hanya judulnya.
  //   - dokumen persidangan dari pihak yang sama, berjudul sama, terunggah
  //     dalam menit yang sama.
  //
  // Akibatnya dulu: yang pertama diunduh dan dicatat; yang kedua ditolak
  // pemeriksa ulang - "baru saja diperiksa" - lalu dilewati SELURUHNYA.
  // Berkasnya tidak pernah sampai ke server, dan tidak ada angka yang berubah.
  // Pada putaran berikutnya kejadiannya berulang, selamanya.
  //
  // Yang dikerjakan di sini: dokumen kedua yang berbagi kunci TETAP diunduh.
  // Berkasnya disimpan per sidik jari, jadi keduanya duduk berdampingan di
  // arsip meskipun catatan dokumennya satu.
  const kunciTerpakai = new Set();

  for (const dokumen of semua) {
    ringkasan.dokumenTerlihat += 1;

    const documentKey = ecourtStoreService.buildDocumentKey({
      nomorPerkara: detail.nomorPerkara,
      judulDokumen: dokumen.judul,
      emailPengunggah: dokumen.emailPengunggah,
      diunggahPada: dokumen.diunggahPada,
    });
    const kunciBerulang = kunciTerpakai.has(documentKey);
    kunciTerpakai.add(documentKey);

    // Dokumen persidangan kini punya DUA tautan - PDF dan Word. Dokumen
    // pendaftaran hanya satu.
    const tautanMentah = Array.isArray(dokumen.tautan) && dokumen.tautan.length > 0
      ? dokumen.tautan
      : dokumen.unduhUrl || dokumen.unduhPenanda
        ? [{
            url: dokumen.unduhUrl || "",
            format: dokumen.unduhFormat || "pdf",
            penanda: dokumen.unduhPenanda || null,
          }]
        : [];

    // ======================================================================
    // WORD LEBIH DULU, LALU PDF - KEDUANYA TETAP DIUNDUH
    // ======================================================================
    //
    // Yang dikehendaki pengadilan: bila satu dokumen tersedia dalam dua
    // bentuk dan hanya satu yang dapat diambil, yang tersimpan adalah Word.
    // Urutan inilah yang menjadikannya begitu tanpa mengorbankan yang lain -
    // keduanya tetap dicoba, dan yang gagal tidak menghentikan yang berikutnya.
    //
    // Urutan ini juga yang lebih mungkin berhasil. Word membawa alamatnya
    // sendiri; PDF baru berupa penanda yang harus ditukar dulu lewat ViewDoc,
    // satu langkah tambahan yang punya sebab kegagalannya sendiri. Mencoba
    // yang berpeluang lebih besar lebih dulu berarti putaran yang terputus di
    // tengah - sesi habis, waktu putaran lewat - meninggalkan berkas yang
    // dapat dibuka, bukan tidak meninggalkan apa-apa.
    //
    // Pengurutannya stabil, jadi bila ada beberapa berkas sejenis urutan
    // aslinya tidak teracak.
    const tautan = [...tautanMentah].sort(
      (a, b) => (a.format === "word" ? 0 : 1) - (b.format === "word" ? 0 : 1)
    );

    // Pemeriksaan ulang menargetkan dokumen yang PALING mungkin diganti:
    // yang belum diverifikasi majelis. Yang sudah diverifikasi diperiksa jauh
    // lebih jarang, sehingga arsip tidak ditarik ulang seluruhnya tiap putaran.
    let perluPeriksa = true;
    try {
      perluPeriksa = await ecourtStoreService.needsRecheck(
        documentKey,
        ecourtStoreService.normalizeStatus(dokumen.statusMentah, {
          perluVerifikasi: dokumen.perluVerifikasi !== false,
        })
      );

      // Jeda pemeriksaan ulang dihitung dari WAKTU PERIKSA, dan itu benar
      // selama berkasnya memang ada. Bila yang tercatat ternyata tidak ada di
      // disk, menunggu jedanya berarti membiarkan lubang itu sampai enam jam -
      // atau tujuh hari bagi dokumen yang sudah diverifikasi. Berkas yang
      // hilang selalu diperiksa ulang sekarang juga.
      if (!perluPeriksa) {
        const tercatat = await ecourtStoreService.jalurBerkasTercatat(documentKey);
        const hilang = tercatat.filter((jalur) => !fs.existsSync(jalur));
        if (hilang.length > 0) {
          log(`    Berkas tercatat tetapi tidak ada di disk (${hilang.length}), ditarik ulang.`);
          perluPeriksa = true;
        }
      }
    } catch {
      perluPeriksa = true;
    }

    // Kunci yang berulang tidak boleh ikut aturan jeda: yang "baru saja
    // diperiksa" adalah dokumen SEBELUMNYA, bukan yang ini.
    if (kunciBerulang) {
      log(`    "${dokumen.judul}" berbagi kunci dengan dokumen sebelumnya - berkasnya tetap diunduh.`);
      perluPeriksa = true;
    }

    // ======================================================================
    // DOKUMEN YANG TERLIHAT TETAPI TIDAK PUNYA SATU PUN TAUTAN
    // ======================================================================
    //
    // Ini keluhan "sudah terdeteksi ada berkasnya, tetapi tidak diunduh".
    // Barisnya terbaca dari halaman, judulnya terbaca, pengunggahnya terbaca -
    // lalu tercatat sebagai dokumen tanpa satu berkas pun, DIAM-DIAM. Tidak ada
    // baris log, tidak ada hitungan galat, dan ringkasan penarikan tetap
    // tampak bersih.
    //
    // Sebabnya bisa bermacam-macam - tautannya berbentuk yang belum dikenali,
    // atau memang belum ada di halaman - dan tidak satu pun dapat ditelusuri
    // bila kejadiannya tidak pernah disebut. Maka disebut.
    if (!args.tanpaUnduh && perluPeriksa && tautan.length === 0) {
      log(`    Tidak ada tautan berkas untuk "${dokumen.judul}" (${dokumen.sumber}), tidak ada yang dapat diunduh.`);
      ringkasan.jumlahGalat += 1;
      ringkasan.galatTerakhir = `${dokumen.judul}: tautan berkas tidak ditemukan di halaman`;
    }

    // ======================================================================
    // DOKUMEN YANG BERULANG GAGAL DIISTIRAHATKAN
    // ======================================================================
    //
    // Sebagian dokumen memang tidak akan pernah dapat diunduh. Mencobanya lagi
    // tiap putaran memakan jatah, membebani server Mahkamah Agung dengan
    // permintaan yang sudah pasti gagal, dan menenggelamkan kegagalan BARU di
    // antara kegagalan yang sama berulang-ulang.
    //
    // Sesudah tiga kali gagal beruntun ia diistirahatkan sehari, lalu dicoba
    // lagi sekali - e-Court dapat memperbaiki berkasnya kapan saja tanpa
    // memberi tahu. Satu keberhasilan mengembalikan hitungannya ke nol.
    let karantina = { karantina: false };
    if (!args.tanpaUnduh && perluPeriksa && tautan.length > 0) {
      karantina = await ecourtStoreService.berkasDikarantina(documentKey).catch(() => ({
        karantina: false,
      }));
      if (karantina.karantina) {
        log(
          `    "${dokumen.judul}" diistirahatkan - ${karantina.gagal}x gagal beruntun` +
            `${karantina.sebab ? ` (${karantina.sebab})` : ""}, dicoba lagi ${karantina.jamLagi} jam lagi.`
        );
        ringkasan.berkasDikarantina = (ringkasan.berkasDikarantina || 0) + 1;
      }
    }

    if (!args.tanpaUnduh && perluPeriksa && tautan.length > 0 && !karantina.karantina) {
      // Kegagalan dicatat SESUDAH seluruh tautan dicoba, bukan pada tiap
      // kegagalan. Satu dokumen punya dua bentuk - PDF dan Word - dan gagal
      // pada salah satunya bukan berarti dokumennya tidak dapat diambil.
      let adaYangBerhasil = false;
      let sebabGagalTerakhir = "";
      for (const item of tautan) {
        try {
          // PDF hanya punya PENANDA, belum alamat. Alamatnya ditanyakan dulu
          // lewat ViewDoc; Word sudah membawa alamatnya sendiri.
          let alamatBerkas = item.url;
          if (!alamatBerkas && item.penanda) {
            const tukar = await alamatBerkasDariViewDoc(page, item.penanda.tipe, item.penanda.id);
            if (!tukar.ok) {
              log(`    Gagal cari alamat ${item.format} "${dokumen.judul}": ${tukar.reason}`);
              ringkasan.jumlahGalat += 1;
              ringkasan.galatTerakhir = `${dokumen.judul}: ${tukar.reason}`;
              sebabGagalTerakhir = String(tukar.reason || "alamat tidak ketemu");
              continue;
            }
            alamatBerkas = tukar.alamat;
          }

          if (!alamatBerkas) {
            // Dilewati TETAPI dihitung. Sebelumnya hanya dicatat di log lalu
            // lewat begitu saja, sehingga penarikan yang meninggalkan puluhan
            // dokumen tanpa berkas tetap berakhir dengan nol galat.
            log(`    Tidak ada alamat untuk ${item.format} "${dokumen.judul}", dilewati.`);
            ringkasan.jumlahGalat += 1;
            ringkasan.galatTerakhir = `${dokumen.judul}: alamat berkas ${item.format} tidak diketahui`;
            sebabGagalTerakhir = `alamat berkas ${item.format} tidak diketahui`;
            continue;
          }

          const unduh = await downloadFile(page, alamatBerkas, null);
          if (!unduh.ok) {
            log(`    Gagal unduh ${item.format} "${dokumen.judul}": ${unduh.reason}`);
            ringkasan.jumlahGalat += 1;
            ringkasan.galatTerakhir = `${dokumen.judul}: ${unduh.reason}`;
            sebabGagalTerakhir = String(unduh.reason || "gagal diunduh");
            continue;
          }

          // ================================================================
          // ISINYA DIPERIKSA SEBELUM DISIMPAN, BUKAN SESUDAHNYA
          // ================================================================
          //
          // Tipe-isi text/html sudah ditolak di downloadFile, tetapi itu tidak
          // menutup semuanya: jawaban ber-tipe benar dengan tubuh halaman
          // galat, jawaban terpotong, dan jawaban kosong semuanya lolos.
          //
          // Menyimpannya berarti mencatat perkara itu SUDAH LENGKAP, sehingga
          // penarikan berikutnya melewatinya - dan kerusakannya baru ketahuan
          // saat ada yang membukanya, kadang berbulan kemudian.
          const periksa = berkasIntegritasService.periksaIsi(unduh.isi, { format: item.format });
          if (!periksa.ok) {
            log(`    Berkas ditolak ${item.format} "${dokumen.judul}": ${periksa.alasan}`);
            ringkasan.jumlahGalat += 1;
            ringkasan.galatTerakhir = `${dokumen.judul}: ${periksa.alasan}`;
            sebabGagalTerakhir = String(periksa.alasan || "isi berkas ditolak");
            continue;
          }

          const simpan = await simpanBerkas({
            folder,
            judul: dokumen.judul,
            format: item.format,
            unduh,
            documentKey,
            nomorPerkara: detail.nomorPerkara,
            sumberUrl: alamatBerkas,
          });

          // Sampai di sini berarti berkasnya benar-benar ada di tangan -
          // termasuk bila isinya sama dengan yang sudah tersimpan. Itu sudah
          // cukup untuk menghapus riwayat kegagalan dokumen ini.
          adaYangBerhasil = true;

          if (simpan.dihapusRetensi) {
            // Sengaja dikosongkan masa simpan. Bukan berkas hilang, dan tidak
            // boleh ditulis kembali.
            ringkasan.berkasTidakBerubah += 1;
          } else if (simpan.baru) {
            ringkasan.berkasTerunduh += 1;
            log(`    Terunduh ${item.format}: ${simpan.nama} (${Math.round(unduh.size / 1024)} KB)`);
          } else if (simpan.ditulis) {
            // Catatannya sudah ada, berkasnya yang tidak. Inilah lubang yang
            // dulu tidak pernah tertutup sendiri.
            ringkasan.berkasTerunduh += 1;
            log(`    Diisi ulang ${item.format}: ${simpan.nama} (${Math.round(unduh.size / 1024)} KB)`);
          } else {
            ringkasan.berkasTidakBerubah += 1;
          }
        } catch (error) {
          log(`    Gagal unduh ${item.format} "${dokumen.judul}": ${error.message}`);
          ringkasan.jumlahGalat += 1;
          ringkasan.galatTerakhir = error.message;
          sebabGagalTerakhir = String(error.message || "gagal diunduh");
        }
        await sleep(PAGE_DELAY_MS);
      }

      // Hitungan kegagalan diperbarui SEKALI, sesudah seluruh bentuk berkas
      // dicoba. Satu keberhasilan - PDF atau Word, mana pun - mengembalikannya
      // ke nol; gagal seluruhnya menambah hitungannya beserta sebab terakhir.
      if (adaYangBerhasil) {
        await ecourtStoreService.resetGagalBerkas(documentKey).catch(() => {});
      } else if (sebabGagalTerakhir) {
        await ecourtStoreService.catatGagalBerkas(documentKey, sebabGagalTerakhir).catch(() => {});
      }
    }

    try {
      const hasil = await ecourtStoreService.recordDocument({
        documentKey,
        nomorPerkara: detail.nomorPerkara,
        registrasiEcourt: detail.registrasiEcourt,
        perkaraId: identitas.perkaraId,
        nomorRegister: identitas.nomorRegister,
        judulDokumen: dokumen.judul,
        jenisDokumen: dokumen.jenis,
        peranPengunggah: dokumen.peranPengunggah,
        emailPengunggah: dokumen.emailPengunggah,
        diunggahPada: dokumen.diunggahPada,
        statusVerifikasi: ecourtStoreService.normalizeStatus(dokumen.statusMentah, {
          perluVerifikasi: dokumen.perluVerifikasi !== false,
        }),
        agenda: agendaTerakhir,
        batasUnggah: batasTerakhir ? batasTerakhir.batasWaktu : null,
        batasUnggahTeks: batasTerakhir ? batasTerakhir.batasWaktuTeks : "",
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
    const hasil = sesiEcourt.clearSession(args.akun);
    log(hasil.ok ? "Sesi tersimpan dihapus. Login berikutnya dari awal." : `Gagal menghapus sesi: ${hasil.alasan}`);
  }

  // PENJAGAAN RUANG DISK, sebelum satu berkas pun diunduh.
  //
  // Disk penuh di server pengadilan tidak hanya menghentikan ALETA - ia
  // menghentikan MySQL, dan itu menghentikan SIPP. Berhenti lebih awal jauh
  // lebih murah daripada memulihkannya.
  if (!args.tanpaUnduh) {
    const izin = await arsipService.bolehMenarik();
    if (!izin.boleh) {
      log(`Penarikan dibatalkan: ${izin.alasan}`);
      log("Kosongkan ruang disk atau turunkan ambangnya di portal, lalu jalankan lagi.");
      KODE_KELUAR = 3;
      return;
    }
    log(`Sisa ruang disk: ${izin.ruang.bebasGb} GB.`);
  }

  log("Membuka peramban e-Court...");
  // Profil peramban yang bertahan: selama sesi e-Court belum kedaluwarsa,
  // penjalanan berikutnya langsung masuk tanpa login ulang. Captcha tetap
  // diisi manusia - yang disimpan adalah hasil login petugas sendiri.
  const { opsi, sesi } = sesiEcourt.launchOptions({
    headless: args.headless === true,
    slot: args.akun,
  });
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
    berkasTidakBerubah: 0,
    berkasTerunduh: 0,
    jumlahGalat: 0,
    galatTerakhir: "",
    // Selisih dengan SIPP. Kosong berarti seluruh perkara yang tercatat SIPP
    // benar-benar ditemukan di e-Court dengan nomor register yang sama.
    tidakAdaDiSipp: [],
    registerBerbeda: [],
    tidakDitemukanDiEcourt: [],
    // Ketemu di e-Court tetapi belum giliran diperiksa. BUKAN selisih data.
    tertundaKarenaBatas: 0,
    perkaraDilewati: 0,
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

    // Mode terjadwal TIDAK PERNAH menunggu login manusia.
    //
    // Tidak ada manusia di depan layar saat penjadwal berjalan, jadi menunggu
    // sepuluh menit hanya menahan peramban tanpa hasil. Yang benar adalah
    // berhenti segera dan meminta petugas login dari portal.
    //
    // Mencoba terus dengan sesi mati ke sistem Mahkamah Agung juga persis
    // perilaku yang membuat akun ditandai.
    if (args.terjadwal) {
      if (!scraper.isLoggedInUrl(page.url())) {
        ringkasan.status = "sesi_habis";
        ringkasan.galatTerakhir = "sesi e-Court kedaluwarsa; perlu login dari portal";
        log("Sesi e-Court sudah habis. Penjadwal berhenti, tidak mencoba lagi.");
        KODE_KELUAR = 2;
        return;
      }
      log("Sesi tersimpan masih berlaku.");
    } else {
      const masuk = await waitForManualLogin(page);
      if (!masuk) {
        ringkasan.status = "gagal";
        ringkasan.galatTerakhir = "login manual tidak selesai sebelum batas waktu";
        log("Login tidak selesai sebelum batas waktu. Sinkronisasi dibatalkan.");
        return;
      }
    }

    // Dimuat SEBELUM halaman dibaca, supaya jumlah perkara yang seharusnya
    // ada sudah diketahui bahkan bila e-Court tidak menampilkan satu pun.
    const acuan = await muatAcuanSipp(args.maksPerkara);

    log("Membuka daftar perkara...");

    // Jalan utama: SIPP menentukan perkara mana, sapuan daftar e-Court
    // menentukan alamatnya. Mengembalikan kosong bila salah satunya tidak
    // tersedia - dan jalan lama di bawah yang mengambil alih.
    let tautan = await kumpulkanTautan(page, acuan, ringkasan);

    if (tautan.length === 0) {
      const html = await page.content();
      tautan = scraper.extractCaseLinks(html);
    }

    if (tautan.length === 0) {
      log("Tidak ada tautan perkara di halaman ini.");

      // Mode terjadwal TIDAK BOLEH menunggu tombol Enter.
      //
      // Penjadwal menjalankan berkas ini sebagai proses anak dengan stdin
      // ditutup (stdio "ignore"), sehingga Enter tidak akan pernah datang.
      // Menunggunya membuat proses menggantung selamanya - dan karena
      // penjadwal menandai putaran sebagai "sedang jalan" sampai anaknya
      // keluar, SELURUH putaran berikutnya ikut dilewati permanen dengan
      // alasan "putaran sebelumnya belum selesai". Satu halaman kosong
      // mematikan penarikan berkala untuk seterusnya, tanpa pesan galat.
      if (args.terjadwal) {
        log("Mode terjadwal: tidak ada yang dapat ditanya. Putaran diakhiri.");
        ringkasan.status = "selesai";
        ringkasan.galatTerakhir = "daftar perkara kosong pada halaman pendaratan";
        return;
      }

      log("Buka menu Daftar Perkara / E-Filing di peramban, lalu tekan Enter di sini.");
      await new Promise((resolve) => process.stdin.once("data", resolve));
      tautan = scraper.extractCaseLinks(await page.content());
    }

    // Penarikan tertarget: satu perkara sesuai permintaan, apa pun urutannya
    // di SIPP. Tanpa ini, perkara lama tidak akan pernah terjaring - daftar
    // SIPP diurutkan dari yang terbaru, sehingga perkara yang sudah bersidang
    // dan justru punya dokumen persidangan selalu berada jauh di belakang.
    if (args.perkara) {
      const dicari = kunciPerkara(args.perkara);
      const target = [...acuan.perkara.values()].find(
        (p) =>
          kunciPerkara(p.nomorPerkara) === dicari ||
          String(p.nomorRegister || "").toUpperCase() === args.perkara.toUpperCase()
      );

      if (!target) {
        log(`Perkara "${args.perkara}" tidak ada pada acuan SIPP.`);
        ringkasan.status = "selesai";
        ringkasan.galatTerakhir = "perkara yang diminta tidak ada di acuan SIPP";
        return;
      }

      const alamat = (acuan.petaAlamat || new Map()).get(
        String(target.nomorRegister || "").toUpperCase()
      );
      if (!alamat) {
        log(`Perkara ${target.nomorPerkara} (${target.nomorRegister}) tidak ketemu di daftar e-Court.`);
        ringkasan.status = "selesai";
        ringkasan.tidakDitemukanDiEcourt = [target.nomorPerkara];
        return;
      }

      log(`Penarikan tertarget: ${target.nomorPerkara} (${target.nomorRegister}).`);
      tautan = [alamat];
    }

    // ========================================================================
    // YANG SUDAH LENGKAP DISINGKIRKAN SEBELUM DIBATASI, BUKAN SESUDAH
    // ========================================================================
    //
    // Penjadwal memeriksa 25 perkara tiap putaran - batas yang benar, sebab
    // bebannya ada di server Mahkamah Agung. Tetapi pembatasannya dulu
    // dikerjakan pada daftar MENTAH: dua puluh lima tautan PERTAMA menurut
    // urutan halaman e-Court, apa pun keadaannya. Perkara yang berkasnya sudah
    // lengkap tetap memakan jatah - dilewati murah, ya, tetapi jatahnya
    // terpakai.
    //
    // Akibatnya, begitu 25 perkara teratas lengkap, tiap putaran menghabiskan
    // seluruh jatahnya untuk melewati perkara yang sudah beres, dan perkara
    // ke-26 dan seterusnya TIDAK PERNAH tersentuh penjadwal. Perkara lama yang
    // baru menerima Jawaban duduk jauh di bawah pada daftar yang terurut
    // menurut pendaftaran - dan justru itu yang tenggatnya berjalan.
    //
    // Sekarang penyaringan dikerjakan lebih dulu, sehingga dua puluh lima itu
    // seluruhnya diberikan kepada perkara yang memang perlu diperiksa, dan
    // sapuannya maju dari putaran ke putaran.
    if (!args.paksaUlang && acuan.petaNomor && acuan.petaNomor.size > 0) {
      const perluDiperiksa = [];
      for (const url of tautan) {
        const nomorTarget = acuan.petaNomor.get(url);
        if (!nomorTarget) {
          // Tidak dikenali acuan SIPP: tidak dapat dinilai, jadi diperiksa.
          perluDiperiksa.push(url);
          continue;
        }
        let lengkap = false;
        try {
          lengkap = await ecourtStoreService.perkaraSudahLengkap(nomorTarget);
        } catch {
          lengkap = false;
        }
        if (lengkap) {
          ringkasan.perkaraDilewati += 1;
          continue;
        }
        perluDiperiksa.push(url);
      }
      if (ringkasan.perkaraDilewati > 0) {
        log(`${ringkasan.perkaraDilewati} perkara berkasnya sudah lengkap, tidak dibuka.`);
      }

      // ======================================================================
      // GILIRAN: YANG PALING LAMA MENUNGGU DIDAHULUKAN
      // ======================================================================
      //
      // Menyaring yang sudah lengkap saja belum cukup. Perkara yang berkasnya
      // TIDAK PERNAH dapat dilengkapi - dokumen yang tautannya tidak dikenali,
      // berkas yang selalu gagal diunduh - tetap tidak lengkap selamanya, dan
      // pada urutan pendaftaran ia duduk di depan terus. Jatah tiap putaran
      // habis untuk perkara yang itu-itu juga, dan yang di belakangnya tidak
      // pernah mendapat giliran. Dari luar, penarikan tampak bekerja normal.
      //
      // Diurutkan menurut kapan perkaranya TERAKHIR DIBUKA, yang paling lama
      // menunggu lebih dulu. Perkara yang belum pernah dibuka sama sekali tidak
      // punya catatan - dan itulah yang paling perlu didahulukan, jadi
      // ketiadaannya dihitung sebagai menunggu paling lama.
      try {
        const terakhir = await ecourtStoreService.terakhirDiperiksaPerkara();
        const kapan = (url) => {
          const nomor = acuan.petaNomor.get(url);
          if (!nomor) return 0;
          return terakhir.get(normalizeCaseNumber(nomor)) ?? 0;
        };
        perluDiperiksa.sort((a, b) => kapan(a) - kapan(b));
      } catch (error) {
        // Urutan giliran adalah penyempurnaan, bukan syarat. Bila catatannya
        // tidak terbaca, urutan daftar SIPP dipakai apa adanya - seperti dulu.
        log(`  Urutan giliran tidak terbaca (${error.message}); memakai urutan daftar.`);
      }

      tautan = perluDiperiksa;
    }

    const sebelumDibatasi = tautan.length;
    if (args.maksPerkara > 0) tautan = tautan.slice(0, args.maksPerkara);
    ringkasan.tertundaKarenaBatas = Math.max(sebelumDibatasi - tautan.length, 0);
    log(`Ditemukan ${tautan.length} perkara untuk diperiksa.`);
    if (ringkasan.tertundaKarenaBatas > 0) {
      log(
        `${ringkasan.tertundaKarenaBatas} perkara lain menunggu putaran berikutnya (batas ${args.maksPerkara} per putaran).`
      );
    }

    for (const url of tautan) {
      ringkasan.perkaraDiperiksa += 1;
      log(`[${ringkasan.perkaraDiperiksa}/${tautan.length}] ${url.slice(0, 80)}...`);
      try {
        await processCase(page, url, ringkasan, args, acuan);
      } catch (error) {
        // Sesi habis MENGHENTIKAN putaran, bukan sekadar melewati satu
        // perkara. Meneruskannya hanya menghasilkan ratusan permintaan ke
        // server Mahkamah Agung yang semuanya berakhir di halaman login.
        if (error && error.sesiHabis) {
          log("Sesi e-Court habis di tengah putaran. Penarikan dihentikan.");
          log("Login sekali dari portal, lalu jalankan lagi - yang sudah terunduh tidak diulang.");
          ringkasan.status = "berhenti";
          ringkasan.galatTerakhir = "sesi e-Court habis di tengah putaran";
          KODE_KELUAR = 2;
          break;
        }

        log(`  Gagal memproses perkara: ${error.message}`);
        ringkasan.jumlahGalat += 1;
        ringkasan.galatTerakhir = error.message;
      }
    }

    // Sisa acuan yang tidak pernah terlihat adalah perkara yang tercatat SIPP
    // sebagai terdaftar e-Court, tetapi tidak muncul di halaman mana pun yang
    // dibaca. Inilah yang selama ini hilang diam-diam.
    if (acuan.aktif) {
      ringkasan.tidakDitemukanDiEcourt = [...acuan.belumTerlihat].map(
        (kunci) => acuan.perkara.get(kunci)?.nomorPerkara || kunci
      );
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
    if (ringkasan.tertundaKarenaBatas > 0) {
      console.log(`  Ketemu di e-Court, belum giliran diperiksa: ${ringkasan.tertundaKarenaBatas}`);
      console.log("    (akan terambil pada putaran berikutnya - ini bukan selisih data)");
    }
    if (ringkasan.tidakDitemukanDiEcourt.length > 0) {
      console.log(`  Tercatat SIPP tetapi tidak ditemukan di e-Court: ${ringkasan.tidakDitemukanDiEcourt.length}`);
      for (const nomor of ringkasan.tidakDitemukanDiEcourt.slice(0, 10)) console.log(`    - ${nomor}`);
      if (ringkasan.tidakDitemukanDiEcourt.length > 10) {
        console.log(`    ... dan ${ringkasan.tidakDitemukanDiEcourt.length - 10} lainnya`);
      }
    }
    if (ringkasan.tidakAdaDiSipp.length > 0) {
      console.log(`  Ada di e-Court tetapi tidak tercatat SIPP: ${ringkasan.tidakAdaDiSipp.length}`);
    }
    if (ringkasan.registerBerbeda.length > 0) {
      console.log(`  Nomor register berbeda antara e-Court dan SIPP: ${ringkasan.registerBerbeda.length}`);
      for (const beda of ringkasan.registerBerbeda.slice(0, 5)) {
        console.log(`    - ${beda.nomorPerkara}: halaman "${beda.dariHalaman}" vs SIPP "${beda.dariSipp}"`);
      }
    }
    console.log(`  Berkas terunduh   : ${ringkasan.berkasTerunduh}`);
    console.log(`  Berkas tidak berubah : ${ringkasan.berkasTidakBerubah}`);
    console.log(`  Galat             : ${ringkasan.jumlahGalat}`);
    console.log(`  Berkas disimpan di: ${ecourtDocumentService.resolveRoot()}`);
    if (ringkasan.galatTerakhir) console.log(`  Galat terakhir    : ${ringkasan.galatTerakhir}`);
    // KODE_KELUAR menang bila sudah disetel: sesi habis (2) perlu dibedakan
    // dari gagal biasa (1), karena keduanya menuntut tindakan berbeda.
    process.exit(KODE_KELUAR !== 0 ? KODE_KELUAR : ringkasan.status === "gagal" ? 1 : 0);
  }
}

// Hanya berjalan bila dipanggil dari baris perintah.
//
// Tanpa penjagaan ini, sekadar me-require berkas ini - dari skrip pemeriksaan,
// dari alat lain, atau tidak sengaja - MEMBUKA PERAMBAN, menunggu login
// sepuluh menit, lalu menyentuh server e-Court. Dua alat lain di folder ini
// sudah dijaga sejak awal; berkas ini terlewat.
if (require.main === module) {
  utama().catch((error) => {
    console.error("Jembatan e-Court gagal dijalankan:", error);
    process.exit(1);
  });
}

module.exports = { downloadFile, guessExtension, parseArgs, simpanBerkas };
