"use strict";

/**
 * Penarikan berkas e-Court yang dimulai dari portal.
 *
 * ============================================================================
 * MENJALANKAN PENJADWALNYA, BUKAN MEMBACA TULISANNYA
 * ============================================================================
 *
 * spawn diganti tiruan sebelum penjadwal dimuat, sehingga argumen yang BENAR
 * BENAR dikirim ke jembatan dapat diperiksa - bukan dicocokkan dengan pola
 * tulisan di berkas sumber. Tidak ada peramban yang dibuka dan tidak ada
 * permintaan apa pun ke Mahkamah Agung.
 *
 * Yang dijaga:
 *
 *   - penarikan menyeluruh berjalan TANPA batas jumlah perkara,
 *   - --paksa-ulang tidak pernah dikirim, sehingga perkara yang berkasnya
 *     sudah lengkap dilewati dan tidak diunduh dua kali,
 *   - dua penarikan tidak pernah berjalan bersamaan,
 *   - berkas kunci ada selama penarikan dan hilang sesudahnya,
 *   - keluaran jembatan benar-benar sampai ke berkas log.
 */

const { EventEmitter } = require("events");
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

// --- Tiruan spawn -----------------------------------------------------------

const cp = require("child_process");
let argumenTerakhir = null;
let anakTerakhir = null;

cp.spawn = function spawnTiruan(perintah, argumen) {
  argumenTerakhir = argumen;

  const anak = new EventEmitter();
  anak.stdout = new EventEmitter();
  anak.stderr = new EventEmitter();
  anak.kill = () => {
    anak.emit("close", 143);
  };
  anakTerakhir = anak;
  return anak;
};

const penjadwal = require("../services/ecourtSchedulerService");

const FOLDER_LOG = pathx.resolve(__dirname, "..", "reports");
const BERKAS_KUNCI = pathx.join(FOLDER_LOG, "ecourt-unduh-aleta.lock");

const logDibuat = [];

/** Menyelesaikan putaran yang sedang berjalan. */
function selesaikan(kode = 0) {
  if (anakTerakhir) anakTerakhir.emit("close", kode);
}

function tunggu(ms) {
  return new Promise((lanjut) => setTimeout(lanjut, ms));
}

function catatLogBaru() {
  const status = penjadwal.getStatus();
  if (status.berkasLog) logDibuat.push(pathx.join(FOLDER_LOG, status.berkasLog));
}

async function jalan() {
  console.log("\n== Penarikan menyeluruh ==");
  {
    const hasil = penjadwal.mulaiPenarikanMenyeluruh({ olehSiapa: "Penguji" });
    catatLogBaru();

    periksa("penarikan menyeluruh dimulai", hasil.ok === true);

    // Sifat yang dijaga: TANPA batas jumlah perkara, sama seperti skrip host
    // dengan MAKS=0. Bila batasnya ikut terkirim, "unduh semua" hanya akan
    // menarik 25 perkara pertama dan berhenti - diam-diam, tanpa ada yang tahu.
    periksa(
      "tanpa --maks-perkara",
      Array.isArray(argumenTerakhir) && !argumenTerakhir.includes("--maks-perkara")
    );

    // Sifat yang dijaga: perkara yang berkasnya sudah lengkap DILEWATI.
    // --paksa-ulang membatalkan pelewatan itu dan mengunduh ulang gigabita
    // yang isinya sama persis.
    periksa(
      "tanpa --paksa-ulang, sehingga yang sudah lengkap dilewati",
      Array.isArray(argumenTerakhir) && !argumenTerakhir.includes("--paksa-ulang")
    );

    periksa("berjalan dalam mode terjadwal", argumenTerakhir.includes("--terjadwal"));
    periksa("kunci ada selama penarikan", fs.existsSync(BERKAS_KUNCI));
    periksa("status menandai sedang jalan", penjadwal.getStatus().sedangJalan === true);
    periksa("sumber penarikan tercatat", penjadwal.getStatus().sumber === "portal-menyeluruh");
  }

  console.log("\n== Dua penarikan tidak pernah bersamaan ==");
  {
    const kedua = penjadwal.mulaiPenarikanMenyeluruh({ olehSiapa: "Penguji" });
    periksa("penarikan kedua ditolak", kedua.ok === false);
    periksa("alasannya disebutkan", kedua.alasan === "penarikan_sedang_berjalan");

    const perkara = penjadwal.mulaiPenarikanPerkara("620/Pdt.G/2025/PA.Dgl");
    periksa("penarikan satu perkara juga ditolak saat sibuk", perkara.ok === false);
  }

  console.log("\n== Keluaran sampai ke berkas log ==");
  {
    const berkasLog = pathx.join(FOLDER_LOG, penjadwal.getStatus().berkasLog);
    anakTerakhir.stdout.emit("data", "menarik perkara 620\n");
    await tunggu(50);

    const isi = fs.existsSync(berkasLog) ? fs.readFileSync(berkasLog, "utf8") : "";
    periksa("berkas log dibuat", fs.existsSync(berkasLog));
    periksa("keluaran jembatan tercatat di log", isi.includes("menarik perkara 620"));
    periksa("kepala log menyebut sumbernya", isi.includes("portal-menyeluruh"));
  }

  console.log("\n== Setelah selesai ==");
  {
    selesaikan(0);
    await tunggu(50);

    periksa("status tidak lagi sedang jalan", penjadwal.getStatus().sedangJalan === false);
    // Sifat yang dijaga: kunci HARUS hilang. Kunci yang tertinggal akan
    // menghalangi setiap penarikan berikutnya, termasuk dari skrip host.
    periksa("kunci dihapus", !fs.existsSync(BERKAS_KUNCI));
  }

  console.log("\n== Penarikan satu perkara ==");
  {
    const hasil = penjadwal.mulaiPenarikanPerkara("620/Pdt.G/2025/PA.Dgl", { olehSiapa: "Penguji" });
    catatLogBaru();

    periksa("penarikan perkara dimulai", hasil.ok === true);
    periksa("nomor perkara dikirim ke jembatan", argumenTerakhir.includes("620/Pdt.G/2025/PA.Dgl"));
    periksa("memakai --perkara", argumenTerakhir.includes("--perkara"));
    // Batas jumlah perkara tidak berarti apa-apa ketika perkaranya sudah
    // ditunjuk satu per satu.
    periksa("tanpa --maks-perkara", !argumenTerakhir.includes("--maks-perkara"));
    periksa("perkara yang diminta tercatat di status", penjadwal.getStatus().perkaraDiminta === "620/Pdt.G/2025/PA.Dgl");

    selesaikan(0);
    await tunggu(50);
  }

  console.log("\n== Nomor perkara kosong ==");
  {
    const hasil = penjadwal.mulaiPenarikanPerkara("   ");
    periksa("nomor kosong ditolak", hasil.ok === false);
    periksa("alasannya disebutkan", hasil.alasan === "nomor_perkara_kosong");
  }

  console.log("\n== Penghentian ==");
  {
    const tanpaPenarikan = penjadwal.hentikanPenarikan();
    periksa("menghentikan saat tidak ada penarikan ditolak", tanpaPenarikan.ok === false);
    periksa("alasannya disebutkan", tanpaPenarikan.alasan === "tidak_ada_penarikan");

    penjadwal.mulaiPenarikanMenyeluruh({ olehSiapa: "Penguji" });
    catatLogBaru();

    const hasil = penjadwal.hentikanPenarikan({ olehSiapa: "Penguji" });
    periksa("penarikan berjalan dapat dihentikan", hasil.ok === true);

    await tunggu(50);
    periksa("kunci ikut dibersihkan setelah dihentikan", !fs.existsSync(BERKAS_KUNCI));
    periksa("status kembali diam", penjadwal.getStatus().sedangJalan === false);
  }

  console.log("\n== Penarikan terjadwal biasa ==");
  {
    // Tanpa maksPerkara, batasnya mengikuti pengaturan penjadwal seperti
    // sebelum perubahan ini - perilaku lama tidak boleh ikut berubah.
    void penjadwal.jalankanSatuPutaran();
    catatLogBaru();
    periksa("putaran terjadwal tetap memakai --maks-perkara", argumenTerakhir.includes("--maks-perkara"));

    selesaikan(0);
    await tunggu(50);
  }

  // --- Membersihkan berkas yang dibuat pemeriksaan ini ---------------------
  for (const berkas of logDibuat) {
    try {
      fs.unlinkSync(berkas);
    } catch {
      // Sudah tidak ada.
    }
  }
  try {
    fs.unlinkSync(BERKAS_KUNCI);
  } catch {
    // Memang seharusnya sudah terhapus.
  }

  console.log(`\nHasil: ${lulus} lulus, ${gagal} gagal\n`);
  process.exit(gagal === 0 ? 0 : 1);
}

jalan().catch((galat) => {
  console.error("Gagal dijalankan:", galat);
  process.exit(1);
});
