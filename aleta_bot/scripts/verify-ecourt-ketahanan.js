"use strict";

/**
 * Ketahanan e-Court: keutuhan berkas, slot sesi, dan penggiliran akun.
 *
 * ============================================================================
 * MENJALANKAN LOGIKANYA, BUKAN MEMBACA TULISANNYA
 * ============================================================================
 *
 * Seluruh pemeriksaan memanggil fungsi sungguhan dengan masukan sungguhan.
 * Tidak ada jaringan, tidak ada database, dan tidak ada peramban yang dibuka.
 */

const fs = require("fs");
const os = require("os");
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

// Folder sesi diarahkan ke folder sementara SEBELUM modul dimuat, supaya
// pemeriksaan tidak menyentuh sesi sungguhan di mesin ini.
const FOLDER_UJI = fs.mkdtempSync(pathx.join(os.tmpdir(), "aleta-sesi-uji-"));
process.env.ALETA_ECOURT_SESSION_DIR = FOLDER_UJI;

const integritas = require("../services/berkasIntegritasService");
const sesi = require("../tools/ecourt-bridge/sesi");

/** Berkas tiruan berukuran cukup, diawali penanda yang diminta. */
function berkasPalsu(awalan, panjang = 2048) {
  return Buffer.concat([Buffer.from(awalan, "binary"), Buffer.alloc(panjang)]);
}

console.log("\n== Keutuhan berkas: yang sah diterima ==");
{
  periksa("PDF diterima", integritas.periksaIsi(berkasPalsu("%PDF-1.7"), { format: "pdf" }).ok);
  periksa(
    "docx diterima",
    integritas.periksaIsi(berkasPalsu("PK\x03\x04"), { format: "word" }).ok
  );
  periksa(
    "doc lama diterima",
    integritas.periksaIsi(berkasPalsu("\xd0\xcf\x11\xe0"), { format: "word" }).ok
  );
  periksa("RTF diterima", integritas.periksaIsi(berkasPalsu("{\\rtf1"), { format: "word" }).ok);
}

console.log("\n== Keutuhan berkas: yang rusak ditolak ==");
{
  // Sifat yang dijaga, dan inilah sebab modul ini ada: halaman web yang
  // dijawab dengan status 200 TIDAK boleh tersimpan sebagai dokumen. Bila
  // lolos, perkaranya tercatat lengkap dan penarikan berikutnya melewatinya -
  // kerusakannya baru ketahuan berbulan kemudian saat ada yang membukanya.
  const halaman = integritas.periksaIsi(
    berkasPalsu("<!DOCTYPE html><html><body>Silakan login</body></html>"),
    { format: "pdf" }
  );
  periksa("halaman HTML ditolak", !halaman.ok);
  periksa("sebabnya disebut halaman web", halaman.alasan === "isinya_halaman_web_bukan_dokumen");

  periksa(
    "jawaban JSON ditolak",
    !integritas.periksaIsi(berkasPalsu('{"ok":false,"alasan":"sesi habis"}'), { format: "pdf" }).ok
  );
  periksa("berkas kosong ditolak", !integritas.periksaIsi(Buffer.alloc(0), { format: "pdf" }).ok);
  periksa(
    "berkas kosong sebabnya disebut",
    integritas.periksaIsi(Buffer.alloc(0), { format: "pdf" }).alasan === "berkas_kosong"
  );

  // Berkas terpotong: penandanya benar, tetapi ukurannya mustahil.
  periksa(
    "PDF terpotong ditolak",
    !integritas.periksaIsi(Buffer.from("%PDF-1.7"), { format: "pdf" }).ok
  );

  // Sifat yang dijaga: format yang KELIRU ikut ditolak. docx yang tersimpan
  // dengan nama .pdf akan gagal dibuka petugas, dan lebih baik ketahuan di
  // sini daripada di ruang sidang.
  periksa(
    "docx yang diminta sebagai pdf ditolak",
    !integritas.periksaIsi(berkasPalsu("PK\x03\x04"), { format: "pdf" }).ok
  );
  periksa(
    "pdf yang diminta sebagai word ditolak",
    !integritas.periksaIsi(berkasPalsu("%PDF-1.7"), { format: "word" }).ok
  );
}

console.log("\n== Format ditebak dari nama berkas ==");
{
  periksa("pdf dikenali", integritas.formatDariNama("gugatan.pdf") === "pdf");
  periksa("docx dikenali", integritas.formatDariNama("jawaban.docx") === "word");
  periksa("doc dikenali", integritas.formatDariNama("replik.doc") === "word");
  periksa("tak dikenal menghasilkan kosong", integritas.formatDariNama("catatan.txt") === "");
}

console.log("\n== Slot sesi ==");
{
  periksa("kosong jatuh ke slot bawaan", sesi.bersihkanSlot("") === "utama");
  periksa("slot sah diterima apa adanya", sesi.bersihkanSlot("akun-2") === "akun-2");
  periksa("huruf besar diturunkan", sesi.bersihkanSlot("Akun-2") === "akun-2");

  // Sifat yang dijaga: nama slot menjadi bagian JALUR FOLDER. Nama yang keluar
  // dari folder sesi berarti profil peramban ditulis di sembarang tempat, dan
  // clearSession menghapus folder di luar sana.
  for (const jahat of ["../../etc", "..", "/etc/passwd", "a/b", "akun 2", "akun;rm", "a".repeat(40)]) {
    periksa(`slot berbahaya ditolak: ${jahat}`, sesi.bersihkanSlot(jahat) === "utama");
  }

  const jalurUtama = sesi.sessionDir("utama");
  const jalurKedua = sesi.sessionDir("akun-2");
  periksa("tiap slot berfolder sendiri", jalurUtama !== jalurKedua);
  periksa("keduanya di dalam folder sesi", jalurUtama.startsWith(FOLDER_UJI) && jalurKedua.startsWith(FOLDER_UJI));

  // Sifat yang dijaga: jalur hasil slot jahat tidak pernah keluar dari akarnya.
  periksa(
    "slot jahat tetap di dalam folder sesi",
    sesi.sessionDir("../../etc").startsWith(FOLDER_UJI)
  );
}

console.log("\n== Sesi per slot berdiri sendiri ==");
{
  periksa("slot baru belum bersesi", sesi.sessionExists("akun-2") === false);

  // Meniru profil yang sudah pernah dipakai login.
  fs.mkdirSync(pathx.join(sesi.sessionDir("akun-2"), "Default"), { recursive: true });

  periksa("slot yang sudah login dikenali", sesi.sessionExists("akun-2") === true);
  // Sifat yang dijaga: sesi satu akun TIDAK terbaca sebagai sesi akun lain.
  // Bila terbaca, penggiliran akan memilih akun yang sebenarnya belum login.
  periksa("slot lain tetap belum bersesi", sesi.sessionExists("utama") === false);

  sesi.clearSession("akun-2");
  periksa("menghapus sesi hanya mengenai slotnya", sesi.sessionExists("akun-2") === false);
}

console.log("\n== Penggiliran akun ==");
{
  // Layanan akun dimuat SETELAH folder sesi disiapkan.
  const akunService = require("../services/ecourtAkunService");

  const daftar = akunService.daftarAkun();
  periksa("ada akun bawaan", daftar.length >= 1 && daftar[0].slot === "utama");

  // Tanpa satu pun sesi, tidak ada yang dapat dipilih - dan itu harus
  // dikatakan, bukan dijawab dengan akun yang belum login.
  const tanpaSesi = akunService.pilihAkunSiap();
  periksa("tanpa sesi tidak ada yang dipilih", tanpaSesi.ok === false);
  periksa("sebabnya disebutkan", tanpaSesi.alasan === "tidak_ada_akun_bersesi");

  fs.mkdirSync(pathx.join(sesi.sessionDir("utama"), "Default"), { recursive: true });
  const adaSesi = akunService.pilihAkunSiap();
  periksa("akun bersesi terpilih", adaSesi.ok === true && adaSesi.slot === "utama");

  // Menandai gagal lalu memilih lagi: dengan satu akun, yang sama tetap
  // dicoba - menolak sama sekali berarti penarikan berhenti permanen setelah
  // satu malam yang buruk.
  akunService.tandaiGagal("utama", "sesi_habis");
  const setelahGagal = akunService.pilihAkunSiap();
  periksa("satu akun yang gagal tetap dicoba lagi", setelahGagal.ok === true);
  periksa(
    "alasannya menjelaskan bahwa semua sedang istirahat",
    setelahGagal.alasan === "seluruh_akun_istirahat_dicoba_yang_terlama"
  );

  const setelahGagalDaftar = akunService.daftarAkun();
  periksa("akun yang gagal ditandai istirahat", setelahGagalDaftar[0].istirahat === true);

  akunService.tandaiBerhasil("utama");
  periksa("berhasil melepas tanda istirahat", akunService.daftarAkun()[0].istirahat === false);
}

// --- Membersihkan folder sementara ---
try {
  fs.rmSync(FOLDER_UJI, { recursive: true, force: true });
} catch {
  // Bukan kegagalan pemeriksaan.
}

console.log(`\nHasil: ${lulus} lulus, ${gagal} gagal\n`);
process.exit(gagal === 0 ? 0 : 1);
