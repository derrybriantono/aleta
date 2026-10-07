"use strict";

/**
 * ============================================================================
 * PENANDA VERIFIKASI MAJELIS UNTUK PERKARA E-LITIGASI HARI INI (5 Okt 2026, butir 30)
 * ============================================================================
 *
 * Jadwal Sidang menampilkan SATU penanda di samping nomor perkara e-Litigasi
 * (perkara gugatan yang terdaftar lewat e-Court) yang bersidang HARI INI:
 *
 *   sudah        tidak ada dokumen persidangan yang menunggu verifikasi majelis
 *   belum        ada dokumen yang menunggu (definisi: dokumenMenungguMajelis)
 *   tidak-konek  datanya belum terbaca dari e-Court hari ini dan penariknya
 *                tidak tersambung (bot / sesi e-Court habis / tanpa akun siap)
 *
 * SUMBER DATANYA SUDAH ADA: aleta_bot_ecourt_documents.status_verifikasi,
 * diisi jembatan e-Court (tools/ecourt-bridge/run.js) dari halaman perkara
 * e-Court, dan aleta_bot_ecourt_verifications (keputusan hakim lewat ALETA,
 * beserta namanya). Portal hanya MEMBACA simpanan ini - tidak ada penarikan
 * e-Court saat halaman dimuat.
 *
 * PENARIKAN LATAR - RINGAN DAN BERHENTI SENDIRI
 *
 *   - tiap 15 menit (ALETA_ECOURT_VERIFIKASI_JEDA_MS), hanya hari/jam kerja
 *     penjadwal e-Court;
 *   - SATU perkara per putaran (yang paling lama tidak ditarik), lewat
 *     jalankanSatuPutaran penjadwal e-Court yang sudah ada dengan
 *     --tanpa-unduh: hanya daftar dokumen + status verifikasinya, tanpa
 *     mengunduh berkas. Akunnya akun bersama penarik data
 *     (ecourtAkunService.pilihAkunSiap) - BUKAN sesi pribadi petugas;
 *   - BERHENTI untuk hari itu begitu seluruh perkara e-Litigasi hari ini
 *     "sudah"; mulai lagi bila ada perkara e-Litigasi BARU hari itu, atau
 *     esok hari.
 *
 * Mematikan: ALETA_ECOURT_VERIFIKASI_AKTIF=0.
 */

const { normalizeCaseNumber, cleanText } = require("./ecourtTextService");

/** Selang penarikan bawaan. */
const JEDA_BAWAAN_MS = 15 * 60 * 1000;

const POLA_GUGATAN = /\/Pdt\.G(\.S)?\//i;

/**
 * Tarikan satu perkara dari penanda "belum upload" (7 Okt 2026): jeda minimal
 * per perkara sesudah selesai, dan batas waktu satu tarikan. Jeda tidak dapat
 * di bawah 60 dtk walau env-nya disetel lebih kecil - e-Court milik MA.
 */
const JEDA_MIN_TARIK_PERKARA_MS = 60 * 1000;
const BATAS_TARIK_PERKARA_MS = 5 * 60 * 1000;

function jedaTarikBawaan() {
  const n = Number(process.env.ALETA_ECOURT_TARIK_PERKARA_JEDA_MS);
  return Number.isFinite(n) && n > 0 ? n : JEDA_MIN_TARIK_PERKARA_MS;
}

function bersih(nilai) {
  return String(nilai === null || nilai === undefined ? "" : nilai).trim();
}

/** "YYYY-MM-DD" dari Date lokal. */
function tanggalLokal(t = new Date()) {
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

/** "YYYY-MM-DD HH:MM:SS" dari nilai waktu apa pun, "" bila tidak terbaca. */
function waktuTeks(nilai) {
  if (!nilai) return "";
  if (nilai instanceof Date) {
    if (Number.isNaN(nilai.getTime())) return "";
    const d = (n) => String(n).padStart(2, "0");
    return `${nilai.getFullYear()}-${d(nilai.getMonth() + 1)}-${d(nilai.getDate())} ${d(nilai.getHours())}:${d(nilai.getMinutes())}:${d(nilai.getSeconds())}`;
  }
  const cocok = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(:\d{2})?)/.exec(bersih(nilai));
  return cocok ? `${cocok[1]} ${cocok[2].length === 5 ? `${cocok[2]}:00` : cocok[2]}` : "";
}

/**
 * Keadaan SATU perkara - fungsi murni.
 *
 * @param {object} o
 * @param {Array} o.dokumen baris dokumen perkara itu (tersimpan)
 * @param {boolean} o.diperiksaHariIni sudah ditarik dengan berhasil hari ini
 * @param {boolean} o.penarikTersambung penarik dapat menarik (akun/sesi siap)
 * @param {(d: object) => boolean} o.menunggu definisi dokumen menunggu majelis
 */
function keadaanPerkara({
  dokumen = [],
  diperiksaHariIni = false,
  penarikTersambung = true,
  menunggu,
  perluUnggah = false,
  sidangLalu = "",
}) {
  const belum = dokumen.filter((d) => menunggu(d)).length;
  if (belum > 0) return { keadaan: "belum", belum, unggahBaru: unggahSesudah(dokumen, sidangLalu) };
  // Tidak ada yang menunggu menurut data tersimpan. Itu "sudah" bila datanya
  // segar (ditarik hari ini) atau memang ada dokumen yang sudah dibaca dan
  // tidak satu pun menunggu; tanpa data sama sekali dan penarik tidak
  // tersambung, keadaannya tidak diketahui -> tidak konek.
  if (diperiksaHariIni || dokumen.length > 0) {
    // 6 Okt 2026 (keadaan keempat): agenda hari ini menuntut dokumen pihak
    // (jawaban, replik, duplik, kesimpulan) tetapi sejak sidang sebelumnya
    // belum ada satu pun dokumen persidangan yang diunggah - "sudah
    // diverifikasi" di sana menyesatkan, sebab yang diverifikasi dokumen lama.
    const unggahBaru = unggahSesudah(dokumen, sidangLalu);
    if (perluUnggah && sidangLalu && unggahBaru === 0) return { keadaan: "belum-upload", belum: 0, unggahBaru };
    return { keadaan: "sudah", belum: 0, unggahBaru };
  }
  return { keadaan: penarikTersambung ? "belum-diperiksa" : "tidak-konek", belum: 0, unggahBaru: 0 };
}

/**
 * Agenda yang menuntut pihak mengunggah dokumen lewat e-Court sebelum sidang.
 * Pembacaan putusan dan musyawarah majelis tidak - dokumennya bukan dari pihak.
 */
const POLA_AGENDA_UNGGAH = /jawab|replik|duplik|kesimpulan/i;

function agendaPerluUnggah(agenda) {
  return POLA_AGENDA_UNGGAH.test(bersih(agenda));
}

/**
 * Jumlah dokumen persidangan (bukan berkas pendaftaran - status "tidak_perlu")
 * yang diunggah SESUDAH hari sidang sebelumnya. Sehari sidang lalu itu sendiri
 * tidak dihitung: unggahan pada hari itu milik sidang itu, bukan sidang ini.
 */
function unggahSesudah(dokumen, sidangLalu) {
  const batas = bersih(sidangLalu).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(batas)) return 0;
  return dokumen.filter((d) => {
    if (bersih(d.statusVerifikasi) === "tidak_perlu") return false;
    const tgl = waktuTeks(d.diunggahPada).slice(0, 10);
    return Boolean(tgl) && tgl > batas;
  }).length;
}

/**
 * Layanan dengan ketergantungan yang dapat ditukar (uji memakai tiruan).
 */
function buatLayanan(deps = {}) {
  const kueriSipp =
    deps.kueriSipp ||
    ((sql, params = []) =>
      new Promise((selesai, gagal) => {
        require("../db_config").query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil)));
      }));
  const kueriBot = deps.kueriBot || ((sql, params = []) => require("./botDbService").query(sql, params));
  const menunggu = deps.menunggu || ((d) => require("./ecourtStoreService").dokumenMenungguMajelis(d));
  const tarik =
    deps.tarik ||
    ((nomorPerkara) =>
      require("./ecourtSchedulerService").jalankanSatuPutaran({
        nomorPerkara,
        maksPerkara: 0,
        tanpaUnduh: true,
        sumber: "verifikasi",
      }));
  // Tarikan SATU perkara dari penanda "belum upload" (7 Okt 2026): jembatan
  // yang sama, TANPA --tanpa-unduh (berkas baru ikut diunduh ke arsip yang
  // di-mount), dengan batas waktu pendek - ada orang yang menunggunya.
  const tarikPerkara =
    deps.tarikPerkara ||
    ((nomorPerkara) =>
      require("./ecourtSchedulerService").jalankanSatuPutaran({
        nomorPerkara,
        maksPerkara: 0,
        sumber: "jadwal-belum-upload",
        batasMs: BATAS_TARIK_PERKARA_MS,
      }));
  // Penarikan lain (berkala, menyeluruh, dari PuTTY) yang sedang berjalan.
  const sibuk =
    deps.sibuk ||
    (() => {
      const s = require("./ecourtSchedulerService").getStatus();
      if (s.sedangJalan) {
        return { sibuk: true, keterangan: [s.sumber, s.perkaraDiminta].filter(Boolean).join(", ") };
      }
      if (s.adaPenarikanLain) return { sibuk: true, keterangan: "dari server" };
      return { sibuk: false, keterangan: "" };
    });
  const jedaMs = Math.max(JEDA_MIN_TARIK_PERKARA_MS, Number(deps.jedaTarikMs) || jedaTarikBawaan());
  const akunSiap = deps.akunSiap || (() => require("./ecourtAkunService").pilihAkunSiap().ok === true);
  // Hanya bila penjadwal e-Court DINYALAKAN admin (bawaannya mati: menarik
  // dari sistem Mahkamah Agung tanpa diminta tidak pantas menyala sendiri
  // oleh pembaruan) dan dalam hari/jam kerjanya.
  const bolehJalan =
    deps.bolehJalan ||
    ((kini) => {
      const penjadwal = require("./ecourtSchedulerService");
      const atur = penjadwal.getSettings();
      return atur.aktif === true && penjadwal.dalamJamKerja(kini, atur);
    });
  const sekarang = deps.sekarang || (() => new Date());

  /** Keadaan penarik - dalam memori; data verifikasinya sendiri di basis data. */
  const penarik = {
    tanggal: "",
    /** nomor (dinormalkan) -> waktu tarik BERHASIL terakhir (ms) hari ini. */
    berhasil: new Map(),
    /** nomor -> waktu tarik terakhir (berhasil atau tidak) hari ini - pemutar giliran. */
    dicoba: new Map(),
    /** Berhenti untuk hari ini - kunci daftar perkara saat berhenti. */
    berhentiUntuk: "",
    tersambung: true,
    alasanTakTersambung: "",
    terakhirPutaran: "",
    jumlahTarik: 0,
  };

  function gantiHari(hari) {
    if (penarik.tanggal === hari) return;
    penarik.tanggal = hari;
    penarik.berhasil = new Map();
    penarik.dicoba = new Map();
    penarik.berhentiUntuk = "";
  }

  /** Perkara e-Litigasi gugatan yang bersidang pada tanggal itu - SIPP. */
  async function perkaraElitigasi(tanggal) {
    // Agenda sidang hari itu dan tanggal sidang SEBELUMNYA ikut dibaca: keduanya
    // menentukan keadaan "belum upload" (lihat keadaanPerkara).
    const baris = await kueriSipp(
      `SELECT p.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara,
              MAX(j.agenda) AS agenda,
              (SELECT MAX(j2.tanggal_sidang) FROM perkara_jadwal_sidang j2
                WHERE j2.perkara_id = p.perkara_id AND j2.tanggal_sidang < ?) AS sidangLalu
         FROM perkara_jadwal_sidang j
         JOIN perkara p ON p.perkara_id = j.perkara_id
         JOIN perkara_efiling_id k ON k.perkara_id = j.perkara_id
        WHERE j.tanggal_sidang = ?
        GROUP BY p.perkara_id, p.nomor_perkara`,
      [tanggal, tanggal]
    );
    return (Array.isArray(baris) ? baris : [])
      .map((b) => ({
        perkaraId: bersih(b.perkaraId),
        nomorPerkara: cleanText(b.nomorPerkara),
        agenda: cleanText(b.agenda),
        sidangLalu: waktuTeks(b.sidangLalu).slice(0, 10) || bersih(b.sidangLalu).slice(0, 10),
      }))
      .filter((b) => b.nomorPerkara && POLA_GUGATAN.test(b.nomorPerkara));
  }

  /** Dokumen tersimpan + siapa yang memverifikasi lewat ALETA, per nomor dinormalkan. */
  async function dataTersimpan(daftarNomor) {
    const nomor = [...new Set(daftarNomor.map((n) => normalizeCaseNumber(n)).filter(Boolean))];
    const dokumen = new Map(nomor.map((n) => [n, []]));
    const oleh = new Map(nomor.map((n) => [n, []]));
    if (nomor.length === 0) return { dokumen, oleh };
    const isian = nomor.map(() => "?").join(", ");
    const baris = await kueriBot(
      `SELECT nomor_perkara AS nomorPerkara, judul_dokumen AS judulDokumen, diunggah_pada AS diunggahPada,
              status_verifikasi AS statusVerifikasi, terakhir_terlihat AS terakhirTerlihat
         FROM aleta_bot_ecourt_documents
        WHERE nomor_perkara IN (${isian})`,
      nomor
    );
    for (const b of Array.isArray(baris) ? baris : []) {
      const k = normalizeCaseNumber(b.nomorPerkara);
      if (dokumen.has(k)) dokumen.get(k).push(b);
    }
    try {
      const keputusan = await kueriBot(
        `SELECT nomor_perkara AS nomorPerkara, nama_hakim AS namaHakim, keputusan,
                diputuskan_pada AS diputuskanPada
           FROM aleta_bot_ecourt_verifications
          WHERE nomor_perkara IN (${isian})
          ORDER BY diputuskan_pada DESC`,
        nomor
      );
      for (const b of Array.isArray(keputusan) ? keputusan : []) {
        const k = normalizeCaseNumber(b.nomorPerkara);
        const nama = cleanText(b.namaHakim);
        if (oleh.has(k) && nama && !oleh.get(k).includes(nama)) oleh.get(k).push(nama);
      }
    } catch {
      // Tabel keputusan ALETA belum ada: tidak ada nama yang dapat disebut.
    }
    return { dokumen, oleh };
  }

  /**
   * Keadaan seluruh perkara e-Litigasi pada tanggal itu - dibaca portal.
   * Tidak menarik e-Court.
   */
  async function keadaanHari(tanggal = tanggalLokal(sekarang())) {
    const hari = bersih(tanggal).slice(0, 10) || tanggalLokal(sekarang());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(hari)) return { ok: false, alasan: "tanggal_tidak_sah" };
    const hariIni = tanggalLokal(sekarang());
    const daftar = await perkaraElitigasi(hari);
    const { dokumen, oleh } = await dataTersimpan(daftar.map((d) => d.nomorPerkara));
    const perkara = {};
    for (const p of daftar) {
      const k = normalizeCaseNumber(p.nomorPerkara);
      const dok = dokumen.get(k) || [];
      const tarikMs = hari === hariIni && penarik.tanggal === hariIni ? penarik.berhasil.get(k) : undefined;
      const terlihat = dok.map((d) => waktuTeks(d.terakhirTerlihat)).filter(Boolean).sort().pop() || "";
      const terakhirDiperiksa = [tarikMs ? waktuTeks(new Date(tarikMs)) : "", terlihat].filter(Boolean).sort().pop() || "";
      const k1 = keadaanPerkara({
        dokumen: dok,
        diperiksaHariIni: Boolean(tarikMs) || terlihat.slice(0, 10) === hariIni,
        penarikTersambung: penarik.tersambung,
        menunggu,
        perluUnggah: agendaPerluUnggah(p.agenda),
        sidangLalu: p.sidangLalu,
      });
      perkara[p.nomorPerkara] = {
        perkaraId: p.perkaraId,
        nomorPerkara: p.nomorPerkara,
        // "belum-diperiksa" (penarik tersambung, belum gilirannya) tampil
        // sebagai tidak-konek di layar sampai tarikan pertamanya.
        keadaan: k1.keadaan === "belum-diperiksa" ? "tidak-konek" : k1.keadaan,
        belumDiperiksa: k1.keadaan === "belum-diperiksa",
        menunggu: k1.belum,
        dokumen: dok.length,
        terakhirDiperiksa,
        diverifikasiOleh: oleh.get(k) || [],
        agenda: p.agenda,
        sidangLalu: p.sidangLalu,
        unggahSejakSidangLalu: k1.unggahBaru,
      };
    }
    return {
      ok: true,
      tanggal: hari,
      perkara,
      penarik: {
        tersambung: penarik.tersambung,
        alasan: penarik.alasanTakTersambung,
        berhentiHariIni: hari === hariIni && Boolean(penarik.berhentiUntuk),
        terakhirPutaran: penarik.terakhirPutaran,
      },
    };
  }

  /**
   * Satu putaran penarik. Dipanggil pewaktu tiap 15 menit.
   * @returns {Promise<{jalan: boolean, alasan?: string, nomorPerkara?: string, kode?: number}>}
   */
  async function putaran() {
    const kini = sekarang();
    const hari = tanggalLokal(kini);
    gantiHari(hari);
    penarik.terakhirPutaran = waktuTeks(kini);
    if (!bolehJalan(kini)) return { jalan: false, alasan: "di_luar_jam_kerja" };

    const daftar = await perkaraElitigasi(hari);
    if (daftar.length === 0) return { jalan: false, alasan: "tidak_ada_perkara_elitigasi" };
    const kunciDaftar = daftar.map((d) => normalizeCaseNumber(d.nomorPerkara)).sort().join(",");

    // Berhenti untuk hari ini - kecuali ada perkara e-Litigasi BARU hari ini.
    if (penarik.berhentiUntuk && penarik.berhentiUntuk === kunciDaftar) {
      return { jalan: false, alasan: "semua_sudah_diverifikasi" };
    }
    penarik.berhentiUntuk = "";

    const { dokumen } = await dataTersimpan(daftar.map((d) => d.nomorPerkara));
    const perlu = daftar.filter((p) => {
      const k = normalizeCaseNumber(p.nomorPerkara);
      const dok = dokumen.get(k) || [];
      // Perkara yang belum ditarik HARI INI selalu perlu sekali tarikan
      // (datanya mungkin basi); sesudahnya hanya yang masih menunggu majelis
      // atau yang dokumennya belum diunggah pihak (dapat masuk sepanjang hari).
      if (!penarik.berhasil.has(k)) return true;
      return (
        keadaanPerkara({
          dokumen: dok,
          diperiksaHariIni: true,
          menunggu,
          perluUnggah: agendaPerluUnggah(p.agenda),
          sidangLalu: p.sidangLalu,
        }).keadaan !== "sudah"
      );
    });
    if (perlu.length === 0) {
      penarik.berhentiUntuk = kunciDaftar;
      return { jalan: false, alasan: "semua_sudah_diverifikasi" };
    }

    if (!akunSiap()) {
      penarik.tersambung = false;
      penarik.alasanTakTersambung = "tidak ada akun penarik e-Court yang sesinya siap";
      return { jalan: false, alasan: "akun_tidak_siap" };
    }

    // Giliran: yang paling lama tidak dicoba hari ini lebih dulu.
    perlu.sort(
      (a, b) =>
        (penarik.dicoba.get(normalizeCaseNumber(a.nomorPerkara)) || 0) -
        (penarik.dicoba.get(normalizeCaseNumber(b.nomorPerkara)) || 0)
    );
    const target = perlu[0];
    const k = normalizeCaseNumber(target.nomorPerkara);
    penarik.dicoba.set(k, kini.getTime());
    penarik.jumlahTarik += 1;
    const hasil = (await Promise.resolve(tarik(target.nomorPerkara)).catch((e) => ({ kode: -1, catatan: String(e) }))) || {};
    if (hasil.dilewati) return { jalan: false, alasan: hasil.alasan || "dilewati", nomorPerkara: target.nomorPerkara };
    if (hasil.kode === 0) {
      penarik.berhasil.set(k, sekarang().getTime());
      penarik.tersambung = true;
      penarik.alasanTakTersambung = "";
    } else {
      penarik.tersambung = false;
      penarik.alasanTakTersambung = hasil.kode === 2 ? "sesi e-Court habis" : bersih(hasil.catatan) || "penarikan gagal";
    }
    return { jalan: true, nomorPerkara: target.nomorPerkara, kode: hasil.kode };
  }

  function status() {
    return { ...penarik, berhasil: Object.fromEntries(penarik.berhasil), dicoba: Object.fromEntries(penarik.dicoba) };
  }

  // ==========================================================================
  // TARIK SEKARANG - SATU PERKARA, DARI PENANDA "BELUM UPLOAD" (7 Okt 2026)
  // ==========================================================================
  //
  // Penanda "belum upload" di Jadwal Sidang dapat ditekan: ALETA menarik ulang
  // e-Court HANYA untuk perkara itu - daftar dokumen e-Litigasi dan berkas baru
  // yang belum ada di arsip (jembatan yang sama, --perkara, TANPA --tanpa-unduh;
  // berkas yang sudah ada dilewati jembatan sendiri). Hasilnya ditulis ke tabel
  // dan folder arsip yang sama dengan penarikan berkala.
  //
  // Penjagaan terhadap banjir ke e-Court:
  //   - SATU tarikan per perkara pada satu waktu: penekanan kedua (orang yang
  //     sama atau orang lain) bergabung ke tarikan yang sedang berjalan;
  //   - JEDA per perkara sesudah selesai (bawaan 60 dtk, tidak dapat di bawah
  //     60 dtk) - dalam jeda itu hasil terakhir yang dijawab;
  //   - penarikan lain (berkala, menyeluruh, PuTTY) sedang berjalan -> ditolak
  //     dengan sebab, bukan diantrekan diam-diam;
  //   - jeda manusiawi antar halaman tetap milik jembatan, tidak dipercepat.

  /** nomor dinormalkan -> tarikan terakhir (berjalan atau sudah selesai). */
  const tarikan = new Map();

  /** Potret dokumen + berkas satu perkara di arsip ALETA - pembanding sebelum/sesudah. */
  async function potretPerkara(nomorNormal) {
    const dok = await kueriBot(
      `SELECT document_key AS documentKey, judul_dokumen AS judulDokumen, peran_pengunggah AS peranPengunggah,
              diunggah_pada AS diunggahPada, status_verifikasi AS statusVerifikasi, terakhir_terlihat AS terakhirTerlihat
         FROM aleta_bot_ecourt_documents
        WHERE nomor_perkara = ?`,
      [nomorNormal]
    );
    let berkas = [];
    try {
      berkas = await kueriBot(
        `SELECT document_key AS documentKey, COUNT(*) AS jumlah
           FROM aleta_bot_ecourt_files
          WHERE nomor_perkara = ? AND dihapus_retensi IS NULL
          GROUP BY document_key`,
        [nomorNormal]
      );
    } catch {
      berkas = [];
    }
    const jumlahBerkas = new Map();
    for (const b of Array.isArray(berkas) ? berkas : []) jumlahBerkas.set(bersih(b.documentKey), Number(b.jumlah) || 0);
    return { dokumen: Array.isArray(dok) ? dok : [], jumlahBerkas };
  }

  function ringkasTarikan(t) {
    if (!t) return null;
    const { _janji, ...isi } = t;
    return { ...isi };
  }

  /**
   * Memulai (atau bergabung ke) tarikan satu perkara. TIDAK menunggu selesai -
   * jembatan e-Court butuh 1-3 menit (daftar disapu lebih dulu); portal
   * menanyakan hasilnya lewat statusTarikan().
   */
  async function tarikSekarang({ nomorPerkara = "", tanggal = "", olehSiapa = "" } = {}) {
    const nomor = cleanText(nomorPerkara);
    const k = normalizeCaseNumber(nomor);
    if (!k) return { ok: false, alasan: "nomor_perkara_kosong", pesan: "Nomor perkara kosong." };
    const kini = sekarang();
    const hari = bersih(tanggal).slice(0, 10) || tanggalLokal(kini);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(hari)) return { ok: false, alasan: "tanggal_tidak_sah", pesan: "Tanggal sidang tidak sah." };

    // 1. Sedang berjalan -> bergabung, bukan tarikan kedua.
    const lama = tarikan.get(k);
    if (lama && lama.status === "berjalan") return { ok: true, bergabung: true, tarikan: ringkasTarikan(lama) };

    // 2. Jeda per perkara sesudah tarikan terakhir selesai.
    if (lama && lama.selesaiMs) {
      const sisa = jedaMs - (kini.getTime() - lama.selesaiMs);
      if (sisa > 0) {
        return {
          ok: true,
          jeda: true,
          sisaDetik: Math.ceil(sisa / 1000),
          tarikan: ringkasTarikan(lama),
        };
      }
    }

    // Tempat dipesan SEKARANG, sebelum await pertama: dua penekanan yang
    // datang hampir bersamaan (dua pengguna) tidak boleh sama-sama lolos
    // pemeriksaan 1 lalu memulai dua tarikan. Yang kedua bergabung ke ini.
    const t = {
      id: `${k}@${kini.getTime()}`,
      nomorPerkara: nomor,
      tanggal: hari,
      status: "berjalan",
      mulai: waktuTeks(kini),
      mulaiMs: kini.getTime(),
      selesai: "",
      selesaiMs: 0,
      olehSiapa: bersih(olehSiapa).slice(0, 120),
      dokumenBaru: [],
      berkasBaru: 0,
      pesan: "Memeriksa e-Court...",
      perkara: null,
    };
    tarikan.set(k, t);

    /** Ditolak sebelum menarik apa pun - tanpa jeda, tetap terbaca oleh yang bergabung. */
    const tolak = (alasan, pesan) => {
      t.status = "ditolak";
      t.alasan = alasan;
      t.pesan = pesan;
      t.selesai = waktuTeks(sekarang());
      t.selesaiMs = 0;
      return { ok: false, alasan, pesan, tarikan: ringkasTarikan(t) };
    };

    // 3. Hanya perkara e-Litigasi yang bersidang pada tanggal itu - tombolnya
    //    hidup di penanda yang sama, dan bot tidak menjadi penarik serba-guna.
    let target = null;
    try {
      const daftar = await perkaraElitigasi(hari);
      target = daftar.find((p) => normalizeCaseNumber(p.nomorPerkara) === k) || null;
    } catch (e) {
      return tolak("sipp_tidak_terbaca", `Jadwal SIPP tidak terbaca: ${String((e && e.message) || e).slice(0, 160)}`);
    }
    if (!target) {
      return tolak(
        "bukan_elitigasi_hari_itu",
        "Perkara ini tidak terbaca sebagai perkara e-Litigasi yang bersidang pada tanggal itu."
      );
    }
    t.nomorPerkara = target.nomorPerkara;

    // 4. Penarikan lain sedang berjalan - ditolak dengan sebab.
    const lain = sibuk();
    if (lain && lain.sibuk) {
      return tolak(
        "penarikan_lain_berjalan",
        `Penarikan e-Court lain sedang berjalan${lain.keterangan ? ` (${lain.keterangan})` : ""} - coba lagi sebentar lagi.`
      );
    }

    // 5. Tanpa akun bersesi tidak ada yang dapat ditarik.
    if (!akunSiap()) {
      penarik.tersambung = false;
      penarik.alasanTakTersambung = "tidak ada akun penarik e-Court yang sesinya siap";
      return tolak(
        "akun_tidak_siap",
        "Tidak ada akun e-Court yang sesinya siap - sesi e-Court habis atau belum masuk. Minta admin masuk ulang di menu Integrasi e-Court."
      );
    }

    const sebelum = await potretPerkara(k).catch(() => ({ dokumen: [], jumlahBerkas: new Map() }));
    penarik.dicoba.set(k, kini.getTime());
    penarik.jumlahTarik += 1;

    t._janji = (async () => {
      const hasil =
        (await Promise.resolve()
          .then(() => tarikPerkara(target.nomorPerkara))
          .catch((e) => ({ kode: -1, catatan: String((e && e.message) || e) }))) || {};
      const akhir = sekarang();
      t.selesai = waktuTeks(akhir);
      t.selesaiMs = akhir.getTime();
      if (hasil.dilewati) {
        // Kalah balapan dengan penarikan lain yang mulai sesudah pemeriksaan
        // di atas. Jedanya tidak dikenakan - tidak ada yang ditarik.
        t.status = "sibuk";
        t.selesaiMs = 0;
        t.pesan = "Penarikan e-Court lain sedang berjalan - coba lagi sebentar lagi.";
        return;
      }
      if (hasil.kode === 2) {
        penarik.tersambung = false;
        penarik.alasanTakTersambung = "sesi e-Court habis";
        t.status = "sesi-habis";
        t.pesan = "Sesi e-Court habis - minta admin masuk ulang di menu Integrasi e-Court, lalu tekan lagi.";
        return;
      }
      if (hasil.kode !== 0) {
        penarik.tersambung = false;
        penarik.alasanTakTersambung = bersih(hasil.catatan) || "penarikan gagal";
        t.status = "gagal";
        t.pesan = `Penarikan e-Court gagal: ${bersih(hasil.catatan) || "tanpa keterangan"}`;
        return;
      }
      penarik.berhasil.set(k, akhir.getTime());
      penarik.tersambung = true;
      penarik.alasanTakTersambung = "";
      // Hari ini sudah ada tarikan; penarik berkala tidak boleh berhenti
      // diam-diam memakai daftar lama - biar ia menimbang ulang.
      penarik.berhentiUntuk = "";

      const sesudah = await potretPerkara(k).catch(() => ({ dokumen: [], jumlahBerkas: new Map() }));
      const kunciLama = new Set(sebelum.dokumen.map((d) => bersih(d.documentKey)));
      t.dokumenBaru = sesudah.dokumen
        .filter((d) => !kunciLama.has(bersih(d.documentKey)))
        .map((d) => ({
          judul: cleanText(d.judulDokumen) || "(tanpa judul)",
          peran: cleanText(d.peranPengunggah),
          diunggahPada: waktuTeks(d.diunggahPada),
        }));
      let berkasBaru = 0;
      for (const [kunci, n] of sesudah.jumlahBerkas) berkasBaru += Math.max(0, n - (sebelum.jumlahBerkas.get(kunci) || 0));
      t.berkasBaru = berkasBaru;

      // Keadaan baris itu dihitung ulang dengan aturan yang SAMA dengan
      // keadaanHari - portal menimpanya ke barisnya tanpa memuat ulang tabel.
      const ulang = await keadaanHari(hari).catch(() => null);
      t.perkara = (ulang && ulang.ok && ulang.perkara && ulang.perkara[target.nomorPerkara]) || null;
      t.status = "selesai";
      const jam = t.selesai.slice(11, 16).replace(":", ".");
      if (t.dokumenBaru.length > 0) {
        t.pesan = `${t.dokumenBaru.length} dokumen baru: ${t.dokumenBaru.map((d) => d.judul).join(", ")}`;
      } else if (t.perkara && t.perkara.keadaan === "belum-upload") {
        t.pesan = `Masih belum diunggah pihak (diperiksa ${jam})`;
      } else {
        t.pesan = `Tidak ada dokumen baru (diperiksa ${jam})`;
      }
    })().catch((e) => {
      t.status = "gagal";
      t.selesai = waktuTeks(sekarang());
      t.selesaiMs = sekarang().getTime();
      t.pesan = `Penarikan e-Court gagal: ${String((e && e.message) || e).slice(0, 200)}`;
    });

    return { ok: true, dimulai: true, tarikan: ringkasTarikan(t) };
  }

  /** Keadaan tarikan terakhir satu perkara (berjalan / selesai), null bila belum pernah. */
  function statusTarikan(nomorPerkara = "") {
    const k = normalizeCaseNumber(cleanText(nomorPerkara));
    const t = k ? tarikan.get(k) : null;
    if (!t) return { ok: true, ada: false, tarikan: null };
    const sisa = t.selesaiMs ? jedaMs - (sekarang().getTime() - t.selesaiMs) : 0;
    return { ok: true, ada: true, tarikan: ringkasTarikan(t), sisaJedaDetik: sisa > 0 ? Math.ceil(sisa / 1000) : 0 };
  }

  /** Untuk uji: menunggu tarikan satu perkara selesai. */
  async function tungguTarikan(nomorPerkara = "") {
    const t = tarikan.get(normalizeCaseNumber(cleanText(nomorPerkara)));
    if (t && t._janji) await t._janji;
  }

  return {
    keadaanHari,
    putaran,
    status,
    perkaraElitigasi,
    dataTersimpan,
    tarikSekarang,
    statusTarikan,
    tungguTarikan,
  };
}

let bawaan = null;
function layanan() {
  if (!bawaan) bawaan = buatLayanan();
  return bawaan;
}

let pewaktu = null;
let sedangPutaran = false;

/** Menyalakan penarik berkala. */
function mulai() {
  if (pewaktu) return false;
  if (bersih(process.env.ALETA_ECOURT_VERIFIKASI_AKTIF || "1") === "0") return false;
  const jeda = Number(process.env.ALETA_ECOURT_VERIFIKASI_JEDA_MS);
  const ms = Number.isFinite(jeda) && jeda >= 60 * 1000 ? jeda : JEDA_BAWAAN_MS;
  const detak = () => {
    if (sedangPutaran) return;
    sedangPutaran = true;
    layanan()
      .putaran()
      .catch(() => {})
      .finally(() => {
        sedangPutaran = false;
      });
  };
  pewaktu = setInterval(detak, ms);
  if (pewaktu.unref) pewaktu.unref();
  return true;
}

function hentikan() {
  if (pewaktu) clearInterval(pewaktu);
  pewaktu = null;
}

module.exports = {
  JEDA_BAWAAN_MS,
  JEDA_MIN_TARIK_PERKARA_MS,
  BATAS_TARIK_PERKARA_MS,
  buatLayanan,
  keadaanPerkara,
  agendaPerluUnggah,
  unggahSesudah,
  tanggalLokal,
  mulai,
  hentikan,
  keadaanHari: (tanggal) => layanan().keadaanHari(tanggal),
  putaran: () => layanan().putaran(),
  status: () => layanan().status(),
  tarikSekarang: (isi) => layanan().tarikSekarang(isi),
  statusTarikan: (nomorPerkara) => layanan().statusTarikan(nomorPerkara),
};
