"use strict";

/**
 * Penyimpan dokumen e-Court — Tahap 2 dari Jembatan e-Court.
 *
 * --- Kenapa ALETA perlu menyimpannya sendiri ---
 *
 * SIPP tidak tahu apa-apa tentang dokumen milik PIHAK. Yang dicatat SIPP hanya
 * dokumen milik pengadilan: petitum, putusan, akta cerai, BAS. Jawaban,
 * Replik, dan Duplik yang diunggah para pihak lewat e-Court sama sekali tidak
 * punya jejak di sana - SIPP cuma tahu AGENDA sidangnya sebagai teks bebas.
 *
 * Karena itu ALETA harus punya catatannya sendiri. Dari catatan inilah ALETA
 * tahu mana dokumen yang BARU dan belum pernah diberitahukan - sesuatu yang
 * mustahil disimpulkan dari SIPP.
 *
 * --- Semua tulisan masuk ke database ALETA, bukan SIPP ---
 *
 * bot_db_config.js secara aktif melempar galat saat startup bila database
 * internal ALETA sampai bertabrakan nama dengan SIPP. Tabel di sini mengikuti
 * pola aleta_bot_* dan hidup di database ALETA sendiri. SIPP tetap murni
 * sumber baca.
 */

const crypto = require("crypto");

const botDb = require("./botDbService");
const { cleanText, normalizeCaseNumber } = require("./ecourtTextService");

let schemaReady = false;
let schemaPromise = null;

/**
 * Status verifikasi dokumen di e-Court.
 *
 * "belum" adalah keadaan awal: dokumen sudah diunggah pihak tetapi majelis
 * belum memutuskan. Notifikasi TIDAK BOLEH terpicu pada keadaan ini - lihat
 * catatan di ecourtEventClassifierService.js.
 */
/**
 * Keadaan verifikasi dokumen e-Court.
 *
 * "tidak_perlu" BUKAN varian dari "belum". Berkas pendaftaran - dokumen
 * bukti, gugatan, surat kuasa - sama sekali tidak mengenal verifikasi di
 * e-Court: tidak ada tombolnya, dan tidak ada majelis yang menunggunya.
 *
 * Menyamakannya dengan "belum" menimbulkan dua kekeliruan sekaligus:
 * angka "menunggu majelis" membesar oleh dokumen yang tidak pernah
 * menunggu apa pun, dan tombol verifikasi hakim muncul untuk dokumen yang
 * tidak dapat diverifikasi - lalu ALETA mencatat keputusan hukum atas
 * berkas yang e-Court sendiri tidak anggap perlu diverifikasi.
 */
const VERIFICATION_STATUSES = new Set(["belum", "valid", "tidak_valid", "tidak_perlu"]);

async function ensureSchema() {
  if (schemaReady) return true;
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    const siap = await botDb.ensureSchema();
    if (!siap) return false;

    await botDb.query(`
      CREATE TABLE IF NOT EXISTS aleta_bot_ecourt_documents (
        id VARCHAR(64) PRIMARY KEY,
        document_key VARCHAR(191) NOT NULL,
        nomor_perkara VARCHAR(191) NOT NULL DEFAULT '',
        registrasi_ecourt VARCHAR(191) NOT NULL DEFAULT '',
        judul_dokumen VARCHAR(255) NOT NULL DEFAULT '',
        jenis_dokumen VARCHAR(64) NOT NULL DEFAULT '',
        peran_pengunggah VARCHAR(64) NOT NULL DEFAULT '',
        email_pengunggah VARCHAR(191) NOT NULL DEFAULT '',
        diunggah_pada DATETIME NULL,
        status_verifikasi VARCHAR(32) NOT NULL DEFAULT 'belum',
        agenda VARCHAR(255) NOT NULL DEFAULT '',
        tanggal_sidang DATETIME NULL,
        batas_unggah DATETIME NULL,
        batas_unggah_teks VARCHAR(191) NOT NULL DEFAULT '',
        pengingat_terakhir DATETIME NULL,
        berkas_pdf TEXT,
        berkas_word TEXT,
        sumber_url TEXT,
        diberitahukan_pada DATETIME NULL,
        alasan_tidak_diberitahukan VARCHAR(191) NOT NULL DEFAULT '',
        pertama_terlihat DATETIME NOT NULL,
        terakhir_terlihat DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        UNIQUE KEY uq_abed_key (document_key),
        INDEX idx_abed_perkara (nomor_perkara),
        INDEX idx_abed_notifikasi (status_verifikasi, diberitahukan_pada),
        INDEX idx_abed_batas (batas_unggah, pengingat_terakhir)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ------------------------------------------------------------------
    // BERKAS PER DOKUMEN
    //
    // Satu dokumen e-Court punya lebih dari satu berkas - PDF dan Word - dan
    // isinya dapat BERGANTI ketika pihak mengunggah ulang perbaikan dengan
    // judul sama.
    //
    // Kunci uniknya pasangan document_key + sidik_jari, bukan document_key
    // saja. Inilah yang membuat dokumen pengganti terdeteksi: isinya berbeda,
    // sidik jarinya berbeda, barisnya baru - sementara versi lama tetap
    // tersimpan dan tidak tertimpa.
    // ------------------------------------------------------------------
    await botDb.query(`
      CREATE TABLE IF NOT EXISTS aleta_bot_ecourt_files (
        id VARCHAR(64) PRIMARY KEY,
        document_key VARCHAR(191) NOT NULL,
        nomor_perkara VARCHAR(191) NOT NULL DEFAULT '',
        format VARCHAR(16) NOT NULL DEFAULT '',
        jalur_berkas TEXT,
        sidik_jari CHAR(64) NOT NULL,
        ukuran_byte BIGINT NOT NULL DEFAULT 0,
        tipe_isi VARCHAR(191) NOT NULL DEFAULT '',
        sumber_url TEXT,
        diunduh_pada DATETIME NOT NULL,
        terakhir_diperiksa DATETIME NOT NULL,
        -- Terisi bila berkasnya dihapus karena melewati masa simpan.
        -- Berkas yang hilang begitu saja dan berkas yang sengaja dihapus
        -- menuntut tindakan yang berbeda: yang pertama ditarik ulang, yang
        -- kedua memang tidak boleh ditarik ulang.
        dihapus_retensi DATETIME NULL,
        UNIQUE KEY uq_abef_isi (document_key, sidik_jari),
        INDEX idx_abef_dokumen (document_key, format),
        INDEX idx_abef_perkara (nomor_perkara)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await botDb.query(`
      CREATE TABLE IF NOT EXISTS aleta_bot_ecourt_sync_runs (
        id VARCHAR(64) PRIMARY KEY,
        dimulai_pada DATETIME NOT NULL,
        selesai_pada DATETIME NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'berjalan',
        perkara_diperiksa INT NOT NULL DEFAULT 0,
        dokumen_terlihat INT NOT NULL DEFAULT 0,
        dokumen_baru INT NOT NULL DEFAULT 0,
        berkas_terunduh INT NOT NULL DEFAULT 0,
        jumlah_galat INT NOT NULL DEFAULT 0,
        galat_terakhir TEXT,
        catatan TEXT,
        INDEX idx_abesr_mulai (dimulai_pada)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ------------------------------------------------------------------
    // PERSETUJUAN SALURAN ELEKTRONIK DAN PANGGILAN e-SUMMONS
    //
    // Kunci alaminya - nomor perkara ditambah nama pihak - TIDAK dijadikan
    // kunci gabungan. Pada utf8mb4 tiap huruf memakan empat byte, dan MySQL
    // lama membatasi kunci pada 767 byte: dua kolom teks saja sudah jauh
    // melewatinya, dan tabelnya gagal dibuat sama sekali.
    //
    // Karena itu kunci alaminya diringkas menjadi sidik jari yang dipakai
    // sebagai id - pola yang sama dengan document_key pada tabel dokumen.
    //
    // Keduanya menentukan CARA memanggil pihak, dan itu menentukan keabsahan
    // panggilannya. Pihak yang menyetujui saluran elektronik dipanggil lewat
    // e-Summons; yang menolak atau belum menjawab harus dipanggil jurusita
    // lewat surat tercatat.
    //
    // Disimpan di database ALETA, bukan dibaca ulang dari e-Court tiap kali:
    // membuka halaman Mahkamah Agung setiap ada yang melihat jadwal sidang
    // bukan perilaku yang pantas.
    // ------------------------------------------------------------------
    await botDb.query(`
      CREATE TABLE IF NOT EXISTS aleta_bot_ecourt_pihak (
        id VARCHAR(64) PRIMARY KEY,
        nomor_perkara VARCHAR(191) NOT NULL,
        nama VARCHAR(255) NOT NULL,
        peran VARCHAR(64) NOT NULL DEFAULT '',
        email VARCHAR(191) NOT NULL DEFAULT '',
        telp VARCHAR(64) NOT NULL DEFAULT '',
        persetujuan VARCHAR(16) NOT NULL DEFAULT 'belum',
        terakhir_terlihat DATETIME NOT NULL,
        INDEX idx_abep_perkara (nomor_perkara)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await botDb.query(`
      CREATE TABLE IF NOT EXISTS aleta_bot_ecourt_panggilan (
        id VARCHAR(64) PRIMARY KEY,
        nomor_perkara VARCHAR(191) NOT NULL,
        nama_pihak VARCHAR(255) NOT NULL DEFAULT '',
        email VARCHAR(191) NOT NULL DEFAULT '',
        jenis VARCHAR(191) NOT NULL DEFAULT '',
        judul_dokumen VARCHAR(255) NOT NULL DEFAULT '',
        tanggal_sidang DATE NULL,
        dikirim_pada DATETIME NULL,
        terakhir_terlihat DATETIME NOT NULL,
        INDEX idx_abepg_perkara (nomor_perkara)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ------------------------------------------------------------------
    // IDENTITAS SIPP PADA DOKUMEN
    //
    // Sampai sekarang dokumen e-Court hanya dikaitkan ke perkara lewat
    // nomor_perkara sebagai TEKS. Kecocokan teks rapuh terhadap beda spasi,
    // titik, dan huruf besar-kecil - dan SIPP sudah memegang pemetaan resmi
    // lewat perkara_efiling_id, jadi tidak ada alasan menebak dari teks.
    //
    // Kolom ini boleh KOSONG. Dokumen yang tidak dapat dipadankan ke perkara
    // SIPP tetap disimpan apa adanya: kehilangan dokumen jauh lebih buruk
    // daripada dokumen tanpa perkara_id, dan yang kosong justru menjadi
    // daftar kerja rekonsiliasi.
    // ------------------------------------------------------------------
    await botDb.addColumnIfMissing(
      "aleta_bot_ecourt_documents",
      "perkara_id",
      "BIGINT NULL AFTER nomor_perkara"
    );
    await botDb.addColumnIfMissing(
      "aleta_bot_ecourt_documents",
      "nomor_register",
      "VARCHAR(64) NOT NULL DEFAULT '' AFTER perkara_id"
    );
    await botDb.addIndexIfMissing(
      "aleta_bot_ecourt_documents",
      "idx_abed_perkara_id",
      "(perkara_id)"
    );

    // Penanda berkas yang dihapus karena melewati masa simpan. Tabelnya sudah
    // ada di pemasangan lama, dan CREATE TABLE IF NOT EXISTS tidak menambah
    // kolom - jadi ditambahkan tersendiri.
    await botDb.addColumnIfMissing(
      "aleta_bot_ecourt_files",
      "dihapus_retensi",
      "DATETIME NULL"
    );

    // Hitungan kegagalan beruntun saat mengambil berkas satu dokumen. Dipakai
    // menghentikan percobaan yang jelas-jelas tidak akan berhasil - lihat
    // catatan pada berkasDikarantina().
    await botDb.addColumnIfMissing(
      "aleta_bot_ecourt_documents",
      "gagal_beruntun",
      "INT NOT NULL DEFAULT 0"
    );
    await botDb.addColumnIfMissing(
      "aleta_bot_ecourt_documents",
      "gagal_sebab",
      "VARCHAR(191) NOT NULL DEFAULT ''"
    );
    await botDb.addColumnIfMissing(
      "aleta_bot_ecourt_documents",
      "gagal_terakhir",
      "DATETIME NULL"
    );

    schemaReady = true;
    return true;
  })().catch((error) => {
    schemaPromise = null;
    throw error;
  });

  return schemaPromise;
}

/**
 * Identitas tetap sebuah dokumen.
 *
 * Dipakai untuk mengenali dokumen yang SAMA pada sinkronisasi berikutnya,
 * supaya tidak diunduh ulang dan tidak diberitahukan dua kali.
 *
 * Sengaja TIDAK memakai status verifikasi sebagai bahan kunci: status justru
 * yang diharapkan berubah (belum -> valid), dan bila ikut jadi bahan kunci,
 * dokumen yang sama akan dianggap dokumen baru begitu majelis memverifikasinya.
 */
/**
 * Sidik jari kunci alami, dipakai sebagai id baris.
 *
 * Menghasilkan nilai yang SAMA untuk masukan yang sama, sehingga penarikan
 * berikutnya memperbarui baris yang ada alih-alih menambah baris kembar -
 * peran yang biasanya dipegang kunci gabungan, tetapi muat dalam batas 767
 * byte MySQL lama.
 */
function kunciRingkas(...bagian) {
  const bahan = bagian.map((x) => cleanText(x).toLowerCase()).join("|");
  return crypto.createHash("sha256").update(bahan).digest("hex").slice(0, 40);
}

function buildDocumentKey({ nomorPerkara, judulDokumen, emailPengunggah, diunggahPada }) {
  const bahan = [
    normalizeCaseNumber(nomorPerkara),
    cleanText(judulDokumen).toLowerCase(),
    cleanText(emailPengunggah).toLowerCase(),
    diunggahPada ? new Date(diunggahPada).toISOString().slice(0, 16) : "",
  ].join("|");
  return crypto.createHash("sha256").update(bahan).digest("hex").slice(0, 40);
}

function normalizeStatus(value, { perluVerifikasi = true } = {}) {
  // Dokumen yang memang tidak mengenal verifikasi tidak pernah menjadi
  // "belum", berapa pun isi teks statusnya.
  if (!perluVerifikasi) return "tidak_perlu";

  const teks = cleanText(value).toLowerCase();
  if (!teks) return "belum";
  if (VERIFICATION_STATUSES.has(teks)) return teks;
  if (/tidak\s*valid|ditolak/.test(teks)) return "tidak_valid";
  // "Sudah diverifikasi Majelis/Hakim (Dokumen Valid)" pada halaman e-Court.
  if (/valid|terverifikasi|diverifikasi/.test(teks)) return "valid";
  return "belum";
}

function toDateOrNull(value) {
  if (!value) return null;
  const waktu = value instanceof Date ? value : new Date(value);
  return Number.isFinite(waktu.getTime()) ? waktu : null;
}

/**
 * Menyimpan satu dokumen yang ditemukan jembatan.
 *
 * Dokumen yang sudah pernah tersimpan akan DIPERBARUI, bukan digandakan.
 * Yang diperbarui hanya bagian yang memang bisa berubah di e-Court: status
 * verifikasi, jalur berkas, dan agenda. Waktu pemberitahuan TIDAK pernah
 * disentuh di sini - itu urusan pekerja notifikasi.
 *
 * @returns {Promise<{ documentKey: string, baru: boolean, statusBerubah: boolean, statusLama: string }>}
 */
async function recordDocument(input = {}) {
  await ensureSchema();

  const nomorPerkara = normalizeCaseNumber(input.nomorPerkara);
  const judulDokumen = cleanText(input.judulDokumen);
  const emailPengunggah = cleanText(input.emailPengunggah);
  const diunggahPada = toDateOrNull(input.diunggahPada);
  const documentKey = input.documentKey || buildDocumentKey({ nomorPerkara, judulDokumen, emailPengunggah, diunggahPada });
  const status = normalizeStatus(input.statusVerifikasi);
  const sekarang = new Date();

  const tersimpan = await botDb.query(
    `SELECT id, status_verifikasi FROM aleta_bot_ecourt_documents WHERE document_key = ? LIMIT 1`,
    [documentKey]
  );

  if (Array.isArray(tersimpan) && tersimpan.length > 0) {
    const statusLama = String(tersimpan[0].status_verifikasi || "belum");
    await botDb.query(
      `UPDATE aleta_bot_ecourt_documents
          SET status_verifikasi = ?,
              jenis_dokumen = ?,
              agenda = ?,
              tanggal_sidang = ?,
              -- Batas waktu ikut disegarkan tiap sinkronisasi karena e-Court dapat
              -- menggesernya saat sidang ditunda.
              batas_unggah = ?,
              batas_unggah_teks = ?,
              -- Jalur berkas hanya ditimpa bila jembatan benar-benar membawa
              -- yang baru. Sinkronisasi yang gagal mengunduh tidak boleh
              -- menghapus berkas yang sudah berhasil diunduh sebelumnya.
              berkas_pdf = COALESCE(?, berkas_pdf),
              berkas_word = COALESCE(?, berkas_word),
              sumber_url = COALESCE(?, sumber_url),
              registrasi_ecourt = ?,
              -- Identitas SIPP diisi bila jembatan membawanya, dan TIDAK
              -- dikosongkan bila tidak. Sinkronisasi yang gagal memadankan
              -- tidak boleh menghapus padanan yang sudah benar sebelumnya.
              perkara_id = COALESCE(?, perkara_id),
              nomor_register = CASE WHEN ? = '' THEN nomor_register ELSE ? END,
              peran_pengunggah = ?,
              terakhir_terlihat = ?,
              updated_at = ?
        WHERE document_key = ?`,
      [
        status,
        cleanText(input.jenisDokumen),
        cleanText(input.agenda),
        toDateOrNull(input.tanggalSidang) ? botDb.toMysqlDate(toDateOrNull(input.tanggalSidang)) : null,
        toDateOrNull(input.batasUnggah) ? botDb.toMysqlDate(toDateOrNull(input.batasUnggah)) : null,
        cleanText(input.batasUnggahTeks).slice(0, 191),
        input.berkasPdf ? String(input.berkasPdf) : null,
        input.berkasWord ? String(input.berkasWord) : null,
        input.sumberUrl ? String(input.sumberUrl) : null,
        cleanText(input.registrasiEcourt),
        input.perkaraId ? String(input.perkaraId) : null,
        cleanText(input.nomorRegister).slice(0, 64),
        cleanText(input.nomorRegister).slice(0, 64),
        cleanText(input.peranPengunggah),
        botDb.toMysqlDate(sekarang),
        botDb.toMysqlDate(sekarang),
        documentKey,
      ]
    );
    return { documentKey, baru: false, statusBerubah: statusLama !== status, statusLama };
  }

  await botDb.query(
    `INSERT INTO aleta_bot_ecourt_documents (
       id, document_key, nomor_perkara, perkara_id, nomor_register, registrasi_ecourt,
       judul_dokumen, jenis_dokumen,
       peran_pengunggah, email_pengunggah, diunggah_pada, status_verifikasi, agenda,
       tanggal_sidang, batas_unggah, batas_unggah_teks, berkas_pdf, berkas_word, sumber_url,
       pertama_terlihat, terakhir_terlihat, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      documentKey,
      nomorPerkara,
      // Identitas SIPP. Boleh kosong: dokumen yang belum dapat dipadankan
      // tetap disimpan, dan justru menjadi daftar kerja rekonsiliasi.
      input.perkaraId ? String(input.perkaraId) : null,
      cleanText(input.nomorRegister).slice(0, 64),
      cleanText(input.registrasiEcourt),
      judulDokumen,
      cleanText(input.jenisDokumen),
      cleanText(input.peranPengunggah),
      emailPengunggah,
      diunggahPada ? botDb.toMysqlDate(diunggahPada) : null,
      status,
      cleanText(input.agenda),
      toDateOrNull(input.tanggalSidang) ? botDb.toMysqlDate(toDateOrNull(input.tanggalSidang)) : null,
      toDateOrNull(input.batasUnggah) ? botDb.toMysqlDate(toDateOrNull(input.batasUnggah)) : null,
      cleanText(input.batasUnggahTeks).slice(0, 191),
      input.berkasPdf ? String(input.berkasPdf) : null,
      input.berkasWord ? String(input.berkasWord) : null,
      input.sumberUrl ? String(input.sumberUrl) : null,
      botDb.toMysqlDate(sekarang),
      botDb.toMysqlDate(sekarang),
      botDb.toMysqlDate(sekarang),
    ]
  );
  return { documentKey, baru: true, statusBerubah: true, statusLama: "" };
}

/** Apakah dokumen dengan kunci ini sudah pernah tersimpan? */
async function hasDocument(documentKey) {
  await ensureSchema();
  const rows = await botDb.query(
    `SELECT 1 FROM aleta_bot_ecourt_documents WHERE document_key = ? LIMIT 1`,
    [String(documentKey || "")]
  );
  return Array.isArray(rows) && rows.length > 0;
}

/**
 * Dokumen yang sudah diverifikasi valid tetapi belum pernah diberitahukan.
 *
 * Inilah antrean kerja pekerja notifikasi. Penyaringan status ada di SINI,
 * bukan hanya di pengklasifikasi, supaya dokumen yang belum diverifikasi tidak
 * pernah sampai terbaca pekerja notifikasi sama sekali.
 */
async function listPendingNotification({ limit = 50 } = {}) {
  await ensureSchema();
  const batas = Math.max(1, Math.min(500, Number(limit) || 50));
  const rows = await botDb.query(
    `SELECT * FROM aleta_bot_ecourt_documents
      WHERE status_verifikasi = 'valid'
        AND diberitahukan_pada IS NULL
        AND alasan_tidak_diberitahukan = ''
      ORDER BY diunggah_pada ASC, pertama_terlihat ASC
      LIMIT ${batas}`
  );
  return Array.isArray(rows) ? rows : [];
}

/** Menandai dokumen sudah diberitahukan. */
async function markNotified(documentKey, { at = new Date() } = {}) {
  await ensureSchema();
  await botDb.query(
    `UPDATE aleta_bot_ecourt_documents
        SET diberitahukan_pada = ?, updated_at = ?
      WHERE document_key = ?`,
    [botDb.toMysqlDate(at), botDb.toMysqlDate(at), String(documentKey || "")]
  );
}

/**
 * Menandai dokumen sengaja TIDAK diberitahukan, beserta alasannya.
 *
 * Dipisahkan dari markNotified supaya bisa dibedakan saat diperiksa: dokumen
 * yang dilewati karena memang tidak perlu (mis. berkas pendaftaran milik
 * pengunggah sendiri) tidak sama dengan dokumen yang gagal dikirim.
 */
async function markSkipped(documentKey, reason) {
  await ensureSchema();
  const sekarang = new Date();
  await botDb.query(
    `UPDATE aleta_bot_ecourt_documents
        SET alasan_tidak_diberitahukan = ?, updated_at = ?
      WHERE document_key = ?`,
    [cleanText(reason).slice(0, 191) || "tidak_dijelaskan", botDb.toMysqlDate(sekarang), String(documentKey || "")]
  );
}

/** Seluruh dokumen satu perkara, terbaru lebih dulu. */
async function listByCase(nomorPerkara, { limit = 100 } = {}) {
  await ensureSchema();
  const batas = Math.max(1, Math.min(500, Number(limit) || 100));
  const rows = await botDb.query(
    `SELECT * FROM aleta_bot_ecourt_documents
      WHERE nomor_perkara = ?
      ORDER BY diunggah_pada DESC, pertama_terlihat DESC
      LIMIT ${batas}`,
    [normalizeCaseNumber(nomorPerkara)]
  );
  return Array.isArray(rows) ? rows : [];
}

/** Memulai catatan satu kali jalan sinkronisasi. */
async function startSyncRun({ catatan = "" } = {}) {
  await ensureSchema();
  const id = crypto.randomUUID();
  await botDb.query(
    `INSERT INTO aleta_bot_ecourt_sync_runs (id, dimulai_pada, status, catatan)
     VALUES (?, ?, 'berjalan', ?)`,
    [id, botDb.toMysqlDate(new Date()), cleanText(catatan)]
  );
  return id;
}

/** Menutup catatan sinkronisasi dengan hasilnya. */
/**
 * Meringkas selisih dengan SIPP untuk disimpan bersama catatan putaran.
 *
 * Disimpan sebagai JSON, bukan kalimat, supaya portal dapat menampilkannya
 * dengan cara apa pun tanpa mengurai teks. Daftar nomor perkara dipotong:
 * yang dibutuhkan petugas adalah mengetahui ADA yang terlewat dan contohnya,
 * bukan seluruh daftar di dalam satu kolom teks.
 */
function ringkasSelisih(hasil = {}) {
  const tidakDitemukan = Array.isArray(hasil.tidakDitemukanDiEcourt) ? hasil.tidakDitemukanDiEcourt : [];
  const tidakAdaDiSipp = Array.isArray(hasil.tidakAdaDiSipp) ? hasil.tidakAdaDiSipp : [];
  const registerBerbeda = Array.isArray(hasil.registerBerbeda) ? hasil.registerBerbeda : [];

  if (tidakDitemukan.length === 0 && tidakAdaDiSipp.length === 0 && registerBerbeda.length === 0) {
    return null;
  }

  return JSON.stringify({
    tidakDitemukanDiEcourt: { jumlah: tidakDitemukan.length, contoh: tidakDitemukan.slice(0, 20) },
    tidakAdaDiSipp: { jumlah: tidakAdaDiSipp.length, contoh: tidakAdaDiSipp.slice(0, 20) },
    registerBerbeda: { jumlah: registerBerbeda.length, contoh: registerBerbeda.slice(0, 20) },
  }).slice(0, 8000);
}

async function finishSyncRun(runId, hasil = {}) {
  await ensureSchema();
  await botDb.query(
    `UPDATE aleta_bot_ecourt_sync_runs
        SET selesai_pada = ?, status = ?, perkara_diperiksa = ?, dokumen_terlihat = ?,
            dokumen_baru = ?, berkas_terunduh = ?, jumlah_galat = ?, galat_terakhir = ?,
            catatan = ?
      WHERE id = ?`,
    [
      botDb.toMysqlDate(new Date()),
      String(hasil.status || "selesai"),
      Number(hasil.perkaraDiperiksa || 0),
      Number(hasil.dokumenTerlihat || 0),
      Number(hasil.dokumenBaru || 0),
      Number(hasil.berkasTerunduh || 0),
      Number(hasil.jumlahGalat || 0),
      hasil.galatTerakhir ? String(hasil.galatTerakhir).slice(0, 2000) : null,
      ringkasSelisih(hasil),
      String(runId || ""),
    ]
  );
}

/** Ringkasan untuk status layanan bot. */
async function getStats() {
  await ensureSchema();
  try {
    const rows = await botDb.query(
      `SELECT
         COUNT(*) AS total,
         SUM(status_verifikasi = 'valid') AS valid,
         SUM(status_verifikasi = 'belum') AS belum,
         SUM(status_verifikasi = 'valid' AND diberitahukan_pada IS NULL AND alasan_tidak_diberitahukan = '') AS menunggu_kirim
       FROM aleta_bot_ecourt_documents`
    );
    const baris = Array.isArray(rows) && rows[0] ? rows[0] : {};
    const terakhir = await botDb.query(
      `SELECT dimulai_pada, selesai_pada, status, dokumen_baru
         FROM aleta_bot_ecourt_sync_runs ORDER BY dimulai_pada DESC LIMIT 1`
    );
    return {
      total: Number(baris.total || 0),
      valid: Number(baris.valid || 0),
      belum: Number(baris.belum || 0),
      menungguKirim: Number(baris.menunggu_kirim || 0),
      sinkronTerakhir: Array.isArray(terakhir) && terakhir[0] ? terakhir[0] : null,
    };
  } catch {
    // Status layanan tidak boleh gagal hanya karena bagian ini bermasalah.
    return { total: null, valid: null, belum: null, menungguKirim: null, sinkronTerakhir: null };
  }
}

/**
 * Mencatat satu berkas yang baru diunduh.
 *
 * Bila sidik jarinya sudah pernah tercatat untuk dokumen yang sama, berarti
 * isinya tidak berubah: barisnya hanya disegarkan waktu periksanya, dan
 * pemanggil diberi tahu supaya berkas sementaranya dibuang.
 *
 * @returns {Promise<{ baru: boolean, sudahAda: boolean }>}
 */
async function recordFile({
  documentKey,
  nomorPerkara,
  format,
  jalurBerkas,
  sidikJari,
  ukuranByte,
  tipeIsi,
  sumberUrl,
} = {}) {
  await ensureSchema();
  const sekarang = botDb.toMysqlDate(new Date());

  const ada = await botDb.query(
    `SELECT id FROM aleta_bot_ecourt_files WHERE document_key = ? AND sidik_jari = ? LIMIT 1`,
    [String(documentKey || ""), String(sidikJari || "")]
  );

  if (Array.isArray(ada) && ada.length > 0) {
    await botDb.query(`UPDATE aleta_bot_ecourt_files SET terakhir_diperiksa = ? WHERE id = ?`, [
      sekarang,
      ada[0].id,
    ]);
    return { baru: false, sudahAda: true };
  }

  await botDb.query(
    `INSERT INTO aleta_bot_ecourt_files
       (id, document_key, nomor_perkara, format, jalur_berkas, sidik_jari,
        ukuran_byte, tipe_isi, sumber_url, diunduh_pada, terakhir_diperiksa)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      String(documentKey || ""),
      normalizeCaseNumber(nomorPerkara),
      String(format || ""),
      String(jalurBerkas || ""),
      String(sidikJari || ""),
      Number(ukuranByte || 0),
      cleanText(tipeIsi).slice(0, 191),
      String(sumberUrl || ""),
      sekarang,
      sekarang,
    ]
  );

  // Kolom lama diisi jalur berkas TERAKHIR tiap format, sehingga seluruh kode
  // yang sudah ada - pekerja notifikasi, menu verifikasi hakim - tetap
  // berjalan tanpa satu baris pun diubah.
  const kolom = String(format) === "word" ? "berkas_word" : "berkas_pdf";
  await botDb.query(
    `UPDATE aleta_bot_ecourt_documents SET ${kolom} = ?, updated_at = ? WHERE document_key = ?`,
    [String(jalurBerkas || ""), sekarang, String(documentKey || "")]
  );

  return { baru: true, sudahAda: false };
}

/**
 * ============================================================================
 * DOKUMEN YANG BERULANG GAGAL DIAMBIL
 * ============================================================================
 *
 * Sebagian dokumen memang tidak dapat diunduh, dan tidak akan pernah bisa:
 * tautannya berbentuk yang belum dikenali, berkasnya sudah dihapus di sisi
 * e-Court, atau alamatnya menjawab galat yang sama tiap kali. Mencobanya lagi
 * tiap putaran tidak menolong siapa pun - ia hanya memakan jatah putaran,
 * membebani server Mahkamah Agung dengan permintaan yang sudah pasti gagal,
 * dan menenggelamkan kegagalan yang BARU di antara kegagalan yang sama
 * berulang-ulang.
 *
 * Karena itu setelah tiga kali gagal beruntun dengan sebab yang tercatat,
 * dokumen itu diistirahatkan sehari. Bukan dibuang: sebabnya tetap tersimpan
 * dan dapat dibaca, hitungannya kembali nol begitu satu kali berhasil, dan
 * sesudah jeda lewat ia dicoba lagi sekali - sebab e-Court dapat memperbaiki
 * berkasnya kapan saja tanpa memberi tahu.
 */
const GAGAL_AMBANG = 3;
const GAGAL_JEDA_JAM = 24;

async function catatGagalBerkas(documentKey, sebab) {
  await ensureSchema();
  await botDb
    .query(
      `UPDATE aleta_bot_ecourt_documents
          SET gagal_beruntun = gagal_beruntun + 1,
              gagal_sebab = ?,
              gagal_terakhir = ?
        WHERE document_key = ?`,
      [cleanText(sebab).slice(0, 191), botDb.toMysqlDate(new Date()), String(documentKey || "")]
    )
    .catch(() => {});
}

/** Satu keberhasilan menghapus seluruh riwayat kegagalan sebelumnya. */
async function resetGagalBerkas(documentKey) {
  await ensureSchema();
  await botDb
    .query(
      `UPDATE aleta_bot_ecourt_documents
          SET gagal_beruntun = 0, gagal_sebab = '', gagal_terakhir = NULL
        WHERE document_key = ? AND gagal_beruntun > 0`,
      [String(documentKey || "")]
    )
    .catch(() => {});
}

/**
 * Apakah dokumen ini sedang diistirahatkan?
 *
 * Gagal-TERBUKA: bila catatannya tidak terbaca, jawabannya TIDAK dikarantina.
 * Menahan pengambilan berkas karena tabelnya bermasalah berarti kehilangan
 * dokumen yang sebenarnya baik-baik saja.
 */
async function berkasDikarantina(documentKey) {
  await ensureSchema();
  try {
    const rows = await botDb.query(
      `SELECT gagal_beruntun AS gagal, gagal_sebab AS sebab, gagal_terakhir AS terakhir
         FROM aleta_bot_ecourt_documents WHERE document_key = ? LIMIT 1`,
      [String(documentKey || "")]
    );
    const baris = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (!baris) return { karantina: false, gagal: 0, sebab: "", jamLagi: 0 };

    const gagal = Number(baris.gagal) || 0;
    if (gagal < GAGAL_AMBANG) return { karantina: false, gagal, sebab: String(baris.sebab || ""), jamLagi: 0 };

    const waktu = botDb.fromMysqlDate(baris.terakhir);
    if (!waktu) return { karantina: false, gagal, sebab: String(baris.sebab || ""), jamLagi: 0 };

    const jamBerlalu = (Date.now() - waktu.getTime()) / 3600000;
    if (jamBerlalu >= GAGAL_JEDA_JAM) {
      // Jedanya sudah lewat - dicoba lagi sekali. e-Court dapat memperbaiki
      // berkasnya kapan saja tanpa memberi tahu siapa pun.
      return { karantina: false, gagal, sebab: String(baris.sebab || ""), jamLagi: 0 };
    }

    return {
      karantina: true,
      gagal,
      sebab: String(baris.sebab || ""),
      jamLagi: Math.max(1, Math.ceil(GAGAL_JEDA_JAM - jamBerlalu)),
    };
  } catch {
    return { karantina: false, gagal: 0, sebab: "", jamLagi: 0 };
  }
}

/** Dokumen yang berulang gagal diambil - untuk dilaporkan ke layar. */
async function daftarBerkasBermasalah({ limit = 50 } = {}) {
  await ensureSchema();
  const batas = Math.max(1, Math.min(200, Number(limit) || 50));
  try {
    const rows = await botDb.query(
      `SELECT document_key AS documentKey, nomor_perkara AS nomorPerkara,
              judul_dokumen AS judulDokumen, gagal_beruntun AS gagal,
              gagal_sebab AS sebab, gagal_terakhir AS terakhir
         FROM aleta_bot_ecourt_documents
        WHERE gagal_beruntun >= ${GAGAL_AMBANG}
        ORDER BY gagal_beruntun DESC, gagal_terakhir DESC
        LIMIT ${batas}`
    );
    return (Array.isArray(rows) ? rows : []).map((row) => ({
      documentKey: String(row.documentKey || ""),
      nomorPerkara: String(row.nomorPerkara || ""),
      judulDokumen: String(row.judulDokumen || ""),
      gagal: Number(row.gagal) || 0,
      sebab: String(row.sebab || ""),
      terakhir: row.terakhir ? botDb.fromMysqlDate(row.terakhir)?.toISOString() || "" : "",
    }));
  } catch {
    return [];
  }
}

/**
 * Apakah isi ini pernah dihapus oleh masa simpan?
 *
 * Berkas yang dihapus retensi TIDAK boleh ditulis kembali. Penarikan berikutnya
 * tetap akan mengunduh isinya - halaman e-Court tidak tahu apa-apa tentang masa
 * simpan kita - dan tanpa pemeriksaan ini, penulis berkas akan mengisi ulang
 * apa yang baru saja sengaja dikosongkan.
 *
 * Dibedakan dari berkas yang HILANG: yang hilang justru harus ditulis kembali.
 * Penandanya dihapus_retensi, disetel hanya oleh pembersih arsip.
 */
async function dihapusKarenaRetensi(documentKey, sidikJari) {
  await ensureSchema();
  const rows = await botDb.query(
    `SELECT id FROM aleta_bot_ecourt_files
      WHERE document_key = ? AND sidik_jari = ? AND dihapus_retensi IS NOT NULL
      LIMIT 1`,
    [String(documentKey || ""), String(sidikJari || "")]
  );
  return Array.isArray(rows) && rows.length > 0;
}

/**
 * Jalur berkas yang tercatat untuk satu dokumen dan MASIH seharusnya ada.
 *
 * Dipakai penarik untuk memeriksa apakah yang tercatat benar-benar ada di
 * disk. Baris yang dikosongkan masa simpan tidak ikut - berkasnya memang
 * sengaja tidak ada, dan menyebutnya hilang akan menyuruh menariknya kembali.
 */
async function jalurBerkasTercatat(documentKey) {
  await ensureSchema();
  const rows = await botDb.query(
    `SELECT jalur_berkas FROM aleta_bot_ecourt_files
      WHERE document_key = ? AND dihapus_retensi IS NULL
        AND jalur_berkas IS NOT NULL AND jalur_berkas <> ''`,
    [String(documentKey || "")]
  );
  return (Array.isArray(rows) ? rows : []).map((row) => String(row.jalur_berkas || "")).filter(Boolean);
}

/**
 * Kapan tiap perkara terakhir DIBUKA penarik.
 *
 * ============================================================================
 * GILIRAN, BUKAN URUTAN PENDAFTARAN
 * ============================================================================
 *
 * Penjadwal memeriksa sejumlah perkara tiap putaran. Bila urutannya selalu
 * sama - terbaru lebih dulu - maka perkara yang tidak pernah selesai
 * dilengkapi akan menempati barisan depan selamanya, dan yang di belakangnya
 * tidak pernah mendapat giliran. Cacatnya tidak terlihat: tiap putaran tampak
 * bekerja, hanya saja selalu atas perkara yang itu-itu juga.
 *
 * Dengan waktu terakhir dilihat, urutannya berputar dengan sendirinya. Perkara
 * yang BELUM PERNAH dibuka tidak punya baris sama sekali - dan justru itu yang
 * harus didahulukan, sehingga ketiadaannya diperlakukan sebagai "paling lama
 * menunggu", bukan sebagai "tidak ada datanya".
 */
async function terakhirDiperiksaPerkara() {
  await ensureSchema();
  const rows = await botDb.query(
    `SELECT nomor_perkara AS nomorPerkara, MAX(terakhir_terlihat) AS terakhir
       FROM aleta_bot_ecourt_documents
      GROUP BY nomor_perkara`
  );

  const peta = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const waktu = botDb.fromMysqlDate(row.terakhir);
    peta.set(normalizeCaseNumber(row.nomorPerkara), waktu ? waktu.getTime() : 0);
  }
  return peta;
}

/** Berkas yang tercatat untuk satu dokumen, terbaru lebih dulu. */
async function listFiles(documentKey) {
  await ensureSchema();
  const rows = await botDb.query(
    `SELECT format, jalur_berkas, sidik_jari, ukuran_byte, diunduh_pada
       FROM aleta_bot_ecourt_files
      WHERE document_key = ?
      ORDER BY diunduh_pada DESC`,
    [String(documentKey || "")]
  );
  return Array.isArray(rows) ? rows : [];
}



/**
 * Daftar perkara beserta keadaan berkasnya - satu baris per perkara.
 *
 * ============================================================================
 * SATU BARIS PER PERKARA, BUKAN PER DOKUMEN
 * ============================================================================
 *
 * Arsip memuat ribuan dokumen. Menampilkannya sekaligus menghasilkan halaman
 * yang tidak dapat dibaca dan tidak menjawab pertanyaan siapa pun. Pertanyaan
 * yang sebenarnya adalah "perkara mana yang berkasnya belum lengkap" - dan itu
 * dijawab dengan hitungan per perkara, bukan dengan daftar dokumen.
 *
 * Rincian dokumennya baru dibuka ketika satu perkara dipilih.
 */
const URUTAN_ARSIP = {
  terbaru: "MAX(terakhir_terlihat) DESC",
  terlama: "MAX(terakhir_terlihat) ASC",
  perkara: "nomor_perkara ASC",
  belumTerbanyak: "tanpaBerkas DESC, MAX(terakhir_terlihat) DESC",
  dokumenTerbanyak: "dokumen DESC, MAX(terakhir_terlihat) DESC",
  menungguTerbanyak: "menungguMajelis DESC, MAX(terakhir_terlihat) DESC",
};

async function daftarArsipPerkara({
  cari = "",
  hanyaBelumLengkap = false,
  urutkan = "terbaru",
  batas = 100,
  mulai = 0,
} = {}) {
  await ensureSchema();

  const syarat = [];
  const nilai = [];

  const kataCari = cleanText(cari);
  if (kataCari) {
    // Nomor perkara maupun nomor register - petugas menghafal yang pertama,
    // e-Court memakai yang kedua, dan memaksa salah satunya hanya menyusahkan.
    syarat.push("(nomor_perkara LIKE ? OR nomor_register LIKE ? OR registrasi_ecourt LIKE ?)");
    nilai.push(`%${kataCari}%`, `%${kataCari}%`, `%${kataCari}%`);
  }

  const where = syarat.length > 0 ? `WHERE ${syarat.join(" AND ")}` : "";

  // Perkara yang berkasnya belum lengkap disaring SETELAH pengelompokan -
  // kelengkapan adalah sifat perkara, bukan sifat satu dokumen.
  // Urutan dipilih dari daftar TETAP, tidak pernah disusun dari masukan.
  // Nilai ORDER BY tidak dapat dijadikan parameter kueri, sehingga menyusunnya
  // dari teks yang dikirim pemanggil membuka jalan penyisipan SQL.
  const urutan = URUTAN_ARSIP[String(urutkan)] || URUTAN_ARSIP.terbaru;

  const having = hanyaBelumLengkap
    ? "HAVING SUM(CASE WHEN berkas_pdf IS NULL AND berkas_word IS NULL THEN 1 ELSE 0 END) > 0"
    : "";

  const rows = await botDb.query(
    `SELECT nomor_perkara AS nomorPerkara,
            MAX(perkara_id) AS perkaraId,
            MAX(COALESCE(NULLIF(nomor_register, ''), registrasi_ecourt)) AS nomorRegister,
            COUNT(*) AS dokumen,
            SUM(CASE WHEN berkas_pdf IS NOT NULL THEN 1 ELSE 0 END) AS adaPdf,
            SUM(CASE WHEN berkas_word IS NOT NULL THEN 1 ELSE 0 END) AS adaWord,
            SUM(CASE WHEN berkas_pdf IS NULL AND berkas_word IS NULL THEN 1 ELSE 0 END) AS tanpaBerkas,
            SUM(CASE WHEN status_verifikasi = 'belum' THEN 1 ELSE 0 END) AS menungguMajelis,
            SUM(CASE WHEN status_verifikasi = 'valid' THEN 1 ELSE 0 END) AS sudahValid,
            SUM(CASE WHEN status_verifikasi = 'tidak_perlu' THEN 1 ELSE 0 END) AS berkasPendaftaran,
            -- Berkas yang sengaja dihapus karena masa simpan. Dipisahkan dari
            -- "belum ada": yang ini TIDAK perlu ditarik ulang.
            (SELECT COUNT(*) FROM aleta_bot_ecourt_files rf
              WHERE rf.nomor_perkara = aleta_bot_ecourt_documents.nomor_perkara
                AND rf.dihapus_retensi IS NOT NULL) AS dihapusRetensi,
            MAX(terakhir_terlihat) AS terakhirTerlihat
       FROM aleta_bot_ecourt_documents
       ${where}
      GROUP BY nomor_perkara
      ${having}
      ORDER BY ${urutan}
      LIMIT ? OFFSET ?`,
    [...nilai, Math.min(Math.max(Number(batas) || 100, 1), 500), Math.max(Number(mulai) || 0, 0)]
  );

  const total = await botDb.query(
    `SELECT COUNT(*) AS jumlah FROM (
       SELECT nomor_perkara
         FROM aleta_bot_ecourt_documents
         ${where}
        GROUP BY nomor_perkara
        ${having}
     ) AS t`,
    nilai
  );

  return {
    diperiksaPada: new Date().toISOString(),
    total: Number(total && total[0] && total[0].jumlah) || 0,
    perkara: (Array.isArray(rows) ? rows : []).map((row) => ({
      nomorPerkara: cleanText(row.nomorPerkara),
      perkaraId: row.perkaraId ? String(row.perkaraId) : "",
      nomorRegister: cleanText(row.nomorRegister),
      dokumen: Number(row.dokumen) || 0,
      adaPdf: Number(row.adaPdf) || 0,
      adaWord: Number(row.adaWord) || 0,
      tanpaBerkas: Number(row.tanpaBerkas) || 0,
      menungguMajelis: Number(row.menungguMajelis) || 0,
      sudahValid: Number(row.sudahValid) || 0,
      berkasPendaftaran: Number(row.berkasPendaftaran) || 0,
      dihapusRetensi: Number(row.dihapusRetensi) || 0,
      terakhirTerlihat: botDb.fromMysqlDate(row.terakhirTerlihat),
    })),
  };
}

/**
 * Rincian dokumen satu perkara - dibuka saat satu baris dipilih.
 *
 * Berbeda dengan dokumenPerkara pada sippKonteksService yang melayani ekstensi,
 * fungsi ini menyertakan keterangan yang hanya berguna di layar pengelolaan:
 * ukuran berkas, kapan diunduh, dan sidik jarinya.
 */
async function rincianArsipPerkara(nomorPerkaraMentah) {
  await ensureSchema();

  const nomorPerkara = cleanText(nomorPerkaraMentah);
  if (!nomorPerkara) return { nomorPerkara: "", dokumen: [] };

  const rows = await botDb.query(
    `SELECT d.document_key AS documentKey,
            d.judul_dokumen AS judulDokumen,
            d.jenis_dokumen AS jenisDokumen,
            d.peran_pengunggah AS peranPengunggah,
            d.status_verifikasi AS statusVerifikasi,
            d.diunggah_pada AS diunggahPada,
            d.tanggal_sidang AS tanggalSidang,
            d.agenda AS agenda,
            d.berkas_pdf AS berkasPdf,
            d.berkas_word AS berkasWord,
            d.diberitahukan_pada AS diberitahukanPada,
            d.terakhir_terlihat AS terakhirTerlihat,
            (SELECT COUNT(*) FROM aleta_bot_ecourt_files f
              WHERE f.document_key = d.document_key
                AND f.dihapus_retensi IS NOT NULL) AS dihapusRetensi,
            (SELECT SUM(f.ukuran_byte) FROM aleta_bot_ecourt_files f
              WHERE f.document_key = d.document_key) AS ukuranByte
       FROM aleta_bot_ecourt_documents d
      WHERE d.nomor_perkara = ?
      ORDER BY d.tanggal_sidang ASC, d.diunggah_pada ASC`,
    [nomorPerkara]
  );

  return {
    nomorPerkara,
    dokumen: (Array.isArray(rows) ? rows : []).map((row) => ({
      documentKey: cleanText(row.documentKey),
      judulDokumen: cleanText(row.judulDokumen),
      jenisDokumen: cleanText(row.jenisDokumen),
      peranPengunggah: cleanText(row.peranPengunggah),
      statusVerifikasi: cleanText(row.statusVerifikasi) || "belum",
      diunggahPada: botDb.fromMysqlDate(row.diunggahPada),
      tanggalSidang: botDb.fromMysqlDate(row.tanggalSidang),
      agenda: cleanText(row.agenda),
      adaPdf: Boolean(row.berkasPdf),
      adaWord: Boolean(row.berkasWord),
      ukuranByte: Number(row.ukuranByte) || 0,
      dihapusRetensi: Number(row.dihapusRetensi) > 0,
      diberitahukanPada: botDb.fromMysqlDate(row.diberitahukanPada),
      terakhirTerlihat: botDb.fromMysqlDate(row.terakhirTerlihat),
    })),
  };
}

/**
 * Apakah seluruh dokumen perkara ini sudah punya berkasnya?
 *
 * ============================================================================
 * MELEWATI PERKARA, BUKAN SEKADAR MELEWATI BERKAS
 * ============================================================================
 *
 * needsRecheck bekerja per DOKUMEN, dan itu baru diperiksa setelah halaman
 * perkaranya dibuka. Untuk penarikan menyeluruh - ratusan perkara - itu berarti
 * ratusan halaman tetap diminta ke server Mahkamah Agung hanya untuk menemukan
 * bahwa semua berkasnya memang sudah ada.
 *
 * Fungsi ini menjawab lebih awal, dari database sendiri: perkara yang seluruh
 * dokumennya sudah punya berkas, dan tidak ada yang menunggu verifikasi, tidak
 * perlu dibuka sama sekali.
 *
 * YANG TIDAK DILEWATI
 *
 * Perkara yang masih punya dokumen berstatus "belum" TETAP diperiksa. Dokumen
 * yang belum diverifikasi majelis masih dapat diganti pihak dengan unggahan
 * baru berjudul sama, dan melewatinya berarti melewatkan perbaikan itu.
 *
 * Perkara yang belum pernah tercatat sama sekali juga tidak pernah dilewati -
 * tidak adanya catatan bukan bukti tidak adanya dokumen.
 */
async function perkaraSudahLengkap(nomorPerkara) {
  await ensureSchema();

  const nomor = String(nomorPerkara || "").trim();
  if (!nomor) return false;

  const rows = await botDb.query(
    `SELECT
        COUNT(*) AS jumlah,
        SUM(CASE WHEN d.status_verifikasi = 'belum' THEN 1 ELSE 0 END) AS menunggu,
        SUM(CASE WHEN f.document_key IS NULL THEN 1 ELSE 0 END) AS tanpaBerkas
       FROM aleta_bot_ecourt_documents d
       LEFT JOIN (
         SELECT DISTINCT document_key FROM aleta_bot_ecourt_files WHERE jalur_berkas IS NOT NULL
       ) f ON f.document_key = d.document_key
      WHERE d.nomor_perkara = ?`,
    [nomor]
  );

  const baris = rows && rows[0];
  if (!baris) return false;

  const jumlah = Number(baris.jumlah) || 0;
  const menunggu = Number(baris.menunggu) || 0;
  const tanpaBerkas = Number(baris.tanpaBerkas) || 0;

  // Belum pernah tercatat: tidak adanya catatan bukan bukti tidak adanya dokumen.
  if (jumlah === 0) return false;

  return tanpaBerkas === 0 && menunggu === 0;
}

/**
 * Apakah dokumen ini perlu diperiksa ulang berkasnya?
 *
 * Dokumen yang BELUM diverifikasi majelis adalah yang paling mungkin diganti -
 * pihak memperbaiki lalu mengunggah ulang. Yang sudah diverifikasi jarang
 * berubah, jadi diperiksa jauh lebih jarang. Ini menargetkan risikonya tanpa
 * menarik ulang seluruh arsip tiap putaran.
 */
async function needsRecheck(documentKey, statusVerifikasi) {
  await ensureSchema();
  const rows = await botDb.query(
    `SELECT MAX(terakhir_diperiksa) AS terakhir FROM aleta_bot_ecourt_files WHERE document_key = ?`,
    [String(documentKey || "")]
  );
  const terakhir = rows[0] && rows[0].terakhir;
  if (!terakhir) return true; // belum punya berkas sama sekali

  const jamBelum = Number(process.env.ALETA_BOT_ECOURT_RECHECK_BELUM_JAM || 6);
  const jamSudah = Number(process.env.ALETA_BOT_ECOURT_RECHECK_SUDAH_JAM || 168);
  const ambangJam = String(statusVerifikasi || "belum") === "valid" ? jamSudah : jamBelum;

  const waktu = botDb.fromMysqlDate(terakhir);
  if (!waktu) return true;
  const jarakJam = (Date.now() - waktu.getTime()) / (60 * 60 * 1000);
  return jarakJam >= ambangJam;
}

/**
 * Menyimpan persetujuan saluran elektronik para pihak.
 *
 * Ditimpa apa adanya tiap penarikan: persetujuan dapat BERUBAH - pihak yang
 * semula menolak boleh berubah pikiran, dan sebaliknya. Menyimpan yang
 * pertama saja berarti panggilan disusun menurut keadaan yang sudah lewat.
 */
async function recordPersetujuanPihak(nomorPerkaraMentah, daftar) {
  await ensureSchema();
  const nomorPerkara = normalizeCaseNumber(nomorPerkaraMentah);
  if (!nomorPerkara || !Array.isArray(daftar) || daftar.length === 0) return { tersimpan: 0 };

  const sekarang = botDb.toMysqlDate(new Date());
  let tersimpan = 0;

  for (const pihak of daftar) {
    const nama = cleanText(pihak && pihak.nama);
    if (!nama) continue;

    await botDb.query(
      `INSERT INTO aleta_bot_ecourt_pihak
         (id, nomor_perkara, nama, peran, email, telp, persetujuan, terakhir_terlihat)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         peran = VALUES(peran),
         email = VALUES(email),
         telp = VALUES(telp),
         persetujuan = VALUES(persetujuan),
         terakhir_terlihat = VALUES(terakhir_terlihat)`,
      [
        kunciRingkas(nomorPerkara, nama),
        nomorPerkara,
        nama,
        cleanText(pihak.peran),
        cleanText(pihak.email),
        cleanText(pihak.telp),
        ["setuju", "tidak_setuju", "belum"].includes(pihak.persetujuan) ? pihak.persetujuan : "belum",
        sekarang,
      ]
    );
    tersimpan += 1;
  }

  return { tersimpan };
}

/** Menyimpan catatan panggilan elektronik (e-Summons). */
async function recordPanggilanElektronik(nomorPerkaraMentah, daftar) {
  await ensureSchema();
  const nomorPerkara = normalizeCaseNumber(nomorPerkaraMentah);
  if (!nomorPerkara || !Array.isArray(daftar) || daftar.length === 0) return { tersimpan: 0 };

  const sekarang = botDb.toMysqlDate(new Date());
  let tersimpan = 0;

  for (const panggilan of daftar) {
    const nama = cleanText(panggilan && panggilan.nama);
    if (!nama) continue;

    await botDb.query(
      `INSERT INTO aleta_bot_ecourt_panggilan
         (id, nomor_perkara, nama_pihak, email, jenis, judul_dokumen,
          tanggal_sidang, dikirim_pada, terakhir_terlihat)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         email = VALUES(email),
         jenis = VALUES(jenis),
         dikirim_pada = VALUES(dikirim_pada),
         terakhir_terlihat = VALUES(terakhir_terlihat)`,
      [
        kunciRingkas(
          nomorPerkara,
          nama,
          panggilan.tanggalSidang ? String(panggilan.tanggalSidang).slice(0, 10) : "",
          panggilan.judulDokumen
        ),
        nomorPerkara,
        nama,
        cleanText(panggilan.email),
        cleanText(panggilan.jenis),
        cleanText(panggilan.judulDokumen),
        panggilan.tanggalSidang ? botDb.toMysqlDate(new Date(panggilan.tanggalSidang)).slice(0, 10) : null,
        panggilan.dikirimPada ? botDb.toMysqlDate(new Date(panggilan.dikirimPada)) : null,
        sekarang,
      ]
    );
    tersimpan += 1;
  }

  return { tersimpan };
}

/** Persetujuan dan panggilan elektronik satu perkara. */
async function bacaPanggilanPerkara(nomorPerkaraMentah) {
  await ensureSchema();
  const nomorPerkara = normalizeCaseNumber(nomorPerkaraMentah);
  if (!nomorPerkara) return { pihak: [], panggilan: [] };

  const [pihak, panggilan] = await Promise.all([
    botDb.query(
      `SELECT nama, peran, email, telp, persetujuan, terakhir_terlihat AS terakhirTerlihat
         FROM aleta_bot_ecourt_pihak WHERE nomor_perkara = ? ORDER BY nama ASC`,
      [nomorPerkara]
    ),
    botDb.query(
      `SELECT nama_pihak AS namaPihak, email, jenis, judul_dokumen AS judulDokumen,
              tanggal_sidang AS tanggalSidang, dikirim_pada AS dikirimPada
         FROM aleta_bot_ecourt_panggilan WHERE nomor_perkara = ?
        ORDER BY tanggal_sidang ASC, dikirim_pada ASC`,
      [nomorPerkara]
    ),
  ]);

  return {
    pihak: (Array.isArray(pihak) ? pihak : []).map((baris) => ({
      nama: cleanText(baris.nama),
      peran: cleanText(baris.peran),
      email: cleanText(baris.email),
      telp: cleanText(baris.telp),
      persetujuan: cleanText(baris.persetujuan) || "belum",
      terakhirTerlihat: botDb.fromMysqlDate(baris.terakhirTerlihat),
    })),
    panggilan: (Array.isArray(panggilan) ? panggilan : []).map((baris) => ({
      namaPihak: cleanText(baris.namaPihak),
      email: cleanText(baris.email),
      jenis: cleanText(baris.jenis),
      judulDokumen: cleanText(baris.judulDokumen),
      tanggalSidang: botDb.fromMysqlDate(baris.tanggalSidang),
      dikirimPada: botDb.fromMysqlDate(baris.dikirimPada),
    })),
  };
}

module.exports = {
  VERIFICATION_STATUSES,
  GAGAL_AMBANG,
  GAGAL_JEDA_JAM,
  berkasDikarantina,
  buildDocumentKey,
  catatGagalBerkas,
  daftarBerkasBermasalah,
  dihapusKarenaRetensi,
  ensureSchema,
  resetGagalBerkas,
  finishSyncRun,
  jalurBerkasTercatat,
  getStats,
  hasDocument,
  listFiles,
  daftarArsipPerkara,
  rincianArsipPerkara,
  perkaraSudahLengkap,
  needsRecheck,
  recordFile,
  listByCase,
  listPendingNotification,
  markNotified,
  markSkipped,
  normalizeStatus,
  recordDocument,
  recordPanggilanElektronik,
  recordPersetujuanPihak,
  bacaPanggilanPerkara,
  startSyncRun,
  terakhirDiperiksaPerkara,
};
