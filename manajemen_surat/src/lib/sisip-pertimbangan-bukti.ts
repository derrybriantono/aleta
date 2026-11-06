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
 *  - sisipan ditaruh tepat sebelum penutup alinea penilaian bukti terakhir di bagian pembuktian, berformat sama dengan alinea itu;
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
const KODE_DALAM = /(?<![A-Za-z0-9\-/.])([PT])\.(\d+)(?!\d)/g;
const RENTANG = /(?<![A-Za-z0-9\-/.])([PT])\.(\d+)\s*(?:sampai(?:\s+dengan)?|s\/d|s\.d\.?|hingga|[-–—])\s*(?:([PT])\.)?(\d+)(?!\d)/gi;

const rapi = (x: unknown) => String(x ?? "").replace(/\s+/g, " ").trim();
const kodeDari = (kode: string): string[] => [...kode.matchAll(/(?<![A-Za-z0-9])([PT])\.(\d+)(?!\d)/g)].map((m) => `${m[1]}.${m[2]}`);

/** Semua kode bukti yang disebut satu alinea, termasuk yang tersirat dalam rentang ("P.1 sampai P.3" menyebut P.1, P.2, P.3). */
export function kodeDisebut(teks: string): Set<string> {
  const hasil = new Set<string>();
  const t = String(teks ?? "").replace(/ /g, " ");
  for (const m of t.matchAll(KODE_DALAM)) hasil.add(`${m[1].toUpperCase()}.${m[2]}`);
  for (const m of t.matchAll(RENTANG)) {
    const sisi = m[1].toUpperCase();
    if (m[3] && m[3].toUpperCase() !== sisi) continue;
    const a = Number(m[2]);
    const b = Number(m[4]);
    if (b > a && b - a <= 60) for (let n = a; n <= b; n += 1) hasil.add(`${sisi}.${n}`);
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
    return (sisi === "P" ? 0 : 1) * 100000 + Number(nomor);
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

    // Percobaan pertama: format persis jangkar. Bila jangkar berwarna merah (teks blangko yang belum diperiksa), sisipan ditulis hitam (\cf0).
    const cfJangkar = src[src.length - 1][2];
    const coba = (awalan: string, cfDiharapkan: number): HasilSisip | null => {
      const sisipan = baru.map((c, i) => `\\par ${i === 0 ? awalan : ""}${teksKeRtfSisip(c.bunyi)}`).join("");
      const hasilRtf = asli.slice(0, pos) + sisipan + asli.slice(pos);
      const hasilBaca = baca.slice(0, pos) + sisipan + baca.slice(pos);
      // Pemeriksaan ulang: gagal satu saja = tidak dipakai.
      if (hasilRtf.length !== asli.length + sisipan.length) return null;
      if (hasilRtf.slice(0, pos) !== asli.slice(0, pos) || hasilRtf.slice(pos + sisipan.length) !== asli.slice(pos)) return null;
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
