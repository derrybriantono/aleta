"use strict";

/**
 * Kendali berkas: menyandingkan apa yang SEHARUSNYA ada menurut SIPP dengan apa
 * yang SUDAH ada di arsip e-Court ALETA.
 *
 * ============================================================================
 * SIPP YANG MENENTUKAN, E-COURT YANG DIPERIKSA
 * ============================================================================
 *
 * SIPP adalah register perkara. Dialah yang tahu satu perkara punya berapa
 * sidang, berapa relaas, sudah diputus atau belum, dan sudah terbit akta cerai
 * atau belum. Dari situlah daftar berkas yang seharusnya ada disusun.
 *
 * Arsip e-Court ALETA lalu diperiksa terhadap daftar itu. Yang tercatat di SIPP
 * tetapi belum ada berkasnya di ALETA disebut kurang - itulah yang perlu
 * ditarik. Arahnya tidak pernah dibalik: berkas ALETA yang tidak ada padanannya
 * di SIPP tidak membuat perkara dinyatakan lebih lengkap.
 *
 * ============================================================================
 * SIPP TIDAK TERBACA BUKAN BERARTI LENGKAP
 * ============================================================================
 *
 * Bila SIPP gagal dibaca untuk suatu perkara, barisnya ditandai belum terbaca
 * dan TIDAK diberi kesimpulan lengkap atau kurang. Menyatakan lengkap karena
 * daftar seharusnya kosong akan menghapus perkara itu dari daftar kerja
 * panitera - berkas yang benar-benar hilang jadi tidak pernah ditarik.
 *
 * Ini kebalikan dari sikap fail-open pada pemberitahuan: di sana diam lebih
 * baik daripada salah kirim; di sini justru salah diam yang berbahaya.
 *
 * ============================================================================
 * SATU KUERI UNTUK BANYAK PERKARA
 * ============================================================================
 *
 * Seluruh pembacaan SIPP dikelompokkan: satu kueri untuk seluruh perkara yang
 * sedang disinkronkan, bukan satu kueri per perkara. Kueri berkorelasi per
 * baris pernah membuat layar jadwal menembakkan seribu kueri untuk seratus
 * baris, dan sinkronisasi ini menyentuh jauh lebih banyak perkara.
 *
 * ============================================================================
 * SIPP HANYA DIBACA
 * ============================================================================
 *
 * Seluruh kueri SIPP di berkas ini SELECT, dan nomor perkara maupun tanggal
 * selalu masuk sebagai parameter - tidak pernah disambung ke teks kueri.
 */

const crypto = require("crypto");

const sipp = require("../db_config");
const botDb = require("./botDbService");
const putusanEcourtService = require("./putusanEcourtService");
const logService = require("./logService");
const { cleanText, normalizeCaseNumber } = require("./ecourtTextService");

/** Berapa perkara sekaligus dalam satu kueri SIPP. */
const UKURAN_KELOMPOK = 200;

/** Batas atas satu kali jalan, supaya sinkronisasi tidak berjalan tanpa ujung. */
const MAKS_PERKARA = 5000;

function runSipp(sql, params = []) {
  return new Promise((resolve, reject) => {
    sipp.query(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(Array.isArray(rows) ? rows : []);
    });
  });
}

/** Sidik jari nomor perkara sebagai id baris - lihat catatan di ecourtStoreService. */
function kunciPerkara(nomorPerkara) {
  return crypto
    .createHash("sha256")
    .update(normalizeCaseNumber(nomorPerkara).toLowerCase())
    .digest("hex")
    .slice(0, 40);
}

function isoTanggal(nilai) {
  if (!nilai) return "";
  const tanggal = nilai instanceof Date ? nilai : new Date(nilai);
  if (Number.isNaN(tanggal.getTime())) return "";
  const bulan = String(tanggal.getMonth() + 1).padStart(2, "0");
  const hari = String(tanggal.getDate()).padStart(2, "0");
  return `${tanggal.getFullYear()}-${bulan}-${hari}`;
}

function tanggalMysql(nilai) {
  const teks = cleanText(nilai);
  return /^\d{4}-\d{2}-\d{2}$/.test(teks) ? teks : "";
}

function potong(daftar, ukuran) {
  const hasil = [];
  for (let i = 0; i < daftar.length; i += ukuran) hasil.push(daftar.slice(i, i + ukuran));
  return hasil;
}

let skemaSiap = false;

async function ensureSchema() {
  if (skemaSiap) return;

  await botDb.query(`
    CREATE TABLE IF NOT EXISTS aleta_bot_kendali_berkas (
      id VARCHAR(64) PRIMARY KEY,
      nomor_perkara VARCHAR(191) NOT NULL,
      perkara_id BIGINT NULL,
      jenis_perkara VARCHAR(191) NOT NULL DEFAULT '',
      tanggal_daftar DATE NULL,
      sudah_putus TINYINT(1) NOT NULL DEFAULT 0,
      lewat_ecourt TINYINT(1) NOT NULL DEFAULT 0,
      sipp_dokumen INT NOT NULL DEFAULT 0,
      sipp_sidang INT NOT NULL DEFAULT 0,
      sipp_bas_ada INT NOT NULL DEFAULT 0,
      sipp_relaas INT NOT NULL DEFAULT 0,
      sipp_relaas_berdokumen INT NOT NULL DEFAULT 0,
      sipp_putusan TINYINT(1) NOT NULL DEFAULT 0,
      sipp_putusan_anonim TINYINT(1) NOT NULL DEFAULT 0,
      sipp_akta_cerai TINYINT(1) NOT NULL DEFAULT 0,
      ecourt_dokumen INT NOT NULL DEFAULT 0,
      ecourt_berkas INT NOT NULL DEFAULT 0,
      ecourt_belum_terunduh INT NOT NULL DEFAULT 0,
      jumlah_kurang INT NOT NULL DEFAULT 0,
      keadaan VARCHAR(32) NOT NULL DEFAULT 'belum_diperiksa',
      rincian_kurang TEXT,
      sipp_terbaca TINYINT(1) NOT NULL DEFAULT 1,
      alasan_tidak_terbaca VARCHAR(255) NOT NULL DEFAULT '',
      disinkron_pada DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      UNIQUE KEY uq_abkb_perkara (nomor_perkara),
      INDEX idx_abkb_keadaan (keadaan, jumlah_kurang),
      INDEX idx_abkb_sinkron (disinkron_pada)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Riwayat jalannya sinkronisasi. Dipakai layar portal untuk memantau
  // penarikan yang berjalan di latar - termasuk yang dimulai dari PuTTY lalu
  // ditinggalkan.
  await botDb.query(`
    CREATE TABLE IF NOT EXISTS aleta_bot_kendali_runs (
      id VARCHAR(64) PRIMARY KEY,
      dimulai_pada DATETIME NOT NULL,
      selesai_pada DATETIME NULL,
      detak_pada DATETIME NOT NULL,
      dijalankan_oleh VARCHAR(191) NOT NULL DEFAULT '',
      sumber VARCHAR(32) NOT NULL DEFAULT 'portal',
      target INT NOT NULL DEFAULT 0,
      diperiksa INT NOT NULL DEFAULT 0,
      berubah INT NOT NULL DEFAULT 0,
      kurang INT NOT NULL DEFAULT 0,
      gagal INT NOT NULL DEFAULT 0,
      keadaan VARCHAR(32) NOT NULL DEFAULT 'berjalan',
      pesan TEXT,
      INDEX idx_abkr_keadaan (keadaan, detak_pada),
      INDEX idx_abkr_mulai (dimulai_pada)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  skemaSiap = true;
}

/**
 * Daftar perkara yang perlu diperiksa, dibaca dari SIPP.
 *
 * @param {{ sejak?: string, sampai?: string, maks?: number, hanyaEcourt?: boolean }} pilihan
 */
async function daftarPerkaraSipp({ sejak = "", sampai = "", maks = 0, hanyaEcourt = false } = {}) {
  const syarat = [];
  const nilai = [];

  const dari = tanggalMysql(sejak);
  const ke = tanggalMysql(sampai);
  if (dari) {
    syarat.push("p.tanggal_pendaftaran >= ?");
    nilai.push(dari);
  }
  if (ke) {
    syarat.push("p.tanggal_pendaftaran <= ?");
    nilai.push(ke);
  }

  // Batasnya disisipkan sebagai angka yang sudah dipastikan bulat, bukan
  // parameter: sebagian pemasangan MySQL menolak placeholder pada LIMIT.
  const batas = Math.min(Math.max(Math.floor(Number(maks) || 0) || MAKS_PERKARA, 1), MAKS_PERKARA);

  const rows = await runSipp(
    `SELECT p.perkara_id          AS perkaraId,
            p.nomor_perkara       AS nomorPerkara,
            p.jenis_perkara_nama  AS jenisPerkara,
            p.tanggal_pendaftaran AS tanggalDaftar
       FROM perkara p
      ${syarat.length > 0 ? `WHERE ${syarat.join(" AND ")}` : ""}
      ORDER BY p.tanggal_pendaftaran DESC, p.perkara_id DESC
      LIMIT ${batas}`,
    nilai
  );

  const daftar = rows
    .map((row) => ({
      perkaraId: Number(row.perkaraId) || null,
      nomorPerkara: normalizeCaseNumber(row.nomorPerkara),
      jenisPerkara: cleanText(row.jenisPerkara),
      tanggalDaftar: isoTanggal(row.tanggalDaftar),
    }))
    .filter((x) => x.nomorPerkara && x.perkaraId);

  if (!hanyaEcourt) return daftar;

  const lewat = await perkaraLewatEcourt(daftar.map((x) => x.perkaraId));
  return daftar.filter((x) => lewat.has(String(x.perkaraId)));
}

/** Perkara mana saja yang terdaftar lewat e-Court. */
async function perkaraLewatEcourt(idPerkara = []) {
  const hasil = new Set();
  const bersih = [...new Set(idPerkara.map(Number).filter(Boolean))];
  if (bersih.length === 0) return hasil;

  for (const kelompok of potong(bersih, UKURAN_KELOMPOK)) {
    const isian = kelompok.map(() => "?").join(", ");
    const rows = await runSipp(
      `SELECT DISTINCT e.perkara_id AS perkaraId
         FROM perkara_efiling e
        WHERE e.perkara_id IN (${isian})`,
      kelompok
    );
    for (const row of rows) hasil.add(String(row.perkaraId));
  }
  return hasil;
}

/**
 * Inventaris SIPP untuk sekumpulan perkara.
 *
 * Lima kueri berkelompok, bukan lima kueri per perkara.
 */
async function inventarisSipp(idPerkara = []) {
  const peta = {};
  const bersih = [...new Set(idPerkara.map(Number).filter(Boolean))];
  if (bersih.length === 0) return peta;

  for (const id of bersih) {
    peta[String(id)] = {
      dokumen: 0,
      sidang: 0,
      basAda: 0,
      relaas: 0,
      relaasBerdokumen: 0,
      putusan: false,
      putusanAnonim: false,
      aktaCerai: false,
      sudahPutus: false,
    };
  }

  for (const kelompok of potong(bersih, UKURAN_KELOMPOK)) {
    const isian = kelompok.map(() => "?").join(", ");

    const [dokumen, sidang, relaas, putusan, akta] = await Promise.all([
      runSipp(
        `SELECT d.perkara_id AS perkaraId, COUNT(*) AS jumlah
           FROM perkara_dokumen d
          WHERE d.perkara_id IN (${isian})
          GROUP BY d.perkara_id`,
        kelompok
      ),
      runSipp(
        `SELECT j.perkara_id AS perkaraId,
                COUNT(*) AS jumlah,
                SUM(CASE WHEN j.edoc_bas IS NOT NULL AND j.edoc_bas <> '' THEN 1 ELSE 0 END) AS basAda
           FROM perkara_jadwal_sidang j
          WHERE j.perkara_id IN (${isian})
          GROUP BY j.perkara_id`,
        kelompok
      ),
      runSipp(
        `SELECT r.perkara_id AS perkaraId,
                COUNT(*) AS jumlah,
                SUM(CASE WHEN r.doc_relaas IS NOT NULL AND r.doc_relaas <> '' THEN 1 ELSE 0 END) AS berdokumen
           FROM perkara_pelaksanaan_relaas r
          WHERE r.perkara_id IN (${isian})
          GROUP BY r.perkara_id`,
        kelompok
      ),
      runSipp(
        `SELECT pu.perkara_id AS perkaraId,
                MAX(CASE WHEN pu.tanggal_putusan IS NOT NULL THEN 1 ELSE 0 END) AS sudahPutus,
                MAX(CASE WHEN pu.amar_putusan_dok IS NOT NULL AND pu.amar_putusan_dok <> '' THEN 1 ELSE 0 END) AS adaPutusan,
                MAX(CASE WHEN pu.amar_putusan_anonimisasi_dok IS NOT NULL AND pu.amar_putusan_anonimisasi_dok <> '' THEN 1 ELSE 0 END) AS adaAnonim
           FROM perkara_putusan pu
          WHERE pu.perkara_id IN (${isian})
          GROUP BY pu.perkara_id`,
        kelompok
      ),
      runSipp(
        `SELECT ak.perkara_id AS perkaraId,
                MAX(CASE WHEN ak.akta_cerai_dok IS NOT NULL AND ak.akta_cerai_dok <> '' THEN 1 ELSE 0 END) AS adaAkta
           FROM perkara_akta_cerai ak
          WHERE ak.perkara_id IN (${isian})
          GROUP BY ak.perkara_id`,
        kelompok
      ),
    ]);

    for (const row of dokumen) {
      const kunci = String(row.perkaraId);
      if (peta[kunci]) peta[kunci].dokumen = Number(row.jumlah) || 0;
    }
    for (const row of sidang) {
      const kunci = String(row.perkaraId);
      if (!peta[kunci]) continue;
      peta[kunci].sidang = Number(row.jumlah) || 0;
      peta[kunci].basAda = Number(row.basAda) || 0;
    }
    for (const row of relaas) {
      const kunci = String(row.perkaraId);
      if (!peta[kunci]) continue;
      peta[kunci].relaas = Number(row.jumlah) || 0;
      peta[kunci].relaasBerdokumen = Number(row.berdokumen) || 0;
    }
    for (const row of putusan) {
      const kunci = String(row.perkaraId);
      if (!peta[kunci]) continue;
      peta[kunci].sudahPutus = Number(row.sudahPutus) === 1;
      peta[kunci].putusan = Number(row.adaPutusan) === 1;
      peta[kunci].putusanAnonim = Number(row.adaAnonim) === 1;
    }
    for (const row of akta) {
      const kunci = String(row.perkaraId);
      if (peta[kunci]) peta[kunci].aktaCerai = Number(row.adaAkta) === 1;
    }
  }

  return peta;
}

/** Inventaris arsip e-Court ALETA untuk sekumpulan nomor perkara. */
async function inventarisAleta(nomorPerkara = []) {
  await ensureSchema();

  const peta = {};
  const bersih = [...new Set(nomorPerkara.map(normalizeCaseNumber).filter(Boolean))];
  if (bersih.length === 0) return peta;

  for (const nomor of bersih) {
    peta[nomor] = { dokumen: 0, berkas: 0, belumTerunduh: 0 };
  }

  for (const kelompok of potong(bersih, UKURAN_KELOMPOK)) {
    const isian = kelompok.map(() => "?").join(", ");

    // Dua kueri berkelompok, digabung di Node - bukan subkueri berkorelasi
    // yang dijalankan sekali per baris.
    const [dokumen, berkas] = await Promise.all([
      botDb.query(
        `SELECT d.nomor_perkara AS nomorPerkara,
                COUNT(*) AS jumlah,
                SUM(CASE WHEN (d.berkas_pdf IS NULL OR d.berkas_pdf = '')
                          AND (d.berkas_word IS NULL OR d.berkas_word = '')
                         THEN 1 ELSE 0 END) AS belumTerunduh
           FROM aleta_bot_ecourt_documents d
          WHERE d.nomor_perkara IN (${isian})
          GROUP BY d.nomor_perkara`,
        kelompok
      ),
      botDb.query(
        `SELECT d.nomor_perkara AS nomorPerkara, COUNT(*) AS jumlah
           FROM aleta_bot_ecourt_files f
           JOIN aleta_bot_ecourt_documents d ON d.document_key = f.document_key
          WHERE d.nomor_perkara IN (${isian})
            AND f.dihapus_retensi IS NULL
            AND f.jalur_berkas <> ''
          GROUP BY d.nomor_perkara`,
        kelompok
      ),
    ]);

    for (const row of Array.isArray(dokumen) ? dokumen : []) {
      const kunci = normalizeCaseNumber(row.nomorPerkara);
      if (!peta[kunci]) continue;
      peta[kunci].dokumen = Number(row.jumlah) || 0;
      peta[kunci].belumTerunduh = Number(row.belumTerunduh) || 0;
    }
    for (const row of Array.isArray(berkas) ? berkas : []) {
      const kunci = normalizeCaseNumber(row.nomorPerkara);
      if (peta[kunci]) peta[kunci].berkas = Number(row.jumlah) || 0;
    }
  }

  return peta;
}

/**
 * Menyusun satu baris kendali dari inventaris SIPP dan inventaris ALETA.
 *
 * Yang disebut KURANG adalah berkas yang SIPP catat ada tetapi belum tersimpan
 * di arsip ALETA. Berkas yang SIPP sendiri belum punya bukan kekurangan arsip -
 * itu pekerjaan yang memang belum dikerjakan di SIPP, dan sudah dinilai
 * tersendiri oleh penilaian SIPP.
 */
function susunKendali(perkara, dariSipp, dariAleta) {
  if (!dariSipp) {
    return {
      ...perkara,
      sippTerbaca: false,
      alasanTidakTerbaca: "Inventaris SIPP tidak terbaca untuk perkara ini.",
      keadaan: "belum_diperiksa",
      jumlahKurang: 0,
      rincianKurang: [],
      sipp: null,
      aleta: dariAleta || { dokumen: 0, berkas: 0, belumTerunduh: 0 },
    };
  }

  const aleta = dariAleta || { dokumen: 0, berkas: 0, belumTerunduh: 0 };
  const kurang = [];

  // Dokumen e-Court yang tercatat di ALETA tetapi berkasnya belum ditarik.
  if (aleta.belumTerunduh > 0) {
    kurang.push({
      jenis: "berkas_ecourt",
      jumlah: aleta.belumTerunduh,
      keterangan: `${aleta.belumTerunduh} dokumen e-Court belum ada berkasnya di arsip.`,
    });
  }

  // Perkara yang punya dokumen di SIPP tetapi arsip e-Court-nya kosong sama
  // sekali - biasanya perkara yang belum pernah ditarik.
  if (dariSipp.dokumen > 0 && aleta.dokumen === 0) {
    kurang.push({
      jenis: "belum_pernah_ditarik",
      jumlah: dariSipp.dokumen,
      keterangan: `SIPP mencatat ${dariSipp.dokumen} dokumen, arsip e-Court masih kosong.`,
    });
  }

  // Sidang yang sudah berlalu tanpa BAS. Ini kekurangan di SIPP, tetapi tetap
  // dicantumkan karena panitera yang membaca layar ini yang menindaklanjutinya.
  const basKurang = dariSipp.sidang - dariSipp.basAda;
  if (dariSipp.sidang > 0 && basKurang > 0) {
    kurang.push({
      jenis: "bas_belum_ada",
      jumlah: basKurang,
      keterangan: `${basKurang} dari ${dariSipp.sidang} sidang belum ada BAS-nya di SIPP.`,
    });
  }

  const relaasKurang = dariSipp.relaas - dariSipp.relaasBerdokumen;
  if (dariSipp.relaas > 0 && relaasKurang > 0) {
    kurang.push({
      jenis: "relaas_tanpa_dokumen",
      jumlah: relaasKurang,
      keterangan: `${relaasKurang} dari ${dariSipp.relaas} relaas belum ada dokumennya di SIPP.`,
    });
  }

  if (dariSipp.sudahPutus && !dariSipp.putusan) {
    kurang.push({ jenis: "putusan_belum_ada", jumlah: 1, keterangan: "Naskah putusan belum diunggah ke SIPP." });
  }
  if (dariSipp.sudahPutus && !dariSipp.putusanAnonim) {
    kurang.push({ jenis: "anonim_belum_ada", jumlah: 1, keterangan: "Naskah putusan anonim belum diunggah ke SIPP." });
  }

  const jumlahKurang = kurang.reduce((a, x) => a + x.jumlah, 0);

  return {
    ...perkara,
    sippTerbaca: true,
    alasanTidakTerbaca: "",
    keadaan: jumlahKurang === 0 ? "lengkap" : "kurang",
    jumlahKurang,
    rincianKurang: kurang,
    sipp: dariSipp,
    aleta,
  };
}

/** Menyimpan satu baris kendali. Baris yang sudah ada diperbarui, bukan digandakan. */
async function simpanKendali(baris) {
  await ensureSchema();

  const sekarang = new Date();
  const sipp = baris.sipp || {};

  await botDb.query(
    `INSERT INTO aleta_bot_kendali_berkas
       (id, nomor_perkara, perkara_id, jenis_perkara, tanggal_daftar, sudah_putus,
        lewat_ecourt, sipp_dokumen, sipp_sidang, sipp_bas_ada, sipp_relaas,
        sipp_relaas_berdokumen, sipp_putusan, sipp_putusan_anonim, sipp_akta_cerai,
        ecourt_dokumen, ecourt_berkas, ecourt_belum_terunduh, jumlah_kurang,
        keadaan, rincian_kurang, sipp_terbaca, alasan_tidak_terbaca,
        disinkron_pada, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       perkara_id = VALUES(perkara_id),
       jenis_perkara = VALUES(jenis_perkara),
       tanggal_daftar = VALUES(tanggal_daftar),
       sudah_putus = VALUES(sudah_putus),
       lewat_ecourt = VALUES(lewat_ecourt),
       sipp_dokumen = VALUES(sipp_dokumen),
       sipp_sidang = VALUES(sipp_sidang),
       sipp_bas_ada = VALUES(sipp_bas_ada),
       sipp_relaas = VALUES(sipp_relaas),
       sipp_relaas_berdokumen = VALUES(sipp_relaas_berdokumen),
       sipp_putusan = VALUES(sipp_putusan),
       sipp_putusan_anonim = VALUES(sipp_putusan_anonim),
       sipp_akta_cerai = VALUES(sipp_akta_cerai),
       ecourt_dokumen = VALUES(ecourt_dokumen),
       ecourt_berkas = VALUES(ecourt_berkas),
       ecourt_belum_terunduh = VALUES(ecourt_belum_terunduh),
       jumlah_kurang = VALUES(jumlah_kurang),
       keadaan = VALUES(keadaan),
       rincian_kurang = VALUES(rincian_kurang),
       sipp_terbaca = VALUES(sipp_terbaca),
       alasan_tidak_terbaca = VALUES(alasan_tidak_terbaca),
       disinkron_pada = VALUES(disinkron_pada),
       updated_at = VALUES(updated_at)`,
    [
      kunciPerkara(baris.nomorPerkara),
      baris.nomorPerkara,
      baris.perkaraId || null,
      baris.jenisPerkara || "",
      baris.tanggalDaftar || null,
      sipp.sudahPutus ? 1 : 0,
      baris.lewatEcourt ? 1 : 0,
      sipp.dokumen || 0,
      sipp.sidang || 0,
      sipp.basAda || 0,
      sipp.relaas || 0,
      sipp.relaasBerdokumen || 0,
      sipp.putusan ? 1 : 0,
      sipp.putusanAnonim ? 1 : 0,
      sipp.aktaCerai ? 1 : 0,
      baris.aleta.dokumen || 0,
      baris.aleta.berkas || 0,
      baris.aleta.belumTerunduh || 0,
      baris.jumlahKurang || 0,
      baris.keadaan,
      JSON.stringify(baris.rincianKurang || []),
      baris.sippTerbaca ? 1 : 0,
      baris.alasanTidakTerbaca || "",
      sekarang,
      sekarang,
    ]
  );
}

/**
 * Menolak dua sinkronisasi sekaligus.
 *
 * Yang diperiksa waktu DETAKNYA, bukan sekadar adanya baris berjalan: jalan
 * yang mati mendadak - container disetop, server dimatikan - meninggalkan baris
 * "berjalan" yang tidak akan pernah selesai sendiri, dan itu tidak boleh
 * memblokir sinkronisasi selamanya.
 */
const BATAS_DETAK_MENIT = 10;

async function jalanYangMasihHidup() {
  await ensureSchema();
  const rows = await botDb.query(
    `SELECT id, dimulai_pada AS dimulaiPada, detak_pada AS detakPada, diperiksa, target, sumber
       FROM aleta_bot_kendali_runs
      WHERE keadaan = 'berjalan'
        AND detak_pada >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
      ORDER BY dimulai_pada DESC
      LIMIT 1`,
    [BATAS_DETAK_MENIT]
  );
  return (Array.isArray(rows) ? rows : [])[0] || null;
}

/** Menandai jalan lama yang detaknya sudah berhenti sebagai terputus. */
async function tutupJalanMangkrak() {
  await ensureSchema();
  await botDb.query(
    `UPDATE aleta_bot_kendali_runs
        SET keadaan = 'terputus',
            selesai_pada = NOW(),
            pesan = CONCAT(COALESCE(pesan, ''), ' Detak berhenti lebih dari ${BATAS_DETAK_MENIT} menit.')
      WHERE keadaan = 'berjalan'
        AND detak_pada < DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
    [BATAS_DETAK_MENIT]
  );
}

/**
 * Menjalankan sinkronisasi kendali berkas.
 *
 * Detaknya diperbarui tiap kelompok, sehingga jalan yang macet terlihat dari
 * portal tanpa perlu membuka SSH.
 *
 * @param {{
 *   sejak?: string, sampai?: string, maks?: number, hanyaEcourt?: boolean,
 *   sumber?: string, dijalankanOleh?: string,
 *   onKemajuan?: (kemajuan: object) => void,
 *   batal?: () => boolean,
 * }} pilihan
 */
async function sinkron(pilihan = {}) {
  const {
    sejak = "",
    sampai = "",
    maks = 0,
    hanyaEcourt = false,
    sumber = "portal",
    dijalankanOleh = "",
    onKemajuan = null,
    batal = null,
  } = pilihan;

  await ensureSchema();
  await tutupJalanMangkrak();

  const berjalan = await jalanYangMasihHidup();
  if (berjalan) {
    return {
      ok: false,
      alasan: "sinkron_lain_berjalan",
      pesan: `Sinkronisasi lain sedang berjalan sejak ${berjalan.dimulaiPada} (${berjalan.diperiksa}/${berjalan.target}).`,
    };
  }

  const idJalan = crypto.randomBytes(16).toString("hex");
  const mulai = new Date();
  await botDb.query(
    `INSERT INTO aleta_bot_kendali_runs
       (id, dimulai_pada, detak_pada, dijalankan_oleh, sumber, target, keadaan)
     VALUES (?, ?, ?, ?, ?, 0, 'berjalan')`,
    [idJalan, mulai, mulai, String(dijalankanOleh || ""), String(sumber || "portal")]
  );

  const detak = async (angka = {}) => {
    await botDb.query(
      `UPDATE aleta_bot_kendali_runs
          SET detak_pada = NOW(), target = ?, diperiksa = ?, berubah = ?, kurang = ?, gagal = ?
        WHERE id = ?`,
      [
        angka.target || 0,
        angka.diperiksa || 0,
        angka.berubah || 0,
        angka.kurang || 0,
        angka.gagal || 0,
        idJalan,
      ]
    );
  };

  const tutup = async (keadaan, pesan, angka) => {
    await botDb.query(
      `UPDATE aleta_bot_kendali_runs
          SET keadaan = ?, selesai_pada = NOW(), detak_pada = NOW(),
              target = ?, diperiksa = ?, berubah = ?, kurang = ?, gagal = ?, pesan = ?
        WHERE id = ?`,
      [
        keadaan,
        angka.target || 0,
        angka.diperiksa || 0,
        angka.berubah || 0,
        angka.kurang || 0,
        angka.gagal || 0,
        String(pesan || ""),
        idJalan,
      ]
    );
  };

  const angka = { target: 0, diperiksa: 0, berubah: 0, kurang: 0, gagal: 0 };

  let daftar;
  try {
    daftar = await daftarPerkaraSipp({ sejak, sampai, maks, hanyaEcourt });
  } catch (error) {
    const pesan = `SIPP tidak dapat dibaca: ${error && error.message ? error.message : error}`;
    await tutup("gagal", pesan, angka);
    void logService.logSecurityEvent({
      eventType: "kendali_berkas_sinkron_gagal",
      severity: "warning",
      message: pesan,
      metadata: { idJalan, sumber },
    });
    return { ok: false, alasan: "sipp_tidak_terbaca", pesan, idJalan };
  }

  angka.target = daftar.length;
  await detak(angka);

  if (onKemajuan) {
    onKemajuan({ tahap: "mulai", ...angka, pesan: `${daftar.length} perkara akan diperiksa.` });
  }

  const lewatEcourt = await perkaraLewatEcourt(daftar.map((x) => x.perkaraId)).catch(() => new Set());

  for (const kelompok of potong(daftar, UKURAN_KELOMPOK)) {
    if (batal && batal()) {
      await tutup("dibatalkan", "Dihentikan atas permintaan.", angka);
      return { ok: false, alasan: "dibatalkan", pesan: "Sinkronisasi dihentikan.", idJalan, ...angka };
    }

    // SIPP dibaca per kelompok. Bila kelompok ini gagal dibaca, barisnya
    // ditandai belum terbaca - TIDAK dinyatakan lengkap.
    let dariSipp = null;
    let alasanGagal = "";
    try {
      dariSipp = await inventarisSipp(kelompok.map((x) => x.perkaraId));
    } catch (error) {
      alasanGagal = `sipp_tidak_terbaca: ${error && error.message ? error.message : error}`;
    }

    let dariAleta = {};
    try {
      dariAleta = await inventarisAleta(kelompok.map((x) => x.nomorPerkara));
    } catch {
      dariAleta = {};
    }

    for (const perkara of kelompok) {
      const baris = susunKendali(
        { ...perkara, lewatEcourt: lewatEcourt.has(String(perkara.perkaraId)) },
        dariSipp ? dariSipp[String(perkara.perkaraId)] : null,
        dariAleta[perkara.nomorPerkara]
      );
      if (alasanGagal) baris.alasanTidakTerbaca = alasanGagal;

      try {
        await simpanKendali(baris);
        angka.diperiksa += 1;
        angka.berubah += 1;
        if (baris.keadaan === "kurang") angka.kurang += 1;
        if (!baris.sippTerbaca) angka.gagal += 1;
      } catch (error) {
        angka.gagal += 1;
        if (onKemajuan) {
          onKemajuan({
            tahap: "galat",
            ...angka,
            pesan: `${perkara.nomorPerkara}: ${error && error.message ? error.message : error}`,
          });
        }
      }
    }

    await detak(angka);
    if (onKemajuan) {
      onKemajuan({
        tahap: "berjalan",
        ...angka,
        pesan: `${angka.diperiksa}/${angka.target} perkara diperiksa, ${angka.kurang} kurang.`,
      });
    }
  }

  await tutup("selesai", `${angka.diperiksa} perkara diperiksa, ${angka.kurang} kurang berkas.`, angka);

  void logService.logSecurityEvent({
    eventType: "kendali_berkas_sinkron_selesai",
    severity: "info",
    message: `Kendali berkas disinkronkan: ${angka.diperiksa} perkara, ${angka.kurang} kurang.`,
    metadata: { idJalan, sumber, dijalankanOleh: String(dijalankanOleh || ""), ...angka },
  });

  return { ok: true, alasan: "", idJalan, ...angka };
}

/** Ringkasan kendali berkas untuk kartu di layar. */
async function ringkasan() {
  await ensureSchema();
  await tutupJalanMangkrak();

  const [hitung, jalan] = await Promise.all([
    botDb.query(
      `SELECT keadaan, COUNT(*) AS jumlah, SUM(jumlah_kurang) AS totalKurang
         FROM aleta_bot_kendali_berkas
        GROUP BY keadaan`
    ),
    botDb.query(
      `SELECT id, dimulai_pada AS dimulaiPada, selesai_pada AS selesaiPada,
              detak_pada AS detakPada, keadaan, sumber, target, diperiksa,
              berubah, kurang, gagal, pesan
         FROM aleta_bot_kendali_runs
        ORDER BY dimulai_pada DESC
        LIMIT 5`
    ),
  ]);

  const per = { lengkap: 0, kurang: 0, belum_diperiksa: 0 };
  let totalKurang = 0;
  for (const row of Array.isArray(hitung) ? hitung : []) {
    const kunci = cleanText(row.keadaan);
    per[kunci] = Number(row.jumlah) || 0;
    totalKurang += Number(row.totalKurang) || 0;
  }

  const riwayat = (Array.isArray(jalan) ? jalan : []).map((row) => ({
    id: cleanText(row.id),
    dimulaiPada: row.dimulaiPada ? new Date(row.dimulaiPada).toISOString() : "",
    selesaiPada: row.selesaiPada ? new Date(row.selesaiPada).toISOString() : "",
    detakPada: row.detakPada ? new Date(row.detakPada).toISOString() : "",
    keadaan: cleanText(row.keadaan),
    sumber: cleanText(row.sumber),
    target: Number(row.target) || 0,
    diperiksa: Number(row.diperiksa) || 0,
    kurang: Number(row.kurang) || 0,
    gagal: Number(row.gagal) || 0,
    pesan: cleanText(row.pesan),
  }));

  return {
    perkara: per,
    totalPerkara: per.lengkap + per.kurang + per.belum_diperiksa,
    totalKurang,
    sedangBerjalan: riwayat.find((x) => x.keadaan === "berjalan") || null,
    riwayat,
  };
}

/** Daftar perkara yang kurang berkas, paling banyak kurangnya di atas. */
async function daftarKurang({ batas = 100 } = {}) {
  await ensureSchema();

  const maksBaris = Math.min(Math.max(Math.floor(Number(batas) || 100), 1), 1000);
  const rows = await botDb.query(
    `SELECT nomor_perkara AS nomorPerkara, jenis_perkara AS jenisPerkara,
            tanggal_daftar AS tanggalDaftar, keadaan, jumlah_kurang AS jumlahKurang,
            rincian_kurang AS rincianKurang, ecourt_belum_terunduh AS belumTerunduh,
            sipp_terbaca AS sippTerbaca, alasan_tidak_terbaca AS alasanTidakTerbaca,
            disinkron_pada AS disinkronPada
       FROM aleta_bot_kendali_berkas
      WHERE keadaan <> 'lengkap'
      ORDER BY jumlah_kurang DESC, tanggal_daftar DESC
      LIMIT ${maksBaris}`
  );

  return (Array.isArray(rows) ? rows : []).map((row) => {
    let rincian = [];
    try {
      rincian = JSON.parse(row.rincianKurang || "[]");
    } catch {
      rincian = [];
    }
    return {
      nomorPerkara: cleanText(row.nomorPerkara),
      jenisPerkara: cleanText(row.jenisPerkara),
      tanggalDaftar: isoTanggal(row.tanggalDaftar),
      keadaan: cleanText(row.keadaan),
      jumlahKurang: Number(row.jumlahKurang) || 0,
      belumTerunduh: Number(row.belumTerunduh) || 0,
      sippTerbaca: Number(row.sippTerbaca) === 1,
      alasanTidakTerbaca: cleanText(row.alasanTidakTerbaca),
      disinkronPada: row.disinkronPada ? new Date(row.disinkronPada).toISOString() : "",
      rincianKurang: Array.isArray(rincian) ? rincian : [],
    };
  });
}

module.exports = {
  BATAS_DETAK_MENIT,
  MAKS_PERKARA,
  UKURAN_KELOMPOK,
  daftarKurang,
  daftarPerkaraSipp,
  ensureSchema,
  inventarisAleta,
  inventarisSipp,
  jalanYangMasihHidup,
  kunciPerkara,
  perkaraLewatEcourt,
  ringkasan,
  simpanKendali,
  sinkron,
  susunKendali,
  tutupJalanMangkrak,
};
