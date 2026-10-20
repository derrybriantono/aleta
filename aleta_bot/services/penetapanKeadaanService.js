"use strict";

/**
 * ============================================================================
 * KEADAAN PENETAPAN SATU PERKARA - SATU SUMBER UNTUK SEMUA PEMBACA
 * ============================================================================
 *
 * Sebelum modul ini, "apakah PMH/PPP/PJS/PHS perkara ini sudah ada?" dijawab
 * tiga kali oleh tiga kode yang berdiri sendiri: penyusun rencana tulis
 * (penetapanTulisService.keadaanPerkara), usulan papan (penunjukanService.
 * penetapanPerkara), dan penanda baris daftar perkara (sippKonteksService).
 * Ketiganya kebetulan membaca empat kolom tanggal yang sama - tetapi tidak ada
 * yang menjamin mereka akan terus sepakat, dan penetapan ganda lahir tepat
 * dari dua pembaca yang tidak sepakat.
 *
 * Kini keempatnya (dan ekstensi, tombol halaman SIPP, serta borang SIPP yang
 * disimpan peramban) bertanya ke sini.
 *
 * DEFINISI "ADA". Sebuah langkah ADA bila tanggal penetapannya terisi di
 * perkara_penetapan ATAU barisnya sudah ada di tabel pejabatnya
 * (perkara_hakim_pn / perkara_panitera_pn / perkara_jurusita aktif='Y',
 * perkara_penetapan_hari_sidang). Mana saja cukup. Keadaan separuh - tanggal
 * terisi tanpa baris, atau baris tanpa tanggal - tetap dianggap ada (tidak
 * pernah ditimpa) dan ditandai `tidakSelaras`: yang separuh itu urusan
 * pemeriksaan manusia, bukan sesuatu yang boleh ditulis di atasnya.
 *
 * GAGAL TERTUTUP. Keadaan yang tidak terbaca bukan "belum ada": pemanggil
 * menerima { ok:false } dan tidak boleh menulis.
 *
 * Tidak ada penulisan di berkas ini.
 */

const crypto = require("crypto");

const JENIS = Object.freeze(["pmh", "ppp", "pjs", "phs"]);

function runQueryBawaan(sql, params = []) {
  const db = require("../db_config");
  return new Promise((selesai, gagal) => {
    db.query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil)));
  });
}

/** Tanggal ISO (yyyy-mm-dd) dari Date/teks SIPP; "" bila kosong atau 0000-00-00. */
function isoTanggal(nilai) {
  if (nilai === null || nilai === undefined || nilai === "") return "";
  if (nilai instanceof Date) {
    if (Number.isNaN(nilai.getTime())) return "";
    const p = (n) => String(n).padStart(2, "0");
    return `${nilai.getFullYear()}-${p(nilai.getMonth() + 1)}-${p(nilai.getDate())}`;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(nilai));
  if (!m || m[1] === "0000") return "";
  return `${m[1]}-${m[2]}-${m[3]}`;
}

const angka = (n) => {
  const x = Number(n);
  return Number.isFinite(x) && x > 0 ? Math.floor(x) : 0;
};

/** Bentuk keadaan satu perkara dari satu baris hasil kueri. Murni - diuji langsung. */
function bentukKeadaan(baris, kunci = { aktif: false }) {
  const b = baris || {};
  const tanggal = {
    pmh: isoTanggal(b.pmh),
    ppp: isoTanggal(b.ppp),
    pjs: isoTanggal(b.pjs),
    phs: isoTanggal(b.phs),
  };
  const jumlah = { pmh: angka(b.nPmh), ppp: angka(b.nPpp), pjs: angka(b.nPjs), phs: angka(b.nPhs) };

  const langkah = {};
  const tidakSelaras = [];
  for (const jenis of JENIS) {
    const adaTanggal = Boolean(tanggal[jenis]);
    const adaBaris = jumlah[jenis] > 0;
    if (adaTanggal !== adaBaris) tidakSelaras.push(jenis);
    langkah[jenis] = { ada: adaTanggal || adaBaris, tanggal: tanggal[jenis], baris: jumlah[jenis] };
  }
  langkah.phs.tanggalSidang = isoTanggal(b.sidangPertama);

  const sisa = JENIS.filter((j) => !langkah[j].ada);
  const sidik = crypto
    .createHash("sha1")
    .update(JSON.stringify(JENIS.map((j) => [langkah[j].tanggal, langkah[j].baris])) + String(langkah.phs.tanggalSidang))
    .digest("hex")
    .slice(0, 8);

  return {
    ok: true,
    perkaraId: angka(b.perkaraId),
    nomorPerkara: String(b.nomorPerkara || ""),
    langkah,
    sisa,
    lengkap: sisa.length === 0,
    tidakSelaras,
    sidik,
    tahapanTerakhirId: angka(b.tahapanTerakhirId),
    prosesTerakhirId: angka(b.prosesTerakhirId),
    kunci,
  };
}

const SQL_KEADAAN = `
  SELECT p.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara,
         p.tahapan_terakhir_id AS tahapanTerakhirId, p.proses_terakhir_id AS prosesTerakhirId,
         pen.penetapan_majelis_hakim AS pmh,
         pen.penetapan_panitera_pengganti AS ppp,
         pen.penetapan_jurusita AS pjs,
         pen.penetapan_hari_sidang AS phs,
         pen.sidang_pertama AS sidangPertama,
         (SELECT COUNT(*) FROM perkara_hakim_pn x WHERE x.perkara_id = p.perkara_id AND x.aktif = 'Y') AS nPmh,
         (SELECT COUNT(*) FROM perkara_panitera_pn x WHERE x.perkara_id = p.perkara_id AND x.aktif = 'Y') AS nPpp,
         (SELECT COUNT(*) FROM perkara_jurusita x WHERE x.perkara_id = p.perkara_id AND x.aktif = 'Y') AS nPjs,
         (SELECT COUNT(*) FROM perkara_penetapan_hari_sidang x WHERE x.perkara_id = p.perkara_id) AS nPhs
    FROM perkara p
    LEFT JOIN perkara_penetapan pen ON pen.perkara_id = p.perkara_id
   WHERE `;

/**
 * Keadaan banyak perkara sekaligus (penanda baris daftar memakai ini).
 * `perkara` boleh id (angka) atau nomor perkara (teks). Pulang
 * { ok:true, peta: { [kunciMasukan]: keadaan }, tidakKetemu: [..] } atau
 * { ok:false, alasan:"keadaan_tidak_terbaca", pesan }.
 */
async function keadaanBanyak(perkara, { kueri = runQueryBawaan, kunciDari = null } = {}) {
  const masukan = (Array.isArray(perkara) ? perkara : [perkara]).map((x) => (typeof x === "number" ? x : String(x == null ? "" : x).trim())).filter((x) => x !== "" && x !== 0);
  if (masukan.length === 0) return { ok: true, peta: {}, tidakKetemu: [] };
  const daftarId = [];
  const daftarNomor = [];
  for (const x of masukan) {
    if (typeof x === "number" || /^\d+$/.test(String(x))) daftarId.push(Number(x));
    else daftarNomor.push(String(x));
  }
  const peta = {};
  const tidakKetemu = [];
  try {
    const terbaca = [];
    if (daftarId.length) {
      const baris = await kueri(`${SQL_KEADAAN} p.perkara_id IN (${daftarId.map(() => "?").join(",")})`, daftarId);
      const hasilId = Array.isArray(baris) ? baris : [];
      // Satu id diminta, satu baris pulang: barisnya milik id itu walau kolom
      // perkara_id tidak ikut terbaca (basis data tiruan pada uji).
      if (daftarId.length === 1 && hasilId.length === 1 && !angka(hasilId[0].perkaraId)) {
        hasilId[0] = { ...hasilId[0], perkaraId: daftarId[0] };
      }
      for (const b of hasilId) terbaca.push(b);
    }
    if (daftarNomor.length) {
      const baris = await kueri(`${SQL_KEADAAN} p.nomor_perkara IN (${daftarNomor.map(() => "?").join(",")})`, daftarNomor);
      for (const b of Array.isArray(baris) ? baris : []) terbaca.push(b);
    }
    const kunciKunci = typeof kunciDari === "function" ? kunciDari : () => ({ aktif: false });
    for (const b of terbaca) {
      const k = bentukKeadaan(b, kunciKunci(angka(b.perkaraId)));
      peta[k.perkaraId] = k;
      if (k.nomorPerkara) peta[k.nomorPerkara] = k;
    }
    for (const x of masukan) {
      if (!peta[x]) tidakKetemu.push(x);
    }
    return { ok: true, peta, tidakKetemu };
  } catch (galat) {
    return { ok: false, alasan: "keadaan_tidak_terbaca", pesan: String((galat && galat.message) || galat).slice(0, 200) };
  }
}

/** Keadaan satu perkara: { ok:true, ...keadaan } | { ok:false, alasan }. */
async function keadaanSatu(perkara, opsi = {}) {
  const r = await keadaanBanyak([perkara], opsi);
  if (!r.ok) return r;
  const k = r.peta[typeof perkara === "number" ? perkara : String(perkara).trim()];
  if (!k) return { ok: false, alasan: "perkara_tidak_ketemu" };
  return k;
}

module.exports = {
  JENIS,
  SQL_KEADAAN,
  isoTanggal,
  bentukKeadaan,
  keadaanBanyak,
  keadaanSatu,
};
