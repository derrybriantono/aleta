"use strict";

/**
 * ============================================================================
 * EMAIL DAN PERSETUJUAN SALURAN ELEKTRONIK PARA PIHAK - BAHAN TANGGAL TUNDA
 * ============================================================================
 *
 * Perbaikan 2 Oktober 2026 malam (butir 1e/1f). Tanggal sidang berikutnya di
 * borang tunda bergantung pada ketidakhadiran: tergugat yang tidak hadir
 * dipanggil ulang SEPEKAN bila panggilan elektronik dapat dikirim (punya email
 * dan - bila belum pernah hadir - menyetujui e-Court), dua pekan bila harus
 * manual. Aturannya di portal (src/lib/bawaan-tunda.ts, satu fungsi untuk
 * Jadwal Sidang dan Hasil Sidang); di sini hanya BAHANNYA.
 *
 * ============================================================================
 * TIDAK ADA PEMBACA e-COURT BARU - YANG SUDAH ADA DIPAKAI ULANG
 * ============================================================================
 *
 * Jembatan e-Court (tools/ecourt-bridge/run.js -> scraper.extractPersetujuanPihak)
 * sudah membaca bagian "Persetujuan Pihak Menggunakan Saluran Elektronik" pada
 * halaman Detil Pendaftaran tiap perkara - dengan akun penarik data, jeda
 * manusiawi, dan berhenti saat sesi habis - lalu menyimpannya di
 * aleta_bot_ecourt_pihak (nama, peran, email, telp, persetujuan: setuju =
 * ikon centang hijau, tidak_setuju = x merah, belum = kotak toska). Berkas ini
 * HANYA MEMBACA tabel bot itu: tidak ada permintaan ke e-Court sama sekali,
 * jadi tidak ada beban tambahan ke Mahkamah Agung dan tidak ada risiko sesi.
 *
 * ============================================================================
 * SUMBER TIAP KETERANGAN
 * ============================================================================
 *
 *   email penggugat/pemohon  SIPP (pihak.email lewat perkara_pihak1) bila ada;
 *                            kalau tidak, e-Court. Hanya SELECT.
 *   email tergugat/termohon  e-Court saja (permintaan pengguna).
 *   persetujuan tergugat     e-Court saja.
 *
 * Yang tidak terbaca TIDAK DITEBAK: dilaporkan sebagai tidak terbaca beserta
 * sebabnya, dan portal menjatuhkannya ke aturan "tanpa email".
 *
 * ============================================================================
 * DATA PRIBADI
 * ============================================================================
 *
 * Alamat email TIDAK PERNAH dikirim ke portal - hanya ada/tidaknya. Tidak ada
 * log, dan sebab kegagalan memakai kalimat tetap, bukan pesan galat basis data
 * (yang dapat membawa nilai kueri).
 */

const EMAIL_SAH = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function bersih(nilai) {
  return String(nilai === null || nilai === undefined ? "" : nilai).trim();
}

function emailSah(nilai) {
  return EMAIL_SAH.test(bersih(nilai));
}

function sisiPeran(peran) {
  const teks = bersih(peran).toLowerCase();
  if (/tergugat|termohon/.test(teks)) return 2;
  if (/penggugat|pemohon/.test(teks)) return 1;
  return 0;
}

function tanggalIso(nilai) {
  if (!nilai) return "";
  const d = nilai instanceof Date ? nilai : new Date(nilai);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Persetujuan gabungan satu sisi: satu saja yang menolak = tidak setuju; semua setuju = setuju. */
function gabungPersetujuan(daftar) {
  if (daftar.length === 0) return "tidak-diketahui";
  if (daftar.some((x) => x === "tidak_setuju")) return "tidak_setuju";
  if (daftar.every((x) => x === "setuju")) return "setuju";
  return "belum";
}

/**
 * Menyusun keterangan dari bahan yang SUDAH dibaca - fungsi murni, diuji tanpa
 * basis data.
 *
 * @param {{sipp: {terbaca: boolean, pihak: Array<{sisi: number, email: string}>}, ecourt: {terbaca: boolean, pihak: Array<{peran: string, email: string, persetujuan: string, terakhirTerlihat?: any}>}}} bahan
 */
function susunKontak(bahan) {
  const sipp = bahan.sipp || { terbaca: false, pihak: [] };
  const ecourt = bahan.ecourt || { terbaca: false, pihak: [] };
  const sebab = [];

  const ecourtPihak = (Array.isArray(ecourt.pihak) ? ecourt.pihak : []).map((p) => ({
    sisi: sisiPeran(p.peran),
    email: bersih(p.email),
    persetujuan: ["setuju", "tidak_setuju", "belum"].includes(p.persetujuan) ? p.persetujuan : "belum",
    terakhirTerlihat: p.terakhirTerlihat,
  }));
  const ecourtAda = ecourt.terbaca && ecourtPihak.length > 0;

  if (!ecourt.terbaca) sebab.push("data e-Court tidak terjangkau");
  else if (!ecourtAda) sebab.push("perkara ini belum tercatat di data e-Court (bukan pendaftaran e-Court, atau belum ditarik)");
  if (!sipp.terbaca) sebab.push("SIPP tidak terbaca");

  // ---- penggugat / pemohon: SIPP dulu, lalu e-Court ----
  const sippSatu = (sipp.pihak || []).filter((p) => p.sisi === 1);
  const sippSatuLengkap = sipp.terbaca && sippSatu.length > 0 && sippSatu.every((p) => emailSah(p.email));
  const ecourtSatu = ecourtPihak.filter((p) => p.sisi === 1);
  const ecourtSatuLengkap = ecourtAda && ecourtSatu.length > 0 && ecourtSatu.every((p) => emailSah(p.email));
  const penggugat = {
    adaEmail: sippSatuLengkap || ecourtSatuLengkap,
    sumber: sippSatuLengkap ? "sipp" : ecourtSatuLengkap ? "ecourt" : "",
  };

  // ---- tergugat / termohon: e-Court saja ----
  const ecourtDua = ecourtPihak.filter((p) => p.sisi === 2);
  const tergugat = {
    adaEmail: ecourtAda && ecourtDua.length > 0 && ecourtDua.every((p) => emailSah(p.email)),
    persetujuan: ecourtAda ? gabungPersetujuan(ecourtDua.map((p) => p.persetujuan)) : "tidak-diketahui",
  };
  if (ecourtAda && ecourtDua.length === 0) sebab.push("pihak kedua tidak tercatat di data e-Court");

  const terakhir = ecourtPihak
    .map((p) => tanggalIso(p.terakhirTerlihat))
    .filter(Boolean)
    .sort()
    .pop();

  return {
    ecourtTerbaca: ecourtAda,
    sebab: sebab.join("; "),
    penggugat,
    tergugat,
    ...(terakhir ? { terakhirTerlihat: terakhir } : {}),
  };
}

/**
 * Layanan dengan ketergantungan yang dapat ditukar - uji memakai basis data
 * tiruan; produksi memakai sambungan yang sama dengan layanan lain. Semua
 * require dikerjakan LAMBAT supaya memuat berkas ini tidak membuka sambungan.
 */
function buatLayanan(deps = {}) {
  const kueriSipp =
    deps.kueriSipp ||
    ((sql, params = []) =>
      new Promise((selesai, gagal) => {
        require("../db_config").query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil)));
      }));
  const bacaEcourt = deps.bacaEcourt || ((nomorPerkara) => require("./ecourtStoreService").bacaPanggilanPerkara(nomorPerkara));

  /**
   * Keterangan kontak satu perkara. Hanya SELECT ke SIPP dan hanya membaca
   * tabel bot - tidak ada tulisan ke mana pun.
   */
  async function kontakPerkara(perkaraId) {
    const id = Number(perkaraId);
    if (!Number.isInteger(id) || id <= 0) return { ok: false, alasan: "perkara_tidak_sah" };

    let nomorPerkara = "";
    const sipp = { terbaca: false, pihak: [] };
    try {
      const perkara = await kueriSipp(`SELECT nomor_perkara AS nomorPerkara FROM perkara WHERE perkara_id = ? LIMIT 1`, [id]);
      nomorPerkara = bersih(Array.isArray(perkara) && perkara[0] && perkara[0].nomorPerkara);
      const pihak = await kueriSipp(
        `SELECT 1 AS sisi, p.email AS email
           FROM perkara_pihak1 pp JOIN pihak p ON p.id = pp.pihak_id
          WHERE pp.perkara_id = ?
         UNION ALL
         SELECT 2 AS sisi, p.email AS email
           FROM perkara_pihak2 pp JOIN pihak p ON p.id = pp.pihak_id
          WHERE pp.perkara_id = ?`,
        [id, id]
      );
      sipp.pihak = (Array.isArray(pihak) ? pihak : []).map((p) => ({ sisi: Number(p.sisi), email: bersih(p.email) }));
      sipp.terbaca = true;
    } catch {
      sipp.terbaca = false;
    }

    const ecourt = { terbaca: false, pihak: [] };
    if (nomorPerkara) {
      try {
        const hasil = await bacaEcourt(nomorPerkara);
        ecourt.pihak = Array.isArray(hasil && hasil.pihak) ? hasil.pihak : [];
        ecourt.terbaca = true;
      } catch {
        ecourt.terbaca = false;
      }
    }

    return { ok: true, kontak: susunKontak({ sipp, ecourt }) };
  }

  return { kontakPerkara };
}

let bawaan = null;
function layananBawaan() {
  if (!bawaan) bawaan = buatLayanan();
  return bawaan;
}

module.exports = {
  EMAIL_SAH,
  emailSah,
  sisiPeran,
  gabungPersetujuan,
  susunKontak,
  buatLayanan,
  kontakPerkara: (id) => layananBawaan().kontakPerkara(id),
};
