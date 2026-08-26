#!/usr/bin/env node
"use strict";

/**
 * Membuktikan corong layanan mencatat yang benar DAN tidak menyimpan data
 * pribadi warga.
 *
 *   node scripts/verify-service-analytics.js
 *
 * Yang paling penting diuji di sini adalah privasinya. Statistik tentang warga
 * yang berperkara mudah sekali berubah menjadi salinan kedua dari "siapa
 * menanyakan perkara apa", dan itu justru data paling sensitif yang dipegang
 * pengadilan. Karena itu pemeriksaan sidik sesi ditaruh paling depan.
 *
 * Database ditiru agar pengujian tidak menyentuh basis data sungguhan.
 */

const path = require("path");

// botDbService diganti tiruan sebelum layanan dimuat.
const botDbPath = require.resolve("../services/botDbService");
const tersimpan = [];
require("../services/botDbService");
require.cache[botDbPath].exports = {
  ensureSchema: async () => true,
  addColumnIfMissing: async () => true,
  toMysqlDate: (value) => new Date(value).toISOString().slice(0, 19).replace("T", " "),
  query: async (sql, params = []) => {
    if (/^\s*CREATE TABLE/i.test(sql)) return [];
    if (/^\s*INSERT INTO aleta_bot_service_events/i.test(sql)) {
      tersimpan.push({ sql, params });
      return { affectedRows: 1 };
    }
    return [];
  },
  getDbStatus: () => ({ ok: true }),
};

const analytics = require("../services/serviceAnalyticsService");

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
const NOMOR_LAIN = "6285750765694";

async function utama() {
  console.log("\n== PRIVASI: nomor WhatsApp tidak pernah tersimpan ==");
  {
    tersimpan.length = 0;
    await analytics.record({ senderNumber: NOMOR, action: "case_menu" });
    await analytics.record({ senderNumber: NOMOR, action: "answered", optionKey: "jadwal", durationMs: 900 });

    const semuaParams = JSON.stringify(tersimpan.map((item) => item.params));
    periksa("nomor WhatsApp tidak ada di data tersimpan", !semuaParams.includes("6285242120977"));
    periksa("potongan nomor pun tidak ada", !semuaParams.includes("85242120977"));

    const sidik = analytics.sessionHash(NOMOR);
    periksa("sidik sesi bukan nomornya", !sidik.includes("6285242120977"));
    periksa("sidik sesi panjang tetap", sidik.length === 32);
    periksa("nomor berbeda menghasilkan sidik berbeda", analytics.sessionHash(NOMOR) !== analytics.sessionHash(NOMOR_LAIN));
    periksa("nomor sama pada hari sama menghasilkan sidik sama", analytics.sessionHash(NOMOR) === analytics.sessionHash(NOMOR));
  }

  console.log("\n== PRIVASI: sidik berganti tiap hari, tidak membentuk riwayat ==");
  {
    const hariIni = new Date("2026-08-22T10:00:00Z");
    const besok = new Date("2026-08-23T10:00:00Z");
    periksa(
      "orang yang sama di hari berbeda tidak dapat dirangkai",
      analytics.sessionHash(NOMOR, hariIni) !== analytics.sessionHash(NOMOR, besok)
    );
    periksa(
      "dalam satu hari tetap konsisten",
      analytics.sessionHash(NOMOR, new Date("2026-08-22T01:00:00Z")) ===
        analytics.sessionHash(NOMOR, new Date("2026-08-22T23:00:00Z"))
    );
  }

  console.log("\n== PRIVASI: nomor perkara dan isi pertanyaan tidak ikut ==");
  {
    tersimpan.length = 0;
    await analytics.record({
      senderNumber: NOMOR,
      action: "answered",
      optionKey: "akta",
      dataSource: "cache",
      durationMs: 120,
    });
    const semuaParams = JSON.stringify(tersimpan.map((item) => item.params));
    periksa("tidak ada nomor perkara", !/Pdt\.|PA\.Dgl|\/\d{4}\//.test(semuaParams));
    periksa("jenis informasi tetap dicatat", semuaParams.includes("akta"));
    periksa("sumber data tetap dicatat", semuaParams.includes("cache"));
  }

  console.log("\n== Pemetaan tahap corong ==");
  {
    periksa("daftar perkara -> menu dibuka", analytics.mapActionToEvent("case_menu").stage === "menu_dibuka");
    periksa("daftar informasi -> perkara dipilih", analytics.mapActionToEvent("info_menu").stage === "perkara_dipilih");
    periksa("jawaban -> terjawab", analytics.mapActionToEvent("answered").stage === "terjawab");
    periksa("jawaban kosong ditandai hasilnya", analytics.mapActionToEvent("empty_answer").outcome === "kosong");
    periksa("kegagalan ditandai hasilnya", analytics.mapActionToEvent("answer_failed").outcome === "gagal");
    periksa("pilihan salah ditandai", analytics.mapActionToEvent("invalid_selection").outcome === "pilihan_salah");
    periksa("tanpa perkara ditandai", analytics.mapActionToEvent("no_case").outcome === "tak_berhak");
    periksa("berhenti berlangganan ditandai", analytics.mapActionToEvent("opt_out").outcome === "berhenti");
    periksa("aksi tak dikenal diabaikan", analytics.mapActionToEvent("entah").stage === "" && analytics.mapActionToEvent("entah").outcome === "");
  }

  console.log("\n== Aksi tanpa makna corong tidak dicatat ==");
  {
    tersimpan.length = 0;
    const hasil = await analytics.record({ senderNumber: NOMOR, action: "entah_apa" });
    periksa("tidak menulis apa pun", tersimpan.length === 0);
    periksa("melaporkan tidak tercatat", hasil === false);
  }

  console.log("\n== Jawaban ikut mencatat tahap sebelumnya ==");
  {
    tersimpan.length = 0;
    await analytics.record({ senderNumber: NOMOR, action: "answered", optionKey: "jadwal" });
    periksa("dua baris tercatat", tersimpan.length === 2);
    const gabung = JSON.stringify(tersimpan.map((item) => item.params)) + tersimpan.map((i) => i.sql).join(" ");
    periksa("tahap terjawab tercatat", gabung.includes("terjawab"));
    periksa("tahap informasi diminta ikut tercatat", gabung.includes("informasi_diminta"));
  }

  console.log("\n== Urutan tahap corong ==");
  {
    const urutan = analytics.FUNNEL_STAGES.map((s) => s.key);
    periksa("empat tahap", urutan.length === 4);
    periksa("urutannya masuk akal", urutan.join(">") === "menu_dibuka>perkara_dipilih>informasi_diminta>terjawab");
    periksa("setiap tahap punya label manusia", analytics.FUNNEL_STAGES.every((s) => s.label && !s.label.includes("_")));
  }

  console.log("\n== Pencatatan tidak pernah menjatuhkan pelayanan ==");
  {
    // Database mendadak gagal.
    const asli = require.cache[botDbPath].exports.query;
    require.cache[botDbPath].exports.query = async () => {
      throw new Error("database tidak dapat dijangkau");
    };
    let terlempar = false;
    let hasil = null;
    try {
      hasil = await analytics.record({ senderNumber: NOMOR, action: "answered", optionKey: "jadwal" });
    } catch {
      terlempar = true;
    }
    require.cache[botDbPath].exports.query = asli;

    periksa("kegagalan database tidak melempar galat", terlempar === false);
    periksa("melaporkan gagal dicatat", hasil === false);
  }

  console.log("\n== Masukan rusak ditangani ==");
  {
    let terlempar = false;
    try {
      await analytics.record({});
      await analytics.record(undefined);
      await analytics.record({ senderNumber: "", action: "answered" });
      analytics.sessionHash("");
      analytics.sessionHash(null);
    } catch {
      terlempar = true;
    }
    periksa("tidak melempar galat", terlempar === false);
    periksa("nomor kosong menghasilkan sidik kosong", analytics.sessionHash("") === "");
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
