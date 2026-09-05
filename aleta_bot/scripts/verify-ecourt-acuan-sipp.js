"use strict";

/**
 * SIPP sebagai acuan perkara e-Court.
 *
 * Sebelumnya jembatan mengambil perkara dari tautan apa pun yang kebetulan ada
 * di halaman setelah login. Tidak ada yang tahu apa yang SEHARUSNYA ditemukan,
 * sehingga perkara yang terlewat hilang diam-diam - tidak ada satu pun angka
 * yang berubah, tidak ada pesan apa pun.
 *
 * Sekarang SIPP yang menyatakan perkara mana saja terdaftar lewat e-Court,
 * lengkap dengan nomor registernya, dan hasil kikisan dicocokkan ke daftar itu.
 *
 * Seluruh pemeriksaan di sini berjalan tanpa jaringan dan tanpa database.
 */

const fs = require("fs");
const pathx = require("path");

let lulus = 0;
let gagal = 0;

function periksa(nama, benar) {
  if (benar) {
    lulus += 1;
    console.log(`  OK    ${nama}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${nama}`);
  }
}

const baca = (...bagian) => fs.readFileSync(pathx.resolve(__dirname, "..", ...bagian), "utf8");
const jembatan = baca("services", "sippReadOnlyBridgeService.js");
const runJs = baca("tools", "ecourt-bridge", "run.js");
const store = baca("services", "ecourtStoreService.js");

const daftar = jembatan.slice(
  jembatan.indexOf("async function listEcourtCases"),
  jembatan.indexOf("async function introspectSchema")
);

console.log("\n== Langkah 3: daftar perkara berasal dari SIPP ==");
{
  periksa("operasi ecourt.caseList terdaftar", /"ecourt\.caseList": listEcourtCases/.test(jembatan));
  periksa("menempuh rantai perkara -> efiling_id -> efiling", /perkara_efiling_id/.test(daftar) && /perkara_efiling\b/.test(daftar));
  periksa("membaca nomor_register", /nomor_register/.test(daftar));
  periksa("hanya SELECT", !/\b(INSERT|UPDATE|DELETE|DROP|ALTER)\b/i.test(daftar));
  periksa("jembatan memuat acuan sebelum menarik", /muatAcuanSipp\(/.test(runJs));
}

console.log("\n== Pendaftaran ganda: dipakai yang TERBARU ==");
{
  // Satu perkara dapat punya lebih dari satu pendaftaran e-Court. Pada
  // database PA Donggala, perkara_id 4227 memetakan ke efiling_id 9168 dan
  // 13739. Mengambil yang salah berarti menarik dokumen dari pendaftaran yang
  // bukan urusannya.
  periksa("diurutkan terbaru lebih dulu", /tanggal_pendaftaran DESC/.test(daftar) && /efiling_id DESC/.test(daftar));
  periksa("yang lama dihitung, bukan dibuang diam-diam", /pendaftaranGanda/.test(daftar));

  // Menyalin aturan penyaringnya untuk diuji langsung.
  const barisSipp = [
    { perkaraId: "4227", efilingId: "13739", nomorRegister: "BARU" },
    { perkaraId: "4227", efilingId: "9168", nomorRegister: "LAMA" },
    { perkaraId: "4228", efilingId: "13782", nomorRegister: "LAIN" },
  ];
  const terpilih = new Map();
  let ganda = 0;
  for (const row of barisSipp) {
    if (terpilih.has(row.perkaraId)) {
      ganda += 1;
      continue;
    }
    terpilih.set(row.perkaraId, row);
  }
  periksa("perkara ganda menyisakan satu", terpilih.size === 2);
  periksa("yang dipakai adalah yang terbaru", terpilih.get("4227").nomorRegister === "BARU");
  periksa("pendaftaran lama terhitung", ganda === 1);
}

console.log("\n== Langkah 4: identitas SIPP tersimpan pada dokumen ==");
{
  periksa("kolom perkara_id ditambahkan", /"perkara_id"/.test(store));
  periksa("kolom nomor_register ditambahkan", /"nomor_register"/.test(store));
  periksa("ditulis saat dokumen baru", /perkara_id, nomor_register/.test(store));
  periksa("diteruskan dari jembatan", /perkaraId: identitas\.perkaraId/.test(runJs));

  // Padanan yang gagal TIDAK boleh menghapus padanan yang sudah benar.
  periksa("pembaruan tidak mengosongkan perkara_id", /perkara_id = COALESCE\(\?, perkara_id\)/.test(store));
  periksa(
    "pembaruan tidak mengosongkan nomor_register",
    /nomor_register = CASE WHEN \? = '' THEN nomor_register ELSE \? END/.test(store)
  );
}

console.log("\n== Langkah 5: selisih dilaporkan, bukan disembunyikan ==");
{
  periksa("perkara SIPP yang tidak ketemu dicatat", /tidakDitemukanDiEcourt/.test(runJs));
  periksa("perkara e-Court di luar SIPP dicatat", /tidakAdaDiSipp/.test(runJs));
  periksa("beda nomor register dicatat", /registerBerbeda/.test(runJs));
  periksa("selisih ikut tersimpan di catatan putaran", /ringkasSelisih\(hasil\)/.test(store));
  periksa("tanpa selisih tidak menulis catatan", /return null;/.test(store.slice(store.indexOf("function ringkasSelisih"))));
}

console.log("\n== Gagal-terbuka: SIPP mati tidak menghentikan penarikan ==");
{
  // Menolak menarik dokumen hanya karena SIPP sedang tidak terjangkau berarti
  // dokumen yang tenggatnya besok tidak sampai ke pihak. Kerugian itu jauh
  // lebih besar daripada kehilangan pelaporan selisih untuk satu putaran.
  const acuan = runJs.slice(runJs.indexOf("async function muatAcuanSipp"), runJs.indexOf("function padankan"));
  periksa("kegagalan ditangkap, tidak dilempar", /catch \(error\)/.test(acuan) && !/throw/.test(acuan));
  periksa("mengembalikan acuan tidak aktif", /aktif: false/.test(acuan));
  periksa("padankan menyerah aman bila acuan mati", /if \(!acuan\.aktif\) return \{ perkaraId: null, nomorRegister: "" \};/.test(runJs));
}

console.log(`\nLulus: ${lulus}, Gagal: ${gagal}`);
if (gagal > 0) {
  console.log("ADA PERIKSAAN YANG GAGAL.");
  process.exit(1);
}
