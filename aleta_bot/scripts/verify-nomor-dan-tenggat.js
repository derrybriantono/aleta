#!/usr/bin/env node
"use strict";

/**
 * Memeriksa verifikasi nomor, batas waktu, kedudukan hukum, dan ringkasan panitera.
 *
 *   node scripts/verify-nomor-dan-tenggat.js
 *
 * ============================================================================
 * YANG DIUJI PALING KERAS
 * ============================================================================
 *
 *   1. Nomor yang belum dikonfirmasi TIDAK menerima berkas. Ini penjagaan
 *      terpenting di seluruh ALETA: satu digit salah di SIPP berarti dokumen
 *      perceraian seseorang terkirim ke orang asing.
 *
 *   2. Pertanyaan konfirmasi TIDAK membocorkan perkara. Bila nomornya ternyata
 *      milik orang lain, yang bocor hanya sebuah nama - bukan bahwa orang itu
 *      berperkara, apalagi perkara apa.
 *
 *   3. Dokumen TIDAK ditandai selesai selagi masih menunggu jawaban. Kalau
 *      tertandai, pertanyaannya dijawab tetapi berkasnya tidak pernah menyusul.
 *
 *   4. Pesan menyatakan dirinya BUKAN panggilan resmi.
 */

const fs = require("fs");
const path = require("path");

// --- Tiruan database ---
const botDbPath = require.resolve("../services/botDbService");
require("../services/botDbService");
const baris = [];
require.cache[botDbPath].exports = {
  ensureSchema: async () => true,
  addColumnIfMissing: async () => true,
  toMysqlDate: (v) => new Date(v).toISOString().slice(0, 19).replace("T", " "),
  query: async (sql, params = []) => {
    if (/^\s*CREATE TABLE/i.test(sql)) return [];
    if (/INSERT INTO aleta_bot_nomor_terverifikasi/i.test(sql)) {
      const ada = baris.find((r) => r.nomor === params[1] && r.nama_kunci === params[3]);
      if (ada) {
        ada.ditanya_pada = params[5];
        ada.jumlah_ditanya += 1;
      } else {
        baris.push({
          id: params[0], nomor: params[1], nama_pihak: params[2], nama_kunci: params[3],
          status: params[4], ditanya_pada: params[5], dijawab_pada: null, jumlah_ditanya: 1,
        });
      }
      return { affectedRows: 1 };
    }
    if (/UPDATE aleta_bot_nomor_terverifikasi/i.test(sql)) {
      const r = baris.find((x) => x.id === params[4]);
      if (r) { r.status = params[0]; r.dijawab_pada = params[1]; }
      return { affectedRows: 1 };
    }
    if (/FROM aleta_bot_nomor_terverifikasi/i.test(sql)) {
      if (/nama_kunci = \?/.test(sql)) {
        return baris.filter((r) => r.nomor === params[0] && r.nama_kunci === params[1]);
      }
      // Urutan parameter berbeda antar kueri: handleReply memakai
      // "nomor = ? AND status = ?", listSalahAlamat hanya "status = ?".
      if (/nomor = \?[\s\S]*status = \?/.test(sql)) {
        return baris.filter((r) => r.nomor === params[0] && r.status === params[1]);
      }
      if (/status = \?/.test(sql)) return baris.filter((r) => r.status === params[0]);
      return baris.slice();
    }
    return [];
  },
};

const verifikasiNomor = require("../services/nomorVerificationService");
const klasifikasi = require("../services/ecourtEventClassifierService");
const scraper = require("../tools/ecourt-bridge/scraper");

let lulus = 0;
let gagal = 0;

function periksa(label, kondisi) {
  if (kondisi) {
    lulus += 1;
    console.log(`  OK    ${label}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${label}`);
  }
}

const NOMOR = "6285242120977";
const NAMA = "Sulastri binti Djanggola";

async function utama() {
  console.log("\n== ATURAN POKOK: nomor belum dikonfirmasi tidak menerima berkas ==");
  {
    baris.length = 0;
    const pertama = await verifikasiNomor.ensureVerified(NOMOR, NAMA);
    periksa("permintaan pertama TIDAK boleh kirim", pertama.boleh === false);
    periksa("pertanyaan disiapkan", typeof pertama.pertanyaan === "string" && pertama.pertanyaan.length > 0);
    periksa("statusnya menunggu", pertama.status === verifikasiNomor.STATUS.MENUNGGU);

    // Pekerja berjalan lagi sebelum dijawab: jangan bertanya berulang-ulang.
    const kedua = await verifikasiNomor.ensureVerified(NOMOR, NAMA);
    periksa("tidak bertanya dua kali", kedua.boleh === false && kedua.pertanyaan === null);
    periksa("alasannya menunggu jawaban", kedua.alasan === "menunggu_jawaban");
  }

  console.log("\n== Pertanyaan tidak membocorkan perkara ==");
  {
    const tanya = verifikasiNomor.buildQuestion(NAMA);
    periksa("menyebut nama pihak", tanya.includes(NAMA));
    periksa("TIDAK menyebut nomor perkara", !/\d+\/Pdt|PA\.Dgl/i.test(tanya));
    periksa("TIDAK menyebut jenis dokumen", !/jawaban|replik|gugatan|cerai/i.test(tanya));
    periksa("TIDAK menyebut kata perkara", !/perkara/i.test(tanya));
    periksa("menjelaskan cara menjawab", /YA/.test(tanya) && /BUKAN/.test(tanya));
    periksa("menjanjikan tidak mengirim sebelum dijawab", /tidak ada berkas yang dikirim/i.test(tanya));
  }

  console.log("\n== Jawaban YA membuka pengiriman ==");
  {
    baris.length = 0;
    await verifikasiNomor.ensureVerified(NOMOR, NAMA);
    const jawab = await verifikasiNomor.handleReply({ senderNumber: NOMOR, text: "YA" });
    periksa("jawaban ditanggapi", jawab !== null);
    const sesudah = await verifikasiNomor.ensureVerified(NOMOR, NAMA);
    periksa("setelah YA, boleh dikirim", sesudah.boleh === true);
    periksa("tidak bertanya lagi", sesudah.pertanyaan === null);
  }

  console.log("\n== Jawaban BUKAN menutup selamanya ==");
  {
    baris.length = 0;
    await verifikasiNomor.ensureVerified(NOMOR, NAMA);
    await verifikasiNomor.handleReply({ senderNumber: NOMOR, text: "bukan" });
    const sesudah = await verifikasiNomor.ensureVerified(NOMOR, NAMA);
    periksa("tetap TIDAK boleh dikirim", sesudah.boleh === false);
    periksa("statusnya ditolak", sesudah.status === verifikasiNomor.STATUS.DITOLAK);
    periksa("tidak bertanya lagi", sesudah.pertanyaan === null);

    const salahAlamat = await verifikasiNomor.listSalahAlamat();
    periksa("masuk daftar salah alamat", salahAlamat.length === 1);
  }

  console.log("\n== Jawaban acak tidak tertangkap ==");
  {
    baris.length = 0;
    await verifikasiNomor.ensureVerified(NOMOR, NAMA);
    for (const teks of ["halo", "1", "menu", "jadwal", "terima kasih"]) {
      const hasil = await verifikasiNomor.handleReply({ senderNumber: NOMOR, text: teks });
      periksa(`"${teks}" diteruskan ke alur lain`, hasil === null);
    }
  }

  console.log("\n== YA dari nomor yang tidak ditanya diabaikan ==");
  {
    baris.length = 0;
    const hasil = await verifikasiNomor.handleReply({ senderNumber: "6281200000000", text: "ya" });
    periksa("tidak menanggapi", hasil === null);
  }

  console.log("\n== Nama berbeda tidak mewarisi kepercayaan ==");
  {
    baris.length = 0;
    await verifikasiNomor.ensureVerified(NOMOR, NAMA);
    await verifikasiNomor.handleReply({ senderNumber: NOMOR, text: "YA" });
    periksa("nama asal boleh", (await verifikasiNomor.ensureVerified(NOMOR, NAMA)).boleh === true);
    const lain = await verifikasiNomor.ensureVerified(NOMOR, "Rusman Rusli");
    periksa("nama lain TIDAK otomatis dipercaya", lain.boleh === false);
  }

  console.log("\n== Nama kosong ditolak ==");
  {
    const tanpaNama = await verifikasiNomor.ensureVerified(NOMOR, "");
    periksa("tanpa nama tidak boleh kirim", tanpaNama.boleh === false);
    periksa("alasannya jelas", tanpaNama.alasan === "nama_pihak_tidak_diketahui");
    periksa("nomor tidak sah ditolak", (await verifikasiNomor.ensureVerified("abc", NAMA)).boleh === false);
  }

  console.log("\n== BATAS WAKTU terbaca dari e-Court ==");
  {
    const html =
      "<p>Agenda Sidang : <b>Jawaban Tergugat</b> Silahkan Mengupload Berkas Persidangan Sebelum : Selasa, 09 Desember 2025 Pukul : 15:00:00 WIB</p>";
    const hasil = scraper.extractUploadDeadlines(html);
    periksa("satu tenggat terbaca", hasil.length === 1);
    periksa("agendanya benar", hasil[0].agenda === "Jawaban Tergugat");
    periksa("tanggalnya terurai", hasil[0].batasWaktu instanceof Date);
    periksa(
      "jam 15:00 WIB benar",
      hasil[0].batasWaktu.getUTCHours() === 8 || hasil[0].batasWaktu.getHours() === 15
    );
    periksa("teks aslinya disimpan", /15:00:00 WIB/.test(hasil[0].batasWaktuTeks));

    periksa("halaman tanpa tenggat aman", scraper.extractUploadDeadlines("<p>tidak ada apa-apa</p>").length === 0);
  }

  console.log("\n== BATAS WAKTU masuk ke isi pesan ==");
  {
    const besok = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const keputusan = { notify: true, label: "Jawaban", ringkasan: "Ada jawaban.", tindakan: "", classes: [], targetRole: "penggugat" };

    const pesan = klasifikasi.buildMessage(
      { nomor_perkara: "620/Pdt.G/2025/PA.Dgl", batasUnggahTeks: "Selasa, 09 Desember 2025 Pukul : 15:00 WIB", batasUnggah: besok },
      keputusan,
      { namaPihak: "Sulastri" }
    );
    periksa("tenggat disebut di pesan", /Batas waktu menanggapi/.test(pesan));
    periksa("teks tenggat ditampilkan", /09 Desember 2025/.test(pesan));
    periksa("sisa hari diingatkan", /hari lagi|HARI INI/.test(pesan));

    const tanpaTenggat = klasifikasi.buildMessage({ nomor_perkara: "620/Pdt.G/2025/PA.Dgl" }, keputusan, {});
    periksa("tanpa tenggat, barisnya tidak muncul", !/Batas waktu menanggapi/.test(tanpaTenggat));
  }

  console.log("\n== KEDUDUKAN HUKUM dinyatakan di setiap pesan ==");
  {
    const keputusan = { notify: true, label: "Jawaban", ringkasan: "Ada jawaban.", tindakan: "", classes: [], targetRole: "penggugat" };
    const pesan = klasifikasi.buildMessage({ nomor_perkara: "620/Pdt.G/2025/PA.Dgl" }, keputusan, {});
    periksa("menyatakan bukan pengganti panggilan resmi", /bukan pengganti panggilan resmi/i.test(pesan));
    periksa("menyebut jurusita sebagai yang sah", /jurusita/i.test(pesan));
  }

  console.log("\n== Pekerja tidak menandai selesai selagi menunggu ==");
  {
    const sumber = fs.readFileSync(path.resolve(__dirname, "..", "services", "ecourtNotificationWorker.js"), "utf8");
    periksa("memanggil ensureVerified sebelum mengirim", /ensureVerified\(orang\.nomor/.test(sumber));
    periksa("menghitung yang menunggu", /menungguVerifikasi \+= 1/.test(sumber));
    periksa(
      "markNotified dijaga oleh pemeriksaan menunggu",
      /if \(menungguVerifikasi > 0\)[\s\S]{0,400}return[\s\S]{0,200}markNotified/.test(sumber)
    );
    periksa("menunggu bukan dihitung gagal", /status === "menunggu"[\s\S]{0,500}ringkasan\.menungguVerifikasi/.test(sumber));
    periksa("pertanyaan dikirim tanpa lampiran", /attachment: null[\s\S]{0,120}sourceFeature: "verifikasi_nomor"/.test(sumber));
  }

  console.log("\n== Ringkasan panitera hanya membaca ==");
  {
    const sumber = fs.readFileSync(path.resolve(__dirname, "..", "services", "paniteraDashboardService.js"), "utf8");
    periksa("tidak ada INSERT", !/INSERT\s+INTO/i.test(sumber));
    periksa("tidak ada UPDATE", !/UPDATE\s+aleta/i.test(sumber));
    periksa("tidak ada DELETE", !/DELETE\s+FROM/i.test(sumber));

    const rute = fs.readFileSync(path.resolve(__dirname, "..", "routes", "internalGatewayRoutes.js"), "utf8");
    periksa("rute panitera memakai GET", /router\.get\("\/ecourt\/panitera"/.test(rute));
    periksa("rute panitera menuntut token", /\/ecourt\/panitera",\s*requireInternalToken/.test(rute));
  }

  console.log(`\nLulus: ${lulus}, Gagal: ${gagal}`);
  if (gagal > 0) {
    console.log("ADA PERIKSAAN YANG GAGAL.");
    process.exit(1);
  }
  console.log("SEMUA PERIKSAAN LULUS.");
  process.exit(0);
}

utama().catch((error) => {
  console.error("Gagal menjalankan pengujian:", error);
  process.exit(1);
});
