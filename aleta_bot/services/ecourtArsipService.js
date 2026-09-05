"use strict";

/**
 * Penjagaan ruang dan masa simpan arsip berkas e-Court.
 *
 * ============================================================================
 * DUA HAL YANG DIJAGA
 * ============================================================================
 *
 *   1. RUANG DISK. Disk penuh di server pengadilan tidak hanya menghentikan
 *      ALETA - ia menghentikan MySQL, dan itu menghentikan SIPP. Penarikan
 *      berhenti sendiri sebelum ruangnya habis.
 *
 *   2. MASA SIMPAN. Berkas perkara memuat nama, alamat, dan isi sengketa
 *      keluarga. Menyimpannya selamanya di luar sistem resmi menambah
 *      tanggung jawab yang tidak perlu dipikul pengadilan.
 *
 * ============================================================================
 * YANG DIHAPUS HANYA BERKASNYA, BUKAN CATATANNYA
 * ============================================================================
 *
 * Pembersihan menghapus berkas dari disk dan menandai barisnya, tetapi TIDAK
 * menghapus catatan dokumennya. Riwayat tetap utuh: dokumen apa pernah ada,
 * kapan diunggah, siapa yang memverifikasi, kapan diberitahukan.
 *
 * Arsip resmi tetap di e-Court dan di berkas fisik pengadilan. Yang disimpan
 * ALETA hanya salinan kerja untuk mempercepat pelayanan.
 */

const fs = require("fs");
const path = require("path");

const { readRuntimeConfig, writeRuntimeConfig } = require("../config/runtime-config");
const botDb = require("./botDbService");
const logService = require("./logService");
const ecourtDocumentService = require("./ecourtDocumentService");
const ecourtStoreService = require("./ecourtStoreService");
const sippJadwalSidangService = require("./sippJadwalSidangService");

/** Nilai bawaan bila belum pernah diatur. */
const BAWAAN = {
  minRuangGb: 5,
  maksBerkasMb: 50,
  simpanBulan: 0, // 0 = jangan hapus apa pun sampai pimpinan menetapkannya
};

function angka(nilai, bawaan, min, maks) {
  const n = Number(nilai);
  if (!Number.isFinite(n)) return bawaan;
  return Math.max(min, Math.min(maks, Math.floor(n)));
}

/** Pengaturan arsip yang berlaku sekarang. */
function getSettings(runtimeConfig = readRuntimeConfig()) {
  const p = runtimeConfig.ecourtArsip || {};
  return {
    minRuangGb: angka(p.minRuangGb, BAWAAN.minRuangGb, 1, 500),
    maksBerkasMb: angka(p.maksBerkasMb, BAWAAN.maksBerkasMb, 1, 500),
    // Nol berarti tidak menghapus apa pun. Ini bawaan yang disengaja: berapa
    // lama pengadilan menyimpan salinan berkas pihak adalah keputusan
    // pimpinan, bukan keputusan kode.
    simpanBulan: angka(p.simpanBulan, BAWAAN.simpanBulan, 0, 120),
  };
}

function saveSettings({ minRuangGb, maksBerkasMb, simpanBulan, olehSiapa = "" } = {}) {
  const ruang = Number(minRuangGb);
  const berkas = Number(maksBerkasMb);
  const bulan = Number(simpanBulan);

  if (!Number.isFinite(ruang) || ruang < 1 || ruang > 500) {
    return { ok: false, alasan: "min_ruang_di_luar_1_sampai_500_gb" };
  }
  if (!Number.isFinite(berkas) || berkas < 1 || berkas > 500) {
    return { ok: false, alasan: "maks_berkas_di_luar_1_sampai_500_mb" };
  }
  if (!Number.isFinite(bulan) || bulan < 0 || bulan > 120) {
    return { ok: false, alasan: "masa_simpan_di_luar_0_sampai_120_bulan" };
  }

  const sekarang = readRuntimeConfig();
  writeRuntimeConfig({
    ...sekarang,
    ecourtArsip: {
      minRuangGb: Math.floor(ruang),
      maksBerkasMb: Math.floor(berkas),
      simpanBulan: Math.floor(bulan),
    },
  });

  void logService.logSecurityEvent({
    eventType: "ecourt_arsip_disunting",
    severity: "warning",
    message: "Pengaturan ruang dan masa simpan arsip e-Court disunting.",
    metadata: {
      minRuangGb: Math.floor(ruang),
      maksBerkasMb: Math.floor(berkas),
      simpanBulan: Math.floor(bulan),
      olehSiapa: String(olehSiapa || ""),
    },
  });

  return { ok: true, alasan: "" };
}

/**
 * Sisa ruang disk pada folder arsip.
 *
 * Kegagalan membaca mengembalikan null, dan null diperlakukan sebagai "tidak
 * tahu" - bukan sebagai "cukup". Penarikan berhenti bila ruangnya tidak dapat
 * dipastikan, karena disk penuh di server pengadilan menghentikan SIPP juga.
 */
async function sisaRuang() {
  const folder = ecourtDocumentService.resolveRoot();
  try {
    fs.mkdirSync(folder, { recursive: true });
    const info = await fs.promises.statfs(folder);
    const bebasByte = Number(info.bavail) * Number(info.bsize);
    const totalByte = Number(info.blocks) * Number(info.bsize);
    return {
      ok: true,
      bebasGb: Math.round((bebasByte / 1024 / 1024 / 1024) * 10) / 10,
      totalGb: Math.round((totalByte / 1024 / 1024 / 1024) * 10) / 10,
    };
  } catch (error) {
    return { ok: false, bebasGb: null, totalGb: null, alasan: String(error.message || error) };
  }
}

/**
 * Bolehkah menarik berkas sekarang?
 *
 * Dipanggil jembatan sebelum mengunduh apa pun.
 */
async function bolehMenarik() {
  const pengaturan = getSettings();
  const ruang = await sisaRuang();

  if (!ruang.ok) {
    return { boleh: false, alasan: `ruang_disk_tidak_terbaca: ${ruang.alasan}`, ruang };
  }
  if (ruang.bebasGb < pengaturan.minRuangGb) {
    return {
      boleh: false,
      alasan: `ruang_disk_menipis: tersisa ${ruang.bebasGb} GB, ambang ${pengaturan.minRuangGb} GB`,
      ruang,
    };
  }
  return { boleh: true, alasan: "", ruang };
}

/** Berapa besar arsip sekarang? */
async function ukuranArsip() {
  const folder = ecourtDocumentService.resolveRoot();
  let jumlahBerkas = 0;
  let totalByte = 0;

  const telusuri = (dir) => {
    let isi;
    try {
      isi = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const item of isi) {
      const jalur = path.join(dir, item.name);
      if (item.isDirectory()) {
        telusuri(jalur);
        continue;
      }
      try {
        totalByte += fs.statSync(jalur).size;
        jumlahBerkas += 1;
      } catch {
        // Berkas hilang di tengah penelusuran: diabaikan.
      }
    }
  };

  telusuri(folder);
  return { jumlahBerkas, totalMb: Math.round((totalByte / 1024 / 1024) * 10) / 10 };
}

/**
 * Berkas yang sudah melewati masa simpan.
 *
 * ============================================================================
 * MASA SIMPAN DIHITUNG DARI SELESAINYA PERKARA, BUKAN DARI UNDUHANNYA
 * ============================================================================
 *
 * Berkas yang diunduh dua tahun lalu pada perkara yang MASIH BERJALAN tidak
 * boleh dihapus - justru berkas itulah yang dibaca majelis saat memutus.
 *
 * Karena itu penanda umurnya adalah tanggal berkekuatan hukum tetap; bila BHT
 * belum terisi, tanggal minutasi. Keduanya berarti perkaranya sudah selesai dan
 * berkasnya sudah dijahit.
 *
 * ============================================================================
 * GAGAL-TERTUTUP: TIDAK DAPAT DIPASTIKAN BERARTI TIDAK DIHAPUS
 * ============================================================================
 *
 * Keadaan akhir perkara dibaca dari SIPP. Bila SIPP tidak terbaca, TIDAK ADA
 * yang dihapus - bukan "dihapus dengan asumsi sudah selesai". Penghapusan
 * berkas perkara tidak dapat ditarik kembali, dan menariknya ulang dari e-Court
 * belum tentu masih mungkin.
 *
 * ============================================================================
 * SYARAT LAIN TETAP BERLAKU SEMUANYA
 * ============================================================================
 *
 *   - perkaranya sudah berkekuatan hukum tetap atau sudah diminutasi,
 *   - selisih sejak tanggal itu melewati masa simpan,
 *   - dokumennya sudah diverifikasi majelis,
 *   - pihak sudah diberitahukan.
 *
 * Dokumen yang belum diverifikasi atau belum diberitahukan masih dibutuhkan.
 * Menghapus berkasnya berarti menghilangkan lampiran yang belum sempat sampai
 * ke pihak - kerugian yang tidak dapat diperbaiki.
 */
async function daftarKedaluwarsa({ limit = 500 } = {}) {
  const pengaturan = getSettings();
  if (pengaturan.simpanBulan <= 0) return { aktif: false, daftar: [], alasan: "masa_simpan_belum_ditetapkan" };

  await ecourtStoreService.ensureSchema();

  const batas = new Date();
  batas.setMonth(batas.getMonth() - pengaturan.simpanBulan);
  const batasTeks = botDb.toMysqlDate(batas).slice(0, 10);

  // Calon diambil lebih banyak daripada batas akhir: sebagian akan gugur pada
  // penyaringan keadaan perkara di SIPP, dan mengambil pas-pasan membuat satu
  // putaran pembersihan menghasilkan jauh lebih sedikit daripada yang bisa.
  const ambil = Math.max(1, Math.min(2000, Number(limit) || 500));

  const rows = await botDb.query(
    `SELECT f.id, f.document_key, f.format, f.jalur_berkas, f.ukuran_byte, f.diunduh_pada,
            d.nomor_perkara, d.judul_dokumen
       FROM aleta_bot_ecourt_files f
       JOIN aleta_bot_ecourt_documents d ON d.document_key = f.document_key
      WHERE f.jalur_berkas <> ''
        AND f.dihapus_retensi IS NULL
        AND d.status_verifikasi = 'valid'
        AND d.diberitahukan_pada IS NOT NULL
      ORDER BY f.diunduh_pada ASC
      LIMIT ${ambil * 3}`,
    []
  );

  const calon = Array.isArray(rows) ? rows : [];
  if (calon.length === 0) {
    return { aktif: true, batasTanggal: batasTeks, daftar: [], alasan: "" };
  }

  // Keadaan akhir perkara ditanyakan ke SIPP. Gagal membacanya berarti tidak
  // ada yang dihapus - lihat catatan di kepala fungsi.
  let keadaanAkhir;
  try {
    keadaanAkhir = await sippJadwalSidangService.perkaraFinal(
      calon.map((row) => row.nomor_perkara)
    );
  } catch (galat) {
    return {
      aktif: true,
      batasTanggal: batasTeks,
      daftar: [],
      alasan: `sipp_tidak_terbaca: ${galat.message}`,
    };
  }

  const lolos = [];
  for (const row of calon) {
    if (lolos.length >= ambil) break;

    const akhir = keadaanAkhir[String(row.nomor_perkara)];
    if (!akhir) continue;

    // BHT lebih dipercaya; minutasi dipakai bila BHT belum terisi.
    const penanda = akhir.tanggalBht || akhir.tanggalMinutasi;
    if (!penanda) continue;
    if (penanda >= batasTeks) continue;

    lolos.push({ ...row, tanggalFinal: penanda, dasarFinal: akhir.tanggalBht ? "bht" : "minutasi" });
  }

  return { aktif: true, batasTanggal: batasTeks, daftar: lolos, alasan: "" };
}

/**
 * Menghapus berkas yang sudah melewati masa simpan.
 *
 * MELIHAT adalah perilaku bawaan. Tanpa `hapus: true`, fungsi ini hanya
 * melaporkan apa yang akan dihapus - dan itulah yang dipanggil portal saat
 * menampilkan angkanya.
 */
async function bersihkan({ hapus = false, limit = 500, olehSiapa = "" } = {}) {
  const hasil = await daftarKedaluwarsa({ limit });
  if (!hasil.aktif) {
    return { ok: true, aktif: false, alasan: hasil.alasan || "masa_simpan_belum_ditetapkan", jumlah: 0, totalMb: 0 };
  }

  // SIPP tidak terbaca: tidak ada yang dihapus, dan sebabnya DISEBUTKAN.
  // Pembersihan yang diam-diam tidak menghapus apa pun akan dikira berhasil.
  if (hasil.alasan) {
    return {
      ok: true,
      aktif: true,
      alasan: hasil.alasan,
      jumlah: 0,
      totalMb: 0,
      batasTanggal: hasil.batasTanggal,
      terhapus: 0,
      gagal: 0,
    };
  }

  const totalByte = hasil.daftar.reduce((jumlah, row) => jumlah + Number(row.ukuran_byte || 0), 0);
  const ringkas = {
    ok: true,
    aktif: true,
    jumlah: hasil.daftar.length,
    totalMb: Math.round((totalByte / 1024 / 1024) * 10) / 10,
    batasTanggal: hasil.batasTanggal,
    terhapus: 0,
    gagal: 0,
  };

  if (!hapus) return ringkas;

  for (const row of hasil.daftar) {
    // Jalur diperiksa berada di dalam folder arsip SEBELUM dihapus. Baris
    // database yang keliru tidak boleh berujung menghapus berkas lain di
    // server.
    const periksa = ecourtDocumentService.describeEcourtDocument(row.jalur_berkas);
    if (!periksa.ok) {
      ringkas.gagal += 1;
      continue;
    }

    try {
      fs.unlinkSync(periksa.absolutePath);
    } catch (error) {
      // Berkas sudah tidak ada: tetap dianggap selesai, barisnya dibersihkan.
      if (error.code !== "ENOENT") {
        ringkas.gagal += 1;
        continue;
      }
    }

    // Catatan dokumennya TIDAK dihapus - hanya jalur berkasnya dikosongkan,
    // sehingga riwayat tetap utuh dan panel tahu berkasnya sudah tidak ada.
    //
    // dihapus_retensi ditandai supaya berkas ini tidak tertukar dengan berkas
    // yang HILANG: yang hilang perlu ditarik ulang, yang ini justru tidak
    // boleh ditarik ulang. Pemeriksaan keutuhan arsip membaca penanda ini.
    await botDb.query(
      `UPDATE aleta_bot_ecourt_files SET jalur_berkas = '', dihapus_retensi = ? WHERE id = ?`,
      [botDb.toMysqlDate(new Date()), row.id]
    );

    // Jalur pada catatan DOKUMEN ikut dikosongkan. Tanpa ini, Kendali Berkas
    // tetap melaporkan "berkas ada" untuk berkas yang sudah tidak ada, dan
    // petugas menekan Unduh lalu menerima kegagalan tanpa keterangan.
    const kolom = String(row.format || "").toLowerCase() === "word" ? "berkas_word" : "berkas_pdf";
    await botDb
      .query(
        kolom === "berkas_word"
          ? `UPDATE aleta_bot_ecourt_documents SET berkas_word = NULL WHERE document_key = ?`
          : `UPDATE aleta_bot_ecourt_documents SET berkas_pdf = NULL WHERE document_key = ?`,
        [row.document_key]
      )
      .catch(() => {});

    ringkas.terhapus += 1;
  }

  void logService.logSecurityEvent({
    eventType: "ecourt_arsip_dibersihkan",
    severity: "warning",
    message: `Arsip berkas e-Court dibersihkan: ${ringkas.terhapus} berkas dihapus.`,
    metadata: {
      terhapus: ringkas.terhapus,
      gagal: ringkas.gagal,
      totalMb: ringkas.totalMb,
      olehSiapa: String(olehSiapa || ""),
    },
  });

  return ringkas;
}

/** Keadaan arsip untuk ditampilkan portal. */
async function getStatus() {
  const [ruang, ukuran, calon] = await Promise.all([
    sisaRuang(),
    ukuranArsip().catch(() => ({ jumlahBerkas: 0, totalMb: 0 })),
    bersihkan({ hapus: false }).catch(() => ({ aktif: false, jumlah: 0, totalMb: 0 })),
  ]);

  const pengaturan = getSettings();
  return {
    pengaturan,
    ruang,
    arsip: ukuran,
    kedaluwarsa: { aktif: calon.aktif === true, jumlah: calon.jumlah || 0, totalMb: calon.totalMb || 0 },
    ruangMenipis: ruang.ok ? ruang.bebasGb < pengaturan.minRuangGb : null,
  };
}

module.exports = {
  BAWAAN,
  bersihkan,
  bolehMenarik,
  daftarKedaluwarsa,
  getSettings,
  getStatus,
  saveSettings,
  sisaRuang,
  ukuranArsip,
};
