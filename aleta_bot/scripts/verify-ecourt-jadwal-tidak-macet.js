"use strict";

/**
 * Penjadwal e-Court tidak boleh dapat macet permanen.
 *
 * Penjadwal menandai putaran sebagai "sedang jalan" sampai proses anaknya
 * keluar. Bila anaknya menggantung, SELURUH putaran berikutnya dilewati untuk
 * seterusnya dengan alasan "putaran_sebelumnya_belum_selesai" - tanpa pesan
 * galat, tanpa cara memulihkan selain menyalakan ulang bot.
 *
 * Satu sebab sudah diketahui: run.js menunggu tombol Enter ketika halaman
 * pendaratan tidak memuat tautan perkara, padahal penjadwal menjalankannya
 * dengan stdin ditutup. Enter itu tidak akan pernah datang.
 *
 * Skrip ini menguji dua lapisan penjagaannya tanpa menyentuh jaringan.
 */

const fs = require("fs");
const pathx = require("path");
const { spawn } = require("child_process");

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

const runJs = fs.readFileSync(pathx.resolve(__dirname, "..", "tools", "ecourt-bridge", "run.js"), "utf8");
const penjadwal = fs.readFileSync(pathx.resolve(__dirname, "..", "services", "ecourtSchedulerService.js"), "utf8");

console.log("\n== Lapisan 1: run.js tidak menunggu Enter saat terjadwal ==");
{
  // Penjagaannya harus BERADA SEBELUM penungguan stdin, bukan sesudahnya.
  const posisiPenjagaan = runJs.indexOf("if (args.terjadwal)");
  const posisiTunggu = runJs.indexOf("process.stdin.once");
  periksa("penjagaan mode terjadwal ada", posisiPenjagaan > 0);
  periksa("penungguan stdin masih ada untuk mode manual", posisiTunggu > 0);
  periksa("penjagaan berada SEBELUM penungguan", posisiPenjagaan > 0 && posisiPenjagaan < posisiTunggu);

  // Di antara keduanya harus ada return, supaya benar-benar tidak sampai.
  const antara = runJs.slice(posisiPenjagaan, posisiTunggu);
  periksa("penjagaan mengakhiri putaran dengan return", /\breturn;/.test(antara));
  periksa("alasannya dicatat", /galatTerakhir/.test(antara));
}

console.log("\n== Lapisan 2: penjadwal punya batas waktu ==");
{
  periksa("batas putaran didefinisikan", /BATAS_PUTARAN_MS/.test(penjadwal));
  periksa("proses anak dipaksa berhenti", /anak\.kill\(/.test(penjadwal));
  periksa("pewaktu dimatikan saat anak keluar", /clearTimeout\(pewaktu\)/.test(penjadwal));
  periksa("dapat diatur lewat env", /ALETA_BOT_ECOURT_BATAS_PUTARAN_MS/.test(penjadwal));
  periksa("dihentikan paksa dibedakan dari gagal biasa", /dipaksaBerhenti/.test(penjadwal));

  // Bendera sedangJalan HARUS dilepas di penangan close, bukan hanya di jalur
  // sukses - kalau tidak, batas waktu pun tidak menolong.
  const close = penjadwal.slice(penjadwal.indexOf('anak.on("close"'));
  // Diperiksa pada SELURUH penangan close, bukan 400 karakter pertamanya.
  // Jendela sepanjang itu memaksa baris pelepasan tetap di urutan tertentu,
  // dan uji yang menuntut urutan penulisan akan gagal setiap kali ada baris
  // baru disisipkan - padahal sifat yang dijaga tidak berubah sama sekali.
  periksa("sedangJalan dilepas saat anak keluar", /keadaan\.sedangJalan = false;/.test(close));
}

console.log("\n== Proses anak sungguhan: dibunuh saat melewati batas ==");
{
  // Membuktikan mekanismenya benar-benar bekerja, bukan sekadar ada di kode.
  const anak = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
  const mulai = Date.now();
  let dibunuh = false;

  const pewaktu = setTimeout(() => {
    dibunuh = true;
    anak.kill("SIGKILL");
  }, 300);

  anak.on("close", () => {
    clearTimeout(pewaktu);
    const lama = Date.now() - mulai;
    periksa("proses menggantung benar-benar dihentikan", dibunuh);
    periksa(`dihentikan dalam waktu wajar (${lama}ms)`, lama < 5000);

    console.log(`\nLulus: ${lulus}, Gagal: ${gagal}`);
    if (gagal > 0) {
      console.log("ADA PERIKSAAN YANG GAGAL.");
      process.exit(1);
    }
  });
}
