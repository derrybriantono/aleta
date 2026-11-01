"use strict";

/**
 * ============================================================================
 * PENCOCOK SIPP - ABT - e-COURT: PEMBACA FAKTANYA (N3, 1 Nov 2026)
 * ============================================================================
 *
 * Berkas ini HANYA MEMBACA (SELECT) dan hanya menyusun FAKTA per perkara dari tiga sumber:
 *
 *   SIPP    perkara, perkara_putusan, perkara_jadwal_sidang, perkara_court_calendar, perkara_hakim_pn,
 *           perkara_panitera_pn, perkara_penetapan, perkara_pihak1/2, perkara_biaya, perkara_akta_cerai
 *   ABT     register_perkara_masuk / _putus, register_minutasi, register_akta_cerai, keu_biaya
 *           (register ABT = salinan tervalidasi; isian bebas ABT sengaja tidak dibandingkan di sini)
 *   e-Court aleta_bot_ecourt_putusan (tab putusan e-Court), aleta_bot_ktp_pihak (NIK dari KTP yang diunggah)
 *
 * Keputusan "beda atau tidak" TIDAK diambil di sini - dipegang mesin aturan portal
 * (manajemen_surat/src/lib/pencocok-data.ts) yang dapat diuji tanpa basis data. Pembagian yang sama dengan
 * penjaga tenggat.
 *
 * ============================================================================
 * KINERJA (arahan Derry 1 Nov)
 * ============================================================================
 *
 *   - Satu kueri IN per jenis fakta untuk SATU KELOMPOK perkara (bawaan 100, paling banyak 200) - tidak ada
 *     kueri per perkara (tanpa N+1). Seluruh tabel diindeks pada perkara_id (diukur di sipp_2810).
 *   - Tidak memakai v_pihak_perkara (8,5 detik / 20 perkara); nama pihak dari perkara_pihak1/2 langsung.
 *   - Tiap sumber gagal SENDIRI-SENDIRI dan dicatat di `terbaca`; sumber yang gagal berarti aturan terkait
 *     DIAM (bukan menuduh beda).
 *   - Tidak menulis APA PUN. Tidak satu kata "Aleta" ke SIPP/ABT.
 */

const BATAS_KELOMPOK = 200;
const KELOMPOK_BAWAAN = 100;

function bersih(nilai) {
  return String(nilai === null || nilai === undefined ? "" : nilai).trim();
}

/** YYYY-MM-DD tanpa pergeseran zona waktu (pola yang sama dengan layanan jadwal sidang). */
function isoTanggal(nilai) {
  if (!nilai) return "";
  if (nilai instanceof Date) {
    if (Number.isNaN(nilai.getTime())) return "";
    return `${nilai.getFullYear()}-${String(nilai.getMonth() + 1).padStart(2, "0")}-${String(nilai.getDate()).padStart(2, "0")}`;
  }
  const t = String(nilai);
  return /^\d{4}-\d{2}-\d{2}/.test(t) && !t.startsWith("0000") ? t.slice(0, 10) : "";
}

function angkaAtauNull(nilai) {
  if (nilai === null || nilai === undefined || nilai === "") return null;
  const n = Number(nilai);
  return Number.isFinite(n) ? n : null;
}

function idBersih(daftar, batas = BATAS_KELOMPOK) {
  return [...new Set((daftar || []).map((x) => Number(x)).filter((x) => Number.isInteger(x) && x > 0))].slice(0, batas);
}

const terbaru = (tanggal) => tanggal.filter(Boolean).sort().pop() || "";

const isian = (daftar) => daftar.map(() => "?").join(", ");

function kueriDari(nama) {
  return (sql, params = []) =>
    new Promise((selesai, gagal) => {
      const kolam = nama === "abt" ? require("../db_config5") : nama === "bot" ? require("../bot_db_config") : require("../db_config");
      kolam.query(sql, params, (galat, baris) => (galat ? gagal(galat) : selesai(Array.isArray(baris) ? baris : [])));
    });
}

function sippJadwal() {
  return require("./sippJadwalSidangService");
}

/**
 * d (semua opsional, untuk uji): sipp(sql, params), abt(sql, params), bot(sql, params),
 *   jadwal = { courtCalendarBanyakPerkara, hadirLengkapPertamaBanyakPerkara, mediasiBanyakPerkara,
 *              sidangLaporanMediasiBanyakPerkara, ecourtBanyakPerkara }
 */
function buatLayanan(d = {}) {
  const sipp = d.sipp || kueriDari("sipp");
  const abt = d.abt || kueriDari("abt");
  const bot = d.bot || kueriDari("bot");
  const jadwal = () => d.jadwal || sippJadwal();

  /** Menjalankan satu pembacaan; gagal = nilai kosong + dicatat di `gagal`. */
  async function aman(gagal, nama, kerja, kosong) {
    try {
      return await kerja();
    } catch (galat) {
      gagal[nama] = bersih(galat && galat.message).slice(0, 160) || "gagal";
      return kosong;
    }
  }

  /**
   * Daftar perkara yang diperiksa: SEMUA yang belum putus + yang putus dalam `hariPutus` hari terakhir.
   * Halaman berdasarkan perkara_id naik (setelahId) - kunci utama, tanpa OFFSET.
   */
  async function daftarLingkup({ acuan, hariPutus = 180, setelahId = 0, batas = 500 } = {}) {
    const tanggal = /^\d{4}-\d{2}-\d{2}$/.test(bersih(acuan)) ? bersih(acuan) : isoTanggal(new Date());
    const mulai = new Date(`${tanggal}T12:00:00Z`);
    mulai.setUTCDate(mulai.getUTCDate() - Math.max(1, Math.min(1500, Number(hariPutus) || 180)));
    const sejak = mulai.toISOString().slice(0, 10);
    const jumlah = Math.max(1, Math.min(1000, Number(batas) || 500));
    const baris = await sipp(
      `SELECT p.perkara_id AS perkaraId
         FROM perkara p
         LEFT JOIN perkara_putusan pu ON pu.perkara_id = p.perkara_id
        WHERE p.perkara_id > ? AND (pu.perkara_id IS NULL OR pu.tanggal_putusan >= ?)
        ORDER BY p.perkara_id ASC
        LIMIT ${jumlah}`,
      [Math.max(0, Number(setelahId) || 0), sejak]
    );
    const daftar = baris.map((b) => Number(b.perkaraId));
    return { ok: true, acuan: tanggal, sejak, perkaraId: daftar, berikut: daftar.length === jumlah ? daftar[daftar.length - 1] : null };
  }

  /** Fakta untuk sekelompok perkara. Mengembalikan { ok, acuan, fakta: {perkaraId: {...}}, gagal: {sumber: sebab} }. */
  async function fakta({ perkaraId, acuan } = {}) {
    const ids = idBersih(perkaraId, BATAS_KELOMPOK);
    const tanggal = /^\d{4}-\d{2}-\d{2}$/.test(bersih(acuan)) ? bersih(acuan) : isoTanggal(new Date());
    if (!ids.length) return { ok: false, alasan: "perkara_tidak_dikenali", acuan: tanggal, fakta: {}, gagal: {} };
    const gagal = {};
    const isi = isian(ids);

    // ---- SIPP (semua kueri IN atas perkara_id yang diindeks) --------------------------------------------
    const perkaraBaris = await sipp(
      `SELECT p.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara, p.jenis_perkara_id AS jenisPerkaraId,
              p.jenis_perkara_text AS jenisPerkara, p.alur_perkara_id AS alurPerkaraId,
              p.tanggal_pendaftaran AS tanggalPendaftaran, p.tahapan_terakhir_id AS tahapanId,
              p.tahapan_terakhir_text AS tahapanText, p.proses_terakhir_text AS prosesText
         FROM perkara p WHERE p.perkara_id IN (${isi})`,
      ids
    );

    const [putusanBaris, aktaBaris, sidangBaris, pihakBaris, biayaBaris, hakimBaris, paniteraBaris, penetapanBaris] = await Promise.all([
      aman(gagal, "putusan", () =>
        sipp(
          `SELECT pu.perkara_id AS perkaraId, MAX(pu.tanggal_putusan) AS tanggal, MAX(pu.status_putusan_id) AS statusId,
                  MAX(CASE WHEN LOCATE('verstek', LOWER(IFNULL(pu.amar_putusan, ''))) > 0 THEN 1 ELSE 0 END) AS amarVerstek,
                  MAX(CASE WHEN pu.amar_putusan IS NOT NULL AND CHAR_LENGTH(TRIM(pu.amar_putusan)) > 0 THEN 1 ELSE 0 END) AS adaAmar,
                  MAX(CASE WHEN pu.amar_putusan_dok IS NOT NULL AND TRIM(pu.amar_putusan_dok) <> '' THEN 1 ELSE 0 END) AS adaBerkas,
                  MAX(pu.tanggal_minutasi) AS tanggalMinutasi, MAX(pu.tanggal_bht) AS tanggalBht,
                  MAX(pu.tanggal_cabut) AS tanggalCabut, MAX(pu.tanggal_gugur) AS tanggalGugur
             FROM perkara_putusan pu WHERE pu.perkara_id IN (${isi}) GROUP BY pu.perkara_id`,
          ids
        ), [] ),
      aman(gagal, "akta-cerai", () => sipp(`SELECT perkara_id AS perkaraId, tgl_akta_cerai AS tanggal FROM perkara_akta_cerai WHERE perkara_id IN (${isi})`, ids), []),
      aman(gagal, "sidang", () =>
        sipp(
          `SELECT id, perkara_id AS perkaraId, urutan, tanggal_sidang AS tanggal, agenda, dihadiri_oleh AS dihadiriOleh,
                  ditunda, ikrar_talak AS ikrar, edoc_bas AS edocBas
             FROM perkara_jadwal_sidang WHERE perkara_id IN (${isi}) ORDER BY perkara_id, tanggal_sidang, id`,
          ids
        ), []),
      aman(gagal, "pihak", () =>
        sipp(
          `SELECT perkara_id AS perkaraId, 1 AS ke, urutan, nama, pihak_id AS pihakId FROM perkara_pihak1 WHERE perkara_id IN (${isi})
           UNION ALL
           SELECT perkara_id AS perkaraId, 2 AS ke, urutan, nama, pihak_id AS pihakId FROM perkara_pihak2 WHERE perkara_id IN (${isi})`,
          [...ids, ...ids]
        ), []),
      aman(gagal, "biaya", () =>
        sipp(
          `SELECT perkara_id AS perkaraId,
                  SUM(CASE WHEN jenis_transaksi = 1 THEN jumlah ELSE 0 END) AS masuk,
                  SUM(CASE WHEN jenis_transaksi = -1 THEN jumlah ELSE 0 END) AS keluar,
                  COUNT(*) AS baris
             FROM perkara_biaya WHERE perkara_id IN (${isi}) AND jenis_transaksi IN (1, -1) GROUP BY perkara_id`,
          ids
        ), []),
      aman(gagal, "majelis", () =>
        sipp(
          `SELECT perkara_id AS perkaraId, urutan, hakim_nama AS nama, tanggal_penetapan AS tanggal FROM perkara_hakim_pn
            WHERE perkara_id IN (${isi}) AND aktif = 'Y' ORDER BY perkara_id, urutan`,
          ids
        ), []),
      aman(gagal, "panitera", () =>
        sipp(
          `SELECT perkara_id AS perkaraId, urutan, panitera_nama AS nama, tanggal_penetapan AS tanggal FROM perkara_panitera_pn
            WHERE perkara_id IN (${isi}) AND aktif = 'Y' ORDER BY perkara_id, urutan`,
          ids
        ), []),
      aman(gagal, "penetapan", () =>
        sipp(
          `SELECT perkara_id AS perkaraId, majelis_hakim_text AS majelis, panitera_pengganti_text AS pp,
                  penetapan_majelis_hakim AS tanggalMajelis, penetapan_panitera_pengganti AS tanggalPp
             FROM perkara_penetapan WHERE perkara_id IN (${isi})`,
          ids
        ), []),
    ]);

    // Kuasa hukum: SIPP (perkara_pengacara aktif) dan e-Court (ecourt_kuasa_hukum aktif lewat pendaftaran perkara itu).
    const kuasaSipp = await aman(gagal, "kuasa-sipp", () =>
      sipp(`SELECT perkara_id AS perkaraId, pengacara_id AS pihakId, nama FROM perkara_pengacara WHERE perkara_id IN (${isi}) AND aktif = 'Y'`, ids), []);
    const kuasaEcourt = await aman(gagal, "kuasa-ecourt", () =>
      sipp(
        `SELECT pe.perkara_id AS perkaraId, ep.sipp_pihak_id AS pihakId
           FROM perkara_efiling_id pe
           JOIN ecourt_kuasa_hukum k ON k.efiling_id = pe.efiling_id AND k.aktif = 'Y'
           JOIN ecourt_pengacara ep ON ep.ecourt_pengacara_id = k.ecourt_pengacara_id
          WHERE pe.perkara_id IN (${isi})`,
        ids
      ), []);
    const idKuasaEcourt = [...new Set(kuasaEcourt.map((b) => Number(b.pihakId)).filter((x) => x > 0))].slice(0, 400);
    const namaKuasaEcourt = idKuasaEcourt.length
      ? await aman(gagal, "kuasa-nama", () => sipp(`SELECT id, nama FROM pihak WHERE id IN (${isian(idKuasaEcourt)})`, idKuasaEcourt), [])
      : [];

    // Peta yang sudah ada di layanan jadwal sidang (kueri IN, batas 500) - dipakai apa adanya, tidak disalin.
    const [petaCc, petaHadirLengkap, petaMediasi, petaLaporan, petaEcourt] = await Promise.all([
      aman(gagal, "court-calendar", () => jadwal().courtCalendarBanyakPerkara(ids), {}),
      aman(gagal, "hadir-lengkap", () => jadwal().hadirLengkapPertamaBanyakPerkara(ids), {}),
      aman(gagal, "mediasi", () => jadwal().mediasiBanyakPerkara(ids), {}),
      aman(gagal, "laporan-mediasi", () => jadwal().sidangLaporanMediasiBanyakPerkara(ids), {}),
      aman(gagal, "ecourt", () => jadwal().ecourtBanyakPerkara(ids), {}),
    ]);

    // ---- ABT ---------------------------------------------------------------------------------------------
    const [abtMasuk, abtPutus, abtMinutasi, abtAkta, abtBiaya] = await Promise.all([
      aman(gagal, "abt-masuk", () =>
        abt(
          `SELECT perkara_id AS perkaraId, nomor_perkara AS nomorPerkara, tanggal_pendaftaran AS tanggalPendaftaran,
                  jenis_perkara_id AS jenisPerkaraId, para_pihak AS paraPihak
             FROM register_perkara_masuk WHERE perkara_id IN (${isi})`,
          ids
        ), null),
      aman(gagal, "abt-putus", () =>
        abt(`SELECT perkara_id AS perkaraId, MAX(tanggal_putusan) AS tanggal, MAX(status_putusan_id) AS statusId FROM register_perkara_putus WHERE perkara_id IN (${isi}) GROUP BY perkara_id`, ids),
        null),
      aman(gagal, "abt-minutasi", () => abt(`SELECT perkara_id AS perkaraId, MAX(tanggal_minutasi) AS tanggal FROM register_minutasi WHERE perkara_id IN (${isi}) GROUP BY perkara_id`, ids), null),
      aman(gagal, "abt-akta", () => abt(`SELECT perkara_id AS perkaraId, MAX(tgl_akta_cerai) AS tanggal FROM register_akta_cerai WHERE perkara_id IN (${isi}) GROUP BY perkara_id`, ids), null),
      aman(gagal, "abt-biaya", () =>
        abt(
          `SELECT perkara_id AS perkaraId,
                  SUM(CASE WHEN jenis_transaksi = 1 THEN jumlah ELSE 0 END) AS masuk,
                  SUM(CASE WHEN jenis_transaksi = -1 THEN jumlah ELSE 0 END) AS keluar,
                  COUNT(*) AS baris
             FROM keu_biaya WHERE perkara_id IN (${isi}) AND jenis_transaksi IN (1, -1) GROUP BY perkara_id`,
          ids
        ), null),
    ]);

    // ---- e-Court (basis data bot) -------------------------------------------------------------------------
    const nomorPerkara = perkaraBaris.map((b) => bersih(b.nomorPerkara)).filter(Boolean);
    const ecourtPutusan = nomorPerkara.length
      ? await aman(gagal, "ecourt-putusan", () =>
          bot(
            `SELECT nomor_perkara AS nomorPerkara, ada_tab AS adaTab, ada_baris AS adaBaris, alasan, tanggal_putusan_teks AS tanggalTeks,
                    dokumen_ada AS dokumenAda, panitera_tte AS tte, diperiksa_pada AS diperiksaPada
               FROM aleta_bot_ecourt_putusan WHERE nomor_perkara IN (${isian(nomorPerkara)})`,
            nomorPerkara
          ), null)
      : [];
    const ktpBaris = await aman(gagal, "ktp", () =>
      bot(
        `SELECT perkara_id AS perkaraId, pihak_id AS pihakId, nik, nik_sah AS nikSah, nama
           FROM aleta_bot_ktp_pihak WHERE perkara_id IN (${isi}) AND status = 'terbaca' AND nik <> '' AND pihak_id IS NOT NULL AND pihak_id > 0`,
        ids
      ), []);
    const pihakIdKtp = [...new Set(ktpBaris.map((b) => Number(b.pihakId)).filter((x) => x > 0))].slice(0, 400);
    const nikSipp = pihakIdKtp.length
      ? await aman(gagal, "nik-sipp", () => sipp(`SELECT id, nomor_indentitas AS nik FROM pihak WHERE id IN (${isian(pihakIdKtp)})`, pihakIdKtp), [])
      : [];

    // ---- Susun per perkara ---------------------------------------------------------------------------------
    const per = (baris, kunci = "perkaraId") => {
      const peta = new Map();
      for (const b of baris || []) {
        const k = String(b[kunci]);
        if (!peta.has(k)) peta.set(k, []);
        peta.get(k).push(b);
      }
      return peta;
    };
    const putusanPer = per(putusanBaris);
    const aktaPer = per(aktaBaris);
    const sidangPer = per(sidangBaris);
    const pihakPer = per(pihakBaris);
    const biayaPer = per(biayaBaris);
    const hakimPer = per(hakimBaris);
    const paniteraPer = per(paniteraBaris);
    const penetapanPer = per(penetapanBaris);
    const abtMasukPer = per(abtMasuk);
    const abtPutusPer = per(abtPutus);
    const abtMinutasiPer = per(abtMinutasi);
    const abtAktaPer = per(abtAkta);
    const abtBiayaPer = per(abtBiaya);
    const ecourtPutusanPer = per(ecourtPutusan, "nomorPerkara");
    const ktpPer = per(ktpBaris);
    const nikPer = new Map(nikSipp.map((b) => [String(b.id), bersih(b.nik)]));
    const kuasaSippPer = per(kuasaSipp);
    const kuasaEcourtPer = per(kuasaEcourt);
    const namaKuasaPer = new Map(namaKuasaEcourt.map((b) => [String(b.id), bersih(b.nama)]));

    const hasil = {};
    for (const p of perkaraBaris) {
      const k = String(p.perkaraId);
      const pu = (putusanPer.get(k) || [])[0] || null;
      const akta = (aktaPer.get(k) || [])[0] || null;
      const pen = (penetapanPer.get(k) || [])[0] || null;
      const bm = (abtMasukPer.get(k) || [])[0] || null;
      const bp = (abtPutusPer.get(k) || [])[0] || null;
      const bmin = (abtMinutasiPer.get(k) || [])[0] || null;
      const bakta = (abtAktaPer.get(k) || [])[0] || null;
      const bb = (abtBiayaPer.get(k) || [])[0] || null;
      const sb = (biayaPer.get(k) || [])[0] || null;
      const ec = (ecourtPutusanPer.get(bersih(p.nomorPerkara)) || [])[0] || null;
      const pihak = pihakPer.get(k) || [];
      hasil[k] = {
        perkaraId: k,
        nomorPerkara: bersih(p.nomorPerkara),
        jenisPerkara: bersih(p.jenisPerkara),
        jenisPerkaraId: angkaAtauNull(p.jenisPerkaraId),
        alurPerkaraId: angkaAtauNull(p.alurPerkaraId),
        tanggalPendaftaran: isoTanggal(p.tanggalPendaftaran),
        tahapan: { id: angkaAtauNull(p.tahapanId), teks: bersih(p.tahapanText), proses: bersih(p.prosesText) },
        putusan: pu
          ? {
              tanggal: isoTanggal(pu.tanggal),
              statusId: angkaAtauNull(pu.statusId),
              amarVerstek: Number(pu.amarVerstek) === 1,
              adaAmar: Number(pu.adaAmar) === 1,
              adaBerkas: Number(pu.adaBerkas) === 1,
              tanggalMinutasi: isoTanggal(pu.tanggalMinutasi),
              tanggalBht: isoTanggal(pu.tanggalBht),
              dicabut: Boolean(isoTanggal(pu.tanggalCabut)),
              gugur: Boolean(isoTanggal(pu.tanggalGugur)),
            }
          : null,
        aktaCerai: akta ? { tanggal: isoTanggal(akta.tanggal) } : null,
        sidang: (sidangPer.get(k) || []).map((s) => ({
          id: Number(s.id),
          urutan: angkaAtauNull(s.urutan),
          tanggal: isoTanggal(s.tanggal),
          agenda: bersih(s.agenda),
          dihadiriOleh: angkaAtauNull(s.dihadiriOleh),
          ditunda: bersih(s.ditunda).toUpperCase() === "Y",
          ikrar: bersih(s.ikrar).toUpperCase() === "Y",
          adaBas: Boolean(bersih(s.edocBas)),
        })),
        courtCalendar: (petaCc && petaCc[k]) || [],
        lewatEcourt: Boolean(petaEcourt && petaEcourt[k]),
        hadirLengkapPertama: (petaHadirLengkap && petaHadirLengkap[k]) || "",
        mediasi: (petaMediasi && petaMediasi[k]) || null,
        sidangLaporanMediasi: (petaLaporan && petaLaporan[k]) || "",
        pihak: {
          p: pihak.filter((x) => Number(x.ke) === 1).sort((a, b) => (a.urutan || 0) - (b.urutan || 0)).map((x) => ({ pihakId: Number(x.pihakId) || 0, nama: bersih(x.nama) })),
          t: pihak.filter((x) => Number(x.ke) === 2).sort((a, b) => (a.urutan || 0) - (b.urutan || 0)).map((x) => ({ pihakId: Number(x.pihakId) || 0, nama: bersih(x.nama) })),
        },
        majelis: {
          aktif: (hakimPer.get(k) || []).map((x) => bersih(x.nama)).filter(Boolean),
          ppAktif: (paniteraPer.get(k) || []).map((x) => bersih(x.nama)).filter(Boolean),
          // Tanggal penetapan baris aktif TERBARU: lebih baru dari tanggal teks penetapan = penggantian yang sah, bukan beda.
          tanggalAktif: terbaru((hakimPer.get(k) || []).map((x) => isoTanggal(x.tanggal))),
          tanggalPpAktif: terbaru((paniteraPer.get(k) || []).map((x) => isoTanggal(x.tanggal))),
          penetapan: pen ? { majelis: bersih(pen.majelis), pp: bersih(pen.pp), tanggalMajelis: isoTanggal(pen.tanggalMajelis), tanggalPp: isoTanggal(pen.tanggalPp) } : null,
        },
        biaya: sb ? { masuk: Number(sb.masuk) || 0, keluar: Number(sb.keluar) || 0, baris: Number(sb.baris) || 0 } : { masuk: 0, keluar: 0, baris: 0 },
        abt: {
          terbaca: { masuk: abtMasuk !== null, putus: abtPutus !== null, minutasi: abtMinutasi !== null, akta: abtAkta !== null, biaya: abtBiaya !== null },
          masuk: bm
            ? {
                nomorPerkara: bersih(bm.nomorPerkara),
                tanggalPendaftaran: isoTanggal(bm.tanggalPendaftaran),
                jenisPerkaraId: angkaAtauNull(bm.jenisPerkaraId),
                paraPihak: bersih(bm.paraPihak).slice(0, 12000),
              }
            : null,
          putus: bp ? { tanggal: isoTanggal(bp.tanggal), statusId: angkaAtauNull(bp.statusId) } : null,
          minutasi: bmin ? { tanggal: isoTanggal(bmin.tanggal) } : null,
          aktaCerai: bakta ? { tanggal: isoTanggal(bakta.tanggal) } : null,
          biaya: bb ? { masuk: Number(bb.masuk) || 0, keluar: Number(bb.keluar) || 0, baris: Number(bb.baris) || 0 } : null,
        },
        ecourt: {
          putusan: ec
            ? {
                adaTab: Number(ec.adaTab) === 1,
                adaBaris: Number(ec.adaBaris) === 1,
                alasan: bersih(ec.alasan),
                tanggalTeks: bersih(ec.tanggalTeks),
                dokumenAda: Number(ec.dokumenAda) === 1,
                tte: Number(ec.tte) === 1,
                diperiksaPada: ec.diperiksaPada instanceof Date ? ec.diperiksaPada.toISOString() : bersih(ec.diperiksaPada),
              }
            : null,
        },
        kuasa: {
          sipp: (kuasaSippPer.get(k) || []).map((x) => ({ pihakId: Number(x.pihakId) || 0, nama: bersih(x.nama) })),
          ecourt: (kuasaEcourtPer.get(k) || [])
            .filter((x) => Number(x.pihakId) > 0)
            .map((x) => ({ pihakId: Number(x.pihakId), nama: namaKuasaPer.get(String(x.pihakId)) || "" })),
        },
        ktp: (ktpPer.get(k) || []).map((x) => ({
          pihakId: Number(x.pihakId),
          nik: bersih(x.nik),
          nikSah: Number(x.nikSah) === 1,
          nama: bersih(x.nama),
          nikSipp: nikPer.get(String(x.pihakId)) || "",
        })),
      };
    }

    return {
      ok: true,
      acuan: tanggal,
      fakta: hasil,
      gagal,
      // Sumber yang tidak terbaca: aturan yang bergantung padanya DIAM di portal.
      terbaca: {
        putusan: !gagal.putusan,
        sidang: !gagal.sidang,
        courtCalendar: !gagal["court-calendar"] && !gagal["hadir-lengkap"] && !gagal.mediasi && !gagal["laporan-mediasi"] && !gagal.ecourt,
        pihak: !gagal.pihak,
        majelis: !gagal.majelis && !gagal.panitera && !gagal.penetapan,
        biaya: !gagal.biaya,
        abt: !Object.keys(gagal).some((x) => x.startsWith("abt-")),
        ecourt: !gagal["ecourt-putusan"],
        ktp: !gagal.ktp && !gagal["nik-sipp"],
        kuasa: !gagal["kuasa-sipp"] && !gagal["kuasa-ecourt"],
        aktaCerai: !gagal["akta-cerai"],
      },
    };
  }

  return { daftarLingkup, fakta };
}

let bawaan = null;
function layanan() {
  if (!bawaan) bawaan = buatLayanan();
  return bawaan;
}

module.exports = { buatLayanan, layanan, BATAS_KELOMPOK, KELOMPOK_BAWAAN, isoTanggal };
