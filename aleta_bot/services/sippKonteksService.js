"use strict";

/**
 * Konteks ALETA untuk satu perkara, disajikan ke tampilan SIPP.
 *
 * ============================================================================
 * HANYA MEMBACA, DAN TIDAK MENYENTUH SIPP SAMA SEKALI
 * ============================================================================
 *
 * Layanan ini melayani ekstensi peramban yang menempelkan keterangan ALETA ke
 * halaman SIPP. Tidak ada satu pun berkas SIPP yang diubah, tidak ada satu pun
 * tabel SIPP yang ditulis. Yang berubah hanya APA YANG DILIHAT petugas.
 *
 * Konsekuensinya perlu disadari: dua petugas membuka perkara yang sama dapat
 * melihat isi berbeda, tergantung ekstensinya terpasang atau tidak. Itu wajar
 * untuk lapisan bantu, tetapi harus disepakati supaya tidak membingungkan.
 *
 * ============================================================================
 * DIAM KETIKA TIDAK TAHU
 * ============================================================================
 *
 * Bila sebuah keterangan tidak dapat dipastikan - tabelnya belum terbentuk,
 * SIPP tidak terbaca, rekonsiliasi gagal - bagian itu dikembalikan KOSONG,
 * bukan ditebak. Ekstensi lalu tidak menampilkan apa pun untuk bagian itu.
 *
 * Keterangan yang salah di layar SIPP lebih berbahaya daripada tidak ada
 * keterangan: petugas mempercayai apa yang tampil di aplikasi resminya.
 */

const fs = require("fs");

const botDb = require("./botDbService");
const ecourtDocumentService = require("./ecourtDocumentService");
const { normalizeCaseNumber, cleanText } = require("./ecourtTextService");
const ecourtStoreService = require("./ecourtStoreService");
const ecourtReconciliationService = require("./ecourtReconciliationService");
const nomorVerificationService = require("./nomorVerificationService");
const paniteraDashboardService = require("./paniteraDashboardService");
const sippIdentitasPerkaraService = require("./sippIdentitasPerkaraService");
const { fetchCaseParties } = require("./ecourtNotificationWorker");
const ecourtVerificationService = require("./ecourtVerificationService");

/** Menjalankan fn, mengembalikan nilai bawaan bila gagal. Tidak pernah melempar. */
async function aman(fn, bawaan) {
  try {
    return await fn();
  } catch {
    return bawaan;
  }
}

function sisaHari(nilai) {
  const waktu = botDb.fromMysqlDate(nilai);
  if (!waktu) return null;
  return Math.ceil((waktu.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

/**
 * Dokumen e-Court pada perkara ini, beserta tenggat dan status pemberitahuannya.
 *
 * Inilah keterangan yang paling tidak dimiliki SIPP: batas waktu unggah ada di
 * e-Court, dan SIPP tidak menampilkannya sama sekali - padahal itu yang
 * menentukan pihak kehilangan kesempatan menanggapi atau tidak.
 */
async function dokumenPerkara(nomorPerkara) {
  const rows = await botDb.query(
    `SELECT document_key, judul_dokumen, jenis_dokumen, peran_pengunggah,
            status_verifikasi, diunggah_pada, agenda,
            nomor_register, registrasi_ecourt,
            tanggal_sidang,
            batas_unggah, batas_unggah_teks,
            berkas_pdf, berkas_word,
            diberitahukan_pada, alasan_tidak_diberitahukan
       FROM aleta_bot_ecourt_documents
      WHERE nomor_perkara = ?
      ORDER BY diunggah_pada ASC`,
    [nomorPerkara]
  );

  return (Array.isArray(rows) ? rows : []).map((row) => ({
    documentKey: row.document_key,
    judulDokumen: row.judul_dokumen,
    nomorRegister: cleanText(row.nomor_register || row.registrasi_ecourt),
    jenisDokumen: row.jenis_dokumen,
    peranPengunggah: row.peran_pengunggah,
    statusVerifikasi: row.status_verifikasi,
    agenda: row.agenda,
    // Tanggal sidang adalah kunci pencocokan yang ANDAL ke baris Jadwal
    // Sidang di SIPP. Agenda berupa teks bebas - "Jawaban Tergugat" di
    // e-Court dapat tertulis "Penyampaian Jawaban" di SIPP - dan dokumen
    // yang muncul di baris agenda yang keliru berarti hakim mengunduh
    // berkas perkara yang salah tanpa ada yang menyadarinya.
    tanggalSidang: botDb.fromMysqlDate(row.tanggal_sidang),
    diunggahPada: row.diunggah_pada,
    batasUnggahTeks: row.batas_unggah_teks || "",
    sisaHari: sisaHari(row.batas_unggah),
    adaPdf: Boolean(row.berkas_pdf),
    adaWord: Boolean(row.berkas_word),
    sudahDiberitahukan: Boolean(row.diberitahukan_pada),
    // Kapan pihak diberi tahu, bukan sekadar sudah atau belum. Inilah yang
    // ditanyakan pihak lewat telepon - "saya belum menerima apa pun" - dan
    // jawabannya selama ini harus dicari di dashboard ALETA.
    diberitahukanPada: botDb.fromMysqlDate(row.diberitahukan_pada),

    alasanTidakDiberitahukan: row.alasan_tidak_diberitahukan || "",
  }));
}

/**
 * Keadaan nomor tiap pihak pada perkara ini.
 *
 * Menjawab pertanyaan yang tiap hari ditanyakan di meja PTSP - "pihaknya sudah
 * diberi tahu belum?" - tanpa petugas berpindah aplikasi.
 */
async function nomorPihak(nomorPerkara) {
  const pihak = await fetchCaseParties(nomorPerkara);
  if (!Array.isArray(pihak) || pihak.length === 0) return [];

  const hasil = [];
  const terlihat = new Set();

  for (const orang of pihak) {
    const nama = cleanText(orang.nama);
    const telepon = cleanText(orang.telepon);
    if (!nama) continue;

    const kunci = `${nama}|${telepon}`;
    if (terlihat.has(kunci)) continue;
    terlihat.add(kunci);

    const catatan = telepon
      ? await aman(() => nomorVerificationService.getStatus(telepon, nama), null)
      : null;

    hasil.push({
      nama,
      pihakKe: Number(orang.pihak_ke) || null,
      jenis: orang.jenis || "",
      adaNomor: Boolean(telepon),
      // Nomor sengaja TIDAK dikirim utuh. Layar SIPP dapat terlihat orang lain,
      // dan nomor pihak berperkara bukan keterangan yang perlu dipajang.
      nomorSamar: telepon ? `${telepon.slice(0, 4)}****${telepon.slice(-3)}` : "",
      statusVerifikasi: catatan ? catatan.status : "belum_pernah_ditanya",
    });
  }

  return hasil;
}

/** Selisih antara catatan ALETA dan status sesungguhnya di e-Court. */
async function selisihPerkara(nomorPerkara) {
  const laporan = await ecourtReconciliationService.periksa({ limit: 500 });
  if (!laporan || !Array.isArray(laporan.selisih)) return [];
  return laporan.selisih
    .filter((item) => normalizeCaseNumber(item.nomorPerkara) === nomorPerkara)
    .map((item) => ({
      judulDokumen: item.judulDokumen,
      jenis: item.jenis,
      kegentingan: item.kegentingan,
      penjelasan: item.penjelasan,
      statusAleta: item.statusAleta,
      statusEcourt: item.statusEcourt,
    }));
}

/**
 * Apakah pembuka halaman ini hakim pada majelis perkara tersebut?
 *
 * GAGAL-TERTUTUP, sama seperti seluruh jalur verifikasi lain: nama kosong,
 * bukan hakim terdaftar, SIPP tidak terbaca, atau bukan anggota majelis -
 * semuanya berakhir dengan TIDAK BOLEH.
 *
 * Jawaban ini hanya menentukan tombolnya tampil atau tidak. Keputusan yang
 * dikirim tetap diperiksa ulang dari awal saat disimpan, sehingga tombol yang
 * dipaksa muncul pun tidak menghasilkan apa-apa.
 */
async function periksaHakim(nomorPerkara, namaPembuka) {
  const nama = cleanText(namaPembuka);
  if (!nama) return { bolehVerifikasi: false, alasan: "nama_pembuka_kosong" };

  const hakim = ecourtVerificationService.identifyJudgeByName(nama);
  if (!hakim) return { bolehVerifikasi: false, alasan: "bukan_hakim_terdaftar" };

  const panel = await ecourtVerificationService.isOnPanel(nomorPerkara, hakim.namaPencarian);
  if (!panel.anggota) return { bolehVerifikasi: false, alasan: panel.alasan || "bukan_anggota_majelis" };

  return { bolehVerifikasi: true, alasan: "", nama: hakim.nama };
}


/**
 * Ringkasan singkat untuk BANYAK perkara sekaligus.
 *
 * ============================================================================
 * SATU PERMINTAAN, BUKAN LIMA PULUH
 * ============================================================================
 *
 * Halaman Daftar Perkara memuat sampai 50 baris. Menandai tiap baris dengan
 * memanggil getKonteks satu per satu berarti 50 permintaan sekaligus dari satu
 * halaman - dan tiap getKonteks membaca dokumen, nomor pihak, selisih, serta
 * memeriksa keanggotaan majelis. Itu membebani bot dan SIPP tanpa alasan.
 *
 * Fungsi ini hanya mengembalikan yang dibutuhkan penanda baris: berapa dokumen,
 * berapa yang menunggu majelis, berapa tenggat mendesak dan lewat. Tidak ada
 * nomor pihak, tidak ada isi dokumen, tidak ada pemeriksaan majelis.
 *
 * YANG SENGAJA TIDAK DIKEMBALIKAN
 *
 * Nomor telepon tidak ikut, walau halaman daftar juga memuat nama pihak.
 * Menandai lima puluh baris sekaligus dengan nomor telepon berarti memajang
 * data pribadi puluhan orang di satu layar yang terlihat siapa saja.
 */
async function ringkasanMassal(daftarNomor, { batas = 60 } = {}) {
  const nomorBersih = [];
  const terlihat = new Set();

  for (const item of Array.isArray(daftarNomor) ? daftarNomor : []) {
    const nomor = normalizeCaseNumber(item);
    if (!nomor || terlihat.has(nomor)) continue;
    terlihat.add(nomor);
    nomorBersih.push(nomor);
    if (nomorBersih.length >= batas) break;
  }

  if (nomorBersih.length === 0) return { diperiksaPada: new Date().toISOString(), perkara: {} };

  await aman(() => ecourtStoreService.ensureSchema(), false);

  const ambang = await aman(async () => paniteraDashboardService.ambangMendesakHari(), 3);
  const tanda = nomorBersih.map(() => "?").join(", ");

  const rows = await aman(
    () =>
      botDb.query(
        `SELECT nomor_perkara AS nomorPerkara,
                COUNT(*) AS dokumen,
                SUM(CASE WHEN status_verifikasi = 'belum' THEN 1 ELSE 0 END) AS menungguVerifikasi,
                SUM(
                  CASE WHEN batas_unggah IS NOT NULL
                        AND batas_unggah < UTC_TIMESTAMP()
                       THEN 1 ELSE 0 END
                ) AS tenggatLewat,
                SUM(
                  CASE WHEN batas_unggah IS NOT NULL
                        AND batas_unggah >= UTC_TIMESTAMP()
                        AND batas_unggah <= DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? DAY)
                       THEN 1 ELSE 0 END
                ) AS tenggatMendesak,
                MAX(terakhir_terlihat) AS terakhirTerlihat
           FROM aleta_bot_ecourt_documents
          WHERE nomor_perkara IN (${tanda})
          GROUP BY nomor_perkara`,
        [ambang, ...nomorBersih]
      ),
    []
  );

  const hasil = {};
  for (const row of Array.isArray(rows) ? rows : []) {
    const nomor = cleanText(row.nomorPerkara);
    if (!nomor) continue;
    hasil[nomor] = {
      dokumen: Number(row.dokumen) || 0,
      menungguVerifikasi: Number(row.menungguVerifikasi) || 0,
      tenggatMendesak: Number(row.tenggatMendesak) || 0,
      tenggatLewat: Number(row.tenggatLewat) || 0,
      terakhirTerlihat: botDb.fromMysqlDate(row.terakhirTerlihat),
    };
  }

  // Perkara yang diminta tetapi tidak punya catatan dikembalikan sebagai null,
  // bukan dihilangkan. Tidak adanya catatan adalah keterangan tersendiri -
  // artinya ALETA belum pernah menarik perkara itu - dan penanda barisnya perlu
  // membedakannya dari perkara yang memang tidak punya dokumen.
  for (const nomor of nomorBersih) {
    if (!(nomor in hasil)) hasil[nomor] = null;
  }

  return {
    diperiksaPada: new Date().toISOString(),
    ambangMendesakHari: ambang,
    perkara: hasil,
  };
}

/**
 * Seluruh konteks untuk satu perkara.
 *
 * @param {string} nomor Nomor perkara sebagaimana tampil di SIPP.
 */
async function getKonteks(nomor, { namaPembuka = "" } = {}) {
  const nomorPerkara = normalizeCaseNumber(nomor);
  if (!nomorPerkara) {
    return { ok: false, alasan: "nomor_perkara_kosong", nomorPerkara: "" };
  }

  await aman(() => ecourtStoreService.ensureSchema(), false);
  await aman(() => nomorVerificationService.ensureSchema(), false);

  // Tiap bagian dibungkus sendiri: satu bagian yang gagal tidak boleh
  // menghilangkan bagian lain yang sebenarnya sudah benar.
  const [dokumen, nomorNya, selisih, ambang, hakim, identitas] = await Promise.all([
    aman(() => dokumenPerkara(nomorPerkara), []),
    aman(() => nomorPihak(nomorPerkara), []),
    aman(() => selisihPerkara(nomorPerkara), []),
    aman(async () => paniteraDashboardService.ambangMendesakHari(), 3),
    // Apakah yang membuka halaman ini hakim pada majelis perkara INI?
    //
    // Diperiksa di sisi bot, bukan dipercayakan pada ekstensi. Ekstensi hanya
    // menampilkan tombol berdasarkan jawaban ini - dan sekalipun tombolnya
    // dipaksa muncul, keputusannya tetap diperiksa ulang saat disimpan.
    aman(() => periksaHakim(nomorPerkara, namaPembuka), { bolehVerifikasi: false, alasan: "" }),
    // Jenis perkara, kumulasi, dan kuasa hukum. Gagal-terbuka: keterangan ini
    // menerangkan perkara, tidak menjaga apa pun. Kehilangannya tidak boleh
    // menghilangkan dokumen dan tenggat yang justru dicari petugas.
    aman(() => sippIdentitasPerkaraService.identitasPerkara(nomorPerkara), null),
  ]);

  return {
    ok: true,
    alasan: "",
    nomorPerkara,
    // Nomor register e-Court - kunci untuk mencari perkara ini di
    // e-Court secara manual. SIPP tidak menampilkannya di mana pun,
    // sehingga petugas selama ini mencarinya lewat database.
    nomorRegister: (dokumen.find((d) => d.nomorRegister) || {}).nomorRegister || "",
    diperiksaPada: new Date().toISOString(),
    ambangMendesakHari: ambang,
    dokumen,
    nomorPihak: nomorNya,
    selisih,
    hakim,
    identitas,
    ringkasan: {
      dokumen: dokumen.length,
      menungguVerifikasi: dokumen.filter((d) => d.statusVerifikasi === "belum").length,
      tenggatMendesak: dokumen.filter((d) => d.sisaHari !== null && d.sisaHari >= 0 && d.sisaHari <= ambang).length,
      tenggatLewat: dokumen.filter((d) => d.sisaHari !== null && d.sisaHari < 0).length,
      nomorBermasalah: nomorNya.filter(
        (n) => !n.adaNomor || n.statusVerifikasi === "ditolak" || n.statusVerifikasi === "menunggu"
      ).length,
      selisihGenting: selisih.filter((s) => s.kegentingan === "tinggi").length,
    },
  };
}

/**
 * Mengambil satu berkas dokumen untuk diunduh.
 *
 * ============================================================================
 * JALUR BERKAS TIDAK PERNAH DIPERCAYA APA ADANYA
 * ============================================================================
 *
 * Jalur yang tersimpan di database dipakai untuk membaca berkas dari disk.
 * Bila baris database sempat berubah - karena kekeliruan, atau karena sesuatu
 * yang lebih buruk - jalur seperti "../../etc/passwd" akan membuat layanan ini
 * menyerahkan berkas apa pun di server.
 *
 * Karena itu jalurnya SELALU diperiksa berada di dalam folder arsip, dan
 * pemeriksaan itu dilakukan tepat sebelum berkasnya dibaca.
 *
 * @returns {Promise<{ ok: boolean, alasan: string, isi?: Buffer, namaBerkas?: string, tipeIsi?: string }>}
 */
async function getBerkas(documentKey, format = "pdf") {
  const kunci = String(documentKey || "").trim();
  if (!kunci) return { ok: false, alasan: "document_key_kosong" };

  const jenis = String(format) === "word" ? "word" : "pdf";
  const kolom = jenis === "word" ? "berkas_word" : "berkas_pdf";
  const rows = await botDb.query(
    `SELECT nomor_perkara, judul_dokumen, ${kolom} AS jalur
       FROM aleta_bot_ecourt_documents
      WHERE document_key = ? LIMIT 1`,
    [kunci]
  );

  const baris = Array.isArray(rows) ? rows[0] : null;
  if (!baris) return { ok: false, alasan: "dokumen_tidak_ditemukan" };

  /**
   * ==========================================================================
   * CATATAN BERKAS YANG SEBENARNYA ADA DI aleta_bot_ecourt_files
   * ==========================================================================
   *
   * `berkas_pdf` dan `berkas_word` pada tabel dokumen hanya CERMIN - diisi
   * saat unduhan berhasil, lalu ditimpa ulang oleh penyelarasan berikutnya.
   * Diukur pada basis data yang berjalan: dari 394 dokumen, cerminnya terisi
   * pada 23 (pdf) dan 8 (word) saja, sementara `aleta_bot_ecourt_files`
   * mencatat seluruh 400 berkas.
   *
   * Membaca cerminnya membuat unduhan menjawab "berkas_belum_tersimpan"
   * untuk berkas yang sebenarnya tercatat - dan karena tombol unduhnya pun
   * disembunyikan atas dasar yang sama, tidak ada yang pernah melihat
   * kesalahannya.
   *
   * Jadi tabel berkas dibaca lebih dulu, cerminnya jadi cadangan.
   */
  const barisBerkas = await botDb
    .query(
      `SELECT jalur_berkas AS jalur
         FROM aleta_bot_ecourt_files
        WHERE document_key = ? AND format = ? AND dihapus_retensi IS NULL
        ORDER BY diunduh_pada DESC
        LIMIT 1`,
      [kunci, jenis]
    )
    .catch(() => []);

  const jalur = (Array.isArray(barisBerkas) && barisBerkas[0] && barisBerkas[0].jalur) || baris.jalur;
  if (!jalur) return { ok: false, alasan: "berkas_belum_tersimpan" };

  const hasil = ecourtDocumentService.describeEcourtDocument(jalur);
  if (!hasil.ok) return { ok: false, alasan: hasil.reason };

  let isi;
  try {
    isi = fs.readFileSync(hasil.absolutePath);
  } catch (error) {
    return { ok: false, alasan: `berkas_tidak_terbaca: ${error.message}` };
  }

  return {
    ok: true,
    alasan: "",
    isi,
    namaBerkas: hasil.fileName,
    tipeIsi: format === "word" ? "application/octet-stream" : "application/pdf",
    nomorPerkara: baris.nomor_perkara,
    judulDokumen: baris.judul_dokumen,
  };
}

module.exports = { dokumenPerkara, getBerkas, getKonteks, ringkasanMassal, nomorPihak, selisihPerkara };
