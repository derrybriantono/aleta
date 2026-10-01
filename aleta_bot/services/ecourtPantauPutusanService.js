"use strict";

/**
 * Pemantau putusan e-Court yang belum diunggah atau belum di-TTE (perbaikan
 * 1 Okt 2026, butir E11).
 *
 * ============================================================================
 * SOPAN, BUKAN MENYAMAR
 * ============================================================================
 *
 * Keputusan pengguna 26 Sep 2026: tanpa jeda tiruan manusia, audit jujur.
 * Karena itu pemantau ini tidak mengacak jarak dan tidak meniru apa pun. Yang
 * membuatnya sopan adalah BATASNYA:
 *
 *   - jarak tetap antar pemeriksaan (bawaan 20 menit, paling rapat 5 menit);
 *   - batas pemeriksaan per jam (bawaan 3, paling banyak 12);
 *   - satu perkara tidak diperiksa ulang sebelum jedaUlangJam lewat;
 *   - MUNDUR saat gagal: jaraknya berlipat dua tiap kegagalan beruntun, sampai
 *     4 jam; sesi penarik habis (kode 2) langsung ke batas terpanjang;
 *   - tidak berbondong: SATU perkara per pemeriksaan, hanya ketika penarikan
 *     lain tidak berjalan, hanya pada jam kerja penjadwal.
 *
 * ============================================================================
 * MEMAKAI AKUN PENARIK DATA, BUKAN SESI PRIBADI
 * ============================================================================
 *
 * Pemeriksaan ini hanya MEMBACA tab Putusan, jadi ia memakai jalur penarikan
 * satu perkara yang sudah ada (ecourtSchedulerService.mulaiPenarikanPerkara)
 * dengan akun penarik pengadilan. Hasil bacaannya disimpan run.js ke
 * aleta_bot_ecourt_putusan, dan lencana di Jadwal Sidang & Status Perkara
 * membacanya dari sana.
 */

const { readRuntimeConfig, writeRuntimeConfig } = require("../config/runtime-config");
const { normalizeCaseNumber } = require("./ecourtTextService");

const BAWAAN = {
  aktif: true,
  jarakMenit: 20,
  maksPerJam: 3,
  jedaUlangJam: 12,
  rentangHari: 60,
};

const MUNDUR_MAKS_MS = 4 * 60 * 60 * 1000;

function angka(nilai, bawaan, min, maks) {
  const n = Math.floor(Number(nilai));
  if (!Number.isFinite(n)) return bawaan;
  return Math.min(maks, Math.max(min, n));
}

function getSettings(runtimeConfig = readRuntimeConfig() || {}) {
  const s = runtimeConfig.ecourtPantauPutusan || {};
  return {
    aktif: s.aktif === undefined ? BAWAAN.aktif : s.aktif !== false,
    jarakMenit: angka(s.jarakMenit, BAWAAN.jarakMenit, 5, 240),
    maksPerJam: angka(s.maksPerJam, BAWAAN.maksPerJam, 1, 12),
    jedaUlangJam: angka(s.jedaUlangJam, BAWAAN.jedaUlangJam, 1, 168),
    rentangHari: angka(s.rentangHari, BAWAAN.rentangHari, 7, 365),
  };
}

function saveSettings(masukan = {}) {
  const sekarang = readRuntimeConfig() || {};
  const gabung = getSettings({ ecourtPantauPutusan: { ...getSettings(sekarang), ...masukan } });
  writeRuntimeConfig({ ...sekarang, ecourtPantauPutusan: gabung });
  return gabung;
}

/**
 * Hitungan murni: boleh memeriksa sekarang? Dipisah supaya dapat diuji tanpa
 * jam dinding dan tanpa penjadwal sungguhan.
 */
function bolehPeriksa({ sekarang, pengaturan, keadaan, penjadwal }) {
  if (!pengaturan.aktif) return { boleh: false, sebab: "mati" };
  // Mengikuti penjadwal penarikan: bila admin mematikannya (mis. sesi akun
  // penarik sedang bermasalah), pemantau ikut diam.
  if (!penjadwal.pengaturan || !penjadwal.pengaturan.aktif) return { boleh: false, sebab: "penjadwal_penarikan_mati" };
  if (!penjadwal.dalamJamKerja) return { boleh: false, sebab: "di_luar_jam_kerja" };
  if (penjadwal.sedangJalan || penjadwal.adaPenarikanLain) return { boleh: false, sebab: "penarikan_lain_berjalan" };
  if (keadaan.menunggu) return { boleh: false, sebab: "menunggu_hasil_sebelumnya" };
  const jarakMs = pengaturan.jarakMenit * 60 * 1000;
  const mundurMs =
    keadaan.gagalBeruntun > 0 ? Math.min(MUNDUR_MAKS_MS, jarakMs * 2 ** keadaan.gagalBeruntun) : 0;
  const tunggu = Math.max(jarakMs, mundurMs);
  if (keadaan.terakhirPeriksa && sekarang - keadaan.terakhirPeriksa < tunggu) {
    return { boleh: false, sebab: keadaan.gagalBeruntun > 0 ? "mundur_sesudah_gagal" : "belum_waktunya" };
  }
  const sejamLalu = sekarang - 60 * 60 * 1000;
  const dalamSejam = keadaan.riwayat.filter((t) => t > sejamLalu).length;
  if (dalamSejam >= pengaturan.maksPerJam) return { boleh: false, sebab: "batas_per_jam" };
  return { boleh: true, sebab: "" };
}

/** Kode keluar penarikan -> jumlah gagal beruntun yang baru. */
function catatHasil(gagalBeruntun, kode) {
  if (kode === 0) return 0;
  if (kode === 2) return 10; // sesi penarik habis: mundur sejauh-jauhnya
  return Math.min(10, gagalBeruntun + 1);
}

/**
 * Calon perkara: sudah putus di SIPP dalam rentangHari, dikenal sebagai
 * perkara e-Court, keadaannya belum lengkap, dan terakhir diperiksa sebelum
 * jedaUlangJam. Yang belum pernah diperiksa didahulukan, lalu yang paling lama.
 */
function pilihCalon({ putus, dikenalEcourt, catatan, sekarang, jedaUlangJam }) {
  const batas = sekarang - jedaUlangJam * 60 * 60 * 1000;
  const calon = [];
  for (const nomorMentah of putus) {
    const nomor = normalizeCaseNumber(nomorMentah);
    if (!nomor || !dikenalEcourt.has(nomor)) continue;
    const c = catatan[nomor];
    if (c && c.adaBaris && c.dokumenAda && c.paniteraTte) continue; // sudah lengkap
    const waktu = c && c.diperiksaPada ? Date.parse(c.diperiksaPada) : 0;
    if (waktu && waktu > batas) continue;
    calon.push({ nomor, waktu });
  }
  calon.sort((a, b) => a.waktu - b.waktu);
  return calon.map((c) => c.nomor);
}

function buatPemantau(depsMasuk = null) {
  const deps = () => depsMasuk || depsBawaan();
  const keadaan = {
    timer: null,
    terakhirPeriksa: 0,
    riwayat: [],
    gagalBeruntun: 0,
    menunggu: null, // { nomor, mulai }
    terakhirNomor: "",
    terakhirSebab: "",
    terakhirKode: null,
  };

  async function detak(sekarang = Date.now()) {
    const d = deps();
    const status = d.statusPenjadwal();

    // Hasil pemeriksaan sebelumnya dibaca lebih dulu.
    if (keadaan.menunggu && !status.sedangJalan) {
      const selesai = status.terakhirSelesai ? Date.parse(status.terakhirSelesai) : 0;
      if (selesai >= keadaan.menunggu.mulai) {
        keadaan.terakhirKode = status.terakhirKode;
        keadaan.gagalBeruntun = catatHasil(keadaan.gagalBeruntun, Number(status.terakhirKode));
        keadaan.menunggu = null;
      } else if (sekarang - keadaan.menunggu.mulai > 3 * 60 * 60 * 1000) {
        keadaan.menunggu = null; // tidak pernah terdengar kabarnya - anggap gagal
        keadaan.gagalBeruntun = catatHasil(keadaan.gagalBeruntun, 1);
      }
    }

    const pengaturan = d.pengaturan();
    const izin = bolehPeriksa({ sekarang, pengaturan, keadaan, penjadwal: status });
    keadaan.terakhirSebab = izin.sebab;
    if (!izin.boleh) return { diperiksa: "", sebab: izin.sebab };

    const putus = await d.perkaraPutus(pengaturan.rentangHari).catch(() => null);
    if (!putus) {
      keadaan.terakhirSebab = "sipp_tidak_terbaca";
      return { diperiksa: "", sebab: "sipp_tidak_terbaca" };
    }
    const nomor = putus.map((n) => normalizeCaseNumber(n)).filter(Boolean);
    const [dikenal, catatan] = await Promise.all([
      d.dikenalEcourt(nomor).catch(() => new Set()),
      d.catatanPutusan(nomor).catch(() => ({})),
    ]);
    const calon = pilihCalon({ putus: nomor, dikenalEcourt: dikenal, catatan, sekarang, jedaUlangJam: pengaturan.jedaUlangJam });
    if (!calon.length) {
      keadaan.terakhirSebab = "tidak_ada_calon";
      return { diperiksa: "", sebab: "tidak_ada_calon" };
    }

    const pilihan = calon[0];
    const mulai = d.mulaiPenarikan(pilihan);
    keadaan.terakhirPeriksa = sekarang;
    keadaan.riwayat = keadaan.riwayat.filter((t) => t > sekarang - 60 * 60 * 1000).concat(sekarang);
    keadaan.terakhirNomor = pilihan;
    if (!mulai || !mulai.ok) {
      keadaan.gagalBeruntun = catatHasil(keadaan.gagalBeruntun, 1);
      keadaan.terakhirSebab = (mulai && mulai.alasan) || "gagal_memulai";
      return { diperiksa: "", sebab: keadaan.terakhirSebab };
    }
    keadaan.menunggu = { nomor: pilihan, mulai: sekarang };
    return { diperiksa: pilihan, sebab: "", sisaCalon: calon.length - 1 };
  }

  function mulai() {
    if (keadaan.timer) return;
    // Detak tiap menit hanya MEMERIKSA apakah sudah waktunya; jarak
    // sebenarnya diatur bolehPeriksa().
    keadaan.timer = setInterval(() => {
      void detak().catch(() => {});
    }, 60 * 1000);
    if (typeof keadaan.timer.unref === "function") keadaan.timer.unref();
  }

  function berhenti() {
    if (keadaan.timer) clearInterval(keadaan.timer);
    keadaan.timer = null;
  }

  function getStatus() {
    return {
      pengaturan: deps().pengaturan(),
      berjalan: Boolean(keadaan.timer),
      terakhirPeriksa: keadaan.terakhirPeriksa ? new Date(keadaan.terakhirPeriksa).toISOString() : "",
      terakhirNomor: keadaan.terakhirNomor,
      terakhirSebab: keadaan.terakhirSebab,
      terakhirKode: keadaan.terakhirKode,
      gagalBeruntun: keadaan.gagalBeruntun,
      pemeriksaanSejamTerakhir: keadaan.riwayat.filter((t) => t > Date.now() - 60 * 60 * 1000).length,
      menunggu: keadaan.menunggu ? keadaan.menunggu.nomor : "",
    };
  }

  return { detak, mulai, berhenti, getStatus, _keadaan: keadaan };
}

function depsBawaan() {
  const botDb = require("./botDbService");
  const sippDb = require("../db_config");
  const penjadwal = require("./ecourtSchedulerService");
  const putusan = require("./putusanEcourtService");
  return {
    pengaturan: () => getSettings(),
    statusPenjadwal: () => penjadwal.getStatus(),
    mulaiPenarikan: (nomor) =>
      penjadwal.mulaiPenarikanPerkara(nomor, { olehSiapa: "Pemantau putusan e-Court ALETA (otomatis)" }),
    perkaraPutus: (rentangHari) =>
      new Promise((resolve, reject) => {
        sippDb.query(
          `SELECT p.nomor_perkara AS nomorPerkara
             FROM perkara_putusan pu JOIN perkara p ON p.perkara_id = pu.perkara_id
            WHERE pu.tanggal_putusan IS NOT NULL
              AND pu.tanggal_putusan >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            ORDER BY pu.tanggal_putusan DESC
            LIMIT 500`,
          [rentangHari],
          (galat, rows) => (galat ? reject(galat) : resolve((rows || []).map((r) => String(r.nomorPerkara))))
        );
      }),
    dikenalEcourt: async (nomor) => {
      if (!nomor.length) return new Set();
      const isian = nomor.map(() => "?").join(", ");
      const a = await botDb
        .query(`SELECT nomor_perkara AS n FROM aleta_bot_ecourt_kunjungan WHERE nomor_perkara IN (${isian})`, nomor)
        .catch(() => []);
      const b = await botDb
        .query(`SELECT DISTINCT nomor_perkara AS n FROM aleta_bot_ecourt_documents WHERE nomor_perkara IN (${isian})`, nomor)
        .catch(() => []);
      return new Set([...(a || []), ...(b || [])].map((r) => normalizeCaseNumber(r.n)));
    },
    catatanPutusan: (nomor) => putusan.catatanBanyak(nomor),
  };
}

const bawaan = buatPemantau();

module.exports = {
  BAWAAN,
  MUNDUR_MAKS_MS,
  bolehPeriksa,
  buatPemantau,
  catatHasil,
  getSettings,
  pilihCalon,
  saveSettings,
  detak: bawaan.detak,
  mulai: bawaan.mulai,
  berhenti: bawaan.berhenti,
  getStatus: bawaan.getStatus,
};
