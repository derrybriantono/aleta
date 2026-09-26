"use strict";

/**
 * Ringkasan keadaan e-Court untuk tab pengelolaan di portal.
 *
 * Menjawab pertanyaan yang selama ini hanya bisa dijawab dengan membuka
 * terminal di server: jembatannya terakhir jalan kapan, ada berapa dokumen
 * tersimpan, berapa yang menunggu majelis, berapa nomor yang belum menjawab
 * konfirmasi, dan apakah catatan ALETA masih cocok dengan e-Court.
 *
 * HANYA MEMBACA. Menjalankan jembatan tetap lewat terminal, karena login
 * e-Court menuntut captcha yang harus diisi manusia - dan itu memang sengaja
 * tidak diotomatiskan.
 */

const botDb = require("./botDbService");
const { readRuntimeConfig } = require("../config/runtime-config");
const ecourtStoreService = require("./ecourtStoreService");
const ecourtClassifier = require("./ecourtEventClassifierService");
const ecourtVerificationService = require("./ecourtVerificationService");
const ecourtReconciliationService = require("./ecourtReconciliationService");
const nomorVerificationService = require("./nomorVerificationService");
const sippReadOnlyBridgeService = require("./sippReadOnlyBridgeService");
const { normalizeCaseNumber } = require("./ecourtTextService");

async function hitung(sql, params = []) {
  const rows = await botDb.query(sql, params);
  const baris = Array.isArray(rows) ? rows[0] : null;
  return Number(baris && (baris.jumlah ?? baris.count ?? 0)) || 0;
}

/** Kapan jembatan terakhir dijalankan, dan hasilnya apa. */
async function sinkronisasiTerakhir() {
  const rows = await botDb.query(
    `SELECT * FROM aleta_bot_ecourt_sync_runs ORDER BY dimulai_pada DESC LIMIT 1`
  );
  const baris = Array.isArray(rows) ? rows[0] : null;
  if (!baris) return null;
  return {
    dimulaiPada: baris.dimulai_pada || null,
    selesaiPada: baris.selesai_pada || null,
    status: baris.status || "",
    perkaraDiperiksa: Number(baris.perkara_diperiksa || 0),
    dokumenTerlihat: Number(baris.dokumen_terlihat || 0),
    dokumenBaru: Number(baris.dokumen_baru || 0),
    berkasTerunduh: Number(baris.berkas_terunduh || 0),
    jumlahGalat: Number(baris.jumlah_galat || 0),
    galatTerakhir: baris.galat_terakhir || "",
    catatan: baris.catatan || "",
  };
}

// ============================================================================
// RIWAYAT PUTARAN - SATU PUTARAN TERAKHIR TIDAK CUKUP UNTUK MENJAWAB "LENGKAP?"
// ============================================================================
//
// sinkronisasiTerakhir() di atas memakai LIMIT 1, dan keempat kolom hasilnya
// (perkara_diperiksa, dokumen_baru, berkas_terunduh, jumlah_galat) memang sudah
// tampil di layar untuk putaran itu. Yang tidak pernah terlihat adalah
// URUTANNYA: satu putaran gagal tidak dapat dibedakan dari sepuluh putaran
// gagal berturut-turut, padahal yang kedua berarti jembatannya memang rusak.
//
// Terukur pada aleta_bot setempat 25 Sep 2026: tabelnya berisi 1 baris, yaitu
// putaran 2026-08-28 07:11:55 berstatus "gagal" dengan galat_terakhir "login
// manual tidak selesai sebelum batas waktu" dan keempat angkanya nol. Satu
// putaran, satu kegagalan, dan tidak ada satu dokumen pun yang pernah masuk -
// itulah keterangan yang selama ini hanya terbaca lewat terminal.
async function riwayatPutaran({ limit = 10 } = {}) {
  const batas = Math.max(1, Math.min(50, Number(limit) || 10));
  const rows = await botDb.query(
    `SELECT id, dimulai_pada, selesai_pada, status, perkara_diperiksa,
            dokumen_terlihat, dokumen_baru, berkas_terunduh, jumlah_galat,
            galat_terakhir, catatan
       FROM aleta_bot_ecourt_sync_runs
      ORDER BY dimulai_pada DESC
      LIMIT ${batas}`
  );

  return (Array.isArray(rows) ? rows : []).map((row) => {
    const mulai = botDb.fromMysqlDate(row.dimulai_pada);
    const selesai = botDb.fromMysqlDate(row.selesai_pada);
    return {
      id: String(row.id || ""),
      dimulaiPada: mulai ? mulai.toISOString() : null,
      selesaiPada: selesai ? selesai.toISOString() : null,
      status: String(row.status || ""),
      perkaraDiperiksa: Number(row.perkara_diperiksa || 0),
      dokumenTerlihat: Number(row.dokumen_terlihat || 0),
      dokumenBaru: Number(row.dokumen_baru || 0),
      berkasTerunduh: Number(row.berkas_terunduh || 0),
      jumlahGalat: Number(row.jumlah_galat || 0),
      galatTerakhir: String(row.galat_terakhir || ""),
      catatan: String(row.catatan || ""),
      // null, bukan 0, bila salah satu ujungnya tidak ada. Putaran yang belum
      // selesai dan putaran yang selesai seketika bukan hal yang sama.
      lamaDetik: mulai && selesai ? Math.round((selesai.getTime() - mulai.getTime()) / 1000) : null,
    };
  });
}

/**
 * Berapa berkas arsip yang tersimpan dan sebesar apa.
 *
 * Byte dipisah aktif dan yang sudah dibuang retensi: menjumlahkan keduanya
 * membuat layar mengaku menyimpan berkas yang sudah tidak ada di disk.
 */
async function ringkasArsip() {
  const rows = await botDb.query(
    `SELECT COUNT(*) AS berkas,
            COUNT(DISTINCT nomor_perkara) AS perkara,
            COUNT(DISTINCT document_key) AS dokumen,
            SUM(CASE WHEN dihapus_retensi IS NULL THEN 1 ELSE 0 END) AS aktif,
            SUM(CASE WHEN dihapus_retensi IS NOT NULL THEN 1 ELSE 0 END) AS dihapusRetensi,
            COALESCE(SUM(CASE WHEN dihapus_retensi IS NULL THEN ukuran_byte ELSE 0 END), 0) AS byteAktif,
            COALESCE(SUM(ukuran_byte), 0) AS byteSemua
       FROM aleta_bot_ecourt_files`
  );
  const baris = (Array.isArray(rows) && rows[0]) || {};
  return {
    berkas: Number(baris.berkas || 0),
    perkara: Number(baris.perkara || 0),
    dokumen: Number(baris.dokumen || 0),
    aktif: Number(baris.aktif || 0),
    dihapusRetensi: Number(baris.dihapusRetensi || 0),
    byteAktif: Number(baris.byteAktif || 0),
    byteSemua: Number(baris.byteSemua || 0),
  };
}

/**
 * Panggilan elektronik (e-Summons) dan persetujuan pihak.
 *
 * Keduanya sudah lama ditulis recordPanggilanElektronik dan
 * recordPersetujuanPihak ke aleta_bot_ecourt_panggilan dan
 * aleta_bot_ecourt_pihak, dan belum pernah dibaca satu layar pun. Persetujuan
 * pihak menentukan boleh-tidaknya dokumen dikirim elektronik, jadi jumlah yang
 * "belum" adalah pekerjaan, bukan hiasan.
 */
async function ringkasPanggilan() {
  const panggilan = await botDb.query(
    `SELECT COUNT(*) AS total,
            COUNT(DISTINCT nomor_perkara) AS perkara,
            SUM(CASE WHEN dikirim_pada IS NOT NULL THEN 1 ELSE 0 END) AS terkirim
       FROM aleta_bot_ecourt_panggilan`
  );
  const p = (Array.isArray(panggilan) && panggilan[0]) || {};

  const pihak = await botDb.query(
    `SELECT persetujuan, COUNT(*) AS jumlah
       FROM aleta_bot_ecourt_pihak
      GROUP BY persetujuan`
  );

  const persetujuan = { setuju: 0, belum: 0, tolak: 0, lain: 0, total: 0 };
  for (const row of Array.isArray(pihak) ? pihak : []) {
    const jumlah = Number(row.jumlah || 0);
    const kunci = String(row.persetujuan || "").trim().toLowerCase();
    persetujuan.total += jumlah;
    if (kunci === "setuju" || kunci === "ya") persetujuan.setuju += jumlah;
    else if (kunci === "tolak" || kunci === "tidak") persetujuan.tolak += jumlah;
    else if (kunci === "belum" || kunci === "") persetujuan.belum += jumlah;
    // Nilai yang tidak dikenali TIDAK dibulatkan ke "belum". Kolomnya
    // varchar(16) tanpa enum, jadi nilai baru mungkin muncul - dan menghitungnya
    // sebagai "belum" berarti melaporkan pekerjaan yang tidak ada, atau
    // menyembunyikan keadaan yang tidak ada namanya.
    else persetujuan.lain += jumlah;
  }

  return {
    panggilan: {
      total: Number(p.total || 0),
      perkara: Number(p.perkara || 0),
      terkirim: Number(p.terkirim || 0),
    },
    persetujuan,
  };
}

// ============================================================================
// KEADAAN PENDAFTARAN e-COURT DIGOLONGKAN DARI TEKSNYA, BUKAN DARI ID-NYA
// ============================================================================
//
// status_pendaftaran_id TIDAK dapat dipakai menggolongkan. Terukur pada
// sipp_donggala 25 Sep 2026:
//
//   id 8  -> "Menunggu Pendaftaran" (5 baris) DAN "Perkara Terdaftar" (1 baris)
//   id 11 -> "Pendaftaran Ditolak" (4 baris) DAN
//            "Pendaftaran Tidak Dapat Dilanjutkan" (3 baris)
//
// Jadi satu id memuat dua arti yang berlawanan, dan salah satunya adalah
// perkara yang pendaftarannya batal. Teksnya yang membedakan, dan teks itulah
// yang juga dibaca petugas di SIPP.
//
// "Tidak Dapat Dilanjutkan" diperiksa SEBELUM "ditolak" dengan sengaja: kedua
// teksnya berawalan "Pendaftaran", dan urutan periksa yang salah akan
// menggabungkan 3 perkara batal ke dalam hitungan perkara ditolak.
// ============================================================================
// TANGGAL DARI JEMBATAN TIDAK DAPAT DIPERCAYA - DIUKUR, BUKAN DIDUGA
// ============================================================================
//
// listEcourtCases menyusun tanggalnya dengan
// safeString(row.tanggalPendaftaran).slice(0, 10). Kolom SIPP-nya bertipe DATE,
// dan penggerak mysql memulangkannya sebagai objek Date - sehingga String(Date)
// menghasilkan "Tue Sep 08 2026 00:00:00 GMT+0800" dan sepuluh huruf pertamanya
// adalah "Tue Sep 08". Terukur 25 Sep 2026 atas sipp_donggala: SELURUH 2.527
// barisnya berbentuk demikian, tanpa satu tahun pun.
//
// Pembetulannya ada di sippReadOnlyBridgeService.js:1326, dan berkas itu sedang
// disunting orang lain - jadi di sini tanggalnya hanya DITOLAK, tidak ditebak.
// "Mon Mar 30" tanpa tahun lebih berbahaya daripada tanda hubung: petugas akan
// membacanya sebagai tahun ini.
function tanggalTerbaca(nilai) {
  const teks = String(nilai || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(teks) ? teks : "";
}

function golonganPendaftaran(teks) {
  const bersih = String(teks || "").trim().toLowerCase();
  if (!bersih) return "tanpaKeadaan";
  if (bersih === "perkara terdaftar") return "terdaftar";
  if (bersih.includes("tidak dapat dilanjutkan")) return "tidakDapatDilanjutkan";
  if (bersih.includes("ditolak")) return "ditolak";
  if (bersih.includes("menunggu")) return "menunggu";
  // Teks yang belum dikenal TIDAK dianggap beres. Hari ini SIPP setempat hanya
  // memuat empat teks, tetapi teks kelima yang diam-diam dihitung "terdaftar"
  // adalah persis cara satu perkara batal lolos tanpa terlihat.
  return "lain";
}

/**
 * Cakupan penarikan dan keadaan pendaftaran e-Court.
 *
 * ==========================================================================
 * SATU-SATUNYA ANGKA YANG MENJAWAB "APAKAH SINKRONISASINYA LENGKAP?"
 * ==========================================================================
 *
 * Layar Admin Integrasi e-Court selama ini menampilkan jumlah dokumen yang
 * TERSIMPAN, dan jumlah itu tidak pernah dapat menjawab berapa yang HILANG.
 * "1.204 dokumen tersimpan" terbaca meyakinkan baik ketika seluruh perkara
 * sudah ditarik maupun ketika 2.000 perkara belum pernah dibuka sekali pun.
 * Penyebutnya yang tidak ada.
 *
 * Terukur pada basis data setempat 25 Sep 2026: 2.527 perkara e-Court di SIPP
 * (COUNT(DISTINCT perkara_id) FROM perkara_efiling_id), dan 0 baris di
 * aleta_bot_ecourt_documents - jadi cakupannya 0 dari 2.527. Angka itu benar,
 * dan justru karena itu ia harus terlihat.
 *
 * ==========================================================================
 * JENDELANYA 3650 HARI, BUKAN 365
 * ==========================================================================
 *
 * listEcourtCases menyaring p.tanggal_pendaftaran >= CURDATE() - sejakHari,
 * dan bawaannya 365. Terukur: dengan jendela 365 hari hanya 1 dari 4 perkara
 * berpendaftaran bermasalah yang masih terlihat - 3 sisanya terdaftar 2020,
 * 2021 dan 2023. Pertanyaan "apakah lengkap" tidak boleh dijawab dari jendela
 * yang memotong jawabannya.
 *
 * ==========================================================================
 * YANG TIDAK DAPAT DIJAWABNYA
 * ==========================================================================
 *
 * listEcourtCases mengikat perkara_efiling ke perkara lewat perkara_efiling_id
 * (INNER JOIN), sehingga pendaftaran yang BELUM pernah menjadi perkara tidak
 * pernah ikut. Terukur: dari 12 pendaftaran bermasalah di perkara_efiling
 * (5 menunggu, 4 ditolak, 3 tidak dapat dilanjutkan), hanya 4 yang tertaut ke
 * perkara. Kedelapan sisanya memang tidak pernah menjadi perkara - jadi ia
 * bukan perkara yang terancam disidangkan, dan menghitungnya di sini akan
 * melebihkan bahayanya. `hanyaYangJadiPerkara` dipulangkan supaya layar dapat
 * mengatakan batas itu alih-alih membiarkan angkanya terbaca sebagai semuanya.
 */
async function cakupanEcourt({ contoh = 25 } = {}) {
  const acuan = await sippReadOnlyBridgeService.safeHandleBridgeOperation("ecourt.caseList", {
    limit: 5000,
    sejakHari: 3650,
  });
  if (!acuan.ok || !acuan.data) {
    return { ok: false, alasan: String(acuan.error || "acuan_sipp_tidak_terbaca") };
  }

  const perkara = Array.isArray(acuan.data.perkara) ? acuan.data.perkara : [];
  const keadaan = await ecourtStoreService.ringkasKekuranganBerkas(
    perkara.map((p) => p.nomorPerkara)
  );

  const pendaftaran = {
    terdaftar: 0,
    menunggu: 0,
    ditolak: 0,
    tidakDapatDilanjutkan: 0,
    lain: 0,
    tanpaKeadaan: 0,
  };
  const bermasalah = [];
  const nomorBerselisih = [];
  let pernahDitarik = 0;
  let berkasLengkap = 0;
  let belumDibayar = 0;
  // Berapa tanggal yang pulang dari jembatan dalam bentuk tak terbaca. Dihitung
  // supaya layar dapat mengatakan "jembatannya rusak" alih-alih memampangkan
  // 2.527 tanda hubung yang terbaca seperti data SIPP yang memang kosong.
  let tanggalRusak = 0;

  for (const p of perkara) {
    const k = keadaan.get(normalizeCaseNumber(p.nomorPerkara));
    const sudahAda = Boolean(k && k.dokumen > 0);
    if (sudahAda) {
      pernahDitarik += 1;
      if (k.tanpaBerkas === 0) berkasLengkap += 1;
    }
    if (p.sudahDibayar === false) belumDibayar += 1;

    const golongan = golonganPendaftaran(p.statusPendaftaran);
    pendaftaran[golongan] += 1;

    if (p.tanggalPendaftaran && !tanggalTerbaca(p.tanggalPendaftaran)) tanggalRusak += 1;

    // Nomor perkara versi e-Court yang berbeda dari versi SIPP. Terukur 2 dari
    // 2.529 baris, dan keduanya BERTUKAR: perkara 4810 bernomor SIPP
    // 61/Pdt.G/2020 tetapi bernomor e-Court 63/Pdt.G/2020, sedangkan perkara
    // 4813 sebaliknya. Menarik dokumen memakai nomor yang salah satu di antara
    // keduanya berarti dokumen perkara 61 mendarat di berkas perkara 63.
    const nomorEcourt = String(p.nomorPerkaraEfiling || "").trim();
    const nomorSipp = String(p.nomorPerkara || "").trim();
    if (nomorEcourt && nomorSipp && nomorEcourt !== nomorSipp) {
      nomorBerselisih.push({ nomorPerkara: nomorSipp, nomorEcourt });
    }

    if (golongan !== "terdaftar") {
      bermasalah.push({
        nomorPerkara: nomorSipp,
        nomorEcourt,
        keadaan: String(p.statusPendaftaran || ""),
        golongan,
        tanggalPendaftaran: tanggalTerbaca(p.tanggalPendaftaran),
        // Dibedakan dari "memang tidak ada tanggalnya": yang pertama adalah
        // cacat jembatan yang harus dibetulkan, yang kedua adalah data SIPP.
        tanggalTidakTerbaca: Boolean(p.tanggalPendaftaran) && !tanggalTerbaca(p.tanggalPendaftaran),
        sudahDibayar: p.sudahDibayar === true,
        pernahDitarik: sudahAda,
      });
    }
  }

  const total = perkara.length;
  const batasContoh = Math.max(0, Number(contoh) || 0);

  return {
    ok: true,
    diperiksaPada: new Date().toISOString(),
    totalSipp: total,
    pernahDitarik,
    belumPernahDitarik: total - pernahDitarik,
    berkasLengkap,
    // Dibulatkan ke bilangan bulat dengan sengaja: "0%" dan "0,04%" sama-sama
    // berarti belum dimulai, dan desimal di sini hanya menyaran ketelitian yang
    // tidak dimiliki angkanya.
    persenDitarik: total > 0 ? Math.round((pernahDitarik / total) * 100) : 0,
    pendaftaran,
    jumlahBermasalah: bermasalah.length,
    // Berapa tanggal yang pulang tak terbaca dari jembatan. Terukur 2.527 dari
    // 2.527 pada 25 Sep 2026 - selama angka ini bukan nol, urutan menurut
    // tanggal di bawah tidak berlaku dan layar harus mengatakannya.
    tanggalRusak,
    // Yang paling genting lebih dulu: pendaftaran batal di atas yang menunggu.
    // Pengurut kedua menurut tanggal baru bekerja setelah cacat tanggal
    // jembatan dibetulkan; hari ini seluruh tanggalnya kosong, jadi urutan di
    // dalam satu golongan mengikuti urutan SIPP (perkara_id menurun).
    bermasalah: bermasalah
      .sort((a, b) => {
        const bobot = { tidakDapatDilanjutkan: 0, ditolak: 1, lain: 2, tanpaKeadaan: 3, menunggu: 4 };
        const selisih = (bobot[a.golongan] ?? 9) - (bobot[b.golongan] ?? 9);
        if (selisih !== 0) return selisih;
        return String(b.tanggalPendaftaran).localeCompare(String(a.tanggalPendaftaran));
      })
      .slice(0, batasContoh),
    belumDibayar,
    jumlahNomorBerselisih: nomorBerselisih.length,
    nomorBerselisih: nomorBerselisih.slice(0, batasContoh),
    // Pendaftaran ganda yang dihitung listEcourtCases: satu perkara dengan
    // lebih dari satu baris e-filing. Terukur 2 dari 2.529 baris kaitan.
    pendaftaranGanda: Number(acuan.data.pendaftaranGanda || 0),
    // Batas jangkauan angka di atas - lihat catatan fungsi ini.
    hanyaYangJadiPerkara: true,
  };
}

/**
 * Seluruh keadaan e-Court dalam satu panggilan.
 *
 * Tiap bagian dibungkus catch sendiri: satu tabel yang belum terbentuk tidak
 * boleh membuat seluruh tab gagal tampil. Petugas lebih terbantu melihat
 * sebagian angka daripada halaman yang kosong tanpa penjelasan.
 */
async function getStatus({ limit = 100 } = {}) {
  const runtimeConfig = readRuntimeConfig();

  const aman = async (fn, bawaan) => {
    try {
      return await fn();
    } catch {
      return bawaan;
    }
  };

  await aman(() => ecourtStoreService.ensureSchema(), false);
  await aman(() => ecourtVerificationService.ensureSchema(), false);
  await aman(() => nomorVerificationService.ensureSchema(), false);

  const [
    totalDokumen,
    belumVerifikasi,
    sudahValid,
    belumDiberitahukan,
    sudahDiberitahukan,
    keputusanTersimpan,
    belumDiteruskan,
    nomorTerverifikasi,
    nomorMenunggu,
    nomorDitolak,
    sinkron,
    rekonsiliasi,
  ] = await Promise.all([
    aman(() => hitung(`SELECT COUNT(*) AS jumlah FROM aleta_bot_ecourt_documents`), 0),
    aman(() => hitung(`SELECT COUNT(*) AS jumlah FROM aleta_bot_ecourt_documents WHERE status_verifikasi = 'belum'`), 0),
    aman(() => hitung(`SELECT COUNT(*) AS jumlah FROM aleta_bot_ecourt_documents WHERE status_verifikasi = 'valid'`), 0),
    aman(
      () =>
        hitung(
          `SELECT COUNT(*) AS jumlah FROM aleta_bot_ecourt_documents
            WHERE status_verifikasi = 'valid' AND diberitahukan_pada IS NULL
              AND alasan_tidak_diberitahukan = ''`
        ),
      0
    ),
    aman(() => hitung(`SELECT COUNT(*) AS jumlah FROM aleta_bot_ecourt_documents WHERE diberitahukan_pada IS NOT NULL`), 0),
    aman(() => hitung(`SELECT COUNT(*) AS jumlah FROM aleta_bot_ecourt_verifications`), 0),
    aman(() => hitung(`SELECT COUNT(*) AS jumlah FROM aleta_bot_ecourt_verifications WHERE diteruskan_pada IS NULL`), 0),
    aman(() => hitung(`SELECT COUNT(*) AS jumlah FROM aleta_bot_nomor_terverifikasi WHERE status = 'terverifikasi'`), 0),
    aman(() => hitung(`SELECT COUNT(*) AS jumlah FROM aleta_bot_nomor_terverifikasi WHERE status = 'menunggu'`), 0),
    aman(() => hitung(`SELECT COUNT(*) AS jumlah FROM aleta_bot_nomor_terverifikasi WHERE status = 'ditolak'`), 0),
    aman(() => sinkronisasiTerakhir(), null),
    aman(() => ecourtReconciliationService.periksa({ limit }), null),
  ]);

  // Empat bagian baru, masing-masing dibungkus aman() sendiri dengan sebab yang
  // sama seperti yang lain: cakupan membaca SIPP, dan SIPP yang tidak terjangkau
  // tidak boleh membuat angka dokumen di sebelahnya ikut hilang.
  const [putaran, arsip, panggilan, cakupan] = await Promise.all([
    aman(() => riwayatPutaran({ limit: 10 }), []),
    aman(() => ringkasArsip(), null),
    aman(() => ringkasPanggilan(), null),
    aman(() => cakupanEcourt({ contoh: 25 }), null),
  ]);

  // Dokumen yang berulang gagal diambil. Diistirahatkan supaya tidak memakan
  // jatah tiap putaran - tetapi HARUS terlihat, sebab yang diistirahatkan
  // diam-diam sama saja dengan yang hilang diam-diam.
  const bermasalah = await aman(() => ecourtStoreService.daftarBerkasBermasalah({ limit: 20 }), []);

  // ==========================================================================
  // BUKAN BERAPA, MELAINKAN SUDAH BERAPA LAMA
  // ==========================================================================
  //
  // Jumlah keputusan yang menunggu diteruskan sudah lama tampil di layar.
  // Tetapi angka "3" tidak memberitahu apa pun yang menentukan: tiga keputusan
  // yang masuk pagi ini adalah pekerjaan hari ini, sedangkan tiga keputusan
  // yang menunggu sejak tiga minggu lalu adalah keputusan hukum yang mengendap
  // - hakim sudah memutus, e-Court belum tahu, dan tidak ada yang menyadarinya
  // karena angkanya sama saja.
  //
  // Penerusan ke e-Court memang dijalankan manusia dengan pengawasan, dan itu
  // disengaja. Justru karena itu umurnya harus terlihat: pekerjaan yang
  // menunggu orang perlu tahu sejak kapan ia menunggu.
  const tertua = await aman(async () => {
    const rows = await botDb.query(
      `SELECT nomor_perkara AS nomorPerkara, judul_dokumen AS judulDokumen,
              nama_hakim AS namaHakim, keputusan, diputuskan_pada AS diputuskanPada
         FROM aleta_bot_ecourt_verifications
        WHERE diteruskan_pada IS NULL
        ORDER BY diputuskan_pada ASC
        LIMIT 1`
    );
    const baris = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (!baris) return null;

    const waktu = botDb.fromMysqlDate(baris.diputuskanPada);
    const umurHari = waktu ? Math.floor((Date.now() - waktu.getTime()) / 86400000) : null;

    return {
      nomorPerkara: String(baris.nomorPerkara || ""),
      judulDokumen: String(baris.judulDokumen || ""),
      namaHakim: String(baris.namaHakim || ""),
      keputusan: String(baris.keputusan || ""),
      diputuskanPada: waktu ? waktu.toISOString() : "",
      umurHari,
    };
  }, null);

  return {
    diperiksaPada: new Date().toISOString(),
    aktif: runtimeConfig.ecourtNotifikasiAktif !== false,
    sinkronisasiTerakhir: sinkron,
    // Urutan putaran, bukan hanya putaran terakhir: satu kegagalan dan sepuluh
    // kegagalan berturut-turut adalah dua keadaan yang berbeda jauh.
    putaran,
    // Berapa berkas arsip dan sebesar apa. null berarti tidak terbaca - bukan
    // berarti nol.
    arsip,
    // Panggilan elektronik dan persetujuan pihak, keduanya sudah lama tersimpan
    // dan belum pernah terbaca satu layar pun.
    panggilan,
    // Penyebut dari pertanyaan "apakah sinkronisasinya lengkap".
    cakupan,
    dokumen: {
      total: totalDokumen,
      belumVerifikasi,
      sudahValid,
      belumDiberitahukan,
      sudahDiberitahukan,
      // Berulang gagal diambil - berkasnya tidak akan datang sendiri.
      bermasalah: bermasalah.length,
      daftarBermasalah: bermasalah,
    },
    verifikasi: {
      keputusanTersimpan,
      belumDiteruskan,
      // Keputusan tertua yang masih menunggu diteruskan, beserta umurnya.
      // null berarti antreannya kosong - bukan berarti tidak terbaca.
      tertua,
    },
    nomor: {
      terverifikasi: nomorTerverifikasi,
      menunggu: nomorMenunggu,
      ditolak: nomorDitolak,
    },
    rekonsiliasi: rekonsiliasi
      ? { ringkasan: rekonsiliasi.ringkasan, selisih: rekonsiliasi.selisih.slice(0, 50) }
      : null,
    // Aturan pengklasifikasi ditampilkan supaya petugas tahu judul dokumen apa
    // yang memicu pemberitahuan ke siapa - tanpa perlu membuka kode.
    aturan: ecourtClassifier.listClasses(runtimeConfig).map((item) => ({
      key: item.key,
      label: item.label,
      patterns: item.patterns,
      notify: item.notify !== false,
      audience: item.audience || "",
      tenggatBerlaku: item.tenggatBerlaku !== false,
      ringkasan: item.ringkasan || "",
      tindakan: item.tindakan || "",
    })),
  };
}

/** Dokumen terbaru, untuk melihat apa yang sedang masuk. */
async function getDokumenTerbaru({ limit = 25 } = {}) {
  const batas = Math.max(1, Math.min(200, Number(limit) || 25));
  try {
    const rows = await botDb.query(
      `SELECT document_key, nomor_perkara, judul_dokumen, peran_pengunggah,
              status_verifikasi, diunggah_pada, batas_unggah_teks,
              diberitahukan_pada, alasan_tidak_diberitahukan
         FROM aleta_bot_ecourt_documents
        ORDER BY terakhir_terlihat DESC
        LIMIT ${batas}`
    );
    return (Array.isArray(rows) ? rows : []).map((row) => ({
      documentKey: row.document_key,
      nomorPerkara: row.nomor_perkara,
      judulDokumen: row.judul_dokumen,
      peranPengunggah: row.peran_pengunggah,
      statusVerifikasi: row.status_verifikasi,
      diunggahPada: row.diunggah_pada,
      batasUnggahTeks: row.batas_unggah_teks,
      sudahDiberitahukan: Boolean(row.diberitahukan_pada),
      alasanTidakDiberitahukan: row.alasan_tidak_diberitahukan || "",
    }));
  } catch {
    return [];
  }
}

module.exports = {
  getDokumenTerbaru,
  getStatus,
  sinkronisasiTerakhir,
  // Dibuka satu per satu supaya tiap angka dapat dibuktikan sendiri tanpa
  // menjalankan seluruh getStatus - lihat src/test/admin-integrasi-ecourt.test.ts.
  riwayatPutaran,
  ringkasArsip,
  ringkasPanggilan,
  cakupanEcourt,
  golonganPendaftaran,
};
