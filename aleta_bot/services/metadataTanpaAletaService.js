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

/**
 * Keputusan 18 Okt 2026 (butir 18): grup RTF tersembunyi penanda asal blangko -
 * {\*\isianasal ...} dan {\*\aletaasal ...} - milik Blangko Derry (pagar tempat
 * tanda tangan), tidak berguna di SIPP dan tidak boleh ikut terunggah. Dibuang
 * BESERTA ISINYA, grup bersarang dihitung (\{ \} \\ dilewati). Berkas tanpa grup
 * itu dikembalikan apa adanya (objek yang sama).
 */
const PENANDA_GRUP_TERSEMBUNYI = /\{\\\*\s*\\(?:isianasal|aletaasal)(?![a-z])/gi;

/** Indeks tepat sesudah kurung penutup grup yang dibuka sebelum `dari`. */
function akhirGrupRtf(s, dari) {
  let dalam = 1;
  let i = dari;
  for (; i < s.length && dalam > 0; i += 1) {
    const c = s[i];
    if (c === "\\") i += 1;
    else if (c === "{") dalam += 1;
    else if (c === "}") dalam -= 1;
  }
  return i;
}

function buangGrupTersembunyiRtfTeks(s) {
  PENANDA_GRUP_TERSEMBUNYI.lastIndex = 0;
  if (!PENANDA_GRUP_TERSEMBUNYI.test(s)) return s;
  PENANDA_GRUP_TERSEMBUNYI.lastIndex = 0;
  let keluar = "";
  let akhir = 0;
  let m;
  while ((m = PENANDA_GRUP_TERSEMBUNYI.exec(s))) {
    if (m.index < akhir) continue;
    const i = akhirGrupRtf(s, m.index + m[0].length);
    keluar += s.slice(akhir, m.index);
    akhir = i;
    PENANDA_GRUP_TERSEMBUNYI.lastIndex = i;
  }
  return keluar + s.slice(akhir);
}

/** Buffer atau string RTF masuk, jenis yang sama keluar; yang bukan RTF dikembalikan apa adanya. */
function buangGrupTersembunyiRtf(isi) {
  if (Buffer.isBuffer(isi)) {
    if (isi.length < 5 || jenisBerkas(isi) !== "rtf") return isi;
    const s = isi.toString("latin1");
    const baru = buangGrupTersembunyiRtfTeks(s);
    return baru === s ? isi : Buffer.from(baru, "latin1");
  }
  if (typeof isi === "string" && isi.startsWith("{\\rtf")) return buangGrupTersembunyiRtfTeks(isi);
  return isi;
}

/**
 * Grup tujuan-tersembunyi RTF ({\*\xxx ...}) yang masih menyebut kata itu
 * (sesudah metadata dibersihkan dan grup asal dibuang). teksRtf melewati grup
 * semacam ini, jadi pemeriksaan isi biasa tidak melihatnya. Pulang teks grup
 * pertama yang kena, atau "". Gambar (pict) dan data biner teknis dilewati.
 */
function grupTersembunyiMenyebut(isi, menyebut) {
  const s = Buffer.isBuffer(isi) ? isi.toString("latin1") : String(isi);
  const pola = /\{\\\*/g;
  let m;
  while ((m = pola.exec(s))) {
    const i = akhirGrupRtf(s, m.index + m[0].length);
    const grup = s.slice(m.index, i);
    if (/^\{\\\*\s*\\(?:pict|blipuid|themedata|colorschememapping|datastore)/i.test(grup)) {
      pola.lastIndex = i;
      continue;
    }
    if (menyebut(grup)) return grup;
  }
  return "";
}

module.exports = { tanpaTandaAletaMetadata, buangGrupTersembunyiRtf, grupTersembunyiMenyebut };
