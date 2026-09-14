"use strict";

/**
 * ============================================================================
 * PRAPERIKSA PUTUSAN - FAKTA DARI SIPP, DAN PENDAPAT YANG DISAMARKAN
 * ============================================================================
 *
 * Tahap 2 rencana agen: sebelum putusan dituliskan ke SIPP, ada yang membaca
 * dan bertanya - amar cocok dengan petitum? tanggal putusan hari sidang?
 * majelis yang disebut naskah sama dengan yang ditetapkan? pihaknya pihak
 * perkara ini? Bila bertentangan: BERHENTI dan SEBUTKAN. Tidak ada yang
 * diperbaiki sendiri.
 *
 * ============================================================================
 * YANG MEMUTUSKAN BUKAN BERKAS INI
 * ============================================================================
 *
 * Berkas ini hanya MEMBACA. Ia mengumpulkan fakta dari SIPP - jadwal sidang,
 * majelis tercatat, pihak, putusan yang sudah ada, petitum - dan memulangkannya
 * apa adanya. Yang menimbang fakta itu terhadap draf adalah portal
 * (src/lib/praperiksa-putusan.ts): di sanalah drafnya berada, dan di sanalah
 * aturannya dapat diuji tanpa basis data.
 *
 * Pemisahan itu disengaja. Aturan yang hidup di dua tempat akan berbeda pada
 * hari kedua, dan yang membaca laporannya tidak akan tahu aturan mana yang
 * sedang berlaku.
 *
 * ============================================================================
 * TIAP FAKTA GAGAL SENDIRI-SENDIRI
 * ============================================================================
 *
 * v_pihak_perkara tidak ada pada salinan SIPP yang viewnya tidak terimpor;
 * perkara_efiling_id kosong pada perkara biasa; aleta_bot_ecourt_pihak
 * kosong bila penarikan e-Court belum pernah berjalan. Satu yang gagal tidak
 * boleh menghilangkan yang lain - dan yang gagal DISEBUT, sebab "pihak tidak
 * terbaca" berbeda artinya dari "tidak ada pihak".
 *
 * ============================================================================
 * PENDAPAT AI SELALU LEWAT JALUR PERKARA
 * ============================================================================
 *
 * Amar dan petitum memuat nama orang. Keduanya disamarkan lebih dulu dengan
 * kamus pihak yang DIKETAHUI SIPP (penyamaranPerkaraService), lalu dikirim
 * lewat jalur "perkara" yang gerbangnya MENOLAK muatan tanpa bukti
 * penyamaran. Bila jalurnya belum disetel operator, pendapat AI dilewati dan
 * dikatakan dilewati - bukan diam-diam dikirim lewat jalur umum.
 *
 * Pendapat AI tidak pernah menahan penulisan. Ia hanya menambah perhatian.
 * Yang menahan adalah pertentangan yang dapat dibuktikan dari SIPP.
 */

const db = require("../db_config");
const { cleanText, normalizeCaseNumber } = require("./ecourtTextService");
const hariLiburService = require("./hariLiburService");
const ecourtStoreService = require("./ecourtStoreService");
const penyamaran = require("./penyamaranPerkaraService");
const aiProviderAdapter = require("./aiProviderAdapter");

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(Array.isArray(rows) ? rows : []);
    });
  });
}

/** Tanggal MySQL/Date -> YYYY-MM-DD menurut zona peladen; kosong bila tidak sah. */
function isoTanggal(nilai) {
  if (!nilai) return "";
  const tanggal = nilai instanceof Date ? nilai : new Date(nilai);
  if (Number.isNaN(tanggal.getTime())) return "";
  const bulan = String(tanggal.getMonth() + 1).padStart(2, "0");
  const hari = String(tanggal.getDate()).padStart(2, "0");
  return `${tanggal.getFullYear()}-${bulan}-${hari}`;
}

/**
 * pihak_ke SIPP -> peran penyamaran. Angkanya diukur atas v_pihak_perkara
 * PA Donggala (lihat sippJadwalSidangService): 1 pemohon/penggugat,
 * 2 tergugat/termohon, 4 turut tergugat, 5 saksi.
 */
function peranDariPihakKe(pihakKe) {
  const n = Number(pihakKe);
  if (n === 1) return "penggugat";
  if (n === 2) return "tergugat";
  if (n === 4) return "turut_tergugat";
  if (n === 5) return "saksi";
  return "lain";
}

/**
 * Seluruh fakta SIPP untuk satu perkara, dalam satu jawaban.
 *
 * `kueri` dapat disuntikkan uji; bawaan pool SIPP bot. `tanggal` (YYYY-MM-DD)
 * adalah tanggal putusan yang SEDANG diusulkan borang - dipakai hanya untuk
 * menyertakan keterangan hari liburnya, sebab daftar liburnya ada di bot.
 */
async function bacaFakta(nomorPerkaraMentah, { tanggal = "", kueri = runQuery } = {}) {
  const nomorPerkara = normalizeCaseNumber(nomorPerkaraMentah);
  if (!nomorPerkara) return { ok: false, alasan: "nomor_perkara_kosong", nomorPerkara: "" };

  const aman = async (kerja, cadangan, nama, gagal) => {
    try {
      return await kerja();
    } catch (galat) {
      if (nama) gagal.push(`${nama}: ${cleanText(galat && galat.message) || "tidak terbaca"}`.slice(0, 160));
      return cadangan;
    }
  };
  const tidakTerbaca = [];

  const barisPerkara = await aman(
    () =>
      kueri(
        `SELECT p.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara,
                p.jenis_perkara_nama AS jenisPerkara, p.jenis_perkara_text AS jenisPerkaraLengkap,
                p.tanggal_pendaftaran AS tanggalDaftar, p.petitum AS petitum
           FROM perkara p WHERE p.nomor_perkara = ? ORDER BY p.perkara_id DESC LIMIT 1`,
        [nomorPerkara]
      ),
    [],
    "perkara",
    tidakTerbaca
  );
  const perkara = barisPerkara[0];
  if (!perkara) {
    return {
      ok: false,
      alasan: tidakTerbaca.length ? "sipp_tidak_terbaca" : "perkara_tidak_ditemukan",
      nomorPerkara,
      tidakTerbaca,
    };
  }
  const perkaraId = Number(perkara.perkaraId) || 0;

  const [pihak, anak, majelis, panitera, jadwal, putusan, lewatEcourt, ecourtPihak] = await Promise.all([
    aman(
      () =>
        kueri(
          `SELECT a.nama, a.pihak_ke AS pihakKe FROM v_pihak_perkara a
            WHERE a.perkara_id = ? ORDER BY a.pihak_ke ASC, a.urutan ASC`,
          [perkaraId]
        ),
      [],
      "pihak",
      tidakTerbaca
    ),
    aman(
      () =>
        kueri(
          `SELECT nama_anak AS nama FROM perkara_anak_pihak
            WHERE perkara_id = ? AND nama_anak IS NOT NULL AND nama_anak <> ''`,
          [perkaraId]
        ),
      [],
      "anak",
      tidakTerbaca
    ),
    aman(
      () =>
        kueri(
          `SELECT hk.hakim_nama AS nama, hk.jabatan_hakim_nama AS jabatan, hk.urutan AS urutan
             FROM perkara_hakim_pn hk WHERE hk.perkara_id = ? AND hk.aktif = 'Y' ORDER BY hk.urutan ASC`,
          [perkaraId]
        ),
      [],
      "majelis",
      tidakTerbaca
    ),
    aman(
      () =>
        kueri(
          `SELECT pn.panitera_nama AS nama FROM perkara_panitera_pn pn
            WHERE pn.perkara_id = ? AND pn.aktif = 'Y' ORDER BY pn.urutan ASC`,
          [perkaraId]
        ),
      [],
      "panitera",
      tidakTerbaca
    ),
    aman(
      () =>
        kueri(
          `SELECT j.tanggal_sidang AS tanggalSidang, j.agenda, j.ditunda, j.urutan
             FROM perkara_jadwal_sidang j WHERE j.perkara_id = ?
            ORDER BY j.tanggal_sidang ASC, j.urutan ASC`,
          [perkaraId]
        ),
      [],
      "jadwal",
      tidakTerbaca
    ),
    aman(
      () =>
        kueri(
          // Nama status dari tabel rujukan; salinan di barisnya hanya cadangan
          // (9.480 dari 9.998 baris menyimpan NULL - lihat sippJadwalSidangService).
          `SELECT pu.tanggal_putusan AS tanggalPutusan,
                  COALESCE(sp.nama, pu.status_putusan_nama) AS statusPutusan,
                  pu.putusan_verstek AS verstek
             FROM perkara_putusan pu
             LEFT JOIN status_putusan sp ON sp.id = pu.status_putusan_id
            WHERE pu.perkara_id = ? ORDER BY pu.tanggal_putusan DESC LIMIT 1`,
          [perkaraId]
        ),
      [],
      "putusan",
      tidakTerbaca
    ),
    aman(
      () => kueri(`SELECT 1 AS ada FROM perkara_efiling_id k WHERE k.perkara_id = ? LIMIT 1`, [perkaraId]),
      null,
      "",
      tidakTerbaca
    ),
    // Catatan e-Court milik ALETA sendiri, di basis data bot - bukan SIPP.
    aman(() => ecourtStoreService.bacaPanggilanPerkara(nomorPerkara), { pihak: [] }, "", tidakTerbaca),
  ]);

  const barisPutusan = putusan[0] || null;
  const tanggalIso = /^\d{4}-\d{2}-\d{2}$/.test(String(tanggal || "")) ? String(tanggal) : "";
  const libur = tanggalIso ? hariLiburService.hariLibur(tanggalIso) : null;

  return {
    ok: true,
    alasan: "",
    nomorPerkara: cleanText(perkara.nomorPerkara) || nomorPerkara,
    perkaraId,
    jenisPerkara: cleanText(perkara.jenisPerkara),
    jenisPerkaraLengkap: cleanText(perkara.jenisPerkaraLengkap),
    tanggalDaftar: isoTanggal(perkara.tanggalDaftar),
    // HTML CKEditor apa adanya; portal yang mengubahnya menjadi teks dan butir.
    petitum: String(perkara.petitum || ""),
    pihak: pihak
      .map((x) => ({ nama: cleanText(x.nama), pihakKe: Number(x.pihakKe) || null, peran: peranDariPihakKe(x.pihakKe) }))
      .filter((x) => x.nama),
    anak: anak.map((x) => cleanText(x.nama)).filter(Boolean),
    majelis: majelis
      .map((x) => ({ nama: cleanText(x.nama), jabatan: cleanText(x.jabatan), urutan: Number(x.urutan) || 0 }))
      .filter((x) => x.nama),
    panitera: panitera.map((x) => cleanText(x.nama)).filter(Boolean),
    jadwal: jadwal
      .map((x) => ({
        tanggalSidang: isoTanggal(x.tanggalSidang),
        agenda: cleanText(x.agenda),
        ditunda: cleanText(x.ditunda).toUpperCase() === "Y",
        urutan: Number(x.urutan) || 0,
      }))
      .filter((x) => x.tanggalSidang),
    putusan: barisPutusan
      ? {
          ada: Boolean(isoTanggal(barisPutusan.tanggalPutusan)),
          tanggalPutusan: isoTanggal(barisPutusan.tanggalPutusan),
          statusPutusan: cleanText(barisPutusan.statusPutusan),
          verstek: cleanText(barisPutusan.verstek).toUpperCase(),
        }
      : { ada: false, tanggalPutusan: "", statusPutusan: "", verstek: "" },
    ecourt: {
      // null berarti TIDAK TERBACA - berbeda dari false, "bukan e-Court".
      terdaftar: lewatEcourt === null ? null : Array.isArray(lewatEcourt) && lewatEcourt.length > 0,
      pihak: ((ecourtPihak && ecourtPihak.pihak) || [])
        .map((x) => ({ nama: cleanText(x.nama), peran: cleanText(x.peran) }))
        .filter((x) => x.nama),
    },
    libur: libur ? { tanggal: tanggalIso, nama: String(libur) } : null,
    hariIni: isoTanggal(new Date()),
    tidakTerbaca,
  };
}

// =============================================================================
// PENDAPAT AI - DISAMARKAN, LEWAT JALUR PERKARA, TIDAK PERNAH MENAHAN
// =============================================================================

const PEMISAH_PETITUM = "=== PETITUM ===";
const PEMISAH_AMAR = "=== AMAR ===";

/**
 * Menyusun muatan yang BOLEH berangkat: petitum dan amar dalam satu teks,
 * disamarkan dengan kamus pihak dan anak, beserta buktinya.
 *
 * Satu teks, bukan dua: satu bukti penyamaran untuk satu pengiriman. Dua
 * bukti yang salah satunya terlewat diperiksa adalah celah yang tidak
 * terlihat dari kodenya.
 */
function susunMuatanAi({ nomorPerkara = "", petitum = "", amar = "", pihak = [], anak = [], kataDikenal = [] } = {}) {
  const daftarPihak = [
    ...(Array.isArray(pihak) ? pihak : []).map((x) => ({
      nama: cleanText(x && x.nama),
      peran: (x && x.peran) || peranDariPihakKe(x && x.pihakKe),
    })),
    ...(Array.isArray(anak) ? anak : []).map((nama) => ({ nama: cleanText(nama), peran: "anak" })),
  ].filter((x) => x.nama);

  const teks = [PEMISAH_PETITUM, String(petitum || "").trim(), "", PEMISAH_AMAR, String(amar || "").trim()].join("\n");
  return penyamaran.siapkanMuatan({ teks, pihak: daftarPihak, nomorPerkara, kataDikenal });
}

const PERINTAH_SISTEM = [
  "Anda memeriksa kesesuaian AMAR putusan dengan PETITUM gugatan/permohonan pada Pengadilan Agama di Indonesia.",
  "Nama orang sudah disamarkan menjadi penanda seperti [PENGGUGAT], [TERGUGAT], [ANAK-1]; jangan menebak identitas siapa pun.",
  "Tugas Anda HANYA menemukan pertentangan nyata: petitum pokok yang tidak dijawab amar, amar yang mengabulkan sesuatu yang tidak pernah dituntut, atau kata kerja amar yang saling berlawanan.",
  "Jangan menyarankan perbaikan kalimat, jangan menilai gaya bahasa, jangan menambah amar.",
  'Jawab HANYA JSON: {"bertentangan":[{"judul":"...","rincian":"..."}],"catatan":["..."]}. Bila tidak ada pertentangan, "bertentangan" berupa daftar kosong.',
].join(" ");

/**
 * Pendapat model atas amar vs petitum. Tidak pernah melempar: jalur yang
 * belum disetel, penyamaran yang menyisakan nama, atau penyedia yang gagal
 * seluruhnya pulang sebagai { ok: false, alasan } - dan portal menuliskannya
 * sebagai catatan "pendapat AI dilewati", bukan sebagai keheningan.
 */
async function pendapatAi(masukan = {}, { adapter = aiProviderAdapter } = {}) {
  const muatan = susunMuatanAi(masukan);
  if (!muatan.bukti.diterapkan) {
    return { ok: false, alasan: "Penyamaran tidak diterapkan; muatan tidak dikirim.", penyamaran: muatan.bukti };
  }
  if (!muatan.bukti.bersih) {
    return {
      ok: false,
      alasan: `Masih ada ${muatan.bukti.sisa.length} sisa yang menyerupai data pribadi sesudah disamarkan; muatan tidak dikirim.`,
      penyamaran: muatan.bukti,
    };
  }

  try {
    const hasil = await adapter.completeJson({
      jalur: "perkara",
      penyamaran: muatan.bukti,
      temperature: 0,
      maxTokens: 700,
      messages: [
        { role: "system", content: PERINTAH_SISTEM },
        { role: "user", content: muatan.teks },
      ],
      schemaHint: '{"bertentangan":[{"judul":string,"rincian":string}],"catatan":[string]}',
      metadata: { intentKey: "praperiksa_putusan", mode: "praperiksa" },
    });
    const json = hasil && hasil.json ? hasil.json : {};
    const bertentangan = Array.isArray(json.bertentangan) ? json.bertentangan : [];
    const catatan = Array.isArray(json.catatan) ? json.catatan : [];
    return {
      ok: true,
      temuan: bertentangan
        .map((x) => ({ judul: cleanText(x && x.judul).slice(0, 160), rincian: cleanText(x && x.rincian).slice(0, 600) }))
        .filter((x) => x.judul || x.rincian)
        .slice(0, 8),
      catatan: catatan.map((x) => cleanText(x).slice(0, 300)).filter(Boolean).slice(0, 5),
      provider: hasil.provider || "",
      model: hasil.model || "",
      durationMs: Number(hasil.durationMs) || 0,
      penyamaran: {
        jumlahPenggantian: muatan.bukti.jumlahPenggantian,
        jumlahKamus: muatan.bukti.jumlahKamus,
        bersih: muatan.bukti.bersih,
      },
    };
  } catch (galat) {
    return {
      ok: false,
      alasan: cleanText(galat && galat.message).slice(0, 300) || "penyedia AI gagal",
      penyamaran: {
        jumlahPenggantian: muatan.bukti.jumlahPenggantian,
        jumlahKamus: muatan.bukti.jumlahKamus,
        bersih: muatan.bukti.bersih,
      },
    };
  }
}

module.exports = {
  PEMISAH_AMAR,
  PEMISAH_PETITUM,
  PERINTAH_SISTEM,
  bacaFakta,
  isoTanggal,
  pendapatAi,
  peranDariPihakKe,
  susunMuatanAi,
};
