/**
 * Menjalankan Agen Penjaga Tenggat dari ujung ke ujung atas data SIPP
 * sungguhan, lalu MENCETAK laporan WhatsApp-nya apa adanya.
 *
 * Tidak mengirim apa pun. Tidak menyentuh WhatsApp. Dijalankan dengan:
 *   npx tsx scripts/coba-penjaga-tenggat.ts 2026-09-15
 *   npx tsx scripts/coba-penjaga-tenggat.ts 2026-09-15 --baru     (G1: + banding 14 hari, kasasi 14 hari, mediasi 30 hari, hitung mundur)
 *
 * Dengan --baru yang dicetak adalah laporan harian lama PLUS angka tiap aturan baru (jumlah fakta, dan jumlah butir per tingkat) untuk
 * mengukur apakah aturan baru menuduh terlalu banyak sebelum pengingat WhatsApp dinyalakan. Nama pihak dan isi perkara tidak dicetak.
 */
import { createRequire } from "node:module";
import path from "node:path";

import {
  SEMUA_ATURAN,
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
  const acuan = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "";
  const baru = process.argv.includes("--baru");
  const { acuan: hari, fakta, gagal } = await layanan.bacaFakta(acuan, { baru });

  const rapor = baru
    ? nilaiTenggat(fakta as Record<string, FaktaTenggat[]>, hari, { aturan: SEMUA_ATURAN, hitungMundur: true })
    : nilaiTenggat(fakta as Record<string, FaktaTenggat[]>, hari);

  console.log("=".repeat(64));
  console.log(susunLaporanHarian(rapor, { satker: "PA Donggala" }));
  console.log("=".repeat(64));
  console.log(
    `\nfakta terbaca: ${Object.entries(fakta)
      .map(([k, v]) => `${k}=${(v as unknown[]).length}`)
      .join(" ")}`
  );
  console.log(`butir: ${rapor.butir.length}  hitung: ${JSON.stringify(rapor.hitung)}${baru ? `  berjalan: ${rapor.berjalan}` : ""}`);
  if (baru) {
    for (const a of SEMUA_ATURAN) {
      const butir = rapor.butir.filter((b) => b.aturan === a.kode);
      const per = (t: string) => butir.filter((b) => b.tingkat === t).length;
      console.log(
        `  ${a.kode.padEnd(24)} fakta=${String(((fakta as Record<string, unknown[]>)[a.kode] || []).length).padStart(4)}  lewat=${per("lewat")} menjelang=${per("menjelang")} berjalan=${per("berjalan")} catatan=${per("catatan")}`
      );
    }
  }
  if (Object.keys(gagal).length) console.log(`gagal: ${JSON.stringify(gagal)}`);
  process.exit(0);
}

void utama();
