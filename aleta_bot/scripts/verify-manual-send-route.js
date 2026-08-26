#!/usr/bin/env node
// =============================================================================
// Verifikasi Kirim Manual MELALUI ROUTE HTTP, bukan hanya lewat service.
//
//   node scripts/verify-manual-send-route.js
//
// LATAR: pernah terjadi bug yang lolos dari semua pengujian karena skrip lama
// memanggil manualSendService.previewManualSend() secara LANGSUNG. Portal
// mengirim employeeRecipients dan notificationName, tetapi route
// /manual-send/preview tidak ikut mengambil kedua field itu dari req.body,
// sehingga dibuang diam-diam. Akibatnya sumber data pegawai selalu 0 baris.
//
// Skrip ini menembak route sungguhan lewat HTTP supaya kesenjangan seperti itu
// ketahuan. Tidak menyentuh database dan tidak mengirim pesan.
// =============================================================================
process.env.NODE_ENV = "test";
process.env.ALETA_BOT_INTERNAL_API_TOKEN = process.env.ALETA_BOT_INTERNAL_API_TOKEN || "token-uji-lokal";

const path = require("path");
const http = require("http");

// Palsukan scheduler agar tidak menyentuh SIPP: kembalikan data sesuai nama
// pegawai yang dioper, meniru getDataJadwalSidangPerdataHakim(nama).
const schedPath = require.resolve(path.resolve(__dirname, "..", "services", "dynamicNotificationSchedulerService.js"));
const dataPerHakim = {
  "DERRY BRIANTONO": "1. 296/Pdt.G/2026/PA.Dgl - 09:00 - Ruang Sidang 1",
  IDRIS: "1. 397/Pdt.G/2026/PA.Dgl - 10:00 - Ruang Sidang 2",
};
require.cache[schedPath] = {
  id: schedPath,
  filename: schedPath,
  loaded: true,
  exports: {
    // Scheduler asli memangkas gelar sebelum dipakai memfilter SIPP, jadi
    // tiruan ini memakai util yang SAMA agar perilakunya setara.
    runSourceQuery: async (_query, recipient) => {
      const { normalizeLegacyEmployeeName } = require(path.resolve(__dirname, "..", "services", "employeeNameUtil.js"));
      const nama = normalizeLegacyEmployeeName((recipient && recipient.name) || "Pegawai");
      return { rows: [], text: dataPerHakim[nama] ?? "" };
    },
    normalizeLegacyEmployeeName: require(path.resolve(__dirname, "..", "services", "employeeNameUtil.js"))
      .normalizeLegacyEmployeeName,
  },
};

const express = require("express");
const router = require(path.resolve(__dirname, "..", "routes", "internalGatewayRoutes.js"));

let gagal = 0;
function periksa(label, aktual, harapan) {
  const ok = String(aktual) === String(harapan);
  if (!ok) gagal += 1;
  console.log(`  ${ok ? "OK   " : "GAGAL"}  ${label.padEnd(52)} -> ${aktual}${ok ? "" : ` (harap ${harapan})`}`);
}

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use("/internal/aleta-bot", router);

const server = app.listen(0, async () => {
  const port = server.address().port;

  const kirim = (body) =>
    new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const req = http.request(
        {
          host: "127.0.0.1",
          port,
          path: "/internal/aleta-bot/manual-send/preview",
          method: "POST",
          headers: {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(data),
            "x-aleta-internal-token": process.env.ALETA_BOT_INTERNAL_API_TOKEN,
          },
        },
        (res) => {
          let buf = "";
          res.on("data", (c) => (buf += c));
          res.on("end", () => {
            try {
              resolve({ status: res.statusCode, body: JSON.parse(buf) });
            } catch (e) {
              reject(new Error(`Respons bukan JSON (HTTP ${res.statusCode}): ${buf.slice(0, 200)}`));
            }
          });
        }
      );
      req.on("error", reject);
      req.write(data);
      req.end();
    });

  const payload = {
    query: {
      id: "legacy-hakim-sidang-hari-ini",
      name: "Hakim - Daftar Sidang Hari Ini",
      category: "employee",
      sqlText: "legacy:notifikasi.getDataJadwalSidangPerdataHakim",
    },
    template: {
      id: "hakim-jadwal-tugas-sidang",
      title: "Hakim - Jadwal dan Tugas Sidang",
      body: "*Hai {{nama_pegawai}}*\n\n*{{judul_notifikasi}}*\n\n{{ringkasan}}",
    },
    // Inilah dua field yang dulu hilang di route.
    employeeRecipients: [
      { name: "DERRY BRIANTONO, S.H.", whatsappNumber: "6285255956962" },
      { name: "IDRIS, S.H.I., M.H.", whatsappNumber: "6281354235594" },
      { name: "HAKIM TANPA SIDANG", whatsappNumber: "6282246423966" },
    ],
    notificationName: "Hakim - Sidang Hari Ini",
    params: {},
    manualValues: {},
    selectedRowIndex: 0,
    maxRows: 1000,
  };

  try {
    console.log("Menembak POST /internal/aleta-bot/manual-send/preview ...\n");
    const { status, body } = await kirim(payload);
    periksa("HTTP 200", status, 200);
    periksa("respons ok", body.ok, true);

    const p = body.preview || {};
    const q = p.query || {};
    const t = p.template || {};
    const pesan = p.recipientMessages || [];

    console.log("\n  -- inti perbaikan: route meneruskan employeeRecipients --");
    periksa("query TIDAK dilaporkan kosong", q.empty, false);
    periksa("penerima = hanya pegawai yang punya data", (q.recipients || []).length, 2);
    periksa("ada pesan per-penerima", pesan.length, 2);

    console.log("\n  -- placeholder terisi --");
    periksa("judul_notifikasi terisi", (t.values && t.values.judul_notifikasi) || "", "Hakim - Sidang Hari Ini");
    periksa("tidak ada placeholder kosong", (t.missingPlaceholders || []).length, 0);
    periksa("template dinyatakan lengkap", t.complete, true);

    console.log("\n  -- tiap hakim menerima datanya sendiri --");
    const isi = pesan.map((m) => m.message || "");
    periksa("pesan antar hakim berbeda", new Set(isi).size, 2);
    periksa("hakim 1 memuat namanya", isi[0].includes("DERRY BRIANTONO"), true);
    periksa("hakim 1 tidak memuat nama hakim lain", isi[0].includes("IDRIS"), false);
    periksa("hakim 2 memuat namanya", isi[1].includes("IDRIS"), true);

    console.log(gagal === 0 ? "\nSEMUA PERIKSAAN LULUS" : `\n${gagal} PERIKSAAN GAGAL`);
  } catch (error) {
    console.error("\nGagal menguji route:", error.message);
    gagal += 1;
  } finally {
    server.close();
    process.exit(gagal === 0 ? 0 : 1);
  }
});
