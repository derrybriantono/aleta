#!/usr/bin/env node
"use strict";

/**
 * Memeriksa verifikasi lewat portal, rekonsiliasi e-Court, dan aturan bukti.
 *
 *   node scripts/verify-portal-dan-rekonsiliasi.js
 *
 * ============================================================================
 * YANG DIUJI PALING KERAS
 * ============================================================================
 *
 *   1. Jalur portal TIDAK LEBIH LONGGAR dari jalur WhatsApp. Hakim di luar
 *      majelis tetap ditolak, dan konfirmasi kedua tetap dituntut.
 *
 *   2. Rekonsiliasi MELAPORKAN, tidak menimpa. Selisih antara catatan ALETA
 *      dan status e-Court harus terlihat, bukan diperbaiki diam-diam dengan
 *      menebak mana yang benar.
 *
 *   3. Bukti tidak memakai tenggat unggah. Menempelkan tenggat pada
 *      pemberitahuan bukti membuat pihak mengira haknya hangus padahal tidak.
 */

const fs = require("fs");
const path = require("path");

// --- Tiruan database ALETA ---
const botDbPath = require.resolve("../services/botDbService");
require("../services/botDbService");
const botState = { dokumen: [], verifikasi: [] };
require.cache[botDbPath].exports = {
  ensureSchema: async () => true,
  addColumnIfMissing: async () => true,
  toMysqlDate: (v) => new Date(v).toISOString().slice(0, 19).replace("T", " "),
  query: async (sql, params = []) => {
    if (/^\s*CREATE TABLE/i.test(sql)) return [];
    if (/FROM aleta_bot_ecourt_documents/i.test(sql) && /document_key = \?/.test(sql)) {
      return botState.dokumen.filter((d) => d.document_key === params[0]);
    }
    if (/FROM aleta_bot_ecourt_documents/i.test(sql)) {
      return botState.dokumen.filter((d) => d.status_verifikasi === "belum");
    }
    if (/INSERT INTO aleta_bot_ecourt_verifications/i.test(sql)) {
      botState.verifikasi.push({ document_key: params[1], keputusan: params[6], nama_hakim: params[5] });
      return { affectedRows: 1 };
    }
    return [];
  },
};

// --- Tiruan SIPP ---
const dbPath = require.resolve("../db_config");
require("../db_config");
const sippState = { majelis: [] };
require.cache[dbPath].exports = {
  query(sql, params, callback) {
    const selesai = typeof params === "function" ? params : callback;
    if (typeof selesai !== "function") return;
    selesai(null, sippState.majelis.map((nama) => ({ nama_gelar: nama })));
  },
};

const verifikasi = require("../services/ecourtVerificationService");
const rekonsiliasi = require("../services/ecourtReconciliationService");
const klasifikasi = require("../services/ecourtEventClassifierService");

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

const HAKIM = { name: "DERRY BRIANTONO, S.H.", roleId: "hakim", positionName: "Hakim", whatsappNumber: "6285242120977" };
const CONFIG = { employeeRecipients: [HAKIM] };
const DOKUMEN = {
  document_key: "kunci-1",
  nomor_perkara: "620/Pdt.G/2025/PA.Dgl",
  judul_dokumen: "Jawaban Tergugat Sri Astuti Ningsih",
  peran_pengunggah: "Tergugat",
  status_verifikasi: "belum",
  berkas_pdf: null,
  berkas_word: null,
  diunggah_pada: new Date(2025, 11, 9, 11, 30),
};

function siapkan() {
  botState.dokumen = [{ ...DOKUMEN }];
  botState.verifikasi = [];
  sippState.majelis = ["Derry Briantono, S.H."];
}

async function utama() {
  console.log("\n== Portal mengenali hakim dari nama ==");
  {
    const hakim = verifikasi.identifyJudgeByName("DERRY BRIANTONO, S.H.", CONFIG);
    periksa("nama lengkap dikenali", hakim !== null);
    periksa("nama tanpa gelar juga dikenali", verifikasi.identifyJudgeByName("Derry Briantono", CONFIG) !== null);
    periksa("nama lain ditolak", verifikasi.identifyJudgeByName("Rusman Rusli", CONFIG) === null);
    periksa("nama kosong ditolak", verifikasi.identifyJudgeByName("", CONFIG) === null);

    const panitera = { ...HAKIM, roleId: "panitera", positionName: "Panitera Pengganti" };
    periksa(
      "pegawai bukan hakim ditolak",
      verifikasi.identifyJudgeByName("DERRY BRIANTONO, S.H.", { employeeRecipients: [panitera] }) === null
    );
  }

  console.log("\n== ATURAN POKOK: portal tidak lebih longgar dari WhatsApp ==");
  {
    siapkan();
    // Hakim ada, tetapi BUKAN majelis perkara ini.
    sippState.majelis = ["Ahmad Fauzi, S.H."];
    const hasil = await verifikasi.decideFromPortal({
      namaLengkap: "DERRY BRIANTONO, S.H.",
      documentKey: "kunci-1",
      keputusan: "valid",
      konfirmasi: true,
      runtimeConfig: CONFIG,
    });
    periksa("hakim di luar majelis DITOLAK", hasil.ok === false && hasil.alasan === "bukan_anggota_majelis");
    periksa("keputusan tidak tersimpan", botState.verifikasi.length === 0);
  }

  console.log("\n== Konfirmasi kedua tetap dituntut ==");
  {
    siapkan();
    const tanpaKonfirmasi = await verifikasi.decideFromPortal({
      namaLengkap: "DERRY BRIANTONO, S.H.",
      documentKey: "kunci-1",
      keputusan: "valid",
      konfirmasi: false,
      runtimeConfig: CONFIG,
    });
    periksa("tanpa konfirmasi ditolak", tanpaKonfirmasi.ok === false);
    periksa("alasannya jelas", tanpaKonfirmasi.alasan === "konfirmasi_belum_diberikan");
    periksa("tidak tersimpan", botState.verifikasi.length === 0);

    // Nilai yang mirip-benar tidak boleh lolos.
    for (const nilai of ["true", 1, "ya", {}]) {
      siapkan();
      const hasil = await verifikasi.decideFromPortal({
        namaLengkap: "DERRY BRIANTONO, S.H.",
        documentKey: "kunci-1",
        keputusan: "valid",
        konfirmasi: nilai,
        runtimeConfig: CONFIG,
      });
      periksa(`konfirmasi=${JSON.stringify(nilai)} ditolak`, hasil.ok === false);
    }
  }

  console.log("\n== Keputusan tidak dikenali ditolak ==");
  {
    siapkan();
    for (const nilai of ["", "mungkin", "VALID", "ya"]) {
      const hasil = await verifikasi.decideFromPortal({
        namaLengkap: "DERRY BRIANTONO, S.H.",
        documentKey: "kunci-1",
        keputusan: nilai,
        konfirmasi: true,
        runtimeConfig: CONFIG,
      });
      periksa(`keputusan "${nilai}" ditolak`, hasil.ok === false && hasil.alasan === "keputusan_tidak_dikenali");
    }
    periksa("tidak ada yang tersimpan", botState.verifikasi.length === 0);
  }

  console.log("\n== Alur portal yang sah berhasil ==");
  {
    siapkan();
    const hasil = await verifikasi.decideFromPortal({
      namaLengkap: "DERRY BRIANTONO, S.H.",
      documentKey: "kunci-1",
      keputusan: "valid",
      konfirmasi: true,
      runtimeConfig: CONFIG,
    });
    periksa("keputusan tersimpan", hasil.ok === true && botState.verifikasi.length === 1);
    periksa("nilainya benar", botState.verifikasi[0].keputusan === "valid");
    periksa("nama hakim tercatat", botState.verifikasi[0].nama_hakim === "DERRY BRIANTONO, S.H.");
  }

  console.log("\n== Daftar portal hanya perkara majelisnya ==");
  {
    siapkan();
    const daftar = await verifikasi.listForPortal("DERRY BRIANTONO, S.H.", { runtimeConfig: CONFIG });
    periksa("daftar terbaca", daftar.ok === true && daftar.dokumen.length === 1);
    periksa("nama hakim dikembalikan", daftar.hakim.nama === "DERRY BRIANTONO, S.H.");

    const bukanHakim = await verifikasi.listForPortal("Orang Lain", { runtimeConfig: CONFIG });
    periksa("bukan hakim ditolak", bukanHakim.ok === false);
    periksa("tidak membocorkan dokumen", bukanHakim.dokumen.length === 0);
  }

  console.log("\n== REKONSILIASI: seluruh kemungkinan selisih ==");
  {
    const kasus = [
      ["sama-sama belum", { status_verifikasi: "belum" }, null, null],
      ["diverifikasi di luar ALETA", { status_verifikasi: "valid" }, null, rekonsiliasi.JENIS.DIVERIFIKASI_DI_LUAR],
      ["cocok setelah diteruskan", { status_verifikasi: "valid" }, { keputusan: "valid", diteruskan_pada: "2026-01-01" }, null],
      ["belum diteruskan", { status_verifikasi: "belum" }, { keputusan: "valid", diteruskan_pada: null }, rekonsiliasi.JENIS.BELUM_DITERUSKAN],
      ["penerusan gagal diam-diam", { status_verifikasi: "belum" }, { keputusan: "valid", diteruskan_pada: "2026-01-01" }, rekonsiliasi.JENIS.PENERUSAN_GAGAL],
      ["bertentangan", { status_verifikasi: "tidak_valid" }, { keputusan: "valid", diteruskan_pada: "2026-01-01" }, rekonsiliasi.JENIS.BERTENTANGAN],
      ["diubah di e-Court sebelum diteruskan", { status_verifikasi: "tidak_valid" }, { keputusan: "valid", diteruskan_pada: null }, rekonsiliasi.JENIS.BERTENTANGAN],
    ];

    for (const [nama, dok, kep, diharapkan] of kasus) {
      const hasil = rekonsiliasi.bandingkan(dok, kep);
      const jenis = hasil ? hasil.jenis : null;
      periksa(`${nama} -> ${diharapkan || "tidak ada selisih"}`, jenis === diharapkan);
    }
  }

  console.log("\n== Selisih genting ditandai tinggi ==");
  {
    const bertentangan = rekonsiliasi.bandingkan(
      { status_verifikasi: "tidak_valid" },
      { keputusan: "valid", diteruskan_pada: "2026-01-01" }
    );
    periksa("pertentangan berkegentingan tinggi", bertentangan.kegentingan === "tinggi");
    periksa("penjelasan menyebut e-Court sebagai yang resmi", /e-Court/.test(bertentangan.penjelasan));

    const gagal2 = rekonsiliasi.bandingkan({ status_verifikasi: "belum" }, { keputusan: "valid", diteruskan_pada: "2026-01-01" });
    periksa("penerusan gagal berkegentingan tinggi", gagal2.kegentingan === "tinggi");

    const luar = rekonsiliasi.bandingkan({ status_verifikasi: "valid" }, null);
    periksa("diverifikasi di luar berkegentingan rendah", luar.kegentingan === "rendah");
  }

  console.log("\n== REKONSILIASI melaporkan, tidak menimpa ==");
  {
    const sumber = fs.readFileSync(path.resolve(__dirname, "..", "services", "ecourtReconciliationService.js"), "utf8");
    periksa("tidak ada UPDATE", !/UPDATE\s+aleta/i.test(sumber));
    periksa("tidak ada INSERT ke tabel data", !/INSERT\s+INTO\s+aleta_bot_ecourt/i.test(sumber));
    periksa("tidak ada DELETE", !/DELETE\s+FROM/i.test(sumber));
    periksa("selisih genting dicatat", /ecourt_rekonsiliasi_selisih/.test(sumber));
  }

  console.log("\n== BUKTI: aturannya berbeda ==");
  {
    const besok = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const dokBukti = {
      judul_dokumen: "bukti surat",
      status_verifikasi: "valid",
      peran_pengunggah: "Tergugat",
      nomor_perkara: "620/Pdt.G/2025/PA.Dgl",
      batasUnggahTeks: "Selasa, 09 Desember 2025 Pukul : 15:00 WIB",
      batasUnggah: besok,
    };
    const kepBukti = klasifikasi.decide(dokBukti, {});
    periksa("bukti dikenali", kepBukti.classes.includes("bukti"));
    periksa("tenggat TIDAK berlaku untuk bukti", kepBukti.tenggatBerlaku === false);

    const pesanBukti = klasifikasi.buildMessage(dokBukti, kepBukti, { namaPihak: "Sulastri" });
    periksa("tenggat TIDAK muncul di pesan bukti", !/Batas waktu menanggapi/.test(pesanBukti));
    periksa("catatan asli muncul", /asli tetap harus diperlihatkan/i.test(pesanBukti));
    periksa("tetap menyatakan bukan panggilan resmi", /bukan pengganti panggilan resmi/i.test(pesanBukti));

    // Jawaban TETAP memakai tenggat - jangan sampai perbaikan bukti
    // menghilangkan tenggat dari dokumen yang justru membutuhkannya.
    const dokJawaban = { ...dokBukti, judul_dokumen: "Jawaban Tergugat" };
    const kepJawaban = klasifikasi.decide(dokJawaban, {});
    periksa("tenggat TETAP berlaku untuk jawaban", kepJawaban.tenggatBerlaku === true);
    const pesanJawaban = klasifikasi.buildMessage(dokJawaban, kepJawaban, { namaPihak: "Sulastri" });
    periksa("tenggat muncul di pesan jawaban", /Batas waktu menanggapi/.test(pesanJawaban));
    periksa("catatan bukti tidak nyasar ke jawaban", !/asli tetap harus diperlihatkan/i.test(pesanJawaban));
  }

  console.log("\n== Rute portal memakai token dan metode yang benar ==");
  {
    const rute = fs.readFileSync(path.resolve(__dirname, "..", "routes", "internalGatewayRoutes.js"), "utf8");
    periksa("daftar verifikasi GET bertoken", /router\.get\("\/ecourt\/verifikasi",\s*requireInternalToken/.test(rute));
    periksa("keputusan POST bertoken", /router\.post\("\/ecourt\/verifikasi",\s*requireInternalToken/.test(rute));
    periksa("rekonsiliasi GET bertoken", /router\.get\("\/ecourt\/rekonsiliasi",\s*requireInternalToken/.test(rute));
    periksa("konfirmasi diteruskan tegas true", /konfirmasi:\s*req\.body\?\.konfirmasi === true/.test(rute));
  }

  console.log("\n== SAKLAR e-Court benar-benar bekerja ==");
  {
    const fsx = require("fs");
    const pathx = require("path");
    const sumber = fsx.readFileSync(
      pathx.resolve(__dirname, "..", "services", "ecourtNotificationWorker.js"),
      "utf8"
    );

    // Saklar yang hanya mengubah tampilan tanpa menghentikan pekerja adalah
    // hiasan yang berbahaya: petugas mengira pemberitahuan sudah berhenti,
    // padahal pesan tetap berangkat.
    periksa("pekerja memeriksa saklar", /ecourtNotifikasiAktif === false/.test(sumber));

    // Dimatikan TIDAK boleh menandai dokumen sebagai dilewati - kalau ditandai,
    // seluruh antrean hangus hanya karena saklar sempat dimatikan sebentar.
    const blokSaklar = sumber.slice(
      sumber.indexOf("ecourtNotifikasiAktif === false"),
      sumber.indexOf("ecourtNotifikasiAktif === false") + 300
    );
    periksa("dimatikan tidak menandai dilewati", !/markSkipped/.test(blokSaklar));
    periksa("dimatikan berhenti lebih dulu", /return \{[\s\S]{0,120}dimatikan: true/.test(blokSaklar));

    const rute = fsx.readFileSync(
      pathx.resolve(__dirname, "..", "routes", "internalGatewayRoutes.js"),
      "utf8"
    );
    periksa("rute status bertoken", /router\.get\("\/ecourt\/status",\s*requireInternalToken/.test(rute));
    periksa("rute saklar bertoken", /router\.post\("\/ecourt\/aktif",\s*requireInternalToken/.test(rute));
    periksa("saklar hanya menerima true tegas", /req\.body\?\.aktif === true/.test(rute));
    periksa("perubahan saklar dicatat", /ecourt_notifikasi_saklar/.test(rute));
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
