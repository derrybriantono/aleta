/**
 * Menjalankan Agen Penjaga Tenggat dari ujung ke ujung atas data SIPP
 * sungguhan, lalu MENCETAK laporan WhatsApp-nya apa adanya.
 *
 * Tidak mengirim apa pun. Tidak menyentuh WhatsApp. Dijalankan dengan:
 *   npx tsx scripts/coba-penjaga-tenggat.ts 2026-09-15
 */
import { createRequire } from "node:module";
import path from "node:path";

import {
  type FaktaTenggat,
  nilaiTenggat,
  susunLaporanHarian,
} from "../src/lib/penjaga-tenggat";

const akarBot = path.resolve(process.cwd(), "..", "aleta_bot");
const require_ = createRequire(path.join(akarBot, "package.json"));

// ============================================================================
// .env BOT DIMUAT LEBIH DAHULU, DAN ITU BUKAN KERAPIAN
// ============================================================================
//
// db_config memanggil dotenv.config() tanpa jalur, jadi ia memuat .env milik
// DIREKTORI KERJA - di sini manajemen_surat, bukan aleta_bot. Akibatnya
// ALETA_BOT_DB_SIPP_NAME tidak terbaca dan sambungannya jatuh ke bawaan
// "SIPP", yang di MySQL Windows berarti basis data `sipp` (salinan PA Bungku).
//
// Gagalnya DIAM: ketujuh kueri berhasil dan memulangkan nol baris, persis
// seperti hari yang memang bersih. Laporan pertama yang saya cetak berbunyi
// "Tidak ada tenggat yang terlampaui" - benar menurut basis data yang keliru.
require_("dotenv").config({ path: path.join(akarBot, ".env") });

const layanan = require_("./services/penjagaTenggatService.js");

async function utama() {
  const acuan = process.argv[2] || "";
  const { acuan: hari, fakta, gagal } = await layanan.bacaFakta(acuan);

  const rapor = nilaiTenggat(fakta as Record<string, FaktaTenggat[]>, hari);

  console.log("=".repeat(64));
  console.log(susunLaporanHarian(rapor, { satker: "PA Donggala" }));
  console.log("=".repeat(64));
  console.log(
    `\nfakta terbaca: ${Object.entries(fakta)
      .map(([k, v]) => `${k}=${(v as unknown[]).length}`)
      .join(" ")}`
  );
  console.log(`butir: ${rapor.butir.length}  hitung: ${JSON.stringify(rapor.hitung)}`);
  if (Object.keys(gagal).length) console.log(`gagal: ${JSON.stringify(gagal)}`);
  process.exit(0);
}

void utama();
