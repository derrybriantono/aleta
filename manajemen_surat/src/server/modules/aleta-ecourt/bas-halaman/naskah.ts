import { bukaDocx, paragrafDocx, seksiDocx, simpanDocx } from "../zcross/docx";
import { uraiRtf } from "../zcross/rtf";
import { uraiXml, type SimpulXml } from "../zcross/xml-mini";

/**
 * NOMOR HALAMAN AWAL BAS di naskah (keputusan 71, 1 Nov 2026) - jalur yang sama dengan Z cross (zcross/: RTF \pgnstarts + \pgnrestart,
 * DOCX w:pgNumType w:start). Dipasang SEBELUM Z cross supaya nomor halaman Z (dan bagian sesudah bukti) dihitung dari halaman awal ini.
 *
 *   - bagian PERTAMA naskah: nomor halaman mulai `awal`;
 *   - bagian lain yang di blangko diberi nomor mulai tetap (mis. \pgnstarts15 sesudah daftar bukti, \pgnstarts1 di tengah BAS): dijadikan
 *     BERSAMBUNG - nomor sesudah bukti diatur Z cross (halaman Z + jumlah halaman bukti + 1); BAS tidak pernah kembali ke halaman 1;
 *   - keputusan 87: bagian yang dimulai sesudah LAMPIRAN jawaban/replik/duplik/kesimpulan tertulis dilaporkan (`lampiran`) supaya
 *     pemanggil (layanan.ts) melompatkan nomornya sebanyak halaman lampiran (pasangNomorBagian) sesudah letak halamannya diukur.
 *
 * Murni (bita -> bita). Naskah yang tidak dapat dibaca dikembalikan apa adanya dengan alasan.
 */
export type LampiranBagian = {
  /** Urutan bagian (0 = pertama) yang dimulai SESUDAH lampiran. */
  seksiKe: number;
  jenis: "jawaban" | "replik" | "duplik" | "kesimpulan";
  /** Paragraf bertulisan terakhir sebelum pemisah bagian (dicari halamannya di PDF). */
  teksJangkar: string;
  paragrafIndeks: number;
};

export type HasilNomorAwal = { bita: Uint8Array; dipasang: boolean; bagianDisambung: number; alasan: string; lampiran: LampiranBagian[] };

const latin1 = (b: Uint8Array): string => {
  let s = "";
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192));
  return s;
};
function keBita(s: string): Uint8Array {
  const o = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) o[i] = s.charCodeAt(i) & 0xff;
  return o;
}

const RE_PGN = /\\pgn(?:restart|cont|starts-?\d+)(?![a-z])\s?/g;
const RE_LAMPIRAN = /\b(jawaban|replik|duplik|kesimpulan)\b/gi;
const SERAH = "(?:diunggah|mengunggah|menyerahkan|diserahkan|mengajukan|diajukan|meneliti|tertulis|terlampir|dilampirkan)";
/** Kata lampiran dan kata penyerahan/unggah berdekatan (<= 60 huruf, urutan bebas): "meneliti jawaban yang telah diunggah", "replik tertulis". */
const RE_SERAH = new RegExp(`\\b${SERAH}\\b[^.;]{0,60}?\\b(?:jawaban|replik|duplik|kesimpulan)\\b|\\b(?:jawaban|replik|duplik|kesimpulan)\\b[^.;]{0,60}?\\b${SERAH}\\b`, "i");

/** Lampiran tertulis di akhir bagian: paragraf bertulisan terakhir (sampai 4) sebelum pemisah yang menyebut jawaban/replik/duplik/kesimpulan. */
function kenaliLampiran(teks: ReadonlyArray<string>, akhir: number): { jenis: LampiranBagian["jenis"]; indeks: number } | null {
  let jangkar = -1;
  let n = 0;
  for (let i = akhir; i >= 0 && n < 4; i -= 1) {
    if (!teks[i] || !teks[i].trim()) continue;
    // jangkar = paragraf bertulisan bermakna terakhir (bukan "..." isian kosong) - dicari halamannya di PDF
    if (jangkar < 0 && /\p{L}{2,}/u.test(teks[i])) jangkar = i;
    n += 1;
    // daftar bukti diurus Z cross, bukan lampiran
    if (n === 1 && /(?:berikut|berupa)\s*:\s*$/i.test(teks[i]) && /bukti/i.test(teks.slice(Math.max(0, i - 3), i + 1).join(" "))) return null;
    const m = [...teks[i].matchAll(RE_LAMPIRAN)];
    // hanya lampiran yang DISERAHKAN/DIUNGGAH (bukan sekadar "ditunda untuk kesimpulan")
    if (m.length && RE_SERAH.test(teks[i])) return { jenis: m[m.length - 1][1].toLowerCase() as LampiranBagian["jenis"], indeks: jangkar };
  }
  return null;
}

export function pasangNomorAwalRtf(bita: Uint8Array, awal: number): HasilNomorAwal {
  const s = latin1(bita);
  const urai = uraiRtf(s);
  const seksi = urai.kejadian.filter((k) => k.jenis === "sectd");
  if (!seksi.length) return { bita, dipasang: false, bagianDisambung: 0, alasan: "Naskah tanpa pengaturan bagian: nomor halaman awal tidak dapat dipasang.", lampiran: [] };
  const ubah: Array<{ dari: number; sampai: number; teks: string }> = [];
  let disambung = 0;
  const lampiran: LampiranBagian[] = [];
  const teks = urai.paragraf.map((p) => p.teks);
  const pemisah = urai.kejadian.filter((k) => k.jenis === "sect");
  seksi.forEach((k, i) => {
    const kontrol = s.slice(k.akhir, k.akhirKontrol);
    const bersih = kontrol.replace(RE_PGN, "");
    if (i === 0) {
      ubah.push({ dari: k.akhir, sampai: k.akhirKontrol, teks: `\\pgnrestart\\pgnstarts${awal} ${bersih.replace(/^\s+/, "")}` });
    } else if (/\\pgn(?:restart|starts)/.test(kontrol)) {
      disambung += 1;
      ubah.push({ dari: k.akhir, sampai: k.akhirKontrol, teks: `\\pgncont ${bersih.replace(/^\s+/, "")}` });
      const sect = pemisah.filter((x) => x.pos < k.pos).pop();
      const akhirPar = sect ? urai.paragraf.filter((p) => p.akhir <= sect.pos).length - 1 : -1;
      const l = akhirPar >= 0 ? kenaliLampiran(teks, akhirPar) : null;
      if (l) lampiran.push({ seksiKe: i, jenis: l.jenis, teksJangkar: teks[l.indeks], paragrafIndeks: l.indeks });
    }
  });
  let hasil = s;
  for (const u of ubah.sort((a, b) => b.dari - a.dari)) hasil = hasil.slice(0, u.dari) + u.teks + hasil.slice(u.sampai);
  return { bita: keBita(hasil), dipasang: true, bagianDisambung: disambung, alasan: "", lampiran };
}

function tulisPgNum(x: string, sp: SimpulXml, mulai: number | null): string {
  const tag = x.slice(sp.awal, sp.awalIsi);
  let isi = sp.tertutupSendiri ? "" : x.slice(sp.awalIsi, sp.akhirIsi);
  const lama = sp.anak.find((c) => c.nama === "w:pgNumType");
  if (lama) {
    const potong = x.slice(lama.awal, lama.akhir);
    // atribut lain (format angka, pemisah bab) dipertahankan; hanya w:start yang diatur
    let baru = potong.replace(/\s+w:start="[^"]*"/, "");
    if (mulai != null) baru = baru.replace(/^<w:pgNumType/, `<w:pgNumType w:start="${mulai}"`);
    const dari = lama.awal - sp.awalIsi;
    isi = isi.slice(0, dari) + baru + isi.slice(dari + potong.length);
  } else if (mulai != null) {
    const SESUDAH = ["w:cols", "w:formProt", "w:vAlign", "w:noEndnote", "w:titlePg", "w:textDirection", "w:bidi", "w:rtlGutter", "w:docGrid", "w:printerSettings", "w:sectPrChange"];
    const sesudah = sp.anak.find((c) => SESUDAH.includes(c.nama));
    const pos = sesudah ? sesudah.awal - sp.awalIsi : isi.length;
    isi = isi.slice(0, pos) + `<w:pgNumType w:start="${mulai}"/>` + isi.slice(pos);
  }
  return `${tag.replace(/\/>$/, ">")}${isi}</w:sectPr>`;
}

export function pasangNomorAwalDocx(bita: Uint8Array, awal: number): HasilNomorAwal {
  const b = bukaDocx(bita);
  const akar = uraiXml(b.xml);
  const paragraf = paragrafDocx(b.xml, akar);
  const seksi = seksiDocx(akar, paragraf);
  if (!seksi.length) return { bita, dipasang: false, bagianDisambung: 0, alasan: "Naskah tanpa pengaturan bagian: nomor halaman awal tidak dapat dipasang.", lampiran: [] };
  const ubah: Array<{ dari: number; sampai: number; teks: string }> = [];
  let disambung = 0;
  const lampiran: LampiranBagian[] = [];
  const teks = paragraf.map((p) => p.teks);
  seksi.forEach((s, i) => {
    if (i === 0) ubah.push({ dari: s.sectPr.awal, sampai: s.sectPr.akhir, teks: tulisPgNum(b.xml, s.sectPr, awal) });
    else {
      const n = s.sectPr.anak.find((c) => c.nama === "w:pgNumType");
      if (n && /\sw:start="/.test(b.xml.slice(n.awal, n.akhir))) {
        disambung += 1;
        ubah.push({ dari: s.sectPr.awal, sampai: s.sectPr.akhir, teks: tulisPgNum(b.xml, s.sectPr, null) });
        const akhirPar = seksi[i - 1].paragrafIndeks ?? -1;
        const l = akhirPar >= 0 ? kenaliLampiran(teks, akhirPar) : null;
        if (l) lampiran.push({ seksiKe: i, jenis: l.jenis, teksJangkar: teks[l.indeks], paragrafIndeks: l.indeks });
      }
    }
  });
  let xml = b.xml;
  for (const u of ubah.sort((a, c) => c.dari - a.dari)) xml = xml.slice(0, u.dari) + u.teks + xml.slice(u.sampai);
  return { bita: simpanDocx(b, xml), dipasang: true, bagianDisambung: disambung, alasan: "", lampiran };
}

/** RTF / DOCX; DOC lama harus diubah ke DOCX lebih dulu (layanan.ts pasangRunut melakukannya otomatis). */
export function pasangNomorAwal(bita: Uint8Array, bentuk: "rtf" | "docx" | "doc", awal: number): HasilNomorAwal {
  const n = Math.max(1, Math.floor(awal) || 1);
  try {
    if (bentuk === "rtf") return pasangNomorAwalRtf(bita, n);
    if (bentuk === "docx") return pasangNomorAwalDocx(bita, n);
  } catch (e) {
    return { bita, dipasang: false, bagianDisambung: 0, alasan: `Nomor halaman awal tidak dapat dipasang: ${e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200)}`, lampiran: [] };
  }
  return { bita, dipasang: false, bagianDisambung: 0, alasan: "Berkas DOC lama: nomor halaman awal hanya dapat dipasang sesudah diubah ke DOCX.", lampiran: [] };
}

/** Nomor awal bagian-bagian tertentu (seksiKe -> nomor): RTF \pgnrestart\pgnstartsN, DOCX w:pgNumType w:start. */
export function pasangNomorBagian(bita: Uint8Array, bentuk: "rtf" | "docx", nomor: ReadonlyMap<number, number>): Uint8Array {
  if (!nomor.size) return bita;
  if (bentuk === "rtf") {
    const s = latin1(bita);
    const ubah: Array<{ dari: number; sampai: number; teks: string }> = [];
    uraiRtf(s)
      .kejadian.filter((k) => k.jenis === "sectd")
      .forEach((k, i) => {
        const n = nomor.get(i);
        if (n == null) return;
        const bersih = s.slice(k.akhir, k.akhirKontrol).replace(RE_PGN, "");
        ubah.push({ dari: k.akhir, sampai: k.akhirKontrol, teks: `\\pgnrestart\\pgnstarts${n} ${bersih.replace(/^\s+/, "")}` });
      });
    let hasil = s;
    for (const u of ubah.sort((a, c) => c.dari - a.dari)) hasil = hasil.slice(0, u.dari) + u.teks + hasil.slice(u.sampai);
    return keBita(hasil);
  }
  const b = bukaDocx(bita);
  const akar = uraiXml(b.xml);
  const seksi = seksiDocx(akar, paragrafDocx(b.xml, akar));
  let xml = b.xml;
  const ubah = seksi.map((sp, i) => ({ sp, n: nomor.get(i) })).filter((x): x is { sp: (typeof seksi)[number]; n: number } => x.n != null);
  for (const u of ubah.sort((a, c) => c.sp.sectPr.awal - a.sp.sectPr.awal)) xml = xml.slice(0, u.sp.sectPr.awal) + tulisPgNum(b.xml, u.sp.sectPr, u.n) + xml.slice(u.sp.sectPr.akhir);
  return simpanDocx(b, xml);
}

/** Teks paragraf naskah (untuk mengenali nomor perkara & tanggal sidang). */
export function paragrafNaskah(bita: Uint8Array, bentuk: "rtf" | "docx" | "doc"): string[] {
  try {
    if (bentuk === "rtf") return uraiRtf(latin1(bita)).paragraf.map((p) => p.teks);
    if (bentuk === "docx") {
      const b = bukaDocx(bita);
      return paragrafDocx(b.xml, uraiXml(b.xml)).map((p) => p.teks);
    }
  } catch {
    /* tidak terbaca */
  }
  return [];
}
