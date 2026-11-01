import { bukaDocx, paragrafDocx, seksiDocx, simpanDocx } from "../zcross/docx";
import { uraiRtf } from "../zcross/rtf";
import { uraiXml, type SimpulXml } from "../zcross/xml-mini";

/**
 * NOMOR HALAMAN AWAL BAS di naskah (keputusan 71, 1 Nov 2026) - jalur yang sama dengan Z cross (zcross/: RTF \pgnstarts + \pgnrestart,
 * DOCX w:pgNumType w:start). Dipasang SEBELUM Z cross supaya nomor halaman Z (dan bagian sesudah bukti) dihitung dari halaman awal ini.
 *
 *   - bagian PERTAMA naskah: nomor halaman mulai `awal`;
 *   - bagian lain yang di blangko diberi nomor mulai tetap (mis. \pgnstarts15 sesudah daftar bukti, \pgnstarts1 di tengah BAS): dijadikan
 *     BERSAMBUNG - nomor sesudah bukti diatur Z cross (halaman Z + jumlah halaman bukti + 1); BAS tidak pernah kembali ke halaman 1.
 *
 * Murni (bita -> bita). Naskah yang tidak dapat dibaca dikembalikan apa adanya dengan alasan.
 */
export type HasilNomorAwal = { bita: Uint8Array; dipasang: boolean; bagianDisambung: number; alasan: string };

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

export function pasangNomorAwalRtf(bita: Uint8Array, awal: number): HasilNomorAwal {
  const s = latin1(bita);
  const urai = uraiRtf(s);
  const seksi = urai.kejadian.filter((k) => k.jenis === "sectd");
  if (!seksi.length) return { bita, dipasang: false, bagianDisambung: 0, alasan: "Naskah tanpa pengaturan bagian: nomor halaman awal tidak dapat dipasang." };
  const ubah: Array<{ dari: number; sampai: number; teks: string }> = [];
  let disambung = 0;
  seksi.forEach((k, i) => {
    const kontrol = s.slice(k.akhir, k.akhirKontrol);
    const bersih = kontrol.replace(RE_PGN, "");
    if (i === 0) {
      ubah.push({ dari: k.akhir, sampai: k.akhirKontrol, teks: `\\pgnrestart\\pgnstarts${awal} ${bersih.replace(/^\s+/, "")}` });
    } else if (/\\pgn(?:restart|starts)/.test(kontrol)) {
      disambung += 1;
      ubah.push({ dari: k.akhir, sampai: k.akhirKontrol, teks: `\\pgncont ${bersih.replace(/^\s+/, "")}` });
    }
  });
  let hasil = s;
  for (const u of ubah.sort((a, b) => b.dari - a.dari)) hasil = hasil.slice(0, u.dari) + u.teks + hasil.slice(u.sampai);
  return { bita: keBita(hasil), dipasang: true, bagianDisambung: disambung, alasan: "" };
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
  const seksi = seksiDocx(akar, paragrafDocx(b.xml, akar));
  if (!seksi.length) return { bita, dipasang: false, bagianDisambung: 0, alasan: "Naskah tanpa pengaturan bagian: nomor halaman awal tidak dapat dipasang." };
  const ubah: Array<{ dari: number; sampai: number; teks: string }> = [];
  let disambung = 0;
  seksi.forEach((s, i) => {
    if (i === 0) ubah.push({ dari: s.sectPr.awal, sampai: s.sectPr.akhir, teks: tulisPgNum(b.xml, s.sectPr, awal) });
    else {
      const n = s.sectPr.anak.find((c) => c.nama === "w:pgNumType");
      if (n && /\sw:start="/.test(b.xml.slice(n.awal, n.akhir))) {
        disambung += 1;
        ubah.push({ dari: s.sectPr.awal, sampai: s.sectPr.akhir, teks: tulisPgNum(b.xml, s.sectPr, null) });
      }
    }
  });
  let xml = b.xml;
  for (const u of ubah.sort((a, c) => c.dari - a.dari)) xml = xml.slice(0, u.dari) + u.teks + xml.slice(u.sampai);
  return { bita: simpanDocx(b, xml), dipasang: true, bagianDisambung: disambung, alasan: "" };
}

/** RTF / DOCX; DOC lama tidak didukung (dikembalikan apa adanya dengan alasan). */
export function pasangNomorAwal(bita: Uint8Array, bentuk: "rtf" | "docx" | "doc", awal: number): HasilNomorAwal {
  const n = Math.max(1, Math.floor(awal) || 1);
  try {
    if (bentuk === "rtf") return pasangNomorAwalRtf(bita, n);
    if (bentuk === "docx") return pasangNomorAwalDocx(bita, n);
  } catch (e) {
    return { bita, dipasang: false, bagianDisambung: 0, alasan: `Nomor halaman awal tidak dapat dipasang: ${e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200)}` };
  }
  return { bita, dipasang: false, bagianDisambung: 0, alasan: "Berkas DOC lama: nomor halaman awal tidak dapat dipasang otomatis (simpan sebagai DOCX atau RTF)." };
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
