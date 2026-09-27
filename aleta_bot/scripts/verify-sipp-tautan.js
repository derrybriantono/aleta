#!/usr/bin/env node
"use strict";

/**
 * ============================================================================
 * TAUTAN HALAMAN PERKARA SIPP - LEWAT ROUTE HTTP SUNGGUHAN
 * ============================================================================
 *
 *   node scripts/verify-sipp-tautan.js
 *
 * Router gateway dimuat UTUH dan ditembak lewat HTTP di port sementara, supaya
 * yang teruji juga sambungannya: require layanan di kepala berkas rute, penjaga
 * token internal, dan kode HTTP tiap penolakan. Penyandinya sendiri diuji rinci
 * (vektor PHP, batas blok, pengurai config) di
 * manajemen_surat/src/test/sipp-tautan-bot.test.ts.
 *
 * Tidak ada MySQL yang disentuh (db_config ditiru) dan tidak ada kunci SIPP
 * yang dibaca: config.php yang dipakai buatan skrip ini, berisi KUNCI UJI, di
 * folder sementara.
 */

process.env.NODE_ENV = "test";
process.env.ALETA_BOT_INTERNAL_API_TOKEN = "token-uji-tautan";
delete process.env.ALETA_SIPP_ENCRYPTION_KEY;

const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const Module = require("module");

const KUNCI_UJI = "ujia1eta2026x";
const sementara = fs.mkdtempSync(path.join(os.tmpdir(), "aleta-verify-tautan-"));
const CONFIG_UJI = path.join(sementara, "config.php");
fs.writeFileSync(CONFIG_UJI, `<?php\n$config['encryption_key'] = '${KUNCI_UJI}';\n`, "latin1");
process.env.ALETA_SIPP_CONFIG_PATH = CONFIG_UJI;

// --- SIPP palsu -------------------------------------------------------------
const PERKARA = [{ perkaraId: 888, nomorPerkara: "53/Pdt.G/2019/PA.Dgl" }];
const kueri = [];
const dbPath = require.resolve(path.resolve(__dirname, "..", "db_config.js"));
require.cache[dbPath] = Object.assign(new Module(dbPath, null), {
  filename: dbPath,
  loaded: true,
  exports: {
    query(sql, params, callback) {
      const cb = typeof params === "function" ? params : callback;
      const nilai = Array.isArray(params) ? params : [];
      const teks = String(sql);
      kueri.push({ sql: teks, nilai });
      if (/FROM sys_config/i.test(teks)) return cb(null, [{ nilai: "4" }]);
      if (/WHERE p\.perkara_id = \?/.test(teks)) return cb(null, PERKARA.filter((p) => p.perkaraId === Number(nilai[0])));
      if (/WHERE p\.nomor_perkara = \?/.test(teks)) return cb(null, PERKARA.filter((p) => p.nomorPerkara === nilai[0]));
      return cb(null, []);
    },
  },
});

const express = require("express");
const router = require(path.resolve(__dirname, "..", "routes", "internalGatewayRoutes.js"));
const { _uji } = require(path.resolve(__dirname, "..", "services", "sippTautanService.js"));

let gagal = 0;
function periksa(label, benar, keterangan = "") {
  if (!benar) gagal += 1;
  console.log(`  ${benar ? "OK   " : "GAGAL"}  ${label}${benar || !keterangan ? "" : `  (${keterangan})`}`);
}

const app = express();
app.use("/internal/aleta-bot", router);

function minta(port, kueriTeks, token = process.env.ALETA_BOT_INTERNAL_API_TOKEN) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: `/internal/aleta-bot/sipp/tautan-perkara${kueriTeks}`,
        method: "GET",
        headers: token ? { "x-aleta-internal-token": token } : {},
      },
      (res) => {
        let isi = "";
        res.on("data", (c) => (isi += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(isi) });
          } catch {
            reject(new Error(`Jawaban bukan JSON (HTTP ${res.statusCode}): ${isi.slice(0, 200)}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

const server = app.listen(0, "127.0.0.1", async () => {
  const { port } = server.address();
  try {
    console.log("\n== Penjaga token ==");
    const tanpaToken = await minta(port, "?perkaraId=888", "");
    periksa("tanpa token internal ditolak 401", tanpaToken.status === 401, `HTTP ${tanpaToken.status}`);
    periksa("tanpa token, SIPP tidak disentuh", kueri.length === 0);

    console.log("\n== Tautan tersusun ==");
    const sah = await minta(port, `?perkaraId=888&nomor=${encodeURIComponent("53/Pdt.G/2019/PA.Dgl")}`);
    periksa("HTTP 200", sah.status === 200, `HTTP ${sah.status}`);
    const jalur = String(sah.body.jalur || "");
    periksa("jalur perkara_detil_agama/<segmen aman>", /^perkara_detil_agama\/[A-Za-z0-9]+={0,2}$/.test(jalur), jalur);
    const segmen = jalur.split("/")[1] || "";
    const dalam = Buffer.from(segmen, "base64").toString("latin1");
    const id = _uji.decodeCi(dalam, _uji.bahanDariKunci(Buffer.from(KUNCI_UJI, "latin1")));
    periksa("segmen didekode kunci config menjadi 888", id === "888", String(id));
    periksa("kunci tidak ada di jawaban", !JSON.stringify(sah.body).includes(KUNCI_UJI));
    periksa("seluruh kueri SELECT berparameter", kueri.every((k) => /^\s*SELECT\b/i.test(k.sql) && !k.sql.includes("888")));

    const kedua = await minta(port, "?perkaraId=888");
    periksa("IV acak: dua permintaan, dua tautan berbeda", kedua.body.jalur && kedua.body.jalur !== jalur);

    console.log("\n== Penolakan ==");
    const kasus = [
      ["", 400, "masukan_kosong"],
      ["?perkaraId=abc", 400, "perkara_id_tidak_sah"],
      ["?perkaraId=5", 404, "perkara_tidak_ditemukan"],
      [`?perkaraId=888&nomor=${encodeURIComponent("1/Pdt.G/1999/PA.Dgl")}`, 409, "nomor_tidak_cocok"],
    ];
    for (const [q, status, alasan] of kasus) {
      const r = await minta(port, q);
      periksa(`${q || "(kosong)"} -> ${status} ${alasan}`, r.status === status && r.body.alasan === alasan, `HTTP ${r.status} ${r.body.alasan}`);
      periksa(`   message berupa kalimat, tanpa error`, String(r.body.message || "").length > 10 && r.body.error === undefined);
    }

    fs.rmSync(CONFIG_UJI);
    const tanpaKunci = await minta(port, "?perkaraId=888");
    periksa("config SIPP hilang -> 503 kunci_tidak_terbaca", tanpaKunci.status === 503 && tanpaKunci.body.alasan === "kunci_tidak_terbaca", `HTTP ${tanpaKunci.status}`);
    // Jawaban ini sampai ke layar setiap petugas lewat portal: jalur container
    // dan nama pengaturan hanya boleh ada di log bot (baris [sippTautan] di atas).
    const teksJawaban = JSON.stringify(tanpaKunci.body);
    periksa(
      "   jawabannya tanpa jalur berkas maupun nama pengaturan",
      !teksJawaban.includes("config.php") && !/[A-Za-z]:[\\/]|ALETA_[A-Z_]+/.test(teksJawaban) && !teksJawaban.includes(path.basename(sementara)),
      teksJawaban.slice(0, 160)
    );
  } catch (galat) {
    gagal += 1;
    console.log(`  GAGAL  ${galat.message}`);
  } finally {
    server.close();
    fs.rmSync(sementara, { recursive: true, force: true });
    console.log(gagal ? `\n${gagal} pemeriksaan GAGAL.` : "\nSeluruh pemeriksaan lulus.");
    // Router memuat layanan yang memasang pengatur waktu; proses diakhiri tegas.
    process.exit(gagal ? 1 : 0);
  }
});
