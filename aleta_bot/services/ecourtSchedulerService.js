"use strict";

/**
 * Penjadwal penarikan berkas e-Court.
 *
 * ============================================================================
 * KENDALANYA BUKAN TEKNIS, MELAINKAN CAPTCHA
 * ============================================================================
 *
 * e-Court menuntut captcha saat login. Sesi yang sudah dibuat dapat bertahan,
 * tetapi tetap punya masa berlaku dan akan habis sendiri. Tidak ada cara bagi
 * program menghidupkannya kembali - dan itu memang seharusnya begitu.
 *
 * Karena itu penjadwal ini berhenti ketika sesinya mati, bukan mencoba terus.
 * Mencoba berulang kali dengan sesi mati ke sistem Mahkamah Agung persis
 * perilaku yang membuat akun ditandai, dan tidak akan pernah berhasil.
 *
 * ============================================================================
 * MEMANGGIL JEMBATAN, BUKAN MENIRUNYA
 * ============================================================================
 *
 * Penjadwal menjalankan tools/ecourt-bridge/run.js sebagai proses terpisah,
 * bukan menyalin ulang alurnya. Menyalin alur berarti punya dua jalur yang
 * dapat berbeda perilaku - dan yang dijalankan terjadwal justru yang paling
 * jarang diperhatikan orang.
 *
 * Kode keluarnya dibaca untuk membedakan sebab: 0 selesai, 1 gagal, 2 sesi
 * habis. Ketiganya menuntut tindakan berbeda.
 */

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const { readRuntimeConfig, writeRuntimeConfig } = require("../config/runtime-config");
const logService = require("./logService");
const ecourtPermintaanService = require("./ecourtPermintaanService");
const ecourtAkunService = require("./ecourtAkunService");
const ecourtAuditArsipService = require("./ecourtAuditArsipService");
const ecourtDocumentService = require("./ecourtDocumentService");

/** Nilai bawaan bila belum pernah diatur. */
const BAWAAN = {
  aktif: false,
  // Turunan untuk pembaca lama (widget, checklist) - jadwal tidak lagi memakai
  // jarak jam tetap sejak 13 Okt 2026; lihat selang acak di bawah.
  jarakJam: 1,
  jamMulai: 7,
  jamSelesai: 17,
  maksPerkara: 25,
  // 13 Okt 2026 (permintaan pengguna 10.05): putaran berkala tiap 30-60 menit,
  // selangnya diacak tiap putaran; dan tarikan pagi 08.00 WITA Senin-Jumat.
  selangMinMenit: 30,
  selangMaksMenit: 60,
  pagiAktif: true,
  jamPagi: 8,
  menitPagi: 0,
};

/** Batas wajar selang acak (menit). */
const SELANG_BATAS_BAWAH = 15;
const SELANG_BATAS_ATAS = 240;

/** Keadaan dalam memori. Tidak perlu bertahan antar penyalaan ulang. */
const keadaan = {
  timer: null,
  sedangJalan: false,
  terakhirMulai: null,
  terakhirSelesai: null,
  terakhirKode: null,
  terakhirCatatan: "",
  jumlahPutaran: 0,
  // Keterangan putaran yang SEDANG berjalan - dipakai layar pemantauan.
  sumber: "",
  berkasLog: "",
  perkaraDiminta: "",
  akun: "",
  anak: null,
  // Butir 8 (1.189.x): kemajuan nyata putaran yang sedang berjalan (dari
  // baris @@ALETA-KEMAJUAN jembatan) - { tahap, label, persen, i, n, teks }.
  kemajuan: null,
  // Butir 12 (13 Okt 2026): kapan pewaktu dinyalakan dan kapan putaran
  // berkala terakhir dimulai - untuk menghitung jadwal tarikan berikutnya.
  timerMulaiMs: 0,
  terakhirPutaranMs: 0,
  // 13 Okt 2026: waktu putaran berkala berikutnya - DITETAPKAN (acak dalam
  // rentang) saat putaran sebelumnya dimulai, supaya layar dapat menyebutnya.
  berkalaBerikutnyaMs: 0,
  // Putaran terjadwal (pagi/berkala) sedang disiapkan atau berjalan - detak
  // berikutnya tidak memulai yang lain (kueri SIPP berjalan sebelum kunci).
  sedangPutaranTerjadwal: false,
};

/**
 * Detak penjadwal: tiap menit memeriksa apakah tarikan pagi atau putaran
 * berkala sudah jatuh tempo. Murah - hanya membaca jam dan pengaturan.
 */
const DETAK_PENJADWAL_MS = 60 * 1000;

/** Ketergantungan yang dapat ditukar uji (pembangkit acak, daftar sidang, jembatan). */
const alat = {
  acak: () => Math.random(),
  sidangHari: (tanggal, opsi) => require("./ecourtVerifikasiHarianService").sidangHari(tanggal, opsi),
  sidangPerluDiperiksa: (tanggal) => require("./ecourtVerifikasiHarianService").sidangPerluDiperiksa(tanggal),
  catatTarik: (daftar, kode) => require("./ecourtVerifikasiHarianService").catatTarik(daftar, kode),
  jalankan: (opsi) => jalankanSatuPutaran(opsi),
  ambilPermintaan: () => ecourtPermintaanService.ambilBerikutnya(),
};

function aturAlat(baru = {}) {
  Object.assign(alat, baru);
}

/**
 * Folder log, dibagi dengan host lewat pemasangan volume.
 *
 * /var/www/html/aleta-data/reports pada host terpasang ke sini. Log yang
 * ditulis penarikan dari portal masuk ke folder yang SAMA dengan log skrip
 * aleta-ecourt-unduh-latar.sh, memakai pola nama yang sama pula - sehingga
 * layar pemantauan menampilkan keduanya, dan penarikan yang dimulai dari
 * PuTTY tidak menjadi tidak terlihat begitu ada tombol di portal.
 */
const FOLDER_LOG = path.resolve(__dirname, "..", "reports");

/**
 * Berkas kunci berdetak, dibaca juga oleh skrip host.
 *
 * PID tidak dapat dipakai lintas container - nomor proses di dalam container
 * tidak berarti apa-apa di host. Karena itu kuncinya berisi waktu detak
 * terakhir: kunci yang detaknya basi berarti prosesnya sudah mati, sekalipun
 * berkasnya tertinggal karena bot berhenti mendadak.
 */
const BERKAS_KUNCI = path.join(FOLDER_LOG, "ecourt-unduh-aleta.lock");
const DETAK_MS = 30 * 1000;
const KUNCI_BASI_MS = 3 * 60 * 1000;

let detakKunci = null;

function tulisKunci(keterangan) {
  try {
    fs.mkdirSync(FOLDER_LOG, { recursive: true });
    fs.writeFileSync(
      BERKAS_KUNCI,
      JSON.stringify({ ...keterangan, detak: new Date().toISOString() }),
      "utf8"
    );
  } catch {
    // Kunci adalah lapisan tambahan, bukan penjagaan utama. Gagal menulisnya
    // tidak boleh menggagalkan penarikan - keadaan.sedangJalan tetap menjaga
    // putaran ganda dari dalam bot.
  }
}

function hapusKunci() {
  if (detakKunci) {
    clearInterval(detakKunci);
    detakKunci = null;
  }
  try {
    fs.unlinkSync(BERKAS_KUNCI);
  } catch {
    // Sudah tidak ada - tidak ada yang perlu dikerjakan.
  }
}

/** Apakah ada penarikan LAIN yang masih hidup menurut berkas kunci? */
function kunciMasihHidup() {
  try {
    const isi = JSON.parse(fs.readFileSync(BERKAS_KUNCI, "utf8"));
    const detak = Date.parse(isi && isi.detak);
    if (!Number.isFinite(detak)) return false;
    return Date.now() - detak < KUNCI_BASI_MS;
  } catch {
    return false;
  }
}

function angka(nilai, bawaan, min, maks) {
  const n = Number(nilai);
  if (!Number.isFinite(n)) return bawaan;
  return Math.max(min, Math.min(maks, Math.floor(n)));
}

/** Pengaturan penjadwal yang berlaku sekarang. */
function getSettings(runtimeConfig = readRuntimeConfig()) {
  const p = (runtimeConfig && runtimeConfig.ecourtJadwal) || {};
  // Butir 11 (13 Okt 2026): akun utama yang sah membuat penarikan SELALU
  // menyala - saklar yang tersimpan tidak dapat mematikannya. aktifTersimpan
  // tetap dilaporkan supaya layar tahu apa yang dipilih orang.
  let akunUtama = null;
  try {
    akunUtama = ecourtAkunService.keadaanAkunUtama(runtimeConfig);
  } catch {
    akunUtama = null;
  }
  const selaluAktif = Boolean(akunUtama && akunUtama.sah);
  const selangMinMenit = angka(p.selangMinMenit, BAWAAN.selangMinMenit, SELANG_BATAS_BAWAH, SELANG_BATAS_ATAS);
  const selangMaksMenit = Math.max(
    selangMinMenit,
    angka(p.selangMaksMenit, BAWAAN.selangMaksMenit, SELANG_BATAS_BAWAH, SELANG_BATAS_ATAS)
  );
  return {
    aktif: p.aktif === true || selaluAktif,
    aktifTersimpan: p.aktif === true,
    selaluAktif,
    akunUtama,
    // Turunan (pembulatan ke atas dari selang maksimum) untuk pembaca lama.
    jarakJam: Math.max(1, Math.ceil(selangMaksMenit / 60)),
    jamMulai: angka(p.jamMulai, BAWAAN.jamMulai, 0, 23),
    jamSelesai: angka(p.jamSelesai, BAWAAN.jamSelesai, 1, 24),
    maksPerkara: angka(p.maksPerkara, BAWAAN.maksPerkara, 1, 200),
    selangMinMenit,
    selangMaksMenit,
    pagiAktif: p.pagiAktif !== false,
    jamPagi: angka(p.jamPagi, BAWAAN.jamPagi, 0, 23),
    menitPagi: angka(p.menitPagi, BAWAAN.menitPagi, 0, 59),
  };
}

/**
 * Memeriksa satu set pengaturan - fungsi murni. "" = sah, selain itu alasan.
 */
function periksaPengaturan({ jamMulai, jamSelesai, maksPerkara, selangMinMenit, selangMaksMenit, jamPagi, menitPagi, jarakJam }) {
  const n = (x) => Number(x);
  const bulat = (x) => Number.isFinite(n(x));
  if (jarakJam !== undefined && jarakJam !== null && (!bulat(jarakJam) || n(jarakJam) < 1 || n(jarakJam) > 24)) {
    return "jarak_jam_di_luar_1_sampai_24";
  }
  if (!bulat(jamMulai) || n(jamMulai) < 0 || n(jamMulai) > 23) return "jam_mulai_di_luar_0_sampai_23";
  if (!bulat(jamSelesai) || n(jamSelesai) < 1 || n(jamSelesai) > 24) return "jam_selesai_di_luar_1_sampai_24";
  if (n(jamSelesai) <= n(jamMulai)) return "jam_selesai_harus_setelah_jam_mulai";
  if (!bulat(maksPerkara) || n(maksPerkara) < 1 || n(maksPerkara) > 200) return "maks_perkara_di_luar_1_sampai_200";
  for (const [x, alasan] of [
    [selangMinMenit, "selang_min_di_luar_15_sampai_240"],
    [selangMaksMenit, "selang_maks_di_luar_15_sampai_240"],
  ]) {
    if (!bulat(x) || n(x) < SELANG_BATAS_BAWAH || n(x) > SELANG_BATAS_ATAS) return alasan;
  }
  if (n(selangMinMenit) > n(selangMaksMenit)) return "selang_min_lebih_dari_maks";
  if (!bulat(jamPagi) || n(jamPagi) < 0 || n(jamPagi) > 23) return "jam_pagi_di_luar_0_sampai_23";
  if (!bulat(menitPagi) || n(menitPagi) < 0 || n(menitPagi) > 59) return "menit_pagi_di_luar_0_sampai_59";
  if (n(jamPagi) >= n(jamSelesai)) return "jam_pagi_harus_sebelum_jam_selesai";
  return "";
}

/**
 * Menyimpan pengaturan penjadwal.
 *
 * Nilai di luar akal ditolak, bukan dipaksa masuk. Ruas yang TIDAK dikirim
 * dipertahankan dari pengaturan sekarang (widget ekstensi hanya mengirim
 * saklar dan ruas lama). jarakJam diterima untuk pengirim lama, tetapi tidak
 * lagi menentukan jadwal sejak 13 Okt 2026 - selang acak yang menentukan.
 */
function saveSettings(isian = {}) {
  const olehSiapa = String((isian && isian.olehSiapa) || "");
  const tersimpan = (readRuntimeConfig() || {}).ecourtJadwal || {};
  const kini = getSettings();
  const ambil = (kunci) => (isian[kunci] === undefined || isian[kunci] === null || isian[kunci] === "" ? kini[kunci] : Number(isian[kunci]));
  const baru = {
    jamMulai: ambil("jamMulai"),
    jamSelesai: ambil("jamSelesai"),
    maksPerkara: ambil("maksPerkara"),
    selangMinMenit: ambil("selangMinMenit"),
    selangMaksMenit: ambil("selangMaksMenit"),
    jamPagi: ambil("jamPagi"),
    menitPagi: ambil("menitPagi"),
  };
  const alasan = periksaPengaturan({ ...baru, jarakJam: isian.jarakJam });
  if (alasan) return { ok: false, alasan };

  const aktif = isian.aktif === undefined ? tersimpan.aktif === true : isian.aktif === true;
  const pagiAktif = isian.pagiAktif === undefined ? kini.pagiAktif : isian.pagiAktif !== false;
  const sekarang = readRuntimeConfig();
  writeRuntimeConfig({
    ...sekarang,
    ecourtJadwal: {
      aktif,
      jamMulai: Math.floor(baru.jamMulai),
      jamSelesai: Math.floor(baru.jamSelesai),
      maksPerkara: Math.floor(baru.maksPerkara),
      selangMinMenit: Math.floor(baru.selangMinMenit),
      selangMaksMenit: Math.floor(baru.selangMaksMenit),
      pagiAktif,
      jamPagi: Math.floor(baru.jamPagi),
      menitPagi: Math.floor(baru.menitPagi),
    },
  });

  void logService.logSecurityEvent({
    eventType: "ecourt_jadwal_disunting",
    severity: "warning",
    message: aktif ? "Penjadwal e-Court dinyalakan." : "Penjadwal e-Court dimatikan.",
    metadata: {
      aktif,
      selangMinMenit: Math.floor(baru.selangMinMenit),
      selangMaksMenit: Math.floor(baru.selangMaksMenit),
      pagiAktif,
      olehSiapa,
    },
  });
  if (kini.pagiAktif && !pagiAktif) {
    void logService.logSecurityEvent({
      eventType: "ecourt_tarikan_pagi_dimatikan",
      severity: "warning",
      message: "Tarikan pagi e-Court dimatikan dari portal.",
      metadata: { olehSiapa },
    });
  }

  // Perubahan berlaku tanpa menyalakan ulang bot. Putaran berkala yang sudah
  // ditetapkan dipendekkan bila rentang barunya lebih rapat.
  mulaiUlang();
  const berlaku = getSettings();
  const batasBaru = Date.now() + berlaku.selangMaksMenit * 60 * 1000;
  if (keadaan.berkalaBerikutnyaMs > batasBaru) keadaan.berkalaBerikutnyaMs = batasBaru;
  return { ok: true, alasan: "", selaluAktif: berlaku.selaluAktif, aktif: berlaku.aktif };
}

/**
 * Zona waktu jam kerja. Terukur 13 Okt 2026: proses bot di container berjalan
 * dalam UTC (TZ tidak disetel), sehingga getHours() membaca jam 07-17 sebagai
 * 15.00-01.00 WITA. Jam kerja dibaca menurut zona pengadilan, bukan zona
 * proses.
 */
const ZONA_WAKTU = String(process.env.ALETA_ZONA_WAKTU || "Asia/Makassar").trim() || "Asia/Makassar";
const HARI_SINGKAT = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Jam (0-23), hari (0 Minggu) dan tanggal YYYY-MM-DD menurut zona pengadilan. */
function bagianWaktu(sekarang = new Date(), zona = ZONA_WAKTU) {
  try {
    const bagian = {};
    for (const b of new Intl.DateTimeFormat("en-US", {
      timeZone: zona,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    }).formatToParts(sekarang)) {
      bagian[b.type] = b.value;
    }
    const jam = Number(bagian.hour) % 24;
    const hari = HARI_SINGKAT[bagian.weekday];
    if (!Number.isFinite(jam) || hari === undefined) throw new Error("zona");
    return { jam, menit: Number(bagian.minute) || 0, hari, tanggal: `${bagian.year}-${bagian.month}-${bagian.day}` };
  } catch {
    const d = (n) => String(n).padStart(2, "0");
    return {
      jam: sekarang.getHours(),
      menit: sekarang.getMinutes(),
      hari: sekarang.getDay(),
      tanggal: `${sekarang.getFullYear()}-${d(sekarang.getMonth() + 1)}-${d(sekarang.getDate())}`,
    };
  }
}

/** Apakah sekarang di dalam jam kerja yang diatur? */
function dalamJamKerja(sekarang = new Date(), pengaturan = getSettings()) {
  const { jam, hari } = bagianWaktu(sekarang); // hari: 0 Minggu, 6 Sabtu

  // Akhir pekan dilewati: pihak dan kuasa hukum mengunggah pada hari kerja,
  // dan menarik di akhir pekan hanya membebani server pengadilan.
  if (hari === 0 || hari === 6) return false;
  return jam >= pengaturan.jamMulai && jam < pengaturan.jamSelesai;
}

/**
 * Menjalankan satu putaran.
 *
 * Tidak pernah dua putaran sekaligus: putaran yang menumpuk akan membuka dua
 * peramban sekaligus dan menarik perkara yang sama dua kali.
 */
/**
 * Batas waktu satu putaran penarikan.
 *
 * Lapisan kedua, bukan pengganti perbaikan di run.js. Selama penjadwal
 * menandai putaran sebagai sedang jalan hingga anaknya keluar, satu proses
 * yang menggantung akan mengunci SELURUH putaran berikutnya - permanen, dan
 * tanpa pesan galat. Penjagaan di run.js menutup satu sebab yang sudah
 * diketahui; batas waktu ini menutup sebab yang belum.
 *
 * Bawaannya dua jam: cukup longgar untuk 200 perkara pada jaringan lambat,
 * dan tetap jauh lebih pendek daripada selamanya.
 */
const BATAS_PUTARAN_MS = Number(process.env.ALETA_BOT_ECOURT_BATAS_PUTARAN_MS || 2 * 60 * 60 * 1000);

/** Jalur ke jembatan e-Court. */
function jembatanPath() {
  return path.resolve(__dirname, "..", "tools", "ecourt-bridge", "run.js");
}

function jalankanSatuPutaran({
  nomorPerkara = "",
  permintaanId = "",
  // 0 berarti TANPA batas - dipakai penarikan menyeluruh dari portal, sama
  // seperti aleta-ecourt-unduh-latar.sh dengan MAKS=0. Bila tidak disebut,
  // batasnya mengikuti pengaturan penjadwal.
  maksPerkara = null,
  // Menarik HANYA perkara yang berkasnya belum ada - lihat
  // mulaiPenarikanBelumAda dan --hanya-belum-ada pada run.js.
  hanyaBelumAda = false,
  // Membaca daftar dokumen + status verifikasinya SAJA, tanpa mengunduh
  // berkas (--tanpa-unduh pada run.js) - dipakai penarik verifikasi harian
  // (ecourtVerifikasiHarianService, butir 30, 5 Okt 2026).
  tanpaUnduh = false,
  sumber = "jadwal",
  // Batas waktu putaran ini sendiri (ms). Bawaannya BATAS_PUTARAN_MS (2 jam);
  // tarikan satu perkara dari penanda "belum upload" Jadwal Sidang (7 Okt
  // 2026) memakai batas yang jauh lebih pendek - ada orang yang menunggunya.
  batasMs = null,
  // Butir 8 (1.189.x): tiap baris kemajuan jembatan (@@ALETA-KEMAJUAN, lihat
  // ecourtKemajuanTarik) diteruskan ke sini - tarikan satu perkara memakainya
  // untuk persen + tahap yang nyata. Gagal di sini tidak menyentuh penarikan.
  padaKemajuan = null,
  // 13 Okt 2026: perkara yang bersidang hari ini - dibuka lebih dulu dalam
  // putaran yang sama (--utamakan); hanyaUtamakan = HANYA itu (tarikan pagi).
  utamakan = [],
  hanyaUtamakan = false,
} = {}) {
  const daftarUtama = (Array.isArray(utamakan) ? utamakan : []).map((x) => String(x || "").trim()).filter(Boolean);
  return new Promise((selesai) => {
    if (keadaan.sedangJalan) {
      selesai({ dilewati: true, alasan: "putaran_sebelumnya_belum_selesai" });
      return;
    }

    // Penarikan dari PuTTY memakai proses di luar bot, sehingga tidak terlihat
    // oleh keadaan.sedangJalan. Dua penarikan sekaligus membuka dua peramban
    // dan menarik perkara yang sama dua kali ke server Mahkamah Agung.
    if (kunciMasihHidup()) {
      selesai({ dilewati: true, alasan: "penarikan_lain_masih_berjalan" });
      return;
    }

    const pengaturan = getSettings();

    // ==================================================================
    // AKUN DIPILIH DI SINI, BUKAN DITETAPKAN SEKALI DI PENGATURAN
    // ==================================================================
    //
    // Yang dipilih adalah akun aktif berikutnya yang punya sesi tersimpan
    // dan tidak sedang diistirahatkan. Memakai akun yang sama terus-menerus
    // membuat sesi akun lain menganggur sampai basi - dan cadangan yang basi
    // bukan cadangan.
    const pilihan = ecourtAkunService.pilihAkunSiap();
    const slotAkun = pilihan.ok ? pilihan.slot : "";

    keadaan.sedangJalan = true;
    keadaan.terakhirMulai = new Date().toISOString();
    keadaan.sumber = sumber;
    keadaan.perkaraDiminta = String(nomorPerkara || "");
    keadaan.akun = slotAkun;

    // Nama log mengikuti pola skrip host supaya keduanya muncul di layar
    // pemantauan yang sama.
    const cap = new Date().toISOString().replace(/[-:]/g, "").replace(/[.].*$/, "").replace("T", "-");
    const berkasLog = path.join(FOLDER_LOG, `ecourt-unduh-${cap}.log`);
    keadaan.berkasLog = path.basename(berkasLog);

    let tulisLog = null;
    try {
      fs.mkdirSync(FOLDER_LOG, { recursive: true });
      tulisLog = fs.createWriteStream(berkasLog, { flags: "a" });
      tulisLog.write(
        `=== Penarikan e-Court dimulai ${new Date().toISOString()} (sumber: ${sumber}` +
          `${nomorPerkara ? `, perkara: ${nomorPerkara}` : ""}${slotAkun ? `, akun: ${slotAkun}` : ""}` +
          `${daftarUtama.length ? `, sidang: ${daftarUtama.length}` : ""}) ===\n`
      );
    } catch {
      // Tanpa log pun penarikan tetap berjalan. Yang hilang hanya
      // pemantauannya, dan itu tidak sebanding dengan membatalkan penarikan.
      tulisLog = null;
      keadaan.berkasLog = "";
    }

    tulisKunci({ sumber, nomorPerkara: String(nomorPerkara || ""), log: keadaan.berkasLog });
    detakKunci = setInterval(
      () => tulisKunci({ sumber, nomorPerkara: String(nomorPerkara || ""), log: keadaan.berkasLog }),
      DETAK_MS
    );

    const batas = maksPerkara === null ? pengaturan.maksPerkara : Number(maksPerkara);

    const argumen = [jembatanPath(), "--terjadwal"];
    if (slotAkun) argumen.push("--akun", slotAkun);
    if (hanyaBelumAda) argumen.push("--hanya-belum-ada");
    if (tanpaUnduh) argumen.push("--tanpa-unduh");
    if (nomorPerkara) {
      argumen.push("--perkara", String(nomorPerkara));
    } else {
      if (daftarUtama.length) argumen.push("--utamakan", daftarUtama.join(","));
      if (daftarUtama.length && hanyaUtamakan) argumen.push("--hanya-utamakan");
      else if (batas > 0) argumen.push("--maks-perkara", String(batas));
    }

    const anak = spawn(process.execPath, argumen, {
      cwd: path.resolve(__dirname, ".."),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    keadaan.anak = anak;

    // Dimatikan di penanganan close, apa pun sebab keluarnya.
    let dipaksaBerhenti = false;
    const batasPutaran =
      Number.isFinite(Number(batasMs)) && Number(batasMs) > 0 ? Math.min(Number(batasMs), BATAS_PUTARAN_MS) : BATAS_PUTARAN_MS;
    const pewaktu = setTimeout(() => {
      dipaksaBerhenti = true;
      anak.kill("SIGKILL");
    }, batasPutaran);

    let keluaran = "";
    const kemajuanTarik = require("./ecourtKemajuanTarik");
    keadaan.kemajuan = kemajuanTarik.hitungKemajuan({ tahap: "buka-peramban" });
    const pilahKemajuan = kemajuanTarik.pemilahBaris((laporan) => {
      keadaan.kemajuan = kemajuanTarik.majukan(keadaan.kemajuan, laporan);
      if (typeof padaKemajuan === "function") padaKemajuan(laporan);
    });

    /**
     * Menyalurkan keluaran ke dua tempat sekaligus.
     *
     * Ke memori, untuk cuplikan galat pada catatan sistem seperti sebelumnya;
     * dan ke berkas log, supaya layar pemantauan di portal dapat mengikutinya
     * seperti tail -f. Yang di memori dipangkas 20 ribu huruf terakhir - satu
     * penarikan menyeluruh dapat menghasilkan puluhan megabita, dan menahan
     * seluruhnya di memori bot bukan hal yang pantas dilakukan.
     */
    function salurkan(potongan) {
      const teks = String(potongan);
      keluaran += teks;
      if (keluaran.length > 20000) keluaran = keluaran.slice(-20000);
      pilahKemajuan(teks);
      if (tulisLog) {
        try {
          tulisLog.write(teks);
        } catch {
          // Log penuh atau tidak dapat ditulis - penarikannya tetap jalan.
        }
      }
    }

    anak.stdout.on("data", salurkan);
    anak.stderr.on("data", salurkan);

    /** Merapikan berkas log dan kunci, apa pun sebab putaran berakhir. */
    function bereskan(catatanPenutup) {
      if (tulisLog) {
        try {
          tulisLog.write(`=== ${catatanPenutup} (${new Date().toISOString()}) ===\n`);
          tulisLog.end();
        } catch {
          // Tidak ada yang dapat dikerjakan lagi di sini.
        }
        tulisLog = null;
      }
      hapusKunci();
      keadaan.anak = null;
      keadaan.sumber = "";
      keadaan.perkaraDiminta = "";
      keadaan.akun = "";
    }

    anak.on("close", (kode) => {
      clearTimeout(pewaktu);

      // Permintaan titipan ditandai selesai apa pun hasilnya. Membiarkannya
      // berstatus "dikerjakan" selamanya membuat perkara itu tidak pernah
      // dapat diminta lagi - penjagaan terhadap banjir permintaan berubah
      // menjadi pemblokiran permanen.
      if (permintaanId) {
        void ecourtPermintaanService
          .tandaiSelesai(permintaanId, {
            berhasil: kode === 0,
            catatan: kode === 0 ? "selesai" : `berhenti dengan kode ${kode}`,
          })
          .catch(() => {});
      }
      keadaan.sedangJalan = false;
      keadaan.terakhirSelesai = new Date().toISOString();
      keadaan.terakhirKode = kode;
      keadaan.jumlahPutaran += 1;

      // Sesi habis (2) BUKAN kegagalan sistem - itu keadaan wajar yang
      // menuntut manusia login. Membedakannya penting supaya petugas tidak
      // mengira ada kerusakan.
      if (kode === 2) {
        keadaan.terakhirCatatan = "Sesi e-Court habis. Perlu login dari portal.";
        // Akun ini diistirahatkan supaya putaran berikutnya beralih ke akun
        // lain yang sesinya masih hidup - bukan mencoba akun mati berulang.
        if (slotAkun) ecourtAkunService.tandaiGagal(slotAkun, "sesi_habis");
        void logService.logSystemEvent({
          eventType: "ecourt_jadwal_sesi_habis",
          severity: "warning",
          message: "Penjadwal e-Court berhenti: sesi kedaluwarsa, perlu login dari portal.",
          metadata: {},
        });
      } else if (kode === 0) {
        keadaan.terakhirCatatan = "Selesai.";
        if (slotAkun) ecourtAkunService.tandaiBerhasil(slotAkun);
        // Cap waktu penarikan berhasil (bertahan antar penyalaan) - dasar
        // rentang SUSULAN saat server menyala kembali. Hanya putaran yang
        // memantau dokumen baru (berkala, pagi, susulan) yang dihitung:
        // tarikan tanpa unduhan (verifikasi harian), satu perkara, dan
        // pemeliharaan arsip (menyeluruh, belum-ada) tidak menutup celah.
        if (!tanpaUnduh && !nomorPerkara && ["jadwal", "pagi", "susulan"].includes(sumber)) {
          try {
            require("./ecourtPulihService").catatBerhasil({ sumber });
          } catch {
            // Mencatat cap waktu bukan syarat penarikan.
          }
        }
      } else {
        keadaan.terakhirCatatan = dipaksaBerhenti
          ? `Dihentikan paksa setelah melewati batas ${Math.round(batasPutaran / 60000)} menit.`
          : `Berhenti dengan kode ${kode}.`;
        void logService.logSystemEvent({
          eventType: "ecourt_jadwal_gagal",
          severity: "warning",
          message: "Putaran penjadwal e-Court gagal.",
          metadata: { kode, cuplikan: keluaran.slice(-400) },
        });
      }

      // Status akun satu sumber (30 Okt 2026): akhir putaran adalah bukti
      // keadaan sesi akun yang dipakai - berhasil = tersambung, kode 2 = perlu
      // masuk ulang. Dibaca semua penanda (portal, ekstensi, popup).
      try {
        require("./ecourtStatusAkunService").catatPenarikan(slotAkun || "utama", { kode, catatan: keadaan.terakhirCatatan });
      } catch {
        // Mencatat status bukan syarat penarikan.
      }

      bereskan(keadaan.terakhirCatatan);
      // Sesi habis: minta login lewat WhatsApp (bila dinyalakan). Dipicu SETELAH
      // kunci dilepas supaya pembukaan peramban login tidak bentrok dengan
      // penarikan yang baru berhenti.
      if (kode === 2) {
        try {
          void require("./ecourtPulihService")
            .padaSesiHabis({ sumber: "penarikan" })
            .catch(() => {});
        } catch {
          // Pemulihan lewat WhatsApp bukan syarat penjadwal.
        }
      }
      selesai({ dilewati: false, kode, catatan: keadaan.terakhirCatatan });
    });

    anak.on("error", (error) => {
      clearTimeout(pewaktu);
      keadaan.sedangJalan = false;
      keadaan.terakhirSelesai = new Date().toISOString();
      keadaan.terakhirKode = -1;
      keadaan.terakhirCatatan = `Gagal menjalankan jembatan: ${error.message}`;
      bereskan(keadaan.terakhirCatatan);
      selesai({ dilewati: false, kode: -1, catatan: keadaan.terakhirCatatan });
    });
  });
}

/**
 * ============================================================================
 * PEMERIKSAAN KEUTUHAN ARSIP - DIJALANKAN SENDIRI, BUKAN MENUNGGU DIMINTA
 * ============================================================================
 *
 * ecourtAuditArsipService sudah lengkap sejak lama: ia membandingkan tiap
 * baris aleta_bot_ecourt_files dengan berkasnya di disk pada empat hal - ada,
 * ukuran, sidik jari SHA-256, dan penanda bentuk - lalu membuang catatan yang
 * rusak supaya penarikan berikutnya mengambilnya kembali.
 *
 * Yang tidak ada: satu pun pemanggilnya yang berjalan sendiri. Satu-satunya
 * jalan masuk selama ini POST /ecourt/audit-arsip, yakni layar portal yang
 * harus dibuka orang. Berkas yang hilang atau terpotong karena itu baru
 * ketahuan ketika ada yang membukanya - kadang berbulan kemudian, dan yang
 * membukanya menerima berkas rusak tanpa satu pun keterangan.
 *
 * Inilah keluhan "dibilang terunduh tetapi berkasnya rusak": bukan
 * pemeriksaannya yang keliru, melainkan tidak ada yang pernah menjalankannya.
 *
 * Dijalankan SESUDAH penarikan, bukan sebelumnya: yang baru saja diunduh ikut
 * terperiksa pada putaran yang sama. Bergilir sesuai rancangan layanannya -
 * yang paling lama tidak diperiksa didahulukan - sehingga tidak ada satu
 * putaran pun yang membaca seluruh arsip sekaligus.
 *
 * perbaiki: true. Membiarkan yang rusak tercatat berarti perkaranya terhitung
 * lengkap selamanya, dan justru itulah keadaan yang hendak diakhiri. Berkas
 * yang sengaja dihapus karena masa simpan tidak ikut diperiksa - lihat
 * penjagaan dihapus_retensi di layanannya.
 */
const JEDA_AUDIT_MS = 6 * 60 * 60 * 1000;
let auditTerakhir = 0;

async function periksaArsipBerkala() {
  if (Date.now() - auditTerakhir < JEDA_AUDIT_MS) return;
  auditTerakhir = Date.now();

  try {
    const hasil = await ecourtAuditArsipService.periksaArsip({
      perbaiki: true,
      olehSiapa: "penjadwal",
    });
    const diperiksa = Number(hasil?.diperiksa || 0);
    const rusak = Number(hasil?.dibuang || 0);
    if (rusak > 0) {
      // ====================================================================
      // HILANG SEMUA BUKAN "BEBERAPA BERKAS RUSAK" - ITU ARSIP YANG TIDAK
      // PERNAH DI-MOUNT
      // ====================================================================
      //
      // Berkas rusak satu-dua memang terjadi: unduhan terpotong, cakram
      // penuh. Tetapi seluruh atau hampir seluruh yang diperiksa hilang
      // sekaligus punya satu sebab yang jauh lebih mungkin - folder arsipnya
      // berada di dalam LAPISAN CONTAINER, bukan di volume. Tiap
      // "docker compose up -d" yang membuat ulang container menghapusnya,
      // sementara barisnya di aleta_bot_ecourt_files tetap ada.
      //
      // Dua keadaan itu menuntut dua tindakan yang sama sekali berbeda -
      // yang satu menunggu penarikan berikutnya, yang satu menuntut baris
      // mount di docker-compose - jadi keduanya disebut berbeda pula.
      const hampirSemua = diperiksa >= 5 && rusak >= Math.ceil(diperiksa * 0.8);
      void logService.logSecurityEvent({
        eventType: hampirSemua ? "ecourt_arsip_hilang_menyeluruh" : "ecourt_arsip_rusak_dibuang",
        severity: hampirSemua ? "critical" : "warning",
        message: hampirSemua
          ? `Arsip e-Court hilang MENYELURUH: ${rusak} dari ${diperiksa} berkas yang diperiksa tidak ada di cakram. ` +
            `Folder arsip yang dipakai ${ecourtDocumentService.resolveRoot()}. Periksa apakah folder itu benar-benar ` +
            "ter-mount ke volume di docker-compose; tanpa mount, seluruh unduhan terhapus setiap container dibuat ulang."
          : `Pemeriksaan arsip e-Court membuang ${rusak} catatan berkas yang hilang atau rusak; ` +
            "berkasnya akan ditarik ulang pada putaran berikutnya.",
        metadata: {
          diperiksa,
          utuh: hasil?.utuh ?? null,
          dibuang: rusak,
          akarArsip: ecourtDocumentService.resolveRoot(),
        },
      });
    }
  } catch (galat) {
    // Gagal-terbuka: pemeriksaan arsip bukan pekerjaan utama penjadwal, dan
    // kegagalannya tidak boleh menghentikan penarikan berikutnya.
    void logService
      .logSecurityEvent({
        eventType: "ecourt_arsip_periksa_gagal",
        severity: "warning",
        message: `Pemeriksaan keutuhan arsip e-Court gagal: ${String(galat.message || galat).slice(0, 200)}`,
      })
      .catch(() => {});
  }
}

/**
 * ============================================================================
 * JADWAL: TARIKAN PAGI + PUTARAN BERKALA BERSELANG ACAK (13 Okt 2026)
 * ============================================================================
 *
 * Permintaan pengguna 13 Okt 10.05: "penarikan data setiap jam 8, dan
 * jadwalkan penarikan tiap 30 menit - 60 menit secara default".
 *
 *   TARIKAN PAGI   jam tetap (bawaan 08.00 WITA), Senin-Jumat. Membuka SEMUA
 *                  perkara e-Court yang bersidang hari itu, dengan akun utama.
 *                  Bot yang baru menyala sesudah jam itu - dan tarikan pagi
 *                  hari ini belum jalan - menyusulkannya SEKALI, segera
 *                  (sampai jam selesai kerja). Tanggalnya disimpan di berkas
 *                  supaya bot yang dinyalakan ulang tidak mengulanginya.
 *   BERKALA        tiap putaran menetapkan putaran berikutnya pada selang ACAK
 *                  antara selangMinMenit dan selangMaksMenit (bawaan 30-60),
 *                  hanya di jam kerja WITA. Perkara sidang hari ini yang belum
 *                  "sudah" ikut dibuka lebih dulu DI PUTARAN YANG SAMA -
 *                  pengganti penarik verifikasi harian 15 menit (satu perkara
 *                  per tarikan, tiap tarikan menyapu seluruh daftar e-Court).
 *
 * Tidak bertumpuk: satu putaran pada satu waktu (sedangPutaranTerjadwal +
 * kunci jalankanSatuPutaran yang juga dipakai tombol portal dan "belum
 * upload"); putaran apa pun yang dimulai penjadwal menggeser putaran berkala
 * berikutnya ke satu selang acak dari sekarang, jadi tarikan pagi tidak
 * langsung disusul putaran berkala.
 */

function berkasPagi() {
  const dasar = process.env.ALETA_BOT_DATA_DIR
    ? path.resolve(process.env.ALETA_BOT_DATA_DIR)
    : path.resolve(__dirname, "..", "data");
  return path.join(dasar, "ecourt-tarikan-pagi.json");
}

/** Catatan tarikan pagi terakhir ({tanggal, mulai, kode, catatan, jumlahPerkara, susulan}) atau {}. */
function bacaPagi() {
  try {
    const isi = JSON.parse(fs.readFileSync(berkasPagi(), "utf8"));
    return isi && typeof isi === "object" ? isi : {};
  } catch {
    return {};
  }
}

function tulisPagi(catatan) {
  try {
    const jalur = berkasPagi();
    fs.mkdirSync(path.dirname(jalur), { recursive: true });
    const sementara = `${jalur}.${process.pid}.tmp`;
    fs.writeFileSync(sementara, JSON.stringify(catatan));
    fs.renameSync(sementara, jalur);
  } catch {
    // Gagal menyimpan: paling buruk tarikan pagi disusulkan sekali lagi
    // sesudah bot menyala ulang - bukan kehilangan tarikan.
  }
}

/** Selang acak (ms) dalam rentang pengaturan - pembangkit acak dapat disuntik. */
function selangAcakMs(pengaturan, acak = alat.acak) {
  const min = Number(pengaturan.selangMinMenit);
  const maks = Math.max(min, Number(pengaturan.selangMaksMenit));
  const r = Math.min(Math.max(Number(acak()) || 0, 0), 1);
  return Math.round((min + r * (maks - min)) * 60 * 1000);
}

/** Waktu (ms) dari tanggal + jam:menit menurut zona pengadilan. */
function waktuZona(tanggal, jam, menit, zona = ZONA_WAKTU) {
  const [y, m, d] = String(tanggal).split("-").map(Number);
  const sasaran = Date.UTC(y, m - 1, d, jam, menit);
  let tebak = sasaran;
  for (let i = 0; i < 2; i += 1) {
    const b = bagianWaktu(new Date(tebak), zona);
    const [by, bm, bd] = b.tanggal.split("-").map(Number);
    tebak -= Date.UTC(by, bm - 1, bd, b.jam, b.menit) - sasaran;
  }
  return tebak;
}

/**
 * Perlukah tarikan pagi SEKARANG? - fungsi murni.
 * @returns {{perlu: boolean, susulan: boolean, tanggal: string, alasan: string}}
 */
function perluTarikanPagi({ sekarangMs = Date.now(), pengaturan, terakhirTanggal = "" }) {
  const b = bagianWaktu(new Date(sekarangMs));
  const tidak = (alasan) => ({ perlu: false, susulan: false, tanggal: b.tanggal, alasan });
  if (!pengaturan.pagiAktif) return tidak("pagi_dimatikan");
  if (b.hari === 0 || b.hari === 6) return tidak("akhir_pekan");
  if (terakhirTanggal === b.tanggal) return tidak("sudah_hari_ini");
  const menitKini = b.jam * 60 + b.menit;
  const menitPagi = pengaturan.jamPagi * 60 + pengaturan.menitPagi;
  if (menitKini < menitPagi) return tidak("belum_waktunya");
  if (menitKini >= pengaturan.jamSelesai * 60) return tidak("lewat_jam_kerja");
  // Lebih dari dua detak sesudah jamnya = bot baru menyala / sempat mati.
  return { perlu: true, susulan: menitKini > menitPagi + 2, tanggal: b.tanggal, alasan: "" };
}

/** Waktu tarikan pagi berikutnya (ISO) dan apakah itu susulan segera - fungsi murni. */
function jadwalPagiBerikutnya({ sekarangMs = Date.now(), pengaturan, terakhirTanggal = "" }) {
  if (!pengaturan.pagiAktif) return { waktu: null, susulan: false };
  const kini = perluTarikanPagi({ sekarangMs, pengaturan, terakhirTanggal });
  if (kini.perlu) return { waktu: new Date(sekarangMs).toISOString(), susulan: kini.susulan };
  for (let d = 0; d <= 8; d += 1) {
    const b = bagianWaktu(new Date(sekarangMs + d * 24 * 60 * 60 * 1000));
    if (b.hari === 0 || b.hari === 6) continue;
    if (d === 0 && (terakhirTanggal === b.tanggal || kini.alasan !== "belum_waktunya")) continue;
    return { waktu: new Date(waktuZona(b.tanggal, pengaturan.jamPagi, pengaturan.menitPagi)).toISOString(), susulan: false };
  }
  return { waktu: null, susulan: false };
}

/**
 * Waktu putaran berkala berikutnya (ISO) - fungsi murni. Waktu yang sudah
 * ditetapkan (acak), digeser ke awal jam kerja berikutnya bila jatuh di luar.
 */
function jadwalBerkalaBerikutnya({ aktif, berikutnyaMs, sekarangMs = Date.now(), pengaturan }) {
  if (!aktif || !berikutnyaMs) return null;
  let t = Math.max(berikutnyaMs, sekarangMs);
  for (let i = 0; i < 24 * 9; i += 1) {
    if (dalamJamKerja(new Date(t), pengaturan)) return new Date(t).toISOString();
    // Zona pengadilan berselisih jam bulat dari UTC: awal jam UTC berikutnya
    // adalah awal jam berikutnya di zona itu juga.
    t = Math.floor(t / 3600000) * 3600000 + 3600000;
  }
  return null;
}

/**
 * Apa yang dijalankan detak ini - fungsi murni. Pagi didahulukan; satu saja.
 * @returns {{jalan: "pagi"|"berkala"|null, alasan: string, susulan?: boolean}}
 */
function putuskanDetak({ sekarangMs = Date.now(), pengaturan, berkalaBerikutnyaMs, terakhirPagiTanggal = "", sibuk = false }) {
  if (!pengaturan.aktif) return { jalan: null, alasan: "penjadwal_mati" };
  if (sibuk) return { jalan: null, alasan: "penarikan_lain_berjalan" };
  const pagi = perluTarikanPagi({ sekarangMs, pengaturan, terakhirTanggal: terakhirPagiTanggal });
  if (pagi.perlu) return { jalan: "pagi", alasan: "", susulan: pagi.susulan };
  if (!dalamJamKerja(new Date(sekarangMs), pengaturan)) return { jalan: null, alasan: "di_luar_jam_kerja" };
  if (berkalaBerikutnyaMs && sekarangMs < berkalaBerikutnyaMs) return { jalan: null, alasan: "belum_waktunya" };
  return { jalan: "berkala", alasan: "" };
}

async function jalankanPagi(kini, susulan) {
  const tanggal = bagianWaktu(kini).tanggal;
  const daftar = await Promise.resolve(alat.sidangHari(tanggal, { semuaJenis: true })).catch(() => null);
  if (daftar === null) return { dilewati: true, alasan: "daftar_sidang_tidak_terbaca" };
  const catatan = { tanggal, mulai: kini.toISOString(), susulan: Boolean(susulan), jumlahPerkara: daftar.length };
  if (daftar.length === 0) {
    tulisPagi({ ...catatan, kode: 0, catatan: "Tidak ada perkara e-Court yang bersidang hari ini." });
    return { dilewati: false, kode: 0, jumlahPerkara: 0 };
  }
  const hasil = (await alat.jalankan({ sumber: "pagi", utamakan: daftar, hanyaUtamakan: true, maksPerkara: 0 })) || {};
  if (hasil.dilewati) return hasil;
  tulisPagi({ ...catatan, kode: hasil.kode, catatan: hasil.catatan || "" });
  try {
    alat.catatTarik(daftar, hasil.kode);
  } catch {
    // Catatan penanda verifikasi bukan syarat.
  }
  return { ...hasil, jumlahPerkara: daftar.length };
}

async function jalankanBerkala(kini) {
  // Permintaan titipan didahulukan: di baliknya ada petugas yang menunggu.
  const permintaan = await Promise.resolve(alat.ambilPermintaan()).catch(() => null);
  if (permintaan) {
    return alat.jalankan({ nomorPerkara: permintaan.nomorPerkara, permintaanId: permintaan.id });
  }
  const tanggal = bagianWaktu(kini).tanggal;
  const daftar = (await Promise.resolve(alat.sidangPerluDiperiksa(tanggal)).catch(() => [])) || [];
  const hasil = (await alat.jalankan({ sumber: "jadwal", utamakan: daftar })) || {};
  if (!hasil.dilewati && daftar.length) {
    try {
      alat.catatTarik(daftar, hasil.kode);
    } catch {
      // Catatan penanda verifikasi bukan syarat.
    }
  }
  return { ...hasil, sidangDiutamakan: daftar.length };
}

/**
 * Pemulihan saat menyala (atau login lewat WhatsApp) sedang memakai profil
 * peramban - penjadwal menunggu detak berikutnya.
 */
function pulihSedangMemakaiProfil() {
  try {
    return require("./ecourtPulihService").sedangMemulihkan() === true;
  } catch {
    return false;
  }
}

/** Satu detak penjadwal (tiap menit). */
async function detakPenjadwal(kini = new Date()) {
  const pengaturan = getSettings();
  if (!pengaturan.aktif) return { jalan: null, alasan: "penjadwal_mati" };

  // Pemeriksaan arsip berdiri di luar jam kerja dan di luar jadwal tarikan:
  // tidak menyentuh e-Court, hanya membaca disk (gerbang 6 jamnya sendiri).
  void periksaArsipBerkala();

  const keputusan = putuskanDetak({
    sekarangMs: kini.getTime(),
    pengaturan,
    berkalaBerikutnyaMs: keadaan.berkalaBerikutnyaMs,
    terakhirPagiTanggal: String(bacaPagi().tanggal || ""),
    sibuk: keadaan.sedangPutaranTerjadwal || keadaan.sedangJalan || kunciMasihHidup() || pulihSedangMemakaiProfil(),
  });
  if (!keputusan.jalan) return keputusan;

  keadaan.sedangPutaranTerjadwal = true;
  const sebelumnya = keadaan.berkalaBerikutnyaMs;
  // Putaran apa pun yang dimulai menggeser putaran berkala berikutnya satu
  // selang acak dari sekarang - dua tarikan tidak bertumpuk.
  keadaan.berkalaBerikutnyaMs = kini.getTime() + selangAcakMs(pengaturan);
  try {
    const hasil =
      keputusan.jalan === "pagi" ? await jalankanPagi(kini, keputusan.susulan) : await jalankanBerkala(kini);
    if (hasil && hasil.dilewati) {
      // Kalah cepat dari tarikan tombol: dicoba lagi pada detak berikutnya.
      keadaan.berkalaBerikutnyaMs = sebelumnya;
    } else if (keputusan.jalan === "berkala") {
      keadaan.terakhirPutaranMs = kini.getTime();
    }
    return { ...keputusan, hasil };
  } finally {
    keadaan.sedangPutaranTerjadwal = false;
  }
}

function berhenti() {
  if (keadaan.timer) {
    clearInterval(keadaan.timer);
    keadaan.timer = null;
  }
}

/**
 * Menyalakan penjadwal: detak tiap menit (lihat detakPenjadwal). Putaran
 * berkala pertama satu selang acak sesudah menyala - tarikan pagi (atau
 * susulannya) yang didahulukan.
 */
function mulai() {
  berhenti();
  if (require("./kembaranMode").aktif()) return; // mode kembaran (laptop): e-Court mati

  const pengaturan = getSettings();
  if (!pengaturan.aktif) return;

  keadaan.timerMulaiMs = Date.now();
  if (!keadaan.berkalaBerikutnyaMs) keadaan.berkalaBerikutnyaMs = Date.now() + selangAcakMs(pengaturan);

  // Sekali segera sesudah bot menyala: bot yang baru menyala hampir selalu
  // berarti container yang baru dibuat - saat arsip yang tidak ter-mount
  // paling mungkin baru saja lenyap.
  void periksaArsipBerkala();

  keadaan.timer = setInterval(() => {
    void detakPenjadwal().catch(() => {});
  }, DETAK_PENJADWAL_MS);

  if (typeof keadaan.timer.unref === "function") keadaan.timer.unref();
}

function mulaiUlang() {
  berhenti();
  mulai();
}

/**
 * Keadaan untuk menimbang SELA tarikan satu perkara (ecourtTarikSatuService).
 *
 * HANYA MEMBACA - tidak mengubah jadwal, kursor, atau kunci. Mengembalikan
 * kapan putaran utama berikutnya (berkala dan pagi) akan jatuh tempo, supaya
 * tarikan satu perkara dari kepala SIPP hanya dimulai bila ia pasti selesai
 * sebelum putaran utama; putaran utama yang SEDANG berjalan atau SEDANG dipilih
 * (sedangPutaranTerjadwal, sebelum jembatan dijalankan) juga terbaca sibuk.
 */
function keadaanGiliran(sekarangMs = Date.now()) {
  const pengaturan = getSettings();
  const berkala = keadaan.timer
    ? jadwalBerkalaBerikutnya({ aktif: pengaturan.aktif, berikutnyaMs: keadaan.berkalaBerikutnyaMs, sekarangMs, pengaturan })
    : null;
  const pagi = pengaturan.aktif
    ? jadwalPagiBerikutnya({ sekarangMs, pengaturan, terakhirTanggal: String(bacaPagi().tanggal || "") })
    : { waktu: null };
  return {
    aktif: pengaturan.aktif === true,
    sibuk: Boolean(keadaan.sedangPutaranTerjadwal || keadaan.sedangJalan),
    penarikanLain: !keadaan.sedangJalan && kunciMasihHidup(),
    memulihkan: pulihSedangMemakaiProfil(),
    berkalaBerikutnyaMs: berkala ? Date.parse(berkala) : null,
    pagiBerikutnyaMs: pagi.waktu ? Date.parse(pagi.waktu) : null,
  };
}

/** Keadaan penjadwal untuk ditampilkan portal. */
function getStatus() {
  const pengaturan = getSettings();
  return {
    pengaturan,
    berjalan: keadaan.timer !== null,
    sedangJalan: keadaan.sedangJalan,
    dalamJamKerja: dalamJamKerja(),
    terakhirMulai: keadaan.terakhirMulai,
    terakhirSelesai: keadaan.terakhirSelesai,
    terakhirKode: keadaan.terakhirKode,
    terakhirCatatan: keadaan.terakhirCatatan,
    jumlahPutaran: keadaan.jumlahPutaran,
    // Butir 12 + 13 Okt 10.05: putaran berkala berikutnya (waktu acak yang
    // SUDAH ditetapkan; null = tidak menyala) dan tarikan pagi.
    berikutnya: keadaan.timer
      ? jadwalBerkalaBerikutnya({ aktif: pengaturan.aktif, berikutnyaMs: keadaan.berkalaBerikutnyaMs, pengaturan })
      : null,
    pagi: (() => {
      const catatan = bacaPagi();
      const j = jadwalPagiBerikutnya({ pengaturan, terakhirTanggal: String(catatan.tanggal || "") });
      return {
        aktif: pengaturan.pagiAktif && pengaturan.aktif,
        jam: `${String(pengaturan.jamPagi).padStart(2, "0")}:${String(pengaturan.menitPagi).padStart(2, "0")}`,
        berikutnya: pengaturan.aktif ? j.waktu : null,
        susulan: j.susulan,
        terakhir: catatan.tanggal ? catatan : null,
      };
    })(),
    zonaWaktu: ZONA_WAKTU,
    // Keterangan putaran yang sedang berjalan, untuk layar pemantauan.
    sumber: keadaan.sumber,
    berkasLog: keadaan.berkasLog,
    perkaraDiminta: keadaan.perkaraDiminta,
    akun: keadaan.akun,
    kemajuan: keadaan.sedangJalan ? keadaan.kemajuan : null,
    daftarAkun: ecourtAkunService.daftarAkun(),
    // Penarikan dari PuTTY tidak terlihat oleh keadaan.sedangJalan. Kuncinya
    // yang memberi tahu bahwa ada penarikan lain di luar bot.
    adaPenarikanLain: !keadaan.sedangJalan && kunciMasihHidup(),
  };
}

/**
 * Menarik SELURUH berkas yang belum lengkap, atas permintaan dari portal.
 *
 * ============================================================================
 * PADANAN aleta-ecourt-unduh-latar.sh, BUKAN PENGGANTINYA
 * ============================================================================
 *
 * Menjalankan jembatan yang sama dengan argumen yang sama seperti skrip host
 * ketika MAKS=0: tanpa batas jumlah perkara, dan melewati perkara yang
 * berkasnya sudah lengkap. Skripnya tetap ada dan tetap dapat dipakai - yang
 * ditambahkan hanya pintu masuk dari portal, supaya petugas tidak perlu SSH.
 *
 * TIDAK ditunggu sampai selesai. Satu penarikan menyeluruh dapat berjam-jam,
 * dan menahan permintaan HTTP selama itu akan kehabisan waktu di proksi jauh
 * sebelum penarikannya selesai. Kemajuannya diikuti lewat berkas log.
 */
function mulaiPenarikanMenyeluruh({ olehSiapa = "" } = {}) {
  if (keadaan.sedangJalan) {
    return { ok: false, alasan: "penarikan_sedang_berjalan", berkasLog: keadaan.berkasLog };
  }
  if (kunciMasihHidup()) {
    return { ok: false, alasan: "penarikan_lain_masih_berjalan", berkasLog: "" };
  }

  void logService.logSecurityEvent({
    eventType: "ecourt_penarikan_menyeluruh_dimulai",
    severity: "warning",
    message: "Penarikan seluruh berkas e-Court dimulai dari portal.",
    metadata: { olehSiapa: String(olehSiapa || "") },
  });

  // Sengaja tidak di-await: lihat catatan di atas.
  void jalankanSatuPutaran({ maksPerkara: 0, sumber: "portal-menyeluruh" });

  return { ok: true, alasan: "", berkasLog: keadaan.berkasLog };
}

/**
 * Berapa perkara paling banyak dalam satu penekanan "tarik yang belum ada".
 *
 * ============================================================================
 * BERBATAS, DAN BATASNYA DIHITUNG DARI BATAS PUTARAN
 * ============================================================================
 *
 * Daftar sasaran mode belum-ada PADAT: tiap perkara di dalamnya benar-benar
 * dibuka, sangat berbeda dengan daftar biasa yang sebagian besarnya dilewati
 * murah. Taksirannya 8 detik per perkara ditambah 4 detik per berkas, ditambah
 * istirahat 1-3 menit tiap 40 perkara.
 *
 * 120 perkara karena itu kira-kira 1,5 jam - di bawah BATAS_PUTARAN_MS yang 2
 * jam. Dua ratus akan melewatinya, dan putaran yang dibunuh paksa memang tidak
 * kehilangan data (yang sudah terunduh sudah tercatat) tetapi catatannya
 * berbunyi "Dihentikan paksa" tiap kali, dan itu membingungkan orang yang
 * menekan tombolnya. Sisanya terambil pada penekanan berikutnya.
 */
const MAKS_BELUM_ADA = Number(process.env.ALETA_BOT_ECOURT_MAKS_BELUM_ADA || 120);

/**
 * Menarik HANYA perkara yang berkasnya belum ada.
 *
 * Empat bedanya dengan mulaiPenarikanMenyeluruh: acuannya seluruh arsip e-Court
 * menurut SIPP (2.527 perkara, bukan 200 setahun terakhir); perkara yang
 * berkasnya utuh tidak dibuka ulang hanya karena majelisnya belum
 * memverifikasi; perkara yang arsipnya kosong sama sekali didahulukan; dan
 * penariknya beristirahat tiap beberapa puluh perkara.
 *
 * TIDAK ditunggu sampai selesai - lihat catatan pada mulaiPenarikanMenyeluruh.
 */
function mulaiPenarikanBelumAda({ maksPerkara = MAKS_BELUM_ADA, olehSiapa = "" } = {}) {
  if (keadaan.sedangJalan) {
    return { ok: false, alasan: "penarikan_sedang_berjalan", berkasLog: keadaan.berkasLog };
  }
  if (kunciMasihHidup()) {
    return { ok: false, alasan: "penarikan_lain_masih_berjalan", berkasLog: "" };
  }

  const batas = Math.min(Math.max(Number(maksPerkara) || MAKS_BELUM_ADA, 1), 1000);

  void logService.logSecurityEvent({
    eventType: "ecourt_penarikan_belum_ada_dimulai",
    severity: "warning",
    message: "Penarikan berkas e-Court yang belum ada dimulai dari portal.",
    metadata: { olehSiapa: String(olehSiapa || ""), maksPerkara: batas },
  });

  void jalankanSatuPutaran({
    maksPerkara: batas,
    hanyaBelumAda: true,
    sumber: "portal-belum-ada",
  });

  return { ok: true, alasan: "", berkasLog: keadaan.berkasLog, maksPerkara: batas };
}

/**
 * Menarik SATU perkara sekarang juga.
 *
 * Berbeda dengan antrean titipan yang menunggu detak penjadwal berikutnya -
 * dan hanya jalan bila penjadwalnya menyala dan sedang jam kerja. Petugas yang
 * menekan tombol di sebelah nomor perkara sedang menunggu berkas itu.
 */
function mulaiPenarikanPerkara(nomorPerkara, { olehSiapa = "" } = {}) {
  const nomor = String(nomorPerkara || "").trim();
  if (!nomor) return { ok: false, alasan: "nomor_perkara_kosong", berkasLog: "" };

  if (keadaan.sedangJalan) {
    return { ok: false, alasan: "penarikan_sedang_berjalan", berkasLog: keadaan.berkasLog };
  }
  if (kunciMasihHidup()) {
    return { ok: false, alasan: "penarikan_lain_masih_berjalan", berkasLog: "" };
  }

  void logService.logSecurityEvent({
    eventType: "ecourt_penarikan_perkara_dimulai",
    severity: "info",
    message: "Penarikan satu perkara e-Court dimulai dari portal.",
    metadata: { nomorPerkara: nomor, olehSiapa: String(olehSiapa || "") },
  });

  void jalankanSatuPutaran({ nomorPerkara: nomor, sumber: "portal-perkara" });

  return { ok: true, alasan: "", berkasLog: keadaan.berkasLog };
}

/**
 * Menghentikan penarikan yang sedang berjalan.
 *
 * Hanya dapat menghentikan penarikan yang DIMULAI bot ini. Penarikan dari
 * PuTTY berjalan sebagai proses lain di luar jangkauan bot - untuk itu
 * petugas tetap perlu menghentikannya dari sana, dan pesannya mengatakan
 * demikian alih-alih berpura-pura berhasil.
 */
function hentikanPenarikan({ olehSiapa = "" } = {}) {
  if (!keadaan.sedangJalan || !keadaan.anak) {
    return { ok: false, alasan: kunciMasihHidup() ? "penarikan_lain_masih_berjalan" : "tidak_ada_penarikan" };
  }

  void logService.logSecurityEvent({
    eventType: "ecourt_penarikan_dihentikan",
    severity: "warning",
    message: "Penarikan e-Court dihentikan dari portal.",
    metadata: { olehSiapa: String(olehSiapa || ""), sumber: keadaan.sumber },
  });

  try {
    keadaan.anak.kill("SIGTERM");
  } catch {
    return { ok: false, alasan: "gagal_menghentikan" };
  }

  return { ok: true, alasan: "" };
}

module.exports = {
  BAWAAN,
  MAKS_BELUM_ADA,
  DETAK_PENJADWAL_MS,
  ZONA_WAKTU,
  bagianWaktu,
  aturAlat,
  bacaPagi,
  berhenti,
  detakPenjadwal,
  jadwalBerkalaBerikutnya,
  jadwalPagiBerikutnya,
  periksaPengaturan,
  perluTarikanPagi,
  putuskanDetak,
  selangAcakMs,
  waktuZona,
  dalamJamKerja,
  getSettings,
  getStatus,
  keadaanGiliran,
  hentikanPenarikan,
  jalankanSatuPutaran,
  mulaiPenarikanBelumAda,
  mulaiPenarikanMenyeluruh,
  mulaiPenarikanPerkara,
  mulai,
  mulaiUlang,
  saveSettings,
};
