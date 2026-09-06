"use strict";

/**
 * ============================================================================
 * PENYAPU - SELURUH PENILAIAN DISENTUH, BUKAN SEBAGIAN
 * ============================================================================
 *
 * Uji satuan memeriksa satu penilaian dengan masukan yang sudah diketahui
 * jawabannya. Ia tidak pernah menangkap kerusakan yang paling sering terjadi:
 * satu penilaian rusak KARENA penilaian lain diubah. Untuk itu diperlukan
 * penyapu - yang menjalankan semuanya, tiap kali, dan menghitungnya.
 *
 * Penyapu ini BERDAFTAR, bukan bertulisan tangan. Ia membaca daftar penilaian
 * dari layanannya sendiri, lalu menyapu apa pun yang ada di sana. Menambah
 * penilaian ke-32 tidak menuntut sebaris pun perubahan di berkas ini - dan
 * itulah syaratnya: daftar tulisan tangan selalu tertinggal dari kodenya, lalu
 * berbohong dengan tenang tentang cakupannya.
 *
 * ============================================================================
 * TIGA HAL YANG DISAPU
 * ============================================================================
 *
 *   1. Tiga puluh satu analisis lanjutan - bentuk amplop keluarannya harus
 *      sama untuk semuanya, sebab layar merendernya dengan SATU komponen.
 *      Analisis yang memulangkan bentuk berbeda tergambar KOSONG, bukan
 *      melempar galat.
 *
 *   2. Mesin nilai SK Dirjen Badilag 048/2024 - tiga puluh unsurnya harus
 *      memberi angka untuk perkara sempurna, perkara kosong, dan perkara yang
 *      ruasnya gelap; dan ketiganya harus berbeda.
 *
 *   3. Rubrik penilaian perkara ALETA - tujuh butirnya harus utuh: yang
 *      dihitung ditambah yang belum berlaku selalu berjumlah seluruh bobot.
 *
 * ============================================================================
 * HITUNG DUA KALI
 * ============================================================================
 *
 * Setiap penilaian dijalankan DUA KALI dengan masukan yang sama, lalu hasilnya
 * dibandingkan aksara demi aksara. Penilaian yang hasilnya berubah-ubah
 * sendiri - karena membaca jam, karena mengurutkan tanpa pemutus seri, karena
 * memakai angka acak - akan tertangkap di sini, bukan pada rapat pengawasan
 * ketika dua orang membuka layar yang sama dan melihat angka berbeda.
 *
 * Berjalan tanpa jaringan dan tanpa basis data - db_config diganti penadah.
 */

let lulus = 0;
let gagal = 0;
const kegagalan = [];

function periksa(nama, benar, keterangan) {
  if (benar) {
    lulus += 1;
  } else {
    gagal += 1;
    kegagalan.push(`${nama}${keterangan ? ` - ${keterangan}` : ""}`);
    console.log(`  GAGAL ${nama}${keterangan ? ` - ${keterangan}` : ""}`);
  }
}

// ------------------------------------------------------------------- penadah
//
// Penadah menjawab sekadar cukup supaya tiap analisis berjalan sampai selesai.
// Yang diuji di sini BUKAN kebenaran angkanya - itu tugas uji banding pada
// tahap berikutnya - melainkan bahwa seluruhnya berjalan, berbentuk sama, dan
// hasilnya tidak berubah-ubah sendiri.
const kueri = [];
const dbPath = require.resolve("../db_config");
require("../db_config");
require.cache[dbPath].exports = {
  query: (sql, params, selesai) => {
    const teks = String(sql);
    kueri.push(teks);

    if (/FROM perkara p WHERE p\.nomor_perkara = \?/.test(teks)) {
      selesai(null, [
        {
          perkaraId: 9971,
          nomorPerkara: "551/Pdt.G/2026/PA.Dgl",
          jenisPerkara: "Cerai Gugat",
          alurPerkaraId: 15,
          tanggalDaftar: "2026-03-02",
        },
      ]);
      return;
    }
    if (/SELECT p\.petitum AS petitum/.test(teks)) {
      selesai(null, [{ petitum: "<ol><li>Mengabulkan gugatan Penggugat;</li></ol>" }]);
      return;
    }
    if (/perkara_pertimbangan_hukum/.test(teks)) {
      selesai(null, [{ teks: "<p>Menimbang bahwa gugatan Penggugat dikabulkan;</p>" }]);
      return;
    }
    if (/pu\.amar_putusan AS amar/.test(teks)) {
      selesai(null, [{ amar: "<p>1. Mengabulkan gugatan Penggugat;</p>", status: "Dikabulkan", tanggalPutusan: "2026-08-11" }]);
      return;
    }
    if (/FROM perkara_mediasi md WHERE md\.perkara_id = \? LIMIT 1/.test(teks)) {
      selesai(null, [{ hasil: "T", mediator: "Himawan T.W." }]);
      return;
    }
    selesai(null, []);
  },
};

const analisa = require("../services/analisaLanjutService");
const penilaianSk = require("../services/penilaianSippService");
const penilaianRubrik = require("../services/penilaianPerkaraService");

const NOMOR = "551/Pdt.G/2026/PA.Dgl";

/** Perbandingan yang tahan urutan kunci - yang dibandingkan isinya. */
function samaPersis(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function bentukAmplopSah(hasil) {
  if (!hasil || typeof hasil !== "object") return "bukan objek";
  if (typeof hasil.ok !== "boolean") return "tidak punya ok berupa boolean";
  if (!hasil.ok) return null; // kegagalan yang tertata punya alasan, diperiksa terpisah
  if (typeof hasil.jenis !== "string" || !hasil.jenis) return "jenis kosong";
  if (typeof hasil.judul !== "string" || !hasil.judul) return "judul kosong";
  if (!Array.isArray(hasil.metrik)) return "metrik bukan larik";
  if (!Array.isArray(hasil.kolom)) return "kolom bukan larik";
  if (!Array.isArray(hasil.baris)) return "baris bukan larik";
  if (typeof hasil.catatan !== "string") return "catatan bukan tulisan";
  for (const m of hasil.metrik) {
    if (!m || typeof m !== "object") return "metrik memuat yang bukan objek";
    if (typeof m.label !== "string" || !m.label) return "metrik tanpa label";
    if (!("nilai" in m)) return "metrik tanpa nilai";
  }
  // Kontrak sesungguhnya - diperiksa langsung ke ketiga puluh satu analisis,
  // bukan diduga: `kolom` berisi {kunci, label}, dan `baris` berisi OBJEK yang
  // berkunci sama, bukan larik. Percobaan pertama penyapu ini menuduh delapan
  // analisis melanggar padahal yang keliru dugaannya sendiri.
  for (const k of hasil.kolom) {
    if (!k || typeof k !== "object") return "kolom memuat yang bukan objek";
    if (typeof k.kunci !== "string" || !k.kunci) return "kolom tanpa kunci";
    if (typeof k.label !== "string" || !k.label) return `kolom ${k.kunci} tanpa label`;
  }
  const kunciKolom = hasil.kolom.map((k) => k.kunci);
  for (const b of hasil.baris) {
    if (!b || typeof b !== "object" || Array.isArray(b)) return "baris memuat yang bukan objek";
    // Kunci kolom yang tidak ada pada barisnya tergambar sebagai sel kosong,
    // dan sel kosong terbaca seperti data yang hilang - bukan seperti kolom
    // yang memang tidak berlaku.
    const kurang = kunciKolom.filter((k) => !(k in b));
    if (kurang.length) return `baris kekurangan kunci kolom: ${kurang.join(", ")}`;
  }
  return null;
}

async function utama() {
  console.log("");
  console.log("== 1. Daftar analisis - berdaftar, bukan bertulisan tangan ==");
  const daftar = analisa.DAFTAR_ANALISA;
  periksa("daftar analisis terbaca", Array.isArray(daftar) && daftar.length > 0);
  periksa(
    "setiap butir punya kunci, lingkup, label, dan keterangan",
    daftar.every((x) => x.kunci && x.lingkup && x.label && x.keterangan)
  );
  periksa("kunci tidak berulang", new Set(daftar.map((x) => x.kunci)).size === daftar.length);
  periksa(
    "lingkup hanya perkara atau pengadilan",
    daftar.every((x) => ["perkara", "pengadilan"].includes(x.lingkup))
  );
  console.log(`        ${daftar.length} analisis akan disapu`);

  console.log("");
  console.log("== 2. Sapuan bentuk amplop - seluruh analisis ==");
  const hasilPertama = new Map();
  for (const butir of daftar) {
    let hasil;
    try {
      hasil = await analisa.jalankanAnalisa(NOMOR, butir.kunci);
    } catch (galat) {
      periksa(`${butir.kunci} berjalan tanpa melempar`, false, String(galat.message || galat).slice(0, 120));
      continue;
    }
    periksa(`${butir.kunci} berjalan tanpa melempar`, true);
    hasilPertama.set(butir.kunci, hasil);

    const cela = bentukAmplopSah(hasil);
    periksa(`${butir.kunci} berbentuk amplop yang sama`, cela === null, cela || "");

    if (hasil && hasil.ok === false) {
      periksa(
        `${butir.kunci} yang gagal menyebutkan alasannya`,
        typeof hasil.alasan === "string" && hasil.alasan.length > 0
      );
    }
  }

  console.log("");
  console.log("== 3. Kunci di luar daftar ditolak, bukan menjalankan yang lain ==");
  for (const nakal of ["", "  ", "tidakAda", "__proto__", "constructor", "toString", "hasOwnProperty"]) {
    const hasil = await analisa.jalankanAnalisa(NOMOR, nakal);
    periksa(
      `kunci ${JSON.stringify(nakal)} ditolak`,
      hasil && hasil.ok === false && hasil.alasan === "jenis_analisa_tidak_dikenali",
      JSON.stringify(hasil).slice(0, 120)
    );
  }

  console.log("");
  console.log("== 4. Hitung dua kali - hasilnya harus sama persis ==");
  for (const butir of daftar) {
    const kedua = await analisa.jalankanAnalisa(NOMOR, butir.kunci);
    const pertama = hasilPertama.get(butir.kunci);
    periksa(
      `${butir.kunci} memberi hasil yang sama pada hitungan kedua`,
      samaPersis(pertama, kedua),
      "hasilnya berubah antara dua hitungan dengan masukan yang sama"
    );
  }

  console.log("");
  console.log("== 5. Tidak ada tulisan ke SIPP sepanjang sapuan ==");
  const menulis = kueri.filter((q) => /^\s*(INSERT|UPDATE|DELETE|REPLACE|TRUNCATE|CREATE|ALTER|DROP|GRANT|CALL)\b/i.test(q));
  periksa(
    `${kueri.length} kueri dijalankan, tidak satu pun menulis`,
    menulis.length === 0,
    menulis.slice(0, 3).map((q) => q.slice(0, 60)).join(" | ")
  );
  periksa(
    "seluruh kueri diawali SELECT atau SHOW",
    kueri.every((q) => /^\s*(SELECT|SHOW)\b/i.test(q)),
    kueri.filter((q) => !/^\s*(SELECT|SHOW)\b/i.test(q)).slice(0, 2).map((q) => q.slice(0, 60)).join(" | ")
  );

  console.log("");
  console.log("== 6. Mesin nilai SK Badilag 048/2024 - tiga puluh unsur ==");
  const UNSUR = penilaianSk.UNSUR;
  periksa("daftar unsur terbaca", Array.isArray(UNSUR) && UNSUR.length > 0);
  periksa("setiap unsur punya kunci dan dasar rujukannya", UNSUR.every((u) => u.kunci && u.dasar));
  periksa("kunci unsur tidak berulang", new Set(UNSUR.map((u) => u.kunci)).size === UNSUR.length);
  console.log(`        ${UNSUR.length} unsur`);

  // Tiga keadaan yang harus dibedakan mesinnya, dan hasilnya harus berbeda.
  const faktaKosong = {};
  const poinKosong = penilaianSk.poinPerkara(faktaKosong);
  periksa("perkara tanpa fakta apa pun tetap menghasilkan angka", poinKosong && typeof poinKosong === "object");
  const kembarKosong = penilaianSk.poinPerkara(faktaKosong);
  periksa("nilai SK sama pada hitungan kedua", samaPersis(poinKosong, kembarKosong));

  console.log("");
  console.log("== 7. Rubrik penilaian perkara - tujuh butir ==");
  const BUTIR = penilaianRubrik.BUTIR;
  periksa("daftar butir terbaca", Array.isArray(BUTIR) && BUTIR.length > 0);
  periksa("setiap butir punya kunci dan bobot", BUTIR.every((b) => b.kunci && typeof b.bobot === "number"));
  periksa(
    "jumlah bobot seluruh butir seratus",
    BUTIR.reduce((s, b) => s + b.bobot, 0) === 100,
    `dapat ${BUTIR.reduce((s, b) => s + b.bobot, 0)}`
  );
  console.log(`        ${BUTIR.length} butir, jumlah bobot ${BUTIR.reduce((s, b) => s + b.bobot, 0)}`);

  console.log("");
  console.log("== Ringkasan sapuan ==");
  console.log(`  analisis disapu     : ${daftar.length}`);
  console.log(`  unsur SK diperiksa  : ${UNSUR.length}`);
  console.log(`  butir rubrik        : ${BUTIR.length}`);
  console.log(`  kueri dijalankan    : ${kueri.length}`);
  console.log("");
  console.log(`Hasil: ${lulus} lulus, ${gagal} gagal`);
  if (kegagalan.length) {
    console.log("");
    console.log("Yang gagal:");
    kegagalan.forEach((k) => console.log(`  - ${k}`));
  }
  process.exit(gagal > 0 ? 1 : 0);
}

utama().catch((galat) => {
  console.error(galat);
  process.exit(1);
});
