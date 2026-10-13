"use strict";

/**
 * ============================================================================
 * SAMBUNGAN RUTE /abt/usulan (sumber "posita-lain") KE MODUL DETEKSI AGEN Y
 * ============================================================================
 *
 * Satu fungsi yang dipanggil rute sesudah dariPositaLain + tambahUsulanJenis:
 * usulan modul per jenis (perwalian, asal usul, pengangkatan anak, wali adhol,
 * hadhanah, lain-lain) DIGABUNG ke jawaban yang sudah ada.
 *
 *   - Petitum, nama pihak, dan (bila ekstensi tidak mengirim) posita dibaca
 *     dari SIPP menurut nomor perkara - HANYA SELECT, dibatasi 2,5 detik;
 *     gagal/lambat = jalan terus dengan posita dari ekstensi saja.
 *   - Kode yang sama: usulan modul menggantikan usulan kamus berkeyakinan
 *     "ragu"; usulan lama berkeyakinan "cukup" TIDAK ditimpa bacaan "ragu".
 *   - Kode yang kini diusulkan modul keluar dari `belumSiap`.
 *   - Jenis yang tadinya "tidak dilayani" (369 Lain-Lain) menjadi ok bila
 *     modul menemukan sesuatu.
 *
 * Layanan ini tidak menulis apa pun; penulisan ke ABT tetap oleh ekstensi.
 */

const deteksi = require("./index");

/** Modul milik sambungan ini - itsbat/cerai disambung jalurnya sendiri. */
const KUNCI_Y = new Set(["perwalian", "asal-usul", "pengangkatan-anak", "wali-adhol", "hadhanah", "lain-lain"]);

/** Posita, petitum, jenis, alur, dan nama pihak satu perkara di SIPP (HANYA SELECT). */
async function bacaSipp(nomorPerkara) {
  const nomor = String(nomorPerkara || "").trim();
  if (!nomor) return null;
  let db;
  try {
    db = require("../../db_config");
  } catch (_) {
    return null;
  }
  const kueri = (sql, p) =>
    new Promise((ok, gagal) => {
      db.query(sql, p, (e, r) => (e ? gagal(e) : ok(r)));
    });
  const kerja = (async () => {
    const baris = await kueri(
      "SELECT p.perkara_id, p.posita, p.petitum, p.jenis_perkara_id, p.alur_perkara_id FROM perkara p WHERE p.nomor_perkara = ? LIMIT 1",
      [nomor]
    );
    const r = Array.isArray(baris) && baris[0];
    if (!r) return null;
    const pihak = await kueri("SELECT nama FROM perkara_pihak1 WHERE perkara_id = ? ORDER BY urutan", [r.perkara_id]).catch(() => []);
    return {
      posita: String(r.posita || ""),
      petitum: String(r.petitum || ""),
      jenisPerkara: r.jenis_perkara_id === null || r.jenis_perkara_id === undefined ? "" : String(r.jenis_perkara_id),
      alur: r.alur_perkara_id === null || r.alur_perkara_id === undefined ? "" : String(r.alur_perkara_id),
      namaPihak: (pihak || []).map((x) => String(x.nama || "")).filter(Boolean),
    };
  })().catch(() => null);
  const batas = new Promise((selesai) => setTimeout(() => selesai(null), 2500));
  return Promise.race([kerja, batas]);
}

const PANGKAT = { cukup: 3, pasti: 3, ragu: 1, kosong: 0 };

/**
 * @param {object|null} hasil     jawaban.positaLain sebelum digabung
 * @param {{posita?: string, petitum?: string, nomorPerkara?: string, jenisPerkara?: string, alur?: string,
 *          namaPihak?: string[], bacaSipp?: Function}} masukan
 * @returns {Promise<object>} hasil yang sudah digabung (masukan tidak diubah)
 */
async function lengkapiPositaLain(hasil, masukan = {}) {
  const baca = typeof masukan.bacaSipp === "function" ? masukan.bacaSipp : bacaSipp;
  const sipp = masukan.nomorPerkara ? await baca(masukan.nomorPerkara) : null;
  const angkaJenis = /^\d+$/.test(String(masukan.jenisPerkara || "").trim());
  const jenis = angkaJenis ? String(masukan.jenisPerkara).trim() : (sipp && sipp.jenisPerkara) || String(masukan.jenisPerkara || "");
  const modul = deteksi.modulUntuk(jenis);
  if (!modul || !KUNCI_Y.has(modul.kunci)) return hasil;
  const positaMasuk = String(masukan.posita || "");
  const posita = positaMasuk.replace(/<[^>]*>/g, " ").trim().length >= 50 ? positaMasuk : (sipp && sipp.posita) || positaMasuk;
  const usulan = deteksi.usulanModul(jenis, posita, {
    petitum: masukan.petitum !== undefined ? masukan.petitum : (sipp && sipp.petitum) || "",
    alur: masukan.alur || (sipp && sipp.alur) || "",
    namaPihak: masukan.namaPihak || (sipp && sipp.namaPihak) || [],
  });
  if (!usulan.length) return hasil;

  const lama = hasil && typeof hasil === "object" && hasil.ok !== false ? hasil : null;
  const daftar = lama && Array.isArray(lama.usulan) ? [...lama.usulan] : [];
  for (const u of usulan) {
    const i = daftar.findIndex((x) => x && String(x.kode) === u.kode);
    if (i < 0) daftar.push(u);
    else if ((PANGKAT[u.keyakinan] || 0) >= (PANGKAT[daftar[i].keyakinan] || 0)) daftar[i] = u;
  }
  const kodeBaru = new Set(usulan.map((u) => u.kode));
  const cukup = usulan.filter((u) => u.keyakinan === "cukup").length;
  const catatan =
    `${usulan.length} variabel ${modul.kunci} terbaca dari ${sipp && sipp.petitum ? "posita & petitum SIPP" : "posita"}` +
    (cukup ? `, ${cukup} cukup yakin (tercentang).` : ".") +
    (usulan.length - cukup ? ` ${usulan.length - cukup} masih "ragu" - periksa kalimat sumbernya.` : "");
  return {
    ...(lama || {}),
    ok: true,
    jenis: (lama && lama.jenis) || modul.kunci,
    usulan: daftar,
    belumSiap: ((lama && lama.belumSiap) || []).filter((b) => !kodeBaru.has(String(b.kode))),
    bawaanAbt: (lama && lama.bawaanAbt) || [],
    catatan: [lama && lama.catatan ? lama.catatan : "", catatan].filter(Boolean).join(" "),
    deteksiJenis: { kunci: modul.kunci, jumlah: usulan.length, cukup },
  };
}

module.exports = { lengkapiPositaLain, bacaSipp, KUNCI_Y };
