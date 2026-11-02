"use strict";

/**
 * ============================================================================
 * A2 (1 Nov 2026) - BAHAN PENILAI PEMBUKTIAN: SAKSI & BUKTI TERSIMPAN (HANYA SELECT)
 * ============================================================================
 *
 * Bahan untuk penilai pembuktian portal (manajemen_surat/src/lib/penilai-bukti.ts) bila panel tidak mengirim keterangan saksi
 * yang sedang tersusun (agen A1/A2 di server, perkara yang belum dibuka panelnya):
 *   - keterangan saksi : aps_badilag.abt_keterangan_saksi, SIDANG TERAKHIR per saksi (BAS lanjutan menyalin keterangan yang sama);
 *                        pihak & urutan dari SIPP perkara_pihak5 (saksi_pihak_ke 1 = Penggugat/Pemohon, 2 = Tergugat/Termohon);
 *   - alat bukti       : isian ABT 1214 (P) dan 9911/1262 (T), satu baris per bukti (basPerkara.pecahBukti/uraiBukti), bukti
 *                        elektronik dikenali dari kalimatnya ("bukti elektronik tersebut", tangkapan layar, rekaman).
 *                        2 Nov (agen R, rekomendasi putusan): juga bukti Pemohon permohonan - 0378 (Bukti Surat IN), 9958 (Alat Bukti
 *                        Isbat Nikah Terpadu), 8133 (Alat Bukti Dispen); bukti yang sama (tanda + isi) tidak diulang.
 * Nama saksi TIDAK dikirim (tidak diperlukan penilai; label "Saksi 1 Penggugat"). Tidak ada yang ditulis.
 */

const B = require("./basPerkara");

/** Isian ABT daftar bukti: pihak pertama (Penggugat/Pemohon) dan pihak kedua (Tergugat/Termohon). */
const VAR_BUKTI_P = ["1214", "0378", "9958", "8133"];
const VAR_BUKTI_T = ["9911", "1262"];

const rapat = (t) => String(t == null ? "" : t).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const RE_ELEKTRONIK = /bukti elektronik|tangkapan layar|screenshot|screen shot|rekaman|cetakan percakapan|print ?out percakapan|video/i;

/**
 * @param {string} nomor nomor perkara
 * @param {{runQuery: Function, runAbt: Function|null}} o pembaca SIPP & ABT (baca saja)
 */
async function bahanPembuktian(nomor, o) {
  const runQuery = o && o.runQuery;
  const runAbt = o && o.runAbt;
  if (typeof runQuery !== "function") return { ok: false, alasan: "sipp_tidak_tersedia", saksi: [], bukti: [] };
  const p = ((await runQuery("SELECT perkara_id AS id FROM perkara WHERE nomor_perkara = ? LIMIT 1", [String(nomor || "")])) || [])[0];
  if (!p) return { ok: true, ada: false, perkaraId: null, saksi: [], bukti: [] };
  const id = Number(p.id);
  if (typeof runAbt !== "function") return { ok: true, ada: false, perkaraId: id, saksi: [], bukti: [], catatan: ["ABT tidak terjangkau."] };
  const [jawaban, meta, buktiMentah] = await Promise.all([
    runAbt("SELECT sidang_id, saksi_id, urutan_pertanyaan, pertanyaan, jawaban FROM abt_keterangan_saksi WHERE perkara_id = ? ORDER BY sidang_id, saksi_id, urutan_pertanyaan", [id]).catch(() => []),
    runQuery("SELECT id, saksi_pihak_ke AS ke, urutan, keterangan FROM perkara_pihak5 WHERE perkara_id = ?", [id]).catch(() => []),
    runAbt(`SELECT no_var, data FROM abt_data_teks WHERE perkara_id = ? AND no_var IN (${[...VAR_BUKTI_P, ...VAR_BUKTI_T].map(() => "?").join(", ")})`, [id, ...VAR_BUKTI_P, ...VAR_BUKTI_T]).catch(() => []),
  ]);
  const peta = new Map((meta || []).map((m) => [Number(m.id), m]));
  const akhir = new Map();
  for (const r of jawaban || []) {
    const s = Number(r.saksi_id);
    akhir.set(s, Math.max(akhir.get(s) || 0, Number(r.sidang_id) || 0));
  }
  const saksi = new Map();
  for (const r of jawaban || []) {
    const s = Number(r.saksi_id);
    if ((Number(r.sidang_id) || 0) !== akhir.get(s)) continue;
    const jw = rapat(r.jawaban);
    if (!jw) continue;
    const m = peta.get(s) || {};
    const x = saksi.get(s) || { id: String(s), pihak: Number(m.ke) === 2 ? "T" : Number(m.ke) === 1 ? "P" : "", ke: Number(m.urutan) || 0, hubungan: rapat(m.keterangan).slice(0, 120), baris: [] };
    x.baris.push({ tanya: rapat(r.pertanyaan).slice(0, 600), jawab: jw.slice(0, 2000) });
    saksi.set(s, x);
  }
  const bukti = [];
  const lihat = new Set();
  // 1214 lebih dulu (urutan baris SQL tidak dijamin), lalu isian permohonan, lalu Tergugat/Termohon.
  const urut = [...VAR_BUKTI_P, ...VAR_BUKTI_T];
  const mentah = [...(buktiMentah || [])].sort((a, b) => urut.indexOf(String(Number(a.no_var)).padStart(4, "0")) - urut.indexOf(String(Number(b.no_var)).padStart(4, "0")));
  for (const b of mentah) {
    const sisi = VAR_BUKTI_P.includes(String(Number(b.no_var)).padStart(4, "0")) ? "P" : "T";
    for (const baris of B.pecahBukti(b.data)) {
      const u = B.uraiBukti(baris, sisi);
      if (!u) continue;
      const kunci = `${u.tanda}|${rapat(u.teks).toLowerCase().replace(/[;.,\s]+$/, "").slice(0, 120)}`;
      if (lihat.has(kunci)) continue;
      lihat.add(kunci);
      bukti.push({ kode: u.tanda, pihak: u.sisi === "T" ? "T" : u.sisi === "P" ? "P" : sisi, jenis: RE_ELEKTRONIK.test(u.teks) ? "elektronik" : "surat", teks: u.teks });
    }
  }
  const daftar = [...saksi.values()].sort((a, b) => (a.pihak || "Z").localeCompare(b.pihak || "Z") || a.ke - b.ke);
  return { ok: true, ada: daftar.length > 0 || bukti.length > 0, perkaraId: id, saksi: daftar.slice(0, 20), bukti: bukti.slice(0, 80) };
}

module.exports = { bahanPembuktian, RE_ELEKTRONIK, VAR_BUKTI_P, VAR_BUKTI_T };
