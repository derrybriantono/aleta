"use strict";

/**
 * Pemulihan sesi e-Court saat menyala + login captcha lewat WhatsApp.
 *
 * ============================================================================
 * MENJALANKAN LOGIKANYA DENGAN TIRUAN
 * ============================================================================
 *
 * Tanpa jaringan, tanpa database, tanpa peramban, tanpa sesi WhatsApp. Yang
 * ditiru: halaman login e-Court (ecourtLoginService), antrean kirim, jembatan
 * penarikan, dan jam. Yang dijalankan SUNGGUHAN: alur keputusan
 * ecourtPulihService, perintah chat, pemantau sesi, dan pembersih kunci profil.
 *
 * Yang dijaga paling keras:
 *   1. Jawaban HANYA dari nomor super admin (kecocokan penuh, bukan akhiran);
 *      nomor lain jatuh ke penanganan biasa tanpa jawaban.
 *   2. Sandi tidak pernah dikirim/diteruskan: kirimLogin hanya menerima kode.
 *   3. Satu pesan per kejadian (pemantau + penjadwal + menyala tidak ganda).
 *   4. Batas captcha, lalu berhenti dan memberi tahu SEKALI.
 *   5. Captcha tidak pernah dipecahkan program: tidak ada OCR/pemecah.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

const SANDBOX = fs.mkdtempSync(path.join(os.tmpdir(), "aleta-pulih-"));
process.env.ALETA_BOT_DATA_DIR = path.join(SANDBOX, "data");
process.env.ALETA_ECOURT_SESSION_DIR = path.join(SANDBOX, "sesi");
process.env.ALETA_ECOURT_KREDENSIAL_DIR = path.join(SANDBOX, "sesi");
process.env.ALETA_BOT_RUNTIME_CONFIG_PATH = path.join(SANDBOX, "runtime.json");
fs.writeFileSync(
  process.env.ALETA_BOT_RUNTIME_CONFIG_PATH,
  JSON.stringify({ adminWhatsappNumber: "081234567890", ecourtPantauSesi: { aktif: true, jedaMenit: 10, jedaPeringatanJam: 4 } })
);

let lulus = 0;
let gagal = 0;
function periksa(nama, benar, ket) {
  if (benar) {
    lulus += 1;
    console.log(`  OK    ${nama}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${nama}${ket ? ` - ${ket}` : ""}`);
  }
}

async function tunggu(kondisi, maksMs = 3000) {
  const batas = Date.now() + maksMs;
  while (Date.now() < batas) {
    if (kondisi()) return true;
    await new Promise((r) => setTimeout(r, 15));
  }
  return kondisi();
}

// --- Tiruan database (sebelum layanan lain dimuat) ---
const botDbPath = require.resolve("../services/botDbService");
const botDbAsli = require("../services/botDbService");
const sqlTercatat = [];
const barisRingkas = {
  dokumen_baru: 7,
  perkara_baru: 3,
  menunggu_majelis: 5,
  menunggu_kirim: 2,
  putaran: 4,
  berkas: 11,
};
require.cache[botDbPath].exports = {
  ensureSchema: async () => true,
  addColumnIfMissing: async () => true,
  addIndexIfMissing: async () => true,
  toMysqlDate: botDbAsli.toMysqlDate,
  fromMysqlDate: botDbAsli.fromMysqlDate,
  SQL_AWAL_HARI_SETEMPAT: botDbAsli.SQL_AWAL_HARI_SETEMPAT,
  sqlSetempat: botDbAsli.sqlSetempat,
  sqlDariSetempat: botDbAsli.sqlDariSetempat,
  query: async (sql) => {
    sqlTercatat.push(String(sql));
    if (/COUNT\(\*\) AS dokumen_baru/i.test(sql)) return [{ dokumen_baru: barisRingkas.dokumen_baru }];
    if (/AS perkara_baru/i.test(sql)) return [{ perkara_baru: barisRingkas.perkara_baru }];
    if (/AS menunggu_majelis/i.test(sql)) {
      return [{ menunggu_majelis: barisRingkas.menunggu_majelis, menunggu_kirim: barisRingkas.menunggu_kirim }];
    }
    if (/aleta_bot_ecourt_sync_runs/i.test(sql)) return [{ putaran: barisRingkas.putaran, berkas: barisRingkas.berkas }];
    return [];
  },
};

const logService = require("../services/logService");
const kejadian = [];
logService.logSecurityEvent = async (e) => {
  kejadian.push(e);
};
logService.logSystemEvent = async (e) => {
  kejadian.push(e);
};

const pulih = require("../services/ecourtPulihService");
const perintah = require("../services/ecourtWaPerintahService");
const sesiProfil = require("../tools/ecourt-bridge/sesi");

// --- Jam & zona ---
let jamMs = Date.parse("2026-10-17T02:00:00Z"); // 10.00 WITA, Sabtu
function bagianWaktuTiruan(d) {
  const b = {};
  for (const x of new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(d)) {
    b[x.type] = x.value;
  }
  return { jam: Number(b.hour) % 24, menit: Number(b.minute), hari: 6, tanggal: `${b.year}-${b.month}-${b.day}` };
}

// --- Tiruan layanan ---
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const SANDI_RAHASIA = "S3cr3t-Sandi-Ecourt!";
const panggilan = { mulaiLogin: 0, kirimLogin: [], bersih: 0, periksa: 0, putaran: [], sidang: [] };
const antrean = [];
const skenario = { sesi: [], login: [] };
let menungguLogin = false;

const loginTiruan = {
  LOGIN_TTL_MS: 5 * 60 * 1000,
  sedangMenunggu: () => menungguLogin,
  mulaiLogin: async () => {
    panggilan.mulaiLogin += 1;
    menungguLogin = true;
    return { ok: true, alasan: "", captcha: PNG, terisiOtomatis: true, emailTerisi: "petugas@pa.go.id" };
  },
  kirimLogin: async (arg) => {
    panggilan.kirimLogin.push(arg);
    menungguLogin = false;
    return skenario.login.length ? skenario.login.shift() : { ok: false, alasan: "login_ditolak_ecourt" };
  },
  bersihkanSesiAktif: () => {
    panggilan.bersih += 1;
    menungguLogin = false;
  },
  periksaSesi: async () => {
    panggilan.periksa += 1;
    return skenario.sesi.length ? skenario.sesi.shift() : { berlaku: false, alasan: "sesi_kedaluwarsa" };
  },
};
const jadwalTiruan = {
  st: { sedangJalan: false, adaPenarikanLain: false, pengaturan: { aktif: true }, terakhirSelesai: null, terakhirKode: null, terakhirCatatan: "" },
  aktif: true,
  getStatus() {
    return this.st;
  },
  getSettings() {
    return { aktif: this.aktif };
  },
  bagianWaktu: bagianWaktuTiruan,
  jalankanSatuPutaran: async (opsi) => {
    panggilan.putaran.push(opsi);
    return { dilewati: false, kode: 0, catatan: "Selesai." };
  },
};
let nomorAdmin = "081234567890";
let waSiap = true;
let jamAman = true;
let kredensialAda = true;

pulih.aturAlat({
  sekarang: () => jamMs,
  nomorAdmin: () => nomorAdmin,
  pengaturanLain: () => ({}),
  jadwal: () => jadwalTiruan,
  login: () => loginTiruan,
  akun: () => ({
    slotAkunUtama: () => "utama",
    daftarAkun: () => [{ slot: "utama", aktif: true, adaSesi: true }],
  }),
  kredensial: () => ({ siapOtomatis: () => kredensialAda, ambil: () => ({ email: "x", sandi: SANDI_RAHASIA }) }),
  sesiEcourt: () => ({ SLOT_BAWAAN: "utama", sessionExists: () => true }),
  antrean: () => ({
    enqueueMessage: async (d) => {
      antrean.push(d);
      return d;
    },
  }),
  sidangHari: async (tgl) => {
    panggilan.sidang.push(tgl);
    return [`1/Pdt.G/2026/PA.Dgl@${tgl}`, "99/Pdt.G/2026/PA.Dgl"];
  },
  whatsappSiap: () => waSiap,
  jamAman: () => jamAman,
  tidur: async () => {},
});
perintah.aturAlat({ jadwal: () => jadwalTiruan, sekarang: () => jamMs });

const ADMIN_ID = "6281234567890@c.us";
const LAIN_ID = "6289999999999@c.us";

function setelUlang() {
  pulih.setel();
  antrean.length = 0;
  panggilan.mulaiLogin = 0;
  panggilan.kirimLogin.length = 0;
  panggilan.bersih = 0;
  panggilan.periksa = 0;
  panggilan.putaran.length = 0;
  panggilan.sidang.length = 0;
  skenario.sesi.length = 0;
  skenario.login.length = 0;
  menungguLogin = false;
  waSiap = true;
  jamAman = true;
  nomorAdmin = "081234567890";
  kredensialAda = true;
  kejadian.length = 0;
  jadwalTiruan.st.sedangJalan = false;
  jadwalTiruan.st.adaPenarikanLain = false;
  jadwalTiruan.aktif = true;
  pulih.resetBatas();
  try {
    fs.rmSync(path.join(process.env.ALETA_BOT_DATA_DIR, "ecourt-pulih.json"), { force: true });
  } catch {
    /* belum ada */
  }
}

const jumlahCaptcha = () => antrean.filter((a) => a.attachment && a.attachment.kind === "ecourt_captcha").length;

(async () => {
  console.log("\n== Murni: kode captcha, nomor admin, rentang ==");
  {
    periksa("kode saja 5 huruf/angka diterima", pulih.ekstrakKode("aB3k9") === "aB3k9");
    periksa("spasi di sekitar kode dibuang", pulih.ekstrakKode("  Xy7Z2  ") === "Xy7Z2");
    periksa("sapaan 'menu' bukan kode", pulih.ekstrakKode("menu") === "");
    periksa("'ya' bukan kode", pulih.ekstrakKode("ya") === "");
    periksa("kalimat bukan kode", pulih.ekstrakKode("tolong kirim lagi ya") === "");
    periksa("'kode ABC12' selalu diterima", pulih.ekstrakKode("kode ABC12") === "ABC12");
    periksa("'captcha menu' diterima karena eksplisit", pulih.ekstrakKode("captcha MENU1") === "MENU1");
    periksa("'ecourt status' bukan kode", pulih.ekstrakKode("ecourt status") === "");
    periksa("kata 'menu' DITERIMA bila mengutip pesan captcha", pulih.ekstrakKode("menu", { terkutip: true }) === "menu");
    periksa("tiga huruf tanpa kutipan ditolak (terlalu pendek)", pulih.ekstrakKode("abc") === "");
    periksa("admin: format @c.us cocok", pulih.dariAdmin(ADMIN_ID));
    periksa("admin: format 0812... cocok", pulih.dariAdmin("081234567890"));
    periksa("nomor lain ditolak", !pulih.dariAdmin(LAIN_ID));
    periksa("akhiran sama tetapi nomor beda ditolak", !pulih.dariAdmin("6299981234567890@c.us"));
    periksa("pengenal @lid tidak dianggap admin", !pulih.dariAdmin("123456789012345@lid"));
    periksa("admin kosong: tak seorang pun admin", (() => {
      nomorAdmin = "";
      const hasil = !pulih.dariAdmin(ADMIN_ID);
      nomorAdmin = "081234567890";
      return hasil;
    })());

    const r = pulih.rentangTanggal(Date.parse("2026-10-14T02:00:00Z"), Date.parse("2026-10-17T02:00:00Z"), 7);
    periksa("rentang 14-17 Okt = 4 tanggal", r.join(",") === "2026-10-14,2026-10-15,2026-10-16,2026-10-17", r.join(","));
    const panjang = pulih.rentangTanggal(Date.parse("2026-09-01T02:00:00Z"), Date.parse("2026-10-17T02:00:00Z"), 7);
    periksa("rentang dibatasi 7 hari", panjang.length === 7 && panjang[6] === "2026-10-17", panjang.join(","));
    periksa("waktu ditulis WITA", pulih.teksWaktu(Date.parse("2026-10-17T02:05:00Z")) === "17-10-2026 10.05 WITA", pulih.teksWaktu(Date.parse("2026-10-17T02:05:00Z")));
    periksa(
      "lewat tengah malam UTC tetap tanggal WITA yang benar",
      pulih.teksWaktu(Date.parse("2026-10-17T17:30:00Z")) === "18-10-2026 01.30 WITA"
    );
  }

  console.log("\n== Menyala, sesi MATI: satu captcha ke super admin ==");
  {
    setelUlang();
    skenario.sesi.push({ berlaku: false, alasan: "sesi_kedaluwarsa" });
    const h = await pulih.pulihSaatMenyala();
    periksa("keadaan mati terdeteksi", h.keadaan === "mati", JSON.stringify(h));
    periksa("halaman login dibuka sekali", panggilan.mulaiLogin === 1);
    periksa("tepat satu pesan di antrean", antrean.length === 1, String(antrean.length));
    const m = antrean[0] || {};
    periksa("tujuan = nomor admin (628...)", m.recipientNumber === "6281234567890");
    periksa("lampiran = gambar captcha", m.attachment && m.attachment.kind === "ecourt_captcha");
    periksa("dikirim sebagai gambar, bukan dokumen", m.metadata && m.metadata.sendOptions && m.metadata.sendOptions.sendMediaAsDocument === false);
    periksa("lewat antrean bot kategori system, prioritas tinggi", m.category === "system" && m.priority === 1);
    periksa("pesan menyuruh membalas dengan kode", /balas pesan ini dengan \*kode pada gambar\*/i.test(m.message));
    periksa("pesan melarang sandi lewat WhatsApp", /jangan kirim sandi/i.test(m.message));
    periksa("pesan TIDAK memuat sandi tersimpan", !String(m.message).includes(SANDI_RAHASIA));
    const berkas = pulih.deskripsikanBerkasCaptcha(m.attachment.source);
    periksa("berkas gambar ada di folder captcha", berkas.ok && fs.statSync(berkas.absolutePath).size > 20);
    periksa("jalur di luar folder captcha ditolak", pulih.deskripsikanBerkasCaptcha(path.join(SANDBOX, "x", "captcha-a.png")).ok === false);
    periksa("nama lain di folder captcha ditolak", pulih.deskripsikanBerkasCaptcha(path.join(pulih.folderCaptcha(), "rahasia.png")).ok === false);
    periksa("penelusuran ../ ditolak", pulih.deskripsikanBerkasCaptcha(path.join(pulih.folderCaptcha(), "..", "ecourt-pulih.json")).ok === false);
    periksa("jejak keamanan mencatat captcha dikirim", kejadian.some((k) => k.eventType === "ecourt_wa_captcha_dikirim"));

    // Tidak ada pesan ganda: pemantau/penjadwal yang mendeteksi hal yang sama.
    const ulang = await pulih.sesiMati({ sumber: "pemantau" });
    periksa("deteksi kedua tidak mengirim lagi", ulang.alasan === "captcha_sudah_dikirim" && antrean.length === 1);
    const hook = await pulih.padaSesiHabis({ sumber: "penarikan" });
    periksa("hook penjadwal (kode 2) juga tidak mengirim lagi", hook.diurus === true && antrean.length === 1);
    periksa("tidak ada permintaan sandi di pesan mana pun", antrean.every((a) => !/sandi anda|masukkan sandi|kirim sandi\b(?! lewat)/i.test(a.message) || /jangan kirim sandi/i.test(a.message)));
  }

  console.log("\n== Jawaban captcha: hanya dari nomor admin ==");
  {
    const dariLain = await perintah.tanganiPesan({ pengirim: LAIN_ID, teks: "aB3k9" });
    periksa("nomor lain: diabaikan (null), diteruskan ke penanganan biasa", dariLain === null);
    periksa("nomor lain: login TIDAK dikirim", panggilan.kirimLogin.length === 0);
    const lainEksplisit = await perintah.tanganiPesan({ pengirim: LAIN_ID, teks: "kode aB3k9" });
    periksa("nomor lain pakai awalan 'kode': tetap null", lainEksplisit === null && panggilan.kirimLogin.length === 0);
    const lainPerintah = await perintah.tanganiPesan({ pengirim: LAIN_ID, teks: "ecourt status" });
    periksa("nomor lain: 'ecourt status' tak dijawab", lainPerintah === null);
    const lainLid = await perintah.tanganiPesan({ pengirim: "55512345678@lid", teks: "aB3k9" });
    periksa("pengenal @lid mentah: null", lainLid === null && panggilan.kirimLogin.length === 0);

    const sapaan = await perintah.tanganiPesan({ pengirim: ADMIN_ID, teks: "menu" });
    periksa("admin mengetik 'menu' saat captcha menunggu: diteruskan (null)", sapaan === null && panggilan.kirimLogin.length === 0);

    skenario.login.push({ ok: true, alasan: "", namaPengguna: "Admin PA" });
    jamMs = Date.parse("2026-10-17T02:01:00Z");
    const berkasSebelum = fs.readdirSync(pulih.folderCaptcha()).length;
    const hasil = await perintah.tanganiPesan({ pengirim: ADMIN_ID, teks: "aB3k9" });
    periksa("admin menjawab: kirimLogin dipanggil sekali", panggilan.kirimLogin.length === 1);
    const arg = panggilan.kirimLogin[0] || {};
    periksa("yang diteruskan HANYA kode (+jalur)", arg.captcha === "aB3k9" && arg.jalur === "whatsapp");
    periksa("tanpa surel & sandi pada panggilan", !("sandi" in arg) && !("email" in arg) && !JSON.stringify(arg).includes(SANDI_RAHASIA));
    periksa("balasan menyatakan berhasil masuk", hasil && /berhasil masuk/i.test(hasil.reply), hasil && hasil.reply);
    periksa("gambar captcha dihapus sesudah dipakai", fs.readdirSync(pulih.folderCaptcha()).length < berkasSebelum);
    await tunggu(() => panggilan.putaran.length === 1);
    periksa("penarikan segera dimulai sesudah masuk", panggilan.putaran.length === 1);
    periksa("tidak ada captcha baru sesudah berhasil", jumlahCaptcha() === 1);
  }

  console.log("\n== Kode salah: captcha baru otomatis, dibatasi, lalu berhenti ==");
  {
    setelUlang();
    await pulih.sesiMati({ sumber: "menyala", manual: false });
    periksa("captcha ke-1", jumlahCaptcha() === 1);

    let r = await perintah.tanganiPesan({ pengirim: ADMIN_ID, teks: "salah1" });
    periksa("kode salah dijelaskan", r && /ditolak e-court/i.test(r.reply) && /captcha baru/i.test(r.reply), r && r.reply);
    await tunggu(() => jumlahCaptcha() === 2);
    periksa("captcha ke-2 dikirim otomatis", jumlahCaptcha() === 2);

    r = await perintah.tanganiPesan({ pengirim: ADMIN_ID, teks: "salah2" });
    await tunggu(() => jumlahCaptcha() === 3);
    periksa("captcha ke-3 dikirim otomatis", jumlahCaptcha() === 3);

    r = await perintah.tanganiPesan({ pengirim: ADMIN_ID, teks: "salah3" });
    periksa("sesudah batas: balasan menyebut berhenti", r && /batas percobaan tercapai/i.test(r.reply), r && r.reply);
    await tunggu(() => antrean.some((a) => /dihentikan sementara/i.test(a.message)));
    periksa("TIDAK ada captcha ke-4", jumlahCaptcha() === 3);
    periksa(
      "admin diberi tahu satu kali bahwa bot berhenti",
      antrean.filter((a) => /dihentikan sementara/i.test(a.message)).length === 1
    );
    periksa("pemberitahuan menyebut jalan keluar", antrean.some((a) => /ecourt masuk/i.test(a.message) && /dihentikan sementara/i.test(a.message)));

    const otomatis = await pulih.sesiMati({ sumber: "pemantau" });
    periksa("deteksi otomatis berikutnya tidak mengirim apa-apa", jumlahCaptcha() === 3 && otomatis.dilewati === true);
    const pemberitahuan = antrean.filter((a) => /dihentikan sementara/i.test(a.message)).length;
    periksa("pemberitahuan batas tidak berulang", pemberitahuan === 1);

    // Sesudah jendela berlalu, hitungan baru.
    jamMs += 31 * 60 * 1000;
    periksa("sesudah 30 menit batas pulih", (() => pulih.getStatus().percobaanCaptchaDalamJendela === 0)());
    jamMs = Date.parse("2026-10-17T02:01:00Z");
  }

  console.log("\n== 'ecourt masuk' memulai hitungan baru (keputusan manusia) ==");
  {
    // Lanjut dari keadaan batas tercapai di atas.
    skenario.sesi.push({ berlaku: false, alasan: "sesi_kedaluwarsa" });
    const r = await perintah.tanganiPesan({ pengirim: ADMIN_ID, teks: "ecourt masuk" });
    periksa("perintah dijawab", r && /captcha/i.test(r.reply), r && r.reply);
    periksa("captcha baru terkirim walau batas tadi tercapai", jumlahCaptcha() === 4);
    const batal = await perintah.tanganiPesan({ pengirim: ADMIN_ID, teks: "ecourt batal" });
    periksa("'ecourt batal' membatalkan", batal && /dibatalkan/i.test(batal.reply));
    const batal2 = await perintah.tanganiPesan({ pengirim: ADMIN_ID, teks: "ecourt batal" });
    periksa("batal tanpa captcha menunggu dijelaskan", batal2 && /tidak ada captcha/i.test(batal2.reply));
  }

  console.log("\n== Kedaluwarsa ==");
  {
    setelUlang();
    await pulih.sesiMati({ sumber: "menyala" });
    periksa("captcha terkirim", jumlahCaptcha() === 1);
    jamMs += 10 * 60 * 1000; // lewat batas jawab
    const r = await perintah.tanganiPesan({ pengirim: ADMIN_ID, teks: "telat1" });
    periksa("jawaban terlambat: tidak diteruskan ke e-Court", panggilan.kirimLogin.length === 0);
    periksa("balasan menyebut kedaluwarsa", r && /kedaluwarsa/i.test(r.reply), r && r.reply);
    await tunggu(() => jumlahCaptcha() === 2);
    periksa("captcha baru dikirim otomatis", jumlahCaptcha() === 2);
    jamMs = Date.parse("2026-10-17T02:01:00Z");
  }

  console.log("\n== Menyala, sesi HIDUP: tarik + susulan rentang server mati ==");
  {
    setelUlang();
    jamMs = Date.parse("2026-10-17T02:00:00Z");
    // Cap penarikan terakhir 3 hari lalu.
    fs.mkdirSync(process.env.ALETA_BOT_DATA_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(process.env.ALETA_BOT_DATA_DIR, "ecourt-pulih.json"),
      JSON.stringify({ terakhirBerhasilMs: Date.parse("2026-10-14T05:00:00Z") })
    );
    skenario.sesi.push({ berlaku: true, alasan: "" });
    const h = await pulih.pulihSaatMenyala();
    periksa("sesi hidup terdeteksi", h.keadaan === "hidup", JSON.stringify(h && h.keadaan));
    periksa("tidak ada captcha saat sesi hidup", jumlahCaptcha() === 0 && panggilan.mulaiLogin === 0);
    await tunggu(() => panggilan.putaran.length === 1);
    periksa("penarikan dijalankan sekali", panggilan.putaran.length === 1);
    periksa("sidang tiap hari dalam rentang dibaca (14-17 Okt)", panggilan.sidang.join(",") === "2026-10-14,2026-10-15,2026-10-16,2026-10-17", panggilan.sidang.join(","));
    const opsi = panggilan.putaran[0] || {};
    periksa("tarikan berkunci pada perkara bersidang rentang itu", opsi.hanyaUtamakan === true && opsi.maksPerkara === 0 && opsi.sumber === "susulan");
    periksa("daftar perkara tanpa kembar", new Set(opsi.utamakan).size === opsi.utamakan.length && opsi.utamakan.length === 5, JSON.stringify(opsi.utamakan));
    await h.hasil.selesai;
    const catatan = pulih.bacaCatatan();
    periksa("cap waktu berhasil diperbarui", catatan.terakhirBerhasilMs > Date.parse("2026-10-14T05:00:00Z"));

    // Tanpa cap waktu: hanya hari ini.
    setelUlang();
    skenario.sesi.push({ berlaku: true, alasan: "" });
    await pulih.pulihSaatMenyala();
    await tunggu(() => panggilan.putaran.length === 1);
    periksa("tanpa cap waktu: hanya hari ini", panggilan.sidang.join(",") === "2026-10-17", panggilan.sidang.join(","));

    // Rentang sangat jauh dibatasi.
    setelUlang();
    fs.writeFileSync(
      path.join(process.env.ALETA_BOT_DATA_DIR, "ecourt-pulih.json"),
      JSON.stringify({ terakhirBerhasilMs: Date.parse("2026-08-01T05:00:00Z") })
    );
    skenario.sesi.push({ berlaku: true, alasan: "" });
    await pulih.pulihSaatMenyala();
    await tunggu(() => panggilan.putaran.length === 1);
    periksa("server mati berminggu: susulan dibatasi 7 hari", panggilan.sidang.length === 7, String(panggilan.sidang.length));
  }

  console.log("\n== Penjadwal mati / penarikan berjalan: tidak menarik sendiri ==");
  {
    setelUlang();
    jadwalTiruan.aktif = false;
    const h = await pulih.pulihSaatMenyala();
    periksa("penjadwal mati: tidak melakukan apa pun saat menyala", h.dilewati === true && h.alasan === "penjadwal_mati" && panggilan.periksa === 0 && panggilan.putaran.length === 0);
    setelUlang();
    jadwalTiruan.st.sedangJalan = true;
    const h2 = await pulih.pulihSaatMenyala();
    periksa("penarikan sedang berjalan: dilewati", h2.dilewati === true);
    periksa("selama berjalan tidak ada peramban kedua", panggilan.periksa === 0 && panggilan.mulaiLogin === 0);
  }

  console.log("\n== Di luar jam aman: ditunda, bukan ditembak ==");
  {
    setelUlang();
    jamAman = false;
    const r = await pulih.sesiMati({ sumber: "menyala" });
    periksa("ditunda, dianggap sudah diurus", r.ditunda === true && r.diurus === true);
    periksa("tidak ada pesan maupun peramban", antrean.length === 0 && panggilan.mulaiLogin === 0);
    const belum = await pulih.periksaTunda();
    periksa("masih di luar jam: tetap menunggu", belum.alasan === "belum_waktunya" && antrean.length === 0);
    jamAman = true;
    skenario.sesi.push({ berlaku: false, alasan: "sesi_kedaluwarsa" });
    await pulih.periksaTunda();
    periksa("jam aman tiba: captcha dikirim", jumlahCaptcha() === 1);

    setelUlang();
    jamAman = false;
    const manual = await pulih.sesiMati({ sumber: "perintah", manual: true });
    periksa("perintah admin sendiri tidak ditahan jam aman", manual.diurus === true && jumlahCaptcha() === 1);

    // Ternyata ada yang login dari portal selagi menunggu.
    setelUlang();
    jamAman = false;
    await pulih.sesiMati({ sumber: "menyala" });
    jamAman = true;
    skenario.sesi.push({ berlaku: true, alasan: "" });
    await pulih.periksaTunda();
    periksa("sesi ternyata hidup (login portal): tidak mengirim captcha", jumlahCaptcha() === 0);
    await tunggu(() => panggilan.putaran.length === 1);
    periksa("dan penarikan dijalankan", panggilan.putaran.length === 1);
  }

  console.log("\n== Tanpa simpanan sandi: sandi TIDAK diminta lewat chat ==");
  {
    setelUlang();
    kredensialAda = false;
    const r = await pulih.sesiMati({ sumber: "menyala" });
    periksa("captcha tidak dikirim", jumlahCaptcha() === 0 && panggilan.mulaiLogin === 0);
    periksa("diserahkan ke peringatan teks lama (diurus=false)", r.diurus === false && r.alasan === "kredensial_belum_tersimpan");
    const k = await perintah.tanganiPesan({ pengirim: ADMIN_ID, teks: "ecourt masuk" });
    periksa("'ecourt masuk' mengarahkan ke portal, bukan minta sandi", k && /portal|Integrasi e-Court/i.test(k.reply) && /tidak boleh dikirim lewat whatsapp/i.test(k.reply), k && k.reply);
  }

  console.log("\n== Nomor admin kosong / otomatis dimatikan ==");
  {
    setelUlang();
    nomorAdmin = "";
    const r = await pulih.sesiMati({ sumber: "pemantau" });
    periksa("tanpa nomor admin: tidak diurus (peringatan lama yang berbicara)", r.diurus === false && antrean.length === 0);
  }

  console.log("\n== Perintah chat super admin ==");
  {
    setelUlang();
    jadwalTiruan.st.terakhirCatatan = "Selesai.";
    skenario.sesi.push({ berlaku: true, alasan: "" });
    fs.writeFileSync(
      path.join(process.env.ALETA_BOT_DATA_DIR, "ecourt-pulih.json"),
      JSON.stringify({ terakhirBerhasilMs: Date.parse("2026-10-17T00:30:00Z") })
    );
    let r = await perintah.tanganiPesan({ pengirim: ADMIN_ID, teks: "ecourt status" });
    periksa("status: sesi hidup", r && /Sesi: hidup/i.test(r.reply), r && r.reply);
    periksa("status: waktu terakhir dalam WITA", r && r.reply.includes("17-10-2026 08.30 WITA"), r && r.reply);
    periksa("status: penjadwal", r && /Penjadwal: menyala/i.test(r.reply));

    skenario.sesi.push({ berlaku: false, alasan: "sesi_kedaluwarsa" });
    r = await perintah.tanganiPesan({ pengirim: ADMIN_ID, teks: "E-Court Status" });
    periksa("status: sesi mati disebut MATI", r && /MATI/.test(r.reply), r && r.reply);

    r = await perintah.tanganiPesan({ pengirim: ADMIN_ID, teks: "ecourt ringkas" });
    periksa("ringkas: perkara baru", r && /Perkara baru terbaca: 3/.test(r.reply), r && r.reply);
    periksa("ringkas: dokumen baru", r && /Dokumen baru terbaca: 7/.test(r.reply));
    periksa("ringkas: unggahan menunggu majelis", r && /menunggu verifikasi majelis: 5/.test(r.reply));
    periksa("ringkas: tanggal hari ini WITA", r && r.reply.includes("17-10-2026"));
    periksa(
      "ringkas: batas 'hari ini' memakai selisih setempat (UTC-aman)",
      sqlTercatat.some((q) => /TIMESTAMPDIFF\(SECOND, UTC_TIMESTAMP\(\), NOW\(\)\)/.test(q)) &&
        !sqlTercatat.some((q) => /DATE\(pertama_terlihat\)/i.test(q))
    );

    jadwalTiruan.st.sedangJalan = true;
    r = await perintah.tanganiPesan({ pengirim: ADMIN_ID, teks: "ecourt tarik" });
    periksa("tarik saat penarikan berjalan: tidak dobel", r && /sedang berjalan/i.test(r.reply) && panggilan.putaran.length === 0);
    jadwalTiruan.st.sedangJalan = false;

    skenario.sesi.push({ berlaku: true, alasan: "" });
    r = await perintah.tanganiPesan({ pengirim: ADMIN_ID, teks: "ecourt tarik" });
    periksa("tarik: dimulai", r && /Penarikan dimulai/i.test(r.reply), r && r.reply);
    await tunggu(() => panggilan.putaran.length === 1);
    periksa("tarik: jembatan dijalankan", panggilan.putaran.length === 1);
    await tunggu(() => antrean.some((a) => /Penarikan e-Court selesai/.test(a.message)));
    periksa("hasil perintah manual dikabari lewat antrean", antrean.some((a) => /Penarikan e-Court selesai/.test(a.message)));

    skenario.sesi.push({ berlaku: false, alasan: "sesi_kedaluwarsa" });
    const sebelum = jumlahCaptcha();
    r = await perintah.tanganiPesan({ pengirim: ADMIN_ID, teks: "ecourt tarik" });
    periksa("tarik saat sesi mati: mengirim captcha", r && /captcha dikirim/i.test(r.reply) && jumlahCaptcha() === sebelum + 1, r && r.reply);
    pulih.batalkanCaptcha();

    skenario.sesi.push({ berlaku: true, alasan: "" });
    r = await perintah.tanganiPesan({ pengirim: ADMIN_ID, teks: "ecourt masuk" });
    periksa("masuk saat sesi hidup: tidak perlu login", r && /masih hidup/i.test(r.reply));

    r = await perintah.tanganiPesan({ pengirim: ADMIN_ID, teks: "ecourt" });
    periksa("'ecourt' saja menampilkan bantuan", r && /Perintah e-Court/.test(r.reply));
    r = await perintah.tanganiPesan({ pengirim: ADMIN_ID, teks: "tolong cek perkara 12/Pdt.G/2026" });
    periksa("chat biasa dari admin: tidak dicegat", r === null);
  }

  console.log("\n== Pemantau sesi: satu pesan, bukan dua ==");
  {
    setelUlang();
    const pantau = require("../services/ecourtSesiPantauService");
    const loginAsli = require("../services/ecourtLoginService");
    const antreanAsli = require("../services/messageQueueService");
    const periksaAsli = loginAsli.periksaSesi;
    const menungguAsli = loginAsli.sedangMenunggu;
    const enqAsli = antreanAsli.enqueueMessage;
    const peringatanLama = [];
    loginAsli.periksaSesi = async () => ({ tersimpan: true, berlaku: false, alasan: "sesi_kedaluwarsa" });
    loginAsli.sedangMenunggu = () => false;
    antreanAsli.enqueueMessage = async (d) => {
      peringatanLama.push(d);
      return d;
    };

    const hasil = await pantau.detak({ paksa: true });
    periksa("pemantau mendeteksi mati", hasil.berlaku === false, JSON.stringify(hasil));
    periksa("captcha terkirim lewat antrean pulih", jumlahCaptcha() === 1);
    periksa("peringatan teks lama TIDAK ikut terkirim", peringatanLama.length === 0, String(peringatanLama.length));

    // Jalur cadangan: bila captcha tak dapat diurus, peringatan lama tetap jalan.
    setelUlang();
    pulih.aturAlat({ nomorAdmin: () => "" });
    const h2 = await pantau.detak({ paksa: true });
    periksa("tanpa jalur captcha: peringatan teks lama tetap terkirim (fitur lama utuh)", h2.berlaku === false && peringatanLama.length === 1 && peringatanLama[0].notificationKey === "ecourt_sesi_habis", String(peringatanLama.length));
    pulih.aturAlat({ nomorAdmin: () => nomorAdmin });

    loginAsli.periksaSesi = periksaAsli;
    loginAsli.sedangMenunggu = menungguAsli;
    antreanAsli.enqueueMessage = enqAsli;
  }

  console.log("\n== Profil peramban: kunci tertinggal dibuang ==");
  {
    const dir = fs.mkdtempSync(path.join(SANDBOX, "profil-"));
    let bisaTautan = true;
    try {
      fs.symlinkSync("hostlama-4242", path.join(dir, "SingletonLock"));
      fs.symlinkSync("1234567890", path.join(dir, "SingletonCookie"));
      fs.symlinkSync("/tmp/x/SingletonSocket", path.join(dir, "SingletonSocket"));
    } catch {
      bisaTautan = false;
    }
    if (!bisaTautan) {
      console.log("  (tautan simbolik tidak diizinkan di mesin ini - bagian ini dilewati)");
    } else {
      let h = sesiProfil.bersihkanKunciUsang(dir, { namaHost: "hostbaru", pidHidup: () => true });
      periksa("host berbeda (container dibuat ulang): ketiga kunci dibuang", h.dibuang.length === 3 && h.alasan === "host_berbeda", JSON.stringify(h));
      periksa("kunci benar-benar hilang", !fs.existsSync(path.join(dir, "SingletonLock")) && h.dibuang.every((n) => { try { fs.lstatSync(path.join(dir, n)); return false; } catch { return true; } }));

      fs.symlinkSync("hostbaru-777", path.join(dir, "SingletonLock"));
      h = sesiProfil.bersihkanKunciUsang(dir, { namaHost: "hostbaru", pidHidup: () => true });
      periksa("proses Chromium masih hidup: kunci TIDAK disentuh", h.dibuang.length === 0 && fs.lstatSync(path.join(dir, "SingletonLock")).isSymbolicLink());
      h = sesiProfil.bersihkanKunciUsang(dir, { namaHost: "hostbaru", pidHidup: () => false });
      periksa("proses sudah tiada: kunci dibuang", h.dibuang.includes("SingletonLock") && h.alasan === "proses_tidak_ada");
      h = sesiProfil.bersihkanKunciUsang(dir, { namaHost: "hostbaru", pidHidup: () => false });
      periksa("tanpa kunci: tidak berbuat apa-apa", h.dibuang.length === 0);
    }
  }

  console.log("\n== Kawat: app.js, penjadwal, login, compose ==");
  {
    const baca = (rel) => fs.readFileSync(path.resolve(__dirname, "..", rel), "utf8");
    const app = baca("app.js");
    periksa("app.js memanggil perintah e-Court sebelum verifikasi nomor", app.indexOf("ecourtWaPerintahService.tanganiPesan") > 0 && app.indexOf("ecourtWaPerintahService.tanganiPesan") < app.indexOf("nomorVerificationService.handleReply"));
    periksa("app.js menyalakan pemulihan saat menyala", /ecourtPulihService\.mulai\(\)/.test(app));
    periksa("pengirim antrean mengenal lampiran ecourt_captcha", /attachment\.kind === "ecourt_captcha"/.test(app));
    periksa("balasan perintah lewat balasChat (satu pintu)", /balasChat\(msg, hasilEcourtWa\.reply/.test(app));
    const jadwal = baca("services/ecourtSchedulerService.js");
    periksa("penjadwal mencatat cap waktu berhasil", /ecourtPulihService"\)\.catatBerhasil/.test(jadwal) || /catatBerhasil\(\{ sumber \}\)/.test(jadwal));
    periksa("penjadwal memicu pemulihan pada kode 2", /kode === 2[\s\S]{0,200}padaSesiHabis/.test(jadwal));
    periksa("penjadwal menunggu bila pemulihan memakai profil", /pulihSedangMemakaiProfil\(\)/.test(jadwal));
    const loginSrc = baca("services/ecourtLoginService.js");
    periksa("login memuat jalur whatsapp pada jejak", /jalur: jalur === "whatsapp" \? "whatsapp" : "portal"/.test(loginSrc));
    periksa("login portal lama tetap ada (mulaiLogin/kirimLogin/periksaSesi)", /module\.exports = \{[\s\S]*kirimLogin,[\s\S]*mulaiLogin,[\s\S]*periksaSesi,/.test(loginSrc));
    const layananPulih = baca("services/ecourtPulihService.js");
    const kodeSaja = layananPulih.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    periksa("tidak ada OCR / pemecah captcha", !/tesseract|ocr|2captcha|anticaptcha|capsolver|solveCaptcha/i.test(kodeSaja));
    periksa("tidak ada pengiriman langsung: hanya lewat antrean", !/\.sendMessage\(/.test(layananPulih) && /enqueueMessage/.test(layananPulih));
    periksa("tidak ada kata Aleta ke SIPP: layanan tidak menulis ke database SIPP", !/db_config|sipp/i.test(kodeSaja));
    const dasar = baca("../docker-compose.yml");
    const server = baca("../docker-compose.override.server.yml");
    for (const [nama, isi] of [["docker-compose.yml", dasar], ["docker-compose.override.server.yml", server]]) {
      periksa(`${nama}: profil e-Court di volume`, /ALETA_ECOURT_SESSION_DIR: \/usr\/src\/app\/\.ecourt-session/.test(isi) && /ecourt-session:\/usr\/src\/app\/\.ecourt-session/.test(isi));
      periksa(`${nama}: sandi tersimpan di folder yang sama`, /ALETA_ECOURT_KREDENSIAL_DIR: \/usr\/src\/app\/\.ecourt-session/.test(isi));
    }
    periksa("catatan pulih & captcha di bawah runtime-data terpasang", /ALETA_BOT_DATA_DIR: \/usr\/src\/app\/runtime-data\/catatan/.test(server) && /aleta-bot-runtime:\/usr\/src\/app\/runtime-data/.test(server));
  }

  pulih.setel();
  console.log(`\nHasil: ${lulus} lulus, ${gagal} gagal`);
  try {
    fs.rmSync(SANDBOX, { recursive: true, force: true });
  } catch {
    /* sisa sementara */
  }
  process.exit(gagal === 0 ? 0 : 1);
})().catch((galat) => {
  console.error("Uji berhenti karena galat:", galat);
  process.exit(2);
});
