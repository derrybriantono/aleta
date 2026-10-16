"use strict";

/**
 * ============================================================================
 * PENYATU SIPP - ABT - ALETA SATU PERKARA (TAHAP M2, 16 OKT 2026) - BACA SAJA
 * ============================================================================
 *
 * Bahan kotak "Perkara ini di SIPP, ABT, dan ALETA" di halaman perkara SIPP:
 * status blangko, BAS yang belum diunggah, tugas per peran, dan selisih tiga
 * sumber. Layanan ini HANYA MENGUMPULKAN fakta mentah dari tiga basis data;
 * menimbang dan menyusun kalimatnya dikerjakan portal (penyatu.ts), yang juga
 * menambah data ALETA di Postgres (lembar BAS, blangko terbit, kamus).
 *
 *   SIPP (db_config)        jadwal sidang + e-Doc BAS, majelis/PP/JS aktif,
 *                           tanggal penetapan, e-Doc penetapan, putusan +
 *                           e-Doc, relaas, jadwal mediasi, tanda e-Court.
 *   ABT  (db_config5)       keterangan saksi per sidang (tanya-jawab BAS),
 *                           validasi BAS, isian tangan abt_data_teks/tanggal.
 *   ALETA (botDbService)    putusan e-Court yang dibaca ALETA, tanda sidang
 *                           (selesai/berjalan/kehadiran) ruang sidang ALETA,
 *                           jejak penetapan yang ditulis ALETA.
 *
 * Tidak ada satu pun tulisan: hanya SELECT berparameter. Tiap bagian yang gagal
 * dibaca DISEBUT di `galat` (sumber + langkah + sebab) dan sumbernya ditandai
 * `terbaca:false` - tidak pernah dijawab "kosong", sebab kosong yang palsu
 * terbaca "tidak ada selisih" atau "tidak ada tugas" (lihat penjaga-penyapu).
 *
 * Tabel SIPP yang ditanyakan semuanya sudah ada di const TABEL
 * sippSkemaService (dijaga tabel-sipp-terdaftar.test.ts).
 */

const BATAS_ISIAN_ABT = 400;
const PANJANG_NILAI = 300;

const BULAN = {
  januari: 1,
  februari: 2,
  maret: 3,
  april: 4,
  mei: 5,
  juni: 6,
  juli: 7,
  agustus: 8,
  september: 9,
  oktober: 10,
  november: 11,
  desember: 12,
};

/** "Senin, 18 Mei 2026" (teks e-Court) -> "2026-05-18"; "" bila tak terbaca. Murni. */
function tanggalTeks(teks) {
  const m = /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/.exec(String(teks || ""));
  if (!m) return "";
  const b = BULAN[m[2].toLowerCase()];
  if (!b) return "";
  return `${m[3]}-${String(b).padStart(2, "0")}-${String(Number(m[1])).padStart(2, "0")}`;
}

/** "YYYY-MM-DD" atau "" (tanggal nol SIPP 0000-00-00 = kosong). Murni. */
function tgl(x) {
  const s = String(x == null ? "" : x).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m || m[1] === "0000") return "";
  return `${m[1]}-${m[2]}-${m[3]}`;
}

const teks = (x) => String(x == null ? "" : x).trim();
const angka = (x) => {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
};
const ya = (x) => x === true || x === 1 || x === "1" || String(x).toUpperCase() === "Y";

function depsBawaan() {
  const sippDb = require("../db_config");
  const abtDb = require("../db_config5");
  const botDb = require("./botDbService");
  const skema = require("./sippSkemaService");
  const kueri = (pool) => (sql, params = []) =>
    new Promise((ok, gagal) => pool.query(sql, params, (g, h) => (g ? gagal(g) : ok(Array.isArray(h) ? h : []))));
  return {
    kueriSipp: kueri(sippDb),
    kueriAbt: kueri(abtDb),
    kueriBot: async (sql, params = []) => {
      const h = await botDb.query(sql, params);
      return Array.isArray(h) ? h : [];
    },
    tabelAda: (t) => skema.tabelAda(t),
    kolomAda: (t, k) => skema.kolomAda(t, k),
  };
}

function buatLayanan(depsMasuk) {
  let cache = null;
  const deps = () => {
    if (!cache) cache = depsMasuk || depsBawaan();
    return cache;
  };

  async function kenaliPerkara(d, { perkaraId, nomorPerkara }) {
    const kolom =
      "SELECT perkara_id, nomor_perkara, jenis_perkara_nama, alur_perkara_id, DATE_FORMAT(tanggal_pendaftaran, '%Y-%m-%d') AS tanggal_daftar, " +
      "tahapan_terakhir_text, proses_terakhir_text FROM perkara WHERE ";
    const id = Number(perkaraId);
    if (Number.isInteger(id) && id > 0) {
      const b = await d.kueriSipp(`${kolom}perkara_id = ? LIMIT 1`, [id]);
      if (b[0]) return b[0];
    }
    const nomor = teks(nomorPerkara);
    if (!nomor) return null;
    const b = await d.kueriSipp(`${kolom}nomor_perkara = ? LIMIT 1`, [nomor]);
    return b[0] || null;
  }

  /**
   * Fakta tiga sumber untuk satu perkara. Pulang
   *   { ok:false, alasan } bila perkaranya tidak dikenali SIPP, atau
   *   { ok:true, perkara, sipp, abt, aleta, galat:[{sumber,langkah,sebab}] }.
   */
  async function ringkas({ perkaraId, nomorPerkara } = {}) {
    const d = deps();
    const galat = [];
    const sebabDari = (e) => String((e && (e.sqlMessage || e.code || e.message)) || e || "tidak diketahui").slice(0, 160);
    const coba = async (sumber, langkah, fn, cadangan) => {
      try {
        return await fn();
      } catch (e) {
        galat.push({ sumber, langkah, sebab: sebabDari(e) });
        return cadangan;
      }
    };

    let p;
    try {
      p = await kenaliPerkara(d, { perkaraId, nomorPerkara });
    } catch (e) {
      return { ok: false, alasan: "sipp_tidak_terbaca", sebab: sebabDari(e) };
    }
    if (!p) return { ok: false, alasan: "perkara_tidak_ditemukan" };
    const pid = Number(p.perkara_id);
    const nomor = teks(p.nomor_perkara);

    // ── SIPP ────────────────────────────────────────────────────────────────
    const adaEdocBas = await coba("sipp", "e-Doc BAS", () => d.kolomAda("perkara_jadwal_sidang", "edoc_bas"), false);
    const sidang = await coba(
      "sipp",
      "jadwal sidang",
      async () => {
        if (!(await d.tabelAda("perkara_jadwal_sidang"))) throw new Error("tabel perkara_jadwal_sidang tidak terbaca");
        const b = await d.kueriSipp(
          `SELECT id, urutan, DATE_FORMAT(tanggal_sidang, '%Y-%m-%d') AS tanggal, agenda, ditunda, alasan_ditunda, dihadiri_oleh, ikrar_talak, verzet,
                  ${adaEdocBas ? "(edoc_bas IS NOT NULL AND edoc_bas <> '')" : "NULL"} AS ada_bas
             FROM perkara_jadwal_sidang WHERE perkara_id = ? ORDER BY tanggal_sidang, urutan LIMIT 300`,
          [pid]
        );
        return b.map((r) => ({
          id: angka(r.id),
          urutan: angka(r.urutan),
          tanggal: tgl(r.tanggal),
          agenda: teks(r.agenda).slice(0, 200),
          ditunda: ya(r.ditunda),
          alasanDitunda: teks(r.alasan_ditunda).slice(0, 200),
          dihadiriOleh: teks(r.dihadiri_oleh),
          ikrar: ya(r.ikrar_talak),
          verzet: ya(r.verzet),
          adaBas: r.ada_bas == null ? null : ya(r.ada_bas),
        }));
      },
      null
    );

    const personel = async (tabel, kolomNama, ekstra, langkah) =>
      coba(
        "sipp",
        langkah,
        async () => {
          if (!(await d.tabelAda(tabel))) throw new Error(`tabel ${tabel} tidak terbaca`);
          const b = await d.kueriSipp(
            `SELECT ${kolomNama} AS nama${ekstra ? `, ${ekstra}` : ""}, urutan FROM ${tabel} WHERE perkara_id = ? AND aktif = 'Y' ORDER BY urutan LIMIT 10`,
            [pid]
          );
          return b.map((r) => ({ nama: teks(r.nama), jabatan: teks(r.jabatan), urutan: angka(r.urutan) })).filter((x) => x.nama);
        },
        null
      );
    const hakim = await personel("perkara_hakim_pn", "hakim_nama", "jabatan_hakim_nama AS jabatan", "majelis hakim");
    const pp = await personel("perkara_panitera_pn", "panitera_nama", "", "panitera pengganti");
    const js = await personel("perkara_jurusita", "jurusita_nama", "", "juru sita");

    // perkara_penetapan menyimpan penetapan TERAKHIR: PMH/PPP baru, atau PHS
    // penetapan kembali, menimpa tanggal sebelumnya beserta sidang_pertama
    // (273/G: sidang_pertama 29 Juli, padahal sidang ke-1 13 Mei). Sama dengan
    // penanda L2 (sippIdeL2Service): penetapan PERTAMA dari riwayat per tabel
    // dan sidang pertama dari jadwal sidang.
    const penetapan = await coba(
      "sipp",
      "penetapan",
      async () => {
        if (!(await d.tabelAda("perkara_penetapan"))) throw new Error("tabel perkara_penetapan tidak terbaca");
        const b = await d.kueriSipp(
          `SELECT DATE_FORMAT(penetapan_majelis_hakim, '%Y-%m-%d') AS pmh, DATE_FORMAT(penetapan_panitera_pengganti, '%Y-%m-%d') AS ppp,
                  DATE_FORMAT(penetapan_jurusita, '%Y-%m-%d') AS pjs, DATE_FORMAT(penetapan_hari_sidang, '%Y-%m-%d') AS phs,
                  DATE_FORMAT(sidang_pertama, '%Y-%m-%d') AS sidang_pertama
             FROM perkara_penetapan WHERE perkara_id = ? LIMIT 1`,
          [pid]
        );
        const r = b[0] || {};
        let awal = null;
        const riwayat = ["perkara_hakim_pn", "perkara_panitera_pn", "perkara_jurusita", "perkara_penetapan_hari_sidang"];
        if ((await Promise.all(riwayat.map((t) => d.tabelAda(t)))).every(Boolean)) {
          const h = await d.kueriSipp(
            `SELECT (SELECT DATE_FORMAT(MIN(tanggal_penetapan), '%Y-%m-%d') FROM perkara_hakim_pn WHERE perkara_id = ?) AS pmh,
                    (SELECT DATE_FORMAT(MIN(tanggal_penetapan), '%Y-%m-%d') FROM perkara_panitera_pn WHERE perkara_id = ?) AS ppp,
                    (SELECT DATE_FORMAT(MIN(tanggal_penetapan), '%Y-%m-%d') FROM perkara_jurusita WHERE perkara_id = ?) AS pjs,
                    (SELECT DATE_FORMAT(MIN(tanggal_penetapan), '%Y-%m-%d') FROM perkara_penetapan_hari_sidang WHERE perkara_id = ?) AS phs`,
            [pid, pid, pid, pid]
          );
          const a = h[0] || {};
          awal = { pmh: tgl(a.pmh), ppp: tgl(a.ppp), pjs: tgl(a.pjs), phs: tgl(a.phs) };
        }
        const pertamaJadwal = (sidang || []).map((x) => x.tanggal).filter(Boolean).sort()[0] || "";
        return {
          pmh: tgl(r.pmh),
          ppp: tgl(r.ppp),
          pjs: tgl(r.pjs),
          phs: tgl(r.phs),
          sidangPertama: pertamaJadwal || tgl(r.sidang_pertama),
          sidangPertamaPenetapan: tgl(r.sidang_pertama),
          awal,
        };
      },
      null
    );

    const edocPenetapan = await coba(
      "sipp",
      "e-Doc penetapan",
      async () => {
        if (!(await d.tabelAda("perkara_dokumen_penetapan"))) throw new Error("tabel perkara_dokumen_penetapan tidak terbaca");
        const b = await d.kueriSipp(
          "SELECT jenis_dokumen_id AS j, COUNT(*) AS n FROM perkara_dokumen_penetapan WHERE perkara_id = ? GROUP BY jenis_dokumen_id",
          [pid]
        );
        const ada = new Set(b.filter((r) => angka(r.n) > 0).map((r) => angka(r.j)));
        return { pmh: ada.has(1), ppp: ada.has(2), pjs: ada.has(3), phs: ada.has(4) };
      },
      null
    );

    const putusan = await coba(
      "sipp",
      "putusan",
      async () => {
        if (!(await d.tabelAda("perkara_putusan"))) throw new Error("tabel perkara_putusan tidak terbaca");
        const adaStatus = await d.tabelAda("status_putusan");
        const b = await d.kueriSipp(
          `SELECT DATE_FORMAT(pu.tanggal_putusan, '%Y-%m-%d') AS tanggal, ${adaStatus ? "sp.nama" : "NULL"} AS status_nama, pu.putusan_verstek AS verstek,
                  (pu.amar_putusan_dok IS NOT NULL AND pu.amar_putusan_dok <> '') AS ada_edoc,
                  (pu.amar_putusan_anonimisasi_dok IS NOT NULL AND pu.amar_putusan_anonimisasi_dok <> '') AS ada_anonim,
                  DATE_FORMAT(pu.tanggal_minutasi, '%Y-%m-%d') AS minutasi, DATE_FORMAT(pu.tanggal_bht, '%Y-%m-%d') AS bht
             FROM perkara_putusan pu ${adaStatus ? "LEFT JOIN status_putusan sp ON sp.id = pu.status_putusan_id" : ""}
            WHERE pu.perkara_id = ? LIMIT 1`,
          [pid]
        );
        const r = b[0];
        if (!r) return { ada: false, tanggal: "", statusNama: "", verstek: false, adaEdoc: false, adaAnonim: false, minutasi: "", bht: "" };
        return {
          ada: Boolean(tgl(r.tanggal)),
          tanggal: tgl(r.tanggal),
          statusNama: teks(r.status_nama),
          verstek: ya(r.verstek),
          adaEdoc: ya(r.ada_edoc),
          adaAnonim: ya(r.ada_anonim),
          minutasi: tgl(r.minutasi),
          bht: tgl(r.bht),
        };
      },
      null
    );

    const relaas = await coba(
      "sipp",
      "relaas",
      async () => {
        if (!(await d.tabelAda("perkara_pelaksanaan_relaas"))) throw new Error("tabel perkara_pelaksanaan_relaas tidak terbaca");
        const b = await d.kueriSipp(
          `SELECT sidang_id, COUNT(*) AS n, SUM(doc_relaas IS NOT NULL AND doc_relaas <> '') AS berdokumen
             FROM perkara_pelaksanaan_relaas WHERE perkara_id = ? GROUP BY sidang_id`,
          [pid]
        );
        return b.map((r) => ({ sidangId: angka(r.sidang_id), jumlah: angka(r.n), berdokumen: angka(r.berdokumen) }));
      },
      null
    );

    // Pemberitahuan putusan per pihak (1 = Penggugat/Pemohon, 2 = Tergugat/Termohon).
    // MAX: pemberitahuan yang diulang - yang terakhir yang berlaku (sama dengan L2).
    const pemberitahuan = await coba(
      "sipp",
      "pemberitahuan putusan",
      async () => {
        if (!(await d.tabelAda("perkara_putusan_pemberitahuan_putusan"))) throw new Error("tabel perkara_putusan_pemberitahuan_putusan tidak terbaca");
        const b = await d.kueriSipp(
          `SELECT pihak, DATE_FORMAT(MAX(tanggal_pemberitahuan_putusan), '%Y-%m-%d') AS tanggal
             FROM perkara_putusan_pemberitahuan_putusan
            WHERE perkara_id = ? AND tanggal_pemberitahuan_putusan IS NOT NULL GROUP BY pihak`,
          [pid]
        );
        const hasil = { pihak1: "", pihak2: "" };
        for (const r of b) {
          const k = `pihak${angka(r.pihak)}`;
          if (k === "pihak1" || k === "pihak2") hasil[k] = tgl(r.tanggal);
        }
        return hasil;
      },
      null
    );

    // Daftar saksi perkara di SIPP (perkara_pihak5) - pembanding keterangan
    // saksi ABT, yang menyimpan saksi_id = perkara_pihak5.id. Tanya-jawab saksi
    // SIPP (perkara_keterangan_saksi) hanya DIHITUNG: diukur 17 Okt, tabel itu
    // 4 baris untuk seluruh register (satu perkara 2024) - membandingkannya
    // akan merah pada setiap perkara.
    const saksiSipp = await coba(
      "sipp",
      "daftar saksi",
      async () => {
        if (!(await d.tabelAda("perkara_pihak5"))) throw new Error("tabel perkara_pihak5 tidak terbaca");
        const b = await d.kueriSipp("SELECT id, saksi_pihak_ke AS sisi FROM perkara_pihak5 WHERE perkara_id = ? LIMIT 100", [pid]);
        let keterangan = null;
        if (await d.tabelAda("perkara_keterangan_saksi")) {
          const k = await d.kueriSipp("SELECT COUNT(*) AS n FROM perkara_keterangan_saksi WHERE perkara_id = ?", [pid]);
          keterangan = angka(k[0] && k[0].n);
        }
        return { daftar: b.map((r) => ({ id: angka(r.id), sisi: angka(r.sisi) })).filter((x) => x.id > 0), keterangan };
      },
      null
    );

    const mediasi = await coba(
      "sipp",
      "jadwal mediasi",
      async () => {
        if (!(await d.tabelAda("perkara_jadwal_mediasi")) || !(await d.tabelAda("perkara_mediasi"))) return [];
        const b = await d.kueriSipp(
          `SELECT DISTINCT DATE_FORMAT(m.tanggal_mediasi, '%Y-%m-%d') AS t
             FROM perkara_jadwal_mediasi m JOIN perkara_mediasi pm ON pm.mediasi_id = m.mediasi_id WHERE pm.perkara_id = ?`,
          [pid]
        );
        return b.map((r) => tgl(r.t)).filter(Boolean);
      },
      []
    );

    const ecourt = await coba(
      "sipp",
      "tanda e-Court",
      async () => {
        if (!(await d.tabelAda("perkara_efiling_id"))) return false;
        const b = await d.kueriSipp("SELECT COUNT(*) AS n FROM perkara_efiling_id WHERE perkara_id = ?", [pid]);
        return angka(b[0] && b[0].n) > 0;
      },
      null
    );

    // ── ABT ─────────────────────────────────────────────────────────────────
    const abtSaksi = await coba(
      "abt",
      "keterangan saksi",
      async () => {
        const b = await d.kueriAbt(
          `SELECT sidang_id, COUNT(*) AS n, COUNT(DISTINCT saksi_id) AS saksi, GROUP_CONCAT(DISTINCT saksi_id) AS saksi_id,
                  DATE_FORMAT(MAX(IFNULL(diperbaharui_tanggal, diinput_tanggal)), '%Y-%m-%d') AS terakhir
             FROM abt_keterangan_saksi WHERE perkara_id = ? GROUP BY sidang_id`,
          [pid]
        );
        return b.map((r) => ({
          sidangId: angka(r.sidang_id),
          tanyaJawab: angka(r.n),
          saksi: angka(r.saksi),
          saksiId: teks(r.saksi_id)
            .split(",")
            .map(angka)
            .filter((n) => n > 0),
          terakhir: tgl(r.terakhir),
        }));
      },
      null
    );
    const abtValidasi = await coba(
      "abt",
      "validasi BAS",
      async () => {
        const b = await d.kueriAbt(
          `SELECT sidang_ke, DATE_FORMAT(tgl_sidang, '%Y-%m-%d') AS tgl, status, DATE_FORMAT(validasi_tanggal, '%Y-%m-%d') AS divalidasi
             FROM abt_data_validasi_bas WHERE perkara_id = ? ORDER BY sidang_ke`,
          [pid]
        );
        return b.map((r) => ({ sidangKe: angka(r.sidang_ke), tanggal: tgl(r.tgl), sah: angka(r.status) === 1, divalidasi: tgl(r.divalidasi) }));
      },
      null
    );
    const abtIsian = await coba(
      "abt",
      "isian tangan",
      async () => {
        const t = await d.kueriAbt(
          `SELECT no_var, data FROM abt_data_teks WHERE perkara_id = ? AND data IS NOT NULL AND data <> '' LIMIT ${BATAS_ISIAN_ABT}`,
          [pid]
        );
        const g = await d.kueriAbt(
          `SELECT no_var, DATE_FORMAT(data, '%Y-%m-%d') AS data FROM abt_data_tanggal WHERE perkara_id = ? AND data IS NOT NULL LIMIT ${BATAS_ISIAN_ABT}`,
          [pid]
        );
        return [
          ...t.map((r) => ({ kode: teks(r.no_var), jenis: "teks", nilai: teks(r.data).slice(0, PANJANG_NILAI) })),
          ...g.map((r) => ({ kode: teks(r.no_var), jenis: "tanggal", nilai: tgl(r.data) })).filter((x) => x.nilai),
        ];
      },
      null
    );

    // ── ALETA (basis data bot) ──────────────────────────────────────────────
    const ecourtPutusan = await coba(
      "aleta",
      "putusan e-Court",
      async () => {
        const b = await d.kueriBot(
          `SELECT ada_tab, ada_baris, dokumen_ada, tanggal_putusan_teks, tanggal_bht_teks, DATE_FORMAT(diperiksa_pada, '%Y-%m-%d %H:%i') AS diperiksa
             FROM aleta_bot_ecourt_putusan WHERE nomor_perkara = ? LIMIT 1`,
          [nomor]
        );
        const r = b[0];
        if (!r) return null;
        return {
          adaTab: ya(r.ada_tab),
          adaPutusan: ya(r.ada_baris),
          dokumenAda: ya(r.dokumen_ada),
          tanggalPutusan: tanggalTeks(r.tanggal_putusan_teks),
          tanggalBht: tanggalTeks(r.tanggal_bht_teks),
          diperiksa: teks(r.diperiksa),
        };
      },
      undefined
    );

    // Tabel tanda sidang dibuat layanannya sendiri saat pertama dipakai - belum ada = belum pernah dipakai, bukan galat.
    const tandaSidang = async (langkah, sql) =>
      coba(
        "aleta",
        langkah,
        async () => {
          try {
            return (await d.kueriBot(sql, [pid])).map((r) => tgl(r.t)).filter(Boolean);
          } catch (e) {
            if (e && (e.code === "ER_NO_SUCH_TABLE" || e.errno === 1146)) return [];
            throw e;
          }
        },
        null
      );
    const sidangSelesai = await tandaSidang(
      "sidang selesai",
      "SELECT DISTINCT DATE_FORMAT(tanggal_sidang, '%Y-%m-%d') AS t FROM aleta_bot_sidang_selesai WHERE perkara_id = ?"
    );
    const sidangBerjalan = await tandaSidang(
      "sidang berjalan",
      "SELECT DISTINCT DATE_FORMAT(tanggal_sidang, '%Y-%m-%d') AS t FROM aleta_bot_sidang_berjalan WHERE perkara_id = ? AND dibatalkan_pada IS NULL"
    );
    const kehadiran = await tandaSidang(
      "kehadiran antrian",
      "SELECT DISTINCT DATE_FORMAT(tanggal, '%Y-%m-%d') AS t FROM aleta_bot_antrian_kehadiran WHERE perkara_id = ? AND dibatalkan_pada IS NULL"
    );
    const jejakPenetapan = await coba(
      "aleta",
      "jejak penetapan",
      async () => {
        try {
          const b = await d.kueriBot(
            `SELECT aksi, jenis, DATE_FORMAT(tanggal_penetapan, '%Y-%m-%d') AS tgl, DATE_FORMAT(waktu, '%Y-%m-%d %H:%i') AS waktu
               FROM aleta_bot_jejak_penetapan WHERE perkara_id = ? AND berhasil = 1 AND kering = 0 ORDER BY waktu DESC LIMIT 60`,
            [pid]
          );
          return b.map((r) => ({ aksi: teks(r.aksi), jenis: teks(r.jenis), tanggal: tgl(r.tgl), waktu: teks(r.waktu) }));
        } catch (e) {
          if (e && (e.code === "ER_NO_SUCH_TABLE" || e.errno === 1146)) return [];
          throw e;
        }
      },
      null
    );

    const terbaca = (sumber) => !galat.some((g) => g.sumber === sumber);
    return {
      ok: true,
      perkara: {
        perkaraId: pid,
        nomorPerkara: nomor,
        jenisPerkara: teks(p.jenis_perkara_nama),
        alurPerkaraId: angka(p.alur_perkara_id),
        tanggalDaftar: tgl(p.tanggal_daftar),
        tahapan: teks(p.tahapan_terakhir_text),
        proses: teks(p.proses_terakhir_text),
        ecourt,
      },
      sipp: { terbaca: terbaca("sipp"), sidang, hakim, pp, js, penetapan, edocPenetapan, putusan, pemberitahuan, saksi: saksiSipp, relaas, mediasi },
      abt: { terbaca: terbaca("abt"), saksi: abtSaksi, validasiBas: abtValidasi, isian: abtIsian },
      aleta: {
        terbaca: terbaca("aleta"),
        ecourtPutusan: ecourtPutusan === undefined ? undefined : ecourtPutusan,
        tandaSidang: { selesai: sidangSelesai, berjalan: sidangBerjalan, kehadiran },
        jejakPenetapan,
      },
      galat,
    };
  }

  return { ringkas, kenaliPerkara: (x) => kenaliPerkara(deps(), x) };
}

const layanan = buatLayanan();

module.exports = {
  ringkas: (x) => layanan.ringkas(x),
  buatLayanan,
  murni: { tanggalTeks, tgl },
};
