"use strict";

/**
 * ============================================================================
 * 2557 / 2558 - BERAPA KALI SAKSI MELIHAT DAN MENDENGAR PERTENGKARAN (C5 = U9, 25 Okt 2026)
 * ============================================================================
 *
 * Blangko putusan cerai memakai dua isian angka: #2557# (Saksi I) dan #2558# (Saksi II) - "berapa kali melihat dan mendengar
 * pertengkaran (cukup angka saja)". Angkanya tidak ada di posita dan tidak ada di kolom SIPP; ia hanya terucap di keterangan
 * saksi pada BAS (abt_keterangan_saksi), sehingga dahulu SELALU diketik tangan (registri deteksi/cerai.js: "belum").
 *
 * Berkas ini membacanya dari BAS yang SUDAH TERSIMPAN dan mengusulkannya. Hanya mengusulkan:
 *   - saksi I dan II = dua saksi pihak P (Penggugat/Pemohon) menurut urutan SIPP (perkara_pihak5);
 *   - yang dibaca hanya tanya-jawab yang menyebut pertengkaran; angka harus tertulis dalam jawaban ("3 kali", "tiga kali",
 *     "sekali saja"); kata samar ("sering", "beberapa kali", "berkali-kali") TIDAK diubah menjadi angka;
 *   - bila jawaban saksi menyebut angka berbeda pada dua tanya-jawab, yang pertama dipakai dan usulannya "ragu";
 *   - keyakinan paling tinggi "cukup" (pertanyaannya berbunyi "berapa kali"); selain itu "ragu". Gerbang isian
 *     (gerbangIsian.js) menurunkannya lagi menjadi saran sampai ketepatannya terukur di lapangan.
 *
 * Murni (tanpa basis data) kecuali `usulanDariPerkara`, yang HANYA SELECT lewat fungsi yang disuntikkan pemanggil.
 */

const rapat = (t) => String(t == null ? "" : t).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const adaAleta = (t) => /aleta/i.test(String(t == null ? "" : t));

const KATA_ANGKA = Object.freeze({
  satu: 1,
  dua: 2,
  tiga: 3,
  empat: 4,
  lima: 5,
  enam: 6,
  tujuh: 7,
  delapan: 8,
  sembilan: 9,
  sepuluh: 10,
  sebelas: 11,
  "dua belas": 12,
  "tiga belas": 13,
  "empat belas": 14,
  "lima belas": 15,
  "dua puluh": 20,
});
const POLA_KATA = Object.keys(KATA_ANGKA)
  .sort((a, b) => b.length - a.length)
  .join("|");

const POLA_PERTENGKARAN = /\b(?:bertengkar|pertengkaran|cekcok|berselisih|perselisihan|ribut|adu\s+mulut|bertengkar\s+mulut)\b/i;
const POLA_TANYA_BERAPA = /\b(?:berapa\s+kali|seberapa\s+sering|berapa\s+sering|berapa\s+kali\s+saudara)\b/i;
const POLA_SAMAR = /\b(?:berkali[- ]?kali|beberapa\s+kali|sering(?:kali)?|banyak\s+kali|berulang(?:\s+kali)?|terus[- ]?menerus|setiap\s+(?:hari|minggu|bulan)|tiap\s+(?:hari|minggu|bulan)|kerap(?:\s+kali)?)\b/i;

/**
 * Bilangan kali pada satu jawaban.
 * @returns {{n: number, kutipan: string}|{samar: true, kutipan: string}|null}
 */
function bacaKali(jawab) {
  const t = rapat(jawab).toLowerCase();
  if (!t) return null;
  // "3 kali", "3 (tiga) kali", "tiga kali", "tiga (3) kali"
  let m = new RegExp(`\\b(\\d{1,3})\\s*(?:\\([a-z\\s]+\\)\\s*)?kali\\b`, "i").exec(t);
  if (m && Number(m[1]) >= 1) return { n: Number(m[1]), kutipan: t.slice(Math.max(0, m.index - 30), m.index + m[0].length + 10).trim() };
  m = new RegExp(`\\b(${POLA_KATA})\\s*(?:\\(\\d{1,3}\\)\\s*)?kali\\b`, "i").exec(t);
  if (m) return { n: KATA_ANGKA[m[1].replace(/\s+/g, " ")], kutipan: t.slice(Math.max(0, m.index - 30), m.index + m[0].length + 10).trim() };
  // "sekali" hanya bila bermakna satu kali: "sekali saja", "baru sekali", "hanya sekali", "pernah sekali", atau jawaban sangat pendek
  m = /\b(?:hanya|baru|pernah|cuma)\s+sekali\b|\bsekali\s+saja\b|^(?:ya[,.]?\s*)?sekali[.,]?$/i.exec(t);
  if (m) return { n: 1, kutipan: t.slice(Math.max(0, m.index - 30), m.index + m[0].length + 10).trim() };
  const s = POLA_SAMAR.exec(t);
  if (s) return { samar: true, kutipan: t.slice(Math.max(0, s.index - 30), s.index + s[0].length + 10).trim() };
  return null;
}

/** Pertanyaan yang menyangkut pertengkaran (bukan pisah rumah, nafkah, dll.). */
const tanyaPertengkaran = (tanya) => POLA_PERTENGKARAN.test(String(tanya || ""));

/**
 * Angka untuk SATU saksi dari tanya-jawab BAS-nya.
 * @param {{tanyaJawab?: Array<{no?: number, tanya: string, jawab: string}>}} saksi
 * @returns {{nilai: string, n: number, yakin: "cukup"|"ragu", kutipan: string, tanya: string, catatan: string}|null}
 */
function kaliSatuSaksi(saksi) {
  const daftar = [];
  for (const tj of (saksi && saksi.tanyaJawab) || []) {
    if (!tj || adaAleta(tj.jawab) || !tanyaPertengkaran(tj.tanya)) continue;
    const b = bacaKali(tj.jawab);
    if (b && !b.samar) daftar.push({ ...b, tanya: rapat(tj.tanya), berapa: POLA_TANYA_BERAPA.test(String(tj.tanya || "")) });
  }
  if (!daftar.length) return null;
  const pertama = daftar.find((d) => d.berapa) || daftar[0];
  const beda = daftar.filter((d) => d.n !== pertama.n);
  const yakin = pertama.berapa && !beda.length ? "cukup" : "ragu";
  return {
    nilai: String(pertama.n),
    n: pertama.n,
    yakin,
    kutipan: pertama.kutipan,
    tanya: pertama.tanya,
    catatan: beda.length
      ? `Keterangan saksi menyebut angka berbeda (${[pertama.n, ...beda.map((d) => d.n)].join(" dan ")} kali); dipakai yang menjawab pertanyaan "berapa kali" atau yang pertama - periksa BAS.`
      : pertama.berapa
        ? "Dibaca dari jawaban saksi pada BAS atas pertanyaan 'berapa kali'."
        : "Dibaca dari kalimat saksi pada BAS yang menyebut pertengkaran; pertanyaannya tidak menanyakan jumlah secara langsung - periksa.",
  };
}

const KODE_SAKSI = Object.freeze([
  { kode: "2557", urut: 1, nama: "(Saksi I) Berapa Kali Melihat dan Mendengar Pertengkaran" },
  { kode: "2558", urut: 2, nama: "(Saksi II) Berapa Kali Melihat dan Mendengar Pertengkaran" },
]);

/**
 * Usulan untuk kode 2557/2558 dari hasil basPerkara.bacaBas().
 * @param {{saksi?: Array<{pihak?: string, urutan?: number, ke?: number, id?: number, nama?: string, tanyaJawab?: any[]}>}|null} bas
 * @returns {Array<object>} bentuk sama dengan usulan dariSipp ({kode, nama, nilai, keyakinan, sumber, catatan, ...}); kosong bila tak terbaca
 */
function usulanKaliPertengkaran(bas) {
  const hasil = [];
  if (!bas || !Array.isArray(bas.saksi)) return hasil;
  const saksiP = bas.saksi
    .filter((s) => s && s.pihak === "P")
    .sort((a, b) => (a.urutan || 0) - (b.urutan || 0) || (a.id || 0) - (b.id || 0));
  for (const def of KODE_SAKSI) {
    const s = saksiP[def.urut - 1];
    if (!s) continue;
    const k = kaliSatuSaksi(s);
    if (!k) continue;
    hasil.push({
      kode: def.kode,
      nama: def.nama,
      nilai: k.nilai,
      keyakinan: k.yakin,
      bentrok: "",
      sumber: [{ saksi: def.urut, asal: "saksi-bas", kalimat: `${s.nama ? `${s.nama}: ` : ""}"${k.tanya}" - ${k.kutipan}`.slice(0, 300) }],
      catatan: k.catatan,
      dihitung: false,
      jagaIsianLama: true,
      kodePola: "kali-bertengkar-bas",
    });
  }
  return hasil;
}

const bacaBawaan = (db) => (sql, params) =>
  new Promise((resolve, reject) => {
    db().query(sql, params || [], (e, r) => (e ? reject(e) : resolve(r)));
  });

const lewatWaktu = (ms) => new Promise((selesai) => setTimeout(() => selesai(null), ms));

/**
 * Membaca BAS perkara (HANYA SELECT) lalu mengusulkan 2557/2558. Gagal/BAS kosong = [].
 * @param {string} nomorPerkara
 * @param {{runQuery: Function, runAbt: Function, bacaBas?: Function, batasMs?: number}} opsi
 */
async function usulanDariPerkara(nomorPerkara, opsi) {
  const o = { ...(opsi || {}) };
  try {
    // pembaca bawaan: SIPP (db_config) dan ABT (db_config5), keduanya HANYA SELECT
    if (typeof o.runQuery !== "function") o.runQuery = bacaBawaan(() => require("../db_config"));
    if (typeof o.runAbt !== "function") o.runAbt = bacaBawaan(() => require("../db_config5"));
    if (!nomorPerkara) return [];
    const baca = o.bacaBas || require("./basPerkara").bacaBas;
    const kerja = (async () => {
      const baris = await o.runQuery("SELECT perkara_id AS id FROM perkara WHERE nomor_perkara = ? LIMIT 1", [String(nomorPerkara)]);
      const id = Array.isArray(baris) && baris[0] ? Number(baris[0].id) : 0;
      if (!id) return [];
      const bas = await baca(id, o.runAbt, o.runQuery);
      return usulanKaliPertengkaran(bas);
    })();
    return (await Promise.race([kerja, lewatWaktu(o.batasMs || 3000)])) || [];
  } catch {
    return [];
  }
}

module.exports = { bacaKali, kaliSatuSaksi, usulanKaliPertengkaran, usulanDariPerkara, KODE_SAKSI };
