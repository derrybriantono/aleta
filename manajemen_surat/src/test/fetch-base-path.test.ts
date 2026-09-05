import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * SETIAP fetch() DARI PERAMBAN HARUS LEWAT apiPath()
 * ============================================================================
 *
 * Portal dipasang dengan basePath "/aleta". Alamat yang ditulis telanjang -
 * fetch("/api/sesuatu") - karena itu TIDAK pernah sampai ke rutenya: yang
 * menjawab adalah kerangka aplikasi berupa HTML, lalu respons.json() melempar,
 * dan layarnya menyimpulkan "belum dapat dibaca".
 *
 * Gagalnya sunyi, dan itulah yang membuatnya mahal. Tidak ada galat di log
 * server - menurut server tidak ada yang salah, sebab permintaannya memang
 * tidak pernah salah alamat. Tidak ada galat waktu build; TypeScript tidak
 * memeriksa isi teks alamat. Yang terlihat hanya layar kosong di ruang tunggu,
 * dan itu baru ketahuan saat petugas sudah berdiri di depan pintu ruang
 * sidang.
 *
 * Sembilan panggilan pernah lolos begitu sekaligus - seluruh layar antrian,
 * papan panggil, halaman ambil, dan halaman cepat tanpa login - sementara 68
 * komponen lain memakai helper dengan benar. Penjaga ini ada supaya yang
 * kesepuluh tidak perlu ditemukan lagi dari ruang tunggu.
 */

const AKAR = process.cwd();

/** Berkas yang berjalan di peramban saja. Rute API sisi server tidak kena. */
const DIPINDAI = ["src/components", "src/app", "src/lib", "src/hooks"];

function daftarBerkas(relatif: string): string[] {
  const penuh = path.join(AKAR, relatif);
  if (!fs.existsSync(penuh)) return [];

  const hasil: string[] = [];

  for (const isi of fs.readdirSync(penuh, { withFileTypes: true })) {
    const jalurPenuh = path.join(penuh, isi.name);
    const jalurRelatif = path.relative(AKAR, jalurPenuh).replaceAll("\\", "/");

    if (isi.isDirectory()) {
      // Rute API dijalankan di server, alamatnya tidak pernah dilewatkan
      // basePath.
      if (jalurRelatif.startsWith("src/app/api")) continue;
      hasil.push(...daftarBerkas(jalurRelatif));
    } else if (/\.(ts|tsx)$/.test(isi.name) && !/\.d\.ts$/.test(isi.name)) {
      hasil.push(jalurRelatif);
    }
  }

  return hasil;
}

/**
 * Mencari fetch("/api/..."), fetch(`/api/...`), dan fetch('/api/...') yang
 * TIDAK dibungkus apiPath/withBasePath.
 *
 * Dicari alamat yang menempel langsung pada fetch(, sebab itulah bentuk yang
 * benar-benar dikirim. Alamat yang disusun ke dalam peubah lebih dulu tidak
 * terjangkau pemindai teks - dan memang tidak dijanjikan tertangkap di sini.
 */
function alamatTelanjang(sumber: string) {
  const temuan: string[] = [];
  const pola = /fetch\(\s*(["'`])(\/(?!\/)[^"'`]*)\1/g;
  let cocok: RegExpExecArray | null;

  while ((cocok = pola.exec(sumber))) {
    const baris = sumber.slice(0, cocok.index).split(/\r?\n/).length;
    temuan.push(`${baris}: fetch("${cocok[2].slice(0, 70)}")`);
  }

  return temuan;
}

describe("alamat fetch dan basePath", () => {
  const berkas = DIPINDAI.flatMap((d) => daftarBerkas(d));

  it("memindai berkas yang memang ada", () => {
    expect(berkas.length).toBeGreaterThan(50);
  });

  it("tidak ada fetch beralamat telanjang di sisi peramban", () => {
    const pelanggaran: string[] = [];

    for (const jalur of berkas) {
      const sumber = fs.readFileSync(path.join(AKAR, jalur), "utf8");
      for (const satu of alamatTelanjang(sumber)) {
        pelanggaran.push(`${jalur}:${satu}`);
      }
    }

    expect(
      pelanggaran,
      "Alamat harus dibungkus apiPath() dari @/lib/base-path, jika tidak " +
        "permintaannya tidak pernah sampai ke rutenya saat portal dipasang " +
        "dengan basePath /aleta."
    ).toEqual([]);
  });

  it("berkas yang memanggil apiPath juga mengimpornya", () => {
    const kurang: string[] = [];

    for (const jalur of berkas) {
      const sumber = fs.readFileSync(path.join(AKAR, jalur), "utf8");
      if (jalur.endsWith("src/lib/base-path.ts")) continue;
      if (!/\bapiPath\s*\(/.test(sumber)) continue;
      if (!/from "@\/lib\/base-path"/.test(sumber)) kurang.push(jalur);
    }

    expect(kurang).toEqual([]);
  });
});
