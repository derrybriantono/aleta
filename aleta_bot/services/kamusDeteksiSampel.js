"use strict";

/**
 * UJI POLA ATAS SAMPEL DATA NYATA - layar Admin "Kamus deteksi & kalimat"
 * (10 Okt 2026, P9). BACA-SAJA: hanya SELECT ke SIPP dan ABT (aps_badilag),
 * tidak ada tulisan apa pun. Regex dijalankan DI SINI supaya teks keterangan
 * saksi tidak dikirim utuh ke portal - yang keluar hanya angka dan cuplikan.
 *
 * Sumber (sama dengan masukan PRODUKSI yang dibaca deteksi):
 *   saksi    aps_badilag.abt_keterangan_saksi.jawaban  (jawaban saksi per tanya)
 *   posita   SIPP perkara.posita (HTML dibersihkan)
 *   petitum  SIPP perkara.petitum (HTML dibersihkan)
 *   amar     SIPP perkara_putusan.amar_putusan
 *   isian    aps_badilag.abt_data_teks.data (boleh disaring no_var)
 *
 * Yang diambil = baris TERBARU sebanyak batas (bawaan 2.000, paling banyak
 * 20.000), bukan acak: ORDER BY RAND() atas tabel besar membebani server SIPP.
 */

const BENDERA_SAH = /^[imsu]*$/;
const PANJANG_MAKS = 20000;

const KUERI = {
  saksi: {
    koneksi: "aps_badilag",
    sql: (noVar) =>
      `SELECT k.id AS id, k.perkara_id AS perkara_id, k.jawaban AS teks
         FROM abt_keterangan_saksi k
        WHERE k.jawaban IS NOT NULL AND k.jawaban <> ''
        ORDER BY k.id DESC LIMIT ?`,
  },
  posita: {
    koneksi: "sipp_primary",
    sql: () =>
      `SELECT p.perkara_id AS id, p.nomor_perkara AS nomor, p.posita AS teks
         FROM perkara p
        WHERE p.posita IS NOT NULL AND p.posita <> ''
        ORDER BY p.perkara_id DESC LIMIT ?`,
  },
  petitum: {
    koneksi: "sipp_primary",
    sql: () =>
      `SELECT p.perkara_id AS id, p.nomor_perkara AS nomor, p.petitum AS teks
         FROM perkara p
        WHERE p.petitum IS NOT NULL AND p.petitum <> ''
        ORDER BY p.perkara_id DESC LIMIT ?`,
  },
  amar: {
    koneksi: "sipp_primary",
    sql: () =>
      `SELECT pp.perkara_id AS id, p.nomor_perkara AS nomor, pp.amar_putusan AS teks
         FROM perkara_putusan pp LEFT JOIN perkara p ON p.perkara_id = pp.perkara_id
        WHERE pp.amar_putusan IS NOT NULL AND pp.amar_putusan <> ''
        ORDER BY pp.perkara_id DESC LIMIT ?`,
  },
  isian: {
    koneksi: "aps_badilag",
    sql: (noVar) =>
      `SELECT d.perkara_id AS id, d.no_var AS no_var, d.data AS teks
         FROM abt_data_teks d
        WHERE d.data IS NOT NULL AND d.data <> ''${noVar ? " AND d.no_var = ?" : ""}
        ORDER BY d.modified DESC LIMIT ?`,
  },
};

/** HTML SIPP -> teks polos (tag dibuang, entitas umum diterjemahkan). */
function bersihkan(isi) {
  return String(isi == null ? "" : isi)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+/g, " ")
    .slice(0, PANJANG_MAKS);
}

function cuplik(re, isi, lebar = 60) {
  const m = re.exec(isi);
  if (!m) return isi.slice(0, lebar * 2).replace(/\s+/g, " ").trim();
  const awal = Math.max(0, m.index - lebar);
  const akhir = Math.min(isi.length, m.index + m[0].length + lebar);
  return `${awal > 0 ? "…" : ""}${isi.slice(awal, m.index)}«${m[0]}»${isi.slice(m.index + m[0].length, akhir)}${akhir < isi.length ? "…" : ""}`
    .replace(/\s+/g, " ")
    .trim();
}

function rujukan(sumber, b) {
  if (b.nomor) return String(b.nomor);
  if (sumber === "isian") return `perkara ${b.id} #${b.no_var}#`;
  if (sumber === "saksi") return `perkara ${b.perkara_id} (jawaban ${b.id})`;
  return `perkara ${b.id}`;
}

/**
 * @param {{regex: string, flags?: string, sumber: string, batas?: number, noVar?: string}} masukan
 * @param {{kueri?: (koneksi: string, sql: string, params: unknown[]) => Promise<any[]>}} [alat]
 */
async function ujiSampel(masukan, alat = {}) {
  const regex = String((masukan && masukan.regex) || "");
  const flags = masukan && masukan.flags != null ? String(masukan.flags) : "i";
  const sumber = String((masukan && masukan.sumber) || "");
  if (!regex) return { ok: false, message: "regex kosong" };
  if (!BENDERA_SAH.test(flags)) return { ok: false, message: `bendera "${flags}" tidak boleh` };
  let re;
  try {
    re = new RegExp(regex, flags);
  } catch (galat) {
    return { ok: false, message: `regex tidak terkompilasi: ${galat.message}` };
  }
  const def = KUERI[sumber];
  if (!def) return { ok: false, message: `sumber "${sumber}" tidak dikenal` };
  const batas = Math.max(50, Math.min(Number(masukan.batas) || 2000, 20000));
  const noVar = String((masukan && masukan.noVar) || "").replace(/[^0-9]/g, "").slice(0, 4);
  const kueri = alat.kueri || ((koneksi, sql, params) => require("./externalDbService").query(koneksi, sql, params));

  let baris;
  try {
    const params = sumber === "isian" && noVar ? [noVar, batas] : [batas];
    baris = await kueri(def.koneksi, def.sql(noVar), params);
  } catch (galat) {
    return { ok: false, message: `sampel ${sumber} tidak terbaca: ${String((galat && galat.message) || galat).slice(0, 300)}` };
  }
  const daftar = Array.isArray(baris) ? baris : [];
  let cocok = 0;
  let diperiksa = 0;
  const contoh = [];
  const contohTidak = [];
  for (const b of daftar) {
    const isi = bersihkan(b.teks);
    if (!isi.trim()) continue;
    diperiksa += 1;
    if (re.test(isi)) {
      cocok += 1;
      if (contoh.length < 20) contoh.push({ rujukan: rujukan(sumber, b), cuplikan: cuplik(re, isi) });
    } else if (contohTidak.length < 5) {
      contohTidak.push({ rujukan: rujukan(sumber, b), cuplikan: isi.slice(0, 160).replace(/\s+/g, " ").trim() });
    }
  }
  return { ok: true, sumber, diperiksa, cocok, contoh, contohTidak };
}

module.exports = { ujiSampel, bersihkan, KUERI };
