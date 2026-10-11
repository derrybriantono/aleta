/**
 * Kamus deteksi & kalimat - aturan murni (tanpa basis data, tanpa jaringan).
 *
 * Kontrak bersama: aleta_bot/kamus-deteksi/README.md (10 Okt 2026). Dipakai
 * TIGA tempat dengan aturan yang SAMA, supaya pola yang lolos di satu tempat
 * tidak ditolak di tempat lain:
 *
 *   - uji benih umum (src/test/kamus-deteksi-benih.test.ts) atas setiap berkas
 *     aleta_bot/kamus-deteksi/awal/*.json;
 *   - layar Admin "Kamus deteksi & kalimat" saat menyimpan baris database;
 *   - uji pola atas contoh yang diketik admin.
 *
 * Aturan "pasti": HANYA bila ukur membuktikan ketepatan >= 95% atas data nyata
 * (n > 0, salah tangkap dihitung). Hal hukum (huruf alasan, amar) tetap usulan.
 */

export const KELOMPOK_BAKU = [
  "alasan",
  "waktu",
  "pelaku",
  "saksi-identitas",
  "saksi-hubungan",
  "tuntutan",
  "kalimat-saksi",
  "kalimat-hakim",
  "gugatan", // anak & jawab-menjawab dari berkas e-Court (agen 3, P4/B2)
] as const;

export const STATUS_KAMUS = ["aktif", "draf", "nonaktif"] as const;
export type StatusKamus = (typeof STATUS_KAMUS)[number];

export const YAKIN_KAMUS = ["pasti", "ragu"] as const;
export type YakinKamus = (typeof YAKIN_KAMUS)[number];

/** Ambang ketepatan untuk "pasti" (README: >= 95%). */
export const AMBANG_PASTI = 0.95;

/** Bendera regex yang boleh. g/y DITOLAK: membuat .test() berkeadaan (lastIndex). */
const BENDERA_SAH = /^[imsu]*$/;

export type UkurPola = {
  n: number;
  tepat: number;
  salahTangkap: number;
  sumber?: string;
  tanggal?: string;
  /**
   * Rincian ukur lain dari benih (golongan, rincian, cara, kalimat, ...).
   * DIPERTAHANKAN apa adanya: deteksiSaksiService membaca ukur.golongan.
   */
  [rincian: string]: unknown;
};

export type PolaKamus = {
  kode: string;
  kelompok: string;
  label: string;
  kunci: string;
  regex: string;
  flags: string;
  status: StatusKamus;
  yakin: YakinKamus;
  contohBenar: string[];
  contohSalah: string[];
  ukur: UkurPola;
  catatan: string;
  /**
   * Ruas tambahan di luar ruas baku (sebab, jenis, kebalikan, golongan, peran,
   * ...) - dibaca mesin bot, disimpan di kolom `tambahan` (0063). Opsional di
   * tipe agar objek lama tetap sah; rapikanPola selalu mengisinya.
   */
  tambahan?: Record<string, unknown>;
};

export type TemplatKamus = {
  kode: string;
  kelompok: string;
  label: string;
  gaya: string;
  teks: string;
  syarat: Record<string, unknown>;
  status: StatusKamus;
  catatan: string;
  /** Ruas tambahan templat (kodeAbt, asal, bagian, ...) - kolom `tambahan` (0063). */
  tambahan?: Record<string, unknown>;
};

export type BenihKelompok = { kelompok: string; versi?: number; pola: PolaKamus[]; templat: TemplatKamus[] };

function teks(nilai: unknown): string {
  return String(nilai ?? "").trim();
}

function daftarTeks(nilai: unknown): string[] {
  return Array.isArray(nilai) ? nilai.map((x) => String(x ?? "")).filter((x) => x.trim() !== "") : [];
}

function angka(nilai: unknown): number {
  const n = Number(nilai);
  return Number.isFinite(n) ? n : 0;
}

export function statusSah(nilai: unknown, bawaan: StatusKamus = "draf"): StatusKamus {
  const s = teks(nilai);
  return (STATUS_KAMUS as readonly string[]).includes(s) ? (s as StatusKamus) : bawaan;
}

export function yakinSah(nilai: unknown): YakinKamus {
  return teks(nilai) === "pasti" ? "pasti" : "ragu";
}

export function rapikanUkur(nilai: unknown): UkurPola {
  const u = nilai && typeof nilai === "object" && !Array.isArray(nilai) ? (nilai as Record<string, unknown>) : {};
  return {
    ...tanpaKunciBerbahaya(u),
    n: Math.max(0, Math.round(angka(u.n))),
    tepat: Math.max(0, Math.round(angka(u.tepat))),
    salahTangkap: Math.max(0, Math.round(angka(u.salahTangkap))),
    sumber: teks(u.sumber),
    tanggal: teks(u.tanggal),
  };
}

/** Ketepatan = tepat / n; 0 bila belum diukur. */
export function ketepatan(ukur: UkurPola): number {
  return ukur.n > 0 ? ukur.tepat / ukur.n : 0;
}

/* === RUAS-TAMBAHAN 11 Okt === */
/**
 * Ruas baku pola/templat (kolom 0060). Ruas lain pada pola benih - sebab,
 * jenis, kata, cakupan, hanyaDeteksi, ganti, kebalikan, golongan, jk, bentuk,
 * awalan, peran, urut, perbuatan, variabel; templat: kodeAbt, asal, bagian -
 * adalah RUAS TAMBAHAN yang dibaca mesin bot. Sebelum 0063 ruas itu hilang
 * saat pola benih disalin ke database (sunting/nonaktifkan dari layar Admin),
 * dan baris database menimpa benih menurut kode: pola rusak diam-diam.
 */
export const RUAS_BAKU_POLA = ["kode", "kelompok", "label", "kunci", "regex", "flags", "status", "yakin", "contohBenar", "contohSalah", "ukur", "catatan"] as const;
export const RUAS_BAKU_TEMPLAT = ["kode", "kelompok", "label", "gaya", "teks", "syarat", "status", "catatan"] as const;

/** Bukan ruas tambahan: wadahnya sendiri, dan ruas buatan bot (RegExp siap pakai). */
const RUAS_BUKAN_TAMBAHAN = ["tambahan", "re"];
const KUNCI_BERBAHAYA = new Set(["__proto__", "prototype", "constructor"]);
const POLA_NAMA_RUAS = /^[A-Za-z_][A-Za-z0-9_]{0,59}$/;
/** Batas ukuran JSON ruas tambahan satu butir (peta `kebalikan` terbesar ~1,5 KB). */
export const BATAS_TAMBAHAN = 64 * 1024;

function objekPolos(nilai: unknown): nilai is Record<string, unknown> {
  return Boolean(nilai) && typeof nilai === "object" && !Array.isArray(nilai);
}

function tanpaKunciBerbahaya(o: Record<string, unknown>): Record<string, unknown> {
  const hasil: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (!KUNCI_BERBAHAYA.has(k)) hasil[k] = v;
  return hasil;
}

/**
 * Ruas tambahan satu butir: ruas di luar ruas baku pada objek itu sendiri
 * (bentuk benih JSON), lalu isi objek `tambahan` (bentuk badan permintaan /
 * baris database) yang mengalahkannya. Ruas berbahaya dibuang; ruas yang
 * bentrok dengan ruas baku DIBIARKAN di sini supaya periksaTambahan dapat
 * menolaknya dengan pesan - saat digabung ke objek pola, ruas baku menang.
 */
export function ambilTambahan(nilai: unknown, ruasBaku: readonly string[]): Record<string, unknown> {
  if (!objekPolos(nilai)) return {};
  const baku = new Set<string>([...ruasBaku, ...RUAS_BUKAN_TAMBAHAN]);
  const hasil: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(nilai)) if (!baku.has(k) && !KUNCI_BERBAHAYA.has(k) && v !== undefined) hasil[k] = v;
  if (objekPolos(nilai.tambahan)) for (const [k, v] of Object.entries(nilai.tambahan)) if (!KUNCI_BERBAHAYA.has(k) && v !== undefined) hasil[k] = v;
  return hasil;
}

/** Galat ruas tambahan (menolak penyimpanan dari layar Admin). */
export function periksaTambahan(tambahan: Record<string, unknown> | undefined, ruasBaku: readonly string[]): string[] {
  const galat: string[] = [];
  if (!tambahan) return galat;
  const baku = new Set<string>([...ruasBaku, ...RUAS_BUKAN_TAMBAHAN]);
  for (const k of Object.keys(tambahan)) {
    if (baku.has(k)) galat.push(`ruas tambahan "${k}" bentrok dengan ruas baku - sunting di isian ${k} sendiri`);
    else if (!POLA_NAMA_RUAS.test(k)) galat.push(`nama ruas tambahan "${k}" tidak sah (huruf, angka, garis bawah; diawali huruf)`);
  }
  if (JSON.stringify(tambahan).length > BATAS_TAMBAHAN) galat.push(`ruas tambahan melebihi ${BATAS_TAMBAHAN / 1024} KB`);
  return galat;
}

/**
 * Objek butir untuk bot: ruas baku + ruas tambahan, ruas baku SELALU menang
 * (ruas tambahan tidak dapat menimpa kode/kelompok/regex/status). Tanpa ruas
 * tambahan hasilnya sama persis dengan bentuk lama (sidik lapis tidak berubah).
 */
export function gabungTambahan<T extends Record<string, unknown>>(baku: T, tambahan: Record<string, unknown> | undefined): T {
  if (!tambahan) return baku;
  const hasil: Record<string, unknown> = { ...baku };
  for (const [k, v] of Object.entries(tambahan)) if (!(k in baku) && !RUAS_BUKAN_TAMBAHAN.includes(k) && !KUNCI_BERBAHAYA.has(k)) hasil[k] = v;
  return hasil as T;
}
/* === AKHIR RUAS-TAMBAHAN === */

/** Bentuk baku satu pola dari JSON benih / badan permintaan / baris database. */
export function rapikanPola(nilai: unknown, kelompokBawaan = ""): PolaKamus {
  const p = nilai && typeof nilai === "object" ? (nilai as Record<string, unknown>) : {};
  return {
    kode: teks(p.kode),
    kelompok: teks(p.kelompok) || kelompokBawaan,
    label: teks(p.label),
    kunci: teks(p.kunci),
    regex: String(p.regex ?? ""),
    flags: p.flags === undefined || p.flags === null ? "i" : teks(p.flags),
    status: statusSah(p.status, "aktif"),
    yakin: yakinSah(p.yakin),
    contohBenar: daftarTeks(p.contohBenar),
    contohSalah: daftarTeks(p.contohSalah),
    ukur: rapikanUkur(p.ukur),
    catatan: teks(p.catatan),
    tambahan: ambilTambahan(p, RUAS_BAKU_POLA),
  };
}

export function rapikanTemplat(nilai: unknown, kelompokBawaan = ""): TemplatKamus {
  const t = nilai && typeof nilai === "object" ? (nilai as Record<string, unknown>) : {};
  const syarat = t.syarat && typeof t.syarat === "object" && !Array.isArray(t.syarat) ? (t.syarat as Record<string, unknown>) : {};
  return {
    kode: teks(t.kode),
    kelompok: teks(t.kelompok) || kelompokBawaan,
    label: teks(t.label),
    gaya: teks(t.gaya),
    teks: String(t.teks ?? ""),
    syarat,
    status: statusSah(t.status, "aktif"),
    catatan: teks(t.catatan),
    tambahan: ambilTambahan(t, RUAS_BAKU_TEMPLAT),
  };
}

/** Regex siap pakai, atau pesan galatnya. */
export function kompilasiPola(regex: string, flags: string): { ok: true; re: RegExp } | { ok: false; galat: string } {
  if (!regex) return { ok: false, galat: "regex kosong" };
  if (!BENDERA_SAH.test(flags)) return { ok: false, galat: `bendera "${flags}" tidak boleh (hanya i, m, s, u; g/y membuat uji berkeadaan)` };
  try {
    return { ok: true, re: new RegExp(regex, flags) };
  } catch (e) {
    return { ok: false, galat: `regex tidak terkompilasi: ${e instanceof Error ? e.message : String(e)}` };
  }
}

const POLA_KODE = /^[a-z0-9][a-z0-9.-]{1,99}$/;
const POLA_KELOMPOK = /^[a-z0-9][a-z0-9-]{1,39}$/;

/**
 * Pemeriksaan satu pola. `galat` menolak penyimpanan; `peringatan` tidak.
 *
 * Contoh benar/salah yang meleset adalah GALAT bagi pola aktif (benih selalu
 * dianggap aktif kecuali tertulis lain) dan PERINGATAN bagi draf/nonaktif -
 * draf memang tempat menyimpan pola yang belum selesai, termasuk calon dari
 * koreksi petugas (P8) yang contoh salahnya justru kalimat yang masih cocok.
 */
export function periksaPola(p: PolaKamus): { galat: string[]; peringatan: string[] } {
  const galat: string[] = [];
  const peringatan: string[] = [];
  if (!POLA_KODE.test(p.kode)) galat.push(`kode "${p.kode}" tidak sah (huruf kecil, angka, titik, tanda hubung)`);
  if (!POLA_KELOMPOK.test(p.kelompok)) galat.push(`kelompok "${p.kelompok}" tidak sah`);
  const k = kompilasiPola(p.regex, p.flags);
  if (!k.ok) {
    galat.push(k.galat);
    return { galat, peringatan };
  }
  const meleset: string[] = [];
  for (const c of p.contohBenar) if (!k.re.test(c)) meleset.push(`contohBenar tidak cocok: "${c}"`);
  for (const c of p.contohSalah) if (k.re.test(c)) meleset.push(`contohSalah ikut cocok: "${c}"`);
  if (p.status === "aktif") galat.push(...meleset);
  else peringatan.push(...meleset);
  if (p.yakin === "pasti") {
    if (p.ukur.n <= 0) galat.push('"pasti" wajib punya ukur.n > 0 atas data nyata');
    else if (ketepatan(p.ukur) < AMBANG_PASTI)
      galat.push(`"pasti" wajib ketepatan >= 95% (terukur ${(ketepatan(p.ukur) * 100).toFixed(1)}%)`);
    if (p.ukur.tepat > p.ukur.n) galat.push("ukur.tepat melebihi ukur.n");
  }
  if (!p.contohBenar.length) peringatan.push("belum ada contohBenar");
  galat.push(...periksaTambahan(p.tambahan, RUAS_BAKU_POLA));
  return { galat, peringatan };
}

export function periksaTemplat(t: TemplatKamus): { galat: string[]; peringatan: string[] } {
  const galat: string[] = [];
  const peringatan: string[] = [];
  if (!POLA_KODE.test(t.kode)) galat.push(`kode "${t.kode}" tidak sah (huruf kecil, angka, titik, tanda hubung)`);
  if (!POLA_KELOMPOK.test(t.kelompok)) galat.push(`kelompok "${t.kelompok}" tidak sah`);
  if (!t.teks.trim()) galat.push("teks templat kosong");
  const buka = (t.teks.match(/\{/g) || []).length;
  const tutup = (t.teks.match(/\}/g) || []).length;
  if (buka !== tutup) galat.push("kurung kurawal tempat isian tidak seimbang");
  galat.push(...periksaTambahan(t.tambahan, RUAS_BAKU_TEMPLAT));
  return { galat, peringatan };
}

/** Isian {nama} yang dipakai templat. */
export function isianTemplat(teksTemplat: string): string[] {
  return Array.from(new Set(Array.from(teksTemplat.matchAll(/\{([a-zA-Z0-9_.-]+)\}/g)).map((m) => m[1])));
}

/** Pemeriksaan seluruh berkas benih - dipakai uji benih umum. */
export function periksaBerkasBenih(isi: unknown, namaBerkas: string): { galat: string[]; benih: BenihKelompok | null } {
  const galat: string[] = [];
  if (!isi || typeof isi !== "object" || Array.isArray(isi)) return { galat: [`${namaBerkas}: bukan objek JSON`], benih: null };
  const o = isi as Record<string, unknown>;
  const kelompok = teks(o.kelompok) || namaBerkas.replace(/\.json$/, "");
  if (teks(o.kelompok) && teks(o.kelompok) !== namaBerkas.replace(/\.json$/, ""))
    galat.push(`${namaBerkas}: kelompok "${teks(o.kelompok)}" berbeda dengan nama berkas`);
  if (o.pola !== undefined && !Array.isArray(o.pola)) galat.push(`${namaBerkas}: "pola" harus daftar`);
  if (o.templat !== undefined && !Array.isArray(o.templat)) galat.push(`${namaBerkas}: "templat" harus daftar`);
  const pola = (Array.isArray(o.pola) ? o.pola : []).map((p) => rapikanPola(p, kelompok));
  const templat = (Array.isArray(o.templat) ? o.templat : []).map((t) => rapikanTemplat(t, kelompok));
  const kode = new Set<string>();
  for (const p of pola) {
    if (kode.has(p.kode)) galat.push(`${namaBerkas}: kode ganda "${p.kode}"`);
    kode.add(p.kode);
    for (const g of periksaPola(p).galat) galat.push(`${namaBerkas} ${p.kode}: ${g}`);
  }
  for (const t of templat) {
    if (kode.has(t.kode)) galat.push(`${namaBerkas}: kode ganda "${t.kode}"`);
    kode.add(t.kode);
    for (const g of periksaTemplat(t).galat) galat.push(`${namaBerkas} ${t.kode}: ${g}`);
  }
  return { galat, benih: { kelompok, versi: angka(o.versi) || 1, pola, templat } };
}

export type HasilUjiTeks = { teks: string; cocok: boolean; potongan: string };

/** Cuplikan di sekitar kecocokan pertama: ±40 huruf, kecocokan diapit «». */
export function cuplikCocok(re: RegExp, isi: string, lebar = 40): string {
  const m = re.exec(isi);
  if (!m) return "";
  const awal = Math.max(0, m.index - lebar);
  const akhir = Math.min(isi.length, m.index + m[0].length + lebar);
  return `${awal > 0 ? "…" : ""}${isi.slice(awal, m.index)}«${m[0]}»${isi.slice(m.index + m[0].length, akhir)}${akhir < isi.length ? "…" : ""}`
    .replace(/\s+/g, " ")
    .trim();
}

/** Uji pola atas contoh yang diketik admin. */
export function ujiPolaAtasTeks(
  regex: string,
  flags: string,
  daftar: string[]
): { ok: true; hasil: HasilUjiTeks[]; cocok: number } | { ok: false; galat: string } {
  const k = kompilasiPola(regex, flags);
  if (!k.ok) return k;
  const hasil = daftar
    .map((x) => String(x ?? ""))
    .filter((x) => x.trim())
    .slice(0, 200)
    .map((x) => {
      const cocok = k.re.test(x);
      return { teks: x, cocok, potongan: cocok ? cuplikCocok(k.re, x) : "" };
    });
  return { ok: true, hasil, cocok: hasil.filter((h) => h.cocok).length };
}

/**
 * Bentuk baku nilai untuk mengelompokkan koreksi (P8): huruf kecil, spasi
 * dirapatkan, petik diseragamkan, angka menjadi #. Dua nilai akhir yang hanya
 * berbeda tahun/bulan/umur adalah templat yang sama.
 */
export function bentukBakuNilai(nilai: string): string {
  return String(nilai ?? "")
    .toLowerCase()
    .replace(/[’‘`"“”]/g, "'")
    .replace(/\d+/g, "#")
    .replace(/\s+/g, " ")
    .trim();
}

/** Sidik pendek (FNV-1a 32 bit, heksadesimal) - untuk kunci calon, bukan keamanan. */
export function sidikPendek(isi: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < isi.length; i += 1) {
    h ^= isi.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * D3: usulan label atas satu kalimat dari pola aktif kamus deteksi.
 *   kelompok "alasan" -> label_alasan berisi kuncinya (huruf A-K)
 *   kelompok lain     -> label_keadaan berisi "<kelompok>:<kunci>"
 * USULAN saja - yang menetapkan label tetap orang (label_oleh).
 */
export function usulLabelKalimat(
  kalimat: string,
  pola: Array<Pick<PolaKamus, "kode" | "kelompok" | "kunci" | "regex" | "flags" | "status">>
): { labelAlasan: string[]; labelKeadaan: string[]; kodePola: string[] } {
  const alasan = new Set<string>();
  const keadaan = new Set<string>();
  const kode: string[] = [];
  for (const p of pola) {
    if (p.status === "nonaktif" || p.status === "draf") continue;
    const k = kompilasiPola(p.regex, p.flags);
    if (!k.ok || !k.re.test(kalimat)) continue;
    kode.push(p.kode);
    if (p.kelompok === "alasan") {
      if (p.kunci) alasan.add(p.kunci.toUpperCase());
    } else if (!p.kelompok.startsWith("kalimat-")) {
      keadaan.add(p.kunci ? `${p.kelompok}:${p.kunci}` : p.kelompok);
    }
  }
  return { labelAlasan: Array.from(alasan).sort(), labelKeadaan: Array.from(keadaan).sort(), kodePola: kode };
}
