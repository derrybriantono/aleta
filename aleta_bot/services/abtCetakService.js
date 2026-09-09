"use strict";

/**
 * ============================================================================
 * MENGUBAH RTF PUTUSAN MENJADI PDF
 * ============================================================================
 *
 * ABT menerbitkan putusan sebagai RTF - satu-satunya bentuk yang dihasilkannya.
 * Rute abt/preview mengembalikan RTF, dan anonimisasi juga mengembalikan RTF.
 * Tidak ada satu pun rute di ABT yang menghasilkan PDF.
 *
 * Yang dipakai di sini mesin yang SAMA dengan yang sudah dipakai ABT sendiri:
 * soffice. ABT memanggilnya untuk mengubah docx menjadi rtf pada anonimisasi
 * (lihat convert_putusan di models/abt/Anonimisasi.php). Memakai mesin yang
 * sama berarti hasilnya sekeluarga dengan hasil ABT, bukan penafsiran kedua
 * atas dokumen yang sama.
 *
 * ============================================================================
 * KENAPA BUKAN PENGURAI RTF DI JAVASCRIPT
 * ============================================================================
 *
 * Ada beberapa pustaka yang mengaku dapat membaca RTF dan menulis PDF. Tidak
 * satu pun dapat dipercaya untuk dokumen pengadilan: tata letak yang bergeser
 * sedikit pun - satu baris pindah halaman, satu tabel melebar - menghasilkan
 * PDF yang berbeda dari RTF yang ditandatangani. Untuk putusan, dokumen yang
 * "hampir sama" adalah dokumen yang salah.
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 * Layanan ini menerima berkas dari peramban petugas, dan berkas dari luar
 * tidak pernah dipercaya:
 *
 *   1. HANYA RTF. Diperiksa dari isinya - harus dibuka dengan "{\rtf" - bukan
 *      dari nama atau tipe yang dikirim. Nama berkas dapat ditulis siapa saja.
 *   2. BATAS UKURAN. Putusan terpanjang di pengadilan ini belasan halaman;
 *      20 MB sudah jauh di atasnya, dan batas itu menahan berkas yang tidak
 *      wajar sebelum soffice sempat dijalankan.
 *   3. NAMA BERKAS DITENTUKAN DI SINI, bukan diterima dari luar. Nama dari
 *      luar dapat memuat "../" dan menulis ke tempat yang tidak dimaksudkan.
 *   4. FOLDER SEKALI PAKAI, dibuang sesudahnya - berhasil maupun gagal.
 *   5. BATAS WAKTU. soffice yang menggantung tidak boleh menahan permintaan
 *      selamanya; prosesnya dibunuh dan sebabnya disebut.
 */

const { execFile } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

/** Putusan terpanjang belasan halaman; ini jauh di atasnya. */
const BATAS_BYTE = 20 * 1024 * 1024;

/** soffice yang menggantung tidak boleh menahan permintaan selamanya. */
const BATAS_WAKTU_MS = 90_000;

/**
 * Jalur soffice.
 *
 * Dapat ditimpa lewat lingkungan supaya pemasangan yang menaruhnya di tempat
 * lain tidak menuntut perubahan kode.
 */
const SOFFICE = process.env.ALETA_SOFFICE || "soffice";

function jalankan(perintah, argumen, opsi) {
  return new Promise((resolve, reject) => {
    execFile(perintah, argumen, { timeout: BATAS_WAKTU_MS, ...(opsi || {}) }, (galat, keluaran, galatKeluaran) => {
      if (galat) {
        galat.keluaran = String(keluaran || "");
        galat.galatKeluaran = String(galatKeluaran || "");
        reject(galat);
        return;
      }
      resolve({ keluaran: String(keluaran || ""), galatKeluaran: String(galatKeluaran || "") });
    });
  });
}

/** Apakah soffice benar-benar ada dan dapat dijalankan? */
async function periksaMesin() {
  try {
    const { keluaran } = await jalankan(SOFFICE, ["--version"]);
    return { ada: true, versi: keluaran.split("\n")[0].trim() };
  } catch (galat) {
    return {
      ada: false,
      sebab:
        galat.code === "ENOENT"
          ? `${SOFFICE} tidak ada di dalam container bot. PDF tidak dapat diterbitkan sampai LibreOffice terpasang di sana.`
          : String(galat.message || galat).slice(0, 200),
    };
  }
}

/**
 * Mengubah satu RTF menjadi PDF.
 *
 * @param {Buffer} isiRtf isi berkas RTF apa adanya
 * @returns {Promise<{ok: boolean, pdf?: Buffer, alasan?: string}>}
 */
async function rtfKePdf(isiRtf) {
  if (!Buffer.isBuffer(isiRtf) || isiRtf.length === 0) {
    return { ok: false, alasan: "Berkas RTF kosong." };
  }
  if (isiRtf.length > BATAS_BYTE) {
    return {
      ok: false,
      alasan: `Berkas ${Math.round(isiRtf.length / 1024 / 1024)} MB melewati batas ${BATAS_BYTE / 1024 / 1024} MB.`,
    };
  }
  // Diperiksa dari ISINYA, bukan dari nama atau tipe yang dikirim.
  if (!isiRtf.subarray(0, 5).toString("latin1").startsWith("{\\rtf")) {
    return { ok: false, alasan: "Isinya bukan berkas RTF." };
  }

  const mesin = await periksaMesin();
  if (!mesin.ada) return { ok: false, alasan: mesin.sebab };

  // Folder sekali pakai. Namanya ditentukan di sini, bukan diterima dari luar.
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), "aleta-pdf-"));
  const berkasRtf = path.join(folder, "putusan.rtf");
  const berkasPdf = path.join(folder, "putusan.pdf");

  try {
    await fs.writeFile(berkasRtf, isiRtf);

    // -env:UserInstallation memberi soffice profil tersendiri. Tanpa itu, dua
    // konversi yang berjalan bersamaan bertengkar atas profil yang sama dan
    // salah satunya gagal tanpa keterangan - cara yang sama dipakai ABT.
    await jalankan(
      SOFFICE,
      [
        "--headless",
        "--norestore",
        `-env:UserInstallation=file://${path.join(folder, "profil")}`,
        "--convert-to",
        "pdf",
        berkasRtf,
        "--outdir",
        folder,
      ],
      { cwd: folder }
    );

    const pdf = await fs.readFile(berkasPdf);
    if (!pdf.subarray(0, 5).toString("latin1").startsWith("%PDF-")) {
      return { ok: false, alasan: "soffice selesai tetapi hasilnya bukan PDF." };
    }
    return { ok: true, pdf, versiMesin: mesin.versi };
  } catch (galat) {
    if (galat.killed) {
      return { ok: false, alasan: `Konversi melewati ${BATAS_WAKTU_MS / 1000} detik dan dihentikan.` };
    }
    if (galat.code === "ENOENT") {
      return { ok: false, alasan: "soffice selesai tanpa menghasilkan berkas PDF." };
    }
    return { ok: false, alasan: String(galat.message || galat).slice(0, 200) };
  } finally {
    // Dibuang berhasil maupun gagal. Folder yang tertinggal berisi putusan
    // lengkap beserta nama pihaknya, dan /tmp bukan tempat untuk itu.
    await fs.rm(folder, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = { rtfKePdf, periksaMesin, BATAS_BYTE };
