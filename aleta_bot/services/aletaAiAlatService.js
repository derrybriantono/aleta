"use strict";

/**
 * ============================================================================
 * ALETA Ai TAHAP 2a - ALAT DATA BACA-SAJA (23 Okt 2026)
 * ============================================================================
 *
 * Katalog kueri BERPARAMETER yang ditulis dan diuji pengembang - bukan SQL
 * karangan AI (rencana ALETA Ai v2 bagian 4 & 10.2). Portal memanggilnya lewat
 * bridge `ai.alat` {alat, parameter}; yang dikembalikan adalah BARIS (satu per
 * perkara/relaas/sidang) beserta petugasnya, lalu portal yang:
 *   - menyaring "milik" (perkara majelis/PP/JS penanya; pencocok nama yang
 *     sama dengan Unggah massal),
 *   - menghitung rekap dan menyebut cara hitungnya,
 *   - menyamarkan identitas pihak sebelum apa pun dikirim ke layanan AI.
 *
 * Semua kueri SELECT, memakai `query(sql, params)` yang disuntikkan:
 *   - di bot: akun basis data SIPP BACA-SAJA khusus (kunci koneksi registry
 *     ALETA_AI_SIPP_KONEKSI, bawaan "sipp_ai_baca"; lihat sippReadOnlyBridge-
 *     Service `ai.alat`), lewat penjaga assertReadOnlySql;
 *   - di uji: pg-mem dengan data rekaan.
 * Karena itu SQL di sini sengaja sederhana dan dapat dibaca MySQL/MariaDB
 * maupun PostgreSQL: tanpa CAST, tanpa fungsi tanggal - tanggal dikirim
 * sebagai parameter 'YYYY-MM-DD', tanggal nol MariaDB ('0000-00-00') disaring
 * dengan pembanding '1901-01-01'.
 *
 * Aturan retur SATU sumber: returRelaas.js (sqlRetur/relaasRetur).
 */

const { sqlRetur, relaasRetur } = require("./returRelaas");

const BATAS_BARIS = 5000;
const POTONG_IN = 500;
const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
const TANGGAL_SAH_MIN = "1901-01-01";

function teks(v) {
  return v === null || v === undefined ? "" : String(v).trim();
}

function tanggalParam(v, nama) {
  const t = teks(v);
  if (!POLA_TANGGAL.test(t)) throw new Error(`parameter_tanggal_salah:${nama}`);
  return t;
}

/** Tanggal dari basis data -> 'YYYY-MM-DD' (zona lokal, sama dengan localDate bridge); kosong untuk nol/tak sah. */
function iso(v) {
  if (v === null || v === undefined || v === "") return "";
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return "";
    const b = String(v.getMonth() + 1).padStart(2, "0");
    const h = String(v.getDate()).padStart(2, "0");
    return `${v.getFullYear()}-${b}-${h}`;
  }
  const s = String(v).slice(0, 10);
  if (!POLA_TANGGAL.test(s) || s < TANGGAL_SAH_MIN) return "";
  return s;
}

function pilih(baris, nama) {
  for (const n of nama) {
    if (baris && Object.prototype.hasOwnProperty.call(baris, n) && baris[n] !== null && baris[n] !== undefined) return baris[n];
  }
  return null;
}

async function dalamPotongan(query, ids, buatSql) {
  const hasil = [];
  for (let i = 0; i < ids.length; i += POTONG_IN) {
    const potong = ids.slice(i, i + POTONG_IN);
    const isian = potong.map(() => "?").join(", ");
    const rows = await query(buatSql(isian), potong);
    if (Array.isArray(rows)) hasil.push(...rows);
  }
  return hasil;
}

/** Petugas aktif per perkara: majelis (+ ketua), PP, JS. Nama pejabat tidak disamarkan. */
async function petugasUntuk(query, ids) {
  const peta = new Map();
  const unik = [...new Set(ids.map((x) => teks(x)).filter(Boolean))];
  for (const id of unik) peta.set(id, { majelis: [], ketua: "", pp: [], js: [] });
  if (!unik.length) return peta;
  const hakim = await dalamPotongan(
    query,
    unik,
    (isian) => `SELECT perkara_id, hakim_nama AS nama, jabatan_hakim_id AS jabatan FROM perkara_hakim_pn WHERE aktif = 'Y' AND perkara_id IN (${isian})`
  );
  const pp = await dalamPotongan(
    query,
    unik,
    (isian) => `SELECT perkara_id, panitera_nama AS nama FROM perkara_panitera_pn WHERE aktif = 'Y' AND perkara_id IN (${isian})`
  );
  const js = await dalamPotongan(
    query,
    unik,
    (isian) => `SELECT perkara_id, jurusita_nama AS nama FROM perkara_jurusita WHERE aktif = 'Y' AND perkara_id IN (${isian})`
  );
  const urutHakim = [...hakim].sort((a, b) => Number(a.jabatan || 9) - Number(b.jabatan || 9));
  for (const r of urutHakim) {
    const p = peta.get(teks(r.perkara_id));
    const nama = teks(r.nama);
    if (!p || !nama || p.majelis.includes(nama)) continue;
    p.majelis.push(nama);
    if (!p.ketua && Number(r.jabatan) === 1) p.ketua = nama;
  }
  for (const p of peta.values()) if (!p.ketua && p.majelis.length) p.ketua = p.majelis[0];
  for (const [daftar, kunci] of [
    [pp, "pp"],
    [js, "js"],
  ]) {
    for (const r of daftar) {
      const p = peta.get(teks(r.perkara_id));
      const nama = teks(r.nama);
      if (p && nama && !p[kunci].includes(nama)) p[kunci].push(nama);
    }
  }
  return peta;
}

async function denganPetugas(query, baris) {
  const peta = await petugasUntuk(query, baris.map((b) => b.perkaraId));
  return baris.map((b) => ({ ...b, ...(peta.get(b.perkaraId) || { majelis: [], ketua: "", pp: [], js: [] }) }));
}

function batasi(rows) {
  const daftar = Array.isArray(rows) ? rows : [];
  return { rows: daftar.slice(0, BATAS_BARIS), terpotong: daftar.length > BATAS_BARIS };
}

// ─── Rekap lintas perkara ────────────────────────────────────────────────────

/** Relaas bertanggal dalam rentang; retur menurut returRelaas.sqlRetur. */
async function rekapRelaas(query, p) {
  const dari = tanggalParam(p.dari, "dari");
  const sampai = tanggalParam(p.sampai, "sampai");
  const { rows, terpotong } = batasi(
    await query(
      `SELECT r.perkara_id AS perkara_id, pk.nomor_perkara AS nomor, pk.jenis_perkara_nama AS jenis, r.tanggal_relaas AS tanggal,
              CASE WHEN ${sqlRetur("r")} THEN 1 ELSE 0 END AS retur
         FROM perkara_pelaksanaan_relaas r
         JOIN perkara pk ON pk.perkara_id = r.perkara_id
        WHERE r.tanggal_relaas >= ? AND r.tanggal_relaas <= ?
        ORDER BY r.tanggal_relaas, r.perkara_id
        LIMIT ${BATAS_BARIS + 1}`,
      [dari, sampai]
    )
  );
  const baris = rows.map((r) => ({
    perkaraId: teks(r.perkara_id),
    nomor: teks(r.nomor),
    jenis: teks(r.jenis),
    tanggal: iso(r.tanggal),
    retur: Number(r.retur) === 1,
  }));
  return { baris: await denganPetugas(query, baris), terpotong, sumber: "SIPP perkara_pelaksanaan_relaas (tanggal_relaas) disambung perkara" };
}

/** Perkara terdaftar s.d. `per` yang belum bertanggal putusan pada `per` (sisa perkara). */
async function rekapSisa(query, p) {
  const per = tanggalParam(p.per, "per");
  const { rows, terpotong } = batasi(
    await query(
      `SELECT pk.perkara_id AS perkara_id, pk.nomor_perkara AS nomor, pk.jenis_perkara_nama AS jenis, pk.tanggal_pendaftaran AS tanggal_daftar,
              d.tanggal_putusan AS tanggal_putusan
         FROM perkara pk
         LEFT JOIN perkara_putusan d ON d.perkara_id = pk.perkara_id
        WHERE pk.tanggal_pendaftaran <= ?
          AND (d.tanggal_putusan IS NULL OR d.tanggal_putusan > ? OR d.tanggal_putusan < '${TANGGAL_SAH_MIN}')
        ORDER BY pk.tanggal_pendaftaran, pk.perkara_id
        LIMIT ${BATAS_BARIS + 1}`,
      [per, per]
    )
  );
  const baris = rows.map((r) => ({
    perkaraId: teks(r.perkara_id),
    nomor: teks(r.nomor),
    jenis: teks(r.jenis),
    tanggalDaftar: iso(r.tanggal_daftar),
  }));
  return { baris: await denganPetugas(query, baris), terpotong, sumber: "SIPP perkara (tanggal_pendaftaran) disambung perkara_putusan (tanggal_putusan)" };
}

/** Sudah diputus s.d. `per` (sejak `dari`) tetapi tanggal BHT masih kosong pada `per`. */
async function rekapBht(query, p) {
  const dari = tanggalParam(p.dari, "dari");
  const per = tanggalParam(p.per, "per");
  const { rows, terpotong } = batasi(
    await query(
      `SELECT pk.perkara_id AS perkara_id, pk.nomor_perkara AS nomor, pk.jenis_perkara_nama AS jenis,
              d.tanggal_putusan AS tanggal_putusan, d.tanggal_bht AS tanggal_bht
         FROM perkara pk
         JOIN perkara_putusan d ON d.perkara_id = pk.perkara_id
        WHERE d.tanggal_putusan >= ? AND d.tanggal_putusan <= ?
          AND (d.tanggal_bht IS NULL OR d.tanggal_bht < '${TANGGAL_SAH_MIN}' OR d.tanggal_bht > ?)
        ORDER BY d.tanggal_putusan, pk.perkara_id
        LIMIT ${BATAS_BARIS + 1}`,
      [dari, per, per]
    )
  );
  const baris = rows.map((r) => ({
    perkaraId: teks(r.perkara_id),
    nomor: teks(r.nomor),
    jenis: teks(r.jenis),
    tanggalPutusan: iso(r.tanggal_putusan),
  }));
  return { baris: await denganPetugas(query, baris), terpotong, sumber: "SIPP perkara_putusan (tanggal_putusan, tanggal_bht)" };
}

/** Perkara terdaftar dalam rentang beserta majelis/PP/JS-nya (beban penunjukan). */
async function rekapPenunjukan(query, p) {
  const dari = tanggalParam(p.dari, "dari");
  const sampai = tanggalParam(p.sampai, "sampai");
  const { rows, terpotong } = batasi(
    await query(
      `SELECT pk.perkara_id AS perkara_id, pk.nomor_perkara AS nomor, pk.jenis_perkara_nama AS jenis, pk.tanggal_pendaftaran AS tanggal_daftar
         FROM perkara pk
        WHERE pk.tanggal_pendaftaran >= ? AND pk.tanggal_pendaftaran <= ?
        ORDER BY pk.tanggal_pendaftaran, pk.perkara_id
        LIMIT ${BATAS_BARIS + 1}`,
      [dari, sampai]
    )
  );
  const baris = rows.map((r) => ({ perkaraId: teks(r.perkara_id), nomor: teks(r.nomor), jenis: teks(r.jenis), tanggalDaftar: iso(r.tanggal_daftar) }));
  return { baris: await denganPetugas(query, baris), terpotong, sumber: "SIPP perkara (tanggal_pendaftaran) + perkara_hakim_pn/perkara_panitera_pn/perkara_jurusita (aktif)" };
}

/** Sidang terjadwal dalam rentang. */
async function rekapSidang(query, p) {
  const dari = tanggalParam(p.dari, "dari");
  const sampai = tanggalParam(p.sampai, "sampai");
  const { rows, terpotong } = batasi(
    await query(
      `SELECT j.perkara_id AS perkara_id, pk.nomor_perkara AS nomor, pk.jenis_perkara_nama AS jenis, j.tanggal_sidang AS tanggal, j.agenda AS agenda
         FROM perkara_jadwal_sidang j
         JOIN perkara pk ON pk.perkara_id = j.perkara_id
        WHERE j.tanggal_sidang >= ? AND j.tanggal_sidang <= ?
        ORDER BY j.tanggal_sidang, j.perkara_id
        LIMIT ${BATAS_BARIS + 1}`,
      [dari, sampai]
    )
  );
  const baris = rows.map((r) => ({ perkaraId: teks(r.perkara_id), nomor: teks(r.nomor), jenis: teks(r.jenis), tanggal: iso(r.tanggal), agenda: teks(r.agenda) }));
  return { baris: await denganPetugas(query, baris), terpotong, sumber: "SIPP perkara_jadwal_sidang (tanggal_sidang)" };
}

// ─── Satu perkara ────────────────────────────────────────────────────────────

const RUAS_PIHAK = {
  nama: ["nama", "nama_pihak"],
  alamat: ["alamat"],
  nik: ["nomor_indentitas", "nomor_identitas", "nik", "no_ktp"],
  telepon: ["telepon", "no_telp", "hp"],
  email: ["email"],
  tempatLahir: ["tempat_lahir"],
  tanggalLahir: ["tanggal_lahir"],
  jenisKelamin: ["jenis_kelamin"],
  agama: ["agama_nama", "agama"],
  pekerjaan: ["pekerjaan"],
  pendidikan: ["pendidikan_nama", "pendidikan"],
  kecamatan: ["kecamatan_nama", "kecamatan"],
  kabupaten: ["kabupaten_nama", "kabupaten"],
};

function ambilRuas(sumber, peta) {
  const hasil = {};
  for (const [nama, kolom] of Object.entries(peta)) {
    const v = pilih(sumber, kolom);
    hasil[nama] = /^tanggal/.test(nama) ? iso(v) : teks(v);
  }
  return hasil;
}

/**
 * Paket satu perkara (ringkas, petugas, pihak, jadwal, relaas, putusan).
 * Nomor tidak persis -> paling banyak 5 kandidat nomor, tanpa isi.
 * SELECT * dipakai untuk baris tunggal supaya kolom yang berbeda antarversi
 * SIPP tidak menggagalkan kueri; ruas dipilih di sini, sisanya dibuang.
 */
async function paketPerkara(query, p) {
  const nomor = teks(p.nomor);
  if (!nomor) throw new Error("parameter_nomor_kosong");
  let perkara = (await query(`SELECT * FROM perkara WHERE nomor_perkara = ? LIMIT 1`, [nomor]))[0];
  if (!perkara) {
    const kandidat = await query(`SELECT nomor_perkara AS nomor FROM perkara WHERE nomor_perkara LIKE ? ORDER BY perkara_id DESC LIMIT 5`, [`%${nomor}%`]);
    if ((kandidat || []).length === 1) perkara = (await query(`SELECT * FROM perkara WHERE nomor_perkara = ? LIMIT 1`, [teks(kandidat[0].nomor)]))[0];
    else return { ditemukan: false, kandidat: (kandidat || []).map((k) => teks(k.nomor)).filter(Boolean) };
  }
  if (!perkara) return { ditemukan: false, kandidat: [] };
  const id = teks(perkara.perkara_id);
  const petugas = (await petugasUntuk(query, [id])).get(id);

  const pihak = [];
  const idPihak = new Set();
  const relasi = [];
  for (const [tabel, ke] of [
    ["perkara_pihak1", 1],
    ["perkara_pihak2", 2],
  ]) {
    const rows = await query(`SELECT * FROM ${tabel} WHERE perkara_id = ?`, [id]).catch(() => []);
    for (const r of [...(rows || [])].sort((a, b) => (Number(a.urutan) || 0) - (Number(b.urutan) || 0))) {
      relasi.push({ r, ke });
      if (teks(r.pihak_id)) idPihak.add(teks(r.pihak_id));
    }
  }
  const dataPihak = new Map();
  if (idPihak.size) {
    const rows = await dalamPotongan(query, [...idPihak], (isian) => `SELECT * FROM pihak WHERE id IN (${isian})`).catch(() => []);
    for (const r of rows) dataPihak.set(teks(r.id), r);
  }
  for (const { r, ke } of relasi) {
    const gabung = { ...(dataPihak.get(teks(r.pihak_id)) || {}), ...Object.fromEntries(Object.entries(r).filter(([, v]) => v !== null && v !== "")) };
    pihak.push({ pihakKe: ke, urutan: Number(r.urutan) || 0, pihakId: teks(r.pihak_id), ...ambilRuas(gabung, RUAS_PIHAK) });
  }
  const namaPihak = new Map(pihak.map((x) => [x.pihakId, x.nama]));

  const jadwal = ((await query(`SELECT * FROM perkara_jadwal_sidang WHERE perkara_id = ? ORDER BY tanggal_sidang`, [id]).catch(() => [])) || []).map((r) => ({
    urutan: Number(pilih(r, ["urutan"])) || 0,
    tanggal: iso(pilih(r, ["tanggal_sidang"])),
    jam: teks(pilih(r, ["jam_sidang"])),
    agenda: teks(pilih(r, ["agenda"])),
    ditunda: teks(pilih(r, ["ditunda"])),
    alasanDitunda: teks(pilih(r, ["alasan_ditunda"])),
  }));

  const relaas = ((await query(`SELECT * FROM perkara_pelaksanaan_relaas WHERE perkara_id = ? ORDER BY tanggal_relaas`, [id]).catch(() => [])) || []).map((r) => ({
    tanggal: iso(pilih(r, ["tanggal_relaas"])),
    untuk: namaPihak.get(teks(r.pihak_id)) || "",
    cara: teks(pilih(r, ["ket_temu"])),
    hasil: teks(pilih(r, ["ket_hasil_relaas"])),
    retur: relaasRetur(pilih(r, ["status_pos"]), pilih(r, ["ket_hasil_relaas"]), pilih(r, ["ket_temu"]), pilih(r, ["no_resi_pos"])),
  }));

  const putusanBaris = ((await query(`SELECT * FROM perkara_putusan WHERE perkara_id = ? LIMIT 1`, [id]).catch(() => [])) || [])[0];
  const putusan = putusanBaris
    ? {
        tanggalPutusan: iso(pilih(putusanBaris, ["tanggal_putusan"])),
        status: teks(pilih(putusanBaris, ["status_putusan_nama", "status_putusan_text"])),
        tanggalMinutasi: iso(pilih(putusanBaris, ["tanggal_minutasi"])),
        tanggalBht: iso(pilih(putusanBaris, ["tanggal_bht"])),
        amar: teks(pilih(putusanBaris, ["amar_putusan"])).slice(0, 4000),
      }
    : null;

  return {
    ditemukan: true,
    perkara: {
      perkaraId: id,
      nomor: teks(perkara.nomor_perkara),
      jenis: teks(pilih(perkara, ["jenis_perkara_nama", "jenis_perkara_text"])),
      jenisPerkaraId: teks(perkara.jenis_perkara_id),
      alurPerkaraId: teks(perkara.alur_perkara_id),
      tanggalDaftar: iso(pilih(perkara, ["tanggal_pendaftaran"])),
      tahapan: teks(pilih(perkara, ["tahapan_terakhir_text"])),
      proses: teks(pilih(perkara, ["proses_terakhir_text"])),
    },
    petugas: petugas || { majelis: [], ketua: "", pp: [], js: [] },
    pihak,
    jadwal,
    relaas,
    putusan,
  };
}

// ─── Keuangan perkara (kasir/panjar) - 23 Okt 2026 ───────────────────────────

/** Tahapan jurnal keuangan tingkat pertama - sama dengan kasirJurnalService (TAHAPAN = 10). */
const TAHAPAN_KEUANGAN = 10;

/** Saldo panjar (Σ jenis_transaksi × jumlah) per perkara, rumus yang sama dengan kasirJurnalService. */
async function saldoPerkara(query, ids) {
  const peta = new Map();
  const rows = await dalamPotongan(
    query,
    ids,
    (isian) =>
      `SELECT perkara_id, SUM(jenis_transaksi * jumlah) AS saldo FROM perkara_biaya WHERE tahapan_id = ${TAHAPAN_KEUANGAN} AND perkara_id IN (${isian}) GROUP BY perkara_id`
  );
  for (const r of rows) peta.set(teks(r.perkara_id), Math.round(Number(r.saldo) || 0));
  return peta;
}

/** Perkara yang bertransaksi dalam rentang: uang masuk/keluar dalam rentang + sisa panjar sekarang. */
async function rekapKeuangan(query, p) {
  const dari = tanggalParam(p.dari, "dari");
  const sampai = tanggalParam(p.sampai, "sampai");
  const { rows, terpotong } = batasi(
    await query(
      `SELECT pb.perkara_id AS perkara_id, pk.nomor_perkara AS nomor, pk.jenis_perkara_nama AS jenis,
              SUM(CASE WHEN pb.jenis_transaksi = 1 THEN pb.jumlah ELSE 0 END) AS masuk,
              SUM(CASE WHEN pb.jenis_transaksi = -1 THEN pb.jumlah ELSE 0 END) AS keluar
         FROM perkara_biaya pb
         JOIN perkara pk ON pk.perkara_id = pb.perkara_id
        WHERE pb.tahapan_id = ${TAHAPAN_KEUANGAN} AND pb.tanggal_transaksi >= ? AND pb.tanggal_transaksi <= ?
        GROUP BY pb.perkara_id, pk.nomor_perkara, pk.jenis_perkara_nama
        ORDER BY pb.perkara_id
        LIMIT ${BATAS_BARIS + 1}`,
      [dari, sampai]
    )
  );
  const saldo = await saldoPerkara(query, rows.map((r) => teks(r.perkara_id)));
  const baris = rows.map((r) => ({
    perkaraId: teks(r.perkara_id),
    nomor: teks(r.nomor),
    jenis: teks(r.jenis),
    masuk: Math.round(Number(r.masuk) || 0),
    keluar: Math.round(Number(r.keluar) || 0),
    sisa: saldo.get(teks(r.perkara_id)) ?? 0,
  }));
  return { baris: await denganPetugas(query, baris), terpotong, sumber: "SIPP perkara_biaya (tahapan tingkat pertama, tanggal_transaksi; sisa = Σ jenis_transaksi × jumlah)" };
}

/** Jurnal keuangan satu perkara. Nama pihak penyetor dibaca dari tabel pihak (disamarkan portal). */
async function keuanganPerkara(query, p) {
  const nomor = teks(p.nomor);
  if (!nomor) throw new Error("parameter_nomor_kosong");
  const perkara = (await query(`SELECT * FROM perkara WHERE nomor_perkara = ? LIMIT 1`, [nomor]))[0];
  if (!perkara) return { ditemukan: false, kandidat: [] };
  const id = teks(perkara.perkara_id);
  const petugas = (await petugasUntuk(query, [id])).get(id);
  const rows =
    (await query(
      `SELECT pb.tanggal_transaksi AS tanggal, pb.uraian AS uraian, pb.jenis_transaksi AS arah, pb.jumlah AS jumlah, ph.nama AS nama
         FROM perkara_biaya pb LEFT JOIN pihak ph ON ph.id = pb.pihak_id
        WHERE pb.perkara_id = ? AND pb.tahapan_id = ${TAHAPAN_KEUANGAN}
        ORDER BY pb.tanggal_transaksi, pb.id`,
      [id]
    )) || [];
  const transaksi = rows.map((r) => ({
    tanggal: iso(r.tanggal),
    uraian: teks(r.uraian),
    arah: Number(r.arah) === -1 ? "keluar" : "masuk",
    jumlah: Math.round(Number(r.jumlah) || 0),
    nama: teks(r.nama),
  }));
  return {
    ditemukan: true,
    perkara: { perkaraId: id, nomor: teks(perkara.nomor_perkara), jenis: teks(pilih(perkara, ["jenis_perkara_nama", "jenis_perkara_text"])) },
    petugas: petugas || { majelis: [], ketua: "", pp: [], js: [] },
    transaksi,
  };
}

const KATALOG = {
  "rekap.relaas": rekapRelaas,
  "rekap.sisa": rekapSisa,
  "rekap.bht": rekapBht,
  "rekap.penunjukan": rekapPenunjukan,
  "rekap.sidang": rekapSidang,
  "perkara.paket": paketPerkara,
  "rekap.keuangan": rekapKeuangan,
  "keuangan.perkara": keuanganPerkara,
};

/** Menjalankan satu alat katalog. Nama di luar katalog DITOLAK - tidak ada SQL bebas. */
async function jalankan(alat, parameter, { query }) {
  const fungsi = KATALOG[teks(alat)];
  if (!fungsi) throw new Error(`alat_tidak_dikenal:${teks(alat)}`);
  if (typeof query !== "function") throw new Error("kueri_tidak_tersedia");
  return fungsi(query, parameter && typeof parameter === "object" ? parameter : {});
}

module.exports = { jalankan, KATALOG: Object.freeze(Object.keys(KATALOG)), iso, petugasUntuk };
