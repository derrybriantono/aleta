"use strict";

/**
 * ============================================================================
 * ISIAN OTOMATIS BLANGKO DERRY - JENIS S5 (20 Okt 2026)
 * ============================================================================
 *
 * Dispensasi kawin (362), perwalian (354), asal usul anak (358), wali adhal (363), dan penetapan ahli waris / P3HP (371).
 * Kartu "Perlu diisi" blangko Derry (putusan/penetapan, BAS tiap sidang, relaas, PTSP) diisi lewat kanal "Isi dari SIPP"
 * yang sudah ada (abtUsulanService.dariSipp -> usulan): Sambungan SEMPIT di dariSipp memanggil usulanJenisS5().
 * HANYA SELECT; tidak pernah menulis ke SIPP/ABT.
 *
 *   - Pengisi per jenis ada di folder isiOtomatisS5/ (dk.js, asalUsul.js, perwalian.js, waliAdhal.js, ahliWaris.js, umum.js);
 *     tiap pengisi murni (data masuk, usulan keluar) supaya dapat diuji dengan data tiruan.
 *   - Tiap usulan membawa keyakinan pasti | cukup | ragu dan keterangan singkat (catatan) untuk ikon ⓘ. Pasti/cukup terisi
 *     sendiri bila saklar "Isi otomatis" menyala dan isiannya masih kosong; ragu hanya menjadi saran. Semua usulan
 *     bertanda jagaIsianLama: tidak pernah menimpa isian petugas.
 *   - METADATA: isian yang TIDAK MUNGKIN otomatis ("diisi manual" + alasan) dan yang opsional (+ labelPengguna). Bukan nilai
 *     isian - hanya petunjuk tampilan dan bahan pengukuran (scripts/isi-sipp-abt/ukur-isi-s5-20okt.cjs).
 *   - Jenis di luar S5 (cerai, ikrar, itsbat, jenis lain) tidak disentuh di sini.
 */

const B = require("./isiOtomatisS5/bantu");
const DK = require("./isiOtomatisS5/dk");
const AUA = require("./isiOtomatisS5/asalUsul");
const PAW = require("./isiOtomatisS5/ahliWaris");
const PAWL = require("./isiOtomatisS5/ahliWarisLanjut");
const PW = require("./isiOtomatisS5/perwalian");
const WA = require("./isiOtomatisS5/waliAdhal");
const META = require("./isiOtomatisS5/metadata");

const JENIS = Object.freeze({ DK: 362, PERWALIAN: 354, ASAL_USUL: 358, WALI_ADHAL: 363, AHLI_WARIS: 371 });
const JENIS_S5 = new Set(Object.values(JENIS));

/** Menjalankan satu pembacaan; galat sinkron maupun penolakan janji menjadi null (pembacaan lain jalan terus). */
const diam = (kerja) => {
  try {
    return Promise.resolve(kerja()).catch(() => null);
  } catch {
    return Promise.resolve(null);
  }
};
const baris = (r) => (Array.isArray(r) ? r : []);
const satu = (r) => (Array.isArray(r) && r[0]) || null;

/**
 * Membaca data perkara yang dipakai pengisi (SELECT saja). Tiap pembacaan dijaga: tabel/kolom yang tidak ada = bagian itu kosong.
 * @returns {Promise<object|null>} null bila perkara tidak ada
 */
async function bacaData(perkaraId, runQuery) {
  const id = Number(perkaraId);
  if (!Number.isFinite(id) || id <= 0 || typeof runQuery !== "function") return null;
  const q = (sql) => diam(() => runQuery(sql, [id]));
  const [perkara, pihak1, pihak2, mempelai, anak, nikah, itsbat, alasanNikah] = await Promise.all([
    q(
      `SELECT p.nomor_perkara AS nomor, p.jenis_perkara_id AS jenisId, p.alur_perkara_id AS alurId, p.posita, p.petitum,
              DATE_FORMAT(p.tanggal_pendaftaran, '%Y-%m-%d') AS tanggalDaftar
         FROM perkara p WHERE p.perkara_id = ? LIMIT 1`
    ),
    q(
      `SELECT pp.urutan, pp.nama, x.tempat_lahir AS tempat, DATE_FORMAT(x.tanggal_lahir, '%Y-%m-%d') AS lahir, x.status_kawin AS statusKawin,
              x.pekerjaan, x.pendidikan, x.jenis_kelamin AS jk
         FROM perkara_pihak1 pp LEFT JOIN pihak x ON x.id = pp.pihak_id WHERE pp.perkara_id = ? ORDER BY pp.urutan`
    ),
    q(
      `SELECT pp.urutan, pp.nama, x.tempat_lahir AS tempat, DATE_FORMAT(x.tanggal_lahir, '%Y-%m-%d') AS lahir, x.status_kawin AS statusKawin,
              x.pekerjaan, x.pendidikan, x.jenis_kelamin AS jk
         FROM perkara_pihak2 pp LEFT JOIN pihak x ON x.id = pp.pihak_id WHERE pp.perkara_id = ? ORDER BY pp.urutan`
    ),
    q(
      `SELECT nama, DATE_FORMAT(tanggal_lahir, '%Y-%m-%d') AS lahir, tempat_lahir AS tempat, pendidikan, jenis_mempelai AS jenis, pekerjaan,
              nominal_penghasilan AS nominal, dimohonkan
         FROM perkara_mempelai_dk WHERE perkara_id = ? ORDER BY id`
    ),
    q(
      `SELECT nama_anak AS nama, tempat_lahir AS tempat, DATE_FORMAT(tanggal_lahir, '%Y-%m-%d') AS lahir, jenis_kelamin AS jk, anak_ke AS ke
         FROM perkara_anak_pihak WHERE perkara_id = ? ORDER BY anak_ke, id`
    ),
    q(
      `SELECT DATE_FORMAT(tgl_nikah, '%Y-%m-%d') AS tglNikah, no_kutipan_akta_nikah AS noAkta, kua_tempat_nikah AS kua
         FROM perkara_data_pernikahan WHERE perkara_id = ? LIMIT 1`
    ),
    q(`SELECT DATE_FORMAT(tgl_menikah, '%Y-%m-%d') AS tglNikah, tempat_menikah AS tempat FROM perkara_data_itsbat WHERE perkara_id = ? LIMIT 1`),
    q(`SELECT alasan_id AS alasanId, nama FROM perkara_alasan_nikah WHERE perkara_id = ?`),
  ]);
  const p = satu(perkara);
  if (!p) return null;
  return {
    perkaraId: id,
    perkara: {
      nomor: String(p.nomor || ""),
      jenisId: Number(p.jenisId),
      alurId: Number(p.alurId),
      posita: String(p.posita || ""),
      petitum: String(p.petitum || ""),
      tanggalDaftar: String(p.tanggalDaftar || ""),
    },
    pihak1: baris(pihak1),
    pihak2: baris(pihak2),
    mempelai: baris(mempelai),
    anak: baris(anak),
    nikah: satu(nikah),
    itsbat: satu(itsbat),
    alasanNikah: baris(alasanNikah),
  };
}

/** Bacaan posita DK sebagai pembanding (peta kode -> {nilai}); gagal = tanpa pembanding. */
function bacaPositaDk(posita) {
  try {
    return require("./deteksiDispensasiKawinService").deteksiDk(posita).nilai || {};
  } catch {
    return {};
  }
}

/** Pengurai itsbat (fakta nikah) dan bacaan petitum asal usul - dibaca lambat supaya tidak melingkar dengan abtUsulanService. */
const uraiItsbat = (posita) => require("./abtUsulanService").dariPositaItsbat(posita, {}).usulan;
/** Pewaris (1025) menurut modul waris - nama lengkap dengan bin/binti; "" bila tidak terbaca. */
const pewarisDariModul = (posita, petitum) => {
  try {
    const f = require("./deteksi/waris").deteksi(posita, { petitum, jenisPerkara: 371 }) || {};
    return f["1025"] && f["1025"].nilai ? String(f["1025"].nilai) : "";
  } catch {
    return "";
  }
};
const bacaPetitumAsalUsul = (posita, petitum) => require("./deteksi/asalUsul").deteksi(posita, { petitum });

/**
 * Usulan dari data yang sudah dibaca (murni) - dipakai usulanJenisS5 dan uji.
 * @param {object} d keluaran bacaData
 * @returns {object[]} usulan
 */
function usulanDariData(d) {
  if (!d || !d.perkara) return [];
  const jenis = d.perkara.jenisId;
  if (!JENIS_S5.has(jenis)) return [];
  const hasil = [];
  if (jenis === JENIS.PERWALIAN) hasil.push(...PW.usulanPerwalian(d));
  if (jenis === JENIS.WALI_ADHAL) hasil.push(...WA.usulanWaliAdhal(d));
  if (jenis === JENIS.DK) hasil.push(...DK.usulanDk(d, { bacaPosita: bacaPositaDk }));
  if (jenis === JENIS.AHLI_WARIS) {
    const pewaris = pewarisDariModul(d.perkara.posita, d.perkara.petitum);
    hasil.push(...PAW.usulanAhliWaris(d, { pewaris }));
    // U5 20 Okt: isian lanjutan 4500-4599 (tujuan, anak angkat, wasiat, kerabat tidak Islam, perkawinan, pengganti saudara, bagian)
    hasil.push(...PAWL.usulanLanjut(d, { pewaris }));
  }
  if (jenis === JENIS.ASAL_USUL) hasil.push(...AUA.usulanAsalUsul(d, { urai: uraiItsbat, bacaPetitum: bacaPetitumAsalUsul }));
  return hasil;
}

/**
 * Sambungan SEMPIT untuk dariSipp: usulan jenis S5 satu perkara.
 * @param {number|string} perkaraId
 * @param {Function} runQuery pembaca SIPP baca-saja milik abtUsulanService
 * @returns {Promise<object[]>}
 */
async function usulanJenisS5(perkaraId, runQuery) {
  const jenisAwal = await diam(() => runQuery("SELECT jenis_perkara_id AS j FROM perkara WHERE perkara_id = ? LIMIT 1", [Number(perkaraId)]));
  const j = Number((satu(jenisAwal) || {}).j);
  if (!JENIS_S5.has(j)) return [];
  const data = await bacaData(perkaraId, runQuery);
  return usulanDariData(data);
}

/**
 * Isian yang tidak mungkin otomatis ("diisi manual" + alasan) atau opsional (+ labelPengguna) - lihat isiOtomatisS5/metadata.js.
 * Bentuk: kode -> { manual: true, alasan } | { opsional: true, labelPengguna }.
 */
const METADATA = META.METADATA;

/** Isian ini berlaku untuk perkara itu? false = varian blangko lain (tidak dihitung kosong). `data` = keluaran bacaData. */
function berlaku(kode, data) {
  const f = META.SYARAT[String(kode)];
  if (!f || !data || !data.perkara) return true;
  try {
    return f(data) !== false;
  } catch {
    return true;
  }
}

module.exports = { JENIS, JENIS_S5, METADATA, berlaku, bacaData, usulanDariData, usulanJenisS5, B };
