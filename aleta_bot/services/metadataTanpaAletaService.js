"use strict";

/**
 * ============================================================================
 * TANPA TANDA ALETA DI METADATA BERKAS YANG MASUK SIPP (17 Okt 2026, butir 45)
 * ============================================================================
 *
 * soffice sendiri menulis Producer "LibreOffice x.y" dan Creator "Writer" -
 * bukan ALETA. Tetapi Title/Author/Subject/Keywords PDF disalin dari properti
 * naskah asalnya ({\info ...} RTF), dan naskah yang pernah dibuat/disunting
 * alat ALETA dapat membawa kata ALETA ke sana. Penjaga ini menghapusnya dari
 * METADATA saja - isi naskah tidak disentuh:
 *
 *   RTF  grup {\title}{\subject}{\author}{\operator}{\keywords}{\comment}
 *        {\doccomm}{\company}{\manager}{\category}{\*\company}{\*\generator}
 *        yang memuat ALETA dibuang;
 *   PDF  string /Title /Author /Subject /Keywords /Creator /Producer (literal
 *        maupun heksadesimal, PDFDocEncoding maupun UTF-16) dan paket XMP
 *        yang tak termampatkan: huruf ALETA diganti SPASI DENGAN PANJANG SAMA,
 *        sehingga tabel xref tetap benar tanpa menulis ulang PDF.
 *
 * Berkas tanpa tanda dikembalikan apa adanya (Buffer yang sama).
 */
const GRUP_INFO_RTF = /\{(?:\\\*)?\\(?:title|subject|author|operator|keywords|comment|doccomm|company|manager|category|hlinkbase|generator)(?![a-z])[^{}]*\}/gi;
const KUNCI_INFO_PDF = /\/(Title|Author|Subject|Keywords|Creator|Producer)\s*(\((?:\\[\s\S]|[^\\)])*\)|<[0-9A-Fa-f]*>)/g;
const ALETA_UTF16 = /\x00a\x00l\x00e\x00t\x00a/gi;
const XMP_PDF = /<x:xmpmeta[\s\S]*?<\/x:xmpmeta>/g;

function spasiSamaPanjang(teks) {
  return teks.replace(/aleta/gi, "     ");
}

function bersihkanHexPdf(hex) {
  const isi = hex.slice(1, -1);
  if (isi.length % 2) return hex;
  const bita = Buffer.from(isi, "hex");
  if (bita.length >= 2 && bita[0] === 0xfe && bita[1] === 0xff) {
    // UTF-16BE: ganti satuan kode huruf ALETA dengan 0x0020.
    const kode = [];
    for (let i = 2; i + 1 < bita.length; i += 2) kode.push(bita.readUInt16BE(i));
    const teks = String.fromCharCode(...kode);
    let m;
    const pola = /aleta/gi;
    let berubah = false;
    while ((m = pola.exec(teks))) {
      for (let j = 0; j < 5; j += 1) bita.writeUInt16BE(0x20, 2 + (m.index + j) * 2);
      berubah = true;
    }
    return berubah ? `<${bita.toString("hex").toUpperCase()}>` : hex;
  }
  const teks = bita.toString("latin1");
  const baru = spasiSamaPanjang(teks);
  return baru === teks ? hex : `<${Buffer.from(baru, "latin1").toString("hex").toUpperCase()}>`;
}

/** Sama dengan abtCetakService.kenaliDokumen untuk dua bentuk yang dibersihkan. */
function jenisBerkas(isi) {
  const kepala = isi.subarray(0, 5).toString("latin1");
  if (kepala.startsWith("%PDF-")) return "pdf";
  if (kepala.startsWith("{\\rtf")) return "rtf";
  return "";
}

function tanpaTandaAletaMetadata(isi) {
  if (!Buffer.isBuffer(isi) || isi.length < 5) return isi;
  const jenis = jenisBerkas(isi);
  if (jenis === "rtf") {
    const s = isi.toString("latin1");
    const baru = s.replace(GRUP_INFO_RTF, (g) => (/aleta/i.test(g) ? "" : g));
    return baru === s ? isi : Buffer.from(baru, "latin1");
  }
  if (jenis === "pdf") {
    const s = isi.toString("latin1");
    let baru = s.replace(KUNCI_INFO_PDF, (seluruh, _kunci, nilai) => {
      const n = nilai.startsWith("<") ? bersihkanHexPdf(nilai) : spasiSamaPanjang(nilai).replace(ALETA_UTF16, "\x00 \x00 \x00 \x00 \x00 ");
      return n === nilai ? seluruh : seluruh.slice(0, seluruh.length - nilai.length) + n;
    });
    baru = baru.replace(XMP_PDF, (x) => spasiSamaPanjang(x));
    return baru === s ? isi : Buffer.from(baru, "latin1");
  }
  return isi;
}

module.exports = { tanpaTandaAletaMetadata };
