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
function keadaanPerkara({ dokumen = [], diperiksaHariIni = false, penarikTersambung = true, menunggu }) {
  const belum = dokumen.filter((d) => menunggu(d)).length;
  if (belum > 0) return { keadaan: "belum", belum };
  // Tidak ada yang menunggu menurut data tersimpan. Itu "sudah" bila datanya
  // segar (ditarik hari ini) atau memang ada dokumen yang sudah dibaca dan
  // tidak satu pun menunggu; tanpa data sama sekali dan penarik tidak
  // tersambung, keadaannya tidak diketahui -> tidak konek.
  if (diperiksaHariIni || dokumen.length > 0) return { keadaan: "sudah", belum: 0 };
  return { keadaan: penarikTersambung ? "belum-diperiksa" : "tidak-konek", belum: 0 };
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
    const baris = await kueriSipp(
      `SELECT DISTINCT p.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara
         FROM perkara_jadwal_sidang j
         JOIN perkara p ON p.perkara_id = j.perkara_id
         JOIN perkara_efiling_id k ON k.perkara_id = j.perkara_id
        WHERE j.tanggal_sidang = ?`,
      [tanggal]
    );
    return (Array.isArray(baris) ? baris : [])
      .map((b) => ({ perkaraId: bersih(b.perkaraId), nomorPerkara: cleanText(b.nomorPerkara) }))
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
      // (datanya mungkin basi); sesudahnya hanya yang masih menunggu majelis.
      if (!penarik.berhasil.has(k)) return true;
      return keadaanPerkara({ dokumen: dok, diperiksaHariIni: true, menunggu }).keadaan !== "sudah";
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

  return { keadaanHari, putaran, status, perkaraElitigasi, dataTersimpan };
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
  buatLayanan,
  keadaanPerkara,
  tanggalLokal,
  mulai,
  hentikan,
  keadaanHari: (tanggal) => layanan().keadaanHari(tanggal),
  putaran: () => layanan().putaran(),
  status: () => layanan().status(),
};
