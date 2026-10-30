/**
 * Identitas satker untuk blangko ABT - aturan murni (17 Okt 2026, keputusan
 * pengguna butir 3, 4, 7; lihat juga blangko-universal-satker).
 *
 * Blangko Derry mengambil identitas satker dari variabel ABT:
 *   #9270# Pengadilan Tinggi (SIPP sys_config.NamaPT)
 *   #9271# alamat kantor     -> isian satker per KodePN di kueri (cadangan SIPP AlamatPN)
 *   #9272# telepon/WA        -> isian satker per KodePN
 *   #9273# laman             -> isian satker per KodePN
 *   #9274# surel             -> isian satker per KodePN
 *   #9275# baris kontak kop  = gabungan 9272-9274 (tidak disunting)
 *   #8008#/#8010# nama pengadilan, #0150# zona waktu - dari SIPP
 *   #1154# nomor surat bawaan "W20-A11//Hk.05/ /#0191#" - kode surat satker di depan
 *
 * "Isian satker per KodePN" = cabang `WHEN '<KodePN>' THEN '<isi>'` pada
 * `CASE (SELECT TRIM(value) FROM sys_config WHERE name = 'KodePN' LIMIT 1)`.
 * Fungsi di sini MENYUSUN kueri baru dari kueri lama dengan hanya mengganti
 * cabang satker itu; bot menolak kueri yang kerangkanya berbeda
 * (abtPengaturanService.kerangkaSatker - bentuk regex yang sama).
 */

export const ZONA_WAKTU = ["WITA", "WIB", "WIT"] as const;
export type ZonaWaktu = (typeof ZONA_WAKTU)[number];

export type IdentitasSatker = {
  kodeSatker: string;
  namaPengadilan: string;
  pengadilanTinggi: string;
  alamat: string;
  telepon: string;
  laman: string;
  surel: string;
  kodeSurat: string;
  zonaWaktu: string;
};

export const KOLOM_IDENTITAS: Array<{ kunci: keyof IdentitasSatker; label: string; contoh: string; batas: number }> = [
  { kunci: "namaPengadilan", label: "Nama pengadilan", contoh: "Pengadilan Agama Donggala", batas: 120 },
  { kunci: "pengadilanTinggi", label: "Pengadilan Tinggi", contoh: "Pengadilan Tinggi Agama Palu", batas: 120 },
  { kunci: "alamat", label: "Alamat kantor", contoh: "Jalan Vatu Bala Nomor 1 Kecamatan Banawa, Kabupaten Donggala, Sulawesi Tengah 94351", batas: 300 },
  { kunci: "telepon", label: "Telepon/WA", contoh: "082271115021", batas: 60 },
  { kunci: "laman", label: "Laman", contoh: "www.pa-donggala.go.id", batas: 120 },
  { kunci: "surel", label: "Surel", contoh: "pa.donggala@yahoo.co.id", batas: 120 },
  { kunci: "kodeSurat", label: "Kode surat", contoh: "W20-A11", batas: 20 },
  { kunci: "zonaWaktu", label: "Zona waktu", contoh: "WITA", batas: 4 },
];

/** Isian yang diterapkan ke cabang satker kueri ABT. */
export const VARIABEL_SATKER: Record<"alamat" | "telepon" | "laman" | "surel", string> = {
  alamat: "9271",
  telepon: "9272",
  laman: "9273",
  surel: "9274",
};
export const NO_VAR_KODE_SURAT = "1154";

// ---------------------------------------------------------------------------
// Hukum acara perdata per wilayah satker (30 Okt 2026, G6 butir 6.1)
// ---------------------------------------------------------------------------
//
// Satker di luar Jawa dan Madura memakai RBg (Rechtsreglement Buitengewesten,
// S. 1927-227); satker di Jawa dan Madura memakai HIR (Herzien Inlandsch
// Reglement, S. 1941-44). Variabel ABT #11850# (paket hir-rbg-30okt) berbentuk
// isian satker per KodePN:
//   SELECT CASE (SELECT TRIM(value) FROM sys_config WHERE name = 'KodePN' LIMIT 1)
//     WHEN '' THEN 'RBg' ELSE IF(<provinsi #9276# di Jawa/Madura>, 'HIR', 'RBg') END AS data
// Tanpa cabang satker = OTOMATIS dari provinsi satker; cabang WHEN '<KodePN>'
// THEN 'RBg'|'HIR' = ditetapkan Super Admin. Variabel padanan pasal
// (#11851#-#11899#) membaca #11850#. Isiannya disimpan di ABT (satu sumber),
// bukan di ALETA - tidak ada migrasi.

export const NO_VAR_HUKUM_ACARA = "11850";
export const HUKUM_ACARA = ["RBg", "HIR"] as const;
export type HukumAcara = (typeof HUKUM_ACARA)[number];
export type PilihanHukumAcara = "otomatis" | HukumAcara;

/** Kata provinsi yang termasuk Jawa dan Madura - SAMA dengan kueri #11850# (DKI Jakarta, Jawa Barat/Tengah/Timur, DI Yogyakarta, Banten). */
export const KATA_PROVINSI_JAWA_MADURA = ["jawa", "jakarta", "yogyakarta", "banten", "madura"] as const;

/** Hukum acara otomatis dari nama provinsi satker (kosong/tidak dikenal = RBg, seperti kueri). */
export function hukumAcaraDariProvinsi(provinsi: string): HukumAcara {
  const p = String(provinsi ?? "").toLowerCase();
  return KATA_PROVINSI_JAWA_MADURA.some((k) => p.includes(k)) ? "HIR" : "RBg";
}

/** Pilihan yang tersimpan di kueri #11850# untuk satker `kode`: cabang satker = ditetapkan; tanpa cabang = otomatis. */
export function pilihanHukumAcara(sql: string, kode: string): PilihanHukumAcara {
  const c = isiCabangSatker(sql, kode);
  if (!c.ada) return "otomatis";
  return (HUKUM_ACARA as readonly string[]).includes(c.nilai) ? (c.nilai as HukumAcara) : "otomatis";
}

/** Kueri #11850# baru untuk pilihan Super Admin ("otomatis" = cabang satker dibuang). */
export function kueriHukumAcara(sql: string, kode: string, pilihan: string): string {
  if (pilihan !== "otomatis" && !(HUKUM_ACARA as readonly string[]).includes(pilihan)) {
    throw new GalatIdentitasSatker("Hukum acara harus Otomatis, RBg, atau HIR.");
  }
  return gantiCabangSatker(sql, kode, pilihan === "otomatis" ? "" : pilihan);
}

export class GalatIdentitasSatker extends Error {}

const CP1252_TAMBAHAN = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
function latin1Aman(teks: string): boolean {
  for (const h of teks) {
    const k = h.codePointAt(0) ?? 0;
    const aman = (k >= 32 && k <= 126) || (k >= 0xa0 && k <= 0xff) || CP1252_TAMBAHAN.has(h);
    if (!aman) return false;
  }
  return true;
}

/**
 * Isian bersih satu kolom. Ditolak (bukan dibersihkan diam-diam): huruf yang
 * tidak dapat disimpan ABT (latin1), garis miring terbalik, dan '#' (ABT
 * mengganti #NNNN# di dalam kueri).
 */
export function bersihkanIsian(kunci: keyof IdentitasSatker, nilai: unknown): string {
  const kolom = KOLOM_IDENTITAS.find((k) => k.kunci === kunci);
  const teks = String(nilai ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const label = kolom?.label ?? kunci;
  if (kunci === "kodeSatker") {
    if (teks && !/^[A-Za-z]{2,4}\.[A-Za-z0-9]{2,6}$/.test(teks)) throw new GalatIdentitasSatker("Kode satker SIPP berbentuk seperti PA.Dgl.");
    return teks;
  }
  if (kolom && teks.length > kolom.batas) throw new GalatIdentitasSatker(`${label} terlalu panjang (lebih dari ${kolom.batas} huruf).`);
  if (!latin1Aman(teks)) throw new GalatIdentitasSatker(`${label} memuat huruf yang tidak dapat disimpan ABT.`);
  if (/[\\#]/.test(teks)) throw new GalatIdentitasSatker(`${label} tidak boleh memuat tanda # atau garis miring terbalik.`);
  if (kunci === "kodeSurat" && teks && !/^[A-Z]\d{1,3}-[A-Z]\d{1,3}$/i.test(teks)) {
    throw new GalatIdentitasSatker("Kode surat berbentuk seperti W20-A11.");
  }
  if (kunci === "zonaWaktu" && teks && !ZONA_WAKTU.includes(teks.toUpperCase() as ZonaWaktu)) {
    throw new GalatIdentitasSatker("Zona waktu harus WITA, WIB, atau WIT.");
  }
  if (kunci === "surel" && teks && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(teks)) throw new GalatIdentitasSatker("Surel tidak berbentuk alamat surel.");
  if (kunci === "telepon" && teks && !/^[0-9+()\-./ ]{5,60}$/.test(teks)) throw new GalatIdentitasSatker("Telepon/WA hanya angka, spasi, dan + ( ) - . /");
  return kunci === "kodeSurat" || kunci === "zonaWaktu" ? teks.toUpperCase() : teks;
}

export function bersihkanIdentitas(masukan: unknown, dasar: IdentitasSatker): IdentitasSatker {
  const m = (masukan && typeof masukan === "object" ? masukan : {}) as Record<string, unknown>;
  const hasil: IdentitasSatker = { ...dasar };
  for (const k of ["kodeSatker", ...KOLOM_IDENTITAS.map((x) => x.kunci)] as Array<keyof IdentitasSatker>) {
    if (m[k] === undefined) continue;
    hasil[k] = bersihkanIsian(k, m[k]);
  }
  return hasil;
}

export const IDENTITAS_KOSONG: IdentitasSatker = {
  kodeSatker: "",
  namaPengadilan: "",
  pengadilanTinggi: "",
  alamat: "",
  telepon: "",
  laman: "",
  surel: "",
  kodeSurat: "",
  zonaWaktu: "",
};

// ---------------------------------------------------------------------------
// Kueri isian satker
// ---------------------------------------------------------------------------

const KEPALA_CASE = /CASE\s*\(\s*SELECT\s+TRIM\(\s*value\s*\)\s+FROM\s+sys_config\s+WHERE\s+name\s*=\s*'KodePN'\s+LIMIT\s+1\s*\)/i;
const RE_CABANG = /\s*WHEN\s+'((?:[^'\\]|''|\\.)*)'\s+THEN\s+'((?:[^'\\]|''|\\.)*)'/gi;

const keLiteral = (s: string) => `'${s.replace(/'/g, "''")}'`;
const dariLiteral = (s: string) => s.replace(/''/g, "'").replace(/\\(.)/g, "$1");

/** Kerangka kueri tanpa cabang satker - sama dengan abtPengaturanService.kerangkaSatker. */
export function kerangkaSatker(sql: string): string {
  return String(sql || "")
    .replace(RE_CABANG, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function bentukSatker(sql: string): boolean {
  return KEPALA_CASE.test(String(sql || ""));
}

/** Isian cabang `kode` di kueri ("" bila tidak ada cabangnya). */
export function isiCabangSatker(sql: string, kode: string): { ada: boolean; nilai: string } {
  const re = new RegExp(RE_CABANG.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(sql || "")))) {
    if (dariLiteral(m[1]) === kode) return { ada: true, nilai: dariLiteral(m[2]) };
  }
  return { ada: false, nilai: "" };
}

/**
 * Kueri baru: cabang `WHEN '<kode>' THEN '<nilai>'` diganti/ditambah; nilai
 * kosong = cabang dibuang (satker memakai cabang ELSE - data SIPP / kosong).
 * Melempar bila kueri bukan bentuk isian satker.
 */
export function gantiCabangSatker(sql: string, kode: string, nilai: string): string {
  const asal = String(sql || "");
  if (!bentukSatker(asal)) throw new GalatIdentitasSatker("Kueri variabel ini bukan bentuk isian satker (CASE KodePN) - ubah lewat Edit variabel.");
  if (!/^[A-Za-z]{2,4}\.[A-Za-z0-9]{2,6}$/.test(kode)) throw new GalatIdentitasSatker("Kode satker SIPP (KodePN) tidak terbaca.");
  const re = new RegExp(RE_CABANG.source, "gi");
  let hasil = "";
  let pos = 0;
  let diganti = false;
  let m: RegExpExecArray | null;
  while ((m = re.exec(asal))) {
    if (dariLiteral(m[1]) !== kode) continue;
    hasil += asal.slice(pos, m.index);
    if (nilai && !diganti) hasil += ` WHEN ${keLiteral(kode)} THEN ${keLiteral(nilai)}`;
    diganti = true;
    pos = m.index + m[0].length;
  }
  hasil += asal.slice(pos);
  if (!diganti && nilai) {
    const k = KEPALA_CASE.exec(hasil)!;
    const di = k.index + k[0].length;
    hasil = `${hasil.slice(0, di)} WHEN ${keLiteral(kode)} THEN ${keLiteral(nilai)}${hasil.slice(di)}`;
  }
  return hasil;
}

/** Bawaan #1154# dengan kode surat diganti ("W20-A11//Hk.05/ /#0191#" -> "W20-A12//..."). */
export function gantiKodeSurat(bawaan: string, kodeBaru: string): string {
  const s = String(bawaan ?? "");
  const m = /^\s*([A-Za-z]\d{1,3}-[A-Za-z]\d{1,3})(?=\/)/.exec(s);
  if (!m) throw new GalatIdentitasSatker("Isian bawaan nomor surat #1154# tidak diawali kode surat (mis. W20-A11/...) - ubah lewat Isian blangko.");
  if (!/^[A-Z]\d{1,3}-[A-Z]\d{1,3}$/i.test(kodeBaru)) throw new GalatIdentitasSatker("Kode surat berbentuk seperti W20-A11.");
  return s.slice(0, m.index) + s.slice(m.index).replace(m[1], kodeBaru.toUpperCase());
}

export function kodeSuratDari(bawaan: string): string {
  return (/^\s*([A-Za-z]\d{1,3}-[A-Za-z]\d{1,3})(?=\/)/.exec(String(bawaan ?? "")) || [])[1] ?? "";
}

// ---------------------------------------------------------------------------
// Logo
// ---------------------------------------------------------------------------

export const LOGO_MAKS_BYTE = 2 * 1024 * 1024;
/** Sisi terpanjang logo yang disimpan - cukup tajam untuk kop (±2 cm) dan tidak membengkakkan RTF. */
export const LOGO_SISI_MAKS = 600;

/** Kalimat untuk peringatan tanda tangan elektronik di laporan penetapan. */
export const KALIMAT_MODE_TTD: Record<string, string> = {
  tanda_tangan_aleta: "Tanda tangan sah ALETA dibubuhkan; gambar cap/TTD bawaan blangko tidak ikut.",
  kotak_elektronik: "Blangko memakai kotak \"Ditandatangani secara elektronik\" - dipakai apa adanya, gambar TTD tidak ditempel.",
  tanpa: "Tanpa tanda tangan - gambar cap/TTD bawaan blangko tetap tidak ikut.",
};
