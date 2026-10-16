"use strict";

/**
 * ============================================================================
 * UNGGAH MASSAL e-DOC KE SIPP - DAFTAR YANG MENUNGGU (F4.1, 17 OKT 2026)
 * ============================================================================
 *
 * Bahan layar "Unggah massal" (panel ABT): perkara yang e-Doc-nya belum ada di
 * SIPP, sekaligus untuk semua akun - portal yang memilah mana milik siapa.
 *
 *   putusan   perkara_putusan yang SUDAH berisi tanggal putusan (sudah
 *             dibacakan dan Putusan Akhir sudah diisi di SIPP) tetapi kolom
 *             e-Doc putusan atau anonimisasinya masih kosong.
 *   tertahan  sidang beragenda putus yang sudah lewat tetapi perkaranya belum
 *             punya tanggal putusan di SIPP - e-Doc belum DAPAT diunggah
 *             (bot unggah putusan menolak "belum_ada_putusan"), jadi hanya
 *             disebut, bukan ditawarkan.
 *   bas       sidang yang sudah berlangsung (sampai hari ini) dengan
 *             perkara_jadwal_sidang.edoc_bas kosong, beserta jejak BAS di ABT
 *             (keterangan saksi sidang itu) - aturan yang sama dengan
 *             penyatu M2 (penyatuPerkaraService: adaBas, abt_keterangan_saksi).
 *
 * HANYA SELECT berparameter. Nama majelis/PP dikirim sebagai DAFTAR (dipisah
 * "|" di SQL, sebab nama SIPP memuat koma gelar: "Andini Puspita Sari, S.Sy.").
 * Majelis putusan = penetapan pemeriksaan (tahapan_id 10) aktif MAUPUN tidak:
 * SIPP menonaktifkan majelis pemeriksa begitu majelis ikrar ditetapkan
 * (lihat catatan majelis-ikrar-menonaktifkan-pemeriksa).
 *
 * Bagian yang gagal dibaca DISEBUT di `galat` dan bagiannya null - bukan
 * daftar kosong, sebab kosong yang palsu terbaca "tidak ada yang menunggu".
 *
 * `cek` membaca ulang SATU e-Doc tepat sebelum unggah (cek dobel, selaras
 * dengan L1: e-Doc yang sudah ada tidak diganti tanpa persetujuan).
 */

const BATAS_PUTUSAN = 400;
const BATAS_BAS = 800;
const HARI_BAWAAN = 120;

const teks = (x) => String(x == null ? "" : x).trim();
const angka = (x) => {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
};
const ya = (x) => x === true || x === 1 || x === "1" || String(x).toUpperCase() === "Y";
const daftarNama = (x) =>
  teks(x)
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);

/** "YYYY-MM-DD" atau "" (tanggal nol SIPP = kosong). Murni. */
function tgl(x) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(teks(x));
  if (!m || m[1] === "0000") return "";
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/** Tanggal ISO dikurangi n hari (UTC, tanpa jam). Murni. */
function mundurHari(iso, n) {
  const t = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(t)) return iso;
  return new Date(t - n * 86400000).toISOString().slice(0, 10);
}

function depsBawaan() {
  const sippDb = require("../db_config");
  const abtDb = require("../db_config5");
  const skema = require("./sippSkemaService");
  const kueri = (pool) => (sql, params = []) =>
    new Promise((ok, gagal) => pool.query(sql, params, (g, h) => (g ? gagal(g) : ok(Array.isArray(h) ? h : []))));
  return {
    kueriSipp: kueri(sippDb),
    kueriAbt: kueri(abtDb),
    tabelAda: (t) => skema.tabelAda(t),
    kolomAda: (t, k) => skema.kolomAda(t, k),
    // Hari ini menurut jam SIPP (WIB) - tanggal sidang SIPP juga ditulis dengan jam itu.
    hariIni: async () => {
      const b = await kueri(sippDb)("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS h");
      return tgl(b[0] && b[0].h) || new Date().toISOString().slice(0, 10);
    },
  };
}

function buatLayanan(depsMasuk) {
  let cache = null;
  const deps = () => {
    if (!cache) cache = depsMasuk || depsBawaan();
    return cache;
  };

  /**
   * Seluruh e-Doc yang menunggu. Pulang
   *   { ok:true, hariIni, sejak, putusan[]|null, tertahan[]|null, bas[]|null, galat[] }
   */
  async function daftar({ sejakHari = HARI_BAWAAN } = {}) {
    const d = deps();
    const galat = [];
    const sebabDari = (e) => String((e && (e.sqlMessage || e.code || e.message)) || e || "tidak diketahui").slice(0, 160);
    const coba = async (sumber, langkah, fn) => {
      try {
        return await fn();
      } catch (e) {
        galat.push({ sumber, langkah, sebab: sebabDari(e) });
        return null;
      }
    };
    const hari = Math.min(366, Math.max(1, Math.round(angka(sejakHari) || HARI_BAWAAN)));
    let hariIni;
    try {
      hariIni = await d.hariIni();
    } catch (e) {
      return { ok: false, alasan: "sipp_tidak_terbaca", sebab: sebabDari(e) };
    }
    const sejak = mundurHari(hariIni, hari);

    const putusan = await coba("sipp", "putusan tanpa e-Doc", async () => {
      for (const t of ["perkara_putusan", "perkara_hakim_pn", "perkara_panitera_pn"]) {
        if (!(await d.tabelAda(t))) throw new Error(`tabel ${t} tidak terbaca`);
      }
      const adaStatus = await d.tabelAda("status_putusan");
      const b = await d.kueriSipp(
        `SELECT p.perkara_id, p.nomor_perkara, p.jenis_perkara_nama, p.alur_perkara_id,
                DATE_FORMAT(pp.tanggal_putusan, '%Y-%m-%d') AS tanggal_putusan,
                ${adaStatus ? "sp.nama" : "NULL"} AS status_putusan, pp.putusan_verstek,
                (pp.amar_putusan_dok IS NOT NULL AND pp.amar_putusan_dok <> '') AS ada_putusan,
                (pp.amar_putusan_anonimisasi_dok IS NOT NULL AND pp.amar_putusan_anonimisasi_dok <> '') AS ada_anonim,
                (SELECT GROUP_CONCAT(DISTINCT h.hakim_nama ORDER BY h.urutan SEPARATOR '|')
                   FROM perkara_hakim_pn h WHERE h.perkara_id = p.perkara_id AND h.tahapan_id = 10) AS majelis,
                (SELECT GROUP_CONCAT(DISTINCT n.panitera_nama SEPARATOR '|')
                   FROM perkara_panitera_pn n WHERE n.perkara_id = p.perkara_id AND n.aktif = 'Y') AS panitera
           FROM perkara_putusan pp
           JOIN perkara p ON p.perkara_id = pp.perkara_id
           ${adaStatus ? "LEFT JOIN status_putusan sp ON sp.id = pp.status_putusan_id" : ""}
          WHERE pp.tanggal_putusan IS NOT NULL AND pp.tanggal_putusan <= ? AND pp.tanggal_putusan >= ?
            AND (pp.amar_putusan_dok IS NULL OR pp.amar_putusan_dok = ''
                 OR pp.amar_putusan_anonimisasi_dok IS NULL OR pp.amar_putusan_anonimisasi_dok = '')
          ORDER BY pp.tanggal_putusan DESC, p.perkara_id DESC
          LIMIT ${BATAS_PUTUSAN}`,
        [hariIni, sejak]
      );
      return b.map((r) => ({
        perkaraId: String(angka(r.perkara_id)),
        nomorPerkara: teks(r.nomor_perkara),
        jenisPerkara: teks(r.jenis_perkara_nama),
        alurPerkaraId: angka(r.alur_perkara_id),
        tanggalPutusan: tgl(r.tanggal_putusan),
        statusPutusan: teks(r.status_putusan),
        verstek: ya(r.putusan_verstek),
        adaPutusan: ya(r.ada_putusan),
        adaAnonim: ya(r.ada_anonim),
        majelis: daftarNama(r.majelis),
        panitera: daftarNama(r.panitera),
      }));
    });

    const tertahan = await coba("sipp", "putusan belum diisi", async () => {
      const b = await d.kueriSipp(
        `SELECT js.perkara_id, p.nomor_perkara, MAX(DATE_FORMAT(js.tanggal_sidang, '%Y-%m-%d')) AS tanggal,
                (SELECT GROUP_CONCAT(DISTINCT h.hakim_nama ORDER BY h.urutan SEPARATOR '|')
                   FROM perkara_hakim_pn h WHERE h.perkara_id = js.perkara_id AND h.tahapan_id = 10) AS majelis
           FROM perkara_jadwal_sidang js
           JOIN perkara p ON p.perkara_id = js.perkara_id
           LEFT JOIN perkara_putusan pp ON pp.perkara_id = js.perkara_id
          WHERE js.tanggal_sidang <= ? AND js.tanggal_sidang >= ? AND js.agenda LIKE '%utus%'
            AND (pp.perkara_id IS NULL OR pp.tanggal_putusan IS NULL)
          GROUP BY js.perkara_id, p.nomor_perkara
          ORDER BY tanggal DESC
          LIMIT ${BATAS_PUTUSAN}`,
        [hariIni, sejak]
      );
      return b.map((r) => ({
        perkaraId: String(angka(r.perkara_id)),
        nomorPerkara: teks(r.nomor_perkara),
        tanggalSidang: tgl(r.tanggal),
        majelis: daftarNama(r.majelis),
      }));
    });

    const bas = await coba("sipp", "BAS tanpa e-Doc", async () => {
      if (!(await d.tabelAda("perkara_jadwal_sidang"))) throw new Error("tabel perkara_jadwal_sidang tidak terbaca");
      if (!(await d.kolomAda("perkara_jadwal_sidang", "edoc_bas"))) throw new Error("kolom e-Doc BAS tidak ada di SIPP ini");
      const b = await d.kueriSipp(
        `SELECT js.id, js.perkara_id, p.nomor_perkara, p.jenis_perkara_nama, p.alur_perkara_id, js.urutan,
                DATE_FORMAT(js.tanggal_sidang, '%Y-%m-%d') AS tanggal, js.agenda, js.ditunda, js.alasan_ditunda,
                js.ikrar_talak,
                (SELECT GROUP_CONCAT(DISTINCT n.panitera_nama SEPARATOR '|')
                   FROM perkara_panitera_pn n WHERE n.perkara_id = js.perkara_id AND n.aktif = 'Y') AS panitera,
                (SELECT GROUP_CONCAT(DISTINCT h.hakim_nama ORDER BY h.urutan SEPARATOR '|')
                   FROM perkara_hakim_pn h WHERE h.perkara_id = js.perkara_id AND h.aktif = 'Y') AS majelis
           FROM perkara_jadwal_sidang js
           JOIN perkara p ON p.perkara_id = js.perkara_id
          WHERE js.tanggal_sidang <= ? AND js.tanggal_sidang >= ?
            AND (js.edoc_bas IS NULL OR js.edoc_bas = '')
          ORDER BY js.tanggal_sidang DESC, js.perkara_id DESC, js.urutan
          LIMIT ${BATAS_BAS}`,
        [hariIni, sejak]
      );
      return b.map((r) => ({
        sidangId: String(angka(r.id)),
        perkaraId: String(angka(r.perkara_id)),
        nomorPerkara: teks(r.nomor_perkara),
        jenisPerkara: teks(r.jenis_perkara_nama),
        alurPerkaraId: angka(r.alur_perkara_id),
        urutan: angka(r.urutan),
        tanggalSidang: tgl(r.tanggal),
        agenda: teks(r.agenda).slice(0, 200),
        ditunda: ya(r.ditunda),
        alasanDitunda: teks(r.alasan_ditunda).slice(0, 200),
        ikrar: ya(r.ikrar_talak),
        panitera: daftarNama(r.panitera),
        majelis: daftarNama(r.majelis),
        saksiAbt: null,
      }));
    });

    // Jejak BAS di ABT: keterangan saksi per sidang (abt_keterangan_saksi.sidang_id =
    // perkara_jadwal_sidang.id) - sumber yang sama dengan penyatu M2. Gagal dibaca =
    // disebut, dan barisnya tetap tampil (saksiAbt null = tidak diketahui).
    let abtTerbaca = false;
    if (bas && bas.length) {
      const id = [...new Set(bas.map((x) => Number(x.perkaraId)).filter((n) => n > 0))];
      const saksi = await coba("abt", "keterangan saksi", async () => {
        const hasil = [];
        for (let i = 0; i < id.length; i += 200) {
          const potong = id.slice(i, i + 200);
          const b = await d.kueriAbt(
            `SELECT perkara_id, sidang_id, COUNT(*) AS n, COUNT(DISTINCT saksi_id) AS saksi
               FROM abt_keterangan_saksi WHERE perkara_id IN (${potong.map(() => "?").join(",")})
              GROUP BY perkara_id, sidang_id`,
            potong
          );
          hasil.push(...b);
        }
        return hasil;
      });
      if (saksi) {
        abtTerbaca = true;
        const peta = new Map(saksi.map((r) => [String(angka(r.sidang_id)), { saksi: angka(r.saksi), tanyaJawab: angka(r.n) }]));
        for (const x of bas) x.saksiAbt = peta.get(x.sidangId) || { saksi: 0, tanyaJawab: 0 };
      }
    }

    return { ok: true, hariIni, sejak, putusan, tertahan, bas, abtTerbaca, galat };
  }

  /**
   * Keadaan SATU e-Doc saat ini (cek dobel tepat sebelum unggah).
   *   jenis "putusan": { ok, adaPutusan, adaAnonim, jalurPutusan, jalurAnonim, tanggalPutusan }
   *   jenis "bas":     { ok, adaBas, jalur, urutan, tanggalSidang }
   */
  async function cek({ jenis, perkaraId, sidangId } = {}) {
    const d = deps();
    const pid = Number(perkaraId);
    if (!Number.isInteger(pid) || pid <= 0) return { ok: false, alasan: "perkara_tidak_sah" };
    if (jenis === "putusan") {
      const b = await d.kueriSipp(
        `SELECT DATE_FORMAT(tanggal_putusan, '%Y-%m-%d') AS tanggal_putusan, amar_putusan_dok, amar_putusan_anonimisasi_dok
           FROM perkara_putusan WHERE perkara_id = ? LIMIT 1`,
        [pid]
      );
      const r = b[0];
      if (!r) return { ok: true, adaBaris: false, adaPutusan: false, adaAnonim: false, jalurPutusan: "", jalurAnonim: "", tanggalPutusan: "" };
      return {
        ok: true,
        adaBaris: true,
        tanggalPutusan: tgl(r.tanggal_putusan),
        adaPutusan: Boolean(teks(r.amar_putusan_dok)),
        adaAnonim: Boolean(teks(r.amar_putusan_anonimisasi_dok)),
        jalurPutusan: teks(r.amar_putusan_dok).split("/").pop() || "",
        jalurAnonim: teks(r.amar_putusan_anonimisasi_dok).split("/").pop() || "",
      };
    }
    if (jenis === "bas") {
      const sid = Number(sidangId);
      if (!Number.isInteger(sid) || sid <= 0) return { ok: false, alasan: "sidang_tidak_sah" };
      const b = await d.kueriSipp(
        `SELECT urutan, DATE_FORMAT(tanggal_sidang, '%Y-%m-%d') AS tanggal, edoc_bas
           FROM perkara_jadwal_sidang WHERE id = ? AND perkara_id = ? LIMIT 1`,
        [sid, pid]
      );
      const r = b[0];
      if (!r) return { ok: false, alasan: "sidang_tidak_ditemukan" };
      return {
        ok: true,
        adaBas: Boolean(teks(r.edoc_bas)),
        jalur: teks(r.edoc_bas).split("/").pop() || "",
        urutan: angka(r.urutan),
        tanggalSidang: tgl(r.tanggal),
      };
    }
    return { ok: false, alasan: "jenis_tidak_dikenal" };
  }

  return { daftar, cek };
}

const bawaan = buatLayanan();

module.exports = {
  buatLayanan,
  daftar: (...a) => bawaan.daftar(...a),
  cek: (...a) => bawaan.cek(...a),
  _murni: { tgl, mundurHari, daftarNama },
};
