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

// Butir 45 (17 Okt): metadata berkas yang masuk SIPP tanpa tanda ALETA.
const { tanpaTandaAletaMetadata } = require("./metadataTanpaAletaService");

/** Putusan terpanjang belasan halaman; ini jauh di atasnya. */
const BATAS_BYTE = 20 * 1024 * 1024;

/**
 * soffice yang menggantung tidak boleh menahan permintaan selamanya.
 *
 * Batas ini PER KONVERSI. Urutan batas unggah putusan (kontrak K6) harus
 * menaik dari dalam ke luar: bot < gerbang 120 dtk < ekstensi 150 dtk. Dua
 * berkas diubah BERSAMAAN (putusanUnggahService), jadi yang dijumlahkan
 * hanya satu periksa mesin (BATAS_PERIKSA_MESIN_MS) dan satu konversi:
 * 20 + 90 = 110 dtk, masih di bawah 120 dtk gerbang.
 */
const BATAS_WAKTU_MS = 90_000;

/**
 * Batas untuk "soffice --version" saja. Jawabannya normalnya di bawah dua
 * detik; dahulu ia memakai batas konversi 90 dtk, sehingga satu permintaan
 * dapat menunggu 90 + 90 dtk - jauh melewati gerbang.
 */
const BATAS_PERIKSA_MESIN_MS = 20_000;

/**
 * ============================================================================
 * HASIL PERIKSA MESIN DISINGGAHKAN, PALING LAMA LIMA MENIT
 * ============================================================================
 *
 * Tiap konversi dahulu menjalankan DUA proses: "soffice --version" lalu
 * konversinya. Satu unggahan dua RTF = empat proses soffice, dua di antaranya
 * hanya untuk bertanya hal yang sama. Kini jawabannya disimpan paling lama
 * lima menit, dan pemeriksaan yang berjalan bersamaan berbagi SATU proses.
 *
 * Yang disinggahkan hanya jawaban yang pasti: "ada" (beserta versinya) dan
 * "tidak ada" (ENOENT - soffice tidak terpasang; memasangnya menuntut
 * container dibangun ulang, yang mengosongkan singgahan ini). Kegagalan lain
 * - habis waktu karena mesin sedang sibuk - TIDAK disinggahkan: satu
 * perlambatan sesaat tidak boleh menolak konversi selama lima menit.
 */
const MASA_SINGGAH_MESIN_MS = 5 * 60_000;
let singgahanMesin = null; // { hasil, pada }
let periksaMesinBerjalan = null; // Promise yang sedang ditunggu bersama

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

/** Menjalankan "soffice --version" sekarang juga, tanpa singgahan. */
async function periksaMesinSekarang() {
  try {
    const { keluaran } = await jalankan(SOFFICE, ["--version"], { timeout: BATAS_PERIKSA_MESIN_MS });
    return { hasil: { ada: true, versi: keluaran.split("\n")[0].trim() }, pasti: true };
  } catch (galat) {
    const tidakTerpasang = galat.code === "ENOENT";
    return {
      hasil: {
        ada: false,
        sebab: tidakTerpasang
          ? `${SOFFICE} tidak ada di dalam container bot. PDF tidak dapat diterbitkan sampai LibreOffice terpasang di sana.`
          : String(galat.message || galat).slice(0, 200),
      },
      pasti: tidakTerpasang,
    };
  }
}

/**
 * Apakah soffice benar-benar ada dan dapat dijalankan?
 *
 * Dijawab dari singgahan bila umurnya di bawah lima menit; bila ada
 * pemeriksaan yang sedang berjalan, jawabannya ditunggu bersama. Lihat
 * catatan MASA_SINGGAH_MESIN_MS.
 */
async function periksaMesin() {
  const kini = Date.now();
  if (
    singgahanMesin &&
    kini >= singgahanMesin.pada &&
    kini - singgahanMesin.pada < MASA_SINGGAH_MESIN_MS
  ) {
    return { ...singgahanMesin.hasil };
  }
  if (!periksaMesinBerjalan) {
    periksaMesinBerjalan = periksaMesinSekarang()
      .then(({ hasil, pasti }) => {
        singgahanMesin = pasti ? { hasil, pada: Date.now() } : null;
        return hasil;
      })
      .finally(() => {
        periksaMesinBerjalan = null;
      });
  }
  return { ...(await periksaMesinBerjalan) };
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
    // Properti naskah ({\info}) tanpa tanda ALETA - Title PDF disalin dari sana.
    await fs.writeFile(berkasRtf, tanpaTandaAletaMetadata(isiRtf));

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
    return { ok: true, pdf: tanpaTandaAletaMetadata(pdf), versiMesin: mesin.versi };
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

/**
 * ============================================================================
 * JENIS DOKUMEN DIKENALI DARI BITANYA, BUKAN DARI NAMANYA
 * ============================================================================
 *
 * Nama berkas dapat diubah siapa saja; kepala berkasnya tidak. Keempat bentuk
 * inilah yang sungguh dipakai satker - diukur pada kolom
 * perkara_putusan.amar_putusan_dok, 9.903 nilai terisi:
 *
 *     .rtf   8.686   (87,7%)
 *     .docx    458
 *     .doc     442
 *     .pdf     315   ( 3,2%)
 *
 * Jadi PDF justru yang paling JARANG. Yang lazim ditulis hakim adalah RTF dari
 * templat satker.
 */
function kenaliDokumen(isi) {
  if (!Buffer.isBuffer(isi) || isi.length < 5) return "";
  const kepala = isi.subarray(0, 8);
  if (kepala.subarray(0, 5).toString("latin1").startsWith("%PDF-")) return "pdf";
  if (kepala.subarray(0, 5).toString("latin1").startsWith("{\\rtf")) return "rtf";
  // docx, xlsx, dan seluruh Open XML adalah zip - "PK\x03\x04".
  if (kepala[0] === 0x50 && kepala[1] === 0x4b && kepala[2] === 0x03 && kepala[3] === 0x04) {
    return "docx";
  }
  // doc lama: OLE Compound File, D0 CF 11 E0 A1 B1 1A E1.
  if (kepala[0] === 0xd0 && kepala[1] === 0xcf && kepala[2] === 0x11 && kepala[3] === 0xe0) {
    return "doc";
  }
  return "";
}

/**
 * Mengubah RTF, DOC, atau DOCX menjadi PDF. PDF dikembalikan apa adanya.
 *
 * ============================================================================
 * KENAPA INI ADA, PADAHAL rtfKePdf SUDAH ADA
 * ============================================================================
 *
 * rtfKePdf menolak apa pun yang bukan RTF, dan penolakan itu benar untuk
 * pemanggilnya - dokumen penetapan memang selalu RTF dari blangko ALETA.
 * Unggah putusan berbeda: yang diserahkan hakim adalah naskah yang sudah ia
 * tulis, dan bentuknya apa saja di antara keempat itu.
 *
 * soffice menangani ketiganya dengan argumen yang sama persis; yang berbeda
 * hanya akhiran berkas sementaranya, dan soffice memang mengenali jenisnya
 * dari akhiran itu.
 *
 * PDF TIDAK diubah apa-apa. Melewatkannya ke soffice hanya menambah satu
 * kesempatan gagal atas berkas yang sudah benar bentuknya.
 *
 * @param {Buffer} isi isi berkas apa adanya
 * @returns {Promise<{ok: boolean, pdf?: Buffer, jenis?: string, alasan?: string}>}
 */
async function dokumenKePdf(isi) {
  if (!Buffer.isBuffer(isi) || isi.length === 0) {
    return { ok: false, alasan: "Berkasnya kosong." };
  }
  if (isi.length > BATAS_BYTE) {
    return {
      ok: false,
      alasan: `Berkas ${Math.round(isi.length / 1024 / 1024)} MB melewati batas ${BATAS_BYTE / 1024 / 1024} MB.`,
    };
  }

  const jenis = kenaliDokumen(isi);
  if (!jenis) {
    return {
      ok: false,
      alasan: "Isinya bukan PDF, RTF, DOC, maupun DOCX - dikenali dari kepala berkasnya.",
    };
  }
  if (jenis === "pdf") return { ok: true, pdf: tanpaTandaAletaMetadata(isi), jenis };

  const mesin = await periksaMesin();
  if (!mesin.ada) return { ok: false, jenis, alasan: mesin.sebab };

  const folder = await fs.mkdtemp(path.join(os.tmpdir(), "aleta-pdf-"));
  const berkasAsal = path.join(folder, `naskah.${jenis}`);
  const berkasPdf = path.join(folder, "naskah.pdf");

  try {
    await fs.writeFile(berkasAsal, tanpaTandaAletaMetadata(isi));
    await jalankan(
      SOFFICE,
      [
        "--headless",
        "--norestore",
        `-env:UserInstallation=file://${path.join(folder, "profil")}`,
        "--convert-to",
        "pdf",
        berkasAsal,
        "--outdir",
        folder,
      ],
      { cwd: folder }
    );

    const pdf = await fs.readFile(berkasPdf);
    // Diperiksa HASILNYA, bukan kode keluar soffice. soffice pernah selesai
    // dengan kode 0 sambil menghasilkan berkas kosong.
    if (!pdf.subarray(0, 5).toString("latin1").startsWith("%PDF-")) {
      return { ok: false, jenis, alasan: "soffice selesai tetapi hasilnya bukan PDF." };
    }
    return { ok: true, pdf: tanpaTandaAletaMetadata(pdf), jenis, versiMesin: mesin.versi };
  } catch (galat) {
    if (galat.killed) {
      return { ok: false, jenis, alasan: `Konversi melewati ${BATAS_WAKTU_MS / 1000} detik dan dihentikan.` };
    }
    if (galat.code === "ENOENT") {
      return { ok: false, jenis, alasan: "soffice selesai tanpa menghasilkan berkas PDF." };
    }
    return { ok: false, jenis, alasan: String(galat.message || galat).slice(0, 200) };
  } finally {
    // Folder yang tertinggal berisi putusan lengkap beserta nama pihaknya.
    await fs.rm(folder, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * ============================================================================
 * MENGUBAH NASKAH KE BENTUK LAIN - RTF / DOCX / DOC / PDF (kontrak K1)
 * ============================================================================
 *
 * Perbaikan 30 September 2026, butir 8 dan 11. Putusan otomatis menerima
 * naskah DOCX, DOC, dan PDF (bukan hanya RTF), dan anonimisasi dibuat dalam
 * BENTUK YANG SAMA dengan edoc putusannya. Anonimisasi ABT hanya mengenal RTF,
 * jadi naskahnya diubah ke RTF, dianonimkan, lalu dikembalikan ke bentuk
 * asalnya - dua kali lewat sini.
 *
 * Mesinnya soffice yang sama dengan dokumenKePdf: folder sekali pakai, profil
 * tersendiri, batas 20 MB, batas waktu per konversi, hasil diperiksa dari
 * KEPALA BERKASNYA (bukan dari kode keluar soffice).
 *
 * PDF sebagai ASAL tidak ditangani di sini. soffice membuka PDF dengan Draw,
 * bukan Writer, dan hasil RTF/DOCX-nya berupa bingkai-bingkai gambar, bukan
 * naskah. Portal mengekstrak teksnya (pdfjs) menjadi RTF lebih dulu, lalu
 * - bila bentuk tujuannya bukan RTF - mengirim RTF itu ke sini.
 *
 * Hanya menghitung: tidak ada yang disimpan, tidak ada yang ditulis ke SIPP.
 */
const FILTER_KONVERSI = {
  rtf: "rtf:Rich Text Format",
  docx: "docx:MS Word 2007 XML",
  doc: "doc:MS Word 97",
  pdf: "pdf:writer_pdf_Export",
};

const BENTUK_TUJUAN = Object.keys(FILTER_KONVERSI);

/** Argumen soffice untuk satu konversi - dipisah supaya dapat diuji tanpa soffice. */
function argumenKonversi(ke, berkasAsal, folder) {
  return [
    "--headless",
    "--norestore",
    `-env:UserInstallation=file://${path.join(folder, "profil")}`,
    "--convert-to",
    FILTER_KONVERSI[ke],
    berkasAsal,
    "--outdir",
    folder,
  ];
}

/**
 * @param {Buffer} isi isi berkas apa adanya
 * @param {string} ke "rtf" | "docx" | "doc" | "pdf"
 * @param {{ jalankan?: Function, periksaMesin?: Function }} [opsi] pengganti untuk uji
 * @returns {Promise<{ok: boolean, berkas?: Buffer, bentukAsal?: string, ke?: string, alasan?: string, kode?: string}>}
 */
async function dokumenKeBentuk(isi, ke, opsi = {}) {
  const tujuan = String(ke || "").toLowerCase();
  if (!BENTUK_TUJUAN.includes(tujuan)) {
    return { ok: false, kode: "bentuk_tujuan_tidak_dikenal", alasan: `Bentuk tujuan "${ke}" tidak dikenal - pilih rtf, docx, doc, atau pdf.` };
  }
  if (!Buffer.isBuffer(isi) || isi.length === 0) {
    return { ok: false, kode: "berkas_kosong", alasan: "Berkasnya kosong." };
  }
  if (isi.length > BATAS_BYTE) {
    return {
      ok: false,
      kode: "terlalu_besar",
      alasan: `Berkas ${Math.round(isi.length / 1024 / 1024)} MB melewati batas ${BATAS_BYTE / 1024 / 1024} MB.`,
    };
  }

  const bentukAsal = kenaliDokumen(isi);
  if (!bentukAsal) {
    return {
      ok: false,
      kode: "bentuk_tidak_dikenal",
      alasan: "Isinya bukan PDF, RTF, DOC, maupun DOCX - dikenali dari kepala berkasnya.",
    };
  }
  // Sudah berbentuk tujuannya: dikembalikan apa adanya, tanpa satu kesempatan
  // gagal lagi di soffice.
  if (bentukAsal === tujuan) return { ok: true, berkas: tanpaTandaAletaMetadata(isi), bentukAsal, ke: tujuan };
  if (bentukAsal === "pdf") {
    return {
      ok: false,
      kode: "pdf_perlu_ekstraksi",
      bentukAsal,
      alasan: "PDF tidak diubah soffice - teksnya diekstrak portal lebih dulu.",
    };
  }

  const cekMesin = opsi.periksaMesin || periksaMesin;
  const mesin = await cekMesin();
  if (!mesin.ada) return { ok: false, kode: "soffice_tidak_ada", bentukAsal, alasan: mesin.sebab };

  const jalan = opsi.jalankan || jalankan;
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), "aleta-konversi-"));
  const berkasAsal = path.join(folder, `naskah.${bentukAsal}`);
  const berkasHasil = path.join(folder, `naskah.${tujuan}`);

  try {
    await fs.writeFile(berkasAsal, tanpaTandaAletaMetadata(isi));
    await jalan(SOFFICE, argumenKonversi(tujuan, berkasAsal, folder), { cwd: folder });
    const hasil = await fs.readFile(berkasHasil);
    // Diperiksa HASILNYA: kepala berkasnya harus bentuk yang diminta.
    if (kenaliDokumen(hasil) !== tujuan) {
      return { ok: false, kode: "hasil_bukan_bentuk_tujuan", bentukAsal, alasan: `soffice selesai tetapi hasilnya bukan ${tujuan.toUpperCase()}.` };
    }
    return { ok: true, berkas: tanpaTandaAletaMetadata(hasil), bentukAsal, ke: tujuan, versiMesin: mesin.versi };
  } catch (galat) {
    if (galat && galat.killed) {
      return { ok: false, kode: "waktu_habis", bentukAsal, alasan: `Konversi melewati ${BATAS_WAKTU_MS / 1000} detik dan dihentikan.` };
    }
    if (galat && galat.code === "ENOENT") {
      return { ok: false, kode: "tanpa_hasil", bentukAsal, alasan: `soffice selesai tanpa menghasilkan berkas ${tujuan.toUpperCase()}.` };
    }
    return { ok: false, kode: "gagal", bentukAsal, alasan: String((galat && galat.message) || galat).slice(0, 200) };
  } finally {
    // Folder yang tertinggal berisi putusan lengkap beserta nama pihaknya.
    await fs.rm(folder, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = {
  rtfKePdf,
  dokumenKePdf,
  dokumenKeBentuk,
  argumenKonversi,
  FILTER_KONVERSI,
  kenaliDokumen,
  tanpaTandaAletaMetadata,
  periksaMesin,
  BATAS_BYTE,
  BATAS_WAKTU_MS,
  BATAS_PERIKSA_MESIN_MS,
  MASA_SINGGAH_MESIN_MS,
};
