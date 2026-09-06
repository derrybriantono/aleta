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
 * ============================================================================
 * KOMENTAR DIKOSONGKAN LEBIH DAHULU
 * ============================================================================
 *
 * Pemindai ini sempat memeriksa teks mentah, sehingga CONTOH di dalam komentar
 * ikut tertangkap. Yang terjadi persis begitu pada aleta-prompt-putusan.tsx:
 * kodenya benar - memakai apiPath() - tetapi keterangan di atasnya menuliskan
 * bentuk yang salah sebagai contoh, dan penjaganya menuduh berkas yang tidak
 * bersalah.
 *
 * Penjaga yang menuduh berkas benar lebih berbahaya daripada tidak ada
 * penjaga: yang pertama mengajari orang bahwa merahnya boleh diabaikan, dan
 * sesudah itu pelanggaran yang sungguhan pun ikut diabaikan.
 *
 * Karena itu komentar dikosongkan lebih dahulu - diganti spasi, bukan dibuang,
 * supaya nomor barisnya tetap menunjuk tempat yang benar. Pengosongannya
 * menyusuri sumber satu aksara demi satu aksara sambil mengingat sedang berada
 * di dalam apa: tali kata, tali kata bertanda punggung, regex, atau kode biasa.
 * Menyusuri dengan regex saja tidak cukup - "http://a" di dalam tali kata dan
 * /["']/ sebagai regex keduanya akan salah dibaca.
 */
export function kosongkanKomentar(sumber: string): string {
  const keluar: string[] = [];
  let i = 0;
  // Aksara bermakna terakhir, dipakai membedakan pembagian dari awal regex:
  // `a / b` adalah pembagian, `= /abc/` adalah regex.
  let taraTerakhir = "";

  const dorong = (aksara: string) => {
    keluar.push(aksara);
    if (!/\s/.test(aksara)) taraTerakhir = aksara;
  };
  const kosongkan = (aksara: string) => keluar.push(aksara === "\n" ? "\n" : " ");

  while (i < sumber.length) {
    const a = sumber[i];
    const b = sumber[i + 1];

    // ---- komentar satu baris ----
    if (a === "/" && b === "/") {
      while (i < sumber.length && sumber[i] !== "\n") kosongkan(sumber[i++]);
      continue;
    }

    // ---- komentar berblok ----
    if (a === "/" && b === "*") {
      kosongkan(sumber[i++]);
      kosongkan(sumber[i++]);
      while (i < sumber.length && !(sumber[i] === "*" && sumber[i + 1] === "/")) {
        kosongkan(sumber[i++]);
      }
      if (i < sumber.length) {
        kosongkan(sumber[i++]);
        kosongkan(sumber[i++]);
      }
      continue;
    }

    // ---- tali kata biasa ----
    if (a === '"' || a === "'") {
      dorong(sumber[i++]);
      while (i < sumber.length) {
        if (sumber[i] === "\\") {
          dorong(sumber[i++]);
          if (i < sumber.length) dorong(sumber[i++]);
          continue;
        }
        if (sumber[i] === a) {
          dorong(sumber[i++]);
          break;
        }
        if (sumber[i] === "\n") break; // tali kata tak tertutup - jangan menelan berkas
        dorong(sumber[i++]);
      }
      continue;
    }

    // ---- tali kata bertanda punggung ----
    //
    // Isinya dibiarkan apa adanya, termasuk ${...}. Yang penting di sini
    // hanyalah bahwa "//" di dalamnya tidak dibaca sebagai komentar.
    if (a === "`") {
      dorong(sumber[i++]);
      while (i < sumber.length) {
        if (sumber[i] === "\\") {
          dorong(sumber[i++]);
          if (i < sumber.length) dorong(sumber[i++]);
          continue;
        }
        if (sumber[i] === "`") {
          dorong(sumber[i++]);
          break;
        }
        dorong(sumber[i++]);
      }
      continue;
    }

    // ---- regex ----
    //
    // Sebuah "/" memulai regex bila aksara bermakna sebelumnya BUKAN penutup
    // nilai. Sesudah pengenal, angka, ")", atau "]", garis miring berarti
    // pembagian.
    if (a === "/" && !/[A-Za-z0-9_$)\]]/.test(taraTerakhir)) {
      dorong(sumber[i++]);
      let didalamKurung = false;
      while (i < sumber.length) {
        const c = sumber[i];
        if (c === "\\") {
          dorong(sumber[i++]);
          if (i < sumber.length) dorong(sumber[i++]);
          continue;
        }
        if (c === "[") didalamKurung = true;
        else if (c === "]") didalamKurung = false;
        else if (c === "/" && !didalamKurung) {
          dorong(sumber[i++]);
          break;
        } else if (c === "\n") break; // regex tak tertutup - berhenti di sini
        dorong(sumber[i++]);
      }
      continue;
    }

    dorong(sumber[i++]);
  }

  return keluar.join("");
}

/**
 * Mencari fetch("/api/..."), fetch(`/api/...`), dan fetch('/api/...') yang
 * TIDAK dibungkus apiPath/withBasePath.
 *
 * Dicari alamat yang menempel langsung pada fetch(, sebab itulah bentuk yang
 * benar-benar dikirim. Alamat yang disusun ke dalam peubah lebih dulu tidak
 * terjangkau pemindai teks - dan memang tidak dijanjikan tertangkap di sini.
 */
export function alamatTelanjang(sumberMentah: string) {
  const sumber = kosongkanKomentar(sumberMentah);
  const temuan: string[] = [];
  const pola = /fetch\(\s*(["'`])(\/(?!\/)[^"'`]*)\1/g;
  let cocok: RegExpExecArray | null;

  while ((cocok = pola.exec(sumber))) {
    const baris = sumber.slice(0, cocok.index).split(/\r?\n/).length;
    temuan.push(`${baris}: fetch("${cocok[2].slice(0, 70)}")`);
  }

  return temuan;
}

describe("pemindai penjaga ini sendiri", () => {
  // Penjaga yang tidak diuji adalah penjaga yang dipercaya tanpa alasan.
  // Delapan hal di bawah ini pernah atau dapat membuatnya salah baca.

  it("contoh salah di dalam komentar satu baris TIDAK dituduh", () => {
    const sumber = [
      "// fetch(\"/api/contoh\") polos tidak pernah sampai ke rutenya.",
      "const a = await fetch(apiPath(\"/api/benar\"));",
    ].join("\n");
    expect(alamatTelanjang(sumber)).toEqual([]);
  });

  it("contoh salah di dalam komentar berblok TIDAK dituduh", () => {
    const sumber = ["/*", " * fetch('/api/contoh')", " */", "const a = 1;"].join("\n");
    expect(alamatTelanjang(sumber)).toEqual([]);
  });

  it("pelanggaran sungguhan TETAP tertangkap, dengan nomor baris yang benar", () => {
    const sumber = [
      "// keterangan",
      "/* keterangan panjang",
      "   masih keterangan */",
      "const a = await fetch(\"/api/antrian\");",
    ].join("\n");
    expect(alamatTelanjang(sumber)).toEqual(['4: fetch("/api/antrian")']);
  });

  it("garis miring ganda di dalam tali kata bukan komentar", () => {
    const sumber = 'const u = "http://192.168.10.10:3003"; const a = fetch("/api/x");';
    expect(alamatTelanjang(sumber)).toEqual(['1: fetch("/api/x")']);
  });

  it("regex yang memuat tanda kutip tidak menelan kode sesudahnya", () => {
    const sumber = ['const p = /["\']/;', 'const a = fetch("/api/y");'].join("\n");
    expect(alamatTelanjang(sumber)).toEqual(['2: fetch("/api/y")']);
  });

  it("regex yang memuat garis miring terlindung tidak dibaca sebagai komentar", () => {
    const sumber = ["const p = /a\\/\\/b/;", 'const a = fetch("/api/z");'].join("\n");
    expect(alamatTelanjang(sumber)).toEqual(['2: fetch("/api/z")']);
  });

  it("pembagian tidak disangka regex", () => {
    const sumber = ["const r = (a) / (b) / (c);", 'const a = fetch("/api/w");'].join("\n");
    expect(alamatTelanjang(sumber)).toEqual(['2: fetch("/api/w")']);
  });

  it("garis miring ganda di dalam tali kata bertanda punggung bukan komentar", () => {
    const sumber = ["const u = `http://a`;", 'const a = fetch("/api/v");'].join("\n");
    expect(alamatTelanjang(sumber)).toEqual(['2: fetch("/api/v")']);
  });

  it("alamat bertanda punggung yang telanjang tetap tertangkap", () => {
    const sumber = "const a = fetch(`/api/perkara`);";
    expect(alamatTelanjang(sumber)).toEqual(['1: fetch("/api/perkara")']);
  });

  it("nomor baris tetap utuh sesudah komentar dikosongkan", () => {
    const sumber = ["/* a", "b", "c */", "", 'fetch("/api/akhir");'].join("\n");
    expect(kosongkanKomentar(sumber).split("\n").length).toBe(5);
    expect(alamatTelanjang(sumber)).toEqual(['5: fetch("/api/akhir")']);
  });
});

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
