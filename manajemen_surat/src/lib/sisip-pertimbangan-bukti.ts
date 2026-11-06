/**
 * ============================================================================
 * SISIP PARAGRAF PERTIMBANGAN ALAT BUKTI KE NASKAH RTF (7 Nov 2026, Fitur 46)
 * ============================================================================
 *
 * Murni (tanpa DOM, tanpa jaringan, tanpa server). Paragraf yang disusun sinkron-pertimbangan-bukti.ts dimasukkan ke naskah RTF cetak di peramban,
 * sebelum naskah ditinjau sisa blangkonya dan diunduh. Blangko sering sudah memuat alinea untuk sebagian bukti, jadi:
 *  - bagian pembuktian = alinea sesudah judul pertimbangan (TENTANG PERTIMBANGAN HUKUM / PERTIMBANGAN HUKUM); daftar bukti di duduk perkara
 *    ("diberi tanda P.n serta diberi tanggal") ada sebelum judul dan tidak dihitung;
 *  - paragraf yang kodenya sudah disebut di pertimbangan (kata utuh, termasuk daftar "P.1 dan P.2" dan rentang "P.1 sampai P.3") tidak disisipkan;
 *  - sisipan ditaruh tepat sebelum penutup alinea penilaian bukti terakhir di bagian pembuktian; berformat sama dengan alinea itu bila sejenis,
 *    dan berformat jenisnya sendiri bila lain ("- Bahwa" = tanda hubung, tab, alinea menggantung; "Menimbang" = baris pertama menjorok), lihat catatan format di bawah;
 *  - ragu, atau hasil tidak lolos pemeriksaan ulang: RTF asli dipulangkan tanpa berubah.
 * Hanya paragraf yang dipilih pemanggil yang masuk (otomatis, ditambah usulan yang dicentang); usulan yang belum disetujui pemilik tidak pernah ke sini.
 */

import { bacaRtfParagraf } from "./deteksi-sisa-blangko";
import type { HasilPertimbangan, ParagrafBukti } from "./sinkron-pertimbangan-bukti";

export type ParagrafSisip = Pick<ParagrafBukti, "kode" | "bunyi">;
export type TidakDisisip = { kode: string; sebab: string };
export type HasilSisip = {
  /** RTF hasil; sama dengan masukan bila tidak ada yang disisipkan. */
  rtf: string;
  /** Satu kode per paragraf yang ditambahkan (kode gabungan seperti "P.1 dan P.2" ditulis apa adanya). */
  disisipkan: string[];
  sudahAda: string[];
  tidakDisisip: TidakDisisip[];
};
export type OpsiSisip = {
  /** RTF yang sama panjang dengan masukan tetapi dengan huruf cp1252 sudah didekode (seperti opsi perbaikiRtf). */
  untukBaca?: string;
};
export type RencanaSisip = { akanMasuk: string[]; sudahAda: string[]; tidakDisisip: TidakDisisip[] };

export const SEBAB_SISIP = {
  tanpaJudul: "judul pertimbangan hukum tidak ditemukan di naskah",
  tanpaBatas: "batas bagian pembuktian tidak terbaca",
  tanpaJangkar: "alinea penilaian alat bukti tidak ditemukan",
  letakPenutup: "letak penutup alinea penilaian bukti tidak terbaca",
  tidakLolos: "hasil sisipan tidak lolos pemeriksaan ulang, naskah dibiarkan",
  bunyiKosong: "bunyi paragraf kosong",
  kataTerlarang: "bunyi memuat kata yang tidak boleh ada di naskah",
  kodeTakTerbaca: "kode bukti tidak terbaca",
} as const;

const JUDUL = /^\s*(?:TENTANG\s+)?PERTIMBANGAN\s+HUKUM\s*\.?\s*$/i;
const MENGADILI = /^\s*MENGADILI\s*:?\s*$/i;
/** Awal pembahasan fakta: alinea "Menimbang" yang menutup bagian pembuktian. */
const FAKTA = /fakta[- ]fakta\s+hukum|fakta\s+hukum|ditemukan\s+fakta|analisis\s+bukti/i;
/** Alinea yang menilai satu bukti: dibuka dengan "Menimbang, bahwa (alat) bukti ..." atau "- Bahwa bukti ...". */
const PENILAIAN = /^\s*[-–—•*]?\s*(?:Menimbang,?\s+)?(?:bahwa\s+)?(?:terhadap\s+|mengenai\s+)?(?:alat\s+)?bukti\b/i;
/**
 * Kode bukti: P.n dan T.n (sisi penggugat/pemohon dan tergugat/termohon) serta kode naskah rekonvensi PK.n, TK.n (konvensi), PR.n, TR.n (rekonvensi).
 * PK.n disamakan dengan P.n dan TK.n dengan T.n; PR.n dan TR.n berdiri sendiri karena sisinya tidak bisa dipastikan dari kodenya.
 */
const SISI_KODE = String.raw`PK|TK|PR|TR|P|T`;
const KODE_DALAM = new RegExp(String.raw`(?<![A-Za-z0-9\-/.])(${SISI_KODE})\.(\d+)(?!\d)`, "g");
/** Pasangan satu bukti berkode ganda ("PK.1/TR.1"); hanya dibaca bila salah satunya kode dua huruf, jadi "P.1/T.1" biasa tidak berubah. */
const PASANGAN = new RegExp(String.raw`(?<![A-Za-z0-9\-/.])(${SISI_KODE})\.(\d+)/(${SISI_KODE})\.(\d+)(?!\d)`, "g");
const RENTANG = new RegExp(
  String.raw`(?<![A-Za-z0-9\-/.])(${SISI_KODE})\.(\d+)(?:/(PK|TK|PR|TR)\.(\d+))?\s*(?:sampai(?:\s+dengan)?|s/d|s\.d\.?|hingga|[-–—])\s*(?:(${SISI_KODE})\.)?(\d+)(?:/(PK|TK|PR|TR)\.(\d+))?(?!\d)`,
  "gi"
);
const KODE_CALON = new RegExp(String.raw`(?<![A-Za-z0-9])(${SISI_KODE})\.(\d+)(?!\d)`, "g");

/** Bentuk baku sisi: PK menjadi P, TK menjadi T, lainnya apa adanya. */
const sisiBaku = (s: string): string => {
  const u = s.toUpperCase();
  return u === "PK" ? "P" : u === "TK" ? "T" : u;
};

const rapi = (x: unknown) => String(x ?? "").replace(/\s+/g, " ").trim();
const kodeDari = (kode: string): string[] => [...kode.matchAll(KODE_CALON)].map((m) => `${sisiBaku(m[1])}.${m[2]}`);

/** Semua kode bukti yang disebut satu alinea, termasuk yang tersirat dalam rentang ("P.1 sampai P.3" menyebut P.1, P.2, P.3). */
export function kodeDisebut(teks: string): Set<string> {
  const hasil = new Set<string>();
  const t = String(teks ?? "").replace(/ /g, " ");
  for (const m of t.matchAll(KODE_DALAM)) hasil.add(`${sisiBaku(m[1])}.${m[2]}`);
  for (const m of t.matchAll(PASANGAN)) {
    if (m[1].length === 2 || m[3].length === 2) {
      hasil.add(`${sisiBaku(m[1])}.${m[2]}`);
      hasil.add(`${sisiBaku(m[3])}.${m[4]}`);
    }
  }
  for (const m of t.matchAll(RENTANG)) {
    const sisi = m[1].toUpperCase();
    if (m[5] && m[5].toUpperCase() !== sisi) continue;
    const a = Number(m[2]);
    const b = Number(m[6]);
    if (b > a && b - a <= 60) {
      for (let n = a; n <= b; n += 1) hasil.add(`${sisiBaku(sisi)}.${n}`);
      // Kode pasangan ("PK.1/TR.1 sampai PK.3/TR.3") ikut bila nomornya sama dengan kode utamanya.
      if (m[3] && m[7] && Number(m[4]) === a && Number(m[8]) === b) for (let n = a; n <= b; n += 1) hasil.add(`${sisiBaku(m[3])}.${n}`);
    }
  }
  return hasil;
}

export type BagianNaskah = {
  /** Indeks alinea judul pertimbangan; -1 bila tidak ada. */
  judul: number;
  /** Indeks pertama sesudah bagian pertimbangan (MENGADILI atau akhir naskah). */
  akhir: number;
  /** Alinea pertama pembahasan fakta; -1 bila tidak ada. */
  batasFakta: number;
  /** Alinea penilaian bukti terakhir sebelum batasFakta; -1 bila tidak ada. */
  jangkar: number;
  /** Kode yang disebut di seluruh bagian pertimbangan. */
  disebut: Set<string>;
};

/** Membaca letak bagian pembuktian dari teks alinea naskah (tanpa RTF). */
export function bacaBagianNaskah(teks: readonly string[]): BagianNaskah {
  const judul = teks.findIndex((t) => JUDUL.test(t));
  const kosong: BagianNaskah = { judul, akhir: teks.length, batasFakta: -1, jangkar: -1, disebut: new Set() };
  if (judul < 0) return kosong;
  let akhir = teks.length;
  for (let i = judul + 1; i < teks.length; i += 1) {
    if (MENGADILI.test(teks[i])) {
      akhir = i;
      break;
    }
  }
  const disebut = new Set<string>();
  for (let i = judul + 1; i < akhir; i += 1) for (const k of kodeDisebut(teks[i])) disebut.add(k);
  let batasFakta = -1;
  for (let i = judul + 1; i < akhir; i += 1) {
    if (/^\s*Menimbang/i.test(teks[i]) && FAKTA.test(teks[i])) {
      batasFakta = i;
      break;
    }
  }
  let jangkar = -1;
  if (batasFakta >= 0) {
    for (let i = batasFakta - 1; i > judul; i -= 1) {
      if (PENILAIAN.test(teks[i]) && kodeDisebut(teks[i]).size > 0) {
        jangkar = i;
        break;
      }
    }
  }
  return { judul, akhir, batasFakta, jangkar, disebut };
}

type Calon = { kode: string; bunyi: string; daftarKode: string[] };

/** Menyaring masukan: bunyi kosong, kata terlarang, kode tak terbaca, dan ganda dibuang atau dicatat. */
function saringCalon(paragraf: ReadonlyArray<ParagrafSisip>): { calon: Calon[]; tidak: TidakDisisip[] } {
  const calon: Calon[] = [];
  const tidak: TidakDisisip[] = [];
  const lihat = new Set<string>();
  for (const p of Array.isArray(paragraf) ? paragraf : []) {
    const kode = rapi(p?.kode);
    const bunyi = rapi(p?.bunyi);
    if (!bunyi) {
      tidak.push({ kode, sebab: SEBAB_SISIP.bunyiKosong });
      continue;
    }
    if (/aleta/i.test(bunyi)) {
      tidak.push({ kode, sebab: SEBAB_SISIP.kataTerlarang });
      continue;
    }
    const daftarKode = kodeDari(kode);
    if (!daftarKode.length) {
      tidak.push({ kode, sebab: SEBAB_SISIP.kodeTakTerbaca });
      continue;
    }
    const kunci = `${kode}|${bunyi}`;
    if (lihat.has(kunci)) continue;
    lihat.add(kunci);
    calon.push({ kode, bunyi, daftarKode });
  }
  // Urut menurut kode: sisi P dahulu, lalu nomor; urutan masukan dipertahankan untuk kode yang sama.
  const urut = (c: Calon) => {
    const [sisi, nomor] = c.daftarKode[0].split(".");
    const urutSisi = sisi === "P" ? 0 : sisi === "PR" ? 2 : sisi === "TR" ? 3 : 1;
    return urutSisi * 100000 + Number(nomor);
  };
  calon.sort((a, b) => urut(a) - urut(b));
  return { calon, tidak };
}

function pilah(bagian: BagianNaskah, calon: Calon[]) {
  const sudahAda: string[] = [];
  const baru: Calon[] = [];
  for (const c of calon) {
    if (c.daftarKode.some((k) => bagian.disebut.has(k))) sudahAda.push(c.kode);
    else baru.push(c);
  }
  return { sudahAda, baru };
}

function sebabBagian(b: BagianNaskah): string | null {
  if (b.judul < 0) return SEBAB_SISIP.tanpaJudul;
  if (b.batasFakta < 0) return SEBAB_SISIP.tanpaBatas;
  if (b.jangkar < 0) return SEBAB_SISIP.tanpaJangkar;
  return null;
}

/** Perkiraan dari teks alinea saja (mis. pratinjau di layar): mana yang akan masuk, sudah ada, atau tidak dapat disisip. Hasil pastinya saat naskah disisipi. */
export function rencanakanSisipan(teksAlinea: readonly string[], paragraf: ReadonlyArray<ParagrafSisip>): RencanaSisip {
  const { calon, tidak } = saringCalon(paragraf);
  const bagian = bacaBagianNaskah(teksAlinea);
  if (bagian.judul < 0) return { akanMasuk: [], sudahAda: [], tidakDisisip: [...tidak, ...calon.map((c) => ({ kode: c.kode, sebab: SEBAB_SISIP.tanpaJudul }))] };
  const { sudahAda, baru } = pilah(bagian, calon);
  const sebab = sebabBagian(bagian);
  if (sebab) return { akanMasuk: [], sudahAda, tidakDisisip: [...tidak, ...baru.map((c) => ({ kode: c.kode, sebab }))] };
  return { akanMasuk: baru.map((c) => c.kode), sudahAda, tidakDisisip: tidak };
}

/** Teks ketikan menjadi teks RTF: ASCII apa adanya; latin1 lewat \'xx, selebihnya lewat \uN? (sama dengan perbaikiRtf). */
export function teksKeRtfSisip(teks: string): string {
  let hasil = "";
  for (const c of String(teks).replace(/\s+/g, " ")) {
    const kode = c.codePointAt(0) ?? 0;
    if (c === "\\" || c === "{" || c === "}") hasil += `\\${c}`;
    else if (kode >= 0x20 && kode < 0x7f) hasil += c;
    else if (kode >= 0xa0 && kode <= 0xff) hasil += `\\'${kode.toString(16).padStart(2, "0")}`;
    else if (kode <= 0xffff) hasil += `\\u${kode > 32767 ? kode - 65536 : kode}?`;
    else {
      const a = c.charCodeAt(0);
      const b = c.charCodeAt(1);
      hasil += `\\u${a - 65536}?\\u${b - 65536}?`;
    }
  }
  return hasil;
}

/** Selisih kurung kurawal RTF yang tidak di-escape (buka dikurangi tutup). 0 = seimbang. */
export function selisihKurungRtf(rtf: string): number {
  let n = 0;
  for (let i = 0; i < rtf.length; i += 1) {
    const c = rtf[i];
    if (c === "\\") i += 1;
    else if (c === "{") n += 1;
    else if (c === "}") n -= 1;
  }
  return n;
}


/* ------------------------------------------------------------------------------------------------------------------------------
 * Format alinea sisipan (7 Nov 2026). Blangko memakai dua bentuk alinea penilaian bukti:
 *  - "Menimbang, bahwa ...": baris pertama menjorok (\fi720), baris berikutnya rata kiri (\li0), tanpa tab;
 *  - "- Bahwa ...": tanda "-", tab, lalu teks; baris pertama \fi-384 dan seluruh alinea \li384 (menggantung, baris berikutnya sejajar teks).
 * Sisipan "- Bahwa" harus berbentuk kedua walau jangkarnya "Menimbang", dan sebaliknya. Perintah paragraf diambil dari alinea sejenis di naskah itu
 * sendiri (yang paling sering dipakai di bagian pertimbangan); bila tidak ada, untuk "- Bahwa" diturunkan dari jangkar. Hanya perintah paragraf
 * yang disalin (bukan huruf), supaya font dan warna tetap mengikuti grup tempat sisipan ditaruh.
 * ---------------------------------------------------------------------------------------------------------------------------- */
type JenisAlinea = "bahwa" | "menimbang" | "lain";
const jenisAlinea = (t: string): JenisAlinea => (/^\s*[-–—•*]\s*Bahwa\b/i.test(t) ? "bahwa" : /^\s*Menimbang\b/i.test(t) ? "menimbang" : "lain");
const PERINTAH_PARAGRAF =
  /^(?:s\d+|q[lrcjd]|fi-?\d+|li-?\d+|ri-?\d+|lin-?\d+|rin-?\d+|sb\d+|sa\d+|sl-?\d+|slmult[01]|sbauto[01]|saauto[01]|widctlpar|nowidctlpar|itap\d+|tx-?\d+|tqr|tqc|tqdec|tldot|tlhyph|tlul|tlth|tleq|keep|keepn|noline|adjustright|faauto|hyphpar[01]?|contextualspace|nowwrap|ls\d+|ilvl\d+|outlinelevel\d+|rtlpar|ltrpar|aspalpha[01]?|aspnum[01]?|nosnaplinegrid)$/;

/** Perintah paragraf satu alinea ("\pard\s50\qj\fi720..."), tanpa perintah huruf. null bila tidak terbaca atau alinea di dalam tabel. */
export function perintahParagraf(baca: string, p: { src?: Array<[number, number, number]> }): string | null {
  const awalTeks = p.src && p.src.length ? p.src[0][0] : -1;
  if (awalTeks < 0) return null;
  const dari = baca.lastIndexOf("\\pard", awalTeks);
  if (dari < 0) return null;
  let akhir = baca.indexOf("{", dari);
  if (akhir < 0 || akhir > awalTeks) akhir = awalTeks;
  const seg = baca.slice(dari + 5, akhir);
  if (/\\intbl(?![a-zA-Z])/.test(seg)) return null;
  const kata = [...seg.matchAll(/\\([a-zA-Z]+-?\d*)/g)].map((m) => m[1]).filter((k) => PERINTAH_PARAGRAF.test(k));
  return kata.length ? `\\pard${kata.map((k) => `\\${k}`).join("")}` : null;
}

/** Nilai paling sering; seri dimenangkan yang paling dekat dengan `titik`. */
function paling<T extends string>(daftar: Array<{ nilai: T; indeks: number }>, titik: number): T | null {
  const hitung = new Map<T, { n: number; dekat: number }>();
  for (const d of daftar) {
    const e = hitung.get(d.nilai) ?? { n: 0, dekat: Infinity };
    e.n += 1;
    e.dekat = Math.min(e.dekat, Math.abs(d.indeks - titik));
    hitung.set(d.nilai, e);
  }
  let terbaik: T | null = null;
  let e0: { n: number; dekat: number } | null = null;
  for (const [nilai, e] of hitung) {
    if (!e0 || e.n > e0.n || (e.n === e0.n && e.dekat < e0.dekat)) {
      terbaik = nilai;
      e0 = e;
    }
  }
  return terbaik;
}

/** Perintah paragraf alinea sejenis di bagian pertimbangan; "- Bahwa" memilih yang menilai bukti lebih dulu. null bila tidak ada. */
function formatSejenis(baca: string, ps: ReadonlyArray<{ teks: string; src?: Array<[number, number, number]> }>, bagian: BagianNaskah, jenis: JenisAlinea): string | null {
  const calon: Array<{ nilai: string; indeks: number }> = [];
  for (let i = bagian.judul + 1; i < bagian.akhir; i += 1) {
    if (jenisAlinea(ps[i].teks) !== jenis) continue;
    const f = perintahParagraf(baca, ps[i]);
    if (f) calon.push({ nilai: f, indeks: i });
  }
  if (jenis === "bahwa") {
    const bukti: Array<{ nilai: string; indeks: number }> = [];
    for (const c of calon) if (PENILAIAN.test(ps[c.indeks].teks)) bukti.push(c);
    if (bukti.length) return paling(bukti, bagian.jangkar);
  }
  return paling(calon, bagian.jangkar);
}

/** Dari perintah jangkar: alinea menggantung 384 twips ("- Bahwa"). Dipakai hanya bila naskah tidak punya alinea "- Bahwa" sendiri. */
function turunkanMenggantung(dariJangkar: string): string {
  let f = dariJangkar;
  for (const [nama, nilai] of [["fi", "-384"], ["li", "384"], ["lin", "384"]] as const) {
    const re = new RegExp(String.raw`\\${nama}-?\d+(?!\d)`);
    f = re.test(f) ? f.replace(re, `\\${nama}${nilai}`) : `${f}\\${nama}${nilai}`;
  }
  return f;
}

/** Awalan "- " bunyi "- Bahwa" menjadi tanda hubung + tab (bentuk blangko); bunyi lain apa adanya. */
function teksSisipan(bunyi: string, jenis: JenisAlinea): string {
  if (jenis === "bahwa") {
    const m = /^([-–—•*])\s+(\S[\s\S]*)$/.exec(bunyi);
    if (m) return `${teksKeRtfSisip(m[1])}\\tab ${teksKeRtfSisip(m[2])}`;
  }
  return teksKeRtfSisip(bunyi);
}

/** Memasukkan paragraf bukti ke RTF (string latin1: satu karakter per bita). Lihat catatan berkas. */
export function sisipkanParagrafBukti(rtfLatin1: string, paragraf: ReadonlyArray<ParagrafSisip>, opsi?: OpsiSisip): HasilSisip {
  const asli = String(rtfLatin1 == null ? "" : rtfLatin1);
  const { calon, tidak } = saringCalon(paragraf);
  const hasil: HasilSisip = { rtf: asli, disisipkan: [], sudahAda: [], tidakDisisip: [...tidak] };
  if (!calon.length) return hasil;
  const semuaTidak = (sebab: string, daftar: Calon[] = calon): HasilSisip => ({
    rtf: asli,
    disisipkan: [],
    sudahAda: hasil.sudahAda,
    tidakDisisip: [...tidak, ...daftar.map((c) => ({ kode: c.kode, sebab }))],
  });
  try {
    const baca = opsi && typeof opsi.untukBaca === "string" && opsi.untukBaca.length === asli.length ? opsi.untukBaca : asli;
    const ps = bacaRtfParagraf(baca, true);
    const bagian = bacaBagianNaskah(ps.map((p) => p.teks));
    if (bagian.judul < 0) return semuaTidak(SEBAB_SISIP.tanpaJudul);
    const { sudahAda, baru } = pilah(bagian, calon);
    hasil.sudahAda = sudahAda;
    if (!baru.length) return { ...hasil, sudahAda };
    const sebab = sebabBagian(bagian);
    if (sebab) return semuaTidak(sebab, baru);

    // Letak sisip: penutup (\par) alinea jangkar, bukan di dalam tabel.
    const jangkar = ps[bagian.jangkar];
    const src = jangkar.src;
    if (!src || !src.length || src.length !== jangkar.teks.length) return semuaTidak(SEBAB_SISIP.letakPenutup, baru);
    const awalTeks = src[0][0];
    const dariPard = baca.lastIndexOf("\\pard", awalTeks);
    if (dariPard >= 0 && /\\intbl(?![a-zA-Z])/.test(baca.slice(dariPard, awalTeks))) return semuaTidak(SEBAB_SISIP.letakPenutup, baru);
    const akhirTeks = Math.max(...src.map((s) => s[1]));
    const penutup = /\\(par|sect|cell|row)(?![a-zA-Z])/g;
    penutup.lastIndex = akhirTeks;
    const m = penutup.exec(baca);
    if (!m || m[1] !== "par") return semuaTidak(SEBAB_SISIP.letakPenutup, baru);
    const pos = m.index;

    // Format tiap sisipan. Sejenis dengan jangkar: mewarisi (tanpa perintah). Lain jenis: perintah paragraf eksplisit dari alinea sejenis di naskah;
    // "- Bahwa" tanpa alinea sejenis diturunkan dari jangkar. Tak ada sumber: mewarisi.
    // Warna jangkar: bila merah (teks blangko yang belum diperiksa), sisipan ditulis hitam (\cf0).
    const cfJangkar = src[src.length - 1][2];
    const jenisJangkar = jenisAlinea(ps[bagian.jangkar].teks);
    const perintahJangkar = perintahParagraf(baca, jangkar);
    const sumberFormat = new Map<JenisAlinea, string | null>();
    const formatUntuk = (jenis: JenisAlinea): string | null => {
      if (jenis === "lain" || jenis === jenisJangkar || !perintahJangkar) return null;
      if (!sumberFormat.has(jenis)) {
        const f = formatSejenis(baca, ps, bagian, jenis) ?? (jenis === "bahwa" ? turunkanMenggantung(perintahJangkar) : null);
        sumberFormat.set(jenis, f === perintahJangkar ? null : f);
      }
      return sumberFormat.get(jenis) ?? null;
    };
    const jenisKartu = baru.map((c) => jenisAlinea(c.bunyi));
    // Perintah hanya ditulis bila berbeda dari yang sedang berlaku (mula-mula milik jangkar), supaya sisipan sejenis jangkar tetap mewarisi.
    let berlaku = perintahJangkar;
    const perintahKartu = jenisKartu.map((j) => {
      const tujuan = formatUntuk(j) ?? perintahJangkar;
      if (!tujuan || tujuan === berlaku) return null;
      berlaku = tujuan;
      return tujuan;
    });
    // Alinea sesudah sisipan memakai perintahnya sendiri bila diawali \pard; bila tidak, perintah jangkar dipulihkan tepat sesudah penutup jangkar.
    const sesudahPenutup = baca.slice(pos + m[0].length, pos + m[0].length + 400);
    const awalBerikut = /^[\s}]*/.exec(sesudahPenutup)?.[0].length ?? 0;
    const berikutPunyaPard = /^[\s}{]*\\pard(?![a-zA-Z])/.test(sesudahPenutup);
    const perluPulih = berlaku !== perintahJangkar && !berikutPunyaPard;
    const pulih = perluPulih && perintahJangkar ? `${perintahJangkar} ` : "";
    const posPulih = pos + m[0].length + awalBerikut;

    const coba = (awalan: string, cfDiharapkan: number): HasilSisip | null => {
      const sisipan = baru.map((c, i) => `\\par ${perintahKartu[i] ? `${perintahKartu[i]} ` : ""}${i === 0 ? awalan : ""}${teksSisipan(c.bunyi, jenisKartu[i])}`).join("");
      const ekor = asli.slice(pos, posPulih) + pulih + asli.slice(posPulih);
      const hasilRtf = asli.slice(0, pos) + sisipan + ekor;
      const hasilBaca = baca.slice(0, pos) + sisipan + baca.slice(pos, posPulih) + pulih + baca.slice(posPulih);
      // Pemeriksaan ulang: gagal satu saja = tidak dipakai.
      if (hasilRtf.length !== asli.length + sisipan.length + pulih.length) return null;
      if (hasilRtf.slice(0, pos) !== asli.slice(0, pos) || hasilRtf.slice(pos + sisipan.length) !== ekor) return null;
      if (selisihKurungRtf(sisipan) !== 0 || selisihKurungRtf(hasilRtf) !== selisihKurungRtf(asli)) return null;
      const ps2 = bacaRtfParagraf(hasilBaca, true);
      const k = baru.length;
      if (ps2.length !== ps.length + k) return null;
      for (let i = 0; i < ps2.length; i += 1) {
        if (i <= bagian.jangkar) {
          if (ps2[i].teks !== ps[i].teks) return null;
        } else if (i <= bagian.jangkar + k) {
          const p = ps2[i];
          if (p.teks !== baru[i - bagian.jangkar - 1].bunyi || p.merah.length) return null;
          if (!p.src || p.src.some((s) => s[2] !== cfDiharapkan)) return null;
        } else if (ps2[i].teks !== ps[i - k].teks) return null;
      }
      return { rtf: hasilRtf, disisipkan: baru.map((c) => c.kode), sudahAda, tidakDisisip: [...tidak] };
    };
    const jadi = coba("", cfJangkar) ?? coba("\\cf0 ", 0);
    return jadi ?? semuaTidak(SEBAB_SISIP.tidakLolos, baru);
  } catch {
    return semuaTidak(SEBAB_SISIP.tidakLolos);
  }
}

/**
 * Paragraf untuk naskah: yang `otomatis` dari hasil penyusun, ditambah usulan yang dicentang. Usulan yang dicentang harus benar-benar anggota
 * hasil.paragraf; `perluDisetujui` (usulan yang belum disetujui pemilik) tidak pernah ikut.
 */
export function paragrafUntukNaskah(hasil: Pick<HasilPertimbangan, "paragraf">, usulanTerpilih: ReadonlyArray<ParagrafBukti> = []): ParagrafBukti[] {
  const anggota = new Set(hasil.paragraf);
  return [...hasil.paragraf.filter((p) => p.cara === "otomatis"), ...usulanTerpilih.filter((p) => p.cara === "usulan" && anggota.has(p))];
}
