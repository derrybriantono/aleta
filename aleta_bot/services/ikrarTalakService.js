"use strict";

/**
 * ============================================================================
 * IKRAR TALAK DARI JADWAL SIDANG - FORM "PENETAPAN IKRAR TALAK" TERISI OTOMATIS
 * ============================================================================
 *
 * Permintaan pengguna 18 Okt 2026. Sesudah sidang ikrar talak dinyatakan
 * terlaksana (tombol PUTUS ikrar di Jadwal Sidang, atau keterangan jadwal
 * sidang yang sudah berbunyi ikrar terlaksana walau diisi lewat SIPP), form
 * "Data Penetapan Ikrar Talak" SIPP diisi seperti petugas mengisinya.
 *
 * ----------------------------------------------------------------------------
 * BENTUKNYA DISALIN DARI SIPP, BUKAN DITEBAK
 * ----------------------------------------------------------------------------
 *
 *   controllers/tab_ikrar_talak_c.php  validateInputPenetapanIkrar()
 *   models/ikrar_talak/ikrar_talak_m.php  updateDataPenetapan(),
 *                                         updateDataKeadaanIstri()
 *   views/perkara_tab/ikrar_talak/form_ikrar_putusan.php
 *
 * Satu pengisian menyentuh:
 *   1. perkara_ikrar_talak  UPDATE tgl_ikrar_talak, status_penetapan_ikrar_talak_id
 *      (1 = Diikrarkan), amar_ikrar_talak, diperbaharui_*;
 *   2. perkara_akta_cerai   UPDATE keadaan_istri (1 suci, 2 haid, 3 hamil,
 *      4 tidak diketahui) - hanya bila belum terisi;
 *   3. sys_audittrail       "UPDATE TABLE perkara_ikrar_talak dari halaman
 *      PENETAPAN IKRAR TALAK" (formname "add/edit ikrar talak/akta cerai");
 *   4. perkara_proses       lewat prosedur perkara_proses_update, tahapan 18
 *      "Ikrar Talak", proses 295 "Penetapan Ikrar Talak";
 *   5. perkara              lewat prosedur perkara_update_status.
 *
 * ----------------------------------------------------------------------------
 * ATAS NAMA SIAPA, DAN APA YANG TIDAK DIPALSUKAN
 * ----------------------------------------------------------------------------
 *
 * Pada data satker, penetapan ikrar diisi KETUA MAJELIS ikrar talak (perkara
 * 9988: akun fahri, 7 Okt 2026; sama dengan penetapan majelis dan hari sidang
 * ikrar). Karena itu pengisinya dicatat atas akun SIPP ketua majelis ikrar
 * (perkara_hakim_pn tahapan 18, jabatan 1 atau tunggal 3) - tidak pernah atas
 * akun yang menekan tombol, dan akun yang tidak pasti DITOLAK. Penekan sebenarnya
 * ada di jejak ALETA (jejakAletaService), bukan di SIPP.
 *
 * Tanggal ikrar = tanggal SIDANG ikrar (bukan tanggal hari ini). Tanggal itu
 * tidak boleh mendahului tanggal putusan, penetapan majelis/PP/jurusita/hari
 * sidang ikrar, tidak boleh jatuh di akhir pekan atau di masa depan - aturan
 * yang sama dengan validasi SIPP; yang tidak lolos DITOLAK, tidak diubah.
 *
 * Tanpa kata ALETA di isian, amar, atau audit (penjagaTandaSipp).
 */

const db = require("../db_config");
const penetapan = require("./penetapanTulisService");
const { menyebutAleta } = require("./tandaAletaService");

const TAHAPAN_IKRAR = 18;
const PROSES_PENETAPAN_IKRAR = 295;
const NAMA_HALAMAN = "PENETAPAN IKRAR TALAK";
const NAMA_FORMULIR = "add/edit ikrar talak/akta cerai";
const STATUS_DIIKRARKAN = 1;
const KEADAAN_ISTRI_TIDAK_DIKETAHUI = 4;

/** Keterangan sidang yang ditulis SIPP / ALETA bila ikrar terlaksana. */
const HASIL_SIDANG_IKRAR = "telah ikrar talak"; // ejaan SIPP (446 sidang di satker)
const KETERANGAN_IKRAR = "Ikrar Telah Dilaksanakan";

function kueri(sql, params = []) {
  return new Promise((selesai, gagal) => {
    db.query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil)));
  });
}

function bersih(nilai) {
  return String(nilai === null || nilai === undefined ? "" : nilai).trim();
}

/**
 * Teks hasil sidang / keterangan yang menyatakan ikrar SUDAH terlaksana.
 * Menyebut ikrar tanpa kata penunda (belum, tidak, tunda, menunggu, panggil).
 * "Pemohon tidak hadir ikrar" dan "Belum ikrar" bukan ikrar terlaksana.
 */
function ikrarTerlaksanaMenurutTeks(teks) {
  const t = bersih(teks);
  if (!t) return false;
  if (!/\bikrar\b/i.test(t)) return false;
  if (/\b(belum|tidak|tunda|ditunda|menunggu|panggil|gugur|batal)\b/i.test(t)) return false;
  return true;
}

function tambahBulan(iso, bulan) {
  const [t, b, h] = String(iso).split("-").map(Number);
  if (!t || !b || !h) return "";
  const d = new Date(t, b - 1 + bulan, h);
  // Hari terlampaui (31 Agustus + 6 bulan) jatuh ke bulan berikutnya: ambil hari terakhir bulan itu.
  if (d.getDate() !== h) d.setDate(0);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Batas ikrar 6 bulan (Pasal 70 ayat (6) UU 7/1989; Buku II 2026 hlm. 654-656):
 * SEJAK DITETAPKAN HARI SIDANG PENYAKSIAN IKRAR TALAK - kolom SIPP
 * perkara_ikrar_talak.tanggal_penetapan_sidang_ikrar (keputusan pengguna no. 91,
 * 18 Okt 2026, mengganti "6 bulan dari BHT"). Terukur di sipp_donggala: 172
 * baris 2025+, kolom itu selalu terisi dan selalu mendahului sidang ikrar
 * pertama (rata-rata 15 hari).
 *
 * TIDAK ADA cadangan BHT: tanpa penetapan hari sidang ikrar tenggatnya BELUM
 * berjalan - dipulangkan "" (lihat keteranganBatasIkrar). Argumen lain (mis.
 * tanggalBht dari pemanggil lama) diabaikan dengan sengaja.
 */
function batasEnamBulanIkrar({ tanggalPenetapanSidangIkrar } = {}) {
  const dasar = bersih(tanggalPenetapanSidangIkrar).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(dasar) ? tambahBulan(dasar, 6) : "";
}

/** Kalimat tenggat ikrar untuk layar: tanggalnya, atau "belum berjalan". */
function keteranganBatasIkrar(bahan = {}) {
  const batas = batasEnamBulanIkrar(bahan);
  return batas
    ? `batas 6 bulan ikrar ${batas} (sejak penetapan hari sidang ikrar ${bersih(bahan.tanggalPenetapanSidangIkrar).slice(0, 10)})`
    : "belum ditetapkan hari sidang ikrar - tenggat 6 bulan belum berjalan";
}

/** Keadaan ikrar satu jadwal sidang: jadwal, perkara, baris ikrar, putusan, akta cerai. */
async function keadaanIkrar(jadwalId) {
  const id = Number(jadwalId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const baris = await kueri(
    `SELECT j.id AS jadwalId, j.perkara_id AS perkaraId, j.tanggal_sidang AS tanggalSidang,
            j.ikrar_talak AS ikrarTalak, j.ditunda AS ditunda,
            j.alasan_ditunda AS alasanDitunda, j.keterangan AS keterangan,
            p.nomor_perkara AS nomorPerkara, p.pihak1_text AS pihak1, p.pihak2_text AS pihak2,
            pu.tanggal_putusan AS tanggalPutusan, pu.tanggal_bht AS tanggalBht,
            it.perkara_id AS adaBarisIkrar, it.tgl_ikrar_talak AS tglIkrar,
            it.status_penetapan_ikrar_talak_id AS statusIkrar, it.amar_ikrar_talak AS amarIkrar,
            it.tanggal_penetapan_sidang_ikrar AS tanggalPenetapanSidang,
            it.penetapan_jurusita AS penetapanJurusita,
            it.penetapan_panitera_pengganti AS penetapanPp,
            it.penetapan_majelis_hakim AS penetapanMajelis,
            ac.perkara_id AS adaAkta, ac.keadaan_istri AS keadaanIstri
       FROM perkara_jadwal_sidang j
       JOIN perkara p ON p.perkara_id = j.perkara_id
       LEFT JOIN perkara_putusan pu ON pu.perkara_id = j.perkara_id
       LEFT JOIN perkara_ikrar_talak it ON it.perkara_id = j.perkara_id
       LEFT JOIN perkara_akta_cerai ac ON ac.perkara_id = j.perkara_id
      WHERE j.id = ? LIMIT 1`,
    [id]
  ).catch(() => []);
  const satu = (Array.isArray(baris) && baris[0]) || null;
  if (!satu) return null;
  for (const k of [
    "tanggalSidang",
    "tanggalPutusan",
    "tanggalBht",
    "tglIkrar",
    "tanggalPenetapanSidang",
    "penetapanJurusita",
    "penetapanPp",
    "penetapanMajelis",
  ]) {
    satu[k] = penetapan.tanggalIso(satu[k]);
  }
  return satu;
}

/** Ketua majelis IKRAR talak (tahapan 18, jabatan 1 / tunggal 3) beserta akun hidupnya. */
async function ketuaMajelisIkrar(perkaraId) {
  const baris = await kueri(
    `SELECT hakim_id AS hakimId, jabatan_hakim_id AS jabatanId FROM perkara_hakim_pn
      WHERE perkara_id = ? AND tahapan_id = ? AND aktif = 'Y'`,
    [Number(perkaraId) || 0, TAHAPAN_IKRAR]
  ).catch(() => []);
  const daftar = Array.isArray(baris) ? baris : [];
  const ketua = daftar.find((x) => [1, 3].includes(Number(x.jabatanId)));
  if (!ketua) return { ok: false, alasan: "ketua_majelis_ikrar_tidak_ada" };
  const akun = await penetapan.akunUntukHakim(Number(ketua.hakimId));
  if (!akun.ok) return { ok: false, alasan: akun.alasan, calon: akun.calon };
  return { ok: true, username: akun.username, fullname: akun.fullname, hakimId: Number(ketua.hakimId) };
}

function escHtml(teks) {
  return String(teks).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Biaya penetapan ikrar dari variabel ABT yang SUDAH ADA (tidak dikarang):
 *   #1101# "Biaya Penetapan Ikrar Talak" = #1090# + #1164# (biaya panggilan terakhir
 *          kedua pihak dari perkara_biaya, jenis_biaya 12/13 dan 14/15),
 *   #2050# "Terbilang Biaya Ikrar" = terbilang #1101#.
 * Diukur atas data satker 18 Okt 2026: perkara 9988 -> 14.500, 9953/9950 -> 29.500,
 * sama dengan angka yang diketik petugas di amar_ikrar_talak mereka.
 *
 * `nilai` = {noVar: {status, teks}} (keluaran abt.nilaiPenanda). Murni.
 * Pulang { angka: "14.500", terbilang: "empat belas ribu lima ratus", jumlah: 14500 } atau null
 * bila #1101# belum terisi / bukan angka / nol - amar lalu TANPA angka (tidak dikarang).
 */
function bacaBiayaIkrar(nilai) {
  const a = nilai && nilai["1101"];
  if (!a || a.status !== "terisi") return null;
  const angka = bersih(a.teks);
  if (!/^\d{1,3}(\.\d{3})*$/.test(angka)) return null;
  const jumlah = Number(angka.replace(/\./g, ""));
  if (!jumlah) return null;
  const t = nilai["2050"];
  const terbilang = t && t.status === "terisi" ? bersih(t.teks).replace(/\s+/g, " ") : "";
  return { angka, terbilang: /^[A-Za-z ]+$/.test(terbilang) ? terbilang : "", jumlah };
}

/** Biaya penetapan ikrar lewat mesin variabel ABT (bridge baca-saja). null bila tak terbaca. */
async function ambilBiayaIkrar(perkaraId) {
  try {
    const { handleBridgeOperation } = require("./sippReadOnlyBridgeService");
    const j = await handleBridgeOperation("abt.nilaiPenanda", { perkaraId: Number(perkaraId), sidangKe: 0, penanda: ["1101", "2050"] });
    return bacaBiayaIkrar(j && j.nilai);
  } catch {
    return null;
  }
}

/**
 * Amar penetapan ikrar (HTML penyunting SIPP, minimal 50 huruf). Bentuk dari
 * amar_ikrar_talak yang sudah ada di satker: dua butir - perkawinan putus
 * karena talak satu raj'i, dan pembebanan biaya penetapan. JUMLAH biaya diambil
 * dari variabel ABT biaya ikrar (bacaBiayaIkrar); bila tidak terbaca, butir kedua
 * tidak menyebut angka dan petugas diberi tahu lewat andaian.
 */
function susunAmar(pihak1, pihak2, biaya = null) {
  const p1 = bersih(pihak1);
  const p2 = bersih(pihak2);
  const jumlah =
    biaya && biaya.angka
      ? ` sebesar Rp${biaya.angka},-${biaya.terbilang ? ` (${biaya.terbilang} rupiah)` : ""}`
      : " sesuai ketentuan yang berlaku";
  return (
    `<ol>\n <li>Menyatakan perkawinan antara Pemohon (<strong>${escHtml(p1)}</strong>) dengan Termohon ` +
    `(<strong>${escHtml(p2)}</strong>) putus karena perceraian dengan talak satu raj&#39;i;</li>\n` +
    ` <li>Membebankan kepada Pemohon untuk membayar biaya penetapan ini${jumlah};</li>\n</ol>`
  );
}

function akhirPekan(iso) {
  const d = new Date(`${iso}T00:00:00`);
  const h = d.getDay();
  return h === 0 || h === 6;
}

/**
 * Syarat dan isian bersama (`minta`: lihat susunRencanaIsiIkrar): dipakai rencana tulis bot (susunRencanaIsiIkrar) DAN
 * isian borang ekstensi (susunIsianBorangIkrar). Tidak menulis apa pun.
 * Pulang { ok:true, k, tanggalIkrar, ketua, amar, amarSudahAda, biaya, andaian, batas } atau { ok:false, alasan, ... }.
 */
async function siapkanIsianIkrar(minta, k) {
  if (!k) return { ok: false, alasan: "jadwal_tidak_ketemu" };
  if (bersih(k.ikrarTalak) !== "Y") return { ok: false, alasan: "bukan_sidang_ikrar" };

  if (minta.sudahPutus !== true) {
    // Dasarnya keterangan jadwal sidang: hasil sidang ATAU keterangan menyatakan ikrar terlaksana.
    const terlaksana =
      bersih(k.ditunda) !== "Y" &&
      (ikrarTerlaksanaMenurutTeks(k.alasanDitunda) || ikrarTerlaksanaMenurutTeks(k.keterangan));
    if (!terlaksana) return { ok: false, alasan: "ikrar_belum_dinyatakan_terlaksana" };
  }

  if (!k.adaBarisIkrar) return { ok: false, alasan: "penetapan_ikrar_belum_ada" };
  if (k.tglIkrar === k.tanggalSidang && bersih(k.amarIkrar).length >= 50 && Number(k.statusIkrar) === STATUS_DIIKRARKAN) {
    return { ok: false, alasan: "form_ikrar_sudah_terisi" };
  }
  if (k.tglIkrar && k.tglIkrar !== k.tanggalSidang) {
    // Tanggal ikrar lain sudah tercatat - tidak ditimpa diam-diam.
    return { ok: false, alasan: "tanggal_ikrar_lain_sudah_tercatat", tercatat: k.tglIkrar };
  }

  // ---- Validasi tanggal: sama dengan validateInputPenetapanIkrar SIPP -------
  const tanggalIkrar = k.tanggalSidang;
  const hariIni = (await penetapan.waktuBasisData()).slice(0, 10);
  if (tanggalIkrar > hariIni) return { ok: false, alasan: "tanggal_ikrar_masa_depan", tanggal: tanggalIkrar };
  if (akhirPekan(tanggalIkrar)) return { ok: false, alasan: "tanggal_ikrar_akhir_pekan", tanggal: tanggalIkrar };
  const batasBawah = [
    ["putusan", k.tanggalPutusan],
    ["penetapan_hari_sidang_ikrar", k.tanggalPenetapanSidang],
    ["penetapan_jurusita", k.penetapanJurusita],
    ["penetapan_pp", k.penetapanPp],
    ["penetapan_majelis", k.penetapanMajelis],
  ];
  for (const [nama, tanggal] of batasBawah) {
    if (tanggal && tanggalIkrar < tanggal) {
      return { ok: false, alasan: `tanggal_ikrar_mendahului_${nama}`, tanggal: tanggalIkrar, batas: tanggal };
    }
  }

  const ketua = await ketuaMajelisIkrar(k.perkaraId);
  if (!ketua.ok) return { ok: false, alasan: ketua.alasan, nama: ketua.calon || [] };

  const amarSudahAda = bersih(k.amarIkrar).length >= 50;
  const biaya = amarSudahAda ? null : await (typeof minta.ambilBiaya === "function" ? minta.ambilBiaya : ambilBiayaIkrar)(k.perkaraId);
  const amar = amarSudahAda ? k.amarIkrar : susunAmar(k.pihak1, k.pihak2, biaya);
  if (menyebutAleta(amar)) return { ok: false, alasan: "teks_menyebut_aleta" };

  const andaian = [];
  if (!amarSudahAda) {
    andaian.push(
      biaya
        ? `Amar penetapan ikrar disusun otomatis (talak satu raj'i); biaya penetapan Rp${biaya.angka},- diambil dari biaya perkara (variabel ABT biaya ikrar).`
        : "Amar penetapan ikrar disusun otomatis (talak satu raj'i); jumlah biaya penetapan tidak disebut karena tidak terbaca dari biaya perkara - periksa di SIPP."
    );
  }
  const batas = batasEnamBulanIkrar({ tanggalPenetapanSidangIkrar: k.tanggalPenetapanSidang });
  if (batas && tanggalIkrar > batas) {
    andaian.push(`Tanggal ikrar ${tanggalIkrar} melewati batas 6 bulan ikrar (${batas}) - Pasal 70 ayat (6) UU 7/1989.`);
  }
  return { ok: true, k, tanggalIkrar, ketua, amar, amarSudahAda, biaya, andaian, batas };
}

/**
 * Isian borang "Data Penetapan Ikrar Talak" SIPP untuk ekstensi (31, 18 Okt 2026) - MEMBACA
 * saja. Perkara dicari lewat nomor atau perkara_id; sidang ikrarnya yang terbaru. Nilai
 * mengikuti nama medan borang SIPP (form_ikrar_putusan.php): tgl_ikrar (dd/mm/yyyy),
 * status_penetapan (1 diikrarkan), keadaan_istri (1-4), amar (HTML). Syarat yang sama dengan
 * pengisian oleh bot; yang belum memenuhi dijawab ok:false + alasan (ekstensi diam).
 */
async function susunIsianBorangIkrar(minta = {}) {
  let perkaraId = Number(minta.perkaraId) || 0;
  const nomor = bersih(minta.nomorPerkara);
  if (!perkaraId && nomor) {
    const p = await kueri(`SELECT perkara_id AS id FROM perkara WHERE nomor_perkara = ? LIMIT 1`, [nomor]).catch(() => []);
    perkaraId = Number(p && p[0] && p[0].id) || 0;
  }
  if (!perkaraId) return { ok: false, alasan: "perkara_tidak_ketemu" };
  const s = await kueri(
    `SELECT id FROM perkara_jadwal_sidang WHERE perkara_id = ? AND ikrar_talak = 'Y' ORDER BY tanggal_sidang DESC, id DESC LIMIT 1`,
    [perkaraId]
  ).catch(() => []);
  const jadwalId = Number(s && s[0] && s[0].id) || 0;
  if (!jadwalId) return { ok: false, alasan: "bukan_sidang_ikrar" };
  const k = await keadaanIkrar(jadwalId);
  const siap = await siapkanIsianIkrar(minta, k);
  if (!siap.ok) return siap;
  const keadaanSekarang = Number(siap.k.keadaanIstri);
  const keadaanIstri = keadaanSekarang >= 1 && keadaanSekarang <= 4 ? keadaanSekarang : KEADAAN_ISTRI_TIDAK_DIKETAHUI;
  const [t, b, h] = siap.tanggalIkrar.split("-");
  const andaian = [...siap.andaian];
  if (!(keadaanSekarang >= 1 && keadaanSekarang <= 4)) {
    andaian.push('Keadaan istri belum tercatat; diisi "Tidak Diketahui" - ubah di SIPP bila diketahui.');
  }
  return {
    ok: true,
    perkara: { perkaraId, nomorPerkara: siap.k.nomorPerkara },
    jadwalId,
    tanggalIkrar: siap.tanggalIkrar,
    atasNama: { username: siap.ketua.username, namaLengkap: siap.ketua.fullname, peran: "ketua majelis ikrar talak" },
    nilai: {
      tgl_ikrar: `${h}/${b}/${t}`,
      status_penetapan: String(STATUS_DIIKRARKAN),
      keadaan_istri: String(keadaanIstri),
      amar: siap.amar,
    },
    andaian,
  };
}

/**
 * Menyusun rencana pengisian form ikrar - TIDAK menulis apa pun.
 *
 * @param {object} minta { jadwalId, ip, operator, sudahPutus, ambilBiaya }  `sudahPutus`: keterangan
 *   jadwal sidang ditulis pada transaksi yang sama (belum terbaca di basis data).
 *   `ambilBiaya(perkaraId)`: pengganti pembaca biaya ikrar (uji); bawaannya variabel ABT 1101/2050.
 */
async function susunRencanaIsiIkrar(minta = {}) {
  const k = await keadaanIkrar(minta.jadwalId);
  const siap = await siapkanIsianIkrar(minta, k);
  if (!siap.ok) return siap;
  const { tanggalIkrar, ketua, amar, andaian, batas } = siap;

  const saat = await penetapan.waktuSipp();
  const ip = bersih(minta.ip);
  const langkah = [];

  const keadaanBaru = Number(k.keadaanIstri);
  const isiKeadaan = k.adaAkta && !(keadaanBaru >= 1 && keadaanBaru <= 4);

  const nilai = {
    tgl_ikrar_talak: tanggalIkrar,
    status_penetapan_ikrar_talak_id: STATUS_DIIKRARKAN,
    amar_ikrar_talak: amar,
    diperbaharui_oleh: ketua.username,
    diperbaharui_tanggal: saat,
  };

  if (isiKeadaan) {
    langkah.push({
      tabel: "perkara_akta_cerai",
      aksi: "UPDATE",
      sql: `UPDATE perkara_akta_cerai SET keadaan_istri = ? WHERE perkara_id = ?`,
      params: [KEADAAN_ISTRI_TIDAK_DIKETAHUI, k.perkaraId],
      keterangan: "keadaan istri: tidak diketahui (belum tercatat)",
    });
    andaian.push("Keadaan istri belum tercatat; diisi \"Tidak Diketahui\" - ubah di SIPP bila diketahui.");
  }

  langkah.push({
    tabel: "perkara_ikrar_talak",
    aksi: "UPDATE",
    sql: `UPDATE perkara_ikrar_talak
             SET tgl_ikrar_talak = ?, status_penetapan_ikrar_talak_id = ?, amar_ikrar_talak = ?,
                 diperbaharui_oleh = ?, diperbaharui_tanggal = ?
           WHERE perkara_id = ?`,
    params: [
      nilai.tgl_ikrar_talak,
      nilai.status_penetapan_ikrar_talak_id,
      nilai.amar_ikrar_talak,
      nilai.diperbaharui_oleh,
      nilai.diperbaharui_tanggal,
      k.perkaraId,
    ],
    keterangan: `form ikrar talak: ikrar ${tanggalIkrar} (diikrarkan)`,
  });

  langkah.push(
    penetapan.barisAudit({
      username: ketua.username,
      tabel: "perkara_ikrar_talak",
      formulir: NAMA_FORMULIR,
      aksi: "UPDATE",
      nilai,
      perkaraId: k.perkaraId,
      judulHalaman: NAMA_HALAMAN,
      ip,
      saat,
    })
  );

  langkah.push({
    tabel: "perkara_proses",
    aksi: "CALL",
    sql: `CALL perkara_proses_update(?,?,?,?,?,?,?,?,?)`,
    params: [
      String(k.perkaraId),
      String(TAHAPAN_IKRAR),
      "Ikrar Talak",
      String(PROSES_PENETAPAN_IKRAR),
      "Penetapan Ikrar Talak",
      tanggalIkrar,
      "",
      ketua.username,
      saat,
    ],
    keterangan: "riwayat perkara: Ikrar Talak - Penetapan Ikrar Talak",
  });
  langkah.push({
    tabel: "perkara",
    aksi: "CALL",
    sql: `CALL perkara_update_status(?)`,
    params: [String(k.perkaraId)],
    keterangan: "status perkara dihitung ulang",
  });

  return {
    ok: true,
    jenis: "isi-ikrar",
    perkara: { perkaraId: k.perkaraId, nomorPerkara: k.nomorPerkara },
    atasNama: { username: ketua.username, namaLengkap: ketua.fullname, peran: "ketua majelis ikrar talak" },
    tanggalIkrar,
    batasEnamBulan: batas,
    saat,
    langkah,
    andaian,
  };
}

module.exports = {
  HASIL_SIDANG_IKRAR,
  KETERANGAN_IKRAR,
  ikrarTerlaksanaMenurutTeks,
  tambahBulan,
  batasEnamBulanIkrar,
  keteranganBatasIkrar,
  keadaanIkrar,
  ketuaMajelisIkrar,
  bacaBiayaIkrar,
  ambilBiayaIkrar,
  susunAmar,
  susunIsianBorangIkrar,
  susunRencanaIsiIkrar,
};
