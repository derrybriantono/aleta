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
 *
 * KEPUTUSAN LAPANGAN (D1, 25 Okt 2026): layar Ketepatan isian di portal mengusulkan isian yang layak terisi sendiri (atau harus
 * turun) dari jejak isian petugas. Hanya yang DISETUJUI Super Admin yang dikirim portal ke sini (POST /internal/aleta-bot/gerbang-isian/sinkron)
 * dan disimpan di data/gerbang-isian-disetujui.json. Kuncinya kode + pengisi (penanda asal yang sama dengan yang dicatat ekstensi) +
 * jenis perkara (id SIPP; kosong = semua jenis):
 *   - disetujui "otomatis" -> usulan pasti/cukup tetap terisi sendiri, paling tinggi "cukup" (bukan "pasti");
 *   - disetujui "saran"    -> usulan pasti/cukup menjadi "ragu - periksa".
 * Tanpa keputusan (saklar portal mati, belum pernah menerima, berkas rusak) fungsi ini berperilaku persis seperti sebelumnya:
 * berkas JSON tetap menjadi bawaan dan cadangan.
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

const BERKAS_DISETUJUI = path.join(__dirname, "..", "data", "gerbang-isian-disetujui.json");
let disetujui = null; // { aktif, versi, entri: { kunci: {status, pangkatMaks, n, presisi} }, diterimaPada }
let disetujuiDimuat = false;
let berkasDisetujui = BERKAS_DISETUJUI;

/** Penanda pendek huruf kecil (sama dengan penandaAsal di jejak-isian.ts dan ekstensi). */
function penanda(x) {
  return String(x == null ? "" : x)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * Pengisi sebuah usulan: PENANDA ASAL yang sama dengan yang dicatat ekstensi ke jejak isian (isi-sipp-bersama.js asalUsulan +
 * penandaAsal). Dijaga uji ketepatan-isian-25okt.test.ts yang menjalankan fungsi ekstensinya dan membandingkan.
 */
function pengisiDari(u) {
  const sumber = Array.isArray(u && u.sumber) ? u.sumber : [];
  const a = sumber[0] ? String(sumber[0].asal == null ? "" : sumber[0].asal).trim() : "";
  let label = "SIPP";
  if (a === "ktp-ecourt") label = "berkas KTP e-Court";
  else if (a === "gugatan-ecourt") label = "surat gugatan e-Court";
  else if (a === "elitigasi") label = "data pihak";
  else if (a === "data-nikah") label = "data pernikahan di SIPP";
  else if (a === "posita-gugatan") label = "posita gugatan";
  else if (a === "bukti-akta") label = "bukti akta nikah";
  else if (sumber.some((x) => x && x.saksi)) label = "keterangan saksi";
  else if (sumber.length && sumber.every((x) => x && x.asal === "posita")) label = "posita";
  return penanda(label);
}

/** Kunci jenis perkara: id tiga angka apa adanya; selainnya nama huruf kecil dengan spasi tunggal; kosong = "". */
function jenisKunci(x) {
  const t = String(x == null ? "" : x).replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (/^alur:/i.test(t)) return t;
  return /^\d{3}$/.test(t) ? t : t.toLowerCase().slice(0, 120);
}

const kunciOverride = (kode, pengisi, jenis) => `${String(kode).padStart(4, "0")}|${pengisi}|${jenis}`;

function bersihkanDisetujui(masuk) {
  if (!masuk || typeof masuk !== "object" || Array.isArray(masuk)) return null;
  const entri = {};
  for (const e of (Array.isArray(masuk.entri) ? masuk.entri : []).slice(0, 2000)) {
    if (!e || typeof e !== "object") continue;
    const kode = String(e.kode || "").replace(/[^0-9A-Za-z_-]/g, "").slice(0, 20);
    const pengisi = penanda(e.pengisi);
    if (!kode || !pengisi || (e.status !== "otomatis" && e.status !== "saran")) continue;
    entri[kunciOverride(kode, pengisi, jenisKunci(e.jenis))] = {
      status: e.status,
      // Kenaikan dari lapangan paling tinggi "cukup": "pasti" hanya dari ukuran luring di berkas JSON.
      pangkatMaks: e.status === "otomatis" ? "cukup" : "ragu",
      n: Math.max(0, Math.round(Number(e.n) || 0)),
      presisi: Math.max(0, Math.min(1, Number(e.presisi) || 0)),
    };
  }
  return { aktif: masuk.aktif === true, versi: String(masuk.versi || "").slice(0, 40), entri };
}

function muatDisetujui() {
  if (disetujuiDimuat) return disetujui;
  disetujuiDimuat = true;
  try {
    const b = bersihkanDisetujui(JSON.parse(fs.readFileSync(berkasDisetujui, "utf8")));
    disetujui = b ? { ...b, diterimaPada: "" } : null;
  } catch {
    disetujui = null;
  }
  return disetujui;
}

/** Terima keputusan dari portal. Muatan aktif:false atau tanpa entri melepas semua keputusan (perilaku lama). */
function terimaDisetujui(masuk) {
  const b = bersihkanDisetujui(masuk);
  if (!b) {
    const galat = new Error("Keputusan gerbang isian tidak sah.");
    galat.ditolak = true;
    throw galat;
  }
  disetujuiDimuat = true;
  disetujui = { ...b, diterimaPada: new Date().toISOString() };
  try {
    const entri = Object.entries(b.entri).map(([k, v]) => {
      const [kode, pengisi, ...j] = k.split("|");
      return { kode, pengisi, jenis: j.join("|"), status: v.status, n: v.n, presisi: v.presisi };
    });
    fs.mkdirSync(path.dirname(berkasDisetujui), { recursive: true });
    fs.writeFileSync(berkasDisetujui, JSON.stringify({ aktif: b.aktif, versi: b.versi, entri }), "utf8");
  } catch {
    /* tidak tersimpan di disk: tetap berlaku di memori */
  }
  return bacaDisetujui();
}

function bacaDisetujui() {
  const d = muatDisetujui();
  return d ? { aktif: d.aktif, versi: d.versi, jumlah: Object.keys(d.entri).length, diterimaPada: d.diterimaPada } : { aktif: false, versi: "", jumlah: 0, diterimaPada: "" };
}

/** Keputusan yang berlaku untuk kode + pengisi + jenis (jenis khusus lebih dulu, lalu semua jenis); null bila tak ada atau tak aktif. */
function keputusanLapangan(kode, pengisi, jenis) {
  const d = muatDisetujui();
  if (!d || !d.aktif) return null;
  const j = jenisKunci(jenis);
  return (j && d.entri[kunciOverride(kode, pengisi, j)]) || d.entri[kunciOverride(kode, pengisi, "")] || null;
}

/** Status bawaan berkas JSON: kode -> asal -> status (untuk layar Ketepatan isian di portal). */
function statusStatik(gerbangLuar) {
  const G = muat(gerbangLuar);
  const hasil = {};
  for (const [kode, e] of Object.entries(G.kode || {})) {
    hasil[kode] = {};
    for (const [asal, a] of Object.entries((e && e.asal) || {})) hasil[kode][asal] = a && a.status;
  }
  return hasil;
}

const dikecualikan = (u) => {
  const asal = String((u && u.sumber && u.sumber[0] && u.sumber[0].asal) || "");
  return asal === "isian-petugas" || /^fakta-setara-petugas/.test(String((u && u.kodePola) || ""));
};

/**
 * Keputusan gerbang untuk satu usulan (tidak mengubah apa pun).
 * @returns {{ keyakinan: string, status: string, diturunkan: boolean, entri: object|null, asal: string }}
 */
function putuskan(u, gerbangLuar, opsi) {
  const G = muat(gerbangLuar);
  const y = String((u && u.keyakinan) || "");
  const asal = asalDari(u);
  if (!u || (y !== "pasti" && y !== "cukup") || dikecualikan(u)) return { keyakinan: y, status: "dikecualikan", diturunkan: false, entri: null, asal };
  const kode = String(u.kode || "").padStart(4, "0");
  // Keputusan Super Admin dari lapangan (D1) didahulukan atas berkas JSON; tanpa keputusan jalur lama berjalan persis.
  const lap = keputusanLapangan(kode, pengisiDari(u), opsi && opsi.jenis);
  if (lap) {
    const entriLap = {
      n: lap.n,
      banding: lap.n,
      cocok: Math.round(lap.n * lap.presisi),
      persen: Math.round(lap.presisi * 1000) / 10,
      status: lap.status === "otomatis" ? "lapangan-otomatis" : "lapangan-saran",
      pangkatMaks: lap.pangkatMaks,
      dasar: "keputusan Super Admin atas ketepatan di lapangan",
    };
    if (lap.status === "saran") return { keyakinan: "ragu", status: "lapangan-saran", diturunkan: true, entri: entriLap, asal };
    const kiniLap = PANGKAT[y] > PANGKAT[lap.pangkatMaks] ? lap.pangkatMaks : y;
    return { keyakinan: kiniLap, status: "lapangan-otomatis", diturunkan: kiniLap !== y, entri: entriLap, asal };
  }
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
  "lapangan-otomatis": (e) => `Di lapangan ${e.persen}% usulan ini bertahan tanpa diubah petugas (${e.n} kejadian); terisi sendiri atas persetujuan Super Admin.`,
  "lapangan-saran": (e) => `Di lapangan ketepatannya turun (${e.persen}% dari ${e.n} kejadian), jadi hanya saran - periksa.`,
};

/**
 * Menerapkan gerbang pada daftar usulan (di tempat; mengembalikan daftar yang sama). Aman dipanggil dua kali.
 * @param {Array} usulan
 * @param {{gerbang?: object, jenis?: string}} [opsi] jenis = id jenis perkara SIPP (keputusan lapangan per jenis)
 */
function terapkan(usulan, opsi) {
  const o = opsi || {};
  if (!Array.isArray(usulan) || process.env.ALETA_GERBANG_ISIAN === "mati") return usulan;
  for (const u of usulan) {
    if (!u || typeof u !== "object" || u.gerbang) continue;
    const r = putuskan(u, o.gerbang, o);
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

/** Hanya untuk uji: berkas keputusan lapangan lain dan keadaan bersih. */
function aturBerkasDisetujuiUji(lokasi) {
  berkasDisetujui = lokasi || BERKAS_DISETUJUI;
  disetujui = null;
  disetujuiDimuat = false;
}

module.exports = {
  terapkan,
  putuskan,
  muat,
  ringkas,
  asalDari,
  pindaiPengisi,
  kodeTercatat,
  BERKAS,
  PANGKAT,
  pengisiDari,
  jenisKunci,
  terimaDisetujui,
  bacaDisetujui,
  keputusanLapangan,
  statusStatik,
  aturBerkasDisetujuiUji,
};
