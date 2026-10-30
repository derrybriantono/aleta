/**
 * Logo kop monokrom tajam untuk blangko sampul/daftar isi/ceklist (paket sampul-rapi-30okt).
 * Sumber = logo kop satker yang tersimpan di blangko satker itu sendiri (gambar terbesar bergaya logo pengadilan di folder Derry,
 * mis. "99 PTSP/@ 0 - PMH - PHS.rtf"), BUKAN gambar tetap di kode: satker lain menjalankan alat ini atas blangkonya sendiri.
 * Cara monokrom = lib portal (manajemen_surat/src/lib/logo-monokrom.ts), sama persis dengan yang dipakai portal saat cetak lewat panel.
 *
 * pakai (dari folder manajemen_surat):
 *   npx tsx ../abt-paket/sampul-rapi-30okt/alat/logo_mono.ts <gambar sumber png/jpg> <keluar.png> [lebar px, bawaan 640]
 */
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { monokromTajam } from "../../../manajemen_surat/src/lib/logo-monokrom";

// sharp dari node_modules portal (alat ini dijalankan dari folder manajemen_surat)
const sharp = createRequire(path.resolve(process.cwd(), "package.json"))("sharp") as typeof import("sharp");

async function main() {
  const [sumber, keluar, lebarTeks] = process.argv.slice(2);
  if (!sumber || !keluar) throw new Error("pakai: logo_mono.ts <sumber> <keluar.png> [lebar]");
  const lebar = Number(lebarTeks) || 640;
  const potong = await sharp(sumber).ensureAlpha().trim({ threshold: 10 }).png().toBuffer();
  const { data, info } = await sharp(potong).ensureAlpha().resize({ width: lebar, kernel: "lanczos3" }).raw().toBuffer({ resolveWithObject: true });
  const mono = monokromTajam({ data: new Uint8Array(data.buffer, data.byteOffset, data.length), lebar: info.width, tinggi: info.height });
  const png = await sharp(Buffer.from(mono.data), { raw: { width: info.width, height: info.height, channels: 1 } }).png({ palette: true, colors: 2, compressionLevel: 9 }).toBuffer();
  writeFileSync(keluar, png);
  console.log(JSON.stringify({ keluar, lebar: info.width, tinggi: info.height, cara: mono.cara, bita: png.length }));
}

void main();
