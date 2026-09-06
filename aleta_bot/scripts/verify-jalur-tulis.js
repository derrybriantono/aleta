"use strict";

/**
 * ============================================================================
 * JALUR TULIS HARUS BERADA DI DALAM VOLUME YANG TERPASANG
 * ============================================================================
 *
 * Yang dijaga di sini satu hal yang gagalnya DIAM: berkas yang ditulis
 * aplikasi ke jalur yang tidak dipasang keluar container akan musnah setiap
 * kali container dibuat ulang - dan container dibuat ulang pada SETIAP
 * pembaruan.
 *
 * Sudah terjadi: ecourtDocumentService menyimpan unduhan ke <app>/data/ecourt
 * tanpa mount. Empat ratus baris tercatat di aleta_bot_ecourt_files, nol
 * berkas tersisa di disk. Tidak ada galat, tidak ada peringatan - tombol
 * unduh sekadar menghilang dan arsip tampak seperti belum pernah diisi.
 *
 * ============================================================================
 * MENGAPA TABELNYA DIPERIKSA BALIK KE KODE
 * ============================================================================
 *
 * Daftar jalur tulis di bawah ditulis tangan. Daftar tulisan tangan selalu
 * bergeser dari kode yang diwakilinya, lalu berbohong dengan tenang. Karena
 * itu setiap baris membawa `bukti`: potongan yang HARUS masih ada di berkas
 * sumbernya. Bila seseorang mengubah jalurnya di kode dan lupa ke sini,
 * yang gagal adalah pemeriksaan buktinya - bukan diam-diam lolos.
 *
 * Berjalan tanpa jaringan, tanpa basis data, dan tanpa Docker.
 */

const fs = require("fs");
const path = require("path");

let lulus = 0;
let gagal = 0;

function periksa(nama, benar, keterangan) {
  if (benar) {
    lulus += 1;
    console.log(`  OK    ${nama}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${nama}${keterangan ? ` - ${keterangan}` : ""}`);
  }
}

const AKAR = path.resolve(__dirname, "..", "..");
const AKAR_BOT = path.resolve(__dirname, "..");

// --------------------------------------------------------------- pembaca yaml
//
// js-yaml dipakai bila ada. Bila tidak ada, pemeriksaan ini GAGAL dengan
// suara keras alih-alih lolos diam-diam - penjaga yang tidak dapat berjalan
// lebih berbahaya daripada penjaga yang tidak ada, sebab yang pertama
// menimbulkan rasa aman.
let yaml = null;
try {
  // eslint-disable-next-line global-require
  yaml = require("js-yaml");
} catch (_) {
  yaml = null;
}

function bacaCompose(namaBerkas) {
  const jalur = path.join(AKAR, namaBerkas);
  if (!fs.existsSync(jalur)) return null;
  const teks = fs.readFileSync(jalur, "utf8");
  return yaml.load(teks) || {};
}

/**
 * Sisi kanan sebuah baris volume: "host:container" atau "host:container:ro".
 *
 * Bentuk panjang ({ type, source, target }) juga dilayani, sebab compose
 * menerima keduanya dan yang menulisnya kelak belum tentu memakai bentuk
 * pendek.
 */
function targetVolume(baris) {
  if (baris && typeof baris === "object") return baris.target || null;
  const teks = String(baris);
  const potong = teks.split(":");
  if (potong.length < 2) return null;
  // Windows tidak dipakai di server; jalur host di sini selalu POSIX.
  return potong[1] || null;
}

function gabung(...kumpulan) {
  const keluar = [];
  kumpulan.forEach((x) => {
    if (Array.isArray(x)) keluar.push(...x);
  });
  return keluar;
}

/**
 * Lingkungan sebuah layanan, digabung dari compose dasar dan override.
 * Bentuk peta ({A: 1}) dan bentuk daftar (["A=1"]) sama-sama dilayani.
 */
function lingkungan(...kumpulan) {
  const peta = {};
  kumpulan.forEach((env) => {
    if (!env) return;
    if (Array.isArray(env)) {
      env.forEach((baris) => {
        const teks = String(baris);
        const pisah = teks.indexOf("=");
        if (pisah > 0) peta[teks.slice(0, pisah)] = teks.slice(pisah + 1);
      });
      return;
    }
    Object.entries(env).forEach(([k, v]) => {
      peta[k] = v == null ? "" : String(v);
    });
  });
  return peta;
}

/** Apakah `jalur` berada di dalam salah satu `mount`? */
function tertutupi(jalur, mounts) {
  const bersih = String(jalur).replace(/\/+$/, "");
  return mounts.some((m) => {
    const t = String(m).replace(/\/+$/, "");
    return bersih === t || bersih.startsWith(t + "/");
  });
}

// ---------------------------------------------------------- daftar jalur tulis
//
// `bawaan` adalah jalur DI DALAM CONTAINER bila tidak ada env pengalih.
// `env` adalah nama peubah lingkungan yang boleh mengalihkannya.
// `bukti` harus masih ditemukan di `berkas`, kalau tidak daftarnya sudah usang.
const JALUR_TULIS = [
  {
    nama: "unduhan dokumen e-Court",
    layanan: "aleta_bot",
    berkas: "services/ecourtDocumentService.js",
    bukti: 'path.resolve(__dirname, "..", "data", "ecourt")',
    env: "ALETA_BOT_ECOURT_DOCUMENT_ROOT",
    bawaan: "/usr/src/app/data/ecourt",
    akibat: "seluruh berkas e-Court yang pernah diunduh musnah tiap pembaruan",
  },
  {
    nama: "catatan cadangan (jsonl) saat basis data bot tidak terjangkau",
    layanan: "aleta_bot",
    berkas: "services/logService.js",
    bukti: 'path.resolve(__dirname, "..", "data")',
    env: "ALETA_BOT_DATA_DIR",
    bawaan: "/usr/src/app/data",
    akibat:
      "jejak pesan, kejadian keamanan, dan galat kueri hilang - justru yang ditulis ketika basis datanya sedang mati",
  },
  {
    nama: "kredensial e-Court tersandi beserta kuncinya",
    layanan: "aleta_bot",
    berkas: "services/ecourtKredensialService.js",
    bukti: 'path.join(os.homedir(), ".aleta-ecourt-session")',
    env: "ALETA_ECOURT_KREDENSIAL_DIR",
    bawaan: "/root/.aleta-ecourt-session",
    akibat:
      "kunci penyandian dan kredensial e-Court hilang; petugas harus memasukkan ulang sandi tiap pembaruan",
  },
  {
    nama: "profil peramban sesi e-Court",
    layanan: "aleta_bot",
    berkas: "tools/ecourt-bridge/sesi.js",
    bukti: "ALETA_ECOURT_SESSION_DIR",
    env: "ALETA_ECOURT_SESSION_DIR",
    bawaan: "/usr/src/app/.ecourt-session",
    akibat: "petugas login ulang dengan captcha tiap pembaruan",
  },
  {
    nama: "laporan dan kunci penjadwal unduhan e-Court",
    layanan: "aleta_bot",
    berkas: "services/ecourtSchedulerService.js",
    bukti: 'path.resolve(__dirname, "..", "reports")',
    env: null,
    bawaan: "/usr/src/app/reports",
    akibat: "riwayat unduhan latar dan berkas kunci hilang; unduhan ganda dapat berjalan bersamaan",
  },
  {
    nama: "setelan jalan bot (aleta-runtime.json)",
    layanan: "aleta_bot",
    berkas: "config/runtime-config.js",
    bukti: "ALETA_BOT_RUNTIME_CONFIG_PATH",
    env: "ALETA_BOT_RUNTIME_CONFIG_PATH",
    bawaan: "/usr/src/app/config/aleta-runtime.json",
    akibat: "seluruh saklar layanan kembali ke bawaan tanpa ada yang menyadarinya",
  },
  {
    nama: "sesi WhatsApp",
    layanan: "aleta_bot",
    berkas: "app.js",
    bukti: "LocalAuth",
    env: null,
    bawaan: "/usr/src/app/.wwebjs_auth",
    akibat: "bot meminta pindai QR ulang tiap pembaruan",
  },
  {
    nama: "unggahan portal",
    layanan: "portal",
    berkas: null,
    bukti: null,
    env: "ALETA_UPLOAD_DIR",
    bawaan: "/app/uploads",
    akibat: "seluruh lampiran yang diunggah pengguna hilang",
  },
  {
    nama: "PDF portal",
    layanan: "portal",
    berkas: null,
    bukti: null,
    env: "ALETA_PDF_UPLOAD_DIR",
    bawaan: "/app/uploads/pdf",
    akibat: "PDF hasil cetak hilang",
  },
];

async function utama() {
  console.log("");
  console.log("== Prasyarat ==");
  periksa(
    "pembaca yaml tersedia (js-yaml)",
    yaml !== null,
    "pasang js-yaml agar penjaga ini dapat membaca berkas compose"
  );
  if (!yaml) {
    console.log("");
    console.log(`Hasil: ${lulus} lulus, ${gagal} gagal`);
    process.exit(1);
  }

  const dasar = bacaCompose("docker-compose.yml");
  const timpa = bacaCompose("docker-compose.override.yml");
  periksa("docker-compose.yml terbaca", dasar !== null);
  periksa("docker-compose.override.yml terbaca", timpa !== null);
  if (!dasar) {
    console.log("");
    console.log(`Hasil: ${lulus} lulus, ${gagal} gagal`);
    process.exit(1);
  }

  const layananDasar = dasar.services || {};
  const layananTimpa = (timpa && timpa.services) || {};

  const MOUNT = {};
  const ENV = {};
  const namaLayanan = new Set([...Object.keys(layananDasar), ...Object.keys(layananTimpa)]);
  namaLayanan.forEach((nama) => {
    const a = layananDasar[nama] || {};
    const b = layananTimpa[nama] || {};
    // Compose MENGGABUNG daftar volumes dari override, tidak menggantinya.
    MOUNT[nama] = gabung(a.volumes, b.volumes).map(targetVolume).filter(Boolean);
    ENV[nama] = lingkungan(a.environment, b.environment);
  });

  console.log("");
  console.log("== Daftar jalur tulis masih sesuai kodenya ==");
  JALUR_TULIS.forEach((j) => {
    if (!j.berkas || !j.bukti) return;
    const jalur = path.join(AKAR_BOT, j.berkas);
    const ada = fs.existsSync(jalur);
    periksa(`berkas sumber ada: ${j.berkas}`, ada);
    if (!ada) return;
    const isi = fs.readFileSync(jalur, "utf8");
    periksa(
      `jalur "${j.nama}" masih tertulis begitu di kodenya`,
      isi.includes(j.bukti),
      `potongan "${j.bukti}" tidak lagi ada di ${j.berkas} - daftar di penjaga ini sudah usang`
    );
  });

  console.log("");
  console.log("== Setiap jalur tulis berada di dalam volume ==");
  JALUR_TULIS.forEach((j) => {
    const mounts = MOUNT[j.layanan] || [];
    const env = ENV[j.layanan] || {};
    const dialihkan = j.env && env[j.env] ? String(env[j.env]) : null;
    const berlaku = dialihkan || j.bawaan;
    // Berkas tunggal: yang harus tertutupi adalah folder induknya.
    const diperiksa = /\.[a-z0-9]+$/i.test(berlaku) ? path.posix.dirname(berlaku) : berlaku;

    periksa(
      `${j.layanan}: ${j.nama}`,
      tertutupi(diperiksa, mounts),
      `jalur berlaku "${berlaku}"${dialihkan ? ` (dialihkan ${j.env})` : " (bawaan, tanpa pengalih)"} ` +
        `tidak berada di dalam satu pun volume ${j.layanan}. Akibatnya: ${j.akibat}`
    );
  });

  console.log("");
  console.log("== Volume yang terpasang ==");
  Object.keys(MOUNT)
    .sort()
    .forEach((nama) => {
      console.log(`  ${nama}:`);
      MOUNT[nama].forEach((m) => console.log(`    ${m}`));
    });

  console.log("");
  console.log("== Baris dns tidak boleh memuai menjadi kosong ==");
  //
  // Sudah terjadi: `dns: [ "${ALETA_DNS_PRIMARY:-}" ]` memuai menjadi daftar
  // berisi satu tulisan kosong pada Compose yang terpasang di server, lalu
  // Docker menolaknya dengan "bad nameserver address" dan portal mati.
  // Perilaku "baris kosong dihapus sendiri" TIDAK berlaku di semua versi.
  const teksDasar = fs.readFileSync(path.join(AKAR, "docker-compose.yml"), "utf8");
  const barisDns = teksDasar
    .split("\n")
    .map((b, i) => ({ b: b.trim(), i: i + 1 }))
    .filter((x) => /^-\s*\$\{[A-Z_]+:-\}\s*$/.test(x.b));
  periksa(
    "tidak ada nilai dns yang memuai kosong di docker-compose.yml",
    barisDns.length === 0,
    barisDns.map((x) => `baris ${x.i}: ${x.b}`).join(" | ")
  );

  console.log("");
  console.log(`Hasil: ${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal > 0 ? 1 : 0);
}

utama().catch((e) => {
  console.error(e);
  process.exit(1);
});
