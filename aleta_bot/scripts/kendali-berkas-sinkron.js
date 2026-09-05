"use strict";

/**
 * Menjalankan sinkronisasi kendali berkas dari baris perintah.
 *
 * Dijalankan di dalam container bot, dipanggil dari:
 *   - scripts/aleta-kendali-berkas.sh  (dari PuTTY, tetap jalan setelah ditutup)
 *   - penjadwal, bila nanti dipasang
 *
 * ============================================================================
 * KELUARANNYA DITULIS PER BARIS, BUKAN DITAHAN SAMPAI SELESAI
 * ============================================================================
 *
 * Sinkronisasi ribuan perkara berjalan berjam-jam. Keluaran yang ditahan sampai
 * selesai membuat orang tidak dapat membedakan proses yang bekerja dari proses
 * yang menggantung - dan yang menggantung itulah yang perlu ditemukan cepat.
 *
 * ============================================================================
 * KODE KELUAR DIBEDAKAN SEBABNYA
 * ============================================================================
 *
 *   0  selesai
 *   1  gagal - SIPP tidak terbaca, atau basis data bot bermasalah
 *   3  ditolak karena sinkronisasi lain masih berjalan
 *
 * Kode 2 sengaja dilewati: pada jembatan e-Court kode itu sudah berarti sesi
 * habis, dan memakai angka yang sama untuk arti berbeda pada dua perintah yang
 * dijalankan berdampingan hanya menyesatkan orang yang membaca lognya.
 */

const kendaliBerkasService = require("../services/kendaliBerkasService");

function bacaArgumen(argv) {
  const pilihan = { sejak: "", sampai: "", maks: 0, hanyaEcourt: false, dijalankanOleh: "" };
  for (let i = 0; i < argv.length; i += 1) {
    const kunci = argv[i];
    const nilai = argv[i + 1];
    if (kunci === "--sejak") { pilihan.sejak = String(nilai || ""); i += 1; }
    else if (kunci === "--sampai") { pilihan.sampai = String(nilai || ""); i += 1; }
    else if (kunci === "--maks") { pilihan.maks = Number(nilai) || 0; i += 1; }
    else if (kunci === "--oleh") { pilihan.dijalankanOleh = String(nilai || ""); i += 1; }
    else if (kunci === "--hanya-ecourt") pilihan.hanyaEcourt = true;
  }
  return pilihan;
}

function cap() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function tulis(pesan) {
  process.stdout.write(`[${cap()}] ${pesan}\n`);
}

async function utama() {
  const pilihan = bacaArgumen(process.argv.slice(2));

  tulis("Sinkronisasi kendali berkas dimulai.");
  tulis(
    `  Rentang daftar : ${pilihan.sejak || "tanpa batas awal"} s.d. ${pilihan.sampai || "tanpa batas akhir"}`
  );
  tulis(`  Batas perkara  : ${pilihan.maks > 0 ? pilihan.maks : "seluruhnya"}`);
  tulis(`  Saringan       : ${pilihan.hanyaEcourt ? "hanya perkara e-Court" : "seluruh perkara"}`);

  // Berhenti rapi saat ditekan Ctrl+C atau saat container disetop: baris yang
  // sudah tersimpan tetap tersimpan, dan jalannya ditandai dibatalkan alih-alih
  // ditinggalkan menggantung.
  let dimintaBerhenti = false;
  const minta = (sinyal) => {
    if (dimintaBerhenti) return;
    dimintaBerhenti = true;
    tulis(`Menerima ${sinyal} - menyelesaikan kelompok yang sedang berjalan lalu berhenti.`);
  };
  process.on("SIGINT", () => minta("SIGINT"));
  process.on("SIGTERM", () => minta("SIGTERM"));

  const hasil = await kendaliBerkasService.sinkron({
    ...pilihan,
    sumber: "putty",
    batal: () => dimintaBerhenti,
    onKemajuan: (kemajuan) => {
      if (kemajuan.tahap === "galat") tulis(`  [!] ${kemajuan.pesan}`);
      else tulis(`  ${kemajuan.pesan}`);
    },
  });

  if (!hasil.ok && hasil.alasan === "sinkron_lain_berjalan") {
    tulis(`DITOLAK: ${hasil.pesan}`);
    return 3;
  }

  if (!hasil.ok && hasil.alasan === "dibatalkan") {
    tulis(`Dihentikan. ${hasil.diperiksa || 0} perkara sempat diperiksa dan tersimpan.`);
    return 0;
  }

  if (!hasil.ok) {
    tulis(`GAGAL: ${hasil.pesan || hasil.alasan}`);
    return 1;
  }

  tulis("");
  tulis("Ringkasan sinkronisasi kendali berkas");
  tulis(`  Perkara diperiksa : ${hasil.diperiksa}`);
  tulis(`  Kurang berkas     : ${hasil.kurang}`);
  tulis(`  Tidak terbaca     : ${hasil.gagal}`);
  tulis("");

  const ringkas = await kendaliBerkasService.ringkasan();
  tulis(`  Seluruh perkara terpantau : ${ringkas.totalPerkara}`);
  tulis(`  Lengkap                   : ${ringkas.perkara.lengkap || 0}`);
  tulis(`  Kurang                    : ${ringkas.perkara.kurang || 0}`);
  tulis(`  Belum diperiksa           : ${ringkas.perkara.belum_diperiksa || 0}`);

  return 0;
}

utama()
  .then((kode) => process.exit(kode))
  .catch((error) => {
    tulis(`GAGAL: ${error && error.stack ? error.stack : error}`);
    process.exit(1);
  });
