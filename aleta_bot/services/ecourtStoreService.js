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
const logService = require("./logService");
const { cleanText, normalizeCaseNumber } = require("./ecourtTextService");
const ecourtDocumentService = require("./ecourtDocumentService");

/**
 * Membaca tabel berkas, dan MENCATAT bila kueri itu gagal.
 *
 * Dipakai kedua fungsi sumber-tunggal keadaan berkas. Keduanya dahulu berakhir
 * `.catch(() => [])`, sehingga satu nama kolom yang salah memulangkan "tidak
 * ada berkas" untuk seluruh perkara tanpa satu baris log - pola yang sama yang
 * menyembunyikan perkara_efiling.perkara_id selama berbulan-bulan.
 *
 * Galatnya dicatat lalu DILEMPARKAN ULANG. Pemanggil yang punya cadangan jujur
 * menangkapnya sendiri; yang tidak punya wajib gagal terlihat.
 */
async function bacaBerkasAtauCatat(sql, params, konteks = {}) {
  try {
    const rows = await botDb.query(sql, params);
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    const sebab = error && error.message ? error.message : String(error);
    void logService.logSystemEvent({
      eventType: "ecourt_keadaan_berkas_gagal",
      severity: "error",
      message:
        "Tabel berkas e-Court tidak terbaca; keadaan berkas TIDAK boleh dibaca sebagai 'tidak ada'.",
      metadata: { ...konteks, kode: (error && error.code) || "", sebab },
    });
    throw error;
  }
}

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

/**
 * ============================================================================
 * "MENUNGGU MAJELIS" - SATU DEFINISI UNTUK SEMUA LAYAR (5 Okt 2026, butir 32)
 * ============================================================================
 *
 * Verifikasi majelis di e-Court hanya ada pada DOKUMEN PERSIDANGAN e-litigasi
 * (jawaban, replik, duplik, kesimpulan, bukti persidangan) perkara GUGATAN dan
 * GUGATAN SEDERHANA. Diukur di server 5 Okt: dari 26 dokumen berstatus
 * "belum", 8 kesimpulan persidangan perkara gugatan (sah) dan 18 berkas
 * PENDAFTARAN (Surat Gugatan, Dokumen Gugatan, Surat Kuasa, Dokumen Bukti,
 * Dokumen Permohonan - tanpa tanggal unggah, tarikan 29 Agu sebelum aturan
 * "tidak_perlu" ada). Panel SIPP, ALETA e-Court, Status Perkara, dasbor
 * panitera, dan kesiapan sidang membaca kolom yang sama dengan cara sendiri-
 * sendiri - dan halaman daftar PERMOHONAN pun ikut "menunggu majelis".
 *
 * Kini satu definisi: status "belum" + alur gugatan/gugatan sederhana + bukan
 * berkas pendaftaran. Baris pendaftaran lama yang tertinggal "belum"
 * dirapikan sekali ke "tidak_perlu" (rapikanStatusPendaftaranLama).
 */
const POLA_ALUR_GUGATAN = /\/Pdt\.G(?:\.S)?\//i;
const POLA_BERKAS_PENDAFTARAN =
  /^(?:surat\s+gugatan|dokumen\s+gugatan|gugatan|surat\s+permohonan|dokumen\s+permohonan|permohonan|surat\s+kuasa|kuasa|dokumen\s+bukti|ktp|kartu\s+tanda\s+penduduk|kartu\s+keluarga|buku\s+nikah|kutipan\s+akta|akta|bukti)\b/i;
/** Untuk SQL MySQL (REGEXP, tanpa \b): judul berkas pendaftaran. */
const SQL_POLA_PENDAFTARAN =
  "^(surat gugatan|dokumen gugatan|gugatan|surat permohonan|dokumen permohonan|permohonan|surat kuasa|kuasa|dokumen bukti|ktp|kartu tanda penduduk|kartu keluarga|buku nikah|kutipan akta|akta|bukti)";

/** Alur perkara yang mengenal verifikasi majelis atas dokumen persidangan. */
function alurMenungguMajelis(nomorPerkara) {
  return POLA_ALUR_GUGATAN.test(String(nomorPerkara || ""));
}

/** Dokumen pendaftaran (tanpa tanggal unggah persidangan) - tidak pernah diverifikasi majelis. */
function berkasPendaftaran(judulDokumen, diunggahPada) {
  return !diunggahPada && POLA_BERKAS_PENDAFTARAN.test(String(judulDokumen || "").trim());
}

/** Satu dokumen sungguh menunggu verifikasi majelis? */
function dokumenMenungguMajelis(d) {
  if (!d) return false;
  const status = String(d.statusVerifikasi ?? d.status_verifikasi ?? "");
  if (status !== "belum") return false;
  if (!alurMenungguMajelis(d.nomorPerkara ?? d.nomor_perkara)) return false;
  return !berkasPendaftaran(d.judulDokumen ?? d.judul_dokumen, d.diunggahPada ?? d.diunggah_pada);
}

/** Potongan WHERE untuk tabel aleta_bot_ecourt_documents (alias opsional). */
function sqlMenungguMajelis(alias = "") {
  const a = alias ? `${alias}.` : "";
  return (
    `(${a}status_verifikasi = 'belum'` +
    ` AND (${a}nomor_perkara LIKE '%/Pdt.G/%' OR ${a}nomor_perkara LIKE '%/Pdt.G.S/%')` +
    ` AND NOT (${a}diunggah_pada IS NULL AND LOWER(TRIM(${a}judul_dokumen)) REGEXP '${SQL_POLA_PENDAFTARAN}'))`
  );
}

/**
 * Baris berkas pendaftaran yang tersimpan "belum" sebelum aturan tidak_perlu
 * ada. Aman diulang (idempoten); dijalankan sekali per proses sesudah skema.
 */
async function rapikanStatusPendaftaranLama() {
  try {
    await botDb.query(
      `UPDATE aleta_bot_ecourt_documents
          SET status_verifikasi = 'tidak_perlu'
        WHERE status_verifikasi = 'belum'
          AND diunggah_pada IS NULL
          AND LOWER(TRIM(judul_dokumen)) REGEXP '${SQL_POLA_PENDAFTARAN}'`
    );
  } catch {
    /* tidak mengganggu skema; pembaca tetap memakai dokumenMenungguMajelis */
  }
}

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

    // ------------------------------------------------------------------
    // 404 BUKAN KEGAGALAN KITA, DAN BUKAN PULA KEADAAN SEMENTARA
    // ------------------------------------------------------------------
    //
    // gagal_beruntun mengurus dokumen yang GAGAL kita ambil: tiga kali gagal,
    // istirahat sehari, lalu dicoba lagi. Itu benar untuk jaringan yang putus
    // dan untuk alamat yang belum dikenali bentuknya.
    //
    // 404 lain sama sekali. e-Court MENJAWAB, dan jawabannya "berkas ini tidak
    // saya sediakan" - untuk KTP hampir selalu begitu, dan tetap begitu tiap
    // kali ditanya. Diukur 23 Sep 2026: 145 dari 168 galat penarikan berbunyi
    // HTTP 404. Selama jawabannya tidak dicatat, dokumen itu tidak pernah punya
    // baris berkas, perkaranya tidak pernah terhitung lengkap, dan halamannya
    // dibuka ulang setiap putaran - selamanya.
    await botDb.addColumnIfMissing(
      "aleta_bot_ecourt_documents",
      "tidak_tersedia_pada",
      "DATETIME NULL"
    );
    await botDb.addColumnIfMissing(
      "aleta_bot_ecourt_documents",
      "tidak_tersedia_sebab",
      "VARCHAR(191) NOT NULL DEFAULT ''"
    );

    schemaReady = true;
    // Butir 32: status pendaftaran lama yang tertinggal "belum".
    await rapikanStatusPendaftaranLama();
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
              -- Agenda dan tanggal sidang TIDAK dikosongkan oleh sinkronisasi
              -- yang gagal membacanya. Dulu keduanya ditimpa apa adanya:
              -- satu penarikan yang tidak berhasil mengurai kepala blok
              -- menghapus tanggal yang sudah benar, dan menghapusnya diam-diam.
              -- Perlakuannya kini sama dengan berkas_pdf dan perkara_id di
              -- bawah - yang sudah terbukti hanya diganti oleh yang terbukti.
              agenda = CASE WHEN ? = '' THEN agenda ELSE ? END,
              tanggal_sidang = COALESCE(?, tanggal_sidang),
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
  // 12 Okt (KTP-PIHAK): foto KTP ("gambar") TIDAK dicerminkan ke kolom lama - kode lama menganggap
  // isinya PDF/Word (lampiran WhatsApp, menu verifikasi); foto dibaca lewat ktpPihakService.
  if (String(format) !== "gambar") {
    const kolom = String(format) === "word" ? "berkas_word" : "berkas_pdf";
    await botDb.query(
      `UPDATE aleta_bot_ecourt_documents SET ${kolom} = ?, updated_at = ? WHERE document_key = ?`,
      [String(jalurBerkas || ""), sekarang, String(documentKey || "")]
    );
  }

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
 * ============================================================================
 * DOKUMEN YANG e-COURT SENDIRI TIDAK MENYEDIAKAN BERKASNYA
 * ============================================================================
 *
 * Berapa lama penandanya berlaku sebelum ditanyakan sekali lagi. Bukan
 * selamanya: e-Court dapat mengunggah berkasnya kapan saja tanpa memberi tahu
 * siapa pun, dan berkas yang dibutuhkan hakim tidak boleh menjadi berkas yang
 * tidak pernah ditanyakan lagi. Tiga puluh hari berarti satu dokumen ditanyakan
 * dua belas kali setahun, bukan dua ratus kali - dengan putaran dua jam sekali,
 * pukul 07-17, itulah selisihnya.
 */
const TIDAK_TERSEDIA_JEDA_HARI = Number(
  process.env.ALETA_BOT_ECOURT_TIDAK_TERSEDIA_JEDA_HARI || 30
);

/**
 * Menandai dokumen yang e-Court sendiri tidak menyediakan berkasnya.
 *
 * gagal_beruntun sengaja dinolkan bersamaan: ini BUKAN kegagalan yang perlu
 * dihitung, dan membiarkannya menumpuk membuat dokumen itu terbaca sebagai
 * masalah penarikan di layar admin - padahal tidak ada yang dapat diperbaiki.
 */
async function tandaiTidakTersedia(documentKey, sebab) {
  await ensureSchema();
  await botDb
    .query(
      `UPDATE aleta_bot_ecourt_documents
          SET tidak_tersedia_pada = ?, tidak_tersedia_sebab = ?,
              gagal_beruntun = 0, gagal_sebab = '', gagal_terakhir = NULL
        WHERE document_key = ?`,
      [botDb.toMysqlDate(new Date()), cleanText(sebab).slice(0, 191), String(documentKey || "")]
    )
    .catch(() => {});
}

/**
 * Melupakan penandanya supaya dicoba lagi.
 *
 * Dipanggil dua kali: otomatis ketika berkasnya ternyata berhasil diambil, dan
 * atas permintaan petugas dari layar - sebab petugas kadang TAHU berkasnya baru
 * diunggah, dan menunggu tiga puluh hari tidak masuk akal.
 */
async function lupakanTidakTersedia({ documentKey = "", semua = false } = {}) {
  await ensureSchema();
  if (!semua && !documentKey) return { diubah: 0 };
  const hasil = await botDb.query(
    semua
      ? `UPDATE aleta_bot_ecourt_documents
            SET tidak_tersedia_pada = NULL, tidak_tersedia_sebab = ''
          WHERE tidak_tersedia_pada IS NOT NULL`
      : `UPDATE aleta_bot_ecourt_documents
            SET tidak_tersedia_pada = NULL, tidak_tersedia_sebab = ''
          WHERE document_key = ?`,
    semua ? [] : [String(documentKey)]
  );
  return { diubah: Number(hasil && hasil.affectedRows) || 0 };
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
 * ============================================================================
 * SATU-SATUNYA JAWABAN ATAS "DOKUMEN INI PUNYA BERKASNYA?"
 * ============================================================================
 *
 * Sampai 25 Sep 2026 pertanyaan ini dijawab LIMA potong kode dengan definisi
 * berbeda: rincianArsipPerkara (files + bukti cakram), sippKonteksService.
 * dokumenPerkara (files ATAU cermin), daftarArsipPerkara (cermin saja, dan
 * `IS NOT NULL` menghitung string kosong sebagai "ada"), kendaliBerkasService.
 * inventarisAleta (cermin saja tetapi string kosong dihitung kosong), dan
 * getBerkas (files dulu, cermin cadangan). Akibatnya satu dokumen yang sama
 * dinyatakan ADA di ekstensi SIPP dan TIDAK ADA di portal, tombol Tarik
 * ditawarkan untuk perkara yang jembatan anggap sudah lengkap lalu dilewati
 * diam-diam, dan tombol ZIP disembunyikan untuk perkara yang berkasnya utuh.
 *
 * Kolom cermin berkas_pdf/berkas_word TIDAK dipakai di sini. Ia hanya terisi
 * saat satu berkas BARU tersimpan - recordFile keluar lebih awal dengan
 * { sudahAda: true } untuk berkas yang sidik jarinya sama, tanpa menyentuh
 * cermin - dan di-NULL-kan saat retensi walau sidik jari lain masih hidup.
 * Terukur di peladen: 394 dokumen, cermin terisi 23 pdf dan 8 word, sementara
 * aleta_bot_ecourt_files mencatat 400 berkas.
 *
 * Yang dipulangkan per document_key:
 *   pdf / word : nama berkas bila TERCATAT dan TERBACA di cakram
 *   hilang     : berapa berkas tercatat tetapi lenyap dari cakram
 *   retensi    : berapa berkas sengaja dihapus karena masa simpan
 *
 * "hilang" dan "retensi" sengaja dipisah: yang pertama harus ditarik ulang,
 * yang kedua TIDAK boleh ditarik ulang.
 *
 * ============================================================================
 * "TIDAK TERBACA" BUKAN "TIDAK ADA"
 * ============================================================================
 *
 * Sampai 25 Sep 2026 kueri di bawah berakhir `.catch(() => [])` - persis pola
 * yang menyembunyikan kolom perkara_efiling.perkara_id yang tidak ada selama
 * berbulan-bulan. Terukur dengan membuat botDb.query melempar: fungsi ini
 * memulangkan Map berukuran 0, dan pemanggilnya membacanya sebagai "tidak ada
 * berkas". Satu nama kolom yang salah karena itu melenyapkan SELURUH tombol
 * unduh dari Status Perkara, Antrian Sidang, dan Kendali Berkas - beserta
 * tombol ZIP-nya - tanpa satu baris log.
 *
 * Kini galatnya DICATAT lalu DILEMPARKAN ULANG. Melemparkan, bukan memulangkan
 * peta kosong: pemanggil yang punya cadangan yang jujur boleh menangkapnya
 * (lihat daftarArsipPerkara, yang turun ke angka TERCATAT), dan yang tidak
 * punya cadangan lebih baik menampilkan galat daripada berbohong "tidak ada".
 */
async function keadaanBerkasPerkara(nomorPerkaraMentah) {
  await ensureSchema();
  const peta = new Map();
  const nomorPerkara = normalizeCaseNumber(nomorPerkaraMentah);
  if (!nomorPerkara) return peta;

  const rows = await bacaBerkasAtauCatat(
    `SELECT document_key AS documentKey, format, jalur_berkas AS jalur,
            dihapus_retensi AS dihapusRetensi
       FROM aleta_bot_ecourt_files
      WHERE nomor_perkara = ?`,
    [nomorPerkara],
    { fungsi: "keadaanBerkasPerkara", nomorPerkara }
  );

  for (const berkas of Array.isArray(rows) ? rows : []) {
    const kunci = cleanText(berkas.documentKey);
    const jenis = cleanText(berkas.format).toLowerCase();
    if (!kunci || (jenis !== "pdf" && jenis !== "word")) continue;

    const catatan = peta.get(kunci) || { pdf: null, word: null, hilang: 0, retensi: 0 };
    if (berkas.dihapusRetensi) {
      catatan.retensi += 1;
    } else {
      const periksa = ecourtDocumentService.describeEcourtDocument(berkas.jalur);
      if (periksa.ok) catatan[jenis] = periksa.fileName;
      else catatan.hilang += 1;
    }
    peta.set(kunci, catatan);
  }

  return peta;
}

/**
 * Jawaban yang sama untuk sekumpulan perkara sekaligus - dipakai TABEL.
 *
 * Bedanya dengan ringkasKekuranganBerkas di bawah hanya satu, tetapi menentukan:
 * yang ini MEMBUKTIKAN ke cakram, satu panggilan sistem berkas per berkas.
 * Itu benar untuk paling banyak 500 baris yang digambar satu layar, dan salah
 * untuk ribuan perkara yang disaring penarik sebelum satu halaman pun dibuka.
 */
async function keadaanBerkasBanyakPerkara(daftarNomor = []) {
  await ensureSchema();
  const hasil = new Map();
  const bersih = [...new Set((daftarNomor || []).map(normalizeCaseNumber).filter(Boolean))];
  if (bersih.length === 0) return hasil;

  for (const nomor of bersih) {
    hasil.set(nomor, { adaPdf: 0, adaWord: 0, hilang: 0, retensi: 0 });
  }

  // Dipotong 200 supaya daftar IN tidak melewati batas paket MySQL.
  for (let i = 0; i < bersih.length; i += 200) {
    const kelompok = bersih.slice(i, i + 200);
    const isian = kelompok.map(() => "?").join(", ");
    // Dicatat lalu dilemparkan ulang, tidak ditelan - lihat catatan panjang
    // pada keadaanBerkasPerkara. Peta yang dipulangkan di sini sudah berisi
    // nol untuk seluruh perkara, sehingga galat yang ditelan dahulu terbaca
    // sebagai "semua perkara tidak punya berkas" - jawaban paling meyakinkan
    // dan paling salah yang dapat diberikan.
    const rows = await bacaBerkasAtauCatat(
      `SELECT nomor_perkara AS nomorPerkara, format, jalur_berkas AS jalur,
              dihapus_retensi AS dihapusRetensi
         FROM aleta_bot_ecourt_files
        WHERE nomor_perkara IN (${isian})`,
      kelompok,
      { fungsi: "keadaanBerkasBanyakPerkara", jumlahPerkara: kelompok.length }
    );

    for (const berkas of Array.isArray(rows) ? rows : []) {
      const ringkas = hasil.get(normalizeCaseNumber(berkas.nomorPerkara));
      if (!ringkas) continue;
      const jenis = cleanText(berkas.format).toLowerCase();

      if (berkas.dihapusRetensi) {
        ringkas.retensi += 1;
        continue;
      }
      const periksa = ecourtDocumentService.describeEcourtDocument(berkas.jalur);
      if (!periksa.ok) {
        ringkas.hilang += 1;
        continue;
      }
      if (jenis === "pdf") ringkas.adaPdf += 1;
      if (jenis === "word") ringkas.adaWord += 1;
    }
  }

  return hasil;
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
/**
 * ============================================================================
 * NOMOR REGISTER e-COURT - SATU TULISAN, DIPAKAI DI SELECT DAN DI ORDER BY
 * ============================================================================
 *
 * Kolom "Register e-Court" MEMATIKAN panel Kendali Berkas sampai 25 Sep 2026.
 * susunUrutan menaruh ALIAS AGREGAT di dalam ekspresi bendera-kosong, dan
 * MariaDB menolaknya. Terukur atas skema aleta_bot setempat (10.4.28), tabel
 * ada tetapi 0 baris - galatnya galat PENGURAIAN, jadi ia menyala walau
 * tabelnya kosong:
 *
 *   ORDER BY dokumen DESC, nomorRegister ASC                     -> LOLOS
 *   ORDER BY (nomorRegister IS NULL OR nomorRegister = '') ASC   -> ERROR 1247
 *       (42S22) Reference 'nomorRegister' not supported (reference to group function)
 *   ORDER BY (MAX(nomor_register) IS NULL OR MAX(...) = '') ASC  -> LOLOS
 *
 * Artinya alias agregat boleh menjadi SELURUH ruas ORDER BY tetapi tidak boleh
 * berada DI DALAM ekspresi. Bendera "kosong selalu di bawah" adalah ekspresi,
 * jadi kunci "register" harus memakai ekspresi agregatnya sendiri.
 *
 * Diukur atas ketujuh kunci KOLOM_URUT_ARSIP, dua arah masing-masing: hanya
 * "register" yang melempar, 12 dari 14 panggilan lolos. Enam kunci lain aman
 * sebab bagiannya menjadi SELURUH ruas - lihat uji arsip-berkas-urut.test.ts
 * yang kini benar-benar MENJALANKAN keempat belas kueri itu.
 *
 * Ditulis SEKALI di sini karena dipakai dua tempat - SELECT dan ORDER BY.
 * Dua tulisan terpisah berarti kolomnya dapat diurut menurut nilai yang bukan
 * nilai yang digambar, dan pergeseran itu tidak menghasilkan satu galat pun.
 */
const EKSPRESI_REGISTER = "MAX(COALESCE(NULLIF(d.nomor_register, ''), d.registrasi_ecourt))";

/**
 * ============================================================================
 * SATU ARTI UNTUK "DOKUMEN INI KEKURANGAN BERKAS"
 * ============================================================================
 *
 * Sampai 25 Sep 2026 ada DUA arti yang berselisih. daftarArsipPerkara (tabel
 * Kendali Berkas) dan ringkasKekuranganBerkas (yang dipakai perkaraSudahLengkap
 * dan penyaring jembatan) menjawab angka berbeda untuk BARIS YANG SAMA.
 * Terukur atas baris semaian di aleta_bot setempat:
 *
 *   dokumen tanpa berkas, tidak_tersedia_pada 60 hari lalu:
 *       daftarArsipPerkara tanpaBerkas=0   ringkasKekuranganBerkas tanpaBerkas=1
 *   dokumen dengan dihapus_retensi TERISI sementara jalur_berkas masih terisi:
 *       daftarArsipPerkara tanpaBerkas=1   ringkasKekuranganBerkas tanpaBerkas=0
 *
 * Akibat selisih pertama: layar berkata "Lengkap" sementara jembatan membuka
 * perkaranya terus tiap putaran, sebab jeda 30 harinya sudah lewat dan e-Court
 * memang patut ditanya sekali lagi.
 *
 * Dan KEDUANYA salah untuk berkas yang dihapus masa simpan. Pembersih retensi
 * (ecourtArsipService.js:356) menyetel jalur_berkas = '' BERSAMAAN dengan
 * dihapus_retensi, sehingga saringan lama `jalur_berkas <> ''` membuang
 * barisnya dan dokumennya terbaca "belum ada" - kebalikan dari yang dikatakan
 * komentar ringkasKekuranganBerkas sendiri. Terukur: dokumen retensi murni
 * menghasilkan tanpaBerkas=1 di KEDUA fungsi, dan perkaraSudahLengkap=false.
 * Rantainya: ecourtSasaranService menjadikannya sasaran "berkas_belum_ada",
 * run.js mengunduh isinya, lalu menolak menulisnya karena dihapusKarenaRetensi
 * - bytenya diunduh ulang dari server Mahkamah Agung lalu dibuang, selamanya.
 *
 * ARTI YANG DIPILIH: dokumen kekurangan berkas bila TIDAK ADA satu pun baris
 * berkas yang (i) jalurnya terisi atau (ii) sengaja dihapus masa simpan, DAN
 * dokumen itu tidak sedang dalam jeda "e-Court menjawab tidak menyediakannya".
 *
 * Dua sebabnya:
 *   - berkas retensi TIDAK boleh ditarik ulang, jadi menyebutnya kurang berarti
 *     meminta pekerjaan yang kodenya sendiri menolak mengerjakan;
 *   - jeda tidak_tersedia memang harus HABIS. Yang tidak pernah kedaluwarsa
 *     bukan lagi jeda, melainkan penghapusan - dan berkas yang dibutuhkan hakim
 *     tidak boleh menjadi berkas yang tidak pernah ditanyakan lagi.
 */
const SUMBER_SUDAH_BERBERKAS = `
         SELECT DISTINCT document_key
           FROM aleta_bot_ecourt_files
          WHERE (jalur_berkas IS NOT NULL AND jalur_berkas <> '')
             OR dihapus_retensi IS NOT NULL`;

/**
 * Dokumen yang e-Court jawab tidak menyediakannya, dan jedanya BELUM habis.
 * Satu tanda `?` - jumlah harinya selalu diikat sebagai parameter, tidak pernah
 * disisipkan sebagai teks.
 */
const EKSPRESI_DALAM_JEDA = `(d.tidak_tersedia_pada IS NOT NULL
                        AND d.tidak_tersedia_pada >= DATE_SUB(NOW(), INTERVAL ? DAY))`;

/**
 * Satu-satunya ekspresi "dokumen ini kekurangan berkas".
 * `alias` adalah nama LEFT JOIN atas SUMBER_SUDAH_BERBERKAS di kueri pemanggil.
 */
function ekspresiTanpaBerkas(alias) {
  return `CASE WHEN ${alias}.document_key IS NULL
                AND NOT ${EKSPRESI_DALAM_JEDA}
               THEN 1 ELSE 0 END`;
}

/**
 * ============================================================================
 * KOLOM YANG DAPAT DIURUTKAN - NILAINYA, BUKAN TULISANNYA
 * ============================================================================
 *
 * Kepala kolom Kendali Berkas menekan salah satu kunci di bawah. Yang mengurut
 * PELADEN, bukan peramban: jawabannya dipotong (paling banyak 500 baris), dan
 * mengurut di peramban berarti mengurut potongannya - "belum ada terbanyak"
 * akan menunjuk yang terbanyak DI ANTARA YANG TERBAWA.
 *
 * NOMOR PERKARA DIURUT SEBAGAI ANGKA, DAN TAHUNNYA LEBIH DULU
 * --------------------------------------------------------------------------
 * "ORDER BY nomor_perkara" - yang dipakai sebelum ini - mengurut menurut huruf.
 * Diukur atas 10.120 perkara SIPP PA Donggala:
 *
 *     1/Pdt.G/2026, 10/Pdt.G/2026, 100/, 101/, ... , 109/, 11/, 110/ ...
 *
 * Perkara 2 berada 99 baris di bawah perkara 1, dan panitera yang mencari
 * perkara 419 menyusurinya satu per satu. Tahunnya pun tidak dipedulikan:
 * 10/Pdt.G/2016 mendahului 9/Pdt.G/2026.
 *
 * Karena itu yang diurut TAHUN lalu NOMOR URUT, keduanya sebagai angka. Tahun
 * diambil dari ruas KETIGA - bukan "dua dari belakang" - supaya tetap benar
 * bila suatu hari nomornya tersimpan tanpa ekor "/PA.Dgl". Diperiksa atas
 * seluruh 10.120 nomor: 10.120 terbaca tahunnya, 10.120 terbaca nomor urutnya
 * (terbesar 833), dan tidak satu pun bernomor kurang dari 4 ruas.
 */
const KOLOM_URUT_ARSIP = {
  perkara: {
    bagian: [
      "CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(d.nomor_perkara, '/', 3), '/', -1) AS UNSIGNED)",
      "CAST(SUBSTRING_INDEX(d.nomor_perkara, '/', 1) AS UNSIGNED)",
    ],
  },
  // Ekspresi agregatnya, BUKAN alias "nomorRegister": bendera kosong adalah
  // ekspresi, dan alias agregat di dalam ekspresi menjawab ERROR 1247.
  register: { bagian: [EKSPRESI_REGISTER], teks: true },
  dokumen: { bagian: ["dokumen"] },
  berkasAda: { bagian: ["berkasAda"] },
  belumAda: { bagian: ["tanpaBerkas"] },
  keadaan: { bagian: ["menungguMajelis"] },
  terakhir: { bagian: ["MAX(d.terakhir_terlihat)"] },
};

/**
 * Nama urutan LAMA dari <select> yang sudah ditiadakan.
 *
 * Dipetakan, bukan diabaikan: bot dan portal tidak selalu dipasang pada detik
 * yang sama, dan satu tab yang tertinggal terbuka semalaman masih mengirim
 * "terlama". Tanpa peta ini ia diam-diam berubah arti menjadi "terbaru" -
 * urutan yang persis terbalik dari yang diminta.
 */
const URUTAN_LAMA = {
  terbaru: { kunci: "terakhir", arah: "turun" },
  terlama: { kunci: "terakhir", arah: "naik" },
  perkara: { kunci: "perkara", arah: "naik" },
  belumTerbanyak: { kunci: "belumAda", arah: "turun" },
  dokumenTerbanyak: { kunci: "dokumen", arah: "turun" },
  menungguTerbanyak: { kunci: "keadaan", arah: "turun" },
};

/**
 * Menyusun ORDER BY dari kunci dan arah.
 *
 * Tidak satu huruf pun dari pemanggil masuk ke SQL: kuncinya dicari di daftar
 * tetap di atas, dan arahnya hanya dapat menjadi ASC atau DESC. ORDER BY tidak
 * dapat dijadikan parameter kueri, sehingga menyusunnya dari teks yang dikirim
 * pemanggil membuka jalan penyisipan SQL.
 *
 * Yang KOSONG selalu di bawah, berapa pun arahnya - kaidah yang sama dengan
 * tabel-kendali di portal. MySQL menaruh NULL dan teks kosong di PUNCAK saat
 * menaik; tanpa bendera kosong, mengurut Register e-Court menaik menumpuk baris
 * tanpa register di atas, dan yang dicari justru yang terisi.
 *
 * BENDERA KOSONG MENUNTUT EKSPRESI, DAN ALIAS AGREGAT TIDAK BOLEH DI DALAMNYA.
 * Kolom ber-`teks: true` karena itu WAJIB menuliskan ekspresi agregatnya
 * sendiri di `bagian`, bukan alias SELECT-nya - lihat EKSPRESI_REGISTER dan
 * ERROR 1247 yang terukur di sana. Kolom tanpa `teks` bebas memakai alias,
 * sebab bagiannya menjadi SELURUH ruas ORDER BY.
 *
 * Pengikat terakhirnya nomor perkara, SELALU. Dua baris yang nilainya sama pada
 * daftar berbatas harus muncul pada urutan yang sama tiap kali dimuat - tanpa
 * itu menekan "Perbarui Data" mengacak barisnya sendiri, dan yang ada di baris
 * ke-500 berpindah masuk-keluar tanpa sebab.
 */
function susunUrutan(kunci, arah) {
  const kolom = KOLOM_URUT_ARSIP[String(kunci)] || KOLOM_URUT_ARSIP.terakhir;
  const arahSql = String(arah) === "naik" ? "ASC" : "DESC";

  const bagian = [];
  for (const nilai of kolom.bagian) {
    if (kolom.teks) bagian.push(`(${nilai} IS NULL OR ${nilai} = '') ASC`);
    bagian.push(`${nilai} ${arahSql}`);
  }
  bagian.push("d.nomor_perkara ASC");
  return bagian.join(", ");
}

async function daftarArsipPerkara({
  cari = "",
  hanyaBelumLengkap = false,
  urutkan = "terakhir",
  // Kosong berarti "nama urutan lama" - lihat URUTAN_LAMA.
  arah = "",
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
    syarat.push("(d.nomor_perkara LIKE ? OR d.nomor_register LIKE ? OR d.registrasi_ecourt LIKE ?)");
    nilai.push(`%${kataCari}%`, `%${kataCari}%`, `%${kataCari}%`);
  }

  const where = syarat.length > 0 ? `WHERE ${syarat.join(" AND ")}` : "";

  // Urutan dipilih dari daftar TETAP, tidak pernah disusun dari masukan - lihat
  // susunUrutan. Pemanggil lama yang belum mengirim `arah` diterjemahkan dari
  // nama urutannya, bukan dijatuhkan ke bawaan.
  const lama = !String(arah) ? URUTAN_LAMA[String(urutkan)] : null;
  const urutan = lama ? susunUrutan(lama.kunci, lama.arah) : susunUrutan(urutkan, arah);

  // --------------------------------------------------------------------
  // ADA-TIDAKNYA BERKAS DIBACA DARI CATATAN BERKAS, BUKAN DARI CERMIN
  //
  // Kolom cermin berkas_pdf/berkas_word di tabel dokumen BASI - terukur 23 dan
  // 8 terisi dari 394 dokumen, sementara aleta_bot_ecourt_files mencatat
  // seluruh 400 berkas. rincianArsipPerkara sudah pindah ke files sejak lama;
  // tabel utama ini tertinggal, sehingga barisnya berkata "belum ada" untuk
  // perkara yang rinciannya menawarkan tombol unduh.
  //
  // "Belum ada" TIDAK lagi disusun di sini. Ia memakai ekspresiTanpaBerkas -
  // ekspresi yang sama yang dipakai ringkasKekuranganBerkas, karena itu pula
  // yang dipakai jembatan memutuskan perkara mana yang dibuka. Sebelumnya
  // keduanya berselisih: dokumen ber-tidak_tersedia_pada 60 hari lalu terhitung
  // 0 di sini dan 1 di sana, sehingga layar berkata "Lengkap" sementara
  // jembatan membukanya terus tiap putaran. Lihat catatan panjang pada
  // SUMBER_SUDAH_BERBERKAS beserta angka ukurnya.
  //
  // Jumlah dokumen ber-tidak_tersedia_pada tetap dilaporkan tersendiri lewat
  // kolom tidakTersedia - dipisahkan, bukan disembunyikan.
  //
  // Yang dihitung di sini TERCATAT, bukan terbukti ada di cakram. Pembuktian ke
  // cakram dikerjakan keadaanBerkasBanyakPerkara di bawah, sesudah barisnya
  // terpotong - untuk 500 baris itu ratusan panggilan stat(), bukan ribuan
  // seperti bila dikerjakan atas seluruh arsip.
  // --------------------------------------------------------------------
  const kurang = ekspresiTanpaBerkas("k");

  const having = hanyaBelumLengkap ? `HAVING SUM(${kurang}) > 0` : "";

  // b menjawab "berkas mana yang dapat DIUNDUH" - karena itu berkas retensi
  // dibuang di sini: jalurnya sudah kosong dan tidak boleh ditarik ulang.
  // k menjawab "dokumen ini masih kekurangan berkas?" - pertanyaan lain, dan
  // di sana berkas retensi justru terhitung SUDAH ada.
  const sumberBerkas = `
       LEFT JOIN (
         SELECT document_key,
                SUM(CASE WHEN LOWER(format) = 'pdf'  AND jalur_berkas <> '' THEN 1 ELSE 0 END) AS adaPdf,
                SUM(CASE WHEN LOWER(format) = 'word' AND jalur_berkas <> '' THEN 1 ELSE 0 END) AS adaWord
           FROM aleta_bot_ecourt_files
          WHERE dihapus_retensi IS NULL
          GROUP BY document_key
       ) b ON b.document_key = d.document_key
       LEFT JOIN (${SUMBER_SUDAH_BERBERKAS}
       ) k ON k.document_key = d.document_key`;

  // Urutan parameter mengikuti urutan tanda `?` MUNCUL di dalam SQL:
  // SUM(kurang) di SELECT, lalu syarat WHERE, lalu SUM(kurang) di HAVING,
  // lalu LIMIT/OFFSET. Salah urut di sini membuat jeda hari menjadi kata cari.
  const nilaiBaris = [
    TIDAK_TERSEDIA_JEDA_HARI,
    ...nilai,
    ...(having ? [TIDAK_TERSEDIA_JEDA_HARI] : []),
    Math.min(Math.max(Number(batas) || 100, 1), 500),
    Math.max(Number(mulai) || 0, 0),
  ];

  const rows = await botDb.query(
    `SELECT d.nomor_perkara AS nomorPerkara,
            MAX(d.perkara_id) AS perkaraId,
            ${EKSPRESI_REGISTER} AS nomorRegister,
            COUNT(*) AS dokumen,
            SUM(CASE WHEN COALESCE(b.adaPdf, 0) > 0 THEN 1 ELSE 0 END) AS adaPdf,
            SUM(CASE WHEN COALESCE(b.adaWord, 0) > 0 THEN 1 ELSE 0 END) AS adaWord,
            -- Yang digambar kolom "Berkas ada" adalah jumlah keduanya, dan yang
            -- diurut harus jumlah itu pula. Dokumen yang punya PDF dan Word
            -- sekaligus memang terhitung dua kali - itu hitungan BERKAS, bukan
            -- hitungan dokumen, dan kolomnya memang bernama demikian.
            SUM(CASE WHEN COALESCE(b.adaPdf, 0) > 0 THEN 1 ELSE 0 END)
              + SUM(CASE WHEN COALESCE(b.adaWord, 0) > 0 THEN 1 ELSE 0 END) AS berkasAda,
            SUM(${kurang}) AS tanpaBerkas,
            -- SELURUH dokumen yang pernah dijawab "tidak saya sediakan", jedanya
            -- habis atau belum. Sengaja BEDA dari ruas senama pada
            -- ringkasKekuranganBerkas, yang hanya menghitung yang masih dalam
            -- jeda: yang ini dibaca panitera sebagai "berapa yang e-Court tolak",
            -- yang itu dibaca jembatan sebagai "berapa yang belum waktunya
            -- ditanya lagi". Nama sama, pertanyaan lain - jangan disatukan
            -- tanpa mengubah kedua pemakainya.
            SUM(CASE WHEN d.tidak_tersedia_pada IS NOT NULL THEN 1 ELSE 0 END) AS tidakTersedia,
            SUM(CASE WHEN d.status_verifikasi = 'belum' THEN 1 ELSE 0 END) AS menungguMajelis,
            SUM(CASE WHEN d.status_verifikasi = 'valid' THEN 1 ELSE 0 END) AS sudahValid,
            SUM(CASE WHEN d.status_verifikasi = 'tidak_perlu' THEN 1 ELSE 0 END) AS berkasPendaftaran,
            -- Berkas yang sengaja dihapus karena masa simpan. Dipisahkan dari
            -- "belum ada": yang ini TIDAK perlu ditarik ulang.
            (SELECT COUNT(*) FROM aleta_bot_ecourt_files rf
              WHERE rf.nomor_perkara = d.nomor_perkara
                AND rf.dihapus_retensi IS NOT NULL) AS dihapusRetensi,
            MAX(d.terakhir_terlihat) AS terakhirTerlihat
       FROM aleta_bot_ecourt_documents d
       ${sumberBerkas}
       ${where}
      GROUP BY d.nomor_perkara
      ${having}
      ORDER BY ${urutan}
      LIMIT ? OFFSET ?`,
    nilaiBaris
  );

  const total = await botDb.query(
    `SELECT COUNT(*) AS jumlah FROM (
       SELECT d.nomor_perkara
         FROM aleta_bot_ecourt_documents d
         ${sumberBerkas}
         ${where}
        GROUP BY d.nomor_perkara
        ${having}
     ) AS t`,
    // Kueri ini tidak punya SUM(kurang) di SELECT-nya, jadi tanda `?` untuk
    // jeda hari hanya ada bila HAVING dipakai.
    [...nilai, ...(having ? [TIDAK_TERSEDIA_JEDA_HARI] : [])]
  );

  // Catatan berkas saja tidak cukup: arsip pernah lenyap seluruhnya karena
  // volume Docker belum di-mount, dan barisnya tetap ada. Tombol Tarik dan
  // tombol ZIP di layar digantungkan pada angka ini, jadi angkanya harus
  // menyatakan berkas yang benar-benar dapat dibuka.
  //
  // BILA PEMBUKTIAN ITU SENDIRI TIDAK TERBACA, jangan menjawab nol. Nol di sini
  // berarti "tidak satu perkara pun punya berkas", dan layar menyembunyikan
  // SELURUH tombol unduh dan ZIP karenanya - dari satu kueri yang gagal.
  // Cadangannya angka TERCATAT: lebih longgar daripada bukti cakram, tetapi ia
  // jujur tentang apa yang diketahui. Galatnya sudah dicatat di dalam
  // keadaanBerkasBanyakPerkara; di sini hanya ditandai supaya "berkas hilang"
  // tidak ikut dikarang.
  let cakram = new Map();
  let cakramTerbaca = true;
  try {
    cakram = await keadaanBerkasBanyakPerkara(
      (Array.isArray(rows) ? rows : []).map((row) => row.nomorPerkara)
    );
  } catch {
    cakramTerbaca = false;
  }
  const kosong = { adaPdf: 0, adaWord: 0, hilang: 0, retensi: 0 };

  return {
    diperiksaPada: new Date().toISOString(),
    total: Number(total && total[0] && total[0].jumlah) || 0,
    perkara: (Array.isArray(rows) ? rows : []).map((row) => {
      const bukti = cakramTerbaca
        ? cakram.get(normalizeCaseNumber(row.nomorPerkara)) || kosong
        : {
            adaPdf: Number(row.adaPdf) || 0,
            adaWord: Number(row.adaWord) || 0,
            hilang: 0,
            retensi: Number(row.dihapusRetensi) || 0,
          };
      return {
        nomorPerkara: cleanText(row.nomorPerkara),
        perkaraId: row.perkaraId ? String(row.perkaraId) : "",
        nomorRegister: cleanText(row.nomorRegister),
        dokumen: Number(row.dokumen) || 0,
        adaPdf: Number(row.adaPdf) || 0,
        adaWord: Number(row.adaWord) || 0,
        berkasAda: Number(row.berkasAda) || 0,
        tanpaBerkas: Number(row.tanpaBerkas) || 0,
        tidakTersedia: Number(row.tidakTersedia) || 0,
        /** Berkas yang benar-benar terbaca di cakram, bukan sekadar tercatat. */
        adaPdfCakram: bukti.adaPdf,
        adaWordCakram: bukti.adaWord,
        /** Tercatat pernah diunduh tetapi lenyap dari cakram - perlu ditarik ulang. */
        berkasHilang: bukti.hilang,
        menungguMajelis: Number(row.menungguMajelis) || 0,
        sudahValid: Number(row.sudahValid) || 0,
        berkasPendaftaran: Number(row.berkasPendaftaran) || 0,
        dihapusRetensi: Number(row.dihapusRetensi) || 0,
        terakhirTerlihat: botDb.fromMysqlDate(row.terakhirTerlihat),
      };
    }),
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

  // normalizeCaseNumber, bukan cleanText: barisnya disimpan dengan nomor yang
  // spasi di sekitar garis miringnya sudah dirapatkan (recordDocument), dan
  // mencarinya dengan cleanText membuat "620 / Pdt.G / 2025 / PA.Dgl" tidak
  // pernah ketemu - tanpa satu galat pun, hanya layar yang kosong.
  const nomorPerkara = normalizeCaseNumber(nomorPerkaraMentah);
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
            d.tidak_tersedia_pada AS tidakTersediaPada,
            d.tidak_tersedia_sebab AS tidakTersediaSebab,
            (SELECT SUM(f.ukuran_byte) FROM aleta_bot_ecourt_files f
              WHERE f.document_key = d.document_key) AS ukuranByte
       FROM aleta_bot_ecourt_documents d
      WHERE d.nomor_perkara = ?
      ORDER BY d.tanggal_sidang ASC, d.diunggah_pada ASC`,
    [nomorPerkara]
  );

  /**
   * ==========================================================================
   * ADA-TIDAKNYA BERKAS DIBACA DARI CATATAN BERKAS, LALU DIBUKTIKAN KE DISK
   * ==========================================================================
   *
   * Sebelumnya `adaPdf`/`adaWord` dibaca dari kolom cermin `berkas_pdf` dan
   * `berkas_word` di tabel dokumen. Cermin itu BASI: dari 394 dokumen hanya
   * 23 dan 8 yang terisi, sementara `aleta_bot_ecourt_files` mencatat seluruh
   * 400 berkas. Akibatnya tombol unduh tidak muncul untuk hampir seluruh
   * dokumen - inilah sebab keluhan "berkas arsip tidak bisa diunduh".
   *
   * Tetapi catatan saja tidak cukup. Folder unduhan pernah - dan sampai
   * mount-nya dipasang, masih - berada di dalam lapisan container, sehingga
   * setiap pembangunan ulang menghapus berkasnya sementara barisnya tetap
   * ada. Menyalakan tombol hanya berdasarkan catatan berarti menjanjikan
   * unduhan yang pasti gagal.
   *
   * Karena itu dua-duanya: TERCATAT dan TERBACA DI DISK. Yang tercatat tapi
   * hilang dilaporkan lewat `berkasHilang`, supaya keadaannya kelihatan
   * alih-alih tampak seperti dokumen yang memang belum pernah diunduh.
   *
   * Sejak 25 Sep 2026 hitungannya TIDAK lagi disusun di sini: ia dipindahkan ke
   * keadaanBerkasPerkara supaya tabel, rincian, dan penarik menjawab dari satu
   * potong kode yang sama. Lihat catatan panjang di sana.
   */
  const berkasPerDokumen = await keadaanBerkasPerkara(nomorPerkara);

  return {
    nomorPerkara,
    dokumen: (Array.isArray(rows) ? rows : []).map((row) => {
      const kunci = cleanText(row.documentKey);
      const catatan = berkasPerDokumen.get(kunci) || {
        pdf: null,
        word: null,
        hilang: 0,
        retensi: 0,
      };
      return {
        documentKey: kunci,
        judulDokumen: cleanText(row.judulDokumen),
        jenisDokumen: cleanText(row.jenisDokumen),
        peranPengunggah: cleanText(row.peranPengunggah),
        statusVerifikasi: cleanText(row.statusVerifikasi) || "belum",
        diunggahPada: botDb.fromMysqlDate(row.diunggahPada),
        tanggalSidang: botDb.fromMysqlDate(row.tanggalSidang),
        agenda: cleanText(row.agenda),
        adaPdf: Boolean(catatan.pdf),
        adaWord: Boolean(catatan.word),
        // Nama berkas yang sebenarnya - tersimpan pada jalur berkas, bukan
        // pada tabel dokumen. Kosong bila berkasnya tidak terbaca.
        namaBerkasPdf: catatan.pdf || "",
        namaBerkasWord: catatan.word || "",
        /** Tercatat pernah diunduh, tetapi berkasnya tidak ada lagi di disk. */
        berkasHilang: catatan.hilang,
        ukuranByte: Number(row.ukuranByte) || 0,
        dihapusRetensi: catatan.retensi > 0,
        /** e-Court sendiri menjawab 404 - menariknya tidak mungkin berhasil. */
        tidakTersediaPada: botDb.fromMysqlDate(row.tidakTersediaPada),
        tidakTersediaSebab: cleanText(row.tidakTersediaSebab),
        diberitahukanPada: botDb.fromMysqlDate(row.diberitahukanPada),
        terakhirTerlihat: botDb.fromMysqlDate(row.terakhirTerlihat),
      };
    }),
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

  // normalizeCaseNumber, bukan String().trim(): nomornya disimpan rapat oleh
  // recordDocument, dan mencarinya renggang tidak pernah ketemu - perkara yang
  // sudah lengkap lalu terbaca "belum pernah tercatat" dan dibuka ulang terus.
  const nomor = normalizeCaseNumber(nomorPerkara);
  if (!nomor) return false;

  const peta = await ringkasKekuranganBerkas([nomor]);
  const k = peta.get(nomor);

  // Belum pernah tercatat: tidak adanya catatan bukan bukti tidak adanya dokumen.
  if (!k || k.dokumen === 0) return false;

  return k.tanpaBerkas === 0 && k.menunggu === 0;
}

/**
 * Keadaan berkas BANYAK perkara sekaligus - satu kueri, bukan satu per perkara.
 *
 * ============================================================================
 * SATU KUERI, DAN DUA UKURAN "LENGKAP"
 * ============================================================================
 *
 * perkaraSudahLengkap dulu dipanggil di dalam gelung penarik, satu kueri tiap
 * tautan. Selama acuannya 200 perkara itu tidak terasa; begitu acuannya
 * dilebarkan ke seluruh arsip e-Court - 2.527 perkara pada sipp_donggala,
 * 24 Sep 2026 - itu menjadi 2.527 kueri berurutan sebelum satu halaman pun
 * dibuka, dan tidak satu barisnya pun berbeda dari yang dapat dijawab satu
 * kueri berkelompok.
 *
 * Yang dipulangkan sengaja ANGKA MENTAH, bukan kesimpulan "lengkap".
 * Penariknya yang memutuskan, sebab ada dua ukuran yang sama-sama benar untuk
 * pertanyaan yang berbeda:
 *
 *   tanpaBerkas === 0                    -> tidak ada lagi yang dapat diunduh
 *   tanpaBerkas === 0 && menunggu === 0  -> dan majelisnya sudah memeriksa
 *
 * Ukuran kedua itu tentang VERIFIKASI, bukan tentang berkas. Memakainya sebagai
 * syarat penarikan berarti membuka ulang perkara yang berkasnya sudah utuh
 * hanya karena majelisnya belum sempat memverifikasi - dan needsRecheck akan
 * menolak mengunduh apa pun dari kunjungan itu.
 *
 * TIGA HAL YANG DIHITUNG "SUDAH ADA" WALAU BERKASNYA TIDAK DI CAKRAM
 *   - berkas yang dihapus karena masa simpan: ia memang sengaja tidak ada, dan
 *     menyebutnya kurang berarti menariknya kembali - persis yang dilarang;
 *   - dokumen yang e-Court jawab 404 dan masih dalam jeda TIDAK_TERSEDIA;
 *   - berkas yang tercatat tetapi lenyap dari cakram TIDAK diperiksa di sini.
 *     Membuktikan ke cakram untuk ribuan perkara berarti ribuan panggilan
 *     stat() sebelum satu halaman pun dibuka. Pembuktian itu pekerjaan
 *     keadaanBerkasBanyakPerkara, yang hanya menyentuh baris yang digambar.
 *
 * Butir pertama sampai 25 Sep 2026 hanya TERTULIS, tidak terjadi. Saringan
 * lamanya `WHERE jalur_berkas IS NOT NULL AND jalur_berkas <> ''` membuang baris
 * retensi - pembersihnya mengosongkan jalur BERSAMAAN dengan menandainya -
 * sehingga dokumen retensi murni terukur tanpaBerkas=1 dan perkaranya ditarik
 * ulang selamanya. Kini kedua fungsi memakai SUMBER_SUDAH_BERBERKAS yang sama.
 */
async function ringkasKekuranganBerkas(daftarNomor = []) {
  await ensureSchema();

  const peta = new Map();
  const bersih = [...new Set((daftarNomor || []).map(normalizeCaseNumber).filter(Boolean))];
  if (bersih.length === 0) return peta;

  // Dipotong 200 supaya daftar IN tidak melewati batas paket MySQL.
  for (let i = 0; i < bersih.length; i += 200) {
    const kelompok = bersih.slice(i, i + 200);
    const isian = kelompok.map(() => "?").join(", ");
    const rows = await botDb.query(
      `SELECT d.nomor_perkara AS nomorPerkara,
              COUNT(*) AS dokumen,
              SUM(CASE WHEN k.document_key IS NOT NULL THEN 1 ELSE 0 END) AS berkasAda,
              -- Hanya yang jedanya BELUM habis - lihat catatan pada ruas senama
              -- di daftarArsipPerkara, yang sengaja menghitung seluruhnya.
              SUM(CASE WHEN ${EKSPRESI_DALAM_JEDA} THEN 1 ELSE 0 END) AS tidakTersedia,
              SUM(${ekspresiTanpaBerkas("k")}) AS tanpaBerkas,
              SUM(CASE WHEN d.status_verifikasi = 'belum' THEN 1 ELSE 0 END) AS menunggu,
              MAX(d.terakhir_terlihat) AS terakhir
         FROM aleta_bot_ecourt_documents d
         LEFT JOIN (${SUMBER_SUDAH_BERBERKAS}
         ) k ON k.document_key = d.document_key
        WHERE d.nomor_perkara IN (${isian})
        GROUP BY d.nomor_perkara`,
      [TIDAK_TERSEDIA_JEDA_HARI, TIDAK_TERSEDIA_JEDA_HARI, ...kelompok]
    );

    for (const row of Array.isArray(rows) ? rows : []) {
      peta.set(normalizeCaseNumber(row.nomorPerkara), {
        dokumen: Number(row.dokumen) || 0,
        berkasAda: Number(row.berkasAda) || 0,
        tanpaBerkas: Number(row.tanpaBerkas) || 0,
        tidakTersedia: Number(row.tidakTersedia) || 0,
        menunggu: Number(row.menunggu) || 0,
        terakhirTerlihat: botDb.fromMysqlDate(row.terakhir),
      });
    }
  }

  // Perkara yang TIDAK punya baris sama sekali sengaja tidak masuk peta - itulah
  // "belum pernah ditarik", dan ketiadaannya memang jawabannya.
  return peta;
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
  alurMenungguMajelis,
  berkasPendaftaran,
  dokumenMenungguMajelis,
  sqlMenungguMajelis,
  rapikanStatusPendaftaranLama,
  GAGAL_AMBANG,
  GAGAL_JEDA_JAM,
  TIDAK_TERSEDIA_JEDA_HARI,
  // Diekspor supaya uji dapat MENJALANKAN kueri untuk setiap kunci kepala kolom,
  // bukan menyapu teksnya. Delapan belas uji penyapu teks lulus semua selama
  // kunci "register" melempar ERROR 1247 di peladen.
  KOLOM_URUT_ARSIP,
  susunUrutan,
  tandaiTidakTersedia,
  lupakanTidakTersedia,
  keadaanBerkasPerkara,
  keadaanBerkasBanyakPerkara,
  ringkasKekuranganBerkas,
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
