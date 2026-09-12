"use strict";

/**
 * ============================================================================
 * SELISIH e-COURT DAN SIPP, DIPERIKSA SENDIRI TIAP MALAM
 * ============================================================================
 *
 * Panel ekstensi sudah lama menghitung "Tidak cocok dengan e-Court" - tetapi
 * hanya untuk perkara yang KEBETULAN sedang dibuka seseorang. Perkara yang
 * tidak dibuka siapa pun tidak pernah diperiksa, dan justru perkara semacam
 * itulah yang selisihnya paling lama tidak ketahuan: tidak ada yang membukanya
 * karena tidak ada yang tahu ada yang perlu diperiksa di sana.
 *
 * Yang dikerjakan di sini hitungan yang SAMA - ecourtReconciliationService -
 * dijalankan atas seluruh dokumen, lalu ringkasannya dikirim ke panitera.
 * Tidak ada aturan baru yang ditulis ulang di sini; menulis ulang aturannya
 * berarti dua tempat yang akan menyimpang diam-diam.
 *
 * ============================================================================
 * DIAM KETIKA TIDAK ADA SELISIH - DAN ITU KEPUTUSAN
 * ============================================================================
 *
 * Pesan "tidak ada selisih" yang datang tiap malam mengajari orang mengabaikan
 * pesannya, dan pada malam ia berbunyi sungguhan tidak ada yang membacanya.
 * Karena itu yang dikirim hanya ketika ada yang perlu dikerjakan.
 *
 * Diamnya tidak berarti tidak diperiksa: tiap putaran dicatat, berhasil maupun
 * kosong, sehingga pertanyaan "apakah tadi malam diperiksa?" tetap ada
 * jawabannya - lihat keadaan().
 *
 * ============================================================================
 * SEKALI SEMALAM, WALAU BOT DINYALAKAN ULANG LIMA KALI
 * ============================================================================
 *
 * Kunci idempotensinya bertanggal. Bot yang dinyalakan ulang pukul delapan
 * lewat lima tidak mengirim pesan yang sama untuk kedua kalinya - antrean
 * mengenali kuncinya dan memulangkan baris yang sudah ada.
 */

const { readRuntimeConfig } = require("../config/runtime-config");
const ecourtReconciliationService = require("./ecourtReconciliationService");
const messageQueueService = require("./messageQueueService");
const logService = require("./logService");

/** Bawaan bila portal belum menyebut apa pun. */
const BAWAAN = {
  aktif: true,
  // Pukul 20.00, sesudah jam kerja. Selisih yang ditemukan malam ini dikerjakan
  // besok pagi - mengirimnya di tengah hari kerja hanya menyela pekerjaan yang
  // sedang berjalan tanpa mempercepat apa pun.
  jam: 20,
  menit: 0,
  batas: 500,
  // Yang disebut satu per satu. Sisanya dihitung saja: pesan WhatsApp sepanjang
  // lima puluh baris tidak dibaca sampai habis oleh siapa pun.
  maksDisebut: 12,
};

const NAMA_KEGENTINGAN = {
  tinggi: "GENTING",
  sedang: "perlu diperiksa",
  rendah: "ringan",
};

let keadaanTerakhir = {
  pernahJalan: false,
  terakhirPada: null,
  terakhirJumlah: 0,
  terakhirGenting: 0,
  terakhirDikirim: 0,
  terakhirAlasan: "",
};

function pengaturan(runtimeConfig = readRuntimeConfig()) {
  const dari = (runtimeConfig && runtimeConfig.selisihHarian) || {};
  const angka = (nilai, bawaan, min, maks) => {
    const n = Number(nilai);
    if (!Number.isFinite(n)) return bawaan;
    return Math.max(min, Math.min(maks, Math.round(n)));
  };
  return {
    aktif: dari.aktif === undefined ? BAWAAN.aktif : dari.aktif !== false,
    jam: angka(dari.jam, BAWAAN.jam, 0, 23),
    menit: angka(dari.menit, BAWAAN.menit, 0, 59),
    batas: angka(dari.batas, BAWAAN.batas, 50, 2000),
    maksDisebut: angka(dari.maksDisebut, BAWAAN.maksDisebut, 3, 40),
  };
}

/** "50 07 * * *" dari pengaturannya. */
function jadwalCron(atur = pengaturan()) {
  return `${atur.menit} ${atur.jam} * * *`;
}

function dua(n) {
  return String(n).padStart(2, "0");
}

function tanggalHariIni(sekarang = new Date()) {
  return `${sekarang.getFullYear()}-${dua(sekarang.getMonth() + 1)}-${dua(sekarang.getDate())}`;
}

/**
 * Pesan yang dibaca panitera.
 *
 * Nomor perkara dan judul dokumen saja - tidak ada nama pihak sama sekali.
 * Layar ponsel dapat terlihat orang lain, dan nama pihak berperkara bukan
 * keterangan yang perlu dipajang di sana.
 */
function susunPesan(laporan, atur = pengaturan()) {
  const selisih = Array.isArray(laporan.selisih) ? laporan.selisih : [];
  if (selisih.length === 0) return "";

  const genting = selisih.filter((x) => x.kegentingan === "tinggi");
  const baris = [];

  baris.push("*ALETA - selisih e-Court dan SIPP*");
  baris.push(
    `Diperiksa ${laporan.jumlahDokumen} dokumen. Ditemukan ${selisih.length} selisih` +
      (genting.length > 0 ? `, ${genting.length} di antaranya GENTING.` : ".")
  );
  baris.push("");

  const disebut = selisih.slice(0, atur.maksDisebut);
  for (const x of disebut) {
    const nada = NAMA_KEGENTINGAN[x.kegentingan] || x.kegentingan;
    baris.push(`• ${x.nomorPerkara || "(nomor tidak tercatat)"} — ${nada}`);
    baris.push(`  ${x.judulDokumen || "dokumen tanpa judul"}`);
    baris.push(`  ${x.penjelasan}`);
  }

  const sisa = selisih.length - disebut.length;
  if (sisa > 0) baris.push(`• dan ${sisa} selisih lain.`);

  baris.push("");
  baris.push("Selengkapnya di portal ALETA - e-Court, menu Kendali Berkas.");
  return baris.join("\n");
}

/**
 * Satu putaran pemeriksaan.
 *
 * @param {{kering?: boolean, penerima?: Record<string,string>, olehSiapa?: string}} opsi
 *   kering: menyusun dan memulangkan pesannya tanpa mengantre apa pun.
 */
async function jalankanSatuPutaran(opsi = {}) {
  const atur = pengaturan();
  const kering = opsi.kering === true;

  let laporan;
  try {
    laporan = await ecourtReconciliationService.periksa({ limit: atur.batas });
  } catch (galat) {
    const alasan = String((galat && galat.message) || galat).slice(0, 200);
    keadaanTerakhir = {
      pernahJalan: true,
      terakhirPada: new Date().toISOString(),
      terakhirJumlah: 0,
      terakhirGenting: 0,
      terakhirDikirim: 0,
      terakhirAlasan: `gagal_memeriksa: ${alasan}`,
    };
    return { ok: false, alasan: "gagal_memeriksa", pesan: alasan };
  }

  const selisih = Array.isArray(laporan.selisih) ? laporan.selisih : [];
  const genting = selisih.filter((x) => x.kegentingan === "tinggi").length;
  const pesan = susunPesan(laporan, atur);

  // Tidak ada selisih: dicatat, tidak dikirim. Lihat catatan di kepala berkas.
  if (!pesan) {
    keadaanTerakhir = {
      pernahJalan: true,
      terakhirPada: new Date().toISOString(),
      terakhirJumlah: 0,
      terakhirGenting: 0,
      terakhirDikirim: 0,
      terakhirAlasan: "tidak_ada_selisih",
    };
    return { ok: true, jumlah: 0, genting: 0, dikirim: 0, alasan: "tidak_ada_selisih", pesan: "" };
  }

  // Penerima dibaca dari pemetaan jabatan yang sama dengan notifikasi lain -
  // panitera, dan panitera muda gugatan serta permohonan yang mengurus
  // berkasnya sehari-hari.
  const penerima = opsi.penerima || penerimaBawaan();
  const daftar = Object.entries(penerima).filter(([, nomor]) => Boolean(nomor));

  if (kering) {
    return {
      ok: true,
      kering: true,
      jumlah: selisih.length,
      genting,
      penerima: daftar.map(([nama]) => nama),
      pesan,
    };
  }

  const hariIni = tanggalHariIni();
  let dikirim = 0;
  for (const [nama, nomor] of daftar) {
    try {
      await messageQueueService.enqueueMessage({
        // Bertanggal: bot yang dinyalakan ulang tidak mengirim ulang.
        idempotencyKey: `selisih-harian:${hariIni}:${nomor}`,
        recipientNumber: nomor,
        recipientName: nama,
        message: pesan,
        category: "employee",
        notificationKey: "selisih-ecourt-harian",
        sourceApp: "aleta_bot",
        sourceFeature: "selisih_harian",
        entityType: "rekonsiliasi",
        entityId: hariIni,
        metadata: { jumlah: selisih.length, genting },
      });
      dikirim += 1;
    } catch (galat) {
      // Satu penerima yang gagal tidak boleh menghentikan yang lain.
      console.warn(
        `[selisih harian] gagal mengantre ke ${nama}: ${String((galat && galat.message) || galat).slice(0, 160)}`
      );
    }
  }

  keadaanTerakhir = {
    pernahJalan: true,
    terakhirPada: new Date().toISOString(),
    terakhirJumlah: selisih.length,
    terakhirGenting: genting,
    terakhirDikirim: dikirim,
    terakhirAlasan: "",
  };

  void logService.logSecurityEvent({
    eventType: "ecourt_selisih_harian",
    severity: genting > 0 ? "warning" : "info",
    message: `Pemeriksaan selisih harian: ${selisih.length} selisih, ${genting} genting, diantre ke ${dikirim} penerima.`,
    metadata: { jumlah: selisih.length, genting, dikirim, olehSiapa: opsi.olehSiapa || "penjadwal" },
  });

  return { ok: true, jumlah: selisih.length, genting, dikirim, pesan };
}

/**
 * Penerima bawaan.
 *
 * Dibaca saat dipanggil, bukan saat berkas ini dimuat: pemetaan nomor dapat
 * berubah dari Manajemen Akun, dan yang dibaca sekali pada saat bot menyala
 * akan tertinggal sampai bot dinyalakan ulang.
 */
function penerimaBawaan() {
  try {
    // Dimuat malas: whatsapp.js membaca runtime config saat dimuat, dan
    // memuatnya dari puncak berkas ini akan menyeretnya ke dalam tiap uji yang
    // hanya ingin memeriksa susunan pesannya.
    const peta = require("../whatsapp");
    return {
      ...(peta.paniteraId || {}),
      ...(peta.panmudGugatanId || {}),
      ...(peta.panmudPermohonanId || {}),
    };
  } catch {
    return {};
  }
}

function keadaan() {
  return { ...keadaanTerakhir, pengaturan: pengaturan(), jadwal: jadwalCron() };
}

module.exports = {
  BAWAAN,
  pengaturan,
  jadwalCron,
  susunPesan,
  jalankanSatuPutaran,
  penerimaBawaan,
  keadaan,
};
