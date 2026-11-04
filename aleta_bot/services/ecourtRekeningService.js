"use strict";

/**
 * ============================================================================
 * SINKRON REKENING DAN BANK PEMBAYAR DARI e-COURT (4 Nov 2026)
 * ============================================================================
 *
 * Permintaan Derry: nomor rekening dan bank yang tercatat di e-Court (bagian "Pembayaran (e-Payment)"
 * halaman detil pendaftaran) tampil OTOMATIS di Kasir ALETA dan Status Perkara, tanpa menunggu tombol
 * "Tarik data" per perkara.
 *
 * ----------------------------------------------------------------------------
 * KEADAAN SEBELUMNYA (temuan)
 * ----------------------------------------------------------------------------
 * Rekening hanya terbaca ketika jembatan e-Court MEMBUKA halaman detil sebuah perkara untuk menarik dokumen
 * (run.js, processCase). Putaran berkala hanya membuka sebagian kecil perkara (25), dan perkara yang berkasnya
 * "sudah lengkap" dilewati tanpa dibuka - jadi banyak perkara tidak pernah terbaca rekeningnya. Kunjungan yang
 * halamannya tidak memuat bagian pembayaran tidak meninggalkan jejak, sehingga "belum dicek" dan "e-Court memang
 * tidak mencatat" tidak dapat dibedakan.
 *
 * ----------------------------------------------------------------------------
 * CARA KERJA SEKARANG
 * ----------------------------------------------------------------------------
 *   1. Tiap halaman perkara yang dibuka (putaran berkala, tarik satu perkara, sinkron rekening) meninggalkan
 *      CATATAN CEK per perkara (aleta_bot_ecourt_rekening_cek): terbaca | tanpa_rekening | tidak_ada |
 *      tidak_ketemu | gagal, beserta kapan perlu dicek lagi.
 *   2. Di ujung tiap putaran berkala (sesi e-Court yang SAMA, daftar alamat yang SAMA - tanpa login atau sapuan
 *      daftar tambahan) jembatan membaca rekening untuk paling banyak ALETA_ECOURT_REKENING_PER_PUTARAN perkara
 *      (bawaan 30): yang BELUM pernah dicek lebih dulu, lalu yang sudah jatuh tempo diperiksa ulang. Halaman
 *      dibuka tanpa mengunduh berkas apa pun; jeda antar halaman sama dengan jeda jembatan.
 *   3. Tombol "Sinkron rekening" di Integrasi e-Court menjalankan hal yang sama sekarang (paling banyak
 *      ALETA_ECOURT_REKENING_MAKS_MANUAL perkara, bawaan 120) dan melaporkan hasilnya.
 *   4. Nomor rekening DISANDIKAN (AES-256-GCM, kunci yang sama dengan sandi e-Court yang tersimpan) sebelum
 *      masuk basis data bot; tidak pernah ditulis ke log maupun jejak audit.
 *
 * Hanya MEMBACA e-Court (memakai sesi akun penarik yang sudah ada). Tidak ada tulisan ke SIPP atau e-Court.
 * Mematikan sinkron otomatis: ALETA_ECOURT_REKENING_OTOMATIS=0.
 */

const botDb = require("./botDbService");
const { normalizeCaseNumber } = require("./ecourtTextService");

const TABEL_CEK = "aleta_bot_ecourt_rekening_cek";
const TABEL_PUTARAN = "aleta_bot_ecourt_rekening_putaran";
const AWALAN_SANDI = "r1:";
const JAM = 60 * 60 * 1000;
const HARI = 24 * JAM;

/** Hasil cek satu perkara. */
const HASIL = ["terbaca", "tanpa_rekening", "tidak_ada", "tidak_ketemu", "gagal"];

const alat = {
  sekarang: () => Date.now(),
  tidur: (ms) => new Promise((selesai) => setTimeout(selesai, ms)),
  kredensial: () => require("./ecourtKredensialService"),
};

/** Dipakai pengujian. */
function aturAlat(baru = {}) {
  Object.assign(alat, baru);
}

function angkaEnv(nama, bawaan, min, maks) {
  const n = Number(process.env[nama]);
  if (!Number.isFinite(n) || n <= 0) return bawaan;
  return Math.min(Math.max(Math.floor(n), min), maks);
}

function otomatisAktif() {
  return String(process.env.ALETA_ECOURT_REKENING_OTOMATIS || "1").trim() !== "0";
}

function perPutaran() {
  return angkaEnv("ALETA_ECOURT_REKENING_PER_PUTARAN", 30, 1, 100);
}

function maksManual() {
  return angkaEnv("ALETA_ECOURT_REKENING_MAKS_MANUAL", 120, 1, 400);
}

function jedaUlangMs(hasil, status) {
  if (hasil === "gagal") return angkaEnv("ALETA_ECOURT_REKENING_ULANG_GAGAL_JAM", 6, 1, 72) * JAM;
  if (hasil === "tidak_ketemu") return 3 * HARI;
  if (hasil === "tidak_ada") return 2 * HARI;
  if (hasil === "tanpa_rekening") return 7 * HARI;
  // terbaca: pembayaran yang belum selesai diperiksa lebih sering daripada yang sudah final.
  const final = !/belum|menunggu|pending|proses|batal|kedaluwarsa|expired/i.test(String(status || "")) && /lunas|terbayar|dibayar|sudah|berhasil|paid|selesai|diterima/i.test(String(status || ""));
  return final ? angkaEnv("ALETA_ECOURT_REKENING_ULANG_HARI", 14, 1, 90) * HARI : 2 * HARI;
}

/** Nilai waktu kolom bot -> Date (UTC ditegaskan) atau null. */
function keWaktu(nilai) {
  if (!nilai) return null;
  if (typeof botDb.fromMysqlDate === "function") return botDb.fromMysqlDate(nilai);
  const t = nilai instanceof Date ? nilai : new Date(nilai);
  return Number.isNaN(t.getTime()) ? null : t;
}

function tanggalMysql(ms) {
  return botDb.toMysqlDate(new Date(ms));
}

function waktuIso(nilai) {
  const t = keWaktu(nilai);
  return t ? t.toISOString() : "";
}

function potong(teks, n) {
  return String(teks === null || teks === undefined ? "" : teks).replace(/\s+/g, " ").trim().slice(0, n);
}

// ----------------------------------------------------------------------------
// Penyandian nomor rekening
// ----------------------------------------------------------------------------

/** Nomor rekening -> teks tersandi. Melempar bila kunci tidak tersedia (rekening TIDAK pernah disimpan polos). */
function sembunyiRekening(nomor) {
  const n = String(nomor || "").trim();
  if (!n) return "";
  return AWALAN_SANDI + alat.kredensial().sandikan(n);
}

/** Teks tersandi (atau nilai polos lama) -> nomor rekening; kosong bila tidak dapat dibuka. */
function bukaRekening(tersandi, polos = "") {
  const t = String(tersandi || "");
  if (t.startsWith(AWALAN_SANDI)) {
    try {
      const terbuka = alat.kredensial().bukaSandi(t.slice(AWALAN_SANDI.length));
      if (terbuka) return terbuka;
    } catch {
      /* jatuh ke nilai polos lama bila ada */
    }
    return String(polos || "");
  }
  return String(polos || "");
}

// ----------------------------------------------------------------------------
// Skema
// ----------------------------------------------------------------------------

let skemaSiap = false;
let sandiBarisLamaSelesai = false;

function lupakan() {
  skemaSiap = false;
  sandiBarisLamaSelesai = false;
}

async function ensureSchema() {
  if (skemaSiap) return;
  // Tabel pembayaran dibuat ecourtStoreService (beserta kolom tersandi).
  await require("./ecourtStoreService").ensureSchema();
  await botDb.query(`
    CREATE TABLE IF NOT EXISTS ${TABEL_CEK} (
      nomor_perkara VARCHAR(191) PRIMARY KEY,
      hasil VARCHAR(24) NOT NULL,
      sebab VARCHAR(191) NOT NULL DEFAULT '',
      dicek_pada DATETIME NOT NULL,
      ulang_pada DATETIME NOT NULL,
      berubah_pada DATETIME NULL,
      percobaan INT NOT NULL DEFAULT 0,
      INDEX idx_arc_ulang (ulang_pada),
      INDEX idx_arc_hasil (hasil)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await botDb.query(`
    CREATE TABLE IF NOT EXISTS ${TABEL_PUTARAN} (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      sumber VARCHAR(32) NOT NULL DEFAULT '',
      status VARCHAR(32) NOT NULL DEFAULT '',
      sebab VARCHAR(191) NOT NULL DEFAULT '',
      dimulai_pada DATETIME NOT NULL,
      selesai_pada DATETIME NOT NULL,
      sasaran INT NOT NULL DEFAULT 0,
      terbaca INT NOT NULL DEFAULT 0,
      tanpa_rekening INT NOT NULL DEFAULT 0,
      tidak_ada INT NOT NULL DEFAULT 0,
      gagal INT NOT NULL DEFAULT 0,
      berubah INT NOT NULL DEFAULT 0,
      INDEX idx_arp_selesai (selesai_pada)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  skemaSiap = true;
}

/**
 * Nomor rekening yang masih polos (disimpan sebelum 4 Nov 2026) disandikan sekali per proses.
 * Gagal-terbuka: tanpa kunci, barisnya dibiarkan dan tetap terbaca seperti semula.
 */
async function sandikanBarisLama() {
  if (sandiBarisLamaSelesai) return { disandikan: 0 };
  await ensureSchema();
  let disandikan = 0;
  try {
    const baris = await botDb.query(
      `SELECT nomor_perkara, nomor_rekening FROM aleta_bot_ecourt_pembayaran WHERE nomor_rekening <> '' LIMIT 1000`
    );
    for (const r of Array.isArray(baris) ? baris : []) {
      const tersandi = sembunyiRekening(r.nomor_rekening);
      await botDb.query(
        `UPDATE aleta_bot_ecourt_pembayaran SET nomor_rekening_sandi = ?, nomor_rekening = '' WHERE nomor_perkara = ? AND nomor_rekening <> ''`,
        [tersandi, r.nomor_perkara]
      );
      disandikan += 1;
    }
    sandiBarisLamaSelesai = true;
  } catch {
    /* kunci tidak tersedia atau basis data sibuk: dicoba lagi pada proses berikutnya */
  }
  return { disandikan };
}

// ----------------------------------------------------------------------------
// Catatan cek per perkara
// ----------------------------------------------------------------------------

async function simpanCek(nomor, { hasil, sebab = "", status = "", berubah = false }) {
  const sekarang = alat.sekarang();
  await botDb.query(
    `INSERT INTO ${TABEL_CEK} (nomor_perkara, hasil, sebab, dicek_pada, ulang_pada, berubah_pada, percobaan)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       hasil = VALUES(hasil), sebab = VALUES(sebab), dicek_pada = VALUES(dicek_pada), ulang_pada = VALUES(ulang_pada),
       berubah_pada = IF(? = 1, VALUES(dicek_pada), berubah_pada),
       percobaan = IF(VALUES(hasil) = 'gagal', percobaan + 1, 0)`,
    [
      nomor,
      hasil,
      potong(sebab, 190),
      tanggalMysql(sekarang),
      tanggalMysql(sekarang + jedaUlangMs(hasil, status)),
      berubah ? tanggalMysql(sekarang) : null,
      hasil === "gagal" ? 1 : 0,
      berubah ? 1 : 0,
    ]
  );
}

/**
 * Satu halaman perkara sudah dibaca. `pembayaran`/`skum` hasil scraper (null bila bagiannya tidak ada).
 * @returns {Promise<{hasil: string, berubah: boolean, baru: boolean}>}
 */
async function catatBaca(nomorMentah, { pembayaran = null, skum = null } = {}) {
  const nomor = normalizeCaseNumber(nomorMentah);
  if (!nomor) return { hasil: "gagal", berubah: false, baru: false };
  await ensureSchema();

  let simpan = { tersimpan: 0, berubah: false, baru: false, rekeningGagal: "" };
  if (pembayaran || skum) {
    simpan = await require("./ecourtStoreService").recordPembayaranEcourt(nomor, pembayaran, skum);
  }
  const adaRekening = Boolean(pembayaran && String(pembayaran.nomorRekening || "").trim());
  let hasil = !pembayaran ? "tidak_ada" : adaRekening ? "terbaca" : "tanpa_rekening";
  let sebab = "";
  if (simpan.rekeningGagal) {
    hasil = "gagal";
    sebab = simpan.rekeningGagal;
  }
  await simpanCek(nomor, { hasil, sebab, status: pembayaran ? pembayaran.status : "", berubah: Boolean(simpan.berubah) });
  return { hasil, berubah: Boolean(simpan.berubah), baru: Boolean(simpan.baru) };
}

/** Halaman perkara tidak dapat dibaca (galat jaringan/peramban, halaman bukan perkara). */
async function catatGagal(nomorMentah, sebab) {
  const nomor = normalizeCaseNumber(nomorMentah);
  if (!nomor) return;
  await ensureSchema();
  await simpanCek(nomor, { hasil: "gagal", sebab: potong(sebab, 190) });
}

/** Perkara ada di SIPP tetapi tidak ditemukan di daftar e-Court. */
async function catatTidakKetemu(daftarNomor) {
  await ensureSchema();
  for (const mentah of daftarNomor) {
    const nomor = normalizeCaseNumber(mentah);
    if (nomor) await simpanCek(nomor, { hasil: "tidak_ketemu", sebab: "tidak_ada_di_daftar_ecourt" });
  }
}

async function bacaBanyak(daftar, sql, kolom) {
  const hasil = [];
  for (let i = 0; i < daftar.length; i += 400) {
    const potongan = daftar.slice(i, i + 400);
    const baris = await botDb.query(sql(potongan.map(() => "?").join(",")), potongan);
    if (Array.isArray(baris)) hasil.push(...baris);
  }
  return hasil;
}

/** Cek terakhir beberapa perkara -> { [nomor]: { hasil, sebab, dicekPada } } (untuk layar). */
async function bacaCek(daftarMentah) {
  await ensureSchema();
  const daftar = [...new Set((Array.isArray(daftarMentah) ? daftarMentah : [daftarMentah]).map((n) => normalizeCaseNumber(n)).filter(Boolean))].slice(0, 80);
  if (!daftar.length) return {};
  const baris = await bacaBanyak(daftar, (q) => `SELECT nomor_perkara, hasil, sebab, dicek_pada FROM ${TABEL_CEK} WHERE nomor_perkara IN (${q})`);
  const peta = {};
  for (const r of baris) {
    peta[r.nomor_perkara] = {
      hasil: String(r.hasil || ""),
      sebab: String(r.sebab || ""),
      dicekPada: waktuIso(r.dicek_pada),
    };
  }
  return peta;
}

// ----------------------------------------------------------------------------
// Memilih sasaran
// ----------------------------------------------------------------------------

/**
 * Dari nomor perkara berurutan (terbaru lebih dulu): yang BELUM pernah dicek didahulukan, lalu yang sudah jatuh
 * tempo diperiksa ulang. Fungsi baca saja.
 * @returns {Promise<{ sasaran: string[], belum: number, jatuhTempo: number, segar: number }>}
 */
async function pilihSasaran(nomorUrut, maks) {
  await ensureSchema();
  const urut = [...new Set(nomorUrut.map((n) => normalizeCaseNumber(n)).filter(Boolean))];
  const baris = await bacaBanyak(urut, (q) => `SELECT nomor_perkara, ulang_pada FROM ${TABEL_CEK} WHERE nomor_perkara IN (${q})`);
  const peta = new Map(baris.map((r) => [r.nomor_perkara, keWaktu(r.ulang_pada) ? keWaktu(r.ulang_pada).getTime() : 0]));
  const sekarang = alat.sekarang();
  const belum = [];
  const jatuhTempo = [];
  let segar = 0;
  for (const n of urut) {
    if (!peta.has(n)) belum.push(n);
    else if (!(peta.get(n) > sekarang)) jatuhTempo.push(n);
    else segar += 1;
  }
  return {
    sasaran: [...belum, ...jatuhTempo].slice(0, Math.max(Number(maks) || 0, 0)),
    belum: belum.length,
    jatuhTempo: jatuhTempo.length,
    segar,
  };
}

// ----------------------------------------------------------------------------
// Satu putaran sinkron (dijalankan di dalam proses jembatan e-Court)
// ----------------------------------------------------------------------------

async function catatPutaran(r) {
  await ensureSchema();
  await botDb.query(
    `INSERT INTO ${TABEL_PUTARAN}
       (sumber, status, sebab, dimulai_pada, selesai_pada, sasaran, terbaca, tanpa_rekening, tidak_ada, gagal, berubah)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      potong(r.sumber, 32),
      potong(r.status, 32),
      potong(r.sebab, 190),
      tanggalMysql(r.mulai || alat.sekarang()),
      tanggalMysql(r.selesai || alat.sekarang()),
      Number(r.sasaran) || 0,
      Number(r.terbaca) || 0,
      Number(r.tanpaRekening) || 0,
      Number(r.tidakAda) || 0,
      Number(r.gagal) || 0,
      Number(r.berubah) || 0,
    ]
  );
  // Riwayat dipangkas: 60 putaran terakhir cukup untuk layar.
  await botDb
    .query(`DELETE FROM ${TABEL_PUTARAN} WHERE id < (SELECT batas FROM (SELECT COALESCE(MAX(id), 0) - 60 AS batas FROM ${TABEL_PUTARAN}) t)`)
    .catch(() => {});
}

/**
 * Membaca rekening untuk sasaran terpilih lewat `bacaSatu(url)`:
 *   -> { status: "ok", detail } | { status: "sesi_habis" } | { status: "gagal", sebab }
 * `detail` = hasil scraper.parseCaseDetail; `simpanHalaman(detail)` (opsional) menyimpan lewat jalur jembatan
 * (termasuk isi e-SKUM) dan mengembalikan hasil catatBaca; tanpa itu dipakai catatBaca langsung.
 * Berhenti sendiri pada sesi habis, galat beruntun, atau batas waktu. Tidak pernah melempar.
 */
async function sinkronkan({
  acuan,
  bacaSatu,
  simpanHalaman = null,
  maks = perPutaran(),
  batasMs = 10 * 60 * 1000,
  istirahatTiap = 40,
  istirahatMs = 120000,
  sumber = "jadwal",
  log = () => {},
} = {}) {
  const ringkas = { sumber, status: "selesai", sebab: "", mulai: alat.sekarang(), sasaran: 0, terbaca: 0, tanpaRekening: 0, tidakAda: 0, gagal: 0, berubah: 0, tidakKetemu: 0, belum: 0, jatuhTempo: 0 };
  try {
    await sandikanBarisLama();
    const perkara = acuan && acuan.perkara ? [...acuan.perkara.values()] : [];
    const petaAlamat = (acuan && acuan.petaAlamat) || new Map();
    if (!acuan || !acuan.aktif || perkara.length === 0 || petaAlamat.size === 0) {
      ringkas.status = "gagal";
      ringkas.sebab = !acuan || !acuan.aktif ? "daftar_perkara_sipp_tidak_terbaca" : "daftar_perkara_ecourt_tidak_terbaca";
      return ringkas;
    }

    const alamatDari = new Map();
    const tanpaAlamat = [];
    for (const p of perkara) {
      const nomor = normalizeCaseNumber(p.nomorPerkara);
      if (!nomor) continue;
      const url = petaAlamat.get(String(p.nomorRegister || "").toUpperCase());
      if (url) alamatDari.set(nomor, url);
      else tanpaAlamat.push(nomor);
    }

    const pilihan = await pilihSasaran([...alamatDari.keys()], maks);
    ringkas.belum = pilihan.belum;
    ringkas.jatuhTempo = pilihan.jatuhTempo;
    ringkas.sasaran = pilihan.sasaran.length;

    // Perkara SIPP yang tidak ada di daftar e-Court dicatat sekali (dicek lagi 3 hari kemudian), supaya tidak
    // terhitung "belum dicek" selamanya.
    if (tanpaAlamat.length) {
      const cek = await bacaCek(tanpaAlamat.slice(0, 80));
      const baru = tanpaAlamat.filter((n) => !cek[n]).slice(0, 80);
      if (baru.length) {
        await catatTidakKetemu(baru);
        ringkas.tidakKetemu = baru.length;
      }
    }

    const batasWaktu = alat.sekarang() + batasMs;
    let beruntunGagal = 0;
    let n = 0;
    for (const nomor of pilihan.sasaran) {
      if (alat.sekarang() > batasWaktu) {
        ringkas.status = "dihentikan";
        ringkas.sebab = "melewati_batas_waktu";
        break;
      }
      if (n > 0 && n % istirahatTiap === 0) {
        log(`  Istirahat sesudah ${n} perkara (beban peladen e-Court).`);
        await alat.tidur(istirahatMs);
      }
      n += 1;
      let jawab;
      try {
        jawab = await bacaSatu(alamatDari.get(nomor), nomor);
      } catch (galat) {
        jawab = { status: "gagal", sebab: `galat_baca: ${potong(galat && galat.message, 120)}` };
      }
      if (jawab && jawab.status === "sesi_habis") {
        ringkas.status = "sesi_habis";
        ringkas.sebab = "sesi e-Court habis";
        break;
      }
      if (!jawab || jawab.status !== "ok") {
        beruntunGagal += 1;
        ringkas.gagal += 1;
        await catatGagal(nomor, (jawab && jawab.sebab) || "halaman_tidak_terbaca").catch(() => {});
        if (beruntunGagal >= 5) {
          ringkas.status = "dihentikan";
          ringkas.sebab = "gagal_beruntun";
          break;
        }
        continue;
      }
      beruntunGagal = 0;
      let hasil;
      try {
        hasil = simpanHalaman
          ? await simpanHalaman(jawab.detail)
          : await catatBaca(nomor, { pembayaran: jawab.detail.pembayaran, skum: jawab.detail.skum });
      } catch (galat) {
        hasil = { hasil: "gagal" };
        await catatGagal(nomor, `simpan_gagal: ${potong(galat && galat.message, 120)}`).catch(() => {});
      }
      if (hasil.hasil === "terbaca") ringkas.terbaca += 1;
      else if (hasil.hasil === "tanpa_rekening") ringkas.tanpaRekening += 1;
      else if (hasil.hasil === "tidak_ada") ringkas.tidakAda += 1;
      else ringkas.gagal += 1;
      if (hasil.berubah) ringkas.berubah += 1;
    }
  } catch (galat) {
    ringkas.status = "gagal";
    ringkas.sebab = potong(galat && galat.message, 150);
  }
  ringkas.selesai = alat.sekarang();
  await catatPutaran(ringkas).catch(() => {});
  log(
    `  Sinkron rekening: ${ringkas.sasaran} perkara dipilih, ${ringkas.terbaca} terbaca, ${ringkas.tanpaRekening} tanpa rekening, ` +
      `${ringkas.tidakAda} tanpa pembayaran, ${ringkas.gagal} gagal, ${ringkas.berubah} berubah (${ringkas.status}).`
  );
  return ringkas;
}

// ----------------------------------------------------------------------------
// Keadaan untuk layar Integrasi e-Court
// ----------------------------------------------------------------------------

/**
 * Ringkasan sinkron rekening: terakhir sinkron, jumlah per hasil, sebab gagal, cakupan terhadap daftar perkara
 * e-Court di SIPP (`nomorCakupan`, boleh null bila SIPP tidak terbaca). Tidak memuat nomor rekening.
 */
async function ringkasStatus({ nomorCakupan = null } = {}) {
  await ensureSchema();
  const jumlah = {};
  for (const h of HASIL) jumlah[h] = 0;
  const perHasil = await botDb.query(`SELECT hasil, COUNT(*) AS n FROM ${TABEL_CEK} GROUP BY hasil`);
  for (const r of Array.isArray(perHasil) ? perHasil : []) jumlah[r.hasil] = Number(r.n) || 0;

  const sebabRaw = await botDb.query(
    `SELECT sebab, COUNT(*) AS n FROM ${TABEL_CEK} WHERE hasil = 'gagal' GROUP BY sebab ORDER BY n DESC LIMIT 5`
  );
  const sebabGagal = (Array.isArray(sebabRaw) ? sebabRaw : []).map((r) => ({ sebab: String(r.sebab || "tidak_diketahui"), jumlah: Number(r.n) || 0 }));

  const terakhirCek = await botDb.query(`SELECT MAX(dicek_pada) AS t FROM ${TABEL_CEK}`);
  const putaran = await botDb.query(`SELECT * FROM ${TABEL_PUTARAN} ORDER BY id DESC LIMIT 5`);
  const tersimpan = await botDb.query(
    `SELECT COUNT(*) AS n, SUM(nomor_rekening_sandi <> '' OR nomor_rekening <> '') AS dengan_rekening FROM aleta_bot_ecourt_pembayaran`
  );

  let cakupan = null;
  if (Array.isArray(nomorCakupan)) {
    const urut = [...new Set(nomorCakupan.map((n) => normalizeCaseNumber(n)).filter(Boolean))];
    const ada = await bacaBanyak(urut, (q) => `SELECT nomor_perkara, hasil FROM ${TABEL_CEK} WHERE nomor_perkara IN (${q})`);
    const dicek = new Set(ada.map((r) => r.nomor_perkara));
    cakupan = {
      total: urut.length,
      sudahDicek: dicek.size,
      belumDicek: urut.length - dicek.size,
      denganRekening: ada.filter((r) => r.hasil === "terbaca").length,
    };
  }

  return {
    otomatis: otomatisAktif(),
    perPutaran: perPutaran(),
    maksManual: maksManual(),
    terakhirCek: waktuIso(terakhirCek && terakhirCek[0] && terakhirCek[0].t),
    jumlah,
    sebabGagal,
    tersimpan: {
      perkara: Number(tersimpan && tersimpan[0] && tersimpan[0].n) || 0,
      denganRekening: Number(tersimpan && tersimpan[0] && tersimpan[0].dengan_rekening) || 0,
    },
    cakupan,
    putaranTerakhir: (Array.isArray(putaran) ? putaran : []).map((r) => ({
      sumber: String(r.sumber || ""),
      status: String(r.status || ""),
      sebab: String(r.sebab || ""),
      mulai: waktuIso(r.dimulai_pada),
      selesai: waktuIso(r.selesai_pada),
      sasaran: Number(r.sasaran) || 0,
      terbaca: Number(r.terbaca) || 0,
      tanpaRekening: Number(r.tanpa_rekening) || 0,
      tidakAda: Number(r.tidak_ada) || 0,
      gagal: Number(r.gagal) || 0,
      berubah: Number(r.berubah) || 0,
    })),
  };
}

module.exports = {
  HASIL,
  aturAlat,
  bacaCek,
  bukaRekening,
  catatBaca,
  catatGagal,
  catatPutaran,
  catatTidakKetemu,
  ensureSchema,
  jedaUlangMs,
  lupakan,
  maksManual,
  otomatisAktif,
  perPutaran,
  pilihSasaran,
  ringkasStatus,
  sandikanBarisLama,
  sembunyiRekening,
  sinkronkan,
};
