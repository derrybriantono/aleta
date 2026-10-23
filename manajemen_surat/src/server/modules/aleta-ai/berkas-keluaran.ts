import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

import { TANDA_DRAF, type FormatBerkas } from "@/lib/aleta-ai/tugas";
import { bacaDaftarZip } from "@/server/modules/aleta-ai/zip-baca";
import { createXlsxWorkbook } from "@/server/shared/xlsx";
import { susunZip } from "@/server/shared/zip";

/**
 * ============================================================================
 * ALETA Ai TAHAP 3 - BERKAS KELUARAN (DOCX / RTF / PDF / HTML / XLSX)
 * ============================================================================
 *
 * Masukan: naskah Markdown sederhana yang SUDAH berisi data asli (kode samaran
 * dikembalikan oleh pemanggil) dan rujukan belum terverifikasi sudah ditandai.
 *
 * TEMPLAT: dari proyek V4.5 aktif (tabel aleta_ai_proyek_berkas), TIDAK dari
 * repo. Penanda yang diganti: {{ISI}} {{JUDUL}} {{NOMOR_PERKARA}} {{TANGGAL}}
 * {{TANDA_DRAF}}. Tanpa templat yang cocok dipakai susunan bawaan bergaya
 * putusan PA Donggala (Bookman/Times 12, rata kiri-kanan, judul di tengah).
 *
 * TANDA DRAF: setiap berkas memuat "Draf AI - wajib diperiksa" - di kepala
 * halaman (DOCX/PDF tiap halaman), baris pertama (RTF/HTML/XLSX) - termasuk bila
 * templatnya lupa menaruh {{TANDA_DRAF}}.
 *
 * Metadata berkas (penulis/aplikasi) dikosongkan: berkas ini dapat diunggah
 * petugas ke tempat lain, jadi tidak membawa nama aplikasi.
 */

export type TemplatBerkas = { nama: string; jenis: string; bita: Buffer };

export type MasukanBerkas = {
  format: FormatBerkas;
  judul: string;
  nomorPerkara: string;
  naskah: string;
  tanggal: string;
  templat?: TemplatBerkas | null;
};

export type BerkasJadi = { nama: string; format: FormatBerkas; mime: string; bita: Buffer; templat: string };

export const MIME_BERKAS: Record<FormatBerkas, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  rtf: "application/rtf",
  pdf: "application/pdf",
  html: "text/html; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

// ----------------------------------------------------------------------------
// Markdown sederhana -> blok
// ----------------------------------------------------------------------------

export type Blok =
  | { jenis: "judul"; tingkat: 1 | 2 | 3; teks: string }
  | { jenis: "paragraf"; teks: string }
  | { jenis: "butir"; teks: string }
  | { jenis: "tabel"; baris: string[][] };

const bersihInline = (s: string) => s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/__(.+?)__/g, "$1").replace(/`([^`]+)`/g, "$1");

export function bacaBlok(naskah: string): Blok[] {
  const hasil: Blok[] = [];
  let paragraf: string[] = [];
  let tabel: string[][] | null = null;
  const tutupParagraf = () => {
    if (paragraf.length) hasil.push({ jenis: "paragraf", teks: bersihInline(paragraf.join(" ").trim()) });
    paragraf = [];
  };
  const tutupTabel = () => {
    if (tabel?.length) hasil.push({ jenis: "tabel", baris: tabel });
    tabel = null;
  };
  for (const mentah of String(naskah ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    const baris = mentah.trimEnd();
    if (/^\s*\|.*\|\s*$/.test(baris)) {
      tutupParagraf();
      if (/^\s*\|[\s:|-]+\|\s*$/.test(baris)) continue;
      tabel ??= [];
      tabel.push(baris.trim().replace(/^\||\|$/g, "").split("|").map((s) => bersihInline(s.trim())));
      continue;
    }
    tutupTabel();
    const j = /^(#{1,3})\s+(.+)$/.exec(baris);
    if (j) {
      tutupParagraf();
      hasil.push({ jenis: "judul", tingkat: j[1]!.length as 1 | 2 | 3, teks: bersihInline(j[2]!.trim()) });
      continue;
    }
    const b = /^\s*(?:[-*]|\d+[.)])\s+(.+)$/.exec(baris);
    if (b) {
      tutupParagraf();
      hasil.push({ jenis: "butir", teks: bersihInline(b[1]!.trim()) });
      continue;
    }
    if (!baris.trim()) {
      tutupParagraf();
      continue;
    }
    paragraf.push(baris.trim());
  }
  tutupParagraf();
  tutupTabel();
  return hasil;
}

const namaAman = (s: string) =>
  String(s ?? "")
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 80) || "naskah";

const isiPenanda = (teks: string, m: MasukanBerkas, isi: string) =>
  teks
    .split("{{ISI}}").join(isi)
    .split("{{JUDUL}}").join(m.judul)
    .split("{{NOMOR_PERKARA}}").join(m.nomorPerkara)
    .split("{{TANGGAL}}").join(m.tanggal)
    .split("{{TANDA_DRAF}}").join(TANDA_DRAF);

// ----------------------------------------------------------------------------
// HTML
// ----------------------------------------------------------------------------

const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function blokHtml(blok: Blok[]): string {
  return blok
    .map((b) => {
      if (b.jenis === "judul") return `<h${b.tingkat + 1}>${escHtml(b.teks)}</h${b.tingkat + 1}>`;
      if (b.jenis === "butir") return `<p class="butir">&bull; ${escHtml(b.teks)}</p>`;
      if (b.jenis === "tabel")
        return `<table>${b.baris.map((r, i) => `<tr>${r.map((c) => (i === 0 ? `<th>${escHtml(c)}</th>` : `<td>${escHtml(c)}</td>`)).join("")}</tr>`).join("")}</table>`;
      return `<p>${escHtml(b.teks)}</p>`;
    })
    .join("\n");
}

function susunHtml(m: MasukanBerkas): Buffer {
  const isi = blokHtml(bacaBlok(m.naskah));
  const banner = `<div class="tanda-draf" role="note">${escHtml(TANDA_DRAF)}</div>`;
  if (m.templat) {
    let t = m.templat.bita.toString("utf8");
    const adaTanda = t.includes("{{TANDA_DRAF}}");
    t = isiPenanda(t, { ...m, judul: escHtml(m.judul), nomorPerkara: escHtml(m.nomorPerkara) }, isi);
    if (!adaTanda) t = /<body[^>]*>/i.test(t) ? t.replace(/<body[^>]*>/i, (x) => `${x}\n${banner}`) : `${banner}\n${t}`;
    return Buffer.from(t, "utf8");
  }
  return Buffer.from(
    `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><title>${escHtml(m.judul)}</title>
<style>
body{font-family:"Bookman Old Style","Times New Roman",serif;font-size:12pt;line-height:1.5;max-width:21cm;margin:2cm auto;color:#000;background:#fff}
.tanda-draf{border:2px solid #b00020;color:#b00020;font-weight:bold;text-align:center;padding:4px;margin-bottom:12px}
h2,h3{text-align:center}p{text-align:justify}table{border-collapse:collapse;width:100%}td,th{border:1px solid #000;padding:4px;vertical-align:top}
</style></head><body>
${banner}
<h1 style="text-align:center;font-size:14pt">${escHtml(m.judul)}</h1>
${m.nomorPerkara ? `<p style="text-align:center">Nomor ${escHtml(m.nomorPerkara)}</p>` : ""}
${isi}
</body></html>
`,
    "utf8"
  );
}

// ----------------------------------------------------------------------------
// RTF
// ----------------------------------------------------------------------------

export function escRtf(s: string): string {
  let out = "";
  for (const ch of String(s ?? "")) {
    const c = ch.codePointAt(0)!;
    if (ch === "\\" || ch === "{" || ch === "}") out += `\\${ch}`;
    else if (ch === "\n") out += "\\line ";
    else if (c < 128) out += ch;
    else if (c <= 0xffff) out += `\\u${c > 32767 ? c - 65536 : c}?`;
    else {
      const t = ch.length === 2 ? [ch.charCodeAt(0), ch.charCodeAt(1)] : [c];
      for (const x of t) out += `\\u${x > 32767 ? x - 65536 : x}?`;
    }
  }
  return out;
}

function blokRtf(blok: Blok[]): string {
  return blok
    .map((b) => {
      if (b.jenis === "judul") return `{\\pard\\qc\\b ${escRtf(b.teks)}\\b0\\par}`;
      if (b.jenis === "butir") return `{\\pard\\qj\\fi-284\\li284 \\bullet\\tab ${escRtf(b.teks)}\\par}`;
      if (b.jenis === "tabel") return b.baris.map((r) => `{\\pard\\ql ${r.map(escRtf).join(" | ")}\\par}`).join("\n");
      return `{\\pard\\qj\\fi720 ${escRtf(b.teks)}\\par}`;
    })
    .join("\n");
}

function susunRtf(m: MasukanBerkas): Buffer {
  const isi = blokRtf(bacaBlok(m.naskah));
  const tanda = `{\\pard\\qc\\b\\cf1 ${escRtf(TANDA_DRAF)}\\cf0\\b0\\par}`;
  if (m.templat) {
    let t = m.templat.bita.toString("latin1");
    const adaTanda = t.includes("{{TANDA_DRAF}}");
    t = isiPenanda(t, { ...m, judul: escRtf(m.judul), nomorPerkara: escRtf(m.nomorPerkara), tanggal: escRtf(m.tanggal) }, isi).split(TANDA_DRAF).join(escRtf(TANDA_DRAF));
    if (!adaTanda) {
      // Sisipkan sesudah tabel kepala (fonttbl/colortbl), sebelum paragraf pertama.
      const i = t.search(/\\pard/);
      t = i > 0 ? `${t.slice(0, i)}${tanda}\n${t.slice(i)}` : t.replace(/\}\s*$/, `${tanda}}`);
    }
    return Buffer.from(t, "latin1");
  }
  return Buffer.from(
    `{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0\\froman Bookman Old Style;}}{\\colortbl;\\red176\\green0\\blue32;}\\paperw11906\\paperh18709\\margl1701\\margr1134\\margt1134\\margb1134\\f0\\fs24
${tanda}
{\\pard\\qc\\b ${escRtf(m.judul)}\\b0\\par}
${m.nomorPerkara ? `{\\pard\\qc Nomor ${escRtf(m.nomorPerkara)}\\par}` : ""}
${isi}
}`,
    "latin1"
  );
}

// ----------------------------------------------------------------------------
// DOCX
// ----------------------------------------------------------------------------

const escXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const pXml = (teks: string, o: { tengah?: boolean; tebal?: boolean; merah?: boolean; indentasi?: boolean } = {}) =>
  `<w:p><w:pPr><w:jc w:val="${o.tengah ? "center" : "both"}"/>${o.indentasi ? `<w:ind w:firstLine="720"/>` : ""}</w:pPr><w:r><w:rPr>${o.tebal ? "<w:b/>" : ""}${o.merah ? `<w:color w:val="B00020"/>` : ""}</w:rPr><w:t xml:space="preserve">${escXml(teks)}</w:t></w:r></w:p>`;

function blokDocx(blok: Blok[]): string {
  return blok
    .map((b) => {
      if (b.jenis === "judul") return pXml(b.teks, { tengah: true, tebal: true });
      if (b.jenis === "butir") return pXml(`• ${b.teks}`);
      if (b.jenis === "tabel")
        return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/></w:tblBorders></w:tblPr>${b.baris
          .map((r) => `<w:tr>${r.map((c) => `<w:tc>${pXml(c)}</w:tc>`).join("")}</w:tr>`)
          .join("")}</w:tbl>`;
      return pXml(b.teks, { indentasi: true });
    })
    .join("");
}

const NS_W = `xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"`;

function docxBawaan(m: MasukanBerkas): Buffer {
  const isi = [pXml(m.judul, { tengah: true, tebal: true }), ...(m.nomorPerkara ? [pXml(`Nomor ${m.nomorPerkara}`, { tengah: true })] : []), blokDocx(bacaBlok(m.naskah))].join("");
  const dokumen = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${NS_W}><w:body>${pXml(TANDA_DRAF, { tengah: true, tebal: true, merah: true })}${isi}<w:sectPr><w:headerReference w:type="default" r:id="rIdKepala"/><w:pgSz w:w="11906" w:h="18709"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1701" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const kepala = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr ${NS_W}>${pXml(TANDA_DRAF, { tengah: true, tebal: true, merah: true })}</w:hdr>`;
  const gaya = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${NS_W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Bookman Old Style" w:hAnsi="Bookman Old Style" w:cs="Times New Roman"/><w:sz w:val="24"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>`;
  return susunZip([
    {
      nama: "[Content_Types].xml",
      isi: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`
      ),
    },
    {
      nama: "_rels/.rels",
      isi: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
      ),
    },
    {
      nama: "word/_rels/document.xml.rels",
      isi: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdKepala" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rIdGaya" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
      ),
    },
    { nama: "word/document.xml", isi: Buffer.from(dokumen, "utf8") },
    { nama: "word/header1.xml", isi: Buffer.from(kepala, "utf8") },
    { nama: "word/styles.xml", isi: Buffer.from(gaya, "utf8") },
  ]);
}

const BATAS_BAGIAN_DOCX = 20 * 1024 * 1024;

/** Templat DOCX: paragraf yang memuat {{ISI}} diganti paragraf naskah; tanda draf disisipkan di awal badan. */
function docxDariTemplat(m: MasukanBerkas, t: TemplatBerkas): Buffer {
  const entri = bacaDaftarZip(t.bita).filter((e) => !e.direktori);
  const isiBaru = blokDocx(bacaBlok(m.naskah));
  const berkas = entri.map((e) => {
    let isi = e.baca(BATAS_BAGIAN_DOCX);
    if (e.nama === "word/document.xml" || /^word\/(header|footer)\d*\.xml$/.test(e.nama)) {
      let xml = isi.toString("utf8");
      if (e.nama === "word/document.xml") {
        xml = xml.replace(/<w:p[ >](?:(?!<\/w:p>)[\s\S])*\{\{ISI\}\}(?:(?!<\/w:p>)[\s\S])*<\/w:p>/, isiBaru);
        if (!xml.includes("{{TANDA_DRAF}}")) xml = xml.replace(/<w:body>/, `<w:body>${pXml(TANDA_DRAF, { tengah: true, tebal: true, merah: true })}`);
      }
      xml = isiPenanda(xml, { ...m, judul: escXml(m.judul), nomorPerkara: escXml(m.nomorPerkara), tanggal: escXml(m.tanggal) }, isiBaru);
      isi = Buffer.from(xml, "utf8");
    }
    return { nama: e.nama, isi };
  });
  return susunZip(berkas);
}

// ----------------------------------------------------------------------------
// PDF
// ----------------------------------------------------------------------------

/** Huruf standar PDF (WinAnsi): karakter di luar itu diganti padanannya. */
const winAnsi = (s: string) =>
  s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/•/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x09\x0a\x0d\x20-\x7e\xa0-\xff]/g, "?");

function bungkus(teks: string, huruf: PDFFont, ukuran: number, lebar: number): string[] {
  const hasil: string[] = [];
  let baris = "";
  for (const kata of teks.split(/\s+/).filter(Boolean)) {
    const coba = baris ? `${baris} ${kata}` : kata;
    if (huruf.widthOfTextAtSize(coba, ukuran) <= lebar || !baris) baris = coba;
    else {
      hasil.push(baris);
      baris = kata;
    }
  }
  if (baris) hasil.push(baris);
  return hasil.length ? hasil : [""];
}

async function susunPdf(m: MasukanBerkas): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(winAnsi(m.judul));
  pdf.setAuthor("");
  pdf.setCreator("");
  pdf.setProducer("");
  const biasa = await pdf.embedFont(StandardFonts.TimesRoman);
  const tebal = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const [W, H] = [595.28, 935.43]; // F4
  const kiri = 85;
  const lebar = W - kiri - 57;
  let hal = pdf.addPage([W, H]);
  let y = H - 90;
  const halamanBaru = () => {
    hal = pdf.addPage([W, H]);
    y = H - 90;
  };
  const tulis = (teks: string, o: { huruf?: PDFFont; ukuran?: number; tengah?: boolean; jarak?: number } = {}) => {
    const huruf = o.huruf ?? biasa;
    const ukuran = o.ukuran ?? 12;
    for (const b of bungkus(winAnsi(teks), huruf, ukuran, lebar)) {
      if (y < 70) halamanBaru();
      const x = o.tengah ? kiri + (lebar - huruf.widthOfTextAtSize(b, ukuran)) / 2 : kiri;
      hal.drawText(b, { x, y, size: ukuran, font: huruf, color: rgb(0, 0, 0) });
      y -= ukuran * 1.5;
    }
    y -= o.jarak ?? 4;
  };
  tulis(m.judul, { huruf: tebal, ukuran: 14, tengah: true });
  if (m.nomorPerkara) tulis(`Nomor ${m.nomorPerkara}`, { tengah: true, jarak: 10 });
  for (const b of bacaBlok(m.naskah)) {
    if (b.jenis === "judul") tulis(b.teks, { huruf: tebal, tengah: true, jarak: 6 });
    else if (b.jenis === "butir") tulis(`- ${b.teks}`);
    else if (b.jenis === "tabel") for (const r of b.baris) tulis(r.join(" | "));
    else tulis(b.teks, { jarak: 8 });
  }
  // Tanda draf di kepala SETIAP halaman.
  for (const p of pdf.getPages()) {
    const t = TANDA_DRAF;
    const lebarT = tebal.widthOfTextAtSize(t, 11);
    p.drawText(t, { x: (W - lebarT) / 2, y: H - 50, size: 11, font: tebal, color: rgb(0.69, 0, 0.13) });
  }
  return Buffer.from(await pdf.save());
}

// ----------------------------------------------------------------------------
// XLSX
// ----------------------------------------------------------------------------

function susunXlsx(m: MasukanBerkas): Buffer {
  const blok = bacaBlok(m.naskah);
  const tabel = blok.filter((b): b is Extract<Blok, { jenis: "tabel" }> => b.jenis === "tabel");
  const sheets: Parameters<typeof createXlsxWorkbook>[0] = [
    {
      name: "Naskah",
      columns: [
        { key: "bagian", header: TANDA_DRAF, width: 28 },
        { key: "isi", header: m.judul, width: 100 },
      ],
      rows: [
        { bagian: "Nomor perkara", isi: m.nomorPerkara },
        { bagian: "Tanggal", isi: m.tanggal },
        ...blok.filter((b) => b.jenis !== "tabel").map((b) => ({ bagian: b.jenis === "judul" ? b.teks : "", isi: b.jenis === "judul" ? "" : (b as { teks: string }).teks })),
      ],
    },
  ];
  tabel.forEach((t, i) => {
    const kepala = t.baris[0] ?? [];
    sheets.push({
      name: `Tabel ${i + 1}`,
      columns: kepala.map((h, k) => ({ key: `k${k}`, header: h || `Kolom ${k + 1}`, width: 30 })),
      rows: [Object.fromEntries(kepala.map((_, k) => [`k${k}`, k === 0 ? TANDA_DRAF : ""])), ...t.baris.slice(1).map((r) => Object.fromEntries(r.map((c, k) => [`k${k}`, c])))],
    });
  });
  return createXlsxWorkbook(sheets, { creator: "", aplikasi: "" });
}

// ----------------------------------------------------------------------------

export async function susunBerkas(m: MasukanBerkas): Promise<BerkasJadi> {
  const nama = `${namaAman(m.judul)}${m.nomorPerkara ? `_${namaAman(m.nomorPerkara.replace(/\//g, "-"))}` : ""}.${m.format}`;
  const templat = m.templat && m.templat.jenis === m.format ? m.templat : null;
  const mm = { ...m, templat };
  let bita: Buffer;
  switch (m.format) {
    case "html":
      bita = susunHtml(mm);
      break;
    case "rtf":
      bita = susunRtf(mm);
      break;
    case "docx":
      bita = templat ? docxDariTemplat(mm, templat) : docxBawaan(mm);
      break;
    case "pdf":
      bita = await susunPdf(mm);
      break;
    case "xlsx":
      bita = susunXlsx(mm);
      break;
  }
  return { nama, format: m.format, mime: MIME_BERKAS[m.format], bita, templat: templat?.nama ?? "" };
}
