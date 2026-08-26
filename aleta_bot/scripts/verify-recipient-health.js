#!/usr/bin/env node
"use strict";

/**
 * Membuktikan pengaman anti-blokir bekerja TANPA pernah mendiamkan
 * pemberitahuan pengadilan.
 *
 *   node scripts/verify-recipient-health.js
 *
 * Ini pemeriksaan yang paling menentukan dari Tahap 1 anti-blokir. Kedua
 * pengaman di sini berpotensi MEMBATALKAN pengiriman, jadi yang diuji paling
 * keras bukan kemampuannya membatalkan, melainkan sikapnya ketika
 * pemeriksaannya sendiri gagal: pengiriman harus tetap jalan.
 */

const path = require("path");

// botDbService diganti tiruan agar tidak menyentuh database sungguhan.
const botDbPath = require.resolve("../services/botDbService");
require("../services/botDbService");
const state = { suppressed: new Set(), gagal: false };
require.cache[botDbPath].exports = {
  ensureSchema: async () => true,
  addColumnIfMissing: async () => true,
  toMysqlDate: (value) => new Date(value).toISOString().slice(0, 19).replace("T", " "),
  query: async (sql, params = []) => {
    if (state.gagal) throw new Error("database tidak dapat dijangkau");
    if (/^\s*CREATE TABLE/i.test(sql)) return [];
    if (/FROM aleta_bot_recipient_suppressions/i.test(sql) && /phone_number = \?/.test(sql)) {
      return state.suppressed.has(String(params[0])) ? [{ phone_number: params[0] }] : [];
    }
    if (/INSERT INTO aleta_bot_recipient_suppressions/i.test(sql)) {
      state.suppressed.add(String(params[0]));
      return { affectedRows: 1 };
    }
    if (/UPDATE aleta_bot_recipient_suppressions/i.test(sql)) {
      state.suppressed.delete(String(params[2]));
      return { affectedRows: 1 };
    }
    return [];
  },
  getDbStatus: () => ({ ok: true }),
};

const health = require("../services/recipientHealthService");
const outgoing = require("../services/outgoingChatService");

let lulus = 0;
let gagal = 0;

function periksa(label, kondisi) {
  if (kondisi) {
    lulus += 1;
    console.log(`  OK    ${label}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${label}`);
  }
}

const NOMOR = "6285242120977";

async function utama() {
  console.log("\n== Nomor terdaftar WhatsApp ==");
  {
    health.clearCache();
    const terdaftar = await health.isRegisteredOnWhatsapp(NOMOR, async () => true);
    periksa("nomor terdaftar dikenali", terdaftar.registered === true && terdaftar.checked === true);

    health.clearCache();
    const tidak = await health.isRegisteredOnWhatsapp(NOMOR, async () => false);
    periksa("nomor tidak terdaftar dikenali", tidak.registered === false && tidak.checked === true);
  }

  console.log("\n== Hasil pemeriksaan disimpan agar tidak berulang ==");
  {
    health.clearCache();
    let panggilan = 0;
    const checker = async () => {
      panggilan += 1;
      return true;
    };
    await health.isRegisteredOnWhatsapp(NOMOR, checker);
    await health.isRegisteredOnWhatsapp(NOMOR, checker);
    await health.isRegisteredOnWhatsapp(NOMOR, checker);
    periksa(`WhatsApp hanya ditanya sekali (${panggilan}x)`, panggilan === 1);

    const dariCache = await health.isRegisteredOnWhatsapp(NOMOR, checker);
    periksa("jawaban dari simpanan", dariCache.source === "cache");
  }

  console.log("\n== GAGAL-TERBUKA: pemeriksaan bermasalah tidak menghentikan kiriman ==");
  {
    health.clearCache();
    const galat = await health.isRegisteredOnWhatsapp(NOMOR, async () => {
      throw new Error("WhatsApp belum siap");
    });
    periksa("dianggap terdaftar", galat.registered === true);
    periksa("ditandai TIDAK diperiksa", galat.checked === false);
    periksa("alasannya dilaporkan", galat.source === "pemeriksaan_gagal");

    health.clearCache();
    const tanpaPemeriksa = await health.isRegisteredOnWhatsapp(NOMOR, null);
    periksa("tanpa pemeriksa: tetap boleh kirim", tanpaPemeriksa.registered === true && tanpaPemeriksa.checked === false);
  }

  console.log("\n== Nomor tidak terdaftar diperiksa ulang lebih cepat ==");
  {
    periksa("yang terdaftar ditahan lebih lama", health.REGISTRATION_TTL_MS > health.UNREGISTERED_TTL_MS);
    periksa("yang tidak terdaftar diperiksa ulang harian", health.UNREGISTERED_TTL_MS <= 24 * 60 * 60 * 1000);
  }

  console.log("\n== Penghentian nomor yang pesannya tidak sampai ==");
  {
    state.suppressed.clear();
    periksa("awalnya tidak dihentikan", (await health.isSuppressed(NOMOR)) === false);

    await health.suppress(NOMOR, { reason: "tidak_pernah_sampai", detail: "3 pesan" });
    periksa("setelah dihentikan terdeteksi", (await health.isSuppressed(NOMOR)) === true);

    await health.release(NOMOR);
    periksa("dapat diaktifkan kembali", (await health.isSuppressed(NOMOR)) === false);
  }

  console.log("\n== GAGAL-TERBUKA: database bermasalah tidak menghentikan kiriman ==");
  {
    state.suppressed.clear();
    await health.suppress(NOMOR, {});
    state.gagal = true;
    const hasil = await health.isSuppressed(NOMOR);
    state.gagal = false;
    periksa("database gagal -> dianggap tidak dihentikan", hasil === false);
  }

  console.log("\n== Ambang penilaian masuk akal ==");
  {
    periksa("menunggu lebih dari sehari sebelum menyimpulkan", health.UNDELIVERED_AFTER_HOURS >= 24);
    periksa("butuh beberapa pesan, bukan satu", health.UNDELIVERED_THRESHOLD >= 2);
  }

  console.log("\n== Penilaian mengecualikan nomor yang pernah berhasil ==");
  {
    const sumber = require("fs").readFileSync(
      path.resolve(__dirname, "..", "services", "recipientHealthService.js"),
      "utf8"
    );
    periksa(
      "kueri mengecualikan yang pernah terkirim sampai ponsel",
      /NOT IN \(\s*SELECT DISTINCT recipient_number/.test(sumber)
    );
    periksa("hanya menilai pesan yang benar-benar terkirim", /status = 'sent'/.test(sumber));
    periksa("memakai tanda terima ponsel, bukan server", /ack < 2/.test(sumber));
  }

  console.log("\n== Nomor disamarkan di laporan ==");
  {
    state.suppressed.clear();
    await health.suppress(NOMOR, { reason: "tidak_pernah_sampai" });
    const daftar = await health.listSuppressed();
    periksa("laporan tidak memuat nomor utuh", !JSON.stringify(daftar).includes(NOMOR));
  }

  console.log("\n== Deteksi tautan pemendek ==");
  {
    periksa("s.id terdeteksi", outgoing.findShortenerLinks("cek https://s.id/LTYh1").length === 1);
    periksa("bit.ly terdeteksi", outgoing.findShortenerLinks("cek https://bit.ly/abc").length === 1);
    periksa("tinyurl terdeteksi", outgoing.findShortenerLinks("cek http://tinyurl.com/xyz").length === 1);
    periksa("domain resmi tidak ditandai", outgoing.findShortenerLinks("https://pa-donggala.go.id/survei").length === 0);
    periksa("situs MA tidak ditandai", outgoing.findShortenerLinks("https://eac.mahkamahagung.go.id/").length === 0);
    periksa("teks tanpa tautan aman", outgoing.findShortenerLinks("Sidang Anda 8 September").length === 0);
    periksa("beberapa pemendek sekaligus terdeteksi", outgoing.findShortenerLinks("https://s.id/a dan https://bit.ly/b").length === 2);
  }

  console.log("\n== Masukan rusak ditangani ==");
  {
    let terlempar = false;
    try {
      await health.isRegisteredOnWhatsapp("", async () => true);
      await health.isSuppressed("");
      await health.isSuppressed(null);
      outgoing.findShortenerLinks(null);
      outgoing.findShortenerLinks(undefined);
    } catch {
      terlempar = true;
    }
    periksa("tidak melempar galat", terlempar === false);
  }

  console.log(`\nLulus: ${lulus}, Gagal: ${gagal}`);
  if (gagal > 0) {
    console.log("ADA PERIKSAAN YANG GAGAL.");
    process.exit(1);
  }
  console.log("SEMUA PERIKSAAN LULUS.");
  process.exit(0);
}

utama().catch((error) => {
  console.error("Gagal menjalankan pengujian:", error);
  process.exit(1);
});
