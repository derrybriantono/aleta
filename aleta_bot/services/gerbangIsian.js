"use strict";

/**
 * ============================================================================
 * GERBANG OTOMATIS BERDASAR (agen U6, 20 Okt 2026)
 * ============================================================================
 *
 * Satu tempat yang memutuskan apakah usulan sebuah pengisi boleh TERISI SENDIRI (pasti/cukup) atau hanya SARAN "ragu - periksa".
 * Dasarnya hasil ukur ketepatan atas perkara nyata yang dicatat di aleta_bot/config/gerbang-isian.json:
 *
 *     kode -> asal (sipp | posita | berkas) -> { n, banding, cocok, persen, status, pangkatMaks, dasar }
 *
 *   status "otomatis"   : banding >= 20 dan cocok >= 90% terhadap isian petugas/hakim lama; pangkatMaks pasti bila >= 97%
 *   status "terstruktur": nilai terbaca LANGSUNG dari kolom SIPP (tanpa tafsir), contoh >= 15, pembanding < 20; pangkatMaks cukup
 *   status "saran"      : selainnya - tidak pernah terisi sendiri
 *
 * Aturan saat berjalan (terapkan):
 *   - usulan pasti/cukup yang kode+asalnya TIDAK tercatat -> diturunkan menjadi "ragu" (catatan: belum diukur);
 *   - tercatat "saran" -> "ragu";
 *   - tercatat otomatis/terstruktur -> keyakinan dibatasi pangkatMaks (pasti -> cukup bila belum >= 97%);
 *   - dikecualikan: isian petugas sendiri (asal "isian-petugas": bukan dugaan mesin), keyakinan lain (ragu, bentrok, tidak_ada_sumber);
 *   - usulan dibekali `gerbang` {status, n, banding, cocok, persen, diturunkan} dan kalimat ketepatan di `catatan` (ikon i).
 *
 * Uji gerbang-isian-u6.test.ts menjalankan pengisi atas perkara nyata terekam dan GAGAL bila ada pengisi yang menandai pasti/cukup
 * tanpa ukuran di berkas ini.
 */

const fs = require("fs");
const path = require("path");

const BERKAS = path.join(__dirname, "..", "config", "gerbang-isian.json");
const PANGKAT = Object.freeze({ ragu: 1, cukup: 2, pasti: 3 });

let cache = null;
function muat(luar) {
  if (luar) return luar;
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(BERKAS, "utf8"));
  } catch {
    cache = { kode: {} };
  }
  return cache;
}

/** Asal usulan menurut tingkat sumber faktaPerkara: sipp | berkas | posita (peta yang sama dengan skrip ukur). */
function asalDari(u) {
  const FP = require("./faktaPerkara");
  const p = FP.prioUsulan(u);
  return p === FP.PRIO.sipp ? "sipp" : p === FP.PRIO.berkas ? "berkas" : p === FP.PRIO.petugas ? "petugas" : "posita";
}

const dikecualikan = (u) => {
  const asal = String((u && u.sumber && u.sumber[0] && u.sumber[0].asal) || "");
  return asal === "isian-petugas" || /^fakta-setara-petugas/.test(String((u && u.kodePola) || ""));
};

/**
 * Keputusan gerbang untuk satu usulan (tidak mengubah apa pun).
 * @returns {{ keyakinan: string, status: string, diturunkan: boolean, entri: object|null, asal: string }}
 */
function putuskan(u, gerbangLuar) {
  const G = muat(gerbangLuar);
  const y = String((u && u.keyakinan) || "");
  const asal = asalDari(u);
  if (!u || (y !== "pasti" && y !== "cukup") || dikecualikan(u)) return { keyakinan: y, status: "dikecualikan", diturunkan: false, entri: null, asal };
  const kode = String(u.kode || "").padStart(4, "0");
  const entri = ((G.kode || {})[kode] || { asal: {} }).asal[asal] || null;
  if (!entri) return { keyakinan: "ragu", status: "tanpa-ukuran", diturunkan: true, entri: null, asal };
  if (entri.status === "saran") return { keyakinan: "ragu", status: "saran", diturunkan: true, entri, asal };
  const maks = entri.pangkatMaks || "cukup";
  const kini = PANGKAT[y] > PANGKAT[maks] ? maks : y;
  return { keyakinan: kini, status: entri.status, diturunkan: kini !== y, entri, asal };
}

const KALIMAT = {
  "tanpa-ukuran": "Ketepatan pengisi ini belum diukur atas perkara nyata, jadi hanya saran - periksa.",
  saran: (e) => `Ketepatannya baru ${e.persen == null ? "belum terukur" : `${e.persen}%`} (${e.cocok} dari ${e.banding} perkara cocok dengan isian petugas), jadi hanya saran - periksa.`,
  otomatis: (e) => `Terukur ${e.persen}% cocok dengan isian petugas (${e.cocok} dari ${e.banding} perkara).`,
  terstruktur: (e) => `Dibaca langsung dari data SIPP (diuji pada ${e.n} perkara).`,
};

/**
 * Menerapkan gerbang pada daftar usulan (di tempat; mengembalikan daftar yang sama). Aman dipanggil dua kali.
 * @param {Array} usulan
 * @param {{gerbang?: object}} [opsi]
 */
function terapkan(usulan, opsi) {
  const o = opsi || {};
  if (!Array.isArray(usulan) || process.env.ALETA_GERBANG_ISIAN === "mati") return usulan;
  for (const u of usulan) {
    if (!u || typeof u !== "object" || u.gerbang) continue;
    const r = putuskan(u, o.gerbang);
    if (r.status === "dikecualikan") continue;
    const e = r.entri;
    u.gerbang = { status: r.status, asal: r.asal, diturunkan: r.diturunkan, ...(e ? { n: e.n, banding: e.banding, cocok: e.cocok, persen: e.persen } : {}) };
    if (r.diturunkan) u.keyakinanSemula = u.keyakinan;
    u.keyakinan = r.keyakinan;
    const kal = KALIMAT[r.status];
    const teks = typeof kal === "function" ? (e ? kal(e) : "") : kal || "";
    if (teks && !String(u.catatan || "").includes(teks)) u.catatan = [String(u.catatan || "").trim(), teks].filter(Boolean).join(" ");
  }
  return usulan;
}


/**
 * Pemindai statis pengisi: kode 4 angka yang tertulis berdekatan (+-6 baris) dengan keyakinan "pasti"/"cukup" di berkas pengisi
 * (abtIsian*.js, isiOtomatis*.js, isiOtomatisS5/*). Dipakai uji dan pembangun gerbang: setiap kode yang ditemukan harus
 * tercatat di gerbang (kode) atau di `belumTerukur` bersama alasannya. Berkas pengisi BARU otomatis ikut terpindai.
 * @returns {Record<string, string[]>} kode -> lokasi "berkas:baris"
 */
function pindaiPengisi() {
  const dir = __dirname;
  const berkas = [];
  for (const nama of fs.readdirSync(dir)) if (/^(?:abtIsian|isiOtomatis)[A-Za-z0-9]*\.js$/.test(nama)) berkas.push(nama);
  for (const nama of fs.readdirSync(dir, { withFileTypes: true })) {
    if (nama.isDirectory() && /^isiOtomatis/.test(nama.name)) for (const f of fs.readdirSync(path.join(dir, nama.name))) if (/\.js$/.test(f)) berkas.push(`${nama.name}/${f}`);
  }
  const hasil = {};
  for (const b of berkas) {
    const baris = fs.readFileSync(path.join(dir, b), "utf8").split(/\r?\n/);
    baris.forEach((l, i) => {
      if (!/["'`](?:pasti|cukup)["'`]/.test(l)) return;
      for (const m of baris.slice(Math.max(0, i - 6), i + 7).join("\n").matchAll(/["'`](\d{4})["'`]/g)) (hasil[m[1]] = hasil[m[1]] || []).push(`${b}:${i + 1}`);
    });
  }
  return hasil;
}

/** Kode yang tercatat terukur ATAU diakui belum terukur (diperlakukan sebagai saran). */
function kodeTercatat(gerbangLuar) {
  const G = muat(gerbangLuar);
  return new Set([...Object.keys(G.kode || {}), ...Object.keys(G.belumTerukur || {})]);
}

/** Ringkasan entri gerbang untuk dokumen/uji. */
function ringkas(gerbangLuar) {
  const G = muat(gerbangLuar);
  const hasil = { otomatis: 0, terstruktur: 0, saran: 0 };
  for (const e of Object.values(G.kode || {})) for (const a of Object.values(e.asal || {})) hasil[a.status] = (hasil[a.status] || 0) + 1;
  return hasil;
}

module.exports = { terapkan, putuskan, muat, ringkas, asalDari, pindaiPengisi, kodeTercatat, BERKAS, PANGKAT };
